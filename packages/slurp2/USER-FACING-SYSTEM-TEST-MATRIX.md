# Slurp User-Facing System Test Matrix

## Purpose

Use this document to test Slurp as a user.

For each case, compare three things:

1. **User action:** what the tester does.
2. **Expected result:** what a reasonable user expects.
3. **Current implementation result:** what the current source and tests say should happen.

Record the real result in the **Result** column during a manual test.

This document describes Slurp only. It does not describe internal helpers unless they change a user-visible result.

## Status

| Status | Meaning |
| --- | --- |
| `Automated` | An existing regression or browser test checks the main behavior. |
| `Partial` | Some behavior has automated proof, but the full user flow still needs a manual or browser test. |
| `Manual` | No current test proves the complete user-facing behavior. |
| `Blocked` | The action cannot work until a required Engine resource or connection exists. |

## Test Setup

- Install Slurp without installing Noodle.
- Use a fresh Slurp state for first-run tests.
- Use at least one Engine character.
- Use at least one Engine persona.
- Use a language-generation connection.
- Use an image-generation connection for image tests.
- Use a desktop viewport and a mobile viewport.
- Use a creator source that is a character.
- Use a creator source that is a persona.
- Keep one test creator with automatic posting disabled.
- Keep one test creator with a public post and one locked post.
- Keep a copy of the source character or persona before tests that change or delete it.

## 1. Install And Open Slurp

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| APP-01 | Install the Slurp package. | The package installs as a separate package. It does not install or require Noodle. | The package has its own `slurp` id, client, server, routes, storage, artwork, and Home tab. | `Automated` | |
| APP-02 | Restart Marinara Engine after installation. | Slurp becomes available in Home after the required restart. | The manifest marks restart as required. | `Partial` | |
| APP-03 | Open Home. | A Slurp tab named `Slurp` is visible. | The package contributes a `home-browser-tab` with the Slurp logo. | `Automated` | |
| APP-04 | Open Slurp on desktop. | The Slurp surface loads with its own theme and no browser or server error. | The browser test checks the pink accent, logo, and unexpected errors. | `Automated` | |
| APP-05 | Open Slurp on mobile. | The surface fits the viewport. Navigation does not widen the page or cover content. | The shell has mobile navigation, safe-area spacing, and overflow protection. | `Partial` | |
| APP-06 | Install and open Slurp when Noodle has never been installed. | Slurp still opens and works. | The extraction rules require standalone operation and boundary tests protect the package split. | `Partial` | |
| APP-07 | Install and open Noodle when Slurp has never been installed. | Noodle still works without Slurp. | This is a cross-package requirement, but this document covers the Slurp side only. | `Manual` | |

## 2. First-Run Gate And Onboarding

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| ONB-01 | Open Slurp for the first time. | Slurp explains the product before asking for setup. | The onboarding wizard has four introduction screens before the numbered steps. | `Partial` | |
| ONB-02 | Continue through the introduction. | The user can move forward and reach setup. | The wizard tracks intro progress and then opens the setup lane. | `Partial` | |
| ONB-03 | Cancel or close first-run onboarding. | Slurp closes the wizard and records that setup was skipped or not started. It must not create a creator. | `skip` saves settings with onboarding set to `not_started`, then closes. | `Automated` | |
| ONB-04 | Reopen Slurp after skipping. | The user can start setup later. | The Home surface can reopen onboarding when onboarding is not complete. | `Partial` | |
| ONB-05 | Select a default activity pace. | The selected pace changes the shown posting frequency and automatic-posting state. | Activity presets update `postsPerDay` and `autoPostingScheduleEnabled`. | `Automated` | |
| ONB-06 | Select manual activity. | Automatic posting turns off. The user can still create posts manually. | The manual preset disables the scheduler. | `Partial` | |
| ONB-07 | Set a custom posts-per-day value. | The input accepts an integer from 1 through 24. Invalid input does not save. | The settings field validates and restores the previous value on invalid input or failed save. | `Partial` | |
| ONB-08 | Enable or disable quiet hours. | The setting persists and automatic posts respect it. | The wizard and settings save `nightQuiet`; scheduler logic uses the setting. | `Partial` | |
| ONB-09 | Enable automatic images during setup. | New automatic posts may include generated images. This setting must not change avatar-reference settings. | The wizard restores and saves `autoPostingImagesEnabled` separately. | `Automated` | |
| ONB-10 | Select a text-generation connection. | Slurp uses the selected connection for setup and generation. | Setup accepts a connection override and falls back to the Engine default when no override is selected. | `Automated` | |
| ONB-11 | Select creators and finish setup. | Slurp creates one creator profile per selected source and reports success or individual failures. | Bulk creation uses an idempotent execution id and returns created, skipped, failed, and reason data. | `Partial` | |
| ONB-12 | Select more creators than the allowed bulk limit. | The UI stops selection at the supported limit and does not lose earlier selections. | Selection is capped at `NOODLER_BULK_ACCOUNT_MAX`. | `Automated` | |
| ONB-13 | A creator fails during setup. | The user sees the failure reason and can return to setup without selecting everything again. | The wizard keeps the error, shows failure completion, and provides a return-to-setup path. | `Automated` | |
| ONB-14 | Setup creates profiles but first-post generation fails. | Profiles remain. The user can retry generation. Setup must not claim complete before generation has a result. | Completion waits for generation outcomes and keeps failed ids retryable. | `Automated` | |
| ONB-15 | Finish setup with zero selected creators. | Slurp saves the selected settings and clearly reports that no creators were added. | The completion resolver distinguishes zero creators from generation failure. | `Partial` | |
| ONB-16 | Complete setup and reopen Slurp. | The wizard does not appear automatically. The feed or hub opens. | Completed onboarding is persisted in Slurp state and settings. | `Automated` | |
| ONB-17 | Use the onboarding locked-post demonstration. | The demo shows a locked preview. Choosing unlock or subscribe reveals only the local demo result and does not call the server. | The demo has local reveal state and a separate payoff image. | `Partial` | |
| ONB-18 | Use a source with missing or failed data during setup. | The wizard gives a useful reason and does not silently create a broken profile. | Failure reasons are surfaced by the onboarding flow. | `Partial` | |

