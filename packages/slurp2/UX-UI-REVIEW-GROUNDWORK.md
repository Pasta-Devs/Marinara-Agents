# Slurp UX and UI Review Groundwork

## Purpose

Use this document to review Slurp as a complete creator and fan experience.

This is a review standard. It is not a redesign specification. It gives a reviewer common rules for usability, visual quality, responsive behavior, accessibility, and trust.

Slurp is a local roleplay product. It has Creator profiles, public and locked posts, fictional coins, subscriptions, tips, messages, generated audience activity, fictional promotions, and adult-first generated content. It has no real creators, public community, payments, or identity verification. A reviewer must not report missing commercial operations as product defects unless the requested scope changes.

Do not copy OnlyFans or another platform screen by screen. Use familiar creator-platform patterns where they reduce learning effort. Keep Slurp's own identity, local model, and Engine conventions.

## Rule Levels

Apply each rule at one of these levels:

| Level     | Meaning                                                  | Review result                                                          |
| --------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Gate      | A task, trust, access, safety, or responsive requirement | A confirmed failure can block approval.                                |
| Heuristic | A strong usability rule with recognized research support | Report a failure when it causes observed user cost.                    |
| Direction | Slurp's intended visual and product character            | Use comparative visual evidence. Do not report personal taste as fact. |

## Product Principles

1. **Content is the main object.** Creator identity and media must lead. Chrome must support them.
2. **Access is always clear.** A user must know whether content is public, locked, subscribed, owned, or unavailable before an action.
3. **The active identity is always clear.** Viewer persona and managed Creator identity must never appear interchangeable.
4. **Fictional value still needs clear rules.** Coin cost, balance change, access duration, and action result must be visible.
5. **Adult-first does not mean trust-last.** The age gate, content treatment, provider disclosure, and exit paths must be direct.
6. **Mobile is a primary experience.** Mobile must not be a reduced desktop view with missing functions.
7. **Visual character must support use.** A pretty surface must improve hierarchy, mood, identity, or feedback.
8. **The interface must feel alive, not unstable.** Dynamic content needs clear loading, new-content, saved, pending, and error states.

## 1. Navigation And Orientation

**Gate**

- Keep Hub, Discover, Messages, Notifications, Profile, Wallet, Studio, and Settings reachable through predictable navigation.
- Mark the current destination with more than color alone.
- Preserve the user's feed position, selected tab, draft, and relevant filter when the user opens content and returns.
- Keep the active viewer persona visible at all points where an action can follow, subscribe, unlock, tip, message, publish, or manage a Creator.
- Never expose Creator owner controls to another persona.
- Give every modal, drawer, lightbox, and full-screen moment a clear close or back action.
- Restore focus and context after an overlay closes.

**Heuristic**

- Use the same terms in navigation, headings, actions, and success messages.
- Prefer recognition over recall. Show available actions and current state near the object they affect.
- Do not make mobile users open a drawer for every frequent action.
- Keep primary navigation stable. Do not reorder destinations based on notification counts or activity.

## 2. Feed, Discovery, And Content Browsing

**Gate**

- Distinguish `All creators`, `Following`, search results, saved content, and media views.
- Show loading, refresh, empty, partial-error, end-of-list, and retry states.
- Do not duplicate or remove posts during pagination or refresh.
- Keep a clear boundary between new and previously seen posts.
- Identify fictional promotions before the user acts on them.
- Do not make a promotion look like a Creator post, private message, system warning, or locked-content notice.

**Heuristic**

- Use continuous loading for discovery. Use search, tabs, saved items, and Creator archives for retrieval.
- Let users return to a known item without searching again.
- Keep feed actions in a stable order on every post.
- Show a useful empty state with one next action. Do not show only `No results`.
- Avoid repeated interruption. Do not place setup prompts, promotions, and Creator suggestions so often that they break reading.

## 3. Creator Profiles And Creator Rooms

**Gate**

