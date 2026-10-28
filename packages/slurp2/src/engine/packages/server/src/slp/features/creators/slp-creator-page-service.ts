import type { APIProvider } from "@marinara-engine/shared";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { jsonrepair } from "jsonrepair";
import {
  normalizeSlpCreatorPage,
  SLP_CREATOR_PAGE_LIMITS,
  type SlpCreatorPage,
  type SlpCreatorPageBlock,
} from "../../../../../shared/src/slp/slp-creator-page.js";
import type { SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import {
  claimSlurpModelBudget,
  slurpModelBudgetPaceOpen,
  slurpModelWorkerAllows,
} from "../../base/model/slp-model-worker.js";
import { slpWithProviderRetry } from "../../base/model/slp-provider-retry.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { buildSlpCreatorPageMessages } from "../../modules/creators/slp-creator-page-prompt.js";
import { slpCreatorPageNews, slpCreatorPageRefreshDue } from "../../modules/creators/slp-creator-page-refresh.js";
import { logger } from "../../../lib/logger.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  protectBoundedCreatorGeneratedText,
  resolveNoodlerPublicIdentity,
  slpCreatorIdentityInstruction,
  type PublicIdentity,
} from "../feed/slp-feed-contract.js";

export type SlpCreatorPageComposeResult =
  { ok: true; page: SlpCreatorPage } | { ok: false; status: 404 | 409 | 429 | 502; error: string };

/**
 * Parse a model's answer: fences, prose around the object and trailing commas are tolerated. Post
 * ids the model wrote are dropped unless the collage already had them, because the model never sees
 * post ids and an invented one would leave the collage empty instead of picking pictures itself.
 */
export function parseSlpCreatorPageAnswer(
  answer: string,
  now: string,
  keepPostIds: ReadonlySet<string> = new Set(),
): SlpCreatorPage | null {
  // A thinking model's notes and code fences hold braces too; only the answer after them counts.
  // Some providers send the notes with no opening tag, so everything up to the last closing tag goes.
  const text = answer.replace(/^[\s\S]*<\/think>/iu, " ").replace(/```[a-z]*|```/giu, " ");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let value: unknown;
  try {
    value = JSON.parse(jsonrepair(text.slice(start, end + 1)));
  } catch {
    return null;
  }
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!raw || !Array.isArray(raw.blocks)) return null;
  const blocks = raw.blocks.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const block = entry as Record<string, unknown>;
    // The model never dates a "Now" line; it is news as of this answer.
    if (block.kind === "now") return { ...block, at: now };
    if (block.kind === "collage")
      return {
        ...block,
        postIds: Array.isArray(block.postIds)
          ? block.postIds.filter((id) => typeof id === "string" && keepPostIds.has(id))
          : [],
      };
    return block;
  });
  const page = normalizeSlpCreatorPage({ ...raw, blocks, composedBy: "creator", updatedAt: now });
  return page ? { ...page, composedBy: "creator", updatedAt: now } : null;
}

/**
 * An answer's structure without its words, for the logs: every string becomes its length, so a
 * parser miss is visible without Creator text (often adult) landing in the Engine log.
 */
function slpAnswerShape(answer: string): string {
  const start = answer.lastIndexOf("</think>") + 1;
  const open = answer.indexOf("{", start);
  try {
    const value: unknown = JSON.parse(jsonrepair(answer.slice(open, answer.lastIndexOf("}") + 1)));
    return JSON.stringify(value, (_key, item: unknown) => (typeof item === "string" ? `<${item.length}>` : item)).slice(
      0,
      1500,
    );
  } catch {
    return `unparsable, ${answer.length} characters`;
  }
}