## 3. Persona And Viewer Selection

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| VIEW-01 | Open the persona switcher. | The current Engine persona is clear. Other persona rows show readable names. | The shell uses named persona rows and keeps the active persona id separate from any creator identity. | `Automated` | |
| VIEW-02 | Switch to another Engine persona. | The viewer feed, follows, subscriptions, unlocks, unseen count, wallet, and ad state change to the selected persona. | Viewer state is persona-scoped. The Home surface loads wallets for every persona and passes the active wallet to the hub. | `Partial` | |
| VIEW-03 | Use a persona that owns a Creator profile. | The shell shows the Creator identity where appropriate but still keeps the Engine persona as the active viewer. | The shell uses creator identity for display and retains `personaAccount.id` for switching and ownership checks. | `Automated` | |
| VIEW-04 | Use a persona that does not own a Creator profile. | The user can still read Slurp. The user sees a read-only preview when no viewer persona is available. | The viewer-first hub has no publishing composer. The onboarding rules require a read-only preview without an Engine persona. | `Partial` | |
| VIEW-05 | Delete the active viewer persona. | Only that viewer's follows, subscriptions, unlocks, and read state are retired. Creator profiles and posts remain. | The storage lifecycle has viewer cleanup separate from creator deletion. | `Manual` | |
| VIEW-06 | Reload after changing the active persona. | The selected persona persists for the Slurp UI session or saved browser state. | The Slurp package store persists `viewerPersonaId`. | `Partial` | |

## 4. Home Hub And Feed

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| FEED-01 | Open the Slurp hub as a viewer. | The user sees the viewer feed and can browse creators. No creator composer appears in the viewer lobby. | The viewer hub intentionally excludes `NoodlerPostComposer`. | `Automated` | |
| FEED-02 | Open a managed Creator Room. | Creator tools and the composer are available for the owner of that creator. | Creator tools contain access, automation, and the composer behind one expandable control. | `Automated` | |
| FEED-03 | Open a creator owned by another persona. | The user sees viewer actions, not owner automation controls. | Automation is hidden unless the active persona owns the creator. | `Automated` | |
| FEED-04 | Select `All creators`. | Posts from available creators appear in the feed. | The browser test creates a post and checks that it appears in the all-creators feed. | `Automated` | |
| FEED-05 | Select `Following`. | Only creators followed by the active persona appear. | The viewer feed supports `following` and `all` tabs. | `Partial` | |
| FEED-06 | Refresh the feed. | The feed refetches. The user receives a refreshed confirmation. | The refresh action refetches the viewer query and reports completion. | `Automated` | |
| FEED-07 | Scroll through a long feed. | More posts load without duplicates or gaps. | Feed queries use cursors and a page size of 20. | `Partial` | |
| FEED-08 | View the new-post divider. | New items since the last visit are separated. Marking the feed seen updates read state. | Slurp has an unseen count and mark-seen route. | `Partial` | |
| FEED-09 | Open the Stories or Moments shelf. | Fresh story posts from the last 24 hours appear. An empty shelf remains discoverable. | Moments use a 24-hour cutoff. Story archives do not use that cutoff. | `Automated` | |
| FEED-10 | Open a story archive on a creator profile. | Older stories remain available in the creator archive. | The profile has a `stories` tab and follows every post cursor. | `Automated` | |
| FEED-11 | Open a Moment. | The viewer can move between moments. Mobile view can use the full viewport. | The Moment viewer supports mobile fullscreen and left/right keyboard navigation. | `Partial` | |
| FEED-12 | Open a media wall. | The feed shows image posts in a media-focused layout. | The Home surface supports list and media-wall layouts. | `Partial` | |
| FEED-13 | Open a post image. | The image opens in a lightbox and uses authenticated Slurp media loading. | Slurp media uses an API client and near-viewport loading. | `Partial` | |
| FEED-14 | Open a locked image without unlocking. | The user sees a teaser or unavailable frame. The original image bytes remain protected. | Locked images use server-side teaser media and do not receive a second client blur. | `Automated` | |

