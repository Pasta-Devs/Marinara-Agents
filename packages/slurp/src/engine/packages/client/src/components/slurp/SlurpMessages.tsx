import {
  ArrowLeft,
  Activity,
  Brain,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Info,
  Link,
  Loader2,
  Lock,
  MessageCircle,
  Megaphone,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { getApiErrorMessage } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { Avatar } from "./SlurpShell";
import { SlurpEmptyArtwork } from "./SlurpEmptyArtwork";
import { formatTime } from "./SlurpDateTime";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "./SlurpCoin";
import {
  useAcceptSlurpCommission,
  useDeclineSlurpCommission,
  useBroadcastSlurpMessage,
  useCreateSlurpCommission,
  useCancelSlurpFollowUp,
  useDeliverSlurpCommission,
  useQuoteSlurpCommission,
  useResolveSlurpMessageRequest,
  useResetSlurpThread,
  useSetSlurpThreadNotes,
  useDraftSlurpCreatorReply,
  useSendSlurpCreatorPpv,
  useSendSlurpCreatorImage,
  useSendSlurpCreatorReply,
  useSendSlurpViewerImage,
  useGenerateSlurpViewerImage,
  useSendSlurpMessage,
  useSlurpCompose,
  useSlurpConnections,
  useSlurpSettings,
  useSlurpThread,
  useSlurpOlderMessages,
  useSlurpMessagePrompt,
  useSlurpThreads,
  useTipInSlurpThread,
  useUpdateSlurpSettings,
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

/** How much of a conversation is mounted at once, and how much one "show earlier" adds. */
const SLURP_MESSAGE_PAGE = 25;

/** The server applies the same limit to each memory tier. */
const SLURP_MEMORY_TIER_LIMIT = 8;

function isCommissionRequest(content: string): boolean {
  return /\b(commission|custom\s+(art|piece|work)|request\s+(a|an)\s+(image|picture|piece))\b/i.test(content);
}

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
  const conversationOpen = Boolean(openThreadId || composeWith);
  const closeConversation = () => {
    setOpenThreadId(null);
    setComposeWith(null);
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
          {unread > 0 && (
            <span className="shrink-0 rounded-full bg-[var(--noodle-accent)]/12 px-2.5 py-1 text-[0.7rem] font-bold tabular-nums text-[var(--noodle-accent)]">
              {localizeUi("ui.slurp.messages.unreadTotal", { defaultValue: "{{count}} unread", count: unread })}
            </span>
          )}
        </div>
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
                filter === option && "bg-[var(--noodle-accent)] text-zinc-950 ring-[var(--noodle-accent)]",
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
  const olderMessages = useSlurpOlderMessages();
  const byCreator = useSlurpCompose(threadId ? null : creatorAccountId, personaId);
  const threadQuery = threadId ? byThread : byCreator;
  const send = useSendSlurpMessage();
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
  const [toolTab, setToolTab] = useState<"tip" | "commission" | "photo" | "generated-photo" | "creator" | null>(null);
  const [commissionPrefill, setCommissionPrefill] = useState("");
  const settingsQuery = useSlurpSettings();
  const connectionsQuery = useSlurpConnections(true);
  const updateSlurpSettings = useUpdateSlurpSettings();
  const [tipMode, setTipMode] = useState<"now" | "with-message">("now");
  const [activeTipAmount, setActiveTipAmount] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [customTipNote, setCustomTipNote] = useState("");
  const [composerTipAmount, setComposerTipAmount] = useState(0);
  const [composerTipNote, setComposerTipNote] = useState("");
  const [sendRequestId, setSendRequestId] = useState<string | null>(null);
  // The fan's own words, held on screen until the server's copy of them arrives.
  const [pending, setPending] = useState<{ content: string; id: string | null } | null>(null);
  // Why no answer came. The send route has always reported this and nothing ever read it, so a
  // sleeping creator, a busy thread and a missing connection all looked like the same silence.
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<SlurpConversationDrawerMode>(null);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const [commissionRibbonOpen, setCommissionRibbonOpen] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
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
  const messageSearchInputRef = useRef<HTMLInputElement | null>(null);

  const thread = threadQuery.data?.thread ?? null;
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
  const draftStorageKey = `slurp-message-draft:${personaId ?? "none"}:${targetCreatorAccountId ?? "none"}`;
  const messaging = threadQuery.data?.messaging;
  const commissions = useMemo(() => threadQuery.data?.commissions ?? [], [threadQuery.data?.commissions]);
  const relationship = "relationship" in (threadQuery.data ?? {}) ? threadQuery.data?.relationship : undefined;
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
  const lastOwnMessageId = messages.reduce<string | null>(
    (latest, message) => ((ownsCreator ? message.role === "creator" : message.role === "viewer") ? message.id : latest),
    null,
  );
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
  const promptDebug = useSlurpMessagePrompt(threadId, personaId, drawerMode === "prompt");
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
              id: "generated-photo",
              icon: Palette,
              label: localizeUi("ui.slurp.messages.createPhoto", { defaultValue: "Create a photo" }),
              detail: localizeUi("ui.slurp.messages.createPhotoDetail", {
                defaultValue: "Describe an image to generate",
              }),
              group: "media" as const,
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
    setVisibleCount(SLURP_MESSAGE_PAGE);
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
    container.scrollTop = container.scrollHeight;
  }, [visibleTimeline.length]);

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
   * The indicator now starts when the fan hits send, because `/messages/send` generates the reply
   * before it answers and that wait is the real one. `typingMs` is a floor on how long the
   * creator appears to type, so only the part of it the request did not already cover is left.
   */
  const holdTyping = (ms: number, startedAt: number, replyId?: string) => {
    const remaining = ms - (Date.now() - startedAt);
    if (remaining <= 0) {
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
    // Hide the reply message until typing delay finishes
    if (replyId) {
      setHiddenReplyIds((prev) => new Set(prev).add(replyId));
    }
    // Clear any existing typing timeout
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      setTyping(false);
      if (replyId) {
        setHiddenReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });
      }
      typingTimeoutRef.current = null;
    }, remaining);
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

  const submit = async (force = false) => {
    const content = draft.trim();
    if (!content || !personaId || !targetCreatorAccountId || busy) return;
    if (!force && !ownsCreator && isCommissionRequest(content)) {
      setCommissionPrefill(content);
      setToolsOpen(true);
      setToolTab("commission");
      return;
    }
    // Cancel any active typing animation when fan interrupts
    if (typing) {
      cancelTyping();
    }
    setError(null);
    setDraft("");
    // Show the message and the typing indicator at once. The send route waits for the model
    // before it answers, so the chat used to sit empty for the whole generation.
    setPending({ content, id: null });
    setReplyStatus(null);
    const startedAt = Date.now();
    if (!ownsCreator) setTyping(true);
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
        setPending({ content, id: written.message.id });
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
      setPending({ content, id: result.message.id });
      setReplyStatus(result.replyStatus ?? null);
      if (result.tipError) setError(result.tipError);
      setComposerTipAmount(0);
      setComposerTipNote("");
      holdTyping(result.reply ? (result.typingMs ?? 0) : 0, startedAt, result.reply?.id);
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
    const startedAt = Date.now();
    try {
      const result = await tip.mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, amount, note });
      if (result.reply) holdTyping(result.typingMs ?? 0, startedAt, result.reply.id);
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
              <span className="truncate text-[0.7rem] text-[var(--muted-foreground)]">
                @{headerAccount?.handle ?? ""}
              </span>
              {relationship && (
                <span className="flex items-center gap-1 truncate text-[0.7rem] text-[var(--muted-foreground)]">
                  <span>·</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      relationship.availability.online
                        ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                        : relationship.availability.minutesUntilOnline !== null &&
                            relationship.availability.minutesUntilOnline < 120
                          ? "bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.6)]"
                          : "bg-gray-400",
                    )}
                    aria-hidden="true"
                  />
                  {relationship.availability.online
                    ? localizeUi("ui.slurp.messages.availableNow", { defaultValue: "Available now" })
                    : relationship.availability.minutesUntilOnline !== null
                      ? relationship.availability.minutesUntilOnline < 60
                        ? `Back in ~${Math.round(relationship.availability.minutesUntilOnline)}min`
                        : `Back in ~${Math.round(relationship.availability.minutesUntilOnline / 60)}hr`
                      : localizeUi("ui.slurp.messages.away", { defaultValue: "Away" })}
                </span>
              )}
              {/* Rapport decides how fast and how warmly a Creator answers. The player felt it and
                  could never see it, so the one number the whole thread turns on was invisible. */}
              {thread && <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />}
            </span>
          </span>
        </button>
        {/* Four icons of the same size and weight, because none of them outranks the others. The
            details button was the odd one out as a word, and read as the only real control. */}
        {relationship && (
          <HeaderIconButton
            className="ml-auto"
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

      <div
        ref={messageScrollRef}
        onScroll={(event) => {
          // Reaching the top is the same request as pressing the button, so it does the same thing.
          if ((olderCount > 0 || nextOlderCursor) && event.currentTarget.scrollTop < 64) void showOlder();
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

      <div className="shrink-0 border-t border-[var(--noodle-divider)] p-2">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {toolsOpen && (
            <div className="flex flex-col gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating)]">
              {!toolTab ? (
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
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setToolTab(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    aria-label="Back to message actions"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                  </button>
                  <h2 className="min-w-0 truncate text-sm font-black">
                    {toolTabs.find((tab) => tab.id === toolTab)?.label ?? "Message action"}
                  </h2>
                </div>
              )}

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
                  mode="upload"
                />
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
                          tipMode === mode && "bg-[var(--noodle-accent)] text-zinc-950 ring-[var(--noodle-accent)]",
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
                        className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
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
                            composerTipAmount === amount && "bg-[var(--noodle-accent)] text-zinc-950",
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
            className="flex items-end gap-2"
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
              className="max-h-40 min-h-11 w-full flex-1 resize-y rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)] sm:text-sm"
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
              <SlurpPromptDebugPanel query={promptDebug} />
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

/** One header control. All of them are icons at the same size, so none reads as the primary one. */
function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  badge = 0,
  className,
}: {
  icon: typeof Brain;
  label: string;
  onClick: () => void;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
        className,
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {badge > 0 && (
        <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-[var(--noodle-accent)] px-1 text-[0.6rem] font-black leading-4 text-zinc-950">
          {badge}
        </span>
      )}
    </button>
  );
}

function SlurpConnectionSwitcher({
  connections,
  activeConnectionId,
  open,
  onOpenChange,
  pending,
  onChange,
}: {
  connections: Array<{ id: string; name?: string; model?: string; provider?: string }>;
  activeConnectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onChange: (connectionId: string | null) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const active = connections.find((connection) => connection.id === activeConnectionId);
  const label = active?.name ?? active?.model ?? "Default connection";

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Text connection: ${label}`}
        title={`Text connection: ${label}`}
        className={cn(
          "inline-flex min-h-11 max-w-36 items-center gap-1.5 rounded-xl px-2 text-[0.68rem] text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50",
          open && "bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)] ring-[var(--noodle-accent)]/45",
        )}
      >
        <Link size={14} aria-hidden="true" />
        <span className="truncate">{label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Text connections"
          className="absolute bottom-full start-0 z-20 mb-2 max-h-72 min-w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-[var(--slurp-surface-raised)] p-1 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={activeConnectionId === null}
            onClick={() => {
              onChange(null);
              onOpenChange(false);
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs hover:bg-[var(--slurp-surface)]"
          >
            <span className="min-w-0 flex-1 truncate">Default connection</span>
            {activeConnectionId === null && <Check size={14} aria-hidden="true" />}
          </button>
          {connections.map((connection) => {
            const selected = connection.id === activeConnectionId;
            return (
              <button
                key={connection.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(connection.id);
                  onOpenChange(false);
                }}
                className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-[var(--slurp-surface)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{connection.name ?? connection.id}</span>
                  {connection.model && (
                    <span className="block truncate text-[0.65rem] text-[var(--muted-foreground)]">
                      {connection.model}
                    </span>
                  )}
                </span>
                {selected && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
          {connections.length === 0 && (
            <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">No text connections found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SlurpFollowUpItem({
  followUp,
  threadId,
  personaId,
  editable,
}: {
  followUp: {
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    sequenceNumber?: number;
    totalInSequence?: number;
  };
  threadId: string | null;
  personaId: string | null;
  editable: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const cancelFollowUp = useCancelSlurpFollowUp();

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60_000);

    if (diffMin < 0) return localizeUi("ui.slurp.messages.followUpOverdue", { defaultValue: "Overdue" });
    if (diffMin < 60) return `${diffMin}min`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}hr`;
    const diffDays = Math.round(diffHr / 24);
    return `${diffDays}d`;
  };

  const typeLabel =
    {
      reminder: localizeUi("ui.slurp.messages.followUpTypeReminder", { defaultValue: "Reminder" }),
      promise_delivery: localizeUi("ui.slurp.messages.followUpTypePromise", { defaultValue: "Promise" }),
      task_update: localizeUi("ui.slurp.messages.followUpTypeTask", { defaultValue: "Task update" }),
      check_in: localizeUi("ui.slurp.messages.followUpTypeCheckIn", { defaultValue: "Check-in" }),
      recurring: localizeUi("ui.slurp.messages.followUpTypeRecurring", { defaultValue: "Update" }),
    }[followUp.type] || followUp.type;

  const handleCancel = async () => {
    if (!threadId || !personaId) return;
    await cancelFollowUp.mutateAsync({ threadId, followUpId: followUp.id, personaId });
  };

  return (
    <li className="flex items-start gap-1.5 rounded-xl bg-[var(--slurp-surface)] px-2.5 py-1.5 text-xs leading-snug">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="rounded bg-[var(--slurp-surface-raised)] px-1.5 py-0.5 text-[0.65rem] font-bold text-[var(--muted-foreground)]">
            {typeLabel}
          </span>
          <span className="text-[0.65rem] text-[var(--muted-foreground)]">in {formatTime(followUp.scheduledAt)}</span>
          {followUp.sequenceNumber && followUp.totalInSequence && (
            <span className="text-[0.65rem] text-[var(--muted-foreground)]">
              ({followUp.sequenceNumber}/{followUp.totalInSequence})
            </span>
          )}
        </p>
        <p className="mt-0.5 break-words">{followUp.reason}</p>
        {followUp.context && <p className="mt-0.5 text-[0.65rem] text-[var(--muted-foreground)]">{followUp.context}</p>}
      </div>
      {editable && (
        <button
          type="button"
          disabled={cancelFollowUp.isPending}
          onClick={handleCancel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
          aria-label={localizeUi("ui.slurp.messages.cancelFollowUp", { defaultValue: "Cancel follow-up" })}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/**
 * What the creator remembers about this fan, and the one place it can be corrected.
 *
 * These notes are written by the model and were read-only, so a creator who had misheard a name
 * or kept a job the fan had left said it back forever. Editing is the cheapest possible fix and
 * it goes through the same normalizer the model's own writes do, so nothing here can be longer,
 * more numerous, or shaped differently than a memory the creator wrote herself.
 */
function SlurpMemoriesPanel({
  notes,
  scheduledFollowUps,
  threadId,
  personaId,
  onOpenPrompt,
}: {
  notes: { id: string; text: string; tier: "working" | "longterm" }[];
  scheduledFollowUps?: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    reason: string;
    context: string;
    sequenceNumber?: number;
    totalInSequence?: number;
  }>;
  threadId: string | null;
  personaId: string | null;
  onOpenPrompt: (() => void) | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const setNotes = useSetSlurpThreadNotes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingTier, setAddingTier] = useState<"working" | "longterm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = Boolean(threadId && personaId);

  const write = (next: { id?: string; text: string; tier: "working" | "longterm" }[]) => {
    if (!threadId || !personaId) return;
    setError(null);
    setNotes
      .mutateAsync({ threadId, personaId, notes: next })
      .then(() => {
        setEditingId(null);
        setAddingTier(null);
        setDraft("");
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.slurp.messages.memoryFailed", { defaultValue: "Could not save that memory." }),
        ),
      );
  };

  const tierRows = (tier: "working" | "longterm") => notes.filter((note) => note.tier === tier);

  const section = (tier: "working" | "longterm", title: string, hint: string) => {
    const rows = tierRows(tier);
    return (
      <section className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black">
            {title}{" "}
            <span className="font-normal text-[var(--muted-foreground)]">
              {rows.length}/{SLURP_MEMORY_TIER_LIMIT}
            </span>
          </h3>
          <button
            type="button"
            disabled={!editable || setNotes.isPending || rows.length >= SLURP_MEMORY_TIER_LIMIT}
            onClick={() => {
              setAddingTier(tier);
              setEditingId(null);
              setDraft("");
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[0.7rem] font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
          >
            <Plus size={13} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.memoryAdd", { defaultValue: "Add" })}
          </button>
        </div>
        <p className="mt-0.5 text-[0.65rem] text-[var(--muted-foreground)]">{hint}</p>
        <ul className="mt-2 space-y-1.5">
          {rows.length === 0 && addingTier !== tier && (
            <li className="text-[0.7rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.memoryNone", { defaultValue: "Nothing remembered here yet." })}
            </li>
          )}
          {rows.map((note) =>
            editingId === note.id ? (
              <li key={note.id}>
                <MemoryEditor
                  value={draft}
                  pending={setNotes.isPending}
                  onChange={setDraft}
                  onCancel={() => setEditingId(null)}
                  onSave={() =>
                    write(notes.map((entry) => (entry.id === note.id ? { ...entry, text: draft.trim() } : entry)))
                  }
                />
              </li>
            ) : (
              <li
                key={note.id}
                className="flex items-start gap-1.5 rounded-xl bg-[var(--slurp-surface)] px-2.5 py-1.5 text-xs leading-snug"
              >
                <span className="min-w-0 flex-1 break-words">{note.text}</span>
                <button
                  type="button"
                  disabled={!editable || setNotes.isPending}
                  onClick={() => {
                    setEditingId(note.id);
                    setAddingTier(null);
                    setDraft(note.text);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
                  aria-label={localizeUi("ui.slurp.messages.memoryEdit", { defaultValue: "Edit memory" })}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!editable || setNotes.isPending}
                  onClick={() => write(notes.filter((entry) => entry.id !== note.id))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40 dark:text-red-400"
                  aria-label={localizeUi("ui.slurp.messages.memoryDelete", { defaultValue: "Forget this" })}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ),
          )}
          {addingTier === tier && (
            <li>
              <MemoryEditor
                value={draft}
                pending={setNotes.isPending}
                onChange={setDraft}
                onCancel={() => setAddingTier(null)}
                onSave={() => write([...notes, { text: draft.trim(), tier }])}
              />
            </li>
          )}
        </ul>
      </section>
    );
  };

  return (
    <div className="divide-y divide-[var(--noodle-divider)]">
      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {section(
        "working",
        localizeUi("ui.slurp.messages.memoryWorking", { defaultValue: "Working memory" }),
        localizeUi("ui.slurp.messages.memoryWorkingHint", { defaultValue: "Recent. These change as you talk." }),
      )}
      {section(
        "longterm",
        localizeUi("ui.slurp.messages.memoryLongTerm", { defaultValue: "Long-term memory" }),
        localizeUi("ui.slurp.messages.memoryLongTermHint", {
          defaultValue: "The stable facts. These stay until something updates them.",
        }),
      )}
      {scheduledFollowUps && scheduledFollowUps.length > 0 && (
        <section className="px-4 py-3">
          <h3 className="pb-2 text-[0.65rem] font-black uppercase tracking-wider text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.scheduledFollowUps", { defaultValue: "Scheduled follow-ups" })}
          </h3>
          <p className="pb-2 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.scheduledFollowUpsHint", {
              defaultValue: "Messages the Creator will send proactively.",
            })}
          </p>
          <ul className="space-y-1.5">
            {scheduledFollowUps.map((followUp) => (
              <SlurpFollowUpItem
                key={followUp.id}
                followUp={followUp}
                threadId={threadId}
                personaId={personaId}
                editable={editable}
              />
            ))}
          </ul>
        </section>
      )}
      {onOpenPrompt && (
        <section className="px-4 py-3">
          <button
            type="button"
            onClick={onOpenPrompt}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <Search size={14} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.promptDetails", { defaultValue: "Prompt details" })}
          </button>
          <p className="mt-1.5 text-[0.65rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.promptPreviewHint", {
              defaultValue: "Exactly what is sent to the model for the next reply.",
            })}
          </p>
        </section>
      )}
    </div>
  );
}

/** One memory being written or corrected. Bounded here as well as on the server. */
function MemoryEditor({
  value,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-[var(--slurp-surface-raised)] p-2">
      <label className="sr-only" htmlFor="slurp-memory-text">
        {localizeUi("ui.slurp.messages.memoryText", { defaultValue: "Memory" })}
      </label>
      <textarea
        id="slurp-memory-text"
        autoFocus
        rows={2}
        maxLength={160}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={localizeUi("ui.slurp.messages.memoryPlaceholder", {
          defaultValue: "Something they know about you…",
        })}
        className="w-full resize-y rounded-lg bg-[var(--slurp-surface)] px-2.5 py-2 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-xs"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending || !value.trim()}
          onClick={onSave}
          className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-[0.7rem] font-bold text-zinc-950 disabled:opacity-40"
        >
          {localizeUi("ui.slurp.messages.memorySave", { defaultValue: "Save" })}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 rounded-lg px-3 text-[0.7rem] font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          {localizeUi("ui.slurp.messages.memoryCancel", { defaultValue: "Cancel" })}
        </button>
      </div>
    </div>
  );
}

/**
 * Every commission in this conversation, newest first.
 *
 * The chat only carries the ones still worth answering, and clearing the conversation takes them
 * out of it entirely. This is where the older ones stay readable.
 */
function SlurpCommissionsPanel({
  commissions,
  personaId,
  ownsCreator,
  onAskCommission,
}: {
  commissions: SlurpCommission[];
  personaId: string | null;
  ownsCreator: boolean;
  onAskCommission: (() => void) | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!personaId) return null;
  return (
    <div className="flex flex-col gap-2 p-3">
      {onAskCommission && (
        <button
          type="button"
          onClick={onAskCommission}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950"
        >
          <BriefcaseBusiness size={15} aria-hidden="true" />
          Ask for commission
        </button>
      )}
      {commissions.length === 0 && (
        <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.messages.commissionsEmpty", {
            defaultValue: "No commissions in this conversation yet.",
          })}
        </p>
      )}
      {[...commissions]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((commission) => (
          <CommissionRow
            key={commission.id}
            commission={commission}
            deliveryMessage={null}
            personaId={personaId}
            ownsCreator={ownsCreator}
          />
        ))}
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
export function BroadcastPanel({ creatorAccountId, personaId }: { creatorAccountId: string; personaId: string }) {
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
              className="min-h-11 shrink-0 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
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
  mode,
}: {
  creatorAccountId: string;
  viewerAccountId: string;
  personaId: string;
  /** The creator's configured PPV price, used as the opening offer rather than a fixed one. */
  defaultPpvPrice: number;
  threadId: string;
  onPreparingImage: (preparing: boolean) => void;
  mode: "locked" | "generate";
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
      {mode === "locked" && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-bold transition-colors hover:bg-[var(--noodle-accent)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
        >
          <Lock size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
          {localizeUi("ui.slurp.messages.sendPpv", { defaultValue: "Send locked content" })}
        </button>
      )}
      {mode === "locked" && open && (
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
      {mode === "generate" && (
        <div className="p-3">
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
      )}
    </div>
  );
}

function FanImageTool({
  threadId,
  creatorAccountId,
  personaId,
  mode,
}: {
  threadId: string;
  creatorAccountId: string;
  personaId: string;
  mode: "upload" | "generate";
}) {
  const { t: localizeUi } = useUiTranslation();
  const send = useSendSlurpViewerImage();
  const generate = useGenerateSlurpViewerImage();
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  return (
    <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <div className="flex flex-col gap-2 p-3">
        {mode === "generate" && (
          <textarea
            value={prompt}
            rows={2}
            maxLength={1000}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the photo you want to generate"
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
          />
        )}
        {mode === "upload" && (
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-xs"
          />
        )}
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
          disabled={mode === "upload" ? !file || send.isPending : !prompt.trim() || generate.isPending}
          onClick={() => {
            const request =
              mode === "upload"
                ? file && send.mutateAsync({ threadId, creatorAccountId, personaId, file, content })
                : generate.mutateAsync({ threadId, creatorAccountId, personaId, prompt: prompt.trim(), content });
            if (!request) return;
            void request.then(() => {
              setFile(null);
              setPrompt("");
              setContent("");
            });
          }}
          className="min-h-10 self-end rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
        >
          {send.isPending || generate.isPending
            ? localizeUi("ui.slurp.messages.sending", { defaultValue: "Sending…" })
            : mode === "generate"
              ? "Generate and send"
              : localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
        </button>
      </div>
    </div>
  );
}

/** Fan-side brief. A commission starts as a description and a price the creator names later. */
function CommissionRequest({
  disabled,
  pending,
  initialBrief,
  onSendAsMessage,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  initialBrief: string;
  onSendAsMessage: (() => void) | null;
  onSubmit: (brief: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [brief, setBrief] = useState(initialBrief);

  useEffect(() => {
    setBrief(initialBrief);
  }, [initialBrief]);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--slurp-surface)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
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
        <div className="flex items-center gap-2">
          {onSendAsMessage && (
            <button
              type="button"
              onClick={onSendAsMessage}
              className="min-h-11 rounded-xl px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              Send as message
            </button>
          )}
          <button
            type="button"
            disabled={disabled || pending || !brief.trim()}
            onClick={() => {
              onSubmit(brief.trim());
              setBrief("");
            }}
            className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {localizeUi("ui.slurp.messages.commissionSend", { defaultValue: "Send request" })}
          </button>
        </div>
      </div>
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
    <article className="min-w-0 max-w-full overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--slurp-violet)_5%,var(--slurp-surface))] p-3 text-xs ring-1 ring-inset ring-[var(--slurp-violet)]/20 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-black">
            <Sparkles size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {localizeUi("ui.slurp.messages.commissionTitle", { defaultValue: "Commission" })}
          </p>
          <p className="mt-1 break-words font-semibold text-[var(--muted-foreground)]">
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
          className="mt-4 grid min-w-0 grid-cols-4 gap-1"
          aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
        >
          {steps.map((step, index) => (
            <li key={step} className="relative flex min-w-0 max-w-full flex-col items-center gap-1 text-center">
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
              <span className="min-w-0 max-w-full break-words text-[0.65rem] font-semibold leading-4 text-[var(--muted-foreground)] sm:text-xs">
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
        <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2">
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
            className="min-h-11 max-w-full rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
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
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
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
            className="relative inline-flex min-h-11 max-w-full items-center gap-1.5 overflow-visible rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
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

/** Ordered, lowest to highest. The stepper and the basic reading both walk this. */
const ADULT_LEVELS = ["ordinary", "suggestive", "provocative", "intimate", "explicit"] as const;

/** What each level means in a sentence, so the word is never the only explanation. */
const ADULT_LEVEL_HINT: Record<string, string> = {
  ordinary: "Ordinary conversation. Nothing adult is on the table here yet.",
  suggestive: "Flirting and innuendo. She will hint, but not more than that.",
  provocative: "Openly forward. She will say what she means.",
  intimate: "Explicitly intimate, and personal about it.",
  explicit: "No limit beyond the ones she sets herself.",
};

/**
 * The four tones a value can carry, as the whole ramp rather than one colour.
 *
 * `track` is a lighter step of the same hue rather than a neutral grey, so the state of a meter
 * reads across the whole bar instead of only across the filled part.
 */
const PANEL_TONES = {
  accent: {
    fill: "bg-[var(--noodle-accent)]",
    track: "bg-[color-mix(in_srgb,var(--noodle-accent)_18%,transparent)]",
    text: "text-[var(--noodle-accent)]",
    ring: "ring-[color-mix(in_srgb,var(--noodle-accent)_40%,transparent)]",
  },
  good: {
    fill: "bg-emerald-500",
    track: "bg-emerald-500/18",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
  },
  warning: {
    fill: "bg-amber-500",
    track: "bg-amber-500/18",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/40",
  },
  serious: {
    fill: "bg-red-500",
    track: "bg-red-500/18",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/40",
  },
} as const;

type PanelTone = keyof typeof PANEL_TONES;

const humanizeValue = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/gu, (character) => character.toUpperCase());

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/** The word behind a 0-100 dial. Basic never shows the number; this is what it shows instead. */
const bandWord = (value: number) => (value <= 25 ? "low" : value <= 60 ? "medium" : value <= 80 ? "high" : "urgent");

/** How a conversation is going, as a word. Mood runs -100 to 100 and starts at zero. */
const moodWord = (mood: number) =>
  mood >= 40 ? "warm" : mood >= 10 ? "open" : mood > -25 ? "neutral" : mood > -60 ? "cooling" : "cold";

/**
 * A labelled 0-100 bar.
 *
 * The figure sits beside the label rather than only inside the bar, because a value that is only
 * reachable by reading a bar's length is not reachable at all.
 */
function Meter({
  label,
  value,
  tone = "accent",
  hint,
}: {
  label: string;
  value: number;
  tone?: PanelTone;
  hint?: string;
}) {
  const tones = PANEL_TONES[tone];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">{label}</span>
        <span className="text-[0.72rem] font-bold tabular-nums">{value}</span>
      </div>
      <div
        role="meter"
        aria-valuenow={clampPercent(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn("h-1.5 overflow-hidden rounded-full", tones.track)}
      >
        <div
          className={cn("h-full rounded-r-[4px] transition-[width] motion-reduce:transition-none", tones.fill)}
          style={{ width: `${clampPercent(value)}%` }}
        />
      </div>
      {hint && <p className="mt-1 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
}

/**
 * A value with a neutral middle and two directions, centred on that middle.
 *
 * Mood and a rapport contribution are both polarity rather than magnitude: what matters is which
 * side of nothing they fall on. A left-anchored bar cannot say that, so this one grows out of the
 * centre in the direction of its sign.
 */
function DivergingBar({
  label,
  value,
  max,
  negativeLabel,
  positiveLabel,
  reading,
}: {
  label: string;
  value: number;
  max: number;
  negativeLabel?: string;
  positiveLabel?: string;
  reading?: string;
}) {
  const share = max > 0 ? Math.min(1, Math.abs(value) / max) : 0;
  const tones = value < 0 ? PANEL_TONES.serious : PANEL_TONES.accent;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">{label}</span>
        <span className={cn("text-[0.72rem] font-bold", value < 0 && tones.text)}>
          {reading ?? (value > 0 ? `+${value}` : String(value))}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-[color-mix(in_srgb,var(--muted-foreground)_16%,transparent)]">
        {/* The midpoint is drawn, not implied: without it a short bar is unreadable. */}
        <div className="absolute inset-y-[-2px] left-1/2 w-px -translate-x-1/2 bg-[var(--muted-foreground)]/45" />
        <div
          className={cn("absolute inset-y-0 rounded-full transition-[width] motion-reduce:transition-none", tones.fill)}
          style={value < 0 ? { right: "50%", width: `${share * 50}%` } : { left: "50%", width: `${share * 50}%` }}
        />
      </div>
      {(negativeLabel || positiveLabel) && (
        <div className="mt-1 flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
          <span>{negativeLabel}</span>
          <span>{positiveLabel}</span>
        </div>
      )}
    </div>
  );
}

/**
 * An ordered scale of named steps, filled to the one currently held.
 *
 * The adult level is five ranked words, which is neither a magnitude nor a set of categories. A
 * segmented track says both how far along it is and that there is somewhere further to go, which
 * a single word on its own never did.
 */
function Stepper({ steps, current, label }: { steps: readonly string[]; current: string; label: string }) {
  const index = steps.indexOf(current);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] text-[var(--muted-foreground)]">{label}</span>
        <span className="text-[0.72rem] font-bold capitalize">{humanizeValue(current)}</span>
      </div>
      {/* Gaps in the surface colour separate the segments; no borders are drawn around them. */}
      <ol className="flex gap-[2px]" aria-label={`${label}: ${humanizeValue(current)}`}>
        {steps.map((step, position) => (
          <li
            key={step}
            title={humanizeValue(step)}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              position <= index
                ? "bg-[var(--noodle-accent)]"
                : "bg-[color-mix(in_srgb,var(--noodle-accent)_18%,transparent)]",
            )}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * A state, with an icon and a sentence.
 *
 * Never colour alone: the tone is a third signal behind the icon and the words, so the row still
 * says what it means in greyscale, in forced colours, and to somebody who cannot separate the hues.
 */
function StatusRow({
  icon: Icon,
  tone,
  title,
  detail,
}: {
  icon: typeof Activity;
  tone: PanelTone;
  title: string;
  detail?: string;
}) {
  const tones = PANEL_TONES[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl px-2.5 py-2 ring-1 ring-inset", tones.ring)}>
      <Icon size={14} className={cn("mt-px shrink-0", tones.text)} aria-hidden="true" />
      <div className="min-w-0">
        <p className={cn("font-bold", tones.text)}>{title}</p>
        {detail && <p className="mt-0.5 leading-snug text-[var(--muted-foreground)]">{detail}</p>}
      </div>
    </div>
  );
}

/** A label and a value. The workhorse of both views. */
function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--slurp-surface-raised)] px-2.5 py-2">
      <div className="text-[0.6rem] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 break-words font-bold capitalize">{value}</div>
      {hint && <div className="mt-1 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">{hint}</div>}
    </div>
  );
}

/** One collapsible block. Native `details`, so keyboard and find-in-page work without help. */
function PanelSection({
  icon: Icon,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  icon: typeof Activity;
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="border-b border-[var(--noodle-divider)] last:border-b-0">
      <summary className="group flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2.5 font-bold [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={15} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="max-w-[9rem] truncate text-right text-[0.68rem] font-normal text-[var(--muted-foreground)]">
            {summary}
          </span>
          <ChevronDown
            size={13}
            className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="space-y-2.5 pb-3.5">{children}</div>
    </details>
  );
}

/**
 * The dropdown the header opens.
 *
 * Two views, and the split is the one `slurp-rapport.ts` already argued for: a number in a thread
 * turns a person into a progress bar and teaches the player to farm it. So Basic answers what a
 * player needs to play the conversation, entirely in words — where they stand, how she is, what
 * can happen here. Advanced is the whole simulation with every figure the
 * prompt was built from, for somebody running the Creator rather than talking to her.
 *
 * They are separate views rather than one view with extra rows appended. The old panel added a
 * section far below the fold, so pressing the button looked like nothing had happened.
 */
function SlurpRelationshipPanel({
  relationship,
  onReset,
  resetting,
}: {
  relationship: NonNullable<SlurpThreadRelationship>;
  onReset: (() => void) | null;
  resetting: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const { creatorState, threadState, availability } = relationship;
  const cooling = Boolean(relationship.coolUntil && relationship.coolUntil > new Date().toISOString());
  const mood = relationship.mood ?? 0;
  const blockedBy =
    threadState.posture === "rejecting" || threadState.posture === "defensive"
      ? "She has gone guarded with this fan."
      : threadState.sexualComfort < 36
        ? "She is not comfortable enough with this fan yet."
        : threadState.respect < 36
          ? "She does not think well enough of this fan."
          : null;
  const modifiers = creatorState.modifiers ?? [];

  return (
    <div className="mx-3 mt-2 flex max-h-[min(78vh,44rem)] min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl bg-[var(--slurp-surface)] text-xs ring-1 ring-inset ring-[var(--noodle-divider)]">
      <header className="shrink-0 border-b border-[var(--noodle-divider)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold">Conversation overview</h2>
            {/* One hero figure, and it is the only thing at this size in the panel. */}
            <p className="mt-1 text-3xl font-bold capitalize leading-none">{humanizeValue(relationship.tier)}</p>
            <p className="mt-1.5 text-[0.68rem] text-[var(--muted-foreground)]">
              {advanced
                ? `Rapport ${relationship.score}/100 · mood ${mood > 0 ? `+${mood}` : mood}`
                : `Where you stand with them · ${moodWord(mood)} right now`}
            </p>
          </div>
          {/* Both words are on screen, one selected. A single button that swapped its own label
              left it ambiguous whether it named the current mode or the one it would switch to. */}
          <div
            role="group"
            aria-label="Detail level"
            className="flex shrink-0 gap-0.5 rounded-lg bg-[var(--slurp-surface-raised)] p-0.5"
          >
            {([false, true] as const).map((mode) => (
              <button
                key={String(mode)}
                type="button"
                aria-pressed={advanced === mode}
                onClick={() => setAdvanced(mode)}
                className={cn(
                  "min-h-9 rounded-[7px] px-2.5 text-[0.7rem] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                  advanced === mode
                    ? "bg-[var(--noodle-accent)] text-zinc-950"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {mode ? "Advanced" : "Basic"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-gutter:stable]">
        {advanced ? (
          <div className="flex flex-col">
            <PanelSection
              icon={MessageCircle}
              title="Creator right now"
              summary={`${humanizeValue(creatorState.emotion)} · ${bandWord(creatorState.energy)} energy`}
              defaultOpen
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Emotion" value={humanizeValue(creatorState.emotion)} />
                <Field label="Intent" value={humanizeValue(creatorState.intent)} />
              </div>
              <Meter label="Energy" value={creatorState.energy} hint="Effort available for replies and pictures." />
              <Meter
                label="Arousal"
                value={creatorState.arousal}
                tone="warning"
                hint="Sexual attention. It is never permission on its own."
              />
              <Meter label="Emotion intensity" value={creatorState.emotionIntensity} />
              <Meter
                label="Exposure"
                value={creatorState.exposure}
                tone="warning"
                hint="How far out on a limb she is in public. It fades overnight."
              />
              <div>
                <p className="mb-1 text-[0.7rem] text-[var(--muted-foreground)]">True right now ({modifiers.length})</p>
                {modifiers.length === 0 ? (
                  <p className="text-[0.68rem] text-[var(--muted-foreground)]">Nothing in particular today.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {modifiers.map((modifier) => (
                      <li
                        key={`${modifier.kind}-${modifier.until}`}
                        title={modifier.source || undefined}
                        className="rounded-full bg-[color-mix(in_srgb,var(--noodle-accent)_15%,transparent)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--noodle-accent)]"
                      >
                        {humanizeValue(modifier.kind)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PanelSection>

            <PanelSection
              icon={Sparkles}
              title="This conversation"
              summary={`${humanizeValue(threadState.posture)} · ${humanizeValue(threadState.adultLevel)}`}
              defaultOpen
            >
              <DivergingBar
                label="Mood"
                value={mood}
                max={100}
                negativeLabel="Cold"
                positiveLabel="Warm"
                reading={`${mood > 0 ? `+${mood}` : mood} · ${humanizeValue(moodWord(mood))}`}
              />
              <Stepper steps={ADULT_LEVELS} current={threadState.adultLevel} label="Adult level" />
              <p className="text-[0.65rem] leading-snug text-[var(--muted-foreground)]">
                {ADULT_LEVEL_HINT[threadState.adultLevel]} It rises one step at a time and never skips.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Posture" value={humanizeValue(threadState.posture)} />
                <Field label="Strikes" value={String(relationship.strikes)} />
              </div>
              <Meter label="Conversation desire" value={threadState.threadDesire} tone="warning" />
              <Meter label="Familiarity" value={threadState.familiarity} />
            </PanelSection>

            <PanelSection
              icon={ShieldCheck}
              title="Boundaries and trust"
              summary={blockedBy ? "Escalation blocked" : "Escalation allowed"}
              defaultOpen={Boolean(blockedBy) || cooling}
            >
              <StatusRow
                icon={ShieldCheck}
                tone={blockedBy ? "serious" : "good"}
                title={blockedBy ? "Adult escalation blocked" : "Adult escalation allowed"}
                detail={blockedBy ?? "Comfort, respect and posture all clear the bar she sets."}
              />
              {cooling && (
                <StatusRow
                  icon={Lock}
                  tone="warning"
                  title="Taking space from this conversation"
                  detail="She is not answering until the cool-off ends."
                />
              )}
              <Meter
                label="Sexual comfort"
                value={threadState.sexualComfort}
                tone={threadState.sexualComfort < 36 ? "serious" : "accent"}
              />
              <Meter
                label="Respect"
                value={threadState.respect}
                tone={threadState.respect < 36 ? "serious" : "accent"}
              />
              <Meter label="Emotional trust" value={threadState.emotionalTrust} />
              <Meter
                label="Resentment"
                value={threadState.resentment}
                tone={threadState.resentment > 60 ? "serious" : "warning"}
              />
            </PanelSection>

            <PanelSection
              icon={BriefcaseBusiness}
              title="Rapport breakdown"
              summary={`${relationship.score}/100 · ${relationship.spentCoins} coins`}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tier" value={humanizeValue(relationship.tier)} />
                <Field label="Spent" value={`${relationship.spentCoins} coins`} />
              </div>
              {relationship.contributions.length === 0 ? (
                <p className="text-[0.68rem] text-[var(--muted-foreground)]">Nothing has moved the score yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...relationship.contributions]
                    .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))
                    .map((entry) => (
                      <DivergingBar
                        key={entry.key}
                        label={entry.detail}
                        value={entry.points}
                        max={Math.max(...relationship.contributions.map((row) => Math.abs(row.points)), 1)}
                      />
                    ))}
                </div>
              )}
            </PanelSection>

            <PanelSection icon={Activity} title="Context" summary={availability.online ? "Available" : "Away"}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Availability" value={availability.online ? "Available" : "Away"} />
                <Field label="Activity" value={availability.activity ?? "Nothing recorded"} />
                {availability.minutesUntilOnline !== null && !availability.online && (
                  <Field
                    label="Back in"
                    value={
                      availability.minutesUntilOnline < 60
                        ? `~${Math.round(availability.minutesUntilOnline)}min`
                        : `~${Math.round(availability.minutesUntilOnline / 60)}hr`
                    }
                  />
                )}
                <Field label="Audience tone" value={humanizeValue(relationship.audienceTone)} />
                <Field
                  label="Pictures"
                  value={relationship.imageMode === "none" ? "Not now" : humanizeValue(relationship.imageMode)}
                />
              </div>
              <Field label="Day vibe" value={relationship.dayVibe ?? "An ordinary day"} />
            </PanelSection>

            {/* The table view every meter above is also readable from, and where the timestamps live. */}
            <PanelSection icon={Search} title="Exact values" summary="Every figure, as text">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                {(
                  [
                    ["Rapport", `${relationship.score}/100`],
                    ["Mood", String(mood)],
                    ["Energy", String(creatorState.energy)],
                    ["Arousal", String(creatorState.arousal)],
                    ["Exposure", String(creatorState.exposure)],
                    ["Emotion intensity", String(creatorState.emotionIntensity)],
                    ["Familiarity", String(threadState.familiarity)],
                    ["Sexual comfort", String(threadState.sexualComfort)],
                    ["Emotional trust", String(threadState.emotionalTrust)],
                    ["Respect", String(threadState.respect)],
                    ["Resentment", String(threadState.resentment)],
                    ["Conversation desire", String(threadState.threadDesire)],
                    ["Strikes", String(relationship.strikes)],
                    ["Spent", `${relationship.spentCoins} coins`],
                  ] as const
                ).map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-2 border-b border-[var(--noodle-divider)] py-0.5">
                    <dt className="text-[var(--muted-foreground)]">{term}</dt>
                    <dd className="font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[0.65rem] text-[var(--muted-foreground)]">
                Creator state updated {creatorState.updatedAt}. Conversation state updated {threadState.updatedAt}.
              </p>
            </PanelSection>
          </div>
        ) : (
          <div className="flex flex-col">
            <PanelSection icon={Sparkles} title="Right now" summary={humanizeValue(moodWord(mood))} defaultOpen>
              <DivergingBar
                label="How this conversation is going"
                value={mood}
                max={100}
                negativeLabel="Cold"
                positiveLabel="Warm"
                reading={humanizeValue(moodWord(mood))}
              />
              {cooling ? (
                <StatusRow
                  icon={Lock}
                  tone="warning"
                  title="Taking space from this conversation"
                  detail="Give them some time. They will pick it back up afterwards."
                />
              ) : (
                <StatusRow
                  icon={availability.online ? Check : Activity}
                  tone={availability.online ? "good" : "accent"}
                  title={availability.online ? "Around right now" : "Away right now"}
                  detail={
                    availability.activity ?? (availability.online ? undefined : "They will answer when they are back.")
                  }
                />
              )}
              {(modifiers.length > 0 || relationship.dayVibe) && (
                <div>
                  <p className="mb-1 text-[0.7rem] text-[var(--muted-foreground)]">What is going on for them today</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {modifiers.map((modifier) => (
                      <li
                        key={`${modifier.kind}-${modifier.until}`}
                        className="rounded-full bg-[color-mix(in_srgb,var(--noodle-accent)_15%,transparent)] px-2 py-0.5 text-[0.65rem] font-bold text-[var(--noodle-accent)]"
                      >
                        {humanizeValue(modifier.kind)}
                      </li>
                    ))}
                  </ul>
                  {relationship.dayVibe && (
                    <p className="mt-1.5 text-[0.68rem] leading-snug text-[var(--muted-foreground)]">
                      {relationship.dayVibe}
                    </p>
                  )}
                </div>
              )}
            </PanelSection>

            <PanelSection
              icon={ShieldCheck}
              title="What can happen here"
              summary={humanizeValue(threadState.adultLevel)}
              defaultOpen
            >
              <Stepper steps={ADULT_LEVELS} current={threadState.adultLevel} label="How far this has got" />
              <p className="text-[0.68rem] leading-snug text-[var(--muted-foreground)]">
                {ADULT_LEVEL_HINT[threadState.adultLevel]}
              </p>
              <StatusRow
                icon={blockedBy ? Lock : Heart}
                tone={blockedBy ? "warning" : "good"}
                title={blockedBy ? "This is as far as it goes for now" : "There is room for this to go further"}
                detail={
                  blockedBy
                    ? `${blockedBy} It moves when that does, and it never skips a step.`
                    : "It rises a step at a time, and only while they are somebody she wants and thinks well of."
                }
              />
              <StatusRow
                icon={Palette}
                tone={relationship.imageMode === "none" ? "accent" : "good"}
                title={
                  relationship.imageMode === "none" ? "Not sending pictures right now" : "Open to sending pictures"
                }
                detail={
                  relationship.imageMode === "none"
                    ? "This changes as the conversation warms up."
                    : "She will send one if the conversation calls for it."
                }
              />
            </PanelSection>

            <PanelSection
              icon={BriefcaseBusiness}
              title="Between you"
              summary={`${relationship.spentCoins} coins spent`}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Where you stand"
                  value={humanizeValue(relationship.tier)}
                  hint="It moves with time, conversation and what you have spent."
                />
                <Field label="Spent with them" value={`${relationship.spentCoins} coins`} />
              </div>
              {relationship.strikes > 0 && (
                <StatusRow
                  icon={Lock}
                  tone="warning"
                  title={`${relationship.strikes} strike${relationship.strikes === 1 ? "" : "s"} on this conversation`}
                  detail="Two inside a fortnight and they stop answering for good."
                />
              )}
            </PanelSection>
          </div>
        )}
      </div>

      {onReset && (
        <footer className="shrink-0 border-t border-[var(--noodle-divider)] p-3">
          <button
            type="button"
            disabled={resetting}
            onClick={onReset}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[0.7rem] font-bold text-red-600 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 dark:text-red-400"
          >
            <Trash2 size={14} aria-hidden="true" /> Clear conversation
          </button>
          <p className="mt-1.5 text-[0.65rem] text-[var(--muted-foreground)]">
            Deletes every message here and closes any unfinished commission. What they remember of you is kept, and so
            are coins, unlocks and finished commissions.
          </p>
        </footer>
      )}
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
