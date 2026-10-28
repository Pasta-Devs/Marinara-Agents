# Slurp Storylines (design)

Status: **concept, second pass** (2026-10-12). Nothing here is built. The first pass patched arcs
and dramas side by side; this pass proposes an overhaul. It builds on `WORLD-SIMULATION.md`
(signals, beats, brief) and `DRAMA.md` (pack-owned content, cast, stages).

Paths are relative to `packages/slurp2/src/engine/packages/` unless stated.

## Why

Users want storylines with real choices, different endings, and consequences that reach other
storylines, plus a way to see and edit them as a flowchart. The first story that needs all of it is
a **pregnancy**.

## What the code has today

### Twelve systems move a story over time

All are pure, run on the world clock, and end in the same place: a beat that rides the Creator's
ordinary post call (or a DM, comment, notification). Each one re-implements who fits, a stage
machine, timing, caps, storage and Stir levers.

| System               | Where (`server/src/slp/`)                                                         | Shape                                                     | Content lives in                  |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| Arcs ("storylines")  | `modules/projects/slp-arc-library.ts`, `slp-arc-progress.ts`                      | linear chapters, fan polls that insert a detour           | code seed + packs + model-written |
| Dramas               | `modules/world/events/slp-drama-runtime.ts`                                       | stage graph, cast of 1–5, choices by fans / player / role | packs                             |
| Situations           | same                                                                              | no stages; a deck of small beats                          | packs                             |
| Occasions (events)   | `modules/world/events/slp-story-runtime.ts`, `modules/feed/slp-occasion-beats.ts` | dated moments, in order                                   | packs                             |
| Couples              | `modules/projects/slp-creator-couples.ts`                                         | sparks → dating → together → rocky → split                | code                              |
| Collabs, rivalries   | `modules/projects/slp-creator-ties.ts`                                            | request → answer → announce → drop; rivalry stages        | code                              |
| Bonds                | `modules/projects/slp-creator-bonds.ts`                                           | levels and a temperature                                  | code                              |
| Brand deals          | `features/projects/slp-brand-deal-lever.ts`                                       | offer → answer → sponsored post                           | code                              |
| Set campaigns        | `modules/feed/slp-campaign.ts`                                                    | set → teaser → callback                                   | code                              |
| Promises             | `features/messages/`                                                              | made in a DM → fulfil, tease or delay                     | —                                 |
| Life moments, beats  | `modules/feed/slp-life-moments.ts`, `slp-post-beat.ts`                            | decks with fit rules, no sequence                         | code                              |
| Feelings (modifiers) | `modules/creators/slp-creator-state.ts`                                           | a prompt line with an expiry                              | code                              |

### State sits in five stores

| Store                                   | Holds                                               | Read by                       |
| --------------------------------------- | --------------------------------------------------- | ----------------------------- |
| Continuity ledger                       | sentences the writer may use; status, scope, source | post brief, DMs               |
| `slurp2.story.facts` / `.opportunities` | tags with expiry; written by occasions only         | arc generation only           |
| `slurp2.creator-ties`                   | couples, collabs, rivalries, bonds, deals           | drama casting, tie beats, map |
| Creator state + modifiers               | energy, arousal, emotion, feelings with a clock     | DM stance                     |
| Per-system run state                    | arc projects, drama runs, occurrences               | its own system                |

One storyline influences another only where both happen to touch the same store. Arc chapters
declare `outcomes`, but they are always empty and nothing applies them.

### Content sits in four places

Constants inside modules (the arc seed, the shared life-moment pool, couple lines, feelings),
built-in **content packs** (`modules/world/events/slp-content-pack-library.ts`), the drama starter
set (`slp-drama-packs.ts`), and imported **Story Pack** JSON (`shared/src/slp/slp-story-engine.ts`).
Two different things are called "pack". The arc seed already claims the pack id
`slurp-everyday-life` without being one.

### What that means for the request

- **Endings, branches, player choices, a cast:** only dramas, and they stop at 90 days.
- **Length, stats, profile changes, real fan polls, an editor:** only arcs.
- **Influence on other storylines:** a channel exists, almost nothing writes to it.
- **A pregnancy is not mainly a storyline.** It is a **condition**: every post, every DM and every
  picture has to know about it for weeks, not only the few posts a storyline owns. Slurp has no
  place for a lasting condition. Feelings last hours; arc chapters reach only arc posts.

## The model: four nouns

```text
packs (content) ──► storylines ──change──► state ◄──read── moments
                        ▲                    │
                        └──── rules: requires, boosts, signals
```

### 1. State — what is true now

One store per Creator and one for the world, grown from `slurp2.story.facts`. An entry is a
**condition**:

```ts
{ tag: "pregnant", stage?: "month-6", line?: "You are six months pregnant.",
  look?: "visibly pregnant, about six months", track?: "body",
  until?: iso, origin: { pack, storyline, run, stage } }
```

- `line` is for the writer, `look` for the picture plan; both are optional and short. This is the
  feelings mechanism (a line plus an expiry) made pack-defined and long-lived.
- **Tracks** are a small fixed list: `body`, `home`, `work`, `love`, `family`, `public`. A track
  holds one condition and one running storyline at a time. That replaces the `once` list, the
  per-Creator arc cap and the "one main, one side drama" cap, and it is what stops "everyone moved
  house three times".
