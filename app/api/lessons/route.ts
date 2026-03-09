import { HomeworkSubmissionStatus, LessonParticipantState, LessonProcessingStatus, RecommendationType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getTeacherStudentIds, isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureUserRows } from "@/lib/edu-service";
import { processLessonAi } from "@/lib/lesson-ai";
import { buildStorageObject } from "@/lib/storage";
import { TranscriptLine } from "@/lib/types";
import { completeMissionByTitle, grantFocusXp } from "@/server/iui/gamification.service";

const transcriptLineSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
  timestamp: z.string().min(1)
});

const createLessonSchema = z.object({
  title: z.string().min(2).max(140),
  subject: z.string().min(2).max(120),
  classroomName: z.string().max(120).optional(),
  notes: z.string().max(10000).optional(),
  durationSec: z.number().int().min(0).max(6 * 60 * 60).default(0),
  transcript: z.array(transcriptLineSchema).default([]),
  participantIds: z.array(z.string()).default([])
});

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (isTeacherRole(user.role)) {
      const lessons = await db.lesson.findMany({
        where: { teacherId: user.id },
        select: {
          id: true,
          title: true,
          subject: true,
          classroomName: true,
          aiStatus: true,
          summary: true,
          aiError: true,
          createdAt: true,
          startedAt: true,
          endedAt: true,
          durationSec: true,
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              state: true,
              user: { select: { id: true, name: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 30
      });
      return NextResponse.json({ lessons });
    }

    const lessons = await db.lesson.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
            OR: [{ accessGranted: true }, { role: UserRole.student }]
          }
        }
      },
      select: {
        id: true,
        title: true,
        subject: true,
        classroomName: true,
        aiStatus: true,
        summary: true,
        aiError: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        durationSec: true,
        transcript: true,
        notes: true
      },
      orderBy: { createdAt: "desc" },
      take: 30
    });
    return NextResponse.json({ lessons });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load lessons", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can create lessons" }, { status: 403 });
    }

    const parsed = createLessonSchema.parse(await request.json());
    const transcript = parsed.transcript as TranscriptLine[];
    const teacherStudentIds = await getTeacherStudentIds(user.id);
    const participantIds = Array.from(
      new Set(parsed.participantIds.filter((id) => teacherStudentIds.includes(id) && id !== user.id))
    );
    const lessonParticipants = Array.from(
      new Map(
        [
          {
            userId: user.id,
            role: UserRole.teacher,
            state: LessonParticipantState.ACTIVE,
            accessGranted: true
          },
          ...participantIds.map((id) => ({
            userId: id,
            role: UserRole.student,
            state: LessonParticipantState.ONLINE,
            accessGranted: true
          }))
        ].map((item) => [item.userId, item])
      ).values()
    );

    const now = new Date();
    const lesson = await db.lesson.create({
      data: {
        teacherId: user.id,
        title: parsed.title,
        subject: parsed.subject,
        classroomName: parsed.classroomName,
        notes: parsed.notes,
        transcript: JSON.stringify(transcript),
        startedAt: new Date(now.getTime() - parsed.durationSec * 1000),
        endedAt: now,
        durationSec: parsed.durationSec,
        aiStatus: LessonProcessingStatus.PROCESSING,
        participants: {
          create: lessonParticipants
        }
      },
      select: {
        id: true,
        teacherId: true,
        title: true,
        subject: true,
        notes: true,
        transcript: true,
        aiStatus: true,
        createdAt: true
      }
    });

    const recordingStorage = buildStorageObject({ lessonId: lesson.id, kind: "recording", extension: "webm" });
    const transcriptStorage = buildStorageObject({ lessonId: lesson.id, kind: "transcript", extension: "json" });
    const summaryStorage = buildStorageObject({ lessonId: lesson.id, kind: "summary", extension: "json" });

    let aiAvailable = true;
    let aiError = "";
    let summary = "";
    let keyTopics: string[] = [];
    let recommendations: string[] = [];
    let generatedHomework: string[] = [];

    try {
      const ai = await processLessonAi({
        transcript,
        notes: parsed.notes ?? ""
      });

      summary = ai.summary;
      keyTopics = ai.keyTopics;
      recommendations = ai.recommendations;
      generatedHomework = ai.homework.map((item) => item.title).filter(Boolean);
      if (!generatedHomework.length) {
        generatedHomework = [
          `Write a short recap of ${parsed.subject} and solve one follow-up task based on: ${ai.keyTopics[0] ?? parsed.title}.`
        ];
      }

      await db.lesson.update({
        where: { id: lesson.id },
        data: {
          aiStatus: LessonProcessingStatus.READY,
          summary: JSON.stringify({
            text: ai.summary,
            keyTopics: ai.keyTopics,
            recommendations: ai.recommendations,
            difficultMoments: ai.difficultMoments
          }),
          aiError: null,
          s3Bucket: recordingStorage.bucket ?? undefined,
          s3Region: recordingStorage.region ?? undefined,
          recordingKey: recordingStorage.key,
          transcriptKey: transcriptStorage.key,
          summaryKey: summaryStorage.key
        }
      });

      if (participantIds.length && generatedHomework.length) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);

        for (const studentId of participantIds) {
          await ensureUserRows(studentId);
          await grantFocusXp({
            studentId,
            xp: 12,
            source: "LESSON_COMPLETED",
            reason: `Completed lesson: ${parsed.title}`
          });
          await completeMissionByTitle(studentId, "Lesson");

          await db.assignment.create({
            data: {
              studentId,
              lessonId: lesson.id,
              title: `${parsed.subject} adaptive follow-up`,
              description:
                ai.recommendations[0] ??
                `Review the main concept from ${parsed.title} and answer a short reflective prompt.`,
              difficulty: "adaptive",
              generatedByAI: true,
              type: "lesson_follow_up",
              status: "PENDING",
              reason: ai.difficultMoments[0] ?? "Generated from saved lesson summary and live participation."
            }
          });

          await db.aIRecommendation.createMany({
            data: [
              {
                studentId,
                teacherId: user.id,
                recommendationType: RecommendationType.ADAPTIVE_TASK,
                content:
                  ai.recommendations[0] ??
                  `Student should review ${ai.keyTopics[0] ?? parsed.subject} with one short scaffolded task.`
              },
              {
                studentId,
                teacherId: user.id,
                recommendationType: RecommendationType.TEACHER_INSIGHT,
                content:
                  ai.recommendations.join(" ") ||
                  `Lesson ${parsed.title} was saved. Use the archive summary to plan the next explanation block.`
              }
            ]
          });

          for (const [index, task] of generatedHomework.entries()) {
            const homework = await db.homework.create({
              data: {
                createdBy: user.id,
                studentId,
                lessonId: lesson.id,
                title: `AI Lesson Homework #${index + 1}`,
                subject: parsed.subject,
                grade: Number(parsed.classroomName?.match(/\d+/)?.[0] ?? 9),
                topic: ai.keyTopics[index] ?? "Generated from live lesson",
                description: task,
                content: task,
                generatedByAI: true,
                difficulty: "adaptive",
                dueDate,
                points: 10
              },
              select: { id: true }
            });

            await db.homeworkSubmission.upsert({
              where: {
                homeworkId_userId: {
                  homeworkId: homework.id,
                  userId: studentId
                }
              },
              create: {
                homeworkId: homework.id,
                userId: studentId,
                status: HomeworkSubmissionStatus.NOT_STARTED
              },
              update: {}
            });
          }
        }
      }
    } catch (error) {
      aiAvailable = false;
      aiError = error instanceof Error ? error.message : "AI processing failed";
      if (participantIds.length) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);

        for (const studentId of participantIds) {
          await ensureUserRows(studentId);
          await db.assignment.create({
            data: {
              studentId,
              lessonId: lesson.id,
              title: `${parsed.subject} recap task`,
              description: `Review the saved lesson "${parsed.title}" and write a short summary in your own words.`,
              difficulty: "medium",
              generatedByAI: false,
              type: "lesson_recap",
              status: "PENDING",
              reason: "Fallback task created because AI post-processing was unavailable."
            }
          });
          const homework = await db.homework.create({
            data: {
              createdBy: user.id,
              studentId,
              lessonId: lesson.id,
              title: "Lesson recap homework",
              subject: parsed.subject,
              grade: Number(parsed.classroomName?.match(/\d+/)?.[0] ?? 9),
              topic: parsed.title,
              description: `Open the lesson archive, read your notes, and prepare a concise recap with one solved example.`,
              content: `Open the lesson archive, read your notes, and prepare a concise recap with one solved example.`,
              generatedByAI: false,
              difficulty: "medium",
              dueDate,
              points: 10
            },
            select: { id: true }
          });

          await db.homeworkSubmission.upsert({
            where: {
              homeworkId_userId: {
                homeworkId: homework.id,
                userId: studentId
              }
            },
            create: {
              homeworkId: homework.id,
              userId: studentId,
              status: HomeworkSubmissionStatus.NOT_STARTED
            },
            update: {}
          });
        }
      }
      await db.lesson.update({
        where: { id: lesson.id },
        data: {
          aiStatus: LessonProcessingStatus.FAILED,
          aiError,
          s3Bucket: recordingStorage.bucket ?? undefined,
          s3Region: recordingStorage.region ?? undefined,
          recordingKey: recordingStorage.key,
          transcriptKey: transcriptStorage.key
        }
      });
    }

    return NextResponse.json({
      ok: true,
      lessonId: lesson.id,
      status: aiAvailable ? "READY" : "FAILED",
      aiAvailable,
      aiError: aiAvailable ? null : aiError,
      summary,
      keyTopics,
      recommendations,
      generatedHomework,
      storage: {
        bucket: recordingStorage.bucket,
        region: recordingStorage.region,
        recordingKey: recordingStorage.key,
        transcriptKey: transcriptStorage.key,
        summaryKey: aiAvailable ? summaryStorage.key : null
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
