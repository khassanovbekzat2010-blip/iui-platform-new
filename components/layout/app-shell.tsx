"use client";

import { EngagementSimulator } from "@/components/system/engagement-simulator";
import { ToastViewport } from "@/components/system/toast-viewport";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { navigationItems } from "@/data/mock/navigation";
import { canAccessPath } from "@/lib/permissions";
import { useAppStore } from "@/store/app-store";
import Link from "next/link";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
  const user = useAppStore((state) => state.authUser);
  const navRole = user?.role === "admin" ? "teacher" : user?.role;

  const visibleItems = navigationItems.filter((item) =>
    navRole ? (item.roles ? item.roles.includes(navRole) : true) : false
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    if (user && pathname === "/login") {
      router.replace("/dashboard");
      return;
    }
    if (user && !canAccessPath(user.role, pathname, user.studentId)) {
      router.replace("/dashboard");
    }
  }, [hydrated, pathname, router, user]);

  if (!hydrated) {
    return (
      <div className="min-h-screen p-6">
        <Skeleton className="h-16 w-full" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (pathname === "/login") {
    return (
      <div className="min-h-screen">
        <ToastViewport />
        {children}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-6">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastViewport />
      <EngagementSimulator />
      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col p-3 md:p-6">
          <TopNavbar onMenuClick={() => setMobileOpen((prev) => !prev)} />
          {mobileOpen && (
            <nav className="mb-4 mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-card p-3 md:hidden">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-border/50 px-3 py-2 text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          <main className="mt-4 flex-1 animate-fade-in-up">{children}</main>
        </div>
      </div>
    </div>
  );
}
