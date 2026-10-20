// ──────────────────────────────────────────────
// The Engine's chat store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Package clients read which chat is open and whether a reply is streaming. The copy they used to bundle started
// from the Engine's saved active chat and drafts, never heard the Engine change them, and wrote its own version back,
// so game boards stayed unlocked while a character replied and a page load could open the wrong chat.
// The feature build stacks this file over that module: `useChatStore` is the Engine's live store
// (`__MARINARA_HOST__.stores.chat`).
//
// `PackageChatScope` lets a package surface that belongs to one chat (a Conversation call) show that chat to the
// Engine components inside it: there `useChatStore(selector)` sees `activeChatId` as the scoped chat. `getState()` is
// never scoped.
import { createContext, createElement, useContext, type ReactNode } from "react";
import { create } from "zustand";
import type { Chat, PendingSpatialTransition, SpatialDestinationRelation } from "@marinara-engine/shared";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

const SPATIAL_TRANSITIONS_KEY = "marinara-pending-spatial-transitions";

export type PendingSpatialTransitionDraft = {
  transition: PendingSpatialTransition;
  destinationName: string;
  relation: SpatialDestinationRelation;
  label?: string;
  status: "ready" | "needs_review";
  /** World Maps keeps its review note in the draft; the Engine stores the draft as given. */
  reviewMessage?: string;
};

/** What package code reads from the Engine's chat store. The Engine's store holds this and much more. */
export type ChatState = {
  activeChatId: string | null;
  activeChat: Chat | null;
  isStreaming: boolean;
  streamingChatId: string | null;
  abortControllers: Map<string, AbortController>;
  pendingSpatialTransitions: Map<string, PendingSpatialTransitionDraft>;
  setActiveChat: (chat: Chat | null) => void;
  setPendingSpatialTransition: (chatId: string, draft: PendingSpatialTransitionDraft) => void;
  clearPendingSpatialTransition: (chatId: string, commandId?: string) => void;
  setPendingSpatialTransitionStatus: (chatId: string, status: PendingSpatialTransitionDraft["status"]) => void;
  reset: () => void;
};

function savedSpatialTransitions(): Map<string, PendingSpatialTransitionDraft> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(SPATIAL_TRANSITIONS_KEY) ?? "null");
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed.filter(
        (entry): entry is [string, PendingSpatialTransitionDraft] =>
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          typeof entry[1]?.transition?.commandId === "string" &&
          typeof entry[1]?.transition?.destinationId === "string" &&
          typeof entry[1]?.destinationName === "string",
      ),
    );
  } catch {
    return new Map();
  }
}

// An Engine without the namespace: nothing is open and nothing streams, as far as the package can tell. Every writer
// is a no-op, so the package never writes "marinara-active-chat-id", "marinara-input-drafts" or
// "marinara-pending-spatial-transitions" behind the Engine's back.
function readOnlyChatStore(): BoundStore<ChatState> {
  const ignore = () => undefined;
  return readOnlyStore<ChatState>(create, {
    activeChatId: null,
    activeChat: null,
    isStreaming: false,
    streamingChatId: null,
    abortControllers: new Map(),
    pendingSpatialTransitions: savedSpatialTransitions(),
    setActiveChat: ignore,
    setPendingSpatialTransition: ignore,
    clearPendingSpatialTransition: ignore,
    setPendingSpatialTransitionStatus: ignore,
    reset: ignore,
  });
}

const store: BoundStore<ChatState> = hostStore<ChatState>("chat") ?? readOnlyChatStore();

const ChatScopeContext = createContext<{ chatId: string | null } | null>(null);

/** Inside this, Engine components see `chatId` as the open chat (`useChatStore(selector)` only). */
export function PackageChatScope({ chatId, children }: { chatId: string | null; children?: ReactNode }) {
  return createElement(ChatScopeContext.Provider, { value: { chatId } }, children);
}

// One scoped view per store state and chat, so a selector that returns the whole state stays referentially stable.
const scopedViews = new WeakMap<ChatState, Map<string | null, ChatState>>();
function scopedState(state: ChatState, chatId: string | null): ChatState {
  if (state.activeChatId === chatId) return state;
  let views = scopedViews.get(state);
  if (!views) scopedViews.set(state, (views = new Map()));
  let view = views.get(chatId);
  if (!view) views.set(chatId, (view = { ...state, activeChatId: chatId }));
  return view;
}

const identity = (state: ChatState) => state;

function useScopedChatStore(): ChatState;
function useScopedChatStore<T>(selector: (state: ChatState) => T): T;
function useScopedChatStore<T>(selector?: (state: ChatState) => T) {
  const scope = useContext(ChatScopeContext);
  const select = selector ?? identity;
  return store(scope ? (state: ChatState) => select(scopedState(state, scope.chatId)) : select);
}

export const useChatStore: BoundStore<ChatState> = Object.assign(useScopedChatStore, {
  getState: store.getState,
  setState: store.setState,
  subscribe: store.subscribe,
  getInitialState: store.getInitialState,
});
