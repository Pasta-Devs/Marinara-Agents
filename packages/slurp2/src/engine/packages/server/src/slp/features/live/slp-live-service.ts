import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slurpLiveCapEvents, slurpLiveDurationMinutes, slurpLiveParseLines, slurpLivePlayerTipAmount, slurpLiveScriptFailed, slurpLiveShouldStart, type SlurpLiveEvent } from "../../modules/live/slp-live.js";
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
import { slurpLiveFinishPrompt, slurpLiveReplyPrompt, slurpLiveScriptPrompt } from "../../modules/live/slp-live-prompt.js";
import { slurpLivePhase, slurpLiveTipTopper } from "../../modules/live/slp-live.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { trySlpOperation } from "../../base/locking/slp-operation-lock.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { slurpFanTypeForPinnedOrSeed, slurpResolveFanType, slurpFanTypeWeeklyBudget } from "../../../../../shared/src/slp/slp-fan-types.js";
import { slurpMembersActiveAt } from "../../../../../shared/src/slp/slp-population.js";
import { slurpLivePlayerCrowdPrompt } from "../../modules/live/slp-live-prompt.js";

export async function advanceSlurpLive(db: DB, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const settings = await createSlurpStorage(db).getSettings();
  if (!slpExtensionOn(settings, "live")) return;
  let show = await storage.active();
  if (!show) {
    const started = await trySlpOperation("slurp-live-start", async () => {
      const current = await storage.active();
      if (current) return { show: current, startedNow: false };
      const creators = (await createSlurpStorage(db).listNoodlerAccounts()).filter((account) => account.kind !== "persona");
      const creator = creators[0];
      if (!creator || !slurpLiveShouldStart({ active: false })) return null;
      const duration = slurpLiveDurationMinutes(Date.now());
      const created = await storage.createIfNone({
        hostKind: "creator",
        hostId: creator.id,
        startedAt: at,
        endsAt: new Date(at.getTime() + duration * 60_000),
        goal: Math.max(10, Number(creator.settings?.messaging?.ppvPrice ?? 25)),
      });
      if (!created) return { show: await storage.active(), startedNow: false };
      const script = await runLiveModel(
        db,
        settings,
        creator.displayName,
        slurpLivePhase(created),
        duration,
        slurpLiveScriptPrompt({
          creatorName: creator.displayName,
          phase: "warmup",
          spiceLevel: Number(creator.settings?.spiceLevel ?? 0),
          minutes: duration,
        }),
        "script",
      );
      if (slurpLiveScriptFailed(script)) {
        await storage.update(created.id, { endedAt: at.toISOString() });
        return null;
      }
      const live = (await storage.update(created.id, { script })) ?? created;
      await notifyLive(db, creator, "started", live.id);
      return { show: live, startedNow: true };
    });
    show = started.acquired ? started.value?.show ?? null : await storage.active();
    if (!show) return;
  }
  if (show.endedAt || at.getTime() >= Date.parse(show.endsAt)) {
    if (!show.endedAt) {
      if (show.hostKind === "player") await endSlurpPlayerLiveShow(db, show.id, at);
      else {
        const recap = await createSlurpStorage(db).createPost({ authorAccountId: show.hostId, content: `Live show recap: ${show.raised} coins raised.`, source: "generated", metadata: { liveShowId: show.id } });
        await storage.update(show.id, { endedAt: at.toISOString(), recapPostId: recap?.id ?? null });
        const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
        if (creator) await notifyLive(db, creator, "ended", show.id);
      }
    }
    return;
  }
  const settingsFans = settings.fanTypes ?? [];
  if (show.hostKind === "player") {
    const population = createSlurpPopulationStorage(db);
    const all = await population.listTiesForCreator(show.hostId);
    const currentFans = (await population.listAll()).filter((member) => slurpMembersActiveAt(member, at));
    const fansById = new Map(currentFans.map((fan) => [fan.id, fan]));
    const eligible = all.filter((tie) => tie.stage !== "lapsed" && fansById.has(tie.memberId)).slice(0, 120);
    const newEvents: SlurpLiveEvent[] = [];
    for (const tie of eligible) {
      const fan = fansById.get(tie.memberId)!;
      const type = fan.fanTypeId ? slurpResolveFanType(settingsFans, fan) : slurpFanTypeForPinnedOrSeed(settingsFans, null, fan.id);
      if (!type.enabled || type.spend.tipChance <= 0) continue;
      const amount = slurpLivePlayerTipAmount(type, fan.id);
      if (!(await population.reserveWeeklySpend(fan.id, show.hostId, amount, slurpFanTypeWeeklyBudget(type, fan.id), at))) continue;
      try {
        const operationId = `live:${show.id}:fan-tip:${fan.id}`;
        await createSlurpStorage(db).creditCreatorIncome(show.hostId, amount, "tip", operationId);
        await population.advanceTie(fan.id, show.hostId, { stage: "follower", spent: amount, tipped: amount, interactions: 1 });
        newEvents.push({ at: at.getTime() - Date.parse(show.startedAt), kind: "tip", name: fan.displayName, amount, text: "", requestId: operationId });
      } catch (error) {
        await population.releaseWeeklySpend(fan.id, show.hostId, amount, at);
        logger.warn(error, "[slurp-live] Could not process audience tip");
      }
    }
    if (newEvents.length) {
      const current = await storage.get(show.id);
      const combined = slurpLiveCapEvents([...(current?.events ?? []), ...newEvents]);
      const raised = (current?.raised ?? show.raised) + newEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0);
      await storage.update(show.id, { events: combined, raised, ...(raised >= show.goal && !show.goalHitAt ? { goalHitAt: at.toISOString() } : {}) });
    }
    return;
  }
  const elapsed = at.getTime() - Date.parse(show.startedAt);
  const scheduled: SlurpLiveEvent[] = settingsFans.flatMap((fan, index) => {
    if (!fan.enabled || fan.spend.tipChance <= 0) return [];
    const eventAt = ((index + 1) * 60_000) % Math.max(60_000, Date.parse(show.endsAt) - Date.parse(show.startedAt));
    return eventAt <= elapsed ? [{ at: eventAt, kind: "tip", name: fan.name, amount: Math.max(1, Math.round(fan.spend.weeklyBudget[0] * fan.spend.tipChance)), text: "" }] : [];
  });
  if (scheduled.length) {
    const newEvents = scheduled.filter((event) => !show!.events.some((old) => old.at === event.at && old.name === event.name));
    const events = slurpLiveCapEvents([...show.events, ...newEvents]);
    const raised = show.raised + newEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0);
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

