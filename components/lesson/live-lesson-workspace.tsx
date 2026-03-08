"use client";

import { Activity, Brain, FileText, Mic, Pause, Play, RefreshCcw, Save, Search, Users } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type LessonStatus = "IDLE" | "RECORDING" | "PAUSED" | "SAVED" | "AI_PROCESSING" | "AI_FAILED";
type TabId = "live" | "transcript" | "summary";

type TranscriptLine = {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  important?: boolean;
};

type LessonArchiveItem = {
  id: string;
  title: string;
  subject: string;
  classroomName: string | null;
  aiStatus: "SAVED" | "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
  summary: string | null;
  aiError: string | null;
  durationSec: number;
};

type Participant = {
  id: string;
  name: string;
  email: string;
  state: "online" | "active" | "offline";
};

type BoundDevice = {
  id: string;
  studentId: string;
  deviceName: string;
  isActive: boolean;
  lastSeenAt: string | null;
  updatedAt: string;
};

type LatestReadingResponse = {
  reading: {
    id: string;
    attention: number;
    meditation: number;
    signal: number;
    raw: number;
    engagementScore: number;
    timestamp: string;
    state: string;
    deviceId?: string | null;
  } | null;
};

type MicStatus = "idle" | "ready" | "recording" | "paused" | "denied";

