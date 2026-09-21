# Slurp Remastered release notes

## 0.1.23 — 2026-09-21

- Removed the Classic generation mode. Slurp now runs one posting engine.
- Kept old prompt edits: they carry over to the current prompts and to a new Classic prompt preset.
- Added Load Classic prompts to the prompt studio. It restores the old wording and turns off the newer context blocks.
- Fixed Pulse labels that shared one translation key with different text.

## 0.1.22 — 2026-09-20

- Restored Pulse quick buttons as direct Generate posts and Run audience actions.
- Kept the Automation settings screen separate from Pulse actions.

## 0.1.21 — 2026-09-20

- Made Pulse automation controls navigate to Automation settings instead of running work directly.
- Kept expanded child tasks as separate cards.

## 0.1.20 — 2026-09-20

- Kept grouped Pulse child content hidden until expansion.
- Added blank stacked backsheets to the collapsed group state.

## 0.1.19 — 2026-09-20

- Opened Pulse beside the desktop sidebar while keeping the mobile bottom sheet.
- Added visible child previews to grouped post stacks.
- Added `in` timing for future scheduled posts.

## 0.1.18 — 2026-09-20

- Removed idle Pulse status text from the closed control.
- Renamed the panel subtitle to Background activity.
- Replaced group expand text with a rotating chevron.

## 0.1.17 — 2026-09-20

- Stopped scheduled posts from activating the Pulse icon and wave animation.
- Changed expanded Pulse child rows to a flat notification-style stack.

## 0.1.16 — 2026-09-20

- Removed stale first-post queue records and commission briefs from Pulse background work.
- Added layered notification-style backsheets to grouped Pulse cards.

## 0.1.15 — 2026-09-20

- Separated scheduled posts from active generation work in Pulse.
- Added a Scheduled section with the next publish time.

## 0.1.14 — 2026-09-20

- Grouped related Pulse work into top-level cards instead of showing raw task rows.
- Added expandable child task stacks, Needs attention, and grouped Recent sections.

## 0.1.13 — 2026-09-20

- Enriched Pulse task rows with scope, progress, elapsed time, result detail, and clearer status labels.
- Kept the panel compact with a three-line task presentation.

## 0.1.12 — 2026-09-20

- Changed the closed Pulse control to a rectangular signal tile.
- Pulse icon activity now uses scale only, without opacity animation.

## 0.1.11 — 2026-09-20

- Refined the Pulse capsule shape and added independent pulse-icon animation during active work.

## 0.1.10 — 2026-09-20

- Refined the closed Pulse control into a compact capsule.
- Replaced the heartbeat mark with a pulse icon and radiating active-work waves.

## 0.1.9 — 2026-09-20

- Refined Pulse chrome with a heartbeat icon and active-work pulse state.
- Moved Pulse quick actions above active and recent work.
- Reduced the Pulse header copy for a tighter panel.

## 0.1.8 — 2026-09-20

- Fixed Pulse rendering when the shell passes the post composer callback.

## 0.1.7 — 2026-09-20

- Added Pulse above the persona selector on desktop and mobile.
- Pulse shows durable server tasks and current-session work, including post generation, images, audience activity, follow-ups, commissions, and Creator improvements.
- Added compact status rows, recent results, progress counts, and Creator avatars for background work.

## 0.1.6 — 2026-09-20

- Prompt Studio now keeps voice, post, and image instructions readable in muted fields without opening an editor.
- Recipes scan as compact capability rows, then open into a focused block-outline, pipeline, and preview workspace.
- Collapsed blocks show their resolved prompt, while the selected block exposes its source, inputs, length, and draft action.
- Presets and secondary controls stay available without competing with the main prompt workflow.
- Compiled prompts can be copied directly from the preview inspector.

## 0.1.5 — 2026-09-20

- Prompt Studio now starts with plain-language controls for voice, post behavior, and image direction.
- Prompt recipes open in a focused, responsive block workspace instead of one long settings accordion.
- Blocks show their purpose, source, editability, order, and customization state at a glance.
- Preview a draft result or compiled prompt without applying it, and compare a draft result with the currently applied recipe.
- Prompt changes share one Backstage draft bar, so they can be reviewed, discarded, or applied together.

## 0.1.4 — 2026-09-20

