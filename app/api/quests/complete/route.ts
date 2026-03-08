import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { completeQuest } from "@/server/journey/journey.service";
import { completeQuestSchema } from "@/server/validators/journey";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    const body = await request.json();
    const parsed = completeQuestSchema.omit({ userId: true }).parse({ questId: body.questId });
    const result = await completeQuest({ ...parsed, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to complete quest" }, { status: 400 });
  }
}

