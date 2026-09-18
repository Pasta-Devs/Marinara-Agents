# Slurp Invited Character Audience Plan

Let Engine characters join the Slurp 2 audience as fans. They like, comment, follow, subscribe, tip, commission, and open DM threads with Creators, driven by the fan-activity prompt and the world tick, in their own voice.

**Target:** slurp2 0.0.22 (current shipped version is 0.0.21), delivered in slices, one commit per slice.

## Status

| Slice | What                                                                         | State |
| ----- | ---------------------------------------------------------------------------- | ----- |
| 1     | Settings: `audienceCharacters` map, zod schema, defaults, user-set cap       | todo  |
| 2     | Storage: provision and list character-backed audience accounts               | todo  |
| 3     | Cast: character fans in the fan-activity draw and the world pool             | todo  |
| 4     | Identity: squeeze character copy into voice, traits, tone                     | todo  |
| 5     | Ties: account ids in the funnel, touch guard, subscription and spend         | todo  |
| 6     | Fan card: character avatar, voice excerpt, stage, spend                      | todo  |
| 7     | Messaging world: world-initiated threads for character fans                  | todo  |
| 8     | Messaging resolve: recover character from `character-fan:` prefix            | todo  |
| 9     | New Chat: button in Inbox, sorted list of Creators and character fans        | todo  |
| 10    | UI: group picker plus per-character override in Audience settings            | todo  |
| 11    | Tests: cast draw, funnel, gates, uniqueness, card, messaging both ways       | todo  |
| 12    | Version bump, CHANGELOG, rebuild, validation                                 | todo  |

## Why

The audience is anonymous. Every fan is a generated row in `slurp2_population` with a synthetic handle and a Fan Type voice. Users who have written characters want those characters in the crowd: reacting to posts, building a history with a Creator, and sending the occasional message.

Three things already exist and make this small:

- **The ambient roster.** Six `random_user` account rows already mix into the same audience pool as the generated population (`slurp-world.operation.ts:236-254`). Account-backed audience members are not a new idea.
- **The identity provider.** `populationNoodlerFanIdentityProvider` takes a caller-prepared cast and returns prompt-ready identities with `traits`, `voice`, `tone`, and a per-creator `relationship` line (`slurp-fan-identity-provider.ts:108`). A character supplies all four from data it already holds.
- **Character copy in prompts.** `slurp-invited-post-draft.service.ts:104-106` already reads a character card into a Slurp prompt, and takes only the fields the task needs.

## What I verified, and what it changes

I traced the code before planning. Six findings changed the design.

### 1. A character cannot act as an audience member today

Three paths, three gates:

| Path                            | Gate                                                                | Effect                       |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| Viewer routes (like, comment, subscribe, tip, DM) | `resolveViewerPersona` -> `getViewer(personaId)`, then `actor.kind !== "persona" \|\| actor.sourceKind !== "persona" \|\| actor.sourceEntityId !== viewerPersonaId` (`slurp.storage.ts:5818-5826`) | Only the player's persona may act |
| Fan activity                    | `canonicalSnapshot.kind !== "random_user"` (`slurp.storage.ts:6010`) | Only `random_user` may act   |
| World pulse                     | `actor && actor.kind !== "random_user"` (`slurp.storage.ts:6121`)    | Only `random_user` may act   |

I earlier said Creators can already interact with each other. That was wrong. The viewer routes always resolve the actor to a persona the user owns, so no character or Creator can act through them. The viewer routes stay untouched by this plan.

### 2. The package cannot change the `characters` table

The package tree holds Slurp files only. `characters.storage.ts` and the `characters` schema live in `sources/engine/`, which is captured Engine dependency code. So a per-character opt-in flag cannot be a new character column.

The precedent for per-character Slurp state is a settings map: `characterImageInstructions: z.record(z.string(), z.boolean())` (`slurp.storage.ts:571`). The opt-in belongs there.

### 3. `invited` is already taken for characters

`account.invited === true` on a character row already means "directly invited Creator that may draft posts" (`slurp-invited-post-draft-access.ts:4`, gated at `slurp.routes.ts:4293`). It is also read by `chooseNoodleParticipantAccounts`. So `invited` cannot double as the audience marker.

`invitedCharacterGroupIds` already exists in settings (`slurp.storage.ts:556`) and is a Creator-participant concept. Do not repurpose it. Add a separate key.

