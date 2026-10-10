# Long-Term Memory changelog

## 1.4.23 — 2026-10-10

- Recall Korean memories that use short words or particles. Two-syllable Korean nouns such as `반지`, `서래` or `선물` are no longer dropped from keyword extraction, a query written with a particle (`반지를`) now matches the stored noun (`반지`) in both the keyword and lexical lanes, and a compound written with or without a space (`그림 선물` and `그림선물`) matches either way. Existing vaults rebuild their recall indexes once after the update.

## 1.4.22 — 2026-10-10

- Resolve Korean character names written with a particle. A Hangul name followed directly by a whole particle such as `은`, `가`, `를`, `에게` or `한테` now counts as present in the source, a returned name with a trailing particle binds to the known name before the particle, and a 2-syllable name that is the tail of a known 3-syllable name goes to Review Queue instead of becoming a separate character.

## 1.4.21 — 2026-10-09

- Keep extraction results that should be kept. An explicitly empty `subjectKeys` array now behaves like an omitted field instead of falling back to name matching, and a relationship change whose dimension deltas are all zero is no longer treated as a change. A nameless candidate can also borrow the identity a named sibling in the same batch resolved for the same subjectId, so it lands on the right memory instead of being rejected; borrowed identities stay in Review Queue.

## 1.4.20 — 2026-10-09

- Polish the Debug controls: unsaved cues and inline save beside Record recall explanations, pending spinners with focus held on the action, clearer full-log export with an honest privacy warning, and a compact health line. Localize count, weight and action labels, pluralize scanned-message wording, space metadata consistently, and report timeline steps with their own Started/Succeeded/Warning/Failed/Skipped wording. Confirm that clearing the log removes every chat's debug events without touching memories or settings.

## 1.4.19 — 2026-10-09

- Show extraction results and grouped candidates not kept, recall candidates added or not added with their recorded reasons and settings, and skipped apply changes in Debug. Explain recorded problems with guidance, and link pending extraction drafts to Review Queue without duplicating recovery actions.

## 1.4.18 — 2026-10-08

- Open the Memory Vault and switch back to it quickly in large libraries. The place pickers worked out which chats, branches, characters and personas have memories by comparing every place with every memory on each redraw; they now look places up in an index built once, so a library of about 800 places and 180 memories redraws in milliseconds instead of most of a second.

## 1.4.17 — 2026-10-08

- Make `/search` resolve the scoped chat's recall settings and prompt budget like generation, while preserving explicit request overrides.
- Show fused rank beside relevance in Debug and remove unused cooldown behavior.

## 1.4.16 — 2026-10-08 [highlight]

- Stop one everyday word from deciding recall alone. A single exact keyword counts for half the keyword lane unless the chat uses it as a name; two distinct keywords or a phrase still count in full.
- Make BM25 count on real chat windows: normalize against the query's eight highest-idf indexed terms instead of every term, so narration padding no longer drives a matching memory toward zero.
- Choose the bounded fuzzy keyword catalog by query overlap, not alphabetically, so a keyword past the first 512 in a vault can still match.
- Rescale the recall presets by 0.7 and retune balanced so the default 0.35 threshold keeps the previous 0.5 selection. A saved threshold above 0.4 now reads as 0.4; re-check custom weights.

## 1.4.15 — 2026-10-08

- Rename the Vault memory's "View all activity" link to "Open debug log" and open the Debug tab filtered to that memory, with no operation selected.
- Match whole operations against explicit memory-id references in the loaded debug events (extraction source and produced target notes, recall selected/rejected candidates), composing with search and the existing chips. The filter is clearable and states that apply operations log change IDs, not memory IDs, so some are not shown.

## 1.4.14 — 2026-10-07

