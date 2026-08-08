# The Engine contract ask

**What this is:** the concrete Engine-side change that Stage 11 needs, written after building
Stages 1–10 and hitting each wall in turn. Five items. Every one is *plumbing to something the
Engine already has* — none of them asks for new capability.

**Why it is one document:** it is one review rather than five. Items 1–3 come from
`16-engine-interop.md` §0. Items 4 and 5 are new: both were assumed possible when the plans were
written, and both turned out to be blocked when the code was actually written.

**Current package API**, everything the phone can see, from `CapabilityRuntimeHost`
(`packages/shared/src/types/capability-runtime.ts:270`):

```
embeddings   getAgentConfig   isDebugAgentsEnabled   json
languageModels   logger   persistence   resources
```

`languageModels.resolve().chatComplete()` returns **text only**.

---

## 1. `runtime.images.generate(...)`

**Blocks:** Camera step 3 (9.5), Goodle page images and the Images tab (9.1), Tindler profile
photos (`07-tindler.md`), Marketplace listing photos (11.5).

The Engine has a complete image pipeline. `generateImage()` at
`packages/server/src/services/image/image-generation.ts:201` takes an `ImageGenRequest` and returns
an `ImageGenResult` (`base64`, `mimeType`, `ext`). NovelAI, ComfyUI, RunPod, Venice and ZAI backends
all sit behind it. The package API simply does not expose it.

**Minimal shape.** The phone does not need reference images, ComfyUI workflows, or per-character
prompts — a prompt and a size is the whole ask:

```ts
interface CapabilityImageHost {
  /** null when the user has no image connection configured — a normal, permanent state. */
  generate(request: {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
  }, signal?: AbortSignal): Promise<{ base64: string; mimeType: string } | null>;
}
```

Added to `CapabilityRuntimeHost` as `images?: CapabilityImageHost`, optional like `languageModels`,
so packages degrade cleanly on older Engines.

**Note on cost and abuse:** this hands a package the ability to spend the user's image budget. Worth
gating the same way `languageModels` already is, and worth the phone's per-app image toggles
(Step 11.2) sitting on top regardless.

---

## 2. Read access to `chat_images`

**Blocks:** Gallery reading real images and using generation prompts as captions (9.4).

Schema at `packages/server/src/db/schema/gallery.ts:8`:

```
id  chatId  filePath  prompt  provider  model  width  height  createdAt
```

The phone currently finds images by **regexing URLs out of message text**
(`apps/gallery/manifest.ts` → `extractImageUrls`), which misses anything not written inline and
carries no prompt. `prompt` is exactly the caption the Gallery wants, and it is already stored.

**Minimal shape**, on `CapabilityPersistenceHost` next to `listMessages`:

```ts
listChatImages?(chatId: string): Promise<Array<{
  id: string;
  url: string;          // resolved, not a raw filePath — see resolveGalleryImagePath()
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}>>;
```

Returning a resolved URL rather than `filePath` keeps `data/gallery/` layout private to the Engine.
`resolveGalleryImagePath()` at `services/image/gallery-image-path.ts:8` already does the resolving.

**Write access** (phone-taken photos landing in the chat gallery) is a second, larger question —
it writes into Engine-owned storage. Read is the valuable half and can land alone.

---

## 3. Conversation call sessions

**Blocks:** the Calls app entirely (11.4).

Schema at `packages/server/src/db/schema/conversation-calls.ts:7`:

```
id  chatId  status(ringing|active|ended|declined|missed)  mode(audio|video)
initiator(user|character)  initiatorCharacterId  startedAt  endedAt  summary  metadata
```

This is a *complete* call model — including `initiator: "character"`, so characters can ring you —
and the device that should obviously surface it has no dialer. It is the most natural integration
in the codebase and it is absent purely because the package cannot see the table.

**Minimal shape:** read for the call log and the incoming-call screen, plus enough write to place
and decline a call.

```ts
interface CapabilityCallHost {
  list?(chatId: string): Promise<CallSession[]>;
  create?(input: { chatId: string; mode: "audio" | "video"; characterId: string }): Promise<CallSession>;
  update?(callId: string, patch: { status: "ended" | "declined" }): Promise<CallSession>;
}
```

