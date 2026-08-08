# The Engine contract ask

**What this is:** the Engine-side change the Virtual Phone needs, written after building Stages 1–10
and hitting each wall in turn.

**The short version.** Three of the five things the phone is blocked on are not really *"give the
phone a table"* — they are *"let the phone talk to another agent"*:

| Blocked feature | What actually owns it |
|---|---|
| Camera photo, Goodle images, Tindler photos, Marketplace photos | the **Illustrator** agent owns the `selfie` command |
| The Calls app | the **conversation-calls** agent owns the `call` command |
| Music transport on the lock screen (Step 10.1) | the **Music DJ** agent |

`15-rp-integration.md` §5 already states the principle: **the phone integrates *control* of other
agents, never their functionality** — otherwise the phone becomes a container for every other agent,
against the bundle-size constraint in `20-tester-feedback.md` §10.

So the ask below is **two general mechanisms plus two small data reads**, rather than five
point-solutions. The general version means the phone stops needing a new Engine change per
integration: a Cooking agent ships, and the phone can have a recipes app the same week with no
Engine work at all.

**Each general ask carries a narrow fallback.** If the general shape is too large a change to take
now, the fallback unblocks the same features and can be taken instead — the narrow versions are what
`16-engine-interop.md` §0 originally scoped. Both are specified so this can be decided in one
review rather than two.

**Current package API**, everything a package can see today, from `CapabilityRuntimeHost`
(`packages/shared/src/types/capability-runtime.ts:270`):

```
embeddings   getAgentConfig   isDebugAgentsEnabled   json
languageModels   logger   persistence   resources
```

`languageModels.resolve().chatComplete()` returns **text only**.

---

# A. `runtime.agents` — discover and drive other agents

**The general ask.** Unblocks images everywhere, the Calls app, Music DJ transport, and every
integration nobody has thought of yet.

Today a package cannot tell that another agent exists, let alone ask it for anything. Agents are
declared as `BuiltInAgentManifest` (`packages/shared/src/features/agents/agent-manifest.types.ts:4`)
and looked up through `getBuiltInAgentManifest()`, all Engine-internal.

**Proposed shape:**

```ts
interface CapabilityAgentHost {
  /** Agents installed and enabled for this chat, with the actions each one declares. */
  list(chatId: string): Promise<Array<{
    id: string;              // "illustrator", "conversation-calls", "music-dj"
    name: string;
    packageId?: string;
    actions: string[];       // declared, invocable action ids
  }>>;

  /**
   * Invoke a declared action on another agent. Returns null when the agent is absent, disabled,
   * or declines — callers must treat that as normal, not exceptional.
   */
  invoke(chatId: string, agentId: string, action: string, input: unknown): Promise<unknown | null>;
}
```

Added as `agents?: CapabilityAgentHost` — optional like `languageModels`, so packages degrade
cleanly on older Engines.

**What the phone would do with it, immediately:**

- `invoke(chatId, "illustrator", "generate", { prompt })` — Camera step 3, Goodle page images,
  Tindler profile photos, Marketplace listing photos.
- `invoke(chatId, "conversation-calls", ...)` — the dialer, call log and incoming-call screen.
- `invoke(chatId, "music-dj", "skip" | "volume")` — Step 10.1, two clicks from the lock screen.

**What it needs from the Engine beyond the host itself:** agents must declare their invocable
actions. That is the real work in this item — a field on the agent manifest and a dispatcher. It is
also what makes the mechanism general rather than a switch statement over three known agent ids.

**Security surface, stated plainly:** this lets one package drive another, and image generation
spends the user's budget. It should be gated at least as tightly as `languageModels` already is, and
probably per-agent — an agent declaring an action is consenting to be invoked, and the user enabling
both agents in a chat is the second gate. Worth designing deliberately rather than inheriting
whatever `languageModels` does.

### A-fallback: `runtime.images.generate` only

If A is too large to take now, this unblocks every image feature and nothing else.

`generateImage()` at `packages/server/src/services/image/image-generation.ts:201` takes an
`ImageGenRequest` and returns `{ base64, mimeType, ext }`, with NovelAI, ComfyUI, RunPod, Venice and
ZAI behind it. The phone needs a fraction of that surface:

```ts
interface CapabilityImageHost {
  /** null when no image connection is configured — a normal, permanent state for many users. */
  generate(request: {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
  }, signal?: AbortSignal): Promise<{ base64: string; mimeType: string } | null>;
}
```

The Calls app and Music DJ transport stay blocked under the fallback.

---

# B. Package-declared conversation commands

**The general ask.** Lets any package register its own command instead of the Engine hardcoding one
per package.

`16-engine-interop.md` §4 says to build character commands first because they are "already
understood by the prompt system". They are — but the list is closed
(`packages/shared/src/types/chat.ts:32`):

