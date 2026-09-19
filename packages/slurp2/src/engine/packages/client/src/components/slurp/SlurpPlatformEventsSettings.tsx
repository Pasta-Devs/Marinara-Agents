import { CalendarDays, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SLURP_PLATFORM_EVENT_GUIDANCE_MAX,
  slurpActivePlatformEvents,
  slurpPlatformEventSchema,
  slurpPlatformEventsDefault,
  type SlurpPlatformEvent,
} from "../../../../shared/src/slp/slp-platform-events.js";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { SectionTitle } from "../../slp/modules/settings/SlpSettingsControls";

const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50";

const pad = (value: number) => String(value).padStart(2, "0");
/** `MM-DD` for a native date input's month/day. The year is a placeholder: events recur. */
const dateValue = (item: SlurpPlatformEvent) => `2000-${pad(item.month)}-${pad(item.day)}`;

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
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SlurpPlatformEvent | null>(null);
  const activeIds = new Set(slurpActivePlatformEvents(events, new Date()).map((item) => item.id));
  const sorted = [...events].sort((a, b) => a.month - b.month || a.day - b.day);
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
      kind: "calendar",
      name: t("ui.slurp.settings.events.newName", { defaultValue: "New event" }),
      enabled: true,
      month: today.getUTCMonth() + 1,
      day: today.getUTCDate(),
      durationDays: 1,
      guidance: "",
      // A hand-added event carries no modifier. The editor has no control for one, and Slurp ships
      // no default sale, so the seam exists without anything using it yet.
      modifiers: [],
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
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
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
          {t("ui.slurp.settings.events.start", { defaultValue: "Starts (every year)" })}
          <input
            type="date"
            value={dateValue(draft)}
            min="2000-01-01"
            max="2000-12-31"
            onChange={(event) => {
              const [, month, day] = event.target.value.split("-").map(Number);
              if (month && day) setDraft({ ...draft, month, day });
            }}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          {t("ui.slurp.settings.events.duration", { defaultValue: "Days" })}
          <input
            type="number"
            min={1}
            max={31}
            value={draft.durationDays}
            onChange={(event) => setDraft({ ...draft, durationDays: Number(event.target.value) })}
            className={fieldClass}
          />
        </label>
      </div>
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
            "While an event runs, its guidance goes into every Creator's posts and messages. Events repeat every year.",
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
        <ul className="space-y-2">
          {sorted.map((item) => {
            const expanded = selectedId === item.id;
            return (
              <li key={item.id} className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-[var(--slurp-surface-raised)] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)]">
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
                      {t("ui.slurp.settings.events.when", {
                        defaultValue: "{{month}}/{{day}} · {{count}} days",
                        month: pad(item.month),
                        day: pad(item.day),
                        count: item.durationDays,
                      })}
                    </span>
                  </button>
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
