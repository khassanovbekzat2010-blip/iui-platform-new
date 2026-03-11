import { RecommendationType, UserRole } from "@prisma/client";

import { db } from "@/lib/db";
import { summarizeEEGHistory } from "@/lib/eeg/metrics";
import { ensureStudentGamificationState } from "@/server/iui/gamification.service";

function toISO(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export async function getStudentDashboardData(studentId: string) {
  await ensureStudentGamificationState(studentId);

  const [student, character, recentEEG, assignments, homeworks, recommendations, missions, achievements, submissions, xpTimeline, recentLessons] =
    await Promise.all([
      db.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: {
            select: {
              grade: true,
              streak: true,
              xp: true,
              heroLevel: true
            }
          },
          streak: {
            select: {
              current: true,
              best: true
            }
          }
        }
      }),
      db.characterProfile.findUnique({
        where: { studentId },
        select: {
          avatar: true,
          level: true,
          xp: true,
          skills: true,
          rewards: true
        }
      }),
      db.eEGReading.findMany({
        where: { studentId },
        orderBy: { timestamp: "desc" },
        take: 60,
        select: {
          id: true,
          attention: true,
          meditation: true,
          signal: true,
          raw: true,
          engagementScore: true,
          state: true,
          timestamp: true
        }
      }),
      db.assignment.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          type: true,
          status: true,
          reason: true,
          createdAt: true
        }
      }),
      db.homework.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          subject: true,
          topic: true,
          difficulty: true,
          dueDate: true,
          generatedByAI: true
        }
      }),
      db.aIRecommendation.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          recommendationType: true,
          content: true,
          createdAt: true
        }
      }),
      db.mission.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          rewardXp: true,
          dueAt: true
        }
      }),
      db.achievement.findMany({
        where: { studentId },
        orderBy: { unlockedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          code: true,
          unlockedAt: true
        }
      }),
      db.homeworkSubmission.findMany({
        where: { userId: studentId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          homeworkId: true,
          status: true,
          aiScore: true,
          submittedAt: true,
          reviewedAt: true
        }
      }),
      db.xPProgress.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          xp: true,
          level: true,
          source: true,
          reason: true,
          createdAt: true
        }
      }),
      db.lesson.findMany({
        where: {
          participants: {
            some: {
              userId: studentId
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          subject: true,
          aiStatus: true,
          createdAt: true,
          durationSec: true,
          summary: true
        }
      })
    ]);

  if (!student) {
    throw new Error("Student not found");
  }

  const latest = recentEEG[0] ?? null;
  const eegSummary = summarizeEEGHistory(recentEEG);
  const lowAttentionStreak = recentEEG.slice(0, 5).filter((row) => row.attention < 40).length;
  const submissionMap = new Map(submissions.map((item) => [item.homeworkId, item]));
  const adaptiveHint =
    lowAttentionStreak >= 3
      ? "Attention dropped. Suggested adaptation: 2-minute interactive task + brain break."
      : recentLessons.length
      ? "Lesson archive is ready. Review summary and complete the assigned homework before the next class."
      : "Stable lesson focus. Keep current pace and reinforce with short reflective questions.";

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      grade: student.studentProfile?.grade ?? null
    },
    hero: {
      avatar: character?.avatar ?? "hero-neural-scout",
      level: character?.level ?? student.studentProfile?.heroLevel ?? 1,
      xp: character?.xp ?? student.studentProfile?.xp ?? 0,
      streak: student.streak?.current ?? student.studentProfile?.streak ?? 0
    },
    eeg: {
      latest: latest
        ? {
            id: latest.id,
            attention: latest.attention,
            meditation: latest.meditation,
            signal: latest.signal,
            raw: latest.raw,
            engagementScore: latest.engagementScore,
            state: latest.state,
            timestamp: latest.timestamp.toISOString()
          }
        : null,
      summary: eegSummary,
      history: recentEEG
        .map((row) => ({
          id: row.id,
          attention: row.attention,
          meditation: row.meditation,
          signal: row.signal,
          raw: row.raw,
          engagementScore: row.engagementScore,
          state: row.state,
          timestamp: row.timestamp.toISOString()
        }))
        .reverse(),
      adaptiveHint
    },
    assignments: assignments.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    })),
    homeworks: homeworks.map((item) => {
      const submission = submissionMap.get(item.id);
      return {
        ...item,
        dueDate: item.dueDate.toISOString(),
        submissionStatus: submission?.status ?? "NOT_STARTED",
        aiScore: submission?.aiScore ?? null,
        submittedAt: submission?.submittedAt?.toISOString() ?? null,
        reviewedAt: submission?.reviewedAt?.toISOString() ?? null
      };
    }),
    recommendations: recommendations.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    })),
    missions: missions.map((item) => ({
      ...item,
      dueAt: toISO(item.dueAt)
    })),
    achievements: achievements.map((item) => ({
      ...item,
      unlockedAt: item.unlockedAt.toISOString()
    })),
    progress: {
      xpTimeline: xpTimeline.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString()
      })),
      completedHomework: submissions.filter((item) => item.status === "ACCEPTED").length,
      pendingHomework: homeworks.filter((item) => (submissionMap.get(item.id)?.status ?? "NOT_STARTED") !== "ACCEPTED").length
    },
    recentLessons: recentLessons.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    }))
  };
}

