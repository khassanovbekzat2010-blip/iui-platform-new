import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { AVATAR_IDS } from "@/lib/learning-config";
import { ensureUserRows } from "@/lib/edu-service";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    const body = await request.json();
    const avatarId = String(body.avatarId ?? "").trim();
    if (!AVATAR_IDS.includes(avatarId)) {
      return NextResponse.json({ error: "Invalid avatar id" }, { status: 400 });
    }

    await ensureUserRows(userId);
    const gamification = await db.gamification.update({
      where: { userId },
      data: { avatarId }
    });

    return NextResponse.json({ ok: true, gamification });
  } catch (error) {
    return NextResponse.json({ error: "Failed to choose avatar", details: String(error) }, { status: 500 });
  }
}

