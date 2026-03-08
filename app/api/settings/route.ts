import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureUserRows } from "@/lib/edu-service";

export async function PATCH(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;
    const body = await request.json();

    await ensureUserRows(user.id);

    const dailyReminderEnabled = Boolean(body.notifications?.dailyReminderEnabled ?? true);
    const homeworkDeadlineReminderEnabled = Boolean(body.notifications?.homeworkDeadlineReminderEnabled ?? true);
    const showCharacter = Boolean(body.gamification?.showCharacter ?? true);
    const enableStreak = Boolean(body.gamification?.enableStreak ?? true);
    const resetProgress = Boolean(body.gamification?.resetProgress ?? false);

    const [settings, gamification] = await Promise.all([
      db.settings.update({
        where: { userId: user.id },
        data: {
          dailyReminderEnabled,
          homeworkDeadlineReminderEnabled
        }
      }),
      db.gamification.update({
        where: { userId: user.id },
        data: resetProgress
          ? {
              showCharacter,
              enableStreak,
              level: 1,
              xp: 0,
              streakDays: 0,
              coins: 0,
              lastActivityDate: null
            }
          : {
              showCharacter,
              enableStreak
            }
      })
    ]);

    return NextResponse.json({ ok: true, settings, gamification });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings", details: String(error) }, { status: 500 });
  }
}

