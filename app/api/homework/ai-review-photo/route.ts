import { HomeworkSubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isStudentRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { reviewHomeworkFromPhoto } from "@/lib/ai/homework-photo-review";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { addXp, ensureUserRows, refreshStreak } from "@/lib/edu-service";
import { completeMissionByTitle, grantHeroCoins } from "@/server/iui/gamification.service";

const schema = z.object({
  homeworkId: z.string().min(2),
  imageDataUrl: z.string().min(20),
  note: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isStudentRole(user.role)) {
      return NextResponse.json({ error: "Only students can submit photo for AI review" }, { status: 403 });
    }

    const parsed = schema.parse(await request.json());
    await ensureUserRows(user.id);

    const [homework, profile] = await Promise.all([
      db.homework.findUnique({
        where: { id: parsed.homeworkId },
        select: {
          id: true,
          studentId: true,
          grade: true,
          title: true,
          topic: true,
          description: true
        }
      }),
      db.profile.findUnique({ where: { userId: user.id }, select: { grade: true } })
    ]);

    if (!homework) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }

    if (homework.studentId && homework.studentId !== user.id) {
      return NextResponse.json({ error: "This homework is assigned to another student" }, { status: 403 });
    }

    if (!homework.studentId && profile?.grade && homework.grade !== profile.grade) {
      return NextResponse.json({ error: "Access denied for this homework" }, { status: 403 });
    }

    const aiResult = await reviewHomeworkFromPhoto({
      homeworkTitle: homework.title,
      homeworkTopic: homework.topic,
      homeworkDescription: homework.description,
      imageDataUrl: parsed.imageDataUrl,
      studentNote: parsed.note
    });

    const previousSubmission = await db.homeworkSubmission.findUnique({
      where: {
        homeworkId_userId: {
          homeworkId: homework.id,
          userId: user.id
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    const submission = await db.homeworkSubmission.upsert({
      where: {
        homeworkId_userId: {
          homeworkId: homework.id,
          userId: user.id
        }
      },
      create: {
        homeworkId: homework.id,
        userId: user.id,
        textAnswer: `[PHOTO_SUBMISSION]\n${parsed.note ?? ""}`,
        photoDataUrl: parsed.imageDataUrl,
        status: aiResult.status,
        aiScore: aiResult.score,
        aiReviewedAt: new Date(),
        submittedAt: new Date(),
        reviewedAt: aiResult.status === HomeworkSubmissionStatus.ACCEPTED || aiResult.status === HomeworkSubmissionStatus.NEEDS_REVISION ? new Date() : null,
        feedback: `AI Score: ${aiResult.score}/100. ${aiResult.feedback}`
      },
      update: {
        textAnswer: `[PHOTO_SUBMISSION]\n${parsed.note ?? ""}`,
        photoDataUrl: parsed.imageDataUrl,
        status: aiResult.status,
        aiScore: aiResult.score,
        aiReviewedAt: new Date(),
        submittedAt: new Date(),
        reviewedAt: aiResult.status === HomeworkSubmissionStatus.ACCEPTED || aiResult.status === HomeworkSubmissionStatus.NEEDS_REVISION ? new Date() : null,
        feedback: `AI Score: ${aiResult.score}/100. ${aiResult.feedback}`
      }
    });

    if (aiResult.status === HomeworkSubmissionStatus.ACCEPTED && previousSubmission?.status !== HomeworkSubmissionStatus.ACCEPTED) {
      await addXp(user.id, 25);
      await refreshStreak(user.id);
      await grantHeroCoins({ studentId: user.id, coins: 14 });
      await completeMissionByTitle(user.id, "Homework");
    }

    return NextResponse.json({
      ok: true,
      result: {
        status: aiResult.status,
        score: aiResult.score,
        feedback: aiResult.feedback
      },
      submission
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run AI photo review" },
      { status: 400 }
    );
  }
}