### 4. A `kind: "character"` audience row would become a phantom Creator

`isSlurpViewerActorAccount` is `invited === true && kind === "persona"` (`slurp.storage.ts:1351`). It is the filter that keeps viewer actors out of stage profiles, creator lists, and Discover tag counts (`:2513`, `:3159`, `slurp.routes.ts:2066`, `:2947`, `:3024`).

A character row with `invited: true` passes that filter. It would appear as a Creator in the backstage list and in stage profiles. That is the phantom-profile class of bug the predicate was added to stop.

### 5. Therefore: model a character fan as an ambient roster entry

`upsertAccountFromProfile` with `kind: "random_user"` writes `sourceKind` and `sourceEntityId` as null (`slurp.storage.ts:3495-3496`). Ambient rows work this way, and they carry their identity in `entityId` (`random_user:moth-hour`).

So a character fan is a `random_user` account row whose `entityId` is `character-fan:<characterId>`. This removes most of the risk:

- **No gate change.** Both audience gates check `kind === "random_user"` and pass unchanged. No authorisation check is widened, so the security surface of this feature is provisioning, not authorisation.
- **No schema change.** The account uniqueness rules key on `(sourceKind, sourceEntityId)` and on `handle`, both scoped. A row with null `sourceKind` collides with nothing, so one character may be a Creator and a fan at the same time with no new constraint.
- **No new predicate.** The row behaves exactly like the ambient roster everywhere else.

The cost: `resolveAccountSource` cannot resolve the character, so avatar and name sync must be explicit at provision and refresh time. That is a small, contained job, and `ensureAmbientNoodleAccounts` is the pattern for it.

### 6. Audience members hold no wallet

`slurp-world.operation.ts:404-409` is explicit: an audience member is not a viewer and holds no balance. Audience money is a weekly budget reservation plus a credit to the Creator's earnings. So "same funnel and spend" means the character fan reserves against `spend.weeklyBudget` from its Fan Type and credits the Creator, exactly as a generated fan does. It does not pay from a wallet.

## Decisions taken

From your answers:

1. **Shape:** character-backed fan cast, plus a profile card and messaging. No Discover presence.
2. **Creator and fan:** both are allowed at once. Not every character is a Creator.
3. **Opt-in:** group plus per-character override.
4. **Prompt data:** name, handle, and a squeezed voice.
5. **Funnel and money:** same funnel and the same spend rules as a generated fan.
6. **Fan Type:** derived from the card, with a per-character override. Card tags map to a type first; an unmatched card falls back to the id-derived type, as an ambient account does.
7. **Card sync:** the audience row re-syncs name and avatar on every world tick, unless the user edited that profile by hand.
8. **Personas:** characters only.
9. **Cap:** the user sets it. A default keeps a fresh install bounded.
10. **New Chat:** the Inbox gets a New Chat button. It lists Creators and invited characters.
11. **`allowRandomUsers`:** does not hide character fans. An invite is its own opt-in.
12. **Discover:** no presence. Audience only.

## Data model

One new settings key. No new table and no new column.

```ts
/**
 * Characters the user put in the audience.
 *
 * Key is the Engine character id. Value is the Fan Type id that shapes the character's
 * behaviour, or true to let the id pick one, as an ambient account does today.
 */
audienceCharacters: z.record(z.string(), z.union([z.string(), z.boolean()])),

/** Character groups whose members join the audience. Per-character entries above win. */
audienceCharacterGroupIds: z.array(z.string()).max(20),

/**
 * Most character fans that may act at once.
 *
 * The user sets this because the cost is theirs: each character fan in a cast adds up to
 * `SLURP_FAN_VOICE_PROMPT_MAX` characters to that prompt. The default keeps a fresh install
 * bounded; a user with a long context window may raise it.
 */
audienceCharacterLimit: z.number().int().min(0).max(10).default(5),
```

Account row per invited character, written by the provisioner:

| Column                       | Value                                       |
| ---------------------------- | ------------------------------------------- |
| `kind`                       | `random_user`                               |
| `entityId`                   | `character-fan:<characterId>`                |
| `displayName`, `avatarUrl`   | synced from the character card               |
| `sourceKind`, `sourceEntityId` | null, as `upsertAccountFromProfile` writes |
| `invited`                    | `true`, so the row joins the audience pool   |

