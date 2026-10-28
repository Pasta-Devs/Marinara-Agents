// ──────────────────────────────────────────────
// The Engine's encounter store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Package code only resets it, through the Engine's chat hooks, when a chat is deleted. This file is stacked over the
// vendored module, so the reset reaches `__MARINARA_HOST__.stores.encounter` instead of a copy nobody reads.
import { create } from "zustand";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

/** What package code reads from the Engine's encounter store. */
export type EncounterState = { reset: () => void };

export const useEncounterStore: BoundStore<EncounterState> =
  hostStore<EncounterState>("encounter") ?? readOnlyStore<EncounterState>(create, { reset: () => undefined });
