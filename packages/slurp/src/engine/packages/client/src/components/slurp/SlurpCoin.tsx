import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export const SLURP_COIN_SRC = "/api/capability-packages/slurp/assets/slurpcoin.svg";

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
