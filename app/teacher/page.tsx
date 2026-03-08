"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, Radar, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type TeacherDashboardDTO = {
  summary: {
    classroomCount: number;
    studentCount: number;
    averageEngagement: number;
    atRiskCount: number;
  };
  classrooms: Array<{ id: string; name: string; grade: number; students: number }>;
  students: Array<{
    id: string;
    name: string;
    grade: number;
    classroomId: string;
    classroomName: string;
    attention: number;
    meditation: number;
    signal: number;
    engagementScore: number;
    state: string;
    timestamp: string | null;
  }>;
  atRiskStudents: Array<{ id: string; name: string; reason: string }>;
  heatmap: Array<{
    studentId: string;
    studentName: string;
    classroomName: string;
    attention: number;
    engagementScore: number;
  }>;
  studentProgress: Array<{
    studentId: string;
    studentName: string;
    classroomName: string;
    currentLevel: number;
    recentXp: number;
    lastProgressAt: string | null;
  }>;
  homeworkNotifications: Array<{
    id: string;
    studentId: string;
    studentName: string;
    homeworkTitle: string;
    status: string;
    aiScore: number | null;
    points: number;
    submittedAt: string | null;
    reviewedAt: string | null;
  }>;
  recommendations: Array<{
    id: string;
    studentId: string;
    recommendationType: string;
    content: string;
    createdAt: string;
  }>;
  recentLessons: Array<{
    id: string;
    title: string;
    subject: string;
    aiStatus: string;
    aiError: string | null;
    summary: string | null;
    createdAt: string;
    durationSec: number;
  }>;
};

