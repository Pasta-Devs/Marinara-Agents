# Virtual Phone — stepped implementation plan

**Audience:** an AI coding agent picking this up cold. You have no prior context on this package. Read
Stage 0 completely before editing anything.

**What this is:** the execution order for the twenty design documents in this directory. Those files
hold the *decisions and the reasoning*; this file holds the *sequence and the acceptance criteria*.
When a step says "see `13-goodle.md`", read it — it explains why, and this file will not repeat it.

**Scope:** `packages/virtual-phone`. Version at time of writing: `2.0.41`.

**How to use this file:** work top to bottom. Stages are ordered by dependency and by value-per-effort,
not by app. Do not skip ahead to the interesting apps — Stage 1 deletes code that later stages would
otherwise force you to maintain, and Stage 2 removes a seven-place edit that every new app pays.

---

# Stage 0 — Orientation

Do all of this before your first edit.

## 0.1 Read these, in this order

1. `docs/app-plans/README.md` — the index and the bug list.
2. `docs/app-plans/00-platform.md` — cross-cutting findings; several outrank per-app work.
3. `docs/app-plans/16-engine-interop.md` — what the Engine offers and what the package API does *not*
   expose. This one invalidates decisions in three other files.
4. `docs/app-plans/20-tester-feedback.md` — outside review; reverses decisions in six plans.
5. `CONTRIBUTING.md` and `AGENTS.md` at the repo root — workflow rules, and they are enforced.

Then skim the app plan for whatever you're about to touch.

## 0.2 Repository rules that will bite you

From `AGENTS.md`, non-negotiable:

- **Branch from `staging`**, not `main`. Open an issue before implementation; open a **draft** PR when
  work begins; mark ready only after validation.
- **`packages/virtual-phone/client.js` and `server.mjs` are generated build outputs. Never hand-edit
  them.** Same for `artifacts/*.zip`, `catalog/catalog.json`, `catalog/v*/catalog.json`, and every
  hash, checksum and byte-size in `manifest.json`. Edit `src/`, then rebuild.
- **Rebuild whenever source payloads, manifests or bundles change.**
- Manifest `engine.min` / `engine.maxExclusive` is the catalog-lane source of truth. The builder routes
  packages into lanes; never hand-place entries.
- Keep edits non-destructive; preserve unrelated work in a dirty worktree.
- Changes to permissions, archive handling, install/update behaviour or executable client/server code
  are security-sensitive and need explicit validation notes in the PR.
- Never auto-check validation or test-plan checkboxes in a PR. They are a human verification list.

## 0.3 The build and validation loop

```
# rebuild this package's bundles, manifest hashes and catalog entry
node scripts/build-feature-packages.mjs virtual-phone

# baseline validation, both required
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
```

The bundler is esbuild, invoked from `scripts/build-feature-packages.mjs`. Source root is
`packages/virtual-phone/src`. Run the rebuild **and both validators** before every commit that touches
`src/`, and paste their output into the PR.

There is also a regression suite at `tests/virtual-phone.regression.ts` — read Step 1.2 before
assuming it's telling you the truth about what's alive.

## 0.4 The code map

```
packages/virtual-phone/
  manifest.json          package metadata, file hashes/sizes   GENERATED FIELDS
  agents.json            agent declaration (see below)
  client.js  server.mjs  GENERATED BUNDLES — never hand-edit
  src/phone/
    index.tsx            device shell, 520 lines. App registration + render chain.
    platform/            api, app-registry, app-manifest, content, context, phone-store,
                         use-phone-store, app-header, avatars, top-bar,
                         app-lifecycle*, capabilities*, notifications*, bottom-navigation*
    device/              identity, settings, status, theme, styles, effects, surfaces
    system/              server-entry.ts (~1000 lines, all routes), messaging, noodle,
                         forum, PhonesSettings.tsx
    apps/<id>/           manifest.ts + shell.tsx, one folder per app
                         app-store camera contacts forum gallery goodle mail messages
                         noodler noodler-r notes settings tindler
```

`*` = no production consumer. Stage 1 deletes them.

Note the naming trap: the **Noodle** app lives in `apps/noodler/`, and **NoodleR** lives in
`apps/noodler-r/`. They are different apps. Server routes match: `/noodle/feed` is served but the app
folder is `noodler`, while `/noodler/feed` and `/noodler-r/page` also exist. Check which you're in.

## 0.5 Server routes as they exist today

All under prefix `/api/virtual-phone`, registered via `api.registerPrivilegedRoutes` at
`system/server-entry.ts:993`:

```
/phones                                    /phones/:ownerType/:ownerId
/chats/:chatId/phones                      /chats/:chatId/phones/:ownerType/:ownerId
/chats/:chatId/phones/:phoneId/show        /chats/:chatId/unread
/phones/:phoneId/settings                  /phones/:phoneId/settings/reset
/phones/:phoneId/apps/:appId/storage       /phones/:phoneId/apps/:appId/storage/:key
/phones/:phoneId/notifications
/phones/:phoneId/contacts                  /phones/:phoneId/contacts/:contactId
/phones/:phoneId/messaging                 /phones/:phoneId/messaging/send
/phones/:phoneId/messaging/read
/phones/:phoneId/mail/inbox
/phones/:phoneId/goodle/search             /phones/:phoneId/goodle/page
/phones/:phoneId/noodle/feed               /phones/:phoneId/noodle/post
/phones/:phoneId/noodler/feed              /phones/:phoneId/noodler/trending
/phones/:phoneId/noodler-r/page
/phones/:phoneId/tindler/deck
/phones/:phoneId/gallery                   /phones/:phoneId/camera/shot
/phones/:phoneId/forum                     /phones/:phoneId/forum/refresh
/phones/:phoneId/forum/reply
```

## 0.6 The API contract you are limited to

The entire surface the Engine gives this package (`system/server-entry.ts:18-65`):

```
runtime.persistence      documents, getChat, listMessages?, createMessageWithSwipe?
runtime.resources        listCharacters, listPersonas, listLorebooks?, listEligibleLorebookEntries?
runtime.languageModels?  resolve().chatComplete()          ← TEXT ONLY
registerPrivilegedRoutes
```

**There is no image generation, no Noodle access, no gallery table access, and no call sessions.**
Members marked `?` are optional and may be absent on older Engines — always degrade cleanly, following
the existing `"This Engine version cannot write to the story"` guard as precedent.

Everything image-shaped and the Calls app are blocked on extending this contract. That is Stage 11 and
it is an Engine-side change requiring the maintainer's buy-in. **Do not start it speculatively.**

## 0.7 Definition of done, every step

