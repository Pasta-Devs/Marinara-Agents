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

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    primary?: boolean;
    destructive?: boolean;
  }
>(function Button(
  { children, primary = false, destructive = false, className = "", ...props },
  ref,
) {
  const tone = primary
    ? "mari-editor-action--primary"
    : destructive
      ? "mari-editor-action--danger"
      : "";
  return (
    <button
      ref={ref}
      type="button"
      data-ltm-control="button"
      className={`mari-editor-action min-h-11 px-3 ${tone} ${className}`}
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
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-ltm-control="icon-button"
      className={`mari-editor-action h-8 min-h-8 w-8 min-w-8 shrink-0 p-0 ${destructive ? "mari-editor-action--danger" : ""} ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" size="0.875rem" />
    </button>
  );
}

export function ClickSurface({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
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
}: {
  label: string;
  content: ReactNode;
  wide?: boolean;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const closeRef = useRef<() => void>(() => undefined);

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const close = () => {
    clearCloseTimer();
    setOpen(false);
    setPinned(false);
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
      const left = Math.min(
        Math.max(8, trigger.left),
        Math.max(8, window.innerWidth - width - 8),
      );
      const below = trigger.bottom + gap;
      const top =
        below + height <= window.innerHeight - 8
          ? below
          : Math.max(8, trigger.top - gap - height);
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, wide]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      )
        closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) activePopover = { id, close: closeRef.current };
    return () => {
      clearCloseTimer();
      if (activePopover?.id === id) activePopover = null;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={localizeUi("ui.longTermMemory.infopopover.aboutValue1", {
          value1: label,
        })}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-describedby={open ? `${id}-panel` : undefined}
        data-ltm-info={label}
        className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={(event) => {
          if (!panelRef.current?.contains(event.relatedTarget as Node))
            scheduleClose();
        }}
        onClick={() => {
          if (pinned) close();
          else {
            show();
            setPinned(true);
          }
        }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <Info aria-hidden="true" size="0.75rem" />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={`${id}-panel`}
              role="tooltip"
              data-ltm-info-panel={label}
              style={{ top: position.top, left: position.left }}
              className={`fixed z-[100] max-h-[min(20rem,calc(100vh-1rem))] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs leading-5 text-[var(--foreground)] shadow-lg ${wide ? "w-[min(26rem,calc(100vw-1rem))]" : "w-[min(18rem,calc(100vw-1rem))]"}`}
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  help?: ReactNode;
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
    <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1">
        <span id={`${id}-label`}>{label}</span>
        {help ? <InfoPopover label={label} content={help} /> : null}
      </span>
      <input
        id={id}
        aria-labelledby={`${id}-label`}
        data-ltm-control="number"
        className={inputClass}
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
  tone?: "neutral" | "success" | "danger";
  busy?: boolean;
  compact?: boolean;
  className?: string;
} & HTMLAttributes<HTMLParagraphElement>) {
  const toneClass = {
    neutral: "text-[var(--marinara-editor-muted)]",
    success:
      "border-[var(--marinara-editor-accent)]/35 text-[var(--marinara-editor-accent)]",
    danger: "border-[var(--destructive)]/35 text-[var(--destructive)]",
  }[tone];
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      data-ltm-status={tone}
      className={`mari-editor-panel mari-editor-panel--soft flex items-center gap-2 ${compact ? "px-2 py-1.5 text-[0.625rem]" : "min-h-11 px-3 text-xs"} ${toneClass} ${className}`}
      {...props}
    >
      {busy ? (
        <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin" />
      ) : null}
      {children}
    </p>
  );
}
