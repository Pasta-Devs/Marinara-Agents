import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ActivityCardView, useActivityCardState } from "../ActivityCard";
import { useLtmTranslation } from "../localization";
import { Button, FOCUSABLE } from "../shared-controls";
import type { CapabilityProps, LongTermMemoryDestination } from "../types";
import { writeTourProgress } from "./progress";
import { SetupSprite } from "./Sprite";
import { LTM_TOUR_STOPS } from "./tour-stops";

// The spotlight's ring sits this far outside the control, and the bubble this far from the ring.
const RING = 6;
const GAP = 12;
const EDGE = 16;
const BUBBLE_WIDTH = 432;
// At or below this width the bubble docks to the bottom of the screen.
const PHONE_WIDTH = 640;

/** The first visible match of the stop's selectors; the navigation renders a hidden copy for the other width. */
const findTarget = (selectors: string[]) => {
  for (const selector of selectors) {
    const match = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) => element.getClientRects().length > 0,
    );
    if (match) return match;
  }
  return null;
};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The chat's own Long-Term Memory card, as the chat shows it; its buttons that would leave the tour are left out. */
function InChatCard({ props }: { props: CapabilityProps }) {
  const card = useActivityCardState(props);
  return <ActivityCardView props={{ ...props, onOpenAgentSettings: undefined }} card={card} />;
}

/**
 * Mari's nine-stop tour: one bubble per stop over a scrim with a cut-out around the real control. Each stop
 * opens its tab first. Esc or End tour ends it, the arrow keys step, Tab stays in the bubble, and ending
 * hands control back to the caller, which returns focus to the help button.
 */