- The behaviour change is real and manually verifiable in a running Engine.
- No new hand-edits to generated files.
- `node scripts/build-feature-packages.mjs virtual-phone` succeeds.
- Both validators pass.
- Errors are surfaced, not swallowed. This codebase has a habit of `.catch(() => undefined)`; do not
  add more, and remove them where you touch them.
- Accessibility of the shell is *good* and deliberate (focus trap, `inert`, focus restore,
  `role="dialog"`, per-app error boundaries — see `18-device-shell.md` §5). **Do not "simplify" it.**
  The gaps are inside apps, not the shell.

---

# Stage U — Upstream track

**These are conversations, not code.** Send them early — they have long lead times and cost you no
build effort — but **write no Engine-dependent code until Stage 11.**

That is a standing rule for this whole plan:

> **Anything requiring an Engine-side change happens last.** Every app in Stage 9 ships its unblocked
> half first and its blocked half in Stage 11. No stage below Stage 11 may be gated on an Engine change
> landing. If you find yourself waiting on the Engine, you are in the wrong stage — move on.

The reason is scheduling, not principle: an Engine change needs the maintainer, review, and a release,
and none of that is under your control. Twelve stages of work are. Do not let the one dependency you
cannot schedule block the eleven you can.

## Step U.1 — Request the package API contract extension

Gates all of Stage 11 (every image feature and the Calls app). Full detail in Step 11.1 and
`16-engine-interop.md` §0.

**Ask for, in one request:** `runtime.images.generate(...)`, read access to `chat_images`, and
conversation call sessions. Bundling them is deliberate — it's one Engine-side change with one review,
rather than three.

Bring the justification with you: the Engine *has* an image pipeline and the package API simply doesn't
expose it, so this is plumbing rather than new capability. Note that ~4 of the plan's app-level
decisions are blocked behind it.

**While you wait:** build Step 11.2 parts (b) and (c) — the no-connection empty state and the
retry-on-failure flow. They're unblocked, they ship value on their own, and many users never configure
an image connection at all, so that path is permanent regardless.

## Step U.2 — Raise the "world object" question

**Decision:** `20-tester-feedback.md` §9, from the maintainer's own remark in the tester thread:

> "I think we need a transparent way to link things together… like different chats, RPs, stories,
> worlds."

The phone is **world-scoped**. Noodle and NoodleR are **installation-scoped**. Agents are
**chat-scoped**. Lorebooks are **installation-scoped with per-entry targeting**. LTM and World Maps are
**character-scoped and durable**. Five scoping models, and the phone touches all five.

There is no "world" object in ME to hang any of it on, and a good half of the awkward decisions in these
files are individual workarounds for that absence — sharing outward to Noodle (Step 9.9), the lorebook
grounding design (Stage 7), phone persistence (Step 7.5), a cross-chat banking balance (Step 7.6).

**Not something the phone should solve**, and not a blocker for anything below — every stage here has a
workaround already designed. But raise it **before** the phone accretes five more of them, because each
one is cheaper to not-write than to unwind later.

**Concretely:** write up the five-scoping-models problem with the four worked examples above and put it
in front of the maintainer. If a world object is on the roadmap, several designs below get simpler; if
it isn't, the workarounds stand and you've lost nothing.

---

# Stage 1 — Delete first

Nothing here adds a feature. All of it removes code that later stages would otherwise force you to
carry, and it shrinks the downloadable bundle — a stated concern
(`20-tester-feedback.md` §10: *"the agent is gonna be 271MB"*).

Across twenty design files the only subtractions are in this stage. Do them together, in one PR.

## Step 1.1 — Remove the Forum app entirely

**Decision:** `06-forum.md`, reversed to "scrapped" by the tester thread. Forum is Noodle with worse
chrome; every generated thread in the maintainer's own screenshot sits at `0 replies`. The stranger-
contact case it uniquely served is better covered by Mail (accepts invented addresses) and Messages.

**Delete:**
- `src/phone/apps/forum/manifest.ts`, `src/phone/apps/forum/shell.tsx`
- `src/phone/system/forum.ts`
- Routes `/phones/:phoneId/forum`, `/forum/refresh`, `/forum/reply` in `system/server-entry.ts`
- The forum content schema and its `parseBoundedContent` call site
- All seven registration sites in `index.tsx` (see Step 2.1 for the list)
- Any forum entry in the app icon/glyph maps, including `apps/app-store/shell.tsx`

**Keep:** nothing. `board.web` survives as a **Goodle page kind** — Goodle already has a forum page
kind, so the flavour costs nothing (see `13-goodle.md`).

**Acceptance:** Forum is absent from the home screen and the App Store; no dead route; grep for
`forum` returns only Goodle's page-kind usage and the design docs.

**Watch:** users may have `forum` in their persisted `deviceSettings.installedApps`. Ignore unknown app
ids when rendering rather than crashing — verify this is already the behaviour and add it if not.

## Step 1.2 — Delete the platform scaffolding with no production consumer

**Decision:** `00-platform.md` §2. ~160 lines imported **only** by `tests/virtual-phone.regression.ts`.
The tests make them look alive; nothing in the app constructs them.

**Delete:**
- `platform/app-lifecycle.ts` (`AppLifecycleManager`)
- `platform/capabilities.ts` (`AppCapabilityGrants` — the whole capability enforcement system)
- `platform/notifications.ts` (`NotificationStore`)
- `platform/bottom-navigation.ts` (54 lines, imported by *nothing at all*)
- The tests in `tests/virtual-phone.regression.ts` that are these modules' only consumers

**Keep:** `InstalledAppRegistry` and `AppRouteStackManager` (real consumers in `index.tsx`), and
`validateAppManifest` in `platform/app-manifest.ts` (called by `register`).

App manifests keep their `capabilities` array **as documentation**. Nothing enforced it before; now
nothing pretends to. Say so in a comment on the manifest type so the next reader doesn't re-add it.

**Acceptance:** the four modules are gone; `node scripts/build-feature-packages.mjs virtual-phone`
succeeds; the remaining regression tests pass.

**Judgement call:** if deleting a test would drop coverage of something *real*, rewrite it against the
surviving code instead of deleting it. Do not delete a test merely because it fails.

## Step 1.3 — De-duplicate the copy-pasted helpers

**Decision:** `00-platform.md` §5.

- `hueFor` — three identical copies (goodle, noodler-r, tindler) → one platform export.
- `initials` — two copies (tindler, noodler-r); **the noodler-r one is dead** → delete it, hoist the other.
- The app icon/glyph map — currently in `index.tsx` as `styledAppIds` (line ~96) **and** duplicated in
  `apps/app-store/shell.tsx` → single platform source, consumed by both.

Do the icon map *after* Step 2.1, which needs the same map. Or do them together; they're the same edit.

**Acceptance:** one definition each; grep proves it.

---

# Stage 2 — Registry-driven app rendering

