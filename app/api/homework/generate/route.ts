import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { runPersonalization } from "@/lib/ai/personalization-engine";
import { canAccessStudent } from "@/lib/eeg/access";

const schema = z.object({
  studentId: z.string().min(2),
  subject: z.string().min(2),
  topic: z.string().min(2),
  grade: z.number().int().min(1).max(12).optional(),
  lessonId: z.string().optional(),
  lessonSessionId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;

    const parsed = schema.parse(await request.json());
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
      includeAssignment: false,
      includeHomework: true
    });

    return NextResponse.json({
      ok: true,
      homeworkId: result.generated.homeworkId,
      metrics: result.metrics,
      plan: result.plan.homework
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate personalized homework" },
      { status: 400 }
    );
  }
}
