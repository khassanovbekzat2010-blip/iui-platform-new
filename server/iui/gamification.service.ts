import { db } from "@/lib/db";

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 120) + 1);
}

export async function ensureStudentGamificationState(studentId: string) {
  await db.$transaction(async (tx) => {
    const character = await tx.characterProfile.upsert({
      where: { studentId },
      create: {
        studentId,
        avatar: "hero-neural-scout",
        level: 1,
        xp: 0,
        skills: JSON.stringify(["focus", "logic"]),
        rewards: JSON.stringify(["starter-badge"])
      },
      update: {}
    });

    const activeMissionCount = await tx.mission.count({
      where: {
        studentId,
        status: "ACTIVE"
      }
    });

    if (activeMissionCount === 0) {
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.mission.createMany({
        data: [
          {
            studentId,
            title: "Focus Sprint",
            description: "Keep attention above 70 during one EEG streak.",
            rewardXp: 25,
            dueAt
          },
          {
            studentId,
            title: "Lesson Finisher",
            description: "Finish one live lesson and review the AI summary.",
            rewardXp: 30,
            dueAt
          },
          {
            studentId,
            title: "Homework Return",
            description: "Submit one homework task after the lesson.",
            rewardXp: 35,
            dueAt
          }
        ]
      });
    }

    const focusReadings = await tx.eEGReading.count({
      where: {
        studentId,
        attention: { gte: 80 }
      }
    });

    if (focusReadings > 0) {
      await tx.achievement.upsert({
        where: {
          studentId_code: {
            studentId,
            code: "FOCUS_BURST"
          }
        },
        create: {
          studentId,
          code: "FOCUS_BURST",
          title: "Focus Burst",
          description: "Reached 80+ attention on a live EEG stream."
        },
        update: {}
      });
    }

    if (character.xp >= 120) {
      await tx.achievement.upsert({
        where: {
          studentId_code: {
            studentId,
            code: "LEVEL_TWO"
          }
        },
        create: {
          studentId,
          code: "LEVEL_TWO",
          title: "Level Two",
          description: "Reached level 2 in the hero journey."
        },
        update: {}
      });
    }
  });
}

export async function grantFocusXp(input: {
  studentId: string;
  xp: number;
  source: string;
  reason: string;
}) {
  if (input.xp <= 0) {
    return null;
  }

  await ensureStudentGamificationState(input.studentId);

  return db.$transaction(async (tx) => {
    const character = await tx.characterProfile.upsert({
      where: { studentId: input.studentId },
      create: {
        studentId: input.studentId,
        avatar: "hero-neural-scout",
        level: 1,
        xp: 0,
        skills: JSON.stringify([]),
        rewards: JSON.stringify([])
      },
      update: {}
    });

    const nextXp = character.xp + input.xp;
    const nextLevel = levelFromXp(nextXp);

    await tx.characterProfile.update({
      where: { studentId: input.studentId },
      data: {
        xp: nextXp,
        level: nextLevel
      }
    });

    await tx.studentProfile.updateMany({
      where: { userId: input.studentId },
      data: {
        xp: { increment: input.xp },
        heroLevel: nextLevel
      }
    });

    await tx.xPProgress.create({
      data: {
        studentId: input.studentId,
        xp: input.xp,
        level: nextLevel,
        source: input.source,
        reason: input.reason
      }
    });

    if (nextLevel >= 2) {
      await tx.achievement.upsert({
        where: {
          studentId_code: {
            studentId: input.studentId,
            code: "LEVEL_TWO"
          }
        },
        create: {
          studentId: input.studentId,
          code: "LEVEL_TWO",
          title: "Level Two",
          description: "Reached level 2 in the hero journey."
        },
        update: {}
      });
    }

    return { xp: nextXp, level: nextLevel };
  });
}
