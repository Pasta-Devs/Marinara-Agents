## 1.27.5 — 2026-10-29

- Maintenance rebuild for the shared expression-image lifecycle. Gacha Forge keeps its existing automatic expression behavior; the explicit repaint controls belong to Otome Hearth.

## 1.27.4 — 2026-10-29

- Maintenance rebuild for the shared image-reference helper. Gacha Forge keeps its existing avatar and outfit reference behavior.

## 1.27.3 — 2026-10-28

- Characters can equip their designated weapons even when a saved weapon has a different type from their role. The intended owner sees it in Gear and can equip it without regenerating the weapon. Signature skills still activate only for their owner; other characters keep the normal weapon-type rules.
- On short landscape screens, Gear details keep their full height and the panel scrolls, so Choose and Change remain clickable instead of being clipped inside the card.

## 1.27.2 — 2026-10-28

- The narrator, the chapter planners and characters writing messages are asked to read every character's mind more carefully: what each one knows, wants and feels.

## 1.27.1 — 2026-10-28

- Scenes, key images, story event art, chat photos, Bond backgrounds and banners now send each character's face (their card's avatar, your persona's, or their saved portrait) and, when the picture paints them in the outfit they have on, that outfit's image too. A character card's unit used to send only its card avatar.
- Banners and Bond backgrounds now paint a unit in the outfit it has on while **Outfits** is on, as chat photos do. Scenes and key images paint and send it only when **The story uses worn outfits** is on (off by default) and the scene does not dress the character itself.
- Faces go before outfits, at most four images, the Engine's limit: outfits are left out first, and the log says so.
- A new portrait or outfit is painted from the face alone, so the outfit a unit has on no longer leaks into its new look.

## 1.27.0 — 2026-10-28

- A finished story event's fights now open on **Hard**, then **Very Hard**, while the event runs and Seasonal events is on: Hard once the event is done, Very Hard once every fight is won on Hard, as in a main chapter. They are the fights you played, stronger, at 5 Vigor each, and each win pays once per difficulty what a main chapter's Hard and Very Hard fights pay. No new fight is designed, and each difficulty keeps its own progress.
- In **Chapters** a finished event shows its N, H and V marks, and **Enter event** while its Hard fights are open. **Events → Story events** counts its Hard and Very Hard wins.
- A story event's map no longer lists a chapter's Funds, Aether and rank on Normal, which an event never paid, and a played event's map opens without waiting for a scene being written elsewhere.

## 1.26.3 — 2026-10-28

- A story event you played now sits in **Chapters** right after the chapter it followed, as a finished Character Story does, instead of in a list below the next chapter. Its card says Done, Ended or Paused (Seasonal events off) and opens it to read its scenes again. Stories after the same chapter appear in the order you opened them. **Events → Story events** offers **Revisit played scenes** for a finished event, not **Continue event**.
- A finished story event's map no longer offers Hard and Very Hard. Events are Normal-only, so those fights could never start, and **Start battle** did nothing. A fight that can't start now says why, with **Retry** and **Back**, in chapters, Character Stories, events, Materials and the Tower, and a cleared event fight is turned away before its briefing.
- **Start battle** no longer stays disabled on a cheaper fight after another was refused for Vigor, and works at once in a world you switched to while a fight was starting.

## 1.26.2 — 2026-10-28

- Nothing changes in play. Expression portraits, choice labels, dialogue voice picking, music briefs, soundtracks and a few log lines now take optional settings, so another package can reuse them. Gacha Forge keeps its own values for all of them.

## 1.26.1 — 2026-10-28

- A chapter you forged before starting a story event no longer keeps pre-forging while the event holds it, and a big choice it already wrote no longer stops the event from starting, its scenes or its pre-forge. Once the event is finished, ends or Seasonal events is turned off, **Continue** on the chapter's map picks its pre-forge up again, and its choice waits for you as before. A Character Story's pending choice still stops the event from starting.
- While story memory catches up, a companion chat, a character message or a Character Story knows only the scenes you have played, not the ones pre-forge wrote ahead or a Compress summary of them.

