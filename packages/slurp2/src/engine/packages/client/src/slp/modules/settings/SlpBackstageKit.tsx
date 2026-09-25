// Shared, prop-driven Backstage controls, split out of
// components/slurp/SlurpBackstageWorkflow.tsx in Slice 10. These render from props only and
// import no feature, so they are a reusable module rather than feature-owned.

import { Modal } from "../../../components/ui/Modal";
import { Avatar } from "../../base/chrome/SlpChrome";
import type { SlurpReserveStatus, SlurpScheduleSlot } from "../../base/state/slp-state-types";
import { formatClockTime } from "../../base/ui/slp-date-time";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Megaphone,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { slpLocalDay, slpLocalTime, slpScheduleDays, slpSlotAtTime, slpSlotOnDay } from "./slp-schedule-agenda";

/**
 * The posting schedule as a day list. Each row edits only the time; "Another day" moves the slot
 * to a new day at the same time. A change saves when the field is left, so there is no Save button.
 */
export function ScheduleAgenda({
  slots,
  pending,
  onMove,
}: {
  slots: readonly SlurpScheduleSlot[];
  pending: boolean;
  onMove: (slot: SlurpScheduleSlot, publishAt: string) => Promise<void>;
}) {
  const { i18n } = useTranslation();
  const dayLabel = new Intl.DateTimeFormat(i18n.language, { weekday: "long", month: "short", day: "numeric" });
  return (
    <div className="space-y-4">
      {slpScheduleDays(slots).map(({ day, slots: daySlots }) => (
        <section key={day} aria-label={dayLabel.format(new Date(`${day}T12:00`))} className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--slurp-muted,var(--muted-foreground))]">
            {dayLabel.format(new Date(`${day}T12:00`))}
          </h4>
          <ul className="divide-y divide-[var(--slurp-outline,var(--border))] rounded-lg ring-1 ring-inset ring-[var(--slurp-outline,var(--border))]">
            {daySlots.map((slot) => (
              <ScheduleAgendaRow
                key={`${slot.id}:${slot.publishAt}`}
                slot={slot}
                pending={pending}
                onMove={(publishAt) => onMove(slot, publishAt)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ScheduleAgendaRow({
  slot,
  pending,
  onMove,
}: {
  slot: SlurpScheduleSlot;
  pending: boolean;
  onMove: (publishAt: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [time, setTime] = useState(() => slpLocalTime(slot.publishAt));
  const [dayOpen, setDayOpen] = useState(false);
  const commitTime = () => {
    if (time === slpLocalTime(slot.publishAt)) return;
    const next = slpSlotAtTime(slot.publishAt, time);
    if (next) void onMove(next);
    else {
      toast.error(t("ui.slurp.settings.creators.schedulePast"));
      setTime(slpLocalTime(slot.publishAt));
    }
  };
  const inputClass =
    "min-h-11 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 text-base tabular-nums ring-1 ring-inset ring-[var(--slurp-outline,var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm";
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <input
        type="time"
        aria-label={t("ui.slurp.settings.creators.publicationTime")}
        value={time}
        disabled={pending}
        onChange={(event) => setTime(event.target.value)}
        onBlur={commitTime}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        className={inputClass}
      />
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slot.state === "prepared" ? "bg-[var(--slurp-success)]/12 text-[var(--slurp-success)]" : "bg-[var(--slurp-canvas,var(--accent))] text-[var(--slurp-muted,var(--muted-foreground))]"}`}
      >
        {slot.state === "prepared"
          ? t("ui.slurp.settings.creators.prepared")
          : t("ui.slurp.settings.creators.scheduled")}
      </span>
      {dayOpen ? (
        <input
          type="date"
          autoFocus
          aria-label={t("ui.slurp.settings.creators.anotherDay")}
          defaultValue={slpLocalDay(slot.publishAt)}
          min={slpLocalDay(new Date().toISOString())}
          disabled={pending}
          onBlur={(event) => {
            setDayOpen(false);
            const day = event.currentTarget.value;
            if (!day || day === slpLocalDay(slot.publishAt)) return;
            const next = slpSlotOnDay(slot.publishAt, day);
            if (next) void onMove(next);
            else toast.error(t("ui.slurp.settings.creators.schedulePast"));
          }}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className={`ms-auto ${inputClass}`}
        />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setDayOpen(true)}
          className="ms-auto min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--noodle-accent)] hover:bg-[var(--slurp-canvas,var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50"
        >
          {t("ui.slurp.settings.creators.anotherDay")}
        </button>
      )}
      {pending && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    </li>
  );
}

export function OverviewCard({
  icon,
  title,
  status,
  details,
  avatars,
  avatarTotal,
  onClick,
  tone,
  healthy,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  details: string[];
  avatars?: SlpCreatorManagedStageProfile[];
  avatarTotal?: number;
  onClick: () => void;
  tone: "pink" | "violet" | "blue" | "coral";
  healthy?: boolean;
}) {
  const toneClass =
    tone === "pink"
      ? "from-[var(--noodle-accent)] to-[#a51d61]"
      : tone === "violet"
        ? "from-[var(--slurp-violet)] to-[#7441a0]"
        : tone === "blue"
          ? "from-[#7777ef] to-[#5145bb]"
          : "from-[var(--slurp-coral)] to-[#b83f45]";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-36 rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-start shadow-[0_20px_48px_-38px_rgba(71,16,52,0.9)] ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${toneClass} text-white shadow-lg [&_svg]:!text-white`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-black">{title}</span>
            {healthy !== undefined &&
              (healthy ? (
                <CheckCircle2 size={15} className="shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
              ) : (
                <AlertTriangle size={15} className="shrink-0 text-[var(--slurp-warning)]" aria-hidden="true" />
              ))}
          </span>
          <span className="mt-2 block text-sm font-bold text-[var(--noodle-accent-foreground)]">{status}</span>
          {avatars && avatars.length > 0 && (
            <span className="mt-3 flex -space-x-2 rtl:space-x-reverse" aria-hidden="true">
              {avatars.map((creator) => (
                <span key={creator.id} className="rounded-full bg-[var(--slurp-surface-raised)] p-0.5">
                  <Avatar account={creator} size="sm" />
                </span>
              ))}
              {(avatarTotal ?? avatars.length) > avatars.length && (
                <span className="relative z-10 grid h-9 min-w-9 place-items-center rounded-full bg-[var(--slurp-canvas)] px-1.5 text-xs font-black tabular-nums text-[var(--slurp-text)] ring-2 ring-[var(--slurp-surface-raised)]">
                  +{(avatarTotal ?? avatars.length) - avatars.length}
                </span>
              )}
            </span>
          )}
          <span className="mt-2 block space-y-0.5">
            {details.map((detail) => (
              <span key={detail} className="block text-xs leading-4 text-[var(--slurp-muted)]">
                {detail}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight
          size={18}
          className="mt-1 shrink-0 text-[var(--slurp-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

export function OverviewActivity({
  reserveStatus,
  reserveLoading,
  reserveError,
  fanStatus,
  refreshPending,
  onRetry,
}: {
  reserveStatus?: SlurpReserveStatus;
  reserveLoading: boolean;
  reserveError: boolean;
  fanStatus?: { usedRuns: number; runLimit: number; lastRun: { status: string; finishedAt: string | null } | null };
  refreshPending: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const formatTime = (value: string | null | undefined) =>
    value ? formatClockTime(value, i18n.language) : t("ui.slurp.settings.overview.activity.notAvailable");
  const usage = reserveStatus ? `${reserveStatus.textAttemptsUsed} / ${reserveStatus.postsPerDay}` : "--";
  const fanUsage = fanStatus ? `${fanStatus.usedRuns} / ${fanStatus.runLimit}` : "--";

  return (
    <section
      className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
      aria-labelledby="slurp-activity-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
          <h2 id="slurp-activity-title" className="text-sm font-black">
            {t("ui.slurp.settings.overview.activity.title")}
          </h2>
        </div>
        {(reserveError || fanStatus === undefined) && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <RefreshCw size={13} aria-hidden="true" />
            {t("capabilities.actions.tryAgain")}
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ActivityRow
          icon={
            refreshPending ? (
              <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <CheckCircle2 size={15} />
            )
          }
          label={t("ui.slurp.settings.overview.activity.current")}
          value={
            refreshPending
              ? t("ui.slurp.settings.overview.activity.generating")
              : t("ui.slurp.settings.overview.activity.idle")
          }
          tone={refreshPending ? "active" : "ready"}
        />
        <ActivityRow
          icon={<CalendarClock size={15} />}
          label={t("ui.slurp.settings.overview.activity.prepared")}
          value={reserveLoading ? "..." : reserveStatus ? `${reserveStatus.preparedCount}` : "--"}
          detail={
            reserveStatus?.preparedThrough
              ? t("ui.slurp.settings.overview.activity.through", { time: formatTime(reserveStatus.preparedThrough) })
              : undefined
          }
          tone="waiting"
        />
        <ActivityRow
          icon={<Sparkles size={15} />}
          label={t("ui.slurp.settings.overview.activity.textUsage")}
          value={usage}
          detail={t("ui.slurp.settings.overview.activity.today")}
          tone="active"
        />
        <ActivityRow
          icon={<Megaphone size={15} />}
          label={t("ui.slurp.settings.overview.activity.audience")}
          value={fanUsage}
          detail={
            fanStatus?.lastRun
              ? t("ui.slurp.settings.overview.activity.lastRun", { time: formatTime(fanStatus.lastRun.finishedAt) })
              : undefined
          }
          tone="ready"
        />
      </div>
    </section>
  );
}

export function ActivityRow({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: "active" | "ready" | "waiting";
}) {
  const toneClass =
    tone === "active"
      ? "text-[var(--noodle-accent)]"
      : tone === "waiting"
        ? "text-[var(--slurp-warning)]"
        : "text-[var(--slurp-success)]";
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-lg bg-[var(--slurp-canvas)] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)]">
      <span className={`shrink-0 ${toneClass}`} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--slurp-muted)]">{label}</span>
        {detail && <span className="block truncate text-[0.68rem] text-[var(--slurp-muted)]">{detail}</span>}
      </span>
      <span className={`shrink-0 text-sm font-black ${toneClass}`}>{value}</span>
    </div>
  );
}

/**
 * Settings → Arcs library list. Deleting a built-in only hides it, so Reset can bring it back; a
 * custom type is removed. Running arcs hold their own copy and never see these edits.
 */
/** Mirrors `SLURP_MODIFIER_KINDS` on the server: the moods a chapter may start. */
export function PromptCard({
  title,
  value,
  isDefault,
  onEdit,
  onRestore,
  restoreLabel,
  disabled = false,
}: {
  title: string;
  value: string;
  isDefault: boolean;
  onEdit: () => void;
  onRestore: () => void;
  restoreLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]">
          <FileText size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{title}</p>
            <span className="rounded-full border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--noodle-accent)]">
              {isDefault ? t("ui.slurp.settings.prompts.default") : t("ui.slurp.settings.prompts.custom")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-45"
        >
          <Pencil size={14} className="text-[var(--noodle-accent)]" />
          {t("ui.slurp.settings.prompts.edit")}
        </button>
      </div>
      <div className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--slurp-muted)]">{value}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled || isDefault}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-45"
        >
          <RotateCcw size={13} />
          {restoreLabel ?? t("ui.slurp.settings.prompts.restoreDefault")}
        </button>
      </div>
    </div>
  );
}
export function PromptEditor({
  open,
  title,
  value,
  onChange,
  onClose,
  onSave,
  onRestore,
  pending,
  restoreLabel,
  saveLabel,
}: {
  open: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onRestore: () => void;
  pending: boolean;
  restoreLabel?: string;
  saveLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-3xl" closeDisabled={pending}>
      <div className="space-y-4">
        <label className="block text-sm font-semibold">
          <span className="sr-only">{title}</span>
          <textarea
            aria-label={title}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[22rem] w-full resize-y rounded-lg border border-[var(--border)] bg-transparent p-3 text-sm leading-6"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onRestore}
            disabled={pending}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] disabled:opacity-45"
          >
            <RotateCcw size={13} />
            {restoreLabel ?? t("ui.slurp.settings.prompts.restoreDefault")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-10 flex-1 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold sm:flex-none"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!value.trim() || pending}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-45"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saveLabel ?? t("ui.slurp.settings.prompts.save")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The managed ambient crowd: the background profiles that fill a feed out so a Creator is not
 * talking into an empty room.
 *
 * Listing them is what seeds them, so opening this panel is also what creates the roster. Reroll
 * regenerates an identity in place; the account, and anything already attached to it, survives.
 */
