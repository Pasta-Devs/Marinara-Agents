import {
  ArrowDown,
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Info,
  Link,
  Loader2,
  Lock,
  MessageCircle,
  Megaphone,
  Moon,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { SlurpComposeTarget } from "../../features/messages/slp-messages-contract";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { CommissionRequest, CommissionRow, isCommissionRequest, SlurpCommissionsPanel } from "./commissions/SlpCommissions";
import { NoodleAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { getApiErrorMessage } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SlurpEmptyArtwork } from "../../base/chrome/SlpEmptyArtwork";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useCreateSlurpCommission } from "../../features/messages/commissions/slp-commission-hooks";
import type {
  SlurpMessage,
  SlurpThread,
  SlurpThreadRelationship,
} from "../../features/messages/slp-messages-contract";
import {
  useBroadcastSlurpMessage,
  useCancelSlurpFollowUp,
  useDraftSlurpCreatorReply,
  useForceSlurpReply,
  useGenerateSlurpViewerImage,
  useReactToSlurpMessage,
  useRequestSlurpReply,
  useResetSlurpThread,
  useResolveSlurpMessageRequest,
  useSendSlurpCreatorImage,
  useSendSlurpCreatorPpv,
  useSendSlurpCreatorReply,
  useSendSlurpMessage,
  useSendSlurpViewerImage,
  useSetSlurpThreadNotes,
  useSlurpCheatDirective,
  useTipInSlurpThread,
  useUnlockSlurpMessage,
} from "../../features/messages/slp-message-action-hooks";
import {
  useSlurpCompose,
  useSlurpMessagePrompt,
  useSlurpOlderMessages,
  useSlurpThread,
  useSlurpThreads,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../features/settings/slp-settings-contract";
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
/**
 * What each reply outcome means, in the fan's words.
 *
 * `replyToSlurpMessage` reports six outcomes and the client displayed none of them, so an offline
 * creator, a thread already generating, and a missing connection were all the same blank screen.
 */
import { HeaderIconButton, SlurpConnectionSwitcher, SlurpFollowUpItem } from "./SlpThreadChrome";
import { SlurpMemoriesPanel } from "./SlpMemoriesPanel";
import { MessageBubble, SlurpAwayAnimation, SlurpPlatformActionCard } from "./SlpMessageBubble";
import { BroadcastPanel, CreatorMessageTools, FanImageTool } from "./SlpMessageTools";

export { BroadcastPanel };

const SLURP_REPLY_STATUS_FALLBACKS: Record<string, string> = {
  queued: "Your message is delivered. They reply when they next check their messages.",
  owed: "Your message is delivered. They have not answered yet.",
  cooling: "They stepped away from this conversation. Give them some time.",
  busy: "{{name}} is already writing back. Give it a moment.",
  ineligible: "{{name}} is not answering this conversation right now.",
  connection_not_found: "No text connection is configured, so nobody can answer yet.",
  failed: "The reply could not be written. Your message was still delivered.",
};

/** Reply outcomes that only mean "not now". They render as the away animation, without words. */
const SLURP_AWAY_STATUSES = new Set(["queued", "owed", "cooling", "ineligible"]);
/** The away card's headline. The status line below it carries the detail. */
const SLURP_AWAY_TITLE_FALLBACKS: Record<string, string> = {
  queued: "{{name}} is away",
  owed: "Waiting for {{name}}",
  cooling: "{{name}} needs a break",
  ineligible: "{{name}} is not answering",
};

const TIP_PRESETS = [5, 15, 50] as const;

function requestHintGuidance(hint: "photo" | "paid-unlock" | "follow-up"): string {
  if (hint === "photo")
    return "The fan would enjoy a photo if you want to share one. Treat this as an optional suggestion, not a promise or demand.";
  if (hint === "paid-unlock")
    return "The fan is open to paid or locked content if you choose to offer it. Do not invent an offer or pressure the fan.";
  return "The fan would appreciate a follow-up or promise if one fits naturally. Do not promise an outcome unless you choose to do so.";
}

/** How much of a conversation is mounted at once, and how much one "show earlier" adds. */
const SLURP_MESSAGE_PAGE = 25;

/** The server applies the same limit to each memory tier. */
export const SLURP_MEMORY_TIER_LIMIT = 8;


export type SlurpConversationDrawerMode = "details" | "memories" | "commissions" | "prompt" | null;

export type SlurpMessageThreadContext = Pick<
  SlurpThread,
  | "id"
  | "creatorAccountId"
  | "creatorDisplayName"
  | "creatorHandle"
  | "creatorAvatarUrl"
  | "viewerAccountId"
  | "counterpartName"
  | "counterpartHandle"
  | "subscribed"
  | "rapport"
>;

/**
 * The Slurp inbox and one thread.
 *
 * Selection lives here rather than in the navigation state: a thread is a place inside Messages,
 * not a separate destination, and routing it would put a browser-history entry behind every tap.
 */
export function SlurpMessagesView({
  personaId,
  ownedCreatorAccountIds,
  composeWithCreatorAccountId = null,
  initialThreadId = null,
  onOpenProfile,
  onThreadContextChange,
  onConversationOpenChange,
  workspace = false,
  onExit = null,
  exitTitle,
}: {
  personaId: string | null;
  /** Creator profiles this persona owns, so their request trays can be answered from here. */
  ownedCreatorAccountIds: string[];
  /** Set when Messages was opened from a Creator profile, to land straight in that chat. */
  composeWithCreatorAccountId?: string | null;
  /** Set by an Activity event that points at an existing conversation. */
  initialThreadId?: string | null;
  onOpenProfile: (accountId: string) => void;
  onThreadContextChange?: (thread: SlurpMessageThreadContext | null) => void;
  onConversationOpenChange?: (open: boolean) => void;
  /** Keep the conversation list in its full Messages workspace even before a thread is chosen. */
  workspace?: boolean;
  /**
   * Leave Messages entirely.
   *
   * Passing this moves the surrounding frame's title bar in here. On a wide screen that bar ran
   * the full width and held a back button and one word, while the conversation's own header sat
   * in a second bar below it — two bars for one screen. Owning it lets the list keep the title
   * and the conversation header rise into the same row, so the chat starts where the list ends.
   */
  onExit?: (() => void) | null;
  exitTitle?: string;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId);
  // Opening a chat from a profile lands in it directly, and backing out returns to the inbox
  // rather than to the profile, so Messages behaves the same however you arrived.
  const [composeWith, setComposeWith] = useState<string | null>(composeWithCreatorAccountId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "requests">("all");
  const [composePickerOpen, setComposePickerOpen] = useState(false);
  const composeTargetsQuery = useSlurpComposeTargets(personaId, composePickerOpen);
  const openCreatorThread = useOpenSlurpCreatorThread();
  const threadsQuery = useSlurpThreads(personaId);
  const threads = threadsQuery.data?.threads ?? [];
  const openThread = [...threads, ...(threadsQuery.data?.inbound ?? [])].find((thread) => thread.id === openThreadId);

  useEffect(() => {
    onThreadContextChange?.(openThread ?? null);
    return () => onThreadContextChange?.(null);
  }, [onThreadContextChange, openThread]);

  // A chat opened from somewhere else (a profile, an activity item) backs out to that place. A chat
  // picked from this list backs out to the list. Backing out of a direct chat into a list you never
  // saw is what made Back feel like it went somewhere random.
  const openedDirectly = useRef(Boolean(initialThreadId || composeWithCreatorAccountId));

  useEffect(() => {
    openedDirectly.current = Boolean(initialThreadId || composeWithCreatorAccountId);
    if (initialThreadId) {
      setComposeWith(null);
      setOpenThreadId(initialThreadId);
    } else {
      setOpenThreadId(null);
      setComposeWith(composeWithCreatorAccountId);
    }
  }, [composeWithCreatorAccountId, initialThreadId]);

  useEffect(() => {
    onConversationOpenChange?.(Boolean(openThreadId || composeWith));
    return () => onConversationOpenChange?.(false);
  }, [composeWith, onConversationOpenChange, openThreadId]);

  const needle = search.trim().toLocaleLowerCase();
  // Match the name, the handle, and the preview: the three things actually visible on a row.
  const matches = (thread: SlurpThread) =>
    !needle ||
    `${thread.creatorDisplayName} ${thread.creatorHandle} ${thread.lastMessagePreview}`
      .toLocaleLowerCase()
      .includes(needle);
  const inbound = (threadsQuery.data?.inbound ?? []).filter(
    (thread) =>
      !needle ||
      `${thread.counterpartName ?? ""} ${thread.counterpartHandle ?? ""} ${thread.lastMessagePreview}`
        .toLocaleLowerCase()
        .includes(needle),
  );
  const requests = threads.filter((thread) => thread.state === "request" && matches(thread));
  const active = threads.filter((thread) => thread.state === "active" && matches(thread));
  const visibleInbound =
    filter === "requests"
      ? inbound
      : filter === "unread"
        ? inbound.filter((thread) => thread.creatorUnread > 0)
        : inbound;
  const visibleRequests = filter === "unread" ? requests.filter((thread) => thread.viewerUnread > 0) : requests;
  const visibleActive =
    filter === "requests" ? [] : filter === "unread" ? active.filter((thread) => thread.viewerUnread > 0) : active;
  const unread =
    threads.reduce((total, thread) => total + thread.viewerUnread, 0) + (threadsQuery.data?.inboundUnread ?? 0);
  const conversationOpen = Boolean(openThreadId || composeWith);
  const closeConversation = () => {
    if (openedDirectly.current && onExit) {
      onExit();
      return;
    }
    setOpenThreadId(null);
    setComposeWith(null);
  };

  const openFromList = (threadId: string) => {
    openedDirectly.current = false;
    setComposeWith(null);
    setOpenThreadId(threadId);
  };

  const openNewChat = async (target: SlurpComposeTarget) => {
    if (target.threadId) {
      openFromList(target.threadId);
      setComposePickerOpen(false);
      return;
    }
    if (target.kind === "character" && target.creatorAccountId && personaId) {
      try {
        const result = await openCreatorThread.mutateAsync({
          personaId,
          creatorAccountId: target.creatorAccountId,
          viewerAccountId: target.id,
        });
        openFromList(result.thread.id);
        setComposePickerOpen(false);
      } catch {
        // The thread view exposes the request state if the target cannot be opened.
      }
      return;
    }
    if (target.kind === "creator") {
      openedDirectly.current = true;
      setOpenThreadId(null);
      setComposeWith(target.id);
      setComposePickerOpen(false);
    }
  };

  const inbox = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {onExit && (
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] px-2">
          <button
            type="button"
            onClick={onExit}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            aria-label={localizeUi("ui.noodle.noodlerframe.back", { defaultValue: "Back" })}
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {exitTitle ?? localizeUi("ui.slurp.inbox.messagesTitle", { defaultValue: "Messages" })}
          </h1>
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h2 className="text-sm font-black">
            {localizeUi("ui.slurp.messages.conversations", { defaultValue: "Conversations" })}
          </h2>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--noodle-accent)]/12 px-2.5 py-1 text-[0.7rem] font-bold tabular-nums text-[var(--noodle-accent)]">
                {localizeUi("ui.slurp.messages.unreadTotal", { defaultValue: "{{count}} unread", count: unread })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setComposePickerOpen((open) => !open)}
              aria-expanded={composePickerOpen}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--noodle-accent)]/35 px-3 text-xs font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <Plus size={15} aria-hidden="true" />
              {localizeUi("ui.slurp.messages.newChat", { defaultValue: "New chat" })}
            </button>
          </div>
        </div>
        {composePickerOpen && (
          <section
            aria-label={localizeUi("ui.slurp.messages.newChat", { defaultValue: "New chat" })}
            className="space-y-2 rounded-2xl bg-[var(--slurp-surface)]/55 p-2 ring-1 ring-inset ring-white/[0.055]"
          >
            <p className="px-2 text-xs font-semibold text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.newChatDetail", {
                defaultValue: "Choose a Creator or invited character.",
              })}
            </p>
            {composeTargetsQuery.isLoading ? (
              <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.newChatLoading", { defaultValue: "Loading chat targets…" })}
              </p>
            ) : composeTargetsQuery.isError ? (
              <p role="alert" className="px-2 py-3 text-xs text-[var(--destructive)]">
                {localizeUi("ui.slurp.messages.newChatError", { defaultValue: "Chat targets are unavailable." })}
              </p>
            ) : (composeTargetsQuery.data?.targets ?? []).length === 0 ? (
              <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.newChatEmpty", { defaultValue: "No chat targets yet." })}
              </p>
            ) : (
              <div className="space-y-1">
                {(composeTargetsQuery.data?.targets ?? []).map((target: SlurpComposeTarget) => (
                  <button
                    key={`${target.kind}:${target.id}`}
                    type="button"
                    onClick={() => openNewChat(target)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-[var(--noodle-accent)]/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <Avatar account={{ displayName: target.displayName, avatarUrl: target.avatarUrl }} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{target.displayName}</span>
                      <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)]">
                        {target.kind === "character"
                          ? localizeUi("ui.slurp.messages.newChatCharacter", { defaultValue: "Invited character" })
                          : `@${target.handle}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <label className="sr-only" htmlFor="slurp-message-search">
              {localizeUi("ui.slurp.messages.searchLabel", { defaultValue: "Search conversations" })}
            </label>
            <input
              id="slurp-message-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={localizeUi("ui.slurp.messages.searchPlaceholder", { defaultValue: "Search conversations…" })}
              className="h-11 w-full rounded-xl bg-[linear-gradient(135deg,var(--slurp-surface-raised),var(--slurp-surface))] pl-9 pr-3 text-base shadow-[var(--slurp-shadow-raised)] outline-none ring-1 ring-inset ring-white/[0.06] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
            />
          </div>
        </div>

        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={localizeUi("ui.slurp.messages.filters", { defaultValue: "Message filters" })}
        >
          {(["all", "unread", "requests"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                "min-h-11 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors",
                filter === option &&
                  "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 ring-[var(--noodle-accent)]",
              )}
            >
              {localizeUi(`ui.slurp.messages.filter.${option}`, {
                defaultValue: option[0]?.toUpperCase() + option.slice(1),
              })}
            </button>
          ))}
        </div>

        {visibleInbound.length > 0 && (
          <section
            aria-labelledby="slurp-message-inbound"
            className="flex flex-col rounded-2xl bg-[var(--slurp-surface)]/55 p-1 ring-1 ring-inset ring-white/[0.055]"
          >
            <h2 id="slurp-message-inbound" className="px-2 pb-1 text-xs font-semibold text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.inbound", { defaultValue: "Written to your Creators" })}
            </h2>
            {visibleInbound.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={{
                  ...thread,
                  // The counterpart on this side is the fan, not the Creator, so the row names them.
                  creatorDisplayName:
                    thread.counterpartName ?? localizeUi("ui.slurp.messages.unknownFan", { defaultValue: "Someone" }),
                  creatorHandle: thread.counterpartHandle ?? "",
                  creatorAvatarUrl: null,
                  viewerUnread: thread.creatorUnread,
                }}
                locale={i18n.language}
                onOpen={() => openFromList(thread.id)}
                selected={thread.id === openThreadId}
              />
            ))}
          </section>
        )}

        {visibleRequests.length > 0 && (
          <section
            aria-labelledby="slurp-message-requests"
            className="flex flex-col rounded-2xl bg-[var(--slurp-surface)]/55 p-1 ring-1 ring-inset ring-white/[0.055]"
          >
            <h2 id="slurp-message-requests" className="px-2 pb-1 text-xs font-semibold text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.requests", { defaultValue: "Message requests" })}
            </h2>
            {visibleRequests.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                locale={i18n.language}
                onOpen={() => openFromList(thread.id)}
                pending
                selected={thread.id === openThreadId}
              />
            ))}
          </section>
        )}

        <section
          aria-labelledby="slurp-message-inbox"
          className="flex flex-col rounded-2xl bg-[var(--slurp-surface)]/45 p-1 ring-1 ring-inset ring-white/[0.045]"
        >
          <h2 id="slurp-message-inbox" className="sr-only">
            {localizeUi("ui.slurp.messages.conversations", { defaultValue: "Conversations" })}
          </h2>
          {visibleActive.length === 0 && filter === "all" ? (
            <div className="relative isolate overflow-hidden rounded-xl bg-[linear-gradient(145deg,var(--slurp-surface-raised),var(--slurp-surface))] px-6 py-9 text-center shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.06]">
              <SlurpEmptyArtwork className="absolute inset-0 -z-10" />
              <MessageCircle size={28} className="mx-auto text-[var(--noodle-accent)]" />
              <p className="mt-3 text-sm font-bold">
                {localizeUi("ui.slurp.messages.emptyTitle", { defaultValue: "No conversations yet" })}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.emptyDetail", {
                  defaultValue: "Open a Creator profile and send a message to start one.",
                })}
              </p>
            </div>
          ) : (
            visibleActive.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                locale={i18n.language}
                onOpen={() => openFromList(thread.id)}
                selected={thread.id === openThreadId}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );

  if (!conversationOpen && !workspace)
    return <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col">{inbox}</div>;

  return (
    <div className="grid h-full min-h-0 w-full flex-1 md:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)]">
      <aside
        className={cn(
          "min-h-0 flex-col border-e border-[var(--noodle-divider)]",
          conversationOpen ? "hidden md:flex" : "flex",
        )}
      >
        {inbox}
      </aside>
      {conversationOpen ? (
        <SlurpThreadView
          threadId={openThreadId}
          creatorAccountId={composeWith}
          personaId={personaId}
          ownedCreatorAccountIds={ownedCreatorAccountIds}
          unreadAtOpen={openThread ? { viewer: openThread.viewerUnread, creator: openThread.creatorUnread } : null}
          onBack={closeConversation}
          onOpenProfile={onOpenProfile}
          desktopSplit
        />
      ) : (
        <div className="hidden min-h-0 items-center justify-center bg-[color-mix(in_srgb,var(--slurp-surface)_45%,transparent)] px-6 text-center md:flex">
          <div className="max-w-xs">
            <MessageCircle size={28} className="mx-auto text-[var(--noodle-accent)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">
              {localizeUi("ui.slurp.messages.chooseConversation", { defaultValue: "Choose a conversation" })}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.chooseConversationDetail", {
                defaultValue: "Messages, requests, and commission conversations open here.",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadRow({
  thread,
  locale,
  onOpen,
  pending = false,
  selected = false,
}: {
  thread: SlurpThread;
  locale: string;
  onOpen: () => void;
  pending?: boolean;
  selected?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group flex min-h-16 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-start transition-[background-color,border-color,transform] hover:bg-[var(--noodle-accent)]/[0.07] active:scale-[0.96] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
        selected &&
          "border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/[0.11] shadow-[var(--slurp-shadow-raised)]",
      )}
    >
      <Avatar account={{ displayName: thread.creatorDisplayName, avatarUrl: thread.creatorAvatarUrl }} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-bold">{thread.creatorDisplayName}</span>
        </span>
        {thread.creatorHandle && (
          <span className="truncate text-[0.7rem] text-[var(--muted-foreground)]">@{thread.creatorHandle}</span>
        )}
        {(thread.subscribed || pending) && (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
            {thread.subscribed && (
              <span className="shrink-0 rounded-full bg-[var(--noodle-accent)]/12 px-1.5 py-0.5 text-[0.6rem] font-bold text-[var(--noodle-accent)]">
                {localizeUi("ui.slurp.messages.subscribed", { defaultValue: "Subscribed" })}
              </span>
            )}
            {pending && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-600 dark:text-amber-400">
                {localizeUi("ui.slurp.messages.pending", { defaultValue: "Pending" })}
              </span>
            )}
          </span>
        )}
        <span className="truncate text-xs text-[var(--muted-foreground)]">
          {thread.lastMessagePreview || localizeUi("ui.slurp.messages.noMessages", { defaultValue: "No messages yet" })}
        </span>
      </span>
      <time
        dateTime={thread.lastMessageAt}
        className="shrink-0 self-start pt-0.5 text-[0.65rem] tabular-nums text-[var(--muted-foreground)]"
      >
        {formatTime(thread.lastMessageAt, locale)}
      </time>
      {thread.viewerUnread > 0 && (
        <span
          className="ml-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[0.65rem] font-black tabular-nums text-zinc-950 [&_svg]:!text-zinc-950"
          aria-label={localizeUi("ui.slurp.messages.unreadCount", {
            defaultValue: "{{count}} unread",
            count: thread.viewerUnread,
          })}
        >
          {thread.viewerUnread}
        </span>
      )}
    </button>
  );
}

/**
 * One conversation, addressed either by its thread or by the creator it is with.
 *
 * The second form is what a profile links to: there may be no thread yet, and the whole point is
 * that arriving does not create one.
 */
function SlurpThreadView({
  threadId,
  creatorAccountId,
  personaId,
  ownedCreatorAccountIds,
  unreadAtOpen = null,
  onBack,
  onOpenProfile,
  desktopSplit = false,
}: {
  threadId: string | null;
  creatorAccountId: string | null;
  personaId: string | null;
  ownedCreatorAccountIds: string[];
  /** Unread counts from the inbox row, read before opening marks the thread as read. */
  unreadAtOpen?: { viewer: number; creator: number } | null;
  onBack: () => void;
  onOpenProfile: (accountId: string) => void;
  desktopSplit?: boolean;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const byThread = useSlurpThread(threadId, personaId);
  const olderMessages = useSlurpOlderMessages();
  const byCreator = useSlurpCompose(threadId ? null : creatorAccountId, personaId);
  const threadQuery = threadId ? byThread : byCreator;
  const send = useSendSlurpMessage();
  const cheat = useSlurpCheatDirective();
  const forceReply = useForceSlurpReply();
  const requestReply = useRequestSlurpReply();
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

  const holdTyping = (ms: number, replyId?: string) => {
    const conversation = activeConversationRef.current;
    const isCurrent = () =>
      activeConversationRef.current.personaId === conversation.personaId &&
      activeConversationRef.current.threadId === conversation.threadId;
    if (ms <= 0) {
      if (!isCurrent()) return;
      setTyping(false);
      if (replyId) {
        setHiddenReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });
      }
      return;
    }
    setTyping(true);
    // Hide the reply message until typing delay finishes
    if (replyId) {
      setHiddenReplyIds((prev) => new Set(prev).add(replyId));
    }
    // Clear any existing typing timeout
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      if (!isCurrent()) return;
      setTyping(false);
      if (replyId) {
        setHiddenReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });
      }
      typingTimeoutRef.current = null;
    }, ms);
  };

  /**
   * Cancel typing animation and reveal any hidden messages immediately.
   * Used when the fan interrupts by sending another message.
   */
  const cancelTyping = () => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setTyping(false);
    setHiddenReplyIds(new Set());
  };

  // The composer grows with its text up to a cap, and shrinks back once the draft is sent.
  useLayoutEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  useDismissablePopover(headerMenuOpen, setHeaderMenuOpen, headerMenuRef, headerMenuTriggerRef);
  useDismissablePopover(tierOpen, setTierOpen, tierPopoverRef, tierTriggerRef);

  const scrollToLatest = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  };

  const submit = async (force = false) => {
    const content = draft.trim();
    if (!content || !personaId || !targetCreatorAccountId || busy) return;
    const cheatMatch = /^\/cheat(?:\s+([\s\S]*))?$/iu.exec(content);
    if (cheatMatch) {
      setDraft("");
      try {
        const result = await cheat.mutateAsync({
          personaId,
          creatorAccountId: targetCreatorAccountId,
          directive: cheatMatch[1] ?? "",
        });
        toast.success(
          result.kind === "coins"
            ? localizeUi("ui.slurp.messages.cheatCoinsAccepted", {
                defaultValue: "Development wallet set to {{coins}} coins.",
                coins: result.coins,
              })
            : result.kind === "force_creator_photo"
              ? "Creator photo generation started."
              : result.kind === "force_ppv"
                ? "Paid unlock message sent. Normal price and access rules remain active."
                : result.kind === "follow_up"
                  ? "Follow-up test scheduled. The normal scheduler and availability rules still apply."
                  : result.kind === "mood"
                    ? `Conversation mood adjusted by ${result.amount}.`
                    : result.kind === "rapport"
                      ? `Conversation rapport adjusted by ${result.amount}.`
                      : result.kind === "availability"
                        ? `Creator availability extended for ${result.minutes} minutes.`
                        : result.kind === "help"
                          ? (result.help?.join("\n") ?? "No cheat commands are available.")
                          : localizeUi("ui.slurp.messages.cheatAccepted", {
                              defaultValue: "Cheat directive accepted.",
                            }),
        );
      } catch {
        toast.error(localizeUi("ui.slurp.messages.cheatRejected", { defaultValue: "Cheat directive rejected." }));
      }
      return;
    }
    const optimisticStartedAt = Date.now();
    if (!force && !ownsCreator && isCommissionRequest(content)) {
      setCommissionPrefill(content);
      setToolsOpen(true);
      setToolTab("commission");
      return;
    }
    const feeDue = !thread || thread.requestFeePaid <= 0;
    if (!force && !ownsCreator && feeDue && messaging?.dmPolicy === "paid" && !subscribed && messaging.requestFee > 0) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.slurp.messages.sendRequestTitle", { defaultValue: "Send message request?" }),
        message: localizeUi("ui.slurp.messages.sendRequestDetail", {
          defaultValue: "This costs {{fee}} coins. It opens the conversation but does not guarantee a reply.",
          fee: messaging.requestFee,
        }),
        confirmLabel: localizeUi("ui.slurp.messages.sendRequestConfirm", { defaultValue: "Send request" }),
      });
      if (!confirmed) return;
    }
    // Cancel any active typing animation when fan interrupts
    if (typing) {
      cancelTyping();
    }
    setError(null);
    setDraft("");
    // Show the message and the typing indicator at once. The send route waits for the model
    // before it answers, so the chat used to sit empty for the whole generation.
    setPending({ content, id: null, startedAt: optimisticStartedAt });
    // Sending always lands on your own message, even when you had scrolled up to reread.
    requestAnimationFrame(scrollToLatest);
    setReplyStatus(null);
    // An away Creator is not typing. Showing dots first and then the away block read as a reply
    // that was started and abandoned.
    if (!ownsCreator && availability?.online !== false) setTyping(true);
    const requestId =
      sendRequestId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);
    setSendRequestId(requestId);
    try {
      // On a Creator-side thread the player is the Creator, so the message goes the other way.
      // Sending through the viewer route here opened a second conversation from the persona to
      // their own Creator instead of answering the fan.
      if (ownsCreator && thread) {
        const written = await creatorReply.mutateAsync({
          creatorAccountId: thread.creatorAccountId,
          personaId,
          viewerAccountId: thread.viewerAccountId,
          content,
        });
        setPending({ content, id: written.message.id, startedAt: optimisticStartedAt });
        return;
      }
      const result = await send.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        content,
        requestId,
        tip: composerTipAmount > 0 ? { amount: composerTipAmount, note: composerTipNote.trim() } : null,
      });
      setSendRequestId(null);
      setPending({ content, id: result.message.id, startedAt: optimisticStartedAt });
      setReplyStatus(result.replyStatus ?? null);
      if (result.tipError) setError(result.tipError);
      setComposerTipAmount(0);
      setComposerTipNote("");
      holdTyping(result.reply ? (result.typingMs ?? 0) : 0, result.reply?.id);
    } catch (cause) {
      // Put the words back in the box. Losing a typed message to a failed request is the one
      // thing a chat surface must never do.
      setPending(null);
      setTyping(false);
      setDraft(content);
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.sendFailed", { defaultValue: "Could not send that message." }),
      );
    }
  };

  const sendTip = async (amount: number, note = "", restore?: { amount: string; note: string }) => {
    if (!personaId || !targetCreatorAccountId || busy) return;
    setError(null);
    setActiveTipAmount(amount);
    try {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.slurp.messages.sendTipTitle", {
          defaultValue: "Send {{amount}} coins as a tip?",
          amount,
        }),
        message: localizeUi("ui.slurp.messages.sendTipDetail", {
          defaultValue: "A tip is a gift. It does not guarantee a reply.",
        }),
        confirmLabel: localizeUi("ui.slurp.messages.sendTipConfirm", { defaultValue: "Send tip" }),
      });
      if (!confirmed) return;
      const result = await tip.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        amount,
        note,
        requestId: crypto.randomUUID(),
      });
      setStandaloneTip(result.message);
      if (result.reply) holdTyping(result.typingMs ?? 0, result.reply.id);
    } catch (cause) {
      if (restore) {
        setCustomTipAmount(restore.amount);
        setCustomTipNote(restore.note);
      }
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.tipFailed", { defaultValue: "Could not send that tip." }),
      );
    } finally {
      setActiveTipAmount(null);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-[color-mix(in_srgb,var(--slurp-surface)_45%,transparent)]">
      <div className="flex min-h-14 min-w-0 shrink-0 items-center gap-1 overflow-hidden border-b border-[var(--noodle-divider)] bg-[var(--slurp-glass)] px-1.5 py-1.5 backdrop-blur-xl sm:gap-2 sm:px-2">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
            desktopSplit && "md:hidden",
          )}
          aria-label={localizeUi("ui.slurp.messages.backToInbox", { defaultValue: "Back to inbox" })}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => headerProfileId && onOpenProfile(headerProfileId)}
          className="flex min-h-11 min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-[var(--noodle-accent)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none sm:gap-2.5 sm:px-2"
        >
          {headerAccount && <Avatar account={headerAccount} size="sm" />}
          <span className="min-w-0 max-w-full overflow-hidden">
            <span className="block truncate text-sm font-bold">{headerAccount?.displayName ?? ""}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="hidden truncate text-[0.7rem] text-[var(--muted-foreground)] sm:inline">
                @{headerAccount?.handle ?? ""}
              </span>
              {relationship && (
                <span className="flex min-w-0 items-center gap-1 truncate text-[0.7rem] text-[var(--muted-foreground)]">
                  <span className="hidden sm:inline">·</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      availability?.online
                        ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                        : availability?.minutesUntilOnline !== null &&
                            (availability?.minutesUntilOnline ?? Infinity) < 120
                          ? "bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.6)]"
                          : "bg-gray-400",
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {availability?.online
                      ? localizeUi("ui.slurp.messages.availableNow", { defaultValue: "Available now" })
                      : availability?.minutesUntilOnline !== null
                        ? localizeUi(
                            availability.estimated ? "ui.slurp.messages.probablyBackIn" : "ui.slurp.messages.backIn",
                            {
                              value1:
                                availability.minutesUntilOnline < 60
                                  ? `${Math.round(availability?.minutesUntilOnline ?? 0)}min`
                                  : `${Math.round((availability?.minutesUntilOnline ?? 0) / 60)}hr`,
                            },
                          )
                        : availability?.estimated
                          ? localizeUi("ui.slurp.messages.probablyAway")
                          : localizeUi("ui.slurp.messages.away", { defaultValue: "Away" })}
                  </span>
                </span>
              )}
            </span>
          </span>
        </button>
        {thread?.rapport && (
          <button
            ref={tierTriggerRef}
            type="button"
            aria-expanded={tierOpen}
            aria-haspopup="dialog"
            onClick={() => setTierOpen((open) => !open)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-1 text-[0.72rem] font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:pe-3",
              tierOpen && "bg-[var(--noodle-accent)]/10",
            )}
            aria-label={localizeUi("ui.slurp.messages.relationshipStatus", {
              defaultValue: "Relationship: {{tier}}",
              tier: localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`),
            })}
          >
            <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />
            <span className="hidden sm:inline">{localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`)}</span>
          </button>
        )}
        {tierOpen && thread?.rapport && (
          <NoodleAnchoredPopover anchorRef={tierTriggerRef}>
            <div
              ref={tierPopoverRef}
              role="dialog"
              aria-label={localizeUi("ui.slurp.messages.relationshipLevel", { defaultValue: "Relationship level" })}
              className="rounded-2xl bg-[var(--slurp-canvas,var(--background))] p-4 text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.relationshipLevel", { defaultValue: "Relationship level" })}
              </p>
              <p className="mt-0.5 text-base font-black">
                {localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {localizeUi(
                  ownsCreator
                    ? `ui.slurp.rapport.creatorHint.${thread.rapport.tier}`
                    : `ui.slurp.rapport.viewerHint.${thread.rapport.tier}`,
                )}
              </p>
              <SlurpTierLadder tier={thread.rapport.tier} className="mt-4" />
            </div>
          </NoodleAnchoredPopover>
        )}
        {/* Four icons of the same size and weight, because none of them outranks the others. The
            details button was the odd one out as a word, and read as the only real control. */}
        <div className="ml-auto hidden shrink-0 items-center sm:flex">
          {relationship && (
            <HeaderIconButton
              icon={Info}
              label={localizeUi("ui.slurp.messages.relationshipToggle", { defaultValue: "Details" })}
              onClick={() => setDrawerMode("details")}
            />
          )}
          {threadId && (
            <HeaderIconButton
              icon={Brain}
              label={localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" })}
              onClick={() => setDrawerMode("memories")}
            />
          )}
          {threadId && (
            <HeaderIconButton
              icon={BriefcaseBusiness}
              label={localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" })}
              badge={commissions.length}
              onClick={() => setDrawerMode("commissions")}
            />
          )}
          {threadId && (
            <button
              ref={searchTriggerRef}
              type="button"
              aria-expanded={messageSearchOpen}
              onClick={() => setMessageSearchOpen((open) => !open)}
              className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              aria-label={localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
              title={localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
            >
              <Search size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        {/* Four header icons do not fit beside a name on a phone, so they fold into one menu there. */}
        {(relationship || threadId) && (
          <button
            ref={headerMenuTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={headerMenuOpen}
            onClick={() => setHeaderMenuOpen((open) => !open)}
            aria-label={localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })}
            title={localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })}
            className={cn(
              "relative ml-auto flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 sm:hidden",
              headerMenuOpen && "bg-[var(--slurp-surface)] text-[var(--foreground)]",
            )}
          >
            <MoreVertical size={18} aria-hidden="true" />
            {commissions.length > 0 && (
              <span
                className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--noodle-accent)]"
                aria-hidden="true"
              />
            )}
          </button>
        )}
        {headerMenuOpen && (
          <NoodleAnchoredPopover anchorRef={headerMenuTriggerRef}>
            <div
              ref={headerMenuRef}
              role="menu"
              className="ms-auto w-56 rounded-xl bg-[var(--slurp-canvas,var(--background))] p-1 text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              {[
                relationship && {
                  key: "details",
                  icon: Info,
                  label: localizeUi("ui.slurp.messages.relationshipToggle", { defaultValue: "Details" }),
                  run: () => setDrawerMode("details"),
                },
                threadId && {
                  key: "memories",
                  icon: Brain,
                  label: localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" }),
                  run: () => setDrawerMode("memories"),
                },
                threadId && {
                  key: "commissions",
                  icon: BriefcaseBusiness,
                  label: localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" }),
                  badge: commissions.length,
                  run: () => setDrawerMode("commissions"),
                },
                threadId && {
                  key: "search",
                  icon: Search,
                  label: localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" }),
                  run: () => setMessageSearchOpen(true),
                },
              ]
                .filter((item): item is Exclude<typeof item, "" | null | undefined | false> => Boolean(item))
                .map(({ key, icon: Icon, label, run, ...item }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      run();
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <Icon size={16} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {"badge" in item && (item.badge ?? 0) > 0 && (
                      <span className="min-w-5 rounded-full bg-[var(--noodle-accent)] px-1.5 text-center text-[0.65rem] font-black leading-5 text-zinc-950">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </NoodleAnchoredPopover>
        )}
      </div>

      {messageSearchOpen && (
        <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] bg-[var(--slurp-glass)] px-3 backdrop-blur-xl">
          <label className="sr-only" htmlFor="slurp-conversation-search">
            {localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
          </label>
          <input
            ref={messageSearchInputRef}
            id="slurp-conversation-search"
            type="search"
            value={messageSearch}
            onChange={(event) => setMessageSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              setMessageSearchOpen(false);
              searchTriggerRef.current?.focus();
            }}
            placeholder={localizeUi("ui.slurp.messages.searchConversationPlaceholder", {
              defaultValue: "Search this conversation…",
            })}
            className="h-10 min-w-0 flex-1 rounded-xl bg-[var(--slurp-surface)] px-3 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
          />
          <span role="status" className="shrink-0 text-[0.68rem] tabular-nums text-[var(--muted-foreground)]">
            {messageSearch.trim()
              ? messageSearchMatches.length > 0
                ? localizeUi("ui.slurp.messages.searchPosition", {
                    defaultValue: "{{position}} of {{count}}",
                    position: messageSearchIndex + 1,
                    count: messageSearchMatches.length,
                  })
                : localizeUi("ui.slurp.messages.noMatches", { defaultValue: "No matches" })
              : ""}
          </span>
          {["previous", "next"].map((direction) => (
            <button
              key={direction}
              type="button"
              disabled={messageSearchMatches.length === 0}
              onClick={() =>
                setMessageSearchIndex((current) =>
                  direction === "previous"
                    ? (current - 1 + messageSearchMatches.length) % messageSearchMatches.length
                    : (current + 1) % messageSearchMatches.length,
                )
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-35 motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label={localizeUi(`ui.slurp.messages.search.${direction}`, {
                defaultValue: direction === "previous" ? "Previous match" : "Next match",
              })}
            >
              {direction === "previous" ? <ChevronDown size={16} className="rotate-180" /> : <ChevronDown size={16} />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMessageSearchOpen(false);
              searchTriggerRef.current?.focus();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label={localizeUi("ui.slurp.messages.closeSearch", { defaultValue: "Close search" })}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {activeCommission && (
        <div className="shrink-0 border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface)]/55 px-3 py-1.5">
          <button
            type="button"
            aria-expanded={commissionRibbonOpen}
            onClick={() => setCommissionRibbonOpen((open) => !open)}
            className="mx-auto flex min-h-11 w-full max-w-2xl items-center gap-2.5 rounded-xl px-2 text-start transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <BriefcaseBusiness size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold capitalize">
                {localizeUi("ui.slurp.messages.commissionRibbon", {
                  defaultValue: "Commission · {{state}}",
                  state: activeCommission.state,
                })}
              </span>
              <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                {activeCommission.state === "delivered"
                  ? localizeUi("ui.slurp.messages.commissionDeliveredHint", {
                      defaultValue: "The finished commission is in this chat",
                    })
                  : activeCommission.brief}
              </span>
            </span>
            <ChevronDown
              size={15}
              className={cn(
                "shrink-0 transition-transform motion-reduce:transition-none",
                commissionRibbonOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
          {commissionRibbonOpen && (
            <div className="mx-auto grid w-full max-w-2xl gap-2 px-2 pb-2 pt-1 text-xs sm:grid-cols-[1fr_auto]">
              <p className="min-w-0 break-words leading-5 text-[var(--muted-foreground)]">{activeCommission.brief}</p>
              <p className="font-bold tabular-nums">
                <SlurpCoinAmount amount={activeCommission.price} />
              </p>
              <ol
                className="flex items-center gap-1.5 sm:col-span-2"
                aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
              >
                {["brief", "quoted", "accepted", "delivered"].map((state, index) => {
                  const current = ["brief", "quoted", "accepted", "delivered"].indexOf(activeCommission.state);
                  return (
                    <li
                      key={state}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        index <= current ? "bg-[var(--noodle-accent)]" : "bg-[var(--accent)]",
                      )}
                    >
                      <span className="sr-only">{state}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {thread?.state === "request" && (
        <div className="mx-3 mt-3 shrink-0 rounded-2xl bg-amber-500/[0.08] px-4 py-3 ring-1 ring-inset ring-amber-500/25">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {ownsCreator
              ? localizeUi("ui.slurp.messages.requestForYou", {
                  defaultValue: "Accept, decline, or reply to open this conversation.",
                })
              : localizeUi("ui.slurp.messages.requestPending", {
                  defaultValue: "This request stays pending until the Creator accepts or replies.",
                })}
          </p>
          {ownsCreator && personaId && thread && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={resolveRequest.isPending}
                onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "accept" })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <Check size={14} /> {localizeUi("ui.slurp.messages.accept", { defaultValue: "Accept" })}
              </button>
              <button
                type="button"
                disabled={resolveRequest.isPending}
                onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "decline" })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <X size={14} /> {localizeUi("ui.slurp.messages.decline", { defaultValue: "Decline" })}
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={messageScrollRef}
        onScroll={(event) => {
          const container = event.currentTarget;
          setAwayFromBottom(container.scrollHeight - container.scrollTop - container.clientHeight > 240);
          // Reaching the top is the same request as pressing the button, so it does the same thing.
          if ((olderCount > 0 || nextOlderCursor) && container.scrollTop < 64) void showOlder();
        }}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4"
      >
        <div className="mx-auto flex min-w-0 w-full max-w-2xl flex-col gap-3">
          {(olderCount > 0 || nextOlderCursor) && (
            <button
              type="button"
              disabled={olderMessages.isPending}
              onClick={() => void showOlder()}
              className="mx-auto min-h-9 shrink-0 rounded-full bg-[var(--slurp-surface)] px-4 text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              {localizeUi("ui.slurp.messages.loadOlder", {
                defaultValue: "Show earlier messages ({{count}})",
                count: olderCount || SLURP_MESSAGE_PAGE,
              })}
            </button>
          )}
          {messages.length === 0 && messaging && (
            <p className="mx-auto max-w-sm rounded-xl bg-[var(--slurp-surface)] px-4 py-3 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]">
              {messaging.dmPolicy === "closed"
                ? localizeUi("ui.slurp.messages.policyClosed", {
                    defaultValue: "{{name}} has direct messages turned off.",
                    name: creator?.displayName ?? "",
                  })
                : messaging.dmPolicy === "paid" && !subscribed
                  ? localizeUi("ui.slurp.messages.policyPaid", {
                      defaultValue: "Your first message costs {{fee}} coins unless you subscribe.",
                      fee: messaging.requestFee,
                    }) +
                    " " +
                    localizeUi("ui.slurp.messages.requestFeeHint", {
                      defaultValue: "The fee opens the thread. It does not guarantee a reply.",
                    })
                  : messaging.dmPolicy === "subscribers" && !subscribed
                    ? localizeUi("ui.slurp.messages.policySubscribers", {
                        defaultValue: "You are not subscribed, so your first message goes to their requests.",
                      })
                    : localizeUi("ui.slurp.messages.policyOpen", {
                        defaultValue: "Say hello.",
                      })}
            </p>
          )}
          {visibleTimeline.map((entry, index) => {
            const date = new Date(entry.at).toLocaleDateString(i18n.language, { dateStyle: "medium" });
            const previousDate =
              index > 0
                ? new Date(visibleTimeline[index - 1]!.at).toLocaleDateString(i18n.language, { dateStyle: "medium" })
                : null;
            return (
              <div
                key={entry.kind === "message" ? entry.message.id : entry.commission.id}
                id={entry.kind === "message" ? `slurp-message-${entry.message.id}` : undefined}
                className="contents scroll-mt-28"
              >
                {date !== previousDate && (
                  <div className="self-center py-2 text-[0.65rem] font-bold text-[var(--muted-foreground)]">{date}</div>
                )}
                {entry.kind === "message" && entry.message.id === firstUnreadMessageId && (
                  <div
                    id="slurp-unread-marker"
                    role="separator"
                    className="flex scroll-mt-16 items-center gap-3 py-1 text-[0.68rem] font-bold text-[var(--noodle-accent)]"
                  >
                    <span className="h-px flex-1 bg-[var(--noodle-accent)]/40" aria-hidden="true" />
                    {localizeUi("ui.slurp.messages.newMessages", { defaultValue: "New messages" })}
                    <span className="h-px flex-1 bg-[var(--noodle-accent)]/40" aria-hidden="true" />
                  </div>
                )}
                {entry.kind === "message" ? (
                  standaloneTip?.id === entry.message.id ? (
                    <SlurpPlatformActionCard message={entry.message} relationship={relationship} />
                  ) : (
                    <MessageBubble
                      message={entry.message}
                      locale={i18n.language}
                      personaId={personaId}
                      ownsCreator={ownsCreator}
                    />
                  )
                ) : personaId ? (
                  <CommissionRow
                    commission={entry.commission}
                    deliveryMessage={entry.deliveryMessage}
                    personaId={personaId}
                    ownsCreator={ownsCreator}
                  />
                ) : null}
              </div>
            );
          })}
          {pending &&
            !messages.some(
              (message) =>
                (pending.id !== null && message.id === pending.id) ||
                (message.role === "viewer" &&
                  message.content === pending.content &&
                  Date.parse(message.createdAt) >= pending.startedAt),
            ) && (
              <div className="flex max-w-[88%] flex-col items-end gap-1 self-end opacity-60 sm:max-w-[78%]">
                <div className="whitespace-pre-wrap break-words rounded-[1.15rem] rounded-br-[0.35rem] bg-[var(--noodle-accent)] px-3.5 py-2.5 text-sm leading-relaxed text-zinc-950 [&_svg]:!text-zinc-950 shadow-[var(--slurp-shadow-raised)]">
                  {pending.content}
                </div>
              </div>
            )}
          {!typing && (waitingNote || canForceReply) && (
            <section
              aria-live="polite"
              aria-labelledby={waitingNote && SLURP_AWAY_STATUSES.has(waitingNote) ? "slurp-away-title" : undefined}
              aria-describedby="slurp-away-detail"
              className="relative mx-auto flex w-full max-w-md flex-col items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--noodle-accent)_12%,transparent),transparent_48%),linear-gradient(160deg,var(--slurp-surface-raised),var(--slurp-surface))] px-5 pb-5 pt-4 text-center shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)] sm:px-8 sm:pb-6 sm:pt-5"
            >
              {/* A status card, like a platform's own notice: the sleeping avatar for "not now",
                  a plain icon for problems the fan has to act on (busy, no connection, failed). */}
              {waitingNote && SLURP_AWAY_STATUSES.has(waitingNote) ? (
                <>
                  <SlurpAwayAnimation account={headerAccount ?? null} />
                  <p className="-mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--noodle-accent)]/12 px-3 py-1 text-[0.62rem] font-bold uppercase text-[var(--noodle-accent)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--noodle-accent)]" aria-hidden="true" />
                    {localizeUi("ui.slurp.messages.away", { defaultValue: "Away" })}
                  </p>
                  <h3 id="slurp-away-title" className="mt-1 text-base font-bold">
                    {localizeUi(`ui.slurp.messages.awayTitle.${waitingNote ?? "owed"}`, {
                      defaultValue: SLURP_AWAY_TITLE_FALLBACKS[waitingNote ?? "owed"] ?? "{{name}} is away",
                      name: creator?.displayName ?? "",
                    })}
                  </h3>
                </>
              ) : (
                <Info size={17} className="mt-2 text-[var(--noodle-accent)]" aria-hidden="true" />
              )}
              <p
                id="slurp-away-detail"
                className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted-foreground)]"
              >
                {waitingNote
                  ? localizeUi(`ui.slurp.messages.replyStatus.${waitingNote}`, {
                      defaultValue: SLURP_REPLY_STATUS_FALLBACKS[waitingNote] ?? "No answer yet.",
                      name: creator?.displayName ?? "",
                    })
                  : localizeUi("ui.slurp.messages.replyStatus.owed", {
                      defaultValue: "Your message is delivered. They have not answered yet.",
                      name: creator?.displayName ?? "",
                    })}
              </p>
              {canForceReply && thread && personaId && (
                <button
                  type="button"
                  disabled={forceReply.isPending}
                  onClick={async () => {
                    const forcedPersonaId = personaId;
                    const forcedThreadId = thread.id;
                    setError(null);
                    setTyping(true);
                    try {
                      const result = await forceReply.mutateAsync({
                        personaId: forcedPersonaId,
                        threadId: forcedThreadId,
                      });
                      if (
                        activeConversationRef.current.personaId !== forcedPersonaId ||
                        activeConversationRef.current.threadId !== forcedThreadId
                      )
                        return;
                      setReplyStatus(result.replyStatus);
                      // "Now" means now: the pacing delay is the thing this button exists to skip.
                      holdTyping(0, result.reply?.id);
                    } catch (cause) {
                      if (
                        activeConversationRef.current.personaId !== forcedPersonaId ||
                        activeConversationRef.current.threadId !== forcedThreadId
                      )
                        return;
                      setTyping(false);
                      setError(getApiErrorMessage(cause, "The reply could not be written."));
                    }
                  }}
                  className="min-h-9 rounded-full px-3 text-[0.7rem] font-semibold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-[background-color,opacity] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
                >
                  {localizeUi("ui.slurp.messages.forceReply", { defaultValue: "Get reply now" })}
                </button>
              )}
            </section>
          )}
          {typing && (
            <div
              aria-live="polite"
              className="self-start flex items-center gap-2 rounded-2xl rounded-bl-md bg-[var(--slurp-surface)] px-4 py-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              <div className="flex gap-1">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-[bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-[bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: "160ms" }}
                />
                <span
                  className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-[bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: "320ms" }}
                />
              </div>
              <span className="text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.typing", {
                  defaultValue: "{{name}} is typing…",
                  name: creator?.displayName ?? "",
                })}
              </span>
            </div>
          )}
          {preparingImage && (
            <p
              aria-live="polite"
              className="flex max-w-[88%] items-center gap-2 self-end rounded-2xl rounded-br-md bg-[var(--noodle-accent)]/15 px-3.5 py-2.5 text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/25"
            >
              <Loader2 size={14} className="animate-spin text-[var(--noodle-accent)]" aria-hidden="true" />
              {localizeUi("ui.slurp.messages.preparingImage", {
                defaultValue: "{{name}} is preparing an image…",
                name: creator?.displayName ?? "The Creator",
              })}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <p role="alert" className="shrink-0 px-4 pb-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="relative shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {awayFromBottom && (
          <button
            type="button"
            onClick={scrollToLatest}
            aria-label={localizeUi("ui.slurp.messages.scrollToLatest", { defaultValue: "Scroll to latest message" })}
            title={localizeUi("ui.slurp.messages.scrollToLatest", { defaultValue: "Scroll to latest message" })}
            className="absolute bottom-full left-1/2 z-10 mb-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <ArrowDown size={18} aria-hidden="true" />
            {typing && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--noodle-accent)] ring-2 ring-[var(--slurp-surface-raised)]"
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {toolsOpen && (
            <div className="flex flex-col gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating)]">
              <div className="flex flex-col gap-3" aria-label="Message actions">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <h2 className="text-sm font-black">Add to your message</h2>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Choose one action to continue.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToolsOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    aria-label="Close message actions"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                {(["media", "conversation", "payment", "creator"] as const).map((group) => {
                  const items = toolTabs.filter((tab) => tab.group === group);
                  if (items.length === 0) return null;
                  const heading =
                    group === "media"
                      ? localizeUi("ui.slurp.messages.mediaActions", { defaultValue: "Media" })
                      : group === "conversation"
                        ? localizeUi("ui.slurp.messages.conversationActions", { defaultValue: "Conversation" })
                        : group === "payment"
                          ? localizeUi("ui.slurp.messages.paymentActions", { defaultValue: "Payments" })
                          : localizeUi("ui.slurp.messages.creatorActions", { defaultValue: "Creator tools" });
                  return (
                    <section key={group} className="flex flex-col gap-1.5">
                      <h3 className="px-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                        {heading}
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setToolTab(tab.id)}
                            className="flex min-h-16 items-center gap-3 rounded-xl bg-[var(--slurp-surface)] px-3 text-left ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.08] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
                              <tab.icon size={18} aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold">{tab.label}</span>
                              <span className="mt-0.5 block text-[0.68rem] leading-4 text-[var(--muted-foreground)]">
                                {tab.detail}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              {toolTab === "commission" && (
                <CommissionRequest
                  disabled={busy || !personaId || !targetCreatorAccountId}
                  pending={createCommission.isPending}
                  initialBrief={commissionPrefill}
                  onSendAsMessage={
                    commissionPrefill
                      ? () => {
                          setCommissionPrefill("");
                          setToolsOpen(false);
                          void submit(true);
                        }
                      : null
                  }
                  onSubmit={(brief) => {
                    if (!personaId || !targetCreatorAccountId) return;
                    setError(null);
                    createCommission
                      .mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, brief })
                      .then(() => {
                        setDraft("");
                        setCommissionPrefill("");
                        setToolsOpen(false);
                      })
                      .catch((cause: unknown) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : localizeUi("ui.slurp.messages.commissionFailed", {
                                defaultValue: "Could not send that request.",
                              }),
                        ),
                      );
                  }}
                />
              )}

              {toolTab === "photo" && !ownsCreator && thread && personaId && targetCreatorAccountId && (
                <FanImageTool
                  threadId={thread.id}
                  creatorAccountId={targetCreatorAccountId}
                  personaId={personaId}
                  mode="choose"
                />
              )}

              {toolTab === "request" && !ownsCreator && thread && personaId && (
                <div className="flex flex-col gap-2 rounded-xl bg-[var(--slurp-surface)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
                  <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.slurp.messages.requestReplyDetail", {
                      defaultValue: "Ask for a reply. This does not bypass availability or conversation rules.",
                    })}
                  </p>
                  <div
                    className="grid gap-1.5 sm:grid-cols-3"
                    role="group"
                    aria-label={localizeUi("ui.slurp.messages.requestHintLabel", { defaultValue: "Request hint" })}
                  >
                    {(
                      [
                        ["photo", "Ask for a photo"],
                        ["paid-unlock", "Ask about paid content"],
                        ["follow-up", "Ask for a follow-up"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={requestHint === value}
                        onClick={() => setRequestHint(value)}
                        className={cn(
                          "min-h-10 rounded-lg px-2 text-xs font-semibold ring-1 ring-inset ring-[var(--noodle-divider)]",
                          requestHint === value &&
                            "bg-[var(--noodle-accent)] text-zinc-950 ring-[var(--noodle-accent)]",
                        )}
                      >
                        {localizeUi(`ui.slurp.messages.requestHint.${value}`, { defaultValue: label })}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy || requestReply.isPending}
                    onClick={() => {
                      setError(null);
                      requestReply
                        .mutateAsync({ threadId: thread.id, personaId, guidance: requestHintGuidance(requestHint) })
                        .then((result) => {
                          setReplyStatus(result.replyStatus);
                          holdTyping(result.reply ? (result.typingMs ?? 0) : 0, result.reply?.id);
                          setToolsOpen(false);
                          setToolTab(null);
                        })
                        .catch((cause: unknown) =>
                          setError(cause instanceof Error ? cause.message : "Could not request a reply."),
                        );
                    }}
                    className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
                  >
                    {requestReply.isPending ? "Requesting…" : "Request a reply"}
                  </button>
                </div>
              )}

              {toolTab === "generated-photo" && !ownsCreator && thread && personaId && targetCreatorAccountId && (
                <FanImageTool
                  threadId={thread.id}
                  creatorAccountId={targetCreatorAccountId}
                  personaId={personaId}
                  mode="generate"
                />
              )}

              {toolTab === "creator" && ownsCreator && personaId && thread && (
                <div className="flex flex-col gap-2">
                  <CreatorMessageTools
                    creatorAccountId={thread.creatorAccountId}
                    viewerAccountId={thread.viewerAccountId}
                    personaId={personaId}
                    defaultPpvPrice={messaging?.ppvPrice ?? 0}
                    threadId={thread.id}
                    onPreparingImage={setPreparingImage}
                    mode="locked"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      draftReply
                        .mutateAsync({ creatorAccountId: thread.creatorAccountId, personaId, threadId: thread.id })
                        .catch((cause: unknown) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : localizeUi("ui.slurp.messages.draftFailed", {
                                  defaultValue: "Could not draft a reply.",
                                }),
                          ),
                        );
                    }}
                    className="min-h-11 self-start rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    {draftReply.isPending
                      ? localizeUi("ui.slurp.messages.drafting", { defaultValue: "Writing…" })
                      : localizeUi("ui.slurp.messages.draftReply", { defaultValue: "Let them answer" })}
                  </button>
                </div>
              )}

              {toolTab === "generated-photo" && ownsCreator && personaId && thread && (
                <CreatorMessageTools
                  creatorAccountId={thread.creatorAccountId}
                  viewerAccountId={thread.viewerAccountId}
                  personaId={personaId}
                  defaultPpvPrice={messaging?.ppvPrice ?? 0}
                  threadId={thread.id}
                  onPreparingImage={setPreparingImage}
                  mode="generate"
                />
              )}

              {toolTab === "tip" && (
                <>
                  {/* Send now, or attach to the message being written. Both were on screen at once
                      with near-identical rows, which is how you tip twice by accident. */}
                  <div
                    role="group"
                    aria-label={localizeUi("ui.slurp.messages.tipMode", { defaultValue: "How to tip" })}
                    className="flex items-center gap-1"
                  >
                    {(["now", "with-message"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={tipMode === mode}
                        disabled={mode === "with-message" && ownsCreator}
                        onClick={() => setTipMode(mode)}
                        className={cn(
                          "min-h-9 rounded-full px-3 text-[0.7rem] font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] disabled:hidden",
                          tipMode === mode &&
                            "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 ring-[var(--noodle-accent)]",
                        )}
                      >
                        {mode === "now"
                          ? localizeUi("ui.slurp.messages.tipNow", { defaultValue: "Send now" })
                          : localizeUi("ui.slurp.messages.tipWithMessage", { defaultValue: "With my message" })}
                      </button>
                    ))}
                  </div>

                  {tipMode === "now" ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SlurpCoin size={15} />
                      {TIP_PRESETS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          disabled={busy || !personaId || !targetCreatorAccountId}
                          onClick={() => sendTip(amount)}
                          className="relative min-h-11 overflow-visible rounded-full px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                        >
                          <SlurpCoinBurst active={activeTipAmount === amount} />
                          {localizeUi("ui.slurp.messages.tipAmount", { defaultValue: "Tip {{amount}}", amount })}
                        </button>
                      ))}
                      <label className="sr-only" htmlFor="slurp-custom-tip-amount">
                        {localizeUi("ui.slurp.messages.customTipAmount", { defaultValue: "Custom tip amount" })}
                      </label>
                      <input
                        id="slurp-custom-tip-amount"
                        type="number"
                        min={1}
                        max={9999}
                        value={customTipAmount}
                        onChange={(event) => setCustomTipAmount(event.target.value)}
                        placeholder={localizeUi("ui.slurp.messages.customTipPlaceholder", { defaultValue: "Other" })}
                        className="h-11 w-20 rounded-full bg-[var(--slurp-surface)] px-3 text-xs tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
                      />
                      <label className="sr-only" htmlFor="slurp-custom-tip-note">
                        {localizeUi("ui.slurp.messages.customTipNote", { defaultValue: "Tip note" })}
                      </label>
                      <input
                        id="slurp-custom-tip-note"
                        value={customTipNote}
                        maxLength={280}
                        onChange={(event) => setCustomTipNote(event.target.value)}
                        placeholder={localizeUi("ui.slurp.messages.tipNotePlaceholder", { defaultValue: "Note" })}
                        className="h-11 min-w-28 flex-1 rounded-full bg-[var(--slurp-surface)] px-3 text-xs outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
                      />
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !personaId ||
                          !targetCreatorAccountId ||
                          !Number.isInteger(Number(customTipAmount)) ||
                          Number(customTipAmount) < 1 ||
                          Number(customTipAmount) > 9999
                        }
                        onClick={() => {
                          void sendTip(Number(customTipAmount), customTipNote.trim(), {
                            amount: customTipAmount,
                            note: customTipNote,
                          });
                          setCustomTipAmount("");
                          setCustomTipNote("");
                        }}
                        className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
                      >
                        {localizeUi("ui.slurp.messages.sendCustomTip", { defaultValue: "Send tip" })}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {TIP_PRESETS.map((amount) => (
                        <button
                          key={`composer-tip-${amount}`}
                          type="button"
                          aria-pressed={composerTipAmount === amount}
                          onClick={() => setComposerTipAmount((current) => (current === amount ? 0 : amount))}
                          className={cn(
                            "min-h-9 rounded-full px-2.5 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-accent)]/40",
                            composerTipAmount === amount &&
                              "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950",
                          )}
                        >
                          {amount}
                        </button>
                      ))}
                      {composerTipAmount > 0 && (
                        <input
                          value={composerTipNote}
                          maxLength={280}
                          onChange={(event) => setComposerTipNote(event.target.value)}
                          placeholder={localizeUi("ui.slurp.messages.tipNotePlaceholder", { defaultValue: "Tip note" })}
                          className="h-9 min-w-32 flex-1 rounded-full bg-[var(--slurp-surface)] px-3 text-xs outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
                        />
                      )}
                      <p className="w-full text-[0.65rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.messages.tipWithMessageHint", {
                          defaultValue: "The tip goes with the next message you send.",
                        })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <form
            className="flex items-end gap-0.5 rounded-2xl bg-[var(--slurp-surface)] p-1 shadow-sm ring-1 ring-inset ring-[var(--noodle-divider)] transition-shadow focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]/55 motion-reduce:transition-none"
            onClick={(event) => {
              // A tap on the bar's padding means "write here", as in the Engine chat box.
              if (event.target === event.currentTarget) composerRef.current?.focus();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <button
              type="button"
              onClick={() => {
                setToolsOpen((value) => {
                  const next = !value;
                  if (next) setToolTab(null);
                  return next;
                });
              }}
              aria-expanded={toolsOpen}
              aria-label={localizeUi("ui.slurp.messages.toggleTools", { defaultValue: "Message tools" })}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,color,transform] hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--noodle-accent)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
                toolsOpen && "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]",
              )}
            >
              <Plus
                size={18}
                className={cn("transition-transform motion-reduce:transition-none", toolsOpen && "rotate-45")}
                aria-hidden="true"
              />
            </button>
            <SlurpConnectionSwitcher
              connections={(connectionsQuery.data ?? []).filter(
                (connection) => connection.provider !== "image_generation",
              )}
              activeConnectionId={settingsQuery.data?.generationConnectionId ?? null}
              open={connectionPickerOpen}
              onOpenChange={setConnectionPickerOpen}
              pending={updateSlurpSettings.isPending}
              onChange={(generationConnectionId) => updateSlurpSettings.mutate({ generationConnectionId })}
            />
            <label className="sr-only" htmlFor="slurp-message-draft">
              {localizeUi("ui.slurp.messages.composerLabel", { defaultValue: "Write a message" })}
            </label>
            <textarea
              ref={composerRef}
              id="slurp-message-draft"
              value={draft}
              rows={1}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line: the convention every chat box uses.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={localizeUi("ui.slurp.messages.composerPlaceholder", { defaultValue: "Write a message…" })}
              className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-base leading-6 outline-none placeholder:text-[var(--muted-foreground)] sm:text-sm sm:leading-6"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !personaId || !targetCreatorAccountId}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                draft.trim()
                  ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 active:scale-90 motion-reduce:active:scale-100 disabled:opacity-50"
                  : "text-[var(--muted-foreground)] opacity-50",
              )}
              aria-label={localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      <dialog
        ref={drawerRef}
        onClose={closeDrawer}
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        aria-labelledby="slurp-conversation-drawer-title"
        className="fixed inset-x-0 bottom-0 top-auto m-0 ms-auto h-auto max-h-[82dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-[var(--slurp-canvas,var(--background))] p-0 text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] backdrop:bg-black/55 md:inset-y-0 md:end-0 md:start-auto md:h-full md:max-h-none md:w-[min(28rem,92vw)] md:rounded-none md:rounded-s-2xl"
      >
        <div className="flex max-h-[82dvh] min-h-0 flex-col overscroll-contain md:h-full md:max-h-none">
          <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-[var(--noodle-divider)] px-4">
            {drawerMode === "prompt" && (
              <button
                type="button"
                onClick={() => setDrawerMode("memories")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                aria-label={localizeUi("ui.slurp.messages.backToMemories", { defaultValue: "Back to memories" })}
              >
                <ArrowLeft size={18} className="rtl:-scale-x-100" aria-hidden="true" />
              </button>
            )}
            <h2 id="slurp-conversation-drawer-title" className="min-w-0 flex-1 truncate text-sm font-black">
              {drawerMode === "prompt"
                ? localizeUi("ui.slurp.messages.promptDetails", { defaultValue: "Prompt details" })
                : drawerMode === "memories"
                  ? localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" })
                  : drawerMode === "commissions"
                    ? localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" })
                    : localizeUi("ui.slurp.messages.details", { defaultValue: "Details" })}
            </h2>
            <button
              type="button"
              onClick={closeDrawer}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label={localizeUi("ui.slurp.messages.closeDetails", { defaultValue: "Close details" })}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            {drawerMode === "prompt" ? (
              <SlurpPromptDebugPanel enabled={promptDebugEnabled} query={promptDebug} />
            ) : drawerMode === "memories" ? (
              <SlurpMemoriesPanel
                notes={relationship?.notes ?? []}
                scheduledFollowUps={relationship?.scheduledFollowUps}
                threadId={threadId}
                personaId={personaId}
                onOpenPrompt={threadId ? () => setDrawerMode("prompt") : null}
              />
            ) : drawerMode === "commissions" ? (
              <SlurpCommissionsPanel
                commissions={commissions}
                personaId={personaId}
                ownsCreator={ownsCreator}
                onAskCommission={
                  ownsCreator
                    ? null
                    : () => {
                        closeDrawer();
                        setCommissionPrefill("");
                        setToolsOpen(true);
                        setToolTab("commission");
                      }
                }
              />
            ) : (
              <>
                {headerAccount && (
                  <section className="flex items-center gap-3 px-4 py-4">
                    <Avatar account={headerAccount} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{headerAccount.displayName}</p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">@{headerAccount.handle}</p>
                      {thread && <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />}
                    </div>
                    {headerProfileId && (
                      <button
                        type="button"
                        onClick={() => onOpenProfile(headerProfileId)}
                        className="min-h-10 shrink-0 rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                      >
                        {localizeUi("ui.slurp.messages.viewProfile", { defaultValue: "View profile" })}
                      </button>
                    )}
                  </section>
                )}
                {relationship && (
                  <SlurpRelationshipPanel
                    relationship={relationship}
                    resetting={resetThread.isPending}
                    onReset={
                      threadId && personaId
                        ? () => {
                            setError(null);
                            void showConfirmDialog({
                              title: localizeUi("ui.slurp.messages.resetTitle", {
                                defaultValue: "Clear this conversation?",
                              }),
                              message: localizeUi("ui.slurp.messages.resetDetail", {
                                defaultValue:
                                  "Every message here is deleted, and any unfinished commission is closed. What they remember of you is kept, and so are coins, unlocks and finished commissions. This cannot be undone.",
                              }),
                              confirmLabel: localizeUi("ui.slurp.messages.resetConfirm", {
                                defaultValue: "Clear it",
                              }),
                            })
                              .then((confirmed) => {
                                if (confirmed) return resetThread.mutateAsync({ threadId, personaId });
                              })
                              .catch((cause: unknown) =>
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : localizeUi("ui.slurp.messages.resetFailed", {
                                        defaultValue: "Could not clear this conversation.",
                                      }),
                                ),
                              );
                          }
                        : null
                    }
                  />
                )}
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
