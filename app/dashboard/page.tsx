"use client";

import { useRouter } from "next/navigation";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { EngagementMeter } from "@/components/dashboard/engagement-meter";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { TodayLessons } from "@/components/dashboard/today-lessons";
import { StudentGamificationCard } from "@/components/students/student-gamification-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardStats, quickActions, todayLessons } from "@/data/mock/dashboard";
import { students, studentAiRecommendationsById, studentHomeworkById, studentLessonsById, studentTrendById } from "@/data/mock/students";
import { useAppStore } from "@/store/app-store";

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const lesson = useAppStore((state) => state.lesson);
  const pushToast = useAppStore((state) => state.pushToast);

  if (!hydrated || !user) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </section>
    );
  }

  if (user.role === "student" && user.studentId) {
    const student = students.find((item) => item.id === user.studentId);
    const trend = studentTrendById[user.studentId] ?? [];
    const lessons = studentLessonsById[user.studentId] ?? [];
    const recommendations = studentAiRecommendationsById[user.studentId] ?? [];
    const homework = studentHomeworkById[user.studentId] ?? [];

    return (
      <section className="space-y-6">
        <div>
          <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Личный кабинет ученика: прогресс, уроки и рекомендации.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard stat={{ id: "me-1", title: "Ученик", value: student?.name ?? "-", delta: "Ваш профиль", trend: "neutral" }} />
          <StatCard stat={{ id: "me-2", title: "Вовлеченность", value: `${lesson.engagement}%`, delta: "В реальном времени", trend: "up" }} />
          <StatCard stat={{ id: "me-3", title: "Домашние задания", value: `${homework.length}`, delta: "Активные задачи", trend: "neutral" }} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Моя вовлеченность</CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementLineChart data={trend} xKey="label" yKey="value" />
          </CardContent>
        </Card>

        <StudentGamificationCard trend={trend} homework={homework} />

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Мои уроки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lessons.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-3">
                  <p className="font-medium">{item.lesson}</p>
                  <p className="text-sm text-muted-foreground">{item.date}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>AI рекомендации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map((item) => (
                <p key={item} className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Обзор активности классов и живой вовлеченности.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <EngagementMeter
            percent={lesson.engagement}
            stateLabel={lesson.engagement >= 75 ? "Focused" : "Needs attention"}
            dropMoments={lesson.dropMoments}
          />
        </div>
        <QuickActions
          actions={quickActions}
          onActionClick={(actionId) => {
            if (actionId === "homework") {
              router.push("/lesson");
            } else if (actionId === "report") {
              router.push("/analytics");
            } else {
              router.push("/students");
            }
          }}
          onAssistantClick={() => pushToast("AI Ассистент", "Функция готова к подключению API")}
        />
      </div>

      <TodayLessons
        lessons={todayLessons}
        onLessonClick={() => {
          router.push("/lesson");
          pushToast("Переход к уроку", "Открыт модуль Live Lesson");
        }}
      />
    </section>
  );
}
