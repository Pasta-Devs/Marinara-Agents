import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info, Loader2, type LucideIcon } from "lucide-react";
import { useLtmTranslation } from "./localization";

let activePopover: { id: string; close: () => void } | null = null;

export const inputClass = "mari-editor-field min-h-11 w-full px-3 text-sm";
export const compactInputClass = "mari-chrome-field min-h-9 w-full !rounded-md px-3 py-2 text-xs";
export const compactInputStyle = { color: "var(--foreground)" } as const;

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    primary?: boolean;
    destructive?: boolean;
  }
>(function Button({ children, primary = false, destructive = false, className = "", style, ...props }, ref) {
  const tone = primary ? "mari-editor-action--primary" : destructive ? "mari-editor-action--danger" : "";
  return (
    <button
      ref={ref}
      type="button"
      data-ltm-control="button"
      className={`mari-editor-action min-h-11 px-3 ${tone} ${className}`}
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
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
  iconSize?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-ltm-control="icon-button"
      className={`mari-editor-action h-11 min-h-11 w-11 min-w-11 shrink-0 p-0 ${destructive ? "mari-editor-action--danger" : ""} ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" size={iconSize} />
    </button>
  );
}

export function ClickSurface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--ring)] ${className}`}
      {...props}
    />
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
        className={`${compact ? "h-7 w-7" : "h-11 w-11"} inline-grid shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        style={
          compact
            ? { height: "1.75rem", width: "1.75rem", flexShrink: 0 }
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
              style={{ top: position.top, left: position.left }}
              className={`mari-editor-panel fixed z-[100] max-h-[min(20rem,calc(100vh-1rem))] overflow-auto p-3 text-xs leading-5 text-[var(--marinara-editor-text)] shadow-lg ${wide ? "w-[min(26rem,calc(100vw-1rem))]" : "w-[min(18rem,calc(100vw-1rem))]"}`}
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
  help,
  compact = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  help?: ReactNode;
  compact?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const committedText = useRef(String(value));
  const commit = () => {
    if (!text.trim()) {
      setText(committedText.current);
      return;
    }
    const next = Number(text);
    if (!Number.isFinite(next)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, next));
    setText(String(clamped));
    if (String(clamped) === committedText.current) return;
    committedText.current = String(clamped);
    onChange(clamped);
  };
  useEffect(() => {
    setText(String(value));
    committedText.current = String(value);
  }, [value]);
  return (
    <div className={`space-y-1 font-medium ${compact ? "text-[0.625rem]" : "text-xs"}`}>
      <span className="flex items-center gap-1 text-[var(--foreground)]">
        <span id={`${id}-label`}>{label}</span>
        {help ? <InfoPopover label={label} content={help} compact={compact} /> : null}
      </span>
      <input
        id={id}
        aria-labelledby={`${id}-label`}
        data-ltm-control="number"
        className={compact ? compactInputClass : inputClass}
        style={compact ? compactInputStyle : undefined}
        type="number"
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setText(String(value));
          }
        }}
      />
    </div>
  );
}

export function StatusSurface({
  children,
  tone = "neutral",
  busy = false,
  compact = false,
  className = "",
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
    success: "border-[var(--marinara-editor-accent)]/35 text-[var(--marinara-editor-accent)]",
    warning: "border-[var(--marinara-editor-warning)]/40 text-[var(--marinara-editor-warning)]",
    danger: "border-[var(--destructive)]/35 text-[var(--destructive)]",
  }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      data-ltm-status={tone}
      className={`${compact ? "rounded-md border border-[var(--border)] bg-[var(--background)]/75 px-2 py-1.5 text-[0.625rem]" : "mari-editor-panel mari-editor-panel--soft min-h-11 px-3 text-xs"} flex items-center gap-2 ${toneClass} ${className}`}
      {...props}
    >
      {busy ? <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </div>
  );
}
