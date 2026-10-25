---
name: Long-Term Memory Client Workspace
description: Evidence-led workstation for importing, reviewing, editing, and maintaining durable memory.
colors:
  primary: "var(--primary)"
  muted-foreground: "var(--muted-foreground)"
  editor-bg: "var(--marinara-editor-bg)"
  editor-text: "var(--marinara-editor-text)"
  editor-muted: "var(--marinara-editor-muted)"
  editor-accent: "var(--marinara-editor-accent)"
  editor-border-strong: "var(--marinara-editor-border-strong)"
  editor-divider: "var(--marinara-editor-divider)"
  editor-control-bg: "var(--marinara-editor-control-bg)"
  foreground: "var(--foreground)"
  background: "var(--background)"
  border: "var(--border)"
  secondary: "var(--secondary)"
  accent: "var(--accent)"
  destructive: "var(--destructive)"
  ring: "var(--ring)"
typography:
  title:
    fontFamily: "inherit"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "inherit"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "inherit"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  micro-label:
    fontFamily: "inherit"
    fontSize: "0.6875rem"
    fontWeight: 400
  micro-label-compact:
    fontFamily: "inherit"
    fontSize: "0.625rem"
    fontWeight: 500
  host-compact:
    fontFamily: "inherit"
    fontSize: "0.5625rem"
    fontWeight: 400
  host-compact-note:
    fontFamily: "inherit"
    fontSize: "0.59375rem"
    fontWeight: 400
    lineHeight: 1.375
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.5rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
components:
  primary-action:
    backgroundColor: "{colors.editor-accent}"
    textColor: "{colors.editor-bg}"
    rounded: "{rounded.md}"
    padding: "0.75rem"
    height: "2.75rem"
  editor-field:
    backgroundColor: "{colors.editor-control-bg}"
    textColor: "{colors.editor-text}"
    rounded: "{rounded.md}"
    padding: "0.75rem"
    height: "2.75rem"
  workspace-tab:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  status-surface:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.editor-muted}"
    rounded: "{rounded.md}"
    padding: "0.75rem"
---

# Design System: Long-Term Memory Client Workspace

## Overview

**Creative North Star: "The Evidence-Led Workstation"**

Long-Term Memory is an Operate-mode capability inside Marinara Engine. Its visual language is inherited editor chrome: neutral, compact, state-aware, and designed to help a contributor move from source material to a trustworthy saved memory without losing context. The interface favors clear labels, small status signals, grouped records, and explicit confirmation over decorative treatment.

The workspace is a responsive three-pane workstation rather than a single settings form. Memory Vault, Review Queue, and Lorebook browsing place selection and navigation in a navigator, the active record or proposed change in a workbench, and metadata, diagnostics, or extraction detail in an inspector. On narrow containers, the panes become keyboard-accessible tabs; the task stays the same while the spatial model collapses.

**Key Characteristics:**
- Evidence-led and operational, not promotional or gamified.
- Tonal panels, dividers, and compact labels carry hierarchy.
- Accents are reserved for active, successful, recommended, or actionable states.
- Every asynchronous, destructive, or diagnostic state is surfaced in the same workspace vocabulary.

## Colors

The palette is inherited from Marinara editor variables and neutral Engine surface variables. Use semantic variables rather than literal colors so the workspace remains correct across Engine themes.

### Primary
- **Editor Accent** (`var(--marinara-editor-accent)`): Primary actions, healthy-state indicators, recommended import paths, and successful status text.
- **Engine Primary** (`var(--primary)`): Inline text links (small semibold, underlined with offset), checkbox accents, and a `10%`-opacity wash marking the selected row in navigator and review lists. The open Vault row adds a left-edge bar in the same color and `aria-current="true"`, so the mark is not tint alone.
- **Destructive** (`var(--destructive)`): Permanent deletion, failed operations, validation errors, and blocked review changes.

