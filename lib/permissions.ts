import { AppRole } from "@/lib/types";

export function canAccessPath(role: AppRole, pathname: string, studentId?: string) {
  if (role === "teacher") {
    return true;
  }

  if (pathname.startsWith("/analytics")) {
    return false;
  }
  if (pathname === "/students") {
    return false;
  }
  if (pathname.startsWith("/students/")) {
    return pathname === `/students/${studentId}`;
  }

  return true;
}
