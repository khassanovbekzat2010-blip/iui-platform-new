import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  name: z.string().min(2).max(80),
  role: z.enum(["student", "teacher"]).default("student")
});

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const parsed = schema.parse(await request.json());
    const email = parsed.email.toLowerCase();

    const existing = await db.user.findUnique({
      where: { email }
    });

    if (existing && existing.passwordHash.startsWith("$2")) {
      return NextResponse.json({ error: "Аккаунт с таким email уже существует" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.password);
    const role = parsed.role === "teacher" ? UserRole.teacher : UserRole.student;

    const user = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: {
            name: parsed.name,
            role,
            passwordHash
          }
        })
      : await db.user.create({
          data: {
            email,
            name: parsed.name,
            role,
            passwordHash
          }
        });

    if (role === UserRole.student) {
      await db.studentProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          grade: 9,
          subjects: JSON.stringify(["Математика"]),
          goals: "Улучшить результаты за неделю",
          isActive: true
        },
        update: {}
      });

      await db.hero.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          archetype: "Scholar",
          avatarUrl: "/avatars/avatar-01.svg",
          coins: 40
        },
        update: {}
      });
    }

    await db.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        role,
        grade: 9,
        subjects: JSON.stringify(["Математика"]),
        goal: "Учиться стабильно",
        language: "ru"
      },
      update: {
        role
      }
    });

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.role === UserRole.student ? user.id : undefined
    };

    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({ ok: true, user: sessionUser });
    response.cookies.set({
      ...sessionCookieOptions(),
      value: token
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать аккаунт" }, { status: 400 });
  }
}
