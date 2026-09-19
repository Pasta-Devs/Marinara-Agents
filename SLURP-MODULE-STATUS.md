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
