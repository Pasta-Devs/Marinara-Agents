# Seasonal story events

Seasonal story events are optional, self-contained story and combat adventures in Events. They complement the existing banner minigames and Character Stories.

## Player flow

- Enable Seasonal events beside a smaller Player choices control in setup or Story Continuity.
- An enabled world prepares the current event overview, known cast, theme and bounded rewards before the player starts its detailed story. Generate optional banner image, animation and soundtrack through the existing media settings and providers.
- At a main chapter boundary, the player can choose the event instead of the next chapter. Detailed chapters are written then, grounded in current story continuity and authored character canon.
- The event runs for 21 local-calendar days using the existing timezone contract. Persist its window and expiry; do not recreate it on refresh, clock changes or restart. Skip missed windows instead of generating a paid backlog.
- Expiry closes new progress and rewards. Played scenes remain in Chapters for rereading. Disabling events must preserve earned rewards and played history.

## Reuse and guarantees

Reuse the existing story renderer, choices, chapter combat, server battle replay, character grounding, reward/inventory systems and media APIs. Keep existing banner events intact. Resources, pull currency, outfits and four-star character rewards use bounded validated grant types and once-only transactional claim records. New-character introductions must be coherent with the world and its current cast.

The two new settings should stay compact, labelled and usable in mobile landscape as well as portrait. Preserve current theme, audio toggles and reduced-motion behavior. Runtime strings use semantic English UI keys.

## Validation target

Prove event window/expiry/timezone/restart behavior, deferred detailed generation, chapter-boundary admission, history/memory grounding, once-only rewards, media fallbacks, cancellation and old-world defaults. Run maintained-source, package, actual SDK/HTTP, browser and install/update/restart/offline/uninstall checks. No physical-device or paid-provider claim without that proof.