type Props = {
  user: {
    id: string;
    email: string;
    name: string;
    role: "teacher" | "student" | "admin";
    studentId?: string;
  };
  archive: LessonArchiveItem[];
  participants: Participant[];
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function statusLabel(status: LessonStatus) {
  switch (status) {
    case "RECORDING":
      return "Recording";
    case "PAUSED":
      return "Paused";
    case "SAVED":
      return "Saved";
    case "AI_PROCESSING":
      return "AI processing";
    case "AI_FAILED":
      return "AI failed";
    default:
      return "Idle";
  }
}

function statusVariant(status: LessonStatus): "outline" | "warning" | "success" | "danger" {
  if (status === "RECORDING") return "warning";
  if (status === "SAVED") return "success";
  if (status === "AI_FAILED") return "danger";
  return "outline";
}

function parseSummary(summary: string | null) {
  if (!summary) return { text: "", keyTopics: [] as string[], recommendations: [] as string[] };
  try {
    const parsed = JSON.parse(summary) as { text?: string; keyTopics?: string[]; recommendations?: string[] };
    return {
      text: parsed.text ?? "",
      keyTopics: parsed.keyTopics ?? [],
      recommendations: parsed.recommendations ?? []
    };
  } catch {
    return { text: summary, keyTopics: [], recommendations: [] };
  }
}

export function LiveLessonWorkspace({ user, archive, participants }: Props) {
  const isTeacher = user.role === "teacher" || user.role === "admin";
  const pushToast = useAppStore((state) => state.pushToast);

  const [status, setStatus] = useState<LessonStatus>("IDLE");
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<TabId>("live");
  const [lessonTitle, setLessonTitle] = useState("Live Lesson");
  const [subject, setSubject] = useState("Physics");
  const [classroomName, setClassroomName] = useState("Class 9A");
  const [notes, setNotes] = useState("");
  const [transcriptInput, setTranscriptInput] = useState("");
  const [search, setSearch] = useState("");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [keyTopics, setKeyTopics] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [generatedHomework, setGeneratedHomework] = useState<string[]>([]);
  const [aiError, setAiError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(participants.map((item) => item.id));
  const [archiveRows, setArchiveRows] = useState<LessonArchiveItem[]>(archive);
  const [deviceBindings, setDeviceBindings] = useState<BoundDevice[]>([]);
  const [bindStudentId, setBindStudentId] = useState<string>(participants[0]?.id ?? "");
  const [activeStudentId, setActiveStudentId] = useState<string>(participants[0]?.id ?? "");
  const [bindDeviceId, setBindDeviceId] = useState("");
  const [bindDeviceName, setBindDeviceName] = useState("ESP32 TGAM");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [micError, setMicError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [liveTranscriptPreview, setLiveTranscriptPreview] = useState("");
  const [latestReading, setLatestReading] = useState<LatestReadingResponse["reading"] | null>(null);
  const [deviceStreamState, setDeviceStreamState] = useState<"idle" | "paired" | "live" | "stale">("idle");
  const [generatedApiKey, setGeneratedApiKey] = useState("");

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const statusRef = useRef<LessonStatus>("IDLE");

  useEffect(() => {
    if (status !== "RECORDING") {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript.length]);

  useEffect(() => {
    if (!participants.length || bindStudentId) return;
    setBindStudentId(participants[0].id);
  }, [bindStudentId, participants]);

  useEffect(() => {
    if (!participants.length || activeStudentId) return;
    setActiveStudentId(participants[0].id);
  }, [activeStudentId, participants]);

  useEffect(() => {
    if (!isTeacher) return;
    apiRequest<{ devices: BoundDevice[] }>("/api/devices")
      .then((data) => setDeviceBindings(data.devices))
      .catch(() => {
        pushToast("Device list unavailable", "Open Settings or retry later.");
      });
  }, [isTeacher, pushToast]);

  useEffect(() => {
    if (!isTeacher || !activeStudentId) return;

    const eventSource = new EventSource(`/api/realtime/eeg?studentId=${encodeURIComponent(activeStudentId)}`);
    const applyLiveReading = (reading: LatestReadingResponse["reading"]) => {
      if (!reading) return;
      setLatestReading(reading);
      const readingAgeMs = Date.now() - new Date(reading.timestamp).getTime();
      setDeviceStreamState(readingAgeMs <= 10_000 ? "live" : "stale");
    };

    eventSource.addEventListener("snapshot", (event) => {
      const rows = JSON.parse((event as MessageEvent).data) as Array<{
        readingId: string;
        studentId: string;
        attention: number;
        meditation: number;
        signal: number;
        raw: number;
        engagementScore: number;
        state: string;
        timestamp: string;
        deviceId?: string | null;
      }>;

      const row = rows.find((item) => item.studentId === activeStudentId) ?? rows[0];
      if (!row) return;
      applyLiveReading({
        id: row.readingId,
        attention: row.attention,
        meditation: row.meditation,
        signal: row.signal,
        raw: row.raw,
        engagementScore: row.engagementScore,
        state: row.state,
        timestamp: row.timestamp,
        deviceId: row.deviceId
      });
    });

    eventSource.addEventListener("eeg", (event) => {
      const row = JSON.parse((event as MessageEvent).data) as {
        readingId: string;
        studentId: string;
        attention: number;
        meditation: number;
        signal: number;
        raw: number;
        engagementScore: number;
        state: string;
        timestamp: string;
        deviceId?: string | null;
      };

      if (row.studentId !== activeStudentId) return;
      applyLiveReading({
        id: row.readingId,
        attention: row.attention,
        meditation: row.meditation,
        signal: row.signal,
        raw: row.raw,
        engagementScore: row.engagementScore,
        state: row.state,
        timestamp: row.timestamp,
        deviceId: row.deviceId
      });
    });

    let cancelled = false;
    const refreshLatestReading = async () => {
      try {
        const latest = await apiRequest<LatestReadingResponse>(`/api/eeg/latest?studentId=${encodeURIComponent(activeStudentId)}`);
        if (cancelled) return;
        setLatestReading(latest.reading ?? null);

        const pairedDevice = deviceBindings.find((item) => item.studentId === activeStudentId && item.isActive);
        if (!latest.reading) {
          setDeviceStreamState(pairedDevice ? "paired" : "idle");
          return;
        }

        const readingAgeMs = Date.now() - new Date(latest.reading.timestamp).getTime();
        if (readingAgeMs <= 10_000) {
          setDeviceStreamState("live");
        } else {
          setDeviceStreamState(pairedDevice ? "stale" : "idle");
        }
      } catch {
        if (!cancelled) {
          const pairedDevice = deviceBindings.find((item) => item.studentId === activeStudentId && item.isActive);
          setLatestReading(null);
          setDeviceStreamState(pairedDevice ? "paired" : "idle");
        }
      }
    };

    void refreshLatestReading();
    const timer = window.setInterval(() => {
      void refreshLatestReading();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      eventSource.close();
    };
  }, [activeStudentId, deviceBindings, isTeacher]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognitionCtor));
  }, []);

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTranscript = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transcript;
    return transcript.filter((line) => line.text.toLowerCase().includes(q) || line.speaker.toLowerCase().includes(q));
  }, [search, transcript]);

  const participantNameMap = useMemo(() => {
    return new Map(participants.map((item) => [item.id, item.name]));
  }, [participants]);

  const activeStudentName = activeStudentId ? participantNameMap.get(activeStudentId) ?? "Selected student" : "No student selected";
  const activeBoundDevice = deviceBindings.find((item) => item.studentId === activeStudentId && item.isActive) ?? null;

  const appendTranscriptLine = (text: string, speaker = "Teacher") => {
    const normalized = text.trim();
    if (!normalized) return;
    setTranscript((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        speaker,
        text: normalized,
        timestamp: formatDuration(elapsed)
      }
    ]);
  };

  const stopSpeechRecognition = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore browser state errors
    }
    setLiveTranscriptPreview("");
  };

  const startSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ru-RU";
      recognition.onresult = (event) => {
        let interim = "";
        let finalText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const chunk = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            finalText += ` ${chunk}`;
          } else {
            interim += ` ${chunk}`;
          }
        }
        if (finalText.trim()) {
          appendTranscriptLine(finalText, "Teacher");
        }
        setLiveTranscriptPreview(interim.trim());
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          setMicStatus("denied");
          setMicError("Speech recognition permission denied by browser.");
        }
      };
      recognition.onend = () => {
        if (statusRef.current === "RECORDING") {
          window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // browser may throttle fast restarts
            }
          }, 250);
        }
      };
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
    } catch {
      // recognition may already be running
    }
  };

  const startMicrophone = async (startRecordingNow = false) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser does not support microphone access");
    }

    if (!mediaStreamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      setMicStatus("ready");
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
      if (startRecordingNow) {
        mediaRecorderRef.current.start();
        setMicStatus("recording");
        startSpeechRecognition();
      } else {
        setMicStatus("ready");
      }
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      if (startRecordingNow) {
        mediaRecorderRef.current.resume();
        setMicStatus("recording");
        startSpeechRecognition();
      } else {
        setMicStatus("paused");
      }
    }
  };

  const pauseMicrophone = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setMicStatus("paused");
      stopSpeechRecognition();
    }
  };

  const stopMicrophone = () => {
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    setMicStatus("idle");
  };

  const addTranscriptLine = () => {
    if (!transcriptInput.trim()) return;
    appendTranscriptLine(transcriptInput.trim(), isTeacher ? "Teacher" : user.name);
    setTranscriptInput("");
  };

  const markImportant = (lineId: string) => {
    setTranscript((prev) => prev.map((line) => (line.id === lineId ? { ...line, important: true } : line)));
    pushToast("Marked as important", "Added highlight for lesson summary.");
  };

  const handleStart = async () => {
    if (!isTeacher) return;
    if (!activeStudentId) {
      pushToast("No student selected", "Choose the student who is wearing the device.");
      return;
    }
    try {
      await startMicrophone(true);
      setMicError("");
    } catch (error) {
      setMicStatus("denied");
      setMicError(error instanceof Error ? error.message : "Microphone permission denied");
      pushToast("Microphone access required", "Allow microphone to start live lesson recording.");
      return;
    }

    if (status === "PAUSED") {
      setStatus("RECORDING");
      if (mediaRecorderRef.current?.state === "paused") {
        mediaRecorderRef.current.resume();
        setMicStatus("recording");
      }
      pushToast("Lesson resumed");
      return;
    }
    setElapsed(0);
    setTranscript([]);
    setLiveTranscriptPreview("");
    setSummaryText("");
    setKeyTopics([]);
    setRecommendations([]);
    setGeneratedHomework([]);
    setAiError("");
    setCurrentLessonId(null);
    setSelectedParticipantIds([activeStudentId]);
    setStatus("RECORDING");
    pushToast("Lesson started", `Recording is active for ${activeStudentName}.`);
  };

  const handlePause = () => {
    if (!isTeacher || status !== "RECORDING") return;
    pauseMicrophone();
    setStatus("PAUSED");
    pushToast("Lesson paused");
  };

  const stopAndSave = async () => {
    if (!isTeacher || (status !== "RECORDING" && status !== "PAUSED")) return;
    setBusy(true);
    setStatus("AI_PROCESSING");
    try {
      const transcriptForSave = [
        ...transcript,
        ...(liveTranscriptPreview.trim()
          ? [
              {
                id: `preview-${Date.now()}`,
                speaker: "Teacher",
                text: liveTranscriptPreview.trim(),
                timestamp: formatDuration(elapsed)
              } satisfies TranscriptLine
            ]
          : [])
      ];
      setTranscript(transcriptForSave);
      stopSpeechRecognition();
      const data = await apiRequest<{
        lessonId: string;
        aiAvailable: boolean;
        aiError: string | null;
        summary: string;
        keyTopics: string[];
        recommendations: string[];
        generatedHomework: string[];
      }>("/api/lessons", {
        method: "POST",
        body: JSON.stringify({
          title: lessonTitle,
          subject,
          classroomName,
          notes,
          durationSec: elapsed,
          transcript: transcriptForSave.map((line) => ({
            speaker: line.speaker,
            text: line.text,
            timestamp: line.timestamp
          })),
          participantIds: selectedParticipantIds
        })
      });

      setCurrentLessonId(data.lessonId);
      setSummaryText(data.summary);
      setKeyTopics(data.keyTopics);
      setRecommendations(data.recommendations);
      setGeneratedHomework(data.generatedHomework);
      setAiError(data.aiError ?? "");
      setStatus(data.aiAvailable ? "SAVED" : "AI_FAILED");
      pushToast(data.aiAvailable ? "Lesson saved" : "Lesson saved without AI", data.aiAvailable ? "Archive updated." : "AI is temporarily unavailable.");

      const refreshed = await apiRequest<{ lessons: LessonArchiveItem[] }>("/api/lessons");
      setArchiveRows(refreshed.lessons);
    } catch (error) {
      setStatus("AI_FAILED");
      setAiError(error instanceof Error ? error.message : "Failed to save lesson");
      pushToast("Failed to save lesson", error instanceof Error ? error.message : "Request failed");
    } finally {
      stopMicrophone();
      setBusy(false);
    }
  };

  const retryAi = async () => {
    if (!isTeacher || !currentLessonId) return;
    setBusy(true);
    setStatus("AI_PROCESSING");
    try {
      const data = await apiRequest<{
        summary: string;
        keyTopics: string[];
        recommendations: string[];
        generatedHomework: string[];
      }>(`/api/lessons/${currentLessonId}/reprocess`, {
        method: "POST"
      });
      setSummaryText(data.summary);
      setKeyTopics(data.keyTopics);
      setRecommendations(data.recommendations);
      setGeneratedHomework(data.generatedHomework);
      setAiError("");
      setStatus("SAVED");
      pushToast("AI summary updated");
    } catch (error) {
      setStatus("AI_FAILED");
      setAiError(error instanceof Error ? error.message : "Failed to reprocess AI");
      pushToast("AI reprocess failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const publishHomeworkFromLesson = async () => {
    if (!isTeacher || !currentLessonId || !generatedHomework.length) return;
    setBusy(true);
    try {
      await apiRequest("/api/homework/from-lesson", {
        method: "POST",
        body: JSON.stringify({
          lessonId: currentLessonId,
          titlePrefix: "Lesson Homework",
          grade: Number(classroomName.match(/\d+/)?.[0] ?? 9),
          subject,
          tasks: generatedHomework,
          studentIds: selectedParticipantIds
        })
      });
      pushToast("Homework assigned", "Generated tasks were published.");
    } catch (error) {
      pushToast("Failed to assign homework", error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const bindDeviceToStudent = async () => {
    if (!isTeacher) return;
    if (!bindStudentId || !bindDeviceId) {
      pushToast("Bind form is incomplete", "Select student and enter device id.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiRequest<{ generatedApiKey?: string | null }>("/api/devices", {
        method: "POST",
        body: JSON.stringify({
          studentId: bindStudentId,
          deviceId: bindDeviceId.trim(),
          deviceName: bindDeviceName.trim() || "ESP32 TGAM"
        })
      });
      setGeneratedApiKey(response.generatedApiKey ?? "");
      const updated = await apiRequest<{ devices: BoundDevice[] }>("/api/devices");
      setDeviceBindings(updated.devices);
      setActiveStudentId(bindStudentId);
      setSelectedParticipantIds([bindStudentId]);
      pushToast(
        "Device bound",
        response.generatedApiKey
          ? "ESP32 is linked to selected student. Copy the generated API key shown below."
          : "ESP32 is linked to selected student."
      );
    } catch (error) {
      pushToast("Binding failed", error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const enableMicrophone = async () => {
    if (!isTeacher) return;
    try {
      await startMicrophone(false);
      setMicError("");
      pushToast("Microphone enabled", "Permission granted. Press Start to begin lesson recording.");
    } catch (error) {
      setMicStatus("denied");
      setMicError(error instanceof Error ? error.message : "Microphone permission denied");
      pushToast("Microphone denied", "Allow browser microphone permission and retry.");
    }
  };

  const refreshActiveStudentReading = async (studentId: string) => {
    const latest = await apiRequest<LatestReadingResponse>(`/api/eeg/latest?studentId=${encodeURIComponent(studentId)}`);
    setActiveStudentId(studentId);
    setSelectedParticipantIds([studentId]);
    if (latest.reading) {
      const readingAgeMs = Date.now() - new Date(latest.reading.timestamp).getTime();
      setLatestReading(latest.reading);
      setDeviceStreamState(readingAgeMs <= 10_000 ? "live" : "stale");
      pushToast(
        readingAgeMs <= 10_000 ? "ESP32 live" : "ESP32 paired",
        readingAgeMs <= 10_000
          ? `Signal=${latest.reading.signal}, Attention=${latest.reading.attention}, at ${new Date(latest.reading.timestamp).toLocaleTimeString()}`
          : "Device is paired, but no fresh EEG packet was received in the last 10 seconds."
      );
      return;
    }

    setLatestReading(null);
    setDeviceStreamState("paired");
    pushToast("ESP32 paired", "Device is linked, but no EEG data has arrived yet. Start ESP32 and watch Serial Monitor for POST 200.");
  };

  const connectEsp32 = async () => {
    if (!isTeacher) return;
    const targetStudentId = activeStudentId || bindStudentId;
    if (!targetStudentId) {
      pushToast("ESP32 setup", "Select a student first.");
      return;
    }

    const currentDevice = deviceBindings.find((item) => item.studentId === targetStudentId && item.isActive);
    if (!currentDevice) {
      pushToast("No paired device", "Save device binding first, then check the EEG stream.");
      return;
    }

    try {
      await refreshActiveStudentReading(targetStudentId);
    } catch {
      setLatestReading(null);
      setDeviceStreamState("paired");
      pushToast("ESP32 paired", "Waiting for first EEG packet from device.");
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
    { id: "live", label: "Live Feed", icon: <Activity className="h-4 w-4" /> },
    { id: "transcript", label: "Transcript", icon: <FileText className="h-4 w-4" /> },
    { id: "summary", label: "AI Summary", icon: <Brain className="h-4 w-4" /> }
  ];

  return (
    <section className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{lessonTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {subject} | {classroomName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
            <div className="rounded-xl border border-border/60 px-3 py-2 text-sm font-medium">{formatDuration(elapsed)}</div>
            {isTeacher ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void enableMicrophone()} disabled={busy}>
                  Enable Microphone
                </Button>
                <Button size="sm" variant="outline" onClick={() => void connectEsp32()} disabled={busy}>
                  Check EEG Stream
                </Button>
                <Button size="sm" onClick={() => void handleStart()} disabled={busy || status === "RECORDING"}>
                  <Play className="mr-1 h-4 w-4" />
                  Start
                </Button>
                <Button size="sm" variant="outline" onClick={handlePause} disabled={busy || status !== "RECORDING"}>
                  <Pause className="mr-1 h-4 w-4" />
                  Pause
                </Button>
                <Button size="sm" variant="outline" onClick={stopAndSave} disabled={busy || (status !== "RECORDING" && status !== "PAUSED")}>
                  <Save className="mr-1 h-4 w-4" />
                  Stop & Save
                </Button>
                <Button size="sm" onClick={publishHomeworkFromLesson} disabled={busy || !generatedHomework.length || !currentLessonId}>
                  Assign Homework
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => pushToast("Marked", "You marked this lesson as understood.")}>
                  I understood
                </Button>
                <Button size="sm" variant="outline" onClick={() => pushToast("Marked", "Teacher will see that you need support.")}>
                  Need help
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((item) => (
                <Button
                  key={item.id}
                  variant={tab === item.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTab(item.id)}
                  className="gap-1"
                >
                  {item.icon}
                  {item.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tab === "live" ? (
              <div className="space-y-4">
                {isTeacher ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Simple Flow</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 md:grid-cols-3 text-sm">
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="font-medium">Step 1</p>
                        <p className="text-muted-foreground">Student: {activeStudentName}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="font-medium">Step 2</p>
                        <p className="text-muted-foreground">{bindDeviceId ? `ESP32 ${bindDeviceId}` : "Enter deviceId and connect"}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="font-medium">Step 3</p>
                        <p className="text-muted-foreground">{status === "RECORDING" ? "Lesson is recording" : ""}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    Lesson title
                    <Input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} disabled={!isTeacher} />
                  </label>
                  <label className="space-y-1 text-sm">
                    Subject / Class
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!isTeacher} />
                      <Input value={classroomName} onChange={(event) => setClassroomName(event.target.value)} disabled={!isTeacher} />
                    </div>
                  </label>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">What is happening now</CardTitle>
                    <CardDescription>Script, key points, and engagement notes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Lesson plan, key discussion points, and observations..."
                      className="min-h-[120px]"
                    />
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">Engagement</p>
                        <p className="text-xl font-semibold">{latestReading ? `${latestReading.engagementScore}%` : "--"}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">Focus</p>
                        <p className="text-xl font-semibold">{latestReading ? `${latestReading.attention}%` : "--"}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">Signals</p>
                        <p className="text-xl font-semibold">
                          {latestReading ? `Signal ${latestReading.signal}` : deviceStreamState === "paired" ? "Waiting" : "Idle"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {latestReading
                            ? `${latestReading.state} | ${new Date(latestReading.timestamp).toLocaleTimeString()}`
                            : activeBoundDevice
                            ? "Device paired, waiting for first EEG packet."
                            : "Bind ESP32 to the selected student first."}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 p-3 text-sm">
                      <p className="font-medium">Live speech capture</p>
                      <p className="text-muted-foreground">
                        {speechSupported
                          ? liveTranscriptPreview || "Speech recognition is ready. Spoken words will appear here during recording."
                          : "Browser speech recognition is unavailable. Use Chrome or Edge for automatic transcript."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {tab === "transcript" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
                  {speechSupported
                    ? "Automatic transcript is captured from the teacher microphone while lesson recording is active."
                    : "Automatic transcript is unavailable in this browser. You can still add lines manually."}
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search transcript..." value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add transcript line..."
                      value={transcriptInput}
                      onChange={(event) => setTranscriptInput(event.target.value)}
                    />
                    <Button onClick={addTranscriptLine}>
                      <Mic className="mr-1 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
                <div ref={transcriptRef} className="max-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-border/60 p-3">
                  {filteredTranscript.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Transcript will appear here during lesson recording.</p>
                  ) : (
                    filteredTranscript.map((line) => (
                      <div key={line.id} className="rounded-lg border border-border/50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {line.timestamp} | {line.speaker}
                          </p>
                          {!line.important ? (
                            <Button size="sm" variant="outline" onClick={() => markImportant(line.id)}>
                              Mark important
                            </Button>
                          ) : (
                            <Badge variant="success">Important</Badge>
                          )}
                        </div>
                        <p className="text-sm">{line.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {tab === "summary" ? (
              <div className="space-y-3">
                {status === "AI_PROCESSING" ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : null}

                {status === "AI_FAILED" ? (
                  <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-4">
                    <p className="font-medium">AI is temporarily unavailable</p>
                    <p className="text-sm text-muted-foreground">{aiError || "Lesson was saved without summary."}</p>
                    {isTeacher ? (
                      <Button className="mt-3" variant="outline" onClick={retryAi} disabled={busy || !currentLessonId}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Retry processing
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {summaryText ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Structured Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>{summaryText}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Key Concepts</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {keyTopics.map((topic) => (
                          <Badge key={topic} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Questions / Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm text-muted-foreground">
                        {recommendations.map((item) => (
                          <p key={item}>- {item}</p>
                        ))}
                      </CardContent>
                    </Card>
                  </>
                ) : status !== "AI_PROCESSING" && status !== "AI_FAILED" ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                    Save lesson to generate AI summary.
                  </div>
                ) : null}
              </div>
            ) : null}

          </CardContent>
        </Card>

        <div className="space-y-4">
          {isTeacher ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Lesson Student</CardTitle>
                <CardDescription>EEG stream, generated homework, and progress updates are linked to this student.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{activeStudentName}</p>
                <p className="text-muted-foreground">
                  {activeBoundDevice
                    ? `${activeBoundDevice.deviceName} (${activeBoundDevice.id})`
                    : "Pair ESP32 to attach a device and lock the lesson to this student."}
                </p>
                <Badge variant={deviceStreamState === "live" ? "success" : deviceStreamState === "stale" ? "warning" : "outline"}>
                  {deviceStreamState === "live"
                    ? "Live EEG stream"
                    : deviceStreamState === "stale"
                    ? "No fresh EEG now"
                    : deviceStreamState === "paired"
                    ? "Device paired"
                    : "No device"}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!participants.length ? (
                <p className="text-sm text-muted-foreground">No participants found.</p>
              ) : (
                participants.map((item) => (
                  <label key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-2 text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.state === "active" ? "success" : item.state === "offline" ? "danger" : "outline"}>
                        {item.state}
                      </Badge>
                      {isTeacher ? (
                        <Button
                          size="sm"
                          variant={activeStudentId === item.id ? "default" : "outline"}
                          onClick={() => {
                            setActiveStudentId(item.id);
                            setBindStudentId(item.id);
                            setSelectedParticipantIds([item.id]);
                          }}
                        >
                          {activeStudentId === item.id ? "Selected" : "Select"}
                        </Button>
                      ) : null}
                    </div>
                  </label>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Device Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-muted-foreground">
                  {deviceStreamState === "live"
                    ? "Fresh EEG packets are arriving from ESP32."
                    : deviceStreamState === "stale"
                    ? "Device was seen before, but current stream is stale."
                    : deviceStreamState === "paired"
                    ? "Device is paired, waiting for first live packet."
                    : "No paired device for selected student."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {latestReading
                    ? `Last packet: ${new Date(latestReading.timestamp).toLocaleTimeString()} | Attention ${latestReading.attention} | Meditation ${latestReading.meditation}`
                    : `Active bindings: ${deviceBindings.filter((item) => item.isActive).length}`}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-muted-foreground">{micStatus === "recording" ? "Recording" : micStatus === "paused" ? "Paused" : micStatus === "denied" ? "Denied" : "Idle"}</p>
                <p className="text-xs text-muted-foreground">
                  {micError ? micError : "Teacher account must grant mic permission when Start is pressed."}
                </p>
              </div>
              {isTeacher ? (
                <div className="space-y-2 rounded-xl border border-border/60 p-3">
                  <p className="font-medium">Bind ESP32 to Student</p>
                  <p className="text-xs text-muted-foreground">Choose the student wearing the headset. This becomes the active student for the lesson and generated homework.</p>
                  <select
                    value={bindStudentId}
                    onChange={(event) => {
                      setBindStudentId(event.target.value);
                      setActiveStudentId(event.target.value);
                      setSelectedParticipantIds([event.target.value]);
                    }}
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                  >
                    {participants.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <Input placeholder="deviceId (e.g. esp32_device_1)" value={bindDeviceId} onChange={(event) => setBindDeviceId(event.target.value)} />
                  <Input placeholder="Device display name" value={bindDeviceName} onChange={(event) => setBindDeviceName(event.target.value)} />
                  <div className="grid grid-cols-1 gap-2">
                    <Button className="w-full" size="sm" onClick={bindDeviceToStudent} disabled={busy}>
                      Save Device Binding
                    </Button>
                    <Button className="w-full" size="sm" variant="outline" onClick={() => void connectEsp32()} disabled={busy}>
                      Check EEG Stream
                    </Button>
                  </div>
                  <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-2 text-xs text-muted-foreground">
                    Manual API key is no longer required for local paired ESP32 devices.
                  </div>
                  {generatedApiKey ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                      Generated API key: <span className="font-mono text-foreground">{generatedApiKey}</span>
                    </div>
                  ) : null}
                  {deviceBindings.slice(0, 6).map((device) => (
                    <div key={device.id} className="rounded-lg border border-border/60 p-2 text-xs text-muted-foreground">
                      {device.deviceName} | {device.id} | student: {participantNameMap.get(device.studentId) ?? device.studentId} |{" "}
                      {device.isActive ? "active" : "inactive"} | last seen:{" "}
                      {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "never"}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Homework generated from this lesson is assigned to the active student and becomes visible in that student's account immediately after the lesson.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Archive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!archiveRows.length ? <p className="text-sm text-muted-foreground">No saved lessons yet.</p> : null}
          {archiveRows.slice(0, 5).map((item) => {
            const summary = parseSummary(item.summary);
            return (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {item.title} | {item.subject}
                  </p>
                  <Badge
                    variant={
                      item.aiStatus === "READY" ? "success" : item.aiStatus === "FAILED" ? "danger" : item.aiStatus === "PROCESSING" ? "warning" : "outline"
                    }
                  >
                    {item.aiStatus}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                {summary.text ? <p className="mt-1 text-muted-foreground">{summary.text}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
