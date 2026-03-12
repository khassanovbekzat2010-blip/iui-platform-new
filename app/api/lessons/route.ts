import { HomeworkSubmissionStatus, LessonParticipantState, LessonProcessingStatus, RecommendationType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getTeacherStudentIds, isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureUserRows } from "@/lib/edu-service";
import { buildLessonEegSummary } from "@/lib/lesson-eeg-summary";
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
    const startedAt = new Date(now.getTime() - parsed.durationSec * 1000);
    const lesson = await db.lesson.create({
      data: {
        teacherId: user.id,
        title: parsed.title,
        subject: parsed.subject,
        classroomName: parsed.classroomName,
        notes: parsed.notes,
        transcript: JSON.stringify(transcript),
        startedAt,
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
    const eegSummary = await buildLessonEegSummary({
      studentIds: participantIds,
      startedAt,
      endedAt: now
    });

    try {
      const ai = await processLessonAi({
        transcript,
        notes: parsed.notes ?? "",
        dropMoments: eegSummary.dropMoments,
        engagementValues: eegSummary.engagementValues,
        eegSummary
      });

      summary = ai.summary;
      keyTopics = ai.keyTopics;
      recommendations = ai.recommendations;
      generatedHomework = ai.homework
        .map((item, index) => {
          const topic = ai.keyTopics[index] ?? ai.keyTopics[0] ?? parsed.title;
          return `По теме "${topic}" выполни понятное задание: кратко объясни основную идею, реши один пример и запиши итоговый вывод своими словами.`;
        })
        .filter(Boolean);
      if (!generatedHomework.length) {
        generatedHomework = [
          `По теме "${ai.keyTopics[0] ?? parsed.title}" сделай короткий конспект, реши один пример и объясни ответ своими словами.`
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
            difficultMoments: ai.difficultMoments,
            eeg: eegSummary
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
              title: `${parsed.subject}: персональное задание`,
              description:
                ai.recommendations[0] ??
                `Повтори ключевую идею урока "${parsed.title}" и ответь на короткий вопрос по теме.`,
              difficulty: "adaptive",
              generatedByAI: true,
              type: "lesson_follow_up",
              status: "PENDING",
              reason: ai.difficultMoments[0] ?? "Сформировано после анализа урока, вовлеченности и затруднений ученика."
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
                  `Ученику стоит повторить тему "${ai.keyTopics[0] ?? parsed.subject}" через одно короткое пошаговое задание.`
              },
              {
                studentId,
                teacherId: user.id,
                recommendationType: RecommendationType.TEACHER_INSIGHT,
                content:
                  ai.recommendations.join(" ") ||
                  `Урок "${parsed.title}" сохранен. Используйте summary и архив, чтобы спланировать следующий блок объяснения.`
              }
            ]
          });

          for (const [index, task] of generatedHomework.entries()) {
            const homework = await db.homework.create({
              data: {
                createdBy: user.id,
                studentId,
                lessonId: lesson.id,
                title: `Домашнее задание по уроку #${index + 1}`,
                subject: parsed.subject,
                grade: Number(parsed.classroomName?.match(/\d+/)?.[0] ?? 9),
                topic: ai.keyTopics[index] ?? "Материал текущего урока",
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
              title: `${parsed.subject}: задание на повторение`,
              description: `Открой сохраненный урок "${parsed.title}", повтори тему и запиши краткое объяснение своими словами.`,
              difficulty: "medium",
              generatedByAI: false,
              type: "lesson_recap",
              status: "PENDING",
              reason: "Резервное задание создано, потому что AI-анализ урока был временно недоступен."
            }
          });
          const homework = await db.homework.create({
            data: {
              createdBy: user.id,
              studentId,
              lessonId: lesson.id,
              title: "Домашка на повторение урока",
              subject: parsed.subject,
              grade: Number(parsed.classroomName?.match(/\d+/)?.[0] ?? 9),
              topic: parsed.title,
              description: `Открой архив урока, перечитай заметки и подготовь краткий конспект с одним решенным примером.`,
              content: `Открой архив урока, перечитай заметки и подготовь краткий конспект с одним решенным примером.`,
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
