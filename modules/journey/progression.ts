import { ItemRarity } from "@prisma/client";

import { SUSPICIOUS_TIME_MS } from "./constants";

export type RewardInput = {
  baseXp: number;
  baseCoins: number;
  streak: number;
  suspicious: boolean;
  isBoss?: boolean;
};

export type RewardOutput = {
  xp: number;
  coins: number;
  gems: number;
  suspicious: boolean;
};

export function xpNeeded(level: number) {
  return 100 + (level - 1) * 25;
}

export function applyLevelProgress(currentLevel: number, currentXp: number, gainedXp: number) {
  let level = currentLevel;
  let xp = currentXp + gainedXp;
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
  }
  return { level, xp };
}

export function calculateReward(input: RewardInput): RewardOutput {
  const streakMultiplier = Math.min(1.5, 1 + input.streak * 0.03);
  const suspiciousPenalty = input.suspicious ? 0.5 : 1;
  const bossGems = input.isBoss ? 1 : 0;
  const xp = Math.max(1, Math.round(input.baseXp * streakMultiplier * suspiciousPenalty));
  const coins = Math.max(1, Math.round(input.baseCoins * streakMultiplier * suspiciousPenalty));
  return {
    xp,
    coins,
    gems: bossGems,
    suspicious: input.suspicious
  };
}

export function isSuspiciousAttempt(timeSpentMs: number) {
  return timeSpentMs > 0 && timeSpentMs < SUSPICIOUS_TIME_MS;
}

export function rollLoot(score: number): ItemRarity {
  const random = (score % 97) / 97;
  if (random > 0.9) return "epic";
  if (random > 0.65) return "rare";
  return "common";
}

export function shouldUnlockStreakAchievement(currentStreak: number) {
  return currentStreak >= 7;
}
