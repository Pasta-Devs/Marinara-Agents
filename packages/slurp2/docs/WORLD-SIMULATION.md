# Slurp as a world simulation (concept)

Status: **proposal**, not implemented. `POSTING.md` describes what ships today. This document
describes where posting should go and how to get there in small releases.

Paths are relative to `packages/slurp2/src/engine/packages/server/src/slp/` unless stated.

## Why

User reports (Discord, 0.2.37–0.2.38):

- "Everyone seems to be writing the same thing." Slop across Creators, not only within one.
- "Everyone is moving / everyone is at the laundry." Characters moved house three times.
- Creators lean into arcs and seldom post about their own life. Tifa stopped talking about her bar
  and Cloud.
- Less lewd than before (largely a model change, DS 4.0 vs 3.2, but prompt realism pushes too).
- A smartphone in nearly every picture.
- Arcs never play out across posts.
- Custom prompts break whenever a feature adds prompt text.
- Users want "more fun, less realistic".

Evidence from the production install (read-only, 0.2.38):

- Post prompts are ~16.6k characters at the median, ~26.3k at p90 (81 recorded generations).
- One Creator used "nuja" in 18 of 24 outputs. The word was absent from the card and account, but
  appeared 10 times in the recent-posts section. The model copies its own old captions.
- Naming a catchphrase in a voice cue made it appear in 6 of 6 outputs.
- Hand-written concrete moments produced far more specific posts than the saved baseline
  (0/6 mirror/phone captions vs 5/6).
- A permissive automatic idea pool did **not** beat a plain prompt diet: at least 8 of 12 selected
  ideas failed editorial checks, mostly by asserting history that was never established.

The code history shows the same root cause patched phrase by phrase:

- `modules/feed/slp-post-variation.ts`: a vague place axis was read as "moving house" and
  "post-history continuity kept the move going forever".
- `modules/projects/slp-arc-library.ts`: arcs exist because "every Creator used to be moving house".
- `modules/feed/slp-planner.ts`: "a load of laundry all became a caption and a picture".

Root cause: **the planner decides why and how a post is made, but not what happened.** Vague prose
axes let the model pick the subject, and raw post history feeds that pick back until it becomes a
habit. Every Creator receives the same axes and instruction blocks, so every Creator drifts toward
the same subjects.

## Principle

A post is an **observation of a life that keeps going**. Slurp simulates the life; a post shows one
moment of it. Code owns what is true, what is due and what was used recently. The model owns voice,
reaction, joke and wording.

## Layers

Layers are merged again for every slot, so the result is dynamic even where a layer is fixed.

| Layer | Changes | Contents | Produced by |
|---|---|---|---|
| Fixed | almost never | card canon, lore, relationships, voice sheet, boundaries, niche patterns, static decks | code; one cached LLM extraction |
| Slow | days–weeks | life state (job, home, relationships), arcs, campaigns, weekly routine, wardrobe | state machines; LLM only for transitions |
| Moving | hours | today's schedule and location, condition and mood, open threads, promises, DM memories, audience reactions, world events, other Creators' posts | signals from every entry point |
| Slot | one post | time, intent, delivery, access, camera | today's planner |

## Entry points and signals

Every input is read through one envelope, a **signal**. It wraps existing records (continuity
facts and events, threads, promises, posts); it is not a second store:

```ts
type Signal = {
  id: string;
  at: string;
  source: "post" | "message" | "promise" | "commission" | "tip" | "subscription" | "comment"
    | "request" | "schedule" | "world" | "creator" | "engine-chat" | "agent" | "user";
  creatorIds: string[];      // empty = install-wide
  scope: "creator" | "niche" | "world";
  audienceScope: string;     // reuse the continuity audience scopes (public, subscriber, fan thread, creator-private)
  realityScope: string;      // reuse the continuity reality scopes (roleplay/game records stay out of posts)
  consent?: string;          // opt-in provenance for Engine-chat and agent input
  summary: string;           // short, privacy-safe
  refs: string[];            // source record and thread IDs
};
```

Sources:

- Slurp: published posts, DMs, promises, commissions, tips, subscriptions, comments, requests.
- Schedule: `modules/creators/slp-creator-schedule-context.ts`.
- World: `shared/src/slp/slp-platform-events.ts`, `shared/src/slp/slp-story-engine.ts`,
  `modules/world/events/slp-story-runtime.ts`, `modules/world/events/slp-story-packs.ts`.
