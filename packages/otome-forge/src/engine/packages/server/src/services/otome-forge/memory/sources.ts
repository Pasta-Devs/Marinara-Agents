// ──────────────────────────────────────────────
// Otome Forge: every canonical memory source of a run, for the kit's createForgeStoryMemory (S/memory/memory.ts)
// ──────────────────────────────────────────────
// Each area exports one reader and this file concatenates them; a milestone that adds a kind of canon adds one line:
//   M2a  story chapters (S/story/canon.ts readStorySources); M2b's route and repair chapters arrive through it as
//        `chat` with audience [li], like a date, and a Confrontation as the rounds played and its ending
//   M3   phone sessions (S/phone/memory.ts phoneMemorySources: `chat`, audience [their id])
//   M4   owned Snapshots (S/wish/banners.ts itemMemorySources: `chat`, audience [their love interest]; a Character
//        Story or Moment is a `story-<itemId>` chapter, so it arrives through readStorySources)
//   M5   Read Him sets (S/minigames/read-him.ts readHimMemorySources) and Claw Machine rounds (S/minigames/claw.ts
//        clawMemorySources), each `chat` with audience [their id] and titled private, as a phone session is; a date
//        is a `date` chapter, which S/story/canon.ts already makes a private `chat` source for that love interest
// Audience entries are plain LI ids: a `chat` source is recalled only by that LI's own readers and by scenes whose cast
// includes them, never into the shared overview (plan §1.9, design: Private memory). Care data is never a source.
import { orderForgeStorySources } from "@forge-kit/story-memory-integration.mjs";
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import { playerId, stateId } from "../ids.js";
import { clawMemorySources } from "../minigames/claw.js";
import { readHimMemorySources } from "../minigames/read-him.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeState } from "../schemas/state.js";
import { phoneMemorySources } from "../phone/memory.js";
import type { OtomeStore } from "../store.js";
import { readStorySources } from "../story/canon.js";
import { itemMemorySources } from "../wish/banners.js";

/** The run's sources in story order (the kit's `readSources(runId)`); [] for a run that has no state. */
export async function readMemorySources(
  store: Pick<OtomeStore, "readDoc" | "listRun">,
  runId: string,
): Promise<ForgeMemorySource[]> {
  const [state, player] = await Promise.all([
    store.readDoc(stateId(runId), normalizeState),
    store.readDoc(playerId(runId), normalizePlayer),
  ]);
  if (!state) return [];
  const protagonist = player?.name ?? "";
  const [story, phone, items, readHim] = await Promise.all([
    readStorySources(store, runId, state, protagonist),
    phoneMemorySources(store, runId, state),
    itemMemorySources(store, runId, state),
    readHimMemorySources(store, runId, state),
  ]);
  const sources = [...story, ...phone, ...items, ...readHim, ...clawMemorySources(state, protagonist)];
  return orderForgeStorySources(sources.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
}