export default function TeacherPage() {
  const user = useAppStore((state) => state.authUser);
  const [liveRows, setLiveRows] = useState<TeacherDashboardDTO["students"]>([]);

  const query = useQuery({
    queryKey: ["teacher-dashboard"],
    enabled: user?.role === "teacher" || user?.role === "admin",
    queryFn: () => apiRequest<TeacherDashboardDTO>("/api/teacher/dashboard")
  });

  useEffect(() => {
    if (query.data?.students) {
      setLiveRows(query.data.students);
    }
  }, [query.data?.students]);

  useEffect(() => {
    if (user?.role !== "teacher" && user?.role !== "admin") return;
    const eventSource = new EventSource("/api/realtime/eeg");

    const applyEvent = (incoming: {
      studentId: string;
      attention: number;
      meditation: number;
      signal: number;
      engagementScore: number;
      state: string;
      timestamp: string;
    }) => {
      setLiveRows((prev) =>
        prev.map((row) =>
          row.id === incoming.studentId
            ? {
                ...row,
                attention: incoming.attention,
                meditation: incoming.meditation,
                signal: incoming.signal,
                engagementScore: incoming.engagementScore,
                state: incoming.state,
                timestamp: incoming.timestamp
              }
            : row
        )
      );
    };

    eventSource.addEventListener("snapshot", (event) => {
      const rows = JSON.parse((event as MessageEvent).data) as Array<{
        studentId: string;
        attention: number;
        meditation: number;
        signal: number;
        engagementScore: number;
        state: string;
        timestamp: string;
      }>;
      for (const row of rows) {
        applyEvent(row);
      }
    });

    eventSource.addEventListener("eeg", (event) => {
      const reading = JSON.parse((event as MessageEvent).data) as {
        studentId: string;
        attention: number;
        meditation: number;
        signal: number;
        engagementScore: number;
        state: string;
        timestamp: string;
      };
      applyEvent(reading);
    });

    return () => {
      eventSource.close();
    };
  }, [user?.role]);

  const trendData = liveRows.slice(0, 20).map((row, index) => ({
    label: `${index + 1}`,
    value: row.attention
  }));

  if (user?.role !== "teacher" && user?.role !== "admin") {
    return <p className="text-sm text-muted-foreground">This page is available only for teacher/admin.</p>;
  }

  if (query.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">Teacher dashboard is unavailable right now.</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Teacher EEG Command Center</h2>
        <p className="text-muted-foreground">Live classroom attention, heatmap, at-risk alerts and AI guidance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" />Students</CardDescription>
            <CardTitle>{query.data.summary.studentCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Brain className="h-4 w-4" />Avg Engagement</CardDescription>
            <CardTitle>{Math.round(liveRows.reduce((acc, row) => acc + row.engagementScore, 0) / Math.max(1, liveRows.length))}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Radar className="h-4 w-4" />Classrooms</CardDescription>
            <CardTitle>{query.data.summary.classroomCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />At Risk</CardDescription>
            <CardTitle>{liveRows.filter((row) => row.attention > 0 && row.attention < 40).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Classroom Attention</CardTitle>
          <CardDescription>Realtime view from EEG devices bound to students.</CardDescription>
        </CardHeader>
        <CardContent>
          <EngagementLineChart data={trendData} xKey="label" yKey="value" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Attention Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {liveRows.map((student) => (
              <div
                key={student.id}
                className="rounded-xl border border-border/60 p-3"
                style={{
                  background:
                    student.attention >= 70
                      ? "linear-gradient(120deg, rgba(16,185,129,0.22), transparent)"
                      : student.attention >= 45
                      ? "linear-gradient(120deg, rgba(245,158,11,0.2), transparent)"
                      : "linear-gradient(120deg, rgba(239,68,68,0.2), transparent)"
                }}
              >
                <p className="font-medium">{student.name}</p>
                <p className="text-sm text-muted-foreground">{student.classroomName}</p>
                <p className="mt-1 text-sm">Attention: {student.attention}%</p>
                <p className="text-xs text-muted-foreground">State: {student.state}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Teacher Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {query.data.recommendations.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">{item.recommendationType}</p>
                <p className="text-muted-foreground">{item.content}</p>
              </div>
            ))}
            {!query.data.recommendations.length ? <p className="text-muted-foreground">No AI insights yet.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Homework Notifications</CardTitle>
            <CardDescription>New submissions, AI checks and review queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {query.data.homeworkNotifications.length === 0 ? <p className="text-muted-foreground">No homework activity yet.</p> : null}
            {query.data.homeworkNotifications.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.studentName}</p>
                  <span className="text-xs text-muted-foreground">{item.status}</span>
                </div>
                <p className="text-muted-foreground">{item.homeworkTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {item.submittedAt ? `Submitted ${new Date(item.submittedAt).toLocaleString()}` : "Waiting for submission"}
                  {typeof item.aiScore === "number" ? ` | AI ${item.aiScore}/100` : ""}
                  {` | Reward ${item.points} XP`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Progress Feed</CardTitle>
            <CardDescription>Latest level and XP changes across your classes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {query.data.studentProgress.length === 0 ? <p className="text-muted-foreground">No progress events yet.</p> : null}
            {query.data.studentProgress.map((item) => (
              <div key={item.studentId} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.studentName}</p>
                  <span className="text-xs text-muted-foreground">Lvl {item.currentLevel}</span>
                </div>
                <p className="text-muted-foreground">{item.classroomName}</p>
                <p className="text-xs text-muted-foreground">
                  Recent XP: {item.recentXp}
                  {item.lastProgressAt ? ` | ${new Date(item.lastProgressAt).toLocaleString()}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Lesson Analysis</CardTitle>
          <CardDescription>Archive-ready summaries and post-lesson processing results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {query.data.recentLessons.length === 0 ? <p className="text-muted-foreground">No saved lessons yet.</p> : null}
          {query.data.recentLessons.map((lesson) => (
            <div key={lesson.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{lesson.title}</p>
                <span className="text-xs text-muted-foreground">{lesson.aiStatus}</span>
              </div>
              <p className="text-muted-foreground">{lesson.subject} | {new Date(lesson.createdAt).toLocaleString()} | {Math.round(lesson.durationSec / 60)} min</p>
              <p className="mt-1 text-muted-foreground">
                {lesson.summary
                  ? (() => {
                      try {
                        const parsed = JSON.parse(lesson.summary) as { text?: string };
                        return parsed.text ?? lesson.summary;
                      } catch {
                        return lesson.summary;
                      }
                    })()
                  : lesson.aiError || "Summary is being prepared."}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
