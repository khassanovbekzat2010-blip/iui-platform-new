import { z } from "zod";

export const onboardingSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["student", "teacher", "admin"]).default("student"),
  grade: z.number().int().min(1).max(11),
  subjects: z.array(z.string().min(1)).min(1),
  goal: z.string().min(2),
  archetype: z.enum(["Explorer", "Scholar", "Builder"])
});

export const completeTaskSchema = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1),
  answer: z.string().min(1),
  timeSpentMs: z.number().int().min(1)
});

export const completeQuestSchema = z.object({
  userId: z.string().min(1),
  questId: z.string().min(1)
});

export const bossAttemptSchema = z.object({
  userId: z.string().min(1),
  bossId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  timeSpentMs: z.number().int().min(1)
});

export const shopPurchaseSchema = z.object({
  userId: z.string().min(1),
  itemSlug: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1)
});
