import { NavItem } from "@/lib/types";

export const navigationItems: NavItem[] = [
  { label: "Onboarding", href: "/onboarding", icon: "flag", roles: ["teacher", "student"] },
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", roles: ["teacher", "student"] },
  { label: "Live Lesson", href: "/lesson", icon: "mic", roles: ["teacher"] },
  { label: "Lesson Archive", href: "/archive", icon: "calendar-check-2", roles: ["teacher", "student"] },
  { label: "Hero", href: "/hero", icon: "shield", roles: ["student"] },
  { label: "Teacher", href: "/teacher", icon: "graduation-cap", roles: ["teacher"] },
  { label: "Homework", href: "/homework", icon: "book-open-check", roles: ["student"] },
  { label: "Students", href: "/students", icon: "users", roles: ["teacher"] },
  { label: "Analytics", href: "/analytics", icon: "line-chart", roles: ["teacher"] },
  { label: "Settings", href: "/settings", icon: "settings", roles: ["teacher", "student"] }
];
