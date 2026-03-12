import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { canAccessStudent } from "@/lib/eeg/access";
import { createMockEEGReading } from "@/lib/eeg/mock-stream";

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

    const reading = createMockEEGReading({ studentId: parsed.studentId });

    return NextResponse.json({
      reading: {
        ...reading,
        timestamp: reading.timestamp.toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch latest EEG reading" },
      { status: 400 }
    );
  }
}
