var Sr=`
:host {
  all: initial;
  display: block;
}

*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The type ramp lives in theme.js; only SPACING is local. --f is geometric and must not carry the
     player's text scale. cqh requires container-type: size on THIS element. */
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
  --sp-5: calc(var(--f) * 3.6);
}

/* \u2500\u2500 THE SCREEN: two rows, and neither scrolls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Scene is minmax(0, 1fr), dock is auto with no height of its own: the text-scale control grows
   the dock and the SCENE pays the difference. */
.hm-screen {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  pointer-events: auto;
}

/* Hangs off the SCREEN, not the scene, so it bleeds behind the dock: floating art, real grid row. */
.hm-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; }

/* No background chosen yet, or a world with images off: the same ground every other screen uses. */
.hm-ground {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(90% 70% at 78% 12%, var(--glow-1) 0%, transparent 60%),
    radial-gradient(80% 60% at 10% 88%, var(--glow-2) 0%, transparent 64%),
    linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%);
}

/* Two gradients: the bottom carries the dock, the right carries the Battle block and the rail.
   Every style pairs a dark ink with light text, so one dark veil serves all five. */
.hm-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--ink) 55%, transparent) 0%, transparent 22%, transparent 46%, color-mix(in srgb, var(--ink) 86%, transparent) 100%),
    linear-gradient(270deg, color-mix(in srgb, var(--ink) 72%, transparent) 0%, transparent 44%);
}

/* The scene is a ROW. Flex, not grid: plate width comes from height through the 2:3 ratio, and a
   grid auto track would have to resolve that circularly. */
.hm-scene { position: relative; min-height: 0; z-index: 2; display: flex; align-items: stretch; }

/* Rail and Battle are IN FLOW with margin-top auto, never anchored: anchored, the gap was a
   leftover that shrank as text scaled; in flow it has a floor. */
.hm-right {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--sp-2);
  padding: var(--sp-3);
  overflow: hidden;
}

/* \u2500\u2500 THE UNIT: framed, not cut out \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A portrait carries its own painted scene, so fading its edges leaves a patch of somewhere else.
   The edge is BACKGROUND, not border: clip-path cuts the border box and leaves the diagonal
   unstroked. Width comes from HEIGHT through the ratio. */
.hm-plate {
  position: relative;
  flex: none;
  z-index: 1;
  align-self: flex-end;
  height: 74%;
  width: auto;
  aspect-ratio: 2 / 3;
  box-sizing: border-box;
  --edge-w: 2px;
  padding: var(--edge-w) var(--edge-w) 0 0;
  /* The STYLE's accent, never the rarity ramp: here the frame is furniture. */
  background: color-mix(in srgb, var(--coral) 55%, transparent);
  clip-path: var(--plate-clip-left);
  border-top-right-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
/* THE ART TAKES THE FRAME'S CORNER TOO. --plate-clip-left is none in four of the five styles, and
   there only the frame's border-radius shapes this corner -- which a child does not inherit and an
   absolute one is not clipped by. Measured: shows in the three styles with a big radius (14/20/18px),
   hides in the 2px one. DERIVED from the frame's radius so the two cannot disagree. */
.hm-art {
  position: absolute;
  inset: var(--edge-w) var(--edge-w) 0 0;
  overflow: hidden;
  clip-path: var(--plate-clip-left);
  border-top-right-radius: max(0px, calc(var(--radius) - var(--edge-w)));
  background: linear-gradient(180deg, var(--glow-1) 0%, var(--ground-2) 100%);
}
.hm-art > img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 14%; pointer-events: none; }
/* One veil at the top and one at the foot: the top one lifts the plate off the ceiling, the foot
   one is what the name plate is read against. */
.hm-art::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--ink) 55%, transparent) 0%, transparent 20%),
    linear-gradient(0deg, color-mix(in srgb, var(--ink) 88%, transparent) 0%, transparent 26%);
}
/* No unit chosen, or a world with no portraits: the same shadowed figure the VN falls back to, in
   the same box with the same edges, so art arriving later changes nothing about the layout. */
.hm-figure { position: absolute; left: 6%; bottom: 0; width: 88%; height: 86%; opacity: 0.4; color: var(--porcelain-3); }

/* \u2500\u2500 THE TWO SLOTS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The plate IS the control for the unit, the chip IS the control for the background: same as Gear. */
.hm-slot {
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  font-family: var(--display);
  text-align: left;
  color: var(--text);
  padding: calc(var(--f) * 0.45) var(--sp-2);
}
/* It WRAPS, never truncates: an ellipsis eats the name, and an N-line clamp lies once text scales. */
.hm-slot .nm {
  min-width: 0;
  font-size: var(--t-md);
  font-weight: 700;
  font-stretch: var(--stretch);
  letter-spacing: 0.03em;
  overflow-wrap: anywhere;
  line-height: 1.15;
}
.hm-slot .swap { font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--coral); white-space: nowrap; }

/* INSIDE the plate, on its foot veil: the same piece, not a label beside it. No background of its
   own -- the veil already is one, and a second opaque box would be a plate inside a plate. */
.hm-slot-unit { position: absolute; left: 0; right: var(--edge-w); bottom: 0; z-index: 2; background: transparent; border: 0; }
.hm-slot-unit:hover .swap { color: var(--text); }

/* The background's chip goes at the foot of the scene, to the right of the plate: the two slots on
   one baseline is what makes them read as a pair. */
.hm-slot-bg {
  position: absolute;
  left: var(--sp-3);
  bottom: var(--sp-3);
  z-index: 2;
  background: linear-gradient(0deg, color-mix(in srgb, var(--ink-2) 92%, transparent), color-mix(in srgb, var(--ink-2) 92%, transparent)), var(--ink);
  border: 1px solid var(--ink-3);
  border-left: 2px solid var(--coral);
  --cut: 0.5em;
  clip-path: var(--clip-card);
  border-radius: var(--radius-sm);
  max-width: 48%;
}
.hm-slot-bg:hover { border-color: var(--coral); }
.hm-slot-bg .nm { font-size: var(--t-sm); }

/* \u2500\u2500 THE BATTLE BLOCK \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Where it goes and how the story stands, nothing else: more is writing what the destination says. */
.hm-cta {
  flex: none;
  margin-top: auto;
  width: 34%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  cursor: pointer;
  pointer-events: auto;
  text-align: left;
  font-family: var(--display);
  color: var(--text);
  background: linear-gradient(0deg, color-mix(in srgb, var(--ink-2) 92%, transparent), color-mix(in srgb, var(--ink-2) 92%, transparent)), var(--ink);
  border: 1px solid var(--ink-3);
  border-top: 2px solid var(--coral);
  padding: var(--sp-2) var(--sp-3);
  --cut: 0.9em;
  clip-path: var(--clip-card);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.hm-cta:hover { border-color: var(--coral); }
.hm-cta:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.hm-cta .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.22em; text-transform: var(--case); color: var(--steel-faint); }
/* line-height 1.2, not 1: at exactly 1 the glyph box can overshoot the line box on some styles. */
.hm-cta .big { font-family: var(--title); font-size: var(--t-xl); font-weight: 700; font-stretch: var(--stretch); letter-spacing: 0.04em; text-transform: var(--case); line-height: 1.2; }
.hm-cta .title { font-size: var(--t-md); font-weight: 700; font-stretch: var(--stretch); }
.hm-cta .nodes { display: flex; align-items: center; gap: calc(var(--f) * 0.35); flex-wrap: wrap; }
.hm-cta .nodes i { width: calc(var(--f) * 0.55); height: calc(var(--f) * 0.55); background: var(--steel-dark); transform: rotate(45deg); display: block; }
.hm-cta .nodes i.done { background: var(--coral); }
.hm-cta .nodes i.now { background: var(--amber); }
.hm-cta .nodes span { font-size: var(--t-xs); color: var(--porcelain-3); margin-left: calc(var(--f) * 0.4); }
.hm-cta .go { font-size: var(--t-sm); font-weight: 700; letter-spacing: 0.14em; text-transform: var(--case); color: var(--coral); }

/* \u2500\u2500 THE RIGHT RAIL: the less frequent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Continuity and Settings are NOT here: the bar already carries their doors. Locked entries are
   drawn because no system exists behind them yet. */
.hm-rail { flex: none; display: flex; flex-direction: column; gap: var(--sp-1); align-items: stretch; width: 34%; }

/* \u2500\u2500 THE CONTEXT NOTICE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Drawn only past the threshold: below it there is no element, and that absence IS the information.
   IT MOVES NOTHING WHEN IT APPEARS, which is the property to measure: a full-width band pushed
      Battle up 68px. Here it eats slack from the rail-Battle gap, which is in flow and has a floor.
      Measured with and without: 20/418/634 either way. Same 34% as the rail and Battle.
   In ember --coral and --amber are both golds, so it separates from Battle by fill, not by edge. */
.hm-warn {
  flex: none;
  width: 34%;
  margin-top: calc(var(--f) * 0.6);
  cursor: pointer;
  pointer-events: auto;
  text-align: left;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: calc(var(--f) * 0.6);
  padding: calc(var(--f) * 0.6) calc(var(--f) * 0.8);
  background: color-mix(in srgb, var(--amber) 14%, var(--ink-2));
  border: 1px solid color-mix(in srgb, var(--amber) 45%, transparent);
  border-top: 2px solid var(--amber);
  --cut: 0.55em;
  clip-path: var(--clip-card);
  border-radius: var(--radius-sm);
}
.hm-warn:hover { border-color: var(--amber); }
/* clip-path cuts an outline, so the focus ring is drawn inside. */
.hm-warn:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--amber); }
.hm-warn .ic { flex: none; display: block; width: calc(var(--f) * 1.6); color: var(--amber); }
.hm-warn .ic svg { display: block; width: 100%; height: auto; }
.hm-warn .tx { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.12); }
/* All text OPAQUE: on the glass styles a faded colour composites against the stage and gives a
   different contrast per style. Hierarchy is carried by SIZE. */
.hm-warn .k { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.hm-warn .n { font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
.hm-warn .n b { color: var(--amber); }
.hm-warn .go {
  margin-left: auto; flex: none;
  font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case);
  color: var(--amber);
}
/* THE NEXT-STEP BLOCK is the BATTLE BLOCK's plate, not furniture of its own: a bespoke coral banner
   was cut by the user for not reading as part of the game. Only the eyebrow and a smaller verb
   differ -- this is the SECOND thing on the screen and must not out-shout the door to the game.
   THE SLACK IS EATEN ONCE, BY WHICHEVER BLOCK IS FIRST: two margin-top: auto siblings SPLIT the
      free space and drift apart as text scales. With no block the selector below does not match
      and Battle keeps its own auto -- no flag needed. */
.hm-next {
  flex: none;
  margin-top: auto;
  /* THE SAME 34% AS .hm-cta, so the two stack as one column. */
  width: 34%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  cursor: pointer;
  pointer-events: auto;
  text-align: left;
  font-family: var(--display);
  color: var(--text);
  background: linear-gradient(0deg, color-mix(in srgb, var(--ink-2) 92%, transparent), color-mix(in srgb, var(--ink-2) 92%, transparent)), var(--ink);
  border: 1px solid var(--ink-3);
  /* Amber, not coral: Battle below owns the coral edge, and two coral-topped plates stacked read as
     one control cut in half. Named in WORDS on purpose -- the static token guard trips on a token
     name followed by a colon, even inside a comment. */
  border-top: 2px solid var(--amber);
  padding: var(--sp-2) var(--sp-3);
  --cut: 0.9em;
  clip-path: var(--clip-card);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.hm-next:hover { border-color: var(--amber); }
.hm-next:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--amber); }
.hm-next .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.22em; text-transform: var(--case); color: var(--steel-faint); }
/* --t-md, not --t-xl: Battle's verb stays the biggest thing on the screen. */
.hm-next .big { font-family: var(--title); font-size: var(--t-md); font-weight: 700; font-stretch: var(--stretch); letter-spacing: 0.04em; text-transform: var(--case); line-height: 1.2; color: var(--amber); }
/* One datum, one line. It ELLIPSES rather than wraps: a block that changed height as the step
   changed would shove Battle around underneath it. */
.hm-next .title { font-size: var(--t-sm); font-weight: 700; font-stretch: var(--stretch); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hm-next .go { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* The block already took the column's slack, so Battle must not take it again -- see .hm-next. */
.hm-next + .hm-cta { margin-top: 0; }
.hm-side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  cursor: pointer;
  pointer-events: auto;
  text-align: left;
  font-family: var(--display);
  color: var(--text);
  font-size: var(--t-sm);
  letter-spacing: 0.06em;
  background: linear-gradient(0deg, color-mix(in srgb, var(--ink-2) 88%, transparent), color-mix(in srgb, var(--ink-2) 88%, transparent)), var(--ink);
  border: 1px solid var(--ink-3);
  /* Height comes from the PADDING, and the padding is geometric: the box stays still as text
     scales, and the scene absorbs the difference. */
  padding: calc(var(--f) * 1.05) var(--sp-2);
  --cut: 0.45em;
  clip-path: var(--clip-chip);
  border-radius: var(--radius-sm);
}
.hm-side:hover { border-color: var(--coral); }
/* The claim dot is a CHILD of the flex row, not an absolute badge: space-between lands it at the
   right edge, and two flex children cannot sit on top of each other -- how a badge covered a label
   on the Pass twice. --coral, never a literal red: the theme could not move that one value. */
.hm-side .hm-dot { flex: none; width: calc(var(--f) * 0.5); height: calc(var(--f) * 0.5); border-radius: 99px; background: var(--coral); }
.hm-side .lbl { display: flex; align-items: center; gap: calc(var(--f) * 0.5); min-width: 0; }
.hm-side svg { width: calc(var(--f) * 1.45); height: calc(var(--f) * 1.45); flex: none; color: var(--steel-faint); }
/* The reason goes IN the control: one word, where the player is already looking. */
.hm-side .soon { font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
/* A live rail entry must differ from a locked one before hover: the same grey glyph on both
   reads as two locked doors. */
.hm-side:not(.off) svg { color: var(--steel); }
.hm-side.off { cursor: default; }
.hm-side.off:hover { border-color: var(--ink-3); }
.hm-side.off .lbl { color: var(--porcelain-3); }

/* \u2500\u2500 THE DOCK: the most frequent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Materials is deliberately absent: it is a MODE, so its door is Battle. Adding a door is one
   entry in DOCK. */
.hm-dock {
  position: relative;
  z-index: 3;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2) var(--sp-2);
}
/* ICON AND NAME, nothing else: a dock button names a place and its number lives inside the
   destination. The number-per-sentence rule is for sentences that EXPLAIN. */
.hm-tile {
  min-width: 0;
  cursor: pointer;
  pointer-events: auto;
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-family: var(--display);
  color: var(--text);
  background: linear-gradient(0deg, color-mix(in srgb, var(--ink-2) 92%, transparent), color-mix(in srgb, var(--ink-2) 92%, transparent)), var(--ink);
  border: 1px solid var(--ink-3);
  border-top: 2px solid var(--steel-dark);
  /* Same as the rail: the box grows through padding, never font-size, so the text-scale control
     moves only the type. */
  padding: calc(var(--f) * 1.35) var(--sp-2);
  --cut: 0.6em;
  clip-path: var(--clip-card);
  border-radius: var(--radius);
  transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease);
}
.hm-tile:hover { transform: translateY(-2px); border-top-color: var(--coral); }
.hm-tile:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.hm-tile svg { flex: none; width: calc(var(--f) * 2.4); height: calc(var(--f) * 2.4); color: var(--coral); }
.hm-tile .nm { min-width: 0; font-size: var(--t-md); font-weight: 700; font-stretch: var(--stretch); letter-spacing: 0.04em; text-transform: var(--case); line-height: 1.05; }
.hm-tile.summon svg { color: var(--amber); }
/* A door that has not opened yet, drawn NOW and locked so the dock does not change shape under the
   player the day it ships. Turning it on is changing one false in DOCK. */
.hm-tile.off { cursor: default; opacity: 0.62; }
.hm-tile.off:hover { transform: none; border-top-color: var(--steel-dark); }
.hm-tile.off svg { color: var(--steel-faint); }
.hm-tile .soon { margin-left: auto; font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
/* margin-left: auto, like .soon: the dot lands at the right edge as a CHILD instead of an absolute
   badge that could sit on top of the label. A locked tile has no dot, so they never fight for it.
   The rule used to be .hm-side .hm-dot, scoped to the right rail, so the same span inside a dock
      tile drew an EMPTY, INVISIBLE box -- markup that draws nothing and fails nothing. */
.hm-tile .hm-dot { margin-left: auto; flex: none; width: calc(var(--f) * 0.5); height: calc(var(--f) * 0.5); border-radius: 99px; background: var(--coral); }



/* \u2500\u2500 THE TWO SLOT PICKERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One panel OVER the Home, same pattern as Gear. ONE picker serves both slots: what changes
   between choosing a background and a unit is data. */
.hm-pk-wrap { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; pointer-events: auto; }

/* The house scrim, shared with the mode menu. */
.hm-pk-veil {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}

/* OPAQUE: on the glass styles a translucent panel composites against the stage and the contrast
   shifts per style. */
.hm-pk {
  position: relative;
  z-index: 2;
  width: min(84%, calc(var(--f) * 84));
  height: 80%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3);
  border-top: 2px solid var(--coral);
  --cut: 1em;
  clip-path: var(--clip-card);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}

/* The header says WHAT is being chosen and WHICH is in use: the current card may be scrolled out. */
.hm-pk-head { display: flex; align-items: baseline; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); border-bottom: 1px solid var(--ink-3); }
.hm-pk-head .ttl { font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.hm-pk-head .cur { min-width: 0; font-family: var(--body); font-size: var(--t-sm); color: var(--porcelain-3); overflow-wrap: anywhere; }
.hm-pk-head .x { margin-left: auto; flex: none; cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.hm-pk-head .x:hover { border-color: var(--coral); color: var(--coral); }

.hm-pk-body { display: grid; grid-template-columns: auto minmax(0, 1fr); min-height: 0; }

/* The rail: BG_SOURCES for the background, RARITY_TIERS for the unit -- the roster's own list. */
.hm-pk-cats { display: flex; flex-direction: column; gap: calc(var(--f) * 0.2); padding: var(--sp-2); border-right: 1px solid var(--ink-3); min-width: 0; }
.hm-pk-cat {
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  font-family: var(--display);
  color: var(--porcelain-3);
  font-size: var(--t-sm);
  letter-spacing: 0.06em;
  padding: calc(var(--f) * 0.45) var(--sp-2);
  background: transparent;
  border: 0;
  border-left: 2px solid transparent;
}
.hm-pk-cat:hover { color: var(--text); border-left-color: var(--coral); }
.hm-pk-cat[aria-selected="true"] { color: var(--text); border-left-color: var(--coral); background: var(--ink-3); }
.hm-pk-cat.off { cursor: default; color: var(--steel-faint); }
.hm-pk-cat.off:hover { border-left-color: transparent; color: var(--steel-faint); }
/* The reason goes IN the control. */
.hm-pk-cat .soon { font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }

/* The grid's COLUMN: it exists so the mode switch can sit above the grid without joining the rail,
   which is answering a different question. min-height 0 is what lets the grid keep its own scroll
   instead of pushing it out to the panel. */
.hm-pk-col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.hm-pk-col > .hm-pk-grid { flex: 1; }
/* Two pills, the SAME ones the rail uses: a second vocabulary for a second row of choices is how a
   screen stops looking like one screen. */
.hm-pk-mode { flex: none; display: flex; gap: calc(var(--f) * 0.4); padding: var(--sp-3) var(--sp-3) 0; }
/* CONTAINED scroll: the SCREEN never scrolls, a grid inside its own box may. align-content start
   does not stretch rows to hide a gap. */
.hm-pk-grid {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 12), 1fr));
  gap: var(--sp-2);
  align-content: start;
  padding: var(--sp-3);
}
.hm-pk-card {
  display: flex;
  flex-direction: column;
  gap: calc(var(--f) * 0.3);
  min-width: 0;
  cursor: pointer;
  text-align: left;
  background: var(--ink-2);
  border: 1px solid var(--ink-3);
  padding: calc(var(--f) * 0.4);
  color: var(--text);
  font-family: var(--display);
}
.hm-pk-card:hover { border-color: var(--coral); }
/* Marked with border AND word, never colour alone: an accent frame does not stand out equally on
   five palettes. */
.hm-pk-card.on { border-color: var(--amber); background: color-mix(in srgb, var(--amber) 12%, var(--ink-2)); }
/* The ASPECT comes from the ART: a box-driven height crops a place beyond recognition. */
/* position: relative because the no-portrait card reuses the absolutely positioned .hm-figure:
   without an anchor it anchors to the PANEL -- a giant figure that also swallows every click. */
.hm-pk-card .shot { position: relative; width: 100%; aspect-ratio: 3 / 2; overflow: hidden; background: var(--ink-3); }
.hm-pk-card .shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
.hm-pk-card .nm { font-size: var(--t-xs); line-height: 1.25; overflow-wrap: anywhere; }
.hm-pk-card .kit { font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); overflow-wrap: anywhere; }
.hm-pk-card .kit b { color: var(--amber); font-weight: 700; }
.hm-pk-card .tag { font-size: var(--t-tiny); letter-spacing: 0.16em; text-transform: var(--case); color: var(--amber); }

/* The NONE card shows the gradient you will get. Background only: there is always a unit. */
.hm-pk-card.none .shot { display: grid; place-items: center; background: radial-gradient(90% 70% at 78% 12%, var(--glow-1) 0%, transparent 60%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
.hm-pk-card.none .shot span { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }

/* The UNIT variant: the same panel, and the change is data. */
.hm-pk.units .hm-pk-grid { grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 8.5), 1fr)); }
.hm-pk.units .hm-pk-card .shot { aspect-ratio: 2 / 3; }
/* object-position favours the top, where a portrait's face lives. */
.hm-pk.units .hm-pk-card .shot img { object-position: 50% 14%; }

/* A live but EMPTY category does not show a hole: it says where the first one comes from. */
.hm-pk-empty { grid-column: 1 / -1; align-self: start; font-family: var(--body); font-size: var(--t-sm); line-height: 1.5; color: var(--porcelain-3); }

/* The Settings sheet moved to settings.js with st- prefixed classes: mounted on every screen, a
   generic class name stops being harmless. */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;var Ke="vanguard",Xe=[{id:"aurora",label:"Aurora",description:"Frosted glass and gold",swatch:["#171334","rgba(255,255,255,.10)","#E8C87A"]},{id:"bloom",label:"Bloom",description:"Bright and playful",swatch:["#2B3F63","#FFFFFF","#FF6E9C"]},{id:"signal",label:"Signal",description:"Technical and minimal",swatch:["#0C0D10","rgba(255,255,255,.10)","#C8FF3D"]},{id:"ember",label:"Ember",description:"Warm and painted",swatch:["#2C1E14","#6B4A2A","#F0B429"]},{id:"vanguard",label:"Vanguard",description:"Sharp and industrial",swatch:["#0E1725","#1E2C44","#F2603C"]}];function Er(t){return Xe.some(e=>e.id===String(t))}function ft(t){return Er(t)?String(t):Ke}var pt=[1,1.15,1.3,1.5,1.75],Tr=1.15;function Je(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return Tr;let a=pt[0];for(let r of pt)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}var Rt=pt,wn=Tr;function Ze(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return wn;let a=Rt[0];for(let r of Rt)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}function u(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function he(t){return String(t||"").split(",")[0].trim()}function Ar(t){return String(t??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60)}var xn='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',kn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/></svg>',wa='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',_n=wa.replace("<svg ",'<svg class="glyph" '),Sn='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="11" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><path d="M6 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',En='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Tn='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" stroke-width="1.7"/></svg>';function Lt(t){let e=Math.max(0,Math.floor((Number(t)||0)/1e3)),a=Math.floor(e/60),r=e%60;return a+":"+String(r).padStart(2,"0")}function Fe(t){return(Number(t)||0).toLocaleString("en-US")}var Nr=new Set(["hud","modes","summon","roster","unit","formation","chapter","chapters","combat","farm","inventory","settings","events","achievements","shop"]),Ir=`
.gf-bar {
  position: relative;
  z-index: 8;
  flex: none;
  display: flex;
  align-items: stretch;
  gap: var(--gf-sp-2);
  padding: var(--gf-sp-2) var(--gf-sp-3);
  background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 92%, transparent) 0%, transparent 100%);

  /* The bar lives in the shell, outside any view, so it measures the STAGE with the same clamp. */
  /* WIDTH term only: this ramp is on .gf-bar, whose container is inline-size, and that provides no
     cqh at all -- a height term would silently fall back to the small viewport. */
  /* A second ramp on purpose: the bar is a fixed strip and must not follow the stage height, but a
     control that grew the screens and not the bar would leave a small bar over a big game. */
  --gf-f: clamp(7.5px, 1.02cqw, 22px);
  --gf-sp-1: calc(var(--gf-f) * 0.5);
  --gf-sp-2: calc(var(--gf-f) * 1.0);
  --gf-sp-3: calc(var(--gf-f) * 1.6);
  --gf-sp-5: calc(var(--gf-f) * 3.6);
  --gf-tiny: calc(var(--gf-f) * 0.72 * var(--gf-type-scale, 1));
  --gf-xs: calc(var(--gf-f) * 0.85 * var(--gf-type-scale, 1));
  --gf-sm: calc(var(--gf-f) * 1.0 * var(--gf-type-scale, 1));
  --gf-md: calc(var(--gf-f) * 1.25 * var(--gf-type-scale, 1));
  --gf-lg: calc(var(--gf-f) * 1.7 * var(--gf-type-scale, 1));
}

.gf-bar .command {
  display: flex;
  align-items: center;
  /* It YIELDS, and first: a name and an XP bar can be clipped, a stamina counter cannot.
     min-width: 0 is what lets a flex item shrink below its content. */
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  gap: var(--gf-sp-2);
  background: var(--surface);
  color: var(--on-surface);
  padding: calc(var(--gf-f) * 0.6) var(--gf-sp-5) calc(var(--gf-f) * 0.6) calc(var(--gf-f) * 0.7);
  --cut: 1.1em;
  clip-path: var(--clip-btn);
  border-radius: var(--radius-sm);
}
.gf-bar .avatar {
  width: calc(var(--gf-f) * 2.2);
  height: calc(var(--gf-f) * 2.2);
  flex: none;
  border-radius: 50%;
  background: linear-gradient(150deg, var(--glow-1), var(--glow-2));
  display: grid;
  place-items: center;
  color: var(--porcelain-3);
  font-family: var(--display);
  font-weight: 700;
  font-size: var(--gf-sm);
  border: 2px solid var(--steel);
}
.gf-bar .rank {
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-size: var(--gf-lg);
  font-weight: 700;
  line-height: 1;
  color: var(--coral-deep);
  font-variant-numeric: tabular-nums;
}
.gf-bar .rank small { display: block; font-size: var(--gf-tiny); letter-spacing: 0.16em; color: var(--steel); font-weight: 600; }
/* A box that holds TEXT is not sized with the geometric scale: tied to it, the text grows and the
   box does not. Basis is the CONTENT with a cap in the TEXT ramp. */
.gf-bar .xp { display: flex; flex-direction: column; gap: calc(var(--gf-f) * 0.35); min-width: 0; flex: 0 1 auto; max-width: calc(var(--gf-sm) * 16); }
/* A long commander name used to run into the XP figure. */
.gf-bar .xp .figure {
  display: flex;
  justify-content: space-between;
  gap: var(--gf-sp-2);
  font-family: var(--display);
  font-size: var(--gf-xs);
  letter-spacing: 0.08em;
  color: var(--steel);
  font-variant-numeric: tabular-nums;
}
.gf-bar .xp .figure > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gf-bar .xp .figure > span:last-child { flex: none; }
/* Track DARK, fill ACCENT -- the house pattern. Inverted, full read as empty. */
.gf-bar .xp-bar { height: calc(var(--gf-f) * 0.4); background: var(--ink-3); }
/* Width comes from the account, inline: a hardcoded 68% left over from the mockup painted the bar
   two thirds full beside a label reading 0 / 300 XP. */
.gf-bar .xp-bar > i { display: block; height: 100%; width: 0; background: var(--coral); }

/* The build label, deliberately quiet. It earns its place because the engine caches the bundle by
   version: if a reload did not take, this is the one thing that says so. */
/* Basis auto, NOT zero: with flex 1 1 0 the slot asks for nothing, so pieces that can yield never
   get asked and the hoisted title pays alone. min-width 0 stays, so it clips from its own size. */
.gf-bar-slot { display: flex; align-items: center; gap: var(--gf-sp-2); min-width: 0; flex: 1 1 auto; overflow: hidden; }
.gf-bar-slot:empty { display: none; }
/* The hoisted title CLIPS, never pushes: it is the one piece with an arbitrary length. */
.gf-bar-slot .head-id { min-width: 0; }
.gf-bar-slot .head-id h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gf-bar-slot .back {
  flex: none;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--on-surface);
  border: 0;
  font-family: var(--display);
  font-weight: 700;
  font-size: var(--gf-sm);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--gf-f) * 0.45) var(--gf-sp-2);
  cursor: pointer;
  --cut: 0.7em;
  clip-path: var(--clip-chip);
  border-radius: var(--radius-sm);
}
.gf-bar-slot .back:hover { background: var(--surface); }
.gf-bar-slot .head-id, .gf-bar-slot .cap-id, .gf-bar-slot .sel-id { min-width: 0; }
.gf-bar-slot .eyebrow { font-family: var(--display); font-size: var(--gf-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.gf-bar-slot h2 {
  margin: 0;
  font-family: var(--title);
  font-stretch: var(--stretch);
  font-weight: var(--title-weight);
  font-size: var(--gf-md);
  line-height: 1.15;
  letter-spacing: var(--track);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The screens' trailing counters are gone: each rode the hoist into the bar and ate width from the
   title slot, and each screen already says the same thing row by row. */
/* The Summon head carried its own Aether chip; the bar already shows Aether. */
.gf-bar-slot .wallet { display: none; }

/* Controls NEVER fall off the edge: the FIGURES yield. What INFORMS yields, what is PRESSED never
   does -- a clipped figure still says half, a button off screen says nothing. */
/* NO min-width zero here, and that is what holds the rule above: zero licenses shrinking BELOW the
   content, and with rigid figures the group spilled -- measured at 175%, a 634px box for 680px of
   content and the bar overflowing 23px. Without it the group's minimum IS its content. */
.gf-bar .currencies { display: flex; gap: var(--gf-sp-1); margin-left: auto; align-items: stretch; flex: 0 1 auto; }
/* THE FIGURES NEVER SHRINK. Yielding, at 175% the three chips lost 13, 13 and 18px and 64,640 drew
   as 64,64: a clipped NUMBER lies, it reads as a different whole number. The title SLOT yields. */
.gf-bar .currencies > .currency { flex: none; }
/* Buttons never shrink. The stamp vanishes outright when clipping is not enough: a diagnostic. */
.gf-bar .currencies > .icon-button { flex: none; }
.gf-bar .currency {
  display: flex;
  align-items: center;
  gap: calc(var(--gf-f) * 0.45);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3);
  border-radius: var(--radius-sm);
  padding: calc(var(--gf-f) * 0.3) calc(var(--gf-f) * 0.6);
}
.gf-bar .currency svg { width: calc(var(--gf-f) * 1.2); height: calc(var(--gf-f) * 1.2); flex: none; }
.gf-bar .currency .value {
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--gf-md);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.gf-bar .currency .note { font-family: var(--display); font-size: var(--gf-tiny); letter-spacing: 0.13em; text-transform: var(--case); color: var(--steel-faint); }
.gf-bar .currency .refill { color: var(--jade); font-variant-numeric: tabular-nums; }
/* Vigor is ONE line, like Aether and Funds: over two rows the icon centred against both and the
   number read off-axis. Width RESERVED with tabular figures -- it ticks every second. */
.gf-bar .currency.vig .value { font-variant-numeric: tabular-nums; }
/* THE VIGOR CHIP IS THE BUTTON: it costs no width, and width is what this bar does not have. A
   fourth chip took the hoisted header from 342px to 285 and clipped it. */
.gf-bar button.currency.vig { cursor: pointer; font: inherit; text-align: left; }
.gf-bar button.currency.vig:hover .value { color: var(--coral); }
/* THE MENU IS A CENTRED MODAL OVER THE STAGE, not a dropdown off the chip (a three-row list was
   thrown out by the user). It copies the login modal exactly, because coherence here is COPIED
   from a real screen, never chosen.
   THE PANEL IS A SIBLING OF THE CHIP, NEVER ITS CHILD -- a parser rule, not a preference: a
      button inside a button makes the browser CLOSE the outer one. Measured nested, it rendered
      EMPTY and the screen root overflowed 209px sideways. In the stage it also gets the whole
      stage to centre against, which the bar could never give it.
   absolute, never fixed: a fixed element escapes the stage, and every sheet gates against it. */
.gf-vm {
  position: absolute;
  inset: 0;
  /* Above the bar, like the login modal: the bar is behind the veil, which is why the panel says
     the Vigor figure itself. */
  z-index: 40;
  display: grid;
  place-items: center;
  font-family: var(--body);
  color: var(--text);
  /* THE PANEL WIDTH IS THE ONLY NUMBER: the card width is (panel - padding - gaps) / 3, so the
     square's floor is DERIVED below instead of drifting as a second number.
     46 and not less: at 38 the header row came to 507px against 506 and Close WRAPPED. */
  --gf-vm-w: 46;
  /* Outside .gf-bar, so it inherits none of its ramp and declares the same one. Both read the
     inline-size container, so they agree by construction; a height term would fall back. */
  --gf-f: clamp(7.5px, 1.02cqw, 22px);
  --gf-sp-1: calc(var(--gf-f) * 0.5);
  --gf-sp-2: calc(var(--gf-f) * 1.0);
  --gf-sp-3: calc(var(--gf-f) * 1.6);
  --gf-tiny: calc(var(--gf-f) * 0.72 * var(--gf-type-scale, 1));
  --gf-xs: calc(var(--gf-f) * 0.85 * var(--gf-type-scale, 1));
  --gf-sm: calc(var(--gf-f) * 1.0 * var(--gf-type-scale, 1));
  --gf-md: calc(var(--gf-f) * 1.25 * var(--gf-type-scale, 1));
  --gf-lg: calc(var(--gf-f) * 1.7 * var(--gf-type-scale, 1));
}
.gf-vm-veil {
  position: absolute; inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}
/* The house panel: OPAQUE over ink. A translucent one composes against the stage, shifts per
   style, and the game bleeds through. */
.gf-vm-panel {
  position: relative; z-index: 2;
  width: min(74%, calc(var(--gf-f) * var(--gf-vm-w)));
  display: flex; flex-direction: column; gap: var(--gf-sp-2);
  padding: var(--gf-sp-3);
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--coral);
  --cut: 1em; clip-path: var(--clip-card); border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.gf-vm-top { flex: none; display: flex; align-items: baseline; gap: var(--gf-sp-2); flex-wrap: wrap; }
.gf-vm-title { margin: 0; min-width: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--gf-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
/* The bar is behind the veil, so the figure is said HERE -- from the wallet, the same source the
   chip reads. A written copy is a lie waiting for the number to move. */
.gf-vm-now { display: inline-flex; align-items: baseline; gap: calc(var(--gf-f) * 0.35); color: var(--text); font-variant-numeric: tabular-nums; }
.gf-vm-now svg { width: var(--gf-md); height: var(--gf-md); align-self: center; flex: none; color: var(--jade); }
.gf-vm-now b { font-family: var(--display); font-size: var(--gf-md); }
.gf-vm-now span { font-family: var(--display); font-size: var(--gf-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.gf-vm-x {
  margin-left: auto; flex: none; cursor: pointer;
  background: transparent; border: 1px solid var(--steel-dark); color: var(--text);
  font-family: var(--display); font-weight: 700; font-size: var(--gf-xs);
  letter-spacing: 0.1em; text-transform: var(--case);
  padding: calc(var(--gf-f) * 0.3) var(--gf-sp-2);
  --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
.gf-vm-x:hover { border-color: var(--coral); color: var(--coral); }

/* THREE SQUARES, always: filtering by what you hold changes the menu's shape every time you spend
   one, and hides the catalogue. */
.gf-vm-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gf-sp-2); }
.gf-vm-slot { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--gf-f) * 0.4); }
.gf-vm-card {
  cursor: pointer; position: relative; min-width: 0; flex: 1 1 auto;
  /* A SQUARE, floor DERIVED from the panel: the card width is (panel - two paddings - two gaps)/3,
     so the same expression is its height. A hand-picked 9 left it 18% wider than tall.
     It only binds at the small scales; past 150% the content is taller and the card grows. */
  min-height: calc(var(--gf-f) * (var(--gf-vm-w) - 5.2) / 3);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--gf-f) * 0.35);
  padding: calc(var(--gf-f) * 1.0) calc(var(--gf-f) * 0.6);
  font: inherit; text-align: center;
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--coral);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  color: var(--text);
}
.gf-vm-card .glyph { width: 40%; max-width: calc(var(--gf-f) * 3.2); height: auto; color: var(--jade); flex: none; }
.gf-vm-card .amt { font-family: var(--display); font-weight: 700; font-size: var(--gf-lg); color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* The NAME of what a card pays: a glyph with a figure does not say what you receive. It WRAPS. */
.gf-vm-card .what { font-family: var(--body); font-size: var(--gf-xs); line-height: 1.2; color: var(--text); text-wrap: balance; }
.gf-vm-card:hover:not([disabled]) { border-color: var(--coral); background: color-mix(in srgb, var(--coral) 12%, var(--ink-2)); }
/* OFF, not gone, and dimmed with a COLOUR: opacity on text drops the contrast to 2.07:1. The sunk
   treatment is the claimed login day's -- LOST EDGE plus inset shadow -- because the inks are near
   black in all five styles and a darker ground alone measures 1.14:1. */
.gf-vm-card[disabled] { cursor: default; background: var(--ink); border-color: transparent; border-top-color: var(--steel-dark); box-shadow: inset 0 calc(var(--gf-f) * 0.15) calc(var(--gf-f) * 0.6) rgba(0,0,0,0.55); }
.gf-vm-card[disabled] .glyph { color: var(--steel-dark); }
.gf-vm-card[disabled] .amt, .gf-vm-card[disabled] .what { color: var(--steel-faint); }
/* THE COUNT GOES UNDER THE SQUARE (user request): a bare figure inside the card reads as part of
   the reward, next to another figure and a name. */
.gf-vm-n { text-align: center; font-family: var(--display); font-size: var(--gf-tiny); letter-spacing: 0.18em; text-transform: uppercase; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.gf-vm-slot.has .gf-vm-n { color: var(--text); }
/* With the three at zero the grey alone does not say WHERE to get them. */
.gf-vm-none { text-align: center; font-family: var(--display); font-size: var(--gf-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* Always the same width (worst case is the over-the-cap word), so the pill never moves its
   neighbours. */
/* NOTE-sized, not number-sized: moved out of .note it inherited the pill's font-size and read as
   big as the figure it annotates. */
.gf-bar .currency.vig .refill {
  font-family: var(--display); font-size: var(--gf-tiny); letter-spacing: 0.08em;
  margin-left: calc(var(--gf-f) * -0.15);
}
.gf-bar .currency .dim { opacity: 0.45; }
.gf-bar .currency.aet .value { color: var(--amber); }
.gf-bar .currency.vig .value { color: var(--jade); }

/* The context chip LEFT the bar -- this note is here so it does not come back. It was a permanent
   figure for a state that is almost never true, paying with width the bar does not have. */

/* SQUARE, and the height of the ROW: height from align-self stretch, width from aspect-ratio.
   Square and neighbour-sized by construction -- no two numbers that can drift apart. */
.gf-bar .icon-button {
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3);
  border-radius: var(--radius-sm);
  color: var(--porcelain-3);
  align-self: stretch;
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: border-color var(--dur-fast) ease, color var(--dur-fast) ease;
}
/* Only where the gutter cannot reach, the same cut shell.js hides them at. Never both: that
   would be a second door. */
/* The Runs door lives HERE and nowhere else: the gutter hid it twice (gone in fullscreen, and it
   is whatever is left beside a 16:9 stage, which can be zero). ONE door. */
/* On a LANDSCAPE phone the gutters exist again, so the narrow-screen condition decides. */
.gf-bar .icon-button:hover { border-color: var(--coral); color: var(--coral); }
.gf-bar .icon-button:focus-visible { outline: 2px solid var(--coral); outline-offset: 2px; }
/* The glyph grows with the box: a tiny icon in a large button reads as an empty button. */
.gf-bar .icon-button svg { width: calc(var(--gf-f) * 2); height: calc(var(--gf-f) * 2); }

/* Leaving fullscreen used to be a floating button pinned to the stage corner, which landed ON TOP
   of this bar. With a bar on screen the control belongs IN it. */
/* Always present, both ways: appearing only WHILE fullscreen forced a second button in the gutter
   just to get in -- two controls for one toggle. */
`,Mt="1.5.1";function Cr(t){if(!t)return"";let e=Array.isArray(t.items)?t.items:[];if(!e.length)return"";let a=Math.max(0,Math.round(Number(t.vigor)||0)),r=Math.max(1,Math.round(Number(t.vigorMax)||60)),s=e.map(i=>{let n=Math.max(0,Math.round(Number(i.held)||0));return'<div class="gf-vm-slot'+(n?" has":"")+'"><button class="gf-vm-card" type="button"'+(n?' data-vigor-use="'+u(i.id)+'"':" disabled")+">"+_n+'<span class="amt">+'+(Number(i.vigor)||0)+'</span><span class="what">'+u(i.name)+'</span></button><span class="gf-vm-n">&times;'+n+"</span></div>"}).join(""),o=e.every(i=>!(Number(i.held)>0))?'<span class="gf-vm-none">Sold in the Shop</span>':"";return'<div class="gf-vm" data-vigor-menu-panel><div class="gf-vm-veil" data-vigor-close></div><div class="gf-vm-panel"><div class="gf-vm-top"><h3 class="gf-vm-title">Vigor Items</h3><span class="gf-vm-now">'+wa+"<b>"+a+"</b><span>/ "+r+' Vigor</span></span><button class="gf-vm-x" type="button" data-vigor-close aria-label="Close">Close</button></div><div class="gf-vm-grid">'+s+"</div>"+o+"</div></div>"}function Rr({username:t="",wallet:e=null,account:a=null,vigorNextMs:r=null}={}){let s=e&&typeof e=="object"?e:{},o=Number(s.aether)||0,i=Number(s.funds)||0,n=Number(s.vigor)||0,l=Number(s.vigorMax)||60,d=a||null,h=d?Math.max(1,Number(d.level)||1):1,f=d?d.xpNeeded?Fe(Number(d.xp)||0)+" / "+Fe(d.xpNeeded)+" XP":"MAX":"&mdash;",m=d&&Number(d.xpNeeded)||0,v=d?m>0?Math.max(0,Math.min(100,Math.round((Number(d.xp)||0)/m*1e3)/10)):100:0,b=Number.isFinite(r)?Lt(r):"",w=t&&t.trim()||"Commander",c=w.split(/\s+/).filter(Boolean).slice(0,2).map(y=>y[0]).join("").toUpperCase()||"C";return`
<header class="gf-bar">
  <div class="command">
    <div class="avatar">${u(c)}</div>
    <div class="rank"><span data-bar-rank>${h}</span><small>RANK</small></div>
    <div class="xp">
      <div class="figure"><span>${u(w)}</span><span data-bar-rankxp>${f}</span></div>
      <div class="xp-bar"><i data-bar-rankfill style="width:${v}%"></i></div>
    </div>
  </div>

  <div class="gf-bar-slot" data-bar-slot></div>

  <div class="currencies">
    <div class="currency aet">${xn}<div><div class="value" data-bar-aether>${Fe(o)}</div></div></div>
    <div class="currency">${kn}<div><div class="value" data-bar-funds>${Fe(i)}</div></div></div>
    <button class="currency vig" type="button" data-vigor-menu aria-label="Use a Vigor item" title="Use a Vigor item">${wa}<div class="value"><span data-bar-vigor>${n}</span><span class="dim" data-bar-vigormax>/${l}</span></div><span class="refill" data-vigor-next>${b}</span></button>
    <button class="icon-button gf-runs-bar" type="button" data-open-runs aria-label="Worlds" title="Switch or start a world">${Sn}</button>
    <button class="icon-button" type="button" aria-label="Game settings">${Tn}</button>
    <button class="icon-button gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">${En}</button>
  </div>
</header>`}function Lr(t,{onToggle:e,onUse:a,onClose:r}={}){if(!t)return!1;let s=t.querySelector("[data-vigor-menu]");if(!s)return!1;if(e&&s.addEventListener("click",()=>e()),r)for(let o of t.querySelectorAll("[data-vigor-close]"))o.addEventListener("click",i=>{i.stopPropagation(),r()});if(a)for(let o of t.querySelectorAll("[data-vigor-use]"))o.addEventListener("click",i=>{i.stopPropagation(),a(o.getAttribute("data-vigor-use"))});return!0}function Mr(t,{wallet:e=null,account:a=null,vigorNextMs:r=void 0}={}){if(!t||typeof t.querySelector!="function")return!1;let s=l=>t.querySelector(l);if(!(s("[data-bar-aether]")?t:null))return!1;let i=(l,d)=>{let h=s(l);h&&h.textContent!==d&&(h.textContent=d)},n=e&&typeof e=="object"?e:null;if(n&&(i("[data-bar-aether]",Fe(Number(n.aether)||0)),i("[data-bar-funds]",Fe(Number(n.funds)||0)),i("[data-bar-vigor]",String(Number(n.vigor)||0)),i("[data-bar-vigormax]","/"+(Number(n.vigorMax)||60))),r!==void 0){let l=s("[data-vigor-next]");if(l){let d=Number.isFinite(r)?Lt(r):"";l.textContent!==d&&(l.textContent=d)}}if(a){let l=Math.max(1,Number(a.level)||1),d=Number(a.xpNeeded)||0;i("[data-bar-rank]",String(l)),i("[data-bar-rankxp]",d>0?Fe(Number(a.xp)||0)+" / "+Fe(d)+" XP":"MAX");let h=s("[data-bar-rankfill]");if(h&&h.style){let f=d>0?Math.max(0,Math.min(100,Math.round((Number(a.xp)||0)/d*1e3)/10)):100;h.style.width=f+"%"}}return!0}function Or(t,{nextMs:e,periodMs:a,onLanded:r}={}){if(!Number.isFinite(e))return()=>{};let s=Number(e),o=Number(a)>0?Number(a):0,i=Date.now()+s,n=()=>{let d=t&&t.querySelector?t.querySelector("[data-vigor-next]"):null;if(!d)return;let h=i-Date.now();if(h>0){d.textContent=Lt(h);return}i=o?Date.now()+o:Date.now(),d.textContent=o?Lt(o):"",r&&r()};n();let l=setInterval(n,1e3);return()=>clearInterval(l)}function Br(t){let e=t.querySelector&&t.querySelector("[data-bar-slot]");if(!e||typeof e.appendChild!="function")return!1;let a=t.querySelector(".head")||t.querySelector(".cap-head")||t.querySelector(".sel-head");if(!a||!a.childNodes)return!1;for(;e.firstChild;)e.removeChild(e.firstChild);let r=a.parentElement,s=[];for(let i of Array.from(a.childNodes))i.classList&&i.classList.contains("gf-stay")?s.push(i):e.appendChild(i);for(let i of s)r&&typeof r.appendChild=="function"&&r.appendChild(i);let o=typeof e.querySelectorAll=="function"?e.querySelectorAll(".eyebrow"):null;if(o&&typeof o.length=="number")for(let i=o.length-1;i>=0;i-=1){let n=o[i];n&&typeof n.remove=="function"&&n.remove()}return typeof a.remove=="function"&&a.remove(),!0}var An=[["New","new","g-new"],["Changed","changed","g-changed"],["Bugfix","fixed","g-fixed"]];function Ot(){return Nn.map((t,e)=>({version:t.version||Mt,now:e===0,body:An.map(([a,r,s])=>{let o=Array.isArray(t[r])?t[r]:[];return o.length?'<div class="gf-log-grp '+s+'"><span class="k">'+a+":</span><ul>"+o.map(i=>"<li>"+u(i)+"</li>").join("")+"</ul></div>":""}).join("")}))}var Nn=[{version:null,fixed:["World creation can always be cancelled"]},{version:"1.5.0",new:["Outfits can be switched off per world","Your Home can wear an outfit","Thoughts look different from speech","Advanced: your own rules for the writer","Story rules that span chapters","World lorebooks can feed story scenes too","Journey to a New World: 1,600 Aether a day for your first week","Seasonal Event: a box gacha","Achievements: ladders that pay Aether","A dot marks anything to claim","Every summon now pays something","A Shop, paid in Glimmer","Vigor potions in your bag","Prose can use a cheaper model","So can chapter compression","Help: lorebooks, macros, connections","The Home tells you what to do next","The featured banner is ready the moment it unlocks","The next featured is forged a day before the current ends","Summon: a history of your pulls, page by page","Every pull records the pity it landed on","Outfits: a second look, 60 Glimmer","Two new outfits every rotation","The Shop sells outfits from rank 15","Won relics show their four sub-stats"],changed:["The background follows the scene","The story wait shows its progress","Forging a chapter draws no art","Insight now gives twice the XP","The story backlog opens at the latest line","The speaker portrait no longer touches its name tag","Heroes may share a past you wrote for them","Help covers the newer screens","Lorebooks reach the story again","Deleting a world says what you lose","Claim dots update right away","Commander rank: no ceiling, steeper cost","Ranking up hands you 20 Vigor","Story fights cost 5 Vigor, was 8","Later chapters ask for less CP","New worlds start with no Aether","New worlds no longer start with free Insight","Faster, steadier world creation","World creation shows its progress","New worlds open with a prologue","Seasonal Event names the banner it runs with","Seasonal boxes now hold Insight","Chapters 1-3 fight smaller enemy bands","Enemies spread their attacks instead of ganging up","Tanks now draw enemy fire","Achievements pay 160 Aether a step","Enemies now vary their stat lines","Materials give a bit less","5-star relics reveal their fourth sub-stat as you level them","Each reinforcement now rolls high or low, like the genre does","5-star relics now level to +20, with five reinforcements"],fixed:["The outfit wheel turns to the right","Battle fits a phone screen","Unit art stays inside its frame","Fullscreen no longer covers Skip","A shortened name keeps its portrait","A place is drawn once, not once a chapter","World creation no longer stalls on a name","Your hero's face follows your Persona again","Banked XP now levels up on its own button","New worlds open with their prologue again","The Summon banner news shows right after the prologue","Locked events no longer pay out early","The login event no longer pops before rank 5","A finished next step clears without a refresh","World creation can be cancelled if it gets stuck","Debug now shows which model answered each call","Deleting a world now removes its art too","Hard wins now count towards their ladder","Battle Pass missions no longer sit under the Claim button","Chapter 1 is beatable with your first unit","Passives now say what they do","Help topics stop jumping around","A bad rarity tag no longer eats a character","Effect hit finally does something","New worlds now start with their Insight in the bag","Using a potion updates your bag right away","Outfits tab on every hero sheet","A new chapter always opens on Normal","Summoning and ascending can no longer charge twice","Poison goes through shields again","Hostile passives now hit the enemy, not your own team","Reloading no longer empties the outfit shelf","A refused fight now says why","Outfit directives show up in Settings","Redoing banner art keeps your Home background"]},{version:"1.3.0",new:["Inventory screen","Gear: weapons and relics","Form: three skill tracks","Facets for duplicates","Relic Vault and Tenet Trial open","Events, login and battle pass","Help Q&A in the rail"],changed:["Bigger text on unit cards"],fixed:["Unit levels update right away","Worlds list shows real progress","Story rewards always save"]},{version:"1.2.0",new:["Story chapters","Visual-novel narrator","Painted story locations","Continuity and compression"],changed:["Insight now farmed in Materials","Materials made roomier"],fixed:["Backlog readable in every style","Coin figures no longer clipped","World creation more reliable"]},{version:"1.1.0",new:["Materials farming","Formation","Level up and ascend"],changed:["Difficulty actually differs"],fixed:["Level cap could get stuck"]},{version:"1.0.0",new:["Forge a world from lorebooks","Banners and summoning","Unit roster and sheets"]}];var zr=[{id:"start",label:"Getting started"},{id:"summon",label:"Summoning"},{id:"units",label:"Your units"},{id:"fight",label:"Fights and farming"},{id:"story",label:"Story and events"}],In='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';function Bt(t,e){return'<details class="gf-faq-q" data-help="'+u(t.id)+'"'+(e?" open":"")+'><summary><span class="ic">'+In+'</span><span class="q">'+u(t.q)+'</span></summary><p class="a">'+u(t.a)+"</p></details>"}function Fr(t){return xa.filter(e=>e.topic===t)}var xa=[{id:"about",topic:"start",q:"What is Gacha Forge?",a:"A gacha game built out of your own lorebooks. The model writes the cast, you pull for them on banners, and you take the ones you get through story chapters and farming runs."},{id:"lore",topic:"start",q:"What are lorebooks for?",a:"Tick World and the forge reads what is true about the place \u2014 constant entries always, plus any whose keys come up \u2014 to 6,000 tokens. Tick Cast and it takes one entry per character it mints, from the ones it has not used yet."},{id:"loremacros",topic:"start",q:"What are the book macros?",a:"Two, and both go in an entry's Description. [5STAR] or [4STAR] puts that character in a rarity slot; [ORDER1], [ORDER2] and so on pick who goes first inside a rarity, lowest first. Case does not matter."},{id:"connections",topic:"start",q:"What is each connection for?",a:"Main connection builds your cast and the chapter plan. Narrator connection writes the prose, Compression connection summarises old chapters. Both can be a smaller model; empty means the main one."},{id:"summon",topic:"summon",q:"How do I get characters?",a:"You pull for them on a banner, in Summon. Each pull costs 160 Aether, so a ten-pull costs 1,600."},{id:"pity",topic:"summon",q:"What is pity?",a:"It stops a long dry streak. You are guaranteed a 4\u2605 or better every 10 pulls, and a 5\u2605 by your 80th. Each banner counts your pulls on its own."},{id:"featured",topic:"summon",q:"How long is a featured banner?",a:"It runs for 14 days, counted from the day it shows up. When it ends, its units are added to the permanent banner, so you can still pull them later."},{id:"dupes",topic:"summon",q:"What are duplicates for?",a:"Every extra copy of a character unlocks one of their 6 Facets, and each one changes how their kit behaves. Once they are all open, and for a repeated weapon, you get Glimmer instead."},{id:"glimmer",topic:"summon",q:"What is Glimmer?",a:"What a summon leaves behind when it has nothing else to give you. Spend it in the Shop."},{id:"vigor",topic:"fight",q:"What is Vigor?",a:"Your stamina. Every fight costs some, and you get 1 point back every 3 minutes, which is 480 a day. It stops at 60, and that limit goes up by 1 each time your commander rank does."},{id:"events",topic:"story",q:"What are Events?",a:"Extra ways to earn, separate from the story and each on its own clock. Some rotate or end, so a dot on the tab is worth opening."},{id:"aether",topic:"story",q:"Where does Aether come from?",a:"Mostly from Events, several of them, each on its own clock \u2014 and from Achievements. Story and combat nodes pay 100 each, which is a small share next to those."},{id:"levelcap",topic:"units",q:"Why won't a unit level up?",a:"Something is capping it. Ascending a unit raises its own limit through 20, 40, 50, 60, 70, 80, 90 \u2014 and on top of that, no unit can pass twice your commander rank."},{id:"materials",topic:"fight",q:"Where do materials come from?",a:"From Materials, inside Battle. There are 5 stages and 3 difficulties, costing 6, 8 and 10 Vigor a run. The harder ones give you less of a better material, and every card tells you what its run is worth."},{id:"gear",topic:"units",q:"Weapons or relics?",a:"Both, and they work differently. You choose a weapon on purpose, for its stat and because a 5\u2605 signature gives its owner a second skill. Relics are the random half: 4 slots, each rolling a main stat plus 4 subs."},{id:"form",topic:"units",q:"What is Form?",a:"It is how you train a unit's skills. There are three tracks \u2014 Ultimate, Passive and the weapon skill \u2014 and each goes up 10 levels, for 30% more at the end."},{id:"mandate",topic:"story",q:"Where do Mandates come from?",a:"Only from Events, and nothing else drops them. They come slowly, and you need them for the last steps of Form."},{id:"combat",topic:"fight",q:"How does a fight work?",a:"Your team fights on its own, so what matters is who you bring. Fire beats Water beats Wind beats Earth beats Fire, and Light and Dark beat each other. A good matchup hits for 1.5x, a bad one for 0.75x."},{id:"cp",topic:"units",q:"What is CP?",a:"A rough score for how strong a unit is with everything it is carrying. Stages tell you the CP they expect: Materials asks for 2,000, then 80,000, then 200,000."},{id:"story",topic:"story",q:"Does replaying a beat cost?",a:"No. Once you have paid for a story beat you can reopen it as often as you like. Only a node you have not played costs Vigor: 5 for a story one, 5 for a fight."},{id:"context",topic:"story",q:"What is the context warning?",a:"It means your story is getting too long to fit in one prompt. Open Settings and use Continuity to compress the older chapters into a summary."},{id:"directives",topic:"story",q:"Can I give the writer rules?",a:"Yes. In Settings, under Advanced: one set for what a chapter has to contain, another for how a beat is written. The writer follows them over its own guidance, from the next chapter on."},{id:"dot",topic:"start",q:"What is the dot?",a:"Something on that screen is waiting to be claimed. It clears itself once you have taken everything."},{id:"art",topic:"start",q:"Where does the art come from?",a:"Whichever image connection you picked when you made the world draws it: unit portraits, banner art and story backgrounds. You can turn it off in Settings, under Sources."}];var Cn={help:"left",changelog:"right"},Pr=`

:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.gf-arena {
  width: 100%;
  height: 100%;
  /* Query container so the stage can fit its 16:9 against THIS box instead of letting one
     dimension win. Named, so the query below cannot resolve against another container. */
  container-type: size;
  container-name: gfarena;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: clamp(0.5rem, 1.4vw, 1.1rem);
  padding: clamp(0.6rem, 1.4vw, 1.1rem);
  background: radial-gradient(60% 45% at 50% 108%, color-mix(in srgb, var(--coral) 10%, transparent), transparent 60%), var(--ground-2);
  font-family: var(--display);
  color: var(--text);
}

/* CONTAINED both ways: height + max-width fits to height only and breaks the ratio silently in a
   taller box. Positioned, so the view's absolute layout fills it. */
.gf-stage {
  position: relative;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: min(100cqh, calc(100cqw * 9 / 16));
  width: auto;
  aspect-ratio: 16 / 9;
  max-width: 100%;
  justify-self: center;
  background: var(--ink);
  border: 1px solid var(--steel-dark);
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45);
}

/* Never widen past 16:9: widening does not grant height, it eats it. Every screen is built for 16:9. */
.gf-view { position: relative; flex: 1; min-height: 0; }


/* The HOST goes fullscreen, so it survives inner re-renders. */
:host(:fullscreen) .gf-arena { grid-template-columns: 1fr; padding: 0; }
:host(:fullscreen) .gf-gutter { display: none; }
/* Fullscreen KEEPS the ratio. Filling and fitting are identical on a 16:9 monitor, which is why
   this hid for so long; on a landscape phone filling squashes the height. */
:host(:fullscreen) .gf-stage { border: 0; }

/* A CONTAINER, so what lives here can answer to the width it actually got. The gutter is whatever
   is left beside a 16:9 stage, so it follows the window's SHAPE: a taller window makes it
   NARROWER. Measured: 452px at 2200x900, 152 at 1920x1080, 81 at 1280x800.
   It is display:none in fullscreen, which is exactly when the player commits to the game -- so
   nothing here is ever the only place something is said. */
.gf-gutter { container-type: inline-size; align-self: stretch; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem; padding: 0.3rem 0; overflow: hidden; }
.gf-gutter-title { font-size: 0.66rem; letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding-left: 0.2rem; }
/* \u2500\u2500 the left rail: the help Q&A, collapsed \u2500\u2500
   ONE scrolling region for the whole list, never one per question: siblings that each scroll split
   the height and none finishes showing its own. */
.gf-faq { flex: 1 1 auto; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 0.3rem; padding-right: 0.2rem; }
/* Closed it shows the question and nothing else; the accent moves to the edge when it opens, so
   which one you left open reads at a glance in a column of identical rows. */
.gf-faq-q { min-width: 0; background: linear-gradient(180deg, var(--ink-2), var(--ink)); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); }
.gf-faq-q[open] { border-left-color: var(--coral); }
/* The default disclosure triangle is removed in both spellings: one browser family reads the
   list-style, the other its own pseudo-element. */
.gf-faq-q > summary { display: flex; align-items: flex-start; gap: 0.4rem; padding: 0.42rem 0.5rem; cursor: pointer; list-style: none; font-size: 0.72rem; line-height: 1.25; color: var(--text); overflow-wrap: normal; word-break: normal; }
.gf-faq-q > summary::-webkit-details-marker { display: none; }
.gf-faq-q > summary:hover { color: var(--coral); }
/* A DRAWN chevron, not a font glyph: a character inherits the style's display stack, and the five
   stacks give it five different optical centres. Every checkbox tick moved to a path for this. */
.gf-faq-q .ic { flex: none; width: 0.6rem; height: 0.6rem; margin-top: 0.16rem; color: var(--steel); transition: transform 120ms ease; }
.gf-faq-q .ic svg { display: block; width: 100%; height: 100%; }
.gf-faq-q[open] .ic { transform: rotate(90deg); color: var(--coral); }
/* The answer lines up under the question TEXT, not under the chevron. It WRAPS between words,
   never inside one -- see the note below. */
.gf-faq-q .a { margin: 0; padding: 0 0.5rem 0.5rem 1.5rem; font-size: 0.68rem; line-height: 1.35; color: var(--porcelain-3); overflow-wrap: normal; word-break: normal; }
/* The changelog is the one region of the rail that SCROLLS, inside its own box. min-height 0 is
   what lets it cede: without it a flex item will not shrink below its content and the scroll
   escapes to the gutter, which has overflow hidden and would cut the oldest releases.
   The gutter can be 0px wide and is gone in fullscreen: nothing here may be the only place. */
.gf-log { flex: 1 1 auto; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 0.7rem; padding-right: 0.2rem; }
.gf-log-rel { min-width: 0; background: linear-gradient(180deg, var(--ink-2), var(--ink)); border: 1px solid var(--ink-3); border-left: 2px solid var(--coral); padding: 0.55rem 0.6rem 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
/* The version LEADS the entry, and the running build wears the accent. The rule under it is what
   makes each release read as a BLOCK.
   It led in the dim steel until it was measured against the plate it sits on: 3.57:1 in vanguard
   and 3.83 in bloom, the two styles whose fronts are dark. A dim token is only dim where the
   palette expects it to be. */
.gf-log-rel .ver { font-family: var(--display); font-weight: 700; font-size: 0.86rem; letter-spacing: 0.08em; color: var(--text); font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--ink-3); padding-bottom: 0.35rem; }
.gf-log-rel.now .ver { color: var(--coral); border-bottom-color: color-mix(in srgb, var(--coral) 40%, transparent); }
.gf-log-grp { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
/* The three labels are the only thing that can be SCANNED here, so they carry the contrast, each
   kind with its own accent. Without this the panel read as one grey block. */
.gf-log-grp .k { font-family: var(--display); font-weight: 700; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text); }
.gf-log-grp.g-new .k { color: var(--jade); }
.gf-log-grp.g-changed .k { color: var(--amber); }
.gf-log-grp.g-fixed .k { color: var(--porcelain-3); }
/* The third label is NEUTRAL, not a third hue. In the dim steel it measured 3.57:1 in vanguard and
   3.83 in bloom -- DIMMER than the items it heads, the opposite of what a label is for. A per-style
   table is not the answer; one token that reads on ink everywhere is. After: 8.1 to 12.5. */
.gf-log-grp ul { margin: 0; padding: 0 0 0 0.7rem; list-style: none; display: flex; flex-direction: column; gap: 0.28rem; }
/* A long line WRAPS, never truncates: a clipped line lies about what shipped. */
/* The bullet is a LITERAL glyph, never a CSS escape: this sheet lives in a JS template literal, so
   JS resolves the backslash first and CSS gets a control character. The build guards it. */
/* NEVER break a word: anywhere shattered them in a narrow rail -- measured at 33px of text width
   it drew Inven/tory/scree/n, which is worse than saying nothing. */
.gf-log-grp li { position: relative; font-size: 0.72rem; line-height: 1.3; color: var(--porcelain-3); overflow-wrap: normal; word-break: normal; }
.gf-log-grp li::before { content: "\u2022"; position: absolute; left: -0.7rem; color: var(--steel-dark); }
/* FAIL HIDDEN, never fail-shredded: below this the column cannot hold two words on a line, so both
   rails leave rather than draw broken text. Nothing here may be the only place something is said,
   which is exactly why hiding it is allowed. */
@container (max-width: 140px) {
  .gf-log, .gf-faq { display: none; }
}

.gf-runs {
  display: flex; align-items: center; gap: 0.55rem; width: 100%;
  background: linear-gradient(120deg, var(--glow-2), var(--ink-2)); color: var(--text);
  border: 1px solid var(--steel-dark); border-left: 3px solid var(--coral); cursor: pointer;
  font-family: var(--display); font-weight: 700;
  font-size: 0.95rem; letter-spacing: 0.08em; text-transform: var(--case);
  padding: 0.65rem 0.7rem;
  --cut: 8px; clip-path: var(--clip-card); border-radius: var(--radius);
}
.gf-runs:hover { border-color: var(--coral); background: linear-gradient(120deg, var(--glow-1), var(--ink-2)); }
.gf-runs svg { width: 1.2rem; height: 1.2rem; color: var(--coral); flex: none; }
.gf-runs span { display: flex; flex-direction: column; line-height: 1.1; text-align: left; }
.gf-runs small { font-size: 0.62rem; font-weight: 400; letter-spacing: 0.04em; text-transform: none; color: var(--steel-faint); }

/* ONE toggle in two flavours by POSITION, never by state: inside the bar when a screen has one,
   floating at the stage corner when it does not. Exactly one is rendered at a time. */
.gf-fs-exit {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  background: color-mix(in srgb, var(--ink) 66%, transparent);
  border: 1px solid var(--steel-dark);
  color: var(--text);
  cursor: pointer;
}
.gf-fs-exit:hover { border-color: var(--coral); color: color-mix(in srgb, var(--coral) 78%, #FFFFFF); }
.gf-fs-exit svg { width: 1rem; height: 1rem; }
/* A SCREEN THAT DRAWS ITS OWN BAR OWNS THIS CORNER. The rule above says the toggle floats only
   when no bar has one -- but it only knew about the SHELL's bar, and combat draws its own INSIDE
   the stage, in the same corner. Measured: the floating button covered 41% of Skip on the user's
   phone and 9% on a 1440 desktop, so it was never right, only less visible.
   Declarative on purpose: a flag through renderShell would have to be set per screen and would go
   stale the day a second screen grows a bar. The view carries a .gf-fs-bar, this one steps aside.
   The two are mutually exclusive by construction: the shell's bar is off in battle (wantsBar). */
.gf-stage:has(.gf-view .gf-fs-bar) > .gf-fs-exit { display: none; }

/* No gutters on a narrow screen, and nothing else may live in this grid: the stage sizes itself
   against the ARENA, so an extra column breaks the ratio. */
@media (max-width: 860px) {
  .gf-arena { grid-template-columns: 1fr; padding: 0.3rem; }
  .gf-gutter { display: none; }
}

/* PORTRAIT NOTICE, shown by media query, so it costs no JS and no state. Coarse pointer is part of
   the test: a narrow desktop window is not a rotated phone. It hangs off the ARENA, not the stage,
   so it can use the letterboxed space. */
.gf-rot { display: none; }
@media (orientation: portrait) and (pointer: coarse) {
  .gf-rot {
    position: absolute;
    /* Leaves the engine's chrome free. Both numbers are the engine's own and are a SECOND COPY of
       constants a package cannot import: if it moves its bar, this covers it. */
    top: calc(env(safe-area-inset-top, 0px) + 3rem);
    right: 0;
    bottom: max(env(safe-area-inset-bottom, 0px), 0.5rem);
    left: 0;
    z-index: 70;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: calc(var(--f) * 1.2);
    padding: calc(var(--f) * 2);
    background: color-mix(in srgb, var(--ink) 94%, transparent);
    text-align: center;
  }
}
.gf-rot .gf-rot-ph { width: calc(var(--f) * 7); color: var(--coral); }
.gf-rot .gf-rot-ph svg { display: block; width: 100%; height: auto; }
.gf-rot h3 {
  margin: 0;
  font-family: var(--display); font-stretch: var(--stretch); font-weight: 700;
  font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text);
}
/* One sentence: the only thing no other element says. */
.gf-rot p { margin: 0; max-width: 30ch; font-family: var(--body); font-size: var(--t-sm); line-height: 1.4; color: var(--on-surface); }
.gf-rot button {
  cursor: pointer;
  font-family: var(--display); font-size: var(--t-md); letter-spacing: 0.12em; text-transform: var(--case);
  background: var(--coral); color: var(--on-coral); border: 0;
  padding: calc(var(--f) * 0.8) calc(var(--f) * 2.2);
  --cut: 0.55em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
`,ka='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Rn='<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1" y="1" width="12.5" height="22" rx="2"/><rect x="18.5" y="6.5" width="14.5" height="11" rx="1.8"/><path d="M15.4 7.6a6 6 0 0 1 2.6-2.4" stroke-dasharray="2.2 1.8"/><path d="M18.4 4.2l-1 2 2.1.5"/></svg>',Ln=`
  <div class="gf-rot">
    <span class="gf-rot-ph">${Rn}</span>
    <h3 data-rot-title>Landscape only</h3>
    <p data-rot-note>This game plays in a 16:9 landscape frame.</p>
    <button type="button" data-go-landscape>Play in landscape</button>
  </div>`;function Mn(t){let e=a=>!!(t&&typeof t.has=="function"&&t.has(a));return'<div class="gf-faq">'+xa.map(a=>Bt(a,e(a.id))).join("")+"</div>"}function Hr(t,e){let a=e&&e.onToggle;if(!(!a||!t||typeof t.querySelectorAll!="function"))for(let r of t.querySelectorAll("details[data-help]"))r.addEventListener("toggle",()=>a(r.getAttribute("data-help"),!!r.open))}function On(){return'<div class="gf-log">'+Ot().map(t=>'<section class="gf-log-rel'+(t.now?" now":"")+'"><div class="ver">'+u(t.version)+"</div>"+t.body+"</section>").join("")+"</div>"}function Dr(t,e){let a=ft(e&&e.style),r=e&&e.entering?" data-enter":e&&e.swapping?" data-swap":"",s=Cn[e&&e.onScreen||""]||"";return`
<div class="gf-arena" data-style="${a}">
  ${Ln}
  <aside class="gf-gutter">
    ${s==="left"?"":`<div class="gf-gutter-title">Help</div>${Mn(e&&e.help)}`}
  </aside>

  <div class="gf-stage">
    ${e&&e.bar?"":`<button class="gf-fs-exit" type="button" title="Fullscreen" aria-label="Toggle fullscreen">${ka}</button>`}
    ${e&&e.bar||""}
    <div class="gf-view"${r}>${t}</div>
    ${e&&e.overlay||""}
  </div>

  <aside class="gf-gutter">
    ${s==="right"?"":`<div class="gf-gutter-title">Changelog</div>${On()}`}
  </aside>
</div>
<style>${Ir}</style>`}var Bn="marinara_admin_secret";function zn(){try{if(typeof localStorage>"u")return{};let t=(localStorage.getItem(Bn)||"").trim();return t?{"X-Admin-Secret":t}:{}}catch{return{}}}function ve(t,e){let a=e&&typeof e=="object"?e:{};return fetch(t,{...a,headers:{...zn(),...a.headers||{}}})}var qr=`
/* THE TYPE SCALE AND RAMP, DECLARED ONCE. Copied into every screen file, a drifting copy leaves
   that screen with different type and nothing fails.
   On .gf-view AND .root -- how the shell mounts, and how a harness mounts a lone screen. cq units
   resolve against .gf-stage: it cannot be declared on the stage, an element cannot query itself. */
/* .gf-rot and .sv-modal BELONG IN THIS SAME SELECTOR, never on ramps of their own: both hang off
   the shell OUTSIDE .gf-view, and without this line --f does not exist there -- the token is read,
   undeclared, and thrown away silently. One line here, one ramp. */
.gf-view, .root, .gf-rot, .sv-modal {
  /* --f IS GEOMETRIC AND DOES NOT CARRY THE PLAYER'S SCALE: spacings and box sizes hang from it,
     so multiplying it grows the whole LAYOUT against a 16:9 stage that cannot scroll. */
  --f: clamp(7.5px, min(1.02cqw, 1.81cqh), 22px);
  --t-tiny: calc(var(--f) * 0.72 * var(--gf-type-scale, 1));
  --t-xs: calc(var(--f) * 0.85 * var(--gf-type-scale, 1));
  --t-sm: calc(var(--f) * 1.0 * var(--gf-type-scale, 1));
  --t-md: calc(var(--f) * 1.25 * var(--gf-type-scale, 1));
  --t-lg: calc(var(--f) * 1.7 * var(--gf-type-scale, 1));
  --t-xl: calc(var(--f) * 2.4 * var(--gf-type-scale, 1));
  --t-2xl: calc(var(--f) * 3.6 * var(--gf-type-scale, 1));
}

/* \u2500\u2500 The contract \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Declared on the shell so every mounted view inherits it. The per-view scale tokens are NOT here:
   they depend on container queries against each view's own .root.
   Never write a star-slash pair inside these comments -- it closes the comment early. */
.gf-arena {
  /* A long, gentle out-curve: most of the motion happens early and it settles slowly. */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 160ms;
  --dur: 380ms;
  --dur-swap: 220ms;

  /* Shape: the three chamfers the screens use -- cut bottom-right (cards), cut top-left (chips),
     slanted right edge (buttons).
     Each ELEMENT sets its own --cut and the clip is written in terms of it. A rounded style
     overrides the clips with none; setting --cut to 0 would NOT work, since a zero-cut polygon is
     still a rectangle clip and would shave the rounded corners. */
  --cut: 0.7em;
  --clip-card: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%);
  --clip-chip: polygon(var(--cut) 0, 100% 0, 100% 100%, 0 100%);
  --clip-btn: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  /* The VN speaker frame needs its own cut: --clip-chip slants the WHOLE left side, which on a
     full-height column cuts an enormous diagonal across the art. One polygon per side.
     --plate-cut is in em on purpose: --f lives on each screen's .root and does NOT exist here,
     so a value built from it computes invalid, inherits down empty, and clip-path silently
     falls back to none. */
  --plate-cut: 1.7em;
  --plate-clip-right: polygon(var(--plate-cut) 0, 100% 0, 100% 100%, 0 100%, 0 var(--plate-cut));
  --plate-clip-left: polygon(0 0, calc(100% - var(--plate-cut)) 0, 100% var(--plate-cut), 100% 100%, 0 100%);
  /* Shapes an SVG or a pseudo-element cannot take from a clip-path token. Without these two the
     loading screen kept Vanguard's geometry under every palette. */
  --emblem-cut: block;
  --emblem-round: none;
  /* The CRT scanline wash. A texture, not a colour, so it cannot come from the palette. */
  --scanlines: 0.2;
  --pip-rotate: 45deg;
  --pip-radius: 0;
  --radius: 0;
  --radius-sm: 0;
  --pill: 999px;

  /* Depth. Panels read these as a two-part box-shadow, so the "off" value cannot be none -- a
     box-shadow of none, none is invalid CSS and the whole declaration is dropped. A fully
     transparent shadow is the no-op. No backticks anywhere in this literal, comments included. */
  --panel-blur: none;
  --panel-shadow: 0 0 0 rgba(0,0,0,0);
  --panel-bevel: 0 0 0 rgba(0,0,0,0);

  /* type \u2014 --body is running text, --display is labels and figures, --title is headings */
  --body: "Segoe UI", system-ui, -apple-system, sans-serif;
  --display: "Bahnschrift", "DIN Alternate", "Oswald", "Segoe UI", system-ui, sans-serif;
  --title: var(--display);
  --title-weight: 700;
  --case: uppercase;
  --stretch: condensed;
  --track: 0.06em;
}

/* \u2500\u2500 1 \xB7 VANGUARD \u2014 sharp and industrial. THE DEFAULT.
      The exact literals the HUD shipped with, so turning the theme on changes nothing. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.gf-arena, .gf-arena[data-style="vanguard"] {
  /* The three ROLE tokens. --porcelain used to be both the light panel fill and the primary text.
     One value serves both only while the style is dark; a light style needs a white card with
     near-black text, so the roles are separate tokens now. */
  --text: #EDF1F6;        /* primary text on the dark ground */
  --surface: #EDF1F6;     /* the light panel fill */
  --on-surface: #23374F;  /* text sitting on that light panel */
  /* Text on the primary action. Hardcoded as a warm white in 29 places, which would have made
     Signal's acid-green button unreadable. Pure white purely to clear 3:1 on coral (2.97 -> 3.05). */
  --on-coral: #FFFFFF;

  --ink: #0E1420;
  --ink-2: #151D2C;
  --ink-3: #1E293B;
  --porcelain-2: #DCE4EE;
  --porcelain-3: #C7D3E2;
  --steel: #4A6E96;
  --steel-dark: #23374F;
  --steel-faint: #8AA2BC;
  --coral: #F2603C;
  --coral-deep: #C9401F;
  --amber: #F0B429;
  --amber-deep: #B8860B;
  --epic: #9B6FD4;
  --epic-deep: #6E45A6;
  --jade: #2E9E7B;
  --alarm: #E0334B;

  /* Affinity colours, in two naming schemes because the screens grew apart: formation.js reads
     --af-* and combat.js the bare names. Unifying them is its own cleanup. */
  --af-fire: #F2603C; --af-water: #3E8FD8; --af-wind: #2E9E7B;
  --af-earth: #C9902B; --af-light: #F0D060; --af-dark: #9B6FD4;
  --fire: #F2603C; --water: #4A9BD4; --wind: #2EBE9E;
  --earth: #F0B429; --light: #F5E3A2; --dark: #9B6FD4;

  /* The backdrop. Every screen paints its own gradient with its own geometry, but all draw from
     these four colours: tokenising the COLOURS and leaving the geometry is what lets a style reach
     the background without flattening the screens into one another. */
  --glow-1: #2B3D57;
  --glow-2: #1A2740;
  --ground-1: #17212F;
  --ground-2: #0B1119;
}


/* \u2500\u2500 2 \xB7 AURORA \u2014 frosted glass and gold \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      No opaque light card: --surface is translucent glass and --on-surface stays light. */
.gf-arena[data-style="aurora"] {
  --scanlines: 0;
  --text: #EDE8FA;
  --surface: rgba(255,255,255,0.09);
  --on-surface: #F0EAFB;
  --on-coral: #201735;

  --ink: #0C0A1C;
  --ink-2: #171334;
  --ink-3: #251E45;
  --porcelain-2: rgba(255,255,255,0.14);
  --porcelain-3: #C3B8E0;
  --steel: #A98BE0;
  --steel-dark: #3A2E63;
  --steel-faint: #AEA0CE;
  --coral: #E8C87A;
  --coral-deep: #C9A75C;
  --amber: #F5D98A;
  --amber-deep: #C9A75C;
  --epic: #B79BEA;
  --epic-deep: #7E5FC0;
  --jade: #8ED9B0;
  --alarm: #D6415C;
  --af-water: #7FA8E8; --af-earth: #D8B368; --af-light: #F2E2A8;
  --water: #7FA8E8; --earth: #E8C87A; --light: #F5E8C0;
  --glow-1: #3A2E63;
  --glow-2: #2A1F4A;
  --ground-1: #171334;
  --ground-2: #07060F;

  --clip-card: none; --clip-chip: none; --clip-btn: none;
  --plate-clip-right: none; --plate-clip-left: none;
  --emblem-cut: none; --emblem-round: block;
  --pip-rotate: 0deg; --pip-radius: 50%;
  --radius: 14px;
  --radius-sm: 8px;
  --panel-blur: blur(16px);
  --panel-shadow: 0 16px 34px -20px rgba(0,0,0,0.9);
  --panel-bevel: inset 0 1px 0 rgba(255,255,255,0.14);

  --title: Georgia, "Times New Roman", serif;
  --title-weight: 400;
  --case: none;
  --stretch: normal;
  --track: 0.01em;
}

/* \u2500\u2500 3 \xB7 BLOOM \u2014 bright and playful \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      The one light style. The PAGE is a deep blue-grey and the cards are white on top of it: the
      first pass was white on near-white and everything dissolved. */
.gf-arena[data-style="bloom"] {
  --scanlines: 0;
  --text: #EAF1FC;
  --surface: #FFFFFF;
  --on-surface: #16233A;
  --on-coral: #FFFFFF;

  /* Darker than the page gradient on purpose: a lighter ink left --steel with no room to read on
     both white cards and dark panels at once (measured 2.85). */
  --ink: #16223A;
  --ink-2: #1D2B45;
  --ink-3: #2B3F63;
  --porcelain-2: #EEF3FB;
  --porcelain-3: #D2DDEE;
  --steel: #6E86AE;
  --steel-dark: #45566F;
  --steel-faint: #C3D2E8;
  --coral: #528CF7;
  --coral-deep: #1B4FD1;
  --amber: #FFB13D;
  --amber-deep: #C97F12;
  --epic: #7A6BE0;
  --epic-deep: #5A49C0;
  --jade: #22A873;
  --alarm: #E0356F;
  --af-water: #3A7BFF; --af-wind: #22A873; --af-earth: #D98A18; --af-light: #FFD86B;
  --water: #3A7BFF; --wind: #22A873; --earth: #FFB13D; --light: #FFE7A8;
  --glow-1: #3E6BC4;
  --glow-2: #B94E80;
  --ground-1: #2B3F63;
  --ground-2: #1D2B45;

  --clip-card: none; --clip-chip: none; --clip-btn: none;
  --plate-clip-right: none; --plate-clip-left: none;
  --emblem-cut: none; --emblem-round: block;
  --pip-rotate: 0deg; --pip-radius: 50%;
  --radius: 20px;
  --radius-sm: 12px;
  --panel-blur: none;
  --panel-shadow: 0 14px 30px -14px rgba(0,0,0,0.62);
  --panel-bevel: 0 0 0 rgba(0,0,0,0);

  --title: "Segoe UI", system-ui, sans-serif;
  --title-weight: 800;
  --case: none;
  --stretch: normal;
  --track: 0;
}

/* \u2500\u2500 4 \xB7 SIGNAL \u2014 technical and minimal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.gf-arena[data-style="signal"] {
  --scanlines: 0.24;
  --text: #FFFFFF;
  --surface: rgba(255,255,255,0.06);
  --on-surface: #E8EAEE;
  --on-coral: #0B0C0E;

  --ink: #08090B;
  --ink-2: #0C0D10;
  --ink-3: #16181D;
  --porcelain-2: rgba(255,255,255,0.10);
  --porcelain-3: #AEB4BE;
  --steel: #9AA1AC;
  --steel-dark: #2A2E36;
  --steel-faint: #8B929C;
  --coral: #C8FF3D;
  --coral-deep: #A6DA1E;
  --amber: #FFD84D;
  --amber-deep: #C9A422;
  --epic: #9B8CFF;
  --epic-deep: #6E5CD8;
  --jade: #3DFFB0;
  --alarm: #E23548;
  --af-fire: #FF7A45; --af-water: #4DD2FF; --af-wind: #3DFFB0;
  --af-earth: #FFD84D; --af-light: #EAFF9E; --af-dark: #9B8CFF;
  --fire: #FF7A45; --water: #4DD2FF; --wind: #3DFFB0;
  --earth: #FFD84D; --light: #EAFF9E; --dark: #9B8CFF;
  --glow-1: #16181D;
  --glow-2: #101318;
  --ground-1: #0C0D10;
  --ground-2: #08090B;

  --clip-card: none; --clip-chip: none; --clip-btn: none;
  --plate-clip-right: none; --plate-clip-left: none;
  --emblem-cut: none; --emblem-round: block;
  --pip-rotate: 0deg; --pip-radius: 50%;
  --radius: 2px;
  --radius-sm: 2px;
  --panel-blur: none;
  --panel-shadow: 0 20px 40px -28px #000;
  --panel-bevel: 0 0 0 rgba(0,0,0,0);

  --title: "Segoe UI", system-ui, sans-serif;
  --title-weight: 300;
  --case: none;
  --stretch: normal;
  --track: -0.01em;
}

/* \u2500\u2500 5 \xB7 EMBER \u2014 warm and painted \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      Like Aurora, the panels are dark. */
.gf-arena[data-style="ember"] {
  --scanlines: 0.08;
  --text: #F5E7CE;
  --surface: #53381F;
  --on-surface: #F0D9A8;
  --on-coral: #3A2410;

  --ink: #170F0B;
  --ink-2: #241811;
  --ink-3: #3A2A1E;
  --porcelain-2: #6B4A2A;
  --porcelain-3: #C0A67C;
  --steel: #C89A4A;
  --steel-dark: #7A5730;
  --steel-faint: #BC9C70;
  --coral: #F0B429;
  --coral-deep: #C9821A;
  --amber: #FFD574;
  --amber-deep: #E0921F;
  --epic: #C08BE0;
  --epic-deep: #9560B8;
  --jade: #7BC47F;
  --alarm: #E0483A;
  --af-water: #6FA8C9; --af-wind: #7BC47F; --af-light: #F5DFA0;
  --water: #6FA8C9; --wind: #7BC47F; --light: #F5DFA0;
  --glow-1: #6B4A2A;
  --glow-2: #4A2A18;
  --ground-1: #3A2A1E;
  --ground-2: #170F0B;

  --clip-card: none; --clip-chip: none; --clip-btn: none;
  --plate-clip-right: none; --plate-clip-left: none;
  --emblem-cut: none; --emblem-round: block;
  --pip-rotate: 0deg; --pip-radius: 50%;
  --radius: 18px;
  --radius-sm: 10px;
  --panel-blur: none;
  --panel-shadow: 0 14px 28px -16px #000;
  --panel-bevel: inset 0 2px 0 rgba(255,220,160,0.18), inset 0 -3px 8px rgba(0,0,0,0.5);

  --title: Georgia, "Times New Roman", serif;
  --title-weight: 700;
  --case: none;
  --stretch: normal;
  --track: 0.01em;
}

/* \u2500\u2500 Scrollbars \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Regions inside a screen may scroll, and the browser's default bar looks nothing like the game.
   Both syntaxes: the standard one for Firefox, the WebKit pseudo-elements for Chromium. */
* { scrollbar-width: thin; scrollbar-color: var(--steel-dark) transparent; }
::-webkit-scrollbar { width: 0.55rem; height: 0.55rem; }
::-webkit-scrollbar-track { background: color-mix(in srgb, var(--ink) 45%, transparent); }
::-webkit-scrollbar-thumb {
  background: var(--steel-dark);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: var(--steel); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }

/* \u2500\u2500 Transitions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Every repaint replaces the markup wholesale, which read as a hard cut. TWO kinds, because they
   are not the same event: [data-enter] you moved to a different SCREEN, a fuller move with a rise;
   [data-swap] the same screen repainted with new content, a short cross-fade with no movement.
   The bar is deliberately outside the animated view, which is what makes it feel anchored. */
@keyframes gf-view-enter {
  from { opacity: 0; transform: translateY(1.1%) scale(0.992); }
  to { opacity: 1; transform: none; }
}
@keyframes gf-view-swap {
  from { opacity: 0; transform: translateY(0.5%); }
  to { opacity: 1; transform: none; }
}
.gf-view[data-enter] { animation: gf-view-enter var(--dur) var(--ease) both; }
/* A swap animates the CONTENT REGION, never the whole screen: fading the view dipped the header
   and the tab bar too, so switching a tab made the control you just clicked blink. A screen opts
   in by marking its body; one that marks nothing does not animate, which beats a flash. */
.gf-view[data-swap] .gf-swap { animation: gf-view-swap var(--dur-swap) var(--ease) both; }

@media (prefers-reduced-motion: reduce) {
  .gf-view[data-enter], .gf-view[data-swap] .gf-swap { animation-duration: 0.01ms; }
}
`;var zt={funds:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/></svg>',xp:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.2 5 5.3.5-4 3.6 1.2 5.3L12 14.7 7.3 17.4l1.2-5.3-4-3.6L9.8 8z"/></svg>',asc:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',relic:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3h8l4 6-8 12L4 9z"/><path d="M4 9h16M8 3l-1 6 5 12 5-12-1-6"/></svg>',aether:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 4 12l8 10 8-10z"/><path d="M4 12h16M12 2v20"/></svg>',form:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M8.5 7.5h6M8.5 11h4"/></svg>',mandate:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M9.6 9.2l1.7 1.7 3.1-3.4"/><path d="M8 13.4 6.5 21l5.5-2.6L17.5 21 16 13.4"/></svg>',rank:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.6 5.6L21 9.4l-4.5 4.3 1.1 6.3L12 17l-5.6 3 1.1-6.3L3 9.4l6.4-.8z"/></svg>'};function ne(t){return zt[String(t)]||zt.funds}var Fn=["Breakwater clash","Pier skirmish","Drowned checkpoint","The undertow","Last berth"],Pn=10,Qe=[{key:"normal",label:"Normal",all:!0,tag:""},{key:"hard",label:"Hard",all:!1,tag:"Rare"},{key:"veryhard",label:"Very Hard",all:!1,tag:"Epic"}],$r=t=>Qe.find(e=>e.key===t)||Qe[0],Hn=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function we(t){return Hn[t]||String(t)}function jr(t){if(t&&Array.isArray(t.nodes))return t.nodes;let e=t&&Array.isArray(t.storyNodes)?t.storyNodes:[],a=[];for(let r=0;r<e.length;r+=1)a.push({type:"story",title:e[r].title,goal:e[r].goal,guide:e[r].guide}),a.push({type:"combat",title:Fn[r]||`Battle ${r+1}`,setup:""});return a}function ut(t){return jr(t).filter(e=>e.type==="combat").length}function De(t,e){let a=jr(t),r=[],s=0,o=0;for(let i of a)i.type==="combat"?(r.push({...i,type:"combat",title:i.title||`Battle ${o+1}`,setup:i.setup||"",combatIndex:o}),o+=1):(r.push({...i,type:"story",title:i.title||`Story beat ${s+1}`,storyIndex:s}),s+=1);return $r(e).all?r:r.filter(i=>i.type==="combat")}function Ur(t,e,a){return t==="normal"?!0:t==="hard"?(e.normal||0)>=Pn:(e.hard||0)>=(a||0)}function Ft(t,e,a){let r=e||{};for(let s=Qe.findIndex(o=>o.key===t);s>=0;s-=1)if(Ur(Qe[s].key,r,a))return Qe[s].key;return"normal"}var Wr=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */






  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
}

.stage {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background:
    radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%),
    radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%),
    linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%);
}

/* hoistHeadIntoBar REMOVES the .cap-head, so this box is left with TWO children, not three. As
   three fixed rows the scroll region landed on an AUTO row, sized to its content, and the 1fr went
   to a row with nothing in it. The third row is declared only while the head is here, and the LAST
   row is the elastic one either way. */
.cap {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  pointer-events: none;
}
.cap:has(> .cap-head) { grid-template-rows: auto auto minmax(0, 1fr); }
/* The padding goes with the head it left with, so the pills landed flush against the bar.
   Restored under :not() so it never doubles up. */
.cap:not(:has(> .cap-head)) .cap-diff { padding-top: var(--sp-2); }

.cap-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3) var(--sp-1);
  pointer-events: auto;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.4);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--on-surface);
  border: 0;
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-sm);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.5) var(--sp-2);
  cursor: pointer;
  --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm);
}
.back:hover { background: #FFFFFF; }

.cap-id { min-width: 0; }
.cap-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.cap-id h2 {
  margin: 0;
  font-family: var(--title);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-xl);
  line-height: 1.05;
  letter-spacing: 0.02em;
  color: var(--text);
}

/* THE NODE TALLY IS GONE, AND ITS CSS WITH IT. This header is HOISTED, so the counter travelled up
   and ate 18 ramp units of an already oversubscribed title slot: measured at 1440x960 and 150%, the
   slot has 338px of 1381 and Back takes 155, so the title came out cut. The screen below already
   says it row by row. It leaves the MARKUP too: emitting something for the hoist to throw away is
   drawing what nobody sees. */

.cap-diff { display: flex; align-items: center; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-2); pointer-events: auto; }
.diff-pills { display: flex; gap: calc(var(--f) * 0.4); }
.diff-pill {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.45);
  background: color-mix(in srgb, var(--surface) 10%, transparent);
  border: 1px solid var(--steel-dark);
  color: var(--steel-faint);
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-sm);
  letter-spacing: 0.12em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.45) var(--sp-2);
  cursor: pointer;
  --cut: 0.4em; clip-path: var(--clip-card); border-radius: var(--radius);
  transition: color 140ms ease, border-color 140ms ease, background 140ms ease; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.diff-pill:hover { color: var(--text); border-color: var(--steel); }
.diff-pill[aria-selected="true"] { background: var(--coral); color: var(--on-coral); border-color: var(--coral); }
.diff-pill .lock { font-size: calc(var(--f) * 1 * var(--gf-type-scale, 1)); opacity: 0.85; }
/* --t-sm and NOT --t-xs: this line stopped being a label the day it carried the required CP, the
   number the player decides on. Measured, --t-xs rendered it at 8.67px. */
.diff-hint { margin-left: auto; font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
/* The NUMBER cannot share the sentence's muted tone: a figure painted with a label's token already
   measured 1.4:1 once, i.e. absent. */
.diff-hint b { color: var(--text); font-weight: 700; }

.cap-scroll { min-height: 0; overflow: auto; pointer-events: auto; }
/* The Preview band left with the view that produced it: a locked difficulty can no longer be
   selected. A stylesheet with no consumer never fails, which is why it goes now. */

.node-list {
  padding: 0 var(--sp-3) var(--sp-4);
  display: flex;
  flex-direction: column;
  max-width: calc(var(--f) * 82);
  width: 100%;
  margin: 0 auto;
}

.node-row { display: grid; grid-template-columns: calc(var(--f) * 4.5) 1fr auto; align-items: stretch; gap: var(--sp-2); }

.node-rail { position: relative; display: flex; align-items: center; justify-content: center; }
.node-rail::before { content: ""; position: absolute; top: 0; bottom: 0; width: 2px; background: var(--steel-dark); }
.node-row:first-child .node-rail::before { top: 50%; }
.node-row:last-child .node-rail::before { bottom: 50%; }
.node-idx {
  position: relative;
  z-index: 1;
  width: calc(var(--f) * 2.8);
  height: calc(var(--f) * 2.8);
  display: grid;
  place-items: center;
  background: var(--ink-2);
  border: 2px solid var(--steel-dark);
  color: var(--steel-faint);
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-md);
  font-variant-numeric: tabular-nums;
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius); backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }

.node-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(var(--f) * 0.2);
  background: var(--surface);
  color: var(--on-surface);
  padding: var(--sp-2) var(--sp-3);
  margin: calc(var(--f) * 0.35) 0;
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  border-left: 3px solid var(--steel-faint); backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.node-card .kind { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.5); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel); }
.node-card .kind svg { width: calc(var(--f) * 1.4); height: calc(var(--f) * 1.4); }
.node-card .title { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.03em; line-height: 1.15; color: var(--on-surface); }
.node-card .meta { display: flex; align-items: center; gap: var(--sp-2); margin-top: calc(var(--f) * 0.35); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.06em; color: var(--steel); font-variant-numeric: tabular-nums; }
.node-card .cost, .node-card .prize { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.35); }
.node-card .meta svg { width: calc(var(--f) * 1.2); height: calc(var(--f) * 1.2); }
.tag { font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; text-transform: var(--case); padding: 0 calc(var(--f) * 0.4); border: 1px solid; }
.tag.rare { color: #9A6B08; border-color: color-mix(in srgb, var(--amber) 55%, transparent); }
.tag.epic { color: var(--coral-deep); border-color: color-mix(in srgb, var(--coral) 55%, transparent); }

.node-action { display: flex; align-items: center; justify-content: flex-end; }
.act {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--f) * 0.2);
  border: 0;
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.7) var(--sp-3);
  cursor: pointer;
  white-space: nowrap;
  transition: background 140ms ease, border-color 140ms ease;
}
.act small { font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); font-weight: 400; letter-spacing: 0.06em; text-transform: none; opacity: 0.9; }
.act.play { background: var(--coral); color: var(--on-coral); --cut: 0.7em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.act.play:hover { background: var(--coral-deep); }
.act.play:focus-visible { outline: none; box-shadow: inset 0 0 0 2px #FFFFFF; }
.act.start { background: transparent; color: var(--text); border: 1px solid var(--steel); }
.act.start small { color: var(--steel-faint); }
.act.start:hover { border-color: var(--coral); color: #FFFFFF; }
/* Replaying a beat already seen, QUIETER than Start: a cleared row must not compete with the row
   you are on. The green is the Cleared mark's, so the row does not change vocabulary. */
.act.again { background: transparent; color: var(--jade); border: 1px solid color-mix(in srgb, var(--jade) 45%, transparent); }
.act.again small { color: var(--steel-faint); }
.act.again:hover { border-color: var(--jade); background: color-mix(in srgb, var(--jade) 12%, transparent); }
.act.again:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--jade); }
.mark { font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); padding: 0 var(--sp-2); white-space: nowrap; }
.mark.done { color: var(--jade); }
.mark.locked { color: var(--steel-faint); }

.node-row.done .node-idx { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.node-row.done .node-card { background: var(--porcelain-2); border-left-color: var(--jade); }
.node-row.done .title { color: var(--steel); }
.node-row.done .meta { opacity: 0.6; }

.node-row.current .node-idx { border-color: var(--coral); color: var(--coral); animation: cap-pulse 1.3s ease-in-out infinite; }
.node-row.current .node-card { border-left-color: var(--coral); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 35%, transparent); }
@keyframes cap-pulse { 50% { box-shadow: 0 0 0 calc(var(--f) * 0.4) color-mix(in srgb, var(--coral) 22%, transparent); } }

.node-row.locked .node-idx { opacity: 0.55; }
.node-row.locked .node-card { background: color-mix(in srgb, var(--surface) 30%, var(--ink-2)); color: var(--steel-faint); border-left-color: var(--ink-3); }
.node-row.locked .title { color: var(--steel-faint); }
.node-row.locked .meta { opacity: 0.5; }

.cap-end { margin: var(--sp-2) auto 0; max-width: calc(var(--f) * 60); text-align: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.06em; text-transform: var(--case); color: var(--jade); }
.cap-end[hidden] { display: none; }

/* A map notice goes where the player just tapped, not in a corner: a reason you have to go looking
   for is a reason nobody reads. */
.notice { margin: 0 0 var(--sp-2); font-size: var(--t-sm); color: var(--coral); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Dn='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',qn='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4l9 9M20 4l-9 9M14.5 14.5 20 20M9.5 14.5 4 20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',$n='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 4 13.5h6L11 22l9-11.5h-6Z" fill="#2E9E7B" stroke="#1C6B54" stroke-width="1.2" stroke-linejoin="round"/></svg>';var _a=t=>String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",");function jn(t,e){let a=t&&t[e.type==="combat"?"combat":"story"];if(!a)return"";let r=(i,n)=>'<span class="prize">'+ne(i)+n+"</span>",s=[];Number(a.funds)>0&&s.push(r("funds",_a(a.funds))),Number(a.aether)>0&&s.push(r("aether",_a(a.aether)));let o=Number(a.insight&&a.insight.shard)||0;return o>0&&s.push(r("xp",String(o))),Number(a.rank)>0&&s.push(r("rank","+"+_a(a.rank))),`<span class="meta"><span class="cost">${$n}${Number(a.vigor)||0}</span>${s.join("")}</span>`}function Un(t,e,a){return t<a?e.type==="story"?`<button class="act again" type="button" data-replay="${t}"><span>Read again</span><small>&#10004; cleared &middot; free</small></button>`:'<span class="mark done">&#10004; Cleared</span>':t===a?e.type==="story"?'<button class="act play" type="button" data-play><span>Play</span><small>story beat</small></button>':'<button class="act start" type="button" data-start><span>Start</span><small>auto-battle</small></button>':'<span class="mark locked">&#128274; Locked</span>'}function Wn(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function Vn(t,e){let a=t&&Number.isFinite(Number(t[e]))?Number(t[e]):null;return a===null?"Higher difficulty &middot; harder fight, better rewards":a<=0?"Opening chapter &middot; no CP asked yet":`Recommended CP <b>${Wn(a)}</b> &middot; harder fight, better rewards`}function Vr({plan:t,difficulty:e,progress:a,chapterNumber:r=1,pay:s=null,cp:o=null,notice:i=""}){let n=t&&t.title||"Chapter",l=ut(t),d=Ft(e,a,l),h=$r(d),f=De(t,d),m=a[d]||0,v=Qe.map(c=>{let y=c.key===d,E=Ur(c.key,a,l),T=E?"":'<span class="lock">&#128274;</span>',R=c.key==="hard"?"Clear Normal to unlock":"Clear Hard to unlock";return`<button class="diff-pill" type="button" role="tab" aria-selected="${y}" data-diff="${c.key}"${E?"":` disabled title="${R}"`}>${c.label}${T}</button>`}).join(""),b=f.map((c,y)=>{let E=y<m?"done":y===m?"current":"locked",T=c.type==="story"?"Story":"Combat",R=String(y+1).padStart(2,"0");return`<div class="node-row ${E}"><div class="node-rail"><span class="node-idx">${R}</span></div><div class="node-card"><span class="kind">${c.type==="story"?Dn:qn}${T}</span><span class="title">${u(c.title)}</span>`+jn(s,c)+`</div><div class="node-action">${Un(y,c,m)}</div></div>`}).join(""),w=m>=f.length?`<div class="cap-end">${h.all?"Chapter":u(h.label)} complete</div>`:"";return`
<div class="root">
  <div class="stage"></div>
  <div class="cap">
    <div class="cap-head">
      <button class="back" type="button" data-back>&#9664; Command</button>
      <div class="cap-id"><div class="eyebrow">Chapter ${we(r)}</div><h2>${u(n)}</h2></div>
    </div>
    <div class="cap-diff">
      <div class="diff-pills">${v}</div>
      <span class="diff-hint">${Vn(o,d)}</span>
    </div>
    <div class="cap-scroll">
      <p class="notice"${i?"":" hidden"}>${u(i)}</p>
      <div class="node-list">${b}${w}</div>
    </div>
  </div>
</div>`}function Gr(t,e){let{plan:a,difficulty:r,progress:s,onBack:o,onDifficulty:i,onPlayStory:n,onStartCombat:l,onReplayStory:d}=e,h=t.querySelector("[data-back]");h&&h.addEventListener("click",()=>o&&o());for(let y of t.querySelectorAll("[data-diff]"))y.addEventListener("click",()=>{y.disabled||i&&i(y.dataset.diff)});let f=Ft(r,s,ut(a)),m=De(a,f),v=m[s[f]||0],b=t.querySelector("[data-play]");b&&v&&b.addEventListener("click",()=>n&&n(v));let w=t.querySelector("[data-start]");w&&v&&w.addEventListener("click",()=>l&&l(v));let c=s[f]||0;for(let y=0;y<c&&y<m.length;y+=1){if(m[y].type!=="story")continue;let E=t.querySelector('[data-replay="'+y+'"]');E&&E.addEventListener("click",((T,R)=>()=>d&&d(T,R))(m[y],y))}}var Pt=[{id:"all",label:"All"},{id:"5",label:"5&#9733;",tone:"g"},{id:"4",label:"4&#9733;",tone:"e"}];function Gn(t){return(Number(t)||0).toLocaleString("en-US")}var Sa={roster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20c0-2.8 2-4.6 4.6-4.6"/></svg>',formation:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="5.5" height="5.5"/><rect x="9.5" y="4" width="5.5" height="5.5"/><rect x="16" y="4" width="5.5" height="5.5"/><rect x="3" y="14" width="5.5" height="5.5"/><rect x="9.5" y="14" width="5.5" height="5.5"/></svg>',summon:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16l-1.4 12H5.4z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>',inventory:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5V18l-9 4.5L3 18z"/><path d="M3 9.5 12 14l9-4.5M12 14v8.5"/></svg>',events:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5V6h18v2.5a2 2 0 0 0 0 4V15H3v-2.5a2 2 0 0 0 0-4z"/><path d="M9 6v9" stroke-dasharray="2 2"/></svg>',missions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg>'},Jr='<svg class="hm-figure" viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>',Zr=[{id:"roster",label:"Units",live:!0},{id:"formation",label:"Formation",live:!0},{id:"summon",label:"Summon",live:!0},{id:"shop",label:"Shop",live:!0},{id:"inventory",label:"Inventory",live:!0}],Qr=[{id:"events",label:"Events",live:!0},{id:"missions",label:"Achievements",live:!0}];function Yn(t,e){let a="";for(let r=0;r<t;r+=1){let s=r<e?' class="done"':r===e?' class="now"':"";a+=`<i${s}></i>`}return a}var Kn=[{id:"story",label:"Story",live:!0},{id:"banner",label:"Banners",live:!0},{id:"bond",label:"Bond",live:!1},{id:"event",label:"Events",live:!1},{id:"unit",label:"Units",live:!1}],Xn=[{id:"default",label:"Default"},{id:"outfit",label:"Outfits"}];function Yr({kind:t,title:e,rail:a,source:r,items:s,current:o,currentName:i,none:n,emptyHint:l,mode:d}){let h=a.map(w=>{let c=w.live!==!1;return'<button class="hm-pk-cat'+(c?"":" off")+'" type="button"'+(c?` aria-selected="${w.id===r}" data-pk-src="${u(w.id)}"`:" disabled")+`><span>${w.label}</span>`+(c?"":'<span class="soon">Soon</span>')+"</button>"}).join(""),f=w=>'<button class="hm-pk-card'+(w.key===o?" on":"")+`" type="button" data-pk-take="${u(w.key)}"><span class="shot">${w.url?`<img src="${u(w.url)}" alt="">`:Jr}</span><span class="nm">${u(w.name)}</span>`+(w.kit?`<span class="kit"><b>${Number(w.rarity)||0}&#9733;</b> ${u(w.kit)}</span>`:"")+(w.key===o?'<span class="tag">In use</span>':"")+"</button>",v=(n?'<button class="hm-pk-card none'+(o?"":" on")+'" type="button" data-pk-take=""><span class="shot"><span>None</span></span><span class="nm">No background</span>'+(o?"":'<span class="tag">In use</span>')+"</button>":"")+(s.length?s.map(f).join(""):`<p class="hm-pk-empty">${u(l)}</p>`),b=d?'<div class="hm-pk-mode">'+Xn.map(w=>'<button class="hm-pk-cat" type="button" aria-selected="'+(w.id===d)+'" data-pk-mode="'+w.id+'"><span>'+w.label+"</span></button>").join("")+"</div>":"";return`
  <div class="hm-pk-wrap">
    <div class="hm-pk-veil" data-pk-close></div>
    <div class="hm-pk ${t}">
      <div class="hm-pk-head">
        <span class="ttl">${u(e)}</span>
        <span class="cur">${u(i||"None")}</span>
        <button class="x" type="button" data-pk-close>Close</button>
      </div>
      <div class="hm-pk-body">
        <div class="hm-pk-cats">${h}</div>
        <div class="hm-pk-col">${b}<div class="hm-pk-grid">${v}</div></div>
      </div>
    </div>
  </div>`}function Jn(t,e,a){if(!t)return"";let r=e||{},s=a||{};if(t.slot==="bg"){let h=t.source||"story",f=r.backgrounds&&r.backgrounds[h]||[],m=s.bg?s.bg.key:"";return Yr({kind:"bg",title:"Background",rail:Kn,source:h,items:f,current:m,currentName:s.bg?s.bg.name:"",none:!0,emptyHint:h==="banner"?"Banner art appears here once a banner has its picture painted.":"Story backgrounds are painted as your chapters reach a new place."})}let o=t.source||"all",i=t.mode==="outfit",l=(i?r.outfits||[]:r.units||[]).filter(h=>o==="all"||String(h.rarity)===o),d=i?s.unitOutfit||"":s.unit?s.unit.id:"";return Yr({kind:"units",title:"Home unit",rail:Pt,source:o,mode:i?"outfit":"default",items:l,current:d,currentName:s.unit?s.unit.name:"",none:!1,emptyHint:i?"No outfits unlocked yet.":o==="all"?"No characters yet.":`No ${o}-star characters yet. Summon on any banner to find one.`})}function Kr(t){let e=Number(t)||0;return e>=1e3?(e%1e3===0?String(e/1e3):(e/1e3).toFixed(1))+"k":String(e)}var Zn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.2v.6"/></svg>',Qn=t=>(Zr.find(e=>e.id===t)||Qr.find(e=>e.id===t)||{label:"Battle"}).label;function el(t,e){return!t||!t.action||!t.detail||e?"":'<button class="hm-next" type="button" data-next-go="'+u(t.go||"")+'"><span class="eyebrow">Next step</span><span class="big">'+u(t.action)+'</span><span class="title">'+u(t.detail)+'</span><span class="go">'+u(Qn(t.go))+"</span></button>"}function Xr(t,e){let a=Number(t)||0,r=Number(e)||0;return a>0&&r>0&&a>=r?'<button class="hm-warn" type="button" data-open-continuity aria-label="Story context is past your threshold \u2014 open Continuity"><span class="ic">'+Zn+'</span><span class="tx"><span class="k">Story context</span><span class="n"><b>'+Kr(a)+"</b> / "+Kr(r)+'</span></span><span class="go">Compress</span></button>':""}function es({plan:t,chapterNumber:e=1,nodesDone:a=0,decor:r=null,contextTokens:s=0,warnTokens:o=0,pick:i=null,pickOptions:n=null,alerts:l=null,locks:d=null,step:h=null}){let f=!!(t&&typeof t=="object"&&t.title),m=`Chapter ${we(e)}`,b=(f?De(t):[]).length||10,w=Math.max(0,Math.min(b,Number(a)||0)),c=r&&typeof r=="object"?r:{},y=c.bg&&c.bg.url?c.bg:null,E=c.unit||null,T=D=>d&&d[D.id]||null,R=D=>D.live!==!1&&!T(D),W=D=>{if(D.live===!1)return'<span class="soon">Soon</span>';let X=T(D);return X?'<span class="soon">'+u(X.rank?"Rank "+X.rank:"Prologue")+"</span>":""},O=D=>h&&h.go===D.id&&R(D)?'<span class="hm-dot"></span>':"",U=D=>`<button class="hm-tile ${D.id}${R(D)?"":" off"}" type="button"`+(R(D)?` data-go="${D.id}"`:" disabled")+">"+Sa[D.id]+`<span class="nm">${u(D.label)}</span>`+W(D)+O(D)+"</button>",F=D=>l&&l[D.id]?'<span class="hm-dot"></span>':O(D),j=D=>R(D)?`<button class="hm-side" type="button" data-go="${D.id}"><span class="lbl">${Sa[D.id]}<span>${u(D.label)}</span></span>`+F(D)+"</button>":`<button class="hm-side off" type="button" disabled><span class="lbl">${Sa[D.id]}<span>${u(D.label)}</span></span>`+W(D)+"</button>";return`
<div class="root">
  <div class="hm-screen">
    ${y?`<img class="hm-bg" src="${u(y.url)}" alt="">`:'<div class="hm-ground"></div>'}
    <div class="hm-scrim"></div>

    <div class="hm-scene">
      <div class="hm-plate">
        <div class="hm-art">${E&&E.portrait?`<img src="${u(E.portrait)}" alt="">`:Jr}</div>
        <button class="hm-slot hm-slot-unit" type="button" data-pick="unit">
          <span class="nm">${u(E&&E.name?E.name:"No unit set")}</span>
          <span class="swap">Change</span>
        </button>
      </div>

      <div class="hm-right">
        <button class="hm-slot hm-slot-bg" type="button" data-pick="bg">
          <span class="nm">${u(y?y.name:"No background set")}</span>
          <span class="swap">Change</span>
        </button>

        <div class="hm-rail">${Qr.map(j).join("")}</div>
${Xr(s,o)}
${el(h,!!Xr(s,o))}
        <button class="hm-cta" type="button" data-open-modes>
          <span class="eyebrow">${u(m)}</span>
          <span class="big">Battle</span>
          <span class="title">${u(f?t.title:"Your world is forged")}</span>
          <span class="nodes">${Yn(b,w)}<span>${f?`${w} of ${b} cleared`:"Not started"}</span></span>
          <span class="go">${w>0?"Continue":"Begin"}</span>
        </button>
      </div>
    </div>

    <div class="hm-dock">${Zr.map(U).join("")}</div>
  </div>
${Jn(i,n,c)}
</div>`}function ts(t,{onOpenModes:e,onOpenRoster:a,onOpenSummon:r,onOpenFormation:s,onOpenInventory:o,onOpenShop:i,onOpenEvents:n,onOpenMissions:l,onPickOpen:d,onPickClose:h,onPickSource:f,onPickTake:m,onPickMode:v}){for(let c of t.querySelectorAll("[data-open-modes]"))c.addEventListener("click",()=>e&&e());let b={roster:a,formation:s,summon:r,inventory:o,shop:i,events:n,missions:l};for(let c of t.querySelectorAll("[data-go]")){let y=b[c.getAttribute("data-go")];c.addEventListener("click",E=>{E&&typeof E.stopPropagation=="function"&&E.stopPropagation(),y&&y()})}for(let c of t.querySelectorAll("[data-next-go]")){let y=c.getAttribute("data-next-go"),E=y==="modes"?e:b[y];c.addEventListener("click",T=>{T&&typeof T.stopPropagation=="function"&&T.stopPropagation(),E&&E()})}(t.querySelector(".root")||t).addEventListener("click",c=>{let y=O=>c&&c.target&&c.target.closest?c.target.closest(O):null,E=y("[data-pick]");if(E){d&&d(E.getAttribute("data-pick"));return}if(y("[data-pk-close]")){h&&h();return}let T=y("[data-pk-src]");if(T){f&&f(T.getAttribute("data-pk-src"));return}let R=y("[data-pk-mode]");if(R){v&&v(R.getAttribute("data-pk-mode"));return}let W=y("[data-pk-take]");W&&m&&m(W.getAttribute("data-pk-take"))})}var as=`
.ul-modal {
  position: absolute; inset: 0; z-index: 41;
  display: grid; place-items: center; pointer-events: auto;
  font-family: var(--body); color: var(--text);
  /* The modal lives OUTSIDE .gf-bar, so it inherits no ramp: it declares the same one, exactly as
     .gf-vm does. Without this var(--gf-f) is undefined, the panel width is INVALID and the box
     falls back to auto -- measured, every card came out a different width (359 to 624px) and all
     three text sizes dropped to the browser default of 16px. Reads .gf-stage, the inline-size
     container the rest of the game measures against. */
  --gf-f: clamp(7.5px, 1.02cqw, 22px);
  --gf-sp-1: calc(var(--gf-f) * 0.5);
  --gf-sp-2: calc(var(--gf-f) * 1.0);
  --gf-sp-3: calc(var(--gf-f) * 1.6);
  --gf-tiny: calc(var(--gf-f) * 0.72 * var(--gf-type-scale, 1));
  --gf-xs: calc(var(--gf-f) * 0.85 * var(--gf-type-scale, 1));
  --gf-sm: calc(var(--gf-f) * 1.0 * var(--gf-type-scale, 1));
  --gf-md: calc(var(--gf-f) * 1.25 * var(--gf-type-scale, 1));
  --gf-lg: calc(var(--gf-f) * 1.7 * var(--gf-type-scale, 1));
}
.ul-veil {
  position: absolute; inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}
/* The same box as .ev-panel. */
.ul-panel {
  position: relative; z-index: 2;
  width: min(74%, calc(var(--gf-f) * 54));
  display: flex; flex-direction: column; gap: var(--gf-sp-2);
  padding: var(--gf-sp-3);
  --sp-1: calc(var(--gf-f) * 0.5);
  --sp-2: calc(var(--gf-f) * 1.0);
  --sp-3: calc(var(--gf-f) * 1.6);
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--coral);
  --cut: 1em; clip-path: var(--clip-card); border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
/* The identity row, like .ev-top: title left, figure at the far end. */
.ul-top { flex: none; display: flex; align-items: baseline; gap: var(--gf-sp-3); flex-wrap: wrap; }
.ul-title { margin: 0; min-width: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--gf-f) * 2.1 * var(--gf-type-scale, 1)); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
/* The gift line: the label says what it is FOR and the currency sits at the far end -- the same
   shape the result screen uses to list what came in. Hung off the title, a bare figure did not say
   why it was there. The glyph is amber, as everywhere else. */
.ul-reward { flex: none; display: flex; align-items: center; gap: var(--gf-sp-2); padding: calc(var(--gf-f) * 0.5) var(--gf-sp-2); background: color-mix(in srgb, var(--ink) 55%, transparent); border: 1px solid var(--ink-3); border-radius: var(--radius-sm); }
.ul-reward .k { min-width: 0; font-family: var(--display); font-size: var(--gf-sm); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.ul-reward .v { margin-left: auto; display: inline-flex; align-items: center; gap: calc(var(--gf-f) * 0.35); color: var(--text); }
.ul-reward .v svg { width: var(--gf-lg); height: var(--gf-lg); flex: none; color: var(--amber); }
.ul-reward .v b { font-family: var(--display); font-size: var(--gf-lg); font-variant-numeric: tabular-nums; }
.ul-reward .v span { font-family: var(--display); font-size: var(--gf-sm); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.ul-body { margin: 0; font-size: var(--gf-md); line-height: 1.45; color: var(--steel-faint); }
/* The foot, like the login modal: what you operate sits at the right. */
.ul-foot { flex: none; display: flex; align-items: center; gap: var(--gf-sp-2); }
.ul-ok {
  margin-left: auto; flex: none; cursor: pointer;
  background: var(--coral); border: 0; color: var(--on-coral);
  font-family: var(--display); font-stretch: var(--stretch); font-weight: 700;
  /* It is the ONLY thing you touch in this card, so it cannot be the smallest type on it: at
     --gf-sm it measured 10.1px against the 12.6px of the Home dock sitting BEHIND the veil. */
  font-size: calc(var(--gf-f) * 1.4 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; text-transform: var(--case);
  padding: calc(var(--gf-f) * 0.5) calc(var(--gf-f) * 2);
  --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
.ul-ok:hover { background: var(--coral-deep); }
.ul-ok:focus-visible { outline: none; box-shadow: inset 0 0 0 2px #FFFFFF; }
`;function rs(t){if(!t||!t.key)return"";let e=Math.max(0,Math.round(Number(t.gift)||0));return'<div class="ul-modal" role="dialog" aria-modal="true" aria-label="'+u(t.title||"Unlocked")+'"><div class="ul-veil"></div><div class="ul-panel"><div class="ul-top"><h3 class="ul-title">'+u(t.title||"")+'</h3></div><p class="ul-body">'+u(t.body||"")+"</p>"+(e?'<div class="ul-reward"><span class="k">'+u(t.giftLabel||"Reward")+'</span><span class="v">'+ne("aether")+"<b>"+Gn(e)+"</b><span>Aether</span></span></div>":"")+'<div class="ul-foot"><button class="ul-ok" type="button" data-unlock-ok="'+u(t.key)+'">'+(e?"Claim":"Continue")+"</button></div></div></div>"}function ss(t,{onOk:e}={}){let a=t&&t.querySelector("[data-unlock-ok]");a&&e&&a.addEventListener("click",()=>e(a.getAttribute("data-unlock-ok")))}var qe=[{id:"world",label:"World",lead:"Chapters, banners and the cast you pull all grow from what you write here."},{id:"you",label:"You"},{id:"sources",label:"Sources",lead:"The forge <b>reads</b> your books &mdash; it never edits them."},{id:"look",label:"Look",lead:"All of it is per world, and none of it changes the game."},{id:"outfits",label:"Outfits",lead:"Alternate looks for the units you own, and the rules this world dresses them by.",whenEmpty:"Outfits are generated art, so they need an image connection. Pick one in <b>Look</b> to turn them on."},{id:"advanced",label:"Advanced",lead:"House rules for the writer. They <b>override</b> the built-in guidance wherever the two disagree."}],rl=[{value:"English",label:"English"},{value:"Japanese",label:"\u65E5\u672C\u8A9E"},{value:"Korean",label:"\uD55C\uAD6D\uC5B4"},{value:"Chinese",label:"\u4E2D\u6587"},{value:"Spanish",label:"Espa\xF1ol"},{value:"French",label:"Fran\xE7ais"},{value:"German",label:"Deutsch"},{value:"Polish",label:"Polski"},{value:"Portuguese",label:"Portugu\xEAs"},{value:"Russian",label:"\u0420\u0443\u0441\u0441\u043A\u0438\u0439"}],Ae=[{id:"scenario",step:"world",type:"textarea",label:"Your gacha world",required:"Describe your gacha world before continuing.",maxLength:4e3,placeholder:"e.g. A drowned neon city where salvaged spirits are bound into cards and fight for the tide-courts\u2026",hint:"A theme, a tone, and what you collect.",wide:!0},{id:"language",step:"world",settings:"sources",group:"narrator",type:"select",label:"Narration language",options:rl},{id:"name",step:"world",type:"text",label:"Name this run",maxLength:80,placeholder:"Untitled run"},{id:"protagonist",step:"you",type:"custom",render:"personas",label:"Your protagonist",required:"Pick your protagonist \u2014 a Marinara persona.",hint:"Their full sheet shapes the narration, not just their name.",wide:!0},{id:"username",step:"you",type:"text",label:"Your name",maxLength:40,placeholder:"Commander",hint:"Shown on your HUD profile &mdash; not the protagonist."},{id:"connectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Main connection",required:"Pick the connection that will run this world.",hint:"Only text models are listed."},{id:"narrationConnectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Narrator connection",emptyOption:"Same as the main connection",hint:"Story prose. A smaller model is fine."},{id:"compressConnectionId",settings:"continuity",group:"narrator",type:"select",optionsFrom:"connections",label:"Compression connection",emptyOption:"Same as the main connection",hint:"Chapter summaries. A smaller model is fine."},{id:"lore",step:"sources",settings:"sources",group:"lore",type:"custom",render:"lorebooks",label:"Lorebooks",help:"<b>Tick Cast only on a book whose entries are ALL characters.</b> Every entry is offered as a sheet to mint, so a place or a rule in that book gets minted as a unit.<br />Macros go in an entry&rsquo;s <b>description</b>: <b>[5STAR]</b> or <b>[4STAR]</b> picks its rarity slot, and <b>[ORDER1]</b>, <b>[ORDER2]</b>&hellip; set the order inside that rarity, lowest first. Case does not matter.",wide:!0},{id:"lore.beat",step:"sources",settings:"sources",group:"lore",type:"toggle",label:"Use World books in story scenes",default:!1,showIf:t=>!!(t.lore&&Array.isArray(t.lore.worldIds)&&t.lore.worldIds.length),hint:"Off by default. World books are already read when a chapter is planned; this reads them again while each story scene is written.",help:"<b>Only the books you ticked World.</b> Those are already read once, when a chapter is planned. This reads them AGAIN each time a scene of that chapter is written.<br /><b>It costs.</b> Writing a scene already sends everything that happened before it &mdash; the longest prompt this game makes &mdash; and the book goes on top of that, every scene.<br />Which entries come along is decided by what the last two scenes actually said, plus what this one is about &mdash; so the book follows the story rather than repeating the same pages.<br />Turn it on when the story keeps getting facts about your world wrong. If it reads fine without it, leave it off."},{id:"hudStyle",step:"look",type:"custom",render:"styles",label:"HUD style",wide:!0},{id:"images.connectionId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageConnections",label:"Image connection",emptyOption:"Off \u2014 no art at all"},{id:"images.portraits",step:"look",settings:"sources",group:"images",type:"toggle",label:"Hero portraits",default:!0,showIf:t=>!!t["images.connectionId"],hint:"Painted right after your founding cast &mdash; it adds a few minutes to this setup."},{id:"images.styleProfileId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageProfiles",label:"Portrait style",showIf:t=>!!t["images.connectionId"]},{id:"images.backgrounds",step:"look",settings:"sources",group:"images",type:"toggle",label:"Backgrounds",showIf:t=>!!t["images.connectionId"],hint:"Separate from portraits because it multiplies how many images a world paints."},{id:"images.outfits",step:"outfits",settings:"sources",group:"images",type:"toggle",label:"Outfits",default:!0,showIf:t=>!!t["images.connectionId"],hint:"The outfit system: alternate looks for your units."},{id:"guidelines.arc",step:"advanced",settings:"advanced",type:"textarea",label:"Story arc directives",maxLength:3e3,placeholder:"e.g. At least one named character must die every three chapters. The world gets colder and less forgiving as it goes.",hint:"Shapes the WHOLE story: what has to hold across chapters, not inside one.",help:"<b>These are orders, not hints.</b> They are sent with every chapter plan and they override the built-in guidance wherever the two disagree. This is the field for anything that has to hold ACROSS chapters: a rule that counts (a character dies every three chapters), a tone that has to move one way, something this story never does, or a promise it has to pay off.<br />So that any of those can be obeyed, the planner is also given the LEDGER of the story so far: every chapter already written, in order, with the one line it recorded about what it did here.<br />What they cannot change is the shape the game needs, and the chapters already written &mdash; those are canon and are never revisited. Applies to the next chapter forged.",wide:!0},{id:"guidelines.chapter",step:"advanced",settings:"advanced",type:"textarea",label:"Chapter plan directives",maxLength:2e3,placeholder:"e.g. Keep one recurring antagonist across chapters. End every chapter on a cliffhanger, never on a resolution.",hint:"Shapes WHAT happens: the arc, and which scenes a chapter must reach.",help:"<b>These are orders, not hints.</b> They are sent with every chapter plan and they override the built-in guidance wherever the two disagree, so this is where you get the story to go somewhere it would not go on its own.<br />What they cannot change is the SHAPE the game needs: ten nodes, the combat count, and the JSON. Those stay fixed no matter what you write here.<br />Applies to the next chapter forged. Chapters already written are canon and are never revisited.",wide:!0},{id:"guidelines.beat",step:"advanced",settings:"advanced",type:"textarea",label:"Story beat directives",maxLength:2e3,placeholder:"e.g. Write in present tense. Keep descriptions short and physical, and never summarise a scene the reader could watch.",hint:"Shapes HOW it is written: voice, pacing, wording, what a scene shows.",help:"<b>These are orders, not hints.</b> They are sent with every beat and they override the built-in guidance wherever the two disagree.<br />This is the field for VOICE and for what a scene is allowed to show &mdash; the plan decides that a scene happens, this decides how it reads.<br />What they cannot change is the shape: the segment format, the speaker rule and the length ceiling stay fixed. Applies to the next beat narrated; beats already written are canon.",wide:!0},{id:"guidelines.outfit",step:"outfits",settings:"advanced",type:"textarea",label:"Outfit directives",maxLength:6e3,showIf:t=>!!t["images.connectionId"]&&t["images.outfits"]!==!1,placeholder:"e.g. Modern streetwear only, no fantasy armour. Keep every outfit something a student could actually wear.",hint:"Shapes WHAT KIND of alternate outfits this world makes: their themes and their tone.",help:"<b>These are orders, not hints.</b> They are sent every time the game invents a new outfit theme, and they override the built-in guidance wherever the two disagree. This is where you decide what the wardrobe is <em>about</em>.<br />What they cannot change is the SHOT: the framing, the lighting and the character's own face and build are fixed by the game, so an outfit is always the same character in different clothes.<br />Applies to the next theme minted. Outfits already made keep their own text, which you can edit on the unit itself.",wide:!0}],sl=[{id:"narrator",label:"Narrator"},{id:"lore",label:"Lorebooks"},{id:"images",label:"Images"}];function is(t){let e=$e(t);return sl.map(a=>({...a,fields:e.filter(r=>r.group===a.id)})).filter(a=>a.fields.length)}function $e(t){return Ae.filter(e=>e.settings===t)}function Ea(t){return Ae.filter(e=>e.step===t)}function xe(t,e){return!t.showIf||!!t.showIf(e||{})}function ol(t){return Ae.filter(e=>xe(e,t))}function ns(t,e){for(let a of Ea(t)){if(!a.required||!xe(a,e))continue;let r=e?e[a.id]:null;if(r==null||r===""||Array.isArray(r)&&!r.length)return a}return null}function Ht(t,e){let a={};for(let r of ol(e||t)){let s=t[r.id];if(s===void 0)continue;let o=r.id.split("."),i=a;for(let n=0;n<o.length-1;n+=1){let l=o[n];i[l]=i[l]&&typeof i[l]=="object"?{...i[l]}:{},i=i[l]}i[o[o.length-1]]=s}return a}var ds=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
/* The UA rule for [hidden] LOSES against any author display declaration, so a flex element with the
   hidden attribute stays on screen. Enforced once here. */
[hidden] { display: none !important; }

.ob-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--display);
  color: var(--text);
  background:
    radial-gradient(120% 80% at 50% 118%, color-mix(in srgb, var(--coral) 16%, transparent), transparent 60%),
    radial-gradient(80% 60% at 50% -10%, color-mix(in srgb, var(--steel) 12%, transparent), transparent 55%),
    var(--ink);
}
/* NO SCROLL: the intake is split into steps, each sized to fit the 16:9 stage. */
.ob-frame {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1rem, 3vw, 2.5rem);
}

/* Wider than it was: the steps hold four to six fields now, and on a 16:9 stage height is the
   scarce axis while width was simply unused. */
.ob-intake { width: min(900px, 100%); max-height: 100%; display: flex; flex-direction: column; gap: clamp(.7rem, 1.6vw, 1.1rem); }
/* Two fields to a row. min-width:0 on the children is not optional: a grid item defaults to
   min-content, so one long label would push the whole intake past the stage SIDEWAYS -- the axis a
   no-scroll check forgets to measure. */
/* The grid is the step's CONTENT REGION and it scrolls INSIDE its box. Every level of this card can
   flex-shrink, so without the overflow the FIELDS gave way: they compressed below their content and
   painted over each other -- the language select rode up into the world textarea. */
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: max-content; gap: clamp(.6rem, 1.4vw, 1rem); align-content: start; flex: 1 1 auto; min-height: 0; overflow: auto; }
.ob-grid > * { min-width: 0; }
/* A field that needs the whole row says so in the schema, not here. */
.ob-wide { grid-column: 1 / -1; }
/* Its own class, not a borrowed one: it reused .ob-book, and a check counting one row per lorebook
   then counted the toggle as a book. A selector that lies is worse than a duplicated rule. */
.ob-toggle { display: grid; grid-template-columns: 1.3rem minmax(0, 1fr); gap: 0 .55rem;
  padding: .4rem .55rem; align-items: center;
  border-left: 2px solid transparent; cursor: pointer; }
.ob-toggle:hover { background: color-mix(in srgb, var(--steel-dark) 22%, transparent); }
.ob-toggle b { display: block; color: var(--text); font-weight: 600; font-size: .8rem; line-height: 1.2; }
.ob-toggle .bd { display: block; font-size: .66rem; line-height: 1.3; color: var(--steel-faint); }

.ob-steps { display: flex; gap: .5rem; }
.ob-steps button {
  flex: 1;
  display: flex;
  align-items: center;
  gap: .5rem;
  background: transparent;
  border: 0;
  border-top: 2px solid var(--steel-dark);
  color: var(--steel-faint);
  font-family: inherit;
  font-size: .7rem;
  letter-spacing: .16em;
  text-transform: var(--case);
  padding: .5rem .1rem 0;
  text-align: left;
  cursor: default;
}
.ob-steps button[data-reachable="true"] { cursor: pointer; }
.ob-steps .n {
  width: 1.35rem;
  height: 1.35rem;
  flex: none;
  display: grid;
  place-items: center;
  background: var(--glow-2);
  color: var(--steel-faint);
  font-size: .72rem;
  letter-spacing: 0;
}
.ob-steps button[data-state="done"] { color: var(--text); border-top-color: var(--steel); }
.ob-steps button[data-state="done"] .n { background: var(--jade); color: var(--ink); }
.ob-steps button[data-state="active"] { color: var(--text); border-top-color: var(--coral); }
.ob-steps button[data-state="active"] .n { background: var(--coral); color: var(--ink); }

.ob-step { display: flex; flex-direction: column; gap: clamp(.7rem, 1.6vw, 1.1rem); min-height: 0; }
.ob-step[hidden] { display: none; }

.ob-nav { display: flex; align-items: center; gap: .6rem; }
.ob-spacer { flex: 1 1 auto; }
/* The arrow glyphs are taller than the label text, so without a fixed line-height each button ends
   up a different height and the footer jumps between steps. */
.ob-back, .ob-cancel, .ob-next, .ob-forge { line-height: 1.1; }
.ob-back {
  background: transparent;
  border: 1px solid var(--steel-dark);
  color: var(--steel-faint);
  font-family: inherit;
  font-size: .74rem;
  letter-spacing: .14em;
  text-transform: var(--case);
  padding: .72rem 1.1rem;
  cursor: pointer;
}
.ob-back:hover { border-color: var(--steel); color: var(--text); }
.ob-next {
  background: var(--coral);
  border: 0;
  color: var(--ink);
  font-family: inherit;
  font-weight: 700;
  font-size: .8rem;
  letter-spacing: .14em;
  text-transform: var(--case);
  padding: .72rem 1.4rem;
  cursor: pointer;
  clip-path: polygon(0 0, 100% 0, 100% 100%, .7em 100%);
}
.ob-next:hover { filter: brightness(1.08); }

.ob-brand { display: flex; align-items: center; gap: .8rem; }
.ob-mark { width: 44px; height: 44px; flex: none; filter: drop-shadow(0 4px 12px color-mix(in srgb, var(--coral) 35%, transparent)); }
.ob-word { display: flex; flex-direction: column; gap: .15rem; }
.ob-word .name { font-family: var(--title); font-size: clamp(1.4rem, 3vw, 1.9rem); font-weight: var(--title-weight); letter-spacing: .06em; line-height: .95; text-transform: var(--case); }
.ob-word .name b { color: var(--coral); }

/* NO reading-width cap: inside a 16:9 stage that never scrolls, HEIGHT is the scarce axis and width
   is the free one, so capping the width spends the scarce thing to save the abundant one. */
.ob-lead { margin: 0; color: var(--steel-faint); line-height: 1.45; font-size: .88rem; }
/* The note a step shows in place of its own body. It reads as a STATE, not as another paragraph of
   the lead: bordered like a plate, so an empty step looks answered rather than unfinished. */
.ob-empty { margin: 0; padding: .8rem .9rem; color: var(--porcelain-3); line-height: 1.45;
  font-size: .82rem; background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-left: 2px solid var(--amber); border-radius: var(--radius-sm); }
.ob-empty b { color: var(--text); }

.ob-field { display: flex; flex-direction: column; gap: .4rem; min-height: 0; }
/* A field with help is wrapped in .ob-labelrow, so a direct-child selector alone would drop the
   screen's type. Same fix as in settings.js. */
.ob-field > label,
.ob-field > .ob-labelrow > label { font-size: .74rem; letter-spacing: .12em; text-transform: var(--case); color: var(--text); }
.ob-field .hint { font-size: .74rem; color: var(--steel-faint); line-height: 1.45; }

/* The label ROW anchors the tip, so it spans the FIELD: anchored to the button, a wide tip starting
   where the name ends would run off the right edge. */
.ob-labelrow { position: relative; display: flex; align-items: center; gap: .4rem; }
.ob-labelrow > label { flex: none; }
.ob-help { width: 1.15rem; height: 1.15rem; display: inline-grid; place-items: center; padding: 0; cursor: help;
  background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); border-radius: 50%;
  color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: .62rem; line-height: 1; }
.ob-help:hover, .ob-help:focus-visible { color: var(--text); border-color: var(--steel); outline: none; }
/* DOWNWARD from the label: it opens over the field's own control and so cannot reach past the
   step's grid, which is the scroll region and would clip it. */
.ob-tip { position: absolute; z-index: 5; top: calc(100% + .35rem); left: 0; right: 0;
  padding: .5rem .65rem; background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--text);
  font-size: .72rem; line-height: 1.5; text-align: left; text-transform: none; letter-spacing: normal;
  opacity: 0; visibility: hidden; transition: opacity 120ms ease; pointer-events: none; box-shadow: var(--panel-shadow); }
.ob-tip b { color: var(--text); }
.ob-labelrow:has(.ob-help:hover) .ob-tip, .ob-labelrow:has(.ob-help:focus-visible) .ob-tip { opacity: 1; visibility: visible; }
.ob-req { color: var(--coral); }

.ob-control {
  width: 100%;
  background: var(--ink-2);
  color: var(--text);
  border: 1px solid var(--steel-dark);
  border-left: 2px solid var(--steel);
  padding: .7rem .85rem;
  font: inherit;
  font-size: .9rem;
  outline: none;
  --cut: 9px; clip-path: var(--clip-card); border-radius: var(--radius);
  transition: border-color .12s, background .12s;
}
.ob-control::placeholder { color: var(--steel-faint); }
.ob-control:hover { border-color: var(--steel); }
.ob-control:focus { border-left-color: var(--coral); border-color: var(--coral); background: var(--ink-2); }
textarea.ob-control { min-height: 7rem; resize: vertical; line-height: 1.5; }
select.ob-control {
  appearance: none; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%237E93AE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right .7rem center; background-size: 1.1rem; padding-right: 2.4rem;
}

.ob-forge {
  display: inline-flex; align-items: center; gap: .6rem;
  font: inherit; font-weight: 700; font-size: .8rem; letter-spacing: .14em; text-transform: var(--case);
  color: var(--on-coral); background: var(--coral); border: 0; cursor: pointer;
  padding: .72rem 1.4rem;
  --cut: .8em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--coral) 28%, transparent);
  transition: background .12s, transform .12s;
}
.ob-forge:hover { background: color-mix(in srgb, var(--coral) 78%, #FFFFFF); }
.ob-forge:active { transform: translateY(1px); }
.ob-forge[disabled] { background: var(--steel); cursor: wait; box-shadow: none; }
.ob-forge .arrow { font-size: 1.1em; line-height: 0; }
.ob-cancel { background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); cursor: pointer; font: inherit; font-size: .74rem; letter-spacing: .14em; text-transform: var(--case); padding: .72rem 1.1rem; }
.ob-cancel:hover { border-color: var(--steel); color: var(--text); }
.ob-foot { margin: 0; font-size: .76rem; color: var(--steel-faint); }
.ob-foot b { color: var(--text); font-weight: 600; }

.ob-error {
  font-size: .78rem; line-height: 1.5; color: color-mix(in srgb, var(--alarm) 45%, #FFFFFF);
  border: 1px solid color-mix(in srgb, var(--alarm) 40%, transparent); background: color-mix(in srgb, var(--alarm) 12%, transparent);
  padding: .5rem .7rem;
  --cut: 8px; clip-path: var(--clip-card); border-radius: var(--radius);
}
.ob-error[hidden] { display: none; }

.ob-two { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; }
@media (max-width: 520px) { .ob-two { grid-template-columns: 1fr; } }

.ob-personas { display: flex; gap: .55rem; overflow-x: auto; padding: .15rem .15rem .4rem; }
.ob-persona {
  flex: 0 0 auto; width: 8.6rem; background: var(--ink-2); border: 1px solid var(--steel-dark); border-left: 2px solid var(--steel-dark);
  cursor: pointer; padding: .7rem .5rem .6rem; display: flex; flex-direction: column; align-items: center; gap: .4rem;
  text-align: center; position: relative; color: var(--text);
  --cut: 9px; clip-path: var(--clip-card); border-radius: var(--radius);
  transition: border-color .12s, background .12s, transform .12s;
}
.ob-persona:hover { border-color: var(--steel); transform: translateY(-2px); }
.ob-persona[data-selected="true"] { border-color: var(--coral); border-left-color: var(--coral); background: var(--ink-3); }
.ob-persona .pav { width: 3.4rem; height: 3.4rem; border-radius: 50%; background: linear-gradient(150deg,var(--glow-1),var(--glow-2)); display: grid; place-items: center; font-weight: 700; font-size: 1.2rem; color: var(--porcelain-3); overflow: hidden; }
.ob-persona .pav img { width: 100%; height: 100%; object-fit: cover; }
.ob-persona .pname { font-stretch: var(--stretch); font-weight: 700; font-size: .95rem; line-height: 1.05; }
.ob-persona .pcomment { font-size: .68rem; color: var(--steel-faint); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ob-persona .pcheck { position: absolute; top: .35rem; right: .35rem; width: 1.15rem; height: 1.15rem; display: none; place-items: center; background: var(--coral); color: var(--on-coral); clip-path: polygon(0 0,100% 0,100% 100%,0 100%); }
.ob-persona[data-selected="true"] .pcheck { display: grid; }
.ob-persona .pactive { position: absolute; top: .35rem; left: .35rem; font-size: .52rem; letter-spacing: .12em; text-transform: var(--case); color: var(--jade); border: 1px solid color-mix(in srgb, var(--jade) 50%, transparent); padding: 0 .25rem; }
/* \u2500\u2500 Step 4: the HUD style. Picking one previews it immediately, because the choice is about how
      the world FEELS and a swatch alone does not carry that. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.ob-styles { display: grid; grid-template-columns: repeat(5, 1fr); gap: .55rem; }
.ob-sw {
  position: relative; overflow: hidden; cursor: pointer; padding: .55rem .5rem;
  border: 2px solid transparent; background: var(--ink-2); color: var(--text);
  font: inherit; text-align: left; display: flex; flex-direction: column; justify-content: flex-end;
  min-height: 5.2rem; gap: .1rem;
  transition: transform .14s var(--ease), border-color .14s ease;
}
.ob-sw:hover { transform: translateY(-3px); }
.ob-sw[aria-pressed="true"] { border-color: var(--coral); }
.ob-sw .mini { position: absolute; inset: 0; }
.ob-sw .mini i { position: absolute; display: block; }
/* The label sits over ANOTHER style's palette in THIS style's text colour: Bloom's panel is pure
   white and its bottom bar lands right under the label. The scrim gives the label a known backdrop
   whatever the swatch paints, which is the only version that survives a sixth style. */
.ob-sw::after { content: ""; position: absolute; inset: auto 0 0 0; height: 82%; z-index: 1; pointer-events: none;
  /* Opaque WHERE THE TEXT SITS: a fade that starts earlier leaves the title's top edge on a
     translucent veil and the contrast collapses on the light styles. */
  background: linear-gradient(0deg, var(--ink) 0 64%, color-mix(in srgb, var(--ink) 70%, transparent) 84%, transparent 100%); }
.ob-sw .lbl { position: relative; z-index: 2; }
.ob-sw .lbl b { display: block; font-size: .78rem; font-weight: 700; }
.ob-sw .lbl span { font-size: .58rem; opacity: .85; line-height: 1.25; display: block; }
.ob-sw .tick {
  position: absolute; top: .3rem; right: .3rem; z-index: 3; width: 1.05rem; height: 1.05rem;
  border-radius: 50%; background: var(--coral); color: var(--on-coral); display: none;
  place-items: center; font-size: .6rem;
}
.ob-sw[aria-pressed="true"] .tick { display: grid; }

/* \u2500\u2500 The lorebook picker (step 6) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   ONE full-width list with a toggle per ROLE on each row, not two lists side by side. Two columns
   broke twice: a grid item defaults to min-width auto, so a long book name made its column REFUSE
   to shrink and pushed the intake past the stage sideways; and at ~290px a real book name is mostly
   ellipsis. One row per book also says the true thing -- one book can serve both roles. */
.ob-bookgrid { display: grid; grid-template-columns: minmax(0, 1fr) 3.4rem 3.4rem; align-items: center; gap: 0 .3rem; }
/* THE HEADING MEASURES LIKE A ROW, or its columns are not the rows' columns. Two drifts add up and
   neither shows in the markup: rows carry a left border the heading lacks, and the list scrolls
   while the heading does not, so the scrollbar eats width from only one. Same border on both, and
   the scroll channel RESERVED with scrollbar-gutter stable. */
.ob-bookhead { font-size: .62rem; letter-spacing: .12em; text-transform: var(--case); color: var(--steel);
  padding: 0 .45rem .25rem; border-left: 2px solid transparent; }
.ob-bookhead span:not(:first-child) { text-align: center; }
/* The one region allowed to scroll, inside its own box: a library holds any number of books, and
   the SCREEN never scrolls on either axis. */
/* flex: 1 1 auto + min-height: 0 is what makes the LIST absorb the squeeze. Without the min-height
   the box refuses to go below its content and the section overflows instead -- invisible to a
   scrollHeight check on its own ancestors, and it shows up as the foot note sitting on the nav. */
.ob-booklist { min-width: 0; flex: 1 1 auto; min-height: 3rem; max-height: 9.5rem; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable;
  display: flex; flex-direction: column; gap: .15rem;
  border: 1px solid var(--ink-3); background: var(--ink-2); padding: .3rem; }
.ob-book { min-width: 0; padding: .3rem .45rem; border-left: 2px solid transparent; }
.ob-book:hover { background: color-mix(in srgb, var(--steel-dark) 22%, transparent); }
.ob-book.on { border-left-color: var(--coral); background: color-mix(in srgb, var(--coral) 10%, transparent); }
.ob-book .bt { min-width: 0; }
.ob-book b { display: block; color: var(--text); font-weight: 600; font-size: .8rem; line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-book .bd { display: block; font-size: .66rem; line-height: 1.3; color: var(--steel-faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-bx { justify-self: center; width: 1rem; height: 1rem; padding: 0; cursor: pointer; font: inherit;
  background: transparent; border: 1px solid var(--steel-dark); display: grid; place-items: center; color: transparent; }
.ob-bx:hover { border-color: var(--steel); }
.ob-bx[aria-checked="true"] { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.ob-bx .bx-tick { width: 72%; height: 72%; display: block; }
.ob-books-empty { font-size: .74rem; color: var(--steel-faint); padding: .5rem; line-height: 1.4; }
/* The two budgets under the list. Each shows what the CHOSEN books actually weigh, because a token
   cap set without knowing that is a guess -- and the guess once let three entries of a
   twenty-two entry book through. */
.ob-budget { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
.ob-bud { min-width: 0; display: flex; align-items: baseline; gap: .35rem; }
.ob-bud > .k { font-size: .68rem; letter-spacing: .1em; text-transform: var(--case); color: var(--steel); }
.ob-bud input { width: 5.2rem; flex: none; font: inherit; font-size: .78rem; padding: .2rem .35rem;
  background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); color: var(--text); }
.ob-bud input:focus { border-color: var(--coral); border-left-color: var(--coral); outline: none; }
.ob-bud > .w { min-width: 0; font-size: .68rem; color: var(--steel-faint); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.ob-bud > .w[data-over="true"] { color: var(--coral); }

.ob-personas-empty { font-size: .8rem; color: var(--steel-faint); border: 1px dashed var(--steel-dark); padding: .7rem; --cut: 8px; clip-path: var(--clip-card); border-radius: var(--radius); }
`,il='<svg class="ob-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="0,0 100,0 100,80 80,100 0,100" fill="var(--ink)"/><polygon points="4,4 96,4 96,78 78,96 4,96" fill="none" stroke="var(--steel-dark)" stroke-width="2.5"/><path d="M50 14 C53 41 59 47 86 50 C59 53 53 59 50 86 C47 59 41 53 14 50 C41 47 47 41 50 14 Z" fill="var(--coral)"/><path d="M50 30 C51.5 45 55 48.5 70 50 C55 51.5 51.5 55 50 70 C48.5 55 45 51.5 30 50 C45 48.5 48.5 45 50 30 Z" fill="var(--amber)" opacity=".9"/></svg>',hs='Forge this world <span class="arrow">&#9656;</span>';function qt(t){let e=Math.max(1,Math.min(3,Number(t)||1));return new Array(e).fill('<div class="ob-bookhead ob-bookgrid"><span>Book</span><span>World</span><span>Cast</span></div>').join("")}var nl='<svg class="bx-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.4 6.6 11.5 12.5 4.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function ll(t,e){let a=o=>e&&e[o]?"true":"false",r=(o,i)=>'<button class="ob-bx" type="button" role="checkbox" aria-label="'+i+": "+u(t.name)+'" aria-checked="'+a(o)+'" data-book="'+u(t.id)+'" data-role="'+o+'">'+nl+"</button>";return'<div class="ob-book ob-bookgrid'+(e&&(e.world||e.cast)?" on":"")+'"><span class="bt"><b>'+u(t.name)+"</b>"+(t.description?'<span class="bd">'+u(t.description)+"</span>":"")+"</span>"+r("world","World lore")+r("cast","Cast book")+"</div>"}function vt(t,e){let a=t.wide?" ob-wide":"",r=e&&e.hidden?" hidden":"",s=!!(e&&e.terse),o=t.help?'<button class="ob-help" type="button" aria-label="About '+ce(t.label||t.id)+'">?</button><span class="ob-tip" role="tooltip">'+t.help+"</span>":"",i=t.label&&t.type!=="toggle"?"<label"+(t.type==="text"||t.type==="textarea"||t.type==="select"?' for="ob-'+Dt(t.id)+'"':"")+">"+t.label+(t.required?' <span class="ob-req">*</span>':"")+"</label>":"",n=i&&o?'<div class="ob-labelrow">'+i+o+"</div>":i,l=t.hint&&!s?'<span class="hint">'+t.hint+"</span>":"",d="";if(t.type==="custom")d=e&&e.custom?e.custom(t):"";else if(t.type==="textarea"){let h=e&&typeof e.value=="string"?e.value:"";d='<textarea id="ob-'+Dt(t.id)+'" class="ob-control" data-input="'+ce(t.id)+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+ce(t.placeholder)+'"':"")+">"+ce(h)+"</textarea>"}else if(t.type==="select"){let h=Array.isArray(t.options)?t.options.map(f=>'<option value="'+ce(f.value)+'">'+ce(f.label||f.value)+"</option>").join(""):"";d='<select id="ob-'+Dt(t.id)+'" class="ob-control" data-input="'+ce(t.id)+'">'+(t.emptyOption?'<option value="">'+ce(t.emptyOption)+"</option>":"")+h+"</select>"}else t.type==="toggle"?d='<label class="ob-toggle"><button class="ob-bx" type="button" role="checkbox" aria-checked="false" data-input="'+ce(t.id)+'" aria-label="'+ce(t.label||t.id)+'"><span>\u2713</span></button><span class="bt"><b>'+(t.boxLabel||t.label||"")+"</b>"+(t.boxHint&&!s?'<span class="bd">'+t.boxHint+"</span>":"")+"</span></label>":d='<input id="ob-'+Dt(t.id)+'" class="ob-control" data-input="'+ce(t.id)+'" type="'+(t.type==="number"?"number":"text")+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+ce(t.placeholder)+'"':"")+" />";return'<div class="ob-field'+a+'" data-field="'+ce(t.id)+'"'+r+">"+n+d+l+"</div>"}function Dt(t){return String(t).replace(/[^A-Za-z0-9_-]+/g,"-")}function cl(){return'<span class="hint"><b>World</b>: what is true here &mdash; <b>constant</b> entries always, the rest on their keywords; what does not fit the budget is <b>dropped</b>. <b>Cast</b>: the forge picks the sheets it is about to mint &mdash; <b>5</b> when the world is forged, <b>2</b> per featured banner &mdash; and never offers the same character twice.</span>'}function mt(t,e){if(t.render==="personas")return'<div class="ob-personas" role="radiogroup" aria-label="Protagonist persona" data-personas><span class="ob-personas-empty">Loading personas&hellip;</span></div>';if(t.render==="styles")return'<div class="ob-styles" role="radiogroup" aria-label="HUD style">'+Xe.map(r=>{let[s,o,i]=r.swatch;return'<button class="ob-sw" type="button" role="radio" data-style-pick="'+r.id+'" aria-pressed="'+(r.id===Ke)+'"><span class="mini" style="background:'+s+'"><i style="left:8%;top:9%;width:84%;height:14%;background:'+o+'"></i><i style="left:8%;top:30%;width:50%;height:36%;background:'+o+'"></i><i style="left:62%;top:30%;width:30%;height:16%;background:'+i+'"></i><i style="left:62%;top:50%;width:30%;height:16%;background:'+o+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+o+'"></i></span><span class="tick">&#10003;</span><span class="lbl"><b>'+r.label+"</b><span>"+r.description+"</span></span></button>"}).join("")+"</div>";if(t.render==="lorebooks"){let a=Math.max(1,Math.min(3,Number(e&&e.cols)||1));return'<div class="ob-booklist" role="group" aria-label="Lorebooks" data-cols="'+a+'" data-books>'+qt(a)+'<span class="ob-books-empty">Reading your library&hellip;</span></div><div class="ob-budget"><label class="ob-bud"><span class="k">World tk</span><input type="number" min="0" step="500" data-budget="world" aria-label="World token budget" /><span class="w" data-weight="world"></span></label><label class="ob-bud"><span class="k">Cast tk</span><input type="number" min="0" step="500" data-budget="cast" aria-label="Cast token budget" /><span class="w" data-weight="cast"></span></label></div>'+cl()}return""}function dl(t,e){let a=Ea(t.id),r=a.map(n=>vt(n,{custom:mt,hidden:!xe(n,e||{}),value:e&&typeof e[n.id]=="string"?e[n.id]:""})).join(""),s=t.lead?'<p class="ob-lead ob-wide">'+t.lead+"</p>":"",i=t.whenEmpty&&a.length>0&&a.every(n=>!xe(n,e||{}))?'<p class="ob-empty ob-wide">'+t.whenEmpty+"</p>":"";return'<div class="ob-grid">'+s+i+r+"</div>"}function ps({cancelable:t=!1,values:e={}}={}){let a=t?'<button class="ob-cancel" type="button" data-cancel>Cancel</button>':"",r=qe.map((o,i)=>'<button type="button" data-goto="'+(i+1)+'" data-state="'+(i===0?"active":"todo")+'" data-reachable="'+(i===0?"true":"false")+'"><span class="n">'+(i+1)+"</span>"+o.label+"</button>").join(""),s=qe.map((o,i)=>'<section class="ob-step" data-step="'+(i+1)+'" data-step-id="'+o.id+'"'+(i===0?"":" hidden")+">"+dl(o,e)+(i===qe.length-1?'<p class="ob-foot">Forging generates your <b>first chapter</b> &mdash; takes a moment.</p>':"")+"</section>").join("");return`
<div class="ob-root">
  <div class="ob-frame">
  <div class="ob-intake">
    <div class="ob-brand">
      ${il}
      <div class="ob-word"><span class="name">Gacha <b>Forge</b></span></div>
    </div>
    <nav class="ob-steps" data-steps>${r}</nav>
    ${s}
    <p class="ob-error" hidden></p>
    <div class="ob-nav">
      <button class="ob-back" type="button" data-back hidden>&#9664; Back</button>
      <span class="ob-spacer"></span>
      ${a}
      <button class="ob-next" type="button" data-next>Next <span class="arrow">&#9656;</span></button>
      <button class="ob-forge" type="button" data-forge hidden>${hs}</button>
    </div>
  </div>
  </div>
</div>`}var hl=new Set(["image_generation","video_generation"]),fs="/api/gacha-forge";function ls(t){return t===!0||t==="true"||t===1||t==="1"}function ce(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function pl(t){let e=String(t||"").trim().split(/\s+/).filter(Boolean),a=e[0]?e[0][0]:"",r=e[1]?e[1][0]:"";return(a+r).toUpperCase()||"?"}function fl(t,e){let a=String(t?.id??""),r=String(t?.name??"Unnamed"),s=String(t?.comment??""),o=t?.avatarPath?`<span class="pav"><img src="${ce(t.avatarPath)}" alt=""></span>`:`<span class="pav">${ce(pl(r))}</span>`;return`<button class="ob-persona" type="button" role="radio" data-persona="${ce(a)}" data-selected="false">`+(e?'<span class="pactive">Active</span>':"")+'<span class="pcheck">&#10003;</span>'+o+`<span class="pname">${ce(r)}</span><span class="pcomment">${ce(s)}</span></button>`}function cs(t){return t?{personaId:String(t.id??""),name:String(t.name??"").trim(),comment:String(t.comment??""),description:String(t.description??""),personality:String(t.personality??""),appearance:String(t.appearance??""),backstory:String(t.backstory??""),scenario:String(t.scenario??""),tags:Array.isArray(t.tags)?t.tags.map(e=>String(e)):[],avatarPath:t.avatarPath?String(t.avatarPath):null}:null}function Ta(t,{initial:e,onChange:a}={}){let r=e&&typeof e=="object"?e:{},s={world:new Set(Array.isArray(r.worldIds)?r.worldIds:[]),cast:new Set(Array.isArray(r.castIds)?r.castIds:[])},o=new Map,i=f=>t.querySelector('[data-budget="'+f+'"]'),n=()=>({worldIds:[...s.world],castIds:[...s.cast],worldBudget:Number(i("world")&&i("world").value),castBudget:Number(i("cast")&&i("cast").value)}),l=()=>{a&&a(n())};function d(){for(let f of["world","cast"]){let m=t.querySelector('[data-weight="'+f+'"]');if(!m)continue;let v=0,b=!1;for(let T of s[f]){let R=o.get(T);typeof R=="number"?v+=R:b=!0}let w=i(f),c=w&&w.value!==""?Number(w.value):NaN,y=Number.isFinite(c)?c:Number(w&&w.placeholder);if(!s[f].size){m.textContent="",m.setAttribute("data-over","false");continue}let E=v>=1e3?Math.round(v/100)/10+"k":String(v);m.textContent="picked \u2248"+E+(b?"+":""),m.setAttribute("data-over",Number.isFinite(y)&&v>y?"true":"false")}}function h(f,m){let v=t.querySelector("[data-books]");if(v){if(m){v.innerHTML=qt(v.getAttribute("data-cols"))+'<span class="ob-books-empty">'+u(m)+"</span>";return}if(!f.length){v.innerHTML=qt(v.getAttribute("data-cols"))+'<span class="ob-books-empty">No lorebooks in your library yet. Write or import one in Marinara and it shows up here.</span>';return}v.innerHTML=qt(v.getAttribute("data-cols"))+f.map(b=>ll(b,{world:s.world.has(b.id),cast:s.cast.has(b.id)})).join("");for(let b of v.querySelectorAll("[data-role]"))b.addEventListener("click",()=>{let w=b.getAttribute("data-book"),c=s[b.getAttribute("data-role")];if(!c)return;c.has(w)?c.delete(w):c.add(w),b.setAttribute("aria-checked",c.has(w)?"true":"false"),d();let y=b.parentNode;y&&y.classList&&y.classList.toggle("on",s.world.has(w)||s.cast.has(w)),l()})}}for(let f of["world","cast"]){let m=i(f),v=r[f+"Budget"];m&&v!==null&&v!==void 0&&Number.isFinite(Number(v))&&(m.value=String(v))}ve(fs+"/lorebooks").then(f=>f&&f.ok&&typeof f.json=="function"?f.json():null).then(f=>{if(f&&f.ok&&Array.isArray(f.books)){for(let v of f.books)v&&typeof v.tokens=="number"&&o.set(v.id,v.tokens);let m=f&&f.defaults||{};for(let v of["world","cast"]){let b=i(v);b&&(b.placeholder=String(Number(m[v])||(v==="cast"?2e4:6e3)))}h(f.books,null),d()}else h([],"Could not read your lorebooks. The world can still be forged without them.")}).catch(()=>h([],"Could not read your lorebooks. The world can still be forged without them."));for(let f of["world","cast"]){let m=i(f);m&&(m.addEventListener("input",d),m.addEventListener("change",l))}return{value:n}}function us(t,{onCreate:e,onCancel:a}){let r=_=>t.querySelector('[data-input="'+_+'"]'),s=_=>t.querySelector('[data-field="'+_+'"]'),o={};function i(){for(let _ of Ae){let S=s(_.id);S&&(S.hidden=!xe(_,o))}}let n=r("scenario"),l=r("name"),d=r("username"),h=r("connectionId"),f=r("images.connectionId"),m=s("images.connectionId")&&s("images.connectionId").querySelector(".hint"),v=s("images.styleProfileId"),b=r("images.styleProfileId"),w=t.querySelector("[data-personas]"),c=t.querySelector(".ob-error"),y=t.querySelector("[data-forge]"),E=t.querySelector("[data-cancel]");E&&E.addEventListener("click",()=>a&&a());let T=qe.length,R=Array.from(t.querySelectorAll("[data-step]")),W=Array.from(t.querySelectorAll("[data-goto]")),O=t.querySelector("[data-back]"),U=t.querySelector("[data-next]"),F=1,j=1;function D(_){F=Math.min(T,Math.max(1,_)),j=Math.max(j,F);for(let S of R)S.hidden=Number(S.getAttribute("data-step"))!==F;for(let S of W){let A=Number(S.getAttribute("data-goto"));S.setAttribute("data-state",A===F?"active":A<j?"done":"todo"),S.setAttribute("data-reachable",A<=j?"true":"false")}O&&(O.hidden=F===1),U&&(U.hidden=F===T),y&&(y.hidden=F!==T),te("")}for(let _ of W)_.addEventListener("click",()=>{let S=Number(_.getAttribute("data-goto"));S<=j&&D(S)});O&&O.addEventListener("click",()=>D(F-1)),U&&U.addEventListener("click",()=>{X(F)&&D(F+1)});function X(_){J();let S=qe[_-1]&&qe[_-1].id,A=S?ns(S,o):null;if(!A)return!0;te(A.required);let C=r(A.id);return C&&C.focus&&C.focus(),!1}function J(){for(let _ of Ae){if(_.type==="custom")continue;let S=r(_.id);S&&(_.type==="toggle"?o[_.id]=S.getAttribute("aria-checked")==="true":_.type==="number"?o[_.id]=Number(S.value):o[_.id]=typeof S.value=="string"?S.value.trim():"")}i()}let le=Ta(t,{}),oe=Ke;o.hudStyle=Ke;let re=t.querySelector(".gf-arena");for(let _ of t.querySelectorAll("[data-style-pick]"))_.addEventListener("click",()=>{oe=_.getAttribute("data-style-pick"),o.hudStyle=oe;for(let S of t.querySelectorAll("[data-style-pick]"))S.setAttribute("aria-pressed",String(S===_));re&&re.setAttribute&&re.setAttribute("data-style",oe)});let ee=null,Z=[];function ue(_){ee=_,o.protagonist=cs(_);for(let S of Z)S.el.setAttribute("data-selected",S.persona===_?"true":"false")}function te(_){c&&(c.textContent=_||"",c.hidden=!_)}ve("/api/connections").then(_=>_&&_.ok&&typeof _.json=="function"?_.json():Promise.reject(new Error("connections"))).then(_=>{let S=Array.isArray(_)?_:[],A=S.filter(G=>!hl.has(String(G?.provider??"")));if(S.length===0){te("No connection configured. Create one in the engine settings and come back.");return}if(A.length===0){te("Your connections are image or video only, and none can run a world. Configure a text connection in the engine settings.");return}let C=A.map(G=>{let de=String(G?.id??""),Ee=String(G?.name??de),ze=String(G?.model??"").trim(),ye=ze?`${Ee} \u2014 ${ze}`:Ee;return`<option value="${de}">${ye.replace(/</g,"&lt;")}</option>`}).join(""),P=A.find(G=>ls(G?.isDefault))??A.find(G=>ls(G?.fallbackForMain));for(let G of Ae.filter(de=>de.optionsFrom==="connections")){let de=r(G.id);if(!de)continue;let Ee=G.emptyOption?`<option value="">${String(G.emptyOption).replace(/</g,"&lt;")}</option>`:"";de.innerHTML=Ee+C,G.emptyOption?de.value="":P?.id&&(de.value=String(P.id))}}).catch(()=>te("Could not read the engine connections."));for(let _ of Ae.filter(S=>S.type==="toggle")){let S=r(_.id);S&&(o[_.id]=_.default===!0,S.setAttribute("aria-checked",o[_.id]?"true":"false"),S.addEventListener("click",()=>{o[_.id]=!o[_.id],S.setAttribute("aria-checked",o[_.id]?"true":"false")}))}let N=_=>{o["images.connectionId"]=_?f&&f.value||"on":"",i()};ve(`${fs}/image-options`).then(_=>_&&_.ok&&typeof _.json=="function"?_.json():null).then(_=>{let S=_&&Array.isArray(_.connections)?_.connections:[];if(!S.length){m&&(m.textContent="No image connection is configured in the engine, so portraits stay off. Heroes show a silhouette when they speak."),f&&(f.disabled=!0);return}f&&(f.innerHTML='<option value="">Off</option>'+S.map(C=>`<option value="${u(C.id)}">${u(C.name)}</option>`).join(""));let A=_&&Array.isArray(_.profiles)?_.profiles:[];b&&(b.innerHTML=A.length?A.map(C=>`<option value="${u(C.id)}">${u(C.name)} &mdash; ${u(C.promptMode)}</option>`).join(""):'<option value="">Engine default</option>')}).catch(()=>{}),f&&f.addEventListener("change",()=>N(!!f.value)),Promise.all([ve("/api/characters/personas/list").then(_=>_&&_.ok&&typeof _.json=="function"?_.json():[]).catch(()=>[]),ve("/api/characters/personas/active").then(_=>_&&_.ok&&typeof _.json=="function"?_.json():null).catch(()=>null)]).then(([_,S])=>{if(!w)return;let A=Array.isArray(_)?_:_&&Array.isArray(_.items)?_.items:[];if(A.length===0){w.innerHTML='<span class="ob-personas-empty">No personas in Marinara yet &mdash; create one there first, then come back.</span>';return}let C=S&&S.id;w.innerHTML=A.map(P=>fl(P,P.id===C)).join(""),Z=[];for(let P of A){let G=t.querySelector('[data-persona="'+String(P.id??"")+'"]');G&&(Z.push({persona:P,el:G}),G.addEventListener("click",()=>ue(P)))}ue(A.find(P=>P.id===C)||A[0])}),y?.addEventListener("click",async()=>{if(!(n?.value||"").trim()){te("Describe your gacha world before forging."),n?.focus?.();return}if(!ee){te("Pick your protagonist \u2014 a Marinara persona.");return}if(!(h?.value||"")){te("Pick the connection that will run this world.");return}let A=(l?.value||"").trim(),C=(d?.value||"").trim(),P=cs(ee);te(""),y&&(y.disabled=!0,y.textContent="Forging\u2026");try{J(),o.protagonist=P,o.hudStyle=oe,o.lore=le.value(),await e(Ht(o))}catch(G){y&&(y.disabled=!1,y.innerHTML=hs),te(`Could not start: ${G instanceof Error?G.message:String(G)}`)}}),D(1)}var et=[{id:"continuity",kicker:"Story",label:"Continuity"},{id:"visual",kicker:"Look",label:"Visual"},{id:"sources",kicker:"World",label:"Sources"},{id:"advanced",kicker:"Writing",label:"Advanced"},{id:"help",kicker:"Guide",label:"Help"},{id:"changelog",kicker:"Updates",label:"Changelog"},{id:"debug",kicker:"Diagnostics",label:"Debug"}],tt="visual",vs=5,Aa=3e4,Na=[2e4,3e4,5e4,1e5],ul='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',ms='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5 4 12l5 7M15 5l5 7-5 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',vl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4 10-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';function $t(t){let e=Number(t)||0;return e>=1e3?(e%1e3===0?String(e/1e3):(e/1e3).toFixed(1))+"k":String(e)}function jt(t){return(Number(t)||0).toLocaleString("en-US")}function ml({contextTokens:t,warnTokens:e,run:a}){let r=Number(t)||0,s=Number(e)||Aa,o=s>0?Math.min(100,Math.round(r/s*100)):0,i=Na.map(n=>'<button class="st-chip" type="button" data-warn="'+n+'" aria-pressed="'+(n===s)+'">'+$t(n)+"</button>").join("");return'<div class="st-plate"><div class="hd"><h3>Model context</h3><span class="st-figs"><b data-meter-n>'+jt(r)+"</b>&nbsp;/&nbsp;<span data-meter-max>"+jt(s)+'</span>&nbsp;tokens</span></div><div class="st-track"><i data-meter-bar style="width:'+o+'%"></i><span class="st-mark" data-meter-mark data-label="'+$t(s)+'" style="left:100%"></span></div><div class="st-thresh"><span class="st-lbl">Alert at</span><div class="st-chips" role="group" aria-label="Alert threshold">'+i+'</div><span class="st-or">or</span><span class="st-custom"><input type="number" data-warn-custom min="1" step="5" value="'+Math.round(s/1e3)+'" aria-label="Custom threshold in thousands of tokens"><span class="st-k">k</span></span></div><div class="st-banner">'+ul+'<span>Long story &mdash; compress old chapters to keep turns fast and cheap. Nothing is lost.</span></div></div><div class="st-plate"><div class="hd"><h3>Chapters</h3></div><p>Compressing swaps the copy the model reads for a summary. The beats stay readable in the log.</p>'+$e("continuity").map(n=>vt(n,{custom:mt,terse:!1})).join("")+'<div class="st-list" data-continuity-list><p class="st-empty">Loading&hellip;</p></div></div>'}function bs(t,e=null){return!Array.isArray(t)||!t.length?'<p class="st-empty">No chapters yet.</p>':t.map(a=>{let r=String(a.chapter).padStart(2,"0"),s,o,i,n;return a.compressed?(s="-compressed",o='<span class="st-status -compressed">Compressed</span>',i='<span class="st-done">'+vl+"done</span>",n=(a.storyBeats||vs)+" beats &middot; compressed"):a.complete?(s="-ready",o='<span class="st-status -ready">Complete</span>',i=e!=null&&Number(e)===Number(a.chapter)?'<button class="st-compress" type="button" disabled data-compress="'+a.chapter+'">'+ms+"Compressing&hellip;</button>":'<button class="st-compress" type="button" data-compress="'+a.chapter+'">'+ms+"Compress</button>",n=(a.storyBeats||0)+" beats narrated"):(s="-playing",o='<span class="st-status -playing">In progress</span>',i='<span class="st-lock">Finish to compress</span>',n=(a.storyBeats||0)+" of "+vs+" beats"),'<article class="st-ch '+s+'"><div class="st-idx">'+r+"</div><div><h4>"+u(a.title)+"</h4><p>"+n+"</p></div>"+o+i+"</article>"}).join("")}function at(t,e,a){let r=Number(e)||0,s=Number(a)||0;for(let f of[t.querySelector(".root"),t.querySelector(".gf-bar")])f&&(r>0&&s>0&&r>=s?f.setAttribute("data-ctx","warn"):f.removeAttribute("data-ctx"));let o=t.querySelector("[data-ctx-n]");o&&(o.textContent=$t(r));let i=t.querySelector("[data-meter-n]");i&&(i.textContent=jt(r));let n=t.querySelector("[data-meter-max]");n&&(n.textContent=jt(s));let l=t.querySelector("[data-meter-mark]");l&&l.setAttribute("data-label",$t(s));let d=t.querySelector("[data-meter-bar]");d&&d.style&&(d.style.width=(s>0?Math.min(100,Math.round(r/s*100)):0)+"%");for(let f of Na){let m=t.querySelector('[data-warn="'+f+'"]');m&&m.setAttribute("aria-pressed",String(f===s))}let h=t.querySelector("[data-warn-custom]");h&&t.activeElement!==h&&(h.value=String(Math.round(s/1e3)))}function gl(t){let e=ft(t);return Xe.map(a=>{let[r,s,o]=a.swatch;return'<button class="st-sty" type="button" data-style-set="'+a.id+'" aria-pressed="'+(a.id===e)+'"><span class="st-mini" style="background:'+r+'"><i style="left:8%;top:10%;width:84%;height:14%;background:'+s+'"></i><i style="left:8%;top:31%;width:50%;height:34%;background:'+s+'"></i><i style="left:62%;top:31%;width:30%;height:15%;background:'+o+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+s+'"></i></span><span class="st-tick">&#10003;</span><span class="st-swlbl"><b>'+a.label+"</b><span>"+a.description+"</span></span></button>"}).join("")}function bl(t){let e=Je(t);return pt.map(a=>'<button class="st-chip" type="button" data-text-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function yl(t){let e=Ze(t);return Rt.map(a=>'<button class="st-chip" type="button" data-narr-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function wl({hudStyle:t,textScale:e,narrationScale:a}){return'<div class="st-plate"><div class="hd"><h3>HUD style</h3></div><div class="st-styles">'+gl(t)+'</div></div><div class="st-plate"><div class="hd"><h3>Interface text</h3></div><div class="st-chips" role="group" aria-label="Interface text size">'+bl(e)+'</div></div><div class="st-plate"><div class="hd"><h3>Narration text</h3></div><div class="st-chips" role="group" aria-label="Narration text size">'+yl(a)+"</div></div>"}function ys(t,e){let a=t;for(let r of String(e).split(".")){if(!a||typeof a!="object")return;a=a[r]}return a}function Ut(t,e){let a={};for(let r of $e(e)){let s=ys(t,r.id);a[r.id]=s===void 0?r.default:s}return a}function Wt(t,e){let a={};for(let r of Ae){let s=ys(t,r.id);a[r.id]=s===void 0?r.default:s}return e?{...a,...e}:a}function ws(t,e,a){return Ht(a,Wt(t,a))}function xl(t,e){return is("sources").map(a=>{let r=a.fields.length===1,s=i=>String(i.label||"").trim().toLowerCase()===String(a.label||"").trim().toLowerCase(),o=a.fields.map(i=>vt(r||s(i)?{...i,label:""}:i,{custom:mt,hidden:!xe(i,e),terse:!0})).join("");return'<div class="st-plate" data-group="'+u(a.id)+'"><div class="hd"><h3>'+u(a.label)+'</h3></div><div class="ob-grid">'+o+"</div></div>"}).join("")+'<p class="st-foot">Applies to what this world generates next; nothing already made is redrawn.</p>'}function kl(t,e){return $e("advanced").map(a=>'<div class="st-plate"'+(xe(a,e)?"":" hidden")+'><div class="ob-grid">'+vt(a,{custom:mt,hidden:!xe(a,e),terse:!1,value:typeof t[a.id]=="string"?t[a.id]:""})+"</div></div>").join("")+'<p class="st-foot">Applies to what this world makes next; what is already made stays as it is.</p>'}function _l(t){let e=t&&t.status||"idle";if(e==="loading")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Reading&hellip;</div></div>';if(e==="error")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Could not read the lorebook status.</div></div>';if(e!=="ready")return"";let a=t&&t.data||{};if(!a.enabled)return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">This world uses no lorebooks. Pick them in Sources.</div></div>';let r=l=>Number.isFinite(Number(l))?Number(l).toLocaleString("en-US"):"&mdash;",s=(l,d,h)=>{if(!d)return"";let f=d.dropped>0;return'<span class="st-tl-tot"><i>'+l+"</i><b>"+r(d.entries)+" / "+r(d.pool)+' entries</b></span><span class="st-tl-tot"><i>tokens</i><b>'+r(d.tokens)+" / "+r(h)+"</b></span>"+(f?'<span class="st-tl-warn">'+r(d.dropped)+" entr"+(d.dropped===1?"y":"ies")+" will NOT fit &mdash; the generator works from a fragment</span>":"")},o=(Array.isArray(a.next)?a.next:[]).map(l=>l.uses===!1?'<div class="st-tl-row"><span class="st-tl-l">'+u(l.label)+'</span><span class="st-tl-o">no lore</span></div><div class="st-tl-note">'+u(l.why||"")+"</div>":'<div class="st-tl-row"><span class="st-tl-l">'+u(l.label)+'</span></div><div class="st-tl-totals">'+s("world",l.world,a.budgets&&a.budgets.world)+s("cast",l.cast,a.budgets&&a.budgets.cast)+"</div>").join(""),i=a.library||{};return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks &mdash; what the next call carries</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+('<div class="st-tl-totals"><span class="st-tl-tot"><i>world books</i><b>'+r(i.world&&i.world.books)+'</b></span><span class="st-tl-tot"><i>cast books</i><b>'+r(i.cast&&i.cast.books)+'</b></span><span class="st-tl-tot"><i>already minted</i><b>'+r(a.minted)+"</b></span>"+((a.missing||[]).length?'<span class="st-tl-warn">'+(a.missing||[]).length+" book(s) this world points at no longer exist</span>":"")+"</div>")+o+"</div>"}function Sl(){return'<section class="st-plate st-build"><div class="hd"><h3>Build</h3></div><div class="st-build-row"><span class="k">Package version</span><b data-build-version>v'+u(Mt)+"</b></div></section>"}function Ia(t,e){return Sl()+_l(t)+Al(e)}function El(t){let e=r=>!!(t&&typeof t.has=="function"&&t.has(r));return'<div class="st-help">'+zr.map(r=>{let s=Fr(r.id);return s.length?'<section class="st-plate st-help-topic"><div class="hd"><h3>'+u(r.label)+'</h3></div><div class="st-help-list">'+s.map(o=>Bt(o,e(o.id))).join("")+"</div></section>":""}).join("")+"</div>"}function Tl(){return'<div class="st-cl">'+Ot().map(t=>'<section class="st-plate st-cl-rel'+(t.now?" now":"")+'"><div class="hd"><h3>'+u(t.version)+"</h3>"+(t.now?'<span class="k">Current</span>':"")+'</div><div class="st-cl-cols">'+t.body+"</div></section>").join("")+"</div>"}function Al(t){let e=t&&t.status||"idle",a=t&&Array.isArray(t.entries)&&t.entries||[],r=t&&t.totals||null,s=l=>Number.isFinite(l)?Number(l).toLocaleString("en-US"):"&mdash;",o=l=>{let d=new Date(Number(l)||0),h=f=>String(f).padStart(2,"0");return h(d.getHours())+":"+h(d.getMinutes())+":"+h(d.getSeconds())},i;return e==="loading"?i='<div class="st-tl-msg">Reading&hellip;</div>':e==="error"?i='<div class="st-tl-msg">Could not read the token log.</div>':a.length?i='<div class="st-tl-rows">'+a.map(l=>'<div class="st-tl-row'+(l.outcome==="ok"?"":" bad")+'"'+(l.connection?' title="connection '+u(l.connection)+'"':"")+'><span class="st-tl-t">'+o(l.at)+'</span><span class="st-tl-l">'+u(l.label)+(l.attempt>1?'<b class="st-tl-retry">retry '+l.attempt+"</b>":"")+(l.model?'<b class="st-tl-model">'+u(l.model)+"</b>":"")+'</span><span class="st-tl-u st-tl-up">'+s(l.sent)+'</span><span class="st-tl-u st-tl-dn">'+s(l.received)+'</span><span class="st-tl-o">'+u(l.outcome)+"</span></div>").join("")+"</div>":i='<div class="st-tl-msg">No model calls recorded for this world yet.</div>','<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Model calls</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+(r?'<div class="st-tl-totals"><span class="st-tl-tot"><i>sent</i><b>'+s(r.sent)+'</b></span><span class="st-tl-tot"><i>received</i><b>'+s(r.received)+'</b></span><span class="st-tl-tot"><i>calls</i><b>'+s(r.calls)+"</b></span>"+(r.cached?'<span class="st-tl-tot"><i>of that cached</i><b>'+s(r.cached)+"</b></span>":"")+(r.cacheWrite?'<span class="st-tl-tot"><i>cache writes</i><b>'+s(r.cacheWrite)+"</b></span>":"")+(r.unreported?'<span class="st-tl-warn">'+r.unreported+" call(s) reported no usage &mdash; the totals are short by that much</span>":"")+(r.dropped?'<span class="st-tl-warn">'+s(r.dropped)+" older call(s) dropped past the "+s(r.capped)+"-row cap</span>":"")+"</div>":"")+i+'<p class="st-tl-note">Every model call this world has ever made, newest first &mdash; kept across restarts. Portrait generation is not here: it goes to the engine over HTTP, not through the language model.</p></div>'}function xs({category:t=tt,backLabel:e="Home",contextTokens:a=0,warnTokens:r=Aa,hudStyle:s="",textScale:o=null,narrationScale:i=null,tokenLog:n=null,loreStatus:l=null,run:d=null,helpOpen:h=null}={}){let f=et.some(T=>T.id===t)?t:tt,m=et.find(T=>T.id===f)||et[0],v=Number(a)||0,b=Number(r)||Aa,w=v>0&&v>=b,c=et.map(T=>'<button class="st-sect" type="button" role="tab" aria-selected="'+(T.id===f)+'" data-view="'+T.id+'"><span class="k">'+u(T.kicker)+'</span><span class="n">'+u(T.label)+"</span></button>").join(""),y={continuity:()=>ml({contextTokens:v,warnTokens:b,run:d}),visual:()=>wl({hudStyle:s,textScale:o,narrationScale:i}),sources:()=>xl(Ut(d,"sources"),Wt(d)),advanced:()=>kl(Ut(d,"advanced"),Wt(d)),help:()=>El(h),changelog:()=>Tl(),debug:()=>Ia(l,n)},E=y[f]?y[f]():"";return'<div class="root"'+(w?' data-ctx="warn"':"")+'><div class="stage"></div><section class="screen" data-screen="settings"><div class="head"><button class="back" type="button" data-settings-back>&#9664; '+u(e)+'</button><div class="head-id"><div class="eyebrow">Settings</div><h2>'+u(m.label)+'</h2></div></div><div class="body"><div class="st-rail" role="tablist">'+c+'</div><div class="st-pane" data-view-body="'+f+'">'+E+"</div></div></section></div>"}function ks(t,{open:e,category:a,run:r,onOpen:s,onBack:o,onCategory:i,onStyle:n,onTextScale:l,onNarrationScale:d,onWarnTokens:h,onSources:f}={}){for(let v of t.querySelectorAll('[aria-label="Game settings"]'))v.addEventListener("click",()=>s&&s(tt));for(let v of t.querySelectorAll("[data-open-continuity]"))v.addEventListener("click",()=>s&&s("continuity"));if(!e)return;for(let v of[t.querySelector(".root"),t.querySelector(".gf-bar")])v&&v.addEventListener("click",b=>{let w=y=>b&&b.target&&b.target.closest?b.target.closest(y):null;if(w("[data-settings-back]")){o&&o();return}let c=w("[data-view]");c&&i&&i(c.getAttribute("data-view"))});let m=t.querySelector(".st-pane");if(m&&m.addEventListener("click",v=>{v&&v.target&&v.target.closest&&v.target.closest("[data-token-refresh]")&&i&&i("debug")}),a==="visual"){for(let v of t.querySelectorAll("[data-style-set]"))v.addEventListener("click",()=>{let b=v.getAttribute("data-style-set");for(let w of t.querySelectorAll("[data-style-set]"))w.setAttribute("aria-pressed",String(w===v));n&&n(b)});for(let v of t.querySelectorAll("[data-text-scale]"))v.addEventListener("click",()=>l&&l(v.getAttribute("data-text-scale")));for(let v of t.querySelectorAll("[data-narr-scale]"))v.addEventListener("click",()=>d&&d(v.getAttribute("data-narr-scale")))}if(a==="continuity"){for(let b of Na){let w=t.querySelector('[data-warn="'+b+'"]');w&&w.addEventListener("click",()=>h&&h(b))}let v=t.querySelector("[data-warn-custom]");v&&v.addEventListener("change",()=>{let b=Number(v.value);b>0&&h&&h(Math.round(b*1e3))}),gs(t,{run:r,category:"continuity",onSources:f})}a==="sources"&&Nl(t,{run:r,onSources:f}),a==="advanced"&&gs(t,{run:r,category:"advanced",onSources:f})}function Nl(t,{run:e,onSources:a}){let r=$e("sources"),s=h=>t.querySelector('[data-input="'+h+'"]'),o=h=>t.querySelector('[data-field="'+h+'"]'),i=Ut(e,"sources"),n=()=>{let h=Wt(e,i);for(let f of r){let m=o(f.id);m&&(m.hidden=!xe(f,h))}},l=()=>{n(),a&&a(ws(e,"sources",i))},d=Ta(t,{initial:i.lore,onChange:h=>{i.lore=h,l()}});i.lore=d.value();for(let h of r){if(h.type==="custom")continue;let f=s(h.id);f&&(h.type==="toggle"?(f.setAttribute("aria-checked",i[h.id]?"true":"false"),f.addEventListener("click",()=>{let m=f.getAttribute("aria-checked")!=="true";f.setAttribute("aria-checked",m?"true":"false"),i[h.id]=m,l()})):(typeof i[h.id]=="string"&&(f.value=i[h.id]),f.addEventListener("change",()=>{i[h.id]=typeof f.value=="string"?f.value.trim():"",l()})))}n(),_s(t,r,i)}var Il=new Set(["image_generation","video_generation"]);function gs(t,{run:e,category:a,onSources:r}){let s=$e(a);if(!s.length)return;let o=Ut(e,a);_s(t,s,o);for(let i of s){let n=t.querySelector('[data-input="'+i.id+'"]');n&&n.addEventListener("change",()=>{o[i.id]=typeof n.value=="string"?n.value.trim():"",r&&r(ws(e,a,o))})}}function _s(t,e,a){let r=i=>e.some(n=>n.optionsFrom===i),s=(i,n,l)=>{let d=t.querySelector('[data-input="'+i+'"]');if(!d)return;d.innerHTML=(l?'<option value="">'+u(l)+"</option>":"")+n.map(f=>'<option value="'+u(f.value)+'">'+u(f.label)+"</option>").join("");let h=a[i];typeof h=="string"&&n.some(f=>f.value===h)?d.value=h:l&&(d.value=""),d.disabled=n.length===0&&!l},o=i=>i&&i.emptyOption?i.emptyOption:"";r("connections")&&ve("/api/connections").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{let l=(Array.isArray(i)?i:i&&Array.isArray(i.connections)?i.connections:[]).filter(d=>d&&!Il.has(String(d.provider??""))).map(d=>({value:String(d.id),label:String(d.name||d.model||d.id)}));for(let d of e)d.optionsFrom==="connections"&&s(d.id,l,o(d))}).catch(()=>{}),(r("imageConnections")||r("imageProfiles"))&&ve("/api/gacha-forge/image-options").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{let n=(i&&Array.isArray(i.connections)?i.connections:[]).map(d=>({value:String(d.id),label:String(d.name||d.model||d.id)})),l=(i&&Array.isArray(i.profiles)?i.profiles:[]).map(d=>({value:String(d.id),label:String(d.name)+" \u2014 "+String(d.promptMode)}));for(let d of e)d.optionsFrom==="imageConnections"&&s(d.id,n,o(d)),d.optionsFrom==="imageProfiles"&&s(d.id,l,l.length?"":"Engine default")}).catch(()=>{})}var Ss=`

/* \u2500\u2500 THE SETTINGS SCREEN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Built from the REST OF THE GAME'S pieces, never a pattern of its own. Everything local is
   st- prefixed; only root, screen and head go bare, per the house convention. */

/* The spacing scale is declared HERE, as on every screen: a token read but not declared does not
   fail -- the declaration is silently invalid and every padding collapses to zero. */
.root {
  position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0;
  pointer-events: none;
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
/* Second row ONLY while the header is present: hoistHeadIntoBar REMOVES it, and an auto 1fr screen
   with one child sizes to content instead of to the screen. */
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id { min-width: 0; }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

.body { min-height: 0; min-width: 0; display: flex; gap: var(--sp-3); padding: 0 var(--sp-3) var(--sp-3); }
/* Winning the bar costs the air the header gave: hoistHeadIntoBar removes .head and its padding. */
.screen:not(:has(> .head)) .body { padding-top: var(--sp-2); }

.st-rail { flex: 0 0 17%; min-width: calc(var(--f) * 9); display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); }
.st-sect {
  min-width: 0; cursor: pointer; text-align: left; font-family: var(--display);
  display: flex; flex-direction: column; gap: calc(var(--f) * 0.1);
  padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); color: var(--text);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
.st-sect:hover { border-color: var(--coral); border-left-color: var(--coral); }
.st-sect[aria-selected="true"] { border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 10%); }
.st-sect .k { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-sect .n { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); letter-spacing: var(--track); text-transform: var(--case); }

/* A gap is not filled with MORE THINGS: the rows share the height that exists.
   minmax(min-content, 1fr), NOT minmax(0, 1fr): a plate whose content wraps clips silently. */
/* Measured and reverted: stretching the plates' BOXES does not stretch what is inside them. */
.st-pane { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); overflow: auto; }

/* The plate holding a LONG LIST takes the leftover height, chosen by what it CONTAINS: an
   nth-child pick grows the wrong plate the day a group is added. */
/* The PANEL yields, never the plate: flex-shrink defaults to 1, so unshrinkable content spills
   silently instead of the panel scrolling. */
.st-build-row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.st-build-row .k { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.st-build-row b { font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
.st-plate { flex: 0 0 auto; }
.st-plate:has(.ob-booklist), .st-plate:has(.st-list) { flex: 1 0 auto; }
.st-plate {
  position: relative; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; gap: calc(var(--f) * 0.6);
  padding: var(--sp-3) var(--sp-3) var(--sp-2);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.st-plate > .hd { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
/* THE CHECKS OF THE IMAGES PLATE STACK IN THE RIGHT COLUMN (user: the Outfits one goes right under
   Backgrounds). The grid flows row by row, so a fifth cell landed at the foot of the LEFT column,
   under Portrait style -- two selects on one side and two checks on the other, then a stray check.
   Keyed by KIND and scoped to this plate: a sixth check joins the column with nothing to remember,
   and no other group changes shape. */
.st-plate[data-group="images"] .ob-grid > .ob-field:has(.ob-toggle) { grid-column: 2; }
/* THE CHECKS OF THE IMAGES PLATE STACK IN THE RIGHT COLUMN (user: the Outfits one goes right under
   Backgrounds). The grid flows row by row, so a fifth cell landed at the foot of the LEFT column,
   under Portrait style -- two selects on one side and two checks on the other, then a stray check.
   Keyed by KIND and scoped to this plate: a sixth check joins the column with nothing to remember,
   and no other group changes shape. */
.st-plate[data-group="images"] .ob-grid > .ob-field:has(.ob-toggle) { grid-column: 2; }
.st-plate .k { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); font-family: var(--display); }
.st-plate h3 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.06em; text-transform: var(--case); color: var(--text); }
/* NO reading-width cap: inside a 16:9 stage the HEIGHT is the scarce axis, so capping the width
   spends the scarce thing to save the abundant one. Measured with a 76ch cap, the Chapters line
   wrapped with a third of the plate empty to its right. */
.st-plate p { margin: 0; font-size: var(--t-sm); line-height: 1.55; color: var(--steel-faint); }
.st-foot { margin: 0; flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.08em; line-height: 1.5; color: var(--steel-faint); }
/* What takes the spare height inside a plate; headings and paragraphs do not stretch. */
.st-list { flex: 1 1 auto; min-height: 0; }

.st-chip { cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.6) calc(var(--f) * 1.1); background: var(--ink-3); border: 1px solid transparent; color: var(--steel-faint); font-variant-numeric: tabular-nums; --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-chip:hover { color: var(--text); border-color: var(--coral); }
.st-chip[aria-pressed="true"] { background: var(--coral); color: var(--on-coral); }
.st-chips { display: flex; gap: calc(var(--f) * 0.4); flex-wrap: wrap; }

.st-figs { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.st-figs b { color: var(--text); font-size: var(--t-sm); }
.st-track { position: relative; height: calc(var(--f) * 0.9); background: var(--ink-3); margin-top: calc(var(--f) * 1.2); }
.st-track > i { display: block; height: 100%; background: var(--steel); transition: width 240ms ease, background 240ms ease; }
.st-mark { position: absolute; top: calc(var(--f) * -0.4); bottom: calc(var(--f) * -0.4); width: 2px; background: color-mix(in srgb, var(--amber) 70%, transparent); }
/* THE LABEL ALIGNS RIGHT, not centred on the mark: the mark is pinned at 100% of the bar, so a
   centred label leaves half outside -- measured, 15px of horizontal overflow. */
.st-mark::after { content: attr(data-label); position: absolute; top: calc(var(--f) * -1.5); right: 0; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--amber); white-space: nowrap; }
.st-thresh { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.st-lbl { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-or { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-custom { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); }
.st-custom input { width: calc(var(--f) * 6); background: var(--ink-3); border: 1px solid var(--steel-dark); color: var(--text); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); padding: calc(var(--f) * 0.35) calc(var(--f) * 0.5); text-align: right; font-variant-numeric: tabular-nums; --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-custom input:focus { outline: none; border-color: var(--coral); }
.st-k { font-family: var(--display); font-size: var(--t-sm); color: var(--steel-faint); }

.st-banner { display: none; align-items: center; gap: var(--sp-2); background: color-mix(in srgb, var(--amber) 14%, transparent); border-left: 3px solid var(--amber); padding: calc(var(--f) * 0.6) var(--sp-2); font-size: var(--t-sm); line-height: 1.5; color: color-mix(in srgb, var(--amber) 85%, var(--text)); }
.st-banner svg { width: calc(var(--f) * 1.6); height: calc(var(--f) * 1.6); flex: none; color: var(--amber); }
.root[data-ctx="warn"] .st-track > i { background: var(--amber); }
.root[data-ctx="warn"] .st-banner { display: flex; }

/* \u2500\u2500 Help and Changelog: the two rail panels, re-laid-out for a plate's width \u2500\u2500
   TWO COLUMNS: the rail can only be one at 152px, here there are ~1200. */
/* HELP IS A GRID, NOT column-count, AND THAT IS A BUG FIX: every question is a <details>, and a
   multi-column box RE-BALANCES its whole flow when any child changes height, so opening an answer
   made the topic plates jump between columns. A grid gives each plate a cell. */
.st-help { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: var(--sp-3); }
/* The changelog KEEPS column-count: nothing in it expands, so it never re-balances. */
.st-cl { column-count: 2; column-gap: var(--sp-3); }
.st-cl > .st-plate { break-inside: avoid; margin-bottom: var(--sp-3); }
.st-help-list { display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); }
/* The markup and look are the rail's; what is re-expressed is the SIZE -- the rail sits outside the
   view and is written in rem, and inside the stage every font-size must pass the text control. */
.st-help .gf-faq-q > summary { font-size: var(--t-sm); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.6); gap: calc(var(--f) * 0.5); }
.st-help .gf-faq-q .ic { width: calc(var(--f) * 0.8); height: calc(var(--f) * 0.8); margin-top: calc(var(--f) * 0.22); }
.st-help .gf-faq-q .a { font-size: var(--t-sm); line-height: 1.5; padding: 0 calc(var(--f) * 0.6) calc(var(--f) * 0.6) calc(var(--f) * 1.9); }
/* THE COLOUR IS NOT RE-EXPRESSED. The first version used the surface FRONT token, near-BLACK in
   two of the five styles: measured 1.4:1 on this plate. A front token is only a front over its own
   ground, and the rail's colour already reads on ink. */
/* Buckets SIDE BY SIDE here: three short lists across a plate read as one release. */
/* ONE COLUMN, buckets stacked (user's call). Auto-fit with a ~117px floor fitted THREE columns and
   broke every line into three or four -- a changelog you decode instead of read. */
.st-cl-cols { display: grid; grid-template-columns: 1fr; gap: var(--sp-2); align-items: start; }
.st-cl .gf-log-grp .k { font-size: var(--t-tiny); }
.st-cl .gf-log-grp li { font-size: var(--t-sm); line-height: 1.45; }
.st-cl-rel > .hd h3 { font-variant-numeric: tabular-nums; }
.st-cl-rel.now { border-top-color: var(--coral); }
.st-cl-rel.now > .hd h3 { color: var(--coral); }
.st-cl-rel.now > .hd .k { color: var(--coral); }

.st-list { display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); min-height: 0; }
.st-empty { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding: var(--sp-2) 0; }
.st-ch { display: grid; grid-template-columns: calc(var(--f) * 3.4) minmax(0, 1fr) auto auto; align-items: center; gap: var(--sp-3); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); padding: calc(var(--f) * 0.5) var(--sp-2); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.st-ch .st-idx { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-xl); line-height: 0.9; color: var(--steel-dark); font-variant-numeric: tabular-nums; text-align: center; }
.st-ch h4 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); color: var(--text); }
.st-ch p { margin: 0; font-size: var(--t-tiny); line-height: 1.4; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.st-status { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.16em; text-transform: var(--case); padding: calc(var(--f) * 0.2) calc(var(--f) * 0.6); white-space: nowrap; --cut: 0.35em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-status.-ready { background: color-mix(in srgb, var(--coral) 20%, transparent); color: var(--coral); }
.st-status.-compressed { background: color-mix(in srgb, var(--jade) 18%, transparent); color: var(--jade); }
.st-status.-playing { background: var(--ink-3); color: var(--steel-faint); }
.st-compress { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); cursor: pointer; white-space: nowrap; --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.st-compress:hover { border-color: var(--coral); color: var(--coral); }
.st-compress svg { width: calc(var(--f) * 1.1); height: calc(var(--f) * 1.1); }
.st-done { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--jade); white-space: nowrap; }
.st-done svg { width: calc(var(--f) * 1.1); height: calc(var(--f) * 1.1); }
.st-lock { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); white-space: nowrap; }
.st-ch.-compressed { border-left-color: var(--jade); }
.st-ch.-ready { border-left-color: var(--coral); }
.st-ch.-playing { opacity: 0.72; }

.st-styles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sp-2); align-content: stretch; }
.st-sty {
  position: relative; overflow: hidden; cursor: pointer; padding: var(--sp-2);
  border: 1px solid var(--ink-3); background: var(--ink-2); color: var(--text);
  font: inherit; text-align: left; display: flex; flex-direction: column; justify-content: flex-end;
  min-height: calc(var(--f) * 14); gap: calc(var(--f) * 0.1);
  --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  transition: border-color var(--dur-fast) ease;
}
.st-sty:hover { border-color: var(--coral); }
.st-sty[aria-pressed="true"] { border-color: var(--coral); }
.st-mini { position: absolute; inset: 0; }
.st-mini i { position: absolute; display: block; }
/* The label rests on ANOTHER style's palette with the CURRENT style's text colour, so it needs its
   own veil -- opaque WHERE THE TEXT SITS. */
.st-sty::after { content: ""; position: absolute; inset: auto 0 0 0; height: 82%; z-index: 1; pointer-events: none;
  background: linear-gradient(0deg, var(--ink) 0 64%, color-mix(in srgb, var(--ink) 70%, transparent) 84%, transparent 100%); }
.st-swlbl { position: relative; z-index: 2; }
.st-swlbl b { display: block; font-family: var(--display); font-stretch: var(--stretch); font-size: var(--t-sm); font-weight: 700; letter-spacing: 0.06em; text-transform: var(--case); }
.st-swlbl span { display: block; font-size: var(--t-tiny); color: var(--steel-faint); line-height: 1.25; }
.st-tick {
  position: absolute; top: calc(var(--f) * 0.3); right: calc(var(--f) * 0.3); z-index: 3;
  width: calc(var(--f) * 1.1); height: calc(var(--f) * 1.1);
  background: var(--coral); color: var(--on-coral); display: none; place-items: center; font-size: var(--t-tiny);
  --cut: 0.3em; clip-path: var(--clip-chip);
}
.st-sty[aria-pressed="true"] .st-tick { display: grid; }

/* Debug uses the same plates as everyone, the SAME declaration: it was the one category without
   the no-shrink rule and its blocks drew over each other. */
.st-tl {
  position: relative; min-width: 0; flex: 0 0 auto;
  display: flex; flex-direction: column; gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-3) var(--sp-2);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.st-tl-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.st-tl-title { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-tl-refresh { cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.9); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.st-tl-refresh:hover { border-color: var(--coral); color: var(--coral); }
.st-tl-totals { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-3); }
.st-tl-tot { display: flex; align-items: baseline; gap: calc(var(--f) * 0.4); }
.st-tl-tot i { font-style: normal; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-tl-tot b { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); letter-spacing: var(--track); color: var(--text); font-variant-numeric: tabular-nums; }
.st-tl-warn { flex: 1 1 100%; font-size: var(--t-xs); color: var(--amber); }
/* Scrolls inside its own box: without the cap a long ledger compresses the block below it and the
   two texts draw on top of each other. */
.st-tl-rows { display: flex; flex-direction: column; gap: 1px; min-height: 0; max-height: calc(var(--f) * 22); overflow-y: auto; }
.st-tl-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: baseline; gap: calc(var(--f) * 0.7); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.5); background: var(--ink-3); font-size: var(--t-xs); }
.st-tl-row.bad { border-left: 2px solid var(--alarm); }
.st-tl-t { color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.st-tl-l { color: var(--text); font-family: var(--display); font-weight: 700; letter-spacing: 0.06em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-tl-retry { margin-left: calc(var(--f) * 0.4); font-weight: 700; color: var(--amber); }
/* The model rides in the job's cell, dim and NOT bold: a second loud thing in the same cell turns
   the column into noise. It shares the cell's ellipsis. */
.st-tl-model { margin-left: calc(var(--f) * 0.5); font-family: var(--body); font-weight: 400; letter-spacing: 0; color: var(--steel-faint); }
.st-tl-u { font-variant-numeric: tabular-nums; min-width: calc(var(--f) * 3.6); text-align: right; }
.st-tl-up { color: var(--steel); }
.st-tl-up::before { content: "\u2191"; margin-right: 2px; color: var(--steel-faint); }
.st-tl-dn { color: var(--jade); }
.st-tl-dn::before { content: "\u2193"; margin-right: 2px; color: var(--steel-faint); }
.st-tl-o { color: var(--steel-faint); }
.st-tl-row.bad .st-tl-o { color: var(--alarm); }
.st-tl-msg { padding: var(--sp-3); text-align: center; color: var(--steel-faint); font-size: var(--t-sm); }
.st-tl-note { margin: 0; font-size: var(--t-tiny); line-height: 1.45; color: var(--steel-faint); }

/* \u2500\u2500 Sources: the setup's controls in the HUD's vocabulary \u2500\u2500\u2500\u2500\u2500\u2500
   The CONTROL is the wizard's (same markup, ids, wiring); only the skin differs. The .st-pane
   scope exists so these rules cannot reach the wizard. */
/* ONE height for every control: selects and checkboxes draw different markup, so heights must come
   from ONE place or they drift. */
/* From the TEXT, not the geometric scale: tied to --f the box stays fixed while the text grows. */
.st-pane { --st-ctl: calc(var(--t-sm) * 1.3 + var(--f) * 1.3); --st-sb: calc(var(--f) * 0.55); }
.st-pane .ob-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); align-content: start; }
.st-pane .ob-grid > * { min-width: 0; }
.st-pane .ob-wide { grid-column: 1 / -1; }
/* A checkbox aligns with the CONTROL beside it, not its label: it has none above, so top-aligned
   it sat at the neighbour's label height. */
/* The UA rule for [hidden] LOSES against any author display declaration, and this sheet declares
   display:flex for .ob-field just below: a hidden conditional field still drew, measured at 35px. */
.st-pane [hidden] { display: none !important; }
.st-pane .ob-field { display: flex; flex-direction: column; gap: calc(var(--f) * 0.35); min-height: 0; }
.st-pane .ob-field:has(> .ob-toggle) { justify-content: flex-end; }
/* renderField wraps the label in .ob-labelrow as soon as the field has help, so a direct-child
   selector alone drops the screen's type on any field with a question mark. */
.st-pane .ob-field > label,
.st-pane .ob-field > .ob-labelrow > label { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-pane .ob-field .hint { font-size: var(--t-tiny); line-height: 1.45; color: var(--steel-faint); }
/* The field's help mark, in this sheet's units. Markup in onboarding.js; only the scale changes. */
/* A TIP IS PORTED WHOLE, not just its sizes. This sheet had the SIZE rules and none of the
   BEHAVIOUR, and this screen never emits ONBOARDING_STYLES: help text drew as fixed prose under the
   label and pushed the control down. A sheet that sizes a tip must hide it, and there is a gate. */
.st-pane .ob-labelrow { position: relative; display: flex; align-items: center; gap: calc(var(--f) * 0.4); }
.st-pane .ob-labelrow > label { flex: none; }
.st-pane .ob-help { width: calc(var(--f) * 1.35); height: calc(var(--f) * 1.35); display: inline-grid; place-items: center; padding: 0; cursor: help;
  background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); border-radius: 50%;
  color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); line-height: 1; }
.st-pane .ob-help:hover, .st-pane .ob-help:focus-visible { color: var(--text); border-color: var(--steel); outline: none; }
.st-pane .ob-tip { position: absolute; z-index: 5; left: 0; right: 0;
  top: calc(100% + var(--f) * 0.35); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.65);
  background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--text);
  font-size: var(--t-tiny); line-height: 1.5; text-align: left; text-transform: none; letter-spacing: normal;
  opacity: 0; visibility: hidden; transition: opacity 120ms ease; pointer-events: none; box-shadow: var(--panel-shadow); }
.st-pane .ob-tip b { color: var(--text); }
.st-pane .ob-labelrow:has(.ob-help:hover) .ob-tip,
.st-pane .ob-labelrow:has(.ob-help:focus-visible) .ob-tip { opacity: 1; visibility: visible; }
.st-pane .ob-req { color: var(--coral); }
/* Control height matches the rest of the game's controls, measured against a real screen. */
.st-pane .ob-control {
  width: 100%; min-height: var(--st-ctl); font: inherit; font-family: var(--display); font-size: var(--t-sm); color: var(--text);
  background: var(--ink-3); border: 1px solid var(--steel-dark); border-left: 2px solid var(--steel-dark);
  padding: 0 calc(var(--f) * 0.8); outline: none;
  --cut: 0.45em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
}
.st-pane .ob-control:hover { border-color: var(--steel); }
/* A DIRECTIVE IS A PARAGRAPH, NOT A LINE: measured, 2,000 characters drew 2 of their 14 lines in a
   66px box. The box gets its own height and scrolls INSIDE itself. */
.st-pane textarea.ob-control { min-height: calc(var(--f) * 14); line-height: 1.5; resize: none; }
/* A select with min-height centres its own text; an input needs the padding. */
.st-pane .ob-control:not(select) { padding-top: calc(var(--f) * 0.5); padding-bottom: calc(var(--f) * 0.5); }
.st-pane .ob-control:focus { border-color: var(--coral); border-left-color: var(--coral); }
/* Same height as the select, from the same arithmetic: a copied number drifts. */
.st-pane .ob-toggle { display: grid; grid-template-columns: calc(var(--f) * 1.4) minmax(0, 1fr); gap: 0 calc(var(--f) * 0.6); align-items: center; cursor: pointer; min-height: var(--st-ctl); padding: 0 calc(var(--f) * 0.8); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.st-pane .ob-toggle:hover { border-color: var(--coral); border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-2) 82%, transparent); }
.st-pane .ob-toggle b { display: block; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); color: var(--text); line-height: 1.2; }
.st-pane .ob-toggle .bd { display: block; font-size: var(--t-tiny); line-height: 1.35; color: var(--steel-faint); }
.st-pane .ob-bx { width: calc(var(--f) * 1.4); height: calc(var(--f) * 1.4); display: grid; place-items: center; cursor: pointer; background: var(--ink-3); border: 1px solid var(--steel-dark); color: transparent; font-size: var(--t-xs); --cut: 0.3em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-pane .ob-bx[aria-checked="true"] { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
/* Columns are sized by their HEADING, not the box -- and heading and rows are two grids, so their
   columns must be declared equal or the labels sit over the wrong boxes. */
.st-pane .ob-bookgrid { display: grid; grid-template-columns: minmax(0, 1fr) calc(var(--f) * 4) calc(var(--f) * 4); align-items: center; gap: 0 calc(var(--f) * 0.4); }
.st-pane .ob-bookhead span:not(:first-child) { text-align: center; letter-spacing: 0.1em; }
/* Heading and row share ONE indent declaration: written separately they drift. */
.st-pane .ob-bookgrid { padding-inline: calc(var(--f) * 0.5); border-left: 2px solid transparent; }
.st-pane .ob-bookhead { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding-bottom: calc(var(--f) * 0.3); }
.st-pane .ob-bookhead span:not(:first-child) { text-align: center; }
/* The library takes the height its field gives it, with a floor: a fixed cap left air under it
   while the books scrolled. */
/* The wide field may shrink, the LIST may not. Together in one rule this outranked its floor. */
.st-pane .ob-field.ob-wide { min-height: 0; }
/* The books get the whole row. The panel may scroll inside its box; the SCREEN may not. */
/* TWO columns: rows flow row-first, so column 1 falls under the first heading. */
/* The scrollbar takes width the heading does not have: both read ONE token. */
.st-pane .ob-booklist::-webkit-scrollbar { width: var(--st-sb); }
.st-pane .ob-booklist::-webkit-scrollbar-thumb { background: var(--steel-dark); }
/* The heading is the list's FIRST ROW: as a sibling the list scrolls and it does not, so the
   scrollbar eats width from one and their columns drift. Two boxes align by being ONE. */
.st-pane .ob-booklist .ob-bookhead { position: sticky; top: 0; z-index: 1; background: var(--ink-2); }
/* The stretch is VERTICAL and the visible count is the user's choice: the rest scrolls inside the
   list under a sticky heading. */
/* The heading occupies one slot, so the height is N rows PLUS its own. */
.st-pane .ob-booklist { min-width: 0; flex: 0 1 auto; min-height: calc(var(--f) * 20); max-height: calc(var(--f) * 20); overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 1px; }
.st-pane .ob-field.ob-wide { min-height: 0; }
.st-pane .ob-book { min-width: 0; padding-block: calc(var(--f) * 0.35); background: var(--ink-3); }
.st-pane .ob-book:hover { border-left-color: var(--steel); }
.st-pane .ob-book.on { border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 10%); }
.st-pane .ob-book .bt { min-width: 0; }
.st-pane .ob-book b { display: block; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.04em; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The description does not travel to Settings: it earns its place in the WIZARD, where books are
   new. Here the NAME distinguishes them and the height buys visible books. */
.st-pane .ob-book .bd { display: none; }
.st-pane .ob-books-empty { font-size: var(--t-xs); color: var(--steel-faint); padding: calc(var(--f) * 0.5); }
.st-pane .ob-budget { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
.st-pane .ob-bud { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); }
.st-pane .ob-bud .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
/* Wide enough for the full figure: a value clipped INSIDE an input is invisible to every
   ancestor-based overflow check. */
.st-pane .ob-bud input { width: calc(var(--f) * 8.5); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); color: var(--text); background: var(--ink-3); border: 1px solid var(--steel-dark); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.5); text-align: right; font-variant-numeric: tabular-nums; outline: none; --cut: 0.35em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-pane .ob-bud input:focus { border-color: var(--coral); }
.st-pane .ob-bud .w { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.08em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
/* That something does NOT fit is what this number exists for. */
.st-pane .ob-bud .w[data-over="true"] { color: var(--amber); }
`;var Cl=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function Rl(t){let e=Cl[t];return e?`Chapter ${e}`:`Chapter ${t}`}var Es=["Reading the scenario\u2026","Forging the chapter\u2026","Writing the story beats\u2026"],Ca=["Reading the scenario\u2026","Summoning the founding cast\u2026","Naming the heroes\u2026"],gt=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
}

.forge-stage {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background:
    radial-gradient(70% 55% at 50% 108%, color-mix(in srgb, var(--coral) 30%, transparent) 0%, transparent 62%),
    radial-gradient(90% 70% at 80% 8%, var(--glow-1) 0%, transparent 60%),
    linear-gradient(168deg, var(--ground-1) 0%, var(--ground-2) 100%);
}
.forge-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  opacity: var(--scanlines);
  background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px);
  pointer-events: none;
}

.forge {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: var(--sp-2) var(--sp-4);
  pointer-events: none;
}

.forge-brand { display: flex; align-items: center; gap: var(--sp-2); justify-self: start; }
.forge-brand .rhombus {
  width: calc(var(--f) * 1.5);
  height: calc(var(--f) * 1.5);
  background: var(--coral);
  transform: rotate(var(--pip-rotate));
  border-radius: var(--pip-radius);
  flex: none;
}
.forge-brand b {
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: var(--case);
  font-size: var(--t-md);
  color: var(--text);
}
.forge-brand span {
  font-family: var(--display);
  font-size: var(--t-xs);
  letter-spacing: 0.16em;
  text-transform: var(--case);
  color: var(--steel-faint);
}

.forge-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--sp-2);
  min-height: 0;
}

.forge-emblem { width: calc(var(--f) * 12); height: calc(var(--f) * 12); }
/* Colours as CSS, never as SVG attributes: var() is ignored in stroke="" / stop-color="". */
.forge-emblem .frame { stroke: var(--steel); opacity: 0.5; }
.forge-emblem .arc { stroke: var(--coral); }
.forge-emblem .halo { fill: url(#forge-ember-grad); }
.forge-emblem .core { fill: var(--coral); }
.forge-emblem .g-in, .forge-emblem .g-mid, .forge-emblem .g-out { stop-color: var(--coral); }
/* The style picks the geometry, exactly like --clip-card does for everything that can be clipped. */
.forge-emblem .cut { display: var(--emblem-cut); }
.forge-emblem .round { display: var(--emblem-round); }
/* Pivot at the viewBox centre (60,60), not the arc's bbox. */
.forge-emblem .spin  { transform-box: view-box; transform-origin: 60px 60px; animation: forge-spin 1.5s linear infinite; }
.forge-emblem .ember { transform-box: view-box; transform-origin: 60px 60px; animation: forge-ember 1.7s ease-in-out infinite; }
@keyframes forge-spin { to { transform: rotate(360deg); } }
@keyframes forge-ember { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

.forge-center .eyebrow {
  font-family: var(--display);
  font-size: var(--t-sm);
  letter-spacing: 0.24em;
  text-transform: var(--case);
  color: var(--coral);
  margin-top: var(--sp-2);
}
.forge-center h2 {
  margin: calc(var(--f) * 0.2) 0 0;
  font-family: var(--title);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-2xl);
  line-height: 1;
  letter-spacing: 0.02em;
  color: var(--text);
}
.forge-center .scenario {
  font-family: var(--display);
  font-size: var(--t-md);
  letter-spacing: 0.16em;
  text-transform: var(--case);
  color: var(--steel-faint);
}

.forge-status {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-lg);
  letter-spacing: 0.03em;
  color: var(--text);
}
.forge-status::before {
  content: "";
  width: calc(var(--f) * 0.9);
  height: calc(var(--f) * 0.9);
  background: var(--coral);
  transform: rotate(var(--pip-rotate));
  border-radius: var(--pip-radius);
  flex: none;
  animation: forge-blink 900ms steps(2, jump-none) infinite;
}
.forge.-error .forge-status { color: var(--alarm); }
.forge.-error .forge-status::before { background: var(--alarm); animation: none; }
@keyframes forge-blink { 50% { opacity: 0.25; } }

.forge-error {
  margin-top: var(--sp-2);
  font-size: var(--t-sm);
  color: var(--steel-faint);
  line-height: 1.5;
  max-width: 48ch;
}
.forge-error[hidden] { display: none; }

.forge-retry {
  margin-top: var(--sp-2);
  pointer-events: auto;
  background: var(--coral);
  color: var(--on-coral);
  border: 0;
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: 0.12em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.7) var(--sp-4);
  cursor: pointer;
  --cut: 0.8em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
  transition: background 140ms ease;
}
.forge-retry:hover { background: var(--coral-deep); }
.forge-retry:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--text); }
.forge-retry[hidden] { display: none; }

/* THE ESCAPE HATCH, quiet ON PURPOSE: it sits beside a Retry on a screen the player is meant to be
   waiting on, and the loud treatment belongs to what resumes the world, never to what destroys it. */
/* The measure ceiling belongs to the PROSE, not the block: on the block the two-button row
   inherited 46ch and broke onto two lines -- measured, 302 + 192 inside 397. */
.forge-cancel { margin-top: var(--sp-3); pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.forge-cancel-open {
  background: transparent; color: var(--steel-faint);
  border: 1px solid var(--steel-dark);
  font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case);
  padding: calc(var(--f) * 0.45) var(--sp-3); cursor: pointer;
  --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
  transition: color 140ms ease, border-color 140ms ease;
}
.forge-cancel-open:hover { color: var(--alarm); border-color: var(--alarm); }
.forge-cancel-open:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--alarm); }
/* Asking: the warning says what is lost, in the alarm colour the game already uses for a loss. */
.forge-cancel.-confirm { border-top: 1px solid color-mix(in srgb, var(--alarm) 45%, transparent); padding-top: var(--sp-2); }
/* Red, but READABLE: plain alarm measures 3.7 on bloom, under the floor. Twenty percent of the text
   colour lifts the worst of the five to 4.6 and it still reads red. */
.forge-cancel-warn { margin: 0; max-width: 46ch; font-size: var(--t-xs); line-height: 1.45; text-align: center; color: color-mix(in srgb, var(--alarm) 80%, var(--text)); }
.forge-cancel-acts { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-2); }
.forge-cancel-go, .forge-cancel-keep {
  font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em;
  text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-3); cursor: pointer;
  --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
/* THE DESTRUCTIVE BUTTON: an alarm EDGE over an alarm-TINTED ground, not a solid fill. Measured
   across the five styles, NO token on a solid alarm reaches 4.5 -- the best is ink at 3.7. Tinting
   the ground puts the label back on a dark surface: 11 to 15.7 across the five. */
.forge-cancel-go { background: color-mix(in srgb, var(--alarm) 26%, var(--ink)); color: var(--text); border: 1px solid var(--alarm); }
.forge-cancel-go:hover { background: color-mix(in srgb, var(--alarm) 40%, var(--ink)); }
.forge-cancel-keep { background: transparent; color: var(--text); border: 1px solid var(--steel-dark); }
.forge-cancel-keep:hover { border-color: var(--coral); color: var(--coral); }
.forge-cancel-go:focus-visible, .forge-cancel-keep:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--text); }

.forge-foot {
  justify-self: center;
  align-self: end;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--t-sm);
  color: var(--steel-faint);
  letter-spacing: 0.02em;
  line-height: 1.5;
  text-align: center;
  max-width: 60ch;
}
.forge-foot svg { width: calc(var(--f) * 1.5); height: calc(var(--f) * 1.5); flex: none; color: var(--steel); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`,Ts=`
<svg class="forge-emblem" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="forge-ember-grad" cx="50%" cy="50%" r="50%">
      <stop class="g-in" offset="0%" stop-opacity="0.95"/>
      <stop class="g-mid" offset="60%" stop-opacity="0.35"/>
      <stop class="g-out" offset="100%" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path class="frame cut" d="M30 12 H90 L108 30 V90 L90 108 H30 L12 90 V30 Z" fill="none" stroke-width="2"/>
  <circle class="frame round" cx="60" cy="60" r="48" fill="none" stroke-width="2"/>
  <g class="spin"><path class="arc" d="M60 14 A46 46 0 0 1 106 60" fill="none" stroke-width="3" stroke-linecap="round"/></g>
  <g class="ember">
    <path class="halo cut" d="M60 30 L90 60 L60 90 L30 60 Z"/>
    <path class="core cut" d="M60 44 L76 60 L60 76 L44 60 Z"/>
    <circle class="halo round" cx="60" cy="60" r="30"/>
    <circle class="core round" cx="60" cy="60" r="16"/>
  </g>
</svg>`,As='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';function Ll({done:t=0,total:e=0,name:a=""}={}){let r=Math.min(t+1,Math.max(e,1));return{label:"Founding Cast",status:e>0?a?`Summoning ${u(a)}\u2026 ${r}/${e}`:`Summoning the founding cast\u2026 ${r}/${e}`:Ca[0],eyebrow:"Summoning the founding cast",brandNote:"&middot; first-time setup",foot:"Summoning this world's founding heroes from your scenario &mdash; the cast the story is built around. This happens once.",errorStatus:"Couldn't summon the founding cast.",errorBody:"The summon returned units that didn't match the expected format. Nothing was saved."}}function Ml({done:t=0,total:e=0,name:a=""}={}){let r=Math.min(t+1,Math.max(e,1));return{label:"Founding Cast",status:a?`Painting ${a}\u2026 ${r}/${e}`:`Painting the founding cast\u2026 ${t}/${e}`,eyebrow:"Painting the founding cast",brandNote:"&middot; first-time setup",foot:"Generating each hero's portrait, one at a time, so they have a face when they speak in the story. The first chapter is being forged at the same time.",errorStatus:"Couldn't paint the cast.",errorBody:"No portrait could be generated. Check the world's image connection &mdash; the story is ready either way, and the heroes will show their silhouette until art exists.",retryLabel:"Continue"}}function Ol(t,e){let a=Number(e)<=1;return{label:t,status:Es[0],eyebrow:a?"Forging the first chapter":"Forging the next chapter",brandNote:a?"&middot; first-time setup":"&middot; new chapter",foot:a?`Forging ${u(t)}'s story beats from your scenario. This happens once &mdash; the story is written before you play it.`:`Forging ${u(t)}'s story beats from your scenario &mdash; the story is written before you play it.`,errorStatus:"Couldn't read the forged chapter.",errorBody:"The forge returned a plan that didn't match the expected format. Nothing was saved."}}function Ns(t){return'<div class="forge-cancel'+(t?" -confirm":"")+'">'+(t?'<p class="forge-cancel-warn">This deletes the world being created &mdash; its cast, its art and its story. It cannot be undone.</p><div class="forge-cancel-acts"><button class="forge-cancel-go" type="button" data-forge-cancel-go>Delete and start over</button><button class="forge-cancel-keep" type="button" data-forge-cancel-keep>Keep waiting</button></div>':'<button class="forge-cancel-open" type="button" data-forge-cancel>Cancel world creation</button>')+"</div>"}function Vt({scenario:t,chapter:e=1,error:a=!1,mode:r="chapter",progress:s,cancel:o=!1,confirming:i=!1}){let n=t&&t.trim()?t.trim():"Your scenario",l=r==="banner"?Ll(s):r==="art"?Ml(s):Ol(Rl(e),e),d=l.label,h=a?l.errorStatus:l.status,f=l.eyebrow,m=l.brandNote,v=l.foot;return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${a?" -error":""}">
    <div class="forge-brand">
      <span class="rhombus" aria-hidden="true"></span>
      <b>Gacha Forge</b><span>${m}</span>
    </div>

    <div class="forge-center">
      ${Ts}
      <span class="eyebrow">${f}</span>
      <h2>${u(d)}</h2>
      <span class="scenario">${u(n)}</span>
      <div class="forge-status" aria-live="polite">${u(h)}</div>
      <p class="forge-error"${a?"":" hidden"}>${l.errorBody}</p>
      <button class="forge-retry" type="button"${a?"":" hidden"}>${u(l.retryLabel||"Retry")}</button>
      ${o?Ns(i):""}
    </div>

    <p class="forge-foot">
      ${As}
      <span>${v}</span>
    </p>
  </div>
</div>`}function Is({chapterTitle:t,error:e=!1,prologue:a=!1,art:r=null,cancel:s=!1,confirming:o=!1}={}){let i=t&&t.trim()?t.trim():"Chapter One",n=r&&Number(r.total)||0,l=!e&&n>0,d=l?Math.min((Number(r.done)||0)+1,n):0,h=e?"Couldn't write this beat.":l?`${r.name?`Painting ${r.name}`:"Painting this beat's places"}\u2026 ${d}/${n}`:"Generating story\u2026",f=l?"The story is written. It reaches a place this world has never drawn, and that art is being painted now.":"The narrator is writing this beat. It will appear when it's ready.";return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${e?" -error":""}">
    <div class="forge-brand"><span class="rhombus" aria-hidden="true"></span><b>Gacha Forge</b></div>
    <div class="forge-center">
      ${Ts}
      <span class="eyebrow">${a?"Prologue":"Story"}</span>
      <h2>${u(i)}</h2>
      <div class="forge-status" aria-live="polite">${u(h)}</div>
      <p class="forge-error"${e?"":" hidden"}>The narrator returned something unreadable. Nothing was saved.</p>
      <button class="forge-retry" type="button"${e?"":" hidden"}>Retry</button>
      ${s?Ns(o):""}
    </div>
    <p class="forge-foot">${As}<span>${f}</span></p>
  </div>
</div>`}function rt(t,{onRetry:e,cycle:a,phases:r,onCancel:s,onCancelGo:o,onCancelKeep:i}){let n=t.querySelector(".forge-retry");n&&n.addEventListener("click",()=>e?.());let l=t.querySelector("[data-forge-cancel]");l&&s&&l.addEventListener("click",()=>s());let d=t.querySelector("[data-forge-cancel-go]");d&&o&&d.addEventListener("click",()=>o());let h=t.querySelector("[data-forge-cancel-keep]");h&&i&&h.addEventListener("click",()=>i());let f=t.querySelector(".forge-status");if(!a||!f)return()=>{};let m=Array.isArray(r)&&r.length?r:Es,v=0;f.textContent=m[0];let b=setInterval(()=>{v=(v+1)%m.length,f.textContent=m[v]},1100);return()=>clearInterval(b)}function Rs(t){return(t<10?"0":"")+t}var Cs=10,Bl=5,zl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Fl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>',Pl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ls=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
}

.stage {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background:
    radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%),
    radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%),
    linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%);
}

/* The head is NOT always here: hoistHeadIntoBar moves it into the top bar and calls remove(),
   leaving this box with ONE child. With a fixed auto 1fr template that child lands in the AUTO row
   and sizes to its own content. No harness reproduces it: a harness never hoists.
   :has() gives the second row only while the head is present. */
.sel { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; }
.sel:has(> .sel-head) { grid-template-rows: auto minmax(0, 1fr); }

.sel-head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.4);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  color: var(--on-surface);
  border: 0;
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-sm);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.5) var(--sp-2);
  cursor: pointer;
  --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm);
}
.back:hover { background: #FFFFFF; }
.sel-id { min-width: 0; }
.sel-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.sel-id h2 {
  margin: 0;
  font-family: var(--title);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-xl);
  line-height: 1.05;
  letter-spacing: 0.02em;
  color: var(--text);
}

.sel-scroll { min-height: 0; overflow: auto; padding: var(--sp-2) var(--sp-3) var(--sp-4); }
.sel-list { display: flex; flex-direction: column; gap: calc(var(--f) * 0.8); max-width: calc(var(--f) * 96); margin: 0 auto; }
.sel-empty { font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); text-align: center; padding: var(--sp-4) 0; }

.ch-card {
  display: grid;
  grid-template-columns: calc(var(--f) * 6.5) 1fr auto;
  align-items: stretch;
  gap: var(--sp-3);
  background: var(--surface);
  color: var(--on-surface);
  padding: var(--sp-2) var(--sp-3);
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  border-left: 3px solid var(--steel-faint);
  cursor: pointer;
  transition: transform 140ms cubic-bezier(0.2, 0.8, 0.3, 1), background 140ms ease; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.ch-card:hover { transform: translateX(calc(var(--f) * 0.5)); }

.ch-index {
  align-self: center;
  justify-self: center;
  width: calc(var(--f) * 5.2);
  height: calc(var(--f) * 5.2);
  display: grid;
  place-items: center;
  background: var(--ink-2);
  color: var(--porcelain-3);
  font-family: var(--title);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-2xl);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  --cut: 0.55em; clip-path: var(--clip-card); border-radius: var(--radius); backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }

.ch-body { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: calc(var(--f) * 0.25); }
.ch-eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.5); }
.ch-title { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.02em; line-height: 1.1; color: var(--on-surface); }
.ch-premise { margin: 0; font-size: var(--t-xs); line-height: 1.4; color: var(--steel); max-width: 62ch; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

.ch-foot { display: flex; align-items: center; gap: var(--sp-2); margin-top: calc(var(--f) * 0.35); }
.diffs { display: inline-flex; gap: calc(var(--f) * 0.3); }
.diffs span {
  width: calc(var(--f) * 1.7);
  height: calc(var(--f) * 1.7);
  display: grid;
  place-items: center;
  font-family: var(--display);
  font-weight: 700;
  font-size: calc(var(--f) * 0.9 * var(--gf-type-scale, 1));
  border: 1px solid var(--porcelain-3);
  color: var(--porcelain-3);
}
.diffs span.on { background: color-mix(in srgb, var(--jade) 18%, transparent); border-color: var(--jade); color: #1C6B54; }
.ch-bar { flex: 1; max-width: calc(var(--f) * 26); }
.ch-bar .fig { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel); font-variant-numeric: tabular-nums; margin-bottom: calc(var(--f) * 0.25); }
.ch-bar .track { height: calc(var(--f) * 0.55); background: var(--porcelain-3); }
.ch-bar .track > i { display: block; height: 100%; background: var(--coral); }
.ch-hint { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); }
.ch-hint svg { width: calc(var(--f) * 1.3); height: calc(var(--f) * 1.3); }

.ch-action { align-self: center; display: flex; align-items: center; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.4);
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.6) var(--sp-3);
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid;
  --cut: 0.6em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.btn svg { width: calc(var(--f) * 1.3); height: calc(var(--f) * 1.3); }
/* Enter/Continue/Begin navigate, they do not spend a turn, so NOT solid coral: solid coral stays
   reserved for the node map's Play. */
.btn-go { background: transparent; border-color: var(--coral); color: var(--coral-deep); }
.btn-go:hover { background: var(--coral); color: var(--on-coral); }
.btn-enter { background: transparent; border-color: var(--steel); color: var(--on-surface); }
.btn-enter:hover { border-color: var(--coral); color: var(--coral-deep); }

.ch-card.cleared { border-left-color: var(--jade); }
.ch-card.cleared .ch-index { background: color-mix(in srgb, var(--jade) 14%, var(--porcelain-2)); color: #1C6B54; }
.ch-card.cleared .ch-eyebrow { color: var(--jade); }

.ch-card.current { border-left-color: var(--coral); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 30%, transparent); }
.ch-card.current .ch-index { background: var(--coral); color: var(--on-coral); }
.ch-card.current .ch-eyebrow { color: var(--coral-deep); }

.ch-card.new { background: color-mix(in srgb, var(--surface) 96%, var(--coral)); border-left: 3px dashed var(--coral); }
.ch-card.new .ch-index { background: transparent; border: 2px dashed var(--coral); color: var(--coral-deep); }
.ch-card.new .ch-eyebrow { color: var(--coral-deep); }

.ch-card.locked { background: color-mix(in srgb, var(--surface) 26%, var(--ink-2)); color: var(--steel-faint); border-left-color: var(--ink-3); cursor: default; }
.ch-card.locked:hover { transform: none; }
.ch-card.locked .ch-index { background: var(--ink-3); color: var(--steel-faint); opacity: 0.7; }
.ch-card.locked .ch-title { color: var(--steel-faint); }
.ch-card.locked .ch-eyebrow { color: var(--steel-faint); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;function Ms(){return`
<div class="root">
  <div class="stage"></div>
  <div class="sel">
    <div class="sel-head">
      <button class="back" type="button" data-back>&#9664; Command</button>
      <div class="sel-id"><div class="eyebrow">Story</div><h2>Chapters</h2></div>
    </div>
    <div class="sel-scroll">
      <div class="sel-list" data-chapters-list><p class="sel-empty">Loading chapters&hellip;</p></div>
    </div>
  </div>
</div>`}function Hl(t){let e=Rs(t.chapter),a=`Chapter ${we(t.chapter)} &middot; ${t.cleared?"Cleared":"In progress"}`,r,s;if(t.cleared){let o=t.combats||Bl,i=(t.hard||0)>=o?" on":"",n=(t.veryhard||0)>=o?" on":"";r=`<span class="diffs"><span class="on">N</span><span class="${i.trim()}">H</span><span class="${n.trim()}">V</span></span>`,s='<button class="btn btn-enter" type="button">Enter</button>'}else{let o=t.normal||0,i=Math.min(100,Math.round(o/Cs*100));r=`<div class="ch-bar"><div class="fig">${o} / ${Cs} nodes</div><div class="track"><i style="width:${i}%"></i></div></div>`,s=`<button class="btn btn-go" type="button">${o>0?"Continue":"Enter"}</button>`}return`<article class="ch-card ${t.cleared?"cleared":"current"}" data-open-chapter="${t.chapter}"><div class="ch-index">${e}</div><div class="ch-body"><div class="ch-eyebrow">${a}</div><h3 class="ch-title">${u(t.title)}</h3><p class="ch-premise">${u(t.premise)}</p><div class="ch-foot">${r}</div></div><div class="ch-action">${s}</div></article>`}function Dl(t,e){let a=Rs(t);if(e)return`<article class="ch-card new" data-open-chapter="${t}"><div class="ch-index">${a}</div><div class="ch-body"><div class="ch-eyebrow">Chapter ${we(t)} &middot; New</div><h3 class="ch-title">A new chapter awaits</h3><p class="ch-premise">Unlocked. Forge it when you're ready &mdash; it continues from everything so far.</p><div class="ch-foot"><span class="ch-hint">${zl}Fresh chapter, ready to forge</span></div></div><div class="ch-action"><button class="btn btn-go" type="button">Begin${Pl}</button></div></article>`;let r=we(t-1);return`<article class="ch-card locked"><div class="ch-index">${a}</div><div class="ch-body"><div class="ch-eyebrow">Chapter ${we(t)} &middot; Locked</div><h3 class="ch-title">Uncharted</h3><p class="ch-premise">The next chapter hasn't been written. Clear Chapter ${r} on Normal to unlock it.</p><div class="ch-foot"><span class="ch-hint">${Fl}Clear Chapter ${r} on Normal</span></div></div><div class="ch-action"></div></article>`}function Os(t,e,a){let r=Array.isArray(t)?t:[];return r.map(Hl).join("")+Dl(e||r.length+1,!!a)}function st(t,e,a="u-photo"){let r=typeof t=="string"?t.trim():"";return r?'<img class="'+a+'" src="'+u(r)+'" alt="" loading="lazy">':e}var Bs={blade:()=>'<path d="M150 30 176 150 166 320 150 350 134 320 124 150Z"/><rect x="108" y="300" width="84" height="18"/><rect x="140" y="318" width="20" height="56"/><circle cx="150" cy="384" r="12"/>',edge:()=>'<path d="M150 96c22 44 30 108 21 176l-13 30-8 8-8-8-13-30c-9-68-1-132 21-176Z"/><path d="M104 306h92v18h-92Z"/><rect x="139" y="324" width="22" height="48"/><path d="M150 360 168 380 150 400 132 380Z"/>',bulwark:()=>'<path d="M150 34 254 74c0 130-30 232-104 300C76 306 46 204 46 74Z"/><path d="M150 96v212M92 150h116" stroke="#0E1420" stroke-opacity="0.32" stroke-width="9" fill="none"/>',focus:t=>'<circle cx="150" cy="228" r="74"/><path d="M150 40 172 86 150 132 128 86Z"/><ellipse cx="150" cy="228" rx="122" ry="44" fill="none" stroke="'+t+'" stroke-width="11"/>',tome:()=>'<path d="M132 70h74q18 0 18 18v224q0 18-18 18h-74Z"/><path d="M78 70h36v260H78q-9 0-9-12V82q0-12 9-12Z"/><path d="M224 98h18v204h-18Z"/>'};function Oe(t,e){let a="url(#"+e+")",r=Bs[t]||Bs.blade;return'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="'+a+'">'+r(a)+"</g></svg>"}var ke={core:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 6l6 5v10l-6 5-6-5V11z"/><circle cx="12" cy="16" r="2.5"/></svg>',edge:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5l4 8-4 14-4-14z"/><path d="M8 13h8"/></svg>',flow:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5c5 5 5 9 0 12S7 24 12 27"/><circle cx="12" cy="16" r="7"/></svg>',crest:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 8h12v9c0 5-6 8-6 8s-6-3-6-8z"/><path d="M12 12v7"/></svg>'};function bt(t){return ke[String(t)]||ke.core}function fe(t,e){let r=String(t).endsWith("Pct")?Number(e)*100:Number(e);return"+"+Math.round(r*10)/10+"%"}function yt(t){let e=String(t||"");return e?e.charAt(0).toUpperCase()+e.slice(1):""}var zs={fire:"water",water:"wind",wind:"earth",earth:"fire",light:"dark",dark:"light"},ql={fire:"#F2603C",water:"#4A9BD4",wind:"#2EBE9E",earth:"#F0B429",light:"#F5E3A2",dark:"#9B6FD4"},Fs=20,Ps=6,js=1.5,$l=.4,wt=1.6,Us=.65,je=.15,Ra=1.1,La=.25,Ws=.15,Vs=.1,Gs=.6;function se(t){let e=Number(t);return Math.max(.2,Math.min(6,(Number.isFinite(e)?e:100)/100))}function ge(t){return Math.max(Vs,Math.min(Gs,se(t)*Ws))}var Hs=30,jl=10,Ys=30,Ue={crit:15,critDmg:150,recharge:100,effectHit:0,effectRes:0,healBonus:0},Ul=.15,Wl=1;var Ma=3,Oa=.4,Yt=1,Ba=3,za=.35,Fa=35,Kt=.5,Xt=1,Vl=30,We=.5,xt=.4,Gl=3,Pa=1.8,Yl={Tank:3,Warrior:2,Assassin:1.5,Mage:1,Support:1},Kl=1;function Ds(t){let e=Yl[t&&t.role];return typeof e=="number"&&e>0?e:Kl}var Ks=.05,Xs=2,Js=.08,Zs=15,Qs=.4,eo=12,to=.3,Gt=.35,ao=.02,ro=.1,so=.18,oo=.2,io={ATK_K:js,ULT_SINGLE:wt,ULT_AOE:Us,HEAL_SCALE:je,SHIELD_SCALE:Ra,DOT_SCALE:La,BUFF_SCALE:Ws,BUFF_MIN:Vs,BUFF_MAX:Gs,FOCUS:Pa,DOT_ROUNDS:Ba,BUFF_ROUNDS:Ma,REVIVE_PCT:za,ENERGY_GRANT:Fa,DRAIN_SHARE:Oa,PASSIVE_SHARE:We,PASSIVE_HIT_SHARE:xt,STUN_TURNS:Xt,EXECUTE_BONUS:Yt,CLEANSE_SHARE:Kt,LOW_PCT:Gt,AURA_REGEN:ao,AURA_MITIGATION:ro,AURA_SHIELD:so,RESIST_MITIGATION:oo,RIDER_BURN:Ks,RIDER_FLOW:Js,RIDER_HASTE:Zs,RIDER_BULWARK:Qs,RIDER_RADIANCE:eo,RIDER_BLIGHT:to,EXECUTE_BONUS:Yt,ENERGY_KILL:Ys,RIDER_BURN_ROUNDS:Xs,CLEANSE_SHARE:Kt,STUN_TURNS:Xt};var Jt=new Set(["damage","aoe_damage","debuff","drain","execute","dot","stun"]);function Y(t,e,a){let r=t&&t.fx?Number(t.fx[e]):NaN;return Number.isFinite(r)?r:a}function Zt(t){return String(t||"").toLowerCase()}function qs(t){return ql[Zt(t)]||"#FFFFFF"}function Be(t,e){let a=Zt(t),r=Zt(e);return zs[a]===r?{mult:1.5,label:"STRONG"}:zs[r]===a?{mult:.75,label:"WEAK"}:{mult:1,label:""}}function Xl(t){let e=t>>>0;return function(){e|=0,e=e+1831565813|0;let a=Math.imul(e^e>>>15,1|e);return a=a+Math.imul(a^a>>>7,61|a)^a,((a^a>>>14)>>>0)/4294967296}}function no(t){let e=2166136261,a=String(t||"seed");for(let r=0;r<a.length;r+=1)e^=a.charCodeAt(r),e=Math.imul(e,16777619);return e>>>0}function ot(t,e){let a=Number(t);return Number.isFinite(a)?a:e}function $s(t,e,a){let r=t&&t.stats||{},s=Number(t&&t.power)>0?Number(t.power):1,o=(Number(r.hp)||50)*s,i=(Number(r.atk)||50)*s,n=(Number(r.def)||50)*s,l=Number(r.spd)||50;return{id:t.id||`${e}-${a}`,name:t.name||(e==="ally"?"Hero":"Foe"),side:e,role:t.role||"Warrior",aff:Zt(t.affinity),position:t.position==="back"?"back":"front",hpMax:Fs+o*Ps,hp:Fs+o*Ps,atk:i,def:n,spd:l,energy:0,shield:0,atkMod:1,defMod:1,modRounds:0,burn:0,burnRounds:0,dmgReduction:0,roundShield:0,stunTurns:0,fx:t&&t.facets||null,regen:0,skill:t&&t.skill||null,passive:t&&t.passive||null,granted:t&&t.granted||null,grantedCd:0,grantedArmed:!1,crit:ot(r.crit,Ue.crit),critDmg:ot(r.critDmg,Ue.critDmg),recharge:ot(r.recharge,Ue.recharge),effectHit:ot(r.effectHit,Ue.effectHit),effectRes:ot(r.effectRes,Ue.effectRes),healBonus:ot(r.healBonus,Ue.healBonus),alive:!0}}function lo({allies:t=[],enemies:e=[],seed:a=1}={}){let r=Xl(a>>>0||1),s=t.map((p,x)=>$s(p,"ally",x)),o=e.map((p,x)=>$s(p,"enemy",x)),i=s.concat(o),n=new Map(i.map(p=>[p.id,p])),l=[],d=p=>p.side==="ally"?s:o,h=p=>p.side==="ally"?o:s,f=p=>p.filter(x=>x.alive),m=p=>Math.max(0,Math.round(p.hp/p.hpMax*100)),v=p=>({hp:Math.max(0,Math.round(p.hp)),hpMax:Math.round(p.hpMax)});function b(p,x){l.push({d:p,events:x.filter(Boolean)})}function w(p){return{op:"hp",id:p.id,pct:m(p),...v(p)}}function c(p){return{op:"energy",id:p.id,pct:Math.round(p.energy)}}function y(p,x){return p.alive?(p.energy=Math.min(100,p.energy+x*(p.recharge/100)),c(p)):null}function E(p,x,g){let k=Math.max(1,Math.round(x));if(p.shield>0){let B=Math.min(p.shield,k);p.shield-=B,k-=B}return k=Math.round(k*(1-(p.dmgReduction||0))),k=Math.max(1,k),p.hp=Math.max(0,p.hp-k),p.hp<=0&&p.alive&&(p.alive=!1),k}function T(p,x){let g=Math.max(Ul,Math.min(Wl,1+(p.effectHit-x.effectRes)/100));return g>=1||r()<g}function R(p){let x=f(h(p));if(!x.length)return null;let g=x.filter(H=>H.position==="front"),k=g.length?g:x;if(p.side!=="enemy")return k.reduce((H,I)=>I.hp<H.hp?I:H,k[0]);if(k.length===1)return k[0];let B=0;for(let H of k)B+=Ds(H);if(!(B>0))return k[0];let L=r()*B;for(let H of k)if(L-=Ds(H),L<0)return H;return k[k.length-1]}let W=Jt;function O(p){let x=f(d(p));return x.length?x.reduce((g,k)=>k.hp/k.hpMax<g.hp/g.hpMax?k:g,x[0]):null}function U(p,x,g){let k=W.has(x),B=f(k?h(p):d(p));if(!B.length)return[];let L=I=>{let M=B.filter(K=>K.position===I);return M.length?M:B},H;switch(g){case"self":H=k?[R(p)]:[p];break;case"ally":case"enemy":H=k?[R(p)]:[O(p)];break;case"allies":case"all_enemies":H=B;break;case"front_row":H=L("front");break;case"back_row":H=L("back");break;default:H=k?[R(p)]:B;break}return H=H.filter(Boolean),x==="aoe_damage"&&H.length<=1&&(H=B),H}let F=p=>p<=1?Pa:1,j=2;function D(p,x){return Jt.has(x.effect)?f(h(p)):x.target==="self"?[p]:f(d(p))}function X(p,x,g,k){let B=Number(k)||1,L=Number(x.power)||20,H=D(p,x);if(H.length){if(x.effect==="buff"){for(let I of H)I.atkMod+=ge(L)*B,I.modRounds=Math.max(I.modRounds,j);g.push({op:"buff",id:p.id,text:"ATK \u25B2"})}else if(x.effect==="debuff"){for(let I of H)I.defMod=Math.max(.5,I.defMod-ge(L)*B),I.modRounds=Math.max(I.modRounds,j);g.push({op:"debuff",id:p.id,text:"DEF \u25BC"})}else if(x.effect==="shield"){let I=Math.round(p.def*Ra*We*se(L)*B);for(let M of H)M.shield+=I;g.push({op:"shieldFx",ids:H.map(M=>M.id)})}else if(x.effect==="heal"){let I=Math.round(p.hpMax*je*We*se(L)*B);for(let M of H)M.hp=Math.min(M.hpMax,M.hp+I),g.push({op:"heal",id:M.id,amount:I,hpPct:m(M),...v(M)})}else if(x.effect==="energy"){let I=Math.round(Y(p,"energyGrant",Fa)*We*B);for(let M of H){let K=y(M,I);K&&g.push(K)}g.push({op:"buff",id:p.id,text:"CHARGE"})}else if(x.effect==="drain"){let I=0;for(let K of H){let me=Be(p.aff,K.aff),ht=E(K,p.atk*p.atkMod*wt*xt*se(L)*B*me.mult,g);I+=ht,g.push({op:"hit",id:K.id,amount:ht,effLabel:me.label,crit:!1,hpPct:m(K),...v(K)}),K.alive||(g.push({op:"death",id:K.id}),_(K,g),A(p,g))}let M=Math.round(I*Y(p,"drainShare",Oa));M>0&&p.alive&&(p.hp=Math.min(p.hpMax,p.hp+M),g.push({op:"heal",id:p.id,amount:M,hpPct:m(p),...v(p)}))}else if(x.effect==="execute")for(let I of H){let M=Be(p.aff,I.aff),K=1+(1-I.hp/I.hpMax)*Y(p,"executeBonus",Yt),me=E(I,p.atk*p.atkMod*wt*xt*se(L)*B*M.mult*K,g);g.push({op:"hit",id:I.id,amount:me,effLabel:M.label,crit:!1,hpPct:m(I),...v(I)}),I.alive||(g.push({op:"death",id:I.id}),_(I,g),A(p,g))}else if(x.effect==="dot")for(let I of H){if(!T(p,I)){g.push({op:"debuff",id:I.id,text:"RESIST"});continue}I.burn=Math.max(I.burn,Math.round(p.atk*p.atkMod*La*xt*se(L)*B*Be(p.aff,I.aff).mult)),I.burnRounds=Math.max(I.burnRounds,Y(p,"dotRounds",Ba)),g.push({op:"debuff",id:I.id,text:"DOT"})}else if(x.effect==="stun")for(let I of H){if(!T(p,I)){g.push({op:"debuff",id:I.id,text:"RESIST"});continue}I.stunTurns=Math.max(I.stunTurns,Y(p,"stunTurns",Xt)),g.push({op:"stun",id:I.id})}else if(x.effect==="cleanse"){let I=Math.round(p.hpMax*je*Y(p,"cleanseShare",Kt)*We*se(L)*B);for(let M of H)M.burn=0,M.burnRounds=0,M.stunTurns=0,M.atkMod<1&&(M.atkMod=1),M.defMod<1&&(M.defMod=1),M.hp=Math.min(M.hpMax,M.hp+I),g.push({op:"heal",id:M.id,amount:I,hpPct:m(M),...v(M)});g.push({op:"buff",id:p.id,text:"CLEANSE"})}else if(x.effect==="revive"){let I=d(p).filter(M=>!M.alive);if(I.length){let M=I.reduce((K,me)=>me.hpMax>K.hpMax?me:K,I[0]);M.alive=!0,M.hp=Math.round(M.hpMax*Y(p,"revivePct",za)*We),M.energy=0,g.push({op:"revive",id:M.id}),g.push({op:"heal",id:M.id,amount:M.hp,hpPct:m(M),...v(M)})}else{let M=Math.round(p.hpMax*je*.4*We*se(L)*B);for(let K of f(d(p)))K.hp=Math.min(K.hpMax,K.hp+M),g.push({op:"heal",id:K.id,amount:M,hpPct:m(K),...v(K)})}}else if(x.effect==="damage"||x.effect==="aoe_damage"){let I=x.effect==="aoe_damage"?f(h(p)):[R(p)].filter(Boolean);for(let M of I){let K=Be(p.aff,M.aff),me=E(M,p.atk*wt*xt*se(L)*B*K.mult,g);g.push({op:"hit",id:M.id,amount:me,effLabel:K.label,crit:!1,hpPct:m(M),...v(M)}),M.alive||(g.push({op:"death",id:M.id}),_(M,g),A(p,g))}}}}function J(){let p=[{op:"start"}];for(let x of i)p.push(w(x),c(x));for(let x of i){let g=x.passive;if(!(!g||!x.alive))if(g.trigger==="battle_start"||g.trigger==="self")X(x,g,p,Y(x,"passiveScale",1));else if(g.trigger==="aura")for(let k of d(x))g.effect==="buff"?k.dmgReduction=Math.max(k.dmgReduction,Y(x,"auraMitigation",ro)):g.effect==="heal"?k.regen=Math.max(k.regen,Math.round(x.hpMax*Y(x,"auraRegen",ao)*se(g.power))):g.effect==="shield"&&(k.roundShield=Math.max(k.roundShield||0,Math.round(x.def*Y(x,"auraShield",so)*se(g.power))));else g.trigger==="resist"&&(x.dmgReduction=Math.max(x.dmgReduction,Y(x,"resistMitigation",oo)),p.push({op:"buff",id:x.id,text:"RESIST"}))}return p}function le(p,x){let g=p.passive;!g||!p.alive||g.trigger!=="on_attack"||X(p,g,x,Y(p,"onAttackScale",.5))}function oe(p,x,g){let k=p.passive;k&&p.alive&&k.trigger==="on_hit"&&X(p,k,g,Y(p,"onHitScale",.5)),N(p,g),Z(p,g)}let re=new Map,ee=(p,x)=>Number(p.get(x))||0;function Z(p,x){for(let g of f(d(p))){let k=g.passive;!k||k.trigger!=="on_ally_low"||ee(re,g.id)>=Y(g,"lowFires",1)||p.hp/p.hpMax>Gt||(re.set(g.id,ee(re,g.id)+1),X(g,k,x,1.2))}}function ue(p){let x=p.passive;if(!x||!p.alive||x.trigger!=="on_round")return;let g=[];X(p,x,g,Y(p,"onRoundScale",Gt)),g.length&&b(260,g)}let te=new Map;function N(p,x){let g=p.passive;!g||!p.alive||g.trigger!=="on_low"||ee(te,p.id)>=Y(p,"lowFires",1)||p.hp/p.hpMax>Gt||(te.set(p.id,ee(te,p.id)+1),X(p,g,x,1.2))}function _(p,x){let g=p.passive;!g||g.trigger!=="on_death"||X(p,g,x,Y(p,"onDeathScale",1.4))}function S(p,x){let g=p.passive;!g||!p.alive||g.trigger!=="on_ult"||X(p,g,x,Y(p,"onUltScale",.7))}function A(p,x){if(!p.passive||!p.alive||p.passive.trigger!=="on_kill")return;let g=y(p,Y(p,"energyKill",Ys));g&&x.push(g),X(p,p.passive,x,.6)}function C(p,x){if(p.modRounds>0&&(p.modRounds-=1,p.modRounds===0&&(p.atkMod=1,p.defMod=1)),p.roundShield>0&&p.alive&&(p.shield+=p.roundShield,x.push({op:"shieldFx",ids:[p.id]})),p.burnRounds>0&&p.alive){p.burnRounds-=1;let g=Math.max(1,Math.round(p.burn*(1-(p.dmgReduction||0))));p.hp=Math.max(0,p.hp-g),x.push({op:"hit",id:p.id,amount:g,effLabel:"",crit:!1,hpPct:m(p),...v(p)}),p.hp<=0&&p.alive&&(p.alive=!1,_(p,x),x.push({op:"death",id:p.id}))}p.regen>0&&p.alive&&p.hp<p.hpMax&&(p.hp=Math.min(p.hpMax,p.hp+p.regen))}function P(p,x,g,k){let B=Y(p,"riderExtra",1);switch(p.aff){case"fire":for(let L of x)L.alive&&(L.burn=Math.round(L.hpMax*Y(p,"riderBurn",Ks)*B),L.burnRounds=Y(p,"riderBurnRounds",Xs));break;case"water":{let L=f(d(p));if(L.length){let H=L.reduce((M,K)=>K.hp/K.hpMax<M.hp/M.hpMax?K:M,L[0]),I=Math.round(p.hpMax*Y(p,"riderFlow",Js)*B);H.hp=Math.min(H.hpMax,H.hp+I),k.push({op:"heal",id:H.id,amount:I,hpPct:m(H),...v(H)})}break}case"wind":for(let L of f(d(p))){let H=y(L,Y(p,"riderHaste",Zs)*B);H&&k.push(H)}break;case"earth":for(let L of f(d(p)).filter(H=>H.position==="front"))L.shield+=Math.round(p.def*Y(p,"riderBulwark",Qs)*B);k.push({op:"shieldFx",ids:f(d(p)).filter(L=>L.position==="front").map(L=>L.id)});break;case"light":for(let L of f(d(p))){L.defMod=Math.min(1,L.defMod),Y(p,"riderRadianceFull",0)&&L.atkMod<1&&(L.atkMod=1);let H=y(L,Y(p,"riderRadiance",eo)*B);H&&k.push(H)}break;case"dark":{let L=Math.round(g*Y(p,"riderBlight",to)*B);L>0&&p.alive&&(p.hp=Math.min(p.hpMax,p.hp+L),k.push({op:"heal",id:p.id,amount:L,hpPct:m(p),...v(p)}));break}default:break}}function G(p){let x=R(p);if(!x)return;let g=[{op:"act",id:p.id}];le(p,g);let k=Be(p.aff,x.aff),B=r()<p.crit/100,L=(p.atk*p.atkMod*js-x.def*x.defMod*$l)*k.mult*(B?p.critDmg/100:1),H=E(x,L,g);g.push({op:"hit",id:x.id,amount:H,effLabel:k.label,crit:B,hpPct:m(x),...v(x)}),Y(p,"riderOnAttack",0)&&p.alive&&P(p,x.alive?[x]:[],H,g),x.alive?oe(x,p,g):(g.push({op:"death",id:x.id}),_(x,g),A(p,g));let I=y(p,Hs);I&&g.push(I);let M=y(x,jl);M&&x.alive&&g.push(M),b(520,g)}function de(p,x,g){let k=[{op:"ult",id:p.id,name:x.name||"Ultimate",sub:`${p.name} \xB7 ${p.role} \xB7 ${x.effect}`,weapon:!!g}];g||S(p,k);let B=0,L=x.effect,H=!g&&p.fx&&p.fx.reach?p.fx.reach:x.target,I=U(p,L,H),M=I.length>1,K=!g&&Y(p,"keepFocus",0)?Pa:F(I.length),me=Y(p,"ultSingle",wt),ht=Y(p,"ultAoe",Us);if(L==="damage"||L==="aoe_damage"){M&&k.push({op:"aoe",side:p.side==="ally"?"enemies":"allies",color:qs(p.aff)});let $=(M?ht:me)*se(x.power);for(let q of I){let ie=Be(p.aff,q.aff),Te=!M&&r()<p.crit/100,He=p.atk*p.atkMod*$*ie.mult*(Te?p.critDmg/100:1),_r=E(q,He,k);B+=_r,k.push({op:"hit",id:q.id,amount:_r,effLabel:ie.label,crit:Te,hpPct:m(q),...v(q)}),q.alive||(k.push({op:"death",id:q.id}),_(q,k),A(p,k))}}else if(L==="heal"){let $=Math.round(p.hpMax*Y(p,"healScale",je)*se(x.power)*K*(1+p.healBonus/100));for(let q of I)q.hp=Math.min(q.hpMax,q.hp+$),k.push({op:"heal",id:q.id,amount:$,hpPct:m(q),...v(q)})}else if(L==="shield"){let $=Math.round(p.def*Y(p,"shieldScale",Ra)*se(x.power)*K);for(let q of I)q.shield+=$;k.push({op:"shieldFx",ids:I.map(q=>q.id)}),k.push({op:"buff",id:p.id,text:"SHIELD"})}else if(L==="buff"){for(let $ of I)$.atkMod+=ge(x.power)*K,$.modRounds=Math.max($.modRounds,Y(p,"buffRounds",Ma));k.push({op:"buff",id:p.id,text:"ATK \u25B2"})}else if(L==="debuff")for(let $ of I){if(!T(p,$)){k.push({op:"debuff",id:$.id,text:"RESIST"});continue}$.defMod=Math.max(.5,$.defMod-ge(x.power)*K),$.modRounds=Math.max($.modRounds,Y(p,"buffRounds",Ma)),k.push({op:"debuff",id:$.id,text:"DEF \u25BC"})}else if(L==="drain"){let $=(M?ht:me)*se(x.power);M&&k.push({op:"aoe",side:p.side==="ally"?"enemies":"allies",color:qs(p.aff)});for(let ie of I){let Te=Be(p.aff,ie.aff),He=E(ie,p.atk*p.atkMod*$*Te.mult,k);B+=He,k.push({op:"hit",id:ie.id,amount:He,effLabel:Te.label,crit:!1,hpPct:m(ie),...v(ie)}),ie.alive||(k.push({op:"death",id:ie.id}),_(ie,k),A(p,k))}let q=Math.round(B*Y(p,"drainShare",Oa));q>0&&p.alive&&(p.hp=Math.min(p.hpMax,p.hp+q),k.push({op:"heal",id:p.id,amount:q,hpPct:m(p),...v(p)}))}else if(L==="execute")for(let $ of I){let q=Be(p.aff,$.aff),ie=1-$.hp/$.hpMax,Te=1+ie*Y(p,"executeBonus",Yt),He=E($,p.atk*p.atkMod*me*se(x.power)*q.mult*Te,k);B+=He,k.push({op:"hit",id:$.id,amount:He,effLabel:q.label,crit:ie>.5,hpPct:m($),...v($)}),$.alive||(k.push({op:"death",id:$.id}),_($,k),A(p,k))}else if(L==="dot")for(let $ of I){if(!T(p,$)){k.push({op:"debuff",id:$.id,text:"RESIST"});continue}$.burn=Math.max($.burn,Math.round(p.atk*p.atkMod*La*se(x.power)*Be(p.aff,$.aff).mult)),$.burnRounds=Math.max($.burnRounds,Y(p,"dotRounds",Ba)),k.push({op:"debuff",id:$.id,text:"DOT"})}else if(L==="stun")for(let $ of I){if(!T(p,$)){k.push({op:"debuff",id:$.id,text:"RESIST"});continue}$.stunTurns=Math.max($.stunTurns,Y(p,"stunTurns",Xt)),k.push({op:"stun",id:$.id})}else if(L==="cleanse"){let $=Math.round(p.hpMax*je*Y(p,"cleanseShare",Kt)*se(x.power)*K);for(let q of I)q.burn=0,q.burnRounds=0,q.stunTurns=0,q.atkMod<1&&(q.atkMod=1),q.defMod<1&&(q.defMod=1),q.hp=Math.min(q.hpMax,q.hp+$),k.push({op:"heal",id:q.id,amount:$,hpPct:m(q),...v(q)});k.push({op:"buff",id:p.id,text:"CLEANSE"})}else if(L==="revive"){let $=d(p).filter(q=>!q.alive);if($.length){let q=$.reduce((ie,Te)=>Te.hpMax>ie.hpMax?Te:ie,$[0]);q.alive=!0,q.hp=Math.round(q.hpMax*Y(p,"revivePct",za)),q.energy=0,k.push({op:"revive",id:q.id}),k.push({op:"heal",id:q.id,amount:q.hp,hpPct:m(q),...v(q)})}else for(let q of f(d(p))){let ie=Math.round(p.hpMax*je*.4*se(x.power));q.hp=Math.min(q.hpMax,q.hp+ie),k.push({op:"heal",id:q.id,amount:ie,hpPct:m(q),...v(q)})}}else if(L==="energy"){let $=Math.round(Y(p,"energyGrant",Fa)*K);for(let q of I){let ie=y(q,$);ie&&k.push(ie)}k.push({op:"buff",id:p.id,text:"CHARGE"})}if(P(p,W.has(L)?I:[],B,k),!g)p.energy=0,k.push(c(p)),p.granted&&p.granted.trigger==="energy"&&(p.grantedArmed=!0);else{let $=y(p,Hs);$&&k.push($),p.granted&&p.granted.trigger!=="energy"?p.grantedCd=Gl:p.grantedArmed=!1}b(950,k)}function Ee(p){de(p,p.skill||{effect:"damage",power:60,target:"enemy",name:"Strike"},!1)}function ze(p){return!p.granted||!p.granted.effect?!1:p.granted.trigger==="energy"?p.grantedArmed:p.grantedCd<=0}function ye(p){return f(p).length===0}b(700,J());let ae=0,pe=null;for(;ae<Vl;){ae+=1;let p=f(i).slice().sort((x,g)=>g.spd-x.spd||(x.id<g.id?-1:1));for(let x of p){if(!x.alive)continue;let g=[];if(C(x,g),g.length&&b(220,g),!!x.alive){if(ye(o)){pe="win";break}if(ye(s)){pe="lose";break}if(x.stunTurns>0){x.stunTurns-=1,b(300,[{op:"stun",id:x.id}]);continue}if(ue(x),!!x.alive){if(x.grantedCd>0&&(x.grantedCd-=1),x.energy>=100?Ee(x):ze(x)?de(x,x.granted,!0):G(x),ye(o)){pe="win";break}if(ye(s)){pe="lose";break}}}}if(pe)break}if(!pe){let p=x=>x.reduce((g,k)=>g+Math.max(0,k.hp)/k.hpMax,0)/(x.length||1);pe=p(s)>p(o)?"win":"lose"}return b(800,[{op:"end",result:pe}]),{result:pe,steps:l}}var z=io;function V(t){return Math.round(Number(t)*1e3)/10+"%"}var co=new Set(["enemy","ally","self"]),Jl=["damage","aoe_damage","debuff","drain","execute","dot","stun"];function Zl(t,e){let a=Jl.includes(t);if(t==="aoe_damage"&&co.has(e))return"every enemy";switch(e){case"self":return a?"the weakest front-line enemy":"itself";case"enemy":return"the weakest front-line enemy";case"ally":return"the ally who needs it most";case"allies":return"the whole team";case"all_enemies":return"every enemy";case"front_row":return a?"the enemy front line":"your front line";case"back_row":return a?"the enemy BACK line \u2014 past the front":"your back line";default:return a?"the weakest front-line enemy":"the whole team"}}function Ha(t){return!co.has(t.target)||t.effect==="aoe_damage"}var Ql={fire:"<b>Fire</b> also burns what it hits for <b>"+V(z.RIDER_BURN)+" of that target's max HP</b> per round, for 2 rounds.",water:"<b>Water</b> also heals your most hurt ally for <b>"+V(z.RIDER_FLOW)+" of the caster's own max HP</b>.",wind:"<b>Wind</b> also gives every teammate <b>+"+z.RIDER_HASTE+" energy</b> (a full bar is 100).",earth:"<b>Earth</b> also shields your front line for <b>"+V(z.RIDER_BULWARK)+" of the caster's DEF</b> each.",light:"<b>Light</b> also clears one DEF debuff from the team and gives everyone <b>+"+z.RIDER_RADIANCE+" energy</b>.",dark:"<b>Dark</b> also returns <b>"+V(z.RIDER_BLIGHT)+" of the damage dealt</b> to the caster as health."};function ho(t){return Ql[String(t||"").toLowerCase()]||""}function Da(t){if(!t||!t.effect)return"";let e=se(t.power),a=Zl(t.effect,t.target),r=Ha(t),s=r?1:z.FOCUS;switch(t.effect){case"damage":case"drain":{let o=(r?z.ULT_AOE:z.ULT_SINGLE)*e,i=t.effect==="drain"?" Heals the caster for "+V(z.DRAIN_SHARE)+" of what it deals.":"";return"Hits "+a+" for <b>"+V(o)+" of ATK</b>"+(r?" each":"")+"."+i}case"aoe_damage":return"Sweeps "+a+" for <b>"+V(z.ULT_AOE*e)+" of ATK</b> each.";case"execute":return"Hits "+a+" for <b>"+V(z.ULT_SINGLE*e)+" of ATK</b>, up to <b>"+V(z.ULT_SINGLE*e*2)+"</b> against a target that is nearly down.";case"dot":return"Poisons "+a+" for <b>"+V(z.DOT_SCALE*e)+" of ATK</b> per round, for "+z.DOT_ROUNDS+" rounds. Ignores shields.";case"stun":return"Makes "+a+" lose its next turn.";case"heal":return"Heals "+a+" for <b>"+V(z.HEAL_SCALE*e*s)+" of the caster's own max HP</b>.";case"shield":return"Shields "+a+" for <b>"+V(z.SHIELD_SCALE*e*s)+" of the caster's DEF</b>.";case"cleanse":return"Clears poison, stuns and debuffs from "+a+", and heals <b>"+V(z.HEAL_SCALE*.5*e*s)+" of the caster's max HP</b>.";case"revive":return"Brings one fallen ally back at <b>"+V(z.REVIVE_PCT)+"</b> health.";case"energy":return"Fills "+a+"'s ultimate bar by <b>"+Math.round(z.ENERGY_GRANT*s)+"</b> points.";case"buff":return"Raises "+a+"'s ATK by <b>"+V(ge(t.power)*s)+"</b> for "+z.BUFF_ROUNDS+" rounds.";case"debuff":return"Drops "+a+"'s DEF by <b>"+V(ge(t.power)*s)+"</b> for "+z.BUFF_ROUNDS+" rounds.";default:return""}}function po(t){return!t||!["damage","drain","execute"].includes(t.effect)?"":((Ha(t)?z.ULT_AOE:z.ULT_SINGLE)*se(t.power)/z.ATK_K).toFixed(1)+"&times; a normal hit"}var ec={battle_start:"As the fight opens",self:"As the fight opens",aura:"For the whole fight",on_hit:"Each time this unit is struck",on_attack:"Each time this unit swings",on_kill:"Each time this unit finishes someone",on_ally_low:"The first time an ally drops below <b>"+V(z.LOW_PCT)+" health</b> (once per battle)",on_low:"The first time this unit drops below <b>"+V(z.LOW_PCT)+" health</b> (once per battle)",resist:"For the whole fight",on_round:"On every one of this unit's turns",on_ult:"When this unit casts its Ultimate",on_death:"When this unit falls",cooldown:"Every few rounds",energy:"When the energy bar fills"};function fo(t){if(!t||!t.trigger)return"";let e=ec[t.trigger]||"Sometimes",a=t.target==="self"?"itself":Jt.has(t.effect)?"every enemy":"the whole team",r=se(t.power),s;t.trigger==="resist"?s="it takes <b>"+V(z.RESIST_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="buff"?s="the whole team takes <b>"+V(z.AURA_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="heal"?s="every ally regenerates <b>"+V(z.AURA_REGEN*r)+" of THIS unit's max HP</b> at the start of each of their turns":t.trigger==="aura"&&t.effect==="shield"?s="every ally gets a fresh shield worth <b>"+V(z.AURA_SHIELD*r)+" of its DEF</b> at the start of each of their turns":t.effect==="buff"?s="it raises "+a+"'s ATK by <b>"+V(ge(t.power))+"</b>":t.effect==="debuff"?s="it drops "+a+"'s DEF by <b>"+V(ge(t.power))+"</b>":t.effect==="shield"?s="it shields "+a+" for <b>"+V(z.SHIELD_SCALE*z.PASSIVE_SHARE*r)+" of its DEF</b>":t.effect==="heal"?s="it heals "+a+" for <b>"+V(z.HEAL_SCALE*z.PASSIVE_SHARE*r)+" of its max HP</b>":t.effect==="energy"?s="it hands "+a+" <b>"+Math.round(z.ENERGY_GRANT*z.PASSIVE_SHARE*r)+" energy</b>":t.effect==="drain"?s="it hits "+a+" for <b>"+V(z.ULT_SINGLE*z.PASSIVE_HIT_SHARE*r)+" of its ATK</b> and takes back <b>"+V(z.DRAIN_SHARE)+" of the damage</b> as health":t.effect==="execute"?s="it hits "+a+" for <b>"+V(z.ULT_SINGLE*z.PASSIVE_HIT_SHARE*r)+" of its ATK</b>, up to <b>"+V(z.ULT_SINGLE*z.PASSIVE_HIT_SHARE*r*(1+z.EXECUTE_BONUS))+"</b> against a target with an empty bar":t.effect==="dot"?s="it poisons "+a+" for <b>"+V(z.DOT_SCALE*z.PASSIVE_HIT_SHARE*r)+" of its ATK</b> per round, for <b>"+z.DOT_ROUNDS+" rounds</b>, past any shield":t.effect==="stun"?s="it stuns "+a+" for <b>"+z.STUN_TURNS+(z.STUN_TURNS===1?" turn</b>":" turns</b>"):t.effect==="cleanse"?s="it strips poison, stuns and lowered stats from "+a+" and heals <b>"+V(z.HEAL_SCALE*z.CLEANSE_SHARE*z.PASSIVE_SHARE*r)+" of its max HP</b>":t.effect==="revive"?s="it raises one fallen ally on <b>"+V(z.REVIVE_PCT*z.PASSIVE_SHARE)+" of its bar</b>, or heals the team if nobody has fallen":t.effect==="damage"||t.effect==="aoe_damage"?s="it hits "+(t.effect==="aoe_damage"?"every enemy":"one enemy")+" for <b>"+V(z.ULT_SINGLE*z.PASSIVE_HIT_SHARE*r)+" of its ATK</b>":s="it strikes back";let o=t.trigger==="on_kill"?" It also gains energy.":"";return e+", "+s+"."+o}function uo(t,e){if(!t||!(Number(t.power)>0))return null;let a=se(t.power),r=Ha(t),s=r?1:z.FOCUS;if(e)return t.trigger==="resist"?{value:V(z.RESIST_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="buff"?{value:V(z.AURA_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="heal"?{value:"",stat:"Regen"}:t.trigger==="aura"&&t.effect==="shield"?{value:"",stat:"Shield each round"}:t.effect==="buff"?{value:V(ge(t.power)),stat:"ATK up"}:t.effect==="debuff"?{value:V(ge(t.power)),stat:"DEF down"}:t.effect==="shield"?{value:V(z.SHIELD_SCALE*.5*a),stat:"of DEF"}:t.effect==="heal"?{value:V(z.HEAL_SCALE*.5*a),stat:"of max HP"}:null;switch(t.effect){case"damage":case"drain":return{value:V((r?z.ULT_AOE:z.ULT_SINGLE)*a),stat:"ATK"};case"aoe_damage":return{value:V(z.ULT_AOE*a),stat:"ATK"};case"execute":return{value:V(z.ULT_SINGLE*a),stat:"ATK"};case"dot":return{value:V(z.DOT_SCALE*a),stat:"ATK per round"};case"heal":return{value:V(z.HEAL_SCALE*a*s),stat:"of max HP"};case"shield":return{value:V(z.SHIELD_SCALE*a*s),stat:"of DEF"};case"buff":return{value:V(ge(t.power)*s),stat:"ATK up"};case"debuff":return{value:V(ge(t.power)*s),stat:"DEF down"};case"energy":return{value:String(Math.round(z.ENERGY_GRANT*s)),stat:"energy"};case"revive":return{value:V(z.REVIVE_PCT),stat:"health"};default:return null}}var Hp=1/3,tc=["crit","critDmg","recharge","effectHit","effectRes","healBonus"],qp=new Set(tc),mo={hp:"HP",atk:"ATK",def:"DEF",spd:"SPD",crit:"Crit rate",critDmg:"Crit DMG",recharge:"Energy rech.",effectHit:"Effect hit",effectRes:"Effect RES",healBonus:"Healing"};function go(t){let e=Number(t);return Number.isFinite(e)?e:0}function ac(t,e,a){return Math.max(e,Math.min(a,t))}var qa=[.7,.8,.9,1],rc=qa.reduce((t,e)=>t+e,0)/qa.length,$p=qa.map(t=>t/rc);var vo={3:{cap:4,mainScale:.45,ticks:1},4:{cap:8,mainScale:.7,ticks:2},5:{cap:20,mainScale:1,ticks:5}};var sc=4;var jp=1/3;function oc(t){return vo[Math.max(3,Math.min(5,Math.round(go(t)||3)))]||vo[3]}function $a(t,e){let a=oc(t),r=ac(Math.round(go(e)),0,a.cap);return Math.min(a.ticks,Math.floor(r/sc))}function Ve(t){return String(t??"").replace(/[&<>"']/gu,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function it(t){let e=t||{},a=String(e.portrait||""),r=String(e.wornOutfit||""),s=[{id:"",name:"Default",url:a,base:!0}];for(let i of Array.isArray(e.outfits)?e.outfits:[]){let n=String(i&&i.id||"");!n||s.some(l=>l.id===n)||s.push({id:n,name:String(i.name||""),url:String(i.url||""),prompt:String(i.prompt||""),tags:Array.isArray(i.tags)?i.tags:[],history:Array.isArray(i.history)?i.history:[],base:!1})}let o=Math.max(0,s.findIndex(i=>i.id===r));return{slots:s,at:o}}function Ua(t){let e=t||{},a=String(e.wornOutfit||"");if(!a)return String(e.portrait||"");let r=(Array.isArray(e.outfits)?e.outfits:[]).find(s=>s&&String(s.id)===a);return String(r&&r.url||e.portrait||"")}function ja(t,e){let a=t&&t.url?'<img class="of-photo" src="'+Ve(t.url)+'" alt="" loading="lazy">':'<span class="of-none"></span>';return'<div class="of-plate '+(e===0?"on":"off")+'" data-pos="'+e+'">'+a+"</div>"}function bo(t){return'<div class="of-plate off hole" data-pos="'+t+'" data-hole aria-hidden="true"></div>'}function ic(t,e,a){let r=Array.isArray(t.history)?t.history.filter(o=>o&&o.url):[],s=Array.isArray(t.tags)?t.tags:[];return'<div class="of-edit"><label class="of-lab" for="of-prompt">What this outfit is</label><textarea class="of-ta" id="of-prompt" data-of-prompt rows="3" spellcheck="false">'+Ve(t.prompt)+'</textarea><label class="of-lab" for="of-tags">Tags</label><input class="of-in" id="of-tags" data-of-tags type="text" spellcheck="false" value="'+Ve(s.join(", "))+'"><div class="of-edit-row"><button class="of-redo" type="button"'+(a?" disabled":" data-of-redo")+">"+(a?"Painting&hellip;":"Redo art")+"</button>"+(r.length?'<span class="of-past-n">'+r.length+" / "+Math.max(1,Number(e)||1)+" kept</span>":"")+"</div>"+(r.length?'<div class="of-past">'+r.map(o=>'<button class="of-past-b" type="button" data-of-restore="'+Ve(o.url)+'" title="Go back to this one"><img src="'+Ve(o.url)+'" alt="" loading="lazy"></button>').join("")+"</div>":"")+"</div>"}function yo(t,e=0,a=!1,r=!1,s=6){let{slots:o}=it(t),i=o.length,n=Math.max(0,Math.min(i-1,Math.round(Number(e)||0))),l=o[n]||o[0]||{id:"",name:"Default",url:""},d=l.id===String(t&&t.wornOutfit||""),h=o[(n-1+i)%i],f=o[(n+1)%i],m=i>2,v=i>1&&(m||n>0),b=i>1&&(m||n<i-1);return'<div class="of-tab'+(r&&!l.base?" editing":"")+'"><div class="of-rail">'+(i>1?'<button class="of-arrow" type="button" data-of-step="-1" aria-label="Previous outfit">&#9664;</button>':"")+'<div class="of-track">'+(i>1?v?ja(h,-1):bo(-1):"")+ja(l,0)+(i>1?b?ja(f,1):bo(1):"")+"</div>"+(i>1?'<button class="of-arrow" type="button" data-of-step="1" aria-label="Next outfit">&#9654;</button>':"")+'</div><div class="of-foot"><div class="of-id"><b class="of-name">'+Ve(l.name)+'</b><span class="of-count">'+(n+1)+" / "+i+'</span></div><div class="of-dots">'+o.map((w,c)=>'<span class="of-dot'+(c===n?" on":"")+'"></span>').join("")+"</div>"+(d?'<span class="of-worn">Equipped</span>':'<button class="of-wear" type="button"'+(a?" disabled":' data-of-wear="'+Ve(l.id)+'"')+">"+(a?"Changing&hellip;":"Equip")+"</button>")+(l.base?"":'<button class="of-editb'+(r?" on":"")+'" type="button" data-of-edit>'+(r?"Close":"Edit")+"</button>")+"</div>"+(r&&!l.base?ic(l,s,a):"")+"</div>"}function wo(t,{onStep:e,onWear:a,onEdit:r,onRedo:s,onRestore:o}={}){if(e)for(let d of t.querySelectorAll("[data-of-step]")){let h=Number(d.getAttribute("data-of-step"))||0;h&&d.addEventListener("click",()=>e(h))}let i=t.querySelector("[data-of-wear]");i&&a&&i.addEventListener("click",()=>a(i.getAttribute("data-of-wear")||""));let n=t.querySelector("[data-of-edit]");n&&r&&n.addEventListener("click",()=>r());let l=t.querySelector("[data-of-redo]");if(l&&s&&l.addEventListener("click",()=>{let d=t.querySelector("[data-of-prompt]"),h=t.querySelector("[data-of-tags]"),f=String(h&&h.value||"").split(",").map(m=>m.trim()).filter(Boolean);s({prompt:String(d&&d.value||""),tags:f})}),o)for(let d of t.querySelectorAll("[data-of-restore]")){let h=d.getAttribute("data-of-restore");h&&d.addEventListener("click",()=>o(h))}}var xo=`
/* THE CAROUSEL HEIGHT IS ONE NUMBER, AND IT IS EXPLICIT: every tab panel here is flex 0 1 auto, so
   a height of 100% resolves against an auto-height parent and collapses -- measured, the rail
   settled at 288px and the focus came out smaller than the sheet's own portrait beside it.
   THE BINDING CONSTRAINT IS WIDTH, NOT HEIGHT: three whole plates plus arrows need 1.63 x the focus
   height in width, which capped the focus at ~431px with ~550px of height unused. So the rail
   CLIPS the neighbours, which is what a real carousel does.
   THE NUMBER IS SET BY THE WORST LEGAL CASE, the 175% letter scale: at 36 the panel overflowed its
   own box by 43px. A contained scroll is legal here, but never for a CONTROL. */
/* With the edit panel open the carousel GIVES BACK height, and it is the only way out: no tab panel
   here stretches, so the panel's 164px on top pushed it 111px out of its box. */
.of-tab.editing { --of-h: 20; }
.of-tab { --of-h: 37; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
/* overflow: hidden is what lets the track be WIDER than the rail. The arrows float over the edges:
   inside the row they ate the width the plates need and stranded 234px. */
.of-rail { position: relative; flex: none; height: calc(var(--f) * var(--of-h)); overflow: hidden; }
.of-track { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: var(--sp-2); }
.of-plate { height: 100%; aspect-ratio: 2 / 3; flex: none; overflow: hidden; background: var(--ink-2); border: 1px solid var(--ink-3); --cut: 0.8em; clip-path: var(--clip-card); border-radius: var(--radius-sm); transition: height 180ms ease, opacity 180ms ease; }
.of-plate.on { border-top: 2px solid var(--coral); }
/* The neighbours read as "there is more", never as options at par: with three equal plates nothing
   said which one the button would equip. */
.of-plate.off { height: 72%; opacity: 0.42; filter: saturate(0.7); }
/* The empty side of a two-look strip: it holds the space so the focus stays centred, and draws
   nothing. visibility, not display, because display would remove it from the layout entirely. */
.of-plate.hole { visibility: hidden; }
.of-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
.of-none { display: block; width: 100%; height: 100%; background: var(--ink-3); }
.of-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; cursor: pointer; display: grid; place-items: center; width: calc(var(--f) * 2.2); height: calc(var(--f) * 2.2); font-size: var(--t-xs); background: var(--ink-2); border: 1px solid var(--ink-3); color: var(--text); border-radius: 50%; }
.of-arrow[data-of-step="-1"] { left: var(--sp-1); }
.of-arrow[data-of-step="1"] { right: var(--sp-1); }
.of-arrow:hover { border-color: var(--coral); color: var(--coral); }
/* ONE ROW, not three stacked: stacked, the foot cost 71px at 100% and 97 at 175%, and that height
   comes straight off the carousel. The reading order still works -- what it is on the left, where
   you are in the middle, what you can do on the right. */
.of-foot { flex: none; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.of-id { display: flex; align-items: baseline; gap: var(--sp-2); min-width: 0; }
.of-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.of-count { font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.of-dots { display: flex; gap: calc(var(--f) * 0.3); }
.of-dot { width: calc(var(--f) * 0.4); height: calc(var(--f) * 0.4); border-radius: 50%; background: var(--ink-3); }
.of-dot.on { background: var(--coral); }
.of-wear { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-3); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.of-wear:hover:not([disabled]) { background: var(--coral-deep); border-color: var(--coral-deep); }
.of-wear[disabled] { cursor: default; background: var(--ink-3); border-color: var(--steel-dark); color: var(--steel-faint); }
.of-editb { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.08em; text-transform: var(--case); padding: calc(var(--f) * 0.35) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.of-editb:hover, .of-editb.on { border-color: var(--coral); color: var(--coral); }
/* The edit panel takes the room the carousel gives back. */
.of-edit { flex: none; display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); }
.of-lab { font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.of-ta, .of-in { width: 100%; min-width: 0; font-family: var(--body); font-size: var(--t-xs); line-height: 1.45; color: var(--text); background: var(--ink); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); padding: calc(var(--f) * 0.4) var(--sp-2); border-radius: var(--radius-sm); resize: none; }
.of-ta:focus, .of-in:focus { outline: none; border-color: var(--coral); border-left-color: var(--coral); }
.of-edit-row { display: flex; align-items: center; gap: var(--sp-2); }
.of-redo { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.08em; text-transform: var(--case); padding: calc(var(--f) * 0.35) var(--sp-2); background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.of-redo:hover:not([disabled]) { border-color: var(--coral); color: var(--coral); }
.of-redo[disabled] { cursor: default; color: var(--steel-faint); }
.of-past-n { font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.of-past { display: flex; gap: calc(var(--f) * 0.3); overflow-x: auto; scrollbar-width: thin; }
.of-past-b { flex: none; cursor: pointer; width: calc(var(--f) * 2.4); height: calc(var(--f) * 3.6); padding: 0; overflow: hidden; background: var(--ink-2); border: 1px solid var(--ink-3); border-radius: var(--radius-sm); }
.of-past-b:hover { border-color: var(--coral); }
.of-past-b img { width: 100%; height: 100%; object-fit: cover; display: block; }
.of-worn { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--jade); padding: calc(var(--f) * 0.4) 0; }
`;function ko(t){return t===5?"\u2605\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605\u2605"}function _o(t){return t===5?"r5":"r4"}var nc={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>'},lc={character:'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="150" cy="92" r="44"/><path d="M150 144c-48 0-82 32-90 78l-12 178h204l-12-178c-8-46-42-78-90-78Z"/></g><path d="M150 50c0 0 28 15 28 45s-28 45-28 45-28-15-28-45 28-45 28-45Z" fill="none" stroke="#F2603C" stroke-opacity="0.4" stroke-width="2"/></svg>'};function Q(t){return(Number(t)||0).toLocaleString("en-US")}var cc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',dc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h11a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',hc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',pc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 16.4 8.4 11.6l4 4 3.2-3.2 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="8" r="1.6" stroke="currentColor" stroke-width="1.6"/></svg>',fc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3 21 3 21 10 9 22 3 22 3 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.5 9.5 8 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Va='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',uc=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%), radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* The head is NOT always here: hoistHeadIntoBar moves it into the top bar and calls remove(),
   leaving this box with ONE child. With a fixed auto 1fr template that child lands in the AUTO row
   and sizes to its own content -- the portrait plate came out a different height on every tab (Bond
   231px, Profile ~700). No harness reproduces it: a harness never hoists.
   :has() gives the second row only while the head is present. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }

.roster-body { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.toolbar { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.cats { display: flex; gap: calc(var(--f) * 0.4); }
.cats button { cursor: pointer; background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); }
.cats button svg { width: calc(var(--f) * 1.4); height: calc(var(--f) * 1.4); }
.cats button[aria-pressed="true"] { background: var(--steel-dark); border-color: var(--steel); color: var(--text); }
.filters { display: flex; align-items: center; gap: calc(var(--f) * 0.4); margin-left: auto; }
/* \u2500\u2500 THE UNITS SEARCH BOX \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   In the TOOLBAR: a row of its own would cost grid height, the scarce axis.
   min-width: 0 on the input holds it -- without it the rarity rail drops to a second row, which no
   overflow check sees, and the GRID quietly pays. */
.u-search {
  flex: 1 1 calc(var(--f) * 16); min-width: calc(var(--f) * 12); max-width: calc(var(--f) * 26);
  display: flex; align-items: center; gap: calc(var(--f) * 0.5);
  padding: calc(var(--f) * 0.35) calc(var(--f) * 0.7);
  background: var(--ink-3); border: 1px solid var(--steel-dark);
  --cut: 0.45em; clip-path: var(--clip-chip); border-radius: var(--radius-sm);
}
/* The in-use state arrives by TWO paths that must paint alike: the render sets the class, the
   in-place repaint sets the attribute while the player types. */
.u-search.on, .u-search[data-on] { border-color: var(--coral); }
.u-search .ic { flex: none; display: block; width: calc(var(--f) * 1.15); color: var(--steel-faint); }
.u-search.on .ic, .u-search[data-on] .ic { color: var(--coral); }
.u-search .ic svg { display: block; width: 100%; height: auto; }
.u-search input {
  flex: 1 1 auto; min-width: 0;
  background: transparent; border: 0; outline: none; padding: 0;
  font-family: var(--body); font-size: var(--t-sm); color: var(--text);
}
.u-search input::placeholder { color: var(--steel-faint); }
/* The browser's clear cross is removed: there is a dedicated button. */
.u-search input::-webkit-search-cancel-button { display: none; }
.u-search .clr { flex: none; cursor: pointer; background: transparent; border: 0; padding: 0; display: block; width: calc(var(--f) * 1); color: var(--steel-faint); }
.u-search .clr:hover { color: var(--text); }
.u-search .clr svg { display: block; width: 100%; height: auto; }
/* Tabular figures: the counter changes on every keystroke and without this the box pulses. */
.u-search .ct { flex: none; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.u-search.on .ct, .u-search[data-on] .ct { color: var(--text); }

.filters .lbl { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); margin-right: calc(var(--f) * 0.3); }
.chip { cursor: pointer; background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.08em; padding: calc(var(--f) * 0.25) calc(var(--f) * 0.8); }
.chip[aria-pressed="true"] { border-color: var(--coral); color: var(--coral); }
.chip.g[aria-pressed="true"] { border-color: var(--amber); color: var(--amber); }
.chip.e[aria-pressed="true"] { border-color: var(--epic); color: var(--epic); }

/* flex: 1, or this sizes to its content and the grid stops short of the stage. */
.grid-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
/* FOUR columns, and the art slot carries the portrait's OWN 2:3 ratio. The old 6-column square
   kept 68% of a generated portrait and reached ~45% down the stage; 2:3 keeps 97%. The COLUMN
   COUNT is what fills the height, not the ratio: at 5 columns the same art still stopped at 69%. */
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: calc(var(--f) * 0.8); align-content: start; }
.grid-empty { grid-column: 1 / -1; padding: var(--sp-4); text-align: center; font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }

.u { position: relative; min-width: 0; cursor: pointer; background: var(--surface); color: var(--on-surface); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; border-top: 3px solid var(--steel-faint); transition: transform 130ms ease; text-align: left; padding: 0; font: inherit; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.u:hover { transform: translateY(calc(var(--f) * -0.3)); }
.u-art { position: relative; aspect-ratio: 2 / 3; background: linear-gradient(160deg, #26364E 0%, #141D2B 100%); display: grid; place-items: end center; overflow: hidden; color: rgba(199, 211, 226, 0.5); }
.u-art svg { width: 74%; height: 96%; }
.u-art.wpn svg { width: 52%; height: 72%; align-self: center; }
.u-stars { position: absolute; top: calc(var(--f) * 0.3); left: calc(var(--f) * 0.4); font-size: var(--t-sm); letter-spacing: 0.5px; line-height: 1; z-index: 1; }
/* Cropped, not fitted: an image model returns whatever aspect it likes, and a letterboxed portrait
   reads as a bug. */
.u-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
/* z-index ONLY: every badge is already absolutely positioned, so position:relative here would drop
   them out of their corners. */
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip, .u-art > .tag-new, .u-art > .kind-tag, .u-art > .pill-up { z-index: 1; }
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip { text-shadow: 0 1px 3px rgba(0,0,0,0.7); }
/* .cp-portrait was built for a SILHOUETTE, sized by the svg's ratio; a real portrait has to fill
   the plate. :has() flips the box only when there is art. */
.cp-portrait:has(.cp-photo) { position: absolute; inset: 0; right: 0; height: auto; opacity: 1; }
.cp-photo { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 14%; }
.u.you { border-top-color: var(--coral); }
/* The You tag left (user request): the coral top edge below still marks the protagonist. */
.u-lvl { position: absolute; bottom: calc(var(--f) * 0.3); left: calc(var(--f) * 0.4); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.06em; color: var(--text); background: color-mix(in srgb, var(--ink) 62%, transparent); padding: 0 calc(var(--f) * 0.4); }
.u-meta { padding: calc(var(--f) * 0.4) calc(var(--f) * 0.55) calc(var(--f) * 0.5); }
.u-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.u-role { font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel); }
.u.r5 { border-top-color: var(--amber); } .u.r5 .u-stars { color: var(--amber); text-shadow: 0 0 6px color-mix(in srgb, var(--amber) 60%, transparent); } .u.r5 .u-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--amber) 30%, #26364E) 0%, #141D2B 70%); color: color-mix(in srgb, var(--amber) 55%, #C7D3E2); }
.u.r4 { border-top-color: var(--epic); } .u.r4 .u-stars { color: var(--epic); text-shadow: 0 0 6px color-mix(in srgb, var(--epic) 55%, transparent); } .u.r4 .u-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--epic) 26%, #26364E) 0%, #141D2B 72%); color: color-mix(in srgb, var(--epic) 50%, #C7D3E2); }
.u .bond-pip { position: absolute; bottom: calc(var(--f) * 0.3); right: calc(var(--f) * 0.4); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.04em; color: var(--coral); background: color-mix(in srgb, var(--ink) 62%, transparent); padding: 0 calc(var(--f) * 0.35); }

/* minmax(0, 1fr), not the implicit auto row: auto sizes to the TALLEST cell, so a long tab
   stretched the row and the same image was cropped differently per tab. */
.cp-body { min-height: 0; display: grid; grid-template-columns: 0.82fr 1.18fr; grid-template-rows: minmax(0, 1fr); gap: var(--sp-3); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.cp-id { position: relative; min-height: 0; overflow: hidden; background: radial-gradient(120% 90% at 60% 0%, #33507A 0%, #16233a 58%, #0E1725 100%); border: 1px solid var(--ink-3); --cut: 0.9em; clip-path: var(--clip-card); border-radius: var(--radius); display: flex; flex-direction: column; justify-content: flex-end; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.cp-portrait { position: absolute; right: -6%; bottom: 0; height: 92%; opacity: 0.92; color: color-mix(in srgb, var(--amber) 55%, transparent); }
.cp-id.wpn .cp-portrait { color: color-mix(in srgb, var(--epic) 55%, transparent); }
.cp-portrait svg { height: 100%; }
.cp-id-top { position: absolute; top: var(--sp-2); left: var(--sp-2); right: var(--sp-2); display: flex; align-items: center; gap: var(--sp-2); z-index: 2; }
/* The way into the portrait studio: in the row that already exists for plate controls, and
   LABELLED -- an icon alone on a picture is a guess, and this one spends an image generation.
   Never the protagonist: his face comes from the Engine's persona. */
.cp-art-btn { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); height: calc(var(--f) * 2.6); padding: 0 calc(var(--f) * 0.8); cursor: pointer; background: color-mix(in srgb, var(--ink) 55%, transparent); border: 1px solid var(--steel-dark); color: var(--porcelain-3); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); border-radius: var(--radius-sm); }
.cp-art-btn:hover { border-color: var(--coral); color: var(--coral); }
.cp-art-btn svg { width: calc(var(--f) * 1.35); height: calc(var(--f) * 1.35); }
.cp-fav { margin-left: auto; background: color-mix(in srgb, var(--ink) 55%, transparent); border: 1px solid var(--steel-dark); color: var(--steel-faint); width: calc(var(--f) * 2.6); height: calc(var(--f) * 2.6); display: grid; place-items: center; cursor: pointer; }
.cp-fav svg { width: calc(var(--f) * 1.5); height: calc(var(--f) * 1.5); }
.cp-fav[aria-pressed="true"] { color: var(--coral); border-color: var(--coral); }
.cp-id-plate { position: relative; padding: var(--sp-3); background: linear-gradient(0deg, rgba(9, 13, 20, 0.94) 0%, rgba(9, 13, 20, 0) 100%); }
.cp-id-plate .plate-stars { font-size: var(--t-md); letter-spacing: 1px; }
.cp-id-plate .plate-stars.r5 { color: var(--amber); } .cp-id-plate .plate-stars.r4 { color: var(--epic); }
.cp-id-plate h3 { margin: calc(var(--f) * 0.2) 0 calc(var(--f) * 0.2); font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-2xl); line-height: 0.98; }
.cp-id-plate .role { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }
.cp-id-plate .chips { display: flex; gap: calc(var(--f) * 0.5); margin-top: var(--sp-2); flex-wrap: wrap; }
.cp-id-plate .chips span { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.25) calc(var(--f) * 0.7); border: 1px solid var(--steel-dark); color: var(--porcelain-3); }
.cp-id-plate .chips .bond { color: var(--coral); border-color: color-mix(in srgb, var(--coral) 50%, transparent); }
.cp-party { margin-top: var(--sp-2); width: 100%; cursor: pointer; background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.6) var(--sp-2); --cut: 0.6em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.cp-party[disabled] { opacity: 0.6; cursor: default; }

.cp-main { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
.cp-tabs { display: flex; gap: calc(var(--f) * 0.4); border-bottom: 1px solid var(--ink-3); }
.cp-tabs button { cursor: pointer; background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2) calc(var(--f) * 0.6); }
.cp-tabs button[aria-selected="true"] { color: var(--text); border-bottom-color: var(--coral); }
.cp-panel { min-height: 0; overflow: auto; padding-right: calc(var(--f) * 0.4); }

.sec { margin-bottom: var(--sp-3); }
.sec .h { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--coral); margin-bottom: calc(var(--f) * 0.4); }
.sec p { margin: 0 0 calc(var(--f) * 0.5); font-size: var(--t-sm); line-height: 1.55; color: var(--porcelain-3); }

.stats { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--f) * 0.5) var(--sp-3); }
.stat { display: grid; grid-template-columns: calc(var(--f) * 3.4) 1fr auto; align-items: center; gap: calc(var(--f) * 0.5); }
.stat .k { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.stat .bar { height: calc(var(--f) * 0.5); background: var(--ink-3); }
.stat .bar > i { display: block; height: 100%; background: linear-gradient(90deg, var(--steel) 0%, var(--steel-faint) 100%); }
.stat .v { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
/* What the EQUIPMENT contributes, marked apart: the player must see which part of the number
   leaves if they unequip. */
.stat .v em { font-style: normal; font-size: var(--t-xs); color: var(--jade); }
.stats.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--sp-3); }
/* No bar: a percentage does not live on the primaries' 1..100 band. */
.stat.sec2 { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.stat.sec2 .v { color: var(--steel-faint); }
.stat.sec2.own .v { color: var(--amber); font-weight: 700; }

.skill { display: flex; gap: var(--sp-2); align-items: flex-start; }
.skill .ic { flex: none; width: calc(var(--f) * 3); height: calc(var(--f) * 3); display: grid; place-items: center; border: 1px solid var(--steel-dark); color: var(--coral); }
.skill .ic svg { width: calc(var(--f) * 1.7); height: calc(var(--f) * 1.7); }
.skill .sn { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.skill .tag { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); }
/* The derived line: what the ability ACTUALLY does, built from the fields the sim reads. The
   model's prose follows as flavour, which is the reverse of how it shipped. */
.derived { margin: calc(var(--f) * 0.5) 0 calc(var(--f) * 0.4); padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7); background: color-mix(in srgb, var(--jade) 12%, var(--ink-2)); border-left: 2px solid var(--jade); font-family: var(--display); font-size: var(--t-sm); line-height: 1.45; color: var(--text); }
.derived b { color: var(--jade); font-weight: 700; }
.derived .vs { display: inline-block; margin-left: calc(var(--f) * 0.4); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--amber); }
.derived .rider { display: block; margin-top: calc(var(--f) * 0.25); font-size: var(--t-xs); color: var(--steel-faint); }
.skill p.flavour { color: var(--steel-faint); }

.mech { display: flex; flex-wrap: wrap; gap: calc(var(--f) * 0.4); margin: calc(var(--f) * 0.35) 0 calc(var(--f) * 0.5); }
.mech .m { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); color: var(--porcelain-3); background: var(--ink-2); border: 1px solid var(--ink-3); padding: calc(var(--f) * 0.2) calc(var(--f) * 0.6); }
.mech .m b { color: var(--text); font-variant-numeric: tabular-nums; }
.mech .trig { color: var(--steel-faint); border-style: dashed; }
.mech .aff { color: var(--coral); border-color: color-mix(in srgb, var(--coral) 45%, transparent); }
.origin { display: flex; flex-wrap: wrap; gap: calc(var(--f) * 0.3) var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.08em; color: var(--steel-faint); }
.origin b { color: var(--porcelain-3); }
.story-chip { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); color: var(--jade); }
.story-chip svg { width: calc(var(--f) * 1.2); height: calc(var(--f) * 1.2); }

.bond-meter { background: var(--ink-2); border: 1px solid var(--ink-3); padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-3); }
.bond-meter .top { display: flex; align-items: baseline; justify-content: space-between; font-family: var(--display); letter-spacing: 0.06em; }
.bond-meter .lv { font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--coral); text-transform: var(--case); }
.bond-meter .xp { font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.bond-meter .track { height: calc(var(--f) * 0.6); background: var(--ink-3); margin: calc(var(--f) * 0.5) 0; }
.bond-meter .track > i { display: block; height: 100%; background: linear-gradient(90deg, var(--coral-deep), var(--coral)); }
.bond-meter .note { font-family: var(--display); font-size: calc(var(--f) * 0.82 * var(--gf-type-scale, 1)); letter-spacing: 0.04em; color: var(--steel-faint); line-height: 1.5; }

.growth-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); background: var(--ink-2); border: 1px solid var(--ink-3); padding: calc(var(--f) * 0.7) var(--sp-3); margin-bottom: calc(var(--f) * 0.6); }
.growth-row .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.growth-row .val { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); font-variant-numeric: tabular-nums; }
.asc { display: inline-flex; gap: calc(var(--f) * 0.25); }
.asc span { color: var(--amber); font-size: var(--t-md); } .asc span.off { color: var(--on-surface); }

/* \u2500\u2500 Ascension: the pips, the bill and the reason \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Borrows the levelling plate's frame and changes only its accent: amber, matching the pips. */
.asc-plate { background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 3px solid var(--amber); padding: calc(var(--f) * 0.8) var(--sp-3); margin-bottom: calc(var(--f) * 0.6); }
.asc-head { display: flex; align-items: center; gap: var(--sp-2); }
.asc-head .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.asc-head .asc-cap { margin-left: auto; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.06em; text-transform: var(--case); color: var(--text); font-variant-numeric: tabular-nums; }
/* auto-fit, not a fixed column count: the catalogue may price a step with more materials. */
.asc-cost { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(var(--f) * 9), 1fr)); gap: calc(var(--f) * 0.4); margin: calc(var(--f) * 0.7) 0 calc(var(--f) * 0.6); }
.asc-item { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.5); background: var(--ink-3); border: 1px solid transparent; padding: calc(var(--f) * 0.35) calc(var(--f) * 0.6); }
/* min-width: 0 on the flex child too, or a long material name grows the column instead of
   ellipsing -- the min-content trap that overflowed the lorebook picker sideways. */
.asc-item .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; color: var(--text); }
.asc-item .c { flex: none; font-size: var(--t-xs); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.asc-item.short .c { color: var(--coral); }
.asc-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.asc-why { min-width: 0; font-family: var(--display); font-size: calc(var(--f) * 0.82 * var(--gf-type-scale, 1)); letter-spacing: 0.04em; color: var(--steel-faint); line-height: 1.4; }
.asc-go { flex: none; cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-3); /* --ink, not a new --on-amber: the contract would have to declare that token in all five styles
   for one button. --amber is a light warm tone and --ink the darkest ground in every style, so
   the pair is dark-on-light in all five: 9.9 / 14.1 / 8.8 / 14.4 / 13.5 : 1, all above AAA. */
background: var(--amber); border: 1px solid var(--amber); color: var(--ink); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.asc-go[disabled] { background: transparent; border-color: var(--ink-3); color: var(--steel-faint); cursor: default; }

/* \u2500\u2500 Form: the skill ladder, under the ascension and wearing its frame \u2500\u2500\u2500\u2500\u2500\u2500
   Same tab, same question (how do I make this unit stronger), so a second frame would read as a
   second system. Only the accent changes, jade instead of amber: a different material.
   ZERO BACKTICKS in this comment -- the sheet is a JS template literal and a pair of them spills
   the text between as code. Fourth time in this project. */
.fm-plate { border-left-color: var(--jade); }
/* One rail per skill, split by a thin line: all three answer the same question about the same
   unit, and three frames would read as three systems. */
.fm-track + .fm-track { border-top: 1px solid var(--ink-3); margin-top: calc(var(--f) * 0.3); padding-top: calc(var(--f) * 0.3); }
.fm-track { margin-top: calc(var(--f) * 0.4); }
.fm-track.off { opacity: 0.6; }
.fm-id { display: flex; align-items: baseline; gap: calc(var(--f) * 0.5); flex-wrap: wrap; }
.fm-id .k { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.fm-id .v { font-family: var(--display); font-weight: 700; font-size: var(--t-sm); color: var(--jade); font-variant-numeric: tabular-nums; margin-left: auto; }
.fm-id .m { font-size: var(--t-xs); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.fm-lv { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.06em; color: var(--text); font-variant-numeric: tabular-nums; }
.fm-lv small { font-size: var(--t-xs); color: var(--steel-faint); }
.fm-off { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-dark); }
.fm-track .asc-cost { margin: calc(var(--f) * 0.28) 0 calc(var(--f) * 0.22); }

/* \u2500\u2500 Gear: a RACK of slots, and a picker that opens on the one you click \u2500\u2500\u2500\u2500
   Built for FIVE pieces from day one: the four relic slots ship LOCKED and light up by flipping a
   flag. A layout designed around a single slot is one thrown away the week the relics land.
   NO BACKTICKS here: the CSS is a JS template literal. */
.gr-root { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; width: 100%; gap: calc(var(--f) * 0.5); }
.gr-rack { flex: none; display: grid; grid-template-columns: repeat(5, 1fr); gap: calc(var(--f) * 0.4); }
.gr-slot { position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.2); cursor: pointer; background: var(--ink-2); border: 1px solid var(--ink-3); padding: calc(var(--f) * 0.45) calc(var(--f) * 0.3); color: var(--text); min-width: 0; }
.gr-slot:hover { border-color: var(--coral); }
.gr-slot[aria-pressed="true"] { border-color: var(--amber); background: color-mix(in srgb, var(--amber) 12%, var(--ink-2)); }
.gr-slot[disabled] { cursor: default; opacity: 0.55; border-style: dashed; }
.gr-slot .lab { font-family: var(--display); font-size: calc(var(--f) * 0.68 * var(--gf-type-scale, 1)); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.gr-slot .art { width: 100%; aspect-ratio: 3 / 4; display: grid; place-items: center; background: var(--ink-3); overflow: hidden; }
.gr-slot .art svg { width: 100%; height: 100%; }
.gr-slot.empty .art { background: transparent; border: 1px dashed var(--steel-dark); }
.gr-slot .art .plus { font-family: var(--display); font-size: var(--t-lg); color: var(--steel-dark); }
.gr-slot .foot { font-family: var(--display); font-size: calc(var(--f) * 0.7 * var(--gf-type-scale, 1)); letter-spacing: 0.06em; color: var(--steel-faint); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.gr-slot .foot b { color: var(--jade); font-weight: 700; }
.gr-slot .rr { position: absolute; top: calc(var(--f) * 0.35); right: calc(var(--f) * 0.35); font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.66 * var(--gf-type-scale, 1)); color: var(--amber); }

/* What the whole rack adds up to. One line: it is a summary, not a second sheet. */
.gr-sum { flex: none; display: flex; align-items: baseline; gap: var(--sp-2); flex-wrap: wrap; border-top: 1px solid var(--ink-3); border-bottom: 1px solid var(--ink-3); padding: calc(var(--f) * 0.4) 0; font-size: var(--t-xs); color: var(--steel-faint); }
.gr-sum .fig { font-family: var(--display); letter-spacing: 0.08em; text-transform: var(--case); }
.gr-sum .fig b { color: var(--jade); font-variant-numeric: tabular-nums; margin-left: calc(var(--f) * 0.2); }
.gr-sum .pw { margin-left: auto; font-family: var(--display); letter-spacing: 0.1em; text-transform: var(--case); }
.gr-sum .pw b { font-size: var(--t-md); color: var(--amber); font-variant-numeric: tabular-nums; margin-left: calc(var(--f) * 0.25); letter-spacing: 0; }
.gr-sum .pw em { font-style: normal; color: var(--jade); font-variant-numeric: tabular-nums; letter-spacing: 0; }

/* The detail of the selected slot. Scrolls INSIDE its box if an ability runs long. */
.gr-detail { flex: 1 1 auto; min-height: 0; overflow: auto; }
.gr-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.gr-meta { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); }
.gr-meta .st { color: var(--amber); letter-spacing: 0; }
.gr-stats { display: grid; grid-template-columns: auto 1fr auto; gap: calc(var(--f) * 0.15) var(--sp-2); align-items: baseline; margin: calc(var(--f) * 0.45) 0; font-size: var(--t-xs); }
.gr-stats .k { color: var(--steel-faint); font-family: var(--display); letter-spacing: 0.08em; text-transform: var(--case); }
.gr-stats .v { color: var(--jade); font-weight: 700; font-variant-numeric: tabular-nums; }
.gr-stats .m { color: var(--steel-faint); font-variant-numeric: tabular-nums; text-align: right; }
.gr-ab { border-top: 1px solid var(--ink-3); padding-top: calc(var(--f) * 0.4); margin-top: calc(var(--f) * 0.4); }
.gr-ab .t { display: flex; align-items: baseline; gap: calc(var(--f) * 0.5); flex-wrap: wrap; }
.gr-ab .lab { font-family: var(--display); font-size: calc(var(--f) * 0.7 * var(--gf-type-scale, 1)); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }
.gr-ab .nm { font-family: var(--display); font-weight: 700; font-size: var(--t-sm); color: var(--text); }
.gr-tag { font-family: var(--display); font-size: calc(var(--f) * 0.68 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; text-transform: var(--case); padding: 0 calc(var(--f) * 0.35); border: 1px solid var(--jade); color: var(--jade); }
.gr-tag.off { border-color: var(--steel-dark); color: var(--steel-faint); }
.gr-line { font-size: var(--t-xs); line-height: 1.4; color: var(--text); margin-top: calc(var(--f) * 0.2); }
.gr-line b { color: var(--jade); font-weight: 700; }
.gr-why { font-size: var(--t-xs); color: var(--steel-faint); line-height: 1.45; margin-top: calc(var(--f) * 0.2); }
.gr-act { flex: none; display: flex; gap: calc(var(--f) * 0.5); }
.gr-act button { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.45) var(--sp-3); background: var(--amber); border: 1px solid var(--amber); color: var(--ink); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.gr-act button.ghost { background: transparent; color: var(--text); border-color: var(--steel-dark); }
.gr-act button.ghost:hover { border-color: var(--coral); color: var(--coral); }

/* \u2500\u2500 Facets: the ladder a DUPLICATE feeds \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   All SIX rungs are drawn from day one, the unbought ones dimmed and still SAYING what they do: a
   ladder showing only what you own hides the reason to pull again.
   The list scrolls INSIDE its box; the screen never scrolls. NO BACKTICKS here. */
.fct-head { flex: none; display: flex; align-items: baseline; gap: var(--sp-2); border-bottom: 1px solid var(--ink-3); padding-bottom: calc(var(--f) * 0.4); }
.fct-head .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--coral); }
.fct-head .cnt { margin-left: auto; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.06em; color: var(--amber); font-variant-numeric: tabular-nums; }
.fct-head .cnt small { font-size: var(--t-xs); color: var(--steel-faint); }
.fct-list { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); padding: calc(var(--f) * 0.5) 0; }
.fct-row { display: grid; grid-template-columns: auto 1fr; gap: calc(var(--f) * 0.1) var(--sp-2); align-items: baseline; background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 3px solid var(--steel-dark); padding: calc(var(--f) * 0.45) calc(var(--f) * 0.7); }
.fct-row.on { border-left-color: var(--amber); }
/* --steel-faint, NOT the darker steel: measured, the locked rung's number came out at 1.4:1, which
   is not dim, it is ABSENT. The lock reads from the colour, never from an unreadable figure.
   And no token name may be followed by a colon in this comment: the probe that forbids
   re-declaring a theme token reads that as a declaration, and it is right to. */
.fct-row .no { grid-row: 1 / 3; align-self: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.fct-row.on .no { color: var(--amber); }
.fct-row .nm { min-width: 0; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); color: var(--steel-faint); }
.fct-row.on .nm { color: var(--text); }
/* --t-sm, NOT --t-xs: this is the line the player reads to decide whether another five-star is
   worth pulling, and --t-xs is the LABEL token -- measured at 8.7px, unreadable. */
.fct-row .ln { grid-column: 2; font-size: var(--t-sm); line-height: 1.4; color: var(--steel-faint); }
.fct-row.on .ln { color: var(--text); }
.fct-row .ln b { color: var(--jade); font-weight: 700; font-variant-numeric: tabular-nums; }
.fct-why { flex: none; font-size: var(--t-sm); line-height: 1.4; color: var(--steel-faint); border-top: 1px solid var(--ink-3); padding-top: calc(var(--f) * 0.35); }
.fct-why b { color: var(--text); font-weight: 700; }

.gr-pick { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; gap: calc(var(--f) * 0.5); }
.gr-pick-head { flex: none; display: flex; align-items: baseline; gap: var(--sp-2); }
.gr-pick-head .ttl { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.gr-pick-head .sub { min-width: 0; font-size: var(--t-xs); color: var(--steel-faint); }
.gr-back { flex: none; cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.gr-back:hover { border-color: var(--coral); color: var(--coral); }
/* CARDS, not rows (user request), and at row height a weapon glyph is a smudge. Contained scroll. */
.gr-grid { flex: 1 1 auto; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 8.5), 1fr)); gap: calc(var(--f) * 0.45); align-content: start; }
.gr-card { position: relative; display: flex; flex-direction: column; gap: calc(var(--f) * 0.2); cursor: pointer; background: var(--ink-2); border: 1px solid var(--ink-3); padding: calc(var(--f) * 0.4); color: var(--text); text-align: left; min-width: 0; }
.gr-card:hover { border-color: var(--coral); }
.gr-card.on { border-color: var(--amber); background: color-mix(in srgb, var(--amber) 12%, var(--ink-2)); }
.gr-card .art { width: 100%; aspect-ratio: 3 / 4; background: var(--ink-3); display: grid; place-items: center; overflow: hidden; }
.gr-card .art svg { width: 100%; height: 100%; }
.gr-card .nm { font-family: var(--display); font-size: var(--t-xs); line-height: 1.25; color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.gr-card .gv { font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); color: var(--jade); font-variant-numeric: tabular-nums; }
.gr-card .who { font-size: calc(var(--f) * 0.68 * var(--gf-type-scale, 1)); letter-spacing: 0.08em; text-transform: var(--case); color: var(--steel-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-card .lk { position: absolute; top: calc(var(--f) * 0.3); left: calc(var(--f) * 0.35); font-size: calc(var(--f) * 0.7 * var(--gf-type-scale, 1)); }
.gr-card .rr { position: absolute; top: calc(var(--f) * 0.3); right: calc(var(--f) * 0.35); font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.68 * var(--gf-type-scale, 1)); color: var(--amber); }
.gr-none { font-size: var(--t-xs); color: var(--steel-faint); line-height: 1.45; }
/* Every figure with its label: a count that does not say what level it buys asks the player to
   redo the arithmetic the server already did. */
.gr-feedbar { flex: none; display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; border-top: 1px solid var(--ink-3); border-bottom: 1px solid var(--ink-3); padding: calc(var(--f) * 0.4) 0; font-size: var(--t-xs); color: var(--steel-faint); }
.gr-feedbar .fig { font-family: var(--display); letter-spacing: 0.08em; text-transform: var(--case); }
.gr-feedbar .fig i { font-style: normal; color: var(--steel-dark); }
.gr-feedbar .fig b { color: var(--text); font-variant-numeric: tabular-nums; margin: 0 calc(var(--f) * 0.25); letter-spacing: 0; }
.gr-feedbar .fig.short b { color: var(--alarm); }
.gr-grew { flex: none; font-size: var(--t-xs); color: var(--steel-faint); padding: calc(var(--f) * 0.3) 0; }
.gr-grew b { color: var(--jade); }
/* Food cards run smaller: a reel to scrub through, not a choice to study. */
.gr-grid.sm { grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 6.5), 1fr)); }
.gr-card.sm .art { aspect-ratio: 1 / 1; }

/* \u2500\u2500 Growth: the level plate, the XP bar and the Insight feed \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Compact on purpose: ascension and Form share this panel, so levelling is four rows and no more. */
.gw-plate { background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 3px solid var(--coral); padding: calc(var(--f) * 0.8) var(--sp-3); margin-bottom: calc(var(--f) * 0.6); }
.gw-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.gw-lv, .gw-cp { font-family: var(--display); font-stretch: var(--stretch); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.gw-lv b { font-size: var(--t-lg); color: var(--text); font-variant-numeric: tabular-nums; margin: 0 calc(var(--f) * 0.2); }
.gw-lv i { font-style: normal; color: var(--steel-faint); }
.gw-cp b { font-size: var(--t-md); color: var(--amber); font-variant-numeric: tabular-nums; margin-left: calc(var(--f) * 0.3); }
/* The projection: what the pending feed turns these numbers into. */
.gw-lv em, .gw-cp em { font-style: normal; color: var(--jade); font-variant-numeric: tabular-nums; margin-left: calc(var(--f) * 0.35); }
.gw-track { position: relative; display: flex; height: calc(var(--f) * 0.7); background: var(--ink-3); margin: calc(var(--f) * 0.6) 0 calc(var(--f) * 0.4); overflow: hidden; }
.gw-track > i { display: block; height: 100%; background: linear-gradient(90deg, var(--amber-deep), var(--amber)); transition: width 200ms ease; }
/* The ghost segment is the XP being fed, sitting on top of what is already banked. */
.gw-track > u { display: block; height: 100%; background: color-mix(in srgb, var(--jade) 65%, transparent); transition: width 200ms ease; }
.gw-track.full > i { background: linear-gradient(90deg, var(--steel-dark), var(--steel)); }
.gw-figs { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: calc(var(--f) * 0.5); font-size: var(--t-xs); color: var(--steel-faint); }
.gw-figs b { color: var(--text); font-variant-numeric: tabular-nums; }
.gw-cost.short { color: var(--alarm); }
.gw-capped { color: var(--amber); }

.gw-feed { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); margin-bottom: var(--sp-3); flex-wrap: wrap; }
.gw-items { display: flex; gap: calc(var(--f) * 0.4); }
.gw-item { cursor: pointer; display: grid; grid-template-columns: auto auto; grid-auto-rows: auto; gap: 0 calc(var(--f) * 0.4); align-items: baseline; background: var(--ink-2); border: 1px solid var(--ink-3); padding: calc(var(--f) * 0.4) calc(var(--f) * 0.7); text-align: left; }
.gw-item:hover:not([disabled]) { border-color: var(--coral); }
.gw-item.on { border-color: var(--jade); }
.gw-item[disabled] { opacity: 0.4; cursor: default; }
.gw-i-name { font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); color: var(--text); }
.gw-i-xp { font-size: calc(var(--f) * 0.78 * var(--gf-type-scale, 1)); color: var(--amber); font-variant-numeric: tabular-nums; }
.gw-i-held { grid-column: 1 / -1; font-size: calc(var(--f) * 0.78 * var(--gf-type-scale, 1)); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.gw-i-held em { font-style: normal; color: var(--jade); margin-left: calc(var(--f) * 0.25); }
.gw-acts { display: flex; gap: calc(var(--f) * 0.5); }
.gw-reset, .gw-go { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-3); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.gw-reset { background: transparent; border: 1px solid var(--steel-dark); color: var(--text); }
.gw-reset:hover:not([disabled]) { border-color: var(--coral); color: var(--coral); }
.gw-go { background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); }
.gw-reset[disabled], .gw-go[disabled] { background: transparent; border-color: var(--ink-3); color: var(--steel-faint); cursor: default; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Ga=uc+xo;function vc(t){let e=t.kind!=="weapon",a=e?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+he(t.dedicatedTo):"");return'<button class="'+("u "+_o(t.rarity)+(t.isProtagonist?" you":""))+'" type="button" data-unit="'+u(t.id)+'"><div class="u-art'+(e?"":" wpn")+'">'+st(t.portrait,"")+'<span class="u-stars">'+ko(t.rarity)+"</span>"+(t.portrait?"":e?nc.character:Oe(t.weaponType,"gf-sil"))+'<span class="u-lvl">Lv '+(Number(t.level)||1)+"</span>"+(e?'<span class="bond-pip">&#9829;'+(Number(t.bond)||0)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+u(t.name)+'</div><div class="u-role">'+u(a)+"</div></div></button>"}var mc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>',gc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';function bc(t,e){let a=String(e||"").trim().toLowerCase();return!a||String(t.name||"").toLowerCase().includes(a)?!0:(t.kind==="weapon"?[t.weaponType]:[t.role,t.affinity]).some(s=>String(s||"").toLowerCase()===a)}function ta(t,e,a,r){let s=e!=="wpn";return(t||[]).filter(o=>o.kind!=="weapon"===s).filter(o=>a==="all"||String(o.rarity)===a).filter(o=>bc(o,r))}function So(t,e,a){return a==="loading"?'<div class="grid-empty">Loading units&hellip;</div>':a==="error"?'<div class="grid-empty">Couldn&rsquo;t load your units.</div>':t.length?t.map(vc).join(""):'<div class="grid-empty">No '+(e?"characters":"weapons")+" here yet.</div>"}function yc(t,e,a){let r=!!String(t||"").trim();return'<div class="u-search'+(r?" on":"")+'"><span class="ic">'+mc+'</span><input type="search" data-unit-search placeholder="Search by name, role or affinity" value="'+u(t||"")+'">'+(r?'<button class="clr" type="button" data-unit-search-clear aria-label="Clear search">'+gc+"</button>":"")+'<span class="ct" data-unit-search-count>'+(r?e+" / "+a:a)+"</span></div>"}function Eo(t,{cards:e=[],cat:a="char",rarity:r="all",q:s="",state:o="ready"}={}){if(!t||typeof t.querySelector!="function")return!1;let i=t.querySelector("[data-grid]");if(!i)return!1;let n=a!=="wpn",l=ta(e,a,r,s);i.innerHTML=So(l,n,o);let d=t.querySelector(".u-search");d&&typeof d.setAttribute=="function"&&(String(s||"").trim()?d.setAttribute("data-on","1"):d.removeAttribute("data-on"));let h=t.querySelector("[data-unit-search-count]");if(h){let f=ta(e,a,r,"").length;h.textContent=String(s||"").trim()?l.length+" / "+f:String(f)}return!0}function To({cards:t=[],cat:e="char",rarity:a="all",state:r="ready",q:s=""}={}){let o=e!=="wpn",i=ta(t,e,a,s),n=ta(t,e,a,"").length,l=h=>h?' aria-pressed="true"':' aria-pressed="false"',d=So(i,o,r);return`
<div class="root">
  ${Va}
  <div class="stage"></div>
  <section class="screen" data-screen="roster">
    <div class="head">
      <button class="back" type="button" data-roster-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Command</div><h2>Units</h2></div>
    </div>
    <div class="roster-body gf-swap">
      <div class="toolbar">
        <div class="cats">
          <button type="button" data-cat="char"${l(o)}>${hc}Characters</button>
          <button type="button" data-cat="wpn"${l(!o)}>${fc}Weapons</button>
        </div>
        ${yc(s,i.length,n)}
        <div class="filters">
          <span class="lbl">Rarity</span>
          ${Pt.map(h=>`<button class="chip${h.tone?" "+h.tone:""}" type="button" data-rar="${h.id}"${l(a===h.id)}>${h.label}</button>`).join("")}
        </div>
      </div>
      <div class="grid-scroll"><div class="grid" data-grid>${d}</div></div>
    </div>
  </section>
</div>`}function nt(t,e,a,r){let s=Math.min(100,Math.max(0,Number(e)||0)),o=a===void 0?Number(e)||0:Number(a)||0,i=Number(r)>0?" <em>+"+Q(Math.round(Number(r)))+"</em>":"";return'<div class="stat"><span class="k">'+t+'</span><div class="bar"><i style="width:'+s+'%"></i></div><span class="v">'+Q(o)+i+"</span></div>"}var wc=[["crit","Crit rate",15,"%"],["critDmg","Crit DMG",150,"%"],["recharge","Energy rech.",100,"%"],["effectHit","Effect hit",0,"%"],["effectRes","Effect RES",0,"%"],["healBonus","Healing",0,"%"]];function xc(t,e){let a=e||{};return wc.map(([r,s,o,i])=>{let n=Number(t[r]),l=Number.isFinite(n),d=l?n:o,h=Number(a[r])||0;return'<div class="stat sec2'+(l?" own":"")+'"><span class="k">'+s+'</span><span class="v">'+Math.round((d+h)*10)/10+i+(h>0?" <em>+"+Math.round(h*10)/10+i+"</em>":"")+"</span></div>"}).join("")}var kc={damage:"Damage",aoe_damage:"AoE damage",heal:"Heal",shield:"Shield",buff:"Buff",debuff:"Debuff"},_c={enemy:"Enemy",all_enemies:"All enemies",ally:"Ally",allies:"Allies",self:"Self",front_row:"Front row",back_row:"Back row"},Sc={front:"Front-line role",back:"Back-line role"};function ea(t){return String(t||"").replace(/_/g," ").replace(/^\w/,e=>e.toUpperCase())}function Ec(t,e,a,r){let s=[];a&&t.trigger&&s.push('<span class="m trig">'+u(ea(t.trigger))+"</span>"),t.effect&&s.push('<span class="m">'+u(kc[t.effect]||ea(t.effect))+"</span>");let o=uo(t,!!r);return o&&s.push('<span class="m">'+(o.value?o.value+" ":"")+"<b>"+o.stat+"</b></span>"),t.target&&s.push('<span class="m">'+u(_c[t.target]||ea(t.target))+"</span>"),e&&s.push('<span class="m aff">'+u(e)+"</span>"),s.length?'<div class="mech">'+s.join("")+"</div>":""}function Qt(t,e,a,r,s){if(!e||!e.name)return"";let o=s?fo(e):Da(e),i=s?"":po(e),n=s?"":ho(a),l=o?'<div class="derived">'+o+(i?' <span class="vs">'+i+"</span>":"")+(n?'<span class="rider">'+n+"</span>":"")+"</div>":"";return'<div class="sec"><div class="h">'+t+'</div><div class="skill"><span class="ic">'+cc+'</span><div><div class="sn">'+u(e.name)+"</div>"+Ec(e,a,r,s)+l+'<p class="flavour">'+u(e.description)+"</p></div></div></div>"}function Tc(t,e,a){let r=t.kind!=="weapon",s="";if(r&&(s+='<div class="sec"><div class="h">Combat</div><div class="mech">',t.role&&(s+='<span class="m">'+u(t.role)+"</span>"),t.affinity&&(s+='<span class="m aff">'+u(t.affinity)+"</span>"),t.position&&(s+='<span class="m">'+u(Sc[t.position]||ea(t.position))+"</span>"),s+="</div></div>"),s+='<div class="sec"><div class="h">Stats</div><div class="stats">',r){let o=t.stats||{},n=1+((Number(e)>0?Number(e):1)-1)*.06,l=a||{},d=(b,w)=>(Number(b)||0)*(1+(Number(w)||0)),h=Math.round(20+d(o.hp,l.hpPct)*6*n),f=Math.round(d(o.atk,l.atkPct)*n),m=Math.round(d(o.def,l.defPct)*n),v=Math.round(d(o.spd,l.spdPct));s+=nt("HP",o.hp,h,h-Math.round(20+(Number(o.hp)||0)*6*n)),s+=nt("ATK",o.atk,f,f-Math.round((Number(o.atk)||0)*n)),s+=nt("DEF",o.def,m,m-Math.round((Number(o.def)||0)*n)),s+=nt("SPD",o.spd,v,v-(Number(o.spd)||0)),s+="</div></div>",s+='<div class="sec"><div class="h">Combat stats</div><div class="stats two">'+xc(o,l)}else{let o=t.mainStat||{},i=t.subStat||{};s+=nt("ATK",o.value)+nt(String(i.key||"SUB").toUpperCase(),i.value)}if(s+="</div></div>",r?(s+=Qt("Skill",t.skill,t.affinity,!1,!1),s+=Qt("Passive",t.passive,t.affinity,!0,!0),s+='<div class="sec"><div class="h">Profile</div>',t.description&&(s+="<p>"+u(t.description)+"</p>"),t.personality&&(s+="<p>"+u(t.personality)+"</p>"),s+="</div>"):(s+=Qt("Granted skill",t.grantedSkill,null,!0,!1),s+=Qt("Passive",t.passive,null,!0,!0),s+='<div class="sec"><div class="h">About</div><p>'+u(t.description)+"</p></div>"),!t.isProtagonist){let o=t.origin||{},i=o.banner==="standard"?"Standard Banner":o.banner||"Standard Banner";s+='<div class="sec"><div class="h">Origin</div><div class="origin"><span>From <b>'+u(i)+"</b></span>"+(r?'<span class="story-chip">'+dc+"In the story cast pool</span>":"")+"</div></div>"}return s}function Wa(t,e,a,r){let s=o=>(Math.round(Number(o)*10)/10).toLocaleString("en-US");return'<span class="k">'+u(t)+'</span><span class="v">+'+s(e)+r+'</span><span class="m">'+(a>e?"&rarr; +"+s(a)+r+" at cap":"at cap")+"</span>"}var Ne=t=>Math.round(Number(t)*1e3)/10;function Ac(t,e){let a=t.item||null,r=!!t.locked,s="gr-slot"+(a?"":" empty"),o=a?a.main?ke[t.key]||ke.core:Oe(a.weaponType,"gf-gsil"):r?ke[t.key]||ke.core:'<span class="plus">+</span>',i=a?a.main?"Lv "+(Number(a.level)||0)+" &middot; <b>"+fe(a.main.key,a.main.value)+"</b>":"Lv "+(Number(a.level)||1)+" &middot; <b>+"+Ne(a.atkPct)+"%</b>":r?"Soon":"Empty";return'<button class="'+s+'" type="button"'+(r?" disabled":' data-gear-slot="'+u(t.key)+'" aria-pressed="'+(e===t.key?"true":"false")+'"')+'><span class="lab">'+u(t.label)+'</span><span class="art">'+o+"</span>"+(a?'<span class="rr">'+(Number(a.rarity)||4)+"&#9733;</span>":"")+'<span class="foot">'+i+"</span></button>"}function Nc(t){let e=Wa("ATK",Ne(t.atkPct),Ne(t.atkPctMax),"%")+(t.sub?t.sub.points!==void 0?Wa(t.sub.label,t.sub.points,t.sub.pointsMax,"%"):Wa(t.sub.label,Ne(t.sub.pct),Ne(t.sub.pctMax),"%"):""),a=t.grantedSkill?'<div class="gr-ab"><div class="t"><span class="lab">2nd skill</span><span class="nm">'+u(t.grantedSkill.name)+'</span><span class="gr-tag'+(t.grantedActive?"":" off")+'">'+(t.grantedActive?"Active":"Inactive")+"</span></div>"+(t.grantedActive?'<div class="gr-line">'+Da(t.grantedSkill)+"</div>":'<div class="gr-why">Only '+u(t.dedicatedTo||"its owner")+" draws this skill from it. Here it is stats only.</div>")+"</div>":"";return'<div class="gr-name">'+u(t.name)+'</div><div class="gr-meta"><span class="st">'+"&#9733;".repeat(Math.max(1,Number(t.rarity)||4))+"</span> "+u(t.weaponType||"")+" &middot; Lv "+(Number(t.level)||1)+" / "+(Number(t.levelCap)||90)+'</div><div class="gr-stats">'+e+"</div>"+a}function Ic(t){let e=(t.subs||[]).map(a=>'<span class="k">'+u(a.label)+'</span><span class="v">'+fe(a.key,a.value)+'</span><span class="m">'+(Number(a.rolls)>1?"&times;"+a.rolls:"")+"</span>").join("");return'<div class="gr-name">'+(Number(t.rarity)||3)+"&#9733; "+u(aa(t.slot))+'</div><div class="gr-meta"><span class="st">'+"&#9733;".repeat(Math.max(1,Number(t.rarity)||3))+"</span> Lv "+(Number(t.level)||0)+" / "+(Number(t.levelCap)||0)+'</div><div class="gr-stats"><span class="k">'+u(t.main.label)+'</span><span class="v">'+fe(t.main.key,t.main.value)+'</span><span class="m">'+(t.main.valueMax>t.main.value?"&rarr; "+fe(t.main.key,t.main.valueMax)+" at cap":"at cap")+'</span></div><div class="gr-ab"><div class="t"><span class="lab">Sub-stats</span></div><div class="gr-stats">'+e+"</div></div>"}function aa(t){let e=String(t||"");return e.charAt(0).toUpperCase()+e.slice(1)}function Cc(t,e,a,r,s,o,i){let n=Array.isArray(e)?e:[],l=a||[],d=Number(t.levelCap)||0,h=Number(t.level)||0,f=Math.min(d,h+l.length),m=Number(t.feedCost)||Number(s)||0,v=l.length*m,b=v>r,w=Number(o)||3,c=Math.floor(h/w),y=Math.floor(f/w),E=n.filter(O=>O.id!==t.id&&!O.equipped&&!O.locked),T=Math.max(0,d-h),R=E.length?E.map(O=>{let U=l.includes(O.id),F=!U&&l.length>=T;return'<button class="gr-card sm'+(U?" on":"")+'" type="button"'+(F?" disabled":"")+' data-rfeed-pick="'+u(O.id)+'"><span class="art">'+(ke[O.slot]||ke.core)+'</span><span class="rr">'+(Number(O.rarity)||3)+'&#9733;</span><span class="nm">'+aa(O.slot)+" &middot; Lv "+(Number(O.level)||0)+'</span><span class="gv">'+u(O.main.label)+" "+fe(O.main.key,O.main.value)+"</span></button>"}).join(""):'<div class="gr-none">Nothing spare to feed. Everything you hold is either equipped or locked &mdash; run the <b>Relic Vault</b> in Materials for more.</div>',W=i&&i.length?'<div class="gr-grew">Reinforced: '+i.map(O=>"<b>"+u(O.label)+" "+fe(O.key,O.by)+"</b>").join(", ")+"</div>":"";return'<div class="gr-pick"><div class="gr-pick-head"><button class="gr-back" type="button" data-rfeed-back>&#9664; Back</button><span class="ttl">Upgrade '+u(aa(t.slot))+'</span><span class="sub">Lv '+h+" / "+d+'</span></div><div class="gr-feedbar"><span class="fig">Feeding<b>'+l.length+"</b>"+(l.length===1?" piece":" pieces")+'</span><span class="fig">Level<b>'+h+" &rarr; "+f+'</b></span><span class="fig">Reinforcements<b>+'+(y-c)+"</b>"+(y===c&&l.length?(c+1)*w<=d?" (next at Lv "+(c+1)*w+")":" (at cap)":"")+'</span><span class="fig'+(b?" short":"")+'">Funds<b>'+Q(v)+"</b>of "+Q(r)+" <i>("+Q(m)+" per level)</i></span></div>"+W+'<div class="gr-grid sm">'+R+'</div><div class="gr-act"><button type="button" data-rfeed-go'+(!l.length||b||f===h?" disabled":"")+">Feed</button>"+(l.length?'<button class="ghost" type="button" data-rfeed-clear>Clear</button>':"")+"</div></div>"}function Rc(t,e,a){let r=t.kind==="relic",s=e.length?e.map(o=>{let i=o.equipped?"Equipped":o.heldByName?"On "+o.heldByName:o.wornElsewhere?"In use":"Free",n=r?u(o.main.label)+" "+fe(o.main.key,o.main.value):"+"+Ne(o.atkPct)+"% ATK"+(o.grantsHere?" &middot; 2nd skill":""),l=r?ke[o.slot]||ke.core:Oe(o.weaponType,"gf-gsil"),d=r?aa(o.slot)+" &middot; Lv "+(Number(o.level)||0):u(o.name);return'<button class="gr-card'+(o.equipped?" on":"")+'" type="button" data-equip="'+u(o.id)+'"><span class="art">'+l+'</span><span class="rr">'+(Number(o.rarity)||4)+"&#9733;</span>"+(o.locked?'<span class="lk">&#128274;</span>':"")+'<span class="nm">'+d+'</span><span class="gv">'+n+'</span><span class="who">'+u(i)+"</span></button>"}).join(""):'<div class="gr-none">'+(r?"No "+u(t.label)+" relics yet &mdash; they drop from the <b>Relic Vault</b> stage in Materials.":"You hold no "+u(t.accepts||"piece")+" for this slot yet &mdash; they come from the weapon banner in Summon.")+"</div>";return'<div class="gr-pick"><div class="gr-pick-head"><button class="gr-back" type="button" data-gear-back>&#9664; Slots</button><span class="ttl">'+u(t.label)+'</span><span class="sub">'+u(a.role||"This unit")+" holds a <b>"+u(t.accepts||"piece")+'</b></span></div><div class="gr-grid">'+s+"</div>"+(t.item?'<div class="gr-act">'+(r?'<button type="button" data-rfeed-open>Upgrade</button>':'<button type="button" data-wlevel="'+u(t.item.id)+'">Upgrade</button>')+'<button class="ghost" type="button" data-equip="">Remove</button></div>':"")+"</div>"}function Lc(t,e,a,r){let s=e||null;if(!s)return'<div class="gr-root"><div class="gr-none">This unit has no equipment slots.</div></div>';let o=Array.isArray(s.slots)?s.slots:[],i=Array.isArray(s.options)?s.options:[],n=a?o.find(c=>c.key===a&&!c.locked):null;if(n&&r&&r.open&&n.item)return'<div class="gr-root">'+Cc(n.item,r.inventory||[],r.picked||[],Number(r.funds)||0,Number(r.cost)||0,Number(r.tickEvery)||3,r.gained)+"</div>";if(n)return'<div class="gr-root">'+Rc(n,n.options||i,t)+"</div>";let l='<div class="gr-rack">'+o.map(c=>Ac(c,a)).join("")+"</div>",d=Number(s.cp)||0,h=Number(s.cpBare)||0,f=o.filter(c=>c.item).length,m=[];if(f>1){let c=s.totals||{};c.atkPct&&m.push('<span class="fig">ATK<b>+'+Ne(c.atkPct)+"%</b></span>"),c.hpPct&&m.push('<span class="fig">HP<b>+'+Ne(c.hpPct)+"%</b></span>"),c.defPct&&m.push('<span class="fig">DEF<b>+'+Ne(c.defPct)+"%</b></span>"),c.spdPct&&m.push('<span class="fig">SPD<b>+'+Ne(c.spdPct)+"%</b></span>");for(let y of["crit","critDmg","recharge","effectHit","effectRes","healBonus"])c[y]&&m.push('<span class="fig">'+u(mo[y]||y)+"<b>+"+Math.round(c[y]*10)/10+"%</b></span>")}else f?m.push('<span class="fig">1 of '+o.length+" slots filled</span>"):m.push('<span class="fig">Nothing equipped yet</span>');let v='<div class="gr-sum">'+m.join("")+'<span class="pw">Power<b>'+Q(d)+"</b>"+(d>h?" <em>+"+Q(d-h)+"</em>":"")+"</span></div>",b=o.find(c=>c.item),w=b?'<div class="gr-detail">'+(b.item.main?Ic(b.item):Nc(b.item))+"</div>":'<div class="gr-detail"><div class="gr-why">Nothing equipped. Click a slot to choose a piece for it. The four relic slots open when relics ship &mdash; they are drawn here so the rack never changes shape under you.</div></div>';return'<div class="gr-root">'+l+v+w+"</div>"}function Mc(t,e){let a=e||{},r=Array.isArray(a.rungs)?a.rungs:[],s=Math.max(0,Number(a.owned)||0),o=Number(a.max)||r.length,i=he(t.name)||"this unit",n=r.map(d=>'<div class="fct-row'+(!!d.owned?" on":"")+'"><span class="no">'+u(String(d.n))+'</span><span class="nm">'+u(d.name||"")+'</span><span class="ln">'+u(d.line||"")+"</span></div>").join(""),l=s>=o?"<b>Every facet is unlocked.</b> Another copy of "+u(i)+" adds nothing \u2014 this ladder is the only thing copies feed.":"Pull "+u(i)+" again to raise the next one.";return'<div class="gr-root"><div class="fct-head"><span class="lab">Facets</span><span class="cnt">'+s+"<small> / "+o+'</small></span></div><div class="fct-list">'+n+'</div><div class="fct-why">'+l+"</div></div>"}function Oc(t,e){let a=Number(e)||0,r=he(t.name)||"this unit";return'<div class="bond-meter"><div class="top"><span class="lv">&#9829; Bond '+a+'</span><span class="xp">'+(a>0?"in progress":"not started")+'</span></div><div class="track"><i style="width:'+(a>0?12:0)+'%"></i></div><div class="note">Affinity grows by bringing '+u(r)+' into story beats and battles. Each bond level will unlock a character event.</div></div><div class="sec"><div class="h">Character events</div><p>Character events unlock as bond grows &mdash; the relationship system is coming.</p></div>'}function Ao(t,e){return No(t,e)}function No(t,e){let a=e||{},r=Number(a.level)||1,s=Number(a.levelCap)||r,o=r>=s,i=Math.max(0,Number(a.xp)||0),n=Number(a.xpNeeded)||0,l=Array.isArray(a.tiers)?a.tiers:[],d=a.wallet&&a.wallet.insight||{},h=Number(a.wallet&&a.wallet.funds)||0,f=Number(a.cp)||0,m=a.preview||null,v=m&&Number.isFinite(m.xpAfter)?m.xpAfter:i,b=m&&Number.isFinite(m.needAfter)?m.needAfter:n,w=m&&Number.isFinite(m.solid)?m.solid:i,c=b>0?Math.min(100,Math.round(w/b*100)):100,y=m&&b>0?Math.min(100-c,Math.round((v-w)/b*100)):0,E={account:"Capped by your Account Rank &mdash; a unit cannot pass twice your rank.",ascension:"Capped until the next ascension.",max:"Fully levelled."}[a.levelCapReason||"max"],T='<div class="gw-plate"><div class="gw-top"><span class="gw-lv">Lv <b data-gw-lv>'+r+"</b>"+(m&&m.levelTo>r?"<em data-gw-lv-to>&rarr; "+m.levelTo+"</em>":"<i>/ "+s+"</i>")+'</span><span class="gw-cp">CP <b>'+Q(f)+"</b>"+(m&&m.cpTo>f?"<em>&rarr; "+Q(m.cpTo)+"</em>":"")+'</span></div><div class="gw-track'+(o?" full":"")+'"><i data-gw-bar style="width:'+c+'%"></i><u data-gw-ghost style="width:'+y+'%"></u></div><div class="gw-figs">'+(o?'<span class="gw-capped">'+E+"</span>":"<span><b data-gw-xp>"+Q(v)+"</b> / "+Q(b)+' XP</span><span class="gw-cost'+(m&&m.short?" short":"")+'" data-gw-cost>'+(m?Q(m.funds)+" Funds"+(m.short?" &mdash; short, the XP still banks":""):Q(h)+" Funds")+"</span>")+"</div></div>",R=m&&Number.isFinite(m.roomLeft)?m.roomLeft:1/0,W=o?"":'<div class="gw-feed"><div class="gw-items">'+l.map(U=>{let F=Math.max(0,Number(d[U.id])||0),j=m&&m.spent?Math.max(0,Number(m.spent[U.id])||0):0,D=R>0&&j<F;return'<button class="gw-item'+(F?"":" empty")+(j?" on":"")+'" type="button"'+(D?"":" disabled")+' data-feed="'+u(U.id)+'"><span class="gw-i-name">'+u(String(U.name).replace(/^Insight /,""))+'</span><span class="gw-i-xp">+'+Q(U.xp)+'</span><span class="gw-i-held" data-feed-held="'+u(U.id)+'">'+Q(F-j)+(j?"<em>&minus;"+Q(j)+"</em>":"")+"</span></button>"}).join("")+'</div><div class="gw-acts"><button class="gw-reset" type="button" data-feed-reset'+(m?"":" disabled")+'>Reset</button><button class="gw-go" type="button" data-feed-go'+(m&&m.ready||!m&&n>0&&i>=n&&r<s?"":" disabled")+">Level up</button></div></div>",O=Pc(a.ascension,h)+zc(a.form,h);return T+W+O}var Bc={"no-signature":"Equip this unit's signature weapon to train its skill.","no-ability":"This unit has no such ability.","at-cap":"Ascend this unit to train it further.","needs-mandate":"Mandates come from the 7 Day Login Event &mdash; day 6, one a week.","none-held":"You hold none of these &mdash; farm them in Materials, at the Tenet Trial.","short-materials":"Not enough Tenets yet &mdash; the Tenet Trial in Materials is open every day.","short-funds":"Not enough Funds.",max:"Fully trained."};function zc(t,e){if(!t||!Array.isArray(t.tracks))return"";let a=Math.max(1,Number(t.max)||10),s='<div class="asc-head"><span class="lab">Form</span><span class="asc-cap">Cap '+Math.max(1,Number(t.cap)||a)+"</span></div>",o=i=>{let n=Math.max(1,Number(i.level)||1),l=i.live?i.next:null,d=Bc[i.reason]||"",h='<div class="fm-id"><span class="k">'+u(i.label)+"</span>"+(i.live?'<span class="fm-lv">Lv '+n+"<small> / "+a+"</small></span>"+(i.powers?'<span class="v">'+Q(i.powers.now)+'%</span><span class="m">'+Q(i.powers.max)+"% at Lv "+a+"</span>":""):'<span class="fm-off">Locked</span>')+"</div>",f=l?'<div class="asc-cost">'+(l.items||[]).map(v=>'<div class="asc-item'+(v.short?" short":"")+'"><span class="n">'+u(v.name)+'</span><span class="c">'+Q(v.held)+" / "+Q(v.need)+"</span></div>").join("")+'<div class="asc-item'+(e<l.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+Q(e)+" / "+Q(l.funds)+"</span></div></div>":"",m='<div class="asc-foot"><span class="asc-why">'+d+"</span>"+(l?'<button class="asc-go" type="button" data-form-up="'+u(i.key)+'"'+(i.ready?"":" disabled")+">Train</button>":"")+"</div>";return'<div class="fm-track'+(i.live?"":" off")+'">'+h+f+m+"</div>"};return'<div class="asc-plate fm-plate">'+s+t.tracks.map(o).join("")+"</div>"}var Fc={"none-held":"You hold none of these &mdash; farm them in Materials.","short-materials":"Not enough materials for the next ascension.","short-funds":"Not enough Funds for the next ascension.",max:"Fully ascended.",ready:""};function Pc(t,e){if(!t)return"";let a=Math.max(0,Number(t.step)||0),r=Math.max(1,Number(t.max)||6),s=t.next||null,o="";for(let f=0;f<r;f+=1)o+='<span class="'+(f<a?"on":"off")+'">&#9733;</span>';let i='<div class="asc-head"><span class="lab">Ascension</span><span class="asc">'+o+'</span><span class="asc-cap">'+(s?"Cap "+s.capFrom+" &rarr; "+s.capTo:"Cap "+(Number(t.cap)||90))+"</span></div>",n=(s?s.items:[]).map(f=>'<div class="asc-item'+(f.short?" short":"")+'"><span class="n">'+u(f.name)+'</span><span class="c">'+Q(f.held)+" / "+Q(f.need)+"</span></div>").join("")+(s?'<div class="asc-item'+(e<s.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+Q(e)+" / "+Q(s.funds)+"</span></div>":""),l=s?"Reach Lv "+(Number(t.cap)||s.capFrom)+" to ascend &mdash; this unit is Lv "+(Number(t.level)||1)+".":"",h='<div class="asc-foot"><span class="asc-why">'+[t.reason==="not-at-cap"?l:Fc[t.reason]||"",t.gated===!1&&s?"The level cap stays open until then.":""].filter(Boolean).join(" ")+"</span>"+(s?'<button class="asc-go" type="button" data-ascend'+(t.ready?"":" disabled")+">Ascend</button>":"")+"</div>";return'<div class="asc-plate">'+i+(s?'<div class="asc-cost">'+n+"</div>":"")+h+"</div>"}function Io({unit:t,level:e=1,bond:a=0,tab:r="profile",state:s="ready",growth:o=null,gear:i=null,gearSlot:n=null,gearFeed:l=null,facets:d=null,outfitAt:h=0,outfitBusy:f=!1,outfitEditing:m=!1,outfitHistoryMax:v=6}={}){if(s==="loading"||!t)return`
<div class="root">
  ${Va}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">Unit</div><h2>${s==="error"?"Unavailable":"Loading\u2026"}</h2></div>
    </div>
    <div class="cp-body"><div class="grid-empty" style="grid-column:1/-1">${s==="error"?"Couldn't load this unit.":"Loading\u2026"}</div></div>
  </section>
</div>`;let b=t.kind!=="weapon",w=b&&!!d,c=b&&!t.isProtagonist,y=b,E=b?[["profile","Profile"],["growth","Growth"],["gear","Gear"],...w?[["facets","Facets"]]:[],...y?[["outfits","Outfits"]]:[],...c?[["bond","Bond"]]:[]]:[["profile","Profile"],["growth","Growth"]],T=r;!b&&(T==="bond"||T==="gear")&&(T="profile"),T==="bond"&&!c&&(T="profile"),T==="facets"&&!w&&(T="profile"),T==="outfits"&&!y&&(T="profile");let R=E.map(F=>'<button type="button" role="tab" data-tab="'+F[0]+'" aria-selected="'+(F[0]===T?"true":"false")+'">'+F[1]+"</button>").join(""),W=T==="outfits"?yo(t,h,f,m,v):T==="bond"?Oc(t,a):T==="facets"?Mc(t,d):T==="gear"?Lc(t,i,n,l):T==="growth"?No(t,o):Tc(t,e,i&&i.totals),O=b?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+he(t.dedicatedTo):""),U='<div class="cp-portrait">'+(Ua(t)?'<img class="cp-photo" src="'+u(Ua(t))+'" alt="" loading="lazy">':b?lc.character:Oe(t.weaponType,"gf-sil"))+'</div><div class="cp-id-top">'+(b&&!t.isProtagonist?'<button class="cp-art-btn" type="button" data-portrait>'+pc+"Portrait</button>":"")+'<button class="cp-fav" type="button" aria-pressed="false" data-fav><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 3.2C20 14.5 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="cp-id-plate"><div class="plate-stars '+_o(t.rarity)+'">'+ko(t.rarity)+"</div><h3>"+u(he(t.name))+'</h3><div class="role">'+u(O)+'</div><div class="chips"><span>Lv '+(Number(e)||1)+"</span>"+(b?'<span class="bond">&#9829; Bond '+(Number(a)||0)+"</span>":"")+'</div><button class="cp-party" type="button"'+(b?" data-set-party":" disabled")+">"+(b?"Set to party":"Equip to a character")+"</button></div>";return`
<div class="root">
  ${Va}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">${b?"Character":"Weapon"}</div><h2>${u(he(t.name))}</h2></div>
    </div>
    <div class="cp-body gf-swap">
      <div class="cp-id${b?"":" wpn"}">${U}</div>
      <div class="cp-main">
        <div class="cp-tabs" role="tablist">${R}</div>
        <div class="cp-panel">${W}</div>
      </div>
    </div>
  </section>
</div>`}function Co(t,{onOpenUnit:e,onBack:a,onCat:r,onRarity:s,onSearch:o}){(t.querySelector(".root")||t).addEventListener("click",h=>{let f=h&&h.target&&h.target.closest?h.target:null,m=f&&f.closest("[data-unit]");m&&e&&e(m.getAttribute("data-unit"))});for(let h of t.querySelectorAll("[data-cat]"))h.addEventListener("click",()=>r&&r(h.dataset.cat));for(let h of t.querySelectorAll("[data-rar]"))h.addEventListener("click",()=>s&&s(h.dataset.rar));let n=t.querySelector("[data-unit-search]");n&&n.addEventListener("input",()=>o&&o(n.value||""));let l=t.querySelector("[data-unit-search-clear]");l&&l.addEventListener("click",()=>{n&&(n.value=""),o&&o(""),n&&typeof n.focus=="function"&&n.focus()});let d=t.querySelector("[data-roster-back]");d&&d.addEventListener("click",()=>a&&a())}function Ro(t,{onTab:e,onBack:a,onSetParty:r,onPortrait:s,onFeed:o,onFeedReset:i,onFeedGo:n,onAscend:l,onFormUp:d,onGearSlot:h,onGearBack:f,onEquip:m,onRelicFeed:v,onOpenWeapon:b}){for(let F of t.querySelectorAll("[data-tab]"))F.addEventListener("click",()=>e&&e(F.dataset.tab));let w=t.querySelector("[data-back-roster]");w&&w.addEventListener("click",()=>a&&a());let c=t.querySelector("[data-set-party]");c&&c.addEventListener("click",()=>r&&r());let y=t.querySelector("[data-portrait]");y&&y.addEventListener("click",()=>s&&s());let E=t.querySelector(".root")||t,T=null,R=null,W=0,O=()=>{T&&(clearTimeout(T),T=null),R=null,W=0},U=()=>{if(!R)return;let F=E.querySelector('[data-feed="'+R+'"]');if(!F||F.disabled){O();return}W+=1,o&&o(R),T=setTimeout(U,Math.max(55,300-W*24))};E.addEventListener("pointerdown",F=>{let j=F&&F.target&&F.target.closest?F.target:null,D=j&&j.closest("[data-feed]");!D||D.disabled||(O(),R=D.getAttribute("data-feed"),T=setTimeout(U,420))});for(let F of["pointerup","pointercancel","pointerleave"])E.addEventListener(F,O);E.addEventListener("click",F=>{let j=F&&F.target&&F.target.closest?F.target:null;if(!j)return;let D=j.closest("[data-feed]");if(D&&!D.disabled){o&&o(D.dataset.feed);return}if(j.closest("[data-feed-reset]")){i&&i();return}if(j.closest("[data-feed-go]")){n&&n();return}let X=j.closest("[data-ascend]");if(X&&!X.disabled){l&&l();return}let J=j.closest("[data-form-up]");if(J&&!J.disabled){d&&d(J.getAttribute("data-form-up"));return}let le=j.closest("[data-gear-slot]");if(le&&!le.disabled){h&&h(le.getAttribute("data-gear-slot"));return}if(j.closest("[data-gear-back]")){f&&f();return}let oe=j.closest("[data-wlevel]");if(oe&&!oe.disabled){b&&b(oe.getAttribute("data-wlevel"));return}let re=j.closest("[data-equip]");if(re&&!re.disabled){m&&m(re.getAttribute("data-equip")||"");return}if(!v)return;if(j.closest("[data-rfeed-open]")){v({type:"open"});return}if(j.closest("[data-rfeed-back]")){v({type:"back"});return}if(j.closest("[data-rfeed-clear]")){v({type:"clear"});return}let ee=j.closest("[data-rfeed-go]");if(ee&&!ee.disabled){v({type:"go"});return}let Z=j.closest("[data-rfeed-pick]");Z&&v({type:"pick",id:Z.getAttribute("data-rfeed-pick")})})}var ra=2/3;function kt(t){let e=Array.isArray(t)?t:String(t??"").split(","),a=[];for(let r of e){let s=String(r??"").trim();s&&!a.includes(s)&&a.push(s)}return a}function Ya(t,e,a=1,r=.5,s=.5){let o=Math.max(1,Number(t)||1),i=Math.max(1,Number(e)||1),n=Math.min(o,i*ra),l=Math.min(1,Math.max(.2,Number(a)||1)),d=n*l,h=d/ra;return Ka({x:o*r-d/2,y:i*s-h/2,w:d,h},o,i)}function Ka(t,e,a){let r=Math.max(1,Number(e)||1),s=Math.max(1,Number(a)||1),o=Math.min(Math.max(1,Number(t&&t.w)||1),r),i=o/ra;i>s&&(i=s,o=i*ra);let n=Math.min(Math.max(0,Number(t&&t.x)||0),r-o),l=Math.min(Math.max(0,Number(t&&t.y)||0),s-i);return{x:n,y:l,w:o,h:i}}var Lo=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;
  font-family: var(--body);
  color: var(--text);






  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%), radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* Same head contract as every screen: hoistHeadIntoBar REMOVES it, so the second row only exists
   while it is still here. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }

.pt-body { min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.pt-main { min-height: 0; display: flex; gap: var(--sp-3); }

/* The plate takes its width from its HEIGHT and the portrait's ratio, so it never letterboxes and
   never dictates how much room the editor gets. */
.pt-now { flex: none; height: 100%; aspect-ratio: 2 / 3; position: relative; background: var(--steel-dark); border: 1px solid var(--steel); overflow: hidden; border-radius: var(--radius-sm); }
.pt-now img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
.pt-none { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.pt-tag { position: absolute; left: 0; bottom: 0; padding: calc(var(--f) * 0.3) var(--sp-2); background: color-mix(in srgb, var(--ground-2) 82%, transparent); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }

.pt-editor { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
.pt-field { display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); min-height: 0; }
.pt-field.grow { flex: 1 1 auto; }
.pt-sent { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; color: var(--porcelain-3); padding: calc(var(--f) * 0.4) calc(var(--f) * 0.6); background: color-mix(in srgb, var(--ink-3) 70%, transparent); border-left: 2px solid var(--coral); border-radius: var(--radius-sm); margin-bottom: calc(var(--f) * 0.5); }
.pt-sent b { color: var(--text); }
.pt-sent [data-prompt-name] { color: var(--coral); font-weight: 700; }
.pt-label { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--coral); }
.pt-hint { font-family: var(--body); font-size: var(--t-xs); letter-spacing: 0; text-transform: none; color: var(--steel-faint); }

/* A contained scroll, which the rule allows: the SCREEN never scrolls, a box inside it may. */
.pt-text { flex: 1 1 auto; min-height: calc(var(--f) * 5); resize: none; overflow: auto; background: color-mix(in srgb, var(--ground-1) 70%, transparent); color: var(--text); border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); padding: var(--sp-2); font-family: var(--body); font-size: var(--t-sm); line-height: 1.45; }
.pt-text:focus { outline: none; border-color: var(--coral); }

.pt-tags { display: flex; flex-wrap: wrap; align-content: flex-start; gap: calc(var(--f) * 0.4); max-height: calc(var(--f) * 9); overflow: auto; background: color-mix(in srgb, var(--ground-1) 70%, transparent); border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); padding: var(--sp-1); }
.pt-chip { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: var(--steel-dark); color: var(--text); border: 1px solid var(--steel); border-radius: var(--radius-sm); padding: calc(var(--f) * 0.2) calc(var(--f) * 0.5); font-size: var(--t-xs); font-variant-numeric: tabular-nums; }
.pt-chip button { background: none; border: 0; color: var(--steel-faint); cursor: pointer; font-size: var(--t-sm); line-height: 1; padding: 0 calc(var(--f) * 0.15); }
.pt-chip button:hover { color: var(--coral); }
.pt-add { flex: 1 1 calc(var(--f) * 8); min-width: calc(var(--f) * 6); background: transparent; border: 0; color: var(--text); font-family: var(--body); font-size: var(--t-xs); padding: calc(var(--f) * 0.2); }
.pt-add:focus { outline: none; }

.pt-actions { flex: none; display: flex; align-items: center; gap: var(--sp-2); }
.pt-go { cursor: pointer; border: 0; background: var(--coral); color: var(--on-coral); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.6) var(--sp-3); --cut: 0.8em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.pt-go:hover:not(:disabled) { filter: brightness(1.08); }
.pt-alt { cursor: pointer; background: transparent; border: 1px solid var(--steel); color: var(--text); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.55) var(--sp-2); border-radius: var(--radius-sm); }
.pt-alt:hover:not(:disabled) { border-color: var(--coral); color: var(--coral); }
.pt-go:disabled, .pt-alt:disabled { opacity: 0.45; cursor: default; }
.pt-note { margin-left: auto; text-align: right; font-size: var(--t-xs); color: var(--steel-faint); }
.pt-note.bad { color: var(--coral); }
.pt-file { display: none; }

/* \u2500\u2500 The history strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   FIXED HEIGHT, even with nothing in it. As an auto row it collapsed when a unit had no earlier
   art, and the plate above grew from 302x453 to 347x521 -- the same portrait cropped differently
   depending on how many times you had redone it. No backticks in here, ever. */
.pt-past { flex: none; height: calc(var(--f) * 10); display: flex; align-items: flex-end; gap: var(--sp-2); }
.pt-past .cap { flex: none; width: calc(var(--f) * 9); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.pt-strip { flex: 1 1 auto; min-width: 0; display: flex; gap: var(--sp-1); overflow-x: auto; padding-bottom: calc(var(--f) * 0.2); }
.pt-thumb { flex: none; position: relative; height: calc(var(--f) * 8.6); aspect-ratio: 2 / 3; padding: 0; cursor: pointer; background: var(--steel-dark); border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); overflow: hidden; }
.pt-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; display: block; }
.pt-thumb:hover { border-color: var(--coral); }
.pt-thumb[aria-current="true"] { border-color: var(--amber); cursor: default; }
.pt-thumb .now { position: absolute; inset: auto 0 0 0; background: color-mix(in srgb, var(--amber) 85%, transparent); color: var(--ink); font-family: var(--display); font-size: calc(var(--f) * 0.62 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; text-transform: var(--case); }
.pt-empty { font-size: var(--t-xs); color: var(--steel-faint); align-self: center; }

.pt-crop { min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.pt-canvas { position: relative; min-height: 0; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--ground-1) 60%, transparent); border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); overflow: hidden; }
/* The box carries the image's OWN ratio, set inline from naturalWidth/naturalHeight, sized
   height-first with a max-width that clamps it. Written the obvious way, a percentage max-height
   against an auto-height parent resolves to none: measured, a 1600x900 picture drew 604px tall in a
   507px box (clipped by the canvas, so no scroll check saw it) and a 700x1900 one at its FULL height. */
.pt-shot { position: relative; height: 100%; max-width: 100%; max-height: 100%; }
.pt-shot img { display: block; width: 100%; height: 100%; }
/* The veil is what makes the frame READ as a frame: the part that stays is the bright part. */
.pt-frame { position: absolute; border: 2px solid var(--amber); box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--ground-2) 72%, transparent); cursor: grab; touch-action: none; }
.pt-frame.drag { cursor: grabbing; }
.pt-frame::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to right, transparent 33%, color-mix(in srgb, var(--amber) 28%, transparent) 33%, color-mix(in srgb, var(--amber) 28%, transparent) 33.4%, transparent 33.4%, transparent 66.6%, color-mix(in srgb, var(--amber) 28%, transparent) 66.6%, color-mix(in srgb, var(--amber) 28%, transparent) 67%, transparent 67%); pointer-events: none; }
.pt-crop-bar { flex: none; display: flex; align-items: center; gap: var(--sp-3); }
.pt-size { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.pt-size input { flex: 1 1 auto; min-width: 0; accent-color: var(--coral); }
`;function Hc(t,e){return'<span class="pt-chip">'+u(t)+'<button type="button" data-tag-drop="'+e+'" aria-label="Remove '+u(t)+'">&times;</button></span>'}function Dc(t,e){return t.length?'<div class="pt-strip">'+t.map((a,r)=>'<button class="pt-thumb" type="button" aria-current="'+(a.current?"true":"false")+'"'+(a.current?" disabled":' data-pick="'+r+'"')+' title="'+u(a.source==="upload"?"Your own image":"Generated")+'"><img src="'+u(a.url)+'" alt="" loading="lazy">'+(a.current?'<span class="now">Now</span>':"")+"</button>").join("")+"</div>":'<div class="pt-empty">No earlier art yet \u2014 the first redo puts this one here, and the last '+e+" are kept.</div>"}function Mo({unit:t=null,view:e="edit",draft:a=null,history:r=[],historyMax:s=0,busy:o=!1,error:i="",crop:n=null,promptName:l=""}={}){let d=t&&t.name?String(t.name):"Portrait",h=a||{appearance:"",tags:[]},f=kt(h.tags),m='<div class="head"><button class="back" type="button" data-portrait-back>&#9664; '+u(d)+'</button><div class="head-id"><div class="eyebrow">Portrait</div><h2>'+(e==="crop"?"Choose the frame":"Redo the art")+"</h2></div></div>";if(e==="crop"){let w=n&&n.src||"",c=Math.round((n&&n.size||1)*100),y=n&&n.natural,E=y&&n.frame?' style="left:'+n.frame.x/y.w*100+"%;top:"+n.frame.y/y.h*100+"%;width:"+n.frame.w/y.w*100+"%;height:"+n.frame.h/y.h*100+'%"':"";return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait-crop">
    ${m}
    <div class="pt-crop gf-swap">
      <div class="pt-canvas">
        <div class="pt-shot" data-shot${y?' style="aspect-ratio:'+y.w+" / "+y.h+'"':""}>
          <img src="${u(w)}" alt="" data-crop-img>
          <div class="pt-frame" data-frame${E}></div>
        </div>
      </div>
      <div class="pt-crop-bar">
        <label class="pt-size">Frame<input type="range" min="20" max="100" value="${c}" data-size></label>
        <button class="pt-alt" type="button" data-crop-cancel>Cancel</button>
        <button class="pt-go" type="button" data-crop-ok${o?" disabled":""}>${o?"Uploading\u2026":"Use this frame"}</button>
      </div>
    </div>
  </section>
</div>`}let v=r.find(w=>w.current)||null,b=i?'<div class="pt-note bad">'+u(i)+"</div>":'<div class="pt-note">Art goes through the image API \u2014 it costs no story tokens.</div>';return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait">
    ${m}
    <div class="pt-body gf-swap">
      <div class="pt-main">
        <div class="pt-now">
          ${v?'<img src="'+u(v.url)+'" alt="" loading="lazy">':'<div class="pt-none">No portrait yet</div>'}
          ${v?'<span class="pt-tag">'+(v.source==="upload"?"Your image":"Generated")+"</span>":""}
        </div>
        <div class="pt-editor">
          <div class="pt-field grow">
            <!-- The name is shown because it is always sent: it leads the prompt and cannot be
                 edited. This screen labels its fields as what will be sent, and the name was not
                 among them, so it told half a truth. -->
            <div class="pt-sent"><b>Sent first:</b> <span data-prompt-name>${u(l||"(no name)")}</span>
              <span class="pt-hint">Added automatically, always ahead of the text below.</span></div>
            <div class="pt-label">Appearance<span class="pt-hint">What the image model reads. English only &mdash; a backend rejects the rest.</span></div>
            <textarea class="pt-text" data-appearance spellcheck="false" placeholder="Describe her as the image model should see her.">${u(h.appearance)}</textarea>
          </div>
          <div class="pt-field">
            <div class="pt-label">Tags<span class="pt-hint">Booru tags. These win over the prose when your style profile is tagged.</span></div>
            <div class="pt-tags" data-tags>
              ${f.map(Hc).join("")}
              <input class="pt-add" data-tag-add type="text" placeholder="add a tag, Enter" spellcheck="false">
            </div>
          </div>
          <div class="pt-actions">
            <button class="pt-go" type="button" data-generate${o?" disabled":""}>${o?"Painting\u2026":"Paint it again"}</button>
            <button class="pt-alt" type="button" data-upload${o?" disabled":""}>Use my own image\u2026</button>
            <input class="pt-file" type="file" accept="image/png,image/jpeg,image/webp" data-file>
            ${b}
          </div>
        </div>
      </div>
      <div class="pt-past">
        <div class="cap">Earlier</div>
        ${Dc(r,s)}
      </div>
    </div>
  </section>
</div>`}function Oo(t,{onBack:e,onDraft:a,onGenerate:r,onPick:s,onFile:o,onCropSize:i,onCropFrame:n,onCropOk:l,onCropCancel:d}={}){let h=O=>t.querySelector(O),f=h("[data-portrait-back]");f&&f.addEventListener("click",()=>e&&e());let m=h("[data-appearance]");m&&m.addEventListener("input",()=>a&&a({appearance:m.value}));let v=h("[data-tag-add]");v&&v.addEventListener("keydown",O=>{if(O.key!=="Enter"&&O.key!==",")return;O.preventDefault();let U=String(v.value||"").trim();U&&(v.value="",a&&a({addTag:U}))});for(let O of t.querySelectorAll("[data-tag-drop]"))O.addEventListener("click",()=>a&&a({dropTag:Number(O.getAttribute("data-tag-drop"))}));let b=h("[data-generate]");b&&b.addEventListener("click",()=>r&&r());for(let O of t.querySelectorAll("[data-pick]"))O.addEventListener("click",()=>s&&s(Number(O.getAttribute("data-pick"))));let w=h("[data-file]"),c=h("[data-upload]");c&&w&&c.addEventListener("click",()=>w.click()),w&&w.addEventListener("change",()=>{let O=w.files&&w.files[0];w.value="",O&&o&&o(O)});let y=h("[data-size]");y&&y.addEventListener("input",()=>i&&i(Number(y.value)/100));let E=h("[data-crop-ok]");E&&E.addEventListener("click",()=>l&&l());let T=h("[data-crop-cancel]");T&&T.addEventListener("click",()=>d&&d());let R=h("[data-frame]"),W=h("[data-shot]");if(R&&W&&n){let O=null;R.addEventListener("pointerdown",F=>{O={x:F.clientX,y:F.clientY},R.classList.add("drag"),R.setPointerCapture&&R.setPointerCapture(F.pointerId),F.preventDefault()}),R.addEventListener("pointermove",F=>{if(!O)return;let j=W.getBoundingClientRect();n({dx:(F.clientX-O.x)/(j.width||1),dy:(F.clientY-O.y)/(j.height||1)}),O={x:F.clientX,y:F.clientY}});let U=()=>{O=null,R.classList.remove("drag")};R.addEventListener("pointerup",U),R.addEventListener("pointercancel",U)}}function Xa(t,e,a,r){let s=t.querySelector("[data-frame]"),o=t.querySelector("[data-crop-img]");if(!s||!o||!e)return;let i=Math.max(1,Number(a)||1),n=Math.max(1,Number(r)||1);s.style.left=e.x/i*100+"%",s.style.top=e.y/n*100+"%",s.style.width=e.w/i*100+"%",s.style.height=e.h/n*100+"%"}var _t={story:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',events:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.4 5.4 5.9.6-4.4 4 1.2 5.8L12 15.9 6.9 18.8l1.2-5.8-4.4-4 5.9-.6z"/></svg>',materials:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',tower:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 21V8l6-5 6 5v13z"/><path d="M10 21v-5h4v5M9 11h6"/></svg>'},qc=[{id:"story",label:"Story",live:!0,blurb:"The main line. Chapters of beats and fights that move the world forward."},{id:"events",label:"Story Events",live:!1,blurb:"Limited-time side stories, tied to the event system."},{id:"materials",label:"Materials",live:!0,blurb:"Farm what levels and ascends your units. Spends stamina; pays in materials."},{id:"tower",label:"Tower",live:!1,wide:!0,blurb:"A monthly climb. Resets, gets harder, pays in materials."},{id:"pvp",label:"PvP",live:!1,blurb:"Your formation against another commander's, resolved by the same sim. No live opponent."}],Bo=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;

  /* THE SHARED RAMP, never a private one. There were TWO and this screen used the small one, ~12%
     below the rest: measured, the hero paragraph came out at 8.4px. */






  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
  /* How much the footer strip takes. ONE knob, in ramp units; whatever it measures comes off the
     hero. */
  --strip-h: calc(var(--f) * 11);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) and the :has() row, not auto 1fr: hoistHeadIntoBar REMOVES the .head, and two fixed
   rows would put the only child in the auto row, sized to its content. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }
.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

/* The hero takes the left column across both rows. The same block language as the Home, because it
   is the same kind of choice. */
/* Hero beside a column, not a grid: a 3x2 grid fits four modes with a HOLE in the last cell, and
   the hole moves every time a mode ships. */
/* The board is a COLUMN: the strip does not grow and the top absorbs, so the strip's height comes
   off the HERO. */
.board { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
.board-top { flex: 1; min-height: 0; display: flex; gap: var(--sp-2); }
.rest { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
.rest > .m { flex: 1; min-height: 0; }

/* The strip: wide, contents IN A ROW -- stacked it would grow tall, and height is what is being
   given back to the hero. Its height comes from --strip-h, not the content: with the content
   deciding it measured 50px, a band that read as a separator rather than a mode. */
.m.strip { flex: none; min-height: var(--strip-h); flex-direction: row; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); justify-content: flex-start; }
/* The glyph grows with the strip: at 50px it was an icon, with real height it is the watermark the
   other cards use. In flow, not absolute, because here it orders the row. */
.m.strip .glyph { position: static; width: var(--strip-h); height: var(--strip-h); max-width: calc(var(--f) * 4.4); max-height: calc(var(--f) * 4.4); flex: none; opacity: 0.5; }
.m.strip .strip-id { display: flex; flex-direction: column; gap: calc(var(--f) * 0.1); flex: none; }
.m.strip .kicker { font-size: var(--t-xs); }
.m.strip .name { font-size: calc(var(--f) * 1.9 * var(--gf-type-scale, 1)); }
.m.strip .blurb { font-size: var(--t-sm); }
/* min-width: 0 or the blurb does NOT shrink: a flex child has min-width auto, and a long sentence
   would push the chip out of the strip. */
.m.strip .blurb { flex: 1; min-width: 0; margin: 0; }
.m.strip .tag { position: static; flex: none; margin-left: auto; }
/* The card is the HOME's block, not a plainer cousin. Three structural differences make it read as
   one: the glyph is a huge WATERMARK bleeding off the corner instead of a small icon in flow, the
   content is anchored to the BOTTOM, and the name uses the title face. */
.m {
  position: relative; overflow: hidden; min-width: 0; min-height: 0;
  cursor: pointer; text-align: left; font-family: var(--display);
  padding: var(--sp-2) var(--sp-3);
  /* THE CONTENT SITS AT THE BOTTOM VIA AN AUTO MARGIN, NOT justify-content flex-end. With flex-end,
     content that does NOT FIT overflows past the START edge -- upwards -- where the neighbour covers
     it and no scroll can reach it. On a phone --f hits its 7.5px floor and the three lines stop
     fitting, so the case is permanent. With margin-top: auto the overflow goes DOWN, where overflow
     hidden clips it against its own box. */
  display: flex; flex-direction: column; justify-content: flex-start; gap: calc(var(--f) * 0.2);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  color: var(--text);
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel);
  transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease), background-color var(--dur-fast) ease;
}
.m.live:hover { transform: translateY(-2px); border-top-color: var(--coral); background: color-mix(in srgb, var(--ink-2) 96%, transparent); }
.m:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.m[disabled] { cursor: default; }
.m[disabled] .name, .m[disabled] .kicker { color: var(--steel-faint); }
.m .glyph {
  position: absolute; right: calc(var(--f) * -0.4); bottom: calc(var(--f) * -0.6);
  width: 42%; max-width: calc(var(--f) * 6.5);
  color: var(--steel); opacity: 0.13; pointer-events: none;
}
.m .kicker { margin-top: auto; font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.m .name {
  font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight);
  font-size: calc(var(--f) * 1.5 * var(--gf-type-scale, 1)); letter-spacing: var(--track); text-transform: var(--case); line-height: 1.18;
}
/* A PARAGRAPH cannot use a label's size: on --t-xs and the small ramp it came out at 8.4px. */
.m .blurb { font-size: var(--t-sm); letter-spacing: 0.04em; line-height: 1.45; color: var(--porcelain-3); }
.m .tag {
  position: absolute; top: calc(var(--f) * 0.7); right: calc(var(--f) * 0.9);
  font-family: var(--display); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.14em;
  text-transform: var(--case); padding: 0 calc(var(--f) * 0.6);
  border: 1px solid var(--steel-dark); color: var(--steel-faint);
}
.m.live .tag { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }

/* The hero echoes .block.battle: it is the one card with somewhere to go and something to report. */
.m.hero {
  flex: 1.35; min-width: 0; justify-content: space-between; padding: var(--sp-3);
  border-top-color: var(--coral);
  background:
    radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--coral) 16%, transparent), transparent 58%),
    linear-gradient(160deg, var(--glow-1) 0%, var(--ink-2) 70%);
}
.m.hero .glyph { width: 46%; max-width: calc(var(--f) * 11); opacity: 0.16; color: var(--coral); }
.m.hero .kicker {
  display: inline-flex; align-items: center; gap: calc(var(--f) * 0.5);
  font-size: var(--t-xs); letter-spacing: 0.22em; color: var(--coral);
}
.m.hero .kicker::before { content: ""; width: calc(var(--f) * 1.6); height: 1px; background: var(--coral); }
.m.hero .name { font-size: calc(var(--f) * 2.3 * var(--gf-type-scale, 1)); }
.m.hero .title {
  font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight);
  font-size: var(--t-lg); letter-spacing: var(--track); line-height: 1.15; color: var(--text);
  margin-top: calc(var(--f) * 0.4);
}
/* THE PREMISE FILLS THE ROOM IT HAS, NOT A FIXED NUMBER OF LINES. Pinned at 3, at 150% text those
   3 lines hold much less and the player never learns what the chapter is about, with spare room
   below. A clamp of N lines is a lie as soon as the text scales; the fade replaces the ellipsis. */
.m.hero .premise {
  font-size: var(--t-md); line-height: 1.5; color: var(--porcelain-3);
  flex: 1 1 auto; min-height: 0; overflow: hidden;
  -webkit-mask-image: linear-gradient(180deg, #000 82%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 82%, transparent 100%);
}
.hero-top { display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); flex: 1 1 auto; min-height: 0; }
.hero-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--sp-2); }
.nodes { display: flex; align-items: center; gap: calc(var(--f) * 0.35); font-size: var(--t-xs); color: var(--steel-faint); }
.nodes i { width: calc(var(--f) * 0.6); height: calc(var(--f) * 0.6); transform: rotate(45deg); background: var(--ink-3); display: block; }
.nodes i.on { background: var(--coral); }
.nodes span { margin-left: calc(var(--f) * 0.4); }
.cta { display: inline-flex; flex-direction: column; align-items: flex-end; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-3); background: var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.cta small { font-size: var(--t-tiny); font-weight: 600; letter-spacing: 0.08em; opacity: 0.85; }
`;function $c(t,e){let a="";for(let r=0;r<t;r+=1)a+='<i class="'+(r<e?"on":"")+'"></i>';return a}function zo({story:t=null,modes:e=qc}={}){let a=t||{},r=!!a.hasPlan,s=Number(a.total)||10,o=Math.max(0,Math.min(s,Number(a.done)||0)),i=e.map(h=>{if(h.id==="story"){let f=!!h.live;return'<button class="m hero'+(f?" live":"")+'" type="button"'+(f?' data-mode="story"':" disabled")+'><span class="tag">'+(f?"Open":"Soon")+"</span>"+_t.story+'<span class="hero-top"><span class="kicker">'+(f?u(a.chapterLabel||"Chapter 1"):"Not open yet")+'</span><span class="name">Story</span>'+(f?'<span class="title">'+u(r?a.title||"":"Your world is forged")+'</span><p class="premise">'+u(r?a.premise||"":"Open the first chapter to start the story.")+"</p>":'<p class="premise">'+u(h.blurb||"")+"</p>")+"</span>"+(f?'<span class="hero-foot"><span class="nodes">'+$c(s,o)+"<span>"+(r?o+" of "+s+" cleared":"Not started")+'</span></span><span class="cta">'+(o>0?"Continue":"Begin")+"<small>"+u(a.chapterLabel||"Chapter 1")+"</small></span></span>":"")+"</button>"}return h.wide?'<button class="m strip'+(h.live?" live":"")+'" type="button"'+(h.live?' data-mode="'+u(h.id)+'"':" disabled")+">"+(_t[h.id]||_t.events)+'<span class="strip-id"><span class="kicker">'+(h.live?"Ready":"Not open yet")+'</span><span class="name">'+u(h.label)+'</span></span><p class="blurb">'+u(h.blurb)+'</p><span class="tag">'+(h.live?"Open":"Soon")+"</span></button>":'<button class="m'+(h.live?" live":"")+'" type="button"'+(h.live?' data-mode="'+u(h.id)+'"':" disabled")+'><span class="tag">'+(h.live?"Open":"Soon")+"</span>"+(_t[h.id]||_t.events)+'<span class="kicker">'+(h.live?"Ready":"Not open yet")+'</span><span class="name">'+u(h.label)+'</span><p class="blurb">'+u(h.blurb)+"</p></button>"}),n=i[0],l=i.filter((h,f)=>f>0&&!e[f].wide).join(""),d=i.filter((h,f)=>f>0&&e[f].wide).join("");return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="modes">
    <div class="head">
      <button class="back" type="button" data-back-home>&#9664; Home</button>
      <div class="head-id"><div class="eyebrow">Battle</div><h2>Pick a mode</h2></div>
    </div>
    <div class="board"><div class="board-top">${n}<div class="rest">${l}</div></div>${d}</div>
  </section>
</div>`}function Fo(t,{onPick:e,onBack:a}={}){for(let s of t.querySelectorAll("[data-mode]"))s.addEventListener("click",()=>e&&e(s.dataset.mode));let r=t.querySelector("[data-back-home]");r&&r.addEventListener("click",()=>a&&a())}function Ja(t){return(Number(t)||0).toLocaleString("en-US")}var St=zt,jc='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Ho=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;

  /* THE SHARED RAMP, never a private one. There were TWO and this screen used the small one, ~12%
     below the rest: the symptom was "nothing is readable". A per-screen ramp drifts like a copied
     colour token, and nobody notices until someone cannot read. */





  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) and the :has() row, never auto 1fr: hoistHeadIntoBar REMOVES the .head, and two
   fixed rows would drop the only child into the AUTO row and size it to its content. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
/* The head repeats Vigor because THIS is the screen that spends it, and the bar is gone in
   fullscreen on narrow windows. */

/* The band is a SIBLING of the board, never a child: nested, it became a fourth item in a
   three-column grid and split a third of the screen into three -- 110px cells for text needing 232.
   Height is the scarce dimension here and width is the free one. */
.body { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
/* hoistHeadIntoBar removes the .head and its padding, so content lands against the bar: measured,
   0px of air against 13 on Inventory. Under :not(:has(> .head)) so it never doubles up.
   Both containers need it: the root view uses .body, the rotation view uses .detail. */
.screen:not(:has(> .head)) .body,
.screen:not(:has(> .head)) .detail { padding-top: var(--sp-2); }
/* TWO ROWS: three plates then two, the second centring ITSELF with flex-wrap plus justify-content,
   never an nth-child -- a hand-written count breaks the day a sixth stage ships.
   Not one row of five: at five columns a tier card got a 193px box with 63% empty. Two rows put
   the card at 402x74 and the plate at 39% ink, against 52% for an Inventory block.
   WHAT MAKES TWO ROWS FIT is that the card is three rows for EVERY stage. Giving the Relic Vault
   a fourth row for its rarity table -- or reserving it everywhere -- added 48px per plate and
   pushed the second row off screen at six of nine window sizes. The odds share the figure's line.
   SAFE centre, never a bare one: what does not fit spills out of BOTH edges, and the half past
   the top cannot be scrolled to (scroll offset does not go negative). Measured at 1920x1080, the
   first plate sat 111px above the board at 175%, cut and unreachable.
   Measured over 9 window sizes: fits at 100% and at the 115% default in all of them. Past 130% the
   board scrolls inside its own box -- a player who chose a big HUD chose to see less at a time. */
.board { flex: 1 1 auto; min-height: 0; display: flex; flex-wrap: wrap; align-content: safe center; justify-content: center; gap: var(--sp-2); overflow-y: auto; }
/* One plate carries the whole width: a fifth of the board for the lone loading plate reads as a
   broken layout rather than a waiting one. */
.board.solo .plate { flex-basis: 100%; max-width: 100%; }
.plate {
  position: relative; overflow: hidden; min-width: 0; min-height: 0;
  /* A third of the board each, so five wrap into three plus two. */
  flex: 1 1 calc(33.333% - var(--sp-2)); max-width: calc(33.333% - var(--sp-2));
  display: flex; flex-direction: column; gap: calc(var(--f) * 0.5);
  font-family: var(--display); padding: var(--sp-3) var(--sp-2) var(--sp-2);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark); color: var(--text);
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.plate .glyph { position: absolute; right: calc(var(--f) * -0.4); top: calc(var(--f) * -0.6); width: 38%; max-width: calc(var(--f) * 6.5); color: var(--steel); opacity: 0.12; pointer-events: none; }
.p-id { flex: none; min-width: 0; padding: 0 calc(var(--f) * 0.5); }
/* A stage whose drop has no sink yet: drawn, named and unpressable, like a locked dock tile, so
   the board keeps its five columns the day the sink opens. */
/* What the run pays the COMMANDER, beside what it costs: it rises with the price, so it belongs
   in the same foot. */
.tcard .rxp { font-size: var(--t-tiny); letter-spacing: 0.06em; text-transform: var(--case); color: var(--jade); font-variant-numeric: tabular-nums; }
.p-soon { flex: 1 1 auto; display: grid; place-items: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-dark); }
.p-id .kicker { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.p-id .name { display: block; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); line-height: 1.15; }
/* THE "?" IN THE CORNER, THE EXPLANATION INSIDE IT: each plate used to carry a permanent paragraph,
   five fixed sentences taking height in a stage that does not scroll, for something read ONCE.
   THE BUBBLE IS A CHILD OF THE PLATE, not of the button: the plate has clip-path and overflow
   hidden, so a bubble anchored to the button would be CLIPPED IN SILENCE. It is OPAQUE, because it
   sits over the cards.
   THE ? IS A GRID CELL, NOT AN ABSOLUTE: absolute, it sat ON TOP of the title box in all five
   plates -- both inside the plate, so neither overflow nor clipping fires. Two siblings that
   overlap is the third question a measurement has to ask. */
.p-id { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: var(--sp-2); }
.p-id .kicker, .p-id .name, .p-id .blurb { grid-column: 1; }
.p-help { grid-column: 2; grid-row: 1 / span 2; align-self: start; width: calc(var(--f) * 1.7); height: calc(var(--f) * 1.7); display: grid; place-items: center; padding: 0; cursor: help; background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); border-radius: 50%; color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); line-height: 1; }
.p-help:hover, .p-help:focus-visible { color: var(--text); border-color: var(--steel); outline: none; }
.p-tip { position: absolute; z-index: 5; top: calc(var(--f) * 2.6); left: var(--sp-2); right: var(--sp-2); padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7); background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--text); font-family: var(--display); font-size: var(--t-xs); line-height: 1.45; letter-spacing: 0.03em; text-transform: none; text-align: left; opacity: 0; visibility: hidden; transition: opacity 120ms ease; pointer-events: none; box-shadow: var(--panel-shadow); }
.plate:has(.p-help:hover) .p-tip, .plate:has(.p-help:focus-visible) .p-tip { opacity: 1; visibility: visible; }
.p-id .blurb { display: block; margin-top: calc(var(--f) * 0.25); font-size: var(--t-xs); letter-spacing: 0.04em; line-height: 1.4; color: var(--porcelain-3); }

/* One component, two arrangements: stacked where the space is tall, in a row of three where it is
   wide and short. */
.tcards { flex: 1 1 auto; min-height: 0; display: grid; gap: calc(var(--f) * 0.4); }
/* min-content, never 1fr: with 1fr three cards split the WHOLE height of a stretched plate, so a
   card carrying 59px of rows got a 193px box. */
.tcards.col { grid-auto-rows: min-content; align-content: start; }
.tcards.row { flex: 1 1 auto; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); }
.tcard {
  min-width: 0; min-height: 0; cursor: pointer; text-align: left; font-family: var(--display);
  display: flex; flex-direction: column; justify-content: center; gap: calc(var(--f) * 0.1);
  padding: calc(var(--f) * 0.5) calc(var(--f) * 0.7);
  background: var(--ink-3); border: 1px solid transparent; border-left: 2px solid var(--steel-dark);
  color: var(--text); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease), background-color var(--dur-fast) ease;
}
.tcard:hover:not([disabled]) { transform: translateY(-1px); border-color: var(--coral); border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 8%); }
.tcard:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.tcard[disabled] { cursor: default; opacity: 0.55; }
.tcard .tl { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--f) * 0.4); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--amber); }
/* The material's OWN rank, said without a number: the quantity FALLS as difficulty rises, so the
   quantity is exactly what misleads here. */
.tcard .rank { flex: none; display: inline-flex; gap: calc(var(--f) * 0.2); }
.tcard .rank i { width: calc(var(--f) * 0.38); height: calc(var(--f) * 0.38); transform: rotate(45deg); background: var(--ink-2); border: 1px solid var(--steel-dark); display: block; }
.tcard .rank i.on { background: var(--amber); border-color: var(--amber); }
/* The headline names the material IN FULL: a bare "Tier II" made the player look up at the header. */
/* The figure and the odds share ONE line: a line of its own made the Relic Vault's cards 16px
   taller than their neighbours, and reserving it everywhere added 48px per plate -- what stopped
   two rows of plates from fitting. On one line all three cards are three rows by construction. */
.tcard .vrow { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.5); min-width: 0; }
.tcard .odds { flex: none; }
.tcard .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); line-height: 1.15; letter-spacing: var(--track); color: var(--text); }
.tcard .v em { font-style: normal; font-weight: 400; font-size: 0.8em; color: var(--steel-faint); }
/* What the run is WORTH, in a unit shared across the three difficulties: the line that proves
   2 x Prism beats 12 x Shard. */
.tcard .u { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--jade); }
.tcard[disabled] .u { color: var(--steel-faint); }
/* The relic stage drops ONE piece at every difficulty, so what the difficulty moves is the TABLE.
   These three figures ARE the decision, so they go on the card, not in a tooltip nobody opens. */
.tcard .odds { display: flex; gap: calc(var(--f) * 0.5); min-width: 0; font-family: var(--display); font-size: var(--t-tiny); line-height: 1.4; letter-spacing: 0.06em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.tcard .odds span { display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.18); }
.tcard .odds b { font-weight: 700; color: var(--porcelain-3); }
.tcard .odds .five, .tcard .odds .five b { color: var(--amber); }
.tcard[disabled] .odds, .tcard[disabled] .odds b, .tcard[disabled] .odds .five, .tcard[disabled] .odds .five b { color: var(--steel-faint); }
.tcard .cost { margin-top: calc(var(--f) * 0.3); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.25); font-size: var(--t-xs); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.tcard .cost svg { width: calc(var(--f) * 0.9); height: calc(var(--f) * 0.9); color: var(--amber); }
.tcard[disabled] .cost, .tcard[disabled] .cost svg { color: var(--coral); }

/* The open families are CARDS here too: a text list left this plate with three short lines and the
   rest empty, beside two plates packed with cards. Same card component, one rhythm. */
.p-open { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); }
.p-open .k { flex: none; font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding: 0 calc(var(--f) * 0.5); }
.fcards { flex: 1 1 auto; min-height: 0; display: grid; grid-auto-rows: minmax(0, 1fr); gap: calc(var(--f) * 0.4); }
.fcard { min-width: 0; min-height: 0; cursor: pointer; text-align: left; font-family: var(--display); display: flex; flex-direction: column; justify-content: center; gap: calc(var(--f) * 0.1); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.7); background: var(--ink-3); border: 1px solid transparent; border-left: 2px solid var(--amber); color: var(--text); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease), background-color var(--dur-fast) ease; }
.fcard:hover { transform: translateY(-1px); border-color: var(--coral); border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 8%); }
.fcard:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.fcard .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); line-height: 1.1; letter-spacing: var(--track); color: var(--text); }
.fcard .m { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.fcard .more { font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--amber); }
.cta { flex: none; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-1); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.55) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.cta:hover { background: var(--coral-deep); border-color: var(--coral-deep); }

.tcard .foot { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.4); margin-top: calc(var(--f) * 0.3); }
.tcard .cp { font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
/* A CP that does not exist yet is a DASH, never a 0 and never a guess: a made-up threshold reads
   as real and quietly becomes the balance decision it was meant to defer. */
.tcard .cp.tbd { color: var(--steel-dark); }

.band { flex: none; display: grid; grid-template-columns: repeat(var(--bcols, 3), minmax(0, 1fr)); gap: var(--sp-2); border-top: 1px solid var(--ink-3); padding-top: calc(var(--f) * 0.7); margin-top: calc(var(--f) * 0.2); }
.bnd-cell { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.25); }
.bnd-cell .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.bnd-cell .t { min-width: 0; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; line-height: 1.4; color: var(--porcelain-3); }
.bnd-cell .t b { color: var(--text); }
.bnd-cell .t em { font-style: normal; color: var(--amber); }
.who { display: flex; flex-wrap: wrap; gap: calc(var(--f) * 0.35); }
.who .u { min-width: 0; display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.35); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; padding: calc(var(--f) * 0.2) calc(var(--f) * 0.55); background: var(--ink-3); color: var(--text); --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.who .u i { font-style: normal; font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); color: var(--amber); font-variant-numeric: tabular-nums; }
.who .none { font-family: var(--display); font-size: var(--t-xs); color: var(--steel-faint); }
.band-note { flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-dark); }

.detail { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
.rota { flex: none; display: flex; align-items: stretch; gap: calc(var(--f) * 0.4); }
.rota-lab { display: flex; align-items: center; padding-right: var(--sp-2); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); border-right: 1px solid var(--ink-3); }
.rota-days { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: calc(var(--f) * 0.4); }
.day { min-width: 0; cursor: pointer; text-align: center; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.45) 0; background: var(--ink-2); border: 1px solid var(--ink-3); color: var(--steel-faint); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.day:hover { border-color: var(--coral); color: var(--text); }
.day.on { background: var(--amber); border-color: var(--amber); color: var(--ink); }
.day.all { border-color: var(--amber); color: var(--amber); }
.day.all.on { color: var(--ink); }
.rota-note { flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); }

/* Columns come from the COUNT and the rows STRETCH: an auto-fill track list left three cards at the
   top with 333px of dead screen under them. Capped at 4 so eleven families do not shrink to
   slivers; past that the region scrolls. */
/* ROWS FIRST, then columns. Three tries, two wrong: auto-fill columns left 333px of dead screen;
   one stretched row gave 108x383 slivers. rows = min(count, 3) with columns derived means at least
   two rows always, so nothing stretches and the rows fill the region.
   3 families become 3 wide rows, 11 become 4 x 3. Both fill, measured 0/0.
   No backticks in this comment: it lives inside a JS template literal. */
.fams-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); grid-auto-rows: minmax(calc(var(--f) * 7.5), 1fr); gap: var(--sp-2); padding-right: calc(var(--f) * 0.3); }
/* The family name sits BESIDE its three cards: stacked, every row needed a header plus a card, and
   with eleven families the cards were squeezed to 34px for four lines. Beside, the header spends
   WIDTH -- which a 16:9 stage has to spare. */
.fam-card { min-width: 0; min-height: 0; display: flex; align-items: center; gap: var(--sp-2); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--amber); padding: calc(var(--f) * 0.6) calc(var(--f) * 0.8); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius); }
.fam-id { flex: 0 0 22%; min-width: 0; }
.fam-id .n { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.fam-id .m { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* A dead control has to say why. Same rule the level cap and the ascension bill already follow. */
.why { flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.04em; color: var(--coral); }
`;function sa(t,e,a){let r=Number(t.vigor)>Number(e),s=t.cp===null||t.cp===void 0?null:Number(t.cp),o="";for(let l=1;l<=3;l+=1)o+='<i class="'+(l<=Number(t.difficulty)?"on":"")+'"></i>';let i=l=>Math.round(Number(l)*100)+"%",n=t.odds?'<div class="odds"><span>3&#9733;<b>'+i(t.odds[3])+"</b></span><span>4&#9733;<b>"+i(t.odds[4])+'</b></span><span class="five">5&#9733;<b>'+i(t.odds[5])+"</b></span></div>":"";return'<button class="tcard" type="button"'+(r?" disabled":"")+" "+a+'><div class="tl"><span>'+u(t.label)+'</span><span class="rank">'+o+'</span></div><div class="vrow"><span class="v">'+Ja(t.qty)+" <em>&times;</em> "+u(t.material)+"</span>"+n+'</div><div class="foot"><span class="cp'+(s===null?" tbd":"")+'">CP '+(s===null?"&mdash;":Ja(s))+"</span>"+(Number(t.rankXp)>0?'<span class="rxp">+'+Ja(t.rankXp)+" Rank XP</span>":"")+'<span class="cost">'+jc+"<b>"+Number(t.vigor)+"</b></span></div></button>"}var Po={root:"Materials",asc:"Ascension Materials",form:"Tenet Trial"};function Za(t){return'<div class="head"><button class="back" type="button" data-farm-back>&#9664; '+(t==="root"?"Battle":"Materials")+'</button><div class="head-id"><div class="eyebrow">'+(t==="root"?"Mode":"Materials")+"</div><h2>"+(Po[t]||Po.asc)+"</h2></div></div>"}function Qa(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="materials">'+t+"</section></div>"}function Do({view:t="root",data:e=null,state:a="ready"}={}){if(a!=="ready"||!e)return Qa(Za(t)+'<div class="body"><div class="board solo"><section class="plate"><div class="p-id"><span class="name">'+(a==="error"?"Unavailable":"Loading&hellip;")+'</span><span class="blurb">'+(a==="error"?"Couldn&rsquo;t read the farm.":"Reading what is open today&hellip;")+"</span></div></section></div></div>");let r=Number(e.vigor)||0,s=Array.isArray(e.days)?e.days:[],o=Number(e.today)||0;if(t==="root"){let m=Array.isArray(e.families)?e.families:[],v=m.slice(0,3),b=Array.isArray(e.formFamilies)?e.formFamilies:[],w=b.slice(0,3),c=Array.isArray(e.locked)?e.locked:[],y=T=>c.includes(T),E='<div class="p-soon">Soon</div>';return Qa(Za("root")+'<div class="body"><div class="board"><section class="plate">'+St.funds+'<div class="p-id"><div class="kicker">Currency</div><span class="name">Funds</span><button class="p-help" type="button" aria-label="What Funds is">?</button></div><span class="p-tip">The toll every level and every ascension charges.</span>'+(y("funds")?E:'<div class="tcards col">'+(e.stages.funds||[]).map(T=>sa(T,r,'data-farm-run="funds" data-diff="'+T.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+St.xp+'<div class="p-id"><div class="kicker">Levelling</div><span class="name">XP Materials</span><button class="p-help" type="button" aria-label="What XP Materials is">?</button></div><span class="p-tip">Insight, in its three denominations. Feeds any unit.</span>'+(y("xp")?E:'<div class="tcards col">'+(e.stages.xp||[]).map(T=>sa(T,r,'data-farm-run="xp" data-diff="'+T.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+St.relic+'<div class="p-id"><div class="kicker">Gear</div><span class="name">Relic Vault</span><button class="p-help" type="button" aria-label="What Relic Vault is">?</button></div><span class="p-tip">One piece per run, whatever the difficulty. What rises is the rarity.</span>'+(y("relic")?E:'<div class="tcards col">'+(e.stages.relic||[]).map(T=>sa(T,r,'data-farm-run="relic" data-diff="'+T.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+St.form+'<div class="p-id"><div class="kicker">Abilities</div><span class="name">Tenet Trial</span><button class="p-help" type="button" aria-label="What Tenet Trial is">?</button></div><span class="p-tip">Trains a unit&rsquo;s abilities. Tenets by affinity, six families, on rotation.</span>'+(y("form")?E:'<div class="p-open"><div class="k">Open today &middot; '+u((s[o]||{}).day||"")+'</div><div class="fcards">'+w.map((T,R)=>'<button class="fcard" type="button" data-farm-open="form"><span class="n">'+u(T.name)+'</span><span class="m">'+u(T.matches)+"</span>"+(R===w.length-1&&b.length>w.length?'<span class="more">+'+(b.length-w.length)+" more open today</span>":"")+"</button>").join("")+'</div><button class="cta" type="button" data-farm-open="form"><span>Open rotation</span><span>&#9654;</span></button></div>')+'</section><section class="plate">'+St.asc+'<div class="p-id"><div class="kicker">Ceilings</div><span class="name">Ascension Materials</span><button class="p-help" type="button" aria-label="What Ascension Materials is">?</button></div><span class="p-tip">Sigils by affinity, Doctrines by role. Eleven families, on rotation.</span><div class="p-open"><div class="k">Open today &middot; '+u((s[o]||{}).day||"")+'</div><div class="fcards">'+v.map((T,R)=>'<button class="fcard" type="button" data-farm-open="asc"><span class="n">'+u(T.name)+'</span><span class="m">'+u(T.matches)+"</span>"+(R===v.length-1&&m.length>v.length?'<span class="more">+'+(m.length-v.length)+" more open today</span>":"")+"</button>").join("")+'</div><button class="cta" type="button" data-farm-open="asc"><span>Open rotation</span><span>&#9654;</span></button></div></section></div></div>')}let i=t==="form",n=i?"form":"asc",l=Array.isArray(i?e.formFamilies:e.families)?i?e.formFamilies:e.families:[],d=Array.isArray(e.helped)?e.helped:[],h=Array.isArray(e.missed)?e.missed:[],f=l.some(m=>(m.rows||[]).some(v=>Number(v.vigor)>r));return Qa(Za(n)+'<div class="detail"><div class="rota"><div class="rota-lab">Rotation</div><div class="rota-days">'+s.map((m,v)=>'<button class="day'+(v===o?" on":"")+(m.all?" all":"")+'" type="button" disabled>'+u(m.day)+"</button>").join("")+'</div></div><div class="rota-note">Sunday opens every family.</div><div class="fams-grid" style="--cols:1">'+l.map(m=>'<article class="fam-card"><div class="fam-id"><span class="n">'+u(m.name)+'</span><span class="m">'+u(m.matches)+'</span></div><div class="tcards row">'+(m.rows||[]).map(v=>sa(v,r,'data-farm-run="'+n+'" data-diff="'+v.difficulty+'" data-family="'+u(m.id)+'"')).join("")+"</div></article>").join("")+"</div>"+(i?'<div class="band" style="--bcols:1"><div class="bnd-cell"><span class="k">What Tenets buy</span><span class="t">A unit trains with the Tenet of <b>its own affinity</b>, so what is open today decides <b>who</b> you can train.</span></div></div>':'<div class="band" style="--bcols:2"><div class="bnd-cell"><span class="k">Open today helps</span>'+(d.length?'<div class="who">'+d.map(m=>'<span class="u">'+u(m.name)+(m.maxed?"<i>fully ascended</i>":"<i>A"+Number(m.at)+" &rarr; cap "+Number(m.to)+"</i>")+"</span>").join("")+"</div>":'<span class="t">Nothing you own uses today&rsquo;s families. <em>Come back tomorrow, or Sunday.</em></span>')+'</div><div class="bnd-cell"><span class="k">Not today</span>'+(h.length?'<span class="t"><b>'+h.length+"</b> more of your units wait on families that are closed: "+h.map(m=>u(m)).join(", ")+".</span>":'<span class="t">Every unit you own is covered by what is open.</span>')+"</div></div>")+(f?'<div class="band-note">Vigor regenerates one point every '+Math.round((Number(e.vigorPerMs)||18e4)/6e4)+" minutes, up to "+(Number(e.vigorMax)||60)+".</div>":"")+"</div>")}function qo(t,{onBack:e,onOpen:a,onRun:r}){let s=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);s.length||s.push(t);let o=i=>{let n=i&&i.target&&i.target.closest?i.target:null;if(!n)return;if(n.closest("[data-farm-back]")){e&&e();return}let l=n.closest("[data-farm-open]");if(l){a&&a(l.getAttribute("data-farm-open")||"asc");return}let d=n.closest("[data-farm-run]");d&&!d.disabled&&r&&r({stage:d.getAttribute("data-farm-run"),difficulty:Number(d.getAttribute("data-diff"))||0,family:d.getAttribute("data-family")||""})};for(let i of s)i.addEventListener("click",o)}function er(t){return(Number(t)||0).toLocaleString("en-US")}function Uc(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var lt=`
/* The card does NOT declare its own flex: it carried a 31% basis from the Inventory, where that is
   WIDTH inside a horizontal split; mounted in a column the same 31% becomes HEIGHT and the card is
   crushed -- measured, 114px of overflow. Whoever mounts a shared component decides its size. */
.detail { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.45); padding: var(--sp-2); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark); --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius); backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.detail.r5 { border-top-color: var(--amber); }
.d-head { flex: none; display: flex; align-items: center; gap: var(--sp-2); }
.d-art { flex: none; width: calc(var(--f) * 3); color: var(--amber); }
.d-art svg { width: 100%; height: auto; display: block; }
.d-id { min-width: 0; }
.d-id .n { display: block; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
.d-id .m { display: block; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.d-id .m em { font-style: normal; color: var(--amber); }
.d-main { flex: none; display: flex; flex-direction: column; gap: calc(var(--f) * 0.1); padding: calc(var(--f) * 0.45) calc(var(--f) * 0.6); background: var(--ink-3); --cut: 0.4em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.d-main .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
.d-main .v { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); line-height: 1.05; letter-spacing: var(--track); color: var(--text); }
/* BOTH figures, always: only the final number says it is already there, only today's hides what
   upgrading buys. */
.d-main .m { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); color: color-mix(in srgb, var(--jade) 78%, var(--text)); }
/* WHATEVER GIVES MUST CLIP, OR WHAT GIVES SPILLS OVER ITS NEIGHBOUR. This list is the card's only
   elastic item, so it shrinks when the projection block appears -- but with no overflow declared,
   shrinking clips nothing: the four rows keep drawing outside their box, ON TOP of the plan. Both
   are inside the card, so neither overflow nor clip-path fires; overlapping siblings is the third
   question a measurement has to ask.
   auto and not hidden: a CONTAINED scroll is allowed, so all four subs stay reachable. */
.d-subs { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: calc(var(--f) * 0.2); }
.d-subs .h { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
.d-sub { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-1); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; padding-bottom: calc(var(--f) * 0.15); border-bottom: 1px solid var(--ink-3); }
.d-sub .k { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--porcelain-3); }
.d-sub .v { flex: none; color: var(--text); font-variant-numeric: tabular-nums; }
/* A sub that a reinforcement has already touched: the screen has to say WHICH one grew, or the
   number moved for no reason the player can see. */
.d-sub.grew .v { color: var(--jade); }
.d-sub.grew .k::after { content: " +"; color: var(--jade); }
/* The sub that has not been revealed yet. Dashed and dimmed so it reads as a SLOT rather than
   as a stat with a strange name: the row has to say "there is more coming", never "this piece
   rolled badly". Same ink as a locked control everywhere else on the screen. */
.d-sub.locked { border-bottom-style: dashed; }
.d-sub.locked .k { color: var(--steel-faint); letter-spacing: 0.18em; text-transform: var(--case); }
.d-sub.locked .v { color: var(--steel-faint); }
.d-worn { flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); }
.d-worn b { color: var(--jade); }
.d-acts { flex: none; display: flex; gap: calc(var(--f) * 0.4); }
.d-acts button { flex: 1 1 auto; cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.45) var(--sp-1); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.d-acts button:hover { background: var(--coral-deep); border-color: var(--coral-deep); }
.d-acts button.ghost { flex: 0 0 auto; background: transparent; border-color: var(--steel-dark); color: var(--text); }
.d-acts button.ghost:hover { border-color: var(--amber); color: var(--amber); }
.d-acts button[disabled] { cursor: default; opacity: 0.5; }
.d-cost { flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.04em; line-height: 1.35; color: var(--steel-faint); }
.d-cost b { color: var(--text); }
.d-none { flex: 1 1 auto; display: flex; align-items: center; font-family: var(--display); font-size: var(--t-xs); line-height: 1.5; color: var(--steel-faint); }

`;function ct(t,{gained:e=[],actions:a=!0,projection:r=null}={}){if(!t)return'<aside class="detail"><div class="d-none">Pick a piece to see its four sub-stats, what it gives now and what it gives at its cap.</div></aside>';let s=Number(t.rarity)||3,o=new Set((e||[]).map(v=>String(v.key))),i=t.main||null,n=Number(t.levelCap)||0,l=Number(t.level)||0,d=l>=n,h=Array.isArray(t.subs)?t.subs:[],f=Math.max(0,Number(t.subsPending)||0),m=Number(t.nextSubAt)||0;return'<aside class="detail r'+s+'"><div class="d-head"><span class="d-art">'+bt(t.slot)+'</span><span class="d-id"><span class="n">'+u(yt(t.slot))+'</span><span class="m"><em>'+Uc(s)+"</em> &middot; Lv "+l+" / "+n+"</span></span></div>"+(i?'<div class="d-main"><span class="k">'+u(i.label||i.key)+'</span><span class="v">'+fe(i.key,i.value)+'</span><span class="m">'+(Number(i.valueMax)>Number(i.value)?"&rarr; "+fe(i.key,i.valueMax)+" at cap":"at cap")+"</span></div>":"")+'<div class="d-subs"><span class="h">Sub-stats &middot; '+(f>0?h.length+" of "+(h.length+f):String(h.length))+"</span>"+h.map(v=>'<div class="d-sub'+(o.has(String(v.key))?" grew":"")+'"><span class="k">'+u(v.label||v.key)+'</span><span class="v">'+fe(v.key,v.value)+"</span></div>").join("")+(f>0?'<div class="d-sub locked"><span class="k">Locked</span><span class="v">'+(m?"Lv "+m:"&mdash;")+"</span></div>":"")+'</div><div class="d-worn">'+(t.wornBy?"Worn by <b>"+u(t.wornBy)+"</b>":"Not equipped")+"</div>"+(r?'<div class="d-proj"><span class="big">Lv '+r.from+" &rarr; "+r.to+"</span><span>Eats <b>"+r.picked+"</b> "+(r.picked===1?"piece":"pieces")+" and <b>"+er(r.funds)+"</b> Funds"+(r.short?' &mdash; <span class="short">you hold '+er(r.have)+"</span>":"")+".</span><span>"+(r.ticks?"Reinforces <b>"+r.ticks+"</b> sub-stat"+(r.ticks===1?"":"s")+", picked at random.":"No sub-stat is reinforced yet &mdash; the next one lands at <b>Lv "+r.nextTick+"</b>.")+"</span></div>":"")+(a&&r?'<div class="d-acts"><button type="button" data-inv-feed-go'+(!r.picked||r.short?" disabled":"")+'>Feed</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></div>':a?'<div class="d-acts"><button type="button" data-inv-upgrade="'+u(t.id)+'"'+(d?" disabled":"")+">"+(d?"At its cap":"Upgrade")+'</button><button class="ghost" type="button" data-inv-lock="'+u(t.id)+'">'+(t.locked?"Unlock":"Lock")+'</button></div><div class="d-cost">'+(d?"Fully reinforced &mdash; <b>"+h.length+"</b> sub-stats at their rolled ceiling.":"One level eats <b>1</b> spare relic and <b>"+er(t.feedCost)+"</b> Funds. A sub is reinforced every <b>"+(Number(t.tickEvery)||3)+"</b> levels.")+"</div>":"")+"</aside>"}var oa=[{id:"key",label:"Key Items",live:!0},{id:"outfit",label:"Outfits",live:!0,unlock:"outfits"}];var ia=[{id:"vigor-s",cat:"key",name:"Vigor Draught",grants:{vigor:20},price:8,live:!0,bag:!0},{id:"vigor-m",cat:"key",name:"Vigor Flask",grants:{vigor:40},price:14,live:!0,bag:!0},{id:"vigor-l",cat:"key",name:"Vigor Decanter",grants:{vigor:60},price:20,live:!0,bag:!0},{id:"coupon",cat:"key",name:"Summon Coupon",grants:{summon:1},live:!1,note:"Not open yet"},{id:"solvent",cat:"key",name:"Relic Solvent",grants:{reroll:1},live:!1,note:"Not open yet"}];function na(t){let e=t&&t.grants||{};return e.vigor?"+"+e.vigor+" Vigor":e.summon?"One free summon":e.reroll?"Reroll a relic's substats":e.outfit?"A new look for your cast":""}function $o(t){return!t||t.live===!1?null:Math.max(1,Math.round(Number(t.price)||0))}var tr=t=>ia.filter(e=>e.cat===t),la=ia.filter(t=>t.bag===!0);function Ge(t){return(Number(t)||0).toLocaleString("en-US")}function jo(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var ar=[{key:"relics",label:"Relics",kicker:"Gear",live:!0,count:"relics",blurb:"Every piece you hold, worn or spare."},{key:"materials",label:"Materials",kicker:"Stock",live:!0,count:"materials",blurb:"Insight, ascension families and your currencies."},{key:"keyitems",label:"Key Items",kicker:"Bag",live:!0,count:"keyItems",blurb:"What you bought and have not spent yet."}],Vo=lt+`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;

  /* The SHARED type ramp, never a private one: a per-screen ramp drifts silently, the same
     class of bug as a copied colour token. */





  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) and the :has() row, never "auto 1fr": hoistHeadIntoBar REMOVES the .head and a
   screen with two fixed rows drops its only child into the AUTO row, sizing it to its content. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }



.body { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
/* hoistHeadIntoBar removes the .head and the top padding leaves with it, so the content lands
   against the bar. Restored under :not(:has(> .head)) so it never doubles up. */
.screen:not(:has(> .head)) .body { padding-top: var(--sp-2); }
.cols { flex: 1 1 auto; min-height: 0; display: flex; gap: var(--sp-2); }

/* \u2500\u2500 The rail of categories \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rail { flex: 0 0 15%; min-width: calc(var(--f) * 8); display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); }
.sect { min-width: 0; cursor: pointer; text-align: left; font-family: var(--display); display: flex; flex-direction: column; gap: calc(var(--f) * 0.1); padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); color: var(--text); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease; }
.sect:hover:not([disabled]) { border-color: var(--coral); border-left-color: var(--coral); }
.sect[aria-pressed="true"] { border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 10%); }
.sect[disabled] { cursor: default; opacity: 0.5; }
.sect .k { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.sect .n { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.4); font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); letter-spacing: var(--track); text-transform: var(--case); }
.sect .n i { font-style: normal; font-family: var(--display); font-size: var(--t-xs); color: var(--amber); font-variant-numeric: tabular-nums; }
.sect[disabled] .n i { color: var(--steel-faint); }
/* A locked row has to say WHY, like every other dead control in this package. */
.sect .soon { font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }

/* \u2500\u2500 The pane \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pane { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); }
.tools { flex: none; display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.fgroup { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); }
.fgroup .lbl { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); margin-right: calc(var(--f) * 0.2); }
.chip { cursor: pointer; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.25) calc(var(--f) * 0.6); background: var(--ink-3); border: 1px solid transparent; color: var(--steel-faint); --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.chip:hover { color: var(--text); border-color: var(--coral); }
.chip[aria-pressed="true"] { background: var(--coral); color: var(--on-coral); }
.tools .tally { margin-left: auto; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }

/* The split: the grid, and the piece the player picked. The detail is NOT a modal \u2014 a modal would
   hide the grid the player is comparing against, which is the whole job of this screen. */
.split { flex: 1 1 auto; min-height: 0; display: flex; gap: var(--sp-2); }
/* The sheet width is set by THIS screen, not by the component: see the note in relic-card.js. */
.split > .detail { flex: 0 0 31%; }
.grid-wrap { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: calc(var(--f) * 0.3); }
/* A contained scroll is allowed by the rule; the SCREEN still does not scroll. */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 7.2), 1fr)); gap: calc(var(--f) * 0.5); align-content: start; }

/* \u2500\u2500 One relic tile. Cards, not rows: at row height a glyph is a smudge. \u2500\u2500\u2500 */
.tile { min-width: 0; cursor: pointer; text-align: left; font-family: var(--display); position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.15); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.4); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark); color: var(--text); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease); }
.tile:hover { transform: translateY(-1px); border-color: var(--coral); }
.tile[aria-pressed="true"] { border-top-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 10%); }
/* --amber and --epic are the SAME tokens Formation paints five and four stars with. An invented
   token does not fail: it falls to the fallback silently and the tiers stop reading apart. */
.tile.r5 { border-top-color: var(--amber); }
.tile.r4 { border-top-color: var(--epic); }
.tile .art { width: 52%; max-width: calc(var(--f) * 2.6); color: var(--steel); opacity: 0.85; }
.tile .art svg { width: 100%; height: auto; display: block; }
.tile.r5 .art { color: var(--amber); opacity: 1; }
.tile.r4 .art { color: color-mix(in srgb, var(--epic) 65%, var(--steel)); opacity: 1; }
.tile .st { font-size: var(--t-tiny); letter-spacing: 0.08em; color: var(--amber); line-height: 1; }
.tile .fig { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-sm); letter-spacing: var(--track); color: var(--text); }
.tile .lv { font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
/* Worn and locked are the two states that change what the player may DO with a piece, so they are
   on the tile and not only in the detail: otherwise picking food means opening every one. */
.tile .flags { position: absolute; top: calc(var(--f) * 0.25); right: calc(var(--f) * 0.3); display: flex; gap: calc(var(--f) * 0.2); font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); }
.tile .flags .worn { color: var(--jade); }
.tile .flags .lock { color: var(--amber); }
.grid-empty { grid-column: 1 / -1; font-family: var(--display); font-size: var(--t-xs); line-height: 1.5; color: var(--steel-faint); padding: var(--sp-2); }
.grid-empty b { color: var(--text); }

/* \u2500\u2500 Materials \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.mats { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); }
.mrow { flex: none; }
.mrow .h { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); margin-bottom: calc(var(--f) * 0.25); }
.mcards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: calc(var(--f) * 0.5); }
.mcard { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.05); padding: calc(var(--f) * 0.45) calc(var(--f) * 0.7); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); --cut: 0.45em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.mcard.has { border-left-color: var(--amber); }
.mcard .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; color: var(--porcelain-3); }
.mcard .q { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); line-height: 1.1; letter-spacing: var(--track); color: var(--text); font-variant-numeric: tabular-nums; }
.mcard.none .q { color: var(--steel-faint); }
/* What it is WORTH in the unit the rest of the game already uses, so two piles are comparable. */
.mcard .w { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); color: var(--jade); }
.mcard.none .w { color: var(--steel-faint); }

/* The families: the name BESIDE its three tiers, never above. Stacked, every row needs a header
   plus a card and eleven families squeeze the cards to slivers -- measured, in Materials. */
/* TWO columns: in one, the eleven families overflow the cut on the day all of them open, and the
   pane has twice the width the rows need. Pay with the free dimension, never the scarce one. */
.fams { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: calc(var(--f) * 0.3); padding-right: calc(var(--f) * 0.3); }
.fam { flex: none; min-width: 0; display: flex; align-items: center; gap: var(--sp-2); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); padding: calc(var(--f) * 0.35) calc(var(--f) * 0.6); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.fam.has { border-left-color: var(--amber); }
.fam-id { flex: 0 0 26%; min-width: 0; }
.fam-id .n { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.fam-id .m { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.fam-t { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: calc(var(--f) * 0.35); }
.tpill { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.2) calc(var(--f) * 0.45); background: var(--ink-3); color: var(--steel-faint); --cut: 0.35em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.tpill b { font-family: var(--title); font-size: var(--t-xs); color: var(--text); font-variant-numeric: tabular-nums; }
.tpill.none b { color: var(--steel-faint); }
.fam-w { flex: 0 0 18%; min-width: 0; text-align: right; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.08em; text-transform: var(--case); color: var(--jade); font-variant-numeric: tabular-nums; }
.fam.none .fam-w { color: var(--steel-faint); }

/* \u2500\u2500 Upgrading, in the pane the screen already has \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* No second view and no modal: feeding is picking pieces out of the inventory, and the inventory
   is already on screen WITH its filters. The Gear tab needs its own picker because a unit's sheet
   only ever shows the four slots; here the grid IS the picker, so the mode only changes what a tile
   MEANS (food or not) and what the detail SAYS (the projection). Same "two views of one screen" that
   Materials uses for its rotation. */
.tile.food { border-top-color: var(--jade); background: color-mix(in srgb, var(--ink-3) 70%, var(--jade) 12%); }
.tile.target { border-top-color: var(--coral); box-shadow: inset 0 0 0 1px var(--coral); }
/* A tile that cannot be eaten says so by going quiet AND by keeping its flag: worn and locked are
   the two reasons, and both are already drawn in the corner. */
.tile[disabled] { cursor: default; opacity: 0.34; }
.feedbar { flex: none; display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; color: var(--porcelain-3); padding: calc(var(--f) * 0.35) calc(var(--f) * 0.6); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border-left: 2px solid var(--coral); --cut: 0.45em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.feedbar b { color: var(--text); font-variant-numeric: tabular-nums; }
.feedbar .short { color: var(--alarm); }
.feedbar .sp { margin-left: auto; display: flex; gap: calc(var(--f) * 0.4); }
.feedbar button { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.35) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.feedbar button.ghost { background: transparent; border-color: var(--steel-dark); color: var(--text); }
.feedbar button[disabled] { cursor: default; opacity: 0.5; }
/* The projection: where the piece LANDS, never just where it started. Same rule as the Insight feed
   in Growth, and as a weapon printing both of its figures. */
.d-proj { flex: none; display: flex; flex-direction: column; gap: calc(var(--f) * 0.1); padding: calc(var(--f) * 0.4) calc(var(--f) * 0.6); background: color-mix(in srgb, var(--ink-3) 70%, var(--jade) 10%); --cut: 0.4em; clip-path: var(--clip-card); border-radius: var(--radius-sm); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.04em; line-height: 1.4; color: var(--porcelain-3); }
.d-proj b { color: var(--text); font-variant-numeric: tabular-nums; }
.d-proj .big { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); letter-spacing: var(--track); color: var(--text); }
/* \u2500\u2500 KEY ITEMS: the bag \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Cards, not rows: at row height a count and a button read as a form, not as a bag. And the grid
   is auto-fill with a minimum so a bag of two does not stretch two cards across the stage. */
.ki-grid { min-width: 0; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 12), 1fr)); align-content: start; gap: var(--sp-2); }
.ki-card { display: grid; justify-items: center; gap: calc(var(--f) * 0.3); padding: var(--sp-2) var(--sp-1); background: var(--ink); border: 1px solid var(--ink-3); border-top: 2px solid var(--coral); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.ki-n { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--coral); }
.ki-name { min-width: 0; max-width: 100%; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.03em; text-transform: var(--case); color: var(--text); text-align: center; overflow-wrap: anywhere; }
.ki-what { min-width: 0; max-width: 100%; font-size: var(--t-tiny); color: var(--steel-faint); text-align: center; overflow-wrap: anywhere; }
.ki-use { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.ki-use:hover { background: var(--coral-deep); border-color: var(--coral-deep); }

`;function Go(t,e){return t.id===e?"itself":t.wornBy?"worn":t.locked?"locked":""}function Wc(t,e,a){let r=Number(t.rarity)||3,s=t.id===e,o=(t.wornBy?'<span class="worn" title="Worn">&#9679;</span>':"")+(t.locked?'<span class="lock">&#128274;</span>':"");if(a){let i=Go(t,a.targetId),n=t.id===a.targetId,l=a.picked.indexOf(t.id)>=0,d=!l&&a.picked.length>=a.room,h=!!i||d;return'<button class="tile r'+r+(l?" food":"")+(n?" target":"")+'" type="button"'+(h?" disabled":"")+' title="'+(n?"The piece being fed":i==="worn"?"Worn by "+u(t.wornBy):i==="locked"?"Locked":d?"Already at its cap with what is picked":"Feed this")+'"'+(h?"":' data-inv-feed-pick="'+u(t.id)+'"')+">"+(o?'<span class="flags">'+o+"</span>":"")+'<span class="art">'+bt(t.slot)+'</span><span class="st">'+jo(r)+'</span><span class="fig">'+(t.main?fe(t.main.key,t.main.value):"&mdash;")+'</span><span class="lv">'+(n?"Feeding this":l?"Picked":u(yt(t.slot)))+"</span></button>"}return'<button class="tile r'+r+'" type="button" aria-pressed="'+(s?"true":"false")+'" data-inv-pick="'+u(t.id)+'">'+(o?'<span class="flags">'+o+"</span>":"")+'<span class="art">'+bt(t.slot)+'</span><span class="st">'+jo(r)+'</span><span class="fig">'+(t.main?fe(t.main.key,t.main.value):"&mdash;")+'</span><span class="lv">'+u(yt(t.slot))+" &middot; Lv "+(Number(t.level)||0)+"</span></button>"}function Vc(t,e,a){let r=Number(t.levelCap)||0,s=Number(t.level)||0,o=Math.max(0,r-s),i=Math.min(e.length,o),n=s+i,l=(Number(t.feedCost)||0)*i,d=Number(t.tickEvery)||3;return{from:s,to:n,room:o,picked:i,funds:l,have:Number(a)||0,short:l>(Number(a)||0),ticks:$a(t.rarity,n)-$a(t.rarity,s),nextTick:(Math.floor(s/d)+1)*d}}function Gc(t,e){let a=Array.isArray(t.relics)?t.relics:[],r=e.slot||"all",s=e.rarity||"all",o=a.filter(c=>(r==="all"||c.slot===r)&&(s==="all"||String(c.rarity)===String(s))),i=e.feeding&&e.feeding.targetId?{targetId:e.feeding.targetId,picked:Array.isArray(e.feeding.picked)?e.feeding.picked:[]}:null,n=i&&a.find(c=>c.id===i.targetId)||null,l=n?Math.max(0,(Number(n.levelCap)||0)-(Number(n.level)||0)):0,d=n?{targetId:n.id,picked:i.picked.slice(0,l),room:l}:null,h=n||o.find(c=>c.id===e.picked)||o[0]||null,f=n?Vc(n,d.picked,t.wallet&&t.wallet.funds):null,m=[["all","All"],["core","Core"],["edge","Edge"],["flow","Flow"],["crest","Crest"]],v=[["all","All"],["5","5&#9733;"],["4","4&#9733;"],["3","3&#9733;"]],b=(c,y,E)=>y.map(([T,R])=>'<button class="chip" type="button" aria-pressed="'+(String(T)===String(E)?"true":"false")+'" data-inv-filter="'+c+'" data-value="'+T+'">'+R+"</button>").join(""),w=a.filter(c=>!Go(c,d?d.targetId:"")).length;return(d?'<div class="feedbar">Pick what to feed &mdash; each piece is <b>1</b> level and <b>'+Ge(n?n.feedCost:0)+"</b> Funds. Room for <b>"+(f.room-f.picked)+"</b> more, <b>"+w+'</b> spare in your stock.<span class="sp"><button type="button" data-inv-feed-go'+(!f.picked||f.short?" disabled":"")+">Feed "+f.picked+'</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></span></div>':"")+'<div class="tools"><span class="fgroup"><span class="lbl">Slot</span>'+b("slot",m,r)+'</span><span class="fgroup"><span class="lbl">Rarity</span>'+b("rarity",v,s)+'</span><span class="tally">'+o.length+" of "+a.length+' shown</span></div><div class="split"><div class="grid-wrap"><div class="grid">'+(o.length?o.map(c=>Wc(c,h?h.id:"",d)).join(""):'<div class="grid-empty">'+(a.length?"Nothing matches this filter.":"You hold no relics yet &mdash; they drop from the <b>Relic Vault</b> stage in Materials, one piece per run.")+"</div>")+"</div></div>"+ct(h,{gained:e.gained||[],projection:f})+"</div>"}function Yc(t){let e=t.materials||{},a=Array.isArray(e.insight)?e.insight:[],r=Array.isArray(e.families)?e.families:[];return'<div class="mats"><div class="mrow"><div class="h">Insight &middot; levelling</div><div class="mcards">'+a.map(s=>'<div class="mcard'+(Number(s.qty)?" has":" none")+'"><span class="n">'+u(s.name)+'</span><span class="q">'+Ge(s.qty)+'</span><span class="w">'+Ge(Number(s.qty)*Number(s.xp))+" XP held</span></div>").join("")+'</div></div><div class="mrow" style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column"><div class="h">Ascension &middot; '+r.length+' families</div><div class="fams">'+r.map(s=>'<div class="fam'+((s.tiers||[]).some(i=>Number(i.qty)>0)?" has":" none")+'"><div class="fam-id"><span class="n">'+u(s.name)+'</span><span class="m">'+u(s.matches)+'</span></div><div class="fam-t">'+(s.tiers||[]).map(i=>'<span class="tpill'+(Number(i.qty)?"":" none")+'">'+u(i.tier)+"<b>"+Ge(i.qty)+"</b></span>").join("")+'</div><div class="fam-w">'+Ge(s.asTierI)+" &times; T1</div></div>").join("")+"</div></div></div>"}function Uo(t){return'<div class="head"><button class="back" type="button" data-inv-back>&#9664; Home</button><div class="head-id"><div class="eyebrow">Your world</div><h2>'+u(t)+"</h2></div></div>"}function Wo(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="inventory">'+t+"</section></div>"}function Kc(t){let e=t&&t.keyItems||{},a=la.filter(r=>Number(e[r.id])>0);return a.length?'<div class="ki-grid">'+a.map(r=>'<div class="ki-card"><span class="ki-n">&times;'+Ge(Number(e[r.id])||0)+'</span><b class="ki-name">'+u(r.name)+'</b><span class="ki-what">'+u(na(r))+'</span><button class="ki-use" type="button" data-inv-use="'+u(r.id)+'">Use</button></div>').join("")+"</div>":'<div class="grid-empty">Nothing in the bag. Vigor items are sold in the Shop.</div>'}function Yo({section:t="relics",data:e=null,view:a={},state:r="ready"}={}){if(r!=="ready"||!e)return Wo(Uo("Inventory")+'<div class="body"><div class="cols"><div class="pane"><div class="grid-empty">'+(r==="error"?"Couldn&rsquo;t read your inventory.":"Reading what you hold&hellip;")+"</div></div></div></div>");let s=e.counts||{},o=ar.filter(h=>h.live),i=o.find(h=>h.key===t)||o[0]||ar[0],n=e.relicBand||{},l=e.materials&&e.materials.ascension||{},d='<div class="rail">'+ar.map(h=>'<button class="sect" type="button"'+(h.live?' aria-pressed="'+(h.key===i.key?"true":"false")+'" data-inv-section="'+h.key+'"':" disabled")+'><span class="k">'+u(h.kicker)+'</span><span class="n">'+u(h.label)+"<i>"+(h.live?Ge(s[h.count]):"&mdash;")+"</i></span>"+(h.live?"":'<span class="soon">Not open yet</span>')+"</button>").join("")+"</div>";return Wo(Uo("Inventory")+'<div class="body"><div class="cols">'+d+'<div class="pane">'+(i.key==="relics"?Gc(e,a):i.key==="keyitems"?Kc(e):Yc(e))+"</div></div></div>")}function Ko(t,{onBack:e,onSection:a,onFilter:r,onPick:s,onLock:o,onUpgrade:i,onFeedPick:n,onFeedGo:l,onFeedCancel:d,onUseItem:h}){let f=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);f.length||f.push(t);let m=v=>{let b=v&&v.target&&v.target.closest?v.target:null;if(!b)return;if(b.closest("[data-inv-feed-go]")){!b.closest("[data-inv-feed-go]").disabled&&l&&l();return}if(b.closest("[data-inv-feed-cancel]")){d&&d();return}let w=b.closest("[data-inv-feed-pick]");if(w){!w.disabled&&n&&n(w.getAttribute("data-inv-feed-pick"));return}if(b.closest("[data-inv-back]")){e&&e();return}let c=b.closest("[data-inv-section]");if(c){a&&a(c.getAttribute("data-inv-section"));return}let y=b.closest("[data-inv-use]");if(y){h&&h(y.getAttribute("data-inv-use"));return}let E=b.closest("[data-inv-filter]");if(E){r&&r(E.getAttribute("data-inv-filter"),E.getAttribute("data-value"));return}let T=b.closest("[data-inv-lock]");if(T){o&&o(T.getAttribute("data-inv-lock"));return}let R=b.closest("[data-inv-upgrade]");if(R&&!R.disabled){i&&i(R.getAttribute("data-inv-upgrade"));return}let W=b.closest("[data-inv-pick]");W&&s&&s(W.getAttribute("data-inv-pick"))};for(let v of f)v.addEventListener("click",m)}var sr=[{id:"newworld",kind:"newworld",label:"Journey to a New World",note:"Your first 7 days",live:!0},{id:"login",kind:"login",label:"7 Day Login Event",note:"Permanent",live:!0},{id:"pass",kind:"pass",label:"Battle Pass",note:"Season \xB7 30 days",live:!0},{id:"seasonal",kind:"seasonal",label:"Seasonal Event",note:"Rotates with the banner",live:!0}];var Xc=7,ca=160,Xo=ca*10,bf=Array.from({length:Xc},(t,e)=>({day:e+1,aether:Xo,extra:{kind:"aether",qty:Xo,name:"Aether"}}));var Zo=30,yf=Zo*24*60*60*1e3,rr=80;var or={"farm-clear":{one:"Clear a Materials stage",many:"Clear N Materials stages"},"node-clear":{one:"Clear a combat node",many:"Clear N combat nodes"},"story-clear":{one:"Play a story node",many:"Play N story nodes"},summon:{one:"Summon once",many:"Summon N times"},"level-up":{one:"Level a unit once",many:"Level a unit N times"},"form-up":{one:"Train an ability once",many:"Train an ability N times"},ascend:{one:"Ascend a unit",many:"Ascend a unit N times"},"relic-feed":{one:"Reinforce a relic",many:"Reinforce a relic N times"},"vigor-spent":{one:"Spend 1 Vigor",many:"Spend N Vigor"}};function Qo(t){let e=or[t&&t.kind];if(!e)return"";let a=Math.max(1,Math.round(Number(t&&t.need)||1));return a===1?e.one:e.many.replace("N",String(a))}var Jc=5,Zc=1e3,Qc=[20,40,60,75],ed=t=>t<=26?{tier:"shard",qty:3,name:"Insight Shard"}:t<=53?{tier:"core",qty:2,name:"Insight Core"}:{tier:"prism",qty:1,name:"Insight Prism"},td=t=>t<=26?1:t<=53?2:3;var Jo=["funds","xp","sigil","doctrine","tenet"],ad=(()=>{let t=[],e={};for(let a=1;a<=rr;a+=1){let r=a%Jc===0?Zc:0;if(a===rr){t.push({level:a,aether:r,extra:{kind:"relic",qty:1,rarity:5,name:"5&#9733; Relic"},prize:!0});continue}if(Qc.includes(a)){t.push({level:a,aether:r,extra:{kind:"mandate",qty:1,name:"Mandate"},prize:!0});continue}if(r){t.push({level:a,aether:r,extra:{kind:"aether",qty:r,name:"Aether"}});continue}let s=Jo[t.filter(o=>!o.aether&&o.extra.kind!=="mandate").length%Jo.length];if(e[s]=(e[s]||0)+1,s==="funds")t.push({level:a,aether:r,extra:{kind:"funds",qty:8e3,name:"Funds"}});else if(s==="xp"){let o=ed(a);t.push({level:a,aether:r,extra:{kind:"xp",tier:o.tier,qty:o.qty,name:o.name}})}else{let o=s==="tenet"?2:4;t.push({level:a,aether:r,extra:{kind:s,qty:o,tier:td(a),pick:e[s]-1}})}}return t})(),Ye=[{difficulty:1,label:"Easy",vigor:6,coin:60,cp:2e4},{difficulty:2,label:"Normal",vigor:8,coin:90,cp:1e5},{difficulty:3,label:"Hard",vigor:10,coin:120,cp:2e5}];var da=40;var Et=10,Ie=(t,e,a,r,s,o=0,i=null)=>[{kind:"aether",qty:50,count:t},{kind:"funds",qty:3e3,count:e},...i?[{kind:"xp",...i,count:sd}]:[],{kind:"material",tier:2,qty:1,count:a},{kind:"material",tier:1,qty:1,count:r},...o?[{kind:"mandate",count:o}]:[],...s],rd=new Set([3,5,7]),_e=t=>rd.has(t)?1:0,sd=8,Ce=()=>3,Re=t=>4-_e(t),Le=t=>t<=4?{tier:"shard",qty:6,name:"Insight Shard"}:t<=8?{tier:"core",qty:3,name:"Insight Core"}:{tier:"prism",qty:1,name:"Insight Prism"},ei=[Ie(7,5,Ce(),Re(1),[{kind:"potion",id:"vigor-s",count:3}],_e(1),Le(1)),Ie(7,5,Ce(),Re(2),[{kind:"potion",id:"vigor-s",count:3}],_e(2),Le(2)),Ie(7,5,Ce(),Re(3),[{kind:"potion",id:"vigor-s",count:2},{kind:"potion",id:"vigor-m",count:1}],_e(3),Le(3)),Ie(7,5,Ce(),Re(4),[{kind:"potion",id:"vigor-s",count:2},{kind:"potion",id:"vigor-m",count:1}],_e(4),Le(4)),Ie(7,5,Ce(),Re(5),[{kind:"potion",id:"vigor-m",count:3}],_e(5),Le(5)),Ie(7,5,Ce(),Re(6),[{kind:"potion",id:"vigor-m",count:3}],_e(6),Le(6)),Ie(7,5,Ce(),Re(7),[{kind:"potion",id:"vigor-m",count:2},{kind:"potion",id:"vigor-l",count:1}],_e(7),Le(7)),Ie(7,5,Ce(),Re(8),[{kind:"potion",id:"vigor-m",count:2},{kind:"potion",id:"vigor-l",count:1}],_e(8),Le(8)),Ie(7,5,Ce(),Re(9),[{kind:"potion",id:"vigor-l",count:3}],_e(9),Le(9)),Ie(7,5,Ce(),Re(10),[{kind:"potion",id:"vigor-l",count:3}],_e(10),Le(10))];var od=ca*10,ir={summon:{title:"Summon unlocked",body:"Spend Aether to pull for new heroes and weapons.",gift:od,giftLabel:"Prologue complete reward"},events:{title:"Events unlocked",body:"Complete each event's objectives to earn its rewards."},featured:{title:"Featured banner unlocked",body:"A banner that changes every 14 days, with better odds on its rate-up units."},seasonal:{title:"Seasonal Event unlocked",body:"Your main source of Aether."}},id=[{id:"level",go:"roster",when:t=>t.leveled===0&&t.insightXp>=t.levelXpFirst,action:"Level up",detail:t=>nd(t.insightXp)+" XP held"},{id:"signature",go:"roster",when:t=>t.looseSignature>0,action:"Equip signature",detail:t=>t.looseSignatureName||"Not equipped"},{id:"formation",go:"formation",when:t=>t.unformed>0,action:"Fill your team",detail:t=>t.unformed+(t.unformed===1?" unit benched":" units benched")},{id:"farm",go:"modes",when:t=>t.farmed===0&&t.insightXp<t.levelXpFirst,action:"Farm Insight",detail:t=>t.farmQty+" x "+t.farmMaterial},{id:"ascend",go:"roster",when:t=>t.ascended===0&&t.atAscensionCap>0,action:"Ascend",detail:t=>t.cappedName?t.cappedName+" at Lv "+t.ascensionCap:"Capped at Lv "+t.ascensionCap}];function nd(t){return(Number(t)||0).toLocaleString("en-US")}function ti(t){let e=t&&typeof t=="object"?t:null;if(!e)return null;let a=ld(e);return a?{id:a.id,go:a.go,action:a.action,detail:a.detail(e)}:null}function ld(t){let e=t&&typeof t=="object"?t:null;if(!e)return null;let a=Array.isArray(e.done)?e.done:[];return id.find(r=>{if(a.includes(r.id))return!1;try{return!!r.when(e)}catch{return!1}})||null}function nr(t){return(Array.isArray(t)?t:[]).reduce((e,a)=>e+(Number(a.count)||0),0)}function At(t){return(Number(t)||0).toLocaleString("en-US")}var lr='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.2v7.6M9.6 10.4h4.8M9.6 13.6h4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',cd='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Tt=t=>Number(t)>1?At(t):"";function dd(t){let e=Number(t&&t.qty)||0;switch(t&&t.kind){case"aether":return{name:"Aether",amount:Tt(e),tone:"aether"};case"funds":return{name:"Funds",amount:Tt(e),tone:"funds"};case"material":return{name:t.name||"Tier "+(Number(t.tier)||1)+" material",amount:Tt(e),tone:"mat"};case"xp":return{name:(Tt(e)?Tt(e)+" ":"")+(t.name||"Insight"),amount:"",tone:"mat"};case"mandate":return{name:"Mandate",amount:"",tone:"prize"};case"potion":return{name:hd(t.id),amount:"",tone:"potion"};default:return{name:"Reward",amount:"",tone:""}}}function hd(t){return t==="vigor-l"?"Vigor Decanter":t==="vigor-m"?"Vigor Flask":"Vigor Draught"}function pd(t,e){let a=dd(t),r=e<=0;return'<div class="sv-tile'+(r?" gone":"")+" t-"+a.tone+'">'+(a.amount?'<span class="amt">'+u(a.amount)+"</span>":"")+'<span class="what">'+u(a.name)+"</span>"+(r?"":'<span class="left">&times;'+e+"</span>")+"</div>"}function fd(t,e){let a=Number(e)>=t.vigor;return'<button class="sv-fight" type="button" data-seasonal-fight="'+t.difficulty+'"'+(a?"":" disabled")+'><span class="lb">'+u(t.label)+'</span><span class="cost">'+cd+t.vigor+'</span><span class="pay">'+lr+t.coin+'</span><span class="cp">'+At(t.cp)+" CP</span></button>"}function ai(t){let e=String(t||"").toLowerCase();return e?e.charAt(0).toUpperCase()+e.slice(1):""}function ud(t,e){let a=ai(t);if(!a)return"";let r=ai(e);return'<span class="fig sv-aff"><b class="foe a-'+u(String(t).toLowerCase())+'">'+u(a)+'</b><span class="arrow">&rarr;</span><span class="bring">bring</span><b class="a-'+u(String(e||"").toLowerCase())+'">'+u(r)+"</b></span>"}function vd(t){let e=Array.isArray(t)?t.filter(Boolean):[];return e.length?'<div class="sv-got"><span class="k">Drew</span>'+e.map(a=>'<span class="g">'+(Number(a.qty)>1?"<b>"+At(a.qty)+"</b> ":"")+u(a.material||"")+"</span>").join("")+"</div>":""}function md(){let t=r=>'<b class="n">'+u(At(r))+"</b>",e=Ye.map(r=>u(r.label)+" "+t(r.coin)).join(", "),a=nr(ei[0]||[]);return[{k:"The coin",a:"Each fight pays event coin: "+e+"."},{k:"A draw",a:t(da)+" coin buys one draw."},{k:"No luck to it",a:"A box holds "+t(a)+" prizes and a draw TAKES ONE OUT. Empty it and you have had all of them."},{k:"The next box",a:"Emptying one opens the next. Box "+t(Et)+" refills forever, with a different material each round."},{k:"When it rotates",a:"It lasts as long as its banner. When that rotates, the box restarts and the coin resets."}]}function cr(){return'<div class="sv-modal" data-seasonal-help-modal><div class="sv-modal-veil" data-seasonal-help-close></div><div class="sv-modal-panel"><div class="sv-modal-top"><div class="sv-modal-id"><span class="kick">Seasonal</span><h3 class="sv-modal-title">How this works</h3></div><button class="sv-modal-x" type="button" data-seasonal-help-close>Close</button></div><div class="sv-modal-rule"></div>'+md().map(t=>'<div class="sv-modal-topic"><span class="k">'+u(t.k)+'</span><p class="a">'+t.a+"</p></div>").join("")+"</div></div>"}function ri(t){let e=t&&typeof t=="object"?t:{},a=Array.isArray(e.box)?e.box:[],r=Array.isArray(e.left)?e.left:a.map(b=>Number(b.count)||0),s=r.reduce((b,w)=>b+(Number(w)||0),0),o=nr(a),i=Math.max(0,Number(e.coin)||0),n=Math.max(0,Number(e.vigor)||0),l=Math.max(1,Math.min(Et,Number(e.boxIndex)||1)),d=l>=Et,h=i>=da&&s>0,f=typeof e.art=="string"&&!!e.art.trim(),m=!!e.help,v=o>0?Math.round((o-s)/o*100):0;return'<div class="ev-pane sv'+(f?"":" flat")+'"'+(f?' style="background-image:url('+u(e.art)+')"':"")+'><div class="sv-scrim"></div><button class="sv-q" type="button" data-seasonal-help aria-label="'+(m?"Close":"What is this event?")+'">'+(m?"&times;":"?")+'</button><div class="sv-hero"><div class="sv-id"><span class="kick">Seasonal</span><h3>'+u(e.label||"Seasonal Event")+'</h3></div><div class="sv-figs">'+ud(e.affinity,e.counter)+'<span class="fig"><b>'+At(i)+"</b>"+lr+"</span>"+(Number.isFinite(Number(e.endsInDays))?'<span class="fig dim">Ends in <b>'+Math.max(0,Math.round(Number(e.endsInDays)))+"</b>d</span>":"")+"</div></div>"+('<div class="sv-cols"><div class="sv-fights"><div class="sv-hd">Run a fight</div>'+Ye.map(b=>fd(b,n)).join("")+'<div class="sv-note">'+(d?"This box refills every time you empty it.":"Empty the box to open the next one.")+'</div></div><div class="sv-box"><div class="sv-hd"><span class="sv-box-n">'+(d?"Box "+l+" &middot; repeats":"Box "+l+" / "+Et)+'</span><span class="sv-prog"><span class="bar"><i style="width:'+v+'%"></i></span><b>'+s+"</b>/"+o+' left</span></div><div class="sv-grid">'+a.map((b,w)=>pd(b,Number(r[w])||0)).join("")+'</div><button class="sv-draw" type="button" data-seasonal-draw'+(h?"":" disabled")+">"+(s<=0?"Box empty":"Draw")+'<span class="c">'+lr+da+"</span></button>"+vd(e.gained)+"</div></div>")+"</div>"}function dr(t,e,a){let r=()=>{typeof a=="function"&&a()};if(!t||typeof t.querySelectorAll!="function")return r();let s=[...t.querySelectorAll(".sv-tile")],o=s[Number(e)];if(!s.length||!o)return r();let i=s.filter(m=>!m.classList.contains("gone")),n=i.length?i:s,l=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,d=l?0:gd,h=0,f=()=>{for(let m of s)m.classList.remove("spin");if(h<d){n[h%n.length].classList.add("spin"),h+=1,setTimeout(f,bd+h*yd);return}o.classList.add("spin","hit"),setTimeout(()=>{o.classList.remove("spin","hit"),r()},l?0:wd)};f()}var gd=11,bd=34,yd=4,wd=260,si=`
/* The pane already fills, already centres and already brings its own contained scroll --
   the only thing adjusted here is the gap. */
/* THE ART IS THE WHOLE PANEL (user's call), not a band across the top. cover, so a 1216x832
   painting fills the pane; everything else floats over it half see through. */
.ev-pane.sv { position: relative; gap: var(--sp-2); background-size: cover; background-position: center 22%; overflow: hidden; }
/* No art: the same panel with its own gradient, so the screen reads deliberate instead of broken. */
.ev-pane.sv.flat { background-image: linear-gradient(150deg, var(--ink-2), var(--ink-3)); }

/* THE VEIL over the WHOLE panel is what keeps every figure readable over ANY painting: art bright
   in one world and near-black in another is what a fixed text colour cannot survive. It thickens
   downward, where the two boxes sit. */
.sv-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 34%, transparent) 0%, color-mix(in srgb, var(--ink) 58%, transparent) 30%, color-mix(in srgb, var(--ink) 76%, transparent) 100%); }

/* The identity keeps its SHARE and stays LOW (user's call). No card, no border, no frame -- it
   holds the top share of the panel with the title at its BOTTOM edge, so the painting is what the
   eye lands on. A SHARE and not a fixed height, with a floor for a short window.
   48 and not 54 percent, MEASURED: at 1280x720 and 1100x620 the tile grid overflowed by 1-2px at
   54 and the scroll appeared. It clears at 50; 48 leaves margin. */
.sv-hero {
  position: relative; z-index: 1; flex: 0 0 48%; min-height: calc(var(--f) * 11);
  display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
}
/* THE WHOLE IDENTITY ROW CARRIES A DARK SHADOW (user's call). The veil handles a dark painting; a
   BRIGHT one it cannot, because the veil is a share of the ink and a white sky comes through pale.
   A shadow is per-glyph, so it works over any pixel instead of betting on the average.
   Two layers, edge and halo -- and the ICONS get the filter twin, or the coin floats unbacked. */
.sv-id, .sv-figs { text-shadow: 0 1px 2px rgba(0,0,0,0.92), 0 0 12px rgba(0,0,0,0.65); }
.sv-figs svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.92)); }
.sv-id { position: relative; z-index: 2; min-width: 0; }
.sv-id .kick { display: block; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.sv-id h3 { margin: 0; min-width: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
.sv-figs { position: relative; z-index: 2; flex: none; display: flex; align-items: baseline; gap: var(--sp-3); }
.sv-figs .fig { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
.sv-figs .fig svg { width: var(--t-md); height: var(--t-md); flex: none; color: var(--amber); }
.sv-figs .fig.dim { color: var(--steel-faint); }

/* THE "?" -- the panel's own corner, over the art, because what it explains is the EVENT and not
   one of the two boxes. A toggle, so it turns into the cross that closes it. */
.sv-q { position: absolute; z-index: 3; top: calc(var(--f) * 0.4); right: calc(var(--f) * 0.4); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: calc(var(--f) * 1.7); height: calc(var(--f) * 1.7); padding: 0; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); line-height: 1; background: color-mix(in srgb, var(--ink) 68%, transparent); border: 1px solid color-mix(in srgb, var(--porcelain-3) 26%, transparent); border-radius: 50%; color: var(--text); text-shadow: 0 1px 2px rgba(0,0,0,0.92); }
.sv-q:hover { border-color: var(--coral); color: var(--coral); }
.sv-q:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--coral); }

/* THE BUBBLE opens OUT OF the button and covers what is under it -- it does NOT replace the two
   boxes, which is what the user cut. Nearly opaque although everything else here is see through:
   prose is the one thing a translucent ground cannot carry. No clip-path -- the cut would eat the
   tail. */
/* THE CENTRED MODAL is the LOGIN MODAL's panel copied line for line. Coherence here is COPIED from
   a real screen next door, never invented; the first version was invented and the user cut it.
   It hangs off the SHELL's overlay slot inside the stage, not off this panel, so it centres
   against the whole stage -- a child of the panel can only centre inside the panel.
   absolute and NEVER fixed: a fixed element escapes the stage. */
.sv-modal { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; pointer-events: auto; font-family: var(--body); color: var(--text); }
.sv-modal-veil { position: absolute; inset: 0; backdrop-filter: blur(5px) saturate(0.75); background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%); }
.sv-modal-panel {
  position: relative; z-index: 2;
  width: min(74%, calc(var(--f) * 48));
  max-height: 84%; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--sp-2);
  padding: var(--sp-3);
  /* THE SPACING SCALE IS DECLARED HERE, and it is not optional: the theme declares the TEXT ramp
     and nothing else, and this modal lives OUTSIDE the screen root. Without this line the browser
     drops each spacing var SILENTLY -- measured: gap normal, padding 0px, prose flush against the
     edge. It happened to Settings whole, and it happened to this. */
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--coral);
  --cut: 1em; clip-path: var(--clip-card); border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.sv-modal-top { flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.sv-modal-id { min-width: 0; }
.sv-modal-id .kick { display: block; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.sv-modal-title { margin: 0; min-width: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
/* The Close button is the login modal's own, copied: same chamfer, steel edge and coral on hover. */
.sv-modal-x { flex: none; cursor: pointer; background: transparent; border: 1px solid var(--steel-dark); color: var(--text); font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.sv-modal-x:hover { border-color: var(--coral); color: var(--coral); }
.sv-modal-rule { flex: none; height: 1px; background: linear-gradient(90deg, var(--coral), transparent 70%); }
/* HIERARCHY, not a wall of white: five level paragraphs read as a block of grey. The house answers
   a question the way the help rail does -- coral eyebrow, body a step down, and the figure the one
   thing that pops, because the thing a player hunts inside a sentence is always the number. */
.sv-modal-topic { display: flex; flex-direction: column; gap: calc(var(--f) * 0.15); }
.sv-modal-topic .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.sv-modal-topic .a { margin: 0; font-size: var(--t-sm); line-height: 1.5; color: var(--porcelain-3); }
.sv-modal-topic .a .n { font-family: var(--display); font-weight: 700; color: var(--amber); font-variant-numeric: tabular-nums; }

.sv-cols { position: relative; z-index: 1; flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr); gap: var(--sp-2); }
/* HALF SEE THROUGH over the art (user's call). A tint, not a solid, and every figure inside was
   re-measured against what ends up under it: art plus veil plus this tint. */
.sv-fights, .sv-box { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); padding: var(--sp-2); background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid color-mix(in srgb, var(--porcelain-3) 14%, transparent); border-top: 2px solid color-mix(in srgb, var(--steel-dark) 70%, transparent); --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.sv-hd { flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }

/* THE ELEMENT CHIP -- what the opposition brings and what to bring against it. It lives in the HERO
   band because it is a figure of the EVENT, not of a difficulty: the three runs field the same
   pack. Above the three fights it MEASURED 25px of overflow on a 254px column at 150 percent. */
.sv-figs .sv-aff { gap: calc(var(--f) * 0.3); font-size: var(--t-sm); text-transform: var(--case); letter-spacing: 0.06em; }
.sv-figs .sv-aff b { font-weight: 700; }
.sv-figs .sv-aff .arrow, .sv-figs .sv-aff .bring { color: var(--steel-faint); font-weight: 400; }
.sv-aff .a-fire { color: var(--af-fire); }
.sv-aff .a-water { color: var(--af-water); }
.sv-aff .a-wind { color: var(--af-wind); }
.sv-aff .a-earth { color: var(--af-earth); }
.sv-aff .a-light { color: var(--af-light); }
.sv-aff .a-dark { color: var(--af-dark); }

/* A fight says ALL THREE figures: cost, pay and recommended CP. Cost without pay is not a choice,
   and either without the CP is a choice made blind.
   The CP goes UNDER the label: a fourth cell on one line clips in a column this narrow, and a whole
   second ROW costs 19px per fight -- measured. */
.sv-fight { cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; column-gap: var(--sp-2); row-gap: 0; padding: calc(var(--f) * 0.45) var(--sp-2); font: inherit; text-align: left; background: color-mix(in srgb, var(--ink) 74%, transparent); border: 1px solid color-mix(in srgb, var(--porcelain-3) 12%, transparent); border-left: 2px solid var(--steel-dark); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); color: var(--text); }
.sv-fight .lb { grid-column: 1; grid-row: 1; }
.sv-fight .cp { grid-column: 1; grid-row: 2; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.sv-fight .cost { grid-column: 2; grid-row: 1 / span 2; }
.sv-fight .pay { grid-column: 3; grid-row: 1 / span 2; }
.sv-fight[disabled] .cp { color: var(--steel-dark); }
.sv-fight:hover:not([disabled]) { border-color: var(--coral); border-left-color: var(--coral); }
.sv-fight[disabled] { cursor: default; color: var(--steel-faint); border-left-color: transparent; }
.sv-fight .lb { font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); }
.sv-fight .cost, .sv-fight .pay { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.25); font-family: var(--display); font-size: var(--t-sm); font-variant-numeric: tabular-nums; }
.sv-fight .cost svg { width: var(--t-sm); height: var(--t-sm); color: var(--jade); }
.sv-fight .pay svg { width: var(--t-sm); height: var(--t-sm); color: var(--amber); }
.sv-fight[disabled] .cost svg, .sv-fight[disabled] .pay svg { color: var(--steel-dark); }
.sv-note { margin-top: auto; font-size: var(--t-tiny); line-height: 1.4; color: var(--steel-faint); }

/* The box number is the panel's TITLE, so it wears the title treatment and not the eyebrow's. */
.sv-box-n { font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.06em; text-transform: var(--case); color: var(--text); font-variant-numeric: tabular-nums; }
.sv-prog { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); letter-spacing: normal; text-transform: none; color: var(--text); font-variant-numeric: tabular-nums; }
.sv-prog .bar { display: block; width: calc(var(--f) * 6); height: calc(var(--f) * 0.4); background: var(--ink-3); overflow: hidden; }
.sv-prog .bar > i { display: block; height: 100%; background: var(--coral); }

/* THE BOX. One contained scroll region, inside its own box: thirty tiles do not fit a stage that
   never scrolls. */
/* THE TILES ARE THE PANEL'S CONTENT, not a list off to one side. At a 7f minimum seven fit one row
   and left two thirds of the box as air; at 11f four fit, the grid fills, and a stack reads at a
   glance -- the whole point of drawing the box instead of hiding it behind a percentage. */
/* Rows are AUTO and the floor lives on the TILE. With the floor on the ROW the tiles overflowed
   their own box by 7px at 175 percent -- invisible to every check that looks at the screen instead
   of at the tile. A floor belongs to the thing it is protecting. */
.sv-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 11), 1fr)); grid-auto-rows: auto; gap: calc(var(--f) * 0.5); align-content: start; padding-right: calc(var(--f) * 0.3); }
.sv-tile { min-width: 0; min-height: calc(var(--f) * 5.4); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--f) * 0.25); padding: calc(var(--f) * 0.7) calc(var(--f) * 0.5); text-align: center; background: color-mix(in srgb, var(--ink) 72%, transparent); border: 1px solid color-mix(in srgb, var(--porcelain-3) 12%, transparent); border-top: 2px solid var(--steel-dark); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.sv-tile .amt { font-family: var(--display); font-weight: 700; font-size: var(--t-md); color: var(--text); font-variant-numeric: tabular-nums; }
.sv-tile .what { font-size: var(--t-xs); line-height: 1.2; color: var(--text); overflow-wrap: anywhere; }
.sv-tile .left { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.sv-tile.t-aether { border-top-color: var(--amber); }
.sv-tile.t-potion { border-top-color: var(--jade); }
/* The Mandate wears the five-star amber AND a filled ground: three exist in the whole event, and a
   tile reading like the other twenty-seven would hide the only prize in the box. */
.sv-tile.t-prize { border-top-color: var(--amber); background: color-mix(in srgb, var(--amber) 12%, var(--ink)); }
.sv-tile.t-prize .what { color: var(--amber); }
/* EMPTIED, not removed: the tile keeps its place so the box never changes shape while you empty it.
   It dims with a COLOUR plus a sunk ground, never with opacity. */
.sv-tile.gone { background: color-mix(in srgb, var(--ink) 70%, transparent); border-color: transparent; border-top-color: transparent; box-shadow: inset 0 calc(var(--f) * 0.12) calc(var(--f) * 0.5) rgba(0,0,0,0.5); }
.sv-tile.gone .amt, .sv-tile.gone .what, .sv-tile.gone .left { color: var(--steel-dark); }

/* THE DRAW ROULETTE: the focus runs the tiles and SITS on the one that came out, and only then does
   the screen repaint. A BORDER and a ground, never a transform -- the tiles sit in a grid, and a
   scaling tile shoves its neighbours around for the length of the spin. */
.sv-tile.spin { border-color: var(--coral); border-top-color: var(--coral); background: color-mix(in srgb, var(--coral) 14%, var(--ink)); }
.sv-tile.hit { border-color: var(--amber); border-top-color: var(--amber); background: color-mix(in srgb, var(--amber) 22%, var(--ink)); box-shadow: 0 0 0 1px var(--amber); }
.sv-tile.hit .amt, .sv-tile.hit .what, .sv-tile.hit .left { color: var(--text); }

.sv-draw { flex: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: var(--sp-2); padding: calc(var(--f) * 0.6) var(--sp-3); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.sv-draw:hover:not([disabled]) { background: var(--coral-deep); border-color: var(--coral-deep); }
.sv-draw[disabled] { cursor: default; background: var(--ink-3); border-color: var(--ink-3); color: var(--steel-faint); }
.sv-draw .c { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.25); font-variant-numeric: tabular-nums; }
.sv-draw .c svg { width: var(--t-sm); height: var(--t-sm); }

/* WHAT THE LAST DRAW GAVE, drawn only when there is something: a reserved row usually empty would
   eat height from the grid. */
.sv-got { flex: none; display: flex; align-items: baseline; flex-wrap: wrap; gap: calc(var(--f) * 0.4); font-size: var(--t-xs); line-height: 1.3; color: var(--text); }
.sv-got .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
/* TWO PRIZES IN A ROW NEED A SEPARATOR, and no measurement catches this: in the screenshot
   "3,000 Funds Ashen Doctrine II" read as ONE thing. A flex gap is not enough when both sides are
   running text; the middot is what cuts. */
.sv-got .g { font-variant-numeric: tabular-nums; }
.sv-got .g + .g::before { content: "\xB7"; margin-right: calc(var(--f) * 0.4); color: var(--steel-dark); }
.sv-got .g b { font-family: var(--display); font-weight: 700; color: var(--amber); }
`;function Pe(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function Se(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var ni=`
*, *::before, *::after { box-sizing: border-box; }


/* -- The event rail -- Summon's pattern: fixed width in --f units, CONTAINED scroll (the screen does
   not scroll), house plates for cards. */
.ev-rail { flex: 0 0 auto; width: calc(var(--f) * 15); min-width: 0; min-height: 0; display: flex; }
.ev-rail-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); padding-right: calc(var(--f) * 0.3); }

.ev-card {
  flex: none; cursor: pointer; text-align: left; min-width: 0;
  display: flex; align-items: center; gap: var(--sp-2);
  padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark);
  color: var(--text); font-family: var(--display);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
.ev-card:hover:not([aria-disabled="true"]) { border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-2) 96%, transparent); }
/* Coral marks the SELECTION and nothing else: an accent on a resting plate is what made the second
   Settings pass read as another program. */
.ev-card[aria-pressed="true"] { border-left-color: var(--coral); background: color-mix(in srgb, var(--coral) 14%, var(--ink-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 35%, transparent); }
.ev-card:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.ev-card[aria-disabled="true"] { cursor: default; opacity: 0.5; }
.ev-card[aria-disabled="true"]:hover { border-left-color: var(--steel-dark); }

.ev-card .ic { flex: none; width: calc(var(--f) * 2); height: calc(var(--f) * 2); display: grid; place-items: center; color: var(--steel); }
.ev-card .ic svg { width: 100%; height: 100%; }
.ev-card[aria-pressed="true"] .ic { color: var(--coral); }
.ev-card .ev-card-id { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: calc(var(--f) * 0.16); }
.ev-card .ev-card-id b { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-xs); letter-spacing: var(--track); text-transform: var(--case); line-height: 1.2; }
/* ONE LINE, always. The slot is 107.1px and holds 24 characters; at 25 it wraps and the card grows
   10px. Clipped, not wrapped: the full name is the panel's headline, one click away. */
.ev-card .ev-card-id i { font-style: normal; font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* A MARK, not a sentence: the dot says something here can be claimed, the one thing the rail cannot
   say with the name. State by shape, not by paragraph. */
.ev-card .dot { flex: none; width: calc(var(--f) * 0.5); height: calc(var(--f) * 0.5); border-radius: 99px; background: var(--coral); }

/* THE PANE IS NOT A PLATE: with no art an ink-2 plate held ink-2 cards, both rgb(14,20,32), so a
   card was invisible as a card. Transparent pane, the CARDS are the plates. */
/* THE PANE IS THE SCROLLING REGION (user request); the SCREEN never scrolls. Shrinking instead put
   the Claim button 22px below the pane, and gave the mission block ZERO height on a phone. */
.ev-pane {
  flex: 1 1 auto; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; gap: var(--sp-2);
  overflow-y: auto; overflow-x: hidden;
  /* The scroll gutter comes out of padding, as in the rail: without it the bar eats content width and
     the mission columns stop measuring alike. */
  padding-right: calc(var(--f) * 0.3);
}

.ev-top { flex: none; display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; }
/* The event name lives HERE, not in the hoisted h2: the bar lacks that width. Same treatment as any
   screen's h2. */
.ev-title { margin: 0; min-width: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
/* Aether is said ONCE, since all seven days pay the same, and it comes from the payload
   (rungs[0].aether): a written copy is a lie waiting for the number to move. */
.ev-every { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.35); color: var(--text); }
.ev-every svg { width: var(--t-md); height: var(--t-md); flex: none; color: var(--amber); }
.ev-every b { font-family: var(--display); font-size: var(--t-md); font-variant-numeric: tabular-nums; }
.ev-every span { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* The week reset goes to the far end: the one figure nothing else says. */
.ev-when { margin-left: auto; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.ev-when b { color: var(--text); font-variant-numeric: tabular-nums; }

/* -- The week -- seven columns: the row IS the week. Height comes from a KNOB, not the content:
   stretching a lone row already gave 108x383 splinters in Materials. */
.ev-week { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: calc(var(--f) * 0.5); align-content: center; }

/* On the SCREEN the week wraps to TWO rows: one row left 514px of air and stretching gave 146x650
   splinters. The MODAL keeps seven across -- there the panel sizes to its content. */
/* Four up, three down, centred: an EIGHT-column grid with each card spanning two, so row two
   centres itself with no hand-written numbers. */
.ev-pane .ev-week { grid-template-columns: repeat(8, minmax(0, 1fr)); grid-auto-rows: minmax(min-content, 1fr); align-content: stretch; }
.ev-pane .ev-slot { grid-column: span 2; }
.ev-pane .ev-slot:nth-child(5) { grid-column: 2 / span 2; }
/* And the content FILLS the card: the hole moved inside it, and closes by filling, not by adding. */
.ev-pane .ev-day { gap: calc(var(--f) * 0.5); padding: calc(var(--f) * 1.1) calc(var(--f) * 0.6); }
/* A claimed card composes against the STAGE now, not a plate: the sunk look is the same. */
.ev-pane .ev-day .glyph { width: 46%; max-width: calc(var(--f) * 9); }
.ev-pane .ev-day .amt { font-size: var(--t-lg); }
.ev-pane .ev-day .what { font-size: var(--t-md); }
.ev-slot { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); }
.ev-slot > .ev-day { flex: 1 1 auto; }
.ev-n { text-align: center; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: uppercase; color: var(--steel-faint); }

.ev-day {
  position: relative; min-width: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--f) * 0.3);
  padding: calc(var(--f) * 0.7) calc(var(--f) * 0.3);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  text-align: center;
}
.ev-day .glyph { width: 42%; max-width: calc(var(--f) * 2.6); height: auto; color: var(--steel); flex: none; }
.ev-day .amt { font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* The NAME of what a day pays: a glyph with a number does not say what you receive (user rule). And
   it WRAPS, never truncates -- a line clamp lies as soon as text scales. */
.ev-day .what { font-family: var(--body); font-size: var(--t-xs); line-height: 1.2; color: var(--text); text-wrap: balance; }

/* The two prize rungs wear the five-star amber, the token Formation and Inventory already use for the
   good one. */
.ev-day.prize { border-top-color: var(--amber); }
.ev-day.prize .glyph { color: var(--amber); }
/* The claimable one: coral, which on this screen means what you can touch. */
.ev-day.next { border-color: var(--coral); border-top-color: var(--coral); background: color-mix(in srgb, var(--coral) 12%, var(--ink-2)); }
.ev-day.next .glyph { color: var(--coral); }
/* Claimed, WITHOUT opacity: lowering a text's alpha is the transparency the rule forbids, and it
   takes the rung off the screen. */
/* Measured: claimed against normal gave 1.14:1, the inks being near black in all five styles. What
   reads is the LOST EDGE plus an inset shadow; the text drops to an OPAQUE steel-faint (6.6:1). */
.ev-day.done { background: var(--ink); border-color: transparent; box-shadow: inset 0 calc(var(--f) * 0.15) calc(var(--f) * 0.6) rgba(0,0,0,0.55); }
.ev-day.done .glyph { color: var(--steel-dark); }
.ev-day.done .amt, .ev-day.done .what { color: var(--steel-faint); }
/* The tick sits in the CORNER: centred and large it fought the glyph and the figure. */
/* display: block with a line-height box: as an inline span the glyph overflowed its own box by 2px
   and the clip meter counted it. */
.ev-day .tick { position: absolute; top: calc(var(--f) * 0.25); right: calc(var(--f) * 0.4); display: block; font-size: var(--t-sm); line-height: 1.25; color: var(--jade); }

.ev-foot { flex: none; display: flex; align-items: center; gap: var(--sp-2); }
/* What is granted is SHOWN: day 7 drops a RELIC, and it goes in the foot beside the button. */
.ev-gained { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: calc(var(--f) * 0.3) var(--sp-2); }
.ev-gained .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
.ev-gained .it { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-xs); color: var(--text); }
.ev-gained .it svg { width: var(--t-sm); height: var(--t-sm); flex: none; color: var(--jade); }
.ev-gained .it b { font-variant-numeric: tabular-nums; }
.ev-claim {
  margin-left: auto; flex: none; cursor: pointer;
  background: var(--coral); border: 0; color: var(--on-coral);
  font-family: var(--display); font-stretch: var(--stretch); font-weight: 700;
  font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case);
  padding: calc(var(--f) * 0.5) calc(var(--f) * 2);
  --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
/* A disabled button says WHY: one word, where the player is already looking. */
.ev-claim[disabled] { background: var(--ink-3); color: var(--steel-faint); cursor: default; }

/* -- THE BATTLE PASS -- one track, so one ladder. The pane splits in three: the data row, the level
   ladder with CONTAINED scroll, and the three mission drawers. */
.pv-season, .pv-lv { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.pv-season b, .pv-lv b { color: var(--text); font-variant-numeric: tabular-nums; font-size: var(--t-sm); }
.pv-xp { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); }
.pv-xp b { color: var(--text); font-variant-numeric: tabular-nums; }
.pv-xp .bar { width: calc(var(--f) * 7); height: calc(var(--f) * 0.35); background: var(--ink-3); border-radius: 99px; overflow: hidden; }
.pv-xp .bar > i { display: block; height: 100%; background: var(--coral); }

/* CONTAINED scroll: the levels do not fit a stage that does not scroll, and the rule is that the
   SCREEN must not; a region may, inside its box. */
/* The LADDER is the elastic region (user request), the mission block is fixed: the Home's split.
   Earlier passes had it reversed, 153px of ladder against 526 of missions. */
/* Height falls out of the TWO rows of squares: with the card tied to its ratio and the column width
   fixed, ladder height is a consequence, not a knob. */
.pv-track { flex: 0 0 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; padding-bottom: calc(var(--f) * 0.3); }
/* TWO rows, a consequence of the square card: it is the only way more room means BIGGER cards.
   Column flow keeps progress reading left to right, and shows twelve levels instead of six. */
/* EXPLICIT column width. Without it the track solves width-from-height and height-from-content at
   once: circular, and names came out cut in half. */
.pv-rail { display: grid; grid-auto-flow: column; grid-auto-columns: calc(var(--f) * 13); grid-template-rows: repeat(2, auto); gap: calc(var(--f) * 0.5) calc(var(--f) * 0.4); width: max-content; }
.pv-slot { min-height: 0; display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.25); }
.pv-n { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }

/* A level is the SAME card as a login rung, small: glyph, figure and NAME. A glyph with a number does
   not say what you receive. */
.pv-lvl {
  position: relative; width: 100%; min-width: 0;
  /* SQUARE (user request): width COMES FROM height via the ratio, so more room grows the card
     instead of stretching it. FLEX, never an auto grid track, which would be circular. */
  aspect-ratio: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--f) * 0.2); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.25);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  --cut: 0.4em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  text-align: center;
}
/* Every child is capped to the card: a flex-column item will not shrink below max-content, so text
   overflowed and clip-path CUT IT SILENTLY -- a clip cut never shows in scrollWidth. */
.pv-lvl > * { max-width: 100%; min-width: 0; }
.pv-lvl .glyph { width: 44%; max-width: calc(var(--f) * 4.6); height: auto; color: var(--steel); flex: none; }
.pv-lvl .amt { font-family: var(--display); font-size: var(--t-md); color: var(--text); font-variant-numeric: tabular-nums; }
/* line-height 1.3, not 1.15: tighter than the font box the span overflows itself by 2px and every
   clip check fires. A long name WRAPS. */
.pv-lvl .what { font-family: var(--body); font-size: var(--t-xs); line-height: 1.3; color: var(--text); overflow-wrap: anywhere; }
/* Aether comes with every level: a small figure, not a word repeated thirty times. */
.pv-lvl .ae { font-family: var(--display); font-size: var(--t-tiny); color: var(--amber); font-variant-numeric: tabular-nums; }
.pv-lvl.prize { border-top-color: var(--amber); }
.pv-lvl.prize .glyph { color: var(--amber); }
/* Claimable is the only coral: the accent marks the actionable, not decoration. */
.pv-lvl.ready { border-color: var(--coral); border-top-color: var(--coral); background: color-mix(in srgb, var(--coral) 12%, var(--ink-2)); }
.pv-lvl.ready .glyph { color: var(--coral); }
/* Claimed: loses its edge and sinks, like a claimed login rung. Darker alone does not read; the
   theme's inks are near black. */
.pv-lvl.done { background: var(--ink); border-color: transparent; box-shadow: inset 0 calc(var(--f) * 0.12) calc(var(--f) * 0.5) rgba(0,0,0,0.55); }
.pv-lvl.done .glyph { color: var(--steel-dark); }
.pv-lvl.done .amt, .pv-lvl.done .what { color: var(--steel-faint); }
.pv-lvl.done .ae { color: var(--steel-dark); }
/* An unreached level does not dim with opacity, the forbidden transparency: it loses its top edge.
   Hierarchy by shape. */
.pv-lvl.off { border-top-color: var(--ink-3); }
.pv-lvl.off .glyph { color: var(--steel-dark); }
.pv-lvl .tick { position: absolute; top: calc(var(--f) * 0.15); right: calc(var(--f) * 0.25); display: block; font-size: var(--t-tiny); line-height: 1.25; color: var(--jade); }

/* The three drawers are TABS: the chosen one takes the whole panel, so each mission fits one line
   instead of fighting for a third of the width. */
/* The mission block takes what it measures and NEVER gives way; the PANE scrolls. Never min-height
   0: with the zero it shrank to NOTHING on a phone with every measurement green. */
.pv-missions { flex: none; min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); }
.pv-tabs { flex: none; display: flex; align-items: center; gap: calc(var(--f) * 0.4); }
/* The pills are Inventory's: coral ONLY on the chosen one. */
.pv-tab {
  cursor: pointer; display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.4);
  font-family: var(--display); letter-spacing: 0.12em; text-transform: var(--case);
  padding: calc(var(--f) * 0.3) calc(var(--f) * 0.8);
  background: var(--ink-3); border: 1px solid transparent; color: var(--steel-faint);
  --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm);
}
.pv-tab .k { font-size: var(--t-xs); }
.pv-tab .rs { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.pv-tab .ct { font-size: var(--t-tiny); font-variant-numeric: tabular-nums; }
.pv-tab:hover { color: var(--text); border-color: var(--coral); }
.pv-tab[aria-pressed="true"] { background: var(--coral); color: var(--on-coral); }
.pv-tab[aria-pressed="true"] .ct { color: var(--on-coral); }
.pv-reroll {
  margin-left: auto; flex: none; cursor: pointer;
  background: transparent; border: 1px solid var(--steel-dark); color: var(--text);
  font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case);
  padding: calc(var(--f) * 0.3) calc(var(--f) * 0.7);
  --cut: 0.35em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
.pv-reroll:hover:not([disabled]) { border-color: var(--coral); color: var(--coral); }
.pv-reroll[disabled] { cursor: default; color: var(--steel-faint); }

/* FIXED height, two rows, so switching tabs cannot resize the ladder. minmax(min-content, 1fr), NOT
   minmax(0, 1fr): with the zero cards drew 72px asking 89 and were cut silently. */
/* THE HEIGHT IS A FLOOR, NOT A SIZE. A fixed height plus min-content rows is two opinions about one
   box: the rows win and the excess SPILLS onto the next sibling -- measured, four cards ran 21px
   under the Claim button with every meter green (they overlap inside their own boxes). */
.pv-list {
  flex: none; min-height: calc(var(--f) * 12); min-width: 0; margin: 0; padding: 0; list-style: none;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(min-content, 1fr)); gap: calc(var(--f) * 0.5);
}
/* A four-mission drawer spans both rows: four tall cards instead of four flat ones over a row of air. */
.pv-list.few .pv-m { grid-row: span 2; }

/* A mission is a CARD, not a line: the big figure is what reads at a glance, and the bar rides with
   it. */
.pv-m {
  min-width: 0; overflow: hidden;
  /* NOTHING absolute inside the card: the XP tag was absolute and the mission text ran UNDER it. In
     a grid with one row and one column each, two children cannot overlap by construction. */
  display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto auto;
  align-content: center; gap: calc(var(--f) * 0.35) calc(var(--f) * 0.6);
  padding: calc(var(--f) * 0.7) calc(var(--f) * 0.8);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
}
.pv-m .tx { grid-row: 1; grid-column: 1 / -1; min-width: 0; font-family: var(--body); font-size: var(--t-sm); line-height: 1.3; color: var(--text); }
/* The FIGURE is the datum, and it goes big: 23 / 60 says at a glance what a bare bar does not. */
.pv-m .ct { grid-row: 2; grid-column: 1; align-self: end; font-family: var(--display); font-size: var(--t-sm); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
/* --t-md, not --t-lg: with EIGHT season missions the cards drew 81px asking 87. The fullest drawer
   sets the size. */
.pv-m .ct b { font-size: var(--t-md); color: var(--text); }
/* A bar must read AS a bar: the empty rail in an OPAQUE colour, or only the filled piece shows. */
.pv-m .bar { grid-row: 3; grid-column: 1 / -1; height: calc(var(--f) * 0.5); background: var(--steel-dark); border-radius: 99px; overflow: hidden; }
.pv-m .bar > i { display: block; height: 100%; background: var(--coral); }
/* What it pays sits beside the figure, in FLOW: a datum of the card, not a floating ornament. */
.pv-m .xp { grid-row: 2; grid-column: 2; justify-self: end; align-self: end; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--amber); white-space: nowrap; }
/* Done: loses its edge and sinks, the same treatment as a claimed login rung. */
.pv-m.done { background: var(--ink); border-color: transparent; box-shadow: inset 0 calc(var(--f) * 0.12) calc(var(--f) * 0.5) rgba(0,0,0,0.55); }
.pv-m.done .bar > i { background: var(--jade); }
.pv-m.done .ct b { color: var(--jade); }
.pv-m.done .xp { color: var(--steel-dark); }
.pv-m.empty .tx { color: var(--steel-faint); }

.ev-soon { flex: 1 1 auto; display: grid; place-items: center; text-align: center; gap: var(--sp-2); align-content: center; }
.ev-soon .h { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
.ev-soon .k { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }

/* -- THE HOME MODAL -- the house panel (hm-pk in styles.js): OPAQUE over ink. A translucent one
   composes against the stage, shifts per style, and the Home bleeds through. */
.ev-modal { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; pointer-events: auto; font-family: var(--body); color: var(--text); }
.ev-veil {
  position: absolute; inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}
.ev-panel {
  position: relative; z-index: 2;
  width: min(74%, calc(var(--f) * 74));
  display: flex; flex-direction: column; gap: var(--sp-2);
  padding: var(--sp-3);
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--coral);
  --cut: 1em; clip-path: var(--clip-card); border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
/* In the modal the week has no elastic height: the panel sizes to its content. */
.ev-panel .ev-week { flex: none; }
.ev-panel .ev-day { min-height: calc(var(--f) * 6.5); }
.ev-x {
  flex: none; cursor: pointer;
  background: transparent; border: 1px solid var(--steel-dark); color: var(--text);
  font-family: var(--display); font-weight: 700; font-size: var(--t-xs);
  letter-spacing: 0.1em; text-transform: var(--case);
  padding: calc(var(--f) * 0.3) var(--sp-2);
  --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
.ev-x:hover { border-color: var(--coral); color: var(--coral); }
`,xd=`
.ev-pane.nw { position: relative; gap: var(--sp-2); background-size: cover; background-position: center 22%; overflow: hidden; }
.ev-pane.nw.flat { background-image: linear-gradient(150deg, var(--ink-2), var(--ink-3)); }
.nw-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 34%, transparent) 0%, color-mix(in srgb, var(--ink) 58%, transparent) 30%, color-mix(in srgb, var(--ink) 76%, transparent) 100%); }
/* The identity keeps a SHARE of the panel and sits at its bottom edge, so the painting above is
   what the eye lands on. A share and not a height, with a floor for a short window. */
.nw-hero { position: relative; z-index: 1; flex: 0 0 62%; min-height: calc(var(--f) * 10); display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); padding: var(--sp-2) var(--sp-3); }
/* The same per-glyph shadow the seasonal wears: the veil handles a dark painting, a bright one it
   cannot, and a shadow works over whatever pixel happens to be underneath. */
.nw-id, .nw-figs { text-shadow: 0 1px 2px rgba(0,0,0,0.92), 0 0 12px rgba(0,0,0,0.65); }
.nw-figs svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.92)); }
.nw-id { min-width: 0; }
.nw-id .kick { display: block; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.nw-id h3 { margin: 0; min-width: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
.nw-figs { flex: none; display: flex; align-items: baseline; gap: var(--sp-3); }
/* BASELINE, not centre: the two disagreeing put the figures 6.3px apart. A chip with an ICON
   centres on the tallest thing in it, which lifts the number off its own baseline. */
.nw-figs .fig { display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
.nw-figs .fig svg { width: var(--t-md); height: var(--t-md); flex: none; align-self: center; }
/* EVERY FIGURE IN THIS ROW WEARS THE ACCENT (user's call): coral is the one token that changes
   across the five styles, and the quiet words around it are what make the number read first. */
.nw-figs .fig b { font-weight: 700; color: var(--coral); }
.nw-figs .fig span { font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* The words stay dim; BOTH numbers take the accent -- one of the two in another colour reads worse
   than both in grey. */
.nw-figs .fig.dim { color: var(--steel-faint); }
.nw-track { position: relative; z-index: 1; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2); background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid color-mix(in srgb, var(--porcelain-3) 14%, transparent); border-top: 2px solid var(--steel-dark); --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
/* SEVEN ACROSS, ONE ROW (user's call): the login pane splits 4/3 because it owns the whole panel,
   and here the art takes the top half. Inherited, 494px of cards went into a 240px track. */
.ev-pane.nw .ev-week { flex: 1 1 auto; min-height: 0; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); align-content: stretch; }
.ev-pane.nw .ev-slot { grid-column: auto; }
.ev-pane.nw .ev-slot:nth-child(5) { grid-column: auto; }
/* SMALLER CARDS so more of the painting stays visible (user's call). Seven of them across a third
   of the panel's height do not need the login card's air: the day is one figure and one word. */
.ev-pane.nw .ev-day .glyph { width: 28%; max-width: calc(var(--f) * 1.15); }
.ev-pane.nw .ev-day { padding: calc(var(--f) * 0.35) calc(var(--f) * 0.25); gap: calc(var(--f) * 0.15); }
.ev-pane.nw .ev-day .amt { font-size: var(--t-sm); }
.ev-pane.nw .ev-day .what { font-size: var(--t-tiny); }
.ev-pane.nw .ev-slot { gap: calc(var(--f) * 0.2); }
.ev-pane.nw .nw-track { padding: calc(var(--f) * 0.7); gap: calc(var(--f) * 0.6); }
`,li=ni,ci=`
.rl-modal {
  position: absolute; inset: 0; z-index: 42;
  display: grid; place-items: center; pointer-events: auto;
  font-family: var(--body); color: var(--text);
  --gf-f: clamp(7.5px, 1.02cqw, 22px);
  --f: var(--gf-f);
  --sp-1: calc(var(--gf-f) * 0.5);
  --sp-2: calc(var(--gf-f) * 1.0);
  --sp-3: calc(var(--gf-f) * 1.6);
  --t-tiny: calc(var(--gf-f) * 0.72 * var(--gf-type-scale, 1));
  --t-xs: calc(var(--gf-f) * 0.85 * var(--gf-type-scale, 1));
  --t-sm: calc(var(--gf-f) * 1.0 * var(--gf-type-scale, 1));
  --t-md: calc(var(--gf-f) * 1.25 * var(--gf-type-scale, 1));
  --t-lg: calc(var(--gf-f) * 1.7 * var(--gf-type-scale, 1));
}
.rl-veil { position: absolute; inset: 0; backdrop-filter: blur(5px) saturate(0.75); background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%); }
.rl-panel {
  position: relative; z-index: 2;
  width: min(74%, calc(var(--gf-f) * 46));
  max-height: 88%; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--sp-2);
  padding: var(--sp-3);
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--amber);
  --cut: 1em; clip-path: var(--clip-card); border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
.rl-eyebrow { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--amber); }
.rl-foot { flex: none; display: flex; justify-content: flex-end; }
.rl-ok { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--gf-f) * 0.5) var(--sp-3); background: var(--coral); border: 0; color: var(--on-coral); --cut: 0.6em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
`,di=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

/* The spacing scale is DECLARED here: the theme declares the TEXT ramp only, and an undeclared var()
   is an invalid declaration the browser drops silently, every padding collapsing to zero. It
   happened to Settings whole. */
.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
/* EVERY screen paints its stage: the two radials over the ground gradient. Settings was the one
   without it and its plates sank into the background. */
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) with the :has() row, never auto 1fr: hoistHeadIntoBar REMOVES the .head and a two-
   fixed-row screen drops its only child into the AUTO row, sized to its content. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

/* min-width 0 down the WHOLE chain, and it is not decoration: grid and flex items default min-width
   to auto and cannot shrink below content. With the pass ladder inside (max-content width) .body
   measured 2715 over a 1381 stage and the SCREEN scrolled sideways: .root overflowed 1334px. */
.body { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
/* The top air left with the hoisted .head: restored ONLY in the hoisted case. */
.screen:not(:has(> .head)) .body { padding-top: var(--sp-2); }
.ev-cols { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; gap: var(--sp-2); }

`+ni+si+xd;function kd(t,e,a){let r=t.day<=e,s=!r&&t.day===e+1;return'<div class="ev-slot"><div class="'+["ev-day",t.prize?"prize":"",r?"done":"",s&&a?"next":""].filter(Boolean).join(" ")+'">'+ne(t.extra.kind)+'<span class="amt">'+Pe(t.extra.qty)+'</span><span class="what">'+t.extra.name+"</span>"+(r?'<span class="tick">&#10003;</span>':"")+'</div><span class="ev-n">Day '+t.day+"</span></div>"}function hr(t,e,a){return'<div class="ev-week">'+t.map(r=>kd(r,e,a)).join("")+"</div>"}function hi(t,e,a,r){let s=Number(t[0]&&t[0].aether)||0,o=Number(e),i=Number.isFinite(o)?o<=0?"Resets tonight":"Resets in <b>"+o+"</b>"+(o===1?" day":" days"):"";return'<div class="ev-top">'+(a?'<h3 class="ev-title">'+Se(a)+"</h3>":"")+'<span class="ev-every">'+ne("aether")+"<b>"+Pe(s)+'</b><span>Aether daily</span></span><span class="ev-when">'+i+"</span>"+(r||"")+"</div>"}function ha(t){return!Array.isArray(t)||!t.length?"":'<span class="ev-gained"><span class="k">Claimed</span>'+t.map(e=>'<span class="it">'+ne(e.kind)+"<b>"+Pe(e.qty)+"</b> "+e.material+"</span>").join("")+"</span>"}function pi(t){return t?'<div class="rl-modal" role="dialog" aria-modal="true" aria-label="Relic won"><div class="rl-veil"></div><div class="rl-panel"><div class="rl-top"><div class="rl-eyebrow">You obtained a Relic</div></div>'+ct(t,{actions:!1})+'<div class="rl-foot"><button class="rl-ok" type="button" data-relic-ok>Accept</button></div></div></div>':""}function fi(t,{onClose:e}={}){let a=t&&t.querySelector("[data-relic-ok]");a&&e&&a.addEventListener("click",()=>e())}function ui(t,e){let a=t?"Claim":e?"All claimed":"Claimed today";return'<button class="ev-claim" type="button" data-events-claim'+(t?"":" disabled")+">"+a+"</button>"}function vi(t){let e=t||{},a=Array.isArray(e.rungs)?e.rungs:[],r=Math.max(0,Number(e.claimed)||0);return{rungs:a,claimed:r,ready:!!e.ready,full:a.length>0&&r>=a.length,resetsIn:e.resetsIn,gained:Array.isArray(e.gained)?e.gained:[]}}function _d(t){let e=Math.max(0,Math.round(Number(t)||0)),a=Math.floor(e/864e5),r=Math.floor(e%864e5/36e5);if(a>0)return a+"d "+r+"h";let s=Math.floor(e%36e5/6e4);return r>0?r+"h "+s+"m":s+"m"}function Sd(t){let e=t&&typeof t=="object"?t:{},a=r=>({...r&&typeof r=="object"?r:{},xp:Math.max(0,Number(r&&r.xp)||0),missions:Array.isArray(r&&r.missions)?r.missions:[]});return{...e,seq:Math.max(1,Math.round(Number(e.seq)||1)),level:Math.max(0,Math.round(Number(e.level)||0)),max:Math.max(1,Math.round(Number(e.max)||1)),xpInto:Math.max(0,Number(e.xpInto)||0),xpPerLevel:Math.max(1,Number(e.xpPerLevel)||1),endsInMs:Number(e.endsInMs)||0,rewards:Array.isArray(e.rewards)?e.rewards:[],claimable:Array.isArray(e.claimable)?e.claimable:[],rerollsLeft:Math.max(0,Math.round(Number(e.rerollsLeft)||0)),daily:a(e.daily),weekly:a(e.weekly),season:a(e.season),gained:Array.isArray(e.gained)?e.gained:[]}}function Ed(t,e){let a=t.level>e;return'<div class="pv-slot"><div class="'+["pv-lvl",t.prize?"prize":"",t.claimed?"done":"",a?"off":"",!a&&!t.claimed?"ready":""].filter(Boolean).join(" ")+'">'+ne(t.extra.kind)+'<span class="amt">'+Pe(t.extra.qty)+'</span><span class="what">'+t.extra.name+"</span>"+(t.aether>0?'<span class="ae">+'+Pe(t.aether)+"</span>":"")+(t.claimed?'<span class="tick">&#10003;</span>':"")+'</div><span class="pv-n">'+t.level+"</span></div>"}function Td(t){let e=Math.max(0,Math.round(Number(t)||0));if(!e)return"";let a=Math.floor(e/36e5);return a>=24?Math.floor(a/24)+"d "+a%24+"h":a>=1?a+"h":Math.max(1,Math.round(e/6e4))+"m"}function Ad(t,e){let a=s=>s.missions.filter(o=>o.paid||o.done>=o.need).length,r=(s,o,i)=>{let n=Td(i.resetsInMs);return'<button class="pv-tab" type="button" data-pass-tab="'+s+'" aria-pressed="'+(s===e)+'"><span class="k">'+o+'</span><span class="ct">'+a(i)+"/"+i.missions.length+"</span>"+(n?'<span class="rs">'+n+"</span>":"")+"</button>"};return r("daily","Daily",t.daily)+r("weekly","Weekly",t.weekly)+r("season","Season",t.season)}function Nd(t){let e=t.missions.length<=4,a=t.missions.map(r=>{let s=Math.max(1,Number(r.need)||1),o=Math.min(s,Math.max(0,Number(r.done)||0));return'<li class="pv-m'+(!!r.paid||o>=s?" done":"")+'" data-mission="'+Se(r.id)+'"><span class="xp">+'+t.xp+' XP</span><span class="tx">'+Qo(r)+'</span><span class="ct"><b>'+o+"</b>/"+s+'</span><span class="bar"><i style="width:'+Math.round(o/s*100)+'%"></i></span></li>'}).join("");return'<ul class="pv-list'+(e?" few":"")+'">'+(a||'<li class="pv-m empty"><span class="tx">Nothing here</span></li>')+"</ul>"}function Id(t,e,a){let r=Sd(t),s=Math.max(0,Math.min(100,Math.round(r.xpInto/r.xpPerLevel*100))),o=r.level>=r.max,i=r.claimable.length?"Claim "+r.claimable.length:o?"All claimed":"Nothing to claim",n='<button class="pv-reroll" type="button" data-pass-reroll'+(r.rerollsLeft>0?"":" disabled")+">Reroll "+r.rerollsLeft+"</button>",l=r[a]?a:"daily";return'<div class="ev-pane pv"><div class="ev-top"><h3 class="ev-title">'+Se(e)+'</h3><span class="pv-season">Season <b>'+r.seq+'</b></span><span class="pv-lv">Lv <b>'+r.level+"</b>/"+r.max+'</span><span class="pv-xp"><span class="bar"><i style="width:'+s+'%"></i></span><b>'+Pe(r.xpInto)+"</b>/"+Pe(r.xpPerLevel)+' XP</span><span class="ev-when">Ends in <b>'+_d(r.endsInMs)+'</b></span></div><div class="pv-track"><div class="pv-rail">'+r.rewards.map(d=>Ed(d,r.level)).join("")+'</div></div><div class="pv-missions"><div class="pv-tabs">'+Ad(r,l)+(l==="daily"?n:"")+"</div>"+Nd(r[l])+'</div><div class="ev-foot">'+ha(r.gained)+'<button class="ev-claim" type="button" data-pass-claim'+(r.claimable.length?"":" disabled")+">"+i+"</button></div></div>"}var oi={login:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8.5 14.5l2 2 4-4"/></svg>',seasonal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/></svg>'},ii=t=>oi[String(t)]||oi.seasonal;function Cd(t,e,a){let r=Se(t.id);return t.live===!1?'<button class="ev-card" type="button" aria-disabled="true" data-event="'+r+'"><span class="ic">'+ii(t.kind)+'</span><span class="ev-card-id"><b>'+Se(t.label)+"</b><i>"+Se(t.note||"Not open yet")+"</i></span></button>":'<button class="ev-card" type="button" data-event="'+r+'" aria-pressed="'+(t.id===e)+'"><span class="ic">'+ii(t.kind)+'</span><span class="ev-card-id"><b>'+Se(t.label)+"</b><i>"+Se(t.note||"")+"</i></span>"+(a?'<span class="dot"></span>':"")+"</button>"}function Rd(t,e){let a=t&&typeof t=="object"?t:{},r=Array.isArray(a.rungs)?a.rungs:[],s=Math.max(0,Math.round(Number(a.claimed)||0)),o=r.length||Number(a.days)||0,i=!!a.ready,n=typeof a.art=="string"&&!!a.art.trim(),l=Number(a.perDay)||Number(r[0]&&r[0].aether)||0;return'<div class="ev-pane nw'+(n?"":" flat")+'"'+(n?' style="background-image:url('+Se(a.art)+')"':"")+'><div class="nw-scrim"></div><div class="nw-hero"><div class="nw-id"><span class="kick">Welcome</span><h3>'+Se(e||"Journey to a New World")+'</h3></div><div class="nw-figs"><span class="fig">'+ne("aether")+"<b>"+Pe(l)+'</b><span>a day</span></span><span class="fig dim"><b>'+Math.max(0,o-s)+"</b> of <b>"+o+'</b> left</span></div></div><div class="nw-track">'+hr(r,s,i)+'<div class="ev-foot">'+ha(a.gained)+'<button class="ev-claim" type="button" data-newworld-claim'+(i?"":" disabled")+">"+(i?"Claim today":"Come back tomorrow")+"</button></div></div></div>"}function mi({slots:t,eventId:e,view:a,seasonal:r=null,newWorld:s=null,from:o="Home",passTab:i="daily",alerts:n=null}={}){let l=Array.isArray(t)&&t.length?t:sr,d=l.filter(b=>b.live!==!1),h=d.find(b=>b.id===e)||d[0]||null,f=vi(a),m='<div class="ev-rail"><div class="ev-rail-scroll">'+l.map(b=>Cd(b,h&&h.id,!!(n&&n[b.id]))).join("")+"</div></div>",v;return h?h.kind==="pass"?v=Id(a,h.label,i):h.kind==="newworld"?v=Rd(s,h.label):h.kind==="seasonal"?v=ri(r):v='<div class="ev-pane">'+hi(f.rungs,f.resetsIn,h.label)+hr(f.rungs,f.claimed,f.ready)+'<div class="ev-foot">'+ha(f.gained)+ui(f.ready,f.full)+"</div></div>":v='<div class="ev-pane"><div class="ev-soon"><span class="k">Nothing running</span><span class="h">No events open right now</span></div></div>','<div class="root"><div class="stage"></div><section class="screen" data-screen="events"><div class="head"><button class="back" type="button" data-events-back>&#9664; '+Se(o)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Events</h2></div></div><div class="body"><div class="ev-cols">'+m+v+"</div></div></section></div>"}function gi({view:t}={}){let e=vi(t);return'<div class="ev-modal" data-events><div class="ev-veil"></div><div class="ev-panel">'+hi(e.rungs,e.resetsIn,"7 Day Login Event",'<button class="ev-x" type="button" data-events-close aria-label="Close">Close</button>')+hr(e.rungs,e.claimed,e.ready)+'<div class="ev-foot">'+ha(e.gained)+ui(e.ready,e.full)+"</div></div></div>"}function bi(t,{onBack:e,onPick:a,onClaim:r,onTab:s,onReroll:o,onSeasonalFight:i,onSeasonalDraw:n,onSeasonalHelp:l,onNewWorldClaim:d}={}){let h=t.querySelector("[data-events-back]");h&&e&&h.addEventListener("click",()=>e());let f=t.querySelector("[data-events-claim]");f&&r&&f.addEventListener("click",()=>r());let m=t.querySelector("[data-pass-claim]");if(m&&r&&m.addEventListener("click",()=>r()),s)for(let y of["daily","weekly","season"]){let E=t.querySelector('[data-pass-tab="'+y+'"]');E&&E.addEventListener("click",()=>s(y))}let v=t.querySelector("[data-pass-reroll]");if(v&&o&&v.addEventListener("click",()=>{let y=t.querySelector(".pv-m:not(.done)[data-mission]");y&&o(y.getAttribute("data-mission"))}),i)for(let y of Ye){let E=t.querySelector('[data-seasonal-fight="'+y.difficulty+'"]');E&&E.addEventListener("click",()=>i(y.difficulty))}let b=t.querySelector("[data-seasonal-draw]");b&&n&&b.addEventListener("click",()=>n());let w=t.querySelector("[data-newworld-claim]");w&&d&&w.addEventListener("click",()=>d());let c=t.querySelector("[data-seasonal-help]");if(c&&l&&c.addEventListener("click",()=>l()),l){let y=t.querySelector(".sv-modal-veil[data-seasonal-help-close]");y&&y.addEventListener("click",()=>l());let E=t.querySelector("button[data-seasonal-help-close]");E&&E.addEventListener("click",()=>l())}if(a)for(let y of sr){let E=t.querySelector('[data-event="'+y.id+'"]');E&&y.live!==!1&&E.addEventListener("click",()=>a(y.id))}}function yi(t,{onClose:e,onClaim:a}={}){let r=t.querySelector("[data-events-close]");r&&e&&r.addEventListener("click",()=>e());let s=t.querySelector("[data-events-claim]");s&&a&&s.addEventListener("click",()=>a());let o=t.querySelector(".ev-veil");o&&e&&o.addEventListener("click",()=>e())}var pa=[{id:"ach-rank",cat:"campaign",kind:"rank",steps:[3,5,8,12,16,20,25,30,40]},{id:"ach-login",cat:"campaign",kind:"login-day",steps:[3,7,14,21,30,45,60,90,120]},{id:"ach-story",cat:"campaign",kind:"story-clear",steps:[3,8,15,25,40,60,85,115,150]},{id:"ach-node",cat:"campaign",kind:"node-clear",steps:[3,8,15,30,50,80,120,180,250]},{id:"ach-chapter",cat:"campaign",kind:"chapter-clear",steps:[1,2,3,5,7,10,13,16,20]},{id:"ach-hard",cat:"campaign",kind:"hard-clear",steps:[1,5,12,25,45,70,100,140,200]},{id:"ach-level",cat:"training",kind:"level-up",steps:[5,15,30,60,100,160,250,380,550]},{id:"ach-ascend",cat:"training",kind:"ascend",steps:[1,3,6,10,15,21,28,36,45]},{id:"ach-form",cat:"training",kind:"form-up",steps:[3,8,15,25,40,60,85,115,150]},{id:"ach-relic",cat:"training",kind:"relic-feed",steps:[3,8,15,25,40,60,85,115,150]},{id:"ach-equip",cat:"training",kind:"equip",steps:[4,10,20,35,55,80,110,145,185]},{id:"ach-farm",cat:"expedition",kind:"farm-clear",steps:[3,8,15,30,50,80,120,180,250]},{id:"ach-vigor",cat:"expedition",kind:"vigor-spent",steps:[100,300,750,1500,3e3,6e3,1e4,16e3,25e3]},{id:"ach-drop",cat:"expedition",kind:"relic-drop",steps:[2,6,12,22,36,55,80,110,150]},{id:"ach-summon",cat:"summon",kind:"summon",steps:[5,10,25,50,100,200,350,600,1e3]},{id:"ach-5star",cat:"summon",kind:"summon-5star",steps:[1,2,4,7,11,16,22,30,40]},{id:"ach-facet",cat:"summon",kind:"facet",steps:[1,3,6,10,15,21,28,36,45]}],fa=[{id:"campaign",label:"Campaign"},{id:"training",label:"Training"},{id:"expedition",label:"Expeditions"},{id:"summon",label:"Summoning"}],Ld=["rank"],Bf=(()=>{let t=new Set(Object.keys(or));for(let e of pa)Ld.indexOf(e.kind)>=0||t.add(e.kind);return t})();function Me(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function dt(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var Md=["I","II","III","IV","V","VI"];function Od(t){let e=Math.max(1,Math.round(Number(t)||1));return Md[e-1]||String(e)}function Bd(t){let e=t&&Array.isArray(t.rows)?t.rows:null;if(e&&e.length)return{rows:e,cats:Array.isArray(t.cats)?t.cats:[],ready:Math.max(0,Math.round(Number(t.ready)||0)),readyAether:Math.max(0,Math.round(Number(t.readyAether)||0)),claimed:Math.max(0,Math.round(Number(t.claimed)||0)),steps:Math.max(0,Math.round(Number(t.steps)||0))};let a=pa.map(s=>({id:s.id,cat:s.cat,kind:s.kind,done:0,goal:s.id+"-1",need:s.steps[0],text:"",tier:1,tiers:s.steps.length,aether:0,ready:!1,readyHere:0,complete:!1,steps:s.steps.map((o,i)=>({id:s.id+"-"+(i+1),step:i,need:o,aether:0,text:"",claimed:!1,ready:!1}))})),r=fa.map(s=>{let o=a.filter(i=>i.cat===s.id);return{id:s.id,label:s.label,ladders:o.length,steps:o.reduce((i,n)=>i+n.tiers,0),claimed:0,ready:0,readyAether:0}});return{rows:a,cats:r,ready:0,readyAether:0,claimed:0,steps:a.reduce((s,o)=>s+o.tiers,0)}}function zd(t){let e=Array.isArray(t.steps)?t.steps:[];if(!e.length)return"";let a="";for(let r of e){let s=r.claimed?" done":r.ready?" ready":"";a+='<span class="ac-step'+s+'">'+Me(r.need)+"</span>"}return a}function Fd(t){let e=Math.max(0,Math.round(Number(t.done)||0)),a=Math.max(1,Math.round(Number(t.need)||1)),r=t.complete?100:Math.min(100,Math.round(e/a*100)),s=["ac-row",t.complete?"done":"",t.ready?"ready":""].filter(Boolean).join(" "),o='<button class="ac-claim" type="button"'+(t.ready?' data-ach-claim="'+dt(t.goal)+'"':" disabled")+">Claim</button>";return'<div class="'+s+'"><span class="ac-tier">'+Od(t.tier)+'</span><span class="ac-what"><b class="ac-goal">'+dt(t.text)+'</b><span class="ac-bar"><i style="width:'+r+'%"></i></span><span class="ac-steps">'+zd(t)+'</span></span><span class="ac-count"><b>'+Me(Math.min(e,a))+'</b><span class="ac-of">/ '+Me(a)+'</span></span><span class="ac-pay"><span class="ac-prize"><span class="ac-amt">'+ne("aether")+"<b>"+Me(t.aether)+"</b></span>"+(t.readyHere>1?'<span class="ac-more">'+t.readyHere+" ready</span>":"")+"</span>"+o+"</span></div>"}function Pd(t,e){return'<button class="ac-cat'+(e?" on":"")+'" type="button" data-ach-cat="'+dt(t.id)+'"><span class="ac-cat-nm">'+dt(t.label)+'</span><span class="ac-cat-n">'+Me(t.claimed)+" / "+Me(t.steps)+"</span>"+(t.ready?'<span class="ac-cat-dot"></span>':"")+"</button>"}function wi({view:t,cat:e,from:a="Home"}={}){let r=Bd(t),s=r.cats.length?r.cats:fa.map(l=>({...l,claimed:0,steps:0,ready:0,readyAether:0})),o=s.find(l=>l.id===e)||s[0],i=r.rows.filter(l=>l.cat===(o&&o.id)),n=r.ready?'<button class="ac-all" type="button" data-ach-claim-all>Claim all<span class="ac-all-n">'+ne("aether")+"<b>"+Me(r.readyAether)+"</b></span></button>":"";return'<div class="root"><div class="stage"></div><section class="screen" data-screen="achievements"><div class="head"><button class="back" type="button" data-ach-back>&#9664; '+dt(a)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Achievements</h2></div></div><div class="body"><div class="ac-top"><span class="ac-tally"><b>'+Me(r.claimed)+"</b><span>of "+Me(r.steps)+" claimed</span></span>"+n+'</div><div class="ac-cols"><div class="ac-rail">'+s.map(l=>Pd(l,o&&l.id===o.id)).join("")+'</div><div class="ac-pane"><div class="ac-pane-id"><b>'+dt(o?o.label:"")+"</b><span>"+Me(o?o.ready:0)+' ready</span></div><div class="ac-list">'+i.map(Fd).join("")+"</div></div></div></div></section></div>"}function xi(t,{onBack:e,onPick:a,onClaim:r,onClaimAll:s}={}){let o=t.querySelector("[data-ach-back]");o&&e&&o.addEventListener("click",()=>e());let i=t.querySelector("[data-ach-claim-all]");if(i&&s&&i.addEventListener("click",()=>s()),a)for(let n of fa){let l=t.querySelector('[data-ach-cat="'+n.id+'"]');l&&l.addEventListener("click",()=>a(n.id))}if(r)for(let n of pa)for(let l=1;l<=n.steps.length;l+=1){let d=n.id+"-"+l,h=t.querySelector('[data-ach-claim="'+d+'"]');h&&h.addEventListener("click",()=>r(d))}}var ki=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

/* The spacing scale is DECLARED here: an undeclared var() is an invalid declaration the browser
   drops silently, collapsing every padding to zero. */
.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
/* Every screen paints its stage. Settings was the one without it and its plates sank. */
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) with the :has() row, never auto 1fr: hoistHeadIntoBar REMOVES the .head and a
   two-fixed-row screen drops its only child into the AUTO row, sized to its content. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

/* min-width 0 down the whole chain: grid and flex items default to min-width auto and cannot shrink
   below their content, which is how a wide row makes the SCREEN scroll sideways. */
.body { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
/* The top air left with the hoisted .head: restored ONLY in the hoisted case. */
.screen:not(:has(> .head)) .body { padding-top: var(--sp-2); }

/* CORAL AS TEXT ALWAYS SITS ON --ink HERE, never on --ink-2, and that is measured: across the five
   styles coral over --ink-2 is 4.35:1 in bloom, under the 4.5 line, while over --ink it is 4.87.
   The palette is the house one; what this screen controls is which surface the text lands on. */
/* The summary is CHROME: it never gives up height. What yields is the list, the region that
   scrolls -- the same rule as the Settings plates. */
.ac-top { flex: none; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); background: var(--ink); border: 1px solid var(--ink-3); border-top: 2px solid var(--coral); --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.ac-tally { min-width: 0; display: flex; align-items: baseline; gap: var(--sp-1); }
.ac-tally b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--coral); }
.ac-tally span { font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); color: var(--steel-faint); }
.ac-all { cursor: pointer; flex: none; display: flex; align-items: center; gap: var(--sp-2); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.45) var(--sp-3); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.ac-all:hover { background: var(--coral-deep); border-color: var(--coral-deep); }
.ac-all-n { display: flex; align-items: center; gap: calc(var(--f) * 0.2); font-size: var(--t-tiny); letter-spacing: 0.06em; }
.ac-all-n b { font-weight: 700; }

/* The rail and the pane, the same split Summon and Events use. min-width 0 down the whole chain. */
.ac-cols { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; gap: var(--sp-2); }
/* The rail takes its width from the TEXT ramp, so it stays readable when the player scales type up.
   14.5 and not 13: measured at 175%, the longest label clipped by 2px at 13 -- a box that holds
   TEXT is sized by its longest label plus room, not by the geometry. */
.ac-rail { flex: none; width: calc(var(--f) * 14.5); min-height: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
/* A rail card is a GRID with its own rows and one column: the dot has a cell of its own, so it can
   never sit on top of the label. */
.ac-cat { cursor: pointer; text-align: left; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--sp-1); padding: var(--sp-2) var(--sp-2); background: var(--ink); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
/* NO lighter fill on the active card: measured, coral text over --ink-3 is 3.24:1 in bloom against
   4.35 over --ink-2, so the fill made the one label that must read the hardest to read. The edge
   and the label carry the state, which is what the Events rail already does. */
.ac-cat.on { border-left-color: var(--coral); }
.ac-cat:hover { border-color: var(--coral); }
.ac-cat-nm { min-width: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ac-cat.on .ac-cat-nm { color: var(--coral); }
.ac-cat-n { grid-column: 1; font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); }
.ac-cat-dot { grid-column: 2; grid-row: 1 / span 2; width: calc(var(--f) * 0.5); height: calc(var(--f) * 0.5); background: var(--coral); border-radius: 50%; }

.ac-pane { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3) var(--sp-3); background: var(--ink-2); border: 1px solid var(--ink-3); border-top: 2px solid var(--coral); --cut: 0.8em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.ac-pane-id { flex: none; min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.ac-pane-id b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.ac-pane-id span { font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); white-space: nowrap; }

/* THE ONLY REGION THAT SCROLLS, inside its own box. min-height 0 or the flex item refuses to shrink
   and the scroll escapes to the screen. */
/* safe center, not center: three ladders would pin the rows to the top with two thirds of the panel
   empty, and plain centring sends the overflow out of BOTH edges -- the top half then cannot be
   scrolled to, because scroll does not go negative. */
.ac-list { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; display: flex; flex-direction: column; justify-content: safe center; gap: var(--sp-2); }

/* Four columns, one row: two children cannot overlap by construction. The count column is sized off
   the text ramp. */
.ac-row { display: grid; grid-template-columns: calc(var(--f) * 2.6) minmax(0, 1fr) calc(var(--f) * 9) calc(var(--f) * 12.5); align-items: center; gap: var(--sp-2); padding: calc(var(--f) * 0.55) var(--sp-3); background: var(--ink); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.ac-row.ready { border-left-color: var(--coral); }
.ac-row.done { border-left-color: var(--steel-dark); opacity: 0.62; }

.ac-tier { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.06em; text-align: center; color: var(--steel-faint); }
.ac-row.ready .ac-tier { color: var(--coral); }

.ac-what { min-width: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.ac-goal { min-width: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.03em; text-transform: var(--case); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ac-bar { display: block; height: calc(var(--f) * 0.4); background: var(--ink-3); border-radius: var(--radius-sm); overflow: hidden; }
.ac-bar i { display: block; height: 100%; background: var(--coral); }
.ac-row.done .ac-bar i { background: var(--steel-faint); }

.ac-count { min-width: 0; display: flex; align-items: baseline; justify-content: flex-start; gap: var(--sp-1); }
.ac-count b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); color: var(--text); }
.ac-of { font-size: var(--t-tiny); color: var(--steel-faint); }

/* THE LADDER ITSELF, INSIDE the text block and not a second grid row. As its own row it left the
   count and the Claim button pinned to the TOP line; making those span both rows narrowed the strip,
   grew the row to 98px and produced an overlap plus four clipped labels. Inside the text block the
   row is ONE grid row again, so align-items center works by construction.
   It WRAPS instead of scrolling: one region scrolls, and it is the list. */
.ac-steps { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: calc(var(--f) * 0.3); }
.ac-step { font-size: var(--t-tiny); letter-spacing: 0.06em; padding: calc(var(--f) * 0.12) calc(var(--f) * 0.45); background: var(--ink); border: 1px solid var(--ink-3); color: var(--steel-faint); border-radius: var(--radius-sm); }
.ac-step.done { border-color: var(--steel-dark); color: var(--steel-faint); opacity: 0.55; }
.ac-step.ready { border-color: var(--coral); color: var(--coral); }

/* NO justify-content: flex-end HERE, and that is a measured bug. A flex row whose content does not
   fit overflows out of the START edge with flex-end, so the amount landed 18px INSIDE the
   neighbouring column, on top of its pips -- no overflow measurement sees it, the box never grew.
   margin-left: auto keeps the layout and sends the overflow out of the END edge, where overflow
   hidden clips it against its own box. */
/* TWO FIXED SUB-COLUMNS, not a flex row hugging the right edge: right-aligned, the block's width
   changed with what it carried and the reward landed at THREE different x positions down one panel
   (1233, 1242, 1266). A column that moves per row is not a column.
   The tracks are sized off the WIDEST content each holds, so the old escape cannot come back. */
.ac-pay { min-width: 0; display: grid; grid-template-columns: calc(var(--f) * 4.8) calc(var(--f) * 5.8); align-items: center; justify-items: center; gap: var(--sp-1); overflow: hidden; }
/* The amount and the pending count STACK: side by side they demanded 69px of a 107px column and the
   Claim button had nowhere to go. Stacked the column needs the wider of the two, not their sum.
   CENTERED, not end-aligned: the two lines are 39px and 58px wide, so flush-right left the figure
   hanging off to one side instead of reading as one block. */
.ac-prize { min-width: 0; display: flex; flex-direction: column; align-items: center; }
/* The glyph rides WITH the number, in one box: a bare figure does not say what it is. */
.ac-amt { display: flex; align-items: center; gap: calc(var(--f) * 0.25); color: var(--coral); }
.ac-amt b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); color: var(--coral); }
.ac-amt .glyph { width: calc(var(--f) * 0.95); height: calc(var(--f) * 0.95); flex: none; }
.ac-all-n .glyph { width: calc(var(--f) * 0.8); height: calc(var(--f) * 0.8); flex: none; }
.ac-more { font-size: var(--t-tiny); letter-spacing: 0.06em; text-transform: var(--case); color: var(--steel-faint); white-space: nowrap; }
.ac-claim { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); white-space: nowrap; }
.ac-claim:hover:not([disabled]) { background: var(--coral-deep); border-color: var(--coral-deep); }
/* OFF, not gone: the button keeps its box so the column does not change shape row by row. The same
   pair the locked rail entries use, so a dead control looks the same everywhere in the game. */
.ac-claim[disabled] { cursor: default; background: var(--ink-3); border-color: var(--steel-dark); color: var(--steel-faint); }
`;function pr(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function be(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var Dd='<svg class="glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Si='<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg>';function qd(t){let e=t&&t.grants||{};return e.vigor?Dd:e.summon?ne("aether"):e.reroll?ne("relic"):Si}function $d(t,e){let a=$o(t),r=t.live!==!1,s=r&&a!=null&&Number(e)>=a,o=["sh-card",r?"":"off",r&&!s?"short":""].filter(Boolean).join(" "),i=r?'<button class="sh-buy" type="button"'+(s?' data-shop-buy="'+be(t.id)+'"':" disabled")+">"+ne("aether")+"<b>"+pr(a)+"</b></button>":'<span class="sh-soon">'+be(t.note||"Not open yet")+"</span>";return'<div class="'+o+'"><span class="sh-art">'+qd(t)+'</span><b class="sh-name">'+be(t.name)+'</b><span class="sh-what">'+be(na(t))+"</span>"+i+"</div>"}function jd(t,e){let a=60,r=t&&t.owned===!0,s=!r&&Number(e)>=a,o=["sh-card","sh-look",r?"owned":"",!r&&!s?"short":""].filter(Boolean).join(" "),i=t&&t.url?'<img class="sh-photo" src="'+be(t.url)+'" alt="" loading="lazy">':'<span class="sh-photo-none">'+Si+"</span>",n=r?'<span class="sh-owned">Owned</span>':'<button class="sh-buy" type="button"'+(s?' data-shop-outfit="'+be(t.id)+'"':" disabled")+">"+ne("aether")+"<b>"+pr(a)+"</b></button>";return'<div class="'+o+'"><span class="sh-art sh-art-photo">'+i+'</span><b class="sh-name">'+be(t&&t.unitName||"")+'</b><span class="sh-what">'+be(t&&t.name||"")+"</span>"+n+"</div>"}function Ud(){return`<div class="sh-empty"><b>This rotation's looks are being made</b><span>Two new outfits arrive with every banner. Come back in a moment.</span></div>`}function _i(t,e){if(!t||!e||!t.unlock)return null;let a=e[t.unlock];return a&&(Number(a.rank)>0||a.off===!0)?a:null}function Wd(t,e,a,r){let s=t.id==="outfit",o=s?Array.isArray(a)?a:[]:tr(t.id),i=o.length,n=s?o.filter(h=>!h.owned).length:o.filter(h=>h.live!==!1).length,l=t.live===!1||!!r,d=t.live===!1?be(t.note||"Soon"):r&&r.off?"Off":r?"Rank "+r.rank:n+" of "+i;return'<button class="sh-cat'+(e?" on":"")+(l?" off":"")+'" type="button"'+(l?" disabled":' data-shop-cat="'+be(t.id)+'"')+'><span class="sh-cat-nm">'+be(t.label)+'</span><span class="sh-cat-n">'+d+"</span></button>"}function Ei({wallet:t=null,cat:e,from:a="Home",outfits:r=null,locks:s=null}={}){let o=Math.max(0,Math.round(Number(t&&t.glimmer)||0)),i=oa.filter(f=>f.live!==!1&&!_i(f,s)),n=i.find(f=>f.id===e)||i[0]||null,l=n?tr(n.id):[],d=Array.isArray(r)?r:[],h=!!n&&n.id==="outfit";return'<div class="root"><div class="stage"></div><section class="screen" data-screen="shop"><div class="head"><button class="back" type="button" data-shop-back>&#9664; '+be(a)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Shop</h2></div></div><div class="body"><div class="sh-top"><span class="sh-bal">'+ne("aether")+"<b>"+pr(o)+'</b><span>Glimmer</span></span><span class="sh-hint">Every summon pays Glimmer</span></div><div class="sh-cols"><div class="sh-rail">'+oa.map(f=>Wd(f,n&&f.id===n.id,d,_i(f,s))).join("")+'</div><div class="sh-pane"><div class="sh-pane-id"><b>'+be(n?n.label:"")+"</b></div>"+(h?'<div class="sh-grid sh-grid-look">'+(d.length?d.map(f=>jd(f,o)).join(""):Ud())+"</div>":'<div class="sh-grid">'+l.map(f=>$d(f,o)).join("")+"</div>")+"</div></div></div></section></div>"}function Ti(t,{onBack:e,onPick:a,onBuy:r,onBuyOutfit:s}={}){let o=t.querySelector("[data-shop-back]");if(o&&e&&o.addEventListener("click",()=>e()),a)for(let i of oa){let n=t.querySelector('[data-shop-cat="'+i.id+'"]');n&&n.addEventListener("click",()=>a(i.id))}if(r)for(let i of ia){let n=t.querySelector('[data-shop-buy="'+i.id+'"]');n&&n.addEventListener("click",()=>r(i.id))}if(s)for(let i of t.querySelectorAll("[data-shop-outfit]")){let n=i.getAttribute("data-shop-outfit");n&&i.addEventListener("click",()=>s(n))}}var Ai=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

/* The spacing scale is DECLARED here: the theme declares the TEXT ramp only, and an undeclared var()
   is an invalid declaration the browser drops silently, collapsing every padding to zero. */
.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) with the :has() row, never auto 1fr: hoistHeadIntoBar REMOVES the .head and a two-
   fixed-row screen drops its only child into the AUTO row, sized to its content. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

.body { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
.screen:not(:has(> .head)) .body { padding-top: var(--sp-2); }

/* CORAL AS TEXT ALWAYS SITS ON --ink HERE, never on --ink-2: measured across the five styles, coral
   over --ink-2 is 4.35:1 in bloom (under the 4.5 line) and 4.87 over --ink. */
.sh-top { flex: none; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); background: var(--ink); border: 1px solid var(--ink-3); border-top: 2px solid var(--coral); --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.sh-bal { min-width: 0; display: flex; align-items: center; gap: var(--sp-1); color: var(--coral); }
.sh-bal .glyph { width: calc(var(--f) * 1.3); height: calc(var(--f) * 1.3); flex: none; }
.sh-bal b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); }
.sh-bal span { font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); }
.sh-hint { font-size: var(--t-tiny); letter-spacing: 0.06em; text-transform: var(--case); color: var(--steel-faint); white-space: nowrap; }

.sh-cols { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; gap: var(--sp-2); }
/* The rail takes its width from the text ramp, sized by its longest label plus room -- a box that
   holds TEXT is not sized by geometry. */
/* THE RAIL SCROLLS INSIDE ITS OWN BOX, which is what gives it room to grow: measured, eight
   categories fit and twelve do not, and without this it would spill with no measurement seeing it. */
.sh-rail { flex: none; width: calc(var(--f) * 14.5); min-height: 0; overflow-y: auto; scrollbar-gutter: stable; display: flex; flex-direction: column; gap: var(--sp-1); }
.sh-cat { flex: none; }
.sh-cat { cursor: pointer; text-align: left; display: grid; gap: calc(var(--f) * 0.15); padding: var(--sp-2); background: var(--ink); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.sh-cat.on { border-left-color: var(--coral); }
.sh-cat:hover:not([disabled]) { border-color: var(--coral); }
.sh-cat[disabled] { cursor: default; opacity: 0.55; }
.sh-cat-nm { min-width: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-cat.on .sh-cat-nm { color: var(--coral); }
.sh-cat-n { font-size: var(--t-tiny); letter-spacing: 0.06em; text-transform: var(--case); color: var(--steel-faint); }

.sh-pane { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3) var(--sp-3); background: var(--ink-2); border: 1px solid var(--ink-3); border-top: 2px solid var(--coral); --cut: 0.8em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.sh-pane-id { flex: none; min-width: 0; }
.sh-pane-id b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

/* THE ONLY REGION THAT SCROLLS, inside its own box.
   auto-fill and NOT auto-fit: auto-fit collapses the empty tracks and stretches the cards, so three
   items would draw at twice the size of twelve. A card that changes size with its sibling count is
   not a card.
   The minimum is 14f because a box that holds TEXT is sized by its longest label: the widest line
   needs 11.8f plus padding, and at 11f three labels were clipped.
   START, NOT CENTRED (the author's call): a shop fills from the top and grows down, so three items
   have to sit where twelve start. What fixed the empty look was the card getting a real art box. */
.sh-grid { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 14), 1fr)); align-content: start; gap: var(--sp-2); }

/* A CARD IS A GRID OF ROWS: nothing absolute, so two children cannot overlap by construction. */
.sh-card { display: grid; grid-template-rows: auto auto auto auto; justify-items: center; gap: calc(var(--f) * 0.3); padding: var(--sp-2) var(--sp-1); background: var(--ink); border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.sh-card.off { opacity: 0.55; }
/* An OUTFIT tile: the art IS the product, so it leads and gets the room. A 2:3 plate at a key
   item's width would be a stamp. */
/* The outfit shelf GROWS: two pieces arrive every rotation and the earlier ones stay on sale. That
   is why it starts at the beginning and never centres -- a shop fills from the top. An early world
   sees two tiles and a lot of room, and that room is what the next rotations take.
   The column is BOUNDED (not 1fr) so two tiles do not blow up to half the pane each. */
/* FOUR across, filling the pane edge to edge: a capped column fit only three and left the fourth
   slot empty. The floor is in --f, so a bigger letter size drops to three instead of squeezing
   four into unreadable tiles. */
.sh-grid-look { grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 17), 1fr)); justify-content: start; }
.sh-look .sh-art-photo { align-self: start; justify-self: stretch; width: 100%; height: auto; aspect-ratio: 2 / 3; overflow: hidden; padding: 0; }
/* object-fit NORMALISES: generated art arrives at whatever the backend felt like, and a plate that
   grew with its image would make every tile a different height. */
.sh-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
.sh-photo-none { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--steel-faint); }
.sh-photo-none .glyph { width: calc(var(--f) * 3.2); height: calc(var(--f) * 3.2); }
/* Owned reads as a STATE, not a disabled button: a greyed price still looks like something to buy. */
.sh-owned { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); color: var(--jade); }
/* The owned marker needs the extra class to WIN: .sh-card:not(.off) has the same specificity and is
   declared later, so an owned tile looked exactly like one for sale. Measured, not eyeballed -- a
   coral hairline against a jade one is invisible at review size. */
.sh-card.sh-look.owned { border-top-color: var(--jade); }
.sh-look.owned .sh-art-photo { opacity: 0.72; }
/* The shelf can be empty while the art paints. It says WHAT is happening: an empty grid reads as
   broken. */
.sh-empty { grid-column: 1 / -1; display: grid; gap: calc(var(--f) * 0.4); justify-items: center; text-align: center; padding: var(--sp-3); color: var(--steel-faint); }
.sh-empty b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.sh-empty span { font-size: var(--t-tiny); letter-spacing: 0.04em; max-width: calc(var(--f) * 24); }
.sh-card:not(.off) { border-top-color: var(--coral); }
/* THE ART BOX IS BIG ON PURPOSE, not padding: at 2.6f the card measured 209x140 and a single row
   left ~350px of panel in black -- every measurement read zero and the screen looked empty. It is
   also where an outfit's ART goes. */
.sh-art { display: flex; align-items: center; justify-content: center; height: calc(var(--f) * 6.4); background: var(--ink-2); border-radius: var(--radius-sm); align-self: stretch; color: var(--coral); }
.sh-card.off .sh-art { color: var(--steel-faint); }
.sh-art .glyph { width: calc(var(--f) * 3.2); height: calc(var(--f) * 3.2); }
/* IT WRAPS, IT IS NOT CLIPPED, and with no N-line clamp: a clamp becomes a lie the moment the
   player scales the type up. The STRESS case with long names uncovered it -- with the five real
   items nothing was clipped. */
.sh-name { min-width: 0; max-width: 100%; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.03em; text-transform: var(--case); color: var(--text); text-align: center; overflow-wrap: anywhere; }
.sh-what { min-width: 0; max-width: 100%; font-size: var(--t-tiny); letter-spacing: 0.04em; color: var(--steel-faint); text-align: center; overflow-wrap: anywhere; }
.sh-soon { font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); white-space: nowrap; }

.sh-buy { cursor: pointer; display: flex; align-items: center; gap: calc(var(--f) * 0.25); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.06em; padding: calc(var(--f) * 0.3) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); white-space: nowrap; }
.sh-buy:hover:not([disabled]) { background: var(--coral-deep); border-color: var(--coral-deep); }
.sh-buy .glyph { width: calc(var(--f) * 0.9); height: calc(var(--f) * 0.9); flex: none; }
/* OFF, not gone: the price stays readable so the player knows the target. Same pair the locked rail
   entries use. */
.sh-buy[disabled] { cursor: default; background: var(--ink-3); border-color: var(--steel-dark); color: var(--steel-faint); }
`;function Nt(t){return(Number(t)||0).toLocaleString("en-US")}function Ni(t){if(!t)return[];let e=[];Number(t.funds)>0&&e.push({kind:"funds",qty:Number(t.funds),name:"Funds"}),Number(t.aether)>0&&e.push({kind:"aether",qty:Number(t.aether),name:"Aether"});let a=t.insight||{},r={shard:"Insight Shard",core:"Insight Core",prism:"Insight Prism"};for(let s of["shard","core","prism"])Number(a[s])>0&&e.push({kind:"xp",qty:Number(a[s]),name:r[s]});return e}function Ii(t){return t?t.relic?[]:[{kind:/Funds/i.test(String(t.material))?"funds":/Insight/i.test(String(t.material))?"xp":"asc",qty:Number(t.qty)||0,name:String(t.material||"")}]:[]}var Ci=lt+`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;

  /* THE SHARED RAMP, never a private one. There were TWO in the project and this screen used the
     small one, ~12% below the rest: the symptom was "nothing is readable". A per-screen ramp is
     the same class of bug as a copied colour token. */






  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(70% 60% at 50% 30%, var(--glow-1) 0%, transparent 60%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); padding: var(--sp-3); pointer-events: auto; }

/* \u2500\u2500 The verdict \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rs-verdict { flex: none; text-align: center; }
.rs-verdict h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-2xl); line-height: 1; letter-spacing: 0.12em; text-transform: var(--case); color: var(--amber); text-shadow: 0 0 18px color-mix(in srgb, var(--amber) 45%, transparent); }
.root.lose .rs-verdict h2 { color: var(--alarm); text-shadow: 0 0 18px color-mix(in srgb, var(--alarm) 45%, transparent); }
.rs-verdict .rs-where { display: block; margin-top: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.24em; text-transform: var(--case); color: var(--steel-faint); }

/* \u2500\u2500 The loot \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.rs-loot { flex: none; display: flex; align-items: stretch; justify-content: center; gap: var(--sp-2); flex-wrap: wrap; max-width: 92%; }
.rs-rw { min-width: calc(var(--f) * 7); display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.2); padding: var(--sp-2) var(--sp-3); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-top: 2px solid var(--amber); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius); }
.rs-rw .rs-ic { width: calc(var(--f) * 2.2); color: var(--amber); }
.rs-rw .rs-ic svg { width: 100%; height: auto; display: block; }
.rs-rw .rs-q { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); line-height: 1.1; letter-spacing: var(--track); color: var(--text); font-variant-numeric: tabular-nums; }
.rs-rw .rs-n { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); text-align: center; }
/* Nothing to show is a sentence, not a gap: a defeat lands here too. */
.rs-none { flex: none; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; line-height: 1.5; color: var(--steel-faint); text-align: center; max-width: 46%; }

/* The piece that dropped: the SAME inventory card, at its own width. */
.rs-piece { flex: none; width: min(30%, calc(var(--f) * 19)); display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); }
.rs-piece .rs-cap { text-align: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.24em; text-transform: var(--case); color: var(--amber); }

/* \u2500\u2500 The commander bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* THE BAR MOVES: it is drawn at the BEFORE value and the wiring animates it to the after value
   on the next frame, so the player SEES what they earned. The before value comes from the server
   (rank.from) -- deriving it by subtracting the gain lies as soon as a level-up is involved,
   because the xp resets and the subtraction goes negative. */
.rs-rank { flex: none; width: min(58%, calc(var(--f) * 34)); display: flex; flex-direction: column; gap: calc(var(--f) * 0.35); padding: var(--sp-2) var(--sp-3); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius); }
.rs-rank .rs-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
.rs-rank .rs-top b { font-family: var(--title); font-size: var(--t-md); letter-spacing: var(--track); color: var(--text); }
.rs-rank .rs-top .rs-gain { color: var(--jade); font-variant-numeric: tabular-nums; }
.rs-rank .rs-track { position: relative; height: calc(var(--f) * 0.5); background: var(--ink-3); border-radius: 999px; overflow: hidden; }
.rs-rank .rs-track i { position: absolute; inset: 0 auto 0 0; display: block; width: 0; background: linear-gradient(90deg, var(--amber-deep), var(--amber)); border-radius: 999px; transition: width 900ms var(--ease); }
.rs-rank .rs-foot { display: flex; align-items: baseline; justify-content: space-between; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
/* A rank-up lifts the level ceiling of EVERY unit: that is the consequence, so it says that
   instead of a bare "Rank up!". */
.rs-rank .rs-up { display: none; align-items: center; flex-wrap: wrap; gap: calc(var(--f) * 0.4) calc(var(--f) * 1); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--amber); }
.rs-rank.leveled .rs-up { display: flex; }
.rs-rank .rs-up b { color: var(--text); font-variant-numeric: tabular-nums; }

.rs-acts { flex: none; display: flex; gap: var(--sp-2); margin-top: var(--sp-1); }
.rs-acts button { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.55) var(--sp-3); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.rs-acts button:hover { background: var(--coral-deep); border-color: var(--coral-deep); }
.rs-acts button.ghost { background: transparent; border-color: var(--steel-dark); color: var(--text); }
.rs-acts button.ghost:hover { border-color: var(--amber); color: var(--amber); }
`;function Vd(t){return'<div class="rs-rw"><span class="rs-ic">'+ne(t.kind)+'</span><span class="rs-q">'+(Number(t.qty)>0?"+"+Nt(t.qty):Nt(t.qty))+'</span><span class="rs-n">'+u(t.name)+"</span></div>"}function fr(t,e){let a=Number(e);return!Number.isFinite(a)||a<=0?100:Math.max(0,Math.min(100,Math.round(Number(t)/a*1e3)/10))}function Ri({outcome:t="win",where:e="",rewards:a=[],relic:r=null,rank:s=null,canReplay:o=!1}={}){let i=t!=="lose",n=Array.isArray(a)?a:[],l=s&&s.from||null,d=l?fr(l.xp,l.xpNeeded):s?fr(s.xp,s.xpNeeded):0,h=s?fr(s.xp,s.xpNeeded):0,f=Number(s&&s.levels)||0;return'<div class="root'+(i?"":" lose")+'"><div class="stage"></div><section class="screen" data-screen="result"><div class="rs-verdict"><h2>'+(i?"Victory":"Defeat")+"</h2>"+(e?'<span class="rs-where">'+u(e)+"</span>":"")+"</div>"+(r?'<div class="rs-piece"><div class="rs-cap">A piece from the Vault</div>'+ct(r,{actions:!1})+"</div>":"")+(n.length?'<div class="rs-loot">'+n.map(Vd).join("")+"</div>":r?"":'<div class="rs-none">'+(i?"Nothing dropped here &mdash; this node pays in progress, not in materials.":"You keep nothing. The Vigor was spent when the stage started, so a loss costs the run.")+"</div>")+(s?'<div class="rs-rank'+(f>0?" leveled":"")+'" data-rank data-start="'+d+'" data-end="'+h+'" data-levels="'+f+'"><div class="rs-top"><span>Commander</span><b data-rank-level>'+Number(s.level)+'</b><span class="rs-gain">+'+Nt(s.gain)+' XP</span></div><div class="rs-track"><i data-rank-bar style="width:'+d+'%"></i></div><div class="rs-foot"><span data-rank-xp>'+Nt(s.xp)+" / "+(s.xpNeeded===null||s.xpNeeded===void 0?"&mdash;":Nt(s.xpNeeded))+" XP</span><span>"+(s.xpNeeded===null||s.xpNeeded===void 0?"At the rank cap":"to Commander "+(Number(s.level)+1))+"</span></div>"+(Number(s.vigorMax)>0&&Number(s.from&&s.from.vigorMax)>0?'<div class="rs-up">'+(Number(s.vigor)>0?"<span>Vigor <b>+"+Number(s.vigor)+"</b></span>":"")+"<span>Cap <b>"+Number(s.from.vigorMax)+" &rarr; "+Number(s.vigorMax)+"</b></span></div>":"")+"</div>":"")+'<div class="rs-acts">'+(o?'<button class="ghost" type="button" data-result-again>Run it again</button>':"")+'<button type="button" data-result-continue>Continue &rsaquo;</button></div></section></div>'}function Li(t,{onContinue:e,onAgain:a}={}){(t.querySelector(".root")||t).addEventListener("click",h=>{let f=h&&h.target&&h.target.closest?h.target:null;if(f){if(f.closest("[data-result-again]")){a&&a();return}f.closest("[data-result-continue]")&&e&&e()}});let s=t.querySelector("[data-rank]"),o=t.querySelector("[data-rank-bar]");if(!s||!o)return;let i=Number(s.getAttribute("data-end"))||0,n=Number(s.getAttribute("data-levels"))||0,l=(h,f)=>{typeof setTimeout=="function"&&setTimeout(f,h)},d=h=>{o.style&&(o.style.width=h+"%")};if(n>0){l(30,()=>d(100)),l(900,()=>{o.style&&(o.style.transition="none"),d(0),l(30,()=>{o.style&&(o.style.transition=""),d(i)})});return}l(30,()=>d(i))}var Gd=[{match:/:chapter:(\d+)$/,cost:"tokens",label:t=>`Forging chapter ${t[1]}`},{match:/:combat:(\d+):(\d+)$/,cost:"tokens",label:t=>`Designing a fight \xB7 chapter ${t[1]}`},{match:/:beat:(\d+):(\d+)$/,cost:"tokens",label:()=>"Writing the next scene"},{match:/:banner:char:/,cost:"tokens",label:()=>"Minting this week's characters"},{match:/:banner:wpn:/,cost:"tokens",label:()=>"Minting this week's weapons"},{match:/:banner:standard$/,cost:"tokens",label:()=>"Forging the founding cast"},{match:/:banner-art:/,cost:"images",label:()=>"Painting the banner"},{match:/:portrait$/,cost:"images",label:()=>"Painting a portrait"},{match:/:bg:/,cost:"images",label:()=>"Painting a location"},{match:/:unit:protagonist-weapon$/,cost:"tokens",label:()=>"Forging their signature weapon"},{match:/:unit:protagonist$/,cost:"tokens",label:()=>"Building your unit"}],Yd=[{at:"/banner",cost:"tokens",label:"Forging the founding cast"},{at:"/summon-banner",cost:"tokens",label:"Checking this week's banner"},{at:"/chapter-plan",cost:"tokens",label:"Forging the chapter"},{at:"/combat-guide",cost:"tokens",label:"Designing a fight"},{at:"/beat",cost:"tokens",label:"Writing the next scene"},{at:"/compress",cost:"tokens",label:"Compressing a chapter"},{at:"/portrait/upload",cost:"images",label:"Sending your image"},{at:"/portrait",cost:"images",label:"Painting a portrait"},{at:"/background",cost:"images",label:"Painting a location"},{at:"/banner-art",cost:"images",label:"Painting the banner"}],Kd=["/portrait/select"];function Mi(t){let e=String(t||"");if(Kd.includes(e))return null;for(let a of Yd)if(e===a.at||e.startsWith(a.at+"/"))return{cost:a.cost,label:a.label};return null}function Xd(t){let e=String(t||"");for(let a of Gd){let r=e.match(a.match);if(r)return{cost:a.cost,label:a.label(r)}}return e?{cost:"tokens",label:"Generating"}:null}function Jd(t){let e=Number(t&&t.total)||0;if(!e)return null;let a=Math.min(e,Number(t.done)||0);return{cost:"images",label:t&&t.name?`Painting ${t.name}`:"Painting portraits",detail:`${a+1} of ${e}`}}function Oi({generating:t=[],local:e=[],art:a=null,background:r=null}={}){let s=[],o=new Set,i=n=>{!n||o.has(n.label)||(o.add(n.label),s.push(n))};for(let n of Array.isArray(e)?e:[])i(n);for(let n of Array.isArray(t)?t:[])i(Xd(n));return i(Jd(a)),r&&i({cost:"images",label:"Painting a location",detail:String(r)}),s}function Bi(t){return(Array.isArray(t)?t:[]).map(e=>e.label+(e.detail||"")).join("|")}var zi=`
/* pointer-events: none on the WHOLE piece \u2014 what makes it truly non-intrusive: it can sit
   over any control and never steals the click. */
/* TOP CENTRE, not right \u2014 the engine draws its mandatory buttons there. The height depends on
   whether the screen carries the persistent bar: one fixed position would cover the hoisted
   title. */
.gb-busy {
  position: absolute; top: calc(var(--f, 12px) * 0.6); left: 50%; transform: translateX(-50%); z-index: 40;
  pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: calc(var(--f, 12px) * 0.3);
  font-family: var(--display); max-width: 46%;
  animation: gb-in 260ms var(--ease, ease) both;
}
/* With a bar, below it. The selector looks at the SHELL, so no screen has to know anything. */
.gf-arena:has(.gf-bar) .gb-busy { top: calc(var(--f, 12px) * 3.0); }
@keyframes gb-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translateX(-50%); } }

.gb-row {
  display: flex; align-items: center; gap: calc(var(--f, 12px) * 0.5);
  padding: calc(var(--f, 12px) * 0.32) calc(var(--f, 12px) * 0.7);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3);
  backdrop-filter: var(--panel-blur);
  --cut: 0.45em; clip-path: var(--clip-chip); border-radius: 999px;
  box-shadow: var(--panel-shadow);
  min-width: 0;
}
/* The pulse: the only thing that moves. A spinner demands attention; this only breathes. */
.gb-dot { flex: none; width: calc(var(--f, 12px) * 0.42); height: calc(var(--f, 12px) * 0.42); border-radius: 50%; background: var(--amber); animation: gb-pulse 1.6s ease-in-out infinite; }
.gb-row.images .gb-dot { background: var(--jade); }
@keyframes gb-pulse { 0%, 100% { opacity: 0.35; transform: scale(0.82); } 50% { opacity: 1; transform: scale(1); } }

.gb-what { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(var(--f, 12px) * 0.78); letter-spacing: 0.04em; color: var(--porcelain-3); }
.gb-what b { color: var(--text); font-weight: 400; }
/* What is being spent. The two classes are NOT interchangeable: text goes through the model
   and costs tokens; portraits go through the image API and never touch the ledger. */
.gb-cost { flex: none; font-size: calc(var(--f, 12px) * 0.62); letter-spacing: 0.16em; text-transform: var(--case); color: var(--amber); }
.gb-row.images .gb-cost { color: var(--jade); }
.gb-more { font-size: calc(var(--f, 12px) * 0.62); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); padding-right: calc(var(--f, 12px) * 0.7); }
`;function Fi(t,{max:e=2}={}){let a=Array.isArray(t)?t.filter(Boolean):[];if(!a.length)return"";let r=a.slice(0,e),s=a.length-r.length;return'<div class="gb-busy" data-busy aria-live="polite">'+r.map(o=>'<div class="gb-row '+(o.cost==="images"?"images":"text")+'"><span class="gb-dot"></span><span class="gb-what"><b>'+u(o.label)+"</b>"+(o.detail?" &middot; "+u(o.detail):"")+'</span><span class="gb-cost">'+(o.cost==="images"?"image":"tokens")+"</span></div>").join("")+(s>0?'<div class="gb-more">+'+s+" more running</div>":"")+"</div>"}function Hi(t){return t>=5?"\u2605\u2605\u2605\u2605\u2605":t===4?"\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605"}function ua(t){let e=Number(t)||0;return(e*100>=10,(e*100).toFixed(1)).replace(/\.0$/,"")+"%"}var Zd={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',material:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><path d="M50 20 78 52 50 110 22 52Z"/><path d="M50 20 50 110M22 52h56" stroke="#0E1420" stroke-opacity="0.35" stroke-width="3"/></g></svg>',glimmer:'<svg viewBox="0 0 100 130" aria-hidden="true"><path d="M50 22 76 52 50 108 24 52Z" fill="none" stroke="url(#gf-ssil)" stroke-width="5"/><path d="M50 45 56 60 71 66 56 72 50 87 44 72 29 66 44 60Z" fill="url(#gf-ssil)"/></svg>'};var ur='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="#F0B429" stroke="#B8860B" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2 7 12l5 10" stroke="#FFF" stroke-opacity="0.5" stroke-width="1.2"/></svg>',Qd='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="var(--on-coral)" stroke="var(--on-coral)" stroke-width="1.4" stroke-linejoin="round"/></svg>',eh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';var th='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" stroke="currentColor" stroke-width="1.8"/></svg>',ah='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',vr='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-ssil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',gr=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */



  --sp-1: calc(var(--f) * 0.5); --sp-2: calc(var(--f) * 1.0); --sp-3: calc(var(--f) * 1.6); --sp-4: calc(var(--f) * 2.4);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%), radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
/* The head is NOT always here: hoistHeadIntoBar moves it into the top bar and calls remove(),
   leaving this box with ONE child. With a fixed auto 1fr template that child lands in the AUTO row
   and sizes to its own content -- which is what left the dead band under Summon. No harness
   reproduces it: a harness renders the screen standalone and never hoists. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id { min-width: 0; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }
.wallet { margin-left: auto; display: inline-flex; align-items: center; gap: calc(var(--f) * 0.6); padding: calc(var(--f) * 0.4) var(--sp-2); background: color-mix(in srgb, var(--amber) 12%, var(--ink-2)); border: 1px solid color-mix(in srgb, var(--amber) 45%, transparent); --cut: 0.6em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.wallet svg { width: calc(var(--f) * 1.8); height: calc(var(--f) * 1.8); }
.wallet b { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--amber); font-variant-numeric: tabular-nums; }
.wallet small { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }

/* BANNERS ARE A LIST, NOT A MATRIX: it was two category tabs by two pool tabs, written by hand,
   and a fifth banner had nowhere to go. The rail draws whatever the server sends.
   The row must be pinned: an implicit auto row sizes to its CONTENT and left the stage empty. */
.banner-body { min-height: 0; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }

/* The rail. Fixed width in ramp units, so a long title cannot eat it. */
.rail { width: calc(var(--f) * 21); min-width: 0; min-height: 0; display: flex; }
/* CONTAINED region: the screen does not scroll, this list does. Without min-height 0 the flex item
   will not shrink and the scroll escapes to the parent. */
.rail-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); padding-right: calc(var(--f) * 0.3); }
.bcard { flex: none; cursor: pointer; text-align: left; display: flex; align-items: center; gap: var(--sp-2); padding: calc(var(--f) * 0.5); min-width: 0; background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); color: var(--text); font-family: var(--display); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease; }
.bcard:hover { border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-2) 96%, transparent); }
.bcard[aria-pressed="true"] { border-left-color: var(--coral); background: color-mix(in srgb, var(--coral) 14%, var(--ink-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 35%, transparent); }
.bcard:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.bcard[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.bcard[aria-disabled="true"]:hover { border-left-color: var(--steel-dark); background: color-mix(in srgb, var(--ink-2) 82%, transparent); }
.bt-face { flex: none; width: calc(var(--f) * 3.2); height: calc(var(--f) * 4.3); background-size: cover; background-position: center top; border-radius: var(--radius-sm); background-color: var(--ink-3); display: grid; place-items: center; overflow: hidden; }
.bt-face.sil { color: color-mix(in srgb, var(--epic) 60%, transparent); }
.bt-face.sil svg { width: 86%; height: 86%; }
.bt-face.empty svg { width: 46%; color: var(--steel-faint); }
.bt-id { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: calc(var(--f) * 0.16); }
.bt-id b { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-xs); letter-spacing: var(--track); text-transform: var(--case); line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-id i { font-style: normal; font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; color: var(--steel-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* The pity ON the card, with its number: there are four counters per world, and a bar alone is a
   qualitative sentence. */
.bt-pity { display: flex; align-items: center; gap: calc(var(--f) * 0.35); min-width: 0; }
.bt-track { flex: 1; min-width: 0; height: calc(var(--f) * 0.28); background: var(--ink-3); border-radius: 99px; overflow: hidden; }
.bt-track > i { display: block; height: 100%; background: var(--coral); }
.bt-pity em { font-style: normal; font-size: calc(var(--f) * 0.62 * var(--gf-type-scale, 1)); letter-spacing: 0.06em; color: var(--steel-faint); white-space: nowrap; }

.show { position: relative; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--ink-3); --cut: 0.9em; clip-path: var(--clip-card); border-radius: var(--radius); background: radial-gradient(120% 90% at 70% 0%, #33507A 0%, var(--glow-2) 55%, #0E1725 100%); box-shadow: var(--panel-shadow), var(--panel-bevel); }
/* With banner art, cover is CORRECT: the image is born landscape for this box. Without it the only
   art is the 2:3 portrait, and cover eats the face -- the VN portrait's lesson. */
.art { position: absolute; inset: 0; overflow: hidden; }
.art.wide { background-size: cover; background-position: center 22%; }
/* The fallback when no art exists: a plate at its own ratio over a blurred copy of itself. A
   degraded state that looks broken is worse than one that looks deliberate. */
.artback { position: absolute; inset: calc(var(--f) * -3); background-size: cover; background-position: center 30%; filter: blur(calc(var(--f) * 1.6)) saturate(0.9); opacity: 0.55; }
.artback.flat { background: radial-gradient(70% 60% at 60% 30%, var(--glow-1) 0%, transparent 70%); opacity: 1; }
.plates { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: flex-end; padding-right: var(--sp-3); }
.plate { height: 78%; aspect-ratio: 2 / 3; background-size: cover; background-position: center top; border-radius: var(--radius); }
.plate.four { height: 54%; margin-right: calc(var(--f) * -1.2); order: -1; opacity: 0.92; }
.plate.sil { height: 74%; aspect-ratio: 3 / 4; display: grid; place-items: center; color: color-mix(in srgb, var(--epic) 60%, transparent); }
.plate.sil svg { width: 100%; height: 100%; }
/* The veil rises from BELOW for the controls and falls from ABOVE for the name: generated art can
   be pale, and without this the label disappears. */
.veil { position: absolute; inset: 0; background: linear-gradient(0deg, color-mix(in srgb, var(--ground-2) 94%, transparent) 0%, color-mix(in srgb, var(--ground-2) 72%, transparent) 26%, transparent 55%), linear-gradient(180deg, color-mix(in srgb, var(--ground-2) 82%, transparent) 0%, transparent 34%); }
/* THE VEIL FOLLOWS THE GLYPHS, NOT A BOX. The sheet's veil falls to a FIXED 34% while this block's
   height is VARIABLE, so a two-line title at 150% dropped the subtitle onto bare art -- measured
   1.13:1.
   A PANEL BEHIND THE TEXT WAS THE WRONG SHAPE: it works, and the user threw it out on sight for its
   hard edge. What has to be darkened is what is UNDER THE LETTERS, so the veil IS the shadow. */
.bname { position: absolute; left: var(--sp-3); top: var(--sp-3); right: calc(var(--f) * 16); z-index: 2; }
.bname .kicker, .bname h3, .bname p { text-shadow: 0 1px 2px rgba(0,0,0,0.92), 0 0 6px rgba(0,0,0,0.85), 0 0 20px rgba(0,0,0,0.6); }
.bname .kicker { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.bname h3 { margin: calc(var(--f) * 0.15) 0 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-2xl); line-height: 1.0; letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
.bname p { margin: calc(var(--f) * 0.25) 0 0; font-size: var(--t-xs); color: var(--porcelain-3); }
/* What the splash does NOT show lives behind Details; redoing the art has its own button. */
.chips { position: absolute; right: var(--sp-3); top: var(--sp-3); z-index: 3; display: flex; gap: calc(var(--f) * 0.4); }
.chip { cursor: pointer; font-family: var(--display); font-size: calc(var(--f) * 0.78 * var(--gf-type-scale, 1)); letter-spacing: 0.14em; text-transform: var(--case); padding: calc(var(--f) * 0.35) var(--sp-2); background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); color: var(--text); border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.35); }
.chip:hover { border-color: var(--coral); color: var(--coral); }
.chip[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.chip[aria-disabled="true"]:hover { border-color: var(--steel-dark); color: var(--text); }
.chip svg { width: calc(var(--f) * 1.0); height: calc(var(--f) * 1.0); }
.float { position: absolute; left: var(--sp-3); right: var(--sp-3); bottom: var(--sp-3); z-index: 2; display: flex; flex-direction: column; gap: calc(var(--f) * 0.7); }
/* Same reason as the name above: these read over generated art. The foot veil already carries them
   (6.3:1 or better over white), so what is added is the shadow that survives at letter scale. */
.float .rates, .float .pity .fig, .float .pity .note { text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.float .pulls { max-width: calc(var(--f) * 34); }

/* The Details sheet opens OVER the art: comparing the pool with the banner offering it is the
   point of looking. */
/* OPAQUE, and the backdrop blur goes with it: at 92% the generated art read through and mixed with
   the sheet (user). Four of the five styles set --panel-blur to none, so that 8% bled for nothing. */
.sheet { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); background: var(--ground-2); }
.sheet-head { display: flex; align-items: center; gap: var(--sp-2); flex: none; }
.sheet-head h4 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); }
.sheet-head .spacer { flex: 1; }
/* ONE scroll for the whole sheet body, never one per strip: per strip each got HALF the height and
   a card had to be scrolled inside its own row to be seen whole. */
.strips { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
.strip-label { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); flex: none; }

/* History: this banner's pulls, newest first. The list is PAGED, so it never scrolls -- the page
   is what fits, and the pager is how you reach the rest. */
.sheet-head .hs-of { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.sheet-head .hs-total { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; flex: none; }
.hs-rows { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); }
/* The pity number leads the row: it is the column a gacha player reads down. */
.hs-row { display: grid; grid-template-columns: calc(var(--f) * 3.2) 1fr auto auto; align-items: center; gap: var(--sp-2); padding: calc(var(--f) * 0.4) calc(var(--f) * 0.7); background: var(--surface); color: var(--on-surface); border-left: 3px solid var(--steel-faint); border-radius: var(--radius-sm); min-width: 0; }
/* THE RARITY TINTS THE ROW, IT DOES NOT COLOUR THE TEXT. A row is a --surface plate, which is
   LIGHT (#EDF1F6 in vanguard): amber text on it measured 1.64:1 and the pity number -- the column
   this screen exists for -- was the least readable thing on the page. Tinting keeps the gold
   signal a gacha player scans for while every glyph stays dark-on-light. */
.hs-row.r5 { border-left-color: var(--amber); background: color-mix(in srgb, var(--amber) 22%, var(--surface)); }
.hs-row.r4 { border-left-color: var(--epic); background: color-mix(in srgb, var(--epic) 16%, var(--surface)); }
/* THE SECONDARY TEXT IS TIED TO THE PLATE, not to a ground token. --steel is gold in Ember, and
   over the amber-tinted 5-star row it measured 2.45:1; muting --on-surface instead follows whatever
   the plate is in each of the five styles. Measured floor across 5 styles x 3 rarities: 3.31:1. */
.hs-pity { font-family: var(--display); font-size: var(--t-sm); font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--on-surface) 88%, transparent); text-align: right; }
/* The 5-star's number ranks by WEIGHT, not by colour: the tint already says which row it is. */
.hs-row.r5 .hs-pity { color: var(--on-surface); font-weight: 700; }
.hs-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.hs-stars { font-size: calc(var(--f) * 0.85 * var(--gf-type-scale, 1)); letter-spacing: 0.5px; line-height: 1; color: color-mix(in srgb, var(--on-surface) 72%, transparent); }
.hs-when { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.06em; color: color-mix(in srgb, var(--on-surface) 72%, transparent); font-variant-numeric: tabular-nums; }
.hs-note { flex: 1 1 auto; display: grid; place-items: center; text-align: center; font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.06em; color: var(--steel-faint); padding: var(--sp-3); }
.hs-pager { flex: none; display: flex; align-items: center; justify-content: center; gap: calc(var(--f) * 0.35); }
.hs-page { cursor: pointer; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.08em; font-variant-numeric: tabular-nums; min-width: calc(var(--f) * 1.9); padding: calc(var(--f) * 0.25) calc(var(--f) * 0.5); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); border-radius: var(--radius-sm); }
.hs-page:hover { border-color: var(--coral); color: var(--coral); }
.hs-page[aria-current="true"] { border-color: var(--coral); color: var(--on-coral); background: var(--coral); }
.hs-gap { font-family: var(--display); font-size: var(--t-xs); color: var(--steel-faint); }
.strip-scroll { flex: none; }
.featured { display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: max-content; gap: calc(var(--f) * 0.6); }
.featured .u { min-height: 0; display: flex; flex-direction: column; }
.featured .u-art { aspect-ratio: 3 / 4; flex: 0 0 auto; min-height: 0; }
.featured .u-photo { right: auto; bottom: auto; left: -50%; top: -6%; width: 200%; height: auto; }

.u { position: relative; min-width: 0; background: var(--surface); color: var(--on-surface); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; border-top: 3px solid var(--steel-faint); text-align: left; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.u-art { position: relative; aspect-ratio: 3 / 4; background: linear-gradient(160deg, #26364E 0%, #141D2B 100%); display: grid; place-items: end center; overflow: hidden; color: rgba(199,211,226,0.5); }
.u-art svg { width: 76%; height: 92%; }
.u-art.mat svg, .u-art.wpn svg { width: 56%; height: 70%; align-self: center; }
.u-stars { position: absolute; top: calc(var(--f) * 0.3); left: calc(var(--f) * 0.4); font-size: calc(var(--f) * 0.95 * var(--gf-type-scale, 1)); letter-spacing: 0.5px; line-height: 1; z-index: 1; }
/* Cropped, not fitted: an image model returns whatever aspect it likes, and a letterboxed portrait
   reads as a bug. */
.u-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
/* z-index ONLY: every badge is already absolutely positioned, so position:relative here would drop
   them out of their corners. */
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip, .u-art > .tag-new, .u-art > .kind-tag, .u-art > .pill-up { z-index: 1; }
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip { text-shadow: 0 1px 3px rgba(0,0,0,0.7); }
/* The showcase art replaces the big silhouette entirely, so it can bleed off the right edge the
   way the silhouette did. */
.show-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
.u-meta { padding: calc(var(--f) * 0.5) calc(var(--f) * 0.7) calc(var(--f) * 0.7); }
.u-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); line-height: 1.05; color: var(--on-surface); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.u-role { font-family: var(--display); font-size: calc(var(--f) * 0.82 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel); }
.u.r5 { border-top-color: var(--amber); } .u.r5 .u-stars { color: var(--amber); text-shadow: 0 0 6px color-mix(in srgb, var(--amber) 60%, transparent); } .u.r5 .u-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--amber) 30%, #26364E) 0%, #141D2B 70%); color: color-mix(in srgb, var(--amber) 55%, #C7D3E2); }
.u.r4 { border-top-color: var(--epic); } .u.r4 .u-stars { color: var(--epic); text-shadow: 0 0 6px color-mix(in srgb, var(--epic) 55%, transparent); } .u.r4 .u-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--epic) 26%, #26364E) 0%, #141D2B 72%); color: color-mix(in srgb, var(--epic) 50%, #C7D3E2); }
.u.r3 { border-top-color: var(--steel-faint); } .u.r3 .u-stars { color: var(--steel-faint); }
.u .pill-up { position: absolute; top: calc(var(--f) * 0.3); right: 0; background: var(--coral); color: var(--on-coral); font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.75 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; padding: calc(var(--f) * 0.15) calc(var(--f) * 0.5); }
.u .kind-tag { position: absolute; bottom: calc(var(--f) * 3.0); right: calc(var(--f) * 0.4); font-family: var(--display); font-size: calc(var(--f) * 0.7 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); background: color-mix(in srgb, var(--ink) 60%, transparent); padding: 0 calc(var(--f) * 0.35); }
.u .tag-new { position: absolute; bottom: calc(var(--f) * 0.4); right: 0; background: var(--jade); color: #06281D; font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; padding: calc(var(--f) * 0.12) calc(var(--f) * 0.5); }
/* The duplicate's tag wears the ascension colour, not the new-unit green: a repeat is progression
   on a unit you already have, and reading it as NEW is the one thing it must not say. Amber over
   ink is dark-on-light in all five styles (9.9 to 14.4:1), the pair Ascend already uses. */
.u .tag-new.fct { background: var(--amber); color: var(--ink); }

.rates { display: flex; flex-wrap: wrap; gap: calc(var(--f) * 0.3) var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.08em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.rates b { color: var(--text); } .rates .g { color: var(--amber); } .rates .e { color: var(--epic); }
/* The rate-up rides with its rarity. Opaque, never dimmed: text on this strip sits over generated art. */
.rates em { font-style: normal; color: var(--text); }

.pity { margin-top: auto; }
.pity .fig { display: flex; justify-content: space-between; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; margin-bottom: calc(var(--f) * 0.3); }
.pity .fig b { color: var(--text); }
.pity .track { position: relative; height: calc(var(--f) * 0.6); background: var(--ink-3); overflow: hidden; }
.pity .track > i { display: block; height: 100%; background: linear-gradient(90deg, var(--steel) 0%, var(--amber) 100%); }
.pity .track > .soft { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--coral); }
.pity .note { font-family: var(--display); font-size: calc(var(--f) * 0.8 * var(--gf-type-scale, 1)); letter-spacing: 0.06em; color: var(--steel-faint); margin-top: calc(var(--f) * 0.3); }
.pity .note b { color: var(--coral); }

.pulls { display: grid; grid-template-columns: 1fr 1.3fr; gap: calc(var(--f) * 0.6); }
.pull { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--f) * 0.15); cursor: pointer; border: 1px solid; padding: calc(var(--f) * 0.7) var(--sp-1); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; --cut: 0.7em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); transition: background 140ms ease, color 140ms ease; }
.pull .big { font-size: var(--t-lg); letter-spacing: 0.06em; line-height: 1; }
.pull .cost { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); font-size: var(--t-xs); letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
.pull .cost svg { width: calc(var(--f) * 1.2); height: calc(var(--f) * 1.2); }
.pull.one { background: transparent; border-color: var(--steel); color: var(--text); }
.pull.one:hover { border-color: var(--coral); color: var(--coral); }
.pull.one .cost { color: var(--steel-faint); }
.pull.ten { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.pull.ten:hover { background: var(--coral-deep); }
/* Derived from the button's own text colour, never a fixed tint: a near-white pink chosen against
   coral became unreadable on a style whose accent is lime. */
.pull.ten .cost { color: color-mix(in srgb, var(--on-coral) 82%, transparent); }
.pull[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.pull[aria-disabled="true"]:hover { background: transparent; color: var(--text); border-color: var(--steel); }
.pull.ten[aria-disabled="true"]:hover { background: var(--coral); color: var(--on-coral); }

.soon-panel { min-height: 0; display: grid; place-items: center; text-align: center; gap: var(--sp-2); padding: var(--sp-4); border: 1px dashed var(--steel-dark); }
.soon-panel .h { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--text); }
.soon-panel p { margin: 0; font-size: var(--t-sm); color: var(--steel-faint); line-height: 1.5; }

.screen.reveal { grid-template-rows: 1fr; cursor: pointer; }
.rv-back { position: absolute; inset: 0; background: radial-gradient(62% 62% at 50% 44%, #1a2740 0%, #0b1119 72%); transition: background 700ms ease; }
.rv-back.gold { background: radial-gradient(62% 62% at 50% 44%, color-mix(in srgb, var(--amber) 42%, #16233a) 0%, #0b1119 74%); }
.rv-back.epic { background: radial-gradient(62% 62% at 50% 44%, color-mix(in srgb, var(--epic) 40%, #17203a) 0%, #0b1119 74%); }
.rv-back.steel { background: radial-gradient(62% 62% at 50% 44%, color-mix(in srgb, var(--steel) 34%, #141d2b) 0%, #0b1119 74%); }
.rv-flash { position: absolute; inset: 0; background: #FFFFFF; opacity: 0; pointer-events: none; }
.reveal.phase-flash .rv-flash { animation: rvFlash 520ms ease forwards; }
@keyframes rvFlash { 0% { opacity: 0; } 18% { opacity: 0.9; } 100% { opacity: 0; } }
.rv-sigil { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; }
.reveal.phase-charge .rv-sigil { animation: rvSigilIn 1150ms ease forwards; }
.reveal.phase-flash .rv-sigil, .reveal.phase-reveal .rv-sigil, .reveal.phase-done .rv-sigil { opacity: 0; }
@keyframes rvSigilIn { 0% { opacity: 0; transform: scale(0.5); } 55% { opacity: 1; } 88% { opacity: 1; transform: scale(1.04); } 100% { opacity: 0.9; transform: scale(1); } }
.rv-sigil-wrap { position: relative; width: calc(var(--f) * 20); height: calc(var(--f) * 20); display: grid; place-items: center; }
.rv-ring { position: absolute; inset: 0; border: 2px solid color-mix(in srgb, var(--amber) 65%, transparent); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.reveal.phase-charge .rv-ring { animation: rvSpin 3.4s linear infinite; }
.rv-ring.two { inset: calc(var(--f) * 2.4); border-color: color-mix(in srgb, var(--coral) 60%, transparent); }
.reveal.phase-charge .rv-ring.two { animation: rvSpinR 2.6s linear infinite; }
@keyframes rvSpin { to { transform: rotate(360deg); } }
@keyframes rvSpinR { to { transform: rotate(-360deg); } }
.rv-core { width: calc(var(--f) * 7); height: calc(var(--f) * 7); }
.rv-charge-txt { position: absolute; bottom: 16%; left: 0; right: 0; text-align: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; letter-spacing: 0.3em; text-transform: var(--case); font-size: var(--t-sm); color: var(--steel-faint); }
.reveal.phase-charge .rv-charge-txt { animation: rvBlink 1.1s ease-in-out infinite; }
.reveal:not(.phase-charge) .rv-charge-txt { opacity: 0; }
@keyframes rvBlink { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
.rv-deal { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; pointer-events: none; }
.reveal.phase-reveal .rv-deal, .reveal.phase-done .rv-deal { opacity: 1; }
.rv-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: calc(var(--f) * 0.9); width: min(90%, calc(var(--f) * 66)); }
.rv-grid.single { grid-template-columns: 1fr; width: calc(var(--f) * 15); }
.rv-card { position: relative; perspective: 700px; }
.rv-flare { position: absolute; inset: -28%; opacity: 0; z-index: 0; background: radial-gradient(circle, rgba(240,180,41,0.55) 0%, transparent 60%); }
.rv-card.r4 .rv-flare { background: radial-gradient(circle, rgba(155,111,212,0.5) 0%, transparent 60%); }
.rv-card.r3 .rv-flare { background: radial-gradient(circle, rgba(138,162,188,0.32) 0%, transparent 62%); }
.rv-card.revealed .rv-flare { animation: rvFlarePop 760ms ease; }
@keyframes rvFlarePop { 0% { opacity: 0; transform: scale(0.4); } 42% { opacity: 1; } 100% { opacity: 0; transform: scale(1.35); } }
.rv-rays { position: absolute; top: 50%; left: 50%; width: 200%; height: 200%; border-radius: 50%; opacity: 0; z-index: 0; pointer-events: none; background: repeating-conic-gradient(from 0deg, rgba(240,180,41,0.38) 0deg 5deg, transparent 5deg 16deg); -webkit-mask: radial-gradient(circle, #000 16%, rgba(0,0,0,0.5) 40%, transparent 64%); mask: radial-gradient(circle, #000 16%, rgba(0,0,0,0.5) 40%, transparent 64%); transform: translate(-50%, -50%) scale(0.5); transform-origin: center; }
.rv-card.r5.revealed .rv-rays { animation: rvRays 1100ms ease-out; }
@keyframes rvRays { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); } 35% { opacity: 0.85; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2) rotate(50deg); } }
.rv-inner { position: relative; z-index: 1; aspect-ratio: 3 / 4; transform-style: preserve-3d; transform: rotateY(180deg); transition: transform 480ms cubic-bezier(0.2,0.8,0.3,1); }
.rv-card.revealed .rv-inner { transform: rotateY(0deg); }
.rv-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.rv-front { transform: rotateY(0deg); }
.rv-front .u { height: 100%; border-top-width: 4px; }
.rv-front .u-art { aspect-ratio: auto; flex: 1; }
.rv-facedown { transform: rotateY(180deg); background: linear-gradient(160deg, #22304a 0%, #131c2b 100%); border-top: 4px solid var(--steel-dark); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius); display: grid; place-items: center; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.rv-facedown span { width: 40%; height: 40%; border: 2px solid color-mix(in srgb, var(--steel) 70%, transparent); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.rv-top { position: absolute; top: 3.4rem; right: var(--sp-3); z-index: 3; }
.rv-skip { background: color-mix(in srgb, var(--ink) 55%, transparent); border: 1px solid var(--steel-dark); color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.14em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); cursor: pointer; --cut: 0.5em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.rv-skip:hover { color: var(--text); border-color: var(--steel); }
.rv-foot { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); background: linear-gradient(0deg, rgba(9,13,20,0.92) 0%, rgba(9,13,20,0) 100%); opacity: 0; transform: translateY(30%); pointer-events: none; transition: opacity 260ms ease, transform 260ms ease; }
.reveal.phase-done .rv-foot { opacity: 1; transform: none; pointer-events: auto; }
.rv-foot .headline { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.rv-foot .headline b { color: var(--amber); }
.rv-foot .spacer { flex: 1; }

.foot-btn { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.6) var(--sp-3); border: 1px solid; --cut: 0.6em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.foot-btn.ghost { background: transparent; border-color: var(--steel); color: var(--text); }
.foot-btn.ghost:hover { border-color: var(--coral); color: var(--coral); }
.foot-btn.solid { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.foot-btn.solid:hover { background: var(--coral-deep); }
.foot-btn[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.foot-btn svg { width: calc(var(--f) * 1.3); height: calc(var(--f) * 1.3); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,rh={bulwark:"Bulwark",blade:"Blade",focus:"Focus",tome:"Tome",edge:"Edge"};function It(t){let e=t.kind==="weapon"?"weapon":t.kind==="material"?"material":t.kind==="glimmer"?"glimmer":"character",a=Number(t.rarity)||3,r=Math.max(0,Math.round(Number(t.glimmer)||0)),s=e==="material"?"Material":e==="glimmer"?"Glimmer":he(t.name)||"Unit",o;if(e==="material")o="Material";else if(e==="glimmer")o="+"+r;else if(e==="weapon"){let i=rh[t.weaponType]||(t.weaponType?t.weaponType:"Weapon");o=t.dedicatedTo?`${i} \xB7 ${he(t.dedicatedTo)}'s signature`:i}else o=t.role?`${t.role}${t.affinity?" \xB7 "+t.affinity:""}`:"";return{kind:e,rarity:a,name:s,role:o,weaponType:t.weaponType||"",dedicatedTo:t.dedicatedTo||"",portrait:t.portrait||null,isNew:!!t.isNew,up:!!t.up,facet:t.facet||null,glimmer:r}}function sh(t,e){let a=t.kind==="material"||t.kind==="glimmer"?" mat":t.kind==="weapon"?" wpn":"",r=e&&t.kind!=="character"?'<span class="kind-tag">'+(t.kind==="weapon"?"Weapon":t.kind==="glimmer"?"Glimmer":"Material")+"</span>":"",s=t.up?'<span class="pill-up">UP</span>':"";return'<div class="u-art'+a+'">'+st(t.portrait,"")+'<span class="u-stars">'+Hi(t.rarity)+"</span>"+s+(t.portrait?"":t.kind==="weapon"?Oe(t.weaponType,"gf-ssil"):Zd[t.kind])+r+(t.isNew?'<span class="tag-new">NEW</span>':t.facet?'<span class="tag-new fct">'+(t.facet.gained?"FACET "+t.facet.facet:"FACET "+t.facet.facet+"/"+t.facet.max)+"</span>":t.glimmer?'<span class="tag-new fct">+'+t.glimmer+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+u(t.name)+'</div><div class="u-role">'+u(t.role)+"</div></div>"}function mr(t,e){return'<article class="u r'+(Number(t.rarity)||3)+'">'+sh(t,e)+"</article>"}function Pi(t){let e=null;for(let a of t){let r=It(a);(!e||r.rarity>e.rarity)&&(e=r)}return e}function Di(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return"";let a=Math.floor(e/6e4);if(a<60)return Math.max(1,a)+"m left";let r=Math.floor(a/60);if(r<24)return r+"h left";let s=Math.floor(r/24),o=r-s*24;return o>0?s+"d "+o+"h left":s+"d left"}function oh(t,e){let a=u(t.id);if(t.live===!1)return'<button class="bcard" type="button" aria-disabled="true" data-banner="'+a+'"><span class="bt-face empty">'+th+'</span><span class="bt-id"><b>'+u(t.title||t.id)+"</b><i>"+u(t.note||"Not open yet")+"</i></span></button>";let r=t.face?'<span class="bt-face" style="background-image:url('+u(t.face)+')"></span>':t.kind==="weapon"?'<span class="bt-face sil">'+Oe(t.weaponType||"blade","gf-ssil")+"</span>":'<span class="bt-face empty">'+eh+"</span>",s=t.pity||{},o=Number(s.hard)||80,i=Number(s.count)||0,n=Math.max(0,Math.min(100,i/o*100)),l=t.pending?"Opens when you pick it":t.type==="featured"?"Featured \xB7 "+(Di(t.endsInMs)||"ending"):"Permanent";return'<button class="bcard" type="button" data-banner="'+a+'" aria-pressed="'+(t.id===e)+'">'+r+'<span class="bt-id"><b>'+u(t.title||t.id)+"</b><i>"+l+'</i><span class="bt-pity"><span class="bt-track"><i style="width:'+n.toFixed(0)+'%"></i></span><em>'+i+"/"+o+(s.guaranteed?" \xB7 gtd":"")+"</em></span></span></button>"}function qi({banners:t=[],banner:e,rates:a,pity:r,wallet:s,cost:o=160,bannerId:i="char-standard",state:n="ready",details:l=!1,history:d=null,arting:h=!1}={}){let f=Number(s&&s.aether)||0,m=Array.isArray(t)?t:[],v='<div class="rail"><div class="rail-scroll">'+(m.length?m.map(ae=>oh(ae,i)).join(""):"")+"</div></div>";if(n!=="ready"||!e){let ae=n==="error"?"Try again in a moment, or pick another banner.":"Summoning this week's featured cast \u2014 the first open of a new week takes a few seconds. Pick another banner to pull now.";return`
<div class="root">
  ${vr}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${ur}<b>${f.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${v}
      <div class="show"><div class="soon-panel"><div class="h">${n==="error"?"Couldn't open the banner":"Working\u2026"}</div><p>${ae}</p></div></div>
    </div>
  </section>
</div>`}let b=e,w=b.kind==="weapon"?"weapon":"character",c=Array.isArray(b.featured)?b.featured.map(It):[],y=c.find(ae=>ae.rarity===5)||c[0]||null,E=c.find(ae=>ae.rarity===4)||null,T=typeof b.art=="string"&&!!b.art.trim(),R;if(T)R='<div class="art wide" style="background-image:url('+u(b.art)+')"></div>';else if(w==="weapon")R='<div class="art"><div class="artback flat"></div><div class="plates"><div class="plate sil">'+Oe(y&&y.weaponType||"blade","gf-ssil")+"</div></div></div>";else{let ae=y&&y.portrait?u(y.portrait):"",pe=E&&E.portrait?u(E.portrait):"";R='<div class="art">'+(ae?'<div class="artback" style="background-image:url('+ae+')"></div>':'<div class="artback flat"></div>')+'<div class="plates">'+(ae?'<div class="plate five" style="background-image:url('+ae+')"></div>':"")+(pe?'<div class="plate four" style="background-image:url('+pe+')"></div>':"")+"</div></div>"}let W=b.type==="featured"?Di(b.endsInMs):"",O=b.type==="featured"?"Featured \xB7 5\u2605 "+w+(W?" \xB7 "+W:""):"Permanent pool",U=b.title||(y?y.name:"Banner"),F=y?u(he(y.name))+(y.role?" \xB7 "+u(y.role):""):"The permanent pool. Every retired featured unit folds in here.",j=a||{},D=ae=>b.type==="featured"?" <em>\u2191"+ua(ae)+"</em>":"",X='<div class="rates"><span><b class="g">\u2605\u2605\u2605\u2605\u2605</b> '+ua(j.five)+D(j.featured)+'</span><span><b class="e">\u2605\u2605\u2605\u2605</b> '+ua(j.four)+D(j.featuredFour)+"</span>"+(b.type==="featured"?"":"<span>No rate-up</span>")+"</div>",J=r||{},le=Number(J.count)||0,oe=Number(J.hard)||80,re=Number(J.soft)||74,ee=Math.max(0,oe-le),Z=Math.min(100,le/oe*100),ue=Math.min(100,re/oe*100),te=ua(j.featured),N=b.type==="featured"?"Guaranteed 5\u2605 in <b>"+ee+"</b> \xB7 soft pity from "+re+" \xB7 "+(J.guaranteed?"next 5\u2605 <b>is</b> the rate-up":"next 5\u2605 is a "+te+" chance for the rate-up"):"Guaranteed 5\u2605 in <b>"+ee+"</b> \xB7 soft pity from "+re+" \xB7 5\u2605 from the standard pool",_='<div class="pity"><div class="fig"><span>Pity to 5\u2605 '+(b.kind==="character"?"character":"weapon")+"</span><span><b>"+le+"</b> / "+oe+'</span></div><div class="track"><i style="width:'+Z.toFixed(1)+'%"></i><span class="soft" style="left:'+ue.toFixed(1)+'%"></span></div><div class="note">'+N+"</div></div>",S=f>=o,A=f>=o*10,C='<div class="pulls"><button class="pull one" type="button" data-pull="1"'+(S?"":' aria-disabled="true"')+'><span class="big">Summon</span><span class="cost">'+ur+" "+o+' \xB7 \xD71</span></button><button class="pull ten" type="button" data-pull="10"'+(A?"":' aria-disabled="true"')+'><span class="big">Summon \xD710</span><span class="cost">'+Qd+" "+o*10+" \xB7 one 4\u2605+ guaranteed</span></button></div>",G=b.canArt===!0?'<button class="chip" type="button" data-redo-art'+(h?' aria-disabled="true"':"")+">"+ah+(h?"Painting\u2026":T?"Redo art":"Paint art")+"</button>":"",de=Array.isArray(b.pool4)?b.pool4.map(It):[],Ee=b.type==="featured"?"Also in this banner":"Also in the permanent pool",ze=l?'<div class="sheet" data-sheet><div class="sheet-head"><h4>'+u(U)+'</h4><span class="spacer"></span><button class="chip" type="button" data-details-close>Close</button></div>'+X+'<div class="strips"><span class="strip-label">'+(b.type==="featured"?"Rate-up":"Standard 5\u2605")+'</span><div class="strip-scroll"><div class="featured">'+c.map(ae=>mr({...ae,up:b.type==="featured"},!0)).join("")+"</div></div>"+(de.length?'<span class="strip-label">'+Ee+'</span><div class="strip-scroll"><div class="featured">'+de.map(ae=>mr({...ae,up:!1},!0)).join("")+"</div></div>":"")+"</div></div>":"",ye=d?lh(d,U):"";return`
<div class="root">
  ${vr}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${ur}<b>${f.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${v}
      <div class="show">
        ${R}
        <div class="veil"></div>
        <div class="bname"><span class="kicker">${O}</span><h3>${u(U)}</h3><p>${F}</p></div>
        <div class="chips">${G}<button class="chip" type="button" data-history>History</button><button class="chip" type="button" data-details>Details &amp; pool</button></div>
        <div class="float">${X}${_}${C}</div>
        ${ze}${ye}
      </div>
    </div>
  </section>
</div>`}function ih(t){let e=new Date(Number(t)||0),a=r=>String(r).padStart(2,"0");return e.getFullYear()+"-"+a(e.getMonth()+1)+"-"+a(e.getDate())+" "+a(e.getHours())+":"+a(e.getMinutes())}function nh(t,e){let r=[...new Set([1,e,t-1,t,t+1])].filter(i=>i>=1&&i<=e).sort((i,n)=>i-n),s=[],o=0;for(let i of r)o&&i-o>1&&s.push(null),s.push(i),o=i;return s}function lh(t,e){let a=t&&t.state||"ready",r=Array.isArray(t&&t.rows)?t.rows:[],s=Math.max(1,Number(t&&t.pages)||1),o=Math.min(Math.max(1,Number(t&&t.page)||1),s),i=Number(t&&t.total)||0,n;a==="loading"?n='<div class="hs-note">Loading\u2026</div>':a==="error"?n='<div class="hs-note">Could not load this history.</div>':r.length?n='<div class="hs-rows">'+r.map(d=>{let h=Number(d&&d.r)||3,f="\u2605".repeat(h),m=d&&d.k==="glimmer"?"Glimmer +"+(Number(d.g)||0):d&&d.n||"";return'<div class="hs-row r'+h+'"><span class="hs-pity">'+(Number(d&&d.p)||0)+'</span><span class="hs-name">'+u(m)+'</span><span class="hs-stars">'+f+'</span><span class="hs-when">'+u(ih(d&&d.t))+"</span></div>"}).join("")+"</div>":n='<div class="hs-note">No pulls recorded yet. Pulls are saved here from now on.</div>';let l=s>1?'<div class="hs-pager">'+nh(o,s).map(d=>d===null?'<span class="hs-gap">&hellip;</span>':'<button class="hs-page" type="button" data-history-page="'+d+'"'+(d===o?' aria-current="true"':"")+">"+d+"</button>").join("")+"</div>":"";return'<div class="sheet" data-sheet data-history-sheet><div class="sheet-head"><h4>History</h4><span class="hs-of">'+u(e||"")+'</span><span class="spacer"></span><span class="hs-total">'+i.toLocaleString("en-US")+' pulls</span><button class="chip" type="button" data-history-close>Close</button></div>'+n+l+"</div>"}function $i({results:t=[]}={}){let e=t.map(It),a=e.length===1,r=e.map((s,o)=>'<div class="rv-card r'+s.rarity+'" data-i="'+o+'"><div class="rv-rays"></div><div class="rv-flare"></div><div class="rv-inner"><div class="rv-face rv-facedown"><span></span></div><div class="rv-face rv-front">'+mr(s,!0)+"</div></div></div>").join("");return`
<div class="root">
  ${vr}
  <section class="screen reveal" data-screen="reveal">
    <div class="rv-back" data-rv-back></div>
    <div class="rv-flash"></div>
    <div class="rv-sigil">
      <div class="rv-sigil-wrap">
        <span class="rv-ring"></span><span class="rv-ring two"></span>
        <svg class="rv-core" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 6 94 50 50 94 6 50Z" stroke="#F0B429" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 24 76 50 50 76 24 50Z" stroke="#F2603C" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="50" r="7" fill="#F0B429" fill-opacity="0.5"/></svg>
      </div>
      <div class="rv-charge-txt">Summoning</div>
    </div>
    <div class="rv-deal"><div class="rv-grid${a?" single":""}" data-rv-grid>${r}</div></div>
    <div class="rv-top"><button class="rv-skip" type="button" data-rv-skip>Skip &raquo;</button></div>
    <div class="rv-foot">
      <span class="headline" data-rv-headline></span>
      <span class="spacer"></span>
      <button class="foot-btn solid" type="button" data-rv-continue>Continue &rsaquo;</button>
    </div>
  </section>
</div>`}function ji(t,{banners:e=[],onBanner:a,onPull:r,onBack:s,onDetails:o,onHistory:i,onHistoryPage:n,onRedoArt:l}){for(let w of Array.isArray(e)?e:[]){if(!w||!w.id||w.live===!1)continue;let c=t.querySelector('[data-banner="'+w.id+'"]');c&&c.addEventListener("click",(y=>()=>a&&a(y))(w.id))}let d=t.querySelector("[data-details]");d&&d.addEventListener("click",()=>o&&o(!0));let h=t.querySelector("[data-details-close]");h&&h.addEventListener("click",()=>o&&o(!1));let f=t.querySelector("[data-history]");f&&f.addEventListener("click",()=>i&&i(!0));let m=t.querySelector("[data-history-close]");m&&m.addEventListener("click",()=>i&&i(!1));for(let w of t.querySelectorAll("[data-history-page]"))w.addEventListener("click",()=>n&&n(Number(w.dataset.historyPage)||1));let v=t.querySelector("[data-redo-art]");v&&v.addEventListener("click",()=>{v.getAttribute("aria-disabled")!=="true"&&l&&l()});for(let w of t.querySelectorAll("[data-pull]"))w.addEventListener("click",()=>{w.getAttribute("aria-disabled")!=="true"&&r&&r(Number(w.dataset.pull)===10?10:1)});let b=t.querySelector("[data-summon-back]");b&&b.addEventListener("click",()=>s&&s())}function Ui(t,{results:e=[],onContinue:a}){let r=t.querySelector('[data-screen="reveal"]'),s=t.querySelector("[data-rv-back]"),o=t.querySelector("[data-rv-grid]"),i=t.querySelector("[data-rv-headline]"),n=e.map(It),l=[],d=0,h=()=>{for(let E of l)clearTimeout(E);l.length=0},f=E=>{!r||!r.classList||(r.classList.remove("phase-charge","phase-flash","phase-reveal","phase-done"),E&&r.classList.add("phase-"+E))},m=E=>{let T=o&&o.querySelector('[data-i="'+E+'"]');T&&T.classList&&T.classList.add("revealed")},v=()=>{let E=Pi(e);i&&(i.innerHTML=E?"Best pull: <b>"+u(E.name)+"</b> \xB7 "+Hi(E.rarity):""),f("done")},b=()=>{for(;d<n.length;d+=1)m(d);v()};f("charge");let w=(Pi(e)||{rarity:3}).rarity;s&&s.classList&&s.classList.remove("gold","epic","steel"),l.push(setTimeout(()=>{s&&s.classList&&s.classList.add(w===5?"gold":w===4?"epic":"steel")},620)),l.push(setTimeout(()=>f("flash"),1180)),l.push(setTimeout(()=>{f("reveal");let E=n.length===1?0:230;for(let T=0;T<n.length;T+=1)l.push(setTimeout(()=>{m(d),d+=1},260+T*E));l.push(setTimeout(v,260+n.length*E+260))},1560)),r&&r.addEventListener("click",E=>{E.target&&E.target.closest&&(E.target.closest(".rv-foot")||E.target.closest(".rv-top"))||r.classList&&r.classList.contains("phase-done")||(h(),f("reveal"),b())});let c=t.querySelector("[data-rv-skip]");c&&c.addEventListener("click",()=>{h(),f("reveal"),b()});let y=t.querySelector("[data-rv-continue]");return y&&y.addEventListener("click",()=>{h(),a&&a()}),h}var Gi=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */



  --sp-1: calc(var(--f) * 0.5); --sp-2: calc(var(--f) * 1.0); --sp-3: calc(var(--f) * 1.6); --sp-4: calc(var(--f) * 2.4);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 6%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 10% 96%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
/* The scanline OPACITY is the style token, never a hand number: two styles turn it off. */
.stage::after { content: ""; position: absolute; inset: 0; opacity: var(--scanlines); background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px); }

/* THE ROWS ARE DECLARED FOR THE HOISTED SCREEN, WHICH IS THE ONE THE PLAYER SEES. hoistHeadIntoBar
   REMOVES the .head, so TWO children are left against THREE hand-written rows and the body fell
   into the first, auto one -- measured, the board ended at 740 of 1080 with dead space below.
   Every other screen declares the 1fr by default and adds the header row under :has(> .head). */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0,1fr) auto; min-height: 0; }
.screen:has(> .head) { grid-template-rows: auto minmax(0,1fr) auto; }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }
/* The primary action of the pre-battle screen. It used to be a chip in the header, which read as a
   minor control and got smaller still once the header moved into the bar. */
.into-battle { flex: none; width: 100%; cursor: pointer; background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.9) var(--sp-3); --cut: 0.7em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.15); line-height: 1.1; box-shadow: var(--panel-shadow), var(--panel-bevel); }
.into-battle small { font-size: var(--t-tiny); font-weight: 400; letter-spacing: 0.08em; text-transform: none; opacity: 0.85; }
.into-battle:hover { background: var(--coral-deep); }

.fm-body { min-height: 0; display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--sp-3); padding: var(--sp-1) var(--sp-3) var(--sp-2); }

.board { min-height: 0; display: grid; grid-template-rows: auto minmax(0,1fr) auto minmax(0,1fr) auto; gap: calc(var(--f) * 0.4); }
.row-lab { display: flex; align-items: center; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
.row-lab::after { content: ""; flex: 1; height: 1px; background: var(--ink-3); }
.slots { min-height: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }

.slot { position: relative; min-width: 0; height: 100%; aspect-ratio: 3/4; justify-self: center; max-width: 100%; background: var(--ink-2); border: 1px dashed var(--steel-dark); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius); cursor: pointer; display: flex; flex-direction: column; overflow: hidden; transition: border-color 130ms ease, transform 130ms ease; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.slot:hover { border-color: var(--steel); }
.slot.empty { display: grid; place-items: center; color: var(--on-surface); }
.slot.empty .plus { font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-2xl); line-height: 1; color: var(--on-surface); }
.slot.empty .plus small { display: block; font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); margin-top: calc(var(--f) * 0.4); }
.slot.sel { border-style: solid; border-color: var(--coral); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 40%, transparent); }
.slot.filled { border-style: solid; }

.slot-art { position: relative; flex: 1; min-height: 0; display: grid; place-items: end center; overflow: hidden; background: linear-gradient(160deg, #26364E 0%, #141D2B 100%); color: rgba(199,211,226,0.5); }
.slot-art svg { width: 72%; height: 98%; }
.slot.r5 .slot-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--amber) 28%, #26364E) 0%, #141D2B 72%); color: color-mix(in srgb, var(--amber) 55%, #C7D3E2); }
.slot.r4 .slot-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--epic) 24%, #26364E) 0%, #141D2B 74%); color: color-mix(in srgb, var(--epic) 50%, #C7D3E2); }
.slot.r5 { border-top: 3px solid var(--amber); } .slot.r4 { border-top: 3px solid var(--epic); }
.slot.leader { border-top: 3px solid var(--coral); }
.slot.leader .slot-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--coral) 30%, #26364E) 0%, #141D2B 72%); color: color-mix(in srgb, var(--coral) 55%, #C7D3E2); }

/* TOP RIGHT, OVER THE ART: at the bottom it landed on the role and affinity line, which is text
   the player reads to decide who to bench. */
.slot-remove { position: absolute; top: calc(var(--f) * 0.3); right: calc(var(--f) * 0.3); z-index: 2; width: calc(var(--f) * 1.7); height: calc(var(--f) * 1.7); display: grid; place-items: center; background: color-mix(in srgb, var(--ink) 70%, transparent); border: 1px solid var(--steel-dark); color: var(--porcelain-3); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); line-height: 1; cursor: pointer; }
.slot-remove:hover { border-color: var(--alarm); color: var(--alarm); }
.slot-tag { position: absolute; top: calc(var(--f) * 0.3); left: 50%; transform: translateX(-50%); background: var(--coral); color: var(--on-coral); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.7 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; padding: 0 calc(var(--f) * 0.5); }
.slot-meta { padding: calc(var(--f) * 0.35) calc(var(--f) * 0.5) calc(var(--f) * 0.5); background: linear-gradient(0deg, rgba(9,13,20,0.9), rgba(9,13,20,0)); }
.slot-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.95 * var(--gf-type-scale, 1)); line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slot-role { font-family: var(--display); font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); }
.slot.held { transform: translateY(calc(var(--f) * -0.35)); border-color: var(--coral); box-shadow: 0 0 0 2px color-mix(in srgb, var(--coral) 45%, transparent); }
.slot[draggable="true"] { cursor: grab; }
.slot[draggable="true"]:active { cursor: grabbing; }
.slot.drop-ok { border-style: solid; border-color: var(--coral); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--coral) 45%, transparent); }

.board-foot { margin-top: auto; display: flex; align-items: center; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.06em; color: var(--steel-faint); }
.board-foot .hint { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); }
.board-foot .hint b { color: var(--porcelain-3); }

.picker { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); background: color-mix(in srgb, var(--ink-2) 70%, transparent); border: 1px solid var(--ink-3); padding: var(--sp-2); transition: border-color 120ms ease; }
.picker.drop-ok { border-color: var(--coral); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 35%, transparent); }
.b[draggable="true"] { cursor: grab; }
.b[draggable="true"]:active { cursor: grabbing; }
.picker-head { display: flex; align-items: center; gap: var(--sp-2); }
.picker-head .t { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.04em; }
.picker-head .n { margin-left: auto; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.filters { display: flex; gap: calc(var(--f) * 0.4); flex-wrap: wrap; }
.chip { cursor: pointer; background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); padding: calc(var(--f) * 0.25) calc(var(--f) * 0.7); }
.chip[aria-pressed="true"] { border-color: var(--coral); color: var(--coral); }

.bench-scroll { min-height: 0; overflow: auto; }
.bench { display: grid; grid-template-columns: repeat(2, 1fr); gap: calc(var(--f) * 0.6); align-content: start; }
.b { position: relative; cursor: pointer; display: grid; grid-template-columns: auto minmax(0,1fr) auto; grid-template-rows: auto auto; align-items: center; column-gap: calc(var(--f) * 0.6); row-gap: 0; background: var(--surface); color: var(--on-surface); padding: calc(var(--f) * 0.4); border-left: 3px solid var(--steel-faint); --cut: 0.4em; clip-path: var(--clip-card); border-radius: var(--radius); transition: transform 120ms ease; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.b:hover { transform: translateY(calc(var(--f) * -0.2)); }
.b.r5 { border-left-color: var(--amber); } .b.r4 { border-left-color: var(--epic); } .b.leader { border-left-color: var(--coral); }
.b-ic { position: relative; grid-column: 1; grid-row: 1 / span 2; width: calc(var(--f) * 3.2); height: calc(var(--f) * 3.2); display: grid; place-items: center; background: linear-gradient(160deg, #26364E, #141D2B); color: rgba(199,211,226,0.6); overflow: hidden; }
.b.r5 .b-ic { color: color-mix(in srgb, var(--amber) 60%, #C7D3E2); } .b.r4 .b-ic { color: color-mix(in srgb, var(--epic) 55%, #C7D3E2); } .b.leader .b-ic { color: color-mix(in srgb, var(--coral) 60%, #C7D3E2); }
.b-ic svg { width: 78%; height: 96%; }
.b-ic .aff { position: absolute; bottom: 1px; right: 1px; width: calc(var(--f) * 1.1); height: calc(var(--f) * 1.1); border-radius: 50%; border: 1.5px solid #FFF; }
/* A COLUMN, not two loose spans: both are inline, so the browser put them on the SAME line and the
   name's ellipsis could never work -- an inline does not clip. */
.b-main { grid-column: 2; grid-row: 1 / span 2; min-width: 0; display: flex; flex-direction: column; }
.b-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.92 * var(--gf-type-scale, 1)); line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.b-sub { font-family: var(--display); font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.08em; text-transform: var(--case); color: var(--steel); }
/* NOTHING ABSOLUTE INSIDE A CARD: the stars, IN TEAM and YOU were all absolute over the text, both
   inside the box, so neither overflow nor clipping fires. Own row and column, no overlap. */
.b-stars { grid-column: 3; grid-row: 1; justify-self: end; font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); }
.b.r5 .b-stars { color: var(--amber); } .b.r4 .b-stars { color: var(--epic); } .b.leader .b-stars { color: var(--coral); }
.b.inteam { opacity: 0.5; }
.b.inteam::after { content: "IN TEAM"; grid-column: 3; grid-row: 2; justify-self: end; font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.66 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; color: var(--jade); }
.b.held { transform: translateY(calc(var(--f) * -0.2)); box-shadow: 0 0 0 2px var(--coral); opacity: 1; }
.b .youtag { grid-column: 3; grid-row: 2; justify-self: end; font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.66 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; color: var(--coral); }

.presets { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border-top: 1px solid var(--ink-3); background: color-mix(in srgb, var(--ink) 40%, transparent); }
.presets .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); flex: none; }
.preset-strip { display: flex; gap: calc(var(--f) * 0.6); overflow-x: auto; min-width: 0; flex: 1; padding-bottom: calc(var(--f) * 0.2); }
.preset { flex: none; display: flex; align-items: center; gap: calc(var(--f) * 0.5); background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--porcelain-3); padding: calc(var(--f) * 0.4) calc(var(--f) * 0.9); cursor: pointer; }
.preset:hover { border-color: var(--steel); }
.preset[aria-pressed="true"] { border-color: var(--coral); background: color-mix(in srgb, var(--coral) 14%, var(--ink-2)); color: var(--text); }
.preset .nm { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.04em; outline: none; }
.preset .nm[contenteditable="true"] { border-bottom: 1px solid var(--coral); }
.preset .cp { font-family: var(--display); font-size: var(--t-xs); color: var(--amber); font-variant-numeric: tabular-nums; }
.preset .x { color: var(--steel-faint); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); line-height: 1; padding: 0 calc(var(--f) * 0.2); }
.preset .x:hover { color: var(--alarm); }
.preset.dirty .nm::after { content: " \u2022"; color: var(--coral); }

.preset-actions { display: flex; gap: calc(var(--f) * 0.5); flex: none; }
.btn { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.45) var(--sp-2); border: 1px solid var(--steel-dark); background: transparent; color: var(--porcelain-3); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.btn:hover { border-color: var(--steel); }
.btn.save { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.btn.save[disabled] { background: transparent; border-color: var(--steel-dark); color: var(--on-surface); cursor: default; }
.autosaved { flex: none; align-self: center; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--jade); }

.fm-msg { grid-row: 1 / -1; align-self: center; justify-self: center; text-align: center; font-family: var(--display); color: var(--steel-faint); display: flex; flex-direction: column; gap: var(--sp-2); }
.fm-msg .t { font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--porcelain-3); letter-spacing: 0.04em; }
.fm-msg .retry { cursor: pointer; align-self: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-3); border: 1px solid var(--coral); background: var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

/* Cropped rather than fitted (an image model returns whatever aspect it likes), and UNDER the
   badges the slot already had. */
.slot-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.b-ic .b-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
`,ch='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="fm-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',Yi='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#fm-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',dh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8l4 4 4-6 4 6 4-4v9H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',hh={4:"\u2605\u2605\u2605\u2605",5:"\u2605\u2605\u2605\u2605\u2605"},ph={Fire:"var(--af-fire)",Water:"var(--af-water)",Wind:"var(--af-wind)",Earth:"var(--af-earth)",Light:"var(--af-light)",Dark:"var(--af-dark)"};function fh(t){return(Number(t)||0).toLocaleString("en-US")}function Ki(t){let e=t&&t.leaderSlot||"leader",a=t&&t.leader||{name:"You",role:"\u2014",affinity:"Fire",cp:0},r={id:e,leader:!0,name:a.name||"You",r:5,role:a.role||"\u2014",aff:a.affinity||"Fire",pos:a.position==="back"?"back":"front",cp:Number(a.cp)||0,portrait:a.portrait||null},s=new Map,o=(t&&Array.isArray(t.units)?t.units:[]).map(i=>{let n={id:i.id,name:i.name,r:i.rarity===5?5:4,role:i.role||"",aff:i.affinity||"Fire",pos:i.position==="back"?"back":"front",cp:Number(i.cp)||0,portrait:i.portrait||null};return s.set(n.id,n),n});return{LEADER:e,leaderObj:r,byId:s,units:o}}function Xi(t,e){return e===t.LEADER?t.leaderObj:t.byId.get(e)||null}function Ji(t){let e=t&&typeof t=="object"?t:{},a=r=>{let s=Array.isArray(r)?r:[];return[s[0]||null,s[1]||null,s[2]||null]};return{front:a(e.front),back:a(e.back)}}function Ct(t,e){return t.front.indexOf(e)>=0||t.back.indexOf(e)>=0}function uh(t,e){let a=0;return["front","back"].forEach(r=>{e[r].forEach(s=>{let o=s&&Xi(t,s);o&&(a+=o.cp)})}),a}function Zi(t,e){return(t&&Array.isArray(t.presets)&&t.presets.length?t.presets:[{name:"Team 1",board:{front:[e,null,null],back:[null,null,null]}}]).map((r,s)=>({name:r&&r.name||"Team "+(s+1),board:Ji(r&&r.board)}))}function va(t,e){return Ji(t&&t.board)}function vh(t,e,a,r,s){let o=e[r][s],i=a&&a.row===r&&a.idx===s;if(!o)return'<button class="slot empty'+(i?" held":"")+'" data-slot="'+r+":"+s+'"><span class="plus">+<small>Add</small></span></button>';let n=Xi(t,o)||t.leaderObj;return'<button class="'+("slot filled "+(n.leader?"leader":"r"+n.r)+(i?" held":""))+'" data-slot="'+r+":"+s+'">'+(n.leader?'<span class="slot-tag">LEADER</span>':"")+'<div class="slot-art">'+st(n.portrait,"","slot-photo")+(n.portrait?"":Yi)+'</div><span class="slot-remove" data-remove="'+r+":"+s+'">\xD7</span><div class="slot-meta"><div class="slot-name">'+u(he(n.name))+'</div><div class="slot-role">'+u(n.role)+" \xB7 "+u(n.aff)+"</div></div></button>"}function ma(t,e,a,r){return e[r].map((s,o)=>vh(t,e,a,r,o)).join("")}function Wi(t,e,a,r,s){let o=Ct(r,e.id),i=s&&s.bench===e.id,n="b "+(a?"leader":"r"+e.r)+(o&&!a?" inteam":"")+(i?" held":""),l=a?"\u2605\u2605\u2605\u2605\u2605":hh[e.r],d=a?'<span class="youtag">YOU</span>':"";return'<button class="'+n+'" data-pick="'+e.id+'"><span class="b-ic">'+(a?dh:e.portrait?'<img class="b-photo" src="'+u(e.portrait)+'" alt="" loading="lazy">':Yi)+'<span class="aff" style="background:'+(ph[e.aff]||"var(--steel)")+'"></span></span><span class="b-main"><span class="b-name">'+u(he(e.name))+'</span><span class="b-sub">'+u(e.role)+" \xB7 "+u(e.aff)+'</span></span><span class="b-stars">'+l+"</span>"+d+"</button>"}function Qi(t,e,a,r){let s=t.units.filter(i=>r==="all"||String(i.r)===r),o=Wi(t,t.leaderObj,!0,e,a);return s.forEach(i=>{o+=Wi(t,i,!1,e,a)}),o}function en(t,e){return t.units.filter(a=>!Ct(e,a.id)).length}function tn(t,e,a,r,s){let o="";return a.forEach((i,n)=>{let l=n===r,d=uh(t,l?e:va(i,t.LEADER));o+='<div class="preset'+(l&&s?" dirty":"")+'" data-preset="'+n+'" aria-pressed="'+l+'"><span class="nm" data-name="'+n+'">'+u(i.name)+'</span><span class="cp">'+fh(d)+'</span><span class="x" data-del="'+n+'">\xD7</span></div>'}),o}function an({state:t="loading",data:e=null,battleMode:a=!1}={}){let r;if(t==="ready"&&e){let s=Ki(e),o=Zi(e,s.LEADER),i=Math.min(Math.max(0,Number(e.active)||0),o.length-1),n=va(o[i],s.LEADER);return r='<div class="fm-body"><div class="board"><div class="row-lab">Front line &mdash; melee &amp; guard</div><div class="slots" data-row="front">'+ma(s,n,null,"front")+'</div><div class="row-lab">Back line &mdash; ranged &amp; support</div><div class="slots" data-row="back">'+ma(s,n,null,"back")+'</div><div class="board-foot"><span class="hint">Tap a unit, then a slot to place &middot; <b>\xD7</b> benches a unit</span></div></div><div class="picker"><div class="picker-head"><span class="t">Your units</span><span class="n" data-bench-n>'+en(s,n)+' available</span></div><div class="filters" data-filters><button class="chip" type="button" data-rar="all" aria-pressed="true">All</button><button class="chip" type="button" data-rar="5" aria-pressed="false">5&#9733;</button><button class="chip" type="button" data-rar="4" aria-pressed="false">4&#9733;</button></div><div class="bench-scroll"><div class="bench" data-bench>'+Qi(s,n,null,"all")+"</div></div>"+(a?'<button class="into-battle" type="button" data-into-battle>Into battle &raquo;<small>Start the fight with this team</small></button>':"")+'</div></div><div class="presets"><span class="lab">Presets</span><div class="preset-strip" data-presets>'+tn(s,n,o,i,!1)+'</div><div class="preset-actions"><span class="autosaved">Auto-saved</span><button class="btn" type="button" data-saveas>New team</button></div></div>',Vi(r,a)}return t==="error"?r=`<div class="fm-msg"><span class="t">Couldn't load the formation.</span><button class="retry" type="button" data-retry>Retry</button></div>`:r='<div class="fm-msg"><span class="t">Marshalling your units\u2026</span></div>',Vi(r,a)}function Vi(t,e){return'<div class="root">'+ch+'<div class="stage"></div><section class="screen"><div class="head"><button class="back" type="button" data-back>&#9664; '+(e?"Cancel":"Command")+'</button><div class="head-id"><div class="eyebrow">'+(e?"Before the fight":"Command")+"</div><h2>"+(e?"Choose your team":"Formation")+"</h2></div></div>"+t+"</section></div>"}function rn(t,{data:e,onSave:a,onBack:r,onRetry:s,onIntoBattle:o}={}){let i=t.querySelector("[data-back]");i&&i.addEventListener("click",()=>r&&r());let n=t.querySelector("[data-retry]");n&&n.addEventListener("click",()=>s&&s());let l=t.querySelector("[data-into-battle]");if(l&&l.addEventListener("click",()=>o&&o()),!e)return()=>{};let d=Ki(e),h=d.LEADER,f=Zi(e,h),m=Math.min(Math.max(0,Number(e.active)||0),f.length-1),v=va(f[m],h),b=null,w="all",c=!1,y=null,E=t.querySelector("[data-bench-n]"),T=t.querySelector("[data-bench]"),R=t.querySelector("[data-presets]"),W=t.querySelector("[data-save]");function O(){c=!0}function U(){let S=f.map((A,C)=>({name:A.name,board:C===m?{front:v.front.slice(),back:v.back.slice()}:{front:A.board.front.slice(),back:A.board.back.slice()}}));a&&a(S,m)}function F(){f[m].board={front:v.front.slice(),back:v.back.slice()},c=!1,U()}function j(S,A){m=S,v=va(f[S],h),c=!1,b=null,A||N()}function D(S,A,C){let P=S.bench?S.bench:v[S.row][S.idx];if(!P)return!1;let G=v[A][C];if(S.bench)v[A][C]=P;else{if(S.row===A&&S.idx===C)return!1;v[S.row][S.idx]=G,v[A][C]=P}return O(),!0}function X(S){return S.bench?!1:(v[S.row][S.idx]=null,O(),!0)}function J(S){let A=["front","back"];for(let C=0;C<2;C++){let P=v[A[C]].indexOf(S);if(P>=0)return{row:A[C],idx:P}}return null}function le(S){if(S===h&&Ct(v,h)){let A=J(h);b={row:A.row,idx:A.idx},N();return}Ct(v,S)||(b=b&&b.bench===S?null:{bench:S},N())}function oe(S){let A=S.split(":")[0],C=+S.split(":")[1];if(!b){v[A][C]&&(b={row:A,idx:C}),N();return}let P=D(b,A,C);b=null,P&&F(),N()}function re(S){let A=S.split(":")[0],C=+S.split(":")[1],P=X({row:A,idx:C});b=null,P&&F(),N()}function ee(S){let A=S.split(":");return{row:A[0],idx:+A[1]}}function Z(){for(let S of t.querySelectorAll(".drop-ok"))S.classList.remove("drop-ok")}function ue(){for(let A of t.querySelectorAll("[data-slot].filled"))A.setAttribute("draggable","true"),A.addEventListener("dragstart",function(C){if(b=null,y=ee(this.dataset.slot),C.dataTransfer){C.dataTransfer.effectAllowed="move";try{C.dataTransfer.setData("text/plain",this.dataset.slot)}catch{}}}),A.addEventListener("dragend",function(){y=null,Z()});for(let A of t.querySelectorAll("[data-slot]"))A.addEventListener("dragover",function(C){y&&(C.preventDefault(),this.classList.add("drop-ok"))}),A.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),A.addEventListener("drop",function(C){if(C.preventDefault(),!y){Z();return}let P=ee(this.dataset.slot),G=D(y,P.row,P.idx);y=null,G&&F(),N()});for(let A of t.querySelectorAll("[data-pick]")){let C=A.dataset.pick;C!==h&&!Ct(v,C)&&(A.setAttribute("draggable","true"),A.addEventListener("dragstart",function(P){if(b=null,y={bench:this.dataset.pick},P.dataTransfer){P.dataTransfer.effectAllowed="copy";try{P.dataTransfer.setData("text/plain",this.dataset.pick)}catch{}}}),A.addEventListener("dragend",function(){y=null,Z()}))}let S=t.querySelector(".picker");S&&!S._fmDrop&&(S._fmDrop=!0,S.addEventListener("dragover",function(A){y&&!y.bench&&(A.preventDefault(),this.classList.add("drop-ok"))}),S.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),S.addEventListener("drop",function(A){if(A.preventDefault(),this.classList.remove("drop-ok"),y&&!y.bench){let C=X(y);y=null,C&&F(),N()}}))}function te(S){f.length<=1||(f.splice(S,1),m>=f.length?m=f.length-1:S<m&&m--,j(m),U())}function N(){let S=t.querySelector('[data-row="front"]'),A=t.querySelector('[data-row="back"]');S&&(S.innerHTML=ma(d,v,b,"front")),A&&(A.innerHTML=ma(d,v,b,"back")),T&&(T.innerHTML=Qi(d,v,b,w)),E&&(E.textContent=en(d,v)+" available"),R&&(R.innerHTML=tn(d,v,f,m,c)),W&&(W.disabled=!c);for(let C of t.querySelectorAll("[data-slot]"))C.addEventListener("click",function(){oe(this.dataset.slot)});for(let C of t.querySelectorAll("[data-remove]"))C.addEventListener("click",function(P){P.stopPropagation(),re(this.dataset.remove)});for(let C of t.querySelectorAll("[data-pick]"))C.addEventListener("click",function(){le(this.dataset.pick)});for(let C of t.querySelectorAll("[data-preset]"))C.addEventListener("click",function(P){P.target.closest&&(P.target.closest("[data-del]")||P.target.closest("[data-name]"))||(j(+this.dataset.preset),U())});for(let C of t.querySelectorAll("[data-del]"))C.addEventListener("click",function(P){P.stopPropagation(),te(+this.dataset.del)});for(let C of t.querySelectorAll("[data-name]"))C.addEventListener("click",function(P){P.stopPropagation(),this.setAttribute("contenteditable","true"),this.focus()}),C.addEventListener("blur",function(){this.removeAttribute("contenteditable"),f[+this.dataset.name].name=(this.textContent||"").trim().slice(0,40)||"Team",N(),U()}),C.addEventListener("keydown",function(P){P.key==="Enter"&&(P.preventDefault(),this.blur())});ue()}W&&W.addEventListener("click",function(){c&&(f[m].board={front:v.front.slice(),back:v.back.slice()},c=!1,N(),U())});let _=t.querySelector("[data-saveas]");_&&_.addEventListener("click",function(){f.push({name:"Team "+(f.length+1),board:{front:v.front.slice(),back:v.back.slice()}}),j(f.length-1),U()});for(let S of t.querySelectorAll("[data-rar]"))S.addEventListener("click",function(){w=this.dataset.rar;for(let A of t.querySelectorAll("[data-rar]"))A.setAttribute("aria-pressed",String(A.dataset.rar===w));N()});return N(),()=>{}}var mh={Tank:"T",Warrior:"W",Mage:"M",Support:"S",Assassin:"A"},gh='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#cb-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',bh={fire:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5.2A6 6 0 0 1 6 14c0-4.5 4.5-6.5 6-12Z"/></svg>',water:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3c4 5.2 6 8.2 6 11.2A6 6 0 0 1 6 14.2c0-3 2-6 6-11.2Z"/></svg>',wind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 18h8"/></svg>',earth:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 21 9 12 21 3 9Z"/></svg>',light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>',dark:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 3a9 9 0 1 0 5.5 15.5A7 7 0 0 1 15.5 3Z"/></svg>'};function yh(t){return String(t||"").toLowerCase()}var nn=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size; position: absolute; inset: 0; overflow: hidden;
  font-family: var(--body); color: var(--text);
  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */


  --sp-1: calc(var(--f)*0.5); --sp-2: calc(var(--f)*1.0); --sp-3: calc(var(--f)*1.6); --sp-4: calc(var(--f)*2.4);
}
.screen { position: absolute; inset: 0; }

.arena { position: absolute; inset: 0; display: flex; flex-direction: column;
  background: radial-gradient(120% 80% at 50% 0%, #2b1c22 0%, transparent 55%), radial-gradient(120% 80% at 50% 100%, #14263a 0%, transparent 55%), linear-gradient(180deg,#1a1420 0%,#0d1119 50%,#0c1622 100%); }
.side { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: var(--sp-2) var(--sp-3); }
.side.enemies { justify-content: flex-start; gap: var(--sp-1); padding-top: var(--sp-2); }
.side.allies { justify-content: flex-end; gap: var(--sp-1); }
.midline { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--steel) 45%, transparent), transparent); }
.row { display: flex; justify-content: center; gap: var(--sp-3); }
.row.back { transform: scale(0.82); opacity: 0.95; }

.cbt { position: relative; width: calc(var(--f)*8.5); display: flex; flex-direction: column; align-items: center; gap: calc(var(--f)*0.3); transition: opacity 400ms ease, transform 400ms ease; }
.cbt .ava { position: relative; width: calc(var(--f)*7); height: calc(var(--f)*7); display: grid; place-items: center; background: linear-gradient(160deg,#26364E 0%,#141D2B 100%); border: 2px solid var(--aff, var(--steel)); box-shadow: 0 0 calc(var(--f)*1.2) color-mix(in srgb, var(--aff, var(--steel)) 35%, transparent); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius); overflow: visible; color: color-mix(in srgb, var(--aff, var(--steel)) 55%, #C7D3E2); }
.cbt .ava > svg { width: 78%; height: 92%; }
/* The unit token is an ICON: crop to the face rather than shrink the whole portrait into a ~7em
   square, the same call as the Summon strip. */
/* No overflow:hidden here on purpose: the role and affinity badges are children of .ava and sit
   OUTSIDE its box, so clipping would cut them. object-fit: cover already keeps the image in. */
.cbt .ava-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; }
.cbt .role { position: absolute; top: calc(var(--f)*-0.5); left: calc(var(--f)*-0.5); width: calc(var(--f)*1.9); height: calc(var(--f)*1.9); display: grid; place-items: center; background: var(--ink-2); border: 1px solid var(--aff, var(--steel)); font-family: var(--display); font-weight: 700; font-size: calc(var(--f)*0.9 * var(--gf-type-scale, 1)); color: var(--text); }
.cbt .aff-badge { position: absolute; top: calc(var(--f)*-0.5); right: calc(var(--f)*-0.5); width: calc(var(--f)*2); height: calc(var(--f)*2); display: grid; place-items: center; background: var(--ink-2); border: 1px solid var(--aff, var(--steel)); color: var(--aff, var(--steel)); box-shadow: 0 0 calc(var(--f)*0.8) color-mix(in srgb, var(--aff, var(--steel)) 40%, transparent); }
.cbt .aff-badge svg { width: 72%; height: 72%; }
.cbt .nm { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f)*0.92 * var(--gf-type-scale, 1)); letter-spacing: 0.04em; color: var(--text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbt .bars { width: 100%; display: flex; flex-direction: column; gap: calc(var(--f)*0.2); }
.cbt .hp, .cbt .en { height: calc(var(--f)*0.55); background: var(--ink-3); overflow: hidden; }
.cbt .hp > i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg,#1C6B54,var(--jade)); transition: width 320ms ease; }
.cbt .en > i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg,var(--amber-deep),var(--amber)); transition: width 320ms ease; }
.cbt.enemy .hp > i { background: linear-gradient(90deg,#8a1f2e,var(--alarm)); }
.cbt.charged .ava { animation: charged 900ms ease-in-out infinite; }
@keyframes charged { 0%,100% { box-shadow: 0 0 calc(var(--f)*1.2) color-mix(in srgb,var(--aff, var(--steel)) 35%,transparent); } 50% { box-shadow: 0 0 calc(var(--f)*2.6) color-mix(in srgb,var(--aff, var(--steel)) 80%,transparent); } }
.cbt.acting { transform: translateY(calc(var(--f)*-0.8)) scale(1.06); z-index: 5; }
.cbt.hit .ava { animation: hitShake 320ms ease; }
@keyframes hitShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-3px); } 40% { transform: translateX(3px); } 60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }
.cbt.dead { opacity: 0.28; filter: grayscale(1) brightness(0.7); transform: scale(0.9); }
.cbt.dead .bars { visibility: hidden; }
/* Real HP figures over the bar. Tabular so they do not jitter, hard shadow because they sit on
   top of the bar and the art. */
.cbt .hpn { display: block; margin-top: calc(var(--f) * 0.1); font-family: var(--display); font-size: calc(var(--f) * 0.62 * var(--gf-type-scale, 1)); letter-spacing: 0.04em; color: var(--text); font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0,0,0,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.fx { position: absolute; inset: calc(var(--f)*-1); pointer-events: none; z-index: 6; }
.vfx { position: absolute; inset: 0; }
.vfx.hit { background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.85) 0%, transparent 55%); animation: flash 300ms ease forwards; }
@keyframes flash { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }
.vfx.slash::before { content: ""; position: absolute; top: 8%; left: -10%; width: 120%; height: 14%; background: linear-gradient(90deg,transparent,var(--fxc,#fff),transparent); transform: rotate(-32deg); transform-origin: center; filter: drop-shadow(0 0 4px var(--fxc,#fff)); animation: slash 360ms ease forwards; }
@keyframes slash { 0% { opacity: 0; transform: rotate(-32deg) translateX(-40%) scaleX(0.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: rotate(-32deg) translateX(40%) scaleX(1); } }
.vfx.wave { position: absolute; border: 2px solid var(--fxc,#fff); border-radius: 50%; opacity: 0; box-shadow: 0 0 18px var(--fxc,#fff); animation: wave 620ms ease-out forwards; }
@keyframes wave { 0% { opacity: 0.9; transform: scale(0.2); } 100% { opacity: 0; transform: scale(1.5); } }
.vfx.shield::before { content: ""; position: absolute; inset: 6%; border: 2px solid var(--water); background: radial-gradient(circle, color-mix(in srgb,var(--water) 30%, transparent) 0%, transparent 70%); clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); animation: shieldPop 700ms ease forwards; }
@keyframes shieldPop { 0% { opacity: 0; transform: scale(1.3); } 30% { opacity: 1; transform: scale(1); } 80% { opacity: 0.8; } 100% { opacity: 0; } }
.vfx.heal { background: radial-gradient(circle at 50% 80%, color-mix(in srgb,var(--jade) 55%, transparent) 0%, transparent 60%); animation: flash 700ms ease forwards; }
.vfx.heal::after { content: "+ + +"; position: absolute; left: 0; right: 0; bottom: 6%; text-align: center; color: var(--jade); font-family: var(--display); font-weight: 700; letter-spacing: 0.3em; font-size: calc(var(--f)*1.1 * var(--gf-type-scale, 1)); animation: rise 800ms ease forwards; }
@keyframes rise { 0% { opacity: 0; transform: translateY(30%); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-40%); } }
.vfx.buff::before { content: ""; position: absolute; inset: 20% 18%; border-top: 2px solid var(--amber); border-radius: 50%; box-shadow: 0 0 10px var(--amber); animation: auraUp 720ms ease forwards; }
@keyframes auraUp { 0% { opacity: 0; transform: translateY(40%) scaleX(0.6); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-30%) scaleX(1.1); } }
.vfx.buff::after { content: "\u25B2\u25B2\u25B2"; position: absolute; left: 0; right: 0; top: 8%; text-align: center; color: var(--amber); font-size: calc(var(--f)*0.9 * var(--gf-type-scale, 1)); letter-spacing: 0.3em; animation: rise 760ms ease forwards; }
.vfx.debuff { background: radial-gradient(circle at 50% 30%, color-mix(in srgb,var(--epic) 45%, transparent) 0%, transparent 62%); animation: flash 720ms ease forwards; }
.vfx.debuff::after { content: "\u25BC\u25BC\u25BC"; position: absolute; left: 0; right: 0; bottom: 10%; text-align: center; color: var(--epic); font-size: calc(var(--f)*0.9 * var(--gf-type-scale, 1)); letter-spacing: 0.3em; animation: sink 760ms ease forwards; }
@keyframes sink { 0% { opacity: 0; transform: translateY(-30%); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(40%); } }
.vfx.stun::before { content: "\u2726   \u2726   \u2726"; position: absolute; top: -14%; left: 0; right: 0; text-align: center; color: var(--amber); font-size: calc(var(--f)*1.1 * var(--gf-type-scale, 1)); letter-spacing: 0.2em; animation: spinStars 900ms linear; transform-origin: center; }
@keyframes spinStars { 0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; } }

.dmg { position: absolute; left: 50%; top: 20%; transform: translateX(-50%); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); text-shadow: 0 1px 3px rgba(0,0,0,0.8); animation: floatUp 1000ms ease forwards; white-space: nowrap; }
.dmg.crit { font-size: var(--t-xl); }
.dmg.d { color: #FFD9CE; } .dmg.d.crit { color: #FFB199; }
.dmg.h { color: #8FE7C6; } .dmg.s { color: #B7E2FF; } .dmg.b { color: #FFE08A; } .dmg.f { color: #E7C9FF; }
.dmg .eff { display: block; margin-top: calc(var(--f)*0.1); font-size: calc(var(--f)*0.8 * var(--gf-type-scale, 1)); letter-spacing: 0.14em; text-shadow: 0 1px 2px rgba(0,0,0,0.9); }
.dmg .eff.strong { color: #FFD84D; } .dmg .eff.weak { color: #9FB4CC; }
@keyframes floatUp { 0% { opacity: 0; transform: translate(-50%,20%) scale(0.7); } 20% { opacity: 1; transform: translate(-50%,0) scale(1.1); } 45% { transform: translate(-50%,-30%) scale(1); } 100% { opacity: 0; transform: translate(-50%,-90%); } }

.cbar { position: absolute; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3); background: linear-gradient(180deg, rgba(9,13,20,0.85), transparent); }
.cbar .back { display: inline-flex; align-items: center; gap: calc(var(--f)*0.4); background: color-mix(in srgb,var(--surface) 92%,transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f)*0.4) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.cbar .wave-id { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.08em; color: var(--text); }
.cbar .wave-id small { display: block; font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.cbar .ctrls { margin-left: auto; display: flex; gap: calc(var(--f)*0.4); }
.cbar .ctrls button { cursor: pointer; background: color-mix(in srgb,var(--ink) 55%,transparent); border: 1px solid var(--steel-dark); color: var(--text); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.08em; text-transform: var(--case); padding: calc(var(--f)*0.35) var(--sp-2); }
.cbar .ctrls button[aria-pressed="true"] { border-color: var(--coral); color: var(--coral); }
/* The fullscreen toggle reads as one more control in this row: same box as its siblings, a square
   one. Its glyph is sized off --f like everything else on a screen -- the shell's copy uses rem,
   which is legal there (it is chrome) and is exactly what a screen may not do. */
.cbar .ctrls .gf-fs-bar { display: inline-flex; align-items: center; justify-content: center; padding: calc(var(--f)*0.35) calc(var(--f)*0.55); }
.cbar .ctrls .gf-fs-bar svg { display: block; width: calc(var(--f)*1.3); height: calc(var(--f)*1.3); }
.cbar .ctrls .gf-fs-bar:hover { border-color: var(--coral); color: var(--coral); }

.abanner { position: absolute; top: 42%; left: 0; right: 0; text-align: center; z-index: 9; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; letter-spacing: 0.1em; text-transform: var(--case); color: var(--text); pointer-events: none; opacity: 0; }
.abanner.show { animation: abanner 900ms ease forwards; }
.abanner .big { font-size: var(--t-2xl); text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
.abanner .sub { display: block; font-size: var(--t-sm); color: var(--coral); letter-spacing: 0.24em; }
@keyframes abanner { 0% { opacity: 0; transform: translateY(10px) scale(0.96); } 20% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; } }


/* THIS HEADER HEIGHT IS DECLARED ONCE AND BOTH SIDES READ IT. Written by hand in --f (a GEOMETRIC
   unit) the header grew with the text-size control and the gap did not: measured, at 175% the
   Objective kicker landed 24px under it. A box that holds TEXT is not measured on the geometry. */
.root { --fbar-h: calc(var(--sp-1) * 2 + var(--t-xs) * 1.3 + var(--t-lg)); }
.head { position: absolute; top: 0; left: 0; right: 0; z-index: 10; min-height: var(--fbar-h); display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3); }
.head .head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head .head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); }
/* \u2500\u2500 Prebattle briefing \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The arena used to fight the controls for the middle of the screen. Now the battlefield RECEDES,
   blurred and dimmed into a backdrop, and the centre becomes the briefing. Nothing scrolls; the
   top bar stays above the veil so chapter, title and CP remain readable. */
.vig-note { margin-top: var(--sp-1); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); color: var(--steel-faint); }
.vig-note.short { color: var(--alarm); }
.fstart b { font-weight: 700; color: inherit; opacity: 0.85; margin-left: calc(var(--f)*0.4); }
.fstart[disabled] { opacity: 0.5; cursor: default; }
.veil { position: absolute; inset: 0; z-index: 6; backdrop-filter: blur(5px) saturate(0.75); background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb,var(--ink) 62%,transparent) 0%, color-mix(in srgb,var(--ink) 88%,transparent) 70%); }
/* THE BRIEFING FILLS THE SCREEN, IT IS NOT ABSOLUTELY CENTRED. Two causes:
   1) top 52% + translate(-50%,-50%) centres a box with NO HEIGHT CAP: it grows both ways and, being
      absolute, never enlarges its parent, so no overflow test sees it -- Start ended up below the
      cut. Now a flex fills the inset and only the prose region gives.
   2) width: min(46rem, 82%) -- a rem follows the ROOT font-size, not the stage, and no screen here
      has one on purpose. It was also NARROW: 736px of a 1920 stage, wrapping the objective into
      five huge lines when in 16:9 width is what is FREE.
   The top padding applies only WHILE the header is on screen: hoisting removes it. */
.briefing { position: absolute; inset: 0; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); }
.root:has(.head) .briefing { padding-top: calc(var(--fbar-h) + var(--sp-2)); }
.briefing > * { flex: none; max-width: 100%; }
/* Only the prose gives; the button, the counter and the presets are chrome and never move. */
.brief-scroll { flex: 0 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); width: 100%; }
.brief-kicker { display: inline-flex; align-items: center; gap: calc(var(--f)*0.6); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.24em; text-transform: var(--case); color: var(--coral); }
.brief-kicker::before, .brief-kicker::after { content: ""; width: calc(var(--f)*2.2); height: 1px; background: var(--coral); opacity: 0.55; }
.brief-obj { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.25; color: var(--text); }
.brief-open { margin: 0 0 var(--sp-2); font-size: var(--t-md); line-height: 1.5; color: var(--text); }
.brief-meta { display: flex; gap: var(--sp-3); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }
.brief-meta b { color: var(--text); }
.fstart { cursor: pointer; background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); letter-spacing: 0.14em; text-transform: var(--case); padding: calc(var(--f)*0.85) var(--sp-4); --cut: 0.8em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); box-shadow: 0 10px 34px color-mix(in srgb,var(--coral) 28%,transparent); }
.cbt-presets { display: flex; align-items: center; gap: calc(var(--f) * 0.5); flex-wrap: wrap; justify-content: center; max-width: 92%; }
.cbt-presets .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }
.cbt-preset { cursor: pointer; display: flex; align-items: center; gap: calc(var(--f) * 0.5); background: color-mix(in srgb, var(--ink) 68%, transparent); border: 1px solid var(--steel-dark); color: var(--porcelain-3); padding: calc(var(--f) * 0.35) calc(var(--f) * 0.8); font-family: var(--display); }
.cbt-preset[aria-pressed="true"] { border-color: var(--coral); background: color-mix(in srgb, var(--coral) 16%, var(--ink-2)); color: var(--text); }
.cbt-preset .nm { font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); }
.cbt-preset .cp { font-size: var(--t-xs); color: var(--amber); font-variant-numeric: tabular-nums; }

.cb-msg { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; font-family: var(--display); color: var(--steel-faint); }
.cb-msg .box { display: flex; flex-direction: column; gap: var(--sp-2); align-items: center; }
.cb-msg .t { font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--porcelain-3); }
.cb-msg .retry { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f)*0.5) var(--sp-3); border: 1px solid var(--coral); background: var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }

/* \u2500\u2500 THE CARD + THE BAND \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The unit token becomes a 2:3 PORTRAIT CARD the generated art fills, with the name and bars on its
   lower third. The party is drawn ONCE as a band along the bottom; the field above is the enemy's.
   Measured before -> after: unit ink 12% -> 42.6% of the arena, the player's card 91x107 ->
   156x234, and the formation spans 95% of the width instead of 29%.
   All CSS on purpose: markup, class names and every wireCombat selector are untouched. */
.root {
  --cw: calc(var(--f)*9.4); /* the enemy card; the band sets its own below */
  /* THE BAND'S CARD IS CAPPED BY THE STAGE, not by --f alone, and this is the phone bug.
     --f has a 7.5px FLOOR: below it every f-sized box stops shrinking while the stage keeps going.
     Six cards + five gaps + the padding are 95.9f, which fits the 98.2f a 16:9 stage is wide --
     until the floor bites. Measured on the user's phone (915x412, stage 688): the band asked for
     719px and the first and last card lost 5px each; at 844x390 it was 25px each.
     The second term is what six of them MAY take: (100cqw - 8.3f) / 6. On a desktop stage the
     first term is the smaller one, so nothing there moves. Six because that is a full party --
     with fewer the band simply sits wider apart. */
  --acw: min(calc(var(--f)*14.6), calc(16.6cqw - 1.4 * var(--f)));
  /* DERIVED, never a literal: the band is exactly one card plus the front row's step and its
     padding, and a typed 24.5f stops being true the moment the card is capped. The midline reads
     the same token, so the two cannot drift apart. */
  --band: calc(var(--acw)*1.5 + var(--f)*2.6);
}

.cbt { width: var(--cw); height: calc(var(--cw)*1.5); display: block; }
/* THE FRAME HAS TO CONTAIN THE ART, AND ONLY ONE STYLE WAS DOING IT (user: "some styles have a
   different frame closure"). The base rule left this box overflow: visible, and its comment says why
   -- the badges used to hang OUTSIDE at a negative offset. On a card they do not: both sit inside,
   at 0.45f. So the reason expired and the cost stayed.
   FOUR OF THE FIVE STYLES turn the card clip OFF and close the frame with a radius (14, 20, 2, 18px)
   -- and border-radius does NOT clip a child. With the clip off and overflow visible, NOTHING held
   the square image and it painted over the rounded corners. Only the chamfered style was clipping,
   which is the one every measurement of this screen had been taken in.
   (The token is named without its colon on purpose: a probe reads a colon here as a screen
   re-declaring a theme token.) */
.cbt .ava { position: absolute; inset: 0; width: 100%; height: 100%; --cut: 0.75em; overflow: hidden; }
.cbt .ava > svg { width: 100%; height: 100%; } /* the no-portrait silhouette fills the card */
.cbt .ava-photo { object-position: 50% 8%; }
/* On a full-bleed card the badges come inside, or they float over the neighbouring unit. */
.cbt .role { top: calc(var(--f)*0.45); left: calc(var(--f)*0.45); width: calc(var(--f)*1.9); height: calc(var(--f)*1.9); font-size: calc(var(--f)*0.95 * var(--gf-type-scale, 1)); }
.cbt .aff-badge { top: calc(var(--f)*0.45); right: calc(var(--f)*0.45); width: calc(var(--f)*2); height: calc(var(--f)*2); }
.cbt::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 42%; z-index: 2;
  background: linear-gradient(0deg, rgba(9,13,20,0.94) 12%, rgba(9,13,20,0.55) 52%, transparent 100%); pointer-events: none; }
.cbt .bars { position: absolute; left: 7%; right: 7%; bottom: 7%; width: auto; z-index: 3; }
.cbt .hp, .cbt .en { height: calc(var(--f)*0.62); }
.cbt .nm { position: absolute; left: 7%; right: 7%; bottom: 20%; z-index: 3; text-align: center;
  font-size: calc(var(--f)*1.05 * var(--gf-type-scale, 1)); text-shadow: 0 1px 3px rgba(0,0,0,0.9); }

/* THE ENEMY FIELD. A 2:3 card is tall, so two rows do not fit and the rows overlap -- and a
   straight overlap puts the front row over the back row's name and bars. So the rows sit a full
   card apart and the back row is offset HALF A STEP into the gaps: they never share a column.
   The track is a FIXED 3 columns rather than centred content, because centring each row on its own
   breaks the interleave when the rows hold different counts: 2 front + 1 back centres the lone
   card exactly ON a front card, right over its nameplate. */
.side.enemies { flex: 1; padding: calc(var(--f)*3.4) calc(var(--f)*1.2) 0; justify-content: center; }
.side.enemies .row { position: relative; display: grid; grid-template-columns: repeat(3, var(--cw)); gap: calc(var(--cw)*1.15); justify-content: center; }
.side.enemies .row.back { transform: translateX(calc(var(--cw)*1.075)); filter: brightness(0.84); }
.side.enemies .row.front { margin-top: calc(var(--cw)*-0.85); z-index: 3; }
/* A row can arrive with more than the three the track holds. Then the side drops the interleave:
   smaller cards, rows that simply stack. No shared lattice to get wrong. */
.side.enemies:has(.row > .cbt:nth-child(4)) { --cw: calc(var(--f)*8.6); }
.side.enemies:has(.row > .cbt:nth-child(4)) .row { display: flex; gap: calc(var(--cw)*0.25); }
.side.enemies:has(.row > .cbt:nth-child(4)) .row.back { transform: none; }
.side.enemies:has(.row > .cbt:nth-child(4)) .row.front { margin-top: 0; }

/* THE BAND. display: contents dissolves the two row boxes without touching the markup, so the same
   DOM serves the field and the band. The step that lifts the front line is a MARGIN, not a
   transform: wireCombat drives .acting and .dead through transform and a row-scoped rule would
   outrank them. */
.side.allies { flex: 0 0 var(--band); flex-direction: row; align-items: flex-end;
  justify-content: center; gap: calc(var(--f)*1.1); padding: 0 calc(var(--f)*1.4) calc(var(--f)*1.2);
  --cw: var(--acw); }
.side.allies .row { display: contents; }
.side.allies .cbt { flex: none; }
.side.allies .row.front .cbt { margin-bottom: calc(var(--f)*1.1); }
/* :not(.dead) so a fallen unit still greys out -- this selector outranks .cbt.dead. */
.side.allies .row.back .cbt:not(.dead) { filter: brightness(0.9); }
/* The tag says which line the player seated this unit on -- which is what the sim now fights with. */
.side.allies .cbt::before { position: absolute; top: calc(var(--f)*0.45); left: 50%; transform: translateX(-50%);
  z-index: 4; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700;
  font-size: calc(var(--f)*0.78 * var(--gf-type-scale, 1)); letter-spacing: 0.16em; padding: 0 calc(var(--f)*0.6); }
.side.allies .row.front .cbt::before { content: "FRONT"; background: var(--coral); color: var(--on-coral); }
.side.allies .row.back .cbt::before { content: "BACK"; background: var(--ink-2); color: var(--steel); border: 1px solid var(--steel-dark); }
/* The tag owns the top centre, so the role and affinity badges step down out of its way. */
.side.allies .cbt .role, .side.allies .cbt .aff-badge { top: calc(var(--f)*2.6); }
.midline { top: auto; bottom: var(--band); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,wh='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="cb-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.14"/></linearGradient></defs></svg>';function xh(t,e){let a=yh(t.affinity);return'<div class="cbt'+(e?" enemy":"")+'" data-id="'+u(t.id)+'" data-aff="'+a+'" style="--aff:var(--'+a+')"><div class="fx" data-fx></div><div class="ava">'+(t.portrait?'<img class="ava-photo" src="'+u(t.portrait)+'" alt="" loading="lazy">':gh)+'<span class="role">'+(mh[t.role]||"?")+'</span><span class="aff-badge" title="'+a+'">'+(bh[a]||"")+'</span></div><div class="bars"><div class="hp"><i style="width:100%"></i></div><span class="hpn"></span><div class="en"><i></i></div></div><div class="nm">'+u(he(t.name))+"</div></div>"}function sn(t,e){let a=t.filter(o=>(o.position||"front")==="front"),r=t.filter(o=>o.position==="back"),s=(o,i)=>o.length?'<div class="row '+i+'">'+o.map(n=>xh(n,e)).join("")+"</div>":"";return e?s(r,"back")+s(a,"front"):s(a,"front")+s(r,"back")}function on(t,e){return'<div class="arena"><div class="side enemies" data-side-enemies>'+sn(e,!0)+'</div><div class="midline"></div><div class="side allies" data-side-allies>'+sn(t,!1)+"</div></div>"}function kh(t){let e=Array.isArray(t&&t.presets)?t.presets:[];if(e.length<=1)return"";let a=typeof t.activePreset=="number"?t.activePreset:0;return'<div class="cbt-presets" data-cbt-presets><span class="lab">Team</span>'+e.map(r=>'<button class="cbt-preset" type="button" data-preset-pick="'+r.index+'"'+(r.index===a?' aria-pressed="true"':"")+'><span class="nm">'+u(he(r.name))+'</span><span class="cp">'+(Number(r.cp)||0).toLocaleString("en-US")+"</span></button>").join("")+"</div>"}function ln({phase:t="loading",payload:e=null,node:a=null,result:r=null,vigor:s=null,error:o=""}={}){let i=a&&a.title||"Combat",n;if(t==="prebattle"&&e)n=on(e.allies||[],e.enemies||[])+'<div class="veil"></div><div class="head"><button class="back" type="button" data-back>&#9664; Chapter</button><div class="head-id"><div class="eyebrow">Combat</div><h2>'+u(i)+'</h2></div></div><div class="briefing"><div class="brief-scroll"><span class="brief-kicker">Objective</span>'+(e.opening?'<p class="brief-open">'+u(e.opening)+"</p>":"")+'<p class="brief-obj">'+u(e.objective||"Defeat the enemy formation.")+'</p></div><div class="brief-meta">'+(a&&a.chapter?"<span>Chapter <b>"+u(String(a.chapter))+"</b></span>":"")+"<span>Your team <b>"+(e.allies||[]).length+"</b></span><span>Enemies <b>"+(e.enemies||[]).length+"</b></span></div>"+kh(e)+(s&&Number.isFinite(s.cost)?'<button class="fstart" type="button" data-start'+(s.have>=s.cost?"":" disabled")+">Start battle &raquo; <b>"+s.cost+" Vigor</b></button>"+(s.have>=s.cost?'<div class="vig-note">'+s.have+" Vigor left</div>":'<div class="vig-note short">Not enough Vigor &mdash; '+s.have+" of "+s.cost+(s.nextMs?", +1 in "+Math.max(1,Math.ceil(s.nextMs/6e4))+"m":"")+"</div>"):'<button class="fstart" type="button" data-start>Start battle &raquo;</button>')+"</div>";else if(t==="battle"&&e)n=on(e.allies||[],e.enemies||[])+'<div class="cbar"><button class="back" type="button" data-back>&#9664; Retreat</button><div class="wave-id"><small>'+u(i)+'</small>Auto-battle</div><div class="ctrls"><button type="button" data-play aria-pressed="true">&#10074;&#10074; Pause</button><button type="button" data-speed aria-pressed="false">&times;1</button><button type="button" data-skip>Skip &raquo;</button><button class="gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">'+ka+'</button></div></div><div class="abanner" data-abanner><span class="big"></span><span class="sub"></span></div>';else if(t==="error"){let l=o==="empty-party";n='<div class="cb-msg"><div class="box"><span class="t">'+(l?"This team has no units. Seat at least one in Formation.":"Couldn't set up the battle.")+"</span>"+(l?"":'<button class="retry" type="button" data-retry>Retry</button>')+'<button class="retry" type="button" data-back style="background:transparent;border-color:var(--steel);color:var(--text)">Back</button></div></div>'}else n='<div class="cb-msg"><div class="box"><span class="t">Preparing the battle\u2026</span></div></div>';return'<div class="root">'+wh+'<section class="screen">'+n+"</section></div>"}function cn(t,{phase:e,steps:a=[],result:r=null,onStart:s,onBack:o,onFinished:i,onRetry:n,onPickPreset:l}={}){let d=t.querySelector("[data-back]");d&&d.addEventListener("click",()=>o&&o());for(let N of t.querySelectorAll("[data-preset-pick]"))N.addEventListener("click",function(){l&&l(+this.dataset.presetPick)});let h=t.querySelector("[data-retry]");h&&h.addEventListener("click",()=>n&&n());let f=t.querySelector("[data-start]");if(f&&f.addEventListener("click",()=>s&&s()),e!=="battle")return()=>{};let m=1.9,v=null,b=0,w=!1,c=1,y=N=>t.querySelector('.cbt[data-id="'+String(N).replace(/"/g,"")+'"]'),E=t.querySelector("[data-abanner]");function T(N,_,S,A){let C=y(N);if(!C)return;let P=C.querySelector(".hp > i");P&&(P.style.width=Math.max(0,_)+"%");let G=C.querySelector(".hpn");G&&Number.isFinite(S)&&Number.isFinite(A)&&(G.textContent=Math.max(0,S).toLocaleString("en-US")+" / "+A.toLocaleString("en-US")),_<=0?(C.classList.add("dead"),C.classList.remove("charged")):C.classList.remove("dead")}function R(N,_){let S=y(N);if(!S)return;let A=S.querySelector(".en > i");A&&(A.style.width=Math.min(100,_)+"%"),S.classList.toggle("charged",_>=100&&!S.classList.contains("dead"))}function W(N,_,S){let A=y(N);if(!A)return;let C=A.querySelector("[data-fx]");if(!C)return;let P=document.createElement("div");P.className="vfx "+_,S&&P.style.setProperty("--fxc",S),C.appendChild(P),setTimeout(()=>{P.parentNode&&P.parentNode.removeChild(P)},1e3/c)}function O(N,_,S,A){let C=y(N);if(!C)return;let P=C.querySelector("[data-fx]");if(!P)return;let G=document.createElement("span");G.className="dmg "+S,A?G.innerHTML=u(_)+'<b class="eff '+A.toLowerCase()+'">'+A+(A==="STRONG"?" \xD71.5":" \xD70.75")+"</b>":G.textContent=_,P.appendChild(G),setTimeout(()=>{G.parentNode&&G.parentNode.removeChild(G)},1100/c)}function U(N){let _=y(N);_&&(_.classList.add("acting"),setTimeout(()=>_.classList.remove("acting"),520/c))}function F(N){let _=y(N);_&&(_.classList.add("hit"),setTimeout(()=>_.classList.remove("hit"),340/c))}function j(N,_){E&&(E.querySelector(".big").textContent=N,E.querySelector(".sub").textContent=_||"",E.classList.remove("show"),E.offsetWidth,E.classList.add("show"))}function D(N,_){let S=t.querySelector(N==="enemies"?"[data-side-enemies]":"[data-side-allies]");if(!S)return;let A=document.createElement("div");A.className="vfx wave",A.style.cssText="left:12%;top:20%;width:76%;height:60%;--fxc:"+_,S.style.position="relative",S.appendChild(A),setTimeout(()=>{A.parentNode&&A.parentNode.removeChild(A)},700/c)}function X(N,_){switch(N.op){case"start":_&&j("Battle start","Affinity rules every hit");break;case"act":_&&U(N.id);break;case"ult":_&&(U(N.id),j(N.name,N.sub));break;case"hit":_&&(F(N.id),W(N.id,"hit"),W(N.id,"slash","#fff"),O(N.id,"-"+N.amount+(N.crit?"!":""),"d"+(N.crit?" crit":""),N.effLabel||"")),T(N.id,N.hpPct,N.hp,N.hpMax);break;case"heal":_&&(W(N.id,"heal"),O(N.id,"+"+N.amount,"h")),T(N.id,N.hpPct,N.hp,N.hpMax);break;case"energy":R(N.id,N.pct);break;case"hp":T(N.id,N.pct,N.hp,N.hpMax);break;case"shieldFx":if(_)for(let S of N.ids||[])W(S,"shield");break;case"buff":_&&(W(N.id,"buff"),O(N.id,N.text,"b"));break;case"debuff":_&&(W(N.id,"debuff"),O(N.id,N.text,"f"));break;case"stun":_&&W(N.id,"stun");break;case"aoe":_&&D(N.side,N.color);break;case"death":{let S=y(N.id);S&&S.classList.add("dead");break}case"revive":{let S=y(N.id);S&&S.classList.remove("dead"),_&&(W(N.id,"heal"),O(N.id,"REVIVE","b"));break}case"end":le(N.result);break;default:break}}let J=!1;function le(N){J||(J=!0,i&&i(N==="lose"?"lose":"win"))}function oe(){let N=a[b++];for(let _ of N.events)X(_,!0)}function re(){if(w||b>=a.length)return;let N=a[b];oe(),v=setTimeout(re,(N.d||500)*m/c)}function ee(){for(clearTimeout(v);b<a.length;){let N=a[b++];for(let _ of N.events)X(_,!1)}}let Z=t.querySelector("[data-play]");Z&&Z.addEventListener("click",function(){w=!w,this.setAttribute("aria-pressed",String(!w)),this.innerHTML=w?"&#9654; Play":"&#10074;&#10074; Pause",w?clearTimeout(v):re()});let ue=t.querySelector("[data-speed]");ue&&ue.addEventListener("click",function(){c=c===1?2:c===2?3:1,this.setAttribute("aria-pressed",String(c>1)),this.innerHTML="&times;"+c});let te=t.querySelector("[data-skip]");return te&&te.addEventListener("click",()=>{ee()}),r?ee():re(),()=>{clearTimeout(v)}}var dn=10;function _h(t){let e=t&&t.progress||{},a=1;for(let r of Object.keys(e)){let s=Number(r);Number.isInteger(s)&&s>a&&(a=s)}return a}function Sh(t){let e=_h(t),a=t&&t.progress&&t.progress[String(e)]||{},r=Number(a.normal)||0,s=`Chapter ${we(e)}`;return r<=0?`${s} \xB7 not started`:r>=dn?`${s} \xB7 complete`:`${s} \xB7 ${r} / ${dn}`}var hn=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.rn-root {
  /* NO page scroll: the screen is a fixed frame and only the LIST scrolls, so the title
     and the Back control never slide away. */
  position: absolute; inset: 0; overflow: hidden;
  display: flex; flex-direction: column;
  font-family: var(--display);
  color: var(--text);
  background:
    radial-gradient(90% 70% at 82% 8%, var(--ink-3) 0%, transparent 60%),
    radial-gradient(70% 55% at 20% 108%, color-mix(in srgb, var(--coral) 12%, transparent) 0%, transparent 60%),
    linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%);
}
.rn-frame { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: clamp(1rem, 2.6vw, 2rem); gap: 1.1rem; }

.rn-head { flex: none; display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
.rn-eyebrow { font-family: inherit; font-size: .68rem; letter-spacing: .2em; text-transform: var(--case); color: var(--coral); }
.rn-head h1 { margin: .1rem 0 .15rem; font-family: var(--title); font-weight: var(--title-weight); font-stretch: var(--stretch); font-size: clamp(1.3rem, 3vw, 2rem); line-height: 1; }
.rn-head p { margin: 0; color: var(--steel-faint); font-size: .8rem; max-width: 60ch; }
.rn-new { margin-left: auto; display: inline-flex; align-items: center; gap: .5rem; background: var(--coral); color: var(--on-coral); border: 0; cursor: pointer; font-stretch: var(--stretch); font-weight: 700; font-size: .95rem; letter-spacing: .1em; text-transform: var(--case); padding: .6rem 1.1rem; --cut: .7em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.rn-new:hover { background: var(--coral-deep); }

.rn-list { flex: 1; min-height: 0; overflow: auto; display: grid; align-content: start; grid-template-columns: repeat(auto-fill, minmax(min(300px,100%),1fr)); gap: .8rem; }
.rn-empty { color: var(--steel-faint); font-size: .85rem; }

.rn-run { position: relative; display: grid; grid-template-columns: 1fr auto; gap: .8rem; background: linear-gradient(120deg,var(--surface) 0%,var(--porcelain-2) 100%); color: var(--on-surface); padding: .85rem 1rem; --cut: 11px; clip-path: var(--clip-card); border-radius: var(--radius); border-left: 3px solid var(--steel-faint); }
.rn-run.active { border-left-color: var(--coral); }
.rn-badge { position: absolute; top: 0; right: 0; display: inline-flex; align-items: center; gap: .35em; background: var(--coral); color: var(--on-coral); font-size: .6rem; letter-spacing: .18em; text-transform: var(--case); font-weight: 700; padding: .18rem .5rem; --cut: .6em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.rn-badge::before { content: ""; width: .38rem; height: .38rem; border-radius: 50%; background: var(--on-coral); }
.rn-info { min-width: 0; }
.rn-name { font-stretch: var(--stretch); font-weight: 700; font-size: 1.2rem; line-height: 1.05; }
.rn-scn { margin: .25rem 0 .45rem; font-size: .78rem; line-height: 1.4; color: var(--steel); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rn-prog { display: inline-flex; align-items: center; gap: .4rem; font-size: .68rem; letter-spacing: .1em; text-transform: var(--case); color: var(--steel); }
.rn-actions { display: flex; flex-direction: column; justify-content: center; gap: .35rem; }
.rn-go { background: var(--coral); color: var(--on-coral); border: 0; cursor: pointer; white-space: nowrap; font-stretch: var(--stretch); font-weight: 700; font-size: .85rem; letter-spacing: .1em; text-transform: var(--case); padding: .5rem .85rem; --cut: .6em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.rn-go:hover { background: var(--coral-deep); }
.rn-go.switch { background: transparent; color: var(--on-surface); border: 1px solid var(--steel); }
.rn-go.switch:hover { border-color: var(--coral); color: var(--coral-deep); }
/* On-surface, not steel: the delete entry and the confirm's safe exit sit ON the card, and
   steel there measured 3.1 to 4.2 on three of the five styles. */
.rn-del { background: transparent; border: 0; color: var(--on-surface); cursor: pointer; font-size: .72rem; letter-spacing: .08em; text-transform: var(--case); padding: .25rem .5rem; }
.rn-del:hover { color: var(--alarm); }
.rn-confirm { display: none; gap: .3rem; }
.rn-run.confirming .rn-del { display: none; }
.rn-run.confirming .rn-confirm { display: flex; }
/* Red but READABLE: white on plain alarm measured 4.1, under the floor. Same recipe as the
   forge escape, measured there at 11 to 15.7: alarm-tinted ink ground, normal text on top. */
.rn-yes { background: color-mix(in srgb, var(--alarm) 26%, var(--ink)); color: var(--text); border: 1px solid var(--alarm); cursor: pointer; font-size: .7rem; letter-spacing: .08em; text-transform: var(--case); padding: .25rem .5rem; }
.rn-yes:hover { background: color-mix(in srgb, var(--alarm) 40%, var(--ink)); }
.rn-no { background: transparent; border: 1px solid var(--steel-faint); color: var(--on-surface); cursor: pointer; font-size: .7rem; letter-spacing: .08em; text-transform: var(--case); padding: .25rem .5rem; }
/* The warning spans the card while asking: deleting is not a row action, it takes the world.
   Alarm-tinted INK ground with the normal text on top -- alarm-tinted text measured 3.45 on
   aurora's surface at its best mix; this recipe reads 11+ on all five, same as the forge. */
.rn-warn { display: none; grid-column: 1 / -1; margin: 0; padding: .45rem .55rem; background: color-mix(in srgb, var(--alarm) 26%, var(--ink)); color: var(--text); border-left: 2px solid var(--alarm); font-size: .72rem; line-height: 1.45; }
.rn-run.confirming .rn-warn { display: block; }

.rn-back { flex: none; align-self: flex-start; background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); cursor: pointer; font-size: .8rem; letter-spacing: .1em; text-transform: var(--case); padding: .5rem .9rem; --cut: .7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.rn-back:hover { border-color: var(--coral); color: var(--coral); }
`;function pn({runs:t,activeRunId:e}){return`
<div class="rn-root">
  <div class="rn-frame">
    <div class="rn-head">
      <div>
        <span class="rn-eyebrow">Saved worlds</span>
        <h1>Your Worlds</h1>
        <p>Switch between saved worlds, or start a new one. Each keeps its own chapters and progress.</p>
      </div>
      <button class="rn-new" type="button" data-new>&#43; New run</button>
    </div>
    <div class="rn-list">${(Array.isArray(t)?t:[]).map(s=>{let o=u(s.runId),i=s.runId===e,n=s.name&&String(s.name).trim()?s.name:"Untitled run",l=i?'<span class="rn-badge">Active</span>':"",d=i?`<button class="rn-go" type="button" data-go="${o}">Continue</button>`:`<button class="rn-go switch" type="button" data-go="${o}">Switch</button>`;return`<article class="rn-run${i?" active":""}">`+l+`<div class="rn-info"><div class="rn-name">${u(n)}</div><p class="rn-scn">${u(s.scenario)}</p><span class="rn-prog">${u(Sh(s))}</span></div><div class="rn-actions">`+d+`<button class="rn-del" type="button">Delete</button><span class="rn-confirm"><button class="rn-yes" type="button" data-del="${o}">Delete</button><button class="rn-no" type="button">Cancel</button></span></div><p class="rn-warn">Delete this world? Everything goes with it &mdash; its cast, its art and its story. It cannot be undone.</p></article>`}).join("")||'<p class="rn-empty">No runs yet.</p>'}</div>
    <button class="rn-back" type="button" data-back>&#9664; Back to the game</button>
  </div>
</div>`}function fn(t,{onNew:e,onSwitch:a,onDelete:r,onBack:s}){t.querySelector("[data-new]")?.addEventListener("click",()=>e&&e()),t.querySelector("[data-back]")?.addEventListener("click",()=>s&&s());for(let o of t.querySelectorAll("[data-go]"))o.addEventListener("click",()=>a&&a(o.getAttribute("data-go")));for(let o of t.querySelectorAll(".rn-del"))o.addEventListener("click",()=>o.closest(".rn-run")?.classList.add("confirming"));for(let o of t.querySelectorAll(".rn-no"))o.addEventListener("click",()=>o.closest(".rn-run")?.classList.remove("confirming"));for(let o of t.querySelectorAll("[data-del]"))o.addEventListener("click",()=>r&&r(o.getAttribute("data-del")))}function ga(t){return(t<10?"0":"")+t}var vn=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: pointer;
  /* The whole screen is a click-to-advance surface, so a click must never start a selection. The
     backlog opts back in below: there the text is meant to be read and copied. */
  user-select: none;
  -webkit-user-select: none;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp; everything on this screen derives from it.
     min(): the SCARCER dimension wins, so the screen fills its box without overflowing. The ceiling
     is a guard, not a working limit: at 13px a 1920 screen drew at the size a 1275 one gets.
     cqh requires container-type: size on THIS element. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);

  /* How much of the BAND the speaker's portrait takes; the width comes from this height through the
     2:3 ratio. Measured at 100%: 267x401, 15.4% of the stage. */
  --plate-h: 100%;
}

.vn-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(80% 60% at 50% 116%, color-mix(in srgb, var(--coral) 14%, transparent) 0%, transparent 60%),
    radial-gradient(95% 75% at 82% 4%, #26364F 0%, transparent 58%),
    linear-gradient(168deg, #16202F 0%, #090E15 100%);
}
/* TWO ART LAYERS, so a scene that moves CROSSFADES instead of cutting. Same shape as the speaker
   plate's two layers, and for the same reason: background-image cannot be transitioned, so the
   incoming picture fades in over the outgoing one on its own element. The gradient above stays
   underneath both, so a place with no art yet still reads as deliberate. */
.vn-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0;
  transition: opacity var(--dur, 380ms) var(--ease, ease);
}
.vn-bg[data-on] { opacity: 1; }
.vn-scene::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(0deg, rgba(6,10,16,0.72) 0%, transparent 42%);
}
/* THE TOP SCRIM. A story background can be a pale sky, on which light text disappears, so the
   chapter label needs its own veil -- checked by compositing the gradient's alpha AT THE TEXT'S
   HEIGHT against white, in all five styles. It stays near-opaque until past the label: a gradient
   already falling where the text lives is not enough. */
.vn-scene::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(6,10,16,0.92) 0%, rgba(6,10,16,0.88) 7%, transparent 16%);
}

.vn { position: absolute; inset: 0; display: flex; flex-direction: column; }

/* Exit + scene caption. Leaves the top-right corner free for the shell's fullscreen button. */
.vn-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) calc(var(--f) * 4) var(--sp-2) var(--sp-3);
}
.vn-exit {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.4);
  background: rgba(14,20,32,0.5);
  color: var(--steel-faint);
  border: 1px solid var(--steel-dark);
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-sm);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.4) var(--sp-2);
  cursor: pointer;
  --cut: 0.5em; clip-path: var(--clip-chip); border-radius: var(--radius-sm);
  transition: color 140ms ease, border-color 140ms ease;
}
.vn-exit:hover { color: var(--text); border-color: var(--steel); }
.vn-caption { display: inline-flex; flex-direction: column; line-height: 1.1; min-width: 0; }
/* Uses the TEXT token, never the porcelain SURFACE one -- that one is a surface in half the
   styles. Measured 1.6:1, 1.4:1 and 2.0:1, i.e. absent. Decide by the CSS PROPERTY, never by the
   value: the two roles only coincide in the default style, which is what hid it.
   (No token name may be followed by a colon here: the probe reads that as a re-declaration.) */
.vn-caption .loc { font-family: var(--display); font-size: var(--t-sm); font-weight: 700; letter-spacing: 0.1em; text-transform: var(--case); color: var(--text); }
.vn-caption .mood { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }
/* The replay mark. TEXT token, never a surface one: read against a generated background. */
.vn-caption .vn-re { margin-left: calc(var(--f) * 0.7); padding: 0 calc(var(--f) * 0.4); font-weight: 700; color: var(--text); border: 1px solid color-mix(in srgb, var(--text) 40%, transparent); border-radius: var(--radius-sm); }

.vn-stage { flex: 1; min-height: 0; position: relative; }

/* The dock trims the bar and box off the edges and centres them. Kept WIDE -- the narration uses
   almost the whole width, and both share this width so they stay aligned. */
.vn-dock { width: min(88%, calc(var(--f) * 160)); margin: 0 auto; }

.vn-bar { position: relative; z-index: 3; display: flex; align-items: flex-end; justify-content: space-between; gap: var(--sp-2); margin-bottom: -1px; }
.vn-who {
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: 0.06em;
  padding: calc(var(--f) * 0.4) var(--sp-3);
  color: var(--on-coral);
  background: var(--coral);
  --cut: 0.55em; clip-path: var(--clip-chip); border-radius: var(--radius-sm);
  white-space: nowrap;
}
.vn-who[data-narration] { background: var(--steel-dark); color: var(--steel-faint); text-transform: var(--case); letter-spacing: 0.2em; font-size: var(--t-sm); }
/* A THOUGHT IS NOT SPEECH and used to be painted exactly like it, so the protagonist read as
   talking to themselves out loud. THREE signals, because one is deniable at a glance: the plate
   loses the coral every spoken line has, the box's top rule goes with it, and the prose turns
   italic. The portrait STAYS -- somebody is thinking this. The hue is the engine's own for a
   thought; here it is only a hue, the VN draws no rarity.
   The plate mixes into --ink rather than the steel the narration plate uses, and that is a
   MEASURED choice -- across the five styles the contrast floor is 5.72:1 against 3.87 for the
   steel base (the narration plate, which shipped long ago, reads 2.51).
   (No token name may be followed by a colon in this file: the probe reads that as a
   re-declaration, which is exactly how this comment first failed.) */
.vn-who[data-thought] { background: color-mix(in srgb, var(--epic) 50%, var(--ink)); color: var(--text); }
.vn-tools { display: flex; gap: calc(var(--f) * 0.4); }
.vn-tool {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.35);
  background: rgba(14,20,32,0.5);
  border: 1px solid var(--steel-dark);
  color: var(--steel-faint);
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-xs);
  letter-spacing: 0.14em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.35) var(--sp-2);
  cursor: pointer;
  --cut: 0.35em; clip-path: var(--clip-card); border-radius: var(--radius);
  transition: color 140ms ease, border-color 140ms ease, background 140ms ease; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.vn-tool:hover { color: var(--text); border-color: var(--steel); }
.vn-tool[data-on] { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.vn-tool svg { width: calc(var(--f) * 1.1); height: calc(var(--f) * 1.1); }

.vn-box {
  position: relative;
  z-index: 3;
  margin: 0 0 var(--sp-4);
  min-height: calc(var(--f) * 11);
  background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 72%, transparent) 0%, color-mix(in srgb, var(--ink) 90%, transparent) 100%);
  border-top: 2px solid color-mix(in srgb, var(--coral) 55%, transparent);
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
  --cut: 0.8em; clip-path: var(--clip-card); border-radius: var(--radius);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px); backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.vn-box[data-narration] { border-top-color: color-mix(in srgb, var(--steel) 55%, transparent); }
.vn-box[data-thought] { border-top-color: color-mix(in srgb, var(--epic) 70%, transparent); }
.vn-box[data-thought] .vn-text { font-style: italic; }
.vn-text {
  font-family: var(--body);
  /* THE NARRATION READS ITS OWN SCALE, not the HUD one: welded to the same knob the ratio was
     pinned at 1.42:1 across every step, so comfortable labels forced 31px of prose. */
  font-size: calc(var(--f) * 1.42 * var(--gf-narr-scale, 1));
  line-height: 1.62;
  color: var(--text);
  max-width: none; /* fill the box: the narration uses almost the whole width */
  min-height: calc(var(--f) * 1.42 * 1.62 * 3);
  text-wrap: pretty;
}
.vn-count { position: absolute; left: var(--sp-4); bottom: calc(var(--f) * 0.7); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }

.vn-next { position: absolute; right: var(--sp-4); bottom: var(--sp-2); color: var(--coral); animation: vn-bob 1s ease-in-out infinite; }
.vn-next svg { width: calc(var(--f) * 1.8); height: calc(var(--f) * 1.8); display: block; }
@keyframes vn-bob { 0%, 100% { transform: translateY(0); opacity: 0.9; } 50% { transform: translateY(28%); opacity: 0.4; } }

.vn-continue {
  position: absolute;
  right: var(--sp-4);
  bottom: var(--sp-2);
  display: inline-flex;
  align-items: center;
  gap: calc(var(--f) * 0.55);
  background: var(--coral);
  color: var(--on-coral);
  border: 0;
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: 0.12em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.6) var(--sp-3);
  cursor: pointer;
  --cut: 0.6em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
  transition: background 140ms ease;
}
.vn-continue:hover { background: var(--coral-deep); }
.vn-continue:focus-visible { outline: none; box-shadow: inset 0 0 0 2px #FFFFFF; }
.vn-continue svg { width: calc(var(--f) * 1.3); height: calc(var(--f) * 1.3); }

/* \u2500\u2500 THE BACKLOG \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A PANEL OVER THE SCENE in the house vocabulary, not a full-bleed sheet. It replaces a hardcoded
   rgba veil, a list capped at 70 ramp units that left a third of the screen showing artwork, and a
   NARRATION label on every line -- measured, 9 of 11 entries carried one.
   It is the picker's shape because a picker is the same problem: something opened OVER a screen
   you have not left. */
.vn-log { user-select: text; -webkit-user-select: text; position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; cursor: pointer; }
/* The house scrim. The old one was a literal rgba(): a hardcoded colour cannot follow five styles. */
.vn-log-veil {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}
/* OPAQUE over an opaque base: on the glass styles a translucent panel composites against the scene
   and the contrast lands somewhere different in every style. */
.vn-log-panel {
  position: relative;
  z-index: 2;
  width: min(84%, calc(var(--f) * 84));
  height: 80%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  cursor: default;
  background: linear-gradient(0deg, var(--ink-2), var(--ink-2)), var(--ink);
  border: 1px solid var(--ink-3);
  border-top: 2px solid var(--coral);
  --cut: 1em;
  clip-path: var(--clip-card);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
}
/* Title and the way out. It used to carry a Close button AND a "Tap outside to close" caption. */
.vn-log-cab { display: flex; align-items: baseline; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); border-bottom: 1px solid var(--ink-3); }
.vn-log-cab .ttl { font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.vn-log-close {
  margin-left: auto;
  flex: none;
  cursor: pointer;
  font-family: var(--display);
  font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-xs);
  letter-spacing: 0.1em;
  text-transform: var(--case);
  padding: calc(var(--f) * 0.3) var(--sp-2);
  background: transparent;
  border: 1px solid var(--steel-dark);
  color: var(--text);
  --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm);
}
.vn-log-close:hover { border-color: var(--coral); color: var(--coral); }
/* NO reading cap: the panel IS the measure. Capping left the prose in a column with the panel
   empty beside it. */
.vn-log-list { overflow: auto; display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-3); min-height: 0; cursor: default; }
/* A NAMED speaker gets their name; NARRATION GETS NOTHING -- it is the default voice, so labelling
   it repeats what the absence already says, on almost every row. */
.vn-log-who { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--coral); margin-bottom: calc(var(--f) * 0.2); }
.vn-log-item.said { border-left: 2px solid var(--steel-dark); padding-left: var(--sp-2); }
/* Same prose, re-read, so it follows the NARRATION scale. Colour is --text and never a SURFACE
   token: measured against the panel ground the ratios were 1.27 on signal, 1.50 on aurora and 2.17
   on ember -- the same colour as what it sits on. Decide by the CSS PROPERTY, never by the value.
   No token name followed by a colon here: the probe reads that as a re-declaration. */
.vn-log-line { font-size: calc(var(--f) * 1.0 * var(--gf-narr-scale, 1)); line-height: 1.55; color: var(--text); }
/* The backlog is re-read, so it needs the same distinction the box makes -- otherwise a scene
   read back turns every thought into a spoken line again. */
.vn-log-item.thought .vn-log-who { color: var(--epic); }
.vn-log-item.thought .vn-log-line { font-style: italic; color: color-mix(in srgb, var(--text) 82%, transparent); }

/* \u2500\u2500 The speaker frame \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A framed column that OPENS at one side and pushes the narration box over, not a sprite floating
   over the scene, and for two reasons:
   - Generated art is NOT a cut-out: every image arrives opaque with its own composition, so
     feathering is content-dependent. A frame is deterministic and object-fit NORMALIZES.
   - Overlaying the box caused every defect: a full-height edge surfaces in the gaps the centred box
     does not cover, and cutting the column at the box's top slices the art in half.
   Flush to its screen edge and to the foot, so exactly ONE edge is exposed -- the inner one. */
/* THE PORTRAIT STOPS SHORT OF THE NAME TAB. It used to end exactly where the tab begins -- measured
   0px of clearance at all five letter scales -- and since the tab sits INSIDE the portrait's width
   and wears the same accent, the two read as one piece: the portrait sitting on top of the name
   (user, with a screenshot). The gap is taken off the CAST BOX, so the plate rises and shrinks with
   it instead of being clipped at the top, where the face is. */
.vn-cast { position: absolute; inset: 0 0 calc(var(--f) * 0.6) 0; z-index: 1; pointer-events: none; overflow: hidden; }
.vn-cast-in { position: relative; width: 100%; height: 100%; }

/* THE PORTRAIT RESTS ON THE BOX'S CEILING, not the screen's floor, and that costs no number:
   .vn-cast lives inside .vn-stage, so bottom: 0 IS that ceiling and stays correct when the box
   grows. A hand-measured 177px would be wrong on the first longer beat. It replaces a plate that
   made the BOX step aside instead (975 to 758px of width).
   WIDTH comes from HEIGHT through the 2:3 ratio: anchored top and bottom, the window decided the
   proportion (0.58 against 0.67) and cover ate the face from the sides. */
.vn-plate {
  position: absolute;
  bottom: 0;
  height: var(--plate-h);
  width: auto;
  aspect-ratio: 2 / 3;
  box-sizing: border-box;
  /* The edge is drawn as BACKGROUND, not a border: clip-path cuts the border box, so a real border
     comes out unstroked along the diagonal. The plate IS the stroke. */
  /* The style's accent, NOT the rarity ramp: rarity is Roster and Summon language, and painting
     this by rarity put a yellow frame on Signal's green palette. Deliberately the SAME expression
     as .vn-box's top border, so frame and box read as one piece of chrome. */
  background: color-mix(in srgb, var(--coral) 55%, transparent);
  box-shadow: var(--panel-shadow), var(--panel-bevel);
  --edge-w: 2px;
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}
/* Padded only on the two exposed sides \u2014 a stroke along the screen edge would read as a stray line. */
.vn-plate[data-side="right"] {
  right: 0;
  padding: var(--edge-w) 0 0 var(--edge-w);
  clip-path: var(--plate-clip-right);
  border-top-left-radius: var(--radius);
}
.vn-plate[data-side="left"] {
  left: 0;
  padding: var(--edge-w) var(--edge-w) 0 0;
  clip-path: var(--plate-clip-left);
  border-top-right-radius: var(--radius);
}
.vn-plate[data-open="false"] { opacity: 0; }
.vn-plate[data-side="right"][data-open="false"] { transform: translateX(18%); }
.vn-plate[data-side="left"][data-open="false"] { transform: translateX(-18%); }

/* Clipped on the same angle so the stroke keeps an even width. Two layers so a second speaker on
   the same side CROSSFADES inside a frame that never moves. */
.vn-art {
  position: absolute;
  inset: var(--edge-w) 0 0 var(--edge-w);
  overflow: hidden;
  opacity: 0;
  background: linear-gradient(180deg, var(--glow-1) 0%, var(--ground-2) 100%);
  transition: opacity var(--dur-swap) var(--ease);
}
.vn-plate[data-side="left"] .vn-art { inset: var(--edge-w) var(--edge-w) 0 0; }
.vn-plate[data-side="right"] .vn-art { clip-path: var(--plate-clip-right); }
.vn-plate[data-side="left"] .vn-art { clip-path: var(--plate-clip-left); }
/* The same corner the Home's plate lost: where --plate-clip-* is none only the frame's radius
   shapes it, and a child neither inherits it nor is clipped by it. Derived from the frame's. */
.vn-plate[data-side="right"] .vn-art { border-top-left-radius: max(0px, calc(var(--radius) - var(--edge-w))); }
.vn-plate[data-side="left"] .vn-art { border-top-right-radius: max(0px, calc(var(--radius) - var(--edge-w))); }
.vn-plate[data-front="a"] .vn-art[data-art="a"], .vn-plate[data-front="b"] .vn-art[data-art="b"] { opacity: 1; }
.vn-art > img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%;
  -webkit-user-drag: none; pointer-events: none; }
.vn-art::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 55%, transparent) 0%, transparent 22%);
}
/* No art yet: a figure in shadow, same box and edges, so art arriving later changes no layout. */
.vn-figure { position: absolute; left: 4%; bottom: 0; width: 92%; height: 88%; opacity: 0.4; color: var(--porcelain-3); }

/* THE DOCK NO LONGER MOVES: two rules used to shrink it to clear a portrait that reached the floor.
   On the box's ceiling there is nothing to clear, and the box keeps its full width (975 against
   758). The data-portrait attribute stays: it expresses which side each speaker opens on. */

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Eh=380,Th='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4l14 8-14 8V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',Ah='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5l9 7-9 7V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Nh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14M5 12h14M5 19h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Ih='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ch='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function Rh(t){return'<svg class="vn-figure" data-figure viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"'+(t?" hidden":"")+'><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>'}function br(t){return String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/gu,"").replace(/[^a-z0-9 ]/gu," ").replace(/\s+/gu," ").trim()}var Lh=new Set(["you","yourself","me","myself","i","player","protagonist"]);function yr(t,e){let a=br(e);if(!a||!Array.isArray(t)||!t.length)return null;for(let i of t)if(i&&br(i.name)===a)return i;if(Lh.has(a)){let i=t.find(n=>n&&n.prota);if(i)return i}let r=a.split(" ")[0];if(!r)return null;let s=!a.includes(" "),o=null;for(let i of t){if(!i)continue;let n=br(i.name).split(" ");if(s?n.includes(a):n[0]===r){if(o)return null;o=i}}return o}function ba(t){return t?t.prota?"left":"right":""}function un(t,e){let a=!!e&&ba(e)===t,r=a&&e.art?String(e.art):"",s=o=>{let i=o==="a"&&r;return'<div class="vn-art" data-art="'+o+'"><img data-img alt=""'+(i?' src="'+u(r)+'"':"")+(i?"":" hidden")+" />"+Rh(!!i)+"</div>"};return'<div class="vn-plate" data-side="'+t+'" data-plate="'+t+'" data-open="'+(a?"true":"false")+'" data-front="a">'+s("a")+s("b")+"</div>"}function wr(t,e,a){let r=t&&typeof t.place=="string"?t.place:"",s=e&&typeof e=="object"?e:null,o=r&&s&&typeof s[r]=="string"?s[r].trim():"";return o||(typeof a=="string"?a.trim():"")}function xr(t){return!t||!t.speaker?t&&t.thought?"Thought":"Narration":t.thought?t.speaker+" (thought)":t.speaker}function mn({chapterLabel:t,nodeTitle:e,segments:a,cast:r=[],background:s="",places:o=null,replay:i=!1,prologue:n=!1}){let l=Array.isArray(a)&&a.length?a:[{speaker:"",text:""}],d=l[0],h=!d.speaker,f=!!d.thought,m=ga(1)+" / "+ga(l.length),v=wr(d,o,s),b=`<div class="vn-bg" data-bg="a"${v?` data-on style="background-image:url(${u(v)})"`:""}></div><div class="vn-bg" data-bg="b"></div>`,w=Array.isArray(r)?r.filter(Boolean):[],c=w.length?yr(w,d.speaker):null,y=w.length?`<div class="vn-cast" data-cast><div class="vn-cast-in">${un("left",c)}${un("right",c)}</div></div>`:"",E=ba(c);return`
<div class="root">
  <div class="vn-scene">${b}</div>
  <div class="vn"${E?` data-portrait="${E}"`:""} data-vn>
    <div class="vn-top">
      ${n?"":'<button class="vn-exit" type="button" data-exit>&#9664; Chapter</button>'}
      <span class="vn-caption"><span class="loc">${u(e||"Story")}</span><span class="mood">${u(t||"")}${i?'<b class="vn-re">Rereading &middot; free</b>':""}</span></span>
    </div>

    <div class="vn-stage">${y}</div>

    <div class="vn-dock">
      <div class="vn-bar">
        <span class="vn-who"${h?" data-narration":""}${f?" data-thought":""} data-who>${u(xr(d))}</span>
        <div class="vn-tools">
          <button class="vn-tool" type="button" data-auto>${Th}Auto</button>
          <button class="vn-tool" type="button" data-skip>${Ah}Skip</button>
          <button class="vn-tool" type="button" data-log>${Nh}Log</button>
        </div>
      </div>

      <div class="vn-box"${h?" data-narration":""}${f?" data-thought":""} data-box>
        <div class="vn-text" data-text>${u(d.text)}</div>
        <span class="vn-count" data-count>${m}</span>
        <span class="vn-next" data-next hidden>${Ih}</span>
        <button class="vn-continue" type="button" data-continue hidden>${n?"Go to Home":i?"Back to the map":"Continue"}${Ch}</button>
      </div>
    </div>

    <div class="vn-log" data-log-box hidden>
      <div class="vn-log-veil"></div>
      <div class="vn-log-panel">
        <div class="vn-log-cab"><span class="ttl">Backlog</span><button class="vn-log-close" type="button" data-log-close>Close</button></div>
        <div class="vn-log-list" data-log-list></div>
      </div>
    </div>
  </div>
</div>`}function gn(t,e){let a=Array.isArray(e.segments)&&e.segments.length?e.segments:[{speaker:"",text:""}],{onContinue:r,onExit:s}=e,o=t.querySelector(".root"),i=t.querySelector("[data-box]"),n=t.querySelector("[data-who]"),l=t.querySelector("[data-text]"),d=t.querySelector("[data-count]"),h=t.querySelector("[data-next]"),f=t.querySelector("[data-continue]"),m=t.querySelector("[data-exit]"),v=t.querySelector("[data-auto]"),b=t.querySelector("[data-skip]"),w=t.querySelector("[data-log]"),c=t.querySelector("[data-log-box]"),y=t.querySelector("[data-log-list]"),E=t.querySelector("[data-log-close]"),T=typeof window<"u"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,R=0,W=!1,O=null,U=!1,F=null;function j(){O&&(clearInterval(O),O=null),W=!1}function D(){F&&(clearTimeout(F),F=null)}let X=t.querySelector("[data-vn]"),J={left:t.querySelector('[data-plate="left"]'),right:t.querySelector('[data-plate="right"]')},le=Array.isArray(e.cast)?e.cast.filter(Boolean):[],oe=yr(le,a[0].speaker),re=oe?oe.name:null,ee=ba(oe),Z=null,ue={a:t.querySelector('[data-bg="a"]'),b:t.querySelector('[data-bg="b"]')},te="a",N=wr(a[0],e.places,e.background);function _(g,k){!g||typeof g.setAttribute!="function"||(k?g.setAttribute("hidden",""):g.removeAttribute("hidden"))}function S(g,k,B){!g||typeof g.setAttribute!="function"||(B?g.setAttribute(k,""):g.removeAttribute(k))}function A(g,k){if(!g)return;let B=g.getAttribute("data-front")==="a"?"b":"a",L=g.querySelector('[data-art="'+B+'"]');if(L){let H=L.querySelector("[data-img]"),I=L.querySelector("[data-figure]"),M=k&&k.art?String(k.art):"";H&&(M&&H.setAttribute("src",M),_(H,!M)),_(I,!!M)}g.setAttribute("data-front",B)}function C(g,k){A(J[g],k),J[g]&&J[g].setAttribute("data-open","true"),X&&X.setAttribute("data-portrait",g),ee=g}function P(){for(let g of["left","right"])J[g]&&J[g].setAttribute("data-open","false");X&&X.removeAttribute("data-portrait"),ee=""}function G(g){if(!J.left&&!J.right)return;let k=yr(le,g.speaker),B=k?k.name:null;if(B===re)return;if(re=B,Z&&(clearTimeout(Z),Z=null),!k){P();return}let L=ba(k);if(ee&&ee!==L){P(),Z=setTimeout(()=>{Z=null,C(L,k)},Eh);return}C(L,k)}function de(g){let k=wr(g,e.places,e.background);if(k===N)return;N=k;let B=te==="a"?"b":"a",L=ue[B],H=ue[te];L&&L.style&&(L.style.backgroundImage=k?"url("+k+")":""),S(L,"data-on",!!k),S(H,"data-on",!1),te=B}function Ee(g){let k=!g.speaker,B=!!g.thought;n&&(n.textContent=xr(g),S(n,"data-narration",k),S(n,"data-thought",B)),i&&(S(i,"data-narration",k),S(i,"data-thought",B)),G(g)}function ze(){let g=R>=a.length-1;h&&(h.hidden=g),f&&(f.hidden=!g)}function ye(g){j(),l&&(l.textContent=g.text),ze(),U&&R<a.length-1&&(F=setTimeout(pe,1500))}function ae(g,k){if(j(),D(),Ee(g),de(g),d&&(d.textContent=ga(R+1)+" / "+ga(a.length)),h&&(h.hidden=!0),f&&(f.hidden=!0),!k||T){ye(g);return}l&&(l.textContent=""),W=!0;let B=0;O=setInterval(()=>{B+=1,l&&(l.textContent=g.text.slice(0,B)),B>=g.text.length&&ye(g)},18)}function pe(){if(D(),W){ye(a[R]);return}R<a.length-1&&(R+=1,ae(a[R],!0))}function p(){if(!y)return;let g="";for(let B=0;B<=R;B+=1){let L=!!a[B].speaker;g+='<div class="vn-log-item'+(L?" said":"")+(a[B].thought?" thought":"")+'">'+(L?'<div class="vn-log-who"></div>':"")+'<div class="vn-log-line"></div></div>'}y.innerHTML=g;let k=y.querySelectorAll(".vn-log-item");for(let B=0;B<=R;B+=1){let L=k[B];if(!L)continue;let H=L.querySelector(".vn-log-who"),I=L.querySelector(".vn-log-line");H&&(H.textContent=xr(a[B])),I&&(I.textContent=a[B].text)}c&&(c.hidden=!1),y.scrollTop=y.scrollHeight}function x(){c&&(c.hidden=!0)}return o&&o.addEventListener("click",g=>{let k=g&&g.target;k&&k.closest&&k.closest("[data-exit],[data-continue],[data-auto],[data-skip],[data-log],[data-log-box]")||pe()}),f&&f.addEventListener("click",g=>{g&&g.stopPropagation&&g.stopPropagation(),r&&r()}),m&&m.addEventListener("click",g=>{g&&g.stopPropagation&&g.stopPropagation(),s&&s()}),v&&v.addEventListener("click",g=>{g&&g.stopPropagation&&g.stopPropagation(),U=!U,U?v.setAttribute("data-on",""):v.removeAttribute("data-on"),U&&!W&&R<a.length-1?F=setTimeout(pe,1200):D()}),b&&b.addEventListener("click",g=>{g&&g.stopPropagation&&g.stopPropagation(),D(),U=!1,v&&v.removeAttribute("data-on"),R=a.length-1,ae(a[R],!1)}),w&&w.addEventListener("click",g=>{g&&g.stopPropagation&&g.stopPropagation(),p()}),E&&E.addEventListener("click",g=>{g&&g.stopPropagation&&g.stopPropagation(),x()}),c&&c.addEventListener("click",g=>{let k=g&&g.target;if(!k)return;(typeof k.closest=="function"?k.closest(".vn-log-panel"):k!==c)||x()}),ae(a[0],!1),()=>{j(),D(),Z&&(clearTimeout(Z),Z=null)}}var bn="marinara-capability-gacha-forge",Mh=900,Oh=new Set(["boot","banner","art","forge"]),Bh={busy:"Another portrait for this unit is still on its way. Give it a moment.","no-image-connection":"This world has no image connection \u2014 pick one in settings > Style.","engine-unreachable":"Could not reach the image service.","generation-failed":"The image backend refused this prompt. Shorter tags usually help.","upload-failed":"The gallery would not take that image.","bad-image":"That is not an image the gallery accepts (PNG, JPEG, WebP, GIF or AVIF).","too-large":"That image is too big to send. Crop it smaller or save it at a lower quality.","not-in-history":"That portrait is not kept any more.","not-allowed":"This unit's portrait is not ours to repaint.","not-found":"This unit is gone.","bad-request":"Something was missing from that request."},ya="/api/gacha-forge",yn=`.gf-boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0E1420;color:#7E93AE;font-family:"Bahnschrift","Segoe UI",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem}.gf-boot::before{content:'';width:.6rem;height:.6rem;background:#F2603C;transform:rotate(45deg);margin-right:.6rem;animation:gf-boot-blink .9s steps(2) infinite}@keyframes gf-boot-blink{50%{opacity:.2}}.gf-boot-bad{flex-direction:column;gap:.8rem;color:#C7D3E2;text-transform:none;letter-spacing:.04em;font-size:.85rem;text-align:center;padding:1.2rem}.gf-boot-bad::before{display:none}.gf-boot-bad button{cursor:pointer;font:inherit;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;border:1px solid #F2603C;background:#F2603C;color:#10151F}`,kr=class extends HTMLElement{constructor(){super(),this._root=this.attachShadow({mode:"open"}),this._props={},this._onPropsChange=()=>this._apply(),this._initState()}_initState(){this._drawnView=null,this._renderKey=null,this._helpOpen=new Set,this._eventId="",this._forgeCancelAsking=!1,this._forgeCancelling=!1,this._eventsRev=0,this._login=null,this._loginKey="",this._eventGained=null,this._eventRelic=null,this._loginOpen=!1,this._loginSeen=!1,this._pass=null,this._passKey="",this._passTab="daily",this._seasonal=null,this._seasonalKey="",this._seasonalGained=null,this._seasonalDrawing=!1,this._seasonalHelp=!1,this._newWorld=null,this._newWorldKey="",this._eventSlots=null,this._eventSlotsKey="",this._claimingNewWorld=!1,this._newWorldGained=null,this._achCat="campaign",this._achRev=0,this._achievements=null,this._achKey="",this._alerts=null,this._nextStepCtx=null,this._shopCat="key",this._shopRev=0,this._outfits=[],this._vigorMenu=!1,this._boot="idle",this._bootError="",this._pick=null,this._pickOptions=null,this._pickRev=0,this._runs=[],this._runsRev=0,this._runsKey="",this._activeRunId=null,this._run=null,this._showRuns=!1,this._creatingNew=!1,this._bannerReady=!1,this._bannerState="idle",this._wallet=null,this._nodePay=null,this._storyNotice="",this._storyStarting=!1,this._rosterCount=0,this._artReady=!0,this._prologue=!1,this._unlocks={},this._unlockNews=[],this._prologueGift=null,this._claimingUnlock=!1,this._artState="idle",this._art={done:0,total:0,name:""},this._forge={done:0,total:0,name:""},this._artBlocking=!1,this._plan=null,this._planState="idle",this._planChapter=1,this._forgeCleanup=null,this._roster=null,this._rosterState="idle",this._rosterCat="char",this._rosterRarity="all",this._rosterQuery="",this._rosterUnitId=null,this._rosterRev=0,this._unit=null,this._farmBusy=!1,this._farm=null,this._farmState="idle",this._farmView="root",this._farmRev=0,this._inventory=null,this._inventoryState="idle",this._invSection="relics",this._invView={slot:"all",rarity:"all",picked:"",feeding:null,gained:[]},this._invRev=0,this._invBusy=!1,this._result=null,this._busyLocal=new Map,this._busySeq=0,this._resultRev=0,this._growth=null,this._growthRev=0,this._feed=null,this._unitLevel=1,this._unitBond=0,this._unitState="idle",this._gearSlot=null,this._gearFeed=null,this._relics=null,this._relicsRev=0,this._feedBusy=!1,this._equipBusy=!1,this._unitTab="profile",this._outfitAt=0,this._outfitBusy=!1,this._outfitEditing=!1,this._outfitHistoryMax=6,this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev=0,this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonHistory=null,this._summonHistoryOpen=!1,this._summonHistoryState="idle",this._summonHistoryPage=1,this._summonArting=!1,this._summonResults=null,this._summonCleanup=null,this._formation=null,this._formationState="idle",this._formationBattleMode=!1,this._pendingCombat=null,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._combatNode=null,this._combatPreset=null,this._battleLoading=!1,this._combatCleanup=null,this._hudView="home",this._difficulty="normal",this._chapterProgress={normal:0,hard:0,veryhard:0},this._chaptersData=null,this._chaptersState="idle",this._beatState="idle",this._beat=null,this._beatCast=null,this._beatPlaces=null,this._beatArt=null,this._activeStoryNode=null,this._beatRequested=!1,this._beatCleanup=null,this._contextTokens=0,this._warnTokens=3e4,this._continuity=null,this._continuityState="idle",this._compressing=null,this._settingsCategory=tt,this._settingsFrom="home",this._settingsRev=0}get capabilityProps(){return this._props}set capabilityProps(e){this._props=e&&typeof e=="object"?e:{},this._boot==="ready"&&this._refreshState(),this._apply()}static get observedAttributes(){return["view"]}attributeChangedCallback(){this._apply()}connectedCallback(){this.addEventListener("marinara-capability-props",this._onPropsChange),this._boot==="ready"&&this._resync(),this._apply()}disconnectedCallback(){this.removeEventListener("marinara-capability-props",this._onPropsChange),this._stopForge(),this._stopBeat(),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null)}_reportError(e){let a=e instanceof Error?e.message:String(e);this.capabilityRuntimeError=a,this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:a}}))}_apply(){try{(this.getAttribute("view")||"browser")==="browser"?this._renderBrowser():this._root.innerHTML=""}catch(e){this._reportError(e)}}_adoptUnlocks(e){this._unlocks=e&&e.unlocks||{},this._unlockNews=Array.isArray(e&&e.unlockNews)?e.unlockNews:[],this._prologueGift=e&&e.prologueGift||null}_lockOf(e){return this._unlocks&&this._unlocks[e]||null}_currentUnlockNews(){let e=this._unlockNews[0];if(!e||!ir[e])return null;let a={key:e,...ir[e]};return a.gift&&this._prologueGift!=="ready"&&delete a.gift,a}_closeUnlockNews(e){if(!this._run||this._claimingUnlock)return;let a=this._currentUnlockNews(),r=!!(a&&a.key===e&&a.gift),s=()=>{this._claimingUnlock=!1,this._unlockNews=this._unlockNews.filter(o=>o!==e),this._postJson("/unlock/seen",{runId:this._run.runId,keys:[e]}).catch(()=>{}),this._renderBrowser()};if(!r){s();return}this._claimingUnlock=!0,this._postJson("/prologue-gift",{runId:this._run.runId}).then(o=>{o&&o.ok&&(this._prologueGift="claimed",o.wallet&&(this._wallet=o.wallet)),s()})}_state(){return this._boot!=="ready"?"boot":this._showRuns?"runs":this._bootError&&!this._creatingNew?"unreachable":this._creatingNew||!this._run?"setup":this._bannerReady?!this._artReady&&this._artBlocking?"art":this._hudView==="roster"?this._rosterUnitId?"unit":"roster":this._hudView==="summon"?"summon":this._hudView==="formation"?"formation":this._hudView==="combat"?"combat":this._hudView==="modes"?"modes":this._hudView==="chapters"?"chapters":this._hudView==="farm"?"farm":this._hudView==="inventory"?"inventory":this._hudView==="missions"?"achievements":this._hudView==="shop"?"shop":this._hudView==="settings"?"settings":this._hudView==="events"?"events":this._hudView==="result"&&this._result?"result":this._plan==null?"forge":this._beatState!=="idle"?"beat":this._hudView==="chapter"?"chapter":"hud":"banner"}_onLoaderScreen(e){return Oh.has(e)?!0:e==="beat"?this._beatState!=="ready":e==="combat"?this._combatPhase==="loading":!1}_chapterLabel(){return`Chapter ${we(this._planChapter)} \xB7 ${this._plan&&this._plan.title||"Story"}`}_walletKey(){let e=this._wallet;return e?[e.aether,e.funds,e.vigor,e.vigorMax].join(","):""}_decorKey(){let e=this._run&&this._run.decor||null;return e?JSON.stringify(e):""}_pickKey(){return this._pick?[this._pick.slot,this._pick.source,this._pick.mode||"default",this._pickRev].join("/"):""}_narrationScale(){let e=this._run||{};return Ze(e.narrationScale==null?e.textScale:e.narrationScale)}_syncTypeScale(){let e=Je(this._run&&this._run.textScale),a=this._narrationScale();this._typeScale===e&&this._narrScale===a||(this._typeScale=e,this._narrScale=a,this.style&&typeof this.style.setProperty=="function"&&(this.style.setProperty("--gf-type-scale",String(e)),this.style.setProperty("--gf-narr-scale",String(a))))}async _setTextScale(e){if(!this._run)return;let a=Je(e),r=this._run.textScale;if(Je(r)===a)return;this._run.textScale=a,this._renderBrowser();let s=await this._postJson("/run/text-scale",{runId:this._run.runId,textScale:a});(!s||!s.ok)&&(this._run.textScale=r,this._renderBrowser())}async _setNarrationScale(e){if(!this._run)return;let a=Ze(e),r=this._run.narrationScale;if(Ze(r)===a)return;this._run.narrationScale=a,this._renderBrowser();let s=await this._postJson("/run/narration-scale",{runId:this._run.runId,narrationScale:a});(!s||!s.ok)&&(this._run.narrationScale=r,this._renderBrowser())}_renderBrowser(){this._syncTypeScale();let e=this._state();this._persistNav();let a=e==="hud"&&this._hudView==="home";a&&!this._wasHome&&this._boot==="ready"&&this._refreshStepData(),this._wasHome=a;let r=e==="runs"?`runs:${this._runsRev}:${this._activeRunId}`:e==="setup"?`setup:${this._creatingNew?"new":"first"}`:e==="banner"?`banner:${this._bannerState==="error"?"error":"loading"}:${this._forge.done}/${this._forge.total}:${this._forge.name}`:e==="art"?`art:${this._artState}:${this._art.done}/${this._art.total}:${this._art.name}`:e==="forge"?`forge:${this._planState==="error"?"error":"loading"}`:e==="beat"?`beat:${this._beatState}:${this._activeStoryNode?this._activeStoryNode.nodeIndex:0}:${this._activeStoryNode&&this._activeStoryNode.replay?"re":""}:${this._beatArt?`${this._beatArt.done}/${this._beatArt.total}:${this._beatArt.name}`:""}`:e==="modes"?`modes:${this._planChapter}:${this._homeNodesDone()}`:e==="chapters"?"chapters":e==="roster"?`roster:${this._rosterState}:${this._rosterCat}:${this._rosterRarity}:${this._rosterQuery}:${this._rosterRev}`:e==="summon"?`summon:${this._summonPhase}:${this._summonBannerId}:${this._summonBannerState}:${this._summonDetails?"d":""}:${this._summonHistoryOpen?"h":""}:${this._summonHistoryState}:${this._summonHistoryPage}:${this._summonHistory&&this._summonHistory.total||0}:${this._summonArting?"a":""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.title||""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.art||""}`:e==="formation"?`formation:${this._formationState}:${this._formationBattleMode?"battle":"hud"}`:e==="combat"?`combat:${this._combatPhase}:${this._combatNode?this._combatNode.combatIndex:0}:${this._combatNonce||0}:${this._combatVigorError?"nv":""}`:e==="unit"?`unit:${this._rosterUnitId}:${this._unitState}:${this._unitTab}:${this._growthRev}:${this._gearSlot||""}:${this._gearFeed?this._gearFeed.picked.join(",")+":"+this._relicsRev:""}:${this._portraitOpen?"pt":""}${this._portraitCrop?":crop":""}:${this._portraitRev}:${this._portraitBusy?"busy":""}:${this._portraitError?"err":""}${this._unitTab==="outfits"?`:of${this._outfitAt}${this._outfitBusy?":busy":""}${this._outfitEditing?":ed":""}`:""}:w${this._unit&&this._unit.wornOutfit||""}`:e==="chapter"?`chapter:${this._planChapter}:${this._difficulty}:${this._chapterProgress[this._difficulty]}:${this._nodePay?"pay":""}:${this._storyNotice}`:e==="farm"?`farm:${this._farmView}:${this._farmState}:${this._farmRev}`:e==="result"?`result:${this._resultRev}`:e==="settings"?`set:${this._settingsCategory}:${this._run.hudStyle||""}:${this._contextTokens}:${this._warnTokens}:${this._settingsRev}`:e==="events"?`ev:${this._eventId}:${this._passTab}:${this._eventsRev}:${JSON.stringify(this._eventAlerts||{})}`:e==="achievements"?`ach:${this._achCat}:${this._achRev}`:e==="shop"?`shop:${this._shopCat}:${this._wallet&&this._wallet.glimmer||0}:${this._shopRev}:${JSON.stringify(this._unlocks&&this._unlocks.outfits||null)}:${this._outfits.length}:${this._outfits.filter(c=>c.owned).length}`:e==="inventory"?`inv:${this._invSection}:${this._inventoryState}:${this._invRev}:${this._invView.slot}:${this._invView.rarity}:${this._invView.picked}:${this._invView.feeding?this._invView.feeding.targetId+","+this._invView.feeding.picked.join("|"):""}`:e==="hud"?`hud:${this._planChapter}:${this._plan&&this._plan.title||""}:${this._homeNodesDone()}:${this._run.hudStyle||""}:${this._decorKey()}:${this._pickKey()}:${this._loginOpen?"ev"+this._eventsRev:""}:${this._contextTokens}/${this._warnTokens}:${JSON.stringify(this._alerts||{})}:${JSON.stringify(this._unlockNews||[])}:${JSON.stringify(this._unlocks||{})}:${this._prologueGift||""}:${JSON.stringify(this._nextStepCtx||{})}`:e,s=this._onLoaderScreen(e)?[]:this._busyTasks(),o=r+"|ts:"+(this._typeScale||1)+"|ns:"+(this._narrScale||1)+"|vm:"+(this._vigorMenu?"1":"0")+"|rl:"+(this._eventRelic?"1":"0")+"|busy:"+Bi(s);if(this._syncBar(),at(this._root,this._contextTokens,this._warnTokens),this._drawnView==="browser"&&this._renderKey===o)return;let i=this._lastScreen!==e;this._entering=i;let n=!i&&this._drawnView==="browser";this._lastScreen=e,this._drawnView="browser",this._renderKey=o,this._stopForge(),this._stopBeat(),this._stopSummon(),this._stopCombat();let l="";if(e==="boot")l=`<style>${yn}</style><div class="gf-boot">Loading</div>`;else if(e==="unreachable"){let c=String(this._bootError||"").replace(/[&<>"]/g,y=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[y]);l=`<style>${yn}</style><div class="gf-boot gf-boot-bad"><span>Couldn&rsquo;t reach the game server &mdash; ${c}</span><button type="button" data-boot-retry>Retry</button></div>`}else if(e==="runs")l=`<style>${hn}</style>${pn({runs:this._runs,activeRunId:this._activeRunId})}`;else if(e==="setup")l=`<style>${ds}</style>${ps({cancelable:this._creatingNew})}`;else if(e==="banner")l=`<style>${gt}</style>${Vt({scenario:this._run.scenario,mode:"banner",error:this._bannerState==="error",progress:this._forge,cancel:!0,confirming:this._forgeCancelAsking})}`;else if(e==="art")l=`<style>${gt}</style>${Vt({scenario:this._run.scenario,mode:"art",error:this._artState==="blocked",progress:this._art,cancel:!0,confirming:this._forgeCancelAsking})}`;else if(e==="roster")l=`<style>${Ga}</style>${To({cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,state:this._rosterState,q:this._rosterQuery})}`;else if(e==="unit")this._portraitOpen?l=`<style>${Lo}</style>${Mo({unit:this._unit,view:this._portraitCrop?"crop":"edit",draft:this._portraitDraft,history:this._portrait&&this._portrait.strip||[],historyMax:this._portrait&&this._portrait.historyMax||0,busy:this._portraitBusy,error:this._portraitError,crop:this._portraitCrop,promptName:this._portrait&&this._portrait.promptName||""})}`:l=`<style>${Ga}</style>${Io({unit:this._unit,level:this._unit?this._unitLevel:1,bond:this._unit?this._unitBond:0,tab:this._unitTab,state:this._unitState,growth:this._growthView(),gear:this._growth&&this._growth.gear,gearSlot:this._gearSlot,gearFeed:this._gearFeedView(),facets:this._growth&&this._growth.facets,outfitAt:this._outfitAt,outfitBusy:this._outfitBusy,outfitEditing:this._outfitEditing,outfitHistoryMax:this._outfitHistoryMax})}`;else if(e==="summon")if(this._summonPhase==="reveal")l=`<style>${gr}</style>${$i({results:this._summonResults||[]})}`;else{let c=this._summonBanner;l=`<style>${gr}</style>${qi({banners:c&&c.banners||[],banner:c&&c.banner,rates:c&&c.rates,pity:c&&c.pity,wallet:c&&c.wallet||this._wallet,cost:c&&c.cost||ca,bannerId:this._summonBannerId,state:this._summonBannerState,details:this._summonDetails,history:this._summonHistoryOpen?{state:this._summonHistoryState,...this._summonHistory||{}}:null,arting:this._summonArting})}`}else if(e==="formation")l=`<style>${Gi}</style>${an({state:this._formationState==="ready"?"ready":this._formationState==="error"?"error":"loading",data:this._formation,battleMode:this._formationBattleMode})}`;else if(e==="combat")l=`<style>${nn}</style>${ln({phase:this._combatPhase,payload:this._combat,node:this._combatNode,vigor:this._vigorView(),error:this._combatError||""})}`;else if(e==="forge")l=`<style>${gt}</style>${Vt({scenario:this._run.scenario,chapter:this._planChapter,error:this._planState==="error",cancel:this._prologue,confirming:this._forgeCancelAsking})}`;else if(e==="beat")l=this._beatState==="ready"?`<style>${vn}</style>${mn({chapterLabel:this._chapterLabel(),nodeTitle:this._activeStoryNode&&this._activeStoryNode.title,segments:this._beat,cast:this._beatCast||[],background:this._nodeBackground(),places:this._beatPlaces,replay:!!(this._activeStoryNode&&this._activeStoryNode.replay),prologue:!!(this._activeStoryNode&&this._activeStoryNode.prologue)})}`:`<style>${gt}</style>${Is({chapterTitle:this._plan&&this._plan.title,error:this._beatState==="error",prologue:!!(this._activeStoryNode&&this._activeStoryNode.prologue),art:this._beatArt,cancel:this._prologue,confirming:this._forgeCancelAsking})}`;else if(e==="modes"){let c=this._plan;l=`<style>${Bo}</style>${zo({story:{hasPlan:!!c,title:c?c.title:"",premise:c?c.premise:"",chapterLabel:`Chapter ${this._planChapter}`,done:this._homeNodesDone(),total:10}})}`}else e==="farm"?l=`<style>${Ho}</style>${Do({view:this._farmView,data:this._farm,state:this._farmState})}`:e==="result"?l=`<style>${Ci}</style>${Ri(this._result||{})}`:e==="inventory"?l=`<style>${Vo}</style>${Yo({section:this._invSection,data:this._inventory,view:this._invView,state:this._inventoryState})}`:e==="events"?l=`<style>${di}</style>${mi({eventId:this._eventId,view:this._eventId==="pass"?this._passViewOut():this._loginViewOut(),seasonal:this._seasonalViewOut(),newWorld:this._newWorldViewOut(),slots:this._eventSlots,from:"Home",passTab:this._passTab,alerts:this._eventAlerts})}`:e==="shop"?l=`<style>${Ai}</style>${Ei({wallet:this._wallet,cat:this._shopCat,from:"Home",outfits:this._outfits,locks:this._unlocks})}`:e==="achievements"?l=`<style>${ki}</style>${wi({view:this._achievements,cat:this._achCat,from:"Home"})}`:e==="settings"?l=`<style>${Ss}</style>${xs({category:this._settingsCategory,backLabel:this._settingsBackLabel(),contextTokens:this._contextTokens,warnTokens:this._warnTokens,hudStyle:this._run.hudStyle,textScale:this._run.textScale,narrationScale:this._narrationScale(),tokenLog:this._tokenLog,loreStatus:this._loreStatus,run:this._run,helpOpen:this._helpOpen})}`:e==="chapters"?l=`<style>${Ls}</style>${Ms()}`:e==="chapter"?l=`<style>${Wr}</style>${Vr({plan:this._plan,difficulty:this._difficulty,progress:this._chapterProgress,chapterNumber:this._planChapter,pay:this._nodePay&&this._nodePay[this._difficulty],cp:this._chapterCp,notice:this._storyNotice})}`:l=`<style>${Sr}</style>${es({plan:this._plan,chapterNumber:this._planChapter,nodesDone:this._homeNodesDone(),decor:this._run.decor,pick:this._pick,pickOptions:this._pickOptions,contextTokens:this._contextTokens,warnTokens:this._warnTokens,alerts:this._alerts,locks:this._unlocks,step:ti(this._nextStepCtx)})}`+(this._loginOpen?`<style>${li}</style>${gi({view:this._loginViewOut()})}`:"");let d=e==="combat"&&this._combatPhase!=="prebattle",h=!!this._run&&!d&&Nr.has(e),f=h?Rr({username:this._run.username,wallet:this._wallet,account:this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:null}):"",m=h&&this._vigorMenu?Cr({vigor:Number(this._wallet&&this._wallet.vigor||0),vigorMax:Number(this._wallet&&this._wallet.vigorMax||60),items:la.filter(c=>c.grants&&c.grants.vigor).map(c=>({id:c.id,name:c.name,vigor:c.grants.vigor,held:Number(this._wallet&&this._wallet.keyItems&&this._wallet.keyItems[c.id]||0)}))}):"",v=this._run&&this._state()==="hud"?rs(this._currentUnlockNews()):"",b=this._seasonalHelp&&e==="events"&&this._eventId==="seasonal"?cr():"",w=this._eventRelic?pi(this._eventRelic):"";this._root.innerHTML=`<style>${Pr}${zi}${qr}${as}${ci}${lt}</style>`+Dr(l+Fi(s),{runs:!!this._run&&e!=="runs",style:this._run&&this._run.hudStyle,entering:i,swapping:n,bar:f,overlay:m+b+v+w,help:this._helpOpen,onScreen:e==="settings"?this._settingsCategory:""}),h&&Br(this._root),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null),h&&(this._stopVigorClock=Or(this._root,{nextMs:this._wallet?this._wallet.vigorNextMs:null,periodMs:this._wallet&&this._wallet.vigorPerMs||this._run&&this._run.vigorPerMs,onLanded:()=>this._refreshState&&this._refreshState()})),ks(this._root,{open:e==="settings",category:this._settingsCategory,run:this._run,onOpen:c=>this._openSettings(c),onBack:()=>this._leaveSettings(),onCategory:c=>this._openSettings(c),onStyle:c=>this._setHudStyle(c),onTextScale:c=>this._setTextScale(c),onNarrationScale:c=>this._setNarrationScale(c),onWarnTokens:c=>this._setWarnTokens(c),onSources:c=>this._setSources(c)}),Hr(this._root,{onToggle:(c,y)=>{y?this._helpOpen.add(c):this._helpOpen.delete(c)}}),ss(this._root,{onOk:c=>this._closeUnlockNews(c)}),fi(this._root,{onClose:()=>{this._eventRelic=null,this._eventsRev+=1,this._renderBrowser()}}),Lr(this._root,{onToggle:()=>{this._vigorMenu=!this._vigorMenu,this._renderBrowser()},onClose:()=>{this._vigorMenu=!1,this._renderBrowser()},onUse:c=>this._useItem(c)}),this._wireFullscreen(),this._wireRunsButton();{let c=this._root.querySelector("[data-boot-retry]");c&&c.addEventListener("click",()=>{this._boot="idle",this._loadState(),this._renderBrowser()})}if(e==="runs")this._wireRuns();else if(e==="setup")us(this._root,{onCreate:c=>this._createRun(c),onCancel:()=>{this._creatingNew=!1,this._renderBrowser()}});else if(e==="banner"){let c=this._bannerState==="error";this._forgeCleanup=rt(this._root,{cycle:!1,phases:Ca,onRetry:()=>this._loadStandardBanner(),...this._forgeCancelWiring()}),this._bannerState==="idle"&&this._loadStandardBanner()}else if(e==="art")this._forgeCleanup=rt(this._root,{cycle:!1,onRetry:()=>this._finishArt(),...this._forgeCancelWiring()}),this._ensureArtRunning();else if(e==="roster")Co(this._root,{onOpenUnit:c=>this._openUnit(c),onBack:()=>{this._hudView="home",this._renderBrowser()},onCat:c=>{this._rosterCat=c==="wpn"?"wpn":"char",this._renderBrowser()},onRarity:c=>{this._rosterRarity=c,this._renderBrowser()},onSearch:c=>{this._rosterQuery=c,Eo(this._root,{cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,q:c,state:this._rosterState})}}),this._rosterState==="idle"&&this._loadRoster();else if(e==="unit"&&this._portraitOpen)Oo(this._root,{onBack:()=>this._portraitClose(),onDraft:c=>this._portraitEdit(c),onGenerate:()=>this._portraitGenerate(),onPick:c=>this._portraitPick(c),onFile:c=>this._portraitFile(c),onCropSize:c=>this._portraitSize(c),onCropFrame:c=>this._portraitDrag(c),onCropOk:()=>this._portraitUpload(),onCropCancel:()=>{this._portraitCrop=null,this._renderBrowser()}});else if(e==="unit")wo(this._root,{onStep:c=>this._stepOutfit(c),onWear:c=>this._wearOutfit(c),onEdit:()=>{this._outfitEditing=!this._outfitEditing,this._renderBrowser()},onRedo:c=>this._redoOutfit(c),onRestore:c=>this._restoreOutfit(c)}),Ro(this._root,{onTab:c=>{this._unitTab=c,c==="outfits"&&(this._outfitAt=it(this._unit).at),this._renderBrowser()},onFeed:c=>this._feedAdd(c),onFeedReset:()=>this._feedReset(),onFeedGo:()=>this._feedCommit(),onAscend:()=>this._ascend(),onFormUp:c=>this._formUp(c),onBack:()=>{this._rosterUnitId=null,this._unit=null,this._unitState="idle",this._gearSlot=null,this._loadRoster()},onSetParty:()=>this._openFormation(),onPortrait:()=>this._portraitOpenStudio(),onGearSlot:c=>{this._gearSlot=c,this._renderBrowser()},onGearBack:()=>{this._gearSlot=null,this._gearFeed=null,this._renderBrowser()},onEquip:c=>this._equip(c),onOpenWeapon:c=>this._openUnit(c,"growth"),onRelicFeed:c=>this._relicFeed(c)}),this._unitState==="idle"&&this._loadUnit();else if(e==="summon")this._summonPhase==="reveal"?this._summonCleanup=Ui(this._root,{results:this._summonResults||[],onContinue:()=>{this._summonPhase="banner",this._renderBrowser()}}):(ji(this._root,{banners:this._summonBanner&&this._summonBanner.banners||[],onBanner:c=>{c!==this._summonBannerId&&(this._summonBannerId=c,this._summonDetails=!1,this._summonArting=!1,this._summonBannerState="idle",this._summonBanner=null,this._closeSummonHistory(),this._renderBrowser())},onDetails:c=>{this._summonDetails=!!c,c&&this._closeSummonHistory(),this._renderBrowser()},onHistory:c=>{if(!c){this._closeSummonHistory(),this._renderBrowser();return}this._summonDetails=!1,this._summonHistoryOpen=!0,this._loadSummonHistory(1)},onHistoryPage:c=>this._loadSummonHistory(c),onRedoArt:()=>this._redoBannerArt(),onPull:c=>this._summonPull(c),onBack:()=>{this._hudView="home",this._renderBrowser()}}),this._summonBannerState==="idle"&&this._loadSummonBanner());else if(e==="formation")rn(this._root,{data:this._formationState==="ready"?this._formation:null,onSave:(c,y)=>this._saveFormation(c,y),onBack:()=>{if(this._formationBattleMode){let c=!!(this._pendingCombat&&this._pendingCombat.farm),y=!!(this._pendingCombat&&this._pendingCombat.stage==="seasonal");this._formationBattleMode=!1,this._pendingCombat=null,c?(this._farmBusy=!1,this._pendingFarm=null,this._hudView=y?"events":"farm"):this._hudView="chapter"}else this._hudView="home";this._renderBrowser()},onIntoBattle:()=>this._enterBattle(),onRetry:()=>this._loadFormation()}),this._formationState==="idle"&&this._loadFormation();else if(e==="combat")this._combatCleanup=cn(this._root,{phase:this._combatPhase,steps:this._combatSteps||[],onStart:()=>this._startBattle(),onPickPreset:c=>this._pickCombatPreset(c),onRetry:()=>this._loadBattle(),onBack:()=>this._exitCombat(!1),onFinished:c=>this._combatFinished(c)}),this._combatPhase==="loading"&&this._loadBattle();else if(e==="forge"){let c=this._planState==="error";this._forgeCleanup=rt(this._root,{cycle:!c,onRetry:()=>this._loadChapterPlan(),...this._forgeCancelWiring()}),this._planState==="idle"&&this._loadChapterPlan()}else e==="beat"?this._beatState==="loading"?(this._forgeCleanup=rt(this._root,{cycle:!1,...this._forgeCancelWiring()}),this._beatRequested||(this._beatRequested=!0,this._loadBeat())):this._beatState==="error"?this._forgeCleanup=rt(this._root,{cycle:!1,onRetry:()=>this._retryBeat(),...this._forgeCancelWiring()}):this._beatCleanup=gn(this._root,{segments:this._beat,cast:this._beatCast||[],places:this._beatPlaces,background:this._nodeBackground(),onContinue:()=>this._activeStoryNode&&this._activeStoryNode.replay?this._exitStoryBeat():this._completeStoryBeat(),onExit:()=>this._exitStoryBeat()}):e==="modes"?Fo(this._root,{onPick:c=>{if(c==="materials"){this._openFarm();return}c==="story"&&(this._hudView="chapters",this._renderBrowser())},onBack:()=>{this._hudView="home",this._renderBrowser()}}):e==="farm"?(qo(this._root,{onBack:()=>{if(this._farmView!=="root"){this._farmView="root",this._renderBrowser();return}this._hudView="modes",this._renderBrowser()},onOpen:c=>{this._farmView=c==="form"?"form":"asc",this._renderBrowser()},onRun:c=>this._farmRun(c)}),this._farmState==="idle"&&this._loadFarm()):e==="result"?Li(this._root,{onContinue:()=>this._closeResult(),onAgain:()=>this._resultAgain()}):e==="inventory"?(Ko(this._root,{onBack:()=>{if(this._invView.feeding){this._invView.feeding=null,this._renderBrowser();return}this._hudView="home",this._renderBrowser()},onSection:c=>{this._invSection!==c&&(this._invSection=c,this._invView={...this._invView,feeding:null,gained:[]},this._renderBrowser())},onFilter:(c,y)=>{this._invView={...this._invView,[c]:y},this._renderBrowser()},onPick:c=>{this._invView={...this._invView,picked:c,gained:[]},this._renderBrowser()},onLock:c=>this._relicLock(c),onUpgrade:c=>{this._invView={...this._invView,picked:c,gained:[],feeding:{targetId:c,picked:[]}},this._renderBrowser()},onFeedPick:c=>{let y=this._invView.feeding;if(!y)return;let T=y.picked.indexOf(c)>=0?y.picked.filter(R=>R!==c):y.picked.concat([c]);this._invView={...this._invView,feeding:{...y,picked:T}},this._renderBrowser()},onFeedGo:()=>this._relicFeedFromInventory(),onFeedCancel:()=>{this._invView={...this._invView,feeding:null},this._renderBrowser()},onUseItem:c=>this._useItem(c)}),this._inventoryState==="idle"&&this._loadInventory()):e==="events"?(bi(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},onPick:c=>{this._eventId!==c&&(this._eventId=c,this._eventGained=null,this._eventRelic=null,this._seasonalGained=null,this._seasonalHelp=!1,this._newWorldGained=null,this._eventsRev+=1,this._renderBrowser())},onClaim:()=>this._eventId==="pass"?this._claimPass():this._claimLogin(),onTab:c=>{this._passTab!==c&&(this._passTab=c,this._renderBrowser())},onReroll:c=>this._rerollMission(c),onSeasonalFight:c=>this._seasonalRun(c),onSeasonalDraw:()=>this._seasonalDraw(),onNewWorldClaim:()=>this._claimNewWorld(),onSeasonalHelp:()=>{this._seasonalHelp=!this._seasonalHelp,this._eventsRev+=1,this._renderBrowser()}}),this._entering&&this._refreshState()):e==="shop"?(Ti(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},onPick:c=>{this._shopCat!==c&&(this._shopCat=c,this._renderBrowser())},onBuy:c=>this._buyShop(c),onBuyOutfit:c=>this._buyOutfit(c)}),this._entering&&this._refreshState()):e==="achievements"?(xi(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},onPick:c=>{this._achCat!==c&&(this._achCat=c,this._renderBrowser())},onClaim:c=>this._claimAchievement(c),onClaimAll:()=>this._claimAchievement(null)}),this._entering&&this._refreshState()):e==="chapters"?this._wireChapters():e==="chapter"?this._wireChapter():e==="hud"&&(ts(this._root,{onOpenModes:()=>{this._hudView="modes",this._renderBrowser()},onOpenRoster:()=>this._openRoster(),onOpenSummon:()=>this._openSummon(),onOpenFormation:()=>this._openFormation(),onOpenInventory:()=>this._openInventory(),onOpenShop:()=>{this._hudView="shop",this._renderBrowser()},onOpenMissions:()=>{this._hudView="missions",this._renderBrowser()},onOpenEvents:()=>{this._hudView="events",this._renderBrowser()},onPickOpen:c=>this._openPick(c),onPickClose:()=>this._closePick(),onPickSource:c=>this._pickSource(c),onPickTake:c=>this._takePick(c),onPickMode:c=>this._pickMode(c)}),this._loginOpen&&yi(this._root,{onClose:()=>{this._loginOpen=!1,this._loginSeen=!0,this._renderBrowser()},onClaim:()=>this._claimLogin()}));e==="settings"&&this._settingsCategory==="continuity"&&this._continuity&&this._fillContinuity(),this._boot==="idle"&&this._loadState(),this._ensureArtRunning()}async _setHudStyle(e){if(!this._run||!this._run.runId)return;let a=this._run.hudStyle;this._run.hudStyle=e,this._renderBrowser();let r=await this._postJson("/run/style",{runId:this._run.runId,hudStyle:e});r&&r.ok||(this._run.hudStyle=a,this._renderBrowser())}_homeNodesDone(){let a=(this._run&&this._run.progress||{})[String(this._planChapter)]||{};return Number(a.normal)||0}_wireFullscreen(){let e=()=>{document.fullscreenElement?document.exitFullscreen?.():this.requestFullscreen?.()};for(let a of[".gf-fs",".gf-fs-exit",".gf-fs-bar"]){let r=this._root.querySelector(a);r&&r.addEventListener("click",e)}this._wireLandscape()}_wireLandscape(){let e=this._root.querySelector("[data-go-landscape]");e&&e.addEventListener("click",async()=>{try{!document.fullscreenElement&&this.requestFullscreen&&await this.requestFullscreen()}catch{}let a=typeof screen<"u"?screen.orientation:null;if(!a||typeof a.lock!="function"){this._landscapeFallback();return}try{await a.lock("landscape")}catch{this._landscapeFallback()}})}_landscapeFallback(){let e=this._root.querySelector("[data-rot-title]"),a=this._root.querySelector("[data-rot-note]");e&&(e.textContent="Turn your phone"),a&&(a.textContent="This game plays in a 16:9 landscape frame. Your browser cannot rotate it for you.")}_wireRunsButton(){let e=[];for(let a of["[data-open-runs]",".gf-runs-bar"]){let r=this._root.querySelector(a);!r||e.indexOf(r)>=0||(e.push(r),r.addEventListener("click",()=>{this._showRuns=!0,this._renderBrowser(),this._refreshState()}))}}_adoptRun(e){this._stopSummon(),this._stopCombat();let a={_boot:this._boot,_bootError:this._bootError,_runs:this._runs,_activeRunId:this._activeRunId,_busyLocal:this._busyLocal,_busySeq:this._busySeq};this._initState(),Object.assign(this,a),this._run=e||null,this._activeRunId=e?e.runId:null,this._creatingNew=!1,this._planChapter=1,this._hudView="home",this._bannerReady=!!(e&&e.hasStandardBanner),this._artReady=!(e&&Number(e.artPending)>0),this._prologue=!!(e&&e.prologuePending),this._adoptUnlocks(e),this._wallet=e&&e.wallet||null,this._outfits=e&&Array.isArray(e.outfits)?e.outfits:[],this._rosterCount=e&&Number(e.rosterCount)||0,this._warnTokens=e&&Number(e.warnTokens)||3e4}_adoptRuns(e){let a=Array.isArray(e)?e:[],r=JSON.stringify(a.map(s=>[s.runId,s.name,s.scenario,s.progress]));if(r===this._runsKey){this._runs=a;return}this._runsKey=r,this._runs=a,this._runsRev+=1}_adoptGlobals(e){if(!e)return;e.nodePay&&(this._nodePay=e.nodePay);let a=e.achievements||e.activeRun&&e.activeRun.achievements||null;if(a){let h=JSON.stringify(a);h!==this._achKey&&(this._achKey=h,this._achievements=a,this._achRev+=1)}let r=e.alerts||e.activeRun&&e.activeRun.alerts||null;r&&(this._alerts=r);let s=e.nextStepCtx!==void 0?e.nextStepCtx:e.activeRun?e.activeRun.nextStepCtx:void 0;s!==void 0&&(this._nextStepCtx=s);let i=e.events||e.activeRun&&e.activeRun.events||(e.pass||e.seasonal||e.newworld?{pass:e.pass,seasonal:e.seasonal,newworld:e.newworld}:null);if(!i)return;if(i.alerts&&(this._eventAlerts=i.alerts),i.pass){let h=JSON.stringify(i.pass);h!==this._passKey&&(this._passKey=h,this._pass=i.pass,this._eventsRev+=1)}if(i.seasonal){let h=JSON.stringify(i.seasonal);h!==this._seasonalKey&&(this._seasonalKey=h,this._seasonal=i.seasonal,this._eventsRev+=1)}if(Array.isArray(i.slots)&&i.slots.length){let h=JSON.stringify(i.slots);h!==this._eventSlotsKey&&(this._eventSlotsKey=h,this._eventSlots=i.slots,this._eventsRev+=1)}if(i.newworld){let h=JSON.stringify(i.newworld);h!==this._newWorldKey&&(this._newWorldKey=h,this._newWorld=i.newworld,this._eventsRev+=1)}if(!i.login)return;let n=JSON.stringify(i.login);if(n===this._loginKey)return;this._loginKey=n,this._login=i.login,this._eventsRev+=1;let l=e.activeRun&&e.activeRun.unlocks?e.activeRun.unlocks.events:e.unlocks?e.unlocks.events:void 0,d=l!==void 0?!!l:!!this._lockOf("events");this._login.ready&&!this._loginSeen&&!d&&(this._loginOpen=!0)}_loginViewOut(){return this._login?this._eventGained?{...this._login,gained:this._eventGained}:this._login:null}_passViewOut(){return this._pass?this._eventGained?{...this._pass,gained:this._eventGained}:this._pass:null}_seasonalViewOut(){if(!this._seasonal)return null;let e=this._seasonalGained?{...this._seasonal,gained:this._seasonalGained}:this._seasonal;return this._seasonalHelp?{...e,help:!0}:e}_claimPass(){this._claimingLogin||(this._claimingLogin=!0,this._postJson("/pass/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._eventGained=Array.isArray(e.gained)?e.gained:null,this._eventRelic=e.relic||null,this._eventsRev+=1)}).catch(()=>{}).then(()=>{this._claimingLogin=!1,this._renderBrowser()}))}_claimAchievement(e){if(this._claimingAch)return;this._claimingAch=!0;let a={runId:this._activeRunId};e&&(a.stepId=e),this._postJson("/achievements/claim",a).catch(()=>{}).then(()=>{this._claimingAch=!1,this._renderBrowser()})}_useItem(e){!e||this._usingItem||(this._usingItem=!0,this._postJson("/item/use",{runId:this._activeRunId,itemId:e}).then(a=>{a&&a.ok&&(this._vigorMenu=!1,this._invRev+=1,this._shopRev+=1)}).catch(()=>{}).then(()=>{this._usingItem=!1,this._renderBrowser(),this._loadInventory()}))}_buyShop(e){!e||this._buying||(this._buying=!0,this._postJson("/shop/buy",{runId:this._activeRunId,itemId:e}).then(a=>{a&&a.ok&&(this._shopRev+=1)}).catch(()=>{}).then(()=>{this._buying=!1,this._renderBrowser()}))}_buyOutfit(e){!e||this._buying||(this._buying=!0,this._postJson("/shop/buy-outfit",{runId:this._activeRunId,outfitId:e}).then(a=>{a&&a.ok&&(a.wallet&&(this._wallet=a.wallet),Array.isArray(a.outfits)&&(this._outfits=a.outfits),this._shopRev+=1)}).catch(()=>{}).then(()=>{this._buying=!1,this._renderBrowser()}))}_stepOutfit(e){let a=it(this._unit).slots.length;a<2||(this._outfitAt=(this._outfitAt+e+a)%a,this._outfitEditing=!1,this._renderBrowser())}_wearOutfit(e){this._outfitBusy||!this._rosterUnitId||(this._outfitBusy=!0,this._renderBrowser(),this._postJson("/outfit/wear",{runId:this._activeRunId,unitId:this._rosterUnitId,outfitId:e||""}).then(a=>{a&&a.ok&&this._unit&&(this._unit={...this._unit,wornOutfit:a.wornOutfit||""},this._refreshState())}).catch(()=>{}).then(()=>{this._outfitBusy=!1,this._renderBrowser()}))}_redoOutfit(e){let r=it(this._unit).slots[this._outfitAt];!r||r.base||this._outfitBusy||!this._rosterUnitId||(this._outfitBusy=!0,this._renderBrowser(),this._postJson("/outfit/redo",{runId:this._activeRunId,unitId:this._rosterUnitId,outfitId:r.id,prompt:e&&e.prompt||"",tags:e&&e.tags||[]}).then(s=>this._adoptOutfits(s)).catch(()=>{}).then(()=>{this._outfitBusy=!1,this._renderBrowser()}))}_restoreOutfit(e){let r=it(this._unit).slots[this._outfitAt];!r||r.base||!e||this._outfitBusy||!this._rosterUnitId||(this._outfitBusy=!0,this._renderBrowser(),this._postJson("/outfit/restore",{runId:this._activeRunId,unitId:this._rosterUnitId,outfitId:r.id,url:e}).then(s=>this._adoptOutfits(s)).catch(()=>{}).then(()=>{this._outfitBusy=!1,this._renderBrowser()}))}_adoptOutfits(e){!e||!this._unit||(Array.isArray(e.outfits)&&(this._unit={...this._unit,outfits:e.outfits}),Number(e.historyMax)>0&&(this._outfitHistoryMax=Number(e.historyMax)),e.ok&&this._refreshState())}_rerollMission(e){!e||this._rerolling||(this._rerolling=!0,this._postJson("/pass/reroll",{runId:this._activeRunId,missionId:e}).then(()=>{this._eventsRev+=1}).catch(()=>{}).then(()=>{this._rerolling=!1,this._renderBrowser()}))}_claimLogin(){this._claimingLogin||(this._claimingLogin=!0,this._postJson("/events/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._eventGained=Array.isArray(e.gained)?e.gained:null,this._eventRelic=e.relic||null,this._eventsRev+=1)}).catch(()=>{}).then(()=>{this._claimingLogin=!1,this._renderBrowser()}))}_loadState(){this._boot="loading",this._bootError="",ve(`${ya}/state`).then(e=>{if(!e)throw new Error("no response");if(!e.ok)throw new Error("HTTP "+e.status);return typeof e.json=="function"?e.json():null}).then(e=>{this._adoptRuns(e&&e.runs),this._activeRunId=e&&e.activeRunId||null,this._run=e&&e.activeRun||null,this._adoptGlobals(e),this._run&&Number.isFinite(Number(this._run.contextTokens))&&(this._contextTokens=Number(this._run.contextTokens)||0),this._warnTokens=this._run&&Number(this._run.warnTokens)||3e4,this._bannerReady=!!(this._run&&this._run.hasStandardBanner),this._artReady=!(this._run&&Number(this._run.artPending)>0),this._prologue=!!(this._run&&this._run.prologuePending),this._adoptUnlocks(this._run),this._wallet=this._run&&this._run.wallet||null,this._run&&Array.isArray(this._run.outfits)&&(this._outfits=this._run.outfits),this._rosterCount=this._run&&Number(this._run.rosterCount)||0}).catch(e=>{this._run=null,this._bootError=String(e&&e.message||"unreachable")}).then(()=>{this._run&&(this._restoreNav(),this._reconcileGenerating({boot:!0})),this._boot="ready",this._renderBrowser()})}_navKey(){return`gacha-forge:nav:${this._run?this._run.runId:"none"}`}_persistNav(){if(!(!this._run||this._boot!=="ready"))try{if(typeof localStorage>"u")return;localStorage.setItem(this._navKey(),JSON.stringify({v:this._hudView,ch:this._planChapter,combat:this._combatNode}))}catch{}}_restoreNav(){let e=null;try{if(typeof localStorage>"u")return;let a=localStorage.getItem(this._navKey());a&&(e=JSON.parse(a))}catch{return}!e||typeof e!="object"||(Number.isInteger(e.ch)&&e.ch>=1&&(this._planChapter=e.ch),["chapters","chapter","roster","summon","formation","inventory","settings","events"].includes(e.v)?this._hudView=e.v:e.v==="farm"&&(this._hudView="farm"),e.v==="combat"&&e.combat&&(typeof e.combat.combatIndex=="number"||e.combat.farm)&&(this._combatNode=e.combat,this._hudView="combat",this._combatPhase="loading"))}_resync(){this._renderKey=null,this._bannerState==="loading"&&(this._bannerState="idle"),this._planState==="loading"&&(this._planState="idle"),this._summonBannerState==="loading"&&(this._summonBannerState="idle"),this._formationState==="loading"&&(this._formationState="idle"),this._rosterState==="loading"&&(this._rosterState="idle"),this._farmState==="loading"&&(this._farmState="idle"),this._inventoryState==="loading"&&(this._inventoryState="idle"),this._unitState==="loading"&&(this._unitState="idle"),this._continuityState==="loading"&&(this._continuityState="idle"),this._tokenLog&&this._tokenLog.status==="loading"&&(this._tokenLog={...this._tokenLog,status:"idle"}),this._beatState==="loading"&&(this._beatRequested=!1),this._combatPhase==="loading"&&(this._combatPhase="loading"),this._refreshState()}_refreshStepData(){this._stepRefreshing||(this._stepRefreshing=!0,ve(`${ya}/state`).then(e=>e&&typeof e.json=="function"?e.json():null).then(e=>{!e||!e.activeRun||(this._adoptGlobals(e),this._adoptUnlocks(e.activeRun))}).catch(()=>{}).then(()=>{this._stepRefreshing=!1,this._renderBrowser()}))}_refreshState(){this._refreshing||(this._refreshing=!0,ve(`${ya}/state`).then(e=>e&&typeof e.json=="function"?e.json():null).then(e=>{e&&(Array.isArray(e.runs)&&this._adoptRuns(e.runs),this._activeRunId=e.activeRunId||this._activeRunId,this._adoptGlobals(e),e.activeRun&&(this._run=e.activeRun,this._bannerReady=!!e.activeRun.hasStandardBanner,this._artState==="idle"&&(this._artReady=!(Number(e.activeRun.artPending)>0)),e.activeRun.prologuePending||(this._prologue=!1),this._adoptUnlocks(e.activeRun),this._wallet=e.activeRun.wallet||this._wallet,Array.isArray(e.activeRun.outfits)&&(this._outfits=e.activeRun.outfits),this._rosterCount=Number(e.activeRun.rosterCount)||this._rosterCount))}).catch(()=>{}).then(()=>{this._refreshing=!1,this._renderBrowser()}))}_reconcileGenerating({boot:e=!1}={}){if(!e)return;let a=this._run&&Array.isArray(this._run.generating)?this._run.generating:[];if(!a.length)return;let r=this._run.runId,s=h=>a.find(f=>typeof f=="string"&&f.startsWith(`${r}:${h}`)),o=s("chapter:"),i=s("combat:");if(o||i){let h=Number(o?o.split(":").pop():i.split(":")[2]);if(Number.isInteger(h)&&h>=1){this._planChapter=h,this._plan=null,this._planState="idle",this._hudView=this._hudView==="chapter"?"chapter":"home";return}}let n=s("banner:wpn:"),l=s("banner:char:");if(n||l){this._hudView="summon",this._summonPhase="banner",this._summonBannerId=n?"wpn-featured":"char-featured",this._summonBanner=null,this._summonBannerState="idle";return}let d=s("beat:");if(d){let h=d.split(":"),f=Number(h[2]),m=Number(h[3]);if(Number.isInteger(f)&&f>=1&&Number.isInteger(m)&&m>=0){this._planChapter=f,this._hudView="chapter";let v=this._run.progress&&this._run.progress[String(f)]||{};this._chapterProgress={normal:v.normal||0,hard:v.hard||0,veryhard:v.veryhard||0},this._activeStoryNode={chapter:f,difficulty:this._difficulty,nodeIndex:this._chapterProgress[this._difficulty]||0,storyIndex:m,title:"Story",restored:!0},this._beat=null,this._beatCast=null,this._beatState="loading",this._beatRequested=!1}}}_postJson(e,a){let r=Mi(e),s=r?this._busyStart(r):0;return ve(`${ya}${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}).then(o=>o&&typeof o.json=="function"?o.json():null).catch(()=>null).then(o=>(this._adoptFromResponse(o),s&&this._busyEnd(s),s&&this._run&&Array.isArray(this._run.generating)&&this._run.generating.length&&this._refreshState(),o))}_adoptFromResponse(e){if(!e||typeof e!="object")return;if(this._adoptGlobals(e),e.wallet&&typeof e.wallet=="object"&&(this._wallet={...this._wallet||{},...e.wallet}),e.account&&typeof e.account=="object"&&this._run){let o=this._run.account||null,i=e.account;(!o||o.level!==i.level||o.xp!==i.xp||o.xpNeeded!==i.xpNeeded)&&(this._run={...this._run,account:{...o,...i}})}this._syncBar();let a=typeof e.unitId=="string"?e.unitId:"",r=typeof e.portrait=="string"?e.portrait:"",s=this._run&&this._run.decor;a&&r&&s&&s.unit&&s.unit.id===a&&s.unit.portrait!==r&&(this._run={...this._run,decor:{...s,unit:{...s.unit,portrait:r}}})}_syncBar(){Mr(this._root,{wallet:this._wallet,account:this._run&&this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:void 0})}_busyStart(e){return this._busySeq+=1,this._busyLocal.set(this._busySeq,e),this._renderBrowser(),this._busySeq}_busyEnd(e){this._busyLocal.delete(e)&&this._renderBrowser()}_busyTasks(){return Oi({local:[...this._busyLocal.values()],generating:this._run&&Array.isArray(this._run.generating)?this._run.generating:[],art:this._artState==="painting"?this._art:null})}async _createRun(e){let a=await this._postJson("/run",e);if(!(a&&a.ok&&a.run))throw new Error(a&&a.error||"Could not create the run.");this._adoptRun(a.run),this._adoptRuns([...this._runs,a.run]),this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}_openSettings(e){if(!this._run)return;let a=et.some(r=>r.id===e)?e:tt;this._hudView!=="settings"&&(this._settingsFrom=this._hudView||"home"),this._hudView="settings",this._settingsCategory=a,this._renderBrowser(),a==="continuity"&&this._loadContinuity(),a==="debug"&&this._loadTokenLog()}_settingsBackLabel(){return{home:"Home",modes:"Battle",roster:"Units",unit:"Units",summon:"Summon",formation:"Formation",inventory:"Inventory",farm:"Materials",chapters:"Chapters",chapter:"Chapter",result:"Result",combat:"Battle"}[this._settingsFrom]||"Home"}_leaveSettings(){this._hudView=this._settingsFrom==="settings"?"home":this._settingsFrom||"home",this._renderBrowser()}async _setSources(e){if(!this._run||!this._run.runId||!e||typeof e!="object")return;let a=this._run;this._run={...this._run,...e},this._settingsRev+=1;let r=await this._postJson("/run/sources",{runId:this._run.runId,sources:e});if(!r||!r.ok){this._run=a,this._settingsRev+=1,this._renderBrowser();return}if(r.run&&typeof r.run=="object"){let s={...this._run,...r.run};for(let o of Object.keys(e))Object.prototype.hasOwnProperty.call(r.run,o)||delete s[o];this._run=s,this._settingsRev+=1}}_switchRun(e){if(e){if(e===this._activeRunId){this._creatingNew=!1,this._showRuns=!1,this._renderBrowser();return}this._postJson("/run/activate",{runId:e}).then(a=>{a&&a.ok&&a.run&&(this._adoptRun(a.run),this._showRuns=!1,this._renderBrowser(),this._loadState())})}}_forgeCancelWiring(){return{onCancel:()=>{this._forgeCancelAsking=!0,this._renderBrowser()},onCancelKeep:()=>{this._forgeCancelAsking=!1,this._renderBrowser()},onCancelGo:()=>this._cancelWorldCreation()}}_cancelWorldCreation(){let e=this._run&&this._run.runId;!e||this._forgeCancelling||(this._forgeCancelling=!0,this._bannerState="cancelled",this._artState="cancelled",this._postJson("/run/delete",{runId:e}).then(a=>{a&&a.ok&&(this._adoptRuns(a.runs),this._activeRunId=a.activeRunId||null,this._adoptRun(a.activeRun||null),this._creatingNew=!1,this._showRuns=!1)}).catch(()=>{}).then(()=>{this._forgeCancelling=!1,this._forgeCancelAsking=!1,this._renderBrowser()}))}_deleteRun(e){e&&this._postJson("/run/delete",{runId:e}).then(a=>{a&&a.ok&&(this._adoptRuns(a.runs),this._activeRunId=a.activeRunId||null,this._run&&e===this._run.runId&&this._adoptRun(a.activeRun||null),this._runs.length===0&&(this._showRuns=!1,this._creatingNew=!1),this._renderBrowser())})}_loadChapterPlan(){if(this._planState="loading",this._renderBrowser(),!this._run){this._planState="error",this._renderBrowser();return}let e=null;this._postJson("/chapter-plan",{runId:this._run.runId,chapter:this._planChapter}).then(a=>{if(a&&a.ok&&a.plan){e=a.plan;let r=a.progress&&a.progress[String(this._planChapter)]||{};this._chapterProgress={normal:r.normal||0,hard:r.hard||0,veryhard:r.veryhard||0},this._difficulty=Ft(this._difficulty,this._chapterProgress,ut(e)),this._chapterCp=a.cp||null}else this._planState="error"}).then(()=>{if(!(this._planState==="error"||!e))return this._prewarmCombats(e)}).then(()=>{if(this._planState!=="error"&&e){this._plan=e,this._planState="idle",this._loadLocations();let a=this._activeStoryNode;if(a&&a.restored&&a.chapter===this._planChapter){let r=De(e,a.difficulty).find(s=>s.type==="story"&&s.storyIndex===a.storyIndex);r&&Object.assign(a,r),a.restored=!1}this._openPrologueIfOwed(e)}this._run&&this._renderBrowser()})}_openPrologueIfOwed(e){if(!this._prologue||this._activeStoryNode&&this._activeStoryNode.prologue)return;let a=this._planChapter===1?De(e,"normal")[0]:null;if(!a||a.type!=="story"){this._prologue=!1;return}this._difficulty="normal",this._openStoryNode(a,{nodeIndex:0,prologue:!0})}_prewarmCombats(e){let a=ut(e);if(!a||!this._run)return Promise.resolve();let r=this._planChapter,s=Promise.resolve();for(let o=0;o<a;o+=1){let i=o;s=s.then(()=>this._postJson("/combat-guide",{runId:this._run.runId,chapter:r,combatIndex:i}))}return s}_loadStandardBanner(){if(this._bannerState="loading",this._renderBrowser(),!this._run){this._bannerState="error",this._renderBrowser();return}let e=this._run.runId,a=24,r=s=>!this._run||this._run.runId!==e?Promise.resolve():s>a?(this._bannerState="error",Promise.resolve()):this._postJson("/banner/step",{runId:e}).then(o=>{if(!o||!o.ok){this._bannerState="error";return}if(typeof o.total=="number"&&o.total>0&&(this._forge={done:Number(o.done)||0,total:o.total,name:String(o.label||"")},this._renderBrowser()),!o.finished)return r(s+1);this._bannerState="idle",this._bannerReady=!0,this._artReady=!1,this._artState="idle",this._artBlocking=!0;let i=o.result||o;typeof i.granted=="number"&&(this._rosterCount=i.granted)});r(1).then(()=>{this._forge={done:0,total:0,name:""},this._run&&this._renderBrowser()})}_nodeBackground(){let e=this._activeStoryNode,a=e&&typeof e.location=="string"?e.location:"",r=Ar(a),s=this._locations||{};return r&&s[r]&&s[r].url||""}_showBackgroundNow(){let e=this._root&&this._root.querySelector('[data-bg="a"]'),a=this._nodeBackground();!e||!a||(e.style.backgroundImage=`url(${a})`,e.setAttribute("data-on",""))}_loadLocations(){return this._postJson("/locations",{runId:this._run?this._run.runId:""}).then(e=>{e&&e.ok&&e.places&&(this._locations=e.places,this._showBackgroundNow())}).catch(()=>{})}_imageSlot(e){let a=()=>e(),r=(this._imageChain||Promise.resolve()).then(a,a);return this._imageChain=r.then(()=>{},()=>{}),r}_ensureArtRunning(){!this._run||this._artReady||this._artState!=="idle"||this._bannerReady&&this._startArt()}_startArt(){if(this._artState="painting",this._art={done:0,total:0,name:""},!this._run){this._artReady=!0,this._renderBrowser();return}this._planState==="idle"&&this._plan==null&&this._loadChapterPlan(),this._postJson("/portraits",{runId:this._run.runId}).then(e=>{let a=e&&e.ok&&Array.isArray(e.pending)?e.pending:[];return a.length?(this._art={done:Number(e.done)||0,total:Number(e.total)||a.length,name:a[0].name},this._artBlocking&&this._renderBrowser(),this._paintNext(a,0,0)):this._finishArt()}).catch(()=>this._finishArt())}_paintNext(e,a,r){if(!this._run||this._artState!=="painting")return Promise.resolve();if(a>=e.length){if(r>0&&r===e.length){if(this._artBlocking)return this._artState="blocked",this._renderBrowser(),Promise.resolve();console.warn("[gacha-forge] every background portrait failed ("+r+") \u2014 units keep their silhouette")}return this._paintFoundingArt().then(()=>this._finishArt())}let s=e[a];return this._art={...this._art,name:s.name},this._artBlocking&&this._renderBrowser(),this._imageSlot(()=>this._postJson("/portrait",{runId:this._run.runId,unitId:s.unitId})).catch(()=>null).then(o=>{let i=!!(o&&o.ok);return i&&(this._art={...this._art,done:this._art.done+1}),this._paintNext(e,a+1,r+(i?0:1))})}_paintFoundingArt(){return!this._artBlocking||!this._run?Promise.resolve():(this._art={...this._art,name:"The banner splash"},this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:"char-standard"})).catch(()=>null))}_finishArt(){let e=!this._artBlocking;this._artState="idle",this._artReady=!0,this._artBlocking=!1,e&&(this._hudView==="roster"&&!this._rosterUnitId&&this._rosterState!=="loading"?this._loadRoster():this._hudView==="summon"&&this._summonBannerState!=="loading"&&this._loadSummonBanner()),this._renderBrowser()}_openPick(e){e!=="bg"&&e!=="unit"||(this._pick={slot:e,source:e==="bg"?"story":"all",mode:"default"},this._renderBrowser(),this._postJson("/home-options",{runId:this._run?this._run.runId:""}).then(a=>{!a||a.ok===!1||(this._pickOptions={backgrounds:a.backgrounds||{},units:a.units||[],outfits:a.outfits||[]},this._pickRev+=1,this._pick&&this._renderBrowser())}))}_closePick(){this._pick&&(this._pick=null,this._renderBrowser())}_pickSource(e){this._pick&&(this._pick={...this._pick,source:String(e||"")},this._renderBrowser())}_pickMode(e){this._pick&&(this._pick={...this._pick,mode:e==="outfit"?"outfit":"default"},this._renderBrowser())}_takePick(e){if(!this._pick||!this._run)return;let a={runId:this._run.runId};if(this._pick.slot==="bg")a.bg=e?{src:this._pick.source,key:e}:null;else{if(!e)return;if(this._pick.mode==="outfit"){let r=(this._pickOptions&&this._pickOptions.outfits||[]).find(s=>s&&s.key===e);if(!r)return;a.unitId=r.unitId,a.unitOutfit=e}else a.unitId=e,a.unitOutfit=""}this._pick=null,this._renderBrowser(),this._postJson("/home-decor",a).then(r=>{!r||r.ok===!1||!r.decor||(this._run={...this._run,decor:r.decor},this._renderBrowser())})}_openRoster(){this._hudView="roster",this._rosterUnitId=null,this._rosterState="idle",this._renderBrowser()}_loadRoster(){if((!Array.isArray(this._roster)||!this._roster.length)&&(this._rosterState="loading"),this._renderBrowser(),!this._run){this._rosterState="error",this._renderBrowser();return}this._postJson("/roster",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.cards)?(this._roster=e.cards,this._rosterRev+=1,this._rosterCount=e.cards.length,this._rosterState="ready"):(!Array.isArray(this._roster)||!this._roster.length)&&(this._rosterState="error")}).then(()=>{this._hudView==="roster"&&this._renderBrowser()})}_openUnit(e,a="profile"){e&&(this._rosterUnitId=e,this._unit=null,this._unitTab=a==="growth"||a==="gear"||a==="bond"?a:"profile",this._growth=null,this._growthRev+=1,this._feed=null,this._unitState="idle",this._portraitReset(),this._renderBrowser())}_portraitReset(){this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev+=1}_loadUnit(){if(this._unitState="loading",this._renderBrowser(),!this._run||!this._rosterUnitId){this._unitState="error",this._renderBrowser();return}let e=this._rosterUnitId;this._postJson("/unit",{runId:this._run.runId,unitId:e}).then(a=>{this._rosterUnitId===e&&(a&&a.ok&&a.unit?(this._unit=a.unit,this._unitLevel=Number(a.level)||1,this._unitBond=Number(a.bond)||0,this._growth=a,this._growthRev+=1,this._feed=null,this._portrait=a.portrait||null,this._portraitRev+=1,this._unitState="ready"):this._unitState="error")}).then(()=>{this._rosterUnitId===e&&this._renderBrowser()})}_portraitOpenStudio(){this._portrait&&(this._portraitDraft={appearance:this._portrait.appearance||"",tags:kt(this._portrait.tags)},this._portraitOpen=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser())}_portraitClose(){this._portraitOpen=!1,this._portraitCrop=null,this._portraitError="",this._portraitRev+=1,this._renderBrowser()}_portraitEdit(e){if(!(!this._portraitDraft||!e)){if(typeof e.appearance=="string"){this._portraitDraft.appearance=e.appearance;return}if(typeof e.addTag=="string")for(let a of kt(e.addTag))this._portraitDraft.tags.includes(a)||this._portraitDraft.tags.push(a);else if(Number.isInteger(e.dropTag))this._portraitDraft.tags.splice(e.dropTag,1);else return;this._portraitRev+=1,this._renderBrowser()}}_portraitGenerate(){if(this._portraitBusy||!this._run||!this._rosterUnitId||!this._portraitDraft)return;let e=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait",{runId:this._run.runId,unitId:e,force:!0,appearance:this._portraitDraft.appearance,imageTags:this._portraitDraft.tags}).then(a=>this._portraitApply(e,a,"That did not paint."))}_portraitPick(e){let r=(this._portrait&&this._portrait.strip||[])[e];if(!r||r.current||this._portraitBusy||!this._run||!this._rosterUnitId)return;let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait/select",{runId:this._run.runId,unitId:s,url:r.url}).then(o=>this._portraitApply(s,o,"That one could not be restored."))}_portraitApply(e,a,r){if(this._portraitBusy=!1,this._rosterUnitId===e){if(a&&a.ok&&a.view){let s=a.view;this._portrait=s,this._portraitDraft={appearance:s.appearance||"",tags:kt(s.tags)},this._portraitCrop=null,this._portraitError="";let o=Array.isArray(s.strip)&&s.strip.length?s.strip[0].url:"";this._unit&&(this._unit={...this._unit,portrait:o,appearance:s.appearance,imageTags:s.tags}),this._rosterState="idle"}else this._portraitError=Bh[a&&a.error||""]||a&&a.detail||r;this._portraitRev+=1,this._renderBrowser()}}_portraitFile(e){if(!e||this._portraitBusy)return;let a=s=>{this._portraitError=s,this._portraitCrop=null,this._portraitRev+=1,this._renderBrowser()},r=new FileReader;r.onerror=()=>a("That file could not be read."),r.onload=()=>{let s=String(r.result||""),o=new Image;o.onerror=()=>a("That file is not an image this gallery accepts."),o.onload=()=>{let i=o.naturalWidth||o.width,n=o.naturalHeight||o.height;if(!i||!n)return a("That image has no size.");this._portraitCrop={src:s,natural:{w:i,h:n},size:1,frame:Ya(i,n,1,.5,.42)},this._portraitError="",this._portraitRev+=1,this._renderBrowser()},o.src=s},r.readAsDataURL(e)}_portraitDrag(e){let a=this._portraitCrop;!a||!e||(a.frame=Ka({...a.frame,x:a.frame.x+(Number(e.dx)||0)*a.natural.w,y:a.frame.y+(Number(e.dy)||0)*a.natural.h},a.natural.w,a.natural.h),Xa(this._root,a.frame,a.natural.w,a.natural.h))}_portraitSize(e){let a=this._portraitCrop;if(!a)return;let r=(a.frame.x+a.frame.w/2)/a.natural.w,s=(a.frame.y+a.frame.h/2)/a.natural.h;a.size=e,a.frame=Ya(a.natural.w,a.natural.h,e,r,s),Xa(this._root,a.frame,a.natural.w,a.natural.h)}_portraitUpload(){let e=this._portraitCrop;if(!e||this._portraitBusy||!this._run||!this._rosterUnitId)return;let a=Number(this._portrait&&this._portrait.width)||0,r=Number(this._portrait&&this._portrait.height)||0;if(!a||!r){this._portraitError="This world did not say what size a portrait is.",this._portraitRev+=1,this._renderBrowser();return}let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser();let o=new Image;o.onerror=()=>this._portraitApply(s,null,"That image could not be prepared."),o.onload=()=>{let i="";try{let n=document.createElement("canvas");n.width=a,n.height=r,n.getContext("2d").drawImage(o,e.frame.x,e.frame.y,e.frame.w,e.frame.h,0,0,a,r),i=n.toDataURL("image/jpeg",.92)}catch{i=""}if(!i)return this._portraitApply(s,null,"That image could not be prepared.");this._postJson("/portrait/upload",{runId:this._run.runId,unitId:s,image:i}).then(n=>this._portraitApply(s,n,"That image was not accepted."))},o.src=e.src}_wireRuns(){fn(this._root,{onNew:()=>{this._creatingNew=!0,this._showRuns=!1,this._renderBrowser()},onSwitch:e=>this._switchRun(e),onDelete:e=>this._deleteRun(e),onBack:()=>{this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}})}_wireChapter(){Gr(this._root,{plan:this._plan,difficulty:this._difficulty,progress:this._chapterProgress,onBack:()=>{this._hudView="chapters",this._renderBrowser()},onDifficulty:e=>{this._difficulty=e,this._renderBrowser()},onPlayStory:e=>this._playStoryNode(e),onReplayStory:(e,a)=>this._replayStoryNode(e,a),onStartCombat:e=>this._openCombat(e)})}_openChapter(e){!this._run||e<1||(this._planChapter=e,this._plan=null,this._planState="idle",this._hudView="chapter",this._continuity=null,this._continuityState="idle",this._renderBrowser())}_wireChapters(){let e=this._root.querySelector("[data-back]");e&&e.addEventListener("click",()=>{this._hudView="home",this._renderBrowser()}),this._chaptersData=null,this._chaptersState="idle",this._loadChapters()}_loadChapters(){this._run&&(this._chaptersState="loading",this._fillChapters(),this._postJson("/chapters",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.chapters)?(this._chaptersData=e,this._chaptersState="ready"):this._chaptersState="error",this._fillChapters()}))}_fillChapters(){let e=this._root.querySelector("[data-chapters-list]");if(!e)return;if(this._chaptersState==="loading"&&!this._chaptersData){e.innerHTML='<p class="sel-empty">Loading&hellip;</p>';return}if(this._chaptersState==="error"&&!this._chaptersData){e.innerHTML='<p class="sel-empty">Could not load chapters.</p>';return}let a=this._chaptersData||{chapters:[],nextChapter:1,nextUnlocked:!0};e.innerHTML=Os(a.chapters,a.nextChapter,a.nextUnlocked);let r=(a.chapters||[]).map(s=>s.chapter);a.nextUnlocked&&r.push(a.nextChapter);for(let s of r){let o=this._root.querySelector('[data-open-chapter="'+s+'"]');o&&o.addEventListener("click",()=>this._openChapter(s))}}_playStoryNode(e){!this._run||this._storyStarting||(this._storyStarting=!0,this._storyNotice="",this._postJson("/story/start",{runId:this._run.runId,chapter:this._planChapter,storyIndex:e&&e.storyIndex}).then(a=>{if(this._storyStarting=!1,a&&a.ok){this._run&&(this._run.wallet=a.wallet||this._run.wallet),this._openStoryNode(e);return}this._storyNotice=a&&a.error==="no-vigor"?`Not enough Vigor: this beat costs ${a.cost} and you have ${a.vigor}.`:"That beat could not be started.",this._renderBrowser()}))}_replayStoryNode(e,a){this._run&&(this._storyNotice="",this._openStoryNode(e,{nodeIndex:a,replay:!0}))}_openStoryNode(e,{nodeIndex:a=null,replay:r=!1,prologue:s=!1}={}){if(!this._run)return;let o=this._difficulty,i=a??(this._chapterProgress[o]||0);this._activeStoryNode={...e||{},chapter:this._planChapter,difficulty:o,nodeIndex:i,storyIndex:e&&e.storyIndex,title:e&&e.title||"Story",replay:r,prologue:s},this._beat=null,this._beatCast=null,this._beatState="loading",this._beatRequested=!1,this._renderBrowser()}_loadBeat(){let e=this._activeStoryNode;if(!this._run||!e){this._beatState="error",this._beatRequested=!1,this._renderBrowser();return}this._postJson("/beat",{runId:this._run.runId,chapter:e.chapter,nodeIndex:e.nodeIndex,storyIndex:e.storyIndex}).then(async a=>{a&&a.ok&&Array.isArray(a.segments)&&a.segments.length?(this._beat=a.segments,this._beatCast=Array.isArray(a.cast)?a.cast:null,this._contextTokens=Number(a.contextTokens)||0,this._beatPlaces=await this._paintBeatPlaces(a.places),this._beatState="ready"):this._beatState="error"}).then(()=>{this._beatRequested=!1,this._renderBrowser()})}async _paintBeatPlaces(e){let a=Array.isArray(e)?e.filter(Boolean):[];if(!a.length)return null;let r=this._run?this._run.runId:"",s={},o=r?a.filter(n=>!n.url).length:0,i=0;for(let n of a){if(n.url){s[n.name]=n.url;continue}if(!r)continue;this._beatArt={done:i,total:o,name:n.name},this._renderBrowser();let l=await this._imageSlot(()=>this._postJson("/background",{runId:r,slug:n.slug,name:n.name,tags:n.tags})).catch(d=>({ok:!1,error:String(d&&d.message||d)}));i+=1,l&&l.ok&&l.url?s[n.name]=l.url:console.warn("[gacha-forge] beat background failed",n.name,l&&(l.detail||l.error))}return this._beatArt=null,await this._loadLocations(),s}_retryBeat(){this._beatState="loading",this._beatArt=null,this._beatRequested=!1,this._renderBrowser()}_completeStoryBeat(){let e=this._activeStoryNode,a=!!(e&&e.prologue);if(this._clearBeat(),e&&this._run){let r=e.nodeIndex==null?this._chapterProgress[e.difficulty]||0:e.nodeIndex;this._chapterProgress[e.difficulty]=(this._chapterProgress[e.difficulty]||0)+1,this._postJson("/complete",{runId:this._run.runId,chapter:e.chapter,difficulty:e.difficulty,nodeIndex:r}).then(s=>{s&&s.ok||(this._chapterProgress[e.difficulty]=Math.max(0,(this._chapterProgress[e.difficulty]||0)-1),this._hudView==="chapter"&&this._renderBrowser())})}a&&(this._prologue=!1),this._hudView=a?"home":"chapter",this._renderBrowser()}_exitStoryBeat(){this._clearBeat(),this._hudView="chapter",this._renderBrowser()}_clearBeat(){this._stopBeat(),this._beatState="idle",this._beat=null,this._beatPlaces=null,this._beatArt=null,this._activeStoryNode=null,this._beatRequested=!1}_advanceNode(){if(!this._run)return;let e=this._difficulty,a=this._chapterProgress[e]||0;this._chapterProgress[e]=a+1;let r=this._nodeTitle(a);this._postJson("/complete",{runId:this._run.runId,chapter:this._planChapter,difficulty:e,nodeIndex:a}).then(s=>{!(s&&s.ok)&&s&&s.error!=="lost"&&(this._chapterProgress[e]||0)===a+1&&(this._chapterProgress[e]=a),this._afterComplete(s,r)}).catch(()=>{(this._chapterProgress[e]||0)===a+1&&(this._chapterProgress[e]=a),this._renderBrowser()}),this._renderBrowser()}_nodeTitle(e){let a=this._plan&&Array.isArray(this._plan.nodes)?this._plan.nodes:[];return this._titleOfNode(a[e])}_titleOfNode(e){return`${this._chapterLabel()}${e&&e.title?" \xB7 "+e.title:""}`}_afterComplete(e,a){if(e&&e.error==="lost"){this._openResult({outcome:"lose",where:a,rewards:[],relic:null,rank:null,back:"chapter",canReplay:!0,again:this._combatNode});return}if(!(e&&e.ok)){this._leaveCombat("chapter");return}let r=Ni(e.reward);if(!r.length&&!e.rank){this._leaveCombat("chapter");return}this._openResult({outcome:"win",where:a,rewards:r,rank:e.rank||null,back:"chapter"})}_openResult(e){this._result=e,this._resultRev+=1,this._stopCombat(),this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._hudView="result",this._renderBrowser()}_closeResult(){let e=this._result&&this._result.back||"chapter";this._result=null,this._resultRev+=1,this._hudView=e,e==="farm"&&this._loadFarm(),e==="events"&&(this._eventId="seasonal"),this._renderBrowser()}_resultAgain(){let e=this._result&&this._result.again,a=this._result&&this._result.back||"farm";if(this._result=null,this._resultRev+=1,!e){this._hudView="farm",this._renderBrowser();return}if(a==="events"){this._hudView="events",this._eventId="seasonal",this._seasonalRun(e&&e.difficulty);return}if(a==="farm"){this._hudView="farm",this._farmRun(e);return}this._combatNode=e,this._combatPhase="loading",this._hudView="combat",this._renderBrowser()}_loadContinuity(){this._run&&(this._continuityState="loading",this._fillContinuity(),this._postJson("/continuity",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.chapters)?(this._continuity=e.chapters,this._continuityState="ready",e.warnTokens&&(this._warnTokens=Number(e.warnTokens)||this._warnTokens,at(this._root,this._contextTokens,this._warnTokens))):this._continuityState="error",this._fillContinuity()}))}_vigorView(){let e=this._wallet||this._run&&this._run.wallet||null,a=this._combatVigorError,r=Number(a&&Number.isFinite(Number(a.cost))?a.cost:this._combat&&this._combat.cost);return!e||!Number.isFinite(r)?null:{have:Number(e.vigor)||0,cost:r,nextMs:a&&Number.isFinite(a.vigorNextMs)?a.vigorNextMs:this._wallet&&this._wallet.vigorNextMs||null}}_startBattle(){if(!this._run||this._combatStarting)return;this._combatStarting=!0;let e=this._combatNode;(e&&e.farm?this._postJson("/farm/start",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}):this._postJson("/battle/start",{runId:this._run.runId,chapter:e.chapter,combatIndex:e.combatIndex,difficulty:this._difficulty,presetIndex:this._combatPreset})).then(r=>{this._combatStarting=!1,r&&r.ok?(this._run&&(this._run.wallet=r.wallet||this._run.wallet),this._combatPhase="battle",this._combatVigorError=null):this._combatVigorError=r&&r.error==="no-vigor"?r:{error:r&&r.error||"failed"},this._renderBrowser()})}_feedRoom(e){if(!e)return 0;let a=Number(e.level)||1,r=(Array.isArray(e.ladder)?e.ladder:[]).filter(s=>Number(s.level)>=a).reduce((s,o)=>s+(Number(o.xp)||0),0);return Math.max(0,r-Math.max(0,Number(e.xp)||0))}_growthView(){let e=this._growth;if(!e)return null;let a=this._feed;if(!a)return e;let r=Array.isArray(e.tiers)?e.tiers:[],s=Math.max(0,Number(e.xp)||0),o=0;for(let v of r)o+=(Number(a[v.id])||0)*(Number(v.xp)||0);s+=o;let i=Number(e.wallet&&e.wallet.funds)||0,n=Number(e.level)||1,l=0,d=!1;for(let v of Array.isArray(e.ladder)?e.ladder:[])if(v.level===n){if(s<v.xp)break;if(i<v.funds){d=!0;break}s-=v.xp,i-=v.funds,l+=v.funds,n=v.level+1}let h=(Array.isArray(e.ladder)?e.ladder:[]).find(v=>v.level===n-1),f=(Array.isArray(e.ladder)?e.ladder:[]).find(v=>v.level===n),m=n-(Number(e.level)||1);return{...e,preview:{ready:o>0,short:d,xp:o,levelTo:n,cpTo:h?h.cpAfter:Number(e.cp)||0,funds:l||(d?this._nextStepFunds(e,n):0),spent:{...a},xpAfter:s,needAfter:f?f.xp:null,solid:m>0?0:Math.max(0,Number(e.xp)||0),roomLeft:Math.max(0,this._feedRoom(e)-o)}}}_nextStepFunds(e,a){let r=(Array.isArray(e.ladder)?e.ladder:[]).find(s=>s.level===a);return r?r.funds:0}_feedAdd(e){let a=this._growth;if(!a||!e)return;let r=Math.max(0,Number(a.wallet&&a.wallet.insight&&a.wallet.insight[e])||0),s=this._feed||{},o=Number(s[e])||0;if(o>=r)return;let i=Array.isArray(a.tiers)?a.tiers:[],n=0;for(let l of i)n+=(Number(s[l.id])||0)*(Number(l.xp)||0);this._feedRoom(a)-n<=0||(this._feed={...s,[e]:o+1},this._paintGrowth())}_feedReset(){this._feed&&(this._feed=null,this._paintGrowth())}_feedCommit(){let e=this._growth,a=!!e&&!this._feed&&Number(e.xpNeeded)>0&&Number(e.xp)>=Number(e.xpNeeded)&&Number(e.level)<Number(e.levelCap);if(!this._run||!this._rosterUnitId||!this._feed&&!a)return;let r=this._feed||{};this._feed=null,this._paintGrowth(),this._postJson("/level-up",{runId:this._run.runId,unitId:this._rosterUnitId,spend:r}).then(s=>{s&&s.ok?(this._unitLevel=Number(s.level)||this._unitLevel,this._growth={...this._growth,...s},this._growthRev+=1,this._renderBrowser()):this._paintGrowth()})}_openInventory(){this._hudView="inventory",this._invSection="relics",this._invView={slot:"all",rarity:"all",picked:"",feeding:null,gained:[]},this._inventoryState=this._inventory?"ready":"loading",this._renderBrowser(),this._loadInventory()}_loadInventory(){this._run&&(this._inventoryState=this._inventoryState==="ready"?"ready":"loading",this._postJson("/inventory",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._inventory=e,this._inventoryState="ready"):this._inventoryState="error",this._invRev+=1,this._renderBrowser()}).catch(()=>{this._inventoryState="error",this._invRev+=1,this._renderBrowser()}))}_relicLock(e){!this._run||!e||this._invBusy||(this._invBusy=!0,this._postJson("/relic/lock",{runId:this._run.runId,relicId:e}).catch(()=>null).then(()=>{this._invBusy=!1,this._loadInventory()}))}_relicFeedFromInventory(){let e=this._invView.feeding;!this._run||!e||!e.picked.length||this._invBusy||(this._invBusy=!0,this._postJson("/relic/feed",{runId:this._run.runId,relicId:e.targetId,food:e.picked}).then(a=>{this._invBusy=!1,a&&a.ok?this._invView={...this._invView,feeding:null,picked:e.targetId,gained:a.gained||[]}:this._invView={...this._invView,feeding:null},this._loadInventory()}).catch(()=>{this._invBusy=!1,this._invView={...this._invView,feeding:null},this._loadInventory()}))}_openFarm(){this._hudView="farm",this._farmView="root",this._farmState=this._farm?"ready":"loading",this._renderBrowser(),this._loadFarm()}_loadFarm(){this._run&&this._postJson("/farm",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._farm=e,this._farmState="ready"):this._farmState="error",this._farmRev+=1,this._hudView==="farm"&&this._renderBrowser()})}_farmRun(e){!this._run||!e||this._farmBusy||(this._farmBusy=!0,this._pendingFarm={...e},this._stopCombat(),this._pendingCombat={farm:!0,...e,title:"Materials"},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser())}_claimFarm(){if(!this._run)return;let e=this._pendingFarm?{...this._pendingFarm}:null,a=!!(e&&e.stage==="seasonal"),r=this._farmStageLabel(e);this._postJson("/farm/claim",{runId:this._run.runId}).then(s=>{if(!(s&&s.ok)){this._leaveCombat("farm");return}let o=s.dropped||null;this._pendingFarm=null,this._openResult({outcome:"win",where:r,rewards:Ii(o),relic:o&&o.relic||null,rank:s&&s.rank||null,back:a?"events":"farm",canReplay:!!e,again:e}),a||this._loadFarm()}).catch(()=>this._leaveCombat("farm"))}_newWorldViewOut(){return this._newWorld?this._newWorldGained?{...this._newWorld,gained:this._newWorldGained}:this._newWorld:null}_claimNewWorld(){!this._run||this._claimingNewWorld||(this._claimingNewWorld=!0,this._postJson("/newworld/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._newWorldGained=Array.isArray(e.gained)?e.gained:null,this._eventsRev+=1,e.done&&(this._eventId="login",this._newWorldGained=null,this._refreshState()))}).catch(()=>{}).then(()=>{this._claimingNewWorld=!1,this._renderBrowser()}))}_seasonalRun(e){if(!this._run||this._farmBusy)return;let a=Math.round(Number(e)||0);if(!a)return;let r={stage:"seasonal",difficulty:a,family:""};this._farmBusy=!0,this._pendingFarm={...r},this._stopCombat(),this._pendingCombat={farm:!0,...r,title:this._seasonalLabel()},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_seasonalLabel(){return this._seasonal&&this._seasonal.label||"Seasonal Event"}_seasonalRunLabel(e){let a=e?Ye.find(r=>r.difficulty===Number(e.difficulty)):null;return(a?a.label+" \xB7 ":"")+this._seasonalLabel()}_seasonalDraw(){if(!this._run||this._seasonalDrawing)return;this._seasonalDrawing=!0;let e=this._root&&this._root.querySelector("[data-seasonal-draw]");e&&e.setAttribute("disabled",""),this._postJson("/seasonal/draw",{runId:this._run.runId}).then(a=>!a||!a.ok?null:(this._seasonalGained=Array.isArray(a.gained)?a.gained:null,this._eventsRev+=1,a)).catch(()=>null).then(a=>new Promise(r=>{if(!a||!Number.isFinite(Number(a.at)))return r();dr(this._root,Number(a.at),r)})).then(()=>{this._seasonalDrawing=!1,this._renderBrowser()})}_farmStageLabel(e){if(e&&e.stage==="seasonal")return this._seasonalRunLabel(e);if(!e)return"Materials";let a=["","Normal","Hard","Very Hard"][Number(e.difficulty)]||"",s=((this._farm&&this._farm.stages||{})[e.stage]||[]).find(i=>Number(i.difficulty)===Number(e.difficulty));if(e.stage==="asc"){let i=(this._farm&&this._farm.families||[]).find(n=>n.id===e.family);return`${a} \xB7 ${i?i.name:"Ascension"}`}let o=this._farm&&this._farm.stageNames||{};return`${a} \xB7 ${o[e.stage]||s&&s.material||"Materials"}`}_gearFeedView(){return!this._gearFeed||!this._gearFeed.open?null:{open:!0,picked:this._gearFeed.picked||[],gained:this._gearFeed.gained||null,inventory:this._relics&&this._relics.items||[],funds:Number(this._wallet&&this._wallet.funds)||0,cost:Number(this._relics&&this._relics.feedFunds)||0,tickEvery:Number(this._relics&&this._relics.tickEvery)||3}}_relicFeed(e){if(!(!e||!this._run)){if(e.type==="open"){this._gearFeed={open:!0,picked:[],gained:null},this._renderBrowser(),this._loadRelics();return}if(e.type==="back"){this._gearFeed=null,this._renderBrowser();return}if(this._gearFeed){if(e.type==="clear"){this._gearFeed.picked=[],this._gearFeed.gained=null,this._renderBrowser();return}if(e.type==="pick"){let a=this._gearFeed.picked||[],r=a.indexOf(e.id);r>=0?a.splice(r,1):a.push(e.id),this._gearFeed.picked=a,this._gearFeed.gained=null,this._renderBrowser();return}e.type==="go"&&this._relicFeedGo()}}}_loadRelics(){this._postJson("/relics",{runId:this._run.runId}).then(e=>{e&&e.ok&&(this._relics=e,this._relicsRev+=1,this._renderBrowser())})}_relicFeedGo(){let e=this._gearSlot,a=this._growth&&this._growth.gear,r=a&&(a.slots||[]).find(n=>n.key===e),s=r&&r.item?r.item.id:"",o=this._gearFeed&&this._gearFeed.picked||[];if(!s||!o.length||this._feedBusy)return;this._feedBusy=!0;let i=this._rosterUnitId;this._postJson("/relic/feed",{runId:this._run.runId,relicId:s,food:o}).then(n=>{this._feedBusy=!1,this._rosterUnitId===i&&(n&&n.ok&&(this._gearFeed={open:!0,picked:[],gained:n.gained||[]},this._loadRelics(),this._loadUnit()),this._renderBrowser())}).catch(()=>{this._feedBusy=!1})}_equip(e){if(!this._run||!this._rosterUnitId||this._equipBusy)return;this._equipBusy=!0;let a=this._rosterUnitId,r=this._gearSlot||"weapon",s=r!=="weapon";this._postJson("/equip",{runId:this._run.runId,unitId:a,slot:r,weaponId:s?"":e||"",relicId:s&&e||""}).then(o=>{this._equipBusy=!1,this._rosterUnitId===a&&(o&&o.ok&&(this._growth={...this._growth,...o},this._growthRev+=1,this._gearSlot=null),this._renderBrowser())}).catch(()=>{this._equipBusy=!1})}_ascend(){if(!this._run||!this._rosterUnitId)return;let e=this._growth;!e||!e.ascension||!e.ascension.ready||this._growthBusy||(this._growthBusy=!0,this._postJson("/ascend",{runId:this._run.runId,unitId:this._rosterUnitId}).then(a=>{this._growthBusy=!1,a&&a.ok?(this._growth={...this._growth,...a},this._growthRev+=1):a&&a.ascension&&(this._growth={...this._growth,ascension:a.ascension},this._growthRev+=1),this._paintGrowth()}))}_formUp(e){if(!this._run||!this._rosterUnitId)return;let a=this._growth,r=a&&a.form&&Array.isArray(a.form.tracks)?a.form.tracks.find(s=>s.key===e):null;!r||!r.ready||this._growthBusy||(this._growthBusy=!0,this._postJson("/form-up",{runId:this._run.runId,unitId:this._rosterUnitId,track:e}).then(s=>{this._growthBusy=!1,s&&s.ok?(s.unit&&(this._unit=s.unit),this._growth={...this._growth,...s},this._growthRev+=1):s&&s.form&&(this._growth={...this._growth,form:s.form},this._growthRev+=1),this._paintGrowth()}))}_paintGrowth(){let e=this._root.querySelector(".cp-panel");!e||this._unitTab!=="growth"||!this._unit||(e.innerHTML=Ao(this._unit,this._growthView()))}_loadTokenLog(){this._tokenLog={status:"loading",entries:this._tokenLog&&this._tokenLog.entries||[],totals:this._tokenLog&&this._tokenLog.totals},this._fillTokenLog(),this._loreStatus={status:"loading"},this._postJson("/lore-status",{runId:this._run?this._run.runId:""}).then(e=>{this._loreStatus=e&&e.ok?{status:"ready",data:e}:{status:"error"},this._fillTokenLog()}),this._postJson("/token-log",{runId:this._run?this._run.runId:""}).then(e=>{e&&e.ok&&Array.isArray(e.entries)?this._tokenLog={status:"ready",entries:e.entries,totals:e.totals||null}:this._tokenLog={status:"error",entries:[],totals:null},this._fillTokenLog()})}_fillTokenLog(){let e=this._root.querySelector('[data-view-body="debug"]');e&&(e.innerHTML=Ia(this._loreStatus,this._tokenLog))}_fillContinuity(){let e=this._root.querySelector("[data-continuity-list]");if(e){if(this._continuityState==="loading"&&!this._continuity){e.innerHTML='<p class="st-empty">Loading&hellip;</p>';return}if(this._continuityState==="error"&&!this._continuity){e.innerHTML='<p class="st-empty">Could not load chapters.</p>';return}e.innerHTML=bs(this._continuity||[],this._compressing);for(let a of this._continuity||[])if(a&&a.complete&&!a.compressed&&this._compressing==null){let r=this._root.querySelector('[data-compress="'+a.chapter+'"]');r&&r.addEventListener("click",()=>this._compressChapter(a.chapter))}}}_compressChapter(e){!this._run||this._compressing!=null||(this._compressing=e,this._fillContinuity(),this._postJson("/compress",{runId:this._run.runId,chapter:e}).then(a=>{this._compressing=null,a&&a.ok&&Array.isArray(this._continuity)&&(this._continuity=this._continuity.map(r=>r.chapter===e?{...r,compressed:!0}:r)),a&&a.ok&&Number.isFinite(Number(a.contextTokens))&&(this._contextTokens=Number(a.contextTokens)||0,at(this._root,this._contextTokens,this._warnTokens)),this._fillContinuity()}))}_setWarnTokens(e){let a=Math.max(1e3,Math.round(Number(e)||0));!a||!this._run||(this._warnTokens=a,at(this._root,this._contextTokens,this._warnTokens),this._postJson("/warn-threshold",{runId:this._run.runId,warnTokens:a}).then(r=>{r&&r.ok&&r.warnTokens&&(this._warnTokens=Number(r.warnTokens)||this._warnTokens,at(this._root,this._contextTokens,this._warnTokens))}))}_stopForge(){this._forgeCleanup&&(this._forgeCleanup(),this._forgeCleanup=null)}_stopBeat(){this._beatCleanup&&(this._beatCleanup(),this._beatCleanup=null)}_stopSummon(){this._summonCleanup&&(this._summonCleanup(),this._summonCleanup=null)}_stopCombat(){this._combatCleanup&&(this._combatCleanup(),this._combatCleanup=null)}_openCombat(e){if(!this._run||!e||typeof e.combatIndex!="number")return;let a=this._difficulty,r=this._chapterProgress[a]||0;this._pendingCombat={chapter:this._planChapter,combatIndex:e.combatIndex,title:e&&e.title||"Combat",difficulty:a,nodeIndex:r},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_enterBattle(){let e=this._pendingCombat;e&&(this._formationBattleMode=!1,this._combatNode={...e},this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatNonce=0,this._combatPreset=null,this._combatPhase="loading",this._hudView="combat",this._renderBrowser())}_loadBattle(){if(this._battleLoading)return;this._battleLoading=!0;let e=this._combatNode;if(this._combatError="",this._combatPhase="loading",this._renderBrowser(),!this._run||!e){this._battleLoading=!1,this._combatPhase="error",this._renderBrowser();return}(e.farm?this._postJson("/farm/battle",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}):this._postJson("/battle",{runId:this._run.runId,chapter:e.chapter,combatIndex:e.combatIndex,difficulty:this._difficulty,presetIndex:this._combatPreset})).then(r=>{if(r&&r.ok&&Array.isArray(r.allies)&&Array.isArray(r.enemies)){this._combat=r,this._combatPreset=typeof r.activePreset=="number"?r.activePreset:this._combatPreset,this._combatNode={...e,objective:r.objective||""};let s=lo({allies:r.allies,enemies:r.enemies,seed:no(r.battleKey||e.combatIndex)});this._combatSteps=s.steps,this._combatResult=s.result,this._combatPhase="prebattle"}else this._combatError=r&&r.error||"",this._combatPhase="error"}).then(()=>{this._battleLoading=!1,this._farmBusy=!1,this._hudView==="combat"&&this._renderBrowser()})}_pickCombatPreset(e){!this._run||this._combatPreset===e||(this._combatPreset=e,this._loadBattle())}_combatFinished(e){if(this._combatOutcome)return;if(this._combatOutcome=e==="lose"?"lose":"win",this._stopCombat(),this._combatOutcome==="win"){this._exitCombat(!0);return}let a=this._combatNode,r=!!(a&&a.farm);setTimeout(()=>{this._combatOutcome==="lose"&&this._openResult({outcome:"lose",where:a&&a.title||"",rewards:[],rank:null,canReplay:!0,back:this._battleBack(a),again:a||null})},Mh)}_exitCombat(e){let a=this._combatNode;if(e&&(this._combatOutcome||this._combatResult)==="win"){this._stopCombat(),a&&a.farm?this._claimFarm():this._completeCombatNode();return}if(e&&a){let s=!!a.farm,o=s&&this._pendingFarm?{...this._pendingFarm}:null;s&&(this._pendingFarm=null),this._openResult({outcome:"lose",where:s?this._farmStageLabel(o):this._titleOfNode(a),rewards:[],relic:null,rank:null,back:this._battleBack(a),canReplay:!0,again:s?o:a}),s&&a.stage!=="seasonal"&&this._loadFarm();return}this._leaveCombat(this._battleBack(a))}_battleBack(e){return!e||!e.farm?"chapter":e.stage==="seasonal"?"events":"farm"}_leaveCombat(e){this._stopCombat(),this._hudView=e,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,e==="farm"&&(this._pendingFarm=null),this._renderBrowser()}_completeCombatNode(){let e=this._combatNode;if(!this._run||!e)return;let a=e.difficulty||this._difficulty,r=typeof e.nodeIndex=="number"?e.nodeIndex:this._chapterProgress[a]||0;if((this._chapterProgress[a]||0)!==r)return;this._chapterProgress[a]=r+1;let s=this._nodeTitle(r);this._postJson("/complete",{runId:this._run.runId,chapter:e.chapter,difficulty:a,nodeIndex:r}).then(o=>{!(o&&o.ok)&&o&&o.error!=="lost"&&(this._chapterProgress[a]||0)===r+1&&(this._chapterProgress[a]=r),this._afterComplete(o,s)}).catch(()=>{(this._chapterProgress[a]||0)===r+1&&(this._chapterProgress[a]=r),this._renderBrowser()})}_openSummon(){this._hudView="summon",this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._renderBrowser()}_loadSummonBanner(){if(this._summonBannerState="loading",this._renderBrowser(),!this._run){this._summonBannerState="error",this._renderBrowser();return}let e=this._summonBannerId;this._postJson("/summon-banner",{runId:this._run.runId,banner:e}).then(a=>{this._summonBannerId===e&&(a&&a.ok&&a.banner?(this._summonBanner=a,this._summonBannerState="ready",this._ensureBannerArt(a.banner)):this._summonBannerState="error")}).then(()=>{this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()})}_redoBannerArt(){this._paintBannerArt(this._summonBannerId,!0)}_ensureBannerArt(e){!e||!e.canArt||e.art||this._paintBannerArt(e.id,!1)}_paintBannerArt(e,a){!this._run||this._summonArting||!e||(this._summonArting=!0,this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:e,force:!!a})).then(r=>{if(this._summonBannerId===e&&r&&r.ok&&r.art&&this._summonBanner&&this._summonBanner.banner){this._summonBanner.banner.art=r.art;let s=(this._summonBanner.banners||[]).find(o=>o&&o.id===e);s&&(s.art=r.art)}}).catch(()=>{}).then(()=>{this._summonArting=!1,this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()}))}_closeSummonHistory(){this._summonHistoryOpen=!1,this._summonHistory=null,this._summonHistoryState="idle",this._summonHistoryPage=1}_loadSummonHistory(e){if(!this._run)return;let a=Math.max(1,Number(e)||1);this._summonHistoryPage=a,this._summonHistoryState="loading",this._renderBrowser();let r=this._summonBannerId;this._postJson("/summon/history",{runId:this._run.runId,banner:r,page:a}).then(s=>{!this._summonHistoryOpen||this._summonBannerId!==r||(s&&s.ok?(this._summonHistory=s,this._summonHistoryPage=Number(s.page)||a,this._summonHistoryState="ready"):this._summonHistoryState="error",this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser())})}_summonPull(e){if(!this._run||this._summonPulling)return;this._summonPulling=!0;let a=this._summonBannerId;this._postJson("/summon",{runId:this._run.runId,banner:a,count:e===10?10:1}).then(r=>{this._summonPulling=!1,r&&r.ok&&Array.isArray(r.results)&&(this._summonResults=r.results,this._summonBannerState="idle",this._summonBanner=null,this._closeSummonHistory(),this._rosterCount+=r.results.filter(s=>s&&s.isNew).length,this._summonPhase="reveal",this._renderBrowser())})}_openFormation(){this._formationBattleMode=!1,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_loadFormation(){if(this._formationState="loading",this._renderBrowser(),!this._run){this._formationState="error",this._renderBrowser();return}this._postJson("/formation",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._formation=e,this._formationState="ready"):this._formationState="error"}).then(()=>{this._hudView==="formation"&&this._renderBrowser()})}_saveFormation(e,a){this._run&&(this._formation&&(this._formation={...this._formation,presets:e,active:a}),this._postJson("/formation/save",{runId:this._run.runId,presets:e,active:a}).then(r=>{r&&r.ok&&Array.isArray(r.presets)&&this._formation&&(this._formation={...this._formation,presets:r.presets,active:r.active})}))}};typeof customElements<"u"&&!customElements.get(bn)&&customElements.define(bn,kr);
