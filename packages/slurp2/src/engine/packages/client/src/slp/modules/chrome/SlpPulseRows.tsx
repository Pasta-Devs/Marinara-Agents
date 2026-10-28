import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Handshake,
  ImagePlus,
  Loader2,
  Megaphone,
  MessageCircle,
  RotateCcw,
  Users,
} from "lucide-react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { formatRelativeTime } from "../../base/ui/slp-date-time";
import { dismissSlpTask, startSlpTask, type SlpPulseTarget, type SlpTask } from "../../base/state/slp-task-store";
import { api } from "../../../lib/api-client.js";
import { slpTaskAgainScreen, type SlpTaskAgainScreen } from "../../base/state/slp-task-list";
import { slpPulseAiToday, type PulseNext, type PulseUsage } from "./slp-pulse-model";
import { SlpButton, SlpChip } from "./SlpButton";
import { SlpUsesAiMark, noteSlpAiUseOnce } from "./SlpAiMark";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";

/** Pulse's rows (task C): today's AI use, one "Coming up" line, one long action from this tab (task B). */

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Fans like, comment and reply now, as a Pulse task (task B); `retryOf` reruns a restored failed one in its row. */
export function slpPulseRunAudience(t: Translate, retryOf?: string) {
  noteSlpAiUseOnce(t);
  void startSlpTask(
    {
      t,
      kind: "run-audience",
      label: t("ui.slurp.pulse.runAudience"),
      run: () => api.post("/slurp2/slurp/actions/run-audience", {}),
      done: () => ({ result: t("ui.slurp.pulse.runAudienceDone") }),
    },
    retryOf,
  );
}

/** Quick starts at the top of Pulse (release step): small chips; each runs on as a task. */
export function PulseQuickStarts({ t, onGeneratePosts }: { t: Translate; onGeneratePosts?: () => void }) {
  const chip = "min-h-9 gap-1.5 px-3 text-xs";
  return (
    <div className="flex flex-wrap gap-2 px-1" role="group" aria-label={t("ui.slurp.pulse.quick")}>
      {onGeneratePosts && (
        <SlpChip aria-pressed={undefined} onClick={onGeneratePosts} className={chip}>
          <SlpSparkleGlyph size={14} aria-hidden="true" />
          {t("ui.slurp.pulse.quickGenerate")}
        </SlpChip>
      )}
      <SlpChip aria-pressed={undefined} onClick={() => slpPulseRunAudience(t)} className={chip}>
        <Megaphone size={14} aria-hidden="true" />
        {t("ui.slurp.pulse.runAudience")}
        <SlpUsesAiMark />
      </SlpChip>
    </div>
  );
}