- Rebuild the Debug tab as a two-pane workspace: an event navigator with search and counted All / Problems / Recall / Extraction chips, plus a details pane for the selected operation. Raw records move behind Copy JSON; the response snippet is no longer shown on screen.
- Record every recall as an ordinary history row that names its source chat. Selected and rejected memory names continue to open the Vault memory they belong to.
- Show each operation's status as an icon with hidden text, keep steps that share an operation in one timeline, and group rows under Today / Earlier.

## 1.4.13 — 2026-10-07

- Put every recall lane on one comparable 0-1 scale. BM25 is now scaled against a reference document that contains each query term once at average length, instead of saturating near 1, so raising the score threshold removes progressively weaker memories in every style instead of dropping from many to almost none. Keyword matches use the best match on a chunk and count for less when a keyword is shared by much of what the chat can recall, and the graph lane's half-weight ceiling is now documented.
- Retune the recall presets on that scale. Each style's strongest lane now carries full weight, so a threshold filters the same strength of match in every style, and recall defaults to 12 memories at a score threshold of 0.35. A threshold saved under the old scale (for example 0.25) now means something different, so re-check it after updating.
- Remove the per-mode recall style defaults, which never applied because resolved global settings always carry a style.

## 1.4.12 — 2026-10-07

- Filter the Debug tab by whole operation on the client. A phase or "Errors only" filter no longer queries a subset of events, so a truncated extraction cannot read "Completed" and a partial import cannot flip to "Failed".
- Replace only whole-token memory ids in debug text. An id that is only a prefix of another id (for example `character_mara_missing`) is no longer rewritten as `Mara Quill_missing`.
- Note when the Debug tab shows only the newest 200 events and offer "Show up to 1,000".
- Keep the "Latest recall workflow" on the newest retrieval-phase explanation.
- Read "No completion recorded" instead of "Running" when a started run has no completion after an hour.
- Resolve Debug tab memory titles for the ids on screen with `requestNotesByIds` instead of downloading the whole vault, and stop refetching the lookup on window focus.
- Render Technical details JSON only while its section is open.
- Clear a stale export or clear error when Refresh succeeds.

## 1.4.11 — 2026-10-07

- Stop losing selected memories while building the recall prompt. The budget counted only chunk text, so the framing and preamble pushed the assembled prompt past the limit and the serializer dropped its last chunks without reconsidering the smaller ones it had skipped; a high-scoring memory could be dropped while one that fit was left out. The fixed prompt overhead is now reserved in the recall budget, and a chunk that no longer fits is skipped so later chunks that still fit are kept.

## 1.4.10 — 2026-10-07

- Count only in-scope memories toward the recall caps. Keyword, tag and note buckets were truncated to 128 entries before the chat's scope, status and mode filter ran, so 128+ out-of-scope chunks sharing a popular keyword or `#tag` could crowd an in-scope memory out of the exact keyword hit, the direct hit, and the graph seeds those hits produce. The fuzzy keyword scan had the same flaw at 512 vault-wide keywords, which could leave a late-alphabet keyword unmatchable; both caps now count only what the current chat may recall.

## 1.4.9 — 2026-10-07

- Let lane weights and rank fusion decide recall order again. An unbounded BM25 raw score was added as a bonus on top of the fused score, which let a deep lexical hit outrank the best semantic hit of a higher-weighted lane; fusion now uses only the bounded per-lane score.
- Give keyword matches an absolute relevance. A partial or fuzzy keyword match used to be normalized against the best hit of the same query, so a weak match could reach full keyword relevance; it is now measured against the exact-phrase ceiling. Fuzzy keyword matches also require whole-token or word-boundary containment, so a keyword like "king" no longer triggers on "looking".

## 1.4.8 — 2026-10-07

- Ignore an invalid saved recall setting instead of letting it break settings, recall, and search. A null recall weight or an unknown recall style saved by another build used to make every settings read throw until settings.json was edited by hand. Both now fall back to the defaults, and the invalid value is no longer written back.

## 1.4.7 — 2026-10-06