- Show display name, handle, avatar, banner or intentional fallback, bio, status, relationship state, and available actions.
- Keep profile identity visible when Creator tools open.
- Distinguish `Follow`, `Following`, `Subscribe`, `Subscribed`, and unavailable states.
- Show owner actions only for the active persona's Creator.
- Keep Save and Cancel available during in-place editing. Cancel must restore prior values.
- Show upload and generation progress. Preserve the old image until a replacement succeeds.

**Direction**

- Treat the profile as the strongest expression of a Creator's visual identity.
- Let good banner and avatar media carry the page. Do not cover the useful parts with large text panels or heavy effects.
- Use a deliberate fallback when media is absent. The page must still look complete.
- Keep count rows, profile actions, and tabs visually secondary to identity and content.
- Avoid a generic dashboard made from equal cards. A Creator Room should feel like a profile and media space.

## 4. Posts, Media, And Locked Content

**Gate**

- Label access with text. Do not use blur, a lock icon, or color as the only signal.
- Show the Creator, content type, exact fictional coin cost, and available access paths before unlock.
- State whether subscribe or one-time unlock grants access.
- Never expose locked body text or original media in previews, prompts, share images, accessibility text, or client payloads.
- Keep the locked preview useful but honest. It must not promise content that is not present.
- Show image loading, unavailable, and retry states without changing the post layout unexpectedly.
- Give meaningful images useful alternative text when the product has that information. Use empty alternative text for decorative avatars or backgrounds when nearby text gives the same identity.
- Give video and audio visible controls. Do not autoplay sound.

**Heuristic**

- Make media the visual focus when a post has media.
- Reserve overlays for short status or access information. Keep long text outside the image.
- Use stable media aspect ratios or reserved dimensions to prevent layout shift.
- Keep Like, Reply, Repost, Save, Share, and More controls stable across public and locked posts.
- Show selected and changed states without moving controls.

## 5. Fictional Coins, Tips, Subscriptions, And Unlocks

**Gate**

- State clearly that coins, prices, revenue, and subscriptions are local fiction at the first relevant explanation.
- Before a spend, show the recipient or item, exact coin amount, current balance when useful, and result of the action.
- For a subscription, show price, seven-day renewal rule, access benefit, and how to stop it.
- Prevent duplicate charges from repeat selection, slow requests, or refresh.
- Keep balances non-negative and show a clear insufficient-balance result.
- Record each balance change in understandable wallet activity.
- Show immediate success or failure. A short toast alone is not enough for a durable balance or access change.
- Use specific labels such as `Unlock for 20 coins` and `Subscribe for 5 coins`. Do not use `OK`, `Yes`, or an unlabeled coin icon.

**Heuristic**

- Confirm rare or high-impact spends. Do not add a confirmation to every routine action.
- Repeat the consequence in confirmation actions.
- Keep one coin unit across all Slurp features.
- Do not add urgency, fake scarcity, preselected spending, or obstructed cancellation.

## 6. Messaging And Community Interaction

**Gate**

- Distinguish inbox, message requests, active conversation, locked message, commission, broadcast, and Creator reply states.
- Show sending, sent, failed, retry, paid, locked, quoted, accepted, and delivered states where they apply.
- Prevent accidental duplicate sends, unlocks, tips, and commission actions.
- Keep provider disclosure before an action that sends private content to a model provider.
- Keep the current conversation and recipient clear while the user writes or pays.
- Keep text drafts when a non-destructive request fails.
- Use local product controls for fictional audience activity. Do not imply that generated accounts are real people.

**Heuristic**

- Keep thread search and conversation switching fast.
- Put thread-specific actions in one predictable menu.
- Keep message content readable. Place payment and commission metadata in a clear secondary block.
- Use quiet feedback for typing and delivery. Avoid repeated decorative motion in a high-frequency surface.

## 7. Onboarding, Age Gate, And Disclosure

**Gate**

