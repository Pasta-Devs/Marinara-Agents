## 1.23.0 — 2026-10-26

- Keep playing: leave a main chapter that is still forging. It keeps forging, the busy pill shows its progress, and a notice says when it is ready, could not be forged or was interrupted. Pre-forging starts once it is ready. Cancel on any story loader still stops it, and switching worlds waits for it.
- Pre-forge "Story and key images" is now "Story and images". With Backgrounds on, it also paints the places each pre-forged scene visits, in main chapters and Character Stories. Worlds already on this setting start painting places ahead after updating.
- Pre-forged art now paints alongside the text, so the chapter menu opens once the text is written. A scene opened before its art is ready joins the paint in progress. Art may keep painting for a while after the menu opens; switch to Story only or Off, or use the story Cancel, to stop it.
- Pre-forging no longer reports stopped, or lets Retry start a second chain, on chapters that take over 20 minutes.

## 1.22.1 — 2026-10-26

- In Formation, a unit's Skills tab shows its Formation kit (abilities, costs, triggers and special mechanics) instead of the classic skills, and the kit no longer appears as plain text on every tab.
- Chapter plans, Character Story plans, story beats and event chapters request 16,384 answer tokens on top of the reasoning reserve.

## 1.22.0 — 2026-10-26

- Banner animations say why they failed, play on phones away from the server, and never offer a paid retry for a saved clip.
- Water beats Fire, Fire beats Earth, Earth beats Wind, Wind beats Water, in both combat modes and on the Home chart.
- Formation conversion handles five-star traits, converts one character at a time, explains failures and keeps ready kits.
- The Vigor countdown always shows below full and stops flickering.
- Story choices appear without reopening the story.
- Letters fill the screen with a shorter reply box, and Read message lists your bonded units.
- New messages show as a styled card on Home with the opening lines.
- The story mute button and help marks match their neighbours.

## 1.21.2 — 2026-10-26

- Keep an unchanged, decoded unit portrait mounted while switching unit tabs. Replace it normally when the unit or artwork changes.
- Preserve cached Units cards when a background refresh returns identical data, while keeping real card updates and loading status current.

## 1.21.1 — 2026-10-26

- Explain banner animation failures with safe recovery hints and the provider HTTP status when available.
- Keep failed attempts saved across reopening, retain existing clips, and require an explicit retry before another generation request.

## 1.21.0 — 2026-10-26

- Download individual images from every Home background picker category without selecting them. Reuse Engine gallery saving, including prepared iPhone sharing.
- Unlock story and Character Story backgrounds and key images only after viewing their scenes, with a brief unlock notice. Future generated scenes stay out of the picker.
- Preserve completed scenes, saved artwork and existing background choices across updates and chapter regeneration.

## 1.20.0 — 2026-10-25
- Add optional daily messages from randomly selected units with conversations unlocked, configured in setup or Story Continuity and disabled by default.
- Keep incoming conversations saved, preserve drafts and pace generation within each local day without offline catch-up.
- Open mobile Writing help above Settings with outside-tap dismissal and compact question-mark controls.
- Request at least 8,192 output tokens for every text generation, including character messages and Formation kits, while retaining reasoning headroom. Report insufficient connection capacity instead of silently using a smaller output cap.
- Keep Classic and Formation descriptions readable beside their setup choices.
- Preserve the paced message deadline when reopening a world or updating its settings.

## 1.19.0 — 2026-10-25

- Choose optional Formation combat: frontline actions, protected elemental supports, shared energy, repositioning and generated tactical kits.
- Convert saved worlds after confirmation with bounded parallel generation, persistent progress and explicit retry, preserving characters and progression.
- Add creative, validated boss objectives, elemental Ultimate portrait effects and optional fixed, saved combat voice lines for assigned voices.
- Keep Classic combat, existing boss dialogue and authoritative reward replay.

## 1.18.0 — 2026-10-25 [highlight]

