import { createRandomTgamSignal, summarizeTgamSignals } from "@/lib/tgam-module";
import { HomeworkItem, LessonAiResult, TranscriptLine } from "@/lib/types";

interface AiInput {
  transcript: TranscriptLine[];
  notes: string;
  dropMoments: string[];
  engagementValues: number[];
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "lesson", "topic"]);

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
  const triggers = ["hard", "difficult", "error", "why", "непонят", "?"];
  return transcript
    .filter((line) => triggers.some((token) => line.text.toLowerCase().includes(token)))
    .map((line) => `${line.timestamp} - ${line.text}`)
    .slice(0, 4);
}

function buildSummary(transcript: TranscriptLine[], keywords: string[], notes: string) {
  const first = transcript[0]?.text ?? "Lesson started with an introduction.";
  const second = transcript[1]?.text ?? "Then students moved to guided examples.";
  const focus = keywords.slice(0, 4).join(", ") || "core concepts";
  return `${first} ${second} Focus topics: ${focus}.${notes.trim() ? ` Teacher notes: ${notes.trim()}` : ""}`;
}

function buildComplexTopics(keywords: string[], difficultMoments: string[]) {
  const topics = keywords.slice(0, 3).map((keyword) => ({
    topic: keyword[0].toUpperCase() + keyword.slice(1),
    explanation: `Review ${keyword} with a short example and check understanding using two quick questions.`
  }));
  if (difficultMoments.length) {
    topics.push({
      topic: "Difficult moments",
      explanation: "Replay difficult fragments and break solution into small steps."
    });
  }
  return topics.slice(0, 4);
}

function buildHomework(keywords: string[], avgEngagement: number, dropMoments: string[]): HomeworkItem[] {
  const coreTopic = keywords[0] ?? "current topic";
  const lowEngagement = avgEngagement < 72 || dropMoments.length >= 2;
  if (lowEngagement) {
    return [
      { id: "hw-1", title: `10 short practice tasks on ${coreTopic}`, dueDate: "Mar 03", status: "planned" },
      { id: "hw-2", title: "Step-by-step review of difficult parts", dueDate: "Mar 04", status: "planned" }
    ];
  }
  return [
    { id: "hw-3", title: `Advanced mixed tasks on ${coreTopic}`, dueDate: "Mar 03", status: "planned" },
    { id: "hw-4", title: "Mini project with explanation", dueDate: "Mar 05", status: "planned" }
  ];
}

export function generateLessonAi(input: AiInput): LessonAiResult {
  const transcriptText = input.transcript.map((item) => item.text).join(" ");
  const keywords = extractKeywords(transcriptText);
  const difficultMoments = extractDifficultMoments(input.transcript);
  const avgEngagement = input.engagementValues.length
    ? input.engagementValues.reduce((sum, value) => sum + value, 0) / input.engagementValues.length
    : 80;

  const tgamSignals = input.engagementValues.map((value, index) => createRandomTgamSignal((value + index) / 10));
  const tgam = summarizeTgamSignals(tgamSignals);

  const summary = `${buildSummary(input.transcript, keywords, input.notes)} TGAM attention ${tgam.attention}%, meditation ${tgam.meditation}%, signal ${tgam.signalQuality}%.`;
  const keyTopics = keywords.slice(0, 5);
  const complexTopics = buildComplexTopics(keywords, difficultMoments);
  const homework = buildHomework(keywords, avgEngagement, input.dropMoments);
  const recommendations = [
    difficultMoments.length ? `Focus on difficult moments: ${difficultMoments.length}.` : "No critical difficult moments detected.",
    avgEngagement < 72
      ? "Add short checkpoints every 7-10 minutes to recover attention."
      : "Current tempo is good, add one deeper challenge task.",
    input.dropMoments.length ? `Attention drops: ${input.dropMoments.join(", ")}.` : "No sharp attention drops.",
    `TGAM trend: attention ${tgam.attention}%, meditation ${tgam.meditation}%.`
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
