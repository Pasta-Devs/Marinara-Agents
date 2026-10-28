# Virtual Phone Roadmap

This is the active plan for the Virtual Phone package. The former `docs/app-plans/` documents were
historical design notes and implementation logs; they are intentionally removed from the active tree.

## Current Architecture

- Phones belong to a persona or character and persist by owner across chats.
- `chatScope` records where a phone has been used. Requests target the active chat when one is known;
  they do not default to `chatScope[0]`.
- Engine-backed Messages threads project only messages marked `extra.virtualPhone === "text"` and
  subsequent assistant replies. Ordinary chat transcript messages are not copied into the phone.
- Phone-created text messages are written into the Engine chat when the runtime supports
  `createMessageWithSwipe`.
- Contacts, app storage, wallet state, world facts, and activity are phone-owned persistent data.
- Engine character and persona cards are the source of identity for phone owners and available phone
  contacts.
- Lorebook `All` means relevant Engine lorebooks for the active chat: global, chat-linked,
  persona-linked, character-linked, and explicitly active chat lorebooks. `Selected` is an explicit
  phone-level override; `None` disables lorebook context.
- The package uses text generation and Engine call sessions. Camera images remain described records
  until the package runtime exposes an image-generation and shared-media contract.

## Product concept

The Phone is a prop with state, not a second roleplay dashboard. Its interface should first read as
a handset its owner has arranged and used, then reveal authorial controls only where the fiction
cannot safely decide for itself.

The home screen therefore has four jobs: identify whose physical phone is being held, show the
story's time and device state, surface the newest interruption without exposing an entire private
history, and launch installed apps quickly. Search resolves installed apps before offering a web
search. The dock holds the four habitual actions—call, message, camera, browser—while Settings stays
available as device chrome rather than competing with fictional apps.

Every app must answer the same questions:

1. What can the holder do immediately, without generation?
2. What private or shared record remains afterward?
3. When is generation requested, and is that request obvious before tokens are spent?
4. Does the action remain on the phone, involve a participant, or become a durable story event?
5. Which installed app can consume the result next?

The Store exposes those answers as a behavior contract—response/generation level, record privacy,
and story impact—instead of implementation labels. Cross-app handoffs use typed launch intents:
Contacts opens Calls/Messages/Noodle, Gallery drafts Messages or posts to Noodle, Camera feeds
Gallery, commerce reconciles through Banking, notifications return to their source app, and home
search launches an installed app before falling through to Goodle.

### App roles

| Roleplay job | Apps | Durable consequence |
| --- | --- | --- |
| Reach someone | Phone, Messages, Mail, Contacts | Participant sessions, threads, saved contacts |
| Learn privately | Goodle, Maps, Find | Search/activity state; no canon until shared or acted on |
| Capture and reveal | Camera, Gallery, Notes | Phone-local evidence with explicit sharing paths |
| Participate publicly | Noodle, NoodleR, Tindler | Public interactions, creator subscriptions, private matches |
| Move goods and money | Bazaar, Shop, Banking | Purchases, orders, listings, reviewed transactions |
| Personalize and idle | Store, Settings, Game | Installation/device state and phone-local progress |

### App-by-app review ledger

Each app was reviewed as its own product surface in the second redesign pass:

- **Phone:** recents remain the landing screen; starting a call is a deliberate second mode, and
  unavailable Engine calls explain the missing capability instead of simulating one.
- **Messages:** conversations and eligible new contacts share one searchable index; thread search
  includes the latest message, while sending remains participant-scoped and retry-safe.
- **Contacts:** the address book is searchable across names, bios, and saved details; a person page
  leads directly to installed Phone, Messages, and Noodle surfaces.
- **Mail:** Inbox, Sent, and Archive remain durable folders and are now locally searchable across
  sender, recipient, subject, and body; refreshing mail is still explicit generation.
- **Goodle:** browser chrome, history, bookmarks, results, pages, and image search remain one
  navigable web session; generated pages stay non-canon until acted on or shared.
- **Maps:** the map owns the canvas and results live in a bottom sheet; route inspection remains a
  private read rather than silently moving the roleplay.
- **Find:** location lookup never runs on open, never guesses, and clearly distinguishes missing
  story evidence from a failed request.
- **Camera:** the dark viewfinder owns the screen; generation produces an editable described shot
  before the holder commits it to the roll.
- **Gallery:** the media grid stays subordinate to the photo viewer; captions, hiding, wallpaper,
  Messages drafts, and Noodle posting remain explicit actions from one shared sheet.
- **Notes:** phone-local notes now have local full-text search; editing remains immediate and private.
- **Noodle:** composing, feed interaction, and trends retain social-app navigation while public posts
  alone become public world activity.
