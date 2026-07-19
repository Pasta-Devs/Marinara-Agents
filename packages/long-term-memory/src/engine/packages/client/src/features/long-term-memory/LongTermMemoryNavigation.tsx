import {
  Activity,
  Database,
  FileInput,
  ListChecks,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { LongTermMemoryDestination } from "./types";

const destinations: Array<{
  id: LongTermMemoryDestination;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badge?: keyof LongTermMemoryNavigationBadges;
}> = [
  {
    id: "vault",
    label: "Memory Vault",
    shortLabel: "Memories",
    icon: Database,
    badge: "memories",
  },
  {
    id: "review",
    label: "Review Queue",
    shortLabel: "Review",
    icon: ListChecks,
    badge: "review",
  },
  { id: "sources", label: "Sources", shortLabel: "Sources", icon: FileInput },
  { id: "activity", label: "Activity", shortLabel: "Activity", icon: Activity },
  {
    id: "settings",
    label: "Memory Settings",
    shortLabel: "Settings",
    icon: Settings2,
  },
];

export type LongTermMemoryNavigationBadges = {
  memories?: number;
  review?: number;
};

export function LongTermMemoryNavigation({
  destination,
  onDestinationChange,
  badges,
  mobile = false,
}: {
  destination: LongTermMemoryDestination;
  onDestinationChange: (destination: LongTermMemoryDestination) => void;
  badges?: LongTermMemoryNavigationBadges;
  mobile?: boolean;
}) {
  const items = destinations.map((item) => {
    const active = item.id === destination;
    const badge = item.badge ? badges?.[item.badge] : undefined;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        data-ltm-control="navigation"
        data-ltm-destination={item.id}
        aria-current={active ? "page" : undefined}
        onClick={() => onDestinationChange(item.id)}
        className={mobile
          ? `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`
          : `flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-lg border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${active ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]" : "border-[var(--border)] bg-[var(--secondary)]/45 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
      >
        {mobile ? <Icon aria-hidden="true" size="1rem" /> : null}
        <span>{mobile ? item.shortLabel : item.label}</span>
        {typeof badge === "number" && badge > 0 ? (
          <span
            data-ltm-badge
            className={mobile
              ? "absolute right-[18%] top-1 rounded-full bg-[var(--primary)] px-1.5 text-[0.625rem] text-[var(--primary-foreground)]"
              : "rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[0.6875rem] text-[var(--foreground)]"}
          >
            {badge}
          </span>
        ) : null}
      </button>
    );
  });

  return (
    <nav
      aria-label="Long-Term Memory sections"
      className={mobile
        ? "flex shrink-0 border-t border-[var(--border)] bg-[var(--background)] md:hidden"
        : "hidden w-48 shrink-0 flex-col gap-2 md:flex"}
    >
      {items}
    </nav>
  );
}