## Step 2.1 — Collapse the seven-site app registration

**Decision:** `18-device-shell.md` §1. This is a **blocker for adding any new app**, and Stage 11 adds
one (Calls).

Today every app is hardcoded at seven places in `index.tsx`:

| # | Site | Line (approx) |
|---|------|---------------|
| 1 | `React.lazy(...)` const | 29–41 |
| 2 | `phoneAppRegistry.register({...})` | 43–55 |
| 3 | the `ActiveApp` union type | 85 |
| 4 | `styledAppIds` set (third copy of the icon map) | 96 |
| 5 | `optionalApps` array (label + icon) | 249 |
| 6 | a render line in the `activeApp === …` chain | 392–404 |
| 7 | `apps/app-store/shell.tsx`'s own `appGlyphs` map | — |

Sites 6 are thirteen near-identical ~300-character JSX lines, each wrapping the app in
`AppErrorBoundary` + `React.Suspense` with a per-app loading string.

`InstalledAppRegistry` exists precisely to prevent this and is currently **decorative** — its only real
consumer is the App Store list.

**Do:** make the registry the single source. Each entry carries id, manifest, lazy component, label,
icon, and a props-builder. Render from `registry.get(activeApp)` — one `AppErrorBoundary` +
`Suspense`, one loading string derived from the manifest name.

**Preserve exactly:**
- The per-app `installedApps.includes(id)` guard.
- Apps that additionally require `chatId` — **contacts** and **noodler-r** currently render only when
  `chatId` is truthy. Model this as a declared requirement on the registry entry, not a special case.
- Per-app extra props: goodle takes `initialQuery={pendingSearch}`; noodler and forum take `ownerName`;
  settings takes the merged `{...selectedPhone, settings: deviceSettings}` plus `onPhoneChange`.
- App Store's `onOpenApp` clearing `pendingSearch` when opening goodle.
- Per-app error boundaries. Do not collapse them into one boundary for the whole device — a crashing
  app must not take the shell down.

**Acceptance:** adding a fourteenth app touches **one** registry entry and nothing else. Every existing
app still opens, still respects install state, and still error-boundaries independently.

**Risk:** this is a pure refactor of the most-used file in the package. Do it in its own PR with no
behaviour change, so a regression is bisectable.

---

# Stage 3 — Content quality

Two changes, both small, both improving every app at once. Highest value-per-line in the plan.

## Step 3.1 — Per-field content limits

**Decision:** `00-platform.md` §1, marked `critical`.

`platform/content.ts` funnels **all** model output through `parseBoundedContent`, called at 11 sites in
`server-entry.ts`, with three global constants:

```ts
const MAX_FIELDS = 8;
const MAX_STRING = 300;
const MAX_ITEMS = 10;
```

Every generated string is cut at 300 characters and every list at 10 items. A 300-character email is
two sentences. A 300-character web page section is a paragraph fragment ending mid-thought. **This is
almost certainly why generated content feels thin everywhere.**

**Do:** move the caps into `ContentSchema` so each declares its own. Suggested shape:

```ts
interface ContentSchema {
  fields: Record<string, "string" | "number" | "boolean" | "string[]">;
  defaults: Record<string, unknown>;
  limits?: { maxString?: number; maxItems?: number; perField?: Record<string, number> };
}
```

Keep the current values as defaults so an unmigrated schema behaves exactly as today, then raise them
per call site. Rough targets — tune by eye against real output:

| Content | String | Items |
|---|---|---|
| Mail body | ~2000 | inbox ~25 |
| Goodle page section | ~1200 | ~12 |
| Noodle post | ~600 | feed ~20 |
| NoodleR page | ~1200 | — |
| Tindler profile | ~600 | ~15 |
| Camera shot description | ~800 | — |
| Messages reply | **keep short**, ~400 | — |

Messages genuinely *should* stay short — a character texting writes like they're texting. Everything
else should not.

**Acceptance:** generated mail and Goodle pages visibly run longer than a paragraph; a Messages reply
still reads like a text. No truncation mid-word at the new limits.

**Note:** `MAX_FIELDS = 8` also silently drops schema fields past the eighth via
`Object.entries(schema.fields).slice(0, MAX_FIELDS)`. Check no schema currently exceeds it; make the
cap per-schema too, or drop it and rely on the schema being authored deliberately.

## Step 3.2 — Widen the story window

**Decision:** `19-background-and-learning.md`, "Story recall — widen the window".

`worldContext` at `server-entry.ts:219` is the phone's *entire* awareness of the story:

```ts
story = (await listMessages(chatId)).slice(-10)
  .map((message) => message.content.slice(0, 240))
  .join("\n");
```

Ten messages, 240 characters each. ~2,400 characters, re-read from scratch every request, never
accumulated.

**Do:** raise both numbers. **The 240-char per-message truncation is the harsher of the two** — it
clips long story messages mid-sentence before the model ever sees them. Tune them together against a
real chat and a real context budget.

**Explicitly not doing:** semantic recall over `memory_chunks`, rolling summaries, and `agentMemory`
persistence. The phone stays **stateless** by decision. Read the "Phone memory — stateless" section in
`19-background-and-learning.md` before proposing otherwise — the trade-off (feeds may recycle beats
over a long story) was accepted knowingly.

**Acceptance:** generated content references events further back than ten messages.

---

# Stage 4 — Bugs that lose data or waste round trips

## Step 4.1 — Mail refresh no longer wipes the inbox

**Decision:** `08-mail.md`. Listed in the README as the worst data bug in the phone.

Refresh does `persist(response.emails.map(...))` — **replaces** the entire inbox, destroying read state
and every older mail.

**Do:** append + dedupe. Stable identity per mail (sender + subject + timestamp, or a generated id).
Preserve read/unread. This is a bug fix and lands regardless of the larger mail-client work in Stage 9.

**Acceptance:** refresh twice; older mail and read state survive both.

## Step 4.2 — `PhoneStore.set` costs two round trips

**Decision:** `00-platform.md` §3.

```ts
async set(key, value) {
  const entries = await this.backend.list(...);  // full LIST of all app storage
  ...quota math...
  await this.backend.set(...);                   // then the PUT
}
```

Every write first downloads all of that app's storage to compute a 256KB quota.

**Do:** track size client-side, or enforce the quota server-side on write. Either removes the LIST.

**Acceptance:** one network call per `set`.

## Step 4.3 — Notes stops persisting on every keystroke

**Decision:** `12-notes.md`, upgraded from polish to a real fix by 4.2.

Notes saves on every keystroke, and with 4.2 unfixed that was *two HTTP round trips per character
typed*, one of them downloading the entire notes array. Debounce it (~500ms) and flush on blur/close so
nothing is lost. Same treatment for Tindler's preferences field.

