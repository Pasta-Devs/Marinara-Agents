# Slurp Legacy

Slurp Legacy is the older local Creator and fan roleplay feed. This package is being reworked and is on hold. New development is happening in Slurp Remastered. Bug fixes are not planned for this version.

The shipped default guidance is adult-first. It can produce flirty, suggestive, sensual, and explicit posts when they fit the Creator. Review generated content and edit the guidance for a different balance.

Find the package in **Agents -> Download Agents**. After installation and an Engine restart, Slurp appears as its own tab in **Home**. Slurp starts with empty package-owned state.

Slurp uses direct Engine source references. It does not import Noodle account identifiers or Noodle storage. Viewer state is scoped to an Engine persona. A deleted source pauses its Slurp profile and posts.

All profiles, posts, subscriptions, unlocks, and audience actions are local roleplay state. Prices are fictional. They do not represent real payments, identity, or access control.

Rebuild and validate from the repository root:

```bash
node scripts/build-feature-packages.mjs slurp
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
```