- Put the age gate before adult-first content.
- State that the confirmation controls Slurp entry and does not prove legal identity.
- Give the user a clear way to leave without starting setup.
- Never imply that real payment data is collected.
- Explain local simulation before asking the user to configure Creators, posting, audience activity, or coins.
- Separate automatic posting, automatic images, audience automation, and provider choices. One option must not silently enable another.
- Show partial setup failures by Creator. Preserve valid selections and offer a retry path.
- Do not claim completion before profile and first-post outcomes are known.

**Direction**

- The age-gate payment-card joke can add character. The plain adult confirmation and no-payment statement must remain the main message.
- Humor must stop when the interface reports failure, deletion, privacy, provider disclosure, or lost work.
- Onboarding visuals must demonstrate the product. They must not become a long feature presentation before use.

## 8. Settings, Automation, And Destructive Actions

**Gate**

- Group settings by user goal. Keep the same section names and order on desktop and mobile.
- Show saving, saved, and failed states near the changed setting.
- Serialize rapid updates when old requests could overwrite new values.
- Label toggles for their enabled state.
- State the scope of a setting: global, viewer persona, or Creator.
- Explain dependencies before disabling a control, such as a missing image connection.
- Confirm destructive actions with the affected Creator or data scope and an action-specific button.
- Keep delete-unused and delete-all actions distinct.
- Do not use the same visual weight for destructive and routine actions.

**Heuristic**

- Put common choices first. Put advanced prompt text and destructive data tools later.
- Use progressive disclosure for complex automation.
- Show the effect of a preset in plain values, such as posts per day and quiet hours.
- Prefer useful defaults over long instructions.

## 9. Accessibility

Use WCAG 2.2 AA as the review target.

**Gate**

- Complete every flow with a keyboard.
- Use native buttons, links, inputs, labels, headings, and landmarks where possible.
- Give each icon-only control an accessible name.
- Keep visible focus on every interactive element.
- Trap focus in modal dialogs and restore it to the trigger on close.
- Make status changes available to assistive technology.
- Do not use color alone for access, selection, error, success, unread, or active state.
- Meet text and non-text contrast requirements in light and dark themes.
- Use at least the WCAG 2.2 minimum target size of 24 by 24 CSS pixels or its spacing exception. Aim for 44 by 44 pixels for primary touch controls.
- Support 200 percent text resize and 320 CSS-pixel reflow without loss of content or function.
- Respect reduced motion. Do not delay access until an animation finishes.
- Keep focused controls visible above sticky headers, bottom navigation, and the on-screen keyboard.

## 10. Responsive Behavior

**Gate**

- Keep every function available at every supported width. Moving a function into a drawer or sheet is acceptable. Removing it is not.
- Do not cause page-level horizontal scrolling at 320 CSS pixels.
- Keep text, images, tabs, dialogs, and controls inside the viewport and safe areas.
- Let long names, handles, translated labels, coin values, and generated text wrap or truncate with a way to read the full value.
- Do not let bottom navigation cover the last post action, composer action, modal action, or focused input.
- Make drawers, sheets, lightboxes, Moments, and onboarding usable in short landscape viewports.
- Use input text of at least 16 CSS pixels on mobile to prevent unwanted iOS zoom.
- Do not depend on hover for information or action.

**Required viewports**

Test these sizes and all widths between their layout transitions:

| Viewport    | Purpose                                         |
| ----------- | ----------------------------------------------- |
| 320 x 568   | WCAG reflow and narrow-phone stress             |
| 390 x 844   | Current Pixel 7 browser-test target             |
| 844 x 390   | Short mobile landscape and keyboard-risk stress |
| 768 x 1024  | Tablet and intermediate layout                  |
| 1024 x 768  | Desktop-navigation transition                   |
| 1280 x 800  | Right-rail transition                           |
| 1440 x 900  | Current desktop browser-test target             |
| 1920 x 1080 | Wide-screen density and line-length stress      |

