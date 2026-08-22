# Slurp

Slurp is the local Creator and fan roleplay feed. Create local Creator profiles from Engine characters or personas, publish public or locked Slurp posts, and simulate subscriptions, unlocks, replies, and audience activity.

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
