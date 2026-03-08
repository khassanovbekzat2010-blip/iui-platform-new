import { HomeworkSubmissionStatus, RecommendationType } from "@prisma/client";

import { db } from "@/lib/db";
import { summarizeEEGHistory } from "@/lib/eeg/metrics";
import { grantFocusXp } from "@/server/iui/gamification.service";

type PersonalizationInput = {
  studentId: string;
  subject: string;
  topic: string;
  grade?: number;
  teacherId?: string;
  lessonId?: string;
  lessonSessionId?: string;
  includeAssignment?: boolean;
  includeHomework?: boolean;
};

type AIPlan = {
  assignment: {
    title: string;
    description: string;
    difficulty: string;
    type: string;
    reason: string;
  };
  homework: {
    title: string;
    content: string;
    difficulty: string;
    reason: string;
  };
  recommendations: Array<{
    recommendationType: RecommendationType;
    content: string;
  }>;
};

function toRecommendationType(value: string): RecommendationType | null {
  if (value === RecommendationType.ADAPTIVE_TASK) return RecommendationType.ADAPTIVE_TASK;
  if (value === RecommendationType.HOMEWORK) return RecommendationType.HOMEWORK;
  if (value === RecommendationType.TEACHER_INSIGHT) return RecommendationType.TEACHER_INSIGHT;
  if (value === RecommendationType.BRAIN_BREAK) return RecommendationType.BRAIN_BREAK;
  if (value === RecommendationType.EXPLANATION) return RecommendationType.EXPLANATION;
  return null;
}

function toJsonBlock(text: string) {
  const fenced = text.match(/```json([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function safeParseAIResponse(raw: string): Partial<AIPlan> | null {
  try {
    return JSON.parse(toJsonBlock(raw)) as Partial<AIPlan>;
  } catch {
    return null;
  }
}

function buildHeuristicPlan(input: PersonalizationInput, context: {
  avgAttention: number;
  avgMeditation: number;
  avgEngagement: number;
  errorRate: number;
}) {
  const lowAttention = context.avgAttention < 45 || context.avgEngagement < 50;
  const highAttention = context.avgAttention >= 72 && context.errorRate <= 0.35;
  const highErrors = context.errorRate >= 0.55;

  const assignmentDifficulty = highAttention ? "challenge" : highErrors || lowAttention ? "basic" : "standard";
  const assignmentType = lowAttention ? "interactive_mini_task" : highAttention ? "problem_solving" : "guided_practice";
  const assignmentReason = lowAttention
    ? "Attention dropped during lesson, short interactive format selected to re-engage."
    : highErrors
    ? "High error rate detected, assignment includes scaffolded steps."
    : "Balanced task generated from EEG and performance profile.";

  const homeworkDifficulty = highAttention ? "advanced" : highErrors || lowAttention ? "easy" : "medium";
  const homeworkReason = lowAttention
    ? "Low sustained attention: homework is shorter and chunked with simple instructions."
    : highErrors
    ? "Frequent errors: homework includes base-level repetition and explanations."
    : "Homework tuned to current pace and concentration.";

  return {
    assignment: {
      title: `${input.subject}: ${input.topic} quick mission`,
      description: lowAttention
        ? "Solve 2 short scenario questions. After each answer, explain your thinking in one sentence."
        : highAttention
        ? "Solve one multi-step applied problem and provide two alternative strategies."
        : "Complete three guided tasks with increasing complexity.",
      difficulty: assignmentDifficulty,
      type: assignmentType,
      reason: assignmentReason
    },
    homework: {
      title: `${input.subject} personalized homework`,
      content: lowAttention
        ? "Part 1: 5-minute recap card. Part 2: 3 core tasks. Part 3: 1 reflective question."
        : highAttention
        ? "Part 1: 4 challenge tasks. Part 2: one open-ended extension challenge."
        : "Part 1: recap. Part 2: 5 practice tasks. Part 3: self-check quiz.",
      difficulty: homeworkDifficulty,
      reason: homeworkReason
    },
    recommendations: [
      {
        recommendationType: lowAttention ? RecommendationType.BRAIN_BREAK : RecommendationType.TEACHER_INSIGHT,
        content: lowAttention
          ? "Trigger a 2-minute brain break and switch to interactive explanation mode."
          : "Keep lesson flow; student remains stable with current pace."
      },
      {
        recommendationType: RecommendationType.ADAPTIVE_TASK,
        content: assignmentReason
      }
    ]
  } satisfies AIPlan;
}

async function tryGenerateWithOpenAI(input: PersonalizationInput, context: {
  avgAttention: number;
  avgMeditation: number;
  avgEngagement: number;
  errorRate: number;
}): Promise<Partial<AIPlan> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const prompt = `
You are an EdTech personalization engine.
Return strict JSON with keys: assignment, homework, recommendations.
No markdown.

Context:
- Subject: ${input.subject}
- Topic: ${input.topic}
- Grade: ${input.grade ?? "unknown"}
- avgAttention: ${context.avgAttention}
- avgMeditation: ${context.avgMeditation}
- avgEngagement: ${context.avgEngagement}
- errorRate: ${context.errorRate}

Rules:
- If avgAttention < 45, generate short interactive assignment and concise homework.
- If errorRate > 0.55, simplify content and add explanations.
- If avgAttention > 72 and errorRate < 0.35, increase challenge level.
- recommendations[].recommendationType must be one of: ADAPTIVE_TASK, HOMEWORK, TEACHER_INSIGHT, BRAIN_BREAK, EXPLANATION
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return safeParseAIResponse(content);
  } catch {
    return null;
  }
}

