import { AppLanguage } from "@/lib/types";

export const defaultLanguage: AppLanguage = "ru";

export const dictionary = {
  ru: {
    appTagline: "AI образовательная платформа",
    loginTitle: "Вход в IUI",
    loginHint: "Используйте тестовый аккаунт",
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
  en: {
    appTagline: "AI educational platform",
    loginTitle: "Sign in to IUI",
    loginHint: "Use mock account",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    teacher: "Teacher",
    student: "Student",
    settingsSaved: "Settings saved",
    recordingStarted: "Recording started",
    recordingStopped: "Recording stopped",
    aiDone: "AI analysis ready",
    noPermission: "No permission for this page"
  }
} as const;
