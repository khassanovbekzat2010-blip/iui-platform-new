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
  const answerLength = input.studentAnswer.trim().length;
  const hasStructuredAnswer = /[.!?]|1\.|2\.|3\.|потому что|значит|следовательно|формула|себебі|мысалы/i.test(input.studentAnswer);
  const lengthBonus = Math.min(24, Math.floor(answerLength / 10));
  const structureBonus = hasStructuredAnswer ? 12 : 0;
  const score = Math.max(30, Math.min(98, Math.round(ratio * 100) + lengthBonus + structureBonus));
  const accepted = score >= 52 || (answerLength >= 70 && overlap >= 2);
  const idealAnswer = `Нужно кратко и по шагам раскрыть тему "${input.homeworkTopic || input.homeworkTitle}": дать основную мысль, использовать ключевые термины из задания и привести один корректный пример или итоговый вывод.`;

  return {
    status: accepted ? HomeworkSubmissionStatus.ACCEPTED : HomeworkSubmissionStatus.NEEDS_REVISION,
    score,
    feedback: accepted
      ? "Ответ достаточно полный: тема раскрыта, есть логика объяснения и связь с заданием."
      : "Ответ пока слишком общий или не показывает ключевые шаги решения. Добавь объяснение, термины по теме и итоговый вывод.",
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
            content:
              "Ты строгий, но справедливый школьный проверяющий. Верни только JSON с ключами: score, accepted, feedback, idealAnswer. Все поля пиши на русском языке."
          },
          {
            role: "user",
            content: `Название задания: ${input.homeworkTitle}
Тема: ${input.homeworkTopic}
Условие: ${input.homeworkDescription}
Ответ ученика: ${input.studentAnswer}`
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

    const fallback = fallbackReview(input);
    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? fallback.score)));
    return {
      status: parsed.accepted ?? score >= 52 ? HomeworkSubmissionStatus.ACCEPTED : HomeworkSubmissionStatus.NEEDS_REVISION,
      score,
      feedback: parsed.feedback ?? fallback.feedback,
      idealAnswer: parsed.idealAnswer ?? fallback.idealAnswer
    };
  } catch {
    return fallbackReview(input);
  }
}
