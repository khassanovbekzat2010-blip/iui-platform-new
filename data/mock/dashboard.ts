import { LessonSummary, QuickAction, StatCardData, TranscriptLine } from "@/lib/types";

export const dashboardStats: StatCardData[] = [
  {
    id: "students",
    title: "Students",
    value: "428",
    delta: "+12 this week",
    trend: "up"
  },
  {
    id: "active-lessons",
    title: "Active Lessons",
    value: "9",
    delta: "2 currently live",
    trend: "neutral"
  },
  {
    id: "avg-engagement",
    title: "Avg. Engagement",
    value: "86%",
    delta: "+4.8% vs last week",
    trend: "up"
  }
];

export const liveEngagement = {
  percent: 91,
  stateLabel: "Focused"
};

export const todayLessons: LessonSummary[] = [
  {
    id: "lesson-1",
    subject: "Physics",
    classroom: "10-A",
    time: "09:00 - 09:45",
    attendees: 27
  },
  {
    id: "lesson-2",
    subject: "Mathematics",
    classroom: "9-B",
    time: "11:00 - 11:45",
    attendees: 25
  },
  {
    id: "lesson-3",
    subject: "Computer Science",
    classroom: "11-C",
    time: "13:30 - 14:15",
    attendees: 29
  }
];

export const quickActions: QuickAction[] = [
  {
    id: "report",
    title: "Create Weekly Report",
    description: "Generate a summary of engagement and attendance."
  },
  {
    id: "homework",
    title: "Auto Homework",
    description: "Build AI-tailored assignments from live lesson transcript."
  },
  {
    id: "message",
    title: "Message Class",
    description: "Send updates to all students in one class."
  }
];

export const lessonTranscript: TranscriptLine[] = [
  {
    id: "line-1",
    speaker: "Teacher",
    text: "Let's revisit Newton's second law with a practical example.",
    timestamp: "09:14"
  },
  {
    id: "line-2",
    speaker: "Student",
    text: "If force doubles and mass stays constant, acceleration doubles too?",
    timestamp: "09:15"
  },
  {
    id: "line-3",
    speaker: "Teacher",
    text: "Exactly. We can model that with F = m * a and compare two scenarios.",
    timestamp: "09:15"
  }
];

export const lessonAiInsights = [
  "Most students respond best when examples are visual and short.",
  "Drop in engagement detected after 22 minutes: consider a 2-minute quiz checkpoint.",
  "Top confusion point: relation between force and vector direction."
];
