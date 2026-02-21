import { HomeworkItem, TrendPoint } from "@/lib/types";

export interface GamificationState {
  xp: number;
  level: number;
  nextLevelXp: number;
  progressPercent: number;
  achievements: string[];
}

export function calculateGamification(trend: TrendPoint[], homework: HomeworkItem[]): GamificationState {
  const avgEngagement = trend.length ? trend.reduce((sum, item) => sum + item.value, 0) / trend.length : 70;
  const doneCount = homework.filter((item) => item.status === "done").length;
  const activeCount = homework.filter((item) => item.status !== "done").length;

  const xp = Math.round(avgEngagement * 4 + doneCount * 180 + activeCount * 60);
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  const nextLevelXp = level * 500;
  const currentLevelStart = (level - 1) * 500;
  const progressPercent = Math.min(100, Math.round(((xp - currentLevelStart) / (nextLevelXp - currentLevelStart)) * 100));

  const achievements: string[] = [];
  if (avgEngagement >= 85) achievements.push("Фокус-мастер");
  if (doneCount >= 2) achievements.push("Домашка закрыта");
  if (activeCount >= 1) achievements.push("В процессе роста");
  if (!achievements.length) achievements.push("Старт обучения");

  return { xp, level, nextLevelXp, progressPercent, achievements };
}
