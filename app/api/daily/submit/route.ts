import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { submitDailyAnswer } from "@/lib/edu-service";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    const body = await request.json();
    const taskId = String(body.taskId ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }
    if (!answer) {
      return NextResponse.json({ error: "Answer cannot be empty" }, { status: 400 });
    }

    const result = await submitDailyAnswer({ userId, taskId, answer });
    const gamification = await db.gamification.findUnique({ where: { userId } });
    return NextResponse.json({ ok: true, ...result, gamification });
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit answer", details: String(error) }, { status: 500 });
  }
}

