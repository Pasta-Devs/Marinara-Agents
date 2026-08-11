# Engine And Phone Implementation Checklist

This is the working checklist for making Virtual Phone a real roleplay tool
and for exposing the same useful contracts to other official packages.

The Engine must not add automatic background LLM calls. Existing enabled agent
phases and direct user actions may use their configured models. All other work
is deterministic routing, state, storage, UI, and prompt assembly.

## Current Baseline

- [x] Engine branch `me` exists from current `staging`.
- [x] Engine prompt context works in Conversation, Roleplay, and Game.
- [x] Engine passes target character IDs to prompt contributors.
- [x] Engine exposes read-only committed World State through `getGameState`.
- [x] Phone follows target character scope.
- [x] Phone follows World State time, location, and weather.
- [x] Phone stays silent when group speaker scope is ambiguous.
- [x] Phone package `2.7.1` is built on `hold-the-phone`.

## Engine Work

### Turn And Prompt Context

- [x] Add target character IDs to the prompt-context request.
- [x] Add persona ID to the prompt-context request.
- [x] Collect package prompt context outside Game mode.
- [ ] Add a shared turn request type with chat, branch, message, swipe, mode,
  persona, targets, present characters, and generation kind.
- [ ] Pass the shared turn request to every agent phase.
- [ ] Add audience-scoped prompt contribution sections.
- [ ] Reject private sections when one generation can address multiple
  characters.
- [ ] Add per-package and total context limits.
- [ ] Add prompt contribution diagnostics without storing full prompt text.

### State Projections

- [x] Add committed World State read access.
- [ ] Add message and swipe anchor to World State reads.
- [ ] Define `world-state@1` as a stable projection contract.
- [ ] Add projection validation and unavailable results.
- [ ] Add Character Tracker projection.
- [ ] Add Quest projection.
- [ ] Add Call Session projection.
- [ ] Add Chat Images projection.
- [ ] Add projection revision information for replay.
- [ ] Add projection dependency declarations to package manifests.

### Structured Character Actions

- [x] Preserve the payload in registered capability commands.
- [x] Add package action schemas and payload limits.
- [ ] Add capability action handlers to the runtime API.
- [x] Resolve actions only for packages enabled in the current chat.
- [ ] Advertise enabled action names to the existing main generation.
- [ ] Support native tool providers and fallback bracket tags through one
  validated action type.
- [x] Attach chat, source message, and target character to each
  action.
- [x] Validate action scope before dispatch.
- [x] Persist assistant content before dispatching actions.
- [ ] Keep valid prose when an optional action fails.
- [ ] Record action status and error details.
- [ ] Add action idempotency keys.
- [ ] Do not retry actions automatically during regeneration.

### Durable Roleplay Events

- [ ] Add Engine-owned roleplay event storage.
- [ ] Support public, character-private, and user-only audiences.
- [ ] Render events as narrator lines without exposing raw system-message
  creation to packages.
- [ ] Add automatic, user-approval, and transient-only event modes.
- [ ] Link events to source message and swipe.
- [ ] Make events visible, deletable, exportable, and branch-aware.
- [ ] Prevent private events from entering multi-character prompts.
- [ ] Add event idempotency keys.

### Package Runtime And Permissions

- [ ] Keep package permissions broad and readable for vetted official packages.
- [ ] Enforce manifest permissions when constructing runtime hosts.
- [ ] Add `conversation-actions` permission.
- [ ] Add `roleplay-events` permission.
- [ ] Add `state-projections` permission.
- [ ] Add `model-use` permission only for package-owned model calls.
- [ ] Require model invocation reason `user-action` or
  `enabled-agent-phase`.
- [ ] Keep custom-agent approval capabilities separate.
- [ ] Add package dependency and optional-fallback diagnostics.
- [ ] Add typed service contracts only after concrete projections exist.
- [ ] Dispose routes, commands, hooks, services, timers, and listeners on
  unload, update, rollback, and failure.

### Replay And Diagnostics

- [ ] Record package invocation IDs and result hashes.
- [ ] Anchor replay data to message ID and swipe index.
- [ ] Reuse deterministic projection results during replay.
- [ ] Prevent duplicate actions, events, messages, calls, posts, and images.
- [ ] Add package timeout and failure diagnostics.
- [ ] Show active package contributions in chat diagnostics.
- [ ] Add explicit user actions for fresh reruns.

## Phone Work

### Prompt And State

