"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Crown, Shield, Sparkles, Star, Sword, Trophy } from "lucide-react";

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
  if (level >= 10) return "Мастер нейро-пути";
  if (level >= 7) return "Стратег знаний";
  if (level >= 4) return "Уверенный исследователь";
  return "Юный герой";
}

function stageLore(level: number) {
  if (level >= 10) return "Герой уверенно держит темп урока, быстро собирает внимание и открывает сложные задания.";
  if (level >= 7) return "Персонаж уже умеет выдерживать длинные уроки и справляться с заданиями повышенной сложности.";
  if (level >= 4) return "Герой вошел в ритм: домашняя работа приносит заметный рост навыков и опыта.";
  return "Это стартовая стадия. Регулярная домашняя работа и хорошие ответы быстро раскрывают потенциал героя.";
}

function stageAccent(level: number) {
  if (level >= 10) return "from-amber-300/45 via-rose-300/20 to-transparent";
  if (level >= 7) return "from-cyan-300/45 via-sky-300/20 to-transparent";
  if (level >= 4) return "from-emerald-300/45 via-lime-300/20 to-transparent";
  return "from-slate-300/35 via-slate-200/15 to-transparent";
}

function characterPalette(level: number) {
  if (level >= 10) return {
    armor: "from-amber-300/40 to-rose-300/25",
    glow: "shadow-[0_0_70px_rgba(251,191,36,0.35)]"
  };
  if (level >= 7) {
    return {
      armor: "from-cyan-300/35 to-sky-300/25",
      glow: "shadow-[0_0_70px_rgba(56,189,248,0.30)]"
    };
  }
  if (level >= 4) {
    return {
      armor: "from-emerald-300/35 to-lime-300/25",
      glow: "shadow-[0_0_70px_rgba(74,222,128,0.28)]"
    };
  }
  return {
    armor: "from-slate-200/30 to-slate-100/15",
    glow: "shadow-[0_0_60px_rgba(148,163,184,0.20)]"
  };
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
      pushToast("Герой усилен", "Навык героя улучшен за 25 монет.");
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
  const lore = stageLore(hero.level);
  const auraClass = stageAccent(hero.level);
  const palette = characterPalette(hero.level);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Герой</h2>
        <p className="max-w-3xl text-muted-foreground">
          Здесь живет игровой образ ученика. Чем лучше учеба, домашняя работа и серия успешных дней, тем сильнее становится персонаж и тем больше возможностей для прокачки.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-0 shadow-[0_24px_90px_rgba(15,23,42,0.16)]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_32%),linear-gradient(160deg,#081120,#111827)] p-6 text-white">
            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className={`relative aspect-[3/4] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.15),rgba(15,23,42,0.96))] ${palette.glow}`}>
                  <div className={`absolute inset-0 bg-gradient-to-b ${auraClass}`} />
                  <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/70">
                    Уровень {hero.level}
                  </div>
                  {hero.level >= 7 ? <Crown className="absolute left-1/2 top-14 h-9 w-9 -translate-x-1/2 text-amber-200" /> : null}
                  <div className="absolute left-1/2 top-[18%] h-24 w-24 -translate-x-1/2 rounded-full border border-white/20 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.75),rgba(255,255,255,0.08))]" />
                  <div className={`absolute left-1/2 top-[34%] h-44 w-32 -translate-x-1/2 rounded-[40px] border border-white/20 bg-gradient-to-b ${palette.armor}`} />
                  <div className="absolute left-[24%] top-[44%] h-28 w-8 rotate-[16deg] rounded-full bg-white/12" />
                  <div className="absolute right-[24%] top-[44%] h-28 w-8 -rotate-[16deg] rounded-full bg-white/12" />
                  <div className="absolute bottom-[13%] left-[40%] h-32 w-8 rotate-[6deg] rounded-full bg-white/12" />
                  <div className="absolute bottom-[13%] right-[40%] h-32 w-8 -rotate-[6deg] rounded-full bg-white/12" />
                  {hero.level >= 4 ? <div className="absolute left-6 top-20 h-11 w-11 rounded-full border border-cyan-200/40 bg-cyan-200/20" /> : null}
                  {hero.level >= 7 ? <div className="absolute right-6 top-24 h-12 w-12 rotate-12 rounded-xl border border-amber-200/40 bg-amber-200/20" /> : null}
                  {hero.level >= 10 ? <div className="absolute bottom-8 right-8 h-14 w-14 rounded-full border border-rose-200/40 bg-rose-200/20" /> : null}
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Стадия</p>
                    <p className="mt-1 text-sm font-semibold">{stage}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-xl font-semibold">{hero.archetype}</p>
                  <p className="text-sm text-white/70">{lore}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">{hero.xp} XP</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">{hero.coins} монет</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">{stage}</div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/70">Прогресс до следующего уровня</p>
                  <Progress value={progressPercent} className="mt-3" />
                  <p className="mt-3 text-xs text-white/60">Каждый сильный ответ и принятая домашняя работа двигают героя вперед.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {stats.map((item) => {
                    const Icon = item.icon;
                    const value = hero[item.key];
                    return (
                      <div key={item.key} className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm text-white/75">
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </div>
                          <span className={`rounded-full bg-gradient-to-r px-2 py-1 text-[11px] font-medium text-slate-950 ${item.accent}`}>
                            +4
                          </span>
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{value}</p>
                        <Progress value={Math.min(100, value)} className="mt-3" />
                        <Button
                          className="mt-4 w-full"
                          variant="secondary"
                          disabled={upgradeMutation.isPending || hero.coins < 25}
                          onClick={() => upgradeMutation.mutate(item.key)}
                        >
                          Улучшить за 25 монет
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
          <Card className="border-0 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sword className="h-5 w-5" /> План прокачки</CardTitle>
              <CardDescription>Монеты превращаются в реальные улучшения, которые формируют образ и стиль героя.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border/60 bg-sky-50/70 p-4">
                <p className="font-medium text-foreground">Фокус</p>
                <p className="mt-1">Поднимает устойчивость внимания и делает героя собраннее во время длинных уроков.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-amber-50/70 p-4">
                <p className="font-medium text-foreground">Логика</p>
                <p className="mt-1">Нужна для задач с последовательным решением: математика, физика, информатика.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-emerald-50/70 p-4">
                <p className="font-medium text-foreground">Креативность</p>
                <p className="mt-1">Усиливает проектные задания, объяснения, эссе и нестандартные ответы.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-rose-50/70 p-4">
                <p className="font-medium text-foreground">Дисциплина</p>
                <p className="mt-1">Помогает держать streak и стабильно выполнять задания без пропусков.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Последние достижения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data.achievements.map((item) => (
                <div key={`${item.achievementDefinition.title}-${item.unlockedAt}`} className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
                  <p className="font-medium">{item.achievementDefinition.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(item.unlockedAt).toLocaleString("ru-RU")}</p>
                </div>
              ))}
              {!query.data.achievements.length ? (
                <p className="text-sm text-muted-foreground">Первые достижения появятся после уроков, домашней работы и стабильной серии выполнений.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
