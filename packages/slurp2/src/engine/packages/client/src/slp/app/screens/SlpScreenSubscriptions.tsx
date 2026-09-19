import { ChevronDown } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useNoodlerViewer } from "../../features/feed/slp-feed-viewer-hooks";
import { SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";

export function SubscriptionSections({
  creators,
  onOpenProfile,
  compact = false,
  embedded = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  creators: NonNullable<ReturnType<typeof useNoodlerViewer>["data"]>["creators"];
  onOpenProfile?: (accountId: string) => void;
  compact?: boolean;
  embedded?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (compact) {
    return (
      <section aria-labelledby="noodler-discover-heading">
        {/* A phone shows one card and a half of the row, which is a lot of height for a
            side note. Fold it away, and remember the choice for this session. */}
        {/* The button sits inside the heading, not the other way round: a button may not
            contain a heading, and the heading has to stay a heading for the landmark. */}
        <h3 id="noodler-discover-heading" className="text-xs font-bold text-[var(--muted-foreground)]">
          <button
            type="button"
            onClick={() => onToggleCollapsed?.()}
            aria-expanded={!collapsed}
            // Only claim to control the list while it is mounted.
            {...(collapsed ? {} : { "aria-controls": "noodler-discover-list" })}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 pb-2 text-left"
          >
            {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
            <span className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] font-normal tabular-nums text-[var(--muted-foreground)]">
              {creators.length}
              <ChevronDown
                size={16}
                className={cn("transition-transform duration-200", collapsed ? "-rotate-90" : "rotate-0")}
              />
            </span>
          </button>
        </h3>
        {collapsed ? null : creators.length > 0 ? (
          <div
            id="noodler-discover-list"
            className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {creators.map((creator) => (
              <SlurpCreatorProfileCard
                key={creator.profile.id}
                creator={creator}
                onOpenProfile={onOpenProfile}
                className="w-64 shrink-0 snap-start"
              />
            ))}
          </div>
        ) : (
          <p className="px-4 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
          </p>
        )}
      </section>
    );
  }
  return (
    <section
      className={cn(
        "overflow-hidden",
        !embedded &&
          "rounded-xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]",
      )}
    >
      <div className="px-4 pb-2 pt-4">
        <h3 id="slurp-rail-discover-heading" className="text-base font-black tracking-tight">
          {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
        </h3>
      </div>
      {creators.length > 0 ? (
        <div className="max-h-[36rem] space-y-3 overflow-y-auto p-2 pt-1">
          {creators.map((creator) => (
            <SlurpCreatorProfileCard key={creator.profile.id} creator={creator} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
        </p>
      )}
    </section>
  );
}
