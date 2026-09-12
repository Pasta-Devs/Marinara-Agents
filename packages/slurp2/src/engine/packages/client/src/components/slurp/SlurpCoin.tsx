import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * The coin, inlined as a data URI rather than fetched from the package asset route.
 *
 * That route cannot serve it. The Engine only serves paths declared in
 * `contributions.assets.paths` or `homeBrowserTab.iconPaths`, and it deliberately keeps SVG out of
 * its servable content types entirely — an SVG fetched same-origin can execute script, so the
 * policy excludes "anything active". Declaring the file would not have helped; the request 404s on
 * the content type either way.
 *
 * An `<img>` cannot execute script in an embedded SVG, so this carries none of the risk the policy
 * exists to prevent. It also avoids the `<defs>` id collisions that inlining the markup would
 * cause: the coin renders once per price on a page, and every copy would redeclare the same
 * gradient ids. Each `<img>` is its own document, so the ids stay scoped.
 *
 * Generated from `packages/slurp/slurpcoin.svg`, which stays the source of truth. Regenerate with:
 *   python3 -c 'import base64,re,pathlib;s=re.sub(r">\s+<","><",pathlib.Path("packages/slurp/slurpcoin.svg").read_text()).strip();print(base64.b64encode(s.encode()).decode())'
 */
export const SLURP_COIN_SRC =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIyMCIgZmlsbD0iI0YwNUE5RCIgc3Ryb2tlPSIjMTExMTExIiBzdHJva2Utd2lkdGg9IjI4Ii8+PGNpcmNsZSBjeD0iMjU2IiBjeT0iMjU2IiByPSIxOTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGOUJDNiIgc3Ryb2tlLXdpZHRoPSI4IiBvcGFjaXR5PSIuNiIvPjx0ZXh0IHg9IjI1NiIgeT0iMzM5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsIEhlbHZldGljYSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMjAiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiNGRkZGRkYiPmM8L3RleHQ+PC9zdmc+";

export function SlurpCoin({ className, size = "1em" }: { className?: string; size?: number | string }) {
  return (
    <img
      src={SLURP_COIN_SRC}
      alt=""
      aria-hidden="true"
      className={cn("inline-block shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function SlurpCoinAmount({
  amount,
  className,
  size = "1em",
  suffix,
  watchAmount,
}: {
  amount: number | string;
  className?: string;
  size?: number | string;
  suffix?: ReactNode;
  /** A live balance to watch. Prices and ledger amounts deliberately omit this. */
  watchAmount?: number;
}) {
  const reduceMotion = useReducedMotion();
  const previousAmount = useRef(watchAmount);
  const [change, setChange] = useState<{ amount: number; direction: "earn" | "spend"; revision: number } | null>(null);

  useEffect(() => {
    const previous = previousAmount.current;
    previousAmount.current = watchAmount;
    if (watchAmount === undefined || previous === undefined || watchAmount === previous) return;

    setChange({
      amount: Math.abs(watchAmount - previous),
      direction: watchAmount > previous ? "earn" : "spend",
      revision: Date.now(),
    });
    const timer = window.setTimeout(() => setChange(null), reduceMotion ? 450 : 900);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, watchAmount]);

  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1 transition-colors duration-150",
        change?.direction === "spend" && "text-[var(--slurp-coral)]",
        change?.direction === "earn" && "text-[var(--slurp-success)]",
        className,
      )}
      data-slurp-coin-balance={watchAmount === undefined ? undefined : "true"}
    >
      <span>{amount}</span>
      <motion.span
        className="inline-flex"
        animate={
          change && !reduceMotion
            ? change.direction === "spend"
              ? { rotate: [0, -16, 8, 0], scale: [1, 0.82, 1], y: [0, 3, 0] }
              : { rotate: [0, 10, -5, 0], scale: [1, 1.18, 1], y: [0, -3, 0] }
            : { rotate: 0, scale: 1, y: 0 }
        }
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        <SlurpCoin size={size} />
      </motion.span>
      {suffix && <span>{suffix}</span>}
      <AnimatePresence initial={false}>
        {change && !reduceMotion && (
          <motion.span
            key={change.revision}
            initial={{ opacity: 0, scale: 0.8, y: change.direction === "earn" ? 8 : -2 }}
            animate={{ opacity: 1, scale: 1, y: change.direction === "earn" ? -14 : 12 }}
            exit={{ opacity: 0, y: change.direction === "earn" ? -22 : 20 }}
            transition={{ duration: 0.68, ease: "easeOut" }}
            className={cn(
              "pointer-events-none absolute end-0 top-0 inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-black",
              change.direction === "earn" ? "text-[var(--slurp-success)]" : "text-[var(--slurp-coral)]",
            )}
            data-slurp-coin-spent={change.direction === "spend" ? change.amount : undefined}
            data-slurp-coin-earned={change.direction === "earn" ? change.amount : undefined}
            aria-hidden="true"
          >
            {change.direction === "earn" ? "+" : "−"}
            {change.amount}
            <SlurpCoin size={12} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** A small one-shot coin trail for the control where a transaction begins. */
export function SlurpCoinBurst({
  active,
  direction = "spend",
  className,
}: {
  active: boolean;
  direction?: "earn" | "spend";
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <AnimatePresence initial={false}>
      {active && (
        <motion.span
          className={cn("pointer-events-none absolute inset-0 z-20 overflow-visible", className)}
          aria-hidden="true"
          data-slurp-coin-burst={direction}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[-22, 0, 22].map((x, index) => (
            <motion.span
              key={x}
              className="absolute start-1/2 top-1/2 inline-flex"
              initial={{ x, y: direction === "earn" ? -30 - index * 5 : -8, opacity: 0, scale: 0.55 }}
              animate={{
                x: x * 0.45,
                y: direction === "earn" ? 7 : 34 + index * 5,
                opacity: [0, 0.9, 0],
                scale: [0.55, 0.8, 0.62],
                rotate: direction === "earn" ? 18 - index * 18 : -18 + index * 18,
              }}
              transition={{ duration: 0.72, delay: index * 0.07, ease: "easeOut" }}
            >
              <SlurpCoin size={13} />
            </motion.span>
          ))}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