export async function replyToSlurpLiveChat(db: DB, showId: string, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const show = await storage.get(showId);
  if (!show || show.endedAt) return;
  const previousReplyAt = show.lastReplyAt;
  if (!(await storage.claimReply(show.id, at))) return;
  try {
    const current = await storage.get(showId);
    if (!current || current.endedAt) {
      await storage.releaseReply(show.id, at);
      return;
    }
    const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
    if (!creator) {
      await storage.releaseReply(show.id, at);
      return;
    }
    const settings = await createSlurpStorage(db).getSettings();
    const minutes = Math.max(0, Math.round((at.getTime() - Date.parse(show.startedAt)) / 60_000));
    const since = previousReplyAt ? Date.parse(previousReplyAt) - Date.parse(show.startedAt) : -1;
    const lines = current.events
      .filter((event) => event.kind === "chat" && event.name !== creator.displayName && event.at > since)
      .map((event) => `${event.name}: ${event.text}`)
      .join("\n");
    const prompt = slurpLiveReplyPrompt({ creatorName: creator.displayName, phase: slurpLivePhase(current, at), spiceLevel: Number(creator.settings?.spiceLevel ?? 0), minutes, chat: lines });
    const answer = await runLiveModel(db, settings, creator.displayName, slurpLivePhase(current, at), minutes, prompt, "reply");
    const text = answer[0]?.text;
    if (text) await storage.appendEvent(show.id, { at: at.getTime() - Date.parse(show.startedAt), kind: "chat", name: creator.displayName, text });
    else await storage.releaseReply(show.id, at);
  } catch (error) {
    await storage.releaseReply(show.id, at);
    logger.warn(error, "[slurp-live] Reply failed");
  }
}

export async function narrateSlurpPlayerLiveShow(db: DB, showId: string, text: string, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const show = await storage.get(showId);
  if (!show || show.endedAt || show.hostKind !== "player") return;
  const elapsed = at.getTime() - Date.parse(show.startedAt);
  await storage.appendLine(showId, { at: elapsed, kind: "narration", name: "Host", text: text.slice(0, 500) });
  const current = await storage.get(showId);
  if (!current || !(await storage.claimCrowd(showId, at))) return;
  const since = show.lastReplyAt ? Date.parse(show.lastReplyAt) - Date.parse(show.startedAt) : -1;
  const narration = current.script.filter((line) => line.kind === "narration" && line.at > since).map((line) => line.text).join("\n");
  const population = createSlurpPopulationStorage(db);
  const fans = (await population.listNamedCast(show.hostId, 6)).map(({ member }) => ({ name: member.displayName, voice: member.archetype }));
  const settings = await createSlurpStorage(db).getSettings();
  const lines = await runLiveModel(db, settings, "Player", "main", 0, slurpLivePlayerCrowdPrompt({ narration, fans }), "script");
  for (const line of lines) await storage.appendLine(showId, { at: elapsed + line.at, kind: "crowd", name: line.name ?? "Crowd", text: line.text });
}

export async function endSlurpPlayerLiveShow(db: DB, showId: string, at = new Date()) {
  const storage = createSlurpLiveStorage(db);
  const claimed = await storage.claimEnd(showId, at);
  if (!claimed) return null;
  const topTipper = slurpLiveTipTopper(claimed.events);
  const post = await createSlurpStorage(db).createNoodlerPost({
    authorAccountId: claimed.hostId,
    content: `Live show recap: ${claimed.raised} coins raised.${topTipper ? ` Top tipper: ${topTipper.name} (${topTipper.amount} coins).` : " No tips were received."}`,
    source: "generated",
    metadata: { liveShowId: claimed.id },
  });
  return storage.setRecap(claimed.id, post?.id ?? null);
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
      return slurpLiveParseLines(parsed);
    } finally { admission.release(); }
  } catch (error) { logger.warn(error, "[slurp-live] Model output rejected"); return []; }
}

async function notifyLive(db: DB, creator: { id: string; sourceEntityId?: string | null }, phase: string, id: string) {
  const recipient = creator.sourceEntityId;
  if (!recipient) return;
  await createSlurpEventsStorage(db).recordAndPrune({ recipientPersonaId: recipient, kind: "live", creatorAccountId: creator.id, subjectId: id, note: phase, operationId: `live:${id}:${phase}:${recipient}` }).catch(() => undefined);
}

export function parseSlurpLiveScript(value: string) {
  try { return slurpLiveParseLines(parseGameJsonish(value)); } catch { return []; }
}
