import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import {
  slurpLiveDurationMinutes,
  slurpLiveParseLines,
  slurpLivePlayerTipAmount,
  slurpLiveShouldStart,
  slurpLiveSegmentIndex,
  slurpLiveWatched,
  slurpLiveFanDue,
  SLURP_LIVE_REACTIONS,
  slurpLiveRecap,
  slurpLiveTipTopper,
  slurpLiveAudienceTipDue,
  type SlurpLiveShow,
} from "../../modules/live/slp-live.js";
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
import {
  slurpLiveMissedPrompt,
  slurpLiveReplyPrompt,
  slurpLiveSegmentPrompt,
} from "../../modules/live/slp-live-prompt.js";
import { slurpLivePhase } from "../../modules/live/slp-live.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { trySlpOperation } from "../../base/locking/slp-operation-lock.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import {
  slurpFanTypeForPinnedOrSeed,
  slurpResolveFanType,
  slurpFanTypeWeeklyBudget,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import { slurpMembersActiveAt } from "../../../../../shared/src/slp/slp-population.js";
import { slurpLivePlayerCrowdPrompt } from "../../modules/live/slp-live-prompt.js";
import { slurpLiveMenuItems } from "../../modules/live/slp-live-menu.js";
import { slpSpiceFromStrategyText } from "../../../../../shared/src/slp/slp-spice.js";
import { slurpTrendScore } from "../../modules/discovery/slp-trends.js";
import { readSlurpTrendPosts } from "../../data/discovery/slp-trends-signals.js";

export async function advanceSlurpLive(db: DB, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const settings = await createSlurpStorage(db).getSettings();
  if (!slpExtensionOn(settings, "live")) return;
  await storage.pruneEnded(at);
  const active = await storage.activeShows();
  if (active.filter((show) => show.hostKind === "creator").length < 2) {
    await trySlpOperation("slurp-live-start", async () => {
      const current = await storage.activeShows();
      if (current.filter((show) => show.hostKind === "creator").length >= 2) return;
      const creators = (await createSlurpStorage(db).listNoodlerAccounts()).filter(
        (account) => account.kind !== "persona" && !current.some((show) => show.hostId === account.id),
      );
      if (!creators.length || !slurpLiveShouldStart({ active: false })) return;
      const scored = await Promise.all(
        creators.map(async (creator) => {
          const posts = await readSlurpTrendPosts(db, creator.id, new Set(), at, 0);
          return {
            creator,
            weight: 1 + Math.max(0, ...posts.map(slurpTrendScore)),
          };
        }),
      );
      let draw = Math.random() * scored.reduce((sum, item) => sum + item.weight, 0);
      const creator = (scored.find((item) => (draw -= item.weight) <= 0) ?? scored[scored.length - 1])!.creator;
      const duration = slurpLiveDurationMinutes(Date.now());
      const spice = slpSpiceFromStrategyText(creator.settings?.strategyText ?? "");
      const level = Math.max(0, ["flirty", "suggestive", "explicit"].indexOf(spice.level ?? "") + 1);
      const created = await storage.createIfNone({
        hostKind: "creator",
        hostId: creator.id,
        startedAt: at,
        endsAt: new Date(at.getTime() + duration * 60_000),
        goal: Math.max(10, Number(creator.settings?.messaging?.ppvPrice ?? 25)),
        menu: slurpLiveMenuItems(level, spice.turnOns, Number(creator.settings?.messaging?.ppvPrice ?? 25)),
      });
      if (created) await notifyLive(db, creator, "started", created.id);
    });
  }
  for (const show of await storage.activeShows()) await advanceShow(db, show, settings, at);
}

async function advanceShow(db: DB, show: SlurpLiveShow, settings: any, at: Date): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  if (show.endedAt || at.getTime() >= Date.parse(show.endsAt)) {
    if (!show.endedAt) {
      if (show.hostKind === "player") await endSlurpPlayerLiveShow(db, show.id, at);
      else {
        const recap = await createSlurpStorage(db).createPost({
          authorAccountId: show.hostId,
          content: slurpLiveRecap(show),
          source: "generated",
          metadata: { liveShowId: show.id },
        });
        await storage.update(show.id, { endedAt: at.toISOString(), recapPostId: recap?.id ?? null });
        const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
        if (creator) await notifyLive(db, creator, "ended", show.id);
      }
    }
    return;
  }
  const settingsFans = settings.fanTypes ?? [];
  {
    const population = createSlurpPopulationStorage(db);
    const all = await population.listTiesForCreator(show.hostId);
    const currentFans = (await population.listAll()).filter((member) => slurpMembersActiveAt(member, at));
    const fansById = new Map(currentFans.map((fan) => [fan.id, fan]));
    const eligible = all.filter((tie) => tie.stage !== "lapsed" && fansById.has(tie.memberId)).slice(0, 120);
    for (const tie of eligible) {
      const fan = fansById.get(tie.memberId)!;
      const type = fan.fanTypeId
        ? slurpResolveFanType(settingsFans, fan)
        : slurpFanTypeForPinnedOrSeed(settingsFans, null, fan.id);
      if (!type.enabled || type.spend.tipChance <= 0) continue;
      const due = slurpLiveFanDue(
        show.id,
        fan.id,
        Date.parse(show.endsAt) - Date.parse(show.startedAt),
        type.spend.tipChance,
      );
      if (
        due === null ||
        at.getTime() - Date.parse(show.startedAt) < due ||
        !slurpLiveAudienceTipDue(show.audienceTipKeys, `live:${show.id}:fan-tip:${fan.id}`)
      )
        continue;
      const amount = slurpLivePlayerTipAmount(type, fan.id);
      if (
        !(await population.reserveWeeklySpend(fan.id, show.hostId, amount, slurpFanTypeWeeklyBudget(type, fan.id), at))
      )
        continue;
      try {
        const operationId = `live:${show.id}:fan-tip:${fan.id}`;
        if (
          !(await storage.claimTip(show.id, {
            at: due,
            kind: "tip",
            name: fan.displayName,
            amount,
            text: "",
            requestId: operationId,
          }))
        ) {
          await population.releaseWeeklySpend(fan.id, show.hostId, amount, at);
          continue;
        }
        await createSlurpStorage(db).creditCreatorIncome(show.hostId, amount, "tip", operationId);
        await population.advanceTie(fan.id, show.hostId, {
          stage: "follower",
          spent: amount,
          tipped: amount,
          interactions: 1,
        });
      } catch (error) {
        await storage.releaseTip(show.id, `live:${show.id}:fan-tip:${fan.id}`);
        await population.releaseWeeklySpend(fan.id, show.hostId, amount, at);
        logger.warn(error, "[slurp-live] Could not process audience tip");
      }
    }
    const elapsed = at.getTime() - Date.parse(show.startedAt);
    const slot = Math.floor(elapsed / 60_000);
    const fan = currentFans[slot % Math.max(1, currentFans.length)];
    if (fan && !show.events.some((event) => event.requestId === `live:${show.id}:reaction:${slot}`)) {
      await storage.appendEvent(show.id, {
        at: elapsed,
        kind: "chat",
        name: fan.displayName,
        text: SLURP_LIVE_REACTIONS[slot % SLURP_LIVE_REACTIONS.length]!,
        requestId: `live:${show.id}:reaction:${slot}`,
      });
    }
    const current = await storage.get(show.id);
    if (current) {
      const orderFan = currentFans[(slot + 3) % Math.max(1, currentFans.length)];
      const item = current.menu[slot % Math.max(1, current.menu.length)];
      const requestId = `live:${show.id}:menu:${slot}`;
      if (orderFan && item && !current.queue.some((order) => order.requestId === requestId)) {
        const type = orderFan.fanTypeId
          ? slurpResolveFanType(settingsFans, orderFan)
          : slurpFanTypeForPinnedOrSeed(settingsFans, null, orderFan.id);
        if (
          type.enabled &&
          slurpLiveFanDue(
            show.id,
            `${orderFan.id}:menu`,
            Date.parse(show.endsAt) - Date.parse(show.startedAt),
            type.spend.tipChance,
          ) !== null &&
          (await population.reserveWeeklySpend(
            orderFan.id,
            show.hostId,
            item.price,
            slurpFanTypeWeeklyBudget(type, orderFan.id),
            at,
          ))
        ) {
          try {
            const order = {
              itemId: item.id,
              label: item.label,
              name: orderFan.displayName,
              viewerId: orderFan.id,
              at: elapsed,
              served: false,
              requestId,
            };
            if (!(await storage.claimMenu(show.id, order, item.price))) {
              await population.releaseWeeklySpend(orderFan.id, show.hostId, item.price, at);
            } else {
              await createSlurpStorage(db).creditCreatorIncome(show.hostId, item.price, "tip", requestId);
              await population.advanceTie(orderFan.id, show.hostId, {
                stage: "follower",
                spent: item.price,
                tipped: item.price,
                interactions: 1,
              });
              await storage.confirmMenu(show.id, requestId);
            }
          } catch (error) {
            await storage.releaseMenu(show.id, requestId);
            await population.releaseWeeklySpend(orderFan.id, show.hostId, item.price, at);
            logger.warn(error, "[slurp-live] Could not process audience menu order");
          }
        }
      }
    }
  }
  const current = await storage.get(show.id);
  if (!current || !slurpLiveWatched(current.lastSeenAt, at)) return;
  const index = slurpLiveSegmentIndex(show, at);
  const lease = await storage.claimSegment(show.id, index, at);
  if (!lease) return;
  const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
  const minutes = Math.round((at.getTime() - Date.parse(show.startedAt)) / 60_000);
  const prompt =
    show.hostKind === "player"
      ? slurpLivePlayerCrowdPrompt({
          narration: current.script
            .filter((line) => line.kind === "narration" && line.at >= index * 240_000)
            .map((line) => line.text)
            .join("\n"),
          fans: (await createSlurpPopulationStorage(db).listNamedCast(show.hostId, 6)).map(({ member }) => ({
            name: member.displayName,
            voice: member.archetype,
          })),
        })
      : slurpLiveSegmentPrompt({
          hostName: creator?.displayName ?? "Host",
          segmentIndex: index,
          minutes,
          level: Number(creator?.settings?.spiceLevel ?? 0),
          queuedMenuLabels: current.queue
            .filter((order) => !order.served && order.status !== "pending")
            .map((order) => order.label),
          recentPlayerChatLines: current.events
            .filter((event) => event.kind === "chat")
            .slice(-5)
            .map((event) => event.text),
          recentTips: current.events
            .filter((event) => event.kind === "tip")
            .slice(-5)
            .map((event) => `${event.name}: ${event.amount}`),
        });
  const lines = creator
    ? await runLiveModel(db, settings, creator.displayName, "main", minutes, prompt, "segment")
    : [];
  await storage.completeSegment(
    show.id,
    index,
    lease,
    lines.map((line) => ({ ...line, at: index * 240_000 + Math.max(0, Math.min(239_999, line.at)) })),
  );
}

