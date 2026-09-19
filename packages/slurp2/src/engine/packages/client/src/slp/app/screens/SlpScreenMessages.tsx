import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  Gift,
  Heart,
  Lock,
  MessageCircle,
  Search,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpEventGroup, SlurpEventItem } from "../../features/notifications/slp-notifications-contract";
import {
  useMarkSlurpNotificationsSeen,
  useSlurpNotifications,
} from "../../features/notifications/slp-notification-hooks";
import { useSlurpThreads } from "../../features/messages/slp-messages-hooks";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { NoodlerFrame } from "./SlpHomeHelpers";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlurpMessagesView } from "../../features/messages/SlpMessages";

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
  const { t: localizeUi, i18n } = useUiTranslation();
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
          defaultValue: "{{who}} · {{amount}} coins",
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
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="relative">
          <Search
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
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
            className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,var(--slurp-surface-raised),var(--slurp-surface))] ps-11 pe-4 text-base shadow-[var(--slurp-shadow-raised)] outline-none ring-1 ring-inset ring-white/[0.06] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
          />
        </div>

        {attention.length > 0 && (
          <section
            aria-labelledby="slurp-needs-attention"
            className="overflow-hidden rounded-2xl bg-[linear-gradient(145deg,var(--slurp-surface-raised),var(--slurp-surface))] p-2 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.065]"
          >
            <header className="flex items-center gap-2 px-2 pb-2 pt-1.5 sm:px-3">
              <div className="min-w-0 flex-1">
                <h2 id="slurp-needs-attention" className="text-sm font-black">
                  {localizeUi("ui.slurp.inbox.needsAttention", { defaultValue: "Needs attention" })}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.inbox.waiting", { defaultValue: "Things waiting for you" })}
                </p>
              </div>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--noodle-accent)]/14 px-2 text-[0.7rem] font-black tabular-nums text-[var(--noodle-accent)]">
                {attention.length}
              </span>
            </header>
            <div className="divide-y divide-white/[0.055]">
              {attention.slice(0, 3).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenMessages(item.threadId)}
                    className="group flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.055] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 sm:px-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
                      <Icon size={18} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">{item.context}</span>
                    </span>
                    <span className="hidden min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] sm:inline-flex">
                      {item.action}
                    </span>
                    <ChevronRight
                      size={17}
                      className="shrink-0 text-[var(--muted-foreground)] sm:hidden rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
            {attention.length > 3 && (
              <button
                type="button"
                onClick={() => onOpenMessages(null)}
                className="min-h-11 w-full rounded-xl px-3 text-start text-xs font-bold text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.055] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {localizeUi("ui.slurp.inbox.moreAttention", {
                  defaultValue: "{{count}} more requiring attention",
                  count: attention.length - 3,
                })}
              </button>
            )}
          </section>
        )}

        <div className="grid items-start gap-6 min-[58rem]:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
          <section aria-labelledby="slurp-inbox-messages" className="min-w-0">
            <header className="mb-3 flex min-h-11 items-center gap-2">
              <MessageCircle size={19} className="text-[var(--noodle-accent)]" aria-hidden="true" />
              <h2 id="slurp-inbox-messages" className="text-base font-black">
                {localizeUi("ui.slurp.inbox.messages", { defaultValue: "Messages" })}
              </h2>
              {unread > 0 && (
                <span className="rounded-full bg-[var(--noodle-accent)]/13 px-2 py-1 text-[0.68rem] font-bold tabular-nums text-[var(--noodle-accent)]">
                  {localizeUi("ui.slurp.inbox.unread", { defaultValue: "{{count}} unread", count: unread })}
                </span>
              )}
              <button
                type="button"
                onClick={() => onOpenMessages(null)}
                className="ms-auto min-h-11 rounded-lg px-2 text-xs font-bold text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {localizeUi("ui.slurp.inbox.seeAllMessages", { defaultValue: "See all messages" })}
              </button>
            </header>
            <div className="flex flex-col gap-2">
              {threadsQuery.isPending ? (
                <p className="rounded-2xl bg-[var(--slurp-surface)] px-5 py-8 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-white/[0.05]">
                  {localizeUi("ui.slurp.inbox.loadingMessages", { defaultValue: "Loading messages…" })}
                </p>
              ) : visibleThreads.length === 0 ? (
                <p className="rounded-2xl bg-[var(--slurp-surface)] px-5 py-8 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-white/[0.05]">
                  {needle
                    ? localizeUi("ui.slurp.inbox.noSearchResults", { defaultValue: "No matching conversations" })
                    : localizeUi("ui.slurp.messages.emptyTitle", { defaultValue: "No conversations yet" })}
                </p>
              ) : (
                visibleThreads.slice(0, 3).map((thread, index) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => onOpenMessages(thread.id)}
                    className={cn(
                      "flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl bg-[var(--slurp-surface)] px-3 py-2.5 text-start shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.05] transition-[background-color,transform] hover:bg-[var(--slurp-surface-raised)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
                      index === 2 && "max-[39rem]:hidden",
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar
                        account={{ displayName: thread.creatorDisplayName, avatarUrl: thread.creatorAvatarUrl }}
                        size="md"
                      />
                      <span className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 ring-2 ring-[var(--slurp-surface)]">
                        <MessageCircle size={11} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn("block truncate text-sm", thread.viewerUnread > 0 ? "font-black" : "font-bold")}
                      >
                        {thread.creatorDisplayName}
                      </span>
                      <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)]">
                        {thread.creatorHandle ? `@${thread.creatorHandle}` : ""}
                        {thread.inboxSide === "creator"
                          ? localizeUi("ui.slurp.inbox.toCreator", { defaultValue: " · To your Creator" })
                          : ""}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          thread.viewerUnread > 0 ? "font-semibold" : "text-[var(--muted-foreground)]",
                        )}
                      >
                        {thread.lastMessagePreview ||
                          localizeUi("ui.slurp.messages.noMessages", { defaultValue: "No messages yet" })}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 self-stretch py-1">
                      <time
                        dateTime={thread.lastMessageAt}
                        className="text-[0.65rem] tabular-nums text-[var(--muted-foreground)]"
                      >
                        {formatTime(thread.lastMessageAt, i18n.language)}
                      </time>
                      {thread.viewerUnread > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[0.65rem] font-black tabular-nums text-zinc-950 [&_svg]:!text-zinc-950">
                          {thread.viewerUnread}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
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
  initialActivity,
  onBack,
  leaveOnExit = false,
  onOpenProfile,
}: {
  personaId: string | null;
  ownedCreatorAccountIds: string[];
  composeWithCreatorAccountId: string | null;
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
    <NoodlerFrame
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
            initialThreadId={selectedThreadId}
            ownedCreatorAccountIds={ownedCreatorAccountIds}
            onOpenProfile={onOpenProfile}
            onConversationOpenChange={setThreadOpen}
            onExit={closeWorkspace}
            exitTitle={localizeUi("ui.slurp.inbox.messagesTitle", { defaultValue: "Messages" })}
            workspace
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
    </NoodlerFrame>
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
  const { t: localizeUi, i18n } = useUiTranslation();
  const notificationsQuery = useSlurpNotifications(personaId);
  const { mutate: markSeen } = useMarkSlurpNotificationsSeen();
  const unseen = notificationsQuery.data?.unseen ?? [];
  const items = notificationsQuery.data?.items ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const unseenIds = new Set(unseen.flatMap((entry) => (entry.type === "single" ? [entry.event.id] : entry.ids)));
  const describeEvent = (event: SlurpEventItem) => {
    const { kind, amount, actorLabel } = event;
    const line = localizeUi(`ui.slurp.events.single.${kind}`, {
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
          defaultValue: "{{count}} coins received",
          count: group.total,
        })
      : localizeUi(`ui.slurp.events.group.${group.kind}`, {
          defaultValue: "{{count}} new updates",
          count: group.count,
          total: group.total,
        });

  const eventAppearance = (kind: string): { icon: LucideIcon; tone: string } => {
    if (kind === "message" || kind === "commission_requested")
      return { icon: MessageCircle, tone: "bg-[var(--noodle-accent)]/14 text-[var(--noodle-accent)]" };
    if (kind === "comment" || kind === "returned" || kind === "audience_arc")
      return { icon: Heart, tone: "bg-sky-500/14 text-sky-300" };
    if (kind === "arc_phase" || kind === "arc_complete" || kind === "arc_started")
      return { icon: Star, tone: "bg-amber-500/14 text-amber-300" };
    if (kind === "tip") return { icon: Coins, tone: "bg-emerald-500/14 text-emerald-300" };
    if (kind === "unlock" || kind === "ppv_unlock") return { icon: Lock, tone: "bg-violet-500/14 text-violet-300" };
    if (kind === "subscribed") return { icon: Crown, tone: "bg-fuchsia-500/14 text-fuchsia-300" };
    if (kind === "milestone") return { icon: Star, tone: "bg-amber-500/14 text-amber-300" };
    if (kind === "commission_accepted") return { icon: Gift, tone: "bg-emerald-500/14 text-emerald-300" };
    return { icon: Bell, tone: "bg-white/[0.06] text-[var(--muted-foreground)]" };
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
      ...events.map((event) => `${event.actorLabel ?? ""} ${describeEvent(event)}`),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });

  const render = (groups: SlurpEventGroup[]) =>
    groups.map((group) => {
      const key = group.type === "single" ? group.event.id : `${group.kind}-${group.ids.length}`;
      const at = group.type === "single" ? group.event.createdAt : group.latestAt;
      if (group.type === "group") {
        const isOpen = expanded.has(key);
        const regionId = `slurp-activity-group-${group.kind}-${group.ids[0]}`;
        const avatars = group.events.slice(0, 3);
        return (
          <li key={key} className="relative isolate pt-1.5">
            <span
              className="pointer-events-none absolute inset-x-3 top-0 h-4 rounded-t-xl bg-[var(--slurp-surface)]/45 ring-1 ring-inset ring-white/[0.035]"
              aria-hidden="true"
            />
            <div className="relative overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.055]">
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
                className="flex min-h-[4.5rem] w-full items-center gap-3 px-3 py-2.5 text-start transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.045] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <span className="flex w-[4.25rem] shrink-0 -space-x-3 rtl:space-x-reverse">
                  {avatars.map((event) => {
                    const appearance = eventAppearance(event.kind);
                    const EventIcon = appearance.icon;
                    return event.actorAvatarUrl ? (
                      <span key={event.id} className="rounded-full ring-2 ring-[var(--slurp-surface)]">
                        <Avatar
                          account={{ displayName: event.actorLabel ?? "", avatarUrl: event.actorAvatarUrl }}
                          size="xs"
                        />
                      </span>
                    ) : (
                      <span
                        key={event.id}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-[var(--slurp-surface)]",
                          appearance.tone,
                        )}
                      >
                        <EventIcon size={14} aria-hidden="true" />
                      </span>
                    );
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{groupTitle(group.kind)}</span>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[0.65rem] font-black tabular-nums text-[var(--muted-foreground)]">
                      {group.count}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">{groupSummary(group)}</span>
                </span>
                <ChevronDown
                  size={17}
                  className={cn(
                    "shrink-0 text-[var(--muted-foreground)] transition-transform motion-reduce:transition-none",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <ul
                  id={regionId}
                  className="divide-y divide-white/[0.055] border-t border-[var(--noodle-divider)] px-2"
                >
                  {group.events.map((event) => {
                    const appearance = eventAppearance(event.kind);
                    const EventIcon = appearance.icon;
                    const destination = event.creatorAccountId ? () => onOpenProfile(event.creatorAccountId!) : null;
                    const row = (
                      <>
                        {event.actorAvatarUrl ? (
                          <Avatar
                            account={{ displayName: event.actorLabel ?? "", avatarUrl: event.actorAvatarUrl }}
                            size="xs"
                          />
                        ) : (
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              appearance.tone,
                            )}
                          >
                            <EventIcon size={14} aria-hidden="true" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 text-xs font-semibold leading-5">{describeEvent(event)}</span>
                        <time
                          dateTime={event.createdAt}
                          className="shrink-0 text-[0.65rem] tabular-nums text-[var(--muted-foreground)]"
                        >
                          {formatTime(event.createdAt, i18n.language)}
                        </time>
                        {destination && (
                          <ChevronRight
                            size={14}
                            className="shrink-0 text-[var(--muted-foreground)] rtl:-scale-x-100"
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
                            className="flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.045] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                          >
                            {row}
                          </button>
                        ) : (
                          <div className="flex min-h-12 items-center gap-2.5 px-2 py-2">{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </li>
        );
      }
      const actionable = group.event.kind === "commission_requested";
      const creatorId = group.event.creatorAccountId;
      const destination = actionable
        ? () => onOpenMessages(group.event.subjectId)
        : creatorId
          ? () => onOpenProfile(creatorId)
          : null;
      const appearance = eventAppearance(group.event.kind);
      const EventIcon = appearance.icon;
      const content = (
        <>
          <span className="flex min-w-0 items-start gap-2.5">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", appearance.tone)}>
              <EventIcon size={17} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="min-w-0 pt-0.5 text-sm font-semibold leading-5">{describeEvent(group.event)}</span>
          </span>
          <time dateTime={at} className="shrink-0 text-[0.65rem] tabular-nums text-[var(--muted-foreground)]">
            {formatTime(at, i18n.language)}
          </time>
        </>
      );
      return (
        <li key={key}>
          {destination ? (
            <button
              type="button"
              onClick={destination}
              className="flex min-h-14 w-full items-start justify-between gap-3 px-2 py-2.5 text-start transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.055] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {content}
            </button>
          ) : (
            <div className="flex min-h-14 w-full items-start justify-between gap-3 px-2 py-2.5">{content}</div>
          )}
        </li>
      );
    });

  const content = (
    <div className="flex w-full flex-col">
      <header className="mb-3 flex min-h-11 items-center gap-2">
        <Bell size={19} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        <h2 id="slurp-inbox-activity" className="text-base font-black">
          {localizeUi("ui.slurp.inbox.activityTitle", { defaultValue: "Activity" })}
        </h2>
        {unseen.length > 0 && personaId && (
          <button
            type="button"
            onClick={() => markSeen(personaId)}
            className="ms-auto min-h-11 rounded-lg px-2 text-xs font-bold text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {localizeUi("ui.slurp.events.markAllRead", { defaultValue: "Mark as read" })}
          </button>
        )}
      </header>
      {notificationsQuery.isPending ? (
        <p className="rounded-2xl bg-[var(--slurp-surface)] px-5 py-8 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-white/[0.05]">
          {localizeUi("ui.slurp.inbox.loadingActivity", { defaultValue: "Loading activity…" })}
        </p>
      ) : visibleGroups.length === 0 ? (
        <p className="rounded-2xl bg-[var(--slurp-surface)] px-5 py-8 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-white/[0.05]">
          {localizeUi("ui.slurp.events.empty", {
            defaultValue: "Nothing has happened yet. Post something and give the audience a reason.",
          })}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">{render(visibleGroups)}</ul>
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
    <NoodlerFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.notifications")} action={<span />}>
      {content}
    </NoodlerFrame>
  );
}

export { SlurpInboxHub, SlurpInboxView, SlurpNotificationsView };
