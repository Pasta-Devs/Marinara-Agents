// ──────────────────────────────────────────────
// Slurp's sparkle system (design language §3). Props in, no feature hooks.
//
// Ambient layers (React, CSS in slp-sparkle-styles.ts): SlpGlint, SlpShimmer, SlpRingGlint,
// SlpTwinkle. Each is an absolutely positioned span at z-index -1: put it inside a
// `relative isolate` parent and it paints over the parent's background but under its content.
//
// Reward moments (imperative, Web Animations): playSlpBurst, playSlpPop, playSlpCoinFly,
// playSlpSpendMoment. They draw into one fixed layer on <body>, so they survive the button that
// started them unmounting, and a new reward replaces the running one (one at a time).
// ──────────────────────────────────────────────
import { useEffect, useRef, type CSSProperties } from "react";
import { SLP_MOTION, slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { SLURP_COIN_SRC } from "../coin/SlpCoin";
import { SLP_SPARKLE_COLORS, SLP_SPARKLE_MASKS } from "./slp-sparkle-styles";

/** Pauses a looping ambient layer while it is off-screen or the tab is hidden. */
function useSlpAmbientPause<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let visible = true;
    const sync = () => {
      if (visible && document.visibilityState === "visible") node.removeAttribute("data-slp-paused");
      else node.setAttribute("data-slp-paused", "");
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting !== false;
            sync();
          });
    observer?.observe(node);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return ref;
}

/** A diagonal light sweep across the parent, once on appear and again on hover. */
export function SlpGlint() {
  return <span className="slp-glint" aria-hidden="true" />;
}

/** Slow idle sparkle for signature cards (balance, paywall, premium badges). */
export function SlpShimmer() {
  const ref = useSlpAmbientPause<HTMLSpanElement>();
  return <span ref={ref} className="slp-shimmer" aria-hidden="true" data-slp-sparkle="shimmer" />;
}

/**
 * Hero-gradient ring with a glint that travels round it: one pass on appear, then one slow pass
 * every 7 s. Sits above the parent's content (it is only a 2 px ring), so the parent needs
 * `relative` and a border radius.
 */
export function SlpRingGlint({ seen = false, outset = 0 }: { seen?: boolean; outset?: number } = {}) {
  const ref = useSlpAmbientPause<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      // Seen: a still, muted ring (the Story is still there to watch) with no glint.
      className={seen ? "slp-ring slp-ring-seen" : "slp-ring"}
      // `outset` draws the ring outside the parent, so an avatar keeps its size and layout.
      style={outset ? { inset: -outset } : undefined}
      aria-hidden="true"
      data-slp-sparkle="ring"
    />
  );
}

const DEFAULT_TWINKLES = [
  { x: "8%", y: "14%", size: 12 },
  { x: "88%", y: "10%", size: 9 },
  { x: "80%", y: "78%", size: 13 },
  { x: "14%", y: "82%", size: 8 },
];

/**
 * Static sparkle glyphs placed round an illustration; each twinkles once on appear. `fade` lets
 * them go after the pop (a passing moment, such as the new-posts pill), instead of staying.
 */
