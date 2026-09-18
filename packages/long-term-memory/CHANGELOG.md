# Long-Term Memory changelog

## 1.3.4 — 2026-09-18

- Kept a source note's extraction context unbound until its extraction succeeds, so a failed or cancelled preparation no longer rewrites the source note.
- Rejected concurrent source-context changes again at the final commit, so a late writer cannot be overwritten after extraction validation.
- Marked extractions whose only non-kept candidates were duplicates as current, so re-running them no longer churns.

## 1.3.3 — 2026-09-18

- Kept static character and world facts static when their wording contains incidental narrative verbs, and stopped rejecting character facts that establish lasting status or affiliation.

## 1.3.2 — 2026-09-18

- Preserved all structured relationship participants and reused local identities when names arrive in short-name-first order.

## 1.3.1 — 2026-09-17

- Fixed duplicate and conflicting source ID handling during source import.
- Fixed updateNote call signature in source extraction.
- Removed undeclared and unused batch extraction scope argument in import interop.

## 1.3.0 — 2026-09-13

- Load additional pages of chat summaries, characters, and lorebook sources without losing filters, selections, or import status.
- Keep retention cleanup recoverable when activity-index pruning fails.

## 1.2.27 - 2026-09-12

- Displayed and searched renamed chat branches consistently in Sources and imported summary evidence.

## 1.2.26 - 2026-09-10

- Added persistent chat-mode availability selection to Sources for memory imports.

## 1.2.25 - 2026-09-10

- Added a confirmed discard action for invalidated drafts, removing old proposals without changing saved memories.

## 1.2.24 - 2026-09-09 [highlight]

- Kept drafts with missing source notes visibly blocked without preventing review of other sources.
- Showed context-loading error details alongside Retry and kept orphaned rejected suggestions accessible.

## 1.2.23 — 2026-09-06 [highlight]

- Restored responsive Memory Vault and Sources loading by deferring local-character discovery.
- Reused one aggregate local-character catalog and kept its loading and retry state visible.

## 1.2.22 — 2026-09-06

- Kept user-selected source targets valid while isolating parent chat context transitions.
- Prevented stale source previews and details from rendering during scope changes.

## 1.2.21 — 2026-09-05

- Reduced redundant vault scans across Review Queue, Memory Vault, and Sources loading.
- Preserved local-character scope targets while reusing the existing note snapshot.

## 1.2.20 — 2026-09-04

- Added conversation-family-scoped Roleplay local-character memories and reviewable first-use mutations.
- Kept Game Mode dynamic NPC metadata out of Long-Term Memory subjects and targets.

## 1.2.19 — 2026-09-04

- Bound the Sources destination panel and restored page scrolling when its list is hovered.
- Restricted Already imported counts and rows to the selected source scope.
