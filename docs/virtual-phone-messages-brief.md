# Messages — app brief

First participant-shared app on the Virtual Phone platform, per `virtual-phone-2.0-plan.md` (Foundation 3).

## Purpose

Direct text conversations between phones in the same chat. One thread per phone pair. No group chats or media in this milestone.

Character phones reply through the bounded content contract: when the recipient is an enabled character phone and a language model connection exists, the server asks for one short in-character reply as `{"reply":"…"}`, parsed with `parseBoundedContent` (strings capped, malformed output → deterministic empty fallback). No model, a failed call, or an empty reply all degrade to "no reply" — sending never breaks. Replies are generated inline with send; move to a queue if latency hurts.

## Routes

- `/` — thread list plus a "Start a chat" contact list (other enabled phones sharing a chat with this phone).
- `/thread` — one conversation: message bubbles plus composer. Back returns to the thread list, not home.

## Data

- Record: `message-thread`, ownership `participant-shared`, stored platform-side as one document per phone pair (sorted phone ids), never readable through another phone's local storage.
- Message: `{ id, from: phoneId, text ≤ 2000 chars, at }`. Threads keep the most recent 200 messages.
- Read state: per-phone `lastRead` timestamp inside the thread document. Unread = other participant's messages newer than `lastRead`. Sending marks the sender read.

## Contacts and authorization

A phone can only message phones that share at least one chat in `chatScope` and are enabled. The server enforces this on send; the client only ever offers those contacts.

## Actions and notifications

- Top-bar `refresh` reloads threads (no background polling in this milestone).
- Manifest declares `notifications: { tier: "participant", dedupeBy: "thread" }`; the visible unread badge lives on the thread list. Home-screen badges and lock-screen previews arrive with the platform notification wiring.

## Fallbacks and acceptance

- Works fully with no model: sending, reading, unread counts are deterministic.
- Empty states: no contacts ("No one else has a phone yet"), no threads ("Start a chat").
- Tests: service-level regression for thread creation, pair reuse, unread math, read marking, text validation, and message cap.