### Secondary
- **Strong Editor Border** (`var(--marinara-editor-border-strong)`): The warning treatment's border. No Engine theme defines a warning color, so degraded, stale, incomplete, or attention-needed states that are not fatal show a warning icon, editor text, and this border instead of a hue.

### Neutral
- **Editor Background** (`var(--marinara-editor-bg)`): The capability shell and sticky mobile navigation background.
- **Editor Text** (`var(--marinara-editor-text)`): High-emphasis titles and controls inside editor chrome.
- **Editor Muted** (`var(--marinara-editor-muted)`): Supporting copy, metadata, timestamps, and secondary status text.
- **Editor Divider** (`var(--marinara-editor-divider)`): Header separators, list rows, panel sections, and mobile navigation boundaries.
- **Background** (`var(--background)`): The neutral content surface used by nested Engine controls.
- **Border** (`var(--border)`): Default field, panel, tab, and dialog outlines.
- **Secondary Surface** (`var(--secondary)`): Low-contrast grouping fills, badges, filter rails, and list headers.
- **Accent Surface** (`var(--accent)`): Hover, pressed-tab, and inherited-setting backgrounds; the persistent selected-row wash uses the primary tint instead.
- **Muted Foreground** (`var(--muted-foreground)`): The default de-emphasis color — supporting form copy, metadata, timestamps, inactive tab text, and secondary descriptions. It is the most-used color in the workspace.
- **Control Background** (`var(--marinara-editor-control-bg)`): Editor inputs and switches.
- **Focus Ring** (`var(--ring)`): Keyboard focus treatment for fields and controls.

**The Semantic State Rule.** Never encode a state with color alone. Pair accent or destructive color with a text label, status surface, badge, or icon. A warning has no color of its own: a status surface carries the warning icon, and a warning chip the strong editor border with its text label.

## Typography

**Display Font:** Inherit the Marinara Engine application font stack.
**Body Font:** Inherit the Marinara Engine application font stack.
**Label/Mono Font:** No separate label or mono face is established in this client surface.

**Character:** Dense, plainspoken, and scannable. Type hierarchy comes from weight, size, truncation, muted metadata, and spacing rather than display typography.

### Hierarchy
- **Title** (600, `1rem`, `1.25`): Workspace headers, selected source titles, and prominent record names.
- **Body** (400, `0.875rem`, `1.5`): Editable memory content, descriptions, and explanatory copy.
- **Label** (600, `0.75rem`, `1.25`): Form labels, tabs, actions, statuses, and operational metadata.
- **Micro-label** (`micro-label`, 400-600, `0.6875rem`; `micro-label-compact`, 500-600, `0.625rem`; line height inherited): Badges, inherited-setting markers, timestamps, confidence, and compact status counts.
- **Host-compact** (`host-compact`, 400-500, `0.5625rem`; `host-compact-note`, 400, `0.59375rem`, `1.375`): Chat Settings hints, badges, and notes, beside `micro-label-compact`. They follow the Engine's chat settings drawer, which uses `0.5625rem` for hints and badges; raising them is a design call for the critique, not a defect.

Onboarding uses definition lists for vocabulary, unordered lists for parallel options or consequences, ordered lists for required procedures, and separate paragraphs for caveats or recommendations. This formatting reflows inside the existing `65ch` measure without changing the text box, grid, panel width, or the dense workspace type roles.

**The Truncation Rule.** Long titles and summaries may truncate in navigation rows, but the surrounding control must expose the full subject through its accessible name or the workbench detail view.

## Layout

The top-level detail surface uses a full-height editor shell with a header, wide content region, and a sticky bottom navigation rail on small containers. The main content is capped at `90rem` and uses a generous `1.25rem` section rhythm (`space-y-5`) with tighter `0.75rem` to `1rem` internal gaps.

