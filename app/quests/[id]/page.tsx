"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { useAppStore } from "@/store/app-store";
import { useJourneyStore } from "@/store/journey-store";

type QuestDTO = {
  id: string;
  title: string;
  description: string;
  tasks: Array<{
    id: string;
    type: "quiz" | "open" | "drag";
    question: string;
    options: string[] | null;
    completed: boolean;
  }>;
};

export default function QuestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const { addPendingTask, resolvePendingTask } = useJourneyStore();
  const userId = getJourneyUserId(user);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const questQuery = useQuery({
    queryKey: ["quest", params.id, userId],
    enabled: Boolean(params.id && userId),
    queryFn: () => apiRequest<QuestDTO>(`/api/quests/${params.id}?userId=${encodeURIComponent(userId)}`)
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, answer }: { taskId: string; answer: string }) =>
      apiRequest<{ isCorrect: boolean }>("/api/quests/task/complete", {
        method: "POST",
        body: JSON.stringify({ userId, taskId, answer, timeSpentMs: 2000 })
      }),
    onMutate: ({ taskId }) => {
      addPendingTask(taskId);
    },
    onSuccess: (data, variables) => {
      resolvePendingTask(variables.taskId);
      queryClient.invalidateQueries({ queryKey: ["quest", params.id, userId] });
      pushToast("Задача проверена", data.isCorrect ? "Верно" : "Нужно доработать");
    },
    onError: (error, variables) => {
      resolvePendingTask(variables.taskId);
      pushToast("Ошибка", error instanceof Error ? error.message : "Не удалось завершить задачу");
    }
  });

  const completeQuestMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/quests/complete", {
        method: "POST",
        body: JSON.stringify({ userId, questId: params.id })
      }),
    onSuccess: () => {
      pushToast("Quest completed", "Награда начислена");
      queryClient.invalidateQueries({ queryKey: ["journey-dashboard", userId] });
      router.push("/dashboard");
    },
    onError: (error) => {
      pushToast("Ошибка", error instanceof Error ? error.message : "Quest не завершен");
    }
  });

  if (questQuery.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (questQuery.isError || !questQuery.data) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">Не удалось открыть квест. Проверьте Journey карту и попробуйте снова.</p>
      </section>
    );
  }
  const quest = questQuery.data;
  const completedCount = quest.tasks.filter((task) => task.completed).length;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">{quest.title}</h2>
        <p className="text-muted-foreground">{quest.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Прогресс: {completedCount}/{quest.tasks.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quest.tasks.map((task) => (
            <div key={task.id} className="space-y-2 rounded-xl border border-border/60 p-3">
              <p className="font-medium">{task.question}</p>
              {task.type === "quiz" ? (
                <div className="grid gap-2">
                  {(task.options ?? []).map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={task.id}
                        checked={answers[task.id] === option}
                        onChange={() => setAnswers((prev) => ({ ...prev, [task.id]: option }))}
                        disabled={task.completed}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <Input
                  value={answers[task.id] ?? ""}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [task.id]: event.target.value }))}
                  placeholder="Ваш ответ"
                  disabled={task.completed}
                />
              )}
              <Button
                data-testid={`complete-task-${task.id}`}
                size="sm"
                disabled={task.completed || !answers[task.id]}
                onClick={() => completeTaskMutation.mutate({ taskId: task.id, answer: answers[task.id] })}
              >
                {task.completed ? "Completed" : "Проверить задачу"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        data-testid="complete-quest-btn"
        disabled={completedCount < quest.tasks.length || completeQuestMutation.isPending}
        onClick={() => completeQuestMutation.mutate()}
      >
        Завершить квест
      </Button>
    </section>
  );
}
