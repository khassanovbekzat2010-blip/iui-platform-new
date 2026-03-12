import { LessonProcessingStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { buildLessonEegSummary } from "@/lib/lesson-eeg-summary";
import { processLessonAi } from "@/lib/lesson-ai";
import { TranscriptLine } from "@/lib/types";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can reprocess AI" }, { status: 403 });
    }

    const { id } = await context.params;
    const lesson = await db.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        notes: true,
        transcript: true,
        startedAt: true,
        endedAt: true,
        participants: {
          where: { role: "student" },
          select: { userId: true }
        }
      }
    });
    if (!lesson || lesson.teacherId !== user.id) {
      return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
    }

    let transcript: TranscriptLine[] = [];
    try {
      transcript = lesson.transcript ? (JSON.parse(lesson.transcript) as TranscriptLine[]) : [];
    } catch {
      transcript = [];
    }

    const eegSummary = await buildLessonEegSummary({
      studentIds: lesson.participants.map((item) => item.userId),
      startedAt: lesson.startedAt,
      endedAt: lesson.endedAt
    });

    await db.lesson.update({
      where: { id: lesson.id },
      data: {
        aiStatus: LessonProcessingStatus.PROCESSING,
        aiError: null
      }
    });

    const ai = await processLessonAi({
      transcript,
      notes: lesson.notes ?? "",
      dropMoments: eegSummary.dropMoments,
      engagementValues: eegSummary.engagementValues,
      eegSummary
    });

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
        aiError: null
      }
    });

    return NextResponse.json({
      ok: true,
      status: "READY",
      summary: ai.summary,
      keyTopics: ai.keyTopics,
      recommendations: ai.recommendations,
      generatedHomework: ai.homework.map((item) => item.title)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to reprocess lesson" }, { status: 500 });
  }
}
