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
container. The Vault and Debug lists cap at the window height minus `12rem`
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

### Settings and Chat Settings

Global settings and per-chat settings are distinct. Chat Settings shows whether
values inherit global defaults, disables edits when the host owns settings, and
shows last-injection loading, error, retry, and result states. It keeps one short
explanation above the controls; the Recall style info popover lists every style
and marks the current one. While the global defaults have not arrived, an
inherited value shows "Loading default…" (or "Default unavailable" after a
failed load) instead of an invented number, and the controls stay usable. Memory Settings
has Recall, Extraction, Maintenance, and Debug tabs; Recall is grouped under Budget, Ranking, Text filters, and
Sharing headings, names the four weights in plain words (Meaning match, Exact words match, Linked memories
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

A control that starts work stays focusable while the work runs: use `aria-disabled`,
`opacity-50` and a ref guard that makes its handler return early (see
`navigationBusyProps`, the activation switch, Reindex and Chat Settings). Native
`disabled` is for permanent unavailability, such as a host that owns the setting,
because it drops keyboard focus.

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
