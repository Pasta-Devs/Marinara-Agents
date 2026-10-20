# Long-Term Memory changelog

## 1.4.57 — 2026-10-20

- Professor Mari's setup guide shows its pictures again. Marinara Engine renamed them, and the guide still asked for the old files.

## 1.4.56 — 2026-10-20

- Long-Term Memory now uses Marinara Engine's own libraries and data cache for its screens instead of carrying copies of them, so the download is smaller. It needs a Marinara Engine release after 2.5.0. On 2.5.0 and older, the version you already have keeps working. (#1487)

## 1.4.55 — 2026-10-19

- Behind-the-scenes fixes from a stricter code check; nothing you see changes. Extraction can no longer be started without knowing where your memories are stored, which would have failed. Characters who share a name now keep their other names in the same form as every other character.

## 1.4.54 — 2026-10-19

- Recall is faster when a chat's memories have many keywords. The keyword search no longer builds a new pattern for every keyword on every recall, which took most of the recall time, and it no longer runs at all when the keyword weight is 0. The same memories are recalled as before.
- A memory that shares one uncommon word with the chat is now recalled when full-text search also rates it a good match. Before, a single shared keyword that is not a name always stayed under the default threshold, so a memory such as "Elena's violin was smashed in the storm" was never recalled when the chat mentioned the violin. Everyday words, names, phrases and memories that share two keywords score as before.

## 1.4.53 — 2026-10-18

- When the settings fail to reload after Reset settings or a backup import, Retry on the Memory Settings load error now loads the new settings. Before, Retry brought back the settings from before the reset or import, so a later Save could write them back. Reset settings also shows the loading message while it reloads the settings, instead of the old ones.

## 1.4.52 — 2026-10-18

- A suggestion that extraction leaves out because it links to a memory the extraction could not find or did not keep now says so. Before, it said the suggestion "used the wrong memory stream". The low-overlap warning now checks the whole source, not only its start, and is no longer added to a suggestion that validation leaves out straight away.
- A relationship memory whose text starts with "Summary:" now keeps that sentence in the chat prompt. Before, the relationship scores line pushed it out.
- After a reload, Retry failed on a finished import retries the same sources as before the reload. Before, it also retried sources that were not found, which are still not found.

## 1.4.51 — 2026-10-18

- The debug log now records a "Candidate reconciliation" entry for every extracted source, even when nothing matched. It counts the target memories (other than characters and relationships) that reused an existing memory, matched no other existing memory, were ambiguous, or were left for review because the search window was incomplete. Copy JSON shows the counts. Before, the entry was recorded only when a candidate matched or warned, so a source whose candidates all became new memories left no entry.

## 1.4.50 — 2026-10-18

- The Vault and Activity rows now show the Marinara focus ring when you tab to them, and the Review freshness chip and the Vault "Edited manually" chip show their soft accent border, on every supported Marinara Engine version. Before, Engine 2.4.1 to 2.4.6 showed the browser's default focus ring on those rows, and Engine 2.4.1 to 2.4.4 showed a full-strength border on those chips.

## 1.4.49 — 2026-10-18

- Extraction now saves a fact to the character it names. The extraction model was also shown each character's stored key, and a key it returned won over the name, so a fact about Alice could be saved to Bob with only a warning and be applied automatically. The model no longer sees stored keys, and any key it returns is ignored.
- An extraction no longer fails, and Review no longer blocks a suggestion with an error, when a memory links to another memory from the same source that extraction then leaves out. The link is removed, with a warning in the extraction details, and the memory is kept. A relationship change whose cause was left out is left out too. Before, a source whose suggestions were applied automatically failed every time it was retried.
- A prompt template that contains only spaces now falls back to the mode's default prompt. Before, a blank template active for Conversation or Game extracted with the Roleplay prompt.

## 1.4.48 — 2026-10-17

