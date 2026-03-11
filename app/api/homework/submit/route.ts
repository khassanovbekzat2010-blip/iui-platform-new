import { HomeworkSubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { reviewHomeworkText } from "@/lib/ai/homework-text-review";
import { isStudentRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { addXp, ensureUserRows, refreshStreak } from "@/lib/edu-service";
import { completeMissionByTitle, grantHeroCoins } from "@/server/iui/gamification.service";

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isStudentRole(user.role)) {
      return NextResponse.json({ error: "Только ученик может отправлять домашнее задание" }, { status: 403 });
    }

    const body = await request.json();
    const homeworkId = String(body.homeworkId ?? "").trim();
    const textAnswer = String(body.textAnswer ?? "").trim();

    if (!homeworkId || !textAnswer) {
      return NextResponse.json({ error: "homeworkId и textAnswer обязательны" }, { status: 400 });
    }

    await ensureUserRows(user.id);

    const [homework, profile] = await Promise.all([
      db.homework.findUnique({ where: { id: homeworkId } }),
      db.profile.findUnique({ where: { userId: user.id }, select: { grade: true } })
    ]);

    if (!homework) {
      return NextResponse.json({ error: "Домашнее задание не найдено" }, { status: 404 });
    }
    if (homework.studentId && homework.studentId !== user.id) {
      return NextResponse.json({ error: "Это задание назначено другому ученику" }, { status: 403 });
    }
    if (!homework.studentId && profile?.grade && homework.grade !== profile.grade) {
      return NextResponse.json({ error: "Нет доступа к этому заданию" }, { status: 403 });
    }

    const aiReview = await reviewHomeworkText({
      homeworkTitle: homework.title,
      homeworkTopic: homework.topic,
      homeworkDescription: homework.description,
      studentAnswer: textAnswer
    });

    const previousSubmission = await db.homeworkSubmission.findUnique({
      where: {
        homeworkId_userId: {
          homeworkId,
          userId: user.id
        }
      },
      select: { status: true }
    });

    const feedbackText =
      aiReview.status === HomeworkSubmissionStatus.ACCEPTED
        ? `${aiReview.feedback} Начислено 20 XP и coins героя.`
        : `${aiReview.feedback} Ориентир правильного ответа: ${aiReview.idealAnswer}`;

    const submission = await db.homeworkSubmission.upsert({
      where: {
        homeworkId_userId: {
          homeworkId,
          userId: user.id
        }
      },
      create: {
        homeworkId,
        userId: user.id,
        textAnswer,
        status: aiReview.status,
        submittedAt: new Date(),
        aiScore: aiReview.score,
        aiReviewedAt: new Date(),
        reviewedAt: new Date(),
        feedback: feedbackText
      },
      update: {
        textAnswer,
        status: aiReview.status,
        submittedAt: new Date(),
        aiScore: aiReview.score,
        aiReviewedAt: new Date(),
        reviewedAt: new Date(),
        feedback: feedbackText
      }
    });

    if (aiReview.status === HomeworkSubmissionStatus.ACCEPTED && previousSubmission?.status !== HomeworkSubmissionStatus.ACCEPTED) {
      await addXp(user.id, 20);
      await refreshStreak(user.id);
      await grantHeroCoins({ studentId: user.id, coins: 12 });
      await completeMissionByTitle(user.id, "Homework");
    }

    const gamification = await db.gamification.findUnique({ where: { userId: user.id } });

    return NextResponse.json({
      ok: true,
      submission,
      gamification,
      review: {
        status: aiReview.status,
        score: aiReview.score,
        feedback: feedbackText
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Не удалось отправить домашнее задание", details: String(error) }, { status: 500 });
  }
}
