import { Check, CircleAlert, Database, FileInput, ListChecks, Loader2, Settings2, type LucideIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LongTermMemoryDestination } from "./types";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { getLtmSourceTaskSnapshot, subscribeLtmSourceTask } from "./source-task";

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
  const { locale, t: localizeUi } = useLtmTranslation();
  const sourceTask = useSyncExternalStore(subscribeLtmSourceTask, getLtmSourceTaskSnapshot, getLtmSourceTaskSnapshot);
  const activeSourceTask = sourceTask.active?.status === "running" ? sourceTask.active : null;
  const latestSourceTask = sourceTask.latest;
  const failureCount = latestSourceTask
    ? latestSourceTask.status === "failed"
      ? latestSourceTask.sourceCount
      : latestSourceTask.status === "cancelled"
        ? 0
        : ["failed", "cancelled", "missing", "sourceWriteFailed"].reduce(
            (count, key) => count + (latestSourceTask.safeResult?.counts?.[key] ?? 0),
            0,
          )
    : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!latestSourceTask?.finishedAt || latestSourceTask.status !== "completed" || failureCount) return;
    const remaining = Date.parse(latestSourceTask.finishedAt) + 5_000 - Date.now();
    if (remaining <= 0) return;
    setNow(Date.now());
    const timeout = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(timeout);
  }, [failureCount, latestSourceTask?.finishedAt, latestSourceTask?.status]);
  const unreadFailure = Boolean(failureCount && !latestSourceTask?.viewedAt);
  const recentCompletion = Boolean(
    latestSourceTask?.status === "completed" &&
    !failureCount &&
    latestSourceTask.finishedAt &&
    now < Date.parse(latestSourceTask.finishedAt) + 5_000,
  );
  const items = destinations.map((item) => {
    const active = item.id === destination;
    const badge = item.badge ? badges?.[item.badge] : undefined;
    const sourceTaskLabel =
      item.id !== "sources"
        ? null
        : activeSourceTask?.kind === "import"
          ? localizeUi("ui.longTermMemory.sourcesworkspace.importingSources", { count: activeSourceTask.sourceCount })
          : activeSourceTask?.kind === "refresh"
            ? localizeUi("ui.longTermMemory.sourcesworkspace.refreshingSources", {
                count: activeSourceTask.sourceCount,
              })
            : activeSourceTask
              ? localizeUi("ui.longTermMemory.sourcesworkspace.reExtractingSources", {
                  count: activeSourceTask.sourceCount,
                })
              : latestSourceTask?.status === "cancelled" && !latestSourceTask.viewedAt
                ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskCancelled")
                : unreadFailure
                  ? localizeUi(
                      selectLtmPluralForm(locale, failureCount) === "one"
                        ? "ui.longTermMemory.sourcesworkspace.sourceTaskFailedCountOne"
                        : "ui.longTermMemory.sourcesworkspace.sourceTaskFailedCountOther",
                      { count: failureCount },
                    )
                  : recentCompletion && latestSourceTask
                    ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskCompleted", {
                        count: latestSourceTask.sourceCount,
                      })
                    : null;
    const label =
      item.id === "sources" && sourceTaskLabel
        ? sourceTaskLabel
        : localizeUi(mobile ? item.shortLabelKey : item.labelKey);
    const Icon =
      item.id === "sources" && activeSourceTask
        ? Loader2
        : item.id === "sources" && unreadFailure
          ? CircleAlert
          : item.id === "sources" && recentCompletion
            ? Check
            : item.icon;
    const sourceTaskCount = activeSourceTask?.sourceCount ?? (unreadFailure ? failureCount : null);
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
        <Icon
          aria-hidden="true"
          size={mobile ? "1.125rem" : "0.875rem"}
          className={item.id === "sources" && activeSourceTask ? "animate-spin" : undefined}
        />
        <span aria-live={item.id === "sources" ? "polite" : undefined}>{label}</span>
        {item.id === "sources" && sourceTaskCount ? (
          <span data-ltm-badge>{sourceTaskCount}</span>
        ) : typeof badge === "number" && badge > 0 ? (
          <span data-ltm-badge className="mari-editor-tab-badge">
            {badge}
          </span>
        ) : null}
      </button>
    );
  });

  return (
    <div
      data-ltm-navigation-host
      className={mobile ? "w-full" : "min-w-0 flex-1"}
      style={{ containerName: "ltm-navigation", containerType: "inline-size" }}
    >
      <nav
        aria-label={localizeUi("ui.longTermMemory.longtermmemorynavigation.longTermMemorySections")}
        data-ltm-navigation={mobile ? "mobile" : "desktop"}
        className={
          mobile
            ? "mari-editor-tab-rail grid w-full shrink-0 grid-cols-4"
            : "mari-editor-tab-rail min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border p-1"
        }
        style={mobile ? undefined : { overflowX: "auto" }}
      >
        {items}
      </nav>
    </div>
  );
}
