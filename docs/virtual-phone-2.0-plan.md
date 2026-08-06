# Virtual Phone 2.0 Plan

## Status

This is a planning document for a greenfield Virtual Phone rebuild. Version 2.0.0 is a new implementation, not an incremental refactor of the current phone. The existing phone is useful product research and a concept reference, but its client, server, state model, app implementations, generated payloads, and release artifacts are not the implementation foundation for 2.0.

We are planning the product and contracts before writing feature code. Each foundation milestone and each app should be designed, implemented, tested, and reviewed independently.

The 2.0 effort begins on the dedicated `hold-the-phone` branch and publishes through `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/hold-the-phone/test-catalog.json`. That branch and URL are fixed development infrastructure for the entire 2.0 development period.

## Product Direction

Virtual Phone should feel like an in-story device that belongs to a person, not a collection of generated pages attached to whichever chat is currently open.

The phone must support:

- A persistent persona phone whenever the agent is enabled in a chat.
- Persistent phones for individual characters when enabled in Agent Settings.
- Switching between available phones from the phone UI, the Agent menu, or a compact phone status-bar switcher.
- Independent device state for every phone.
- Shared story, chat, and connected-chat information where the relevant function permits it.
- Optional information from the Persistent World agent when that agent is enabled.
- Roleplay-aware actions whose ownership, visibility, and story effects are explicit.
- Preinstalled Web Search as an essential home-screen function on every newly provisioned phone.

The default presentation is a phone overlay docked at the right side of the chat. It is a stable portrait device viewport enclosed by a visible phone bezel, visually distinct from the conversation, and includes an explicit "put down" control that closes the phone overlay without destroying phone state or changing the current chat. While the phone is up, the chat is visually subdued with a scrim and blur so conversation content does not compete with or distract from the phone. Other presentation modes, such as expanded or full-screen phone views, are separate future decisions and must not complicate the base shell.

Putting the phone down is not a reset, lock, or navigation action. Reopening resumes the same phone at the last active app and route, with the app's position and restorable local UI state preserved where practical. Installed apps persist per phone owner, and each app's local data, settings, drafts, notifications, and history remain isolated to that phone unless the app explicitly declares a shared function through the Platform.

The device appearance is themeable per phone. A character's phone may have its own case, bezel color, wallpaper, UI theme, wear, stickers, cracks, scratches, or story-relevant visual effects such as blood on the glass. These are layered presentation effects over a functioning device: they must not disable navigation, hide required controls, change hit targets, or make app content unreadable. The system owns the effect layers and can keep them separate from app rendering and phone data.

The theme model is hybrid. Agent Settings owns each phone's baseline appearance, while explicit story events may apply temporary or permanent appearance changes. A story event may introduce damage, blood, a new case, stickers, or a changed wallpaper, but model output cannot directly rewrite device UI state. The Platform validates and applies a structured device-appearance event with source, timestamp, target phone, duration or permanence, and cosmetic/functional classification. Current-chat events are authoritative for scene changes; connected chats and the Persistent World agent may provide context but must not silently alter a phone. Cosmetic effects remain non-destructive and can be reduced or hidden through device accessibility settings.

Story-driven appearance changes require confirmation before they alter persistent phone state. The phone may present the proposed change with its source and intended effect, but accepting it is an explicit system-mediated action. Declining or dismissing it leaves the current device appearance unchanged.

The foundation must support displaying a character's phone when the story needs it, while leaving detailed access scope and restrictions for a later decision. Initially, all character phones enabled in Agent Settings are available to the phone switcher.

## Agreed Decisions

### Greenfield rebuild

The implementation starts from new code. Existing Virtual Phone code must not dictate the new architecture. Existing behavior may be retained only when it is deliberately selected as a 2.0 product requirement.

The 1.x implementation and its overhaul plan have been retired. Their branches were deleted after this plan was approved, so 2.0 has no local predecessor to anchor on. This document is the sole active product and architecture plan for the Virtual Phone.

### Phone provisioning

When Virtual Phone is enabled in a chat:

- The persona receives a phone automatically.
- Character phones are provisioned through Agent Settings on a per-character basis.
- Agent Settings is the initial control plane for deciding which characters have phones.
- Enabled phones are persistent objects with their own identity and state.
- The initial phone switcher exposes all character phones enabled in Agent Settings.
- Story-based visibility and access restrictions can be scoped after the core model is established.

### Phone identity

Every phone has a stable generated `phoneId` independent of any one chat. Its identity includes:

- `phoneId`: stable generated device identity.
- `ownerId`: persistent persona or character identity.
- `ownerName`: current display name for the owner.
- `chatScope`: the chats or current availability scope where the phone may be used.
- `deviceName`: optional in-story device name shown in system surfaces.

The persona phone persists across chats. A character phone persists with the character identity while its availability remains controlled by Agent Settings and chat scope. Phone-local state is keyed to the phone identity and owner, not recreated from the currently open chat.

### Shared-world authority

The Persistent World agent is an optional shared-world source. When it is enabled, the phone may read approved information from it through an explicit integration. The phone must not assume that the World agent exists or read it when it is disabled.

The current chat remains the highest-priority source of scene information. Source precedence is:

1. Current chat
2. Connected chats
3. Persistent World agent
4. Phone-local generated fallback

When two records have the same priority, newer information wins. Context records should retain provenance and timestamps internally so an app can explain or resolve conflicts without silently treating all sources as equivalent.

### Data ownership is per function

There is no single shared-versus-private rule for an entire phone. Each function and app data type declares its ownership and synchronization behavior.

The default categories are:

- **Phone-local:** device settings, wallpaper, installed apps, drafts, read state, notifications, device identity, private notes, camera roll, and local history.
- **Story-shared:** world facts and events such as established location, time, public posts, appointments, deliveries, purchases, weather, and other facts explicitly made part of the roleplay.
- **Participant-shared:** data exchanged between named owners, such as messages, calls, shared albums, group chats, marketplace interactions, and deliveries.
- **Permissioned-private:** a character's private notes, gallery, account, phone history, or other data that is not visible merely because another phone exists.

Every app record and every shared data operation must declare its ownership category, participating owners, source provenance, and allowed effects. Apps must access shared information through platform contracts rather than reading another phone's storage directly.

## Architecture: Three Layers

The initial architecture has three primary product layers plus a controlled presence layer that sits above them. The boundaries are more important than the exact directory names.

### Presence and control layer

The Presence and Control layer is the phone's system-owned surface for actions that are about the device being observed, switched, or connected to the story. It may appear over the Device, System, or App surface, but it is not an app and cannot be replaced by generated app content.

It owns:

- Phone switching between the persona phone and enabled character phones.
- A compact switcher that may be opened from the phone status bar or another system entry point.
- System-controlled availability. The current system state may disable switching or individual actions when a phone is locked, unavailable, not provisioned, or otherwise restricted.
- Actions such as showing the current screen to a named character.
- Actions that send the current screen or a structured description of it to the AI/story context when the story needs information the model does not already have.
- Confirmation, progress, failure, and cancellation states for those actions.
- Clear distinction between a screen being visible to the user and a screen being deliberately shared with a story participant or context source.

Apps may request a control or provide metadata for it, but they do not decide whether the control is available, who can receive shared information, or how the action enters the story. The platform and current roleplay permissions mediate those decisions.

### Layer 1: Device

The Device layer represents the physical in-story phone and owns device-wide behavior:

- Phone identity and owner.
- Provisioning and lifecycle.
- Lock and unlock state.
- Status bar, clock, connectivity, and device indicators.
- Home screen, dock, app launcher, and phone switcher.
- Notifications, badges, and notification history.
- Device settings and appearance.
- Installed-app registry.
- Local storage boundary and migrations.
- Device-level accessibility and input behavior.
- Opening, closing, minimizing, and restoring apps.

Device code must not know the internal data model of a specific app. It should consume app metadata and platform capabilities.

## General Phone UI Rules

These rules apply to every screen before individual app design begins.

### Stable layer ownership

- The device frame and safe areas always remain recognizable.
- System surfaces own device navigation and cannot be replaced by app markup.
- Apps own only their app surface and declared app-level interactions.
- Presence and Control actions are system-owned and may overlay any surface when allowed.
- Transient overlays such as notifications, permission prompts, confirmations, and errors render above app content and remain readable.
- A lower layer must not visually or interactively occlude a higher-priority system action.

