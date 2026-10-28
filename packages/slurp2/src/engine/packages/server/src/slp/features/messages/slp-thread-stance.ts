/**
 * The inputs a Creator's DM reply is built from, in one place, so every reader asks the same
 * question the reply does.
 *
 * The thread route used to re-derive "Pictures" from the mood and the Details panel "blocked by"
 * from its own thresholds (R1-012), and the Prompt details view built its prompt from a different
 * connection, availability and strike count than the reply (R1-011). Each now reads these helpers,
 * which the reply operation and `buildSlurpMessagePrompt` read too.
 */
import type { DB } from "../../../db/connection.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createSlurpStorage, createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { resolveSlurpCreatorAvailability } from "../../modules/creators/slp-creator-schedule-context.js";
import { type SlurpAccount } from "../../modules/records/slp-storage-model.js";
import type { SlurpRapport } from "../../modules/messages/slp-rapport.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";
import { recoverSlurpMood, slurpMoodTone } from "../../modules/world/slp-mood.js";
import { resolveSlurpStance, type SlurpStance } from "../../modules/world/slp-stance.js";
import { slurpAudienceArcDescription } from "../../modules/projects/slp-audience-arc.js";
import { slurpArcLifeLine } from "../../modules/projects/slp-arc-progress.js";
import { readSlurpAudienceTone } from "../../../../../shared/src/slp/slp-tone.js";
import { slurpInfluenceMultiplier } from "../../../../../shared/src/slp/slp-platform-events.js";
import { protectCreatorGeneratedIdentity, resolveNoodlerPublicIdentity } from "../feed/slp-feed-contract.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";
import { emptySlpAccountSettings } from "../../modules/records/slp-storage-model.js";
import { SLURP_SUPPORT_NAME } from "../../modules/messages/slp-dm-roles.js";
import { isSlurpSupportThread } from "../../modules/messages/slp-support.js";
import { slpArcsLive, slpLiveEvents } from "../../../../../shared/src/slp/slp-extensions.js";

type SlurpThread = NonNullable<Awaited<ReturnType<ReturnType<typeof createSlurpMessagesStorage>["getThreadById"]>>>;
export type SlurpThreadDetails = Awaited<
  ReturnType<ReturnType<typeof createSlurpMessagesStorage>["getDetailsOverrides"]>
>;

/**
 * Whether the Creator is around to answer, the way the reply operation decides it: the schedule
 * with the reply-delay occasions applied, an open conversation window, then the Details overrides.
 */
export async function resolveSlurpReplyAvailability(db: DB, thread: SlurpThread, creator: SlurpAccount) {
  const slurp = createSlurpStorage(db);
  const settingsForDelays = await slurp.getSettings();
  // Occasions may slow or speed replies ("messages.reply-delay"); the editor offered it, nothing read it.
  const replyDelays = {
    ...settingsForDelays,
    // 0 means "always answer right away" and stays 0; the old floor of 1 queued the reply (R1-004).
    messagesMaxReplyDelayMinutes:
      settingsForDelays.messagesMaxReplyDelayMinutes <= 0
        ? 0
        : Math.max(
            1,
            Math.round(
              settingsForDelays.messagesMaxReplyDelayMinutes *
                slurpInfluenceMultiplier(
                  slpLiveEvents(settingsForDelays),
                  new Date(),
                  "messages.reply-delay",
                  await slurp.platformInfluenceStory(creator.id),
                ),
            ),
          ),
  };
  const source = await slurp.resolveAccountSource(creator);
  const latestPost = await slurp.getNoodlerLatestPublishedPost(creator.id);
  const scheduled = source
    ? await resolveSlurpCreatorAvailability(
        createCharactersStorage(db),
        source,
        undefined,
        new Date(),
        latestPost?.createdAt ?? null,
        replyDelays,
      )
    : { online: true, activity: null, minutesUntilOnline: 0 };
  // An open conversation window keeps the Creator online; momentum alone never wakes her.
  const details = await createSlurpMessagesStorage(db).getDetailsOverrides(thread.id);
  const naturalAvailability =
    thread.extendedOnlineUntil && thread.extendedOnlineUntil > new Date().toISOString()
      ? { online: true, activity: "chatting", minutesUntilOnline: 0 }
      : scheduled;
  return {
    settings: settingsForDelays,
    replyDelays,
    source,
    details,
    availability: { ...naturalAvailability, ...details.availability },
  };
}

