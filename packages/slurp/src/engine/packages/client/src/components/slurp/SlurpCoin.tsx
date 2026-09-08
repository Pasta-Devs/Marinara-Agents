import type { ReactNode } from "react";
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
}: {
  amount: number | string;
  className?: string;
  size?: number | string;
  suffix?: ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{amount}</span>
      <SlurpCoin size={size} />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}
