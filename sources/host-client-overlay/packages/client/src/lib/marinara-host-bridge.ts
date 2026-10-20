// ──────────────────────────────────────────────
// The Engine's client host namespace, as package overlays reach it
// ──────────────────────────────────────────────
// Since capability API 1.341 the Engine sets `globalThis.__MARINARA_HOST__ = { version: 1, ... }` before it evaluates
// any package client. Package builds stack sources/host-client-overlay over the vendored Engine stores, services and
// components, so every import of them lands on the Engine's live object instead of a bundled copy that keeps its own
// state (Pasta-Devs/Marinara-Agents#1478, #1487). This module is package-only: the Engine has no file at this path.
//
// The shapes below are structural. They list only what package code reads, so the package typecheck names a member
// the adapters do not declare (TS2339 on the adapter state types), and the Engine pins the same fields on its side.
import { toast } from "sonner";

/** The capability API that first ships the namespace; packages built with these overlays require it. */
export const HOST_CAPABILITY_API = "1.341";

/** A zustand store as the Engine's `create()` hooks expose it. */
export interface HostStoreApi<S> {
  getState: () => S;
  setState: (partial: Partial<S> | ((state: S) => Partial<S>)) => void;
  subscribe: (listener: (state: S, previousState: S) => void) => () => void;
  getInitialState?: () => S;
}

/** The Engine's store hook: callable with or without a selector, plus the store API. */
export type BoundStore<S> = {
  (): S;
  <T>(selector: (state: S) => T): T;
} & HostStoreApi<S>;

export type HostStoreName =
  "ui" | "chat" | "agent" | "sidecar" | "dialog" | "gallery" | "encounter" | "gameState" | "backfill";

interface MarinaraHostNamespace {
  version: 1;
  capabilityApi?: { major: number; minor: number };
  stores?: Partial<Record<HostStoreName, unknown>>;
  services?: { tts?: unknown; dialogs?: unknown };
  modules?: Record<string, unknown>;
  queryClient?: unknown;
  components?: { Modal?: unknown };
  data?: { emojiCatalog?: unknown };
  api?: unknown;
}

/** The namespace when the Engine provides version 1 of it, else null. */
export function marinaraHost(): MarinaraHostNamespace | null {
  const host = (globalThis as { __MARINARA_HOST__?: { version?: unknown } }).__MARINARA_HOST__;
  return host?.version === 1 ? (host as MarinaraHostNamespace) : null;
}

/** The message a package shows, or throws, when the Engine lacks a member it needs. */
export function hostMemberMissingMessage(member: string): string {
  return `Marinara Engine does not provide ${member}; this package needs capability API ${HOST_CAPABILITY_API} or newer.`;
}

/**
 * A member the package cannot work without (a component, the API client, a data module). Read while the package
 * module evaluates, so a missing one fails the load and the Engine shows its load-failure card. Never a bundled copy.
 */
export function requireHostMember<T>(member: string, read: (host: MarinaraHostNamespace) => unknown): T {
  const host = marinaraHost();
  const value = host ? read(host) : undefined;
  if (value === undefined || value === null) throw new Error(hostMemberMissingMessage(member));
  return value as T;
}

function isStoreHook(value: unknown): value is BoundStore<unknown> {
  const store = value as Partial<HostStoreApi<unknown>> | null | undefined;
  return (
    typeof value === "function" &&
    typeof store?.getState === "function" &&
    typeof store.setState === "function" &&
    typeof store.subscribe === "function"
  );
}

/** The Engine's live store hook, or null on an Engine without it. */
export function hostStore<S>(name: HostStoreName): BoundStore<S> | null {
  const store = marinaraHost()?.stores?.[name];
  return isStoreHook(store) ? (store as BoundStore<S>) : null;
}

/**
 * A store that only reads: `setState` and every action are no-ops, so a package on an Engine without the member never
 * writes Engine state or Engine-owned browser storage. Built on the host's zustand, so its hook works in package React.
 */
export function readOnlyStore<S extends object>(
  createHook: (initializer: () => S) => unknown,
  state: S,
): BoundStore<S> {
  const store = createHook(() => state) as BoundStore<S>;
  store.setState = () => undefined;
  return store;
}

/** A "needs a newer Marinara Engine" notice, shown in the Engine's own toast stack. */
export function showNeedsNewerEngine(feature: string): void {
  toast.error(`${feature} needs a newer Marinara Engine.`);
}