## 5. Creator Profiles

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| PROF-01 | Open a creator profile. | The profile shows name, handle, bio, avatar, banner, counts, posts, media, and available actions. | `SlurpProfileSurface` renders the identity block, connections, tabs, and post list. | `Partial` | |
| PROF-02 | Edit your own creator profile. | The user can edit display name, handle, bio, and location in place. Save persists the fields. Cancel restores the old values. | The profile surface uses in-place fields with save and cancel controls. | `Partial` | |
| PROF-03 | Open another creator profile. | Edit and automation controls are absent. Viewer actions remain available. | Ownership follows the active persona and owner controls are gated. | `Automated` | |
| PROF-04 | Upload a creator avatar. | A valid image replaces the avatar. Upload progress is visible. Invalid files fail without corrupting the profile. | Avatar upload has a Slurp route, loading state, and image validation. | `Partial` | |
| PROF-05 | Upload a creator banner. | A valid image replaces the banner. | Banner upload has a Slurp route and profile control. | `Partial` | |
| PROF-06 | Generate a creator avatar or banner. | Slurp asks the configured image provider for artwork and shows the result after completion. | Profile controls call Slurp artwork generation. | `Manual` | |
| PROF-07 | Use the Engine source avatar. | The creator can use the source avatar without routing the image through Noodle. | Slurp has an explicit source-avatar operation and direct Engine source resolution. | `Partial` | |
| PROF-08 | View following or followers. | The selected connection list opens and is scoped to the active viewer. | Profile counts and connection navigation are present. | `Partial` | |
| PROF-09 | See a source-change notice. | The user can accept the identity, review a redraft, or accept the source changes. | Settings show source-changed actions and preserve a source revision check. | `Automated` | |
| PROF-10 | Delete a creator profile. | Confirmation is required. The creator and its Slurp-owned data are removed. | Delete is inside a destructive actions section and uses confirmation. | `Partial` | |
| PROF-11 | Delete the Engine source behind a creator. | The creator profile and existing posts remain. New source-dependent generation pauses. The profile cannot be relinked to another source. | Missing source state is retained and shown. Repair requires restoring the same source or creating a new profile. | `Automated` | |
| PROF-12 | Change the Engine source name or avatar after creating a creator. | The Slurp creator identity remains unchanged unless the user explicitly adopts a source identity change. | Identity fields are copied at creation and source changes are explicit. | `Automated` | |
| PROF-13 | Try to create a second creator from the same source. | Slurp prevents a duplicate creator profile for the same source kind and entity id. | Storage enforces source uniqueness for Slurp profiles. | `Partial` | |

## 6. Creating And Managing Posts

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| POST-01 | Open Creator Tools on your profile. | The composer opens without hiding the profile identity or other essential controls. | Creator Tools contains the composer and related controls. | `Partial` | |
| POST-02 | Publish a text post. | The post appears in the creator feed with the correct creator identity and time. | Slurp creates a post with a creator snapshot and renders it in the feed. | `Automated` | |
| POST-03 | Submit an empty post. | Slurp rejects it and explains that a post needs text, an image, or a poll. | The route schema rejects empty content, image, and poll input. | `Partial` | |
| POST-04 | Publish a public post. | Any eligible Slurp viewer can read it. | Public posts are returned in the viewer feed. | `Partial` | |
| POST-05 | Publish a locked post. | Viewers see the locked state and cannot read the body until they unlock or subscribe. | Locked cards hide the body and offer unlock or subscribe actions. | `Partial` | |
| POST-06 | Publish a story. | The story appears in the creator archive and in Moments when it is fresh. | Posts support `post` and `story` types and the Home shelf filters fresh stories. | `Automated` | |
| POST-07 | Link a story to another post. | The linked relationship is preserved and visible where the UI supports it. | Post input accepts `linkedPostId`. | `Manual` | |
| POST-08 | Edit your own post. | The user can change the post and save it. | Owner post actions include edit and save. | `Partial` | |
| POST-09 | Delete your own post. | Confirmation is required or the UI clearly prevents accidental deletion. The post disappears after deletion. | Owner post actions include delete and the route deletes the post and media. | `Partial` | |
| POST-10 | Try to edit or delete another creator's post. | The action is not shown or the server rejects it. | Management actions are gated by the post management context and route checks. | `Automated` | |
| POST-11 | Use markdown, mentions, and custom emoji. | Supported formatting renders correctly. Mentioned profiles can open. Custom emoji displays from the Engine gallery. | Slurp includes markdown, mention suggestions, and custom emoji rendering. | `Partial` | |
| POST-12 | Share a post as an image. | A share image downloads with escaped user text. Locked post bodies never appear in the share image. | Share-card generation escapes content and rejects locked bodies on owner and viewer paths. | `Automated` | |

