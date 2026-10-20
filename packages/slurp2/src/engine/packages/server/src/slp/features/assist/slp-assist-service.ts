import type { APIProvider } from "@marinara-engine/shared";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { readFileSync } from "node:fs";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import {
  stageCreatorAvatar,
  stageCreatorBanner,
  unlinkCreatorAvatar,
  unlinkCreatorBanner,
} from "../../base/identity/slp-avatar.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import { resolveCreatorMediaAbsolutePath, unlinkCreatorMedia } from "../../base/media/slp-media.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { resolveSlurpCreatorFlavour } from "../../data/creators/slp-flavour-source.js";
import { resolveSlurpCreatorSpice, type SlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpPublicSexualLevel } from "../../modules/feed/slp-post-guidance.js";
import {
  slurpImageNegativePrompt,
  slurpImageNegativeTerms,
  slurpLevelPhoto,
} from "../../modules/feed/slp-image-brief.js";
import {
  buildSlpAssistTextMessages,
  cleanSlpAssistText,
  slpAssistPictureDraft,
} from "../../modules/assist/slp-assist-prompt.js";
import { createSlpPictureUndo } from "../../modules/assist/slp-picture-undo.js";
import { generateCreatorPostImage } from "../media/slp-media-contract.js";
import {
  generateCreatorPost,
  protectCreatorGeneratedIdentity,
  slpCreatorPublicIdentityFor,
} from "../feed/slp-feed-contract.js";
import { slurpProjectChapter } from "../../modules/projects/slp-arc-progress.js";
import { SLP_CREATOR_POST_GUIDE_MAX_LENGTH } from "../../../../../shared/src/slp/slp-social.schema.js";
import { artworkCompositionGuard, artworkNegativePrompt } from "../creators/slp-creators-contract.js";
import { SLP_ASSIST_FIELDS, type SlpActionParsed } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpActionResult } from "../../../../../shared/src/slp/slp-action-results.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";

export type SlpAssistFailure = { ok: false; status: 400 | 404 | 409 | 429 | 502; error: string };
export type SlpAssistOutcome<T> = { ok: true; value: T } | SlpAssistFailure;

const fail = (status: SlpAssistFailure["status"], error: string): SlpAssistFailure => ({ ok: false, status, error });

/** The Creator a request is for, with the parts every assist path reads. Null when it does not exist. */
async function creatorFor(db: DB, accountId: string | undefined) {
  if (!accountId) return null;
  const storage = createSlurpStorage(db);
  const account = await storage.getNoodlerAccountById(accountId);
  if (!account) return null;
  return { account, source: await storage.resolveAccountSource(account) };
}

/**
 * The Creator's flavour brief (7b0) for an assist prompt. A concealed Creator keeps their voice: the
 * brief is read at their own disclosure level and protected here, because these prompts have no
 * identity protection of their own (the same pass as the scene plan).
 */
async function protectFor(
  db: DB,
  creator: NonNullable<Awaited<ReturnType<typeof creatorFor>>>,
  value: string | null | undefined,
): Promise<string> {
  const disclosureMode = creator.account.settings.privacy.identityDisclosure ?? "open";
  return (
    protectCreatorGeneratedIdentity(value, disclosureMode, await slpCreatorPublicIdentityFor(db, creator.source)) ?? ""
  );
}

async function briefFor(
  db: DB,
  creator: NonNullable<Awaited<ReturnType<typeof creatorFor>>>,
  use: "post" | "story" | "dm",
  spice?: SlurpCreatorSpice,
): Promise<string> {
  const disclosureMode = creator.account.settings.privacy.identityDisclosure ?? "open";
  const brief = await resolveSlurpCreatorFlavour(db, {
    account: creator.account,
    source: creator.source,
    disclosureMode,
    use,
    sequence: Math.floor(Date.now() / 60_000),
    spice,
  });
  return protectFor(db, creator, brief);
}

/**
 * One Write / Improve tap: one model call on Slurp's text connection, counted on the AI budget's
 * "Writing help" row. The player pressed it, so it is present work and never paced. The answer comes
 * back as text; saving it stays the caller's call, so nothing is written here.
 */
