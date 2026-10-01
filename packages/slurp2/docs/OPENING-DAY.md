# Opening day: the first run as the owner's launch

Status: building, 2026-10-01. Replaces the presentation of `ONBOARDING-RAIL.md` (the Support
ticket, the member file, the stamp) and of G's thread. The rail's logic stays: the same pure
script (`slp-site-welcome.ts`), the same questions, the same single write at the end.

Prototype: `~/.cache/tmp/slurp-intro/index.html` on devbox (served on port 28417). It is the visual
reference for every slice below.

## Why

0.3.13 shipped the first run as a modal with chat bubbles: a Support ticket that fills a member
file. The player rejected it: not pretty, not satisfying, no flow. And the roles were wrong. The
questions (feed pace, spice, ads, drama) are an owner's decisions, but the story made the player a
new member filling in a form. A member does not set the platform's ad rate.

## Roles

| Who | Is | Says / does |
| --- | --- | --- |
| The player | the owner of this Slurp, a private platform that runs on their own AI | decides how the place runs |
| Slurp Support | the owner's staff ("Morning, boss"), shown as the Slurp bowl logo, no circle | guides, jokes about paperwork and noodles |
| The characters | move in as Creators | post, public or locked |
| The fans | the crowd that comes with the place | like, comment, tip, DM |
| G | the author, out of universe | the real consent and the real AI cost note, the changelog |

## The flow

