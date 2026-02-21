import { HomeworkItem, LessonAiResult, TranscriptLine } from "@/lib/types";

interface AiInput {
  transcript: TranscriptLine[];
  notes: string;
  dropMoments: string[];
  engagementValues: number[];
}

const STOP_WORDS = new Set([
  "и",
  "в",
  "на",
  "по",
  "для",
  "это",
  "как",
  "что",
  "или",
  "а",
  "но",
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "are",
  "was",
  "were"
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(transcriptText: string) {
  const words = normalize(transcriptText)
    .split(" ")
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
  const score = new Map<string, number>();
  words.forEach((word) => score.set(word, (score.get(word) ?? 0) + 1));
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function extractDifficultMoments(transcript: TranscriptLine[]) {
  const triggers = ["сложно", "трудно", "непонят", "ошибка", "почему", "?"];
  const difficult = transcript
    .filter((line) => triggers.some((token) => line.text.toLowerCase().includes(token)))
    .map((line) => `${line.timestamp} — ${line.text}`);
  return difficult.slice(0, 4);
}

function buildSummary(transcript: TranscriptLine[], keywords: string[], notes: string) {
  const first = transcript[0]?.text ?? "Урок начался с вводного объяснения темы.";
  const second = transcript[1]?.text ?? "Далее класс перешел к разбору примеров.";
  const focus = keywords.slice(0, 4).join(", ");

  return `${first} ${second} Ключевой фокус урока: ${focus || "базовые понятия"}.${
    notes.trim() ? ` Заметка преподавателя: ${notes.trim()}` : ""
  }`;
}

function buildComplexTopics(keywords: string[], difficultMoments: string[]) {
  const baseTopics = keywords.slice(0, 3).map((keyword) => ({
    topic: keyword[0].toUpperCase() + keyword.slice(1),
    explanation: `Повторите тему "${keyword}" на коротком примере и закрепите мини-практикой.`
  }));

  if (!baseTopics.length) {
    baseTopics.push({
      topic: "Базовые определения",
      explanation: "Сформируйте карточки терминов и проверьте понимание через 3 быстрых вопроса."
    });
  }

  if (difficultMoments.length) {
    baseTopics.push({
      topic: "Точки затруднений",
      explanation: "Вернитесь к моментам, где звучали вопросы, и разберите решение пошагово."
    });
  }

  return baseTopics.slice(0, 4);
}

function buildHomework(keywords: string[], avgEngagement: number, dropMoments: string[]): HomeworkItem[] {
  const coreTopic = keywords[0] ?? "основная тема";
  const lowEngagement = avgEngagement < 72 || dropMoments.length >= 2;

  if (lowEngagement) {
    return [
      {
        id: "hw-practice-1",
        title: `Базовая практика по теме "${coreTopic}" (10 коротких заданий)`,
        dueDate: "Mar 03",
        status: "planned"
      },
      {
        id: "hw-practice-2",
        title: "Повторение сложных моментов с пошаговым разбором",
        dueDate: "Mar 04",
        status: "planned"
      }
    ];
  }

  return [
    {
      id: "hw-advanced-1",
      title: `Углубленные задачи по теме "${coreTopic}"`,
      dueDate: "Mar 03",
      status: "planned"
    },
    {
      id: "hw-advanced-2",
      title: "Проектное мини-задание с объяснением решения",
      dueDate: "Mar 05",
      status: "planned"
    }
  ];
}

export function generateLessonAi(input: AiInput): LessonAiResult {
  const transcriptText = input.transcript.map((item) => item.text).join(" ");
  const keywords = extractKeywords(transcriptText);
  const difficultMoments = extractDifficultMoments(input.transcript);
  const avgEngagement =
    input.engagementValues.length > 0
      ? input.engagementValues.reduce((sum, value) => sum + value, 0) / input.engagementValues.length
      : 80;

  const summary = buildSummary(input.transcript, keywords, input.notes);
  const keyTopics = keywords.slice(0, 5);
  const complexTopics = buildComplexTopics(keywords, difficultMoments);
  const homework = buildHomework(keywords, avgEngagement, input.dropMoments);
  const recommendations = [
    difficultMoments.length
      ? `Отдельно повторить сложные места: ${difficultMoments.length}.`
      : "Сложные моменты почти не зафиксированы.",
    avgEngagement < 72
      ? "Добавьте больше практики и короткие контрольные вопросы каждые 7-10 минут."
      : "Сохраняйте текущий темп и добавьте задания на углубление.",
    input.dropMoments.length ? `Спады внимания отмечены в: ${input.dropMoments.join(", ")}.` : "Спады внимания не выявлены."
  ];

  return {
    transcript: input.transcript,
    summary,
    keyTopics,
    difficultMoments,
    complexTopics,
    recommendations,
    homework
  };
}
