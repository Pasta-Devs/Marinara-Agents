import {
  Activity,
  Check,
  CircleAlert,
  Database,
  FileInput,
  ListChecks,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LongTermMemoryDestination } from "./types";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { Spinner } from "./shared-controls";
import { getLtmSourceTaskSnapshot, subscribeLtmSourceTask } from "./source-task";

const destinations: Array<{
  id: LongTermMemoryDestination;
  labelKey: string;
  shortLabelKey: string;
  hintKey: string;
  icon: LucideIcon;
  badge?: keyof LongTermMemoryNavigationBadges;
}> = [
  {
    id: "vault",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.memoryVault",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.memories",
    hintKey: "ui.longTermMemory.longtermmemorynavigation.memoriesHint",
    icon: Database,
    badge: "memories",
  },
  {
    id: "review",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.reviewQueue",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.review",
    hintKey: "ui.longTermMemory.longtermmemorynavigation.reviewHint",
    icon: ListChecks,
    badge: "review",
  },
  {
    id: "sources",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.sources",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.sources",
    hintKey: "ui.longTermMemory.longtermmemorynavigation.sourcesHint",
    icon: FileInput,
  },
  {
    id: "activity",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.activity",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.activity",
    hintKey: "ui.longTermMemory.longtermmemorynavigation.activityHint",
    icon: Activity,
  },
  {
    id: "settings",
    labelKey: "ui.longTermMemory.longtermmemorynavigation.memorySettings",
    shortLabelKey: "ui.longTermMemory.longtermmemorynavigation.settings",
    hintKey: "ui.longTermMemory.longtermmemorynavigation.settingsHint",
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
  const sourceTaskLabel =
    activeSourceTask?.kind === "import"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskImporting")
      : activeSourceTask?.kind === "refresh"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskRefreshing")
        : activeSourceTask
          ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskReExtracting")
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
  const items = destinations.map((item) => {
    const active = item.id === destination;
    const badge = item.badge ? badges?.[item.badge] : undefined;
    const label = localizeUi(mobile ? item.shortLabelKey : item.labelKey);
    const Icon =
      item.id === "sources" && unreadFailure
        ? CircleAlert
        : item.id === "sources" && recentCompletion
          ? Check
          : item.icon;
    return (
      <button
        key={item.id}
        type="button"
        data-ltm-control="navigation"
        data-ltm-destination={item.id}
        aria-current={active ? "page" : undefined}
        aria-label={item.id === "sources" ? label : undefined}
        title={localizeUi(item.hintKey)}
        onClick={() => onDestinationChange(item.id)}
        data-active={active}
        data-ltm-tab-focus
        className={`mari-editor-tab relative flex items-center gap-2 rounded-lg text-xs font-semibold transition-colors ${
          mobile
            ? "min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 px-2 text-[0.625rem]"
            : "min-h-11 shrink-0 justify-start whitespace-nowrap px-3 text-left"
        }`}
      >
        {item.id === "sources" && activeSourceTask ? (
          <Spinner size={mobile ? "1.125rem" : "0.875rem"} />
        ) : (
          <Icon aria-hidden="true" size={mobile ? "1.125rem" : "0.875rem"} />
        )}
        <span className="min-w-0 truncate" aria-hidden={item.id === "sources" ? true : undefined}>
          {label}
        </span>
        {item.id === "sources" && sourceTaskLabel && !mobile ? (
          <span
            data-ltm-source-task-status-visual
            aria-hidden="true"
            className="min-w-0 max-w-[9rem] truncate font-medium text-[var(--marinara-editor-muted)]"
          >
            {sourceTaskLabel}
          </span>
        ) : null}
        {typeof badge === "number" && badge > 0 ? (
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
      {sourceTaskLabel && mobile ? (
        // The icon alone says too little on a phone; the bar's own line names the task.
        <span
          data-ltm-source-task-status-visual
          aria-hidden="true"
          className="block truncate px-3 pt-1 text-center text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]"
        >
          {sourceTaskLabel}
        </span>
      ) : null}
      <nav
        aria-label={localizeUi("ui.longTermMemory.longtermmemorynavigation.longTermMemorySections")}
        data-ltm-navigation={mobile ? "mobile" : "desktop"}
        className={
          mobile
            ? "mari-editor-tab-rail grid w-full shrink-0"
            : "mari-editor-tab-rail min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border p-1"
        }
        style={mobile ? undefined : { overflowX: "auto" }}
      >
        {items}
      </nav>
      {sourceTaskLabel ? (
        <span data-ltm-source-task-status role="status" aria-live="polite" className="sr-only">
          {sourceTaskLabel}
        </span>
      ) : null}
    </div>
  );
}