- New experimental prompt mode, "Produce", is now the default. Creators write like people who plan, shoot and sell content, not like someone narrating a moment. Switch modes under Settings, Prompts.
- Every picture now has a camera somebody is actually holding: a selfie, a mirror, a timer, another person, a video still, or an old photo.
- Captions and pictures no longer describe each other, and posts now have a purpose: a teaser, a set, a throwaway, an ordinary day, a request, a thank-you, or a boundary.
- One planned set can supply a few posts over a couple of days, so "one more from yesterday" matches.
- Creators differ in how they make things, and that shows in every post.
- Messages and replies know this is a job, so a Creator can say no or say later.
- Prompt blocks can be previewed, locked ones included.
- "Classic" keeps the old behaviour. Each mode keeps its own prompt edits.

## 0.1.3 — 2026-09-20

- Slurp HTTP routes now use Slurp naming. Existing avatars, banners, ad images, post images and backups keep working.

## 0.1.2 — 2026-09-19

- Fixed Creator filters, profile expansion, and settings tabs not responding after the 0.1.1 update.

## 0.1.1 — 2026-09-19

- Slurp now carries its own vocabulary instead of borrowing names from the Engine.
- Cleaned up a leftover wording slip in the setup wizard intro.
- Fixed SwarmUI image generation: prompt images and LoRAs are now sent when you do not use a custom workflow.
- Nothing else changes. Your creators, posts and settings are untouched.

## 0.1.0 — 2026-09-19

- Completed the backend file split and modularisation.
- You should not feel any difference. If you do, tell me in Discord.

## 0.0.22 — 2026-09-17

- Invite Engine characters to the Slurp audience from character groups or per-character controls.
- Audience characters are now available as a first expansion step. The current setup is still limited and needs clearer guidance and simpler controls.
- Invited characters use their own card voice and tags in comments, audience activity, and messages.
- Invited characters can follow, subscribe, spend, hold ties, and appear in fan cards.
- Added a New Chat picker for owned Creators and invited characters.
- Added prompt-cost limits and deterministic character rotation.
- Fixed feed ads, image prompt display, and the configured subscription price.
- Added configurable image Stories and platform-style message actions.
- Added backend groundwork for the next expansion and bug-fix updates, with clearer service boundaries for safer iteration.

## 0.0.21 — 2026-09-17

- Messages: the composer is shorter on one-line messages and still grows for longer text.
- Messages: away replies use a centered Creator status block with a quiet Get reply now action.
- Messages: sent messages now show separate delivered and seen receipts.
- Messages: mobile headers keep the Creator name visible and move the relationship label into an icon and meter.
- Messages: fixed the transparent mobile header menu with an opaque surface.
- Messages: desktop uses the compact connection switcher.
- Messages: every sent message shows one check when delivered and two when seen.
- Messages: away Creators show a status card with a sleeping animation, not typing dots.
- Creators stay online 5 minutes after replying and 10 after delivering a commission.
- Messages: tier icons are back in the desktop header; tap one to see the full tier scale.
- Messages: Back returns to the profile or activity a chat was opened from.
- Fixed see-through menus and pickers.

## 0.0.20 — 2026-09-17

- Fixed Restart Setup stuck on "How will people recognize them?".
- Fixed "Needs attention" on Creators with a Conversation Schedule. Older schedules now repeat weekly, like in Engine chats.
- Ads: new Ad image connection setting.
- Stories: wider viewer, backdrop, show whole image, likes, unlock price.
- Messages: cleaner message bar that grows with your text.
- Messages: sending scrolls to your message; a button jumps to the latest.
- Messages: header buttons fold into one menu on phones.
- Messages: a "New messages" line marks where you stopped.
- Creators keep a separate draft for each fan thread.
- Side menu: Creator card shows the full banner and a clean name.
- Create posts now: no Stories, waits for busy Creators, names any that did not post.

## 0.0.19 — 2026-09-17

- Fixed Force reply now doing nothing when the hourly model budget was used up.

## 0.0.18 — 2026-09-16

- Messages: Force reply now answers a queued reply at once.
- Fixed Creators sometimes never answering a message.
- Posts are no longer cut off. New settings: Longest post, Show more after 300 characters.
- New Backstage section Prompts, with a prompt block builder.
- New image prompt style: Danbooru tags (experimental).
- Image prompts put style tags first, then the Creator's appearance.
- Edit the image prompt when you regenerate an image or retry a failed one.
- Automation -> Manual actions: run posts, audience activity and schedules yourself.
- Like, comment, vote and subscribe without a Creator profile.
- Mobile Backstage: no section tabs, full-width search.
- Fixed Prompts reset, turned-off prompt blocks, and Slurp loading after an Engine restart.
- Creators no longer mention the time or weekday in every post.

