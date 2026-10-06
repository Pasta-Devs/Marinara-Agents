import { Activity, CheckCircle2, ChevronDown, CircleAlert, Clock3, Loader2, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { Avatar, SLP_EYEBROW_CLASS, SLP_TYPE, useSlpMediaQuery } from "../../base/chrome/SlpChrome";
import { startSlpTask, useSlpTasks, type SlpPulseTarget, type SlpTask } from "../../base/state/slp-task-store";
import type { SlpTaskAgainScreen } from "../../base/state/slp-task-list";
import { api } from "../../../lib/api-client.js";
import { cn } from "../../../lib/utils";
import { sortSlpPulseScheduled } from "./slp-pulse-order";
import {
  slpPulseClientSection,
  slpPulseComingUp,
  slpPulseNextTarget,
  slpPulseRunningCount,
  slpPulseServerSection,
  slpPulseTaskDone,
  slpPulseServerTarget,
  slpPulseSummaryCounts,
  type PulseNext,
  type PulseServerTask,
  type PulseUsage,
} from "./slp-pulse-model";
import {
  PulseAiToday,
  PulseClientTaskRow,
  PulseNextRow,
  PulseQuickStarts,
  slpPulseRunAudience,
  formatPulseAge,
  formatPulseUntil,
} from "./SlpPulseRows";
import { SlpSheet } from "./SlpSheet";
import { SlpButton, SlpPrimaryButton } from "./SlpButton";

export type SlpPulseBudgetNote = { onOpenBudget: () => void; onDismiss: () => void };

/** `rail`: the desktop rail copy, mounted but hidden on phones, where it must not poll /slurp/tasks. */
export function SlpPulseCard(props: { open: boolean; onOpen: () => void; note?: boolean; rail?: boolean }) {
  const railHidden = !useSlpMediaQuery("(min-width: 1024px)");
  return props.rail && railHidden ? null : <SlpPulseCardBody {...props} />;
}

function SlpPulseCardBody({ open, onOpen, note = false }: { open: boolean; onOpen: () => void; note?: boolean }) {
  const { t } = useUiTranslation();
  const serverTasks = useSlpPulseTasks(false);
  // Long actions started in this tab count too (task B), so the dot shows the moment one starts.
  const clientRunning = useSlpTasks((state) => state.tasks.filter((task) => task.status === "running").length);
  const activeCount = slpPulseRunningCount(serverTasks.data?.tasks) + clientRunning;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={open}
      aria-haspopup="dialog"
      className="group relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised))] px-3 text-start ring-1 ring-inset ring-[var(--noodle-accent)]/18 transition-[background-color,transform,box-shadow] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center text-[var(--noodle-accent-foreground)]">
        <Activity size={17} strokeWidth={2.4} aria-hidden="true" />
        {/* A still live dot, not a looping ping (marinara-design §7: no decorative loops). */}
        {(activeCount > 0 || note) && (
          <span className="absolute end-0 top-0.5 size-2 rounded-full bg-[var(--noodle-accent)] ring-2 ring-[var(--slurp-surface-raised)]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold leading-5">
          {t("ui.slurp.pulse.title", { defaultValue: "Pulse" })}
        </span>
        {activeCount > 0 && (
          <span className="block truncate text-xs leading-4 text-[var(--muted-foreground)]">
            {activeCount} {t("ui.slurp.pulse.runningShort", { defaultValue: "running" })}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Pulse: what Slurp is doing, what it did and what comes next (task C). A SlpSheet, so it never
 * stacks on the More sheet (B8). Sections: Running · Queued · Failed (why + Try again) · Coming up ·
 * Done, with today's AI use on top. A tap on a task opens what it made: the post, the chat, the
 * Creator. Long actions started anywhere land here (task B); Stir plays are tasks too.
 */
export function SlpPulsePanel({
  open,
  onClose,
  budgetNote,
  accounts = [],
  onOpenTarget,
  onOpenBudget,
  onGeneratePosts,
  onStartAgain,
}: {
  open: boolean;
  onClose: () => void;
  budgetNote?: SlpPulseBudgetNote;
  accounts?: SlpAccount[];
  /** Opens a task's result; Pulse closes first. */
  onOpenTarget?: (target: SlpPulseTarget) => void;
  onOpenBudget?: () => void;
  /** The quick "Generate posts" chip: the Creator picker, whose run is a Pulse task. */
  onGeneratePosts?: () => void;
  /** "Start it again from …" on a failed task restored after a reload; Pulse closes first. */
  onStartAgain?: (screen: SlpTaskAgainScreen, task: SlpTask) => void;
}) {
  const { t } = useUiTranslation();
  const serverTasks = useSlpPulseTasks(open);
  const clientTasks = useSlpTasks((state) => state.tasks);
  const usage = useQuery({
    queryKey: ["slurp", "model-budget", "usage"],
    queryFn: () => api.get<PulseUsage>("/slurp2/model-budget/usage"),
    enabled: open,
    staleTime: 15_000,
  });
  const tasks = mergePulseTasks(serverTasks.data?.tasks ?? []);
  const groups = groupPulseTasks(tasks);
  const comingUp = slpPulseComingUp(serverTasks.data?.next ?? [], tasks.scheduled);
  const client = {
    running: clientTasks.filter((task) => slpPulseClientSection(task) === "running"),
    // A restored failed audience run can run again from right here.
    failed: clientTasks
      .filter((task) => slpPulseClientSection(task) === "failed")
      .map((task) =>
        !task.retry && task.kind === "run-audience" ? { ...task, retry: () => slpPulseRunAudience(t, task.id) } : task,
      ),
    done: clientTasks.filter((task) => slpPulseClientSection(task) === "done"),
  };
  const taskAccounts = [...accounts, ...(serverTasks.data?.accounts ?? [])].filter(
    (account, index, all) => all.findIndex((candidate) => candidate.id === account.id) === index,
  );
  const ownViewerIds = new Set(accounts.flatMap((account) => [account.id, account.entityId]));
  const name = (id: string | undefined) =>
    id ? taskAccounts.find((account) => account.id === id || account.entityId === id)?.displayName : undefined;
  const openTarget = onOpenTarget
    ? (target: SlpPulseTarget | null) => {
        if (!target) return;
        onClose();
        onOpenTarget(target);
      }
    : undefined;
  const startAgain = onStartAgain
    ? (screen: SlpTaskAgainScreen, task: SlpTask) => {
        onClose();
        onStartAgain(screen, task);
      }
    : undefined;
  const counts = {
    running: groups.active.length + client.running.length,
    queued: groups.queued.length,
    failed: groups.attention.length + client.failed.length,
    done: groups.recent.length + client.done.length,
    next: comingUp.length,
  };
  const summary = slpPulseSummaryCounts(counts)
    .map((key) => t(`ui.slurp.pulse.summary.${key}`, { count: counts[key] }))
    .join(" · ");
  const heading = (id: string, label: string, danger = false) => (
    <h3 id={id} className={cn(SLP_EYEBROW_CLASS, "px-1", danger && "text-[var(--slurp-danger)]")}>
      {label}
    </h3>
  );
  const retryServer = (task: PulseTask) => {
    const retry = task.retry;
    if (!retry) return;
    void startSlpTask({
      t,
      kind: task.kind,
      label: pulseTaskLabel(task, t),
      accountIds: task.accountIds,
      run: () => api.post(`/slurp2${retry.path}`, retry.body),
      startedToast: t("ui.slurp.pulse.retrying", { defaultValue: "Trying again. You can keep going." }),
    }).then(() => serverTasks.refetch());
  };

  return (
    <SlpSheet open={open} onClose={onClose} back title={t("ui.slurp.pulse.title", { defaultValue: "Pulse" })}>
      <div id="slurp-pulse-panel" className="space-y-6 px-2 pb-2">
        {/* One status line: what runs, waits, failed and comes next, or "All quiet". */}
        <p className={cn(SLP_TYPE.meta, "flex items-center gap-2 px-1 text-[var(--slurp-muted)]")}>
          {counts.running > 0 ? (
            <span className="size-2 shrink-0 rounded-full bg-[var(--noodle-accent)]" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
          )}
          {summary ||
            t("ui.slurp.pulse.quietNothing", {
              defaultValue: "All quiet. What Slurp does, and what you start, shows up here.",
            })}
        </p>

        {/* Quick starts (release step): small chips, each runs on as a task below. Plans start in Stir. */}
        <PulseQuickStarts
          t={t}
          onGeneratePosts={
            onGeneratePosts
              ? () => {
                  onClose();
                  onGeneratePosts();
                }
              : undefined
          }
        />

        {budgetNote && (
          // One-time note from Slurp after the AI budget defaults went up (task F). Either button clears it.
          <section
            aria-labelledby="slurp-pulse-budget-note"
            className="space-y-2 rounded-xl bg-[color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised))] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/18"
          >
            <h3 id="slurp-pulse-budget-note" className="text-sm font-bold">
              {t("ui.slurp.pulse.budgetNote.title", { defaultValue: "Your AI budget grew" })}
            </h3>
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
              {t("ui.slurp.pulse.budgetNote.body", {
                defaultValue:
                  "The AI budget now grows with your Creators, so they chat, get comments and hear from fans more often. On a paid AI connection that costs more. Limits you set yourself stay as they are.",
              })}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <SlpPrimaryButton
                onClick={() => {
                  budgetNote.onOpenBudget();
                  onClose();
                }}
              >
                {t("ui.slurp.pulse.budgetNote.open", { defaultValue: "Open AI budget" })}
              </SlpPrimaryButton>
              <SlpButton variant="quiet" onClick={budgetNote.onDismiss}>
                {t("ui.slurp.pulse.budgetNote.dismiss", { defaultValue: "Got it" })}
              </SlpButton>
            </div>
          </section>
        )}

        <PulseAiToday
          usage={usage.data}
          t={t}
          onOpenBudget={
            onOpenBudget
              ? () => {
                  onClose();
                  onOpenBudget();
                }
              : undefined
          }
        />

        {counts.running > 0 && (
          <section aria-labelledby="slurp-pulse-now" className="space-y-2">
            {heading("slurp-pulse-now", t("ui.slurp.pulse.sections.running", { defaultValue: "Running" }))}
            <div className="space-y-2">
              {client.running.map((task) => (
                <PulseClientTaskRow key={task.id} task={task} name={name} t={t} onOpen={openTarget} />
              ))}
              {groups.active.map((group) => (
                <PulseGroupCard key={group.id} group={group} accounts={taskAccounts} t={t} />
              ))}
            </div>
          </section>
        )}

        {counts.queued > 0 && (
          <section aria-labelledby="slurp-pulse-queued" className="space-y-2">
            {heading("slurp-pulse-queued", t("ui.slurp.pulse.sections.queued", { defaultValue: "Queued" }))}
            <div className="space-y-2">
              {groups.queued.map((group) => (
                <PulseGroupCard key={group.id} group={group} accounts={taskAccounts} t={t} />
              ))}
            </div>
          </section>
        )}

        {counts.failed > 0 && (
          <section aria-labelledby="slurp-pulse-attention" className="space-y-2">
            {heading("slurp-pulse-attention", t("ui.slurp.pulse.sections.failed", { defaultValue: "Failed" }), true)}
            <div className="space-y-2">
              {client.failed.map((task) => (
                <PulseClientTaskRow
                  key={task.id}
                  task={task}
                  name={name}
                  t={t}
                  onOpen={openTarget}
                  onStartAgain={startAgain}
                />
              ))}
              {groups.attention.flatMap((group) =>
                group.tasks.map((task) => (
                  <PulseTaskRow
                    key={task.id}
                    task={task}
                    accounts={taskAccounts}
                    t={t}
                    failed
                    onRetry={task.retry ? () => retryServer(task) : undefined}
                    onOpen={openTarget ? () => openTarget(slpPulseServerTarget(task, ownViewerIds)) : undefined}
                  />
                )),
              )}
            </div>
          </section>
        )}

        {comingUp.length > 0 && (
          <section aria-labelledby="slurp-pulse-next" className="space-y-2">
            {heading("slurp-pulse-next", t("ui.slurp.pulse.sections.next", { defaultValue: "Coming up" }))}
            <ol className="overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]">
              {comingUp.map((next) => (
                <PulseNextRow
                  key={next.id}
                  next={next}
                  name={name}
                  t={t}
                  onOpen={openTarget ? () => openTarget(slpPulseNextTarget(next, ownViewerIds)) : undefined}
                />
              ))}
            </ol>
          </section>
        )}

        {counts.done > 0 && (
          <section aria-labelledby="slurp-pulse-recent" className="space-y-2">
            {heading("slurp-pulse-recent", t("ui.slurp.pulse.sections.done", { defaultValue: "Done" }))}
            <div className="space-y-2">
              {client.done.slice(0, 5).map((task) => (
                <PulseClientTaskRow key={task.id} task={task} name={name} t={t} onOpen={openTarget} />
              ))}
              {groups.recent.slice(0, 5).map((group) => (
                <PulseGroupCard
                  key={group.id}
                  group={group}
                  accounts={taskAccounts}
                  t={t}
                  onOpenTask={openTarget ? (task) => openTarget(slpPulseServerTarget(task, ownViewerIds)) : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </SlpSheet>
  );
}

type PulseAccount = Pick<SlpAccount, "id" | "entityId" | "displayName" | "avatarUrl" | "avatarCrop">;

type PulseTask = PulseServerTask & { source: "server" };
type PulseGroup = {
  id: string;
  kind: string;
  tasks: PulseTask[];
  active: boolean;
  queued: boolean;
  attention: boolean;
  scheduled: boolean;
  accountIds: string[];
};

type PulseTasksResponse = {
  tasks: PulseServerTask[];
  /** What Slurp does next on its own (task C); older servers send none. */
  next?: PulseNext[];
  accounts: PulseAccount[];
};

function useSlpPulseTasks(active = false) {
  // A tap in this tab starts a client task first; poll fast until the server shows its row.
  const clientRunning = useSlpTasks((state) => state.tasks.some((task) => task.status === "running"));
  return useQuery({
    queryKey: ["slurp", "pulse", "tasks"],
    queryFn: () => api.get<PulseTasksResponse>("/slurp2/slurp/tasks"),
    // The route reads many tables: poll fast only while something runs (0.3.6), slowly otherwise.
    refetchInterval: (query) =>
      clientRunning || slpPulseRunningCount(query.state.data?.tasks) > 0
        ? active
          ? 2_000
          : 15_000
        : active
          ? 10_000
          : 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/**
 * The server's tasks by state. Long actions from this tab come from the task store (task B), so the
 * old copy of every pending "slurp" mutation is gone (it showed each action twice, without a name).
 */
function mergePulseTasks(serverTasks: PulseServerTask[]) {
  const combined = serverTasks
    .map((task) => ({ ...task, source: "server" as const }))
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt ?? right.createdAt ?? "") - Date.parse(left.updatedAt ?? left.createdAt ?? ""),
    );
  return {
    active: combined.filter((task) => isActiveTask(task.status)),
    scheduled: sortSlpPulseScheduled(combined.filter((task) => task.status === "scheduled")),
    recent: combined.filter((task) => slpPulseTaskDone(task.status)),
  };
}

function groupPulseTasks(tasks: { active: PulseTask[]; scheduled: PulseTask[]; recent: PulseTask[] }) {
  const grouped = new Map<string, PulseGroup>();
  const add = (task: PulseTask) => {
    const kind = pulseGroupKind(task.kind);
    const section = slpPulseServerSection(task.status, slpPulseTaskDone(task.status));
    // One card per kind and section, so a failed run never hides inside a group of finished ones.
    const id = `${kind}:${section}`;
    const current = grouped.get(id) ?? {
      id,
      kind,
      tasks: [],
      active: false,
      queued: false,
      attention: false,
      scheduled: false,
      accountIds: [],
    };
    current.tasks.push(task);
    current.active ||= section === "running";
    current.queued ||= section === "queued";
    current.attention ||= section === "failed";
    current.scheduled ||= section === "scheduled";
    current.accountIds = [...new Set([...current.accountIds, ...task.accountIds])];
    grouped.set(id, current);
  };
  [...tasks.active, ...tasks.scheduled, ...tasks.recent].forEach(add);
  const values = [...grouped.values()].sort(
    (left, right) => Date.parse(right.tasks[0]?.updatedAt ?? "") - Date.parse(left.tasks[0]?.updatedAt ?? ""),
  );
  return {
    active: values.filter((group) => group.active),
    queued: values.filter((group) => group.queued),
    attention: values.filter((group) => group.attention),
    recent: values.filter((group) => !group.active && !group.queued && !group.attention && !group.scheduled),
  };
}

function isActiveTask(status: string) {
  return !slpPulseTaskDone(status) && status !== "scheduled";
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
  if (["conversation-schedule", "conversation-follow-up", "conversation-opener"].includes(kind)) return "conversation";
  if (kind === "creator-improvement") return "creator-improvement";
  if (kind === "commission") return "commission";
  return kind;
}

function PulseTaskRow({
  task,
  accounts,
  running = false,
  compact = false,
  stacked = false,
  failed = false,
  onRetry,
  onOpen,
  t,
}: {
  task: PulseTask;
  accounts: PulseAccount[];
  running?: boolean;
  compact?: boolean;
  stacked?: boolean;
  /** A failed task shows its reason in full and its Try again (task C). */
  failed?: boolean;
  onRetry?: () => void;
  /** A tap opens what it made (the post, the chat, the Creator). */
  onOpen?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const accountId = task.accountIds[0] ?? null;
  const account = accountId ? accounts.find((item) => item.id === accountId || item.entityId === accountId) : undefined;
  const label = pulseTaskLabel(task, t);
  const status = pulseTaskStatus(task.status, running, t);
  const scope =
    task.accountIds.length > 1
      ? t("ui.slurp.pulse.creatorCount", { defaultValue: "{{count}} Creators", count: task.accountIds.length })
      : (account?.displayName ?? t("ui.slurp.pulse.slurpTask", { defaultValue: "Slurp task" }));
  const progress =
    task.progress && task.progress.total > 0 ? `${task.progress.completed}/${task.progress.total}` : undefined;
  const elapsed = task.publishAt ? formatPulseUntil(task.publishAt) : formatPulseAge(task.updatedAt ?? task.createdAt);
  const detail =
    task.detail ||
    (progress ? t("ui.slurp.pulse.progress", { defaultValue: "{{progress}} complete", progress }) : status);
  const why = failed
    ? task.detail || t("ui.slurp.pulse.failedNoReason", { defaultValue: "No reason was saved. Try again." })
    : detail;
  const body = (
    <>
      {account ? (
        <Avatar account={account} size="xs" />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent-foreground)]">
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
        <span className={cn("block text-xs text-[var(--muted-foreground)]", failed ? "line-clamp-3" : "truncate")}>
          {why}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold",
          task.status === "error" || task.status === "failed"
            ? "text-[var(--slurp-danger)]"
            : "text-[var(--muted-foreground)]",
        )}
      >
        {status}
      </span>
    </>
  );
  const rowClass = cn(
    "flex w-full items-center gap-3 text-start",
    stacked ? "min-h-11 px-2 py-2" : compact ? "px-3 py-2" : "px-3 py-2.5",
  );
  return (
    <motion.div
      initial={running ? { scale: 0.985 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        !stacked && "rounded-xl ring-1 ring-inset",
        !stacked &&
          (failed
            ? "bg-[var(--slurp-danger)]/7 ring-[var(--slurp-danger)]/25"
            : "bg-[var(--slurp-surface-raised)] ring-[var(--noodle-divider)]"),
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            rowClass,
            "min-h-11 rounded-xl hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
      {failed && onRetry && (
        <div className="flex justify-end px-3 pb-2.5">
          <SlpButton onClick={onRetry}>
            <RotateCcw size={14} aria-hidden="true" />
            {t("ui.slurp.pulse.retry", { defaultValue: "Try again" })}
          </SlpButton>
        </div>
      )}
    </motion.div>
  );
}

function PulseGroupCard({
  group,
  accounts,
  t,
  attention = false,
  onOpenTask,
}: {
  group: PulseGroup;
  accounts: PulseAccount[];
  t: (key: string, options?: Record<string, unknown>) => string;
  attention?: boolean;
  /** Done tasks open what they made; a card of one opens it straight away. */
  onOpenTask?: (task: PulseTask) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const latest = group.tasks[0];
  // A card of one names that task ("Play: Set them up"); a stack names its kind.
  const label = group.tasks.length === 1 ? pulseTaskLabel(latest, t) : pulseGroupLabel(group.kind, t);
  const scope =
    group.accountIds.length > 1
      ? t("ui.slurp.pulse.creatorCount", { defaultValue: "{{count}} Creators", count: group.accountIds.length })
      : group.tasks.length > 1
        ? t("ui.slurp.pulse.taskCount", { defaultValue: "{{count}} items", count: group.tasks.length })
        : undefined;
  const running = group.active && !attention;
  const openSingle = group.tasks.length === 1 && onOpenTask && latest.accountIds.length > 0;
  const names = group.accountIds
    .map((id) => accounts.find((account) => account.id === id || account.entityId === id)?.displayName)
    .filter((name): name is string => Boolean(name));
  const nameSummary = names.length > 0 ? names.slice(0, 3).join(", ") + (names.length > 3 ? " …" : "") : null;
  return (
    <motion.div
      className="space-y-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
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
          onClick={() => {
            if (openSingle) return onOpenTask(latest);
            if (expanded) setShowAllTasks(false);
            setExpanded(!expanded);
          }}
          aria-expanded={openSingle ? undefined : expanded}
          className="relative z-10 flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent-foreground)]">
            {attention ? (
              <CircleAlert size={16} aria-hidden="true" />
            ) : running ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : group.queued ? (
              <Clock3 size={16} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{label}</span>
            <span className="block truncate text-xs text-[var(--muted-foreground)]">
              {scope ?? nameSummary ?? taskSummary(group.tasks[0], t)}
            </span>
            {nameSummary && scope && (
              <span className="block truncate text-xs text-[var(--muted-foreground)]">{nameSummary}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
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
          {(showAllTasks ? group.tasks : group.tasks.slice(0, 6)).map((task) => (
            <PulseTaskRow
              key={task.id}
              task={task}
              accounts={accounts}
              running={isActiveTask(task.status)}
              compact
              onOpen={onOpenTask && task.accountIds.length > 0 ? () => onOpenTask(task) : undefined}
              t={t}
            />
          ))}
          {group.tasks.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllTasks((value) => !value)}
              aria-expanded={showAllTasks}
              className="min-h-9 rounded-md px-2 text-start text-xs font-semibold text-[var(--noodle-accent-foreground)] hover:bg-[var(--noodle-accent)]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            >
              {showAllTasks
                ? t("ui.slurp.pulse.showFewer", { defaultValue: "Show fewer" })
                : t("ui.slurp.pulse.moreTasks", {
                    defaultValue: "+{{count}} more",
                    count: group.tasks.length - 6,
                  })}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function pulseGroupLabel(kind: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const labels: Record<string, [string, string]> = {
    "post-production": ["ui.slurp.pulse.generatePosts", "New posts"],
    "audience-activity": ["ui.slurp.pulse.audienceActivity", "Audience activity"],
    conversation: ["ui.slurp.pulse.conversation", "Chats and promises"],
    "creator-improvement": ["ui.slurp.pulse.creatorImprovement", "Creator improvements"],
    commission: ["ui.slurp.pulse.commission", "Commission work"],
    "scheduled-post": ["ui.slurp.pulse.scheduledPost", "Scheduled post"],
    "stir-play": ["ui.slurp.pulse.stirPlays", "Stir plays"],
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
  return task.detail || progress || pulseTaskStatus(task.status, !slpPulseTaskDone(task.status), t);
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
  // A follow-up waiting for its time is queued, not finished (task C).
  if (["queued", "prepared", "pending", "claimed"].includes(taskStatus)) {
    return t("ui.slurp.pulse.queued", { defaultValue: "Queued" });
  }
  if (taskStatus === "error" || taskStatus === "failed" || taskStatus === "abandoned") {
    return t("ui.slurp.pulse.failed", { defaultValue: "Failed" });
  }
  if (taskStatus === "undone") return t("ui.slurp.pulse.undone", { defaultValue: "Undone" });
  if (taskStatus === "waiting" || taskStatus === "connection_required") {
    return t("ui.slurp.pulse.waiting", { defaultValue: "Waiting" });
  }
  return t("ui.slurp.pulse.complete", { defaultValue: "Complete" });
}

function pulseTaskLabel(
  task: Pick<PulseTask, "kind" | "stirActions">,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const key = task.kind;
  // A Stir play is named by its first card ("Play: Post now"), like the deck names it (task C).
  if (key === "stir-play") {
    const action = task.stirActions?.[0];
    const what = action ? t(`ui.slurp.stir.card.${action}.title`, { defaultValue: action }) : "";
    return t("ui.slurp.pulse.stirPlay", { defaultValue: "Play: {{what}}", what });
  }
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
    "conversation-follow-up": ["ui.slurp.pulse.followUp", "A promised message"],
    "conversation-opener": ["ui.slurp.pulse.openerTask", "A first message"],
    commission: ["ui.slurp.pulse.preparingCommission", "Preparing commission"],
  };
  const [keyName, defaultValue] = labels[key] ?? ["ui.slurp.pulse.slurpTask", "Slurp task"];
  return t(keyName, { defaultValue });
}
