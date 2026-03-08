import {
  ProgressStatus,
  RewardSourceType,
  TaskKind,
  UserRole
} from "@prisma/client";

import { db } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db-init";
import { ACHIEVEMENT_CODES, JOURNEY_STEP_TEMPLATES } from "@/modules/journey/constants";
import {
  applyLevelProgress,
  calculateReward,
  isSuspiciousAttempt,
  rollLoot,
  shouldUnlockStreakAchievement
} from "@/modules/journey/progression";
import { generateMentorGuidance } from "@/modules/mentor/mentor.service";

function nowDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function avatarByArchetype(archetype: "Explorer" | "Scholar" | "Builder") {
  if (archetype === "Explorer") return "/avatars/avatar-03.svg";
  if (archetype === "Builder") return "/avatars/avatar-07.svg";
  return "/avatars/avatar-01.svg";
}

let journeyReady = false;

async function ensureJourneyRuntimeReady() {
  if (journeyReady) return;
  await ensureDatabaseReady();

  const actCount = await db.act.count();
  if (actCount === 0) {
    const teacher = await db.user.upsert({
      where: { email: "teacher@test.com" },
      create: {
        email: "teacher@test.com",
        passwordHash: "otp",
        name: "Sofia Bennett",
        role: UserRole.teacher
      },
      update: {}
    });

    const student = await db.user.upsert({
      where: { email: "student@test.com" },
      create: {
        email: "student@test.com",
        passwordHash: "otp",
        name: "Liam Kim",
        role: UserRole.student
      },
      update: {}
    });

    await db.studentProfile.upsert({
      where: { userId: student.id },
      create: {
        userId: student.id,
        grade: 9,
        subjects: JSON.stringify(["Physics", "Math"]),
        goals: "9 класс физика"
      },
      update: {}
    });

    await db.hero.upsert({
      where: { userId: student.id },
      create: {
        userId: student.id,
        archetype: "Scholar",
        avatarUrl: "/avatars/avatar-01.svg",
        coins: 120,
        gems: 8
      },
      update: {}
    });

    await db.streak.upsert({
      where: { userId: student.id },
      create: { userId: student.id, current: 1, best: 3, freezeCount: 1 },
      update: {}
    });

    const act = await db.act.create({
      data: {
        title: "Act I: Journey Start",
        description: "Базовый путь героя по физике 9 класса",
        orderIndex: 1,
        grade: 9,
        subject: "Physics"
      }
    });

    const stepIds: string[] = [];
    for (const [index, template] of JOURNEY_STEP_TEMPLATES.entries()) {
      const step = await db.journeyStep.create({
        data: {
          actId: act.id,
          orderIndex: index + 1,
          code: template.code,
          title: template.title,
          description: `Step ${index + 1} - ${template.title}`,
          isBoss: template.isBoss,
          rewardXp: template.isBoss ? 100 : 30,
          rewardCoins: template.isBoss ? 70 : 12,
          isLockedByDefault: index !== 0
        }
      });
      stepIds.push(step.id);
    }

    const questSpecs = [
      { step: 0, title: "Diagnostic Warmup", main: false },
      { step: 1, title: "Call to Adventure Quest", main: true },
      { step: 2, title: "Refusal Breakthrough", main: false },
      { step: 4, title: "Threshold Crossing", main: true },
      { step: 5, title: "Allies and Enemies", main: false },
      { step: 6, title: "Approach Trial", main: true }
    ];

    for (const [index, spec] of questSpecs.entries()) {
      const quest = await db.quest.create({
        data: {
          id: `quest-${index + 1}`,
          stepId: stepIds[spec.step],
          title: spec.title,
          description: `Quest for ${spec.title}`,
          difficulty: index < 2 ? "easy" : index < 4 ? "medium" : "hard",
          isMain: spec.main,
          baseXp: 30 + index * 8,
          baseCoins: 10 + index * 4,
          unlockOrder: index
        }
      });

      const taskPool = [
        { q: "Choose correct force relation", t: TaskKind.quiz, a: "B", o: JSON.stringify(["A", "B", "C", "D"]) },
        { q: "Write key term for mechanics", t: TaskKind.open, a: "force", o: null },
        { q: "Drag and match vector concept", t: TaskKind.drag, a: "vector", o: null },
        { q: "Select formula for acceleration", t: TaskKind.quiz, a: "B", o: JSON.stringify(["A", "B", "C", "D"]) }
      ];
      for (const [taskIdx, task] of taskPool.entries()) {
        await db.task.create({
          data: {
            id: `${quest.id}-task-${taskIdx + 1}`,
            questId: quest.id,
            type: task.t,
            question: `${spec.title}: ${task.q}`,
            options: task.o,
            correctAnswer: task.a,
            explanation: "Проверь определение и формулу в конспекте.",
            topic: "Mechanics",
            difficulty: quest.difficulty,
            orderIndex: taskIdx + 1
          }
        });
      }
    }

    const ordealStep = await db.journeyStep.findFirst({ where: { actId: act.id, code: "ordeal" } });
    if (ordealStep) {
      await db.bossBattle.create({
        data: {
          id: "boss-1",
          stepId: ordealStep.id,
          title: "Ordeal: Physics Control Test",
          timeLimitSec: 900,
          maxAttempts: 3,
          passScore: 70,
          rewardChest: "rare"
        }
      });
    }

    const items = [
      { name: "Streak Freeze", slug: "streak-freeze", rarity: "rare", type: "utility", priceCoins: 80, priceGems: 1, isStreakFreeze: true },
      { name: "Focus Potion", slug: "focus-potion", rarity: "common", type: "booster", priceCoins: 40, priceGems: 0, isStreakFreeze: false },
      { name: "Epic Cape", slug: "epic-cape", rarity: "epic", type: "cosmetic", priceCoins: 320, priceGems: 4, isStreakFreeze: false }
    ] as const;
    for (const item of items) {
      await db.itemDefinition.upsert({
        where: { slug: item.slug },
        create: item,
        update: {}
      });
    }

    const achievements = [
      { code: ACHIEVEMENT_CODES.STREAK_7, title: "7-day streak", description: "Complete tasks 7 days in row", xpReward: 70, coinsReward: 50, gemsReward: 1 },
      { code: ACHIEVEMENT_CODES.BOSS_SLAYER, title: "Boss Slayer", description: "Win first boss fight", xpReward: 120, coinsReward: 90, gemsReward: 2 },
      { code: ACHIEVEMENT_CODES.PERFECT_SCORE, title: "Perfect Score", description: "Score 100 in boss fight", xpReward: 160, coinsReward: 120, gemsReward: 3 }
    ] as const;
    for (const achievement of achievements) {
      await db.achievementDefinition.upsert({
        where: { code: achievement.code },
        create: achievement,
        update: {}
      });
    }

    const classroom = await db.classroom.upsert({
      where: { id: "class-9a" },
      create: { id: "class-9a", name: "9A Journey", grade: 9, teacherId: teacher.id },
      update: {}
    });
    await db.enrollment.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId: student.id } },
      create: { classroomId: classroom.id, studentId: student.id },
      update: {}
    });
  }

  journeyReady = true;
}

