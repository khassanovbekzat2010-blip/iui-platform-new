import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { ensureUserRows, tasksForToday } from "@/lib/edu-service";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    await ensureUserRows(userId);
    const tasks = (await tasksForToday(userId)).map((task) => ({
      ...task,
      options: task.options ? (JSON.parse(task.options) as string[]) : null
    }));

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const completions = await db.dailyCompletion.findMany({
      where: {
        userId,
        date
      }
    });

    return NextResponse.json({
      tasks,
      completedTaskIds: completions.map((item) => item.dailyTaskId),
      completedCount: completions.length
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch daily tasks", details: String(error) }, { status: 500 });
  }
}

