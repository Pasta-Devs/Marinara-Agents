# Contacts and Show-to-character — briefs

## Show to character (dock action)

The plan's `share.screen` contract: the shared payload is a bounded, platform-rendered summary of what is visible — never raw storage or hidden fields.

- **Trigger:** the "Show" button in the dock strip under the device. Enabled when a phone is selected in a chat.
- **Payload:** the server builds a one-line summary from the visible surface: lock/home screens by name; Messages includes the latest thread partner and the last two message texts (120 chars each); Goodle the latest search; Notes the latest note's first line; other apps just their name. The user chose to show the screen, so surfaced content is deliberate.
- **Writeback:** one user-role story message via `createMessageWithSwipe`: `*<owner> shows their phone — <summary>*`, tagged `extra: { virtualPhone: "show" }`. No model call; fully deterministic.
- **Feedback:** the button flashes "Shown ✓" and reverts. Failure shows nothing destructive — the phone stays usable.
- **Reference chat:** same route and bounded summary, `mode: "reference"`. Instead of an in-story showing action it inserts quiet bracketed context — `[<owner>'s phone right now — <summary>]`, tagged `extra: { virtualPhone: "reference" }` — so the model knows what's on the phone without a narrated beat. Show = the character sees it in-story; Reference = the story just knows.

## Contacts

A read-only directory of who has a phone in this chat — the roleplay address book.

- **Routes:** `/` — contact list.
- **Data:** derived entirely from existing phone records and message threads; declares no records of its own. `modelUse: "none"`, removable, preinstalled.
- **Rows:** avatar initials, owner name, device name (if set), and thread status: unread count, "In conversation", or "No conversation yet".
- **Empty state:** invites enabling more phones in Agent Settings.
- Messaging a contact stays in Messages; Contacts is a directory, not a second composer.
