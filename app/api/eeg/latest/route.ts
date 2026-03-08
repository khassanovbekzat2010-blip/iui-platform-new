import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { canAccessStudent } from "@/lib/eeg/access";

const querySchema = z.object({
  studentId: z.string().min(2)
});

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    const parsed = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    const allowed = await canAccessStudent(session.user, parsed.studentId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reading = await db.eEGReading.findFirst({
      where: { studentId: parsed.studentId },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        studentId: true,
        attention: true,
        meditation: true,
        signal: true,
        raw: true,
        engagementScore: true,
        state: true,
        timestamp: true,
        lessonSessionId: true,
        deviceId: true
      }
    });

    return NextResponse.json({
      reading: reading
        ? {
            ...reading,
            timestamp: reading.timestamp.toISOString()
          }
        : null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch latest EEG reading" },
      { status: 400 }
    );
  }
}

