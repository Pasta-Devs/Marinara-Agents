import { SlpCoinText, slpCoinPlainText } from "../../modules/coin/SlpCoin";
import { SlpTimestamp } from "../../base/ui/SlpTimestamp";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Coins,
  Radio,
  Crown,
  Gift,
  MessageCircle,
  Search,
  Clapperboard,
  Star,
} from "lucide-react";
import { SlpHeartGlyph, SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import type { LucideIcon } from "lucide-react";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  SlpFanNoteActions,
  type SlurpEventGroup,
  type SlurpEventItem,
} from "../../features/notifications/slp-notifications-contract";
import {
  useMarkSlurpNotificationsSeen,
  useSlurpNotifications,
} from "../../features/notifications/slp-notification-hooks";
import { useSlurpThreads } from "../../features/messages/slp-messages-hooks";
import { cn } from "../../../lib/utils";
import {
  Avatar,
  SLP_EYEBROW_CLASS,
  SLP_GROUP_CLASS,
  SLP_PAGE_SCROLL_CLASS,
  SLP_SEARCH_FIELD_CLASS,
} from "../../base/chrome/SlpChrome";
import { SlpButton, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpCreatorFrame } from "./SlpHomeHelpers";
import { SlurpMessagesView, ThreadRow } from "../../features/messages/SlpMessages";

/** How many conversations the Inbox hub lists before "N more". */
const INBOX_HUB_THREADS = 12;