/** Today's AI use against the day's limit, in tokens (F), with the way to the AI budget. */
export function PulseAiToday({
  usage,
  t,
  onOpenBudget,
}: {
  usage?: PulseUsage;
  t: Translate;
  onOpenBudget?: () => void;
}) {
  const { i18n } = useTranslation();
  const today = slpPulseAiToday(usage);
  if (!today) return null;
  const compact = new Intl.NumberFormat(i18n.language, { notation: "compact", maximumFractionDigits: 1 });
  return (
    <section
      aria-labelledby="slurp-pulse-ai"
      className="space-y-2 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="slurp-pulse-ai" className="text-sm font-bold">
          {t("ui.slurp.pulse.ai.title", { defaultValue: "AI use today" })}
        </h3>
        {onOpenBudget && (
          <button
            type="button"
            onClick={onOpenBudget}
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--noodle-accent-foreground)] hover:bg-[var(--noodle-accent)]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          >
            {t("ui.slurp.pulse.ai.open", { defaultValue: "AI budget" })}
            <ChevronRight size={14} className="rtl:-scale-x-100" aria-hidden="true" />
          </button>
        )}
      </div>
      {today.off ? (
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.settings.aiBudget.outlook.off")}</p>
      ) : (
        <>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={today.limitCalls}
            aria-valuenow={Math.min(today.usedCalls, today.limitCalls)}
            aria-label={t("ui.slurp.pulse.ai.title", { defaultValue: "AI use today" })}
            className="h-2 overflow-hidden rounded-full bg-[var(--noodle-accent)]/12"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] motion-reduce:transition-none",
                today.share >= 1 ? "bg-[var(--slurp-danger)]" : "bg-[var(--noodle-accent)]",
              )}
              style={{ width: `${Math.round(today.share * 100)}%` }}
            />
          </div>
          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
            {t("ui.slurp.pulse.ai.used", {
              defaultValue: "About {{used}} of {{limit}} tokens · {{calls}} of {{limitCalls}} AI calls",
              used: compact.format(today.usedTokens),
              limit: compact.format(today.limitTokens),
              calls: today.usedCalls,
              limitCalls: today.limitCalls,
            })}
          </p>
          {today.share >= 1 && (
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-danger)]")}>
              {t("ui.slurp.pulse.ai.full", {
                defaultValue: "Today's budget is used up. Creators wait until tomorrow; your own taps still work.",
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** One thing Slurp will do on its own: when, who, what. A tap opens the Creator or your chat. */
export function PulseNextRow({
  next,
  name,
  t,
  onOpen,
}: {
  next: PulseNext;
  name: (id: string | undefined) => string | undefined;
  t: Translate;
  onOpen?: () => void;
}) {
  const who = name(next.accountIds[0]) ?? t("ui.slurp.pulse.someone", { defaultValue: "A Creator" });
  const Icon = {
    post: ImagePlus,
    reply: MessageCircle,
    promise: Handshake,
    opener: MessageCircle,
    fans: Users,
    event: CalendarDays,
  }[next.kind];
  const line = t(`ui.slurp.pulse.next.${next.kind}`, { name: who, event: next.label ?? "" });
  const detail =
    next.kind === "promise"
      ? next.label
      : next.kind === "event" && next.accountIds.length > 1
        ? t("ui.slurp.pulse.creatorCount", { count: next.accountIds.length })
        : null;
  const due = Date.parse(next.at) <= Date.now() + 60_000;
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent-foreground)]">
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{line}</span>
        {detail && <span className="block truncate text-xs text-[var(--muted-foreground)]">{detail}</span>}
      </span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">
        {due ? t("ui.slurp.pulse.now", { defaultValue: "Now" }) : formatPulseUntil(next.at)}
      </span>
    </>
  );
  const rowClass = "flex min-h-14 w-full items-center gap-3 px-3 py-2 text-start";
  return (
    <li className="border-b border-[var(--noodle-divider)] last:border-b-0">
      {onOpen && next.accountIds.length > 0 ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            rowClass,
            "hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/** A long action started in this tab (task B): running, done with its result, or failed with why. */
export function PulseClientTaskRow({
  task,
  name,
  t,
  onOpen,
  onStartAgain,
}: {
  task: SlpTask;
  name: (id: string | undefined) => string | undefined;
  t: Translate;
  onOpen?: (target: SlpPulseTarget | null) => void;
  /** A failed task restored after a reload has no Try again: this opens the screen it started from. */
  onStartAgain?: (screen: SlpTaskAgainScreen, task: SlpTask) => void;
}) {
  const failed = task.status === "failed";
  const againScreen = failed && !task.retry && onStartAgain ? slpTaskAgainScreen(task) : null;
  const running = task.status === "running";
  const who = task.accountIds
    .map((id) => name(id))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const detail = failed ? task.error : running ? who || null : [task.result, who].filter(Boolean).join(" · ");
  const openTask =
    task.open ??
    (task.target && onOpen
      ? { label: t("ui.slurp.pulse.open", { defaultValue: "Open" }), run: () => onOpen(task.target!) }
      : null);
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5 ring-1 ring-inset",
        failed
          ? "bg-[var(--slurp-danger)]/7 ring-[var(--slurp-danger)]/25"
          : "bg-[var(--slurp-surface-raised)] ring-[var(--noodle-divider)]",
      )}
    >
      <div className="flex min-h-11 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent-foreground)]">
          {failed ? (
            <CircleAlert size={16} className="text-[var(--slurp-danger)]" aria-hidden="true" />
          ) : running ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{task.label}</span>
          {detail && (
            <span className={cn("block text-xs text-[var(--muted-foreground)]", failed ? "line-clamp-2" : "truncate")}>
              {detail}
            </span>
          )}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold",
            failed ? "text-[var(--slurp-danger)]" : "text-[var(--muted-foreground)]",
          )}
        >
          {running
            ? t("ui.slurp.pulse.working", { defaultValue: "Working" })
            : formatPulseAge(new Date(task.finishedAt ?? task.startedAt).toISOString())}
        </span>
      </div>
      {(openTask || (failed && task.retry) || againScreen) && (
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          {failed && (
            <SlpButton variant="quiet" onClick={() => dismissSlpTask(task.id)}>
              {t("ui.slurp.pulse.dismiss", { defaultValue: "Hide" })}
            </SlpButton>
          )}
          {openTask && (
            <SlpButton variant="quiet" onClick={openTask.run}>
              {openTask.label}
            </SlpButton>
          )}
          {againScreen && (
            <SlpButton onClick={() => onStartAgain?.(againScreen, task)}>
              {t(`ui.slurp.pulse.again.${againScreen}`)}
            </SlpButton>
          )}
          {failed && task.retry && (
            <SlpButton onClick={task.retry}>
              <RotateCcw size={14} aria-hidden="true" />
              {t("ui.slurp.pulse.retry", { defaultValue: "Try again" })}
            </SlpButton>
          )}
        </div>
      )}
    </div>
  );
}

/** "in 5m", "in 2h", "in 3d", in the UI language. */
export function formatPulseUntil(value: string) {
  const minutes = Math.max(0, Math.round((Date.parse(value) - Date.now()) / 60_000));
  const format = new Intl.RelativeTimeFormat(i18next.language, { style: "narrow" });
  if (minutes < 60) return format.format(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(hours, "hour");
  return format.format(Math.floor(hours / 24), "day");
}

/** The shared list timestamp ("now", "4m", "2h", …) in the UI language. */
export function formatPulseAge(value?: string) {
  return value ? formatRelativeTime(value, i18next.language) : "";
}
