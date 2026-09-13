# Slurp Remastered release notes

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
