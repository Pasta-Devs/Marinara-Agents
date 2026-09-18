# Slurp Module Map — Planning Step 1: Boundary Map

Scope: `packages/slurp2/src/engine/**`. All paths below are relative to
`packages/slurp2/src/engine/packages/` unless written out in full. Every claim cites `file:line`.

Counts as found: `server/src/services/slurp/` holds **140** files (not ~230), 28 542 lines;
`client/src/components/slurp/` holds **57** files, 39 420 lines.

---

## 1. Domain inventory

The folder names claim three things — `slurp/`, `storage/`, `garnish-ads/`. The code holds far more.
Naming eras are interleaved *inside* single files: `SlurpHome.tsx:231` `NOODLER_FEED_WINDOW_SIZE`,
`SlurpHome.tsx:378` `toNoodlePostCardModel`, `SlurpHome.tsx:448` `SlurpHome` — three eras in 220 lines.

**Domain table.** "Coherent" = one file or one tight cluster you could move today.
"Split" = real module, scattered. "Buried" = lives inside a host file that is mostly about something else.

| # | Domain | One-line definition | Server | Client | State |
|---|---|---|---|---|---|
| 1 | **Creator identity** | Binding an Engine character/persona to a Creator profile, and keeping them separate afterwards | `slurp/slurp-stage-profile-draft.service.ts`, `-normalize.ts`, `-repair.ts`, `slurp-source.ts`, `slurp-source-resolve.ts`, `slurp-source-revision.ts`, `slurp-disclosure.ts`, `slurp-identity-protection.ts`, `slurp-avatar.ts`, `slurp-handle.ts`, `slurp-artwork.operation.ts`; storage `slurp.storage.ts:3197-3466` | `SlurpStageProfileForm.tsx`, `SlurpCreatorProfileEditor.tsx`, `SlurpHome.tsx:2545-2765` (source picker + disclosure step), `SlurpHome.tsx:2951-4226` (`StageProfileView`) | **Split**; the two biggest UI pieces are **buried** in `SlurpHome.tsx` |
| 2 | **Feed & posts** | Composing, generating, scheduling and publishing Creator posts and Stories | `slurp-generation.service.ts`, `slurp-post.operation.ts`, `slurp-post-variation.ts`, `-stance.ts`, `-timing.ts`, `-condition.service.ts`, `-target.ts`, `-page.ts`, `slurp-reserve.operation.ts`, `slurp-autopost-*.ts`, `slurp-first-post-queue.service.ts`, `slurp-refresh-*.ts`, `slurp-generated-*.ts`, `slurp-share-card.ts`; storage `slurp.storage.ts:3842-5325` | `SlurpPostCard.tsx`, `SlurpCreatorPostCard.tsx`, `SlurpPollComposer.tsx`, `SlurpHome.tsx:6080-6770` (`NoodlerPostComposer`), `SlurpHome.tsx:5647-6057` (Moments/Stories) | **Split** server-side, **buried** client-side |
| 3 | **Discovery** | Tags, gender, search and suggested Creators on the viewer seat | `slurp-discovery-profile.ts`; routes `slurp.routes.ts:760-771` | `lib/slurp-discovery.ts`, `SlurpDiscoverToolbar.tsx`, `SlurpDiscoveryProfileEditor.tsx`, `SlurpTagsSettings.tsx`, `SlurpHome.tsx:4503-4686` (search body), `SlurpHome.tsx:5044-5090` | **Split**, search UI **buried** |
| 4 | **Messages** | DM threads, PPV, commissions, follow-ups, rapport, broadcasts | `routes/slurp-messages.routes.ts` (35 routes, `:282-1588`), `storage/slurp-messages.storage.ts`, `slurp-messaging.ts`, `slurp-message.operation.ts`, `slurp-message-generation.service.ts`, `slurp-reply-generation.service.ts`, `slurp-dm-response.ts`, `slurp-follow-up*.ts`, `slurp-thread-notes.ts`, `slurp-conversation-*.ts`, `slurp-check-in-intervals.ts`, `slurp-commission-*.ts`, `slurp-rapport.ts`, `slurp-cheat-directive.ts` | `SlurpMessages.tsx` (5153 lines, one file) | **Coherent on the server** (this is the one domain already done right); client is one 5153-line file |
| 5 | **Audience & population** | The funnel of fans/lurkers: who exists, what type they are, what they do | `slurp-population.ts`, `storage/slurp-population.storage.ts`, `slurp-fan-types.ts`, `slurp-fan-activity*.ts` (4 files), `slurp-fan-identity-provider.ts`, `slurp-audience-characters.ts`, `-subscription.ts`, `-arc.ts`, `-reply.operation.ts`, `slurp-reach.ts`, `slurp-scale.ts`, `slurp-ambient-profile*.ts` | `SlurpFanCard.tsx`, `SlurpFanTypesSettings.tsx`, `SlurpAudienceConfigSettings.tsx`, `slurp-simulation-estimate.ts` | **Coherent-ish**, 20+ files but one clear subject |
| 6 | **World tick** | What happens while nobody is looking, plus catch-up on open | `slurp-world.ts`, `slurp-world.operation.ts`, `slurp-world-copy.ts`, `slurp-world-pulse.ts`, `slurp-world-scheduler.service.ts`, `slurp-day-vibe*.ts`, `slurp-mood.ts`, `slurp-stance.ts`, `slurp-talkativeness.ts`, `slurp-pending-text.service.ts`, `slurp-reaction-bank*.ts`, `slurp-milestones.ts`, `slurp-tuning.ts`, `slurp-model-budget.ts`, `slurp-model-worker.ts` | `SlurpBackstageWorld.tsx`, `SlurpSimulationSettings.tsx` | **Coherent**, but its *invocation* is **buried** in a route: `slurp.routes.ts:2756-2775` runs `advanceSlurpWorld`, `drainSlurpPendingText`, `topUpSlurpReactionBank`, `drainSlurpAudienceReplies` inside `GET /noodler/notifications` |
| 7 | **Arcs / Projects** | A storyline a Creator keeps posting about; player-facing name "Arcs" (`slurp-project.ts:2`) | `slurp-project.ts` (1549 lines), `slurp-arc-generation.service.ts`, `slurp-audience-arc.ts`, `slurp-goal.ts`; storage `slurp.storage.ts:7456-7994` (38 methods) | `SlurpProjectsPanel.tsx`, `SlurpHome.tsx:7303-7412` (`SlurpGoalEditor`) | **Split**; storage half is **buried** at the tail of `slurp.storage.ts` |
| 8 | **Economy** | Coins, prices, earnings, payouts, tips, subscriptions | `slurp-wallet.ts`, `slurp-prices.ts`, `slurp-earnings.ts`, `slurp-creator-pricing.ts`, `slurp-payment-reaction.ts`, `slurp-payment-recovery-scheduler.service.ts`, `slurp-media-offer.ts`, `storage/slurp-financial-queue.ts`; storage `slurp.storage.ts:6603-7437` | `SlurpCoin.tsx`, `SlurpHome.tsx:5091-5545` (`SlurpWalletView`), `SlurpHome.tsx:8119-8153` (`SlurpPayoutRow`) | **Split**; the entire wallet UI is **buried** in `SlurpHome.tsx` |
| 9 | **Notification stream** | The player-facing activity feed: "Moth Hour subscribed" | `storage/slurp-events.storage.ts`, `slurp/slurp-event-weight.ts`, grouping + actor resolution inline at `slurp.routes.ts:2748-2847` | `SlurpHome.tsx:7413-7776` (`SlurpInboxHub`, `SlurpInboxView`), `SlurpHome.tsx:7777-8118` (`SlurpNotificationsView`) | **Buried on both ends.** Storage is 179 lines; the read model (grouping, actor resolution across three id spaces — `slurp.routes.ts:2803-2818`) is 100 lines of route body |
| 10 | **Platform events** | Calendar holidays that colour prompts. *Different system from #9, same word.* | `slurp/slurp-platform-events.ts` (132 lines, pure); consumed at `slurp-generation.service.ts:607`, `slurp-message-generation.service.ts:517`, `slurp-reply-generation.service.ts:234` | `SlurpPlatformEventsSettings.tsx` (imports the **server** file directly: `SlurpPlatformEventsSettings.tsx:11`) | **Coherent** and the cleanest module in the tree |
| 11 | **Ads (Garnish)** | In-feed fake ads | `services/garnish-ads/` (6 files) + `slurp/slurp-garnish-*.ts` (6 files); routes `slurp.routes.ts:3203-3512` | `SlurpInlineAd.tsx`, ad hooks `use-slurp.ts:139-327` | **Split across two folders**, and `garnish-ads/` is **outside package ownership** (see §7 risk 1) |
| 12 | **Media & images** | Upload, crop, prompt, generate, retry, serve | `slurp-images.service.ts`, `slurp-public-images.service.ts`, `slurp-image-{prompt,prompt-rewrite,retry,format,connections}.ts`, `slurp-media.ts`, `slurp-vision.ts`, `slurp-post-image-context.ts`, `slurp-garnish-image*.ts` | `PostImageCropEditor.tsx`, `SlurpImageComposer.tsx`, `hooks/use-slurp-media-src.ts` | **Coherent** |
| 13 | **Prompting** | Blocks, presets, safety, response format, tone, sampling | `slurp-prompt.ts`, `slurp-prompt-blocks.ts`, `slurp-prompt-safety.ts`, `slurp-response-format.ts`, `slurp-tone.ts`, `slurp-sampling-options.ts`, `slurp-content-format.ts`, `slurp-chat-context.ts` | `SlurpPromptBlockBuilder.tsx`, `SlurpBackstagePrompts.tsx`, `slurp-prompt-presets.ts` | **Coherent** |
| 14 | **Settings / Backstage** | One 290-key settings object plus the admin UI over it | schema `slurp.storage.ts:409-698`, defaults `:1231-…`, routes `slurp.routes.ts:625-771` | `slurp-backstage.ts` (6 sections, 17 targets), `SlurpBackstage*.tsx` (8 files, 7119 lines), `SlurpSettings.tsx`, `SlurpSettingsControls.tsx`, `slurp-settings-defaults.ts` | **Coherent client-side** (already the best-organised client cluster); schema **buried** in `slurp.storage.ts` |
| 15 | **Onboarding** | First-run flow, bulk Creator creation, first posts | `slurp-first-post-queue.service.ts`; routes `slurp.routes.ts:4472-4653` | `SlurpOnboardingPanel.tsx`, `SlurpAgeGate.tsx`, `SlurpSplash.tsx`, `SlurpHome.tsx:1724-1921` (creation-step router) | **Split**, entry flow **buried** |
| 16 | **Backup, autopurge, maintenance** | Export/restore archives, retention, data deletion | `slurp-backup.ts`, `slurp-backup-state.ts`, `slurp-autopurge*.ts` (4), `shared/src/slurp-autopurge-time.ts`, `storage/slurp-refresh-run-retention.ts`; **and 300 lines of inline job machinery at `slurp.routes.ts:1220-1576`** | `SlurpBackstageMaintenance.tsx`, `SlurpMaintenanceHealth.tsx` | **Buried**: the backup/restore job runner, its sweeper timer (`slurp.routes.ts:1266`) and the archive inspector (`:1376`) live inside the route closure |
| 17 | **Creator workshop (Improvement)** | Backstage jobs that propose profile fixes | `slurp-improvement.ts` (pure rules) + **~180 lines of job runner inline at `slurp.routes.ts:795-975`** | `SlurpCreatorImprover.tsx`, `SlurpBackstageWorkflow.tsx` | **Buried**: `slurp-improvement.ts:2-4` says "Routes own the I/O" — they do, and it is 180 lines of it |
| 18 | **Shell / chrome** | Nav rail, avatar, brand colours, persona switcher, layout primitives | — | `SlurpShell.tsx` (`Avatar` `:222`, `NoodleLogo` `:141`, `useHideOnScroll` `:146`, `NOODLE_BLUE` `:40`, `PersonaIdentityCard` `:406`), `SlurpSparkleVeil.tsx`, `NoodleAnchoredPopover.tsx`, `SlurpEmptyArtwork.tsx` | **Coherent**, mis-named (`SlurpShell` is a component *and* the design-token module) |
| 19 | **Locks & host plumbing** | Operation locks, host table tolerance, activation lifecycle, file errors | `slurp-operation-lock.ts`, `slurp-account-operation-lock.ts`, `slurp-access.ts`, `slurp-connection.ts`, `slurp-activation-lifecycle.ts`, `storage/slurp-host-tables.ts`, `storage/slurp-file-errors.ts`, `services/slurp/server-entry.ts` | — | **Coherent** |