/** Keep a hinted Creator's other name and handle out of every word the model wrote. */
export function protectSlpCreatorPage(
  page: SlpCreatorPage,
  mode: SlpIdentityDisclosure,
  identity: PublicIdentity | null,
): SlpCreatorPage {
  const L = SLP_CREATOR_PAGE_LIMITS;
  const p = (value: string, max: number) => protectBoundedCreatorGeneratedText(value, mode, identity, max) ?? "";
  const blocks = page.blocks.flatMap<SlpCreatorPageBlock>((block) => {
    const title = "title" in block ? p(block.title, L.title) : undefined;
    const titled = title === undefined ? {} : { title };
    switch (block.kind) {
      case "quote":
      case "now": {
        const text = p(block.text, block.kind === "quote" ? L.quote : L.now);
        return text ? [{ ...block, text }] : [];
      }
      case "list": {
        const items = block.items.map((item) => p(item, L.listItem)).filter(Boolean);
        return items.length ? [{ ...block, ...titled, items }] : [];
      }
      case "thisOrThat": {
        const pairs = block.pairs
          .map((pair) => ({ ...pair, left: p(pair.left, L.pairSide), right: p(pair.right, L.pairSide) }))
          .filter((pair) => pair.left && pair.right);
        return pairs.length ? [{ ...block, ...titled, pairs }] : [];
      }
      case "qa": {
        const items = block.items
          .map((item) => ({ question: p(item.question, L.question), answer: p(item.answer, L.answer) }))
          .filter((item) => item.question && item.answer);
        return items.length ? [{ ...block, ...titled, items }] : [];
      }
      default:
        return [{ ...block, ...titled } as SlpCreatorPageBlock];
    }
  });
  return { ...page, blocks };
}

/**
 * One model call: the Creator designs (or, with `refreshNews`, updates) their own Page and it is saved.
 *
 * A player's "Let <Creator> design it" never waits; world work (`world`: a first Page or a refresh
 * after news) keeps to the day's pace and never overwrites a Page the player saved meanwhile. Both
 * count on the AI budget's "Creator pages" row.
 */
// ponytail: plain prompt, not a Prompt Studio recipe; add a recipe if players want to edit it.
export async function composeSlpCreatorPage(
  db: DB,
  input: { accountId: string; context: "present" | "background"; world?: boolean; refreshNews?: string },
): Promise<SlpCreatorPageComposeResult> {
  const noodle = createSlurpStorage(db);
  const account = await noodle.getNoodlerAccountById(input.accountId);
  if (!account) return { ok: false, status: 404, error: "Creator account not found" };
  if (account.sourceKind === "persona")
    return { ok: false, status: 409, error: "A persona's own page is yours to build." };
  const settings = await noodle.getSettings();
  // "Let Creator design it" is the player's tap: it never spends the AI budget (0.3.6). World pages do.
  if (input.world && !slurpModelWorkerAllows(settings.modelBudget, input.context))
    return { ok: false, status: 409, error: "The AI budget is off. Turn it on under Audience → AI budget." };
  const connection = await resolveSlurpTextConnection(
    createConnectionsStorage(db),
    settings.pageConnectionId ?? settings.modelBudget.connectionId ?? settings.generationConnectionId,
  );
  if (!connection) return { ok: false, status: 409, error: "Select a text generation connection first." };
  const current = account.settings.profile.page ?? null;
  if (input.refreshNews && !current) return { ok: false, status: 409, error: "This Creator has no Page to refresh." };
  // World work keeps to the day's pace; a player's tap never waits for it.
  if (input.world && !(await slurpModelBudgetPaceOpen(db, settings.modelBudget, "page")))
    return { ok: false, status: 429, error: "The AI budget's pace for Creator pages is used up for now." };
  if (input.world && !(await claimSlurpModelBudget(db, settings.modelBudget, "page")))
    return { ok: false, status: 429, error: "Today's AI budget for Creator pages is used up." };

  const mode = account.settings.privacy.identityDisclosure ?? "hinted";
  const identity = await resolveNoodlerPublicIdentity(db, account).catch(() => null);
  const messages = buildSlpCreatorPageMessages({
    displayName: account.displayName,
    handle: account.handle,
    bio: account.bio,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    tags: account.settings.profile.tags ?? [],
    locations: account.settings.stage?.locations ?? "",
    identityInstruction: slpCreatorIdentityInstruction(mode, identity),
    untrustedInstruction: NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
    ...(input.refreshNews && current ? { refresh: { page: current, news: input.refreshNews } } : {}),
  });
  let answer: string;
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
        // The player's "Let <Creator> design it" is foreground work on the connection; world pages are not.
        input.world ? undefined : connection.id,
      ),
    );
    const result = await provider.chatComplete(messages, {
      model: connection.model,
      temperature: 0.9,
      // 1400 cut a seven-block Page (or a reasoning model's answer) short, and a cut answer has no Page.
      maxTokens: clampGenerationMaxOutputTokens({
        provider: connection.provider as APIProvider,
        model: connection.model,
        maxTokens: Math.max(resolveStoredMaxTokens(connection.defaultParameters, 4000), 4000),
        maxTokensOverride: connection.maxTokensOverride,
      }),
    });
    answer = result.content ?? "";
  } catch (error) {
    logger.warn({ accountId: account.id, error }, "[slurp-creator-page] Model call failed");
    return { ok: false, status: 502, error: "The connection failed while designing the Page. Try again." };
  }
  const now = new Date().toISOString();
  const keepPostIds = new Set(
    (current?.blocks ?? []).flatMap((block) => (block.kind === "collage" ? block.postIds : [])),
  );
  const parsed = parseSlpCreatorPageAnswer(answer, now, keepPostIds);
  const page = parsed ? protectSlpCreatorPage(parsed, mode, identity) : null;
  // The prompt asks for 4 to 7 blocks: fewer means the reader dropped some, so keep the answer to see why.
  if (page && page.blocks.length < 4)
    logger.warn(
      { accountId: account.id, kept: page.blocks.map((block) => block.kind), answer: slpAnswerShape(answer) },
      "[slurp-creator-page] The Page kept fewer blocks than asked",
    );
  if (!page?.blocks.length) {
    // Logged so a failing model can be told apart from a parser that is too strict.
    logger.warn(
      { accountId: account.id, answer: slpAnswerShape(answer) },
      "[slurp-creator-page] The answer held no usable Page",
    );
    return { ok: false, status: 502, error: "The connection returned no usable Page. Try again." };
  }
  if (input.world) {
    // The call took seconds; a Page the player saved meanwhile is theirs.
    // ponytail: re-read, not a transactional compare-and-set; the window is one DB round trip.
    const latest = (await noodle.getNoodlerAccountById(account.id))?.settings.profile.page ?? null;
    if ((latest?.updatedAt ?? null) !== (current?.updatedAt ?? null))
      return { ok: false, status: 409, error: "The Page changed while it was being designed." };
  }
  const updated = await noodle.updateAccountProfile(account.id, { profile: { page, pageWanted: undefined } });
  if (!updated) return { ok: false, status: 404, error: "Creator account not found" };
  return { ok: true, page };
}

