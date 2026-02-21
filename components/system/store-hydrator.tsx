"use client";

import { useEffect } from "react";

import { useAppStore } from "@/store/app-store";

export function StoreHydrator() {
  const hydrated = useAppStore((state) => state.hydrated);
  const setHydrated = useAppStore((state) => state.setHydrated);

  useEffect(() => {
    if (!hydrated) {
      setHydrated();
    }
  }, [hydrated, setHydrated]);

  return null;
}