- **NoodleR:** creator selection, subscription state, locked posts, and Banking charges remain a
  distinct creator-economy flow rather than a recolored Noodle feed.
- **Tindler:** deck, preferences, and matches remain separate modes; generated profiles are possible
  people, while only swipes and matches become durable phone history.
- **Banking:** balance, reviewed story proposals, and the ledger retain a financial visual hierarchy;
  manual adjustment stays visibly authorial reconciliation.
- **Bazaar:** browse, listing detail, seller chat, purchases, sales, and the owner's listings remain
  person-to-person commerce with persistent counterparties and Banking reconciliation.
- **Shop:** retail search, order confirmation, receipt, and delivery timeline stay distinct;
  shipping controls are labeled as external story controls.
- **Game:** the match-three game remains a focused full-screen break; progress is phone-local and only the
  observable act of playing—not arbitrary score lore—may reach the scene.
- **Store:** discovery and removal remain simple, while detail pages expose generation, privacy, and
  story-impact contracts before installation.
- **Settings:** fictional device controls and authorial generation controls remain separate tabs;
  appearance, physical condition, time, connectivity, lore, and model choices do not impersonate
  actions by the phone owner.

Controls that reconcile externally established facts—Banking adjustments and Shop delivery
progress—must be visibly marked as story/director controls. They never masquerade as ordinary taps
performed by the fictional owner.

## Implemented

### Platform and shell

- Persistent owner-scoped phones and cross-chat configuration.
- Device settings, generation settings, About view, app installation/removal, and vertical launcher.
- Story-driven phone activity/session summaries and explicit phone access checks.
- Shared Contacts, world facts, wallet, notifications, and app storage.
- Versioned cross-app launch intents, with backward-compatible contact deep-links.
- Forum removed intentionally.

### Apps

- Camera: subject prompt, generated editable description, confirmation, text-photo fallback, delete.
- Gallery: chat image URL fallback, captions/alt text, hide, and Noodle posting.
- Contacts: Engine-backed contacts, manual contacts, detail view, add, delete, and conversation status.
- Mail: inbox refresh merge, compose, reply, folders, archive, timestamps, free-form recipients, and
  Engine-character/persona replies.
- Messages: sandbox phone threads plus Engine conversation threads and asynchronous replies.
- Noodle: feed, posts, replies, likes, boosts, trends, and persistent world facts.
- NoodleR: creator pages and interactions.
- Tindler: generated deck, preferences, swipes, and matches.
- Goodle: generated search results/pages, links, history, bookmarks, and world context.
- Notes: persistent phone-local notes.
- App Store: install/remove and app details.
- Banking: persistent wallet, transaction history, proposals, and user approval.
- Bazaar: local person-to-person listings, seller messaging, haggling, selling, and wallet integration.
- Shop: fixed-price retail products, receipts, tracked delivery, and story arrivals.

## Remaining Work

### High priority

1. Add complete Engine agent transport and package context injection. This is needed for characters to
   use phones in-scene, ambient phone awareness, Music controls, and future agent integrations.
2. Add the Engine image contract, then implement real Camera images, Goodle Images, Tindler photos,
   Gallery `chat_images` reads, and writing phone photos into Engine chat storage.
3. Implement Calls after Engine call-session access exists.
4. Complete Contacts actions from the detail view: Message, NoodleR, and Edit.
5. Extend the shared Gallery/Camera share sheet from wallpaper, drafted Messages links, and Noodle
   to true Engine-owned attachments and contact avatars once the media contract exists.

### Correctness and polish

- Expose lorebook entry character and character-tag filters once the Engine API provides them.
- Replace permissive cross-character contact discovery with an explicit per-phone awareness directory.
- Verify notification delivery while the phone is closed and inside another app.
- Finish story-authored battery and signal state.
- Complete the registry/icon/helper deduplication and remove remaining dead platform scaffolding.
- Reduce PhoneStore write round trips and debounce Notes/Tindler persistence.
- Move generated content limits fully into per-field schemas rather than relying on broad defaults.
- Add search/filter and edit support for large Contacts lists.
- Decide whether Noodle trends should open filtered feeds or Goodle searches.

## Engine Dependencies

The shared Engine capability roadmap lives in `docs/engine-capability-roadmap.md`.
It covers the Engine foundations needed by Virtual Phone, Maps, Calls, Noodle,
World State, trackers, and future roleplay packages.

The Phone currently uses fallback behavior for features that need later Engine
work:

- Structured conversation action payloads.
- Engine-owned durable story events.
- Image generation and shared media ownership.
- Conversation call-session integration.
- A shared typed package-service registry.