### Predictable navigation

- Every app has a stable app header, an unambiguous route title, and a visible back button owned by the Platform shell.
- Back, close, home, and phone-switch actions have consistent locations and behavior.
- Back is always available when the app is open. It returns to the previous app route when one exists and returns to the home screen from the app's root route.
- The back button must never require model-generated markup or depend on generated content to work.
- App navigation does not change the device's identity, system status, or selected phone.
- Opening a different phone is a device-level transition, not an app route.
- A switcher may be unavailable when the system disables it; the UI must explain the unavailable state without allowing a partial switch.
- Loading and failure states preserve enough surrounding chrome to identify the current phone and app.

### Chat-side presentation

- The phone opens as an overlay on the right side of the chat.
- The conversation remains underneath as the surrounding host surface; the phone does not become a replacement page for the chat.
- A system-owned scrim dims the chat while the phone is open, and the chat receives a restrained visual blur so its text and controls do not compete with the active phone.
- The phone overlay is the active interaction surface. Background chat controls must not remain accidentally interactive while the phone is up.
- The overlay uses a stable portrait aspect ratio and predictable width constraints.
- A visible device bezel surrounds the phone viewport. The bezel belongs to the Device layer, remains consistent across apps and phone owners, and is not generated by app content.
- The bezel provides physical separation between the phone and the blurred chat without consuming space needed by the app viewport or reducing controls below usable sizes.
- The bezel and device skin may vary by phone owner through a constrained theme contract. A theme can change visual tokens and approved decorative assets without changing the device layout contract.
- Physical-condition effects such as cracks, scratches, fingerprints, dirt, or blood may be rendered as transparent overlays above the glass. They must preserve contrast, avoid obscuring essential controls, and support reduced-motion and reduced-effects preferences.
- Themeable UI includes the phone background, wallpaper, system surfaces, app chrome, status indicators, typography choices within supported limits, icons, and approved app-surface tokens.
- Agent Settings defines the baseline theme; story changes are structured, validated device events rather than direct model-written styles.
- Each story-driven appearance effect records its source, timestamp, target phone, duration or permanence, and whether it is cosmetic or functional.
- Proposed story-driven appearance changes require confirmation before being applied; dismissal preserves the current phone state.
- App themes may contribute app identity colors and imagery through the platform contract, but cannot override device safety states, accessibility contrast requirements, or system-owned controls.
- Device-owned controls such as "put down", phone switching, and system indicators remain visually distinct from the screen inside the bezel.
- App content cannot draw outside the viewport, alter the bezel, or imitate device-level controls.
- The phone has an explicit "put down" control in its device-owned chrome.
- Putting the phone down closes the overlay but preserves the selected phone, app route, local state, and pending system state for the next opening.
- Reopening the phone resumes its last active surface rather than returning to the lock screen or home screen by default.
- Installed apps persist independently on each phone. Installing or removing an app on one phone does not change another phone's installed-app list.
- App data persists per phone according to the app's declared ownership model; app state is not implicitly shared because two phones use the same app.
- The overlay remains present at narrow widths instead of switching to an unrelated layout; its width may adapt within a stable portrait constraint while the chat stays behind the scrim.
- Focus moves into the phone when it opens and returns to the control that opened it when it is put down.
- Escape and the explicit "put down" control close the overlay, subject to any active confirmation dialog.

### Explicit sharing and AI actions

- Viewing a screen locally does not share it with a character, the chat, or an AI context source.
- A deliberate "show this screen" action must identify the recipient or destination before it takes effect.
- The shared payload should be a bounded screen description or approved structured data, not an unrestricted dump of app storage or hidden UI state.
- The UI must distinguish sharing with a named character from supplying context to the AI/story system.
- The user must be able to cancel or confirm actions that create story-visible effects.
- Sharing must preserve the selected phone owner and the screen's app/route provenance.

### System mediation

- App code can request a system action but cannot silently invoke it.
- The system decides whether the current phone is allowed to switch, share, expose context, write back, or produce a background event.
- Disabled actions remain dimensionally stable where possible and expose an accessible reason.
- Permission or availability changes must not leave the phone in an ambiguous intermediate state.

### Responsive and accessible interaction

- The phone viewport has stable dimensions and safe-area behavior across desktop and mobile layouts.
- Touch targets, focus order, keyboard behavior, and labels are consistent across system and app surfaces.
- Icon-only controls have accessible names and tooltips where their meaning is not obvious.
- Motion communicates state changes but respects reduced-motion preferences.
- Text must wrap or truncate intentionally without overlapping neighboring controls.
- Error, loading, and permission states use semantic status announcements where appropriate.

### Information hierarchy

- The current phone owner and device state are always discoverable.
- The current app and route are always discoverable when an app is open.
- System actions are visually distinct from app actions.
- Story-affecting actions are more explicit than purely local actions.
- Empty states explain whether information is empty, unavailable, private, or not shared with this phone.

### Wallpaper-first home screen

The home screen combines a persistent in-universe Web Search field with a traditional app-icon grid, but it must preserve enough open space for the phone owner's wallpaper to remain a strong visual part of the device.

- The first home page is intentionally sparse and must not automatically fill every available icon row.
- A compact Web Search field sits near the top of the launcher, directly below the status bar. It is part of the launcher rather than a decorative widget or separate app card.
- The layout reserves one broad, uninterrupted wallpaper region between Web Search and the lower app grid instead of scattering widgets and floating panels across the screen.
- App icons use a stable grid with fixed icon and label dimensions so installation, badges, and long names do not shift the launcher.
- Only a limited number of apps appear on the first page. Additional apps use subsequent launcher pages or a unified app-library surface.
- The system may provide a small bottom dock for a limited set of owner-selected essential apps, but the dock must not visually compete with the wallpaper or Web Search.
- Wallpaper composition must account for system overlays, icon contrast, labels, the search field, status indicators, and the bottom safe area.
- The Platform supplies adaptive legibility treatments such as restrained text shadows, local scrims, or contrast-aware tokens. It must not obscure the entire wallpaper merely to support icons.
- Character-specific themes can choose the wallpaper and icon arrangement independently for each phone.
- Empty grid positions remain empty. The system does not insert promotional cards, generic widgets, or filler content into unused space.

### Dynamic status bar

The status bar is Device-owned and reflects the current in-story condition of the selected phone. It is not static decoration and cannot be supplied or replaced by an app or model-generated page.

- The bar can represent time, cellular signal strength, no signal, Wi-Fi, airplane mode, battery level, charging state, and other approved device conditions.
- Status belongs to the selected phone. Switching phones immediately displays that device's own condition.
- A newly provisioned or story-empty phone starts with explicit normal, deterministic defaults rather than unexplained random values.
- Device status remains normal until the current story establishes a change or the Virtual Phone background agent produces a validated phone event.
- Battery does not drain as a consequence of elapsed real time, phone-open duration, app use, searches, or other ordinary UI interactions.
- Battery level and charging state remain unchanged until a validated current-story or Virtual Phone background-agent event changes them. The Platform does not run a battery simulation loop.
- Story-driven and background-agent status changes use the same typed device-event pipeline, including target phone, source, timestamp, duration or permanence, and affected capability.
- Connected chats and the Persistent World agent may provide context for a status event but cannot directly write device status.
- User-facing persistent status changes follow the established confirmation policy. Routine temporary status changes may use a separate, narrowly defined confirmation policy if later planning determines that confirmation would make ordinary phone behavior impractical.
- Apps consume typed capabilities derived from device status. They do not parse status-bar visuals or decide whether the phone has connectivity.
- No signal does not disable the entire phone. Local settings, installed apps, cached content, drafts, and other offline-capable functions remain available.
- Web Search and other network-dependent actions show a stable offline state when the selected phone has no usable connection. Existing results may remain visible and be clearly marked as cached.
- Signal, battery, and connectivity states must be conveyed with accessible text or names in addition to icon shape and color.
- Icons retain stable dimensions as values change so the status bar does not shift.
- Apps cannot draw beneath or obscure the status bar unless the Platform later defines a controlled full-bleed mode.

### Basic lock screen

Every phone has a simple, iOS-leaning lock screen as a Device surface. It can show the phone's wallpaper, current in-story time and date, dynamic status indicators, and approved notification previews.

