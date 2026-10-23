import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slurpLiveDurationMinutes, slurpLiveShouldStart, type SlurpLiveEvent } from "../../modules/live/slp-live.js";
import { logger } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../../../services/generation/generation-parameters.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { claimSlurpModelBudget } from "../../base/model/slp-model-worker.js";
import { tryBackgroundConnection } from "../../../services/generation/connection-admission.js";
import { resolveCreatorFanConnection } from "../audience/slp-audience-contract.js";
import { slurpLiveFinishPrompt, slurpLiveScriptPrompt } from "../../modules/live/slp-live-prompt.js";
import { slurpLivePhase } from "../../modules/live/slp-live.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";

const jsonLines = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((line) => {
    if (!line || typeof line !== "object") return [];
    const item = line as Record<string, unknown>;
    return typeof item.text === "string" && typeof item.at === "number" && typeof item.kind === "string"
      ? [{ at: Math.max(0, item.at), kind: item.kind as "narration" | "crowd" | "reaction", ...(typeof item.name === "string" ? { name: item.name } : {}), text: item.text.slice(0, 1000) }]
      : [];
  });
};

export async function advanceSlurpLive(db: DB, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const settings = await createSlurpStorage(db).getSettings();
  if (!slpExtensionOn(settings, "live")) return;
  let show = await storage.active();
  if (!show) {
    const creators = (await createSlurpStorage(db).listNoodlerAccounts()).filter((account) => account.kind !== "persona");
    const creator = creators[0];
    if (!creator || !slurpLiveShouldStart({ active: false, random: 0.99 })) return;
    const duration = slurpLiveDurationMinutes(Date.now());
    const startedAt = at;
    const endsAt = new Date(at.getTime() + duration * 60_000);
    const created = await storage.create({ hostKind: "creator", hostId: creator.id, startedAt, endsAt, goal: Math.max(10, Number(creator.settings?.messaging?.ppvPrice ?? 25)) });
    const script = await runLiveModel(db, settings, creator.displayName, slurpLivePhase(created), duration, slurpLiveScriptPrompt({ creatorName: creator.displayName, phase: "warmup", spiceLevel: Number(creator.settings?.spiceLevel ?? 0), minutes: duration }), "script");
    if (!script.length) return;
    show = (await storage.update(created.id, { script })) ?? created;
    await notifyLive(db, creator, "started", show.id);
  }
  if (show.endedAt || at.getTime() >= Date.parse(show.endsAt)) {
    if (!show.endedAt) {
      const recap = await createSlurpStorage(db).createPost({ authorAccountId: show.hostId, content: `Live show recap: ${show.raised} coins raised.`, source: "generated", metadata: { liveShowId: show.id } });
      await storage.update(show.id, { endedAt: at.toISOString(), recapPostId: recap?.id ?? null });
      await notifyLive(db, (await createSlurpStorage(db).getNoodlerAccountById(show.hostId))!, "ended", show.id);
    }
    return;
  }
  const settingsFans = settings.fanTypes ?? [];
  const elapsed = at.getTime() - Date.parse(show.startedAt);
  const scheduled: SlurpLiveEvent[] = settingsFans.flatMap((fan, index) => {
    if (!fan.enabled || fan.spend.tipChance <= 0) return [];
    const eventAt = ((index + 1) * 60_000) % Math.max(60_000, Date.parse(show.endsAt) - Date.parse(show.startedAt));
    return eventAt <= elapsed ? [{ at: eventAt, kind: "tip", name: fan.name, amount: Math.max(1, Math.round(fan.spend.weeklyBudget[0] * fan.spend.tipChance)), text: "" }] : [];
  });
  if (scheduled.length) {
    const events = [...show.events, ...scheduled.filter((event) => !show!.events.some((old) => old.at === event.at && old.name === event.name))];
    const raised = events.reduce((sum, event) => sum + (event.amount ?? 0), 0);
    const hit = raised >= show.goal && !show.goalHitAt;
    await storage.update(show.id, { events, raised, ...(hit ? { goalHitAt: at.toISOString() } : {}) });
    if (hit) {
      const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
      if (creator) {
        const finish = await runLiveModel(db, settings, creator.displayName, "finish", Math.round(elapsed / 60_000), slurpLiveFinishPrompt({ creatorName: creator.displayName, phase: "finish", spiceLevel: Number(creator.settings?.spiceLevel ?? 0), minutes: Math.round(elapsed / 60_000) }), "finish");
        if (finish.length) await storage.update(show.id, { script: [...show.script, ...finish] });
      }
    }
  }
}

export async function replyToSlurpLiveChat(db: DB, showId: string, chat: string, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const show = await storage.get(showId);
  if (!show || show.endedAt || (show.lastReplyAt && at.getTime() - Date.parse(show.lastReplyAt) < 60_000)) return;
  const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
  if (!creator) return;
  const settings = await createSlurpStorage(db).getSettings();
  const minutes = Math.max(0, Math.round((at.getTime() - Date.parse(show.startedAt)) / 60_000));
  const answer = await runLiveModel(db, settings, creator.displayName, slurpLivePhase(show, at), minutes, `Reply to these player lines as one host response:\n${chat}`, "reply");
  const text = answer[0]?.text;
  if (text) await storage.update(show.id, { lastReplyAt: at.toISOString(), events: [...show.events, { at: at.getTime() - Date.parse(show.startedAt), kind: "chat", name: creator.displayName, text }] });
}

async function runLiveModel(db: DB, settings: any, creatorName: string, phase: string, minutes: number, prompt: string, kind: "script" | "finish" | "reply") {
  try {
    const connection = await resolveCreatorFanConnection(db, settings);
    if (!connection || !(await claimSlurpModelBudget(db, settings.modelBudget, "thread"))) return [];
    const admission = tryBackgroundConnection(connection.id);
    if (!admission.acquired) return [];
    try {
      const provider = slpWithProviderRetry(createLLMProvider(connection.provider, resolveBaseUrl(connection), connection.apiKey, connection.maxContext, connection.openrouterProvider, connection.maxTokensOverride, connection.claudeFastMode === "true", connection.treatAsLocalEndpoint === "true", connection.defaultParameters));
      const response = await provider.chatComplete([{ role: "system", content: `Live ${kind} for ${creatorName}, ${phase}, ${minutes} minutes.` }, { role: "user", content: prompt }], { model: connection.model, ...slpSamplingOptions(resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model), { temperature: 0.8, topP: 0.95 }), maxTokens: clampGenerationMaxOutputTokens({ provider: connection.provider, model: connection.model, maxTokens: 2048, maxTokensOverride: connection.maxTokensOverride }), stream: false });
      const parsed = parseGameJsonish(requireModelAnswer(response.content ?? "", `live ${kind}`));
      if (kind === "reply") return typeof parsed === "string" ? [{ at: Date.now(), kind: "reaction", text: parsed }] : [];
      return jsonLines(parsed);
    } finally { admission.release(); }
  } catch (error) { logger.warn(error, "[slurp-live] Model output rejected"); return []; }
}

async function notifyLive(db: DB, creator: { id: string; sourceEntityId?: string | null }, phase: string, id: string) {
  const recipient = creator.sourceEntityId;
  if (!recipient) return;
  await createSlurpEventsStorage(db).recordAndPrune({ recipientPersonaId: recipient, kind: "live", creatorAccountId: creator.id, subjectId: id, note: phase, operationId: `live:${id}:${phase}:${recipient}` }).catch(() => undefined);
}

export function parseSlurpLiveScript(value: string): ReturnType<typeof jsonLines> {
  try { return jsonLines(JSON.parse(value) as unknown); } catch { return []; }
}
