import { SessionUser } from "@/lib/auth/session-core";
import { getTeacherStudentIds, teacherOwnsStudent } from "@/lib/auth/rbac";

export async function getStudentScopeForUser(user: SessionUser): Promise<Set<string> | null> {
  if (user.role === "admin") {
    return null;
  }

  if (user.role === "student") {
    return new Set([user.id]);
  }

  const studentIds = await getTeacherStudentIds(user.id);
  return new Set(studentIds);
}

export async function canAccessStudent(user: SessionUser, studentId: string) {
  if (user.role === "admin") return true;
  if (user.role === "student") return user.id === studentId;
  return teacherOwnsStudent(user.id, studentId);
}