- **One reader.** `storyState(creatorId)` returns tags (for rules), lines and looks (for prompts).
  Ties are not copied: the reader exposes them as tags (`partner`, `rival`, `roommate`, `deal`).
- **Budget.** At most two standing lines in a post brief or DM and one look line in a picture,
  newest and highest track priority first. Plot lines keep the "one line or nothing" rule.
- **Transparent.** Every condition names what set it. A **Life panel** per Creator shows tracks and
  tags with their reason, like the People map does for ties, and Stir can remove one.

### 2. Storylines — what changes state over time

One format and one runtime: the drama runtime grown up. A storyline has a cast (1–5 roles; one role
is a solo story), `requires` (state), a `track`, stages and endings. A **stage** is the union of
what an arc chapter, a drama stage and a situation hold today:

| Stage part | Meaning                                                                                       | Comes from        |
| ---------- | --------------------------------------------------------------------------------------------- | ----------------- |
| time       | days, or story-clock units ("month")                                                          | arcs, dramas      |
| condition  | the line, look, mood, stat effects and profile proposal while it runs                         | arc chapter reach |
| beats      | planned: post, DM, comment, notification, money                                               | dramas            |
| deck       | small moments drawn now and then while the stage runs                                         | situations        |
| choice     | asked of fans (a real post poll), the player (DM chips) or a role; each option names a `next` | both              |
| outcomes   | state that stays: conditions, ties, boosts for other storylines                               | occasions, dramas |
| next       | a stage or an ending, optionally `when` one tag is or is not set                              | dramas            |

**Endings** are named end nodes with their own last beat and outcomes.

The four shapes that exist today become one:

| Today     | As a storyline                                           |
| --------- | -------------------------------------------------------- |
| Arc       | one role, stages in a line, time-driven                  |
| Drama     | several roles, branches                                  |
| Situation | one stage with no end and a deck                         |
| Occasion  | starts from the calendar; a solo run per Creator it fits |

### 3. Moments — small things that read state

Life moments and beat decks stay as they are and gain `when` on tags, so "cravings" only fits a
pregnant Creator and a gym session does not fit month eight. A stage deck is the same thing, scoped
to one stage.

### 4. Rules — how storylines influence each other

Only through state, never by reading another storyline's run:

- **requires / lacks** on a storyline's start and on an edge.
- **boosts:** an outcome raises the weight of storylines with matching story tags (today's arc
  opportunities).
- **signals** (second step): a storyline may start on a signal that already exists
  (`modules/continuity/slp-signals.ts`): a milestone, a big tip, a saved chat moment.

The library can draw a **storyline map** from this for free: an edge from A to B where an ending of
A writes a tag B requires.

## Packs or modules? Both, with one rule

**Modules hold the verbs, packs hold the nouns.** If a writer could change it without a programmer,
it is pack content. The engine has no genre words (as `DRAMA.md` rule 4 says for dramas).

| In packs (data)                                   | In modules (code)                                          |
| ------------------------------------------------- | ---------------------------------------------------------- |
| storylines, their stages, decks, choices, endings | runtime: casting, clock, choices, outcomes, tracks, budget |
| conditions: tag, line, look                       | state store and its reader                                 |
| shared moments and comment lines                  | fit rules, freshness, caps                                 |
| calendar entries                                  | couples, collabs, rivalries, deals, campaigns, promises    |

- **One pack format (v2):** `storylines` and `moments`. A v1 Story Pack (`arcs`, `events`,
  `situations`, `dramas`) converts on import.
- **Built-ins are packs.** The arc seed and the shared life-moment pool become the _Everyday Life_
  pack; SlurpCon, Awards, Holidays, Seasons, Spicy Firsts and the drama starter set become v2 packs.
  They ship in the package and pass the same validator as an imported file.
- **Three switches:** a pack on or off (Backstage › Packs, exists), a storyline's start mode
  (`manual`, `suggest`, `auto`, exists for arcs), and per Creator "never" (exists for dramas).
- **Hard-coded systems move last.** Couples, ties, deals and campaigns carry money, consent and fit
  rules and many regressions. Until PR 9 they only _publish_ tags through the state reader. Then
  the stages and lines of couples, rivalries and collabs become pack data; the money, consent and
  fit rules stay code. Deals, campaigns and promises stay code: they are business rules, not story.

Source layout (see `docs/architecture/README.md`): format and validator in `shared/src/slp/`, pure
runtime in `server/src/slp/modules/storylines/`, stores in `data/storylines/`, the world-tick
service, routes and Stir levers in `features/storylines/`, the flow view in client `modules/`, the
library, editor and Life panel in client `features/storylines/`. The old arc and drama runtimes are
deleted when their content runs on the new one; no shims.

## How the rest of Slurp plugs in

Everything else meets a storyline through one of three hooks, and only these three:

| Hook                     | Question it answers         | Used by                                                                            |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------- |
| `fit`                    | may this happen here?       | content toggles: spice level, turn-ons, hard noes, the player's tastes and "never" |
| `requires` / `outcomes`  | what is true, what is owned | conditions, ties, wardrobe, items                                                  |
| signals in, one line out | what happened elsewhere     | economy, messages, Support desk, ads, discovery                                    |

