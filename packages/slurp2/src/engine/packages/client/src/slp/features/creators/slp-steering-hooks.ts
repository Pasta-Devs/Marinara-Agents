import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";
import type { SlpCreatorSteering } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpSpiceLevel, SlpSpiceStep } from "../../../../../shared/src/slp/slp-spice.js";

/** The Creator's spice: their level (own or Slurp-wide), the limit, and the tastes they lean into. */
export type SlpCreatorSpice = {
  level: SlpSpiceStep | null;
  own: boolean;
  max: SlpSpiceLevel;
  leans: string[];
  /** The Slurp-wide level ("Use Slurp-wide (…)"); older servers send none. */
  inherited?: SlpSpiceStep | null;
};
type SteeringAnswer = { steering: SlpCreatorSteering; spice: SlpCreatorSpice | null };
/** A change to what posts say also reports the posts already prepared, so the app can ask. */
type PatchAnswer = SteeringAnswer & { prepared?: { posts: number; calls: number } | null };

const key = (creatorId: string) => [...slpKeys.noodlerRoot(), "steering", creatorId] as const;
const path = (creatorId: string) => `/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/steering`;

export function useSlurpCreatorSteering(creatorId: string) {
  return useQuery({ queryKey: key(creatorId), queryFn: () => api.get<SteeringAnswer>(path(creatorId)) });
}

/** Every change answers with the whole steering, which replaces the cached copy. */
export function useSlurpCreatorSteeringMutations(creatorId: string) {
  const qc = useQueryClient();
  const store = (answer: SteeringAnswer) => qc.setQueryData(key(creatorId), answer);
  return {
    patch: useMutation({
      mutationFn: (
        patch: Partial<Omit<SlpCreatorSteering, "nudges" | "support" | "limitsMoved">> & {
          spiceLevel?: SlpSpiceStep | null;
        },
      ) => api.patch<PatchAnswer>(path(creatorId), patch),
      onSuccess: (answer, patch) => {
        store(answer);
        // The level lives with the post guidance, which Creator settings shows too.
        if (patch.spiceLevel !== undefined) void qc.invalidateQueries({ queryKey: slpKeys.noodlerPostGuidance() });
      },
    }),
    rewritePrepared: useMutation({
      mutationFn: () => api.post<{ rewritten: number }>(`${path(creatorId)}/rewrite-prepared`, {}),
    }),
    addIdea: useMutation({
      mutationFn: (idea: { text: string; story: boolean }) =>
        api.post<SteeringAnswer>(`${path(creatorId)}/ideas`, idea),
      onSuccess: store,
    }),
    undoSupport: useMutation({
      mutationFn: () => api.post<SteeringAnswer>(`${path(creatorId)}/support-undo`, {}),
      onSuccess: store,
    }),
    keepSupport: useMutation({
      mutationFn: () => api.delete<SteeringAnswer>(`${path(creatorId)}/support-note`),
      onSuccess: store,
    }),
    removeIdea: useMutation({
      mutationFn: (ideaId: string) =>
        api.delete<SteeringAnswer>(`${path(creatorId)}/ideas/${encodeURIComponent(ideaId)}`),
      onSuccess: store,
    }),
  };
}
