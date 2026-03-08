import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

const createStudentSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  grade: z.number().int().min(1).max(11),
  classroomName: z.string().min(2).max(120),
  subjects: z.array(z.string().min(2)).min(1).default(["Math"]),
  goals: z.string().min(2).max(280).default("Start learning")
});

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;
    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can access students" }, { status: 403 });
    }

    const enrollments = await db.enrollment.findMany({
      where: { classroom: { teacherId: user.id } },
      select: {
        classroom: {
          select: {
            id: true,
            name: true,
            grade: true
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
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
                xp: true
              }
            },
            attempts: {
              orderBy: { createdAt: "desc" },
              take: 30,
              select: {
                isCorrect: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const studentIds = Array.from(new Set(enrollments.map((item) => item.student.id)));
    const telemetryRows = await db.deviceTelemetry.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { recordedAt: "desc" },
      select: {
        studentId: true,
        deviceName: true,
        deviceType: true,
        connectionState: true,
        focus: true,
        signal: true,
        recordedAt: true
      }
    });

    const latestTelemetry = new Map<string, (typeof telemetryRows)[number]>();
    for (const row of telemetryRows) {
      if (!latestTelemetry.has(row.studentId)) {
        latestTelemetry.set(row.studentId, row);
      }
    }

    const rows = enrollments.map((item) => {
      const attempts = item.student.attempts;
      const correct = attempts.filter((attempt) => attempt.isCorrect).length;
      const performance = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
      const telemetry = latestTelemetry.get(item.student.id);
      const engagement = telemetry?.focus ?? Math.max(45, Math.min(100, performance + 10));

      return {
        id: item.student.id,
        name: item.student.name,
        email: item.student.email,
        grade: item.student.studentProfile?.grade ?? item.classroom.grade,
        classroomName: item.classroom.name,
        isActive: item.student.studentProfile?.isActive ?? true,
        performance,
        engagement,
        heroLevel: item.student.hero?.level ?? 1,
        device: telemetry
          ? {
              name: telemetry.deviceName,
              type: telemetry.deviceType,
              state: telemetry.connectionState,
              signal: telemetry.signal,
              focus: telemetry.focus,
              recordedAt: telemetry.recordedAt
            }
          : null
      };
    });

    return NextResponse.json({ students: rows });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load students", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;
    if (!isTeacherRole(user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can create students" }, { status: 403 });
    }

    const parsed = createStudentSchema.parse(await request.json());
    const email = parsed.email.toLowerCase();

    const student = await db.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: "otp",
        name: parsed.name,
        role: UserRole.student
      },
      update: {
        name: parsed.name,
        role: UserRole.student
      }
    });

    await db.studentProfile.upsert({
      where: { userId: student.id },
      create: {
        userId: student.id,
        grade: parsed.grade,
        subjects: JSON.stringify(parsed.subjects),
        goals: parsed.goals,
        isActive: true
      },
      update: {
        grade: parsed.grade,
        subjects: JSON.stringify(parsed.subjects),
        goals: parsed.goals,
        isActive: true
      }
    });

    const existingClassroom = await db.classroom.findFirst({
      where: {
        teacherId: user.id,
        name: parsed.classroomName,
        grade: parsed.grade
      },
      select: { id: true }
    });

    const classroom =
      existingClassroom ??
      (await db.classroom.create({
        data: {
          teacherId: user.id,
          name: parsed.classroomName,
          grade: parsed.grade
        },
        select: { id: true }
      }));

    await db.enrollment.upsert({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId: student.id
        }
      },
      create: {
        classroomId: classroom.id,
        studentId: student.id
      },
      update: {}
    });

    return NextResponse.json({ ok: true, studentId: student.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create student" }, { status: 400 });
  }
}

