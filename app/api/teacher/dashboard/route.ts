import { NextResponse } from "next/server";

import { isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { getTeacherDashboardData } from "@/server/iui/dashboard.service";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    if (!isTeacherRole(session.user.role)) {
      return NextResponse.json({ error: "Only teachers/admin can access this endpoint" }, { status: 403 });
    }

    const dashboard = await getTeacherDashboardData(session.user.id);
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load teacher dashboard" },
      { status: 400 }
    );
  }
}

