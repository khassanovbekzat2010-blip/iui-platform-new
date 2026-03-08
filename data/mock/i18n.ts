import { AppLanguage } from "@/lib/types";

export const defaultLanguage: AppLanguage = "ru";

export const dictionary = {
  ru: {
    appTagline: "AI образовательная платформа",
    loginTitle: "Вход в IUI",
    loginHint: "Используйте код подтверждения",
    email: "Email",
    password: "Пароль",
    signIn: "Войти",
    teacher: "Учитель",
    student: "Ученик",
    settingsSaved: "Настройки сохранены",
    recordingStarted: "Запись началась",
    recordingStopped: "Запись завершена",
    aiDone: "AI анализ готов",
    noPermission: "Нет доступа к разделу"
  },
  kz: {
    appTagline: "AI білім беру платформасы",
    loginTitle: "IUI жүйесіне кіру",
    loginHint: "Растау кодын пайдаланыңыз",
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
