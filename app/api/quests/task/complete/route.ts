import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { completeTask } from "@/server/journey/journey.service";
import { completeTaskSchema } from "@/server/validators/journey";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    const body = await request.json();
    const parsed = completeTaskSchema
      .omit({ userId: true })
      .parse({ taskId: body.taskId, answer: body.answer, timeSpentMs: body.timeSpentMs });

    const result = await completeTask({ ...parsed, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to complete task" }, { status: 400 });
  }
}