`LtmWorkspace` is the canonical spatial primitive. At less than `48rem` container width, panes are presented one at a time with a tab rail. From `48rem` to just below `72rem`, the navigator remains visible while workbench and inspector share the second column and switch through a top tab rail. At `72rem` and wider, the layout is three columns: navigator `17rem` to `20rem`, flexible workbench, and inspector `16rem` to `22rem`.

Memory Vault and Review Queue use navigator/workbench/inspector slots. Lorebook browsing uses the same pattern with a book navigator and entry workbench. Sources and settings use tab rails for source types, availability states, or settings groups. The source scope row stacks its label above the place picker below `40rem` of the destination container and sits in one row, with the picker capped at `36rem`, from `40rem`.

On mobile, controls retain a minimum touch target of `2.75rem` (`min-h-11`); the four-item destination navigation becomes a full-width four-column rail with `min-h-14` items. Desktop-only inline row actions become explicit overflow actions on mobile. Respect `prefers-reduced-motion` by disabling smooth scrolling, transitions, and animations.

## Elevation & Depth

The workspace uses inherited editor chrome with tonal layering and dividers as the default depth model. `mari-editor-panel` provides the primary container treatment; `mari-editor-panel--soft` marks secondary or informational surfaces. Borders and section separators explain structure at rest. Shadows are reserved for transient overlays such as info popovers, add menus, dialogs, and sticky batch action surfaces.

**The Flat-By-Default Rule.** Do not add card shadows, gradients, glass effects, or decorative elevation to ordinary workspace panels. Use the existing panel variant and Engine theme variables; elevate only an element that floats above the document or needs urgent interaction priority.

## Shapes

The form language is compact and gently rounded. Rails and primary panels use approximately `0.5rem` corners (`rounded-lg`); fields, buttons, row controls, and nested sections use approximately `0.375rem` to `0.5rem` (`rounded-md` to `rounded-lg`). Status, freshness, disposition, type, and dependency markers use pill silhouettes (`rounded-full`) when they behave as compact classifications.

Use borders to define interactive or nested regions without boxing every text block. List rows are separated by dividers; nested memory sections and dialogs use a border plus the inherited surface background. Avoid ornamental shapes and avoid changing corner language per destination.

## Components

### Buttons
- **Character:** Tactile, compact controls for explicit operations.
- **Primary:** `mari-editor-action mari-editor-action--primary`; minimum height `2.75rem`, horizontal padding around `0.75rem`, and editor accent treatment. Use for the next constructive action: save, import, accept, apply, or preview.
- **Default:** `mari-editor-action`; use for navigation, refresh, secondary edits, and dismissal.
- **Destructive:** `mari-editor-action mari-editor-action--danger`; use for permanent deletion, skip, clear, abort, and a reset that discards memories. Keep the label explicit.
- **Reset to defaults (warning):** `mari-editor-action` with the strong editor border set inline and a warning icon; use for a reversible-by-hand reset that discards custom values but no memories, such as Reset settings. It sits beside, never inside, the destructive group.
- **Icon buttons:** `mari-editor-action` with a fixed `2.75rem` square, a visible accessible label, and a tooltip/title where appropriate.
- **Hover / Focus:** Use the inherited tab/action state, `var(--ring)` or `var(--marinara-editor-focus-ring)` for visible keyboard focus, and no custom motion beyond the existing transition vocabulary.

### Inputs / Fields
- **Style:** `mari-editor-field`, full width, minimum height `2.75rem`, horizontal padding `0.75rem`, and inherited control/background variables.
- **Labels:** Small semibold or medium labels sit above fields and use `var(--muted-foreground)` for supporting form copy.
- **Focus:** A visible `2px` focus ring using `var(--ring)` or the editor focus-ring variable.
- **Numeric fields:** Commit on blur or Enter, clamp to the declared range, and restore invalid or empty text rather than leaving an ambiguous value.
- **Textareas:** Preserve the same field treatment; use enough height for evidence and prompts, with a maximum readable line length where copy is explanatory.