export async function getTeacherDashboardData(teacherId: string) {
  const [classrooms, recentLessons] = await Promise.all([
    db.classroom.findMany({
      where: { teacherId },
      select: {
        id: true,
        name: true,
        grade: true,
        enrollments: {
          select: {
            student: {
              select: {
                id: true,
                name: true,
                studentProfile: {
                  select: { grade: true }
                }
              }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    db.lesson.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        subject: true,
        aiStatus: true,
        aiError: true,
        summary: true,
        createdAt: true,
        durationSec: true
      }
    })
  ]);

  const studentIds = Array.from(
    new Set(classrooms.flatMap((classroom) => classroom.enrollments.map((entry) => entry.student.id)))
  );

  const eegRows = studentIds.length
    ? await db.eEGReading.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { timestamp: "desc" },
        take: Math.max(150, studentIds.length * 20),
        select: {
          studentId: true,
          attention: true,
          meditation: true,
          signal: true,
          engagementScore: true,
          state: true,
          timestamp: true
        }
      })
    : [];

  const latestByStudent = new Map<string, (typeof eegRows)[number]>();
  for (const row of eegRows) {
    if (!latestByStudent.has(row.studentId)) {
      latestByStudent.set(row.studentId, row);
    }
  }

  const teacherInsights = await db.aIRecommendation.findMany({
    where: {
      teacherId,
      recommendationType: { in: [RecommendationType.TEACHER_INSIGHT, RecommendationType.BRAIN_BREAK, RecommendationType.ADAPTIVE_TASK] }
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      studentId: true,
      recommendationType: true,
      content: true,
      createdAt: true
    }
  });

  const recentHomeworkSubmissions = studentIds.length
    ? await db.homeworkSubmission.findMany({
        where: {
          userId: { in: studentIds },
          homework: { createdBy: teacherId }
        },
        orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          id: true,
          userId: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          aiScore: true,
          homework: {
            select: {
              id: true,
              title: true,
              points: true
            }
          }
        }
      })
    : [];

  const xpRows = studentIds.length
    ? await db.xPProgress.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: "desc" },
        take: Math.max(50, studentIds.length * 6),
        select: {
          studentId: true,
          xp: true,
          level: true,
          source: true,
          createdAt: true
        }
      })
    : [];

  const students = classrooms.flatMap((classroom) =>
    classroom.enrollments.map((entry) => {
      const latest = latestByStudent.get(entry.student.id);
      return {
        id: entry.student.id,
        name: entry.student.name,
        grade: entry.student.studentProfile?.grade ?? classroom.grade,
        classroomId: classroom.id,
        classroomName: classroom.name,
        attention: latest?.attention ?? 0,
        meditation: latest?.meditation ?? 0,
        signal: latest?.signal ?? 200,
        engagementScore: latest?.engagementScore ?? 0,
        state: latest?.state ?? "NO_SIGNAL",
        timestamp: latest?.timestamp.toISOString() ?? null
      };
    })
  );

  const averageEngagement = students.length
    ? Math.round(students.reduce((acc, item) => acc + item.engagementScore, 0) / students.length)
    : 0;

  const atRiskStudents = students
    .filter((student) => student.attention > 0 && student.attention < 40)
    .map((student) => ({
      id: student.id,
      name: student.name,
      reason: "Attention below 40 in live stream"
    }));

  const heatmap = students.map((student) => ({
    studentId: student.id,
    studentName: student.name,
    classroomName: student.classroomName,
    attention: student.attention,
    engagementScore: student.engagementScore
  }));

  const latestXpByStudent = new Map<string, (typeof xpRows)[number]>();
  for (const row of xpRows) {
    if (!latestXpByStudent.has(row.studentId)) {
      latestXpByStudent.set(row.studentId, row);
    }
  }

  const engagementAverage = students.length
    ? Math.round(students.reduce((acc, student) => acc + student.engagementScore, 0) / students.length)
    : 0;

  const nextLessonPlan =
    engagementAverage < 45
      ? {
          title: "План следующего урока: вернуть вовлеченность",
          steps: [
            "Начните урок с короткого квиза на 2-3 минуты по прошлой теме.",
            "Разбейте объяснение на блоки по 5-7 минут и после каждого дайте один вопрос на понимание.",
            "Добавьте работу в парах: один ученик объясняет, второй проверяет решение.",
            "Завершите урок мини-игрой или быстрым практическим кейсом."
          ]
        }
      : engagementAverage < 70
      ? {
          title: "План следующего урока: удержать темп",
          steps: [
            "Сохраните текущий темп и начните с короткого повторения.",
            "В середине урока добавьте групповое задание с распределением ролей.",
            "Для сильных учеников подготовьте один challenge-вопрос.",
            "В конце соберите мини-рефлексию: что было понятно, что еще требует пояснения."
          ]
        }
      : {
          title: "План следующего урока: усилить глубину",
          steps: [
            "Начните с problem-based вопроса без готовой формулы.",
            "Дайте ученикам выбрать способ решения: индивидуально, в паре или у доски.",
            "Добавьте дискуссионный блок или мини-дебаты по теме.",
            "В финале дайте challenge-задание для закрепления на высоком уровне."
          ]
        };

  return {
    summary: {
      classroomCount: classrooms.length,
      studentCount: students.length,
      averageEngagement,
      atRiskCount: atRiskStudents.length
    },
    classrooms: classrooms.map((item) => ({
      id: item.id,
      name: item.name,
      grade: item.grade,
      students: item.enrollments.length
    })),
    students,
    studentProgress: students.map((student) => {
      const latestXp = latestXpByStudent.get(student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        classroomName: student.classroomName,
        currentLevel: latestXp?.level ?? 1,
        recentXp: latestXp?.xp ?? 0,
        lastProgressAt: latestXp?.createdAt.toISOString() ?? null
      };
    }),
    studentProgressChart: students.map((student) => {
      const latestXp = latestXpByStudent.get(student.id);
      return {
        label: student.name.split(" ")[0] ?? student.name,
        xp: latestXp?.xp ?? 0,
        level: latestXp?.level ?? 1,
        attention: student.attention
      };
    }),
    atRiskStudents,
    heatmap,
    homeworkNotifications: recentHomeworkSubmissions.map((item) => ({
      id: item.id,
      studentId: item.userId,
      studentName: students.find((student) => student.id === item.userId)?.name ?? item.userId,
      homeworkTitle: item.homework.title,
      status: item.status,
      aiScore: item.aiScore,
      points: item.homework.points,
      submittedAt: item.submittedAt?.toISOString() ?? null,
      reviewedAt: item.reviewedAt?.toISOString() ?? null
    })),
    recommendations: teacherInsights.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    })),
    recentLessons: recentLessons.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    })),
    nextLessonPlan
  };
}

