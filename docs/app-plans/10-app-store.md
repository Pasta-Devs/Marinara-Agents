# App Store — rank 9

Status: **decided**.

## Findings
- "Get" installs instantly — no detail page, description, screenshots, or ratings.
- "Remove" has no confirmation.
- "Featured" is just "everything not installed".
- Duplicates the app icon/glyph map that exists elsewhere in the platform.

## Decisions

**Light store polish:**
- App detail page with a description of what each app actually does.
- **Confirm before Remove** — removal can destroy that app's storage.
- Install stays instant; no fake progress bars, no ratings or reviews.
- Reuse the platform's existing app icon/glyph map instead of the local duplicate.

## Open
- Whether "Featured" should be editorial rather than just "not installed".
