# Slurp Audit — Findings, Context Tiers, and Task Backlog

Audited at branch `bye-bye-birdie`, commit `9e26c275`, clean working tree.
Slurp package version `1.2.6` (`packages/slurp/manifest.json:5`).
Read-only audit. No files were changed.

Scope: Creator creation, text posting, image posting, and the adjacent
functionality that feeds them. Not a safety, privacy, legal, or uninstall review.

All paths below are relative to the repository root. Server package source lives
under `packages/slurp/src/engine/packages/server/src/` (abbreviated **SRV/**),
client source under `packages/slurp/src/engine/packages/client/src/`
(abbreviated **CLI/**).

Evidence labels used throughout:

- **[CS]** Confirmed by current source.
- **[RT]** Confirmed by regression test.
- **[RUN]** Confirmed by runtime evidence (tests actually executed).
- **[DI]** Documented intent — a comment or docstring says so.
- **[INF]** Inference.
- **[UNK]** Unknown.
- **[CF]** Conflict between sources.

---

## Part 1 — The direct answer: does each post and each image get the right information?

### 1.1 Short answer

**Text posts: yes, with four defects.** The prompt assembly is well built. Every
post receives the Creator identity, the stage voice, a disclosure-appropriate
view of the source card, the live conversation schedule, the clock, recent post
history, and a rotating variety beat. Four things are wrong: one prompt block is
dead, one is unprotected, Stories silently degrade on the scheduled path, and
the `teaser` format asks for something that never exists.

**Images: mostly, with one significant defect and one structural gap.** The
first image a post ever gets is assembled correctly. Every *retry* of that image
is assembled incorrectly — it silently drops prompt interpretation, style
guidance, and character context. Separately, persona-owned Creators can never
receive image references or character image instructions in any mode.

### 1.2 What a text post receives, by tier

The prompt is built by `buildNoodlerPostMessages`
(`SRV/services/slurp/slurp-generation.service.ts:339-410`). The source card
portion is selected by `resolveSlurpSourceCardContext` (`:310-337`), which picks
between two builders in `SRV/services/slurp/slurp-prompt-safety.ts`.

| Source field | Open | Hinted | Secret | Builder |
|---|---|---|---|---|
| Name | yes | **no** | **no** | `noodlerSourceText:66-80` vs `noodlerConcealedSourceText:54-64` |
| Description | yes | yes | yes | both |
| Personality | yes | yes | yes | both |
| Scenario | yes | **no** | **no** | full only |
| Appearance | yes | yes | yes | both |
| Backstory | yes | **no** | **no** | full only |

**[CS]** and **[DI]** — the docstring at `slurp-prompt-safety.ts:42-47` states the
rule plainly: *"Both concealed modes describe the same person, so they receive
the same seed and differ only in what the instructions forbid saying. Name,
scenario, and backstory are the googleable canon, so they stay out of both;
body, voice, and everyday texture are inseparable from the person and stay in."*

This is a deliberate, defensible design. It also means **Hinted and Secret
receive a byte-identical source card.** The only text difference between those
two tiers is the instruction line and the redaction token.

Non-source blocks, all tiers identical unless noted:

| Block | Source | Live or stored | Notes |
|---|---|---|---|
| Creator display name, handle, bio | account row | live | redacted for Hinted/Secret |
| Stage personality | `settings.privacy.stagePersonality` | live | redacted for Hinted/Secret |
| Disclosure instruction | `noodlerIdentityInstruction:120-135` | derived | **the only per-tier text difference** |
| Generation guidance | `settings.generationGuidance` | live | global, user-editable |
| Conversation schedule | Engine character `extensions.conversationSchedule` | **live every generation** | character-only; **not redacted — see D3** |
| Current + publication time | clock | live | |
| Post format instruction | format table `:71-80` | derived | |
| Recent post history (8 posts) | `slurp_posts` | live | includes prior image prompts, for anti-repetition |
| Story beat | `slurp-post-beat.ts` | derived | deterministic from account id + post count + `storyRate` |
| User direction | request | live | **suppresses the beat entirely** when present |
| Project direction | — | — | **dead block, no producer — see D1** |

Output-side identity protection: `protectNoodlerGeneratedIdentity:251-272`
rewrites the source name/handle to `you-know-who` (Hinted) or `someone`
(Secret), applied to generated content, title, and image prompt
(`:586-613`). Open is a pass-through. **[CS]**

### 1.3 What an image generation receives, by tier

Assembled in `SRV/services/slurp/slurp-images.service.ts:105-175`.

| Input | Open | Hinted | Secret | Evidence |
|---|---|---|---|---|
| Source appearance text | yes | yes | **yes** | `:130-139` — gated on `imageGenerationIncludeDescriptions` |
| Reference images (avatar / full-body sprite) | yes | yes | **no** | `:112-121` |
| Character personality | yes | yes | **no** | `:140-145`, inside the `referenceCharacter` branch |
| Character image instructions | yes | yes | **no** | `:140-145`, same branch |
| Identity redaction on prompt + negative prompt | no | yes | yes | `:86-97`, applied `:213-214, 245, 267` |
| Anonymity composition guard | no | no | **yes** | `:259-263` |

The anonymity guard is the load-bearing mechanism for Secret. Verbatim
(`:259-262`): *"Compose so the face cannot be identified: crop above the chin,
turn away from the camera, or obscure the face with hair, a hand, an object, or
shadow. Do not depict one-of-a-kind identifying marks such as a signature scar,
tattoo, species trait, or unusual anatomy."*

**[DI]** The reasoning is stated at `:133-136`: appearance text stays in every
tier because *"Reducing a concealed creator to a handful of approved tokens made
them shapeless without hiding anything linkable, since a build and a hair colour
identify nobody. Secret withholds the face and one-of-a-kind markers through the
composition guard below instead."*

**This is coherent and I judge it correct.** Secret hides the *face and unique
markers via composition*, not by making the body vague. But note the conflict in
D5 below: the user-facing copy does not say this.

### 1.4 The tier structure is sound; the labelling is not

Summarising the two tables above, the three tiers are genuinely three
different products:

- **Open** — full canon, real name, inherited source avatar and banner, no
  redaction anywhere.
- **Hinted** — no name/scenario/backstory, but same body, same references,
  recognisable on purpose.
- **Secret** — same as Hinted in text, minus references, plus a face-obscuring
  composition rule and a fully digested stored snapshot.

Secret is **not redundant**. It produces a materially different image and a
materially different on-disk record. My recommendation is to keep all three and
fix the copy (D5), not to collapse them.

---

## Part 2 — Defects, ranked

### P0 — Broken behaviour or a red build

**D0. The regression suite is red on a clean checkout. [RUN]**
Ran `npx tsx` over every `tests/slurp-*.regression.ts` and
`tests/noodler-*.regression.ts` at commit `9e26c275`: **58 pass, 5 fail.**

| Test | Cause |
|---|---|
| `noodler-content-formats.regression.ts:57` | Expects `format: "caption"` pinned in `SRV/services/slurp/slurp-reserve.operation.ts`. Code deliberately removed the pin (`:136-143`) with a comment explaining it defeated format variety. Test is stale. |
| `noodler-fictional-prices.regression.ts:46` | Expects `walletEnabled: false` as the shipped default. `SRV/services/storage/slurp.storage.ts:803` ships `walletEnabled: true`. |
| `slurp-lifecycle-safety.regression.ts:246` | Expects locked-media blur `scale-105 saturate-[0.82]`. Commit `9e26c275` shipped `scale-110 blur-[14px] saturate-[0.78]`. |
| `slurp-feed-layout.regression.ts:179` | Panel decoration assertion, changed by the same commit. |
| `slurp-inbox-wallet.regression.ts:55` | Expects locale key `ui.slurp.wallet.refillThreshold` to be referenced by `SlurpHome.tsx`. The key still exists (`en.json:2018`) but is now orphaned. |

Two of these encode real product decisions that shipped without being recorded:
automatic posts now vary their format, and the fictional economy is now on by
default. Someone needs to confirm both were intended, then update the tests.

**D1. Scheduled Stories never publish as Stories. [CS]**
`metadata.noodlerPostType = "story"` is only assigned on the image-committed
branch of `generateNoodlerPost`
(`SRV/services/slurp/slurp-generation.service.ts:813`). The scheduler always
calls with `prepareOnly: true`, which returns at `:645-653`, before that line.
Any Story produced on a schedule silently degrades to an ordinary post.
No test covers this.

**D2. Image retries silently drop interpretation, style, and character context. [CS]**
Every retry and manual-regenerate path resends the stored draft as
`promptOverride`. The guard at `slurp-images.service.ts:235` (`!input.promptOverride`)
then skips `rewriteNoodleImagePrompt` entirely, and `:266-268` takes the negative
prompt from the override rather than the compiled prompt. That skip is correct
for a *user-reviewed* prompt and wrong for *our own stored draft*. The first
attempt at an image and its retry therefore send materially different prompts.

Corroborating evidence: `SRV/routes/slurp.routes.ts:2163` passes
`retryStoredPrompt: true` into `generateReviewedImages`, whose input type
(`slurp-images.service.ts:352-356`) has no such field and which nothing reads.
The flag that would have distinguished the two cases was named but never wired.

### P1 — Wrong tier behaviour, missing context, broken workflow

**D3. The conversation schedule is the one prompt block that is never redacted. [CS]**
Every other user-message value in `buildNoodlerPostMessages` passes through
`protect()` (`slurp-generation.service.ts:355-356, 385-404`). The schedule block
at `:392` does not. A Conversation Schedule activity string containing the
source's real name leaks verbatim into a Hinted or Secret post prompt.

**D4. Disclosure default is inconsistent: one path says Hinted, thirteen say Secret. [CS] [CF]**
`SRV/services/slurp/slurp-commission-image.operation.ts:33` defaults an unset
`identityDisclosure` to `"hinted"`. Every other read defaults to `"secret"`
(`slurp-images.service.ts:395,467`; `slurp-artwork.operation.ts:53,129`;
`slurp-reserve.operation.ts:163`; `slurp.storage.ts:404,2250,2252,2271`;
`slurp-reply-generation.service.ts:135`; `slurp-message-generation.service.ts:158`;
`slurp.routes.ts:2680,2729,2790`). A Creator with no configured mode gets
reference images and no anonymity guard on a paid commission, and neither on
anything else. The file's own docstring (`:229-231`) claims commissions follow
"the same identity redaction and disclosure rules as any other Slurp image",
which contradicts its default.

**D5. The Secret user-facing copy contradicts the Secret implementation. [CF]**
`CLI/localization/locales/en.json:370-371` promises *"a separate persona with no
intended source connection"* and *"only a reduced, non-identifying inspiration
brief"*. The actual Secret system prompt
(`slurp-stage-profile-draft.service.ts:73`) says the opposite: *"This is the same
person as the source… They are not a different person and not a vaguer one."*
Secret also still sends full source appearance to the image provider (§1.3).
The implementation is defensible; the copy describes a design that no longer
exists.

**D6. The privacy core has zero behavioural test coverage. [CS]**
Nothing executes `redactIdentity` or asserts that a Secret Creator receives the
anonymity guard. `tests/noodler-disclosure-contract.regression.ts` covers the
Hinted branch, but only by grepping source text (`:138-140, 146-149, 155`), and
covers Secret only for snapshot digesting. The Secret prompt strings, the
`# Anonymous alias brief` header, and the entire image guard are unasserted.
This is the highest-consequence untested logic in the feature.

**D7. `teaser` asks the model for a hook to a post that never exists. [CS]**
`teaser` is unreachable from the composer (`CLI/components/slurp/SlurpHome.tsx:6216-6223`
derives only `caption | announcement | long_form`; `tests/noodler-content-formats.regression.ts:61`
locks this). It can only arise from the automatic beat rotation
(`slurp-post-beat.ts:87-96`), and the automatic path passes no `lockedFollowUp`
(`slurp-reserve.operation.ts:135-144`). So the instruction at
`slurp-generation.service.ts:74-75` tells the model to leave a reason to open a
linked locked post that is never created.

**D8. Locked follow-up posts are fully implemented and unreachable. [CS]**
Honoured at `slurp-generation.service.ts:615-690` and
`slurp-post.operation.ts:243-296`, typed in `CLI/hooks/use-slurp.ts:1108-1109`,
but no route schema accepts the field — zod strips it — and no UI sets it.

**D9. Automatic posts get one model attempt; foreground posts get two. [CS]**
`slurp-generation.service.ts:559` — `if (input.prepareOnly) throw error;` skips
the correction turn. Undocumented, untested, and it means scheduled posts fail
on malformed output where a manual post would recover.

**D10. `slurp-pending-text.service.ts` has no fallback connection and no admission control. [CS]**
It calls `createLLMProvider` bare (`:135-145`), unlike every other Slurp text
path. `tests/slurp-generation-connection.regression.ts:45-57` does not list it.

### P2 — Quality, cost, maintainability

**D11. Five dead server files. [CS]**

| File | Status |
|---|---|
| `SRV/services/slurp/slurp-public-generation.service.ts` | No importers. Confirmed independently twice. |
| `SRV/services/slurp/slurp-public-prompt.service.ts` | Only importer is the file above. |
| `SRV/services/slurp/slurp-generation-log.ts` | Only importer is the file above. |
| `SRV/services/noodle/noodle-prompt.ts` | Zero importers; byte-identical to the Engine host file of the same name. |
| `SRV/services/slurp/slurp-context.ts` | Zero importers. |
| `SRV/services/slurp/slurp-profile-avatar.ts` | Zero importers; duplicate of `packages/noodle/.../noodle-profile-avatar.ts`. |

Three regression tests assert against the *text* of dead files
(`tests/slurp-connection-load.regression.ts:82,93`,
`tests/slurp-lifecycle-safety.regression.ts:30`). They will pass forever
regardless of runtime behaviour.

**D12. `noodlerProjectWork` is a dead prompt block. [CS]**
Built into every post prompt (`slurp-generation.service.ts:346, 402-404`) with
no producer anywhere in client or server.

**D13. 43 orphaned locale keys. [CS]**
Strict scan — neither the full key nor any parent prefix appears anywhere in
`CLI/`. All legacy Noodle-era: `ui.noodle.ambientProfiles.*` (20),
`ui.noodle.creatormanagement.*` (20), `ui.noodle.mobiletimelinebackbutton.*` (2),
`ui.noodle.scheduler.retryAt`. Note: Slurp's *own* source-change UI is live and
correct at `CLI/components/slurp/SlurpSettings.tsx:1249-1294` under
`ui.slurp.settings.creators.*` — the dead keys are the old Noodle equivalents,
not a missing feature.

**D14. Deletion cascades are inconsistent. [CS]**
`deleteNoodlerAccount` / `deleteAccountByEntity` cascade posts, interactions,
unlocks, subscriptions, reply claims, prepared posts, threads, and messages —
but not `slurp_commissions`, `slurp_audience_ties`, `slurp_population`,
`slurp_pending_text`, or `slurp_events`. `slurp_population` and
`slurp_audience_ties` have **no deletion path anywhere**, not even in the
full-reset `deleteAllSlurpData`.

**D15. Post edit re-truncates to a flat 4000 characters. [CS]**
`SRV/services/storage/slurp.storage.ts:4072` ignores the post's own
`noodlerContentFormat` cap, so a 300-character caption can be edited to 4000.

**D16. Persona-owned Creators can never receive image references. [CS]**
`slurp-images.service.ts:116-121` requires `linkedPublicAccount?.kind === "character"`
for `referenceCharacter`. A persona's appearance text still flows through
(`:123-137`), but personality, image instructions, and reference images never do,
in any disclosure mode. This may be correct — personas have no gallery and often
no avatar — but it is undocumented and untested, and it means the Open tier means
something different for a persona than for a character.

**D17. No image-format sniffing on generated bytes. [CS]**
Uploads are magic-byte verified (`isAllowedImageBuffer`). Generated images trust
the provider's `image.ext` straight into the filename
(`slurp-images.service.ts:332`). `packages/noodle` has a format module for this;
Slurp has no equivalent.

### P3 — Polish

**D18.** Client duplicates the disclosure rank table
(`CLI/components/slurp/SlurpHome.tsx:1286-1290` vs
`SRV/services/slurp/slurp-disclosure.ts:3-7`) with no shared constant and no test.

**D19.** `en.json` has no `ui.noodle.noodlerpostcomposer.format.teaser` key
though `ko.json` and the format enum both include it.

**D20.** The source snapshot is re-minimised and rewritten on every stage-profile
save, not only when the source actually changed. Write churn, not a bug.

---

## Part 3 — Task list for other agents

Each task is self-contained. Do them in order within a priority band. Every task
assumes a read of the cited lines first.

### T1 — Get the build green (P0, blocks everything else)

1. Decide, with the maintainer, whether `walletEnabled: true`
   (`SRV/services/storage/slurp.storage.ts:803`) is the intended shipped default.
   Then either flip it back or update `tests/noodler-fictional-prices.regression.ts:46`.
   **Do not guess — this is a product decision.**
2. Update `tests/noodler-content-formats.regression.ts:57` to match the
   deliberate removal of the pinned `caption` format in
   `SRV/services/slurp/slurp-reserve.operation.ts:136-143`. Add an assertion
   that the reserve path passes *no* format, which is the actual contract now.
3. Update the three UI assertions to the shipped values:
   `tests/slurp-lifecycle-safety.regression.ts:246`,
   `tests/slurp-feed-layout.regression.ts:179`,
   `tests/slurp-inbox-wallet.regression.ts:55`.
4. Remove the orphaned key `ui.slurp.wallet.refillThreshold`
   (`CLI/localization/locales/en.json:2018`) and its translations, or re-reference it.

Verify with: `for t in tests/slurp-*.regression.ts tests/noodler-*.regression.ts; do npx tsx "$t" || echo "FAIL $t"; done`

### T2 — Fix scheduled Stories (P0)

Move the `metadata.noodlerPostType = "story"` assignment
(`SRV/services/slurp/slurp-generation.service.ts:813`) so the prepared-post
payload carries the story flag through the `prepareOnly` return at `:645-653`.
Then confirm `publishDueNoodlerPreparedPosts`
(`SRV/services/storage/slurp.storage.ts:3110`) preserves it into the published row.

Regression test to add: prepare a post with `storyRate` forcing a story beat,
assert the prepared payload carries `noodlerPostType: "story"`, publish it,
assert the published row still has it.

### T3 — Fix image retry context loss (P0)

In `SRV/services/slurp/slurp-images.service.ts`, distinguish "user-reviewed
override" from "system retrying its own stored draft". The parameter name is
already chosen: wire `retryStoredPrompt` into the input type at `:352-356` and
make the interpretation guard at `:235` and the negative-prompt selection at
`:266-268` respect it. Then either use it at `SRV/routes/slurp.routes.ts:2163`
or remove the flag from that call.

Affected paths: review confirmation, manual generate-image, and
`retryNextFailedPostImage` (`:516-529`).

Regression test to add: assert a retry with a stored prompt still runs the
compiler and, when interpretation is enabled, still calls the rewrite.

### T4 — Redact the schedule block (P1)

Wrap the schedule value at
`SRV/services/slurp/slurp-generation.service.ts:392` in the same `protect()`
used for every other user-message field at `:385-404`.

Regression test to add: a Hinted Creator whose Conversation Schedule contains
the source display name must not emit that name in the built prompt.

### T5 — Unify the disclosure default (P1)

Change `SRV/services/slurp/slurp-commission-image.operation.ts:33` from
`?? "hinted"` to `?? "secret"`, matching the other thirteen sites.

Better still: export a single `resolveDisclosureMode(account)` helper from
`SRV/services/slurp/slurp-disclosure.ts` and route all fourteen call sites
through it, so the default cannot drift again. Add a test asserting the helper's
default is `"secret"`.

### T6 — Test the privacy core (P1, highest value single task)

Add a behavioural test matrix over the three disclosure modes asserting:

- `redactIdentity` strips display name, handle, and entity id from the compiled
  prompt, the provider prompt, and the negative prompt for Hinted and Secret,
  and does nothing for Open (`slurp-images.service.ts:86-97`).
- The anonymity guard string is present for Secret and absent for Open and
  Hinted (`:259-263`).
- Reference images are resolved for Open and Hinted, and empty for Secret
  (`:112-121`).
- `protectNoodlerGeneratedIdentity` replaces with `you-know-who` for Hinted and
  `someone` for Secret, handles a leading `@`, respects word boundaries, and
  collapses a `Name (@handle)` pair (`slurp-generation.service.ts:251-272`).

These must **execute** the functions, not grep the source. The existing
disclosure test is mostly source-text greps and is why these gaps survived.

### T7 — Fix the Secret copy (P1)

Rewrite `ui.noodle.disclosure.secret.detail` and `.guidance`
(`CLI/localization/locales/en.json:370-371`) plus the wizard variants at
`:992-993` to describe what Secret actually does:

> Same person, anonymous alias. Their body, voice, and daily life carry over in
> full. The source name, handle, canonical facts, and source image references
> never do, and generated images are composed so the face and any one-of-a-kind
> markers stay hidden.

Mirror into `de.json`, `ko.json`, `pl.json`. Then reword `:1018` if needed.

### T8 — Resolve teaser and locked follow-ups (P1)

One product decision, two possible tasks:

- **If teasers should be a real feature:** add `lockedFollowUp` to the post
  create route schema, surface it in the composer, and remove the exclusion at
  `tests/noodler-content-formats.regression.ts:61`.
- **If not:** remove `teaser` from the beat rotation
  (`SRV/services/slurp/slurp-post-beat.ts:87-96`), remove the follow-up branches
  at `slurp-generation.service.ts:615-690` and
  `slurp-post.operation.ts:243-296`, and drop `teaser` from the format enum.

Do not leave it as it is. Right now the model is instructed to write a hook to
content that cannot exist.

### T9 — Dead code sweep (P2)

Delete, after re-confirming zero importers at the time of deletion:

- `SRV/services/slurp/slurp-public-generation.service.ts`
- `SRV/services/slurp/slurp-public-prompt.service.ts`
- `SRV/services/slurp/slurp-generation-log.ts`
- `SRV/services/noodle/noodle-prompt.ts`
- `SRV/services/slurp/slurp-context.ts`
- `SRV/services/slurp/slurp-profile-avatar.ts`

Then rewrite or delete the three tests that assert against their text:
`tests/slurp-connection-load.regression.ts:82,93`,
`tests/slurp-lifecycle-safety.regression.ts:30`. Those assertions must be
re-pointed at the live equivalents, not simply removed, or real coverage is lost.

Also remove the dead `noodlerProjectWork` block
(`slurp-generation.service.ts:346, 402-404`) unless a producer is being added.

**Keep:** `slurp-public-images.service.ts` and `slurp-public-support.ts` are
active shared helpers. `slurp-public-profiles.service.ts` is half-live — its
`resolveNoodlerCreatorArtwork` is used by Creator artwork inheritance; only
`generateMissingNoodleProfiles` is dead. Ambient profiles, population, world,
and garnish files are all **active** via `SRV/services/slurp/server-entry.ts`
scheduler registrations. Do not delete those.

### T10 — Locale cleanup (P2)

Remove the 43 strictly-orphaned `ui.noodle.*` keys and their translations.
Reproduce the list with a scan that treats a key as live if the full key **or any
parent prefix of three or more segments** appears in `CLI/` — this avoids false
positives from dynamically constructed keys such as
`ui.noodle.disclosure.${mode}.label`.

### T11 — Deletion cascades (P2)

Extend `deleteNoodlerAccount` and `deleteAccountByEntity` in
`SRV/services/storage/slurp.storage.ts` to cascade `slurp_commissions`,
`slurp_pending_text`, `slurp_events`, and `slurp_audience_ties` for that
account. Give `slurp_population` an orphan sweep — it currently has no deletion
path in any code path including full reset.

### T12 — Smaller fixes (P2/P3)

- Cap post edits to the post's own format limit rather than a flat 4000
  (`SRV/services/storage/slurp.storage.ts:4072`).
- Give `slurp-pending-text.service.ts` the fallback and admission wrappers every
  other text path has (`:135-145`).
- Decide and document the one-attempt vs two-attempt asymmetry at
  `slurp-generation.service.ts:559`.
- Share one disclosure rank constant between `slurp-disclosure.ts:3-7` and
  `SlurpHome.tsx:1286-1290`.
- Add `ui.noodle.noodlerpostcomposer.format.teaser` to `en.json`, or drop teaser
  per T8.
- Document, and ideally test, that persona-owned Creators never receive image
  references (D16). If that is wrong, fix `slurp-images.service.ts:116-121`.

---

## Part 4 — Open product decisions

These need a human answer before the related tasks can be done correctly.

1. **Is the fictional economy meant to be on by default?**
   `walletEnabled: true` contradicts a still-present test asserting it must ship off.
2. **Should teasers and locked follow-ups be a real user-facing feature,
   or be removed?** Both are half-built today.
3. **Should persona-owned Creators behave differently from character-owned ones
   in image generation?** They already do, silently.
4. **Keep three disclosure tiers?** My recommendation: **yes, keep all three.**
   Secret produces a genuinely different image and a genuinely different stored
   record. The complaint that Secret feels redundant is, I believe, a symptom of
   D5 — the copy describes a mode that does less than the code actually does.
   Fix the copy before considering removal. If the concern is instead that
   "Hinted" is an unclear name, renaming the label is nearly free: the wire value
   can stay `hinted` and only locale strings change.
5. **Can one Engine source hold both a public Noodle account and a Slurp
   Creator?** **[UNK]** Both rows are written with `platform: "slurp"` and
   identical `sourceKind`/`sourceEntityId`, which the unique index at
   `SRV/db/schema/slurp.ts:31-36` should reject, yet the schema comment at
   `:22-27` describes `visibility`/`publicAccountId` as unread rollback mirrors.
   Static reading cannot settle this. Needs a runtime check against a live
   Engine before anyone relies on either answer.

---

## Appendix — How to reproduce the runtime evidence

```sh
cd /home/dev/.paseo/worktrees/0vl25jsh/mean-shark
for t in tests/slurp-*.regression.ts tests/noodler-*.regression.ts; do
  npx tsx "$t" >/dev/null 2>&1 || echo "FAIL: $t"
done
```

At commit `9e26c275` this prints five failures, listed in D0.

Orphaned-locale scan, from `CLI/`:

```sh
node -e '
const fs=require("fs");
const en=JSON.parse(fs.readFileSync("localization/locales/en.json","utf8"));
const files=require("child_process").execSync("find . -name \"*.ts\" -o -name \"*.tsx\"").toString().trim().split("\n");
const blob=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const orph=Object.keys(en).filter(k=>/^ui\.(slurp|noodle)/.test(k)).filter(k=>{
  if(blob.includes(k))return false;
  const p=k.split(".");
  for(let i=p.length-1;i>=3;i--) if(blob.includes(p.slice(0,i).join(".")))return false;
  return true;});
console.log(orph.length); console.log(orph.join("\n"));'
```

---

# Part 5 — Prompt design review (second pass, deep read)

This section supersedes nothing above; it adds a conceptual review of the actual
prompt text, which the first pass traced structurally but did not critique.

## 5.1 The stage-voice contract is never stated to the model that writes it

**[CS]** The draft system prompt
(`SRV/services/slurp/slurp-stage-profile-draft.service.ts:99-107`) says only:

> "Create one editable Slurp creator profile draft.
> Return JSON only with displayName, handle, bio, stagePersonality, and disclosureMode.
> Make the profile concise and usable for future Slurp post generation. Follow the disclosure rules exactly."

`stagePersonality` is never defined. The model is asked to emit a field with no
description of what it is for.

Meanwhile the post prompt (`slurp-generation.service.ts:367`) tells the *posting*
model exactly what it is:

> "The source character is who this Creator actually is: take their temperament,
> register, humour, and interests from it. The stage voice describes how they
> perform on Slurp and how they treat the people reading, layered over that
> person, not a replacement for them."

So the field's contract exists only at the consumption end. The production end is
guessing. The predictable result is a `stagePersonality` that restates the source
personality instead of describing a *performance* — which then makes the post
prompt's careful "person vs. performance" layering collapse into the same trait
list stated twice.

**This is the single highest-leverage prompt fix in the feature.** Everything
downstream — post variety, tone, the difference between two Creators built from
similar characters — rests on this field.

**Fix:** put the layering sentence into the draft system prompt too, and give
`stagePersonality` an explicit brief: how they address readers, posting habits,
recurring bits, what they are like *as a poster* — not who they are as a person,
which the source card already supplies live at post time.

## 5.2 The concealment instruction and the concealment validator disagree

**[CS]** This is a concrete, reproducible defect.

The Hinted brief says (`slurp-stage-profile-draft.service.ts:80`):

> "Never use the source name or handle, and never copy four or more consecutive
> words from the text below."

The validator is `stageProfileContainsSourceDetails`
(`slurp-generation.service.ts:219-247`). It normalises through
`normalizedDisclosureWords` (`:212-218`), which **drops every word shorter than
four characters** before checking 4-grams.

So "four consecutive words" in the prompt means *four consecutive words*, and
"four consecutive words" in the validator means *four consecutive content words
after stopword removal*. Those are very different rules.

Worked example. Source description: `"Mari is a tall woman who works in a busy
coffee shop near the river"`. Normalised: `works busy coffee shop near river`.
A model that dutifully paraphrases to *"works at a busy coffee shop"* normalises
to `works busy coffee shop` — and trips the 4-gram check. The model obeyed the
instruction it was given and still failed.

**Consequences:**
- Draft rejected → single-create returns **400**, bulk-create reports the Creator
  as **skipped**. The user sees "creation failed" with no idea why.
- The failure is *more* likely the more faithfully the model follows the brief,
  because faithful paraphrase preserves content words and drops stopwords.

**And Secret is held to a stricter version of a rule it is never told.** The
Secret brief (`:70-77`) contains **no** 4-gram instruction at all, yet the
validator checks Secret against **six** source fields including `personality`
(`:234`), where Hinted is checked against five. Secret is the tier most likely to
fail creation, for a rule that was never communicated to it.

**[INF]** This is my leading explanation for why Secret feels unreliable or
pointless in practice: it is not that the mode does too little, it is that
creating one fails more often and opaquely.

**Fix, in order of value:**
1. Add the 4-gram rule to the Secret brief, worded to match the validator:
   *"Do not reuse four or more of the source's distinctive words in sequence,
   ignoring short connecting words."*
2. Make the rejection message name the offending field and the matched phrase,
   so the user and the correction turn can act on it. Right now the correction
   turn is not even invoked for this class of failure — the draft is rejected
   after parsing, not during it.
3. Consider softening the validator for `description`/`appearance`, where shared
   vocabulary is close to unavoidable, and keeping it strict for `name` and
   `backstory`, which are the actual lookup risk.

## 5.3 The post prompt has a structural seam

**[CS]** `buildNoodlerPostMessages:383-405` emits, with no separator:

```
# Source character
<source card>
<schedule line>
Content format: caption

# Publication timing
```

Two problems:

1. **The schedule and the format directive sit inside the `# Source character`
   section.** The format line is a generation directive, not a property of the
   character, and it is already stated in the system prompt via
   `NOODLER_FORMAT_PROMPTS`. It is duplicated *and* misfiled.
2. **The schedule has no header and no instruction attached.** Nothing tells the
   model what to do with it. The nearest instruction — `DAY_PLACEMENT_INSTRUCTION`
   in `slurp-post-timing.ts:13` — lives in the `# Publication timing` block
   *below* it and refers to "that hour and weekday", which is in a different
   section again. The two halves of one idea are separated by a section boundary.

**Fix:** give the schedule its own `# Today's schedule` header directly above the
timing block, drop the duplicated `Content format:` line, and move
`DAY_PLACEMENT_INSTRUCTION` to sit with the schedule it refers to.

## 5.4 The schedule line leaks the source name in Hinted and Secret

**[CS]** Confirmed mechanism, upgrading D3 from "unredacted block" to a specific
named leak.

`buildSlurpCreatorScheduleContext` (`SRV/services/slurp/slurp-creator-schedule-context.ts:115`)
builds:

```
Current Conversation Schedule for ${source.displayName} (${localDate}): 08:00: gym, ...
```

`source.displayName` is the **source character's real display name**. That string
is inserted at `slurp-generation.service.ts:392` **without** `protect()`, while
every neighbouring field on lines `385-404` is protected.

So every post generated for a Hinted or Secret Creator whose character has an
active Conversation Schedule sends the source's real name to the text model, in
the same prompt that instructs the model never to write that name.

**Fix:** wrap line 392 in `protect()`. Better: stop putting the name in the string
at all — the model already knows whose schedule it is from context, so
`slurp-creator-schedule-context.ts:115` can drop the `for ${source.displayName}`
clause entirely and the leak closes at the source for every consumer.

## 5.5 Generation guidance is injected into the system prompt unlabelled

**[CS]** `slurp-generation.service.ts:368` splices the user's free-text
`generationGuidance` directly into the system array between two hard rules, with
no delimiter. Up to 20,000 characters (`slurp.storage.ts:231`) of user text
becomes indistinguishable from the system's own instructions.

The ordering is defensible — guidance first, hard rules after, so the rules take
recency — but the model cannot tell where guidance ends. Long guidance will blur
into the disclosure instruction that follows it.

**Fix:** wrap it, e.g. `## Creative direction` … `## End creative direction`, or
move it to the user message as a labelled block. The untrusted-content rule at
`:362` already establishes this pattern for user-message values; the system
message should not be the one place it is abandoned.

## 5.6 The image path violates the image template's stated contract

**[CS]** **[CF]** This is the architectural flaw in the image pipeline.

The Engine template `NOODLE_IMAGE_POST`
(`sources/engine/packages/server/src/services/prompt-overrides/registry/noodle.ts:31-82`)
documents itself as terminal:

> "Everything this produces is sent to the image model verbatim — **no LLM pass
> runs after it**."

and its default builder emits **bare values, no labels**, with the comment:

> "Bare values only: labels and 'let these traits influence...' framing are
> instructions to a language model, and **nothing downstream re-reads this
> string** — it goes to the image model."

Both statements are false in Slurp. `slurp-images.service.ts:213` sets
`rawFinalPrompt` from `compiledPrompt.prompt` — the rendered template — and
`:238-244` passes exactly that into `rewriteNoodleImagePrompt` as
`<original_image_prompt>`. **A language model does re-read it.**

Downstream consequences, all confirmed in source:

1. **The character context is sent twice.** `characterDescription`,
   `characterPersonality`, and `characterImageInstructions` are concatenated into
   the template output (`registry/noodle.ts:72-79`) *and* assembled again into a
   separate `characterContext` block (`slurp-images.service.ts:225-231`) passed as
   `<character_context>`. The rewriter receives the same three values in two
   places, one labelled and one bare.
2. **The rewriter is told to preserve non-visual text.** Its system prompt says
   *"Preserve the original subject, identity, action, setting, and visual facts"*
   (`slurp-image-prompt-rewrite.ts:70`). The "original" it is handed contains a
   personality trait list, which is not a visual fact. The model is being asked
   to preserve something the next stage will reject it for keeping.
3. **The leak detector exists to catch the symptom.** `hasInternalMarker`
   (`slurp-image-prompt.ts:29-32`) greps the rewriter's output for labels like
   `personality:`, `character_context:`, `post_text:`. Those labels can only
   appear because the rewriter was fed labelled internal structure in the first
   place.
4. **Rejection causes a silent quality cliff.** When the output is rejected,
   `selectNoodleImageProviderPrompt` falls back to `rawPrompt`, which
   `slurp-images.service.ts:214` defines as `compiledDraft?.prompt || draftPrompt`
   — **the bare visual draft with the appearance, personality, and image-habit
   blocks dropped entirely**. So a leak-rejection does not degrade to "the full
   template unchanged"; it degrades to "the character's appearance is gone".
   The comment at `:200-202` shows the author noticed the style profile was lost
   here and fixed that — but the appearance loss is still there.

**Fix (this is the clean one):** feed the rewriter the **draft prompt** as
`<original_image_prompt>`, not the rendered template. The character context
already travels in its own labelled block, which is the correct channel for it.
Then the "original" contains only visual intent, "preserve the original" becomes
a true instruction, `hasInternalMarker` becomes a backstop rather than a
load-bearing filter, and the rejection fallback stops being a downgrade because
the fallback and the input are then the same class of text.

## 5.7 The character context reaches the interpretation model unredacted

**[CS]** `rawFinalPrompt` is redacted before the rewrite
(`slurp-images.service.ts:213`). `characterContext` and `imagePromptInstructions`
are **not** (`:225-231`, passed at `:242-243`).

`characterDescription` is frequently `referenceResolution.appearanceBlock`
(`:166`), which `illustrator-references.ts:400` formats as:

```
${name}'s Appearance: ${appearance}
```

and the `name` passed in is `referenceCharacter.displayName`
(`slurp-images.service.ts:154`) — the **linked source account's real display
name**. So for a Hinted Creator, the interpretation model receives
`"Mari's Appearance: ..."` inside `<character_context>`, in the same call whose
`<original_image_prompt>` had "Mari" carefully replaced with `[redacted]`.

The final provider prompt *is* redacted afterwards (`:245`), so the image itself
is protected. The inconsistency is in which model sees the name, and it defeats
the purpose of redacting the prompt beside it.

**Fix:** run `redactIdentity` over `characterContext` and
`imagePromptInstructions` before the rewrite call, or pass the stage display
name rather than the source display name into `chatCharacters[].name` at `:154`.

## 5.8 Smaller prompt defects

- **[CS]** The draft model is asked to return `disclosureMode`
  (`slurp-stage-profile-draft.service.ts:102`) and the parser then strips it
  (`:123`, `.omit({ disclosureMode: true })`). It is a mode the *caller* already
  chose. Asking for it invites the model to second-guess a decision it does not
  own. Remove it from the requested JSON.
- **[CS]** In Open mode the model is instructed to use exact name and handle
  (`:40`) and the code overwrites both afterwards (`:255-261`). Two of the four
  generated fields are discarded. For Open, the draft call could request `bio`
  and `stagePersonality` only.
- **[CS]** Open sends `Public name:` (`:88`) and then `Name:` again inside
  `noodlerSourceText` (`slurp-prompt-safety.ts:73`). Duplicated in the same block.
- **[CS]** A user-directed post suppresses the beat entirely
  (`slurp-generation.service.ts:503-505`), which also suppresses `beat.story`.
  Combined with the scheduled-Story defect (D1), **there is no path by which a
  user can deliberately request a Story with direction.** Stories only occur
  un-directed and un-scheduled.
- **[CS]** The beat is derived from the *live* post count
  (`slurpPostBeat(account.id, count, storyRate)`, `:505`). Deleting a post shifts
  every future beat. Minor, but it means the rotation is not stable history.

## 5.9 What is genuinely well designed (do not "fix" these)

Stated plainly so a later agent does not undo good work:

- **The concealed-source seed rule.** One builder, one docstring, name/scenario/
  backstory withheld and body/voice/texture kept
  (`slurp-prompt-safety.ts:42-64`). This is the right cut, and the reasoning is
  correct: a build and a hair colour identify nobody.
- **Concealment by composition, not by vagueness.** The Secret anonymity guard
  (`slurp-images.service.ts:259-263`) hides the face and unique markers through
  framing instead of making the body generic. This is a genuinely good creative
  insight and it is what makes Secret worth keeping.
- **The anti-repetition rule.** `:376` constrains *situation*, not wording, with
  the reasoning recorded. This is the fix for the failure mode that actually
  occurs.
- **The beat system.** Co-prime strides over place/moment/framing/company
  (`slurp-post-beat.ts:160-172`) so the axes do not resynchronise, plus
  "directions to vary along, not a scene to copy" (`:187`). Well thought through.
- **Day placement.** `DAY_PLACEMENT_INSTRUCTION` (`slurp-post-timing.ts:13`) with
  its docstring explaining why the clock alone was not enough. Cheap and correct.
- **Rewrite failure is soft.** `rewriteNoodleImagePrompt` returns `null` on any
  error and the caller falls back (`slurp-image-prompt-rewrite.ts:106-109`). The
  optional second LLM pass can never block an image.

---

# Part 6 — Additional tasks from the prompt review

### T13 — Define `stagePersonality` where it is generated (P1, highest value)

Add the person-vs-performance layering sentence from
`slurp-generation.service.ts:367` to the draft system prompt at
`slurp-stage-profile-draft.service.ts:99-107`, plus an explicit brief for the
field. Suggested addition:

> "stagePersonality is the performance, not the person. Describe how they post:
> how they address readers, their recurring habits and bits, their register and
> pacing on a feed. Do not restate the source character's traits — those are
> supplied separately whenever a post is written."

Regression test: assert the draft system prompt names `stagePersonality` and
contains the word "perform".

### T14 — Reconcile the 4-gram rule with its validator (P1)

1. Add the 4-gram rule to the Secret brief
   (`slurp-stage-profile-draft.service.ts:70-77`).
2. Reword both briefs to match `normalizedDisclosureWords` semantics — content
   words, short connecting words ignored.
3. Make the rejection at `slurp.routes.ts:2445-2456` and the bulk skip at
   `:2564-2574` report which field and which phrase matched.
4. Consider narrowing the validator's field set for `description`/`appearance`.

Regression test: a faithful paraphrase that preserves content-word order must
either pass, or fail with a message naming the phrase.

### T15 — Fix the post prompt structure (P2)

In `buildNoodlerPostMessages:383-405`: give the schedule its own header, remove
the duplicated `Content format:` line, and relocate `DAY_PLACEMENT_INSTRUCTION`
next to the schedule.

### T16 — Close the schedule name leak (P1)

Drop `for ${source.displayName}` from
`slurp-creator-schedule-context.ts:115`, and wrap
`slurp-generation.service.ts:392` in `protect()` as a backstop. See T4, which
this supersedes with a specific mechanism.

### T17 — Feed the rewriter the draft, not the template (P1)

Change `slurp-images.service.ts:238-244` to pass the compiled **draft** prompt as
`prompt`, leaving character context in its own block. Re-check that
`selectNoodleImageProviderPrompt`'s fallback (`:214`) is then equivalent in kind
to its input. Expect `hasInternalMarker` rejections to fall sharply.

Regression test: assert the rewriter's `<original_image_prompt>` does not contain
the personality string.

### T18 — Redact the character context before the rewrite (P1)

Apply `redactIdentity` to `characterContext` and `imagePromptInstructions` at
`slurp-images.service.ts:225-231`, or pass the stage display name at `:154`.

Regression test: for a Hinted Creator, no argument to `rewriteNoodleImagePrompt`
contains the source display name.

### T19 — Prompt hygiene batch (P2/P3)

- Wrap `generationGuidance` in a labelled block (`slurp-generation.service.ts:368`).
- Stop requesting `disclosureMode` from the draft model
  (`slurp-stage-profile-draft.service.ts:102`).
- For Open, request only `bio` and `stagePersonality`.
- Remove the duplicated `Public name:` / `Name:` in the Open source block.
- Decide whether a directed post should be allowed to be a Story
  (`slurp-generation.service.ts:503-505`).
