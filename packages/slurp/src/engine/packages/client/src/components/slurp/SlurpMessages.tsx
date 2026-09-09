import {
  ArrowLeft,
  Check,
  ChevronDown,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  Megaphone,
  Palette,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { getApiErrorMessage } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { Avatar } from "./SlurpShell";
import { slurpCreatorStatus } from "./slurp-creator-status";
import { SlurpEmptyArtwork } from "./SlurpEmptyArtwork";
import { formatTime } from "./SlurpDateTime";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "./SlurpCoin";
import {
  useAcceptSlurpCommission,
  useDeclineSlurpCommission,
  useBroadcastSlurpMessage,
  useCreateSlurpCommission,
  useDeliverSlurpCommission,
  useQuoteSlurpCommission,
  useResolveSlurpMessageRequest,
  useDraftSlurpCreatorReply,
  useSendSlurpCreatorPpv,
  useSendSlurpCreatorImage,
  useSendSlurpCreatorReply,
  useSendSlurpViewerImage,
  useSendSlurpMessage,
  useSlurpCompose,
  useSlurpThread,
  useSlurpMessagePrompt,
  useSlurpThreads,
  useTipInSlurpThread,
  useUnlockSlurpMessage,
  useReactToSlurpMessage,
  useSlurpWallet,
  type SlurpCommission,
  type SlurpThreadRelationship,
  type SlurpMessage,
  type SlurpRapport,
  type SlurpThread,
  type SlurpPromptDebug,
} from "../../hooks/use-slurp";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
/**
 * What each reply outcome means, in the fan's words.
 *
 * `replyToSlurpMessage` reports six outcomes and the client displayed none of them, so an offline
 * creator, a thread already generating, and a missing connection were all the same blank screen.
 */
const SLURP_REPLY_STATUS_FALLBACKS: Record<string, string> = {
  queued: "{{name}} has seen this. They are not around right now and will answer later.",
  cooling: "{{name}} has stepped away from this conversation. Give them some time.",
  busy: "{{name}} is already writing back. Give it a moment.",
  ineligible: "{{name}} is not answering this conversation right now.",
  connection_not_found: "No text connection is configured, so nobody can answer yet.",
  failed: "The reply could not be written. Your message was still delivered.",
};

const TIP_PRESETS = [5, 15, 50] as const;

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
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId);
  // Opening a chat from a profile lands in it directly, and backing out returns to the inbox
  // rather than to the profile, so Messages behaves the same however you arrived.
  const [composeWith, setComposeWith] = useState<string | null>(composeWithCreatorAccountId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "requests">("all");
  const threadsQuery = useSlurpThreads(personaId);
  const threads = threadsQuery.data?.threads ?? [];
  const openThread = [...threads, ...(threadsQuery.data?.inbound ?? [])].find((thread) => thread.id === openThreadId);

  useEffect(() => {
    onThreadContextChange?.(openThread ?? null);
    return () => onThreadContextChange?.(null);
  }, [onThreadContextChange, openThread]);

  useEffect(() => {
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
  // Broadcasting is per creator, so it only makes sense once this persona owns one.
  const broadcastCreatorId = ownedCreatorAccountIds[0] ?? null;

  const conversationOpen = Boolean(openThreadId || composeWith);
  const closeConversation = () => {
    setOpenThreadId(null);
    setComposeWith(null);
  };

  const inbox = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4">
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
        {unread > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--noodle-accent)]/12 px-2.5 py-1 text-[0.7rem] font-bold tabular-nums text-[var(--noodle-accent)]">
            {localizeUi("ui.slurp.messages.unreadTotal", { defaultValue: "{{count}} unread", count: unread })}
          </span>
        )}
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
              "min-h-9 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors",
              filter === option && "bg-[var(--noodle-accent)] text-zinc-950 ring-[var(--noodle-accent)]",
            )}
          >
            {localizeUi(`ui.slurp.messages.filter.${option}`, {
              defaultValue: option[0]?.toUpperCase() + option.slice(1),
            })}
          </button>
        ))}
      </div>

      {broadcastCreatorId && personaId && (
        <BroadcastPanel creatorAccountId={broadcastCreatorId} personaId={personaId} />
      )}

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
              onOpen={() => setOpenThreadId(thread.id)}
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
              onOpen={() => setOpenThreadId(thread.id)}
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
              onOpen={() => setOpenThreadId(thread.id)}
              selected={thread.id === openThreadId}
            />
          ))
        )}
      </section>
    </div>
  );

  if (!conversationOpen) return <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col">{inbox}</div>;

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-6xl flex-1 md:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
      <aside className="hidden min-h-0 border-r border-[var(--noodle-divider)] md:flex">{inbox}</aside>
      <SlurpThreadView
        threadId={openThreadId}
        creatorAccountId={composeWith}
        personaId={personaId}
        ownedCreatorAccountIds={ownedCreatorAccountIds}
        onBack={closeConversation}
        onOpenProfile={onOpenProfile}
        desktopSplit
      />
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
        "group flex min-h-[5rem] w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-start transition-[background-color,border-color,transform] hover:bg-[var(--noodle-accent)]/[0.07] active:scale-[0.98] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
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
          className="ml-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[0.65rem] font-black tabular-nums text-zinc-950"
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
  onBack,
  onOpenProfile,
  desktopSplit = false,
}: {
  threadId: string | null;
  creatorAccountId: string | null;
  personaId: string | null;
  ownedCreatorAccountIds: string[];
  onBack: () => void;
  onOpenProfile: (accountId: string) => void;
  desktopSplit?: boolean;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const byThread = useSlurpThread(threadId, personaId);
  const byCreator = useSlurpCompose(threadId ? null : creatorAccountId, personaId);
  const threadQuery = threadId ? byThread : byCreator;
  const send = useSendSlurpMessage();
  const tip = useTipInSlurpThread();
  const resolveRequest = useResolveSlurpMessageRequest();
  const createCommission = useCreateSlurpCommission();
  const creatorReply = useSendSlurpCreatorReply();
  const draftReply = useDraftSlurpCreatorReply();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeTipAmount, setActiveTipAmount] = useState<number | null>(null);
  // The fan's own words, held on screen until the server's copy of them arrives.
  const [pending, setPending] = useState<{ content: string; id: string | null } | null>(null);
  // Why no answer came. The send route has always reported this and nothing ever read it, so a
  // sleeping creator, a busy thread and a missing connection all looked like the same silence.
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const thread = threadQuery.data?.thread ?? null;
  const messages = threadQuery.data?.messages ?? [];
  const creator = threadQuery.data?.creator;
  const counterpart = threadQuery.data?.counterpart ?? creator;
  const targetCreatorAccountId = thread?.creatorAccountId ?? creator?.id ?? creatorAccountId;
  const ownsCreator = Boolean(targetCreatorAccountId && ownedCreatorAccountIds.includes(targetCreatorAccountId));
  const draftStorageKey = `slurp-message-draft:${personaId ?? "none"}:${targetCreatorAccountId ?? "none"}`;
  const messaging = threadQuery.data?.messaging;
  const commissions = threadQuery.data?.commissions ?? [];
  const relationship = "relationship" in (threadQuery.data ?? {}) ? threadQuery.data?.relationship : undefined;
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
  const lastOwnMessageId = messages.reduce<string | null>(
    (latest, message) => ((ownsCreator ? message.role === "creator" : message.role === "viewer") ? message.id : latest),
    null,
  );
  const timeline = [
    ...messages
      .filter((message) => typeof message.metadata.commissionId !== "string")
      .map((message) => ({ kind: "message" as const, at: message.createdAt, message })),
    ...commissionTimeline,
  ].sort((left, right) => left.at.localeCompare(right.at));
  const commissionTimelineKey = commissionTimeline
    .map(({ commission, at }) => `${commission.id}:${commission.state}:${commission.updatedAt}:${at}`)
    .join("|");
  const subscribed = thread?.subscribed ?? threadQuery.data?.subscribed ?? false;
  const headerAccount = ownsCreator ? counterpart : creator;
  // Only meaningful for the Creator side of the conversation. Looking at your own inbox as the
  // Creator, the counterpart is a fan, and a fan has no posting schedule to read a status from.
  const creatorStatus = ownsCreator
    ? null
    : slurpCreatorStatus({
        // A live conversation is presence. A stale post is not. The schedule only overrides this
        // when it explicitly says the Creator is away.
        lastActiveAt: threadQuery.data?.creatorLastMessageAt ?? threadQuery.data?.creatorLastActiveAt ?? null,
        autoPostingEnabled: threadQuery.data?.creatorAutoPosting ?? false,
        scheduledOnline: threadQuery.data?.creatorAvailability?.online,
      });
  const creatorActivity = threadQuery.data?.creatorAvailability?.activity;
  const headerProfileId = ownsCreator ? thread?.viewerAccountId : targetCreatorAccountId;
  const busy = send.isPending || tip.isPending || creatorReply.isPending || draftReply.isPending;
  const promptDebug = useSlurpMessagePrompt(threadId, personaId, debugOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(draftStorageKey);
    if (saved) setDraft(saved);
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draft.trim()) window.localStorage.setItem(draftStorageKey, draft);
    else window.localStorage.removeItem(draftStorageKey);
  }, [draft, draftStorageKey]);

  // Drop the echo only once the refetch carries the real row, so the message never blinks out
  // between the response landing and the thread reloading.
  useEffect(() => {
    if (pending?.id && messages.some((message) => message.id === pending.id)) setPending(null);
  }, [messages, pending]);

  // A different conversation must not inherit the last one's unsent echo.
  useEffect(() => {
    setPending(null);
    setTyping(false);
    setReplyStatus(null);
    setInfoOpen(false);
    setDebugOpen(false);
    setPreparingImage(false);
  }, [threadId, creatorAccountId]);

  // Follow the conversation down as it grows, the way every chat surface does.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [commissionTimelineKey, messages.length, typing, pending]);

  /**
   * Hold the reply behind a typing indicator for as long as the server said the creator would
   * take. The reply is already in hand, so this is presentation only — nothing is being waited on.
   */
  /**
   * Keep the typing indicator up for the rest of the pacing the server named.
   *
   * The indicator now starts when the fan hits send, because `/messages/send` generates the reply
   * before it answers and that wait is the real one. `typingMs` is a floor on how long the
   * creator appears to type, so only the part of it the request did not already cover is left.
   */
  const holdTyping = (ms: number, startedAt: number) => {
    const remaining = ms - (Date.now() - startedAt);
    if (remaining <= 0) {
      setTyping(false);
      return;
    }
    window.setTimeout(() => setTyping(false), remaining);
  };

  const submit = async () => {
    const content = draft.trim();
    if (!content || !personaId || !targetCreatorAccountId || busy) return;
    setError(null);
    setDraft("");
    // Show the message and the typing indicator at once. The send route waits for the model
    // before it answers, so the chat used to sit empty for the whole generation.
    setPending({ content, id: null });
    setReplyStatus(null);
    const startedAt = Date.now();
    if (!ownsCreator) setTyping(true);
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
        setPending({ content, id: written.message.id });
        return;
      }
      const result = await send.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        content,
      });
      setPending({ content, id: result.message.id });
      setReplyStatus(result.replyStatus ?? null);
      holdTyping(result.reply ? (result.typingMs ?? 0) : 0, startedAt);
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

  const sendTip = async (amount: number) => {
    if (!personaId || !targetCreatorAccountId || busy) return;
    setError(null);
    setActiveTipAmount(amount);
    try {
      const result = await tip.mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, amount });
      if (result.reply) holdTyping(result.typingMs ?? 0);
    } catch (cause) {
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
    <div className="flex min-h-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--slurp-surface)_45%,transparent)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] bg-[var(--slurp-glass)] px-2 py-2.5 backdrop-blur-xl">
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
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1 text-left transition-colors hover:bg-[var(--noodle-accent)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
        >
          {headerAccount && <Avatar account={headerAccount} size="sm" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{headerAccount?.displayName ?? ""}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[0.7rem] text-[var(--muted-foreground)]">
                @{headerAccount?.handle ?? ""}
              </span>
              {/* The same online/away/offline rule the profile header uses. A player deciding
                  whether to wait for an answer was the one who most needed it and never had it. */}
              {creatorStatus && (
                <span className="flex shrink-0 items-center gap-1 text-[0.7rem] text-[var(--muted-foreground)]">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      creatorStatus === "online"
                        ? "bg-emerald-500"
                        : creatorStatus === "away"
                          ? "bg-amber-500"
                          : "bg-zinc-500"
                    }`}
                  />
                  {creatorActivity ||
                    localizeUi(`ui.slurp.profile.status.${creatorStatus}`, { defaultValue: creatorStatus })}
                </span>
              )}
              {/* Rapport decides how fast and how warmly a Creator answers. The player felt it and
                  could never see it, so the one number the whole thread turns on was invisible. */}
              {thread && <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />}
            </span>
          </span>
        </button>
        {relationship && (
          <button
            type="button"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((open) => !open)}
            className="ml-auto flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            {localizeUi("ui.slurp.messages.relationshipToggle", { defaultValue: "Details" })}
            <ChevronDown
              size={14}
              className={cn("transition-transform", infoOpen && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        )}
        {threadId && (
          <button
            type="button"
            aria-expanded={debugOpen}
            onClick={() => setDebugOpen((open) => !open)}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            aria-label={localizeUi("ui.slurp.messages.promptDebug", { defaultValue: "Show prompt details" })}
            title={localizeUi("ui.slurp.messages.promptDebug", { defaultValue: "Show prompt details" })}
          >
            <Search size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {infoOpen && relationship && <SlurpRelationshipPanel relationship={relationship} locale={i18n.language} />}
      {debugOpen && <SlurpPromptDebugPanel query={promptDebug} />}

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
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={resolveRequest.isPending}
                onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "accept" })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
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
          {timeline.map((entry, index) => {
            const date = new Date(entry.at).toLocaleDateString(i18n.language, { dateStyle: "medium" });
            const previousDate =
              index > 0
                ? new Date(timeline[index - 1]!.at).toLocaleDateString(i18n.language, { dateStyle: "medium" })
                : null;
            return (
              <div key={entry.kind === "message" ? entry.message.id : entry.commission.id} className="contents">
                {date !== previousDate && (
                  <div className="self-center py-2 text-[0.65rem] font-bold text-[var(--muted-foreground)]">{date}</div>
                )}
                {entry.kind === "message" ? (
                  <MessageBubble
                    message={entry.message}
                    locale={i18n.language}
                    personaId={personaId}
                    ownsCreator={ownsCreator}
                    showReceipt={entry.message.id === lastOwnMessageId}
                  />
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
          {pending && !messages.some((message) => message.id === pending.id) && (
            <div className="flex max-w-[88%] flex-col items-end gap-1 self-end opacity-60 sm:max-w-[78%]">
              <div className="whitespace-pre-wrap break-words rounded-[1.15rem] rounded-br-[0.35rem] bg-[var(--noodle-accent)] px-3.5 py-2.5 text-sm leading-relaxed text-zinc-950 shadow-[var(--slurp-shadow-raised)]">
                {pending.content}
              </div>
            </div>
          )}
          {!typing && replyStatus && replyStatus !== "replied" && (
            <p aria-live="polite" className="self-start px-1 text-xs italic text-[var(--muted-foreground)]">
              {localizeUi(`ui.slurp.messages.replyStatus.${replyStatus}`, {
                defaultValue: SLURP_REPLY_STATUS_FALLBACKS[replyStatus] ?? "No answer yet.",
                name: creator?.displayName ?? "",
              })}
            </p>
          )}
          {typing && (
            <p
              aria-live="polite"
              className="self-start rounded-2xl rounded-bl-md bg-[var(--slurp-surface)] px-3 py-2 text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              {localizeUi("ui.slurp.messages.typing", {
                defaultValue: "{{name}} is typing…",
                name: creator?.displayName ?? "",
              })}
            </p>
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

      <div className="shrink-0 border-t border-[var(--noodle-divider)] p-2">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {toolsOpen && (
            <div className="flex flex-col gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating)]">
              <p className="px-1 text-xs font-black text-[var(--foreground)]">
                {localizeUi("ui.slurp.messages.chatExtras", { defaultValue: "Chat extras" })}
              </p>
              {ownsCreator && personaId && thread ? (
                <CreatorMessageTools
                  creatorAccountId={thread.creatorAccountId}
                  viewerAccountId={thread.viewerAccountId}
                  personaId={personaId}
                  defaultPpvPrice={messaging?.ppvPrice ?? 0}
                  threadId={thread.id}
                  onPreparingImage={setPreparingImage}
                />
              ) : (
                <>
                  <CommissionRequest
                    disabled={busy || !personaId || !targetCreatorAccountId}
                    pending={createCommission.isPending}
                    onSubmit={(brief) => {
                      if (!personaId || !targetCreatorAccountId) return;
                      setError(null);
                      createCommission
                        .mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, brief })
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
                  {thread && personaId && targetCreatorAccountId && (
                    <FanImageTool
                      threadId={thread.id}
                      creatorAccountId={targetCreatorAccountId}
                      personaId={personaId}
                    />
                  )}
                </>
              )}
              {ownsCreator && thread && personaId && (
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
                            : localizeUi("ui.slurp.messages.draftFailed", { defaultValue: "Could not draft a reply." }),
                        ),
                      );
                  }}
                  className="min-h-11 self-start rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {draftReply.isPending
                    ? localizeUi("ui.slurp.messages.drafting", { defaultValue: "Writing…" })
                    : localizeUi("ui.slurp.messages.draftReply", { defaultValue: "Let them answer" })}
                </button>
              )}
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
              </div>
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <button
              type="button"
              onClick={() => setToolsOpen((value) => !value)}
              aria-expanded={toolsOpen}
              aria-label={localizeUi("ui.slurp.messages.toggleTools", { defaultValue: "Message tools" })}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--slurp-surface)] text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
                toolsOpen && "bg-[var(--noodle-accent)]/15 ring-[var(--noodle-accent)]/45",
              )}
            >
              <Plus
                size={18}
                className={cn("transition-transform motion-reduce:transition-none", toolsOpen && "rotate-45")}
                aria-hidden="true"
              />
            </button>
            <label className="sr-only" htmlFor="slurp-message-draft">
              {localizeUi("ui.slurp.messages.composerLabel", { defaultValue: "Write a message" })}
            </label>
            <textarea
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
              className="max-h-40 min-h-11 w-full flex-1 resize-y rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !personaId || !targetCreatorAccountId}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--noodle-accent)] text-zinc-950 transition-[opacity,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label={localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
            >
              <Send size={16} className="!text-zinc-950" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  locale,
  personaId,
  ownsCreator,
  showReceipt = false,
}: {
  message: SlurpMessage;
  locale: string;
  personaId?: string | null;
  ownsCreator: boolean;
  /** Only the newest message you sent carries a receipt, the way every chat surface does it. */
  showReceipt?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const unlock = useUnlockSlurpMessage();
  const react = useReactToSlurpMessage();
  const messageImage = useSlurpMediaSrc(
    message.imageUrl
      ? `${message.imageUrl}${message.imageUrl.includes("?") ? "&" : "?"}personaId=${encodeURIComponent(personaId ?? "")}`
      : null,
  );
  const mine = ownsCreator ? message.role === "creator" : message.role === "viewer";
  if (message.kind === "tip") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 self-center rounded-full bg-[var(--noodle-accent)]/12 px-3 py-1.5 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/15",
        )}
      >
        {localizeUi("ui.slurp.messages.tipSent", { defaultValue: "Tip sent" })}{" "}
        <SlurpCoinAmount amount={message.price} />
      </p>
    );
  }
  if (message.kind === "post_preview") {
    const preview = message.metadata;
    const previewTitle = typeof preview.title === "string" ? preview.title : message.content;
    const previewContent = typeof preview.content === "string" ? preview.content : "";
    const locked = preview.access === "locked" || preview.previewLocked === true;
    return (
      <div
        className={cn(
          "flex max-w-[88%] flex-col gap-1 sm:max-w-[78%]",
          mine ? "self-end items-end" : "self-start items-start",
        )}
      >
        <div className="overflow-hidden rounded-2xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
          {messageImage && !locked && (
            <img
              src={messageImage}
              alt={localizeUi("ui.slurp.messages.postPreview", { defaultValue: "Post preview" })}
              className="max-h-72 w-full object-cover"
            />
          )}
          <div className="px-3.5 py-3">
            <p className="text-xs font-bold text-[var(--noodle-accent)]">
              {localizeUi("ui.slurp.messages.postPreview", { defaultValue: "Shared post" })}
            </p>
            <p className="mt-1 text-sm font-semibold">{previewTitle}</p>
            {!locked && previewContent && (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{previewContent}</p>
            )}
            {locked && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.lockedPostPreview", { defaultValue: "Paid post preview" })}
              </p>
            )}
          </div>
        </div>
        <time dateTime={message.createdAt} className="px-1 text-xs text-[var(--muted-foreground)]">
          {formatTime(message.createdAt, locale)}
        </time>
      </div>
    );
  }
  if (message.kind === "broadcast") {
    return (
      <div className="self-start max-w-[88%] rounded-2xl rounded-bl-md bg-[var(--slurp-surface)] px-3.5 py-2.5 ring-1 ring-inset ring-[var(--noodle-divider)]">
        <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--noodle-accent)]">
          {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast" })}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        <time dateTime={message.createdAt} className="mt-1 block text-xs text-[var(--muted-foreground)]">
          {formatTime(message.createdAt, locale)}
        </time>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex max-w-[88%] flex-col gap-1 sm:max-w-[78%]",
        mine ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "whitespace-pre-wrap break-words rounded-[1.15rem] px-3.5 py-2.5 text-sm leading-relaxed shadow-[var(--slurp-shadow-raised)]",
          mine
            ? "rounded-br-[0.35rem] bg-[var(--noodle-accent)] text-zinc-950"
            : "rounded-bl-[0.35rem] bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]",
        )}
      >
        {message.kind === "ppv" && !message.unlockedAt ? (
          <button
            type="button"
            disabled={!personaId || unlock.isPending}
            onClick={() => personaId && unlock.mutate({ personaId, messageId: message.id })}
            className="relative inline-flex min-h-11 items-center gap-1.5 overflow-visible rounded-lg px-1 text-left text-[var(--muted-foreground)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60"
          >
            <SlurpCoinBurst active={unlock.isPending} />
            <Lock size={13} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.unlock", {
              defaultValue: "Unlock for",
            })}
            <SlurpCoinAmount amount={message.price} />
          </button>
        ) : (
          message.content
        )}
      </div>
      {/* Paid messages are usually a picture. The column existed; nothing ever rendered it. */}
      {messageImage && (
        <img
          src={messageImage}
          alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Attached image" })}
          className="mt-1 max-h-72 w-auto max-w-full rounded-2xl object-contain ring-1 ring-inset ring-[var(--noodle-divider)]"
        />
      )}
      {unlock.isError && (
        <p role="alert" className="px-1 text-[0.65rem] text-red-600 dark:text-red-400">
          {unlock.error instanceof Error
            ? unlock.error.message
            : localizeUi("ui.slurp.messages.unlockFailed", { defaultValue: "Unlock failed." })}
        </p>
      )}
      <time dateTime={message.createdAt} className="px-1 text-xs text-[var(--muted-foreground)]">
        {formatTime(message.createdAt, locale)}
        {/* Read state was written on every message since messaging shipped and shown on none. */}
        {mine && showReceipt && message.readAt && (
          <span className="ml-1.5 font-semibold">
            {localizeUi("ui.slurp.messages.seenAt", {
              defaultValue: "Seen {{time}}",
              time: formatTime(message.readAt, locale),
            })}
          </span>
        )}
      </time>
      {message.role === "creator" && !ownsCreator && personaId && (
        <button
          type="button"
          aria-label={localizeUi("ui.slurp.messages.heart", { defaultValue: "Heart message" })}
          onClick={() =>
            react.mutate({
              personaId,
              messageId: message.id,
              reaction: message.metadata.reaction === "heart" ? null : "heart",
            })
          }
          className={cn(
            "self-start px-1 text-xs",
            message.metadata.reaction === "heart" ? "text-red-500" : "text-[var(--muted-foreground)]",
          )}
        >
          <Heart size={14} fill={message.metadata.reaction === "heart" ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

/**
 * Send one paid broadcast to every active subscriber.
 *
 * Collapsed until asked for: it is a creator-side tool sitting on top of a fan-side inbox, and an
 * always-open textarea there reads like the place you write to whoever you last spoke to.
 */
function BroadcastPanel({ creatorAccountId, personaId }: { creatorAccountId: string; personaId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const broadcast = useBroadcastSlurpMessage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    const content = draft.trim();
    if (!content || broadcast.isPending) return;
    try {
      const sent = await broadcast.mutateAsync({ creatorAccountId, personaId, content });
      setDraft("");
      setResult(
        localizeUi("ui.slurp.messages.broadcastSent", {
          defaultValue: "Sent to {{count}} subscribers.",
          count: sent.sent,
        }),
      );
    } catch (cause) {
      setResult(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.broadcastFailed", { defaultValue: "Could not send that broadcast." }),
      );
    }
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-[var(--slurp-surface)]/55 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.055]",
        open ? "w-full" : "self-end",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-start text-xs font-semibold text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Megaphone size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.broadcast", { defaultValue: "Broadcast to subscribers" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-broadcast-draft">
            {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast message" })}
          </label>
          <textarea
            id="slurp-broadcast-draft"
            value={draft}
            rows={2}
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.broadcastPlaceholder", {
              defaultValue: "Something for everyone who subscribes…",
            })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center justify-between gap-2">
            <p aria-live="polite" className="min-w-0 truncate text-xs text-[var(--muted-foreground)]">
              {result}
            </p>
            <button
              type="button"
              disabled={!draft.trim() || broadcast.isPending}
              onClick={() => void submit()}
              className="min-h-9 shrink-0 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.messages.broadcastSend", { defaultValue: "Send broadcast" })}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Creator-side composer for one locked message, priced per send. */
function CreatorMessageTools({
  creatorAccountId,
  viewerAccountId,
  personaId,
  defaultPpvPrice,
  threadId,
  onPreparingImage,
}: {
  creatorAccountId: string;
  viewerAccountId: string;
  personaId: string;
  /** The creator's configured PPV price, used as the opening offer rather than a fixed one. */
  defaultPpvPrice: number;
  threadId: string;
  onPreparingImage: (preparing: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const sendPpv = useSendSlurpCreatorPpv();
  const sendImage = useSendSlurpCreatorImage();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [price, setPrice] = useState(defaultPpvPrice > 0 ? defaultPpvPrice : 10);
  const [error, setError] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageIntent, setImageIntent] = useState<"friendly" | "hostile" | "premium">("friendly");

  const submit = async () => {
    const body = content.trim();
    if (!body || price <= 0 || sendPpv.isPending) return;
    setError(null);
    try {
      await sendPpv.mutateAsync({
        creatorAccountId,
        personaId,
        viewerAccountId,
        content: body,
        price,
      });
      setContent("");
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.ppvFailed", { defaultValue: "Could not send that locked message." }),
      );
    }
  };

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-bold transition-colors hover:bg-[var(--noodle-accent)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
      >
        <Lock size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.sendPpv", { defaultValue: "Send locked content" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-ppv-draft">
            {localizeUi("ui.slurp.messages.ppvLabel", { defaultValue: "Locked message" })}
          </label>
          <textarea
            id="slurp-ppv-draft"
            value={content}
            rows={2}
            maxLength={2000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.ppvPlaceholder", { defaultValue: "What they pay to see…" })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="slurp-ppv-price" className="text-xs font-bold text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.ppvPrice", { defaultValue: "Price" })}
            </label>
            <input
              id="slurp-ppv-price"
              type="number"
              min={1}
              max={9999}
              value={price}
              onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
              className="h-9 w-24 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 text-sm tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
            />
            <button
              type="button"
              disabled={!content.trim() || price <= 0 || sendPpv.isPending}
              onClick={() => void submit()}
              className="ml-auto min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.messages.ppvSend", { defaultValue: "Send locked" })}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
      <div className="border-t border-[var(--noodle-divider)] p-3">
        <label className="text-xs font-bold" htmlFor="slurp-creator-image-prompt">
          Generate a picture
        </label>
        <textarea
          id="slurp-creator-image-prompt"
          value={imagePrompt}
          rows={2}
          maxLength={1000}
          onChange={(event) => setImagePrompt(event.target.value)}
          className="mt-2 w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
          placeholder="What do you want to show them?"
        />
        <select
          value={imageIntent}
          onChange={(event) => setImageIntent(event.target.value as typeof imageIntent)}
          className="mt-2 h-9 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 text-sm"
        >
          <option value="friendly">Friendly</option>
          <option value="hostile">Hostile</option>
          <option value="premium">Premium</option>
        </select>
        <button
          type="button"
          disabled={!imagePrompt.trim() || sendImage.isPending}
          onClick={() => {
            onPreparingImage(true);
            void sendImage
              .mutateAsync({
                threadId,
                creatorAccountId,
                personaId,
                prompt: imagePrompt.trim(),
                content: "",
                intent: imageIntent,
              })
              .then(
                () => {
                  setImagePrompt("");
                  onPreparingImage(false);
                },
                (cause) => {
                  onPreparingImage(false);
                  setError(cause instanceof Error ? cause.message : "Could not send that picture.");
                },
              );
          }}
          className="mt-2 min-h-10 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
        >
          {sendImage.isPending ? "Making…" : "Generate and send"}
        </button>
      </div>
    </div>
  );
}

function FanImageTool({
  threadId,
  creatorAccountId,
  personaId,
}: {
  threadId: string;
  creatorAccountId: string;
  personaId: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const send = useSendSlurpViewerImage();
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-bold"
      >
        <Palette size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.sendImage", { defaultValue: "Send a picture" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <input
            value={content}
            maxLength={1000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.imageCaption", {
              defaultValue: "Say something with it (optional)",
            })}
            className="h-10 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
          />
          <button
            type="button"
            disabled={!file || send.isPending}
            onClick={() =>
              file &&
              void send.mutateAsync({ threadId, creatorAccountId, personaId, file, content }).then(() => {
                setFile(null);
                setContent("");
                setOpen(false);
              })
            }
            className="min-h-10 self-end rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
          >
            {send.isPending
              ? localizeUi("ui.slurp.messages.sending", { defaultValue: "Sending…" })
              : localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
          </button>
        </div>
      )}
    </div>
  );
}

/** Fan-side brief. A commission starts as a description and a price the creator names later. */
function CommissionRequest({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (brief: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");

  return (
    <div className="rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-xs font-bold"
      >
        <Palette size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.commissionAsk", { defaultValue: "Request a commission" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="text-xs font-bold" htmlFor="slurp-commission-brief">
            {localizeUi("ui.slurp.messages.commissionLabel", { defaultValue: "Commission brief" })}
          </label>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.commissionRequestDetail", {
              defaultValue: "Describe the finished piece. The Creator will quote a price before you pay.",
            })}
          </p>
          <textarea
            id="slurp-commission-brief"
            value={brief}
            rows={2}
            maxLength={2000}
            onChange={(event) => setBrief(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.commissionPlaceholder", {
              defaultValue: "Describe what you want made…",
            })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{brief.length}/2000</span>
            <button
              type="button"
              disabled={disabled || pending || !brief.trim()}
              onClick={() => {
                onSubmit(brief.trim());
                setBrief("");
                setOpen(false);
              }}
              className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {localizeUi("ui.slurp.messages.commissionSend", { defaultValue: "Send request" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One commission, showing only the action its current state allows.
 *
 * The two sides never see the same button: the creator quotes and delivers, the fan accepts. A
 * state with nothing to do for this side renders as a status line, so the row still explains
 * what is being waited on.
 */
function CommissionRow({
  commission,
  deliveryMessage,
  personaId,
  ownsCreator,
}: {
  commission: SlurpCommission;
  deliveryMessage: SlurpMessage | null;
  personaId: string;
  ownsCreator: boolean;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const quote = useQuoteSlurpCommission();
  const accept = useAcceptSlurpCommission();
  const deliver = useDeliverSlurpCommission();
  const decline = useDeclineSlurpCommission();
  const [price, setPrice] = useState(commission.price > 0 ? commission.price : 25);
  // Only an unpaid commission can be called off; after accept the coins have moved.
  const canEnd = commission.state === "brief" || commission.state === "quoted";
  const [generateImage, setGenerateImage] = useState(false);
  const [delivery, setDelivery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const busy = quote.isPending || accept.isPending || deliver.isPending || decline.isPending;
  const wallet = useSlurpWallet(personaId);
  const steps = ["brief", "quoted", "accepted", "delivered"] as const;
  const currentStep = commission.state === "declined" ? -1 : steps.indexOf(commission.state);
  const deliveryImage = useSlurpMediaSrc(
    deliveryMessage?.imageUrl
      ? `${deliveryMessage.imageUrl}${deliveryMessage.imageUrl.includes("?") ? "&" : "?"}personaId=${encodeURIComponent(personaId)}`
      : null,
  );

  const run = (action: Promise<unknown>, fallback: string, successMessage?: string) => {
    setError(null);
    setSuccess(null);
    void action
      .then(() => {
        if (successMessage) setSuccess(successMessage);
      })
      .catch((cause: unknown) => {
        const raw = cause instanceof Error ? cause.message : cause;
        const message = getApiErrorMessage(raw, fallback);
        setError(/^\{[\s\S]*\}$/u.test(message) || message === "[object Object]" ? fallback : message);
      });
  };

  return (
    <article className="rounded-xl bg-[color-mix(in_srgb,var(--slurp-violet)_5%,var(--slurp-surface))] p-4 text-xs ring-1 ring-inset ring-[var(--slurp-violet)]/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-black">
            <Sparkles size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {localizeUi("ui.slurp.messages.commissionTitle", { defaultValue: "Commission" })}
          </p>
          <p className="mt-1 font-semibold text-[var(--muted-foreground)]">
            {localizeUi(`ui.slurp.messages.commissionState.${commission.state}`, { defaultValue: commission.state })}
          </p>
        </div>
        {commission.price > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 font-bold tabular-nums text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/20">
            <SlurpCoinAmount amount={commission.price} />
          </span>
        )}
      </div>
      <div className="mt-3 rounded-xl bg-[var(--slurp-surface)]/70 p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
        <p className="font-bold">
          {localizeUi("ui.slurp.messages.commissionLabel", { defaultValue: "Commission brief" })}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-[var(--muted-foreground)]">
          {commission.brief}
        </p>
      </div>

      {currentStep >= 0 && (
        <ol
          className="mt-4 grid grid-cols-4 gap-1"
          aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
        >
          {steps.map((step, index) => (
            <li key={step} className="relative flex min-w-0 flex-col items-center gap-1 text-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1/2 top-2.5 h-px w-full",
                    index <= currentStep ? "bg-[var(--noodle-accent)]" : "bg-[var(--noodle-divider)]",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ring-2 ring-[var(--slurp-surface)]",
                  index <= currentStep
                    ? "bg-[var(--noodle-accent)] text-zinc-950"
                    : "bg-[var(--slurp-surface-raised)] text-[var(--muted-foreground)]",
                )}
              >
                {index < currentStep ? <Check size={11} aria-hidden="true" /> : index + 1}
              </span>
              <span className="text-xs font-semibold leading-4 text-[var(--muted-foreground)]">
                {localizeUi(`ui.slurp.messages.commissionStep.${step}`, {
                  defaultValue: step === "accepted" ? "Paid" : step[0]?.toUpperCase() + step.slice(1),
                })}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 leading-5 text-[var(--muted-foreground)]">
        {localizeUi(`ui.slurp.messages.commissionNext.${commission.state}.${ownsCreator ? "creator" : "viewer"}`, {
          defaultValue:
            commission.state === "brief"
              ? ownsCreator
                ? "Review the brief, then send a price or decline."
                : "Waiting for the Creator to send a price."
              : commission.state === "quoted"
                ? ownsCreator
                  ? "Waiting for the fan to accept and pay."
                  : "Accepting pays the quoted amount and starts the work."
                : commission.state === "accepted"
                  ? ownsCreator
                    ? "Payment is complete. Send the finished piece when it is ready."
                    : "Paid. The Creator is working on your request."
                  : commission.state === "delivered"
                    ? "The finished commission is in this chat."
                    : "This commission is closed.",
        })}
      </p>

      {ownsCreator && (commission.state === "brief" || commission.state === "quoted") && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label htmlFor={`slurp-quote-${commission.id}`} className="flex flex-col gap-1 font-bold">
            {localizeUi("ui.slurp.messages.commissionQuoteLabel", {
              defaultValue: commission.state === "quoted" ? "Update quote" : "Quote price",
            })}
            <span className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--slurp-canvas,var(--background))] px-3 ring-1 ring-inset ring-[var(--noodle-divider)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]">
              <SlurpCoin size={15} />
              <input
                id={`slurp-quote-${commission.id}`}
                type="number"
                min={1}
                max={9999}
                value={price}
                onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
                className="w-20 bg-transparent text-sm tabular-nums outline-none"
              />
            </span>
          </label>
          <button
            type="button"
            disabled={busy || price <= 0}
            onClick={() =>
              run(
                quote.mutateAsync({ commissionId: commission.id, personaId, price }),
                localizeUi("ui.slurp.messages.commissionQuoteFailed", { defaultValue: "Could not send that quote." }),
                localizeUi("ui.slurp.messages.commissionQuoteSent", { defaultValue: "Quote sent." }),
              )
            }
            className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {quote.isPending
              ? localizeUi("ui.slurp.messages.commissionQuotePending", { defaultValue: "Sending quote…" })
              : localizeUi("ui.slurp.messages.commissionQuote", {
                  defaultValue: commission.state === "quoted" ? "Send new quote" : "Send quote",
                })}
          </button>
        </div>
      )}

      {/* A brief with no exit sat in the thread forever. Either side may end it until it is paid. */}
      {canEnd && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              decline.mutateAsync({ commissionId: commission.id, personaId }),
              localizeUi("ui.slurp.messages.commissionDeclineFailed", {
                defaultValue: "Could not end that commission.",
              }),
            )
          }
          className="mt-3 min-h-11 rounded-xl px-3 font-bold text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {ownsCreator
            ? localizeUi("ui.slurp.messages.commissionDecline", { defaultValue: "Decline" })
            : localizeUi("ui.slurp.messages.commissionWithdraw", { defaultValue: "Withdraw request" })}
        </button>
      )}

      {!ownsCreator && commission.state === "quoted" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                accept.mutateAsync({ commissionId: commission.id, personaId }).then(() => wallet.refetch()),
                localizeUi("ui.slurp.messages.commissionAcceptFailed", { defaultValue: "Unable to process payment." }),
                localizeUi("ui.slurp.messages.commissionAccepted", {
                  defaultValue: "Payment sent. Your commission is now in progress.",
                }),
              )
            }
            className="relative inline-flex min-h-11 items-center gap-1.5 overflow-visible rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <SlurpCoinBurst active={accept.isPending} />
            {accept.isPending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {accept.isPending
              ? localizeUi("ui.slurp.messages.commissionAcceptPending", { defaultValue: "Processing payment…" })
              : localizeUi("ui.slurp.messages.commissionAccept", { defaultValue: "Accept and pay" })}
            {!accept.isPending && <SlurpCoinAmount amount={commission.price} />}
          </button>
          {wallet.data && wallet.data.coins < commission.price && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {localizeUi("ui.slurp.messages.commissionBalanceShort", {
                defaultValue: "You need {{amount}} more coins.",
                amount: commission.price - wallet.data.coins,
              })}
            </span>
          )}
        </div>
      )}

      {/*
        A character Creator's piece is finished and paid for, and now being waited on. Saying so,
        with the time it is due, is the difference between a wait and a screen that looks stuck.
      */}
      {commission.state === "accepted" && commission.deliverAt && (
        <p className="mt-3 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
          <Loader2 size={13} className="animate-spin motion-reduce:hidden" aria-hidden="true" />
          {localizeUi("ui.slurp.messages.commissionArriving", {
            defaultValue: "Being made. Arriving around {{time}}.",
            time: formatTime(commission.deliverAt, i18n.language),
          })}
        </p>
      )}

      {ownsCreator && commission.state === "accepted" && !commission.deliverAt && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="font-bold" htmlFor={`slurp-deliver-${commission.id}`}>
            {localizeUi("ui.slurp.messages.commissionDeliverLabel", { defaultValue: "Delivery" })}
          </label>
          <textarea
            id={`slurp-deliver-${commission.id}`}
            value={delivery}
            rows={2}
            maxLength={2000}
            onChange={(event) => setDelivery(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.commissionDeliverPlaceholder", {
              defaultValue: "Deliver the finished piece…",
            })}
            className="w-full resize-y rounded-xl bg-[var(--slurp-canvas,var(--background))] px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface)]">
            <input
              type="checkbox"
              checked={generateImage}
              onChange={(event) => setGenerateImage(event.target.checked)}
              className="size-4 accent-[var(--noodle-accent)]"
            />
            {localizeUi("ui.slurp.messages.generateCommissionImage", {
              defaultValue: "Generate the commissioned image from the brief",
            })}
          </label>
          <button
            type="button"
            disabled={busy || !delivery.trim()}
            onClick={() =>
              run(
                deliver
                  .mutateAsync({
                    commissionId: commission.id,
                    personaId,
                    content: delivery.trim(),
                    generateImage,
                  })
                  .then(() => {
                    setDelivery("");
                    setGenerateImage(false);
                  }),
                localizeUi("ui.slurp.messages.commissionDeliverFailed", { defaultValue: "Could not deliver that." }),
              )
            }
            className="ml-auto min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {localizeUi("ui.slurp.messages.commissionDeliver", { defaultValue: "Deliver" })}
          </button>
        </div>
      )}

      {commission.state === "delivered" && deliveryMessage && (
        <div className="mt-3 overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
          {deliveryMessage.imageUrl && !deliveryImage && (
            <div className="flex min-h-40 items-center justify-center px-4 text-center text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.commissionImageLoading", { defaultValue: "Loading the finished image…" })}
            </div>
          )}
          {deliveryImage && (
            <img
              src={deliveryImage}
              alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Commission delivery" })}
              className="max-h-[32rem] w-full object-contain outline outline-1 outline-black/10 dark:outline-white/10"
            />
          )}
          {deliveryMessage.content && (
            <p className="whitespace-pre-wrap break-words px-3.5 py-3 text-sm leading-relaxed">
              {deliveryMessage.content}
            </p>
          )}
        </div>
      )}

      {success && (
        <p role="status" className="mt-2 text-[var(--noodle-accent)]">
          {success}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </article>
  );
}

/**
 * The dropdown the header opens.
 *
 * Two panels, not one, and the difference is deliberate. The fan's copy is qualitative: the server
 * never sends them the score or the mood, because `slurp-rapport.ts` says a number in a thread
 * turns a person into a progress bar and teaches the player to farm it. The Creator's operator is
 * looking at their own business, so they get every figure the simulation used.
 */
function SlurpRelationshipPanel({
  relationship,
  locale,
}: {
  relationship: NonNullable<SlurpThreadRelationship>;
  locale: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const cooling = relationship.coolUntil && relationship.coolUntil > new Date().toISOString();
  const mood = "mood" in relationship ? relationship.mood : null;
  const moodLabel =
    mood === null
      ? null
      : mood >= 40
        ? "warm"
        : mood >= 10
          ? "open"
          : mood > -25
            ? "neutral"
            : mood > -60
              ? "cooling"
              : "cold";
  const moodPercent = mood === null ? 0 : Math.max(0, Math.min(100, ((mood + 100) / 200) * 100));
  return (
    <div className="mx-3 mt-2 shrink-0 rounded-2xl bg-[var(--slurp-surface)] p-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]">
      <dl className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.relationshipTier", { defaultValue: "Where you stand" })}
          </dt>
          <dd className="font-bold">{localizeUi(`ui.slurp.rapport.tier.${relationship.tier}`)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.relationshipSpent", { defaultValue: "Spent with them" })}
          </dt>
          <dd className="font-bold">
            <SlurpCoinAmount amount={relationship.spentCoins} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.relationshipScore", { defaultValue: "Rapport" })}
          </dt>
          <dd className="font-bold tabular-nums">{relationship.score}/100</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.relationshipMood", { defaultValue: "Conversation mood" })}
          </dt>
          <dd className="font-bold capitalize">{moodLabel}</dd>
        </div>
        <div
          aria-label={localizeUi("ui.slurp.messages.moodLevel", { defaultValue: "Conversation mood" })}
          className="h-1.5 overflow-hidden rounded-full bg-[var(--slurp-surface-raised)]"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              mood !== null && mood < -25 ? "bg-amber-500" : "bg-[var(--noodle-accent)]",
            )}
            style={{ width: `${moodPercent}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <InfoChip
            label={localizeUi("ui.slurp.messages.relationshipTone", { defaultValue: "Tone" })}
            value={relationship.audienceTone}
          />
          <InfoChip
            label={localizeUi("ui.slurp.messages.relationshipImages", { defaultValue: "Pictures" })}
            value={relationship.imageMode === "none" ? "Not now" : relationship.imageMode}
          />
          <InfoChip
            label={localizeUi("ui.slurp.messages.relationshipStrikes", { defaultValue: "Strikes" })}
            value={String(relationship.strikes)}
          />
        </div>
        {relationship.dayVibe && (
          <p className="rounded-xl bg-[var(--slurp-surface-raised)] px-2.5 py-2 text-[var(--muted-foreground)]">
            <span className="font-bold text-[var(--foreground)]">
              {localizeUi("ui.slurp.messages.dayVibe", { defaultValue: "Today" })}:
            </span>{" "}
            {relationship.dayVibe}
          </p>
        )}
        <p className="text-[var(--muted-foreground)]">
          <span className="font-bold text-[var(--foreground)]">
            {relationship.availability.online ? "Available" : "Away"}
          </span>
          {relationship.availability.activity ? ` · ${relationship.availability.activity}` : ""}
        </p>
        {relationship.contributions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {relationship.contributions
              .filter((entry) => Math.abs(entry.points) >= 1)
              .map((entry) => (
                <span
                  key={entry.key}
                  className="rounded-full bg-[var(--slurp-surface-raised)] px-2 py-0.5 text-[0.65rem] text-[var(--muted-foreground)]"
                >
                  {entry.detail}
                  <span className={cn("ml-1 font-bold", entry.points < 0 && "text-red-600 dark:text-red-400")}>
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                </span>
              ))}
          </div>
        )}
        {relationship.notes.some((note) => note.tier === "working") && (
          <div className="mt-1">
            <dt className="text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.relationshipWorkingNotes", { defaultValue: "Recent facts" })}
            </dt>
            <ul className="mt-1 list-disc pl-4 leading-5 text-[var(--muted-foreground)]">
              {relationship.notes
                .filter((note) => note.tier === "working")
                .map((note) => (
                  <li key={note.id}>{note.text}</li>
                ))}
            </ul>
          </div>
        )}
        {relationship.notes.some((note) => note.tier === "longterm") && (
          <div className="mt-1">
            <dt className="text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.relationshipLongTermNotes", { defaultValue: "Long-term memory" })}
            </dt>
            <ul className="mt-1 list-disc pl-4 leading-5 text-[var(--muted-foreground)]">
              {relationship.notes
                .filter((note) => note.tier === "longterm")
                .map((note) => (
                  <li key={note.id}>{note.text}</li>
                ))}
            </ul>
          </div>
        )}
        {cooling && (
          <p className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
            {localizeUi("ui.slurp.messages.relationshipCooling", {
              defaultValue: "Not talking right now. Back around {{time}}.",
              time: formatTime(relationship.coolUntil!, locale),
            })}
          </p>
        )}
      </dl>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--slurp-surface-raised)] px-2.5 py-2">
      <div className="text-[0.6rem] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 font-bold capitalize">{value}</div>
    </div>
  );
}

