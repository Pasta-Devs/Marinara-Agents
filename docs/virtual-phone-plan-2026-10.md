# Virtual Phone plan — October 2026

Status: proposal, nothing below is implemented. Written 2026-10-28 after work on the phone had stopped since 2026-08-16.

## 1. Branch state

- `just-duck` now holds the August WIP as one commit (`e620844f9`) plus a merge of `origin/staging` (`6b605c291`), pushed to `origin/just-duck`. No PR, no issue.
- The WIP was the stash `pre-staging-merge-just-duck` (2026-08-16), applied over the old HEAD with four files left unmerged. README took the branch side (one new Virtual Phone row); the three catalogs were reset to HEAD and rebuilt.
- Staging conflicts were only `scripts/build-feature-packages.mjs` and `scripts/validate-catalog.mjs`. Both take the staging version, plus the phone:
  - a `virtual-phone` feature entry in the staging shape (`capabilityApi: PACKAGE_CAPABILITY_API`, `builtAgainst: PACKAGE_BUILT_AGAINST`, `minEngineVersion: "2.5.0"`), because every package built here now takes Engine code through `__MARINARA_HOST__`;
  - the `test-catalog.json` writer for the `hold-the-phone` development catalog;
  - validator counts 43 packages / 26 agents / 17 features, README count 43 / 24 Misc Agents.
- Dropped from the August build script, on purpose: optional `server.mjs`, the python `zipfile` fallback and the `virtual-phone-2` retired-artifact sweep. Staging's deterministic zip writer replaces the zip code, and the phone has a server.
- New `packages/virtual-phone/CHANGELOG.md` (2.10.1): staging now refuses a minor bump without notes.
- `tests/virtual-phone.scaffold.mjs` was stale against the WIP (expected 2.10.0 and no `chat-read`); fixed.
- Verified on the merge commit: `build-feature-packages.mjs virtual-phone` (Engine build root at staging `a942740e6`), `test-catalog-lanes`, `validate-package-locales`, `validate-catalog` (43 packages, lanes v2=43 v3=43), `virtual-phone.regression.ts`, `virtual-phone.scaffold.mjs`. Not run: the layout screenshots (`tests/layout/virtual-phone.screens.mjs`) and any live Engine install.
- The regression test needs React from an Engine checkout: `NODE_PATH=$ENGINE/node_modules:$ENGINE/packages/client/node_modules npx tsx tests/virtual-phone.regression.ts`.
- Open question for release: virtual-phone is not on staging yet. Ship it as a normal catalog entry or as a staging-only preview (`catalog-incomplete.mjs`) first. Decide before the first PR.

## 2. What changed in the Engine that matters

Engine staging supports capability API 1.387; the phone is built at 1.341. Main reference: `docs/development/optional-agent-packages.md` in the Engine.

| Engine feature | Since | Permission | What the phone gets |
|---|---|---|---|
| `runtime.integrations.images.generate / save / stage` | 1.31 | `network`, `storage` | Real Camera shots, Goodle Images, Tindler photos, DM selfies |
| `images.addToChatGallery`, `images.persistToEntityGalleries` | 1.341 | `storage` | Phone photos land in the chat or character gallery |
| `runtime.persistence.appendMessages(chatId, messages)` | 1.341 | `chat-write` | Write a phone event into the chat without a user turn |
| `persistence.updateCharacterStatus(chatId, characterId, {status, activity, duration})` | — | `chat-write` | "Online / away / on a trip" in Messages and Contacts |
| `registerSceneOrigin({getContext, claim, release})` + client `startScene` | 1.66 | `scenes` | A DM or a call becomes a real scene |
| `registerPromptContext` request now carries `targetCharacterIds`, `personaId`, `placedAgentTypes` | 1.341+ | `prompt-context` | Per-character phone memory in the roleplay prompt |
| `resources.listEligibleLorebookEntries` include/exclude lorebooks, entries, source agents | — | — | Roadmap item "lorebook entry filters" |
| `admission.tryBackground(connectionId)` / `withProvider` | — | — | Background LLM work waits politely for the user's connection |
| Client `__MARINARA_HOST__.services.tts.speakSequence(requests, id, { audioConnectionId })`, per-character / per-persona voice assignment | 1.381 | client only | Voice messages and spoken calls in the character's voice |
| Server `runtime.integrations.speech.transcribe` / `transcribeLocal` | 1.31 / 1.341 | `network` | User voice notes |
| `listChatSummaries` | 1.387 | `chat-read` | Cheap "what happened lately" for proactive messages |
| Conversation Calls package (`packages/conversation-calls`, 1.1.7) with TTS, `/start` route and `ConversationCallSurface` | — | — | The real call experience the phone Calls app should hand off to |

