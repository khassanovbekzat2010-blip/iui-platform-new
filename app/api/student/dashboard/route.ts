import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { getTeacherStudentIds } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { canAccessStudent } from "@/lib/eeg/access";
import { getStudentDashboardData } from "@/server/iui/dashboard.service";

const querySchema = z.object({
  studentId: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    const parsed = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    let targetStudentId = parsed.studentId ?? session.user.id;
    if (!parsed.studentId && session.user.role === "teacher") {
      const ids = await getTeacherStudentIds(session.user.id);
      if (!ids.length) {
        return NextResponse.json({ error: "No students linked to this teacher" }, { status: 404 });
      }
      targetStudentId = ids[0];
    }

    if (!parsed.studentId && session.user.role === "admin") {
      const student = await db.user.findFirst({
        where: { role: UserRole.student },
        select: { id: true }
      });
      if (!student) {
        return NextResponse.json({ error: "No students found" }, { status: 404 });
      }
      targetStudentId = student.id;
    }

    const allowed = await canAccessStudent(session.user, targetStudentId);
    if (!allowed && session.user.role !== "teacher" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dashboard = await getStudentDashboardData(targetStudentId);
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load student dashboard" },
      { status: 400 }
    );
  }
}