### Things that are *not* domains — say no

- **Moments / Stories.** `SlurpHome.tsx:5647-6057` reads like a subsystem. It is a presentation of a
  post whose `metadata.noodlerPostType === "story"` (`SlurpHome.tsx:334-336`). Presentation module, not a feature module.
- **Tags.** A field on a Creator and a settings target. Sub-file of Discovery.
- **Wallet vs Economy.** One domain, two words. Pick Economy.
- **`slurp-goal.ts` / `slurp-milestones.ts`.** Two small pure files inside Arcs and World respectively. Not modules.

### Dead / unreferenced

- `client/src/hooks/use-slurp-custom-emojis.ts` — `useNoodleCustomEmojiMap` has **zero** importers
  anywhere in `packages/slurp2/src` or `sources/engine`. It is also absent from `sources/engine`,
  which confirms it was never in the build graph. Delete during the restructure, do not move.

---

## 2. The four (five) large files, dissected

### 2.1 `client/src/components/slurp/SlurpHome.tsx` — 8153 lines

`SlurpHome` itself (448–2544) is a **view router** over `navigation.mode` / `navigation.view`
(`slurp-navigation.types.ts:7-41`) with ~1700 lines of shared hook state above the branches.

| Lines | Unit | Domain |
|---|---|---|
| 1–224 | imports | — |
| 225–233 | `SlurpHomeProps`, `NOODLER_FEED_WINDOW_SIZE` | Feed |
| 234–271 | `SlurpAccessTransition` | Feed (access/unlock) |
| 272–353 | `SLURP_PLACEHOLDER_BALANCE`, `NoodlerPostSubmission`, `SlurpViewerCreator`, `NoodlerPostDraft`, `PendingNoodlerImage`, `EMPTY_NOODLER_POST_DRAFT`, `isEmptyNoodlerPostDraft`, `isSlurpStory`, `slurpSubscriptionPriceOf`, `linkedPostIdForStory`, `parsePrice` | Feed + Economy (mixed) |
| 354–375 | `NoodlerDraftImageFrame` | Media |
| 376–422 | `NoodlerProfileTab`, `toNoodlePostCardModel`, `toManagedPostCardModel` | Feed (view-model adapters) |
| 423–447 | `EMPTY_STAGE_PROFILE`, `fieldClass`, `textareaClass`, `serializeNoodlerPostGuide`, `errorMessage` | Creator identity + shell tokens |
| **448–2544** | **`SlurpHome`** — state + branches: settings `1634`, loading `1698`, error `1710`, creation `1724/1757/1781/1836`, profile `1922/2087`, discovery `2097`, wallet `2242`, notifications `2258`, studio `2273`, messages `2285`, profiles `2301`, hub `2454` | **Navigation / composition root** |
| 2545–2709 | `StageProfileSourcePicker` | Creator identity |
| 2710–2765 | `DisclosureStep` | Creator identity |
| 2766–2783 | `SlurpProfileImagePost`, `SourceAccountAvatar` | Creator identity |
| 2784–2853 | `SlurpProfileFeaturedImage`, `SlurpProfileMediaTile` | Media |
| 2854–2932 | `SlurpMediaWall` | Media |
| 2933–2950 | `noodlerGoalOf` | Arcs (goals) |
| **2951–4226** | **`StageProfileView`** (1276 lines) | Creator identity |
| **4227–5043** | **`ViewerHub`** (817 lines) — feed + discovery search | Feed / Discovery |
| 5044–5090 | `SlurpInlineSuggestedCreators` | Discovery |
| **5091–5545** | **`SlurpWalletView`** (455 lines) | Economy |
| 5546–5646 | `SlurpMediaDialog`, `SlurpPostDialog` | Feed |
| 5647–6057 | `SlurpMoment`, `SlurpMomentShelfTile`, `SlurpMomentsShelf`, `SlurpMomentViewer` | Feed (Stories) |
| 6058–6079 | `LoadMoreFeedButton` | Feed |
| **6080–6770** | **`NoodlerPostComposer`** (691 lines) | Feed (composer) |
| 6771–6862 | `SubscriptionSections` | Economy |
| 6863–6884 | `DisclosureBadge` | Creator identity |
| 6885–6944 | `SlurpFeedSkeleton`, `EmptyState` | Shell |
| 6945–7005 | `NoodlerFrame` | Shell |
| **7006–7302** | **`SlurpStudioView`** | Studio (Economy + Arcs read model) |
| 7303–7412 | `SlurpGoalEditor` | Arcs |
| **7413–7776** | **`SlurpInboxHub`**, `SlurpInboxView` | Notifications |
| **7777–8118** | **`SlurpNotificationsView`** (342 lines) | Notifications |
| 8119–8153 | `SlurpPayoutRow` | Economy |

### 2.2 `client/src/components/slurp/SlurpMessages.tsx` — 5153 lines

