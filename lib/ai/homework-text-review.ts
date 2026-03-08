import { HomeworkSubmissionStatus } from "@prisma/client";

type Input = {
  homeworkTitle: string;
  homeworkTopic: string;
  homeworkDescription: string;
  studentAnswer: string;
};

type Output = {
  status: HomeworkSubmissionStatus;
  score: number;
  feedback: string;
  idealAnswer: string;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яәіңғүұқөһ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function fallbackReview(input: Input): Output {
  const referenceTokens = Array.from(
    new Set(normalize(`${input.homeworkTitle} ${input.homeworkTopic} ${input.homeworkDescription}`))
  );
  const answerTokens = Array.from(new Set(normalize(input.studentAnswer)));
  const overlap = answerTokens.filter((token) => referenceTokens.includes(token)).length;
  const ratio = referenceTokens.length ? overlap / referenceTokens.length : 0;
  const lengthBonus = Math.min(20, Math.floor(input.studentAnswer.trim().length / 12));
  const score = Math.max(25, Math.min(96, Math.round(ratio * 100) + lengthBonus));
  const accepted = score >= 65;
  const idealAnswer = `Нужно кратко и по пунктам объяснить тему "${input.homeworkTopic || input.homeworkTitle}", использовать ключевые понятия из задания и привести хотя бы один корректный пример или вывод.`;

  return {
    status: accepted ? HomeworkSubmissionStatus.ACCEPTED : HomeworkSubmissionStatus.NEEDS_REVISION,
    score,
    feedback: accepted
      ? "Ответ достаточно полный. Основная логика и тема раскрыты корректно."
      : "Ответ пока слишком общий или не покрывает ключевые элементы задания.",
    idealAnswer
  };
}

export async function reviewHomeworkText(input: Input): Promise<Output> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackReview(input);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a strict homework evaluator. Return JSON only with keys: score, accepted, feedback, idealAnswer."
          },
          {
            role: "user",
            content: `Homework title: ${input.homeworkTitle}
Topic: ${input.homeworkTopic}
Task: ${input.homeworkDescription}
Student answer: ${input.studentAnswer}`
          }
        ]
      })
    });

    if (!response.ok) {
      return fallbackReview(input);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    const raw = firstBrace >= 0 && lastBrace > firstBrace ? content.slice(firstBrace, lastBrace + 1) : content;
    const parsed = JSON.parse(raw) as {
      score?: number;
      accepted?: boolean;
      feedback?: string;
      idealAnswer?: string;
    };

    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
    return {
      status: parsed.accepted ? HomeworkSubmissionStatus.ACCEPTED : HomeworkSubmissionStatus.NEEDS_REVISION,
      score,
      feedback: parsed.feedback ?? fallbackReview(input).feedback,
      idealAnswer: parsed.idealAnswer ?? fallbackReview(input).idealAnswer
    };
  } catch {
    return fallbackReview(input);
  }
}