Full screen (Engine Modal, full screen on phones, a large panel on wide screens). Two regions:
the **stage** (one object per chapter, big, animated) and the **talk** (Support's lines in the
display face, the player's replies as small pink pills, big answer cards in the thumb zone). Wide
screens: stage left, talk right. Phones: stage on top, talk below. Older lines fade; a new chapter
clears the talk.

| # | Chapter (header) | Stage | Beats |
| - | --- | --- | --- |
| 1 | Opening day | The Slurp bowl, bobbing, "Your Slurp · Opening day" | "Morning, boss! Welcome to your Slurp." / "I'm Slurp Support. Yes, all of us. We work for you now." → **Hi!** |
| 2 | The license | The Pastapay card swings in, the number types, "License fee: $0.00" | "One formality before we open: the platform license. Slurp is 18+." → **I'm 18 or older** / **Not now, take me back** (leaves Slurp) → "Licensed. Finance framed the receipt." |
| 3 | Your Slurp | The phone: the player's Slurp, empty ("No Creators yet") | "This is your Slurp. Empty, for now." → Go on → Mari moves in (her post slides into the feed) → Go on → hearts, comments, coins float up → **And me?** → "You run the place. Watch, post, or pull strings in Stir." + the cost line → Got it → "Some posts are locked. Try Mari's." The Unlock button in the phone's feed reveals her post (an early tap counts). → coins line → Got it |
| 4 | Set it up | The same phone; every answer changes it at once, with a callout ("8 posts a day") and a glow on what changed | the core questions, then "Want to tune the crowd?" → **Tune it** / **Use the defaults** → the fun questions |
| 5 | Open the doors | The phone's doors close ("Opening soon") | "All set, boss. Your Slurp is ready." → **Open the doors** = the one write. Doors slide open, confetti, a fan counter ("+412 fans just walked in"), then: watcher → "Doors are open. Enjoy the show." → **Go to my feed**; Run/Both → "Who's our first Creator?" → **Sign someone up** / **Pick from a list** |

"Skip to the questions" stays (chapter 3 → 4, never past the license). The fast lane stays on the
first question ("Use your recommended setup" → straight to chapter 5). Reload resumes (per
browser), as today. "Run setup again" opens at chapter 4 with today's values, and its doors scene
says "Save changes" instead of "Open the doors".

## What each answer does to the phone

| Answer | Phone shows |
| --- | --- |
| who | nothing in the phone; decides the hand-off |
| connection | footer "Written by <connection>" |
| pace | number of posts in the feed (manual 1 with "Posts when you ask", occasional 2, lively 3, very active 4) |
| pictures | posts with or without pictures |
| imageConnection | footer "Pictures by <connection>" |
| spice | the sample caption's tone, the locked blur strength |
| names | Creator display names (own name vs stage name) |
| nights | a moon icon in the top bar |
| fans | the comment under the first post (sweet / mixed / unfiltered) |
| size | the fan count chip and the like counts (312 / 12.4k / 1.2M) |
| drama | a gossip banner on top of the feed (none / a light one / a loud one) |
| ads | sponsored cards in the feed (0 / 1 / 2) |
| adTone | the sponsored copy (normal / unhinged) |
| pullStrings | a small Support desk badge on the Stir tab |

Captions, comments, ads and names are fixed sample copy in the locales, never generated.

## Code shape

Layers follow `docs/architecture/README.md`.

| Piece | Where | Owner slice |
| --- | --- | --- |
| Script model: chapters, steps, events (`opened` replaces `stamped`), copy keys | `features/onboarding/slp-site-welcome.ts` | S1 |
| Preview model: answers → phone items (pure, tested) | `modules/preview/slp-phone-preview.ts` | S2 |
| Phone component: props in, callout + glow on change, doors | `modules/preview/SlpPhonePreview.tsx` | S2 |
| Stage shell: header (bowl or G, chapter, progress bars, close), stage slot, talk (lines, steam typing, cards) | `modules/stage/SlpStage.tsx` | S3 |
| Answer cards: glyph, label, hint, primary/ghost, layouts one/two/three/list; press, chosen, gone | `modules/stage/SlpChoiceCards.tsx` | S3 |
| Opening day renderer | `features/onboarding/SlpSiteWelcome.tsx` (rewritten) | S3 |
| G's thread on the stage shell | `features/onboarding/SlpSplash.tsx` | S4 |
| "Your Slurp" in Settings › Overview (phone preview from today's settings + Run setup again); "Your file" leaves the Support desk | `features/onboarding/SlpYourSlurp.tsx`, Overview panel, Stir desk | S5 |
| de / ko / pl copy | `locales/*.json` | S6 |
| Version 0.3.14, changelog, release note, DECISIONS, tests, build | | S7 |

`SlpChatShell` stays for other threads; the stage shell does not replace it.

## Rules

- **Motion:** spring in, ease out. One orchestrated moment per chapter (the stage object's entrance)
  plus motion that answers a tap (card press, chosen card, phone change). No looping decoration
  except the bowl's slow bob and the steam while Support types. Reduced motion: everything lands
  at once, no flying, no confetti fall, no doors animation.
- **Accessibility:** cards are buttons in a labelled group, 44 px minimum, visible focus ring; the
  talk is a polite log; the stage is decorative (`aria-hidden`) except the Pastapay confirm and the
  Unlock button; the phone's changes are announced through the talk (Support says what changed).
- **Copy:** owner framing, in-universe, no disclaimers except the plain cost line. Sentence case.
  New keys only (`ui.slurp.opening.*`); never rename existing keys; en, de, ko, pl.
- **Classes:** Slurp builds its own scoped stylesheet, so package classes work; check screenshots.
- **No new server code.** The one write is unchanged (`slpRailStamp` → `useSlpRailWrite`).

## Slices and commits

Each slice ends with its checks and a commit of its own paths (`git commit -- <paths>`). One
version bump (0.3.14) in S7.

| Slice | Who | Depends on | Done when |
| --- | --- | --- | --- |
| S0 plan | orchestrator | | this doc committed |
| S1 script model + copy (en) | orchestrator | S0 | rail regression rewritten and green |
| S2 phone preview | designer subagent | S0 | regression for the preview model; component renders from props; screenshots from a harness |
| S3 stage shell + cards + renderer | orchestrator | S1, S2 | first run end to end on a dev box |
| S4 G's thread on the stage | designer subagent | S3 | consent + update + pill modes, regression green |
| S5 Your Slurp in Settings | worker subagent | S2, S3 | Overview card + Run setup again, desk entry removed |
| S6 translations | worker subagent | S1, S3 | locales validator green |
| S7 release | orchestrator + reviewer + verifier | all | reviewer findings fixed, 0.3.14 built, dev-box proof at 390/768/1440 |
