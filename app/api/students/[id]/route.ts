import { NextResponse } from "next/server";
import { z } from "zod";

import { isTeacherRole, teacherOwnsStudent } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

const updateStudentSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  grade: z.number().int().min(1).max(11).optional(),
  subjects: z.array(z.string().min(2)).min(1).optional(),
  goals: z.string().min(2).max(280).optional(),
  isActive: z.boolean().optional()
});

async function assertStudentAccess(user: { id: string; role: "teacher" | "student" | "admin" }, studentId: string) {
  if (user.role === "student") {
    return user.id === studentId;
  }
  if (isTeacherRole(user.role)) {
    return teacherOwnsStudent(user.id, studentId);
  }
  return false;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;
    const { id } = await context.params;

    const hasAccess = await assertStudentAccess(user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const student = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        studentProfile: {
          select: {
            grade: true,
            subjects: true,
            goals: true,
            isActive: true
          }
        },
        hero: {
          select: {
            level: true,
            xp: true,
            coins: true
          }
        },
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            isCorrect: true,
            createdAt: true,
            task: {
              select: {
                topic: true,
                difficulty: true
              }
            }
          }
        },
        questProgress: {
          select: {
            status: true,
            quest: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const [deviceHistory, homeworkSubmissions, lessonParticipation] = await Promise.all([
      db.deviceTelemetry.findMany({
        where: { studentId: id },
        orderBy: { recordedAt: "desc" },
        take: 60,
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          connectionState: true,
          focus: true,
          signal: true,
          payload: true,
          recordedAt: true
        }
      }),
      db.homeworkSubmission.findMany({
        where: { userId: id },
        orderBy: { updatedAt: "desc" },
        include: {
          homework: {
            select: {
              id: true,
              title: true,
              subject: true,
              dueDate: true,
              lessonId: true
            }
          }
        },
        take: 80
      }),
      db.lessonParticipant.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              subject: true,
              createdAt: true,
              aiStatus: true,
              summary: true
            }
          }
        },
        take: 40
      })
    ]);

    const attempts = student.attempts;
    const correct = attempts.filter((item) => item.isCorrect).length;
    const performance = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.studentProfile?.grade ?? null,
        subjects: student.studentProfile?.subjects ? JSON.parse(student.studentProfile.subjects) : [],
        goals: student.studentProfile?.goals ?? "",
        isActive: student.studentProfile?.isActive ?? true,
        hero: student.hero,
        performance,
        completedQuests: student.questProgress.filter((item) => item.status === "COMPLETED").length,
        totalQuests: student.questProgress.length,
        weakTopics: Array.from(
          new Set(attempts.filter((item) => !item.isCorrect).map((item) => item.task.topic).filter(Boolean))
        ).slice(0, 8)
      },
      deviceHistory,
      homework: homeworkSubmissions.map((item) => ({
        id: item.id,
        status: item.status,
        feedback: item.feedback,
        submittedAt: item.submittedAt,
        homework: item.homework
      })),
      archive: lessonParticipation.map((item) => ({
        id: item.lesson.id,
        title: item.lesson.title,
        subject: item.lesson.subject,
        date: item.lesson.createdAt,
        status: item.lesson.aiStatus,
        summary: item.lesson.summary
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load student", details: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;
    const { id } = await context.params;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can update students" }, { status: 403 });
    }

    const ownsStudent = await teacherOwnsStudent(user.id, id);
    if (!ownsStudent) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const parsed = updateStudentSchema.parse(await request.json());

    if (parsed.name) {
      await db.user.update({
        where: { id },
        data: { name: parsed.name }
      });
    }

    if (parsed.grade || parsed.subjects || parsed.goals || typeof parsed.isActive === "boolean") {
      await db.studentProfile.update({
        where: { userId: id },
        data: {
          grade: parsed.grade,
          subjects: parsed.subjects ? JSON.stringify(parsed.subjects) : undefined,
          goals: parsed.goals,
          isActive: parsed.isActive
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update student" }, { status: 400 });
  }
}

