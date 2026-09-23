import { Activity, CheckCircle2, ChevronDown, CircleAlert, Loader2, Settings2, X } from "lucide-react";
import { useMutationState, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { type ReactNode, type RefObject, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { Avatar } from "../../base/chrome/SlpChrome";
import { api } from "../../../lib/api-client.js";
import { cn } from "../../../lib/utils";

export function SlpPulseCard({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const { t } = useUiTranslation();
  const serverTasks = useSlpPulseTasks();
  const activeCount = serverTasks.data?.tasks.filter((task) => isActiveTask(task.status)).length ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={open}
      aria-controls="slurp-pulse-panel"
      className="group relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised))] px-3 text-start ring-1 ring-inset ring-[var(--noodle-accent)]/18 transition-[background-color,transform,box-shadow] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center text-[var(--noodle-accent)]">
        {activeCount > 0 && (
          <>
            <span className="absolute h-7 w-7 rounded-full border border-[var(--noodle-accent)]/18 motion-safe:animate-ping motion-reduce:animate-none" />
            <span className="absolute h-9 w-9 rounded-full border border-[var(--noodle-accent)]/10 motion-safe:animate-[ping_1.8s_cubic-bezier(0,0,0.2,1)_infinite] motion-reduce:animate-none" />
          </>
        )}
        {activeCount > 0 ? (
          <motion.span
            animate={{ scale: [1, 1.14, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex motion-reduce:transform-none"
          >
            <Activity size={17} strokeWidth={2.4} aria-hidden="true" />
          </motion.span>
        ) : (
          <Activity size={17} strokeWidth={2.4} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black leading-5">
          {t("ui.slurp.pulse.title", { defaultValue: "Pulse" })}
        </span>
        {activeCount > 0 && (
          <span className="block truncate text-[0.68rem] leading-4 text-[var(--muted-foreground)]">
            {activeCount} {t("ui.slurp.pulse.runningShort", { defaultValue: "running" })}
          </span>
        )}
      </span>
    </button>
  );
}

export function SlpPulsePanel({
  open,
  panelRef,
  closeRef,
  onClose,
  onGeneratePosts,
  onRunAudience,
  audiencePending = false,
  accounts = [],
}: {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onGeneratePosts?: () => void;
  onRunAudience?: () => void;
  audiencePending?: boolean;
  accounts?: SlpAccount[];
}) {
  const { t } = useUiTranslation();
  const mutations = usePulseMutations();
  const serverTasks = useSlpPulseTasks();
  const tasks = mergePulseTasks(serverTasks.data?.tasks ?? [], mutations);
  const groups = groupPulseTasks(tasks);
  const taskAccounts = [...accounts, ...(serverTasks.data?.accounts ?? [])].filter(
    (account, index, all) => all.findIndex((candidate) => candidate.id === account.id) === index,
  );
  if (!open) return null;

  const runAction = (action: (() => void) | undefined, close = true) => {
    action?.();
    if (action && close) onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/45 md:items-stretch md:justify-end" onClick={onClose}>
      <aside
        id="slurp-pulse-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slurp-pulse-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--slurp-canvas,var(--background))] text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)] md:my-4 md:ms-[15rem] md:me-auto md:max-h-none md:w-[min(25rem,calc(100vw-15rem))] md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--noodle-divider)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--noodle-accent)]">
              {groups.active.length > 0 ? (
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-flex motion-reduce:transform-none"
                >
                  <Activity size={18} aria-hidden="true" />
                </motion.span>
              ) : (
                <Activity size={18} aria-hidden="true" />
              )}
              <h2 id="slurp-pulse-title" className="text-lg font-black">
                {t("ui.slurp.pulse.title", { defaultValue: "Pulse" })}
              </h2>
            </div>
            <p className="mt-1 text-[0.68rem] text-[var(--muted-foreground)]">
              {t("ui.slurp.pulse.description", { defaultValue: "Background activity" })}
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label={t("ui.slurp.pulse.close", { defaultValue: "Close Pulse" })}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section aria-labelledby="slurp-pulse-actions" className="space-y-3">
            <h3
              id="slurp-pulse-actions"
              className="text-xs font-black uppercase tracking-[0.14em] text-[var(--slurp-muted)]"
            >
              {t("ui.slurp.pulse.automationSettings", { defaultValue: "Automation settings" })}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <PulseAction
                icon={<Settings2 size={17} aria-hidden="true" />}
                label={t("ui.slurp.pulse.generatePosts", { defaultValue: "Generate posts" })}
                onClick={() => runAction(onGeneratePosts)}
              />
              <PulseAction
                icon={<Settings2 size={17} aria-hidden="true" />}
                label={
                  audiencePending
                    ? t("ui.slurp.pulse.runningAudience", { defaultValue: "Running audience" })
                    : t("ui.slurp.pulse.runAudience", { defaultValue: "Run audience" })
                }
                onClick={() => runAction(onRunAudience, false)}
                disabled={audiencePending}
              />
            </div>
          </section>

          <section aria-labelledby="slurp-pulse-now" className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="slurp-pulse-now"
                className="text-xs font-black uppercase tracking-[0.14em] text-[var(--slurp-muted)]"
              >
                {t("ui.slurp.pulse.now", { defaultValue: "Now" })}
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)]">
                {tasks.active.length > 0 ? (
                  <Loader2 size={14} className="animate-spin text-[var(--noodle-accent)]" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
                )}
                {tasks.active.length > 0
                  ? t("ui.slurp.pulse.runningCount", {
                      defaultValue: "{{count}} running",
                      count: groups.active.length,
                    })
                  : t("ui.slurp.pulse.quiet", { defaultValue: "All quiet" })}
              </span>
            </div>
            {groups.active.length > 0 ? (
              <div className="space-y-2">
                {groups.active.map((group) => (
                  <PulseGroupCard key={group.id} group={group} accounts={taskAccounts} t={t} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised)] px-4 py-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-500" aria-hidden="true" />
                <p className="text-sm font-semibold">
                  {t("ui.slurp.pulse.noWork", { defaultValue: "No background work is running." })}
                </p>
              </div>
            )}
          </section>

          {groups.attention.length > 0 && (
            <section aria-labelledby="slurp-pulse-attention" className="mt-7 space-y-3">
              <h3
                id="slurp-pulse-attention"
                className="text-xs font-black uppercase tracking-[0.14em] text-[var(--slurp-danger)]"
              >
                {t("ui.slurp.pulse.attention", { defaultValue: "Needs attention" })}
              </h3>
              <div className="space-y-2">
                {groups.attention.map((group) => (
                  <PulseGroupCard key={group.id} group={group} accounts={taskAccounts} t={t} attention />
                ))}
              </div>
            </section>
          )}

          {groups.scheduled.length > 0 && (
            <section aria-labelledby="slurp-pulse-scheduled" className="mt-7 space-y-3">
              <h3
                id="slurp-pulse-scheduled"
                className="text-xs font-black uppercase tracking-[0.14em] text-[var(--slurp-muted)]"
              >
                {t("ui.slurp.pulse.scheduled", { defaultValue: "Scheduled" })}
              </h3>
              <div className="space-y-2">
                {groups.scheduled.map((group) => (
                  <PulseGroupCard key={group.id} group={group} accounts={taskAccounts} t={t} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="slurp-pulse-recent" className="mt-7">
            <h3
              id="slurp-pulse-recent"
              className="text-xs font-black uppercase tracking-[0.14em] text-[var(--slurp-muted)]"
            >
              {t("ui.slurp.pulse.recent", { defaultValue: "Recent" })}
            </h3>
            {groups.recent.length > 0 ? (
              <div className="mt-3 space-y-2">
                {groups.recent.slice(0, 5).map((group) => (
                  <PulseGroupCard key={group.id} group={group} accounts={taskAccounts} t={t} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                {t("ui.slurp.pulse.noRecent", { defaultValue: "Completed work will appear here." })}
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

type PulseMutation = {
  id: number;
  key: string;
  status: "pending" | "success" | "error";
  submittedAt: number;
  variables: unknown;
};

type PulseServerTask = {
  id: string;
  kind: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  publishAt?: string;
  accountIds: string[];
  detail?: string | null;
  progress?: { completed: number; total: number } | null;
};

type PulseAccount = Pick<SlpAccount, "id" | "entityId" | "displayName" | "avatarUrl" | "avatarCrop">;

type PulseTask = PulseServerTask & { source: "server" | "client" };
type PulseGroup = {
  id: string;
  kind: string;
  tasks: PulseTask[];
  active: boolean;
  attention: boolean;
  scheduled: boolean;
  accountIds: string[];
};

type PulseTasksResponse = {
  tasks: PulseServerTask[];
  accounts: PulseAccount[];
};

function useSlpPulseTasks() {
  return useQuery({
    queryKey: ["slurp", "pulse", "tasks"],
    queryFn: () => api.get<PulseTasksResponse>("/slurp2/slurp/tasks"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

function usePulseMutations() {
  const mutations = useMutationState<PulseMutation>({
    filters: { mutationKey: ["slurp"] },
    select: (mutation) => ({
      id: mutation.mutationId,
      key: String(mutation.options.mutationKey?.[1] ?? "task"),
      status: mutation.state.status,
      submittedAt: mutation.state.submittedAt,
      variables: mutation.state.variables,
    }),
  });
  const sorted = [...mutations].sort((left, right) => right.submittedAt - left.submittedAt);
  return {
    active: sorted.filter((mutation) => mutation.status === "pending"),
    recent: sorted.filter((mutation) => mutation.status !== "pending"),
  };
}

function mergePulseTasks(
  serverTasks: PulseServerTask[],
  mutations: { active: PulseMutation[]; recent: PulseMutation[] },
) {
  const server = serverTasks.map((task) => ({ ...task, source: "server" as const }));
  const client = [...mutations.active, ...mutations.recent].map((mutation) => {
    const accountId = readAccountId(mutation.variables);
    return {
      id: `client:${mutation.id}`,
      kind: mutation.key,
      status: mutation.status,
      updatedAt: new Date(mutation.submittedAt).toISOString(),
      accountIds: accountId ? [accountId] : [],
      detail: null,
      progress: null,
      source: "client" as const,
    };
  });
  const combined = [...server, ...client].sort(
    (left, right) =>
      Date.parse(right.updatedAt ?? right.createdAt ?? "") - Date.parse(left.updatedAt ?? left.createdAt ?? ""),
  );
  return {
    active: combined.filter((task) => isActiveTask(task.status)),
    scheduled: combined.filter((task) => task.status === "scheduled"),
    recent: combined.filter((task) => isTerminalTask(task.status)),
  };
}

function groupPulseTasks(tasks: { active: PulseTask[]; scheduled: PulseTask[]; recent: PulseTask[] }) {
  const grouped = new Map<string, PulseGroup>();
  const add = (task: PulseTask) => {
    const kind = pulseGroupKind(task.kind);
    const id = `${kind}:${task.source}`;
    const current = grouped.get(id) ?? {
      id,
      kind,
      tasks: [],
      active: false,
      attention: false,
      scheduled: false,
      accountIds: [],
    };
    current.tasks.push(task);
    current.active ||= isActiveTask(task.status);
    current.attention ||= task.status === "error" || task.status === "failed" || task.status === "abandoned";
    current.scheduled ||= task.status === "scheduled";
    current.accountIds = [...new Set([...current.accountIds, ...task.accountIds])];
    grouped.set(id, current);
  };
  [...tasks.active, ...tasks.scheduled, ...tasks.recent].forEach(add);
  const values = [...grouped.values()].sort(
    (left, right) => Date.parse(right.tasks[0]?.updatedAt ?? "") - Date.parse(left.tasks[0]?.updatedAt ?? ""),
  );
  return {
    active: values.filter((group) => group.active && !group.attention),
    attention: values.filter((group) => group.attention),
    scheduled: values.filter((group) => group.scheduled && !group.active && !group.attention),
    recent: values.filter((group) => !group.active && !group.attention && !group.scheduled),
  };
}

function isActiveTask(status: string) {
  return !isTerminalTask(status) && status !== "scheduled";
}

function pulseGroupKind(kind: string) {
  if (kind === "scheduled-post") return "scheduled-post";
  if (
    [
      "generate-post",
      "generate-posts",
      "generate-post-image",
      "generate-post-images",
      "create-post",
      "auto-post",
      "first-post",
    ].includes(kind)
  ) {
    return "post-production";
  }
  if (kind === "audience-activity") return "audience-activity";
  if (["conversation-schedule", "conversation-follow-up"].includes(kind)) return "conversation";
  if (kind === "creator-improvement") return "creator-improvement";
  if (kind === "commission") return "commission";
  return kind;
}

function isTerminalTask(status: string) {
  return new Set([
    "completed",
    "complete",
    "success",
    "failed",
    "error",
    "abandoned",
    "published",
    "discarded",
    "sent",
    "cancelled",
  ]).has(status);
}

function PulseTaskRow({
  task,
  accounts,
  running = false,
  compact = false,
  stacked = false,
  t,
}: {
  task: PulseTask;
  accounts: PulseAccount[];
  running?: boolean;
  compact?: boolean;
  stacked?: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const accountId = task.accountIds[0] ?? null;
  const account = accountId ? accounts.find((item) => item.id === accountId || item.entityId === accountId) : undefined;
  const label = pulseTaskLabel(task.kind, t);
  const status = pulseTaskStatus(task.status, running, t);
  const scope =
    task.accountIds.length > 1
      ? t("ui.slurp.pulse.creatorCount", { defaultValue: "{{count}} Creators", count: task.accountIds.length })
      : (account?.displayName ?? t("ui.slurp.pulse.slurpTask", { defaultValue: "Slurp task" }));
  const progress =
    task.progress && task.progress.total > 0 ? `${task.progress.completed}/${task.progress.total}` : undefined;
  const elapsed = task.publishAt
    ? `in ${formatPulseUntil(task.publishAt)}`
    : formatPulseAge(task.updatedAt ?? task.createdAt);
  const detail =
    task.detail ||
    (progress ? t("ui.slurp.pulse.progress", { defaultValue: "{{progress}} complete", progress }) : status);
  return (
    <motion.div
      initial={running ? { scale: 0.985 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3",
        stacked
          ? "min-h-11 px-2 py-2"
          : "rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]",
        stacked ? "" : compact ? "px-3 py-2" : "px-3 py-2.5",
      )}
    >
      {account ? (
        <Avatar account={account} size="xs" />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
          {running ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : task.status === "error" || task.status === "failed" ? (
            <CircleAlert size={15} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={15} aria-hidden="true" />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold", compact ? "text-xs" : "text-sm")}>{label}</span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">
          {scope} {elapsed ? `· ${elapsed}` : ""}
        </span>
        <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">{detail}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-[0.68rem] font-semibold",
          task.status === "error" || task.status === "failed"
            ? "text-[var(--slurp-danger)]"
            : "text-[var(--muted-foreground)]",
        )}
      >
        {status}
      </span>
    </motion.div>
  );
}

function PulseGroupCard({
  group,
  accounts,
  t,
  attention = false,
}: {
  group: PulseGroup;
  accounts: PulseAccount[];
  t: (key: string, options?: Record<string, unknown>) => string;
  attention?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = group.tasks[0];
  const label = pulseGroupLabel(group.kind, t);
  const scope =
    group.accountIds.length > 1
      ? t("ui.slurp.pulse.creatorCount", { defaultValue: "{{count}} Creators", count: group.accountIds.length })
      : group.tasks.length > 1
        ? t("ui.slurp.pulse.taskCount", { defaultValue: "{{count}} items", count: group.tasks.length })
        : undefined;
  const running = group.active && !attention;
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "relative rounded-xl ring-1 ring-inset",
          attention
            ? "bg-[var(--slurp-danger)]/7 ring-[var(--slurp-danger)]/25"
            : "bg-[var(--slurp-surface-raised)] ring-[var(--noodle-divider)]",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="relative z-10 flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]">
            {attention ? (
              <CircleAlert size={16} aria-hidden="true" />
            ) : running ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{label}</span>
            <span className="block truncate text-xs text-[var(--muted-foreground)]">
              {scope ?? taskSummary(group.tasks[0], t)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[0.68rem] font-semibold text-[var(--muted-foreground)]">
            {group.tasks.length > 1 && <span>{group.tasks.length}</span>}
            {group.tasks.length > 1 ? (
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn("transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
              />
            ) : (
              pulseTaskStatus(latest.status, running, t)
            )}
          </span>
        </button>
      </div>
      {group.tasks.length > 1 && !expanded && (
        <div className="relative z-0 -mt-1 h-2 px-2" aria-hidden="true">
          <span className="absolute inset-x-1 top-0 h-2 rounded-b-lg bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]/60" />
          <span className="absolute inset-x-2 top-1 h-2 rounded-b-lg bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]/40" />
        </div>
      )}
      {expanded && group.tasks.length > 1 && (
        <div className="relative z-10 space-y-2 px-2 pb-2 pt-2">
          {group.tasks.slice(0, 6).map((task) => (
            <PulseTaskRow
              key={task.id}
              task={task}
              accounts={accounts}
              running={isActiveTask(task.status)}
              compact
              t={t}
            />
          ))}
          {group.tasks.length > 6 && (
            <p className="px-2 text-[0.68rem] text-[var(--muted-foreground)]">+{group.tasks.length - 6} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function pulseGroupLabel(kind: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const labels: Record<string, [string, string]> = {
    "post-production": ["ui.slurp.pulse.generatePosts", "Generate posts"],
    "audience-activity": ["ui.slurp.pulse.runAudience", "Audience activity"],
    conversation: ["ui.slurp.pulse.conversation", "Conversation work"],
    "creator-improvement": ["ui.slurp.pulse.creatorImprovement", "Creator improvements"],
    commission: ["ui.slurp.pulse.commission", "Commission work"],
    "scheduled-post": ["ui.slurp.pulse.scheduledPost", "Scheduled post"],
  };
  const [key, defaultValue] = labels[kind] ?? ["ui.slurp.pulse.task", "Slurp work"];
  return t(key, { defaultValue });
}

function taskSummary(task: PulseTask | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!task) return "";
  if (task.publishAt)
    return `${t("ui.slurp.pulse.nextPublish", { defaultValue: "Next publish" })} · ${formatPulseUntil(task.publishAt)}`;
  const progress =
    task.progress && task.progress.total > 0 ? `${task.progress.completed}/${task.progress.total}` : null;
  return task.detail || progress || pulseTaskStatus(task.status, !isTerminalTask(task.status), t);
}

function formatPulseUntil(value: string) {
  const minutes = Math.max(0, Math.round((Date.parse(value) - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function pulseTaskStatus(
  taskStatus: string,
  running: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (running || taskStatus === "running" || taskStatus === "generating" || taskStatus === "applying") {
    return t("ui.slurp.pulse.working", { defaultValue: "Working" });
  }
  if (taskStatus === "scheduled") {
    return t("ui.slurp.pulse.scheduledStatus", { defaultValue: "Scheduled" });
  }
  if (["queued", "prepared"].includes(taskStatus)) {
    return t("ui.slurp.pulse.queued", { defaultValue: "Queued" });
  }
  if (taskStatus === "error" || taskStatus === "failed" || taskStatus === "abandoned") {
    return t("ui.slurp.pulse.failed", { defaultValue: "Failed" });
  }
  if (taskStatus === "waiting" || taskStatus === "connection_required") {
    return t("ui.slurp.pulse.waiting", { defaultValue: "Waiting" });
  }
  return t("ui.slurp.pulse.complete", { defaultValue: "Complete" });
}

function formatPulseAge(value?: string) {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function readAccountId(variables: unknown): string | null {
  if (!variables || typeof variables !== "object") return null;
  const record = variables as Record<string, unknown>;
  for (const key of ["accountId", "targetAccountId", "creatorAccountId"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return null;
}

function pulseTaskLabel(key: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const labels: Record<string, [string, string]> = {
    "generate-post": ["ui.slurp.pulse.generatePost", "Generating post"],
    "generate-posts": ["ui.slurp.pulse.generatingPosts", "Generating posts"],
    "generate-post-image": ["ui.slurp.pulse.generateImage", "Generating image"],
    "generate-post-images": ["ui.slurp.pulse.generateImages", "Preparing post images"],
    "create-post": ["ui.slurp.pulse.createPostTask", "Publishing post"],
    "auto-post": ["ui.slurp.pulse.autoPost", "Running scheduled post"],
    "audience-activity": ["ui.slurp.pulse.audienceTask", "Running audience activity"],
    "conversation-schedule": ["ui.slurp.pulse.scheduleTask", "Refreshing conversation schedule"],
    "first-post": ["ui.slurp.pulse.firstPost", "Creating first post"],
    "creator-improvement": ["ui.slurp.pulse.improvingCreators", "Improving Creator profiles"],
    "conversation-follow-up": ["ui.slurp.pulse.followUp", "Preparing conversation follow-up"],
    commission: ["ui.slurp.pulse.preparingCommission", "Preparing commission"],
  };
  const [keyName, defaultValue] = labels[key] ?? ["ui.slurp.pulse.slurpTask", "Slurp task"];
  return t(keyName, { defaultValue });
}

function PulseAction({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 items-center gap-2 rounded-xl bg-[var(--slurp-surface-raised)] px-3 text-start text-sm font-semibold ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-wait disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="shrink-0 text-[var(--noodle-accent)]">{icon}</span>
      {label}
    </button>
  );
}
