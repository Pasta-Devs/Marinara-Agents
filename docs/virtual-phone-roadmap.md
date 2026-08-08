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
- The package uses text generation only. Image generation, chat image storage, and call sessions are
  not currently exposed by the package runtime contract.

## Implemented

### Platform and shell

- Persistent owner-scoped phones and cross-chat configuration.
- Device settings, generation settings, About view, app installation/removal, and vertical launcher.
- Story-driven phone activity/session summaries and explicit phone access checks.
- Shared Contacts, world facts, wallet, notifications, and app storage.
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
- Marketplace: listings, seller messaging, interest, and wallet integration.

## Remaining Work

### High priority

1. Add complete Engine agent transport and package context injection. This is needed for characters to
   use phones in-scene, ambient phone awareness, Music controls, and future agent integrations.
2. Add the Engine image contract, then implement real Camera images, Goodle Images, Tindler photos,
   Gallery `chat_images` reads, and writing phone photos into Engine chat storage.
3. Implement Calls after Engine call-session access exists.
4. Complete Contacts actions from the detail view: Message, NoodleR, and Edit.
5. Add a shared Gallery/Camera share sheet with wallpaper/avatar, Messages attachments, and Noodle
   targets.

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

The package can continue shipping its fallback behavior until these runtime capabilities exist:

- `runtime.agents`: discover and invoke other agents.
- Static package-authored pre-generation context injection.
- Package-declared phone commands available to character generation.
- `runtime.images.generate`.
- Read/write access to Engine `chat_images`.
- Conversation call-session access.
- Lorebook entry filter fields for character and character-tag evaluation.

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