## 1.26.0 — 2026-10-28

- **Chapters → What happens next** can offer the season's story event beside the next chapter and any Character Story, when the next chapter is not forged yet; otherwise **Events → Story events** starts it as before. It starts like a Character Story: its map opens and the next chapter waits. While it is open, its card takes the chapter's place.
- Pre-forge now writes story events too: scenes ahead at no Vigor cost, each fight designed after the scene before it, art in **Story and images**, and the pre-forge bar with Cancel on the event's map. Written scenes can be played while the rest is written. It stops once the event ends.

## 1.25.2 — 2026-10-28

- Backing out of a fight while it loads and entering another now loads the new fight, not the one you left. A fight request that never answers no longer blocks later fights.
- In Formation, a swap seats both units before either one's passive fires, so a revive, Swap, Shuffle or Echo it sets off never puts a fourth unit in a row, and revived units are drawn where they are. Fights started earlier keep their rules.
- On a small model, replies are much less likely to fail while memory catches up: the oldest chapter summaries, or the oldest chapters of the full story history, are left out only when the reply would not fit otherwise. The previous chapter, the scene so far and your decisions always stay.
- Story memory no longer stops for good when a chapter it already remembers reads differently later: it keeps its first memory and goes on.
- Seasonal event fights load again after a chapter was regenerated, and a fight that can't be set up now says why.

## 1.25.1 — 2026-10-27

- Scenes that are already written can be played while pre-forge writes the rest of the chapter. Cleared scenes keep **Read again**, and a fight or a written scene you have reached keeps **Play** or **Start**. Only a scene that is not written yet waits for pre-forge, which writes it at no Vigor cost. Back on the chapter map, it turns into Play as soon as it is written.
- Opening a weapon's page from Gear, or a relic's **Upgrade**, keeps the current view until the new one has loaded instead of cutting to an empty screen, and the relic you are upgrading is no longer faded out.

## 1.25.0 — 2026-10-27

- Story memory recalls by meaning as well as by words, using the Engine's embedding model when one is set, and searches with what was just played or said instead of the chapter plan. Only clearly relevant memories come back: up to three chapter summaries and three side memories.
- A unit's chats stay private. They are no longer folded into the shared overview, and never reach another unit's chat, a scene or event without that unit, or a fight.
- Characters in scenes and chats know only what they saw, took part in or were told in the story, and nothing outside it.

## 1.24.10 — 2026-10-27

- A seasonal story event can start right after you finish a chapter again. Only a story you are in the middle of keeps an event closed: a main chapter or Character Story part with some, but not all, of it played. One you forged but have not started yet no longer blocks it, and waits until the event is done.
- The event card now says what to finish first ("Finish Chapter 3" or "Finish Arden's Character Story"), and starting a chapter while an event is open names the event to finish.

## 1.24.9 — 2026-10-27

