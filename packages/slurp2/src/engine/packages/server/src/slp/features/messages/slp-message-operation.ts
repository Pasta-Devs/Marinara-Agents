/**
 * Generate and store one creator reply in a direct-message thread.
 *
 * Mirrors `slurp-creator-reply.operation.ts`: claim, resolve a connection, generate, store, and
 * release after the visible bubble plus delayed batch are durable. The claim is what stops the live
 * send path and the offline scheduler from both answering the same message.
 */
import { agreeSlurpCollabInDm, applySlurpPlayerUs } from "../projects/slp-projects-contract.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpMessagesStorage, type SlurpMessage } from "../../data/slp-storage.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { generateSlurpMessageReply, SlurpMessageBudgetUnavailableError } from "./slp-message-generation-service.js";
import { resolveSlurpReplyAvailability, resolveSlurpReplyViewer } from "./slp-thread-stance.js";
import { describeSlurpDayVibe, dropSlurpPendingText } from "../world/slp-world-contract.js";
import { recoverSlurpMood } from "../../modules/world/slp-mood.js";
import { activeSlurpStrikes, type SlurpStanceLatitude } from "../../modules/world/slp-stance.js";
import { resolveSlurpCreatorScheduleTraits } from "../../modules/creators/slp-creator-schedule-context.js";
import {
  calculateConversationMomentum,
  extendedOnlineDurationMinutes,
  shouldPauseMoodRecovery,
  SLURP_ONLINE_AFTER_REPLY_MINUTES,
} from "../../modules/messages/slp-conversation-momentum.js";
import { readTalkativenessProfile, allowMultiBubbleSplit } from "../../modules/world/slp-talkativeness.js";
import {
  slurpReplyBubbleDelayMs,
  slurpReplyPacing,
  slurpAnswersAiFan,
  splitSlurpReplyBurst,
  type SlurpReplyPacing,
} from "../../modules/messages/slp-messaging.js";
import { generateSlurpCommissionImage } from "./commissions/slp-commission-image-operation.js";
import { slpStoredMediaSize, slurpMessageMediaUrl } from "../../base/media/slp-media.js";
import { resolveSlurpMediaOffer, slurpDmPictureSpicy } from "../../modules/economy/slp-media-offer.js";
import { slurpRapportPartner } from "../../modules/messages/slp-rapport.js";
import { slurpDmSpiceLevel } from "../../modules/creators/slp-spice.js";
import { resolveSlurpExplicitLevel } from "../../data/settings/slp-post-guidance-storage.js";
import { slurpCreatorStateCanUseMedia } from "../../modules/creators/slp-creator-state.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import {
  applySlurpSupportTalk,
  isSlurpSupportPhotoDemand,
  isSlurpSupportThread,
  slurpSupportPhotoFallback,
  type SlurpSupportTalkStore,
} from "../../modules/messages/slp-support.js";
import { applySlurpDeskTalk } from "./desk/slp-desk-talk-operation.js";
import { slpCreatorUnlockPriceFromMetadata } from "../../modules/economy/slp-prices.js";
import { readSlurpCreatorSteering } from "../../data/creators/slp-steering-storage.js";
import { planSlpStir } from "../assist/slp-assist-contract.js";
import {
  createSlurpContinuityFact,
  findSlurpContinuityFactBySourceHash,
} from "../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";

import { slurpCreatorInScene } from "./scenes/slp-roleplay-scene-lock.js";
export type SlurpReplyOutcome =
  | { status: "replied"; message: SlurpMessage; pacing: SlurpReplyPacing }
  | { status: "queued"; pacing: SlurpReplyPacing }
  /** The daily or hourly AI budget is spent; the reply is queued for `retryAt`. */
  | { status: "budget"; retryAt: string; pacing: SlurpReplyPacing }
  /** The creator has stepped away from this conversation. `until` is when they come back. */
  | { status: "cooling"; until: string }
  /** The creator is in a roleplay scene (docs/SCENES.md): the obligation stays, the answer waits. */
  | { status: "in_scene" }
  | { status: "busy" }
  | { status: "ineligible" }
  /** Not answered now, and no away reply will come: the player asks for one. */
  | { status: "owed" }
  /** The AI budget is off (or its DM switch is): nobody answers until it is on again. */
  | { status: "ai_off" }
  | { status: "connection_not_found" }
  | { status: "failed"; error: string };

