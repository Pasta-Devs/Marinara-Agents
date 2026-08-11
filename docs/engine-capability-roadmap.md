# Marinara Engine Capability Roadmap

This is the working architecture for feature-rich official packages and
agents. Virtual Phone is the first complete proof. The same contracts must
support World State, Maps, Calls, Noodle, trackers, games, media, and future
packages.

## Architecture Decision

The Engine should add four roleplay primitives:

1. **Turn scope** identifies the current chat, branch, generation, persona, and
   target character or characters.
2. **State projections** expose read-only structured state owned by the Engine
   or another package.
3. **Actions** carry validated intent from the existing main generation to a
   package.
4. **Events** store durable roleplay facts with a subject and audience.

UI slots, package storage, model hosts, routes, resources, and runtime cleanup
remain supporting infrastructure. They are not additional roleplay channels.

Do not build a general package message bus. Do not use chat metadata as a
hidden bus. Do not expose raw package service objects as the main integration
API.

## Model-Work Decision

The Engine must not add automatic background LLM tasks.

A package model call may start only from:

1. A direct user action that needs generation.
2. An enabled agent running in its declared phase.

The existing main character generation may emit a structured package action.
That action does not start another model call. The action payload already
contains the model's intent and generated content.

The Engine must not start a model call because:

- A package UI opened.
- A state projection changed.
- An event arrived.
- Another package requested data.
- Prompt context was collected.
- A service was registered.

This rule must be part of the model-host contract, not only documentation. A
package model request should declare its reason:

```ts
type PackageModelInvocationReason = "user-action" | "enabled-agent-phase";
```

The Engine can then show where token work came from and reject undeclared
background use.

## Responsibility Boundaries

The Engine owns:

- Turn scope.
- Prompt assembly.
- Projection lookup and scope checks.
- Action parsing, validation, routing, and replay behavior.
- Event storage, audience filtering, and display.
- Package activation, cleanup, and diagnostics.

Each package owns:

- Its domain state.
- Its feature UI and settings.
- Its deterministic rules.
- Its optional prompts and model calls when allowed by the model-work rule.

The package that owns a domain remains its writer. Phone does not write World
State. Maps does not write Character Tracker. Cross-domain effects use actions
or events.

## Existing Engine Support

The Engine already has:

- Agent phases: pre-generation, parallel, and post-processing.
- Prompt-context registration with a timeout and fail-open behavior.
- Package UI slots.
- Package storage and resource APIs.
- Language-model, embedding, call, and persistence hosts.
- Chat-image reads.
- Conversation-command registration.
- Package activation cleanup and rollback.
- A simple process-local service registry.

The package manifest currently supports:

- `agent-runtime`.
- `chat-read`.
- `chat-write`.
- `network`.
- `prompt-context`.
- `routes`.
- `storage`.
- `ui`.

These permissions are not yet a complete runtime boundary. The runtime host
currently exposes several broad services to an activated server package. Some
surfaces, such as prompt context and privileged routes, have direct permission
checks. The new design should make host exposure match the manifest.

User-created custom agents have a separate approval system for message edits,
tracker edits, lorebook edits, prompt edits, vectors, styling, and image
generation. Keep that system separate. Reviewed official packages and imported
custom agents do not have the same trust level.

## Primitive 1: Turn Scope

Every agent phase, prompt contributor, action, event, and projection read uses
one shared turn scope:

```ts
type RoleplayTurnScope = {
  requestId: string;
  chatId: string;
  mode: "conversation" | "roleplay" | "game";
  personaId: string | null;
  targetCharacterIds: string[];
  presentCharacterIds: string[];
  anchor: {
    messageId: string | null;
    swipeIndex: number;
  };
  generationKind: "new" | "regeneration" | "swipe" | "replay";
};
```

Use `targetCharacterIds`, not one required `speaker`. A normal character turn
usually has one target. A group generation can have several. Narrator or game
master generation can have none.

This fixes the Phone group-chat problem. Phone contributes private data only
when the audience can be resolved safely. It also gives trackers, Calls, Maps,
and games one shared identity contract.

