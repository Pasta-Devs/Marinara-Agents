# Notes and Noodler — app briefs

Foundation 3 milestones after Messages, per `virtual-phone-2.0-plan.md`.

## Notes

Private notes on a phone — a persona's reminders, a character's secrets. Pure roleplay texture with zero model use.

- **Routes:** `/` note list, `/note` editor. Back from the editor returns to the list.
- **Data:** record `note`, ownership `phone-local`, stored via `usePhoneStore` under one `notes` key: `[{ id, text, updatedAt }]`, newest first, title derived from the first line. Nothing leaves the phone.
- **Actions:** top-bar `add` creates a note and opens it; top-bar `trash` inside the editor deletes after one confirm. Text persists on blur and on back.
- **Fallbacks:** fully deterministic; empty state invites the first note. `modelUse: "none"`, removable.

## Noodler

The world's social feed. Short posts by invented side characters reacting to recent story events — ambient roleplay flavor, read-only.

- **Routes:** `/` feed.
- **Data:** record `feed-cache`, ownership `phone-local`: the last generated feed is cached per phone under the `feed` key so reopening never needs a model. `modelUse: "heavy"`, removable, not preinstalled — the App Store's first optional install.
- **Generation:** server route asks the model for 4–6 posts as `{"posts":["Name @handle — text", ...]}` seeded with recent story messages, parsed with `parseBoundedContent` (strings capped, malformed output → empty). No model or a failed call degrades to the cached feed or a quiet-feed empty state.
- **Actions:** top-bar `refresh` regenerates.
- **Boundaries:** posts are display-only content; they never write back to the story or other phones.
