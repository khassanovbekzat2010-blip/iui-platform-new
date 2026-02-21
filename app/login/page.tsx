"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginAccounts } from "@/data/mock/auth";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/app-store";

export default function LoginPage() {
  const router = useRouter();
  const language = useAppStore((state) => state.language);
  const login = useAppStore((state) => state.login);
  const pushToast = useAppStore((state) => state.pushToast);

  const [email, setEmail] = useState(loginAccounts[0].email);
  const [password, setPassword] = useState(loginAccounts[0].password);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);

    if (!success) {
      pushToast("Ошибка входа", "Проверьте email и пароль");
      return;
    }
    pushToast("Успешный вход", email);
    router.push("/dashboard");
  };

  return (
    <section className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t(language, "loginTitle")}</CardTitle>
          <CardDescription>{t(language, "loginHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t(language, "email")} />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t(language, "password")}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmail("teacher@test.com");
                setPassword("123456");
              }}
            >
              {t(language, "teacher")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEmail("student@test.com");
                setPassword("123456");
              }}
            >
              {t(language, "student")}
            </Button>
          </div>
          <Button className="w-full" disabled={loading || !email || !password} onClick={handleSignIn}>
            {loading ? "Загрузка..." : t(language, "signIn")}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
