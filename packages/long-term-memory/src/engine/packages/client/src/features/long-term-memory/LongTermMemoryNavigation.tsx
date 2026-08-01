import {
  Database,
  FileInput,
  ListChecks,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { LongTermMemoryDestination } from "./types";
import { useLtmTranslation } from "./localization";

const destinations: Array<{
  id: LongTermMemoryDestination;
  labelKey: string;
  shortLabelKey: string;
  icon: LucideIcon;
  badge?: keyof LongTermMemoryNavigationBadges;
}> = [
  {
    id: "vault",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.memoryVault",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.memories",
    icon: Database,
    badge: "memories",
  },
  {
    id: "review",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.reviewQueue",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.review",
    icon: ListChecks,
    badge: "review",
  },
  {
    id: "sources",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.sources",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.sources",
    icon: FileInput,
  },
  {
    id: "settings",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.memorySettings",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.settings",
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
  const { t: localizeUi } = useLtmTranslation();
  const items = destinations.map((item) => {
    const active = item.id === destination;
    const badge = item.badge ? badges?.[item.badge] : undefined;
    const label = localizeUi(mobile ? item.shortLabelKey : item.labelKey);
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        data-ltm-control="navigation"
        data-ltm-destination={item.id}
        aria-current={active ? "page" : undefined}
        onClick={() => onDestinationChange(item.id)}
        data-active={active}
        className={`mari-editor-tab relative flex items-center gap-2 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)] ${
          mobile
            ? "min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 px-2 text-[0.625rem]"
            : "min-h-10 shrink-0 justify-start whitespace-nowrap px-3 text-left"
        }`}
      >
        <Icon aria-hidden="true" size={mobile ? "1.125rem" : "0.875rem"} />
        <span>{label}</span>
        {typeof badge === "number" && badge > 0 ? (
          <span data-ltm-badge className="mari-editor-tab-badge">
            {badge}
          </span>
        ) : null}
      </button>
    );
  });

  return (
    <>
      {mobile ? (
        <style>{`
          [data-ltm-navigation="mobile"] {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            width: 100%;
          }
          [data-ltm-navigation="mobile"] > [data-ltm-control="navigation"] {
            min-width: 0;
            width: 100%;
          }
          [data-ltm-navigation="mobile"] [data-ltm-badge] {
            position: absolute;
            left: 0.375rem;
            top: 0.375rem;
            margin-left: 0;
          }
          [data-ltm-navigation="desktop"] {
            display: none;
          }
          @media (min-width: 48rem) {
            [data-ltm-navigation="mobile"] {
              display: none;
            }
            [data-ltm-navigation="desktop"] {
              display: flex;
            }
          }
        `}</style>
      ) : null}
      <nav
      aria-label={localizeUi(
        "ui.longTermMemory.longtermmemorynavigation.longTermMemorySections",
      )}
      data-ltm-navigation={mobile ? "mobile" : "desktop"}
      className={
        mobile
          ? "mari-editor-tab-rail w-full shrink-0 border-t"
          : "mari-editor-tab-rail min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border p-1"
      }
      style={mobile ? undefined : { overflowX: "auto" }}
    >
      {items}
      </nav>
    </>
  );
}
