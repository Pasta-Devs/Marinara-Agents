import type { NoodleAuthorSnapshot, NoodlerFanArchetype, NoodlerFanArchetypeWeights } from "@marinara-engine/shared";

export const NOODLER_FAN_IDENTITY_PREFIX = "noodler-fan:";

export interface NoodlerFanIdentity {
  id: string;
  archetype: NoodlerFanArchetype;
  snapshot: NoodleAuthorSnapshot;
}

export interface NoodlerFanIdentityProvider {
  resolve(weights: NoodlerFanArchetypeWeights): NoodlerFanIdentity[];
}

const IDENTITIES: Array<[NoodlerFanArchetype, string, string]> = [
  ["ordinary", "quiet regular", "quiet_regular"],
  ["eccentric", "moth-hour regular", "moth_hour_regular"],
  ["crossFandom", "crossover visitor", "crossover_visitor"],
  ["raider", "late-night raider", "late_night_raider"],
  ["organicDiscovery", "new visitor", "new_visitor"],
  ["freeResource", "free-feed follower", "free_feed_follower"],
];

export const syntheticNoodlerFanIdentityProvider: NoodlerFanIdentityProvider = {
  resolve(weights) {
    return IDENTITIES.filter(([archetype]) => weights[archetype] > 0).map(([archetype, displayName, handle]) => {
      const id = `${NOODLER_FAN_IDENTITY_PREFIX}${archetype}`;
      return {
        id,
        archetype,
        snapshot: {
          id,
          kind: "random_user",
          entityId: id,
          handle,
          displayName,
          avatarUrl: null,
          avatarCrop: null,
        },
      };
    });
  },
};