- Enable optional Seasonal events beside compact Player choices in setup or Story Continuity.
- Explore a new, world-specific story and combat adventure every three weeks, with an event banner and optional animation and music. Event themes, familiar cast and rewards are prepared before you start; the chapter is written against current canon when you choose to play.
- Earn bounded resources, Aether, four-star characters or themed outfits once. Expired events close new progress and rewards; played scenes remain in Chapters. Existing banner minigames stay available.
- Keep event progress and rewards safe across refresh, restart, opt-out and concurrent requests, using existing chapter, combat and media systems.

## 1.17.0 — 2026-10-25 [highlight]

- Regenerate an ongoing chapter or the current open Character Story from its bottom action after a named confirmation. Completed chapters remain protected.
- Discard only the selected chapter’s story, choices and reading progress, then write a fresh plan with current settings and character cards. Preserve other chapters, conversations, characters, inventory and earned rewards.
- Stop and drain pending story work before resetting. Replaying cleared progress does not award first-clear rewards again; the usual Vigor cost to play still applies.

## 1.16.1 — 2026-10-25 [highlight]

- Restore first-send character replies and keep sent and remembered messages scrollable in the same chat window, without automatic resends.
- Use current linked character cards’ full Description, Personality, Backstory and Appearance in story prompts, excluding card Scenario, greetings and example dialogue.
- Keep Writing help buttons compact and preserve tapped explanations through viewport updates.
- Use “They did not answer.” as the neutral direct-message failure fallback.
- Hide the neutral story portrait silhouette when the current artwork is loaded, retaining safe loading and missing-art fallbacks.
- Restore explicit banner animation recovery after playback or stale-clip errors. Failed replacement attempts keep previous saved media; successful replacements receive a fresh immutable URL.

## 1.16.0 — 2026-10-25

- Punctuate choice labels. Keep the correct speaker portrait and prevent fullscreen/mute from advancing.
- Tap Writing help on mobile; keep daily rewards clear of Claim and animate loaded unit art smoothly.
- Use the current timezone for resets and new banner periods, including clock changes. Catch up automatic chapter memory on world open; retain manual controls and show compressed/combined counts.
- Auto-select affordable character, weapon, relic and skill upgrades before confirmation. Auto-equip the best free gear and clear stale Units dots.
- Open farming domains from upgrade materials and show their next rotation; Mandates open their Login Event.
- Reuse matching dialogue audio; reveal fresh opening lines while preserving saved reading positions.
- Generate richer music briefs with world motifs, varied arrangements and musical development.

## 1.15.2 — 2026-10-24 [highlight]

- Show actionable Seedance setup guidance when a banner cannot be animated, and keep Retry visibly busy while generation is pending. Saved clips and the original banner illustration remain available.

## 1.15.1 — 2026-10-24 [highlight]

- Cancel chapter and story generation from the loading screen and return to Gacha Home without deleting the world or saved progress. Active story requests and chapter preforging stop, and late responses cannot reopen the cancelled screen.

## 1.15.0 — 2026-10-24

- Choose a generated song for the Home menu in Settings → Look → Visual. Saved songs remain playable when generation is off.
- Generate a distinct soundtrack for each summon banner and collect it for Home music when pulling any 5-star from that banner.
- Keep banner rotations separate and reuse generated songs after reload.
- Select an optional Animations video connection in Sources to generate saved looping banner clips. Portraits remain still.
- Reuse clips after reload, keep the illustration on failures or reduced motion, and offer pause, play and explicit generation retry controls.

## 1.14.0 — 2026-10-24

- Automatically remember completed canonical chapters and Character Stories, alongside saved character-chat memories.
- Maintain a compressed overview within 10% of the generation model's known context, retaining detailed originals for relevant recall.
- Recall up to three additional chapters plus separate character memories; retain the entire previous chapter and the current chapter so far.
- Show automatic continuity status and allow retrying failed memory work without blocking gameplay.

