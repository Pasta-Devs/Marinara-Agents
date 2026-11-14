# Long-Term Memory UI

This is the client behavior map. Use it for changes to screens, navigation,
loading, editing, review, onboarding, or chat settings. Use `DESIGN.md` for
visual and accessibility rules, and `ARCHITECTURE.md` for server and data flow.

## Surface Map

`LongTermMemoryDetail.tsx` owns the capability shell, destination changes,
the activation chip, vault-health feedback, recovery handoffs, and dirty navigation
guards; `Onboarding.tsx` owns setup. The shell's five destinations and
the separate Chat Settings entry:

| Surface         | Owner                          | User task                                                                                                                                                                                          |
| --------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memories        | `vault/MemoryVault.tsx`        | Browse, search, filter, edit, link, archive, restore, and manage memory availability.                                                                                                              |
| Review          | `review/ReviewQueue.tsx`       | Inspect evidence, edit or preflight suggestions, then add them to memory or discard them.                                                                                                          |
| Sources         | `sources/SourcesWorkspace.tsx` | Select source and destination scopes; import, refresh, re-extract, cancel, and inspect source results.                                                                                             |
| Activity        | `settings/ActivityPage.tsx`    | Read what memory did and why; the "Record recall explanations" switch sits on top and saves on its own.                                                                                            |
| Memory Settings | `settings/MemorySettings.tsx`  | Configure recall and extraction; Troubleshooting holds setup and the tour again, reset and delete all data.                                                                                        |
| Chat Settings   | `ChatSettings.tsx`             | Set per-chat recall style, token budget and how memories from the chat get in; see what background import did today and what waits for review; inspect what the last reply used. |

Each screen lives in its own folder (`vault/`, `review/`, `sources/`, `settings/`)
with the components cut out of it; modules shared across screens stay at the
feature root.

`LongTermMemoryNavigation.tsx` owns the five destination buttons (Vault, Review, Sources, Activity, Settings) and their
memory, review, and source-task status badges. `settings/ActivityPage.tsx` is the Activity destination: the record switch
(`PUT /settings` `{ longTermMemoryDebug }`, saved at once, locked while pending, a toast on failure) above
`settings/ActivityView.tsx`. The Vault's "View activity" opens it filtered to that memory, the chat drawer's "Open in
Activity" (an "activity" open request carrying the recall attempt id, only when Chat Settings can open the Agent) opens it
with that recall selected, and its "Open Recall settings" button opens Settings on the Recall tab.

## Navigation Contract

The shell keeps destination state in `LongTermMemoryDetail`. Destination
changes first resolve unsaved work:

```text
clean surface -> destination changes
dirty surface -> save / discard / stay decision -> destination changes or remains
```

Opening a memory, review item, source target, activity view, or the Agents
panel uses the same guard. The in-page dialog names the destination ("Save your
changes before opening X, or discard them."); the `confirm()` fallback uses the
same nouns and the "Discard and continue" verb. A successful navigation clears
the relevant stale selection and closes transient menus. Save and discard decisions restore focus
to the control that initiated navigation.

Help and hints: a consequence of a control (cost, what it overrides, what it
cannot undo) shows as a visible one-line hint at the control, not only inside an
info popover. A popover keeps at most one background sentence. A hover or focus
popover never takes pointer events, so it cannot swallow the next click; a
pinned popover closes on an outside press or Escape (focus returns to its
trigger) and has no focus trap.

Setup is a dialog of four beats with Mari: Hello (turn memory on for the open
chat, leave it off, or pick a chat later), How (the three Memories from chats
choices as single-choice cards with an "After a reply" sample; the shown choice
is preselected and Next saves it), Head start ("Read my recent chats" reads
Chat Summaries: the open chat's into that chat, or the newest ten with no chat
open; "Start fresh" skips it) and Done (a recap with a Change button per beat,
"Turn on" when the chat is still off, "Open the Vault", "Review them now"
when drafts wait, and "Show me around" until the tour has been finished or ended). Mari's lines appear one at a time (all at once under reduced
motion or after "Show all"); the answers show after the last line. Each tap
saves at once. The beat is kept in local storage (the old guide's key: its
`complete` reads as done and its `step:N` restarts at Hello), so closing with
Later and reopening resumes at that beat; reaching Done records done, and a
finished setup opened again never writes an earlier beat. Setup never opens on
its own. It opens from the empty Vault's "Set up memory" (or "Resume setup"
with ticks for the answered beats), which replaces the New memory button until
setup is done ("Create manually" stays in the Add menu); from the chat drawer's
"Off · Set up" chip, shown while the chat's memory is off and setup is not done;
and from "Run setup again", in the header's Help menu and in Memory Settings'
Troubleshooting, at any time.

The tour is nine optional stops with Mari: Welcome, the Vault, Sources, Review,
Linked memories (the Vault's Graph), reading in the background, In the chat,
Activity and Settings for every chat. Linked memories presses the Vault's Graph
button itself and rings the graph; leaving the stop presses List again, and a
Vault already on Graph is left alone. Each stop opens its tab, scrolls its
control into view and rings it with a cut-out in a 50% scrim, so the control
stays at full strength; a stop whose control is not on screen centres the bubble with no ring. With no
memories in the place the Vault shows (sources do not count), Linked memories draws six made-up memories (tagged
"Example" in the filter row, `data-ltm-graph-example`, never saved; their cards
open nothing in the editor) and the bubble says it is an example. The reading stop rings
the header reading chip: while an extraction runs the page shows "Reading the
last reply…" with the 40px `archive-working-mini` icon beside the activation chip
(`data-ltm-reading-chip`, read from the debug log's `extract_source_note`
events, polled every 4 seconds; any running source-note extraction counts, not only this chat's, and a run
older than 10 minutes is treated as crashed), and when Mari is idle the stop shows the same chip
as a preview for its duration. The bubble holds the stop's archivist picture, "Stop N of 9", one
line, dots, End tour, Back and Next (Finish on the last stop); under 640px of
window it docks to the bottom and uses the 64x96 strip. In the chat cannot open
the chat, so the bubble itself shows the open chat's Long-Term Memory card
(without the buttons that would leave the tour) when memory is on for that chat,
and says where to look when it is off. Esc,
End tour and Finish end it and record it as done; focus stays in the bubble (Tab
wraps, the arrow keys step) and returns to Help afterwards.
Mari's pictures are 4-frame strips and `onboarding/Sprite.tsx` holds every motion
rule. The idle, working, Vault-browse, graph-model, activity-log,
reading-tape and head-start strips loop endlessly (`data-ltm-sprite-motion="loop"`, 3.2s a turn, 0.8s while
working); the hello, filed, fresh, welcome, sources, stamp, in-chat and settings
strips play once and hold their last frame (`"once"`, 2.4s). A sprite given a
`frame` prop is a still and has no motion attribute; one without it animates (the How beat's
mode picture always gets a frame, so it never does). Under
`prefers-reduced-motion` nothing animates: a loop holds its first frame (the
graph-model and activity-log loops their third), a play-once strip its last. `data-ltm-setup-sprite-frame`
carries that held frame. The setup and tour sprites are keyed so a play-once strip
plays again on each beat or stop.
Starting the tour with unsaved changes first leaves for the Vault, which asks
whether to keep or discard them; staying cancels the tour.
The tour starts from setup's Done beat, from Help's "Take the tour" and from
Troubleshooting's "Take the tour"; the Help button opens a two-item menu (Take the
tour, Run setup again) that Esc or a click outside closes.

