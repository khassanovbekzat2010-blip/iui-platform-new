"use client";

import { useQuery } from "@tanstack/react-query";
import { Brain, Coins, Gem, Shield, Sparkles, Star } from "lucide-react";

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
    gems: number;
  } | null;
  inventory: Array<{ id: string; quantity: number; itemDefinition: { name: string; rarity: string; type: string } }>;
  achievements: Array<{ unlockedAt: string; achievementDefinition: { title: string } }>;
};

const stats = [
  { key: "focus", label: "Focus", icon: Brain },
  { key: "logic", label: "Logic", icon: Shield },
  { key: "creativity", label: "Creativity", icon: Sparkles },
  { key: "discipline", label: "Discipline", icon: Star }
] as const;

export default function HeroPage() {
  const user = useAppStore((state) => state.authUser);
  const userId = getJourneyUserId(user);

  const query = useQuery({
    queryKey: ["hero-profile", userId],
    enabled: Boolean(userId),
    queryFn: () => apiRequest<HeroDTO>(`/api/hero?userId=${encodeURIComponent(userId)}`)
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
    return <p className="text-sm text-muted-foreground">Hero profile is unavailable right now.</p>;
  }

  const hero = query.data.hero;
  const progressPercent = Math.min(100, ((hero.xp % 120) / 120) * 100);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Hero Profile</h2>
        <p className="text-muted-foreground">A visual profile of the student avatar, mastery traits, rewards, and unlocked items.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(160deg,#07111f,#111827)] p-6">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="aspect-[3/4] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,197,94,0.18),rgba(15,23,42,0.6))]" />
                <p className="mt-4 text-lg font-semibold text-white">{hero.archetype}</p>
                <p className="text-sm text-white/70">Level {hero.level} neural adventurer</p>
              </div>

              <div className="space-y-4 text-white">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">Level {hero.level}</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">{hero.xp} XP</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">{hero.archetype}</div>
                </div>
                <div>
                  <p className="text-sm text-white/70">Progress to next level</p>
                  <Progress value={progressPercent} className="mt-2" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {stats.map((item) => {
                    const Icon = item.icon;
                    const value = hero[item.key];
                    return (
                      <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{value}</p>
                        <Progress value={Math.min(100, value)} className="mt-3" />
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
              <CardTitle>Resources</CardTitle>
              <CardDescription>Reward economy attached to the student profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4" />Coins</div>
                <p className="mt-2 text-2xl font-semibold">{hero.coins}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Gem className="h-4 w-4" />Gems</div>
                <p className="mt-2 text-2xl font-semibold">{hero.gems}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unlocked Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data.inventory.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                  <p className="font-medium">{item.itemDefinition.name}</p>
                  <p className="text-muted-foreground">{item.itemDefinition.rarity} | {item.itemDefinition.type}</p>
                  <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
                </div>
              ))}
              {!query.data.inventory.length ? <p className="text-sm text-muted-foreground">No unlocked items yet.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data.achievements.map((item) => (
                <div key={`${item.achievementDefinition.title}-${item.unlockedAt}`} className="rounded-xl border border-border/60 p-3 text-sm">
                  <p className="font-medium">{item.achievementDefinition.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.unlockedAt).toLocaleString()}</p>
                </div>
              ))}
              {!query.data.achievements.length ? <p className="text-sm text-muted-foreground">No achievements unlocked yet.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
