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
    const quest = await db.quest.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { orderIndex: "asc" } },
        questProgress: { where: { userId } }
      }
    });
    if (!quest) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    }

    const attempts = await db.attempt.findMany({
      where: {
        userId,
        questId: id
      }
    });
    const attemptMap = new Map<string, boolean>();
    for (const attempt of attempts) {
      if (attempt.isCorrect) attemptMap.set(attempt.taskId, true);
    }

    return NextResponse.json({
      ...quest,
      tasks: quest.tasks.map((task) => ({
        ...task,
        completed: attemptMap.get(task.id) ?? false,
        options: task.options ? (JSON.parse(task.options) as string[]) : null
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load quest" }, { status: 500 });
  }
}

