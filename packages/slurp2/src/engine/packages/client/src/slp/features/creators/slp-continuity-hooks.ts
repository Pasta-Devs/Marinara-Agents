import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

export type SlurpContinuityFactView = {
  id: string;
  factType: string;
  subject: string;
  text: string;
  audienceScope: string;
  realityScope: string;
  threadId: string | null;
  confidence: number;
  status: string;
  source: string;
  evidence: string;
  sourceHash: string;
  contribution: string;
  createdAt: string;
  updatedAt: string;
};

export type SlurpContinuityEventView = {
  id: string;
  eventType: string;
  source: string;
  audienceScope: string;
  realityScope: string;
  threadId: string | null;
  payload: Record<string, unknown>;
  status: string;
  relatedIds: string[];
  occurredAt: string;
};

export type SlurpContinuityProposalView = {
  id: string;
  target: "fact" | "event";
  candidate: Record<string, unknown>;
  risk: string;
  confidence: number;
  createdAt: string;
  sourceHash: string;
  sourceMessageIds: string[];
  extractionFingerprint: string;
};

export type SlurpContinuityLinkView = {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  createdAt: string;
};

export type SlurpContinuityOpportunityView = {
  id: string;
  intent: string | null;
  delivery: string | null;
  workflow: string;
  access: string;
  skipReason: string | null;
  postId: string | null;
  sourceEventId: string | null;
  plannedAt: string;
  dueAt: string | null;
};

export type SlurpContinuityView = {
  facts: SlurpContinuityFactView[];
  events: SlurpContinuityEventView[];
  proposals: SlurpContinuityProposalView[];
  opportunities: SlurpContinuityOpportunityView[];
  links: SlurpContinuityLinkView[];
};

export type SlurpContinuityFilters = Partial<{
  type: string;
  source: string;
  scope: string;
  status: string;
  minConfidence: string;
  from: string;
  to: string;
}>;

const continuityKey = (creatorAccountId: string) => [...slpKeys.noodlerRoot(), "continuity", creatorAccountId] as const;

/** Everything the editor shows for one Creator, including records no prompt may read. */
export function useSlurpContinuity(creatorAccountId: string | null, filters: SlurpContinuityFilters = {}) {
  const query = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return useQuery({
    queryKey: [...continuityKey(creatorAccountId ?? "none"), filters],
    queryFn: () => api.get<SlurpContinuityView>(`/slurp2/continuity/${encodeURIComponent(creatorAccountId!)}?${query}`),
    enabled: Boolean(creatorAccountId),
  });
}

export function useSlurpContinuityOverview() {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "continuity", "all"],
    queryFn: () =>
      api.get<
        {
          creator: { id: string; displayName: string; handle: string };
          facts: SlurpContinuityFactView[];
          events: SlurpContinuityEventView[];
          proposals: SlurpContinuityProposalView[];
        }[]
      >("/slurp2/continuity"),
  });
}

/** One editor action. Each refetches the Creator's records, so the view never drifts. */
export function useSlurpContinuityAction(creatorAccountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { path: string; body?: Record<string, unknown> }) =>
      api.post<unknown>(`/slurp2/continuity/${input.path}`, input.body ?? {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: continuityKey(creatorAccountId ?? "none") }),
  });
}

export function useSlurpContinuityEdit(creatorAccountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; text?: string; audienceScope?: string }) =>
      api.patch<unknown>(`/slurp2/continuity/facts/${encodeURIComponent(input.id)}`, {
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.audienceScope ? { audienceScope: input.audienceScope } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: continuityKey(creatorAccountId ?? "none") }),
  });
}
