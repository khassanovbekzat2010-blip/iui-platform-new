"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { LANGUAGES, LEARNING_GOALS, SUBJECTS } from "@/lib/learning-config";
import { useAppStore } from "@/store/app-store";

type SettingsSection = "account" | "profile" | "notifications" | "devices" | "privacy";

const sections: Array<{ id: SettingsSection; title: string; hint: string }> = [
  { id: "account", title: "Account", hint: "Session and account identity" },
  { id: "profile", title: "Role/Profile", hint: "Grade, subjects and learning goal" },
  { id: "notifications", title: "Notifications", hint: "Reminder preferences" },
  { id: "devices", title: "Devices", hint: "Connected device status and defaults" },
  { id: "privacy", title: "Privacy", hint: "Data visibility and progress reset" }
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const logout = useAppStore((state) => state.logout);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const pushToast = useAppStore((state) => state.pushToast);

  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const [profileForm, setProfileForm] = useState<{
    grade: number;
    subjects: string[];
    goal: string;
    language: string;
  }>({
    grade: 9,
    subjects: ["Math"],
    goal: LEARNING_GOALS[0].id,
    language: "ru"
  });

  const [notifications, setNotifications] = useState({
    dailyReminderEnabled: true,
    homeworkDeadlineReminderEnabled: true
  });

  const [privacy, setPrivacy] = useState({
    showCharacter: true,
    enableStreak: true
  });

  useEffect(() => {
    if (!hydrated || !user) return;
    (async () => {
      try {
        const data = await apiRequest<{
          profile: { grade: number | null; subjects: string[] | null; goal: string | null; language: string | null } | null;
          settings: { dailyReminderEnabled: boolean; homeworkDeadlineReminderEnabled: boolean } | null;
          gamification: { showCharacter: boolean; enableStreak: boolean } | null;
        }>("/api/profile");

        setProfileForm({
          grade: data.profile?.grade ?? 9,
          subjects: (data.profile?.subjects as string[] | null) ?? ["Math"],
          goal: data.profile?.goal ?? LEARNING_GOALS[0].id,
          language: data.profile?.language ?? "ru"
        });
        setLanguage((data.profile?.language as "ru" | "kz" | null) ?? "ru");
        setNotifications({
          dailyReminderEnabled: data.settings?.dailyReminderEnabled ?? true,
          homeworkDeadlineReminderEnabled: data.settings?.homeworkDeadlineReminderEnabled ?? true
        });
        setPrivacy({
          showCharacter: data.gamification?.showCharacter ?? true,
          enableStreak: data.gamification?.enableStreak ?? true
        });
      } catch (error) {
        pushToast("Settings error", error instanceof Error ? error.message : "Failed to load settings");
      }
    })();
  }, [hydrated, user, pushToast, setLanguage]);

  const filteredSubjects = useMemo(
    () => SUBJECTS.filter((item) => item.toLowerCase().includes(subjectSearch.trim().toLowerCase())),
    [subjectSearch]
  );

  const toggleSubject = (subject: string) => {
    setProfileForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject) ? prev.subjects.filter((item) => item !== subject) : [...prev.subjects, subject]
    }));
  };

  const saveProfile = async () => {
    if (!profileForm.subjects.length) {
      pushToast("Validation", "Select at least one subject.");
      return;
    }
    try {
      await apiRequest("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          grade: profileForm.grade,
          subjects: profileForm.subjects,
          goal: profileForm.goal,
          language: profileForm.language
        })
      });
      setLanguage(profileForm.language as "ru" | "kz");
      pushToast("Saved", "Profile settings updated.");
    } catch (error) {
      pushToast("Save error", error instanceof Error ? error.message : "Failed to save profile");
    }
  };

  const saveSystemSettings = async (resetProgress = false) => {
    try {
      await apiRequest("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          notifications,
          gamification: { ...privacy, resetProgress }
        })
      });
      pushToast("Saved", resetProgress ? "Progress reset completed." : "Preferences updated.");
      setConfirmReset(false);
    } catch (error) {
      pushToast("Save error", error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  if (!hydrated || !user) return null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage account, profile, notifications, devices, and privacy.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  activeSection === section.id ? "border-primary bg-primary/10" : "border-border/60"
                }`}
              >
                <p className="font-medium">{section.title}</p>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          {activeSection === "account" ? (
            <>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Identity and session controls.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border/60 p-3 text-sm">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-muted-foreground">{user.email}</p>
                  <p className="text-muted-foreground">Role: {user.role}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                    logout();
                    router.push("/login");
                  }}
                >
                  Sign out
                </Button>
              </CardContent>
            </>
          ) : null}

          {activeSection === "profile" ? (
            <>
              <CardHeader>
                <CardTitle>Role/Profile</CardTitle>
                <CardDescription>These values drive personalization for lessons and homework.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="block space-y-1 text-sm">
                  <span>Grade (1-11)</span>
                  <Input
                    type="number"
                    min={1}
                    max={11}
                    value={profileForm.grade}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        grade: Math.max(1, Math.min(11, Number(event.target.value) || 1))
                      }))
                    }
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-sm">Subjects</p>
                  <Input placeholder="Search subject..." value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredSubjects.map((subject) => (
                      <label key={subject} className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                        <input type="checkbox" checked={profileForm.subjects.includes(subject)} onChange={() => toggleSubject(subject)} />
                        {subject}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1 text-sm">
                  <span>Learning goal</span>
                  <select
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
                    value={profileForm.goal}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, goal: event.target.value }))}
                  >
                    {LEARNING_GOALS.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Language</span>
                  <select
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
                    value={profileForm.language}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, language: event.target.value }))}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button onClick={saveProfile}>Save profile</Button>
              </CardContent>
            </>
          ) : null}

          {activeSection === "notifications" ? (
            <>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Control reminder cadence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                  <div>
                    <p className="font-medium">Daily reminder</p>
                    <p className="text-xs text-muted-foreground">Remind me to finish daily tasks.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.dailyReminderEnabled}
                    onChange={(event) =>
                      setNotifications((prev) => ({ ...prev, dailyReminderEnabled: event.target.checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                  <div>
                    <p className="font-medium">Homework deadline reminder</p>
                    <p className="text-xs text-muted-foreground">Notify before due dates.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.homeworkDeadlineReminderEnabled}
                    onChange={(event) =>
                      setNotifications((prev) => ({ ...prev, homeworkDeadlineReminderEnabled: event.target.checked }))
                    }
                  />
                </label>
                <Button onClick={() => saveSystemSettings(false)}>Save notifications</Button>
              </CardContent>
            </>
          ) : null}

          {activeSection === "devices" ? (
            <>
              <CardHeader>
                <CardTitle>Devices</CardTitle>
                <CardDescription>Current device defaults and status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border/60 p-3 text-sm">
                  <p className="font-medium">TGAM / EEG</p>
                  <p className="text-muted-foreground">Status: Connected</p>
                  <p className="text-xs text-muted-foreground">Last sync: 2 minutes ago</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 text-sm">
                  <p className="font-medium">ESP32</p>
                  <p className="text-muted-foreground">Status: Disconnected</p>
                  <p className="text-xs text-muted-foreground">Last sync: 25 minutes ago</p>
                </div>
                <Button variant="outline" onClick={() => pushToast("Device sync", "Manual sync requested.")}>
                  Refresh device status
                </Button>
              </CardContent>
            </>
          ) : null}

          {activeSection === "privacy" ? (
            <>
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>Visibility and retention preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                  <div>
                    <p className="font-medium">Show character data</p>
                    <p className="text-xs text-muted-foreground">Hide character widgets if needed.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacy.showCharacter}
                    onChange={(event) => setPrivacy((prev) => ({ ...prev, showCharacter: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                  <div>
                    <p className="font-medium">Enable streak tracking</p>
                    <p className="text-xs text-muted-foreground">Track daily continuity and rewards.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacy.enableStreak}
                    onChange={(event) => setPrivacy((prev) => ({ ...prev, enableStreak: event.target.checked }))}
                  />
                </label>
                <div className="flex gap-2">
                  <Button onClick={() => saveSystemSettings(false)}>Save privacy</Button>
                  <Button variant="outline" onClick={() => setConfirmReset(true)}>
                    Reset progress
                  </Button>
                </div>
                {confirmReset ? (
                  <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
                    <p>Reset XP, level, and streak for this account?</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => saveSystemSettings(true)}
                      >
                        Confirm reset
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
                    Light
                  </Button>
                  <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
                    Dark
                  </Button>
                </div>
              </CardContent>
            </>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
