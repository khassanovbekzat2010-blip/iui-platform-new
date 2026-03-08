import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { consumeRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  mode: z.enum(["register", "login"]).default("login"),
  role: z.enum(["student", "teacher"]).default("student"),
  name: z.string().min(2).max(80).optional()
});

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtpCode(email: string, code: string) {
  const secret = process.env.AUTH_OTP_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-otp-secret";
  return createHash("sha256").update(`${email.toLowerCase()}:${code}:${secret}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const parsed = schema.parse(await request.json());
    const email = parsed.email.toLowerCase();
    const requestedRole = parsed.role === "teacher" ? UserRole.teacher : UserRole.student;

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true, role: true }
    });
    const otpRole = existingUser?.role ?? requestedRole;
    const isDevelopment = process.env.NODE_ENV !== "production";
    const allowDevOtpFallback = isDevelopment && (process.env.DEV_OTP_FALLBACK ?? "true") === "true";

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipRate = consumeRateLimit(`otp-send-ip:${ip}`, { windowMs: 15 * 60 * 1000, limit: 20 });
    if (!ipRate.ok) {
      return NextResponse.json({ error: "Too many requests from this IP. Try again later." }, { status: 429 });
    }

    const emailRate = consumeRateLimit(`otp-send-email:${email}`, { windowMs: 15 * 60 * 1000, limit: 5 });
    if (!emailRate.ok) {
      return NextResponse.json({ error: "Too many codes requested for this email. Try again in 15 minutes." }, { status: 429 });
    }

    const recentCodes = await db.emailOtpCode.count({
      where: {
        email,
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) }
      }
    });
    if (recentCodes >= 5) {
      return NextResponse.json({ error: "Rate limit reached for this email. Try again later." }, { status: 429 });
    }

    const code = generateCode();
    const codeHash = hashOtpCode(email, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.emailOtpCode.updateMany({
      where: { email, consumed: false },
      data: { consumed: true }
    });

    await db.emailOtpCode.create({
      data: {
        email,
        code: codeHash,
        role: otpRole,
        name: parsed.name,
        expiresAt
      }
    });

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM ?? smtpUser;

    const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom);
    if (hasSmtp) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: parsed.email,
        subject: "IUI verification code",
        text: `Your IUI verification code is: ${code}. It expires in 10 minutes.`
      });

      return NextResponse.json({
        ok: true,
        message: "Verification code sent.",
        accountExists: Boolean(existingUser),
        effectiveRole: otpRole
      });
    }

    if (allowDevOtpFallback) {
      console.warn(`[DEV OTP FALLBACK] ${email}: ${code}`);
      return NextResponse.json({
        ok: true,
        message: "SMTP is not configured. Development fallback code generated.",
        devCode: code,
        accountExists: Boolean(existingUser),
        effectiveRole: otpRole
      });
    }

    return NextResponse.json(
      { error: "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM." },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
