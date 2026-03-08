import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ensureUserRows } from "@/lib/edu-service";

function toUserRole(role: "teacher" | "student" | "admin"): UserRole {
  if (role === "teacher") return UserRole.teacher;
  if (role === "admin") return UserRole.admin;
  return UserRole.student;
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;

    await ensureUserRows(user.id, toUserRole(user.role));

    const [profile, gamification, settings] = await Promise.all([
      db.profile.findUnique({ where: { userId: user.id } }),
      db.gamification.findUnique({ where: { userId: user.id } }),
      db.settings.findUnique({ where: { userId: user.id } })
    ]);

    return NextResponse.json({
      profile: profile
        ? {
            ...profile,
            subjects: profile.subjects ? JSON.parse(profile.subjects) : []
          }
        : null,
      gamification,
      settings
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load profile", details: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureDatabaseReady();
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const user = session.user;
    const body = await request.json();

    const grade = Number(body.grade);
    const subjects = Array.isArray(body.subjects)
      ? body.subjects.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const goal = body.goal ? String(body.goal).trim() : null;
    const language = body.language ? String(body.language).trim().toLowerCase() : null;

    if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
      return NextResponse.json({ error: "grade must be integer 1-11" }, { status: 400 });
    }
    if (subjects.length === 0) {
      return NextResponse.json({ error: "Choose at least one subject" }, { status: 400 });
    }
    if (language && language !== "ru" && language !== "kz") {
      return NextResponse.json({ error: "language must be ru or kz" }, { status: 400 });
    }

    await ensureUserRows(user.id, toUserRole(user.role));

    const profile = await db.profile.update({
      where: { userId: user.id },
      data: {
        role: toUserRole(user.role),
        grade,
        subjects: JSON.stringify(subjects),
        goal,
        language
      }
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update profile", details: String(error) }, { status: 500 });
  }
}

