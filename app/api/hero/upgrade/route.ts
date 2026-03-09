import { NextResponse } from "next/server";
import { z } from "zod";

import { isStudentRole } from "@/lib/auth/rbac";
import { requireSession } from "@/lib/auth/require-session";
import { ensureDatabaseReady } from "@/lib/db-init";
import { upgradeHeroTrait } from "@/server/iui/gamification.service";

const schema = z.object({
  trait: z.enum(["focus", "logic", "creativity", "discipline"])
});

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    if (!isStudentRole(session.user.role)) {
      return NextResponse.json({ error: "Только ученик может улучшать героя" }, { status: 403 });
    }

    const parsed = schema.parse(await request.json());
    const hero = await upgradeHeroTrait({
      studentId: session.user.id,
      trait: parsed.trait,
      cost: 25,
      increment: 4
    });

    return NextResponse.json({ ok: true, hero });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось улучшить героя" }, { status: 400 });
  }
}