### Cards / Containers
- **Panel:** `mari-editor-panel`; use for list shells, workbenches, dialogs, review drafts, and grouped settings.
- **Soft panel:** `mari-editor-panel mari-editor-panel--soft`; use for guidance, health summaries, status messages, import scope, and secondary context.
- **Internal padding:** Usually `0.75rem` (`p-3`), increasing to `1rem` on larger review workbenches or when content needs breathing room.
- **Lists:** Use dividers between rows, tonal group headers, selected-row backgrounds, and a clear empty/loading/error surface.

### Chips
- **Classification chips:** Small secondary-filled or bordered pills for note type, status, disposition, importance, freshness, confidence, and dependencies.
- **State chips:** Use editor accent or destructive semantic colors, or the strong editor border for a warning, with a text label; never use a colored dot or pill without a readable state.
- **Token pills:** Memory tags and keywords use compact secondary-filled rounded rectangles with a small remove control.

### Navigation
- **Destination rail:** Four destinations in order: Memory Vault, Review Queue, Sources, Memory Settings. Use Lucide icons and optional numeric badges for memory and pending-review counts.
- **Desktop:** Horizontal `mari-editor-tab-rail` with scrollable tab items and `min-h-10` to `min-h-11` controls.
- **Mobile:** Full-width four-column rail, sticky to the bottom with safe-area padding. Keep labels short and icons prominent.
- **Workspace tabs:** Reuse the same tab rail for navigator/workbench/inspector changes. Implement roving tab focus with Arrow keys, Home, and End.
- **Active state:** Use `data-active` plus the inherited tab treatment; preserve `aria-selected`, `aria-current`, and `aria-controls` semantics.

### Status Surfaces
- **Neutral:** Loading, empty, informational, and inherited-default messages in a soft panel.
- **Success:** Saved, imported, refreshed, applied, and recovered states in editor accent text/border treatment.
- **Warning:** Degraded health, stale source evidence, incomplete extraction, or partial results. `StatusSurface` adds a leading warning icon, editor text, and the strong editor border; the border is set inline because the Engine's unlayered `mari-editor-panel` border outranks utility classes. Call sites never add a warning icon of their own.
- **Danger:** Failed requests, invalid edits, destructive outcomes, blocked changes, and unavailable data in destructive treatment.
- **Behavior:** Use `role="status"` with polite live updates for ordinary state and `role="alert"` for danger. Busy states may include the inherited spinner, disabled under reduced motion.

### Signature Component: Evidence Workbench
The workbench is the feature's defining pattern. It places source context, proposed mutations, or an editable memory in a focused panel while keeping related navigation nearby and metadata/diagnostics available on demand. Evidence and extraction details are progressively disclosed with native `details` elements. Keep the primary operation visible, show why a change is proposed, and disclose stale, blocked, dependent, or rejected states before allowing acceptance.

## Package-Local Pattern Inventory

These patterns are implementation conventions for Long-Term Memory, not a public Engine component library. Reuse them directly inside this feature. Other packages should reuse the behavior and Engine-owned `mari-editor-*` classes and theme variables, not import Long-Term Memory internals.

### Ready for feature-local reuse

| Pattern | Source | Contract |
| --- | --- | --- |
| Responsive workspace | `LtmWorkspace.tsx` | Controlled navigator/workbench/inspector slots. Container width, not viewport width, selects one-pane tabs, two-column navigation, or the full three-pane layout. Keep pane state in the caller. |
| Actions | `shared-controls.tsx` (`Button`, `IconButton`) | Engine action styling, `2.75rem` touch targets, explicit primary/destructive tones, and an accessible label for every icon-only action. |
| Fields | `shared-controls.tsx` (`inputClass`, `compactInputClass`, `NumberField`) | Engine field styling. Numeric values commit on blur or Enter, clamp to their declared range, and recover from invalid input. |
| Feedback | `shared-controls.tsx` (`StatusSurface`) | Neutral, success, warning, and danger states with polite live announcements; a warning shows an icon and the strong border; danger uses an alert. |
| Context help | `shared-controls.tsx` (`InfoPopover`) | Hover/focus preview, click-to-pin behavior, Escape/outside-click dismissal, focus restoration, viewport-aware portal placement, and one open popover at a time. |
| Composite focus | `shared-controls.tsx` (`ClickSurface`) | Gives a compound row one visible `focus-within` treatment without making its wrapper an extra control. |

