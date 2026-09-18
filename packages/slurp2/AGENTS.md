# Slurp2 package rules for coding agents

These rules apply to any change under `packages/slurp2/`. They add to the repository rules in the
root `AGENTS.md`, `.github/agents/chai-workflow.md`, and `CONTRIBUTING.md`; they do not replace them.

1. Read `docs/architecture/README.md` before editing Slurp2 source. Use
   `docs/architecture/ADDING-A-MODULE.md` when you add or move a module.
2. Place new source in the `slp` roots and layers the guide names. Do not add a new top-level
   domain, a generic `index.ts` barrel, a re-export shim, or a second copy of a moved file.
3. Run the architecture regression after every structural change:

   ```bash
   tsx --tsconfig tests/tsconfig.regressions.json tests/slurp2-architecture.regression.ts
   node scripts/typecheck-packages.mjs slurp2
   ```

4. When payload source changes, bump the Slurp2 patch version in
   `scripts/build-feature-packages.mjs` once per PR and rebuild with
   `node scripts/build-feature-packages.mjs slurp2` (set `MARINARA_ENGINE_ROOT`). Never hand-edit
   `client.js`, `server.mjs`, `manifest.json`, the artifact ZIP, catalogs, hashes, or sizes.
5. When you intentionally change a boundary, update `docs/architecture/README.md`, append an entry
   to `docs/architecture/DECISIONS.md`, and update the architecture regression in the same PR.
6. While the modular refactor is open, slice PRs target the `modular-simping` integration branch,
   not `staging`; only the final `0.1.0` release PR targets `staging`. Update
   `SLURP-MODULE-STATUS.md` at the repository root when you start a slice, after each material
   discovery, and before handoff. `SLURP-MODULE-PLAN.md` is
   the architecture source of truth; change it only for a verified fact or an approved decision.
