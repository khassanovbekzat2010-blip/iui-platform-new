import { NextResponse } from "next/server";

import { isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can access overview" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    const classrooms = await db.classroom.findMany({
      where: { teacherId: user.id, ...(classId ? { id: classId } : {}) },
      include: {
        enrollments: {
          include: {
            student: {
              include: {
                hero: true,
                questProgress: true,
                attempts: {
                  orderBy: { createdAt: "desc" },
                  take: 20
                }
              }
            }
          }
        }
      }
    });

    const blockedStudents = classrooms
      .flatMap((c) => c.enrollments.map((e) => e.student))
      .filter((student) => student.attempts.filter((a) => !a.isCorrect).length >= 5)
      .map((student) => ({
        id: student.id,
        name: student.name,
        incorrectAttempts: student.attempts.filter((a) => !a.isCorrect).length,
        level: student.hero?.level ?? 1
      }));

    return NextResponse.json({ classrooms, blockedStudents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load teacher overview" }, { status: 500 });
  }
}

