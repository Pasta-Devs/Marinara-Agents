# Long-Term Memory UI

This is the client behavior map. Use it for changes to screens, navigation,
loading, editing, review, onboarding, or chat settings. Use `DESIGN.md` for
visual and accessibility rules, and `ARCHITECTURE.md` for server and data flow.

## Surface Map

`LongTermMemoryDetail.tsx` owns the capability shell, destination changes,
onboarding, activation, vault-health feedback, recovery handoffs, and dirty
navigation guards. Its destinations are lazy-loaded:

| Surface | Owner | User task |
| --- | --- | --- |
| Memory Vault | `MemoryVault.tsx` | Browse, search, filter, edit, link, archive, restore, and manage memory availability. |
| Review Queue | `ReviewQueue.tsx` | Inspect evidence, edit or preflight proposed mutations, then accept or skip them. |
| Sources | `SourcesWorkspace.tsx` | Select source and destination scopes; import, refresh, re-extract, cancel, and inspect source results. |
| Memory Settings | `MemorySettings.tsx` | Configure extraction and retention, repair indexes or identities, and inspect activity. |
| Chat Settings | `ChatSettings.tsx` | Set per-chat recall style, token budget, and maximum memories; inspect the last injection. |

`LongTermMemoryNavigation.tsx` owns the four destination buttons and their
memory, review, and source-task status badges. `ActivityView.tsx` is opened
from Memory Settings rather than being a fifth destination.

## Navigation Contract

The shell keeps destination state in `LongTermMemoryDetail`. Destination
changes first resolve unsaved work:

```text
clean surface -> destination changes
dirty surface -> save / discard / stay decision -> destination changes or remains
```

Opening a memory, review item, source target, activity view, or the Agents
panel uses the same guard. A successful navigation clears the relevant stale
selection and closes transient menus. Save and discard decisions restore focus
to the control that initiated navigation.

On first successful status load, onboarding opens for an empty vault. Its step
is stored in local storage; closing it suspends at the current step, while
completion records `complete`. Opening related chat settings or prompt editors
suspends onboarding rather than completing it.

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

## Workflow Contracts

### Memory Vault

The navigator resolves scope targets before loading notes. Search, status,
source-only, and sort filters apply to the visible note list; clearing filters
does not change the selected scope. The workbench distinguishes read-only
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
Long-running source tasks expose running, completed, cancelled, partial-failure,
and failed states through the Sources navigation and workspace feedback. A
running task can be cancelled and its latest result can be revisited.

### Settings and Chat Settings

Global settings and per-chat settings are distinct. Chat Settings shows whether
values inherit global defaults, disables edits when the host owns settings, and
shows last-injection loading, error, retry, and result states. Memory Settings
groups extraction, retention, maintenance, identity repair, and activity; repair
actions report their result without hiding vault-health warnings.

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
- source task running, cancelled, completed, and completed with failures

Every failure state needs its existing retry or recovery path where one exists.
Status and alert semantics, focus behavior, touch targets, labels, and reduced
motion follow `DESIGN.md`; do not create a second UI policy here.

## Change Routing and Proof

Start with the narrowest owner:

- Shell, navigation, onboarding, dirty state: `LongTermMemoryDetail.tsx`, `LongTermMemoryNavigation.tsx`
- Workspace layout or pane behavior: `LtmWorkspace.tsx`, then `DESIGN.md`
- Vault behavior: `MemoryVault.tsx`
- Review behavior: `ReviewQueue.tsx`
- Source import and task behavior: `SourcesWorkspace.tsx`, `source-task.ts`
- Settings or activity: `MemorySettings.tsx`, `ActivityView.tsx`, `ChatSettings.tsx`
- Shared controls or feedback: `shared-controls.tsx`

Use the narrowest matching regression from `tests/README.md`: loading for
deferred discovery, feedback-clarity for static UI contracts, browser for
interactive workflows, and lifecycle when the exact installed artifact is
part of the claim.
