import { create } from "zustand";

export interface RollingBackfillState {
  chatId: string | null;
  status: "idle" | "running";
  totalBatches: number;
  completedBatches: number;
  currentRangeStart: number | null;
  currentRangeEnd: number | null;
  abortController: AbortController | null;
  startBackfill: (chatId: string) => void;
  updateProgress: (completed: number, rangeStart?: number, rangeEnd?: number) => void;
  setTotalBatches: (total: number) => void;
  stopBackfill: () => void;
  resetBackfill: () => void;
}

export const useRollingBackfillStore = create<RollingBackfillState>((set, get) => ({
  chatId: null,
  status: "idle",
  totalBatches: 0,
  completedBatches: 0,
  currentRangeStart: null,
  currentRangeEnd: null,
  abortController: null,
  startBackfill: (chatId) => set({ chatId, status: "running", completedBatches: 0 }),
  updateProgress: (completed, rangeStart, rangeEnd) =>
    set({
      completedBatches: completed,
      currentRangeStart: rangeStart ?? null,
      currentRangeEnd: rangeEnd ?? null,
    }),
  setTotalBatches: (total) => set({ totalBatches: total }),
  stopBackfill: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ chatId: null, status: "idle", abortController: null });
  },
  resetBackfill: () =>
    set({
      chatId: null,
      status: "idle",
      totalBatches: 0,
      completedBatches: 0,
      currentRangeStart: null,
      currentRangeEnd: null,
      abortController: null,
    }),
}));
