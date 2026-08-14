# Noodle

Noodle packages two local social roleplay surfaces. **Noodle** is the open social timeline where invited characters, personas, and optional generated ambient accounts can post and interact. **NoodleR** is the creator-feed side where the owner gives selected characters or personas separate Creator profiles, publishes public or locked posts, and simulates subscriptions and audience activity. NoodleR is not a private platform or a service for real creators, viewers, or payments.

Find the package in **Agents → Download Agents**. Once installed and Marinara Engine restarts, **Noodle** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes and background schedulers after restart.

The Engine continues to own package loading, local storage, provider routing, backup coordination, and upgrade migration. This package owns the Noodle UI, routes, timeline generation, prompt context, media behavior, schedulers, localized UI catalogs, catalog artwork, and the familiar Noodle/NoodleR logo pair used by both the interface and its Home tab.

Existing Engine profiles receive this package once during the built-in-to-package migration. The migration preserves Noodle/NoodleR tables and imports the last selected persona and view into package-local browser state. The completion marker is written after a successful install, so a later explicit uninstall remains respected. Fresh profiles do not install Noodle automatically.

## Product contract

Noodle and NoodleR are an owner-controlled local roleplay model. The owner selects the characters and personas, supplies the model connections and prompts, controls all Creator profiles and viewer personas, and can edit or delete generated profiles, posts, and interactions. Accounts, followers, subscriptions, unlocks, payments, and audience reactions are simulated roleplay state. They do not represent independent people or transactions.

NoodleR has two separate controls:

- **Post access** controls what a simulated viewer persona can see. Public posts are visible to eligible viewer personas. Locked posts require that viewer persona to subscribe or unlock the post. This is an in-app roleplay rule, not encryption, authentication, or identity protection.
- **Identity disclosure** controls how generation can connect a Creator profile to its source character or persona. It does not make posts public or locked and does not control subscriptions or viewer eligibility.

Identity disclosure has these exact semantics:

- **Open**: The Creator may use the source's name, handle, recognizable details, continuity, and appearance. Image generation may use the source character's avatar or preferred full-body image as a reference when avatar references are enabled.
- **Hinted**: The Creator is an inspired alter ego. Broad personality, interests, themes, and non-identifying aesthetic direction may carry over. Exact source names and handles are removed. Generated text must not copy canonical biography text. Image generation does not use the source avatar or other identifying reference image.
- **Secret**: The Creator is a separate persona. Generation receives only a reduced, non-identifying inspiration brief. It must avoid the source name, handle, canonical occupation, relationships, locations, signature phrases, and other distinctive details. Image generation does not use the source avatar or other identifying reference image.

Profile avatars are presentation for the simulated account. Open Creator profiles reuse the current source avatar. Hinted and Secret profiles start without a source avatar. A change to a more private mode clears a copied source avatar and discards unreleased automatic posts. It is blocked while published identifying text, media, or another avatar still needs review. A shared or recognizable avatar can disclose identity regardless of the selected label. Open permits source appearance references for generated post images when enabled. Hinted and Secret do not. They also do not promise anonymity, and the owner must review generated text and images before relying on the intended separation.

Generated output is social-feed copy, not a full roleplay scene. Noodle produces short timeline posts, replies, reposts, likes, and activity summaries. NoodleR produces one concise, editable Creator post with an optional title of at most 200 characters, a body of at most 4,000 characters in the Creator's Bio and Stage voice, and an optional short image description when image generation is enabled. Provider output is clipped to these field limits. The owner should use generation guidance for tone, style, maturity, and content boundaries. NoodleR does not make content mature by default.

Noodle timeline refreshes scale their normal post target with the selected non-persona accounts. **Maximum posts per refresh** remains a hard safety ceiling rather than a fixed slot count, so smaller selections stay bounded while the feed can still vary naturally.

NoodleR renders 20 feed posts at first and **Load more** reveals 20 more at a time. The entry-point badge polls a count-only route, so idling on Noodle does not repeatedly download the full NoodleR viewer feed.

Manual refreshes run generation immediately. Automatic Noodle refreshes update the timeline on the configured local schedule. Automatic NoodleR publishing prepares posts before their release times and publishes them as locked posts while Marinara is running. Enabling synthetic audience activity can add simulated likes, replies, and reposts to released public NoodleR posts; it excludes locked posts. Automation can consume text, vision, and image provider requests, can change roleplay state without another confirmation, and stops when the related setting or package is disabled.

NoodleR is a beta feature. Generation can be inaccurate, can disclose source details, can ignore style or maturity guidance, and can fail or produce unsuitable text or images. Data is stored by the local Marinara Engine, but configured model and image providers receive the prompt context and media required for each request under their own privacy terms. Public and locked access, disclosure modes, local storage, and Noodle/NoodleR separation are application behavior only. They are not security or privacy boundaries. Review provider settings and generated content before use, and do not use NoodleR for secrets or real access control.

Run `node scripts/evaluate-noodle-generation.mjs path/to/samples.json` against saved provider output to measure normal length, concentrated negative mood, duplicate text, and author coverage. The repository fixture proves the evaluator contract only. It does not replace evaluation with the models used by a local Engine profile.

## Refresh diagnostics

The Engine stores Noodle refresh diagnostics in `storage/tables/noodle_refresh_runs.json` and keeps a crash-recovery copy in `noodle_refresh_runs.json.bak`. After each completed or failed refresh, Noodle attempts to keep the 100 most recent finished runs in both files; this pruning is best effort, so a pruning failure is logged and does not fail the refresh itself. Running refreshes are retained until they finish. The first finished refresh after an upgrade also reduces an existing oversized history. This cleanup does not change Noodle posts, interactions, accounts, settings, or images.

Rebuild only this package from the repository root with a neighboring Engine checkout:

```bash
node scripts/build-feature-packages.mjs noodle
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
```