## 1.13.1 — 2026-10-24

- Character scenes, banners, portraits and outfits use available character/persona avatar references; provider support and limits still apply.
- Story artwork starts below its header and preserves the top of the image.
- Mobile ordinary and expanded editors adapt to the height left by the keyboard; expanded settings drafts survive refreshes.
- Units explains the Home progression dot and refreshes its recommendation after level, equip and ascension actions.
- Blocking combat dialogue supports keyboard focus and returns to combat controls afterward.

## 1.13.0 — 2026-10-24

- Added Soldier, Elite and Boss enemy tiers in combat and enemy details.
- New story chapters build toward a boss confrontation using existing boss mechanics.
- Significant fights prepare contextual enemy dialogue, with local one-shot triggers and manual or Auto progression.
- Combat dialogue respects assigned character voices, mute and dialogue volume. Existing saved chapters and Tower encounters remain playable.

## 1.12.2 — 2026-10-24

- Home shows a compact affinity matchup diagram beneath the communication button.
- Home backgrounds retain the top of the selected artwork below the game header.
- Combat shows one mute control without overlapping the other toolbar buttons.
- Autoplay resumes after a small story choice when it was enabled before the choice.
- Character communication keeps the composer visible when a mobile keyboard reduces the available height.

## 1.12.1 — 2026-10-24

- Chapters and Character Stories generate and play their own music cues instead of reusing the Home track. Loading scenes keep the current track until their cue is ready.
- Small choices no longer block later shared narration or background pre-forging. Their alternatives remain generated together; playback, canon, replay and big-choice locks are preserved.
- Completion and compression still wait for pending selections to preserve canonical story history.
- Short audio notices no longer intercept taps on the game stage. Long reasons remain scrollable and stay visible while focused with a keyboard.
- Notice scrolling adapts when the panel becomes visible or changes size; replacing a long reason with short text restores dismissal.
- Recorded the actual merged Engine music-test baseline.

## 1.12.0 — 2026-10-24

### New

- World-specific soundtrack briefs generated through the narration connection, cached for each music context and translated into original musical qualities.

### Fixed

- Audio failures show their HTTP status and, on newer Engine hosts, the provider's safe rejection reason while stock audio continues.
- Unit and relic achievements count every gained level; capped duplicates do not count as gained facets, and Tower-shop facet gains count.
- Existing worlds recover proven achievement progress without changing claimed rewards or pass progress.

## 1.11.1 — 2026-10-23

- Fixed generated music and effects for worlds using migrated legacy audio connections.
- Recorded the merged Engine audio connection baseline.

## 1.11.0 — 2026-10-23

### New

- Optional dialogue using explicitly assigned Engine character voices, with the current speech connection.
- Stock Game music and effects, plus opt-in generated audio reused per world and cue.
- A shared mute control, three precise channel volume sliders and configurable autoplay pacing.

### Fixed

- Home and story portrait frames include their bottom edge.

## 1.10.2 — 2026-10-23

- New dialogue choices show intent labels instead of revealing the exact spoken line. Selected actions appear as narration; explicitly spoken choices remain protagonist dialogue.
- Existing untyped saved choices remain playable as narration. First-play canon, replay alternatives and permanent big decisions are preserved.

## 1.10.1 — 2026-10-23

- Fixed: the Welcome Gift rewards no longer overlap Claim on short mobile screens. The event scrolls when needed, and Claim has a larger touch target.

## 1.10.0 — 2026-10-23

- Choose your protagonist's dialogue or actions from two to four themed options above the dialogue box. Player choices are on by default in Settings > Story > Continuity.
- Small choices include every alternative scene in the same generation and return to the shared story. Your first-play choices become canon; replaying another route does not rewrite them.
- A chapter or Character Story can end with one optional big choice. That fate is permanent, and later story generation waits for it before continuing from the chosen outcome.
- Choices survive reloads. Existing linear chapters still work; turning choices off affects newly written scenes and keeps existing decisions.

