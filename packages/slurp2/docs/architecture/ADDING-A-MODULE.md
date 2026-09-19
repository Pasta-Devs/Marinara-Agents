# Adding or moving a Slurp2 module

Use this checklist with `README.md` in this folder.

1. **Find the owning domain.** Use the feature list in `README.md`. If the code does not fit an
   existing feature or submodule, stop and propose a decision in `DECISIONS.md`; do not invent a
   new top-level domain during implementation.
2. **Start feature-local.** Put the file inside the owning `features/<name>/` folder on the client
   or server. Name it `slp-name.ts(x)` or `SlpName.tsx`.
3. **Promote only with a reason.** Move client presentation to `modules/` only when a second real
   feature uses it, or when it is an explicit domain primitive (Creator, post, Story, poll, coin).
   Move code to `base/` only when it is domain-neutral. On the server, put a pure domain rule (no
   database, storage, Fastify, or model call) in `modules/<domain>/` and persistence in
   `data/<domain>/`; routes, services, operations, and schedulers stay in `features/<name>/`.
4. **Expose the smallest contract.** When another feature or a workflow needs the capability, add
   or extend `slp-<name>-contract.ts` in the owning feature. Import only that file from outside.
5. **Keep files small.** Stay under 400 lines where you can; 800 is the hard ceiling.
6. **Register Backstage panels.** A new settings panel lives in its feature and gets one entry in
   the `features/backstage/` panel registry.
7. **Own the path.** Files under the `slp` roots are covered by the root ownership entries. A new
   path outside them needs an approved decision and an entry in `slurp2OwnedSourcePaths`.
8. **Add focused proof.** Add or update a regression under `tests/` for the behaviour. When a moved
   file was read by source text tests, map its historical key in `tests/slurp2-source.ts` instead of
   editing those tests.
9. **Validate.** Run the architecture regression, `node scripts/typecheck-packages.mjs slurp2`, and
   the affected regressions.
10. **Rebuild.** Bump the Slurp2 patch version once per PR, run
    `node scripts/build-feature-packages.mjs slurp2` with `MARINARA_ENGINE_ROOT` set, and check that
    payloads, manifest, ZIP, catalog lanes, hashes, and sizes changed together.
