"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { getJourneyUserId } from "@/lib/journey-user";
import { HERO_ARCHETYPES } from "@/modules/journey/constants";
import { useAppStore } from "@/store/app-store";

const subjects = ["Math", "Physics", "Chemistry", "Biology", "History", "Informatics"];

type OnboardingResponse = {
  ok: true;
  user?: {
    id: string;
    email: string;
    role: "student" | "teacher" | "admin";
    name: string;
    studentId?: string;
  };
};

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.authUser);
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const pushToast = useAppStore((state) => state.pushToast);

  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const [grade, setGrade] = useState(9);
  const [goal, setGoal] = useState("9 class physics");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(["Physics"]);
  const [archetype, setArchetype] = useState<"Explorer" | "Scholar" | "Builder">("Scholar");

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const userId = getJourneyUserId(user);
      if (!userId) throw new Error("User not found");

      return apiRequest<OnboardingResponse>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          userId,
          role,
          grade,
          subjects: selectedSubjects,
          goal,
          archetype
        })
      });
    },
    onSuccess: (data) => {
      if (data.user) {
        setAuthUser(data.user);
      }
      pushToast("Onboarding saved", "Role and journey profile updated.");
      router.push("/dashboard");
    },
    onError: (error) => {
      pushToast("Onboarding error", error instanceof Error ? error.message : "Failed to save onboarding");
    }
  });

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Hero Onboarding</h2>
        <p className="text-muted-foreground">Configure your role, learning goals and journey profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Learning Profile</CardTitle>
          <CardDescription>This affects permissions, dashboards and learning path.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            Role
            <select
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2"
              value={role}
              onChange={(event) => setRole(event.target.value as "student" | "teacher" | "admin")}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            Grade
            <Input type="number" min={1} max={11} value={grade} onChange={(event) => setGrade(Number(event.target.value) || 1)} />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            Goal
            <Input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Example: improve algebra problem solving" />
          </label>

          <div className="space-y-2 md:col-span-2">
            <p className="text-sm">Subjects</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subjects.map((subject) => (
                <label key={subject} className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={() =>
                      setSelectedSubjects((prev) =>
                        prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]
                      )
                    }
                  />
                  {subject}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hero Archetype</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {HERO_ARCHETYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setArchetype(item.id)}
              className={`rounded-xl border p-4 text-left ${
                archetype === item.id ? "border-primary bg-primary/10" : "border-border/60"
              }`}
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Focus +{item.statBoost.focus}, Logic +{item.statBoost.logic}, Creativity +{item.statBoost.creativity}, Discipline +
                {item.statBoost.discipline}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Button
        data-testid="start-journey-btn"
        disabled={selectedSubjects.length === 0 || onboardingMutation.isPending}
        onClick={() => onboardingMutation.mutate()}
      >
        Save Onboarding
      </Button>
    </section>
  );
}