/** How the Creator stands in this conversation right now: the one position the reply is written from. */
export async function resolveSlurpThreadStance(
  db: DB,
  input: {
    creator: SlurpAccount;
    viewerId: string;
    rapport: SlurpRapport;
    mood: number | undefined;
    moodUpdatedAt: string | null | undefined;
    dayVibe: string | null | undefined;
    availability: { online: boolean; activity: string | null };
    subscribed: boolean;
    isRequest: boolean;
    coolingOff: boolean | undefined;
    strikes: number | undefined;
    details: SlurpThreadDetails;
    settings: SlurpSettings;
    /** Her partner is writing (`slurpCoupleDmPage`). */
    partner?: boolean;
  },
): Promise<SlurpStance> {
  const slurp = createSlurpStorage(db);
  const { details, settings } = input;
  const tie = await createSlurpPopulationStorage(db)
    .listTiesForCreator(input.creator.id)
    .then((ties) => ties.find((entry) => entry.memberId === input.viewerId))
    .catch(() => undefined);
  // The arc the feed is posting about, so a DM and the feed come from the same life. Protected like
  // every other supplied value: a Secret Creator's arc title can name a real place.
  const creatorArc =
    settings.arcAffectsMood && slpArcsLive(settings)
      ? (protectCreatorGeneratedIdentity(
          slurpArcLifeLine(await slurp.listProjects(input.creator.id).catch(() => [])),
          input.creator.settings.privacy.identityDisclosure ?? "open",
          await resolveNoodlerPublicIdentity(db, input.creator),
        ) ?? null)
      : null;
  const stance = resolveSlurpStance({
    rapportTier: input.rapport.tier,
    rapportScore: input.rapport.score,
    // Healed for the time since it was last written, so a fan who returns a day later is not
    // answered through yesterday's argument.
    moodTone: slurpMoodTone(
      recoverSlurpMood(
        input.mood ?? 0,
        input.moodUpdatedAt ? Math.max(0, (Date.now() - Date.parse(input.moodUpdatedAt)) / 60_000) : 0,
      ),
    ),
    audienceArc: tie ? slurpAudienceArcDescription(tie.audienceArc) : null,
    creatorArc,
    dayVibe: details.dayVibe !== undefined ? details.dayVibe : (input.dayVibe ?? null),
    availability: input.availability,
    subscribed: input.subscribed,
    isRequest: input.isRequest,
    // The audience dial reaches private chat for the first time. It governed comments and
    // reactions only, so a maintainer who chose `unfiltered` still met a uniformly
    // accommodating creator in every DM.
    tone: details.audienceTone ?? readSlurpAudienceTone(settings.audienceTone),
    coolingOff: input.coolingOff ?? false,
    strikes: input.strikes ?? 0,
    partner: input.partner,
  });
  if (details.imageMode !== undefined && !input.coolingOff) {
    stance.imageMode = details.imageMode;
    stance.canSendImage = details.imageMode !== "none";
  }
  return stance;
}

/**
 * Who the reply answers: the persona, Slurp Support in its own thread, or, for a Creator the player
 * drafts for, the audience member who wrote. The Prompt details view reads this too; with
 * `getViewer` alone it answered only for persona fans, which a player-run Creator rarely has (R1-011).
 */
export async function resolveSlurpReplyViewer(
  db: DB,
  thread: SlurpThread,
  creator: SlpAccount | null,
  operatorDraft: boolean,
): Promise<SlpAccount | null> {
  const personaViewer = await createSlurpStorage(db).getViewer(thread.viewerAccountId);
  if (personaViewer) return personaViewer;
  if (isSlurpSupportThread(thread)) return slurpSupportAccount(SLURP_SUPPORT_NAME);
  // A hand-operated Creator's fans are audience members, not personas. The draft still needs them
  // as the one being answered; `getViewer` alone made every draft for them ineligible.
  return operatorDraft && creator ? resolveAudienceFanAccount(db, thread.viewerAccountId, creator) : null;
}

/** Support as the one the Creator is talking to. Not a persona and not a fan: no page, no wallet. */
function slurpSupportAccount(name: string): SlpAccount {
  return {
    id: SLURP_SUPPORT_ACCOUNT_ID,
    // `random_user` keeps every "does this person run a Creator page" lookup away from it.
    kind: "random_user",
    entityId: SLURP_SUPPORT_ACCOUNT_ID,
    handle: "slurpsupport",
    displayName: name,
    bio: "",
    avatarUrl: null,
    avatarCrop: null,
    invited: false,
    settings: emptySlpAccountSettings() as SlpAccount["settings"],
    platform: "slurp",
    noodleAccountId: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** An audience member or ambient account, shaped as the account the reply prompt reads. */
async function resolveAudienceFanAccount(db: DB, fanId: string, creator: SlpAccount): Promise<SlpAccount | null> {
  const account = await createSlurpStorage(db).getNoodlerAccountById(fanId);
  if (account) return account;
  const member = await createSlurpPopulationStorage(db)
    .get(fanId)
    .catch(() => null);
  if (!member) return null;
  // ponytail: borrows the Creator's settings and platform for the fields no prompt reads.
  return {
    ...creator,
    id: member.id,
    kind: "random_user",
    entityId: member.id,
    handle: member.handle,
    displayName: member.displayName,
    bio: "",
    avatarUrl: null,
    avatarCrop: null,
    invited: false,
    noodleAccountId: null,
  };
}
