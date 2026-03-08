"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Brain, Flame, Sparkles, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type StudentDashboardDTO = {
  student: { id: string; name: string; email: string; grade: number | null };
  hero: { avatar: string; level: number; xp: number; streak: number };
  eeg: {
    latest: {
      id: string;
      attention: number;
      meditation: number;
      signal: number;
      raw: number;
      engagementScore: number;
      state: string;
      timestamp: string;
    } | null;
    summary: {
      avgAttention: number;
      avgMeditation: number;
      avgSignal: number;
      avgEngagement: number;
    };
    history: Array<{
      id: string;
      attention: number;
      meditation: number;
      signal: number;
      raw: number;
      engagementScore: number;
      state: string;
      timestamp: string;
    }>;
    adaptiveHint: string;
  };
  assignments: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: string;
    type: string;
    status: string;
    reason: string | null;
    createdAt: string;
  }>;
  homeworks: Array<{
    id: string;
    title: string;
    subject: string;
    topic: string;
    difficulty: string | null;
    dueDate: string;
    generatedByAI: boolean;
  }>;
  recommendations: Array<{
    id: string;
    recommendationType: string;
    content: string;
    createdAt: string;
  }>;
  missions: Array<{
    id: string;
    title: string;
    status: string;
    rewardXp: number;
    dueAt: string | null;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    code: string;
    unlockedAt: string;
  }>;
};

type LiveReading = StudentDashboardDTO["eeg"]["latest"];

export default function DashboardPage() {
  const user = useAppStore((state) => state.authUser);
  const [liveReading, setLiveReading] = useState<LiveReading>(null);

  const studentQuery = useQuery({
    queryKey: ["student-dashboard"],
    enabled: user?.role === "student",
    queryFn: () => apiRequest<StudentDashboardDTO>("/api/student/dashboard")
  });

  useEffect(() => {
    if (studentQuery.data?.eeg.latest) {
      setLiveReading(studentQuery.data.eeg.latest);
    }
  }, [studentQuery.data?.eeg.latest]);

  useEffect(() => {
    if (user?.role !== "student") return;
    const eventSource = new EventSource("/api/realtime/eeg");

    eventSource.addEventListener("snapshot", (event) => {
      const rows = JSON.parse((event as MessageEvent).data) as Array<{
        studentId: string;
        attention: number;
        meditation: number;
        signal: number;
        raw: number;
        engagementScore: number;
        state: string;
        timestamp: string;
        readingId: string;
      }>;
      const first = rows[0];
      if (!first) return;
      setLiveReading({
        id: first.readingId,
        attention: first.attention,
        meditation: first.meditation,
        signal: first.signal,
        raw: first.raw,
        engagementScore: first.engagementScore,
        state: first.state,
        timestamp: first.timestamp
      });
    });

    eventSource.addEventListener("eeg", (event) => {
      const reading = JSON.parse((event as MessageEvent).data) as {
        readingId: string;
        attention: number;
        meditation: number;
        signal: number;
        raw: number;
        engagementScore: number;
        state: string;
        timestamp: string;
      };
      setLiveReading({
        id: reading.readingId,
        attention: reading.attention,
        meditation: reading.meditation,
        signal: reading.signal,
        raw: reading.raw,
        engagementScore: reading.engagementScore,
        state: reading.state,
        timestamp: reading.timestamp
      });
    });

    return () => {
      eventSource.close();
    };
  }, [user?.role]);

  const chartData = (studentQuery.data?.eeg.history ?? []).map((row) => ({
    label: row.timestamp.slice(11, 19),
    value: row.attention
  }));

  if (user?.role === "teacher" || user?.role === "admin") {
    return (
      <section className="space-y-4">
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Teacher Workspace</h2>
        <p className="text-muted-foreground">Open the classroom control panel for live EEG and AI analytics.</p>
        <Link href="/teacher">
          <Button>Open Teacher Dashboard</Button>
        </Link>
      </section>
    );
  }

  if (studentQuery.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </section>
    );
  }

  if (studentQuery.isError || !studentQuery.data) {
    return <p className="text-sm text-muted-foreground">Student dashboard is unavailable right now.</p>;
  }

  const data = studentQuery.data;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Student Neuro Dashboard</h2>
        <p className="text-muted-foreground">
          Live EEG attention stream, AI tasks, hero journey progression, and adaptive lesson actions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Activity className="h-4 w-4" />Attention</CardDescription>
            <CardTitle>{liveReading?.attention ?? data.eeg.summary.avgAttention}%</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">State: {liveReading?.state ?? "No signal"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Brain className="h-4 w-4" />Meditation</CardDescription>
            <CardTitle>{liveReading?.meditation ?? data.eeg.summary.avgMeditation}%</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Signal: {liveReading?.signal ?? data.eeg.summary.avgSignal}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Swords className="h-4 w-4" />Hero Journey</CardDescription>
            <CardTitle>Lvl {data.hero.level}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>XP: {data.hero.xp}</p>
            <Progress value={(data.hero.xp % 120) / 1.2} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Flame className="h-4 w-4" />Streak</CardDescription>
            <CardTitle>{data.hero.streak} days</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Engagement avg: {data.eeg.summary.avgEngagement}%</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Attention Timeline</CardTitle>
          <CardDescription>Realtime history from EEG sensor stream.</CardDescription>
        </CardHeader>
        <CardContent>
          <EngagementLineChart data={chartData} xKey="label" yKey="value" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />AI Personal Tasks</CardTitle>
            <CardDescription>Generated from EEG, errors, pace and lesson context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.assignments.map((task) => (
              <div key={task.id} className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground">{task.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.type} | {task.difficulty} | {task.status}
                </p>
                {task.reason ? <p className="mt-2 text-xs text-primary">{task.reason}</p> : null}
              </div>
            ))}
            {!data.assignments.length ? <p className="text-sm text-muted-foreground">No generated assignments yet.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Adaptive Hint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{data.eeg.adaptiveHint}</p>
            <Link href="/lesson">
              <Button variant="outline" className="w-full">Open Live Lesson</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Personal Homework</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.homeworks.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">{item.subject}: {item.topic}</p>
                <p className="text-xs text-muted-foreground">Difficulty: {item.difficulty ?? "adaptive"}</p>
                <p className="text-xs text-muted-foreground">Due: {item.dueDate.slice(0, 10)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily Challenges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.missions.map((mission) => (
              <div key={mission.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{mission.title}</p>
                <p className="text-muted-foreground">{mission.status}</p>
                <p className="text-xs text-muted-foreground">Reward: {mission.rewardXp} XP</p>
              </div>
            ))}
            {!data.missions.length ? <p className="text-sm text-muted-foreground">No active missions.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" />Achievements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.achievements.map((achievement) => (
              <div key={achievement.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{achievement.title}</p>
                <p className="text-xs text-muted-foreground">{achievement.code}</p>
              </div>
            ))}
            {!data.achievements.length ? <p className="text-sm text-muted-foreground">First achievement is waiting.</p> : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
