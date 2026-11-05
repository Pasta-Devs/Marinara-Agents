# Slurp configurator: Basic + extensions

Status: concept v2, 2026-10-19, branch `slurpothon`, based on Slurp 0.3.47/0.3.48.
Nothing here is built. v2 folds in a code critique, an onboarding audit and a sweep of the
open Slurp concepts (storylines, drama, trends, Opening Day, the stopped module plan).

## Why

Backstage has 11 sections, 20 pages and 157 settings keys (about 32 of them on/off or a
mode with "off"), plus Spice and per-Creator content level in their own stores, plus a
7-tab Creator modal and four different save models. Many sub-settings stay editable while
their system is off. A newcomer cannot tell what matters; a tinkerer cannot tell which
knob belongs to which system.

Goal: Slurp works like a car configurator. Basic is a complete car. Extensions are a few
big packages, each one card with a sentence, a real sample, its status and its own page.
Depth is still there, but only where you open it.

## Rules taken from earlier rounds

From the stopped 2026-10-06 module plan (`conduct-your-welcome`, MODULE-SETUP.md) and the
2026-10-10/11 reviews:

- Three ideas are separate and go in this order: group settings, choose content at setup,
  switch whole systems. Each step must stand alone.
- "Slurp Basic and then extensions." Basic is a complete social app; never make ordinary
  parts (Messages, fans, pictures, coins) things you must "add". Few, big extensions.
- Slurp is about 70% of the target; polish toward 1.0, keep current enjoyment and
  configuration, no framework before it shows a benefit.
- Modules hold the verbs, packs hold the nouns (STORYLINES.md). Extensions are code that
  runs a system; packs are content an extension runs. Packs are never extensions.
- Plain names (no cute group names), pretty controls, raw fields only behind "More", no
  disclaimers or new guards; the AI cost note stays.

Verified facts that limit what a switch can promise today:

- Flags are not master gates. Manual runs bypass `fanActivityEnabled`; `walletEnabled:
false` keeps prices and locks on screen and only skips the charge; `supportDesk.tickets:
off` is not desk off; `messagesAwayRepliesEnabled` only stops away replies;
  `advanceSlurpTrends` has no flag; `tickProjects`/`rollAutoArc` ignore `worldActivity`;
  Stir has no flag.
- The world scheduler (`slp-world-scheduler-service.ts`) and catch-up on open
  (`workflows/slp-world-tick-workflow.ts`) call the systems from two lists that already
  differ (trends is only in the scheduler).
- `SLP_ACTION_META.category` is a deck category (life, love, drama, work, world, help,
  desk), not a system.
- Settings patches merge at the top level only. Creator settings save a full resolved
  object (no per-field "use Slurp default").

## Basic (always on)

Creators, feed and posts, pictures, Stories, fans and comments, DMs, coins (locked posts,
subscriptions, tips, PPV, paid requests), Discover, notifications, the Support thread,
Spice, Pause all. The story-state reader ("Right now" line, DM stance, picture look) is
Basic too; it returns nothing while Storylines is off.

Coins are Basic because the feed, DMs and the DM policy (`open|subscribers|paid|closed`)
are built around them (about 87 client files). Economy tuning (stipend, rewards, revenue
share, dynamic pricing) moves behind "More".

The Basic page, about 15 pretty controls:

| Group       | Controls                                                                                                   | Behind "More"                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Connections | Text model, image model or "no pictures"                                                                   | page, image-context and prompt models, AI budget               |
| How busy    | One pace choice (posts per day, quiet hours, Stories on/off; also caps parallel generation for local GPUs) | posts per day number, Story jobs, generation mode              |
| Crowd       | One crowd choice (`platformScale` + `worldActivity` + audience preset)                                     | fan types, archetype weights, reaction bank, simulation tuning |
| Pictures    | Pictures on posts, style, blur                                                                             | sizes, appearance and prompt options                           |
| Heat        | Slurp-wide Spice limit (same control as the Spice page)                                                    | tastes, never-list, language                                   |
| Messages    | One "How fast they answer" scale (drives the 10 delay fields), who can message                             | cooldowns, openers, request timing                             |
| Coins       | Unlock price, subscription price                                                                           | economy tuning                                                 |
| Safety net  | Pause all, Storage and backup                                                                              | autopurge detail                                               |