## 1.9.1 — 2026-10-23

- Chapter fullscreen controls now use a small icon aligned with the top-right header fade, with a usable touch target and visible keyboard focus.
- Visible unit portraits use eager loading and synchronous decoding on detail updates.
- Favorite and help icons are centered; unit cards show their existing affinity symbol in the top-right corner.

## 1.9.0 — 2026-10-22

### New

- The fullscreen control beside Settings expands inside the Engine, hiding Home browser controls while keeping the Engine topbar. Outward/inward arrows show the action, and the button works on iPhone Safari too.
- Every Forge screen fills the available width and height instead of fitting a fixed 16:9 frame.
- A floating exit control stays available on screens without the shared toolbar and on the portrait rotation notice. Requires Engine capability API 1.376.

## 1.8.15 — 2026-10-22

- Fixed: on iPhone and other Safari-based browsers, ticking a cast member or an outfit theme no longer scrolls the list (and, on a phone turned sideways, the whole world-creation page) back to the top.

## 1.8.14 — 2026-10-22

- On a phone turned sideways, creating a world now uses the whole width of the screen and scrolls as one page: the title and the step tabs scroll away with the fields, and a slim Back and Next row stays at the bottom until you start typing.
- Fixed: tapping a text field in the game no longer makes iPhone zoom in.

## 1.8.13 — 2026-10-19

- Fixed: places named in Korean, or in any other non-Latin script, get their background painted. Their names used to come out empty, so the background was never made; places whose names mixed Hangul and numbers could also share one background.
- Backgrounds already painted for a place keep showing; nothing is painted twice.
- On a phone held sideways the game uses more of the screen, text no longer grows when you turn the phone, and Settings packs its panels tighter. Where the browser has no fullscreen (iPhone Safari), the fullscreen button is hidden instead of doing nothing.

## 1.8.12 — 2026-10-02

- Fixed: Character Stories can be merged too. In Settings > Continuity a compressed Character Story takes a tick like a chapter, and merges with the chapters next to it or with other Character Stories; the merged entry names each one, and the story never sends a merged one twice.
- Only chapters played to the end can be merged, and a merge that cannot happen says why.

## 1.8.11 — 2026-10-01

- Fixed: a Tower boss that heals no longer gets back a quarter of its health with every Ultimate — it heals about as much as one of its escorts would, and the floor 40 boss is fitted to its floor again. In Water months, bosses no longer heal 8% of their health per Ultimate.
- Fixed: on a slow image connection, art is painted once: a chapter's backgrounds and enemies, banner art, portraits, key images, Bond backgrounds and outfits.
- Fixed: an outfit rotation keeps every outfit it already painted, even if the rest fails, and a Bond outfit you already have but that never counted as claimed is handed over instead of painted again.

## 1.8.9 — 2026-09-30

- Fixed: the story now calls each character the man or woman they are. With a vague description it could narrate someone drawn as a woman as “he”, or the other way around.
- Every character has a sex whether the world has art or not: new ones are created with it, and the ones you already have are filled in once, the first time the story is told.

## 1.8.8 — 2026-09-29

- Fixed: with a Character Story open, the chapters you already cleared open again — their map, their scenes, and their Hard and Very Hard fights. Only the next chapter of the main story waits for the Character Story to end.

## 1.8.7 — 2026-09-25

- Fixed: world creation lists your whole character card library. It stopped at 100 cards, so a library larger than that died around the letter M and the cards past it showed in your cast as “No longer in your library”.
- Fixed: loading a preset no longer leaves out cards it could not see — it reads the whole library before deciding what the Engine still has.

## 1.8.6 — 2026-09-23

- Fixed: on a phone held upright, the Landscape only notice no longer covers the rest of Marinara. Characters, lorebooks and anything else you open over the game are reachable again.

