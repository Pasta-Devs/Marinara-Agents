# Slurp2 Slice 13 Status

## Scope

Rename Slurp2 operation routes from `/api/slurp2/noodler/*` to `/api/slurp2/slurp/*`.

## Gates

- Preconditions pass. Slice 12 is in `origin/staging`. Slurp2 has no `components/slurp/` directory
  and no reclassified Noodle import. The staging route inventory has 179 routes.
- Stored URL gate pass with four retained GET paths:
  `/api/slurp2/noodler/accounts/:id/avatar/:fileName`,
  `/api/slurp2/noodler/accounts/:id/banner/:fileName`,
  `/api/slurp2/noodler/ads/:id/image/:fileName`, and
  `/api/slurp2/noodler/posts/:id/media`. Account rows, Garnish records, post rows and backups may
  contain these URLs. No migration is added.
- External caller gate pass. Engine, legacy `slurp`, `noodle`, agent definitions, docs and
  non-Slurp2 tests do not call `/api/slurp2/noodler/*`. Slurp2-specific verification tests are
  updated with the route rename.
- Update transition gate pass. `packages/slurp2/manifest.json` requires an Engine restart.
- Legacy isolation gate pass. Legacy packages use separate route prefixes. New routes remain under
  `/api/slurp2/slurp/*`.

## Mapping

Every Slurp2 route changes only the path segment `/noodler/` to `/slurp/`, except the four retained
GET media routes listed above. Methods, parameters, queries, bodies, response shapes, status codes
and handlers remain unchanged.

## Permanent names

The remaining NoodleR names are permanent for Engine contracts, persisted names, locale keys, the
`"noodler"` platform value, and the four retained media routes required by stored URLs and backups.

## Validation

- Package version: `0.1.3`.
- Artifact: `artifacts/slurp2-0.1.3.zip`, `6783886` bytes, SHA-256
  `85fb8d871568ba8bf6dea7e9a2d3d5df0c75b2b7d57b167faab1d4ea5a80e9d3`.
- Engine build worktree: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `92f3eaa5fdd18ba6e56bb2f7548a6cfd66258670`, clean at final
  inspection. Its `origin/staging` is `57499fcb2b2b9f2f470b7ae6155266ff42046eff`; the merge base
  is `c324acfdda22475e743c8d026860d38ee3700452`. No reset or clean was used.
- Route proof: 179 routes, method counts `DELETE 11`, `GET 59`, `PATCH 14`, `POST 90`, `PUT 5`,
  unchanged handler counts, independent `origin/staging` route fixture, and failing method/removal
  fixtures.
- Client proof: independent `origin/staging` request fixture and unchanged eleven wiring counts.
- `node scripts/typecheck-packages.mjs slurp2` passes.
- Catalog lane, package locale, locale key, catalog, release-note, and `git diff --check` gates pass.
- Full independent regression comparison: clean staging `173/196` pass and `23` fail; this branch
  also has `173/196` pass and the same `23` failures. No new regression failure.
- Browser suite: the Engine servers started, but the host Chromium pages crashed or failed to expose
  the Slurp tab. The suite did not provide route proof. This remains an environment gap.

## Live proof

- Production installed `0.1.2`, created a temporary profile with an avatar, created a post with an
  image, changed a setting, subscribed a viewer, sent a message, and made a backup.
- Production updated to `0.1.3` and restarted successfully. New `/api/slurp2/slurp/*` routes and
  all four retained `/api/slurp2/noodler/*` media routes returned success. Existing avatar and post
  image bytes rendered after the update.
- The `0.1.2` backup inspection and restore completed on `0.1.3`: 34 creators, 233 posts, and 222
  media files restored.
- Post-update viewer, feed, settings, subscribe, message, and new profile/post/media/share-card
  operations passed. Legacy `/api/noodle/accounts` remained healthy.