## Responsive Contract

`LtmWorkspace` uses container width, not viewport width:

| Container width                       | Workspace                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `<48rem`                              | One pane at a time with a pane tab rail.                                      |
| `48rem` to `<72rem` with an inspector | Navigator stays visible; workbench and inspector switch in the second column. |
| `>=72rem` with an inspector           | Navigator, workbench, and inspector are visible as three columns.             |
| `>=48rem` without an inspector        | Navigator and workbench are visible; pane tabs are hidden.                    |

Pane state belongs to each destination. Pane tabs use `ArrowLeft`, `ArrowRight`,
`Home`, and `End`; changing panes moves focus to the selected pane control.
Disabled panes are excluded from the tab sequence. The destination rail becomes
the mobile bottom navigation; reduced-motion behavior is defined in `DESIGN.md`.

Layout inside a destination also follows container width, so a narrow panel on
a wide window gets the phone layout. Below `48rem` of workspace, Vault and Sources
row actions collapse into a menu and the Review batch bar and an open lorebook's Import bar stick
while rows scroll; from `48rem` they sit in the flow. Sources measures its own
column for this and has no pane switcher at any width. Review rows never use a menu: their
commit control is the text button "Add to memory" with a visible Edit beside
it at every width. Review also widens its fields and padding from `40rem`. Review draws one summary strip ("N sources · N pending · N ready", plus "· N blocked" only
when something is blocked), in the navigator below `48rem` and in the workbench from it, and puts the run summary at the top of the
workbench while rows are listed (above the pane tabs once the queue is empty), as a warning while a
change is ready to apply. The Sources scope row stacks until
its destination container reaches `40rem`. Vault note title and status share a
row from a `28rem` workbench, and the Vault list scrolls on its own from `48rem`.
Memory Settings puts its four section tabs, its recall field pairs, its three
active-template pickers and its activity detail pairs in one row from a `40rem`
settings container. The header's add action keeps its `2.75rem` target and drops
its label, and the Vault health pill hides, below `48rem` of the detail surface;
the health pill's detail text appears from `40rem`. The pill shows only when
something needs fixing (never for a vault that is not built yet). Below `48rem` the
header tightens its gaps and padding; below `22.5rem` it also hides the icon tile.
"Add memories" stays in the header on every tab. "No chat open" is a small chip
in the header beside it (`data-ltm-activation="no-chat"`), in both header modes; below
`48rem` it is the icon alone, named by its `aria-label` and `title`. With
a chat open the activation chip sits in the content row beside the tabs: "Recalling in
{chat}" with "Turn off", or "Not recalling in {chat}" with a primary "Turn on". The
desktop tabs show an icon, the name and, for Memories and Review, the count in
an accent pill; the Engine's tab rule drops the icons while the detail container is
between `56rem` and `96rem` wide, so the tabs stay on one row. Every tab opens with its heading and one subtitle line
(`data-ltm-tab-subtitle`), the same words as the tab's `title`: "Saved memories",
"Proposals waiting for your OK", "Import from chats, lorebooks, characters",
"What memory did and why" and "Recall and extraction options". The reindex notices are one slim line with a
Reindex now button and no (i). At phone width the tabs become a five-column bottom bar
(Memories, Review, Sources, Activity, Settings, with counts) and a running Sources task adds a one-line status
above it. Setup's pictures are 128x192 frames of the archivist strips, drawn at
1x so the pixel art stays sharp. The detail header's
icon shrinks and the content padding drops to `1rem` below `48rem` of the detail
container, not of the window. The destination tabs, the availability tabs and
their rows keep `2.75rem` against the Engine's `2.25rem` tab height. Chat
Settings keeps the host drawer's own control sizes as named exceptions: the
recall-style select (`min-h-8`) and the number fields (`compactInputClass`,
`min-h-9`) match the drawer's neighbouring fields, and the compact Retry
(`min-h-7`) matches its action floor. The Vault and activity log lists cap at the window height minus `12rem`
(`dvh`, with a `vh` fallback and a `10rem` floor), so a zoomed or short window
scrolls the list instead of the page.

## Workflow Contracts

### Memory Vault