## 1.8.5 — 2026-09-21

- The opening story is optional. Forge this world asks if you are sure, then whether to write it now or later; later, the world opens as soon as its cast is ready, with Summon unlocked, and Modes > Story writes it when you ask. If it fails while the world is being created, Skip the story for now keeps the world.
- World creation keeps what you write and brings it back on any device, and has presets: save, load, rename, replace or delete a whole setup, from the wizard or from a world you already created.
- Models that think a lot before answering (GLM, DeepSeek) no longer lose the first try of nearly every call to the output limit.
- Fixed: a card, lorebook, connection or persona you create or change in Marinara shows up in the game as soon as you come back to it.
- Fixed: a character made from a card or a Cast lorebook entry reads the World lorebook entries that name them.

## 1.8.2 — 2026-09-17

- Buffs and debuffs name their stat: a buff can raise ATK, DEF, SPD or crit chance, a debuff can drop DEF, ATK or SPD. Characters you already have fight exactly as before.
- Newly minted characters and enemies stop piling up on ATK up, DEF down and shields: each new one is asked for what the cast still lacks.
- Fixed: an outfit rotation whose theme came from your Theme library was painted, lost when it was saved and minted again on every visit. It now saves, and a rotation that fails twice in a row stops retrying.
- Fixed: a scene keeps your line when the browser reloads the tab.
- Fixed: when the connection lists cannot be read, the setup and Settings say why instead of opening an empty list.
- Importing a theme set refuses oversized files and cleans control characters out of titles; creating a world no longer spends a retry on two malformed answers.

## 1.8.1 — 2026-09-15

- Writing a chapter ahead keeps going on its own: switching tabs, closing Gacha Forge or changing worlds no longer stops it.
- Coming back to the Gacha Forge tab no longer drops you on "Generating story" or inside a scene you had not reached, and a scene you were reading stays on its line.
- The character cards you pick can be moved up and down; the game takes them in that order. The Cast lorebook list can be expanded like World lorebooks.
- The card counter in world creation also counts the two cards each featured banner takes.
- Characters written in your world's language keep their accents and their ñ.
- Fixed: in Firefox the top bar no longer runs past the game at large text sizes; the creator's scrollbars keep their distance; the expanded lorebook list in Settings draws its rows again.

## 1.8.0 — 2026-09-14

- Combat is manual: on each turn you choose what a unit does and who it hits. Auto still plays the fight for you.
- The Tower opens at Rank 20: a hundred floors, Tower Coin and a Tower shelf in the Shop, monthly floors built from your own story.
- Bonds: every fight raises a unit's bond, and its levels open a conversation, a story chapter of their own, a Home background and an outfit.
- Your character cards can be the banner cast, and outfit themes are yours to write, share and import.
- Every skill and action has its own painted icon, and every screen has a ? that explains it the first time.
- The unit sheet is split into tabs, the Gear tab shows a piece whole and compares changes, and Materials is a row of illustrated cards.
- Combat Power measures how a unit really fights, and weapons, relics and skills were rebalanced to match their sheets.
- Fixed: passives and skills do what they say, the game keeps your place when you come back, and screens no longer flash while they load.

## 1.7.0 — 2026-09-05

- A whole chapter's scenes can be written in advance, so they open with no wait.
- Leave a scene halfway and pick it up where you stopped instead of starting over.
- Every banner now runs smaller side events alongside it: Tidewalk, Salvage Bingo and Supply Line.
- Seasonal Event: ten draws at once, a daily boss, a party bonus and rewards for the coin you earn.
- Items and rewards show a picture of the thing itself instead of a symbol.
- Each connection generates one thing at a time, and whatever you are waiting for goes first.
- Character names are capitalised, and your persona can be moved around the party and taken out of it.
- Fixed: the top bar no longer cuts off its buttons, the Home no longer sends you back to Chapter One, and the battle screen no longer slides sideways.
