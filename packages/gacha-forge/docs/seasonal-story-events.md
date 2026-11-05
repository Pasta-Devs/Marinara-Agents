# Seasonal story events

Seasonal story events are optional, self-contained story and combat adventures in Events. They complement the existing banner minigames and Character Stories.

## Player flow

- Enable Seasonal events beside a smaller Player choices control in setup or Story Continuity.
- An enabled world prepares the current event overview, known cast, theme and bounded rewards before the player starts its detailed story. Generate optional banner image, animation and soundtrack through the existing media settings and providers.
- At a main chapter boundary, the player can choose the event instead of the next chapter: Chapters → What happens next offers it beside the next chapter and any Character Story while the next chapter is not forged yet and no Character Story is open (otherwise Events → Story events starts it), and starts it the way a Character Story starts. Detailed chapters are written then, grounded in current story continuity and authored character canon.
- With Pre-forge story on, a started event is pre-forged like a main chapter on the same chain: scenes ahead at no Vigor cost, fights designed after the scene before them, art in Story and images, and the same pre-forge bar, Cancel and Resume. Pre-forge stops once the event ends or events are turned off. A main chapter the open event holds pre-forges nothing until the event is finished, ends or events are turned off, and a pending choice in that chapter does not pause the event or refuse its scenes; afterwards it holds the main story again.
- The event runs for 21 local-calendar days using the existing timezone contract. Persist its window and expiry; do not recreate it on refresh, clock changes or restart. Skip missed windows instead of generating a paid backlog.
- An event is played on Normal first. Once all its scenes and fights are played, its fights open on Hard and then Very Hard while the event is live and Seasonal events is on, with the main chapters' unlocks, scaling, Vigor and once-per-fight pay. They reuse the fights designed on Normal, so no new fight is designed. Each difficulty keeps its own progress, and a cleared fight neither loads nor starts again on its difficulty. The event's own rewards stay Normal's.
- Expiry closes new progress and rewards. Played scenes remain in Chapters for rereading, in the timeline after the chapter the event followed, among the Character Stories after that chapter in the order they were opened. Disabling events must preserve earned rewards and played history.

## Reuse and guarantees

Reuse the existing story renderer, choices, chapter combat, server battle replay, character grounding, reward/inventory systems and media APIs. Keep existing banner events intact. Resources, pull currency, outfits and four-star character rewards use bounded validated grant types and once-only transactional claim records. New-character introductions must be coherent with the world and its current cast.

The two new settings should stay compact, labelled and usable in mobile landscape as well as portrait. Preserve current theme, audio toggles and reduced-motion behavior. Runtime strings use semantic English UI keys.

## Validation target

Prove event window/expiry/timezone/restart behavior, deferred detailed generation, chapter-boundary admission, history/memory grounding, once-only rewards, media fallbacks, cancellation and old-world defaults. Run maintained-source, package, actual SDK/HTTP, browser and install/update/restart/offline/uninstall checks. No physical-device or paid-provider claim without that proof.
