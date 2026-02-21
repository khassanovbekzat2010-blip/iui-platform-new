"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { loginAccounts } from "@/data/mock/auth";
import { defaultLanguage } from "@/data/mock/i18n";
import { createEngagementPoint } from "@/lib/engagement";
import { generateLessonAi } from "@/lib/mock-ai";
import { AppLanguage, AuthUser, EngagementSample, HomeworkItem, TeacherProfile, ToastMessage, TranscriptLine } from "@/lib/types";

interface LessonState {
  isRecording: boolean;
  elapsedSeconds: number;
  notes: string;
  transcript: TranscriptLine[];
  summary: string;
  complexTopics: Array<{ topic: string; explanation: string }>;
  recommendations: string[];
  homework: HomeworkItem[];
  analyzing: boolean;
  engagement: number;
  engagementHistory: EngagementSample[];
  dropMoments: string[];
  keyTopics: string[];
  difficultMoments: string[];
}

interface AppState {
  hydrated: boolean;
  language: AppLanguage;
  authUser: AuthUser | null;
  profile: TeacherProfile;
  lesson: LessonState;
  toasts: ToastMessage[];
  setHydrated: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setLanguage: (language: AppLanguage) => void;
  updateProfile: (profile: TeacherProfile) => void;
  setLessonNotes: (value: string) => void;
  addTranscriptLine: (line: TranscriptLine) => void;
  clearTranscript: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  tickRecording: () => void;
  setLessonAnalyzing: (value: boolean) => void;
  generateLessonResult: () => void;
  setEngagement: (value: number, dropped: boolean) => void;
  pushToast: (title: string, description?: string) => void;
  removeToast: (id: string) => void;
}

const initialLessonState: LessonState = {
  isRecording: false,
  elapsedSeconds: 0,
  notes: "",
  transcript: [],
  summary: "",
  complexTopics: [],
  recommendations: [],
  homework: [],
  analyzing: false,
  engagement: 88,
  engagementHistory: [createEngagementPoint(88, false)],
  dropMoments: []
  ,
  keyTopics: [],
  difficultMoments: []
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      language: defaultLanguage,
      authUser: null,
      profile: {
        fullName: "София Беннет",
        email: "teacher@test.com",
        subject: "Science & AI"
      },
      lesson: initialLessonState,
      toasts: [],
      setHydrated: () => set({ hydrated: true }),
      login: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        await new Promise((resolve) => setTimeout(resolve, 700));
        const account = loginAccounts.find((item) => item.email === normalizedEmail && item.password === password.trim());
        if (!account) {
          return false;
        }
        set((state) => ({
          authUser: account.user,
          profile:
            account.user.role === "teacher"
              ? state.profile
              : {
                  fullName: account.user.name,
                  email: account.user.email,
                  subject: "Student"
                }
        }));
        return true;
      },
      logout: () => set({ authUser: null, lesson: initialLessonState }),
      setLanguage: (language) => set({ language }),
      updateProfile: (profile) => set({ profile }),
      setLessonNotes: (value) => set((state) => ({ lesson: { ...state.lesson, notes: value } })),
      addTranscriptLine: (line) =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            transcript: [...state.lesson.transcript, line]
          }
        })),
      clearTranscript: () =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            transcript: []
          }
        })),
      startRecording: () =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            isRecording: true,
            elapsedSeconds: 0,
            transcript: [],
            summary: "",
            complexTopics: [],
            recommendations: [],
            homework: [],
            dropMoments: [],
            keyTopics: [],
            difficultMoments: []
          }
        })),
      stopRecording: () =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            isRecording: false
          }
        })),
      tickRecording: () =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            elapsedSeconds: state.lesson.isRecording ? state.lesson.elapsedSeconds + 1 : state.lesson.elapsedSeconds
          }
        })),
      setLessonAnalyzing: (value) =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            analyzing: value
          }
        })),
      generateLessonResult: () => {
        const { lesson } = get();
        const result = generateLessonAi({
          transcript: lesson.transcript,
          notes: lesson.notes,
          dropMoments: lesson.dropMoments,
          engagementValues: lesson.engagementHistory.map((item) => item.value)
        });
        set((state) => ({
          lesson: {
            ...state.lesson,
            transcript: result.transcript,
            summary: result.summary,
            keyTopics: result.keyTopics,
            difficultMoments: result.difficultMoments,
            complexTopics: result.complexTopics,
            recommendations: result.recommendations,
            homework: result.homework,
            analyzing: false
          }
        }));
      },
      setEngagement: (value, dropped) =>
        set((state) => {
          const point = createEngagementPoint(value, dropped);
          const nextHistory = [...state.lesson.engagementHistory, point].slice(-18);
          const nextDrops = dropped ? [...state.lesson.dropMoments, point.label].slice(-6) : state.lesson.dropMoments;
          return {
            lesson: {
              ...state.lesson,
              engagement: value,
              engagementHistory: nextHistory,
              dropMoments: nextDrops
            }
          };
        }),
      pushToast: (title, description) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, title, description }
          ]
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((item) => item.id !== id)
        }))
    }),
    {
      name: "iui-app-state",
      partialize: (state) => ({
        language: state.language,
        authUser: state.authUser,
        profile: state.profile,
        lesson: {
          ...state.lesson,
          isRecording: false,
          analyzing: false
        }
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      }
    }
  )
);
