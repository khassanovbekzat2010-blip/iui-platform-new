import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { canAccessStudent } from "@/lib/eeg/access";
import { createMockEEGHistory } from "@/lib/eeg/mock-stream";
import { eegHistoryQuerySchema } from "@/lib/eeg/schemas";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    const parsed = eegHistoryQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    const allowed = await canAccessStudent(session.user, parsed.studentId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const history = createMockEEGHistory(parsed.studentId, parsed.limit);

    return NextResponse.json({
      studentId: parsed.studentId,
      count: history.length,
      history: history.map((row) => ({
        ...row,
        timestamp: row.timestamp.toISOString()
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch EEG history" },
      { status: 400 }
    );
  }
}
