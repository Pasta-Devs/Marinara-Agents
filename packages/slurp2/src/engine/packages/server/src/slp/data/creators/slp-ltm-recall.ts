/**
 * What Long-Term Memory remembers about a Creator, for a post or a DM reply: its in-process
 * `long-term-memory:recall` service, which applies Long-Term Memory's own subject, mode, persona and
 * sharing rules. Read-only; nothing is stored. A missing service, a refusal or any failure means no
 * lines, never a failed post.
 *
 * Behind the same two gates as the flavour brief: an open Creator identity and `flavourFromAgents`.
 */
import { logger } from "../../../lib/logger.js";
import { getCapabilityService } from "../../../services/capability-packages/capability-service-registry.service.js";
import type { SlpAccount, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";

const SERVICE = "long-term-memory:recall";
const MAX_LINES = 6;
const MAX_QUERY = 8_000;
// Whole memories are skipped, never cut, when over the budget: ask for the service ceiling and let the line caps
// below bound the prompt. Relevant parts are ranked into a small budget.
const WHOLE_TOKENS = 4_000;
const RELEVANT_TOKENS = 800;
const MAX_LINE = 300;
const TIMEOUT_MS = 5_000;

/** `missing`: no Long-Term Memory. `off`: it declined (its sharing switch is off). */
export type SlurpMemoryStatus = "ok" | "missing" | "off" | "error";

type LtmRecall = {
  recall?: (input: Record<string, unknown>) => Promise<{ sections?: { title?: unknown; text?: unknown }[] } | null>;
};

let lastStatus: SlurpMemoryStatus | null = null;

/** The last outcome in this server run; `null` until the first post or DM reads. */
export const lastSlurpMemoryStatus = () => lastStatus;

/**
 * The player's persona is added to a DM's recall only when it is really the player (not a fan voice or an
 * invited character) and its own Slurp page is open, so a hinted or concealed page is never tied to the
 * memories of the persona behind it.
 */
export function slurpRecallPersonaId(
  viewer: Pick<SlpAccount, "kind" | "entityId">,
  viewerPage: Pick<SlpAccount, "settings"> | null,
  fanVoice: unknown,
): string | undefined {
  if (viewer.kind !== "persona" || fanVoice || !viewerPage) return undefined;
  return (viewerPage.settings.privacy.identityDisclosure ?? "open") === "open" ? viewer.entityId : undefined;
}

const collapse = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "");

export async function recallSlurpMemories(input: {
  settings: Pick<SlurpSettings, "flavourFromAgents" | "memoryRecall">;
  source: Pick<SlpAccount, "kind" | "entityId"> | null;
  disclosureMode: SlpIdentityDisclosure;
  queryText: string;
  /** The player's persona in a DM, when its page allows it. A persona-sourced Creator uses its own. */
  personaId?: string;
  signal?: AbortSignal;
}): Promise<{ status: SlurpMemoryStatus | null; lines: string[] }> {
  const { source } = input;
  const queryText = collapse(input.queryText).slice(0, MAX_QUERY);
  if (!source || input.disclosureMode !== "open" || !queryText || !input.settings.flavourFromAgents)
    return { status: null, lines: [] };
  const done = (status: SlurpMemoryStatus, lines: string[] = []) => {
    lastStatus = status;
    return { status, lines };
  };
  try {
    const service = getCapabilityService<LtmRecall>(SERVICE);
    if (!service?.recall) return done("missing");
    const whole = input.settings.memoryRecall === "whole";
    const signal = input.signal ?? AbortSignal.timeout(TIMEOUT_MS);
    const answer = await service.recall({
      caller: "slurp2",
      queryText,
      characterIds: source.kind === "character" ? [source.entityId] : [],
      personaId: source.kind === "persona" ? source.entityId : input.personaId,
      mode: "roleplay",
      maxTokens: whole ? WHOLE_TOKENS : RELEVANT_TOKENS,
      whole,
      signal,
    });
    // It also answers null when the call timed out, which is not the same as its sharing switch being off.
    if (!answer) return done(signal.aborted ? "error" : "off");
    const lines = (answer.sections ?? [])
      .map((section) => {
        const title = collapse(section.title);
        const text = collapse(section.text);
        return title && text ? `${title}: ${text}` : text;
      })
      // A note about the player is never public: drop a `{{user}}` line, cap the rest.
      .filter((line) => line && !/\{\{\s*user\s*\}\}/iu.test(line))
      .map((line) => (line.length > MAX_LINE ? `${line.slice(0, MAX_LINE - 1).trim()}…` : line))
      .slice(0, MAX_LINES);
    return done("ok", lines);
  } catch (error) {
    logger.warn(error, "[slurp] Could not read Long-Term Memory's recall; this is written without memories");
    return done("error");
  }
}