// ponytail: plain prompt, not a Prompt Studio recipe; add a recipe if players want to edit it.
export async function runSlpAssistText(
  db: DB,
  input: SlpActionParsed<"write-text"> & { text?: string; mode: "write" | "improve" },
): Promise<SlpAssistOutcome<SlpActionResult["write-text"]>> {
  // The player pressed Write or Improve: their own tap never spends the world's AI budget (0.3.6).
  const settings = await createSlurpStorage(db).getSettings();
  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return fail(409, "Select a text generation connection first.");
  const creator = await creatorFor(db, input.accountId);
  if (input.accountId && !creator) return fail(404, "Creator not found.");
  const brief =
    creator && SLP_ASSIST_FIELDS[input.field].voice !== "player"
      ? await briefFor(db, creator, input.field === "story" ? "story" : input.field === "reply" ? "dm" : "post")
      : "";
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
      // The player's own request: booked as foreground work on the connection, like their chats.
      connection.id,
    ),
  );
  const result = await provider.chatComplete(
    buildSlpAssistTextMessages({
      ...input,
      name: creator?.account.displayName,
      brief,
      bio: creator ? await protectFor(db, creator, creator.account.bio) : "",
      stageVoice: creator ? await protectFor(db, creator, creator.account.settings.privacy.stagePersonality) : "",
    }),
    // Reasoning headroom: a short field still needs room to think before it answers.
    {
      model: connection.model,
      temperature: 0.85,
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        maxTokens: Math.max(resolveStoredMaxTokens(connection.defaultParameters, 2048), 2048),
        maxTokensOverride: connection.maxTokensOverride,
      }),
    },
  );
  const cleaned = cleanSlpAssistText(result.content, input.field);
  // The prompt now carries a concealed Creator's card text, so the answer gets the same pass a post does.
  const text = cleaned && creator ? await protectFor(db, creator, cleaned) : cleaned;
  return text ? { ok: true, value: { text } } : fail(502, "The connection returned nothing. Try again.");
}

const PICTURE_SIZE = {
  avatar: { width: 1024, height: 1024 },
  cover: { width: 1536, height: 512 },
  post: undefined,
  story: undefined,
} as const;

const DATA_URL_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Draw one picture of a Creator from what the player typed, through the same image pipeline their
 * posts use: their look and style profile, the brief as context, their spice level's picture phrase
 * and negative terms. The picture comes back as a data URL and is never kept: the caller shows it,
 * and "Use" goes through the ordinary upload (a post or Story) or `useSlpAssistPicture` (avatar, cover).
 * A profile picture or cover is public, so it takes the level a non-subscriber sees.
 */
