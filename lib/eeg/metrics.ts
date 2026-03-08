export type StudentCognitiveState = "FOCUSED" | "ENGAGED" | "DISTRACTED" | "FATIGUED";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Combines attention/meditation with EEG signal quality into a stable 0..100 engagement score.
 * TGAM signal quality is better when value is smaller, so we invert it into a bonus factor.
 */
export function calculateEngagementScore(input: {
  attention: number;
  meditation: number;
  signal: number;
}) {
  const attention = clamp(input.attention, 0, 100);
  const meditation = clamp(input.meditation, 0, 100);
  const normalizedSignal = clamp(100 - input.signal, 0, 100);
  const engagementScore = Math.round(attention * 0.62 + meditation * 0.26 + normalizedSignal * 0.12);

  let state: StudentCognitiveState = "ENGAGED";
  if (engagementScore >= 76 && attention >= 70) {
    state = "FOCUSED";
  } else if (engagementScore < 38) {
    state = "FATIGUED";
  } else if (engagementScore < 55 || attention < 45) {
    state = "DISTRACTED";
  }

  return { engagementScore, state };
}

export function summarizeEEGHistory(
  readings: Array<{
    attention: number;
    meditation: number;
    signal: number;
    engagementScore: number;
  }>
) {
  if (!readings.length) {
    return {
      avgAttention: 0,
      avgMeditation: 0,
      avgSignal: 0,
      avgEngagement: 0
    };
  }

  const totals = readings.reduce(
    (acc, item) => ({
      attention: acc.attention + item.attention,
      meditation: acc.meditation + item.meditation,
      signal: acc.signal + item.signal,
      engagementScore: acc.engagementScore + item.engagementScore
    }),
    { attention: 0, meditation: 0, signal: 0, engagementScore: 0 }
  );

  return {
    avgAttention: Math.round(totals.attention / readings.length),
    avgMeditation: Math.round(totals.meditation / readings.length),
    avgSignal: Math.round(totals.signal / readings.length),
    avgEngagement: Math.round(totals.engagementScore / readings.length)
  };
}