- The ordinary persona lock screen has no passcode, PIN, biometric challenge, or simulated authentication step.
- Opening or waking an ordinarily locked phone allows a direct unlock gesture or action and then resumes the last active app and route.
- Putting the phone down does not automatically force it back to the lock screen. Lock state is separate from overlay visibility.
- The lock screen remains useful with no notifications and no model response.
- Lock-screen notification visibility follows per-phone privacy settings and does not expose private app content by default.
- Character phones use the same basic lock screen when accessible.
- A character phone becomes access-locked only when the current story explicitly establishes that it is locked or otherwise inaccessible.
- Story-required access lock is a real Platform capability restriction, not merely a visual overlay. Apps and private data must not render behind or bypass it.
- The base 2.0 foundation does not simulate passcode guessing, biometric hacking, or arbitrary unlock puzzles. How story-authorized access is later granted is a separate feature decision.
- Access-lock state is scoped to the specific phone and records its story source, timestamp, and duration or permanence.

### Platform visual language

- The phone uses an original hybrid mobile language that leans toward iOS in hierarchy, spacing, restrained chrome, typography, transitions, and app presentation.
- Useful Android conventions may be adopted where they improve clarity or functionality, but the result must not imitate either operating system exactly.
- Every app uses the same Platform-owned navigation grammar: app header, visible back button, route title, content viewport, loading/error treatment, and system overlay behavior.
- Apps may have distinct visual identities, but controls with the same platform function remain positioned and behaved consistently.
- System actions are visually quieter than the app's primary content but remain immediately discoverable.
- Touch interactions should feel direct and physical, with stable hit areas and restrained, interruptible feedback.

### Asset-light icons and backgrounds

The base phone should not require a collection of shipped PNG files for ordinary app identity or system decoration.

- App and system icons use a shared SVG icon system with stable view boxes, consistent optical sizing, and one controlled stroke/fill language.
- SVG icons are treated as UI assets, not arbitrary app-authored markup. Apps select from an approved icon registry or provide a validated icon definition that cannot escape its bounds or execute code.
- Icons use `currentColor` and platform theme tokens so one vector asset can support light themes, dark themes, owner themes, disabled states, and selected states.
- App icons may use a simple approved composition of glyph, background shape, and accent treatment. The composition remains stable across phones even when colors change.
- The Platform owns icon hit areas, labels, focus behavior, and badge placement. An app icon's artwork cannot make its interactive target smaller or obscure its unread dot.
- Raster images are optional for genuine content such as a character-provided photo, wallpaper, or story media. They are not required for the base icon system.

Basic device and app backgrounds use layered, themeable surfaces rather than a large collection of image files:

1. A configurable base color or color pair.
2. An optional low-contrast pattern, texture, or geometric overlay.
3. An optional wallpaper or story media layer.
4. System-provided legibility treatment where text or icons need contrast.

- Patterns are procedural or shipped as small validated SVG/CSS definitions, not repeated PNG backgrounds.
- A pattern has bounded opacity, scale, contrast, and blend behavior so it remains background decoration rather than competing with content.
- Theme configuration can select base colors, pattern family, pattern intensity, and accent color independently.
- The selected phone owns its background configuration. Changing one phone's background does not affect another phone.
- App surfaces may select approved background tokens or an app-specific validated treatment, but cannot make system surfaces unreadable or override accessibility contrast.
- Wallpaper images remain optional and can be layered beneath the pattern. The phone remains complete when no image is available.
- Backgrounds must preserve recognizable contrast behind app icons, status indicators, notification dots, top bars, and controls.
- Effects such as cracks, blood, scratches, and wear remain separate condition overlays rather than being baked into the base background or app assets.

### Universal app top bar

Every app route uses one Platform-owned top bar. Apps cannot replace it, render over it, or supply arbitrary controls for it.

The top bar has three stable regions:

- **Leading:** a visible back button. On a nested route it returns to the previous route; on an app root it returns to the phone home screen.
- **Center:** the current app or route title. It remains readable when either side contains controls and truncates intentionally when necessary.
- **Trailing:** zero or more approved route actions supplied as typed action descriptors, such as refresh, search, compose, share, or a menu.

Top-bar rules:

- The bar remains visible while app content scrolls unless a later platform-wide decision defines an approved collapse behavior.
- Back always occupies the same location and hit area across all apps.
- The app cannot intercept back in a way that traps the user. Unsaved work may trigger a Platform-owned confirmation before navigation continues.
- Trailing actions use familiar icons when available, accessible names, visible focus treatment, and stable touch targets.
- The title is route metadata, not model-authored chrome. Generated content may influence a detail title only through a validated, length-limited route field.
- Loading, error, offline, and partial-content states do not remove or resize the top bar.
- Device-level controls such as "put down" and phone switching remain outside the app top bar.

### Optional unified bottom navigation

Bottom navigation is optional. Apps use it only when they have a small set of persistent, peer-level primary sections that users need to switch between frequently. Apps with a single flow or shallow route structure use the full content area and do not render an empty bottom bar.

When an app uses bottom navigation, it uses the Platform-owned component and typed tab descriptors rather than implementing a custom tab bar.

Bottom-navigation rules:

- Every tab has a stable id, route, label, and approved icon.
- The active tab is indicated by more than color alone, using the Platform's consistent active icon and text treatment.
- Tab order remains stable within an app and follows the app's primary information hierarchy.
- The number of visible tabs is deliberately limited; additional destinations belong in an app menu or secondary route rather than a crowded bar.
- Selecting the active tab returns to that tab's root or restores its previous position according to one Platform-wide rule chosen during implementation.
- Switching tabs preserves each tab's restorable navigation and scroll state where practical.
- Nested detail routes retain the universal top-bar back behavior and do not invent a second back control in the bottom bar.
- Labels remain visible; icon-only bottom navigation is not allowed.
- The bar accounts for the phone safe area and never covers scrollable content or primary actions.
- Loading, error, and offline states keep the navigation stable when the declared sections remain available.
- Apps may choose whether to use the component, but cannot restyle its layout, hit targets, focus behavior, or navigation semantics.

### Deterministic app shells

- Every app is implemented as a real, deterministic shell before model-generated content is introduced.
- The shell owns navigation, headers, tabs, forms, buttons, lists, cards, media frames, dialogs, empty states, loading states, errors, retries, accessibility semantics, and responsive behavior.
- The model never designs the page, chooses the layout, creates device or app chrome, emits executable behavior, or returns arbitrary UI markup.
- Each app route declares a small structured content contract containing only the fields needed by that screen.
- Models provide bounded content values such as titles, summaries, result items, snippets, labels, dates, and approved references.
- Small language models are a primary target. Prompts must be compact, route-specific, JSON-only, and avoid sending full templates, unnecessary transcript history, or irrelevant fields.
- Missing, partial, malformed, or oversized model output is normalized by the Platform and merged into deterministic defaults.
- Every route renders a complete, usable interface with no model response. Model output enriches the shell rather than making it functional.
- Content slots have explicit types, item limits, string limits, allowed destinations, source requirements, and fallback values.
- App interactions update typed local or shared records through Platform APIs; generated text cannot directly mutate device or app state.
- The same shell and content contract must behave consistently across large and small supported models.

### Layer 2: Phone Platform

The Platform layer is the operating environment shared by all apps:

- App manifest and registration contract.
- App lifecycle and navigation.
- Screen and route model.
- Shared UI primitives and layout constraints.
- Loading, empty, error, retry, and offline states.
- Structured content rendering and validation.
- App capability and permission checks.
- Phone-local persistence APIs.
- Story/context projection APIs.
- Cross-phone and participant interaction APIs.
- Source precedence and conflict resolution.
- Event and notification delivery.
- Roleplay writeback mediation.
- Safety, escaping, size limits, provenance, and isolation.

The Platform is the only layer allowed to mediate access between a phone, the current chat, connected chats, the Persistent World agent, and other phones. Generated content must not receive direct storage access, arbitrary Engine internals, credentials, or provider configuration.

### Layer 3: Applications

Each app is an independently designed product built against the Platform contracts. Apps own their screens, domain behavior, data declarations, and roleplay meaning. They do not own device navigation, persistence plumbing, context discovery, or cross-phone access policy.

