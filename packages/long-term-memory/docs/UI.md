# Long-Term Memory UI

This is the client behavior map. Use it for changes to screens, navigation,
loading, editing, review, onboarding, or chat settings. Use `DESIGN.md` for
visual and accessibility rules, and `ARCHITECTURE.md` for server and data flow.

## Surface Map

`LongTermMemoryDetail.tsx` owns the capability shell, destination changes,
activation, vault-health feedback, recovery handoffs, and dirty navigation
guards; `Onboarding.tsx` owns the setup guide. The shell's four destinations and
the separate Chat Settings entry:

| Surface | Owner | User task |
| --- | --- | --- |
| Memory Vault | `vault/MemoryVault.tsx` | Browse, search, filter, edit, link, archive, restore, and manage memory availability. |
| Review Queue | `review/ReviewQueue.tsx` | Inspect evidence, edit or preflight proposed mutations, then accept or skip them. |
| Sources | `sources/SourcesWorkspace.tsx` | Select source and destination scopes; import, refresh, re-extract, cancel, and inspect source results. |
| Memory Settings | `settings/MemorySettings.tsx` | Configure recall and extraction, run maintenance (index and identity repair, backup, reset, delete all data), and inspect activity. |
| Chat Settings | `ChatSettings.tsx` | Set per-chat recall style, token budget, and maximum memories; inspect the last injection. |

Each screen lives in its own folder (`vault/`, `review/`, `sources/`, `settings/`)
with the components cut out of it; modules shared across screens stay at the
feature root.

`LongTermMemoryNavigation.tsx` owns the four destination buttons and their
memory, review, and source-task status badges. `settings/ActivityView.tsx` is the
Debug tab of Memory Settings rather than a fifth destination.

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

On first successful status load, onboarding opens for an empty vault. Its step
is stored in local storage. The full guide shows on the Memory Vault only; on
every other destination it is a one-line bar (`Setup guide · step N of 7`) with
Resume, which returns to the Vault at the saved step, and Dismiss. Not now and
Dismiss keep the saved step, so the guide returns at that step on the next
visit; Don't show again and the last step's Done record `complete`. The Help
button replays the guide from step 1 and goes to the Vault first. A step button
that opens another screen, a related chat setting or a prompt editor suspends
onboarding at the current step into the bar rather than completing it; steps
that open Sources use the source type chosen in step 4.

## Responsive Contract

`LtmWorkspace` uses container width, not viewport width:

| Container width | Workspace |
| --- | --- |
| `<48rem` | One pane at a time with a pane tab rail. |
| `48rem` to `<72rem` with an inspector | Navigator stays visible; workbench and inspector switch in the second column. |
| `>=72rem` with an inspector | Navigator, workbench, and inspector are visible as three columns. |
| `>=48rem` without an inspector | Navigator and workbench are visible; pane tabs are hidden. |

Pane state belongs to each destination. Pane tabs use `ArrowLeft`, `ArrowRight`,
`Home`, and `End`; changing panes moves focus to the selected pane control.
Disabled panes are excluded from the tab sequence. The destination rail becomes
the mobile bottom navigation; reduced-motion behavior is defined in `DESIGN.md`.

