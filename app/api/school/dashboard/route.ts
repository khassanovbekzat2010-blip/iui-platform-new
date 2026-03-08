import { NextResponse } from "next/server";

import { isTeacherRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { getSchoolAnalyticsData } from "@/server/iui/dashboard.service";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    if (!isTeacherRole(session.user.role)) {
      return NextResponse.json({ error: "Only teacher/admin can access school analytics" }, { status: 403 });
    }

    const analytics = await getSchoolAnalyticsData();
    return NextResponse.json(analytics);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load school analytics" },
      { status: 400 }
    );
  }
}

