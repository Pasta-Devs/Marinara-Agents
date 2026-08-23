# Recursive XYZ Spaces for World Maps

> **Status:** Planning only. This document proposes future World Maps behavior; it does not represent an implemented feature or authorize package artifact changes.

## Summary

World Maps is already hierarchical: regions can contain towns, towns can contain buildings, buildings can contain floors, and floors can contain rooms. That hierarchy answers **what is inside what**, but it does not yet provide semantic spatial locations such as XYZ coordinates that answer **where each child is inside its parent**. Existing normalized placement supports visual map arrangement; it is not a recursive spatial model.

Model World Maps as recursive local coordinate spaces:

```text
World hierarchy
└── Region
    ├── Town at (18, 7, 0)
    │   ├── Building at (4, 11, 2)
    │   │   └── Room at (6, 3, -1)
```

Every location can simultaneously be:

- positioned at `(x, y, z)` inside its parent;
- the owner of a new XYZ space for its children; and
- the authoritative story location already tracked by World Maps.

This is fractal-like multiscale navigation, not one global 3D coordinate system. Zooming into a child resets the viewport to that child's local coordinate space.

## Public Contracts

Add optional grid geometry to `SpatialLocation`:

```ts
interface SpatialLocalGrid {
  columns: number; // 1–64
  rows: number; // 1–64
  minZ: number; // signed elevation
  maxZ: number; // signed elevation; at most 64 levels
}

interface SpatialGridPosition {
  x: number; // zero-based; increases east/right
  y: number; // zero-based; increases south/down
  z: number; // signed; increases upward
}

interface SpatialLocation {
  // Existing fields remain unchanged.
  localGrid?: SpatialLocalGrid;
  gridPosition?: SpatialGridPosition;
}
```

Rules:

- `localGrid` defines the coordinate space owned by a parent.
- `gridPosition` places a child inside that parent's coordinate space.
- Missing Z defaults to `0` when importing compatible XY-only data.
- Two children may share X/Y when their Z values differ.
- Two children may not occupy the same complete `(x, y, z)` cell.
- Positions must be integer, in bounds, and absent when the parent has no grid.
- Existing normalized `placement`, List, Map, and Layers data remain readable.
- The capability API minor version and minimum compatible Engine version increase before the updated package ships.

## Implementation

- Add reusable geometry helpers for bounds, occupancy, horizontal direction, horizontal distance, vertical difference, and deterministic ordering.
- Keep every coordinate local. Do not calculate global coordinates across ancestors because grids may represent radically different scales.
- Project a bounded nested spatial address into model context:

  ```text
  Current path: Coast > Brinewatch > Tideglass Inn > Cellar
  Nested position:
  - Brinewatch in Coast: (18, 7, 0)
  - Tideglass Inn in Brinewatch: (4, 11, 2)
  - Cellar in Tideglass Inn: (6, 3, -1)
  ```

- Describe same-grid destinations using compass direction, horizontal grid distance, and elevation difference, such as "northwest, 5 grid units away, 2 levels above."
- Preserve existing movement authority. Hierarchy and Direct Links determine reachability; XYZ distance, adjacency, and empty cells never move the story or establish travel time.
- Use stairs, elevators, ladders, portals, roads, and similar Direct Links when creators want explicit physical routes between levels.
- Add an XYZ editor:
  - Configure width, height, minimum Z, and maximum Z per location.
  - Show one Z slice at a time.
  - Switch slices with a level selector and above/below controls.
  - Show counts or indicators for occupied cells on other levels.
  - Drag children with X/Y snapping; edit X, Y, and Z numerically.
  - Reject overlap, clipping, or grid resizing that strands children.
  - Offer previewed conversion from freeform Map or ordered Layers data.
- Add nested runtime browsing:
  - Open at the root containing the current location.
  - Select the Z slice containing the current descendant branch.
  - Highlight the child leading toward the exact current location.
  - Zoom in enters that child's coordinate space without moving the story.
  - Zoom out returns to the parent space and restores its prior slice.
  - Set destination or Plan route remains a separate explicit action.
- Extend AI creation and expansion to propose local grids and XYZ positions. Server normalization preserves valid positions, repairs collisions deterministically, places omitted children in free cells, and fails safely when capacity is exhausted.
- Land shared schemas and capability contracts in Engine first. Then update World Maps source, bundles, manifests, artifacts, catalog lanes, lifecycle fixtures, docs, and changelog in Marinara-Agents.

## Test Plan

- Validate grid sizes, signed Z ranges, integer positions, duplicate XYZ occupancy, missing parents, out-of-bounds cells, and unsafe resizing.
- Prove legacy definitions and XY-only imports remain readable with no eager rewrite.
- Verify multiple children may occupy the same X/Y on different Z levels.
- Verify direction, distance, and elevation descriptions only compare siblings in the same local space.
- Build a nested region → town → building → floor → room fixture and round-trip it through save/reload, templates, shared worlds, drafts, branching, export/import, and archive/restore.
- Prove changing slices and zooming never changes `currentLocationId`.
- Prove only an accepted queued transition commits movement and creates a snapshot.
- Test desktop snapping, keyboard positioning, mobile slice navigation, background alignment, current-branch highlighting, and deep zoom restoration.
- Test AI generation, expansion into partially occupied volumes, collision repair, and full-grid failure.
- Run Engine checks, package regressions, catalog validation, exact-artifact lifecycle validation, active/ready verification, and manual Roleplay/Game browser review.

## Assumptions

- Z means discrete elevation or floor level, not hierarchy depth or a true physics simulation.
- The first renderer uses 2D slices; isometric rendering is deferred.
- Locations occupy one XYZ cell; footprints and volumes are deferred.
- No party token, terrain, collision, weighted travel, tactical pathfinding, or global coordinate transform is introduced.
- Explicit Floor nodes remain useful but optional: a building may contain Floor nodes at different Z values, and each Floor may own another grid for its rooms.
