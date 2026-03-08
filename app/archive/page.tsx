"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type LessonArchiveItem = {
  id: string;
  title: string;
  subject: string;
  classroomName: string | null;
  aiStatus: "SAVED" | "PROCESSING" | "READY" | "FAILED";
  summary: string | null;
  aiError: string | null;
  createdAt: string;
  durationSec: number;
};

function parseSummary(summary: string | null) {
  if (!summary) return "";
  try {
    const parsed = JSON.parse(summary) as { text?: string };
    return parsed.text ?? summary;
  } catch {
    return summary;
  }
}

export default function ArchivePage() {
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<LessonArchiveItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ lessons: LessonArchiveItem[] }>("/api/lessons");
      setItems(data.lessons);
    } catch (error) {
      pushToast("Failed to load archive", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        (item.classroomName ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  if (!hydrated || !user) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Lesson Archive</h2>
        <p className="text-muted-foreground">Saved lessons with transcript and AI processing status.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search by title, subject, classroom..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Archive Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <Skeleton className="h-56 w-full" /> : null}
          {!loading && filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No lessons in archive yet.
            </div>
          ) : null}
          {!loading
            ? filtered.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.subject} | {item.classroomName ?? "No class"} |{" "}
                        {new Date(item.createdAt).toLocaleString()} | {Math.round(item.durationSec / 60)} min
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.aiStatus === "READY"
                          ? "success"
                          : item.aiStatus === "FAILED"
                            ? "danger"
                            : item.aiStatus === "PROCESSING"
                              ? "warning"
                              : "outline"
                      }
                    >
                      {item.aiStatus}
                    </Badge>
                  </div>
                  {parseSummary(item.summary) ? (
                    <p className="mt-2 text-sm text-muted-foreground">{parseSummary(item.summary)}</p>
                  ) : item.aiStatus === "FAILED" ? (
                    <p className="mt-2 text-sm text-muted-foreground">AI is temporarily unavailable.</p>
                  ) : null}
                  {item.aiError ? <p className="mt-1 text-xs text-rose-500">{item.aiError}</p> : null}
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </section>
  );
}

