"use client";

import { StudentGamificationCard } from "@/components/students/student-gamification-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { students, studentAiRecommendationsById, studentHomeworkById, studentLessonsById, studentTrendById } from "@/data/mock/students";
import { useAppStore } from "@/store/app-store";

interface StudentLessonViewProps {
  studentId: string;
}

export function StudentLessonView({ studentId }: StudentLessonViewProps) {
  const student = students.find((item) => item.id === studentId);
  const lessons = studentLessonsById[studentId] ?? [];
  const homework = studentHomeworkById[studentId] ?? [];
  const recommendations = studentAiRecommendationsById[studentId] ?? [];
  const trend = studentTrendById[studentId] ?? [];
  const latestSummary = useAppStore((state) => state.lesson.summary);
  const latestTopics = useAppStore((state) => state.lesson.keyTopics);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Мои уроки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="rounded-xl border border-border/60 p-3">
              <p className="font-medium">{lesson.lesson}</p>
              <p className="text-sm text-muted-foreground">
                {lesson.date} • Оценка {lesson.score}%
              </p>
              <p className="text-sm text-muted-foreground">{lesson.notes}</p>
            </div>
          ))}
          {!lessons.length ? <p className="text-sm text-muted-foreground">Пока нет уроков.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{student?.name ?? "Студент"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium">Мои конспекты</p>
          <p className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
            {latestSummary || "Краткие конспекты уроков отображаются здесь."}
          </p>
          {latestTopics.length ? (
            <p className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">Темы: {latestTopics.join(", ")}</p>
          ) : null}

          <p className="text-sm font-medium">Домашние задания</p>
          {homework.map((task) => (
            <p key={task.id} className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
              {task.title}
            </p>
          ))}

          <p className="text-sm font-medium">Рекомендации</p>
          {recommendations.map((item) => (
            <p key={item} className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
              {item}
            </p>
          ))}
        </CardContent>
      </Card>

      <div className="xl:col-span-3">
        <StudentGamificationCard trend={trend} homework={homework} />
      </div>
    </div>
  );
}