This page replaces the Overview quick switches (one place, not two).

## Extensions

| Extension        | What you get                                                                                                   | Owns                                                                                    | Real gate today                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Brands & ads** | Inline ads, brand deals, ad pictures, brand packs                                                              | `inlineAds*`, `brandDealsPace`, Ads panel, ad refresh job, `offer-brand-deal`           | Almost: `inlineAdsEnabled` + `brandDealsPace`; check the lever |
| **Storylines**   | Arcs, polls, collabs, couples, rivalries, drama, polyamory; packs such as pregnancy, Spicy Firsts, Tip War     | `arc*`, `projectRate`, `arcLibrary`, `contentPacks`, `drama`, `polyamory`, state writer | No: projects ignore `worldActivity`; drama is off by default   |
| **Living world** | Holidays and site events, calendar, viral trends, deeper world simulation                                      | `platformEvents`, `storyAutomation`, `sharedWorldEvents`, trends scan                   | No: trends has no flag; events have no single flag             |
| **Stir**         | The lever deck tab, the planner, "In play", shady levers (rumour, throttle reach, cash favour)                 | Stir tab and sheet, lever deck                                                          | No flag                                                        |
| **Support desk** | The management game: tickets, trust, suspicion, offers, Creators leaving, perks, notices                       | `supportDesk`, desk tick, desk composer levers                                          | No master: `tickets` is a mode, the tick always runs           |
| **Engine link**  | Slurp in normal chats (carryover), DM to roleplay scenes, lorebook and agent flavour, later scene photo shoots | `carryover*`, scenes, `enableLorebookContext`, `flavourFromAgents`                      | Yes: opt-in or Engine-capability gated                         |

The Support thread stays in Basic: it hosts the sign-up scene. Only the desk _game_ is the
Support desk extension.

Packs carry `requires: [<extension>]` (for example a brand pack needs Brands & ads). A pack whose extension is off is hidden
and skipped. Spicy packs always obey the Basic Spice limit.

## Depth without a Tinker mode

No global expert switch. Every Basic group and every extension page shows its first
controls and one "More for <name>" expander that opens today's panel and Advanced groups
in place. Backstage search keeps finding every key (the placement table already gives
each key a home). Nothing is deleted.

## How a real switch works (slice 3 onward)

- Flat top-level booleans: `extAds`, `extStorylines`, `extWorld`, `extStir`,
  `extSupportDesk`, `extEngineLink`. One helper `slpExtensionOn(settings, id)`, shared by
  server and client.
- Every action in `SLP_ACTION_META` gets an `extension` field. The action runner and
  Mari's tool list refuse actions of an off extension; the Stir deck and the composer's
  "Add from Slurp" chips hide them.
- The extension's call is gated in both tick lists. One regression checks that the two
  lists name the same systems.
- Off hides the tab, page, Creator-modal blocks, Overview items and search hits; stops
  jobs and write routes; keeps all data and preferences; on again resumes without a
  backlog replay.
- Migration: one-time, marked so it never runs again. Existing installs get each switch
  from today's flags, generous side. Existing users therefore see the new layout, not
  fewer systems.

## Onboarding

