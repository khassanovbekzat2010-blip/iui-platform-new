"use client";

import { Brain, Mic, MicOff, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TranscriptLine } from "@/lib/types";
import { useAppStore } from "@/store/app-store";

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechRecognitionResultItem> & { isFinal: boolean }>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatTimeFromStart(startMs: number) {
  const diff = Math.floor((Date.now() - startMs) / 1000);
  return formatClock(diff);
}

function buildFallbackTranscript(notes: string): TranscriptLine[] {
  const text = notes.trim();
  if (!text) {
    return [
      { id: "fallback-1", speaker: "Система", text: "Транскрипт пуст. Добавьте устное объяснение и повторите запись.", timestamp: "00:05" }
    ];
  }
  const parts = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  return parts.slice(0, 6).map((part, index) => ({
    id: `fallback-${index}`,
    speaker: index % 2 === 0 ? "Учитель" : "Ученик",
    text: part,
    timestamp: formatClock((index + 1) * 8)
  }));
}

export function LiveLessonWorkspace() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const lesson = useAppStore((state) => state.lesson);
  const setLessonNotes = useAppStore((state) => state.setLessonNotes);
  const addTranscriptLine = useAppStore((state) => state.addTranscriptLine);
  const startRecording = useAppStore((state) => state.startRecording);
  const stopRecording = useAppStore((state) => state.stopRecording);
  const tickRecording = useAppStore((state) => state.tickRecording);
  const setLessonAnalyzing = useAppStore((state) => state.setLessonAnalyzing);
  const generateLessonResult = useAppStore((state) => state.generateLessonResult);
  const pushToast = useAppStore((state) => state.pushToast);

  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) {
        window.clearInterval(tickIntervalRef.current);
      }
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startRecognition = () => {
    const maybeRecognition =
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

    if (!maybeRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    const recognition = new maybeRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) {
          continue;
        }
        const text = result[0]?.transcript?.trim();
        if (!text) {
          continue;
        }
        addTranscriptLine({
          id: `tr-${Date.now()}-${i}`,
          speaker: text.includes("?") ? "Ученик" : "Учитель",
          text,
          timestamp: formatTimeFromStart(startedAtRef.current)
        });
      }
    };
    recognition.onerror = () => {
      pushToast("Speech-to-text недоступен", "Продолжайте запись, можно использовать заметки как fallback.");
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const onStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.start();

      startRecording();
      startedAtRef.current = Date.now();
      startRecognition();
      pushToast("Запись началась", "Говорите в микрофон для live transcript");
      tickIntervalRef.current = window.setInterval(() => tickRecording(), 1000);
    } catch {
      setHasMicPermission(false);
      pushToast("Ошибка микрофона", "Разрешите доступ к микрофону в браузере.");
    }
  };

  const onStop = async () => {
    if (!mediaRecorderRef.current) {
      return;
    }
    mediaRecorderRef.current.stop();
    recognitionRef.current?.stop();
    stopRecording();

    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const existingTranscript = useAppStore.getState().lesson.transcript;
    if (!existingTranscript.length) {
      buildFallbackTranscript(lesson.notes).forEach((line) => addTranscriptLine(line));
    }

    setLessonAnalyzing(true);
    pushToast("Запись завершена", "AI формирует анализ из transcript...");
    await new Promise((resolve) => setTimeout(resolve, 900));
    generateLessonResult();
    pushToast("AI анализ готов", "Конспект, темы и ДЗ обновлены.");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Live Speech-to-Text</CardTitle>
          <CardDescription>Запись урока и транскрипт в реальном времени</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onStart} disabled={lesson.isRecording || lesson.analyzing}>
              <Mic className="mr-2 h-4 w-4" />
              Start recording
            </Button>
            <Button variant="outline" onClick={onStop} disabled={!lesson.isRecording || lesson.analyzing}>
              <MicOff className="mr-2 h-4 w-4" />
              Stop recording
            </Button>
            <div className="rounded-xl border border-border/60 px-3 py-2 text-sm">{lesson.isRecording ? `REC ${formatClock(lesson.elapsedSeconds)}` : "00:00"}</div>
            {lesson.isRecording ? <span className="text-xs text-rose-500">Идет запись</span> : null}
          </div>

          {hasMicPermission === false ? (
            <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-600 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
              Нет доступа к микрофону.
            </p>
          ) : null}
          {!isSpeechSupported ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
              Браузер не поддерживает Web Speech API. Используется fallback по заметкам.
            </p>
          ) : null}

          <div className="rounded-xl border border-border/50 p-3">
            <p className="mb-2 text-sm font-medium">Transcript</p>
            {lesson.analyzing ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : lesson.transcript.length ? (
              <div className="space-y-2">
                {lesson.transcript.map((line) => (
                  <div key={line.id} className="rounded-lg border border-border/40 p-2.5 transition-opacity duration-200">
                    <p className="text-xs text-muted-foreground">{line.timestamp}</p>
                    <p className="text-sm font-medium">{line.speaker}</p>
                    <p className="text-sm text-muted-foreground">{line.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">После записи появится транскрипт урока.</p>
            )}
          </div>

          <Textarea
            placeholder="Заметки преподавателя..."
            value={lesson.notes}
            onChange={(event) => setLessonNotes(event.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border/50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4 text-primary" />
              EEG Engagement
            </p>
            <p className="mb-2 text-xs text-muted-foreground">{lesson.engagement}% в реальном времени</p>
            <Progress value={lesson.engagement} />
          </div>

          {lesson.summary ? (
            <div className="space-y-2 animate-fade-in-up">
              <div className="rounded-xl border border-border/50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Конспект</p>
                <p className="text-sm text-muted-foreground">{lesson.summary}</p>
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ключевые темы</p>
                <p className="text-sm">{lesson.keyTopics.length ? lesson.keyTopics.join(", ") : "Темы формируются автоматически"}</p>
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Сложные моменты</p>
                {lesson.difficultMoments.length ? (
                  lesson.difficultMoments.map((item) => (
                    <p key={item} className="text-xs text-muted-foreground">
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Явные затруднения в речи не обнаружены.</p>
                )}
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Объяснение сложных тем</p>
                {lesson.complexTopics.map((item) => (
                  <p key={item.topic} className="text-xs text-muted-foreground">
                    {item.topic}: {item.explanation}
                  </p>
                ))}
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Домашнее задание</p>
                {lesson.homework.map((item) => (
                  <p key={item.id} className="text-xs text-muted-foreground">
                    • {item.title}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              После остановки записи AI сформирует конспект, темы и персональное ДЗ.
            </p>
          )}

          <Button className="w-full" disabled={!lesson.homework.length} onClick={() => pushToast("Домашнее задание сгенерировано")}>
            Сгенерировать домашнее задание
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
