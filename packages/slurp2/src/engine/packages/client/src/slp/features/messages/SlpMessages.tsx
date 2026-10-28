import { SlpTimestamp } from "../../base/ui/SlpTimestamp";
import { SlpStoryRingAvatar } from "../../modules/story/SlpStoryRing";
import { ArrowLeft, Headset, MessageCircle, Plus, Search } from "lucide-react";
import type { SlurpComposeTarget } from "../../features/messages/slp-messages-contract";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import {
  Avatar,
  SLP_EYEBROW_CLASS,
  SLP_GROUP_CLASS,
  SLP_PAGE_SCROLL_CLASS,
  SLP_SEARCH_FIELD_CLASS,
  SLP_TOP_BAR_CLASS,
} from "../../base/chrome/SlpChrome";
import { SlpButton, SlpChip, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import type { SlurpThread } from "../../features/messages/slp-messages-contract";
import { useSlurpThreads } from "../../features/messages/slp-messages-hooks";
import { toast } from "sonner";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
/**
 * What each reply outcome means, in the fan's words.
 *
 * `replyToSlurpMessage` reports six outcomes and the client displayed none of them, so an offline
 * creator, a thread already generating, and a missing connection were all the same blank screen.
 */
import { BroadcastPanel } from "./SlpMessageTools";
import { SlurpThreadView } from "./SlpThreadView";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";

export { BroadcastPanel };

export const SLURP_REPLY_STATUS_FALLBACKS: Record<string, string> = {
  queued: "Your message is delivered. They reply when they next check their messages.",
  budget: "Delivered. {{name}} answers once today's reply budget resets. You can raise it under Audience → AI budget.",
  owed: "Your message is delivered. They have not answered yet.",
  cooling: "They stepped away from this conversation. Give them some time.",
  busy: "{{name}} is already writing back. Give it a moment.",
  ineligible: "{{name}} is not answering this conversation right now.",
  ai_off:
    "Your message is delivered. Replies are paused while Slurp's AI budget is off; turn it on under Audience → AI budget.",
  connection_not_found: "No text connection is configured, so nobody can answer yet.",
  failed: "The reply could not be written. Your message was still delivered.",
};

/** Reply outcomes that only mean "not now". They render as the away animation, without words. */
export const SLURP_AWAY_STATUSES = new Set(["queued", "owed", "cooling", "ineligible", "in_scene"]);
/** The away card's headline. The status line below it carries the detail. */
export const SLURP_AWAY_TITLE_FALLBACKS: Record<string, string> = {
  queued: "{{name}} is away",
  owed: "Waiting for {{name}}",
  cooling: "{{name}} needs a break",
  ineligible: "{{name}} is not answering",
};
/** Per away kind (`slp-away-kind.ts`): the small tag and a headline that replaces the status one. "away" keeps the status headline. */
export const SLURP_AWAY_KIND_FALLBACKS: Record<string, { tag: string; title?: string }> = {
  away: { tag: "Away" },
  asleep: { tag: "Asleep", title: "{{name}} is asleep" },
  busy: { tag: "Busy", title: "{{name}} is busy right now" },
  gym: { tag: "Working out", title: "{{name}} is working out" },
  trip: { tag: "On the move", title: "{{name}} is on the move" },
  cooling: { tag: "Cooling off", title: "{{name}} needs a break" },
  quiet: { tag: "Offline", title: "{{name}} has gone quiet" },
};

export const TIP_PRESETS = [5, 15, 50] as const;

export function requestHintGuidance(hint: "photo" | "paid-unlock" | "follow-up"): string {
  if (hint === "photo")
    return "The fan would enjoy a photo if you want to share one. Treat this as an optional suggestion, not a promise or demand.";
  if (hint === "paid-unlock")
    return "The fan is open to paid or locked content if you choose to offer it. Do not invent an offer or pressure the fan.";
  return "The fan would appreciate a follow-up or promise if one fits naturally. Do not promise an outcome unless you choose to do so.";
}

/** How much of a conversation is mounted at once, and how much one "show earlier" adds. */
export const SLURP_MESSAGE_PAGE = 25;

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
  composeAsSupport = false,
  initialThreadId = null,
  onOpenProfile,
  onThreadContextChange,
  onConversationOpenChange,
  workspace = false,
  onExit = null,
  exitTitle,
  onOpenDesk,
}: {
  /** The Stir tab's Support desk, where Slurp Support's threads live (docs/SUPPORT-DESK.md). */
  onOpenDesk?: () => void;
  personaId: string | null;
  /** Creator profiles this persona owns, so their request trays can be answered from here. */
  ownedCreatorAccountIds: string[];
  /** Set when Messages was opened from a Creator profile, to land straight in that chat. */
  composeWithCreatorAccountId?: string | null;
  /** Land in that Creator's Slurp Support thread instead (the Stir ✦ sheet's "Talk as Slurp Support"). */
  composeAsSupport?: boolean;
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
  const { t: localizeUi } = useUiTranslation();
  const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId);
  // Another persona has other chats: the open one belongs to the persona before (R1-140).
  const [threadPersonaId, setThreadPersonaId] = useState(personaId);
  if (threadPersonaId !== personaId) {
    setThreadPersonaId(personaId);
    setOpenThreadId(null);
  }
  // Opening a chat from a profile lands in it directly, and backing out returns to the inbox
  // rather than to the profile, so Messages behaves the same however you arrived.
  const [composeWith, setComposeWith] = useState<string | null>(composeWithCreatorAccountId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "requests">("all");
  const [composePickerOpen, setComposePickerOpen] = useState(false);
  // "Write as Slurp Support": the picker lists Creators, and the chat opens in Support's voice.
  const [supportPick, setSupportPick] = useState(false);
  const [startAsSupport, setStartAsSupport] = useState(composeAsSupport);
  const closeComposePicker = () => {
    setComposePickerOpen(false);
    setSupportPick(false);
  };
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
      setStartAsSupport(Boolean(composeWithCreatorAccountId) && composeAsSupport);
    }
  }, [composeWithCreatorAccountId, composeAsSupport, initialThreadId]);

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
      ? // Only message requests to your Creators, not every conversation they have (R1-010).
        inbound.filter((thread) => thread.state === "request")
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
    setStartAsSupport(false);
    setComposeWith(null);
    setOpenThreadId(threadId);
  };

  const openNewChat = async (target: SlurpComposeTarget) => {
    const asSupport = supportPick && target.kind === "creator";
    if (target.threadId) {
      openFromList(target.threadId);
      setStartAsSupport(asSupport);
      closeComposePicker();
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
      } catch (cause) {
        console.error("[slurp2] Failed to open conversation", cause);
        toast.error(
          localizeUi("ui.slurp.messages.newChatFailed", { defaultValue: "Could not open that conversation." }),
        );
      }
      return;
    }
    if (target.kind === "creator") {
      openedDirectly.current = true;
      setOpenThreadId(null);
      setComposeWith(target.id);
      setStartAsSupport(asSupport);
      closeComposePicker();
    }
  };

  const noneForFilter =
    filter !== "all" &&
    threadsQuery.isSuccess &&
    visibleInbound.length === 0 &&
    visibleRequests.length === 0 &&
    visibleActive.length === 0;
  const requestCount = inbound.filter((thread) => thread.state === "request").length + requests.length;
  const inbox = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {onExit && (
        <header className={cn("flex min-h-14 shrink-0 items-center gap-2 px-2", SLP_TOP_BAR_CLASS)}>
          <button
            type="button"
            onClick={onExit}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-ink)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            aria-label={localizeUi("ui.noodle.noodlerframe.back", { defaultValue: "Back" })}
          >
            <ArrowLeft size={20} className="rtl:-scale-x-100" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold">
            {exitTitle ?? localizeUi("ui.slurp.inbox.messagesTitle", { defaultValue: "Messages" })}
          </h1>
          <SlpButton
            onClick={() => setComposePickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={composePickerOpen}
            className="min-h-10 px-3.5 text-[13px]"
          >
            <Plus size={16} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.newChat", { defaultValue: "New chat" })}
          </SlpButton>
        </header>
      )}
      <div
        className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4", SLP_PAGE_SCROLL_CLASS)}
      >
        {!onExit && (
          <SlpButton
            onClick={() => setComposePickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={composePickerOpen}
            className="min-h-10 self-end px-3.5 text-[13px]"
          >
            <Plus size={16} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.newChat", { defaultValue: "New chat" })}
          </SlpButton>
        )}
        <div className="relative min-w-0">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
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
            className={SLP_SEARCH_FIELD_CLASS}
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={localizeUi("ui.slurp.messages.filters", { defaultValue: "Message filters" })}
        >
          {(["all", "unread", "requests"] as const).map((option) => {
            const count = option === "unread" ? unread : option === "requests" ? requestCount : 0;
            return (
              <SlpChip key={option} selected={filter === option} onClick={() => setFilter(option)}>
                {localizeUi(`ui.slurp.messages.filter.${option}`, {
                  defaultValue: option[0]?.toUpperCase() + option.slice(1),
                })}
                {count > 0 && <span className="tabular-nums text-[var(--slurp-ink)]">{count}</span>}
              </SlpChip>
            );
          })}
        </div>

        {visibleInbound.length > 0 && (
          <section aria-labelledby="slurp-message-inbound" className="flex flex-col gap-2">
            <h2 id="slurp-message-inbound" className={cn(SLP_EYEBROW_CLASS, "px-1")}>
              {localizeUi("ui.slurp.messages.inbound", { defaultValue: "Written to your Creators" })}
            </h2>
            <div className={SLP_GROUP_CLASS}>
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
                  supportTag={false}
                  onOpen={() => openFromList(thread.id)}
                  pending={thread.state === "request"}
                  selected={thread.id === openThreadId}
                />
              ))}
            </div>
          </section>
        )}

        {onOpenDesk && filter === "all" && !needle && (threadsQuery.data?.desk?.threads ?? 0) > 0 && (
          // Support's threads moved to the Stir desk: one row here says where they went.
          <div className={SLP_GROUP_CLASS}>
            <button
              type="button"
              onClick={onOpenDesk}
              className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)]">
                <Headset size={20} aria-hidden="true" className="!text-current" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold leading-5">
                  {localizeUi("ui.slurp.desk.title", { defaultValue: "Support desk" })}
                </span>
                <span className="block truncate text-[13px] leading-[19px] text-[var(--slurp-muted)]">
                  {localizeUi("ui.slurp.desk.inboxRow", {
                    defaultValue: "Your chats as Slurp Support live in Stir",
                  })}
                </span>
              </span>
              {(threadsQuery.data?.desk?.unread ?? 0) > 0 && (
                <span className={slpTagClass(true)}>{threadsQuery.data!.desk!.unread}</span>
              )}
            </button>
          </div>
        )}

        {visibleRequests.length > 0 && (
          <section aria-labelledby="slurp-message-requests" className="flex flex-col gap-2">
            <h2 id="slurp-message-requests" className={cn(SLP_EYEBROW_CLASS, "px-1")}>
              {localizeUi("ui.slurp.messages.requests", { defaultValue: "Message requests" })}
            </h2>
            <div className={SLP_GROUP_CLASS}>
              {visibleRequests.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  onOpen={() => openFromList(thread.id)}
                  pending
                  selected={thread.id === openThreadId}
                />
              ))}
            </div>
          </section>
        )}

        {threadsQuery.isPending ? (
          <SlpSkeleton label={localizeUi("ui.slurp.inbox.loadingMessages", { defaultValue: "Loading messages…" })} />
        ) : threadsQuery.isError && !threadsQuery.data ? (
          <SlpErrorState
            title={localizeUi("ui.slurp.messages.loadError", { defaultValue: "Could not load your messages" })}
            onRetry={() => void threadsQuery.refetch()}
          />
        ) : noneForFilter ? (
          // B20: an empty filter says so and offers the way back, instead of an empty outlined box.
          <SlpEmptyState
            icon={MessageCircle}
            title={
              filter === "unread"
                ? localizeUi("ui.slurp.messages.noUnread", { defaultValue: "No unread conversations" })
                : localizeUi("ui.slurp.messages.noRequests", { defaultValue: "No message requests" })
            }
            action={localizeUi("ui.slurp.messages.showAll", { defaultValue: "Show all" })}
            onAction={() => setFilter("all")}
          />
        ) : visibleActive.length === 0 && filter === "all" ? (
          visibleInbound.length + visibleRequests.length === 0 && (
            <SlpEmptyState
              icon={MessageCircle}
              title={localizeUi("ui.slurp.messages.emptyTitle", { defaultValue: "No conversations yet" })}
              detail={localizeUi("ui.slurp.messages.emptyDetail", {
                defaultValue: "Open a Creator profile and send a message to start one.",
              })}
              action={localizeUi("ui.slurp.messages.newChat", { defaultValue: "New chat" })}
              onAction={() => setComposePickerOpen(true)}
            />
          )
        ) : (
          visibleActive.length > 0 && (
            <section aria-labelledby="slurp-message-inbox" className="flex flex-col gap-2">
              <h2 id="slurp-message-inbox" className={cn(SLP_EYEBROW_CLASS, "px-1")}>
                {localizeUi("ui.slurp.messages.conversations", { defaultValue: "Conversations" })}
              </h2>
              <div className={SLP_GROUP_CLASS}>
                {visibleActive.map((thread) => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openFromList(thread.id)}
                    selected={thread.id === openThreadId}
                  />
                ))}
              </div>
            </section>
          )
        )}
      </div>
      <SlpSheet
        open={composePickerOpen}
        onClose={closeComposePicker}
        title={localizeUi("ui.slurp.messages.newChat", { defaultValue: "New chat" })}
      >
        <button
          type="button"
          aria-pressed={supportPick}
          onClick={() => setSupportPick((value) => !value)}
          className={cn(
            "mb-2 flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]",
            supportPick && "bg-[var(--slurp-tint)]",
          )}
          // Inline: a ring colour only Slurp uses is not in the Engine's class safelist.
          style={
            supportPick
              ? { boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--noodle-accent) 45%, transparent)" }
              : undefined
          }
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)]">
            <Headset size={20} className="!text-current" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-5">
              {localizeUi("ui.slurp.messages.supportPick", { defaultValue: "Write as Slurp Support" })}
            </span>
            <span className="block text-xs leading-4 text-[var(--slurp-muted)]">
              {localizeUi("ui.slurp.messages.supportPickDetail", {
                defaultValue: "Talk to a Creator as Slurp's staff team.",
              })}
            </span>
          </span>
        </button>
        <p className="px-3 pb-2 text-xs text-[var(--slurp-muted)]">
          {supportPick
            ? localizeUi("ui.slurp.messages.supportPickTarget", {
                defaultValue: "Pick a Creator. You write as Slurp Support.",
              })
            : localizeUi("ui.slurp.messages.newChatDetail", {
                defaultValue: "Choose a Creator or invited character.",
              })}
        </p>
        {composeTargetsQuery.isLoading ? (
          <SlpSkeleton
            label={localizeUi("ui.slurp.messages.newChatLoading", { defaultValue: "Loading chat targets…" })}
          />
        ) : composeTargetsQuery.isError ? (
          <p role="alert" className="px-3 py-3 text-xs text-[var(--slurp-danger)]">
            {localizeUi("ui.slurp.messages.newChatError", { defaultValue: "Chat targets are unavailable." })}
          </p>
        ) : (composeTargetsQuery.data?.targets ?? []).length === 0 ? (
          <p className="px-3 py-3 text-xs text-[var(--slurp-muted)]">
            {localizeUi("ui.slurp.messages.newChatEmpty", { defaultValue: "No chat targets yet." })}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {(composeTargetsQuery.data?.targets ?? [])
              // Support writes to Creators; your own Creator page has no chat with you.
              .filter(
                (target: SlurpComposeTarget) =>
                  !supportPick || (target.kind === "creator" && !ownedCreatorAccountIds.includes(target.id)),
              )
              .map((target: SlurpComposeTarget) => (
                <button
                  key={`${target.kind}:${target.id}`}
                  type="button"
                  onClick={() => openNewChat(target)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
                >
                  <Avatar account={{ displayName: target.displayName, avatarUrl: target.avatarUrl }} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold leading-5">{target.displayName}</span>
                    <span className="block truncate text-xs text-[var(--slurp-muted)]">
                      {target.kind === "character"
                        ? localizeUi("ui.slurp.messages.newChatCharacter", { defaultValue: "Invited character" })
                        : `@${target.handle}`}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        )}
      </SlpSheet>
    </div>
  );

  if (!conversationOpen && !workspace)
    return <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col">{inbox}</div>;

  return (
    <div className="grid h-full min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)]">
      <aside
        className={cn(
          "min-h-0 min-w-0 flex-col border-e border-[var(--noodle-divider)]",
          conversationOpen ? "hidden md:flex" : "flex",
        )}
      >
        {inbox}
      </aside>
      {conversationOpen ? (
        <SlurpThreadView
          // One instance per conversation. Reusing it across threads carried drafts, pending echoes,
          // open tools, older pages and the send request id from one conversation into the next.
          key={`${openThreadId ?? ""}:${composeWith ?? ""}:${startAsSupport ? "support" : ""}`}
          threadId={openThreadId}
          creatorAccountId={composeWith}
          personaId={personaId}
          ownedCreatorAccountIds={ownedCreatorAccountIds}
          startAsSupport={startAsSupport}
          onSwitchVoice={(creatorAccountId, asSupport) => {
            // Support's thread and the persona's are two threads: open the other one.
            setOpenThreadId(null);
            setComposeWith(creatorAccountId);
            setStartAsSupport(asSupport);
          }}
          unreadAtOpen={openThread ? { viewer: openThread.viewerUnread, creator: openThread.creatorUnread } : null}
          onBack={closeConversation}
          onOpenProfile={onOpenProfile}
          desktopSplit
        />
      ) : (
        <div className="hidden min-h-0 items-center justify-center bg-[color-mix(in_srgb,var(--slurp-surface)_45%,transparent)] px-6 text-center md:flex">
          <div className="max-w-xs">
            <MessageCircle size={28} className="mx-auto text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
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

/** One conversation in a list (Messages workspace and the Inbox hub): two lines, 44 px avatar, hairline between rows. */
export function ThreadRow({
  thread,
  onOpen,
  pending = false,
  selected = false,
  toCreator = false,
  supportTag = thread.viewerAccountId === SLURP_SUPPORT_ACCOUNT_ID && !toCreator,
}: {
  thread: SlurpThread;
  onOpen: () => void;
  pending?: boolean;
  selected?: boolean;
  /** A fan wrote to one of your Creators: you answer as the Creator. */
  toCreator?: boolean;
  /** Slurp Support's thread with this Creator: the player writes in it as Support, from any persona. */
  supportTag?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const unread = thread.viewerUnread > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-[4.25rem] w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-[var(--accent)] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
        selected && "bg-[image:var(--slurp-nav-active)] hover:bg-[image:var(--slurp-nav-active)]",
      )}
    >
      {/* A fan writing to your Creator shows the fan; only a Creator's own row can wear their Story ring. */}
      <SlpStoryRingAvatar creatorId={toCreator ? null : thread.creatorAccountId} name={thread.creatorDisplayName}>
        <Avatar account={{ displayName: thread.creatorDisplayName, avatarUrl: thread.creatorAvatarUrl }} size="md" />
      </SlpStoryRingAvatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate text-[15px] leading-5", unread ? "font-extrabold" : "font-semibold")}>
            {thread.creatorDisplayName}
          </span>
          {toCreator && (
            <span className={slpTagClass(true)}>
              {localizeUi("ui.slurp.inbox.toCreatorTag", { defaultValue: "To your Creator" })}
            </span>
          )}
          {supportTag && (
            <span className={slpTagClass(true)}>
              {localizeUi("ui.slurp.messages.supportTag", { defaultValue: "As Slurp Support" })}
            </span>
          )}
          {pending && (
            <span className={slpTagClass()}>
              {localizeUi("ui.slurp.messages.pending", { defaultValue: "Pending" })}
            </span>
          )}
          {thread.subscribed && !toCreator && !pending && !supportTag && (
            <span className={slpTagClass()}>
              {localizeUi("ui.slurp.messages.subscribed", { defaultValue: "Subscribed" })}
            </span>
          )}
        </span>
        <span
          className={cn(
            "truncate text-[13px] leading-[19px]",
            unread ? "font-medium text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
          )}
        >
          {thread.lastMessagePreview || localizeUi("ui.slurp.messages.noMessages", { defaultValue: "No messages yet" })}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end justify-center gap-1 self-stretch">
        <SlpTimestamp
          value={thread.lastMessageAt}
          className={cn(
            "text-xs tabular-nums",
            unread ? "font-semibold text-[var(--slurp-ink)]" : "text-[var(--slurp-muted)]",
          )}
        />
        {unread && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[11px] font-bold tabular-nums text-[var(--slurp-on-accent)]"
            aria-label={localizeUi("ui.slurp.messages.unreadCount", {
              defaultValue: "{{count}} unread",
              count: thread.viewerUnread,
            })}
          >
            {thread.viewerUnread}
          </span>
        )}
      </span>
    </button>
  );
}
