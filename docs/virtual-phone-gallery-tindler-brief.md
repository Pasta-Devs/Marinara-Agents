# Gallery, Tindler, and Noodler tabs — briefs

## Gallery

The phone's camera roll, sourced from the story itself: every image URL that appears in the chat transcript (markdown images and bare image links) becomes a photo.

- **Routes:** `/` three-column photo grid, `/photo` full view.
- **Data:** derived read-only from chat messages via `listMessages` across the phone's `chatScope`; deduped, newest first, capped at 60. No records, no model. Preinstalled.
- **States:** skeleton grid while scanning, "No photos yet" empty state, refresh top-bar action.

## Tindler

The world's dating app. Model-generated profile decks of single side characters; placeholder photos (name-hashed gradient + initials) until an image capability exists.

- **Routes:** `/` card deck, `/matches` match list (heart top-bar action).
- **Data:** record `dating-profile`, `phone-local`. Store keys: `deck` + `deckIndex` (resume mid-deck), `matches`, `preferences`. `modelUse: "heavy"`, removable, App Store install.
- **Preferences:** a persistent free-text field ("Looking for…") saved per phone and fed into deck generation.
- **Generation:** `{"profiles":["Name, Age | tagline | two-sentence bio", ...]}` — 5 side characters, never protagonists, seeded with story context, bounded parse, empty deck on failure ("No one around right now").
- **Swiping:** ✕ advances, ♥ saves to matches and advances; end of deck offers "Find new people".

## Noodler tabs

Noodler grows from a flat feed into a two-tab app: **Feed** (posts, as before) and **Trending** — 5 ranked in-world hashtags as `{"topics":["#Tag | why it's trending"]}`, story-seeded, cached per phone under `trending`. The tab bar is app-local bottom navigation; the refresh action refreshes whichever tab is active.