### Content toggles are gates

Spice is already a gate, not a story: a Creator's level, turn-ons and hard noes
(`server/src/slp/modules/creators/slp-spice.ts`), the Slurp-wide limit, and the player's tastes and
"never" list (`shared/src/slp/slp-spice.ts`). Packs already check it with one function,
`slurpPackFits` (`modules/feed/slp-occasion-beats.ts`): a minimum level, hard-no words, a topic.

- A storyline, a stage, a choice option and a deck moment each may carry one `fit` block, checked
  by that same function. A storyline that does not fit never starts; a stage that does not fit takes
  its fallback edge; an option that does not fit is not offered; a moment that does not fit is
  dropped, never softened.
- A pack lists its **topics** up front ("pregnancy", "toys"). They show as chips on the pack card;
  switching one off is the same as putting it on the "never" list for that pack.
- The player's tastes raise the weight of storylines and moments that carry the same topic, with
  the taste rules that exist (`slurpTasteFit`).
- **A storyline never moves a limit.** A hard no and the Slurp-wide limit always win. A storyline
  that wants a Creator to go further (the "Getting bolder" drama) may only _propose_ a level change
  for the player to accept, like an arc's profile change today.

### Wardrobe and items are state a Creator owns

The wardrobe is a closet of looks with tags (`shared/src/slp/slp-wardrobe.ts`); the model picks one
per picture from the looks code lets it see. Slurp has no inventory today; the wardrobe is the
nearest thing.

- **A condition filters the closet.** A condition may name wardrobe tags to prefer and to leave out
  (`wardrobe: { prefer: ["loose"], avoid: ["corset"] }`). Code filters the list before the model
  sees it. The condition's `look` describes the body; the wardrobe still dresses it.
- **An outcome adds or removes a look**, with the storyline as its source, so it shows where it came
  from and can go again when the condition ends (maternity looks, a con cosplay, a new haircut).
- **A beat may ask for one look** ("wear the gift").
- **Items** are owned things that are not clothes: a toy, a prop, a gift, a brand's product. An item
  is a state entry with no clock and no track: `{ item: "…", name, look?, origin }`. Moments and
  stages read it through `requires` ("unboxing" needs the item; the toy moments in _Spicy Firsts_
  need a toy instead of guessing from the level), outcomes give and take it, and the picture plan
  may show it. Looks stay in the wardrobe store; items get their own store and screen in PR 8.
- Later, on the same hooks: the player sends a Creator a gift (a signal) → an item → "wearing what
  you sent".

### Other features are sources and readers

They do not become storylines and storylines do not reach into them.

- **In:** each already emits signals (tips, subscriptions, milestones, goals, comments, saved chat
  moments). A storyline may start or a stage may advance on one.
- **Out:** each asks `storyState(creatorId)` for what it needs: DM stance takes the standing lines,
  the Support desk and offers may check a tag, ads may match a condition, a tip goal may be opened
  by a beat ("nursery fund") through the money channel.
- **Pack options.** A pack may split its content into named options the player switches (the
  _Family_ pack: pregnancy, hard endings). An option is a tag every entry of that part carries; it
  is not a new mechanism.

## Screens

- **Flow view** (one component for every storyline). Phone: stages as cards top to bottom, a choice
  shows its options as indented branches that fold, endings are end cards, state shows as chips
  ("sets: pregnant", "needs: partner"). Wide: the same data left to right. Plain SVG, no new
  dependency.
- **Editor.** Tap a card: time, condition, posts and messages, small moments, choice, afterwards.
  Inline checks: unknown target, unreachable stage, an edge with no fallback.
- **Draft with AI.** Today the model already writes an arc for a Creator. It writes a storyline in
  the new format instead, the validator checks it, the player edits it in the flow view. Authoring
  uses the model; running never does.
- **Variants.** "Duplicate as variant" keeps a `variantOf` link; the library groups them.
- **Dry run.** Seeded walk through the graph: path, days, state written. No model call.
- **You are here.** A running storyline shows the same view with the path taken and the current
  stage, on the Creator's page and in Stir.
- **Life panel** per Creator, and the **storyline map** in the library.

## Pregnancy

Ships in a _Family_ pack, off by default. The player turns the pack on and picks the start mode;
with `manual` it starts only on the Creator the player picks, so no gender rule is needed.

- **Requires** `partner`, **lacks** `pregnant`. **Track** `body`. Story clock: one month ≈ 5 days at
  normal pace, about 6 weeks in all.
- **Stages** follow the months. Each sets the condition (line + look), so every post, DM and picture
  knows, and carries a deck (tired, cravings, the first kick, fans guessing, the partner fussing).
- **Planned beats:** the test, telling the partner, the announcement, the reveal, a shoot, the due
  date. The partner role gets beats too; a player who is the partner gets DMs.
- **Choices:** tell the partner now or wait (her, or the player as partner); announce or keep it
  secret (fans or her) — the secret branch hides it in pictures until it comes out; the name (fans).