export async function ensureJourneyUser(userId: string, role: UserRole = UserRole.student) {
  await ensureJourneyRuntimeReady();
  const existing = await db.user.findUnique({ where: { id: userId } });
  if (existing) {
    if (existing.role !== role) {
      return db.user.update({
        where: { id: userId },
        data: { role }
      });
    }
    return existing;
  }
  return db.user.create({
    data: {
      id: userId,
      email: `${userId}@demo.local`,
      passwordHash: "demo",
      name: userId,
      role
    }
  });
}

export async function upsertOnboarding(input: {
  userId: string;
  role: "student" | "teacher" | "admin";
  grade: number;
  subjects: string[];
  goal: string;
  archetype: "Explorer" | "Scholar" | "Builder";
}) {
  await ensureJourneyRuntimeReady();
  const userRole = input.role === "teacher" ? UserRole.teacher : input.role === "admin" ? UserRole.admin : UserRole.student;
  await ensureJourneyUser(input.userId, userRole);

  const hero = await db.hero.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      archetype: input.archetype,
      avatarUrl: avatarByArchetype(input.archetype)
    },
    update: {
      archetype: input.archetype,
      avatarUrl: avatarByArchetype(input.archetype)
    }
  });

  const profile = await db.studentProfile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      grade: input.grade,
      subjects: JSON.stringify(input.subjects),
      goals: input.goal
    },
    update: {
      grade: input.grade,
      subjects: JSON.stringify(input.subjects),
      goals: input.goal
    }
  });

  await db.streak.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, current: 0, best: 0, freezeCount: 1 },
    update: {}
  });

  const steps = await db.journeyStep.findMany({
    include: { quests: { orderBy: { unlockOrder: "asc" } } },
    orderBy: { orderIndex: "asc" }
  });

  for (const step of steps) {
    await db.journeyStepProgress.upsert({
      where: {
        userId_stepId: {
          userId: input.userId,
          stepId: step.id
        }
      },
      create: {
        userId: input.userId,
        stepId: step.id,
        status: step.orderIndex === 1 ? ProgressStatus.UNLOCKED : ProgressStatus.LOCKED,
        unlockedAt: step.orderIndex === 1 ? new Date() : null
      },
      update: {}
    });

    for (const quest of step.quests) {
      await db.questProgress.upsert({
        where: {
          userId_questId: {
            userId: input.userId,
            questId: quest.id
          }
        },
        create: {
          userId: input.userId,
          questId: quest.id,
          status: step.orderIndex === 1 ? ProgressStatus.UNLOCKED : ProgressStatus.LOCKED
        },
        update: {}
      });
    }
  }

  return { hero, profile };
}

