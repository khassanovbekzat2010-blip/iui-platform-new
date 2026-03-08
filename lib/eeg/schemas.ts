import { z } from "zod";

export const eegReadingPayloadSchema = z.object({
  studentId: z.string().min(2).max(120).optional(),
  attention: z.number().int().min(0).max(100),
  meditation: z.number().int().min(0).max(100),
  signal: z.number().int().min(0).max(200),
  raw: z.number().int().min(-32768).max(32767),
  deviceId: z.string().min(2).max(120),
  timestamp: z.number().int().optional(),
  lessonSessionId: z.string().optional()
});

export const eegHistoryQuerySchema = z.object({
  studentId: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(1000).default(120)
});

export const aiPersonalizeSchema = z.object({
  studentId: z.string().min(2),
  subject: z.string().min(2),
  topic: z.string().min(2),
  grade: z.number().int().min(1).max(12).optional(),
  lessonId: z.string().optional(),
  lessonSessionId: z.string().optional(),
  includeAssignment: z.boolean().default(true),
  includeHomework: z.boolean().default(true)
});