export async function runPersonalization(input: PersonalizationInput) {
  const eegReadings = await db.eEGReading.findMany({
    where: { studentId: input.studentId },
    orderBy: { timestamp: "desc" },
    take: 40,
    select: {
      attention: true,
      meditation: true,
      signal: true,
      engagementScore: true
    }
  });

  const attempts = await db.attempt.findMany({
    where: { userId: input.studentId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { isCorrect: true }
  });

  const summary = summarizeEEGHistory(eegReadings);
  const incorrect = attempts.filter((item) => !item.isCorrect).length;
  const errorRate = attempts.length ? Number((incorrect / attempts.length).toFixed(2)) : 0.35;

  const heuristicPlan = buildHeuristicPlan(input, {
    avgAttention: summary.avgAttention,
    avgMeditation: summary.avgMeditation,
    avgEngagement: summary.avgEngagement,
    errorRate
  });

  const aiPlan = await tryGenerateWithOpenAI(input, {
    avgAttention: summary.avgAttention,
    avgMeditation: summary.avgMeditation,
    avgEngagement: summary.avgEngagement,
    errorRate
  });

  const aiRecommendations =
    aiPlan?.recommendations?.map((item) => {
      const type = item?.recommendationType ? toRecommendationType(String(item.recommendationType)) : null;
      if (!type || !item?.content) return null;
      return {
        recommendationType: type,
        content: item.content
      };
    }).filter((item): item is AIPlan["recommendations"][number] => Boolean(item)) ?? [];

  const mergedPlan: AIPlan = {
    assignment: {
      ...heuristicPlan.assignment,
      ...aiPlan?.assignment
    },
    homework: {
      ...heuristicPlan.homework,
      ...aiPlan?.homework
    },
    recommendations: aiRecommendations.length ? aiRecommendations : heuristicPlan.recommendations
  };

  const created = await db.$transaction(async (tx) => {
    let assignmentId: string | null = null;
    if (input.includeAssignment ?? true) {
      const assignment = await tx.assignment.create({
        data: {
          studentId: input.studentId,
          lessonId: input.lessonId ?? null,
          lessonSessionId: input.lessonSessionId ?? null,
          title: mergedPlan.assignment.title,
          description: mergedPlan.assignment.description,
          difficulty: mergedPlan.assignment.difficulty,
          generatedByAI: true,
          type: mergedPlan.assignment.type,
          reason: mergedPlan.assignment.reason
        },
        select: { id: true }
      });
      assignmentId = assignment.id;
    }

    const recommendationRows = [];
    for (const recommendation of mergedPlan.recommendations) {
      const createdRecommendation = await tx.aIRecommendation.create({
        data: {
          studentId: input.studentId,
          teacherId: input.teacherId ?? null,
          lessonSessionId: input.lessonSessionId ?? null,
          recommendationType: recommendation.recommendationType,
          content: recommendation.content,
          payload: JSON.stringify({
            source: "ai_personalization_engine",
            subject: input.subject,
            topic: input.topic
          })
        },
        select: { id: true, recommendationType: true, content: true }
      });
      recommendationRows.push(createdRecommendation);
    }

    let homeworkId: string | null = null;
    if (input.includeHomework ?? true) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      const homework = await tx.homework.create({
        data: {
          createdBy: input.teacherId ?? input.studentId,
          studentId: input.studentId,
          lessonId: input.lessonId ?? null,
          title: mergedPlan.homework.title,
          subject: input.subject,
          grade: input.grade ?? 7,
          topic: input.topic,
          description: mergedPlan.homework.reason,
          content: mergedPlan.homework.content,
          generatedByAI: true,
          difficulty: mergedPlan.homework.difficulty,
          dueDate,
          points: 10
        },
        select: { id: true }
      });
      homeworkId = homework.id;
      await tx.homeworkSubmission.upsert({
        where: {
          homeworkId_userId: {
            homeworkId: homework.id,
            userId: input.studentId
          }
        },
        create: {
          homeworkId: homework.id,
          userId: input.studentId,
          status: HomeworkSubmissionStatus.NOT_STARTED
        },
        update: {}
      });
    }

    return {
      assignmentId,
      homeworkId,
      recommendations: recommendationRows
    };
  });

  if (summary.avgAttention >= 70) {
    await grantFocusXp({
      studentId: input.studentId,
      xp: 3,
      source: "EEG_ATTENTION",
      reason: "High sustained attention during lesson segment"
    });
  }

  return {
    metrics: {
      avgAttention: summary.avgAttention,
      avgMeditation: summary.avgMeditation,
      avgEngagement: summary.avgEngagement,
      errorRate
    },
    generated: {
      assignmentId: created.assignmentId,
      homeworkId: created.homeworkId,
      recommendationCount: created.recommendations.length
    },
    plan: mergedPlan
  };
}
