"use client";

import { Bell, Menu, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store/app-store";

interface TopNavbarProps {
  onMenuClick: () => void;
}

export function TopNavbar({ onMenuClick }: TopNavbarProps) {
  const router = useRouter();
  const user = useAppStore((state) => state.authUser);
  const language = useAppStore((state) => state.language);
  const logout = useAppStore((state) => state.logout);
  const pushToast = useAppStore((state) => state.pushToast);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 shadow-soft backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground">{t(language, "appTagline")}</p>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          className="relative"
          onClick={() => pushToast(language === "kz" ? "Хабарламалар" : "Уведомления", language === "kz" ? "Жаңа хабарлама жоқ" : "Новых уведомлений нет")}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-10 rounded-full px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{user?.name.slice(0, 2).toUpperCase() ?? "IU"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => router.push(user?.role === "student" ? "/hero" : "/settings")}>
              <User className="h-4 w-4" />
              {user?.role === "student" ? (language === "kz" ? "Профиль" : "Профиль") : language === "kz" ? "Аккаунт" : "Аккаунт"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>{language === "kz" ? "Баптаулар" : "Настройки"}</DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                logout();
                router.push("/login");
              }}
            >
              {language === "kz" ? "Шығу" : "Выйти"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
