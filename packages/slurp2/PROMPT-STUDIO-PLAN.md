# Prompt Studio UI Plan

## Product direction

Slurp uses one prompt architecture: Produce. Classic is not a user-facing mode. The prompt system
stays modular and editable, but the default experience starts from content outcomes rather than
internal prompt implementation.

## Slice status

| Slice | Scope                                                     | Status   | Commit   |
| ----- | --------------------------------------------------------- | -------- | -------- |
| 1     | Prompt Studio page framing and scope context              | Complete | 242ca65e |
| 2     | Group prompt recipes and reduce technical density         | Complete | 0c35b8dc |
| 3     | Make prompt preview explicit and preserve draft context   | Complete | c7a1e41e |
| 4     | Remove visible Classic mode and migrate Produce defaults  | Complete | 95c7a1df |
| 5     | Add a draft-aware compiled prompt preview contract        | Complete | b464ba1e |
| 6     | Add explicit model-generated result preview               | Complete | 4a122cd5 |
| 7     | Replace the settings wall with outcome controls           | Complete | a0bd6310 |
| 8     | Build the focused responsive recipe workspace             | Complete | a0bd6310 |
| 9     | Add draft/current comparison and finish validation        | Complete | 665e6361 |
| 10    | Keep outcome prompts visible and simplify recipe scanning | Complete | 2761e122 |

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
- Keep all Prompt Studio edits in the existing Backstage draft and apply flow.
- Open one recipe at a time; only its selected block expands.
- Use the selected Creator only as preview context in this release.

## Approved redesign acceptance

- The default page leads with Voice & writing, Post behavior, and Image direction outcomes.
- Recipes read as capabilities with purpose, block count, and Default or Custom state.
- Desktop uses recipe navigation, a focused pipeline, and a persistent preview inspector.
- Mobile uses Build and Preview views without horizontal scrolling.
- Preview supports Creator, access, format, and optional direction without persisting a post.
- Draft results can be compared with the currently applied recipe.
- Opening a recipe or block never calls a model.

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

## Slices 7 and 8 proof

- The overview leads with three outcome controls and keeps presets in a compact disclosure.
- Prompt recipes are capability cards with purpose, block count, and customization state.
- The old accordion builder is split into recipe navigation, pipeline, selected-block editor,
  shared-guidance editor, preview inspector, and presentation-model modules.
- Desktop keeps the pipeline and inspector visible together; mobile switches between Build and
  Preview and focuses one selected block at a time.
- Public and locked post guidance now participates in the Backstage draft, discard, and apply flow.
- Opening recipes and blocks only changes local UI state and never starts a preview request.

## Slice 9 proof

- Draft preview accepts Creator, access, format, and optional direction without persisting a post.
- A generated draft result can be compared with a separately generated currently applied result.
- A responsive Playwright regression covers the overview, recipe workspace, selected block,
  mobile Preview view, implicit-request guard, and horizontal overflow at 1440 px and 390 px.
- Playwright discovers both projects. Execution is environment-blocked before page launch because
  this host lacks `libnspr4.so`, and installing Playwright system dependencies requires unavailable
  interactive sudo access.
- Slurp2 typecheck, architecture, prompt-block, route, client-hook, catalog lane, locale, catalog,
  release-note, ESLint, Prettier, and diff checks pass.
- The rebuilt `0.1.5` package installs as active and ready on the scratch `dev-marinara` Engine.

## Slice 10 proof

- Voice, public-post, locked-post, and image prompts remain readable in muted fields outside edit mode.
- The page no longer requires selecting an outcome card before its prompt can be understood.
- Outcome settings and prompt recipes share one main column with a sticky preview inspector.
- Recipes scan as compact capability rows instead of a second dashboard-card grid.
- Collapsed recipe blocks show their resolved prompt text; selecting one reveals its full editor or
  locked inspection state.
- Editable blocks show their source, runtime inputs, character count, reset action, and explicit
  `Apply to draft` action.
