import { useStartStoryEvent } from "./slp-story-hooks";
import { toast } from "sonner";
import { CalendarDays, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SLURP_PLATFORM_EVENT_GUIDANCE_MAX,
  slurpActivePlatformEvents,
  slurpPlatformEventSchema,
  slurpPlatformEventsDefault,
  type SlurpPlatformEvent,
} from "../../../../../shared/src/slp/slp-platform-events.js";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { SectionTitle } from "../../modules/settings/SlpSettingsControls";

const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50";

const pad = (value: number) => String(value).padStart(2, "0");
/** `MM-DD` for a native date input's month/day. The year is a placeholder: events recur. */
const dateValue = (item: SlurpPlatformEvent) =>
  item.activation.kind === "annual" ? `2000-${pad(item.activation.month)}-${pad(item.activation.day)}` : "2000-01-01";
const eventOrder = (item: SlurpPlatformEvent) =>
  item.activation.kind === "annual" ? item.activation.month * 100 + item.activation.day : 20_000;
/** "Jan 1 · 1 day" in the reader's language. The year is a placeholder: annual events recur. */
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
const eventWhen = (item: SlurpPlatformEvent, language?: string) => {
  const rule = item.activation;
  if (rule.kind === "annual")
    return `${new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "UTC" }).format(Date.UTC(2000, rule.month - 1, rule.day))} · ${days(rule.durationDays)}`;
  if (rule.kind === "window") return `${rule.startsAt.slice(0, 10)} – ${rule.endsAt.slice(0, 10)}`;
  if (rule.kind === "manual") return `Manual · ${days(rule.durationDays)}`;
  if (rule.kind === "creator-milestone") return `${rule.metric} reaches ${rule.threshold.toLocaleString()}`;
  if (rule.kind === "notable-post") return `A post reaches ${rule.reach.toLocaleString()}`;
  if (rule.kind === "arc-lifecycle") return `Tagged arc ${rule.phase}`;
  return `${rule.chancePercent}% ${rule.period} chance`;
};

