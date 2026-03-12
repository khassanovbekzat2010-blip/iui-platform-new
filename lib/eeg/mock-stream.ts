import { type StudentCognitiveState, calculateEngagementScore } from "@/lib/eeg/metrics";

type MockReadingInput = {
  studentId: string;
  timestamp?: Date;
  lessonSessionId?: string | null;
};

export type MockEEGReading = {
  id: string;
  studentId: string;
  attention: number;
  meditation: number;
  signal: number;
  raw: number;
  engagementScore: number;
  state: StudentCognitiveState;
  timestamp: Date;
  lessonSessionId: string | null;
  deviceId: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function createMockEEGReading(input: MockReadingInput): MockEEGReading {
  const timestamp = input.timestamp ?? new Date();
  const seed = hashString(input.studentId);
  const time = timestamp.getTime() / 1000;

  const focusBase =
    72 +
    Math.sin(time / 17 + seed * 0.003) * 12 +
    Math.sin(time / 43 + seed * 0.0017) * 7;
  const calmBase =
    61 +
    Math.sin(time / 23 + seed * 0.0041) * 11 +
    Math.sin(time / 61 + seed * 0.0023) * 6;

  const dipWave = Math.sin(time / 83 + seed * 0.0009);
  const dipPenalty = dipWave > 0.92 ? Math.round((dipWave - 0.92) * 220) + 18 : 0;

  const attention = clamp(Math.round(focusBase - dipPenalty), 21, 96);
  const meditation = clamp(Math.round(calmBase - Math.round(dipPenalty * 0.35)), 24, 93);
  const signal = clamp(
    Math.round(15 + Math.abs(Math.sin(time / 11 + seed * 0.002)) * 10 + (dipPenalty > 0 ? 22 : 0)),
    3,
    92
  );
  const raw = clamp(
    Math.round(
      Math.sin(time * 2.8 + seed * 0.001) * 1700 +
        Math.sin(time * 0.7 + seed * 0.0019) * 900 +
        Math.sin(time * 7.2 + seed * 0.0004) * 260
    ),
    -32768,
    32767
  );

  const { engagementScore, state } = calculateEngagementScore({
    attention,
    meditation,
    signal
  });

  return {
    id: `mock-${input.studentId}-${Math.floor(timestamp.getTime() / 1000)}`,
    studentId: input.studentId,
    attention,
    meditation,
    signal,
    raw,
    engagementScore,
    state,
    timestamp,
    lessonSessionId: input.lessonSessionId ?? null,
    deviceId: `mock-device-${(seed % 4) + 1}`
  };
}

export function createMockEEGHistory(studentId: string, count: number, stepMs = 15_000) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) =>
    createMockEEGReading({
      studentId,
      timestamp: new Date(now - index * stepMs)
    })
  );
}

export function createMockEEGTimeline(studentIds: string[], samplesPerStudent: number, stepMs = 15_000) {
  return studentIds.flatMap((studentId) => createMockEEGHistory(studentId, samplesPerStudent, stepMs));
}