Private context has one strict rule: include character-private data only when
`targetCharacterIds` contains exactly that one character. If one model call can
write several characters, audience metadata cannot stop the model from using
one character's private information for another. The Engine must omit private
context from that generation. A future per-character generation mode can
provide private context separately.

The message and swipe anchor is the replay identity. A chat or branch ID alone
cannot distinguish two swipes at the same point in the story.

## Primitive 2: State Projections

A state projection is a read-only, structured view of domain state. It is not
prompt text and does not start model work.

Start with an Engine-owned World State projection:

```ts
type WorldStateProjectionV1 = {
  snapshotId: string;
  date: string | null;
  time: string | null;
  location: string | null;
  weather: string | null;
  temperature: string | null;
  presentCharacterIds: string[];
};

runtime.state.read("world-state@1", turnScope);
```

Phone uses time and location. Maps uses location. Camera uses time and weather.
Noodle can use public location and date information.

Later projections can cover:

- `character-state@1`.
- `quest-state@1`.
- `relationship-state@1`.
- `inventory-state@1`.
- `call-session@1`.
- `chat-images@1`.

Projection contracts need:

- A stable name and major version.
- Runtime request and response validation.
- Chat and branch scope.
- Optional character subject scope.
- A source snapshot or revision ID.
- A clear unavailable result.

Projection names and versions are part of the published capability API.
Additive fields may ship in a minor capability API update. A changed meaning or
removed field requires a new projection major, such as `world-state@2`.
Packages declare the projection majors they consume and keep a fallback for
optional projections.

The existing package service registry may implement projection providers
internally. Packages should consume the projection host, not raw services.

### Prompt contribution

Keep `registerPromptContext`. Give it `RoleplayTurnScope` and let it return
typed sections:

```ts
type PromptContextContribution = {
  sectionId: string;
  label: string;
  audience: "public" | { characterIds: string[] };
  text: string;
};
```

The Engine controls placement and message role. A package cannot write a raw
system message or choose prompt priority.

The Engine applies per-package and total size limits. A failure omits the
optional contribution and continues the existing generation.

The contribution formats stored state. It does not call a model.

## Primitive 3: Structured Actions

Actions let the existing main generation use a package without another model
call.

The current command parser recognizes a package tag but discards its payload.
Preserve the payload and route a validated action:

```ts
type ConversationAction = {
  actionId: string;
  commandType: string;
  payload: unknown;
  turn: RoleplayTurnScope;
  sourceMessageId: string;
  idempotencyKey: string;
};
```

Each package registers:

- Action name and description for the main prompt.
- JSON payload schema.
- Maximum payload size.
- Deterministic handler.
- Whether the action creates a durable event.

The Engine exposes one action registry to generation. A provider with native
tool calling receives actions as tools. A provider without tool calling
receives a compact fallback tag format. Both paths produce the same validated
`ConversationAction`. Packages do not implement provider-specific parsing.

Only actions enabled for the current chat enter the main prompt. This keeps the
prompt small and prevents the model from attempting unavailable features.

Examples:

- Phone sends a message whose body is already in the payload.
- Calls starts a call request.
- Maps selects a destination.
- Quest records an objective action.
- Noodle publishes a post supplied by the main generation.

An action handler must not silently start a new LLM call. If more generation is
needed, the package must expose a direct user action or use an enabled agent
phase.

Regeneration must not execute one durable action twice.

The Engine persists the assistant message before dispatching actions, then
records each result against the source message and swipe. A failed optional
action does not discard valid prose. The transcript and diagnostics show the
failure. Retrying an action is an explicit user operation, not an automatic
model retry.

## Primitive 4: Roleplay Events

Events record facts that must survive after transient context changes.

```ts
type RoleplayEventInput = {
  chatId: string;
  anchor: {
    messageId: string;
    swipeIndex: number;
  };
  sourcePackageId: string;
  eventType: string;
  subjectCharacterIds: string[];
  audience: "public" | { characterIds: string[] } | "user-only";
  text: string;
  data: unknown;
  idempotencyKey: string;
};
```

