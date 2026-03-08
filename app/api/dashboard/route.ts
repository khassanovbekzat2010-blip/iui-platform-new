import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { getDashboard } from "@/server/journey/journey.service";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const dashboard = await getDashboard(session.user.id);
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load dashboard" }, { status: 500 });
  }
}

