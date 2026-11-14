import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SVGAttributes,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Check, Info, Loader2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { LtmLocalizationProvider, useLtmTranslation } from "./localization";
import { sourceCheckboxClass } from "./sources/source-shared";
import type { CapabilityProps } from "./types";

let activePopover: { id: string; close: () => void } | null = null;

export const inputClass = "mari-editor-field min-h-11 w-full px-3 text-sm";
// py-1, not py-2: on touch devices the Engine sets field text to 16px (no iOS focus zoom), and the field must stay 36px.
export const compactInputClass = "mari-chrome-field min-h-9 w-full !rounded-md px-3 py-1 text-xs";
// `relative` paints the field above a compact info button's enlarged hit area.
export const compactInputStyle = { color: "var(--foreground)", position: "relative" } as const;

/**
 * Scrolls a keyboard-focused control out from under a pinned batch bar. The browser scrolls focus
 * only to the edge of the scroller, which leaves Shift+Tab under a top bar and Tab under a bottom one.
 */
export function revealFocusUnderStickyBar(event: FocusEvent<HTMLElement>, bar: HTMLElement | null) {
  const target = event.target;
  if (!bar || bar.contains(target)) return;
  requestAnimationFrame(() => {
    if (getComputedStyle(bar).position !== "sticky" || !target.matches(":focus-visible")) return;
    const barRect = bar.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (targetRect.bottom > barRect.top && targetRect.top < barRect.bottom) target.scrollIntoView({ block: "center" });
  });
}

/**
 * Props for a control whose lock is temporary (work running, loading, edits unsaved elsewhere): it stays
 * focusable and `Button`/`IconButton` dim on `aria-disabled`. Enter and Space still fire `onClick`, and a
 * submit button still submits, so the caller's handler needs its own early return. Native `disabled` is for
 * permanent unavailability or input validity.
 */
export function lockedActionProps(locked: boolean, reasonId?: string) {
  return locked ? ({ "aria-disabled": true, ...(reasonId ? { "aria-describedby": reasonId } : {}) } as const) : {};
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    primary?: boolean;
    destructive?: boolean;
    /** A toggle or filter chip: the Engine's small chrome control, which draws its own `aria-pressed` look. */
    chip?: boolean;
    /** A square icon-only chip; implies `chip`. */
    icon?: boolean;
  }
>(function Button(
  { children, primary = false, destructive = false, chip = false, icon = false, className = "", style, ...props },
  ref,
) {
  if (chip || icon) {
    return (
      <button
        ref={ref}
        type="button"
        data-ltm-control="button"
        className={`mari-chrome-control mari-chrome-control--small ${icon ? "mari-chrome-control--icon" : ""} ${props["aria-disabled"] ? "opacity-50" : ""} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </button>
    );
  }
  const tone = primary ? "mari-editor-action--primary" : destructive ? "mari-editor-action--danger" : "";
  return (
    <button
      ref={ref}
      type="button"
      data-ltm-control="button"
      className={`mari-editor-action min-h-11 px-3 ${props["aria-disabled"] ? "opacity-50" : ""} ${tone} ${className}`}
      style={className.includes("mari-editor-action--compact") ? style : { minHeight: "2.75rem", ...style }}
      {...props}
    >
      {children}
    </button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  destructive = false,
  iconSize = "0.875rem",
  iconClassName,
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
  iconSize?: string;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-ltm-control="icon-button"
      className={`mari-editor-action h-11 min-h-11 w-11 min-w-11 shrink-0 p-0 ${props["aria-disabled"] ? "opacity-50" : ""} ${destructive ? "mari-editor-action--danger" : ""} ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" size={iconSize} className={iconClassName} />
    </button>
  );
}

export function ClickSurface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`focus-within:ring-2 focus-within:ring-[var(--ring)] ${className}`} {...props} />;
}

export type ChipTone = "plain" | "neutral" | "muted" | "success" | "warning" | "critical" | "danger";

const chipToneClass: Record<ChipTone, string> = {
  // The normal state: no border or fill, so only a state that needs attention draws the eye.
  plain: "",
  neutral: "border border-[var(--border)] bg-[var(--secondary)]",
  // A place or other secondary fact: outlined, no fill.
  muted: "border border-[var(--border)] text-[var(--muted-foreground)]",
  success: "border border-[var(--border)] bg-[var(--marinara-editor-accent)]/15",
  warning: "border border-[var(--marinara-editor-border-strong)]",
  // Like danger but the text stays at full strength (a missing or invalid source).
  critical: "border border-[var(--destructive)]",
  danger: "border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 text-[var(--destructive)]",
};

/** The one small label: a memory's type, state, origin or place, and every status beside a row or heading. */
export function Chip({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return <span className={`rounded px-1.5 py-0.5 ${chipToneClass[tone]} ${className}`} {...props} />;
}

/** "Global default" (with the value when there is one) beside a setting that follows the default for all chats. */
export function DefaultChip({ value }: { value?: string }) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
      <Chip className="inline-flex">
        {value === undefined
          ? localizeUi("ui.longTermMemory.chatsettings.globalDefault")
          : localizeUi("ui.longTermMemory.chatsettings.globalDefaultValue", { value })}
      </Chip>
    </span>
  );
}