## 7. Images And Polls

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| MEDIA-01 | Attach a local image to a post. | The image previews before publishing. | The composer supports local image selection and preview. | `Partial` | |
| MEDIA-02 | Crop or replace the attached image. | The crop is applied. Replacement and undo work without losing the draft. | The post image editor supports crop, replacement, restore, and cleanup of object URLs. | `Partial` | |
| MEDIA-03 | Upload an invalid image or an image over 20 MB. | Slurp rejects it with a clear error. No invalid file is stored. | Multipart handling checks file count, extension, byte size, detected image type, and cleanup locks. | `Automated` | |
| MEDIA-04 | Import an image from a URL. | Only a reachable, allowed image URL is imported. Local and loopback targets are rejected. | Slurp uses safe fetch with protocol, redirect, response-size, and image-content checks. | `Partial` | |
| MEDIA-05 | Generate an image for a post. | The configured image provider receives the post context and returns an image or a clear error. | The post has a generate-image action and provider disclosure confirmation. | `Partial` | |
| MEDIA-06 | Review generated image prompts before generation. | The user can review or change prompts before the provider call. | Slurp has image prompt confirmation and review UI. | `Partial` | |
| MEDIA-07 | A generation result contains rejected or unsafe content. | Slurp does not send rejected image instructions onward. | The generated-media policy disables image prompts and gallery attachments when output is partially rejected. | `Automated` | |
| MEDIA-08 | Add a poll. | The composer accepts a question and valid options. The poll renders with vote controls. | Slurp has a poll composer and poll card. | `Partial` | |
| MEDIA-09 | Vote in a poll. | The active persona can vote once per supported option rule. The result updates. | Vote interactions are stored with uniqueness protection. | `Partial` | |
| MEDIA-10 | View poll voters. | The user can open voter information when available. | Poll cards have a voter display control. | `Manual` | |

## 8. Viewer Actions And Locked Content

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| ACT-01 | Like a public post. | The like appears immediately or after the request succeeds. Repeating the action does not create duplicate likes. | Like interactions are stored with uniqueness protection and the UI supports toggle behavior. | `Partial` | |
| ACT-02 | Unlike a post. | The like is removed and the count updates. | Remove-interaction route and mutation exist. | `Partial` | |
| ACT-03 | Repost a post. | The repost appears once for the active persona. | Repost interaction type has uniqueness protection. | `Manual` | |
| ACT-04 | Reply to a post. | The reply appears under the post. The user sees provider disclosure before a model-generated reply is requested. | Reply submission confirms provider disclosure before the mutation. | `Automated` | |
| ACT-05 | Cancel provider disclosure for a reply. | No reply is created. | The interaction mutation runs only after confirmation. | `Automated` | |
| ACT-06 | Reply with an image, emoji, or mention. | The attached content is retained and renders in the reply. | Reply composer supports image and media tools plus mention handling. | `Partial` | |
| ACT-07 | Edit or delete your reply. | The action is available only for a reply you can manage. | Reply management uses permission checks and update/delete routes. | `Partial` | |
| ACT-08 | Ask the Creator to reply to an interaction. | Slurp generates a Creator reply using the correct Creator schedule and configured provider. | Creator reply operation carries schedule context and uses Slurp connection fallback. | `Automated` | |
| ACT-09 | Follow a creator. | The active persona follows or unfollows the creator. The Following feed and counts update. | Profile and feed support follow state and toggle mutation. | `Partial` | |
| ACT-10 | Open a locked post. | The user can choose one clear access path: unlock the post or subscribe to the creator. | The unlock sheet presents both actions and their fictional prices. | `Partial` | |
| ACT-11 | Unlock a locked post with coins enabled. | The balance is charged once. The post body becomes available. A duplicate unlock does not charge again. | Storage spends from the Slurp wallet and stores viewer/post uniqueness. | `Automated` | |
| ACT-12 | Unlock a locked post with insufficient coins. | The post stays locked. The balance does not become negative. The user sees an error. | Wallet spend returns no result when funds are insufficient. | `Automated` | |
| ACT-13 | Subscribe with coins enabled. | The subscription is created and charged. It renews every seven days while affordable. | Storage spends on subscribe. Renewal lapses an unaffordable subscription. | `Automated` | |
| ACT-14 | Subscribe with coins disabled. | Prices are decorative. No balance is charged. Access behavior matches the setting. | The default economy keeps `walletEnabled` false for existing installs. | `Partial` | |
| ACT-15 | View a locked post without a viewer persona. | The user cannot perform viewer actions. The owner preview remains read-only. | Viewer actions require a persona-scoped viewer. | `Partial` | |
| ACT-16 | Try to read a locked body through an image prompt, fan prompt, or share card. | Locked body text remains private. | Image context and fan prompt tests prevent locked bodies from reaching those prompts. | `Automated` | |

