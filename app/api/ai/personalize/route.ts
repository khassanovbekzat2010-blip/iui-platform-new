import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { runPersonalization } from "@/lib/ai/personalization-engine";
import { canAccessStudent } from "@/lib/eeg/access";
import { aiPersonalizeSchema } from "@/lib/eeg/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    const parsed = aiPersonalizeSchema.parse(await request.json());
    const allowed = await canAccessStudent(session.user, parsed.studentId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runPersonalization({
      studentId: parsed.studentId,
      subject: parsed.subject,
      topic: parsed.topic,
      grade: parsed.grade,
      teacherId: session.user.role === "teacher" || session.user.role === "admin" ? session.user.id : undefined,
      lessonId: parsed.lessonId,
      lessonSessionId: parsed.lessonSessionId,
      includeAssignment: parsed.includeAssignment,
      includeHomework: parsed.includeHomework
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to personalize learning path" },
      { status: 400 }
    );
  }
}
