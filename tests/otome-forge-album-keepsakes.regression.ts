// Otome Hearth's Album keeps its finished dates' keepsakes (#2276): one picture per finished date whose keepsake
// paint is ready, with the date's key so the viewer can offer reading the evening again; a keepsake still painting,
// stopped or failed is not a picture; the list is kept in the order the dates came (newest first).
import assert from "node:assert/strict";
import test from "node:test";
import { albumKeepsakes } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/album-keepsakes.ts";
import type { DateEntry } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/dates.ts";
import type { Paint } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";

const KAI = "li-kai-ab12";
const MIR = "li-mireille-cd34";
const ready = (url: string): Paint => ({ state: "ready", url }) as Paint;

const entry = (key: string, li: string, keepsake: Paint | null, changes: Partial<DateEntry> = {}): DateEntry =>
  ({
    key,
    li,
    title: `Evening ${key}`,
    place: "lamp-room",
    placeName: "The Lamp Room",
    makeItRight: false,
    state: "finished",
    outcome: "great",
    plannedAt: "2026-11-01T18:00:00.000Z",
    completedAt: "2026-11-01T20:00:00.000Z",
    keepsake,
    ...changes,
  }) as DateEntry;

test("a finished date's ready keepsake is an Album picture, with its date and its key", () => {
  const pictures = albumKeepsakes([entry("date-3", KAI, ready("/art/keepsake-3.png"))]);
  assert.deepEqual(pictures, [
    {
      key: "keepsake:date-3",
      url: "/art/keepsake-3.png",
      ref: "date-3",
      at: "2026-11-01T20:00:00.000Z",
      li: KAI,
      source: "keepsake",
      title: "Evening date-3",
    },
  ]);
});

test("a keepsake with no ready paint is not a picture; the others keep the order they came in", () => {
  const pictures = albumKeepsakes([
    entry("date-4", MIR, ready("/art/keepsake-4.png")),
    entry("date-3", KAI, { state: "pending" } as Paint),
    entry("date-2", KAI, { state: "failed" } as Paint),
    entry("date-1", KAI, { state: "stopped" } as Paint),
    entry("date-0", MIR, null),
    entry("date-5", MIR, ready("/art/keepsake-5.png"), { completedAt: null }),
  ]);
  assert.deepEqual(
    pictures.map(({ key, li }) => ({ key, li })),
    [
      { key: "keepsake:date-4", li: MIR },
      { key: "keepsake:date-5", li: MIR },
    ],
  );
  // A date counted before it stamped its completion takes its planned time.
  assert.equal(pictures[1]!.at, "2026-11-01T18:00:00.000Z");
});

test("every love interest's keepsakes join the same list, and each names its own date", () => {
  const pictures = albumKeepsakes([
    entry("date-2", KAI, ready("/art/k2.png")),
    entry("date-1", MIR, ready("/art/m1.png")),
  ]);
  assert.deepEqual(
    pictures.map(({ ref, li, url }) => ({ ref, li, url })),
    [
      { ref: "date-2", li: KAI, url: "/art/k2.png" },
      { ref: "date-1", li: MIR, url: "/art/m1.png" },
    ],
  );
  assert.equal(new Set(pictures.map(({ key }) => key)).size, pictures.length, "keys are unique across dates");
});