Also test desktop at 200 percent zoom and one coarse-pointer mode.

## 11. Visual Quality: Pretty, Cool, And Intentional

Visual quality is not only personal taste. Review the system with the checks below.

### Visual identity

**Direction**

- The first viewport must read as Slurp without depending only on the logo.
- Use pink as a strong accent, not as the color of every surface and state.
- Use coral, violet, warm, neutral, success, warning, and danger roles with clear meaning.
- Preserve useful contrast between the canvas, navigation, raised surfaces, media, and overlays.
- Avoid a one-note pink or purple wash. The content and Creator media must add visual range.

### Hierarchy and composition

**Direction**

- A user must see the page purpose, primary object, and primary action within a short scan.
- Use size, weight, position, and space before adding borders, shadows, or color.
- Keep one main visual focus per viewport.
- Align content to shared edges.
- Use more space between groups than inside groups.
- Do not put cards inside cards or turn every section into a floating panel.
- Keep compact headings compact. Reserve display scale for Creator identity and true feature moments.

### Typography

**Direction**

- Use a small, consistent type scale.
- Keep body text near 16 pixels where reading is primary. Keep small metadata readable.
- Use body line height near 1.5 and tighter heading line height.
- Limit long text to about 60 to 75 characters per line.
- Use normal letter spacing for body text. Use uppercase labels sparingly.
- Use tabular numbers for balances, prices, counts, and live metrics when changing digits cause movement.
- Balance short headings and prevent isolated final words in short descriptions where browser support permits.

### Media treatment

**Direction**

- Show actual Creator and post media at a useful size and crop.
- Keep faces and the meaningful image region visible when crop data exists.
- Apply one consistent, subtle image edge treatment in light and dark themes.
- Use a clear aspect ratio for repeated media groups.
- Avoid dark overlays, blur, and decorative gradients that make unlocked media hard to inspect.
- Make locked treatment clearly different from failed or still-loading media.

### Components and detail

**Direction**

- Use the shared Lucide icon set and consistent optical weight.
- Keep repeated control dimensions stable across hover, active, loading, and selected states.
- Keep nested corner radii visually concentric.
- Use borders for structure and state. Use restrained shadows for elevation.
- Give controls clear hover, focus, active, selected, loading, and disabled states.
- Use tooltips for unfamiliar icon-only actions.
- Do not use decorative pills when plain text or standard controls communicate better.

### Motion and delight

**Direction**

- Use motion to explain entry, exit, change, or spatial relation.
- Keep frequent interactions immediate or under about 150 milliseconds.
- Keep animations interruptible.
- Do not animate every card on page load.
- Use static feedback in addition to motion.
- Preserve Slurp's playful moments for age-gate payoff, successful creation, Moments, and other infrequent events.
- Avoid confetti or joke motion for routine saves, financial failures, destructive actions, or errors.

### Anti-generic check

Reject a design as visually weak when several of these are true:

- Every section is an equal rounded card.
- The palette is only tinted pink or purple neutrals.
- Large empty areas replace useful content density.
- Oversized headings make a working surface feel like a marketing page.
- Stock decorative shapes compete with Creator media.
- All actions use rounded text pills instead of familiar icons and control types.
- Gradients and blur hide weak hierarchy.
- Mobile is only a compressed desktop arrangement.

## 12. Copy And Tone

**Gate**

- Use direct labels for consequential actions.
- Put errors next to the failed action or field and state how to recover.
- Keep fictional and generated activity clear where confusion is possible.
- Use one term for Creator, viewer persona, subscription, unlock, Moment, coin, and provider throughout a flow.
- Never describe a local fictional action as a real payment, legal identity check, public post, or contact with a real person.

**Heuristic**

- Start button labels with the action where practical.
- Use sentence case consistently.
- Make empty states explain the area and give one useful next action.
- Use placeholders as examples, not labels.
- Keep routine text neutral. Use Slurp's playful voice only when the stakes are low.

