"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  if (query.isError) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">Не удалось загрузить героя. Попробуйте позже.</p>
      </section>
    );
  }

  if (!query.data?.hero) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">Герой еще не создан. Сначала пройдите onboarding.</p>
        <Link href="/onboarding">
          <Button>Открыть onboarding</Button>
        </Link>
      </section>
    );
  }
  const hero = query.data.hero;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Hero Profile</h2>
        <p className="text-muted-foreground">Аватар, статы, инвентарь и коллекции достижений.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{hero.archetype}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Image src={hero.avatarUrl} alt="hero" width={280} height={280} className="rounded-xl border border-border/60" />
            <p className="text-sm">Level {hero.level}</p>
            <p className="text-sm text-muted-foreground">XP: {hero.xp}</p>
            <p className="text-sm text-muted-foreground">Coins: {hero.coins} • Gems: {hero.gems}</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 p-3 text-sm">Focus: {hero.focus}</div>
              <div className="rounded-xl border border-border/60 p-3 text-sm">Logic: {hero.logic}</div>
              <div className="rounded-xl border border-border/60 p-3 text-sm">Creativity: {hero.creativity}</div>
              <div className="rounded-xl border border-border/60 p-3 text-sm">Discipline: {hero.discipline}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {query.data.inventory.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                  {item.itemDefinition.name} x{item.quantity}
                </div>
              ))}
              {query.data.inventory.length === 0 ? <p className="text-sm text-muted-foreground">Пока пусто.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
