import type { SlpLoreReport, SlpMessageDeepDetailsRecord } from "../../../../../shared/src/slp/slp-deep-details.js";
import type { SlurpCreatorState, SlurpThreadState } from "../../modules/creators/slp-creator-state.js";
import type { SlurpRapport } from "../../modules/messages/slp-rapport.js";
import type { SlurpThreadNote } from "../../modules/messages/slp-thread-notes.js";
import type { SlurpStance } from "../../modules/world/slp-stance.js";

const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);

/** The reply generator's state at the moment a direct message was written, as its Deep details record. */
export function buildSlurpMessageDeepDetailsRecord(ctx: {
  input: {
    connection: { id?: unknown; name?: unknown; provider?: unknown; model?: unknown };
    rapport: SlurpRapport;
    subscribed: boolean;
    isRequest: boolean;
    generationGuidance?: string;
    notes?: SlurpThreadNote[];
    threadState?: SlurpThreadState;
    creatorState?: SlurpCreatorState;
  };
  /** Slurp Support's thread: the prompt carries no fan stance and no relationship state. */
  support: boolean;
  stance: SlurpStance;
  messages: { role: string; content: unknown }[];
  /** The completion options as sent: the sampling values come from here. */
  options: object;
  /** The model's answer as received, with the Creator's identity protection applied. */
  content: string;
  /** The lorebook scan behind the reply. */
  lore?: SlpLoreReport;
  /** Locked post bodies this fan has not unlocked, as the prompt showed them: the fan seat's view masks them. */
  paidBodies?: string[];
}): SlpMessageDeepDetailsRecord {
  const { input } = ctx;
  const options = ctx.options as Record<string, unknown>;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    model: {
      provider: String(input.connection.provider ?? ""),
      model: String(input.connection.model ?? ""),
      connectionId: typeof input.connection.id === "string" ? input.connection.id : null,
      connectionName: typeof input.connection.name === "string" ? input.connection.name : null,
      temperature: numberOrNull(options.temperature),
      topP: numberOrNull(options.topP),
      maxTokens: numberOrNull(options.maxTokens),
    },
    messages: ctx.messages.map((message) => ({
      role: message.role,
      content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    })),
    rawResponse: ctx.content,
    paidBodies: ctx.paidBodies?.filter(Boolean),
    chat: {
      rapport: { tier: input.rapport.tier, score: input.rapport.score },
      subscribed: input.subscribed,
      request: input.isRequest,
      direction: input.generationGuidance?.trim() || null,
      stance: ctx.support
        ? null
        : {
            warmth: ctx.stance.warmth,
            latitude: ctx.stance.latitude,
            imageMode: ctx.stance.imageMode,
            evidence: ctx.stance.evidence.map(({ layer, value, effect }) => ({ layer, value, effect })),
          },
      relationship:
        input.threadState && !ctx.support
          ? { posture: input.threadState.posture, adultLevel: input.threadState.adultLevel }
          : null,
      creator: input.creatorState ? { emotion: input.creatorState.emotion, intent: input.creatorState.intent } : null,
      memories: (input.notes ?? []).map((note) => ({ tier: note.tier, text: note.text })),
      ...(ctx.lore ? { lore: ctx.lore } : {}),
    },
  };
}
