import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";
import type { SlpStoryConditionInput, SlpStoryFact } from "../../../../../shared/src/slp/slp-story-engine.js";

/** A Creator's standing conditions and what of them reaches posts, replies and pictures. */
export type SlpCreatorLife = {
  facts: SlpStoryFact[];
  state: { tags: string[]; lines: string[]; look: string | null };
};

const key = (creatorId: string) => [...slpKeys.noodlerRoot(), "life", creatorId] as const;
const path = (creatorId: string) => `/slurp2/story/state/${encodeURIComponent(creatorId)}`;

export function useSlurpCreatorLife(creatorId: string) {
  return useQuery({ queryKey: key(creatorId), queryFn: () => api.get<SlpCreatorLife>(path(creatorId)) });
}

export function useSlurpCreatorLifeMutations(creatorId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: key(creatorId) });
  return {
    put: useMutation({
      mutationFn: (input: SlpStoryConditionInput) => api.post<{ fact: SlpStoryFact }>(path(creatorId), input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (factId: string) => api.delete(`/slurp2/story/facts/${encodeURIComponent(factId)}`),
      onSuccess: refresh,
    }),
  };
}