/**
 * Decide when the creator answers, and answer now if the answer is "now".
 *
 * `force` is the scheduler's entry point: the wait has already elapsed, so pacing only shapes
 * the typing indicator and never sends the work back to the queue a second time.
 */
export async function replyToSlurpMessage(
  db: DB,
  input: {
    threadId: string;
    triggerMessageId: string;
    force?: boolean;
    /** The scheduler, answering unattended. A person waiting at the screen is not this. */
    background?: boolean;
    /** The owner asked their hand-operated Creator to answer this once, through draft-reply. */
    operatorDraft?: boolean;
    debugMode?: boolean;
    generationGuidance?: string;
  },
): Promise<SlurpReplyOutcome> {
  const messagesStore = createSlurpMessagesStorage(db);
  const slurp = createSlurpStorage(db);
  const thread = await messagesStore.getThreadById(input.threadId);
  if (!thread || (thread.state !== "active" && thread.state !== "request")) return { status: "ineligible" };

  const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
  // Slurp Support's own thread: the one writing is Slurp's staff, named as the thread names them.
  const support = isSlurpSupportThread(thread);
  const listedViewer = await resolveSlurpReplyViewer(db, thread, creator, input.operatorDraft === true);
  // An AI fan (no persona, not Support) is answered unattended about one time in four (task E);
  // once answered, the fan keeps the conversation while the thread lives. The rest expire unanswered.
  const aiFanTrigger =
    !listedViewer && !input.operatorDraft && input.background && creator
      ? await messagesStore.getMessageById(input.triggerMessageId)
      : null;
  const aiFan = Boolean(
    aiFanTrigger &&
    slurpAnswersAiFan(
      aiFanTrigger,
      (await messagesStore.listMessages(thread.id, 120)).some(
        (message: SlurpMessage) => message.senderAccountId === thread.creatorAccountId,
      ),
    ),
  );
  const viewer = aiFan ? await resolveSlurpReplyViewer(db, thread, creator, true) : listedViewer;
  // A persona-backed Creator is operated by hand: it never auto-posts and it never answers a DM
  // on its own either. The operator writes the answer through the draft-reply route.
  if (!creator || !viewer || (creator.kind === "persona" && creator.sourceKind === "persona" && !input.operatorDraft)) {
    // No automatic reply can ever come, so the thread must stop taking one of the scheduler's
    // oldest-first slots. Left set, these starved every newer thread the player was waiting on.
    if (input.background) await messagesStore.clearReplyObligation(thread.id);
    return { status: "ineligible" };
  }

  // Nothing outranks a boundary. A creator who has walked away from this conversation has walked
  // away from it, whatever the rapport, the schedule or the tone dial say.
  if (thread.coolUntil && thread.coolUntil > new Date().toISOString()) {
    return { status: "cooling", until: thread.coolUntil };
  }
  // Busy in a scene, with this fan or another: nothing is answered until it ends.
  if (await slurpCreatorInScene(db, creator.id)) return { status: "in_scene" };

  // The same availability the Prompt details view reads (R1-011).
  const {
    settings: settingsForDelays,
    replyDelays,
    source,
    details,
    availability,
  } = await resolveSlurpReplyAvailability(db, thread, creator);

  const history = await messagesStore.listMessages(thread.id, 60);
  const trigger = history.find((message) => message.id === input.triggerMessageId);
  if (!trigger) return { status: "ineligible" };

  // Momentum is how recently she was in this conversation. `thread.lastMessageAt` is the fan's own
  // message from a moment ago, which made every live reply "hot" and froze mood recovery.
  const lastCreatorMessageAt =
    history.filter((message) => message.role === "creator" && message.createdAt <= (trigger?.createdAt ?? "~")).at(-1)
      ?.createdAt ?? new Date(0).toISOString();
  const momentumAnalysis = calculateConversationMomentum(
    lastCreatorMessageAt,
    history.map((m) => ({ role: m.role as "viewer" | "creator", createdAt: m.createdAt })),
  );

  // The reply and delivery windows are bounded (five and ten minutes) and expire on their own.
  // Never clear an active window before the reply outcome: queued, busy, connection_not_found,
  // and failed paths return before keepOnlineFor, and a cleared window would strand the fan.
  // A successful reply replaces the window afterward, so nothing here needs to be removed.

  // Momentum can extend the stored conversation window, but it must not override a schedule that
  // says the Creator is offline. Only an online Creator can open or extend that window.

  // REMOVED: Busy check for pending replies - let fans send during Creator typing
  // if (await replyQueue.hasPending(thread.id)) return { status: "busy" };

  // A request can receive one guarded first answer. Storing that Creator answer promotes the
  // thread to active, because replying is itself a clear acceptance; after that, schedule and
  // subscription shape pacing and tone but cannot strand an already-started conversation.
  const isRequest = thread.state === "request";
  if (isRequest && history.some((message) => message.role === "creator")) return { status: "ineligible" };
  const triggerObligationCreatedAt = trigger?.createdAt ?? new Date().toISOString();
  const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
  const subscribed = subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId);

  // The generated Conversation Schedule carries how chatty this Creator is.
  const talkativenessProfile = readTalkativenessProfile(
    source ? await resolveSlurpCreatorScheduleTraits(createCharactersStorage(db), source) : null,
  );

  // Calculate mood with recovery (but pause recovery if hot conversation + negative mood)
  const minutesSinceMoodUpdate = thread.moodUpdatedAt
    ? Math.max(0, (Date.now() - Date.parse(thread.moodUpdatedAt)) / 60_000)
    : 0;

  let currentMood = thread.mood;
  if (!shouldPauseMoodRecovery(momentumAnalysis.momentum, thread.mood)) {
    currentMood = recoverSlurpMood(thread.mood, minutesSinceMoodUpdate);
  }

  const pacing = slurpReplyPacing({
    online: availability.online,
    rapport: thread.rapport,
    subscribed,
    messageLength: trigger?.content.length ?? 0,
    minutesUntilOnline: availability.minutesUntilOnline,
    mood: currentMood,
    momentum: momentumAnalysis.momentum,
    // replyLength will be filled in after generation
    talkativeness: talkativenessProfile.talkativeness,
    delays: replyDelays,
    firstContact: !history.some((message) => message.role === "creator"),
  });
  const completedReplyId = await messagesStore.getCompletedReply(thread.id, input.triggerMessageId);
  if (completedReplyId) {
    const completedReply = await messagesStore.getMessageById(completedReplyId);
    if (completedReply) return { status: "replied", message: completedReply, pacing };
  }
  if ((pacing.mode === "queued" || pacing.mode === "delayed") && input.force !== true) {
    // A wait already running is kept. Each new fan message used to restart it, so a fan who kept
    // writing never got an answer until they stopped.
    const running = thread.needsReply && thread.replyNotBeforeAt && thread.replyNotBeforeAt > new Date().toISOString();
    if (!running) {
      await messagesStore.setReplyNotBefore(thread.id, new Date(Date.now() + pacing.notBeforeMs).toISOString());
    }
    // She has seen it and is not answering yet. That is the whole meaning of a queued reply, and
    // it was indistinguishable from the app being broken because nothing recorded the noticing.
    // "Seen, no reply" is the loudest thing this surface can say, and the timestamp already exists.
    // Mark read with slight delay for realism (not instant)
    setTimeout(
      () => {
        messagesStore.markRead(thread.id, "creator").catch((err) => {
          logger.error(err, "[slurp-message] Failed to mark thread %s as read", thread.id);
        });
      },
      Math.round(5000 + Math.random() * 25000),
    ); // 5-30 seconds
    // With "Answer while you are away" off nothing answers a queued message later, so it must not
    // promise that; "owed" keeps "Get reply now" on screen (R1-014).
    if (!input.background && !settingsForDelays.messagesAwayRepliesEnabled) return { status: "owed" };
    return { status: "queued", pacing };
  }

  const claim = await messagesStore.claimReply(thread.id, input.triggerMessageId, thread.creatorAccountId);
  if (claim.status === "completed") {
    const completedReply = await messagesStore.getMessageById(claim.messageId);
    return completedReply ? { status: "replied", message: completedReply, pacing } : { status: "busy" };
  }
  if (claim.status !== "claimed") return { status: "busy" };
  const release = async () => {
    try {
      await messagesStore.releaseReplyClaim(claim.claimId);
    } catch (error) {
      logger.error(error, "[slurp-message] Failed to release the reply claim %s", claim.claimId);
    }
  };

  try {
    const locked = await tryCreatorAccountOperation(thread.creatorAccountId, async () => {
      const settings = await slurp.getSettings();
      // "Pause all": the reply waits, and the player hears "AI replies are off", as with the budget off.
      if (settings.paused) throw new SlurpMessageBudgetUnavailableError(null);
      const connection = await resolveSlurpTextConnection(
        createConnectionsStorage(db),
        settings.modelBudget.connectionId ?? settings.generationConnectionId,
      );
      if (!connection) return { status: "connection_not_found" } as const;
      const messaging = await messagesStore.getCreatorMessaging(thread.creatorAccountId);
      const creatorState = await slurp.getCreatorState(thread.creatorAccountId);
      const reply = await generateSlurpMessageReply({
        db,
        creator,
        viewer,
        history,
        rapport: thread.rapport,
        subscribed,
        dmPolicy: messaging.dmPolicy,
        isRequest,
        mood: thread.mood,
        moodUpdatedAt: thread.moodUpdatedAt,
        notes: thread.notes,
        threadId: thread.id,
        threadState: thread.threadState,
        creatorState,
        dayVibe:
          details.dayVibe !== undefined ? details.dayVibe : await describeSlurpDayVibe(db, thread.creatorAccountId),
        coolingOff: false,
        strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
        connection,
        availability,
        debugMode: input.debugMode,
        generationGuidance: input.generationGuidance,
        // The scheduler only calls with `force` after `messagesAwayRepliesEnabled` admitted this
        // thread. That setting is the explicit permission for an unattended reply. Requiring the
        // separate global background-worker switch as well made the default settings contradictory:
        // audience messages arrived, but no Creator could answer them.
        workerContext: "present",
        skipBudgetCap: input.force === true && input.background !== true,
        // Only the scheduler's unattended answers are budgeted upkeep.
        playerSend: input.background !== true,
      });
      // Two or three messages when the conversation is going well, one when it is not. A creator
      // who always answers in exactly one tidy block reads as a form letter.
      // Settings caps the burst, energy still decides whether it earns the top of that cap. A limit
      // of one is a player asking for the tidy block instead of the texting rhythm. The top is the
      // setting itself: a fixed 3 here made the stepper's 4 a value that never applied.
      const burstLimit = Math.min(settings.messagesReplyBubbleLimit, creatorState.energy >= 70 ? Infinity : 2);
      const shouldSplit = allowMultiBubbleSplit(talkativenessProfile.talkativeness, currentMood);
      const bubbles = splitSlurpReplyBurst(
        reply.content,
        burstLimit > 1 &&
          shouldSplit &&
          creatorState.energy >= 35 &&
          reply.latitude === "normal" &&
          reply.moodShift !== "down",
        burstLimit,
      );
      // The first bubble shows after its typing indicator, so the later ones wait for it as well.
      // Unattended replies have no indicator on screen.
      const firstPacing = slurpReplyPacing({
        online: availability.online,
        rapport: thread.rapport,
        subscribed,
        messageLength: trigger?.content.length ?? 0,
        minutesUntilOnline: availability.minutesUntilOnline,
        mood: currentMood,
        momentum: momentumAnalysis.momentum,
        replyLength: bubbles[0]!.length,
        talkativeness: talkativenessProfile.talkativeness,
        delays: replyDelays,
        firstContact: !history.some((message) => message.role === "creator"),
      });
      const typingLeadMs = input.background ? 0 : firstPacing.typingMs;
      let stored = null;
      const queuedBubbles = [];
      for (const [index, bubble] of bubbles.entries()) {
        if (index === 0) continue;
        const delayMs = bubbles.slice(1, index + 1).reduce(
          (total, _, offset) =>
            total +
            slurpReplyBubbleDelayMs({
              bubbleIndex: offset + 1,
              bubbleCount: bubbles.length,
              previousBubble: bubbles[offset],
              nextBubble: bubbles[offset + 1]!,
              momentum: momentumAnalysis.momentum,
              mood: currentMood,
            }),
          0,
        );
        queuedBubbles.push({
          batchId: claim.claimId,
          sequence: index,
          threadId: thread.id,
          senderAccountId: thread.creatorAccountId,
          content: bubble,
          deliverAt: new Date(Date.now() + typingLeadMs + delayMs).toISOString(),
          generationEpoch: thread.generationEpoch,
          createdAt: triggerObligationCreatedAt,
        });
      }
      stored = await messagesStore.appendReplyBatch(thread.id, {
        first: { id: claim.claimId, senderAccountId: thread.creatorAccountId, content: bubbles[0] },
        delayed: queuedBubbles.map((bubble) => ({ ...bubble, id: `${claim.claimId}:${bubble.sequence}` })),
      });
      if (!stored) return { status: "ineligible" } as const;
      // Never echo a post already shared in this conversation: the creator used to send back the very
      // post the fan had just shared, as if it were news.
      const alreadyShared =
        reply.sharedPost &&
        history
          .slice(-12)
          .some((message) => message.kind === "post_preview" && message.metadata?.postId === reply.sharedPost!.id);
      // Staff are not sold to: no shared posts and no pictures in Support's thread.
      if (reply.sharedPost && !alreadyShared && !support) {
        const postAccess = reply.sharedPost.access === "locked" ? "locked" : "public";
        const previewLocked =
          postAccess === "locked" ||
          (reply.sharedPost.access !== "public" && thread.rapport.tier !== "whale" && !subscribed);
        const sharedMetadata = (await slurp.getNoodlerPostById(reply.sharedPost.id))?.metadata as
          Record<string, unknown> | undefined;
        const sharedSize = slpStoredMediaSize(sharedMetadata?.noodlerMediaPath);
        stored =
          (await messagesStore.appendMessage(thread.id, {
            senderAccountId: thread.creatorAccountId,
            role: "creator",
            kind: "post_preview",
            content: reply.sharedPost.title || reply.sharedPost.content.slice(0, 180),
            imageUrl: reply.sharedPost.imageUrl,
            metadata: {
              postId: reply.sharedPost.id,
              title: reply.sharedPost.title,
              content: reply.sharedPost.content,
              access: reply.sharedPost.access,
              previewLocked,
              shareReason: reply.sharePost !== undefined ? "relevant" : "tease",
              // The chat shows it as a real post card: whose it is and what unlocking costs.
              authorAccountId: creator.id,
              authorName: creator.displayName,
              authorHandle: creator.handle,
              authorAvatarUrl: creator.avatarUrl ?? null,
              price: slpCreatorUnlockPriceFromMetadata(sharedMetadata),
              // The card reserves the post's own picture ratio (V).
              ...(sharedSize ? { imageWidth: sharedSize.width, imageHeight: sharedSize.height } : {}),
            },
          })) ?? stored;
      }
      // Support's "photo, right now": always a free picture, even when the model forgot to add one.
      const demanded = support && isSlurpSupportPhotoDemand(trigger);
      const image = reply.image ?? (demanded ? slurpSupportPhotoFallback(trigger?.content ?? "") : null);
      if (
        image &&
        (demanded ||
          (reply.canSendImage &&
            !support &&
            // An AI fan gets words only: a picture needs the image budget the world does not spend on them.
            !aiFan &&
            slurpCreatorStateCanUseMedia(creatorState, thread.threadState)))
      ) {
        // A delayed ("away") reply draws too. The scheduler only ever answers the player's own
        // message, so the player asked; blocking it meant most chats never got a picture or a PPV
        // (0 in a 7-day simulation). The reply itself already passed the AI budget.
        // The Creator's own Images switch, the one its posts use. The old gate read
        // `enableImagePrompts`, an internal flag with no control that is off on every install, so
        // no Creator ever sent a picture in a chat (R1-122). No image connection → "unavailable".
        const imageAllowedBySettings = demanded || creator.settings.scheduler.autoPosting?.imagesEnabled === true;
        // Decided before the picture: a paid (PPV) picture goes as far as the Creator does, a free
        // one to somebody who has not subscribed stays a tease.
        // Her partner (or after a fight, still her partner) gets it free, as far as she goes.
        const partner = ["partner", "rocky"].includes(slurpRapportPartner(thread.rapport) ?? "");
        const offer = resolveSlurpMediaOffer({
          intent: reply.imageMode === "hostile" ? "hostile" : "friendly",
          rapportTier: thread.rapport.tier,
          subscribed,
          configuredPrice: messaging.ppvPrice,
          spicy: slurpDmPictureSpicy(image),
          partner,
        });
        const creatorLevel = await resolveSlurpExplicitLevel(db, thread.creatorAccountId).catch(
          () => "suggestive" as const,
        );
        const drawn = imageAllowedBySettings
          ? await generateSlurpCommissionImage(db, {
              creatorAccountId: thread.creatorAccountId,
              brief: `${image.prompt}\nImage mode: ${reply.imageMode}`,
              // A free picture stays a tease (a subscriber's casual one too); a paid one goes as far as the Creator does.
              level: (offer.price > 0 || partner) && !demanded ? creatorLevel : slurpDmSpiceLevel(creatorLevel, false),
            })
          : "unavailable";
        if (drawn !== "unavailable") {
          const price = demanded ? 0 : offer.price;
          const imageMessage = await messagesStore.appendMessage(thread.id, {
            senderAccountId: thread.creatorAccountId,
            role: "creator",
            kind: price > 0 ? "ppv" : "text",
            content: image.caption ?? "",
            price,
            unlockedAt: price > 0 ? null : new Date().toISOString(),
            metadata: {
              noodlerMediaPath: drawn.mediaPath,
              generatedContext: reply.imageMode,
              imagePrompt: image.prompt,
            },
          });
          if (!imageMessage) {
            drawn.compensate();
          } else {
            drawn.promote();
            await messagesStore.setMessageMedia(
              imageMessage.id,
              slurpMessageMediaUrl(imageMessage.id),
              drawn.mediaPath,
            );
            stored = imageMessage;
          }
        }
      }
      // After the message is safely stored. The conversation's mood and what she now knows are
      // worth keeping, but never at the price of the reply itself.
      // A reply to Slurp Support (the player writing as Slurp's staff) says nothing about the fan: it
      // must not move their mood, memories or relationship.
      if (stored && trigger.metadata?.supportVoice !== true) {
        await messagesStore
          .recordReplyOutcome(thread.id, {
            moodShift: reply.moodShift,
            remember: reply.remember,
            stateSignals: reply.stateSignals,
          })
          .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not record the reply outcome"));
      }
      // Support's own thread: the talk may change the Creator (mood, focus, plans, memory), never a fan.
      if (stored && support) {
        await applySlurpSupportTalk(slurpSupportTalkStore(db, creator), {
          thread,
          trigger,
          reply: stored,
          outcome: { moodShift: reply.moodShift, remember: reply.remember, stateSignals: reply.stateSignals },
          staff: reply.staff,
          supportName: viewer.displayName,
        }).catch((error: unknown) => logger.warn(error, "[slurp-message] Could not apply the talk with Slurp Support"));
        // The desk: trust, an Offer's answer, intel, a ticket rating (docs/SUPPORT-DESK.md).
        await applySlurpDeskTalk(db, {
          threadId: thread.id,
          creatorAccountId: thread.creatorAccountId,
          replyId: stored.id,
          desk: reply.desk,
        }).catch((error: unknown) => logger.warn(error, "[slurp-message] Could not apply the desk talk"));
      }
      // Two pages agreed on a joint post in this chat: the replying Creator hosts it (7b-c).
      if (stored && reply.agreedCollab)
        await agreeSlurpCollabInDm(db, { hostId: thread.creatorAccountId, ...reply.agreedCollab }).catch(
          (error: unknown) => logger.warn(error, "[slurp-message] Could not record the collab agreed in this chat"),
        );
      // Her pitch for a roleplay scene, as a card under her reply (docs/SCENES.md).
      if (stored && reply.sceneInvite)
        await messagesStore
          .appendMessage(thread.id, {
            senderAccountId: thread.creatorAccountId,
            role: "creator",
            kind: "system",
            content: reply.sceneInvite,
            metadata: { scene: { kind: "invite", pitch: reply.sceneInvite, state: "open" } },
            preserveReplyObligation: true,
          })
          .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not store the scene invite"));
      // With the player: the talk moved the two of them (a crush, dating, official, a fight, making up).
      if (stored && reply.us && reply.usPageId)
        await applySlurpPlayerUs(db, {
          creatorId: thread.creatorAccountId,
          pageId: reply.usPageId,
          step: reply.us.step,
          why: reply.us.why,
        }).catch((error: unknown) =>
          logger.warn(error, "[slurp-message] Could not apply what the talk did to the couple"),
        );
      if (stored && aiFan) await dropSlurpPendingText(db, input.triggerMessageId);
      if (stored) {
        // Whoever just answered is, for the next few minutes, obviously around: every reply keeps
        // her online briefly, and a hot conversation keeps her longer.
        const hotDuration =
          momentumAnalysis.momentum === "hot" && availability.online
            ? extendedOnlineDurationMinutes(momentumAnalysis.momentum, thread.rapport.score)
            : null;
        await messagesStore
          .keepOnlineFor(thread.id, Math.max(SLURP_ONLINE_AFTER_REPLY_MINUTES, hotDuration ?? 0))
          .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not set extended online duration"));

        // Handle follow-up scheduling if AI signaled intent
        if (reply.followUp) {
          try {
            const { createScheduledFollowUps } = await import("../../modules/messages/slp-follow-up.js");

            // Link the follow-up to the promise note the reply just wrote. The note IDs only
            // exist after `recordReplyOutcome` applied the operations, so read the thread again.
            let relatedNoteId: string | undefined;
            if (reply.followUp.type === "promise_delivery" || reply.followUp.type === "task_update") {
              const { findPromiseNotes } = await import("../../modules/messages/slp-thread-notes.js");
              const refreshed = await messagesStore.getThreadById(thread.id);
              relatedNoteId = findPromiseNotes(refreshed?.notes ?? []).at(-1)?.id;
            }

            const followUps = createScheduledFollowUps(
              {
                type: reply.followUp.type,
                timing: reply.followUp.timing,
                count: reply.followUp.count ?? 1,
                reason: reply.followUp.reason,
                context: reply.followUp.context,
              },
              new Date(),
              relatedNoteId,
            );

            await messagesStore.addScheduledFollowUps(thread.id, followUps);
            logger.info(
              "[slurp-message] Scheduled %d follow-up(s) for thread %s: %s",
              followUps.length,
              thread.id,
              reply.followUp.reason,
            );
          } catch (error: unknown) {
            logger.warn(error, "[slurp-message] Could not schedule follow-ups");
          }
        } else {
          // Fallback: detect promises from natural language if AI didn't signal
          try {
            const { detectPromiseFromText, createScheduledFollowUps } =
              await import("../../modules/messages/slp-follow-up.js");
            const detected = detectPromiseFromText(reply.content);
            // One pending follow-up per kind is enough; every matching reply used to add another.
            if (detected && !thread.scheduledFollowUps.some((followUp) => followUp.type === detected.type)) {
              const followUps = createScheduledFollowUps(
                {
                  type: detected.type,
                  timing: detected.timing,
                  count: 1,
                  reason: detected.reason,
                  context: "Auto-detected from message content",
                },
                new Date(),
                undefined,
              );
              await messagesStore.addScheduledFollowUps(thread.id, followUps);
              logger.info("[slurp-message] Auto-detected promise in thread %s: %s", thread.id, detected.reason);
            }
          } catch (error: unknown) {
            logger.warn(error, "[slurp-message] Could not auto-detect promise");
          }
        }

        // The signals say what a fan did, and Support is not a fan. Nor can a Creator shut the
        // platform's staff out of their inbox.
        if (!support)
          await slurp
            .recordCreatorStateSignals(thread.creatorAccountId, reply.stateSignals)
            .catch((error: unknown) => logger.warn(error, "[slurp-message] Could not record creator state signals"));
        // The reply is written first and the boundary applied after it, so the fan always receives
        // the words the creator actually left them with rather than silence.
        if (!support)
          await applyBoundary(messagesStore, thread.id, reply.latitude, settings.messagesCoolOffMinutes).catch(
            (error: unknown) => logger.warn(error, "[slurp-message] Could not apply the conversation boundary"),
          );
        if (!support && (reply.latitude === "cool_off" || reply.latitude === "close")) {
          const events = createSlurpEventsStorage(db);
          const operator = creator.sourceKind === "persona" ? creator.sourceEntityId : null;
          if (operator) {
            await events.recordAndPrune({
              recipientPersonaId: operator,
              kind: "message",
              creatorAccountId: creator.id,
              subjectId: thread.id,
              actorLabel: viewer.displayName,
            });
          }
        }
      }
      return stored
        ? ({ status: "replied", message: stored, pacing: firstPacing } as const)
        : ({ status: "ineligible" } as const);
    });
    // The account lock is already held by another Slurp operation on this creator. Nothing was
    // generated, so the caller may simply try again rather than treat this as a failure.
    if (!locked.acquired) return { status: "busy" };
    return locked.value;
  } catch (error) {
    if (error instanceof SlurpMessageBudgetUnavailableError) {
      // Only the scheduler backs itself off. A player pressing the button must never push their own
      // reply an hour further away by pressing it again.
      const retryAt = error.retryAt ?? (input.background ? new Date(Date.now() + 60 * 60_000).toISOString() : null);
      if (retryAt) {
        await messagesStore.setReplyNotBefore(thread.id, retryAt);
        // Said plainly to the player: "away" hid that the AI budget, not the Creator, was the reason.
        return input.background ? { status: "queued", pacing } : { status: "budget", retryAt, pacing };
      }
      // Its own status: "X is not answering this conversation" blamed the Creator (R1-013).
      return { status: "ai_off" };
    }
    logger.error(error, "[slurp-message] Reply generation failed for thread %s", thread.id);
    return { status: "failed", error: error instanceof Error ? error.message : "Reply generation failed." };
  } finally {
    await release();
  }
}