- **Endings:** `born` by default, which sets `parent` on the `family` track with no expiry. Hard
  endings exist as separate endings that are off until the player turns them on.
- **What it opens:** a _New parent_ situation, "back in shape", and whatever a pack gates on
  `parent`.
- **One hard line**, as `DRAMA.md` sets for family ties: the child never appears in a picture and is
  never part of a spicy post. After the birth the child is a mention.

## Alternatives looked at

| Option                                     | Why not                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Patch arcs and dramas (first pass)         | keeps two formats and two editors; the condition problem stays                                    |
| Storylets only (state and rules, no graph) | best for emergence, but no authored endings to see or edit as a flowchart; kept as the deck layer |
| A model that directs the plot              | breaks "code decides, the model writes": no undo, no dry run, cost per tick                       |

## Risks

1. **Size.** Arcs reach far: model-written arcs, real polls, crossovers, profile proposals, pace,
   Stir levers, project pages, post details, backup. This is the largest Slurp change since the
   modular refactor.
2. **Prompt weight and sameness.** `WORLD-SIMULATION.md` shows what extra prompt lines cost. The
   budget above is a hard cap, and a pack sets how many Creators may run one storyline at once.
3. **Pictures.** The probe shows a `look` line carries within one day of posts; holding it across
   weeks is still untested.
4. **Two relationship engines** remain (code couples, pack dramas) until PR 9.

## Probe result (2026-10-12, production, one Creator)

A hand-set condition with today's knobs: a public `circumstance` continuity fact ("six months
pregnant … part of her daily life and her content") and the look appended to the card's image
instructions. 14 posts, all generated, all with a picture. DMs were not run.

- **The look carries.** The bump is visible in 12 of 14 pictures (one crop too tight, one flat).
  Deep details show the look line in the image prompt. No child appeared.
- **The line does not.** 0 of 14 captions refer to the pregnancy, although Deep details show the
  fact in the writer's prompt ("Life: …"). As continuity it is background the writer may use, and
  the beat planner picks every post's subject, so it never becomes the subject. Pictures and
  captions then disagree.

What this changes in the design:

1. A condition's `line` is not enough on its own. The state reader puts it in the brief as what is
   true **now** (beside cast, place and time), not as a continuity fact.
