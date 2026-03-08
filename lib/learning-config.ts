export const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "English",
  "Kazakh Language",
  "Literature",
  "Informatics"
] as const;

export const LEARNING_GOALS = [
  { id: "improve_grades", label: "Подтянуть оценки" },
  { id: "exam_prep", label: "Подготовка к экзамену" },
  { id: "olympiad", label: "Олимпиада" }
] as const;

export const LANGUAGES = [
  { id: "ru", label: "RU" },
  { id: "kz", label: "KZ" }
] as const;

export const AVATAR_IDS = Array.from({ length: 12 }, (_, index) => `avatar-${String(index + 1).padStart(2, "0")}`);
