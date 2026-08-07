# Forum and Camera — app briefs

## Forum

The last planned communication app: the world's public message board, chat-scoped and shared like Noodle.

- **Routes:** `/` thread list, `/thread` thread view. Header carries a `board.web` URL capsule.
- **Data:** one shared `forum-board` document per chat (`story-shared`); threads merged across the phone's chats, sorted by last activity, capped at 30 threads / 40 posts each.
- **Generation:** refresh invents 3–5 threads by side characters (`Title | Author @handle | opening post`), seeded with story context and existing titles to avoid repeats. Replying as the phone's owner posts immediately, then the model adds 1–2 side-character replies to keep the thread alive — a failed generation never loses the user's post.
- **Fallbacks:** empty board state, deterministic reads, all writes through the shared-document service with conflict retries. App Store install.

## Camera

Roleplay camera without image generation: the shutter produces a *described* photo.

- **Route:** `/` viewfinder + camera roll.
- **Shutter:** asks the model (light tier) to caption what the owner's camera would capture right now, from recent story context — one or two vivid present-tense sentences via `{"photo":"…"}`.
- **Data:** shots stored phone-locally (`camera` store, newest first, capped at 24) and rendered as caption polaroids with timestamps. No model → the shutter quietly does nothing.
- Preinstalled; the real-image upgrade path is the same Engine image capability Gallery and Tindler are waiting on.