async function applyReward(userId: string, sourceType: RewardSourceType, sourceId: string | null, reward: { xp: number; coins: number; gems: number }) {
  const hero = await db.hero.findUnique({ where: { userId } });
  if (!hero) throw new Error("Hero not found");
  const levelState = applyLevelProgress(hero.level, hero.xp, reward.xp);

  const updatedHero = await db.hero.update({
    where: { userId },
    data: {
      level: levelState.level,
      xp: levelState.xp,
      coins: hero.coins + reward.coins,
      gems: hero.gems + reward.gems
    }
  });

  await db.rewardTransaction.create({
    data: {
      userId,
      sourceType,
      sourceId,
      xp: reward.xp,
      coins: reward.coins,
      gems: reward.gems
    }
  });

  return updatedHero;
}

async function touchStreak(userId: string) {
  const streak = await db.streak.findUnique({ where: { userId } });
  if (!streak) return null;
  const today = nowDay();
  const last = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let current = 1;
  if (last) {
    const lastDay = new Date(last);
    lastDay.setHours(0, 0, 0, 0);
    if (lastDay.getTime() === today.getTime()) {
      current = streak.current;
    } else if (lastDay.getTime() === yesterday.getTime()) {
      current = streak.current + 1;
    } else if (streak.freezeCount > 0) {
      current = streak.current;
      await db.streak.update({
        where: { userId },
        data: { freezeCount: streak.freezeCount - 1 }
      });
    }
  }

  const best = Math.max(streak.best, current);
  const updated = await db.streak.update({
    where: { userId },
    data: {
      current,
      best,
      lastActiveDate: today
    }
  });

  if (shouldUnlockStreakAchievement(updated.current)) {
    const def = await db.achievementDefinition.findUnique({ where: { code: ACHIEVEMENT_CODES.STREAK_7 } });
    if (def) {
      await db.userAchievement.upsert({
        where: {
          userId_achievementDefinitionId: {
            userId,
            achievementDefinitionId: def.id
          }
        },
        create: {
          userId,
          achievementDefinitionId: def.id
        },
        update: {}
      });
    }
  }

  return updated;
}