/** An account whose world compose just failed rests, so one broken answer cannot spend every open. */
const restingUntil = new Map<string, number>();
const REST_MS = 6 * 60 * 60_000;
let running: Promise<void> | null = null;

/**
 * Catch-up on open, one model call at most: a new AI Creator designs their first Page, or else one
 * whose Page is a week old refreshes it for real news (see `slp-creator-page-refresh.ts`). One per
 * open keeps it rare and cheap; the next open takes the next. Never awaited by the caller, and never
 * twice at once, so two tabs opening together do not pay twice.
 */
export function refreshSlurpCreatorPages(db: DB, now = Date.now()): Promise<void> {
  running ??= runRefresh(db, now).finally(() => {
    running = null;
  });
  return running;
}

async function runRefresh(db: DB, now: number): Promise<void> {
  const noodle = createSlurpStorage(db);
  const accounts = (await noodle.listNoodlerAccounts()).filter((account) => (restingUntil.get(account.id) ?? 0) <= now);
  const rest = (accountId: string, error: string, what: string) => {
    restingUntil.set(accountId, now + REST_MS);
    logger.warn({ accountId, error }, `[slurp-creator-page] ${what} failed`);
  };
  // First a new AI Creator's first Page. One try: a failure clears the wish, the button stays.
  const newcomer = accounts.find((account) => account.settings.profile.pageWanted && !account.settings.profile.page);
  if (newcomer) {
    const result = await composeSlpCreatorPage(db, { accountId: newcomer.id, context: "present", world: true });
    // Budget used up or off: keep the wish for a later open.
    if (!result.ok && result.status !== 429 && result.status !== 409) {
      await noodle.updateAccountProfile(newcomer.id, { profile: { pageWanted: undefined } });
      rest(newcomer.id, result.error, "First page");
    }
    return;
  }
  for (const account of accounts) {
    const page = account.settings.profile.page;
    if (!slpCreatorPageRefreshDue(page, now)) continue;
    const news = slpCreatorPageNews(page, await noodle.listAllNoodlerPostsByAccount(account.id), now);
    if (!news) continue;
    const result = await composeSlpCreatorPage(db, {
      accountId: account.id,
      context: "present",
      world: true,
      refreshNews: news,
    });
    if (!result.ok && result.status !== 429) rest(account.id, result.error, "Refresh");
    return;
  }
}
