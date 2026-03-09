import { HomeworkSubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getTeacherStudentIds, isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { addXp, refreshStreak } from "@/lib/edu-service";
import { completeMissionByTitle, grantHeroCoins } from "@/server/iui/gamification.service";

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can review submissions" }, { status: 403 });
    }

    const body = await request.json();
    const submissionId = String(body.submissionId ?? "").trim();
    const status = String(body.status ?? "").trim().toUpperCase();
    const feedback = String(body.feedback ?? "").trim();

    if (!submissionId || !status) {
      return NextResponse.json({ error: "submissionId and status are required" }, { status: 400 });
    }
    if (status !== HomeworkSubmissionStatus.ACCEPTED && status !== HomeworkSubmissionStatus.NEEDS_REVISION) {
      return NextResponse.json({ error: "status must be ACCEPTED or NEEDS_REVISION" }, { status: 400 });
    }

    const submission = await db.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: { homework: true }
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.homework.createdBy !== user.id) {
      return NextResponse.json({ error: "Access denied for this submission" }, { status: 403 });
    }

    const teacherStudentIds = await getTeacherStudentIds(user.id);
    if (!teacherStudentIds.includes(submission.userId)) {
      return NextResponse.json({ error: "This student is not assigned to your classroom" }, { status: 403 });
    }

    const updated = await db.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        feedback,
        reviewedAt: new Date()
      }
    });

    if (status === HomeworkSubmissionStatus.ACCEPTED && submission.status !== HomeworkSubmissionStatus.ACCEPTED) {
      await addXp(submission.userId, Math.max(15, submission.homework.points));
      await refreshStreak(submission.userId);
      await grantHeroCoins({ studentId: submission.userId, coins: 10 });
      await completeMissionByTitle(submission.userId, "Homework");
    }

    return NextResponse.json({ ok: true, submission: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to review submission", details: String(error) }, { status: 500 });
  }
}