`MemoryVault.tsx`, `ReviewQueue.tsx`, and `SourcesWorkspace.tsx` are the reference consumers for `LtmWorkspace`. Prefer extending these shared package-local primitives over adding a second button, field, status, popover, or responsive-pane implementation.

### Feature-coupled patterns

- `SourceScopeCombobox.tsx` and `AvailabilityTabRail.tsx` are reusable for Long-Term Memory scope selection. Both render 100 places per list or memory group with a "Show N more" row. Their target kinds, selection keys, copy shape, and availability semantics are domain contracts, not generic picker APIs.
- `LongTermMemoryNavigation.tsx` owns the fixed Vault, Review Queue, Sources, and Settings destinations and their localized labels. It is navigation for this capability, not a general tab component.
- `InfoPopover` consumes `useLtmTranslation` for its accessible trigger name. Keep it package-local unless another real consumer first supplies an injected localization contract.
- `LtmWorkspace` uses browser `ResizeObserver`, `MutationObserver`, container queries, and `data-ltm-*` hooks. It is suitable for client-rendered capability surfaces, not server rendering without an explicit browser boundary.

### Extraction rule

Do not extract a shared component for a hypothetical consumer. When a second package needs the same behavior:

1. Confirm that both packages need the same interaction contract, not merely similar styling.
2. Keep Engine theme classes and variables as the visual dependency; do not copy their CSS into package code.
3. Remove Long-Term Memory types, localization keys, labels, and `data-ltm-*` hooks from the proposed shared API.
4. Preserve keyboard behavior, focus restoration, live-region semantics, reduced motion, container responsiveness, and `2.75rem` touch targets.
5. Move only the smallest proven common primitive. Leave target selection and capability navigation local unless their domain contracts also match.

Until that second consumer exists, this file and the source components above are the authoritative package-local reference.

## Do's and Don'ts

### Do:
- **Do** reuse `mari-editor-shell`, `mari-editor-header`, `mari-editor-panel`, `mari-editor-field`, `mari-editor-action`, `mari-editor-tab`, and their Engine theme variables.
- **Do** keep the three-pane model consistent across Vault, Review Queue, and Lorebook browsing, collapsing it through `LtmWorkspace` rather than inventing page-specific breakpoints.
- **Do** make source scope, freshness, evidence, confidence, dependencies, and index health visible before destructive or irreversible actions.
- **Do** preserve keyboard navigation, focus restoration, accessible names, live status announcements, native dialogs, and reduced-motion behavior.
- **Do** use localization keys for all user-facing copy and allow labels to wrap or truncate safely at narrow widths.
- **Do** treat the client as a themed Engine contribution: feature-specific styling should be semantic and token-backed, not a second global design system.

### Don't:
- **Don't** introduce a feature-only color palette, hard-coded theme colors, or a new font family inside this workspace.
- **Don't** replace evidence-led review with decorative cards, gamified progress, confidence theater, or unlabelled color coding.
- **Don't** hide destructive actions behind unlabeled icons, hover-only affordances, or ambiguous menu items on touch layouts.
- **Don't** make every section a floating card or add shadows to ordinary panels; the inherited editor chrome already provides the depth system.
- **Don't** collapse the responsive workspace into a generic single-column page that loses the current navigator/workbench/inspector task flow.
