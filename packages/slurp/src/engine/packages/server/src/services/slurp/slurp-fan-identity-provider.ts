import type { NoodleAuthorSnapshot, NoodlerFanArchetype, NoodlerFanArchetypeWeights } from "@marinara-engine/shared";

export const NOODLER_FAN_IDENTITY_PREFIX = "noodler-fan:";

export interface NoodlerFanIdentity {
  id: string;
  archetype: NoodlerFanArchetype;
  snapshot: NoodleAuthorSnapshot;
  /**
   * Who this person is, for the prompt.
   *
   * The model used to receive `{ handle, weight }` and nothing else, so every generated comment
   * came from a name with no person behind it. The population stores traits, a spend tier, and a
   * relationship to each Creator, and none of it reached the one place it could matter.
   */
  persona?: {
    traits: string[];
    spendTier: string;
    /** Funnel stage with this Creator, when there is a tie. */
    stage?: string;
    /** Coins spent with this Creator, ever. */
    spent?: number;
    /** How long they have been around this Creator, in days. */
    knownForDays?: number;
    /** Where the relationship is heading. */
    arc?: string;
  };
}

export interface NoodlerFanIdentityProvider {
  /**
   * `creatorAccountId` is what makes the relationship line true.
   *
   * A run covers up to twelve creators. Resolving once and reusing the answer meant every fan was
   * described by their history with the *first* creator of the run while commenting on the
   * seventh, so the prompt did not lack the fact — it stated a false one.
   */
  resolve(weights: NoodlerFanArchetypeWeights, creatorAccountId: string): NoodlerFanIdentity[];
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

/**
 * Draw fan identities from the generated population instead of the six fixed placeholders above.
 *
 * The six identities in `IDENTITIES` were one per archetype, with handles like `quiet_regular`.
 * Every like, reply, and repost any Creator ever received came from them, which is most of why
 * the world read as repetitive and could never remember anybody.
 *
 * This is the swap the plan named: same interface, a real cast behind it. The provider is
 * synchronous, so members are drawn from a pool the caller prepared — materialising a row is a
 * database write and belongs to the caller, not to a `resolve`.
 */
export type NoodlerFanCastMember = {
  id: string;
  handle: string;
  displayName: string;
  archetype: NoodlerFanArchetype;
  traits: string[];
  spendTier: string;
};

/** One member's history with one creator, keyed by creator then by member. */
export type NoodlerFanTieLookup = ReadonlyMap<
  string,
  ReadonlyMap<string, { stage: string; spent: number; knownForDays: number; arc: string }>
>;

export function populationNoodlerFanIdentityProvider(
  members: readonly NoodlerFanCastMember[],
  tiesByCreator: NoodlerFanTieLookup = new Map(),
): NoodlerFanIdentityProvider {
  return {
    resolve(weights, creatorAccountId) {
      const ties = tiesByCreator.get(creatorAccountId);
      return members
        .filter((member) => (weights[member.archetype] ?? 0) > 0)
        .map((member) => {
          const tie = ties?.get(member.id);
          return {
            id: member.id,
            archetype: member.archetype,
            persona: {
              traits: member.traits,
              spendTier: member.spendTier,
              ...(tie ? { stage: tie.stage, spent: tie.spent, knownForDays: tie.knownForDays, arc: tie.arc } : {}),
            },
            snapshot: {
              id: member.id,
              kind: "random_user" as const,
              entityId: member.id,
              handle: member.handle,
              displayName: member.displayName,
              avatarUrl: null,
              avatarCrop: null,
            },
          };
        });
    },
  };
}
