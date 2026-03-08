"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const language = useAppStore((state) => state.language);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="outline" size="sm">{language === "kz" ? "Тақырып" : "Тема"}</Button>;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(isDark ? "light" : "dark")} className="gap-2">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {isDark ? (language === "kz" ? "Жарық" : "Светлая") : language === "kz" ? "Қараңғы" : "Темная"}
    </Button>
  );
}