export async function getSlurpLiveMissed(db: DB, showId: string, at = new Date()) {
  const storage = createSlurpLiveStorage(db);
  const show = await storage.get(showId);
  if (!show || show.endedAt || show.missedSummary !== null || !(await storage.claimMissed(showId)))
    return storage.get(showId);
  const settings = await createSlurpStorage(db).getSettings();
  const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
  const result = await runLiveModel(
    db,
    settings,
    creator?.displayName ?? "Host",
    "main",
    0,
    slurpLiveMissedPrompt({
      elapsedMinutes: Math.round((at.getTime() - Date.parse(show.startedAt)) / 60_000),
      raised: show.raised,
      goal: show.goal,
      servedMenuLabels: show.queue.filter((order) => order.served).map((order) => order.label),
      topTipper: slurpLiveTipTopper(show.events)?.name ?? null,
    }),
    "missed",
  );
  await storage.setMissed(
    showId,
    result.slice(0, 3).map((line) => line.text),
  );
  return storage.get(showId);
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
    const prompt = slurpLiveReplyPrompt({
      creatorName: creator.displayName,
      phase: slurpLivePhase(current, at),
      spiceLevel: Number(creator.settings?.spiceLevel ?? 0),
      minutes,
      chat: lines,
    });
    const answer = await runLiveModel(
      db,
      settings,
      creator.displayName,
      slurpLivePhase(current, at),
      minutes,
      prompt,
      "reply",
    );
    const text = answer[0]?.text;
    if (text)
      await storage.appendEvent(show.id, {
        at: at.getTime() - Date.parse(show.startedAt),
        kind: "chat",
        name: creator.displayName,
        text,
      });
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
}