- The daily cleanup now also deletes invalidated drafts that nobody discarded once they are older than the audit window (30 days by default), counted from when they were invalidated. A draft is invalidated when the memory or detail it targets is deleted, so Review can only discard it. Pending drafts still stay until you review them.
- `usage.json` stays small: it now keeps the id of each reply that injected memories for one to two days instead of 180. The id only stops a repeat of the same reply from being recorded twice, and a repeat arrives within moments.
- The daily cleanup now clears the per-memory usage counters that versions before 1.4.42 left in `usage.json`, including in vaults that haven't injected a memory since. Permanently deleting a memory no longer rewrites `usage.json`. A retention audit window longer than 180 days no longer requires the unused `usageRetentionDays` to be raised too.

## 1.4.47 — 2026-10-17

- In the place dropdown, either answer to the unsaved-changes prompt now returns focus to the place button. Changing tabs during a search keeps "No memories" open. While closed, that group is a "Show N places with no memories" row that arrow keys and Enter reach like a place.
- A chat imported with "All branches" now shows one chip in the availability editors, not one per branch, and unticking or removing it removes its branches too. Removing a chat in bulk "Remove availability" removes its branches from every selected memory. It also lists chats, characters and personas that no longer exist, so you can remove them.
- If the shared-history lookup fails, a branch now recalls its own memories instead of none. `/search` given only a chat returns the shared memories a reply recalls. In Game and Conversation chats, only rolling summaries count toward shared-history recall. Day, week and game-session summaries don't, because each branch can write its own under the same name.

## 1.4.46 — 2026-10-17

- Recall now finds memories about a character or persona with a one-syllable Korean name, such as 린, when a particle such as 이, 은, 을 or 에게 follows the name. A memory that says 린이 웃었다 now comes up when you ask 린은 뭐 했지?, and 린에게, 린을 and 린 on its own match too. Other endings, such as 린아 or 린이가, still don't. This works when the vault has a character memory with that name in its title, and only in text search. Other one-syllable words still don't match across particles, so 나는 doesn't match 나를. Existing vaults rebuild their recall index once.

## 1.4.45 — 2026-10-17

- The place pickers no longer have a Branches tab. The Vault filter, its second "and" filter, "Find sources in", the import destination and both availability editors now share two pickers with the same four tabs: All, Chats, Characters and Personas. A chat with branches is one Chats entry, named after the chat with "All branches" under it, that covers every branch as "All branches" did before. The Vault filters now open as a search dropdown like "Find sources in", still split into places with and without memories, on a solid background. The availability editors open on All, with tabs two across on narrow screens and four across from 22rem. Memories already assigned to one branch keep that assignment: the availability editor shows it as a chip named after the chat and the branch, saving other changes keeps it, and it can still be removed there or with bulk "Remove availability". The Vault filter for a whole chat still includes them. Help text no longer mentions branches.

## 1.4.44 — 2026-10-17

- A new branch now recalls the memories made from the history it shares with the chat it came from. When Marinara Engine creates a branch, it copies the rolling summaries whose messages all come before the branch point. A memory saved to another branch of the same chat is now recalled in the branch too, as long as every chat summary it was made from is one of the branch's own. Memories made or updated from a summary written after the branch point, and memories from lorebooks, characters or typed in by hand, stay in the branch they were saved to. Memories never cross into another conversation. This changes recall only: where memories are saved, how they are edited and what the availability editor shows stay the same, and no stored data changes.

## 1.4.43 — 2026-10-17

- The Long-Term Memory server routes now live in one file per area (notes, drafts, imports, maintenance and settings) instead of one 1,600-line file. Every endpoint keeps its path, size limit and response, so nothing changes in the app.

## 1.4.42 — 2026-10-16

- Long-Term Memory no longer keeps finished extraction drafts forever. The daily cleanup now deletes accepted, auto-applied and superseded drafts once they are older than the audit window (30 days by default). Pending and invalidated drafts stay, so Review and Activity show the same items as before. Opening the Long-Term Memory screen and creating a new draft read fewer files as a result.
- A reply that injects memories no longer rewrites per-memory usage counters in `usage.json`, because nothing read them. The next such reply removes the counters already stored there. Duplicate replies are still recorded only once.

## 1.4.41 — 2026-10-16

