# Spicy: more adult, more OnlyFans, more fun (concept, 2026-10-22)

Status: approved 2026-10-22, order extended 2026-10-23. Built: item 8 (kink packs, 0.3.61), item 1 (intimacy ladder, 0.3.62), item 2 (sexting sessions, 0.3.63).

Slurp is an OnlyFans simulator. The player is a fan of AI Creators (DMs, tips, PPV, customs) and can run a
page with fans of their own. This update makes both sides spicier and gives the player more reasons to come
back. Everything stays in-universe: no disclaimers, no new guards; the existing spice levels, turn-ons and
hard-nos decide how far anybody goes.

The user picked eight features (2026-10-22). Each section says what the player sees, what it builds on in the
code today, and the smallest version that is still fun. "Later" lists what the first version leaves out.

## 1. Intimacy ladder (rapport opens doors)

**Decided (2026-10-22): no new score.** Slurp already has the chat stats: rapport, one 0–100 score per Creator
and viewer (`modules/messages/slp-rapport.ts`) from subscription, loyalty, tips, unlocks, commissions,
conversation, effort and reciprocity, with tiers stranger → acquaintance → regular → favourite → whale
(`slurpRapportTier`, `:69`). The DM header already shows it under Details ("Where you stand", "Spent with
them", "Rapport", "Conversation mood", strikes; `features/messages/SlpThreadHeader.tsx`). Partner and crush have
their own floor (`SLURP_PARTNER_RAPPORT` 60, `SLURP_CRUSH_RAPPORT` 25).

**What changes.** Today the tiers are "presentation only ... nothing is gated on them" (`slp-rapport.ts:66`).
The ladder makes each tier open something, within her spice level and never past a hard-no:

| Tier                    | Opens                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| stranger / acquaintance | flirting, teasing; paid pictures as today                                  |
| regular                 | spicier DM talk; sexting sessions offered                                  |
| favourite               | now and then a free spicy picture "just for you"; lower custom prices      |
| whale                   | her most explicit level in DMs and customs; she starts sessions on her own |

Opened doors stay open: the highest tier reached is kept per pair, so a quiet week never takes a feature
away (the reason the tiers were ungated). She says when you step up ("ok you're officially my favourite 🙈"),
one line in the thread. The step reaches the DM prompt (`slurpDmSpiceLevel`,
`features/messages/slp-message-operation.ts:441-458`) and the picture offer (`resolveSlurpMediaOffer`, which
already reads `rapportTier`).

**First version.** Highest-tier memory, the table above in DM spice and offers, the step-up line, the opened
doors listed in Details.
**Later.** Per-Creator choices of what each tier opens.

**PR 2 as built (0.3.62).** `slurpRapportDoors(tier)` in `modules/messages/slp-rapport.ts`; `peak` (highest tier
reached) and `said` (highest tier she announced) ride in the thread's stored rapport JSON. `rapportFor` keeps the
peak through every fresh score (`slurpRapportKeepPeak`; a pair from before the ladder starts at its stored tier),
and a generated DM reply stores `said` (`markRapportSaid`, from the rapport its prompt read). Doors, all inside her spice level:

| Door           | From      | Where                                                                                     |
| -------------- | --------- | ----------------------------------------------------------------------------------------- |
| spicierTalk    | regular   | DM flavour at her full level without a subscription (`slp-message-generation-service.ts`) |
| gifts          | favourite | 1 in 4 spicy friendly chat pictures is free (`resolveSlurpMediaOffer` `gift`)             |
| customDiscount | favourite | customs 15% cheaper: quotes, prompt range, counter floor (`commissionPricingFor`)         |
| fullSpice      | whale     | free chat pictures at her full level (`slp-message-operation.ts`)                         |

The step-up line is a prompt instruction ("Sam just became one of your favourite fans: tell them once"), not a
canned message, and only the DM reply prompt carries it (`describeSlurpRapportForDm`). Partners get the doors of their tier but no step-up line: a relationship names
itself. Sessions ("whale: she starts
sessions") come with item 2. Not built: per-Creator choices of what each tier opens.

## 2. Paid sexting sessions

**What the player sees.** In a Creator's DM: "Sext with me – 20 min for 30 coins". During the session a timer
runs in the thread header, she replies faster and hotter, the heat rises in three phases (warm-up, heated,
finish), and she offers a PPV picture inside the session ("want to see what I'm doing right now? 12 🪙").
At the end: a short afterglow line and a tip prompt.

**How it works.** A session is a thread state with a start, an end and a phase, next to `SlpThreadState`
(`modules/messages/slp-messaging.ts:112`). Paying uses a new wallet spend kind `session`. While a session runs,
reply pacing (`slp-messaging.ts:202`, `:286`) uses short delays, and the DM prompt gets the phase and a spice
floor (capped by the ladder and the Creator's spice). The in-session PPV reuses the DM PPV offer path.
The price comes from her pricing (`modules/economy/slp-creator-pricing.ts`) and her ladder step.

**First version.** Buy, timer, three phases, faster replies, one in-session PPV offer, end tip prompt.
**Later.** Session extensions, voice notes, Creators who offer a session on their own.

**PR 3 as built (0.3.63).** Decided 2026-10-22: anyone can buy; 20 minutes for three of her PPV pictures (the
ladder's favourite discount applies); paid through the tip path (ledger "Sexting session"), no new wallet kind;
one PPV picture at her full level. `modules/messages/slp-sexting.ts` holds the price, phases (first 30% warm-up,
last 20% finish) and the prompt direction. `POST /messages/sexting` claims the session on the thread (`sexting`
JSON column, `startSexting`) before it pays, so a second buy while one runs gets 409 and a failed payment drops
the claim (`cancelSexting`). Not sold in Support's thread, on her own page, or with a hand-run Creator. While it
runs, `slurpReplyPacing` answers at once, the DM prompt reads her full level (`subscribed`) and gets the phase in
its creative direction; in the heated phase her first picture is a locked PPV at her PPV price, even for a
subscriber (`markSextingPicture`; a partner's stays free). The header bar (`SlpSextingBar`) shows the buy button,
the minutes left, and for 30 minutes after the end a tip prompt that opens the tip tool. The session's price is
in the thread response (`sextingPrice`).

## 3. Spicier fan types and a top-fans board

**What the player sees.** On the player's own page: new fans who feel real – the simp who tips every post and
asks for nothing, the time-waster who haggles, asks for "just one free pic" and vanishes, the chargeback that
takes money back two days later, the demanding whale who pays well but wants things. A ranked Top fans board
(this week / all time) with badges ("💎 whale", "🐌 time-waster").

**How it works.** Four new built-in fan types in `SLURP_BUILTIN_FAN_TYPES` (`shared/src/slp/slp-fan-types.ts:113`)
using the existing schema (behaviour weights, spend, `tipChance`, `commissionBudget`). Two need small new
behaviour fields: haggle-and-leave (reuses `slurpFanHaggle`, `slp-creator-pricing.ts:83`) and chargeback
(reuses income reversal `slp-wallet.ts:413` / `slp-earnings.ts:295`, with a notification). The board ranks
`topFans` (`features/economy/slp-studio-routes.ts:130`) by spend in the window.

**First version.** Four types, chargeback + haggle-vanish behaviours, the board on the dashboard.
**Later.** Blocking and fan notes per type, fan-type rebalance hints.

## 4. Fan request board

**What the player sees.** A board of open requests on the player's page: "custom: you in the red set, 40 🪙",
"say my name in a video, 15 🪙". Take it, counter or decline; done requests become a locked post or a PPV.
On Creator pages the player can post a request of their own to the board.

**How it works.** Commissions are thread messages today (create, quote, counter, accept, deliver:
`features/messages/commissions/slp-commissions-routes.ts`, delivery `slp-commission-delivery-service.ts`). The
board is a view over open commissions, plus fans opening them on their own (fan type `commissionBudget`) and an
expiry (`slp-messaging.ts:39`, 5 days). No new entity in the first version.

**First version.** Board screen, fans post on their own, take/counter/decline from the board.
**Later.** Requests from fans to Creators shown publicly, upvotes.

## 5. Live shows

**What the player sees.** A Creator (or the player) goes live: a live badge on her avatar, a notification
("Mia is live 🔴"). The show is a text stream: she narrates, the crowd chats, tips pop up with reactions, a tip
goal bar fills, and when the goal is hit the show gets spicier for the finish (within her spice). Shows last
20–40 minutes; replays are not kept, only a recap post.

**How it works.** A live show is a scheduled session in the world tick (`features/world/slp-world-operation.ts`,
scheduler `slp-world-scheduler-service.ts`). Crowd lines come from the fan voice drafts
(`modules/audience/slp-fan-voice-draft.ts:30`) and fan types; tips use the `tip` spend and payment reactions;
the goal is new state on the show. The player sees a live screen that polls the show. Natural home:
`features/live` (server and client).

**First version (decided: the player too).** Creators go live at random (more when trending); the player
watches, chats and tips. The player can also go live on their own page: they write the narration, their fans
chat and tip, the goal fills, and the recap post lands on their page.
**Later.** Private shows; collab lives.

## 6. Streaks and rewards

**What the player sees.** A daily streak ("🔥 6 days"), and rewards for coming back and for milestones: free
coins, a new look for a Creator, a spicier post type, badges on the profile.

**How it works.** A day key exists (`slurpDayKey`, `modules/economy/slp-wallet.ts:143`; stipend `:350`) and
presence is tracked (`markSlpPlayerPresent`, `features/world/slp-world-tick-state.ts:50`). Milestones exist
(`modules/world/slp-milestones.ts:52`). The streak is one counter per day key; rewards are a small table.
Natural home: `features/rewards`.

**First version.** Streak, coin rewards on streak days, milestone badges.
**Later.** Look and post-type unlocks, Engine achievements.

## 7. Creator charts

**What the player sees.** Weekly charts: top earners, rising Creators, most tipped. Rivals climb past you; a drop
makes drama ("she fell out of the top 10 and she's NOT ok").

**How it works.** Earnings per Creator exist (`modules/economy/slp-earnings.ts:61`, `:162`), trends score
activity (`modules/discovery/slp-trends.ts:159`). A chart is a weekly snapshot over both. Rivalries
(`modules/projects/slp-creator-ties.ts:124`) and the rival post beat (`modules/feed/slp-post-beat.ts:116`)
give the drama hook. Natural home: `features/discovery`.

**First version.** Three charts, weekly snapshot, a Discover card, one drama beat on a big drop or climb.
**Later.** All-time charts, chart badges on profiles.

## 8. Kink theme packs

**What the player sees.** Packs in Storylines > Packs, off by default like Family: Lingerie week, Cosplay,
Feet, Dom/sub, Exhibition (all five decided for the first version). Each brings storylines, occasions and looks that only reach
Creators whose turn-ons fit and who have no hard-no against it.

**How it works.** Pure pack data, built like the Family pack (`modules/world/events/slp-family-pack.ts`,
library `slp-content-pack-library.ts:123`): storylines (stages, looks via `add-look`, influences), occasions,
fit topic words (gated by hard-nos, `modules/feed/slp-occasion-beats.ts:106-111`) and `minSpice`. Turn-ons lean
who gets them (`slurpTasteWeight`, PR 5c). Topic switches per pack already exist (`<pack>:<topic>`).

**First version.** Five packs, each 2–3 storylines + a few occasions + looks.
**Later.** More packs, user-shared packs.

**PR 1 as built (0.3.61).** `modules/world/events/slp-kink-packs.ts`, five packs after Family in
`SLURP_CONTENT_PACK_LIBRARY`, two storylines each, all `start: auto` with no storyline track (they never block
a body or love storyline); stage conditions sit on the `work` track (Exhibition: `public`), so their line and
look reach the writer:

| Pack       | Storylines                                                                                                 | Gate                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Lingerie   | Lingerie week (fans vote black/red/white, finale spice 2); the lingerie brand (brand offer, earnings ×1.1) | suggestive; hard-no lingerie/underwear          |
| Cosplay    | Fans pick the cosplay (elf/hero/maid, lewd version spice 2); con weekend (growth ×1.2)                     | suggestive; hard-no cosplay/costume             |
| Feet       | The foot fans (earnings ×1.15, adds a "foot content" fact); heels or socks                                 | suggestive; hard-no feet/toes                   |
| Dom/sub    | Her domme era (tribute earnings ×1.2, spice 2); her soft side (fans pick strict/gentle rules)              | suggestive; hard-no bdsm/dom/submissive/bondage |
| Exhibition | Almost caught (growth ×1.3, spice 3); fan dares (balcony/changing room/beach)                              | nudity; hard-no public/outdoor/exhibition*      |

Endings add a locked look (the set, the costume, the leather) or a Creator fact. Occasions were left out: the
storylines already post, and pack occasions can come with "More packs".

## Order (decided 2026-10-22, extended 2026-10-23)

1. **Kink theme packs** – pure data on the storyline engine, fast fun, no new systems. Built (0.3.61).
2. **Intimacy ladder** (rapport opens doors) – the base the next ones read. Built (0.3.62).
3. **Paid sexting sessions** – uses the ladder. Built (0.3.63, with Stir as a sheet).
4. **Bug sweep** (new, before more features) – check the open high-priority reports against the current
   build, fix the real ones, one bump: slow phones over HTTP, parallel generations overloading a local
   backend, thinking models failing (LLM 400, empty image prompt when reasoning eats the output), Creators
   replying to strangers' posts like friends, a mention copying the other Creator's look, the DM prompt
   missing the persona's Creator bio, promised pictures that never come, valid storyline JSON from local
   models rejected, wardrobe import and tag bugs. Also settle the doubled price defaults (unlock 3 or 1,
   subscription 12 or 5, the 20% platform fee next to a 100% creator share).
5. **Spicier fan types + top fans** – plus: fan comments look like a crowd, not like Creator comments; a
   **wish list** on each Creator page (fans and the player buy her a gift, she posts with it); money drama
   posts (a chargeback, a top tipper who ghosts).
6. **Fan request board** – plus: fans pitch to the player in DMs ("I'd pay 30 for a pic of X": accept,
   counter, ignore); a **vault** so a broadcast can carry a PPV ("12 of 40 unlocked"), and broadcasts cost a
   little; scheduled posts for the player's own Creator; a short line of your own on a sexting tip.
7. **Live shows** (Creators and the player) – the biggest new system. Plus: the player can tip into the
   crowd's flow ("match the top tipper").
8. **Streaks, rewards and sales** – plus: flash sales and bundles ("3 months for 2", 50% off for 24 h, on the
   unused `SlpDiscountOffer` type); a free page reads "free to follow, pay for PPV"; a first good tip can
   open one free teaser picture for a stranger.
9. **Creator charts** – plus: coins by week on the dashboard (the ledger exists, the card shows likes only);
   the home "Top creators" rail becomes this week's chart with up/down arrows; weekly **competitions** with
   a winner and drama.

**Later.** Collab PPV (two tied Creators, one locked post, split price); merch on pictures; paid shout-outs
between Creators; video posts.
