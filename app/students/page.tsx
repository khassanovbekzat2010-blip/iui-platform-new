"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { StudentsTable } from "@/components/students/students-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { students } from "@/data/mock/students";
import { useAppStore } from "@/store/app-store";

export default function StudentsPage() {
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);

  useEffect(() => {
    if (hydrated && user?.role === "student" && user.studentId) {
      router.replace(`/students/${user.studentId}`);
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

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Students</h2>
        <p className="text-muted-foreground">Рабочий список учеников с переходом в профиль.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentsTable rows={students} />
        </CardContent>
      </Card>
    </section>
  );
}
