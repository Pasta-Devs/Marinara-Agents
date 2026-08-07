# Device shell — fourth-pass findings

Pass over `index.tsx` (520 lines), the `device/` layer, and the security posture — the last
unreviewed surface.

---

## 1. Adding an app means editing seven hardcoded places — and we're adding one — `blocker for 17-calls`

`index.tsx` registers every app into `phoneAppRegistry`… and then ignores it for rendering. Each app
is hardcoded at **seven** sites:

1. `React.lazy(...)` const (line ~29-41)
2. `phoneAppRegistry.register({...})` (line ~43-55)
3. the `ActiveApp` union type (line ~82)
4. the `styledAppIds` set — **third copy** of the icon map
5. the `optionalApps` array (label + icon)
6. a render line: `{activeApp === "x" && selectedPhone && deviceSettings.installedApps.includes("x") ? <AppErrorBoundary>…` — thirteen near-identical ~300-character JSX lines
7. `apps/app-store/shell.tsx`'s own duplicate `appGlyphs` map

`InstalledAppRegistry` exists precisely to prevent this and is **decorative** — its only real consumer
is the App Store list. The render path is a hand-written `activeApp === …` chain.

**This blocks `17-calls.md` cheaply becoming real.** Collapse the render chain to a registry-driven
lookup (id → component + props) before adding a fourteenth app, or the same seven-site edit gets paid
again — and a fifteenth time after that.

## 2. Notifications only load when the phone is open *and* on the home screen — `blocks 15-rp-integration`

```
React.useEffect(() => {
  if (!open || !selectedPhone || activeApp !== null) { ... return; }
  void phoneRequest(`/phones/${...}/notifications`) ...
}, [open, selectedPhone?.phoneId, activeApp]);
```

Nothing polls while the phone is **closed**, and nothing polls while you're **inside an app**.

`15-rp-integration.md` decided characters text you unprompted mid-scene. As built, you would never
find out — the buzz can't reach you, because nothing is listening unless you already have the phone
open on the home screen. **The unprompted-text feature is inert without fixing this.**

Good news: a **lock screen with a notification list already exists** (`session.surface === "lock"`,
tappable notification cards that unlock straight into the app). The surface is built; only the
delivery is missing.

## 3. The status bar is permanently fake

`device/status.ts` → `defaultPhoneStatus()` returns a hardcoded `batteryLevel: 80`, and the status bar
renders a fixed "full signal, Wi-Fi off" cluster. Battery never moves, signal never changes.

Small, but it's the most-looked-at pixel row on the device.

**Decided (tester thread): the status bar is story-driven, not simulated.** Battery stays at 80% until
**the model changes it to fit the story** — same for cellular bars. Not drifted over session time, and
explicitly **not** read from the host device's real battery: that was the tester's first guess and it's
wrong for a device that belongs to a character, not to you (and meaningless on a desktop). A phone
dying at the wrong moment should be a plot beat someone chose.

Same mechanism as the existing screen overlays (cracked, blood), which the model already drives, and it
feeds the owner-shaped-phone work in [`20-tester-feedback.md`](20-tester-feedback.md) §1 — a neglected
character's phone starts the scene at 4%.

The clock fix in §4 stands on its own; that one really is just wrong.

## 4. The clock can be 30 seconds wrong

`useClock` ticks on a 30s interval rather than aligning to the minute boundary, so the displayed time
lags by up to 30 seconds. One-line fix; it's the other most-looked-at pixel.

## 5. Accessibility of the shell is genuinely good — no action

Worth recording so nobody "fixes" it: hand-rolled focus trap with Tab wrapping, `inert` applied to
background body children, focus restored to the opener on close, `role="dialog"` + `aria-modal`,
labelled switcher listbox, per-app error boundaries with `role="alert"`. This is careful work.

The gaps are inside the apps (`alt=""` in Gallery — see `02-gallery.md`), not the shell.

## 6. Security posture — checked, no finding

`platform/api.ts` sets a static `x-marinara-csrf: 1` and reads `marinara_admin_secret` from
localStorage. Both follow the Engine's own conventions: `utils/security.ts` uses a fixed
`CSRF_HEADER_VALUE` plus `CSRF_TRUSTED_ORIGINS` — the standard custom-header + origin-check defence,
which is sound (a cross-origin page can't set custom headers without a CORS preflight). Not a token
scheme, and it doesn't need to be. The phone is consistent with the host.