## Screen-By-Screen Review Method

The reviewer must inspect every user-facing Slurp screen. A review of only the Hub or only the main feed is incomplete.

Create a screen inventory before reporting findings. Use the real navigation and source to find screens. Include screens that open in a modal, drawer, sheet, lightbox, wizard, or full-screen view.

### Required screen inventory

At minimum, inventory these screens and states:

| Screen or surface                    | Required states                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Age gate and adult opt-in            | Explanation, confirmation, pending, cancelled, reduced motion                              |
| Onboarding introduction              | Each introduction step, skip, back, continue                                               |
| Onboarding setup                     | Character selection, persona selection, pace, custom values, provider selection            |
| Onboarding completion                | Success, partial success, failed Creator, retry, zero Creators                             |
| Hub feed                             | All creators, Following, loading, empty, refresh, new-content divider, end of feed, error  |
| Feed media wall                      | Empty, mixed media, locked media, loading, unavailable media                               |
| Moment or story viewer               | Open, next, previous, close, keyboard navigation, mobile full screen                       |
| Discover                             | Default, search, results, no results, loading, Creator suggestion, unavailable Creator     |
| Creator profile                      | Own profile, another profile, no media, long identity, tabs, follow state, subscribe state |
| Creator Room                         | Owner controls, viewer controls, publishing tools expanded and collapsed                   |
| Profile editor                       | Editing, saving, saved, failed save, cancel, unsaved changes                               |
| Avatar and banner tools              | Upload, crop, replace, restore, generate, failed generation                                |
| Post composer                        | Text, image, poll, story, locked post, draft, validation error, provider disclosure        |
| Post card                            | Public, locked, unlocked, owner, viewer, liked, saved, menu, long content                  |
| Post image viewer                    | Loading, loaded, locked, unavailable, close, zoom, keyboard focus                          |
| Poll                                 | Unvoted, voted, results, invalid, voter view                                               |
| Reply and interaction composer       | Empty, typing, mention suggestions, media picker, sending, failed, retry                   |
| Unlock and subscription surface      | Exact cost, insufficient balance, success, failure, already unlocked, active subscription  |
| Messages inbox                       | Search, requests, empty, active threads, loading, failure                                  |
| Message thread                       | Sending, sent, failed, retry, locked message, tip, commission, provider disclosure         |
| Commission flow                      | Request, quote, accept, deliver, cancel, failure                                           |
| Wallet                               | Balance, ledger, refill, spend, insufficient balance, success, failure, empty activity     |
| Studio                               | Earnings, reach, post performance, goal, payout, empty, unavailable data                   |
| Notifications                        | Unread, read, grouped events, empty, linked event, loading                                 |
| Settings overview                    | Ready, needs setup, saving, saved, error                                                   |
| Settings publishing                  | Presets, custom values, quiet hours, provider, guidance editor                             |
| Settings Creators                    | Source status, schedule, image mapping, owner actions, delete confirmation                 |
| Settings Images                      | Ready, missing provider, dimensions, prompt settings, save failure                         |
| Settings Audience                    | Enabled, disabled, run now, provider failure                                               |
| Settings Ads                         | Pool, import, export, hidden brand, generation, delete confirmation                        |
| Settings Wallet                      | Economy on, economy off, prices, rewards, caps, share                                      |
| Settings Advanced                    | Restart setup, delete unused, delete all, destructive confirmations                        |
| Mobile navigation and account drawer | Closed, open, active destination, persona switch, focus, scroll behavior                   |
| Shared dialogs and sheets            | Open, close, Escape, outside interaction, pending, error, focus restoration                |

The reviewer may add screens discovered during exploration. The reviewer must explain any required screen that cannot be opened.

### Audit every screen across six dimensions

For every screen in the inventory, answer each question. Use `Pass`, `Fail`, `Partial`, or `Not tested`.