Each app is also an independently loadable module. The Device and Platform shell load immediately; app code and app content are loaded only when the app is installed, opened, or otherwise required by an explicit system action.

The source layout should make that boundary concrete. Phone apps belong in an `apps/<app-name>/` directory inside the Virtual Phone package, rather than becoming separate repository-level downloadable Packages. For example:

```text
packages/virtual-phone/src/phone/
  device/
  platform/
  system/
  apps/
    app-store/
      manifest.ts
      index.ts
      shell.tsx
      content.ts
      data.ts
      tests/
    settings/
      manifest.ts
      index.ts
      shell.tsx
      content.ts
      data.ts
      tests/
    web-search/
      manifest.ts
      index.ts
      shell.tsx
      content.ts
      data.ts
      tests/
```

The exact filenames may change with the Engine integration, but the ownership boundary should not. `apps/<app-name>/` is the unit of app design, lazy loading, focused tests, and later removal or replacement. Shared components belong in Platform or a deliberate shared UI module; they must not become a hidden app catalog implementation.

- Each app lives in its own source module/file boundary with its manifest, routes, shell, content contracts, assets, and tests.
- The base bundle contains only the Device layer, Platform layer, system surfaces, app registry metadata, and the essential Web Search entry needed to render the initial launcher.
- App Store metadata can be listed without loading the implementation of every app.
- Installing an app registers its manifest and makes its module available to that phone. It does not execute or initialize unrelated apps.
- Opening an app lazy-loads its module and initializes only the selected phone's instance of that app.
- Closing or putting down the phone must release active app resources where practical without deleting persistent app data.
- One app failing to load must leave the Device, Platform, App Store, Settings, and other installed apps usable.
- Apps communicate through versioned Platform contracts rather than importing one another's private modules.
- The app boundary must remain visible in source layout, runtime registration, generated build output, and tests. A catalog list must not become a single bulk implementation file.

An app must declare at least:

- Stable id, name, icon, and category.
- Routes and supported navigation actions.
- Required and optional capabilities.
- Data ownership category for each meaningful record type.
- Relevant context sources.
- Allowed cross-phone participants.
- Whether actions are local, story-visible, participant-visible, or writeback-enabled.
- Content schemas, limits, and deterministic fallbacks.
- Notification behavior.

No bulk app implementation should begin until the Device and Platform contracts are stable enough for one app to use as a proof case.

## Foundation-First Delivery

The work should proceed in layers and milestones, not as a bulk rewrite of all existing apps.

### Foundation 0: Product and contract design

Produce the decisions needed to make code reviewable:

- Device, phone, owner, app, route, record, source, and event vocabulary.
- Three-layer ownership boundaries.
- Phone identity and provisioning rules.
- Per-function data ownership matrix.
- Context source precedence and provenance format.
- App manifest and capability shape.
- Roleplay action and writeback policy.
- Persistence and migration policy.
- Test strategy and app acceptance template.

Deliverable: approved 2.0 contracts and a per-app roadmap. No production implementation is required for this milestone.

### Foundation 1: Device shell

Build the smallest complete device experience:

- Persona phone provisioning.
- Configured character-phone provisioning.
- Phone switcher.
- Lock screen, home screen, status bar, and app launch boundary.
- Empty installed-app state.
- Device-local settings.
- Stable loading and failure surfaces.

The shell must remain usable without any app implementation or model response.

### Foundation 2: Platform runtime

Add the contracts needed to make apps real platform citizens:

- App registration and manifests.
- App lifecycle and navigation stack.
- Route ownership and app toolbar behavior.
- Local app storage scoped to a phone.
- Shared records mediated by the platform.
- Context projection using the agreed source order.
- Capability checks and per-function permissions.
- Notifications and event delivery.
- Structured content schemas and renderer-owned fallbacks.

This milestone should use fixtures and a minimal platform test app rather than implementing the entire catalog.

### Foundation 3: First-party base apps, one at a time

The first application milestone is intentionally small. It contains only the system surfaces and one in-universe app needed to prove the new platform:

1. **Settings:** the device configuration surface.
2. **App Store:** the per-phone app installation surface.
3. **Web Search:** the first in-universe web app and the first app-specific product experience.

These must be designed, implemented, tested, and reviewed as separate app milestones. They must not be developed as a bulk app pass. Messages, Gallery, Contacts, Maps, and all other apps remain future milestones until this foundation is stable.

Settings proves device-local persistence and theme/device configuration. App Store proves that installed-app state belongs to one phone and that app lifecycle is platform-owned. Web Search proves app routes, query/input behavior, in-universe content generation, structured results, source precedence, and deterministic no-model behavior.

Web Search is preinstalled on every new phone and appears as an essential home-screen function. It is not optional initial catalog content, although its exact home-screen placement remains a visual-design decision.

The first 2.0 phone does not need a complete app catalog to be useful. It needs a reliable shell, a working Settings surface, a working App Store for the current catalog contract, and one carefully built web app.

### App-by-app expansion

After the base apps, each app gets its own design brief, data contract, implementation milestone, regression fixtures, and manual verification. App work must not be hidden inside a catalog-wide migration.

The eventual roadmap should classify apps by function, but classification does not imply bulk implementation:

- **Communication:** Messages, Mail, Forum, Noodle, Noodler.
- **Personal/private:** Gallery, Notes, Calendar, Wallet.
- **World/context:** Maps, Weather, Paasta/Search, Pastapedia, News.
- **Transactions:** Shop, Fettuccine/Rides, Sauce/Dating.
- **Media:** Music, Video, Recipes, Al Dente/Reviews.

This classification is provisional. It is useful for sequencing because each group exercises different platform contracts.

### App milestone rule

Each app is its own planning and delivery unit. Before an app is implemented, its purpose, routes, local data, shared data, context sources, actions, notifications, fallbacks, accessibility behavior, and acceptance tests must be specified. Work on the next app begins only after the previous app has passed its focused validation and the platform contract has been updated for any learned requirement.

### Web Search and the in-universe web

Web Search is more than a search form. It is the first app that proves the phone can open and navigate a coherent story-world web.

- The app's search site, named **Goodle**, is a deterministic Platform-safe shell. Its branding, search field, result layout, top bar, back behavior, loading states, empty states, and error states are hardcoded rather than generated.
- Goodle is preinstalled and available from the home screen's persistent search field.
- A submitted query creates a typed search request scoped to the selected phone, current chat, and allowed roleplay sources.
- Search results are structured records, not arbitrary HTML. Each result has a stable in-world URL, title, snippet, source label, relevance metadata, and an approved destination type.
- Result links are real navigable app routes. Selecting a result opens a deterministic web-page shell for the destination, preserves history, and uses the universal app top bar and back behavior.
- Generated pages may link to other approved in-universe pages. Links are resolved through a platform route registry and cannot escape to arbitrary domains, execute code, or access external network content.
- A generated page has a deterministic shell selected by page type, such as article, profile, business, forum thread, public notice, directory entry, or encyclopedia entry. The model fills bounded structured fields inside that shell.
- The web runtime owns URL parsing, origin/page ownership, route history, link validation, loading/error behavior, content escaping, and navigation. The model does not author page chrome or route behavior.
- The same in-world URL can resolve differently only when the declared chat/world scope says it should. Scope and provenance are part of the page request, so one chat cannot silently reuse another chat's generated web facts.
- Lorebook data is an explicit source for search and page generation when it is enabled and relevant. The current chat has priority over connected chats, which have priority over the optional Persistent World agent, followed by deterministic local fallback.
- Search and page generation may use current-chat facts, lorebook entries, phone history, connected-chat data, and World-agent data only through bounded route-specific context projection.
- Search results should distinguish established facts, source-backed story records, generated in-world possibilities, and no-result states where the story has not established an answer.
- If a query has no supported story-world answer, Goodle still renders a complete result state such as "No results established in this story" rather than inventing external real-world information.
- Opening a result is ordinary browsing and creates only the existing silent ambient activity. Sharing a page, copying a result into the story, or acting on a page is a separate explicit roleplay action.

Goodle therefore establishes an important 2.0 pattern:

```text
Hardcoded Goodle shell
  -> typed scoped search request
  -> structured in-universe result records
  -> validated internal links
  -> deterministic page-type shell
  -> bounded lorebook/chat/world content
```

