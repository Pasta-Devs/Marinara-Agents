import {
  SLP_COUPLE_STEERS,
  type SlpActionName,
  type SlpBreakupAftermath,
} from "../../../../../shared/src/slp/slp-actions.js";

export type SlpStirForm = Record<string, string | boolean | string[] | null>;
type Form = SlpStirForm;

/** The step a filled form stands for, or null while something is missing. */
export function slpStirStepOf(action: SlpActionName, form: Form): Record<string, unknown> | null {
  const one = (form.who as string[] | undefined)?.[0];
  const two = form.who as string[] | undefined;
  const text = typeof form.text === "string" ? form.text.trim() : "";
  switch (action) {
    case "add-idea":
      return one && text ? { accountId: one, text, story: form.story === true } : null;
    case "write-post":
      return one ? { accountId: one, ...(text ? { idea: text } : {}), story: form.story === true } : null;
    case "steer-creator": {
      if (!one || (!form.mood && !form.pace)) return null;
      return {
        accountId: one,
        ...(form.mood ? { mood: form.mood === "none" ? null : form.mood } : {}),
        ...(form.pace ? { pace: form.pace } : {}),
      };
    }
    case "set-spice":
      return one && form.level ? { accountId: one, level: form.level === "default" ? null : form.level } : null;
    case "set-up-couple":
      return two?.length === 2 ? { aId: two[0], bId: two[1] } : null;
    case "suggest-collab":
      return two?.length === 2 ? { aId: two[0], bId: two[1], happen: form.happen === true } : null;
    case "offer-brand-deal":
      return one && form.pick ? { accountId: one, productId: form.pick, happen: form.happen === true } : null;
    case "start-rivalry":
      return two?.length === 2 ? { fromId: two[0], toId: two[1], ...(text ? { cause: text } : {}) } : null;
    case "add-to-couple":
      return form.pick && one ? { coupleId: form.pick, accountId: one } : null;
    case "steer-couple":
      if (!form.pick || !form.steer) return null;
      // #1293: "keep" is today's breakup, so only the other two travel.
      return {
        coupleId: form.pick,
        steer: form.steer,
        ...(form.steer === "breakUp" && (form.aftermath === "moveOn" || form.aftermath === "forget")
          ? { aftermath: form.aftermath }
          : {}),
      };
    case "couple-page":
      return form.pick ? { coupleId: form.pick, open: form.open !== false } : null;
    case "push-collab":
      return form.pick ? { collabId: form.pick } : null;
    case "cool-rivalry":
      return form.pick ? { rivalryId: form.pick } : null;
    case "start-event":
      return form.pick ? { eventId: form.pick } : null;
    case "steer-storyline": {
      if (!form.pick || !form.move) return null;
      const [accountId, projectId] = String(form.pick).split("|");
      const needsText = form.move === "insert" || form.move === "label";
      if (needsText && !text) return null;
      return { accountId, projectId, move: form.move, ...(needsText ? { text } : {}) };
    }
    case "run-audience":
      return {};
    // 0.3.11: bonds and drama packs are plays too.
    case "set-bond":
      return two?.length === 2 && form.kind
        ? {
            aId: two[0],
            bId: two[1],
            kind: form.kind,
            ...(form.kind === "friend" ? { level: Number(form.level ?? 1) } : {}),
          }
        : null;
    case "end-bond":
      return form.pick ? { bondId: form.pick } : null;
    case "start-drama":
      return form.pick ? { dramaId: form.pick, ...(one ? { leadId: one } : {}) } : null;
    case "end-drama":
      return form.pick ? { runId: form.pick } : null;
    case "start-storyline": {
      const title = typeof form.title === "string" ? form.title.trim() : "";
      const others = ((form.with as string[] | undefined) ?? []).filter((id) => id !== one);
      return one && title
        ? { accountId: one, title, ...(text ? { direction: text } : {}), ...(others.length ? { withIds: others } : {}) }
        : null;
    }
    case "set-tip-goal": {
      const target = Number(form.target);
      return one && text && Number.isInteger(target) && target >= 1 ? { accountId: one, label: text, target } : null;
    }
    case "new-look":
      return one && text ? { accountId: one, change: text } : null;
    case "invent-event": {
      const name = typeof form.title === "string" ? form.title.trim() : "";
      const days = Number(form.days ?? 1);
      return name ? { name, ...(text ? { guidance: text } : {}), days } : null;
    }
    // The Support desk (0.3.5, docs/SUPPORT-DESK.md).
    case "grant-perk": {
      if (!one || !form.perk) return null;
      if (form.perk === "badge") return form.badge ? { accountId: one, perk: "badge", badge: form.badge } : null;
      if (form.perk === "coins") return { accountId: one, perk: "coins", coins: Number(form.coins ?? 200) };
      return { accountId: one, perk: "feature", days: Number(form.days ?? 2) };
    }
    case "set-challenge": {
      const reward = deskReward(String(form.reward ?? "feature"));
      return one && form.metric
        ? { accountId: one, metric: form.metric, count: Number(form.count ?? 3), days: Number(form.days ?? 7), reward }
        : null;
    }
    case "offer-contract": {
      const themes = String(form.title ?? "")
        .split(",")
        .map((theme) => theme.trim())
        .filter(Boolean)
        .slice(0, 3);
      return one
        ? {
            accountId: one,
            postsPerWeek: Number(form.count ?? 3),
            weeks: Number(form.weeks ?? 4),
            weeklyBonus: Number(form.coins ?? 100),
            themes,
          }
        : null;
    }
    case "cash-favour":
      return one && text ? { accountId: one, ask: text } : null;
    case "throttle-reach":
      return one
        ? { accountId: one, days: Number(form.days ?? 2), strength: form.strength === "heavy" ? "heavy" : "light" }
        : null;
    case "plant-rumour": {
      const about = (form.about as string[] | undefined)?.[0];
      return one && text
        ? {
            accountId: one,
            text,
            via: form.via === "support" ? "support" : "anonymous",
            ...(about && about !== one ? { aboutId: about } : {}),
          }
        : null;
    }
    case "seed-trend": {
      const topic = typeof form.title === "string" ? form.title.trim() : "";
      return topic && two?.length ? { topic, accountIds: two } : null;
    }
    case "warn-creator": {
      const topic = typeof form.title === "string" ? form.title.trim() : "";
      return one && text
        ? { accountId: one, reason: text, cause: form.cause !== "none", ...(topic ? { topic } : {}) }
        : null;
    }
    default:
      return null;
  }
}

