"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Shield, Sparkles, Star, Sword, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { useAppStore } from "@/store/app-store";

type HeroDTO = {
  hero: {
    archetype: string;
    level: number;
    xp: number;
    focus: number;
    logic: number;
    creativity: number;
    discipline: number;
    avatarUrl: string;
    coins: number;
  } | null;
  inventory: Array<{ id: string; quantity: number; itemDefinition: { name: string; rarity: string; type: string } }>;
  achievements: Array<{ unlockedAt: string; achievementDefinition: { title: string } }>;
};

const stats = [
  { key: "focus", label: "Фокус", icon: Brain, accent: "from-sky-500 to-cyan-400" },
  { key: "logic", label: "Логика", icon: Shield, accent: "from-amber-500 to-orange-400" },
  { key: "creativity", label: "Креативность", icon: Sparkles, accent: "from-emerald-500 to-lime-400" },
  { key: "discipline", label: "Дисциплина", icon: Star, accent: "from-rose-500 to-pink-400" }
] as const;

function stageTitle(level: number) {
  if (level >= 8) return "Архитектор разума";
  if (level >= 5) return "Тактик знаний";
  if (level >= 3) return "Уверенный исследователь";
  return "Юный ученик";
}

function stageAccent(level: number) {
  if (level >= 8) return "from-amber-300/45 via-rose-300/20 to-transparent";
  if (level >= 5) return "from-cyan-300/45 via-sky-300/20 to-transparent";
  if (level >= 3) return "from-emerald-300/45 via-lime-300/20 to-transparent";
  return "from-slate-300/35 via-slate-200/15 to-transparent";
}

export default function HeroPage() {
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const queryClient = useQueryClient();
  const userId = getJourneyUserId(user);

  const query = useQuery({
    queryKey: ["hero-profile", userId],
    enabled: Boolean(userId),
    queryFn: () => apiRequest<HeroDTO>(`/api/hero?userId=${encodeURIComponent(userId)}`)
  });

  const upgradeMutation = useMutation({
    mutationFn: (trait: "focus" | "logic" | "creativity" | "discipline") =>
      apiRequest("/api/hero/upgrade", {
        method: "POST",
        body: JSON.stringify({ trait })
      }),
    onSuccess: () => {
      pushToast("Герой усилен", "Параметр героя улучшен за 25 coins.");
      queryClient.invalidateQueries({ queryKey: ["hero-profile", userId] });
    },
    onError: (error) => {
      pushToast("Улучшение недоступно", error instanceof Error ? error.message : "Попробуй позже");
    }
  });

  if (query.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data?.hero) {
    return <p className="text-sm text-muted-foreground">Профиль героя временно недоступен.</p>;
  }

  const hero = query.data.hero;
  const progressPercent = Math.min(100, ((hero.xp % 120) / 120) * 100);
  const stage = stageTitle(hero.level);
  const auraClass = stageAccent(hero.level);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Герой</h2>
        <p className="text-muted-foreground">
          Твой персонаж растет от уроков, домашки и стабильного streak. Coins можно тратить на улучшение ключевых навыков.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden border-0 shadow-[0_24px_90px_rgba(15,23,42,0.16)]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_32%),linear-gradient(160deg,#081120,#111827)] p-6">
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.15),rgba(15,23,42,0.92))]">
                  <div className={`absolute inset-0 bg-gradient-to-b ${auraClass}`} />
                  <div className="absolute left-1/2 top-[10%] h-24 w-24 -translate-x-1/2 rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.7),rgba(255,255,255,0.08))]" />
                  <div className="absolute left-1/2 top-[28%] h-40 w-28 -translate-x-1/2 rounded-[36px] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))]" />
                  <div className="absolute left-[25%] top-[40%] h-24 w-7 rotate-[18deg] rounded-full bg-white/10" />
                  <div className="absolute right-[25%] top-[40%] h-24 w-7 -rotate-[18deg] rounded-full bg-white/10" />
                  <div className="absolute bottom-[15%] left-[41%] h-28 w-7 rotate-[6deg] rounded-full bg-white/10" />
                  <div className="absolute bottom-[15%] right-[41%] h-28 w-7 -rotate-[6deg] rounded-full bg-white/10" />
                  {hero.level >= 3 ? <div className="absolute left-5 top-5 h-10 w-10 rounded-full border border-cyan-200/40 bg-cyan-200/20" /> : null}
                  {hero.level >= 5 ? <div className="absolute right-5 top-7 h-12 w-12 rotate-12 rounded-xl border border-amber-200/40 bg-amber-200/20" /> : null}
                  {hero.level >= 8 ? <div className="absolute bottom-7 right-7 h-14 w-14 rounded-full border border-rose-200/40 bg-rose-200/20" /> : null}
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-white">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Стадия</p>
                    <p className="mt-1 text-sm font-semibold">{stage}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-white">
                  <p className="text-lg font-semibold">{hero.archetype}</p>
                  <p className="text-sm text-white/70">Уровень {hero.level}</p>
                  <p className="text-sm text-white/70">{hero.coins} coins для улучшений</p>
                </div>
              </div>

              <div className="space-y-4 text-white">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">Уровень {hero.level}</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">{hero.xp} XP</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">{hero.coins} coins</div>
                </div>
                <div>
                  <p className="text-sm text-white/70">Прогресс до следующего уровня</p>
                  <Progress value={progressPercent} className="mt-2" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {stats.map((item) => {
                    const Icon = item.icon;
                    const value = hero[item.key];
                    return (
                      <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm text-white/70">
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </div>
                          <span className={`rounded-full bg-gradient-to-r px-2 py-1 text-[11px] font-medium text-slate-950 ${item.accent}`}>
                            +4
                          </span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{value}</p>
                        <Progress value={Math.min(100, value)} className="mt-3" />
                        <Button
                          className="mt-3 w-full"
                          variant="secondary"
                          disabled={upgradeMutation.isPending || hero.coins < 25}
                          onClick={() => upgradeMutation.mutate(item.key)}
                        >
                          Улучшить за 25 coins
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sword className="h-5 w-5" /> Что прокачивать дальше</CardTitle>
              <CardDescription>Coins за домашку и активность превращаются в реальные улучшения героя.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium text-foreground">Фокус</p>
                <p>Помогает держать высокий attention во время урока и быстрее проходить задания.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium text-foreground">Логика</p>
                <p>Полезна для математики, физики и заданий с пошаговым решением.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium text-foreground">Креативность</p>
                <p>Усиливает проектные и открытые ответы, помогает в эссе и объяснениях.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="font-medium text-foreground">Дисциплина</p>
                <p>Поддерживает streak и стабильное выполнение домашки.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Последние достижения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data.achievements.map((item) => (
                <div key={`${item.achievementDefinition.title}-${item.unlockedAt}`} className="rounded-xl border border-border/60 p-3 text-sm">
                  <p className="font-medium">{item.achievementDefinition.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.unlockedAt).toLocaleString("ru-RU")}</p>
                </div>
              ))}
              {!query.data.achievements.length ? <p className="text-sm text-muted-foreground">Первые достижения появятся после уроков и домашки.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
