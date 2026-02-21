"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  studentAiRecommendationsById,
  studentHomeworkById,
  studentLessonsById,
  students,
  studentTrendById
} from "@/data/mock/students";
import { useAppStore } from "@/store/app-store";

const homeworkVariant = {
  planned: "warning",
  "in-progress": "default",
  done: "success"
} as const;

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const id = params.id;

  useEffect(() => {
    if (!hydrated || !user) {
      return;
    }
    if (user.role === "student" && user.studentId && user.studentId !== id) {
      router.replace(`/students/${user.studentId}`);
    }
  }, [hydrated, id, router, user]);

  if (!hydrated || !user) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  const student = students.find((item) => item.id === id);
  if (!student) {
    return (
      <section className="space-y-4">
        <h2 className="font-[var(--font-space-grotesk)] text-2xl font-semibold">Профиль не найден</h2>
        <p className="text-muted-foreground">Указанный ученик отсутствует в mock-данных.</p>
      </section>
    );
  }

  const trend = studentTrendById[id] ?? [];
  const history = studentLessonsById[id] ?? [];
  const recommendations = studentAiRecommendationsById[id] ?? [];
  const homework = studentHomeworkById[id] ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">{student.name}</h2>
        <p className="text-muted-foreground">Класс {student.grade} • персональный AI-профиль.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>График вовлеченности</CardTitle>
        </CardHeader>
        <CardContent>
          <EngagementLineChart data={trend} xKey="label" yKey="value" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>История уроков</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <p className="font-medium">{item.lesson}</p>
                <p className="text-sm text-muted-foreground">
                  {item.date} • Score {item.score}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Домашние задания</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {homework.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground">Срок: {task.dueDate}</p>
              </div>
              <Badge variant={homeworkVariant[task.status]}>{task.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