Still missing in the Engine:
- no scheduler, timer or notification API for packages (Slurp2 runs its own `setInterval` schedulers with `addTeardown`);
- no `runtime.calls` — the Calls API the phone codes against was never shipped; calls moved into the Conversation Calls package;
- no server-side TTS; no abandoned-swipe rollback hook; no package-to-package service registry (so the phone cannot read Noodle's or Slurp2's data through a contract).

Capability gating: `scripts/build-feature-packages.mjs` supports `optionalPermissions: [{ permission, capabilityApi }]`, so the phone can ask for `network`, `chat-write` or `scenes` only on Engines that know them and stay installable at 1.341.

## 3. Findings

### Bugs and dead ends (ranked)

1. **Calls never work on any current Engine.** `system/server-entry.ts:1853` and `:1878` call `api.runtime.calls.create/update`, which does not exist. The character `place_call` command (`server-entry.ts:~3376`) returns silently, and the Calls app always shows "Calls are unavailable". The 2.10.1 changelog says so.
2. **Camera and Gallery are text-only on purpose, but the reason is gone.** `apps/camera/shell.tsx:54`, `apps/gallery/shell.tsx:26`, `platform/emoji.ts:2` and `apps/bazaar/manifest.ts:80` all wait for "Engine Step 11.3" (image API). It shipped in 1.31.
3. **Messages polls every 4 s** (`apps/messages/shell.tsx:101`) next to 30 s polls in `index.tsx:353`, `index.tsx:750`, `apps/calls/shell.tsx:90`, `apps/messages/shell.tsx:91`. With several phones open this is constant server work. No push channel exists, so the fix is backoff and visibility checks.
4. **`server-entry.ts` is 3,478 lines.** Every route, generator and command handler is in one file. Not a bug, but every item below touches it; split by app before adding features (no new abstractions, just move code).
5. **Capability API declared is 1.341** while the code still guards for features "before 2.4.2". The `if (!api.runtime.persistence.createMessageWithSwipe)` and `if (api.registerPromptContext)` branches are dead on the new 2.5.0 minimum and can go.

### Gap check (from the brief)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Characters never message first | **Partly.** A character can text, call or post only *inside its own reply*, through the `[phone]` conversation command (`server-entry.ts:3312-3420`). Nothing happens between turns. | no timer anywhere in `system/` |
| 2 | Camera pictures are text only | **Confirmed** | `apps/camera/shell.tsx:54` |
| 3 | Noodle follows do not gate knowledge | **Different problem.** The phone's Noodle is its own per-chat feed (`system/noodle.ts:177`, `NoodleFeedService`) with likes and boosts but no follows at all. Follows live in the separate Noodle package and in NoodleR subscriptions. Knowledge *is* gated, but by the interaction ledger (`system/interaction-projector.ts:29-47`: physical observer, private / participants audience), not by social graph. | |
| 4 | Characters do not remember their own phone activity | **Mostly confirmed.** The prompt gets unread counts, battery, device facts and scene state (`system/turn-context.ts:192-243`, 600 chars), plus ledger events that carry an explicit `promptSummary` (`interaction-projector.ts:47-83`, 700 chars, only when exactly one target and one phone). Posts, sent mail, purchases and notes are not projected unless the action wrote a ledger event. | |
| 5 | No calendar / tracker / status app | **Confirmed.** The phone reads `getGameState` only for time, location and weather (`server-entry.ts:549`, `:805`). | |
| 6 | No voice calls | **Confirmed**, and worse: no calls at all (bug 1). | |

### Other gaps found

- **No group threads.** `system/messaging.ts:32-45` stores exactly two participants. Tavo and the ST phone setups both have group chats.
- **No status / presence.** Contacts and Messages have no "online / away / on a trip"; `updateCharacterStatus` now exists.
- **No path from phone to scene.** "Meet me at the bar" in a DM cannot start a scene; `registerSceneOrigin` now covers it.
- **Three Noodles.** The phone Noodle, the Noodle package and Slurp2 all simulate social feeds. Without a package-service registry the phone cannot read the others; the phone feed should stay small and the plan should not grow it.

### UX weak spots

- Calls tab offers buttons that always fail; hide the app or hand off (P1).
- Camera "photo" is a description card; with images available, the text card should become the fallback only.
- Proactive activity is invisible until the user opens the phone; the toolbar badge only reflects unread threads.

