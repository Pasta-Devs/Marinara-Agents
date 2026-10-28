import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpEventGroup } from "./slp-notifications-contract.js";

type SlurpNotificationUnseenCountResponse = { unseenCount: number };

/** The notification stream. `unseen` is what happened while you were away. */
export function useSlurpNotifications(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: slpKeys.notifications(personaId ?? "none"),
    queryFn: () =>
      api.get<{ items: SlurpEventGroup[]; unseen: SlurpEventGroup[]; unseenCount: number }>(
        `/slurp2/slurp/notifications?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    staleTime: 15_000,
  });
}
export function useSlurpNotificationUnseenCount(personaId: string | null) {
  return useQuery({
    queryKey: slpKeys.notificationUnseenCount(personaId ?? "none"),
    queryFn: () =>
      api.get<SlurpNotificationUnseenCountResponse>(
        `/slurp2/slurp/notifications/unseen-count?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId),
    staleTime: 15_000,
    refetchInterval: personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useMarkSlurpNotificationsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<{ ok: boolean }>("/slurp2/slurp/notifications/seen", { personaId }),
    onSuccess: async (_result, personaId) => {
      await qc.cancelQueries({ queryKey: slpKeys.notificationUnseenCount(personaId) });
      qc.setQueryData(slpKeys.notificationUnseenCount(personaId), { unseenCount: 0 });
      void qc.invalidateQueries({ queryKey: slpKeys.notificationUnseenCount(personaId) });
      void qc.invalidateQueries({ queryKey: slpKeys.notifications(personaId) });
    },
  });
}
