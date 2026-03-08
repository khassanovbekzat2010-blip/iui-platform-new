import bcrypt from "bcryptjs";
import { PrismaClient, ProgressStatus, TaskKind, UserRole } from "@prisma/client";

import { ACHIEVEMENT_CODES, JOURNEY_STEP_TEMPLATES } from "../modules/journey/constants";

const prisma = new PrismaClient();

async function main() {
  const teacherPass = await bcrypt.hash("123456", 10);
  const studentPass = await bcrypt.hash("123456", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@test.com" },
    create: {
      email: "teacher@test.com",
      passwordHash: teacherPass,
      name: "Sofia Bennett",
      role: UserRole.teacher
    },
    update: {
      passwordHash: teacherPass,
      role: UserRole.teacher
    }
  });

  const student = await prisma.user.upsert({
    where: { email: "student@test.com" },
    create: {
      email: "student@test.com",
      passwordHash: studentPass,
      name: "Liam Kim",
      role: UserRole.student
    },
    update: {
      passwordHash: studentPass,
      role: UserRole.student
    }
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    create: {
      userId: student.id,
      grade: 9,
      subjects: JSON.stringify(["Physics", "Math"]),
      goals: "9 класс физика"
    },
    update: {
      grade: 9,
      subjects: JSON.stringify(["Physics", "Math"]),
      goals: "9 класс физика"
    }
  });

  await prisma.hero.upsert({
    where: { userId: student.id },
    create: {
      userId: student.id,
      archetype: "Scholar",
      level: 1,
      xp: 0,
      focus: 12,
      logic: 12,
      creativity: 9,
      discipline: 11,
      avatarUrl: "/avatars/avatar-01.svg",
      coins: 120,
      gems: 10
    },
    update: {}
  });

  await prisma.streak.upsert({
    where: { userId: student.id },
    create: { userId: student.id, current: 2, best: 4, freezeCount: 1 },
    update: {}
  });

  await prisma.deviceTelemetry.createMany({
    data: [
      {
        studentId: student.id,
        deviceName: "TGAM Band",
        deviceType: "TGAM",
        connectionState: "Connected",
        focus: 78,
        signal: 91
      },
      {
        studentId: student.id,
        deviceName: "ESP32 Board",
        deviceType: "ESP32",
        connectionState: "Connected",
        focus: 72,
        signal: 88
      }
    ]
  });

  const classroom = await prisma.classroom.upsert({
    where: { id: "class-9a" },
    create: { id: "class-9a", name: "9A Journey", grade: 9, teacherId: teacher.id },
    update: {}
  });

  await prisma.enrollment.upsert({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId: student.id } },
    create: { classroomId: classroom.id, studentId: student.id },
    update: {}
  });

  const act = await prisma.act.upsert({
    where: { id: "act-1" },
    create: {
      id: "act-1",
      title: "Act I: Path of Light",
      description: "Освоить фундамент и пройти первое испытание.",
      orderIndex: 1,
      grade: 9,
      subject: "Physics"
    },
    update: {}
  });

  const stepIds: string[] = [];
  for (const [index, template] of JOURNEY_STEP_TEMPLATES.entries()) {
    const step = await prisma.journeyStep.upsert({
      where: { actId_orderIndex: { actId: act.id, orderIndex: index + 1 } },
      create: {
        actId: act.id,
        orderIndex: index + 1,
        code: template.code,
        title: template.title,
        description: `Journey step ${index + 1}: ${template.title}`,
        isBoss: template.isBoss,
        rewardXp: template.isBoss ? 120 : 40,
        rewardCoins: template.isBoss ? 80 : 20,
        isLockedByDefault: index > 0
      },
      update: {
        title: template.title,
        code: template.code,
        isBoss: template.isBoss
      }
    });
    stepIds.push(step.id);
  }

  const questSpecs = [
    { id: "quest-1", stepIndex: 0, title: "Diagnostic Warmup", isMain: false },
    { id: "quest-2", stepIndex: 1, title: "Call Challenge", isMain: true },
    { id: "quest-3", stepIndex: 2, title: "Refusal Breakthrough", isMain: false },
    { id: "quest-4", stepIndex: 4, title: "Threshold Crossing", isMain: true },
    { id: "quest-5", stepIndex: 5, title: "Allies & Enemies", isMain: false },
    { id: "quest-6", stepIndex: 6, title: "Approach Trial", isMain: true }
  ];

  for (const [index, spec] of questSpecs.entries()) {
    const quest = await prisma.quest.upsert({
      where: { id: spec.id },
      create: {
        id: spec.id,
        stepId: stepIds[spec.stepIndex],
        title: spec.title,
        description: `Quest ${index + 1} for ${spec.title}`,
        difficulty: index < 2 ? "easy" : index < 4 ? "medium" : "hard",
        isMain: spec.isMain,
        baseXp: 35 + index * 8,
        baseCoins: 15 + index * 4,
        unlockOrder: index
      },
      update: {}
    });

    for (let taskIndex = 0; taskIndex < 3; taskIndex += 1) {
      const taskId = `${spec.id}-task-${taskIndex + 1}`;
      await prisma.task.upsert({
        where: { id: taskId },
        create: {
          id: taskId,
          questId: quest.id,
          type: taskIndex === 0 ? TaskKind.quiz : taskIndex === 1 ? TaskKind.open : TaskKind.drag,
          question: `${spec.title}: task ${taskIndex + 1}`,
          options: taskIndex === 0 ? JSON.stringify(["A", "B", "C", "D"]) : null,
          correctAnswer: taskIndex === 0 ? "B" : taskIndex === 1 ? "force" : "vector",
          explanation: "Проверьте базовый принцип и формулу.",
          topic: "Mechanics",
          difficulty: quest.difficulty,
          orderIndex: taskIndex + 1
        },
        update: {}
      });
    }
  }

  const ordealStep = await prisma.journeyStep.findFirstOrThrow({
    where: { actId: act.id, code: "ordeal" }
  });
  await prisma.bossBattle.upsert({
    where: { stepId: ordealStep.id },
    create: {
      id: "boss-1",
      stepId: ordealStep.id,
      title: "Ordeal: Physics Core Exam",
      timeLimitSec: 900,
      maxAttempts: 3,
      passScore: 70,
      rewardChest: "rare"
    },
    update: {}
  });

  await prisma.itemDefinition.upsert({
    where: { slug: "streak-freeze" },
    create: {
      name: "Streak Freeze",
      slug: "streak-freeze",
      rarity: "rare",
      type: "utility",
      priceCoins: 80,
      priceGems: 1,
      effects: JSON.stringify({ freezeDays: 1 }),
      cooldownSeconds: 86400,
      isStreakFreeze: true
    },
    update: {}
  });

  await prisma.itemDefinition.upsert({
    where: { slug: "focus-potion" },
    create: {
      name: "Focus Potion",
      slug: "focus-potion",
      rarity: "common",
      type: "booster",
      priceCoins: 40,
      priceGems: 0,
      effects: JSON.stringify({ focusBoost: 2 })
    },
    update: {}
  });

  await prisma.itemDefinition.upsert({
    where: { slug: "epic-cape" },
    create: {
      name: "Epic Cape",
      slug: "epic-cape",
      rarity: "epic",
      type: "cosmetic",
      priceCoins: 350,
      priceGems: 5
    },
    update: {}
  });

  const achievements = [
    { code: ACHIEVEMENT_CODES.STREAK_7, title: "7-day streak", description: "Поддерживайте серию 7 дней", xpReward: 70, coinsReward: 70, gemsReward: 1 },
    { code: ACHIEVEMENT_CODES.BOSS_SLAYER, title: "Boss Slayer", description: "Победить босса", xpReward: 120, coinsReward: 100, gemsReward: 2 },
    { code: ACHIEVEMENT_CODES.PERFECT_SCORE, title: "Perfect Score", description: "100% в испытании", xpReward: 150, coinsReward: 120, gemsReward: 3 }
  ];

  for (const achievement of achievements) {
    await prisma.achievementDefinition.upsert({
      where: { code: achievement.code },
      create: achievement,
      update: achievement
    });
  }

  const quests = await prisma.quest.findMany({ where: { step: { actId: act.id } } });
  for (const quest of quests) {
    await prisma.questProgress.upsert({
      where: { userId_questId: { userId: student.id, questId: quest.id } },
      create: {
        userId: student.id,
        questId: quest.id,
        status: quest.id === "quest-1" || quest.id === "quest-2" ? ProgressStatus.UNLOCKED : ProgressStatus.LOCKED
      },
      update: {}
    });
  }

  const steps = await prisma.journeyStep.findMany({ where: { actId: act.id } });
  for (const step of steps) {
    await prisma.journeyStepProgress.upsert({
      where: { userId_stepId: { userId: student.id, stepId: step.id } },
      create: {
        userId: student.id,
        stepId: step.id,
        status: step.orderIndex === 1 ? ProgressStatus.UNLOCKED : ProgressStatus.LOCKED,
        unlockedAt: step.orderIndex === 1 ? new Date() : null
      },
      update: {}
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