**Acceptance:** typing a sentence produces one save, not forty.

## Step 4.4 — Make the Contacts delete route reachable

**Decision:** `04-contacts.md`.

`DELETE /phones/:phoneId/contacts/:contactId` exists server-side and **no UI calls it**. Rows are inert
`<div>`s. Covered fully by the Contacts work in Stage 9; if you want the bug closed early, the minimum
is making rows interactive and wiring delete.

## Step 4.5 — Character replies stop blocking the send

**Decision:** `19-background-and-learning.md` §6, listed there as *still open* — **decide it here: do
it.** Sending a text currently waits on a model round trip before returning, so the send button hangs
on a slow connection. Queue the reply and let the UI return immediately, showing the thread with a
pending indicator.

This matters more after Stage 6 and Stage 8, when characters text unprompted.

**Acceptance:** send returns immediately; the reply arrives asynchronously; a failed generation surfaces
an error in-thread rather than vanishing.

---

# Stage 5 — Device shell

## Step 5.1 — Deliver notifications when the phone is closed

**Decision:** `18-device-shell.md` §2. **This blocks the headline RP feature.**

```ts
React.useEffect(() => {
  if (!open || !selectedPhone || activeApp !== null) { ... return; }
  void phoneRequest(`/phones/${...}/notifications`) ...
}, [open, selectedPhone?.phoneId, activeApp]);
```

Nothing polls while the phone is **closed**, and nothing polls while you're **inside an app**. So
"characters text you unprompted mid-scene" (`15-rp-integration.md`) is *inert as built* — the buzz
cannot reach you unless you already have the phone open on the home screen.

**Do:** poll (or receive) notifications independently of `open` and `activeApp`. Surface them as a
badge on the closed device and inside apps.

**Good news:** the lock screen with a tappable notification list **already exists**
(`session.surface === "lock"`, cards that unlock straight into the app). The surface is built; only
delivery is missing.

**Budget:** don't poll aggressively while closed. Match the existing 30s cadence or slower, and stop
when the chat isn't active.

**Acceptance:** with the phone closed, a new message produces a visible indicator; tapping through
opens the thread.

## Step 5.2 — Story-driven status bar

**Decision:** `18-device-shell.md` §3, **revised by the tester thread**.

`device/status.ts` → `defaultPhoneStatus()` returns hardcoded `batteryLevel: 80` and a fixed "full
signal, Wi-Fi off" cluster.

**Do:** let the model set battery and signal to fit the story, exactly as it already drives screen
overlays.

**Do NOT:** drift the battery over session time, and **do not read the host device's real battery** —
that was the tester's first guess and it's wrong for a device belonging to a character, and meaningless
on a desktop. A phone dying at the wrong moment should be a plot beat someone chose.

The mechanism already exists next door: Settings ships `Screen overlay`, `Overlay intensity` and
`Reduce device effects`, and the model already drives cracked/blood overlays. Hang status on the same
hook. This also feeds owner-shaped phones in Stage 7 — a neglected character's phone starts at 4%.

**Acceptance:** the model can set battery/signal; absent instruction, the default is unchanged at 80%.

## Step 5.3 — Align the clock to the minute

**Decision:** `18-device-shell.md` §4. `useClock` ticks on a 30s interval instead of aligning to the
minute boundary, so the displayed time lags by up to 30 seconds. One-line fix on one of the two
most-looked-at pixel rows.

---

# Stage 6 — Messages ↔ Engine conversations

**Status: the maintainer reported this in progress** (`11-messages.md`, tester thread). Check the
working tree before starting; coordinate rather than duplicate.

**Decision:** `11-messages.md`, the headline. Today Messages is a closed sandbox in
`system/messaging.ts`, disconnected from the actual roleplay chat.

## Step 6.1 — Engine chats appear as threads

Read via `runtime.persistence.listMessages(chatId)` across the phone's `identity.chatScope`. Sandbox
phone-to-phone threads stay alongside them.

**Engine-backed threads are read-only history plus a send box.** Unread counts and `markRead` apply
only to sandbox threads — do not force the sandbox thread model onto them.

## Step 6.2 — Sending from the phone posts into the real chat

Via `runtime.persistence.createMessageWithSwipe(...)` — the same path
`POST /chats/:chatId/phones/:phoneId/show` already uses at `server-entry.ts:334`.

**The character replies in the chat, not inside the phone.** The phone becomes an input surface for the
roleplay.

`createMessageWithSwipe` is **optional on the runtime**. Degrade cleanly where absent; precedent is the
existing `"This Engine version cannot write to the story"` guard.

## Step 6.3 — Mark phone texts as texts to the model

Wrap outgoing phone messages (e.g. `*texts:* …`) so the character answers like they're texting —
shorter, async, no body language. **Always on; not a device setting.**

## Step 6.4 — Fix `chatScope[0]` targeting

**Decision:** `19-background-and-learning.md` §5, listed there as *still open* — **decide it here:
fix it as part of this stage.**

```ts
// ponytail: generation always lands in the phone's first chat; per-chat targeting when phones span many chats
const chatId = scope[0];
```

A phone's `chatScope` is an array, and Noodle generation always uses `scope[0]` arbitrarily. Once
Engine chats are threads, **a phone spanning several chats is the normal case, not an edge case** — the
two decisions collide directly.

**Do:** thread an explicit chat target through generation. Where the user's action implies a chat (this
thread, this app opened from this chat), use it. Where nothing implies one, pick deliberately and
document the rule — don't leave an array index.

**Acceptance:** a phone with two chats in scope generates content attributable to the right one.

---

# Stage 7 — Lorebooks and owner-shaped phones

The biggest ask from the tester thread, and after the screenshots it is much smaller than it sounds.
Read `19-background-and-learning.md` "Lore scope" and `20-tester-feedback.md` §1 in full first.

## Step 7.1 — Attach lorebooks per phone

**Problem** (`19-background-and-learning.md` §4): `loreContext()` feeds **every lorebook in the
installation** to every phone, capped at 8 entries × 200 chars. Run two unrelated stories and one
world's lore bleeds into the other's phone. It is *wrong content*, not merely too much.

**Rejected approach — do not build this:** adding "Phone Agent" to the lorebook's own Generation-target
list. It's feasible (Noodle is already in that list) but agents are installed, imported, updated and
deleted, so a lorebook entry would point at something that may not exist; and it can't be tuned per
chat. Both parties talked themselves out of it.

**Build instead — agent-side attachment.** Phone Settings gains a Lorebooks picker. Selected
lorebooks/entries are read on **every** phone generation, whether or not they're active in chat
context, on top of the chat/character/lorebook context already pulled from chat settings.

Use `runtime.resources.listLorebooks?` and `listEligibleLorebookEntries?` — both **optional**; degrade
cleanly.

