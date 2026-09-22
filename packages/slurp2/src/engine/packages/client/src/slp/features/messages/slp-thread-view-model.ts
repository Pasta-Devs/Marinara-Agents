import { BriefcaseBusiness, Image as ImageIcon, Lock, MessageCircle, Palette } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCoin } from "../../modules/coin/SlpCoin";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useCreateSlurpCommission } from "../../features/messages/commissions/slp-commission-hooks";
import type { SlurpMessage } from "../../features/messages/slp-messages-contract";
import {
  useDraftSlurpCreatorReply,
  useForceSlurpReply,
  useRequestSlurpReply,
  useRequestSlurpFanReply,
  useResetSlurpThread,
  useResolveSlurpMessageRequest,
  useSendSlurpCreatorReply,
  useSendSlurpMessage,
  useSlurpCheatDirective,
  useTipInSlurpThread,
} from "../../features/messages/slp-message-action-hooks";
import {
  useSlurpCompose,
  useSlurpMessagePrompt,
  useSlurpOlderMessages,
  useSlurpThread,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../features/settings/slp-settings-contract";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
/**
 * What each reply outcome means, in the fan's words.
 *
 * `replyToSlurpMessage` reports six outcomes and the client displayed none of them, so an offline
 * creator, a thread already generating, and a missing connection were all the same blank screen.
 */
import { SLURP_MESSAGE_PAGE, type SlurpConversationDrawerMode } from "./SlpMessages";

export interface SlurpThreadViewProps {
  threadId: string | null;
  creatorAccountId: string | null;
  personaId: string | null;
  ownedCreatorAccountIds: string[];
  /** Unread counts from the inbox row, read before opening marks the thread as read. */
  unreadAtOpen?: { viewer: number; creator: number } | null;
  onBack: () => void;
  onOpenProfile: (accountId: string) => void;
  desktopSplit?: boolean;
}

/**
 * One conversation's whole working state: the queries behind it, the composer draft, the tipping
 * and commission sheets, the search, the drawer and every action the view fires.
 *
 * The header, the composer and the drawer each draw from this one object, which is what lets them
 * be separate components without forty props between them.
 */
export function useSlurpThreadViewState(props: SlurpThreadViewProps) {
  const {
    threadId,
    creatorAccountId,
    personaId,
    ownedCreatorAccountIds,
    unreadAtOpen,
    onBack,
    onOpenProfile,
    desktopSplit,
  } = props;
  const { t: localizeUi, i18n } = useUiTranslation();
  const byThread = useSlurpThread(threadId, personaId);
  const olderMessages = useSlurpOlderMessages();
  const byCreator = useSlurpCompose(threadId ? null : creatorAccountId, personaId);
  const threadQuery = threadId ? byThread : byCreator;
  const send = useSendSlurpMessage();
  const cheat = useSlurpCheatDirective();
  const forceReply = useForceSlurpReply();
  const requestReply = useRequestSlurpReply();
  const requestFanReply = useRequestSlurpFanReply();
  const tip = useTipInSlurpThread();
  const resolveRequest = useResolveSlurpMessageRequest();
  const resetThread = useResetSlurpThread();
  const createCommission = useCreateSlurpCommission();
  const creatorReply = useSendSlurpCreatorReply();
  const draftReply = useDraftSlurpCreatorReply();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [hiddenReplyIds, setHiddenReplyIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<number | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [connectionPickerOpen, setConnectionPickerOpen] = useState(false);
  const [toolTab, setToolTab] = useState<
    "tip" | "commission" | "photo" | "generated-photo" | "creator" | "request" | null
  >(null);
  const [commissionPrefill, setCommissionPrefill] = useState("");
  const settingsQuery = useSlurpSettings();
  const connectionsQuery = useSlurpConnections(true);
  const updateSlurpSettings = useUpdateSlurpSettings();
  const [tipMode, setTipMode] = useState<"now" | "with-message">("now");
  const [activeTipAmount, setActiveTipAmount] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [customTipNote, setCustomTipNote] = useState("");
  const [standaloneTip, setStandaloneTip] = useState<SlurpMessage | null>(null);
  const [composerTipAmount, setComposerTipAmount] = useState(0);
  const [composerTipNote, setComposerTipNote] = useState("");
  const [sendRequestId, setSendRequestId] = useState<string | null>(null);
  // The fan's own words, held on screen until the server's copy of them arrives.
  const [pending, setPending] = useState<{ content: string; id: string | null; startedAt: number } | null>(null);
  // Why no answer came. The send route has always reported this and nothing ever read it, so a
  // sleeping creator, a busy thread and a missing connection all looked like the same silence.
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<SlurpConversationDrawerMode>(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const [commissionRibbonOpen, setCommissionRibbonOpen] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [requestHint, setRequestHint] = useState<"photo" | "paid-unlock" | "follow-up">("follow-up");
  // Only the tail of a long conversation is mounted. Everything above it is one button away.
  const [visibleCount, setVisibleCount] = useState(SLURP_MESSAGE_PAGE);
  const [loadedOlderMessages, setLoadedOlderMessages] = useState<SlurpMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<{ createdAt: string; id: string } | null | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Set when older entries are about to mount, so the viewport can be pinned to what it was on.
  const growAnchorRef = useRef<number | null>(null);
  const landedAtBottomRef = useRef(false);
  const drawerRef = useRef<HTMLDialogElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const searchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const tierTriggerRef = useRef<HTMLButtonElement | null>(null);
  const tierPopoverRef = useRef<HTMLDivElement | null>(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const messageSearchInputRef = useRef<HTMLInputElement | null>(null);
  const thread = threadQuery.data?.thread ?? null;
  const activeConversationRef = useRef({ personaId, threadId });
  activeConversationRef.current = { personaId, threadId: thread?.id ?? threadId };

  const messages = useMemo(() => {
    const byId = new Map<string, SlurpMessage>();
    for (const message of loadedOlderMessages) byId.set(message.id, message);
    for (const message of threadQuery.data?.messages ?? []) byId.set(message.id, message);
    return [...byId.values()].sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt),
    );
  }, [loadedOlderMessages, threadQuery.data?.messages]);
  const creator = threadQuery.data?.creator;
  const counterpart = threadQuery.data?.counterpart ?? creator;
  const targetCreatorAccountId = thread?.creatorAccountId ?? creator?.id ?? creatorAccountId;
  const ownsCreator = Boolean(targetCreatorAccountId && ownedCreatorAccountIds.includes(targetCreatorAccountId));
  // A Creator answers many fans from one account, so on that side the draft belongs to the thread.
  const draftStorageKey = `slurp2-message-draft:${personaId ?? "none"}:${targetCreatorAccountId ?? "none"}${ownsCreator && threadId ? `:${threadId}` : ""}`;
  const messaging = threadQuery.data?.messaging;
  const commissions = useMemo(() => threadQuery.data?.commissions ?? [], [threadQuery.data?.commissions]);
  const relationship = "relationship" in (threadQuery.data ?? {}) ? threadQuery.data?.relationship : undefined;
  const availability = threadQuery.data?.creatorAvailability ?? relationship?.availability;
  // A cleared conversation removes its messages, but commission history remains visible in chat.
  // Commissions are paid work and must not disappear when the conversation is tidied.
  const commissionTimeline = commissions.map((commission) => {
    const linkedMessages = messages.filter((message) => message.metadata.commissionId === commission.id);
    const latestMessage = linkedMessages.reduce<SlurpMessage | null>(
      (latest, message) => (!latest || message.createdAt > latest.createdAt ? message : latest),
      null,
    );
    const at = latestMessage
      ? latestMessage.createdAt > commission.updatedAt
        ? latestMessage.createdAt
        : commission.updatedAt
      : commission.updatedAt;
    return {
      kind: "commission" as const,
      at,
      commission,
      deliveryMessage: commission.deliveryMessageId
        ? (messages.find((message) => message.id === commission.deliveryMessageId) ?? null)
        : null,
    };
  });
  // Captured once per thread: the inbox count drops to zero as soon as opening marks it read, and
  // the marker must stay on the same message while new replies arrive below it.
  // The side (and so which count applies) is only known once the thread has loaded.
  const unreadMarkerRef = useRef<{
    threadId: string | null;
    unread: { viewer: number; creator: number } | null;
    messageId: string | null | undefined;
  }>({ threadId: null, unread: null, messageId: null });
  if (unreadMarkerRef.current.threadId !== threadId) {
    unreadMarkerRef.current = { threadId, unread: unreadAtOpen, messageId: unreadAtOpen ? undefined : null };
  }
  if (unreadMarkerRef.current.messageId === undefined && threadQuery.data && messages.length > 0) {
    const unread = unreadMarkerRef.current.unread;
    const count = unread ? (ownsCreator ? unread.creator : unread.viewer) : 0;
    const incoming = messages.filter((message) => message.role !== (ownsCreator ? "creator" : "viewer"));
    unreadMarkerRef.current.messageId = count > 0 ? (incoming[Math.max(0, incoming.length - count)]?.id ?? null) : null;
  }
  const firstUnreadMessageId = unreadMarkerRef.current.messageId ?? null;
  const timeline = [
    ...messages
      .filter((message) => typeof message.metadata.commissionId !== "string")
      .filter((message) => !hiddenReplyIds.has(message.id))
      .map((message) => ({ kind: "message" as const, at: message.createdAt, message })),
    ...commissionTimeline,
  ].sort((left, right) => left.at.localeCompare(right.at));
  const visibleTimeline = visibleCount >= timeline.length ? timeline : timeline.slice(timeline.length - visibleCount);
  const olderCount = timeline.length - visibleTimeline.length;
  const commissionTimelineKey = commissionTimeline
    .map(({ commission, at }) => `${commission.id}:${commission.state}:${commission.updatedAt}:${at}`)
    .join("|");
  const subscribed = thread?.subscribed ?? threadQuery.data?.subscribed ?? false;
  const headerAccount = ownsCreator ? counterpart : creator;
  const headerProfileId = ownsCreator ? thread?.viewerAccountId : targetCreatorAccountId;
  const busy = send.isPending || tip.isPending || creatorReply.isPending || draftReply.isPending;
  const promptDebugEnabled = drawerMode === "prompt" && Boolean(threadId && personaId);
  const promptDebug = useSlurpMessagePrompt(threadId, personaId, promptDebugEnabled);
  const activeCommission = useMemo(
    () =>
      [...commissions].sort((left, right) => {
        const leftFinal = left.state === "declined" || left.state === "delivered";
        const rightFinal = right.state === "declined" || right.state === "delivered";
        if (leftFinal !== rightFinal) return leftFinal ? 1 : -1;
        return right.updatedAt.localeCompare(left.updatedAt);
      })[0] ?? null,
    [commissions],
  );
  // The tools a side actually has. A fan has never had a use for the Creator drafting panel, and
  // the Creator has no image request to make of herself.
  const toolTabs = useMemo(
    () =>
      (ownsCreator
        ? ([
            {
              id: "request",
              icon: MessageCircle,
              label: localizeUi("ui.slurp.messages.requestFanReply", { defaultValue: "Request a reply" }),
              detail: localizeUi("ui.slurp.messages.requestFanReplyDetail", {
                defaultValue: "Ask the fan to write back",
              }),
              group: "conversation" as const,
            },
            {
              id: "generated-photo",
              icon: Palette,
              label: localizeUi("ui.slurp.messages.createPhoto", { defaultValue: "Create a photo" }),
              detail: localizeUi("ui.slurp.messages.createPhotoDetail", { defaultValue: "Generate and send an image" }),
              group: "media" as const,
            },
            {
              id: "creator",
              icon: Lock,
              label: localizeUi("ui.slurp.messages.lockedContent", { defaultValue: "Locked content" }),
              detail: localizeUi("ui.slurp.messages.lockedContentDetail", { defaultValue: "Send a paid message" }),
              group: "creator" as const,
            },
          ] as const)
        : ([
            {
              id: "photo",
              icon: ImageIcon,
              label: localizeUi("ui.slurp.messages.sendPhoto", { defaultValue: "Send a photo" }),
              detail: localizeUi("ui.slurp.messages.sendPhotoDetail", {
                defaultValue: "Choose an image from your device",
              }),
              group: "media" as const,
            },
            {
              id: "request",
              icon: MessageCircle,
              label: localizeUi("ui.slurp.messages.requestReply", { defaultValue: "Request a reply" }),
              detail: localizeUi("ui.slurp.messages.requestReplyDetail", {
                defaultValue: "Ask gently without forcing a reply",
              }),
              group: "conversation" as const,
            },
            {
              id: "commission",
              icon: BriefcaseBusiness,
              label: localizeUi("ui.slurp.messages.askCommission", { defaultValue: "Ask for commission" }),
              detail: localizeUi("ui.slurp.messages.askCommissionDetail", {
                defaultValue: "Request made-to-order work",
              }),
              group: "conversation" as const,
            },
            {
              id: "tip",
              icon: SlurpCoin,
              label: localizeUi("ui.slurp.messages.addTip", { defaultValue: "Add a tip" }),
              detail: localizeUi("ui.slurp.messages.addTipDetail", {
                defaultValue: "Attach coins to your next message",
              }),
              group: "payment" as const,
            },
          ] as const)
      ).slice(),
    [localizeUi, ownsCreator],
  );

  useEffect(() => {
    if (ownsCreator) setTipMode("now");
  }, [ownsCreator]);

  const messageSearchMatches = useMemo(() => {
    const needle = messageSearch.trim().toLocaleLowerCase();
    if (!needle) return [];
    return messages
      .filter((message) => message.content.toLocaleLowerCase().includes(needle))
      .map((message) => message.id);
  }, [messageSearch, messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Clear on a key with nothing saved, or the previous conversation's draft follows you here.
    setDraft(window.localStorage.getItem(draftStorageKey) ?? "");
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draft.trim()) window.localStorage.setItem(draftStorageKey, draft);
    else window.localStorage.removeItem(draftStorageKey);
  }, [draft, draftStorageKey]);

  // Drop the echo only once the refetch carries the real row, so the message never blinks out
  // between the response landing and the thread reloading.
  useEffect(() => {
    if (
      pending &&
      messages.some(
        (message) =>
          (pending.id !== null && message.id === pending.id) ||
          (message.role === "viewer" &&
            message.content === pending.content &&
            Date.parse(message.createdAt) >= pending.startedAt),
      )
    )
      setPending(null);
  }, [messages, pending]);

  // The queued note describes the wait, so it goes once the answer it promised has arrived.
  useEffect(() => {
    const latestViewerAt = messages.reduce((latest, message) => {
      if (message.role !== "viewer") return latest;
      const createdAt = Date.parse(message.createdAt);
      return Number.isNaN(createdAt) ? latest : Math.max(latest, createdAt);
    }, 0);
    const visibleCreatorReply = messages.some((message) => {
      if (message.role !== "creator" || hiddenReplyIds.has(message.id)) return false;
      const createdAt = Date.parse(message.createdAt);
      return latestViewerAt === 0 || Number.isNaN(createdAt) || createdAt >= latestViewerAt;
    });
    if (visibleCreatorReply || (thread && !thread.needsReply && hiddenReplyIds.size === 0)) setReplyStatus(null);
  }, [hiddenReplyIds, messages, thread]);

  // A different conversation must not inherit the last one's unsent echo.
  useEffect(() => {
    setPending(null);
    setTyping(false);
    setReplyStatus(null);
    setDrawerMode(null);
    setMessageSearchOpen(false);
    setMessageSearch("");
    setMessageSearchIndex(0);
    setCommissionRibbonOpen(false);
    setPreparingImage(false);
    setError(null);
    setComposerTipAmount(0);
    setComposerTipNote("");
    setCommissionPrefill("");
    setCustomTipAmount("");
    setCustomTipNote("");
    setStandaloneTip(null);
    setRequestHint("follow-up");
    setVisibleCount(SLURP_MESSAGE_PAGE);
    setAwayFromBottom(false);
    setHeaderMenuOpen(false);
    setTierOpen(false);
    landedAtBottomRef.current = false;
  }, [threadId, creatorAccountId]);

  useEffect(() => {
    setMessageSearchIndex(0);
  }, [messageSearch]);

  useEffect(() => {
    if (!messageSearchOpen) return;
    messageSearchInputRef.current?.focus();
  }, [messageSearchOpen]);

  // Searching reaches the whole conversation, not only the part that happens to be mounted.
  useEffect(() => {
    const match = messageSearchMatches[messageSearchIndex];
    if (!match) return;
    const position = timeline.findIndex((entry) => entry.kind === "message" && entry.message.id === match);
    if (position < 0) return;
    const needed = timeline.length - position + SLURP_MESSAGE_PAGE;
    setVisibleCount((current) => (current >= needed ? current : needed));
  }, [messageSearchIndex, messageSearchMatches, timeline]);

  useEffect(() => {
    const match = messageSearchMatches[messageSearchIndex];
    if (match) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(`slurp-message-${match}`)
        ?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [messageSearchIndex, messageSearchMatches]);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (drawerMode && !dialog.open) {
      drawerTriggerRef.current = document.activeElement as HTMLButtonElement | null;
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!drawerMode && dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerMode]);

  const closeDrawer = () => {
    const trigger = drawerTriggerRef.current;
    setDrawerMode(null);
    document.body.style.overflow = "";
    window.requestAnimationFrame(() => trigger?.focus());
  };

  const messageScrollRef = useRef<HTMLDivElement | null>(null);

  /**
   * Open a conversation at its newest message.
   *
   * A chat that opens at the top asks the player to scroll through everything they have already
   * read to find the line they came back for. The jump is instant and unanimated on purpose: a
   * smooth scroll from the top of a long thread is a visible rewind.
   */
  useLayoutEffect(() => {
    const container = messageScrollRef.current;
    if (!container || landedAtBottomRef.current || visibleTimeline.length === 0) return;
    landedAtBottomRef.current = true;
    const marker = firstUnreadMessageId ? document.getElementById("slurp-unread-marker") : null;
    if (marker) marker.scrollIntoView({ block: "start" });
    else container.scrollTop = container.scrollHeight;
  }, [firstUnreadMessageId, visibleTimeline.length]);

  /**
   * Keep the viewport on the message it was on when older ones mount above it.
   *
   * Without this the content grows upward and the reader is thrown further down the conversation
   * every time they ask for more of it.
   */
  useLayoutEffect(() => {
    const container = messageScrollRef.current;
    const anchor = growAnchorRef.current;
    if (!container || anchor === null) return;
    growAnchorRef.current = null;
    container.scrollTop += container.scrollHeight - anchor;
  }, [visibleCount]);

  const nextOlderCursor = olderCursor === undefined ? threadQuery.data?.nextCursor : olderCursor;
  const showOlder = async () => {
    const container = messageScrollRef.current;
    growAnchorRef.current = container ? container.scrollHeight : null;
    if (olderCount > 0) {
      setVisibleCount((current) => current + SLURP_MESSAGE_PAGE);
      return;
    }
    const activeThreadId = thread?.id ?? threadId;
    if (!activeThreadId || !personaId || !nextOlderCursor || olderMessages.isPending) return;
    const page = await olderMessages.mutateAsync({ threadId: activeThreadId, personaId, cursor: nextOlderCursor });
    setLoadedOlderMessages((current) => [...page.messages, ...current]);
    setOlderCursor(page.nextCursor);
    setVisibleCount((current) => current + SLURP_MESSAGE_PAGE);
  };

  useEffect(() => {
    setLoadedOlderMessages([]);
    setOlderCursor(undefined);
    setVisibleCount(SLURP_MESSAGE_PAGE);
  }, [threadId, creatorAccountId, personaId]);

  // State refreshes must never move the message viewport. New content only scrolls when the user
  // was already reading the end of the conversation.
  useEffect(() => {
    const container = messageScrollRef.current;
    if (!container || !bottomRef.current) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= 96) bottomRef.current.scrollIntoView({ block: "end" });
  }, [commissionTimelineKey, messages.length, typing, pending]);

  /**
   * Hold the reply behind a typing indicator for as long as the server said the creator would
   * take. The reply is already in hand, so this is presentation only — nothing is being waited on.
   */
  /**
   * Keep the typing indicator up for the rest of the pacing the server named.
   *
   * The indicator starts when the fan hits send. Keep the full server pacing after the response too,
   * so a fast model cannot make the Creator answer appear immediately.
   */
  // The note from the last send, and the standing obligation the server tracks. A reply can be
  // owed long after the send that asked for it — that is the whole case this button exists for —
  // so the button follows `needsReply`, not the note.
  const waitingNote = replyStatus && replyStatus !== "replied" ? replyStatus : null;
  const canForceReply = Boolean(personaId && thread && !ownsCreator && (thread.needsReply || waitingNote === "queued"));

  return {
    threadId,
    creatorAccountId,
    personaId,
    ownedCreatorAccountIds,
    unreadAtOpen,
    onBack,
    onOpenProfile,
    desktopSplit,
    localizeUi,
    i18n,
    byThread,
    olderMessages,
    byCreator,
    threadQuery,
    send,
    cheat,
    forceReply,
    requestReply,
    requestFanReply,
    tip,
    resolveRequest,
    resetThread,
    createCommission,
    creatorReply,
    draftReply,
    draft,
    setDraft,
    error,
    setError,
    typing,
    setTyping,
    hiddenReplyIds,
    setHiddenReplyIds,
    typingTimeoutRef,
    toolsOpen,
    setToolsOpen,
    connectionPickerOpen,
    setConnectionPickerOpen,
    toolTab,
    setToolTab,
    commissionPrefill,
    setCommissionPrefill,
    settingsQuery,
    connectionsQuery,
    updateSlurpSettings,
    tipMode,
    setTipMode,
    activeTipAmount,
    setActiveTipAmount,
    customTipAmount,
    setCustomTipAmount,
    customTipNote,
    setCustomTipNote,
    standaloneTip,
    setStandaloneTip,
    composerTipAmount,
    setComposerTipAmount,
    composerTipNote,
    setComposerTipNote,
    sendRequestId,
    setSendRequestId,
    pending,
    setPending,
    replyStatus,
    setReplyStatus,
    drawerMode,
    setDrawerMode,
    messageSearchOpen,
    setMessageSearchOpen,
    messageSearch,
    setMessageSearch,
    messageSearchIndex,
    setMessageSearchIndex,
    commissionRibbonOpen,
    setCommissionRibbonOpen,
    preparingImage,
    setPreparingImage,
    requestHint,
    setRequestHint,
    visibleCount,
    setVisibleCount,
    loadedOlderMessages,
    setLoadedOlderMessages,
    olderCursor,
    setOlderCursor,
    bottomRef,
    growAnchorRef,
    landedAtBottomRef,
    drawerRef,
    drawerTriggerRef,
    searchTriggerRef,
    headerMenuTriggerRef,
    headerMenuRef,
    composerRef,
    headerMenuOpen,
    setHeaderMenuOpen,
    tierOpen,
    setTierOpen,
    tierTriggerRef,
    tierPopoverRef,
    awayFromBottom,
    setAwayFromBottom,
    messageSearchInputRef,
    thread,
    activeConversationRef,
    messages,
    creator,
    counterpart,
    targetCreatorAccountId,
    ownsCreator,
    draftStorageKey,
    messaging,
    commissions,
    relationship,
    availability,
    commissionTimeline,
    unreadMarkerRef,
    firstUnreadMessageId,
    timeline,
    visibleTimeline,
    olderCount,
    commissionTimelineKey,
    subscribed,
    headerAccount,
    headerProfileId,
    busy,
    promptDebugEnabled,
    promptDebug,
    activeCommission,
    toolTabs,
    messageSearchMatches,
    closeDrawer,
    messageScrollRef,
    nextOlderCursor,
    showOlder,
    waitingNote,
    canForceReply,
  };
}

export type SlurpThreadViewState = ReturnType<typeof useSlurpThreadViewState>;
