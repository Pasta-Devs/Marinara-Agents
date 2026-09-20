# Prompt Studio UI Plan

## Product direction

Slurp uses one prompt architecture: Produce. Classic is not a user-facing mode. The prompt system
stays modular and editable, but the default experience starts from content outcomes rather than
internal prompt implementation.

## Slice status

| Slice | Scope                                                    | Status      | Commit   |
| ----- | -------------------------------------------------------- | ----------- | -------- |
| 1     | Prompt Studio page framing and scope context             | Complete    | 242ca65e |
| 2     | Group prompt recipes and reduce technical density        | Complete    | —        |
| 3     | Explicit model preview flow and consistent draft saving  | Pending     | —        |
| 4     | Remove visible Classic mode and migrate Produce defaults | Pending     | —        |

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
