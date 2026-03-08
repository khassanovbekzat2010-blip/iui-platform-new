import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { attemptBoss } from "@/server/journey/journey.service";
import { bossAttemptSchema } from "@/server/validators/journey";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    const body = await request.json();
    const parsed = bossAttemptSchema
      .omit({ userId: true })
      .parse({ bossId: body.bossId, score: body.score, timeSpentMs: body.timeSpentMs });

    const result = await attemptBoss({ ...parsed, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to resolve boss attempt" }, { status: 400 });
  }
}