/** Holidays and site-wide events. Click a row to edit it in place. */
export function SlurpPlatformEventsSettings({
  events,
  saving,
  onSave,
}: {
  events: SlurpPlatformEvent[];
  saving: boolean;
  onSave: (events: SlurpPlatformEvent[]) => Promise<boolean>;
}) {
  const startEvent = useStartStoryEvent();
  const { t, i18n } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SlurpPlatformEvent | null>(null);
  const activeIds = new Set(slurpActivePlatformEvents(events, new Date()).map((item) => item.id));
  const sorted = [...events].sort((a, b) => eventOrder(a) - eventOrder(b) || a.name.localeCompare(b.name));
  const valid = draft ? slurpPlatformEventSchema.safeParse(draft).success : false;

  const open = (item: SlurpPlatformEvent) => {
    if (selectedId === item.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(item.id);
    setDraft({ ...item });
  };
  const add = () => {
    const today = new Date();
    const item: SlurpPlatformEvent = {
      id: `custom-${Date.now().toString(36)}`,
      contentId: `custom-${Date.now().toString(36)}`,
      name: t("ui.slurp.settings.events.newName", { defaultValue: "New event" }),
      enabled: true,
      guidance: "",
      storyTags: [],
      activation: { kind: "annual", month: today.getUTCMonth() + 1, day: today.getUTCDate(), durationDays: 1 },
      target: { kind: "all" },
      influences: [],
      arcOpportunities: [],
      outcomes: [],
      automation: "inherit",
      builtin: false,
      hidden: false,
    };
    setSelectedId(item.id);
    setDraft(item);
  };
  const save = async () => {
    const parsed = draft && slurpPlatformEventSchema.safeParse(draft);
    if (!parsed?.success) return;
    const exists = events.some((item) => item.id === parsed.data.id);
    const next = exists
      ? events.map((item) => (item.id === parsed.data.id ? parsed.data : item))
      : [...events, parsed.data];
    if (await onSave(next)) setSelectedId(null);
  };
  const remove = async (item: SlurpPlatformEvent) => {
    if (!events.some((entry) => entry.id === item.id)) {
      setSelectedId(null);
      return;
    }
    if (await onSave(events.filter((entry) => entry.id !== item.id))) setSelectedId(null);
  };
  const toggle = (item: SlurpPlatformEvent) =>
    void onSave(events.map((entry) => (entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry)));
  const restore = async () => {
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.settings.events.restore", { defaultValue: "Restore default events" }),
      message: t("ui.slurp.settings.events.restoreConfirm", {
        defaultValue: "This replaces your event list with the default holidays. Your custom events are removed.",
      }),
      confirmLabel: t("ui.slurp.settings.events.restore", { defaultValue: "Restore default events" }),
      cancelLabel: t("ui.slurp.actions.cancel"),
    });
    if (confirmed && (await onSave(slurpPlatformEventsDefault()))) setSelectedId(null);
  };

  const editor = draft && (
    <div
      id="slurp-event-editor"
      className="space-y-3 rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised)] p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.events.name", { defaultValue: "Name" })}
          <input
            value={draft.name}
            maxLength={60}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.events.automation", { defaultValue: "Automation" })}
          <select
            value={draft.automation}
            onChange={(event) =>
              setDraft({ ...draft, automation: event.target.value as SlurpPlatformEvent["automation"] })
            }
            className={fieldClass}
          >
            <option value="inherit">Use World setting</option>
            <option value="manual">Manual only</option>
            <option value="suggest">Suggest</option>
            <option value="auto">Start automatically</option>
          </select>
        </label>
      </div>
      <fieldset className="space-y-3 rounded-lg bg-[var(--slurp-canvas)] p-3">
        <legend className="px-1 text-sm font-bold">
          {t("ui.slurp.settings.events.whenTitle", { defaultValue: "When" })}
        </legend>
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.events.trigger", { defaultValue: "Activation rule" })}
          <select
            value={draft.activation.kind}
            onChange={(event) => {
              const kind = event.target.value;
              setDraft({
                ...draft,
                activation:
                  kind === "manual"
                    ? { kind: "manual", durationDays: 7 }
                    : { kind: "annual", month: 1, day: 1, durationDays: 1 },
              });
            }}
            className={fieldClass}
          >
            <option value="annual">Annual date</option>
            <option value="manual">Manual campaign</option>
            {!(["annual", "manual"] as string[]).includes(draft.activation.kind) && (
              <option value={draft.activation.kind}>Existing advanced trigger</option>
            )}
          </select>
        </label>
        {draft.activation.kind === "annual" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold">
              {t("ui.slurp.settings.events.start", { defaultValue: "Starts every year" })}
              <input
                type="date"
                value={dateValue(draft)}
                min="2000-01-01"
                max="2000-12-31"
                onChange={(event) => {
                  const [, month, day] = event.target.value.split("-").map(Number);
                  if (month && day && draft.activation.kind === "annual")
                    setDraft({ ...draft, activation: { ...draft.activation, month, day } });
                }}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              {t("ui.slurp.settings.events.duration", { defaultValue: "Duration in days" })}
              <input
                type="number"
                min={1}
                max={31}
                value={draft.activation.durationDays}
                onChange={(event) =>
                  draft.activation.kind === "annual" &&
                  setDraft({ ...draft, activation: { ...draft.activation, durationDays: Number(event.target.value) } })
                }
                className={fieldClass}
              />
            </label>
          </div>
        )}
        {draft.activation.kind === "manual" && (
          <label className="grid gap-1 text-xs font-semibold">
            {t("ui.slurp.settings.events.duration", { defaultValue: "Default duration in days" })}
            <input
              type="number"
              min={1}
              max={365}
              value={draft.activation.durationDays}
              onChange={(event) =>
                draft.activation.kind === "manual" &&
                setDraft({ ...draft, activation: { ...draft.activation, durationDays: Number(event.target.value) } })
              }
              className={fieldClass}
            />
          </label>
        )}
      </fieldset>
      <fieldset className="space-y-3 rounded-lg bg-[var(--slurp-canvas)] p-3">
        <legend className="px-1 text-sm font-bold">
          {t("ui.slurp.settings.events.whoTitle", { defaultValue: "Who" })}
        </legend>
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.events.target", { defaultValue: "Creators" })}
          <select
            value={draft.target.kind}
            onChange={(event) =>
              setDraft({
                ...draft,
                target: event.target.value === "random" ? { kind: "random", min: 1, max: 3 } : { kind: "all" },
              })
            }
            className={fieldClass}
          >
            <option value="all">All current Creators</option>
            <option value="random">A deterministic random subset</option>
            {!(["all", "random"] as string[]).includes(draft.target.kind) && (
              <option value={draft.target.kind}>Existing filtered target</option>
            )}
          </select>
        </label>
        {draft.target.kind === "random" && (
          <p className="text-xs text-[var(--slurp-muted)]">
            This event will choose {draft.target.min}–{draft.target.max} matching Creators once, then keep that
            participant list.
          </p>
        )}
      </fieldset>
      <label className="grid gap-1 text-xs font-semibold">
        {t("ui.slurp.settings.events.guidance", { defaultValue: "Guidance for Creators" })}
        <textarea
          value={draft.guidance}
          maxLength={SLURP_PLATFORM_EVENT_GUIDANCE_MAX}
          rows={3}
          onChange={(event) => setDraft({ ...draft, guidance: event.target.value })}
          placeholder={t("ui.slurp.settings.events.guidancePlaceholder", {
            defaultValue: "What is going on, and how it should colour posts and messages.",
          })}
          className={cn(fieldClass, "py-2")}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || !valid}
          onClick={() => void save()}
          className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {t("ui.slurp.settings.events.save", { defaultValue: "Save event" })}
        </button>
        <button type="button" onClick={() => setSelectedId(null)} className={buttonClass}>
          {t("ui.slurp.actions.cancel")}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void remove(draft)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-[var(--slurp-canvas)] disabled:opacity-50"
        >
          <Trash2 size={14} aria-hidden="true" />
          {t("ui.slurp.settings.events.delete", { defaultValue: "Delete" })}
        </button>
      </div>
    </div>
  );
  const isNew = selectedId !== null && !events.some((item) => item.id === selectedId);

  return (
    <div className="space-y-5">
      <SectionTitle
        title={t("ui.slurp.settings.events.title", { defaultValue: "Events and holidays" })}
        detail={t("ui.slurp.settings.events.detail", {
          defaultValue:
            "Events can recur, run as campaigns, or react to the world. Suggestions wait for your approval by default.",
        })}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={add} className={buttonClass}>
          <Plus size={15} aria-hidden="true" />
          {t("ui.slurp.settings.events.add", { defaultValue: "Add event" })}
        </button>
        <button type="button" disabled={saving} onClick={() => void restore()} className={buttonClass}>
          <RotateCcw size={15} aria-hidden="true" />
          {t("ui.slurp.settings.events.restore", { defaultValue: "Restore default events" })}
        </button>
      </div>
      {isNew && editor}
      {sorted.length === 0 && !isNew ? (
        <p className="text-sm text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.events.empty", { defaultValue: "No events. Add one or restore the defaults." })}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--slurp-outline)] overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {sorted.map((item) => {
            const expanded = selectedId === item.id;
            return (
              <li key={item.id} className="space-y-2 px-3 py-1.5 sm:px-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    disabled={saving}
                    onChange={() => toggle(item)}
                    aria-label={t("ui.slurp.settings.events.enabled", {
                      defaultValue: "{{name}} enabled",
                      name: item.name,
                    })}
                    className="size-4 accent-[var(--noodle-accent)]"
                  />
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={expanded ? "slurp-event-editor" : undefined}
                    onClick={() => open(item)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-[var(--noodle-accent)]" />
                    <span className={cn("min-w-0 flex-1 truncate text-sm font-bold", !item.enabled && "opacity-60")}>
                      {item.name}
                    </span>
                    {activeIds.has(item.id) && (
                      <span className="rounded-full bg-[var(--noodle-accent)]/15 px-2 py-0.5 text-xs font-bold text-[var(--noodle-accent)]">
                        {t("ui.slurp.settings.events.active", { defaultValue: "Running now" })}
                      </span>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-[var(--slurp-muted)]">
                      {eventWhen(item, i18n.language)}
                    </span>
                  </button>
                  {item.activation.kind === "manual" && item.enabled && (
                    <button
                      type="button"
                      disabled={startEvent.isPending}
                      onClick={() =>
                        startEvent.mutate(item.id, {
                          onSuccess: () =>
                            toast.success(
                              t("ui.slurp.settings.events.started", {
                                defaultValue: "{{name}} started.",
                                name: item.name,
                              }),
                            ),
                          onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
                        })
                      }
                      className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
                    >
                      {t("ui.slurp.settings.events.start", { defaultValue: "Start now" })}
                    </button>
                  )}
                </div>
                {expanded && editor}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