function SlurpPromptDebugPanel({
  query,
}: {
  query: { data?: SlurpPromptDebug; isPending: boolean; isError: boolean };
}) {
  const { t: localizeUi } = useUiTranslation();
  if (query.isPending)
    return (
      <p className="mx-3 mt-2 shrink-0 rounded-xl bg-[var(--slurp-surface)] p-3 text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.slurp.messages.promptLoading", { defaultValue: "Loading prompt details…" })}
      </p>
    );
  if (query.isError || !query.data)
    return (
      <p className="mx-3 mt-2 shrink-0 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
        {localizeUi("ui.slurp.messages.promptUnavailable", { defaultValue: "Prompt details are not available." })}
      </p>
    );
  return (
    <details
      open
      className="mx-3 mt-2 shrink-0 rounded-xl bg-[var(--slurp-surface)] p-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]"
    >
      <summary className="cursor-pointer font-bold">
        {localizeUi("ui.slurp.messages.promptDebug", { defaultValue: "Prompt details" })}
      </summary>
      <div className="mt-2 space-y-2">
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/10 p-2">
          {JSON.stringify(query.data.stance, null, 2)}
        </pre>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/10 p-2">
          {query.data.prompt.map((message) => `${message.role}: ${message.content}`).join("\n\n")}
        </pre>
      </div>
    </details>
  );
}

/**
 * How well this pair knows each other, as one word.
 *
 * The score itself stays hidden: a number invites the player to farm it, and the tiers gate
 * nothing. The word is what the Creator is reacting to, so the word is what to show.
 */
function SlurpRapportBadge({ rapport, ownsCreator }: { rapport: SlurpRapport; ownsCreator: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  // A stranger badge on an empty thread is noise: everybody starts there.
  if (!rapport || rapport.tier === "stranger") return null;
  return (
    <span
      title={localizeUi(
        ownsCreator ? `ui.slurp.rapport.creatorHint.${rapport.tier}` : `ui.slurp.rapport.viewerHint.${rapport.tier}`,
      )}
      className="inline-flex shrink-0 items-center rounded-full bg-[var(--noodle-accent)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[var(--noodle-accent)]"
    >
      {localizeUi(`ui.slurp.rapport.tier.${rapport.tier}`)}
    </span>
  );
}
