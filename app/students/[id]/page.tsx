"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { EngagementLineChart } from "@/components/charts/engagement-line-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type StudentDetailResponse = {
  student: {
    id: string;
    name: string;
    email: string;
    grade: number | null;
    subjects: string[];
    goals: string;
    isActive: boolean;
    performance: number;
    completedQuests: number;
    totalQuests: number;
    weakTopics: string[];
    hero: {
      level: number;
      xp: number;
      coins: number;
    } | null;
  };
  deviceHistory: Array<{
    id: string;
    deviceName: string;
    deviceType: string;
    connectionState: string;
    focus: number | null;
    signal: number | null;
    recordedAt: string;
  }>;
  homework: Array<{
    id: string;
    status: string;
    feedback: string | null;
    submittedAt: string | null;
    homework: {
      id: string;
      title: string;
      subject: string;
      dueDate: string;
      lessonId: string | null;
    };
  }>;
  archive: Array<{
    id: string;
    title: string;
    subject: string;
    date: string;
    status: string;
    summary: string | null;
  }>;
};

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentDetailResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
    name: "",
    grade: 9,
    subjects: "",
    goals: "",
    isActive: true
  });

  const loadStudent = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<StudentDetailResponse>(`/api/students/${id}`);
      setData(response);
      setEdit({
        name: response.student.name,
        grade: response.student.grade ?? 9,
        subjects: response.student.subjects.join(", "),
        goals: response.student.goals,
        isActive: response.student.isActive
      });
    } catch (error) {
      pushToast("Failed to load student", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !user) return;
    if (user.role === "student" && user.studentId && user.studentId !== id) {
      router.replace(`/students/${user.studentId}`);
      return;
    }
    loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, id, router]);

  const focusTrend = useMemo(
    () =>
      (data?.deviceHistory ?? [])
        .filter((point) => typeof point.focus === "number")
        .slice(0, 18)
        .reverse()
        .map((point) => ({
          label: new Date(point.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          value: point.focus ?? 0
        })),
    [data?.deviceHistory]
  );

  const saveStudent = async () => {
    setSaving(true);
    try {
      await apiRequest(`/api/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: edit.name,
          grade: edit.grade,
          subjects: edit.subjects
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          goals: edit.goals,
          isActive: edit.isActive
        })
      });
      pushToast("Student updated");
      await loadStudent();
    } catch (error) {
      pushToast("Failed to update student", error instanceof Error ? error.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated || !user || loading) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <h2 className="font-[var(--font-space-grotesk)] text-2xl font-semibold">Student not found</h2>
        <p className="text-muted-foreground">The selected student does not exist or is unavailable for your role.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">{data.student.name}</h2>
          <p className="text-muted-foreground">
            Grade {data.student.grade ?? "N/A"} | {data.student.email}
          </p>
        </div>
        <Badge variant={data.student.isActive ? "success" : "warning"}>
          {data.student.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Performance: {data.student.performance}%</p>
            <p>
              Quests: {data.student.completedQuests}/{data.student.totalQuests}
            </p>
            <p>Hero Level: {data.student.hero?.level ?? 1}</p>
            <p>XP: {data.student.hero?.xp ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Device Focus History</CardTitle>
          </CardHeader>
          <CardContent>
            {focusTrend.length ? (
              <EngagementLineChart data={focusTrend} xKey="label" yKey="value" />
            ) : (
              <p className="text-sm text-muted-foreground">No device focus data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weak Topics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.student.weakTopics.length ? (
            data.student.weakTopics.map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No weak topics detected from recent attempts.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Homework</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.homework.length === 0 ? <p className="text-sm text-muted-foreground">No homework submissions yet.</p> : null}
            {data.homework.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.homework.title}</p>
                <p className="text-muted-foreground">
                  {item.homework.subject} | Due {new Date(item.homework.dueDate).toLocaleDateString()} | {item.status}
                </p>
                {item.feedback ? <p className="mt-1 text-muted-foreground">Feedback: {item.feedback}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lesson Archive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.archive.length === 0 ? <p className="text-sm text-muted-foreground">No lesson archive records yet.</p> : null}
            {data.archive.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">
                  {item.subject} | {new Date(item.date).toLocaleDateString()} | {item.status}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {user.role !== "student" ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Student</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input value={edit.name} onChange={(event) => setEdit((prev) => ({ ...prev, name: event.target.value }))} />
            <Input
              type="number"
              min={1}
              max={11}
              value={edit.grade}
              onChange={(event) => setEdit((prev) => ({ ...prev, grade: Number(event.target.value) || 1 }))}
            />
            <Input
              value={edit.subjects}
              onChange={(event) => setEdit((prev) => ({ ...prev, subjects: event.target.value }))}
              placeholder="Subjects"
            />
            <Input value={edit.goals} onChange={(event) => setEdit((prev) => ({ ...prev, goals: event.target.value }))} />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={edit.isActive}
                onChange={(event) => setEdit((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Student is active
            </label>
            <Button className="md:col-span-2" onClick={saveStudent} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

