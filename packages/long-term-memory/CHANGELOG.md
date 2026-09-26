# Long-Term Memory changelog

## 1.3.22 — 2026-09-26

- Reuse an existing memory when an extracted candidate names the same subject as a note already in the vault, instead of creating a second note under a different ID.
- Leave a candidate unattached and require review when it plausibly matches more than one existing note, so an ambiguous duplicate is never created or applied automatically.

## 1.3.21 — 2026-09-26

- Filter more common filler, modal, and discourse words from keyword extraction and recall matching, and normalize curly apostrophes so contractions such as `I’m` are recognized as stop words.
- Add a Memory Settings stop-word list and a default-on toggle that keeps listed words out of generated keywords; listed words also cannot trigger recall, and stored or manual keywords are never rewritten or removed.

## 1.3.20 — 2026-09-25

- Show spinning import progress only on source rows included in the running task; keep other import icons visible and disabled until it finishes.

## 1.3.19 — 2026-09-24

- Keep distinct trusted characters and relationship pairs on separate memory targets, preserve resolved target identities through normalization, and bound provider-generated event IDs after server naming.

## 1.3.18 — 2026-09-24

- Surface conflicting legacy ID/title and duplicate subject notes during extraction instead of selecting one automatically; leave identity merges to the existing explicit preview and confirmation flow. Block ambiguous link application until the draft's link is explicitly edited to a scoped candidate.

## 1.3.17 — 2026-09-24

- Record bounded diagnostics for invalid recovery candidate subject IDs when draft validation fails, without logging candidate memory text.

## 1.3.16 — 2026-09-23

- Stop automatically binding short names and fuzzy spelling variants to characters; keep those matches reviewable instead of assigning a subject without evidence. A reviewed subject-bound alias choice can rename the existing canonical character note to the chosen alias.

## 1.3.15 — 2026-09-23

- Normalize rejected recovery candidate subject IDs before validation and storage so mixed-case names remain available for review without changing canonical identity checks.

## 1.3.14 — 2026-09-23

- Keep current-chat source destinations exclusive to that chat, including chats in a group. Explicit persona, character, and group destinations remain shared across their matching chats.
- Fork new chat-only evidence instead of adding it to a previously broader memory.

## 1.3.13 — 2026-09-22

- Stop imported source notes from forking short, first-name, and full-name variants of one character into separate local memories, and keep a roster character's full name from being dropped as ambiguous when its variants appear in the source.
- Keep genuinely ambiguous names failing closed against the trusted identities that compete for them.

## 1.3.12 — 2026-09-22

- Compare extraction candidates against the canonical scoped target notes even when ranked retrieval did not return them, so equivalent memories under abbreviated or full-name subject variants deduplicate instead of forking repeated notes, while distinct subjects, scopes, sections, and genuinely additive facts remain separate.

## 1.3.11 — 2026-09-22

- Canonicalize character name variants during extraction so short names, first-name-only forms, and minor spelling variations resolve to one trusted identity instead of forking duplicate memories, while shared or ambiguous names keep failing closed with the competing identities listed.

## 1.3.10 — 2026-09-21

- Read and parse each vault note once per fresh storage state, shared by scope targets, note lists, paged reads, and helper callers instead of rescanning the whole vault for every request.
- Drop the shared snapshot on mutations, backups, restores, and repairs so updated memories stay immediately visible.

## 1.3.9 — 2026-09-21

- Collapsed identical chat summaries shared across branch chat records into one ready-to-import Sources preview row, while preserving conflicting same-ID summaries, distinct summaries, and branch-specific import provenance.

## 1.3.8 — 2026-09-21

- Resolve character and relationship extraction candidates by trusted subject keys before matching names, while preserving rejection of invalid keys and ambiguous keyless identities.
- Reconcile structured-summary backfill with batch-established subject keys, keep same-name local characters isolated to their own chat family, and map short participant names to their established full-name identity instead of forking duplicate character or relationship notes.

## 1.3.7 — 2026-09-20

- Added review-only warnings for suspicious resolved-thread creates and strict event identifiers, plus backed-up preview/apply maintenance for divergent thread and world notes.
- Repaired fork review scope, provenance, stale-preview, conflict, and rollback guardrails.
- Corrected resolved-thread diagnostics and character-alias validation.

## 1.3.6 — 2026-09-20

- Preserved actionable extraction error codes and retryability, and reused one deterministic vault snapshot for Game Mode batch imports.
- Classified permanent provider quota failures as non-retryable and kept deterministic snapshot failures within their batch results.

## 1.3.5 — 2026-09-20

- Recover complete memory candidates from token-limited output without marking incomplete extractions current.
- Surface recovered output as an incomplete, retryable draft and bound rejection diagnostics for review.
- Retain candidates within the processing limit and report overflow instead of rejecting the entire response.
- Generate memory IDs and source hashes on the server, and default omitted evidence from the trusted source note.

## 1.3.4 — 2026-09-18

- Kept a source note's extraction context unbound until its extraction succeeds, so a failed or cancelled preparation no longer rewrites the source note.
- Rejected concurrent source-context changes again at the final commit, so a late writer cannot be overwritten after extraction validation.
- Marked extractions whose only non-kept candidates were duplicates as current, so re-running them no longer churns.
- Kept error-diagnostic extractions from being marked current, including direct Game Mode preparation with requested context bound to draft and persistence metadata.

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
