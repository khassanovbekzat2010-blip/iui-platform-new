import { NextResponse } from "next/server";
import { RecommendationType } from "@prisma/client";

import { db } from "@/lib/db";
import { authenticateDeviceRequest } from "@/lib/eeg/device-auth";
import { calculateEngagementScore } from "@/lib/eeg/metrics";
import { eegRealtimeHub } from "@/lib/eeg/realtime-hub";
import { eegReadingPayloadSchema } from "@/lib/eeg/schemas";
import { grantFocusXp } from "@/server/iui/gamification.service";

function parseIncomingTimestamp(input?: number) {
  if (!input) return new Date();
  const ms = input > 10_000_000_000 ? input : input * 1000;
  return new Date(ms);
}

export async function POST(request: Request) {
  try {
    const payload = eegReadingPayloadSchema.parse(await request.json());
    const auth = await authenticateDeviceRequest({
      authorizationHeader: request.headers.get("authorization"),
      deviceId: payload.deviceId,
      studentId: payload.studentId
    });

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const studentId = payload.studentId ?? auth.device.studentId;
    const timestamp = parseIncomingTimestamp(payload.timestamp);
    const { engagementScore, state } = calculateEngagementScore({
      attention: payload.attention,
      meditation: payload.meditation,
      signal: payload.signal
    });

    const saved = await db.eEGReading.create({
      data: {
        studentId,
        lessonSessionId: payload.lessonSessionId ?? null,
        deviceId: payload.deviceId,
        attention: payload.attention,
        meditation: payload.meditation,
        signal: payload.signal,
        raw: payload.raw,
        engagementScore,
        state,
        timestamp
      }
    });

    await db.device.update({
      where: { id: payload.deviceId },
      data: { lastSeenAt: timestamp }
    });

    await db.deviceTelemetry.create({
      data: {
        studentId,
        deviceName: auth.device.id,
        deviceType: "EEG",
        connectionState: "ONLINE",
        focus: payload.attention,
        signal: payload.signal,
        payload: JSON.stringify({
          meditation: payload.meditation,
          raw: payload.raw,
          engagementScore,
          state
        }),
        recordedAt: timestamp
      }
    });

    if (payload.attention >= 75 && engagementScore >= 72) {
      await grantFocusXp({
        studentId,
        xp: 1,
        source: "EEG_FOCUS_STREAM",
        reason: "Sustained attention from live EEG stream"
      });
    }

    const recent = await db.eEGReading.findMany({
      where: { studentId },
      orderBy: { timestamp: "desc" },
      take: 5,
      select: { attention: true }
    });

    const lowAttentionStreak = recent.length >= 4 && recent.every((item) => item.attention < 40);
    if (lowAttentionStreak) {
      const recentRecommendation = await db.aIRecommendation.findFirst({
        where: {
          studentId,
          recommendationType: RecommendationType.BRAIN_BREAK,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000)
          }
        },
        select: { id: true }
      });

      if (!recentRecommendation) {
        await db.aIRecommendation.create({
          data: {
            studentId,
            lessonSessionId: payload.lessonSessionId ?? null,
            recommendationType: RecommendationType.BRAIN_BREAK,
            content: "Low attention streak detected. Trigger a 2-minute brain break and switch format.",
            payload: JSON.stringify({
              source: "live_eeg_guard",
              threshold: "<40 for 4+ readings"
            })
          }
        });
      }
    }

    eegRealtimeHub.publish({
      readingId: saved.id,
      studentId: saved.studentId,
      attention: saved.attention,
      meditation: saved.meditation,
      signal: saved.signal,
      raw: saved.raw,
      engagementScore: saved.engagementScore,
      state: saved.state,
      timestamp: saved.timestamp.toISOString(),
      lessonSessionId: saved.lessonSessionId,
      deviceId: saved.deviceId
    });

    return NextResponse.json({
      ok: true,
      reading: {
        id: saved.id,
        engagementScore: saved.engagementScore,
        state: saved.state,
        timestamp: saved.timestamp.toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ingest EEG reading" },
      { status: 400 }
    );
  }
}
