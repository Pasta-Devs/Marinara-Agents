# Changelog

## 1.51.1 — 2026-09-20

- Generation uses the current Engine's provider and media services, so Engine fixes reach this package automatically. Requires Engine 2.4.6 with capability API 1.31.

## 1.51.0 — 2026-09-13

- Completion and error notifications now appear inside the standalone package.
- Fan reactions and creator replies can use stored image prompts or vision descriptions. Auto prefers the stored prompt, with vision as a fallback for uploaded images. Public fans never receive locked images, and descriptions follow the creator's identity protection.
- The targeted creator refresh shows the remaining count as each generation finishes, including failed or skipped jobs.

## 1.50.1 — 2026-09-13

- Maintenance: remove unused legacy code and an unnecessary settings read when checking the posting schedule.

## 1.50.0 — 2026-09-11

- Mark Slurp as the legacy version while it is being reworked.
- Add a full ZIP backup export containing Slurp data and media for migration.
- New development is moving to Slurp Remastered. Bug fixes are not planned for this version.

## 1.0.31 — 2026-09-09

- Include image generation guidance in the main Slurp post-generation prompt so image interpretation receives the generated image prompt and configured instructions.

## 1.0.30 — 2026-09-08

- Preserve the selected image style profile after image prompt interpretation.
