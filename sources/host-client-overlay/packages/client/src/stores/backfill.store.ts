// ──────────────────────────────────────────────
// The Engine's rolling summary backfill store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Package code reaches it only through the Engine's chat hooks. This file is stacked over the vendored module, so
// they reach `__MARINARA_HOST__.stores.backfill` instead of a copy nobody reads.
import { create } from "zustand";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

/** What package code reads from the Engine's backfill store. */
export type RollingBackfillState = {
  chatId: string | null;
  status: "idle" | "running";
  totalBatches: number;
  completedBatches: number;
  abortController: AbortController | null;
  startBackfill: (chatId: string) => void;
  updateProgress: (completed: number, rangeStart?: number, rangeEnd?: number) => void;
  setTotalBatches: (total: number) => void;
  stopBackfill: () => void;
  resetBackfill: () => void;
};

const ignore = () => undefined;

export const useRollingBackfillStore: BoundStore<RollingBackfillState> =
  hostStore<RollingBackfillState>("backfill") ??
  readOnlyStore<RollingBackfillState>(create, {
    chatId: null,
    status: "idle",
    totalBatches: 0,
    completedBatches: 0,
    abortController: null,
    startBackfill: ignore,
    updateProgress: ignore,
    setTotalBatches: ignore,
    stopBackfill: ignore,
    resetBackfill: ignore,
  });
