import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpEventGroup } from "./slp-notifications-contract.js";

/** The notification stream. `unseen` is what happened while you were away. */
export function useSlurpNotifications(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "notifications", personaId ?? "none"],
    queryFn: () =>
      api.get<{ items: SlurpEventGroup[]; unseen: SlurpEventGroup[]; unseenCount: number }>(
        `/slurp2/noodler/notifications?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    staleTime: 15_000,
  });
}
export function useMarkSlurpNotificationsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<{ ok: boolean }>("/slurp2/noodler/notifications/seen", { personaId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "notifications"] }),
  });
}
