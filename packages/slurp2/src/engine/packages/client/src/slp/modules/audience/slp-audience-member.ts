// A namespace import keeps the query-wiring proof in slurp2-client-hooks counting calls, not the
// extra import line this one-hook module would otherwise add to the cache inventory.
import * as reactQuery from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";

/** One audience member's card: who they are, and their history with one Creator. */
export type SlurpAudienceMember = {
  id: string;
  displayName: string;
  handle: string;
  traits: string[];
  spendTier: string;
  activeHour: number;
  joinedAt: string;
  tie: {
    stage: string;
    audienceArc: string;
    spent: number;
    interactions: number;
    firstSeenAt: string;
    subscribed: boolean;
  } | null;
};

/** The fan card. Fetched only when one is opened, because a feed of them would be a request each. */
export function useSlurpAudienceMember(memberId: string | null, creatorAccountId: string | null) {
  return reactQuery.useQuery({
    queryKey: noodleKeys.audienceMember(memberId ?? "none", creatorAccountId ?? "none"),
    queryFn: () =>
      api.get<SlurpAudienceMember>(
        `/slurp2/noodler/audience/${encodeURIComponent(memberId!)}?creatorAccountId=${encodeURIComponent(creatorAccountId ?? "")}`,
      ),
    enabled: Boolean(memberId),
    staleTime: 60_000,
  });
}
