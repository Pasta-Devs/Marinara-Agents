# Gacha Forge

Gacha Forge is a standalone gacha game mode: describe a world and it builds the rest — banners to pull on, a cast the model writes and paints for you, and the story, battles and events that grow around them. Lorebooks feed the forge when you have them; a hand-written scenario is enough.

Find the package in **Agents → Download Agents**. Installation requires a restart: once installed and Marinara Engine restarts, **Gacha Forge** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes after restart.

Since 1.2.0 the package is **staging only**: Engine `staging` testers are offered it and stable `main` users are not, while the game mode gets exercised. It is listed in the repository README's *In development* table rather than the Misc catalogue for that reason.

## What this release contains

1.0.0 shipped the Collection slice: world forging with lorebook-driven casts, the founding and featured banners with pity, portrait and banner-art generation, the Units browser with each unit's sheet, and the Home scene with its background and unit pickers.

1.1.0 added Farming, so the collected units had somewhere to go: the Materials modes with their three difficulties, a Formation board with presets, the deterministic combat simulation and its result screen, and unit growth — levelling and ascension — on the unit sheet.

1.2.0 added Story, which is what the collection and the farming were being built toward: chapters whose nodes the model plans, a visual-novel narrator that reads each beat out segment by segment with its speakers framed beside the text, generated backgrounds per location, chapter combat that runs the same simulation the farming does, and the context controls — a compression pass and its threshold — that keep a long run inside the model's window.