This pattern can later support a broader in-universe web without requiring every site to be hand-built as a full app. Goodle itself remains one carefully designed app; the linked web pages use the Platform's approved web-page shells and content contracts.

### Website types and applied shapes

The in-universe web needs a small library of website types before it needs hundreds of individual websites. A website type describes the site's purpose, data model, routes, interactions, and content contract. A visual shape describes the reusable presentation structure applied to that type.

These are separate concepts:

```text
Website type: what the site is and what it can do
Visual shape: how the site's pages are structured and presented
Site manifest: this specific in-world site's identity and configuration
Content packet: scoped story data filling the selected shell
```

Initial website types could include:

- Search and directory
- News and publication
- Social feed and profile
- Messaging or community forum
- Personal blog or journal
- Business or local listing
- Shopping and marketplace
- Media/video or music library
- Encyclopedia or reference
- Public notice, service, or government portal

Initial visual shapes could include:

- Search results with filters and result detail.
- Editorial publication with headline, sections, article, and related stories.
- Feed with posts, profiles, reactions, and threaded detail.
- Directory with categories, profile/listing cards, and detail pages.
- Commerce catalog with products, prices, reviews, and order detail.
- Media library with collections, items, player/detail, and related content.
- Reference article with lead, facts, sections, and related links.
- Portal/dashboard with service summaries, notices, forms, and account sections.

In practical terms, a shape is a reusable screen composition. It is closer to a page pattern or interaction grammar than to a theme. The same shape can be used by different website types, and one website type can use several shapes across its routes.

Useful initial shapes include:

- **Search results:** query field, filters, result rows, snippets, pagination or load-more, and result detail entry.
- **Article:** headline, byline/source, timestamp, lead, sections, related links, and citation/reference area.
- **Wiki article:** article title, infobox, lead, section navigation, facts, references, revision metadata, and related articles.
- **Directory:** search/filter controls, categorized entries, compact identity or listing rows, and detail routes.
- **Profile:** identity header, avatar/media description, facts, biography, activity, relationships, and linked content.
- **Feed:** ordered posts, author identity, timestamps, reactions, replies, pagination, and post detail.
- **Thread:** original post, nested replies, participants, moderation/status metadata, and reply entry point.
- **Inbox:** folders or filters, message rows, unread state, sender, subject/preview, and message detail.
- **Conversation:** participant header, message timeline, composer, delivery/read state, and attachments or references.
- **Catalog:** categories, product or media cards, price/metadata, availability, and item detail.
- **Dashboard:** summary blocks, status rows, recent activity, shortcuts, and deeper section links.
- **Calendar/list:** date grouping, event rows, metadata, reminders, and event detail.
- **Gallery/grid:** albums or filters, fixed media tiles, captions, dates, and media detail.
- **Map/place:** location summary, place list, route/detail panel, distance, and local facts. The first version can use structured map presentation without requiring a real map tile service.
- **Player/detail:** artwork or media placeholder, title/creator metadata, primary playback or viewing state, queue/related items, and comments.
- **Form/flow:** labeled fields, validation, review state, submit action, success state, and recoverable failure.
- **Account/settings:** grouped settings rows, account summary, privacy controls, and secondary detail pages.

Shapes should be composable only where the combination is deliberate. For example, a wiki may use `Search results` for its search route, `Wiki article` for articles, `Directory` for category pages, and `Thread` for discussion. A news site may use `Feed` for its home route and `Article` for stories. The shape registry owns the common structure; the site manifest chooses which approved shapes each route uses.

The first version should ship a small, deliberate set of website types and shapes. A new in-world site is created by selecting a compatible type and applying one approved shape, then filling a site manifest with its name, domain, colors, logo/icon reference, navigation labels, tone, and established lore. The model may propose those bounded identity values, but the Platform validates and persists them.

- A type owns required routes, records, actions, source permissions, and content schemas.
- A shape owns layout primitives, responsive behavior, slot placement, loading/error/empty states, and accessibility behavior.
- A site manifest owns identity and allowed configuration within the type and shape limits.
- A content packet owns the current story-scoped values rendered into the shell.
- A site may use different compatible shapes for different route families, but the choice is explicit and cached rather than regenerated on every visit.
- An unknown site type falls back to the closest approved type and a complete generic shape; it never produces arbitrary page chrome.
- Cached type/shape/site decisions are scoped, versioned, size-limited, and invalidated when their contracts change.

This lets individual websites feel distinct while keeping their structure fast, consistent, testable, and friendly to small language models.

## Roleplay Context Model

Apps request context by function and route. They do not receive an undifferentiated transcript or arbitrary world dump.

A context request should identify:

- Current phone and owner.
- Current chat.
- Connected chats that are explicitly enabled.
- Whether the Persistent World agent is enabled.
- App and route.
- Requested record types.
- Maximum records, bytes, and field lengths.
- Whether private, participant-shared, or story-shared data is allowed.
- Whether the result may influence visible UI, local state, notifications, or chat writeback.

The platform resolves sources in the agreed order, retains source and timestamp metadata, removes disallowed records, and treats unavailable sources as omissions rather than fatal errors. Generated fallback content must clearly represent unknown or unavailable information rather than inventing certainty.

The current chat has priority because it represents the immediate scene. Connected chats can contribute only when the connection is enabled. Persistent World data supplies broader continuity but does not override the active scene.

### Graduated story awareness

Using the phone creates lightweight roleplay awareness without exposing everything viewed on it. The main chat may know that the phone owner looked at or used their phone, while ordinary private browsing remains private.

Awareness has three levels:

1. **Ambient interaction:** the story can know that an owner picked up, looked at, used, or put down a phone. It may also receive a broad activity category, such as opening Web Search, without receiving the query, results, route details, or visible content.
2. **Story-visible action:** an intentional action with an outward effect, such as showing a screen, sending something, publishing something, or changing shared state, may enter story context with the actor, action, recipient, and approved payload.
3. **Explicit content sharing:** screen text, search queries, results, private records, and other visible content enter AI or character context only through a deliberate sharing action or a narrowly approved app contract.

Rules:

- Merely scrolling, changing routes, opening results, or browsing around does not narrate every interaction or disclose screen contents.
- Ambient interaction is supplied silently as structured context to the next relevant AI generation. It does not create a visible narrator message, assistant message, system message, toast, or transcript entry.
- Silent ambient context is short-lived and compacted after use. It is not permanent story history unless a later explicit action or narration establishes it as relevant.
- Ambient events are compact and deduplicated so ordinary phone use does not flood the chat context.
- Ambient awareness identifies the actual phone owner. Looking through a character's phone must not be misreported as that character voluntarily using it.
- Inspecting another character's phone creates silent ambient context only when that character is present in the active scene. The event identifies the inspecting actor and the phone owner, for example "the persona looked through Mira's phone."
- Presence does not automatically mean the phone owner noticed the inspection. Actor, owner, scene presence, and noticed/unnoticed state remain separate fields so generation does not confuse physical presence with awareness.
- The AI decides whether a present phone owner notices the inspection based on the current scene. It receives the compact ambient action and relevant scene context, but not private screen contents unless those contents were separately shared.
- Notice is a structured roleplay outcome for the current generation, not a random client-side check. The outcome may influence character response, but it does not directly modify device or app state without a separate validated event.
- If the AI decides that a present character noticed, the character may react naturally in the next ordinary AI response. The reaction can be conversational, emotional, or physical within the established scene, such as asking what the persona is doing or taking the phone back.
- A noticed reaction does not require a separate user confirmation because it is a narrative response, not an automatic device mutation. Confirmation remains required for persistent phone changes, consequential device effects, or user-authored actions.
- The notice signal should be consumed by the next relevant generation and then compacted, so it creates an opportunity for roleplay without becoming a permanent surveillance record or repeatedly forcing the same reaction.
- Opening a private app does not reveal its content through the app name alone when that name would itself expose sensitive information; the Platform may reduce the event to "looked at the phone."
- Search queries and result contents are private until shared or used in a later story-visible action.
- Apps declare which actions are ambient, local-only, participant-visible, or story-visible; app code cannot silently promote local browsing into story context.
- The user can deliberately choose "Use as story context" or "Show this screen" when exact content should become known.

### Phone-to-story timing

Phone activity uses two timing paths so ordinary browsing does not interrupt roleplay while deliberate social actions remain responsive.

