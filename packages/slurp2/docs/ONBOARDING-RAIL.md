# First-run onboarding as a Support ticket (concept)

> Superseded in presentation by `OPENING-DAY.md` (2026-10-01): the script, the questions and the
> single write stay; the ticket, the member file and the stamp go.

Status: concept, 2026-10-01. Nothing built.

The very first time a player opens Slurp, Slurp Support opens a ticket for them: "New member".
It is one scripted chat on a rail. Support says hello, explains Slurp, shows a locked post with
Professor Mari, asks a few questions, stamps the file, and hands over to the feed or to the first
Creator sign-up. No AI calls: the player has not picked a connection yet, and joining costs nothing.

## Today

A first run passes four surfaces, each with its own look:

1. **Splash** (`SlpSplash.tsx`): Gunterlie's welcome, alpha note, AI cost note, a tick to approve.
2. **Age gate** (`SlpAgeGate.tsx`): "So, what is Slurp?" explainer, then the Pastapay card gag.
3. **Site welcome** (`SlpSiteWelcome.tsx`): Support asks five tap questions (who, pace, pictures,
   nights, names). "Show me around" opens the old five-screen tour instead (welcome, costs,
   identity, locked post with the Mari demo, posting).
4. **Lane choice**: role-play sign-up scene, quick setup or customize.

Problems:

- The explanation is split. The age gate says what Slurp is; the tour says the rest, and most
  players never open the tour. The Mari unlock demo, the best teaching moment, sits behind it.
- The questions miss what changes the experience most: spice, the AI connection, how the fans
  act, drama, and the Support desk game.
- Three looks before the first post. The sign-up scene already uses the Support chat chrome; the
  steps before it do not.

## The idea

One chat, one host, one look, from the age check to the first sign-up. The splash becomes G's thread in
the same shell (see "G's thread" below); it stays the real, out-of-universe consent and AI cost note.

```
Splash (unchanged)
  └─ Ticket #000001 · New member · Open
       1 Hello          greeting, ticket chip
       2 ID check       Pastapay card inside the chat, 18+ confirm or leave
       3 What is Slurp  three beats + a sample Creator card
       4 Locked posts   Mari's locked post inline, tap to reveal, coins vs subscribe
       5 Your Slurp     core questions (always)
       6 The fun part   extra questions (optional, "Skip, use defaults")
       7 Review         member file card, Change per row, "Stamp it"
       8 Hand-off       stamp, ticket Resolved, rating gag → feed or sign-up scene
```

Progress bar: the chapters, not the bubbles ("Hello · Slurp · Locked · Setup · Done").

## Chapter by chapter

Lines are drafts in Support's voice: friendly, a bit formal, dry jokes about paperwork.

### 1 Hello

> **Slurp Support:** Welcome to Slurp! I'm Slurp Support. Yes, all of us.
> **Slurp Support:** I've opened a ticket for you. Don't worry, it's the nice kind.

Header: Support avatar, "Ticket #000001", chip "Open". Chip: **Hi!** (the rail starts on tap, so a
player is never talked at).

### 2 ID check

The Pastapay gag moves into the chat as a card. Same component, same animation, same rules:
an explicit 18+ confirm or "Not now, take me back" (leaves Slurp). Nothing below runs before it.

> **Slurp Support:** Policy says I have to ask. Slurp is 18+.
> *(Pastapay card: "Charged $0.00. It's free, we can't afford servers.")*
> **Slurp Support:** Approved. Our finance team is very proud of that card.

### 3 What is Slurp

Three short beats, one tap each ("Go on" / "Got it"). Each beat may carry a small card.

1. **Your characters become Creators.** They post, public or locked, and keep their personality.
   Card: a sample Creator header (Mari, as in the tour).
2. **The fans are simulated.** They follow, like, comment, subscribe, tip and DM. The feed keeps
   moving while Marinara runs.
3. **You are the platform.** Watch, post as your persona, or pull strings as Support later
   (Stir, the Support desk). Only for players who will see Stir: one line, no detail.

The cost beat is the one honest line that stays plain:

> **Slurp Support:** One thing in plain words: every post, reply and picture is a call on *your*
> AI connection. A busy feed costs more. You can turn it down any time.

"Skip to the questions" sits in the header from here on.

### 4 Locked posts