export async function drawSlpAssistPicture(
  db: DB,
  input: SlpActionParsed<"draw-picture">,
  /** A draft for a public post draws at the level a non-subscriber sees, like the post itself. */
  post: { access?: "public" | "locked" } = {},
): Promise<SlpAssistOutcome<SlpActionResult["draw-picture"]>> {
  const creator = await creatorFor(db, input.accountId);
  if (!creator) return fail(404, "Creator not found.");
  const { account, source } = creator;
  const connections = createConnectionsStorage(db);
  const mappedId = await resolveCreatorImageConnectionId(db, account.id);
  const imageConnection =
    (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
  if (!imageConnection) return fail(409, "No image generation connection is available.");
  const settings = await createSlurpStorage(db).getSettings();
  const spice = await resolveSlurpCreatorSpice(db, account);
  const level =
    input.target === "avatar" || input.target === "cover" || post.access === "public"
      ? slurpPublicSexualLevel(spice.level)
      : spice.level;
  // The same defaults as the artwork tool: a cover shows a place, not the Creator's face.
  const options = {
    creatorDetails: true,
    appearance: input.target !== "cover",
    sourceReferences: input.target !== "cover",
    composition: true,
    ...input.options,
  };
  const brief = options.creatorDetails
    ? await briefFor(db, creator, input.target === "story" ? "story" : "post", spice)
    : "";
  const slot = input.target === "avatar" ? "avatar" : input.target === "cover" ? "banner" : null;
  const draftPrompt = slpAssistPictureDraft({
    target: input.target,
    request: input.request,
    context: input.context,
    name: account.displayName,
    levelPhoto: slurpLevelPhoto(level),
  });
  const locked = await tryCreatorAccountOperation(account.id, () =>
    generateCreatorPostImage({
      account,
      linkedPublicAccount: source,
      disclosureMode: account.settings.privacy.identityDisclosure ?? "open",
      postContent: options.creatorDetails ? [brief, input.context ?? ""].filter(Boolean).join("\n\n") : "",
      draftPrompt,
      settings,
      characters: createCharactersStorage(db),
      promptOverrides: createPromptOverridesStorage(db),
      imageConnection,
      db,
      debugMode: false,
      previewOnly: false,
      playerAsked: true,
      story: input.target === "story",
      ...(PICTURE_SIZE[input.target] ?? {}),
      // A profile picture or cover keeps the artwork tool's framing guard (no banner in an avatar,
      // no second face in a cover); a post or Story picture is framed like the Creator's posts.
      ...(slot && options.composition
        ? {
            compositionGuard: artworkCompositionGuard(slot),
            negativePromptAdditions: slurpImageNegativeTerms(
              artworkNegativePrompt(slot),
              slurpImageNegativePrompt(level),
            ),
          }
        : { negativePromptAdditions: slurpImageNegativePrompt(level) }),
      // The player's own drawing session, not the Creator's work.
      chargeEnergy: false,
      suppressCreatorDetails: !options.creatorDetails,
      suppressStageAppearance: !options.appearance,
      suppressCharacterContext: !options.sourceReferences,
    }),
  );
  if (!locked.acquired) return fail(409, "Another operation for this Creator is already running.");
  const image = locked.value;
  const mediaPath = image.metadata.noodlerMediaPath;
  if (typeof mediaPath !== "string") {
    image.stagedMedia?.compensate();
    return fail(502, "The picture could not be drawn. Try again.");
  }
  // Promote only to read it back once; the file is removed right after.
  image.stagedMedia?.promote();
  const absolute = resolveCreatorMediaAbsolutePath(mediaPath);
  try {
    if (!absolute) return fail(502, "The picture could not be drawn. Try again.");
    const extension = mediaPath.split(".").pop()?.toLowerCase() ?? "png";
    const base64 = readFileSync(absolute).toString("base64");
    return {
      ok: true,
      value: {
        image: `data:${DATA_URL_MIME[extension] ?? "image/png"};base64,${base64}`,
        prompt: image.providerPrompt,
      },
    };
  } finally {
    unlinkCreatorMedia(mediaPath);
  }
}

/** The picture a Creator had before the last "Use", per Creator and slot, for one Undo. */
const pictureUndo = createSlpPictureUndo();
const undoKey = (accountId: string, target: "avatar" | "cover") => `${accountId}:${target}`;

function unlinkPicture(accountId: string, target: "avatar" | "cover", url: string | null) {
  if (target === "avatar") unlinkCreatorAvatar(accountId, url);
  else unlinkCreatorBanner(accountId, url);
}

/** "Use" on a drawn profile picture or cover: it replaces the current one, which is kept for Undo. */
export async function useSlpAssistPicture(
  db: DB,
  input: SlpActionParsed<"use-picture">,
): Promise<SlpAssistOutcome<SlpActionResult["use-picture"]>> {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/u.exec(input.image);
  if (!match) return fail(400, "That is not a picture.");
  const upload = { buffer: Buffer.from(match[2]!, "base64"), extension: match[1] === "jpeg" ? "jpg" : match[1]! };
  const storage = createSlurpStorage(db);
  const locked = await tryCreatorAccountOperation(input.accountId, async () => {
    const account = await storage.getNoodlerAccountById(input.accountId);
    if (!account) return null;
    const before = input.target === "avatar" ? account.avatarUrl : (account.settings.profile.bannerUrl ?? null);
    const staged =
      input.target === "avatar"
        ? (({ avatarUrl, ...rest }) => ({ ...rest, url: avatarUrl }))(stageCreatorAvatar(account.id, upload))
        : (({ bannerUrl, ...rest }) => ({ ...rest, url: bannerUrl }))(stageCreatorBanner(account.id, upload));
    const url = staged.url;
    try {
      staged.promote();
      const updated =
        input.target === "avatar"
          ? await storage.updateNoodlerAvatar(account.id, url)
          : await storage.updateNoodlerBanner(account.id, url);
      if (!updated) {
        staged.compensate();
        return null;
      }
    } catch (error) {
      staged.compensate();
      throw error;
    }
    const dropped = pictureUndo.used(undoKey(account.id, input.target), before);
    if (dropped) unlinkPicture(account.id, input.target, dropped.drop);
    return { url };
  });
  if (!locked.acquired) return fail(409, "Another operation for this Creator is already running.");
  return locked.value ? { ok: true, value: locked.value } : fail(404, "Creator not found.");
}

/** Undo the last "Use": the kept picture comes back and the drawn one is removed. */
export async function undoSlpAssistPicture(
  db: DB,
  input: SlpActionParsed<"undo-picture">,
): Promise<SlpAssistOutcome<SlpActionResult["undo-picture"]>> {
  const key = undoKey(input.accountId, input.target);
  if (!pictureUndo.previous(key)) return fail(409, "There is nothing to undo.");
  const storage = createSlurpStorage(db);
  const locked = await tryCreatorAccountOperation(input.accountId, async () => {
    const account = await storage.getNoodlerAccountById(input.accountId);
    const kept = pictureUndo.previous(key);
    if (!account || !kept) return null;
    const previous = kept.url;
    const current = input.target === "avatar" ? account.avatarUrl : (account.settings.profile.bannerUrl ?? null);
    const updated =
      input.target === "avatar"
        ? await storage.updateNoodlerAvatar(account.id, previous)
        : await storage.updateNoodlerBanner(account.id, previous);
    if (!updated) return null;
    pictureUndo.forget(key);
    if (current !== previous) unlinkPicture(account.id, input.target, current);
    return { url: previous };
  });
  if (!locked.acquired) return fail(409, "Another operation for this Creator is already running.");
  return locked.value ? { ok: true, value: locked.value } : fail(404, "Creator not found.");
}

/** "Keep": the player is done (the sheet closed after Use), so the kept picture and its file go. */
export async function keepSlpAssistPicture(
  db: DB,
  input: SlpActionParsed<"keep-picture">,
): Promise<SlpAssistOutcome<SlpActionResult["keep-picture"]>> {
  const key = undoKey(input.accountId, input.target);
  if (!pictureUndo.previous(key)) return { ok: true, value: { kept: false } };
  const locked = await tryCreatorAccountOperation(input.accountId, async () => {
    const account = await createSlurpStorage(db).getNoodlerAccountById(input.accountId);
    const current = account
      ? input.target === "avatar"
        ? account.avatarUrl
        : (account.settings.profile.bannerUrl ?? null)
      : null;
    const previous = pictureUndo.previous(key)?.url ?? null;
    pictureUndo.forget(key);
    if (account && previous !== current) unlinkPicture(input.accountId, input.target, previous);
    return { kept: true };
  });
  if (!locked.acquired) return fail(409, "Another operation for this Creator is already running.");
  return { ok: true, value: locked.value };
}

/**
 * One idea in, a post to review out: the page's normal post, written by the post generator in draft
 * mode with the player's wish as its direction (0.3.31). So the draft has what every post has: bio,
 * stage voice, brief, the guidance for its audience, the image directions, a title, and an image
 * prompt of its own. Nothing is posted or recorded. What rides along (an owed #ad, a collab, a
 * storyline, a wardrobe look) is read here by id and added to the direction.
 */
export async function draftSlpPost(
  db: DB,
  input: SlpActionParsed<"draft-post">,
): Promise<SlpAssistOutcome<SlpActionResult["draft-post"]>> {
  const storage = createSlurpStorage(db);
  const account = await storage.getNoodlerAccountById(input.accountId);
  if (!account) return fail(404, "Creator not found.");
  const settings = await storage.getSettings();
  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return fail(409, "Select a text generation connection first.");
  const { deals, ties } = await readSlurpCreatorTiesDocument(db);
  const lines: string[] = [];
  if (input.dealId) {
    const deal = deals.find((entry) => entry.id === input.dealId && entry.creatorId === input.accountId);
    if (!deal) return fail(404, "That brand deal is not this page's.");
    lines.push(
      `This is the paid post for the brand deal with ${deal.brand}: show and name ${deal.product} naturally, and mark it #ad.${deal.copy ? ` The brand's line: ${deal.copy}` : ""}`,
    );
  }
  if (input.collabId) {
    const collab = ties.collabs.find(
      (entry) =>
        entry.id === input.collabId && (entry.hostId === input.accountId || entry.partnerId === input.accountId),
    );
    if (!collab) return fail(404, "That collab is not this page's.");
    const partner = await storage.getNoodlerAccountById(
      collab.hostId === input.accountId ? collab.partnerId : collab.hostId,
    );
    lines.push(`This post is about the collab with @${partner?.handle ?? "them"}: ${collab.idea}. Tag them.`);
  }
  if (input.projectId) {
    const project = (await storage.listActiveProjects(account.id)).find((entry) => entry.id === input.projectId);
    if (!project) return fail(404, "That storyline is not this page's.");
    const chapter = slurpProjectChapter(project);
    // ponytail: the draft is written from the chapter, but posting it does not advance the storyline
    // (a manual post carries no project). Carry the project id on the manual post when players ask.
    lines.push(`This post is the next step of their storyline "${project.title}"${chapter ? `: ${chapter}` : ""}.`);
  }
  if (input.lookId) {
    const look = (await storage.listWardrobeLooks(account.id)).find((entry) => entry.id === input.lookId);
    if (!look) return fail(404, "That look is not in this page's wardrobe.");
    lines.push(`In the picture they wear their look "${look.name}": ${look.description}`);
  }
  // What rides along is never cut: a long wish gives way to the #ad line, not the other way round.
  const extra = lines.join("\n");
  // A draft has no old picture to post again: those two deliveries fall back to the page's usual one.
  const delivery =
    input.contentDelivery === "existing_media" || input.contentDelivery === "cropped_preview"
      ? null
      : input.contentDelivery;
  const wish = input.idea.slice(0, Math.max(0, SLP_CREATOR_POST_GUIDE_MAX_LENGTH - extra.length - 1));
  let post;
  try {
    post = await generateCreatorPost(db, {
      account,
      connection,
      prepareOnly: true,
      previewOnly: true,
      // The picture is drawn below, so the rewrite that only fills `providerPrompt` is skipped.
      skipImagePromptPreview: true,
      request: {
        mode: "noodler",
        targetAccountId: account.id,
        access: input.access,
        postType: input.story ? "story" : "post",
        ...(input.story ? { format: "caption" as const } : {}),
        generateImage: input.picture,
        ...(input.contentIntent ? { contentIntent: input.contentIntent } : {}),
        ...(input.contentIntent && delivery ? { contentDelivery: delivery } : {}),
        noodlerPostGuide: [wish, extra].filter(Boolean).join("\n").slice(0, SLP_CREATOR_POST_GUIDE_MAX_LENGTH),
      },
    });
  } catch (error) {
    logger.warn(error, "[slurp] The guided post could not be drafted");
    return fail(502, "The post could not be drafted. Try again.");
  }
  // A draft that would repost an old picture staged a copy of it; the draft only takes the words.
  post.stagedMedia?.compensate();
  const drafted = { title: input.story ? "" : (post.title ?? ""), text: post.content };
  if (!input.picture || delivery === "text_only") {
    return { ok: true, value: { ...drafted, image: null, imageError: null } };
  }
  // The picture is drawn from the image prompt the post wrote for itself, not from the player's wish.
  const picture = await drawSlpAssistPicture(
    db,
    {
      accountId: input.accountId,
      target: input.story ? "story" : "post",
      request: post.imagePrompt ?? "",
      context: post.content.slice(0, 2000),
    },
    { access: input.access },
  );
  // A picture that failed still leaves a post worth reviewing: the player can draw again or add one.
  return {
    ok: true,
    value: {
      ...drafted,
      image: picture.ok ? picture.value.image : null,
      imageError: picture.ok ? null : picture.error,
    },
  };
}