- Make Sources re-extract use the availability modes currently selected instead of the ones saved earlier on the source, and save them on the source like a fresh import does. "Retry failed" still repeats the original attempt, and now says which modes it will use. Each import result shows the extraction mode it imports as, plus every availability mode, instead of only the first availability mode.

## 1.4.6 — 2026-10-06

- Stop a newly met minor character from failing the whole import when Conversation or Game is selected alongside Roleplay. Local character memories are available only in Roleplay, so such a memory is now restricted to Roleplay with a warning; when Roleplay is not selected it is skipped with an explanation. The other memories from the same source are still proposed.

## 1.4.5 — 2026-10-05

- Stop a short or partial name for a known character or persona from creating a duplicate local character memory. A first-name form with no explicit alias now waits in review for an explicit identity choice instead of being bound by first name alone or forking a new identity; when more than one trusted character shares the name, the ambiguous candidates are never merged. Once the choice is made it is saved and reused, and relationship memories resolve both participants with the same subjects as their character memories.
- Review Queue offers bind-existing, different-character, and skip choices for each participant. Decisions are remembered within the chat or group and included in backups. Saved decisions are listed per source; deleting one undoes it, so the next extraction asks again. Recovered content becomes a pending draft without renaming existing memories, replacing other pending proposals, or applying changes automatically.

## 1.4.4 — 2026-10-04

- Complete recall explanations. Each recorded recall now states the parameters that actually applied (mode, resolved eligibility, character targeting, and how many recent messages were scanned), a snapshot of the index that served it (how it was obtained — loaded, upgraded, or rebuilt; indexed, eligible, and embedded chunk counts; and when it was built), and a semantic outcome that tells disabled, unavailable, incompatible, no-matches, and contributed apart. The Activity recall workflow shows a concise explanation of those facts — the effective parameters, the index snapshot including its build time and embedded count, and the semantic outcome — and labels the rejected list as bounded: recorded rejected candidates up to the cap, not the full set.

## 1.4.3 — 2026-10-03

- Correlate recall selection with the confirmed injection through one attempt id, and record the outcomes the package actually observes: completed, skipped with a reason, cancelled, or failed. The last-injection panel now distinguishes a cancelled, failed, skipped, or completed-but-unconfirmed recall from one that never ran, instead of collapsing them all into "no recall recorded". Host-side non-invocation stays unknown.

## 1.4.2 — 2026-10-03

- Make the debug activity toggle honest: it now says it records recall explanations, notes that a chat override or host debug mode can also turn them on, states that extraction, draft, and apply activity is always recorded separately, and notes that the setting takes effect after saving settings.

## 1.3.41 — 2026-10-03

- Make extraction debug reporting trustworthy: show estimated input tokens and provider-reported usage distinctly, surface the failing step and warnings in collapsed activity entries, flag truncated model responses, and keep preflight failures when context metadata is missing.
- Stop showing a duration for activity entries that recorded no timing.

## 1.3.40 — 2026-10-03

- Recall activity now reports the memories that were actually injected and their token use, and separates the fused rank score from the weighted-lane threshold in each candidate's details. When the prompt budget drops a selected memory, it now appears as a bounded prompt-budget rejection instead of being hidden behind the ranking rejections. The threshold help text now states that the value filters on the strongest weighted lane score, not the fused rank score.

## 1.3.39 — 2026-10-02 [highlight]

- In a group chat, a targeted responder now recalls only memories scoped to that character. Global, chat-only, persona-only, mixed-character, and other characters' shared-chat memories are no longer injected into a single responder's prompt; a non-targeted or single-character recall keeps its existing chat-wide behavior.

## 1.3.38 — 2026-10-02

- Rebuild the recall index during a settings save when a stop-word or "filter generated" change alters what it contains, and report the save as saved-but-index-failed instead of a plain success when that rebuild fails. A recall queued behind that save no longer republishes an index built with the old stop words, and extraction edits made while the rebuild is in flight stay unsaved instead of being discarded.