## 9. Wallet And Fictional Coins

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| WAL-01 | Open Wallet. | The active persona's balance and activity are visible. | Home and navigation expose a wallet surface and persona wallet data. | `Partial` | |
| WAL-02 | Claim the daily refill when below the floor. | The balance rises to the configured floor once per day. | The stipend tops up to the floor and writes a ledger entry. | `Automated` | |
| WAL-03 | Claim the daily refill when already above the floor. | The balance does not increase. | The stipend does not add coins above the floor. | `Automated` | |
| WAL-04 | Earn coins from ads or engagement. | Rewards are capped by kind and by day. | Ad and engagement rewards use daily caps. | `Automated` | |
| WAL-05 | Spend exactly the available balance. | The action succeeds and the balance becomes zero. | Exact-balance spending is allowed. | `Automated` | |
| WAL-06 | Spend more than the balance. | The action fails. The balance never becomes negative. | Wallet spending returns null for unaffordable actions. | `Automated` | |
| WAL-07 | Receive Creator revenue from a paid unlock or subscription. | The configured Creator share reaches the owner wallet. | Storage calls Creator income credit for paid actions. | `Automated` | |
| WAL-08 | Open wallet activity. | Unlocks, subscriptions, stipends, ad rewards, engagement rewards, and Creator income are understandable. | Wallet entries are stored with transaction kinds and shown in the Home wallet sections. | `Partial` | |
| WAL-09 | Reload after a wallet action. | The balance and activity persist. | Wallet data is stored in Slurp-owned state. | `Partial` | |
| WAL-10 | Use invalid or hand-edited wallet state. | Slurp recovers to a valid wallet instead of throwing or using negative funds. | Wallet parsing falls back to safe defaults and rejects invalid amounts. | `Automated` | |

## 10. Automatic Creator Posting

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| AUTO-01 | Turn automatic posting on. | Eligible Creator profiles receive scheduled posts at the configured pace. | The Slurp scheduler activates with the package and uses Creator settings. | `Partial` | |
| AUTO-02 | Turn automatic posting off. | No new automatic posts are prepared or published. Manual posting remains available. | The settings and routes support the enabled flag. | `Partial` | |
| AUTO-03 | Set a posting pace. | Posts are spread across the day and do not cluster inside the configured interval. | Slot conflict and latest-post interval checks enforce spacing. | `Automated` | |
| AUTO-04 | Schedule a specific Creator slot. | The slot can be edited and saved. A conflicting slot is rejected. | Settings expose datetime slots and the route returns a conflict result. | `Automated` | |
| AUTO-05 | Reschedule a slot while generation is running. | The old generation cannot overwrite the newly scheduled time. | The storage operation checks the expected publication time and policy fingerprint. | `Automated` | |
| AUTO-06 | Choose on-demand generation. | Slurp generates close to publication time. | New installs default to `on_demand`, and poll ordering is tested. | `Automated` | |
| AUTO-07 | Choose pre-generation. | Slurp prepares content ahead of publication and publishes due content. | Pre-generation poll ordering is tested. | `Automated` | |
| AUTO-08 | Enable quiet hours. | Automatic posts do not publish during quiet hours. | Settings include `nightQuiet` and scheduler timing logic. | `Partial` | |
| AUTO-09 | Use a persona as a Creator source. | The profile can exist, but Slurp does not post automatically as that persona. | Routes reject automatic posting for persona-owned Slurp profiles. | `Automated` | |
| AUTO-10 | Run generation now. | The user can select eligible creators and access mode, then see per-creator outcomes. | Settings expose a Run Generation action and targeted refresh route. | `Partial` | |
| AUTO-11 | Automatic generation has no valid provider. | Slurp reports the provider problem and does not silently publish empty content. | Provider admission and generation errors are surfaced through the refresh result. | `Partial` | |
| AUTO-12 | Stop or reload Slurp while automatic posting is active. | The scheduler does not duplicate itself or continue after teardown. | Activation lifecycle rejects duplicate activation and tears down in reverse order. | `Automated` | |

