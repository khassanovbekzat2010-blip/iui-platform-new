"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, GraduationCap, Signal, Users } from "lucide-react";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { PerformanceBarChart } from "@/components/charts/performance-bar-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type SchoolDashboardDTO = {
  summary: {
    totalClasses: number;
    totalStudents: number;
    totalTeachers: number;
    avgEngagement: number;
    avgAttention: number;
  };
  classes: Array<{ id: string; name: string; grade: number; students: number }>;
  subjects: Array<{ subject: string; lessons: number }>;
  xpVelocity: Array<{ label: string; xp: number }>;
  engagementTimeline: Array<{ label: string; engagement: number }>;
};

export default function AnalyticsPage() {
  const user = useAppStore((state) => state.authUser);

  const query = useQuery({
    queryKey: ["school-dashboard"],
    enabled: user?.role === "teacher" || user?.role === "admin",
    queryFn: () => apiRequest<SchoolDashboardDTO>("/api/school/dashboard")
  });

  if (user?.role !== "teacher" && user?.role !== "admin") {
    return <p className="text-sm text-muted-foreground">This page is available only for teacher/admin roles.</p>;
  }

  if (query.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">School analytics is unavailable right now.</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">School Analytics</h2>
        <p className="text-muted-foreground">Engagement, class performance, learning velocity and subject activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Building2 className="h-4 w-4" />Classes</CardDescription>
            <CardTitle>{query.data.summary.totalClasses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" />Students</CardDescription>
            <CardTitle>{query.data.summary.totalStudents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><GraduationCap className="h-4 w-4" />Teachers</CardDescription>
            <CardTitle>{query.data.summary.totalTeachers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Signal className="h-4 w-4" />Avg Attention</CardDescription>
            <CardTitle>{query.data.summary.avgAttention}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Engagement</CardDescription>
            <CardTitle>{query.data.summary.avgEngagement}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Timeline</CardTitle>
            <CardDescription>Latest EEG engagement from active sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <EngagementLineChart data={query.data.engagementTimeline} xKey="label" yKey="engagement" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>XP Velocity</CardTitle>
            <CardDescription>Gamification momentum across student activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceBarChart data={query.data.xpVelocity} xKey="label" yKey="xp" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Class Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {query.data.classes.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">Grade {item.grade} | Students: {item.students}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subject Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {query.data.subjects.map((item) => (
              <div key={item.subject} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.subject}</p>
                <p className="text-muted-foreground">Lessons: {item.lessons}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

