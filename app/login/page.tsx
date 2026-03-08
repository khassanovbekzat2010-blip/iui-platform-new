"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuthUser = useAppStore((state) => state.setAuthUser);
  const pushToast = useAppStore((state) => state.pushToast);

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

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
        pushToast("Code generated (dev)", `Use this code: ${data.devCode}`);
      } else {
        pushToast("Code sent", data.message ?? "Check your email inbox.");
      }
    } catch (error) {
      pushToast("Failed to send code", error instanceof Error ? error.message : "Request failed");
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

      setAuthUser(data.user);
      pushToast("Signed in", data.user.email);
      const nextPath = searchParams.get("next");
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (error) {
      pushToast("Failed to verify", error instanceof Error ? error.message : "Request failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in with email code" : "Create account with email code"}</CardTitle>
          <CardDescription>We send a one-time code to your email. The code expires in 10 minutes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => {
                setMode("login");
                setStep(1);
              }}
            >
              Login
            </Button>
            <Button
              variant={mode === "register" ? "default" : "outline"}
              onClick={() => {
                setMode("register");
                setStep(1);
              }}
            >
              Register
            </Button>
          </div>

          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />

          <label className="block text-sm">
            Role
            <select
              className="mt-1 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as "student" | "teacher")}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </label>

          {mode === "register" ? <Input placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} /> : null}

          {step === 1 ? (
            <Button className="w-full" disabled={!email || sending || (mode === "register" && !name)} onClick={sendCode}>
              {sending ? "Sending..." : "Send verification code"}
            </Button>
          ) : (
            <>
              <Input
                placeholder="6-digit code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <Button className="w-full" disabled={code.length !== 6 || verifying} onClick={verifyCode}>
                {verifying ? "Verifying..." : "Verify code"}
              </Button>
              <Button variant="outline" className="w-full" onClick={sendCode} disabled={sending}>
                Resend code
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
