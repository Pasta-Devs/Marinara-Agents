/**
 * The Slurp Support desk's actions (docs/SUPPORT-DESK.md): perks, challenges, contracts, favours,
 * reach throttles, rumours, trend seeds and warnings. Each changes the Creator's desk record and, where
 * the story needs it, writes a line into their Support thread or their memory. Offered in a Support
 * thread they run once the Creator says yes; from Stir or a helper they just happen.
 */
import type { DB } from "../../../db/connection.js";
import { newId } from "../../../utils/id-generator.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { readSlurpSupportDesk, updateSlurpSupportDesk } from "../../data/creators/slp-support-desk-storage.js";
import { countSlurpDeskPublished } from "../../data/creators/slp-support-desk-counts.js";
import { appendSlurpDeskLine } from "../../data/messages/slp-support-desk-thread.js";
import {
  addSlurpCreatorNudge,
  patchSlurpCreatorSteering,
  readSlurpCreatorSteering,
  removeSlurpCreatorNudge,
} from "../../data/creators/slp-steering-storage.js";
import { createSlurpContinuityFact } from "../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";
import { runSlurpTieLever, slurpRunsItself } from "../projects/slp-projects-contract.js";
import {
  slpDeskActive,
  slpDeskAdjust,
  slpDeskAsk,
  slpDeskGrantPerk,
  slpDeskPerkLine,
  slpDeskTier,
  type SlpDeskPerk,
  type SlpSupportDesk,
  type SlpSupportDeskSettings,
} from "../../../../../shared/src/slp/slp-support-desk.js";
import { SLP_STEERING_TOPICS_MAX } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpActionParsed } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpActionPreview } from "../../../../../shared/src/slp/slp-stir.js";
import type { SlpAssistOutcome } from "./slp-assist-service.js";

export const SLP_DESK_LEVERS = [
  "grant-perk",
  "set-challenge",
  "offer-contract",
  "cash-favour",
  "throttle-reach",
  "plant-rumour",
  "seed-trend",
  "warn-creator",
] as const;
export type SlpDeskLever = (typeof SLP_DESK_LEVERS)[number];
export const isSlpDeskLever = (name: string): name is SlpDeskLever =>
  (SLP_DESK_LEVERS as readonly string[]).includes(name);

/** The desk fields a play changed, what they were before and what the play wrote, for one Undo. */
export type SlpDeskUndo = {
  kind: "desk";
  accountId: string;
  before: Partial<SlpSupportDesk>;
  set: Partial<SlpSupportDesk>;
  /** A queued idea the play added (a favour, a trend), removed when still waiting. */
  ideaIds?: { accountId: string; ideaId: string }[];
  /** A topic the play put on the leave-alone list. */
  avoid?: { accountId: string; topic: string };
};

type Done<T> = { ok: true; value: T; undo: SlpDeskUndo | null };
const DAY_MS = 86_400_000;
const perkOf = (input: { perk: SlpDeskPerk["kind"]; badge?: SlpDeskPerk["badge"]; coins?: number; days?: number }) =>
  ({ kind: input.perk, badge: input.badge, coins: input.coins, days: input.days }) as SlpDeskPerk;

async function deskSettings(db: DB): Promise<SlpSupportDeskSettings> {
  return (await createSlurpStorage(db).getSettings()).supportDesk;
}

/** Change a desk and remember, for Undo, what the changed fields were before. */
async function changeDesk(
  db: DB,
  accountId: string,
  change: (desk: SlpSupportDesk) => SlpSupportDesk,
  keys: (keyof SlpSupportDesk)[],
): Promise<{ desk: SlpSupportDesk; undo: SlpDeskUndo }> {
  let before: Partial<SlpSupportDesk> = {};
  const desk = await updateSlurpSupportDesk(db, accountId, (current) => {
    before = Object.fromEntries(keys.map((key) => [key, current[key]]));
    return change(current);
  });
  return {
    desk,
    undo: { kind: "desk", accountId, before, set: Object.fromEntries(keys.map((key) => [key, desk[key]])) },
  };
}

