"use client";

import { useEffect } from "react";

import { useAppStore } from "@/store/app-store";

export function ToastViewport() {
  const toasts = useAppStore((state) => state.toasts);
  const removeToast = useAppStore((state) => state.removeToast);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id);
      }, 3200)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-72 rounded-xl border border-border bg-card p-3 shadow-floating">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
