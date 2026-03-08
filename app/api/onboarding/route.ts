import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { upsertOnboarding } from "@/server/journey/journey.service";
import { onboardingSchema } from "@/server/validators/journey";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    const body = await request.json();
    const parsed = onboardingSchema
      .omit({ userId: true })
      .parse({
        role: body.role,
        grade: body.grade,
        subjects: body.subjects,
        goal: body.goal,
        archetype: body.archetype
      });

    const result = await upsertOnboarding({
      ...parsed,
      userId: user.id,
      role: parsed.role
    });

    const updatedSessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: parsed.role,
      studentId: parsed.role === "student" ? user.id : undefined
    } as const;
    const token = await createSessionToken(updatedSessionUser);

    const response = NextResponse.json({ ok: true, ...result, user: updatedSessionUser });
    response.cookies.set({
      ...sessionCookieOptions(),
      value: token
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid onboarding payload" }, { status: 400 });
  }
}