**Scope: per phone**, i.e. per persona/character. Not global. That's what lets one character's phone run
on one world's rules while another's runs on a different set.

## Step 7.2 — Honour the entry's own Characters filter

**This step is most of the owner-shaped-phone feature and it is nearly free.**

Every lorebook entry already carries a *Context filters & matching sources* block with three
independent Any/Only/Exclude filters — **Characters**, **Character tags**, **Generation** — plus
additional matching sources and per-entry toggles.

**Rule: evaluate Characters and Character-tags; ignore Generation.**

Ignoring Generation is the entire point of attachment — the entry applies *because you attached it to
this phone*, not because it targets a generation type. That is what "read it even when it isn't in
active chat context" means.

Honouring Characters is what makes owner-shaped phones work without a new system. The tester authored
exactly this and screenshotted it — entry titled *"John's Cell Phone"*, ~58 tokens, Characters filter
set to `John Personman`:

> "John Personman is absolutely awful at using technology. Their phone should reflect this, and be
> confusing to use correctly, have errors, etc. Goodle/Web links should have scams, weird language
> settings, and more confusing behaviour."

The government-issue restricted phone is the same entry with different prose. Users author owner
behaviour directly, per character, in tooling they already know.

## Step 7.3 — Infer an owner profile from the character card

The fallback for the majority who won't write a lorebook entry. At phone activation, let the model
infer the owner's relationship with technology from the character card plus attached lorebooks, and
carry it into generation: Goodle result quality, ad/scam density, UI language, installed apps, screen
condition, how locked-down the device is.

**Generated once at activation, not per request.**

Do **not** build a separate persisted owner-profile system as the primary mechanism — 7.2 is the
mechanism; this is the default. Keep it to the smallest thing that produces a usable profile.

## Step 7.4 — UI placement

Settings already has a **Generation** section containing `Replies` (a model connection; covers character
texts in Messages), `Feeds & sites` (a second connection; covers Goodle, Noodle, NoodleR, Mail,
Tindler) and free-text `Custom instructions` applied to everything the phone generates.

**Lorebooks is a fourth row in that section, not a new screen.** See `14-settings.md`.

Update the section's helper text — it currently omits Forum already, and Forum is gone as of Step 1.1.

## Step 7.5 — Phone persistence per persona and per character

**Decision:** `20-tester-feedback.md` §2. Configuring a phone is real work; redoing it every roleplay is
the repeated-work problem LTM and World Maps already solved. Phone config (attached lorebooks, custom
instructions, installed apps, owner profile) binds to **persona ID or character ID** and survives across
chats.

**Prior art — copy, don't invent.** From Long-Term Memory (Pasta Devs v1.1.6):

- Scope is a **Character × Chat × Branch** triple, each defaulting to "All". That's the shape to
  target — and the **Branch** dimension is a better answer to the backwards-timeskip problem than the
  "forwards-only is fine" limitation the thread accepted.
- Sources are pluggable, with tabs for Chat Summaries, **Characters** and **Lorebooks** — LTM already
  ingests lorebooks against the same data.
- **Propose → review → accept**: nothing is written silently.
- Entries carry a status and can be archived or deleted, grouped by kind.

Ask **Promansis**, who is named in the thread as able to explain LTM's binding and retrieval — faster
than reading it cold.

**Acceptance:** configure a character's phone in one chat; open a new chat with that character; the
configuration is there.

## Step 7.6 — Banking

**Decision:** `20-tester-feedback.md` §5. Proposed by the tester as a joke about scope creep and
immediately wanted by the maintainer — *"this is actually something I want… I think a banking app would
be kinda easy to do; we store the data per persona, so just store a few numbers."*

**It lives here, not in a parked list, because it is the same feature as Step 7.5.** Cross-chat
per-persona persistence is the hard part, and 7.5 builds it. Once a phone's config survives across
chats, a balance surviving across chats is a few more numbers in the same store. Build it directly
after, while that code is in your hands — it will never be cheaper.

**Build:**
- Balance stored **per persona**, persisting across chats, using the Step 7.5 mechanism.
- A transaction history, not just a number — a bare balance can't be audited when the model moves it.
- The model may propose balance changes as story events warrant.
- **The user has the final say**: approve or reject a proposed change, or edit the balance directly.
  This is the guardrail — *not* an AI plausibility check. The tester's framing: *"let me
  administratively approve or reject balance changes, or manually edit my balance to self-correct if
  the LLM goes nuts… or let me give myself forty concordillion dollars and pretend I am rich."*

**Do not design the approve/reject flow — copy LTM's Review Queue.** A proposed balance change is a
pending item the user accepts or discards, structurally identical to a proposed memory. Already built,
already familiar, and Step 7.5 has you reading LTM anyway.

**Reference the existing tracker agent** rather than building fresh accounting.

**Natural tie-in, worth doing in the same pass:** NoodleR already has a hidden per-post unlock cost
(currently worked around by setting the balance to 9999999). Wire it to the real balance and earning
money gains an in-roleplay point.

**Caveat, and respect it:** this is an n=1 ask (Appendix A.6). It's cheap *given 7.5*, which is why it's
scheduled — but if 7.5 slips, this slips with it. Do not build a bespoke persistence layer to
unblock it.

---

# Stage 8 — Notifications beyond Messages

**Decision:** `00-platform.md` §4. `GET /phones/:phoneId/notifications` is hardcoded to unread message
threads. Five apps declare `notify` and never fire one. A phone that only buzzes for texts is a quiet
phone.

## Step 8.1 — Restructure the route to collect per app

It currently derives notifications inline from message threads. Make it collect from each app.

## Step 8.2 — Wire the decided sources

- **Mail** — new mail arrives.
- **NoodleR** — a creator you subscribe to posted.
- **Noodle / Tindler** — feed activity and new matches.

Forum is not on this list because Forum no longer exists (Step 1.1). The original "not Forum" carve-out
in `00-platform.md` §4 is moot.

**Depends on Step 5.1** — without delivery while closed, none of these reach the user.

## Step 8.3 — Unprompted texts

**Decision:** `19-background-and-learning.md`, "Unprompted texts — time and absence".

A character texts because **it's been a while**, or because **you left them on read**. This needs only a
timestamp on the last message in a thread — no remembered story state — which is what keeps it
consistent with the stateless decision in Step 3.2.

**Budget it.** A low-probability gate plus a cooldown, not a generation every turn
(`15-rp-integration.md`, risk 1).

**Know what you're building:** with stateless generation and time-based triggers, characters text *on a
timer with recent context*, rather than reacting to remembered events. `15-rp-integration.md` describes
this as "driven by the story", which is thinner in practice. That gap is acknowledged in
`19-background-and-learning.md` — don't be surprised by it, and don't silently expand scope to close it.

