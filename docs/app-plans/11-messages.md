# Messages — rank 10

Status: **decided**. The strongest of the communication apps.

## Findings
- Polls every 30s; no push/live update.
- "Start a chat" renders a **stack of inline composer forms**, one per contact, instead of a compose flow.
- No attachments — can't send a photo.
- No thread delete, no search, no day separators, no read receipts.

## Decisions

**Headline decision: integrate with real Engine conversations.**

Today the phone's Messages is a closed sandbox — phone-to-phone threads stored in the package's own
document store (`system/messaging.ts`), completely disconnected from the actual roleplay chat. The ask
is to make the phone's texting and the Engine's conversation the same thing.

### Feasibility — confirmed, both directions already exist
- **Read:** `api.runtime.persistence.listMessages(chatId)` — already used by Gallery and for story
  context. Can surface the real conversation as a thread.
- **Write:** `api.runtime.persistence.createMessageWithSwipe(...)` — already used by
  `POST /chats/:chatId/phones/:phoneId/show`, which writes a "shows their phone" message into the
  real chat. Texting from the phone can post into the chat the same way.
- The phone already knows which chats it belongs to via `identity.chatScope`.

### Design — decided
1. **The Engine chat appears as a thread inside Messages, alongside phone-to-phone threads.**
   Read via `listMessages(chatId)` across the phone's `identity.chatScope`. The sandbox stays.
2. **Sending from the phone posts into the real chat**, via `createMessageWithSwipe` — the same path
   the existing `/chats/:chatId/phones/:phoneId/show` route already uses. **The character replies in
   the chat**, not back inside the phone. The phone becomes an input surface for the roleplay.
3. **Phone texts are marked as texts to the model** — wrapped (e.g. `*texts:* ...`) so the character
   answers like they're texting: shorter, async, no body language. Not a device setting; always on.

### Implementation notes
- `createMessageWithSwipe` is optional on the runtime — degrade cleanly where absent. Precedent:
  the existing `"This Engine version cannot write to the story"` guard.
- Engine-backed threads are read-only history plus a send box; unread counts and `markRead` only apply
  to sandbox threads. Don't try to force the sandbox thread model onto them.
- A phone may have several chats in `chatScope` — that's several Engine threads, not one.

### Status — already in progress

> "I'm currently experimenting with integrating Engine conversations and phone-scoped conversations
> into the messaging app." — gunterlie, tester thread

The headline decision above is **being built already**, and the shape matches: Engine conversations and
the phone's own sandbox threads coexisting in one app rather than one replacing the other. Check the
working state before planning against this file.

Caveat he attached: *"there is no system for 'does this character have this character's details'"* —
nothing models who has whose number, so any character can text any other. Fine while you initiate
every thread; visible once characters text unprompted. See [`08-mail.md`](08-mail.md) and
[`20-tester-feedback.md`](20-tester-feedback.md) §8.

### Not decided
The four original gaps (new-message flow, attachments, thread delete, day separators) were not
selected. Attachments still arrive via `03-sharing-seam.md`.
