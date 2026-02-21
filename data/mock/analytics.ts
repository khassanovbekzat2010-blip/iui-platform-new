import { AnalyticsSeriesPoint, ClassPerformancePoint } from "@/lib/types";

export const engagementOverTime: AnalyticsSeriesPoint[] = [
  { label: "09:00", engagement: 72, attendance: 90 },
  { label: "10:00", engagement: 78, attendance: 92 },
  { label: "11:00", engagement: 84, attendance: 91 },
  { label: "12:00", engagement: 79, attendance: 88 },
  { label: "13:00", engagement: 86, attendance: 94 },
  { label: "14:00", engagement: 89, attendance: 96 }
];

export const classPerformance: ClassPerformancePoint[] = [
  { className: "9-A", score: 81 },
  { className: "9-B", score: 77 },
  { className: "10-A", score: 88 },
  { className: "10-B", score: 84 },
  { className: "11-C", score: 91 }
];
