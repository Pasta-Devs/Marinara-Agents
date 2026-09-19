import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type { NoodleAmbientProfileRerollResult, SlurpAmbientProfile } from "./slp-audience-contract.js";

/** The managed ambient roster. Seeded server-side on read, so this is also what creates them. */
export function useSlurpAmbientProfiles(enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"],
    queryFn: () => api.get<{ allowRandomUsers: boolean; items: SlurpAmbientProfile[] }>("/slurp2/ambient-profiles"),
    enabled,
    staleTime: 30_000,
  });
}
/** Reroll the generated identities of the managed ambient profiles. */
export function useRerollAmbientProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountIds: string[]) =>
      api.post<NoodleAmbientProfileRerollResult>("/slurp2/ambient-profiles/reroll", { accountIds }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"] }),
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerEligibleAccountsRoot() }),
      ]),
  });
}
/** Edit an ambient profile's name, handle, and bio. */
export function useUpdateAmbientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; displayName: string; handle: string; bio: string }) =>
      api.patch<SlpAccount>(`/slurp2/ambient-profiles/${encodeURIComponent(id)}`, body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: noodleKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: [...noodleKeys.noodlerRoot(), "ambient-profiles"] }),
      ]),
  });
}