The navigator resolves scope targets before loading notes. Search, status,
source-only, and sort filters apply to the visible note list; clearing filters
does not change the selected scope. Each type group renders at most 100 rows;
Show more adds the next 100 and moves focus to the first row it added. Group
counts, the shown total, search, and Select visible still cover every memory,
and a new search, filter, sort, or place starts again at 100 rows. The
navigator leads with the place and search; the Show and Sort selects, a second
place and the available-modes filter sit under a "Filters" disclosure (a button with
`aria-expanded` and `aria-controls="ltm-vault-filters"`, panel `data-ltm-refine-panel`,
`ListFilter` icon) that is closed by default, opens by itself while a second place or
the modes filter is set, and names what is active when closed (a non-default status
or sort, such as "Archived · Sort: Title", is named but does not open it). The Select
and Source notes chips share the Filters line. With memories checked, the bulk rail is Edit selected…, then Archive and
Delete set apart; Edit selected… opens one sheet for status, modes and
availability that previews the outcome per memory and applies as one request.
Under "What Apply will do" a polite summary counts ready, unchanged and blocked
memories; Apply changes the ready ones and skips the rest, which stay selected.
Apply appears in the header and under the list, stays focusable when off
(`aria-disabled`, guarded handler) and names the reason beside it.
Save in the memory header works the same way: it keeps its label and primary
tone, stays focusable while off or running, and a polite status beside it says
Saving or Saved until the next edit. A save whose recall index rebuild is
deferred is a warning ("Saved. Recall will catch up…"), not a danger error,
because the memory is saved.
Back up and Restore (`vault/useVaultBackup.tsx`) sit behind a "⋯" button beside New memory in the Vault header
(`data-ltm-vault-more`, `aria-expanded`); it opens a menu (`data-ltm-vault-more-menu`) under the header that stays
open until toggled. Back up downloads
`long-term-memory-backup.json`. Restore opens a panel under the header: Choose backup validates the file and shows the
current and incoming counts, then Replace with this backup asks the host "Replace Long-Term Memory data?". A restore
replaces the whole vault and the settings, so it drops the open draft and the selection and refetches everything
(Memory Settings refills its forms when it opens). Their results are toasts; the Restore preview stays in the panel.
When the integrity check finds a problem, a warning bar above the memory list reads "N memories need fixing · Fix"
(`vault/useVaultFix.tsx`; N counts the memories the issues name, and a problem with no memory, such as a stale index,
reads "Recall data needs fixing"). Fix opens the Vault Maintenance panel under the header: the integrity state, each
issue (a memory's title opens that memory), and the three repair checkboxes (reindex recall data, quarantine malformed
notes, backfill source titles), each with a hint. Run selected maintenance asks the host "Run maintenance?", locks the
Vault while it runs, and then raises each action's result as a toast and keeps focus on the panel's Close button; a failed integrity check shows
"Integrity check could not load" with Retry. A memory's Memory info lists its History (up to 20 changes from the
per-memory events route) with a link to the debug log.
The first type group opens once per place (a group that later sorts above it does not close it); the others start closed (a search opens
them all). A row shows no type chip (the group heading it sits under names the type). Its chip line, shown only when it has
content, holds a status other than Active, the origin chip and where the memory is available as place pills (two,
then a "+N" chip; "Available everywhere", with a globe, when it has no place; the place being viewed gets no chip).
A quiet short age ("2 hr. ago", the Debug list's relative formatter, `data-ltm-row-updated`) ends the title line, and
its tooltip reads "Updated <date and time>". A Character or Relationship memory gets an "About …" subject line,
dropped when the title already names every subject. The preview is plain text with list markers stripped, and carries
a label ("Keyword", "Subject", "Linked to") only when it shows a search match. The row's Archive and Delete are icon
buttons from the container's compact width up and sit behind the "…" menu below it.
The header carries New memory beside the Graph/List switch (it opens the list view first; the empty Vault offers Set up memory
in its place until setup is done). The Filters line's Select is a chip and "N selected" shows only in
select mode; the Source notes chip names its count ("Source notes · N") and hides when there are none and the filter is off; each
group heading shows its count as a chip. An empty list is one line with, when source notes exist, a
"Show source notes (N)" chip. When the place filter hides memories that exist elsewhere, the line says so ("Nothing
is available in …, but you have N saved elsewhere.") and Show all returns to every memory;
"No memories found" is never shown while memories exist. New memory starts on the current
character (the chosen place's, else the chat's when no place or All is chosen; a chosen persona or
group place keeps its own scope) as a Character memory about them, with an empty
Facts text under a placeholder; adding a detail adds a section and keeps the Facts text.
The open memory's row carries the primary wash, a left-edge bar and
`aria-current="true"` on its button, so it is marked beyond colour.
The memory's side panel is called Memory info wherever it opens: the toggle in the
memory header (`aria-pressed`, no `aria-label`, so its accessible name is its visible
label) and the narrow-layout pane tab. Its first section is named for what it holds,
Keywords and links.
The workbench distinguishes read-only
source notes from editable memories and keeps validation, evidence, freshness,
confidence, subjects, links, keywords, and availability visible as applicable.
Archive supports undo through a toast action. Destructive actions and navigation away from edits use
explicit confirmation.

**Graph view.** One Vault header sits above both views: the "Memory Vault" title, the memory count, the List / Graph
switch (two chip buttons with icons) and the search box, which keeps filtering both views. It wraps at phone width. The
Graph replaces the List and its editor pane (the List stays mounted and hidden, so an open draft survives), so a phone
has no second pane switcher.
`vault/MemoryGraph.tsx` draws `vault/graph-layout.ts` on an SVG canvas with pan, zoom and Fit. It opens on Focus: the
open memory and its links two hops out, with background links (involves, occurred in, affects) drawn only around the
memory pointed at; Whole Vault, off by default, shows every memory. Switching the open memory in the List and coming
back keeps Focus on it. The graph shows what the List would for the chosen place and search. One filter row, with no panel
around it, wraps onto more lines instead of scrolling, in groups split by a thin line (the lines go at phone width):
Whole Vault; the four family chips (People, Story, Threads, World; their dots are the colour key, so there is no legend
and each kind also has its own icon) with a count each; Importance as All, Hide minor and Major and up (the group is
labelled "Importance" for screen readers, with no visible word); Sources and Archived with an icon and a count each;
and "Used in the last reply", marked with a dashed ring. The counts are the memories in the current place and search,
before these chips filter them (a family counts its own memories, archived ones only while Archived is on). The ring
chip rings (dashed, primary) the memories the last reply in
the open chat used, read through the same query and attempt rule as the chat's last-injection panel (a failed,
cancelled or skipped attempt rings nothing, and a count says how many are in view); with no chat open it is locked and
says "Open a chat to see what was used". A hidden family hides its memories and so every link touching them. In Focus a
"Linked to {memory}" pill floats at the top of the canvas with a "Show everything" chip that turns Whole Vault on;
three icon buttons (zoom in, zoom out, Fit everything) stack at its top right; one line under the canvas gives the
hint on the left and the memory and link counts on the right. At phone width the canvas fills the pane, the pill
docks to the left edge and the page itself never scrolls sideways; every string has a Korean translation in the client's `locales/ko.json`. The canvas is a tinted
surface with a 22 px dot grid. The family colours (People, Story, Threads, World; Sources grey) are the approved
mock-up's own, with a second set under the Engine's dark theme, and live as `--ltm-graph-*` properties in the
component's `<style>` block. A node is a disc of its family colour at 20% over the surface, outlined in that colour,
with its kind icon inside. The open card's memory (in Focus, the anchor when no card is open) and the keyboard-focused
one have a primary ring, a recalled one a dashed ring outside it, a resolved one a dashed outline with a green check,
and one with a pending change an "!" badge. Every memory is keyboard reachable: Tab enters the canvas on one stop, the arrows move to the
nearest linked memory in that direction (any memory when none is linked), Enter opens its card, Esc closes the card
and returns to the node. The card is the mock-up's overlay: it floats over the canvas's bottom right (20rem wide, scrolling
inside, under the banner's height; a bottom sheet inside the canvas at phone width) and takes focus on its title. It
shows the memory's name with a small close chip, chips for its kind (icon and family colour), its status when not active,
its importance and "Used in the last reply" when recalled, the first line of its text, "Link to {subjects}" when it
applies, and "Linked memories N" as read-only rows of relation, kind icon and title (the `rows` presentation of
`vault/LinkedMemories.tsx`, which the editor shares in its editable chips form): what it links to, where it was
extracted from and what links to it, at most six and then "N more", which opens the editor's Linked memories. A linked
memory the canvas shows becomes the card; one the two-hop window or a filter hides opens in the editor. Focus here (or
Show everything when it is the focus) and Open in editor are plain chips. Focus here, or a double-click on a node,
re-centres the Graph two hops around that memory; Open in editor returns to the List with it open. Labels and lines hold their size at any zoom (text and strokes are counter-scaled by the zoom, with a halo in the
canvas colour). Cause and payoff lines are neutral with an arrowhead showing the direction, payoff dashed; provenance
is dotted, context plain, and a relationship's line to its people is thick and People-coloured. Pointing at or arrowing
to a memory, or opening its card, lights its lines and names each on the line ("Caused by", "Between"; past ten, plain
context lines go unnamed). A memory's name shows for non-minor characters, the anchor, recalled and lit memories, and for every
memory once there are 40 or fewer in view or the zoom passes 1.45. Empty states use `EmptyState`: no memories; a Vault with no links ("Link memories to see them here");
a focused memory with no links ("No links yet"); both offer Link memories, which opens the editor on the memory with
Linked memories open. "Link to {subjects}" (for example "Link to Mira & Kael") appears in those empty states and in
the editor's Linked memories for a relationship whose people live only in its subject fields: it adds an `involves`
link to each person's character memory. In the Graph it saves at once through the note route; in the editor it fills
the draft and Save stores it. Timeline, Rings and Cards views are not part of this view.

### Review

Review is evidence-first. A draft can be unavailable, stale, missing its source,
invalid, superseded, or blocked by dependencies; these states remain visible
before acceptance. A card reads top to bottom: the title, a quiet meta line
("{subject} · Available everywhere / in this chat / in chosen places · from {source}", each part only when the card
has the data), an action chip naming what adding does ("Create memory", "Add to section", "Update section",
"Add link"), the evidence as one quoted line in the primary tint (or "From {source}" when the proposal carries no
quote), and an "Evidence and preview (1 evidence, 1 change)" button that opens the full evidence and the
before/after preview. Each row has one primary "Add to memory" press, with an Edit
button and a labelled Discard (icon and word) beside it; the line under them says what adding will do
("Adding creates / adds to / replaces …") before the press, and a blocked row
swaps it for the reason ("Can't add yet: an edited section is empty", "Can't add
this change: its suggestion is blocked or out of date"). A press runs the
preflight and, when every selected change is ready, adds them in the same press;
if any is blocked, nothing is added and the preflight lines stay on screen above
a batch button reading "Add selected (N)" for the ready ones. The identity-lock
reason is one visible line at the top of the queue, and the Review tab badge
counts the memories still waiting (`mutations` from the pending-count route),
not the suggestion sources. Accept and skip use preflight and report applied, skipped,
blocked, failed, and index-rebuild results separately. Re-extraction and
rejected-suggestion cleanup preserve access to relevant diagnostics. A source row's rejected
suggestions sit behind one small "N rejected" chip (at least 2.75rem tall, no box of its own) that opens a plain list with
"Clear rejected suggestions". A source row's count is the suggestions waiting in it (read as "N suggestions"); the
workbench shows no "N suggestions" or "Modes:" line. A proposed link
shows the linked memory's title ("Another memory" when it is not in the queue's context) and the relation's label
("Caused by"), never a raw relation key or note id.

### Sources

Import and refresh require a source scope and a destination scope. Source and
destination target pickers support search, pinned current targets, grouped
target kinds, keyboard selection, and explicit capacity/validation feedback.
Place pickers and the destination rail render 100 places per list or memory
group, with a Show more row for the rest. The source search waits for a pause
in typing and keeps the current rows, marked busy, until its results arrive.
Long-running source tasks expose running, completed, cancelled, partial-failure,
and failed states through the Sources navigation and workspace feedback. A
running task can be cancelled and its latest result can be revisited.
The source tabs sit at the top of the Sources card (no bar of their own) in the order Chat Messages,
Chat Summaries, Characters, Lorebooks, each with its kind icon. Sources opens on Chat Messages;
a caller that opens it for one kind (a memory's source) keeps that kind.
Sources is one column inside its card: the filters, then the list. Choosing a row opens its
preview inline, right under it, as a region the row's button owns (`aria-expanded`,
`aria-controls`); choosing the row again or pressing Esc closes it and focus returns to the row. An
imported row's region also holds what the old Details pane held (Open source memory, Review related
drafts, Re-extract, Manage source). A lorebook opens the same way, with its entries under it. Search,
chat type with Reload, the Ready / Imported status tabs and Find sources in wrap in one row above the
list. Find sources in carries its hint under the picker ("Limit imports to this chat and its related scope." or
"Search every available character, lorebook, and chat."), read with the picker, no (i). Import detail (Standard or Detailed, with a one-line hint for Detailed) closes the card.
One import bar closes every source list card and pins to the card's bottom edge while the
list scrolls. It sits after the last row (and after the Import detail panel), so it never covers
one. It reads **Import all new (n)** (flat sources, at most 100 per import), then
"Available in: This chat · Change", then one hint line ("You can choose up to 100 parts per
import."). A lorebook card carries the chip alone. The chip opens the destination picker in
place (no separate pane, nothing to open before importing), and the bar scrolls inside
itself while the picker is open. With a chat open the destination starts as that chat, so
Import all new needs no destination step. With no chat open it starts as the source being
browsed (character or persona), and when none can be derived (a source scope of All) the chip
reads "Available in: Choose". Import then stays focusable (`aria-disabled`) and its reason is
a screen-reader-only status in the bar that `aria-describedby` reads, with no warning sentence
and no second link. The picker also shows the default agent connection (the modes the memories
are available in) as its first line. Changing the destination never clears the entries you
ticked: the selection key is the source, its target and the mode filter, not the destination.
"Ready to import" starts open. The Last import panel, a Manage operation
and a finished import's result take over the card until they are closed; the last import's button
sits above the list, and a running task's progress and Cancel sit above it too.
A ready source row always shows its checkbox; ticking one starts selection (Select and Done still work). The row
also shows an avatar (initials of the chat's first character, else of the chat or source title) and one meta
line, "{who} · {n} messages · Imports as {mode}". Each part comes from what the preview and scope targets already
carry, so a part the client does not have is left out: who needs exactly one chat with that name, the count (the span of
message numbers) needs a message range, and the mode shows only on chat and message rows. A row with no part keeps its summary.
Every source list (the lorebook browser and the flat lists) uses one navigator bar
(`SourceNavigatorBar`): title and count, the Select toggle, search, Mode, Reload and the
Ready / Imported status tabs, with each list's own parts (the messages summary note,
Branch, outdated sources, the selection bar) passed in as slots. "Load more" sits under the list,
where the next rows appear, and the four Cancel buttons are one `SourceCancelButton`. The Last
import button reads "{n} source(s) · {status}".
A finished import puts its outcome first: "Done: {n} memories are waiting in Review." with a primary
"Open Review" button, and "Retry failed" beside it when some sources failed. The scope line, the
counts and each source's result sit under "Details", which is closed after a clean import and open
when anything failed, was cancelled or went missing. "Back to preview" stays visible.
The Chat Messages tab imports a chat's own messages in pieces of up to 24,000
characters, or 12,000 when the Sources Import detail is
Detailed. Each chat keeps the piece size of its first import, and a branch
never imported uses its chat's size. When the selected chat also has summaries,
it says that importing both can repeat memories in review. A chat with branches
adds a Branch menu (this branch, each other branch, All branches); it filters
the list to a branch's history, and the destination stays the whole chat.
A branch recalls the memories saved from the messages it copied, and its parent
recalls the branch's memories of those messages; a memory from a piece crossing
the fork stays with its own chat.
A branch's Chat Settings says "Remembers N from branch …" with a Show button; Show
opens the Vault on this chat's own place every time, with no filter. In that place
each inherited memory has a "From branch …" button below its title (a sibling of the
row's open button, 44px tall, named "From branch X: show only its memories"); tapping
it narrows the list to that branch and shows a bar naming it with Show all. Rows
show no chip while the bar is up, and choosing another place drops the filter.
The Extraction setting Hide remembered messages from the AI (off by default)
hides each extracted piece's messages from the chat's prompt, except the last
messages the chat's summary keeps (10 when unset). It records only the messages
it hid; turning it off or permanently deleting a piece's source note shows
those again, archiving keeps them hidden, and a message shown or hidden by hand
stays as set. A branch copies the hidden state. The next time messages from the
branch itself are imported, it takes over the copies of pieces that end within
the messages it copied, so turning Hide off or permanently deleting their source
note shows them in the branch too, and it shows again the copies of a piece that
runs past the fork (they hide again once the branch imports that piece). Until
that import, turning Hide off, deleting the source note or deleting the parent
chat leaves the branch's copies hidden, and a branch of that branch may keep a
copy hidden that its parent has shown. A piece not hidden yet whose
source note has a suggestion waiting in Review keeps its messages until
that draft is accepted, skipped or deleted; then Hide runs again for that piece
(messages already hidden stay hidden through a later re-extract; a branch
sharing the piece hides on its own next import). On an Engine without the host
call the toggle is disabled with a note.
When the unsearched first page finds imported notes whose character, lorebook
entry, chat summary or message piece no longer exists, a "Source unavailable (N)" group
above the source tabs lists them. Each row opens the memory or removes it with
its source (the usual delete confirmation); leaving a row alone keeps the
memory and lists it again on the next preview. Searching hides the group.

The Extraction tab runs in this order: Memories from chats, the Hide remembered
messages from the AI switch with a one-line hint under it (global; it says whether
remembered messages are hidden from the AI in every chat, that the latest ones always
stay, or that the setting is unavailable on this Engine), the extraction connection (each option reads "name · model", and the first option names the connection the host uses for Agents when its connection list marks one),
Prompt templates, then a closed Advanced section (model
tuning, Finish cut-off answers, AI keyword extraction and Game Mode). Prompt
templates has one active-template select per mode (Conversation, Roleplay, Game)
labeled "{mode} active template", and one Edit instructions button per mode that opens
the editor on the template that mode uses (the built-in default is read-only, with
Copy to edit). A copy made from a mode's editor (Copy to edit on its built-in default,
Duplicate of the template it uses, Create template while its editor is open) opens
and becomes that mode's active template, and the line under the list says so ("Now used
for Roleplay."). Create template with no editor open has no mode: the blank template is
selected for editing but stays unused ("Now editing …"). There is no separate editor
select.
Memory Settings has one save model for every tab: the header always shows Save and
a status word beside it ("No changes", "Unsaved changes", "Saved"); Save is
`aria-disabled` while nothing changed, any edit (a select included) enables it at once,
and Discard appears only while the form is unsaved.

Memories from chats is one select on its own row
with three choices: I add them myself (nothing is imported in the background),
Collect them, I'll review (background import, every suggestion waits in the
Review) and Save them for me (background import, low-risk suggestions are
accepted). The choice is stored as the two extraction settings
`autoImportChatSources` and `autoAcceptSafeChanges`; import off with accept on
shows as I add them myself, and the next save writes accept off. Its hint says
chats use this unless they choose otherwise, and an "After a reply" sample (a small label over the same status line, with example numbers) shows
what the choice does. Accepting low-risk suggestions covers new notes and
additions with no conflicts; rewrites, status changes, shared memories and
anything with warnings wait in Review, and a draft that mixes them
applies its safe part and keeps the rest pending. A Sources import follows the
global choice, or the chat's own choice when the import comes from one chat that
has one. Background import brings in each chat's new or changed finished message
pieces a couple of seconds after the chat's latest generation starts and never
the piece still being written, and each run is an "Imported automatically" row
in Activity. While background import is on, "Newest messages to leave for later" (0 by default) keeps back a finished
piece until that many newer messages follow it. Chat summaries are imported by hand from Sources. A selection whose import failed is not retried
until a source or the extraction connection changes.
When background import is on and has no extraction connection, Extraction shows a warning
(`StatusSurface` warning tone) with a Choose button that focuses the connection field; the same
warning appears in Chat Settings, where Choose opens Extraction with that field focused. The warning
shows only while the newest background import ended for lack
of a language model: Automatic borrows the chat's own connection, so it stays hidden until a run
actually fails, and a later run of that source that works clears it. Extraction looks at every chat's
runs; Chat Settings looks at the open chat's runs. Both read the newest 1000 import Activity rows.

### Settings and Chat Settings

Global settings and per-chat settings are distinct. Chat Settings shows whether
values inherit global defaults, disables edits when the host owns settings, and
shows last-injection loading, error, retry, and result states. Memories from this chat
picks one of the three Memories from chats choices for the open chat; it shows the global
choice with the "Default for all chats" chip until the chat has its own, then a "Use the default for all chats"
button clears it. The Engine passes only the recall keys to Chat Settings, so the panel reads
the chat's choice from `GET /chat-memories/:chatId` and writes it through the host's chat
settings change. Memories from this chat is the first field. Under it the drawer keeps one status line only for I add them myself
(`ChatMemoriesStatusLine` in `chat-memories.tsx`, shared with the "After a reply" sample): "Nothing is added on its own"
with an Import button that opens Sources. For Save them for me and Collect them, I'll review the counts moved onto the
Long-Term Memory card (part 3, below), so the drawer repeats nothing. Review and Import leave a short-lived open
request (`auto-import-status.ts`) that the detail view reads when it opens, because Chat Settings is a separate host
view. The card's lines read the chat's `GET /chat-memories/:chatId` (polled every 5 s while background import is on, so
the card refreshes without a reopen; its `reading` flag is the "reading" state and its `hidden` range the hidden
line) and the `auto_import` Activity rows, which are re-read when the reading flag, the hidden stamp or the last recall
changes, not on a timer. It keeps one short explanation above the recall controls. The Memories from this chat mode and the Recall style
describe the selected choice in place (a `<p>` under the select, joined with `aria-describedby`; the Recall style
text is the same `recall-style.ts` description Memory Settings shows), and the budget uses the Memory Settings
label ("Recall budget tokens") with the same "About N memories fit." hint. The budget is the one limit on a recall:
whole memories are added until the next would not fit, and N comes from the vault's average memory size (the status
route's `averageMemoryTokens`, 80 tokens until it is known). A memory count stored by an older version caps the
budget until a budget is saved (`ltmRecallBudgetWithLegacyCount`). Each recall field either says
"Default for all chats · value" (inherited) or shows a compact "Use the default for all chats (value)" button that
sends `null` for that key, which the host and the package resolve to the global default. The status line has its own
states: "Checking this chat's memories…" while its first reads load, and a danger line with Retry when one fails. The
Long-Term Memory card (`LastInjectionSummary.tsx`) is the first thing in the section, above the per-chat controls: the
header "Long-Term Memory" with **Open** (opens the Memory Vault; the old bottom "Open Long-Term Memory" button is gone),
then part 1, what the last reply used. It says "Used N memories" with each title listed open (no fold; a title shows
that memory's text in place, read from the note when opened, with "Open in Vault", a "memory" open request with the
note id in `auto-import-status.ts`, read once by the detail view), "No memories used · N available" (N is
`availableCount` from `/last-injection`, left out when the server does not send it), or "Memory wasn't used this reply"
when the last recall attempt was skipped, cancelled, failed or not confirmed (`attemptOverrides`). Loading shows a busy
line, a failed read shows the danger line with Retry, and a background refetch keeps the shown answer (D27). The card
shows no token counts, recalled-at time, indexed/usable/added line or "Turn on" button; Activity shows those. Part 2
is one line at most, the most serious problem with the one button that fixes it, picked by `pickCardProblem`
(`card-problem.ts`) in this order: why memory wasn't used (amber, the reason alone since part 1 already says it, with
**Details**, which opens Activity on that recall attempt through an "activity" open request, offered only when the attempt recorded an explanation, since Activity has nothing to open otherwise), "Couldn't save new
memories" (amber, with the cause in brackets when the failed import event carries a short one, and **Retry**, the
existing retry that stays hidden until a newer run fails), "Not saving new memories" (no extraction model, with
**Set up**, which opens the Extraction tab) and "N more left out to fit the limit" (neutral, with **Raise limit**,
which scrolls to and focuses the token limit for a `budget` cut or the memory count for a `lower_rank` cut, the token
limit when unsure). N counts the closest-miss rows the recall's own explanation recorded, so it can undercount, and the
line shows nothing while "Record recall explanations" is off because the response cannot tell. The old "Needs an
extraction connection" and "Couldn't read the latest messages" boxes no longer sit under the card. Part 3 (what the chat saved) sits under part 2, each line only when true, with
`data-ltm-card-saved` marking it: "N memories to review" with **Review** (the pending drafts; opens Review through a
"review" open request; Collect and Save modes), "Saved N new memories" with **View** (the chat's `auto_import` rows
applied since the last recall, `autoImportSavedSince`; View opens this chat's memories in the Vault; Save mode),
"Messages A–B saved as memories and hidden" or "Message A saved as a memory and hidden" (the import hid messages
after the last recall, `hiddenSince`; no button; it goes once a later reply has used the chat) and "Reading new
messages…" (`reading`). "Since the last recall" is the later of the last-injection `dispatchedAt` and its attempt time
(`lastRecallAt`). The hidden sentence is also a toast, once per hide, from the Engine-mounted surface
(`useHiddenMessagesToast` in `BranchHiddenTail.tsx`, a 10 s poll of the same read); it stays silent while the card is
open (`markLtmCardOpen`), because the line is on screen then. The first read of a chat only records the current hide,
so opening a chat never toasts an old one. The same card (one shared component, `ActivityCard.tsx`) is mounted by the Engine's `chat-activity` slot (Capability API 1.820, `view="activity"`) in the Agent activity panel, where it reads the same data and its buttons open the agent's own page; the panel cannot focus the drawer's limit fields, so a left-out line shows there without Raise limit. The Agent activity icon follows the same facts (`activity-signal.ts`, `setPackageActivity`, feature-detected): it spins while memory reads new messages and shows a dot when saving failed (the card's save-failed rule, so Retry clears both); recall problems, set-up and left-out never light it. The conversation surface mount (`BranchHiddenTailPopup`) publishes it all the time, including while the panel and drawer are closed, adding no poll beyond its 10 s one, and the panel card publishes it too for a mode with no surface mount (Game: the icon moves only while the panel is open there); the last mount for a chat clears the entry, because the Engine never does. The save and set-up lines come from the import events and extraction settings, so they still show when the last-recall read fails or loads; only the recall and left-out lines wait for it. While the global
defaults have not arrived, an
inherited value shows "Loading default…" (or "Default unavailable" after a
failed load) instead of an invented number, and the controls stay usable. Memory Settings
opens with its heading, the subtitle and one reassurance line ("Most users can keep the recommended defaults · Reset to defaults"; the link resets the settings after a host confirmation and keeps memories, and focus returns to it once the forms reload), then has Recall and Extraction tabs and, below them, a closed Troubleshooting section; Recall starts with "Global Recall" and its line ("Defaults used by every chat unless that chat overrides them.", no (i)); its group headings (Budget, Ranking, Sharing and the headings inside Advanced and Troubleshooting) are one sentence-case heading level under the card title, and every control's guidance is a muted hint under it (the weights, threshold, maximum memories, recent messages, context instructions, stop words, Reasoning effort, Verbosity, the extraction numbers and switches, the prompt-template pickers and the chat drawer's two fields), with no (i) in Recall, Extraction or the drawer card; one spacing step separates a hint from the next label; Advanced, Extraction's Advanced and Troubleshooting are full-width disclosure rows with a chevron that turns when open (`DisclosureSummary` in `settings/settings-shared.tsx`), Advanced inside a bordered box; Recall shows Budget (a "tokens" suffix beside the field and, under it, a live "About N memories fit" hint, N = budget ÷ 500 tokens capped at the maximum memories, then the range, 128 to 16384; no (i)), Ranking (the style with its description in place and a Linked memories switch with its hint under the label, no (i), which is the Linked memories match weight at 0 or its preset value) and Sharing (one table with a row per Agent: its name with what it used this week under it, counted from the activity log; a "Can read" switch; a "Can add" switch, or "Not offered" for an Agent that cannot add, which today is every Agent but Slurp; and a remove button. "Add Agent" lists the installed Agents this version knows that are not in the table, and a new row can read but not add. Rows are part of the form and need Save; the group is headed "Other Agents", "Can add" has a hint saying what it does, and turning on Slurp's read or add asks right then whether to turn on the matching switch in Slurp, applying a yes only after Save succeeds; Discard drops it), then a closed Advanced section (Matching and limits, then Memory wording) holding the threshold, maximum memories, recent messages, include resolved, context instructions and stop words. The four weights show only while the style is Custom, in Ranking under the style (Meaning match, Exact words match, Linked memories match, Stored keywords match, the same names the Activity view uses); choosing Custom reveals them with the last preset's values, and the Linked memories switch flips the style to Custom the same way. Ranking shows "Custom (edited weights)" with a Reset to preset button beside the style once the style is Custom (the button returns to the last named style; a form saved as Custom names the preset its weights are closest to, Balanced for untouched weights, so Save and a reload agree); Recall's Advanced section no longer holds Record recall explanations (it lives on the Activity page). Troubleshooting holds Setup and tour (Run setup again, Take the tour), then Delete (Delete all data
in destructive tone; Delete all first offers "Export a backup first", then the host
confirmation). Sources holds Import detail (Standard or Detailed) at the bottom of its card; it saves on its own. Unsaved edits show a dot on the tab that holds them
(spoken as "unsaved changes"); the header row with Save, its status word and Discard sticks to the top of the
scrolling form while anything is unsaved. Identity repair lives in Review (see "Review: same person and Skipped").
Inline success messages (`StatusSurface` with the success tone) use the `--ltm-success` token (the accent mixed toward
the editor text, measured at no less than 10.0:1 in the light and 9.1:1 in the dark default theme) and a check
icon, never the bare accent color.
**Results are toasts.** A finished action and its retryable failure show as an Engine toast (`toast` from `sonner`; the
Engine mounts the one `<Toaster>`, the package never mounts one or styles `[data-sonner-toaster]`): `toast.success` for
done (saved, deleted, exported, imported, reset, copied, applied), `toast.error` for a failure the writer can retry, and
`toast.warning` (12 seconds) for "saved, but" results such as a deferred recall rebuild and for partial results (a batch
that only partly applied). Archive is a success toast with an
Undo action that stays 10 seconds; a failed Undo rolls back and the failure toast offers Undo again, and a new batch or a
change of place dismisses a stale Undo. The host announces a toast once, so the package keeps no hidden live copy
(`LiveResult` is gone). A toast outlives its render, so the callbacks behind it read refs for busy locks. When the control
that had focus leaves (a batch bar, an Undo button, a closed panel), focus lands on a control that is still mounted (the
vault search field, the panel's Close button, the review queue, the workbench heading), never `<body>`. These stay inline:
field and form validation, the rename dialog, load errors with Retry, guidance text, the Restore preview, the Vault Fix bar
and integrity status, busy surfaces, the editor's save status word, empty states, blocking reasons, and a
Review run that needs attention (failed, blocked or with messages, which holds Retry failed and Review failed) with the
per-memory results of the source workbench. Loading placeholders and spinners carry `motion-reduce:animate-none`. Counts use the One/Other catalog keys with
`selectLtmPluralForm`, name lists go through `Intl.ListFormat`, and stored codes map to catalog labels instead of
`replaceAll("_", " ")`. Add section refuses an empty key (a name with no letters A-Z or numbers) or a duplicate on
the name field itself: the reason is linked with `aria-describedby` and focus returns to the field.

Activity log operation details lead with recorded problems and guidance, then extraction,
recall, or apply outcomes before diagnostic facts and the timeline. Dropped
candidates are grouped by reason with optional quotes and honest truncation counts.
Recall shows recorded settings, with relevance and its minimum on the same percentage
scale. A pending source draft can open the existing Review through the shell's
navigation guard. Missing outcome data is not reconstructed; raw response snippets
remain available only through Copy JSON, never on screen.

## State Rules

Keep these states distinct in UI changes:

- loading versus empty
- unfiltered empty versus filtered empty
- request failure versus partial success
- stale, missing, invalid, superseded, and invalidated source evidence
- blocked mutation versus failed mutation
- unsaved changes versus saved navigation
- index building, degraded, stale, corrupt, and failed health
- status load failed (Retry beside the error, no health pill)
- lexical-recall-only warning (one slim line, its own Reindex now button, reachable by keyboard, no (i))
- source task running, cancelled, completed, and completed with failures

A control that starts work stays focusable while the work runs: spread
`lockedActionProps(locked, reasonId?)` from `shared-controls.tsx` (`aria-disabled`, plus
`aria-describedby` for a reason line; `Button` and `IconButton` dim on `aria-disabled`
themselves) and make its handler return early, because Enter and Space still fire
`onClick` and a submit button still submits (see the activation chip's Turn on and Turn off, Reindex, Chat
Settings, Troubleshooting and the activity log toolbar). The same holds in the Vault and Review:
availability Save and Cancel, the rename dialog, and the Review source, re-extract,
clear-rejected, Retry and delete controls stay focusable while they run. While identity
edits are unsaved, the source select, rejected count, re-extract and clear-rejected share
one linked reason ("Review buttons wait until you save or discard your identity choices."), and a stale or blocked change
names why Add to memory is unavailable on its row, even when the row is collapsed. In Sources a running task of
any kind holds one lock: Import, Refresh, Re-extract (rows, inspector and Retry), the source
picker and the Manage operations stay focusable, point at the always-mounted lock line ("Locked while an
import runs" or "...a re-extract runs"), and send nothing on Enter. Native `disabled` is for permanent
unavailability, such as a host that owns the setting, or input validity such as an empty
name or nothing selected, because it drops keyboard focus.

Every failure state needs its existing retry or recovery path where one exists.
Status and alert semantics, focus behavior, touch targets, labels, and reduced
motion follow `DESIGN.md`; do not create a second UI policy here.

## Change Routing and Proof

Start with the narrowest owner:

- Shell, navigation, dirty state: `LongTermMemoryDetail.tsx`, `LongTermMemoryNavigation.tsx`
- Setup and tour: `Onboarding.tsx` (beats), `onboarding/Tour.tsx` and `onboarding/tour-stops.ts` (tour), `onboarding/progress.ts` (saved beat), `onboarding/Sprite.tsx`
- Workspace layout or pane behavior: `LtmWorkspace.tsx`, then `DESIGN.md`
- Vault behavior: `vault/MemoryVault.tsx`
- Review behavior: `review/ReviewQueue.tsx`, `review/IdentityRepairItem.tsx`, `review/SkippedSuggestions.tsx`, `review/review-state.ts`
- Source import and task behavior: `sources/SourcesWorkspace.tsx`, `source-task.ts`
- Settings, troubleshooting or activity: `settings/MemorySettings.tsx`, `settings/TroubleshootingPanel.tsx`, `settings/ActivityPage.tsx`, `settings/ActivityView.tsx`, `ChatSettings.tsx`
- Shared controls or feedback: `shared-controls.tsx`

Use the narrowest matching regression from `tests/README.md`: loading for
deferred discovery, feedback-clarity for static UI contracts, browser for
interactive workflows, and lifecycle when the exact installed artifact is
part of the claim.

## Review: same person and Skipped

Above the source list, Review shows two blocks that hide when empty. "Same person? (N)" lists duplicate trusted
identities, each with Merge and Keep both. Merge opens the real identity-repair preview for that pair (canonical
memory, duplicates to include, content to add, section conflicts) and applies it behind the host confirmation;
"Preview identity repairs" opens the same preview for every pair still offered. A merged repair says a backup was
saved first, with no folder path. The server has no "dismiss" for a pair, so Keep both is stored on this device
only (`localStorage` key `ltm-identity-keep-both`, newest 200 candidate ids) and a one-line hint says so; a pair that
changes gets a new id and is offered again. "Skipped (N)" is a chip at the top right of the Review heading row (above the list when the queue is hidden) that opens and
closes a list of every suggestion the extraction left out,
with the reason the server stored for it (the same text as a source's "N rejected" list), the source note, Add anyway
(the same recovery as Recover manually) and Open source.