- Other Creators: their published posts and collaborations.
- **Engine chats.** `features/creators/slp-chat-context.ts` *sends* Slurp activity into Engine
  chats. The inbound side exists in Slurp since 0.2.47 as `POST /continuity/from-chat`
  (`characterId`, `chatId`, optional `messageId`, `text`, optional `factType`/`subject`): it stores
  the moment as an active, `creator_private` fact with source `chat` on every page the character
  runs, once per message. Still missing: the Engine-side "Save to Slurp" action that calls it.
- Noodle and other agents (gap, same shape).
- User actions: directed posts, card edits, settings.

Structured records map to signals in code. Unstructured text (chats, DMs) goes through one cheap
LLM extraction that returns short memory facts; `modules/continuity/slp-continuity-extraction.ts`
is the model to extend.

## Memory

Two stores with different jobs:

- **World memory** — what is true. Every fact has provenance and a status:
  `proposed → confirmed/active → expired`, with disputed, retracted and rejected paths. These
  statuses, provenance, reality scope and audience scope already exist in the continuity ledger.
  Card canon, explicit user edits, supported Creator statements and real events may establish facts
  without a post. A *simulator-invented happening* remains proposed until its post actually
  publishes; an unused proposal never becomes canon. Publication itself establishes that the post
  exists, not that every joke or hypothetical sentence in its caption is a durable life fact.
- **Editorial memory** — what the feed used lately: subject keys, places, image types and
  overused phrases, **per Creator and across all Creators**. The second scope targets "everyone
  writes the same thing". Phrase checks run in code; phrases are never pasted into the writer as
  examples.

The writer never receives raw captions or titles as history. It receives the facts retrieved for
the selected beat. After writing, check claims about earlier events, other people, timing and
lasting changes against the brief before publication; proposal status alone cannot stop the
writer from inventing them.

## Daily simulation (preseed)

Per install, daily: **world tick** — active events, seasonal hooks, expiring trend proposals.

Per topical tag, weekly and cached: **niche patterns** — typical objects, problems and routines for
a Creator type. Tags come from the existing discovery tags
(`modules/discovery/slp-discovery-profile.ts`); no new classification.

Per active Creator, daily:

1. **Day plan (code).** Schedule + life state + arcs + open threads + world tick → where the Creator
   is and when.
2. **Happenings (LLM at level 2, decks at level 0).** 3–6 small events that fit the day plan, drawn
   primarily from card canon. Example: "19:00, the bar: a regular brings a gift Cloud made."
   Happenings are proposals.
3. **Candidates.** Each happening, due promise, campaign stage, arc step, callback and world
   occasion becomes an idea card.
4. **Checks.** Code checks eligibility, boundaries, expiry and duplication; an optional critic call
   rejects generic ideas and unsupported claims.

Code-side seed decks (complication, object, other person, sense/mood, post shape) are combined at
random and fed into happening generation. Variety comes from varied inputs, not from "be creative".

## References

Posts sometimes must refer to something: a DM, an earlier set, a roleplay evening, another
Creator's post. A reference is a property of a candidate, not raw history in the prompt:

- callback: "the paper star from last week's set"
- promise: "the cape she promised in DMs"
- chat memory: "the evening with {{user}} at the bar"
- cross-Creator: "her take on Creator X's challenge post"

The selector keeps a reference budget (for example one post in three). Retrieval supplies the one
fact needed. References return without bringing back the history loop.

## Selection and merge per slot

Hard precedence (extends `POSTING.md` step 2):

1. user direction
2. hard boundaries
3. established facts
4. due commitments (promise, campaign stage, arc step)
5. moving state
6. proposals

Then a weighted score: fit to the day plan, card-canon share, freshness, variety per Creator and
across Creators (including repeated *themes*, not only exact props), reference budget, arc weights
and user settings. Due promises and campaign references are commitments, so the discretionary
reference budget cannot displace them. A set needs completed material; a teaser or callback needs
the actual earlier set or media; a request or appreciation needs its approved audience subject.
Result: **one primary beat**, up to two supporting facts or references.

## Output

- **Post brief** — one delimited section in the runtime user message. Custom layouts can disable or
  replace system blocks but do not rewrite the user message, so the brief survives prompt rewrites.
  Generated text inside it is data, never instructions.
