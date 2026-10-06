import type { DB } from "../../../db/connection.js";
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
import { resolveSlurpCreatorSpice } from "../../data/creators/slp-spice-storage.js";
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
import { artworkCompositionGuard, artworkNegativePrompt } from "../creators/slp-creators-contract.js";
import {
  SLP_ASSIST_FIELDS,
  SLP_ASSIST_NOTE_MAX,
  SLP_ASSIST_REQUEST_MAX,
  type SlpActionParsed,
} from "../../../../../shared/src/slp/slp-actions.js";
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
  return {
    account,
    source: await storage.resolveAccountSource(account),
    open: (account.settings.privacy.identityDisclosure ?? "open") === "open",
  };
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
  // The brief only for an open identity: this prompt has no identity protection of its own
  // (the same rule as the hand-over note in 7b0).
  const brief =
    creator?.open && SLP_ASSIST_FIELDS[input.field].voice !== "player"
      ? await resolveSlurpCreatorFlavour(db, {
          account: creator.account,
          source: creator.source,
          disclosureMode: "open",
          use: input.field === "story" ? "story" : input.field === "reply" ? "dm" : "post",
          sequence: Math.floor(Date.now() / 60_000),
        })
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
    ),
  );
  const result = await provider.chatComplete(
    buildSlpAssistTextMessages({ ...input, name: creator?.account.displayName, brief }),
    // Reasoning headroom: a short field still needs room to think before it answers.
    { model: connection.model, temperature: 0.85, maxTokens: 2048 },
  );
  const text = cleanSlpAssistText(result.content, input.field);
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
): Promise<SlpAssistOutcome<SlpActionResult["draw-picture"]>> {
  const creator = await creatorFor(db, input.accountId);
  if (!creator) return fail(404, "Creator not found.");
  const { account, source, open } = creator;
  const connections = createConnectionsStorage(db);
  const mappedId = await resolveCreatorImageConnectionId(db, account.id);
  const imageConnection =
    (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
  if (!imageConnection) return fail(409, "No image generation connection is available.");
  const settings = await createSlurpStorage(db).getSettings();
  const spice = await resolveSlurpCreatorSpice(db, account);
  const level =
    input.target === "avatar" || input.target === "cover" ? slurpPublicSexualLevel(spice.level) : spice.level;
  // The same defaults as the artwork tool: a cover shows a place, not the Creator's face.
  const options = {
    creatorDetails: true,
    appearance: input.target !== "cover",
    sourceReferences: input.target !== "cover",
    composition: true,
    ...input.options,
  };
  const brief =
    open && options.creatorDetails
      ? await resolveSlurpCreatorFlavour(db, {
          account,
          source,
          disclosureMode: "open",
          use: input.target === "story" ? "story" : "post",
          sequence: Math.floor(Date.now() / 60_000),
          spice,
        })
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
 * One idea in, a post to review out (the player's own page, 0.3.14): the caption in the page's voice
 * and its picture, nothing posted. An owed brand deal or a collab rides along as context, so the
 * caption carries the #ad or tags the partner the way the Creators' own posts do.
 */
export async function draftSlpPost(
  db: DB,
  input: SlpActionParsed<"draft-post">,
): Promise<SlpAssistOutcome<SlpActionResult["draft-post"]>> {
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
    const partner = await createSlurpStorage(db).getNoodlerAccountById(
      collab.hostId === input.accountId ? collab.partnerId : collab.hostId,
    );
    lines.push(`This post is about the collab with @${partner?.handle ?? "them"}: ${collab.idea}. Tag them.`);
  }
  const text = await runSlpAssistText(db, {
    field: input.story ? "story" : "caption",
    accountId: input.accountId,
    context: lines.join(" "),
    note: input.idea.slice(0, SLP_ASSIST_NOTE_MAX),
    mode: "write",
  });
  if (!text.ok) return text;
  if (!input.picture) return { ok: true, value: { text: text.value.text, image: null, imageError: null } };
  const picture = await drawSlpAssistPicture(db, {
    accountId: input.accountId,
    target: input.story ? "story" : "post",
    request: input.idea.slice(0, SLP_ASSIST_REQUEST_MAX),
    context: text.value.text.slice(0, 2000),
  });
  // A picture that failed still leaves a caption worth reviewing: the player can draw again or add one.
  return {
    ok: true,
    value: {
      text: text.value.text,
      image: picture.ok ? picture.value.image : null,
      imageError: picture.ok ? null : picture.error,
    },
  };
}
