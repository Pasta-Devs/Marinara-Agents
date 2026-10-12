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
3. **Pictures.** Whether image models hold a `look` line across weeks is unknown. Probe it first.
4. **Two relationship engines** remain (code couples, pack dramas) until PR 9.

## Pull requests

Each PR goes to `staging` as a working release; nothing waits on a later PR to be usable.

0. **Probe** (no PR), on a dev box: one Creator with a hand-set condition line and look, about 20
   posts, DMs and pictures. If the condition does not carry, stop and rethink before building.
1. **State.** The store, tracks, the reader and the line budget; its use in the post brief, DM
   stance, picture plan and moment fit; arcs and dramas write outcomes into it; the Life panel.
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

## Open decisions

1. The track list, and whether a pack may add a track.
2. Names: "Storylines" in the UI; the server module `storylines` beside `projects`, or inside it.
3. Loops in a graph: allowed with a day limit as the stop, or rejected.
4. Items: what the player can buy or send, and what it costs.