| Dimension                 | Questions to answer                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose and UX            | Is the screen purpose clear within one short scan? Is the next useful action clear? Is the flow predictable? Can the user leave?                                                                                              |
| Placement and layout      | Are related controls grouped? Are primary actions near the object they affect? Are alignment, spacing, hierarchy, and reading order clear? Do fixed elements cover content?                                                   |
| Readability               | Can users read all important text? Do headings, labels, prices, statuses, errors, and helper text have the right size, weight, contrast, line height, and wrapping? Do long or translated strings fit?                        |
| Responsibility and trust  | Does the screen clearly describe local simulation, generated activity, provider disclosure, adult content, access, cost, privacy, and consequences? Does it avoid pressure, deception, dark patterns, or accidental exposure? |
| Pretty and cool           | Does the screen have Slurp identity? Is the visual focus clear? Do media, color, type, icons, surfaces, shadows, and motion feel intentional? Does decoration support the task?                                               |
| Responsive and accessible | Does the screen work at every required viewport, zoom, keyboard state, theme, pointer type, and motion preference? Are controls named, focusable, reachable, and large enough?                                                |

Do not mark a dimension `Pass` because the screen looks acceptable at first sight. Record the viewport, state, and evidence used for the result.

### Per-screen audit record

Create one record for every screen. Use this format in the review output or in an attached review note:

```text
Screen:
Source or route:
States opened:
Viewports and themes:

Purpose and UX: Pass | Fail | Partial | Not tested
Evidence:

Placement and layout: Pass | Fail | Partial | Not tested
Evidence:

Readability: Pass | Fail | Partial | Not tested
Evidence:

Responsibility and trust: Pass | Fail | Partial | Not tested
Evidence:

Pretty and cool: Pass | Fail | Partial | Not tested
Evidence:

Responsive and accessible: Pass | Fail | Partial | Not tested
Evidence:

Findings:
Unresolved questions:
```

The final review must include a compact inventory table even when the full records are stored elsewhere:

| Screen   | States tested                | Viewports tested | UX   | Placement | Readability | Responsibility | Visual quality | Responsive/a11y |
| -------- | ---------------------------- | ---------------- | ---- | --------- | ----------- | -------------- | -------------- | --------------- |
| Hub feed | All, Following, empty, error | 390, 1440        | Pass | Partial   | Pass        | Pass           | Partial        | Partial         |

Never omit a screen from the table. `Not tested` is valid only when the reviewer states why.

## Review Method

### 1. Prepare

- Read `packages/slurp/README.md` and `packages/slurp/USER-FACING-SYSTEM-TEST-MATRIX.md`.
- Identify the branch, current changes, Engine checkout, and available test data.
- Do not change files during the review.
- Do not overwrite or revert unrelated work.

### 2. Review Complete Workflows

Review these flows from start to finish:

1. First entry, age confirmation, onboarding, Creator selection, and completion.
2. Switch viewer persona, browse Hub, change feed mode, refresh, open a post, and return.
3. Discover a Creator, open the profile, follow, subscribe, unlock a post, and inspect wallet activity.
4. Open an owned Creator Room, edit the profile, compose public and locked posts, and manage a post.
5. Open Messages, switch threads, send a reply, inspect a locked message, and complete a commission state change when test data permits.
6. Open Wallet, claim a refill, inspect activity, and verify spend feedback.
7. Open Studio and Notifications, follow links, and return with context intact.
8. Change one setting in each section. Test save, error, dependency, and destructive-action behavior.

After the workflow review, open every screen in the required screen inventory. The workflows prove continuity. The inventory proves coverage. Neither replaces the other.

### 3. Review Required States

For each relevant surface, inspect:

- Loading.
- Loaded.
- Empty.
- Partial data.
- Long content.
- Error.
- Retry.
- Offline or unavailable provider when supported.
- Pending.
- Success.
- Disabled.
- Locked and unlocked.
- Owner and viewer.
- Light and dark theme.
- Keyboard focus.
- Reduced motion.
- Narrow, intermediate, desktop, and wide layouts.

