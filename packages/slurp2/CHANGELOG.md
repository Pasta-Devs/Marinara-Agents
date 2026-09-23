# Slurp Remastered release notes

## 0.2.26 — 2026-09-23

- Image prompts preserve each Creator's appearance and follow the selected image guidance.
- Choose an image style for each Creator, or let them use the global style.
- Settings sections now use the shorter names Content and World.
- Posts, messages, audience activity, story events, and image generation use clearer state and feedback handling.
- Locked posts use each Creator's configured level, and occasions and story events reach posts and chats.
- Owned posts are not sold again, audience activity reports results, and manual occasions can be started.
- Callback posts preserve their shoot context, picture sets vary poses, and follow-ups handle reasoning models.

## 0.2.25 — 2026-09-22

- Every generated picture keeps the Creator's appearance, planned action, expression, and mood even when image-prompt interpretation is unavailable.
- Creator personality and stage voice now shape visual presentation without being copied as private prompt text.

## 0.2.24 — 2026-09-22

- Payments: recovery no longer refunds a tip or unlock that is still going through, a refund is never marked paid again, and cancelling a commission with the wallet off no longer creates coins. A persona can no longer tip its own Creator.
- Promised follow-ups arrive with default settings, stop after a second failure, and read "1.5 hours" and "2 days" correctly.
- Locked content is hidden in every reply. A second unlock no longer triggers a second reaction. "Let them answer" works for a Creator you play.
- Desktop chats no longer leak drafts, pending messages, tools or older pages into the next conversation. Editing a failed message sends the new text.
- Enter no longer sends during input-method composition, in-chat search scrolls to its match, and a pending commission cancellation can be retried.

## 0.2.23 — 2026-09-22

- Restore after deleting a post now works. The feed reloaded on a timer and dropped the deleted post, taking the Restore row with it mid-countdown.
- Share asks which chat to send a post to, with a search and a New chat button, instead of sending it to the Creator who wrote it. The chat card names the author; a locked post travels as a teaser.
- "Download post card" includes the post image again when started from the opened post.
- Reporting offers a real social network's range of reasons plus Slurp's own, and the menu item has its icon.
- "Request a reply" now works on both sides of a chat: playing a Creator, ask the fan to write back.
- Avatar references and source appearance are used by default, so a Creator looks like herself. Both stay switches in Backstage.

## 0.2.22 — 2026-09-22

- Everyday Slurp loading now requests feed data only on feed surfaces and defers profile-source and model-connection data until profile work starts.
- Shell notification and message badges use lightweight count routes instead of loading full notification and inbox payloads.
- Feed seen, follow, subscription, and unlock actions update visible cached state immediately and reconcile in the background.

## 0.2.21 — 2026-09-22

- Wardrobe import can scan whole selected lorebooks or only individually selected enabled entries, while retaining the same evidence-backed review before anything is saved.
- Prompt Studio shows the exact final positive prompt sent to the image provider after appearance, selected clothing, camera, visual policy, style, and interpretation are applied.
- Successful immediate and scheduled automatic images record that exact provider prompt only in the Creator-private Deep Details record, never public post metadata.
- Scheduled posts now pass the same typed visual brief into image interpretation as immediate posts.

## 0.2.20 — 2026-09-22

- Creators now own up to 64 complete wardrobe looks with model summaries, exact image descriptions, tags, public/locked suitability, provenance, and timestamps.
- AI imports from the linked character, selected lorebooks, pasted text, or the legacy wardrobe note stay in an editable evidence-backed review until confirmed.
- Automatic image posts return a scene plan with wardrobe ID, setting, action, expression, and visual direction. Slurp validates the choice, falls back to the least-recent compatible look, and then expands its exact clothing.
- Prompt Studio and Deep Details show the scene, fallback, typed visual brief, and assembled image brief. Expert overrides can rewrite or disable every prompt block.
- Random variations no longer invent loneliness, interruption, sleeplessness, or a low-income mood. Real events and character traits still affect tone.

## 0.2.19 — 2026-09-22

- A Creator has her own appearance, usual wardrobe, and regular places, edited on her profile.
- The appearance is sent with every picture. It used to be borrowed from the linked character card, which needed the Creator to be linked, the card to have an Appearance field, and "include descriptions" to be on. With any of those missing the image model got a scene with nobody in it and invented somebody new each post.
- An appearance left blank is seeded from the linked card when the Creator is created.
- Wardrobe and places reach both the caption and the picture, so clothes are hers and "somewhere other than where she usually posts" has something to be other than.

## 0.2.18 — 2026-09-22

- How far a Creator's pictures go is now a setting, globally and per Creator. Locked posts deliver that level, public posts sit one step below, and housekeeping posts stay non-sexual. Every locked post used to be briefed as non-sexual.
- The image prompt no longer asks for a bad picture. "Badly framed, poorly lit, dull" meant candid rather than staged, but an image model reads it as an instruction and returns exactly that.
- No point-of-view framing, and nobody in the picture the scene did not pay for.
- Camera mix rebalanced: arm's-length self-shots drop from about two thirds of posts to about 45%.
- Posts with no picture drop from about one in six to about one in twenty-five.
- The image provider no longer receives personality traits or an "Appearance:" label in the prompt.
- Removed the framing axis, drawn on every post and discarded before the prompt.

