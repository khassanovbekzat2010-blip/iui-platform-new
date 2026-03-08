"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type StudentListItem = {
  id: string;
  name: string;
  email: string;
  grade: number;
  classroomName: string;
  isActive: boolean;
  performance: number;
  engagement: number;
  heroLevel: number;
  device: {
    name: string;
    type: string;
    state: string;
    signal: number | null;
    focus: number | null;
    recordedAt: string;
  } | null;
};

export default function StudentsPage() {
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const pushToast = useAppStore((state) => state.pushToast);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    grade: 9,
    classroomName: "Class 9A",
    subjects: "Math, Physics",
    goals: "Start learning"
  });

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ students: StudentListItem[] }>("/api/students");
      setRows(data.students);
    } catch (error) {
      pushToast("Failed to load students", error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !user) return;
    if (user.role === "student") {
      router.replace("/dashboard");
      return;
    }
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, router]);

  const createStudent = async () => {
    if (!form.email || !form.name || !form.classroomName) {
      pushToast("Validation", "Email, name and classroom are required.");
      return;
    }
    setCreating(true);
    try {
      await apiRequest("/api/students", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          grade: form.grade,
          classroomName: form.classroomName,
          subjects: form.subjects
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          goals: form.goals
        })
      });
      setForm({
        email: "",
        name: "",
        grade: form.grade,
        classroomName: form.classroomName,
        subjects: form.subjects,
        goals: form.goals
      });
      pushToast("Student created", "Student has been added to your classroom.");
      await loadStudents();
    } catch (error) {
      pushToast("Failed to create student", error instanceof Error ? error.message : "Request failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (studentId: string, nextState: boolean) => {
    try {
      await apiRequest(`/api/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextState })
      });
      pushToast(nextState ? "Student activated" : "Student deactivated");
      await loadStudents();
    } catch (error) {
      pushToast("Failed to update student", error instanceof Error ? error.message : "Request failed");
    }
  };

  if (!hydrated || !user) {
    return (
      <section className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Students</h2>
        <p className="text-muted-foreground">Manage your students, monitor progress, and control active access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Student</CardTitle>
          <CardDescription>Create or re-enroll a student by email.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            placeholder="Full name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            type="number"
            min={1}
            max={11}
            value={form.grade}
            onChange={(event) => setForm((prev) => ({ ...prev, grade: Number(event.target.value) || 1 }))}
          />
          <Input
            placeholder="Classroom"
            value={form.classroomName}
            onChange={(event) => setForm((prev) => ({ ...prev, classroomName: event.target.value }))}
          />
          <Input
            placeholder="Subjects (comma-separated)"
            value={form.subjects}
            onChange={(event) => setForm((prev) => ({ ...prev, subjects: event.target.value }))}
          />
          <Input
            placeholder="Learning goals"
            value={form.goals}
            onChange={(event) => setForm((prev) => ({ ...prev, goals: event.target.value }))}
          />
          <Button className="md:col-span-2" onClick={createStudent} disabled={creating}>
            {creating ? "Creating..." : "Create Student"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <Skeleton className="h-40 w-full" /> : null}
          {!loading && rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
              No students yet.
            </div>
          ) : null}
          {!loading
            ? rows.map((student) => (
                <div key={student.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                        {student.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {student.email} | Grade {student.grade} | {student.classroomName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={student.isActive ? "success" : "warning"}>
                        {student.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(student.id, !student.isActive)}
                      >
                        {student.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                    <p>Performance: {student.performance}%</p>
                    <p>Engagement: {student.engagement}%</p>
                    <p>Hero Level: {student.heroLevel}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Device:{" "}
                    {student.device
                      ? `${student.device.name} (${student.device.type}) - ${student.device.state}`
                      : "No device data"}
                  </p>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </section>
  );
}
