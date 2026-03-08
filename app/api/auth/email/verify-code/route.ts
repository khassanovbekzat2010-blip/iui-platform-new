import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  mode: z.enum(["register", "login"]).default("login"),
  name: z.string().min(2).max(80).optional()
});

function hashOtpCode(email: string, code: string) {
  const secret = process.env.AUTH_OTP_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-otp-secret";
  return createHash("sha256").update(`${email.toLowerCase()}:${code}:${secret}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const parsed = schema.parse(await request.json());
    const email = parsed.email.toLowerCase();

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const verifyRate = consumeRateLimit(`otp-verify:${email}:${ip}`, { windowMs: 15 * 60 * 1000, limit: 10 });
    if (!verifyRate.ok) {
      return NextResponse.json({ error: "Too many verification attempts. Please try later." }, { status: 429 });
    }

    const now = new Date();
    const otp = await db.emailOtpCode.findFirst({
      where: {
        email,
        consumed: false,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!otp) {
      return NextResponse.json({ error: "Verification code is invalid or expired." }, { status: 400 });
    }

    const expectedHash = hashOtpCode(email, parsed.code);
    if (otp.code !== expectedHash) {
      return NextResponse.json({ error: "Verification code is invalid or expired." }, { status: 400 });
    }

    await db.emailOtpCode.update({
      where: { id: otp.id },
      data: { consumed: true }
    });

    let user = await db.user.findUnique({ where: { email } });

    if (!user && parsed.mode === "login") {
      return NextResponse.json({ error: "Account not found. Please register first." }, { status: 404 });
    }

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          passwordHash: "otp",
          name: parsed.name ?? otp.name ?? email.split("@")[0],
          role: otp.role ?? UserRole.student
        }
      });
    }

    if (user.role === UserRole.student) {
      await db.studentProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          grade: 9,
          subjects: JSON.stringify(["Math"]),
          goals: "Start learning",
          isActive: true
        },
        update: {}
      });
      await db.hero.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          archetype: "Scholar",
          avatarUrl: "/avatars/avatar-01.svg"
        },
        update: {}
      });
      await db.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          role: UserRole.student,
          grade: 9,
          subjects: JSON.stringify(["Math", "Physics"]),
          goal: "Start learning",
          language: "ru"
        },
        update: {}
      });
    }

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
