import { TaskType } from "@prisma/client";

type SeedTask = {
  grade: number;
  subject: string;
  topic: string;
  difficulty: string;
  type: TaskType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

const baseTopics = {
  Math: ["Linear equations", "Fractions", "Geometry basics", "Functions", "Probability"],
  Physics: ["Force", "Motion", "Energy", "Electricity", "Optics"],
  Chemistry: ["Atoms", "Periodic table", "Acids and bases", "Reactions", "Solutions"],
  Biology: ["Cells", "Genetics", "Ecosystems", "Human body", "Photosynthesis"],
  History: ["Ancient world", "Middle ages", "Kazakh history", "Industrial era", "World wars"],
  Geography: ["Maps", "Climate", "Rivers", "Population", "Natural resources"],
  English: ["Grammar", "Vocabulary", "Tenses", "Reading", "Prepositions"],
  "Kazakh Language": ["Сөз таптары", "Синтаксис", "Фонетика", "Тіл мәдениеті", "Сөздік қор"],
  Literature: ["Poetry", "Characters", "Plot", "Genres", "Themes"],
  Informatics: ["Algorithms", "Data types", "Loops", "Networks", "Cyber safety"]
} as const;

export function createDailyTaskSeed(): SeedTask[] {
  const tasks: SeedTask[] = [];
  const grades = [5, 6, 7, 8, 9, 10, 11];

  for (const grade of grades) {
    for (const [subject, topics] of Object.entries(baseTopics)) {
      const topic = topics[(grade + subject.length) % topics.length];
      const parity = (grade + subject.length) % 2 === 0;

      if (parity) {
        tasks.push({
          grade,
          subject,
          topic,
          difficulty: grade >= 9 ? "medium" : "easy",
          type: TaskType.MULTIPLE_CHOICE,
          question: `${subject}: choose the best statement about "${topic}" for grade ${grade}.`,
          options: [
            "Statement A",
            "Statement B",
            "Statement C",
            "Statement D"
          ],
          correctAnswer: "Statement B",
          explanation: `For ${topic}, statement B matches the core concept taught in grade ${grade}.`
        });
      } else {
        tasks.push({
          grade,
          subject,
          topic,
          difficulty: grade >= 9 ? "hard" : "medium",
          type: TaskType.SHORT_ANSWER,
          question: `${subject}: write one key term for topic "${topic}" (grade ${grade}).`,
          correctAnswer: topic.split(" ")[0].toLowerCase(),
          explanation: `A valid short answer contains the key term "${topic.split(" ")[0]}".`
        });
      }
    }
  }

  return tasks.slice(0, 70);
}