/** Support's talk, written through the real stores: Support's thread, the steering, the continuity. */
function slurpSupportTalkStore(
  db: DB,
  creator: SlpAccount & { sourceKind?: string | null; sourceEntityId?: string | null },
): SlurpSupportTalkStore<Parameters<ReturnType<typeof createSlurpMessagesStorage>["recordReplyOutcome"]>[1]> {
  return {
    recordThreadOutcome: (threadId, outcome) => createSlurpMessagesStorage(db).recordReplyOutcome(threadId, outcome),
    readSteering: (creatorAccountId) => readSlurpCreatorSteering(db, creatorAccountId),
    // W: the reply carries the plan; the thread shows it as Stir cards to confirm. A world wish is
    // planned once here (the "Plans" row), so the cards never cost a call when the thread is read.
    propose: async (replyMessageId, proposal) => {
      const planned = proposal.stir
        ? await planSlpStir(db, { text: proposal.stir, creatorId: creator.id }).catch(() => null)
        : null;
      const extra = planned?.ok ? planned.value.cards.map((card) => ({ action: card.action, input: card.input })) : [];
      await createSlurpMessagesStorage(db).mergeMessageMetadata(replyMessageId, {
        stirProposal: {
          steps: [...proposal.steps, ...extra],
          cant: planned?.ok ? planned.value.cant : [],
          playId: null,
        },
      });
    },
    hasMemory: async (creatorAccountId, sourceHash) =>
      Boolean(await findSlurpContinuityFactBySourceHash(db, creatorAccountId, sourceHash)),
    // The Creator's own private memory: read by their posts and every chat, never tied to one fan.
    addMemory: async (_creatorAccountId, memory) => {
      const identity = slurpContinuityIdentityOf(creator);
      if (!identity) return;
      await createSlurpContinuityFact(db, {
        ...identity,
        factType: "circumstance",
        text: memory.text,
        audienceScope: "creator_private",
        realityScope: "slurp",
        threadId: memory.threadId,
        source: "slurp_message",
        evidence: memory.evidence,
        sourceHash: memory.sourceHash,
        contribution: "generated",
      });
    },
  };
}

/**
 * Act on what the creator decided.
 *
 * `normal` and `curt` are tone and need nothing done to the thread: the words already carry them.
 * The other two change the thread's state, and only `slurp-stance.ts` can produce them — which is
 * where the tone dial caps what is reachable at all.
 */
async function applyBoundary(
  messagesStore: ReturnType<typeof createSlurpMessagesStorage>,
  threadId: string,
  latitude: SlurpStanceLatitude,
  coolOffMinutes: number,
): Promise<void> {
  if (latitude === "cool_off") {
    await messagesStore.beginCoolOff(threadId, coolOffMinutes / 60);
    return;
  }
  if (latitude === "close") await messagesStore.closeThreadByCreator(threadId);
}
