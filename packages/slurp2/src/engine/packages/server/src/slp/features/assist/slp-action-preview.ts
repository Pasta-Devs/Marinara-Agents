/**
 * `preview(name, input)` for every action (W): who it touches, what happens, when it shows, what it
 * costs, the fit notes from the Creator's card, and why it cannot happen, without writing anything.
 * Stir shows it as a card before "Do it"; Professor Mari can ask for it before she runs something.
 */
import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { readSlurpCreatorSteering } from "../../data/creators/slp-steering-storage.js";
import { readSlurpSpice } from "../../data/creators/slp-spice-storage.js";
import {
  isSlurpTieLever,
  previewSlurpTieLever,
  slurpBrandDealLever,
  slurpRunsItself,
} from "../projects/slp-projects-contract.js";
import {
  isSlpActionName,
  SLP_ACTION_META,
  SLP_ACTIONS,
  type SlpActionName,
  type SlpActionParsed,
} from "../../../../../shared/src/slp/slp-actions.js";
import { SLP_STEERING_NUDGES_MAX } from "../../../../../shared/src/slp/slp-creator-steering.js";
import { SLP_SPICE_LEVELS } from "../../../../../shared/src/slp/slp-spice.js";
import { SLURP_PLATFORM_EVENTS_MAX } from "../../../../../shared/src/slp/slp-platform-events.js";
import type { SlpActionPreview } from "../../../../../shared/src/slp/slp-stir.js";
import type { SlpAssistOutcome } from "./slp-assist-service.js";
import { isSlpDeskLever, previewSlpDeskLever, type SlpDeskLever } from "./slp-desk-levers.js";
import { isSlurpDramaLever, previewSlurpDramaLever, type SlurpDramaLever } from "../world/slp-world-contract.js";

type Account = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  kind: string;
  sourceKind?: string | null;
};

/** What this action would do. Unknown names and bad input answer like a run would (404 / 400). */
export async function previewSlpAction(
  db: DB,
  name: string,
  raw: unknown,
  at = new Date(),
): Promise<SlpAssistOutcome<SlpActionPreview>> {
  if (!isSlpActionName(name)) return { ok: false, status: 404, error: `Slurp has no action called "${name}".` };
  const parsed = SLP_ACTIONS[name].schema.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data as Record<string, unknown>;
  const meta = SLP_ACTION_META[name];
  const base: SlpActionPreview = {
    action: name,
    input,
    who: [],
    detail: {},
    summary: SLP_ACTIONS[name].summary,
    when: "now",
    cost: meta.ai ? "ai" : "free",
    notes: [],
    error: null,
    // "Make it happen" takes the no away.
    refusable: meta.refusable && input.happen !== true,
    reversible: meta.reversible,
  };
  if (isSlurpTieLever(name))
    return { ok: true, value: { ...base, ...(await previewSlurpTieLever(db, name, input, at)) } };
  if (isSlpDeskLever(name))
    return { ok: true, value: { ...base, ...(await previewSlpDeskLever(db, name, input, at)) } };
  if (isSlurpDramaLever(name))
    return { ok: true, value: { ...base, ...(await previewSlurpDramaLever(db, name, input, at)) } };
  return { ok: true, value: { ...base, ...(await previewOther(db, name, input, at)) } };
}