const REMOVABLE_FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])';

// Removing a chip unmounts its focused button, so focus moves to the chip now in its place, else
// the previous chip, else the first control after the chip list.
function removeAndKeepFocus(event: MouseEvent<HTMLButtonElement>, onRemove: () => void) {
  const button = event.currentTarget;
  const list = button.closest("[data-ltm-pill]")?.parentElement;
  if (!list) return onRemove();
  const index = [...list.querySelectorAll("[data-ltm-pill-remove]")].indexOf(button);
  const after = [...document.querySelectorAll<HTMLElement>(REMOVABLE_FOCUSABLE)].find(
    (element) =>
      !list.contains(element) &&
      Boolean(list.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      element.getClientRects().length > 0,
  );
  onRemove();
  requestAnimationFrame(() => {
    const remaining = list.isConnected ? [...list.querySelectorAll<HTMLElement>("[data-ltm-pill-remove]")] : [];
    const target = remaining[Math.min(index, remaining.length - 1)] ?? (after?.isConnected ? after : null);
    target?.focus({ preventScroll: true });
  });
}

/** A chip with a remove button, for values the person can take away (places, subjects, keywords, links, filters). */
export function RemovableChip({
  children,
  label,
  removeLabel: removeLabelOverride,
  disabled,
  onRemove,
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, "onClick" | "className"> & {
  children: ReactNode;
  /** Names the chip in the default "Remove {name}" button label. */
  label?: string;
  /** Replaces the whole remove-button label ("Clear memory filter"). */
  removeLabel?: string;
  /** Keeps the button reachable and named but inert, with the reason given by the caller (aria-disabled). */
  disabled?: boolean;
  onRemove: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const removeLabel =
    removeLabelOverride ??
    localizeUi("ui.longTermMemory.pill.removeValue1", {
      value1: label ?? String(children),
    });
  return (
    <span
      {...props}
      data-ltm-pill
      className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]"
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        data-ltm-pill-remove
        onClick={(event) => {
          if (!disabled) removeAndKeepFocus(event, onRemove);
        }}
        aria-disabled={disabled || undefined}
        aria-label={removeLabel}
        title={removeLabel}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded leading-none hover:bg-[var(--accent)]${disabled ? " opacity-50" : ""}`}
      >
        <X aria-hidden="true" size="0.75rem" />
      </button>
    </span>
  );
}

export function InfoPopover({
  label,
  content,
  wide = false,
  compact = false,
}: {
  label: string;
  content: ReactNode;
  wide?: boolean;
  compact?: boolean;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const closeRef = useRef<(restoreFocus?: boolean) => void>(() => undefined);

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const close = (restoreFocus = false) => {
    clearCloseTimer();
    setOpen(false);
    setPinned(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  closeRef.current = close;
  const show = () => {
    clearCloseTimer();
    if (activePopover?.id !== id) activePopover?.close();
    activePopover = { id, close: closeRef.current };
    setOpen(true);
  };
  const scheduleClose = () => {
    if (pinned) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(close, 120);
  };

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = panelRef.current?.offsetWidth ?? (wide ? 416 : 288);
      const height = panelRef.current?.offsetHeight ?? 160;
      const gap = 8;
      const left = Math.min(Math.max(8, trigger.left), Math.max(8, window.innerWidth - width - 8));
      const below = trigger.bottom + gap;
      const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, trigger.top - gap - height);
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [compact, open, wide]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [id, open]);

  useEffect(() => {
    if (open) activePopover = { id, close: closeRef.current };
    return () => {
      clearCloseTimer();
      if (activePopover?.id === id) activePopover = null;
    };
  }, [id, open, pinned]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={localizeUi("ui.longTermMemory.infopopover.aboutValue1", {
          value1: label,
        })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-describedby={open && !pinned ? `${id}-panel` : undefined}
        data-ltm-info={label}
        className={`${compact ? "h-7 w-7" : "h-11 w-11"} inline-flex shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        style={
          compact
            ? { position: "relative", height: "1.75rem", width: "1.75rem", flexShrink: 0 }
            : { height: "2.75rem", width: "2.75rem", flexShrink: 0 }
        }
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={(event) => {
          if (!panelRef.current?.contains(event.relatedTarget as Node)) scheduleClose();
        }}
        onClick={() => {
          if (pinned) close();
          else {
            show();
            setPinned(true);
          }
        }}
      >
        <Info aria-hidden="true" size="0.875rem" />
        {/* The compact glyph keeps its 1.75rem box; this layer widens the touch target to 2.75rem. */}
        {compact ? <span aria-hidden="true" style={{ position: "absolute", inset: "-0.5rem" }} /> : null}
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={`${id}-panel`}
              role={pinned ? "dialog" : "tooltip"}
              aria-modal={pinned ? false : undefined}
              aria-label={pinned ? label : undefined}
              data-ltm-info-panel={label}
              style={{
                top: position.top,
                left: position.left,
                // ponytail: an unpinned panel never takes a click meant for the control under it, so hover content cannot be hovered, scrolled or selected; click the trigger to pin it.
                pointerEvents: pinned ? undefined : "none",
                maxHeight: "min(20rem, calc(100vh - 1rem))",
                width: wide ? "min(26rem, calc(100vw - 1rem))" : "min(18rem, calc(100vw - 1rem))",
              }}
              className="mari-editor-panel fixed z-[100] overflow-auto p-3 text-xs leading-5 text-[var(--marinara-editor-text)] shadow-lg"
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleClose}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  busy = false,
  help,
  hint,
  unit,
  compact = false,
  placeholder,
  integer = false,
  liveCommit = false,
}: {
  label: string;
  /** `null` is a value not yet known: the field stays empty (showing `placeholder`) instead of an invented number. */
  value: number | null;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** A save is in flight: stay focusable (aria-disabled, read-only) instead of dropping focus like `disabled`. */
  busy?: boolean;
  help?: ReactNode;
  /** Muted lines under the input, read with it (`aria-describedby`); use instead of `help` when the text is short. */
  hint?: ReactNode;
  /** A short suffix beside the input, such as "tokens". */
  unit?: string;
  compact?: boolean;
  placeholder?: string;
  /** Whole numbers only: a typed decimal is rounded after the clamp, before it is shown or reported. */
  integer?: boolean;
  /**
   * Report a valid in-range number while it is typed, not only on blur or Enter, so a form that tracks unsaved changes
   * sees it at once. An empty, out-of-range or non-whole draft waits for the commit, which keeps its revert and clamp.
   */
  liveCommit?: boolean;
}) {
  const id = useId();
  const valueText = value === null ? "" : String(value);
  const [text, setText] = useState(valueText);
  const committedText = useRef(valueText);
  // The value when editing began: a live-committed draft that is then emptied or escaped goes back to it, not to a prefix.
  const editStart = useRef(valueText);
  const restoreEditStart = () => {
    const start = editStart.current;
    if (!liveCommit || !start.trim() || start === committedText.current) return false;
    setText(start);
    committedText.current = start;
    onChange(Number(start));
    return true;
  };
  const commit = () => {
    if (!text.trim()) {
      if (!restoreEditStart()) setText(committedText.current);
      return;
    }
    const next = Number(text);
    if (!Number.isFinite(next)) {
      setText(valueText);
      return;
    }
    const clamped = Math.max(min, Math.min(max, integer ? Math.round(next) : next));
    setText(String(clamped));
    if (String(clamped) === committedText.current) return;
    committedText.current = String(clamped);
    onChange(clamped);
  };
  const typeLive = (draft: string) => {
    setText(draft);
    if (!liveCommit || !draft.trim()) return;
    const next = Number(draft);
    if (!Number.isFinite(next) || next < min || next > max || (integer && !Number.isInteger(next))) return;
    if (String(next) === committedText.current) return;
    committedText.current = String(next);
    onChange(next);
  };
  useEffect(() => {
    // A live-committed draft already reads as typed; only a value that came from elsewhere replaces the text.
    const external = committedText.current !== valueText;
    committedText.current = valueText;
    if (external) setText(valueText);
  }, [valueText]);
  const input = (
    <input
      id={id}
      aria-labelledby={`${id}-label`}
      aria-describedby={hint ? `${id}-hint` : undefined}
      data-ltm-control="number"
      className={`${compact ? compactInputClass : inputClass}${unit ? " min-w-0" : ""}${busy ? " opacity-50" : ""}`}
      style={{ ...(compact ? compactInputStyle : null), width: compact ? "min(100%, 8rem)" : "min(100%, 9rem)" }}
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      aria-disabled={busy || undefined}
      readOnly={busy}
      onChange={(event) => typeLive(event.target.value)}
      onFocus={() => {
        editStart.current = committedText.current;
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          if (!restoreEditStart()) setText(valueText);
        }
      }}
    />
  );
  return (
    <div className={`space-y-1 font-semibold ${compact ? "text-[0.625rem]" : "text-xs"}`}>
      <span className="flex items-center gap-1 text-[var(--foreground)]">
        <span id={`${id}-label`}>{label}</span>
        {help ? <InfoPopover label={label} content={help} compact={compact} /> : null}
      </span>
      {unit ? (
        <div className="flex items-center gap-2">
          {input}
          <span aria-hidden="true" data-ltm-unit className="shrink-0 font-normal text-[var(--muted-foreground)]">
            {unit}
          </span>
        </div>
      ) : (
        input
      )}
      {hint ? (
        <div
          id={`${id}-hint`}
          data-ltm-field-hint
          className="space-y-0.5 text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** A dial for a value people tune by feel (a weight, a threshold): the label row reads the value out, and optional ends say which way is which. */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
  hint,
  ends,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  help?: ReactNode;
  /** One muted line under the label, read with the track; use instead of `help` when the text is short. */
  hint?: string;
  /** What the low and high ends mean, shown under the track and read with it. */
  ends?: [low: string, high: string];
  disabled?: boolean;
}) {
  const id = useId();
  // Two decimals unless the value needs a third (preset weights such as 0.105).
  const readout = value.toFixed(Math.round(value * 1000) % 10 ? 3 : 2);
  return (
    <div className="space-y-1 text-xs font-semibold">
      <span className="flex items-center gap-1 text-[var(--foreground)]">
        <span id={`${id}-label`}>{label}</span>
        {help ? <InfoPopover label={label} content={help} /> : null}
        <output
          htmlFor={id}
          data-ltm-slider-readout
          className="ml-auto tabular-nums font-normal text-[var(--muted-foreground)]"
        >
          {readout}
        </output>
      </span>
      <input
        id={id}
        type="range"
        data-ltm-control="slider"
        aria-labelledby={`${id}-label`}
        aria-describedby={
          [hint ? `${id}-hint` : null, ends ? `${id}-ends` : null].filter(Boolean).join(" ") || undefined
        }
        aria-valuetext={readout}
        className="block min-h-11 w-full cursor-pointer accent-[var(--primary)]"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? (
        <div
          id={`${id}-hint`}
          data-ltm-field-hint
          className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
        >
          {hint}
        </div>
      ) : null}
      {ends ? (
        <div
          id={`${id}-ends`}
          data-ltm-slider-ends
          className="flex justify-between gap-2 text-[0.625rem] font-normal text-[var(--muted-foreground)]"
        >
          <span>{ends[0]}</span>
          <span className="text-right">{ends[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

export function StatusSurface({
  children,
  tone = "neutral",
  busy = false,
  compact = false,
  className = "",
  style,
  ...props
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  busy?: boolean;
  compact?: boolean;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const toneClass = {
    neutral: "text-[var(--marinara-editor-muted)]",
    success: "",
    warning: "text-[var(--marinara-editor-text)]",
    danger: "text-[var(--destructive)]",
  }[tone];
  // No Engine defines a warning color, so a warning says so with an icon and the strong editor border. Tone
  // borders are inline because the Engine's unlayered .mari-editor-panel border outranks utility classes.
  const warning = tone === "warning";
  const borderColor = warning
    ? "var(--marinara-editor-border-strong)"
    : tone === "danger"
      ? "color-mix(in oklab, var(--destructive) 35%, transparent)"
      : undefined;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      data-ltm-status={tone}
      className={`${compact ? `rounded-md border ${borderColor ? "" : "border-[var(--border)]"} bg-[var(--background)]/75 px-2 py-1.5 text-[0.625rem]` : "mari-editor-panel mari-editor-panel--soft min-h-11 px-3 py-2 text-xs"} flex items-center gap-2 ${toneClass} ${className}`}
      style={{
        ...(borderColor ? { borderColor } : null),
        // Accent text on the accent-tinted surface is below 4.5:1 in the light theme, so success text uses a
        // package-local token (accent mixed toward the editor text) set in LongTermMemoryDetail's style block.
        ...(tone === "success" ? { color: "var(--ltm-success, var(--marinara-editor-text))" } : null),
        ...style,
      }}
      {...props}
    >
      {busy ? <Spinner /> : null}
      {warning ? (
        <TriangleAlert
          aria-hidden="true"
          size={compact ? "0.75rem" : "1rem"}
          className="shrink-0"
          data-ltm-status-icon
        />
      ) : null}
      {tone === "success" ? (
        <Check aria-hidden="true" size={compact ? "0.75rem" : "1rem"} className="shrink-0" data-ltm-status-icon />
      ) : null}
      {children}
    </div>
  );
}

/** The one "working" mark. Reduced motion stops the spin, so the label beside it carries the state. */
export function Spinner({
  size = "0.875rem",
  className = "",
  ...props
}: { size?: string; className?: string } & SVGAttributes<SVGSVGElement>) {
  return (
    <Loader2
      aria-hidden="true"
      size={size}
      className={`animate-spin motion-reduce:animate-none${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}

/** Nothing here yet: one muted line. Not a live region; a result line is `StatusSurface`. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">{children}</p>;
}

/** The one button that reveals the rest of a list; `busy` shows the spinner while the rest loads. */
export function ShowMore({
  busy = false,
  children,
  ...props
}: { busy?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button {...props}>
      {busy ? <Spinner /> : null}
      {children}
    </Button>
  );
}

export const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal every confirmation and unsaved-changes prompt sits in. It exists only while it is open, so
 * nothing invisible can swallow a click; Esc calls `onCancel`, Tab stays inside, and closing returns focus
 * to the control that was focused when it opened (W7).
 */
const PANEL_TINT = "color-mix(in srgb, var(--marinara-editor-surface-bg) 74%, var(--background) 26%)";
const OPAQUE_PANEL = {
  backgroundColor: "var(--background)",
  backgroundImage: `linear-gradient(${PANEL_TINT}, ${PANEL_TINT})`,
  // The Engine's global scrollbar thumb is bright pink; its own modals use the muted panel scrollbar instead.
  scrollbarColor: "var(--marinara-chat-chrome-panel-scrollbar, var(--border)) transparent",
};

export function ModalDialog({
  titleId,
  descriptionId,
  initialFocus,
  onCancel,
  children,
  panelClassName = "max-w-md",
  ...data
}: {
  titleId: string;
  descriptionId: string;
  /** Selector of the control that takes focus on open. */
  initialFocus: string;
  onCancel: () => void;
  children: ReactNode;
  /** Width (and overflow) of the panel; prompts keep the default. */
  panelClassName?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    // preventScroll: a long dialog opens at its title, not scrolled down to a focused footer button.
    dialog.querySelector<HTMLElement>(initialFocus)?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => {
        // Only when focus was lost: a confirmed action may already have moved it somewhere better.
        const active = document.activeElement;
        if (opener?.isConnected && (!active || active === document.body)) opener.focus({ preventScroll: true });
      });
    };
  }, [initialFocus, opener]);
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-ltm-modal
      {...data}
      onClose={(event) => {
        // A native close (a second Esc in Chromium) must not leave a mounted prompt invisible.
        if (event.currentTarget.isConnected) event.currentTarget.showModal();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-0 z-50 grid h-full w-full place-items-center bg-black/50 p-4"
      // The browser caps a modal dialog 30px short of the screen, which left it off-centre on phones.
      style={{ maxWidth: "none", maxHeight: "none" }}
    >
      {/* The editor panel tint is translucent and this dialog has no backdrop blur, so the page behind showed
          through; back the tint with the app background, as the Engine's opaque windows do. */}
      {/* relative: sr-only captions and labels would otherwise escape the panel and make the dialog scroll too. */}
      <section
        className={`mari-editor-panel relative w-full ${panelClassName} space-y-3 p-4 shadow-xl`}
        style={OPAQUE_PANEL}
      >
        {children}
      </section>
    </dialog>
  );
}

/**
 * The one chat-type group: a checkbox per mode. At `minSelected` (default 1) the last checked box cannot be
 * cleared, and a one-line note at the group says so. `dataPrefix` keeps a surface's own data attributes
 * (`data-<prefix>-modes-fieldset`, `-modes`, `-mode-label`, `-mode-checkbox`).
 */
export function ModeCheckboxes<Mode extends string>({
  modes,
  selected,
  onChange,
  labelFor,
  legend,
  help,
  error,
  minSelected = 1,
  disabled = false,
  describedBy,
  dataPrefix,
  className = "space-y-2 border-b border-[var(--border)] pb-4",
  legendClassName = "text-sm font-semibold",
  textClassName = "text-sm",
  fieldsetProps,
}: {
  modes: readonly Mode[];
  selected: readonly Mode[];
  onChange: (modes: Mode[]) => void;
  labelFor: (mode: Mode) => string;
  legend: string;
  help?: string;
  error?: string;
  minSelected?: number;
  disabled?: boolean;
  describedBy?: string;
  dataPrefix?: string;
  className?: string;
  legendClassName?: string;
  textClassName?: string;
  fieldsetProps?: Record<string, string | boolean | undefined>;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const noteId = useId();
  const atMinimum = minSelected > 0 && selected.length <= minSelected;
  const prefixed = (name: string, value: string | true = true) =>
    dataPrefix ? { [`data-${dataPrefix}-${name}`]: value } : {};
  return (
    <fieldset className={className} {...fieldsetProps} {...prefixed("modes-fieldset")}>
      <legend className={legendClassName}>{legend}</legend>
      {help ? <p className="text-xs text-[var(--muted-foreground)]">{help}</p> : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1" {...prefixed("modes")}>
        {modes.map((mode) => {
          const checked = selected.includes(mode);
          const isLast = checked && atMinimum;
          return (
            <label
              key={mode}
              className={`flex min-h-11 items-center gap-2 font-medium ${textClassName}`}
              {...prefixed("mode-label", mode)}
            >
              <input
                type="checkbox"
                className={`${sourceCheckboxClass}${disabled ? " opacity-50" : ""}`}
                checked={checked}
                disabled={isLast}
                aria-disabled={disabled || undefined}
                aria-describedby={
                  [disabled ? describedBy : undefined, isLast ? noteId : undefined].filter(Boolean).join(" ") ||
                  undefined
                }
                {...prefixed("mode-checkbox", mode)}
                onChange={() => {
                  if (disabled) return;
                  onChange(checked ? selected.filter((value) => value !== mode) : [...selected, mode]);
                }}
              />
              <span>{labelFor(mode)}</span>
            </label>
          );
        })}
      </div>
      {atMinimum ? (
        <p id={noteId} className="text-xs text-[var(--muted-foreground)]" data-ltm-last-mode-note>
          {localizeUi("ui.longTermMemory.memoryvault.lastModeRequired")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onResult,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onResult: (confirmed: boolean) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  return (
    <ModalDialog
      titleId={`${id}-title`}
      descriptionId={`${id}-description`}
      // A destructive prompt opens on Cancel so a stray Enter cannot confirm it.
      initialFocus={destructive ? "[data-ltm-confirm-cancel]" : "[data-ltm-confirm-ok]"}
      onCancel={() => onResult(false)}
      data-ltm-confirm-dialog
    >
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {title}
      </h2>
      <p id={`${id}-description`} className="whitespace-pre-line text-sm text-[var(--muted-foreground)]">
        {message}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button data-ltm-confirm-cancel onClick={() => onResult(false)}>
          {cancelLabel ?? localizeUi("ui.longTermMemory.memoryvault.cancel")}
        </Button>
        <Button data-ltm-confirm-ok destructive={destructive} primary={!destructive} onClick={() => onResult(true)}>
          {confirmLabel}
        </Button>
      </div>
    </ModalDialog>
  );
}

/**
 * Asks before a destructive or hard-to-undo action. The host's `confirmAction` is used when it has one;
 * otherwise the package's own `ConfirmDialog` stands in for the browser's own confirm prompt.
 */
export async function confirm(
  props: Pick<CapabilityProps, "confirmAction" | "localization">,
  title: string,
  message: string,
  confirmLabel: string,
  destructive = false,
  cancelLabel?: string,
) {
  if (props.confirmAction)
    return props.confirmAction({
      title,
      message,
      confirmLabel,
      ...(cancelLabel ? { cancelLabel } : {}),
      tone: destructive ? "destructive" : "default",
    });
  return new Promise<boolean>((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (confirmed: boolean) => {
      resolve(confirmed);
      queueMicrotask(() => {
        root.unmount();
        host.remove();
      });
    };
    root.render(
      <LtmLocalizationProvider localization={props.localization}>
        <ConfirmDialog
          title={title}
          message={message}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          destructive={destructive}
          onResult={finish}
        />
      </LtmLocalizationProvider>,
    );
  });
}

/**
 * Save, discard or stay: the one prompt for leaving a screen with unsaved edits. Render it only while the
 * question is open. While `busy` (a save is running) the buttons stay focusable but do nothing, and Esc waits.
 */
export function UnsavedChangesDialog({
  description,
  stayLabel,
  busy = false,
  saveFailedText,
  onDecision,
}: {
  description: string;
  /** Each caller keeps its own wording for staying ("Keep editing", "Stay"). */
  stayLabel?: string;
  busy?: boolean;
  saveFailedText?: string | null;
  onDecision: (decision: "save" | "discard" | "stay") => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  const decide = (decision: "save" | "discard" | "stay") => {
    if (!busy) onDecision(decision);
  };
  const locked = lockedActionProps(busy);
  return (
    <ModalDialog
      titleId={`${id}-title`}
      descriptionId={`${id}-description`}
      initialFocus="[data-ltm-unsaved-stay]"
      onCancel={() => decide("stay")}
      data-ltm-unsaved-dialog
    >
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationTitle")}
      </h2>
      <p id={`${id}-description`} className="text-sm text-[var(--muted-foreground)]">
        {description}
      </p>
      {saveFailedText ? (
        <StatusSurface tone="danger" data-ltm-unsaved-save-failed>
          {saveFailedText}
        </StatusSurface>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button {...locked} data-ltm-unsaved-stay onClick={() => decide("stay")}>
          {stayLabel ?? localizeUi("ui.longTermMemory.memoryvault.keepEditing")}
        </Button>
        <Button {...locked} destructive onClick={() => decide("discard")}>
          {localizeUi("ui.longTermMemory.memoryvault.discardAndContinue")}
        </Button>
        <Button {...locked} primary onClick={() => decide("save")}>
          {localizeUi("ui.longTermMemory.memoryvault.saveAndContinue")}
        </Button>
      </div>
    </ModalDialog>
  );
}
