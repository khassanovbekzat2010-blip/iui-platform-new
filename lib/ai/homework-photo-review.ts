import { HomeworkSubmissionStatus } from "@prisma/client";

type HomeworkPhotoReviewInput = {
  homeworkTitle: string;
  homeworkTopic: string;
  homeworkDescription: string;
  imageDataUrl: string;
  studentNote?: string;
};

type HomeworkPhotoReviewOutput = {
  status: HomeworkSubmissionStatus;
  feedback: string;
  score: number;
};

function parseJsonBlock(text: string) {
  const fenced = text.match(/```json([\s\S]*?)```/i);
  const jsonLike = fenced?.[1]?.trim() ?? text;
  const firstBrace = jsonLike.indexOf("{");
  const lastBrace = jsonLike.lastIndexOf("}");
  const raw = firstBrace >= 0 && lastBrace > firstBrace ? jsonLike.slice(firstBrace, lastBrace + 1) : jsonLike;
  return JSON.parse(raw) as {
    score?: number;
    feedback?: string;
    decision?: "ACCEPTED" | "NEEDS_REVISION";
  };
}

function fallbackReview(input: HomeworkPhotoReviewInput): HomeworkPhotoReviewOutput {
  const text = input.studentNote?.trim();
  if (text && text.length > 15) {
    return {
      status: HomeworkSubmissionStatus.UNDER_REVIEW,
      score: 60,
      feedback: "Work received by AI fallback mode. Teacher review is recommended for final grading."
    };
  }
  return {
    status: HomeworkSubmissionStatus.NEEDS_REVISION,
    score: 35,
    feedback: "Image uploaded, but AI fallback could not confidently verify the solution. Please add clearer photo and short explanation."
  };
}

export async function reviewHomeworkFromPhoto(input: HomeworkPhotoReviewInput): Promise<HomeworkPhotoReviewOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackReview(input);
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const prompt = `
You are an AI homework checker.
Evaluate student's work from image against assignment.
Return strict JSON only:
{
  "score": 0..100,
  "decision": "ACCEPTED" or "NEEDS_REVISION",
  "feedback": "short constructive feedback"
}

Assignment title: ${input.homeworkTitle}
Topic: ${input.homeworkTopic}
Task: ${input.homeworkDescription}
Student note: ${input.studentNote ?? "none"}
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
        temperature: 0.1,
        messages: [
          { role: "system", content: "You are a strict homework evaluator. Output JSON only." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: input.imageDataUrl }
              }
            ]
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

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackReview(input);
    }

    const parsed = parseJsonBlock(content);
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
    const decision = parsed.decision === "ACCEPTED" ? HomeworkSubmissionStatus.ACCEPTED : HomeworkSubmissionStatus.NEEDS_REVISION;
    const feedback = parsed.feedback?.trim() || "AI reviewed the solution image.";

    return {
      status: decision,
      score,
      feedback
    };
  } catch {
    return fallbackReview(input);
  }
}

