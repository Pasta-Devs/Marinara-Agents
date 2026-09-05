import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  readSlurpAudienceTone,
  slurpAudienceToneInstruction,
  SLURP_AUDIENCE_TONES,
  SLURP_DEFAULT_AUDIENCE_TONE,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-tone.js";

// ── Tone is not spice ───────────────────────────────────────────────────────
// `generationGuidance` and its three presets govern how explicit a Creator's own posts are. None of
// them says anything about whether the audience is kind, so the crowd was uniformly warm — and a
// world where nobody is ever cool toward you has no stakes, because praise from a room that only
// praises is worth nothing.
for (const tone of SLURP_AUDIENCE_TONES) {
  const instruction = slurpAudienceToneInstruction(tone);
  assert.ok(instruction.length > 40, `${tone} needs a real instruction`);
  // Harsh is allowed at the top of the dial; abusive is not, at any setting. Every level states a
  // limit rather than leaving one to be inferred.
  assert.match(instruction, /cruel|abusive/u, `${tone} must state where the line is`);
}
assert.match(slurpAudienceToneInstruction("warm"), /Nobody is cruel/u);
assert.match(slurpAudienceToneInstruction("unfiltered"), /critics/u);
assert.match(slurpAudienceToneInstruction("unfiltered"), /never abusive/u);

// ── The default is the middle ───────────────────────────────────────────────
// The maintainer wants the full range available. It is not the default because this package ships
// to other people, and a hostile default would ambush somebody who wanted a relaxed session —
// moving the dial up is one tap, being ambushed is not recoverable.
assert.equal(SLURP_DEFAULT_AUDIENCE_TONE, "mixed");
assert.equal(readSlurpAudienceTone(undefined), "mixed");
assert.equal(readSlurpAudienceTone("nonsense"), "mixed");
assert.equal(readSlurpAudienceTone(null), "mixed");
assert.equal(readSlurpAudienceTone("unfiltered"), "unfiltered");

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// It has to reach the prompt the audience actually speaks through.
const fanService = read("server/src/services/slurp/slurp-fan-activity.service.ts");
assert.match(fanService, /slurpAudienceToneInstruction\(input\.settings\.audienceTone\)/u);

const storage = read("server/src/services/storage/slurp.storage.ts");
assert.match(storage, /audienceTone: z\.enum\(SLURP_AUDIENCE_TONES\)/u);
assert.match(storage, /audienceTone: SLURP_DEFAULT_AUDIENCE_TONE/u);

// A generated audience member is not a player: no stipend, no renewals, no mirrored settings row.
// getWallet tops any id up to the stipend floor on read, so every member the world touched was
// accumulating coins they can never spend.
assert.match(storage, /if \(this\.isSyntheticWalletHolder\(viewerAccountId\)\) return stored;/u);

const settings = read("client/src/components/slurp/SlurpSettings.tsx");
assert.match(settings, /update\("audienceTone", tone\)/u);

console.log("slurp tone regression passed");
