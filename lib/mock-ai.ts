import { HomeworkItem, LessonAiResult, TranscriptLine } from "@/lib/types";

interface AiInput {
  transcript: TranscriptLine[];
  notes: string;
  dropMoments: string[];
  engagementValues: number[];
  eegSummary?: {
    avgAttention: number;
    avgMeditation: number;
    avgSignal: number;
    avgEngagement: number;
    sampleCount: number;
  };
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "lesson",
  "topic",
  "это",
  "этот",
  "тема",
  "урок"
]);

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function extractKeywords(transcriptText: string) {
  const words = normalize(transcriptText)
    .split(" ")
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
  const score = new Map<string, number>();
  words.forEach((word) => score.set(word, (score.get(word) ?? 0) + 1));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
}

function extractDifficultMoments(transcript: TranscriptLine[]) {
  const triggers = ["hard", "difficult", "error", "why", "непонят", "ошиб", "?"];
  return transcript
    .filter((line) => triggers.some((token) => line.text.toLowerCase().includes(token)))
    .map((line) => `${line.timestamp} - ${line.text}`)
    .slice(0, 4);
}

function buildSummary(transcript: TranscriptLine[], keywords: string[], notes: string) {
  const first = transcript[0]?.text ?? "Урок начался с введения в тему.";
  const second = transcript[1]?.text ?? "Затем преподаватель перешел к разбору примеров.";
  const focus = keywords.slice(0, 4).join(", ") || "ключевые понятия урока";
  return `${first} ${second} Основные темы: ${focus}.${notes.trim() ? ` Заметки учителя: ${notes.trim()}` : ""}`;
}

function buildComplexTopics(keywords: string[], difficultMoments: string[]) {
  const topics = keywords.slice(0, 3).map((keyword) => ({
    topic: keyword[0].toUpperCase() + keyword.slice(1),
    explanation: `Повтори тему "${keyword}" через короткий пример и проверь понимание двумя быстрыми вопросами.`
  }));
  if (difficultMoments.length) {
    topics.push({
      topic: "Сложные моменты урока",
      explanation: "Вернись к сложным фрагментам и разбей решение на маленькие шаги."
    });
  }
  return topics.slice(0, 4);
}

function buildHomework(keywords: string[], avgEngagement: number, dropMoments: string[]): HomeworkItem[] {
  const coreTopic = keywords[0] ?? "текущая тема";
  const lowEngagement = avgEngagement < 72 || dropMoments.length >= 2;
  if (lowEngagement) {
    return [
      { id: "hw-1", title: `Короткая практика по теме «${coreTopic}»`, dueDate: "Скоро", status: "planned" },
      { id: "hw-2", title: "Пошаговый разбор сложных моментов", dueDate: "Скоро", status: "planned" }
    ];
  }
  return [
    { id: "hw-3", title: `Углубленные задания по теме «${coreTopic}»`, dueDate: "Скоро", status: "planned" },
    { id: "hw-4", title: "Мини-проект с объяснением решения", dueDate: "Скоро", status: "planned" }
  ];
}

export function generateLessonAi(input: AiInput): LessonAiResult {
  const transcriptText = input.transcript.map((item) => item.text).join(" ");
  const keywords = extractKeywords(transcriptText);
  const difficultMoments = extractDifficultMoments(input.transcript);
  const avgEngagement = input.eegSummary?.avgEngagement
    ?? (input.engagementValues.length
      ? input.engagementValues.reduce((sum, value) => sum + value, 0) / input.engagementValues.length
      : 0);

  const summarySuffix = input.eegSummary?.sampleCount
    ? ` Реальные EEG-данные урока: внимание ${input.eegSummary.avgAttention}%, медитация ${input.eegSummary.avgMeditation}%, качество сигнала ${input.eegSummary.avgSignal}%, вовлеченность ${input.eegSummary.avgEngagement}% по ${input.eegSummary.sampleCount} измерениям.`
    : " Реальные EEG-данные урока не были сохранены, поэтому вывод основан только на транскрипте и заметках.";

  const summary = `${buildSummary(input.transcript, keywords, input.notes)}${summarySuffix}`;
  const keyTopics = keywords.slice(0, 5);
  const complexTopics = buildComplexTopics(keywords, difficultMoments);
  const homework = buildHomework(keywords, avgEngagement, input.dropMoments);
  const recommendations = [
    difficultMoments.length ? `Зафиксировано сложных моментов: ${difficultMoments.length}.` : "Критичных затруднений по ходу урока не обнаружено.",
    avgEngagement < 72
      ? "Добавь короткие точки проверки каждые 7-10 минут, чтобы возвращать внимание класса."
      : "Темп урока хороший: можно добавить один более сложный челлендж в конце.",
    input.dropMoments.length ? `Падения внимания: ${input.dropMoments.join(", ")}.` : "Резких провалов внимания не зафиксировано.",
    input.eegSummary?.sampleCount
      ? `TGAM-тренд: внимание ${input.eegSummary.avgAttention}%, медитация ${input.eegSummary.avgMeditation}%, сигнал ${input.eegSummary.avgSignal}%, вовлеченность ${input.eegSummary.avgEngagement}%.`
      : "TGAM-тренд недоступен, потому что к уроку не были привязаны реальные EEG-измерения."
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