## 11. Image Generation Settings

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| IMGSET-01 | Open Settings -> Images. | The page shows whether image generation is ready. | The page reports ready or needs setup based on image connection state. | `Partial` | |
| IMGSET-02 | Select a global image connection. | New image generation uses that connection. | The global connection is saved through Slurp image settings. | `Automated` | |
| IMGSET-03 | Select a per-Creator image connection. | That Creator uses its own connection instead of the global connection. | Creator-specific mappings are saved and tested in the browser flow. | `Automated` | |
| IMGSET-04 | Enable images for new automatic posts. | New Creator settings inherit the enabled choice. | The setting is separate from avatar references and is persisted. | `Automated` | |
| IMGSET-05 | Set image width or height outside 64 through 4096. | The value is rejected and the previous value remains. | Number settings enforce the range. | `Partial` | |
| IMGSET-06 | Enable prompt interpretation, avatar references, or descriptions. | The selected image context reaches image generation. | Each option has its own setting and the source tests check image context behavior. | `Partial` | |
| IMGSET-07 | Edit image instructions. | The user can save custom instructions or restore the default. | Settings provide edit, save, and restore actions. | `Partial` | |
| IMGSET-08 | Use image generation without a configured connection. | Slurp disables or explains the unavailable action. | The UI reports setup status and disables unavailable connection controls. | `Partial` | |

## 12. Audience And Creator Replies

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| AUD-01 | Open Settings -> Audience. | The user sees audience automation state and run frequency. | Settings load fan activity status and expose audience controls. | `Partial` | |
| AUD-02 | Enable synthetic audience activity. | Slurp creates local fan likes and replies for eligible posts. | Fan activity has its own scheduler, state, and operation. | `Partial` | |
| AUD-03 | Run audience activity now. | The user sees a result or a clear provider error. | Settings expose a refresh-now action. | `Partial` | |
| AUD-04 | Disable synthetic audience activity. | No new synthetic audience actions are created. | The setting controls the fan activity scheduler. | `Partial` | |
| AUD-05 | Synthetic fans interact with a locked post. | Fans can see only the locked teaser context. The locked body is never sent to the model. | Fan prompt construction excludes locked body content. | `Automated` | |
| AUD-06 | A fan activity provider returns alternate field names or actor arrays. | Slurp still normalizes valid activity and stores it under the correct Creator. | Response normalization handles the tested alternate shape. | `Automated` | |
| AUD-07 | A Creator replies to a fan comment. | The reply is created once for that parent interaction and Creator. | Reply claims enforce uniqueness. | `Partial` | |
| AUD-08 | A Creator reply is cancelled or fails. | No duplicate reply is left behind. The user receives an error or retry path. | Creator reply operation and claim storage provide single-claim behavior. | `Partial` | |

## 13. Discover And Search

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| DISC-01 | Open Discover. | The user sees Slurp creators, not Noodle public accounts. | Home has a Slurp Discover view and creator cards. | `Automated` | |
| DISC-02 | Search for a creator. | Matching creator profiles appear. Empty results are clear. | Discover has a search view and result section. | `Partial` | |
| DISC-03 | Open a suggested creator card. | The creator profile opens. | Creator cards support profile navigation and lazy banner media. | `Automated` | |
| DISC-04 | Follow a discovered creator. | The active persona follows the creator and the card state updates. | Follow mutation is available from the viewer profile context. | `Partial` | |
| DISC-05 | Use Discover without a viewer persona. | The user can browse but cannot follow, subscribe, unlock, or interact. | Viewer actions require a persona-scoped viewer. | `Partial` | |