Single domain (#4). The split is by *surface*, not by domain.

| Lines | Unit | Sub-area |
|---|---|---|
| 1–159 | imports, `SLURP_REPLY_STATUS_FALLBACKS`, `SLURP_AWAY_STATUSES`, `TIP_PRESETS`, `requestHintGuidance`, `SLURP_MESSAGE_PAGE`, `isCommissionRequest`, `SlurpConversationDrawerMode`, `SlurpMessageThreadContext` | contracts |
| 160–563 | `SlurpMessagesView` | thread list |
| 564–641 | `ThreadRow` | thread list |
| **642–2546** | **`SlurpThreadView`** (1905 lines — the single largest unit in the package) | thread |
| 2547–2672 | `HeaderIconButton`, `SlurpConnectionSwitcher` | chrome |
| 2673–2762 | `SlurpFollowUpItem` | follow-ups |
| 2763–3026 | `SlurpMemoriesPanel`, `MemoryEditor` | memories drawer |
| 3027–3074 | `SlurpCommissionsPanel` | commissions |
| 3075–3121 | `SlurpAwayAnimation` | thread |
| 3122–3315 | `MessageBubble` | thread |
| 3316–3357 | `SlurpPlatformActionCard` | thread |
| 3358–3437 | `BroadcastPanel` (exported) | broadcast |
| 3438–3602 | `CreatorMessageTools` | creator seat |
| 3603–3786 | `FanImageTool`, `FanImagePreview` | media |
| 3787–4301 | `CommissionRequest`, `CommissionRow` | commissions |
| 4302–4574 | `ADULT_LEVELS`, `ADULT_LEVEL_HINT`, `PANEL_TONES`, `humanizeValue`, `clampPercent`, `bandWord`, `moodWord`, `Meter`, `DivergingBar`, `Stepper`, `StatusRow`, `Field`, `PanelSection` | **generic data-display primitives — not messages at all** |
| 4575–4973 | `SlurpRelationshipPanel` | rapport |
| 4974–5049 | `SlurpPromptDebugPanel` | prompting |
| 5050–5127 | `SlurpRapportBadge`, `SLURP_TIERS`, `SLURP_TIER_ICONS`, `SlurpTierLadder` | rapport |
| 5128–5153 | `useDismissablePopover` | shell |

### 2.3 `client/src/hooks/use-slurp.ts` — 3709 lines

Already grouped by domain; needs cutting, not rethinking. Query-key registries: `noodleKeys` `88–118`, `messageKeys` `3123–3142`.

| Lines | Block | Domain |
|---|---|---|
| 1–138 | imports, shared types, `noodleKeys` | base |
| 139–327 | `useSlurpInlineAds` … `useResetSlurpAds` (16 hooks) | Ads |
| 328–544 | `SlurpSettings` (290 fields) and neighbours | Settings |
| 545–868 | settings, defaults, prompt blocks, backup/restore fns (`617–677`), autopurge, maintenance, improvement jobs (`727–797`), discovery tags (`798–824`), bulk update, data deletion | Settings / Maintenance / Workshop |
| 870–999 | connections, image connections, post guidance | Prompting / Media |
| 1000–1020 | `preservePollVotes`, `useNoodlerAccounts` | Feed |
| 1021–1234 | wallet/studio/event types, `useSlurpNotifications`, `useMarkSlurpNotificationsSeen`, `useSlurpPayout`, `useSetSlurpGoal`; **`SlurpEventKind` at `1133-1149`, `SlurpEventGroup` at `1165`** | Notifications / Economy |
| 1235–1577 | projects + arcs types and 12 hooks | Arcs |
| 1578–1674 | metrics, studio, wallet, tips, prices | Economy |
| 1675–1877 | viewer scope, posts, subscribers, followers, audience members and characters | Audience |
| 1878–2111 | stage-profile CRUD, avatar/banner/artwork, source dismiss/adopt | Creator identity |
| 2112–2163 | ambient profiles | Audience |
| 2164–2310 | post draft/generation/create, image prompts, image load | Feed |
| 2311–2417 | viewer feed, unseen count, mark seen | Feed |
| 2418–2857 | subscribe/follow/unlock/interactions/post edit/access/auto-posting/fan activity/reserve/schedule | Feed + Economy + World (mixed — the messiest block) |
| 2859–2928 | first-post queue, fan-activity status | Onboarding / Audience |
| 2929–3152 | messaging types, `getSlurpPromptErrorKind`, `messageKeys`, `invalidateSlurpMessages` | Messages |
| 3153–3709 | 38 message hooks | Messages |

### 2.4 `server/src/services/storage/slurp.storage.ts` — 8044 lines

Shape: 1–1679 module scope; **`createSlurpStorage(db)` at `1680`**, private closures `1681–2290`,
then **one object literal `2291–8044`** holding ~175 methods.

| Lines | Block | Domain |
|---|---|---|
| 1–344 | imports, `SLURP_SETTINGS_KEY` `:293`, `SLURP_BACKUP_TABLES` `:305-334` (26 tables) | base |
| 345–408 | `planUnusedSlurpData`, retention constants | Maintenance |
| **409–698** | **`slurpSettingsSchema`** (290 fields) | Settings |
| 699–926 | settings/account/post/reserve types, `noodlerReservePolicyFingerprint` `:794` | base types |
| 927–1186 | `parseRecord`, `normalizeScheduler` `:954`, `normalizeNoodleAccountSettings` `:1002`, crop/array/snapshot parsers, handle normalisation `:1151-1173` | base normalisers |
| 1187–1230 | `SLURP_GUIDANCE_PRESETS` `:1196` and every legacy default-prompt constant | Prompting |
| **1231–1520** | **`DEFAULT_SLURP_SETTINGS`** | Settings |
| 1521–1679 | `snapshotForAccount` | Feed |
| 1681–1752 | project read/write closures | Arcs |
| 1753–1910 | `CREATOR_PRICES_KEY`, `economyFrom`, `compensate`, `writeWallet`, `restoreWallet`, `enqueueFinancial`, `writeEarnings`, `creditEarningsNow`, `getWalletNow` | Economy |
| 1911–1970 | `pruneFinishedRefreshRuns`, `reconcilePublicHandles` | Maintenance / Identity |
| 1971–2290 | `insertInteraction`, `normalizeLegacyNoodlerToggleInteraction`, `upsertPollVote`, `deleteInteractionChildren`, `deleteStoredInteraction` | Feed (interactions) |
| 2292–2381 | `resolveSource`, `resolveSourceByEntityId`, `listEligibleSources`, `resolveAccountSource`, `getViewer`, `listViewerWallets`, `cleanupRetiredViewer` | Creator identity |
| 2382–2444 | `getCreatorState`, `adjustCreatorState`, `addCreatorModifier`, `recordCreatorStateSignals` | World |
| 2445–2545 | `getSlurpSettings`, `exportSlurpBackup`, `importSlurpBackup`, `updateSlurpSettings` | Settings / Backup |
| 2546–2614 | `countDiscoveryTagUsage`, `resetArcType`, `replaceDiscoveryTag` | Discovery / Arcs |
| 2615–2671 | `bulkUpdateCreatorProfiles` | Creator identity |
| 2672–2804 | `deleteAllSlurpData`, `previewUnusedSlurpData`, `deleteUnusedSlurpData` | Maintenance |
| 2805–2870 | `updateSettings`, `getRefreshSchedule`, `saveRefreshSchedule`, `ensureRefreshSchedule` | Settings / Feed |
| 2871–3063 | account read/write, `deleteAccountByEntity` `:2908`, `getSlurpAccountForEntity`, `listNoodlerAccounts`, `getNoodlerAccountById` | Creator identity |
| 3064–3113 | `patchViewerSettings`, `updateViewerFollow` | Audience |
| 3114–3466 | `deleteNoodlerAccount`, `listNoodlerStageProfiles`, `createNoodlerAccount`, `updateNoodlerStageProfile`, `updateNoodlerAvatar/Banner`, `updateNoodlerSourceSnapshot`, `adoptNoodlerPublicIdentity` | Creator identity |
| 3467–3688 | `upsertAccountFromProfile`, `updateAccount`, `updateAccountProfile`, `patchAccountSettings` | Creator identity |
| 3689–3736 | `listAutoPostEnabledAccounts`, `getNoodlerCreatorActivityTimes` | Feed (scheduling) |
| **3737–4428** | **reserve / prepared-post machinery**: `ensureNoodlerReserveState`, `claimNoodlerAutomaticAttempt`, `completeNoodlerAutomaticAttempt`, `createNoodlerPreparedPost`, `createNoodlerScheduledPost`, `fillNoodlerScheduledPost`, `rescheduleNoodlerPost`, `listNoodlerPreparedPosts`, `hasNoodlerPreparedPosts`, `discardNoodlerPreparedPost`, `discardPreparedPostsAfterManualPost`, `publishDueNoodlerPreparedPosts`, `reconcileNoodlerPreparedPosts`, `getNoodlerReserveStatus` | Feed (reserve) |
| 4429–4572 | `updateAccountFollow`, `setCharacterInvited`, `setAudienceCharacter`, `listAudienceCharacterIds`, `ensureAudienceCharacterAccounts`, `listAudienceCharacterAccounts`, `clearCharacterInvites` | Audience |
| **4573–5325** | **post read/write**: `listPosts` … `resetTimeline` (30 methods, incl. image-claim lifecycle `4993–5111`) | Feed |
| **5326–6395** | **interactions & replies**: `listInteractions` … `deleteNoodlerInteraction`, incl. `claimNoodlerCreatorReply` `:5524`, `claimNoodlerAudienceReply` `:5699`, `finalizeNoodlerCreatorReplyClaim` `:5816`, `createNoodlerFanInteraction` `:6074`, `createNoodlerWorldInteraction` `:6199` | Feed + Audience |
| 6396–6602 | digests and refresh runs | Feed (refresh) |
| **6603–6946** | `subscribe` `:6603` (216 lines), `unsubscribe`, `listSubscriptions*`, `recordAudiencePostUnlock` | Economy |
| 6947–7070 | `unlockPost` | Economy |
| **7071–7437** | wallet + ledger + income: `isSyntheticWalletHolder` … `payOutEarnings`; `advanceAudienceTie` `:7342`, `recordCreatorEvent` `:7373` (writes `slurp-events.storage`) | Economy + Notifications |
| **7438–7994** | goals, arc config, projects, chapters, crossovers, auto-arcs: `getGoal` … `listPostsByProject` (26 methods) | Arcs |
| 7995–8044 | `getEarnings`, `creditEarnings`, `listPostUnlocksForViewer`, `bootstrap` | Economy / base |

### 2.5 `server/src/routes/slurp.routes.ts` — 5254 lines, ~150 routes

Shape: module-scope schemas and multipart helpers `284–590`; **`slurpRoutes(app)` at `591`**;
everything else is one closure. `slurp-messages.routes.ts` is already mounted from inside it
(`slurp.routes.ts:5253`) — **that is the pattern the rest should follow.**

| Lines | Block | Domain |
|---|---|---|
| 1–283 | imports | — |
| 284–452 | request schemas (`slurpNoodlerPostCreateSchema` `:332`, `slurpStageProfileSchema` `:363`, `noodlerPageCursorSchema` `:391`) | Feed / Identity |
| 453–590 | `readNoodlerMultipart` `:452`, `importNoodlerMedia` `:509`, `decodeNoodlerMediaRequest` `:553`, `sendNoodlerMediaError` `:581` | Media |
| 591–624 | storage/service construction (`noodle`, `characters`, `connections`, `noodlerImages`, `ads`, `firstPostQueue`) + `resolveNoodlerPublicIdentity` `:613` | composition root |
| 625–771 | settings, prompt blocks, defaults, audience characters, autopurge preview, maintenance summary, arc reset, fan-type rebalance (`planFanTypeRebalance` `:741`), model budget, discovery tags | Settings |
| 772–975 | `POST /noodler/accounts/bulk-update`, then **the improvement-job runner**: `readImprovementJob` `:812`, `publicImprovementJob` `:824`, `insertProposal` `:853`, `processImprovementJob` `:876-974` | Creator workshop — **should not be in a routes file** |
| 976–1219 | `/backstage/*` readiness + improvement-job endpoints | Creator workshop |
| **1220–1576** | **the backup/restore engine**: `backupJobs` map `:1220`, `sweepBackupArchives` `:1234`, `backupSweepTimer` `:1266`, `runExclusive` `:1297`, `createBackupJob` `:1316`, `inspectRestoreArchive` `:1376`, `createRestoreJob` `:1435`, plus 8 routes | Backup — **should not be in a routes file** |
| 1577–1653 | ambient profiles | Audience |
| 1654–1687 | account settings/profile patch | Creator identity |
| 1688–1753 | accounts list, conversation-schedule refresh | Creator identity / Messages |
| 1754–1935 | viewer wallet, daily refill, dev-set, tip, subscription price, viewer wallets, connection counts | Economy |
| 1936–2096 | avatar/banner serve + upload + artwork generate | Media |
| 2097–2351 | `resolveViewerPersona` `:2097`, `resolveViewerIdentity` `:2101`, `creatorBelongsToViewer` `:2114`, `buildViewerContext` `:2121`, `buildViewerShell` `:2173`, `projectViewerPosts` `:2202` | **Viewer projection — a real module hiding in a closure** |
| 2352–2747 | goal, projects CRUD, director, arcs, arc-config, arc-library generate, project posts | Arcs |
| **2748–2847** | notifications GET (which also runs 4 world jobs, `:2756-2775`) + seen POST | Notifications + World tick |
| 2848–3083 | payout, studio, creator metrics | Economy / Studio |
| 3084–3202 | unseen count, mark-seen, viewer, viewer feed | Feed |
| 3203–3512 | ads: viewer ads, hide, reset, action, brand hide/unhide, state, pool CRUD, image, lorebook sync, generate, export, import | Ads |
| 3513–3706 | post media, share card, interactions, story view/views | Feed |
| 3707–4010 | creator reply, interaction CRUD, post patch/create/media/image/delete | Feed |
| 4011–4351 | subscribe/unsubscribe, subscribers, followers, audience member, follow, unlock | Economy / Audience |
| 4352–4416 | stage-profile draft, post draft | Creator identity / Feed |
| 4417–4653 | create Creator, bulk create | Onboarding |
| 4654–4825 | stage-profile PUT, source dismiss/adopt | Creator identity |
| 4826–4898 | delete account, delete data, delete unused | Maintenance |
| 4899–4950 | account posts | Feed |
| 4951–5055 | auto-post status/schedule, post guidance, guidance draft | Feed / Prompting |
| 5056–5197 | image connections, run-now, refresh-now, fan-activity refresh/status, refresh-targeted, first posts | Feed / Audience |
| 5198–5254 | refresh images, `/refresh`, **`await slurpMessageRoutes(app)` `:5253`** | Feed |

---

## 3. Proposed module vocabulary

Four layers. The tree already speaks three of them; formalise, do not invent.

### Layer 1 — `base/` : things every feature uses

> **Rule:** a base module names a *capability the product has*, never a technology and never a place. If you cannot finish "every feature needs to ___", it is not base.

| Good | Bad | Why |
|---|---|---|
| `base/settings` | `base/config` | "config" is the technology; "Settings" is the screen the user opens |
| `base/prompting` | `base/llm` / `base/ai` | the capability is building a prompt, not the vendor |
| `base/media` | `base/uploads` | serving, cropping and generating are all media; "uploads" is one verb of four |
| `base/identity` | `base/auth` | there is no auth here; this is source-binding and disclosure |
| `base/chrome` | `base/shell` / `base/common` / `base/ui` | `SlurpShell.tsx` is already overloaded as a component name (`SlurpShell.tsx:323`); "common" and "ui" mean nothing in five years |
| `base/persistence` | `base/db` / `base/storage-utils` | host tables, locks, file errors, id/txn helpers |

### Layer 2 — `features/` : a product area

> **Rule:** a feature module is named for the thing the *player* experiences, in the noun they would use, singular-or-plural as the product speaks it. If two names fit, take the one already in `ui.slurp.*` locale keys or in `SLURP_BACKSTAGE_TARGETS` (`slurp-backstage.ts:14-31`) — those were named by the owner and already ship.

| Good | Bad | Why |
|---|---|---|
| `features/creators` | `features/accounts` / `features/stage-profiles` | player says "Creator"; `SLURP_BACKSTAGE_SECTIONS` already says `creators` |
| `features/feed` | `features/posts` / `features/timeline` | the feed contains posts, stories, polls and ads; "posts" under-names it |
| `features/messages` | `features/dm` / `features/chat` | `ui.slurp.messages.*` (272 keys) and `slurp-messages.routes.ts` already agree |
| `features/audience` | `features/fans` / `features/population` | "population" is the implementation (`slurp-population.ts:2`), "audience" is the product (`SLURP-LIVE-WORLD-PLAN.md:62`) |
| `features/world` | `features/simulation` / `features/engine` | "engine" collides with Marinara Engine; "simulation" is the mechanism |
| `features/arcs` | `features/projects` | `slurp-project.ts:2` states outright: "The player sees these as Arcs." **`project` is a rename candidate for the later job — do not rename now.** |
| `features/economy` | `features/wallet` / `features/coins` | wallet is one surface of it; payouts and prices are the rest |
| `features/notifications` | `features/events` | "events" is ambiguous with platform events (§6). `ui.slurp.inbox.*` exists too, but Inbox is a *surface* of Notifications |
| `features/discovery` | `features/search` / `features/tags` | search and tags are both inside it |
| `features/ads` | `features/garnish-ads` | "Garnish" is an old-era name. **Rename candidate, later job.** Keep the folder `garnish-ads/` until then |
| `features/onboarding` | `features/setup` / `features/wizard` | `ui.slurp.onboarding.*` already exists |
| `features/backstage` | `features/admin` / `features/settings-ui` | Backstage is the owner's word and ships in the nav |
| `features/maintenance` | `features/ops` / `features/cleanup` | matches `SLURP_BACKSTAGE_SECTIONS` `maintenance` |

**File-suffix rule inside a module** — already in the tree, keep it, it is good:
`*.ts` = pure rules, no I/O (11 files self-declare this, e.g. `slurp-rapport.ts:3`, `slurp-reach.ts:4`,
`slurp-tuning.ts:3`); `*.service.ts` = does I/O (29 files); `*.operation.ts` = orchestrates several
services under a lock (10 files); `*.storage.ts` = touches the DB.
Good: `audience/fan-types.ts` (pure), `audience/fan-activity.operation.ts`.
Bad: `audience/fan-types-helper.ts`, `audience/FanTypesManager.ts`.

### Layer 3 — `parts/` : reusable presentation modules

> **Rule:** a part is named `<Noun>Card`, `<Noun>Tile`, `<Noun>Row`, `<Noun>Sheet`, `<Noun>Panel` or a bare noun — one word for the thing rendered, plus one word for the shape. No product prefix, no feature prefix, no layout adjective.

| Good | Bad | Why |
|---|---|---|
| `parts/PostCard` | `parts/SlurpPostCard` / `parts/MediaForwardPostCard` | everything in this tree is Slurp; "media-forward" is a variant, not a name |
| `parts/CreatorCard` | `parts/StageProfileCard` | "stage profile" is the storage word |
| `parts/FanCard` | `parts/AudienceMemberCard` | `SlurpFanCard.tsx` already won this argument |
| `parts/StoryTile` | `parts/MomentShelfTile` | "Moment" is a third name for a Story (`SlurpHome.tsx:5647`); pick Story |
| `parts/Meter`, `parts/Stepper` | `parts/RelationshipMeter` | `SlurpMessages.tsx:4366`/`:4459` are already generic; do not re-narrow them |

### Layer 4 — `app/` : one composition root per client surface

> **Rule:** exactly one file per navigation destination in `SlurpNavigationState` (`slurp-navigation.types.ts:7-41`); it wires hooks to parts and holds no domain logic.

Good: `app/HubScreen.tsx`. Bad: `app/SlurpHomeContainer.tsx`, `app/MainView.tsx`.

---

## 4. Target tree sketch

Depth cap: **module → submodule**, two levels under `slurp/`. Third level allowed only for `features/messages/commissions` and `features/feed/reserve`, justified below.

### Server

```
packages/server/src/
├── routes/
│   └── slurp/                                  ★ NEW OWNED PATH
│       ├── index.ts                  composition root; mounts the rest (today: slurp.routes.ts:591-5254)
│       ├── settings.routes.ts        from :625-771
│       ├── backstage.routes.ts       from :976-1219
│       ├── backup.routes.ts          from :1477-1576  (engine moves to services, see below)
│       ├── creators.routes.ts        from :1654-1753, :4352-4416, :4654-4898
│       ├── feed.routes.ts            from :3084-3202, :3513-4010, :4899-5055, :5198-5252
│       ├── audience.routes.ts        from :1577-1653, :4011-4351, :5100-5197
│       ├── economy.routes.ts         from :1754-1935, :2848-3083
│       ├── arcs.routes.ts            from :2352-2747
│       ├── notifications.routes.ts   from :2748-2847
│       ├── media.routes.ts           from :1936-2096, :453-590 helpers
│       ├── ads.routes.ts             from :3203-3512
│       ├── onboarding.routes.ts      from :4417-4653
│       └── messages.routes.ts        today's slurp-messages.routes.ts, moved
│   └── slurp.routes.ts               kept as a 3-line re-export shim (see §7 risk 3)
├── services/
│   └── slurp/                                  (already owned — subfolders are free)
│       ├── base/
│       │   ├── prompting/      slurp-prompt*.ts, -response-format, -tone, -sampling-options, -content-format, -chat-context
│       │   ├── media/          slurp-image-*.ts, slurp-media.ts, slurp-vision.ts, slurp-images.service.ts, slurp-public-images.service.ts
│       │   ├── identity/       slurp-source*.ts, -handle, -avatar, -disclosure, -identity-protection, -access, -connection
│       │   ├── locks/          slurp-operation-lock.ts, slurp-account-operation-lock.ts, slurp-activation-lifecycle.ts
│       │   └── budget/         slurp-model-budget.ts, slurp-model-worker.ts, slurp-model-answer.ts, slurp-tuning.ts
│       ├── features/
│       │   ├── creators/       stage-profile-*, creator-state, creator-pricing, creator-schedule*, improvement/ (+ the runner from routes:795-975)
│       │   ├── feed/           generation.service, post*.ts, autopost*, refresh*, generated-*, share-card
│       │   │   └── reserve/    ★ third level: slurp-reserve.operation.ts + the 690 storage lines at slurp.storage.ts:3737-4428 — one self-contained claim/prepare/publish state machine with its own tables
│       │   ├── messages/       messaging, message*.service, reply-generation, dm-response, follow-up*, thread-notes, conversation-*, check-in-intervals, cheat-directive, rapport
│       │   │   └── commissions/ ★ third level: slurp-commission-*.ts + the commission routes — its own request/quote/counter/accept/decline/deliver lifecycle with its own table
│       │   ├── audience/       population, fan-types, fan-activity*, fan-identity-provider, audience-*, reach, scale, ambient-profile*
│       │   ├── world/          world*.ts, day-vibe*, mood, stance, talkativeness, pending-text, reaction-bank*, milestones, platform-events
│       │   ├── arcs/           project.ts, arc-generation.service, audience-arc, goal
│       │   ├── economy/        wallet, prices, earnings, payment-*, media-offer
│       │   ├── notifications/  event-weight.ts + the grouping/actor-resolution lifted from routes:2748-2847
│       │   ├── discovery/      discovery-profile.ts
│       │   ├── onboarding/     first-post-queue.service.ts
│       │   └── maintenance/    autopurge*, backup*, + the backup engine from routes:1220-1476
│       └── server-entry.ts                     stays put; 8 schedulers registered here
├── services/storage/
│   └── slurp/                                  ★ NEW OWNED PATH
│       ├── index.ts              createSlurpStorage(db) — composes the facets below, same public shape
│       ├── settings.storage.ts   slurp.storage.ts:409-698, 1231-1520, 2445-2545, 2805-2838
│       ├── creators.storage.ts   :2292-2381, 2615-2671, 2871-3688
│       ├── feed.storage.ts       :1971-2290, 3689-3736, 4573-5325, 6396-6602
│       ├── reserve.storage.ts    :3737-4428
│       ├── interactions.storage.ts :5326-6395
│       ├── audience.storage.ts   :3064-3113, 4429-4572   (+ today's slurp-population.storage.ts)
│       ├── economy.storage.ts    :1753-1910, 6603-7070, 7071-7437, 7995-8022
│       ├── arcs.storage.ts       :1681-1752, 7438-7994
│       ├── maintenance.storage.ts :345-408, 1911-1926, 2672-2804
│       ├── messages.storage.ts   today's slurp-messages.storage.ts + .helpers + .types
│       ├── events.storage.ts     today's slurp-events.storage.ts
│       └── host.ts               :927-1186 normalisers, slurp-host-tables, slurp-file-errors, slurp-financial-queue
│   └── slurp.storage.ts          kept as a re-export shim
├── services/garnish-ads/                       ★ MUST BE ADDED TO OWNERSHIP NOW (see §7 risk 1)
└── db/schema/slurp.ts                          unchanged, already owned
```

### Client

```
packages/client/src/
├── components/slurp/                            (already owned — subfolders are free)
│   ├── app/            SlurpApp.tsx (the router from SlurpHome.tsx:448-2544) + one screen per nav view:
│   │                   HubScreen, ProfileScreen, DiscoverScreen, WalletScreen, StudioScreen,
│   │                   NotificationsScreen, MessagesScreen, ProfilesScreen, CreateProfileScreen, BackstageScreen
│   ├── chrome/         SlurpShell.tsx, Avatar, NoodleLogo, tokens, SlurpSparkleVeil, NoodleAnchoredPopover,
│   │                   SlurpEmptyArtwork, SlurpFeedSkeleton, EmptyState, NoodlerFrame, useDismissablePopover
│   ├── parts/          PostCard, CreatorCard, FanCard, StoryTile, CoinBadge, InlineAd, ImageCropEditor,
│   │                   PollComposer, ImageComposer, Meter, Stepper, DivergingBar, StatusRow, Field, PanelSection
│   ├── creators/       StageProfileForm, StageProfileView, SourcePicker, DisclosureStep, CreatorBulkEdit, CreatorImprover
│   ├── feed/           Composer (SlurpHome.tsx:6080-6770), MediaWall, Moments→Stories, post dialogs
│   ├── messages/       MessagesView, ThreadView, MessageBubble, MemoriesPanel, CommissionsPanel,
│   │                   RelationshipPanel, BroadcastPanel, PromptDebugPanel, RapportBadge
│   ├── discovery/      DiscoverToolbar, DiscoveryProfileEditor, TagsSettings
│   ├── economy/        WalletView, SubscriptionSections, PayoutRow
│   ├── notifications/  InboxHub, InboxView, NotificationsView
│   ├── onboarding/     OnboardingPanel, AgeGate, Splash
│   └── backstage/      slurp-backstage.ts + the 8 SlurpBackstage*.tsx + SlurpSettings*.tsx + the settings sub-panels
├── hooks/
│   └── slurp/                                   ★ NEW OWNED PATH
│       ├── keys.ts            noodleKeys (use-slurp.ts:88-118) + messageKeys (:3123-3142)
│       ├── use-settings.ts    :328-868
│       ├── use-creators.ts    :1878-2111
│       ├── use-feed.ts        :1000-1020, 2164-2417, 2616-2857
│       ├── use-audience.ts    :1675-1877, 2112-2163, 2891-2928
│       ├── use-economy.ts     :1199-1234, 1578-1674, 2418-2502
│       ├── use-arcs.ts        :1235-1577
│       ├── use-notifications.ts :1133-1198
│       ├── use-ads.ts         :139-327
│       ├── use-messages.ts    :2929-3709
│       └── types.ts           the cross-cutting exported types
│   └── use-slurp.ts           kept as a re-export shim
├── lib/                       slurp-discovery.ts, slurp-refresh-batch.ts, slurp-custom-emojis.ts, api-client.ts (unchanged; 3 files does not earn a folder)
├── stores/slurp-package.store.ts                unchanged
└── slurp-package-entry.tsx                      unchanged
```

### New entries required in `slurp2OwnedSourcePaths`
(`scripts/build-feature-packages.mjs:162-186`; matching is exact-or-prefix — `capturePackageSources` at `:276` — so a directory entry covers everything beneath it)

1. `packages/server/src/routes/slurp` — new
2. `packages/server/src/services/storage/slurp` — new
3. `packages/client/src/hooks/slurp` — new
4. `packages/server/src/services/garnish-ads` — **not new; missing today.** Add regardless of this restructure.

Nothing else is needed: `packages/client/src/components/slurp` and `packages/server/src/services/slurp`
are already prefix entries (`:151`, `:157`), so every subfolder under them is covered for free.
That is why the tree above puts almost everything inside those two roots.

### Locale keys
**No renames required.** Keys are flat dotted strings named by *domain*, not by file:
2080 `ui.slurp.*` keys across 40 groups — `ui.slurp.settings` (1249), `ui.slurp.messages` (272),
`ui.slurp.projects` (71), `ui.slurp.profile` (62), `ui.slurp.wallet` (52), `ui.slurp.studio` (49),
`ui.slurp.events` (48), `ui.slurp.discover` (44), `ui.slurp.inbox` (27). The validator
(`scripts/validate-package-locale-keys.mjs:35`) matches `"ui\.[a-zA-Z0-9_.]+"` literals in the built
bundle against the catalog; it is blind to file paths. **This is a strong independent check on the
domain list in §1** — the proposed module names and the shipped key groups agree almost exactly.
The one mismatch is `ui.slurp.projects` vs `features/arcs`, which is the known rename candidate.

---

## 5. Reusable module candidates

Call sites counted by import, across `client/src/`.

| Candidate | Call sites today | Verdict |
|---|---|---|
| `NoodleAnchoredPopover.tsx` | `SlurpMessages`, `SlurpFanCard`, `SlurpHome`, `SlurpPollComposer`, `SlurpCreatorPostCard`, `SlurpPostCard` — **6** | `parts/Popover`. Highest-reuse element in the tree |
| `SlurpSettingsControls.tsx` | 13 files (every `SlurpBackstage*`, `SlurpTagsSettings`, `SlurpFanTypesSettings`, `SlurpPlatformEventsSettings`, `SlurpSimulationSettings`, `SlurpAudienceConfigSettings`, `SlurpCreatorBulkEdit`) — **13** | `backstage/controls`. Feature-local, not a generic part: it encodes the Backstage save contract |
| `SlurpCoin.tsx` | `SlurpCreatorProfileCard`, `SlurpShell`, `SlurpMessages`, `SlurpCreatorPostCard`, `SlurpHome` — **5** | `parts/CoinBadge` |
| `SlurpFanCard.tsx` | `SlurpPostCard`, `SlurpHome`, `SlurpCreatorPostCard` — **3** | `parts/FanCard` |
| `PostImageCropEditor.tsx` | `SlurpHome`, `SlurpCreatorPostCard`, `SlurpPostCard` — **3** | `parts/ImageCropEditor` |
| `SlurpPollComposer.tsx` | `SlurpHome`, `SlurpCreatorPostCard`, `SlurpPostCard` — **3** | `parts/PollComposer` |
| `SlurpEmptyArtwork.tsx` | `SlurpCreatorProfileCard`, `SlurpMessages`, `SlurpProfileSurface` — **3** | `parts/EmptyArtwork` |
| `Avatar` (`SlurpShell.tsx:222`), `SlurpMediaImg` (`:213`), `ProfileInitial` (`:283`), `initials` (`:130`) | imported by nearly every component | `chrome/` — split out of `SlurpShell.tsx`, which is simultaneously a layout component (`:323`) and the design-token module (`:40-80`) |
| `Meter` / `DivergingBar` / `Stepper` / `StatusRow` / `Field` / `PanelSection` (`SlurpMessages.tsx:4366-4574`) | 1 file today | **Promote anyway.** They are already written generic (`humanizeValue` `:4348`, `clampPercent` `:4351`, `bandWord` `:4354`) and `SlurpStudioView` (`SlurpHome.tsx:7006`) re-implements the same shapes. Three-call-site rule met after the merge, not before |
| `SlurpSparkleVeil.tsx` | `SlurpCreatorPostCard`, `SlurpHome` — 2 | Move to `chrome/`, do not promote to a part |
| `SlurpInlineAd.tsx` | `SlurpBackstageChrome`, `SlurpHome` — 2 | `features/ads/`, not a shared part |
| `SlurpPostGuidanceField.tsx` | `SlurpBackstagePrompts`, `SlurpBackstageCreators` — 2 | `backstage/` |

### Duplicated concepts

**Post card — `SlurpPostCard.tsx` vs `SlurpCreatorPostCard.tsx`.** Not the duplication it looks like.

- `SlurpPostCard.tsx` is **misnamed**. It is a 2512-line grab-bag: a markdown renderer
  (`renderNoodleMarkdown` `:241`–`:551`, ~310 lines), mention suggestions (`:147`), custom-emoji text
  (`:121`), `NoodlePollCard` (`:552`), lightbox helpers (`:677`), tool buttons and popovers
  (`:694`, `:737`, `:788`), image-edit controls (`:914`), the `NoodlePostCardCtx` contract (`:1077`),
  two controller hooks (`:1206`, `:1304`), `NoodlePostCard` itself (`:1468`) and `NoodleComposerShell` (`:2474`).
- `SlurpCreatorPostCard.tsx:2-7` states the relationship explicitly: it shares "all leaf helpers,
  the ctx contract, and the reply/edit/poll machinery's building blocks"; only layout differs. It
  imports `SlurpPostCard`. `SlurpCreatorPostCard.tsx` holds only `LockedSlurpPostCard` (`:80`) and
  `SlurpCreatorPostCard` (`:542`).

**Winner: neither, as a file.** Split `SlurpPostCard.tsx` into
`parts/markdown/`, `parts/PollCard`, `parts/composer-tools/`, `parts/PostCardContext` (the ctx +
controllers), then keep **two thin layout components** — `parts/PostCard` (public layout) and
`parts/CreatorPostCard` (membership layout) — over one shared controller. Merging the two layouts
into one component with a `variant` prop would be the wrong call: the header, access pill, body
width and image placement all differ, and a variant flag would re-create the 2512-line file.

**Second duplication: the stat-tile / meter language.** `SlurpMessages.tsx:4366-4574` and
`SlurpStudioView` (`SlurpHome.tsx:7006-7302`) render the same vocabulary twice.
Winner: `SlurpMessages.tsx`'s primitives — they are already parameterised.

**Third: `fieldClass` / `textareaClass`.** Defined in `SlurpPostCard.tsx:58-64` (exported) **and**
re-declared locally in `SlurpHome.tsx:433-436`. One wins: the exported pair, moved to `chrome/tokens.ts`.

---

## 6. Event system

### 6.0 There are two systems and they share a word

This must be settled before anything is designed. The step-1 brief lists
`slurp-platform-events.ts` and `slurp-events.storage.ts` together. They are unrelated:

| | **Platform events** | **Notification events** |
|---|---|---|
| What | Calendar occasions (Halloween, Black Friday) that colour generated text | The player's activity feed: who subscribed, tipped, unlocked |
| Definition | `slurp/slurp-platform-events.ts:13` (zod), defaults `:30-98` | `slurp/slurp-event-weight.ts:16-38` (a 17-member union type) |
| Stored in | `slurpSettings.platformEvents` (`slurp.storage.ts:690`) | table `slurpEvents`, via `storage/slurp-events.storage.ts:66` |
| Read by | 3 prompt builders | 1 route |
| UI | `SlurpPlatformEventsSettings.tsx` | `SlurpNotificationsView` (`SlurpHome.tsx:7777`) |
| Locale group | `ui.slurp.events` (48 keys) | `ui.slurp.inbox` (27 keys) |

Naming decision: **Platform events** stays; **Notification events** becomes `features/notifications`
and its kind union is "notification kinds", not "event kinds". `SlurpEventKind`
(`use-slurp.ts:1133`, `slurp-event-weight.ts:16`) is a rename candidate for the later job.

### 6.1 Platform events — flow end to end

1. **Definition.** `slurp-platform-events.ts:13-25` — `{id, name, enabled, month, day, durationDays, guidance≤600}`.
   Eight defaults at `:30-98`. Lenient parse at `:100-107` drops broken rows rather than the list.
2. **Storage.** No table. It is one array field on the settings blob:
   `slurp.storage.ts:690` `platformEvents: slurpPlatformEventsSchema`. Written by `PATCH /settings`
   (`slurp.routes.ts:638`).
3. **Active-window evaluation.** `slurpActivePlatformEvents` `:111-121`. UTC day boundaries; tries
   this year's and last year's start so a December event wraps into January.
4. **Injection.** `slurpPlatformEventInstruction` `:124-133` renders one prompt block or `null`.
   Three call sites, all passing `new Date()` at the call: post generation
   `slurp-generation.service.ts:607`, DM generation `slurp-message-generation.service.ts:517`,
   comment-reply generation `slurp-reply-generation.service.ts:234`. The latter two thread it
   through an optional `platformEvents?: string | null` input field
   (`slurp-message-generation.service.ts:124`, `:243`).
5. **Settings UI.** `SlurpPlatformEventsSettings.tsx`, mounted at `SlurpBackstageWorld.tsx:257-262`,
   with a live counter at `SlurpBackstageWorld.tsx:146-147`. **The client imports the server module
   directly** — `SlurpPlatformEventsSettings.tsx:11` →
   `../../../../server/src/services/slurp/slurp-platform-events.js`. 19 such cross-package imports
   exist (`SlurpFanTypesSettings.tsx:9`, `SlurpSettings.tsx:64`, `slurp-simulation-estimate.ts:15-24`,
   `SlurpCreatorPostCard.tsx:29`, `SlurpFanCard.tsx:6`, `SlurpAudienceConfigSettings.tsx:5-15`,
   `SlurpBackstageOverview.tsx:14`, `SlurpBackstageChrome.tsx:10`, `SlurpBackstageWorld.tsx:28,44`,
   `SlurpSimulationSettings.tsx:19`).

### 6.2 What the current shape blocks

1. **Only one trigger exists: a fixed calendar date.** `{month, day, durationDays}` is baked into
   the schema (`:17-19`) and into the evaluator (`:113-119`). A weekly rhythm, a one-off dated event,
   a "when a Creator crosses 10k followers" event, or a manually-started event cannot be expressed
   without changing the schema — and the schema is a settings field, so changing it touches the
   whole 290-field settings blob and its defaults.
2. **Only one effect exists: a string appended to a prompt.** `slurpPlatformEventInstruction`
   returns `string | null`. An event that changes a rate (more tips during Black Friday), unlocks a
   UI banner, or seeds a post idea has nowhere to land.
3. **Injection is a copy-paste per prompt.** Each of the three generators independently calls
   `slurpPlatformEventInstruction(settings.platformEvents, new Date())`. A fourth generator must
   remember to. A second event *kind* would need three more edits in three more files.
4. **Time is captured, not passed.** All three call sites construct `new Date()` at the call, so a
   test cannot drive the calendar without faking the clock globally. Contrast the pure function
   itself, which takes `at: Date` (`:111`).

### 6.3 The smallest boundary change that makes a new event kind additive

One move, no new abstraction layer:

> **Introduce `features/world/events/` with a kind registry and a single
> `activeWorldEvents(settings, at): WorldEvent[]` entry point, and make the three generators call
> that instead of `slurpPlatformEventInstruction`.**

Concretely, the seam is three edits:

- **A discriminated `kind` field on the stored event** (`slurp-platform-events.ts:13`).
  Today's eight defaults get `kind: "calendar"`; `slurpNormalizePlatformEvents` `:100` already
  drops unparseable rows, so an older build reading a newer event kind degrades to "not running"
  rather than crashing. That is the whole forward-compatibility story and it already exists.
- **One evaluator dispatch** in place of `slurpActivePlatformEvents` `:111`: a
  `Record<kind, (event, ctx) => boolean>`. Adding a kind = adding one entry. Signature takes `at`
  (and later a context object), so the clock stays injectable.
- **One injection point.** Replace the three copies at `slurp-generation.service.ts:607`,
  `slurp-message-generation.service.ts:517`, `slurp-reply-generation.service.ts:234` with one call
  to the same helper. The *shape* they already share — optional `platformEvents?: string | null`
  threaded into the prompt input (`slurp-message-generation.service.ts:124`) — is the right shape;
  it just needs one producer instead of three.

What **not** to do now: no event bus, no handler plugin interface, no new table, no effect system.
An event kind whose only effect is prompt text needs none of it, and `slurpSettings.platformEvents`
(`slurp.storage.ts:690`) is a perfectly good store for ≤100 rows (`:25`).

Constraint that holds the seam in place: `SlurpPlatformEventsSettings.tsx:11` imports the server
module directly. Whatever the new folder is called, the client must still be able to reach it by
relative path — so it must live under `server/src/services/slurp/`, which is already owned. **No
ownership entry is needed for the event work.**

---

## 7. Risk register

Ranked by (likelihood × silence). Silent failures rank above loud ones.

**1 — Test suite reads source files as text.**
128 of the 151 `tests/slurp*` files use `readFileSync` on a source path; only 94 use real imports.
They assert on substrings. Splitting a file breaks them three ways, and the third is silent:
(a) `ENOENT` — loud, fine; (b) a positive `assert.match(routesSource, /…/)` fails because the code
moved next door — loud, fine; (c) **a negative assertion passes vacuously.**
`tests/slurp2-arc-reach.regression.ts:132-133` asserts the route source does *not* contain
`creatorBelongsToViewer` or `arcDirectorMode`. Move those routes to `arcs.routes.ts` and both
assertions become true about a file that no longer contains the code they were guarding. Same shape
at `tests/slurp2-arc-library.regression.ts:36` (`storage` must not contain `arcAllowedKinds: z.`),
`tests/slurp2-arc-director.regression.ts:95,112`, `tests/slurp2-backstage-anchors.regression.ts:24`.
*Mitigation:* before moving anything, grep every `doesNotMatch` / `!…includes(` in `tests/slurp*` and
re-point its `readFileSync` path in the same commit as the move. Treat a negative source assertion
as part of the file it guards.

**2 — `garnish-ads/` is in the overlay but not in `slurp2OwnedSourcePaths`.**
Six files under `packages/server/src/services/garnish-ads/` ship in `packages/slurp2/src/engine`
and are absent from the ownership list (`build-feature-packages.mjs:162-186`). They are byte-identical
to `sources/engine/packages/server/src/services/garnish-ads/` today, so nothing is broken — but
`capturePackageSources` (`:260-283`) will copy any edit straight into `sources/engine`, making it
generic Engine material for every other package's build input. This is exactly the failure the
comment at `build-feature-packages.mjs:180-182` documents for the three storage files.
Two files have the same exposure: `client/src/hooks/use-creator-personas.ts` (identical to Engine)
and `client/src/hooks/use-slurp-custom-emojis.ts` (dead, see §1).
*Mitigation:* add `packages/server/src/services/garnish-ads` to the list in its own commit,
before any restructure work. Delete the dead emoji hook.

**3 — Deep import paths in ~94 test files and 19 client→server imports.**
Top targets: `slurp.storage.ts` (32 files), `slurp.routes.ts` (29), `SlurpHome.tsx` (18),
`slurp-messages.routes.ts` (13), `use-slurp.ts` (12). If every move requires touching 100 test files,
the restructure stalls.
*Mitigation, and this is the load-bearing one:* keep `slurp.storage.ts`, `slurp.routes.ts`,
`use-slurp.ts` and `SlurpHome.tsx` as **re-export shims** at their current paths for the whole
restructure. Every import keeps resolving. Delete the shims only after a deliberate, separate
import-rewrite pass with a green baseline on both sides.
Caveat: a shim does **not** save the text-reading tests in risk 1 — only the importing ones.

**4 — Route handlers are closures over `slurpRoutes`'s locals.**
`slurp.routes.ts:592-598` builds `noodle`, `characters`, `characterGallery`, `connections`,
`noodlerImages`, `ads`, `firstPostQueue`; further down, `resolveViewerPersona` `:2097`,
`buildViewerContext` `:2121`, `projectViewerPosts` `:2202`, `resolveReadableNoodlerPost` `:3472`,
`processImprovementJob` `:876`, `createBackupJob` `:1316`, `activeImprovementJobs` `:803`,
`backupJobs` `:1220` and `backupSweepTimer` `:1266` all close over them. Splitting the file means
turning each group into `export async function xRoutes(app, deps)`. Two things can change silently:
(a) **shared mutable state** — `activeImprovementJobs`, `backupJobs`, `restoreInspections`,
`noodlerViewerSignalCache` `:611` — if two modules each construct their own Map, in-flight-job
deduplication and the cache both stop working with no error; (b) **the sweep timer** at `:1266`
must be created exactly once and torn down with the plugin.
*Mitigation:* build the deps object once in `routes/slurp/index.ts` and pass it; never re-construct
a Map or a timer inside a moved module. Mirror `slurp.routes.ts:5253` exactly.

**5 — The mirrored-Engine overlay makes "new directory" the only dangerous move.**
`prepareFeatureBuildRoot` (`build-feature-packages.mjs:196-207`) copies `sources/engine`, then
overlays the package tree — so a package file at an Engine path *replaces* the Engine file in the
build, and `capturePackageSources` writes it back into `sources/engine` unless excluded. Any target
folder outside the four prefix entries is a contamination vector.
*Mitigation:* the §4 tree deliberately nests almost everything under the two existing prefix entries
(`components/slurp`, `services/slurp`). Only four ownership lines are needed; adding them is
mechanical and must land **before** the first file moves.

**6 — Circular imports between the new modules.**
Real edges exist today: `slurp.storage.ts:176` imports `slurp-events.storage.ts`, which imports
`slurp/slurp-event-weight.ts`; `slurp-messages.storage.ts:38` imports the same; `slurp-message.operation.ts:15`
does too. Split `slurp.storage.ts` into `economy.storage.ts` + `events.storage.ts` and the
`recordCreatorEvent` path (`slurp.storage.ts:7373-7401` → `:7381`) becomes an economy→notifications
edge, while notifications' read model needs accounts and population (`slurp.routes.ts:2805-2818`).
*Mitigation:* the existing suffix convention already encodes the layering — **pure `*.ts` must not
import `*.storage.ts` or `*.service.ts`**. Keep write-side event recording as a one-way call from
domain storage into `events.storage`, and keep the read-side join in `routes/slurp/notifications.routes.ts`.
Enforce with a lint rule or one regression test; do not rely on discipline.

**7 — Moves that change behaviour silently.**
- `GET /noodler/notifications` (`slurp.routes.ts:2748`) runs four world jobs before reading
  (`advanceSlurpWorld` `:2756`, `drainSlurpPendingText` `:2761`, `topUpSlurpReactionBank` `:2767`,
  `drainSlurpAudienceReplies` `:2773`), each `.catch`-swallowed. Filing this route under
  `notifications.routes.ts` hides the fact that **opening the Inbox is what advances the world**.
  Keep the tick block in one named function in `features/world/` and call it from the route with a
  comment, so the coupling is visible instead of accidental.
- **Route registration order.** Fastify matches in declaration order; `slurpMessageRoutes` is
  mounted last (`:5253`). Reordering the mounts can change which handler wins for overlapping
  patterns (e.g. `/noodler/posts/:id/...` vs `/noodler/posts/:postId/interactions/:interactionId`,
  `:3757` vs `:3800`). Preserve declaration order exactly in `routes/slurp/index.ts`.
- **Storage method ordering inside the object literal.** `createSlurpStorage` returns one literal
  (`slurp.storage.ts:2291-8044`). Duplicate keys would be silently overwritten today; splitting into
  facets composed by spread makes a duplicated name resolve by spread order instead. Assert the
  method-name set is unchanged in a single test.
- **`slurp.storage.ts:1187-1230`** holds every legacy default-prompt constant. Those strings are
  compared against stored settings to detect "user never edited this". Moving them is safe; editing
  the whitespace is not.

**8 — Locale keys.** Lowest risk. Keys are domain-named and path-blind (§4). The only exposure is a
component moved *out* of the package's bundle graph entirely, which cannot happen here. Both
validators (`validate-package-locale-keys.mjs`, `validate-package-locales.mjs`) should still be run
after every batch as a cheap tripwire.

**9 — The deferred Noodle/Noodler→Slurp rename.** Names sitting on proposed boundaries, recorded as
rename candidates and **not renamed now**: `NoodlePostCard` / `NoodlePostCardModel` / `NoodlePostCardCtx`
(`SlurpPostCard.tsx:867,1077,1468`), `NoodlerPostComposer` (`SlurpHome.tsx:6082`), `NoodlerFrame`
(`:6945`), `NoodleAnchoredPopover`, `NOODLE_BLUE`/`NOODLE_PINK` (`SlurpShell.tsx:40-41`),
`NoodleShellView` (`:318`), `noodleKeys` (`use-slurp.ts:88`), `project`/`Arc`
(`slurp-project.ts:2`), `garnish` for ads. A module folder named for its contents survives the
rename; a folder named `noodler/` would not. **Do not name any new folder with a legacy term.**

---

## 8. Open questions for the owner

1. **Does `slurp.routes.ts` / `slurp.storage.ts` / `use-slurp.ts` / `SlurpHome.tsx` survive as a
   re-export shim, or does every import get rewritten in the same effort?**
   Shims: ~100 test files untouched, restructure lands incrementally, four permanently misleading
   files remain. Rewrite: a clean tree, but the first commit touches 150 files and the regression
   baseline has to be green on both sides at once. This decides whether the work is one PR or twelve.

2. **Are Arcs and Projects the same thing, and does the folder get called `arcs` now?**
   `slurp-project.ts:2` says the player sees Projects as Arcs; the UI, locale keys
   (`ui.slurp.projects`, 71 keys) and storage all say `project`; `SLURP_BACKSTAGE_TARGETS` says
   `arcs` (`slurp-backstage.ts:21`). Naming the folder `arcs/` while every symbol inside says
   `project` is a permanent half-rename. Naming it `projects/` enshrines a word the player never sees.
   Third option: `arcs/` now, symbols renamed in the deferred tier-1 rename job.

3. **Is Garnish (ads) part of Slurp, or shared Engine material?**
   `services/garnish-ads/` sits at a generic Engine path, is unowned by any package
   (`build-feature-packages.mjs:162-186`), has zero non-self importers in `sources/engine`, and has
   six `slurp-garnish-*.ts` companions inside `services/slurp/`. Claiming it for slurp2 makes ads a
   normal `features/ads/` module. Leaving it generic means the ads feature is permanently split
   across two ownership domains and can never be edited from this package without contaminating
   Engine input. Answering "shared" also means answering *shared with what*, since nothing shares it today.

4. **Should the client keep importing server rule modules directly (19 sites), or do pure rules move
   to `packages/shared/src/`?**
   Today `SlurpPlatformEventsSettings.tsx:11`, `slurp-simulation-estimate.ts:15-24` and 17 others
   reach across with `../../../../server/...`. Keeping it: zero cost, and pure modules must stay
   under `server/src/services/slurp/` forever. Moving them to `shared/`: honest layering, one new
   ownership entry (`packages/shared/src/slurp`), but it relocates ~10 files that the World and
   Audience domains are built on and rewrites those 19 imports. This changes where half of §4's
   `base/` layer physically lives.

5. **Does Backstage stay one feature module, or split by the six sections it already has?**
   `slurp-backstage.ts:3-10` defines six sections and 17 targets; the eight `SlurpBackstage*.tsx`
   files total 7119 lines and every one of them imports `SlurpSettingsControls`. Option A: one
   `backstage/` module owning all settings UI — matches the nav, keeps the save contract in one
   place, but `backstage/` then contains UI for World, Audience, Ads, Economy and Prompting.
   Option B: each feature module owns its own settings panel and `backstage/` is only the shell and
   the controls — cleaner ownership, but `SLURP_BACKSTAGE_TARGETS_BY_SECTION`
   (`slurp-backstage.ts:33-40`) becomes a cross-module registry and the anchor regression test
   (`tests/slurp2-backstage-anchors.regression.ts:24`) has to learn eight file locations instead of six.
