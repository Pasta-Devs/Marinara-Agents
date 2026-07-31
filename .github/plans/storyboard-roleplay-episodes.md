# Storyboard Roleplay Episodes

Status: package work for Marinara-Agents issue #144, paired with Marinara Engine issue #4311 and Engine PR #4326.

## Package contract

- Preserve every existing Game Storyboard planner prompt byte-for-byte.
- Add `roleplay` to the Storyboard mode allowlist while retaining host-managed execution.
- Default Roleplay cadence to every assistant response; allow a per-chat override from 1 to 100.
- Add a separate, editable Roleplay prompt library rather than interpolating mode variables into Game prompts.
- Compile Roleplay prompts from one episode/source contract, one selected visual-style module, the animation addon only for animation mode, and one shared JSON output contract.
- Provide Roleplay style modules for Normal/Anime, NovelAI, Comic, Colored Manga, and B&W Manga.
- Keep provider-facing image and video formatter libraries shared; keep LTX-specific formatting in the Engine provider layer.
- Rebuild the package, ZIP, hashes, catalogs, and catalog lanes together.

## Delivery boundary

Marinara-Agents owns the Storyboard definition, defaults, editable prompt fragments, manifest, artifact, and catalog entries. Marinara Engine owns Roleplay source selection, cadence anchoring, prompt compilation, provider routing, storage, settings UI, and inline rendering.

## Validation

- Verify the new Roleplay fragments have unique IDs and valid default selections.
- Compare the Game planner prompt library against the existing Engine Storyboard 1.0.0 snapshot.
- Run `node scripts/build-agent-catalog.mjs storyboard`.
- Run `node scripts/test-catalog-lanes.mjs`.
- Run `node scripts/validate-catalog.mjs`.
- Run `git diff --check`.
- Manually install/update Storyboard from the paired Engine staging branch and verify Game and Roleplay activation.
