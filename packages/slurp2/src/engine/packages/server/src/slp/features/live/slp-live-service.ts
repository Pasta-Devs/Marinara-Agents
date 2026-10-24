import type { DB } from "../../../db/connection.js";
import { createSlurpStorage, createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import {
  slurpLiveNextSlot,
  slurpLiveAnnouncementDue,
  slurpLiveAnnouncementText,
  slurpLiveDueNotifications,
  slurpLiveParseLines,
  slurpLivePlayerTipAmount,
  slurpLiveSegmentIndex,
  slurpLiveSegmentToWrite,
  slurpLiveSegmentLineAt,
  slurpLiveWatched,
  slurpLiveFanDue,
  SLURP_LIVE_REACTIONS,
  slurpLiveRecap,
  slurpLiveTipTopper,
  slurpLivePlayerRecapText,
  slurpLivePrivatePrice,
  slurpLivePrivateOffersDue,
  slurpLiveAudienceTipDue,
  slurpLivePictureTriggers,
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
import { slurpLiveRoomPatch, type SlurpLiveRoom } from "../../modules/live/slp-live-room.js";
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
import { slurpLivePlayerMenuDue } from "../../modules/live/slp-live.js";
import { resolveSlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
import { slurpSpiceBriefLines } from "../../modules/creators/slp-spice.js";
import { slurpLivePictureBrief, slurpLivePrivatePrompt } from "../../modules/live/slp-live-private-prompt.js";
import { generateSlurpCommissionImage } from "../messages/slp-messages-contract.js";
import { newId } from "../../../utils/id-generator.js";
import { slurpTrendScore } from "../../modules/discovery/slp-trends.js";
import { readSlurpTrendPosts } from "../../data/discovery/slp-trends-signals.js";

export async function advanceSlurpLive(db: DB, at = new Date()): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const settings = await createSlurpStorage(db).getSettings();
  if (!slpExtensionOn(settings, "live")) return;
  await storage.pruneEnded(at);
  for (const show of await storage.activeShows(at))
    if (at.getTime() >= Date.parse(show.endsAt)) await advanceShow(db, show, settings, at);
  await trySlpOperation("slurp-live-start", async () => {
    const creators = (await createSlurpStorage(db).listNoodlerAccounts()).filter(
      (account) => account.kind !== "persona",
    );
    for (const creator of creators) {
      const previous = await storage.latestFor(creator.id);
      if (previous && !previous.endedAt) continue;
      const posts = await readSlurpTrendPosts(db, creator.id, new Set(), at, 0);
      const slot = slurpLiveNextSlot(
        creator.id,
        previous ? new Date(previous.startedAt) : null,
        at,
        Math.max(0, ...posts.map(slurpTrendScore)),
        settings,
      );
      const spice = await liveSpice(db, creator);
      await storage.plan(
        creator.id,
        slot.startsAt,
        slot.endsAt,
        slot.announcedFor,
        Math.max(10, Number(creator.settings?.messaging?.ppvPrice ?? 25)),
        slurpLiveMenuItems(
          spice.level,
          spice.turnOns,
          Number(creator.settings?.messaging?.ppvPrice ?? 25),
          spice.hardNoes,
        ),
      );
    }
    const upcoming = (await storage.upcoming(at)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const show of upcoming) {
      if (slurpLiveAnnouncementDue(show, at)) {
        await announceSlurpLive(db, show);
      }
    }
    const due = (await storage.planned())
      .filter((show) => show.startedAt <= at.toISOString())
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const show of due) {
      const started = await storage.startPlanned(show.id, at);
      if (!started) {
        const deferred = await storage.deferPlanned(show.id, at);
        if (deferred?.announcementPostId)
          await createSlurpStorage(db).updatePost(deferred.announcementPostId, {
            content: slurpLiveAnnouncementText(new Date(deferred.startedAt)),
          });
        continue;
      }
      const creator = creators.find((item) => item.id === show.hostId);
      if (creator) {
        await notifyLive(db, creator, "started", show.id);
        for (const recipient of slurpLiveDueNotifications(started.reminders, creator.sourceEntityId ?? null))
          await createSlurpEventsStorage(db).recordAndPrune({
            recipientPersonaId: recipient,
            kind: "live",
            creatorAccountId: show.hostId,
            subjectId: show.id,
            note: "reminder",
            operationId: `live:${show.id}:reminder:${recipient}`,
          });
      }
    }
  });
  for (const show of await storage.activeShows(at)) await advanceShow(db, show, settings, at);
}

export async function announceSlurpLive(db: DB, show: SlurpLiveShow): Promise<SlurpLiveShow> {
  const storage = createSlurpLiveStorage(db);
  if (show.announcementPostId) return show;
  const posts = createSlurpStorage(db);
  const existing = (await posts.listPosts({ limit: 300 })).find(
    (post) => post.metadata?.liveShowId === show.id && post.metadata?.liveAnnouncement === true,
  );
  const post =
    existing ??
    (await posts.createPost({
      authorAccountId: show.hostId,
      content: slurpLiveAnnouncementText(new Date(show.startedAt)),
      source: "generated",
      metadata: { liveShowId: show.id, liveAnnouncement: true },
    }));
  if (post) await storage.setAnnouncement(show.id, post.id);
  return (await storage.get(show.id)) ?? show;
}

// ponytail: in-process guards, fine for one Engine process; move into storage leases if the Engine ever runs several.
const liveBusy = new Map<string, number>();
const liveKicks = new Map<string, number>();

/** A viewer's poll moves the show on (at most every 3 s), so watched shows do not wait for the world tick. */
export function kickSlurpLiveShow(db: DB, showId: string, at = new Date()): void {
  if (at.getTime() - (liveKicks.get(showId) ?? 0) < 3_000) return;
  liveKicks.set(showId, at.getTime());
  void (async () => {
    const show = await createSlurpLiveStorage(db).get(showId);
    if (!show || show.endedAt) return void liveKicks.delete(showId);
    await advanceShow(db, show, await createSlurpStorage(db).getSettings(), at);
  })().catch((error: unknown) => logger.warn(error, "[slurp-live] Live kick failed"));
}

async function advanceShow(db: DB, show: SlurpLiveShow, settings: any, at: Date): Promise<void> {
  // A run older than the 2-minute segment lease is treated as hung, so one stuck model call cannot stall the show.
  const token = Date.now();
  if (token - (liveBusy.get(show.id) ?? 0) < 120_000) return;
  liveBusy.set(show.id, token);
  try {
    const fresh = await createSlurpLiveStorage(db).get(show.id);
    if (fresh && !fresh.endedAt) await advanceShowNow(db, fresh, settings, at);
  } finally {
    if (liveBusy.get(show.id) === token) liveBusy.delete(show.id);
  }
}

async function advanceShowNow(db: DB, show: SlurpLiveShow, settings: any, at: Date): Promise<void> {
  const storage = createSlurpLiveStorage(db);
  const privateActive = !!show.private && Date.parse(show.private.until) > at.getTime();
  if (show.endedAt || at.getTime() >= Date.parse(show.endsAt)) {
    if (!show.endedAt) {
      if (show.hostKind === "player") await endSlurpPlayerLiveShow(db, show.id, at);
      else {
        // A private payment still in flight would extend the show, so wait for it (2 minutes at most).
        const privatePending = show.privateClaims.some(
          (claim) =>
            claim.status === "pending" &&
            !claim.requestId.includes(":private-offer:") &&
            at.getTime() - Date.parse(claim.at) < 120_000,
        );
        if (privateActive || privatePending) return;
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
  if (!privateActive) {
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
      if (
        orderFan &&
        item &&
        slurpLivePlayerMenuDue(show.id, orderFan.id, slot) &&
        !current.queue.some((order) => order.requestId === requestId)
      ) {
        const type = orderFan.fanTypeId
          ? slurpResolveFanType(settingsFans, orderFan)
          : slurpFanTypeForPinnedOrSeed(settingsFans, null, orderFan.id);
        if (
          type.enabled &&
          type.spend.tipChance > 0 &&
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
              await createSlurpStorage(db).creditCreatorIncome(
                show.hostId,
                item.price,
                "tip",
                requestId,
                "Live show menu",
              );
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
    if (show.hostKind === "player" && slurpLivePrivateOffersDue(show)) {
      const currentShow = await storage.get(show.id);
      const priorOffers = (currentShow?.privateClaims ?? show.privateClaims).filter((claim) =>
        claim.requestId.includes(":private-offer:"),
      );
      const offeredFans = new Set(priorOffers.map((claim) => claim.personaId));
      const candidate = (await population.listNamedCast(show.hostId, 120)).find(
        ({ member }) => !offeredFans.has(member.id),
      );
      if (candidate) {
        const playerAccount = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
        const ppv = Number(playerAccount?.settings?.messaging?.ppvPrice ?? 25);
        const requestId = `live:${show.id}:private-offer:${candidate.member.id}`;
        const claimed = await storage.claimPrivateOffer(show.id, candidate.member.id, requestId, at);
        if (claimed) {
          const result = await createSlurpMessagesStorage(db).sendViewerMessage(
            candidate.member.id,
            show.hostId,
            `${candidate.member.displayName} wants a 10-minute private show for ${slurpLivePrivatePrice(ppv)}`,
            requestId,
          );
          if (result.status !== "sent")
            logger.warn({ status: result.status }, "[slurp-live] Could not send private offer");
        }
      }
    }
  }
  const current = await storage.get(show.id);
  if (!current || !slurpLiveWatched(current.lastSeenAt, at)) return;
  if (show.hostKind === "creator") {
    for (const viewer of current.pictureViewers.filter(
      (item) => item.mode === "pictures" && slurpLiveWatched(item.seenAt, at),
    ))
      await makeLivePictures(db, current, viewer.personaId, at);
  }
  const index = slurpLiveSegmentToWrite(current, at);
  // Not ahead during a private show: it may end inside the next segment, which must then be public.
  if (index === null || (privateActive && index > slurpLiveSegmentIndex(show, at))) return;
  const lease = await storage.claimSegment(show.id, index, at);
  if (!lease) return;
  const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
  const spice = creator ? await liveSpice(db, creator) : null;
  const minutes = Math.round((at.getTime() - Date.parse(show.startedAt)) / 60_000);
  const prompt =
    show.hostKind === "player"
      ? slurpLivePlayerCrowdPrompt({
          hostName: creator?.displayName ?? "Host",
          narration: current.script
            .filter((line) => line.kind === "narration" && line.at >= minutes * 60_000 - 240_000)
            .map((line) => line.text)
            .join("\n"),
          fans: (await createSlurpPopulationStorage(db).listNamedCast(show.hostId, 6)).map(({ member }) => ({
            name: member.displayName,
            voice: member.archetype,
          })),
        })
      : privateActive && current.private
        ? slurpLivePrivatePrompt({
            hostName: creator?.displayName ?? "Host",
            viewerName:
              current.events.filter((event) => event.personaId === current.private?.personaId).at(-1)?.name ?? "Viewer",
            minutes,
            level: spice?.level ?? 0,
            spiceLines: spice?.spiceLines ?? [],
            chat: current.events
              .filter((event) => event.personaId === current.private?.personaId && event.kind === "chat")
              .slice(-5)
              .map((event) => `${event.name}: ${event.text}`)
              .join("\n"),
          })
        : slurpLiveSegmentPrompt({
            hostName: creator?.displayName ?? "Host",
            segmentIndex: index,
            minutes,
            level: spice?.level ?? 0,
            spiceLines: spice?.spiceLines,
            fans: (await createSlurpPopulationStorage(db).listNamedCast(show.hostId, 8)).map(
              ({ member }) => member.displayName,
            ),
            totalSegments: Math.ceil((Date.parse(show.endsAt) - Date.parse(show.startedAt)) / 240_000),
            goalReached: show.raised >= show.goal,
            room: current.room,
            queuedMenuLabels: current.queue
              .filter((order) => !order.served && order.status !== "pending")
              .map((order) => order.label),
            recentPlayerChatLines: current.events
              .filter((event) => event.kind === "chat" && !event.private && !event.personaId)
              .slice(-5)
              .map((event) => event.text),
            recentTips: current.events
              .filter((event) => event.kind === "tip")
              .slice(-5)
              .map((event) => `${event.name}: ${event.amount}`),
          });
  const callStarted = Date.now();
  let roomPatch: Partial<SlurpLiveRoom> = {};
  const lines = creator
    ? await runLiveModel(db, settings, creator.displayName, "main", minutes, prompt, "segment", (parsed) => {
        roomPatch = slurpLiveRoomPatch(parsed);
      })
    : [];
  const elapsed = at.getTime() + (Date.now() - callStarted) - Date.parse(show.startedAt);
  await storage.completeSegment(
    show.id,
    index,
    lease,
    lines.map((line) => ({
      ...line,
      personaId: privateActive ? current.private?.personaId : undefined,
      private: privateActive,
      at: slurpLiveSegmentLineAt(index, line.at, elapsed),
    })),
    roomPatch,
    current.raised >= current.goal,
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
      hostName: creator?.displayName ?? "Host",
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
    const spice = await liveSpice(db, creator);
    const privateViewer =
      current.private && Date.parse(current.private.until) > at.getTime() ? current.private.personaId : null;
    const minutes = Math.max(0, Math.round((at.getTime() - Date.parse(show.startedAt)) / 60_000));
    const since = previousReplyAt ? Date.parse(previousReplyAt) - Date.parse(show.startedAt) : -1;
    const lines = current.events
      .filter(
        (event) =>
          event.kind === "chat" &&
          event.name !== creator.displayName &&
          event.at > since &&
          (privateViewer ? event.personaId === privateViewer : !event.private && !event.personaId),
      )
      .map((event) => `${event.name}: ${event.text}`)
      .join("\n");
    const prompt = privateViewer
      ? slurpLivePrivatePrompt({
          hostName: creator.displayName,
          viewerName: current.events.findLast((event) => event.personaId === privateViewer)?.name ?? "Viewer",
          minutes,
          level: spice.level,
          spiceLines: spice.spiceLines,
          chat: lines,
        })
      : slurpLiveReplyPrompt({
          creatorName: creator.displayName,
          phase: slurpLivePhase(current, at),
          spiceLevel: spice.level,
          level: spice.level,
          spiceLines: spice.spiceLines,
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
        personaId: privateViewer ?? undefined,
        private: !!privateViewer,
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
    content: slurpLivePlayerRecapText(claimed),
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
  onParsed?: (parsed: unknown) => void,
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
      const raw = requireModelAnswer(response.content ?? "", `live ${kind}`);
      const parsed = kind === "reply" ? raw : parseGameJsonish(raw);
      if (kind === "missed") {
        const rows = Array.isArray(parsed) ? parsed : typeof parsed === "string" ? parsed.split("\n") : [];
        return rows
          .filter((line): line is string => typeof line === "string" && !!line.trim())
          .slice(0, 3)
          .map((text, index) => ({ at: index, kind: "reaction" as const, text: text.slice(0, 300) }));
      }
      if (kind === "reply") {
        const text =
          typeof parsed === "string"
            ? parsed
            : typeof parsed === "object" && parsed !== null && "lines" in parsed
              ? (slurpLiveParseLines(parsed)[0]?.text ?? "")
              : "";
        return text ? [{ at: Date.now(), kind: "reaction", text: text.slice(0, 1000) }] : [];
      }
      onParsed?.(parsed);
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

export async function liveSpice(db: DB, creator: { id: string; settings?: { strategy?: unknown } | null }) {
  const spice = await resolveSlurpCreatorSpice(db, {
    id: creator.id,
    settings: { strategy: creator.settings?.strategy },
  });
  return {
    ...spice,
    level: Math.max(0, ["none", "suggestive", "nudity", "explicit"].indexOf(spice.level)),
    spiceLines: slurpSpiceBriefLines({
      use: "dm",
      level: spice.level,
      turnOns: spice.turnOns,
      hardNoes: spice.hardNoes,
      never: spice.spice.never,
      language: spice.spice.language,
    }),
  };
}

async function makeLivePictures(db: DB, show: SlurpLiveShow, personaId: string, at: Date) {
  const storage = createSlurpLiveStorage(db);
  const creator = await createSlurpStorage(db).getNoodlerAccountById(show.hostId);
  if (!creator || creator.settings?.scheduler?.autoPosting?.imagesEnabled !== true) return;
  const spice = await liveSpice(db, creator);
  for (const trigger of slurpLivePictureTriggers(show, personaId, at)) {
    if (!(await storage.pictureClaim(show.id, personaId, trigger, at))) continue;
    try {
      const image = await generateSlurpCommissionImage(db, {
        creatorAccountId: show.hostId,
        brief: slurpLivePictureBrief({
          hostName: creator.displayName,
          trigger,
          menuLabel: trigger.startsWith("menu:")
            ? show.queue.find((order) => order.requestId === trigger.slice("menu:".length))?.label
            : undefined,
          level: spice.level,
          spiceLines: spice.spiceLines,
        }),
      });
      if (image === "unavailable") {
        await storage.pictureRelease(show.id, personaId, trigger);
        continue;
      }
      const mediaId = newId();
      if (await storage.pictureComplete(show.id, personaId, trigger, mediaId, image.mediaPath, new Date()))
        image.promote();
      else {
        await storage.pictureRelease(show.id, personaId, trigger);
        image.compensate();
      }
    } catch (error) {
      await storage.pictureRelease(show.id, personaId, trigger);
      logger.warn(error, "[slurp-live] Picture generation failed");
    }
  }
}
