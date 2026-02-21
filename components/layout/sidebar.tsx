"use client";

import {
  LayoutDashboard,
  LineChart,
  Mic,
  Settings,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/data/mock/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  mic: Mic,
  users: Users,
  "line-chart": LineChart,
  settings: Settings
};

export function Sidebar() {
  const pathname = usePathname();
  const authUser = useAppStore((state) => state.authUser);
  const items = navigationItems.filter((item) =>
    authUser?.role ? (item.roles ? item.roles.includes(authUser.role) : true) : false
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-72 border-r border-border/50 bg-card/80 px-4 py-6 backdrop-blur md:block">
      <div className="mb-10 px-2">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">IUI Platform</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Learning OS</h1>
      </div>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent",
                isActive ? "bg-primary text-primary-foreground shadow-soft hover:bg-primary/95" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