- **Passive activity** such as opening the phone, browsing, scrolling, switching routes, or checking a private app is queued as short-lived silent context for the next relevant chat generation. It does not trigger a response by itself.
- **Deliberate outward actions** such as showing a screen to a character, sending a message, publishing a post, taking an explicitly story-relevant photo, or confirming a consequential phone action may trigger an immediate AI response when the action's contract allows it.
- The immediate response receives the structured action, actor, target phone, recipient if any, approved visible payload, and relevant scene context. It does not receive unrelated private phone state.
- An action must never create both an immediate response and a duplicate pending response for the same action id.
- Local-only actions remain local and do not enter the story context unless the user explicitly chooses to share them.
- The user-facing UI must make the timing clear for an outward action before it is confirmed, using action-specific language rather than a generic "OK".
- If immediate generation is unavailable, the action is persisted as pending story context with a visible delivery state. The phone remains usable and the action is not silently discarded.
- A pending passive event is consumed once by the next relevant generation and then compacted. An outward action remains auditable in phone history according to its declared data ownership and retention policy.

### Notifications and phone presence

Notifications have both a device function and a roleplay function.

- An incoming notification is persisted as phone-local state for the target phone, including its app, owner, read state, timestamp, and approved preview.
- Notifications can appear on the lock screen, in the notification surface, as an app badge, and through app-defined in-app presentation.
- The phone has one system notification center owned by the Device layer. It aggregates notifications from all installed apps on the selected phone and provides the consistent review, open, acknowledge, and dismiss behavior.
- The primary Notification Center entry point is the notification/status area beside the clock on the left side of the status bar. Tapping that area opens the system notification surface for the selected phone.
- The lock screen is the locked presentation of the same notification system, not a separate notification store. It can show a limited, privacy-aware set of previews and pending indicators over the phone wallpaper.
- The unlocked Notification Center can show the full approved notification list and its actionable controls. The lock screen must not expose content that the phone's privacy settings restrict while locked.
- Tapping a lock-screen notification may wake or unlock the phone according to the phone's access state, but it must not bypass a story-established access lock.
- Notifications are presented as grouped app stacks on both the lock screen and the unlocked Notification Center. A stack identifies the app and can summarize its pending count without exposing private detail on the lock screen.
- Expanding a stack reveals its individual notifications according to the current privacy and access state. Individual records remain distinct underneath the visual grouping so each notification can be opened, acknowledged, or dismissed accurately.
- The first tap on a collapsed stack expands it. The next tap on an individual notification opens its declared app route. Tapping the stack header again may collapse it without opening the app.
- Keyboard and assistive-technology interaction provides the same two-step behavior: activate the stack to expand it, then activate an individual notification to open it. Expansion and selected state are announced semantically.
- Newer activity may raise an app stack without reordering unrelated stacks unpredictably; the Platform defines one stable chronological ordering rule for stack placement.
- App icons use a small dot as the default unread indicator. The dot communicates that one or more notifications are waiting without exposing counts or private content on the home screen.
- The dot remains on the specific app icon until that app's relevant notifications are acknowledged or dismissed according to the notification policy. Opening the app alone does not necessarily clear the dot.
- The notification center is the authoritative overview of pending notifications. App-specific notification views may provide richer detail, but they cannot replace or contradict the system acknowledgment state.
- A meaningful notification may also create bounded silent context for the next relevant AI generation. The context includes the event category and approved summary, not unrestricted private notification content.
- The notification contract declares whether an event is local-only, ambient story context, participant-visible, or story-visible. Receiving a notification must not automatically write a visible chat message.
- Notification delivery is scoped to the target phone. A notification received by one owner's phone does not appear on another phone unless the app explicitly models participant-shared delivery.
- While the phone overlay is closed, pending notifications may indicate activity through the Virtual Phone icon in the chat toolbar. The icon may blink or animate when a new notification is waiting.
- The toolbar indicator must also have a persistent non-animated cue, such as a badge, changed icon state, or accessible status text. Blinking cannot be the only indication.
- `prefers-reduced-motion` and device reduced-effects settings disable blinking and replace it with the static cue.
- Opening the phone does not acknowledge pending notifications and does not clear the toolbar indicator by itself.
- A notification is acknowledged when the user clicks it in the notification center or clicks through to the specific notifying app or notification entry. The acknowledgment target and timestamp are persisted on that phone.
- Acknowledging one notification does not automatically clear unrelated pending notifications. The toolbar indicator remains until all relevant notifications have been acknowledged or explicitly dismissed according to the app's notification policy.
- The notification center may provide a deliberate "clear" action for notifications that support dismissal, but clearing a notification does not imply that its underlying app content was read.
- Notification updates must be deduplicated by stable event id so background retries cannot create repeated badges, context records, or toolbar blinking.

## Roleplay Safety Boundaries

The following are foundation requirements unless explicitly changed later:

- A phone must never invent an action in the user's persona's voice.
- Character phones must preserve the distinction between character-authored and user-authored actions.
- One phone must not read another phone's private storage directly.
- The Persistent World agent must not be read when disabled.
- Connected-chat data must not enter a phone context unless the connection is enabled.
- Source provenance, chat identity, and phone-owner scope must be enforced before generation.
- Credentials, provider settings, hidden prompts, and private implementation details must never enter app context.
- App actions that affect the story must go through an explicit platform-mediated effect or writeback contract.
- Model failure, partial data, and unavailable context must not blank the device shell.
- Generated code must not execute arbitrary JavaScript or gain direct Engine access.
- Adult or otherwise sensitive app data must honor the relevant chat and app permissions.

## App Implementation Template

Each app plan should answer these questions before implementation:

1. What is the app's purpose in the story?
2. Which phone owners can have it?
3. Which routes and interactions are required for the first release?
4. What data is phone-local, story-shared, participant-shared, or permissioned-private?
5. Which context sources are allowed, in what order, and with what limits?
6. Which actions change local state?
7. Which actions create participant-visible effects?
8. Which actions may write back into the story, and in whose voice?
9. What notifications and background events can it produce?
10. What happens when the model, a source, or persistence is unavailable?
11. What deterministic fixture data proves the app works?
12. What accessibility and mobile interaction behavior is required?

## Resolved Planning Decisions

All previously open planning questions are resolved. The decisions below are binding for 2.0 unless deliberately revised.

### Foundation and device

**Development channel.** Branch `hold-the-phone`, cut from `origin/staging`. Catalog file `test-catalog.json` at that branch's repository root, consumed from `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/hold-the-phone/test-catalog.json`. The filename matches the current channel so the package builder needs no change; only the branch differs.

**Provisioning flow.** Agent Settings has one "Phones" section listing the persona (always enabled, not removable) and every character in the chat with a single toggle. Enabling mints a `phoneId` once and keeps it forever. Disabling hides the phone from the switcher without deleting its state. No wizard and no per-chat duplication.

**Provisioning-time controls.** Exactly two: enabled, and baseline theme. Installed apps, notifications, background events, story writeback, and private-data access use one per-phone default and are configured in the phone's own Settings app.

**Default device state.** Time is the current in-story time when the chat establishes one, otherwise real local time. Full cellular signal, Wi-Fi off, airplane mode off, battery 80%, not charging, connectivity online. Identical and deterministic for every newly provisioned phone.

**Background-agent authority.** The agent may change signal and connectivity, battery level and charging, time-of-day drift, and notifications silently. Persistent or permanent changes — damage, case, wallpaper, device name, access lock — require confirmation. Transient status is silent; persistent device state is confirmed.

**Reset, update, uninstall.** A per-phone reset in Settings clears installed apps, app data, notifications, theme overrides, and history while keeping `phoneId`, `ownerId`, and provisioning. A package update keeps everything and runs migrations. Uninstall removes all phone data including provisioning flags. Nothing survives uninstall.

**Overlay geometry.** Fixed portrait 9:19.5. Height `min(88vh, 860px)` with width derived from the aspect ratio. Bezel 12px with a 40px corner radius, docked right with a 24px gutter. Below a 640px viewport the overlay becomes full-width up to the same aspect cap while the chat stays behind the scrim. The layout never switches to a different presentation.