function SlurpInboxHub({
  personaId,
  initialActivity,
  onOpenMessages,
  onOpenProfile,
}: {
  personaId: string | null;
  initialActivity: boolean;
  onOpenMessages: (threadId?: string | null) => void;
  onOpenProfile: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const threadsQuery = useSlurpThreads(personaId);
  const [search, setSearch] = useState("");
  const activityRef = useRef<HTMLElement | null>(null);
  const viewerThreads = threadsQuery.data?.threads ?? [];
  const inboundThreads = (threadsQuery.data?.inbound ?? []).map((thread) => ({
    ...thread,
    creatorDisplayName:
      thread.counterpartName ?? localizeUi("ui.slurp.messages.unknownFan", { defaultValue: "Someone" }),
    creatorHandle: thread.counterpartHandle ?? "",
    creatorAvatarUrl: null,
    viewerUnread: thread.creatorUnread,
    inboxSide: "creator" as const,
  }));
  const allThreads = [
    ...viewerThreads.map((thread) => ({ ...thread, inboxSide: "viewer" as const })),
    ...inboundThreads,
  ].sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
  const needle = search.trim().toLocaleLowerCase();
  const visibleThreads = allThreads.filter((thread) =>
    `${thread.creatorDisplayName} ${thread.creatorHandle} ${thread.lastMessagePreview}`
      .toLocaleLowerCase()
      .includes(needle),
  );
  const attentionCommissions = threadsQuery.data?.attentionCommissions ?? [];
  const commissionThreadIds = new Set(attentionCommissions.map((commission) => commission.threadId));
  const requestRows = inboundThreads.filter((thread) => thread.state === "request");
  const attention = [
    ...requestRows.map((thread) => ({
      id: `request-${thread.id}`,
      threadId: thread.id,
      icon: MessageCircle,
      title: localizeUi("ui.slurp.inbox.messageRequest", { defaultValue: "Message request" }),
      context: localizeUi("ui.slurp.inbox.messageRequestContext", {
        defaultValue: "{{who}} wrote to your Creator",
        who: thread.creatorDisplayName,
      }),
      action: localizeUi("ui.slurp.inbox.review", { defaultValue: "Review" }),
    })),
    ...attentionCommissions.map((commission) => {
      const thread = allThreads.find((candidate) => candidate.id === commission.threadId);
      const creatorSide = commission.side === "creator";
      const title = creatorSide
        ? commission.state === "brief"
          ? localizeUi("ui.slurp.inbox.commissionNeedsQuote", { defaultValue: "Commission needs a quote" })
          : localizeUi("ui.slurp.inbox.commissionReady", { defaultValue: "Commission ready to deliver" })
        : localizeUi("ui.slurp.inbox.commissionQuoted", { defaultValue: "Commission quote received" });
      return {
        id: `commission-${commission.id}`,
        threadId: commission.threadId,
        icon: BriefcaseBusiness,
        title,
        context: localizeUi("ui.slurp.inbox.commissionContext", {
          defaultValue: "{{who}} · {{amount}} <coin/>",
          who: thread?.creatorDisplayName ?? localizeUi("ui.slurp.events.someone", { defaultValue: "Someone" }),
          amount: commission.price,
        }),
        action: localizeUi("ui.slurp.inbox.openChat", { defaultValue: "Open chat" }),
      };
    }),
  ];
  const unread = (threadsQuery.data?.unread ?? 0) + (threadsQuery.data?.inboundUnread ?? 0);

  useEffect(() => {
    if (!initialActivity) return;
    activityRef.current?.scrollIntoView({ block: "start" });
    activityRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [initialActivity]);

  return (
    <div className={cn("h-full overflow-y-auto px-3 py-4 sm:px-5 sm:py-5", SLP_PAGE_SCROLL_CLASS)}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
          />
          <label className="sr-only" htmlFor="slurp-inbox-search">
            {localizeUi("ui.slurp.inbox.searchLabel", { defaultValue: "Search inbox" })}
          </label>
          <input
            id="slurp-inbox-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizeUi("ui.slurp.inbox.searchPlaceholder", {
              defaultValue: "Search messages and activity…",
            })}
            className={SLP_SEARCH_FIELD_CLASS}
          />
        </div>

        {attention.length > 0 && (
          <section aria-labelledby="slurp-needs-attention" className="flex flex-col gap-2">
            <header className="flex items-center gap-2 px-1">
              <h2 id="slurp-needs-attention" className={SLP_EYEBROW_CLASS}>
                {localizeUi("ui.slurp.inbox.needsAttention", { defaultValue: "Needs attention" })}
              </h2>
              <span className={slpTagClass(true)}>{attention.length}</span>
            </header>
            <div className={SLP_GROUP_CLASS}>
              {attention.slice(0, 3).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenMessages(item.threadId)}
                    className="flex min-h-[4.25rem] w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)]">
                      <Icon size={20} aria-hidden="true" className="!text-current" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold leading-5">{item.title}</span>
                      <span className="block truncate text-[13px] leading-[19px] text-[var(--slurp-muted)]">
                        <SlpCoinText>{item.context}</SlpCoinText>
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-[13px] font-semibold text-[var(--slurp-ink)] sm:inline">
                      {item.action}
                    </span>
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-[var(--slurp-muted)] sm:hidden rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
              {attention.length > 3 && (
                <button
                  type="button"
                  onClick={() => onOpenMessages(null)}
                  className="min-h-11 w-full px-4 text-start text-[13px] font-semibold text-[var(--slurp-ink)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
                >
                  {localizeUi("ui.slurp.inbox.moreAttention", {
                    defaultValue: "{{count}} more requiring attention",
                    count: attention.length - 3,
                  })}
                </button>
              )}
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 min-[58rem]:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
          <section aria-labelledby="slurp-inbox-messages" className="flex min-w-0 flex-col gap-2">
            <header className="flex min-h-11 items-center gap-2 ps-1">
              <h2 id="slurp-inbox-messages" className={SLP_EYEBROW_CLASS}>
                {localizeUi("ui.slurp.inbox.messages", { defaultValue: "Messages" })}
              </h2>
              {unread > 0 && (
                <span className={slpTagClass(true)}>
                  {localizeUi("ui.slurp.inbox.unread", { defaultValue: "{{count}} unread", count: unread })}
                </span>
              )}
              <SlpButton variant="tertiary" onClick={() => onOpenMessages(null)} className="ms-auto text-[13px]">
                {localizeUi("ui.slurp.inbox.seeAllMessages", { defaultValue: "See all messages" })}
              </SlpButton>
            </header>
            {threadsQuery.isPending ? (
              <SlpSkeleton
                count={3}
                label={localizeUi("ui.slurp.inbox.loadingMessages", { defaultValue: "Loading messages…" })}
              />
            ) : threadsQuery.isError && !threadsQuery.data ? (
              <SlpErrorState
                title={localizeUi("ui.slurp.messages.loadError", { defaultValue: "Could not load your messages" })}
                onRetry={() => void threadsQuery.refetch()}
              />
            ) : visibleThreads.length === 0 ? (
              <SlpEmptyState
                icon={MessageCircle}
                title={
                  needle
                    ? localizeUi("ui.slurp.inbox.noSearchResults", { defaultValue: "No matching conversations" })
                    : localizeUi("ui.slurp.messages.emptyTitle", { defaultValue: "No conversations yet" })
                }
                detail={
                  needle
                    ? undefined
                    : localizeUi("ui.slurp.messages.emptyDetail", {
                        defaultValue: "Open a Creator profile and send a message to start one.",
                      })
                }
              />
            ) : (
              <div className={SLP_GROUP_CLASS}>
                {/* The newest conversations, not just three: the hub is where a chat is picked up again. */}
                {visibleThreads.slice(0, INBOX_HUB_THREADS).map((thread) => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    toCreator={thread.inboxSide === "creator"}
                    onOpen={() => onOpenMessages(thread.id)}
                  />
                ))}
                {visibleThreads.length > INBOX_HUB_THREADS && (
                  <button
                    type="button"
                    onClick={() => onOpenMessages(null)}
                    className="min-h-11 w-full px-4 text-start text-[13px] font-semibold text-[var(--slurp-ink)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
                  >
                    {localizeUi("ui.slurp.inbox.moreConversations", {
                      defaultValue: "{{count}} more conversations",
                      count: visibleThreads.length - INBOX_HUB_THREADS,
                    })}
                  </button>
                )}
              </div>
            )}
          </section>

          <section ref={activityRef} aria-labelledby="slurp-inbox-activity" className="min-w-0 scroll-mt-4">
            <SlurpNotificationsView
              personaId={personaId}
              onBack={() => undefined}
              onOpenMessages={onOpenMessages}
              onOpenProfile={onOpenProfile}
              embedded
              search={search}
              hiddenSubjectIds={commissionThreadIds}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function SlurpInboxView({
  personaId,
  ownedCreatorAccountIds,
  composeWithCreatorAccountId,
  composeAsSupport = false,
  initialActivity,
  onBack,
  leaveOnExit = false,
  onOpenProfile,
  onOpenDesk,
}: {
  /** The Stir tab's Support desk (docs/SUPPORT-DESK.md). */
  onOpenDesk?: () => void;
  personaId: string | null;
  ownedCreatorAccountIds: string[];
  composeWithCreatorAccountId: string | null;
  /** Open that Creator's Slurp Support thread (W). */
  composeAsSupport?: boolean;
  initialActivity: boolean;
  onBack: () => void;
  /** Closing the chat leaves Messages entirely, back to wherever it was opened from. */
  leaveOnExit?: boolean;
  onOpenProfile: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [workspaceOpen, setWorkspaceOpen] = useState(Boolean(composeWithCreatorAccountId));
  const [composeCreatorId, setComposeCreatorId] = useState(composeWithCreatorAccountId);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const closeWorkspace = () => {
    if (leaveOnExit) return onBack();
    setWorkspaceOpen(false);
    setComposeCreatorId(null);
    setSelectedThreadId(null);
  };
  const openMessages = (threadId: string | null = null) => {
    setComposeCreatorId(null);
    setSelectedThreadId(threadId);
    setWorkspaceOpen(true);
  };

  useEffect(() => {
    if (composeWithCreatorAccountId) {
      setComposeCreatorId(composeWithCreatorAccountId);
      setWorkspaceOpen(true);
    }
  }, [composeWithCreatorAccountId]);

  return (
    <SlpCreatorFrame
      onBack={workspaceOpen ? closeWorkspace : onBack}
      title={localizeUi(workspaceOpen ? "ui.slurp.inbox.messagesTitle" : "ui.slurp.navigation.messages", {
        defaultValue: workspaceOpen ? "Messages" : "Inbox",
      })}
      action={<span />}
      // The workspace owns its own title bar, so the frame's would be a second one above it.
      hideHeader={workspaceOpen}
      hideHeaderOnMobile={threadOpen}
    >
      <div className="h-full min-h-0">
        {workspaceOpen ? (
          <SlurpMessagesView
            personaId={personaId}
            composeWithCreatorAccountId={composeCreatorId}
            composeAsSupport={composeAsSupport && composeCreatorId === composeWithCreatorAccountId}
            initialThreadId={selectedThreadId}
            ownedCreatorAccountIds={ownedCreatorAccountIds}
            onOpenProfile={onOpenProfile}
            onConversationOpenChange={setThreadOpen}
            onExit={closeWorkspace}
            exitTitle={localizeUi("ui.slurp.inbox.messagesTitle", { defaultValue: "Messages" })}
            workspace
            onOpenDesk={onOpenDesk}
          />
        ) : (
          <SlurpInboxHub
            personaId={personaId}
            initialActivity={initialActivity}
            onOpenMessages={openMessages}
            onOpenProfile={onOpenProfile}
          />
        )}
      </div>
    </SlpCreatorFrame>
  );
}

/**
 * The notification stream, and what happened while you were away.
 *
 * Slurp reported nothing that happened: there was an unseen-post count and DM unread counts, and
 * no surface for a subscriber, a tip, an unlock, or a loss. The world could be made as alive as
 * you like and the player would still see none of it.
 *
 * Activity stays subordinate to direct messages in the Inbox hub. Repeated low-priority events
 * expand in place, while read state only changes through an explicit action or destination visit.
 */
function SlurpNotificationsView({
  personaId,
  onBack,
  onOpenMessages,
  onOpenProfile,
  embedded = false,
  search = "",
  hiddenSubjectIds = new Set<string>(),
}: {
  personaId: string | null;
  onBack: () => void;
  onOpenMessages: (threadId: string | null) => void;
  onOpenProfile: (accountId: string) => void;
  embedded?: boolean;
  search?: string;
  hiddenSubjectIds?: ReadonlySet<string>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const notificationsQuery = useSlurpNotifications(personaId);
  const { mutate: markSeen } = useMarkSlurpNotificationsSeen();
  const unseen = notificationsQuery.data?.unseen ?? [];
  const items = notificationsQuery.data?.items ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const unseenIds = new Set(unseen.flatMap((entry) => (entry.type === "single" ? [entry.event.id] : entry.ids)));
  const navigation = useSlurpUIStore((state) => state.navigation);
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);
  // "X is live" opens the show itself, not the Creator's page.
  const openLive = (event: SlurpEventItem) =>
    event.kind === "live" && event.subjectId
      ? () => setNavigation({ mode: "creator", view: "live", showId: event.subjectId!, returnTo: navigation })
      : null;
  const describeEvent = (event: SlurpEventItem) => {
    const { kind, amount, actorLabel } = event;
    // A fan's direction change names its direction: burning out or getting too attached is not
    // "getting more into your posts" (R1-085).
    const arcKey =
      kind === "audience_arc" && (event.subjectId === "burnout" || event.subjectId === "overattached")
        ? `ui.slurp.events.single.audience_arc_${event.subjectId}`
        : kind === "subscribed" && event.subjectId === "renewed"
          ? "ui.slurp.events.single.subscribed_renewed"
          : kind === "couple"
            ? `ui.slurp.events.single.couple_${event.subjectId ?? "date"}`
            : `ui.slurp.events.single.${kind}`;
    // A drama's line is the pack's own words, already about someone: shown as it is.
    if (kind === "drama" && event.note) return event.note;
    const line = localizeUi(arcKey, {
      defaultValue: kind,
      amount,
      who: actorLabel ?? localizeUi("ui.slurp.events.someone", { defaultValue: "Someone" }),
    });
    // The free bank's line, when the event carries one. A loss that says why it happened is an
    // event; the same loss without it is a number moving.
    return event.note ? `${line} “${event.note}”` : line;
  };

  const groupTitle = (kind: SlurpEventItem["kind"]) =>
    localizeUi(`ui.slurp.events.category.${kind}`, {
      defaultValue:
        kind === "tip"
          ? "Tips"
          : kind === "subscribed" || kind === "lapsed" || kind === "returned"
            ? "Subscriptions"
            : kind === "unlock" || kind === "ppv_unlock"
              ? "Paid post unlocks"
              : kind === "comment"
                ? "Comments"
                : "Activity",
    });

  const groupSummary = (group: Extract<SlurpEventGroup, { type: "group" }>) =>
    group.total > 0
      ? localizeUi("ui.slurp.events.coinsReceived", {
          defaultValue: "{{count}} <coin/> received",
          count: group.total,
        })
      : localizeUi(`ui.slurp.events.group.${group.kind}`, {
          defaultValue: "{{count}} new updates",
          count: group.count,
          total: group.total,
        });

  // Semantic tints only (tokens, no raw palette): money warm, everything else Slurp pink or quiet.
  const eventAppearance = (kind: string): { icon: LucideIcon; tone: string } => {
    const pink = "bg-[var(--slurp-tint)] text-[var(--slurp-ink)]";
    const warm = "bg-[color-mix(in_srgb,var(--slurp-warm)_14%,transparent)] text-[var(--slurp-warm)]";
    const violet = "bg-[color-mix(in_srgb,var(--slurp-violet)_14%,transparent)] text-[var(--slurp-violet)]";
    if (kind === "message" || kind === "commission_requested") return { icon: MessageCircle, tone: pink };
    if (kind === "comment" || kind === "returned" || kind === "audience_arc")
      return { icon: SlpHeartGlyph, tone: pink };
    if (kind === "arc_phase" || kind === "arc_complete" || kind === "arc_started") return { icon: Star, tone: violet };
    if (kind === "drama") return { icon: Clapperboard, tone: violet };
    if (kind === "couple") return { icon: SlpHeartGlyph, tone: pink };
    if (kind === "fan_note") return { icon: MessageCircle, tone: pink };
    if (kind === "sign_up") return { icon: Star, tone: violet };
    if (kind === "tip") return { icon: Coins, tone: warm };
    if (kind === "live") return { icon: Radio, tone: pink };
    if (kind === "unlock" || kind === "ppv_unlock") return { icon: SlpLockGlyph, tone: warm };
    if (kind === "subscribed") return { icon: Crown, tone: pink };
    if (kind === "milestone") return { icon: Star, tone: violet };
    if (kind === "commission_accepted") return { icon: Gift, tone: warm };
    return { icon: Bell, tone: "bg-[var(--accent)] text-[var(--slurp-muted)]" };
  };

  const activityGroups = items.flatMap<SlurpEventGroup>((group) => {
    const events = (group.type === "single" ? [group.event] : group.events).filter(
      (event) => event.kind !== "message" && !(event.subjectId && hiddenSubjectIds.has(event.subjectId)),
    );
    if (events.length === 0) return [];
    if (events.length === 1) return [{ type: "single", event: events[0]! }];
    return [
      {
        type: "group",
        kind: events[0]!.kind,
        count: events.length,
        total: events.reduce((sum, event) => sum + Math.max(0, event.amount), 0),
        latestAt: events.reduce(
          (latest, event) => (event.createdAt > latest ? event.createdAt : latest),
          events[0]!.createdAt,
        ),
        ids: events.map((event) => event.id),
        events,
      },
    ];
  });
  const visibleGroups = activityGroups.filter((group) => {
    const events = group.type === "single" ? [group.event] : group.events;
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return true;
    const haystack = [
      group.type === "group" ? groupTitle(group.kind) : "",
      ...events.map((event) => `${event.actorLabel ?? ""} ${slpCoinPlainText(describeEvent(event))}`),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });

  const render = (groups: SlurpEventGroup[]) =>
    groups.map((group) => {
      // One group per kind (`groupSlurpEvents`). The count in the key closed an open group each
      // time the poll added an event to it.
      const key = group.type === "single" ? group.event.id : `group-${group.kind}`;
      const at = group.type === "single" ? group.event.createdAt : group.latestAt;
      if (group.type === "group") {
        const isOpen = expanded.has(key);
        const regionId = `slurp-activity-group-${group.kind}-${group.ids[0]}`;
        const avatars = group.events.slice(0, 3);
        return (
          <li key={key}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={regionId}
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              className="flex min-h-[4.25rem] w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
            >
              <span className="flex w-[4.25rem] shrink-0 -space-x-3 rtl:space-x-reverse">
                {avatars.map((event) => {
                  const appearance = eventAppearance(event.kind);
                  const EventIcon = appearance.icon;
                  return event.actorAvatarUrl ? (
                    <span key={event.id} className="rounded-full ring-2 ring-[var(--slurp-surface-raised)]">
                      <Avatar
                        account={{ displayName: event.actorLabel ?? "", avatarUrl: event.actorAvatarUrl }}
                        size="sm"
                      />
                    </span>
                  ) : (
                    <span
                      key={event.id}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-[var(--slurp-surface-raised)] [&_svg]:!text-current",
                        appearance.tone,
                      )}
                    >
                      <EventIcon size={16} aria-hidden="true" />
                    </span>
                  );
                })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-bold leading-5">{groupTitle(group.kind)}</span>
                  <span className={slpTagClass()}>{group.count}</span>
                </span>
                <span className="block truncate text-[13px] leading-[19px] text-[var(--slurp-muted)]">
                  <SlpCoinText>{groupSummary(group)}</SlpCoinText>
                </span>
              </span>
              <ChevronDown
                size={18}
                className={cn(
                  "shrink-0 text-[var(--slurp-muted)] transition-transform motion-reduce:transition-none",
                  isOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
              <ul id={regionId} className="divide-y divide-[var(--noodle-divider)] bg-[var(--slurp-surface)]/50 ps-6">
                {group.events.map((event) => {
                  const appearance = eventAppearance(event.kind);
                  const EventIcon = appearance.icon;
                  const destination =
                    openLive(event) ?? (event.creatorAccountId ? () => onOpenProfile(event.creatorAccountId!) : null);
                  const row = (
                    <>
                      {event.actorAvatarUrl ? (
                        <Avatar
                          account={{ displayName: event.actorLabel ?? "", avatarUrl: event.actorAvatarUrl }}
                          size="sm"
                        />
                      ) : (
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:!text-current",
                            appearance.tone,
                          )}
                        >
                          <EventIcon size={16} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-[13px] leading-[19px]">
                        <SlpCoinText>{describeEvent(event)}</SlpCoinText>
                      </span>
                      <SlpTimestamp
                        value={event.createdAt}
                        className="shrink-0 text-xs tabular-nums text-[var(--slurp-muted)]"
                      />
                      {destination && (
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-[var(--slurp-muted)] rtl:-scale-x-100"
                          aria-hidden="true"
                        />
                      )}
                    </>
                  );
                  return (
                    <li key={event.id}>
                      {destination ? (
                        <button
                          type="button"
                          onClick={destination}
                          className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
                        >
                          {row}
                        </button>
                      ) : (
                        <div className="flex min-h-12 items-center gap-2.5 px-3 py-2">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      }
      const actionable = group.event.kind === "commission_requested";
      const fanNote = group.event.kind === "fan_note";
      const creatorId = group.event.creatorAccountId;
      const destination =
        openLive(group.event) ??
        (actionable
          ? () => onOpenMessages(group.event.subjectId)
          : creatorId && !fanNote
            ? () => onOpenProfile(creatorId)
            : null);
      const appearance = eventAppearance(group.event.kind);
      const EventIcon = appearance.icon;
      const content = (
        <>
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full [&_svg]:!text-current",
              appearance.tone,
            )}
          >
            <EventIcon size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-[13px] leading-[19px]">
            <SlpCoinText>{describeEvent(group.event)}</SlpCoinText>
            {fanNote && personaId && <SlpFanNoteActions event={group.event} personaId={personaId} />}
          </span>
          <SlpTimestamp
            value={at}
            className="shrink-0 self-start pt-0.5 text-xs tabular-nums text-[var(--slurp-muted)]"
          />
        </>
      );
      const unseenRow = unseenIds.has(group.event.id);
      const rowClass = cn(
        "flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-start",
        unseenRow && "font-semibold",
      );
      return (
        <li key={key}>
          {destination ? (
            <button
              type="button"
              onClick={destination}
              className={cn(
                rowClass,
                "transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
              )}
            >
              {content}
            </button>
          ) : (
            <div className={rowClass}>{content}</div>
          )}
        </li>
      );
    });

  const content = (
    <div className="flex w-full flex-col gap-2">
      <header className="flex min-h-11 items-center gap-2 ps-1">
        <h2 id="slurp-inbox-activity" className={SLP_EYEBROW_CLASS}>
          {localizeUi("ui.slurp.inbox.activityTitle", { defaultValue: "Activity" })}
        </h2>
        {unseen.length > 0 && personaId && (
          <SlpButton variant="tertiary" onClick={() => markSeen(personaId)} className="ms-auto text-[13px]">
            {localizeUi("ui.slurp.events.markAllRead", { defaultValue: "Mark as read" })}
          </SlpButton>
        )}
      </header>
      {notificationsQuery.isPending ? (
        <SlpSkeleton label={localizeUi("ui.slurp.inbox.loadingActivity", { defaultValue: "Loading activity…" })} />
      ) : notificationsQuery.isError && !notificationsQuery.data ? (
        <SlpErrorState
          title={localizeUi("ui.slurp.inbox.activityError", { defaultValue: "Could not load your activity" })}
          onRetry={() => void notificationsQuery.refetch()}
        />
      ) : visibleGroups.length === 0 ? (
        <SlpEmptyState
          icon={Bell}
          title={localizeUi("ui.slurp.events.empty", {
            defaultValue: "Nothing has happened yet. Post something and give the audience a reason.",
          })}
        />
      ) : (
        <ul className={SLP_GROUP_CLASS}>{render(visibleGroups)}</ul>
      )}
      <span className="sr-only" aria-live="polite">
        {unseenIds.size > 0
          ? localizeUi("ui.slurp.inbox.unreadActivity", {
              defaultValue: "{{count}} unread activity items",
              count: unseenIds.size,
            })
          : ""}
      </span>
    </div>
  );
  if (embedded) return content;
  return (
    <SlpCreatorFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.notifications")} action={<span />}>
      {content}
    </SlpCreatorFrame>
  );
}

export { SlurpInboxHub, SlurpInboxView, SlurpNotificationsView };