export async function endSlurpPlayerLiveShow(db: DB, showId: string, at = new Date()) {
  const storage = createSlurpLiveStorage(db);
  const claimed = await storage.claimEnd(showId, at);
  if (!claimed) return null;
  const post = await createSlurpStorage(db).createNoodlerPost({
    authorAccountId: claimed.hostId,
    content: slurpLiveRecap(claimed),
    source: "generated",
    metadata: { liveShowId: claimed.id },
  });
  return storage.setRecap(claimed.id, post?.id ?? null);
}

async function runLiveModel(
  db: DB,
  settings: any,
  creatorName: string,
  phase: string,
  minutes: number,
  prompt: string,
  kind: "segment" | "missed" | "reply",
) {
  try {
    const connection = await resolveCreatorFanConnection(db, settings);
    if (!connection || !(await claimSlurpModelBudget(db, settings.modelBudget, "thread"))) return [];
    const admission = tryBackgroundConnection(connection.id);
    if (!admission.acquired) return [];
    try {
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
          { role: "system", content: `Live ${kind} for ${creatorName}, ${phase}, ${minutes} minutes.` },
          { role: "user", content: prompt },
        ],
        {
          model: connection.model,
          ...slpSamplingOptions(
            resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model),
            { temperature: 0.8, topP: 0.95 },
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
      const parsed = parseGameJsonish(requireModelAnswer(response.content ?? "", `live ${kind}`));
      if (kind === "missed") {
        const rows = Array.isArray(parsed) ? parsed : typeof parsed === "string" ? parsed.split("\n") : [];
        return rows
          .filter((line): line is string => typeof line === "string" && !!line.trim())
          .slice(0, 3)
          .map((text, index) => ({ at: index, kind: "reaction" as const, text: text.slice(0, 300) }));
      }
      if (kind === "reply")
        return typeof parsed === "string" ? [{ at: Date.now(), kind: "reaction", text: parsed }] : [];
      return slurpLiveParseLines(parsed);
    } finally {
      admission.release();
    }
  } catch (error) {
    logger.warn(error, "[slurp-live] Model output rejected");
    return [];
  }
}

async function notifyLive(db: DB, creator: { id: string; sourceEntityId?: string | null }, phase: string, id: string) {
  const recipient = creator.sourceEntityId;
  if (!recipient) return;
  await createSlurpEventsStorage(db)
    .recordAndPrune({
      recipientPersonaId: recipient,
      kind: "live",
      creatorAccountId: creator.id,
      subjectId: id,
      note: phase,
      operationId: `live:${id}:${phase}:${recipient}`,
    })
    .catch(() => undefined);
}

export function parseSlurpLiveScript(value: string) {
  try {
    return slurpLiveParseLines(parseGameJsonish(value));
  } catch {
    return [];
  }
}
