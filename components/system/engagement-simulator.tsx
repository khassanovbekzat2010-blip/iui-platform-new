"use client";

import { useEffect } from "react";

import { createNextEngagement } from "@/lib/engagement";
import { useAppStore } from "@/store/app-store";

export function EngagementSimulator() {
  const authUser = useAppStore((state) => state.authUser);
  const setEngagement = useAppStore((state) => state.setEngagement);

  useEffect(() => {
    if (!authUser) {
      return;
    }
    const interval = window.setInterval(() => {
      const currentEngagement = useAppStore.getState().lesson.engagement;
      const { value, dropped } = createNextEngagement(currentEngagement);
      setEngagement(value, dropped);
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authUser, setEngagement]);

  return null;
}
