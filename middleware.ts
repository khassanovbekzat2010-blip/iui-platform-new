import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session-core";

const publicPaths = new Set([
  "/login",
  "/api/auth/email/send-code",
  "/api/auth/email/verify-code",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/eeg"
]);

const teacherOnlyPrefixes = ["/teacher", "/students", "/analytics", "/api/teacher", "/api/students"];
const studentOnlyPrefixes = ["/homework"];

function hasPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const user = await verifySessionToken(token);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isTeacher = user.role === "teacher" || user.role === "admin";
  const isStudent = user.role === "student";

  if (!isTeacher && hasPrefix(pathname, teacherOnlyPrefixes)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isStudent && hasPrefix(pathname, studentOnlyPrefixes)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isTeacher && (pathname === "/hero" || pathname === "/shop")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