## 0.0.17 — 2026-09-16

- Settings is now Backstage: Overview, Creators, Features, Automation, and Maintenance, with setting search and live previews.
- Creators shows metrics and totals for every Creator. Click one to open its settings, content menu, message prices, and collab partners.
- Features -> Events and holidays: yearly events that Creators mention in posts, replies, and messages.
- Free teaser posts: some automatic posts go out free to win subscribers.
- Featured, buried, and viral weeks change post reach, and viral posts bring a rush of followers.
- Fans who spend a lot and show up constantly can become Too attached.
- Crossovers prefer collab partners, and commissions get a quote by default.
- Feed posts have Edit, Delete, and Show image context in the post menu again.

## 0.0.16 — 2026-09-15

- Settings -> Audience is simpler: one Activity choice (Off, Quiet, Realistic, Lively, Generous), crowd size and tone up front, and fan types, AI writing and advanced numbers in folded sections. Off also stops commissions, DMs and the activity pulse.
- A fan type's tone override now changes how those fans write their comments.
- Settings -> Tags is rebuilt: tags show as chips in their groups, with usage counts and a filter. Click a tag to rename it, merge it into another tag, move it to another group, or delete it.
- Settings -> Creators: select many Creators and change gender, add or remove tags, or turn auto-post and images on or off in one step. The selected Creator also has a quick gender and tag editor.
- Fix: toggles in Settings no longer black out the screen in Firefox.

## 0.0.15 — 2026-09-15

- Fixed a wide post or story pushing the left and right sidebars off the screen.
- The follow button on a Creator profile now shows whether you follow that Creator.

## 0.0.14 — 2026-09-15

- Fixed commissions drawing a new picture on every retry when the fan could not pay.
- Fixed locked pay-per-view messages sending what their picture shows before the fan paid.
- Pictures in messages, commissions and your recent posts now reach the AI as stored prompts or descriptions, with an optional image description model. Each picture is described once, and models that cannot read images are skipped.
- Characters can remember their Slurp posts, messages, commissions, subscriptions and tips in Engine chats: turn on Carryover to chats in Settings and Include Slurp activity in the chat's settings.
- Added lorebook context for Creator posts, prompt presets with import and export, a changed count and Reset section for each settings section, gallery images when no picture is generated, a Professor Mari Creator switch, and a per-character choice for chat image instructions.
- Deleting all Slurp data now asks you to type DELETE, and the mobile bottom bar is smaller.

## 0.0.13 — 2026-09-15

- Fixed Creator management (profile, goal, subscription price, projects, arcs, payout, and Story viewers) rejecting edits with "Only the Creator's owner can..." — Slurp is single-player, so any Creator is now always yours to manage.
- Fixed direct-message replies crashing when two reply attempts collided, along with other duplicate-safe storage operations that crossed the package boundary.
- Persona Creators can now like and reply to their own posts as their public Creator identity.

## 0.0.12 — 2026-09-15

- AI Creator drafts are repaired instead of failing: long text is shortened, gender and tag spellings are understood, broken JSON is fixed, and the form lists what still needs a choice.
- Persona Creators now have the same drafting tools as character Creators: AI post drafts from your own text, and an AI image toggle in the composer for drafted and manual posts.
- Fixed bulk Creator creation skipping open-mode Creators with a wrong gender and tags reason, and draft errors now show the real cause.

## 0.0.11 — 2026-09-14

- Fixed AI Creator drafts that failed or could not be saved because the model left out gender or gave fewer than three tags.

## 0.0.10 — 2026-09-14

- Rebuilt the audience as a deterministic simulation with editable fan types, presets, a seven-day estimate, and JSON import and export.
- Added separate free-simulation and AI-text clocks with call limits, a shared model budget, weekly fan spending limits, and a multi-process world lease.
- Added Creator pricing: own subscription, post, and commission prices with suggestions, commission quotes that follow the brief, haggling, and weekly dynamic prices for character Creators.
- Long posts and long comment threads now collapse, and replies nest under the comment they answer.
- Fixed doubled subscriber totals, lost followers after an ended subscription, tips missing from fan relationships, thin like pacing, and silent subscription lapses.
- Fixed Slurp images failing with an X-Admin-Secret error on remote installs, and sent image connection custom parameters such as LoRA settings.