**Theme tokens and assets.** Tokens: `--vp-bg`, `--vp-surface`, `--vp-text`, `--vp-muted`, `--vp-accent`, `--vp-bezel`, `--vp-radius`. Icons come from one SVG registry with a 24px view box, `currentColor`, and 1.75 stroke width. Wallpaper defaults to a CSS gradient pair plus an optional pattern; images are optional. Pattern families are none, dots, grid, noise, and waves, each with intensity 0–3.

**Condition overlays.** Cracks, smudge/fingerprints, and blood ship first, as CSS/SVG layers above the glass with `pointer-events: none`. Settings has one "Reduce device effects" toggle that takes all of them to zero opacity, and `prefers-reduced-motion` disables animated ones automatically.

**Phone switcher.** The entry point is the owner name/avatar at the right side of the status bar, which opens a compact sheet of available phones. Unavailable phones still appear, dimmed, with a reason line such as "Locked in this scene" or "Not provisioned". A partial switch is never possible.

### Platform and roleplay

**Capabilities.** Seven: `storage.local`, `context.read`, `notify`, `share.screen`, `story.write`, `net.search`, `participants`. They are declared in the app manifest, granted at install from that manifest, and revocable per phone in Settings. There is no runtime permission prompt — an undeclared capability simply cannot be called.

**Action tiers.** Every action declares one of `local` (default), `ambient`, `participant`, or `story`. The `story` tier always requires confirmation. Tiers come from the manifest and cannot be promoted at runtime.

**Response timing.** Only `participant` and `story` actions with a named recipient trigger an immediate AI response. Everything else, including all ambient activity, rides the next ordinary chat turn. Apps cannot override this.

**"Show this screen" payload.**

```text
{ actionId, phoneId, ownerName, recipientId, app, routeTitle,
  summary: string (<= 400 chars),
  items: <= 10 x { label, value } }
```

It is a rendered summary of what is visible, never raw storage and never hidden fields.

**"Use as story context" payload.** The same shape without `recipientId` and with `sourceProvenance` added. It enters AI context rather than a character's knowledge and is labelled as such in the context block.

**Ambient event lifetime.** Events queue per chat, are consumed by the next generation, and are then deleted. At most 5 pending, deduplicated by `(actor, ownerId, category)` keeping the newest. Unconsumed events expire after 10 minutes without a generation. No permanent log is kept.

**Presence and notice.** An ambient event carries `actor`, `ownerId`, `ownerPresentInScene`, and `category`. The AI receives those fields plus ordinary scene context and decides in prose whether the owner noticed. No `noticed` flag is written back to device state; the reaction exists only in the response.

**Confirmation UI.** One Platform-owned sheet rendered inside the bezel, with a title naming the effect, a source line, a permanence line, and a verb button such as "Apply damage" or "Show screen to Mira" — never a generic "OK". Escape or dismissal counts as declining and leaves state unchanged. It is used for every persistent device change and every `story` action.

**Provenance.** Every context record carries `{ source: 'chat' | 'connected' | 'world' | 'lorebook' | 'local', sourceId, timestamp, confidence: 'established' | 'generated' }`. Precedence sorts by source order and then by timestamp descending. Apps may display these fields but cannot forge them.

**Character-phone privacy.** A character phone reads the same source list as the persona phone, scoped to its own owner. Another owner's `permissioned-private` records are filtered out by the Platform before the app sees anything, so "empty" and "private" remain distinct empty states. Provisioning alone grants access; there is no per-scene permission in 2.0.

### App runtime

**Manifest and lazy registration.**

```ts
export default {
  id, name, version, icon,            // icon = registry key
  category, capabilities: [...],
  modelUse: 'none' | 'light' | 'heavy',
  removable: boolean,
  routes: [{ id, path, title }],
  records: [{ type, ownership }],
  actions: [{ id, tier, immediate? }],
  content: { [routeId]: schema },
  notifications: { tier, dedupeBy },
} satisfies AppManifest
```

Manifests are small and eagerly bundled; `shell.tsx` sits behind `() => import('./shell')`. The registry holds the manifest and the loader and nothing else.

`modelUse` declares how much the app depends on model generation and is surfaced in the App Store detail route as plain language: "Works without a model", "Uses the model lightly", or "Model-heavy". Settings and App Store are `none`; Web Search is `heavy`.

**Shared versus app-owned components.** The Platform owns the top bar, bottom navigation, list, row, card, button, field, sheet, dialog, empty/loading/error/offline states, media frame, badge, and icon. Apps own only content composition inside the viewport. An app needing a new primitive proposes it to the Platform rather than forking one.

**Persistence API.**

```ts
const store = usePhoneStore(appId)   // scoped to (phoneId, appId)
store.get(key) / set(key, value) / list(prefix) / remove(key)
```

Values are JSON, limited to 256KB per app per phone, accessed asynchronously, with no direct storage handle. Scoping is enforced by the Platform, not by app-side key prefixes.

**App lifecycle states.** `available → installed → active`, plus `disabled` and `failed`. A failed load renders an in-app error card with retry while the home-screen icon shows a warning state. Removal deletes the manifest registration and, after one confirmation, that phone's app data. An update is a manifest version bump plus a migration hook, never a reinstall.

**Permanent system apps.** Settings and App Store are preinstalled on every phone with `removable: false`. They have no remove action, cannot be uninstalled through the App Store or a phone reset, and their capabilities are not revocable, so a phone can never be left without a way to configure or install anything. Web Search is preinstalled but removable and reinstallable from the App Store.

**Top-bar actions and history.**

```ts
{ id, icon, label, kind: 'button' | 'menu', disabled?, reason? }
```

At most two trailing actions plus an optional overflow menu. The Platform owns a per-app route stack; back pops it and a root-level back returns home. Putting the phone down preserves the stack per phone.

**Bottom navigation.**

```ts
tabs: [{ id, route, label, icon }]   // 2-5 tabs, labels required
```

Selecting the active tab pops that tab to its root — one Platform-wide rule. Each tab keeps its own navigation stack and scroll position across tab switches and put-down.

**Small-model content contract.** Each route uses a flat JSON object with at most 8 fields, strings at most 300 characters, arrays at most 10 items, and no nesting beyond one level. The prompt contains the route schema plus bounded context and requests JSON only, never templates. Parsing extracts the first JSON object, coerces types, clamps lengths, drops unknown keys, and escapes on render. Any failure falls back silently to the route's declared defaults, so the shell always renders.

**App testing.** Each app has `apps/<app-name>/tests/`, run through the existing test runner with a path filter, importing only that app's manifest and shell against a fake Platform. The build stays one package with lazy chunks per app and a single artifact. Per-app build outputs are deliberately skipped; the boundary is enforced by tests and imports.

### First apps and in-universe web

**Settings sections.** Five, and no more for the first milestone: Device (device name, wallpaper, theme tokens, pattern family and intensity), Effects (condition overlays, reduce device effects, reduce motion), Notifications (per-app toggle, lock-screen previews), Privacy (per-app capability revocation, ambient-awareness toggle), and Reset (reset this phone).

**App Store behavior.** List catalog apps and install or remove them per phone, plus search and category filtering, an app detail route showing declared capabilities, data ownership, and `modelUse`, and an "Installed" tab. No ratings, no update UI, no featured content, no currency.

**Goodle behavior.** A query field on the home screen and in the app. Per-phone query history of the last 50 queries, clearable from Settings → Privacy. Results are cached per `(chatId, phoneId, normalizedQuery)`. Offline, history and cached results remain visible and marked "Cached" while new queries show a stable offline state with retry.

**Initial website types.** Four: search/directory, news/publication, encyclopedia/reference, and business/local listing.

**Initial shapes.** Five: search results, article, wiki article, directory, and profile. Every other shape waits for a real site that needs it.

**Site manifest.**

```ts
{ siteId, domain, name, type, routes: { [family]: shapeId },
  identity: { accentColor, iconKey, tagline }, scope: { chatId }, version }
```

The model may propose `name`, `domain`, `identity`, and `tagline`; the Platform validates and persists them. Type and shape always come from the registries.

**Cache scope and invalidation.** Keyed by `(chatId, siteId, route)` and versioned by `contractVersion + siteManifest.version`. Invalidated on a contract bump, a site-manifest change, or an explicit chat reset. At most 200 pages per chat under LRU eviction. Caches are never shared across chats.