export function SlpTwinkle({
  points = DEFAULT_TWINKLES,
  fade = false,
}: {
  points?: { x: string; y: string; size: number }[];
  fade?: boolean;
}) {
  return (
    <>
      {points.map((point, index) => (
        <span
          key={index}
          className={fade ? "slp-twinkle slp-twinkle-fade" : "slp-twinkle"}
          aria-hidden="true"
          style={
            {
              left: point.x,
              top: point.y,
              "--slp-twinkle-size": `${point.size}px`,
              "--slp-twinkle-color": SLP_SPARKLE_COLORS[index % SLP_SPARKLE_COLORS.length],
              "--slp-twinkle-delay": `${index * 90}ms`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

// ── Reward moments ────────────────────────────────────────────────────────────

type SlpOrigin = Element | DOMRect;
type CandyKind = "star" | "heart" | "coin";

let activeLayer: HTMLDivElement | null = null;

function rectOf(origin: SlpOrigin): DOMRect {
  return origin instanceof DOMRect ? origin : origin.getBoundingClientRect();
}

/** The one reward layer. Starting a reward removes the one still running. */
function openRewardLayer(kind: string): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  activeLayer?.remove();
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.slpRewardLayer = kind;
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "2147483001",
  });
  document.body.appendChild(layer);
  activeLayer = layer;
  return layer;
}

function closeWhenDone(layer: HTMLDivElement, animations: Animation[], minimumMs = 0) {
  const done = Promise.allSettled([
    ...animations.map((animation) => animation.finished),
    new Promise((resolve) => window.setTimeout(resolve, minimumMs)),
  ]);
  void done.then(() => {
    layer.remove();
    if (activeLayer === layer) activeLayer = null;
  });
}

/** Mixed candy: mostly stars, every sixth a heart, every fifth a coin glint. */
function candyKind(index: number): CandyKind {
  if (index % 6 === 3) return "heart";
  if (index % 5 === 4) return "coin";
  return "star";
}

function candy(layer: HTMLElement, kind: CandyKind, color: string, size: number): HTMLSpanElement {
  const node = document.createElement("span");
  Object.assign(node.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${size}px`,
    height: `${size}px`,
    willChange: "transform, opacity",
  });
  if (kind === "coin") {
    node.style.borderRadius = "50%";
    node.style.background = "radial-gradient(circle at 35% 30%, #fff8dc, #f6c56b 48%, #b7791f)";
    node.style.boxShadow = "0 0 6px rgb(246 197 107 / 0.8)";
  } else {
    const mask = `${SLP_SPARKLE_MASKS[kind]} center / contain no-repeat`;
    node.style.background = color;
    node.style.setProperty("mask", mask);
    node.style.setProperty("-webkit-mask", mask);
  }
  layer.appendChild(node);
  return node;
}

function at(x: number, y: number, size: number, scale: number, rotate = 0) {
  return `translate3d(${x - size / 2}px, ${y - size / 2}px, 0) scale(${scale}) rotate(${rotate}deg)`;
}

/** Reduced motion: one still sparkle glyph by the origin, then gone. */
function staticSparkle(rect: DOMRect) {
  const layer = openRewardLayer("static");
  if (!layer) return;
  const node = candy(layer, "star", SLP_SPARKLE_COLORS[0], 14);
  node.style.transform = at(rect.right - 6, rect.top + 6, 14, 1);
  closeWhenDone(layer, [], 700);
}

function burstInto(layer: HTMLElement, rect: DOMRect, count: number, delay = 0): Animation[] {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const spread = Math.min(rect.width, 240) * 0.35;
  return Array.from({ length: count }, (_, index) => {
    const kind = candyKind(index);
    const size = kind === "coin" ? 7 : 10 + Math.random() * 8;
    const node = candy(layer, kind, SLP_SPARKLE_COLORS[index % SLP_SPARKLE_COLORS.length], size);
    const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 38 + Math.random() * 30;
    const x0 = cx + (Math.random() - 0.5) * spread;
    const y0 = cy;
    const x1 = x0 + Math.cos(angle) * distance;
    const y1 = y0 + Math.sin(angle) * distance * 0.8;
    const spin = (Math.random() - 0.5) * 140;
    // Fly out fast, hang for a beat, then fade: per-segment easing, so the fade is not squeezed
    // into the first half the way one strong ease-out over the whole run does.
    return node.animate(
      [
        { transform: at(x0, y0, size, 0.2), opacity: 0, easing: SLP_MOTION.ease },
        { transform: at(x1, y1, size, 1.1, spin / 2), opacity: 1, offset: 0.45, easing: "linear" },
        { transform: at(x1, y1 + 4, size, 0.9, spin * 0.75), opacity: 1, offset: 0.7, easing: "ease-in" },
        { transform: at(x1, y1 + 10, size, 0.4, spin), opacity: 0 },
      ],
      { duration: 480 + Math.random() * 90, delay, fill: "both" },
    );
  });
}

/** Burst: 8–12 candy sparkles fly out of a control (unlock, subscribe, tip). */
export function playSlpBurst(origin: SlpOrigin, count = 10) {
  const rect = rectOf(origin);
  if (slpPrefersReducedMotion()) return staticSparkle(rect);
  const layer = openRewardLayer("burst");
  if (!layer) return;
  closeWhenDone(layer, burstInto(layer, rect, count));
}

function popInto(layer: HTMLElement, rect: DOMRect, delay = 0): Animation[] {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const reach = Math.max(rect.width, rect.height) / 2 + 8;
  return [-60, 20, 110, 200].map((degrees, index) => {
    const size = index === 1 ? 10 : 8;
    const node = candy(layer, index === 2 ? "heart" : "star", SLP_SPARKLE_COLORS[index], size);
    const angle = (degrees * Math.PI) / 180;
    const x0 = cx + Math.cos(angle) * (reach - 8);
    const y0 = cy + Math.sin(angle) * (reach - 8);
    const x1 = cx + Math.cos(angle) * (reach + 6);
    const y1 = cy + Math.sin(angle) * (reach + 6);
    return node.animate(
      [
        { transform: at(x0, y0, size, 0.3), opacity: 0, easing: SLP_MOTION.ease },
        { transform: at(x1, y1, size, 1.15), opacity: 1, offset: 0.5, easing: "ease-in" },
        { transform: at(x1, y1 - 3, size, 0.6), opacity: 0 },
      ],
      { duration: 320, delay, fill: "both" },
    );
  });
}

/** Pop: a few tiny sparkles round an icon plus a 1.2× bounce (like, follow, react). */
export function playSlpPop(origin: Element, { bounce = true }: { bounce?: boolean } = {}) {
  const rect = rectOf(origin);
  if (slpPrefersReducedMotion()) return staticSparkle(rect);
  const layer = openRewardLayer("pop");
  if (!layer) return;
  const animations = popInto(layer, rect);
  if (bounce) {
    origin.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], {
      duration: 300,
      easing: SLP_MOTION.ease,
    });
  }
  closeWhenDone(layer, animations);
}

/** The balance chip a spend flies to: the first `SlurpCoinAmount` watching a live balance on screen. */
function visibleBalance(): Element | null {
  for (const node of document.querySelectorAll('[data-slurp-coin-balance="true"]')) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0) return node;
  }
  return null;
}

function coinsInto(layer: HTMLElement, from: DOMRect, to: DOMRect | null, delay = 0): Animation[] {
  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
  // With no balance on screen the coins rise off the button and fade, so a spend still reads.
  const x1 = to ? to.left + to.width / 2 : x0 + 24;
  const y1 = to ? to.top + to.height / 2 : y0 - 96;
  const peak = Math.min(y0, y1) - 56;
  return [0, 1, 2].map((index) => {
    const size = 18 - index * 2;
    const node = document.createElement("img");
    node.src = SLURP_COIN_SRC;
    node.alt = "";
    Object.assign(node.style, { position: "absolute", left: "0", top: "0", width: `${size}px`, height: `${size}px` });
    layer.appendChild(node);
    const sway = (index - 1) * 14;
    return node.animate(
      [
        { transform: at(x0 + sway, y0, size, 0.5), opacity: 0 },
        { transform: at(x0 + sway, y0 - 10, size, 1), opacity: 1, offset: 0.15 },
        { transform: at((x0 + x1) / 2 + sway, peak, size, 1.1, 180), opacity: 1, offset: 0.55 },
        { transform: at(x1, y1, size, 0.55, 360), opacity: to ? 0.9 : 0 },
      ],
      { duration: 600, delay: delay + index * 70, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "both" },
    );
  });
}

/** Coin fly: coins arc from a control into the balance chip. */
export function playSlpCoinFly(origin: SlpOrigin, target: Element | null = visibleBalance()) {
  const rect = rectOf(origin);
  if (slpPrefersReducedMotion()) return staticSparkle(rect);
  const layer = openRewardLayer("coins");
  if (!layer) return;
  closeWhenDone(layer, coinsInto(layer, rect, target?.getBoundingClientRect() ?? null));
}

/**
 * Coin rain (balance up: collect, refill): a few coins drop into the balance from above and land
 * with a Pop, 600 ms. The balance's own `SlurpCoinAmount` counts up alongside.
 */
export function playSlpCoinRain(target: Element, count = 5) {
  const rect = rectOf(target);
  if (slpPrefersReducedMotion()) return staticSparkle(rect);
  const layer = openRewardLayer("rain");
  if (!layer) return;
  const coins = Array.from({ length: count }, (_, index) => {
    const size = 20 - (index % 3) * 3;
    const node = document.createElement("img");
    node.src = SLURP_COIN_SRC;
    node.alt = "";
    Object.assign(node.style, { position: "absolute", left: "0", top: "0", width: `${size}px`, height: `${size}px` });
    layer.appendChild(node);
    // Spread across the number, a little wider than it, landing on its middle line.
    const x = rect.left + rect.width * ((index + 0.5) / count) + (Math.random() - 0.5) * 10;
    const y1 = rect.top + rect.height / 2;
    const y0 = y1 - 70 - Math.random() * 30;
    const spin = (Math.random() - 0.5) * 220;
    return node.animate(
      [
        { transform: at(x, y0, size, 0.8), opacity: 0 },
        { transform: at(x, y0 + 12, size, 1, spin / 4), opacity: 1, offset: 0.2 },
        { transform: at(x, y1, size, 0.9, spin), opacity: 1, offset: 0.85, easing: "ease-out" },
        { transform: at(x, y1 + 2, size, 0.5, spin), opacity: 0 },
      ],
      { duration: 600, delay: index * 60, easing: "cubic-bezier(0.55, 0, 0.9, 0.4)", fill: "both" },
    );
  });
  closeWhenDone(layer, [...coins, ...popInto(layer, rect, 560)]);
}

/**
 * The spend moment (no confirmation): a Burst on the button, coins fly to the balance chip and land
 * with a Pop. The chip's `SlurpCoinAmount` counts the balance down when the wallet refetches.
 */
export function playSlpSpendMoment(origin: SlpOrigin) {
  const rect = rectOf(origin);
  if (slpPrefersReducedMotion()) return staticSparkle(rect);
  const layer = openRewardLayer("spend");
  if (!layer) return;
  const target = visibleBalance()?.getBoundingClientRect() ?? null;
  closeWhenDone(layer, [
    ...burstInto(layer, rect, 11),
    ...coinsInto(layer, rect, target, 120),
    ...(target ? popInto(layer, target, 760) : []),
  ]);
}
