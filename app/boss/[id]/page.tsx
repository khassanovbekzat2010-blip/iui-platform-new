"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { useAppStore } from "@/store/app-store";

type BossDTO = {
  boss: {
    id: string;
    title: string;
    passScore: number;
    maxAttempts: number;
    timeLimitSec: number;
  };
  attempts: Array<{ score: number; passed: boolean; attemptNo: number }>;
};

export default function BossPage() {
  const params = useParams<{ id: string }>();
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const userId = getJourneyUserId(user);
  const [scoreInput, setScoreInput] = useState("80");
  const [timeSpentMs, setTimeSpentMs] = useState("65000");
  const [chestOpened, setChestOpened] = useState(false);

  const bossQuery = useQuery({
    queryKey: ["boss", params.id, userId],
    enabled: Boolean(params.id && userId),
    queryFn: () => apiRequest<BossDTO>(`/api/boss/${params.id}?userId=${encodeURIComponent(userId)}`)
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<{ passed: boolean; loot?: { name: string; rarity: string } }>("/api/boss/attempt", {
        method: "POST",
        body: JSON.stringify({
          userId,
          bossId: params.id,
          score: Number(scoreInput),
          timeSpentMs: Number(timeSpentMs)
        })
      }),
    onSuccess: (data) => {
      if (data.passed) {
        setChestOpened(true);
        pushToast("Boss defeated", "Награда начислена");
      } else {
        pushToast("Не пройдено", "Попробуйте еще раз");
      }
      bossQuery.refetch();
    },
    onError: (error) => {
      pushToast("Ошибка", error instanceof Error ? error.message : "Boss attempt failed");
    }
  });

  const attemptsLeft = useMemo(() => {
    if (!bossQuery.data) return 0;
    return bossQuery.data.boss.maxAttempts - bossQuery.data.attempts.length;
  }, [bossQuery.data]);

  if (bossQuery.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (bossQuery.isError || !bossQuery.data) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">Босс недоступен. Сначала завершите предыдущие шаги Journey.</p>
      </section>
    );
  }
  const { boss, attempts } = bossQuery.data;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">{boss.title}</h2>
        <p className="text-muted-foreground">Boss fight: таймер, попытки, награды.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Контрольный бой</CardTitle>
          <CardDescription>
            Pass score: {boss.passScore}, Attempts left: {attemptsLeft}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={scoreInput} onChange={(event) => setScoreInput(event.target.value)} placeholder="Score 0-100" />
          <Input value={timeSpentMs} onChange={(event) => setTimeSpentMs(event.target.value)} placeholder="Time spent ms" />
          <Button data-testid="boss-attempt-btn" disabled={attemptsLeft <= 0} onClick={() => mutation.mutate()}>
            Запустить попытку
          </Button>
          <div className="space-y-1 text-sm text-muted-foreground">
            {attempts.map((attempt) => (
              <p key={attempt.attemptNo}>
                Attempt #{attempt.attemptNo}: {attempt.score} ({attempt.passed ? "PASS" : "FAIL"})
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <motion.div
        initial={{ scale: 0.95, opacity: 0.6 }}
        animate={chestOpened ? { scale: 1.04, opacity: 1 } : { scale: 1, opacity: 0.85 }}
        className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-6 text-center"
      >
        <p className="text-lg font-semibold">Reward Chest</p>
        <p className="text-sm text-muted-foreground">{chestOpened ? "Сундук открыт: лут добавлен в инвентарь" : "Победите босса, чтобы открыть сундук"}</p>
      </motion.div>
    </section>
  );
}