## Step 8.4 — The agent phase question

`agents.json` currently declares:

```json
"phase": "pre_generation", "runtimeDisabled": true,
"execution": "feature", "defaultPromptTemplate": ""
```

So the agent injects nothing and never runs a turn. The Engine supports phases
`pre_generation | parallel | post_processing`, and `agentRuns` records results per chat+message with
token and duration accounting.

- `post_processing` is the natural fit for "the turn happened, now advance the phone".
- The ambient own-phone context needs `pre_generation` to reach the prompt.
- You may need both.

**Flipping `runtimeDisabled` turns this from opt-in-cosmetic into something that spends tokens. It must
stay clearly optional and off by default.** Treat that as a hard requirement, not a preference.

`16-engine-interop.md` §4 decided **both** mechanisms: character commands (a phone-flavoured command
alongside the existing `selfie` / `note` / `cross_post` / `haptic`) for deliberate in-scene actions,
**and** the per-turn agent for ambient drift. **Build the commands first** — cheaper, more legible,
already understood by the prompt system.

---

# Stage 9 — Per-app functionality

Order within this stage is by value. Each has a full plan file; read it before starting.

## Step 9.1 — Goodle (`13-goodle.md`) — the richest app, deepest treatment

- **Clickable in-text links** — entities in page prose become links to further generated pages.
  **Highest-value item here**; it's what makes the fake web feel deep.
- **Forward navigation + history** — a real back/forward stack, replacing the 8-item recent-searches
  list as the only memory.
- **Bookmarks snapshot page content**, not just the URL. Generated pages aren't stable across
  regenerations, so a URL-only bookmark undermines the point. The site cache is currently **per chat**;
  a bookmark caches indefinitely and across chats.

**Deferred to Stage 11.3** (Engine change required — do not start here): the Images tab, and the
per-site image generation button. Build the page-layout side so images can slot in later without a
rewrite: reserve the slot, render the caption, leave the picture empty. That's Step 11.2(b) and it is
unblocked — a Goodle page with empty image slots and intact captions is a *finished* page, not a
placeholder.

- **Open question, needs a decision before shipping:** what happens when a user pastes a **real URL**?
  The tester's first instinct on seeing a browser was a real Reddit link. Options: generate a fake page
  at that address; refuse with an in-character no-connection page; or let the model riff on the domain.
  The last is probably right, but pick one — pasting a URL into a low-fantasy world must not yield Reddit.

## Step 9.2 — Mail (`08-mail.md`) — largest single item in the plan

Full mail client: compose, reply, delete, archive, folders, timestamps throughout. Recipients via
Contacts autocomplete **with free text allowed** — you can invent an address for a company or stranger
and let the model decide who that is. Characters answer mail sent to them.

Needs the server to model addresses and threading, not a flat list of generated strings.

Already partly true today: mail is world-scoped with linked characters and user-added addresses.

Step 4.1 (destructive refresh) lands first, regardless.

**Known gap, solved separately in Step 9.10:** nothing models *who has whose address* — everyone can
mail everyone. Invisible while you initiate; a continuity break once characters initiate. Build the
mail client first; 9.10 layers onto it.

## Step 9.3 — Contacts (`04-contacts.md`)

- Move "Add someone" behind a `+` header action opening a sheet; the list becomes the main content.
- Tapping a contact opens a detail page — avatar, bio, phone label, and actions: Message, NoodleR page,
  Edit, Delete. This makes the orphaned DELETE route reachable (Step 4.4).
- Contacts become editable.
- *Open:* search/filter for large casts — revisit if the cast grows.

## Step 9.4 — Gallery (`02-gallery.md`)

- Next/prev in the lightbox (swipe + arrow keys).
- **Captions doubling as real `alt` text.** Every image is currently `alt=""` — an accessibility hole as
  well as a UX one.
- Delete / hide a photo.
- Shows Camera roll shots alongside chat images.
- Not doing: albums / grouping.

Captions work today without the Engine: the phone can generate or carry its own caption per image. Do
that now rather than waiting.

**Deferred to Stage 11.3** (Engine change required): reading the Engine's `chat_images` table instead of
regexing image URLs out of message text, which also brings the generation `prompt` to use directly as
the caption. Until then the regex source stays. **Also deferred:** phone-taken photos reaching the chat
gallery — that's a write into Engine-owned storage.

Design the caption as a field the Gallery owns, so swapping the source later replaces where it's
populated from and nothing else.

## Step 9.5 — Camera (`01-camera.md`)

Shutter flow: press → model describes what the camera sees in current story context → **description
shown editable** so the user can refine the prompt → confirm → image generation → real image in the roll.

**Build the first two steps now and stop there.** Press-shutter and edit-the-description are the whole
interaction; they need no Engine change. Committing produces a **text "photo" card** — today's
behaviour — which stays as the permanent fallback for hosts with no image connection, so it is not
throwaway work. The third step, real image generation, is **deferred to Stage 11.3**.

This is the app where the split is most obviously fine: an editable prompt you can refine is the
interesting half, and it's the unblocked half.

Also: surface errors (currently `.catch(() => undefined)`), allow deleting a shot, make the silent
24-shot cap visible or lift it.

**Verify first:** the plan lists "no aim/subject input" as a finding, but the maintainer says subject
control is *already done*. Check before building it.

## Step 9.6 — Noodle (`09-noodle.md`, superseded by `16-engine-interop.md` §1)

The old "counters stay fake" decision **no longer stands**. The Engine has real accounts, replies,
quotes and deduplicated interactions, so the cost argument for faking them collapsed.

**The phone keeps its own Noodle universe, mirroring the Engine's design closely:** accounts with
handles and avatars, real replies (`parentPostId`), quotes, and **real deduplicated like/repost
interactions** replacing the hash-derived `postStats`. Phone-local, same shape and mechanics. Borrow
the shape of `db/schema/noodle.ts` and the approach in `services/noodle/noodle-prompt.ts` rather than
reinventing a thinner version.

*Open:* tappable trends → filtered feed or Goodle search. Not decided.

## Step 9.7 — Settings (`14-settings.md`)

- **Live preview of appearance** — theme, wallpaper, tint, case colour update visibly as you pick them.
  Settings currently PATCHes on every change, so the preview needs local state ahead of the round trip.
- **About this phone** — owner, number, storage used, installed apps.
- Use `phoneRequest` for `/api/connections` instead of a bare `fetch`.
- Plus the Lorebooks row from Step 7.4.
- Not doing: per-app notification preferences, per-app settings surfaced here.

## Step 9.8 — App Store (`10-app-store.md`)

