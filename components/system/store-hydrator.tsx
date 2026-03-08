"use client";

import { useEffect } from "react";

import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function StoreHydrator() {
  const hydrated = useAppStore((state) => state.hydrated);
  const setHydrated = useAppStore((state) => state.setHydrated);
  const setAuthUser = useAppStore((state) => state.setAuthUser);

  useEffect(() => {
    if (hydrated) {
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiRequest<{
          user: { id: string; email: string; role: "teacher" | "student" | "admin"; name: string; studentId?: string };
        }>("/api/auth/session");
        if (mounted) {
          setAuthUser(data.user);
        }
      } catch {
        if (mounted) {
          setAuthUser(null);
        }
      } finally {
        if (mounted) {
          setHydrated();
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [hydrated, setAuthUser, setHydrated]);

  return null;
}