export async function getDashboard(userId: string) {
  await ensureJourneyRuntimeReady();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [hero, streak, questProgress, nextStep, allUnlockedQuests, weakAttempts, attemptsToday] = await Promise.all([
    db.hero.findUnique({ where: { userId } }),
    db.streak.findUnique({ where: { userId } }),
    db.questProgress.findMany({
      where: { userId },
      include: { quest: true }
    }),
    db.journeyStepProgress.findFirst({
      where: { userId, status: ProgressStatus.UNLOCKED },
      include: { step: true },
      orderBy: { step: { orderIndex: "asc" } }
    }),
    db.quest.findMany({
      where: { questProgress: { some: { userId, status: ProgressStatus.UNLOCKED } } },
      include: { tasks: { orderBy: { orderIndex: "asc" } } },
      take: 4
    }),
    db.attempt.findMany({
      where: { userId, isCorrect: false },
      include: { task: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    db.attempt.count({
      where: {
        userId,
        createdAt: { gte: start, lt: end }
      }
    })
  ]);

  const dailyTasksRaw = allUnlockedQuests.flatMap((quest) =>
    quest.tasks.map((task) => ({
      questId: quest.id,
      questTitle: quest.title,
      taskId: task.id,
      taskQuestion: task.question,
      taskType: task.type,
      difficulty: task.difficulty
    }))
  );
  const todayTasks = dailyTasksRaw.slice(0, 8);
  const todayQuests = allUnlockedQuests.slice(0, 3);
  const mainQuest = allUnlockedQuests.find((item) => item.isMain) ?? allUnlockedQuests[0];
  const weakTopics = Array.from(new Set(weakAttempts.map((item) => item.task.topic)));
  const mentor = generateMentorGuidance({
    weakTopics,
    incorrectCount: weakAttempts.length,
    streak: streak?.current ?? 0,
    nextStepTitle: nextStep?.step.title
  });

  return {
    hero,
    streak,
    mentor,
    questStats: {
      completed: questProgress.filter((item) => item.status === ProgressStatus.COMPLETED).length,
      total: questProgress.length
    },
    todayQuests: todayQuests.map((item) => ({
      id: item.id,
      title: item.title,
      difficulty: item.difficulty,
      rewardXp: item.baseXp,
      rewardCoins: item.baseCoins
    })),
    todayTasks,
    dailyLimit: {
      max: 8,
      used: Math.min(8, attemptsToday),
      remaining: Math.max(0, 8 - attemptsToday)
    },
    mainQuest: mainQuest
      ? {
          id: mainQuest.id,
          title: mainQuest.title,
          taskCount: mainQuest.tasks.length,
          rewardXp: mainQuest.baseXp,
          rewardCoins: mainQuest.baseCoins
        }
      : null
  };
}

export async function completeTask(input: { userId: string; taskId: string; answer: string; timeSpentMs: number }) {
  await ensureJourneyRuntimeReady();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const attemptsToday = await db.attempt.count({
    where: {
      userId: input.userId,
      createdAt: { gte: start, lt: end }
    }
  });
  if (attemptsToday >= 8) {
    throw new Error("Daily limit reached: 8 tasks per day");
  }

  const task = await db.task.findUnique({
    where: { id: input.taskId },
    include: { quest: true }
  });
  if (!task) throw new Error("Task not found");

  const isCorrect = input.answer.trim().toLowerCase() === task.correctAnswer.trim().toLowerCase();
  const suspicious = isSuspiciousAttempt(input.timeSpentMs);
  await db.attempt.create({
    data: {
      userId: input.userId,
      taskId: task.id,
      questId: task.questId,
      answer: input.answer,
      isCorrect,
      timeSpentMs: input.timeSpentMs,
      suspicious
    }
  });

  const streak = await touchStreak(input.userId);
  const reward = calculateReward({
    baseXp: isCorrect ? 15 : 5,
    baseCoins: isCorrect ? 7 : 2,
    streak: streak?.current ?? 0,
    suspicious
  });
  const hero = await applyReward(input.userId, RewardSourceType.TASK, task.id, reward);

  return { isCorrect, suspicious, explanation: task.explanation, hero, reward };
}

export async function completeQuest(input: { userId: string; questId: string }) {
  await ensureJourneyRuntimeReady();
  const quest = await db.quest.findUnique({
    where: { id: input.questId },
    include: {
      step: true,
      tasks: true
    }
  });
  if (!quest) throw new Error("Quest not found");

  const attempts = await db.attempt.findMany({
    where: {
      userId: input.userId,
      questId: input.questId
    }
  });

  const completedTaskIds = new Set(attempts.filter((item) => item.isCorrect).map((item) => item.taskId));
  if (completedTaskIds.size < quest.tasks.length) {
    throw new Error("Complete all tasks first");
  }

  await db.questProgress.upsert({
    where: { userId_questId: { userId: input.userId, questId: input.questId } },
    create: {
      userId: input.userId,
      questId: input.questId,
      status: ProgressStatus.COMPLETED,
      completedAt: new Date()
    },
    update: {
      status: ProgressStatus.COMPLETED,
      completedAt: new Date()
    }
  });

  const stepQuests = await db.quest.findMany({ where: { stepId: quest.stepId } });
  const stepProgress = await db.questProgress.findMany({
    where: { userId: input.userId, questId: { in: stepQuests.map((item) => item.id) } }
  });

  const allCompleted = stepQuests.every((item) => stepProgress.some((p) => p.questId === item.id && p.status === ProgressStatus.COMPLETED));
  if (allCompleted) {
    await db.journeyStepProgress.updateMany({
      where: { userId: input.userId, stepId: quest.stepId },
      data: {
        status: ProgressStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    const nextStep = await db.journeyStep.findFirst({
      where: {
        actId: quest.step.actId,
        orderIndex: quest.step.orderIndex + 1
      }
    });
    if (nextStep) {
      await db.journeyStepProgress.upsert({
        where: { userId_stepId: { userId: input.userId, stepId: nextStep.id } },
        create: {
          userId: input.userId,
          stepId: nextStep.id,
          status: ProgressStatus.UNLOCKED,
          unlockedAt: new Date()
        },
        update: {
          status: ProgressStatus.UNLOCKED,
          unlockedAt: new Date()
        }
      });

      await db.questProgress.updateMany({
        where: {
          userId: input.userId,
          quest: { stepId: nextStep.id }
        },
        data: { status: ProgressStatus.UNLOCKED }
      });
    }
  }

  const reward = calculateReward({
    baseXp: quest.baseXp,
    baseCoins: quest.baseCoins,
    streak: 0,
    suspicious: false
  });
  const hero = await applyReward(input.userId, RewardSourceType.QUEST, input.questId, reward);

  return { hero, reward, unlockedNext: allCompleted };
}

export async function attemptBoss(input: { userId: string; bossId: string; score: number; timeSpentMs: number }) {
  await ensureJourneyRuntimeReady();
  const boss = await db.bossBattle.findUnique({
    where: { id: input.bossId },
    include: { step: true }
  });
  if (!boss) throw new Error("Boss not found");

  const attemptCount = await db.bossAttempt.count({ where: { userId: input.userId, bossId: input.bossId } });
  if (attemptCount >= boss.maxAttempts) throw new Error("No attempts left");

  const passed = input.score >= boss.passScore;
  const attempt = await db.bossAttempt.create({
    data: {
      userId: input.userId,
      bossId: input.bossId,
      score: input.score,
      passed,
      timeSpentMs: input.timeSpentMs,
      attemptNo: attemptCount + 1
    }
  });

  if (!passed) {
    return { passed: false, attempt };
  }

  const reward = calculateReward({
    baseXp: 100,
    baseCoins: 50,
    streak: 0,
    suspicious: false,
    isBoss: true
  });
  const hero = await applyReward(input.userId, RewardSourceType.BOSS, boss.id, reward);

  const rarity = rollLoot(input.score);
  const lootItem = await db.itemDefinition.findFirst({
    where: { rarity },
    orderBy: { priceCoins: "desc" }
  });
  if (lootItem) {
    await db.inventoryItem.upsert({
      where: { userId_itemDefinitionId: { userId: input.userId, itemDefinitionId: lootItem.id } },
      create: { userId: input.userId, itemDefinitionId: lootItem.id, quantity: 1 },
      update: { quantity: { increment: 1 } }
    });
  }

  await db.bossAttempt.update({
    where: { id: attempt.id },
    data: { rewardGranted: true }
  });

  const bossAchievement = await db.achievementDefinition.findUnique({ where: { code: ACHIEVEMENT_CODES.BOSS_SLAYER } });
  if (bossAchievement) {
    await db.userAchievement.upsert({
      where: {
        userId_achievementDefinitionId: {
          userId: input.userId,
          achievementDefinitionId: bossAchievement.id
        }
      },
      create: {
        userId: input.userId,
        achievementDefinitionId: bossAchievement.id
      },
      update: {}
    });
  }

  return { passed: true, attempt, hero, reward, loot: lootItem };
}

export async function purchaseShopItem(input: { userId: string; itemSlug: string; quantity: number }) {
  await ensureJourneyRuntimeReady();
  const [hero, item] = await Promise.all([
    db.hero.findUnique({ where: { userId: input.userId } }),
    db.itemDefinition.findUnique({ where: { slug: input.itemSlug } })
  ]);
  if (!hero) throw new Error("Hero not found");
  if (!item) throw new Error("Item not found");

  const totalCoins = item.priceCoins * input.quantity;
  const totalGems = item.priceGems * input.quantity;
  if (hero.coins < totalCoins || hero.gems < totalGems) {
    throw new Error("Not enough currency");
  }

  const updatedHero = await db.hero.update({
    where: { userId: input.userId },
    data: {
      coins: hero.coins - totalCoins,
      gems: hero.gems - totalGems
    }
  });

  await db.inventoryItem.upsert({
    where: {
      userId_itemDefinitionId: {
        userId: input.userId,
        itemDefinitionId: item.id
      }
    },
    create: {
      userId: input.userId,
      itemDefinitionId: item.id,
      quantity: input.quantity
    },
    update: {
      quantity: { increment: input.quantity }
    }
  });

  await db.rewardTransaction.create({
    data: {
      userId: input.userId,
      sourceType: RewardSourceType.SHOP_PURCHASE,
      sourceId: item.id,
      coins: -totalCoins,
      gems: -totalGems
    }
  });

  return { hero: updatedHero, item };
}
