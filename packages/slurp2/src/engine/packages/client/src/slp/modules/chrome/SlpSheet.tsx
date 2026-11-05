// ──────────────────────────────────────────────
// SlpSheet / SlpMenu (design language §7): the one overlay for menus, pickers and small dialogs.
//
// Phone: a frosted pink glass bottom sheet (20 px top radius, grab handle, soft pink top glow, scrim)
// that closes on swipe down, Escape and a scrim tap, traps focus, and sits above
// the bottom nav (it renders in the package portal, over the whole app). Wide screens: a menu is a
// popover anchored to its trigger, a dialog is a centred modal. One Slurp overlay at a time: opening
// one closes the other. Motion uses the shared tokens and is a plain fade under reduced motion.
// ──────────────────────────────────────────────
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { ModalPortalContext } from "../../../components/ui/Modal";
import { useDialogFocusScope } from "../../../hooks/use-dialog-focus-scope";
import { getSlpAccentStyle, SLP_TYPE, useSlpAccent, useSlpMediaQuery } from "../../base/chrome/SlpChrome";
import { SLP_MOTION, slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { registerSlpBackLayer } from "../../base/navigation/slp-back-layer";

const useWideScreen = () => useSlpMediaQuery("(min-width: 768px)");

/** Closes the Slurp overlay that is open now, so a second one never stacks on top of it. */
let closeOpenOverlay: (() => void) | null = null;

// Back gesture: only a sheet that is a sub-page (`back`) closes on Android / browser back, through
// Slurp's own back layer (base/navigation/slp-back-layer.ts); other sheets leave history alone.

// A swipe this long, or this fast (px per ms), closes the sheet; anything less snaps back.
const SWIPE_CLOSE_PX = 90;
const SWIPE_CLOSE_SPEED = 0.6;

export function SlpSheet({
  open,
  onClose,
  title,
  kind = "dialog",
  anchorRef,
  closeDisabled = false,
  width = "max-w-md",
  size = "auto",
  headerAccessory,
  footer,
  back = false,
  base = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The sheet heading; a menu uses it as its accessible name and shows it on phones only. */
  title: string;
  /** "menu": rows of actions (role menu, arrow keys). "dialog": any other content. */
  kind?: "menu" | "dialog";
  /** The control that opened it. With one, wide screens get a popover hanging off it; without, a centred modal. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** While a spend is in flight nothing closes the sheet (swipe, Escape or scrim). */
  closeDisabled?: boolean;
  /** Width of the centred modal on wide screens. */
  width?: string;
  /**
   * "full": a full-screen task (composer, post edit; design language §8). On phones the glass
   * sheet fills the screen below the status bar and gets a close button; wide screens keep the
   * centred modal at a fixed height, so the sticky footer stays put.
   */
  size?: "auto" | "full";
  /** Sits at the end of the title row (a Post | Story switch). */
  headerAccessory?: ReactNode;
  /** A bar pinned under the scrolling body (a sticky "Post" / "Save"). */
  footer?: ReactNode;
  /**
   * A sub-page (the Stir pages): phones and tablets get the back arrow in the header, and Android /
   * browser back closes it and returns to the screen under it. Desktop keeps the plain header.
   */
  back?: boolean;
  /** A screen sheet (the Stir tab): opening it closes the open overlay, but sheets it opens stack on top. */
  base?: boolean;
  children: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const full = size === "full";
  const wide = useWideScreen();
  const desktop = useSlpMediaQuery("(min-width: 1024px)");
  const showBack = back && !desktop;
  const mode = !wide ? "sheet" : anchorRef ? "popover" : "modal";
  const accent = useSlpAccent();
  const portal = useContext(ModalPortalContext);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeDisabledRef = useRef(closeDisabled);
  closeDisabledRef.current = closeDisabled;
  const requestClose = () => {
    if (!closeDisabledRef.current) onCloseRef.current();
  };

  // Stay mounted through the exit motion.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setDragY(0);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), SLP_MOTION.slow);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => onCloseRef.current();
    closeOpenOverlay?.();
    if (!base) closeOpenOverlay = close;
    // Window capture, stopped: an Engine dialog underneath listens on document and would close too.
    const escape = (event: globalThis.KeyboardEvent) => {
      // A sheet stacked on a base sheet takes the Escape for itself.
      if (event.key === "Escape" && !(base && closeOpenOverlay)) {
        event.stopPropagation();
        requestClose();
      }
    };
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("keydown", escape, true);
      if (closeOpenOverlay === close) closeOpenOverlay = null;
    };
  }, [open, base]);

  // A base sheet counts the sheets stacked on it as its own, so Tab stays inside the top one.
  useDialogFocusScope(open && mounted, panelRef, undefined, undefined, base ? "[data-slp-sheet]" : undefined);

  useEffect(() => (open && back ? registerSlpBackLayer(() => onCloseRef.current()) : undefined), [open, back]);

  // Popover: a tap anywhere but the panel or its trigger closes it (the trigger toggles on its own).
  useEffect(() => {
    if (!open || mode !== "popover") return;
    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (panelRef.current?.contains(target) || anchorRef?.current?.contains(target))) return;
      requestClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, mode, anchorRef]);

  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!mounted || mode !== "popover") return;
    const place = () => {
      const anchor = anchorRef?.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const margin = 12;
      const left = Math.min(
        Math.max(margin, anchor.right - panel.offsetWidth),
        window.innerWidth - panel.offsetWidth - margin,
      );
      const below = anchor.bottom + 6;
      const top =
        below + panel.offsetHeight + margin > window.innerHeight
          ? Math.max(margin, anchor.top - panel.offsetHeight - 6)
          : below;
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [mounted, mode, anchorRef]);

  const drag = useRef<{ y: number; at: number } | null>(null);
  const dragHandlers =
    mode === "sheet"
      ? {
          onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
            if (closeDisabled) return;
            // A control in the header (close, a Post | Story switch) keeps its tap: capturing the
            // pointer here would retarget its click to the header.
            if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea")) return;
            drag.current = { y: event.clientY, at: performance.now() };
            event.currentTarget.setPointerCapture(event.pointerId);
          },
          onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
            if (drag.current) setDragY(Math.max(0, event.clientY - drag.current.y));
          },
          onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
            const start = drag.current;
            drag.current = null;
            if (!start) return;
            const distance = event.clientY - start.y;
            const speed = distance / Math.max(1, performance.now() - start.at);
            if (distance > SWIPE_CLOSE_PX || speed > SWIPE_CLOSE_SPEED) requestClose();
            else setDragY(0);
          },
          onPointerCancel: () => {
            drag.current = null;
            setDragY(0);
          },
        }
      : {};

  if (!mounted || typeof document === "undefined") return null;

  const reduced = slpPrefersReducedMotion();
  const dragging = drag.current !== null;
  const duration = mode === "sheet" ? SLP_MOTION.slow : SLP_MOTION.base;
  const hiddenTransform =
    mode === "sheet" ? "translateY(100%)" : mode === "popover" ? "translateY(4px)" : "scale(0.97) translateY(6px)";
  const panelStyle: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: reduced ? undefined : shown ? (dragY ? `translateY(${dragY}px)` : undefined) : hiddenTransform,
    transition: dragging
      ? "none"
      : `opacity ${duration}ms ${SLP_MOTION.ease}, transform ${duration}ms ${SLP_MOTION.ease}`,
    ...(mode === "popover" ? { left: position?.left ?? -9999, top: position?.top ?? -9999 } : {}),
  };
  const body =
    kind === "menu" ? (
      <div role="menu" aria-label={title} onKeyDown={moveMenuFocus} className="py-1">
        {children}
      </div>
    ) : (
      children
    );

  return createPortal(
    <div
      data-slp-sheet={mode}
      className={cn(
        "pointer-events-none fixed inset-0 z-[10000] text-[var(--slurp-text)]",
        mode === "modal" && "flex items-center justify-center p-4",
      )}
      style={getSlpAccentStyle(accent)}
    >
      {mode !== "popover" && (
        <div
          aria-hidden="true"
          onClick={requestClose}
          className="pointer-events-auto absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          style={{ opacity: shown ? 1 : 0, transition: `opacity ${duration}ms ${SLP_MOTION.ease}` }}
        />
      )}
      <div
        ref={panelRef}
        role={kind === "dialog" ? "dialog" : undefined}
        aria-modal={kind === "dialog" && mode !== "popover" ? true : undefined}
        aria-label={kind === "dialog" ? title : undefined}
        tabIndex={-1}
        style={panelStyle}
        className={cn(
          "pointer-events-auto isolate flex flex-col overflow-hidden outline-none",
          mode === "sheet" &&
            "absolute inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[20px] bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-glass))] shadow-[0_-18px_44px_-26px_color-mix(in_srgb,var(--noodle-accent)_70%,transparent),var(--slurp-highlight)] backdrop-blur-2xl",
          mode === "sheet" && full && "top-[max(0.5rem,env(safe-area-inset-top))] max-h-none",
          mode === "popover" &&
            "fixed w-72 max-h-[calc(100dvh-1.5rem)] rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-divider)]",
          mode === "modal" &&
            `relative w-full ${width} ${full ? "h-[min(88dvh,52rem)]" : ""} max-h-[min(88dvh,52rem)] rounded-[20px] bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-modal),var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-divider)]`,
        )}
      >
        {mode === "sheet" && (
          // The soft pink glow along the top edge of the glass.
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_srgb,var(--noodle-accent)_22%,transparent),transparent)]"
          />
        )}
        {(mode !== "popover" || kind === "dialog") && (
          <div
            {...dragHandlers}
            className={cn(
              "shrink-0",
              mode === "sheet" ? "touch-none px-5 pb-2 pt-2" : mode === "modal" ? "px-5 pb-1 pt-5" : "px-4 pb-0 pt-3",
            )}
          >
            {mode === "sheet" && (
              <span
                aria-hidden="true"
                className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-[var(--slurp-muted)]/40"
              />
            )}
            {full || headerAccessory || showBack ? (
              <div className="flex min-h-10 items-center gap-2">
                {showBack ? (
                  <button
                    type="button"
                    onClick={requestClose}
                    disabled={closeDisabled}
                    aria-label={localizeUi("ui.slurp.settings.backstage.kit.back")}
                    title={localizeUi("ui.slurp.settings.backstage.kit.back")}
                    className="-ms-2 grid size-11 shrink-0 place-items-center rounded-full text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 [&_svg]:!text-current"
                  >
                    <ChevronLeft size={22} aria-hidden="true" />
                  </button>
                ) : (
                  full && (
                    <button
                      type="button"
                      onClick={requestClose}
                      disabled={closeDisabled}
                      aria-label={localizeUi("capabilities.actions.close")}
                      className="-ms-2 grid size-10 shrink-0 place-items-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 [&_svg]:!text-current"
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  )
                )}
                <h2 className={cn(SLP_TYPE.title, "min-w-0 flex-1 truncate")}>{title}</h2>
                {headerAccessory}
              </div>
            ) : (
              <h2 className={cn(SLP_TYPE.title, "truncate")}>{title}</h2>
            )}
          </div>
        )}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            mode === "sheet" && (footer ? "px-2 pb-3" : "px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"),
            mode === "modal" && "px-3 pb-4",
            mode === "popover" && (kind === "menu" ? "px-1 py-1" : "px-2 pb-3"),
          )}
        >
          {body}
        </div>
        {footer && (
          <div
            className={cn(
              "shrink-0 border-t border-[var(--noodle-divider)] px-4 pt-3",
              mode === "sheet" ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "pb-4",
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    portal ?? document.body,
  );
}

/** Arrow keys walk the rows of a menu; Tab stays trapped by the sheet. */
function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
  if (!items.length) return;
  event.preventDefault();
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "ArrowDown" ? index + 1 : index - 1;
  items[(next + items.length) % items.length]?.focus();
}

/** A 44 px action row: an icon, then the label. Icons inherit the row's colour. */
export function SlpSheetItem({
  children,
  onSelect,
  tone = "default",
  disabled,
  hint,
  expanded,
}: {
  children: ReactNode;
  onSelect: () => void;
  /** "muted" for operator (Creator tools) rows, "danger" for destructive ones. */
  tone?: "default" | "muted" | "danger";
  disabled?: boolean;
  /** Why a disabled row is off. Sits under the row at full contrast, not faded with it. */
  hint?: string;
  /** For a row that opens a sub-list in place. */
  expanded?: boolean;
}) {
  const hintId = useId();
  const row = (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-describedby={hint ? hintId : undefined}
      aria-expanded={expanded}
      onClick={onSelect}
      className={cn(
        SLP_TYPE.body,
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start font-medium transition-colors duration-[var(--slurp-motion-fast)] hover:bg-[var(--accent)] focus-visible:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:!text-current",
        tone === "muted" && "text-[var(--slurp-muted)]",
        tone === "danger" &&
          "text-[var(--slurp-danger)] hover:bg-[color-mix(in_srgb,var(--slurp-danger)_10%,transparent)]",
      )}
    >
      {children}
    </button>
  );
  if (!hint) return row;
  return (
    <>
      {row}
      <p id={hintId} className={cn(SLP_TYPE.meta, "-mt-1.5 pb-2 pe-3 ps-11 text-[var(--slurp-muted)]")}>
        {hint}
      </p>
    </>
  );
}

/** A labelled block of rows. The "Creator tools" group always comes last and stays quiet. */
export function SlpSheetGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="border-t border-[var(--noodle-divider)] pt-1 first:border-t-0 first:pt-0"
    >
      {label && <p className={cn(SLP_TYPE.meta, "px-3 pb-1 pt-2 text-[var(--slurp-muted)]")}>{label}</p>}
      {children}
    </div>
  );
}

/** A 44 px radio row for "pick one" lists in a sheet (replaces native selects). */
export function SlpRadioRow({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        SLP_TYPE.body,
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 font-medium transition-colors duration-[var(--slurp-motion-fast)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-[var(--slurp-focus)] motion-reduce:transition-none",
        checked
          ? "bg-[image:var(--slurp-nav-active)] ring-1 ring-inset ring-[var(--noodle-accent)]/45"
          : "hover:bg-[var(--accent)]",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full ring-2 ring-inset",
          checked ? "ring-[var(--noodle-accent)]" : "ring-[var(--slurp-muted)]/50",
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-[var(--noodle-accent)]" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
