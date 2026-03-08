"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { Lock, Swords } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { useAppStore } from "@/store/app-store";

type JourneyDTO = {
  acts: Array<{
    id: string;
    title: string;
    description: string;
    steps: Array<{
      id: string;
      title: string;
      status: "LOCKED" | "UNLOCKED" | "COMPLETED";
      isBoss: boolean;
      quests: Array<{ id: string; title: string }>;
    }>;
  }>;
};

export default function JourneyPage() {
  const user = useAppStore((state) => state.authUser);
  const userId = getJourneyUserId(user);
  const query = useQuery({
    queryKey: ["journey-map", userId],
    enabled: Boolean(userId),
    queryFn: () => apiRequest<JourneyDTO>(`/api/journey/map?userId=${encodeURIComponent(userId)}`)
  });

  if (query.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">Карта Journey пока недоступна. Пройдите onboarding и попробуйте снова.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Journey Map</h2>
        <p className="text-muted-foreground">Карта 12 шагов героя с узлами, блокировками и наградами.</p>
      </div>

      {query.data.acts.map((act) => (
        <Card key={act.id}>
          <CardHeader>
            <CardTitle>{act.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {act.steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-xl border p-4 ${
                  step.status === "COMPLETED"
                    ? "border-emerald-400/70 bg-emerald-400/10"
                    : step.status === "UNLOCKED"
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/60 bg-muted/20"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{step.title}</p>
                  {step.status === "LOCKED" ? <Lock className="h-4 w-4 text-muted-foreground" /> : null}
                  {step.isBoss ? <Swords className="h-4 w-4 text-amber-500" /> : null}
                </div>
                <p className="text-xs text-muted-foreground">{step.status}</p>
                <div className="mt-2 space-y-1">
                  {step.quests.slice(0, 2).map((quest) => (
                    <Link key={quest.id} href={`/quests/${quest.id}`} className="block text-xs text-primary">
                      {quest.title}
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