- [x] Register Phone prompt context.
- [x] Select the Phone from Engine target character IDs.
- [x] Omit private Phone context from ambiguous group generations.
- [x] Use committed World State time, location, and weather.
- [x] Keep manual clock fallback for older Engines.
- [ ] Use a typed prompt section when the Engine supports it.
- [ ] Show the source World State snapshot in Phone diagnostics.

### Character-Initiated Actions

- [ ] Register a strict Phone action schema.
- [ ] Support `send_message`.
- [ ] Support `mark_notification`.
- [ ] Support `incoming_call`.
- [ ] Support `save_photo` after shared media exists.
- [ ] Validate the target contact belongs to the active Phone directory.
- [ ] Reject cross-chat and unrelated-phone targets.
- [ ] Store incoming messages in the correct Phone thread.
- [ ] Add delivery and unread state.
- [ ] Add action result feedback to the Engine.
- [ ] Prevent duplicate delivery during regeneration.

### Durable Story Events

- [ ] Publish a private Phone notification event.
- [ ] Publish a private incoming-call event.
- [ ] Publish a public Phone event only after explicit configuration.
- [ ] Keep normal Phone state transient when no story event is needed.
- [ ] Make event text short and deterministic.
- [ ] Link events to the source generation.

### Calls And Media

- [ ] Make Contacts call actions use the shared Call Session contract.
- [ ] Display ringing, active, missed, declined, and ended states.
- [ ] Use shared Chat Image records in Gallery.
- [ ] Link Camera shots to messages or events.
- [ ] Replace web placeholder images only when image generation is explicitly
  requested.
- [ ] Do not generate images when opening Gallery, Goodle, Camera, or Tindler.

### Interoperability

- [ ] Maps opens Phone locations through a shared target contract.
- [ ] Phone opens Maps for a selected location.
- [ ] Phone opens Calls for a contact.
- [ ] Phone opens Messages from Contacts, Maps, Noodle, and Mail.
- [ ] Phone opens Goodle for Noodle trends and public events.
- [ ] Phone exposes public Phone events to Noodle only through a typed read.

## Other Package Consumers

- [ ] World State becomes the owner of scene time, place, and weather.
- [ ] Character Tracker consumes the shared turn target.
- [ ] Maps consumes World State and publishes deterministic destination actions.
- [ ] Calls consumes target identity and publishes call lifecycle events.
- [ ] Noodle consumes public scene state and avoids duplicate posts on replay.
- [ ] Quest consumes structured objective actions and publishes milestones.
- [ ] Combat consumes deterministic state and publishes combat events.
- [ ] Expression consumes target character identity and message anchors.
- [ ] Illustrator consumes existing scene and character projections.
- [ ] Lorebook Keeper and Continuity use branch and source revisions.
- [ ] Games use deterministic actions and replay anchors.

## Test Plan

### Engine Tests

- [ ] Prompt context runs in Conversation.
- [ ] Prompt context runs in Roleplay.
- [ ] Prompt context runs in Game.
- [ ] Target IDs are correct for individual generation.
- [ ] Target IDs are empty or multi-valued for group generation.
- [ ] Private context is omitted for multi-target generation.
- [ ] World State returns the latest committed snapshot.
- [ ] Wrong chat cannot be read.
- [ ] Missing World State returns null.
- [ ] Contributor timeout does not block generation.
- [ ] Malformed action payload is rejected.
- [ ] Unknown action is ignored or reported without changing the chat.
- [ ] Action runs once for a source message and swipe.
- [ ] Regeneration does not repeat a durable action.

### Phone Tests

- [x] Phone regression suite passes.
- [x] Server bundle compiles.
- [x] Client bundle compiles.
- [ ] Character receives a new Phone message during normal Roleplay.
- [ ] Group generation does not leak private Phone data.
- [ ] World State clock appears in Phone timestamps.
- [ ] World State location and weather reach Phone context.
- [ ] Character-generated `send_message` reaches a Phone thread.
- [ ] Regeneration does not duplicate the Phone message.
- [ ] Incoming Phone event reaches the intended audience only.
- [ ] Older Engine fallback still works.

## Release Steps

- [ ] Implement Engine change on `Marinara-Engine:me`.
- [ ] Commit and push Engine `me`.
- [ ] Implement matching package source on `Marinara-Agents:hold-the-phone`.
- [ ] Rebuild package artifacts from the Engine `me` source.
- [ ] Update package Engine minimum only when required.
- [ ] Validate catalogs, locales, hashes, and archive contents.
- [ ] Download the remote artifact and compare its hash.
- [ ] Test the pair in a local Engine installation.
- [ ] Open separate PRs only after the pair works.
- [ ] Do not merge either branch into staging until manual testing is complete.
