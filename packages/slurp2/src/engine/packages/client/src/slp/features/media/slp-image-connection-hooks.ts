import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

export type SlurpImageConnections = {
  defaultConnectionId: string | null;
  creatorConnectionIds: Record<string, string>;
};
export function useSlurpImageConnections(enabled = true) {
  return useQuery({
    queryKey: slpKeys.noodlerImageConnections(),
    queryFn: () => api.get<SlurpImageConnections>("/slurp2/slurp/image-connections"),
    enabled,
    staleTime: 10_000,
  });
}
/** The Engine's image style profiles, for Slurp's own style choice. */
export function useSlurpImageStyleProfiles(enabled = true) {
  return useQuery({
    queryKey: [...slpKeys.noodlerImageConnections(), "style-profiles"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/slurp2/slurp/image-style-profiles"),
    enabled,
    staleTime: 60_000,
  });
}
export function useUpdateSlurpImageConnections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { defaultConnectionId?: string | null; creatorId?: string; connectionId?: string | null }) =>
      api.patch<SlurpImageConnections>("/slurp2/slurp/image-connections", patch),
    onSuccess: (value) => qc.setQueryData(slpKeys.noodlerImageConnections(), value),
  });
}
/**
 * Point several new Creators at one image connection.
 *
 * The PATCH route maps one Creator at a time and the server serializes the blob write, so these
 * run in sequence; the wizard only ever creates a handful at once.
 */
export function useUpdateSlurpConnectionsForCreators() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { creatorIds: string[]; connectionId: string }) => {
      let latest: SlurpImageConnections | undefined;
      for (const creatorId of input.creatorIds) {
        latest = await api.patch<SlurpImageConnections>("/slurp2/slurp/image-connections", {
          creatorId,
          connectionId: input.connectionId,
        });
      }
      return latest;
    },
    onSuccess: (value) => {
      if (value) qc.setQueryData(slpKeys.noodlerImageConnections(), value);
    },
  });
}