> **Slurp Support:** Some posts are locked. Let me get our test Creator.
> *(Mari's locked post card, inline: `LockedSlurpPostCard` with `demo`.)*

The rail waits until the player taps the reveal (`onReveal`, as `introBlocked` does today). Mari's
line plays, then:

> **Slurp Support:** She does that. Anyway: unlock one post with Slurpcoins, or subscribe to see
> all of a Creator's locked posts. Your wallet fills up a little every day.

Chips: **Got it** · **What are coins?** (one extra bubble, then back on the rail).

### 5 Your Slurp (core, always asked)

Each answer prints the "Pace set · Change" pill that exists today. The "Your Slurp" preview stays
on wide screens; on a phone it is a header chip that opens it as a sheet.

| # | Question (draft)                                       | Options                                  | Writes                                       |
| - | ------------------------------------------------------ | ---------------------------------------- | -------------------------------------------- |
| 1 | Who are you here?                                      | Watch · Run Creators · Both              | lead only (as today)                         |
| 2 | Which AI should write for Slurp?                       | the user's text connections, default marked | `generationConnectionId`                  |
| 3 | How busy should the feed be?                           | Only when I ask · Occasional · Lively · Very active | activity preset (as today)        |
| 4 | Pictures with the posts?                               | Yes · Text is fine                       | `autoPostingImagesEnabled`                   |
| 4b| (only on Yes) Which image connection?                  | image connections, default marked        | image connection (as the wizard does today)  |
| 5 | How spicy?                                             | Flirty · Suggestive · Explicit           | spice `max` + matching guidance preset       |
| 6 | Stage names or their own names?                        | Stage names · Own names                  | `disclosure` (as today)                      |
| 7 | Quiet at night, like real people?                      | Yes · Around the clock                   | `nightQuiet` (as today)                      |

Question 2 with no connection: Support says so in one line, links to the Engine's connections,
and the rail goes on with "Only when I ask" chosen for question 3 so nothing runs.

**Fast lane.** Before question 1, one chip: **Use your recommended setup**. It fills every
default and jumps to Review. Easy setup is one tap.

### 6 The fun part (optional)

> **Slurp Support:** That's the form. Got a minute for the fun part? It's optional, I'm required
> to say that.

Chips: **Sure** · **Skip, use defaults**.

| Question (draft)                                       | Options                              | Writes                         |
| ------------------------------------------------------ | ------------------------------------ | ------------------------------ |
| How should the fans act?                               | Sweet · Mixed · Unfiltered           | `audienceTone`                 |
| How big is Slurp?                                      | Cosy · Normal · Huge                 | `platformScale`                |
| Drama between Creators?                                | None · Now and then · Bring it       | drama / story automation       |
| Ads? They keep our lights on.                          | None · A few · Lots (+ tone: Normal · Unhinged) | `inlineAdsEnabled`, `inlineAdsFrequency`, `inlineAdsTone` |
| (Run/Both only) Between us: want to pull strings?      | Play fair · Play the platform        | Support desk `shadyMoves`, `refusals` |

Five at most. Anything else stays in Settings.

### 7 Review

Support sends one "Member file" card: every answer as a row with Change. Primary button
**Stamp it**. This is the only write: one settings patch (plus the spice setting). Leaving before
the stamp changes nothing.

### 8 Hand-off

The approval stamp from the sign-up scene lands on the file. Ticket chip turns "Resolved".

> **Slurp Support:** Welcome aboard! How was your support experience?

Five stars, any rating gets a dry answer ("Five stars. I'm printing this."), no effect on anything.

- **Watch** → "Your feed is waiting." → the feed.
- **Run / Both** → "Who are we signing up first?" → the sign-up scene continues *in the same
  thread* (Support preset). Chip **Pick from a list instead** opens the quick lane.

## After the first run

- The ticket is kept. It is the first entry in Stir → Support desk ("Your file"), and Backstage gets
  **Run setup again**, which reopens the rail at chapter 5 with today's values filled in.
- `onboarding: "in_progress"` already exists. The rail position is kept in localStorage so a reload
  resumes on the same chapter (per browser, like the splash).
- An update never shows the rail again. New questions in later versions ask once, as a small
  follow-up ticket ("We added a thing").

## What goes, what stays

| Goes                                   | Stays / reused                                     |
| -------------------------------------- | -------------------------------------------------- |
| Age gate explainer ("So, what is Slurp?") | Splash, unchanged                               |
| The five-screen tour, "Show me around" | Pastapay card, moved into the chat                 |
| Lane choice screen                     | `LockedSlurpPostCard` demo with Mari               |
|                                        | `SlpSiteWelcome` chat, pills, preview: grows into the rail |
|                                        | Sign-up scene, approval stamp, wizard progress bar |

All settings it writes exist. No server change.

## Code shape

- `slp-site-welcome.ts` becomes the script: an ordered list of steps, pure, tested.
  Step kinds: `say` (bubbles), `card` (pastapay, sample Creator, locked demo, member file),
  `wait` (age confirm, reveal), `ask` (options + `when` + the setting it writes).
  `next(answers, events)` returns the next step; `slpSiteWelcomeSetting` grows to the new questions.
- `SlpSiteWelcome.tsx` renders it. Bubbles come in with a short typing dot pause (instant with
  reduced motion). Chips are the only input; Change pills edit any answer.
- The age gate modal and the tour code are deleted once the rail covers them.
- Locales: new keys under `ui.slurp.site.*` in en, de, ko, pl; no renamed keys.
- One regression for the script order, branching (`who`, pictures, no connection, fast lane) and
  the setting each answer writes.

## G's thread: welcome and changelog in the same chat

Added 2026-10-01. The splash becomes a chat too: a DM from G (Gunterlie), in the same chat shell as
the Support ticket. It stays out-of-universe and English only, as the splash is today: it is the
author talking, and it holds the real consent and the real AI cost note.

**First run.** G's welcome plays as bubbles (today's splash copy, split up):