```ts
export const CONVERSATION_COMMAND_KEYS = [
  "schedule_update", "cross_post", "selfie", "memory", "scene", "call",
  "uno", "chess", "poker", "eightball", "tic_tac_toe", "rock_paper_scissors",
  "music", "haptic", "influence", "note", "react",
] as const;
```

…owners mapped at `chat.ts:57` (`CONVERSATION_COMMAND_AGENT_IDS`), dispatched by a `switch` over
known types in `services/generation/conversation-command-runtime.ts:53`. Note that the map already
records *which package owns which command* — the concept is there, only the registration is static.

**Proposed shape:** let a capability package declare commands in its manifest, and have the command
registry merge declared commands with the built-in list at runtime. The per-chat toggle UI, the
enable/disable plumbing and `isConversationCommandEnabled` all keep working unchanged, because they
already operate on a key rather than on a literal.

**What the phone would do with it:** a character deliberately using their phone in-scene — texting
someone, looking something up, taking a photo — rather than the phone only ever moving when the user
touches it.

### B-fallback: add a single `"phone"` key

Add `"phone"` to `CONVERSATION_COMMAND_KEYS`, map it to `virtual-phone` in
`CONVERSATION_COMMAND_AGENT_IDS`, add the case in the runtime switch. Three files, no new concepts.
Every future package pays the same cost again.

---

# C. Read access to `chat_images`

**Not agent-shaped — a data read, and small.** Blocks Gallery reading real images and using
generation prompts as captions (Step 9.4).

Schema at `packages/server/src/db/schema/gallery.ts:8`:

```
id  chatId  filePath  prompt  provider  model  width  height  createdAt
```

The phone currently finds images by **regexing URLs out of message text**
(`apps/gallery/manifest.ts` → `extractImageUrls`), which misses anything not written inline and
carries no prompt. `prompt` is exactly the caption the Gallery wants, and it is already stored.

**Proposed shape**, on `CapabilityPersistenceHost` beside `listMessages`:

```ts
listChatImages?(chatId: string): Promise<Array<{
  id: string;
  url: string;          // resolved, not a raw filePath
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}>>;
```

Returning a resolved URL keeps `data/gallery/` layout private to the Engine;
`resolveGalleryImagePath()` (`services/image/gallery-image-path.ts:8`) already does the resolving.

**Write access** — phone-taken photos landing in the chat gallery — is deliberately *not* asked for
here. It writes into Engine-owned storage and is a larger question. Read is the valuable half and
can land alone.

---

# D. Lorebook entry filter fields

**Not agent-shaped either, and the cheapest item in this document.** Blocks Step 7.2, automatic
owner-shaped phones.

`CapabilityLorebookEntryRecord` (`packages/shared/src/types/capability-runtime.ts:50`) returns:

```
id  lorebookId  lorebookName  name  content  description
```

The entry's **Context filters & matching sources** block never crosses the boundary. The columns
exist (`packages/server/src/db/schema/lorebooks.ts:121-135`):

```
characterFilterMode(any|include|exclude)      characterFilterIds
characterTagFilterMode(any|include|exclude)   characterTagFilters
generationTriggerFilterMode                   generationTriggerFilters
```

And `listEligibleEntriesByIds` (`services/storage/lorebooks.storage.ts:616`) **deliberately**
resolves attached entries without character or persona scope — its own docstring says so. So the
phone can neither evaluate the filter nor ask the Engine to.

**Why it matters:** this is the tester's own worked example. An entry titled *"John's Cell Phone"*,
~58 tokens, Characters filter set to `John Personman`, describing a man hopeless with technology
whose phone should reflect it. That authoring already works — the phone just cannot see who it is
meant for.

**Proposed shape** — four fields onto the existing record, no behaviour change:

```ts
characterFilterMode: "any" | "include" | "exclude";
characterFilterIds: string[];
characterTagFilterMode: "any" | "include" | "exclude";
characterTagFilters: string[];
```

Generation-trigger filters are deliberately not asked for: the phone reads an entry because the user
attached it to that phone, not because it targets a generation type.

**Shipped workaround (2.0.48):** lorebooks attach per phone in Settings, so the John example works
*by hand*. Item D is what makes it automatic.

---

# Summary

| # | Ask | Narrow fallback | Unblocks |
|---|---|---|---|
| **A** | `runtime.agents` — discover + invoke | `runtime.images.generate` only | Images everywhere, Calls, Music DJ, future agents |
| **B** | Package-declared commands | Add one `"phone"` key | Characters using their phone in-scene |
| **C** | `listChatImages` | — | Gallery real sources and prompts-as-captions |
| **D** | Lorebook filter fields | — | Automatic owner-shaped phones |

**If only part can land:** C and D are tiny, self-contained and each unblocks a real feature — best
value per line of Engine change. A is the one worth taking generally rather than narrowly, because
it is the difference between the phone integrating three agents and the phone integrating every
agent that ever ships.

**Everything else in the plan is already shipped** — Stages 1 through 10, plus Banking and
Marketplace, as of package version 2.0.57. This document is the entire remaining dependency.
