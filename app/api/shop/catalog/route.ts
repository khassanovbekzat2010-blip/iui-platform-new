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

    const [items, hero, inventory] = await Promise.all([
      db.itemDefinition.findMany({ orderBy: [{ rarity: "asc" }, { priceCoins: "asc" }] }),
      db.hero.findUnique({ where: { userId } }),
      db.inventoryItem.findMany({
        where: { userId },
        include: { itemDefinition: true }
      })
    ]);

    return NextResponse.json({ items, hero, inventory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load shop catalog" }, { status: 500 });
  }
}

