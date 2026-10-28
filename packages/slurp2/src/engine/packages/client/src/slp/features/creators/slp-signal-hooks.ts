import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";

/** One signal as the server sends it. See `modules/continuity/slp-signals.ts`. */
export type SlpSignal = {
  id: string;
  at: string;
  source: string;
  creatorIds: string[];
  scope: "creator" | "world";
  audienceScope: string;
  realityScope: string;
  summary: string;
  refs: string[];
};

export function useSlurpCreatorSignals(creatorId: string) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "signals", creatorId] as const,
    queryFn: () => api.get<{ signals: SlpSignal[] }>(`/slurp2/continuity/${encodeURIComponent(creatorId)}/signals`),
  });
}
