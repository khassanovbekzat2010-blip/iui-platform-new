import { HomeworkSubmissionStatus, TaskType, UserRole } from "@prisma/client";

import { createDailyTaskSeed } from "@/data/mock/daily-task-seed";
import { db } from "@/lib/db";

const DAY_MS = 86_400_000;

export function toUserId(raw: string) {
  return raw.trim().toLowerCase();
}

export function xpNeeded(level: number) {
  return 100 + (level - 1) * 25;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateKey(value = new Date()) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function plusDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export async function ensureSeedData() {
  const count = await db.dailyTask.count();
  if (count >= 50) {
    return;
  }
  const seed = createDailyTaskSeed();
  await db.dailyTask.createMany({
    data: seed.map((item) => ({
      subject: item.subject,
      grade: item.grade,
      topic: item.topic,
      difficulty: item.difficulty,
      type: item.type,
      question: item.question,
      options: item.options ? JSON.stringify(item.options) : null,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation
    }))
  });
}

export async function ensureUserRows(userId: string, role: UserRole = UserRole.student) {
  await db.profile.upsert({
    where: { userId },
    create: {
      userId,
      role
    },
    update: {}
  });

  await db.gamification.upsert({
    where: { userId },
    create: {
      userId,
      avatarId: "avatar-01",
      level: 1,
      xp: 0,
      streakDays: 0
    },
    update: {}
  });

  await db.settings.upsert({
    where: { userId },
    create: {
      userId,
      dailyReminderEnabled: true,
      homeworkDeadlineReminderEnabled: true
    },
    update: {}
  });
}

export async function addXp(userId: string, amount: number) {
  if (amount <= 0) return null;
  const game = await db.gamification.findUnique({ where: { userId } });
  if (!game) return null;

  let nextXp = game.xp + amount;
  let nextLevel = game.level;
  while (nextXp >= xpNeeded(nextLevel)) {
    nextXp -= xpNeeded(nextLevel);
    nextLevel += 1;
  }

  return db.gamification.update({
    where: { userId },
    data: {
      xp: nextXp,
      level: nextLevel
    }
  });
}

export async function refreshStreak(userId: string, dateValue = new Date()) {
  const game = await db.gamification.findUnique({ where: { userId } });
  if (!game || !game.enableStreak) return game;

  const today = startOfDay(dateValue);
  const last = game.lastActivityDate ? startOfDay(game.lastActivityDate) : null;
  const isSameDay = last ? last.getTime() === today.getTime() : false;
  const isYesterday = last ? plusDays(last, 1).getTime() === today.getTime() : false;

  if (isSameDay) return game;

  let streakDays = 1;
  let bonusXp = 0;
  if (isYesterday) {
    streakDays = game.streakDays + 1;
    if (streakDays % 3 === 0) {
      bonusXp = 15;
    }
  }

  const updated = await db.gamification.update({
    where: { userId },
    data: {
      streakDays,
      lastActivityDate: today
    }
  });

  await db.streak.upsert({
    where: { userId },
    create: {
      userId,
      current: streakDays,
      best: streakDays,
      lastActiveDate: today
    },
    update: {
      current: streakDays,
      best: Math.max(streakDays, game.streakDays),
      lastActiveDate: today
    }
  });

  await db.studentProfile.updateMany({
    where: { userId },
    data: {
      streak: streakDays
    }
  });

  if (bonusXp > 0) {
    await addXp(userId, bonusXp);
  }

  return updated;
}

export async function tasksForToday(userId: string) {
  await ensureSeedData();
  const profile = await db.profile.findUnique({ where: { userId } });
  const subjectList = parseStringArray(profile?.subjects);
  if (!profile?.grade || !Array.isArray(subjectList) || subjectList.length === 0) {
    return [];
  }
  const subjects = subjectList.slice(0, 4);
  const limit = profile.grade >= 9 ? 3 : profile.grade >= 6 ? 2 : 1;
  const dayKey = toDateKey();
  const offset = Number(dayKey.replace(/-/g, "")) % 7;

  const tasks = await db.dailyTask.findMany({
    where: {
      grade: profile.grade,
      subject: { in: subjects }
    },
    orderBy: { createdAt: "asc" }
  });

  return tasks.slice(offset, offset + limit).length > 0 ? tasks.slice(offset, offset + limit) : tasks.slice(0, limit);
}

export async function submitDailyAnswer(params: { userId: string; taskId: string; answer: string }) {
  const today = startOfDay();
  const task = await db.dailyTask.findUnique({ where: { id: params.taskId } });
  if (!task) {
    throw new Error("Task not found");
  }
  const existing = await db.dailyCompletion.findFirst({
    where: { userId: params.userId, dailyTaskId: params.taskId, date: today }
  });
  if (existing) {
    return { alreadySubmitted: true, isCorrect: existing.isCorrect, explanation: task.explanation };
  }
  const normalizedAnswer = params.answer.trim().toLowerCase();
  const normalizedCorrect = task.correctAnswer.trim().toLowerCase();
  const isCorrect = normalizedAnswer === normalizedCorrect;

  await db.dailyCompletion.create({
    data: {
      userId: params.userId,
      dailyTaskId: params.taskId,
      date: today,
      answer: params.answer.trim(),
      isCorrect
    }
  });

  await refreshStreak(params.userId, today);
  await addXp(params.userId, 10);

  return { alreadySubmitted: false, isCorrect, explanation: task.explanation };
}

export function isTeacherLike(role: UserRole) {
  return role === UserRole.teacher || role === UserRole.admin;
}

export function mapSubmissionStatus(status: HomeworkSubmissionStatus) {
  return status;
}

export function listStatusesForStudent() {
  return [
    HomeworkSubmissionStatus.NOT_STARTED,
    HomeworkSubmissionStatus.IN_PROGRESS,
    HomeworkSubmissionStatus.SUBMITTED,
    HomeworkSubmissionStatus.UNDER_REVIEW,
    HomeworkSubmissionStatus.ACCEPTED,
    HomeworkSubmissionStatus.NEEDS_REVISION
  ];
}

export function validDailyType(type: string): type is TaskType {
  return type === TaskType.MULTIPLE_CHOICE || type === TaskType.SHORT_ANSWER;
}