Today (static code read, confirm on a fresh install): splash (G's screen), then the age
gate, which writes `onboarding: completed` at once, then an empty feed with "Add Creators".
The welcome questions, the tour and the scene lane exist, but only through "Run setup
again". Pace, nights, images and names are asked up to three times. A text connection
is never required. Setup saves in four separate writes. There is no Slurp-wide heat
question.

Roles (from Opening Day, approved "Cool shit, theme it this way"): the player owns the
Slurp, Support is staff ("Morning, boss"), characters are Creators, fans are the crowd.
The Basic screen questions are owner decisions. The maintainer wants Duolingo-level
animation and flow; a modal with text bubbles was rejected, and so was a paper form.

Target, about six taps on the recommended path:

1. G's splash and the age gate, unchanged. The age gate no longer writes `completed`.
2. **Basic screen.** One screen, pre-filled with recommended values, with one "Use the
   recommended setup" fast lane, "Skip to the questions" and reload-resume. It opens
   with "Who are you: watch, run, or both" (watchers skip to the feed), the Mari unlock
   beat (what a locked post is) and the real AI cost line. Each answer changes the real
   Slurp feed, post, locked-post and nav components with fixed sample data (the Opening
   Day phone was rejected because it did not look like Slurp; the real components first
   need their live actions split out so a preview tap does nothing). Answer cards are
   enlarged real Slurp controls, and the same controls appear on the Basic page:
   - Text connection, or "later". "Later" sets the pace to manual, as Opening Day did.
   - Pictures yes or no, and the image connection.
   - Heat. Writes the Slurp-wide limit and the default level, and shows the public
     step-down ("Public: tease, Locked: Flirty"). The age gate text must match it.
   - How busy.
   - Crowd.
   - Names, open or hinted.
3. **Your first Creators.** Choose one way:
   - The sign-up scene with Support.
   - The Creator picker. Quick setup becomes only this picker. "Customize" goes away, and
     its fields move to Basic.
4. **Add extras.** One card per extension, with a sentence and a real sample component
   (an inline ad, a poll, a holiday banner, a lever card, a DM-to-scene card). The
   recommended pick is preselected. Until a real gate exists, a card can only write the
   existing flag, and it says what it turns on. The ad sample needs the ad sheet (tap
   opens the ad) first.
5. **Open the doors.** This is the one write. `completed` is written last, only after the
   other parts succeed. Then the first-post queue and artwork start.

After that, Support offers the extras that are still off, in-universe, as a normal
Support notice with "Add" and "Not now":

- after the first posts,
- after the first unlock,
- after a few days.

Support sends at most one offer a day, and none while Slurp is paused.

Opening Day (`conduct-your-welcome`) gives the stage, the reveal and the one-write
`slpRailStamp` rule ("write only the questions the player answered", Spice first,
answers sanitised). Its 18+ "license" chapter is an option if the age gate moves into the
flow. Do not rebuild G's screen; the maintainer rejected a new one twice.

The other cases:

- **Existing installs.** They get a one-time "What's switched on" card in Backstage.
- **Your Slurp card.** Opening Day's "Your Slurp" card (preview from settings + "Run
  setup again") moves to the top of the Basic page, since Overview loses its switches.
- **Run setup again.** It opens the Basic screen with the current values. It writes only
  the fields the player touched, and it never shows the age gate again.
- **Watchers.** The watcher exit writes `completed`.

## Slices

0. **Quick wins.** These do not depend on the configurator:
   - Verify the first-run finding.
   - Require a text connection, or set manual pace without one.
   - Show Spice in Backstage search.
   - One save status and conflict protection for every page (not a rewrite of every
     page to autosave).
   - Replay the October feedback fixes from `conduct-your-welcome`, one small PR each,
     by diff (the branch is 424 commits behind; cherry-pick conflicts). The ad sheet
     first.
   - Fix the five accessibility problems from the settings audit.
1. **Grouping.** Add the Basic page, one page per extension built from existing panels,
   and "More" expanders. Extension cards show a true status line read from real flags
   (for example "Ads: on, 1 in 8 posts"), and an Open link. There are no switches yet.
   The Overview quick switches go away. The Messages group is the old "Messages pilot":
   acceptance tests for it are away replies vs writes first, who can message (closed is
   not "nobody"), what still arrives when automation is off, and the no-connection case.
   As built (slurpothon): "More for …" opens the full page of that part (Basic's other pages
   have no tab row, only "Back to Basic"); it is not an inline expander, so every setting keeps
   one anchor. The Basic page saves at once, like Overview. Heat links to the Spice page. Carryover,
   lorebook context and agent flavour moved to the Engine link page; polyamory and drama to
   Storylines › Drama & love. Stir has no settings page; its Overview row opens the Stir tab.
   Hiding Creator-modal blocks waits for slice 3.
2. **Onboarding.** Add the Basic screen, the Creator step and the one write.
   As built (slurpothon): the age gate writes nothing and opens the first run; a reload resumes
   it. The Basic screen is the Opening Day stage (`modules/stage`) with the real locked post card
   as its live preview; the intro slides, the tour, the chat-bubble welcome and Customize are gone.
   Heat starts on Suggestive. Leaving the Basic screen writes its answers (Spice, then guidance,
   then settings, then the image default) and never `onboarding`, because the sign-up scene and
   the picker read the connection, pace and heat; `completed` is still written last, by the watcher
   exit or the Creator step. Per-Creator name disclosure is a small control in the picker. Not done:
   the age gate text that matches the heat, a preview with the full post card (it needs a whole
   post context), and "What's switched on" (waits for slice 3).
3. **Real gates.** Do them in this order:
   1. Brands & ads, the first switch on a card.
   2. Living world, with the trends flag.
   3. Stir and Support desk.
   4. Storylines, with `worldActivity` and both post planners.

   This slice also adds the `extension` field on actions, the tick-list regression and
   the migration.

   As built (slurpothon), PR 1: `shared/src/slp/slp-extensions.ts` holds the six switches and
   the helpers. All six exist in settings and migrate; only Brands & ads has a switch so far (on
   its Overview row and at the top of its page; off, the page shows only the switch and one
   sentence). The migration needs no marker: settings are saved whole, so a stored key is the
   mark, and an empty record (a fresh install) starts on Basic only. Off means no inline ads, a
   brand-deal pace of "off", a 409 on the ad picture, lorebook-sync and generate routes, no
   lorebook sync or banner redraw in the refresh tick, and no brand actions in Mari's list, the
   runner, previews, the Stir deck, the planner prompt or the desk composer. Search hides the
   page's settings but keeps the switch. Brand deals run through the Creator ties pace, not a tick
   list, so the tick-list regression comes with Living world. Reset leaves the switches alone.

   As built (slurpothon), PR 2: Living world has its switch on its Overview row and on top of the
   Events and Calendar pages; the Events page also holds "Viral trends" (`trendsEnabled`, default
   on, read with Living world through `slpTrendsOn`). Off: every effect reads `slpLiveEvents`, which
   is empty, so no event colours a prompt, reach, prices, earnings, fan runs, reply delays, pack
   occasions or the pulse; started occasions keep their dates and do not run (the reconcile skips
   them, nor can one be started), so one whose window passed while off ends when Living world is
   on again; the prompt keeps only story facts. No Slurp-wide event starts from the shared beat, starting an event
   answers 409, and the world actions are refused. No trend starts (every starter goes through
   `startSlurpTrend`), is scanned, joined or listed, so Discover's Trending row and the post trend
   chip hide. Crowd (`worldActivity`, `platformScale`) stays Basic. Search hides Events, Calendar
   and `sharedWorldEvents`. The catch-up on open now also runs trends; one regression checks that
   both tick lists run the same systems.

   As built (slurpothon), PR 3: Stir and Support desk have their switches on their Overview rows
   and on top of the Backstage Stir page; the desk settings show under them only while the desk is
   on. The Stir screen holds both: one off, it shows the other with no Stir/Desk switch; both off,
   the tab is gone. Stir off: the planner answers 409 (the player's box and Support's world
   wishes), suggestions cannot be dismissed, and the post ⋯, Projects and "Start in Stir" doors
   hide. The ✦ sheet keeps the steering and "Talk as Support" (Basic) without the box and the
   levers; its view stays readable. Single plays keep their per-action gate, so a Support thread's
   plan cards still play. Support desk off: no desk tick, no case-file change from a talk, no reach
   factor, no standing or "desk" answer in the prompt, 409 on the four desk routes and on a send
   with a desk step, no trust chip, ticket bar, case file, Offer card or desk tools in the thread.
   Support still talks, sends pictures and asks for a photo; the sign-up chat seeds the desk as
   before. With no desk, Support's threads sit in the inbox and its badge. The desk's case files
   keep their state, except that a Creator who left comes back and posts again (only the desk
   keeps them away); the first pass after a long pause can roll up to a week's odds at once.

   As built (slurpothon), PR 4: Storylines has its switch on its Overview row and on top of the
   Storylines, Plan templates and Drama & love pages. Off, the Storylines page keeps shared ideas
   (Basic) and event automation (Living world, shown only while it is on). Off: no arc ticks or
   starts on either branch of the world tick, collabs, rivalries and couples stand still (bonds and
   brand deals keep their 6-hour look), the drama clock holds like "Pause all", and no arc, collab,
   rivalry, couple or drama takes a post on either planner. Frozen arcs have no effect: no earnings,
   growth or loyalty change, no life line in DMs, thread mood or fan comments, and no storyline card
   on the profile. 409 on creating, directing or generating an arc or template, starting or pushing
   a collab, "Post it now", setting up a couple, date/drama/patch-up/reunite, opening a shared page,
   starting a drama and answering its question. Ending still works: decline, block, drop, cool a
   rivalry, break up, move on, close a page, end a drama, edit or delete an arc. The Creator modal
   hides its Storylines and Collaborations blocks, the thread hides a drama question, and the post
   guide hides its Storyline chip. Partner texts are the player's own relationship and stay Basic.
   On again: arcs whose chapter ran out move one step on the first tick; a drama job still in its
   window goes out, expired ones drop.

4. **Add extras in onboarding** and the Support offers.
   As built (slurpothon), part 1: "Add extras" is the last question of the Basic screen, not a step
   after the Creators, so it rides on the Basic screen's one write. One on/off card per switch
   (Storylines, Brands & ads, Living world, Stir, Support desk; Engine link has no switch yet),
   with the switch's sentence; the sample components wait for the real cards' live actions. A first
   run (and the fast lane) preselects Storylines unless a switch is already on (an old install that
   skipped onboarding keeps its switches); a rerun starts on today's switches and writes them only
   when the player answers. Picks survive a reload. Installs from before the switches get a one-time
   "What's switched on" note in the Overview's "Your Slurp" card, per browser, once onboarding is
   completed; a first run that reached "Add extras" (or took the fast lane) marks it seen.
   Part 2: Support's offers are a notice card on top of the feed (Slurp Support, "Add" and "Not
   now"), not a thread line, because Support's threads are with Creators. The first generated
   first-run post, the first paid unlock and three days after the first visit each send one offer:
   the next extension in the order Storylines, Living world, Stir, Support desk, Brands & ads that is
   off and not declined. At most one a day, none while paused; a pending offer stays until answered
   and goes away when its switch is turned on elsewhere. "Not now" never offers that one again. The
   state is one app setting (`slurp2.extrasOffer`); the rules are `shared/src/slp/slp-extras-offer.ts`.
5. **Storylines engine.** This is STORYLINES.md PRs 2–10, packs v2 with `requires`, and
   the pregnancy pack. Build it on the Storylines gate, so the gate is built only once.

For each slice: one patch bump, all regressions green, and screenshots at 390, 768 and
1440 px. Plan to update these regressions for each slice:

- backstage, anchors, completion, safety
- settings overview, creator-settings safety, messaging settings
- stir

## Rules kept from the module plan

- Off still delivers what is owed (paid commissions, replies already written).
- Availability and automation are separate controls (`messagesAwayRepliesEnabled` is
  automation only).
- Every control says whom it affects: all of Slurp, one Creator, or only your view. A
  dependency ("needs an image connection") explains itself.
- MODULE-SETUP.md's 152-key placement map is free input for slice 1.

## Long-term roadmap (after the configurator)

Order, each with what it waits for:

1. **Your taste, their style** (after slice 1). One heat block per Creator used in
   Content rules and the Stir sheet; one "no" list; temporary vs lasting steering chips
   in DMs ("Spicier for this reply", "make this their usual"); Page style reaching DMs
   and Stir; Creator premise with sample post, DM and Stir preview; facts about the
   player stay in the player's chats. Test: two Creators, same heat and request,
   recognisably different results.
2. **Character cards with several characters** (after slice 2's Creator picker).
   Detect the card type (person, group, narrator, scenario), then pick which characters
   become Creators, then shared or narrator pages. Also fix: "Read card again" wipes
   corrections.
3. **Storylines engine, later PRs** (after slice 5). Flow-view editor with AI draft,
   variants and dry run; items and inventory (gifts, coin purchases); couples,
   rivalries and collabs as packs; signals as storyline starters.
4. **Connected feed** (after the Storylines gate). One collab or occasion causes
   distinct reactions, DM callbacks and a "Since you were here" summary; a recurring fan
   cast; secrets and rumours with who-knows-what; milestones with a payoff.
5. **Richer Stir and optional play** (after the Stir gate). Revise a preview ("slower",
   "keep me out of it"), real scheduling ("tonight"), pause, end or revise instead of
   Undo; Surprise me with a purpose; private request to agreed idea, delivery and
   callback; Support desk and economy as games. Pick the next system from play, not
   from a plan.
6. **Engine link growth.** Decision models (optional, Engine capability; cheap yes/no
   instead of dice or a full model call: does this comment need a reply, is a storyline
   moment ripe, where does a scene end; always fall back to today's behaviour), Slurp
   history into a lorebook, scene photo shoots, voice from chat history (opt-in only).
7. **Shared image prompt helper** with Noodle (appearance overrides, character tags,
   model-specific prompts).

Not planned now: video posts, a full inventory economy before the everyday loop is
reliable, an 8-section "understanding" editor, a global Simple/Full switch.

## Branches to salvage

- `the-plot-thickens-branch-out` (0.3.29). Take STORYLINES.md, the state reader
  `slp-story-state.ts`, the Life panel and their tests, and cherry-pick them onto fresh
  staging. Do not rebase this branch. Its last commit (WIP, not built or tested) gives
  plain posts a condition moment on the classic planner, which prod uses; every gate
  must cover that planner. Check `DELETE /story/facts/<id>` ("Fact not found" in a
  probe) before real Life panel use.
- `conduct-your-welcome` (0.3.18). Take the October feedback fixes as small PRs: family
  and never-together, Collect limit, commission asks, comment-reply memory, DM edit,
  delete and copy, ad sheet, B1–B3, desk topics and quick replies, update a Creator's page
  through the sign-up chat. Replay by diff on fresh staging; family is partly on staging
  already (0.3.43). Take the stage and the one-write rule for slice 2.
  Drop MODULE-SETUP.md, the nine-home map and the ticket welcome.
- `one-deck-to-bind-them` is already in staging. Nothing to take.

## Decided (2026-10-19)

- Six extensions: Brands & ads, Storylines, Living world, Stir, Support desk, Engine link.
- Coins stay in Basic. A later "coins off" option is not planned.
- Polyamory stays in Storylines.
- No code yet; work starts this week.
- Order: slice 0 and the October fixes, then slice 1 (grouping), then slice 2 (onboarding).
- "Add extras" preselects Storylines only. The other extensions start off for new installs.