- The memory extraction instructions no longer use real-looking character names in their example timeline ids, so the model can no longer mix those example names up with characters in your chat who share them. Nothing else about extraction changes.

## 1.4.40 — 2026-10-16

- The Long-Term Memory server modules no longer import each other in a loop. The helper that compares two lists of memory subjects moved to its own module. Recall, extraction and storage behave exactly as before.

## 1.4.39 — 2026-10-16

- Long-Term Memory now starts when its settings files contain a field from a newer version, for example after a failed update rolls the package back. Until now such a field stopped the package from activating, so no chat had recall or extraction, and backup export failed too. The field is now ignored and named in one warning in the server log, and saving settings keeps it in the file, so updating again restores it. This applies to the memory, extraction, agent and retention settings. Settings sent from the app are still checked strictly, a known setting with an invalid value still fails, and settings fields from older versions are still removed.

## 1.4.38 — 2026-10-15

- Switching between the Vault, Review, Sources and Settings screens no longer shows a brief "Loading" panel, because the screens ship in the one bundle the package already loads. Importing a backup, resetting memory settings and deleting all memory data now read each setting and the integrity report once instead of two or three times. Nothing else changes in what the screens show or how they behave. Internally the duplicated tab-key handling, scope labels, confirm dialog, availability copy and shared queries are now one copy each, and 155 unused interface strings were removed.

## 1.4.37 — 2026-10-15

- Reorganised the Long-Term Memory screens without changing how they work. The Vault, Review queue, Sources and Settings screens each live in their own folder, and the setup guide and the Maintenance tab are components of their own. One visible difference is that the result of a Maintenance action now appears at the top of the Maintenance tab instead of below the tab bar, so it no longer shows on the other tabs and saving settings no longer replaces it.
- Reset settings now shows the reset values in the settings forms straight away. Before, the forms kept the values from before the reset until Memory Settings was opened again.

## 1.4.36 — 2026-10-14

- Fix glued-together sentences and raw server errors in the Long-Term Memory screens. The Review summary after Apply or Discard now reads as separate complete sentences with correct spacing and punctuation, for example "Applied 2 mutations; 1 failed. 1 blocked before Apply.", instead of fragments run together. The Debug separators between metadata parts and the "chunk" label now come from the locale, so a translation can change them. When a request fails with only an HTTP status such as "Not Found" and no message from the server, the screens show their own localized message instead of the raw status text; a message the server does send is still shown as before. Recall, extraction and storage are unchanged.

## 1.4.34 — 2026-10-14

- Long-Term Memory now uses only styles the app already provides, so its screens look the same in the app as they were designed. Sources → Manage source no longer shows the imported-source preview under the workbench, the Review and Sources action bars sit inline on wide screens, selected Review rows and Vault notes are highlighted, tab focus rings use the editor focus colour, info popovers keep their size, and checkboxes are one size in Vault, Sources and Review. Screen readers now announce the Vault place lists as single-choice, and the arrow keys move between places.

## 1.4.33 — 2026-10-14

- A character's name now keeps full keyword credit when the chat does not capitalise it in the middle of a sentence. Until now a single keyword match counted as a name only when it was capitalised in the middle of a sentence, so a name at the start of a sentence, in lowercase, or in a script without letter case such as Korean was capped at half credit. Recall now also treats each word of a character memory's title as a name, ignoring case and common stop words. A single ordinary keyword is still capped, and nothing else changes: no new lane and no change to the threshold, text search or vector scores. Only the words of the title are matched; nicknames and aliases are not.

## 1.4.32 — 2026-10-13

- Make recall do less work on a large vault. A turn no longer re-reads and re-hashes every memory when nothing in the vault has changed since the last recall; the first recall after a restart still checks the whole vault, so memories you edit outside Marinara are picked up after a restart. Editing a memory re-embeds only the memories whose text changed instead of the whole vault, and the first rebuild after this update still re-embeds everything once. Extraction that applied no changes no longer rebuilds the recall index.

## 1.4.31 — 2026-10-13

