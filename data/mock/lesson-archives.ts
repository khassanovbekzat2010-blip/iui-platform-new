export interface LessonArchiveItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  keyTopics: string[];
  homework: string[];
}

export const lessonArchives: LessonArchiveItem[] = [
  {
    id: "archive-1",
    date: "2026-02-18",
    title: "Forces and Motion",
    summary: "Разобрали второй закон Ньютона и типовые задачи на силу/ускорение.",
    keyTopics: ["Newton's law", "Force vectors", "Acceleration"],
    homework: ["Решить 6 задач на F=ma", "Подготовить мини-конспект по векторным силам"]
  },
  {
    id: "archive-2",
    date: "2026-02-20",
    title: "Energy Conservation",
    summary: "Практика по закону сохранения энергии и переходам потенциальной/кинетической.",
    keyTopics: ["Conservation", "Potential energy", "Kinetic energy"],
    homework: ["3 задачи на закон сохранения", "Объяснить один пример своими словами"]
  }
];