Cast id is the account id. `slurp2_audience_ties.memberId` is plain text, so ties need no migration.

## Cap

A user-set limit from 0 to 10, defaulted to 5. The voice budget is 240 characters per actor per prompt (`SLURP_FAN_VOICE_PROMPT_MAX`), and a fan-activity run covers up to 12 Creators. The default keeps the worst-case prompt growth bounded without capping how many characters the user may invite in principle: beyond the limit, invited characters enter a rotation the same way the existing cast draw already mixes returning members and newcomers.

## Slices

### Slice 1 — Settings

Add `audienceCharacters`, `audienceCharacterGroupIds`, and `audienceCharacterLimit` to `slurpSettingsSchema` and to the defaults object. Add the settings keys to the backstage navigation map and to the client settings types.

Proof: a settings round trip keeps all three keys, and an over-cap limit is clamped.

### Slice 2 — Storage

Add to `slurp.storage.ts`, next to the ambient helpers:

- `resolveAudienceCharacterIds()` — group members plus per-character entries, per-character wins, capped.
- `ensureAudienceCharacterAccounts()` — the `ensureAmbientNoodleAccounts` shape: provision the missing rows, sync name and avatar when the profile was not edited by hand, never delete.
- `listAudienceCharacterAccounts()` — the provisioned rows, with the character id parsed back out of `entityId`.

Proof: invite a character, assert one `random_user` row with the expected `entityId`; uninvite, assert the row survives and drops out of the list.

### Slice 3 — Cast

Two call sites:

- `slurp-fan-activity.operation.ts:259-276` — append character fans to the drawn cast, after the returning and newcomer draw.
- `slurp-world.operation.ts:246-254` — append character fan account ids to `audience`, beside `ambient`.

Both already accept account-backed members, so this is an append and a Fan Type lookup, not a rework.

Proof: the pulse and tick regressions still pass, and a new case asserts a character fan appears in the drawn cast and in the world pool.

### Slice 4 — Identity

Add a squeeze helper that turns a character card into a `NoodlerFanCastMember`: name, handle, `voice` cut to `SLURP_FAN_VOICE_PROMPT_MAX`, `traits` from the card tags, `tone` when the Fan Type sets one. Read only the fields the prompt needs, as the invited-post draft does. Chat history stays out.

Proof: a long character card yields a voice within budget, and the composed prompt carries the character name and voice.

### Slice 5 — Ties

- Skip `population.touch` for ids that are not population members. The guard already exists for the `noodler-fan:` prefix at `slurp-fan-activity.operation.ts:182-190`; widen it to "is a population id" rather than "is not a legacy id".
- Confirm `advanceTie`, `lapseTie`, `setTieAudienceArc`, `setTiePaidThrough`, and `reserveWeeklySpend` work on an account id. They key on `(memberId, creatorAccountId)`, so they should need no change. State the result either way.
- Give a character fan a Fan Type for budget and funnel: the settings override when set, else tags matched against Fan Type names and tags, else `slurpPickFanType(id)`. The resolver is pure and deterministic, so a preview equals the applied value.

Proof: a character fan follows, converts to subscriber, credits the Creator, and lapses. No wallet is touched. A tagged card lands on the matching type; an untagged card lands on a stable type and stays there across runs.

### Slice 6 — Fan card

`SlurpFanCard.tsx:8` decides clickability on the `slurp-fan:` prefix, and `GET /noodler/audience/:memberId` reads the population table and returns 404 for anything else.

- Widen the route: when the id is a character fan account, answer from the account row and the tie.
- Widen the card: accept a character fan id, show the character avatar, a voice excerpt, the stage, the direction, and lifetime spend.

Proof: the route answers for a character fan and still 404s for an unknown id; a render test opens the card.

### Slice 7 — Messaging, world side

A character fan on the sending side needs no new code. Threads key on `(viewerAccountId, creatorAccountId)` (`slurp-messages.storage.ts:773`), and the world tick already opens threads for population members and ambient accounts. Verify thread creation, rapport facts, and the message prompt for a character fan, and confirm the no-wallet path for a request fee.

Proof: a character fan opens a thread through the world tick, the Creator's inbox shows it, and the rapport facts read the tie.

### Slice 8 — Messaging, resolve the character

