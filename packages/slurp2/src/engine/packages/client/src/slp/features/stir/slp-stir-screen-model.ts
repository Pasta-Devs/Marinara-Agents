// The Stir tab's small rules (0.3.1), apart from the screen so they run in tests: which lever an
// "In play" card opens, what a deck card needs first, and where a recent play leads.
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type {
  SlpStirLive,
  SlpStirPlay,
  SlpStirPlayedCollab,
  SlpStirView,
} from "../../../../../shared/src/slp/slp-stir.js";
import type { SlpPulseTarget } from "../../base/state/slp-task-store";

/** The lever an "In play" card opens, already on that thread, or null when there is nothing to steer. */
export function slpStirLiveLever(entry: SlpStirLive): { action: SlpActionName; who?: string[]; pick?: string } | null {
  const id = entry.id.slice(entry.id.indexOf(":") + 1);
  const who = entry.who.map((person) => person.id);
  switch (entry.kind) {
    case "couple":
      return { action: "steer-couple", pick: id };
    case "collab":
      return entry.state === "asked" ? { action: "push-collab", pick: id } : null;
    case "rivalry":
      return entry.state === "cooling" ? null : { action: "cool-rivalry", pick: id };
    case "break":
      return { action: "steer-creator", who };
    case "ideas":
      return { action: "add-idea", who };
    default:
      return null;
  }
}

/** What a deck card needs before it can do anything, or null when it is ready (0.3.1). */
export function slpStirDeckNeed(action: SlpActionName, view: SlpStirView | undefined): string | null {
  if (!view) return null;
  switch (action) {
    case "steer-couple":
      return view.couples.length ? null : "couple";
    case "add-to-couple":
    case "couple-page":
      return view.couples.some((couple) => couple.stage === "dating" || couple.stage === "together")
        ? null
        : view.couples.length
          ? "datingCouple"
          : "couple";
    case "push-collab":
      return view.collabs.some((collab) => collab.status === "asked") ? null : "collab";
    case "cool-rivalry":
      return view.rivalries.some((rivalry) => rivalry.stage !== "cooling") ? null : "rivalry";
    case "steer-storyline":
      return view.storylines.length ? null : "storyline";
    case "start-event":
      return view.events.length ? null : "event";
    case "start-drama":
      return view.dramas?.length ? null : "dramaOff";
    default:
      return null;
  }
}

/** Where a recent play leads: the post it wrote, or the first Creator it touched. */
export function slpStirPlayTarget(play: SlpStirPlay): SlpPulseTarget | null {
  for (const step of play.steps) {
    const accountId = ["accountId", "aId", "fromId", "hostId"]
      .map((key) => step.input[key])
      .find((value): value is string => typeof value === "string");
    if (accountId) return { accountId, postId: step.ref?.postId ?? null };
  }
  return null;
}

/**
 * How a collab a play started is going now (Step 1, Stir follows through), from its record only:
 * the locale key and names for the row, the joint post to open once it is up, the one move that
 * fits ("Make it happen" on a request still waiting), and whether Undo can still take it back.
 * Null when the play made no collab or was taken back.
 */
export type SlpStirCollabProgress = {
  /** A `ui.slurp.*` key, worded with `host` and `partner`. */
  label: string;
  hostId: string | null;
  partnerId: string | null;
  target: SlpPulseTarget | null;
  lever: { action: "push-collab"; pick: string } | null;
  /** What Undo can still take back: never a joint post on its way or up. */
  undoable: boolean;
};

export function slpStirPlayCollab(
  play: SlpStirPlay,
  collabs: readonly SlpStirPlayedCollab[] = [],
): SlpStirCollabProgress | null {
  if (play.undone) return null;
  const step = play.steps.find(
    (entry) => entry.ok && typeof (entry.ref?.collabId ?? entry.input.collabId) === "string",
  );
  if (!step) return null;
  const id = (step.ref?.collabId ?? step.input.collabId) as string;
  const collab = collabs.find((entry) => entry.id === id);
  // Only a one-step play is all collab: another step may still be worth taking back.
  const alone = play.steps.length === 1;
  if (!collab)
    return {
      label: "ui.slurp.stir.follow.gone",
      hostId: null,
      partnerId: null,
      target: null,
      lever: null,
      undoable: !alone && play.undoable,
    };
  const label =
    collab.status === "asked"
      ? "ui.slurp.ties.collab.waiting"
      : collab.status === "posted"
        ? collab.postId
          ? "ui.slurp.ties.collab.posted"
          : "ui.slurp.stir.follow.postGone"
        : collab.status === "declined"
          ? `ui.slurp.ties.decline.${collab.decline ?? "noAnswer"}`
          : `ui.slurp.ties.collab.${collab.status}`;
  // The server's Undo rule (`slurpUndoTie`): a suggestion is removed until its post is on the way;
  // a push puts the request back only while the two are still just agreed.
  const takesBack =
    step.action === "push-collab"
      ? collab.status === "agreed"
      : collab.status !== "planned" && collab.status !== "posted";
  return {
    label,
    hostId: collab.hostId,
    partnerId: collab.partnerId,
    target: { accountId: collab.hostId, postId: collab.postId },
    lever: collab.status === "asked" ? { action: "push-collab", pick: collab.id } : null,
    undoable: play.undoable && (!alone || takesBack),
  };
}
