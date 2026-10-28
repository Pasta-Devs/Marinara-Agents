// ──────────────────────────────────────────────
// The Engine's agent store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Calls' [youtube] command hands its search to the Engine's music player through this store, and deleting a chat
// resets it. The copy packages used to bundle kept its own state, so a call's song never reached the Engine's player.
// The feature build stacks this file over that module: `useAgentStore` is `__MARINARA_HOST__.stores.agent`.
import { create } from "zustand";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

/** What package code reads from the Engine's agent store. */
export type AgentState = {
  setYoutubePlay: (play: { searchQuery: string; mood: string }) => void;
  reset: () => void;
};

const host = hostStore<AgentState>("agent");

/** False on an Engine without the store: a [youtube] command then says so instead of announcing a song. */
export const hostAgentStoreAvailable = host !== null;

export const useAgentStore: BoundStore<AgentState> =
  host ?? readOnlyStore<AgentState>(create, { setYoutubePlay: () => undefined, reset: () => undefined });