export async function getSchoolAnalyticsData() {
  const [classrooms, studentCount, teacherCount, recentLessons, eegRows, xpRows] = await Promise.all([
    db.classroom.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        enrollments: {
          select: { studentId: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    db.user.count({ where: { role: UserRole.student } }),
    db.user.count({ where: { role: { in: [UserRole.teacher, UserRole.admin] } } }),
    db.lesson.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        subject: true,
        title: true,
        createdAt: true
      }
    }),
    db.eEGReading.findMany({
      orderBy: { timestamp: "desc" },
      take: 400,
      select: {
        attention: true,
        engagementScore: true,
        timestamp: true
      }
    }),
    db.xPProgress.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      select: { xp: true, createdAt: true }
    })
  ]);

  const engagementSummary = summarizeEEGHistory(
    eegRows.map((row) => ({
      attention: row.attention,
      meditation: row.engagementScore,
      signal: 0,
      engagementScore: row.engagementScore
    }))
  );

  const subjectMap = new Map<string, number>();
  for (const lesson of recentLessons) {
    subjectMap.set(lesson.subject, (subjectMap.get(lesson.subject) ?? 0) + 1);
  }

  const classes = classrooms.map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
    grade: classroom.grade,
    students: classroom.enrollments.length
  }));

  const nextLessonPlan =
    engagementSummary.avgEngagement < 45
      ? {
          focus: "Низкая вовлеченность",
          actions: [
            "Начните урок с короткого интерактивного вопроса или мини-квиза на 2-3 минуты.",
            "Разбейте объяснение на блоки по 5-7 минут с быстрыми проверками понимания.",
            "Добавьте работу в парах или мини-группах с конкретной ролью для каждого ученика.",
            "Смените формат: после теории дайте один наглядный пример и один практический кейс."
          ]
        }
      : engagementSummary.avgEngagement < 70
      ? {
          focus: "Средняя вовлеченность",
          actions: [
            "Сохраните текущий темп, но добавьте одну collaborative activity в середине урока.",
            "Попросите сильных учеников кратко объяснить решение группе.",
            "Используйте один challenge-вопрос в конце каждого смыслового блока."
          ]
        }
      : {
          focus: "Высокая вовлеченность",
          actions: [
            "Можно усложнить следующий урок через problem-based activity или mini debate.",
            "Дайте ученикам больше самостоятельного выбора способа решения.",
            "Добавьте один challenge-level блок для сильных учеников."
          ]
        };

  return {
    summary: {
      totalClasses: classrooms.length,
      totalStudents: studentCount,
      totalTeachers: teacherCount,
      avgEngagement: engagementSummary.avgEngagement,
      avgAttention: engagementSummary.avgAttention
    },
    classes,
    subjects: Array.from(subjectMap.entries()).map(([subject, lessons]) => ({
      subject,
      lessons
    })),
    xpVelocity: xpRows
      .slice(0, 20)
      .reverse()
      .map((row) => ({
        label: row.createdAt.toISOString().slice(11, 16),
        xp: row.xp
      })),
    engagementTimeline: eegRows
      .slice(0, 30)
      .reverse()
      .map((row) => ({
        label: row.timestamp.toISOString().slice(11, 16),
        engagement: row.engagementScore
      })),
    nextLessonPlan
  };
}