## 1.3.37 — 2026-10-02

- The description now says what it does in plain words.

## 1.3.36 — 2026-10-02

- Drop the cached vault scan as official maintenance quarantines a malformed note, so full reads and recall stop serving the removed note's id and text without a package restart.
- Add a private runtime vault-mutation boundary that keeps the vault lock across a trusted host publication and its rollback and resets the package initialization and snapshot caches on both paths.

## 1.3.35 — 2026-10-02

- Check recall-index freshness and rebuild it under the vault lock so two concurrent stale recalls rebuild once instead of twice. Forward recall cancellation into rebuild, semantic-upgrade embedding, and caller-supplied index recall, so a timed-out recall stops instead of holding the vault lock, ranking an abandoned index, or publishing a cancelled dispatch receipt.

## 1.3.34 — 2026-09-30 [highlight]

- Stop Long-Term Memory from failing to activate when the vault contains a note that no longer passes validation. The invalid note is skipped by the note index and still surfaces as a vault read error, so the package no longer rolls back to an old version.

## 1.3.33 — 2026-09-29

- Offer the planted_in and paid_off_in timeline link relations during extraction, so foreshadowing and payoff links between events are captured instead of being treated as invalid.

## 1.3.32 — 2026-09-29

- Keep timeline events extracted from flat summaries without recognized headings instead of dropping them as invalid, so a valid event and any memory that links to it survive normalization.
- Stop the structured backfill from adding character memory units the provider already returned for the same source, and stop text under an unrecognized structured heading from falling into the previous section.

## 1.3.31 — 2026-09-28

- Keep character facts whose wording looks event-shaped for review instead of deleting them, so durable abilities, roles, and possessions phrased in past-tense narrative are not lost before a human decides.
- Block low-risk auto-apply when that review warning is present, including when the warning falls outside the retained diagnostic list.

## 1.3.30 — 2026-09-28

- Add a second optional place selector to the Memory Vault. When two places are selected they combine with AND, so the list and bulk selection show only memories available in both; clearing the second place restores the normal single-place view.

## 1.3.29 — 2026-09-27

- Align the bulk Change Availability workbench with the single-memory Memory Availability editor: same Available in heading and pills, collapsible place picker, and clearer chat-mode eligibility versus place-scope copy. Add/Remove still drives incremental `enableModes` / `disableModes` and `addScope` / `removeScope`.

## 1.3.28 — 2026-09-27

- Keep the Sources navigation tab labeled Sources while a source task runs or reports its result; show import, refresh, re-extract, cancelled, failed, and completed state as a separate status indicator instead of replacing the destination name.

## 1.3.27 — 2026-09-27

- Use All / Chats / Branches / Characters / Personas tabs in the Sources "Find sources in" picker so it matches Memory Vault and availability scope pickers.
- Collapse the Sources "Make memories available in" destination search, tab rail, and result list under a summary that shows the current destination, matching the Memory Vault picker.
- Show one spinner and one source count while a source task runs instead of a duplicated loader and a repeated count.

## 1.3.26 — 2026-09-27

- Render the Memory Vault unsaved-changes and rename-details dialogs as small centred cards again; both used a width class the Engine never emits, so they stretched across the screen.

## 1.3.24 — 2026-09-27

- Reconcile extracted candidates against notes committed after the extraction snapshot, so importing several sources at once (or two imports running at the same time) reuses the first memory instead of creating a duplicate under a second ID.
- Never revive an archived or resolved memory as a reconciliation target, including when a stale batch projection still shows it active.

## 1.3.23 — 2026-09-27

- Stop sending the whole vault's existing notes to the extraction model: the prompt now carries only the source, and the server matches extracted candidates against existing memories after extraction, so prompt size no longer grows with the vault.
- Remove the now-unused existing-note prompt-token setting from Memory Settings; stale saved values are discarded on load instead of blocking the settings.

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
