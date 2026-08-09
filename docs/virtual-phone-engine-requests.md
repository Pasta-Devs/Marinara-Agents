# Virtual Phone — Engine capabilities we need

Everything in this file is blocked on Marinara Engine, not on the package. Each entry says what the
phone does today without it, what it would do with it, and the smallest API that would unblock us.
Ordered by how much roleplay value each one unlocks per unit of Engine work.

The package's own list of dependencies lives in `virtual-phone-roadmap.md` under Engine Dependencies;
this file is the detail behind it.

---

## 1. Pre-generation context injection (highest value by a distance)

**Today.** The agent is `phase: "pre_generation"`, `runtimeDisabled: true`, with an empty
`defaultPromptTemplate`. Nothing about the phone reaches the story's prompt. Context flows one way
only: the phone reads the last N story messages and the lorebooks, and the story reads nothing back.

The practical effect: a user can text a character in Messages for twenty turns, and the same
character in the chat below has no idea it happened. The phone is a well-built side game.

**With it.** One short block on each generation, built from state the package already computes
(`sharedPhoneContext`, `screenContent`, `directoryContext` in `server-entry.ts` all produce exactly
this shape today, and currently feed only the phone's own generations):

```
[Phone — 03:14. 3 unread from Mara: "are you still coming". Note written this scene:
"don't tell him about the car". Battery 4%.]
```

That single block is what turns the phone from a side panel into part of the scene. It is also the
prerequisite for anything else here being noticeable.

**Smallest API that works.** A server-side hook the package can register:

```ts
api.runtime.generation.contributeContext(async ({ chatId, mode }) => string | null);
```

- Called before prompt assembly, result appended to the system/context section.
- Returning `null` contributes nothing (the common case — no phone in this chat).
- A character budget the Engine enforces is fine; we will stay under ~600 characters.
- Ordering relative to other agents does not matter to us.

A static, package-authored string would not be enough: the content is per-chat and per-turn.

## 2. Phone commands available to character generation

**Today.** A model can write "*I'll text you when I land*" and nothing lands. Phone state only
changes when the user touches the phone. Characters cannot initiate; every incoming message is
generated because the user pressed something.

**With it.** The character texts you mid-scene and the phone buzzes. Missed calls, a photo sent, a
Noodle post published in reaction to a scene — all the things that make a phone feel like a phone
rather than a document you open.

**Smallest API that works.** Either direction is fine:

- *Declared tools*: `api.runtime.generation.registerTools([...])` with the usual JSON-schema tool
  shape, invoked during the character's generation.
- *Or post-processing hook*: `api.runtime.generation.onMessage(async ({ chatId, content }) => ...)`
  and we parse an agreed tag out of the text ourselves. Less clean, but it unblocks us and needs no
  tool-calling support on the user's connection.

The second option is meaningfully cheaper for the Engine and works on models without tool calling,
so it is our preference if only one ships.

## 3. `runtime.images.generate` and `chat_images` access

**Today.** Camera, Gallery, Tindler profiles and Goodle Images are all text standing in for
pictures. Tindler shows a generated description where the photo should be.

**With it.** The visual apps become the thing they are pretending to be. This is the largest visible
quality jump available to the package and needs no new phone-side design work — the surfaces exist.

**Smallest API that works.**

```ts
api.runtime.images.generate({ prompt, size }): Promise<{ url: string }>;
api.runtime.images.listChatImages(chatId): Promise<Array<{ id: string; url: string }>>;
api.runtime.images.attachToChat(chatId, { url, caption });
```

Read access alone (`listChatImages`) already unlocks a real Gallery from the images a story already
has, without any generation cost. That is a good first half if generation is far off.

## 4. Conversation call-session access

**Today.** Calls are not implemented. The Contacts detail view has no Call action, and the roadmap
blocks the whole app on this.

**With it.** Calls, voicemail, missed-call notifications — the phone's most obvious missing app.

**Smallest API that works.** Enough to start a Conversation-mode call session against a character
id and to know when it ends:

```ts
api.runtime.calls.start({ chatId, characterId }): Promise<{ sessionId: string }>;
api.runtime.calls.onEnd(handler);
```

Note the ordering dependency: the awareness directory (`directoryFor`) must be consulted when this
ships, or the first thing Calls does is let a stranger ring a character who never gave out the
number.

## 5. Lorebook entry filter fields

**Today.** `listEligibleLorebookEntries` returns entries without their character/persona scope, so
the package cannot honour an entry's own filters. We compensate with per-phone lorebook selection,
which is a user-facing workaround for missing metadata.

**With it.** Entry-level filters apply as the lorebook author intended, and the per-phone selector
becomes a refinement rather than a necessity.

**Smallest API that works.** Include `characterIds`, `personaIds` and `characterTags` on each
returned entry. Read-only, no behaviour change on the Engine side.

## 6. `runtime.agents` — discover and invoke other agents

Lowest priority of the six, and listed for completeness. It would let the phone cooperate with World
State (real scene time instead of the manual story clock the package now ships), with Music, and
with trackers. Everything above delivers more per unit of work, and the phone functions without it.

---

## What the package shipped instead, while waiting

Not blocked, already in: the story clock (per-phone time offset, applied to every rendered timestamp
and told to every generation), Show/Reference sending real screen content into the chat, the
awareness directory that tells the model who is a stranger, per-phone lorebook scope, per-phone
jailbreak text, and unprompted texts as an opt-in.

The gap that remains is genuinely the injection hook. Item 1 is worth more than items 2–6 combined.