- Extraction now asks for a `caused_by` link from an event to the event that directly caused it when both are in the same response, and linked recall follows that link in either direction, as well as a thread's `paid_off_in` link to the event that paid it off. The seed rule and the 0.2 own-relevance floor are unchanged, and a graph weight of 0 still turns linked recall off. Existing vaults gain these links only after a chat is extracted again; nothing is backfilled.

## 1.4.30 — 2026-10-13

- Recall can now include a memory that nearly matches the chat when a recalled memory links to it with an explanatory link: an evidence link, a thread and the event that caused or triggered it, or a relationship and the event that caused it. The linked memory must match the chat on its own at least a little (relevance 0.2), and links from memories that were not recalled add nothing. Recalled memories keep their places, and the memory cap and token budget still apply. This applies in the balanced, broad and story styles. A memory reached only through a link, with no match of its own, is no longer recalled, even at a threshold of 0. A saved `custom` graph weight now turns linked recall on or off and no longer scales a score, and the Memory Settings help text says so.

## 1.4.29 — 2026-10-12

- Clean up how Long-Term Memory behaves around damaged or old data, with no change to recall scoring or extraction. Delete all data now also removes the vault copies that identity and fork repairs keep, and those copies are limited to the newest three. Extraction no longer stops for good at 10,000 rejected suggestions: the least recently seen ones make room and saved identity decisions are kept. A malformed `usage.json` or injection receipt no longer blocks activation, and one note with an unknown field no longer stops recall of the others; writes still refuse to run over a vault they cannot fully read. An out-of-date recall index is rebuilt in place instead of leaving a full copy in quarantine. Identity and fork repairs now redirect rejected suggestions to the surviving memory, as renaming a memory already did.

## 1.4.28 — 2026-10-12

- Finish the Memory Settings → Debug details pane. Each event row shows how long ago it last logged, Result reads as counts (for example "17 candidates found → 9 kept → 9 changes" or "148 indexed → 131 usable in this chat → 2 added"), recall candidates are flat rows with a score bar marking the minimum relevance and a reason that names the limit that applied, a recall that added nothing says why, recall settings read as labelled terms, and What happened lists one sentence per step with its offset from the start. Durations over a second read in seconds or minutes, and a note says what Copy JSON includes.

## 1.4.27 — 2026-10-12

- Make the open event visible in Memory Settings → Debug. The selected row keeps a background and accent bar wherever the pointer is, the active filter chip reads pressed, and muted row text stays readable on hovered and selected rows. Rows now show the outcome ("7 of 12 kept", "1 added · 6 not added", "1 saved · 1 skipped") instead of repeating their title, and a failed row keeps its error. A compile-evidence warning says how many candidates failed checks. Result counts use the right singular and read "kept"; applied changes show saved and skipped counts rather than raw IDs, and a failed apply reports none; the Details heading appears only when it has content and recall counts are no longer repeated there. The health line drops "Log size unavailable", the Vault "Open debug log" link has a 44 px target, and the recall-failed message names Memory Settings → Debug.

## 1.4.26 — 2026-10-12

- Ask the embedding model for a query embedding when recall searches the vault, instead of treating the search text like an indexed memory. On Engines that pass the input type through, models that distinguish the two, such as multilingual E5 and nomic-embed-text, apply their query prefix to the search. No reindex is needed, because stored vectors were already document embeddings.

## 1.4.25 — 2026-10-11

- Show which embedding source Long-Term Memory uses. The semantic search health line now names the source (for example "Built-in local MiniLM"), says when the saved vectors were built with a different source and will be re-embedded on the next recall or reindex, and no longer reports semantic search as available after the source changed. Memory Settings explains that the Extraction connection only drives extraction, and the vault health panel explains which connection drives recall embeddings, that the built-in model is English-only, and to use a multilingual embedding model for Korean, Japanese, Chinese or mixed-language vaults.

## 1.4.24 — 2026-10-11

- Refresh the recall index when a connection or agent save changes Long-Term Memory's embedding source. The Engine rebuilds the vault for the new source during the save instead of re-embedding it inside the next chat's recall, and a source that still cannot embed the vault reports failure instead of a false success.

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