Layout inside a destination also follows container width, so a narrow panel on
a wide window gets the phone layout. Below `48rem` of workspace, Vault and Sources
row actions collapse into a menu, the Review batch bar and the Sources lorebook
bar stick to the top while rows scroll, and the flat source bar sticks to the
bottom; from `48rem` they sit in the flow. Review rows never use a menu: their
commit control shows the text "Check", then "Apply" once the check passes,
from `40rem`, and below it keeps the icon with a Ready or Blocked chip under
it. Review also widens its fields and padding from `40rem`. Review draws one progress line, in the
navigator below `48rem` and in the workbench from it, and puts the run summary at the top of the
workbench while rows are listed (above the pane tabs once the queue is empty), as a warning while a
change is ready to apply. The Sources scope row stacks until
its destination container reaches `40rem`. Vault note title and status share a
row from a `28rem` workbench, and the Vault list scrolls on its own from `48rem`.
Memory Settings puts its four section tabs, its recall field pairs, its three
active-template pickers and its activity detail pairs in one row from a `40rem`
settings container. The header's add action keeps its `2.75rem` target and drops
its label, and the Vault health pill hides, below `48rem` of the detail surface;
the health pill's detail text appears from `40rem`. Below `48rem` the header
tightens its gaps and padding and the activation switch keeps a `3rem` minimum
width; below `22.5rem` it also hides the icon tile. The setup guide pads more
from `40rem` and puts its illustration beside the text from `48rem` of its own
container, which also picks the setup guide's sprite (the phone sprite below
`48rem`, the wide one from it, both at whole-pixel scale). The detail header's
icon shrinks and the content padding drops to `1rem` below `48rem` of the detail
container, not of the window. The destination tabs, the availability tabs and
their rows keep `2.75rem` against the Engine's `2.25rem` tab height. Chat
Settings keeps the host drawer's own control sizes as named exceptions: the
recall-style select (`min-h-8`) and the number fields (`compactInputClass`,
`min-h-9`) match the drawer's neighbouring fields, and the compact Retry
(`min-h-7`) matches its action floor. The Vault and Debug lists cap at the window height minus `12rem`
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
navigator leads with the place, search, Show and Sort controls; a second place
and the available-modes filter sit under a Refine disclosure that is closed by
default, opens by itself while either is set, and names what is active when
closed. With memories checked, the bulk rail is Edit selected…, then Archive and
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
The open memory's row carries the primary wash, a left-edge bar and
`aria-current="true"` on its button, so it is marked beyond colour.
The memory's side panel is called Memory info wherever it opens: the toggle in the
memory header (`aria-pressed`, no `aria-label`, so its accessible name is its visible
label) and the narrow-layout pane tab. Its first section is named for what it holds,
Keywords and links.
The workbench distinguishes read-only
source notes from editable memories and keeps validation, evidence, freshness,
confidence, subjects, links, keywords, and availability visible as applicable.
Archive supports undo. Destructive actions and navigation away from edits use
explicit confirmation.

### Review Queue

Review is evidence-first. A draft can be unavailable, stale, missing its source,
invalid, superseded, or blocked by dependencies; these states remain visible
before acceptance. Accept and skip use preflight and report applied, skipped,
blocked, failed, and index-rebuild results separately. Re-extraction and
rejected-suggestion cleanup preserve access to relevant diagnostics.

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
The Chat Messages tab imports a chat's own messages in pieces of up to 24,000
characters; when the selected chat also has summaries, it says that importing
both can repeat memories in review. A chat with branches adds a Branch menu
(this branch, each other branch, All branches); it filters the list to a
branch's history, and the destination stays the whole chat.
When the unsearched first page finds imported notes whose character, lorebook
entry, chat summary or message piece no longer exists, a "Source gone (N)" group
above the source tabs lists them. Each row opens the memory or removes it with
its source (the usual delete confirmation); leaving a row alone keeps the
memory and lists it again on the next preview. Searching hides the group.

### Settings and Chat Settings