- App detail page describing what each app actually does.
- **Confirm before Remove** — removal can destroy that app's storage.
- Install stays instant. No fake progress bars, no ratings, no reviews.
- Reuse the platform icon/glyph map (Step 1.3) instead of the local duplicate.
- *Open:* whether "Featured" should be editorial rather than "everything not installed".

## Step 9.9 — Sharing seam (`03-sharing-seam.md`)

Apps never talk to each other; this is the connective tissue. Build a **shared share-sheet component**,
not per-app buttons, or the same three actions get written three times.

- **Set as wallpaper / avatar** — local, cheap, **do this one first**.
- **Attach to Messages** — message records gain an image/attachment field. Server + Messages changes.
- **Post to Noodle** — photo posts in the feed.

Entry points are Gallery and the Camera roll.

**Not decided — sharing *outward* to the installation-wide Noodle.** The phone is world-scoped; Noodle
and NoodleR are installation-scoped, so posting out crosses worlds. Noodle is getting a post-from-chat
path anyway; ride that rather than inventing one. Revisit then — and see Step U.2, since this is one of
the four worked examples of the missing world object.

**Two shapes were floated in the tester thread and neither chosen:** a **hyperlink** shared into the
timeline that reopens the generated page, or a **screenshot** posted as an image so Noodle's captioning
describes it for readers. Characters with phones would share outward too, not just the user. Pick one
when the chat→Noodle path lands.

## Step 9.10 — Model who knows whom

**Decision:** `20-tester-feedback.md` §8, from the maintainer's own observation:

> "There is no system for 'does this character have this character's details'."

Mail is world-scoped with linked characters and user-added addresses, but **nothing tracks whether a
given character actually has another's address or number**. Everyone can contact everyone.

**Why it is scheduled here rather than parked:** it is invisible while *you* initiate every
conversation, and it becomes a visible continuity break the moment characters initiate — which is
exactly what Step 8.3 (unprompted texts), Step 9.2 (characters answering mail) and Step 11.4 (characters
calling you) all build. **This step must land before Step 11.4**, or the first thing the Calls app does
is have a stranger ring you having never been given your number.

**Build the smallest thing that works:** a per-phone contact directory recording which identities this
phone holds details for, and where that came from (met in scene, exchanged numbers, looked up in a
public listing, guessed). Generation for Mail, Messages and Calls consults it before letting a character
initiate contact.

**Keep it permissive.** A character who plausibly *could* find your number should be able to — the point
is that it's a story fact with a reason, not that it's locked down. An unknown number arriving is
fine and often good; an unknown number arriving *and the model not knowing it's unknown* is the bug.

**Interacts with Stage 10's asymmetric awareness** — a character knowing your number is a different fact
from a character seeing your phone. Don't conflate them.

---

# Stage 10 — Cross-character phone access as an RP event

**Decision:** `20-tester-feedback.md` §3 and `15-rp-integration.md` §6. The feature the tester reacted
hardest to.

Today the device switcher is a dev shortcut (labelled "Evil Stepsi…" in the screenshots). Intended:

- Another character's phone **unlocks only if the model judges you could plausibly get at it right
  now** — you took it, they handed it over, they left it on the table.
- **Being caught is a story event**: viewing someone's phone prompts a reaction from anyone who sees
  you, and the reaction accounts for *what you were looking at*.

Keep the dev switcher behind a dev flag.

**Also from `15-rp-integration.md` §1 — awareness is asymmetric, and this is deliberate:**
- **Your phone:** characters see it **only when you explicitly show it**. The existing
  `/chats/:chatId/phones/:phoneId/show` action stays the sole path. Nothing leaks.
- **Their phone:** a character gets ambient awareness of *their own* phone — their texts, their feed —
  injected into their prompt so they can reference it naturally.
- **Not** full ambient context of all phone state every turn. Too expensive for the payoff.

**Open, unresolved in the thread:** does a character see their own phone *gallery*? It's the expensive
one. Partial answer already available: photos taken during a scene are in short-term memory, so the main
LLM remembers them unaided — the gap is only photos from older sessions.

## Step 10.1 — Music and agent transport on the lock screen

**Decision:** `15-rp-integration.md` §5. If Music DJ is in the same chat, expose **simple transport
controls** — skip, volume — on the **lock screen** (two clicks: open phone, skip), reusing the lock
surface that already exists.

**Principle, and it applies to every agent the phone touches: the phone integrates *control* of other
agents, not their functionality.** Otherwise the phone becomes a container for every other agent — and
see the bundle-size constraint in `20-tester-feedback.md` §10.

---

# Stage 11 — Everything that needs an Engine change

**This is the last stage of real work, deliberately.** Nothing above depends on it. Every app in
Stage 9 has already shipped its unblocked half; this stage adds the halves that need the Engine.

**Do not start any of this until the contract lands.** It is an Engine-side change with a wider blast
radius than anything else here and it needs the maintainer's buy-in.

Everything deferred here, and where it came from:

| Deferred item | From | Needs |
|---|---|---|
| Camera: prompt → real generated image | Step 9.5 | `runtime.images.generate` |
| Gallery: read `chat_images`, prompts as captions | Step 9.4 | `chat_images` read access |
| Gallery: phone photos written to the chat gallery | Step 9.4 | write access |
| Goodle: Images tab + per-site image button | Step 9.1 | `runtime.images.generate` |
| Tindler: generated profile photos | `07-tindler.md` | `runtime.images.generate` |
| Calls: the entire app | Step 11.4 | call session access |
| Marketplace: the entire app | Step 11.5 | image policy in place first |

**The unblocked halves of the image policy — Step 11.2 (b) and (c) — do not belong to this stage.**
Build them during Stage 9, with the apps. They're what ships when the contract isn't there *or* when
the user has no image connection, which is a permanent state for many users, not a waiting room.

## Step 11.1 — Extend the contract (task zero for all image work)

**Decision:** `16-engine-interop.md` §0. Add to `CapabilityContext`:

- `runtime.images.generate(...)` — the Engine *has* an image pipeline
  (`sources/engine/packages/server/src/routes/generate/illustrator-references.ts`, NovelAI image
  connections, `illustratorPromptConnectionId` metadata) but **the package API does not expose it**.
  `languageModels.resolve().chatComplete()` returns text only.
- Read access to **`chat_images`** (path, prompt, provider, model, dimensions, per chat).
- **Conversation call sessions** (`conversation_call_sessions`).

## Step 11.2 — Image policy, platform-wide

**Decision:** `00-platform.md` §6. Build this *with* the first image feature, not after.

- **Per-app image toggles are mandatory** — not one global switch. Goodle is the exception: it gets the
  per-site button (Step 9.1) rather than a plain off switch, because a browser you can't see images in
  is odd flavour-wise.