async function previewOther(
  db: DB,
  name: Exclude<SlpActionName, Parameters<typeof previewSlurpTieLever>[1] | SlpDeskLever | SlurpDramaLever>,
  input: Record<string, unknown>,
  at: Date,
): Promise<Partial<SlpActionPreview>> {
  const storage = createSlurpStorage(db);
  const creator = typeof input.accountId === "string" ? await storage.getNoodlerAccountById(input.accountId) : null;
  const account = creator as Account | null;
  const who = account ? [{ id: account.id, name: account.displayName, avatarUrl: account.avatarUrl ?? null }] : [];
  const missing = typeof input.accountId === "string" && !account;
  const nameOf = account?.displayName ?? "";
  if (missing) return { who, error: "notFound", summary: "That Creator does not exist." };
  // The player writes their own page's posts, so its ideas, life and spice would change nothing.
  const ownPage = account && !slurpRunsItself(account) ? "notAutomatic" : null;
  switch (name) {
    case "write-text":
    case "improve-text":
      return {
        who,
        detail: { field: String(input.field) },
        summary: `Writes ${String(input.field)} text for the player to use.`,
      };
    case "draft-post":
      return { who, summary: `Drafts a post for ${nameOf} for the player to review; nothing is posted.` };
    case "draw-picture":
    case "use-picture":
    case "undo-picture":
    case "keep-picture":
      return { who, detail: { target: String(input.target) } };
    case "list-creators":
    case "list-world":
    case "list-brands":
      return { summary: "Changes nothing." };
    case "draw-brand-picture":
      return { detail: { brandId: String(input.brandId), productId: (input.productId as string | undefined) ?? null } };
    case "offer-brand-deal": {
      // R's lever answers its own preview (the same rules as the run); only the card's avatars come from here.
      const { preview: _dryRun, ...lever } = input as SlpActionParsed<"offer-brand-deal">;
      const { preview } = await slurpBrandDealLever(db, lever, false, at);
      return { ...preview, who, notes: preview.notes as SlpActionPreview["notes"] };
    }
    case "steer-creator": {
      const patch = input as SlpActionParsed<"steer-creator">;
      return {
        who,
        error: ownPage,
        when: "nextPost",
        detail: {
          mood: patch.mood === undefined ? null : (patch.mood ?? "none"),
          lifePhase: patch.lifePhase ?? null,
          focus: patch.focus ?? null,
          pace: patch.pace ?? null,
          relationshipStyle: patch.relationshipStyle === undefined ? null : (patch.relationshipStyle ?? "card"),
          push: patch.push?.join(", ") || null,
          avoid: patch.avoid?.join(", ") || null,
        },
        summary: `${nameOf}'s life changes: ${JSON.stringify(patch)}.`,
      };
    }
    case "add-idea": {
      const idea = input as SlpActionParsed<"add-idea">;
      const steering = await readSlurpCreatorSteering(db, idea.accountId);
      return {
        who,
        when: "nextPost",
        detail: { text: idea.text, story: idea.story },
        notes: steering.pace === "break" ? [{ kind: "onBreak", name: nameOf }] : [],
        error: ownPage ?? (steering.nudges.length >= SLP_STEERING_NUDGES_MAX ? "ideasFull" : null),
        summary: `${nameOf} gets an idea for a ${idea.story ? "Story" : "post"}: ${idea.text}`,
      };
    }
    case "write-post": {
      const post = input as SlpActionParsed<"write-post">;
      return {
        who,
        detail: { idea: post.idea ?? null, story: post.story },
        // Review for everyone (0.3.14): Stir never posts this; the card opens the page's composer,
        // which drafts the idea for the player to check. Professor Mari still runs it directly.
        error: "draftInComposer",
        summary: `${nameOf} drafts their next ${post.story ? "Story" : "post"} for the player to review.`,
      };
    }
    case "set-spice": {
      const spice = input as SlpActionParsed<"set-spice">;
      const { max } = await readSlurpSpice(db);
      const above = spice.level !== null && SLP_SPICE_LEVELS.indexOf(spice.level) > SLP_SPICE_LEVELS.indexOf(max);
      return {
        who,
        when: "nextPost",
        detail: { level: spice.level, max },
        notes: above ? [{ kind: "capped", name: nameOf }] : [],
        error: ownPage,
        summary: `${nameOf}'s spice level becomes ${spice.level ?? "the default"}.`,
      };
    }
    case "start-event": {
      const { eventId } = input as SlpActionParsed<"start-event">;
      const [settings, occurrences] = await Promise.all([storage.getSettings(), storage.listStoryOccurrences()]);
      const event = settings.platformEvents.find((item: { id: string }) => item.id === eventId);
      if (!event) return { error: "notFound", summary: "That event does not exist." };
      const live = occurrences.some(
        (occurrence: { blueprintId: string; status: string; endsAt: string }) =>
          occurrence.blueprintId === eventId && occurrence.status === "active" && occurrence.endsAt > at.toISOString(),
      );
      const days = "durationDays" in event.activation ? Number(event.activation.durationDays) : 1;
      return {
        when: "ongoing",
        detail: { name: event.name, days },
        // A second start while it runs would double what it gives; the run refuses it too.
        error: live ? "alreadyRunning" : null,
        summary: `${event.name} starts now for ${days} day(s); every Creator it fits joins.`,
      };
    }
    case "steer-storyline": {
      const move = input as SlpActionParsed<"steer-storyline">;
      const project = (await storage.getProject(move.accountId, move.projectId)) as {
        title: string;
        chapters: string[];
        chapter: number;
        status: string;
        held?: boolean;
      } | null;
      if (!project) return { who, error: "notFound", summary: "That storyline does not exist." };
      const live = project.status === "active" || project.status === "paused";
      const last = project.chapter >= project.chapters.length - 1;
      const error =
        !live ||
        (move.move === "skip" && last) ||
        (move.move === "back" && project.chapter === 0) ||
        (move.move === "hold" && project.held) ||
        (move.move === "release" && !project.held)
          ? "notOpen"
          : (move.move === "insert" || move.move === "label") && !move.text
            ? "noText"
            : null;
      return {
        who,
        when: "nextPost",
        detail: {
          move: move.move,
          title: project.title,
          chapter: project.chapters[project.chapter] ?? "",
          next: project.chapters[project.chapter + 1] ?? null,
          text: move.text ?? null,
        },
        error,
        // Only hold and release undo each other (the run keeps no Undo for the other moves).
        reversible: move.move === "hold" || move.move === "release",
        summary: `${nameOf}'s storyline "${project.title}": ${move.move}${move.text ? ` (${move.text})` : ""}.`,
      };
    }
    case "start-storyline": {
      const story = input as SlpActionParsed<"start-storyline">;
      const others = (await Promise.all((story.withIds ?? []).map((id) => storage.getNoodlerAccountById(id)))).filter(
        Boolean,
      ) as Account[];
      if (others.length !== (story.withIds ?? []).length)
        return { who, error: "notFound", summary: "One of these Creators does not exist." };
      const everyone = [account!, ...others.filter((other) => other.id !== account!.id)];
      const ownOther = others.some((other) => !slurpRunsItself(other));
      const room = await Promise.all(everyone.map((entry) => storage.arcHasRoom(entry.id)));
      return {
        who: everyone.map((entry) => ({ id: entry.id, name: entry.displayName, avatarUrl: entry.avatarUrl ?? null })),
        when: "nextPost",
        detail: { title: story.title, with: others.map((other) => other.displayName).join(", ") || null },
        error: ownPage ?? (ownOther ? "notAutomatic" : room.every(Boolean) ? null : "storylinesFull"),
        summary: `${nameOf} starts a storyline: ${story.title}${others.length ? `, with ${others.map((other) => other.displayName).join(", ")}` : ""}.`,
      };
    }
    case "set-tip-goal": {
      const goal = input as SlpActionParsed<"set-tip-goal">;
      const before = await storage.getGoal(goal.accountId);
      return {
        who,
        detail: { label: goal.label, target: goal.target, replaces: before?.label ?? null },
        summary: `${nameOf} asks their fans for $${goal.target}: ${goal.label}.`,
      };
    }
    case "new-look": {
      const look = input as SlpActionParsed<"new-look">;
      return {
        who,
        when: "nextPost",
        detail: { change: look.change },
        summary: `${nameOf}'s look changes from now on: ${look.change}.`,
      };
    }
    case "invent-event": {
      const event = input as SlpActionParsed<"invent-event">;
      const settings = await storage.getSettings();
      return {
        when: "ongoing",
        detail: { name: event.name, days: event.days },
        error: settings.platformEvents.length >= SLURP_PLATFORM_EVENTS_MAX ? "eventsFull" : null,
        summary: `${event.name} starts now for ${event.days} day(s); every Creator joins in their own way.`,
      };
    }
    case "run-audience": {
      const settings = await storage.getSettings();
      return {
        error: settings.fanActivityEnabled ? null : "audienceOff",
        summary: "The fans like, comment and reply now.",
      };
    }
  }
}
