"use client";

import { LiveLessonWorkspace } from "@/components/lesson/live-lesson-workspace";
import { StudentLessonView } from "@/components/lesson/student-lesson-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/app-store";

export default function LiveLessonPage() {
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);

  if (!hydrated || !user) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Live Lesson</h2>
        <p className="text-muted-foreground">
          {user.role === "teacher"
            ? "Живая запись урока, транскрипция и AI-анализ."
            : "Ваши уроки, рекомендации и домашние задания."}
        </p>
      </div>
      {user.role === "teacher" ? <LiveLessonWorkspace /> : <StudentLessonView studentId={user.studentId ?? "st-02"} />}
    </section>
  );
}