Declining from the phone writes `declined`; not answering lands as `missed`. Those states already
carry story meaning — the phone would just be surfacing them.

**Prerequisite already built:** Step 9.10 (who holds whose details) shipped in 2.0.53, so the Calls
app will not have strangers ringing a number nobody gave them.

---

## 4. Lorebook entry filter fields — NEW, and the cheapest of the five

**Blocks:** Step 7.2, automatic owner-shaped phones.

`CapabilityLorebookEntryRecord` (`packages/shared/src/types/capability-runtime.ts:50`) returns:

```
id  lorebookId  lorebookName  name  content  description
```

The entry's **Context filters & matching sources** block never crosses the boundary. The columns
exist on the entry (`packages/server/src/db/schema/lorebooks.ts:121-135`):

```
characterFilterMode(any|include|exclude)      characterFilterIds
characterTagFilterMode(any|include|exclude)   characterTagFilters
generationTriggerFilterMode                   generationTriggerFilters
```

And `listEligibleEntriesByIds` (`services/storage/lorebooks.storage.ts:616`) *deliberately* resolves
attached entries **without** character or persona scope — its own docstring says so. So the phone
cannot evaluate the filter and cannot ask the Engine to.

**Why it matters:** this is the tester's own worked example. An entry titled *"John's Cell Phone"*,
~58 tokens, Characters filter set to `John Personman`, describing a man hopeless with technology
whose phone should reflect it. That authoring already works; the phone just cannot see who it is
meant for.

**Minimal shape** — three fields onto the existing record, no behaviour change:

```ts
characterFilterMode: "any" | "include" | "exclude";
characterFilterIds: string[];
characterTagFilterMode: "any" | "include" | "exclude";
characterTagFilters: string[];
```

Generation-trigger filters are deliberately *not* asked for: the phone reads an entry because the
user attached it to that phone, not because it targets a generation type.

**Workaround shipped meanwhile (2.0.48):** lorebooks attach per phone in Settings, so the John
example works *by hand* — you attach that entry to John's phone. Item 4 is what makes it automatic.

---

## 5. A `phone` conversation command key — NEW

**Blocks:** the commands half of Step 8.4.

`16-engine-interop.md` §4 says to build character commands first because they are "already
understood by the prompt system". They are — but the list is closed. From
`packages/shared/src/types/chat.ts:32`:

```ts
export const CONVERSATION_COMMAND_KEYS = [
  "schedule_update", "cross_post", "selfie", "memory", "scene", "call",
  "uno", "chess", "poker", "eightball", "tic_tac_toe", "rock_paper_scissors",
  "music", "haptic", "influence", "note", "react",
] as const;
```

…with owners mapped at `chat.ts:57` (`CONVERSATION_COMMAND_AGENT_IDS`), and a `switch` over known
types in `services/generation/conversation-command-runtime.ts:53`. A downloadable package cannot add
a key.

**Minimal shape:** add `"phone"` to `CONVERSATION_COMMAND_KEYS`, map it to `virtual-phone` in
`CONVERSATION_COMMAND_AGENT_IDS`, and add the case. The package handles the payload.

That would let a character deliberately use their phone in-scene — text someone, look something up,
take a photo — rather than the phone only ever moving when the user touches it.

**Not asked for:** anything that makes the phone agent run every turn. That is the other half of
8.4, it is a package-side decision, and it stays off by default.

---

# Summary

| # | Ask | Engine work | Unblocks |
|---|---|---|---|
| 1 | `runtime.images.generate` | Wrap `generateImage()` | Camera, Goodle, Tindler, Marketplace |
| 2 | `listChatImages` | Read `chat_images`, resolve URL | Gallery captions and real sources |
| 3 | Call session read/write | Expose `conversation_call_sessions` | The Calls app |
| 4 | Lorebook filter fields | 4 fields onto an existing record | Automatic owner-shaped phones |
| 5 | `"phone"` command key | 3 files, one enum + switch case | In-scene phone use by characters |

**Items 4 and 5 are the cheap ones** and each unblocks a headline feature. If only part of this can
land, they are the best value per line of Engine change.

**Everything else in the plan is already shipped** — Stages 1 through 10, plus Banking and
Marketplace, as of package version 2.0.56. This document is the entire remaining dependency.
