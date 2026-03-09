import { AppLanguage } from "@/lib/types";

export const defaultLanguage: AppLanguage = "ru";

export const dictionary = {
  ru: {
    appTagline: "Нейро-AI платформа для обучения",
    loginTitle: "Вход в IUI",
    loginHint: "Используйте локальный пароль IUI или резервный код",
    email: "Email",
    password: "Пароль",
    signIn: "Войти",
    teacher: "Учитель",
    student: "Ученик",
    settingsSaved: "Настройки сохранены",
    recordingStarted: "Запись началась",
    recordingStopped: "Запись завершена",
    aiDone: "AI-анализ завершен",
    noPermission: "Нет доступа к этому разделу"
  },
  kz: {
    appTagline: "Оқытуға арналған нейро-AI платформа",
    loginTitle: "IUI жүйесіне кіру",
    loginHint: "IUI құпиясөзін немесе резервтік кодты пайдаланыңыз",
    email: "Email",
    password: "Құпиясөз",
    signIn: "Кіру",
    teacher: "Мұғалім",
    student: "Оқушы",
    settingsSaved: "Баптаулар сақталды",
    recordingStarted: "Жазба басталды",
    recordingStopped: "Жазба аяқталды",
    aiDone: "AI талдауы дайын",
    noPermission: "Бұл бөлімге қолжетім жоқ"
  }
} as const;