## 4. Ranked improvements

Size: S ≈ a day, M ≈ a few days, L ≈ a week or more. Each line is one PR unless noted.

| Rank | Item | Size | Engine dependency | Reuse |
|---|---|---|---|---|
| P1 | **Fix Calls**: drop `runtime.calls`; Calls app and the `place_call` command hand off to the Conversation Calls package when it is installed (its `/start` route + surface), else show "install Conversation Calls". Keep the phone call log. | M | Conversation Calls package; no new Engine API | `packages/conversation-calls` routes, TTS voice resolution |
| P2 | **Real photos**: Camera shot, DM selfie, Goodle Images and Tindler profile pictures through `images.generate`, saved with `addToChatGallery`; text card stays as fallback when no image connection exists. Gallery reads them back. | M | cap API 1.341, `network` (optional permission) | Slurp2 `slp-generation-integrations.ts` (null-safe host pattern), `slp-camera-source.ts` (selfie / mirror / tripod framing, pure), `slurpViewerPhotoPrompt`, `sources/forge-kit/image-avatar-references.mjs` |
| P3 | **Phone memory in the roleplay prompt**: each phone action that a character does (post, sent text, mail, purchase, note) writes a short `promptSummary`; the prompt context lists the owner's last few actions for the target character within a fixed budget. | S | none (`prompt-context` already granted) | Slurp2 `buildSlurpChatContextBlock` (pure, budgeted block) |
| P4 | **Characters text first**: a server timer (started in `activate`, stopped with teardown) picks due follow-ups — promises made in chat, check-ins, "I'll send you a pic when I land" — and writes a phone thread message (optionally with a P2 selfie). It respects power, connectivity and a per-phone daily cap; it uses `admission.tryBackground` so it never blocks the user's reply. The next roleplay turn learns about it through the existing unread line. No chat writes. | L | none required; `listChatSummaries` (1.387) optional | Slurp2 `slp-follow-up.ts` (`createScheduledFollowUps`, `detectPromiseFromText`, `isFollowUpDue`, `allowsUnsolicitedText`) and `slp-check-in-intervals.ts`, copied into `sources/forge-kit/` as pure helpers; own storage |
| P5 | **Calendar / status app**: one "Today" app that shows story time, weather, location, the character's status, scheduled follow-ups from P4 and promises; an optional tracker panel reads `getGameState` fields (incl. cycle / pregnancy stages when the user's tracker has them). Read-only first. | M | none | Slurp2 storyline stage idea (`docs/STORYLINES.md`), not its code |
| P6 | **Presence**: show `updateCharacterStatus` state in Contacts and Messages; let a character's phone command set "away / on a trip" with a duration. | S | `chat-write` (optional permission) | — |
| P7 | **Voice messages**: play a character's text as a voice note in Messages through host `services.tts` with the character's assigned voice; record user voice notes through `speech.transcribe`. | M | TTS host service (1.381), `network` for STT | Conversation Calls `resolveTTSVoiceForSpeaker` pattern |
| P8 | **Phone to scene**: "Meet up" in a thread and an accepted call start a scene through `registerSceneOrigin`, with the thread as context. | M | cap API 1.66, `scenes` | Slurp2 scene origin use (`docs/SCENES.md`) |
| P9 | **Group threads** in Messages (3+ participants, one reply per character per turn). | M | none | — |
| P10 | **Polling diet**: one shared poll with backoff, paused when the phone is hidden; Messages 4 s → 15 s while open. | S | none | — |
| P11 | **Lorebook entry filters** (roadmap correctness item, now possible). | S | present | — |
| P12 | **Split `server-entry.ts`** by app and delete the pre-2.4.2 guards. Do this first when P1–P4 start, as a no-behavior-change PR. | M | none | — |

Not planned: follow-gated knowledge (item 3 of the brief). The phone has no follow graph, and reading Noodle or Slurp2 follows needs a package-service registry the Engine does not have. Revisit when that registry exists; the interaction ledger already gives "who saw what".

### Suggested order

P12 (split) → P1 (calls) → P3 (memory) → P2 (photos) → P4 (text first, uses P2) → P6 → P5 → P10, then P7–P9 and P11 as capacity allows. P1–P3 are each small enough to ship as 2.10.x patches; P4 is the headline of the next release.

### Decisions needed

- Release lane for the first phone release on staging: normal catalog or staging-only preview.
- P4 limits: how many unsolicited texts per character per real day, and whether they also need the chat to be open.
- P2 cost: generate a photo only when the user opens it ("tap to develop"), or right away.
