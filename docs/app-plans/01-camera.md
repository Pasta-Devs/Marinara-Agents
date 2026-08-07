# Camera — rank 1 (weakest)

Status: **decided**, not implemented.

## Findings
- Shutter produces a *text* description, not an image (`POST /phones/:phoneId/camera/shot`).
- Roll lives in the app's own store (`camera:shots`); Gallery never sees it.
- No aim/subject input — "point the camera at the story" but you can't point it.
  **Possibly stale** — gunterlie says subject control is "already done" (tester thread,
  [`20-tester-feedback.md`](20-tester-feedback.md) §11). Verify against the code before building it.
- No delete. Silent 24-shot cap. Every error swallowed (`.catch(() => undefined)`).

## Decisions
**New shutter flow:**
1. Press shutter → LLM generates a description of what the camera would see in the current story context.
2. Description shown **editable** — user can rewrite/refine the prompt before committing.
3. Confirm → send prompt to image generation → real image lands in the roll.

**Roll/Gallery:** Camera keeps its own roll **and** Gallery surfaces the shots. One store, two views.

**Shots reach the chat gallery too.** Chat images already flow *into* the phone; the reverse doesn't
work — a photo taken on the phone stays on the phone. A shot taken in-scene should land in the Engine's
chat gallery like any other generated image, so it exists in the story and not just on the device.
(Tester thread, [`20-tester-feedback.md`](20-tester-feedback.md).) Same contract dependency as the
image generation itself.

**Also:** surface errors, allow deleting a shot, make the 24-cap visible or lift it.

## Dependency — verify before building
Engine selfie/illustrator image pipeline:
`sources/engine/packages/server/src/routes/generate/illustrator-references.ts`
(NovelAI image connections, `illustratorPromptConnectionId` metadata).
Camera needs a server route reusing it. **Fallback:** if the host has no image connection configured,
render the description as a text "photo" card (current behaviour) instead of failing.

> **Blocked** — see [16-engine-interop.md](16-engine-interop.md). The Engine's image pipeline is
> not exposed through the package API contract. Real images need that contract extended first.