## Roleplay Jobs and Story Chains

The Phone should turn private device actions into selective, durable story consequences. It is not
an omniscient menu: each action belongs to an owner, has an audience, and becomes visible to the
scene only through a notification, a shared record, an explicit “show this” action, or a later
world-fact recall.

- **The missing-person trail:** a character stops replying; Messages retains the last text, Find
  offers a plausible current location, Maps records the route, and checking the phone becomes a
  scene event. Later narration can react to the unread message and route without inventing that
  everyone saw private content.
- **The compromising photo:** Camera/Gallery holds the image and caption; the share sheet can draft
  it into Messages, post it publicly to Noodle, or make it the owner's wallpaper. Those choices
  create different audiences and consequences from the same object.
- **The bad purchase:** Goodle establishes a suspicious store, Shop/Bazaar spends the shared
  Banking balance, delivery persists across turns, and Contacts remembers the seller. A late parcel,
  refund dispute, or empty account can then matter in dialogue instead of resetting with the app.
- **The secret plan:** Notes keeps a clue private; sharing or paraphrasing it into Messages makes it
  participant-visible; calling the recipient moves the interaction into a live Engine call. The
  prompt context may say a fresh private note exists, but must not expose it to unrelated characters.
- **The social spiral:** a Tindler match becomes a known person, Messages continues the relationship,
  Noodle/NoodleR exposes their public persona, and a notification can interrupt a later scene. Blocks,
  deletions, and privacy controls must eventually propagate across those views rather than leaving
  contradictory copies.

Across all of these, the minimum functional contract is stable owner identity, story-aware time and
location, typed cross-app handoff, participant/private/public visibility, durable records, actionable
notifications, and a compact prompt projection that reports consequences without commanding the
model or leaking private content.

Phone identity and phone-local ownership persist across chats by design: the same persona or
character keeps their handset, settings, private notes, history, and account records. That does not
make those records shared story knowledge. Chat-derived projections—lore evidence, public feeds,
Engine conversations, Gallery sources, generated world caches, and roleplay events—must remain
partitioned by active chat. Persistence answers “is this still on the device?”; audience and
projection answer “does this story or character know it?”

Generated environment snapshots are not durable phone history. Bazaar browse listings, Shop
search results, and Noodle trends are live projections of the active story and are discarded when
that view is rebuilt. Confirmed purchases, orders, seller conversations, public interactions, and
other actions remain durable because the owner actually participated in them.

### Canon and privacy rules

- Generated search results, pages, routes, feeds, profiles, and product catalogs are phone content,
  not world canon merely because they rendered or were bookmarked.
- Explicit transactions and public actions may create world facts: sending a public post, accepting
  a sale, placing an order, or bringing a delivery into the scene.
- The session activity line describes only observable device use. It never includes search terms,
  recipients, subjects, private matches, route destinations, photo descriptions, or screen text.
- Transaction details follow the same rule. Ambient session narration may say that a purchase,
  listing, sale, or post occurred, while item names, counterparties, prices, and body text remain in
  their canonical app records until explicitly shown or otherwise made perceptible.
- Private content reaches the scene only through an explicit Show or Reference action, or through a
  participant action whose audience contract already includes the relevant character.
- Minigame scores remain phone-local. Playing may be observable; a score is not lasting story lore.

### Provisioning and causality

- Provisioning may infer cosmetic taste and a plausible installed-app loadout. It must not invent
  owner-authored history: searches, bookmarks, notes, photos, orders, balances, or transactions.
- Battery, signal, power, connectivity, ringer, availability, lock state, and physical damage change
  only through established story state or an explicit device/character action. Personality is not
  evidence of a cracked, bloody, unlocked, or dead phone.
- Access to another owner's locked phone fails closed when the story cannot be checked. Missing model
  capability is never permission.
- The access judge receives scene and lore evidence, never the locked phone's private contacts or
  memories. Authorization cannot inspect or leak the protected content it is deciding whether to expose.
- Generated character commands claim a turn/swipe/action key atomically before sending messages,
  placing calls, posting publicly, or mutating private phone state. Retrying one generated turn must
  not perform the same side effect twice.
- Sharing a chat does not grant phone-number awareness. A real phone owner becomes directly
  reachable only through an explicitly saved linked contact or an existing phone thread; receiving
  that first message establishes the reverse side naturally.

### User, roleplay, and model contract

- **Show** is a user-authored physical roleplay action. It enters the transcript with the user role;
  the phone never claims that its character owner volunteered the screen.
