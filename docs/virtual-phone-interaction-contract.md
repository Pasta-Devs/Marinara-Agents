# Virtual Phone Interaction Contract

Status: implementation contract for the post-2.10 roleplay integration pass.

## Purpose

The phone is a second interface into the same roleplay simulation. It is not a separate generator,
and phone storage is not automatically character knowledge. Every boundary crossing must preserve
who acted, who owned and held the device, who could perceive the action, who learned its contents,
what became canonical, and when a delayed consequence becomes effective.

## Existing failure mode

The current implementation has several incompatible sources of truth:

- app storage records UI state;
- activity strings become a lossy narrator summary when the phone closes;
- world facts inform later phone generation but usually do not reach the main roleplay model;
- notifications are derived views rather than a lifecycle;
- roleplay events exist only for a small autonomous-command vocabulary;
- turn context directly projects selected storage, sometimes mistaking unread or merely stored
  content for knowledge.

These mechanisms must be adapted onto one event model. No app may independently decide that local
storage implies knowledge or that an online audience implies physical observability.

## Invariants

1. Opening, searching, scrolling, saving, pinning, hiding, installing, and changing simulation
   controls are private UI actions unless a more specific rule says otherwise.
2. Device owner, physical holder, action actor, and UI operator are distinct identities.
3. Unread content is not knowledge. A notification preview grants only the preview actually shown.
4. A phone record may canonically exist without its generated description being objective truth.
5. Generated catalogs, profiles, search results, feeds, and map candidates are proposals until a
   stable entity or event commits them.
6. An action being canonical does not make it public. Audience and physical observers are explicit.
7. Online-public does not mean everyone in the physical scene observed the action or content.
8. Ordered is not shipped; agreed is not paid; paid is not possessed; matched is not contacted.
9. Every delayed transition has a process ID, prior state, effective time, source, and idempotency key.
10. The main chat receives compact, target-specific projections, never raw phone storage or memory.
11. Model narration may describe only committed outcomes. Unsupported or failed commands do not
    silently become fiction.
12. Branches and swipes cannot duplicate committed phone actions.

## Identity and possession

```ts
type PrincipalRef =
  | { kind: "persona" | "character"; id: string; name: string }
  | { kind: "user" | "system"; id: string };

interface PhoneActors {
  actor: PrincipalRef;       // in-fiction initiator
  operator?: PrincipalRef;   // who used the UI; often the human user
  owner: PrincipalRef;       // registered device owner
  holder?: PrincipalRef;     // physical holder at occurrence time
}
```

A short-lived access lease may authorize requests, but it is not adequate historical possession.
Events snapshot the relevant holder/operator rather than consulting the current lease later.

## Event envelope

```ts
type CanonLevel = "local" | "claim" | "canonical";
type Audience =
  | { kind: "private"; principalIds: string[] }
  | { kind: "participants"; principalIds: string[] }
  | { kind: "network"; scope: string }
  | { kind: "public" };

interface PhoneEvent<T = unknown> {
  id: string;
  chatId: string;
  phoneId: string;
  appId: string;
  verb: string;
  actors: PhoneActors;
  audience: Audience;
  physicalObserverIds: string[];
  canon: CanonLevel;
  data: T;
  source: {
    kind: "user-ui" | "character-command" | "background" | "model-result" | "migration";
    messageId?: string;
    swipeIndex?: number;
    branchChatId?: string;
  };
  occurredAt: string;  // story time when available
  recordedAt: string;  // wall-clock ordering
  effectiveAt?: string;
  processId?: string;
  idempotencyKey: string;
}
```

The event stores structured references and safe display summaries separately. Private content must
not be embedded in a globally visible narration string.

## Knowledge ledger

```ts
interface KnowledgeClaim {
  id: string;
  chatId: string;
  knower: PrincipalRef;
  proposition: string;
  sourceEventId: string;
  sourceRecordId?: string;
  provenance: "observed" | "read" | "heard" | "sensor" | "web-claim" | "reported";
  confidence: "uncertain" | "claimed" | "reliable";
  privacy: Audience;
  acquiredAt: string;
  supersedes?: string;
}
```

Knowledge is granted by perception events such as `message.opened`, `mail.opened`, `photo.viewed`,
`web.page.opened`, `location.viewed`, or explicit sharing. Ownership of a phone or record does not
grant knowledge by itself.

## Processes

```ts
interface PhoneProcess<TState extends string = string> {
  id: string;
  chatId: string;
  phoneId: string;
  appId: string;
  kind: string;
  state: TState;
  previousState?: TState;
  participants: PrincipalRef[];
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  sourceEventId: string;
}
```

