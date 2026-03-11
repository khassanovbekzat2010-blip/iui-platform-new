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
  studentProgressChart: Array<{
    label: string;
    xp: number;
    level: number;
    attention: number;
  }>;
  nextLessonPlan: {
    title: string;
    steps: string[];
  };
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
    return <p className="text-sm text-muted-foreground">Раздел доступен только учителю или администратору.</p>;
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
    return <p className="text-sm text-muted-foreground">Панель учителя временно недоступна.</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Панель учителя</h2>
        <p className="text-muted-foreground">Живое внимание класса, прогресс учеников, AI-рекомендации и план следующего урока.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" />Ученики</CardDescription>
            <CardTitle>{query.data.summary.studentCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Brain className="h-4 w-4" />Средняя вовлеченность</CardDescription>
            <CardTitle>{Math.round(liveRows.reduce((acc, row) => acc + row.engagementScore, 0) / Math.max(1, liveRows.length))}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Radar className="h-4 w-4" />Классы</CardDescription>
            <CardTitle>{query.data.summary.classroomCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Нуждаются во внимании</CardDescription>
            <CardTitle>{liveRows.filter((row) => row.attention > 0 && row.attention < 40).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Внимание класса в реальном времени</CardTitle>
          <CardDescription>График строится по живым EEG-данным учеников.</CardDescription>
        </CardHeader>
        <CardContent>
          <EngagementLineChart data={trendData} xKey="label" yKey="value" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Карта внимания</CardTitle>
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
                <p className="mt-1 text-sm">Внимание: {student.attention}%</p>
                <p className="text-xs text-muted-foreground">Состояние: {student.state}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI-подсказки для учителя</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {query.data.recommendations.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">{item.recommendationType}</p>
                <p className="text-muted-foreground">{item.content}</p>
              </div>
            ))}
            {!query.data.recommendations.length ? <p className="text-muted-foreground">AI-подсказки пока не сформированы.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Домашние задания</CardTitle>
            <CardDescription>Новые ответы, AI-проверка и очередь на проверку учителя.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {query.data.homeworkNotifications.length === 0 ? <p className="text-muted-foreground">По домашке пока нет активности.</p> : null}
            {query.data.homeworkNotifications.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.studentName}</p>
                  <span className="text-xs text-muted-foreground">{item.status}</span>
                </div>
                <p className="text-muted-foreground">{item.homeworkTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {item.submittedAt ? `Отправлено ${new Date(item.submittedAt).toLocaleString("ru-RU")}` : "Ожидает ответа"}
                  {typeof item.aiScore === "number" ? ` | AI ${item.aiScore}/100` : ""}
                  {` | Награда ${item.points} XP`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Прогресс учеников</CardTitle>
            <CardDescription>Уровень, недавний XP и текущая динамика по ученикам.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-3">
              {query.data.studentProgressChart.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.label}</span>
                    <span>Lvl {item.level} • XP {item.xp} • Внимание {item.attention}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(8, Math.min(100, item.attention))}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {query.data.studentProgress.length === 0 ? <p className="text-muted-foreground">Событий прогресса пока нет.</p> : null}
            {query.data.studentProgress.map((item) => (
              <div key={item.studentId} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.studentName}</p>
                  <span className="text-xs text-muted-foreground">Lvl {item.currentLevel}</span>
                </div>
                <p className="text-muted-foreground">{item.classroomName}</p>
                <p className="text-xs text-muted-foreground">
                  Недавний XP: {item.recentXp}
                  {item.lastProgressAt ? ` | ${new Date(item.lastProgressAt).toLocaleString("ru-RU")}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{query.data.nextLessonPlan.title}</CardTitle>
          <CardDescription>AI не только анализирует урок, но и предлагает готовую структуру следующего занятия.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.data.nextLessonPlan.steps.map((step, index) => (
            <div key={`${index}-${step}`} className="rounded-xl border border-border/60 p-3">
              <p className="text-sm font-medium">Шаг {index + 1}</p>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Анализ последних уроков</CardTitle>
          <CardDescription>Итоги уроков, ошибки AI-обработки и готовность архива.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {query.data.recentLessons.length === 0 ? <p className="text-muted-foreground">Сохраненных уроков пока нет.</p> : null}
          {query.data.recentLessons.map((lesson) => (
            <div key={lesson.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{lesson.title}</p>
                <span className="text-xs text-muted-foreground">{lesson.aiStatus}</span>
              </div>
              <p className="text-muted-foreground">{lesson.subject} | {new Date(lesson.createdAt).toLocaleString("ru-RU")} | {Math.round(lesson.durationSec / 60)} мин</p>
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
                  : lesson.aiError || "AI-summary еще готовится."}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
