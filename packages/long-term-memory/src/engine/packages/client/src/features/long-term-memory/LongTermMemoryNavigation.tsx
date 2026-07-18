import type { LongTermMemoryDestination } from "./types";

const destinations: Array<{
  id: LongTermMemoryDestination;
  label: string;
  badge?: keyof LongTermMemoryNavigationBadges;
}> = [
  { id: "vault", label: "Memory Vault", badge: "memories" },
  { id: "review", label: "Review Queue", badge: "review" },
  { id: "sources", label: "Sources" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Memory Settings" },
];

export type LongTermMemoryNavigationBadges = {
  memories?: number;
  review?: number;
};

export function LongTermMemoryNavigation({
  destination,
  onDestinationChange,
  badges,
}: {
  destination: LongTermMemoryDestination;
  onDestinationChange: (destination: LongTermMemoryDestination) => void;
  badges?: LongTermMemoryNavigationBadges;
}) {
  const items = destinations.map((item) => {
    const active = item.id === destination;
    const badge = item.badge ? badges?.[item.badge] : undefined;
    return (
      <button
        key={item.id}
        type="button"
        data-ltm-control="navigation"
        data-ltm-destination={item.id}
        aria-current={active ? "page" : undefined}
        onClick={() => onDestinationChange(item.id)}
        className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-lg border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${active ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]" : "border-[var(--border)] bg-[var(--secondary)]/45 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
      >
        <span>{item.label}</span>
        {typeof badge === "number" && badge > 0 ? (
          <span
            data-ltm-badge
            className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[0.6875rem] text-[var(--foreground)]"
          >
            {badge}
          </span>
        ) : null}
      </button>
    );
  });

  return (
    <>
      <nav
        aria-label="Long-Term Memory sections"
        className="hidden w-48 shrink-0 flex-col gap-2 md:flex"
      >
        {items}
      </nav>
      <nav
        aria-label="Long-Term Memory sections"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden sm:-mx-6 sm:px-6"
      >
        {items}
      </nav>
    </>
  );
}
