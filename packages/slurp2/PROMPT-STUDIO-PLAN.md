# Prompt Studio UI Plan

## Product direction

Slurp uses one prompt architecture: Produce. Classic is not a user-facing mode. The prompt system
stays modular and editable, but the default experience starts from content outcomes rather than
internal prompt implementation.

## Slice status

| Slice | Scope                                                    | Status      | Commit   |
| ----- | -------------------------------------------------------- | ----------- | -------- |
| 1     | Prompt Studio page framing and scope context             | Complete    | 242ca65e |
| 2     | Group prompt recipes and reduce technical density        | Complete    | 0c35b8dc |
| 3     | Make prompt preview explicit and preserve draft context  | Complete    | c7a1e41e |
| 4     | Remove visible Classic mode and migrate Produce defaults | Complete    | 95c7a1df |
| 5     | Add a draft-aware compiled prompt preview contract       | Complete    | b464ba1e |
| 6     | Add explicit model-generated result preview              | Complete    | 4a122cd5 |

## Slice 1 proof

- Keep prompt behavior unchanged.
- Use one clear page title and purpose statement.
- State that settings apply globally and that previews use a selected Creator.
- Keep the existing advanced builder available.
- Run the focused prompt and settings regressions, then `npm run check`.

## Decisions

- Generate a model preview only after the user clicks the preview action.
- Support global defaults first, with Creator-specific overrides as a later layer.
- Show both the generated result and the exact compiled prompt in the eventual preview surface.
- Do not expose Classic as a second user-facing architecture.

## Slice 2 proof

- Prompt recipes are grouped by writing, messages, audience, profiles, images, and world.
- Each recipe has a plain-language purpose summary.
- Existing block editing, ordering, and save behavior remain available.
- Focused prompt regressions and Prettier pass.
- Slurp2 typecheck is blocked on September 20, 2026 because the host has no free disk space for
  the typecheck script's temporary copy.

## Slice 3 scope

- Opening a recipe must not call the preview endpoint.
- Preview runs only after an explicit `Preview recipe` action or block-level preview action.
- Keep the selected Creator visible as the preview context.
- Add the full model-generated result preview in a later sub-slice after the draft payload contract is
  defined.

## Slice 4 proof

- The Prompt Studio no longer renders a prompt mode selector.
- The builder always edits the Produce inventory.
- Classic is hidden from Backstage search while internal compatibility code remains available.
- Existing stored Classic data is not deleted by this UI slice.

## Slice 4 proof

- Prompt preset, client hook, and prompt block regressions pass.
- Prettier and `git diff --check` pass for the changed source and plan.
- Full package typecheck remains blocked by the host disk-space failure recorded above.

## Slice 5 scope

- Send the current Produce recipe draft and reusable instructions to the no-model preview route.
- Return the full ordered compiled prompt with the rendered block values.
- Keep preview explicit and preserve privacy redaction from the real prompt builder.

## Slice 5 proof

- Draft block order, custom text, reusable instructions, and optional state resolve through one
  shared server function.
- The preview route returns rendered blocks and the complete compiled prompt.
- The client sends the current unsaved draft only after an explicit preview action.
- `tests/slurp-prompt-blocks.regression.ts`, `tests/slurp2-prompt-presets.regression.ts`,
  `tests/slurp2-client-hooks.regression.ts`, and `tests/slurp2-route-inventory.regression.ts` pass.
- `node scripts/typecheck-packages.mjs slurp2` passes with `TMPDIR=/home/dev/.cache/marinara-tmp`.
- Prettier and `git diff --check` pass for the changed files.

## Slice 6 proof

- `Generate result` is a separate explicit action from no-model prompt inspection.
- The model preview uses the selected Creator and the current unsaved Produce draft.
- The server calls the configured text connection and returns title, content, image prompt, and the
  exact prompt used.
- Preview calls use `prepareOnly` and `previewOnly`; they do not persist posts or write shoot
  continuity state.
- Client and route inventories were updated for the intentional new endpoint.
- Focused regressions, architecture regression, Slurp2 typecheck, Prettier, `git diff --check`, and
  `npm run check` pass. `npm run check` reports 0 errors and existing warnings.
