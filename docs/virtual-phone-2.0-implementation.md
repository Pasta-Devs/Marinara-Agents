# Virtual Phone 2.0 Implementation Slices

Companion to `virtual-phone-2.0-plan.md`. The plan owns the decisions; this document owns the order they get built in.

Each slice below is one commit. A slice is done when it builds, its tests pass, and the phone is still usable — never "done except it renders blank until the next slice". Work top to bottom. Do not start a slice while an earlier one is unfinished.

Commit format follows the repo convention: `<type>(virtual-phone): <summary>`.

## Ground rules for every slice

- The device shell must render and be usable with zero apps installed and zero model responses. Every slice preserves that.
- No generated artifacts are hand-edited. Bundles, manifests, hashes, and catalogs come from the package builder.
- Each slice that adds non-trivial logic leaves one runnable check behind. No new test framework.
- A slice that turns out to need a decision the plan does not cover stops and asks. It does not invent a contract.

## Foundation 1: Device shell

The goal is the smallest complete device: a phone you can open, look at, switch, and put down, containing nothing.

### F1.1 — Package skeleton

`chore(virtual-phone): scaffold 2.0 package at 2.0.0`

Create `packages/virtual-phone/` with its package metadata at version `2.0.0`, the `src/phone/{device,platform,system,apps}/` directory boundary from the plan, and an entry that renders nothing. Register it with the package builder and produce one generated build to prove the pipeline works end to end.

Done when: the builder produces a valid package and the catalog validates. Nothing is visible in the Engine yet.

### F1.2 — Phone identity and storage

`feat(virtual-phone): add phone identity and phone-scoped storage`

The `phoneId` / `ownerId` / `ownerName` / `chatScope` / `deviceName` record, minted once per owner and persisted. The phone-scoped storage boundary underneath it — the namespace, not yet the app-facing `usePhoneStore` API.

Done when: a phone record survives an Engine reload and a second chat. Test: mint, reload, assert the same `phoneId`.

### F1.3 — Provisioning and Agent Settings

`feat(virtual-phone): provision persona and character phones from Agent Settings`

The "Phones" section: persona always enabled and not removable, one toggle per character, baseline theme picker. Enabling mints a phone; disabling hides it without deleting state.

Done when: toggling a character off and on returns the same `phoneId` with its state intact.

### F1.4 — Overlay, bezel, scrim

`feat(virtual-phone): add the docked phone overlay and device bezel`

The right-docked overlay at 9:19.5, `min(88vh, 860px)`, 12px bezel with 40px radius, 24px gutter, full-width below 640px. Chat scrim and blur, background controls made inert, focus moves in on open and returns to the opener on close. The "put down" control and Escape.

Contains no phone content yet — an empty lit screen inside a correct device.

Done when: open, put down, and reopen preserve focus behaviour and do not disturb the chat. Test: geometry and focus-return.

### F1.5 — Theme layer

`feat(virtual-phone): add device theme tokens and background layers`

The seven `--vp-*` tokens, the gradient-pair wallpaper default, the five pattern families with intensity 0–3, and the layered background model. Per-phone, so two phones look different.

Done when: changing one phone's theme leaves the other unchanged.

### F1.6 — Status bar

`feat(virtual-phone): add the device status bar`

Time, cellular, Wi-Fi, airplane, battery, charging — reading the selected phone's state, with the plan's defaults (full signal, Wi-Fi off, battery 80%, not charging, online). Stable icon dimensions, accessible names alongside icon shape. No battery simulation loop, and no random values.

Done when: switching phones swaps the whole bar. Test: defaults are deterministic and identical for a new phone.

### F1.7 — Phone switcher

`feat(virtual-phone): add the phone switcher sheet`

The owner avatar at the status bar's right opens the compact sheet. Available phones switch; unavailable ones render dimmed with a reason line. No partial switch is reachable.

Done when: switching changes identity, status, and theme together, and a disabled phone cannot be selected by keyboard either.

### F1.8 — Lock screen

`feat(virtual-phone): add the basic lock screen`

Wallpaper, in-story time and date, status indicators, and the notification preview region left empty for now. No passcode or biometric step. Put-down does not force a re-lock; lock state is separate from overlay visibility.

Done when: unlocking resumes the previous surface rather than going home.

### F1.9 — Home screen

`feat(virtual-phone): add the wallpaper-first home screen`

Status bar, the Web Search field position near the top, the reserved uninterrupted wallpaper region, and the fixed app grid — rendering its empty state, because no apps exist yet. Empty grid positions stay empty. The search field is present but inert until Web Search ships in Foundation 3.

Done when: the home screen is complete and attractive with zero apps installed.

### F1.10 — Installed-app registry and launch boundary

`feat(virtual-phone): add the installed-app registry and launch boundary`

Per-phone installed-app list, plus the seam an app is launched through and the loading and failure surfaces around it. No app implementations and no manifest contract yet — a fixture app proves the seam and then stays in tests.

Done when: a fixture app opens, a deliberately failing fixture shows the failure surface, and the device stays usable in both cases.

### F1.11 — Device settings surface

`feat(virtual-phone): add device-local settings`

The device-local settings surface for what exists so far: device name, wallpaper, theme, pattern, reduce device effects. This is a Device surface, not the Settings app — that arrives in Foundation 3 and takes these over.

Done when: every setting persists per phone across a reload.

### F1.12 — Condition overlays

`feat(virtual-phone): add physical condition overlays`

Cracks, smudge, and blood as `pointer-events: none` layers above the glass. The reduce-device-effects toggle takes them to zero; `prefers-reduced-motion` disables animated ones.

Done when: every overlay at full intensity still leaves controls reachable and text readable.

### F1 gate

Publish `2.0.0` to the development catalog and verify install, update, restart, offline, and uninstall by hand. Foundation 2 does not begin until the shell has been used in a real chat.

## Foundation 2: Platform runtime

Sliced properly once F1 is real. The headline slices are expected to be:

1. Versioned app manifest and the lazy-module registry.
2. App lifecycle and the per-app route stack.
3. The universal top bar and its action descriptors.
4. `usePhoneStore` — the phone-scoped persistence API.
5. Optional bottom navigation with per-tab state restoration.
6. Capability declaration, granting, and per-phone revocation.
7. Context projection with source precedence and provenance.
8. Notification records, stacks, dots, acknowledgment, and the toolbar indicator.
9. The small-model content contract: schemas, parsing, repair, and deterministic fallbacks.
10. Error isolation — one failing app module leaves everything else usable.

Foundation 2 uses fixtures and one minimal test app. It does not implement catalog apps.

## Foundation 3: First apps

Three separate milestones, each with its own design brief, slices, tests, and review. Never a bulk pass.

1. **Settings** — proves device-local persistence and theme configuration. `modelUse: 'none'`, `removable: false`.
2. **App Store** — proves per-phone installed state and platform-owned lifecycle. `modelUse: 'none'`, `removable: false`.
3. **Web Search / Goodle** — proves routes, input, structured content, source precedence, and deterministic no-model behaviour. `modelUse: 'heavy'`, preinstalled but removable.

Messages follows, as the first participant-shared app. Everything else waits for a brief.

## Version policy during implementation

Development starts at `2.0.0` and increments the patch only when a build is intentionally published to the development catalog for testers. Slices that are not published do not consume a version. Milestones do not justify a minor bump.
