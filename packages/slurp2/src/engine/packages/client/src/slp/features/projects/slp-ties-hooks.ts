import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";

/** Collabs, rivalries, brand deals and couples, as Studio shows them. Mirrors the server's `/slurp/ties`. */
export type SlurpTiesCreator = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  /** A page this persona runs. */
  own: boolean;
  /** Slurp writes this Creator's posts. */
  automatic: boolean;
  /** A couple's shared page, not a Creator of its own. */
  couplePage?: boolean;
};
export type SlurpTiesCollab = {
  id: string;
  hostId: string;
  partnerId: string;
  idea: string;
  hostShare: number;
  status: "asked" | "agreed" | "planned" | "posted" | "declined" | "blocked";
  origin: "world" | "player" | "rivalry" | "dm";
  askedAt: string;
  answeredAt: string | null;
  postId: string | null;
  decline: "busy" | "offBrand" | "noCollabs" | "noAnswer" | "player" | null;
  /** Announced (U): the joint post drops at `dropAt`. */
  announcedAt?: string | null;
  dropAt?: string | null;
  /** Planned in their DMs as a spicy shoot together. */
  shoot?: boolean;
  /** Fans who came across once it was up. */
  crossover?: { host: number; partner: number };
};
export type SlurpTiesRivalry = {
  id: string;
  fromId: string;
  toId: string;
  cause: string;
  stage: "shade" | "feud" | "cooling" | "over";
  stageAt: string;
  ending: "made_up" | "fizzled" | "calmed" | null;
};
export type SlurpTiesDeal = {
  id: string;
  brand: string;
  product: string;
  copy: string;
  creatorId: string;
  fee: number;
  status: "offered" | "accepted" | "planned" | "done" | "declined";
  decline: "offBrand" | "noAds" | "notNow" | "noAnswer" | "player" | null;
  offeredAt: string;
  answeredAt: string | null;
  /** The sponsored post; none when the player took the deal for their own page. */
  postId: string | null;
  /** The player's own page took it and has not posted it yet (Studio reminds them). */
  owesPost?: boolean;
  /** The player marked the owed post as posted. */
  markedAt?: string | null;
  /** An open offer: the brand's ad banner (Q), or its feed picture for an older ad. */
  bannerUrl?: string | null;
  /** The brand's logo (R). */
  logoUrl?: string | null;
};
export type SlurpTiesCoupleStage = "sparks" | "dating" | "together" | "rocky" | "split";
export type SlurpTiesCouple = {
  id: string;
  aId: string;
  bId: string;
  /** Polyamory (0.3.5): more partners. */
  moreIds?: string[];
  origin: "card" | "world" | "player" | "storyline";
  stage: SlurpTiesCoupleStage;
  ending: "breakup" | "fizzled" | null;
  startedAt: string;
  stageAt: string;
  togetherAt: string | null;
  reunions: number;
  moments: { id: string; kind: string; at: string; detail: string; withId?: string; fromId?: string }[];
  page: { accountId: string; openedAt: string; closedAt: string | null } | null;
  /** Set up by the player against a card: whose card, and what it says. */
  forced?: { misfit: "taken" | "notInto" | "noDating" | "orientation"; byId: string };
  /** A couple with the player's own page, kept out of public. */
  secret?: boolean;
};
export type SlurpCoupleSteer = "date" | "drama" | "patchUp" | "breakUp" | "reunite" | "official" | "secret" | "public";
/** Mirrors `SlurpBond` on the server (Drama): friends, roommates, coworkers and exes. */
export type SlurpTiesBondKind = "friend" | "roommate" | "coworker" | "ex";
export type SlurpTiesBond = {
  id: string;
  kind: SlurpTiesBondKind;
  aId: string;
  bId: string;
  /** Friends: 0 acquaintance, 1 friend, 2 close, 3 best. Other kinds are 1. */
  level: number;
  temperature: "warm" | "tense" | "cold";
  origin: "card" | "world" | "player" | "couple";
  since: string;
  changedAt: string;
  endedAt: string | null;
  ending: "drifted" | "left" | "player" | "together" | null;
  locked?: boolean;
  /** Each change with a reason code (`ui.slurp.people.note.<code>`). */
  notes: { at: string; code: string; detail?: string }[];
};

export type SlurpTiesView = {
  creators: SlurpTiesCreator[];
  collabs: SlurpTiesCollab[];
  rivalries: SlurpTiesRivalry[];
  deals: SlurpTiesDeal[];
  blocked: string[];
  couples: SlurpTiesCouple[];
  /** Older servers send none. */
  bonds?: SlurpTiesBond[];
};

const key = (personaId: string) => [...slpKeys.noodlerRoot(), "ties", personaId] as const;
const base = "/slurp2/slurp/ties";

export function useSlurpTies(personaId: string | null) {
  return useQuery({
    queryKey: key(personaId ?? "none"),
    enabled: Boolean(personaId),
    queryFn: () => api.get<SlurpTiesView>(`${base}?personaId=${encodeURIComponent(personaId!)}`),
  });
}

