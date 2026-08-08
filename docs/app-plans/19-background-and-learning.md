# Background activity & learning from the RP — fifth-pass findings

`15-rp-integration.md` decided *that* the phone should react to the story. This pass looked at *how it
currently knows anything*, and what the Engine offers that it isn't using.

---

## 1. The phone doesn't learn. It peeks. — `core finding`

The phone's entire awareness of the story is one function (`server-entry.ts:219`):

```
const worldContext = async (chatId) => {
  const lore = await loreContext();
  story = (await listMessages(chatId)).slice(-10)          // last 10 messages
    .map((message) => message.content.slice(0, 240))       // truncated to 240 chars each
    .join("\n");
  ...
}
```

**Ten messages, 240 characters each — about 2,400 characters, then forgotten.** It is re-read from
scratch on every request. Nothing accumulates, nothing persists, nothing is summarised.

Consequences that show up as apparent quality bugs:
- A Noodle feed generated an hour ago and one generated now share no continuity except what's stored.
- Mail can't reference anything that happened more than ten messages back.
- A character texting you has no idea what they said to you yesterday, beyond the thread itself.
- Anything important that happened 11 messages ago is invisible to the entire device.

This is the real reason the phone feels disconnected from the story — more than any individual app gap.

## 2. The Engine has semantic memory over the whole conversation. The phone reads the last ten lines.

`db/schema/chats.ts` → **`memory_chunks`**:
- formatted conversation fragments, grouped
- **`embedding`** — JSON float vector, explicitly "for semantic recall"
- `firstMessageAt` / `lastMessageAt`, `messageCount`, import support

The Engine can already answer "what's relevant to this, from anywhere in the history". The phone uses
a fixed 10-message tail instead. **Semantic recall is the single biggest available upgrade to phone
content quality** — every generated artefact would be able to reach the whole story, not a window.

## 3. The Engine has persistent agent memory. The phone stores no ambient memory.

`db/schema/agents.ts` → **`agentMemory`**: key-value, **per agent per chat**, persistent.

The virtual-phone agent could keep exactly the state that "learning" requires — running facts about
who texts whom, what a character posts about, ongoing threads, what the phone has already generated so
it doesn't repeat itself. It does not keep that ambient state. There is also a `memory` character
command in the conversation-calls system that the phone ignores.

The package now has a deliberately narrower exception: explicit user actions can record a small,
phone-owned world fact with the originating chat retained as provenance. Goodle bookmarks, Noodle
posts, and Marketplace events use this for continuity across apps and later chats on the same
persona/character phone. It is not semantic memory, does not summarize the story, and does not
include private banking state. Passive reads remain stateless.

## 4. Lore leaks across worlds — `bug`

`loreContext()` carries an existing deferral marker:

```
// ponytail: every lorebook feeds the phone, capped; switch to per-chat lorebook linkage when the Engine exposes it
```

**Every lorebook in the installation** feeds every phone — not the ones linked to the current chat.
Run two unrelated stories and one world's lore bleeds into the other's phone. Capped at 8 entries ×
200 chars, so it's bounded, but it's wrong content, not just too much.

**Now being fixed** — see the lore-scope decision below, which was reversed after tester feedback.

## 5. Multi-chat phones generate into the wrong chat — `bug`

```
// ponytail: generation always lands in the phone's first chat; per-chat targeting when phones span many chats
const chatId = scope[0];
```

A phone's `chatScope` is an array. Noodle generation always uses `scope[0]`. If a phone spans several
chats, feed content is generated from — and attributed to — the first one arbitrarily.

This directly collides with `11-messages.md`, which decided Engine chats appear as threads: a phone
with several chats in scope is a normal case there, not an edge case.

## 6. Character replies are generated inline, blocking the send

```
// ponytail: reply generated inline with send; queue it if model latency hurts
```

Sending a text waits on a model round trip before returning. With a slow connection the phone's send
button hangs. Matters more once `15-rp-integration.md` adds unprompted texts.

---

---

## Decisions

### Story recall — widen the window
Raise the 10-message / 240-char limits to something larger. **No semantic recall, no rolling summary.**
The phone keeps reading a tail of recent messages; it just reads more of it.

Accepted trade-off: anything older than the (now larger) window stays invisible. No dependency on the
API contract extension, so this is shippable immediately — it's close to a one-line change and it will
visibly improve every generated artefact.

Tune both numbers together: message count *and* the 240-char per-message truncation, which is the
harsher of the two — it clips long story messages mid-sentence before the model ever sees them.

### Phone memory — stateless
The phone keeps **no** persistent memory. No don't-repeat-yourself ledger, no per-character facts, no
relationship state. Every generation works from context alone. `agentMemory` stays unused.

Accepted trade-off: feeds and mail may recycle similar beats over a long story, since nothing records
what was already generated.

### Lore scope — ~~deferred~~ **un-deferred, and it grew a design**

> ~~The cross-world lore leak (§4) is **not** being fixed now. It stays a known bug, capped at 8
> entries. Revisit when the Engine exposes per-chat lorebook linkage.~~

Reversed by the tester thread ([`20-tester-feedback.md`](20-tester-feedback.md)), where this was
dsbwizzard's single biggest ask and the one he opened with:

> "This thing has got to listen for lorebook information. I want to target the phone with lorebook
> scoping so fake Google doesn't tell me a high-fantasy sword was found, or that France built a
> spaceship, in my low-fantasy non-Earth world."
>
> "TL;DR I want a way to have my phone agent see lorebook entries **without requiring the entry be in
> active chat context** at the time of phone access."

Two directions were considered and one was **rejected**:

**Rejected — lorebook-side scoping.** Lorebook entries can already restrict themselves to generation
sources (this is how Noodle is grounded today: a Constant entry scoped to Noodle only). Adding "Phone
Agent" as a generation target would work, but both parties talked themselves out of it. Noodle is an
Engine feature that always exists; agents are installed, imported, updated and deleted, so a lorebook
entry pointing at one is pointing at something that may not exist. It also can't be tuned per chat —
one lorebook, every phone in the installation. dsbwizzard: *"it feels hacky to me to use lorebooks to
point at agents which may or may not exist at any time."* It also needs Mari's buy-in on an Engine
feature, which this doesn't now require.

**Decided — agent-side lorebook attachment.** The phone selects its own lorebooks:

> "Like it should read chat, char, lorebook from chat settings, and then **also from agent settings**."
> — gunterlie

Phone Settings gets a Lorebooks section. Entries chosen there are read on every phone generation
**whether or not they're active in the chat's context**, on top of the chat/character/lorebook context
the phone already pulls from chat settings. Responsibility sits entirely inside the agent, which is
also what fixes §4: the phone stops slurping every lorebook in the installation and reads only what it
was pointed at, per phone.

**Scope of the attachment: per phone**, which means per persona/character via the binding in
[`20-tester-feedback.md`](20-tester-feedback.md) §2 — not global. That's what lets one character's
phone run on one world's rules while another's runs on a different set.

### Honour the entry's own filters — this is most of the feature

From the screenshots. Every lorebook entry already carries a **Context filters & matching sources**
block with three independent filters, each set to Any / Only / Exclude:

- **Characters** — e.g. `John Personman`
- **Character tags** — e.g. `Holy Knights of the Ogredom`
- **Generation** — the target list, enumerated in the screenshots as: *Conversation, Roleplay, Game,
  Chat reply, Continue, Autonomous, Swipe, Impersonate, Prompt preview, Test scan, Game setup,
  Lorebook Assistant, **Noodle***

Plus **Additional matching sources** (character name, description, personality, scenario, tags, persona
description, persona tags) and the per-entry toggles Whole Words / Case Sensitive / Locked / Recursion
/ No Vector.

**The phone should evaluate the Characters and Character-tags filters and ignore the Generation
filter.** That single rule does the heavy lifting:

- An entry scoped to `Characters: Only John Personman` applies to John's phone and no one else's —
  which is exactly how the tester's *"John's Cell Phone"* entry works, and it's why owner-shaped phones
  need no separate system (see [`20-tester-feedback.md`](20-tester-feedback.md) §1).
- Ignoring the Generation filter is the whole point of attachment: the entry applies **because you
  attached it to this phone**, not because it targets a generation type. That's what "read it even when
  it isn't in active chat context" means.

Note that `Noodle` sitting in that Generation list is the precedent for the rejected option — adding
`Phone Agent` as a fourteenth target is clearly *possible*. It was rejected for the lifecycle reasons
above, not for feasibility.

### Where it goes in the UI

Phone Settings already has a **Generation** section with `Replies` (character texts in Messages),
`Feeds & sites` (Goodle, Noodle, NoodleR, Mail, Tindler — each a separate model connection) and a free
text `Custom instructions` field applied to everything the phone generates. **Lorebooks is a fourth row
in that section**, not a new screen. See [`14-settings.md`](14-settings.md).

The keyword approach (hardcode a `phone` key that every phone generation triggers, or a custom-key
field in phone settings) is a **fallback** if attachment proves awkward — it works because "phone" is
already in every prompt the agent sends, the same trick that grounded Noodle with the "social media"
keyword before Noodle became a real generation target. The custom-instructions field per phone already
exists and covers part of this.

This is now the largest un-shipped item in this file, and it is worth more than the widened story
window above: a wrong-world Goodle result breaks immersion harder than a shallow one.

### Unprompted texts — time and absence
A character texts because it's been a while, or because you left something on read.

**This is consistent with staying stateless** — time-and-absence needs only a timestamp on the last
message in a thread, not remembered story state. It's the one trigger of the three that costs no
memory infrastructure. Cheapest option that still makes the phone feel alive.

> Note the interaction with [`15-rp-integration.md`](15-rp-integration.md), which decided characters
> act "driven by the story" and that story events reach the phone. With stateless generation and
> time-based triggers, the story-driven half of that is thinner than originally described: characters
> text on a timer with recent context, rather than reacting to remembered events. Worth knowing that's
> the shape being built.

## Still open (not decided)
- §5 multi-chat phones generating into `chatScope[0]` — a real bug, and it collides with the Messages
  decision. Needs a call.
- §6 inline reply generation blocking the send.
