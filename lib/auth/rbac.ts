import { db } from "@/lib/db";
import { SessionUser } from "@/lib/auth/session";

export function isTeacherRole(role: SessionUser["role"]) {
  return role === "teacher" || role === "admin";
}

export function isStudentRole(role: SessionUser["role"]) {
  return role === "student";
}

export async function getTeacherStudentIds(teacherId: string) {
  const rows = await db.enrollment.findMany({
    where: {
      classroom: { teacherId },
      student: { role: "student" }
    },
    select: { studentId: true }
  });

  const linkedStudentIds = Array.from(new Set(rows.map((row) => row.studentId)));
  if (linkedStudentIds.length) {
    return linkedStudentIds;
  }

  // Local MVP fallback: if roster is not configured yet, expose existing student accounts
  // so the teacher can still bind a headset and run a live lesson end-to-end.
  const fallbackStudents = await db.user.findMany({
    where: {
      role: "student",
      id: { not: teacherId }
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return fallbackStudents.map((student) => student.id);
}

export async function teacherOwnsStudent(teacherId: string, studentId: string) {
  const studentIds = await getTeacherStudentIds(teacherId);
  return studentIds.includes(studentId);
}