## 14. Inline Promotions And Ad Pool

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| ADS-01 | Enable inline promotions. | Sponsored items appear at the configured feed frequency. | Home honors `inlineAdsEnabled` and inserts ads after the configured number of posts. | `Automated` | |
| ADS-02 | Disable inline promotions. | Sponsored items do not appear in the feed. | Home checks the setting before loading or rendering inline ads. | `Automated` | |
| ADS-03 | Open a promotion. | The CTA performs its configured action and gives feedback. | The ad card has an action handler and an opened confirmation. | `Automated` | |
| ADS-04 | Hide a promotion. | That promotion is hidden for the active viewer. | Slurp has a hide route and viewer ad state. | `Partial` | |
| ADS-05 | Hide a promotion brand. | Future promotions from that brand are hidden for the active viewer. | Slurp stores hidden brands per viewer persona. | `Partial` | |
| ADS-06 | Unhide a brand in Settings. | Promotions from that brand may appear again. | Settings list hidden brands and provide an unhide action. | `Partial` | |
| ADS-07 | Reset viewer ad state. | Hidden promotions and brands reset for the active persona. | Settings provide a reset action requiring a viewer persona. | `Partial` | |
| ADS-08 | Change ad frequency. | The feed uses light, standard, or frequent placement as selected. | Settings save the three frequency values and the Home slot math is tested. | `Automated` | |
| ADS-09 | Change ad steering. | Ads use personalized, balanced, or random selection as selected. | Settings save the steering choice. | `Manual` | |
| ADS-10 | Set an ad content ceiling. | Ads above the selected rating do not appear. | Ad content ratings and host gating are present. | `Partial` | |
| ADS-11 | Select preferred ad themes. | The selected themes influence promotion selection. | Settings save theme tags such as coffee, beauty, luxury, nightlife, and fashion. | `Manual` | |
| ADS-12 | Enable ad images. | Eligible promotions may show generated images. | Settings provide an ad-image switch and the pool supports image generation. | `Partial` | |
| ADS-13 | Generate an ad pool. | Slurp adds fictional promotions, retires weak items, and reports counts. It does not use real companies or trademarks. | Generation writes to the shared Garnish pool with Slurp platform scope and fictional-content rules. | `Automated` | |
| ADS-14 | Regenerate one ad image. | The selected pool item receives a new image or a clear error. | Each pool item has a regenerate-image control. | `Partial` | |
| ADS-15 | Delete one pool item. | The item is removed from the pool and no longer appears. | Each pool item has a delete control. | `Partial` | |
| ADS-16 | Export and import the ad pool. | Export downloads valid JSON. Import adds valid items and rejects invalid data without corrupting the pool. | Settings provide JSON export and import actions. | `Manual` | |
| ADS-17 | Sync an ad lorebook. | The selected lorebook updates ad context. A sync result is shown. | Settings provide lorebook selection and sync-now action. | `Manual` | |
| ADS-18 | Receive ad rewards with coins enabled. | Acting on an ad credits the active persona within the daily cap. | Wallet tests cover capped ad earnings. | `Automated` | |

## 15. Settings And Persistence

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| SET-01 | Open Settings. | Settings open as a separate Slurp surface. | Slurp has its own settings navigation and exit control. | `Automated` | |
| SET-02 | Navigate between settings sections on desktop. | Overview, Publishing, Creators, Images, Audience, Ads, Wallet, and Advanced open the correct section. | One shared section list drives desktop and mobile navigation. | `Partial` | |
| SET-03 | Navigate between settings sections on mobile. | The section row scrolls horizontally. The active section remains visible. | Mobile settings use an overflow row and active-section scrolling. | `Automated` | |
| SET-04 | Change a setting. | The setting auto-saves. The UI shows saving, saved, or error state. | Settings use mutation saves and visible save state. | `Partial` | |
| SET-05 | Change a numeric setting quickly several times. | The newest valid value wins. A slow old request cannot overwrite it. | Number settings serialize saves and use a generation token. | `Partial` | |
| SET-06 | Close a settings modal with Escape. | The modal closes without changing unsaved data. | The browser test checks schedule and prompt modal Escape behavior. | `Automated` | |
| SET-07 | Open Settings -> Creators. | The user sees all Slurp creators, source status, next post, profile, edit, schedule, image, and delete controls. | The Creators section renders these controls. | `Automated` | |
| SET-08 | Open Settings -> Publishing. | The user can set pace, quiet hours, generation mode, provider, spice level, and generation guidance. | The Publishing section renders these controls. | `Partial` | |
| SET-09 | Select a spice level. | Guidance changes to the selected mild, steamy, or explicit preset. | The settings UI provides three guidance presets and custom detection. | `Partial` | |
| SET-10 | Edit or restore generation guidance. | Custom guidance saves. Restore returns the shipped default. | Settings provide edit, save, and restore actions. | `Automated` | |
| SET-11 | Open Settings -> Wallet. | The user can enable or disable the economy and set prices, stipend, rewards, caps, and Creator share. | The Wallet settings section provides all listed controls. | `Partial` | |
| SET-12 | Open Settings -> Advanced and restart setup. | The onboarding flow opens again without deleting existing creators. | Advanced settings provide restart setup. | `Manual` | |
| SET-13 | Delete unused Slurp data. | Confirmation is required. Only unused data is removed. | Advanced settings provide a separate delete-unused action. | `Manual` | |
| SET-14 | Delete all Slurp data. | Confirmation is required. Slurp data and media are removed. Noodle data remains untouched. | Advanced settings provide delete-all and Slurp storage deletion. | `Partial` | |
| SET-15 | Reload after settings changes. | Settings remain changed. | Settings are stored under Slurp-owned settings state. | `Partial` | |
| SET-16 | Change language to English, German, Korean, or Polish. | Slurp controls have translated labels or a safe English fallback. | Package UI locales exist for all four languages and interaction tests check Cancel labels. | `Partial` | |

## 16. Safety, Access, And Lifecycle