Examples:

- Gregor's phone vibrated.
- Mara's call was missed.
- The group arrived at South Station.
- A parcel was delivered.

The Engine stores structured metadata and controls narrator rendering. A
package cannot choose the `system` role.

Events support:

- `transient-only` for prompt context with no stored history.
- `automatic` for normal configured package behavior.
- `user-approval` for important state changes.

Durable events are visible, deletable, exportable, branch-aware, and attributed
to their source package. Prompt assembly filters private events by the current
turn's target characters.

Audience filtering follows the same group-generation rule as private prompt
context. A private event is not supplied to a model call that can write another
character.

## Permissions And Trust

Permissions have three separate jobs.

### 1. Installation trust

Official `Marinara-Agents` packages are reviewed and trusted. Custom repository
packages require their existing trust confirmation. Imported custom agents use
their existing explicit approvals.

### 2. Manifest capability declaration

The manifest tells the Engine and user what surfaces a package uses. The Engine
should construct the runtime host from these declarations.

Keep the current broad permissions. Add only capabilities with a clear effect:

- `model-use`: request language-model work with an allowed invocation reason.
- `conversation-actions`: register structured actions.
- `roleplay-events`: create durable events.
- `media-generate`: request image generation.
- `state-projections`: publish or consume declared projections.

Do not add a permission for each World State field, call state, or image
property. Those details belong to the versioned projection contract.

### 3. Per-chat activation

Installation permission does not mean automatic execution in every chat.

- An enabled agent may run its declared phase.
- A prompt contributor runs only when its package feature is active for the
  chat.
- An action is advertised only when enabled for the chat.
- A package model call still needs `user-action` or `enabled-agent-phase` as its
  reason.

This is the control that prevents installed packages from adding hidden token
work to every chat.

## Replay And Lifecycle

The Engine records deterministic invocation metadata:

- Request ID.
- Package ID.
- Primitive and contract name.
- Chat and branch.
- Input and result hashes.
- Status.
- Idempotency key.

Ordinary regeneration reuses projection snapshots and skips previous durable
actions and events. A separate explicit user action may request a fresh live
run.

The package runtime owns all routes, prompt contributors, actions, projection
providers, timers, and event listeners. Disable, update, rollback, failure, and
restart dispose them.

## Diagnostics

The Engine should show:

- Which packages are active in the chat.
- Which package added each prompt section.
- Which actions are available.
- Which durable event came from which package.
- Which model calls ran and why.
- Last package failure or timeout.
- Missing optional and required projections.

This is more useful for a local trusted system than a large security audit log.

## Delivery Order

### Foundation

1. Add `RoleplayTurnScope` to prompt contributors and agent phases.
2. Add `world-state@1` through the projection host.
3. Add typed, audience-scoped prompt contributions.
4. Enforce `model-use` and invocation reasons on package model calls.

This foundation adds no model call.

### Roleplay interaction

5. Preserve and validate conversation-action payloads.
6. Advertise only chat-enabled actions to the main generation.
7. Add audience-scoped durable roleplay events.
8. Add idempotency for actions and events.

### Package ecosystem

9. Add more projections only when two real consumers need them.
10. Add shared media and call record projections.
11. Add package diagnostics.

Do not build a general service marketplace before these concrete contracts are
proven.

## First Complete Phone Proof

The foundation is complete when:

- A group generation provides correct target character IDs.
- Phone contributes private state only to the matching target.
- Phone reads World State time and location.
- The contribution is bounded and audience-scoped.
- No extra model call runs.
- A timeout does not block generation.

The interaction proof is complete when the existing main generation can emit:

```text
Gregor sends Mara a Phone message.
```

The Engine validates one structured Phone action. Phone stores one message. The
Engine records at most one private event. Regeneration does not repeat either
side effect. No second LLM call runs.

## Deferred Decisions

- Whether private events render inline or in a separate event panel.
- Which event types default to user approval.
- Whether explicit fresh regeneration reruns enabled agents.
- Which projection follows World State after two packages need the same data.