Global settings and per-chat settings are distinct. Chat Settings shows whether
values inherit global defaults, disables edits when the host owns settings, and
shows last-injection loading, error, retry, and result states. It keeps one short
explanation above the controls; the Recall style info popover lists every style
and marks the current one. While the global defaults have not arrived, an
inherited value shows "Loading default…" (or "Default unavailable" after a
failed load) instead of an invented number, and the controls stay usable. Memory Settings
has Recall, Extraction, Maintenance, and Debug tabs; Recall is grouped under Budget, Ranking, Text filters, and
Sharing headings (Sharing lists the Agents that read memories in a table of last read, reads this week and memories returned this week, counted from the Debug activity log), names the four weights in plain words (Meaning match, Exact words match, Linked memories
match, Stored keywords match; the help keeps "graph weight" and "keyword weight"), and shows "Custom (edited
weights)" with a Reset to preset button beside the style once an edited weight has flipped it to Custom (the
button returns to the last named style, Balanced if none); Maintenance holds Backup (export, choose backup), Repair (integrity, selected repairs;
identity repair follows as its own section), and Delete or reset (Reset settings in warning tone, Delete all data
in destructive tone; Delete all first offers "Export a backup first", then the host
confirmation), and Debug is the activity view. Repair actions
report their result without hiding vault-health warnings. Unsaved edits show a dot on the tab that holds them
(spoken as "unsaved changes") and keep Save and Discard in a header row that sticks to the top of the scrolling
form. A finished identity repair names the backup it saved first (the first eight characters of its id, in the
`long-term-memory-identity-repairs` backups folder); there is no restore button, so restoring is manual.
Success messages (`StatusSurface` with the success tone) use the `--ltm-success` token (the accent mixed toward
the editor text, measured at no less than 10.0:1 in the light and 9.1:1 in the dark default theme) and a check
icon, never the bare accent color.
A result that appears after an action (Debug export and clear, each Maintenance group, the source workbench preview
summary and run result) is read out from a region that is always mounted: `LiveResult` keeps a hidden `role="status"` copy in the
page and shows the visible `StatusSurface` without its own live role, so one action speaks once (a failure is read politely, not as an alert). A live region that
mounts together with its text is often not announced. Loading placeholders and spinners carry `motion-reduce:animate-none`. Counts use the One/Other catalog keys with
`selectLtmPluralForm`, name lists go through `Intl.ListFormat`, and stored codes map to catalog labels instead of
`replaceAll("_", " ")`. Add section refuses an empty key (a name with no letters A-Z or numbers) or a duplicate on
the name field itself: the reason is linked with `aria-describedby` and focus returns to the field.

Debug operation details lead with recorded problems and guidance, then extraction,
recall, or apply outcomes before diagnostic facts and the timeline. Dropped
candidates are grouped by reason with optional quotes and honest truncation counts.
Recall shows recorded settings, with relevance and its minimum on the same percentage
scale. A pending source draft can open the existing Review Queue through the shell's
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
- status load failed (Retry beside the error, no health pill; the setup guide waits for a read that succeeds, because the vault count is unknown)
- lexical-recall-only warning (its own Reindex recall button, reachable by keyboard)
- source task running, cancelled, completed, and completed with failures

A control that starts work stays focusable while the work runs: spread
`lockedActionProps(locked, reasonId?)` from `shared-controls.tsx` (`aria-disabled`, plus
`aria-describedby` for a reason line; `Button` and `IconButton` dim on `aria-disabled`
themselves) and make its handler return early, because Enter and Space still fire
`onClick` and a submit button still submits (see the activation switch, Reindex, Chat
Settings, Maintenance and the Debug toolbar). The same holds in the Vault and Review:
availability Save and Cancel, the rename dialog, and the Review source, re-extract,
clear-rejected, Retry and delete controls stay focusable while they run. While identity
edits are unsaved, the source select, rejected count, re-extract and clear-rejected share
one linked reason ("Save or discard identity edits first."), and a stale or blocked change
names why Apply is unavailable on its row, even when the row is collapsed. In Sources a running task of
any kind holds one lock: Import, Refresh, Re-import, Re-extract (rows, inspector and Retry), the source
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
- Setup guide: `Onboarding.tsx`
- Workspace layout or pane behavior: `LtmWorkspace.tsx`, then `DESIGN.md`
- Vault behavior: `vault/MemoryVault.tsx`
- Review behavior: `review/ReviewQueue.tsx`, `review/review-state.ts`
- Source import and task behavior: `sources/SourcesWorkspace.tsx`, `source-task.ts`
- Settings, maintenance or activity: `settings/MemorySettings.tsx`, `settings/MaintenancePanel.tsx`, `settings/ActivityView.tsx`, `ChatSettings.tsx`
- Shared controls or feedback: `shared-controls.tsx`

Use the narrowest matching regression from `tests/README.md`: loading for
deferred discovery, feedback-clarity for static UI contracts, browser for
interactive workflows, and lifecycle when the exact installed artifact is
part of the claim.