/**
 * Every change answers with the whole view, which replaces the cached copy. A change that is also a
 * Stir play (0.3.11: couples, bonds, collabs, rivalries) runs through the one runner instead of a side
 * route, so it lands in Recent plays with Undo, whichever screen started it.
 */
export function useSlurpTiesMutations(personaId: string) {
  const qc = useQueryClient();
  const store = (view: SlurpTiesView) => qc.setQueryData(key(personaId), view);
  const post = (path: string, body: Record<string, unknown> = {}) =>
    api.post<SlurpTiesView>(`${base}${path}`, { personaId, ...body });
  const play = async (action: string, input: Record<string, unknown>) => {
    const answer = await api.post<{ results: { ok: boolean; error: string | null }[] }>("/slurp2/slurp/stir/play", {
      steps: [{ action, input }],
      origin: "deck",
      personaId,
    });
    const failed = answer.results.find((result) => !result.ok);
    if (failed) throw new Error(failed.error ?? "That did not work.");
    return answer;
  };
  // A play can touch any read (ties, Stir, profiles, the feed), so they all refresh.
  const played = () => void qc.invalidateQueries({ queryKey: slpKeys.noodlerRoot() });
  return {
    push: useMutation({ mutationFn: (id: string) => play("push-collab", { collabId: id }), onSuccess: played }),
    decline: useMutation({
      mutationFn: (id: string) => post(`/collabs/${encodeURIComponent(id)}/decline`),
      onSuccess: store,
    }),
    block: useMutation({
      mutationFn: (id: string) => post(`/collabs/${encodeURIComponent(id)}/block`),
      onSuccess: store,
    }),
    // An agreed collab whose host never posted: call it off (no block), or make the host post it now.
    drop: useMutation({
      mutationFn: (id: string) => post(`/collabs/${encodeURIComponent(id)}/drop`),
      onSuccess: (view) => (store(view), played()),
    }),
    postNow: useMutation({
      mutationFn: (id: string) => post(`/collabs/${encodeURIComponent(id)}/post-now`),
      onSuccess: (view) => (store(view), played()),
    }),
    unblock: useMutation({ mutationFn: (pair: string) => post("/unblock", { key: pair }), onSuccess: store }),
    suggest: useMutation({
      mutationFn: (pair: { aId: string; bId: string }) => play("suggest-collab", { ...pair, happen: false }),
      onSuccess: played,
    }),
    cool: useMutation({ mutationFn: (id: string) => play("cool-rivalry", { rivalryId: id }), onSuccess: played }),
    setUp: useMutation({
      mutationFn: (pair: { aId: string; bId: string }) => play("set-up-couple", pair),
      onSuccess: played,
    }),
    steerCouple: useMutation({
      mutationFn: (input: { id: string; steer: SlurpCoupleSteer }) =>
        play("steer-couple", { coupleId: input.id, steer: input.steer }),
      onSuccess: played,
    }),
    couplePage: useMutation({
      mutationFn: (input: { id: string; open: boolean }) =>
        play("couple-page", { coupleId: input.id, open: input.open }),
      // A new page is a new Creator everywhere: Discover, the feed, profiles.
      onSuccess: played,
    }),
    setBond: useMutation({
      mutationFn: (input: { aId: string; bId: string; kind: SlurpTiesBondKind; level?: number }) =>
        play("set-bond", input),
      onSuccess: played,
    }),
    endBond: useMutation({ mutationFn: (id: string) => play("end-bond", { bondId: id }), onSuccess: played }),
    markPosted: useMutation({
      mutationFn: (id: string) => post(`/deals/${encodeURIComponent(id)}/posted`),
      onSuccess: store,
    }),
    answerDeal: useMutation({
      mutationFn: (answer: { id: string; accept: boolean }) =>
        post(`/deals/${encodeURIComponent(answer.id)}/answer`, { accept: answer.accept }),
      onSuccess: (view) => {
        store(view);
        // A yes pays into the Creator's earnings: the Studio and Wallet cards read them.
        void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "studio"] });
      },
    }),
  };
}

/** A couple's shared page that closed: nothing new goes up there, so there is nothing to join. */
export function useSlurpCouplePageClosed(personaId: string | null, accountId: string): boolean {
  const { data } = useSlurpTies(personaId);
  return Boolean(slurpCoupleForAccount(data, accountId)?.page?.page?.closedAt);
}

/** The couple this account is in (or the shared page it is), for the profile's couple line. */
export function slurpCoupleForAccount(view: SlurpTiesView | undefined, accountId: string) {
  if (!view) return null;
  const couple =
    view.couples.find(
      (entry) =>
        entry.stage !== "split" &&
        (entry.aId === accountId || entry.bId === accountId || Boolean(entry.moreIds?.includes(accountId))),
    ) ?? null;
  const page = view.couples.find((entry) => entry.page?.accountId === accountId) ?? null;
  return couple || page ? { couple, page } : null;
}
