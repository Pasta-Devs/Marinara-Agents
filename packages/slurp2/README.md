# Slurp

Slurp is the local Creator and fan roleplay feed. Create local Creator profiles from Engine characters or personas, publish public or locked Slurp posts, and simulate subscriptions, unlocks, replies, and audience activity.

The shipped default guidance is adult-first. It can produce flirty, suggestive, sensual, and explicit posts when they fit the Creator. Review generated content and edit the guidance for a different balance.

Find the package in **Agents -> Download Agents**. After installation and an Engine restart, Slurp appears as its own tab in **Home**. Slurp starts with empty package-owned state.

Slurp uses direct Engine source references. It does not import Noodle account identifiers or Noodle storage. Viewer state is scoped to an Engine persona. A deleted source pauses its Slurp profile and posts.

All profiles, posts, subscriptions, unlocks, and audience actions are local roleplay state. Prices are fictional. They do not represent real payments, identity, or access control.

Use [`UX-UI-REVIEW-GROUNDWORK.md`](UX-UI-REVIEW-GROUNDWORK.md) for a product-specific interface review. It covers creator-platform usability, visual quality, responsive behavior, accessibility, trust, required workflows, and the review output format.

## Autopurge

Open **Slurp Settings → Autopurge** to remove old Slurp media before it fills local storage. Autopurge is off by default with a four-week retention window. It keeps posts, prompts, comments, and message history by default; you can instead remove complete old posts and optionally include old direct-message media.

Use **Purge now** for a confirmed one-time cleanup, or turn on **Schedule automatic purges** and choose the next run date and time. If Marinara Engine is offline when a purge is due, Slurp runs it when the package next starts.

Rebuild and validate from the repository root:

```bash
node scripts/build-feature-packages.mjs slurp2
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
```
