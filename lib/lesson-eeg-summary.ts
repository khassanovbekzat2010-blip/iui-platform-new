import { db } from "@/lib/db";
import { summarizeEEGHistory } from "@/lib/eeg/metrics";

type Input = {
  studentIds: string[];
  startedAt: Date | null;
  endedAt: Date | null;
};

export type LessonEegSummary = {
  avgAttention: number;
  avgMeditation: number;
  avgSignal: number;
  avgEngagement: number;
  sampleCount: number;
  dropMoments: string[];
  engagementValues: number[];
};

export async function buildLessonEegSummary(input: Input): Promise<LessonEegSummary> {
  if (!input.studentIds.length || !input.startedAt || !input.endedAt) {
    return {
      avgAttention: 0,
      avgMeditation: 0,
      avgSignal: 0,
      avgEngagement: 0,
      sampleCount: 0,
      dropMoments: [],
      engagementValues: []
    };
  }

  const rows = await db.eEGReading.findMany({
    where: {
      studentId: { in: input.studentIds },
      timestamp: {
        gte: input.startedAt,
        lte: input.endedAt
      }
    },
    select: {
      attention: true,
      meditation: true,
      signal: true,
      engagementScore: true,
      timestamp: true
    },
    orderBy: { timestamp: "asc" }
  });

  if (!rows.length) {
    return {
      avgAttention: 0,
      avgMeditation: 0,
      avgSignal: 0,
      avgEngagement: 0,
      sampleCount: 0,
      dropMoments: [],
      engagementValues: []
    };
  }

  const summary = summarizeEEGHistory(rows);
  const dropMoments = rows
    .filter((row) => row.attention < 40 || row.engagementScore < 45)
    .slice(0, 8)
    .map((row) => {
      const time = row.timestamp.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      });
      return `${time}: внимание ${row.attention}%, вовлеченность ${row.engagementScore}%`;
    });

  return {
    ...summary,
    sampleCount: rows.length,
    dropMoments,
    engagementValues: rows.map((row) => row.engagementScore)
  };
}
