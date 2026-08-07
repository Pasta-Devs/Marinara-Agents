# Noodle — rank 8

Status: **decided**.

## Findings
- Likes / boosts / replies are **fake numbers derived from a hash** (`postStats`) and non-interactive.
- No post detail view — the reply count leads nowhere.
- Trending topics are not tappable.
- Your own posts enter the feed but there's no profile view.
- No pagination/infinite scroll.

## Decisions

- **Counters stay fake and non-interactive.** No engagement system to build.
  - But they must *look* non-interactive — currently they read as tappable buttons and do nothing.
    Restyle the footer as plain metadata.
- No post detail view, no real replies, no profile.

## Open
- Tappable trends → filtered feed or Goodle search. Not decided.
- Photo posts (see `03-sharing-seam.md`) — decided there, applies here.

> **Superseded** — see [16-engine-interop.md](16-engine-interop.md).
>
> The "counters stay fake" decision above no longer stands. The Engine already has real Noodle
> accounts, replies, quotes and deduplicated like/repost interactions, so the cost argument for faking
> them doesn't hold.
>
> **New decision:** the phone keeps its **own Noodle universe**, but mirrors the Engine's design
> closely — accounts with handles and avatars, real replies (`parentPostId`), quotes, and real
> deduplicated like/repost interactions. Phone-local, same shape and mechanics.
