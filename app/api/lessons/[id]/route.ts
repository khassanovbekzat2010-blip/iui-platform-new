import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

function parseSummary(summary: string | null) {
  if (!summary) {
    return {
      text: "",
      keyTopics: [] as string[],
      recommendations: [] as string[],
      difficultMoments: [] as string[]
    };
  }

  try {
    const parsed = JSON.parse(summary) as {
      text?: string;
      keyTopics?: string[];
      recommendations?: string[];
      difficultMoments?: string[];
    };
    return {
      text: parsed.text ?? "",
      keyTopics: parsed.keyTopics ?? [],
      recommendations: parsed.recommendations ?? [],
      difficultMoments: parsed.difficultMoments ?? []
    };
  } catch {
    return {
      text: summary,
      keyTopics: [] as string[],
      recommendations: [] as string[],
      difficultMoments: [] as string[]
    };
  }
}

function parseTranscript(transcript: string | null) {
  if (!transcript) return [];
  try {
    const parsed = JSON.parse(transcript);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const { id } = await context.params;

    const lesson = await db.lesson.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        },
        homeworks: {
          include: {
            submissions: {
              select: {
                id: true,
                userId: true,
                status: true,
                textAnswer: true,
                aiScore: true,
                submittedAt: true,
                reviewedAt: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        assignments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const canAccess =
      lesson.teacherId === session.user.id ||
      lesson.participants.some((item) => item.userId === session.user.id && item.accessGranted) ||
      session.user.role === "admin";

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const summary = parseSummary(lesson.summary);
    const transcript = parseTranscript(lesson.transcript);

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        subject: lesson.subject,
        topic: lesson.topic,
        classroomName: lesson.classroomName,
        aiStatus: lesson.aiStatus,
        aiError: lesson.aiError,
        createdAt: lesson.createdAt.toISOString(),
        startedAt: lesson.startedAt?.toISOString() ?? null,
        endedAt: lesson.endedAt?.toISOString() ?? null,
        durationSec: lesson.durationSec,
        notes: lesson.notes ?? "",
        summary,
        transcript,
        participants: lesson.participants.map((item) => ({
          id: item.id,
          userId: item.userId,
          role: item.role,
          state: item.state,
          name: item.user.name,
          email: item.user.email
        })),
        homeworks: lesson.homeworks.map((item) => ({
          id: item.id,
          title: item.title,
          subject: item.subject,
          topic: item.topic,
          difficulty: item.difficulty,
          dueDate: item.dueDate.toISOString(),
          generatedByAI: item.generatedByAI,
          submissions: item.submissions.map((submission) => ({
            ...submission,
            submittedAt: submission.submittedAt?.toISOString() ?? null,
            reviewedAt: submission.reviewedAt?.toISOString() ?? null
          }))
        })),
        assignments: lesson.assignments.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          difficulty: item.difficulty,
          status: item.status,
          reason: item.reason,
          createdAt: item.createdAt.toISOString()
        }))
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load lesson" }, { status: 400 });
  }
}
