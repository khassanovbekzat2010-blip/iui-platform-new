"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type Mode = "login" | "register";
type Method = "password" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const pushToast = useAppStore((state) => state.pushToast);

  const [mode, setMode] = useState<Mode>("login");
  const [method, setMethod] = useState<Method>("password");
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const finishAuth = (data: {
    user: { id: string; email: string; role: "student" | "teacher" | "admin"; name: string; studentId?: string };
  }) => {
    setAuthUser(data.user);
    pushToast("Вход выполнен", data.user.email);
    const nextPath = searchParams.get("next");
    router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard");
  };

  const submitPasswordAuth = async () => {
    setSending(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/password/login" : "/api/auth/password/register";
      const data = await apiRequest<{
        user: { id: string; email: string; role: "student" | "teacher" | "admin"; name: string; studentId?: string };
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          name: name || undefined
        })
      });
      finishAuth(data);
    } catch (error) {
      pushToast("Ошибка входа", error instanceof Error ? error.message : "Запрос не выполнен");
    } finally {
      setSending(false);
    }
  };

  const sendCode = async () => {
    setSending(true);
    try {
      const data = await apiRequest<{ message?: string; devCode?: string }>("/api/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email, role, mode, name: name || undefined })
      });
      setStep(2);
      if (data.devCode) {
        setCode(data.devCode);
        pushToast("Код сгенерирован", `Используй код: ${data.devCode}`);
      } else {
        pushToast("Код отправлен", data.message ?? "Проверь входящие письма.");
      }
    } catch (error) {
      pushToast("Не удалось отправить код", error instanceof Error ? error.message : "Запрос не выполнен");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    setVerifying(true);
    try {
      const data = await apiRequest<{
        user: { id: string; email: string; role: "student" | "teacher" | "admin"; name: string; studentId?: string };
      }>("/api/auth/email/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code, mode, role, name: name || undefined })
      });
      finishAuth(data);
    } catch (error) {
      pushToast("Не удалось подтвердить код", error instanceof Error ? error.message : "Запрос не выполнен");
    } finally {
      setVerifying(false);
    }
  };

  const isPasswordMode = method === "password";

  return (
    <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,#f3f7fb_0%,#eef2ff_100%)] p-4">
      <Card className="w-full max-w-lg border-white/60 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-3xl">Вход в IUI</CardTitle>
              <CardDescription>
                Основной способ входа: email и пароль аккаунта IUI. Код по почте оставлен как резервный вариант.
              </CardDescription>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
              {isPasswordMode ? <LockKeyhole className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => {
                setMode("login");
                setStep(1);
              }}
            >
              Войти
            </Button>
            <Button
              variant={mode === "register" ? "default" : "outline"}
              onClick={() => {
                setMode("register");
                setStep(1);
              }}
            >
              Создать аккаунт
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant={method === "password" ? "secondary" : "outline"} onClick={() => setMethod("password")}>
              Пароль
            </Button>
            <Button
              variant={method === "otp" ? "secondary" : "outline"}
              onClick={() => {
                setMethod("otp");
                setStep(1);
              }}
            >
              Код на почту
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Роль</label>
            <select
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as "student" | "teacher")}
            >
              <option value="student">Ученик</option>
              <option value="teacher">Учитель</option>
            </select>
          </div>

          {mode === "register" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Полное имя</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Имя и фамилия" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            </div>
          ) : null}

          {isPasswordMode ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Пароль IUI</label>
                <Input
                  type="password"
                  placeholder={mode === "register" ? "Придумай пароль" : "Введи пароль"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">
                Здесь используется локальный пароль аккаунта IUI. Пароль от Gmail или другого почтового сервиса не нужен и не используется.
              </p>
              <Button
                className="w-full"
                disabled={!email || !password || sending || (mode === "register" && !name)}
                onClick={submitPasswordAuth}
              >
                {sending ? "Подождите..." : mode === "login" ? "Войти по паролю" : "Создать аккаунт"}
              </Button>
            </>
          ) : step === 1 ? (
            <Button className="w-full" disabled={!email || sending || (mode === "register" && !name)} onClick={sendCode}>
              {sending ? "Отправка..." : "Получить код"}
            </Button>
          ) : (
            <>
              <Input
                placeholder="Код из письма"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <Button className="w-full" disabled={code.length !== 6 || verifying} onClick={verifyCode}>
                {verifying ? "Проверка..." : "Подтвердить код"}
              </Button>
              <Button variant="outline" className="w-full" onClick={sendCode} disabled={sending}>
                Отправить код еще раз
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
