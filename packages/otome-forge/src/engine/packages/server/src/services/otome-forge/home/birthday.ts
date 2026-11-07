// ──────────────────────────────────────────────
// Otome Hearth: celebrating a love interest's birthday (#2153), from Remind Me
// ──────────────────────────────────────────────
// - Offers (birthdayOffers): once the story is forged and a chapter after the prologue is read (the phone's "met" rule,
//   S/phone/daily.ts), each love interest's bible birthday can be celebrated on the day and for BIRTHDAY_LATE_DAYS
//   after it (SH/birthdays.ts birthdayWindow), in the request's time zone, as the Home note and the calendar count
//   days. A birthday before the day he joined the cast (his unit's createdAt, read as a local day; none when it does
//   not read) is not offered, nor one whose scene is read to its end. A registered scene not yet read is `started`.
// - Celebrate (celebrateBirthday, POST /home/birthday): builds his one-scene Character Story,
//   `story-birthday-<li>-<year>` (S/items/character-story.ts birthdayStoryChapter), with no model call, saves it (the
//   first save wins) and registers it in `chapters[key]` with the Shop gift given, if any, in one revision-checked
//   write of the state, exactly as Date Night spends a gift (giveGift: 409 `conflict` with none left, 409 `locked` for
//   the aphrodisiac under SFW Heat). A refused write removes the scene again, so nothing is spent. The scene is written
//   when the reader opens it, as any Character Story's. A love interest whose scene for that birthday year is already
//   registered (a double tap, a second tab, a resend after the late days ended) is answered `resumed` and spends
//   nothing; with no offer open it is 404 `not-found`. It makes no model call, so it does not wait in the run's
//   foreground queue behind a scene being written ahead: the once-only mark is the state's `chapters[key]`.
// - Rewards: the scene pays its beat like any Character Story, and the gift's affection (SH/shop.ts GIFT_AFFECTION)
//   when it is read to its end, uncapped (S/state/rewards.ts). Celebrating earns nothing of its own.
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type { LiId } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  birthdaySceneKey,
  birthdayWindow,
  lastBirthday,
  type BirthdayOffer,
} from "../../../../../client/src/features/otome-forge/shared/birthdays.js";
import type { GiftId } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { OtomeForgeError } from "../http.js";
import { PROLOGUE_KEY, chapterId, runDocTarget, stateId } from "../ids.js";
import { birthdayStoryChapter } from "../items/character-story.js";
import { giveGift } from "../minigames/date-night.js";
import { normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";
import { todayKey } from "./note.js";

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const noBirthday = () => new OtomeForgeError(404, "No birthday to celebrate.", "not-found");

/** The birthdays that can be celebrated on the local day `today` (see the header), in cast order. */
export function birthdayOffers(run: RunDocuments, today: string): BirthdayOffer[] {
  if (run.world.forge.phase !== "ready") return [];
  if (!Object.entries(run.state.chapters).some(([key, chapter]) => key !== PROLOGUE_KEY && !!chapter.completed)) {
    return [];
  }
  return Object.keys(run.state.lis).flatMap((li) => {
    const unit = run.units.find((entry) => entry.id === li);
    const window = unit?.bible ? birthdayWindow(unit.bible.birthday, today) : null;
    if (!unit || !window) return [];
    const joined = Date.parse(unit.createdAt);
    if (Number.isFinite(joined) && window.day < forgeDayKey(joined)) return [];
    const progress = run.state.chapters[birthdaySceneKey(li, window.year)];
    if (progress?.completed) return [];
    return [{ li, day: window.day, daysLate: window.daysLate, started: !!progress }];
  });
}

/** POST /runs/:run/home/birthday {li, gift?}: see the header. */
export async function celebrateBirthday(
  deps: { store: OtomeStore },
  runId: string,
  li: LiId,
  gift: GiftId | undefined,
  today: string = todayKey(),
): Promise<{ key: string; resumed: boolean }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const unit = run.units.find((entry) => entry.id === li && entry.bible);
  // His latest birthday's scene, registered already: answered as it is, whether its late days are over or not.
  const last = unit?.bible ? lastBirthday(unit.bible.birthday, today) : null;
  if (last && run.state.chapters[birthdaySceneKey(li, last.year)]) {
    return { key: birthdaySceneKey(li, last.year), resumed: true };
  }
  const offer = birthdayOffers(run, today).find((entry) => entry.li === li);
  if (!unit || !offer) throw noBirthday();
  const year = Number(offer.day.slice(0, 4));
  const chapter = birthdayStoryChapter(unit, { year, daysLate: offer.daysLate, gift }, new Date().toISOString());
  const { key } = chapter;
  // Another request may have saved it first: its gift is the one given.
  const saved =
    (await deps.store.mutateDoc(
      runDocTarget("chapter", chapterId(runId, key)),
      normalizeChapter,
      (current) => current ?? chapter,
    )) ?? chapter;
  // Set by the write that was saved (updateDoc applies the change again after a stale revision).
  let registered = false;
  let state;
  try {
    state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
      registered = false;
      if (current.chapters[key]) return current;
      registered = true;
      return {
        ...(saved.gift ? giveGift(current, run.world.content, saved.gift) : current),
        chapters: { ...current.chapters, [key]: { beatsRead: 0, completed: null, applied: [] } },
      };
    });
  } catch (error) {
    // Refused (the gift is gone, or Heat no longer offers it): the scene goes too, unless another request has
    // registered it meanwhile.
    const now = await deps.store.readDoc(stateId(runId), normalizeState);
    if (!now?.chapters[key]) await deps.store.removeDoc(chapterId(runId, key));
    throw error;
  }
  if (!state) {
    // The run was deleted meanwhile: its scene goes too, rather than outlive the run.
    await deps.store.removeDoc(chapterId(runId, key));
    throw runNotFound();
  }
  return { key, resumed: !registered };
}