## 0.2.17 — 2026-09-22

- The opened post viewer now shows every picture of a multi-image post, with arrows, a counter, and mini previews. It used to show the first one only.
- Feed cards mark multi-image posts with position dots beside the existing arrows.
- Prompt Studio: every block can be switched off, not only the ones marked optional.
- Prompt Studio: required blocks can be rewritten. The override starts from the text the preview Creator actually gets, and says plainly that a fixed text replaces what Slurp would have composed per Creator. Context blocks stay read-only because their text is the runtime data itself.
- The prompt preview no longer discards a finished result when the settings query refetches in the background, and a run it cannot perform now says why instead of doing nothing.
- Prompt Studio on a phone: the preview panel is reachable without scrolling past every recipe, recipe rows no longer wrap four lines of block chips, and the preset picker fits the width.

## 0.2.16 — 2026-09-21

- Restoring a deleted post no longer waits on a full feed refetch, so the card comes back at once instead of sitting on its countdown.
- The server now keeps a deleted post for twice the undo window it offers, so a Restore near the end of the countdown no longer fails.
- The share card is drawn in the browser instead of on the server. The server render needed fonts installed on the host, which most installs do not have, so cards came out as the bare post image with no name, title, or caption.
- Share post no longer does nothing when no viewer persona is active: it falls back to downloading the share card.
- The post viewer's side card no longer draws the picture the viewer already shows.

## 0.2.15 — 2026-09-21

- Exposed restore pending state through the Home screen model so restore feedback renders immediately.

## 0.2.14 — 2026-09-21

- Restored posts now return to the visible feed as soon as the restore response succeeds.

## 0.2.13 — 2026-09-21

- Restore now gives immediate progress feedback.
- The restore countdown pauses while the server restores the post.

## 0.2.12 — 2026-09-21

- Fixed the deleted-post panel crash caused by missing restore state.
- Wired post sharing to the active viewer persona.
- Restored the report action on feed posts.

## 0.2.11 — 2026-09-21

- Deleted posts can be restored again, with pending and failure feedback.
- Restore now pulls the deleted post's sparkles into the restore action.

## 0.2.10 — 2026-09-21

- Normal, locked, profile, media, Story, and reply surfaces now use consistent three-dot action menus.
- Posts now support direct sharing to Slurp messages and durable post or reply reports with snapshots.
- Slurp now uses one canonical post card renderer.

## 0.2.9 — 2026-09-21

- Post image prompts now use a typed visual brief and preserve the planned scene through image interpretation.
- Deleted posts now leave a sparkling restore slot for 60 seconds before permanent cleanup.

## 0.2.8 — 2026-09-21

- Feed loading has a softer status animation, older drops show a progress state, and deleted posts leave the timeline with a short gentle exit.

## 0.2.7 — 2026-09-21

- The feed loads its first page first, older posts load on demand, and post edits and deletes update the visible feed without a full reload.

## 0.2.6 — 2026-09-21

- Creator posts now use the Engine's live Capability API generation integrations for text providers, image generation, fallback handling, and staged media writes.

## 0.2.5 — 2026-09-21

- Locked posts no longer tease what the reader already owns, and housekeeping posts stay public. The composer offers only the purposes that fit the post's audience.

## 0.2.4 — 2026-09-21

- Who holds the camera now follows what the post is for: a planned shoot is rarely a selfie, an ordinary day usually is.
- Two Creators who shoot the same way no longer have identical effort on the same day.
- Conversations start between strangers instead of as friends.
- Creators answer a new message within the hour instead of after two, so the inbox no longer needs Reply now.

## 0.2.3 — 2026-09-21

- Every post's menu has Deep details: the plan, the draws, the full prompt, the model's raw answer, the picture brief, and every tag behind that post.

## 0.2.2 — 2026-09-21

- Removed viewer access. Every persona now sees every Creator; the per-Creator hide list is no longer used.

## 0.2.1 — 2026-09-21

- Posts no longer read private notes from direct messages.
- Teasers, callbacks, and ordinary days stay short; only behind-the-scenes posts run long.
- Stories can now be thank-yous and requests too, and a callback with nothing to continue becomes an ordinary post.
- Prompt Studio shows every block in full and lets you edit it in place, with live text for the preview Creator and the compiled prompt kept current.

## 0.2.0 — 2026-09-21

- Creators now plan posts: teasers, photo sets of up to three images, Stories, cropped previews, reused pictures, text on purpose, and quiet slots. Classic mode became a prompt preset.
- Shoots keep a set consistent, and a set can open a teaser-and-callback campaign.
- Each Creator has a Posting strategy; the composer picks a one-off purpose and delivery.
- Fan requests can be answered from the conversation, and the planner keeps promises.
- Creators remember what they said and did; fan-private details never leak. Review it in the new Continuity tab or the Backstage queue.
- Prompt Studio was redesigned, and Pulse shows background work.

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
