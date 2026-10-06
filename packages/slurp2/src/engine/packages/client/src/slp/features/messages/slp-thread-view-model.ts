import {
  Aperture,
  BriefcaseBusiness,
  Gift,
  Image as ImageIcon,
  MessageCircle,
  Newspaper,
  NotebookPen,
  Palette,
  PenLine,
  Stamp,
} from "lucide-react";
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpActionPreview } from "../../../../../shared/src/slp/slp-stir.js";

/** A desk step riding the next Support line: an Offer the Creator answers, or a move that happens now. */
export type SlurpComposerDesk = { mode: "offer" | "now"; card: SlpActionPreview };
import { SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCoin } from "../../modules/coin/SlpCoin";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useCreateSlurpCommission } from "../../features/messages/commissions/slp-commission-hooks";
import type { SlurpMessage } from "../../features/messages/slp-messages-contract";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";

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
  useSlurpMessageSearch,
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

/** The one reading column for bubbles and composer on wide screens (~720 px). */
export const SLP_THREAD_COLUMN_CLASS = "mx-auto w-full max-w-[45rem]";

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
  /** Opened from "Write as Slurp Support": Slurp Support's one thread with this Creator. */
  startAsSupport?: boolean;
  /**
   * "Switch to Slurp Support" / "Back to your persona": the other voice is a different thread
   * (Support has one thread per Creator, shared by every persona), so the inbox opens that one.
   */
  onSwitchVoice?: (creatorAccountId: string, asSupport: boolean) => void;
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
    startAsSupport,
    onSwitchVoice,
  } = props;
  const { t: localizeUi, i18n } = useUiTranslation();
  const byThread = useSlurpThread(threadId, personaId);
  const olderMessages = useSlurpOlderMessages();
  const byCreator = useSlurpCompose(threadId ? null : creatorAccountId, personaId, Boolean(startAsSupport));
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
    | "tip"
    | "commission"
    | "photo"
    | "generated-photo"
    | "creator"
    | "request"
    | "write"
    | "offer"
    | "move"
    | "note"
    | "show-post"
    | "demand"
    | null
  >(null);
  // Slurp Support's desk step for the next line (docs/SUPPORT-DESK.md): an Offer or a move, and the
  // lever whose play sheet is open to build one.
  const [composerDesk, setComposerDesk] = useState<SlurpComposerDesk | null>(null);
  // Support's "photo, right now" rides the next line like an Offer does (0.3.6).
  const [photoDemand, setPhotoDemand] = useState(false);
  const [deskPick, setDeskPick] = useState<{ action: SlpActionName; mode: "offer" | "now" } | null>(null);
  const [commissionPrefill, setCommissionPrefill] = useState("");
  const settingsQuery = useSlurpSettings();
  const connectionsQuery = useSlurpConnections(true);
  const updateSlurpSettings = useUpdateSlurpSettings();
  const [activeTipAmount, setActiveTipAmount] = useState<number | null>(null);
  const [standaloneTip, setStandaloneTip] = useState<SlurpMessage | null>(null);
  const [composerTipAmount, setComposerTipAmount] = useState(0);
  const [composerTipNote, setComposerTipNote] = useState("");
  const [sendRequest, setSendRequest] = useState<{ id: string; content: string } | null>(null);
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
  const searchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const tierTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const messageSearchInputRef = useRef<HTMLInputElement | null>(null);
  const thread = threadQuery.data?.thread ?? null;
  const activeConversationRef = useRef({ personaId, threadId });
  activeConversationRef.current = { personaId, threadId: thread?.id ?? threadId };
  const messageSearchQuery = useSlurpMessageSearch(threadId, personaId, messageSearch);
  const searchMessages = useMemo(
    () => messageSearchQuery.data?.pages.flatMap((p) => p.messages) ?? [],
    [messageSearchQuery.data],
  );
  const searchMessageIds = useMemo(() => searchMessages.map((message) => message.id), [searchMessages]);
  useEffect(() => {
    if (
      messageSearch &&
      messageSearchIndex >= searchMessageIds.length - 1 &&
      messageSearchQuery.hasNextPage &&
      !messageSearchQuery.isFetchingNextPage
    )
      void messageSearchQuery.fetchNextPage();
  }, [messageSearch, messageSearchIndex, searchMessageIds.length, messageSearchQuery]);

  const messages = useMemo(() => {
    const byId = new Map<string, SlurpMessage>();
    for (const message of loadedOlderMessages) byId.set(message.id, message);
    for (const message of threadQuery.data?.messages ?? []) byId.set(message.id, message);
    for (const message of searchMessages) byId.set(message.id, message);
    return [...byId.values()].sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt),
    );
  }, [loadedOlderMessages, searchMessages, threadQuery.data?.messages]);
  const creator = threadQuery.data?.creator;
  const counterpart = threadQuery.data?.counterpart ?? creator;
  const targetCreatorAccountId = thread?.creatorAccountId ?? creator?.id ?? creatorAccountId;
  const ownsCreator = Boolean(targetCreatorAccountId && ownedCreatorAccountIds.includes(targetCreatorAccountId));
  // A Creator answers many fans from one account, so on that side the draft belongs to the thread.
  // Slurp Support's own thread (`slp-support.ts`): the player writes in it as Support, from any persona.
  const supportThread = thread ? thread.viewerAccountId === SLURP_SUPPORT_ACCOUNT_ID : Boolean(startAsSupport);
  const draftStorageKey = `slurp2-message-draft:${supportThread ? "support" : (personaId ?? "none")}:${targetCreatorAccountId ?? "none"}${ownsCreator && threadId ? `:${threadId}` : ""}`;
  const messaging = threadQuery.data?.messaging;
  const commissions = useMemo(() => threadQuery.data?.commissions ?? [], [threadQuery.data?.commissions]);
  const relationship = "relationship" in (threadQuery.data ?? {}) ? threadQuery.data?.relationship : undefined;
  const availability = threadQuery.data?.creatorAvailability ?? relationship?.availability;
  // Paid commissions stay after a clear. Memoized, as the draft (keystrokes) lives in this model.
  const commissionTimeline = useMemo(
    () =>
      commissions.map((commission) => {
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
      }),
    [commissions, messages],
  );
  // Captured once per thread (opening zeroes the count); the side is known once the thread loads.
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
  const timeline = useMemo(
    () =>
      [
        ...messages
          .filter((message) => typeof message.metadata.commissionId !== "string")
          .filter((message) => !hiddenReplyIds.has(message.id))
          .map((message) => ({ kind: "message" as const, at: message.createdAt, message })),
        ...commissionTimeline,
      ].sort((left, right) => left.at.localeCompare(right.at)),
    [messages, hiddenReplyIds, commissionTimeline],
  );
  const visibleTimeline = visibleCount >= timeline.length ? timeline : timeline.slice(timeline.length - visibleCount);
  const olderCount = timeline.length - visibleTimeline.length;
  const commissionTimelineKey = commissionTimeline
    .map(({ commission, at }) => `${commission.id}:${commission.state}:${commission.updatedAt}:${at}`)
    .join("|");
  const subscribed = thread?.subscribed ?? threadQuery.data?.subscribed ?? false;
  // The player can write as Slurp Support (Slurp's staff) to any Creator they do not run. Support
  // has its own thread; the name is the one the kept sign-up chat gave Support, so it stays one Support.
  const asSupport = !ownsCreator && supportThread;
  const setSupportChoice = (next: boolean) => {
    if (targetCreatorAccountId && next !== asSupport) onSwitchVoice?.(targetCreatorAccountId, next);
  };
  // Support is a faceless team (docs/SUPPORT-DESK.md): always this name.
  const supportName = "Slurp Support";
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
      (asSupport
        ? ([
            // Slurp's staff console (0.3.6): the player works at Slurp here, so the tools read like work tools.
            {
              id: "write",
              icon: PenLine,
              label: localizeUi("ui.slurp.desk.tools.write", { defaultValue: "Draft reply" }),
              detail: localizeUi("ui.slurp.desk.tools.writeDetail", {
                defaultValue: "Suggested wording for this ticket",
              }),
              group: "conversation" as const,
            },
            {
              id: "offer",
              icon: Stamp,
              label: localizeUi("ui.slurp.desk.tools.offer", { defaultValue: "Send offer" }),
              detail: localizeUi("ui.slurp.desk.tools.offerDetail", {
                defaultValue: "Deal, challenge or contract. Needs their answer",
              }),
              group: "conversation" as const,
            },
            {
              id: "move",
              icon: Gift,
              label: localizeUi("ui.slurp.desk.tools.move", { defaultValue: "Apply action" }),
              detail: localizeUi("ui.slurp.desk.tools.moveDetail", {
                defaultValue: "Perk, warning or rumour, sent with your reply",
              }),
              group: "conversation" as const,
            },
            {
              id: "note",
              icon: NotebookPen,
              label: localizeUi("ui.slurp.desk.tools.note", { defaultValue: "Internal note" }),
              detail: localizeUi("ui.slurp.desk.tools.noteDetail", { defaultValue: "Visible to staff only" }),
              group: "conversation" as const,
            },
            {
              id: "photo",
              icon: ImageIcon,
              label: localizeUi("ui.slurp.desk.tools.attach", { defaultValue: "Attach image" }),
              detail: localizeUi("ui.slurp.desk.tools.attachDetail", { defaultValue: "Upload a file to this ticket" }),
              group: "media" as const,
            },
            {
              id: "generated-photo",
              icon: Palette,
              label: localizeUi("ui.slurp.desk.tools.order", { defaultValue: "Studio image" }),
              detail: localizeUi("ui.slurp.desk.tools.orderDetail", {
                defaultValue: "Request an image from the content team",
              }),
              group: "media" as const,
            },
            {
              id: "show-post",
              icon: Newspaper,
              label: localizeUi("ui.slurp.desk.tools.pullUp", { defaultValue: "Link a post" }),
              detail: localizeUi("ui.slurp.desk.tools.pullUpDetail", {
                defaultValue: "Reference one of their posts or Stories",
              }),
              group: "media" as const,
            },
            {
              id: "demand",
              icon: Aperture,
              label: localizeUi("ui.slurp.desk.tools.photoCheck", { defaultValue: "Photo verification" }),
              detail: localizeUi("ui.slurp.desk.tools.photoCheckDetail", {
                defaultValue: "Creator must send a live photo now",
              }),
              group: "media" as const,
            },
          ] as const)
        : ownsCreator
          ? ([
              {
                id: "write",
                icon: PenLine,
                label: localizeUi("ui.slurp.messages.helpWrite", { defaultValue: "Help me write" }),
                detail: localizeUi("ui.slurp.messages.helpWriteDetail", {
                  defaultValue: "Slurp writes or polishes your message",
                }),
                group: "conversation" as const,
              },
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
                detail: localizeUi("ui.slurp.messages.createPhotoDetail", {
                  defaultValue: "Generate and send an image",
                }),
                group: "media" as const,
              },
              {
                id: "creator",
                icon: SlpLockGlyph,
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
                id: "write",
                icon: PenLine,
                label: localizeUi("ui.slurp.messages.helpWrite", { defaultValue: "Help me write" }),
                detail: localizeUi("ui.slurp.messages.helpWriteDetail", {
                  defaultValue: "Slurp writes or polishes your message",
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
                label: localizeUi("ui.slurp.messages.addTip", { defaultValue: "Send a tip" }),
                detail: localizeUi("ui.slurp.messages.addTipDetailNowOrLater", {
                  defaultValue: "Now, or with your next message",
                }),
                group: "payment" as const,
              },
            ] as const)
      ).slice(),
    [localizeUi, ownsCreator, asSupport],
  );

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

  useEffect(() => {
    setMessageSearchIndex(0);
  }, [messageSearch]);

  useEffect(() => {
    if (!messageSearchOpen) return;
    messageSearchInputRef.current?.focus();
  }, [messageSearchOpen]);

  // Searching reaches the whole conversation, not only the part that happens to be mounted.
  // The id, not the list: each poll rebuilt the list and scrolled the reader back to the match.
  const currentSearchMatch = searchMessageIds[messageSearchIndex] ?? null;
  useEffect(() => {
    const match = currentSearchMatch;
    if (!match) return;
    const position = timeline.findIndex((entry) => entry.kind === "message" && entry.message.id === match);
    if (position < 0) return;
    const needed = timeline.length - position + SLURP_MESSAGE_PAGE;
    setVisibleCount((current) => (current >= needed ? current : needed));
  }, [currentSearchMatch, messageSearchIndex, searchMessageIds]);

  useEffect(() => {
    const match = currentSearchMatch;
    if (match) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // The id sits on a `display: contents` wrapper, which has no box to scroll to. Its last child
      // is the message itself; the date and unread separators come before it.
      const wrapper = document.getElementById(`slurp-message-${match}`);
      (wrapper?.lastElementChild ?? wrapper)?.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }
    // `visibleCount`: a match in an older page only exists after the effect above mounts it.
  }, [currentSearchMatch, messageSearchIndex, searchMessageIds, visibleCount]);

  // Details / Memories / Commissions: an SlpSheet (phones, tablets) or a docked column (desktop);
  // the sheet traps and returns focus itself.
  const closeDrawer = () => setDrawerMode(null);

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
    let page;
    try {
      page = await olderMessages.mutateAsync({ threadId: activeThreadId, personaId, cursor: nextOlderCursor });
    } catch (cause) {
      // A stale anchor would jump the view on the next unrelated page change.
      growAnchorRef.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.olderFailed", { defaultValue: "Could not load older messages." }),
      );
      return;
    }
    setLoadedOlderMessages((current) => [...page.messages, ...current]);
    setOlderCursor(page.nextCursor);
    setVisibleCount((current) => current + SLURP_MESSAGE_PAGE);
  };

  useEffect(() => {
    setLoadedOlderMessages([]);
    setOlderCursor(undefined);
    setVisibleCount(SLURP_MESSAGE_PAGE);
  }, [threadId, creatorAccountId, personaId]);

  // Was the reader at the end before the new content arrived? Measured after the render, a tall
  // reply or a picture put the distance past the limit and the view stayed where it was.
  const pinnedToBottomRef = useRef(true);
  useEffect(() => {
    const container = messageScrollRef.current;
    if (!container) return;
    const onScroll = () => {
      pinnedToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight <= 96;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [thread?.id]);

  // State refreshes must never move the message viewport. New content only scrolls when the user
  // was already reading the end of the conversation.
  useEffect(() => {
    if (!bottomRef.current || !pinnedToBottomRef.current) return;
    bottomRef.current.scrollIntoView({ block: "end" });
  }, [commissionTimelineKey, messages.length, typing, pending, hiddenReplyIds]);

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
    asSupport,
    setSupportChoice,
    supportName,
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
    activeTipAmount,
    setActiveTipAmount,
    standaloneTip,
    setStandaloneTip,
    composerTipAmount,
    setComposerTipAmount,
    composerTipNote,
    setComposerTipNote,
    sendRequest,
    setSendRequest,
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
    searchTriggerRef,
    headerMenuTriggerRef,
    composerRef,
    headerMenuOpen,
    setHeaderMenuOpen,
    tierOpen,
    setTierOpen,
    tierTriggerRef,
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
    composerDesk,
    setComposerDesk,
    photoDemand,
    setPhotoDemand,
    deskPick,
    setDeskPick,
    messageSearchMatches: searchMessageIds,
    closeDrawer,
    messageScrollRef,
    nextOlderCursor,
    showOlder,
    waitingNote,
    canForceReply,
  };
}

export type SlurpThreadViewState = ReturnType<typeof useSlurpThreadViewState>;
