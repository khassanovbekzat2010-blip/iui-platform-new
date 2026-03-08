import { HomeworkSubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isStudentRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { ensureUserRows } from "@/lib/edu-service";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isStudentRole(user.role)) {
      return NextResponse.json({ error: "Only students can submit homework" }, { status: 403 });
    }

    const body = await request.json();
    const homeworkId = String(body.homeworkId ?? "").trim();
    const textAnswer = String(body.textAnswer ?? "").trim();

    if (!homeworkId || !textAnswer) {
      return NextResponse.json({ error: "homeworkId and textAnswer are required" }, { status: 400 });
    }

    await ensureUserRows(user.id);

    const [homework, profile] = await Promise.all([
      db.homework.findUnique({ where: { id: homeworkId } }),
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
        status: HomeworkSubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
        aiScore: null,
        aiReviewedAt: null
      },
      update: {
        textAnswer,
        status: HomeworkSubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
        aiScore: null,
        aiReviewedAt: null
      }
    });

    const gamification = await db.gamification.findUnique({ where: { userId: user.id } });

    return NextResponse.json({ ok: true, submission, gamification });
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit homework", details: String(error) }, { status: 500 });
  }
}
