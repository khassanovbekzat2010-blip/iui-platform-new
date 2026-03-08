import { generateLessonAi } from "@/lib/mock-ai";
import { TranscriptLine } from "@/lib/types";

type LessonAiInput = {
  transcript: TranscriptLine[];
  notes: string;
  dropMoments?: string[];
  engagementValues?: number[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error("AI processing timeout"));
      }, timeoutMs);
    })
  ]);
}

function parseJsonFromModel(text: string) {
  const fenced = text.match(/```json([\s\S]*?)```/i);
  const jsonLike = fenced?.[1]?.trim() ?? text;
  const firstBrace = jsonLike.indexOf("{");
  const lastBrace = jsonLike.lastIndexOf("}");
  const raw = firstBrace >= 0 && lastBrace > firstBrace ? jsonLike.slice(firstBrace, lastBrace + 1) : jsonLike;
  return JSON.parse(raw) as {
    summary?: string;
    keyTopics?: string[];
    difficultMoments?: string[];
    complexTopics?: Array<{ topic: string; explanation: string }>;
    recommendations?: string[];
    homework?: Array<{ title: string; dueDate?: string; status?: "planned" | "in-progress" | "done" }>;
  };
}

async function generateLessonAiWithOpenAI(input: LessonAiInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const prompt = `
You are an AI teaching assistant for an EdTech platform.
Return JSON only.
Keys:
- summary (string)
- keyTopics (string[])
- difficultMoments (string[])
- complexTopics (array of {topic, explanation})
- recommendations (string[])
- homework (array of {title, dueDate, status})

Transcript:
${input.transcript.map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`).join("\n")}

Teacher notes:
${input.notes || "No additional notes"}

Attention drops:
${(input.dropMoments ?? []).join(", ") || "none"}

Engagement values:
${(input.engagementValues ?? []).join(", ") || "none"}
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
          { role: "system", content: "Output only strict JSON without markdown." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = parseJsonFromModel(content);
    if (!parsed.summary) return null;

    return {
      transcript: input.transcript,
      summary: parsed.summary,
      keyTopics: parsed.keyTopics ?? [],
      difficultMoments: parsed.difficultMoments ?? [],
      complexTopics: parsed.complexTopics ?? [],
      recommendations: parsed.recommendations ?? [],
      homework: (parsed.homework ?? []).map((item, index) => ({
        id: `ai-hw-${index + 1}`,
        title: item.title,
        dueDate: item.dueDate ?? "Soon",
        status: item.status ?? "planned"
      }))
    };
  } catch {
    return null;
  }
}

export async function processLessonAi(input: LessonAiInput) {
  const providerDisabled = process.env.AI_PROVIDER === "disabled";
  if (providerDisabled) {
    throw new Error("AI provider is temporarily unavailable");
  }

  return withTimeout(
    Promise.resolve().then(async () => {
      const openAiResult = await generateLessonAiWithOpenAI(input);
      if (openAiResult) return openAiResult;

      return generateLessonAi({
        transcript: input.transcript,
        notes: input.notes,
        dropMoments: input.dropMoments ?? [],
        engagementValues: input.engagementValues ?? []
      });
    }),
    8000
  );
}
