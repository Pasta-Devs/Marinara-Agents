import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton } from "../chrome/SlpButton";
import { SlpSheet } from "../chrome/SlpSheet";
import type { SlpBreakupAftermath } from "../../../../../shared/src/slp/slp-actions.js";

/**
 * What a breakup leaves behind (#1293): the usual memory and fallout, moving on (remembered, no
 * pining), or forgetting the relationship (left out of future posts and chats; old posts stay).
 * Rows with a line each, so the choice says what it does before anything runs.
 */
export function SlpBreakupAftermathPick({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SlpBreakupAftermath[];
  value: SlpBreakupAftermath | null;
  onChange: (value: SlpBreakupAftermath) => void;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  // One tab stop: the checked row (or the first); arrows move and pick, like native radios.
  const current = Math.max(0, value ? options.indexOf(value) : 0);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : step ? current + step : null;
    if (index === null || !options.length) return;
    event.preventDefault();
    const next = (index + options.length) % options.length;
    onChange(options[next]!);
    rows.current[next]?.focus();
  };
  return (
    <div className="min-w-0 space-y-2" data-slp-breakup-aftermath>
      <p id={labelId} className={cn(SLP_TYPE.meta, "font-semibold")}>
        {label}
      </p>
      <div className="space-y-1.5" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {options.map((option, index) => {
          const on = value === option;
          return (
            <button
              key={option}
              ref={(node) => {
                rows.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={index === current ? 0 : -1}
              autoFocus={index === current}
              aria-labelledby={`${labelId}-${option}`}
              aria-describedby={`${labelId}-${option}-hint`}
              data-slp-aftermath={option}
              onClick={() => onChange(option)}
              className={cn(
                "flex min-h-12 w-full flex-col justify-center rounded-2xl px-3 py-2 text-start ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                on
                  ? "bg-[image:var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45"
                  : "bg-[var(--slurp-canvas)] ring-[var(--slurp-outline)] hover:bg-[var(--accent)]",
              )}
            >
              <span id={`${labelId}-${option}`} className={cn(SLP_TYPE.body, "block font-semibold")}>
                {t(`ui.slurp.breakup.aftermath.${option}`)}
              </span>
              <span id={`${labelId}-${option}-hint`} className={cn(SLP_TYPE.meta, "block text-[var(--slurp-muted)]")}>
                {t(`ui.slurp.breakup.aftermath.${option}Hint`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The breakup step outside the Stir sheet (Studio's couples, You two): pick what it leaves behind,
 * then confirm. For a couple that already split, the same sheet changes how they handle it now.
 */
export function SlpBreakupAftermathSheet({
  open,
  title,
  label,
  options,
  confirmLabel,
  busy,
  undoable = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  options: readonly SlpBreakupAftermath[];
  confirmLabel: string;
  busy: boolean;
  /** False when Undo cannot take it back (a breakup closes an open shared page), so no undo line. */
  undoable?: boolean;
  onConfirm: (value: SlpBreakupAftermath) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState<SlpBreakupAftermath | null>(options[0] ?? null);
  // Each opening starts on the first choice: "keep" for a breakup, the other way for an ex.
  useEffect(() => {
    if (open) setValue(options[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.join("|")]);
  return (
    <SlpSheet
      open={open}
      onClose={onClose}
      closeDisabled={busy}
      title={title}
      footer={
        <div className="flex gap-2 px-3 py-2">
          <SlpButton variant="quiet" className="flex-1" disabled={busy} onClick={onClose}>
            {t("ui.slurp.breakup.cancel")}
          </SlpButton>
          <SlpButton
            variant="danger"
            className="flex-1"
            disabled={busy || !value}
            onClick={() => value && onConfirm(value)}
          >
            {confirmLabel}
          </SlpButton>
        </div>
      }
    >
      <div className="space-y-3 px-3 pb-2">
        <SlpBreakupAftermathPick label={label} options={options} value={value} onChange={setValue} />
        {undoable && <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.breakup.undoHint")}</p>}
      </div>
    </SlpSheet>
  );
}