- **Visual anchor** — sent to the image path as a structured shot decision. Keep *who could have
  made this image* separate from *what viewpoint and crop the image shows*. The image path renders
  model-appropriate tags, concise prose, or a tested mix. A phone or mirror is visible only when
  the selected shot actually calls for it; source words such as "smartphone selfie" must not make
  a device appear by default.
- **Commit after publication only.** The outcome becomes a signal: it establishes facts, closes
  threads, updates editorial memory and becomes visible to other Creators. A failed post releases
  its reservation and marks nothing used.

### Prompt vocabulary and camera perspectives

Research existing model vocabularies before inventing prompt prose. Danbooru-style composition
tags provide useful camera choices: `from above`, `from below`, `from side`, `from behind`,
`dutch angle`, `close-up`, `upper body`, `cowboy shot`, `full body` and `wide shot`. `pov` is a
first-person composition that may introduce visible hands; it is not a general synonym for a
viewpoint. Select an angle only when the capture source can physically explain it: an arm's-length
shot cannot silently become a distant overhead view, and a partner-held shot needs that person
present. Keep subject and action ahead of decorative terms.

Store the visual decision as semantic fields: capture source, angle, crop, subject orientation,
focus, tilt, device visibility and a short visible scene. Render it per image connection:

| Renderer | Example for the same side-view costume detail | Use when |
|---|---|---|
| Tag-oriented | `solo, upper body, from side, looking at badge. A crooked paper badge is visible on the finished costume.` | The model is known to follow booru-style tags. |
| Short prose | `Waist-up view from her left side as she studies the crooked paper badge on her finished costume.` | The model follows photographic natural language better. |
| Hybrid | A few verified framing tags followed by one short scene sentence. | A matched image test shows this beats either form alone. |

The tag/prose renderer is downstream of the writer's scene and the existing typed visual brief.
The caption writer receives the beat, not provider tags. Use the same vocabulary for set shots and
multi-image fallback framings. Keep the Creator's image instructions, Engine style profile,
appearance, content level, reference images and custom image template intact. The optional image
rewrite already handles comma-separated tags, but must be tested for preserving the chosen angle
and crop. Prefer positive framing over long lists of forbidden devices; keep provider-specific
negative prompts where supported.

This is a *versioned prompt-recipe library*, not one universal tag string. Each recipe maps a
semantic visual property to tested tags or short phrases for a model family, records incompatible
combinations and a source, and falls back to clear prose when the image connection is unknown.
Apply the same discipline to other prompts, but research their *task vocabulary* separately.
Happening generation gets a compact day plan, established facts and one seed-deck combination;
candidate checking gets typed provenance and status; the caption writer gets one beat, relevant
facts, voice and access. Image generation gets the visible scene plus tested pose, expression,
lighting and framing terms. Keep each call's job explicit and compare short structured input,
short prose and any supported tag/prose mix on the actual configured model. Do not put image tags
in post captions or assume text and image models treat tags identically.

