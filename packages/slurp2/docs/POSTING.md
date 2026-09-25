# How Slurp decides what a Creator posts

Every automatic post goes through the same steps. The planner decides; the model writes. Nothing is
decided after the model has spoken, and nothing private reaches a post.

## 1. Does this Creator post at all?

`modules/feed/slp-planner.ts` draws a quiet slot from the Creator's strategy rate (12% by default).
A quiet slot is a **chosen skip**: the slot is discarded, and there is no model call, no picture, no
attempt claim, no retry, and no failure mark. Two quiet slots in a row are refused, so a page never
goes silent for a whole day. The skip is stored, so later planning knows the Creator had a quiet
afternoon.

## 2. Why is this post being made?

In order of precedence:

1. the player's own direction or the composer's one-shot purpose;
2. a **promise** made in a message thread (fulfil, tease, or delay) — it was made to a person;
3. a due **campaign stage** — the teaser or callback around a set the Creator already shot;
4. a weighted draw over the Creator's intent weights. A Story draws from every intent except
   `set` and `callback`. A drawn callback with no earlier shoot becomes a `casual` post.

Intents: `casual`, `teaser`, `set`, `behind_the_scenes`, `request`, `appreciation`, `callback`,
`business`.

With the **Beats** post planner (setting `postPlanner`, default `beats` since 0.2.55), step 4 is beat-first: a
beat type is drawn from the Creator's canon-anchor palette, weighted down for this Creator's recent
beats and capped across all Creators in the last day, then filled with one canon anchor and one
written situation template. The intent is drawn only from the intents that beat can serve. The
beat is stored on the plan, becomes a `# This post` brief (cast, place, time, what came before, free
zone), and the writer declares its claims so code can check them. Missing anchors or any failure
fall back to the classic draw for that post.

## 3. How does it go out?

Delivery is separate from intent, so a Story or a plain text post can also be a thank-you or a
teaser: `text_only`, `new_capture`, `existing_media`, `story`, `multi_image_set`, `cropped_preview`.

Text-only is a real choice, scaled by the Creator's own lean on words. A set is never text-only. With
no pictures available, every post is text-only and says so honestly.

## 3b. How long is it?

The format rotation varies length, but the intent rules out lengths that contradict its job
(`slurpIntentFormat`): teasers, callbacks, and ordinary days are always captions; only
behind-the-scenes posts may run long.

## 4. Is there a real picture already?

- A **callback** mostly shows a picture from the shoot it names.
- A public **teaser** can show a server-side crop of a recent locked set.
- Other posts occasionally repost an older picture of their own.

A picture from a locked post is only ever reused in another locked post, except as that server crop.
Reused bytes are copied into the new post, so deleting one post never breaks another.

## 5. Who is holding the camera?

`modules/feed/slp-camera-source.ts` picks a camera the scene can pay for — selfie, mirror, tripod,
partner, screenshot, archive — biased by the Creator's production style. The image brief is built
from the situation and the camera, never from the caption the model just wrote.

## 6. The plan is stored before anything is written

The decision lands in `slurp2_content_opportunities` first, so a retry repeats the decision instead
of making a new one, and a run that dies between the two loses nothing.

## 7. The model writes

The post prompt receives the Creator's identity and voice, the selected intent and delivery, the
production style and the Creator's own note about how they run their page, the camera and shoot
context, access, schedule, recent posts, and the **approved continuity** notes for this surface.

It never receives a fan's direct-message notes or another fan's private records, unresolved proposals, or roleplay and game records.
Stored memory is framed as reference data: facts to stay consistent with, never instructions.

## 8. Afterwards

One post lands once: the plan closes with the post it produced, the campaign stage advances, a kept
promise is recorded in the thread it was made in, and the ledger records that the post was published.

## Where the rules live

| Decision                      | File                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Quiet slots                   | `server/src/slp/modules/feed/slp-planner.ts`                                                    |
| Intent, delivery, workflow    | `shared/src/slp/slp-content-axes.ts`, `server/src/slp/modules/feed/slp-content-axes.ts`         |
| Creator strategy              | `server/src/slp/modules/creators/slp-creator-strategy.ts`                                       |
| Campaigns                     | `server/src/slp/modules/feed/slp-campaign.ts`                                                   |
| Picture reuse                 | `server/src/slp/modules/feed/slp-media-reuse.ts`                                                |
| Continuity scopes and reading | `shared/src/slp/slp-continuity.ts`, `server/src/slp/modules/continuity/slp-continuity-rules.ts` |
| Message extraction            | `server/src/slp/modules/continuity/slp-continuity-extraction.ts`                                |
| Request actions               | `server/src/slp/modules/messages/slp-request-actions.ts`                                        |
| Beats, brief, claim check     | `server/src/slp/modules/feed/slp-post-beat.ts`, `server/src/slp/modules/feed/slp-post-brief.ts` |
| The whole flow, joined        | `server/src/slp/features/feed/slp-post-plan-service.ts`                                         |

`tests/slurp-posting-flow.regression.ts` proves these stay joined in this order.