2. The condition must also **feed the beat planner**: its stage deck supplies beats, and about one
   post in N (a pack value) takes a condition beat as its subject ("the first kick", "cravings at
   2 am"). The other posts only stay consistent with it.
3. The probe for PR 1 repeats this run with the line in the brief and condition beats on, and
   passes when captions reflect the condition in roughly the share the pack sets, without every
   caption saying it. DMs are added then.

## Pull requests

Each PR goes to `staging` as a working release; nothing waits on a later PR to be usable.

0. **Probe** (no PR), on a dev box: one Creator with a hand-set condition line and look, about 20
   posts, DMs and pictures. If the condition does not carry, stop and rethink before building.
1. **State.** The store, tracks, the reader and the line budget; its use in the post brief, DMs,
   pictures and wardrobe; condition beats; arcs write outcomes into it; the Life panel. Detail
   below.
2. **Format v2.** Validator, converters from v1 (arcs, events, situations, dramas), dry run. Pure;
   nothing changes for the player.
3. **Runtime, arcs first.** Stages with conditions and decks, endings, `requires`, story clock, real
   fan polls. Arcs run on it; the old arc runtime goes.
4. **Everything else onto it.** Dramas, situations and occasions; built-in content becomes v2
   packs; one Packs screen. The old runtimes go.
5. **Gates and wardrobe.** One `fit` on every level, pack topics as chips, taste weighting; closet
   filter, looks from outcomes.
6. **Family pack.** Pregnancy, written by hand as pack data; content check on a dev box.
7. **Editor.** Flow view, editing, AI draft, variants, dry run, storyline map.
8. **Items.** The item store and its screen, gifts from the player, things bought with coins.
9. **Couples, rivalries and collabs as packs.** Their stages and lines become pack data; money,
   consent and fit rules stay code. Last, because it has the most regressions to keep green.

## PR 1 in detail: state

Goal: a condition set on a Creator shows in her captions at a rate the pack controls, in every DM
when it matters, and in every picture — the probe's failure fixed.

### Why the probe's line did not carry (code)

- Continuity facts reach the post prompt as `# What you already know` with "facts to be consistent
  with … do not quote them" (`server/src/slp/modules/continuity/slp-continuity-prompt.ts:70`). That
  framing is right for memory and wrong for a condition.
- The beat brief (`slurpPostBriefSection`, `modules/feed/slp-post-brief.ts:210`) states what
  happens, cast, place, time, callback and day, and has no slot for "what is true now".
- The beat source order (`features/feed/slp-post-beat-service.ts:177-234`: nudge → tie → drama →
  occasion → steered → bond → life → card) has no source that a standing condition feeds.
- DMs already have the slot: `happeningNow` takes the feelings' lines
  (`features/messages/slp-message-generation-service.ts:404`).
- Pictures got the look because card image instructions go into the image prompt as "Character
  image preferences" (`features/media/slp-public-images-service.ts:316`).

### Data

Grow the existing story fact (`slpStoryFactSchema`, `shared/src/slp/slp-story-engine.ts:318`,
stored under `slurp2.story.facts`). New fields are optional, so stored facts stay valid:

```ts
{
  // existing: id, scope, creatorId, tag, label, sourceKind, sourceId, createdAt, expiresAt
  sourceKind: "arc" | "event" | "player",          // + "player" (Life panel); "storyline" in PR 3
  track?: "body" | "home" | "work" | "love" | "family" | "public",
  line?: string,     // ≤ 160, second person: "You are six months pregnant."
  look?: string,     // ≤ 120, for pictures: "visibly pregnant, about six months"
  wardrobe?: { prefer: string[]; avoid: string[] },   // wardrobe tags, ≤ 6 each
  deck?: { line: string; withPartner?: boolean }[],   // ≤ 12 condition beats, ≤ 160 each
  share?: number,    // 0–0.5: chance an ordinary slot takes a deck beat (default 0.25)
}
```

- **One condition per track.** Writing a condition on a track that holds one ends the old one
  (it expires now, with a note). Facts without a track behave as today (tags only).
- No new settings key and no migration.

### Reader

`slurpStoryState(input)` — pure, new file `server/src/slp/modules/storylines/slp-story-state.ts`.
Input: the facts, the Creator's ties (as from `slurp2.creator-ties`), `at`. Output:

- `tags`: active fact tags, plus tie tags (`partner`, `ex`, `rival`, `roommate`, `friend`, `deal`);
- `lines`: at most **2**, ordered by track (`body`, `love`, `family`, `home`, `work`, `public`),
  then newest;
- `look`: at most **1** (same order); `wardrobe`: merged prefer/avoid;
- `deck`: the beats of the conditions that have one, with their `share`.

A service in `features/storylines/` loads facts and ties once per post or reply and calls it.

### Where it goes

| Surface       | Change                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post brief    | `slurpPostBriefSection` gains `now?: string[]`; after `Time:` it writes `Right now: <lines>. This stays true in this post; mention it only if this post is about it.` |
| Classic posts | (no beat) the same two lines as a short `# Right now` section before the recent posts                                                                                 |
| DMs           | the lines join `happeningNow`, before the feelings                                                                                                                    |
| Pictures      | `Right now: <look>` beside "Character image preferences", in public and DM pictures                                                                                   |
| Wardrobe      | prefer/avoid filter the closet before `slurpWardrobePrompt` lists it; if nothing is left, the filter is dropped                                                       |
| Continuity    | conditions are never written as continuity facts                                                                                                                      |

### Condition beats

A new beat source `condition` in `slp-post-beat-service.ts`, after `occasion` and before `steered`:

- Draw with the condition's `share`, seeded by account and slot sequence (as other sources do).
- Pick a deck line not used in this Creator's beat history; `withPartner` adds the partner from the
  tie tags to the cast (else the plain line).
- `anchorKind: "condition"`; free zone as for life moments (no lasting change).
- A Creator with no deck gets no condition beats; her condition still shows through the brief.

### Who writes conditions in PR 1

- **Arcs:** chapter `outcomes` are applied through `applySlpStoryOutcomes` when a chapter starts
  (today they are never applied). `add-creator-fact` gains the optional fields above.
- **The player:** the Life panel.
- Dramas and occasions write conditions in PR 4.

### Life panel

In the Creator sheet (Stir) and the Creator's settings. Phone first.

- Six track rows; each shows its condition (label, line, until, "set by …") or "—".
- **Add** on a track: label, line, look, wardrobe chips, deck lines, share slider, days or "until
  removed". **Remove** ends it now.
- Tags without a track below, read-only.
- Routes: `GET /story/state/:accountId`, `POST /story/state/:accountId`; **Remove** uses the
  existing `DELETE /story/facts/:id`.
- Built (0.3.29): the panel sits in the Stir creator sheet as "Life right now". Deck lines with
  `withPartner` come from storylines only; the panel writes plain lines.
- Strings in `en`, `de`, `ko`, `pl`.

### Tests

- Reader: budget (2 lines, 1 look), track order, expiry, one condition per track, tie tags.
- Brief: `Right now` appears with a condition and is absent without one; classic section likewise.
- Beat order: the posting-flow regression includes `condition` in the right place; share 0 never
  draws, a used deck line is skipped.
- Arc outcome: a chapter's `add-creator-fact` lands in `slurp2.story.facts` with its line and look.
- **Live (cheap agent):** the probe again, with a player condition (line, look, deck of 8, share
  0.25). Pass: 14 posts → pictures show the look in at least 11; 2–6 captions are about the
  condition and the rest do not contradict it; 6 DMs → none contradicts it, and it comes up when the
  fan asks how she is.

### As built (2026-10-21, on slurpothon)

Rebuilt from the old branch on the modular layout. The reader is `modules/storylines/slp-story-state.ts`;
`features/storylines/` owns the loader, the picture look and the Life routes, behind
`slp-storylines-contract.ts`. The loader returns an empty state while Storylines is off, and arcs write no
conditions then, so nothing reaches a prompt. A new condition on a track sets the old one's `expiresAt`
and keeps it on record. Tie tags also give `ex` (a split couple) and `deal` (an accepted or planned brand
deal). Conditions never reach the arc-generation prompt as themes. The Life card sits in the Stir sheet
and in the Creator's Storylines tab.

### Not in PR 1

Storylines (PR 3), dramas and occasions writing conditions (PR 4), moment `fit` on tags (PR 5),
items (PR 8). Version: one patch bump.

## Tests

- **Converters:** every built-in arc, drama, situation and event converts and runs to an end in the
  seeded simulation; a stored install converts once and reads the same.
- **Simulation:** 12 seeded Creators, 120 days, joins and leaves, every pack on. Every run ends, one
  storyline per track, the line budget holds, same seed gives the same world.
- **State:** a condition reaches the brief, the DM stance and the picture plan; it expires; removing
  its origin removes it.
- **Pregnancy:** every choice both ways reaches an ending; the look follows the stage; no picture
  brief names the child.
- **Architecture regression and typecheck** after each structural change.

## PR 2 as built (2026-10-21, on slurpothon): format v2

- **Format:** `shared/src/slp/slp-storyline.ts`. A pack v2 (`schemaVersion: 2`) holds `storylines`; moments
  come with PR 4. A storyline has a cast (drama roles), `requires` (`tags` / `lacks`), an optional track, a
  `start` (mode, activation, target, weight, cooldown, once), stages and endings. A stage has `days`, a
  `condition` while it runs (tag, line, look, wardrobe, deck, mood, effects, profile), influences, planned
  `beats`, a `deck`, a `choice`, `next` (a key, or `{ to, when: { tag, set } }` entries) and `enter` /
  `leave` outcomes (story facts, boosts and ties in one union). A stage without `days`, choice or `next`
  stands: that is a situation.
- **Validator:** keys unique, every target exists (also `next` beside a choice: the way on when the stage is
  skipped), every stage reachable, no cycle, only a lone stage with no endings may stand, the longest way at
  minimum days fits `maxDays`, roles exist, a track is built in or added by the pack (`tracks`).
- **Converters:** `slp-storyline-v1.ts`. Ids become `arc:<id>`, `event:<id>`, `situation:<id>`,
  `drama:<id>`, with `source` naming the v1 entry. An arc chapter's fans' choice leads into its branch
  chapters, then on; chapter outcomes and opportunities become `enter`. An event is one timed stage. A
  situation is one standing stage that starts by itself (`auto`) and sets its own id as a tag; a drama that
  needs it requires that tag and casts from it (`start.within`). A reversed arc day pair reads as its low end. A
  drama's stage outcomes become `leave` and its exit is the ending's beat. `parseSlpStoryPackV2` reads either
  format and refuses a pack whole if one entry does not convert.
- **Dry run:** `server/src/slp/modules/storylines/slp-storyline-dry-run.ts`, seeded stage lengths and choices,
  `when` read from the tags the run sets. Every built-in converts and ends (situations stand).
- Nothing reads the new format yet; the runtime moves onto it in PR 3. For PR 3: a fans' choice is decided
  by votes (its `default` and `timeoutDays` do not apply), and a stage waits for its choice, so its real
  length can exceed `days`; the dry run counts only `days`.

## PR 3 as built (2026-10-21, on slurpothon): arcs on storylines

- **Decision (player):** keep the run, swap the engine. A project stores its own storyline, the stage it is on,
  the way each stage went (`taken`) and the ending reached. The chapter fields are a view of that line
  (`modules/projects/slp-project-storyline.ts`), so the screens, the post brief, Stir and Deep details read
  what they read before. `modules/projects` stays (see DECISIONS, "Arcs run on their storyline").
- **Start:** a library arc copies its type's converted storyline; a custom arc builds one from its chapters. A
  record stored before PR 3 converts on read. Chapter fields edited by hand rebuild the storyline, each stage
  keeping its outcomes, condition and moments by label; a moved `chapter` only moves the stage.
- **Moving:** days, a fans' choice (the real post poll, as before) and `when` ways read from the Creator's
  story tags; an ending completes the run. Director `insert` puts the new stage after the current one and
  after the branches of an open choice; `label`, `skip` and `back` work on the stage.
- **Writing state** (Storylines on): leaving a stage applies its `leave` outcomes and removes its condition;
  entering one sets its condition (tag, line, look, wardrobe, deck, on the storyline's track) and applies its
  `enter` outcomes (v1 chapter outcomes and opportunities); an ending applies its outcomes.
- **Not yet:** `requires` and the story clock wait for a start path that reads v2 storylines (PR 4); drama
  outcomes (ties) and ending beats run in PR 4. A library edit no longer reaches a running arc's outcomes; the
  run uses the copy it started with.

## PR 4a as built (2026-10-21, on slurpothon): dramas and situations on storylines

- **One runtime, storylines in.** The drama library still stores v1 entries (the Drama screen and Story
  Pack import read them); `slpDramaStorylines` converts each on load and the drama runtime runs the
  storylines. A run keeps the v1 id (`slpDramaId`), so running state, cooldowns and Stir picks carry over.
- **Read from the storyline:** the cast, `start.within` (the situation it stands in), `start.weight` and
  `start.cooldownDays`, stage `leave` ties, `when` ways (the lead's story tags, plus the situation it
  stands in), and endings: the one reached applies its ties and sends its beat. A stage with no days
  stands until its choice is answered or the storyline runs out of time.
- **`requires` / `lacks`** on a start check the lead's story tags (story state plus tie tags such as
  `partner`); Stir's lead pick checks the same. Casting moved to `slp-drama-cast.ts`.
- **Refused, not dropped:** a v1 drama or situation that does not convert (a loop, a stage nobody
  reaches) fails Story Pack import with the reason, and Stir's start preview says it cannot run.
- **Not yet (PR 4b):** occasions, built-in content as v2 packs, one Packs screen; story outcomes
  (conditions) from drama stages.

## PR 4b as built (2026-10-22, on slurpothon): v2 Story Packs and drama story state

- **v2 import:** a `schemaVersion: 2` Story Pack parses with `parseSlpStoryPackV2`; its storylines go to
  `library.storylines` (stored with their pack id, switched off until picked). A storyline with one stage, no days
  and no endings stands as a situation; every other one runs as a drama. Export stays v1. A storyline may not
  take a built-in or v1 id (one id space for runs, cooldowns and settings), and its `source` is dropped on import.
  A storyline with `start.within` is on only while that situation is on.
- **Story state from dramas:** every stage move (enter, leave, ending, left, time) writes the stage outcomes to the
  lead with `sourceKind: "drama"`, the same way arcs do. A run stopped from outside (switched off, Stir end) only
  removes the current stage's condition.
- **Not yet:** tracks that a v2 pack adds are checked on import but not stored, so a condition on such a track is
  not written. The family pack (PR 6) uses the built-in `body` track.
- **Not yet (PR 5):** occasions and built-in content packs as v2 with JSON `fit`, and one Packs list. The list waits
  for PR 5 because the built-ins then become v2 packs, so it needs only one way to switch a pack on or off.

## PR 5a as built (2026-10-22, on slurpothon): JSON `fit` on every level

- **One JSON gate.** `slpFitSchema` (`shared/src/slp/slp-drama.ts`): `level`, `hardNo`, `needs`, `topic`, as word
  lists. A word matches whole, `word*` matches a word's start; phrases and odd characters stay literal, so an
  imported pack cannot bring a regular expression. `slurpPackFits` checks it, and the built-in content packs use it.
  The life-moment pool and the arc seed keep their code patterns until they become the _Everyday Life_ pack.
- **Where it is checked (drama runtime).** A storyline's `fit` filters who may take the first role, so it never
  starts on a Creator it does not fit; a stage that does not fit the lead is skipped like one nobody can be cast for;
  an option that does not fit is not offered (the run keeps `offered`, the player's chip maps back to the real
  option); a beat or deck moment is checked on its actor and dropped. A gated entry whose card text is not known
  does not fit. The world reads card texts and hard noes only when a switched-on storyline has a `fit`.
- **Not yet:** `fit` on storylines that run as arcs (they keep their arc type's fit); pack topics and taste weighting
  come with 5b.

## PR 5b as built (2026-10-22, on slurpothon): one Packs list, occasions in v2

- **Pack record.** An uploaded pack that imports at least one entry gets a record in the imported library
  (`slurp2.drama.library` → `packs`): name, version, description, author, `topics`, its `occasions`. Bundled
  packs from Review get none. `GET /story-packs/bundled` lists the records as `imported`.
- **The switch is a gate.** `contentPacks[id]` now also holds imported ids (default on). Off: `slurpPackGate`
  keeps the pack's arcs out of the automatic pick and its events out of the calendar and activation;
  `slpDramaEnabledIds` drops its dramas and situations from `drama.enabled` for the runtime (a running one ends
  like a switched-off one); the planner skips its occasions. Every entry keeps its own switch.
- **Remove.** `DELETE /story-packs/:id` (imported only, confirmed in the client) deletes the pack's arcs and
  events by `provenance.packId`, its drama entries by `packId`, their ids in `drama.enabled`, the record and
  the switch. Running occurrences keep their own copy of the event.
- **Occasions.** A v2 pack's `occasions` are today's event shape plus `beats` and a JSON `fit`. The parse lists
  each occasion's event part in `events`, so Review imports it like an event; the record keeps the beats, and
  the planner looks them up by content id after the built-in packs. A beat type the planner does not know is
  dropped. A regression reads every built-in pack as a v2 file (arcs as storylines, events as occasions);
  `dateBeats`, birthday and first thousand subscribers stay built-in code hooks.
- **Review fixes.** The gate also sits in `slpLiveEvents`, the one path for event effects (prompts, economy,
  signals), so an off pack's events have no effect at all. An upload may not use a bundled or built-in pack id
  (those carry Slurp's core entries). Remove also cancels the pack's active and suggested occurrences.
- **Known limits:** packs imported before 0.3.58 have no record, so they are not in the list and cannot be
  removed there (their entries keep their own switches). Remove, like apply, reads settings outside the update
  queue. A "copy" of an occasion without a `contentId` gets a new id and loses its beats.
- **Not yet:** topic chips on cards beyond the list, taste weighting, looks from outcomes (done in 5c, below).

## PR 5c as built (2026-10-22, on slurpothon): topic switches, taste weight, looks from outcomes

- **Topic switches.** The topic chips on an imported pack card switch. Off is stored as
  `contentPacks["<pack>:<topic>"] = false` (no new setting). `slurpPackTopicOff` (`modules/feed/slp-occasion-beats.ts`)
  treats it as a "never" for that pack only: an entry whose own `fit` topic or needs words match it does not run.
  The planner checks it on the pack's occasions, `slpDramaEnabledIds` on its storylines. Remove clears the keys.
- **Taste weight.** `slurpTasteWeight` (`modules/creators/slp-spice.ts`): 1, plus 1 / 2 / 3 for each player taste
  (hint / often / obsessed) that shares a word with the fit's topics or needs. It multiplies a drama's
  `start.weight` in the start pick and the weight of each moment in the occasion pick. The fit gates run first, so
  a taste never brings back an entry a hard no or "never" ruled out.
- **Looks from outcomes.** Two story outcome kinds: `add-look` (a full wardrobe look input) and `remove-look`
  (by name). `applyStoryOutcomes` gives each participant the look with source kind `storyline` and the storyline
  (or arc) name as the label, once; remove takes only a look that storyline gave, never the player's own. A full
  closet skips the look. The pure decision is `slurpStoryLookChange` (`modules/storylines/slp-story-state.ts`).
- **Known limits:** a topic switch checks the entry's own fit; stage, option and beat fits inside a pack storyline
  do not see it. Arcs from packs have no fit yet, so topic switches do not reach them. An occasion's event part
  (in `platformEvents`) has no fit, so it still goes live with its own switch; only its moments stop.
- **Review fixes.** An upload may not use ":" in its pack id (it would read another pack's topic keys); toggle
  keys may be 170 characters long. A storyline takes back only a look it gave itself (same source label).

## PR 6 as built (2026-10-22, on slurpothon): the Family pack

- **Pack data.** `slurp-pack-family` (`modules/world/events/slp-family-pack.ts`) is a built-in pack, off by
  default, with four v2 storylines and no events or arcs. Slurp is a creator platform, so each way in comes
  from her work or her life: `family-pregnancy-couple` (needs a couple tie), `-collab` (needs a `collab` tie;
  the collab partner is the father), `-player` (she is the player's partner or crush), `-surprise` (no cast
  father). Each starts `auto` (rare weight, 120-day cooldown, once) or by the player's pick in Stir, and needs
  a Creator who is not `pregnant` or `parent` yet.
- **Pack switch.** `slpDramaEnabledIds` adds a built-in pack's storylines while the pack is on; the pack switch
  is their only switch. Drama settings list them with "On while the pack is on" and show their dials.
- **Business.** Stage influences (`multiply` on `audience.growth`, `economy.creator-earnings`, `feed.reach`)
  reach the lead's numbers through `slurpDramaStageFactor` (`data/world/slp-drama-storage.ts`), read by
  `platformInfluenceMultiplier` and by real income (`earnCreatorIncome`); one state read when nothing runs. Announcing
  gives ×1.3 growth and ×1.1 earnings; a secret costs ×0.9 growth, then the reveal gives ×1.4. The new
  outcome `brand-offer {words}` opens a brand deal for the first catalog product that fits her and matches a
  word (baby, maternity, mom, …).
- **Engine refinements.** Tie kind `collab` from `creatorCollabs` (plus the story tag `collab`); a lead role
  leans to Creators whose turn-ons match the storyline fit (`slurpTasteWeight`); a choice option may carry
  `when: {dial: value}`, so the scan's loss option exists only with the `hard` dial on (one scan in four).
- **The hard line.** No look or moment pictures a child; the `born` ending adds the fact `parent` with the
  line "never in a picture, never in a spicy post".
- **Known limits:** v1 export does not include pack storylines; running brand deals do not pause; the
  brand offer needs a matching brand in the catalog, else nothing happens.

## Later: Basic and add-ons

The player wants Slurp split into a basic part and add-ons that can be switched, so setup and
settings get simpler. There is no plan for it yet and this document does not make one. What it
leaves ready: the three hooks are the seam. A feature that only gates, reads and writes state, and
sends and receives signals can be switched off without anything else noticing, and its Backstage
panel already registers on its own (`docs/architecture/README.md`). An add-on would then be a
switch, its panel, its packs and its tags.

## Decided

- A pregnancy runs about 6 weeks at normal pace.
- `born` is the default ending; hard endings are separate and opt-in.
- Opt-in is the pack plus the storyline's start mode; no gender rule.
- All of it, including a real inventory and couples in packs, in several PRs.
- The probe comes first.
- (2026-10-21) Tracks: the six above are built in, and a pack may add its own track.
- (2026-10-21) Names: "Storylines" in the UI; server module `storylines` beside `projects`, which
  goes when arcs run on the new runtime (PR 3).
- (2026-10-21) Loops: the validator rejects a cycle, so every run ends. A situation stays one stage
  with no end and a deck.
- (2026-10-21) PR 1 is built again on `slurpothon` (behind the Storylines switch); the old
  `the-plot-thickens-branch-out` code is a reference only.

## Open decisions

1. Items: what the player can buy or send, and what it costs (before PR 8).
