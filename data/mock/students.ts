import { HomeworkItem, StudentLessonHistory, StudentRow, TrendPoint } from "@/lib/types";

export const students: StudentRow[] = [
  {
    id: "st-01",
    avatar: "AR",
    name: "Ava Ramirez",
    grade: "10-A",
    engagement: 94,
    performance: 92,
    status: "online"
  },
  {
    id: "st-02",
    avatar: "LK",
    name: "Liam Kim",
    grade: "10-A",
    engagement: 81,
    performance: 88,
    status: "break"
  },
  {
    id: "st-03",
    avatar: "JM",
    name: "Julia Moore",
    grade: "9-B",
    engagement: 76,
    performance: 79,
    status: "offline"
  },
  {
    id: "st-04",
    avatar: "NT",
    name: "Noah Taylor",
    grade: "11-C",
    engagement: 89,
    performance: 91,
    status: "online"
  }
];

export const studentTrendById: Record<string, TrendPoint[]> = {
  "st-01": [
    { label: "Mon", value: 86 },
    { label: "Tue", value: 90 },
    { label: "Wed", value: 93 },
    { label: "Thu", value: 91 },
    { label: "Fri", value: 94 }
  ],
  "st-02": [
    { label: "Mon", value: 72 },
    { label: "Tue", value: 78 },
    { label: "Wed", value: 80 },
    { label: "Thu", value: 84 },
    { label: "Fri", value: 81 }
  ],
  "st-03": [
    { label: "Mon", value: 68 },
    { label: "Tue", value: 73 },
    { label: "Wed", value: 75 },
    { label: "Thu", value: 77 },
    { label: "Fri", value: 76 }
  ],
  "st-04": [
    { label: "Mon", value: 83 },
    { label: "Tue", value: 85 },
    { label: "Wed", value: 88 },
    { label: "Thu", value: 90 },
    { label: "Fri", value: 89 }
  ]
};

export const studentLessonsById: Record<string, StudentLessonHistory[]> = {
  "st-01": [
    { id: "l-1", date: "Feb 18", lesson: "Physics", score: 95, notes: "Strong focus" },
    { id: "l-2", date: "Feb 19", lesson: "Math", score: 89, notes: "Great participation" }
  ],
  "st-02": [
    { id: "l-3", date: "Feb 18", lesson: "Physics", score: 82, notes: "Needed prompts" },
    { id: "l-4", date: "Feb 19", lesson: "Math", score: 86, notes: "Steady progress" }
  ],
  "st-03": [
    { id: "l-5", date: "Feb 18", lesson: "Biology", score: 78, notes: "Distracted at midpoint" },
    { id: "l-6", date: "Feb 19", lesson: "History", score: 80, notes: "Improved recall" }
  ],
  "st-04": [
    { id: "l-7", date: "Feb 18", lesson: "CS", score: 92, notes: "Excellent response time" },
    { id: "l-8", date: "Feb 19", lesson: "Math", score: 90, notes: "Consistent focus" }
  ]
};

export const studentAiRecommendationsById: Record<string, string[]> = {
  "st-01": ["Introduce peer mentoring tasks.", "Increase challenge level in applied problems."],
  "st-02": ["Add 5-minute recap checkpoints.", "Use visual prompts in word problems."],
  "st-03": ["Break lessons into shorter knowledge blocks.", "Use quick oral quizzes every 10 minutes."],
  "st-04": ["Assign advanced project role.", "Encourage explanation of solutions to peers."]
};

export const studentHomeworkById: Record<string, HomeworkItem[]> = {
  "st-01": [
    { id: "h-1", title: "Force and motion worksheet", dueDate: "Feb 24", status: "in-progress" },
    { id: "h-2", title: "Algebra challenge set", dueDate: "Feb 26", status: "planned" }
  ],
  "st-02": [
    { id: "h-3", title: "Physics quick quiz", dueDate: "Feb 23", status: "in-progress" },
    { id: "h-4", title: "Geometry recap", dueDate: "Feb 27", status: "planned" }
  ],
  "st-03": [
    { id: "h-5", title: "Biology flashcards", dueDate: "Feb 25", status: "done" },
    { id: "h-6", title: "History timeline", dueDate: "Feb 28", status: "in-progress" }
  ],
  "st-04": [
    { id: "h-7", title: "Algorithm design task", dueDate: "Feb 24", status: "in-progress" },
    { id: "h-8", title: "Advanced equations", dueDate: "Feb 26", status: "planned" }
  ]
};