## 0.0.9 — 2026-09-14

- Added Autopurge with configurable day, week, or month retention; media-only or full-post cleanup; optional direct-message media cleanup; an immediate purge action; and restart-safe scheduling for overdue purges.

## 0.0.8 — 2026-09-14

- Bug fixes for discovery filters and translations, subscription prices, image references, fan privacy, rapport details, message fees, arc editing and generation, profile validation, regression tests, and test-output handling.

## 0.0.7 — 2026-09-13

- Rebuilt Discover around direct subscription actions, persistent grid and list views, and filters for subscription status, gender, weekly price, and Creator tags.
- Added Recommended, Newest, Most liked, and Most subscribed sorting with stable results.
- Added editable Creator gender and tags, including safe custom tags and AI-suggested curated tags during profile creation and redrafting.
- Added Arcs with automatic suggestions, pacing, focus, allowed kinds, and delivery to posts, messages, fan comments, and notifications.
- Moved message, photo, subscription, and tip prices from the profile information box to the action that uses each price.
- Hid the Follow control for subscribed Creators because a subscription already includes following.
- Made Open the default Creator identity mode and removed the Secret identity tier.
- Fixed persona Creator creation when Slurp already has the persona's viewer identity.

## 0.0.6 — 2026-09-13

- Added image context options for reactions: stored prompts, vision descriptions, or automatic selection. Public fan reactions keep locked images hidden and respect Creator identity privacy.
- Generation now shows how many Creators remain, including skipped or failed requests.
- Restored visible success and error notifications for Slurp actions.
- Fixed persona Creator creation when Slurp already has the persona's viewer identity. The viewer and Creator accounts can now coexist for one persona.

## 0.0.5 — 2026-09-13

- Made the welcome screen shorter, put Gunterlie beside the greeting, linked Slurp General, and tucked older release notes behind an expander.
- Corrected older ad ratings, fallback handles, onboarding text, and invalid digest account errors.

## 0.0.4 — 2026-09-12 [highlight]

- Fixed Refresh Conversation Schedule failing with "chatComplete is not a function". It now creates the schedule.
- Fixed the Conversation Schedule refresh dialog and the settings loading screen showing raw text keys instead of words.
- Fixed the header logo not loading. The logo is now built into Slurp and no longer depends on the package asset address.
- Added Reply timing settings under Messaging: the longest wait, the wait when the return time is unknown, check-in waits for close and regular fans, and away times for Creators without a schedule.
- Added Always reachable without a schedule. With it on, a Creator with no Conversation Schedule counts as online.
- Corrected the Creator settings text that said a Creator without a Conversation Schedule is always reachable. Slurp guesses from their last post unless the new setting is on.

## 0.0.3 — 2026-09-12 [highlight]

- Fixed Create post and Add story doing nothing on a Creator profile with a tip goal set. The goal used to hide the post composer.
- Slurp Remastered now shows its color artwork in the Agents browser. The gray artwork is for Slurp Legacy only.

## 0.0.2 — 2026-09-12 [highlight]

- Added a way to write your own ad in Settings. Give it a brand, a product, ad copy, and a rating, and it joins the pool.
- Fixed feed ads stopping after the first server batch, content-rating limits being dropped, and one odd rating rejecting a whole batch.
- Fixed ad actions paying out for ads that were never served, and restored read tracking on the default Following feed.
- Fixed audience churn, relationship arcs, and subscription billing being starved by the world tick.
- Fixed recent Creator activity being ignored when replies and follow-ups decide whether a Creator is online. Drafts no longer count as activity.
- Stopped backups, restores, and deletion from overlapping world or Creator writes, and persona-operated Creators from speaking on their own.
- Creators no longer write first when you have turned their proactive messages off.
- Corrected the logo and the welcome screen's close control and keyboard focus.
- A restore now says plainly that it overrides your settings.

## 0.0.1 — 2026-09-12 [highlight]

- First release of the Slurp remaster as its own package. It installs beside Slurp Legacy and keeps its own separate data.
- Added direct messages, scheduled follow-ups, commissions, an audience funnel, and creator earnings kept apart from spending money.
- Added a backup export and restore. A Slurp Legacy backup can be restored here, which is how you move your data across.
- Added a welcome screen. It appears after the install and after every update, warns that this is alpha software, and lists what changed.
