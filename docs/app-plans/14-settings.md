# Settings — rank 13 (strongest)

Status: **decided**.

## Findings
- A flat wall of rows; Device / Effects / Generation groups but no search or hierarchy.
- No live preview when changing theme, wallpaper, tint, or case colour.
- No "About this phone", no per-app settings, no notification/ringtone prefs.
- Connections list loads from `/api/connections` directly rather than via `phoneRequest`.

## Shipped UI pass

Settings is split into compact Device, Generation, and About views. Boolean options use labeled
switches with concise descriptions. Lorebooks use explicit All / Selected / None scope, a search
field, and a bounded scrolling list, so a large installation does not turn Settings into an endless
wall of rows. Existing settings normalize to All for compatibility.

The home launcher is a single vertically scrollable grid of installed apps. It no longer divides
apps into hardcoded dock favorites and hidden horizontal pages.

## Decisions

- **Live preview of appearance** — theme, wallpaper, tint, and case colour update visibly as you pick
  them, instead of blind selection. Settings currently PATCHes on every change, so the preview needs
  local state ahead of the round trip.
- **About this phone** — owner, number, storage used, installed apps.

## Add: Lorebooks — a fourth row in the Generation section

The Generation section already holds `Replies` (a model connection — covers character texts in
Messages), `Feeds & sites` (a second connection — covers Goodle, Noodle, NoodleR, Mail and Tindler)
and a free-text `Custom instructions` field applied to everything the phone generates.

**Lorebooks joins them**: pick the lorebooks/entries this phone reads on every generation, whether or
not they're active in chat context. This is the fix for the cross-world lore leak and the delivery
mechanism for owner-shaped phones — see [`19-background-and-learning.md`](19-background-and-learning.md).

It belongs here rather than on a new screen, and the section's existing helper text is the model for
explaining it: *"Replies covers character texts in Messages. Feeds & sites covers Goodle, Noodle,
NoodleR, Mail, and Tindler."* Note that helper text needs updating anyway once Forum is cut
([`06-forum.md`](06-forum.md)) — Forum is already absent from it.

## Not doing
- Per-app notification preferences.
- Per-app settings surfaced here.

## Also
- Use `phoneRequest` for `/api/connections` instead of a bare `fetch`.
