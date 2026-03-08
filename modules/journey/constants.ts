export const HERO_ARCHETYPES = [
  { id: "Explorer", title: "Explorer", statBoost: { focus: 1, creativity: 2, logic: 1, discipline: 0 } },
  { id: "Scholar", title: "Scholar", statBoost: { focus: 2, creativity: 0, logic: 2, discipline: 1 } },
  { id: "Builder", title: "Builder", statBoost: { focus: 1, creativity: 1, logic: 1, discipline: 2 } }
] as const;

export const JOURNEY_STEP_TEMPLATES = [
  { code: "ordinary-world", title: "Ordinary World", isBoss: false },
  { code: "call-to-adventure", title: "Call to Adventure", isBoss: false },
  { code: "refusal", title: "Refusal", isBoss: false },
  { code: "meeting-mentor", title: "Meeting the Mentor", isBoss: false },
  { code: "crossing-threshold", title: "Crossing the Threshold", isBoss: false },
  { code: "tests-allies-enemies", title: "Tests, Allies, Enemies", isBoss: false },
  { code: "approach", title: "Approach", isBoss: false },
  { code: "ordeal", title: "Ordeal", isBoss: true },
  { code: "reward", title: "Reward", isBoss: false },
  { code: "road-back", title: "The Road Back", isBoss: false },
  { code: "resurrection", title: "Resurrection", isBoss: true },
  { code: "return-elixir", title: "Return with the Elixir", isBoss: false }
] as const;

export const ACHIEVEMENT_CODES = {
  STREAK_7: "streak_7",
  BOSS_SLAYER: "boss_slayer",
  PERFECT_SCORE: "perfect_score"
} as const;

export const SUSPICIOUS_TIME_MS = 1500;
