import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

/** A live trend, as Discover shows it (`GET /slurp/trends`, docs/TRENDS.md). */
export type SlurpTrendView = {
  id: string;
  label: string;
  stage: "rising" | "peak" | "tired";
  source: "creator" | "player" | "stir" | "world";
  starter: { id: string; name: string; avatarUrl: string | null } | null;
  originPostId: string | null;
  lean: string | null;
  joined: number;
};

export function useSlurpTrends() {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "trends"],
    queryFn: () => api.get<{ items: SlurpTrendView[] }>("/slurp2/slurp/trends").then((answer) => answer.items),
    // A trend moves over days: a slow refresh is plenty.
    staleTime: 5 * 60_000,
  });
}