- The legacy Slurp package was not installed in production, so legacy Slurp runtime checks were
  not possible. Its source and generated package remain unchanged in this branch.
- Restart and offline-style restart passed. The Engine was disconnected from its Docker network
  during restart, reconnected, and returned healthy.
- The temporary profile and posts were deleted after proof. Production remains on `0.1.3`.

## Follow-up Fix In This PR

- User report reproduced. Manual post requests carried `format`, but the strict shared create-post
  schema did not declare that key. The server rejected JSON and multipart manual posts with
  `Unrecognized key(s) in object: 'format'`.
- Fixed the shared Slurp2 schema to accept `caption`, `announcement`, and `long_form`, while still
  rejecting unknown values. Added `slurp2-manual-post-format.regression.ts`.
- Version remains `0.1.3`. The package was rebuilt in place. New artifact SHA-256 is
  `533ac3160a89488d7a4a459caec0649ac83cc7f22bf244a196d9d7d2053cba2b`; size is `6784038` bytes.
- The fix passed the focused regression and Slurp2 typecheck. Production verification of the
  rebuilt same-version package is pending.

## Second Follow-up Fix In This PR: Creator Profile Controls

- User report: every control on a Creator profile threw `Uncaught TypeError: K is not a function`
  on click. Back on mobile, Message, Subscribe, and Unsubscribe were all dead.
- Root cause: a stray edit placed `onNavigate` inside the `updateNoodlerPostDraft` setState
  object in `slp-home-state.ts`, so the Home model never returned it. `SlpHomeCreatorFlow`
  destructures `onNavigate` from that model, so every control that navigates called `undefined`.
  TypeScript does not catch this, because the destructured key is only inferred, never declared.
- Fix: return `onNavigate` from the Home model and remove the stray key from the drafts map.
- Proof: `tests/slurp2-home-model-keys.regression.ts` asserts the model exposes `onNavigate`,
  that the drafts map carries no navigation callback, and that every model key each Home screen
  destructures exists in the model's return. It fails when `onNavigate` is removed again.
- Version remains `0.1.3`. The package was rebuilt in place. Artifact SHA-256 is
  `7a189c7f4bf2490b6702851ceb90c1d7315182024570084df7f56436f406ed65`; size is `6784060` bytes.
- Production runs the rebuilt `0.1.3`. The served client bundle is byte-identical to the built
  `packages/slurp2/client.js`. Clicking the controls in a browser could not be verified from this
  host; see the browser gap below.

## Known Gap: Browser Verification On This Host

- The Playwright Chromium was missing five shared libraries. They were resolved from the Debian
  index into `/tmp/pwlibs/root`: `libavahi-common3`, `libavahi-client3`, `libthai0`,
  `libdatrie1`, and `libgraphite2-3`. Chromium now launches and loads the Engine.
- The Engine application still does not mount here. Every core asset fails with
  `net::ERR_INSUFFICIENT_RESOURCES`. The host is out of resources: `/tmp` is a full 7.8 GB
  tmpfs and swap is exhausted. This is a host limit, not a package defect.
- The gap is closed by CI, not by this host. The `Slurp Remastered package browser` job passes on
  this branch, so the browser suite is green and the failure was environmental throughout.

## Out Of Scope: Claude Agent SDK Native Binary

- Separate user report on Windows: Slurp2 subscription calls fail with
  `Native CLI binary for win32-x64 not found`.
- Cause: `server.mjs` bundles `@anthropic-ai/claude-agent-sdk`, so its
  `createRequire(import.meta.url)` lookup starts in the package version directory and finds an
  `@anthropic-ai` tree without the optional platform package. The Engine's own copy resolves.
- The likely fix mirrors the existing `--external:undici` precedent in the builder: resolve the
  SDK from the Engine install instead of bundling it. That changes package runtime resolution,
  which is install-behaviour and security-sensitive, and it needs Windows validation. It does not
  belong in this route-rename PR.
