// ──────────────────────────────────────────────
// Otome Forge: every canonical memory source of a run, for the kit's createForgeStoryMemory (S/memory/memory.ts)
// ──────────────────────────────────────────────
// Each area exports one reader and this file concatenates them; a milestone that adds a kind of canon adds one line:
//   M2a  story chapters (S/story/canon.ts readStorySources): main, route and repair chapters (a Confrontation as the
//        rounds played and its ending) are the kit's `chapter`; a date, and a Memory's Character Story or Moment (a
//        `story-<itemId>` chapter), its `character-story`. Each is summarized and folded into the shared overview
//   M3   phone sessions (S/phone/memory.ts phoneMemorySources: `chat`, audience [their id])
//   M4   owned Snapshots (S/wish/banners.ts itemMemorySources: `chat`, audience [their love interest])
//   M5   Read Him sets (S/minigames/read-him.ts readHimMemorySources) and Claw Machine rounds (S/minigames/claw.ts
//        clawMemorySources), each `chat` with audience [their id] and titled private, as a phone session is
// Audience entries are plain LI ids. A `chat` is a short record kept as written, never in the shared overview; it and a
// love interest's own chapter reach a prompt beyond the overview only for that LI's own readers and scenes whose cast
// includes them (S/memory/memory.ts). Read Me is never a source: its notebook joins the recall pool live on each recall
// (S/memory/memory.ts recallPool), so a deleted entry never comes back. Care data is never a source.
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