1.3.0 completed the game: Progression (the Inventory screen, and each unit's Gear, Form and Facets tabs, which open the Relic Vault and the Tenet Trial) and Events (the events tab, a 7 Day Login Event and a 30-day battle pass), leaving nothing in the interface drawn locked and 60 routes registered.

**1.5.0 rounds the game out.** With the core game loop in place, this release is about what a run gives back — the economy that closes its own loops, the systems that reward staying, and the author's controls over the story. It registers 73 routes.

- **Glimmer and the Shop.** 94% of pulls used to grant nothing new; now every pull pays something. Duplicates mint Glimmer, and a Shop spends it — Vigor potions in three sizes (stored in the bag and used from the Vigor menu, now a centered modal), plus locked slots that name what is coming.
- **Outfits.** The world owes its laggards an alternate look: each banner rotation mints outfits for the units that have been offered and not bought, themed by a per-world author directive, and sells them in the Shop from rank 15. A unit's sheet gains a wardrobe tab, and the Home picker can dress the scene with one. A per-world switch (on by default, off only by the author) turns the system off entirely.
- **A seasonal box gacha.** Ten boxes with a fixed inventory instead of probabilities — the tenth repeats as an Aether faucet — funded by three event fights, rotating with the featured banner and named after it.
- **Achievements.** Ladders that watch what the player already does and pay Aether, with a claim dot that updates the moment a rung is reached.
- **The author's four directives.** Chapter-plan, story-beat, outfit-theme and — new in this line — a story-arc directive that governs the sequence of chapters itself: the planner reads a running ledger of what every previous chapter did and records one line about its own, so a rule like "someone dies every three chapters" is counted, not guessed.
- **The tutorial, both halves.** Screens unlock on a rank schedule with a 1,600 Aether welcome gift, and the Home always names the next step — the one action that moves a new player forward.
- **A summon history.** Every pull is recorded with the pity it landed on, paginated ten to a page, one page per 10-pull.
- **Relics grow like the genre expects.** Sub-stats reveal as a relic levels, rolls vary around the average, and a 5★ reaches +20 in five ticks. The day-7 login relic shows its four rolled subs in a pop-up when claimed.
- **Story polish.** The prologue is the first beat of chapter 1, free by construction; a beat segment can be a thought and is painted as one; backgrounds follow the scene; the loading screen names the place it is painting; and forging a chapter no longer pre-paints its locations — art is painted when the player reaches it.
- **Connections per job.** Prose (45% of measured spend) and chapter compression can run on a cheaper model than the structured calls, per world; world lorebooks can opt into feeding story scenes.

**1.5.1** is a hotfix: the world-creation escape now reaches all four creation screens. Creation ends by reading the prologue, so its chapter forge and prologue beat are as barless as the founding cast and its art — a player from an old world could sit on "Forging the first chapter" with no way out. The cancel is gated on the prologue debt, so a later chapter's forge never grows a world-killing button beside its Retry.

**1.6.0 is about the story's pictures, and about what the model is asked for.** It registers 75 routes.

- **Key images.** A beat may mark one moment as illustrated: a single picture that replaces the scene's background for the span it covers, with the cast sprites hidden because they are in the image. How often a world may spend one is a per-world slider, from off to every beat, and the rarity is enforced at both ends — the prompt only offers the field when the window is open, and the validator discards one that arrives outside it. The beat names who is **in the frame** rather than who is present, what each body is doing, and, only when the scene changes it, what they are wearing.
- **A character's clothes are canon.** Minting writes one prose appearance, and a small translation derives the tag lists from it: the permanent traits, the clothes the character normally wears, and the same person seen from behind. A key image dresses them the way they always are unless the scene says otherwise, and a character drawn from behind travels without the face they cannot show. An outfit the player has equipped counts as story canon only if the world opts in — off by default, because a bought costume is not something the story agreed to.
- **Image prompts are always English.** The rule used to be written eight times and the weakest copy decided; it is one constant now, and a scene written in the world's language is translated rather than dropped.
- **World creation tolerates other models.** Measured against 32 legitimate ways of answering the same thing, the forge accepted 22 and now accepts 30 — role and affinity were the only fields still compared as exact strings. When it does fail the player is told why, the cancel button responds, and a half-made world offers to continue instead of starting over.
- **Chapters no longer spoil themselves.** The planner's hook and the titles of nodes the player has not reached stay hidden until they are earned.
- **Heroes take turns.** The chapter cast is half the roster rather than all of it, with ceilings per node and per chapter, and the beat writes only who its guide named — several scenes with no hero at all are normal.
- **Long runs compress further.** Chapters already compressed can be combined again, recursively, so the context ceiling stops being a wall.
- **Home.** The background picker gains a **Story CG** category listing the world's key images, newest first, and both pickers now page ten at a time instead of drawing every picture a world ever painted.

Fixes in this line: levelling with no Funds no longer consumes Insight; deleting a world now takes its key images and outfits with it; the seasonal event pays 100 Aether a stack instead of 50; models that reason no longer run out of room mid-answer; and the changelog opens five versions at a time.

One of those is worth naming, because it was not cosmetic. The forge's loading screen printed the
world description in full, and the field accepts 4,000 characters. Measured against that: the block
ran 680px tall, the centre column overflowed its box by 374px, and **Cancel ended up 309px outside
the stage** — so a world with a long description had no way to cancel its own creation, which is the
escape 1.5.1 had just finished wiring to all four creation screens. The description is gone from that
screen; the heading, the live status and a foot that mentions it without printing it remain.


**1.7.0 is about waiting less and having somewhere to spend a session.** It registers 85 routes.

- **A chapter can be written ahead of you.** Ask once and the remaining beats of the chapter are written in the background, in order, so they open with no wait; the chapter screen counts them as they land and you can stop it or start it again at any point. The chain runs behind whatever you are doing: a beat you open yourself always takes the connection first, and the chain loses its turn rather than its place.
- **A scene remembers where you stopped.** Leave a beat halfway and coming back offers to carry on from that page instead of reading it from the start. The mark is written when you leave, and only offered when there is enough left to be worth it.
- **Mini events run alongside every banner.** Each featured banner now draws three smaller events with windows inside its own fourteen days: **Tidewalk**, a ring of prizes you move around with a die that arrives every six hours; **Salvage Bingo**, where Materials runs earn marks that turn over squares on a card; and **Supply Line**, where the first three Materials runs of a day come back with double the loot. The schedule is sealed into the world when the banner opens, so adding events later never reshuffles one already in progress.
- **The seasonal event is finished.** Ten box draws at once, a boss beatable once a day, 25% more event coin for each character from the banner in your party, and rewards for the total coin earned at five milestones. The event's boxes now hold Tenets as well as the Mandate that unlocks what Tenets pay for — the ladder used to sell the key and not the steps.
- **One generation at a time, per connection, and yours goes first.** Background work — the chapter chain, banner art, portraits — no longer queues in front of the thing you are waiting for.
- **Items and rewards show their own art.** Nine screens that drew a symbol now draw the item: the pass ladder, the login week, the seasonal stacks and boss, the shop, the inventory, the summon results, and both mini-event boards.
- **What a screen promises, it now shows.** The login week names what each day pays before you claim it, and the event box shows what is inside each stack and how much of it is left.
- **Author and connection controls.** A fifth author directive says how key images should be described; cast books can name a character's role and element; and the Reasoning Effort and Verbosity configured on a connection are used.

Fixes in this line, all reported from play: the top bar no longer cuts off the buttons on its right; the Home no longer sends you back to Chapter One; your persona can be moved around the party and taken out of it; character names are capitalised; the settings control is a gear rather than something closer to a brightness icon; world creation follows the letter size you chose, shows that its options list scrolls, and keeps the arrow on its dropdowns; a Home decoration and a context-warning threshold no longer revert on their own; and the battle screen no longer slides sideways.

One of those is worth naming. Two routes answered `ok` with a value they had not saved: `documents.update` returns `null` on a revision conflict rather than throwing, so an unchecked write is lost in silence. Both now re-read and retry, and answer `write-conflict` rather than a number that is not on disk.

The side rails were also given room. They used to be whatever was left beside a 16:9 stage — 152px on a 1920x1080 window, below the width at which they hide their own text — so the stage now yields width to them on a wide screen: 272px per rail at 1920x1080, and 281px at 2560x1440. The reserve switches itself off where the rails do not exist (fullscreen, and any window narrow enough to drop them), because yielding width to a rail that is not drawn only letterboxes the game.

### It also reworks screens that already shipped

This release is not only additive; the reworks it carries to interfaces already in staging are listed in the pull request body and summarised here:

- **Summon** (shipped in 1.0.0): the featured 4★ rate-up is 1/3; a retired featured enters the permanent pool; the 5★ splash escapes the generated name (an XSS fix); a double click can no longer charge twice; and the next featured banner is pre-minted a day before the current one ends, so its art is ready the moment it opens.
- **Combat** (shipped in 1.1.0): the party band now fits a phone in landscape (the fullscreen button also moved out from over Skip); the card frame contains its art in all five HUD styles; hostile passives no longer hit their own team and poison ignores shields, both matching what the ability text always said; and enemies spread their attacks instead of obsessing over one unit.
- **Materials** (shipped in 1.1.0): tier drops halved and Insight XP doubled, from measured progression; and the difficulty a chapter allows is clamped server-side — it used to carry over from the previous chapter, which was an economy leak, not a cosmetic bug.
- **Story and the VN** (shipped in 1.2.0): the backlog opens at the bottom; a shortened or surname-first speaker still finds their portrait; and `/complete` checks that its write landed before paying.
- **Server-side economy hardening** across routes that pay: `/summon` validates every lock the screen draws (it validated none), `/battle/start` clamps difficulty before charging, and six unchecked writes that could lose an already-paid reward now conflict instead.
- **Home** (shipped in 1.0.0): the scene background survives a banner-art repaint, deleting a world asks first and says what is lost (and deletes its art, its key images and its outfits), and the picker gains the outfit switch, the Story CG category and pagination. Resolving the chosen background is one read rather than three whole catalogues, which used to run on every state refresh and grew with the story.
- **Settings and the changelog** (shipped in 1.3.0): the key-images slider fills its row and keeps the number the player set, and the changelog opens five versions at a time instead of all of them.

### And two side rails, with a door inside the game

The space left beside the 16:9 frame now carries a collapsible help Q&A on the left and the player-facing changelog on the right. Because those rails are what is left over — they vanish in fullscreen, on a phone, and in a tall window — the same two lists also live inside the stage, as Settings categories reached by the gear that is already on every screen. The rail whose content is on screen steps aside, so neither list is ever drawn twice at once.

All generation — world text, cast sheets, portraits, banner art — runs through the Engine profile's own configured model and image connections. The package adds no external services and sends nothing anywhere else.

## Payloads

`client.js` and `server.mjs` are single-file esbuild bundles contributed from the package's own source tree, which is maintained outside this repository. The artifact zip, manifest hashes, and catalog entry are re-derived from the committed payload bytes by the package builder, so they cannot drift from what ships.

Rebuild the artifact and catalog entry from the repository root:

```bash
node scripts/build-gacha-forge-package.mjs
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
```
