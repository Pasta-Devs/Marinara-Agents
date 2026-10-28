# Creator Pages

A Creator's Page is the themed stack of blocks between the profile header and the tabs. It is how a
Creator presents themselves: pictures, lists, a quote, prices, their people. AI Creators design their
own; the player can let any Creator design one or build it by hand. Shipped in 0.3.2.

## The one rule: the model chooses, code fills

The stored Page (`profile.page` in the account settings) holds only choices and words:

```ts
{ theme: "candle", composedBy: "creator" | "player", updatedAt, blocks: [
  { id, kind: "quote", text },
  { id, kind: "collage", title, layout: "bento" | "mood" | "polaroid" | "film", postIds: [] },
  { id, kind: "menu", title },
  ...
] }
```

Anything that can be looked up is filled in when the Page renders, never stored and never written by
the model: the collage pictures, the facts (place, posting rhythm, subscribers, since when), the
prices (subscription, message request, commissions from, tip goal), the people (couple, collabs, a
live rivalry) and the latest poll. A block with nothing to show is left out. So a Page cannot claim a
price that drifted, a picture that was deleted or a partner who left.

Schema, limits and the lenient reader: `shared/src/slp/slp-creator-page.ts`. The reader drops a bad
block and keeps the rest, clips over-long text, falls back to Slurp pink for an unknown theme and
makes block ids unique. The same reader handles a stored Page, a player's save and a model's answer.

## Blocks and looks

| Block                     | Stores                                         | Filled by code      |
| ------------------------- | ---------------------------------------------- | ------------------- |
| quote                     | one line                                       | —                   |
| now                       | one line + when                                | hides after 10 days |
| collage                   | title, layout, hand-picked post ids (optional) | the pictures        |
| list                      | title, bullets / numbered, up to 6 lines       | —                   |
| thisOrThat                | title, up to 5 pairs with a pick               | —                   |
| qa                        | title, up to 4 questions and answers           | —                   |
| facts, menu, people, poll | title                                          | everything          |

Looks (`slurp`, `candle`, `peach`, `sketch`, `mono`, `ocean`) are one set of CSS custom properties
each in `client/.../modules/creator/slp-creator-page-styles.ts`. A look owns its background and text
colours, so contrast holds in light and dark mode; only `slurp` follows the app tokens.

## Pictures and locked content

A collage with no hand pick is the Creator's best recent work, chosen again on every view: most liked
first, one picture per shoot, newest breaking ties, plus one locked teaser at the end when there is
one (`pickSlpCollageTiles`). Only the viewer's own open post cards count as pictures. A locked post
only ever appears as the teaser the server already cut; an operator-revealed locked post never reaches
the Page. Hand-picked posts that were deleted drop out.

## Who designs it

- **Player:** the editor (`features/creators/SlpCreatorPageEditor.tsx`) — pick a look, add, order,
  fill and remove blocks, hand-pick collage pictures. Saved with `PUT /slurp/accounts/:id/page`
  (`null` removes it) and marked `composedBy: "player"`.
- **Creator, on request:** "Let <name> design it" → `POST /slurp/accounts/:id/page/compose`, one
  model call (`features/creators/slp-creator-page-service.ts`). Not offered for a persona's own page.
- **New character Creators:** created with `pageWanted: true`; catch-up on open designs one first
  Page per open. One try: a failure clears the wish, the button stays. Budget used up or off keeps it.
- **Refresh after news:** catch-up on open, at most one call per open, only for a Page the Creator
  made that is a week old, and only for news from the last three days: a post with a collab, couple,
  rivalry or brand-deal stamp, or an achievement / relationship / anticipation beat
  (`modules/creators/slp-creator-page-refresh.ts`). A Page the player edited is never refreshed.

All model calls count on the AI budget's "Creator pages" row (`page`); a refresh also keeps to the
day's pace. The prompt (`modules/creators/slp-creator-page-prompt.ts`) forbids prices, counts, dates
and links, and a hinted Creator's other name and handle are scrubbed from every word the model wrote.

## Not in 0.3.2

- An in-universe post announcing a new Page. The refreshed "Now" line is the announcement for now.
- Drag-and-drop ordering (the editor uses up/down buttons, which also work with a keyboard).
- A per-Creator accent colour for the whole profile; the look applies to the Page only.
