# Engine interop — third-pass findings

Scoped pass over `sources/engine` and the package API contract. **These findings change earlier
decisions.** Read before implementing anything image-related.

---

## 0. The package API surface is narrow — and it blocks decisions we already made — `blocker`

The entire contract the phone gets from the Engine (`CapabilityContext`, `server-entry.ts:18-65`):

```
runtime.persistence  → documents, getChat, listMessages?, createMessageWithSwipe?
runtime.resources    → listCharacters, listPersonas, listLorebooks?, listEligibleLorebookEntries?
runtime.languageModels? → resolve().chatComplete()   // TEXT ONLY
registerPrivilegedRoutes
```

That's it. **No image generation. No Noodle. No gallery. No conversation calls.**

### Correction to earlier plans
Earlier passes confirmed the Engine *has* an image pipeline (selfie/illustrator, NovelAI image
connections) and concluded Camera/Tindler/Goodle images were feasible. The pipeline exists — but
**the package API does not expose it.** `languageModels.resolve().chatComplete()` returns text only.

So these decisions are **blocked on extending the package API contract**, which is an Engine-side
change, not a package change:
- `01-camera.md` — editable prompt → real generated image
- `07-tindler.md` — generated profile photos
- `13-goodle.md` — images on generated pages

**Decided: extend the package API contract** with an image capability (`runtime.images.generate(...)`).
This is an Engine-side change with a wider blast radius than anything else in the plan, and it needs
upstream buy-in — but it unblocks Camera, Tindler photos, and Goodle page images in one move.

Treat it as **task zero for all image work**. Nothing image-shaped can start until the contract lands.
The same contract extension should cover read access to `chat_images` (§2) and conversation call
sessions (see `17-calls.md`).

---

## 1. The Engine already has a full Noodle — the phone reimplemented a worse one — `duplication`

`db/schema/noodle.ts` is a complete social network:

| Engine table | What it holds |
|---|---|
| `noodle_accounts` | handle, display name, bio, avatar, per-entity (character/persona) |
| `noodle_posts` | content, **imageUrl + imagePrompt**, `parentPostId` (replies), `quotePostId`, source, author snapshot |
| `noodle_interactions` | likes / reposts / replies, deduped by (post, actor, type) |
| `noodle_activity_digests` | rolled-up activity |
| `noodle_refresh_runs` | background feed generation runs with status/prompt/result |

Plus `services/noodle/noodle-prompt.ts` and a prompt-override registry entry.

The phone's `system/noodle.ts` (212 lines) is a parallel, thinner implementation: no accounts, no real
replies, no quotes, and **like/boost counts faked from a string hash** (`09-noodle.md`) — while the
Engine has real, deduplicated interactions sitting right there.

**Decided: the phone keeps its own Noodle universe, but mirrors the Engine's design closely.**
Not a client of the Engine's tables — a parallel world with the same shape and mechanics:
accounts with handles and avatars, real replies (`parentPostId`), quotes, and **deduplicated
like/repost interactions instead of hash-faked counters**.

This supersedes the "counters stay fake" decision in `09-noodle.md`. The counters become real, just
phone-local. Borrow the Engine's schema shape rather than reinventing a thinner one — and where
possible borrow `services/noodle/noodle-prompt.ts`'s approach to generation too.

## 2. The Engine has a real image gallery — the phone scrapes URLs out of message text — `duplication`

`db/schema/gallery.ts` → `chat_images`: file path under `data/gallery/`, **prompt**, provider, model,
width, height, per chat. Plus `character_images`.

The phone's Gallery does `extractImageUrls(message.content)` — regex over message text — and caps at 60.
It cannot see anything the Engine generated and stored properly, and it has no prompt/metadata, which
is exactly what `02-gallery.md`'s "captions + real alt text" decision needs. **The prompt field is the
caption**, already recorded.

## 3. The Engine has a phone call system. The virtual phone has no phone app. — `gap`

`db/schema/conversation-calls.ts` → `conversation_call_sessions`:
- status: **`ringing` | `active` | `ended` | `declined` | `missed`**
- mode: `audio` | `video`
- **`initiator: user | character`** — characters can call *you*
- summary, per chat

There is a whole incoming-call model with ringing and missed calls, and the device that should
obviously surface it — a phone — has no dialer, no call log, no incoming call screen. A virtual phone
that can't take calls is a strange object.

This is the single most natural integration in the entire codebase and it's absent.

## 4. Character commands are an existing RP mechanic the phone ignores

`conversation-calls.routes.ts` defines character commands the model can emit mid-scene:
`selfie`, `memory`, `cross_post`, `schedule_update`, `note`, `react`, `music`, `haptic`, `influence`,
plus games. Several map directly onto phone surfaces:

- **`selfie`** → a photo arriving in Messages/Gallery, rather than only in chat.
- **`cross_post`** → "say this somewhere else" is *literally* sending a message to another thread.
- **`note`** → the Notes app.
- **`schedule_update`** → nothing on the phone surfaces a calendar; there's no Calendar app.
- **`haptic`** → the phone is silent; this is the buzz.

`15-rp-integration.md` decided "characters text you unprompted" and needs a mechanism.

**Decided: both mechanisms.**
- **Character commands** for deliberate, in-scene actions — a phone-flavoured command alongside
  `selfie`/`note`/`cross_post`, so the model triggers a text or post the same way it triggers
  everything else. Consistent, debuggable, already understood by the prompt system.
- **Background agent on turns** for ambient drift — the virtual-phone agent runs `post_processing`
  and advances phone state.

The commands are the cheaper and more legible half; build them first, add the agent after.

---

## Consequences for existing plans

| Plan | Change |
|---|---|
| `01-camera.md` | Real images **blocked** on API contract extension. |
| `02-gallery.md` | Should read `chat_images`, not regex message text. Captions come free from `prompt`. |
| `07-tindler.md` | Profile photos **blocked** on the same. |
| `09-noodle.md` | **Superseded.** Counters become real; mirror the Engine's Noodle design in the phone's own universe. |
| `13-goodle.md` | Page images **blocked** on the same. |
| `15-rp-integration.md` | Unprompted texts should ride the character-command mechanic. |
| `15-rp-integration.md` | Both mechanisms: character commands **and** the per-turn agent. |
| *new* | **[`17-calls.md`](17-calls.md)** — full Calls app: dialer, log, incoming screen. |
