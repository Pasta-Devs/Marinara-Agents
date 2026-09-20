# Prompt Studio UI Plan

## Product direction

Slurp uses one prompt architecture: Produce. Classic is not a user-facing mode. The prompt system
stays modular and editable, but the default experience starts from content outcomes rather than
internal prompt implementation.

## Slice status

| Slice | Scope                                                    | Status      | Commit |
| ----- | -------------------------------------------------------- | ----------- | ------ |
| 1     | Prompt Studio page framing and scope context             | In progress | —      |
| 2     | Group prompt recipes and reduce technical density        | Pending     | —      |
| 3     | Explicit model preview flow and consistent draft saving  | Pending     | —      |
| 4     | Remove visible Classic mode and migrate Produce defaults | Pending     | —      |

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
