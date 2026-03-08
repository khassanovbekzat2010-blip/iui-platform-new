import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureJourneyUser } from "@/server/journey/journey.service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;
    await ensureJourneyUser(userId);

    const { id } = await params;
    const boss = await db.bossBattle.findUnique({ where: { id } });
    if (!boss) {
      return NextResponse.json({ error: "Boss not found" }, { status: 404 });
    }
    const attempts = await db.bossAttempt.findMany({
      where: { bossId: id, userId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ boss, attempts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load boss" }, { status: 500 });
  }
}