/** The reward chips of a challenge, as the perk they stand for. */
export const SLP_DESK_REWARDS = ["feature", "coins", "rising", "verified"] as const;
export function deskReward(choice: string): Record<string, unknown> {
  if (choice === "coins") return { perk: "coins", coins: 200 };
  if (choice === "rising" || choice === "verified") return { perk: "badge", badge: choice };
  return { perk: "feature", days: 2 };
}

/**
 * The nudges a couple can take now. An ex (split) gets back together, moves on or forgets (#1293),
 * minus the way it already handles the breakup; secret/public are for couples with the player's page.
 */
export function slpStirCoupleSteers(
  couple: { stage: string; secret?: boolean; aftermath?: SlpBreakupAftermath | null },
  withPlayer: boolean,
): (typeof SLP_COUPLE_STEERS)[number][] {
  return SLP_COUPLE_STEERS.filter((steer) => {
    if (couple.stage === "split")
      return steer === "reunite" || ((steer === "moveOn" || steer === "forget") && couple.aftermath !== steer);
    switch (steer) {
      case "reunite":
      case "moveOn":
      case "forget":
        return false;
      case "patchUp":
        return couple.stage === "rocky";
      case "drama":
        return couple.stage === "dating" || couple.stage === "together";
      case "date":
        return couple.stage !== "rocky";
      case "official":
        return couple.stage === "sparks" || couple.stage === "dating";
      case "secret":
      case "public":
        return withPlayer && (steer === "secret") !== Boolean(couple.secret);
      default:
        return true;
    }
  });
}