- Show has an explicit audience in group scenes. The physical act may be visible in the transcript,
  while the readable screen projection is delivered as audience-scoped roleplay evidence so an
  uninvolved character does not acquire the contents by sharing the chat.
- Every interactive phone session is likewise attributed to the user operating the UI. Using a
  character's device may amount to snooping or impersonation; the transcript must never rewrite it
  as the owner voluntarily using their own phone.
- Access to another character's phone is a lease for the current interaction, not a permanent
  unlock. Putting the phone down returns the UI to the persona device; entering that character's
  phone later must be justified again by the then-current scene.
- That lease is enforced by the server, bound to the active chat, renewed only by valid use, and
  revoked on put-down. Knowing a character phone's ID is not equivalent to possessing it.
- Lock and powered-off surfaces are hard presentation boundaries. A previously open app cannot
  render above them or expose its content while the device is supposedly inaccessible.
- Perception follows possession. If an event reaches a character phone while the user is holding
  it, the holder—not automatically the absent owner—is the one the story says can notice it.
- Account identity and physical agency remain distinct: a post or text may originate from a
  character's account while the transcript avoids claiming that character physically sent it.
- **Context** is authorial information for the model, not an in-scene action. It enters as narrator
  reference and explicitly grants no character perception.
- Phone content copied into either path is bounded and sanitized. Text visible on a fictional screen
  is story data, never a second channel for prompt instructions.
- The copied content comes from the topmost rendered surface and current viewport—including visible
  draft fields—not a server guess based on the first stored thread, note, or search. Hidden layers,
  clipped accessibility text, and off-screen scroll content are excluded.
- Lore, recent transcript, and phone memories are quoted as reference data in generation prompts.
  The model may use them as evidence, but instruction-shaped text inside them has no authority.
- Recent transcript evidence retains speaker attribution. User action, named-character speech, and
  narration are never flattened into an anonymous block that invites the model to reassign agency.
- Phone memories are filtered to the active chat before generation. Reusing a device across stories
  must not let facts, secrets, or relationships bleed from one roleplay into another.
- The same boundary applies to visible projections: Gallery images, Noodle timelines, Engine-backed
  message threads, and content shared through Show are derived from the active chat, not every chat
  the underlying phone identity has ever touched.
- A model may elaborate texture inside an app, choose a plausible in-character response, or decline
  to act. It may not manufacture user actions, private access, relationships, contact knowledge, or
  durable history merely to make a screen feel populated.
- In-world device controls and out-of-character generation controls are conceptually separate.
  Model selection, lore scope, ambient autonomy, and author instructions are labeled **Director**
  controls; changing them is never represented as something the fictional phone owner did.
- App workflows distinguish **action**, **reconciliation**, and **consequence**. Ordering an item is
  a user action; adding an already-established payment to Banking is reconciliation and creates no
  second payment; shipping or delivery is an external narrated consequence, not something the user
  causes merely by pressing a progression control.
- Physical and network state constrain every app consistently. Local and cached records remain
  readable offline; searches, feeds, mail refreshes, commerce, maps, location lookup, and other
  network-shaped generation cannot quietly work through an explicitly offline handset.
- Installation is also a runtime boundary, not launcher decoration. An uninstalled app's preserved
  local data may return after reinstall, but its routes and character automation cannot execute
  while the app is absent.
- Durable character actions are claimed once per generated swipe before their side effects run.
  The current Engine does not expose a rollback hook when the user abandons that swipe, so these
  actions are retry-safe but not automatically reversible; that remains an Engine integration limit.
- Idempotency distinguishes distinct payloads within the same swipe, so a character can perform two
  different phone actions without one suppressing the other. Exact duplicates remain once-only.
- Autonomous replies, first texts, posts, and calls obey device power and connectivity. Background
  model autonomy is not a route around the handset physics applied to user actions.

## Validation

For source or generated package changes:

```bash
MARINARA_ENGINE_ROOT=/home/dev/projects/Marinara-Engine node scripts/build-feature-packages.mjs virtual-phone
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
```

Focused checks:

```bash
/home/dev/projects/Marinara-Engine/node_modules/.bin/esbuild packages/virtual-phone/src/phone/index.tsx --bundle --platform=browser --format=esm --external:react --external:react/jsx-runtime --external:lucide-react --outfile=/tmp/virtual-phone-client.js
/home/dev/projects/Marinara-Engine/node_modules/.bin/esbuild packages/virtual-phone/src/phone/system/server-entry.ts --bundle --platform=node --format=esm --external:fastify --outfile=/tmp/virtual-phone-server.mjs
```

Generated payloads, manifests, catalogs, hashes, sizes, and the current artifact must be rebuilt from
source. Historical ZIPs are not retained in the repository.
