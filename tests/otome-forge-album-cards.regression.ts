// Otome Hearth's Album lists the Tarot deck's cards (#2151, S/routes/album.ts `cards`, S/art/tarot-deck.ts
// albumCards): every deck entry and nothing else, in Arcana order, then by love interest in cast order (one no longer
// in the cast last), each paint as the client sees it (a pending card painting in this process stays pending, one
// that nothing paints reads as stopped, the rest as stored), and reading the Album paints and writes nothing.
import assert from "node:assert/strict";
import test from "node:test";
import type { Paint } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { startPaint } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import {
  deckId,
  normalizeDeck,
  tarotOwner,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/tarot-deck.ts";
import { runDocTarget } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { albumView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import { KAI, MIR, SOL, storyWorld } from "./fixtures/otome-forge-story.ts";

const at = "2026-11-08T10:00:00.000Z";
const GONE = "li-gone-zz99";

test("the Album lists every deck card in Arcana then cast order, each paint as the client sees it", async () => {
  const t = await storyWorld({ runKey: "r-albumcard-aaaaaa" });
  assert.deepEqual((await albumView(t.deps, t.runId)).cards, [], "no deck: no cards");

  const art = {
    ready: { state: "ready", at, url: "/api/global-gallery/file/tarot-fool.png", ref: "g-fool" },
    pending: { state: "pending", at },
    waiting: { state: "waiting-consent", at },
    failed: { state: "failed", at, error: "The provider refused the image." },
  } satisfies Record<string, Paint>;
  // Stored out of order, as readings claim them.
  const stored: Record<string, { card: string; li?: string; art: Paint }> = {
    world: { card: "world", art: art.pending },
    [`lovers@${SOL}`]: { card: "lovers", li: SOL, art: art.waiting },
    [`lovers@${GONE}`]: { card: "lovers", li: GONE, art: art.ready },
    [`hermit@${MIR}`]: { card: "hermit", li: MIR, art: art.ready },
    [`lovers@${KAI}`]: { card: "lovers", li: KAI, art: art.pending },
    fool: { card: "fool", art: art.ready },
    [`lovers@${MIR}`]: { card: "lovers", li: MIR, art: art.pending },
    [`magician@${KAI}`]: { card: "magician", li: KAI, art: art.failed },
  };
  await t.store.mutateDoc(runDocTarget("deck", deckId(t.runId)), normalizeDeck, () =>
    normalizeDeck({ version: 1, cards: stored }),
  );
  const before = await t.store.readDoc(deckId(t.runId), normalizeDeck);
  assert.equal(Object.keys(before!.cards).length, Object.keys(stored).length, "every entry is a valid one");
  // Kai's Lovers is painting in this process; Mireille's and the World were left pending by a restart.
  const release = startPaint(t.runId, tarotOwner(`lovers@${KAI}`))!;
  try {
    const { cards } = await albumView(t.deps, t.runId);
    assert.deepEqual(cards, [
      { key: "fool", card: "fool", art: art.ready },
      { key: `magician@${KAI}`, card: "magician", li: KAI, art: art.failed },
      { key: `lovers@${KAI}`, card: "lovers", li: KAI, art: art.pending },
      { key: `lovers@${MIR}`, card: "lovers", li: MIR, art: { ...art.pending, state: "stopped" } },
      { key: `lovers@${SOL}`, card: "lovers", li: SOL, art: art.waiting },
      { key: `lovers@${GONE}`, card: "lovers", li: GONE, art: art.ready },
      { key: `hermit@${MIR}`, card: "hermit", li: MIR, art: art.ready },
      { key: "world", card: "world", art: { ...art.pending, state: "stopped" } },
    ]);
  } finally {
    release();
  }
  assert.deepEqual(await t.store.readDoc(deckId(t.runId), normalizeDeck), before, "reading the Album writes nothing");
  assert.equal(t.calls.length, 0, "and calls nothing");
});
