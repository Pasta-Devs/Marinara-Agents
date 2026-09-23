import { ArrowLeft, MessageCircle, Plus, Search } from "lucide-react";
import type { SlurpComposeTarget } from "../../features/messages/slp-messages-contract";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SlurpEmptyArtwork } from "../../base/chrome/SlpEmptyArtwork";
import { formatTime } from "../../base/ui/slp-date-time";
import type { SlurpThread } from "../../features/messages/slp-messages-contract";
import { useSlurpThreads } from "../../features/messages/slp-messages-hooks";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
/**
 * What each reply outcome means, in the fan's words.
 *
 * `replyToSlurpMessage` reports six outcomes and the client displayed none of them, so an offline
 * creator, a thread already generating, and a missing connection were all the same blank screen.
 */
import { BroadcastPanel } from "./SlpMessageTools";
import { SlurpThreadView } from "./SlpThreadView";

export { BroadcastPanel };

export const SLURP_REPLY_STATUS_FALLBACKS: Record<string, string> = {
  queued: "Your message is delivered. They reply when they next check their messages.",
  budget:
    "Your message is delivered. Slurp's AI budget is used up for now, so {{name}} answers once it resets. You can raise it under Audience → AI budget.",
  owed: "Your message is delivered. They have not answered yet.",
  cooling: "They stepped away from this conversation. Give them some time.",
  busy: "{{name}} is already writing back. Give it a moment.",
  ineligible: "{{name}} is not answering this conversation right now.",
  connection_not_found: "No text connection is configured, so nobody can answer yet.",
  failed: "The reply could not be written. Your message was still delivered.",
};

/** Reply outcomes that only mean "not now". They render as the away animation, without words. */
export const SLURP_AWAY_STATUSES = new Set(["queued", "owed", "cooling", "ineligible"]);
/** The away card's headline. The status line below it carries the detail. */
export const SLURP_AWAY_TITLE_FALLBACKS: Record<string, string> = {
  queued: "{{name}} is away",
  owed: "Waiting for {{name}}",
  cooling: "{{name}} needs a break",
  ineligible: "{{name}} is not answering",
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
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.slurp.messages.newChatFailed", { defaultValue: "Could not open that conversation." }),
        );
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
          // One instance per conversation. Reusing it across threads carried drafts, pending echoes,
          // open tools, older pages and the send request id from one conversation into the next.
          key={`${openThreadId ?? ""}:${composeWith ?? ""}`}
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
