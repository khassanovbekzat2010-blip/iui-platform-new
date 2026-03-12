import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { canAccessStudent, getStudentScopeForUser } from "@/lib/eeg/access";
import { createMockEEGReading } from "@/lib/eeg/mock-stream";

export const dynamic = "force-dynamic";

function sseChunk(input: { event: string; data: unknown }) {
  return `event: ${input.event}\ndata: ${JSON.stringify(input.data)}\n\n`;
}

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const requestedStudentId = searchParams.get("studentId");

  if (requestedStudentId) {
    const allowed = await canAccessStudent(session.user, requestedStudentId);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  const scope = await getStudentScopeForUser(session.user);
  const effectiveScope = requestedStudentId ? new Set([requestedStudentId]) : scope;

  const studentIds = requestedStudentId
    ? [requestedStudentId]
    : effectiveScope
    ? Array.from(effectiveScope)
    : (
        await db.user.findMany({
          where: { role: "student" },
          select: { id: true }
        })
      ).map((row) => row.id);

  const initialRows = studentIds.map((studentId) => createMockEEGReading({ studentId }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          sseChunk({
            event: "snapshot",
            data: initialRows.map((row) => ({
              readingId: row.id,
              studentId: row.studentId,
              attention: row.attention,
              meditation: row.meditation,
              signal: row.signal,
              raw: row.raw,
              engagementScore: row.engagementScore,
              state: row.state,
              timestamp: row.timestamp.toISOString(),
              lessonSessionId: row.lessonSessionId,
              deviceId: row.deviceId
            }))
          })
        )
      );

      const eegTick = setInterval(() => {
        for (const studentId of studentIds) {
          const event = createMockEEGReading({ studentId });
          controller.enqueue(
            encoder.encode(
              sseChunk({
                event: "eeg",
                data: {
                  readingId: event.id,
                  studentId: event.studentId,
                  attention: event.attention,
                  meditation: event.meditation,
                  signal: event.signal,
                  raw: event.raw,
                  engagementScore: event.engagementScore,
                  state: event.state,
                  timestamp: event.timestamp.toISOString(),
                  lessonSessionId: event.lessonSessionId,
                  deviceId: event.deviceId
                }
              })
            )
          );
        }
      }, 1800);

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(sseChunk({ event: "ping", data: { ts: Date.now() } })));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(eegTick);
        clearInterval(ping);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
