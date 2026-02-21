import { NavItem } from "@/lib/types";

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", roles: ["teacher", "student"] },
  { label: "Live Lesson", href: "/lesson", icon: "mic", roles: ["teacher", "student"] },
  { label: "Students", href: "/students", icon: "users", roles: ["teacher"] },
  { label: "Analytics", href: "/analytics", icon: "line-chart", roles: ["teacher"] },
  { label: "Settings", href: "/settings", icon: "settings", roles: ["teacher", "student"] }
];
