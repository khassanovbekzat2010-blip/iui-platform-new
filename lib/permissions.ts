import { AppRole } from "@/lib/types";

export function canAccessPath(role: AppRole, pathname: string, studentId?: string) {
  if (role === "admin") {
    return true;
  }

  if (role === "teacher") {
    if (pathname.startsWith("/homework")) return false;
    if (pathname.startsWith("/hero")) return false;
    if (pathname.startsWith("/shop")) return false;
    return true;
  }

  if (pathname.startsWith("/analytics")) {
    return false;
  }
  if (pathname.startsWith("/teacher")) {
    return false;
  }
  if (pathname === "/students") {
    return false;
  }
  if (pathname.startsWith("/students/")) {
    return false;
  }
  if (pathname.startsWith("/api/teacher")) {
    return false;
  }
  if (pathname.startsWith("/api/students")) {
    return false;
  }

  return true;
}
