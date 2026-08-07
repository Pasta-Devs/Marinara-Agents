# Contacts — rank 3

Status: **decided**.

## Findings
- The "Add someone" form is pinned *above* the list and dominates the screen before you see a single contact.
- Rows are inert `<div>`s — no detail view, no tap-to-message, no edit, no delete, no search.
- Server already exposes `DELETE /phones/:phoneId/contacts/:contactId` — **no UI calls it**.
- Bio and phone label are shown crammed into two preview lines.

## Decisions

- **Add someone moves behind a `+` header action** opening an add sheet. The list becomes the main content.
- **Tapping a contact opens a detail page**: avatar, bio, phone label, and actions — Message, NoodleR page, Edit, Delete.
  This finally makes `DELETE /phones/:phoneId/contacts/:contactId` reachable.
- Contacts become editable (implied by the Edit action on the detail page).

## Open
- Search/filter for large casts — revisit if the cast list gets long.
