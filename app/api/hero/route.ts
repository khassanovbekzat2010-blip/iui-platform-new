import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureJourneyUser } from "@/server/journey/journey.service";

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;
    await ensureJourneyUser(userId);

    const [hero, inventory, achievements] = await Promise.all([
      db.hero.findUnique({ where: { userId } }),
      db.inventoryItem.findMany({
        where: { userId },
        include: { itemDefinition: true }
      }),
      db.userAchievement.findMany({
        where: { userId },
        include: { achievementDefinition: true },
        orderBy: { unlockedAt: "desc" }
      })
    ]);

    return NextResponse.json({ hero, inventory, achievements });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load hero profile" }, { status: 500 });
  }
}

