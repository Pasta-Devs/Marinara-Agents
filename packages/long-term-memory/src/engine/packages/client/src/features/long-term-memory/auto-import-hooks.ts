import { useQuery } from "@tanstack/react-query";
import type { LtmDebugEvent } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import { isReadingNow } from "./auto-import-status";

// The hooks live apart from auto-import-status so its pure helpers load without React Query (Engine-free tests).

/** The newest import events (the route's largest page, since manual imports share the phase); reading them needs no new server route. */
export function useAutoImportEvents(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...queryKeys.activity, "auto-import"],
    queryFn: () => request<{ events: LtmDebugEvent[] }>("/debug-log?phase=import&limit=1000"),
  });
}

/** Whether memory is reading a reply right now, from the extraction events the debug log already keeps. */
export function useReadingNow() {
  const events = useQuery({
    queryKey: [...queryKeys.activity, "reading-now"],
    queryFn: () => request<{ events: LtmDebugEvent[] }>("/debug-log?phase=extraction&limit=200"),
    refetchInterval: 4000,
  });
  return events.data ? isReadingNow(events.data.events) : false;
}
