# Security Policy

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose user data or execute code. Use the repository's **Security** tab to submit a private vulnerability report. Include the affected package or publishing path, the Engine version, reproduction steps, and the impact.

## Package trust model

Marinara Agent packages may contain server and client entrypoints. Server entrypoints run inside the Marinara Engine process; manifest permissions describe intended access but are not an operating-system sandbox. Treat every package, artifact, catalog entry, build script, and publishing workflow as executable supply-chain material.

Catalog SHA-256 values detect accidental corruption and mismatched downloads. They do not protect against an attacker who can change both an artifact and its catalog hash. The repository therefore also:

- requires canonical same-repository artifact URLs during catalog validation;
- maps repository paths to owner `SpicyMarinara` in `CODEOWNERS`;
- validates source manifests, archive contents, file hashes, catalog lanes, and generated outputs in pull requests;
- scans JavaScript, TypeScript, and GitHub Actions with CodeQL, runs native Code Quality analysis, audits dependencies at every advisory severity, and sends bounded dependency updates to `staging`; and
- pins third-party GitHub Actions by full commit SHA.

Repository administrators should keep `staging` protected with pull requests, catalog validation, CodeQL, CodeRabbit, review-thread resolution, and the required owner-approval status check. That check must exempt only active Pasta-Devs organization members and owners; every outside contributor needs a current-head approval from `SpicyMarinara`, and membership or API failures must fail closed. Do not add a repository-role or team bypass that could admit outside collaborators or exclude private organization members. Keep force pushes and branch deletion disabled. Protect `main` separately so only `SpicyMarinara` may promote tested work from `staging`.
