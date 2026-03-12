"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

type LessonDetailDTO = {
  lesson: {
    id: string;
    title: string;
    subject: string;
    topic: string | null;
    classroomName: string | null;
    aiStatus: "SAVED" | "PROCESSING" | "READY" | "FAILED";
    aiError: string | null;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    durationSec: number;
    notes: string;
    summary: {
      text: string;
      keyTopics: string[];
      recommendations: string[];
      difficultMoments: string[];
      eeg: null | {
        avgAttention: number;
        avgMeditation: number;
        avgSignal: number;
        avgEngagement: number;
        sampleCount: number;
        dropMoments: string[];
      };
    };
    transcript: Array<{
      speaker: string;
      text: string;
      timestamp: string;
    }>;
    participants: Array<{
      id: string;
      userId: string;
      role: string;
      state: string;
      name: string;
      email: string;
    }>;
    homeworks: Array<{
      id: string;
      title: string;
      subject: string;
      topic: string;
      difficulty: string | null;
      dueDate: string;
      generatedByAI: boolean;
      submissions: Array<{
        id: string;
        userId: string;
        status: string;
        textAnswer: string | null;
        aiScore: number | null;
        submittedAt: string | null;
        reviewedAt: string | null;
      }>;
    }>;
    assignments: Array<{
      id: string;
      title: string;
      description: string;
      difficulty: string;
      status: string;
      reason: string | null;
      createdAt: string;
    }>;
  };
};

export default function ArchiveLessonDetailPage() {
  const params = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["archive-lesson-detail", params.id],
    enabled: Boolean(params.id),
    queryFn: () => apiRequest<LessonDetailDTO>(`/api/lessons/${params.id}`)
  });

  if (query.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">Lesson detail is unavailable right now.</p>;
  }

  const { lesson } = query.data;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">{lesson.title}</h2>
          <p className="text-muted-foreground">
            {lesson.subject}
            {lesson.classroomName ? ` | ${lesson.classroomName}` : ""}
            {` | ${new Date(lesson.createdAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={lesson.aiStatus === "READY" ? "success" : lesson.aiStatus === "FAILED" ? "danger" : lesson.aiStatus === "PROCESSING" ? "warning" : "outline"}>
            {lesson.aiStatus}
          </Badge>
          <Link href="/archive">
            <Button variant="outline">Back to Archive</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
            <CardDescription>Lesson-level explanation, next steps, and difficult moments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{lesson.summary.text || lesson.aiError || "No summary available yet."}</p>
            <div className="flex flex-wrap gap-2">
              {lesson.summary.keyTopics.map((topic) => (
                <Badge key={topic} variant="outline">{topic}</Badge>
              ))}
            </div>
            {lesson.summary.recommendations.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Teacher recommendations</p>
                {lesson.summary.recommendations.map((item) => (
                  <p key={item} className="text-sm text-muted-foreground">- {item}</p>
                ))}
              </div>
            ) : null}
            {lesson.summary.difficultMoments.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Difficult moments</p>
                {lesson.summary.difficultMoments.map((item) => (
                  <p key={item} className="text-sm text-muted-foreground">- {item}</p>
                ))}
              </div>
            ) : null}
            {lesson.summary.eeg ? (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-sm font-medium">EEG / TGAM during lesson</p>
                <p className="text-sm text-muted-foreground">
                  Attention {lesson.summary.eeg.avgAttention}% | Meditation {lesson.summary.eeg.avgMeditation}% | Signal {lesson.summary.eeg.avgSignal}% | Engagement {lesson.summary.eeg.avgEngagement}% | Samples {lesson.summary.eeg.sampleCount}
                </p>
                {lesson.summary.eeg.dropMoments.length ? (
                  <div className="space-y-1">
                    {lesson.summary.eeg.dropMoments.map((item) => (
                      <p key={item} className="text-xs text-muted-foreground">- {item}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lesson Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Duration: {Math.round(lesson.durationSec / 60)} min</p>
            <p>Participants: {lesson.participants.length}</p>
            <p>Assignments generated: {lesson.assignments.length}</p>
            <p>Homework generated: {lesson.homeworks.length}</p>
            {lesson.topic ? <p>Topic: {lesson.topic}</p> : null}
            {lesson.notes ? <p className="text-muted-foreground">{lesson.notes}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lesson.participants.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">{item.email}</p>
                <p className="text-xs text-muted-foreground">{item.role} | {item.state}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Generated Homework & Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lesson.homeworks.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant={item.generatedByAI ? "success" : "outline"}>{item.generatedByAI ? "AI" : "Manual"}</Badge>
                </div>
                <p className="text-muted-foreground">{item.subject} | {item.topic} | Due {new Date(item.dueDate).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground">Submissions: {item.submissions.length}</p>
              </div>
            ))}
            {lesson.assignments.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.difficulty} | {item.status}</p>
              </div>
            ))}
            {!lesson.homeworks.length && !lesson.assignments.length ? <p className="text-sm text-muted-foreground">No generated homework or tasks for this lesson yet.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lesson.transcript.length === 0 ? <p className="text-sm text-muted-foreground">Transcript is empty.</p> : null}
          {lesson.transcript.map((line, index) => (
            <div key={`${line.timestamp}-${index}`} className="rounded-xl border border-border/60 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{line.timestamp} | {line.speaker}</p>
              <p>{line.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
