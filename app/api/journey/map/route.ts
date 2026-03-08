import { ProgressStatus } from "@prisma/client";
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

    const acts = await db.act.findMany({
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
          include: {
            quests: true
          }
        }
      },
      orderBy: { orderIndex: "asc" }
    });
    const progress = await db.journeyStepProgress.findMany({ where: { userId } });
    const progressMap = new Map(progress.map((item) => [item.stepId, item.status]));

    return NextResponse.json({
      acts: acts.map((act) => ({
        ...act,
        steps: act.steps.map((step) => ({
          ...step,
          status: progressMap.get(step.id) ?? ProgressStatus.LOCKED
        }))
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load journey map" }, { status: 500 });
  }
}

