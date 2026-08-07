# Tester feedback — dsbwizzard thread, 2026-08-07

Source: `phone_agent` Discord thread, 182 messages, dsbwizzard + gunterlie. This is the first outside
read of the phone. It **changes decisions in six existing plans** and adds two new apps. Screenshots
and attachments reviewed alongside the text — several are load-bearing and are quoted where they are.

> "Agent born from a Sidequest. Taking good and ~~dumb~~ feature requests." — gunterlie, the agent's
> own posting blurb, which is roughly the correct posture for reading the rest of this file.

## How much weight this thread carries

dsbwizzard flagged his own bias four separate times, unprompted, and it should be read as part of the
feedback rather than modesty:

> "Keep in mind I am also just one guy, I can't wait to hear what the others think."
>
> "I am one dude who is exploring edge cases and building an experience that is not 1:1 with the design
> intent of ME. So my perspective will be skewed in this direction."
>
> "If you listened to every single idea I had, you would be reverse engineering a real cell phone."

**n=1, and it's a specific 1**: a power user building a single unified narrative world across every ME
surface, with lorebooks, LTM, and World Maps already wired together. That profile is exactly why the
lorebook-grounding ask is so sharp and so well-argued — and exactly why it may over-index. Most users
have not set up an image connection at all, a point he made himself.

**Treat the reversals as solid** (Forum, lore scope, battery, images) — those are cheap, gunterlie
argued them independently, and three of the four *remove* work. **Treat the additive asks as
unvalidated** until other testers weigh in. He asked for this explicitly: *"please choose which ones are
actually the good ones."*

Dispositions from that thread that live elsewhere:

| Topic | Where it landed |
|---|---|
| Lorebooks the phone can read without chat context | [`19-background-and-learning.md`](19-background-and-learning.md) — lore scope **un-deferred** |
| Forum is redundant | [`06-forum.md`](06-forum.md) — **scrapped** |
| Image toggles + no-image-connection fallback | [`00-platform.md`](00-platform.md) §6 |
| Goodle Images tab, per-site image button | [`13-goodle.md`](13-goodle.md) |
| Camera shots into the chat gallery | [`01-camera.md`](01-camera.md), [`02-gallery.md`](02-gallery.md) |
| Sharing into the *real* Noodle | [`03-sharing-seam.md`](03-sharing-seam.md) |
| Battery is story-driven, not drifted | [`18-device-shell.md`](18-device-shell.md) §3 |
| Music/agent control on the lock screen | [`15-rp-integration.md`](15-rp-integration.md) §5 |

The rest is below — items with no existing home.

---

## 1. Phones are shaped by their owner — `decided`

The headline idea from the thread, and the cheapest one to make land.

> "I have a character who is canonically dogshit at using technology. If I steal her phone and want to
> pull up a page, it would be so funny if the LLM made her Goodle be full of scams and ads and maybe
> even set to a weird language." — dsbwizzard

> "This should be pre-generated then, since the phone gets generated when activated. Maybe just let the
> LLM guess from the char card and info from lorebook." — gunterlie

**Decided:** the phone reads an *owner profile* and it colours everything the device generates — Goodle
result quality, ad/scam density, UI language, which apps are installed, screen condition (cracked/blood
overlays already exist), and how locked-down the device is.

### The screenshots change how this gets built — `read this before designing it`

dsbwizzard didn't just describe the tech-illiterate phone, he **authored it as a lorebook entry** and
screenshotted it. Title *"John's Cell Phone"*, description *"Regarding John's cell phone
configuration."*, ~58 tokens, content:

> "John Personman is absolutely awful at using technology. Their phone should reflect this, and be
> confusing to use correctly, have errors, etc. Goodle/Web links should have scams, weird language
> settings, and more confusing behaviour."

Scoped with the entry's own **Characters filter set to John Personman**. In a second screenshot he adds
primary key `Phone`.

That artifact is the feature. **Owner-shaped phones need no bespoke owner-profile system at all** — if
the phone reads its attached lorebooks *and honours each entry's existing Characters filter*, a user
authors owner behaviour directly, per character, with tooling that already exists and that they already
know. The government-issue restricted phone is the same entry with different prose.

This inverts the build order I'd assumed:

1. **Read lorebooks, honour the Characters filter.** Comes free with the lore-scope work in
   [`19-background-and-learning.md`](19-background-and-learning.md). Owner-shaped phones fall out of it.
2. **Infer from the character card at activation** — the fallback for the majority who won't write a
   lorebook entry. gunterlie's original instinct ("let the LLM guess from the char card and info from
   lorebook"), now demoted to the default rather than the mechanism.

Generating and persisting a separate owner-profile blob is a third system that neither of those needs.

Worked examples from the thread, both accepted as targets:
- **Tech-illiterate owner** — scam-heavy Goodle, mis-set language, cracked screen, awkward to use.
- **Police / government owner** — heavily restricted; most apps refuse to open.

Generated once at activation, not per request. It is the difference between fourteen apps and
fourteen apps *belonging to someone*.

## 2. Phones persist per persona **and** per character — `decided`