**URL forms.** `goodle://` for search and `web://<domain>/<path>` for pages. Domains must exist in the site registry for the current chat scope; links that do not resolve render a dead-link state. `http` and `https` URLs and external fetches are never permitted.

**Shared web runtime.** One `WebRuntime` owns URL parsing, registry resolution, history, caching, loading/error/dead-link states, and escaping. It selects a shape component through `routes[family]` and hands it a validated content packet. Article, wiki, directory, and profile are shape components with no routing logic of their own.

**Fact classification.** `established` means backed by the current chat, a lorebook, or a persisted prior page. `generated` means model-produced in this session and persisted with that label. `unknown` means no source and no plausible generation, producing the "No results established in this story" state. The label is part of every result record and appears in the UI as a subtle source line.

### Later apps and migration

- The first app after the base three is Messages, because it is the first participant-shared app and exercises the largest unproven contract.
- Mandatory for 2.0: the phone overlay, home screen, status bar, notifications, and Web Search. Redesigned: Settings, App Store, and every app. Every other current feature is retired until it earns its own milestone.
- Only apps with a written brief are rebuilt as independent 2.0 apps. There is no bulk port.
- No 1.x data migrates into 2.0.
- There is no coexistence requirement. The 1.x branches, package, and catalog were retired before 2.0 implementation began, so 2.0 is the only Virtual Phone. Testers with an installed 1.x package keep whatever they already downloaded, but it receives no further builds and 2.0 neither reads nor upgrades its data.
- 2.0 uses its own package id, catalog, and storage namespace regardless, so an old local install cannot collide with it.

## Decisions Before Basic Implementation

Before writing the Device shell or first app, the planning pass should settle:

- Exact phone identity, owner identity, provisioning, and character-phone configuration.
- What survives putting the phone down, chat navigation, Engine reload, package update, and uninstall.
- The device lifecycle: open, put down, wake, lock, story access-lock, reset, and recovery.
- The exact boundaries between Device, Platform, system surfaces, app modules, and transient overlays.
- The universal top bar contract and the optional unified bottom-navigation contract.
- Home-screen geometry: status bar, Web Search placement, wallpaper region, grid, dock, pages, and app library.
- Theme tokens, SVG icon registry, background/pattern definitions, wallpaper sources, and condition overlays.
- Dynamic status capabilities and which events are allowed to change them.
- Notification records, grouped stacks, dots, acknowledgment, lock-screen privacy, and toolbar indication.
- App manifest shape, independent file/module layout, lazy-loading behavior, failure isolation, and versioning.
- App installation, removal, updates, disabled apps, and what remains in phone-local storage.
- Content-shell contracts for small models: schemas, limits, fallback data, validation, escaping, and no-model behavior.
- Roleplay awareness levels, silent context lifetime, explicit sharing, immediate-response actions, and confirmation rules.
- Current-chat, connected-chat, Persistent World, and phone-local source permissions and precedence.
- Accessibility requirements for overlays, lock screens, themes, motion, contrast, keyboard use, and screen readers.
- The first Settings surface, first App Store surface, and first Web Search app design briefs and acceptance tests.

No additional app should be started until these shared contracts are stable enough that the first app can be built without inventing its own rules.

## Implementation Start Gate

We do not need to fully design every future app before writing the first foundation code. We do need to settle the contracts that the Device shell and every app will depend on.

All gate items below are resolved in "Resolved Planning Decisions". The lists remain as the review checklist for the start of implementation.

### Must be decided before Foundation 1

- Dedicated branch name and stable 2.0 development catalog URL.
- Exact phone identity and owner identity model.
- Persona-phone and character-phone provisioning behavior.
- Device lifecycle and persistence guarantees.
- Device, Platform, system-surface, app-module, and transient-overlay boundaries.
- Phone overlay geometry, bezel, theme layers, home screen, status bar, lock screen, and put-down/resume behavior.
- Universal top bar and optional bottom-navigation contracts.
- Installed-app registry and independent app-module loading model.
- Minimum phone-local storage shape and reset/update/uninstall behavior.
- Notification record, stack, dot, acknowledgment, and toolbar-indicator model.
- Capability model for network status, locking, sharing, context, and story effects.
- Basic accessibility, reduced-motion, reduced-effects, and contrast rules.

### Must be decided before Foundation 2

- Versioned app manifest shape.
- App route and navigation contract.
- App shell/content-slot contract for small models.
- Structured response parsing, limits, escaping, fallback, and failure behavior.
- Context-source adapter contract and source precedence.
- Event identity, deduplication, expiration, and persistence rules.
- Confirmation model for device changes, sharing, and story effects.
- Error isolation when an app module or content source fails.

### Must be decided before Web Search

- Goodle shell and search interaction.
- Initial website types and reusable shapes.
- Site manifest and cached type/shape decision format.
- In-world URL and internal-link rules.
- Lorebook, current-chat, connected-chat, World-agent, and phone-local scope rules.
- Search result provenance and distinction between established facts, generated possibilities, and no result.
- Page cache lifetime, invalidation, and cross-chat isolation.
- Which page actions are local, ambient, explicit-share, participant-visible, or story-writeback actions.

### Can wait for later app milestones

- Exact Messages data model and interaction depth.
- Gallery media representation and sharing behavior.
- Contacts, Calendar, Maps, Wallet, social, commerce, and media app designs.
- Additional website types and shapes beyond the initial Web Search proof set.
- Full migration of selected 1.x behavior or data.
- Expanded device-condition effects beyond the first theme and appearance contracts.

The practical implementation start point is therefore: lock the Device contract, create the dedicated 2.0 development channel, build the shell, and use Settings/App Store/Web Search as separate proof milestones. Future apps should refine the Platform through explicit contracts rather than being prebuilt in bulk.

## Repository and Release Workflow

No implementation or generated package rebuild is part of this planning milestone.

### Dedicated 2.0 development channel

Virtual Phone 2.0 development uses its own dedicated branch and catalog URL. The former `virtual-phone-test-catalog` channel has been retired along with the 1.x line and must not be recreated.

The 2.0 development channel is:

- Branch: `hold-the-phone`, cut from `origin/staging`.
- Catalog: `test-catalog.json` at that branch's repository root.
- URL: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/hold-the-phone/test-catalog.json`

Before 2.0 implementation begins:

1. Create the `hold-the-phone` branch from the repository's `staging` baseline.
2. Generate its `test-catalog.json` through the package builder.
3. Configure the compatible Marinara Engine test environment to consume that URL.
4. Keep the branch and URL unchanged throughout foundation and app-by-app development so testers do not need to repeatedly reconfigure their Engine.

The development catalog is a long-lived testing channel, not a substitute for the repository's eventual `staging` and stable publication workflow. Promotion from the 2.0 development branch occurs only after the planned foundation, focused validation, migration decision, and release review are complete.

### Development version policy

Development starts at the lowest valid 2.0 package version: `2.0.0`.

- Each publishable development build increments only the patch component: `2.0.0`, `2.0.1`, `2.0.2`, and so on.
- Do not increment the minor or major component merely to mark milestones, app additions, catalog rebuilds, or test rounds during 2.0 development.
- Increment the patch only when a new generated package is intentionally published to the dedicated development catalog and testers need update detection.
- Planning-only changes do not increment the package version.
- Failed, local-only, or unpublished builds do not consume a version.
- One published version identifies one synchronized source, generated client/server payload, manifest, artifact ZIP, and development-catalog entry.
- A minor or major version change requires a deliberate product/release decision outside this default development sequence.

The package builder remains the source of truth for generated version metadata. Generated manifests, bundles, artifacts, hashes, sizes, and catalogs must never be hand-edited to implement this version policy.

When implementation begins, it must follow the repository workflow:

- Start from the appropriate `staging` branch and link the work to an issue.
- Use a draft PR while implementation is in progress.
- Build source changes into generated client/server payloads through the package builder.
- Never hand-edit generated bundles, archives, hashes, or catalogs.
- Keep foundation and app changes independently buildable where possible.
- Run focused Virtual Phone regression tests plus catalog lanes, catalog validation, and `git diff --check` at the release gate.
- Record actual install, update, restart, offline, and uninstall verification separately from automated tests.

The 1.x development line and its catalog URL have been retired along with their branches. No part of the older channel constrains this effort, and the dedicated `hold-the-phone` channel described above is the only Virtual Phone development channel.
