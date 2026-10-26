import type { DB } from "../../../db/connection.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { logger } from "../../../lib/logger.js";
import { slpAccountGender, slpPronouns } from "../../../../../shared/src/slp/slp-gender.js";
import {
  slpLiveApplyBeat,
  slpLiveParseBeat,
  SLP_LIVE_BEAT_SECONDS,
} from "../../../../../shared/src/slp/slp-live-beat.js";
import { slpLiveLog } from "../../../../../shared/src/slp/slp-live.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { resolveSlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
import { resolveCreatorCharacterCanon } from "../../data/creators/slp-source-resolve.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpSpiceBriefLines } from "../../modules/creators/slp-spice.js";
import { slpLivePrompt } from "../../modules/live/slp-live-prompt.js";
import { withSlurpLiveShow } from "./slp-live-lock.js";
import { simulateSlurpLiveShow } from "./slp-live-service.js";

export type SlurpLiveBeatResult = "written" | "waiting" | "busy" | "failed" | "ended" | "missing";

// ponytail: in-process guard, one beat call per show at a time; a second server process would need a row flag.
const writing = new Map<string, number>();
/** The newest call per show that the player's message or join started: an older call's beat is dropped. */
const cutIn = new Map<string, number>();
let calls = 0;

/** When the model fails, the Creator covers in a line so the room never goes silent (LIVE-V3-PLAN.md "Talk"). */
const COVER_LINES = [
  "one sec, my stream is lagging. you guys still there?",
  "chat is flying, give me a second to catch up",
];

/**
 * Writes the show's next beat with one model call, when the current one is two thirds played or the player
 * cuts in with a message (or just joined). Code facts stay with code; the model writes the talk.
 */
export async function beatSlurpLiveShow(
  db: DB,
  input: {
    showId: string;
    viewer: { id: string; displayName: string } | null;
    personaId?: string;
    message?: string;
    joined?: boolean;
  },
  now = new Date(),
): Promise<SlurpLiveBeatResult> {
  const t0 = Date.now();
  const noodle = createSlurpStorage(db);
  const storage = createSlurpLiveStorage(db);
  const settings = await noodle.getSettings();
  const stored = await storage.get(input.showId);
  if (!stored) return "missing";
  if (stored.endedAt || now.getTime() >= Date.parse(stored.endsAt)) return "ended";
  const show = await simulateSlurpLiveShow(db, stored, settings, now);
  const seconds = SLP_LIVE_BEAT_SECONDS[settings.live.beatLength];
  const startedAt = Date.parse(show.startedAt);
  const at = now.getTime() - startedAt;
  const talking = !!(input.message || input.joined);
  if (!talking && (show.state.beatTo ?? 0) - at > (seconds * 1_000) / 3) return "waiting";
  if (writing.has(show.id) && !talking) return "busy";
  const call = ++calls;
  writing.set(show.id, call);
  if (talking) cutIn.set(show.id, call);
  try {
    const host = await noodle.getAccountById(show.hostId);
    if (!host) return "missing";
    const spice = await resolveSlurpCreatorSpice(db, host);
    const canon = await resolveCreatorCharacterCanon(db, host, host.settings.privacy.identityDisclosure ?? "secret");
    const viewer = input.viewer
      ? { name: input.viewer.displayName, ...(input.message ? { message: input.message } : {}), joined: !!input.joined }
      : null;
    const prompt = slpLivePrompt({
      host: { name: host.displayName, pronouns: slpPronouns(slpAccountGender(host)), bio: host.bio ?? "", canon },
      spiceLines: slurpSpiceBriefLines({
        use: "dm",
        level: spice.level,
        held: false,
        turnOns: spice.turnOns,
        hardNoes: spice.hardNoes,
        never: spice.spice.never,
        language: spice.spice.language,
      }),
      state: show.state,
      at,
      minutesLeft: Math.max(0, Math.round((Date.parse(show.endsAt) - now.getTime()) / 60_000)),
      seconds,
      viewer,
    });
    const beat = await writeBeat(db, settings.live.connectionId ?? settings.generationConnectionId, prompt).catch(
      (error: unknown) => {
        logger.warn(error, "[slurp-live] Beat failed");
        return null;
      },
    );
    const you =
      input.message && input.personaId && input.viewer
        ? { by: `persona:${input.personaId}`, name: input.viewer.displayName, text: input.message }
        : undefined;
    let kept = 0;
    let stale = false;
    await withSlurpLiveShow(show.id, async () => {
      const fresh = await storage.get(show.id);
      if (!fresh || fresh.endedAt) return;
      // The model took a few seconds: the beat starts now, not when it was asked for.
      const ready = at + (Date.now() - t0);
      // A newer cut-in already wrote its answer; this beat would cut it away.
      if ((cutIn.get(show.id) ?? 0) > call) {
        if (you) slpLiveLog(fresh.state, { at: ready, kind: "you", by: you.by, name: you.name, text: you.text });
        stale = true;
      } else if (beat)
        kept = slpLiveApplyBeat(fresh.state, beat, {
          at: ready,
          seconds,
          host: host.displayName,
          ...(you ? { you } : {}),
        });
      if (!kept && !stale) {
        // With a beat, the apply already logged the player's line.
        if (you && !beat)
          slpLiveLog(fresh.state, { at: ready, kind: "you", by: you.by, name: you.name, text: you.text });
        const line = COVER_LINES[Math.floor(ready / 1_000) % COVER_LINES.length]!;
        slpLiveLog(fresh.state, { at: ready + 1_000, kind: "say", by: "host", name: host.displayName, text: line });
        // Try again in a while, outside the client's ask window, so a broken connection is not called nonstop.
        fresh.state.beatTo = ready + 30_000;
      }
      await storage.save(fresh.id, { state: fresh.state });
    });
    return kept || stale ? "written" : "failed";
  } finally {
    if (writing.get(show.id) === call) writing.delete(show.id);
  }
}

async function writeBeat(db: DB, connectionId: string | null, prompt: { system: string; user: string }) {
  const connection = await resolveSlurpTextConnection(createConnectionsStorage(db), connectionId);
  if (!connection) throw new Error("No text connection for live shows");
  const provider = slpWithProviderRetry(
    createLLMProvider(
      connection.provider,
      resolveBaseUrl(connection),
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      connection.defaultParameters,
    ),
  );
  const response = await provider.chatComplete(
    [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    {
      model: connection.model,
      ...slpSamplingOptions(
        resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
        {
          temperature: 0.9,
          topP: 0.95,
        },
      ),
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider,
        model: connection.model,
        maxTokens: 2048,
        maxTokensOverride: connection.maxTokensOverride,
      }),
      stream: false,
    },
  );
  return slpLiveParseBeat(parseGameJsonish(requireModelAnswer(response.content ?? "", "live beat")));
}