> "I wanted to have the phone bound to a persona and persist." — gunterlie
> "Can we bind it to characters too, in the way we do personas?" — dsbwizzard
> "Well, it's just IDs so I think yes." — gunterlie

Configuring a character's phone (owner profile, lorebooks, custom instructions, installed apps) is real
work; redoing it in every new roleplay is the same repeated-work problem LTM and World Maps already
solved. Phone config binds to **persona ID or character ID** and survives across chats.

**Prior art, and the screenshots make it concrete.** dsbwizzard's suggestion is to copy LTM's backbone
rather than invent one. From his captures of Long-Term Memory (Pasta Devs, v1.1.6), the parts worth
stealing wholesale:

- **Scope is a triple, not a single ID** — every view filters by **Character × Chat × Branch**, each
  defaulting to "All". That's the shape phone persistence needs: a phone bound to a character, usable
  across chats, and *branch-aware* — which is a better answer to the timeskip problem below than
  anything in this thread.
- **Sources are pluggable**, with tabs for **Chat Summaries, Characters, and Lorebooks**. LTM already
  ingests lorebooks as a memory source; the phone reading lorebooks is the same move against the same
  data.
- **Propose → review → accept.** Nothing is written silently: a Review Queue holds extracted memories
  and the user accepts the ones they want, with *"Importing saves source material first"* stated in the
  UI. See §5 — this is exactly the pattern the banking app needs, and it already exists.
- **Entries carry a status and can be archived or deleted**, grouped by kind (`Source`,
  `Timeline Events`, `Characters`). A phone's per-character state wants the same escape hatches.

Known limitation, accepted: a roleplay that **timeskips backwards** gets a phone from the character's
future. Forwards-only was declared fine — but LTM's **Branch** dimension may be the real answer, since a
backwards timeskip usually *is* a branch. Worth checking before accepting the limitation.

## 3. Accessing another character's phone is an RP event — `decided`

Today the device switcher is a dev shortcut ("Evil Stepsister" in the screenshots). The intended
behaviour:

- Another character's phone **unlocks only if the model judges you could plausibly get at it right now**
  — you took it, they handed it over, they left it on the table.
- Being caught is a story event: viewing someone's phone **prompts a reaction** from anyone who sees
  you, and the reaction accounts for *what you were looking at*.

> "I try to make it a roleplay element, not an omni-present thing." — gunterlie

Replaces the dev switcher as the real access path; keep the switcher behind a dev flag.

## 4. Does a character see their own phone gallery? — `open`

Raised and not resolved. gunterlie: "I can't think of a way right now to shove all that context into a
single chat message." Overlaps [`15-rp-integration.md`](15-rp-integration.md) §1, which already decided
characters get *ambient awareness of their own phone*, but scoped that to texts and feed — not the
gallery, which is the expensive one.

Partial answer already in the thread: photos taken during a scene are in short-term memory, so the main
LLM remembers them without the phone doing anything. The gap is only photos from **older** sessions.

## 5. Banking — new app, `decided in principle`

> "Cross-chat persistence banking app that I can use to accumulate mountains of wealth, with built-in AI
> protection checks to prevent me from saying 'I magically find 10 trillion dollars'." — dsbwizzard
> "This is actually something I want… I could just reference the tracker agent and save history. I think
> a banking app would be kinda easy to do — we store the data per persona, so just store a few numbers."
> — gunterlie

- Balance stored **per persona**, persisting across chats (same mechanism as §2).
- The model can move the balance as story events warrant.
- **User overrides the model**: approve/reject a proposed balance change, or edit the balance directly.
  This is the guardrail — not an AI plausibility check, just the user having the final say.
- Reference the existing tracker agent rather than building fresh accounting; keep a transaction history.

**Don't design the approve/reject flow — copy LTM's Review Queue.** A proposed balance change is a
pending item the user accepts or discards, which is structurally identical to a proposed memory. Same
pattern, already built, already familiar to anyone using LTM (§2).

Natural tie-in: NoodleR already has a hidden per-post unlock cost, which becomes a real money sink and
gives earning money an in-roleplay point.

**Scheduled: [`IMPLEMENTATION.md`](IMPLEMENTATION.md) Step 7.6**, directly after the cross-chat
persistence work it depends on — a balance surviving across chats is a few more numbers in the store
that phone config already survives in. Cheap *there*, expensive anywhere else.

## 6. Marketplace / classifieds — new app, `idea`

> "eBay or FB Marketplace type deal would be funny. See what weird crap my characters are tryna sell."

Lower priority than banking, but it's cheap: Goodle already has a `shop` page kind, so this is largely a
front-end over generation the phone can already do. Wants images more than most apps do (see
[`00-platform.md`](00-platform.md) §6 image policy).

**Scheduled: [`IMPLEMENTATION.md`](IMPLEMENTATION.md) Step 9.11**, sequenced after the image work since
a marketplace of pure text is a classifieds column. Carries the strongest caveat of anything scheduled —
it's the one idea here the maintainer never confirmed wanting, and cheap is not the same as warranted.

