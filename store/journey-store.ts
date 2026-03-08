"use client";

import { create } from "zustand";

type PendingTask = {
  taskId: string;
  optimisticCompleted: boolean;
};

interface JourneyState {
  pendingTasks: PendingTask[];
  addPendingTask: (taskId: string) => void;
  resolvePendingTask: (taskId: string) => void;
}

export const useJourneyStore = create<JourneyState>((set) => ({
  pendingTasks: [],
  addPendingTask: (taskId) =>
    set((state) => ({
      pendingTasks: [...state.pendingTasks, { taskId, optimisticCompleted: true }]
    })),
  resolvePendingTask: (taskId) =>
    set((state) => ({
      pendingTasks: state.pendingTasks.filter((item) => item.taskId !== taskId)
    }))
}));
