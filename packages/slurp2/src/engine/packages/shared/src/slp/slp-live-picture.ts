import { slpLiveCurrentGoal, slpLiveShooting, type SlpLiveSettings, type SlpLiveState } from "./slp-live.js";

/** Menu items the camera can show; a shout-out or a song is talk, not a picture. */
const VISUAL = new Set(["dance", "pose", "outfit", "closeUp", "layer", "flash", "toy"]);
const SHOWS: Record<string, string> = {
  dance: "dancing for the camera",
  pose: "holding a pose for the camera",
  outfit: "in a fresh outfit, just changed",
  closeUp: "close to the camera, a close-up",
  layer: "just took a layer of clothing off",
  flash: "flashing the camera, teasing",
  toy: "playing with a toy on camera",
};

export type SlpLivePictureWhy = "opening" | "goal" | "order" | "tip" | "rate";

/**
 * Why the show takes a picture now, or null (LIVE-V3-PLAN.md "Pictures"). The first look gets an opening
 * shot; after that a goal, a visual order or a big tip goes first, else one picture every `pictureSeconds`.
 * All count toward `pictureMax`.
 */
export function slpLivePictureDue(
  state: SlpLiveState,
  at: number,
  live: Pick<SlpLiveSettings, "pictureSeconds" | "pictureMax">,
): SlpLivePictureWhy | null {
  if (slpLiveShooting(state, at) || (state.pictures?.length ?? 0) >= live.pictureMax) return null;
  const last = state.pictureAt;
  if (last === undefined) return "opening";
  if (at - last < live.pictureSeconds * 1_000) return null;
  const goal = slpLiveCurrentGoal(state);
  const since = state.log.filter((event) => event.at > last && event.at <= at);
  if (since.some((event) => event.kind === "goal")) return "goal";
  if (since.some((event) => event.kind === "order" && event.itemId && VISUAL.has(event.itemId))) return "order";
  const big = goal ? goal.target * 0.25 : Infinity;
  if (since.some((event) => event.kind === "tip" && (event.amount ?? 0) >= big)) return "tip";
  return "rate";
}

/** The picture's scene, compiled from the show state, so pictures follow what was said and done. */
export function slpLivePictureScene(state: SlpLiveState, at: number, why: SlpLivePictureWhy): string {
  const said = state.log.filter((event) => event.at <= at && event.kind === "say" && event.action).at(-1);
  const order = state.queue.find((entry) => entry.doneAt === null && VISUAL.has(entry.itemId));
  const heat =
    state.heat < 30 ? "relaxed and chatty" : state.heat < 65 ? "playful and flirty" : "heated, the room is wild";
  return [
    `A still from the Creator's live cam stream, filmed by the webcam, ${state.place ?? "in their usual streaming spot"}.`,
    `The mood is ${heat}.`,
    state.stripMax > 0 && state.strip > 0
      ? `${state.strip} of ${state.stripMax} layers of clothing are off so far.`
      : "",
    order ? `Right now: ${SHOWS[order.itemId]}.` : said?.action ? `Right now: ${said.action}.` : "",
    why === "goal" ? "The room just hit a tip goal; the Creator celebrates." : "",
    why === "tip" ? "Somebody just sent a big tip; the Creator reacts to the camera." : "",
  ]
    .filter(Boolean)
    .join(" ");
}