- A new chapter opens as soon as its plan is written. Its fights are no longer all designed before the chapter map appears: each fight is designed in the background right after the scene before it is written (by pre-forge or when you open it), so it is ready, with its enemy art, when you reach it.
- Story memory summarizes only in the background, so writing a plan, scene, fight or chat no longer waits for it to catch up. Canon the saved overview does not cover yet is sent beside it as its summary, or as written for a fresh side story or chat. A summary already running on the same connection still finishes first; a separate summary connection avoids that.
- Long chapters can be summarized again: summaries get at least 10k tokens of output room for thinking models (or the model's maximum, never below 8,192).

## 1.24.8 — 2026-10-27

- In character chats, Enter now adds a new line instead of sending. Only **Send** sends your message, so a stray Enter can no longer send it early.
- Auto in story scenes no longer turns itself off when background work starts or finishes, such as expression portraits, scenes written ahead or portraits painting, or when you switch tabs and come back. The current line's voice no longer replays either.
- While a story is written in the background, Formation changes stick: a picked unit, a drag or the bench scroll are no longer reset mid-move, saves never land out of order, and a battle waits for your last change. The chapter map no longer redraws every few seconds, and background writing no longer stalls other screens.

## 1.24.7 — 2026-10-27

- New **Expression portraits** setting in World → Sources → Images, off by default. Story portraits then show anger, fear, sadness or joy line by line, marked in the same request that writes the scene. Four faces per look are painted in the background, only for characters who speak. A failed set is not retried on its own: turn the setting off and on to try once more.
- Your persona keeps its own voice even when another character shares part of its name, and turning Voice other characters off and on again no longer asks to pay again for combat lines that were never made.

## 1.24.6 — 2026-10-27

- New **Voice other characters** toggle next to Read character dialogue. NPCs and units without an assigned voice speak with a voice from the Engine's Random NPC Voices lists (Connections → Text to Speech), matched to male or female when known. With both lists empty, any voice of the current connection is used. Each name keeps the same voice. Assigned voices still win, and your persona uses only its own.
- Combat voice lines now play in Classic and Formation fights, start preparing when the battle screen opens, and include your persona's assigned voice. A short notice says when nobody in the team can be voiced.

## 1.24.5 — 2026-10-26

- When a Front Row unit falls in Formation, a Back Row unit on its side steps into the empty seat at once and acts from its next turn. This works for your team and for enemies, and a fight now ends only when one side has nobody left. Moving and retreating never pull a support forward. A fight started before this update is still scored by the rules it was played under.

## 1.24.4 — 2026-10-26

- Messages you send in character chats are no longer read aloud. Your persona's assigned voice still reads its story dialogue.

## 1.24.3 — 2026-10-26

- Combat Power (CP) is now called Battle Power (BP).
- Retrying a failed Formation kit pays only for the characters that still need one. Kits you kept after cancelling a remake stay as they are, and kits already paid for in a cancelled or failed remake are never made again.
- A Front Row fighter whose only damage was a passive that never fires (on its own attack or kill, from the Back Row, or with no power) attacks with its Normal skill again.
- An immunity Ultimate lands on the ally you pick, and one that can no longer land waits without spending energy. Retreating a fighter and summoning into its seat works in the same turn.
- A battle saved with an element barrier nobody in your world can meet can now be fought, and a shortened defeat order names the enemies that come first.
- On phones, enemy names show in full and protection tags no longer cover them. An Echo's sheet describes the Echo, and keyboard focus comes back after Fight.

## 1.24.2 — 2026-10-26

- Personas use their assigned Engine voice for story dialogue and newly sent character messages when dialogue audio is enabled.

## 1.24.1 — 2026-10-26

- Formation fights can no longer stall. An enemy that keeps turning immune can be hit again after two turns, Retreat Echo repeats one real cast only once, and a summon with no free Front Row seat waits without spending energy.
- Remaking older Formation kits no longer locks battles. Battles wait only while a remake runs, cancelling it keeps your current kits (new characters still get theirs), a kit that failed waits for Retry in Story Continuity, and story work is never cancelled. A game left open from 1.24.0 asks you to reload first.
- Story, event and boss fights in Formation no longer fail over a slightly wrong kit, keep the boss in the fight, and skip element barriers your team cannot meet.
- In battle, the boss bar no longer covers row tags on phones, team editor names are readable, Echoes show their own name, Fight with fighters unplanned opens the plan, energy skills pay for later steps, and a keyboard can plan a whole turn.

## 1.24.0 — 2026-10-26

- Formation combat is rebuilt. Tap each Front Row fighter, pick its Normal skill, Ultimate, move/swap or Hold and its target, check the plan and the energy it spends, then press Fight. Every skill shows what it does and costs. Auto still plays a whole turn.
- Teams seat six: up to three Front Row fighters and three Back Row supports. Supports make one energy of their element each turn, cannot be attacked and carry strong passives. Energy never expires.
- Kits from older Formation rules are remade automatically before a world's next battle and keep fighting until then. Story, event and boss fights in Formation get front fighters, back-row supports and clearer boss rules.
- Classic combat is unchanged.

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