> **G:** Hey, I'm G. The dude responsible for all the bugs.
> **G:** You're testing alpha software. Unfinished, occasionally feral. *(alpha note)*
> **G:** Every post, reply and picture is a call on your own AI connection. *(cost note)*
> *(Discord card: "Found a bug? Obviously. Tell me in Slurp General.")*

The consent tick becomes the reply: chip **I get it: alpha, my own risk** · **Leave Slurp**.
X and Escape still leave Slurp; nothing is stored before the chip. Then:

> **G:** Cool. Support will take it from here. Be nice to them, they're me in a tie.

The shell switches to the Support ticket (chapter 1). The cost beat in chapter 3 then shrinks to a
one-line reminder, because G already said it.

**Changelog.** The same thread is the changelog. Each release in `SLURP2_RELEASES` is one message
from G: a release card (version, date, the ≤3 notes), oldest at the top, newest at the bottom.

- After an update, the thread opens on its own (as "What's new" does today) with a "New" divider
  above the first unseen release. **Got it** closes it and marks the version seen.
- The composer is shown but disabled: "G can't read this. Find me in Slurp General." with the
  Discord link. So it reads as a chat, and nobody types into the void.
- Scrolling up is the history; "Hide earlier releases" goes.

**Version pill.** Settings shows a pill **Slurp 0.3.11** (Overview header). A tap opens G's thread
at the newest release. A dot on the pill while a release is unseen.

**Code.** No server change. One pure function builds G's messages from the welcome lines and
`SLURP2_RELEASES` (tested: order, "New" divider position, first run vs update). The seen version
stays in localStorage (`slurp2:splash-seen-version`). `SlurpWelcome` and `SlurpWhatsNew` are
replaced by the thread; `slurp2SplashPending` and `slurp2SplashKind` stay as the trigger. The
chat shell (header, bubbles, chips, disabled composer) is shared by G's thread and the Support
rail; the thread picks the host, avatar and whether the composer is live.

## Decisions (2026-10-01)

| Topic              | Decision                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| Age check          | Inside the chat (Pastapay card as a rail step); the age gate modal goes. |
| AI connection      | Asked in the rail (core question 2).                                     |
| Fun-part extras    | All five: fans, size, drama, ads (+ tone), pull strings (Run/Both only). |
| Ticket afterwards  | Kept as "Your file" in the Support desk; Backstage gets "Run setup again". |
| Splash             | Becomes G's thread: welcome + consent chip, then the changelog with a disabled composer. |
| Version pill       | "Slurp x.y.z" in Settings opens G's thread; dot while a release is unseen. |
