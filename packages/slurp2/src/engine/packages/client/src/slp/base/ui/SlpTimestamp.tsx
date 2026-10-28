import { useState, useSyncExternalStore } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { formatFullTime, formatRelativeTime } from "./slp-date-time";

// One clock for every timestamp on screen, ticking while any is mounted, so "4m" becomes "5m".
let now = Date.now();
let timer: number | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * A relative time ("4m", "Tue") with the full date on hover. `tappable` also shows the full date on
 * tap; leave it off inside a row that is itself a button.
 */
export function SlpTimestamp({
  value,
  tappable = false,
  className,
}: {
  value: string;
  tappable?: boolean;
  className?: string;
}) {
  const { i18n } = useUiTranslation();
  const current = useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
  const [full, setFull] = useState(false);
  const absolute = formatFullTime(value, i18n.language);
  const time = (
    <time dateTime={value} title={absolute} className={cn("tabular-nums", !tappable && className)}>
      {full ? absolute : formatRelativeTime(value, i18n.language, current)}
    </time>
  );
  if (!tappable) return time;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setFull((value) => !value);
      }}
      aria-label={absolute}
      className={cn(
        "inline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
        className,
      )}
    >
      {time}
    </button>
  );
}