### 4. Gather Evidence

Every finding must include:

- Exact screen and state.
- Source file and line when code proves the cause.
- Viewport and theme for visual findings.
- Screenshot or recorded observation for runtime findings.
- Expected result from this document or a cited source.
- User cost.
- Smallest viable fix.
- A verification step.

Do not infer a visual defect from source alone. Do not infer an implementation defect from a screenshot alone.

### 5. Severity

| Severity | Meaning                                                                                                                        | Examples                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Blocker  | Prevents review or makes the product unsafe to test                                                                            | Slurp does not load; adult content appears before the gate.                            |
| High     | Blocks a main task, leaks locked content, misleads about identity or spend, loses work, or makes a supported viewport unusable | Unlock charges twice; mobile navigation covers Submit; viewer sees owner controls.     |
| Medium   | Causes repeated confusion, poor recovery, inaccessible operation, weak responsive behavior, or a major visual-system failure   | Active state depends on color; profile actions wrap over media; feed position is lost. |
| Low      | Isolated polish issue with clear user impact                                                                                   | One icon is optically misaligned; one radius breaks the shared pattern.                |

Do not assign severity from visual dislike. State the user cost.

## Scorecard

Score each category from 0 to 4 after findings are complete.

| Score | Meaning                             |
| ----- | ----------------------------------- |
| 0     | Broken or absent                    |
| 1     | Major defects prevent reliable use  |
| 2     | Usable with clear repeated problems |
| 3     | Strong with limited issues          |
| 4     | Complete, coherent, and verified    |

| Category                        | Weight |
| ------------------------------- | -----: |
| Core task usability             |     20 |
| Navigation and identity clarity |     10 |
| Access, coins, and trust        |     15 |
| Responsive behavior             |     15 |
| Accessibility                   |     15 |
| Visual identity and hierarchy   |     10 |
| Media and content presentation  |      5 |
| Interaction detail and motion   |      5 |
| Copy, errors, and empty states  |      5 |

Calculate each weighted result as `score / 4 * weight`.

The total score gives comparison data. It does not override findings.

- Any Blocker or High finding means `Block`.
- Any unresolved Medium finding means `Needs changes`.
- `Approve` requires no actionable findings and completed runtime verification.
- A score under 75 cannot receive `Approve`.
- A score under 60 means the product needs a focused design pass, even if individual defects appear small.

## Required Review Output

Use this order:

1. **Verdict and score.** State the reviewed build, scope, and coverage limits.
2. **Findings.** List defects first. Order by severity, reach, and root cause.
3. **Screen inventory.** Include every required screen, state, dimension result, and evidence status.
4. **Workflow results.** Mark each required flow as pass, fail, partial, or not tested.
5. **Responsive matrix.** Report each required viewport and any transition-width failure.
6. **Visual assessment.** Explain what gives Slurp identity and what makes it look generic, noisy, flat, or unfinished. Use evidence.
7. **Readability assessment.** Report text size, wrapping, contrast, density, hierarchy, and long-string behavior.
8. **Responsibility assessment.** Report adult-content, simulation, generated-content, provider, cost, privacy, advertising, and user-control behavior.
9. **Considered but rejected.** List plausible changes that would not improve the product or would conflict with existing conventions.
10. **Verification.** List exact commands and runtime interactions.
11. **Top fix order.** Give the smallest ordered set of changes with the most user value.

Each finding must use this shape:

| Field     | Required content                                        |
| --------- | ------------------------------------------------------- |
| Severity  | Blocker, High, Medium, or Low                           |
| Area      | Rule section from this document                         |
| Location  | Screen, state, viewport, and source line when available |
| Evidence  | What happened, with screenshot or exact observation     |
| User cost | The task, trust, access, or comprehension effect        |
| Expected  | The applicable rule                                     |
| Fix       | The smallest concrete correction                        |
| Verify    | Exact steps that prove the correction                   |