async function remember(db: DB, accountId: string, text: string, sourceHash: string) {
  const creator = await createSlurpStorage(db).getNoodlerAccountById(accountId);
  const identity = creator ? slurpContinuityIdentityOf(creator) : null;
  if (!identity) return;
  await createSlurpContinuityFact(db, {
    ...identity,
    factType: "circumstance",
    text,
    audienceScope: "creator_private",
    realityScope: "slurp",
    source: "slurp_message",
    evidence: text,
    sourceHash,
    contribution: "generated",
  });
}

/**
 * A page the player runs pays out into their own wallet, so Slurp coins the player sets there are
 * free money: a coin perk, a challenge that rewards coins, a contract with a weekly bonus. The run
 * and the preview both refuse them.
 */
function deskPaysOwnPage(name: SlpDeskLever, raw: unknown, creator: { kind: string; sourceKind?: string | null }) {
  const ask = raw as { perk?: string; reward?: { perk?: string }; weeklyBonus?: number };
  const paysCoins =
    (name === "grant-perk" && ask.perk === "coins") ||
    (name === "set-challenge" && ask.reward?.perk === "coins") ||
    (name === "offer-contract" && (ask.weeklyBonus ?? 0) > 0);
  return paysCoins && !slurpRunsItself(creator);
}