- **No image connection ⇒ a designed empty state.** Copy the reference: on a real Google Images page
  with the network cut, **every result keeps its title and source** and only the picture is missing. So:
  caption-and-source always render, image area collapses to empty space. A phone with no image
  connection is a *fully working* phone. On top of that, the model fills each empty slot with **grey
  Unicode glyphs chosen to match** what the image would have been — costs nothing, marks the slot as
  deliberate.
- **Failed generation ⇒ show the prompt plus a retry button.** Noodle already surfaces the prompt on
  failure; the phone does that **and adds retry**, which Noodle lacks.

**Parts (b) and (c) are unblocked** — they're exactly what ships when the contract isn't there or the
user has no connection. Build them before 11.1 lands; they carry every image-dependent app in the
meantime. **Many users never configure an image connection at all.**

## Step 11.3 — Then, in order

- Camera step 3 — editable prompt → real generated image (Step 9.5).
- Gallery reading `chat_images`, prompts as captions (Step 9.4).
- Tindler generated profile photos (`07-tindler.md`).
- Goodle page images and the Images tab (Step 9.1).

## Step 11.4 — Calls, a new app (`17-calls.md`)

The Engine has a complete call model — status `ringing | active | ended | declined | missed`, mode
`audio | video`, **`initiator: user | character`** so characters can call *you*, plus a post-call
`summary` — and the device that should obviously surface it has no dialer. The most natural integration
in the codebase, and absent.

- **Dialer** — place a call to a contact.
- **Call log** — history including missed and declined.
- **Incoming call screen** — a ringing surface with accept/decline.

Use the existing session model; don't invent a parallel one. Declining from the phone writes `declined`;
not answering lands as `missed` — the states already carry story meaning.

**Prerequisites:** Step 11.1 (contract), Step 2.1 (registry — otherwise adding app #14 pays the
seven-site cost again), Step 5.1 (the incoming-call screen needs the phone reachable while closed), and
**Step 9.10** (or the first thing this app does is have a stranger call you having never been given
your number).

## Step 11.5 — Marketplace / classifieds

**Decision:** `20-tester-feedback.md` §6. The tester's framing: *"eBay or FB Marketplace type deal would
be funny. See what weird crap my characters are tryna sell."*

**Here rather than in Stage 9 because it is the app most dependent on images.** A marketplace of pure
text is a classifieds column — technically working, missing the point. Build it after Step 11.2 so
listings have pictures from day one.

**Build:** a listings feed scoped to the world, generated from the same context everything else uses.
Sellers are cast members and strangers. Tapping a listing opens a detail view. Goodle already has a
**`shop` page kind**, so the generation side largely exists — this is mostly a front-end over content
the phone can already produce, plus one registry entry (after Step 2.1) and an App Store entry.

**Two caveats, both real:**
- **n=1 and never confirmed as wanted by the maintainer**, unlike Banking (Appendix A.6). Cheap is not
  the same as warranted. Sanity-check with other testers first; if the answer is lukewarm, leave it.
- A fifteenth app is real bundle weight (Appendix A.1).

---

# Stage 12 — Closed decisions

Nothing is parked. Everything raised in the tester thread is scheduled somewhere above, each next to
the work that makes it cheap:

| Item | Where it went | Why there |
|---|---|---|
| Banking | **Step 7.6** | Same feature as 7.5 cross-chat persistence; free once that exists |
| Marketplace | **Step 11.5** | Goodle's `shop` page kind generates it, but it's the app most dependent on images |
| Who knows whom | **Step 9.10** | Must precede Calls (11.4) or strangers ring you for no reason |
| World object | **Step U.2** | Needs the maintainer; start day one, gates nothing |
| Contract extension | **Step U.1** | Same — the ask is slow, the code (Stage 11) is not |

These carry **caveats, not deferrals** — read the caveat on each before building. Two are n=1 asks
(Appendix A.6): Banking was independently wanted by the maintainer, Marketplace was not.

## The one thing genuinely decided *against*

**Availability outside a chat** (`20-tester-feedback.md` §7). The tester wanted to open the phone while
browsing Noodle rather than only from inside a chat. Both parties agreed chat-scoped is defensible —
*"the chats **are** the world"* — and it stays as-is.

**No change. Do not build it.** Recorded here because it will come up again, and the answer is that it
was considered and declined, not overlooked.

---

# Appendix A — Standing constraints

0. **Engine changes come last.** Nothing before Stage 11 may be gated on an Engine-side change landing.
   Each app ships its unblocked half in Stage 9 and its blocked half in Stage 11. If you are waiting on
   the Engine, you are in the wrong stage.
1. **Bundle size.** This ships as a downloadable agent package; every app, template and asset is weight
   a user downloads. Cutting Forum helps. Weigh new apps against it.
2. **The plan is almost entirely additive.** Stage 1 is the only subtraction across twenty design files.
   Prefer deleting.
3. **Cost per turn.** Once the agent runs per turn, every story turn potentially triggers phone
   generation. Low-probability gate plus cooldown, always.
4. **Off by default.** The agent must stay clearly optional.
5. **Degrade cleanly.** `listMessages`, `createMessageWithSwipe`, `listLorebooks`,
   `listEligibleLorebookEntries` and `languageModels` are all optional on the runtime.
6. **The evidence base is n=1.** One power user building a unified world across every ME surface, who
   flagged his own bias four times. The reversals in Stage 1 and Stage 5.2 are solid — the maintainer
   argued them independently and three of four *remove* work. **The additive asks are unvalidated.**
   Get more testers before building Step 7.6 (Banking) and Step 11.5 (Marketplace) in particular —
   both are scheduled on the strength of being *cheap*, which is not the same as being *wanted*.

# Appendix B — Suggested PR breakdown

One PR per numbered step is too granular; one per stage is too coarse for Stage 9. Suggested:

Stage U is not a PR — it's two conversations, opened on day one and running throughout.

| PR | Contents |
|----|----------|
| 1 | Stage 1 entire (all deletions together) |
| 2 | Step 2.1 (pure refactor, no behaviour change, bisectable) |
| 3 | Stage 3 (content limits + story window) |
| 4 | Stage 4 (bugs) |
| 5 | Stage 5 (device shell) |
| 6 | Stage 6 (Messages ↔ Engine) — coordinate, may be in flight |
| 7 | Steps 7.1–7.5 (lorebooks + owner phones + persistence) |
| 8 | Step 7.6 (Banking) — separate, because it's the one piece of Stage 7 that's an n=1 ask |
| 9 | Stage 8 (notifications + unprompted texts) |
| 10+ | One PR per app in Stage 9, including 9.10 (who knows whom) |
| last | Stage 11, once the contract lands — Calls and Marketplace are new apps, one each |

Each targets `staging`, links an issue, opens as draft, and carries the rebuild + both validator
outputs in the description.
