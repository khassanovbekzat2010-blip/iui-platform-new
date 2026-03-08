import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db";
import { canAccessStudent, getStudentScopeForUser } from "@/lib/eeg/access";
import { eegRealtimeHub } from "@/lib/eeg/realtime-hub";

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

  const initialWhere = requestedStudentId
    ? { studentId: requestedStudentId }
    : effectiveScope
    ? { studentId: { in: Array.from(effectiveScope) } }
    : {};

  const initialRows = await db.eEGReading.findMany({
    where: initialWhere,
    orderBy: { timestamp: "desc" },
    take: 40,
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

  const latestPerStudent = new Map<string, (typeof initialRows)[number]>();
  for (const row of initialRows) {
    if (!latestPerStudent.has(row.studentId)) {
      latestPerStudent.set(row.studentId, row);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          sseChunk({
            event: "snapshot",
            data: Array.from(latestPerStudent.values()).map((row) => ({
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

      const unsubscribe = eegRealtimeHub.subscribe(effectiveScope, (event) => {
        controller.enqueue(
          encoder.encode(
            sseChunk({
              event: "eeg",
              data: event
            })
          )
        );
      });

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(sseChunk({ event: "ping", data: { ts: Date.now() } })));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
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

