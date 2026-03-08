import { HomeworkSubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getTeacherStudentIds, isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureUserRows } from "@/lib/edu-service";

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    await ensureUserRows(user.id);

    if (isTeacherRole(user.role)) {
      const teacherStudentIds = await getTeacherStudentIds(user.id);
      const students = teacherStudentIds.length
        ? await db.user.findMany({
            where: { id: { in: teacherStudentIds } },
            select: { id: true, name: true, email: true }
          })
        : [];
      const studentMap = new Map(students.map((item) => [item.id, item]));
      const allHomework = await db.homework.findMany({
        where: { createdBy: user.id },
        include: {
          submissions: {
            where: { userId: { in: teacherStudentIds } },
            select: {
              id: true,
              userId: true,
              status: true,
              textAnswer: true,
              photoDataUrl: true,
              feedback: true,
              aiScore: true,
              submittedAt: true,
              reviewedAt: true,
              aiReviewedAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json({
        role: "teacher",
        homework: allHomework.map((item) => ({
          ...item,
          dueDate: item.dueDate.toISOString(),
          submissions: item.submissions.map((submission) => ({
            ...submission,
            studentName: studentMap.get(submission.userId)?.name ?? submission.userId,
            studentEmail: studentMap.get(submission.userId)?.email ?? "",
            submittedAt: submission.submittedAt?.toISOString() ?? null,
            reviewedAt: submission.reviewedAt?.toISOString() ?? null,
            aiReviewedAt: submission.aiReviewedAt?.toISOString() ?? null
          }))
        }))
      });
    }

    const [legacyProfile, studentProfile] = await Promise.all([
      db.profile.findUnique({ where: { userId: user.id }, select: { grade: true } }),
      db.studentProfile.findUnique({ where: { userId: user.id }, select: { grade: true } })
    ]);
    const grade = legacyProfile?.grade ?? studentProfile?.grade ?? null;
    if (!grade) {
      return NextResponse.json({ role: "student", homework: [], missingProfile: true });
    }

    const homework = await db.homework.findMany({
      where: {
        OR: [{ studentId: user.id }, { studentId: null, grade }]
      },
      select: {
        id: true,
        studentId: true,
        generatedByAI: true,
        difficulty: true,
        title: true,
        subject: true,
        grade: true,
        topic: true,
        description: true,
        dueDate: true,
        points: true
      },
      orderBy: { dueDate: "asc" }
    });

    const submissions = await db.homeworkSubmission.findMany({
      where: {
        userId: user.id,
        homeworkId: { in: homework.map((item) => item.id) }
      },
      select: {
        id: true,
        homeworkId: true,
        status: true,
        textAnswer: true,
        feedback: true,
        photoDataUrl: true,
        aiScore: true,
        submittedAt: true,
        reviewedAt: true,
        aiReviewedAt: true
      }
    });
    const submissionMap = new Map(submissions.map((item) => [item.homeworkId, item]));

    const merged = homework.map((item) => ({
      ...item,
      submission:
        submissionMap.get(item.id) ?? {
          status: HomeworkSubmissionStatus.NOT_STARTED,
          textAnswer: "",
          feedback: "",
          photoDataUrl: null,
          aiScore: null,
          submittedAt: null,
          reviewedAt: null,
          aiReviewedAt: null
        }
    }));

    return NextResponse.json({ role: "student", homework: merged });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list homework", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can create homework" }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const grade = Number(body.grade);
    const topic = String(body.topic ?? "").trim();
    const description = String(body.description ?? "").trim();
    const dueDateRaw = String(body.dueDate ?? "").trim();
    const points = Number(body.points ?? 10);

    if (!title || !subject || !topic || !description || !dueDateRaw) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
      return NextResponse.json({ error: "grade must be integer 1-11" }, { status: 400 });
    }
    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json({ error: "points must be > 0" }, { status: 400 });
    }

    const dueDate = new Date(dueDateRaw);
    if (Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const homework = await db.homework.create({
      data: {
        createdBy: user.id,
        title,
        subject,
        grade,
        topic,
        description,
        dueDate,
        points
      }
    });

    return NextResponse.json({ ok: true, homework });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create homework", details: String(error) }, { status: 500 });
  }
}