## 7. Availability outside a chat — `no change`

dsbwizzard wanted to open the phone while browsing Noodle, not only from inside a chat. Both agreed
chat-scoped is defensible — "the chats *are* the world" — and gunterlie left it at "both could work".
**No change to the current chat-scoped model.** Recorded because it will come up again.

## 8. Contacts don't model who knows whom — `open`

> "There is no system for 'does this character have this character's details'." — gunterlie

Mail is world-scoped with linked characters, but nothing tracks whether a given character actually has
another's address or number. Affects Mail, Messages, and Calls once characters initiate contact. Not a
blocker for anything currently planned; flagged as the next structural gap after the plan lands.

## 9. The scope problem underneath all of it — `open, and the most important item here`

The thread kept circling one unresolved architectural question, raised by gunterlie mid-discussion and
never answered:

> "I think we need a transparent way to link things together… like different chats, RPs, stories,
> worlds."

Everything awkward in this file is a symptom of it. The phone is **world-scoped**; Noodle and NoodleR
are **installation-scoped**; agents are **chat-scoped**; lorebooks are **installation-scoped with
per-entry targeting**; LTM and World Maps are **character-scoped and durable**. Five different scoping
models, and the phone touches all five. That's why sharing to the real Noodle is undecided (§
[`03-sharing-seam.md`](03-sharing-seam.md)), why lorebook grounding needed a whole design, why phone
persistence had to be invented per-binding, and why a cross-chat banking balance is a question at all.

There is no "world" object in ME to hang any of this on. Every decision in these twenty files works
around its absence individually.

**Not something the phone should solve** — it's an Engine-level concept and it needs Mari. But it is
worth naming as the thing that would retire a whole class of these problems at once, and worth raising
before the phone accretes five more per-app workarounds that a real world object would have made
unnecessary.

## 10. The agent is getting too big — `constraint, not an item`

Both participants noticed the same thing at opposite ends of the thread and neither acted on it:

> "The fucking agent is gonna be 271MB big by the time all this is worked in." — gunterlie
>
> "You and I gotta have someone put a stop to us. I feel like we're kinda on the same wavelength here
> and we need an adult." — dsbwizzard
>
> "Ideas and implementation are different things, for a lot of what this chat spews." — gunterlie

Recorded as a standing constraint on this plan rather than a task. Two concrete pressures it puts on
what's already decided:

- **Bundle size is a real ceiling** — the phone ships as a downloadable agent package, and every app,
  template and asset is weight a user downloads. Fourteen apps of generated-content front-ends is
  already a lot; Banking and Marketplace would be sixteen. Cutting Forum helps.
- **The plan is currently all-additive.** Across twenty files, the only *subtractions* are Forum, the
  ~160 lines of dead platform scaffolding in [`00-platform.md`](00-platform.md) §2, and the hash-faked
  Noodle counters. Worth a deliberate cut pass before implementation rather than after.

## 11. Corrections to earlier findings — `verify before building`

Things the thread says already work that the plan files record as gaps. Check the code before building
any of them.

Confirmed present in the Settings screenshot, none of it mentioned in the plan files:

- **Two separate model connections already exist** — `Replies` (character texts in Messages) and
  `Feeds & sites` (Goodle, Noodle, NoodleR, Mail, Tindler), each independently selectable, with
  `Agent default` as an option. Per-app generation control is further along than assumed.
- **`Custom instructions` already exists** — free text "added to everything this phone generates". Part
  of the lorebook-grounding ask is already served by it.
- **Screen overlay + intensity + "Reduce device effects"** are shipped, including the accessibility
  toggle. The cracked/blood overlays are real, configurable, and the hook the story-driven status bar
  in [`18-device-shell.md`](18-device-shell.md) should reuse.
- **The bottom action bar is `Put down` / `Show` / `Reference`** — so "Reference", which dsbwizzard
  asked about, is a built button, and `Show` is the explicit share-to-story path
  [`15-rp-integration.md`](15-rp-integration.md) §1 treats as the only one.

And from the thread text:

- **Camera aim/subject input.** [`01-camera.md`](01-camera.md) lists "no aim/subject input — you can't
  point it" as a finding. Asked directly whether he could control what he takes a picture of, gunterlie
  answered *"yes, yes and yes, already done"* — then corrected only the third part (shots don't reach
  the chat gallery). So subject control may already exist and the finding may be stale.
- **Goodle site caching is per chat.** Recorded in [`13-goodle.md`](13-goodle.md) as confirmed
  behaviour, not a guess — bookmarks are the fix for it.

## 12. Who to ask

- **Promansis** — named by dsbwizzard as able to explain how LTM binds and retrieves per-character
  state, which is the prior art for phone persistence (§2). Faster than reading it cold.
- **Kolache** — was testing ME Android battery usage during the thread; relevant if the phone's
  per-turn generation lands on mobile.
- **Mari** — needed for the package API contract extension
  ([`16-engine-interop.md`](16-engine-interop.md) task zero) and for the world-linking question in §9.
  Not needed for lorebook grounding any more, which is now agent-side by design.
