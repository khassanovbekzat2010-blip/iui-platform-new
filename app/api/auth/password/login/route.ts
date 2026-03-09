import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72)
});

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const parsed = schema.parse(await request.json());
    const email = parsed.email.toLowerCase();

    const user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    }

    const valid = await verifyPassword(parsed.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.role === "student" ? user.id : undefined
    };

    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({ ok: true, user: sessionUser });
    response.cookies.set({
      ...sessionCookieOptions(),
      value: token
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось войти" }, { status: 400 });
  }
}