Primary references: [NovelAI image prompting](https://docs.novelai.net/en/image/basics/),
[NovelAI framing and angle tags](https://docs.novelai.net/en/image/tutorial-charactercreation/),
[Danbooru's image-composition vocabulary](https://shima.donmai.us/wiki_pages/tag_group%3Aimage_composition),
[Google Imagen prompt guidance](https://ai.google.dev/gemini-api/docs/imagen-prompt-guide), and
[FLUX image prompting guidance](https://github.com/black-forest-labs/skills/blob/master/skills/flux-image-best-practices/AGENTS.md).

```text
entry points → signals → world memory + editorial memory
                              ↓
fixed + slow + moving layers → day plan → happenings → candidates → checks
                              ↓
                  slot → select + merge → brief → writer + image
                              ↓
                   publication → signals (loop)
```

## Data shapes

| Shape | Minimum fields | State rule |
|---|---|---|
| `WorldItem` | id, locale, premise, window, tags, provenance, `canonicalEventId?` | trend proposals expire; only real events assert history |
| `NichePattern` | tag, object, complication, post job, visual, locale, cache version | a pattern, never a claim about a Creator |
| `CanonAnchors` | people, places, work, objects, habits, running jokes, beat-type palette, heat range, each with a card/lore source | fixed layer; one cached LLM extraction, refreshed on card edit, user-editable |
| `DayPlan` | creatorId, date, timezone, blocks (time, place, activity, source, confidence), source versions | derived, rebuilt when inputs change; unknown place/activity stays unknown |
| `IdeaCard` | source refs, beat, visible evidence, eligible intent/access/delivery, `requiresEstablishedFact`, reference kind, thread key, expiry, consequence class, status | reserved per slot; used only after publication |
| `PostBrief` | one primary beat, ≤2 supporting facts with provenance, visual anchor, access/time constraints, avoid-list, state effect | runtime only |
| `VisualPlan` | capture source, feasible angle, crop, orientation, focus, tilt, device visibility, visible scene, source references | semantic decision; one model-specific rendering per image call |
| `PromptRecipe` | model family/version, visual property, tags or short phrase, compatibility rules, evidence and fallback | cached vocabulary, validated against actual image models |

Content opportunities (`data/feed/slp-opportunity-storage.ts`) stay the durable slot decision and
gain a link to the selected idea card for retries. They are not the idea pool.

Target writer input: roughly 600–900 tokens for a simple post, 1,200–1,800 for a complex one,
measured, never by silently truncating user guidance.

## Open design problems from the day-simulation probe

The first offline probe (two Creators, twelve slots, one model) left five problems. These are the
proposed answers; each needs its own probe.

**1. The writer fills gaps with invented facts.** Level 2 briefs still produced unbriefed people,
earlier events and wrong times in at least 4 of 8 posts. The writer invents where the brief is
silent — the same root cause as the missing subject, one step later. Answer, cheapest first:

- *Close the gaps that matter.* The brief always states cast (`alone` or named people), time of day,
  place, and what came just before (`nothing relevant` is a valid value).
- *Name the free zone.* The writer may invent reactions, feelings, sensory detail, jokes and wording.
  It may not add people, earlier events, times or lasting changes.
- *Self-declared claims.* The writer returns, in the same call, structured fields next to the
  caption: people present, time, referenced earlier events, state changes. Code compares them with
  the brief. A mismatch triggers one revision or the fallback. No extra call.
- Only if that fails: an LLM claim check.

**2. Decks created a new shared formula.** Both Creators converged on "small flaw → keep or fix
it", and the exact-prop cap never fired. A complication deck makes every beat a complication.
Answer: a **beat-type taxonomy** with quotas, tracked in editorial memory per Creator and across
Creators — for example achievement, showcase, social moment, relationship moment, tease/flirt,
opinion, anticipation, sensory/mood, audience game, routine with a twist, callback, mishap.
Each Creator has a palette of beat types from `CanonAnchors` (a bartender's palette is not a
cosplayer's). Decks exist per beat type. The theme cap counts beat types and semantic themes, not
props. The probe's two Creators were both craft-leaning; the next probe needs contrasting Creators.

**3. Some slots had no valid beat.** Four of twelve slots lacked a request subject, an audience
action or older media. Answer: **beat-first for ordinary slots, intent-first for commitments.**
Due promises, campaign stages and user direction keep today's intent-first order. For ordinary
slots, select the beat first and derive a compatible intent and delivery from it. This also removes
the mismatch seen in production, where a post labelled `set` opened as a coffee update. When an
intent-first commitment has no source, it degrades like today's callback → casual rule, and the slot
still publishes.

**4. Heat and fun are not planned.** They were not tested, and the concept does not say who decides
them. Answer: heat is a planned slot property, drawn from the Creator's strategy within the
`CanonAnchors` heat range and the access level, and carried into the brief and the visual plan. Fun
comes from the beat-type mix (tease, audience game, playful mishap) and from removing realism
pushes such as "let it be dull". Both are scored in evaluation. Text-model recipes may be needed
where a model under- or over-shoots heat (DS 4.0 vs 3.2).

**5. Level 2 has not earned its calls.** Daily happenings made more ideas, not better ones. The
hypothesis: the valuable LLM work is extracting **specific canon** once (Tifa's bar, Cloud, the
regulars), not inventing a day. Code can combine canon anchors × beat type × day plan. Test level 0
plus `CanonAnchors` (one cached call per Creator) against daily happenings before paying for level 2.

Creators without a schedule get a routine template extracted once from the card (slow layer,
cached, editable); otherwise their day plan stays honestly unknown and beats avoid time-specific
claims.

## Levels

Users run different models, custom prompts, lore on/off and arcs on/off.

| Level | Extra calls/day | Supplies |
|---|---|---|
| 0 | 0 per day (one cached `CanonAnchors` call per Creator on card change) | code day plan, beat-type decks, canon anchors, selection, brief |
| 1 | ~1–2 per install + tags/7 | world tick, niche patterns |
| 2 | level 1 + ~2–5 per active Creator | happenings, memory extraction, critic |

Failure at any step (API error, bad JSON, stale sources, empty pool) falls to the next lower level.
The floor is today's planner. A post never fails because preseed failed. Settings: preseed level,
preseed model, per-Creator tag edits.

## What exists vs what is new

Exists, needs connecting: planner and axes (`modules/feed/`), post plan
(`features/feed/slp-post-plan-service.ts`), continuity ledger (`modules/continuity/`), schedule
context, story engine and platform events, arcs (`modules/projects/`), campaigns
(`modules/feed/slp-campaign.ts`), promises and follow-ups (`features/messages/`), content
opportunities, discovery tags, wardrobe, deep details (`features/feed/slp-deep-details-record.ts`).

New: a unified signal adapter over existing continuity records, publication rules for invented
happenings, editorial memory across Creators, day plan, happenings, idea cards, selector, post
brief, inbound Engine-chat memory, semantic visual plan and model-aware prompt recipes. The
continuity ledger already has fact statuses; the current image rewrite can preserve tag syntax,
but there is no camera-tag mapper or per-model recipe selection.

## Known faults to fix independently

All fixed or closed in 0.2.41: promised posts carry the Creator's typed label; "let it be dull" and
device wording are gone; the reported slow autopost did not reproduce on production (22 posts on a
day set to 25). The follow-up livelock was fixed in 0.2.39. A child-venue filter was decided
against: the models already refuse, and Slurp does not add a content filter.

## Releases

Each slice is a part of the final design, not a temporary patch, and ships on its own. Status as
of 2026-09-25 (branch `laser-guided-slurp`):

1. **Done (0.2.41).** Known faults above.
2. **Partly done (0.2.41, 0.2.43).** Editorial memory per Creator and across Creators (subjects,
   not captions); beat posts become continuity facts after publication. Open: the signal adapter.
3. **Done (0.2.41, 0.2.42).** Post brief in the user message; raw captions replaced; shot framing
   as composition tags. Open: matched image tests per image model; a tags-only or prose-only
   renderer only if those tests need one.
4. **Done (0.2.42–0.2.44), behind the Beats setting.** Canon anchors, beat types with decks, claim
   checks, day plan from schedule or card routine. Open: heat range use, anchor editor UI.
5. **Done (0.2.42).** Beat-first selection with per-Creator freshness and a cross-Creator theme cap.
   Open: callback references beyond arcs.
6. **Level 1 done (0.2.45)**, off by default: world tick, niche patterns, optional Slurp-wide
   events. Level 2 not started; start it only if level 0 and 1 fall short.
7. **Slurp side done (0.2.47).** `POST /continuity/from-chat`. Open: the Engine action, Noodle and
   other agents.
8. **Done (0.2.46).** Arc chapters are the beat of arc posts; once-only life events (moving, new
   job, breakup) never restart automatically.

## Evaluation

Offline replay against frozen production fixtures, one slot sequence per Creator, state cloned per
arm, publications replayed in order. Compare current, slice 3, level 0, level 1 and level 2 on the
same slot plans. Cover sparse and rich cards, lore on/off, arcs on/off, due promises,
set→teaser→callback, world events, custom prompts, German and English, at least two writer models.

Score whole feeds: subject specificity, repetition per Creator, **similarity across Creators**,
card-canon share, reference correctness, unsupported claims, heat, fun, image/caption agreement,
calls, tokens, latency. One reviewer should finish one run in about 30 minutes.

For image prompting, hold the beat, character, style, access, seed and image model fixed. Compare
today's source phrase with tags only, short prose and a tag-plus-sentence hybrid across feasible
angles and crops. Score angle/crop adherence, accidental phone/mirror/first-person hands, physical
camera feasibility, appearance/style retention and caption/image agreement. Repeat with image
rewrite on/off and a custom image template. A recipe becomes a default per model family only after
this matched test; provider names alone are not evidence that a tag works.

## Open questions

- How much of a day plan should be visible to users (and editable)?
- Which Engine-chat modes may feed Slurp memory, and with what consent?
- Should cross-Creator influence be limited to Creators that "follow" each other?
- How are lewdness goals expressed per Creator without a global push?
