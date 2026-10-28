import { slurpPpvPrice } from "../economy/slp-media-offer.js";
import { SLURP_RAPPORT_CUSTOM_DISCOUNT, slurpRapportOpens, type SlurpRapport } from "./slp-rapport.js";

/**
 * Paid sexting sessions (docs/SPICY.md, item 2): the fan buys 20 minutes of her, the heat rises in three
 * phases, she answers fast, and once she offers a PPV picture of what she is doing right now.
 */
export const SLURP_SEXTING_MINUTES = 20;

/** Stored on the thread (`sexting` column); `pictureOffered` once her one in-session PPV went out. */
export type SlurpSexting = { startedAt: string; endsAt: string; pictureOffered?: boolean };

export type SlurpSextingPhase = "warmUp" | "heated" | "finish";

/** Three of her PPV pictures, less the favourite discount of the ladder. */
export function slurpSextingPrice(ppvPrice: number | undefined, rapport: Pick<SlurpRapport, "tier" | "peak">): number {
  const price = 3 * slurpPpvPrice(ppvPrice);
  return slurpRapportOpens(rapport, "customDiscount")
    ? Math.max(1, Math.round(price * (1 - SLURP_RAPPORT_CUSTOM_DISCOUNT)))
    : price;
}

export function slurpSextingStart(at: Date): SlurpSexting {
  return {
    startedAt: at.toISOString(),
    endsAt: new Date(at.getTime() + SLURP_SEXTING_MINUTES * 60_000).toISOString(),
  };
}

/** The phase now, or null when no session runs: the first 30% warm up, the last 20% finish. */
export function slurpSextingPhase(
  session: SlurpSexting | null | undefined,
  now = Date.now(),
): SlurpSextingPhase | null {
  if (!session) return null;
  const start = Date.parse(session.startedAt);
  const end = Date.parse(session.endsAt);
  if (!(now >= start && now < end)) return null;
  const done = (now - start) / (end - start);
  return done < 0.3 ? "warmUp" : done < 0.8 ? "heated" : "finish";
}

const PHASE_GUIDANCE: Record<SlurpSextingPhase, string> = {
  warmUp: "Warm-up: flirt, tease and describe what you are wearing and doing; build the tension slowly, no climax yet.",
  heated:
    "Heated: be openly sexual and explicit up to your spice level; describe in detail what you are doing to yourself and what you want from them.",
  finish:
    "Finish: bring it to a climax together, then wind down with a short, warm afterglow line, and thank them for the session.",
};

/** The DM prompt's direction while a session runs. */
export function slurpSextingGuidance(phase: SlurpSextingPhase, offerPicture: boolean): string {
  return [
    `Paid sexting session (${SLURP_SEXTING_MINUTES} minutes, already paid): stay fully in it, short hot messages, no small talk, never ask for more money for the chat itself.`,
    PHASE_GUIDANCE[phase],
    offerPicture
      ? "Send one picture now of what you are doing right now, as a teasing offer (it is sent as a PPV)."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Reads the stored column; anything malformed is no session. */
export function readSlurpSexting(value: unknown): SlurpSexting | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SlurpSexting>;
    return typeof parsed.startedAt === "string" && typeof parsed.endsAt === "string"
      ? { startedAt: parsed.startedAt, endsAt: parsed.endsAt, pictureOffered: parsed.pictureOffered === true }
      : null;
  } catch {
    return null;
  }
}
