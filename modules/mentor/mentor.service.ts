type MentorContext = {
  weakTopics: string[];
  incorrectCount: number;
  streak: number;
  nextStepTitle?: string;
};

const hints = [
  "Разбей задачу на маленькие шаги: формула -> подстановка -> ответ.",
  "Сначала реши 1 легкий пример по теме, потом возвращайся к сложному.",
  "Сравни свой ответ с условием: что именно спрашивают?",
  "Если застрял, используй подсказку и попробуй еще раз через 2 минуты."
];

export function generateMentorGuidance(context: MentorContext) {
  const weakTopic = context.weakTopics[0];
  const baseHint = hints[(context.incorrectCount + context.streak) % hints.length];
  const nextStep = context.nextStepTitle
    ? `Следующий шаг пути героя: ${context.nextStepTitle}.`
    : "Продолжай текущий квест, ты близко к награде.";

  return {
    title: weakTopic ? `Фокус на теме: ${weakTopic}` : "Хороший темп, держи ритм",
    hint: baseHint,
    nextStep
  };
}