Processes represent communication delivery, calls, navigation, orders, deliveries, marketplace
deals, payments, memberships, and match decisions. UI buttons may request transitions but may not
rewrite the meaning of a state (for example, `Confirm delivery` cannot mean the parcel objectively
arrived unless the actor is confirming receipt).

## Projection into the main chat

Projection is computed for the current target character and contains only:

- newly acquired knowledge belonging to that character;
- observable physical events that character could perceive;
- relevant pending state involving that character;
- exceptional device state that affects the scene.

Example:

```text
[Phone state — Alex's phone vibrates in Alex's pocket. A message from Morgan arrived; its contents
have not been read. Alex remembers from the email they opened that the bridge closes at 22:00.]
```

The projector must not compel a reaction. It reports state and provenance. Standing unread counts
must not cause the same content to be repeatedly projected.

## Content and media truth

- A generated Goodle result is an in-world page claim, not objective world truth.
- A generated Maps result is a candidate place until grounded or committed.
- A photo record canonically proves that a file was captured. Its textual description is a sensor
  representation with provenance, not an omniscient account.
- Gallery contains explicitly imported or received media records; it must not expose every image in
  the chat merely because the phone shares chat scope.
- Contacts establish addressability. Imported author-library biography is not character knowledge.
- Notes declare an epistemic role: scratchpad, remembered fact, source excerpt, or player reference.

## Core verb families

Communication:

- `message.composed|send_requested|sent|delivered|opened|replied|failed`
- `mail.drafted|sent|delivered|received|opened|replied|failed`
- `call.placed|ringing|answered|declined|missed|ended`
- `notification.created|delivered|presented|dismissed|opened`

Knowledge and media:

- `content.generated|viewed`
- `knowledge.acquired|shared|superseded`
- `note.created|edited|read|archived|deleted`
- `photo.captured|imported|viewed|shared|deleted`
- `location.viewed|expired`
- `navigation.started|progressed|ended`
- `contact.saved|linked|deleted`

World and commerce:

- `order.placed|accepted|cancelled`
- `fulfillment.shipped|delivery.attempted|delivery.received`
- `listing.published|inquiry.sent|offer.made|offer.accepted`
- `handoff.scheduled|completed|cancelled`
- `payment.authorized|posted|reversed|refunded`
- `post.published|reply.published|reaction.changed`
- `membership.joined|cancelled|drop.published`
- `like.sent|match.created|match.removed`

Device-local:

- `app.installed|uninstalled|updated`
- `device.setting_changed|possession_changed|screen_shown|rang`

## Agency policy

Character autonomy uses the same verbs and validators as the UI. Each command declares whether it
may be user initiated, character initiated, or background initiated. Validation happens before an
idempotency claim is permanently consumed; commit happens before roleplay narration.

Character commands require app installation, operational state, possession, addressability, and
verb-specific permission. Reading and replying are separate actions. A character cannot know an
unread message merely because the model was told a notification exists.

Background behavior is scheduled by story time or committed story events, not browser polling.
Opening the toolbar must never be what causes a character to decide to text.

## Compatibility migration

1. Add ledgers and projectors without removing old storage.
2. Adapt `recordActivity`, `rememberWorldFact`, and autonomous roleplay events to emit the new
   envelope while retaining their existing outputs temporarily.
3. Replace turn-context storage inspection with event/knowledge projection.
4. Migrate app families and stop their legacy writes only after focused scenario tests pass.
5. Import useful legacy world facts as `claim` knowledge with `migration` provenance; never promote
   them silently to objective canon.
6. Remove the session activity buffer after all meaningful actions use typed events.

## Migration order

1. Shared event, knowledge, process persistence and projection.
2. Messages, notifications, Calls, and Mail.
3. Camera, Gallery, Notes, Goodle, Maps, Find, and Contacts.
4. Shop and Banking as the first delayed-process proof, followed by Bazaar.
5. Noodle, Tindler, and NoodleR audience/process semantics.
6. Game, Store, and Settings remain local except for explicitly derived physical signals.

## Required scenarios

- A notification reveals that a message exists without granting its unread body as knowledge.
- A user secretly writes on a character phone; the owner does not know the note until reading it.
- A photo is captured, inspected, shared with one character, and remains unknown to another.
- A character searches a page, acquires a sourced claim, and can later act on it without making the
  page objectively true.
- A call rings audibly for nearby observers but its participants/content remain private.
- An order progresses across story time and possession changes only on receipt.
- A Bazaar agreement can fail before payment or handoff.
- A public Noodle post is online-public without revealing its text to nearby characters who did not
  see the screen.
- Regenerating or switching swipes cannot duplicate a message, payment, post, match, or delivery.
- Group chats project private knowledge only to the correct target character.