export async function runSlpDeskLever(
  db: DB,
  name: SlpDeskLever,
  raw: unknown,
  at = new Date(),
): Promise<SlpAssistOutcome<unknown> | Done<unknown>> {
  const storage = createSlurpStorage(db);
  const settings = await deskSettings(db);
  if (name === "seed-trend") {
    const input = raw as SlpActionParsed<"seed-trend">;
    const ideaIds: { accountId: string; ideaId: string }[] = [];
    for (const accountId of [...new Set(input.accountIds)]) {
      const account = await storage.getNoodlerAccountById(accountId);
      if (!account || !slurpRunsItself(account)) continue;
      const steering = await addSlurpCreatorNudge(db, accountId, {
        text: `Everyone on Slurp is talking about ${input.topic} right now`,
        story: false,
      });
      const added = steering?.nudges.at(-1);
      if (added) ideaIds.push({ accountId, ideaId: added.id });
    }
    if (!ideaIds.length) return { ok: false, status: 409, error: "None of them can take another idea right now." };
    return {
      ok: true,
      value: { accountIds: ideaIds.map((entry) => entry.accountId) },
      undo: { kind: "desk", accountId: ideaIds[0]!.accountId, before: {}, set: {}, ideaIds },
    };
  }

  const accountId = (raw as { accountId: string }).accountId;
  const creator = await storage.getNoodlerAccountById(accountId);
  if (!creator) return { ok: false, status: 404, error: "Creator not found." };
  if (deskPaysOwnPage(name, raw, creator))
    return { ok: false, status: 409, error: "Slurp coins are for Creators you do not run yourself." };
  const shady =
    name === "throttle-reach" ||
    name === "plant-rumour" ||
    (name === "warn-creator" && !(raw as { cause: boolean }).cause);
  if (shady && !settings.shadyMoves)
    return { ok: false, status: 409, error: "Shady moves are off in Settings › Stir." };
  const current = await readSlurpSupportDesk(db, accountId);
  if (current.pausedAt && name !== "grant-perk")
    return { ok: false, status: 409, error: `${creator.displayName} has left Slurp. Only a perk can win them back.` };

  switch (name) {
    case "grant-perk": {
      const perk = perkOf(raw as SlpActionParsed<"grant-perk">);
      if (perk.kind === "badge" && !perk.badge) return { ok: false, status: 400, error: "Pick a badge." };
      if (perk.kind === "coins" && !perk.coins) return { ok: false, status: 400, error: "Pick how many coins." };
      if (perk.kind === "feature") perk.days = perk.days ?? 2;
      const { undo } = await changeDesk(db, accountId, (desk) => slpDeskGrantPerk(desk, perk, settings, at), [
        "trust",
        "favours",
        "badges",
        "featuredUntil",
        "log",
      ]);
      if (perk.kind === "coins")
        await storage.creditSponsorFee(accountId, perk.coins ?? 0, "Slurp bonus", `desk:perk:${newId()}`);
      await appendSlurpDeskLine(db, accountId, {
        as: "notice",
        content: `Slurp: ${slpDeskPerkLine(perk).replace(/^Got/u, `${creator.displayName} got`)}.`,
        metadata: { deskPerk: perk },
      });
      // Coins paid out stay paid out; the rest can be taken back.
      return { ok: true, value: { accountId }, undo: perk.kind === "coins" ? null : undo };
    }
    case "set-challenge": {
      const input = raw as SlpActionParsed<"set-challenge">;
      const counts = await countSlurpDeskPublished(db, accountId);
      const challengeId = newId();
      const { undo } = await changeDesk(
        db,
        accountId,
        (desk) =>
          slpDeskAsk(
            {
              ...desk,
              challenges: [
                ...desk.challenges,
                {
                  id: challengeId,
                  metric: input.metric,
                  count: input.count,
                  baseline: counts[input.metric],
                  progress: 0,
                  until: new Date(at.getTime() + input.days * DAY_MS).toISOString(),
                  reward: perkOf(input.reward),
                  status: "active",
                  at: at.toISOString(),
                },
              ],
            },
            settings,
            at,
          ),
        ["challenges", "asks", "trust", "log"],
      );
      return { ok: true, value: { accountId, challengeId }, undo };
    }
    case "offer-contract": {
      const input = raw as SlpActionParsed<"offer-contract">;
      if (current.contract?.status === "active")
        return { ok: false, status: 409, error: `${creator.displayName} is already under contract.` };
      const counts = await countSlurpDeskPublished(db, accountId);
      const contractId = newId();
      const { undo } = await changeDesk(
        db,
        accountId,
        (desk) =>
          slpDeskAdjust(
            {
              ...desk,
              contract: {
                id: contractId,
                postsPerWeek: input.postsPerWeek,
                themes: input.themes,
                weeklyBonus: input.weeklyBonus,
                status: "active",
                since: at.toISOString(),
                until: new Date(at.getTime() + input.weeks * 7 * DAY_MS).toISOString(),
                weekStart: at.toISOString(),
                weekBaseline: counts.posts + counts.stories,
                broken: 0,
              },
            },
            { trust: 6, text: `Signed a Slurp contract: ${input.postsPerWeek} a week` },
            settings,
            at,
          ),
        ["contract", "trust", "log"],
      );
      if (input.themes.length) {
        const steering = await readSlurpCreatorSteering(db, accountId);
        await patchSlurpCreatorSteering(db, accountId, {
          push: [...steering.push.filter((topic) => !input.themes.includes(topic)), ...input.themes].slice(
            -SLP_STEERING_TOPICS_MAX,
          ),
        });
      }
      return { ok: true, value: { accountId, contractId }, undo };
    }
    case "cash-favour": {
      const input = raw as SlpActionParsed<"cash-favour">;
      // The favour is spent inside the desk's own update, so two calls at once cannot both spend one.
      let spent = false;
      const { desk, undo } = await changeDesk(
        db,
        accountId,
        (desk) => {
          if (desk.favours <= 0) return desk;
          spent = true;
          return slpDeskAdjust(
            slpDeskAsk({ ...desk, favours: desk.favours - 1 }, settings, at),
            { trust: desk.favours <= 1 ? -2 : -1, suspicion: 5, text: `Called in a favour: ${input.ask}` },
            settings,
            at,
          );
        },
        ["favours", "asks", "trust", "suspicion", "log"],
      );
      if (!spent) return { ok: false, status: 409, error: `${creator.displayName} does not owe Slurp a favour.` };
      const steering = slurpRunsItself(creator)
        ? await addSlurpCreatorNudge(db, accountId, { text: input.ask, story: false })
        : null;
      const added = steering?.nudges.at(-1);
      return {
        ok: true,
        value: { accountId, favours: desk.favours },
        undo: { ...undo, ...(added ? { ideaIds: [{ accountId, ideaId: added.id }] } : {}) },
      };
    }
    case "throttle-reach": {
      const input = raw as SlpActionParsed<"throttle-reach">;
      const until = new Date(at.getTime() + input.days * DAY_MS).toISOString();
      const { undo } = await changeDesk(
        db,
        accountId,
        (desk) =>
          slpDeskAdjust(
            { ...desk, throttle: { until, factor: input.strength === "heavy" ? 0.3 : 0.6 } },
            { suspicion: input.strength === "heavy" ? 15 : 8, text: `Reach throttled for ${input.days} days` },
            settings,
            at,
          ),
        ["throttle", "suspicion", "log"],
      );
      return { ok: true, value: { accountId, until }, undo };
    }
    case "plant-rumour": {
      const input = raw as SlpActionParsed<"plant-rumour">;
      const about = input.aboutId ? await storage.getNoodlerAccountById(input.aboutId) : null;
      await changeDesk(
        db,
        accountId,
        (desk) =>
          slpDeskAdjust(
            desk,
            {
              suspicion: input.via === "support" ? 12 : 5,
              text: `${input.via === "support" ? "Support told them" : "Heard"} a rumour: ${input.text}`,
            },
            settings,
            at,
          ),
        ["suspicion", "log"],
      );
      await remember(
        db,
        accountId,
        input.via === "support" ? `Slurp Support told me: ${input.text}` : `I heard on Slurp: ${input.text}`,
        `desk:rumour:${newId()}`,
      );
      const line =
        input.via === "support"
          ? await appendSlurpDeskLine(db, accountId, {
              as: "support",
              content: input.text,
              metadata: { deskMove: { action: "plant-rumour", input } },
            })
          : null;
      // A rumour about someone they already distrust sparks something about one time in three.
      if (about && about.id !== accountId && slurpRunsItself(creator) && slpDeskTier(current.trust) !== "partner") {
        const roll =
          [...`${accountId}:${about.id}:${input.text}`].reduce(
            (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
            7,
          ) % 3;
        if (roll === 0)
          await runSlurpTieLever(db, "start-rivalry", {
            fromId: accountId,
            toId: about.id,
            cause: input.text.slice(0, 160),
          }).catch(() => undefined);
      }
      return { ok: true, value: { accountId, messageId: line?.id ?? null }, undo: null };
    }
    case "warn-creator": {
      const input = raw as SlpActionParsed<"warn-creator">;
      const { undo } = await changeDesk(
        db,
        accountId,
        (desk) =>
          slpDeskAdjust(
            desk,
            {
              trust: input.cause ? -4 : -8,
              suspicion: input.cause ? 0 : 10,
              text: `Warned by Slurp: ${input.reason}`,
            },
            settings,
            at,
          ),
        ["trust", "suspicion", "log"],
      );
      let avoid: SlpDeskUndo["avoid"];
      if (input.topic && slurpRunsItself(creator)) {
        const steering = await readSlurpCreatorSteering(db, accountId);
        if (!steering.avoid.some((topic) => topic.toLocaleLowerCase() === input.topic!.toLocaleLowerCase())) {
          await patchSlurpCreatorSteering(db, accountId, {
            avoid: [...steering.avoid, input.topic].slice(-SLP_STEERING_TOPICS_MAX),
            push: steering.push.filter((topic) => topic.toLocaleLowerCase() !== input.topic!.toLocaleLowerCase()),
          });
          avoid = { accountId, topic: input.topic };
        }
      }
      await remember(db, accountId, `Slurp Support warned me: ${input.reason}`, `desk:warning:${newId()}`);
      return { ok: true, value: { accountId }, undo: { ...undo, ...(avoid ? { avoid } : {}) } };
    }
  }
}

/** Take one desk play back. Fields changed since (by the tick, or a later play) stay as they are. */
export async function undoSlpDeskLever(db: DB, undo: SlpDeskUndo): Promise<boolean> {
  let changed = false;
  if (Object.keys(undo.set).length) {
    await updateSlurpSupportDesk(db, undo.accountId, (desk) => {
      const restore = Object.fromEntries(
        Object.entries(undo.before).filter(
          ([key]) =>
            JSON.stringify(desk[key as keyof SlpSupportDesk]) === JSON.stringify(undo.set[key as keyof SlpSupportDesk]),
        ),
      );
      changed = Object.keys(restore).length > 0;
      return { ...desk, ...restore };
    });
  }
  for (const idea of undo.ideaIds ?? []) {
    const { nudges } = await readSlurpCreatorSteering(db, idea.accountId);
    if (!nudges.some((nudge) => nudge.id === idea.ideaId)) continue;
    await removeSlurpCreatorNudge(db, idea.accountId, idea.ideaId);
    changed = true;
  }
  if (undo.avoid) {
    const steering = await readSlurpCreatorSteering(db, undo.avoid.accountId);
    const key = undo.avoid.topic.toLocaleLowerCase();
    if (steering.avoid.some((topic) => topic.toLocaleLowerCase() === key)) {
      await patchSlurpCreatorSteering(db, undo.avoid.accountId, {
        avoid: steering.avoid.filter((topic) => topic.toLocaleLowerCase() !== key),
      });
      changed = true;
    }
  }
  return changed;
}

/** What a desk play would do, for its Stir card. Writes nothing. */
export async function previewSlpDeskLever(
  db: DB,
  name: SlpDeskLever,
  input: Record<string, unknown>,
  at = new Date(),
): Promise<Partial<SlpActionPreview>> {
  const storage = createSlurpStorage(db);
  const settings = await deskSettings(db);
  if (name === "seed-trend") {
    const ids = (input.accountIds as string[]) ?? [];
    const accounts = (await Promise.all(ids.map((id) => storage.getNoodlerAccountById(id)))).filter(Boolean) as {
      id: string;
      displayName: string;
      avatarUrl?: string | null;
    }[];
    return {
      who: accounts.map((account) => ({
        id: account.id,
        name: account.displayName,
        avatarUrl: account.avatarUrl ?? null,
      })),
      when: "nextPost",
      detail: { topic: String(input.topic ?? ""), count: accounts.length },
      error: accounts.length ? null : "notFound",
    };
  }
  const account = await storage.getNoodlerAccountById(String(input.accountId));
  if (!account) return { error: "notFound", summary: "That Creator does not exist." };
  const who = [{ id: account.id, name: account.displayName, avatarUrl: account.avatarUrl ?? null }];
  const desk = await readSlurpSupportDesk(db, account.id);
  const shady =
    name === "throttle-reach" || name === "plant-rumour" || (name === "warn-creator" && input.cause === false);
  const notes: SlpActionPreview["notes"] = shady ? [{ kind: "shady", name: account.displayName }] : [];
  const error =
    shady && !settings.shadyMoves
      ? "shadyOff"
      : deskPaysOwnPage(name, input, account)
        ? "ownPageCoins"
        : desk.pausedAt && name !== "grant-perk"
          ? "leftSlurp"
          : name === "cash-favour" && desk.favours <= 0
            ? "noFavour"
            : name === "offer-contract" && desk.contract?.status === "active"
              ? "underContract"
              : null;
  const base = { who, notes, error, when: "now" as const };
  switch (name) {
    case "grant-perk":
      return {
        ...base,
        detail: {
          perk: String(input.perk),
          badge: (input.badge as string) ?? null,
          coins: (input.coins as number) ?? null,
          days: (input.days as number) ?? (input.perk === "feature" ? 2 : null),
        },
      };
    case "set-challenge": {
      const reward = input.reward as { perk: string; badge?: string; coins?: number; days?: number };
      return {
        ...base,
        when: "ongoing",
        detail: {
          metric: String(input.metric),
          count: Number(input.count),
          days: Number(input.days),
          perk: reward?.perk ?? null,
          badge: reward?.badge ?? null,
          coins: reward?.coins ?? null,
        },
      };
    }
    case "offer-contract":
      return {
        ...base,
        when: "ongoing",
        detail: {
          count: Number(input.postsPerWeek),
          weeks: Number(input.weeks),
          coins: Number(input.weeklyBonus),
          themes: ((input.themes as string[]) ?? []).join(", ") || null,
        },
      };
    case "cash-favour":
      return { ...base, when: "nextPost", detail: { ask: String(input.ask), favours: desk.favours } };
    case "throttle-reach":
      return {
        ...base,
        when: "ongoing",
        detail: {
          days: Number(input.days),
          strength: String(input.strength),
          already: desk.throttle ? slpDeskActive(desk.throttle.until, at) : false,
        },
      };
    case "plant-rumour":
      return { ...base, detail: { text: String(input.text), via: String(input.via) } };
    case "warn-creator":
      return {
        ...base,
        when: "nextPost",
        detail: { reason: String(input.reason), topic: (input.topic as string) ?? null, cause: input.cause !== false },
      };
  }
}
