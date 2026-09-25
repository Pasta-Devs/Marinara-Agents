import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";
import type { SlpCanonAnchors } from "./slp-canon-anchor-text";

export type SlpCanonAnchorState = {
  anchors: SlpCanonAnchors | null;
  edited: boolean;
  /** False when the card changed since: the next Beats post reads it again. */
  current: boolean;
  /** False until the card was read once. */
  read: boolean;
  hasCard: boolean;
};

const key = (creatorId: string) => [...slpKeys.noodlerRoot(), "canon-anchors", creatorId] as const;
const path = (creatorId: string) => `/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/canon-anchors`;

export function useSlurpCanonAnchors(creatorId: string) {
  return useQuery({ queryKey: key(creatorId), queryFn: () => api.get<SlpCanonAnchorState>(path(creatorId)) });
}

export function useSlurpCanonAnchorMutations(creatorId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: key(creatorId) });
  return {
    save: useMutation({
      mutationFn: (anchors: SlpCanonAnchors) => api.put<SlpCanonAnchorState>(path(creatorId), anchors),
      onSuccess: refresh,
    }),
    reread: useMutation({
      mutationFn: () => api.delete<{ cleared: true }>(path(creatorId)),
      onSuccess: refresh,
    }),
  };
}
