export type UserStatus = "online" | "offline" | "break";
export type AppRole = "teacher" | "student";
export type AppLanguage = "ru" | "en";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: AppRole[];
}

export interface StatCardData {
  id: string;
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
}

export interface LessonSummary {
  id: string;
  subject: string;
  classroom: string;
  time: string;
  attendees: number;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
}

export interface StudentRow {
  id: string;
  avatar: string;
  name: string;
  grade: string;
  engagement: number;
  performance: number;
  status: UserStatus;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface StudentLessonHistory {
  id: string;
  date: string;
  lesson: string;
  score: number;
  notes: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  dueDate: string;
  status: "planned" | "in-progress" | "done";
}

export interface DeviceStatus {
  id: string;
  name: string;
  type: "EEG" | "ESP32" | "Sensor";
  connected: boolean;
  lastSync: string;
}

export interface SchoolInfo {
  name: string;
  city: string;
  timezone: string;
  academicYear: string;
}

export interface TeacherProfile {
  fullName: string;
  email: string;
  subject: string;
}

export interface AnalyticsSeriesPoint {
  label: string;
  engagement: number;
  attendance: number;
}

export interface ClassPerformancePoint {
  className: string;
  score: number;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export interface AuthUser {
  email: string;
  role: AppRole;
  name: string;
  studentId?: string;
}

export interface EngagementSample {
  label: string;
  value: number;
  dropped: boolean;
}

export interface ComplexTopic {
  topic: string;
  explanation: string;
}

export interface LessonAiResult {
  transcript: TranscriptLine[];
  keyTopics: string[];
  difficultMoments: string[];
  summary: string;
  complexTopics: ComplexTopic[];
  recommendations: string[];
  homework: HomeworkItem[];
}

export interface Lesson {
  id: string;
  title: string;
  transcript: TranscriptLine[];
  summary: string;
  keyTopics: string[];
}

export interface Student {
  id: string;
  name: string;
  grade: string;
}

export interface Homework {
  id: string;
  title: string;
  dueDate: string;
  status: "planned" | "in-progress" | "done";
}

export interface Engagement {
  label: string;
  value: number;
  dropped: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
}