| ID | User action | Expected result | Current implementation result | Status | Result |
| --- | --- | --- | --- | --- | --- |
| SAFE-01 | Open Slurp content before confirming adulthood. | The adult-content gate blocks access until the user confirms. | Slurp includes an age gate before the adult creator feed. | `Manual` | |
| SAFE-02 | Cancel the age gate. | The user does not enter the adult feed. | The age gate has a separate entry action and confirmation state. | `Manual` | |
| SAFE-03 | Use reduced-motion system settings. | The UI remains usable without required animation. | Slurp checks reduced motion and uses reduced-motion classes. | `Partial` | |
| SAFE-04 | Open a Slurp media URL without valid package access. | The media route rejects unauthorized access. | Media is served through package routes behind Engine access checks. | `Partial` | |
| SAFE-05 | Request another creator's management endpoint. | The server rejects the request. | Owner and viewer access checks exist on profile, post, interaction, and automation routes. | `Partial` | |
| SAFE-06 | Submit malformed post, poll, profile, or settings data. | Slurp returns a validation error and keeps stored state unchanged. | Routes use Zod request schemas. | `Partial` | |
| SAFE-07 | Start two Slurp operations that change the same identity at once. | One runs. The other receives a clear busy result. Stored identity remains consistent. | Identity and package operation locks are used by refresh, edit, and cleanup operations. | `Partial` | |
| SAFE-08 | Delete Slurp data while a media upload is running. | Cleanup does not race the upload. The user sees a conflict or waits safely. | Multipart upload checks the Slurp cleanup lock and returns 409 when cleanup is active. | `Automated` | |
| SAFE-09 | Uninstall Slurp. | Slurp routes, UI, scheduler, media, and package-owned data are removed. Noodle data remains. | The package has Slurp-owned lifecycle and deletion paths. | `Partial` | |
| SAFE-10 | Update Slurp and restart Engine. | Existing Slurp state remains usable. No duplicate scheduler or route registration occurs. | Activation lifecycle and package storage are designed for repeat activation. | `Partial` | |
| SAFE-11 | Stop Slurp after a partial activation failure. | Registered resources are cleaned up. A later activation can succeed. | Activation lifecycle tests cover reverse teardown and partial failure recovery. | `Automated` | |
| SAFE-12 | Run Slurp without Noodle data. | No screen or action requires a Noodle account, route, setting, table, media path, or scheduler. | Extraction boundary tests protect the package separation. | `Automated` | |
| SAFE-13 | Inspect Slurp after Noodle is installed. | Slurp still uses direct Engine character and persona sources. Noodle changes do not change Slurp identity. | Direct source references and independent viewer state are package rules. | `Partial` | |

## 17. Required Future Manual Pass

The following cases are not fully proven by the current automated tests and need a real Engine session:

- Complete first-run onboarding through the visible introduction and locked-post demonstration.
- Confirm the age gate blocks and permits entry as intended.
- Switch personas and verify viewer-scoped feed, wallet, subscriptions, unlocks, unseen state, and ad state.
- Upload, crop, replace, remove, and display creator and post images.
- Generate a post image, avatar, banner, and ad image with a real configured provider.
- Publish and view public posts, locked posts, polls, stories, replies, likes, reposts, and mentions.
- Verify insufficient funds, subscription renewal, lapsed subscriptions, daily stipend, and reward caps in the visible UI.
- Run automatic posting in both `on_demand` and `pre_generate` modes.
- Verify quiet hours and conflicting schedule slots in local time.
- Run synthetic audience activity and Creator reply generation.
- Use Discover, Following, profile connections, Moments, Stories archive, media wall, and share cards.
- Test ad hide, brand hide, unhide, reset, pool generation, export, import, lorebook sync, and content ceiling.
- Test reload, restart, update, uninstall, and reinstall with Slurp present and absent Noodle.
- Test English, German, Korean, and Polish user-visible controls.

## Existing Proof References

- Browser flow: `tests/package-slurp.e2e.ts`
- Onboarding: `tests/slurp-onboarding.regression.ts`
- Automatic posting: `tests/slurp-automatic-posting.regression.ts`
- Wallet: `tests/slurp-wallet.regression.ts`
- Interaction safety: `tests/slurp-interaction-safety.regression.ts`
- Lifecycle safety: `tests/slurp-lifecycle-safety.regression.ts`
- Generated media policy: `tests/slurp-generated-media-policy.regression.ts`
- Promotions: `tests/slurp-promotions.regression.ts`
- Share cards: `tests/slurp-share-card.regression.ts`
- Package boundary: `tests/slurp-boundary.regression.ts` and `tests/noodle-slurp-extraction-boundary.regression.ts`
- UI shell: `tests/slurp-chrome.regression.ts`

## Test Record

| Test date | Engine version | Slurp version | Tester | Environment | Result summary |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
