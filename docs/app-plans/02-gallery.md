# Gallery — rank 2

Status: **partly decided**.

## Findings
- Read-only mirror of chat images (`GET /phones/:phoneId/gallery`, scans chat messages, caps at 60).
- No delete, save, or share. Doesn't know Camera exists.
- Lightbox is a dead end: no next/prev, no captions, no download.
- All images render with `alt=""`.

## Decisions
- **Next/prev in the lightbox** (swipe + arrow keys).
- Shows Camera roll shots alongside chat images (see `01-camera.md`).
- Origin point for the sharing seam (see `03-sharing-seam.md`).

- **Captions + real alt text** — per-image caption doubling as the `alt` attribute. Today every image
  is `alt=""`, which is an accessibility hole as well as a UX one.
- **Delete / hide a photo.**
- **Two-way with the chat gallery** — Gallery mirrors chat images today, but phone-taken photos never
  travel back. They should. See [`01-camera.md`](01-camera.md).

## Not doing
- Albums / grouping by source or date.

> **Source change** — see [16-engine-interop.md](16-engine-interop.md). Gallery should read the
> Engine's `chat_images` table (which carries the generation prompt, usable directly as the caption)
> rather than regexing image URLs out of message text.
