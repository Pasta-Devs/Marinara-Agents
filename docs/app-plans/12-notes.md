# Notes — rank 11

Status: **decided**. Clean and works.

## Findings
- Writes the whole notes array to the store on **every keystroke** — should debounce.
- No search, no pinning, no folders.
- Delete is only reachable from inside an open note.
- Plain text only; no markdown.

## Decisions

**Fixes only. No new features.**
- Debounce persistence — currently writes the entire notes array on every keystroke.
- Delete a note from the list, not only from inside an open note.

No search, no markdown, no pinning, no folders, no sharing.
