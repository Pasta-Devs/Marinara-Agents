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