## Validation Commands

Use the commands that apply to the review environment:

```bash
npm run check
node scripts/build-feature-packages.mjs slurp
npm run test:browser:slurp
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
node scripts/tests/catalog-release-notes.regression.mjs
```

The Slurp browser suite currently covers Chromium at `1440 x 900` and Pixel 7 at `390 x 844`. Manual or added browser coverage is required for the other review viewports, zoom, light and dark themes, keyboard-only use, reduced motion, long localization strings, and visual quality.

## Agent Prompt

Give this prompt to the review agent:

```text
Perform a read-only, defect-first UX and UI review of Slurp.

Use packages/slurp/UX-UI-REVIEW-GROUNDWORK.md as the review standard.
Use packages/slurp/USER-FACING-SYSTEM-TEST-MATRIX.md as the product behavior map.
Read the current implementation before you judge it.

Review the complete Slurp product, not one screenshot. Inventory and inspect every
user-facing screen, modal, drawer, sheet, lightbox, wizard, and full-screen surface.
Do not omit a screen because it is a secondary state or because it has no findings.
Cover onboarding, the age gate,
Hub, Discover, Creator Rooms, posts, locked content, Messages, Wallet, Studio,
Notifications, and Settings. Cover owner and viewer personas. Test light and dark themes,
keyboard use, reduced motion, loading, empty, error, pending, and long-content states.
Test every required viewport and the layout transitions between them.

Judge usability, trust, accessibility, responsive behavior, and visual quality. Treat
"pretty" and "cool" as evidence-based visual-system questions: identity, hierarchy,
composition, media treatment, typography, color roles, interaction detail, motion,
and avoidance of generic card-heavy design. Do not report personal taste as a defect.

For every screen, separately judge purpose and UX, placement and layout, readability,
responsibility and trust, pretty and cool visual quality, and responsive and accessible
behavior. Record Pass, Fail, Partial, or Not tested for each dimension. Include the
screen inventory table in the final report.

Remember that Slurp is local roleplay. Coins, users, posts, subscriptions, tips, ads,
and audience activity are fictional. Do not require real payment, moderation, identity,
or public-community systems. Do require clear disclosure where a user could confuse the
simulation with a real action or a model-provider disclosure.

Do not edit files. Report findings first, ordered by severity. Consolidate repeated
symptoms under one root cause. Include runtime evidence for visual claims and source
evidence for implementation claims. Give the smallest viable fix and an exact
verification step for every finding. Include the scorecard, workflow results,
responsive matrix, considered-but-rejected changes, verification record, and final
Block / Needs changes / Approve verdict required by the groundwork.
```

## Sources

These sources support the gates and heuristics. Slurp-specific visual direction remains product judgment.

- [W3C, Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C, How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)
- [W3C, Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [W3C, Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C, Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/)
- [Nielsen Norman Group, 10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Nielsen Norman Group, Confirmation Dialogs Can Prevent User Errors](https://www.nngroup.com/articles/confirmation-dialog/)
- [Nielsen Norman Group, Infinite Scrolling Is Not for Every Website](https://www.nngroup.com/articles/infinite-scrolling/)
- [web.dev, Responsive Web Design Basics](https://web.dev/articles/responsive-web-design-basics)
- [web.dev, Accessible Tap Targets](https://web.dev/articles/accessible-tap-targets)
- [GOV.UK Design System, Layout](https://design-system.service.gov.uk/styles/layout/)
- [FTC, Native Advertising: A Guide for Businesses](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses)
- [FTC, .com Disclosures](https://www.ftc.gov/business-guidance/resources/com-disclosures-how-make-effective-disclosures-digital-advertising)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)

The external sources do not define Slurp's full design. They provide accessibility, usability, responsive, disclosure, and trust baselines. Reviewers must verify product-specific judgments against the current rendered interface.
