// ──────────────────────────────────────────────
// The Engine's Local Model store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// The connection switcher offers the Engine's Local Model when it is downloaded. The copy packages used to bundle
// polled and kept its own status; this file is stacked over that module, so `useSidecarStore` is
// `__MARINARA_HOST__.stores.sidecar`. On an Engine without it, Local Model is not offered.
import { create } from "zustand";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

/** What package code reads from the Engine's Local Model store. */
export type SidecarState = {
  modelDownloaded: boolean;
  modelDisplayName: string | null;
  fetchStatus: () => Promise<void>;
};

export const useSidecarStore: BoundStore<SidecarState> =
  hostStore<SidecarState>("sidecar") ??
  readOnlyStore<SidecarState>(create, {
    modelDownloaded: false,
    modelDisplayName: null,
    fetchStatus: () => Promise.resolve(),
  });
