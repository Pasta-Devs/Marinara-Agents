# Trends and trendsetters (0.3.44)

0.3.43 damps _accidental_ sameness: one Creator's spice angle steps aside when the feed is already full
of the same thing (`listSlurpFeedSpice`). Trends add _deliberate_, bounded sameness, like a real feed:
something takes off, the right people notice and join, it peaks, it tires, it dies. Not everyone joins.

No extra AI call is needed for a trend to start or spread. Only the existing daily world tick may carry one
more optional field (a world trend), inside the call it already makes.

## Where it lives

The feature vocabulary stays as it is. Trends are Discovery: `modules/discovery/slp-trends.ts` (pure),
`data/discovery/slp-trends-storage.ts` (one app-settings document, `slurp2.trends`, like the ties document),
`features/discovery/` (service, routes, `slp-trends-contract.ts`). Client: `features/discovery/` (hook,
Discover row, chip) and `features/stir/` (the action card).

## The record

```ts
type SlurpTrend = {
  id: string;
  label: string; // "Mirror selfies", at most 60 characters, from the origin post's public title
  source: "creator" | "player" | "stir" | "world";
  starterId: string | null; // the Creator or the player's page; null for a world trend
  originPostId: string | null; // adopters quote this post (quotePostId)
  line: string | null; // world trends only: a `{a}` template like a shared idea
  lean: string | null;      // what the player says posts lean into (Stir "Start / Steer a trend")
  spicy: boolean;           // the origin was a spicy post: adopters do their OWN level, see below
  startedAt: string;
  adopters: { id: string; at: string; role: SlurpTrendRole; postId: string | null }[];
};
```

The stage is **computed from age and adopters, never stored**, so a restart or a late tick cannot leave it wrong
(`slurpTrendStage`):

| Stage  | Age from `startedAt` | Who joins                                            |
| ------ | -------------------- | ---------------------------------------------------- |
| rising | under 36 h           | trendsetters, early adopters; followers from hour 18 |
| peak   | 36 h to 72 h         | followers, contrarians                               |
| tired  | 72 h to 120 h        | late followers (small chance), contrarians roast it  |
| dead   | over 120 h           | nobody; the record is dropped after 7 days           |

When adopters reach the share below, joining stops (the stage still follows age). At most **3 live trends** at once; a new one waits
(or replaces a `dead` one). One Creator is in at most one trend per 3 days.

## Roles

Derived, deterministic, no storage: `hash(creatorId) % 100` picks a base role — trendsetter 8, early adopter 20,
follower 40, contrarian 12, ignores 20. The trend then adjusts it: the starter is always the starter; a Creator
whose tags/interests share nothing with the starter and who has no tie to any adopter keeps only a small
follower chance; a trendsetter with a big following (top tenth by followers) is the one who _starts_ trends.
A player-run page never adopts automatically.

## Spread (who is asked, in order)

The pick runs when a Creator plans an ordinary post, not on a clock (`planSlurpTrendBeat`, called in
`planSlurpBeat` after drama and ties, before occasions). Per planned post the chance is
`base(role, stage) × reach`, where reach is x3 for a tie (friend, collab, rival, couple) to the starter or any
adopter, x2 for a shared niche (`slurpSharedNiche`) with the starter, x1 otherwise. Base chances: early adopter
rising 0.55, follower peak 0.35, follower rising-late 0.15, tired follower 0.10, contrarian peak/tired 0.3.
Caps: adopters per day at most `ceil(0.15 × automatic Creators)` (min 1); total at most 40% of them (unique Creators across all live trends together)
(peak target ~20–40%). The roll is `hash(creatorId, trendId, sequence)`, so a retried slot repeats its choice.

An adopter's beat reads: `A trend is going around Slurp: "<label>", started by <starter>. Do your own take on it`
(follower), `… you were one of the first to try it` (early adopter), `… you roast it` (contrarian, with a tone
note, never mean about a person). The post stores `metadata.slurpTrend = { id, label, originPostId }` and sets `quotePostId` to
the origin post (the stored link; the post card shows it as the trend chip, which opens the origin). A world trend uses its `{a}` line instead.

**Spice.** A trend never lowers spice as such and never raises it. If the origin was spicy, an adopter does
the trend at their own level through the usual spice angle (their level, their hard noes, the ceiling). A
Creator at level none does a tame take of it. A Creator whose steering avoids the label, or whose card
rules it out (the `SLURP_NEVER_PATTERN` sentences), skips. The 0.3.43 feed damping is skipped for a trend
adoption only (the angle sees an empty feed), because sameness is the point; every other post keeps it.

## How a trend starts

1. **A Creator post takes off.** Advanced on the world tick (`advanceSlurpTrends`): a public post from the last
   2 days with a score of at least `max(30, 3 × the median score of that Creator's last posts)` and at least
   4 posts of history. Score = shown likes ×1 (real likes plus the silent crowd, as `slurpPostLikeCount` shows them, so a viral week counts) + replies ×1.5 + **player likes ×4, unlocks ×6, tips ×8** (a tip is not
   tied to a post: it counts for the post that was newest when it came in). Code only,
   no AI: the label is the title's first 6 words. Fewer than one start per tick.
2. **The player's own page.** The same detector reads a player-run page's posts; the starter is that page.
3. **Stir "Start a trend"** (new action `start-trend`: `{ label, accountId?, lean? }`). With a Creator it makes them the starter; without,
   a platform trend. The form offers ten ready-made trends (one tap fills the name), a "lean into" field and an
   optional starter. A second action, `steer-trend` `{ trendId, lean }`, changes what a running trend leans into
   (empty clears it; Undo restores the old words). Joining Creators get "Lean into: <lean>." in their line; posts
   already written keep their words. Reversible (Undo removes the record while it has
   no adopters). The older desk lever `seed-trend` (a nudge to a few Creators) stays as it is.
4. **World trends.** The daily world tick prompt may return one `trend: { label, line }` (the idea list already
   says "or a light platform trend"). It starts a `world` trend if fewer than 3 are live; the line is checked
   like a shared idea (exactly one `{a}`).

The starter gains followers: each adopter adds a small real follow (one follow row per adopter, capped at 20
per trend) through the same funnel that counts followers. The invented `trend` life
moment is removed: a real trend is joined through the trend beat, so Slurp never talks about a trend that is not there.

## UI

- **Discover**: a "Trending on Slurp" row above Featured, one small card per live trend: label, stage pill
  (Rising / Peak / Cooling), the starter's name, "n joined". Tap sets the search to the label;
  the post search also matches `metadata.slurpTrend.label`. Hidden when no trend is live. Phone first.
- **Post card**: a chip "Trend · <label>" under the author line for adopter posts (it opens the origin post when that is on screen).
- **Stir**: a "Start a trend" card (label field, optional Creator), preview says who may join, no cost.
- Locales en / de / ko / pl, new keys only.

## Out of scope

Trend history page, per-trend settings, locked origin posts (the label would reveal a paid subject; only
public posts start trends), a "stole my trend" drama pack hook, trend-driven pictures, an AI-written trend line
for Creator trends.

## Numbers in one place

`modules/discovery/slp-trends.ts` exports them as constants: stage hours 36/72/120, live trends 3,
adopter share 0.4, daily cap 0.15, role mix 8/20/40/12/20, reach 3/2/1, score weights 1/1.5/4/6/8, threshold
`max(30, 3×median)`.