export function Tour({
  hostProps,
  activeChat,
  packageVersion,
  onShow,
  onStop,
  onEnd,
}: {
  /** The page's own props; the In the chat stop draws the open chat's card from them. */
  hostProps: CapabilityProps;
  activeChat: boolean;
  packageVersion?: string | null;
  /** Opens a tab for the stop; resolves false when the user stayed on unsaved changes, which ends the tour. */
  onShow: (destination: LongTermMemoryDestination) => Promise<boolean>;
  /** Tells the page which stop is showing, so a stop can preview a control that is only sometimes on screen. */
  onStop?: (stopId: string | null) => void;
  onEnd: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const titleId = useId();
  const textId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bubbleRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  // The found control is kept with its stop, so the previous stop's ring is gone in the render that changes the stop.
  const [found, setFound] = useState<{ index: number; element: HTMLElement } | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const stop = LTM_TOUR_STOPS[index];
  const target = found?.index === index ? found.element : null;
  const last = index === LTM_TOUR_STOPS.length - 1;
  const showRecalled = stop.id === "inchat" && activeChat;
  // The caller's navigation closes over its current tab, so the stop effect reads the newest one.
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;
  useEffect(() => {
    onStopRef.current?.(stop.id);
    return () => onStopRef.current?.(null);
  }, [stop.id]);

  const end = () => {
    writeTourProgress("done");
    onEndRef.current();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    // showModal focuses the first button, End tour; Enter there would end the tour at once.
    nextRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Whether this stop changed the page by pressing its control; only then is it put back.
    let pressed = false;
    void (async () => {
      if (stop.destination && !(await onShowRef.current(stop.destination))) {
        if (!cancelled) end();
        return;
      }
      // The new tab renders over the next frames and may wait on a query; a control that has not appeared
      // after three seconds leaves the stop unspotlit.
      const giveUpAt = performance.now() + 3000;
      while (!cancelled && stop.targets.length && performance.now() < giveUpAt) {
        if (stop.press && !pressed) {
          const control = findTarget([stop.press]);
          if (control) {
            pressed = control.getAttribute("aria-pressed") !== "true";
            if (pressed) control.click();
          }
        }
        const element = findTarget(stop.targets);
        if (element) {
          const tall = element.getBoundingClientRect().height > window.innerHeight * 0.55;
          element.scrollIntoView({ block: tall ? "start" : "nearest", inline: "nearest" });
          setFound({ index, element });
          return;
        }
        await nextFrame();
      }
    })();
    return () => {
      cancelled = true;
      if (pressed && stop.restore) findTarget([stop.restore])?.click();
    };
    // `end` reads only refs; the stop is the only input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const measure = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setRect(target?.isConnected ? target.getBoundingClientRect() : null);
    };
    measure();
    // Content loading around the control moves it without a scroll or resize.
    const observer = target ? new ResizeObserver(measure) : null;
    if (target) observer?.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  // The bubble's height decides whether it fits below the ring; it changes with the stop's line and the recalled rows.
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const observer = new ResizeObserver(() => setBubbleHeight(bubble.offsetHeight));
    observer.observe(bubble);
    return () => observer.disconnect();
  }, []);

  // Back on stop 1 removes the Back button; keep focus in the bubble.
  useEffect(() => {
    if (!bubbleRef.current?.contains(document.activeElement)) nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  const step = (delta: 1 | -1) =>
    setIndex((current) => Math.min(LTM_TOUR_STOPS.length - 1, Math.max(0, current + delta)));

  // A control taller than most of the screen is scrolled to its top, and only that top part is ringed.
  const hole =
    rect && target
      ? {
          top: rect.top - RING,
          left: rect.left - RING,
          width: rect.width + RING * 2,
          height: Math.min(rect.height, viewport.height * 0.55) + RING * 2,
        }
      : null;
  const phone = viewport.width <= PHONE_WIDTH;
  const bubbleWidth = Math.min(BUBBLE_WIDTH, viewport.width - EDGE * 2);
  let bubbleStyle: CSSProperties;
  if (phone) {
    // The phone tabs sit at the bottom, so a ring there moves the docked bubble to the top.
    const ringAtBottom = hole && hole.top + hole.height > viewport.height - EDGE - bubbleHeight - GAP;
    bubbleStyle = ringAtBottom
      ? { left: EDGE, right: EDGE, top: `max(${EDGE}px, env(safe-area-inset-top))` }
      : { left: EDGE, right: EDGE, bottom: `max(${EDGE}px, env(safe-area-inset-bottom))` };
  } else if (!hole) {
    bubbleStyle = { left: "50%", top: "50%", width: bubbleWidth, transform: "translate(-50%, -50%)" };
  } else {
    const left = Math.min(Math.max(hole.left, EDGE), viewport.width - bubbleWidth - EDGE);
    const below = hole.top + hole.height + GAP;
    const roomBelow = below + bubbleHeight <= viewport.height - EDGE;
    const above = hole.top - GAP - bubbleHeight;
    bubbleStyle = {
      left,
      width: bubbleWidth,
      top: roomBelow || above < EDGE ? Math.max(EDGE, Math.min(below, viewport.height - EDGE - bubbleHeight)) : above,
    };
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-ltm-surface="tour"
      data-ltm-tour-stop={stop.id}
      onClose={(event) => {
        // A native close (a second Esc in Chromium) must not leave the tour mounted but invisible.
        if (event.currentTarget.isConnected) event.currentTarget.showModal();
      }}
      onCancel={(event) => {
        event.preventDefault();
        end();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" && !last) {
          event.preventDefault();
          step(1);
        } else if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          step(-1);
        } else if (event.key === "Tab") {
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
          if (!focusable.length) return;
          const first = focusable[0];
          const lastFocusable = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            lastFocusable.focus();
          } else if (!event.shiftKey && document.activeElement === lastFocusable) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
      className="fixed inset-0 z-50 h-full w-full p-0"
      style={{ margin: 0, maxWidth: "none", maxHeight: "none", border: 0, background: "transparent" }}
    >
      <style>{`[data-ltm-surface="tour"]::backdrop { background: transparent; }`}</style>
      {/* The scrim is the cut-out's shadow, so the spotlit control stays visible at full strength. */}
      {hole ? (
        <div
          aria-hidden="true"
          data-ltm-tour-spotlight
          className="pointer-events-none fixed rounded-lg"
          style={{
            ...hole,
            boxShadow: "0 0 0 200vmax rgb(0 0 0 / 0.5)",
            outline: "2px solid var(--marinara-editor-accent)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-black/50" />
      )}
      <section
        ref={bubbleRef}
        data-ltm-tour-bubble
        className="mari-editor-panel fixed space-y-3 p-4 text-[var(--marinara-editor-text)] shadow-xl"
        style={bubbleStyle}
      >
        <div className="flex items-start gap-3">
          <SetupSprite key={stop.id} sprite={phone ? stop.phoneSprite : stop.sprite} packageVersion={packageVersion} />
          <div aria-live="polite" className="min-w-0 flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.tour.stopOf", { current: index + 1, total: LTM_TOUR_STOPS.length })}
            </p>
            <h2 id={titleId} className="text-sm font-semibold">
              {localizeUi(stop.titleKey)}
            </h2>
            <p id={textId} className="mt-1 text-sm">
              {localizeUi(
                stop.id === "inchat" && !activeChat
                  ? "ui.longTermMemory.tour.inchatTextOff"
                  : stop.id === "linked" && target?.hasAttribute("data-ltm-graph-example")
                    ? "ui.longTermMemory.tour.linkedTextExample"
                    : stop.textKey,
              )}
            </p>
          </div>
        </div>
        {showRecalled ? <InChatCard props={hostProps} /> : null}
        <div aria-hidden="true" className="flex gap-1">
          {LTM_TOUR_STOPS.map((item, dot) => (
            <span
              key={item.id}
              className={`h-1.5 w-1.5 rounded-full ${dot === index ? "bg-[var(--marinara-editor-accent)]" : "bg-[var(--muted-foreground)] opacity-50"}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button data-ltm-tour-end style={{ marginRight: "auto" }} onClick={end}>
            {localizeUi("ui.longTermMemory.tour.endTour")}
          </Button>
          {index > 0 ? (
            <Button data-ltm-tour-back onClick={() => step(-1)}>
              {localizeUi("ui.longTermMemory.tour.back")}
            </Button>
          ) : null}
          <Button ref={nextRef} primary data-ltm-tour-next onClick={() => (last ? end() : step(1))}>
            {localizeUi(last ? "ui.longTermMemory.tour.finish" : "ui.longTermMemory.tour.next")}
          </Button>
        </div>
      </section>
    </dialog>
  );
}
