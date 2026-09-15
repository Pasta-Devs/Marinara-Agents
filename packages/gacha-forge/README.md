# Gacha Forge

Gacha Forge is a standalone gacha game mode: describe a world and it builds the rest — banners to pull on, a cast the model writes and paints for you, and the story, battles and events that grow around them. Lorebooks feed the forge when you have them; a hand-written scenario is enough.

Find the package in **Agents → Download Agents**. Installation requires a restart: once installed and Marinara Engine restarts, **Gacha Forge** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes after restart.

Since 1.8.0 the package is listed in the repository README's Misc catalogue for every Engine channel; from 1.2.0 to 1.7.0 it was **staging only** while the game mode was exercised.

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

**1.8.0 is the game played by hand, and what a unit becomes when you keep fighting with it.** It registers 113 routes.

- **Combat is manual.** On each of your units' turns you choose what it does — attack, its Ultimate, its weapon skill, defend, or change row — and who it hits. The unit acting steps out in full size with its actions beside it, the next five turns sit on the right, every unit shows what it is under, and tapping an enemy opens its sheet: its next turn, its Ultimate and passive, a boss's rules and what it carries. Auto still plays the fight exactly as before and can be switched in the middle of a battle.
- **The Tower** opens at Rank 20: a hundred floors that cost no Vigor. The first seventy are climbed once; from 71 up the Tower is built from the story's own enemies, comes back every month with new bosses, and each floor is two battles with two different teams. Its bosses enrage, wind up warned strikes, carry guard bars, call reinforcements, act twice, shrug off stuns, counter Ultimates or drain energy. Every floor pays Tower Coin, and the Shop has a Tower shelf for it — materials, Insight, Aether, Funds, Glimmer and one 5★ unit a month of your choosing.
- **Bonds.** Every fight a unit wins raises its bond, on a ladder of ten. The levels pay Aether, open a conversation with that unit (a chat on the Home, named by the world, with pictures where the world can paint them), a story chapter of their own at 4 and 8, a Home background at 6 and an outfit at 10.
- **Your own cast and your own themes.** Character cards can be the banner cast, each with a rarity, their combat kit and hero art written from what the card says, and their avatar as the portrait from the first moment. Outfit themes are written by you, kept in one library shared by every world, and exported or imported as a set.
- **Every skill and action has its own painted icon** — 148 of them — and **every screen has a ? that explains it**, opening by itself the first time, with a welcome the first time the game is opened.
- **The unit sheet is split by what you want to know** — Stats, Skills, Gear, Facets, Outfits and Story — and the Gear tab shows a piece whole: Change and Upgrade are screens of their own that compare stat by stat and CP, and Auto-select picks the cheapest spare relics.
- **Combat Power measures how a unit really fights**, from the numbers the battle runs on, and every fight asks the CP its enemies are worth. Weapons grow to Lv 90, a relic's SPD is flat, a 5★ relic's main stat starts at half, DEF softens every blow, any blow can crit, and a stun, a poison or a DEF drop is a chance rather than a certainty.
- **Materials is a row of illustrated cards**, and moving between screens is animated: the screen you leave slides away and the new one comes in, its cards one after another.

Fixes in this line, all measured against the fight: passives now do what they say — react to Ultimates, fire the moment health drops, hit harder with ATK raised, and auras that hit, poison, stun or heal actually fire; skill figures on the sheet are the ones a fight uses, training raises every skill, and Facets quote the unit's own figures; healing, Effect RES and Radiance work as described; the game keeps your place in Units, the Shop, the Battle Pass and the chapter you were reading; and changing banners, opening a unit or entering a menu no longer flashes a loading panel.

The two side rails of 1.6.0 are gone: Help and the changelog live only in Settings, and the game takes the width the rails used to have. And from this release the package is listed in the Misc catalogue for every Engine channel; from 1.2.0 to 1.7.0 it was staging only while the game mode was exercised.

### 1.8.0 also reworks screens that already shipped

- **Combat and pre-battle** (1.1.0): manual by default, with Auto remembered per mode; the enemy sheet before and during a fight; a defeat says what it cost; easier fights no longer slow the enemies down.
- **The unit sheet** (1.0.0): tabs, the Gear screens, skill training from each skill's own page, and the portrait redo as the Edit button on the Default outfit.
- **Materials, Ascension Materials and Tenet Trial** (1.1.0): decks of cards with their own pictures, CP and Vigor side by side, the Vault's odds, and the deck stays where you left it after a run.
- **The Seasonal Event** (1.5.0): pays less — 40, 60 and 80 coin, 250 for the boss — and its boxes are smaller.
- **Achievements** (1.5.0): a Bonds category with five new ladders, and the summon, Facet, Materials and rank ladders run to thirteen steps.
- **Shop and Inventory** (1.5.0): item pictures stand on their card instead of a black square, group names look like the ones in Units, and the Glimmer icon is Glimmer's.
- **World creation and Settings** (1.0.0): a Characters step for the cast, the art size and the outfits per rotation as settings, expandable lists, the changelog in one column as patch notes, and outfit directives are gone.
- **Modes** (1.3.0): no cards for modes that are not out, and a closed mode says the Rank it needs.

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
