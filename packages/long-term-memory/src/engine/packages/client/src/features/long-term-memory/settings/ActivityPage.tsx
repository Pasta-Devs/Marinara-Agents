import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage, invalidateLtmQueries, queryKeys, request, settingsQueryOptions } from "../api";
import { useLtmTranslation } from "../localization";
import type { LongTermMemoryDestinationProps } from "../types";
import ActivityView from "./ActivityView";
import { Toggle } from "./settings-shared";

/** The Activity destination: the record switch on top, then the log. The switch saves on its own, like the drawer's "Turn on". */
export default function ActivityPage(destinationProps: LongTermMemoryDestinationProps) {
  const { t: localizeUi } = useLtmTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQueryOptions);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const busyRef = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);
  // A handoff (the Vault's "View activity", the drawer's "Open in Activity") lands on the switch; plain navigation keeps focus on the tab.
  const handedOff = useRef(Boolean(destinationProps.openActivityMemoryId || destinationProps.openActivityOperationId));
  useEffect(() => {
    if (handedOff.current)
      pageRef.current?.querySelector<HTMLElement>("[data-ltm-switch]")?.focus({ preventScroll: true });
  }, []);
  const change = async (value: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPendingValue(value);
    try {
      await request("/settings", "PUT", { longTermMemoryDebug: value });
      await invalidateLtmQueries(queryClient, [queryKeys.settings]);
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.activityview.recordRecallExplanationsFailed")));
    } finally {
      busyRef.current = false;
      setPendingValue(null);
    }
  };
  return (
    <div
      ref={pageRef}
      className="space-y-4"
      style={{ containerName: "ltm-memory-settings", containerType: "inline-size" }}
    >
      <div>
        <h2 className="text-sm font-semibold">{localizeUi("ui.longTermMemory.longtermmemorynavigation.activity")}</h2>
        <p data-ltm-tab-subtitle className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.longtermmemorynavigation.activityHint")}
        </p>
      </div>
      <div data-ltm-activity-record>
        <Toggle
          label={localizeUi("ui.longTermMemory.activityview.recordRecallExplanations")}
          hint={localizeUi("ui.longTermMemory.activityview.recordRecallExplanationsHint")}
          checked={pendingValue ?? settings.data?.longTermMemoryDebug ?? false}
          locked={pendingValue !== null || !settings.data}
          onChange={(value) => void change(value)}
        />
      </div>
      <ActivityView {...destinationProps} />
    </div>
  );
}