This is the slice the New Chat button depends on, and the only place the ambient-row design costs something.

Reply generation resolves the other side's personality through `slurp.resolveAccountSource` (`slurp-message-generation.service.ts:372`), which reads the `sourceKind` and `sourceEntityId` columns. A `random_user` row has both null, so `resolveNoodlerCharacterCanon` receives null and the character would answer with no personality. Nothing throws — the call sites are ternary-guarded — so this fails quietly, which is worse.

Add one resolver that recovers the character id from the `character-fan:` prefix in `entityId`, and use it wherever `resolveAccountSource` returns null for a character fan account:

- the schedule context and availability at `slurp-message-generation.service.ts:372-391`
- `resolveNoodlerCharacterCanon` at `:391`

Identity disclosure applies unchanged: a character fan has no `identityDisclosure` of its own, so it resolves as `open`. State that in the PR, because it is an identity-protection decision rather than an accident.

Proof: a player-opened thread with a character fan produces a reply in that character's voice, and a thread with a Creator is byte-identical to before.

### Slice 9 — New Chat

`GET /messages/compose` (`slurp-messages.routes.ts:480`) already answers for a target with no thread yet, so the server work is a list endpoint, not a compose path.

- Server: a sorted target list — Creators from `listNoodlerStageProfiles`, plus character fans from slice 2. Exclude the viewer's own Creators, and exclude anybody already holding a thread.
- Client: a New Chat button in the Inbox header, styled and sized as a thread row (`ThreadRow`, `SlurpMessages.tsx:463`), opening the sorted list. Picking a target calls the existing compose path.
- `openThread` (`slurp-messages.storage.ts:968`) only checks that the account exists, so it accepts a character fan target with no change. Confirm the request fee and DM policy still apply.

Proof: the button opens the list, the list excludes existing threads and the viewer's own Creators, picking a Creator and picking a character fan both open a working thread.

### Slice 10 — UI

Add an Audience section: a group multi-select, a per-character list with a toggle and an optional Fan Type select, and the limit control. Show the current count against the limit. Characters already used as Creators stay selectable, since both roles are allowed.

Copy must state plainly that an invited character reads adult posts and writes public comments.

Proof: invite from the UI, see the character in the audience, uninvite, see it leave.

### Slice 11 — Tests

- Provisioning: no duplicate row; a hand-edited fan profile survives a tick sync; a renamed card updates an unedited row.
- Uniqueness: one character as Creator and fan at once.
- Gates: assert both `random_user` checks are unchanged, and that a plain character row is still refused by each.
- Cast: group filter, per-character override, limit, rotation beyond the limit.
- Fan Type: tagged card matches, untagged card is stable across runs.
- Funnel: follow, convert, credit, lapse, no wallet touched.
- Messaging: world-opened thread, player-opened thread, and a character-fan reply carrying its personality.
- Card: route answers for a character fan, still 404s for an unknown id.

### Slice 12 — Package

Bump to 0.0.22 in the package manifest, add the `packages/slurp2/CHANGELOG.md` entry, rebuild with `node scripts/build-feature-packages.mjs slurp2`, then run the four baseline commands: `test-catalog-lanes`, `validate-package-locales`, `validate-catalog`, `catalog-release-notes.regression`. Add the new locale keys to `de`, `ko`, and `pl`.

## Consequences

- **Security.** No authorisation gate changes, because the design keeps `kind: "random_user"`. The sensitive surface is provisioning: a character must not reach the audience without an explicit opt-in. Slice 9 covers that with a negative test, and the PR needs a validation note saying which gates were left alone and why.
- **Earnings.** Character fans subscribe and tip, so Creator earnings move. The user controls this through the cap and the Fan Type.
- **Prompt cost.** Up to 240 characters per character fan per prompt in which it appears.
- **Adult content.** An invited character reads explicit posts and writes flirty comments. The opt-in stays explicit for that reason.

## Open questions

1. **Refresh cadence.** Should a character card edit sync into the audience row on every tick, or only when the user asks? Ambient rows sync on read, which is cheap here too.
2. **Fan Type default.** Pick from the character tags, or always fall back to the id-derived type? Tag mapping is guessy, and I lean to the id.
3. **Persona fans.** This plan covers characters. Personas are the player, so I left them out. Say if you want them.
