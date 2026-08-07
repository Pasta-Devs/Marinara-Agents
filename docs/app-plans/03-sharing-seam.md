# Sharing seam (cross-app) — decided

Not an app; the connective tissue. Currently apps never talk to each other — this is the biggest gap.

## Decisions
- **Attach to Messages** — message records carry an image/attachment field. Server + Messages changes.
- **Post to Noodle** — photo posts in the feed.
- **Set as wallpaper / avatar** — pipes a Gallery image into device settings. Local, cheap; do this first.

## Sharing outward, into the real Noodle — from the tester thread

The share targets above are all phone-internal. The thread asked for one that isn't: the **Reference**
and **Noodle** buttons imply sharing what you find on the phone *out* into a chat and into the actual
installation-wide Noodle — posting tabloid gossip you found on Goodle to your timeline, where Noodle's
image captioning describes the screenshot for everyone reading.

The obstacle is scope, and gunterlie named it: **Noodle and NoodleR are ME-installation-scoped; the
phone is world-scoped.** A chat-scoped device posting into the global timeline crosses worlds — which
is the whole appeal for someone building one unified world across every ME surface, and lore pollution
for everyone else.

**Not decided.** The enabling work is already coming from another direction: Noodle and NoodleR are
getting a post-from-chat path regardless, and the phone can ride that rather than inventing its own.
Two shapes were floated and neither was chosen — a **hyperlink** shared into the timeline that reopens
the generated page, or a **screenshot** posted as an image so Noodle captions it. Characters with
phones would be able to share outward too, not just you.

Revisit once the chat→Noodle path lands. Until then the phone's own Noodle stays its own universe
(see [`16-engine-interop.md`](16-engine-interop.md) §1).

## Notes
Entry point is Gallery (and the Camera roll). Needs a shared share-sheet component rather than
per-app buttons, or the same three actions get written three times.
