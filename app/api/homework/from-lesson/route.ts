import { NextResponse } from "next/server";
import { z } from "zod";
import { HomeworkSubmissionStatus } from "@prisma/client";

import { getTeacherStudentIds, isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureUserRows } from "@/lib/edu-service";

const schema = z.object({
  lessonId: z.string().optional(),
  titlePrefix: z.string().min(2).max(120).optional(),
  grade: z.number().int().min(1).max(11),
  subject: z.string().min(2),
  tasks: z.array(z.string().min(3)).min(1),
  studentIds: z.array(z.string()).default([])
});

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teachers can publish homework from lesson" }, { status: 403 });
    }

    const parsed = schema.parse(await request.json());
    const teacherStudentIds = await getTeacherStudentIds(user.id);
    const selectedStudentIds = Array.from(new Set(parsed.studentIds.filter((id) => teacherStudentIds.includes(id))));

    if (parsed.lessonId) {
      const lesson = await db.lesson.findUnique({
        where: { id: parsed.lessonId },
        select: { id: true, teacherId: true }
      });
      if (!lesson || lesson.teacherId !== user.id) {
        return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
      }
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const created: string[] = [];
    const targets = selectedStudentIds.length ? selectedStudentIds : [null];

    for (const [index, task] of parsed.tasks.entries()) {
      for (const studentId of targets) {
        if (studentId) {
          await ensureUserRows(studentId);
        }
        const hw = await db.homework.create({
          data: {
            createdBy: user.id,
            studentId,
            title: `${parsed.titlePrefix ?? "AI Lesson Homework"} #${index + 1}`,
            subject: parsed.subject,
            grade: parsed.grade,
            topic: "Generated from live lesson",
            description: task,
            content: task,
            generatedByAI: true,
            difficulty: "adaptive",
            dueDate,
            points: 10,
            lessonId: parsed.lessonId ?? null
          }
        });
        created.push(hw.id);

        if (studentId) {
          await db.homeworkSubmission.upsert({
            where: {
              homeworkId_userId: {
                homeworkId: hw.id,
                userId: studentId
              }
            },
            create: {
              homeworkId: hw.id,
              userId: studentId,
              status: HomeworkSubmissionStatus.NOT_STARTED
            },
            update: {}
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      ids: created,
      assignedStudents: selectedStudentIds
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
