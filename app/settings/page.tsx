"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { connectedDevices, schoolInfo } from "@/data/mock/settings";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/app-store";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const profile = useAppStore((state) => state.profile);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const pushToast = useAppStore((state) => state.pushToast);

  const [form, setForm] = useState(profile);

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  const onSaveProfile = () => {
    updateProfile(form);
    pushToast(t(language, "settingsSaved"));
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-[var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Профиль, язык, тема и статус устройств.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Информация о школе</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={schoolInfo.name} readOnly />
            <Input value={schoolInfo.city} readOnly />
            <Input value={schoolInfo.timezone} readOnly />
            <Input value={schoolInfo.academicYear} readOnly />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Профиль преподавателя</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
            <Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <Input value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} />
            <Button className="w-full" onClick={onSaveProfile} disabled={!form.fullName || !form.email}>
              Сохранить профиль
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Локализация и тема</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={language === "ru" ? "default" : "outline"} onClick={() => setLanguage("ru")}>
                Русский
              </Button>
              <Button variant={language === "en" ? "default" : "outline"} onClick={() => setLanguage("en")}>
                English
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
                Светлая
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
                Темная
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Связаться с нами</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value="+77783034567" readOnly />
            <Button
              className="w-full"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText("+77783034567");
                  pushToast("Номер скопирован", "+77783034567");
                } catch {
                  pushToast("Не удалось скопировать", "Скопируйте номер вручную");
                }
              }}
            >
              Скопировать номер
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Статус подключенных устройств</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectedDevices.map((device) => (
            <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
              <div>
                <p className="font-medium">{device.name}</p>
                <p className="text-sm text-muted-foreground">
                  {device.type} • Last sync {device.lastSync}
                </p>
              </div>
              <Badge variant={device.connected ? "success" : "danger"}>
                {device.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
