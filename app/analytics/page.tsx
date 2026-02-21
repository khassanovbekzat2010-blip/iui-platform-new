"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { PerformanceBarChart } from "@/components/charts/performance-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { classPerformance, engagementOverTime } from "@/data/mock/analytics";
import { useAppStore } from "@/store/app-store";

export default function AnalyticsPage() {
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const lessonHistory = useAppStore((state) => state.lesson.engagementHistory);

  useEffect(() => {
    if (hydrated && user?.role === "student") {
      router.replace("/dashboard");
    }
  }, [hydrated, router, user]);

  if (!hydrated || !user) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full" />
      </section>
    );
  }

  const engagementData = lessonHistory.length
    ? lessonHistory
    : engagementOverTime.map((item) => ({
        label: item.label,
        value: item.engagement,
        dropped: false
      }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">Вовлеченность по времени, успеваемость класса и посещаемость.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Вовлеченность по времени</CardTitle>
        </CardHeader>
        <CardContent>
          <EngagementLineChart data={engagementData} xKey="label" yKey="value" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Успеваемость класса</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceBarChart data={classPerformance} xKey="className" yKey="score" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Посещаемость</CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementLineChart data={engagementOverTime} xKey="label" yKey="attendance" color="#10b981" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
