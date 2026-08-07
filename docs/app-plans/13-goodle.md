# Goodle — rank 12

Status: **decided**. Genuinely the richest app — generated sites, mastheads, nav, shop/forum page kinds.

## Findings
- Back only; no forward navigation.
- No bookmarks, no history beyond the 8 recent searches.
- Section body text can't contain clickable in-page links.
- No images on generated pages (image pipeline now exists — see `01-camera.md`).

## Decisions

All four accepted — Goodle gets the deepest treatment of any app:
- **Forward nav + history** — a real back/forward stack and a browsing history, replacing the
  8-item recent-searches list as the only memory.
- **Bookmarks store the page content**, not just the URL — a bookmark snapshots what the site said, so
  revisiting shows the same page. Generated pages aren't stable across regenerations, so a URL-only
  bookmark would undermine the whole point. The fake web gains permanence.
- **Clickable in-text links** — entities mentioned in page prose become links to further generated
  pages. This is what makes the fake web feel deep, and is the highest-value item here.
- **Images on generated pages** via the image pipeline (see `01-camera.md`).

> **Page images blocked** — see [16-engine-interop.md](16-engine-interop.md).

## Additions from the tester thread ([`20-tester-feedback.md`](20-tester-feedback.md))

Goodle got the most attention of any app in the thread. Three additions:

- **A Goodle Images tab.** "I love the idea of Goodling *Beelthenor's Magic Sword* and clicking images
  to see one." A grid of generated images for a query, separate from web results — and it's the one
  place where images are the point rather than decoration.
- **Per-site image generation button, not automatic.** Pages render with placeholders and a single
  button at the top to generate that site's images. At ~15s per image, auto-generating a page's worth
  of art means a page that takes a minute to load; this makes the cost opt-in per page you actually
  care about. Follows the platform image policy in [`00-platform.md`](00-platform.md) §6, which also
  defines what the placeholders look like when there's no image connection at all.
- **Bookmarks outlive the chat.** Confirms the content-snapshotting decision above and sharpens it:
  the generated-site cache is currently **per chat**, so a site you found is gone in the next roleplay.
  A bookmark caches the page indefinitely and across chats. That's the entire point of bookmarking a
  fake web page.

Also confirmed as working-as-intended, no change needed: configurable LLM for generation, page
templates by site kind, deeper in-site page links, and grounding in lorebook + character + chat context.

**News:** dsbwizzard wanted a news app; agreed it's covered by Goodle's existing page kinds rather than
a fourteenth app.

### Open — what happens when someone types a real URL?

The tester's instinct on seeing a browser was to paste a genuine link (a real Reddit thread) and ask
whether it would open. It won't, and it shouldn't — but nothing defines what it *does* do, and this
will be the first thing many users try.

Three options, none chosen: silently generate a fake page at that address (funny, and the in-world
answer); refuse with an in-character "no connection" style page; or let the model interpret the domain
and generate something that riffs on it. The last is probably right for a world that contains an
internet, but it needs a decision before someone pastes a URL into a low-fantasy world and gets Reddit.
