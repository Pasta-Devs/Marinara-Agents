var bs=`
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
/* The pager sits UNDER the grid, inside the same column: it belongs to what is being listed. flex
   none so it never gives up its row, which is how it would vanish on a short panel. */
.hm-pk-pages { flex: none; display: flex; justify-content: center; align-items: center; gap: calc(var(--f) * 0.3); padding: 0 var(--sp-3) var(--sp-3); }
.hm-pk-page {
  min-width: calc(var(--f) * 2.2);
  padding: calc(var(--f) * 0.28) calc(var(--f) * 0.5);
  border: 1px solid var(--ink-3);
  background: transparent;
  color: var(--steel);
  font: inherit;
  font-size: var(--t-xs);
  cursor: pointer;
}
.hm-pk-page:hover { color: var(--text); border-color: var(--coral); }
.hm-pk-page.on { color: var(--text); border-color: var(--coral); background: var(--ink-3); }
.hm-pk-pages .gap { color: var(--steel-faint); font-size: var(--t-xs); padding: 0 calc(var(--f) * 0.2); }
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
`;var rt="vanguard",st=[{id:"aurora",label:"Aurora",description:"Frosted glass and gold",swatch:["#171334","rgba(255,255,255,.10)","#E8C87A"]},{id:"bloom",label:"Bloom",description:"Bright and playful",swatch:["#2B3F63","#FFFFFF","#FF6E9C"]},{id:"signal",label:"Signal",description:"Technical and minimal",swatch:["#0C0D10","rgba(255,255,255,.10)","#C8FF3D"]},{id:"ember",label:"Ember",description:"Warm and painted",swatch:["#2C1E14","#6B4A2A","#F0B429"]},{id:"vanguard",label:"Vanguard",description:"Sharp and industrial",swatch:["#0E1725","#1E2C44","#F2603C"]}];function ys(t){return st.some(e=>e.id===String(t))}function It(t){return ys(t)?String(t):rt}var Nt=[1,1.15,1.3,1.5,1.75],ws=1.15;function nt(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return ws;let a=Nt[0];for(let r of Nt)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}var Gt=Nt,nc=ws;function ot(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return nc;let a=Gt[0];for(let r of Gt)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}function f(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function he(t){return String(t||"").split(",")[0].trim()}function xs(t){return String(t??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60)}var oc='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',ic='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/></svg>',Pa='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',lc=Pa.replace("<svg ",'<svg class="glyph" '),cc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="11" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><path d="M6 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',dc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',ks=8,hc=(()=>{let r=Math.PI*2/ks,s=(o,i)=>(12+o*Math.cos(i)).toFixed(2)+" "+(12+o*Math.sin(i)).toFixed(2),n="";for(let o=0;o<ks;o+=1){let i=o*r;n+=(n?"L":"M")+s(9.2,i-r*.19)+"L"+s(9.2,i+r*.19)+"L"+s(6.6,i+r*.31)+"L"+s(6.6,i+r*.69)}return n+"Z"})(),pc=`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${hc}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>`;function Vt(t){let e=Math.max(0,Math.floor((Number(t)||0)/1e3)),a=Math.floor(e/60),r=e%60;return a+":"+String(r).padStart(2,"0")}function Ha(t){let e=Math.max(0,Math.floor((Number(t)||0)/1e3)),a=Math.floor(e/3600),r=Math.floor(e%3600/60),s=e%60;return String(a).padStart(2,"0")+":"+String(r).padStart(2,"0")+":"+String(s).padStart(2,"0")}function qe(t){return(Number(t)||0).toLocaleString("en-US")}var _s=new Set(["hud","modes","summon","roster","unit","formation","chapter","chapters","combat","farm","inventory","settings","events","achievements","shop"]),Ss=`
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
 /* THE TITLE SLOT YIELDS FIRST AND YIELDS WHOLE, and the zero BASIS is what makes that true: with
    AUTO its content counted toward the bar's base width, so a deficit was split with the group on
    its right instead of landing here. Basis zero keeps it growing into free space exactly as before
    and shrinking to nothing before anything else gives. */
.gf-bar-slot { display: flex; align-items: center; gap: var(--gf-sp-2); min-width: 0; flex: 1 1 0; overflow: hidden; }
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
/* THE GROUP DOES NOT SHRINK AT ALL, and dropping min-width was not enough -- it was measured on a
   player's machine: the box came out 282px for 300px of rigid children, so they SPILLED 18px and 2px
   of the fullscreen button fell outside the stage, which clips. The reason min-width AUTO did not
   hold is that a descendant of a chip carries overflow hidden, and that drops the group's
   min-content contribution to zero -- so shrink-to-fit was licensed after all. NONE states the
   rule instead of inferring it: what is PRESSED never yields, the title slot does. */
.gf-bar .currencies { display: flex; gap: var(--gf-sp-1); margin-left: auto; align-items: stretch; flex: none; }
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
`,Yt="1.7.0";function Es(t){if(!t)return"";let e=Array.isArray(t.items)?t.items:[];if(!e.length)return"";let a=Math.max(0,Math.round(Number(t.vigor)||0)),r=Math.max(1,Math.round(Number(t.vigorMax)||60)),s=e.map(o=>{let i=Math.max(0,Math.round(Number(o.held)||0));return'<div class="gf-vm-slot'+(i?" has":"")+'"><button class="gf-vm-card" type="button"'+(i?' data-vigor-use="'+f(o.id)+'"':" disabled")+">"+lc+'<span class="amt">+'+(Number(o.vigor)||0)+'</span><span class="what">'+f(o.name)+'</span></button><span class="gf-vm-n">&times;'+i+"</span></div>"}).join(""),n=e.every(o=>!(Number(o.held)>0))?'<span class="gf-vm-none">Sold in the Shop</span>':"";return'<div class="gf-vm" data-vigor-menu-panel><div class="gf-vm-veil" data-vigor-close></div><div class="gf-vm-panel"><div class="gf-vm-top"><h3 class="gf-vm-title">Vigor Items</h3><span class="gf-vm-now">'+Pa+"<b>"+a+"</b><span>/ "+r+' Vigor</span></span><button class="gf-vm-x" type="button" data-vigor-close aria-label="Close">Close</button></div><div class="gf-vm-grid">'+s+"</div>"+n+"</div></div>"}function As({username:t="",wallet:e=null,account:a=null,vigorNextMs:r=null}={}){let s=e&&typeof e=="object"?e:{},n=Number(s.aether)||0,o=Number(s.funds)||0,i=Number(s.vigor)||0,c=Number(s.vigorMax)||60,l=a||null,d=l?Math.max(1,Number(l.level)||1):1,h=l?l.xpNeeded?qe(Number(l.xp)||0)+" / "+qe(l.xpNeeded)+" XP":"MAX":"&mdash;",v=l&&Number(l.xpNeeded)||0,u=l?v>0?Math.max(0,Math.min(100,Math.round((Number(l.xp)||0)/v*1e3)/10)):100:0,g=Number.isFinite(r)?Vt(r):"",y=t&&t.trim()||"Commander",b=y.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"C";return`
<header class="gf-bar">
  <div class="command">
    <div class="avatar">${f(b)}</div>
    <div class="rank"><span data-bar-rank>${d}</span><small>RANK</small></div>
    <div class="xp">
      <div class="figure"><span>${f(y)}</span><span data-bar-rankxp>${h}</span></div>
      <div class="xp-bar"><i data-bar-rankfill style="width:${u}%"></i></div>
    </div>
  </div>

  <div class="gf-bar-slot" data-bar-slot></div>

  <div class="currencies">
    <div class="currency aet">${oc}<div><div class="value" data-bar-aether>${qe(n)}</div></div></div>
    <div class="currency">${ic}<div><div class="value" data-bar-funds>${qe(o)}</div></div></div>
    <button class="currency vig" type="button" data-vigor-menu aria-label="Use a Vigor item" title="Use a Vigor item">${Pa}<div class="value"><span data-bar-vigor>${i}</span><span class="dim" data-bar-vigormax>/${c}</span></div><span class="refill" data-vigor-next>${g}</span></button>
    <button class="icon-button gf-runs-bar" type="button" data-open-runs aria-label="Worlds" title="Switch or start a world">${cc}</button>
    <button class="icon-button" type="button" aria-label="Game settings">${pc}</button>
    <button class="icon-button gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">${dc}</button>
  </div>
</header>`}function Ts(t,{onToggle:e,onUse:a,onClose:r}={}){if(!t)return!1;let s=t.querySelector("[data-vigor-menu]");if(!s)return!1;if(e&&s.addEventListener("click",()=>e()),r)for(let n of t.querySelectorAll("[data-vigor-close]"))n.addEventListener("click",o=>{o.stopPropagation(),r()});if(a)for(let n of t.querySelectorAll("[data-vigor-use]"))n.addEventListener("click",o=>{o.stopPropagation(),a(n.getAttribute("data-vigor-use"))});return!0}function Ns(t,{wallet:e=null,account:a=null,vigorNextMs:r=void 0}={}){if(!t||typeof t.querySelector!="function")return!1;let s=c=>t.querySelector(c);if(!(s("[data-bar-aether]")?t:null))return!1;let o=(c,l)=>{let d=s(c);d&&d.textContent!==l&&(d.textContent=l)},i=e&&typeof e=="object"?e:null;if(i&&(o("[data-bar-aether]",qe(Number(i.aether)||0)),o("[data-bar-funds]",qe(Number(i.funds)||0)),o("[data-bar-vigor]",String(Number(i.vigor)||0)),o("[data-bar-vigormax]","/"+(Number(i.vigorMax)||60))),r!==void 0){let c=s("[data-vigor-next]");if(c){let l=Number.isFinite(r)?Vt(r):"";c.textContent!==l&&(c.textContent=l)}}if(a){let c=Math.max(1,Number(a.level)||1),l=Number(a.xpNeeded)||0;o("[data-bar-rank]",String(c)),o("[data-bar-rankxp]",l>0?qe(Number(a.xp)||0)+" / "+qe(l)+" XP":"MAX");let d=s("[data-bar-rankfill]");if(d&&d.style){let h=l>0?Math.max(0,Math.min(100,Math.round((Number(a.xp)||0)/l*1e3)/10)):100;d.style.width=h+"%"}}return!0}function Is(t,{nextMs:e,periodMs:a,onLanded:r}={}){if(!Number.isFinite(e))return()=>{};let s=Number(e),n=Number(a)>0?Number(a):0,o=Date.now()+s,i=()=>{let l=t&&t.querySelector?t.querySelector("[data-vigor-next]"):null;if(!l)return;let d=o-Date.now();if(d>0){l.textContent=Vt(d);return}o=n?Date.now()+n:Date.now(),l.textContent=n?Vt(n):"",r&&r()};i();let c=setInterval(i,1e3);return()=>clearInterval(c)}function Rs(t){let e=t.querySelector&&t.querySelector("[data-bar-slot]");if(!e||typeof e.appendChild!="function")return!1;let a=t.querySelector(".head")||t.querySelector(".cap-head")||t.querySelector(".sel-head");if(!a||!a.childNodes)return!1;for(;e.firstChild;)e.removeChild(e.firstChild);let r=a.parentElement,s=[];for(let o of Array.from(a.childNodes))o.classList&&o.classList.contains("gf-stay")?s.push(o):e.appendChild(o);for(let o of s)r&&typeof r.appendChild=="function"&&r.appendChild(o);let n=typeof e.querySelectorAll=="function"?e.querySelectorAll(".eyebrow"):null;if(n&&typeof n.length=="number")for(let o=n.length-1;o>=0;o-=1){let i=n[o];i&&typeof i.remove=="function"&&i.remove()}return typeof a.remove=="function"&&a.remove(),!0}var fc=[["New","new","g-new"],["Changed","changed","g-changed"],["Bugfix","fixed","g-fixed"]],Rt=5;function Kt(t){let e=uc(),a=Math.max(Rt,Math.floor(Number(t)||0));return{releases:e.slice(0,a),hidden:Math.max(0,e.length-a)}}function uc(){return vc.map((t,e)=>({version:t.version||Yt,now:e===0,body:fc.map(([a,r,s])=>{let n=Array.isArray(t[r])?t[r]:[];return n.length?'<div class="gf-log-grp '+s+'"><span class="k">'+a+":</span><ul>"+n.map(o=>"<li>"+f(o)+"</li>").join("")+"</ul></div>":""}).join("")}))}var vc=[{version:null,new:["A whole chapter's scenes can be written in advance, so they open with no wait. The chapter screen counts them as they land, and you can stop it or start it again.","If you leave a scene halfway through, you can pick it up where you left off instead of reading it from the start.","Each banner now runs smaller side events alongside it, with rewards of their own.","Tidewalk: roll a die to move around a ring of prizes. A new die arrives every six hours.","Salvage Bingo: Materials runs earn marks, and each mark turns over a square on your card.","Supply Line: the first three Materials runs of the day come back with double the loot.","Seasonal Event: draw ten times at once.","Seasonal Event: each character from the banner in your party earns you 25% more event coin.","Seasonal Event: a boss you can beat once a day for 480 coin.","Seasonal Event: rewards for the total coin you earn, at five milestones.","Items and rewards show a picture of the thing itself instead of a symbol.","The login week shows what each day pays before you claim it.","The event box shows what is inside each stack, and how much of it is left.","Each connection now generates one thing at a time, and whatever you are waiting for goes first, so background work never gets in your way.","The Battle Pass ladder can be dragged with the pointer.","Cast books can name a character's role and element.","Help now covers outfits and key images, and lists every value a cast-book macro takes."],changed:["Your persona can be moved around the party, and taken out of it.",'Character names are capitalised, so "the man in the gray coat" reads as a name.',"The settings button is a gear now, instead of something closer to a brightness control.","Buttons in world creation use the typeface of the style you picked.","Key images stay closer to the scene they illustrate.","Key image prompts are written the way your image model expects them.","A new author directive lets you say how key images should be described.","Text boxes tell you how much room is left in them.","The debug list says why a call failed, not only that it did.","The Reasoning Effort and Verbosity set on your connection are used.","On a big screen the help and updates panels beside the game are wider, so their text is readable instead of wrapping into slivers."],fixed:["Your Home decoration and your context warning no longer revert on their own.","The top bar no longer cuts off the buttons on its right.","The Home no longer sends you back to Chapter One.","The arrow on a dropdown in world creation no longer vanishes while the list is open.","The options list in world creation now shows that it scrolls, so nothing hides below it.","World creation follows the letter size you chose.","Battle Pass: an Aether bonus you have already claimed is readable again.","Seasonal boxes now hold Tenets, not only the Mandate that unlocks what Tenets pay for.","The standard banner always holds one weapon of every type, and a world made before that rule gets its missing one minted.","Re-opening a chapter no longer claims it is being written.","Fewer answers are lost when a model spends its budget thinking.","A settings lookup that hangs can no longer freeze a generation.","Help lists all five kinds of writing rule, not two.","The battle screen no longer slides sideways when you scroll or swipe."]},{version:"1.6.0",new:["Key images can be your Home background","Optionally let a worn outfit count as story canon","Combine old compressed chapters into one memory","Changelog opens five versions at a time","Key images: a big story moment can take over the scene","How often, per world: a slider from Off to every beat"],changed:["Background and unit pickers now come in pages","Each character in a key image does their own thing","Seasonal Event: 100 Aether a stack, was 50","The story stops crowding every scene with heroes","Heroes take turns instead of all appearing at once","Chapters no longer spoil themselves","Node titles show once you reach them","Look: the art switches sit together, under one title","Key images: heroes dress for the scene","Key images: only who is really in the picture","A half-made world waits for you instead of restarting itself","Portrait studio: edit the look, the tags follow"],fixed:["A long world description no longer breaks the loading screen","Two characters doing the same thing are both drawn doing it","Key images drawn from behind no longer turn to face you","Key images frame the moment instead of posing the cast","Key images now use the character's own clothes","Scenes no longer pull in heroes the chapter left out","Levelling with no Funds no longer eats your Insight","Level up says what a level costs, not just your balance","Deleting a world now takes its key images and outfits with it","Key images no longer ignore the scene they illustrate","Chapter numbers no longer clip at large text","An empty lorebook budget means the default, not zero","The key-images slider keeps your number in Settings","Key images draw everyone in the scene, not just heroes","World creation accepts more ways of writing the same thing","When creation fails, it now says why","Cancelling world creation responds right away","Settings: the key-images slider fills its row","Models that think hard no longer run out of room mid-answer"]},{version:"1.5.1",fixed:["World creation can always be cancelled"]},{version:"1.5.0",new:["Outfits can be switched off per world","Your Home can wear an outfit","Thoughts look different from speech","Advanced: your own rules for the writer","Story rules that span chapters","World lorebooks can feed story scenes too","Journey to a New World: 1,600 Aether a day for your first week","Seasonal Event: a box gacha","Achievements: ladders that pay Aether","A dot marks anything to claim","Every summon now pays something","A Shop, paid in Glimmer","Vigor potions in your bag","Prose can use a cheaper model","So can chapter compression","Help: lorebooks, macros, connections","The Home tells you what to do next","The featured banner is ready the moment it unlocks","The next featured is forged a day before the current ends","Summon: a history of your pulls, page by page","Every pull records the pity it landed on","Outfits: a second look, 60 Glimmer","Two new outfits every rotation","The Shop sells outfits from rank 15","Won relics show their four sub-stats"],changed:["The background follows the scene","The story wait shows its progress","Forging a chapter draws no art","Insight now gives twice the XP","The story backlog opens at the latest line","The speaker portrait no longer touches its name tag","Heroes may share a past you wrote for them","Help covers the newer screens","Lorebooks reach the story again","Deleting a world says what you lose","Claim dots update right away","Commander rank: no ceiling, steeper cost","Ranking up hands you 20 Vigor","Story fights cost 5 Vigor, was 8","Later chapters ask for less CP","New worlds start with no Aether","New worlds no longer start with free Insight","Faster, steadier world creation","World creation shows its progress","New worlds open with a prologue","Seasonal Event names the banner it runs with","Seasonal boxes now hold Insight","Chapters 1-3 fight smaller enemy bands","Enemies spread their attacks instead of ganging up","Tanks now draw enemy fire","Achievements pay 160 Aether a step","Enemies now vary their stat lines","Materials give a bit less","5-star relics reveal their fourth sub-stat as you level them","Each reinforcement now rolls high or low, like the genre does","5-star relics now level to +20, with five reinforcements"],fixed:["The outfit wheel turns to the right","Battle fits a phone screen","Unit art stays inside its frame","Fullscreen no longer covers Skip","A shortened name keeps its portrait","A place is drawn once, not once a chapter","World creation no longer stalls on a name","Your hero's face follows your Persona again","Banked XP now levels up on its own button","New worlds open with their prologue again","The Summon banner news shows right after the prologue","Locked events no longer pay out early","The login event no longer pops before rank 5","A finished next step clears without a refresh","World creation can be cancelled if it gets stuck","Debug now shows which model answered each call","Deleting a world now removes its art too","Hard wins now count towards their ladder","Battle Pass missions no longer sit under the Claim button","Chapter 1 is beatable with your first unit","Passives now say what they do","Help topics stop jumping around","A bad rarity tag no longer eats a character","Effect hit finally does something","New worlds now start with their Insight in the bag","Using a potion updates your bag right away","Outfits tab on every hero sheet","A new chapter always opens on Normal","Summoning and ascending can no longer charge twice","Poison goes through shields again","Hostile passives now hit the enemy, not your own team","Reloading no longer empties the outfit shelf","A refused fight now says why","Outfit directives show up in Settings","Redoing banner art keeps your Home background"]},{version:"1.3.0",new:["Inventory screen","Gear: weapons and relics","Form: three skill tracks","Facets for duplicates","Relic Vault and Tenet Trial open","Events, login and battle pass","Help Q&A in the rail"],changed:["Bigger text on unit cards"],fixed:["Unit levels update right away","Worlds list shows real progress","Story rewards always save"]},{version:"1.2.0",new:["Story chapters","Visual-novel narrator","Painted story locations","Continuity and compression"],changed:["Insight now farmed in Materials","Materials made roomier"],fixed:["Backlog readable in every style","Coin figures no longer clipped","World creation more reliable"]},{version:"1.1.0",new:["Materials farming","Formation","Level up and ascend"],changed:["Difficulty actually differs"],fixed:["Level cap could get stuck"]},{version:"1.0.0",new:["Forge a world from lorebooks","Banners and summoning","Unit roster and sheets"]}];var Cs=[{id:"start",label:"Getting started"},{id:"summon",label:"Summoning"},{id:"units",label:"Your units"},{id:"fight",label:"Fights and farming"},{id:"story",label:"Story and events"}],mc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';function Xt(t,e){return'<details class="gf-faq-q" data-help="'+f(t.id)+'"'+(e?" open":"")+'><summary><span class="ic">'+mc+'</span><span class="q">'+f(t.q)+'</span></summary><p class="a">'+f(t.a)+"</p></details>"}function Ls(t){return Da.filter(e=>e.topic===t)}var Da=[{id:"about",topic:"start",q:"What is Gacha Forge?",a:"A gacha game built out of your own lorebooks. The model writes the cast, you pull for them on banners, and you take the ones you get through story chapters and farming runs."},{id:"lore",topic:"start",q:"What are lorebooks for?",a:"Tick World and the forge reads what is true about the place \u2014 constant entries always, plus any whose keys come up \u2014 to 6,000 tokens. Tick Cast and it takes one entry per character it mints, from the ones it has not used yet."},{id:"loremacros",topic:"start",q:"What are the book macros?",a:"Four, and they all go in an entry's Description. [5STAR] or [4STAR] puts that character in a rarity slot; [ORDER1], [ORDER2] and so on pick who goes first inside a rarity, lowest first; [ROLE:MAGE] and [AFFINITY:FIRE] ask the forge to mint that sheet with that role and element. Case does not matter, and a value the game does not have is ignored instead of failing."},{id:"enums",topic:"units",q:"Which roles and elements are there?",a:"Five roles are Tank, Warrior, Mage, Support and Assassin. Six elements are Fire, Water, Wind, Earth, Light and Dark. Every unit card shows one of each, and they are the values the book macros [ROLE:X] and [AFFINITY:X] take."},{id:"connections",topic:"start",q:"What is each connection for?",a:"Main connection builds your cast and the chapter plan. Narrator connection writes the prose, Compression connection summarises old chapters. Both can be a smaller model; empty means the main one."},{id:"summon",topic:"summon",q:"How do I get characters?",a:"You pull for them on a banner, in Summon. Each pull costs 160 Aether, so a ten-pull costs 1,600."},{id:"pity",topic:"summon",q:"What is pity?",a:"It stops a long dry streak. You are guaranteed a 4\u2605 or better every 10 pulls, and a 5\u2605 by your 80th. Each banner counts your pulls on its own."},{id:"featured",topic:"summon",q:"How long is a featured banner?",a:"It runs for 14 days, counted from the day it shows up. When it ends, its units are added to the permanent banner, so you can still pull them later."},{id:"dupes",topic:"summon",q:"What are duplicates for?",a:"Every extra copy of a character unlocks one of their 6 Facets, and each one changes how their kit behaves. Once they are all open, and for a repeated weapon, you get Glimmer instead."},{id:"glimmer",topic:"summon",q:"What is Glimmer?",a:"What a summon leaves behind when it has nothing else to give you. Spend it in the Shop."},{id:"vigor",topic:"fight",q:"What is Vigor?",a:"Your stamina. Every fight costs some, and you get 1 point back every 3 minutes, which is 480 a day. It stops at 60, and that limit goes up by 1 each time your commander rank does."},{id:"events",topic:"story",q:"What are Events?",a:"Extra ways to earn, separate from the story and each on its own clock. Some rotate or end, so a dot on the tab is worth opening."},{id:"aether",topic:"story",q:"Where does Aether come from?",a:"Mostly from Events, several of them, each on its own clock \u2014 and from Achievements. Story and combat nodes pay 100 each, which is a small share next to those."},{id:"levelcap",topic:"units",q:"Why won't a unit level up?",a:"Something is capping it. Ascending a unit raises its own limit through 20, 40, 50, 60, 70, 80, 90 \u2014 and on top of that, no unit can pass twice your commander rank."},{id:"materials",topic:"fight",q:"Where do materials come from?",a:"From Materials, inside Battle. There are 5 stages and 3 difficulties, costing 6, 8 and 10 Vigor a run. The harder ones give you less of a better material, and every card tells you what its run is worth."},{id:"gear",topic:"units",q:"Weapons or relics?",a:"Both, and they work differently. You choose a weapon on purpose, for its stat and because a 5\u2605 signature gives its owner a second skill. Relics are the random half: 4 slots, each rolling a main stat plus 4 subs."},{id:"outfits",topic:"units",q:"What are outfits?",a:"Alternate looks for units you own, drawn by your image connection. The Shop mints 2 each banner rotation and sells them for 60 Glimmer each. Equipping one changes what that unit wears everywhere, including in the story."},{id:"form",topic:"units",q:"What is Form?",a:"It is how you train a unit's skills. There are three tracks \u2014 Ultimate, Passive and the weapon skill \u2014 and each goes up 10 levels, for 30% more at the end."},{id:"mandate",topic:"story",q:"Where do Mandates come from?",a:"Only from Events, and nothing else drops them. They come slowly, and you need them for the last steps of Form."},{id:"combat",topic:"fight",q:"How does a fight work?",a:"Your team fights on its own, so what matters is who you bring. Fire beats Water beats Wind beats Earth beats Fire, and Light and Dark beat each other. A good matchup hits for 1.5x, a bad one for 0.75x."},{id:"cp",topic:"units",q:"What is CP?",a:"A rough score for how strong a unit is with everything it is carrying. Stages tell you the CP they expect: Materials asks for 2,000, then 80,000, then 200,000."},{id:"story",topic:"story",q:"Does replaying a beat cost?",a:"No. Once you have paid for a story beat you can reopen it as often as you like. Only a node you have not played costs Vigor: 5 for a story one, 5 for a fight."},{id:"cg",topic:"story",q:"What are key images?",a:"An illustration the story stops on when a moment earns one. A slider in Settings decides how often one may be offered, from every beat up to one every 10; the writer still declines the ones it does not want."},{id:"preforge",topic:"story",q:"Can chapters be written ahead?",a:"Off until you turn it on, per world, in Settings under Continuity. A forged chapter then writes all of its beats at once, so every scene opens with no wait \u2014 its menu stays shut while it works, and you can cancel."},{id:"context",topic:"story",q:"What is the context warning?",a:"It means your story is getting too long to fit in one prompt. Open Settings and use Continuity to compress the older chapters into a summary."},{id:"directives",topic:"story",q:"Can I give the writer rules?",a:"Yes. In Settings, under Advanced: five sets of them, for the whole arc, a chapter, a beat, a key image and an outfit. The writer follows them over its own guidance, from the next chapter on."},{id:"dot",topic:"start",q:"What is the dot?",a:"Something on that screen is waiting to be claimed. It clears itself once you have taken everything."},{id:"art",topic:"start",q:"Where does the art come from?",a:"Whichever image connection you picked when you made the world draws it: unit portraits, banner art, story backgrounds, outfits and the story's key images. You can turn it off in Settings, under Sources."}];var gc={help:"left",changelog:"right"},Ms=`

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
  /* Width handed to the rails: the stage YIELDS it, so a gutter is not just what was left over.
     Zero unless the query below grants it -- see why the grant is a STEP and not a ramp. */
  --gf-rail: 0px;
  height: min(100cqh, calc((100cqw - var(--gf-rail) * 2) * 9 / 16));
  width: auto;
  aspect-ratio: 16 / 9;
  max-width: 100%;
  justify-self: center;
  background: var(--ink);
  border: 1px solid var(--steel-dark);
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45);
}

/* THE RESERVE IS 0 OR USEFUL, NEVER IN BETWEEN: under 140px a rail hides its own content, so a
   ramp from zero would shrink the game to feed a rail that is not drawing. */
@container gfarena (min-width: 1600px) {
  .gf-stage { --gf-rail: clamp(150px, (100cqw - 1300px) / 2, 300px); }
}

/* Never widen past 16:9: widening does not grant height, it eats it. Every screen is built for 16:9. */
.gf-view { position: relative; flex: 1; min-height: 0; }


/* The HOST goes fullscreen, so it survives inner re-renders. */
:host(:fullscreen) .gf-arena { grid-template-columns: 1fr; padding: 0; }
:host(:fullscreen) .gf-gutter { display: none; }
/* Fullscreen KEEPS the ratio. Filling and fitting are identical on a 16:9 monitor, which is why
   this hid for so long; on a landscape phone filling squashes the height. */
/* No rails in fullscreen, so no reserve either: yielding width to a gutter that is display:none
   is what stopped the stage from filling the screen. */
:host(:fullscreen) .gf-stage { border: 0; --gf-rail: 0px; }

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
/* The rail is ~152px, so this label wraps: it is sized and spaced to wrap READABLY rather than to
   fit on one line, which at this width would mean shrinking it out of legibility. */
.gf-log-more { flex: none; width: 100%; background: var(--ink-2); border: 1px solid var(--ink-3); color: var(--text); font-family: var(--display); font-weight: 700; font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1.35; text-align: left; padding: 0.45rem 0.55rem; cursor: pointer; }
.gf-log-more:hover { border-color: var(--coral); color: var(--coral); }
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
`,qa='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',bc='<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1" y="1" width="12.5" height="22" rx="2"/><rect x="18.5" y="6.5" width="14.5" height="11" rx="1.8"/><path d="M15.4 7.6a6 6 0 0 1 2.6-2.4" stroke-dasharray="2.2 1.8"/><path d="M18.4 4.2l-1 2 2.1.5"/></svg>',yc=`
  <div class="gf-rot">
    <span class="gf-rot-ph">${bc}</span>
    <h3 data-rot-title>Landscape only</h3>
    <p data-rot-note>This game plays in a 16:9 landscape frame.</p>
    <button type="button" data-go-landscape>Play in landscape</button>
  </div>`;function wc(t){let e=a=>!!(t&&typeof t.has=="function"&&t.has(a));return'<div class="gf-faq">'+Da.map(a=>Xt(a,e(a.id))).join("")+"</div>"}function Os(t,e){let a=e&&e.onToggle;if(!(!a||!t||typeof t.querySelectorAll!="function"))for(let r of t.querySelectorAll("details[data-help]"))r.addEventListener("toggle",()=>a(r.getAttribute("data-help"),!!r.open))}function xc(t){let e=Kt(t);return'<div class="gf-log">'+e.releases.map(a=>'<section class="gf-log-rel'+(a.now?" now":"")+'"><div class="ver">'+f(a.version)+"</div>"+a.body+"</section>").join("")+(e.hidden>0?'<button class="gf-log-more" type="button" data-log-more>Show previous version changelog</button>':"")+"</div>"}function Bs(t,e){let a=It(e&&e.style),r=e&&e.entering?" data-enter":e&&e.swapping?" data-swap":"",s=gc[e&&e.onScreen||""]||"";return`
<div class="gf-arena" data-style="${a}">
  ${yc}
  <aside class="gf-gutter">
    ${s==="left"?"":`<div class="gf-gutter-title">Help</div>${wc(e&&e.help)}`}
  </aside>

  <div class="gf-stage">
    ${e&&e.bar?"":`<button class="gf-fs-exit" type="button" title="Fullscreen" aria-label="Toggle fullscreen">${qa}</button>`}
    ${e&&e.bar||""}
    <div class="gf-view"${r}>${t}</div>
    ${e&&e.overlay||""}
  </div>

  <aside class="gf-gutter">
    ${s==="right"?"":`<div class="gf-gutter-title">Changelog</div>${xc(e&&e.logShown)}`}
  </aside>
</div>
<style>${Ss}</style>`}var kc="marinara_admin_secret";function _c(){try{if(typeof localStorage>"u")return{};let t=(localStorage.getItem(kc)||"").trim();return t?{"X-Admin-Secret":t}:{}}catch{return{}}}function ge(t,e){let a=e&&typeof e=="object"?e:{};return fetch(t,{...a,headers:{..._c(),...a.headers||{}}})}var zs=`
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
  /* --f-text IS --f CARRYING THE PLAYER'S SCALE, and it exists for ONE thing: a box whose whole
     content is text. Sized on --f, the glyph grows with the scale and the box does not, so the
     number is cut with room to spare beside it -- measured at 175%: the chapter plate lost 8px
     wide and 14 tall, the difficulty marks 5, the node number 2. Everything that is LAYOUT stays
     on --f: this is the exception for the boxes that are a letter and a border. */
  --f-text: calc(var(--f) * var(--gf-type-scale, 1));
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
  /* 0px and not 0: a UNITLESS zero is fine for border-radius but makes any max()/min()/clamp() that
     reads the token INVALID, which silently drops the whole declaration. It cost a padding that was
     not small but ZERO, in vanguard only -- the one style that does not override these. */
  --radius: 0px;
  --radius-sm: 0px;
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
`;var Jt={funds:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/></svg>',xp:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.2 5 5.3.5-4 3.6 1.2 5.3L12 14.7 7.3 17.4l1.2-5.3-4-3.6L9.8 8z"/></svg>',asc:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',relic:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3h8l4 6-8 12L4 9z"/><path d="M4 9h16M8 3l-1 6 5 12 5-12-1-6"/></svg>',aether:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 4 12l8 10 8-10z"/><path d="M4 12h16M12 2v20"/></svg>',form:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M8.5 7.5h6M8.5 11h4"/></svg>',mandate:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M9.6 9.2l1.7 1.7 3.1-3.4"/><path d="M8 13.4 6.5 21l5.5-2.6L17.5 21 16 13.4"/></svg>',potion:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M10 3h4v4.2l3.6 8.3A3.5 3.5 0 0 1 14.4 21H9.6a3.5 3.5 0 0 1-3.2-5.5L10 7.2z"/><path d="M9 3h6M7.4 14.5h9.2"/></svg>',glimmer:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z"/><path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z"/></svg>',rank:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.6 5.6L21 9.4l-4.5 4.3 1.1 6.3L12 17l-5.6 3 1.1-6.3L3 9.4l6.4-.8z"/></svg>'};function Q(t){return Jt[String(t)]||Jt.funds}var Sc=3;var Ec=[20,40,50,60,70,80,90],gu=Ec.length-1;var ja=[{id:"shard",name:"Insight Shard",xp:200},{id:"core",name:"Insight Core",xp:1e3},{id:"prism",name:"Insight Prism",xp:5e3}],Ac=t=>(ja.find(e=>e.id===t)||{xp:0}).xp,$a=(t,e)=>({tier:t,qty:e,worth:e*Ac(t)}),bu={1:$a("shard",12),2:$a("core",6),3:$a("prism",2)},it=(t,e)=>({tier:t,qty:e,worth:e*Math.pow(Sc,t-1)}),yu={1:it(1,3),2:it(2,2),3:it(3,1)},wu={1:it(1,3),2:it(2,2),3:it(3,1)};var Zt=[{id:"key",label:"Key Items",live:!0},{id:"outfit",label:"Outfits",live:!0,unlock:"outfits"}];var lt=[{id:"vigor-s",cat:"key",name:"Vigor Draught",grants:{vigor:20},price:8,live:!0,bag:!0},{id:"vigor-m",cat:"key",name:"Vigor Flask",grants:{vigor:40},price:14,live:!0,bag:!0},{id:"vigor-l",cat:"key",name:"Vigor Decanter",grants:{vigor:60},price:20,live:!0,bag:!0},{id:"coupon",cat:"key",name:"Summon Coupon",grants:{summon:1},live:!1,note:"Not open yet"},{id:"solvent",cat:"key",name:"Relic Solvent",grants:{reroll:1},live:!1,note:"Not open yet"}];function Qt(t){let e=t&&t.grants||{};return e.vigor?"+"+e.vigor+" Vigor":e.summon?"One free summon":e.reroll?"Reroll a relic's substats":e.outfit?"A new look for your cast":""}function Fs(t){return!t||t.live===!1?null:Math.max(1,Math.round(Number(t.price)||0))}var Ua=t=>lt.filter(e=>e.cat===t),ea=lt.filter(t=>t.bag===!0);var Tc="/api/capability-packages/gacha-forge/assets/",Nc=new Set(ja.map(t=>String(t.id))),Ic=new Set(lt.filter(t=>t&&t.bag===!0).map(t=>String(t.id))),Rc=["funds","aether","glimmer","rank","coin-event","relic"],Cc=["core","edge","flow","crest"],Lc=new Set(Rc),Mc=new Set(Cc),Oc=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function Bc(t){let e=String(t??"").trim().toLowerCase();if(!e)return"";if(Nc.has(e))return"item-insight-"+e+".webp";if(Ic.has(e)||Lc.has(e))return"item-"+e+".webp";let a=e.split(":");return a.length===2&&a[0]==="relic"&&Mc.has(a[1])?"item-relic-"+a[1]+".webp":a.length!==3||!a.every(r=>/^[a-z0-9_-]+$/.test(r))?"":"item-"+a.join("-")+".webp"}function zc(t){let e=Bc(t);return e?Tc+e:""}function fe(t,e){let a=zc(t);return a?'<img class="item-art" src="'+a+'" alt="'+Oc(e||"")+'" loading="lazy" decoding="async">':""}var Ds=[{id:"newworld",kind:"newworld",label:"Journey to a New World",note:"Your first 7 days",live:!0},{id:"login",kind:"login",label:"7 Day Login Event",note:"Permanent",live:!0},{id:"pass",kind:"pass",label:"Battle Pass",note:"Season \xB7 30 days",live:!0},{id:"seasonal",kind:"seasonal",label:"Seasonal Event",note:"Rotates with the banner",live:!0}];var Fc=7,ta=160,Ps=ta*10,Au=Array.from({length:Fc},(t,e)=>({day:e+1,aether:Ps,extra:{kind:"aether",qty:Ps,name:"Aether"}}));var qs=30,Tu=qs*24*60*60*1e3,Wa=80;var Ga={"farm-clear":{one:"Clear a Materials stage",many:"Clear N Materials stages"},"node-clear":{one:"Clear a combat node",many:"Clear N combat nodes"},"story-clear":{one:"Play a story node",many:"Play N story nodes"},summon:{one:"Summon once",many:"Summon N times"},"level-up":{one:"Level a unit once",many:"Level a unit N times"},"form-up":{one:"Train an ability once",many:"Train an ability N times"},ascend:{one:"Ascend a unit",many:"Ascend a unit N times"},"relic-feed":{one:"Reinforce a relic",many:"Reinforce a relic N times"},"vigor-spent":{one:"Spend 1 Vigor",many:"Spend N Vigor"}};function $s(t){let e=Ga[t&&t.kind];if(!e)return"";let a=Math.max(1,Math.round(Number(t&&t.need)||1));return a===1?e.one:e.many.replace("N",String(a))}var Pc=5,Hc=1e3,Dc=[20,40,60,75],qc=t=>t<=26?{tier:"shard",qty:3,name:"Insight Shard"}:t<=53?{tier:"core",qty:2,name:"Insight Core"}:{tier:"prism",qty:1,name:"Insight Prism"},$c=t=>t<=26?1:t<=53?2:3;var Hs=["funds","xp","sigil","doctrine","tenet"],jc=(()=>{let t=[],e={};for(let a=1;a<=Wa;a+=1){let r=a%Pc===0?Hc:0;if(a===Wa){t.push({level:a,aether:r,extra:{kind:"relic",qty:1,rarity:5,name:"5&#9733; Relic"},prize:!0});continue}if(Dc.includes(a)){t.push({level:a,aether:r,extra:{kind:"mandate",qty:1,name:"Mandate"},prize:!0});continue}if(r){t.push({level:a,aether:r,extra:{kind:"aether",qty:r,name:"Aether"}});continue}let s=Hs[t.filter(n=>!n.aether&&n.extra.kind!=="mandate").length%Hs.length];if(e[s]=(e[s]||0)+1,s==="funds")t.push({level:a,aether:r,extra:{kind:"funds",qty:8e3,name:"Funds"}});else if(s==="xp"){let n=qc(a);t.push({level:a,aether:r,extra:{kind:"xp",tier:n.tier,qty:n.qty,name:n.name}})}else{let n=s==="tenet"?2:4;t.push({level:a,aether:r,extra:{kind:s,qty:n,tier:$c(a),pick:e[s]-1}})}}return t})(),$e=[{difficulty:1,label:"Easy",vigor:6,coin:60,cp:2e4},{difficulty:2,label:"Normal",vigor:8,coin:90,cp:1e5},{difficulty:3,label:"Hard",vigor:10,coin:120,cp:2e5},{difficulty:4,label:"Boss",vigor:10,coin:480,cp:33e4,daily:!0}],js=800,aa=[{coin:1e3,prize:{kind:"aether",qty:200}},{coin:3e3,prize:{kind:"aether",qty:400}},{coin:6e3,prize:{kind:"glimmer",qty:50}},{coin:1e4,prize:{kind:"aether",qty:800}},{coin:15e3,prize:{kind:"mandate",qty:1}}];var Ye=40,ze=10,Us=.25;var Ct=10,Re=(t,e,a,r,s,n=0,o=null)=>[{kind:"aether",qty:100,count:t},{kind:"funds",qty:3e3,count:e},...o?[{kind:"xp",...o,count:Wc}]:[],{kind:"material",tier:2,qty:1,count:a},{kind:"material",tier:1,qty:1,count:r},...n?[{kind:"mandate",count:n}]:[],...s],Uc=new Set([3,5,7]),_e=t=>Uc.has(t)?1:0,Wc=8,Ce=()=>3,Le=t=>4-_e(t),Me=t=>t<=4?{tier:"shard",qty:6,name:"Insight Shard"}:t<=8?{tier:"core",qty:3,name:"Insight Core"}:{tier:"prism",qty:1,name:"Insight Prism"},Ws=[Re(7,5,Ce(),Le(1),[{kind:"potion",id:"vigor-s",count:3}],_e(1),Me(1)),Re(7,5,Ce(),Le(2),[{kind:"potion",id:"vigor-s",count:3}],_e(2),Me(2)),Re(7,5,Ce(),Le(3),[{kind:"potion",id:"vigor-s",count:2},{kind:"potion",id:"vigor-m",count:1}],_e(3),Me(3)),Re(7,5,Ce(),Le(4),[{kind:"potion",id:"vigor-s",count:2},{kind:"potion",id:"vigor-m",count:1}],_e(4),Me(4)),Re(7,5,Ce(),Le(5),[{kind:"potion",id:"vigor-m",count:3}],_e(5),Me(5)),Re(7,5,Ce(),Le(6),[{kind:"potion",id:"vigor-m",count:3}],_e(6),Me(6)),Re(7,5,Ce(),Le(7),[{kind:"potion",id:"vigor-m",count:2},{kind:"potion",id:"vigor-l",count:1}],_e(7),Me(7)),Re(7,5,Ce(),Le(8),[{kind:"potion",id:"vigor-m",count:2},{kind:"potion",id:"vigor-l",count:1}],_e(8),Me(8)),Re(7,5,Ce(),Le(9),[{kind:"potion",id:"vigor-l",count:3}],_e(9),Me(9)),Re(7,5,Ce(),Le(10),[{kind:"potion",id:"vigor-l",count:3}],_e(10),Me(10))];var Gc=ta*10,Va={summon:{title:"Summon unlocked",body:"Spend Aether to pull for new heroes and weapons.",gift:Gc,giftLabel:"Prologue complete reward"},events:{title:"Events unlocked",body:"Complete each event's objectives to earn its rewards."},featured:{title:"Featured banner unlocked",body:"A banner that changes every 14 days, with better odds on its rate-up units."},seasonal:{title:"Seasonal Event unlocked",body:"Your main source of Aether."}},Vc=[{id:"level",go:"roster",when:t=>t.leveled===0&&t.insightXp>=t.levelXpFirst,action:"Level up",detail:t=>Yc(t.insightXp)+" XP held"},{id:"signature",go:"roster",when:t=>t.looseSignature>0,action:"Equip signature",detail:t=>t.looseSignatureName||"Not equipped"},{id:"formation",go:"formation",when:t=>t.unformed>0,action:"Fill your team",detail:t=>t.unformed+(t.unformed===1?" unit benched":" units benched")},{id:"farm",go:"modes",when:t=>t.farmed===0&&t.insightXp<t.levelXpFirst,action:"Farm Insight",detail:t=>t.farmQty+" x "+t.farmMaterial},{id:"ascend",go:"roster",when:t=>t.ascended===0&&t.atAscensionCap>0,action:"Ascend",detail:t=>t.cappedName?t.cappedName+" at Lv "+t.ascensionCap:"Capped at Lv "+t.ascensionCap}];function Yc(t){return(Number(t)||0).toLocaleString("en-US")}function Gs(t){let e=t&&typeof t=="object"?t:null;if(!e)return null;let a=Kc(e);return a?{id:a.id,go:a.go,action:a.action,detail:a.detail(e)}:null}function Kc(t){let e=t&&typeof t=="object"?t:null;if(!e)return null;let a=Array.isArray(e.done)?e.done:[];return Vc.find(r=>{if(a.includes(r.id))return!1;try{return!!r.when(e)}catch{return!1}})||null}function Ya(t){return(Array.isArray(t)?t:[]).reduce((e,a)=>e+(Number(a.count)||0),0)}var Xc=[{id:"board",kind:"board",label:"Tidewalk",days:10,vigor:!1},{id:"bingo",kind:"bingo",label:"Salvage Bingo",days:7,vigor:!0},{id:"supply",kind:"supply",label:"Supply Line",days:3,vigor:!0}],Vs=t=>Xc.find(e=>e.id===t)||null,Ka=3,Xa=2;var Ys=20,Ks=4,Xs=360*60*1e3;var Ve=4,ct=Ve*Ve,ra=5,Ja=1600,Za=160,Lt=Array.from({length:2*Ve+2},()=>({kind:"aether",qty:Za}));function sa(t=Ve){let e=Math.max(2,Math.round(Number(t)||Ve)),a=[];for(let r=0;r<e;r+=1)a.push(Array.from({length:e},(s,n)=>r*e+n));for(let r=0;r<e;r+=1)a.push(Array.from({length:e},(s,n)=>n*e+r));return a.push(Array.from({length:e},(r,s)=>s*e+s)),a.push(Array.from({length:e},(r,s)=>s*e+(e-1-s))),a}function ue(t){return(Number(t)||0).toLocaleString("en-US")}var Mt='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.2v7.6M9.6 10.4h4.8M9.6 13.6h4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',Zs='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',na=t=>Number(t)>1?ue(t):"";function Jc(t){let e=Number(t&&t.qty)||0;switch(t&&t.kind){case"aether":return{name:"Aether",amount:na(e),tone:"aether"};case"funds":return{name:"Funds",amount:na(e),tone:"funds"};case"material":return{name:t.name||"Tier "+(Number(t.tier)||1)+" material",amount:na(e),tone:"mat"};case"xp":return{name:t.name||"Insight",amount:na(e),tone:"mat"};case"mandate":return{name:"Mandate",amount:"",tone:"prize"};case"potion":return{name:Zc(t.id),amount:"",tone:"potion"};default:return{name:"Reward",amount:"",tone:""}}}function Zc(t){return t==="vigor-l"?"Vigor Decanter":t==="vigor-m"?"Vigor Flask":"Vigor Draught"}function Qc(t,e){let a=Jc(t),r=e<=0;return'<div class="sv-tile'+(r?" gone":"")+" t-"+a.tone+'"><span class="art">'+(fe(t&&t.itemId,a.name)||Q(t&&t.kind))+'</span><span class="sbody"><span class="what">'+(a.amount?"<b>"+f(a.amount)+"</b> ":"")+f(a.name)+'</span><span class="left">'+(r?"":"&times;"+e)+"</span></span></div>"}function ed(t,e){let a=Number(e)>=t.vigor;return'<button class="sv-fight" type="button" data-seasonal-fight="'+t.difficulty+'"'+(a?"":" disabled")+'><span class="lb">'+f(t.label)+'</span><span class="cost">'+Zs+t.vigor+'</span><span class="pay">'+Mt+t.coin+'</span><span class="cp">'+ue(t.cp)+" CP</span></button>"}function td(t){let e=t&&typeof t=="object"?t:null,a=e&&Array.isArray(e.units)?e.units.filter(Boolean):[];if(!a.length)return"";let r=Math.round(Number(e.per)||0),s=a.filter(n=>n.owned).length;return'<div class="sv-bonus"><span class="k">Banner bonus</span><span class="v"><b>+'+r+"%</b> coin each &middot; "+s+"/"+a.length+' owned</span><span class="who">'+a.map(n=>'<span class="u'+(n.owned?" on":"")+'">'+f(n.name||"?")+"</span>").join("")+"</span></div>"}function ad(t,e,a){let r=e&&typeof e=="object"?e:{},s=!!r.done,n=Number(a)>=t.vigor,o=Math.max(1,Math.ceil((Number(r.resetsInMs)||0)/36e5)),i=s?"Done &middot; back in "+o+"h":ue(t.cp)+" CP &middot; 1/day",c=!s&&r.first&&Number(r.firstAether)>0?'<span class="first">+'+ue(r.firstAether)+Q("aether")+" first</span>":"";return'<button class="sv-fight boss'+(s?" done":"")+'" type="button" data-seasonal-fight="'+t.difficulty+'"'+(n&&!s?"":" disabled")+'><span class="lb">'+f(t.label)+'</span><span class="cost">'+Zs+t.vigor+'</span><span class="pay">'+Mt+t.coin+'</span><span class="brow"><span class="cp">'+i+"</span>"+c+"</span></button>"}function rd(t){let e=t||{},a=Math.max(0,Math.round(Number(e.qty)||0)),r=s=>fe(e.itemId,s)||Q(e.kind);return e.kind==="aether"?{glyph:r("Aether"),amount:ue(a),name:"Aether"}:e.kind==="glimmer"?{glyph:r("Glimmer"),amount:ue(a),name:"Glimmer"}:e.kind==="mandate"?{glyph:r("Mandate"),amount:ue(Math.max(1,a)),name:"Mandate"}:{glyph:Q("funds"),amount:ue(a),name:"Reward"}}function sd(t){return(Array.isArray(t)?t:[]).filter(e=>e&&e.reached&&!e.claimed).length}function nd(t){let e=Array.isArray(t)?t.filter(Boolean):[];if(!e.length)return"";let a=sd(e);return'<button type="button" class="sv-ms-btn'+(a?" ready":"")+'" data-seasonal-milestones>Milestones'+(a?" <b>"+a+"</b>":"")+"</button>"}function Qa(t){let e=t&&typeof t=="object"?t:{},a=Array.isArray(e.milestones)?e.milestones.filter(Boolean):[],r=Math.max(0,Number(e.earned)||0),s=Math.max(1,Number(a.length?a[a.length-1].coin:1)||1),n=Math.max(0,Math.min(100,Math.round(r/s*100))),o='<div class="sv-ms-rows">'+a.map((i,c)=>{let l=rd(i.prize),d=!!i.reached&&!i.claimed,h=Math.max(0,Number(i.coin)-r);return'<div class="sv-ms-row'+(i.claimed?" done":d?" ready":"")+'"><span class="c">'+ue(i.coin)+'<i>coin</i></span><span class="p">'+l.glyph+(l.amount?"<b>"+l.amount+"</b> ":"")+f(l.name)+"</span>"+(d?'<button type="button" class="cl" data-seasonal-milestone="'+c+'">Claim</button>':i.claimed?'<span class="st">Claimed</span>':'<span class="st dim">'+ue(h)+" to go</span>")+"</div>"}).join("")+"</div>";return'<div class="rl-modal sv-ms-modal" role="dialog" aria-modal="true" aria-label="Milestones"><div class="rl-veil"></div><div class="rl-panel"><div class="rl-top"><div class="rl-eyebrow">Milestones</div></div><div class="sv-ms-head"><span class="e"><b>'+ue(r)+'</b> coin earned</span><span class="bar"><i style="width:'+n+'%"></i></span><span class="top">'+ue(s)+"</span></div>"+o+'<div class="rl-foot"><button class="rl-ok" type="button" data-seasonal-ms-close>Close</button></div></div></div>'}function er(t,{onClaim:e,onClose:a}={}){if(!t||typeof t.querySelectorAll!="function")return;for(let s of t.querySelectorAll(".sv-ms-modal [data-seasonal-milestone]"))e&&s.addEventListener("click",()=>e(Number(s.getAttribute("data-seasonal-milestone"))));let r=t.querySelector("[data-seasonal-ms-close]");r&&a&&r.addEventListener("click",()=>a())}var Qs=`
.sv-ms-head { display: flex; align-items: center; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.sv-ms-head .e b { color: var(--text); font-size: var(--t-sm); }
.sv-ms-head .bar { flex: 1 1 auto; min-width: 0; height: calc(var(--f) * 0.45); background: var(--ink-3); overflow: hidden; }
.sv-ms-head .bar > i { display: block; height: 100%; background: var(--amber); }
.sv-ms-rows { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; }
/* One row per rung: the coin it asks, the prize, the state. A hairline between rows, the login
   ladder's vocabulary. */
/* ONE LINE per cell, all at the same size (user's report: the figure and the prize sat on
   different baselines when the coin was a two-line block centred against a one-line prize). */
/* Rows share the parent's columns (subgrid): the coin column sizes to the widest rung and stays
   aligned. A fixed width in the base unit clipped "15,000 coin" at 175 percent, since text scales. */
.sv-ms-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; column-gap: var(--sp-2); padding: calc(var(--f) * 0.55) 0; border-top: 1px solid color-mix(in srgb, var(--porcelain-3) 12%, transparent); }
/* A touch more air between a figure and its word (user's call), in both cells. */
.sv-ms-row .c { display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.5); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); line-height: 1.2; color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sv-ms-row .c i { font-style: normal; font-weight: 400; font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.sv-ms-row .p { min-width: 0; display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-sm); line-height: 1.2; color: var(--text); }
.sv-ms-row .p svg { width: var(--t-md); height: var(--t-md); flex: none; color: var(--amber); }
/* The picture takes the glyph's EXACT box, so a rung keeps its one line and nothing moves. */
.sv-ms-row .p img.item-art { width: var(--t-md); height: var(--t-md); flex: none; display: block; border-radius: var(--radius-sm); }
.sv-ms-row .p b { font-family: var(--display); font-weight: 700; color: var(--amber); margin-right: calc(var(--f) * 0.2); }
.sv-ms-row .st { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--jade); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sv-ms-row .st.dim { color: var(--steel-faint); }
.sv-ms-row .cl { cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.sv-ms-row.done .c, .sv-ms-row.done .p { color: var(--steel-faint); }
.sv-ms-row.done .p svg, .sv-ms-row.done .p b { color: var(--steel-faint); }
`;function Js(t){let e=String(t||"").toLowerCase();return e?e.charAt(0).toUpperCase()+e.slice(1):""}function od(t,e){let a=Js(t);if(!a)return"";let r=Js(e);return'<span class="fig sv-aff"><b class="foe a-'+f(String(t).toLowerCase())+'">'+f(a)+'</b><span class="arrow">&rarr;</span><span class="bring">bring</span><b class="a-'+f(String(e||"").toLowerCase())+'">'+f(r)+"</b></span>"}function id(t){let e=Array.isArray(t)?t.filter(Boolean):[];return e.length?'<div class="sv-got"><span class="k">Drew</span>'+e.map(a=>'<span class="g">'+(Number(a.qty)>1?"<b>"+ue(a.qty)+"</b> ":"")+f(a.material||"")+"</span>").join("")+"</div>":""}function ld(){let t=s=>'<b class="n">'+f(ue(s))+"</b>",e=$e.filter(s=>!s.daily).map(s=>f(s.label)+" "+t(s.coin)).join(", "),a=$e.find(s=>s.daily)||null,r=Ya(Ws[0]||[]);return[{k:"The coin",a:"Each fight pays event coin: "+e+"."},...a?[{k:"The boss",a:f(a.label)+" "+t(a.coin)+" coin, once a day. It brings the affinity that beats the one to bring. The first clear of each banner pays "+t(js)+" Aether on top."}]:[],{k:"The milestones",a:"Coin you EARN counts up a ladder of "+t(aa.length)+" rungs, to "+t(aa[aa.length-1].coin)+". Spending never takes a rung away. Each pays once."},{k:"The banner bonus",a:"Each of the banner's characters you own adds "+t(Math.round(Us*100))+"% coin to every fight, whoever you field. All four: double."},{k:"A draw",a:t(Ye)+" coin buys one draw."},{k:"The batch",a:"Draw \xD7"+ze+" takes "+ze+" draws from the same box for "+t(ze*Ye)+" coin. It stops where the box does."},{k:"No luck to it",a:"A box holds "+t(r)+" prizes and a draw TAKES ONE OUT. Empty it and you have had all of them."},{k:"The next box",a:"Emptying one opens the next. Box "+t(Ct)+" refills forever, with a different material each round."},{k:"When it rotates",a:"It lasts as long as its banner. When that rotates, the box restarts and the coin resets."}]}function tr(){return dt({kick:"Seasonal",topics:ld(),attr:"seasonal-help"})}function Ke(t){return t?'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>':'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.6 8.6a3.4 3.4 0 1 1 3.4 3.4v2.2"/><path d="M12 18.4v.1"/></svg>'}function dt({kick:t="",topics:e=[],attr:a="seasonal-help"}={}){let r="data-"+a+"-close";return'<div class="sv-modal" data-'+a+'-modal><div class="sv-modal-veil" '+r+'></div><div class="sv-modal-panel"><div class="sv-modal-top"><div class="sv-modal-id">'+(t?'<span class="kick">'+f(t)+"</span>":"")+'<h3 class="sv-modal-title">How this works</h3></div><button class="sv-modal-x" type="button" '+r+'>Close</button></div><div class="sv-modal-rule"></div>'+(Array.isArray(e)?e:[]).map(s=>'<div class="sv-modal-topic"><span class="k">'+f(s.k)+'</span><p class="a">'+s.a+"</p></div>").join("")+"</div></div>"}function en(t){let e=t&&typeof t=="object"?t:{},a=Array.isArray(e.box)?e.box:[],r=Array.isArray(e.left)?e.left:a.map(y=>Number(y.count)||0),s=r.reduce((y,b)=>y+(Number(b)||0),0),n=Ya(a),o=Math.max(0,Number(e.coin)||0),i=Math.max(0,Number(e.vigor)||0),c=Math.max(1,Math.min(Ct,Number(e.boxIndex)||1)),l=c>=Ct,d=o>=Ye&&s>0,h=Math.min(ze,s,Math.floor(o/Ye)),v=typeof e.art=="string"&&!!e.art.trim(),u=!!e.help,g=n>0?Math.round((n-s)/n*100):0;return'<div class="ev-pane sv'+(v?"":" flat")+'"'+(v?' style="background-image:url('+f(e.art)+')"':"")+'><div class="sv-scrim"></div><button class="sv-q" type="button" data-seasonal-help aria-label="'+(u?"Close":"What is this event?")+'">'+Ke(u)+'</button><div class="sv-hero"><div class="sv-id"><span class="kick">Seasonal</span><h3>'+f(e.label||"Seasonal Event")+'</h3></div><div class="sv-figs">'+od(e.affinity,e.counter)+'<span class="fig"><b>'+ue(o)+"</b>"+Mt+"</span>"+(Number.isFinite(Number(e.endsInDays))?'<span class="fig dim">Ends in <b>'+Math.max(0,Math.round(Number(e.endsInDays)))+"</b>d</span>":"")+"</div>"+td(e.bonus)+"</div>"+('<div class="sv-cols"><div class="sv-fights"><div class="sv-hd">Run a fight</div>'+$e.map(y=>y.daily?ad(y,e.boss,i):ed(y,i)).join("")+'</div><div class="sv-box"><div class="sv-hd"><span class="sv-box-n">'+(l?"Box "+c+" &middot; repeats":"Box "+c+" / "+Ct)+'</span><span class="sv-prog"><span class="bar"><i style="width:'+g+'%"></i></span><b>'+s+"</b>/"+n+" left</span>"+nd(e.milestones)+'</div><div class="sv-grid">'+a.map((y,b)=>Qc(y,Number(r[b])||0)).join("")+'</div><div class="sv-draws"><button class="sv-draw" type="button" data-seasonal-draw'+(d?"":" disabled")+">"+(s<=0?"Box empty":"Draw")+'<span class="c">'+Mt+Ye+"</span></button>"+(s>1?'<button class="sv-draw many" type="button" data-seasonal-draw-many'+(h>=2?"":" disabled")+">Draw &times;"+(h>=2?h:Math.min(ze,s))+'<span class="c">'+Mt+(h>=2?h:Math.min(ze,s))*Ye+"</span></button>":"")+"</div>"+id(e.gained)+'<div class="sv-note">'+(l?"This box refills every time you empty it.":"Empty the box to open the next one.")+"</div></div></div>")+"</div>"}function ar(t,e,a){let r=()=>{typeof a=="function"&&a()};if(!t||typeof t.querySelectorAll!="function")return r();let s=[...t.querySelectorAll(".sv-tile")],n=s[Number(e)];if(!s.length||!n)return r();let o=s.filter(v=>!v.classList.contains("gone")),i=o.length?o:s,c=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,l=c?0:tn,d=0,h=()=>{for(let v of s)v.classList.remove("spin");if(d<l){i[d%i.length].classList.add("spin"),d+=1,setTimeout(h,an+d*rn);return}n.classList.add("spin","hit"),setTimeout(()=>{n.classList.remove("spin","hit"),r()},c?0:sn)};h()}var tn=11,an=34,rn=4,sn=260,cd=110;function rr(t,e,a){let r=()=>{typeof a=="function"&&a()},s=Array.isArray(e)?e.map(v=>Number(v)).filter(v=>Number.isFinite(v)):[];if(!t||typeof t.querySelectorAll!="function"||!s.length)return r();let n=[...t.querySelectorAll(".sv-tile")];if(!n.length||s.some(v=>!n[v]))return r();let o=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,i=n.filter(v=>!v.classList.contains("gone")),c=i.length?i:n,l=0,d=o?0:Math.min(tn,c.length),h=()=>{for(let g of n)g.classList.remove("spin");if(l<d){c[l%c.length].classList.add("spin"),l+=1,setTimeout(h,an+l*rn);return}let v=0,u=()=>{for(let g of n)g.classList.remove("spin","hit");if(n[s[v]].classList.add("spin","hit"),v+=1,v<s.length){setTimeout(u,o?0:cd);return}setTimeout(()=>{for(let g of n)g.classList.remove("spin","hit");r()},o?0:sn)};u()};h()}var nn=`
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
  /* Two lines: the banner bonus at the TOP of the band, the identity and the figures at the bottom
     where they always were (user's call). */
  align-content: space-between;
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
/* INSIDE A HEADER THE "?" IS NOT ABSOLUTE: it takes its place in the row and lines up with the
   text beside it. Over the seasonal's ART it stays absolute -- there is no header there to join.
   First it only RESERVED room (padding) and the button still floated at the top of the box while the
   text sat on its own line: measured, 21px of overlap before, 5px of misalignment after. Reserving
   space is not the same as being in the row, and being beside is not being aligned. */
.ev-top > .sv-q { position: static; margin-left: calc(var(--f) * 0.5); align-self: baseline; }
.sv-q svg { width: 62%; height: 62%; display: block; }
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
/* AN INLINE GLYPH INSIDE A HELP LINE: it sits ON the figure it belongs to, so the reader sees WHICH
   currency a rule pays in without parsing the word. Sized in em so it follows the letter scale, and
   it is the SHARED glyph from reward-art.js -- never a character invented here. */
.sv-modal-topic .a .g { display: inline-flex; vertical-align: -0.14em; color: var(--amber); }
.sv-modal-topic .a .g svg { width: 1.05em; height: 1.05em; display: block; }
.sv-modal-topic .a .g.mark { color: var(--coral); }
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
/* ROW 1, THE SAME AS THE BOSS'S: with the three fights spanning both rows and the boss pinned to
   row 1, its Vigor and coin sat 8px above the other three in rows of identical height. */
.sv-fight .cost { grid-column: 2; grid-row: 1; }
.sv-fight .pay { grid-column: 3; grid-row: 1; }
.sv-fight[disabled] .cp { color: var(--steel-dark); }
.sv-fight:hover:not([disabled]) { border-color: var(--coral); border-left-color: var(--coral); }
.sv-fight[disabled] { cursor: default; color: var(--steel-faint); border-left-color: transparent; }
.sv-fight .lb { font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); }
/* EACH ROW IS ITS OWN GRID, so an auto track sizes to THAT row: 480 is wider than 60,
   and the boss's figures sat further in than the other three. A MINIMUM in ch -- tabular digits,
   so a ch is exact -- gives the four rows the same track, and the numbers right-align in it. */
.sv-fight .cost, .sv-fight .pay { display: inline-flex; align-items: center; justify-content: flex-end; gap: calc(var(--f) * 0.25); font-family: var(--display); font-size: var(--t-sm); font-variant-numeric: tabular-nums; }
.sv-fight .cost { min-width: calc(var(--t-sm) + var(--f) * 0.25 + 2ch); }
.sv-fight .pay { min-width: calc(var(--t-sm) + var(--f) * 0.25 + 3ch); }
.sv-fight .cost svg { width: var(--t-sm); height: var(--t-sm); color: var(--jade); }
.sv-fight .pay svg { width: var(--t-sm); height: var(--t-sm); color: var(--amber); }
.sv-fight[disabled] .cost svg, .sv-fight[disabled] .pay svg { color: var(--steel-dark); }
/* The boss wears the amber edge of a prize; spent for the day, it goes as quiet as a fight you
   cannot afford. */
.sv-fight.boss { border-left-color: var(--amber); }
.sv-fight.boss .lb { color: var(--amber); }
.sv-fight.boss.done { border-left-color: transparent; }
.sv-fight.boss.done .lb { color: var(--steel-faint); }
/* The boss row's second line runs under cost and pay too (the label column alone wrapped it at 175
   percent), and the first-clear prize takes the pay's column on that line, small and amber. */
/* THE BOSS'S SECOND LINE IS ITS OWN ROW ACROSS THE THREE COLUMNS: the CP takes what is left and
   the first-clear tag sits at its end, so neither one can widen the Vigor or coin tracks. */
.sv-fight.boss .brow { grid-column: 1 / -1; grid-row: 2; min-width: 0; display: flex; align-items: baseline; gap: calc(var(--f) * 0.5); }
.sv-fight.boss .cp { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Tight letters, no case change: the tag shares its line with the CP and every pixel is the CP's. */
.sv-fight.boss .first { flex: none; display: inline-flex; align-items: center; gap: calc(var(--f) * 0.15); font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.04em; color: var(--amber); white-space: nowrap; }
.sv-fight.boss .first svg { width: var(--t-tiny); height: var(--t-tiny); flex: none; }
.sv-note { margin-top: auto; font-size: var(--t-tiny); line-height: 1.4; color: var(--steel-faint); }
/* The banner bonus, a full-width row of the BAND (the fight column overflowed 35-67px with it at
   large text): eyebrow, the share, and the four names -- owned in text colour, not owned faint.
   Same per-glyph shadow as the rest of the band, since it sits over the painting. It wraps. */
.sv-bonus { position: relative; z-index: 2; order: -1; align-self: flex-start; flex: 1 1 100%; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: calc(var(--f) * 0.15) calc(var(--f) * 0.7); text-shadow: 0 1px 2px rgba(0,0,0,0.92), 0 0 12px rgba(0,0,0,0.65); }
.sv-bonus .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.sv-bonus .v { font-family: var(--display); font-size: var(--t-xs); line-height: 1.3; color: var(--text); font-variant-numeric: tabular-nums; }
.sv-bonus .v b { font-weight: 700; color: var(--amber); }
.sv-bonus .who { min-width: 0; display: flex; flex-wrap: wrap; gap: calc(var(--f) * 0.15) calc(var(--f) * 0.5); font-size: var(--t-xs); line-height: 1.3; color: var(--steel-faint); }
.sv-bonus .who .u.on { color: var(--text); }
.sv-bonus .who .u + .u::before { content: "\xB7"; margin-right: calc(var(--f) * 0.5); color: var(--steel); }

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
/* THE COLUMN FOLLOWS THE TEXT, not f: the picture and the padding are fixed in f, but the name
   grows with the type scale, so a width in f alone left 101px unused at 100% and made a name
   wrap at 175%. 9em of the name's own size is what its longest line plus its counter asks for. */
.sv-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 5.4 + var(--t-xs) * 9), 1fr)); grid-auto-rows: auto; gap: calc(var(--f) * 0.5); align-content: start; padding-right: calc(var(--f) * 0.3); }
/* TWO COLUMNS, like the difficulty card in farm.js, and it is what gives the picture a size: in
   one column the tile height was art PLUS three lines of text, so the face came out 27px of 138 --
   the smallest thing in its own tile. Side by side the height is the TALLER of the two. */
.sv-tile { position: relative; min-width: 0; display: flex; flex-direction: row; align-items: center; gap: calc(var(--f) * 0.55); padding: calc(var(--f) * 0.6) calc(var(--f) * 0.6); text-align: left; background: color-mix(in srgb, var(--ink) 72%, transparent); border: 1px solid color-mix(in srgb, var(--porcelain-3) 12%, transparent); border-top: 2px solid var(--steel-dark); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
/* The stack's face. aspect-ratio, or an unloaded lazy img measures ZERO tall and the tile
   re-flows when the picture lands. */
/* WIDTH IN f, NEVER A PERCENTAGE: a percentage resolves against the tile, and the grid has to
   size the ROW before the tile has a width -- the row came out 13px short of its content. */
/* WIDTH AND HEIGHT BOTH IN f, NEVER A PERCENTAGE: a percentage resolves against the tile, and
   the grid sizes the ROW before the tile has a width -- rows came out 13px short. */
/* And it CEDES with the type scale: f does not follow that control but the three lines under
   the picture do, and the name is the promise. */
/* NO ceding here, unlike the one-column cards: side by side the tile grows with the text and the
   picture is not taking the name's room. Dividing shrank it to 26px just as the tile hit 117. */
.sv-tile .art { width: calc(var(--f) * 3.6); height: calc(var(--f) * 3.6); flex: none; line-height: 0; }
/* ONE ROW, name left and counter right: on its own LINE the counter reserved height that an
   EMPTIED stack leaves blank -- 31px of air under those two against 15 under the rest, which
   is what the user saw. Side by side, a stack with no counter simply has none. */
.sv-tile .sbody { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: calc(var(--f) * 0.4); }
.sv-tile .art img.item-art { width: 100%; height: 100%; display: block; border-radius: var(--radius-sm); }
.sv-tile .art svg { width: 100%; height: 100%; display: block; color: var(--steel); }
/* THE FIGURE AND THE COUNTER ARE RESERVED EVEN WHEN EMPTY. Only two of the seven stacks carry a
   figure and an emptied one drops its counter, so a centred tile put its picture 19px off. */
/* The figure inside the name line: the SAME size, bold, and it can never leave an empty row.
   nowrap because overflow-wrap: anywhere broke it MID-NUMBER -- "3,00" over "0 Funds". */
/* NO font-family HERE: the figure sits INSIDE the name's line, so a display face next to a body
   face puts two typefaces in one sentence. It inherits, and only the weight changes. */
.sv-tile .what b { white-space: nowrap; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
/* Two lines reserved, and the FLOOR above is the sum of these parts: f uses container-query
   units, so the grid cannot resolve the picture's height while it sizes the row -- leaving it
   to the content gave rows 13px short of what they held, with every scroll check at zero. */
/* THE FIRST LINE STARTS AT THE TOP OF THE RESERVED BLOCK, never centred in it: a one-line name
   centred in a two-line box sits 10px below a two-line one, and the BOX top is identical --
   which is why measuring the element hid it and the user saw it at once. */
/* A BLOCK, NEVER A FLEX: a flex container turns the figure and the name into two items and EATS
   the space between them -- it drew "100Aether". As a block the text starts at the top of the
   reserved two lines on its own, which is the only thing the flex was there for. */
/* NO reserved second line: no name wraps at any scale in this column, so reserving one left 18px
   of empty line in EVERY tile -- a quarter of its height. The column below is what keeps it so. */
.sv-tile .what { line-height: 1.2; font-size: var(--t-xs); color: var(--text); overflow-wrap: anywhere; }
/* THE FIGURE AND THE COUNTER SHARE ONE ROW, and the row is reserved. On its own line the counter
   cost the grid a visible row; pinned to the corner it landed ON the figure -- measured, 2 of 6
   tiles. Side by side neither happens and every tile keeps the same two body rows. */
.sv-tile .left { flex: none; line-height: 1.25; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
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
/* A picture has no stroke to send to steel-dark, so the art is what dims on an empty stack. */
.sv-tile.gone .art img.item-art { opacity: 0.4; }

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
/* THE MILESTONE LADDER, above the box: a header row (eyebrow, bar, coin earned) and the rungs in
   one row that wraps. The grid below absorbs the height -- it is the pane's one scroll region. */
/* THE MILESTONES BUTTON, in the box's header between the box number and the progress: the "?"'s
   vocabulary (a quiet chip), coral when something waits, with the count. */
.sv-ms-btn { cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); padding: calc(var(--f) * 0.25) calc(var(--f) * 0.6); background: var(--ink-3); border: 1px solid transparent; color: var(--steel-faint); --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); white-space: nowrap; }
.sv-ms-btn:hover { border-color: var(--coral); color: var(--coral); }
.sv-ms-btn.ready { background: var(--coral); color: var(--on-coral); border-color: var(--coral); }
.sv-ms-btn b { font-variant-numeric: tabular-nums; }
/* The two draw buttons share one row and one width: the batch is the same control, times ten. */
.sv-draws { flex: none; display: flex; gap: var(--sp-2); }
.sv-draws .sv-draw { flex: 1 1 0; min-width: 0; }

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
`;var cn=1e3,ir=260,dn=900,sr=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),oa=t=>(Number(t)||0).toLocaleString("en-US"),on={1:[[12,12]],2:[[8,8],[16,16]],3:[[8,8],[12,12],[16,16]],4:[[8,8],[16,8],[8,16],[16,16]],5:[[8,8],[16,8],[12,12],[8,16],[16,16]],6:[[8,8],[16,8],[8,12],[16,12],[8,16],[16,16]]},dd="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",hd=([t,e],a=1.7)=>"M"+(t-a)+" "+e+"a"+a+" "+a+" 0 1 0 "+2*a+" 0a"+a+" "+a+" 0 1 0 "+-2*a+" 0z";function ia(t=5){let e=on[Math.max(1,Math.min(6,Math.round(Number(t)||5)))]||on[5];return'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="'+dd+e.map(a=>hd(a)).join("")+'"/></svg>'}var nr=7,or=5;function pd(t=nr,e=or){let a=[];for(let r=1;r<=t;r+=1)a.push([1,r]);for(let r=2;r<=e;r+=1)a.push([r,t]);for(let r=t-1;r>=1;r-=1)a.push([e,r]);for(let r=e-1;r>=2;r-=1)a.push([r,1]);return a}function fd(t){let e=t||{},a=Math.max(0,Math.round(Number(e.qty)||0));if(e.kind==="aether")return{glyph:"aether",amount:oa(a),name:"Aether",tone:"aether"};if(e.kind==="funds")return{glyph:"funds",amount:oa(a),name:"Funds",tone:""};if(e.kind==="xp")return{glyph:"xp",amount:oa(a),name:e.name||"Insight",tone:""};if(e.kind==="potion")return{glyph:"potion",amount:"",name:e.name||"Vigor Draught",tone:"potion"};if(e.kind==="material"){let r=String(e.family||"").startsWith("tenet");return{glyph:r?"form":"asc",amount:oa(a),name:e.name||"Tier "+(Number(e.tier)||1)+" material",tone:r?"form":""}}return{glyph:"funds",amount:"",name:"Reward",tone:""}}function hn(t=0){let e=Math.max(1,Math.round(Xs/36e5)),a=Math.max(0,Math.round(Number(t)||0)),r='<span class="g mark">'+ia(5)+"</span>",s='<span class="g">'+Q("aether")+"</span>",n='<span class="g">'+Q("asc")+"</span>";return[{k:"The dice",a:"One "+r+" die every "+e+" hours, up to "+Ks+" waiting."},{k:"Every tile pays",a:"All "+Ys+" tiles are prizes, "+s+" Aether among them. The ring loops: there is no finish line."},{k:"Each lap",a:n+" Material tiles pay a different family every lap."},{k:"When it ends",a:(a?"It runs for "+a+" days. ":"")+"Unspent dice do not carry over."}]}function lr(t){if(!t)return"";let e=t;return[e.pos,e.laps,e.dice,e.cap,e.live,e.closed,e.endsInDays,(e.tiles||[]).map(a=>a&&a.name+"x"+a.qty+"@"+a.itemId).join("|")].join(":")}function pn(t,e=null){let a=t||{},r=Array.isArray(a.tiles)?a.tiles:[],s=pd(),n=Math.max(0,Math.round(Number(a.pos)||0)),o=Math.max(0,Math.round(Number(a.laps)||0)),i=Math.max(0,Math.round(Number(a.dice)||0)),c=Math.max(1,Math.round(Number(a.cap)||4)),l=e&&e.state==="land"?Math.round(Number(e.at)):-1,d=!!(e&&e.state==="spin"),h=!!(e&&e.state==="walk"),v=h?Math.max(0,Math.round(Number(e.step)||0)):0,u=h?(Math.max(0,Math.round(Number(e.from)||0))+v)%s.length:-1,g=h?u:n,y=h||l>=0?Math.max(1,Math.round(Number(e.face)||1)):0,b=s.map(([k,S],H)=>{let R=fd(r[H]),m=H===g,L=H===l?" land":h&&v>0&&H===u?" step":"";return'<div class="bd-cell'+(R.tone?" t-"+R.tone:"")+(m?" here":"")+L+'" style="grid-row:'+k+";grid-column:"+S+'" data-tile="'+H+'">'+(m?'<span class="pawn" aria-hidden="true"></span>':"")+'<span class="i">'+(fe(r[H]&&r[H].itemId,R.name)||Q(R.glyph))+'</span><span class="n">'+(R.amount?"<b>"+sr(R.amount)+"</b> ":"")+sr(R.name)+"</span></div>"}).join(""),x=d?'<span class="roll spin"><span class="faces">'+[1,2,3,4,5,6].map(k=>ia(k)).join("")+'</span><span class="said">Rolling</span></span>':y?'<span class="roll hit"><span class="faces">'+ia(y)+'</span><span class="said">'+(h?"Rolled ":"Moved ")+y+"</span></span>":"",E=i>=c?'<span class="full">Full</span>':Number.isFinite(a.nextInMs)?'<span class="refill" data-board-next>in '+Ha(a.nextInMs)+"</span>":"";return'<div class="ev-pane"><div class="bd"><div class="ev-top"><h3 class="ev-title">'+sr(a.label||"Tidewalk")+'</h3><span class="ev-when">Lap <b>'+(o+1)+"</b>"+(Number.isFinite(Number(a.endsInDays))?" &middot; Ends in <b>"+Math.max(1,Math.round(Number(a.endsInDays)))+"</b>d":"")+'</span><button class="sv-q" type="button" data-board-help aria-label="'+(a.help?"Close":"What is this event?")+'">'+Ke(a.help)+'</button></div><div class="bd-grid" style="grid-template-columns:repeat('+nr+",1fr);grid-template-rows:repeat("+or+',1fr)">'+b+'<div class="bd-mid" style="grid-row:2/'+or+";grid-column:2/"+nr+'">'+x+'</div></div><div class="ev-foot"><span class="bd-dice"><span class="g">'+ia(5)+'</span><span class="value" data-board-dice>'+i+'<span class="dim">/'+c+"</span></span>"+E+'</span><button class="ev-claim" type="button" data-board-roll'+(i>0?"":" disabled")+">"+(i>0?"Roll":"No dice")+"</button></div></div></div>"}function fn(t,{onRoll:e,nextMs:a,onLanded:r}={}){if(!t)return ln(t,{nextMs:a,onLanded:r});let s=t.querySelector("[data-board-roll]");return s&&e&&s.addEventListener("click",()=>e()),ln(t,{nextMs:a,onLanded:r})}function ln(t,{nextMs:e,onLanded:a}={}){if(!t||!t.querySelector||!Number.isFinite(e))return()=>{};let r=Date.now()+Number(e),s=!1,n=()=>{let i=t.querySelector("[data-board-next]");if(!i)return;let c=r-Date.now();if(c>0){i.textContent="in "+Ha(c);return}s||(s=!0,a&&a())};n();let o=setInterval(n,1e3);return()=>clearInterval(o)}var un=`
/* position: relative anchors the "?", which is absolute: .ev-pane is not positioned, so without
   this it would corner itself against the stage instead of against the board. */
.bd { position: relative; display: flex; flex-direction: column; gap: var(--sp-2); height: 100%; min-height: 0; --pop: 1.18; }
/* THE GRID CARRIES ROOM FOR THE POP, and the room is DERIVED from the pop: without it the corner
   tile grew 10px outside the pane, and .ev-pane is overflow-x:hidden -- it does not scroll, it CUTS.
   The overflow per side is (peak - 1) / 2 of a tile's width. */
.bd-grid {
  flex: 1; min-height: 0; display: grid; gap: calc(var(--f) * 0.34);
  padding: calc((var(--pop) - 1) * var(--f) * 7);
}
/* A tile speaks the seasonal's vocabulary: a dark plate, the text in --text, and the top border
   coloured by the class of prize. */
.bd-cell {
  position: relative; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--f) * 0.2); overflow: hidden; text-align: center;
  padding: calc(var(--f) * 0.45) calc(var(--f) * 0.35);
  background: color-mix(in srgb, var(--ink) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--porcelain-3) 12%, transparent);
  border-top: 2px solid var(--steel-dark);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
}
/* THE FACE HAS A BOX OF ITS OWN, width AND height in f: a lazy <img> that has not landed measures
   ZERO tall, so without one the whole ring re-flows when twenty pictures arrive.
   AND IT CEDES WITH THE TYPE SCALE (/ var(--gf-type-scale)): f does not follow that control but the
   name under it does, and in a one-column tile the picture is standing in the name's room. The
   glyph used to GROW with the scale (--t-lg carries the multiplier), which is what left 175% with
   no room at all.
   IT IS WHAT IS LEFT OVER, never a typed size: height 100% plus flex-shrink hands the picture the
   room the two reserved lines do not take, and aspect-ratio makes the width follow. A number in f
   would be right at one letter scale and wrong at the other three -- the cell is 153x107 at 100%
   and 155x95 at 175%, which is not the same ratio the letters grow by. */
.bd-cell .i { flex: 0 1 auto; min-height: 0; height: 100%; aspect-ratio: 1; max-width: 100%; line-height: 0; color: var(--steel-faint); display: flex; }
.bd-cell .i svg, .bd-cell .i img.item-art { width: 100%; height: 100%; display: block; }
.bd-cell .i img.item-art { border-radius: var(--radius-sm); }
/* TWO LINES RESERVED, and it is what keeps the twenty pictures on one line: the tile centres its
   content, so a wrapping name ("2 Bulwark Doctrine II") lifted its own picture above its
   neighbours'. Nothing here is optional -- every tile has a name -- so this reserves the LINE COUNT,
   not a block that may not exist.
   2.5em and not the 2.4 the two line boxes measure: asked for at the exact height, the rounding of
   the line box leaves a measurable 1px of clipping. */
.bd-cell .n { min-height: 2.5em; font-size: var(--t-xs); line-height: 1.2; color: var(--text); overflow-wrap: anywhere; }
/* NO font-family HERE, the seasonal's rule and for the same measured reason: the figure sits INSIDE
   the name's sentence, so a display face beside a body face puts two typefaces in one line -- which
   is the "usan otra tipografia" the user called out on the box stacks. It also made the line box 3px
   taller than line-height predicts, so the reserved two lines CLIPPED the longest name. */
.bd-cell .n b { font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.bd-cell.t-aether { border-top-color: var(--amber); }
.bd-cell.t-aether .i { color: var(--amber); }
.bd-cell.t-potion { border-top-color: var(--jade); }
.bd-cell.t-form { border-top-color: var(--steel); }
/* Where the pawn stands: the treatment .sv-tile.hit already uses for "this is the one". */
.bd-cell.here {
  border-color: var(--amber); border-top-color: var(--amber);
  background: color-mix(in srgb, var(--amber) 22%, var(--ink));
  box-shadow: 0 0 0 1px var(--amber);
}
.bd-cell.here .i, .bd-cell.here .q, .bd-cell.here .n { color: var(--text); }
.bd-cell .pawn {
  position: absolute; top: calc(var(--f) * 0.25); left: calc(var(--f) * 0.3);
  width: calc(var(--f) * 0.5); height: calc(var(--f) * 0.5); border-radius: 99px; background: var(--coral);
}
/* A STEP of the walk: a flash of the border, the vocabulary of .sv-tile.spin. Cheap, and it moves
   nothing -- a tile that scales on every step would shove the eye around the whole ring. */
.bd-cell.step { border-color: var(--coral); border-top-color: var(--coral); background: color-mix(in srgb, var(--coral) 14%, var(--ink)); }
/* THE ARRIVAL DOES grow, and it is the reasoned exception to the seasonal's rule. There the roulette
   jumps across many tiles and a constant pop would be chaos; here it happens ONCE, at the end, and
   it is the prize. A transform does NOT reflow -- it does not shove the neighbours, it COVERS them --
   so the tile is lifted out of the stack or they would cover it instead. */
.bd-cell.land {
  position: relative; z-index: 3; transform: scale(calc(1 + (var(--pop) - 1) * 0.65));
  border-color: var(--amber); border-top-color: var(--amber);
  background: color-mix(in srgb, var(--amber) 26%, var(--ink));
  box-shadow: 0 0 0 2px var(--amber), 0 0 calc(var(--f) * 1.6) color-mix(in srgb, var(--amber) 60%, transparent);
  animation: bd-land 460ms var(--ease) 1;
}
.bd-cell.land .i, .bd-cell.land .q, .bd-cell.land .n { color: var(--text); }
@keyframes bd-land {
  0% { transform: scale(1); box-shadow: 0 0 0 0 var(--amber); }
  45% { transform: scale(var(--pop)); }
  100% { transform: scale(calc(1 + (var(--pop) - 1) * 0.65)); }
}
.bd-mid { min-width: 0; display: flex; align-items: center; justify-content: center; padding: var(--sp-2); }
.bd-mid .roll { display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.6); }
.bd-mid .said { font-family: var(--display); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* THE DIE DOES NOT SPIN LIKE A WHEEL: IT CHANGES FACE. A die rolls and shows faces; rotating it on
   its axis reads wrong, and the house already had the pattern -- the seasonal's roulette RUNS the
   candidates and SITS on the one that came up. The six faces stack and one lights at a time with
   steps(1) and a delay each: no JS, and the final state is simply the face that came up, alone.
   150ms a face, not 80: at 80 the six faces read as a flicker (user's call). */
.bd-mid .faces { position: relative; width: calc(var(--f) * 7); height: calc(var(--f) * 7); }
.bd-mid .faces svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; color: var(--amber); }
.bd-mid .roll.spin .faces svg { opacity: 0; animation: bd-face 900ms steps(1) infinite; }
.bd-mid .roll.spin .faces svg:nth-child(1) { animation-delay: 0ms; }
.bd-mid .roll.spin .faces svg:nth-child(2) { animation-delay: 150ms; }
.bd-mid .roll.spin .faces svg:nth-child(3) { animation-delay: 300ms; }
.bd-mid .roll.spin .faces svg:nth-child(4) { animation-delay: 450ms; }
.bd-mid .roll.spin .faces svg:nth-child(5) { animation-delay: 600ms; }
.bd-mid .roll.spin .faces svg:nth-child(6) { animation-delay: 750ms; }
@keyframes bd-face { 0%, 16.6% { opacity: 1; } 16.7%, 100% { opacity: 0; } }
/* The dice chip is the bar's Vigor chip brought into the pane: a row, and the TWO numbers in ONE
   .value at the SAME size -- the cap is told apart by OPACITY, never by size. */
.bd-dice {
  min-width: 0; margin-left: auto; display: flex; align-items: center; gap: calc(var(--f) * 0.55);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3);
  border-radius: var(--radius-sm); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.6);
}
/* THE ROLL BUTTON IS AS TALL AS THE DICE CHIP (user's call), and it is DERIVED, never typed:
   align-self: stretch takes the row's height, which the chip sets. Typing 62px would be right at
   one letter scale and wrong at the other four.
   SCOPED TO .bd. Unscoped it also hit the login, pass and seasonal feet -- BOARD_STYLES is
   concatenated after theirs and the last rule with the same name wins, as in JS. */
.bd .ev-foot .ev-claim {
  margin-left: 0; align-self: stretch;
  display: inline-flex; align-items: center; justify-content: center;
}
.bd-dice .g { flex: none; display: flex; align-items: center; color: var(--amber); }
.bd-dice .g svg { width: var(--t-xl); height: var(--t-xl); display: block; }
.bd-dice .value { font-family: var(--display); font-weight: 700; font-size: var(--t-md); line-height: 1; color: var(--text); font-variant-numeric: tabular-nums; }
.bd-dice .dim { opacity: 0.45; }
.bd-dice .refill { font-size: var(--t-xs); line-height: 1; color: var(--jade); font-variant-numeric: tabular-nums; }
.bd-dice .full { font-family: var(--display); font-size: var(--t-tiny); line-height: 1; letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
`;var je=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),Fe=t=>(Number(t)||0).toLocaleString("en-US");function vn(t){let e=t||{},a=Math.max(0,Math.round(Number(e.qty)||0));if(e.kind==="aether")return{glyph:"aether",amount:Fe(a),name:"Aether",tone:"aether"};if(e.kind==="funds")return{glyph:"funds",amount:Fe(a),name:"Funds",tone:""};if(e.kind==="xp")return{glyph:"xp",amount:Fe(a),name:e.name||"Insight",tone:""};if(e.kind==="material"){let r=String(e.family||"").startsWith("tenet");return{glyph:r?"form":"asc",amount:Fe(a),name:e.name||"Material",tone:r?"form":""}}return{glyph:"funds",amount:"",name:"Reward",tone:""}}function mn(t=0){let e=Math.max(0,Math.round(Number(t)||0)),a=sa().length,r='<span class="g mark">'+Q("asc")+"</span>",s='<span class="g">'+Q("aether")+"</span>";return[{k:"The marks",a:"Every "+ra+" Materials runs earn one "+r+" mark."},{k:"Face down",a:"A mark lands on a free square at random and turns it over. You keep what was under it."},{k:"The lines",a:"Closing a row, a column or a diagonal pays "+s+" "+Fe(Za)+" Aether. There are "+a+" of them."},{k:"The full card",a:"Turning all "+ct+" pays "+s+" "+Fe(Ja)+" Aether on top."+(e?" It runs for "+e+" days.":"")}]}function cr(t){if(!t)return"";let e=t;return[e.marks,e.runs,e.live,e.closed,e.endsInDays,(e.marked||[]).join("|"),(e.tiles||[]).map(a=>a&&a.name+"x"+a.qty+"@"+a.itemId).join("|")].join(":")}function la(t,e,a){let r=vn(t);return'<div class="lc-line'+(r.tone?" t-"+r.tone:"")+(e?" done":"")+'" title="'+je(a+": "+r.amount+" "+r.name)+'"><span class="i">'+Q(r.glyph)+'</span><span class="q">'+je(r.amount)+"</span></div>"}function gn(t,e=null){let a=t||{},r=Array.isArray(a.tiles)?a.tiles:[],s=new Set((Array.isArray(a.marked)?a.marked:[]).map(b=>Math.round(Number(b)))),n=Math.max(0,Math.round(Number(a.marks)||0)),o=sa().length,i=e==null||e===""?-1:Math.round(Number(e)),c=s.size>=ct,l=sa(),d=l.map(b=>b.every(x=>s.has(x))),h=d.filter(Boolean).length,v=new Set;l.forEach((b,x)=>{if(d[x])for(let E of b)v.add(E)});let u=Ve,g=[];for(let b=0;b<ct;b+=1){let x=s.has(b),E=x?vn(r[b]):null,k=Math.floor(b/u)+1,S=b%u+2;g.push('<div class="lc-cell'+(E&&E.tone?" t-"+E.tone:"")+(x?" on":" down")+(v.has(b)?" inline":"")+(b===i?" land":"")+'" style="grid-row:'+k+";grid-column:"+S+'" data-square="'+b+'">'+(x?'<span class="i">'+(fe(r[b]&&r[b].itemId,E.name)||Q(E.glyph))+'</span><span class="n">'+(E.amount?"<b>"+je(E.amount)+"</b> ":"")+je(E.name)+"</span>":'<span class="back" aria-hidden="true">?</span>')+"</div>")}for(let b=0;b<u;b+=1)g.push('<div class="lc-slot row" style="grid-row:'+(b+1)+";grid-column:"+(u+2)+'">'+la(Lt[b],d[b],"Row "+(b+1))+"</div>");for(let b=0;b<u;b+=1)g.push('<div class="lc-slot col" style="grid-row:'+(u+1)+";grid-column:"+(b+2)+'">'+la(Lt[u+b],d[u+b],"Column "+(b+1))+"</div>");g.push('<div class="lc-slot tilted up" style="grid-row:'+(u+1)+';grid-column:1">'+la(Lt[2*u+1],d[2*u+1],"Diagonal")+"</div>"),g.push('<div class="lc-slot tilted down" style="grid-row:'+(u+1)+";grid-column:"+(u+2)+'">'+la(Lt[2*u],d[2*u],"Diagonal")+"</div>");let y=Math.max(0,Math.min(ra,Math.round(Number(a.runs)||0)));return'<div class="ev-pane"><div class="lc"><div class="ev-top"><h3 class="ev-title">'+je(a.label||"Salvage Bingo")+'</h3><span class="ev-when">Lines <b>'+h+"</b>/"+o+(Number.isFinite(Number(a.endsInDays))?" &middot; Ends in <b>"+Math.max(1,Math.round(Number(a.endsInDays)))+"</b>d":"")+'</span><button class="sv-q" type="button" data-bingo-help aria-label="'+(a.help?"Close":"What is this event?")+'">'+Ke(a.help)+'</button></div><div class="lc-wrap"><div class="lc-grid" style="grid-template-columns:auto repeat('+u+",1fr) auto;grid-template-rows:repeat("+u+',1fr) auto">'+g.join("")+'</div></div><div class="ev-foot"><span class="lc-full"><span class="k">Full card</span><span class="v"><b>'+Fe(Ja)+"</b> Aether &middot; "+s.size+"/"+ct+"</span></span>"+(c?"":'<span class="lc-runs" data-bingo-next><b>'+y+"</b>/"+ra+' runs</span><span class="lc-marks"><span class="g">'+Q("asc")+'</span><span class="value" data-bingo-marks>'+n+'</span></span><button class="ev-claim" type="button" data-bingo-mark'+(n>0?"":" disabled")+">"+(n>0?"Mark":"No marks")+"</button>")+"</div></div></div>"}function dr(t){let e=Math.max(0,Math.round(Number(t)||0));return e?'<div class="rl-modal lc-won" role="dialog" aria-modal="true" aria-label="Card complete"><div class="rl-veil"></div><div class="rl-panel"><div class="rl-top"><div class="rl-eyebrow">Card complete</div></div><div class="lc-won-body"><span class="i">'+(fe("aether","Aether")||Q("aether"))+'</span><span class="q"><b>'+Fe(e)+'</b> Aether</span><span class="s">All '+ct+' squares turned over.</span></div><div class="rl-foot"><button class="rl-ok" type="button" data-bingo-won-ok>Accept</button></div></div></div>':""}function hr(t,{onClose:e}={}){let a=t&&t.querySelector("[data-bingo-won-ok]");a&&e&&a.addEventListener("click",()=>e())}function pr(t){let e=t||{},a=Math.max(0,Math.round(Number(e.marks)||0));if(!a)return"";let r=Math.max(0,Math.round(Number(e.lines)||0)),s=Math.max(0,Math.round(Number(e.won)||0)),n=Vs("bingo"),o=Array.isArray(e.gained)?e.gained:[];return'<div class="rl-modal lc-won" role="dialog" aria-modal="true" aria-label="'+je(n&&n.label||"Salvage Bingo")+' closed"><div class="rl-veil"></div><div class="rl-panel"><div class="rl-top"><div class="rl-eyebrow">'+je(n&&n.label||"Salvage Bingo")+' closed</div></div><div class="lc-won-body"><span class="i">'+Q("asc")+'</span><span class="q"><b>'+a+"</b> mark"+(a===1?"":"s")+' placed</span><span class="s">Unspent when the window closed, so they were placed for you.'+(r?" <b>"+r+"</b> line"+(r===1?"":"s")+" closed.":"")+(s?" Card complete.":"")+"</span>"+(o.length?'<span class="lc-won-list">'+o.map(i=>'<span class="it">'+Q(i.kind)+"<b>"+Fe(i.qty)+"</b> "+je(i.material)+"</span>").join("")+"</span>":"")+'</div><div class="rl-foot"><button class="rl-ok" type="button" data-bingo-closed-ok>Accept</button></div></div></div>'}function fr(t,{onClose:e}={}){let a=t&&t.querySelector("[data-bingo-closed-ok]");a&&e&&a.addEventListener("click",()=>e())}var bn=`
/* Both pop-ups ride the relic pop-up's sheet (veil, panel, Accept); only the body is their own. */
.lc-won-body { display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.4); padding: var(--sp-3) var(--sp-2); text-align: center; }
.lc-won-body .i { display: flex; color: var(--amber); }
.lc-won-body .i svg, .lc-won-body .i img.item-art { width: calc(var(--f) * 3.4); height: calc(var(--f) * 3.4); display: block; }
.lc-won-body .i img.item-art { border-radius: var(--radius-sm); }
.lc-won-body .q { font-family: var(--display); font-size: var(--t-lg); line-height: 1; color: var(--text); font-variant-numeric: tabular-nums; }
.lc-won-body .q b { color: var(--amber); font-weight: 700; }
.lc-won-body .s { font-family: var(--body); font-size: var(--t-xs); line-height: 1.3; color: var(--steel-faint); }
.lc-won-body .s b { color: var(--text); font-weight: 700; }
/* What the placed marks paid: the Claimed strip's vocabulary (events.js .ev-gained), centred. */
.lc-won-list { min-width: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: calc(var(--f) * 0.3) var(--sp-2); margin-top: calc(var(--f) * 0.3); }
.lc-won-list .it { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-xs); color: var(--text); }
.lc-won-list .it svg { width: var(--t-sm); height: var(--t-sm); flex: none; color: var(--jade); }
.lc-won-list .it b { font-variant-numeric: tabular-nums; }
`;function yn(t,{onMark:e}={}){if(!t)return;let a=t.querySelector("[data-bingo-mark]");a&&e&&a.addEventListener("click",()=>e())}var wn=`
/* position: relative anchors the "?", which is absolute: .ev-pane is not positioned. */
.lc { position: relative; display: flex; flex-direction: column; gap: var(--sp-2); height: 100%; min-height: 0; --pop: 1.18; }
/* THE CARD IS CENTRED AT ITS NATURAL SIZE, it does not fill the pane: the wrap takes the room and
   the grid sits in the middle of it, so the line strips read as a border and not as four bands
   stretched across the screen. */
.lc-wrap { flex: 1; min-height: 0; display: grid; place-items: center; }
/* THE HEIGHT LEADS AND THE WIDTH IS DERIVED. With max-width leading, the aspect-ratio asked for
   1128/1.12 = 1007px of height inside a 524px wrap and the pane scrolled 29px with every other
   check at zero -- the pane grows with its content, so nothing failed. */
.lc-grid {
  /* 1.32 and not 1.12: the two side strips that hold the diagonals take ~140px of the grid, and at
     the narrower ratio they took it OUT OF THE CARD -- squares fell from 114 to 98 wide. The ratio
     buys the strips their room instead of the card paying for it. */
  height: 100%; max-width: 100%; min-height: 0; aspect-ratio: 1.32;
  display: grid; gap: calc(var(--f) * 0.4);
  padding: calc((var(--pop) - 1) * var(--f) * 7);
}
/* A square speaks the board's vocabulary, which speaks the seasonal's. */
.lc-cell {
  position: relative; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--f) * 0.22); overflow: hidden; text-align: center;
  padding: calc(var(--f) * 0.45) calc(var(--f) * 0.35);
  background: color-mix(in srgb, var(--ink) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--porcelain-3) 12%, transparent);
  border-top: 2px solid var(--steel-dark);
  --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
}
/* THE FACE HAS A BOX OF ITS OWN AND IT IS WHAT IS LEFT OVER, never a typed size -- the ring's
   lesson: a number in f is right at one letter scale and wrong at the other three, because the
   square does not grow with the letters in the proportion the letters do. height 100% plus
   flex-shrink hands the picture the room the two reserved lines do not take, and aspect-ratio makes
   the width follow. It also gives the lazy <img> a height before it lands, so nothing re-flows. */
.lc-cell .i { flex: 0 1 auto; min-height: 0; height: 100%; aspect-ratio: 1; max-width: 100%; line-height: 0; color: var(--steel-faint); display: flex; }
.lc-cell .i svg, .lc-cell .i img.item-art { width: 100%; height: 100%; display: block; }
.lc-cell .i img.item-art { border-radius: var(--radius-sm); }
/* TWO LINES RESERVED, and it is what keeps the pictures on one line: the square centres its
   content, so a wrapping name lifted its own picture above its neighbours'. It reserves the LINE
   COUNT the longest name in the catalogue needs, not a block that may not exist. 2.6em and not the
   2.5 the two line boxes measure: asked for at the exact height, the rounding leaves 1px clipped. */
.lc-cell .n { min-width: 0; min-height: 2.6em; font-family: var(--body); font-size: var(--t-xs); line-height: 1.25; color: var(--text); }
/* NO font-family HERE, the seasonal's rule and the ring's: the figure sits INSIDE the name's
   sentence, so a display face beside a body face puts two typefaces in one line -- and it also
   makes the line box taller than line-height predicts, which is what CLIPS a reserved line. */
.lc-cell .n b { font-weight: 700; font-variant-numeric: tabular-nums; }
/* FACE DOWN: no glyph, no figure, no colour that could hint at what is under it. */
.lc-cell.down { background: color-mix(in srgb, var(--ink-2) 82%, transparent); border-top-color: var(--ink-3); }
/* --steel-faint and not --steel-dark: the back has to be QUIET, not unreadable. Measured, the dark
   one gave 1.7:1 against the plate and every face-down square counted as a low-contrast element. */
.lc-cell .back { font-family: var(--display); font-weight: 700; font-size: var(--t-lg); line-height: 1; color: var(--steel-faint); }
.lc-cell.t-aether { border-top-color: var(--amber); }
.lc-cell.t-aether .i { color: var(--amber); }
.lc-cell.t-form { border-top-color: var(--jade); }
.lc-cell.t-form .i { color: var(--jade); }
/* A square in a CLOSED line keeps the coral edge: the line is the prize. */
.lc-cell.inline { border-color: color-mix(in srgb, var(--coral) 46%, transparent); background: color-mix(in srgb, var(--coral) 9%, transparent); }
/* THE ARRIVAL grows, the same reasoned exception the ring makes: it happens ONCE, at the end of the
   mark, and it is the prize. A transform does not reflow -- it COVERS -- so it is lifted out of the
   stack or its neighbours would cover it instead. */
.lc-cell.land { z-index: 3; transform: scale(var(--pop)); border-color: var(--coral); }
/* The line strips. A slot is only a cell of the grid; the plate inside it is what is drawn. */
.lc-slot { min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; gap: calc(var(--f) * 0.25); }
/* EVERY PLATE STAYS CENTRED IN ITS CELL. Pinning them to the edge facing the card was tried and
   was WORSE: it closed the gap to the card (28px down to 5) and in exchange broke the strip itself
   -- the diagonals stayed centred, so the bottom row ended up 23px out of line with itself.
   What harmonises is the plates agreeing with EACH OTHER, not their distance to the card. The gap
   is closed by making the diagonal's turned box smaller, which is what sets the row's height. */
/* THE SIDE PADDING GROWS WITH THE TEXT (em) AND IS FLOORED BY THE CORNER RADIUS. Both halves were
   found by the user looking, and each was a different bug:
   \xB7 --radius-sm is 12px in bloom and 10 in ember against ~0 elsewhere, so a padding that read fine
     in vanguard put the figure INSIDE the curve. A first fix used two thirds of the radius and
     still fell 5px short -- it has to MATCH the radius, not approach it (harness: RADIO-COME).
   \xB7 sized in --f instead of em, a figure at --t-md (27px) got 7px of air and read as glued.
   AND THE TOKEN ITSELF HAD TO BE FIXED: the contract declared --radius-sm as a UNITLESS 0, which
   vanguard inherits, and a unitless zero inside max() makes the WHOLE declaration invalid -- so the
   side padding was not small there, it was ZERO, silently. Patching it here with calc(x + 0px)
   would have left the same trap for the next reader; theme.js now says 0px. Same family as the
   undeclared --hairline in events.js. */
.lc-line {
  display: flex; align-items: center; gap: calc(var(--f) * 0.25);
  padding: calc(var(--f) * 0.22) max(0.62em, var(--radius-sm));
  background: color-mix(in srgb, var(--ink-2) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--porcelain-3) 10%, transparent);
  border-radius: var(--radius-sm);
}
.lc-line .i { display: flex; line-height: 1; color: var(--steel-faint); }
.lc-line .i svg { width: var(--t-sm); height: var(--t-sm); display: block; }
.lc-line .q { font-family: var(--display); font-weight: 700; font-size: var(--t-xs); line-height: 1; color: var(--text); font-variant-numeric: tabular-nums; }
/* THE PLATE LIES ALONG ITS OWN LINE: rotated a full 45 degrees, the way the diagonal runs.
   The point that took three tries: it has to STAY WIDE while it turns. The first attempt let the
   narrow slot squeeze it until glyph and figure stacked, so a rotated near-square read as a
   VERTICAL badge instead of a bar lying on the line -- which is what "horizontal, not vertical"
   meant. nowrap + flex:none keep its natural width, and the slot is square enough to hold the
   turned box: a bar of w x h needs (w+h)/sqrt(2) each way. */
/* THE DIAGONAL'S PLATE IS SMALLER THAN THE OTHER EIGHT, and that is what closes the gap: a bar
   turned 45 degrees needs (w+h)/sqrt(2) of room, so ITS size is what sets the height of the whole
   bottom strip -- and a tall strip pushes the straight plates away from the card. Shrinking it
   brings the row down and every plate closer, with the strip still agreeing with itself. */
.lc-slot.tilted { min-width: calc(var(--f) * 4.6); min-height: calc(var(--f) * 4.6); overflow: visible; }
.lc-slot.tilted .lc-line { padding: calc(var(--f) * 0.16) max(calc(var(--f) * 0.3), var(--radius-sm)); gap: calc(var(--f) * 0.18); }
/* A DIAGONAL'S PLATE SITS AT THE CARD'S CORNER, not in the middle of its own cell: its line ENDS at
   that corner, so the corner is the only place it can point from. Centred, it read as a plate that
   had drifted away -- the distance the user drew is measured to the CORNER, and no edge measurement
   sees it. Each one is pulled to the corner its diagonal runs out of. */
.lc-slot.tilted { align-items: flex-start; }
.lc-slot.tilted.up { justify-content: flex-end; }
.lc-slot.tilted.down { justify-content: flex-start; }
.lc-slot.tilted .lc-line .i svg { width: var(--t-xs); height: var(--t-xs); }
.lc-slot.tilted .lc-line { flex: none; white-space: nowrap; transform: rotate(-45deg); }
.lc-slot.tilted.up .lc-line { transform: rotate(45deg); }
.lc-line.t-aether .i { color: var(--amber); }
.lc-line.t-form .i { color: var(--jade); }
/* A line already CLAIMED is spent, and reads like the board's claimed rung: it keeps its colour but
   loses its weight, so what the eye finds is the lines still open. */
/* A CLAIMED LINE IS TOLD APART BY INTENSITY, not by hue, and that is not taste: in bloom --coral is
   a BLUE (#528CF7) sitting on a blue stage, so a lightly tinted fill said nothing there while it
   read fine in vanguard. Intensity survives every palette; a tint only survives the ones whose
   accent happens to differ from their background. */
.lc-line.done { background: color-mix(in srgb, var(--coral) 30%, transparent); border-color: var(--coral); }
.lc-line.done .q { color: var(--text); opacity: 0.9; }
.lc-line.done .i { opacity: 0.75; }
/* The pop-ups' body lives in BINGO_POPUP_STYLES, mounted with the shell: see there. */
/* The foot: the full-card plate left, the marks chip and the button pushed together right. */
.lc .ev-foot .ev-claim { margin-left: 0; align-self: stretch; display: inline-flex; align-items: center; justify-content: center; }
.lc-full { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.12); }
.lc-full .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
.lc-full .v { font-family: var(--body); font-size: var(--t-xs); line-height: 1; color: var(--text); }
.lc-full .v b { font-family: var(--display); font-weight: 700; color: var(--amber); font-variant-numeric: tabular-nums; }
/* The marks chip is the board's dice chip, which is the bar's Vigor chip. */
.lc-marks {
  min-width: 0; margin-left: auto; align-self: stretch; display: flex; align-items: center; gap: calc(var(--f) * 0.55);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3);
  border-radius: var(--radius-sm); font-size: var(--t-md);
  padding: calc(var(--f) * 0.3) max(0.62em, var(--radius-sm));
}
.lc-marks .g { flex: none; display: flex; align-items: center; color: var(--coral); }
.lc-marks .g svg { width: var(--t-xl); height: var(--t-xl); display: block; }
.lc-marks .value { font-family: var(--display); font-weight: 700; font-size: var(--t-md); line-height: 1; color: var(--text); font-variant-numeric: tabular-nums; }
/* THE RUN COUNTER IS ITS OWN BOX, left of the marks chip: how far you are from the next mark and
   how many marks you hold are two different facts, and one chip saying both read as a run-on. */
/* THE THREE PIECES OF THE FOOT ARE ONE SIZE (user's call): the run counter, the marks chip and the
   button. Heights are DERIVED with stretch, not typed -- the tallest sets the row and the other two
   follow it at every letter scale. The figure carries the same weight as the marks count beside it. */
.lc-runs {
  flex: none; margin-left: auto; align-self: stretch;
  /* gap 0: the figure and "/5 runs" are two flex items, and a gap read as "1 /5" (reported). */
  display: inline-flex; align-items: center; gap: 0;
  font-family: var(--display); font-size: var(--t-md); line-height: 1; color: var(--steel-faint);
  font-variant-numeric: tabular-nums; white-space: nowrap;
  /* THE SIDE PADDING IS IN em, so it grows with the FIGURE and not only with the base unit. At the
     --t-md size the text is 27px, and a padding scaled off --f gave it 7px of air, which reads as
     glued to the edge. Still floored by the radius, the other thing that can eat it.
     (Written without a colon after the token name on purpose: the probe greps for that shape to
     catch a sheet declaring its OWN ramp, and a comment saying it is enough to trip it.) */
  padding: 0 max(0.62em, var(--radius-sm));
  /* The SAME plate as the marks chip beside it, not a fainter one: they are two readings of the
     same thing (how close the next mark is, how many you hold) and a lighter box read as unfinished. */
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3);
  border-radius: var(--radius-sm);
}
.lc-runs b { color: var(--jade); font-weight: 700; }
/* With its own box beside it, the chip no longer pushes itself right: the run counter does. */
.lc-runs + .lc-marks { margin-left: calc(var(--f) * 0.4); }
`;var ca=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function ud(t){let e=Math.max(0,Number(t)-Date.now()),a=Math.floor(e/36e5),r=Math.max(1,Math.ceil((e-a*36e5)/6e4));return a>0?a+"h "+r+"m":r+"m"}function xn(t){if(!t)return"";let e=t;return[e.used,e.perDay,e.left,e.mult,e.live,e.closed,e.endsInDays,e.seen,e.resetsAt,e.excluded,e.art].join(":")}function kn(t){let e=t||{},a=Math.max(1,Math.round(Number(e.perDay)||Ka)),r=Math.max(0,Math.min(a,Math.round(Number(e.left)||0))),s=Math.max(2,Math.round(Number(e.mult)||Xa)),n=String(e.excluded||""),o=typeof e.art=="string"&&!!e.art.trim(),i=[];for(let c=0;c<a;c+=1)i.push('<span class="sp-pip'+(c<r?"":" done")+'">&times;'+s+"</span>");return'<div class="ev-pane sp'+(o?"":" flat")+'"'+(o?' style="background-image:url('+ca(e.art)+')"':"")+'><div class="sp-scrim"></div><button class="sv-q" type="button" data-supply-help aria-label="'+(e.help?"Close":"What is this event?")+'">'+Ke(e.help)+'</button><div class="sp-art"></div><div class="sp-track"><div class="sp-top"><div class="sp-id"><h3>'+ca(e.label||"Supply Line")+"</h3></div>"+(Number.isFinite(Number(e.endsInDays))?'<div class="sp-figs"><span class="fig dim">Ends in <b>'+Math.max(1,Math.round(Number(e.endsInDays)))+"</b>d</span></div>":"")+'</div><div class="sp-body"><div class="sp-pips">'+i.join("")+'</div><span class="sp-reset">Resets in '+ud(e.resetsAt)+'</span><p class="sp-rule">Your first <b>'+a+"</b> Materials runs each day drop <b>&times;"+s+"</b> loot."+(n?" "+ca(n)+" is not included.":"")+'</p></div><div class="ev-foot"><button class="ev-claim" type="button" data-supply-go>Go to Materials &raquo;</button></div></div></div>'}function _n(t=0,e=""){let a=Math.max(0,Math.round(Number(t)||0)),r='<span class="g">'+Q("asc")+"</span>",s=String(e||"");return[{k:"Double loot",a:"Your first "+Ka+" Materials runs each day drop "+r+" &times;"+Xa+". It burns on its own: fight as usual."},...s?[{k:"Where it works",a:"Every Materials stage except "+ca(s)+": its drop is one rolled relic, not a quantity."}]:[],{k:"Nothing extra to spend",a:"Runs cost their normal Vigor. Charges reset with the daily missions."},{k:"When it ends",a:(a?"It runs for "+a+" days. ":"")+"Unused charges do not carry over."}]}function Sn(t,{onGo:e}={}){if(!t)return;let a=t.querySelector("[data-supply-go]");a&&e&&a.addEventListener("click",()=>e())}var En=`
/* The seasonal's recipe, copied: the art is the WHOLE pane's background, cover, faces high.
   padding 0 AND gap 0: the plate below runs edge to edge (user's call -- the base pane's scroll
   gutter left a strip of painting beside it), and the art meets the plate at its steel edge. */
.ev-pane.sp { position: relative; gap: 0; padding: 0; background-size: cover; background-position: center 22%; overflow: hidden; }
/* No art: the same panel with its own gradient, so the screen reads deliberate instead of broken. */
.ev-pane.sp.flat { background-image: linear-gradient(150deg, var(--ink-2), var(--ink-3)); }
.sp-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 34%, transparent) 0%, color-mix(in srgb, var(--ink) 58%, transparent) 30%, color-mix(in srgb, var(--ink) 76%, transparent) 100%); }
/* The painting's own room: everything written lives on the plate below. */
.sp-art { flex: 1 1 auto; min-height: calc(var(--f) * 6); }
/* The plate's first row: the title left, the window's end right, on the black (user's call). */
.sp-top { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); }
.sp-id { min-width: 0; }
.sp-id h3 { margin: 0; min-width: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
/* BASELINE, not centre, and both numbers wear the accent: the welcome pane's row, copied. */
.sp-figs { flex: none; display: flex; align-items: baseline; gap: var(--sp-3); }
.sp-figs .fig { display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.3); font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
.sp-figs .fig b { font-weight: 700; color: var(--coral); }
.sp-figs .fig span { font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.sp-figs .fig.dim { color: var(--steel-faint); }
/* THE DARK BAND, edge to edge: the nw-track's ink and steel top edge, but FULL-BLEED (user's
   call) -- no card clip and no side borders, because a band that touches the pane's three edges
   with clipped corners reads as a plate that missed. It holds title, charges, rule and foot. */
.sp-track { position: relative; z-index: 1; flex: none; display: flex; flex-direction: column; gap: calc(var(--f) * 0.6); padding: var(--sp-2) var(--sp-3); background: color-mix(in srgb, var(--ink) 82%, transparent); border-top: 2px solid var(--steel-dark); }
/* Inside the band: the day's charges and the rule, centred. */
.sp-body { display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.55); padding: 0 var(--sp-3); text-align: center; }
.sp-pips { display: flex; gap: calc(var(--f) * 0.55); }
/* A charge plate speaks the tile vocabulary: dark plate, amber accent while it is still owed. */
.sp-pip {
  font-family: var(--display); font-weight: 700; font-size: var(--t-sm); line-height: 1;
  font-variant-numeric: tabular-nums; color: var(--text);
  padding: calc(var(--f) * 0.4) calc(var(--f) * 0.6);
  background: color-mix(in srgb, var(--amber) 20%, var(--ink));
  border: 1px solid var(--amber); border-radius: var(--radius-sm);
}
/* Spent: the card loses its edge, the login ladder's claimed treatment. */
.sp-pip.done {
  color: var(--steel-faint); background: color-mix(in srgb, var(--ink) 72%, transparent);
  border-color: color-mix(in srgb, var(--porcelain-3) 12%, transparent);
}
/* --steel-faint and never a SURFACE token as text: over the scrim the prose is secondary, and a
   surface colour as ink is the invisible-text family the probe guards. */
.sp-rule { margin: 0; max-width: 56ch; font-size: var(--t-sm); line-height: 1.5; color: var(--steel-faint); }
.sp-rule b { color: var(--text); }
/* The charges' own clock, right under them: jade like every refill reading.
   line-height 1.2 and not 1: at 1 the span's box is 2px shorter than its own line at 175% and the
   overflow check reads it as clipped -- the .bd-cell glyph's lesson. */
.sp-reset { font-size: var(--t-xs); line-height: 1.2; color: var(--jade); font-variant-numeric: tabular-nums; }
/* The foot lives INSIDE the plate (user's call: the button sat on the pane's very edge), so the
   plate's padding is its air. */
.sp .ev-foot { margin: 0; }
`;var vd=["Breakwater clash","Pier skirmish","Drowned checkpoint","The undertow","Last berth"],An=10,ht=[{key:"normal",label:"Normal",all:!0,tag:""},{key:"hard",label:"Hard",all:!1,tag:"Rare"},{key:"veryhard",label:"Very Hard",all:!1,tag:"Epic"}],Tn=t=>ht.find(e=>e.key===t)||ht[0],md=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function ke(t){return md[t]||String(t)}function Nn(t){if(t&&Array.isArray(t.nodes))return t.nodes;let e=t&&Array.isArray(t.storyNodes)?t.storyNodes:[],a=[];for(let r=0;r<e.length;r+=1)a.push({type:"story",title:e[r].title,goal:e[r].goal,guide:e[r].guide}),a.push({type:"combat",title:vd[r]||`Battle ${r+1}`,setup:""});return a}function Ot(t){return Nn(t).filter(e=>e.type==="combat").length}function Xe(t,e){let a=Nn(t),r=[],s=0,n=0;for(let o of a)o.type==="combat"?(r.push({...o,type:"combat",title:o.title||`Battle ${n+1}`,setup:o.setup||"",combatIndex:n}),n+=1):(r.push({...o,type:"story",title:o.title||`Story beat ${s+1}`,storyIndex:s}),s+=1);return Tn(e).all?r:r.filter(o=>o.type==="combat")}function In(t,e,a){return t==="normal"?!0:t==="hard"?(e.normal||0)>=An:(e.hard||0)>=(a||0)}function da(t,e,a){let r=e||{};for(let s=ht.findIndex(n=>n.key===t);s>=0;s-=1)if(In(ht[s].key,r,a))return ht[s].key;return"normal"}var Rn=`
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
/* AFTER the rule above on purpose -- same specificity, so source order decides. Pre-forging drops
   the difficulty row, and without this its panel lands in an auto row and hugs the head. */
.cap:has(.cap-pre) { grid-template-rows: auto minmax(0, 1fr); }
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
  width: calc(var(--f-text) * 2.8);
  height: calc(var(--f-text) * 2.8);
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

/* PRE-FORGING. The screen keeps its shape: the status takes the difficulty row's place and the
   node list stays, so the player watches the chapter fill in. No new surface, no second language. */
.cap-diff.pre { gap: var(--sp-3); }
.pre-state { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.6); }
/* The same blinking pip the loading screen uses for "this is running", and only while it is. */
.pre-state.-on { color: var(--coral); }
.pre-state.-on::before { content: ""; width: calc(var(--f) * 0.7); height: calc(var(--f) * 0.7); background: var(--coral); transform: rotate(var(--pip-rotate)); border-radius: var(--pip-radius); flex: none; animation: cap-pip 900ms steps(2, jump-none) infinite; }
@keyframes cap-pip { 50% { opacity: 0.25; } }
/* The count reads like the difficulty hint it replaces: muted sentence, figure in full contrast. */
.pre-count { font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.pre-count b { color: var(--text); font-weight: 700; }
.pre-acts { margin-left: auto; }
.mark.writing { color: var(--coral); }
/* The resume row is a node row that is not a node: coral rail, muted card, and its own action.
   It borrows the shape so it belongs, and the colour so it is not mistaken for one. */
.node-row.pre-row .node-idx { border-color: var(--coral); color: var(--coral); font-size: var(--t-sm); }
.node-row.pre-row .node-card { background: color-mix(in srgb, var(--surface) 34%, var(--ink-2)); border-left-color: var(--coral); }
.node-row.pre-row .kind { color: var(--coral); }
.node-row.pre-row .title { color: var(--text); }
.node-row.pre-row .meta { color: var(--steel-faint); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Cn='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',gd='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4l9 9M20 4l-9 9M14.5 14.5 20 20M9.5 14.5 4 20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',bd='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 4 13.5h6L11 22l9-11.5h-6Z" fill="#2E9E7B" stroke="#1C6B54" stroke-width="1.2" stroke-linejoin="round"/></svg>';var ur=t=>String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",");function yd(t,e){let a=t&&t[e.type==="combat"?"combat":"story"];if(!a)return"";let r=(o,i)=>'<span class="prize">'+Q(o)+i+"</span>",s=[];Number(a.funds)>0&&s.push(r("funds",ur(a.funds))),Number(a.aether)>0&&s.push(r("aether",ur(a.aether)));let n=Number(a.insight&&a.insight.shard)||0;return n>0&&s.push(r("xp",String(n))),Number(a.rank)>0&&s.push(r("rank","+"+ur(a.rank))),`<span class="meta"><span class="cost">${bd}${Number(a.vigor)||0}</span>${s.join("")}</span>`}function wd(t,e,a){return t<a?e.type==="story"?`<button class="act again" type="button" data-replay="${t}"><span>Read again</span><small>&#10004; cleared &middot; free</small></button>`:'<span class="mark done">&#10004; Cleared</span>':t===a?e.type==="story"?'<button class="act play" type="button" data-play><span>Play</span><small>story beat</small></button>':'<button class="act start" type="button" data-start><span>Start</span><small>auto-battle</small></button>':'<span class="mark locked">&#128274; Locked</span>'}function xd(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function kd(t,e){let a=t&&Number.isFinite(Number(t[e]))?Number(t[e]):null;return a===null?"Higher difficulty &middot; harder fight, better rewards":a<=0?"Opening chapter &middot; no CP asked yet":`Recommended CP <b>${xd(a)}</b> &middot; harder fight, better rewards`}function _d(t,e){if(t.type!=="story")return'<span class="mark locked">&#128274; Locked</span>';let a=Number(t.storyIndex),r=Number(e.done)||0;return a<r?'<span class="mark done">&#10004; Written</span>':a===Number(e.next)&&e.running?'<span class="mark writing">Writing&hellip;</span>':'<span class="mark locked">Queued</span>'}function Sd(t){let e=Number(t.total)||0,a=Math.min(Number(t.done)||0,e),r=t.running?"Pre-forging story&hellip;":"Pre-forging stopped";return`<div class="cap-diff pre"><span class="pre-state${t.running?" -on":""}">${r}</span><span class="pre-count"><b>${a}</b>&thinsp;/&thinsp;${e} beats</span><div class="diff-pills pre-acts">`+(t.running?"":'<button class="diff-pill" type="button" data-pre-retry>Continue</button>')+'<button class="diff-pill" type="button" data-pre-cancel>Cancel</button></div></div>'}function Ed(t){if(!t||!t.owed)return"";let e=Number(t.total)||0,a=Math.min(Number(t.done)||0,e);return`<div class="node-row pre-row"><div class="node-rail"><span class="node-idx">&#9670;</span></div><div class="node-card"><span class="kind">${Cn}Pre-forging</span><span class="title">Stopped at ${a} of ${e} beats</span><span class="meta">The rest are written when you reach them</span></div><div class="node-action"><button class="act start" type="button" data-pre-retry><span>Resume</span><small>writes the rest</small></button></div></div>`}function Ln({plan:t,difficulty:e,progress:a,chapterNumber:r=1,pay:s=null,cp:n=null,notice:o="",preforge:i=null}){let c=t&&t.title||"Chapter",l=Ot(t),d=da(e,a,l),h=Tn(d),v=Xe(t,d),u=a[d]||0,g=ht.map(k=>{let S=k.key===d,H=In(k.key,a,l),R=H?"":'<span class="lock">&#128274;</span>',m=k.key==="hard"?"Clear Normal to unlock":"Clear Hard to unlock";return`<button class="diff-pill" type="button" role="tab" aria-selected="${S}" data-diff="${k.key}"${H?"":` disabled title="${m}"`}>${k.label}${R}</button>`}).join(""),y=Number(a.normal||0)<An,b=i&&i.locked?i:null,x=v.map((k,S)=>{let H=b?S<u?"done":"locked":S<u?"done":S===u?"current":"locked",R=k.type==="story"?"Story":"Combat",m=String(S+1).padStart(2,"0"),L=y&&S>u?"???":f(k.title);return`<div class="node-row ${H}"><div class="node-rail"><span class="node-idx">${m}</span></div><div class="node-card"><span class="kind">${k.type==="story"?Cn:gd}${R}</span><span class="title">${L}</span>`+yd(s,k)+`</div><div class="node-action">${b?_d(k,b):wd(S,k,u)}</div></div>`}).join(""),E=u>=v.length?`<div class="cap-end">${h.all?"Chapter":f(h.label)} complete</div>`:"";return`
<div class="root">
  <div class="stage"></div>
  <div class="cap">
    <div class="cap-head">
      <button class="back" type="button" data-back>&#9664; Command</button>
      <div class="cap-id"><div class="eyebrow">Chapter ${ke(r)}</div><h2>${f(c)}</h2></div>
    </div>
    ${b?Sd(b):`<div class="cap-diff">
      <div class="diff-pills">${g}</div>
      <span class="diff-hint">${kd(n,d)}</span>
    </div>`}
    <div class="cap-scroll">
      <p class="notice"${o||b?"":" hidden"}>${b?"":f(o)}</p>
      <div class="node-list">${b?"":Ed(i)}${x}${E}</div>
    </div>
  </div>
</div>`}function Mn(t,e){let{plan:a,difficulty:r,progress:s,onBack:n,onDifficulty:o,onPlayStory:i,onStartCombat:c,onReplayStory:l}=e,d=t.querySelector("[data-back]");d&&d.addEventListener("click",()=>n&&n());let h=t.querySelector("[data-pre-retry]");h&&e.onPreforgeRetry&&h.addEventListener("click",()=>e.onPreforgeRetry());let v=t.querySelector("[data-pre-cancel]");v&&e.onPreforgeCancel&&v.addEventListener("click",()=>e.onPreforgeCancel());for(let k of t.querySelectorAll("[data-diff]"))k.addEventListener("click",()=>{k.disabled||o&&o(k.dataset.diff)});let u=da(r,s,Ot(a)),g=Xe(a,u),y=g[s[u]||0],b=t.querySelector("[data-play]");b&&y&&b.addEventListener("click",()=>i&&i(y));let x=t.querySelector("[data-start]");x&&y&&x.addEventListener("click",()=>c&&c(y));let E=s[u]||0;for(let k=0;k<E&&k<g.length;k+=1){if(g[k].type!=="story")continue;let S=t.querySelector('[data-replay="'+k+'"]');S&&S.addEventListener("click",((H,R)=>()=>l&&l(H,R))(g[k],k))}}var ha=[{id:"all",label:"All"},{id:"5",label:"5&#9733;",tone:"g"},{id:"4",label:"4&#9733;",tone:"e"}];function Ad(t){return(Number(t)||0).toLocaleString("en-US")}var vr={roster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20c0-2.8 2-4.6 4.6-4.6"/></svg>',formation:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="5.5" height="5.5"/><rect x="9.5" y="4" width="5.5" height="5.5"/><rect x="16" y="4" width="5.5" height="5.5"/><rect x="3" y="14" width="5.5" height="5.5"/><rect x="9.5" y="14" width="5.5" height="5.5"/></svg>',summon:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16l-1.4 12H5.4z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>',inventory:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5V18l-9 4.5L3 18z"/><path d="M3 9.5 12 14l9-4.5M12 14v8.5"/></svg>',events:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5V6h18v2.5a2 2 0 0 0 0 4V15H3v-2.5a2 2 0 0 0 0-4z"/><path d="M9 6v9" stroke-dasharray="2 2"/></svg>',missions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg>'},Pn='<svg class="hm-figure" viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>',Hn=[{id:"roster",label:"Units",live:!0},{id:"formation",label:"Formation",live:!0},{id:"summon",label:"Summon",live:!0},{id:"shop",label:"Shop",live:!0},{id:"inventory",label:"Inventory",live:!0}],Dn=[{id:"events",label:"Events",live:!0},{id:"missions",label:"Achievements",live:!0}];function Td(t,e){let a="";for(let r=0;r<t;r+=1){let s=r<e?' class="done"':r===e?' class="now"':"";a+=`<i${s}></i>`}return a}var On=[{id:"story",label:"Story",live:!0,empty:"Story backgrounds are painted as your chapters reach a new place."},{id:"cg",label:"Story CG",live:!0,empty:"Key images appear here as your story earns them."},{id:"banner",label:"Banners",live:!0,empty:"Banner art appears here once a banner has its picture painted."},{id:"bond",label:"Bond",live:!1},{id:"event",label:"Events",live:!1},{id:"unit",label:"Units",live:!1}],Nd=[{id:"default",label:"Default"},{id:"outfit",label:"Outfits"}],mr=10;function Id(t,e){if(t<=9)return Array.from({length:t},(n,o)=>o+1);let a=[1],r=Math.max(2,e-2),s=Math.min(t-1,e+2);r>2&&a.push(0);for(let n=r;n<=s;n+=1)a.push(n);return s<t-1&&a.push(0),a.push(t),a}function Bn({kind:t,title:e,rail:a,source:r,items:s,current:n,currentName:o,none:i,emptyHint:c,mode:l,page:d}){let h=a.map(S=>{let H=S.live!==!1;return'<button class="hm-pk-cat'+(H?"":" off")+'" type="button"'+(H?` aria-selected="${S.id===r}" data-pk-src="${f(S.id)}"`:" disabled")+`><span>${S.label}</span>`+(H?"":'<span class="soon">Soon</span>')+"</button>"}).join(""),v=S=>'<button class="hm-pk-card'+(S.key===n?" on":"")+`" type="button" data-pk-take="${f(S.key)}"><span class="shot">${S.url?`<img src="${f(S.url)}" alt="">`:Pn}</span><span class="nm">${f(S.name)}</span>`+(S.kit?`<span class="kit"><b>${Number(S.rarity)||0}&#9733;</b> ${f(S.kit)}</span>`:"")+(S.key===n?'<span class="tag">In use</span>':"")+"</button>",u=i?'<button class="hm-pk-card none'+(n?"":" on")+'" type="button" data-pk-take=""><span class="shot"><span>None</span></span><span class="nm">No background</span>'+(n?"":'<span class="tag">In use</span>')+"</button>":"",g=(i?[{none:!0}]:[]).concat(s),y=Math.max(1,Math.ceil(g.length/mr)),b=Math.min(Math.max(1,Number(d)||1),y),x=s.length?g.slice((b-1)*mr,b*mr).map(S=>S.none?u:v(S)).join(""):u+`<p class="hm-pk-empty">${f(c)}</p>`,E=y>1?'<div class="hm-pk-pages">'+Id(y,b).map(S=>S===0?'<span class="gap">&hellip;</span>':'<button class="hm-pk-page'+(S===b?" on":"")+'" type="button" data-pk-page="'+S+'"'+(S===b?' aria-current="page"':"")+">"+S+"</button>").join("")+"</div>":"",k=l?'<div class="hm-pk-mode">'+Nd.map(S=>'<button class="hm-pk-cat" type="button" aria-selected="'+(S.id===l)+'" data-pk-mode="'+S.id+'"><span>'+S.label+"</span></button>").join("")+"</div>":"";return`
  <div class="hm-pk-wrap">
    <div class="hm-pk-veil" data-pk-close></div>
    <div class="hm-pk ${t}">
      <div class="hm-pk-head">
        <span class="ttl">${f(e)}</span>
        <span class="cur">${f(o||"None")}</span>
        <button class="x" type="button" data-pk-close>Close</button>
      </div>
      <div class="hm-pk-body">
        <div class="hm-pk-cats">${h}</div>
        <div class="hm-pk-col">${k}<div class="hm-pk-grid">${x}</div>${E}</div>
      </div>
    </div>
  </div>`}function Rd(t,e,a){if(!t)return"";let r=e||{},s=a||{};if(t.slot==="bg"){let d=t.source||"story",h=r.backgrounds&&r.backgrounds[d]||[],v=s.bg?s.bg.key:"";return Bn({kind:"bg",title:"Background",rail:On,source:d,items:h,current:v,currentName:s.bg?s.bg.name:"",none:!0,emptyHint:(On.find(u=>u.id===d)||{}).empty||"",page:t.page})}let n=t.source||"all",o=t.mode==="outfit",c=(o?r.outfits||[]:r.units||[]).filter(d=>n==="all"||String(d.rarity)===n),l=o?s.unitOutfit||"":s.unit?s.unit.id:"";return Bn({kind:"units",title:"Home unit",rail:ha,source:n,mode:o?"outfit":"default",items:c,current:l,currentName:s.unit?s.unit.name:"",none:!1,emptyHint:o?"No outfits unlocked yet.":n==="all"?"No characters yet.":`No ${n}-star characters yet. Summon on any banner to find one.`,page:t.page})}function zn(t){let e=Number(t)||0;return e>=1e3?(e%1e3===0?String(e/1e3):(e/1e3).toFixed(1))+"k":String(e)}var Cd='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.2v.6"/></svg>',Ld=t=>(Hn.find(e=>e.id===t)||Dn.find(e=>e.id===t)||{label:"Battle"}).label;function Md(t,e){return!t||!t.action||!t.detail||e?"":'<button class="hm-next" type="button" data-next-go="'+f(t.go||"")+'"><span class="eyebrow">Next step</span><span class="big">'+f(t.action)+'</span><span class="title">'+f(t.detail)+'</span><span class="go">'+f(Ld(t.go))+"</span></button>"}function Fn(t,e){let a=Number(t)||0,r=Number(e)||0;return a>0&&r>0&&a>=r?'<button class="hm-warn" type="button" data-open-continuity aria-label="Story context is past your threshold \u2014 open Continuity"><span class="ic">'+Cd+'</span><span class="tx"><span class="k">Story context</span><span class="n"><b>'+zn(a)+"</b> / "+zn(r)+'</span></span><span class="go">Compress</span></button>':""}function qn({plan:t,chapterNumber:e=1,nodesDone:a=0,decor:r=null,contextTokens:s=0,warnTokens:n=0,pick:o=null,pickOptions:i=null,alerts:c=null,locks:l=null,step:d=null}){let h=!!(t&&typeof t=="object"&&t.title),v=`Chapter ${ke(e)}`,g=(h?Xe(t):[]).length||10,y=Math.max(0,Math.min(g,Number(a)||0)),b=r&&typeof r=="object"?r:{},x=b.bg&&b.bg.url?b.bg:null,E=b.unit||null,k=F=>l&&l[F.id]||null,S=F=>F.live!==!1&&!k(F),H=F=>{if(F.live===!1)return'<span class="soon">Soon</span>';let J=k(F);return J?'<span class="soon">'+f(J.rank?"Rank "+J.rank:"Prologue")+"</span>":""},R=F=>d&&d.go===F.id&&S(F)?'<span class="hm-dot"></span>':"",m=F=>`<button class="hm-tile ${F.id}${S(F)?"":" off"}" type="button"`+(S(F)?` data-go="${F.id}"`:" disabled")+">"+vr[F.id]+`<span class="nm">${f(F.label)}</span>`+H(F)+R(F)+"</button>",L=F=>c&&c[F.id]?'<span class="hm-dot"></span>':R(F),W=F=>S(F)?`<button class="hm-side" type="button" data-go="${F.id}"><span class="lbl">${vr[F.id]}<span>${f(F.label)}</span></span>`+L(F)+"</button>":`<button class="hm-side off" type="button" disabled><span class="lbl">${vr[F.id]}<span>${f(F.label)}</span></span>`+H(F)+"</button>";return`
<div class="root">
  <div class="hm-screen">
    ${x?`<img class="hm-bg" src="${f(x.url)}" alt="">`:'<div class="hm-ground"></div>'}
    <div class="hm-scrim"></div>

    <div class="hm-scene">
      <div class="hm-plate">
        <div class="hm-art">${E&&E.portrait?`<img src="${f(E.portrait)}" alt="">`:Pn}</div>
        <button class="hm-slot hm-slot-unit" type="button" data-pick="unit">
          <span class="nm">${f(E&&E.name?E.name:"No unit set")}</span>
          <span class="swap">Change</span>
        </button>
      </div>

      <div class="hm-right">
        <button class="hm-slot hm-slot-bg" type="button" data-pick="bg">
          <span class="nm">${f(x?x.name:"No background set")}</span>
          <span class="swap">Change</span>
        </button>

        <div class="hm-rail">${Dn.map(W).join("")}</div>
${Fn(s,n)}
${Md(d,!!Fn(s,n))}
        <button class="hm-cta" type="button" data-open-modes>
          <span class="eyebrow">${f(v)}</span>
          <span class="big">Battle</span>
          <span class="title">${f(h?t.title:"Your world is forged")}</span>
          <span class="nodes">${Td(g,y)}<span>${h?`${y} of ${g} cleared`:"Not started"}</span></span>
          <span class="go">${y>0?"Continue":"Begin"}</span>
        </button>
      </div>
    </div>

    <div class="hm-dock">${Hn.map(m).join("")}</div>
  </div>
${Rd(o,i,b)}
</div>`}function $n(t,{onOpenModes:e,onOpenRoster:a,onOpenSummon:r,onOpenFormation:s,onOpenInventory:n,onOpenShop:o,onOpenEvents:i,onOpenMissions:c,onPickOpen:l,onPickClose:d,onPickSource:h,onPickTake:v,onPickMode:u,onPickPage:g}){for(let x of t.querySelectorAll("[data-open-modes]"))x.addEventListener("click",()=>e&&e());let y={roster:a,formation:s,summon:r,inventory:n,shop:o,events:i,missions:c};for(let x of t.querySelectorAll("[data-go]")){let E=y[x.getAttribute("data-go")];x.addEventListener("click",k=>{k&&typeof k.stopPropagation=="function"&&k.stopPropagation(),E&&E()})}for(let x of t.querySelectorAll("[data-next-go]")){let E=x.getAttribute("data-next-go"),k=E==="modes"?e:y[E];x.addEventListener("click",S=>{S&&typeof S.stopPropagation=="function"&&S.stopPropagation(),k&&k()})}(t.querySelector(".root")||t).addEventListener("click",x=>{let E=L=>x&&x.target&&x.target.closest?x.target.closest(L):null,k=E("[data-pick]");if(k){l&&l(k.getAttribute("data-pick"));return}if(E("[data-pk-close]")){d&&d();return}let S=E("[data-pk-src]");if(S){h&&h(S.getAttribute("data-pk-src"));return}let H=E("[data-pk-mode]");if(H){u&&u(H.getAttribute("data-pk-mode"));return}let R=E("[data-pk-page]");if(R){g&&g(Number(R.getAttribute("data-pk-page"))||1);return}let m=E("[data-pk-take]");m&&v&&v(m.getAttribute("data-pk-take"))})}var jn=`
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
`;function Un(t){if(!t||!t.key)return"";let e=Math.max(0,Math.round(Number(t.gift)||0));return'<div class="ul-modal" role="dialog" aria-modal="true" aria-label="'+f(t.title||"Unlocked")+'"><div class="ul-veil"></div><div class="ul-panel"><div class="ul-top"><h3 class="ul-title">'+f(t.title||"")+'</h3></div><p class="ul-body">'+f(t.body||"")+"</p>"+(e?'<div class="ul-reward"><span class="k">'+f(t.giftLabel||"Reward")+'</span><span class="v">'+Q("aether")+"<b>"+Ad(e)+"</b><span>Aether</span></span></div>":"")+'<div class="ul-foot"><button class="ul-ok" type="button" data-unlock-ok="'+f(t.key)+'">'+(e?"Claim":"Continue")+"</button></div></div></div>"}function Wn(t,{onOk:e}={}){let a=t&&t.querySelector("[data-unlock-ok]");a&&e&&a.addEventListener("click",()=>e(a.getAttribute("data-unlock-ok")))}var Od="story";var Gn=[{value:"off",label:"Off"},{value:Od,label:"Story only"},{value:"art",label:"Story and key images"}];var Je=[{id:"world",label:"World",lead:"Chapters, banners and the cast you pull all grow from what you write here."},{id:"you",label:"You"},{id:"sources",label:"Sources",lead:"The forge <b>reads</b> your books &mdash; it never edits them."},{id:"look",label:"Look",lead:"All of it is per world, and none of it changes the game."},{id:"outfits",label:"Outfits",lead:"Alternate looks for the units you own, and the rules this world dresses them by.",whenEmpty:"Outfits are generated art, so they need an image connection. Pick one in <b>Look</b> to turn them on."},{id:"advanced",label:"Advanced",lead:"House rules for the writer. They <b>override</b> the built-in guidance wherever the two disagree."}],Hd=[{value:"English",label:"English"},{value:"Japanese",label:"\u65E5\u672C\u8A9E"},{value:"Korean",label:"\uD55C\uAD6D\uC5B4"},{value:"Chinese",label:"\u4E2D\u6587"},{value:"Spanish",label:"Espa\xF1ol"},{value:"French",label:"Fran\xE7ais"},{value:"German",label:"Deutsch"},{value:"Polish",label:"Polski"},{value:"Portuguese",label:"Portugu\xEAs"},{value:"Russian",label:"\u0420\u0443\u0441\u0441\u043A\u0438\u0439"}],Se=[{id:"scenario",step:"world",type:"textarea",label:"Your gacha world",required:"Describe your gacha world before continuing.",maxLength:4e3,placeholder:"e.g. A drowned neon city where salvaged spirits are bound into cards and fight for the tide-courts\u2026",hint:"A theme, a tone, and what you collect.",wide:!0},{id:"language",step:"world",settings:"sources",group:"narrator",type:"select",label:"Narration language",options:Hd},{id:"name",step:"world",type:"text",label:"Name this run",maxLength:80,placeholder:"Untitled run"},{id:"protagonist",step:"you",type:"custom",render:"personas",label:"Your protagonist",required:"Pick your protagonist \u2014 a Marinara persona.",hint:"Their full sheet shapes the narration, not just their name.",wide:!0},{id:"username",step:"you",type:"text",label:"Your name",maxLength:40,placeholder:"Commander",hint:"Shown on your HUD profile &mdash; not the protagonist."},{id:"connectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Main connection",required:"Pick the connection that will run this world.",hint:"Only text models are listed."},{id:"narrationConnectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Narrator connection",emptyOption:"Same as the main connection",hint:"Story prose. A smaller model is fine."},{id:"compressConnectionId",settings:"continuity",group:"narrator",type:"select",optionsFrom:"connections",label:"Compression connection",emptyOption:"Same as the main connection",hint:"Chapter summaries. A smaller model is fine."},{id:"story.preforge",settings:"continuity",group:"story",type:"select",label:"Pre-forge story",options:Gn,default:"off",hint:"Writes a chapter's beats as soon as it is forged, so they open instantly. Its menu stays shut until the chain finishes, and you can cancel it."},{id:"lore",step:"sources",settings:"sources",group:"lore",type:"custom",render:"lorebooks",label:"Lorebooks",help:"<b>Tick Cast only on a book whose entries are ALL characters.</b> Every entry is offered as a sheet to mint, so a place or a rule in that book gets minted as a unit.<br />Macros go in an entry&rsquo;s <b>description</b>: <b>[5STAR]</b> or <b>[4STAR]</b> picks its rarity slot, <b>[ORDER1]</b>, <b>[ORDER2]</b>&hellip; set the order inside that rarity, lowest first, and <b>[ROLE:MAGE]</b> / <b>[AFFINITY:FIRE]</b> ask the forge for that combat identity. Case does not matter.",wide:!0},{id:"lore.beat",step:"sources",settings:"sources",group:"lore",type:"toggle",label:"Use World books in story scenes",default:!1,showIf:t=>!!(t.lore&&Array.isArray(t.lore.worldIds)&&t.lore.worldIds.length),hint:"Off by default. World books are already read when a chapter is planned; this reads them again while each story scene is written.",help:"<b>Only the books you ticked World.</b> Those are already read once, when a chapter is planned. This reads them AGAIN each time a scene of that chapter is written.<br /><b>It costs.</b> Writing a scene already sends everything that happened before it &mdash; the longest prompt this game makes &mdash; and the book goes on top of that, every scene.<br />Which entries come along is decided by what the last two scenes actually said, plus what this one is about &mdash; so the book follows the story rather than repeating the same pages.<br />Turn it on when the story keeps getting facts about your world wrong. If it reads fine without it, leave it off."},{id:"hudStyle",step:"look",type:"custom",render:"styles",label:"HUD style",wide:!0},{id:"images.portraits",step:"look",settings:"sources",group:"images",type:"toggle",label:"Hero portraits",groupLabel:"Generated art",default:!0,showIf:t=>!!t["images.connectionId"],hint:"Painted right after your founding cast &mdash; it adds a few minutes to this setup."},{id:"images.connectionId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageConnections",label:"Image connection",emptyOption:"Off \u2014 no art at all"},{id:"images.backgrounds",step:"look",settings:"sources",group:"images",type:"toggle",label:"Backgrounds",showIf:t=>!!t["images.connectionId"],hint:"Separate from portraits because it multiplies how many images a world paints."},{id:"images.styleProfileId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageProfiles",label:"Portrait style",showIf:t=>!!t["images.connectionId"]},{id:"images.cgEvery",step:"look",settings:"sources",group:"images",type:"range",label:"Key images (CGs)",min:0,max:10,default:3,rangeLabel:t=>Number(t)<=0?"Off":Number(t)===1?"Every beat may carry one":`One every ${t} beats`,showIf:t=>!!t["images.connectionId"],hint:"A rare illustrated moment that takes over the scene. The story decides when; this decides how often it may."},{id:"images.outfits",step:"outfits",settings:"sources",group:"images",type:"toggle",label:"Outfits",default:!0,showIf:t=>!!t["images.connectionId"],hint:"The outfit system: alternate looks for your units."},{id:"images.outfitCanon",step:"outfits",settings:"sources",group:"images",type:"toggle",label:"Worn outfits are story canon",default:!1,showIf:t=>!!t["images.connectionId"]&&t["images.outfits"]!==!1,hint:"The story and its key images use the outfit a unit is wearing, not the clothes on its sheet."},{id:"guidelines.arc",step:"advanced",settings:"advanced",type:"textarea",label:"Story arc directives",maxLength:3e3,placeholder:"e.g. At least one named character must die every three chapters. The world gets colder and less forgiving as it goes.",hint:"Shapes the WHOLE story: what has to hold across chapters, not inside one.",help:"<b>These are orders, not hints.</b> They are sent with every chapter plan and they override the built-in guidance wherever the two disagree. This is the field for anything that has to hold ACROSS chapters: a rule that counts (a character dies every three chapters), a tone that has to move one way, something this story never does, or a promise it has to pay off.<br />So that any of those can be obeyed, the planner is also given the LEDGER of the story so far: every chapter already written, in order, with the one line it recorded about what it did here.<br />What they cannot change is the shape the game needs, and the chapters already written &mdash; those are canon and are never revisited. Applies to the next chapter forged.",wide:!0},{id:"guidelines.chapter",step:"advanced",settings:"advanced",type:"textarea",label:"Chapter plan directives",maxLength:2e3,placeholder:"e.g. Keep one recurring antagonist across chapters. End every chapter on a cliffhanger, never on a resolution.",hint:"Shapes WHAT happens: the arc, and which scenes a chapter must reach.",help:"<b>These are orders, not hints.</b> They are sent with every chapter plan and they override the built-in guidance wherever the two disagree, so this is where you get the story to go somewhere it would not go on its own.<br />What they cannot change is the SHAPE the game needs: ten nodes, the combat count, and the JSON. Those stay fixed no matter what you write here.<br />Applies to the next chapter forged. Chapters already written are canon and are never revisited.",wide:!0},{id:"guidelines.beat",step:"advanced",settings:"advanced",type:"textarea",label:"Story beat directives",maxLength:2e3,placeholder:"e.g. Write in present tense. Keep descriptions short and physical, and never summarise a scene the reader could watch.",hint:"Shapes HOW it is written: voice, pacing, wording, what a scene shows.",help:"<b>These are orders, not hints.</b> They are sent with every beat and they override the built-in guidance wherever the two disagree.<br />This is the field for VOICE and for what a scene is allowed to show &mdash; the plan decides that a scene happens, this decides how it reads.<br />What they cannot change is the shape: the segment format, the speaker rule and the length ceiling stay fixed. Applies to the next beat narrated; beats already written are canon.",wide:!0},{id:"guidelines.image",step:"advanced",settings:"advanced",type:"textarea",label:"Key image directives",maxLength:2e3,showIf:t=>!!t["images.connectionId"],placeholder:"e.g. Name what is visible rather than implying it: when clothing comes off, name the anatomy on show with the usual tags.",hint:"Shapes HOW a key image is described: what gets named, and how plainly.",help:"<b>These are orders, not hints.</b> They are sent with every beat that may carry a key image, and they override the built-in guidance wherever the two disagree.<br />The game deliberately takes NO position on how explicit a picture is &mdash; that is this field's job. Without it a model tends to soften on its own, describing what happened instead of what the picture shows, and the painter has nothing to draw there.<br />Write it in the register your image model reads: tags for a Danbooru-style checkpoint, plain words for a prose one. Applies to the next beat narrated; images already painted are canon.",wide:!0},{id:"guidelines.outfit",step:"outfits",settings:"advanced",type:"textarea",label:"Outfit directives",maxLength:6e3,showIf:t=>!!t["images.connectionId"]&&t["images.outfits"]!==!1,placeholder:"e.g. Modern streetwear only, no fantasy armour. Keep every outfit something a student could actually wear.",hint:"Shapes WHAT KIND of alternate outfits this world makes: their themes and their tone.",help:"<b>These are orders, not hints.</b> They are sent every time the game invents a new outfit theme, and they override the built-in guidance wherever the two disagree. This is where you decide what the wardrobe is <em>about</em>.<br />What they cannot change is the SHOT: the framing, the lighting and the character's own face and build are fixed by the game, so an outfit is always the same character in different clothes.<br />Applies to the next theme minted. Outfits already made keep their own text, which you can edit on the unit itself.",wide:!0}],Dd=[{id:"narrator",label:"Narrator"},{id:"lore",label:"Lorebooks"},{id:"images",label:"Images"},{id:"story",label:"Story"}];function gr(t){let e=pt(t);return Dd.map(a=>({...a,fields:e.filter(r=>r.group===a.id)})).filter(a=>a.fields.length)}function pt(t){return Se.filter(e=>e.settings===t)}function br(t){return Se.filter(e=>e.step===t)}function Ee(t,e){return!t.showIf||!!t.showIf(e||{})}function qd(t){return Se.filter(e=>Ee(e,t))}function Yn(t,e){for(let a of br(t)){if(!a.required||!Ee(a,e))continue;let r=e?e[a.id]:null;if(r==null||r===""||Array.isArray(r)&&!r.length)return a}return null}function pa(t,e){let a={};for(let r of qd(e||t)){let s=t[r.id];if(s===void 0)continue;let n=r.id.split("."),o=a;for(let i=0;i<n.length-1;i+=1){let c=n[i];o[c]=o[c]&&typeof o[c]=="object"?{...o[c]}:{},o=o[c]}o[n[n.length-1]]=s}return a}var Zn=`
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
/* THE SCROLL HAS TO LOOK LIKE ONE (user's report: a whole field was below the cut and only a
   stray mouse wheel found it). Two halves, and they answer different questions: the CHANNEL is
   reserved and its thumb is visible -- the theme paints thumbs in --steel-dark, which on this ground
   is a hairline nobody sees -- and that says HOW to get there. The gutter stays STABLE so reserving
   it cannot reflow the fields the moment the step gets long enough to scroll, which is the same
   reason .ob-booklist below reserves its own. */
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: max-content; gap: clamp(.6rem, 1.4vw, 1rem); align-content: start; flex: 1 1 auto; min-height: 0; overflow: auto; scrollbar-gutter: stable; scrollbar-color: var(--steel) color-mix(in srgb, var(--ink-3) 70%, transparent); }
.ob-grid::-webkit-scrollbar { width: .55rem; }
.ob-grid::-webkit-scrollbar-track { background: color-mix(in srgb, var(--ink-3) 70%, transparent); border-radius: 99px; }
.ob-grid::-webkit-scrollbar-thumb { background: var(--steel); border-radius: 99px; }
.ob-grid::-webkit-scrollbar-thumb:hover { background: var(--steel-faint); }
.ob-grid > * { min-width: 0; }
/* A field that needs the whole row says so in the schema, not here. */
.ob-wide { grid-column: 1 / -1; }
/* Its own class, not a borrowed one: it reused .ob-book, and a check counting one row per lorebook
   then counted the toggle as a book. A selector that lies is worse than a duplicated rule. */
.ob-toggle { display: grid; grid-template-columns: 1.3rem minmax(0, 1fr); gap: 0 .55rem;
  padding: .4rem .55rem; align-items: center;
  border-left: 2px solid transparent; cursor: pointer; }
.ob-toggle:hover { background: color-mix(in srgb, var(--steel-dark) 22%, transparent); }
/* EVERY font-size here reads the theme's ramp (--t-*), like settings.js: a rem does not follow the
   player's text control, and this sheet was the one screen left outside it (31 fixed rem). */
.ob-toggle b { display: block; color: var(--text); font-weight: 600; font-size: var(--t-xs); line-height: 1.2; }
.ob-toggle .bd { display: block; font-size: var(--t-tiny); line-height: 1.3; color: var(--steel-faint); }

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
  font-size: var(--t-xs);
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
  font-size: var(--t-xs);
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
/* THE DISPLAY FACE, like every other button in the game. With plain inherit these four kept the body
   font whatever the style said, so only Vanguard looked different -- and that was --case flipping to
   uppercase, not the typeface, which never changed at all. */
.ob-back {
  background: transparent;
  border: 1px solid var(--steel-dark);
  color: var(--steel-faint);
  font-family: var(--display); font-stretch: var(--stretch);
  font-size: var(--t-xs);
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
  font-family: var(--display); font-stretch: var(--stretch);
  font-weight: 700;
  font-size: var(--t-xs);
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
.ob-word .name { font-family: var(--title); font-size: var(--t-lg); font-weight: var(--title-weight); letter-spacing: .06em; line-height: .95; text-transform: var(--case); }
.ob-word .name b { color: var(--coral); }

/* NO reading-width cap: inside a 16:9 stage that never scrolls, HEIGHT is the scarce axis and width
   is the free one, so capping the width spends the scarce thing to save the abundant one. */
.ob-lead { margin: 0; color: var(--steel-faint); line-height: 1.45; font-size: var(--t-sm); }
/* The note a step shows in place of its own body. It reads as a STATE, not as another paragraph of
   the lead: bordered like a plate, so an empty step looks answered rather than unfinished. */
.ob-empty { margin: 0; padding: .8rem .9rem; color: var(--porcelain-3); line-height: 1.45;
  font-size: var(--t-sm); background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-left: 2px solid var(--amber); border-radius: var(--radius-sm); }
.ob-empty b { color: var(--text); }

.ob-field { display: flex; flex-direction: column; gap: .4rem; min-height: 0; }
/* A field with help is wrapped in .ob-labelrow, so a direct-child selector alone would drop the
   screen's type. Same fix as in settings.js. */
.ob-field > label,
.ob-field > .ob-labelrow > label { font-size: var(--t-xs); letter-spacing: .12em; text-transform: var(--case); color: var(--text); }
.ob-field .hint, .ob-field .ob-count { font-size: var(--t-xs); color: var(--steel-faint); line-height: 1.45; }
/* Tabular figures so the count does not jiggle the label row on every keystroke. */
.ob-count { margin-left: auto; flex: none; font-variant-numeric: tabular-nums; }
.ob-count.is-full { color: var(--coral); }

/* The label ROW anchors the tip, so it spans the FIELD: anchored to the button, a wide tip starting
   where the name ends would run off the right edge. */
.ob-labelrow { position: relative; display: flex; align-items: center; gap: .4rem; }
.ob-labelrow > label { flex: none; }
.ob-help { width: 1.15rem; height: 1.15rem; display: inline-grid; place-items: center; padding: 0; cursor: help;
  background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); border-radius: 50%;
  color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); line-height: 1; }
.ob-help:hover, .ob-help:focus-visible { color: var(--text); border-color: var(--steel); outline: none; }
/* DOWNWARD from the label: it opens over the field's own control and so cannot reach past the
   step's grid, which is the scroll region and would clip it. */
.ob-tip { position: absolute; z-index: 5; top: calc(100% + .35rem); left: 0; right: 0;
  padding: .5rem .65rem; background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--text);
  font-size: var(--t-xs); line-height: 1.5; text-align: left; text-transform: none; letter-spacing: normal;
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
  font-size: var(--t-sm);
  outline: none;
  --cut: 9px; clip-path: var(--clip-card); border-radius: var(--radius);
  /* background-COLOR, never the background SHORTHAND: the shorthand covers background-image and
     background-position, so the select's chevron animated its way in from the left edge. */
  transition: border-color .12s, background-color .12s;
}
.ob-control::placeholder { color: var(--steel-faint); }
.ob-control:hover { border-color: var(--steel); }
/* background-COLOR here too, and it is what the user saw: the shorthand RESETS everything it does
   not name, so focusing a select wiped its background-image -- the chevron vanished while the
   dropdown was open -- and sent background-position to 0% 0%. */
.ob-control:focus { border-left-color: var(--coral); border-color: var(--coral); background-color: var(--ink-2); }
textarea.ob-control { min-height: 7rem; resize: vertical; line-height: 1.5; }
select.ob-control {
  appearance: none; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%237E93AE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right .7rem center; background-size: 1.1rem; padding-right: 2.4rem;
}

.ob-forge {
  display: inline-flex; align-items: center; gap: .6rem;
  font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: .14em; text-transform: var(--case);
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
.ob-cancel { background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-size: var(--t-xs); letter-spacing: .14em; text-transform: var(--case); padding: .72rem 1.1rem; }
.ob-cancel:hover { border-color: var(--steel); color: var(--text); }
.ob-foot { margin: 0; font-size: var(--t-xs); color: var(--steel-faint); }
.ob-foot b { color: var(--text); font-weight: 600; }

.ob-error {
  font-size: var(--t-xs); line-height: 1.5; color: color-mix(in srgb, var(--alarm) 45%, #FFFFFF);
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
.ob-persona .pav { width: 3.4rem; height: 3.4rem; border-radius: 50%; background: linear-gradient(150deg,var(--glow-1),var(--glow-2)); display: grid; place-items: center; font-weight: 700; font-size: var(--t-md); color: var(--porcelain-3); overflow: hidden; }
.ob-persona .pav img { width: 100%; height: 100%; object-fit: cover; }
.ob-persona .pname { font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); line-height: 1.05; }
.ob-persona .pcomment { font-size: var(--t-tiny); color: var(--steel-faint); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ob-persona .pcheck { position: absolute; top: .35rem; right: .35rem; width: 1.15rem; height: 1.15rem; display: none; place-items: center; background: var(--coral); color: var(--on-coral); clip-path: polygon(0 0,100% 0,100% 100%,0 100%); }
.ob-persona[data-selected="true"] .pcheck { display: grid; }
.ob-persona .pactive { position: absolute; top: .35rem; left: .35rem; font-size: var(--t-tiny); letter-spacing: .12em; text-transform: var(--case); color: var(--jade); border: 1px solid color-mix(in srgb, var(--jade) 50%, transparent); padding: 0 .25rem; }
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
.ob-sw .lbl b { display: block; font-size: var(--t-xs); font-weight: 700; }
.ob-sw .lbl span { font-size: var(--t-tiny); opacity: .85; line-height: 1.25; display: block; }
.ob-sw .tick {
  position: absolute; top: .3rem; right: .3rem; z-index: 3; width: 1.05rem; height: 1.05rem;
  border-radius: 50%; background: var(--coral); color: var(--on-coral); display: none;
  place-items: center; font-size: var(--t-tiny);
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
.ob-bookhead { font-size: var(--t-tiny); letter-spacing: .12em; text-transform: var(--case); color: var(--steel);
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
.ob-book b { display: block; color: var(--text); font-weight: 600; font-size: var(--t-xs); line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-book .bd { display: block; font-size: var(--t-tiny); line-height: 1.3; color: var(--steel-faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-bx { justify-self: center; width: 1rem; height: 1rem; padding: 0; cursor: pointer; font: inherit;
  background: transparent; border: 1px solid var(--steel-dark); display: grid; place-items: center; color: transparent; }
.ob-bx:hover { border-color: var(--steel); }
.ob-bx[aria-checked="true"] { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
.ob-bx .bx-tick { width: 72%; height: 72%; display: block; }
.ob-books-empty { font-size: var(--t-xs); color: var(--steel-faint); padding: .5rem; line-height: 1.4; }
/* A range control and its live label. The label is the control's meaning; a bare slider number
   says nothing. Accent follows the shared ramp so Settings and the wizard read the same. */
.ob-range { display: flex; flex-direction: column; align-items: stretch; gap: .3rem; min-width: 0; }
.ob-slider { width: 100%; min-width: 0; accent-color: var(--coral); }
.ob-range-say { font-size: var(--t-xs); line-height: 1.4; color: var(--steel); }

/* The two budgets under the list. Each shows what the CHOSEN books actually weigh, because a token
   cap set without knowing that is a guess -- and the guess once let three entries of a
   twenty-two entry book through. */
.ob-budget { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
.ob-bud { min-width: 0; display: flex; align-items: baseline; gap: .35rem; }
.ob-bud > .k { font-size: var(--t-tiny); letter-spacing: .1em; text-transform: var(--case); color: var(--steel); }
.ob-bud input { width: 5.2rem; flex: none; font: inherit; font-size: var(--t-xs); padding: .2rem .35rem;
  background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); color: var(--text); }
.ob-bud input:focus { border-color: var(--coral); border-left-color: var(--coral); outline: none; }
.ob-bud > .w { min-width: 0; font-size: var(--t-tiny); color: var(--steel-faint); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.ob-bud > .w[data-over="true"] { color: var(--coral); }

.ob-personas-empty { font-size: var(--t-xs); color: var(--steel-faint); border: 1px dashed var(--steel-dark); padding: .7rem; --cut: 8px; clip-path: var(--clip-card); border-radius: var(--radius); }
`,$d='<svg class="ob-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="0,0 100,0 100,80 80,100 0,100" fill="var(--ink)"/><polygon points="4,4 96,4 96,78 78,96 4,96" fill="none" stroke="var(--steel-dark)" stroke-width="2.5"/><path d="M50 14 C53 41 59 47 86 50 C59 53 53 59 50 86 C47 59 41 53 14 50 C41 47 47 41 50 14 Z" fill="var(--coral)"/><path d="M50 30 C51.5 45 55 48.5 70 50 C55 51.5 51.5 55 50 70 C48.5 55 45 51.5 30 50 C45 48.5 48.5 45 50 30 Z" fill="var(--amber)" opacity=".9"/></svg>',Qn='Forge this world <span class="arrow">&#9656;</span>';function fa(t){let e=Math.max(1,Math.min(3,Number(t)||1));return new Array(e).fill('<div class="ob-bookhead ob-bookgrid"><span>Book</span><span>World</span><span>Cast</span></div>').join("")}var jd='<svg class="bx-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.4 6.6 11.5 12.5 4.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function Ud(t,e){let a=n=>e&&e[n]?"true":"false",r=(n,o)=>'<button class="ob-bx" type="button" role="checkbox" aria-label="'+o+": "+f(t.name)+'" aria-checked="'+a(n)+'" data-book="'+f(t.id)+'" data-role="'+n+'">'+jd+"</button>";return'<div class="ob-book ob-bookgrid'+(e&&(e.world||e.cast)?" on":"")+'"><span class="bt"><b>'+f(t.name)+"</b>"+(t.description?'<span class="bd">'+f(t.description)+"</span>":"")+"</span>"+r("world","World lore")+r("cast","Cast book")+"</div>"}function ft(t,e){let a=t.wide?" ob-wide":"",r=e&&e.hidden?" hidden":"",s=!!(e&&e.terse),n=t.help?'<button class="ob-help" type="button" aria-label="About '+ce(t.label||t.id)+'">?</button><span class="ob-tip" role="tooltip">'+t.help+"</span>":"",o=t.label&&t.type!=="toggle"?"<label"+(t.type==="text"||t.type==="textarea"||t.type==="select"?' for="ob-'+Bt(t.id)+'"':"")+">"+t.label+(t.required?' <span class="ob-req">*</span>':"")+"</label>":"",i=e&&typeof e.value=="string"?e.value.length:0,c=t.type==="textarea"&&t.maxLength?'<span class="ob-count'+(i>=t.maxLength?" is-full":"")+'">'+i+" / "+t.maxLength+"</span>":"",l=o&&(n||c)?'<div class="ob-labelrow">'+o+n+c+"</div>":o;t.groupLabel&&e&&e.wizard&&!l&&(l="<label>"+t.groupLabel+"</label>");let d=t.hint&&!s?'<span class="hint">'+t.hint+"</span>":"",h="";if(t.type==="custom")h=e&&e.custom?e.custom(t):"";else if(t.type==="textarea"){let v=e&&typeof e.value=="string"?e.value:"";h='<textarea id="ob-'+Bt(t.id)+'" class="ob-control" data-input="'+ce(t.id)+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+ce(t.placeholder)+'"':"")+">"+ce(v)+"</textarea>"}else if(t.type==="select"){let v=e&&typeof e.value=="string"?e.value:"",u=Array.isArray(t.options)?t.options.map(g=>'<option value="'+ce(g.value)+'"'+(v&&g.value===v?" selected":"")+">"+ce(g.label||g.value)+"</option>").join(""):"";h='<select id="ob-'+Bt(t.id)+'" class="ob-control" data-input="'+ce(t.id)+'">'+(t.emptyOption?'<option value="">'+ce(t.emptyOption)+"</option>":"")+u+"</select>"}else if(t.type==="range"){let v=e&&(typeof e.value=="number"||typeof e.value=="string"&&e.value!=="")?Number(e.value):NaN,u=Number.isFinite(v)?v:t.default!==void 0?Number(t.default):Number(t.min)||0;h='<div class="ob-range"><input id="ob-'+Bt(t.id)+'" class="ob-slider" data-input="'+ce(t.id)+'" type="range" min="'+(Number(t.min)||0)+'" max="'+(Number(t.max)||10)+'" step="1" value="'+u+'" aria-label="'+ce(t.label||t.id)+'" /><span class="ob-range-say" data-range-say="'+ce(t.id)+'">'+ce(typeof t.rangeLabel=="function"?t.rangeLabel(u):String(u))+"</span></div>"}else t.type==="toggle"?h='<label class="ob-toggle"><button class="ob-bx" type="button" role="checkbox" aria-checked="false" data-input="'+ce(t.id)+'" aria-label="'+ce(t.label||t.id)+'"><span>\u2713</span></button><span class="bt"><b>'+(t.boxLabel||t.label||"")+"</b>"+(t.boxHint&&!s?'<span class="bd">'+t.boxHint+"</span>":"")+"</span></label>":h='<input id="ob-'+Bt(t.id)+'" class="ob-control" data-input="'+ce(t.id)+'" type="'+(t.type==="number"?"number":"text")+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+ce(t.placeholder)+'"':"")+" />";return'<div class="ob-field'+a+'" data-field="'+ce(t.id)+'"'+r+">"+l+h+d+"</div>"}function Bt(t){return String(t).replace(/[^A-Za-z0-9_-]+/g,"-")}function Wd(){return'<span class="hint"><b>World</b>: what is true here &mdash; <b>constant</b> entries always, the rest on their keywords; what does not fit the budget is <b>dropped</b>. <b>Cast</b>: the forge picks the sheets it is about to mint &mdash; <b>5</b> when the world is forged, <b>2</b> per featured banner &mdash; and never offers the same character twice.</span>'}function ut(t,e){if(t.render==="personas")return'<div class="ob-personas" role="radiogroup" aria-label="Protagonist persona" data-personas><span class="ob-personas-empty">Loading personas&hellip;</span></div>';if(t.render==="styles")return'<div class="ob-styles" role="radiogroup" aria-label="HUD style">'+st.map(r=>{let[s,n,o]=r.swatch;return'<button class="ob-sw" type="button" role="radio" data-style-pick="'+r.id+'" aria-pressed="'+(r.id===rt)+'"><span class="mini" style="background:'+s+'"><i style="left:8%;top:9%;width:84%;height:14%;background:'+n+'"></i><i style="left:8%;top:30%;width:50%;height:36%;background:'+n+'"></i><i style="left:62%;top:30%;width:30%;height:16%;background:'+o+'"></i><i style="left:62%;top:50%;width:30%;height:16%;background:'+n+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+n+'"></i></span><span class="tick">&#10003;</span><span class="lbl"><b>'+r.label+"</b><span>"+r.description+"</span></span></button>"}).join("")+"</div>";if(t.render==="lorebooks"){let a=Math.max(1,Math.min(3,Number(e&&e.cols)||1));return'<div class="ob-booklist" role="group" aria-label="Lorebooks" data-cols="'+a+'" data-books>'+fa(a)+'<span class="ob-books-empty">Reading your library&hellip;</span></div><div class="ob-budget"><label class="ob-bud"><span class="k">World tk</span><input type="number" min="0" step="500" data-budget="world" aria-label="World token budget" /><span class="w" data-weight="world"></span></label><label class="ob-bud"><span class="k">Cast tk</span><input type="number" min="0" step="500" data-budget="cast" aria-label="Cast token budget" /><span class="w" data-weight="cast"></span></label></div>'+Wd()}return""}function Gd(t,e){let a=br(t.id),r=a.map(i=>ft(i,{custom:ut,hidden:!Ee(i,e||{}),value:e&&(typeof e[i.id]=="string"||typeof e[i.id]=="number")?e[i.id]:"",wizard:!0})).join(""),s=t.lead?'<p class="ob-lead ob-wide">'+t.lead+"</p>":"",o=t.whenEmpty&&a.length>0&&a.every(i=>!Ee(i,e||{}))?'<p class="ob-empty ob-wide">'+t.whenEmpty+"</p>":"";return'<div class="ob-grid">'+s+o+r+"</div>"}function eo({cancelable:t=!1,values:e={}}={}){let a=t?'<button class="ob-cancel" type="button" data-cancel>Cancel</button>':"",r=Je.map((n,o)=>'<button type="button" data-goto="'+(o+1)+'" data-state="'+(o===0?"active":"todo")+'" data-reachable="'+(o===0?"true":"false")+'"><span class="n">'+(o+1)+"</span>"+n.label+"</button>").join(""),s=Je.map((n,o)=>'<section class="ob-step" data-step="'+(o+1)+'" data-step-id="'+n.id+'"'+(o===0?"":" hidden")+">"+Gd(n,e)+(o===Je.length-1?'<p class="ob-foot">Forging generates your <b>first chapter</b> &mdash; takes a moment.</p>':"")+"</section>").join("");return`
<div class="ob-root">
  <div class="ob-frame">
  <div class="ob-intake">
    <div class="ob-brand">
      ${$d}
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
      <button class="ob-forge" type="button" data-forge hidden>${Qn}</button>
    </div>
  </div>
  </div>
</div>`}var Vd=new Set(["image_generation","video_generation"]),to="/api/gacha-forge";function Kn(t){return t===!0||t==="true"||t===1||t==="1"}function ce(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Yd(t){let e=String(t||"").trim().split(/\s+/).filter(Boolean),a=e[0]?e[0][0]:"",r=e[1]?e[1][0]:"";return(a+r).toUpperCase()||"?"}function Kd(t,e){let a=String(t?.id??""),r=String(t?.name??"Unnamed"),s=String(t?.comment??""),n=t?.avatarPath?`<span class="pav"><img src="${ce(t.avatarPath)}" alt=""></span>`:`<span class="pav">${ce(Yd(r))}</span>`;return`<button class="ob-persona" type="button" role="radio" data-persona="${ce(a)}" data-selected="false">`+(e?'<span class="pactive">Active</span>':"")+'<span class="pcheck">&#10003;</span>'+n+`<span class="pname">${ce(r)}</span><span class="pcomment">${ce(s)}</span></button>`}function Xn(t){return t?{personaId:String(t.id??""),name:String(t.name??"").trim(),comment:String(t.comment??""),description:String(t.description??""),personality:String(t.personality??""),appearance:String(t.appearance??""),backstory:String(t.backstory??""),scenario:String(t.scenario??""),tags:Array.isArray(t.tags)?t.tags.map(e=>String(e)):[],avatarPath:t.avatarPath?String(t.avatarPath):null}:null}function Jn(t){let e=t==null?"":String(t).trim();if(e==="")return null;let a=Number(e);return Number.isFinite(a)?a:null}function yr(t){for(let e of Se.filter(a=>a.type==="range")){let a=t.querySelector('[data-input="'+e.id+'"]'),r=t.querySelector('[data-range-say="'+e.id+'"]');!a||!r||a.addEventListener("input",()=>{r.textContent=typeof e.rangeLabel=="function"?e.rangeLabel(Number(a.value)):String(a.value)})}}function wr(t){if(!(!t||typeof t.querySelectorAll!="function"))for(let e of t.querySelectorAll("textarea[maxlength]")){let a=typeof e.closest=="function"?e.closest(".ob-field"):null,r=a?a.querySelector(".ob-count"):null,s=Number(e.getAttribute("maxlength"))||0;if(!r||!s)continue;let n=()=>{let o=String(e.value==null?"":e.value).length;r.textContent=o+" / "+s,r.classList.toggle("is-full",o>=s)};e.addEventListener("input",n),n()}}function xr(t,{initial:e,onChange:a}={}){let r=e&&typeof e=="object"?e:{},s={world:new Set(Array.isArray(r.worldIds)?r.worldIds:[]),cast:new Set(Array.isArray(r.castIds)?r.castIds:[])},n=new Map,o=h=>t.querySelector('[data-budget="'+h+'"]'),i=()=>({worldIds:[...s.world],castIds:[...s.cast],worldBudget:Jn(o("world")&&o("world").value),castBudget:Jn(o("cast")&&o("cast").value)}),c=()=>{a&&a(i())};function l(){for(let h of["world","cast"]){let v=t.querySelector('[data-weight="'+h+'"]');if(!v)continue;let u=0,g=!1;for(let k of s[h]){let S=n.get(k);typeof S=="number"?u+=S:g=!0}let y=o(h),b=y&&y.value!==""?Number(y.value):NaN,x=Number.isFinite(b)?b:Number(y&&y.placeholder);if(!s[h].size){v.textContent="",v.setAttribute("data-over","false");continue}let E=u>=1e3?Math.round(u/100)/10+"k":String(u);v.textContent="picked \u2248"+E+(g?"+":""),v.setAttribute("data-over",Number.isFinite(x)&&u>x?"true":"false")}}function d(h,v){let u=t.querySelector("[data-books]");if(u){if(v){u.innerHTML=fa(u.getAttribute("data-cols"))+'<span class="ob-books-empty">'+f(v)+"</span>";return}if(!h.length){u.innerHTML=fa(u.getAttribute("data-cols"))+'<span class="ob-books-empty">No lorebooks in your library yet. Write or import one in Marinara and it shows up here.</span>';return}u.innerHTML=fa(u.getAttribute("data-cols"))+h.map(g=>Ud(g,{world:s.world.has(g.id),cast:s.cast.has(g.id)})).join("");for(let g of u.querySelectorAll("[data-role]"))g.addEventListener("click",()=>{let y=g.getAttribute("data-book"),b=s[g.getAttribute("data-role")];if(!b)return;b.has(y)?b.delete(y):b.add(y),g.setAttribute("aria-checked",b.has(y)?"true":"false"),l();let x=g.parentNode;x&&x.classList&&x.classList.toggle("on",s.world.has(y)||s.cast.has(y)),c()})}}for(let h of["world","cast"]){let v=o(h),u=r[h+"Budget"];v&&u!==null&&u!==void 0&&Number.isFinite(Number(u))&&(v.value=String(u))}ge(to+"/lorebooks").then(h=>h&&h.ok&&typeof h.json=="function"?h.json():null).then(h=>{if(h&&h.ok&&Array.isArray(h.books)){for(let u of h.books)u&&typeof u.tokens=="number"&&n.set(u.id,u.tokens);let v=h&&h.defaults||{};for(let u of["world","cast"]){let g=o(u);g&&(g.placeholder=String(Number(v[u])||(u==="cast"?2e4:6e3)))}d(h.books,null),l()}else d([],"Could not read your lorebooks. The world can still be forged without them.")}).catch(()=>d([],"Could not read your lorebooks. The world can still be forged without them."));for(let h of["world","cast"]){let v=o(h);v&&(v.addEventListener("input",l),v.addEventListener("change",c))}return{value:i}}function ao(t,{onCreate:e,onCancel:a}){let r=A=>t.querySelector('[data-input="'+A+'"]'),s=A=>t.querySelector('[data-field="'+A+'"]'),n={};function o(){for(let A of Se){let N=s(A.id);N&&(N.hidden=!Ee(A,n))}}let i=r("scenario"),c=r("name"),l=r("username"),d=r("connectionId"),h=r("images.connectionId"),v=s("images.connectionId")&&s("images.connectionId").querySelector(".hint"),u=s("images.styleProfileId"),g=r("images.styleProfileId"),y=t.querySelector("[data-personas]"),b=t.querySelector(".ob-error"),x=t.querySelector("[data-forge]"),E=t.querySelector("[data-cancel]");E&&E.addEventListener("click",()=>a&&a());let k=Je.length,S=Array.from(t.querySelectorAll("[data-step]")),H=Array.from(t.querySelectorAll("[data-goto]")),R=t.querySelector("[data-back]"),m=t.querySelector("[data-next]"),L=1,W=1;function F(A){L=Math.min(k,Math.max(1,A)),W=Math.max(W,L);for(let N of S)N.hidden=Number(N.getAttribute("data-step"))!==L;for(let N of H){let I=Number(N.getAttribute("data-goto"));N.setAttribute("data-state",I===L?"active":I<W?"done":"todo"),N.setAttribute("data-reachable",I<=W?"true":"false")}R&&(R.hidden=L===1),m&&(m.hidden=L===k),x&&(x.hidden=L!==k),se("")}for(let A of H)A.addEventListener("click",()=>{let N=Number(A.getAttribute("data-goto"));N<=W&&F(N)});R&&R.addEventListener("click",()=>F(L-1)),m&&m.addEventListener("click",()=>{J(L)&&F(L+1)});function J(A){ee();let N=Je[A-1]&&Je[A-1].id,I=N?Yn(N,n):null;if(!I)return!0;se(I.required);let O=r(I.id);return O&&O.focus&&O.focus(),!1}function ee(){for(let A of Se){if(A.type==="custom")continue;let N=r(A.id);N&&(A.type==="toggle"?n[A.id]=N.getAttribute("aria-checked")==="true":A.type==="number"||A.type==="range"?n[A.id]=Number(N.value):n[A.id]=typeof N.value=="string"?N.value.trim():"")}o()}let ie=xr(t,{});yr(t),wr(t);let V=rt;n.hudStyle=rt;let Y=t.querySelector(".gf-arena");for(let A of t.querySelectorAll("[data-style-pick]"))A.addEventListener("click",()=>{V=A.getAttribute("data-style-pick"),n.hudStyle=V;for(let N of t.querySelectorAll("[data-style-pick]"))N.setAttribute("aria-pressed",String(N===A));Y&&Y.setAttribute&&Y.setAttribute("data-style",V)});let te=null,re=[];function me(A){te=A,n.protagonist=Xn(A);for(let N of re)N.el.setAttribute("data-selected",N.persona===A?"true":"false")}function se(A){b&&(b.textContent=A||"",b.hidden=!A)}ge("/api/connections").then(A=>A&&A.ok&&typeof A.json=="function"?A.json():Promise.reject(new Error("connections"))).then(A=>{let N=Array.isArray(A)?A:[],I=N.filter(K=>!Vd.has(String(K?.provider??"")));if(N.length===0){se("No connection configured. Create one in the engine settings and come back.");return}if(I.length===0){se("Your connections are image or video only, and none can run a world. Configure a text connection in the engine settings.");return}let O=I.map(K=>{let de=String(K?.id??""),Ne=String(K?.name??de),De=String(K?.model??"").trim(),xe=De?`${Ne} \u2014 ${De}`:Ne;return`<option value="${de}">${xe.replace(/</g,"&lt;")}</option>`}).join(""),$=I.find(K=>Kn(K?.isDefault))??I.find(K=>Kn(K?.fallbackForMain));for(let K of Se.filter(de=>de.optionsFrom==="connections")){let de=r(K.id);if(!de)continue;let Ne=K.emptyOption?`<option value="">${String(K.emptyOption).replace(/</g,"&lt;")}</option>`:"";de.innerHTML=Ne+O,K.emptyOption?de.value="":$?.id&&(de.value=String($.id))}}).catch(()=>se("Could not read the engine connections."));for(let A of Se.filter(N=>N.type==="toggle")){let N=r(A.id);N&&(n[A.id]=A.default===!0,N.setAttribute("aria-checked",n[A.id]?"true":"false"),N.addEventListener("click",()=>{n[A.id]=!n[A.id],N.setAttribute("aria-checked",n[A.id]?"true":"false")}))}let C=A=>{n["images.connectionId"]=A?h&&h.value||"on":"",o()};ge(`${to}/image-options`).then(A=>A&&A.ok&&typeof A.json=="function"?A.json():null).then(A=>{let N=A&&Array.isArray(A.connections)?A.connections:[];if(!N.length){v&&(v.textContent="No image connection is configured in the engine, so portraits stay off. Heroes show a silhouette when they speak."),h&&(h.disabled=!0);return}h&&(h.innerHTML='<option value="">Off</option>'+N.map(O=>`<option value="${f(O.id)}">${f(O.name)}</option>`).join(""));let I=A&&Array.isArray(A.profiles)?A.profiles:[];g&&(g.innerHTML=I.length?I.map(O=>`<option value="${f(O.id)}">${f(O.name)} &mdash; ${f(O.promptMode)}</option>`).join(""):'<option value="">Engine default</option>')}).catch(()=>{}),h&&h.addEventListener("change",()=>C(!!h.value)),Promise.all([ge("/api/characters/personas/list").then(A=>A&&A.ok&&typeof A.json=="function"?A.json():[]).catch(()=>[]),ge("/api/characters/personas/active").then(A=>A&&A.ok&&typeof A.json=="function"?A.json():null).catch(()=>null)]).then(([A,N])=>{if(!y)return;let I=Array.isArray(A)?A:A&&Array.isArray(A.items)?A.items:[];if(I.length===0){y.innerHTML='<span class="ob-personas-empty">No personas in Marinara yet &mdash; create one there first, then come back.</span>';return}let O=N&&N.id;y.innerHTML=I.map($=>Kd($,$.id===O)).join(""),re=[];for(let $ of I){let K=t.querySelector('[data-persona="'+String($.id??"")+'"]');K&&(re.push({persona:$,el:K}),K.addEventListener("click",()=>me($)))}me(I.find($=>$.id===O)||I[0])}),x?.addEventListener("click",async()=>{if(!(i?.value||"").trim()){se("Describe your gacha world before forging."),i?.focus?.();return}if(!te){se("Pick your protagonist \u2014 a Marinara persona.");return}if(!(d?.value||"")){se("Pick the connection that will run this world.");return}let I=(c?.value||"").trim(),O=(l?.value||"").trim(),$=Xn(te);se(""),x&&(x.disabled=!0,x.textContent="Forging\u2026");try{ee(),n.protagonist=$,n.hudStyle=V,n.lore=ie.value(),await e(pa(n))}catch(K){x&&(x.disabled=!1,x.innerHTML=Qn),se(`Could not start: ${K instanceof Error?K.message:String(K)}`)}}),F(1)}var vt=[{id:"continuity",kicker:"Story",label:"Continuity"},{id:"visual",kicker:"Look",label:"Visual"},{id:"sources",kicker:"World",label:"Sources"},{id:"advanced",kicker:"Writing",label:"Advanced"},{id:"help",kicker:"Guide",label:"Help"},{id:"changelog",kicker:"Updates",label:"Changelog"},{id:"debug",kicker:"Diagnostics",label:"Debug"}],mt="visual",ro=5,_r=3e4,Er=[2e4,3e4,5e4,1e5],lo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Sr='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5 4 12l5 7M15 5l5 7-5 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',so='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4 10-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';function ua(t){let e=Number(t)||0;return e>=1e3?(e%1e3===0?String(e/1e3):(e/1e3).toFixed(1))+"k":String(e)}function va(t){return(Number(t)||0).toLocaleString("en-US")}function Xd({contextTokens:t,warnTokens:e,run:a}){let r=Number(t)||0,s=Number(e)||_r,n=s>0?Math.min(100,Math.round(r/s*100)):0,o=Er.map(i=>'<button class="st-chip" type="button" data-warn="'+i+'" aria-pressed="'+(i===s)+'">'+ua(i)+"</button>").join("");return'<div class="st-plate"><div class="hd"><h3>Model context</h3><span class="st-figs"><b data-meter-n>'+va(r)+"</b>&nbsp;/&nbsp;<span data-meter-max>"+va(s)+'</span>&nbsp;tokens</span></div><div class="st-track"><i data-meter-bar style="width:'+n+'%"></i><span class="st-mark" data-meter-mark data-label="'+ua(s)+'" style="left:100%"></span></div><div class="st-thresh"><span class="st-lbl">Alert at</span><div class="st-chips" role="group" aria-label="Alert threshold">'+o+'</div><span class="st-or">or</span><span class="st-custom"><input type="number" data-warn-custom min="1" step="5" value="'+Math.round(s/1e3)+'" aria-label="Custom threshold in thousands of tokens"><span class="st-k">k</span></span></div><div class="st-banner">'+lo+'<span>Long story &mdash; compress old chapters to keep turns fast and cheap. Nothing is lost.</span></div></div><div class="st-plate"><div class="hd"><h3>Chapters</h3></div><p>Compressing swaps the copy the model reads for a summary. The beats stay readable in the log.</p>'+kr("narrator").map(i=>ft(i,{custom:ut,terse:!1,value:no(a,i)})).join("")+'<div class="st-list" data-continuity-list><p class="st-empty">Loading&hellip;</p></div><div data-continuity-fold></div></div>'+(kr("story").length?'<div class="st-plate"><div class="hd"><h3>Pre-forging</h3></div><p>A forged chapter can write all of its beats at once, so every scene opens with no wait.</p>'+kr("story").map(i=>ft({...i,label:""},{custom:ut,terse:!1,value:no(a,i)})).join("")+"</div>":"")}function kr(t){let e=gr("continuity").find(a=>a.id===t);return e?e.fields:[]}function no(t,e){let a=zt(t,"continuity")[e.id];return typeof a=="string"?a:""}function co({chapters:t,fold:e=null,merging:a=!1,blocked:r=!1}={}){let s=Array.isArray(t)?t:[];if(s.filter(h=>h&&h.compressed).length<2)return"";if(!!!(e&&e.on))return'<button class="st-fold-open" type="button" data-fold-start>'+Sr+"Combine compressed chapters</button>";let i=Number(e&&e.from)||0,c=Number(e&&e.to)||0,l=i?s.filter(h=>h.compressed&&h.chapter>=i&&h.chapter<=c).length:0,d=i&&c>i?"chapters "+i+"&ndash;"+c:"";return'<div class="st-fold"><p class="st-fold-warn">'+lo+'<span>A merge rewrites those summaries into one, from the summaries themselves &mdash; detail thins each time. Use it on chapters the story has left behind.</span></p><div class="st-fold-act"><span class="st-fold-sel">'+(r?"Those are not next to each other &mdash; a chapter between them is not compressed yet.":l>=2?"Merging "+d:"Pick two entries: the first and the last")+'</span><button class="st-compress -ghost" type="button" data-fold-cancel>Cancel</button><button class="st-compress -go" type="button" data-fold-go'+(l>=2&&!a?"":" disabled")+">"+(a?"Merging&hellip;":"Merge "+(l>=2?l+" entries":""))+"</button></div></div>"}function Jd(t){let e=Number(t&&t.chapter)||0,a=Math.max(e,Number(t&&t.to)||e);return a>e?"Chapters "+e+"&ndash;"+a:""}function oo(t){let e=Number(t&&t.chapter)||0;return Math.max(1,Math.max(e,Number(t&&t.to)||e)-e+1)}function ho(t,e=null,a=null){if(!Array.isArray(t)||!t.length)return'<p class="st-empty">No chapters yet.</p>';let r=!!(a&&a.on),s=Number(a&&a.from)||0,n=Number(a&&a.to)||0;return t.map(o=>{let i=String(o.chapter).padStart(2,"0"),c=Jd(o),l=r&&s&&o.chapter>=s&&o.chapter<=n,d,h,v,u;return o.compressed?(d="-compressed",h='<span class="st-status -compressed">Compressed</span>',v=r?'<button class="st-pick'+(l?" on":"")+'" type="button" role="checkbox" aria-checked="'+l+'" data-pick="'+o.chapter+'" aria-label="Select '+(c||"chapter "+o.chapter)+'">'+(l?so:"")+"</button>":'<span class="st-done">'+so+"done</span>",u=oo(o)>1?oo(o)+" chapters &middot; merged":(o.storyBeats||ro)+" beats &middot; compressed"):o.complete?(d="-ready",h='<span class="st-status -ready">Complete</span>',v=e!=null&&Number(e)===Number(o.chapter)?'<button class="st-compress" type="button" disabled data-compress="'+o.chapter+'">'+Sr+"Compressing&hellip;</button>":'<button class="st-compress" type="button" data-compress="'+o.chapter+'">'+Sr+"Compress</button>",u=(o.storyBeats||0)+" beats narrated"):(d="-playing",h='<span class="st-status -playing">In progress</span>',v='<span class="st-lock">Finish to compress</span>',u=(o.storyBeats||0)+" of "+ro+" beats"),'<article class="st-ch '+d+(l?" -picked":"")+'"><div class="st-idx">'+i+"</div><div><h4>"+(c||f(o.title))+"</h4><p>"+u+"</p></div>"+h+v+"</article>"}).join("")}function Ze(t,e,a){let r=Number(e)||0,s=Number(a)||0;for(let h of[t.querySelector(".root"),t.querySelector(".gf-bar")])h&&(r>0&&s>0&&r>=s?h.setAttribute("data-ctx","warn"):h.removeAttribute("data-ctx"));let n=t.querySelector("[data-ctx-n]");n&&(n.textContent=ua(r));let o=t.querySelector("[data-meter-n]");o&&(o.textContent=va(r));let i=t.querySelector("[data-meter-max]");i&&(i.textContent=va(s));let c=t.querySelector("[data-meter-mark]");c&&c.setAttribute("data-label",ua(s));let l=t.querySelector("[data-meter-bar]");l&&l.style&&(l.style.width=(s>0?Math.min(100,Math.round(r/s*100)):0)+"%");for(let h of Er){let v=t.querySelector('[data-warn="'+h+'"]');v&&v.setAttribute("aria-pressed",String(h===s))}let d=t.querySelector("[data-warn-custom]");d&&t.activeElement!==d&&(d.value=String(Math.round(s/1e3)))}function Zd(t){let e=It(t);return st.map(a=>{let[r,s,n]=a.swatch;return'<button class="st-sty" type="button" data-style-set="'+a.id+'" aria-pressed="'+(a.id===e)+'"><span class="st-mini" style="background:'+r+'"><i style="left:8%;top:10%;width:84%;height:14%;background:'+s+'"></i><i style="left:8%;top:31%;width:50%;height:34%;background:'+s+'"></i><i style="left:62%;top:31%;width:30%;height:15%;background:'+n+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+s+'"></i></span><span class="st-tick">&#10003;</span><span class="st-swlbl"><b>'+a.label+"</b><span>"+a.description+"</span></span></button>"}).join("")}function Qd(t){let e=nt(t);return Nt.map(a=>'<button class="st-chip" type="button" data-text-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function eh(t){let e=ot(t);return Gt.map(a=>'<button class="st-chip" type="button" data-narr-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function th({hudStyle:t,textScale:e,narrationScale:a}){return'<div class="st-plate"><div class="hd"><h3>HUD style</h3></div><div class="st-styles">'+Zd(t)+'</div></div><div class="st-plate"><div class="hd"><h3>Interface text</h3></div><div class="st-chips" role="group" aria-label="Interface text size">'+Qd(e)+'</div></div><div class="st-plate"><div class="hd"><h3>Narration text</h3></div><div class="st-chips" role="group" aria-label="Narration text size">'+eh(a)+"</div></div>"}function po(t,e){let a=t;for(let r of String(e).split(".")){if(!a||typeof a!="object")return;a=a[r]}return a}function zt(t,e){let a={};for(let r of pt(e)){let s=po(t,r.id);a[r.id]=s===void 0?r.default:s}return a}function ma(t,e){let a={};for(let r of Se){let s=po(t,r.id);a[r.id]=s===void 0?r.default:s}return e?{...a,...e}:a}function fo(t,e,a){return pa(a,ma(t,a))}function ah(t,e){return gr("sources").map(a=>{let r=a.fields.length===1,s=o=>String(o.label||"").trim().toLowerCase()===String(a.label||"").trim().toLowerCase(),n=a.fields.map(o=>ft(r||s(o)?{...o,label:""}:o,{custom:ut,hidden:!Ee(o,e),terse:!0,value:typeof t[o.id]=="string"||typeof t[o.id]=="number"?t[o.id]:""})).join("");return'<div class="st-plate" data-group="'+f(a.id)+'"><div class="hd"><h3>'+f(a.label)+'</h3></div><div class="ob-grid">'+n+"</div></div>"}).join("")+'<p class="st-foot">Applies to what this world generates next; nothing already made is redrawn.</p>'}function rh(t,e){return pt("advanced").map(a=>'<div class="st-plate"'+(Ee(a,e)?"":" hidden")+'><div class="ob-grid">'+ft(a,{custom:ut,hidden:!Ee(a,e),terse:!1,value:typeof t[a.id]=="string"||typeof t[a.id]=="number"?t[a.id]:""})+"</div></div>").join("")+'<p class="st-foot">Applies to what this world makes next; what is already made stays as it is.</p>'}function sh(t){let e=t&&t.status||"idle";if(e==="loading")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Reading&hellip;</div></div>';if(e==="error")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Could not read the lorebook status.</div></div>';if(e!=="ready")return"";let a=t&&t.data||{};if(!a.enabled)return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">This world uses no lorebooks. Pick them in Sources.</div></div>';let r=c=>Number.isFinite(Number(c))?Number(c).toLocaleString("en-US"):"&mdash;",s=(c,l,d)=>{if(!l)return"";let h=l.dropped>0;return'<span class="st-tl-tot"><i>'+c+"</i><b>"+r(l.entries)+" / "+r(l.pool)+' entries</b></span><span class="st-tl-tot"><i>tokens</i><b>'+r(l.tokens)+" / "+r(d)+"</b></span>"+(h?'<span class="st-tl-warn">'+r(l.dropped)+" entr"+(l.dropped===1?"y":"ies")+" will NOT fit &mdash; the generator works from a fragment</span>":"")},n=(Array.isArray(a.next)?a.next:[]).map(c=>c.uses===!1?'<div class="st-tl-row"><span class="st-tl-l">'+f(c.label)+'</span><span class="st-tl-o">no lore</span></div><div class="st-tl-note">'+f(c.why||"")+"</div>":'<div class="st-tl-row"><span class="st-tl-l">'+f(c.label)+'</span></div><div class="st-tl-totals">'+s("world",c.world,a.budgets&&a.budgets.world)+s("cast",c.cast,a.budgets&&a.budgets.cast)+"</div>").join(""),o=a.library||{};return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks &mdash; what the next call carries</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+('<div class="st-tl-totals"><span class="st-tl-tot"><i>world books</i><b>'+r(o.world&&o.world.books)+'</b></span><span class="st-tl-tot"><i>cast books</i><b>'+r(o.cast&&o.cast.books)+'</b></span><span class="st-tl-tot"><i>already minted</i><b>'+r(a.minted)+"</b></span>"+((a.missing||[]).length?'<span class="st-tl-warn">'+(a.missing||[]).length+" book(s) this world points at no longer exist</span>":"")+"</div>")+n+"</div>"}function nh(){return'<section class="st-plate st-build"><div class="hd"><h3>Build</h3></div><div class="st-build-row"><span class="k">Package version</span><b data-build-version>v'+f(Yt)+"</b></div></section>"}function Ar(t,e){return nh()+sh(t)+lh(e)}function oh(t){let e=r=>!!(t&&typeof t.has=="function"&&t.has(r));return'<div class="st-help">'+Cs.map(r=>{let s=Ls(r.id);return s.length?'<section class="st-plate st-help-topic"><div class="hd"><h3>'+f(r.label)+'</h3></div><div class="st-help-list">'+s.map(n=>Xt(n,e(n.id))).join("")+"</div></section>":""}).join("")+"</div>"}function ih(t){let e=Kt(t);return'<div class="st-cl">'+e.releases.map(a=>'<section class="st-plate st-cl-rel'+(a.now?" now":"")+'"><div class="hd"><h3>'+f(a.version)+"</h3>"+(a.now?'<span class="k">Current</span>':"")+'</div><div class="st-cl-cols">'+a.body+"</div></section>").join("")+(e.hidden>0?'<button class="st-compress -ghost" type="button" data-log-more>Show previous version changelog</button>':"")+"</div>"}function lh(t){let e=t&&t.status||"idle",a=t&&Array.isArray(t.entries)&&t.entries||[],r=t&&t.totals||null,s=l=>Number.isFinite(l)?Number(l).toLocaleString("en-US"):"&mdash;",n=l=>{let d=new Date(Number(l)||0),h=v=>String(v).padStart(2,"0");return h(d.getHours())+":"+h(d.getMinutes())+":"+h(d.getSeconds())},o=l=>{if(l.outcome==="ok")return"";let d=[],h=[],v=String(l.finishReason||"");v&&h.push("finish <b>"+f(v.slice(0,24))+(v.length>24?"&hellip;":"")+"</b>"),Number.isFinite(l.reasoning)&&h.push("thinking <b>"+s(l.reasoning)+"</b>"),h.length&&d.push('<div class="st-tl-why">'+h.join(" &middot; ")+"</div>");let u=String(l.refused||"");u&&d.push('<div class="st-tl-said"><i>'+(l.outcome==="failed"?"error":"refused")+"</i>"+f(u)+"</div>");let g=String(l.sample||"");return g&&d.push('<details class="st-tl-raw"><summary><i>wrote</i>'+f(g.slice(0,160))+"</summary><pre>"+f(g)+"</pre></details>"),d.join("")},i;return e==="loading"?i='<div class="st-tl-msg">Reading&hellip;</div>':e==="error"?i='<div class="st-tl-msg">Could not read the token log.</div>':a.length?i='<div class="st-tl-rows">'+a.map(l=>'<div class="st-tl-row'+(l.outcome==="ok"?"":" bad")+'"'+(l.connection?' title="connection '+f(l.connection)+'"':"")+'><span class="st-tl-t">'+n(l.at)+'</span><span class="st-tl-l">'+f(l.label)+(l.attempt>1?'<b class="st-tl-retry">retry '+l.attempt+"</b>":"")+(l.model?'<b class="st-tl-model">'+f(l.model)+"</b>":"")+'</span><span class="st-tl-u st-tl-up">'+s(l.sent)+'</span><span class="st-tl-u st-tl-dn">'+s(l.received)+'</span><span class="st-tl-o">'+f(l.outcome)+"</span>"+o(l)+"</div>").join("")+"</div>":i='<div class="st-tl-msg">No model calls recorded for this world yet.</div>','<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Model calls</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+(r?'<div class="st-tl-totals"><span class="st-tl-tot"><i>sent</i><b>'+s(r.sent)+'</b></span><span class="st-tl-tot"><i>received</i><b>'+s(r.received)+'</b></span><span class="st-tl-tot"><i>calls</i><b>'+s(r.calls)+"</b></span>"+(r.cached?'<span class="st-tl-tot"><i>of that cached</i><b>'+s(r.cached)+"</b></span>":"")+(r.cacheWrite?'<span class="st-tl-tot"><i>cache writes</i><b>'+s(r.cacheWrite)+"</b></span>":"")+(r.unreported?'<span class="st-tl-warn">'+r.unreported+" call(s) reported no usage &mdash; the totals are short by that much</span>":"")+(r.dropped?'<span class="st-tl-warn">'+s(r.dropped)+" older call(s) dropped past the "+s(r.capped)+"-row cap</span>":"")+"</div>":"")+i+'<p class="st-tl-note">Every model call this world has ever made, newest first &mdash; kept across restarts. Portrait generation is not here: it goes to the engine over HTTP, not through the language model.</p></div>'}function uo({category:t=mt,backLabel:e="Home",contextTokens:a=0,warnTokens:r=_r,hudStyle:s="",textScale:n=null,narrationScale:o=null,tokenLog:i=null,loreStatus:c=null,run:l=null,helpOpen:d=null,logShown:h=null}={}){let v=vt.some(S=>S.id===t)?t:mt,u=vt.find(S=>S.id===v)||vt[0],g=Number(a)||0,y=Number(r)||_r,b=g>0&&g>=y,x=vt.map(S=>'<button class="st-sect" type="button" role="tab" aria-selected="'+(S.id===v)+'" data-view="'+S.id+'"><span class="k">'+f(S.kicker)+'</span><span class="n">'+f(S.label)+"</span></button>").join(""),E={continuity:()=>Xd({contextTokens:g,warnTokens:y,run:l}),visual:()=>th({hudStyle:s,textScale:n,narrationScale:o}),sources:()=>ah(zt(l,"sources"),ma(l)),advanced:()=>rh(zt(l,"advanced"),ma(l)),help:()=>oh(d),changelog:()=>ih(h),debug:()=>Ar(c,i)},k=E[v]?E[v]():"";return'<div class="root"'+(b?' data-ctx="warn"':"")+'><div class="stage"></div><section class="screen" data-screen="settings"><div class="head"><button class="back" type="button" data-settings-back>&#9664; '+f(e)+'</button><div class="head-id"><div class="eyebrow">Settings</div><h2>'+f(u.label)+'</h2></div></div><div class="body"><div class="st-rail" role="tablist">'+x+'</div><div class="st-pane" data-view-body="'+v+'">'+k+"</div></div></section></div>"}function vo(t,{open:e,category:a,run:r,onOpen:s,onBack:n,onCategory:o,onStyle:i,onTextScale:c,onNarrationScale:l,onWarnTokens:d,onSources:h}={}){for(let u of t.querySelectorAll('[aria-label="Game settings"]'))u.addEventListener("click",()=>s&&s(mt));for(let u of t.querySelectorAll("[data-open-continuity]"))u.addEventListener("click",()=>s&&s("continuity"));if(!e)return;for(let u of[t.querySelector(".root"),t.querySelector(".gf-bar")])u&&u.addEventListener("click",g=>{let y=x=>g&&g.target&&g.target.closest?g.target.closest(x):null;if(y("[data-settings-back]")){n&&n();return}let b=y("[data-view]");b&&o&&o(b.getAttribute("data-view"))});let v=t.querySelector(".st-pane");if(v&&v.addEventListener("click",u=>{u&&u.target&&u.target.closest&&u.target.closest("[data-token-refresh]")&&o&&o("debug")}),a==="visual"){for(let u of t.querySelectorAll("[data-style-set]"))u.addEventListener("click",()=>{let g=u.getAttribute("data-style-set");for(let y of t.querySelectorAll("[data-style-set]"))y.setAttribute("aria-pressed",String(y===u));i&&i(g)});for(let u of t.querySelectorAll("[data-text-scale]"))u.addEventListener("click",()=>c&&c(u.getAttribute("data-text-scale")));for(let u of t.querySelectorAll("[data-narr-scale]"))u.addEventListener("click",()=>l&&l(u.getAttribute("data-narr-scale")))}if(a==="continuity"){for(let g of Er){let y=t.querySelector('[data-warn="'+g+'"]');y&&y.addEventListener("click",()=>d&&d(g))}let u=t.querySelector("[data-warn-custom]");u&&u.addEventListener("change",()=>{let g=Number(u.value);g>0&&d&&d(Math.round(g*1e3))}),io(t,{run:r,category:"continuity",onSources:h})}a==="sources"&&ch(t,{run:r,onSources:h}),a==="advanced"&&io(t,{run:r,category:"advanced",onSources:h})}function ch(t,{run:e,onSources:a}){let r=pt("sources"),s=d=>t.querySelector('[data-input="'+d+'"]'),n=d=>t.querySelector('[data-field="'+d+'"]'),o=zt(e,"sources"),i=()=>{let d=ma(e,o);for(let h of r){let v=n(h.id);v&&(v.hidden=!Ee(h,d))}},c=()=>{i(),a&&a(fo(e,"sources",o))};yr(t),wr(t);let l=xr(t,{initial:o.lore,onChange:d=>{o.lore=d,c()}});o.lore=l.value();for(let d of r){if(d.type==="custom")continue;let h=s(d.id);h&&(d.type==="toggle"?(h.setAttribute("aria-checked",o[d.id]?"true":"false"),h.addEventListener("click",()=>{let v=h.getAttribute("aria-checked")!=="true";h.setAttribute("aria-checked",v?"true":"false"),o[d.id]=v,c()})):(typeof o[d.id]=="string"?h.value=o[d.id]:d.type==="range"&&typeof o[d.id]=="number"&&(h.value=String(o[d.id])),h.addEventListener("change",()=>{o[d.id]=typeof h.value=="string"?h.value.trim():"",c()})))}i(),mo(t,r,o)}var dh=new Set(["image_generation","video_generation"]);function io(t,{run:e,category:a,onSources:r}){let s=pt(a);if(!s.length)return;let n=zt(e,a);mo(t,s,n);for(let o of s){let i=t.querySelector('[data-input="'+o.id+'"]');i&&i.addEventListener("change",()=>{n[o.id]=typeof i.value=="string"?i.value.trim():"",r&&r(fo(e,a,n))})}}function mo(t,e,a){let r=o=>e.some(i=>i.optionsFrom===o),s=(o,i,c)=>{let l=t.querySelector('[data-input="'+o+'"]');if(!l)return;l.innerHTML=(c?'<option value="">'+f(c)+"</option>":"")+i.map(h=>'<option value="'+f(h.value)+'">'+f(h.label)+"</option>").join("");let d=a[o];typeof d=="string"&&i.some(h=>h.value===d)?l.value=d:c&&(l.value=""),l.disabled=i.length===0&&!c},n=o=>o&&o.emptyOption?o.emptyOption:"";r("connections")&&ge("/api/connections").then(o=>o&&o.ok&&typeof o.json=="function"?o.json():null).then(o=>{let c=(Array.isArray(o)?o:o&&Array.isArray(o.connections)?o.connections:[]).filter(l=>l&&!dh.has(String(l.provider??""))).map(l=>({value:String(l.id),label:String(l.name||l.model||l.id)}));for(let l of e)l.optionsFrom==="connections"&&s(l.id,c,n(l))}).catch(()=>{}),(r("imageConnections")||r("imageProfiles"))&&ge("/api/gacha-forge/image-options").then(o=>o&&o.ok&&typeof o.json=="function"?o.json():null).then(o=>{let i=(o&&Array.isArray(o.connections)?o.connections:[]).map(l=>({value:String(l.id),label:String(l.name||l.model||l.id)})),c=(o&&Array.isArray(o.profiles)?o.profiles:[]).map(l=>({value:String(l.id),label:String(l.name)+" \u2014 "+String(l.promptMode)}));for(let l of e)l.optionsFrom==="imageConnections"&&s(l.id,i,n(l)),l.optionsFrom==="imageProfiles"&&s(l.id,c,c.length?"":"Engine default")}).catch(()=>{})}var go=`

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
/* The slider rides the right column with the checks, and the selects PIN to the left one: with
   only the checks forced right, the first left CELL sat empty (no dense flow) and the two pickers
   read as vertically centred against the column of checks (user report). Pinned, each column
   fills from its own first row. */
.st-plate[data-group="images"] .ob-grid > .ob-field:has(.ob-range) { grid-column: 2; }
.st-plate[data-group="images"] .ob-grid > .ob-field:not(:has(.ob-toggle)):not(:has(.ob-range)) { grid-column: 1; }
/* dense, or the pinning alone leaves row 1 of the LEFT column empty: sparse flow never walks back,
   so the first select started a row below the first check and the pair read as centred. */
.st-plate[data-group="images"] .ob-grid { grid-auto-flow: row dense; }
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
/* The index column follows --f-text: it holds a number and nothing else, so sized on --f the digits
   grew with the player's scale and the box did not -- measured at 175%, 7px cut. Same defect, and
   same fix, as the chapter cards. */
.st-ch { display: grid; grid-template-columns: calc(var(--f-text) * 3.4) minmax(0, 1fr) auto auto; align-items: center; gap: var(--sp-3); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); padding: calc(var(--f) * 0.5) var(--sp-2); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.st-ch .st-idx { font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-xl); line-height: 0.9; color: var(--steel-dark); font-variant-numeric: tabular-nums; text-align: center; }
.st-ch h4 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); color: var(--text); }
.st-ch p { margin: 0; font-size: var(--t-tiny); line-height: 1.4; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.st-ch.-picked { border-left-color: var(--coral); background: color-mix(in srgb, var(--coral) 10%, var(--ink-2)); }
/* The tick sits where the "done" mark was, so the row keeps its four columns and its width.
   Sized on --f-text: it holds a glyph and nothing else. */
/* st-pick, not st-tick: that name is already taken in this sheet by the style swatch's mark, which
   is display:none until its swatch is pressed. Later rule wins, so the ticks drew at 0x0. */
.st-pick { width: calc(var(--f-text) * 1.9); height: calc(var(--f-text) * 1.9); display: grid; place-items: center; padding: 0; background: color-mix(in srgb, var(--porcelain-3) 10%, transparent); border: 2px solid var(--steel); color: var(--on-coral); cursor: pointer; border-radius: var(--radius-sm); }
.st-pick:hover { border-color: var(--coral); }
.st-pick.on { background: var(--coral); border-color: var(--coral); }
.st-pick svg { width: 68%; height: 68%; }
.st-fold-open { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.5); margin-top: var(--sp-2); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.08em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-fold-open svg { width: calc(var(--f-text) * 1.1); height: calc(var(--f-text) * 1.1); }
.st-fold { margin-top: var(--sp-2); display: flex; flex-direction: column; gap: calc(var(--f) * 0.6); }
.st-fold-warn { margin: 0; display: flex; gap: calc(var(--f) * 0.6); align-items: flex-start; font-size: var(--t-xs); line-height: 1.45; color: var(--text); }
.st-fold-warn svg { flex: none; width: calc(var(--f-text) * 1.2); height: calc(var(--f-text) * 1.2); color: var(--amber); }
.st-fold-act { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.st-fold-sel { flex: 1; min-width: 0; font-size: var(--t-xs); color: var(--steel); }
.st-compress.-ghost { border-color: var(--ink-3); color: var(--steel); }
.st-compress.-go { border-color: var(--coral); color: var(--coral); }
.st-compress[disabled] { opacity: 0.5; cursor: default; }
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
.st-tl-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: baseline; gap: calc(var(--f) * 0.7); row-gap: calc(var(--f) * 0.15); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.5); background: var(--ink-3); font-size: var(--t-xs); }
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
/* The three detail lines cost no WIDTH: the label column is the one that names the call. They start
   at that column so they read as details of THIS call and not as another entry. */
.st-tl-why, .st-tl-said, .st-tl-raw { grid-column: 2 / -1; font-size: var(--t-tiny); color: var(--steel-faint); }
.st-tl-why b { font-weight: 700; color: var(--amber); font-variant-numeric: tabular-nums; }
.st-tl-said, .st-tl-raw summary { color: var(--text); }
.st-tl-said i, .st-tl-raw summary i { font-style: normal; margin-right: calc(var(--f) * 0.4); color: var(--steel-faint); }
.st-tl-raw summary { cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* The kept window is up to 2400 characters, so it scrolls INSIDE its own box, never the screen. */
.st-tl-raw pre { margin: calc(var(--f) * 0.3) 0 0; padding: calc(var(--f) * 0.4); max-height: calc(var(--f) * 14); overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--ink-2); color: var(--text); }
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
.st-pane .ob-field .hint, .st-pane .ob-field .ob-count { font-size: var(--t-tiny); line-height: 1.45; color: var(--steel-faint); }
/* Layout is repeated here on purpose: this screen never emits ONBOARDING_STYLES. */
.st-pane .ob-count { margin-left: auto; flex: none; font-variant-numeric: tabular-nums; }
.st-pane .ob-count.is-full { color: var(--coral); }
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
/* The range control: full-width slider, meaning underneath. Settings had NO rules for it, so it
   drew at the user agent's default width with the label at its side (user report). */
.st-pane .ob-range { display: flex; flex-direction: column; align-items: stretch; gap: calc(var(--f) * 0.35); min-width: 0; }
.st-pane .ob-slider { width: 100%; min-width: 0; accent-color: var(--coral); }
.st-pane .ob-range-say { font-size: var(--t-tiny); line-height: 1.4; color: var(--steel); }

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
`;var hh=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function ph(t){let e=hh[t];return e?`Chapter ${e}`:`Chapter ${t}`}var bo=["Reading the scenario\u2026","Forging the chapter\u2026","Writing the story beats\u2026"],Tr=["Reading the scenario\u2026","Summoning the founding cast\u2026","Naming the heroes\u2026"],Ft=`
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
  /* safe: a centred column that outgrows its box crops at BOTH ends and the top becomes
     unreachable -- with safe it packs to the start instead, so the scroll can reach it. */
  justify-content: safe center;
  text-align: center;
  gap: var(--sp-2);
  min-height: 0;
  /* Contained here, ONE region: with a failure reason on it this column outgrows the screen at
     175% and, being overflow:visible, it ran over the brand above and the footer below. */
  overflow-y: auto;
  overscroll-behavior: contain;
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
/* The spinning emblem MEANS "this is running", so on a failure it is wrong and it is the biggest
   box on screen (12f). Hiding it is what makes room for the reason without pushing Retry off. */
.forge.-error .forge-emblem, .forge.-paused .forge-emblem { display: none; }
/* Tighter WHEN THERE IS SOMETHING TO PRESS. Measured at 175%: with the ramp's normal gap the
   escape sat 21px below the fold -- a control out of sight is worse than a tight column. */
.forge.-error .forge-center, .forge.-paused .forge-center { gap: var(--sp-1); }
.forge.-error .forge-status, .forge.-paused .forge-status { margin-top: var(--sp-2); }
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
/* The reason the check gave. Monospace and dimmer: it is evidence to copy into a report, not prose. */
.forge-why {
  margin-top: var(--sp-1);
  font-size: var(--t-xs);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--steel-faint);
  line-height: 1.45;
  max-width: 48ch;
  word-break: break-word;
  opacity: 0.85;
}
.forge-why[hidden] { display: none; }

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
`,yo=`
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
</svg>`,wo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';function fh({done:t=0,total:e=0,name:a=""}={}){let r=Math.min(t+1,Math.max(e,1));return{label:"Founding Cast",status:e>0?a?`Summoning ${f(a)}\u2026 ${r}/${e}`:`Summoning the founding cast\u2026 ${r}/${e}`:Tr[0],eyebrow:"Summoning the founding cast",brandNote:"&middot; first-time setup",foot:"Summoning this world's founding heroes from your scenario &mdash; the cast the story is built around. This happens once.",errorStatus:"Couldn't summon the founding cast.",errorBody:"The summon returned units that didn't match the expected format. Nothing was saved.",pausedStatus:"This world is half-forged.",pausedBody:"Continuing picks up from the last hero it minted \u2014 nothing already summoned is paid for twice.",pausedLabel:"Continue creating"}}function uh({done:t=0,total:e=0,name:a=""}={}){let r=Math.min(t+1,Math.max(e,1));return{label:"Founding Cast",status:a?`Painting ${a}\u2026 ${r}/${e}`:`Painting the founding cast\u2026 ${t}/${e}`,eyebrow:"Painting the founding cast",brandNote:"&middot; first-time setup",foot:"Generating each hero's portrait, one at a time, so they have a face when they speak in the story. The first chapter is being forged at the same time.",errorStatus:"Couldn't paint the cast.",errorBody:"No portrait could be generated. Check the world's image connection &mdash; the story is ready either way, and the heroes will show their silhouette until art exists.",retryLabel:"Continue"}}function vh(t,e){let a=Number(e)<=1;return{label:t,status:bo[0],eyebrow:a?"Forging the first chapter":"Forging the next chapter",brandNote:a?"&middot; first-time setup":"&middot; new chapter",foot:a?`Forging ${f(t)}'s story beats from your scenario. This happens once &mdash; the story is written before you play it.`:`Forging ${f(t)}'s story beats from your scenario &mdash; the story is written before you play it.`,errorStatus:"Couldn't read the forged chapter.",errorBody:"The forge returned a plan that didn't match the expected format. Nothing was saved."}}function xo(t){return'<div class="forge-cancel'+(t?" -confirm":"")+'">'+(t?'<p class="forge-cancel-warn">This deletes the world being created &mdash; its cast, its art and its story. It cannot be undone.</p><div class="forge-cancel-acts"><button class="forge-cancel-go" type="button" data-forge-cancel-go>Delete and start over</button><button class="forge-cancel-keep" type="button" data-forge-cancel-keep>Keep waiting</button></div>':'<button class="forge-cancel-open" type="button" data-forge-cancel>Cancel world creation</button>')+"</div>"}var mh={"generation-failed":"The connection could not be reached, or it refused the request.","empty-response":"The model answered with nothing at all.",truncated:"The answer was cut off before it finished -- it ran past the size limit.",unparseable:"The answer was not in the format this screen asked for.","invalid-shape":"The answer was complete, but a value in it is not one this game knows.","forge-stalled":"The forge stopped making progress."};function ko(t,e){let a=typeof t=="string"?t:"",r=typeof e=="string"?e.trim():"";return{head:mh[a]||"",why:r?r.length>240?`${r.slice(0,240)}\u2026`:r:""}}function ga({chapter:t=1,error:e=!1,mode:a="chapter",progress:r,cancel:s=!1,confirming:n=!1,failure:o=null,paused:i=!1}){let c=a==="banner"?fh(r):a==="art"?uh(r):vh(ph(t),t),l=c.label,d=i&&!!c.pausedStatus,h=e?c.errorStatus:d?c.pausedStatus:c.status,v=c.eyebrow,u=c.brandNote,g=c.foot,y=ko(o&&o.error,o&&o.detail);return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${e?" -error":d?" -paused":""}">
    <div class="forge-brand">
      <span class="rhombus" aria-hidden="true"></span>
      <b>Gacha Forge</b><span>${u}</span>
    </div>

    <div class="forge-center">
      ${yo}
      <span class="eyebrow">${v}</span>
      <h2>${f(l)}</h2>
      <div class="forge-status" aria-live="polite">${f(h)}</div>
      <p class="forge-error"${e||d?"":" hidden"}>${d?c.pausedBody:y.head?f(y.head):c.errorBody}</p>
      <button class="forge-retry" type="button"${e||d?"":" hidden"}>${f(d?c.pausedLabel:c.retryLabel||"Retry")}</button>
      ${s?xo(n):""}
      <p class="forge-why"${e&&y.why?"":" hidden"}>${f(y.why)}</p>
    </div>

    <p class="forge-foot">
      ${wo}
      <span>${g}</span>
    </p>
  </div>
</div>`}function _o({chapterTitle:t,error:e=!1,prologue:a=!1,art:r=null,cancel:s=!1,confirming:n=!1,failure:o=null}={}){let i=t&&t.trim()?t.trim():"Chapter One",c=r&&Number(r.total)||0,l=!e&&c>0,d=l?Math.min((Number(r.done)||0)+1,c):0,h=e?"Couldn't write this beat.":l?`${r.name?`Painting ${r.name}`:"Painting this beat's places"}\u2026 ${d}/${c}`:"Generating story\u2026",v=l?"The story is written. It reaches a place this world has never drawn, and that art is being painted now.":"The narrator is writing this beat. It will appear when it's ready.",u=ko(o&&o.error,o&&o.detail);return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${e?" -error":""}">
    <div class="forge-brand"><span class="rhombus" aria-hidden="true"></span><b>Gacha Forge</b></div>
    <div class="forge-center">
      ${yo}
      <span class="eyebrow">${a?"Prologue":"Story"}</span>
      <h2>${f(i)}</h2>
      <div class="forge-status" aria-live="polite">${f(h)}</div>
      <p class="forge-error"${e?"":" hidden"}>${u.head?f(u.head):"The narrator returned something unreadable. Nothing was saved."}</p>
      <button class="forge-retry" type="button"${e?"":" hidden"}>Retry</button>
      ${s?xo(n):""}
      <p class="forge-why"${e&&u.why?"":" hidden"}>${f(u.why)}</p>
    </div>
    <p class="forge-foot">${wo}<span>${v}</span></p>
  </div>
</div>`}function gt(t,{onRetry:e,cycle:a,phases:r,onCancel:s,onCancelGo:n,onCancelKeep:o}){let i=t.querySelector(".forge-retry");i&&i.addEventListener("click",()=>e?.());let c=t.querySelector("[data-forge-cancel]");c&&s&&c.addEventListener("click",()=>s());let l=t.querySelector("[data-forge-cancel-go]");l&&n&&l.addEventListener("click",()=>n());let d=t.querySelector("[data-forge-cancel-keep]");d&&o&&d.addEventListener("click",()=>o());let h=t.querySelector(".forge-status");if(!a||!h)return()=>{};let v=Array.isArray(r)&&r.length?r:bo,u=0;h.textContent=v[0];let g=setInterval(()=>{u=(u+1)%v.length,h.textContent=v[u]},1100);return()=>clearInterval(g)}function Eo(t){return(t<10?"0":"")+t}var So=10,gh=5,bh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',yh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>',wh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ao=`
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
  /* The plate holds only its number, so it follows --f-text; the column is DERIVED from it, or
     the two drift and the plate outgrows its own column at 175%. */
  --ch-plate: calc(var(--f-text) * 5.2);
  grid-template-columns: calc(var(--ch-plate) + var(--f) * 1.3) 1fr auto;
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
  width: var(--ch-plate);
  height: var(--ch-plate);
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
  width: calc(var(--f-text) * 1.7);
  height: calc(var(--f-text) * 1.7);
  display: grid;
  place-items: center;
  font-family: var(--display);
  font-weight: 700;
  font-size: calc(var(--f-text) * 0.9);
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
`;function To(){return`
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
</div>`}function Nr(t){return t&&(t.hook||t.cleared&&t.premise)||""}function xh(t){let e=Eo(t.chapter),a=Nr(t),r=`Chapter ${ke(t.chapter)} &middot; ${t.cleared?"Cleared":"In progress"}`,s,n;if(t.cleared){let o=t.combats||gh,i=(t.hard||0)>=o?" on":"",c=(t.veryhard||0)>=o?" on":"";s=`<span class="diffs"><span class="on">N</span><span class="${i.trim()}">H</span><span class="${c.trim()}">V</span></span>`,n='<button class="btn btn-enter" type="button">Enter</button>'}else{let o=t.normal||0,i=Math.min(100,Math.round(o/So*100));s=`<div class="ch-bar"><div class="fig">${o} / ${So} nodes</div><div class="track"><i style="width:${i}%"></i></div></div>`,n=`<button class="btn btn-go" type="button">${o>0?"Continue":"Enter"}</button>`}return`<article class="ch-card ${t.cleared?"cleared":"current"}" data-open-chapter="${t.chapter}"><div class="ch-index">${e}</div><div class="ch-body"><div class="ch-eyebrow">${r}</div><h3 class="ch-title">${f(t.title)}</h3>${a?`<p class="ch-premise">${f(a)}</p>`:""}<div class="ch-foot">${s}</div></div><div class="ch-action">${n}</div></article>`}function kh(t,e){let a=Eo(t);if(e)return`<article class="ch-card new" data-open-chapter="${t}"><div class="ch-index">${a}</div><div class="ch-body"><div class="ch-eyebrow">Chapter ${ke(t)} &middot; New</div><h3 class="ch-title">A new chapter awaits</h3><p class="ch-premise">Unlocked. Forge it when you're ready &mdash; it continues from everything so far.</p><div class="ch-foot"><span class="ch-hint">${bh}Fresh chapter, ready to forge</span></div></div><div class="ch-action"><button class="btn btn-go" type="button">Begin${wh}</button></div></article>`;let r=ke(t-1);return`<article class="ch-card locked"><div class="ch-index">${a}</div><div class="ch-body"><div class="ch-eyebrow">Chapter ${ke(t)} &middot; Locked</div><h3 class="ch-title">Uncharted</h3><p class="ch-premise">The next chapter hasn't been written. Clear Chapter ${r} on Normal to unlock it.</p><div class="ch-foot"><span class="ch-hint">${yh}Clear Chapter ${r} on Normal</span></div></div><div class="ch-action"></div></article>`}function No(t,e,a){let r=Array.isArray(t)?t:[];return r.map(xh).join("")+kh(e||r.length+1,!!a)}function bt(t,e,a="u-photo"){let r=typeof t=="string"?t.trim():"";return r?'<img class="'+a+'" src="'+f(r)+'" alt="" loading="lazy">':e}var Io={blade:()=>'<path d="M150 30 176 150 166 320 150 350 134 320 124 150Z"/><rect x="108" y="300" width="84" height="18"/><rect x="140" y="318" width="20" height="56"/><circle cx="150" cy="384" r="12"/>',edge:()=>'<path d="M150 96c22 44 30 108 21 176l-13 30-8 8-8-8-13-30c-9-68-1-132 21-176Z"/><path d="M104 306h92v18h-92Z"/><rect x="139" y="324" width="22" height="48"/><path d="M150 360 168 380 150 400 132 380Z"/>',bulwark:()=>'<path d="M150 34 254 74c0 130-30 232-104 300C76 306 46 204 46 74Z"/><path d="M150 96v212M92 150h116" stroke="#0E1420" stroke-opacity="0.32" stroke-width="9" fill="none"/>',focus:t=>'<circle cx="150" cy="228" r="74"/><path d="M150 40 172 86 150 132 128 86Z"/><ellipse cx="150" cy="228" rx="122" ry="44" fill="none" stroke="'+t+'" stroke-width="11"/>',tome:()=>'<path d="M132 70h74q18 0 18 18v224q0 18-18 18h-74Z"/><path d="M78 70h36v260H78q-9 0-9-12V82q0-12 9-12Z"/><path d="M224 98h18v204h-18Z"/>'};function Pe(t,e){let a="url(#"+e+")",r=Io[t]||Io.blade;return'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="'+a+'">'+r(a)+"</g></svg>"}var Ae={core:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 6l6 5v10l-6 5-6-5V11z"/><circle cx="12" cy="16" r="2.5"/></svg>',edge:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5l4 8-4 14-4-14z"/><path d="M8 13h8"/></svg>',flow:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5c5 5 5 9 0 12S7 24 12 27"/><circle cx="12" cy="16" r="7"/></svg>',crest:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 8h12v9c0 5-6 8-6 8s-6-3-6-8z"/><path d="M12 12v7"/></svg>'};function Pt(t){return Ae[String(t)]||Ae.core}function ve(t,e){let r=String(t).endsWith("Pct")?Number(e)*100:Number(e);return"+"+Math.round(r*10)/10+"%"}function Ht(t){let e=String(t||"");return e?e.charAt(0).toUpperCase()+e.slice(1):""}var Ro={fire:"water",water:"wind",wind:"earth",earth:"fire",light:"dark",dark:"light"},_h={fire:"#F2603C",water:"#4A9BD4",wind:"#2EBE9E",earth:"#F0B429",light:"#F5E3A2",dark:"#9B6FD4"},Co=20,Lo=6,Fo=1.5,Sh=.4,Dt=1.6,Po=.65,Qe=.15,Ir=1.1,Rr=.25,Ho=.15,Do=.1,qo=.6;function oe(t){let e=Number(t);return Math.max(.2,Math.min(6,(Number.isFinite(e)?e:100)/100))}function ye(t){return Math.max(Do,Math.min(qo,oe(t)*Ho))}var Mo=30,Eh=10,$o=30,et={crit:15,critDmg:150,recharge:100,effectHit:0,effectRes:0,healBonus:0},Ah=.15,Th=1;var Cr=3,Lr=.4,Mr=1,Or=3,Br=.35,zr=35,Fr=.5,Pr=1,Nh=30,tt=.5,qt=.4,Ih=3,Hr=1.8,Rh={Tank:3,Warrior:2,Assassin:1.5,Mage:1,Support:1},Ch=1;function Oo(t){let e=Rh[t&&t.role];return typeof e=="number"&&e>0?e:Ch}var jo=.05,Uo=2,Wo=.08,Go=15,Vo=.4,Yo=12,Ko=.3,ba=.35,Xo=.02,Jo=.1,Zo=.18,Qo=.2,ei={ATK_K:Fo,ULT_SINGLE:Dt,ULT_AOE:Po,HEAL_SCALE:Qe,SHIELD_SCALE:Ir,DOT_SCALE:Rr,BUFF_SCALE:Ho,BUFF_MIN:Do,BUFF_MAX:qo,FOCUS:Hr,DOT_ROUNDS:Or,BUFF_ROUNDS:Cr,REVIVE_PCT:Br,ENERGY_GRANT:zr,DRAIN_SHARE:Lr,PASSIVE_SHARE:tt,PASSIVE_HIT_SHARE:qt,STUN_TURNS:Pr,EXECUTE_BONUS:Mr,CLEANSE_SHARE:Fr,LOW_PCT:ba,AURA_REGEN:Xo,AURA_MITIGATION:Jo,AURA_SHIELD:Zo,RESIST_MITIGATION:Qo,RIDER_BURN:jo,RIDER_FLOW:Wo,RIDER_HASTE:Go,RIDER_BULWARK:Vo,RIDER_RADIANCE:Yo,RIDER_BLIGHT:Ko,ENERGY_KILL:$o,RIDER_BURN_ROUNDS:Uo};var ya=new Set(["damage","aoe_damage","debuff","drain","execute","dot","stun"]);function X(t,e,a){let r=t&&t.fx?Number(t.fx[e]):NaN;return Number.isFinite(r)?r:a}function wa(t){return String(t||"").toLowerCase()}function Bo(t){return _h[wa(t)]||"#FFFFFF"}function He(t,e){let a=wa(t),r=wa(e);return Ro[a]===r?{mult:1.5,label:"STRONG"}:Ro[r]===a?{mult:.75,label:"WEAK"}:{mult:1,label:""}}function Lh(t){let e=t>>>0;return function(){e|=0,e=e+1831565813|0;let a=Math.imul(e^e>>>15,1|e);return a=a+Math.imul(a^a>>>7,61|a)^a,((a^a>>>14)>>>0)/4294967296}}function ti(t){let e=2166136261,a=String(t||"seed");for(let r=0;r<a.length;r+=1)e^=a.charCodeAt(r),e=Math.imul(e,16777619);return e>>>0}function yt(t,e){let a=Number(t);return Number.isFinite(a)?a:e}function zo(t,e,a){let r=t&&t.stats||{},s=Number(t&&t.power)>0?Number(t.power):1,n=(Number(r.hp)||50)*s,o=(Number(r.atk)||50)*s,i=(Number(r.def)||50)*s,c=Number(r.spd)||50;return{id:t.id||`${e}-${a}`,name:t.name||(e==="ally"?"Hero":"Foe"),side:e,role:t.role||"Warrior",aff:wa(t.affinity),position:t.position==="back"?"back":"front",hpMax:Co+n*Lo,hp:Co+n*Lo,atk:o,def:i,spd:c,energy:0,shield:0,atkMod:1,defMod:1,modRounds:0,burn:0,burnRounds:0,dmgReduction:0,roundShield:0,stunTurns:0,fx:t&&t.facets||null,regen:0,skill:t&&t.skill||null,passive:t&&t.passive||null,granted:t&&t.granted||null,grantedCd:0,grantedArmed:!1,crit:yt(r.crit,et.crit),critDmg:yt(r.critDmg,et.critDmg),recharge:yt(r.recharge,et.recharge),effectHit:yt(r.effectHit,et.effectHit),effectRes:yt(r.effectRes,et.effectRes),healBonus:yt(r.healBonus,et.healBonus),alive:!0}}function ai({allies:t=[],enemies:e=[],seed:a=1}={}){let r=Lh(a>>>0||1),s=t.map((p,_)=>zo(p,"ally",_)),n=e.map((p,_)=>zo(p,"enemy",_)),o=s.concat(n),i=new Map(o.map(p=>[p.id,p])),c=[],l=p=>p.side==="ally"?s:n,d=p=>p.side==="ally"?n:s,h=p=>p.filter(_=>_.alive),v=p=>Math.max(0,Math.round(p.hp/p.hpMax*100)),u=p=>({hp:Math.max(0,Math.round(p.hp)),hpMax:Math.round(p.hpMax)});function g(p,_){c.push({d:p,events:_.filter(Boolean)})}function y(p){return{op:"hp",id:p.id,pct:v(p),...u(p)}}function b(p){return{op:"energy",id:p.id,pct:Math.round(p.energy)}}function x(p,_){return p.alive?(p.energy=Math.min(100,p.energy+_*(p.recharge/100)),b(p)):null}function E(p,_,w){let T=Math.max(1,Math.round(_));if(p.shield>0){let P=Math.min(p.shield,T);p.shield-=P,T-=P}return T=Math.round(T*(1-(p.dmgReduction||0))),T=Math.max(1,T),p.hp=Math.max(0,p.hp-T),p.hp<=0&&p.alive&&(p.alive=!1),T}function k(p,_){let w=Math.max(Ah,Math.min(Th,1+(p.effectHit-_.effectRes)/100));return w>=1||r()<w}function S(p){let _=h(d(p));if(!_.length)return null;let w=_.filter(q=>q.position==="front"),T=w.length?w:_;if(p.side!=="enemy")return T.reduce((q,M)=>M.hp<q.hp?M:q,T[0]);if(T.length===1)return T[0];let P=0;for(let q of T)P+=Oo(q);if(!(P>0))return T[0];let B=r()*P;for(let q of T)if(B-=Oo(q),B<0)return q;return T[T.length-1]}let H=ya;function R(p){let _=h(l(p));return _.length?_.reduce((w,T)=>T.hp/T.hpMax<w.hp/w.hpMax?T:w,_[0]):null}function m(p,_,w){let T=H.has(_),P=h(T?d(p):l(p));if(!P.length)return[];let B=M=>{let z=P.filter(Z=>Z.position===M);return z.length?z:P},q;switch(w){case"self":q=T?[S(p)]:[p];break;case"ally":case"enemy":q=T?[S(p)]:[R(p)];break;case"allies":case"all_enemies":q=P;break;case"front_row":q=B("front");break;case"back_row":q=B("back");break;default:q=T?[S(p)]:P;break}return q=q.filter(Boolean),_==="aoe_damage"&&q.length<=1&&(q=P),q}let L=p=>p<=1?Hr:1,W=2;function F(p,_){return ya.has(_.effect)?h(d(p)):_.target==="self"?[p]:h(l(p))}function J(p,_,w,T){let P=Number(T)||1,B=Number(_.power)||20,q=F(p,_);if(q.length){if(_.effect==="buff"){for(let M of q)M.atkMod+=ye(B)*P,M.modRounds=Math.max(M.modRounds,W);w.push({op:"buff",id:p.id,text:"ATK \u25B2"})}else if(_.effect==="debuff"){for(let M of q)M.defMod=Math.max(.5,M.defMod-ye(B)*P),M.modRounds=Math.max(M.modRounds,W);w.push({op:"debuff",id:p.id,text:"DEF \u25BC"})}else if(_.effect==="shield"){let M=Math.round(p.def*Ir*tt*oe(B)*P);for(let z of q)z.shield+=M;w.push({op:"shieldFx",ids:q.map(z=>z.id)})}else if(_.effect==="heal"){let M=Math.round(p.hpMax*Qe*tt*oe(B)*P);for(let z of q)z.hp=Math.min(z.hpMax,z.hp+M),w.push({op:"heal",id:z.id,amount:M,hpPct:v(z),...u(z)})}else if(_.effect==="energy"){let M=Math.round(X(p,"energyGrant",zr)*tt*P);for(let z of q){let Z=x(z,M);Z&&w.push(Z)}w.push({op:"buff",id:p.id,text:"CHARGE"})}else if(_.effect==="drain"){let M=0;for(let Z of q){let be=He(p.aff,Z.aff),Tt=E(Z,p.atk*p.atkMod*Dt*qt*oe(B)*P*be.mult,w);M+=Tt,w.push({op:"hit",id:Z.id,amount:Tt,effLabel:be.label,crit:!1,hpPct:v(Z),...u(Z)}),Z.alive||(w.push({op:"death",id:Z.id}),A(Z,w),I(p,w))}let z=Math.round(M*X(p,"drainShare",Lr));z>0&&p.alive&&(p.hp=Math.min(p.hpMax,p.hp+z),w.push({op:"heal",id:p.id,amount:z,hpPct:v(p),...u(p)}))}else if(_.effect==="execute")for(let M of q){let z=He(p.aff,M.aff),Z=1+(1-M.hp/M.hpMax)*X(p,"executeBonus",Mr),be=E(M,p.atk*p.atkMod*Dt*qt*oe(B)*P*z.mult*Z,w);w.push({op:"hit",id:M.id,amount:be,effLabel:z.label,crit:!1,hpPct:v(M),...u(M)}),M.alive||(w.push({op:"death",id:M.id}),A(M,w),I(p,w))}else if(_.effect==="dot")for(let M of q){if(!k(p,M)){w.push({op:"debuff",id:M.id,text:"RESIST"});continue}M.burn=Math.max(M.burn,Math.round(p.atk*p.atkMod*Rr*qt*oe(B)*P*He(p.aff,M.aff).mult)),M.burnRounds=Math.max(M.burnRounds,X(p,"dotRounds",Or)),w.push({op:"debuff",id:M.id,text:"DOT"})}else if(_.effect==="stun")for(let M of q){if(!k(p,M)){w.push({op:"debuff",id:M.id,text:"RESIST"});continue}M.stunTurns=Math.max(M.stunTurns,X(p,"stunTurns",Pr)),w.push({op:"stun",id:M.id})}else if(_.effect==="cleanse"){let M=Math.round(p.hpMax*Qe*X(p,"cleanseShare",Fr)*tt*oe(B)*P);for(let z of q)z.burn=0,z.burnRounds=0,z.stunTurns=0,z.atkMod<1&&(z.atkMod=1),z.defMod<1&&(z.defMod=1),z.hp=Math.min(z.hpMax,z.hp+M),w.push({op:"heal",id:z.id,amount:M,hpPct:v(z),...u(z)});w.push({op:"buff",id:p.id,text:"CLEANSE"})}else if(_.effect==="revive"){let M=l(p).filter(z=>!z.alive);if(M.length){let z=M.reduce((Z,be)=>be.hpMax>Z.hpMax?be:Z,M[0]);z.alive=!0,z.hp=Math.round(z.hpMax*X(p,"revivePct",Br)*tt),z.energy=0,w.push({op:"revive",id:z.id}),w.push({op:"heal",id:z.id,amount:z.hp,hpPct:v(z),...u(z)})}else{let z=Math.round(p.hpMax*Qe*.4*tt*oe(B)*P);for(let Z of h(l(p)))Z.hp=Math.min(Z.hpMax,Z.hp+z),w.push({op:"heal",id:Z.id,amount:z,hpPct:v(Z),...u(Z)})}}else if(_.effect==="damage"||_.effect==="aoe_damage"){let M=_.effect==="aoe_damage"?h(d(p)):[S(p)].filter(Boolean);for(let z of M){let Z=He(p.aff,z.aff),be=E(z,p.atk*Dt*qt*oe(B)*P*Z.mult,w);w.push({op:"hit",id:z.id,amount:be,effLabel:Z.label,crit:!1,hpPct:v(z),...u(z)}),z.alive||(w.push({op:"death",id:z.id}),A(z,w),I(p,w))}}}}function ee(){let p=[{op:"start"}];for(let _ of o)p.push(y(_),b(_));for(let _ of o){let w=_.passive;if(!(!w||!_.alive))if(w.trigger==="battle_start"||w.trigger==="self")J(_,w,p,X(_,"passiveScale",1));else if(w.trigger==="aura")for(let T of l(_))w.effect==="buff"?T.dmgReduction=Math.max(T.dmgReduction,X(_,"auraMitigation",Jo)):w.effect==="heal"?T.regen=Math.max(T.regen,Math.round(_.hpMax*X(_,"auraRegen",Xo)*oe(w.power))):w.effect==="shield"&&(T.roundShield=Math.max(T.roundShield||0,Math.round(_.def*X(_,"auraShield",Zo)*oe(w.power))));else w.trigger==="resist"&&(_.dmgReduction=Math.max(_.dmgReduction,X(_,"resistMitigation",Qo)),p.push({op:"buff",id:_.id,text:"RESIST"}))}return p}function ie(p,_){let w=p.passive;!w||!p.alive||w.trigger!=="on_attack"||J(p,w,_,X(p,"onAttackScale",.5))}function V(p,_,w){let T=p.passive;T&&p.alive&&T.trigger==="on_hit"&&J(p,T,w,X(p,"onHitScale",.5)),C(p,w),re(p,w)}let Y=new Map,te=(p,_)=>Number(p.get(_))||0;function re(p,_){for(let w of h(l(p))){let T=w.passive;!T||T.trigger!=="on_ally_low"||te(Y,w.id)>=X(w,"lowFires",1)||p.hp/p.hpMax>ba||(Y.set(w.id,te(Y,w.id)+1),J(w,T,_,1.2))}}function me(p){let _=p.passive;if(!_||!p.alive||_.trigger!=="on_round")return;let w=[];J(p,_,w,X(p,"onRoundScale",ba)),w.length&&g(260,w)}let se=new Map;function C(p,_){let w=p.passive;!w||!p.alive||w.trigger!=="on_low"||te(se,p.id)>=X(p,"lowFires",1)||p.hp/p.hpMax>ba||(se.set(p.id,te(se,p.id)+1),J(p,w,_,1.2))}function A(p,_){let w=p.passive;!w||w.trigger!=="on_death"||J(p,w,_,X(p,"onDeathScale",1.4))}function N(p,_){let w=p.passive;!w||!p.alive||w.trigger!=="on_ult"||J(p,w,_,X(p,"onUltScale",.7))}function I(p,_){if(!p.passive||!p.alive||p.passive.trigger!=="on_kill")return;let w=x(p,X(p,"energyKill",$o));w&&_.push(w),J(p,p.passive,_,.6)}function O(p,_){if(p.modRounds>0&&(p.modRounds-=1,p.modRounds===0&&(p.atkMod=1,p.defMod=1)),p.roundShield>0&&p.alive&&(p.shield+=p.roundShield,_.push({op:"shieldFx",ids:[p.id]})),p.burnRounds>0&&p.alive){p.burnRounds-=1;let w=Math.max(1,Math.round(p.burn*(1-(p.dmgReduction||0))));p.hp=Math.max(0,p.hp-w),_.push({op:"hit",id:p.id,amount:w,effLabel:"",crit:!1,hpPct:v(p),...u(p)}),p.hp<=0&&p.alive&&(p.alive=!1,A(p,_),_.push({op:"death",id:p.id}))}p.regen>0&&p.alive&&p.hp<p.hpMax&&(p.hp=Math.min(p.hpMax,p.hp+p.regen))}function $(p,_,w,T){let P=X(p,"riderExtra",1);switch(p.aff){case"fire":for(let B of _)B.alive&&(B.burn=Math.round(B.hpMax*X(p,"riderBurn",jo)*P),B.burnRounds=X(p,"riderBurnRounds",Uo));break;case"water":{let B=h(l(p));if(B.length){let q=B.reduce((z,Z)=>Z.hp/Z.hpMax<z.hp/z.hpMax?Z:z,B[0]),M=Math.round(p.hpMax*X(p,"riderFlow",Wo)*P);q.hp=Math.min(q.hpMax,q.hp+M),T.push({op:"heal",id:q.id,amount:M,hpPct:v(q),...u(q)})}break}case"wind":for(let B of h(l(p))){let q=x(B,X(p,"riderHaste",Go)*P);q&&T.push(q)}break;case"earth":for(let B of h(l(p)).filter(q=>q.position==="front"))B.shield+=Math.round(p.def*X(p,"riderBulwark",Vo)*P);T.push({op:"shieldFx",ids:h(l(p)).filter(B=>B.position==="front").map(B=>B.id)});break;case"light":for(let B of h(l(p))){B.defMod=Math.min(1,B.defMod),X(p,"riderRadianceFull",0)&&B.atkMod<1&&(B.atkMod=1);let q=x(B,X(p,"riderRadiance",Yo)*P);q&&T.push(q)}break;case"dark":{let B=Math.round(w*X(p,"riderBlight",Ko)*P);B>0&&p.alive&&(p.hp=Math.min(p.hpMax,p.hp+B),T.push({op:"heal",id:p.id,amount:B,hpPct:v(p),...u(p)}));break}default:break}}function K(p){let _=S(p);if(!_)return;let w=[{op:"act",id:p.id}];ie(p,w);let T=He(p.aff,_.aff),P=r()<p.crit/100,B=(p.atk*p.atkMod*Fo-_.def*_.defMod*Sh)*T.mult*(P?p.critDmg/100:1),q=E(_,B,w);w.push({op:"hit",id:_.id,amount:q,effLabel:T.label,crit:P,hpPct:v(_),...u(_)}),X(p,"riderOnAttack",0)&&p.alive&&$(p,_.alive?[_]:[],q,w),_.alive?V(_,p,w):(w.push({op:"death",id:_.id}),A(_,w),I(p,w));let M=x(p,Mo);M&&w.push(M);let z=x(_,Eh);z&&_.alive&&w.push(z),g(520,w)}function de(p,_,w){let T=[{op:"ult",id:p.id,name:_.name||"Ultimate",sub:`${p.name} \xB7 ${p.role} \xB7 ${_.effect}`,weapon:!!w}];w||N(p,T);let P=0,B=_.effect,q=!w&&p.fx&&p.fx.reach?p.fx.reach:_.target,M=m(p,B,q),z=M.length>1,Z=!w&&X(p,"keepFocus",0)?Hr:L(M.length),be=X(p,"ultSingle",Dt),Tt=X(p,"ultAoe",Po);if(B==="damage"||B==="aoe_damage"){z&&T.push({op:"aoe",side:p.side==="ally"?"enemies":"allies",color:Bo(p.aff)});let U=(z?Tt:be)*oe(_.power);for(let j of M){let le=He(p.aff,j.aff),Ie=!z&&r()<p.crit/100,Ge=p.atk*p.atkMod*U*le.mult*(Ie?p.critDmg/100:1),gs=E(j,Ge,T);P+=gs,T.push({op:"hit",id:j.id,amount:gs,effLabel:le.label,crit:Ie,hpPct:v(j),...u(j)}),j.alive||(T.push({op:"death",id:j.id}),A(j,T),I(p,T))}}else if(B==="heal"){let U=Math.round(p.hpMax*X(p,"healScale",Qe)*oe(_.power)*Z*(1+p.healBonus/100));for(let j of M)j.hp=Math.min(j.hpMax,j.hp+U),T.push({op:"heal",id:j.id,amount:U,hpPct:v(j),...u(j)})}else if(B==="shield"){let U=Math.round(p.def*X(p,"shieldScale",Ir)*oe(_.power)*Z);for(let j of M)j.shield+=U;T.push({op:"shieldFx",ids:M.map(j=>j.id)}),T.push({op:"buff",id:p.id,text:"SHIELD"})}else if(B==="buff"){for(let U of M)U.atkMod+=ye(_.power)*Z,U.modRounds=Math.max(U.modRounds,X(p,"buffRounds",Cr));T.push({op:"buff",id:p.id,text:"ATK \u25B2"})}else if(B==="debuff")for(let U of M){if(!k(p,U)){T.push({op:"debuff",id:U.id,text:"RESIST"});continue}U.defMod=Math.max(.5,U.defMod-ye(_.power)*Z),U.modRounds=Math.max(U.modRounds,X(p,"buffRounds",Cr)),T.push({op:"debuff",id:U.id,text:"DEF \u25BC"})}else if(B==="drain"){let U=(z?Tt:be)*oe(_.power);z&&T.push({op:"aoe",side:p.side==="ally"?"enemies":"allies",color:Bo(p.aff)});for(let le of M){let Ie=He(p.aff,le.aff),Ge=E(le,p.atk*p.atkMod*U*Ie.mult,T);P+=Ge,T.push({op:"hit",id:le.id,amount:Ge,effLabel:Ie.label,crit:!1,hpPct:v(le),...u(le)}),le.alive||(T.push({op:"death",id:le.id}),A(le,T),I(p,T))}let j=Math.round(P*X(p,"drainShare",Lr));j>0&&p.alive&&(p.hp=Math.min(p.hpMax,p.hp+j),T.push({op:"heal",id:p.id,amount:j,hpPct:v(p),...u(p)}))}else if(B==="execute")for(let U of M){let j=He(p.aff,U.aff),le=1-U.hp/U.hpMax,Ie=1+le*X(p,"executeBonus",Mr),Ge=E(U,p.atk*p.atkMod*be*oe(_.power)*j.mult*Ie,T);P+=Ge,T.push({op:"hit",id:U.id,amount:Ge,effLabel:j.label,crit:le>.5,hpPct:v(U),...u(U)}),U.alive||(T.push({op:"death",id:U.id}),A(U,T),I(p,T))}else if(B==="dot")for(let U of M){if(!k(p,U)){T.push({op:"debuff",id:U.id,text:"RESIST"});continue}U.burn=Math.max(U.burn,Math.round(p.atk*p.atkMod*Rr*oe(_.power)*He(p.aff,U.aff).mult)),U.burnRounds=Math.max(U.burnRounds,X(p,"dotRounds",Or)),T.push({op:"debuff",id:U.id,text:"DOT"})}else if(B==="stun")for(let U of M){if(!k(p,U)){T.push({op:"debuff",id:U.id,text:"RESIST"});continue}U.stunTurns=Math.max(U.stunTurns,X(p,"stunTurns",Pr)),T.push({op:"stun",id:U.id})}else if(B==="cleanse"){let U=Math.round(p.hpMax*Qe*X(p,"cleanseShare",Fr)*oe(_.power)*Z);for(let j of M)j.burn=0,j.burnRounds=0,j.stunTurns=0,j.atkMod<1&&(j.atkMod=1),j.defMod<1&&(j.defMod=1),j.hp=Math.min(j.hpMax,j.hp+U),T.push({op:"heal",id:j.id,amount:U,hpPct:v(j),...u(j)});T.push({op:"buff",id:p.id,text:"CLEANSE"})}else if(B==="revive"){let U=l(p).filter(j=>!j.alive);if(U.length){let j=U.reduce((le,Ie)=>Ie.hpMax>le.hpMax?Ie:le,U[0]);j.alive=!0,j.hp=Math.round(j.hpMax*X(p,"revivePct",Br)),j.energy=0,T.push({op:"revive",id:j.id}),T.push({op:"heal",id:j.id,amount:j.hp,hpPct:v(j),...u(j)})}else for(let j of h(l(p))){let le=Math.round(p.hpMax*Qe*.4*oe(_.power));j.hp=Math.min(j.hpMax,j.hp+le),T.push({op:"heal",id:j.id,amount:le,hpPct:v(j),...u(j)})}}else if(B==="energy"){let U=Math.round(X(p,"energyGrant",zr)*Z);for(let j of M){let le=x(j,U);le&&T.push(le)}T.push({op:"buff",id:p.id,text:"CHARGE"})}if($(p,H.has(B)?M:[],P,T),!w)p.energy=0,T.push(b(p)),p.granted&&p.granted.trigger==="energy"&&(p.grantedArmed=!0);else{let U=x(p,Mo);U&&T.push(U),p.granted&&p.granted.trigger!=="energy"?p.grantedCd=Ih:p.grantedArmed=!1}g(950,T)}function Ne(p){de(p,p.skill||{effect:"damage",power:60,target:"enemy",name:"Strike"},!1)}function De(p){return!p.granted||!p.granted.effect?!1:p.granted.trigger==="energy"?p.grantedArmed:p.grantedCd<=0}function xe(p){return h(p).length===0}g(700,ee());let ne=0,pe=null;for(;ne<Nh;){ne+=1;let p=h(o).slice().sort((_,w)=>w.spd-_.spd||(_.id<w.id?-1:1));for(let _ of p){if(!_.alive)continue;let w=[];if(O(_,w),w.length&&g(220,w),!!_.alive){if(xe(n)){pe="win";break}if(xe(s)){pe="lose";break}if(_.stunTurns>0){_.stunTurns-=1,g(300,[{op:"stun",id:_.id}]);continue}if(me(_),!!_.alive){if(_.grantedCd>0&&(_.grantedCd-=1),_.energy>=100?Ne(_):De(_)?de(_,_.granted,!0):K(_),xe(n)){pe="win";break}if(xe(s)){pe="lose";break}}}}if(pe)break}if(!pe){let p=_=>_.reduce((w,T)=>w+Math.max(0,T.hp)/T.hpMax,0)/(_.length||1);pe=p(s)>p(n)?"win":"lose"}return g(800,[{op:"end",result:pe}]),{result:pe,steps:c}}var D=ei;function G(t){return Math.round(Number(t)*1e3)/10+"%"}var ri=new Set(["enemy","ally","self"]),Mh=["damage","aoe_damage","debuff","drain","execute","dot","stun"];function Oh(t,e){let a=Mh.includes(t);if(t==="aoe_damage"&&ri.has(e))return"every enemy";switch(e){case"self":return a?"the weakest front-line enemy":"itself";case"enemy":return"the weakest front-line enemy";case"ally":return"the ally who needs it most";case"allies":return"the whole team";case"all_enemies":return"every enemy";case"front_row":return a?"the enemy front line":"your front line";case"back_row":return a?"the enemy BACK line \u2014 past the front":"your back line";default:return a?"the weakest front-line enemy":"the whole team"}}function Dr(t){return!ri.has(t.target)||t.effect==="aoe_damage"}var Bh={fire:"<b>Fire</b> also burns what it hits for <b>"+G(D.RIDER_BURN)+" of that target's max HP</b> per round, for 2 rounds.",water:"<b>Water</b> also heals your most hurt ally for <b>"+G(D.RIDER_FLOW)+" of the caster's own max HP</b>.",wind:"<b>Wind</b> also gives every teammate <b>+"+D.RIDER_HASTE+" energy</b> (a full bar is 100).",earth:"<b>Earth</b> also shields your front line for <b>"+G(D.RIDER_BULWARK)+" of the caster's DEF</b> each.",light:"<b>Light</b> also clears one DEF debuff from the team and gives everyone <b>+"+D.RIDER_RADIANCE+" energy</b>.",dark:"<b>Dark</b> also returns <b>"+G(D.RIDER_BLIGHT)+" of the damage dealt</b> to the caster as health."};function si(t){return Bh[String(t||"").toLowerCase()]||""}function qr(t){if(!t||!t.effect)return"";let e=oe(t.power),a=Oh(t.effect,t.target),r=Dr(t),s=r?1:D.FOCUS;switch(t.effect){case"damage":case"drain":{let n=(r?D.ULT_AOE:D.ULT_SINGLE)*e,o=t.effect==="drain"?" Heals the caster for "+G(D.DRAIN_SHARE)+" of what it deals.":"";return"Hits "+a+" for <b>"+G(n)+" of ATK</b>"+(r?" each":"")+"."+o}case"aoe_damage":return"Sweeps "+a+" for <b>"+G(D.ULT_AOE*e)+" of ATK</b> each.";case"execute":return"Hits "+a+" for <b>"+G(D.ULT_SINGLE*e)+" of ATK</b>, up to <b>"+G(D.ULT_SINGLE*e*2)+"</b> against a target that is nearly down.";case"dot":return"Poisons "+a+" for <b>"+G(D.DOT_SCALE*e)+" of ATK</b> per round, for "+D.DOT_ROUNDS+" rounds. Ignores shields.";case"stun":return"Makes "+a+" lose its next turn.";case"heal":return"Heals "+a+" for <b>"+G(D.HEAL_SCALE*e*s)+" of the caster's own max HP</b>.";case"shield":return"Shields "+a+" for <b>"+G(D.SHIELD_SCALE*e*s)+" of the caster's DEF</b>.";case"cleanse":return"Clears poison, stuns and debuffs from "+a+", and heals <b>"+G(D.HEAL_SCALE*.5*e*s)+" of the caster's max HP</b>.";case"revive":return"Brings one fallen ally back at <b>"+G(D.REVIVE_PCT)+"</b> health.";case"energy":return"Fills "+a+"'s ultimate bar by <b>"+Math.round(D.ENERGY_GRANT*s)+"</b> points.";case"buff":return"Raises "+a+"'s ATK by <b>"+G(ye(t.power)*s)+"</b> for "+D.BUFF_ROUNDS+" rounds.";case"debuff":return"Drops "+a+"'s DEF by <b>"+G(ye(t.power)*s)+"</b> for "+D.BUFF_ROUNDS+" rounds.";default:return""}}function ni(t){return!t||!["damage","drain","execute"].includes(t.effect)?"":((Dr(t)?D.ULT_AOE:D.ULT_SINGLE)*oe(t.power)/D.ATK_K).toFixed(1)+"&times; a normal hit"}var zh={battle_start:"As the fight opens",self:"As the fight opens",aura:"For the whole fight",on_hit:"Each time this unit is struck",on_attack:"Each time this unit swings",on_kill:"Each time this unit finishes someone",on_ally_low:"The first time an ally drops below <b>"+G(D.LOW_PCT)+" health</b> (once per battle)",on_low:"The first time this unit drops below <b>"+G(D.LOW_PCT)+" health</b> (once per battle)",resist:"For the whole fight",on_round:"On every one of this unit's turns",on_ult:"When this unit casts its Ultimate",on_death:"When this unit falls",cooldown:"Every few rounds",energy:"When the energy bar fills"};function oi(t){if(!t||!t.trigger)return"";let e=zh[t.trigger]||"Sometimes",a=t.target==="self"?"itself":ya.has(t.effect)?"every enemy":"the whole team",r=oe(t.power),s;t.trigger==="resist"?s="it takes <b>"+G(D.RESIST_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="buff"?s="the whole team takes <b>"+G(D.AURA_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="heal"?s="every ally regenerates <b>"+G(D.AURA_REGEN*r)+" of THIS unit's max HP</b> at the start of each of their turns":t.trigger==="aura"&&t.effect==="shield"?s="every ally gets a fresh shield worth <b>"+G(D.AURA_SHIELD*r)+" of its DEF</b> at the start of each of their turns":t.effect==="buff"?s="it raises "+a+"'s ATK by <b>"+G(ye(t.power))+"</b>":t.effect==="debuff"?s="it drops "+a+"'s DEF by <b>"+G(ye(t.power))+"</b>":t.effect==="shield"?s="it shields "+a+" for <b>"+G(D.SHIELD_SCALE*D.PASSIVE_SHARE*r)+" of its DEF</b>":t.effect==="heal"?s="it heals "+a+" for <b>"+G(D.HEAL_SCALE*D.PASSIVE_SHARE*r)+" of its max HP</b>":t.effect==="energy"?s="it hands "+a+" <b>"+Math.round(D.ENERGY_GRANT*D.PASSIVE_SHARE*r)+" energy</b>":t.effect==="drain"?s="it hits "+a+" for <b>"+G(D.ULT_SINGLE*D.PASSIVE_HIT_SHARE*r)+" of its ATK</b> and takes back <b>"+G(D.DRAIN_SHARE)+" of the damage</b> as health":t.effect==="execute"?s="it hits "+a+" for <b>"+G(D.ULT_SINGLE*D.PASSIVE_HIT_SHARE*r)+" of its ATK</b>, up to <b>"+G(D.ULT_SINGLE*D.PASSIVE_HIT_SHARE*r*(1+D.EXECUTE_BONUS))+"</b> against a target with an empty bar":t.effect==="dot"?s="it poisons "+a+" for <b>"+G(D.DOT_SCALE*D.PASSIVE_HIT_SHARE*r)+" of its ATK</b> per round, for <b>"+D.DOT_ROUNDS+" rounds</b>, past any shield":t.effect==="stun"?s="it stuns "+a+" for <b>"+D.STUN_TURNS+(D.STUN_TURNS===1?" turn</b>":" turns</b>"):t.effect==="cleanse"?s="it strips poison, stuns and lowered stats from "+a+" and heals <b>"+G(D.HEAL_SCALE*D.CLEANSE_SHARE*D.PASSIVE_SHARE*r)+" of its max HP</b>":t.effect==="revive"?s="it raises one fallen ally on <b>"+G(D.REVIVE_PCT*D.PASSIVE_SHARE)+" of its bar</b>, or heals the team if nobody has fallen":t.effect==="damage"||t.effect==="aoe_damage"?s="it hits "+(t.effect==="aoe_damage"?"every enemy":"one enemy")+" for <b>"+G(D.ULT_SINGLE*D.PASSIVE_HIT_SHARE*r)+" of its ATK</b>":s="it strikes back";let n=t.trigger==="on_kill"?" It also gains energy.":"";return e+", "+s+"."+n}function ii(t,e){if(!t||!(Number(t.power)>0))return null;let a=oe(t.power),r=Dr(t),s=r?1:D.FOCUS;if(e)return t.trigger==="resist"?{value:G(D.RESIST_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="buff"?{value:G(D.AURA_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="heal"?{value:"",stat:"Regen"}:t.trigger==="aura"&&t.effect==="shield"?{value:"",stat:"Shield each round"}:t.effect==="buff"?{value:G(ye(t.power)),stat:"ATK up"}:t.effect==="debuff"?{value:G(ye(t.power)),stat:"DEF down"}:t.effect==="shield"?{value:G(D.SHIELD_SCALE*.5*a),stat:"of DEF"}:t.effect==="heal"?{value:G(D.HEAL_SCALE*.5*a),stat:"of max HP"}:null;switch(t.effect){case"damage":case"drain":return{value:G((r?D.ULT_AOE:D.ULT_SINGLE)*a),stat:"ATK"};case"aoe_damage":return{value:G(D.ULT_AOE*a),stat:"ATK"};case"execute":return{value:G(D.ULT_SINGLE*a),stat:"ATK"};case"dot":return{value:G(D.DOT_SCALE*a),stat:"ATK per round"};case"heal":return{value:G(D.HEAL_SCALE*a*s),stat:"of max HP"};case"shield":return{value:G(D.SHIELD_SCALE*a*s),stat:"of DEF"};case"buff":return{value:G(ye(t.power)*s),stat:"ATK up"};case"debuff":return{value:G(ye(t.power)*s),stat:"DEF down"};case"energy":return{value:String(Math.round(D.ENERGY_GRANT*s)),stat:"energy"};case"revive":return{value:G(D.REVIVE_PCT),stat:"health"};default:return null}}var Ov=1/3,Fh=["crit","critDmg","recharge","effectHit","effectRes","healBonus"],zv=new Set(Fh),ci={hp:"HP",atk:"ATK",def:"DEF",spd:"SPD",crit:"Crit rate",critDmg:"Crit DMG",recharge:"Energy rech.",effectHit:"Effect hit",effectRes:"Effect RES",healBonus:"Healing"};function di(t){let e=Number(t);return Number.isFinite(e)?e:0}function Ph(t,e,a){return Math.max(e,Math.min(a,t))}var $r=[.7,.8,.9,1],Hh=$r.reduce((t,e)=>t+e,0)/$r.length,Fv=$r.map(t=>t/Hh);var li={3:{cap:4,mainScale:.45,ticks:1},4:{cap:8,mainScale:.7,ticks:2},5:{cap:20,mainScale:1,ticks:5}};var Dh=4;var Pv=1/3;function qh(t){return li[Math.max(3,Math.min(5,Math.round(di(t)||3)))]||li[3]}function jr(t,e){let a=qh(t),r=Ph(Math.round(di(e)),0,a.cap);return Math.min(a.ticks,Math.floor(r/Dh))}function at(t){return String(t??"").replace(/[&<>"']/gu,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function wt(t){let e=t||{},a=String(e.portrait||""),r=String(e.wornOutfit||""),s=[{id:"",name:"Default",url:a,base:!0}];for(let o of Array.isArray(e.outfits)?e.outfits:[]){let i=String(o&&o.id||"");!i||s.some(c=>c.id===i)||s.push({id:i,name:String(o.name||""),url:String(o.url||""),prompt:String(o.prompt||""),tags:Array.isArray(o.tags)?o.tags:[],history:Array.isArray(o.history)?o.history:[],base:!1})}let n=Math.max(0,s.findIndex(o=>o.id===r));return{slots:s,at:n}}function Wr(t){let e=t||{},a=String(e.wornOutfit||"");if(!a)return String(e.portrait||"");let r=(Array.isArray(e.outfits)?e.outfits:[]).find(s=>s&&String(s.id)===a);return String(r&&r.url||e.portrait||"")}function Ur(t,e){let a=t&&t.url?'<img class="of-photo" src="'+at(t.url)+'" alt="" loading="lazy">':'<span class="of-none"></span>';return'<div class="of-plate '+(e===0?"on":"off")+'" data-pos="'+e+'">'+a+"</div>"}function hi(t){return'<div class="of-plate off hole" data-pos="'+t+'" data-hole aria-hidden="true"></div>'}function $h(t,e,a){let r=Array.isArray(t.history)?t.history.filter(n=>n&&n.url):[],s=Array.isArray(t.tags)?t.tags:[];return'<div class="of-edit"><label class="of-lab" for="of-prompt">What this outfit is</label><textarea class="of-ta" id="of-prompt" data-of-prompt rows="3" spellcheck="false">'+at(t.prompt)+'</textarea><label class="of-lab" for="of-tags">Tags</label><input class="of-in" id="of-tags" data-of-tags type="text" spellcheck="false" value="'+at(s.join(", "))+'"><div class="of-edit-row"><button class="of-redo" type="button"'+(a?" disabled":" data-of-redo")+">"+(a?"Painting&hellip;":"Redo art")+"</button>"+(r.length?'<span class="of-past-n">'+r.length+" / "+Math.max(1,Number(e)||1)+" kept</span>":"")+"</div>"+(r.length?'<div class="of-past">'+r.map(n=>'<button class="of-past-b" type="button" data-of-restore="'+at(n.url)+'" title="Go back to this one"><img src="'+at(n.url)+'" alt="" loading="lazy"></button>').join("")+"</div>":"")+"</div>"}function pi(t,e=0,a=!1,r=!1,s=6){let{slots:n}=wt(t),o=n.length,i=Math.max(0,Math.min(o-1,Math.round(Number(e)||0))),c=n[i]||n[0]||{id:"",name:"Default",url:""},l=c.id===String(t&&t.wornOutfit||""),d=n[(i-1+o)%o],h=n[(i+1)%o],v=o>2,u=o>1&&(v||i>0),g=o>1&&(v||i<o-1);return'<div class="of-tab'+(r&&!c.base?" editing":"")+'"><div class="of-rail">'+(o>1?'<button class="of-arrow" type="button" data-of-step="-1" aria-label="Previous outfit">&#9664;</button>':"")+'<div class="of-track">'+(o>1?u?Ur(d,-1):hi(-1):"")+Ur(c,0)+(o>1?g?Ur(h,1):hi(1):"")+"</div>"+(o>1?'<button class="of-arrow" type="button" data-of-step="1" aria-label="Next outfit">&#9654;</button>':"")+'</div><div class="of-foot"><div class="of-id"><b class="of-name">'+at(c.name)+'</b><span class="of-count">'+(i+1)+" / "+o+'</span></div><div class="of-dots">'+n.map((y,b)=>'<span class="of-dot'+(b===i?" on":"")+'"></span>').join("")+"</div>"+(l?'<span class="of-worn">Equipped</span>':'<button class="of-wear" type="button"'+(a?" disabled":' data-of-wear="'+at(c.id)+'"')+">"+(a?"Changing&hellip;":"Equip")+"</button>")+(c.base?"":'<button class="of-editb'+(r?" on":"")+'" type="button" data-of-edit>'+(r?"Close":"Edit")+"</button>")+"</div>"+(r&&!c.base?$h(c,s,a):"")+"</div>"}function fi(t,{onStep:e,onWear:a,onEdit:r,onRedo:s,onRestore:n}={}){if(e)for(let l of t.querySelectorAll("[data-of-step]")){let d=Number(l.getAttribute("data-of-step"))||0;d&&l.addEventListener("click",()=>e(d))}let o=t.querySelector("[data-of-wear]");o&&a&&o.addEventListener("click",()=>a(o.getAttribute("data-of-wear")||""));let i=t.querySelector("[data-of-edit]");i&&r&&i.addEventListener("click",()=>r());let c=t.querySelector("[data-of-redo]");if(c&&s&&c.addEventListener("click",()=>{let l=t.querySelector("[data-of-prompt]"),d=t.querySelector("[data-of-tags]"),h=String(d&&d.value||"").split(",").map(v=>v.trim()).filter(Boolean);s({prompt:String(l&&l.value||""),tags:h})}),n)for(let l of t.querySelectorAll("[data-of-restore]")){let d=l.getAttribute("data-of-restore");d&&l.addEventListener("click",()=>n(d))}}var ui=`
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
`;function vi(t){return t===5?"\u2605\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605\u2605"}function mi(t){return t===5?"r5":"r4"}var jh={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>'},Uh={character:'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="150" cy="92" r="44"/><path d="M150 144c-48 0-82 32-90 78l-12 178h204l-12-178c-8-46-42-78-90-78Z"/></g><path d="M150 50c0 0 28 15 28 45s-28 45-28 45-28-15-28-45 28-45 28-45Z" fill="none" stroke="#F2603C" stroke-opacity="0.4" stroke-width="2"/></svg>'};function ae(t){return(Number(t)||0).toLocaleString("en-US")}var Wh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Gh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h11a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',Vh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Yh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 16.4 8.4 11.6l4 4 3.2-3.2 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="8" r="1.6" stroke="currentColor" stroke-width="1.6"/></svg>',Kh='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3 21 3 21 10 9 22 3 22 3 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.5 9.5 8 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Vr='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',Xh=`
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
`,Yr=Xh+ui;function Jh(t){let e=t.kind!=="weapon",a=e?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+he(t.dedicatedTo):"");return'<button class="'+("u "+mi(t.rarity)+(t.isProtagonist?" you":""))+'" type="button" data-unit="'+f(t.id)+'"><div class="u-art'+(e?"":" wpn")+'">'+bt(t.portrait,"")+'<span class="u-stars">'+vi(t.rarity)+"</span>"+(t.portrait?"":e?jh.character:Pe(t.weaponType,"gf-sil"))+'<span class="u-lvl">Lv '+(Number(t.level)||1)+"</span>"+(e?'<span class="bond-pip">&#9829;'+(Number(t.bond)||0)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+f(t.name)+'</div><div class="u-role">'+f(a)+"</div></div></button>"}var Zh='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>',Qh='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';function ep(t,e){let a=String(e||"").trim().toLowerCase();return!a||String(t.name||"").toLowerCase().includes(a)?!0:(t.kind==="weapon"?[t.weaponType]:[t.role,t.affinity]).some(s=>String(s||"").toLowerCase()===a)}function _a(t,e,a,r){let s=e!=="wpn";return(t||[]).filter(n=>n.kind!=="weapon"===s).filter(n=>a==="all"||String(n.rarity)===a).filter(n=>ep(n,r))}function gi(t,e,a){return a==="loading"?'<div class="grid-empty">Loading units&hellip;</div>':a==="error"?'<div class="grid-empty">Couldn&rsquo;t load your units.</div>':t.length?t.map(Jh).join(""):'<div class="grid-empty">No '+(e?"characters":"weapons")+" here yet.</div>"}function tp(t,e,a){let r=!!String(t||"").trim();return'<div class="u-search'+(r?" on":"")+'"><span class="ic">'+Zh+'</span><input type="search" data-unit-search placeholder="Search by name, role or affinity" value="'+f(t||"")+'">'+(r?'<button class="clr" type="button" data-unit-search-clear aria-label="Clear search">'+Qh+"</button>":"")+'<span class="ct" data-unit-search-count>'+(r?e+" / "+a:a)+"</span></div>"}function bi(t,{cards:e=[],cat:a="char",rarity:r="all",q:s="",state:n="ready"}={}){if(!t||typeof t.querySelector!="function")return!1;let o=t.querySelector("[data-grid]");if(!o)return!1;let i=a!=="wpn",c=_a(e,a,r,s);o.innerHTML=gi(c,i,n);let l=t.querySelector(".u-search");l&&typeof l.setAttribute=="function"&&(String(s||"").trim()?l.setAttribute("data-on","1"):l.removeAttribute("data-on"));let d=t.querySelector("[data-unit-search-count]");if(d){let h=_a(e,a,r,"").length;d.textContent=String(s||"").trim()?c.length+" / "+h:String(h)}return!0}function yi({cards:t=[],cat:e="char",rarity:a="all",state:r="ready",q:s=""}={}){let n=e!=="wpn",o=_a(t,e,a,s),i=_a(t,e,a,"").length,c=d=>d?' aria-pressed="true"':' aria-pressed="false"',l=gi(o,n,r);return`
<div class="root">
  ${Vr}
  <div class="stage"></div>
  <section class="screen" data-screen="roster">
    <div class="head">
      <button class="back" type="button" data-roster-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Command</div><h2>Units</h2></div>
    </div>
    <div class="roster-body gf-swap">
      <div class="toolbar">
        <div class="cats">
          <button type="button" data-cat="char"${c(n)}>${Vh}Characters</button>
          <button type="button" data-cat="wpn"${c(!n)}>${Kh}Weapons</button>
        </div>
        ${tp(s,o.length,i)}
        <div class="filters">
          <span class="lbl">Rarity</span>
          ${ha.map(d=>`<button class="chip${d.tone?" "+d.tone:""}" type="button" data-rar="${d.id}"${c(a===d.id)}>${d.label}</button>`).join("")}
        </div>
      </div>
      <div class="grid-scroll"><div class="grid" data-grid>${l}</div></div>
    </div>
  </section>
</div>`}function xt(t,e,a,r){let s=Math.min(100,Math.max(0,Number(e)||0)),n=a===void 0?Number(e)||0:Number(a)||0,o=Number(r)>0?" <em>+"+ae(Math.round(Number(r)))+"</em>":"";return'<div class="stat"><span class="k">'+t+'</span><div class="bar"><i style="width:'+s+'%"></i></div><span class="v">'+ae(n)+o+"</span></div>"}var ap=[["crit","Crit rate",15,"%"],["critDmg","Crit DMG",150,"%"],["recharge","Energy rech.",100,"%"],["effectHit","Effect hit",0,"%"],["effectRes","Effect RES",0,"%"],["healBonus","Healing",0,"%"]];function rp(t,e){let a=e||{};return ap.map(([r,s,n,o])=>{let i=Number(t[r]),c=Number.isFinite(i),l=c?i:n,d=Number(a[r])||0;return'<div class="stat sec2'+(c?" own":"")+'"><span class="k">'+s+'</span><span class="v">'+Math.round((l+d)*10)/10+o+(d>0?" <em>+"+Math.round(d*10)/10+o+"</em>":"")+"</span></div>"}).join("")}var sp={damage:"Damage",aoe_damage:"AoE damage",heal:"Heal",shield:"Shield",buff:"Buff",debuff:"Debuff"},np={enemy:"Enemy",all_enemies:"All enemies",ally:"Ally",allies:"Allies",self:"Self",front_row:"Front row",back_row:"Back row"},op={front:"Front-line role",back:"Back-line role"};function ka(t){return String(t||"").replace(/_/g," ").replace(/^\w/,e=>e.toUpperCase())}function ip(t,e,a,r){let s=[];a&&t.trigger&&s.push('<span class="m trig">'+f(ka(t.trigger))+"</span>"),t.effect&&s.push('<span class="m">'+f(sp[t.effect]||ka(t.effect))+"</span>");let n=ii(t,!!r);return n&&s.push('<span class="m">'+(n.value?n.value+" ":"")+"<b>"+n.stat+"</b></span>"),t.target&&s.push('<span class="m">'+f(np[t.target]||ka(t.target))+"</span>"),e&&s.push('<span class="m aff">'+f(e)+"</span>"),s.length?'<div class="mech">'+s.join("")+"</div>":""}function xa(t,e,a,r,s){if(!e||!e.name)return"";let n=s?oi(e):qr(e),o=s?"":ni(e),i=s?"":si(a),c=n?'<div class="derived">'+n+(o?' <span class="vs">'+o+"</span>":"")+(i?'<span class="rider">'+i+"</span>":"")+"</div>":"";return'<div class="sec"><div class="h">'+t+'</div><div class="skill"><span class="ic">'+Wh+'</span><div><div class="sn">'+f(e.name)+"</div>"+ip(e,a,r,s)+c+'<p class="flavour">'+f(e.description)+"</p></div></div></div>"}function lp(t,e,a){let r=t.kind!=="weapon",s="";if(r&&(s+='<div class="sec"><div class="h">Combat</div><div class="mech">',t.role&&(s+='<span class="m">'+f(t.role)+"</span>"),t.affinity&&(s+='<span class="m aff">'+f(t.affinity)+"</span>"),t.position&&(s+='<span class="m">'+f(op[t.position]||ka(t.position))+"</span>"),s+="</div></div>"),s+='<div class="sec"><div class="h">Stats</div><div class="stats">',r){let n=t.stats||{},i=1+((Number(e)>0?Number(e):1)-1)*.06,c=a||{},l=(g,y)=>(Number(g)||0)*(1+(Number(y)||0)),d=Math.round(20+l(n.hp,c.hpPct)*6*i),h=Math.round(l(n.atk,c.atkPct)*i),v=Math.round(l(n.def,c.defPct)*i),u=Math.round(l(n.spd,c.spdPct));s+=xt("HP",n.hp,d,d-Math.round(20+(Number(n.hp)||0)*6*i)),s+=xt("ATK",n.atk,h,h-Math.round((Number(n.atk)||0)*i)),s+=xt("DEF",n.def,v,v-Math.round((Number(n.def)||0)*i)),s+=xt("SPD",n.spd,u,u-(Number(n.spd)||0)),s+="</div></div>",s+='<div class="sec"><div class="h">Combat stats</div><div class="stats two">'+rp(n,c)}else{let n=t.mainStat||{},o=t.subStat||{};s+=xt("ATK",n.value)+xt(String(o.key||"SUB").toUpperCase(),o.value)}if(s+="</div></div>",r?(s+=xa("Skill",t.skill,t.affinity,!1,!1),s+=xa("Passive",t.passive,t.affinity,!0,!0),s+='<div class="sec"><div class="h">Profile</div>',t.description&&(s+="<p>"+f(t.description)+"</p>"),t.personality&&(s+="<p>"+f(t.personality)+"</p>"),s+="</div>"):(s+=xa("Granted skill",t.grantedSkill,null,!0,!1),s+=xa("Passive",t.passive,null,!0,!0),s+='<div class="sec"><div class="h">About</div><p>'+f(t.description)+"</p></div>"),!t.isProtagonist){let n=t.origin||{},o=n.banner==="standard"?"Standard Banner":n.banner||"Standard Banner";s+='<div class="sec"><div class="h">Origin</div><div class="origin"><span>From <b>'+f(o)+"</b></span>"+(r?'<span class="story-chip">'+Gh+"In the story cast pool</span>":"")+"</div></div>"}return s}function Gr(t,e,a,r){let s=n=>(Math.round(Number(n)*10)/10).toLocaleString("en-US");return'<span class="k">'+f(t)+'</span><span class="v">+'+s(e)+r+'</span><span class="m">'+(a>e?"&rarr; +"+s(a)+r+" at cap":"at cap")+"</span>"}var Oe=t=>Math.round(Number(t)*1e3)/10;function cp(t,e){let a=t.item||null,r=!!t.locked,s="gr-slot"+(a?"":" empty"),n=a?a.main?Ae[t.key]||Ae.core:Pe(a.weaponType,"gf-gsil"):r?Ae[t.key]||Ae.core:'<span class="plus">+</span>',o=a?a.main?"Lv "+(Number(a.level)||0)+" &middot; <b>"+ve(a.main.key,a.main.value)+"</b>":"Lv "+(Number(a.level)||1)+" &middot; <b>+"+Oe(a.atkPct)+"%</b>":r?"Soon":"Empty";return'<button class="'+s+'" type="button"'+(r?" disabled":' data-gear-slot="'+f(t.key)+'" aria-pressed="'+(e===t.key?"true":"false")+'"')+'><span class="lab">'+f(t.label)+'</span><span class="art">'+n+"</span>"+(a?'<span class="rr">'+(Number(a.rarity)||4)+"&#9733;</span>":"")+'<span class="foot">'+o+"</span></button>"}function dp(t){let e=Gr("ATK",Oe(t.atkPct),Oe(t.atkPctMax),"%")+(t.sub?t.sub.points!==void 0?Gr(t.sub.label,t.sub.points,t.sub.pointsMax,"%"):Gr(t.sub.label,Oe(t.sub.pct),Oe(t.sub.pctMax),"%"):""),a=t.grantedSkill?'<div class="gr-ab"><div class="t"><span class="lab">2nd skill</span><span class="nm">'+f(t.grantedSkill.name)+'</span><span class="gr-tag'+(t.grantedActive?"":" off")+'">'+(t.grantedActive?"Active":"Inactive")+"</span></div>"+(t.grantedActive?'<div class="gr-line">'+qr(t.grantedSkill)+"</div>":'<div class="gr-why">Only '+f(t.dedicatedTo||"its owner")+" draws this skill from it. Here it is stats only.</div>")+"</div>":"";return'<div class="gr-name">'+f(t.name)+'</div><div class="gr-meta"><span class="st">'+"&#9733;".repeat(Math.max(1,Number(t.rarity)||4))+"</span> "+f(t.weaponType||"")+" &middot; Lv "+(Number(t.level)||1)+" / "+(Number(t.levelCap)||90)+'</div><div class="gr-stats">'+e+"</div>"+a}function hp(t){let e=(t.subs||[]).map(a=>'<span class="k">'+f(a.label)+'</span><span class="v">'+ve(a.key,a.value)+'</span><span class="m">'+(Number(a.rolls)>1?"&times;"+a.rolls:"")+"</span>").join("");return'<div class="gr-name">'+(Number(t.rarity)||3)+"&#9733; "+f(Sa(t.slot))+'</div><div class="gr-meta"><span class="st">'+"&#9733;".repeat(Math.max(1,Number(t.rarity)||3))+"</span> Lv "+(Number(t.level)||0)+" / "+(Number(t.levelCap)||0)+'</div><div class="gr-stats"><span class="k">'+f(t.main.label)+'</span><span class="v">'+ve(t.main.key,t.main.value)+'</span><span class="m">'+(t.main.valueMax>t.main.value?"&rarr; "+ve(t.main.key,t.main.valueMax)+" at cap":"at cap")+'</span></div><div class="gr-ab"><div class="t"><span class="lab">Sub-stats</span></div><div class="gr-stats">'+e+"</div></div>"}function Sa(t){let e=String(t||"");return e.charAt(0).toUpperCase()+e.slice(1)}function pp(t,e,a,r,s,n,o){let i=Array.isArray(e)?e:[],c=a||[],l=Number(t.levelCap)||0,d=Number(t.level)||0,h=Math.min(l,d+c.length),v=Number(t.feedCost)||Number(s)||0,u=c.length*v,g=u>r,y=Number(n)||3,b=Math.floor(d/y),x=Math.floor(h/y),E=i.filter(R=>R.id!==t.id&&!R.equipped&&!R.locked),k=Math.max(0,l-d),S=E.length?E.map(R=>{let m=c.includes(R.id),L=!m&&c.length>=k;return'<button class="gr-card sm'+(m?" on":"")+'" type="button"'+(L?" disabled":"")+' data-rfeed-pick="'+f(R.id)+'"><span class="art">'+(Ae[R.slot]||Ae.core)+'</span><span class="rr">'+(Number(R.rarity)||3)+'&#9733;</span><span class="nm">'+Sa(R.slot)+" &middot; Lv "+(Number(R.level)||0)+'</span><span class="gv">'+f(R.main.label)+" "+ve(R.main.key,R.main.value)+"</span></button>"}).join(""):'<div class="gr-none">Nothing spare to feed. Everything you hold is either equipped or locked &mdash; run the <b>Relic Vault</b> in Materials for more.</div>',H=o&&o.length?'<div class="gr-grew">Reinforced: '+o.map(R=>"<b>"+f(R.label)+" "+ve(R.key,R.by)+"</b>").join(", ")+"</div>":"";return'<div class="gr-pick"><div class="gr-pick-head"><button class="gr-back" type="button" data-rfeed-back>&#9664; Back</button><span class="ttl">Upgrade '+f(Sa(t.slot))+'</span><span class="sub">Lv '+d+" / "+l+'</span></div><div class="gr-feedbar"><span class="fig">Feeding<b>'+c.length+"</b>"+(c.length===1?" piece":" pieces")+'</span><span class="fig">Level<b>'+d+" &rarr; "+h+'</b></span><span class="fig">Reinforcements<b>+'+(x-b)+"</b>"+(x===b&&c.length?(b+1)*y<=l?" (next at Lv "+(b+1)*y+")":" (at cap)":"")+'</span><span class="fig'+(g?" short":"")+'">Funds<b>'+ae(u)+"</b>of "+ae(r)+" <i>("+ae(v)+" per level)</i></span></div>"+H+'<div class="gr-grid sm">'+S+'</div><div class="gr-act"><button type="button" data-rfeed-go'+(!c.length||g||h===d?" disabled":"")+">Feed</button>"+(c.length?'<button class="ghost" type="button" data-rfeed-clear>Clear</button>':"")+"</div></div>"}function fp(t,e,a){let r=t.kind==="relic",s=e.length?e.map(n=>{let o=n.equipped?"Equipped":n.heldByName?"On "+n.heldByName:n.wornElsewhere?"In use":"Free",i=r?f(n.main.label)+" "+ve(n.main.key,n.main.value):"+"+Oe(n.atkPct)+"% ATK"+(n.grantsHere?" &middot; 2nd skill":""),c=r?Ae[n.slot]||Ae.core:Pe(n.weaponType,"gf-gsil"),l=r?Sa(n.slot)+" &middot; Lv "+(Number(n.level)||0):f(n.name);return'<button class="gr-card'+(n.equipped?" on":"")+'" type="button" data-equip="'+f(n.id)+'"><span class="art">'+c+'</span><span class="rr">'+(Number(n.rarity)||4)+"&#9733;</span>"+(n.locked?'<span class="lk">&#128274;</span>':"")+'<span class="nm">'+l+'</span><span class="gv">'+i+'</span><span class="who">'+f(o)+"</span></button>"}).join(""):'<div class="gr-none">'+(r?"No "+f(t.label)+" relics yet &mdash; they drop from the <b>Relic Vault</b> stage in Materials.":"You hold no "+f(t.accepts||"piece")+" for this slot yet &mdash; they come from the weapon banner in Summon.")+"</div>";return'<div class="gr-pick"><div class="gr-pick-head"><button class="gr-back" type="button" data-gear-back>&#9664; Slots</button><span class="ttl">'+f(t.label)+'</span><span class="sub">'+f(a.role||"This unit")+" holds a <b>"+f(t.accepts||"piece")+'</b></span></div><div class="gr-grid">'+s+"</div>"+(t.item?'<div class="gr-act">'+(r?'<button type="button" data-rfeed-open>Upgrade</button>':'<button type="button" data-wlevel="'+f(t.item.id)+'">Upgrade</button>')+'<button class="ghost" type="button" data-equip="">Remove</button></div>':"")+"</div>"}function up(t,e,a,r){let s=e||null;if(!s)return'<div class="gr-root"><div class="gr-none">This unit has no equipment slots.</div></div>';let n=Array.isArray(s.slots)?s.slots:[],o=Array.isArray(s.options)?s.options:[],i=a?n.find(b=>b.key===a&&!b.locked):null;if(i&&r&&r.open&&i.item)return'<div class="gr-root">'+pp(i.item,r.inventory||[],r.picked||[],Number(r.funds)||0,Number(r.cost)||0,Number(r.tickEvery)||3,r.gained)+"</div>";if(i)return'<div class="gr-root">'+fp(i,i.options||o,t)+"</div>";let c='<div class="gr-rack">'+n.map(b=>cp(b,a)).join("")+"</div>",l=Number(s.cp)||0,d=Number(s.cpBare)||0,h=n.filter(b=>b.item).length,v=[];if(h>1){let b=s.totals||{};b.atkPct&&v.push('<span class="fig">ATK<b>+'+Oe(b.atkPct)+"%</b></span>"),b.hpPct&&v.push('<span class="fig">HP<b>+'+Oe(b.hpPct)+"%</b></span>"),b.defPct&&v.push('<span class="fig">DEF<b>+'+Oe(b.defPct)+"%</b></span>"),b.spdPct&&v.push('<span class="fig">SPD<b>+'+Oe(b.spdPct)+"%</b></span>");for(let x of["crit","critDmg","recharge","effectHit","effectRes","healBonus"])b[x]&&v.push('<span class="fig">'+f(ci[x]||x)+"<b>+"+Math.round(b[x]*10)/10+"%</b></span>")}else h?v.push('<span class="fig">1 of '+n.length+" slots filled</span>"):v.push('<span class="fig">Nothing equipped yet</span>');let u='<div class="gr-sum">'+v.join("")+'<span class="pw">Power<b>'+ae(l)+"</b>"+(l>d?" <em>+"+ae(l-d)+"</em>":"")+"</span></div>",g=n.find(b=>b.item),y=g?'<div class="gr-detail">'+(g.item.main?hp(g.item):dp(g.item))+"</div>":'<div class="gr-detail"><div class="gr-why">Nothing equipped. Click a slot to choose a piece for it. The four relic slots open when relics ship &mdash; they are drawn here so the rack never changes shape under you.</div></div>';return'<div class="gr-root">'+c+u+y+"</div>"}function vp(t,e){let a=e||{},r=Array.isArray(a.rungs)?a.rungs:[],s=Math.max(0,Number(a.owned)||0),n=Number(a.max)||r.length,o=he(t.name)||"this unit",i=r.map(l=>'<div class="fct-row'+(!!l.owned?" on":"")+'"><span class="no">'+f(String(l.n))+'</span><span class="nm">'+f(l.name||"")+'</span><span class="ln">'+f(l.line||"")+"</span></div>").join(""),c=s>=n?"<b>Every facet is unlocked.</b> Another copy of "+f(o)+" adds nothing \u2014 this ladder is the only thing copies feed.":"Pull "+f(o)+" again to raise the next one.";return'<div class="gr-root"><div class="fct-head"><span class="lab">Facets</span><span class="cnt">'+s+"<small> / "+n+'</small></span></div><div class="fct-list">'+i+'</div><div class="fct-why">'+c+"</div></div>"}function mp(t,e){let a=Number(e)||0,r=he(t.name)||"this unit";return'<div class="bond-meter"><div class="top"><span class="lv">&#9829; Bond '+a+'</span><span class="xp">'+(a>0?"in progress":"not started")+'</span></div><div class="track"><i style="width:'+(a>0?12:0)+'%"></i></div><div class="note">Affinity grows by bringing '+f(r)+' into story beats and battles. Each bond level will unlock a character event.</div></div><div class="sec"><div class="h">Character events</div><p>Character events unlock as bond grows &mdash; the relationship system is coming.</p></div>'}function wi(t,e){return xi(t,e)}function xi(t,e){let a=e||{},r=Number(a.level)||1,s=Number(a.levelCap)||r,n=r>=s,o=Math.max(0,Number(a.xp)||0),i=Number(a.xpNeeded)||0,c=Array.isArray(a.tiers)?a.tiers:[],l=a.wallet&&a.wallet.insight||{},d=Number(a.wallet&&a.wallet.funds)||0,h=Number(a.cp)||0,v=(Array.isArray(a.ladder)?a.ladder:[]).find(F=>Number(F.level)===r)||null,u=v&&Number(v.funds)||0,g=!n&&u>0&&d<u,y=a.preview||null,b=y&&Number.isFinite(y.xpAfter)?y.xpAfter:o,x=y&&Number.isFinite(y.needAfter)?y.needAfter:i,E=y&&Number.isFinite(y.solid)?y.solid:o,k=x>0?Math.min(100,Math.round(E/x*100)):100,S=y&&x>0?Math.min(100-k,Math.round((b-E)/x*100)):0,H={account:"Capped by your Account Rank &mdash; a unit cannot pass twice your rank.",ascension:"Capped until the next ascension.",max:"Fully levelled."}[a.levelCapReason||"max"],R='<div class="gw-plate"><div class="gw-top"><span class="gw-lv">Lv <b data-gw-lv>'+r+"</b>"+(y&&y.levelTo>r?"<em data-gw-lv-to>&rarr; "+y.levelTo+"</em>":"<i>/ "+s+"</i>")+'</span><span class="gw-cp">CP <b>'+ae(h)+"</b>"+(y&&y.cpTo>h?"<em>&rarr; "+ae(y.cpTo)+"</em>":"")+'</span></div><div class="gw-track'+(n?" full":"")+'"><i data-gw-bar style="width:'+k+'%"></i><u data-gw-ghost style="width:'+S+'%"></u></div><div class="gw-figs">'+(n?'<span class="gw-capped">'+H+"</span>":"<span><b data-gw-xp>"+ae(b)+"</b> / "+ae(x)+' XP</span><span class="gw-cost'+(y?y.short?" short":"":g?" short":"")+'" data-gw-cost>'+(y?ae(y.funds)+" Funds"+(y.short?" &mdash; you have "+ae(d):""):ae(u||d)+" Funds"+(g?" &mdash; you have "+ae(d):""))+"</span>")+"</div></div>",m=y&&Number.isFinite(y.roomLeft)?y.roomLeft:1/0,L=n?"":'<div class="gw-feed"><div class="gw-items">'+c.map(F=>{let J=Math.max(0,Number(l[F.id])||0),ee=y&&y.spent?Math.max(0,Number(y.spent[F.id])||0):0,ie=m>0&&ee<J;return'<button class="gw-item'+(J?"":" empty")+(ee?" on":"")+'" type="button"'+(ie?"":" disabled")+' data-feed="'+f(F.id)+'"><span class="gw-i-name">'+f(String(F.name).replace(/^Insight /,""))+'</span><span class="gw-i-xp">+'+ae(F.xp)+'</span><span class="gw-i-held" data-feed-held="'+f(F.id)+'">'+ae(J-ee)+(ee?"<em>&minus;"+ae(ee)+"</em>":"")+"</span></button>"}).join("")+'</div><div class="gw-acts"><button class="gw-reset" type="button" data-feed-reset'+(y?"":" disabled")+'>Reset</button><button class="gw-go" type="button" data-feed-go'+(y&&y.ready||!y&&i>0&&o>=i&&r<s&&!g?"":" disabled")+">Level up</button></div></div>",W=wp(a.ascension,d)+bp(a.form,d);return R+L+W}var gp={"no-signature":"Equip this unit's signature weapon to train its skill.","no-ability":"This unit has no such ability.","at-cap":"Ascend this unit to train it further.","needs-mandate":"Mandates come from the 7 Day Login Event &mdash; day 6, one a week.","none-held":"You hold none of these &mdash; farm them in Materials, at the Tenet Trial.","short-materials":"Not enough Tenets yet &mdash; the Tenet Trial in Materials is open every day.","short-funds":"Not enough Funds.",max:"Fully trained."};function bp(t,e){if(!t||!Array.isArray(t.tracks))return"";let a=Math.max(1,Number(t.max)||10),s='<div class="asc-head"><span class="lab">Form</span><span class="asc-cap">Cap '+Math.max(1,Number(t.cap)||a)+"</span></div>",n=o=>{let i=Math.max(1,Number(o.level)||1),c=o.live?o.next:null,l=gp[o.reason]||"",d='<div class="fm-id"><span class="k">'+f(o.label)+"</span>"+(o.live?'<span class="fm-lv">Lv '+i+"<small> / "+a+"</small></span>"+(o.powers?'<span class="v">'+ae(o.powers.now)+'%</span><span class="m">'+ae(o.powers.max)+"% at Lv "+a+"</span>":""):'<span class="fm-off">Locked</span>')+"</div>",h=c?'<div class="asc-cost">'+(c.items||[]).map(u=>'<div class="asc-item'+(u.short?" short":"")+'"><span class="n">'+f(u.name)+'</span><span class="c">'+ae(u.held)+" / "+ae(u.need)+"</span></div>").join("")+'<div class="asc-item'+(e<c.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+ae(e)+" / "+ae(c.funds)+"</span></div></div>":"",v='<div class="asc-foot"><span class="asc-why">'+l+"</span>"+(c?'<button class="asc-go" type="button" data-form-up="'+f(o.key)+'"'+(o.ready?"":" disabled")+">Train</button>":"")+"</div>";return'<div class="fm-track'+(o.live?"":" off")+'">'+d+h+v+"</div>"};return'<div class="asc-plate fm-plate">'+s+t.tracks.map(n).join("")+"</div>"}var yp={"none-held":"You hold none of these &mdash; farm them in Materials.","short-materials":"Not enough materials for the next ascension.","short-funds":"Not enough Funds for the next ascension.",max:"Fully ascended.",ready:""};function wp(t,e){if(!t)return"";let a=Math.max(0,Number(t.step)||0),r=Math.max(1,Number(t.max)||6),s=t.next||null,n="";for(let h=0;h<r;h+=1)n+='<span class="'+(h<a?"on":"off")+'">&#9733;</span>';let o='<div class="asc-head"><span class="lab">Ascension</span><span class="asc">'+n+'</span><span class="asc-cap">'+(s?"Cap "+s.capFrom+" &rarr; "+s.capTo:"Cap "+(Number(t.cap)||90))+"</span></div>",i=(s?s.items:[]).map(h=>'<div class="asc-item'+(h.short?" short":"")+'"><span class="n">'+f(h.name)+'</span><span class="c">'+ae(h.held)+" / "+ae(h.need)+"</span></div>").join("")+(s?'<div class="asc-item'+(e<s.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+ae(e)+" / "+ae(s.funds)+"</span></div>":""),c=s?"Reach Lv "+(Number(t.cap)||s.capFrom)+" to ascend &mdash; this unit is Lv "+(Number(t.level)||1)+".":"",d='<div class="asc-foot"><span class="asc-why">'+[t.reason==="not-at-cap"?c:yp[t.reason]||"",t.gated===!1&&s?"The level cap stays open until then.":""].filter(Boolean).join(" ")+"</span>"+(s?'<button class="asc-go" type="button" data-ascend'+(t.ready?"":" disabled")+">Ascend</button>":"")+"</div>";return'<div class="asc-plate">'+o+(s?'<div class="asc-cost">'+i+"</div>":"")+d+"</div>"}function ki({unit:t,level:e=1,bond:a=0,tab:r="profile",state:s="ready",growth:n=null,gear:o=null,gearSlot:i=null,gearFeed:c=null,facets:l=null,outfitAt:d=0,outfitBusy:h=!1,outfitEditing:v=!1,outfitHistoryMax:u=6}={}){if(s==="loading"||!t)return`
<div class="root">
  ${Vr}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">Unit</div><h2>${s==="error"?"Unavailable":"Loading\u2026"}</h2></div>
    </div>
    <div class="cp-body"><div class="grid-empty" style="grid-column:1/-1">${s==="error"?"Couldn't load this unit.":"Loading\u2026"}</div></div>
  </section>
</div>`;let g=t.kind!=="weapon",y=g&&!!l,b=g&&!t.isProtagonist,x=g,E=g?[["profile","Profile"],["growth","Growth"],["gear","Gear"],...y?[["facets","Facets"]]:[],...x?[["outfits","Outfits"]]:[],...b?[["bond","Bond"]]:[]]:[["profile","Profile"],["growth","Growth"]],k=r;!g&&(k==="bond"||k==="gear")&&(k="profile"),k==="bond"&&!b&&(k="profile"),k==="facets"&&!y&&(k="profile"),k==="outfits"&&!x&&(k="profile");let S=E.map(L=>'<button type="button" role="tab" data-tab="'+L[0]+'" aria-selected="'+(L[0]===k?"true":"false")+'">'+L[1]+"</button>").join(""),H=k==="outfits"?pi(t,d,h,v,u):k==="bond"?mp(t,a):k==="facets"?vp(t,l):k==="gear"?up(t,o,i,c):k==="growth"?xi(t,n):lp(t,e,o&&o.totals),R=g?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+he(t.dedicatedTo):""),m='<div class="cp-portrait">'+(Wr(t)?'<img class="cp-photo" src="'+f(Wr(t))+'" alt="" loading="lazy">':g?Uh.character:Pe(t.weaponType,"gf-sil"))+'</div><div class="cp-id-top">'+(g&&!t.isProtagonist?'<button class="cp-art-btn" type="button" data-portrait>'+Yh+"Portrait</button>":"")+'<button class="cp-fav" type="button" aria-pressed="false" data-fav><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 3.2C20 14.5 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="cp-id-plate"><div class="plate-stars '+mi(t.rarity)+'">'+vi(t.rarity)+"</div><h3>"+f(he(t.name))+'</h3><div class="role">'+f(R)+'</div><div class="chips"><span>Lv '+(Number(e)||1)+"</span>"+(g?'<span class="bond">&#9829; Bond '+(Number(a)||0)+"</span>":"")+'</div><button class="cp-party" type="button"'+(g?" data-set-party":" disabled")+">"+(g?"Set to party":"Equip to a character")+"</button></div>";return`
<div class="root">
  ${Vr}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">${g?"Character":"Weapon"}</div><h2>${f(he(t.name))}</h2></div>
    </div>
    <div class="cp-body gf-swap">
      <div class="cp-id${g?"":" wpn"}">${m}</div>
      <div class="cp-main">
        <div class="cp-tabs" role="tablist">${S}</div>
        <div class="cp-panel">${H}</div>
      </div>
    </div>
  </section>
</div>`}function _i(t,{onOpenUnit:e,onBack:a,onCat:r,onRarity:s,onSearch:n}){(t.querySelector(".root")||t).addEventListener("click",d=>{let h=d&&d.target&&d.target.closest?d.target:null,v=h&&h.closest("[data-unit]");v&&e&&e(v.getAttribute("data-unit"))});for(let d of t.querySelectorAll("[data-cat]"))d.addEventListener("click",()=>r&&r(d.dataset.cat));for(let d of t.querySelectorAll("[data-rar]"))d.addEventListener("click",()=>s&&s(d.dataset.rar));let i=t.querySelector("[data-unit-search]");i&&i.addEventListener("input",()=>n&&n(i.value||""));let c=t.querySelector("[data-unit-search-clear]");c&&c.addEventListener("click",()=>{i&&(i.value=""),n&&n(""),i&&typeof i.focus=="function"&&i.focus()});let l=t.querySelector("[data-roster-back]");l&&l.addEventListener("click",()=>a&&a())}function Si(t,{onTab:e,onBack:a,onSetParty:r,onPortrait:s,onFeed:n,onFeedReset:o,onFeedGo:i,onAscend:c,onFormUp:l,onGearSlot:d,onGearBack:h,onEquip:v,onRelicFeed:u,onOpenWeapon:g}){for(let L of t.querySelectorAll("[data-tab]"))L.addEventListener("click",()=>e&&e(L.dataset.tab));let y=t.querySelector("[data-back-roster]");y&&y.addEventListener("click",()=>a&&a());let b=t.querySelector("[data-set-party]");b&&b.addEventListener("click",()=>r&&r());let x=t.querySelector("[data-portrait]");x&&x.addEventListener("click",()=>s&&s());let E=t.querySelector(".root")||t,k=null,S=null,H=0,R=()=>{k&&(clearTimeout(k),k=null),S=null,H=0},m=()=>{if(!S)return;let L=E.querySelector('[data-feed="'+S+'"]');if(!L||L.disabled){R();return}H+=1,n&&n(S),k=setTimeout(m,Math.max(55,300-H*24))};E.addEventListener("pointerdown",L=>{let W=L&&L.target&&L.target.closest?L.target:null,F=W&&W.closest("[data-feed]");!F||F.disabled||(R(),S=F.getAttribute("data-feed"),k=setTimeout(m,420))});for(let L of["pointerup","pointercancel","pointerleave"])E.addEventListener(L,R);E.addEventListener("click",L=>{let W=L&&L.target&&L.target.closest?L.target:null;if(!W)return;let F=W.closest("[data-feed]");if(F&&!F.disabled){n&&n(F.dataset.feed);return}if(W.closest("[data-feed-reset]")){o&&o();return}if(W.closest("[data-feed-go]")){i&&i();return}let J=W.closest("[data-ascend]");if(J&&!J.disabled){c&&c();return}let ee=W.closest("[data-form-up]");if(ee&&!ee.disabled){l&&l(ee.getAttribute("data-form-up"));return}let ie=W.closest("[data-gear-slot]");if(ie&&!ie.disabled){d&&d(ie.getAttribute("data-gear-slot"));return}if(W.closest("[data-gear-back]")){h&&h();return}let V=W.closest("[data-wlevel]");if(V&&!V.disabled){g&&g(V.getAttribute("data-wlevel"));return}let Y=W.closest("[data-equip]");if(Y&&!Y.disabled){v&&v(Y.getAttribute("data-equip")||"");return}if(!u)return;if(W.closest("[data-rfeed-open]")){u({type:"open"});return}if(W.closest("[data-rfeed-back]")){u({type:"back"});return}if(W.closest("[data-rfeed-clear]")){u({type:"clear"});return}let te=W.closest("[data-rfeed-go]");if(te&&!te.disabled){u({type:"go"});return}let re=W.closest("[data-rfeed-pick]");re&&u({type:"pick",id:re.getAttribute("data-rfeed-pick")})})}var Ea=2/3;function $t(t){let e=Array.isArray(t)?t:String(t??"").split(","),a=[];for(let r of e){let s=String(r??"").trim();s&&!a.includes(s)&&a.push(s)}return a}function Kr(t,e,a=1,r=.5,s=.5){let n=Math.max(1,Number(t)||1),o=Math.max(1,Number(e)||1),i=Math.min(n,o*Ea),c=Math.min(1,Math.max(.2,Number(a)||1)),l=i*c,d=l/Ea;return Xr({x:n*r-l/2,y:o*s-d/2,w:l,h:d},n,o)}function Xr(t,e,a){let r=Math.max(1,Number(e)||1),s=Math.max(1,Number(a)||1),n=Math.min(Math.max(1,Number(t&&t.w)||1),r),o=n/Ea;o>s&&(o=s,n=o*Ea);let i=Math.min(Math.max(0,Number(t&&t.x)||0),r-n),c=Math.min(Math.max(0,Number(t&&t.y)||0),s-o);return{x:i,y:c,w:n,h:o}}var Ei=`
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
`;function xp(t,e){return'<span class="pt-chip">'+f(t)+'<button type="button" data-tag-drop="'+e+'" aria-label="Remove '+f(t)+'">&times;</button></span>'}function kp(t,e){return t.length?'<div class="pt-strip">'+t.map((a,r)=>'<button class="pt-thumb" type="button" aria-current="'+(a.current?"true":"false")+'"'+(a.current?" disabled":' data-pick="'+r+'"')+' title="'+f(a.source==="upload"?"Your own image":"Generated")+'"><img src="'+f(a.url)+'" alt="" loading="lazy">'+(a.current?'<span class="now">Now</span>':"")+"</button>").join("")+"</div>":'<div class="pt-empty">No earlier art yet \u2014 the first redo puts this one here, and the last '+e+" are kept.</div>"}function Ai({unit:t=null,view:e="edit",draft:a=null,history:r=[],historyMax:s=0,busy:n=!1,error:o="",crop:i=null,promptName:c=""}={}){let l=t&&t.name?String(t.name):"Portrait",d=a||{appearance:"",tags:[]},h=$t(d.tags),v='<div class="head"><button class="back" type="button" data-portrait-back>&#9664; '+f(l)+'</button><div class="head-id"><div class="eyebrow">Portrait</div><h2>'+(e==="crop"?"Choose the frame":"Redo the art")+"</h2></div></div>";if(e==="crop"){let y=i&&i.src||"",b=Math.round((i&&i.size||1)*100),x=i&&i.natural,E=x&&i.frame?' style="left:'+i.frame.x/x.w*100+"%;top:"+i.frame.y/x.h*100+"%;width:"+i.frame.w/x.w*100+"%;height:"+i.frame.h/x.h*100+'%"':"";return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait-crop">
    ${v}
    <div class="pt-crop gf-swap">
      <div class="pt-canvas">
        <div class="pt-shot" data-shot${x?' style="aspect-ratio:'+x.w+" / "+x.h+'"':""}>
          <img src="${f(y)}" alt="" data-crop-img>
          <div class="pt-frame" data-frame${E}></div>
        </div>
      </div>
      <div class="pt-crop-bar">
        <label class="pt-size">Frame<input type="range" min="20" max="100" value="${b}" data-size></label>
        <button class="pt-alt" type="button" data-crop-cancel>Cancel</button>
        <button class="pt-go" type="button" data-crop-ok${n?" disabled":""}>${n?"Uploading\u2026":"Use this frame"}</button>
      </div>
    </div>
  </section>
</div>`}let u=r.find(y=>y.current)||null,g=o?'<div class="pt-note bad">'+f(o)+"</div>":'<div class="pt-note">Art goes through the image API \u2014 it costs no story tokens.</div>';return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait">
    ${v}
    <div class="pt-body gf-swap">
      <div class="pt-main">
        <div class="pt-now">
          ${u?'<img src="'+f(u.url)+'" alt="" loading="lazy">':'<div class="pt-none">No portrait yet</div>'}
          ${u?'<span class="pt-tag">'+(u.source==="upload"?"Your image":"Generated")+"</span>":""}
        </div>
        <div class="pt-editor">
          <div class="pt-field grow">
            <!-- The name is shown because it is always sent: it leads the prompt and cannot be
                 edited. This screen labels its fields as what will be sent, and the name was not
                 among them, so it told half a truth. -->
            <div class="pt-sent"><b>Sent first:</b> <span data-prompt-name>${f(c||"(no name)")}</span>
              <span class="pt-hint">Added automatically, always ahead of the text below.</span></div>
            <div class="pt-label">Appearance<span class="pt-hint">What the image model reads. English only &mdash; a backend rejects the rest.</span></div>
            <textarea class="pt-text" data-appearance spellcheck="false" placeholder="Describe her as the image model should see her.">${f(d.appearance)}</textarea>
          </div>
          <div class="pt-field">
            <div class="pt-label">Tags<span class="pt-hint">Booru tags. These win over the prose when your style profile is tagged.</span></div>
            <div class="pt-tags" data-tags>
              ${h.map(xp).join("")}
              <input class="pt-add" data-tag-add type="text" placeholder="add a tag, Enter" spellcheck="false">
            </div>
          </div>
          <div class="pt-actions">
            <button class="pt-go" type="button" data-generate${n?" disabled":""}>${n?"Painting\u2026":"Paint it again"}</button>
            <button class="pt-alt" type="button" data-upload${n?" disabled":""}>Use my own image\u2026</button>
            <input class="pt-file" type="file" accept="image/png,image/jpeg,image/webp" data-file>
            ${g}
          </div>
        </div>
      </div>
      <div class="pt-past">
        <div class="cap">Earlier</div>
        ${kp(r,s)}
      </div>
    </div>
  </section>
</div>`}function Ti(t,{onBack:e,onDraft:a,onGenerate:r,onPick:s,onFile:n,onCropSize:o,onCropFrame:i,onCropOk:c,onCropCancel:l}={}){let d=R=>t.querySelector(R),h=d("[data-portrait-back]");h&&h.addEventListener("click",()=>e&&e());let v=d("[data-appearance]");v&&v.addEventListener("input",()=>a&&a({appearance:v.value}));let u=d("[data-tag-add]");u&&u.addEventListener("keydown",R=>{if(R.key!=="Enter"&&R.key!==",")return;R.preventDefault();let m=String(u.value||"").trim();m&&(u.value="",a&&a({addTag:m}))});for(let R of t.querySelectorAll("[data-tag-drop]"))R.addEventListener("click",()=>a&&a({dropTag:Number(R.getAttribute("data-tag-drop"))}));let g=d("[data-generate]");g&&g.addEventListener("click",()=>r&&r());for(let R of t.querySelectorAll("[data-pick]"))R.addEventListener("click",()=>s&&s(Number(R.getAttribute("data-pick"))));let y=d("[data-file]"),b=d("[data-upload]");b&&y&&b.addEventListener("click",()=>y.click()),y&&y.addEventListener("change",()=>{let R=y.files&&y.files[0];y.value="",R&&n&&n(R)});let x=d("[data-size]");x&&x.addEventListener("input",()=>o&&o(Number(x.value)/100));let E=d("[data-crop-ok]");E&&E.addEventListener("click",()=>c&&c());let k=d("[data-crop-cancel]");k&&k.addEventListener("click",()=>l&&l());let S=d("[data-frame]"),H=d("[data-shot]");if(S&&H&&i){let R=null;S.addEventListener("pointerdown",L=>{R={x:L.clientX,y:L.clientY},S.classList.add("drag"),S.setPointerCapture&&S.setPointerCapture(L.pointerId),L.preventDefault()}),S.addEventListener("pointermove",L=>{if(!R)return;let W=H.getBoundingClientRect();i({dx:(L.clientX-R.x)/(W.width||1),dy:(L.clientY-R.y)/(W.height||1)}),R={x:L.clientX,y:L.clientY}});let m=()=>{R=null,S.classList.remove("drag")};S.addEventListener("pointerup",m),S.addEventListener("pointercancel",m)}}function Jr(t,e,a,r){let s=t.querySelector("[data-frame]"),n=t.querySelector("[data-crop-img]");if(!s||!n||!e)return;let o=Math.max(1,Number(a)||1),i=Math.max(1,Number(r)||1);s.style.left=e.x/o*100+"%",s.style.top=e.y/i*100+"%",s.style.width=e.w/o*100+"%",s.style.height=e.h/i*100+"%"}var jt={story:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',events:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.4 5.4 5.9.6-4.4 4 1.2 5.8L12 15.9 6.9 18.8l1.2-5.8-4.4-4 5.9-.6z"/></svg>',materials:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',tower:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 21V8l6-5 6 5v13z"/><path d="M10 21v-5h4v5M9 11h6"/></svg>'},_p=[{id:"story",label:"Story",live:!0,blurb:"The main line. Chapters of beats and fights that move the world forward."},{id:"events",label:"Story Events",live:!1,blurb:"Limited-time side stories, tied to the event system."},{id:"materials",label:"Materials",live:!0,blurb:"Farm what levels and ascends your units. Spends stamina; pays in materials."},{id:"tower",label:"Tower",live:!1,wide:!0,blurb:"A monthly climb. Resets, gets harder, pays in materials."},{id:"pvp",label:"PvP",live:!1,blurb:"Your formation against another commander's, resolved by the same sim. No live opponent."}],Ni=`
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
`;function Sp(t,e){let a="";for(let r=0;r<t;r+=1)a+='<i class="'+(r<e?"on":"")+'"></i>';return a}function Ii({story:t=null,modes:e=_p}={}){let a=t||{},r=!!a.hasPlan,s=Number(a.total)||10,n=Math.max(0,Math.min(s,Number(a.done)||0)),o=e.map(d=>{if(d.id==="story"){let h=!!d.live;return'<button class="m hero'+(h?" live":"")+'" type="button"'+(h?' data-mode="story"':" disabled")+'><span class="tag">'+(h?"Open":"Soon")+"</span>"+jt.story+'<span class="hero-top"><span class="kicker">'+(h?f(a.chapterLabel||"Chapter 1"):"Not open yet")+'</span><span class="name">Story</span>'+(h?'<span class="title">'+f(r?a.title||"":"Your world is forged")+'</span><p class="premise">'+f(r?a.blurb||"":"Open the first chapter to start the story.")+"</p>":'<p class="premise">'+f(d.blurb||"")+"</p>")+"</span>"+(h?'<span class="hero-foot"><span class="nodes">'+Sp(s,n)+"<span>"+(r?n+" of "+s+" cleared":"Not started")+'</span></span><span class="cta">'+(n>0?"Continue":"Begin")+"<small>"+f(a.chapterLabel||"Chapter 1")+"</small></span></span>":"")+"</button>"}return d.wide?'<button class="m strip'+(d.live?" live":"")+'" type="button"'+(d.live?' data-mode="'+f(d.id)+'"':" disabled")+">"+(jt[d.id]||jt.events)+'<span class="strip-id"><span class="kicker">'+(d.live?"Ready":"Not open yet")+'</span><span class="name">'+f(d.label)+'</span></span><p class="blurb">'+f(d.blurb)+'</p><span class="tag">'+(d.live?"Open":"Soon")+"</span></button>":'<button class="m'+(d.live?" live":"")+'" type="button"'+(d.live?' data-mode="'+f(d.id)+'"':" disabled")+'><span class="tag">'+(d.live?"Open":"Soon")+"</span>"+(jt[d.id]||jt.events)+'<span class="kicker">'+(d.live?"Ready":"Not open yet")+'</span><span class="name">'+f(d.label)+'</span><p class="blurb">'+f(d.blurb)+"</p></button>"}),i=o[0],c=o.filter((d,h)=>h>0&&!e[h].wide).join(""),l=o.filter((d,h)=>h>0&&e[h].wide).join("");return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="modes">
    <div class="head">
      <button class="back" type="button" data-back-home>&#9664; Home</button>
      <div class="head-id"><div class="eyebrow">Battle</div><h2>Pick a mode</h2></div>
    </div>
    <div class="board"><div class="board-top">${i}<div class="rest">${c}</div></div>${l}</div>
  </section>
</div>`}function Ri(t,{onPick:e,onBack:a}={}){for(let s of t.querySelectorAll("[data-mode]"))s.addEventListener("click",()=>e&&e(s.dataset.mode));let r=t.querySelector("[data-back-home]");r&&r.addEventListener("click",()=>a&&a())}function Zr(t){return(Number(t)||0).toLocaleString("en-US")}var Ut=Jt,Ep='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Mi=`
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
/* THE ART COLUMN. The card was a stack of three text rows; with a picture it becomes two columns
   and the three rows keep their own box, so nothing a picture does can move the CP or the cost. */
.tcard.withart { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: calc(var(--f) * 0.6); }
.tcard .tbody { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: calc(var(--f) * 0.1); }
/* THE PICTURE YIELDS TO THE WORDS. --f does not grow with the type scale but the text does, so
   at 175% the art was stealing the room the name needed: "2 x Warblade Doctrine III" came up 6px
   short in a 250px card. The name is the promise; the art is how you recognise it. */
.tcard .tart { flex: none; width: calc(var(--f) * 3.2 / var(--gf-type-scale, 1)); align-self: center; }
/* aspect-ratio, or the box does not exist until the picture lands: an unloaded lazy <img>
   measures ZERO tall and the card re-flows when it arrives. The art is always square, so
   reserving its box costs nothing and the layout cannot jump. */
.tcard .tart img { width: 100%; height: auto; aspect-ratio: 1; display: block; border-radius: var(--radius-sm); }
.tcard[disabled] .tart { opacity: 0.6; }
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
/* A family row with its face: two columns, like the difficulty card, so the name and what it is
   for keep their own box and the picture cannot shove them. */
.fcard:has(.fart) { flex-direction: row; align-items: center; gap: calc(var(--f) * 0.6); }
.fcard .fbody { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: calc(var(--f) * 0.1); }
.fcard .fart { flex: none; width: calc(var(--f) * 2.6 / var(--gf-type-scale, 1)); }
.fcard .fart img { width: 100%; height: auto; aspect-ratio: 1; display: block; border-radius: var(--radius-sm); }
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
`;function Ci(t){let e=fe(t.id?t.id+":1":"",t.name);return e?'<span class="fart">'+e+"</span>":""}function Aa(t,e,a){let r=Number(t.vigor)>Number(e),s=t.cp===null||t.cp===void 0?null:Number(t.cp),n="";for(let l=1;l<=3;l+=1)n+='<i class="'+(l<=Number(t.difficulty)?"on":"")+'"></i>';let o=l=>Math.round(Number(l)*100)+"%",i=t.odds?'<div class="odds"><span>3&#9733;<b>'+o(t.odds[3])+"</b></span><span>4&#9733;<b>"+o(t.odds[4])+'</b></span><span class="five">5&#9733;<b>'+o(t.odds[5])+"</b></span></div>":"",c=fe(t.itemId,t.material);return'<button class="tcard'+(c?" withart":"")+'" type="button"'+(r?" disabled":"")+" "+a+">"+(c?'<span class="tart">'+c+"</span>":"")+'<div class="tbody"><div class="tl"><span>'+f(t.label)+'</span><span class="rank">'+n+'</span></div><div class="vrow"><span class="v">'+Zr(t.qty)+" <em>&times;</em> "+f(t.material)+"</span>"+i+'</div><div class="foot"><span class="cp'+(s===null?" tbd":"")+'">CP '+(s===null?"&mdash;":Zr(s))+"</span>"+(Number(t.rankXp)>0?'<span class="rxp">+'+Zr(t.rankXp)+" Rank XP</span>":"")+'<span class="cost">'+Ep+"<b>"+Number(t.vigor)+"</b></span></div></div></button>"}var Li={root:"Materials",asc:"Ascension Materials",form:"Tenet Trial"};function Qr(t){return'<div class="head"><button class="back" type="button" data-farm-back>&#9664; '+(t==="root"?"Battle":"Materials")+'</button><div class="head-id"><div class="eyebrow">'+(t==="root"?"Mode":"Materials")+"</div><h2>"+(Li[t]||Li.asc)+"</h2></div></div>"}function es(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="materials">'+t+"</section></div>"}function Oi({view:t="root",data:e=null,state:a="ready"}={}){if(a!=="ready"||!e)return es(Qr(t)+'<div class="body"><div class="board solo"><section class="plate"><div class="p-id"><span class="name">'+(a==="error"?"Unavailable":"Loading&hellip;")+'</span><span class="blurb">'+(a==="error"?"Couldn&rsquo;t read the farm.":"Reading what is open today&hellip;")+"</span></div></section></div></div>");let r=Number(e.vigor)||0,s=Array.isArray(e.days)?e.days:[],n=Number(e.today)||0;if(t==="root"){let v=Array.isArray(e.families)?e.families:[],u=v.slice(0,3),g=Array.isArray(e.formFamilies)?e.formFamilies:[],y=g.slice(0,3),b=Array.isArray(e.locked)?e.locked:[],x=k=>b.includes(k),E='<div class="p-soon">Soon</div>';return es(Qr("root")+'<div class="body"><div class="board"><section class="plate">'+Ut.funds+'<div class="p-id"><div class="kicker">Currency</div><span class="name">Funds</span><button class="p-help" type="button" aria-label="What Funds is">?</button></div><span class="p-tip">The toll every level and every ascension charges.</span>'+(x("funds")?E:'<div class="tcards col">'+(e.stages.funds||[]).map(k=>Aa(k,r,'data-farm-run="funds" data-diff="'+k.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+Ut.xp+'<div class="p-id"><div class="kicker">Levelling</div><span class="name">XP Materials</span><button class="p-help" type="button" aria-label="What XP Materials is">?</button></div><span class="p-tip">Insight, in its three denominations. Feeds any unit.</span>'+(x("xp")?E:'<div class="tcards col">'+(e.stages.xp||[]).map(k=>Aa(k,r,'data-farm-run="xp" data-diff="'+k.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+Ut.relic+'<div class="p-id"><div class="kicker">Gear</div><span class="name">Relic Vault</span><button class="p-help" type="button" aria-label="What Relic Vault is">?</button></div><span class="p-tip">One piece per run, whatever the difficulty. What rises is the rarity.</span>'+(x("relic")?E:'<div class="tcards col">'+(e.stages.relic||[]).map(k=>Aa(k,r,'data-farm-run="relic" data-diff="'+k.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+Ut.form+'<div class="p-id"><div class="kicker">Abilities</div><span class="name">Tenet Trial</span><button class="p-help" type="button" aria-label="What Tenet Trial is">?</button></div><span class="p-tip">Trains a unit&rsquo;s abilities. Tenets by affinity, six families, on rotation.</span>'+(x("form")?E:'<div class="p-open"><div class="k">Open today &middot; '+f((s[n]||{}).day||"")+'</div><div class="fcards">'+y.map((k,S)=>'<button class="fcard" type="button" data-farm-open="form">'+Ci(k)+'<div class="fbody"><span class="n">'+f(k.name)+'</span><span class="m">'+f(k.matches)+"</span>"+(S===y.length-1&&g.length>y.length?'<span class="more">+'+(g.length-y.length)+" more open today</span>":"")+"</div></button>").join("")+'</div><button class="cta" type="button" data-farm-open="form"><span>Open rotation</span><span>&#9654;</span></button></div>')+'</section><section class="plate">'+Ut.asc+'<div class="p-id"><div class="kicker">Ceilings</div><span class="name">Ascension Materials</span><button class="p-help" type="button" aria-label="What Ascension Materials is">?</button></div><span class="p-tip">Sigils by affinity, Doctrines by role. Eleven families, on rotation.</span><div class="p-open"><div class="k">Open today &middot; '+f((s[n]||{}).day||"")+'</div><div class="fcards">'+u.map((k,S)=>'<button class="fcard" type="button" data-farm-open="asc">'+Ci(k)+'<div class="fbody"><span class="n">'+f(k.name)+'</span><span class="m">'+f(k.matches)+"</span>"+(S===u.length-1&&v.length>u.length?'<span class="more">+'+(v.length-u.length)+" more open today</span>":"")+"</div></button>").join("")+'</div><button class="cta" type="button" data-farm-open="asc"><span>Open rotation</span><span>&#9654;</span></button></div></section></div></div>')}let o=t==="form",i=o?"form":"asc",c=Array.isArray(o?e.formFamilies:e.families)?o?e.formFamilies:e.families:[],l=Array.isArray(e.helped)?e.helped:[],d=Array.isArray(e.missed)?e.missed:[],h=c.some(v=>(v.rows||[]).some(u=>Number(u.vigor)>r));return es(Qr(i)+'<div class="detail"><div class="rota"><div class="rota-lab">Rotation</div><div class="rota-days">'+s.map((v,u)=>'<button class="day'+(u===n?" on":"")+(v.all?" all":"")+'" type="button" disabled>'+f(v.day)+"</button>").join("")+'</div></div><div class="rota-note">Sunday opens every family.</div><div class="fams-grid" style="--cols:1">'+c.map(v=>'<article class="fam-card"><div class="fam-id"><span class="n">'+f(v.name)+'</span><span class="m">'+f(v.matches)+'</span></div><div class="tcards row">'+(v.rows||[]).map(u=>Aa(u,r,'data-farm-run="'+i+'" data-diff="'+u.difficulty+'" data-family="'+f(v.id)+'"')).join("")+"</div></article>").join("")+"</div>"+(o?'<div class="band" style="--bcols:1"><div class="bnd-cell"><span class="k">What Tenets buy</span><span class="t">A unit trains with the Tenet of <b>its own affinity</b>, so what is open today decides <b>who</b> you can train.</span></div></div>':'<div class="band" style="--bcols:2"><div class="bnd-cell"><span class="k">Open today helps</span>'+(l.length?'<div class="who">'+l.map(v=>'<span class="u">'+f(v.name)+(v.maxed?"<i>fully ascended</i>":"<i>A"+Number(v.at)+" &rarr; cap "+Number(v.to)+"</i>")+"</span>").join("")+"</div>":'<span class="t">Nothing you own uses today&rsquo;s families. <em>Come back tomorrow, or Sunday.</em></span>')+'</div><div class="bnd-cell"><span class="k">Not today</span>'+(d.length?'<span class="t"><b>'+d.length+"</b> more of your units wait on families that are closed: "+d.map(v=>f(v)).join(", ")+".</span>":'<span class="t">Every unit you own is covered by what is open.</span>')+"</div></div>")+(h?'<div class="band-note">Vigor regenerates one point every '+Math.round((Number(e.vigorPerMs)||18e4)/6e4)+" minutes, up to "+(Number(e.vigorMax)||60)+".</div>":"")+"</div>")}function Bi(t,{onBack:e,onOpen:a,onRun:r}){let s=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);s.length||s.push(t);let n=o=>{let i=o&&o.target&&o.target.closest?o.target:null;if(!i)return;if(i.closest("[data-farm-back]")){e&&e();return}let c=i.closest("[data-farm-open]");if(c){a&&a(c.getAttribute("data-farm-open")||"asc");return}let l=i.closest("[data-farm-run]");l&&!l.disabled&&r&&r({stage:l.getAttribute("data-farm-run"),difficulty:Number(l.getAttribute("data-diff"))||0,family:l.getAttribute("data-family")||""})};for(let o of s)o.addEventListener("click",n)}function ts(t){return(Number(t)||0).toLocaleString("en-US")}function Ap(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var kt=`
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

`;function _t(t,{gained:e=[],actions:a=!0,projection:r=null}={}){if(!t)return'<aside class="detail"><div class="d-none">Pick a piece to see its four sub-stats, what it gives now and what it gives at its cap.</div></aside>';let s=Number(t.rarity)||3,n=new Set((e||[]).map(u=>String(u.key))),o=t.main||null,i=Number(t.levelCap)||0,c=Number(t.level)||0,l=c>=i,d=Array.isArray(t.subs)?t.subs:[],h=Math.max(0,Number(t.subsPending)||0),v=Number(t.nextSubAt)||0;return'<aside class="detail r'+s+'"><div class="d-head"><span class="d-art">'+Pt(t.slot)+'</span><span class="d-id"><span class="n">'+f(Ht(t.slot))+'</span><span class="m"><em>'+Ap(s)+"</em> &middot; Lv "+c+" / "+i+"</span></span></div>"+(o?'<div class="d-main"><span class="k">'+f(o.label||o.key)+'</span><span class="v">'+ve(o.key,o.value)+'</span><span class="m">'+(Number(o.valueMax)>Number(o.value)?"&rarr; "+ve(o.key,o.valueMax)+" at cap":"at cap")+"</span></div>":"")+'<div class="d-subs"><span class="h">Sub-stats &middot; '+(h>0?d.length+" of "+(d.length+h):String(d.length))+"</span>"+d.map(u=>'<div class="d-sub'+(n.has(String(u.key))?" grew":"")+'"><span class="k">'+f(u.label||u.key)+'</span><span class="v">'+ve(u.key,u.value)+"</span></div>").join("")+(h>0?'<div class="d-sub locked"><span class="k">Locked</span><span class="v">'+(v?"Lv "+v:"&mdash;")+"</span></div>":"")+'</div><div class="d-worn">'+(t.wornBy?"Worn by <b>"+f(t.wornBy)+"</b>":"Not equipped")+"</div>"+(r?'<div class="d-proj"><span class="big">Lv '+r.from+" &rarr; "+r.to+"</span><span>Eats <b>"+r.picked+"</b> "+(r.picked===1?"piece":"pieces")+" and <b>"+ts(r.funds)+"</b> Funds"+(r.short?' &mdash; <span class="short">you hold '+ts(r.have)+"</span>":"")+".</span><span>"+(r.ticks?"Reinforces <b>"+r.ticks+"</b> sub-stat"+(r.ticks===1?"":"s")+", picked at random.":"No sub-stat is reinforced yet &mdash; the next one lands at <b>Lv "+r.nextTick+"</b>.")+"</span></div>":"")+(a&&r?'<div class="d-acts"><button type="button" data-inv-feed-go'+(!r.picked||r.short?" disabled":"")+'>Feed</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></div>':a?'<div class="d-acts"><button type="button" data-inv-upgrade="'+f(t.id)+'"'+(l?" disabled":"")+">"+(l?"At its cap":"Upgrade")+'</button><button class="ghost" type="button" data-inv-lock="'+f(t.id)+'">'+(t.locked?"Unlock":"Lock")+'</button></div><div class="d-cost">'+(l?"Fully reinforced &mdash; <b>"+d.length+"</b> sub-stats at their rolled ceiling.":"One level eats <b>1</b> spare relic and <b>"+ts(t.feedCost)+"</b> Funds. A sub is reinforced every <b>"+(Number(t.tickEvery)||3)+"</b> levels.")+"</div>":"")+"</aside>"}var St=`
.grid-wrap { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: calc(var(--f) * 0.3); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 7.2), 1fr)); gap: calc(var(--f) * 0.5); align-content: start; }
.tile { min-width: 0; cursor: pointer; text-align: left; font-family: var(--display); position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.15); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.4); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark); color: var(--text); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease); }
.tile:hover { transform: translateY(-1px); border-color: var(--coral); }
.tile[aria-pressed="true"] { border-top-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 10%); }
.tile .art { width: 52%; max-width: calc(var(--f) * 2.6); color: var(--steel); opacity: 0.85; }
.tile .art svg { width: 100%; height: auto; display: block; }
.tile .st { font-size: var(--t-tiny); letter-spacing: 0.08em; color: var(--amber); line-height: 1; }
.tile .fig { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-sm); letter-spacing: var(--track); color: var(--text); }
.tile .lv { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.grid-empty { grid-column: 1 / -1; font-family: var(--display); font-size: var(--t-xs); line-height: 1.5; color: var(--steel-faint); padding: var(--sp-2); }
.grid-empty b { color: var(--text); }

/* An ITEM tile: the packaged picture is the point, so it gets more room than a glyph needs. */
.tile.item { cursor: default; }
.tile.item:hover { transform: none; border-color: var(--ink-3); }
.tile.item.has { border-top-color: var(--amber); }
.tile.item.none { opacity: 0.42; }
.tile.item .art { width: 82%; max-width: calc(var(--f) * 6); opacity: 1; }
/* An item is looked up BY NAME, so it wraps instead of clipping: in the Shop the ellipsis ate the
   very word that tells one flask from another. */
.tile.item .lv { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; text-align: center; line-height: 1.25; }
/* aspect-ratio, or the box does not exist until the picture lands: an unloaded lazy <img>
   measures ZERO tall and the card re-flows when it arrives. The art is always square, so
   reserving its box costs nothing and the layout cannot jump. */
.tile .art img.item-art { width: 100%; height: auto; aspect-ratio: 1; display: block; border-radius: var(--radius-sm); }
/* Two states the Shop cannot confuse: a closed door and a price you cannot pay yet. */
.tile.item.off { opacity: 0.5; border-top-color: var(--steel-dark); }
.tile.item.short { opacity: 0.72; }
/* EVERY ROW HAS A RESERVED HEIGHT, so a two-line effect or a two-line name cannot push what is
   under it. Measured before this: the Buy buttons landed 31px apart and the names 13px apart,
   because "Reroll a relic's substats" wraps and "+20 Vigor" does not. A grid of tiles is read as
   a grid, so a row that only lines up when the text happens to be short is not lined up. */
.tile.item .st { line-height: 1.25; min-height: calc(2.5em); display: flex; align-items: center; justify-content: center; text-align: center; }
.tile.item .lv { min-height: calc(2.5em); display: flex; align-items: center; justify-content: center; }
/* The action is pinned to the BOTTOM of the tile, never to the end of the text above it, and its
   box has a FIXED height: a Buy button is 27px and a "not open yet" line is 14px, so aligning
   only their bottoms left their tops 8px apart -- read as crooked in a row of five. */
.tile.item .act { margin-top: auto; padding-top: calc(var(--f) * 0.25); }
.tile.item .act { min-height: calc(var(--f) * 2.4); display: flex; align-items: center; justify-content: center; text-align: center; }

/* The board's group headings. A label and nothing else: a subtitle here narrates what the tiles
   already show. */
.item-board { display: flex; flex-direction: column; gap: calc(var(--f) * 0.25); }
.item-board .grid { grid-template-columns: repeat(auto-fill, minmax(calc(var(--f) * 10), 1fr)); }
.mhead { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); padding: calc(var(--f) * 0.5) 0 calc(var(--f) * 0.25); position: sticky; top: 0; background: var(--ground-2); z-index: 1; }
`;function Tp(t){let e=String(t??"").trim().split(/\s+/).filter(Boolean);return e.length<2?f(e[0]||""):f(e.slice(0,-1).join(" "))+"<br>"+f(e[e.length-1])}function as(t){return'<div class="mhead">'+f(t)+"</div>"}function Ue({id:t,name:e,tag:a="",fig:r="",label:s="",note:n="",held:o=!1,action:i="",extra:c=""}){let l=a?e+" "+a:e;return'<div class="tile item'+(o?" has":" none")+(c?" "+c:"")+'" title="'+f(l+(n?" - "+n:""))+'"><span class="art">'+(fe(t,l)||Q("asc"))+"</span>"+(a?'<span class="st">'+f(a)+"</span>":"")+(r?'<span class="fig">'+f(String(r))+"</span>":"")+(s?'<span class="lv">'+Tp(s)+"</span>":"")+(i?'<span class="act">'+i+"</span>":"")+"</div>"}function Et(t){return(Number(t)||0).toLocaleString("en-US")}function zi(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var rs=[{key:"relics",label:"Relics",kicker:"Gear",live:!0,count:"relics",blurb:"Every piece you hold, worn or spare."},{key:"materials",label:"Materials",kicker:"Stock",live:!0,count:"materials",blurb:"Insight, ascension families and your currencies."},{key:"keyitems",label:"Key Items",kicker:"Bag",live:!0,count:"keyItems",blurb:"What you bought and have not spent yet."}],Hi=kt+St+`
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
/* A contained scroll is allowed by the rule; the SCREEN still does not scroll. */

/* \u2500\u2500 One relic tile. Cards, not rows: at row height a glyph is a smudge. \u2500\u2500\u2500 */
/* --amber and --epic are the SAME tokens Formation paints five and four stars with. An invented
   token does not fail: it falls to the fallback silently and the tiers stop reading apart. */
.tile.r5 { border-top-color: var(--amber); }
.tile.r4 { border-top-color: var(--epic); }
.tile.r5 .art { color: var(--amber); opacity: 1; }
.tile.r4 .art { color: color-mix(in srgb, var(--epic) 65%, var(--steel)); opacity: 1; }
/* Worn and locked are the two states that change what the player may DO with a piece, so they are
   on the tile and not only in the detail: otherwise picking food means opening every one. */
.tile .flags { position: absolute; top: calc(var(--f) * 0.25); right: calc(var(--f) * 0.3); display: flex; gap: calc(var(--f) * 0.2); font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); }
.tile .flags .worn { color: var(--jade); }
.tile .flags .lock { color: var(--amber); }

/* \u2500\u2500 Materials \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* THE MATERIALS BOARD reuses .grid-wrap / .grid / .tile from the relics pane -- the tile language
   this screen already had. Only what a PICTURE needs is new. */
/* A material tile is not a control: no pointer, no lift, no press state. */
/* The packaged picture sits where the relic glyph sits, so both panes keep the same rhythm. */
/* The picture is the point of this board, so it gets the room the relic glyph did not need:
   measured, the art was landing at 35px inside a 76px tile and an icon that small is a smudge. */
/* Wider columns than the relic grid for the same reason -- eleven columns of picture is none. */

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
.ki-use { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.4em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.ki-use:hover { background: var(--coral-deep); border-color: var(--coral-deep); }

`;function Di(t,e){return t.id===e?"itself":t.wornBy?"worn":t.locked?"locked":""}function Np(t,e,a){let r=Number(t.rarity)||3,s=t.id===e,n=(t.wornBy?'<span class="worn" title="Worn">&#9679;</span>':"")+(t.locked?'<span class="lock">&#128274;</span>':"");if(a){let o=Di(t,a.targetId),i=t.id===a.targetId,c=a.picked.indexOf(t.id)>=0,l=!c&&a.picked.length>=a.room,d=!!o||l;return'<button class="tile r'+r+(c?" food":"")+(i?" target":"")+'" type="button"'+(d?" disabled":"")+' title="'+(i?"The piece being fed":o==="worn"?"Worn by "+f(t.wornBy):o==="locked"?"Locked":l?"Already at its cap with what is picked":"Feed this")+'"'+(d?"":' data-inv-feed-pick="'+f(t.id)+'"')+">"+(n?'<span class="flags">'+n+"</span>":"")+'<span class="art">'+Pt(t.slot)+'</span><span class="st">'+zi(r)+'</span><span class="fig">'+(t.main?ve(t.main.key,t.main.value):"&mdash;")+'</span><span class="lv">'+(i?"Feeding this":c?"Picked":f(Ht(t.slot)))+"</span></button>"}return'<button class="tile r'+r+'" type="button" aria-pressed="'+(s?"true":"false")+'" data-inv-pick="'+f(t.id)+'">'+(n?'<span class="flags">'+n+"</span>":"")+'<span class="art">'+Pt(t.slot)+'</span><span class="st">'+zi(r)+'</span><span class="fig">'+(t.main?ve(t.main.key,t.main.value):"&mdash;")+'</span><span class="lv">'+f(Ht(t.slot))+" &middot; Lv "+(Number(t.level)||0)+"</span></button>"}function Ip(t,e,a){let r=Number(t.levelCap)||0,s=Number(t.level)||0,n=Math.max(0,r-s),o=Math.min(e.length,n),i=s+o,c=(Number(t.feedCost)||0)*o,l=Number(t.tickEvery)||3;return{from:s,to:i,room:n,picked:o,funds:c,have:Number(a)||0,short:c>(Number(a)||0),ticks:jr(t.rarity,i)-jr(t.rarity,s),nextTick:(Math.floor(s/l)+1)*l}}function Rp(t,e){let a=Array.isArray(t.relics)?t.relics:[],r=e.slot||"all",s=e.rarity||"all",n=a.filter(b=>(r==="all"||b.slot===r)&&(s==="all"||String(b.rarity)===String(s))),o=e.feeding&&e.feeding.targetId?{targetId:e.feeding.targetId,picked:Array.isArray(e.feeding.picked)?e.feeding.picked:[]}:null,i=o&&a.find(b=>b.id===o.targetId)||null,c=i?Math.max(0,(Number(i.levelCap)||0)-(Number(i.level)||0)):0,l=i?{targetId:i.id,picked:o.picked.slice(0,c),room:c}:null,d=i||n.find(b=>b.id===e.picked)||n[0]||null,h=i?Ip(i,l.picked,t.wallet&&t.wallet.funds):null,v=[["all","All"],["core","Core"],["edge","Edge"],["flow","Flow"],["crest","Crest"]],u=[["all","All"],["5","5&#9733;"],["4","4&#9733;"],["3","3&#9733;"]],g=(b,x,E)=>x.map(([k,S])=>'<button class="chip" type="button" aria-pressed="'+(String(k)===String(E)?"true":"false")+'" data-inv-filter="'+b+'" data-value="'+k+'">'+S+"</button>").join(""),y=a.filter(b=>!Di(b,l?l.targetId:"")).length;return(l?'<div class="feedbar">Pick what to feed &mdash; each piece is <b>1</b> level and <b>'+Et(i?i.feedCost:0)+"</b> Funds. Room for <b>"+(h.room-h.picked)+"</b> more, <b>"+y+'</b> spare in your stock.<span class="sp"><button type="button" data-inv-feed-go'+(!h.picked||h.short?" disabled":"")+">Feed "+h.picked+'</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></span></div>':"")+'<div class="tools"><span class="fgroup"><span class="lbl">Slot</span>'+g("slot",v,r)+'</span><span class="fgroup"><span class="lbl">Rarity</span>'+g("rarity",u,s)+'</span><span class="tally">'+n.length+" of "+a.length+' shown</span></div><div class="split"><div class="grid-wrap"><div class="grid">'+(n.length?n.map(b=>Np(b,d?d.id:"",l)).join(""):'<div class="grid-empty">'+(a.length?"Nothing matches this filter.":"You hold no relics yet &mdash; they drop from the <b>Relic Vault</b> stage in Materials, one piece per run.")+"</div>")+"</div></div>"+_t(d,{gained:e.gained||[],projection:h})+"</div>"}var Cp=(t,e)=>{let a=String(t||"").replace(/^[a-z]/,r=>r.toUpperCase());return e?a+"s":a};function Lp(t){let e=t.materials||{},a=Array.isArray(e.insight)?e.insight:[],r=Array.isArray(e.families)?e.families:[],s=[],n=new Map;for(let i of r){let c=String(i.id||"").split(":")[0]||"other";if(!n.has(c)){let l={key:c,fams:[]};n.set(c,l),s.push(l)}n.get(c).fams.push(i)}let o=[];a.length&&(o.push(as("Insight")),o.push('<div class="grid">'+a.map(i=>Ue({id:i.id,name:i.name,fig:Et(i.qty),label:i.name,note:Et(i.xp)+" XP",held:Number(i.qty)>0})).join("")+"</div>"));for(let i of s){o.push(as(Cp(i.key,i.fams.length>1)));let c=[];for(let l of i.fams)(Array.isArray(l.tiers)?l.tiers:[]).forEach((h,v)=>{c.push(Ue({id:l.id+":"+(v+1),name:l.name,tag:h.tier,fig:Et(h.qty),label:l.name,note:l.matches,held:Number(h.qty)>0}))});o.push('<div class="grid">'+c.join("")+"</div>")}return o.length?'<div class="grid-wrap item-board">'+o.join("")+"</div>":'<div class="grid-empty">You hold no materials yet &mdash; they drop from the stages in <b>Materials</b>.</div>'}function Mp(t){let e=t&&t.keyItems||{},a=ea.filter(r=>Number(e[r.id])>0);return a.length?'<div class="grid-wrap item-board"><div class="grid">'+a.map(r=>Ue({id:r.id,name:r.name,tag:Qt(r),fig:Et(Number(e[r.id])||0),label:r.name,held:!0,action:'<button class="ki-use" type="button" data-inv-use="'+f(r.id)+'">Use</button>'})).join("")+"</div></div>":'<div class="grid-empty">Nothing in the bag &mdash; Vigor items are sold in the <b>Shop</b>.</div>'}function Fi(t){return'<div class="head"><button class="back" type="button" data-inv-back>&#9664; Home</button><div class="head-id"><div class="eyebrow">Your world</div><h2>'+f(t)+"</h2></div></div>"}function Pi(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="inventory">'+t+"</section></div>"}function qi({section:t="relics",data:e=null,view:a={},state:r="ready"}={}){if(r!=="ready"||!e)return Pi(Fi("Inventory")+'<div class="body"><div class="cols"><div class="pane"><div class="grid-empty">'+(r==="error"?"Couldn&rsquo;t read your inventory.":"Reading what you hold&hellip;")+"</div></div></div></div>");let s=e.counts||{},n=rs.filter(d=>d.live),o=n.find(d=>d.key===t)||n[0]||rs[0],i=e.relicBand||{},c=e.materials&&e.materials.ascension||{},l='<div class="rail">'+rs.map(d=>'<button class="sect" type="button"'+(d.live?' aria-pressed="'+(d.key===o.key?"true":"false")+'" data-inv-section="'+d.key+'"':" disabled")+'><span class="k">'+f(d.kicker)+'</span><span class="n">'+f(d.label)+"<i>"+(d.live?Et(s[d.count]):"&mdash;")+"</i></span>"+(d.live?"":'<span class="soon">Not open yet</span>')+"</button>").join("")+"</div>";return Pi(Fi("Inventory")+'<div class="body"><div class="cols">'+l+'<div class="pane">'+(o.key==="relics"?Rp(e,a):o.key==="keyitems"?Mp(e):Lp(e))+"</div></div></div>")}function $i(t,{onBack:e,onSection:a,onFilter:r,onPick:s,onLock:n,onUpgrade:o,onFeedPick:i,onFeedGo:c,onFeedCancel:l,onUseItem:d}){let h=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);h.length||h.push(t);let v=u=>{let g=u&&u.target&&u.target.closest?u.target:null;if(!g)return;if(g.closest("[data-inv-feed-go]")){!g.closest("[data-inv-feed-go]").disabled&&c&&c();return}if(g.closest("[data-inv-feed-cancel]")){l&&l();return}let y=g.closest("[data-inv-feed-pick]");if(y){!y.disabled&&i&&i(y.getAttribute("data-inv-feed-pick"));return}if(g.closest("[data-inv-back]")){e&&e();return}let b=g.closest("[data-inv-section]");if(b){a&&a(b.getAttribute("data-inv-section"));return}let x=g.closest("[data-inv-use]");if(x){d&&d(x.getAttribute("data-inv-use"));return}let E=g.closest("[data-inv-filter]");if(E){r&&r(E.getAttribute("data-inv-filter"),E.getAttribute("data-value"));return}let k=g.closest("[data-inv-lock]");if(k){n&&n(k.getAttribute("data-inv-lock"));return}let S=g.closest("[data-inv-upgrade]");if(S&&!S.disabled){o&&o(S.getAttribute("data-inv-upgrade"));return}let H=g.closest("[data-inv-pick]");H&&s&&s(H.getAttribute("data-inv-pick"))};for(let u of h)u.addEventListener("click",v)}function We(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function we(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var Wi=`
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
.ev-pane .ev-day img.item-art { width: 46%; max-width: calc(var(--f) * 9); }
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
/* The packaged picture takes the glyph's slot. aspect-ratio, or an unloaded lazy img measures
   ZERO tall and the rung re-flows when the picture lands. */
.ev-day img.item-art { width: 42%; max-width: calc(var(--f) * 2.6); height: auto; aspect-ratio: 1; display: block; flex: none; border-radius: var(--radius-sm); }
.ev-day .amt { font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* The NAME of what a day pays: a glyph with a number does not say what you receive (user rule). And
   it WRAPS, never truncates -- a line clamp lies as soon as text scales. */
/* line-height 1.3, not 1.2: tighter than the font box the span overflows ITSELF by 1px and every
   clip check fires on text nothing is cutting. Measured at 175%: scrollHeight 34, client 33. */
.ev-day .what { font-family: var(--body); font-size: var(--t-xs); line-height: 1.3; color: var(--text); text-wrap: balance; }

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
.ev-day.done img.item-art { opacity: 0.4; }
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
/* GRABBABLE: the ladder is dragged with the pointer instead of hunting for the scrollbar (user
   request). Touch keeps the browser's own scrolling, which already has momentum. */
.pv-track { flex: 0 0 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; padding-bottom: calc(var(--f) * 0.3); cursor: grab; }
.pv-track.-drag { cursor: grabbing; user-select: none; }
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
/* The packaged picture takes the glyph's SLOT, cap included: the card is 13f wide and does not
   grow with the type scale, so anything bigger would be room taken from the name. */
.pv-lvl img.item-art { width: 44%; max-width: calc(var(--f) * 4.6); height: auto; aspect-ratio: 1; display: block; flex: none; border-radius: var(--radius-sm); }
.pv-lvl .amt { font-family: var(--display); font-size: var(--t-md); color: var(--text); font-variant-numeric: tabular-nums; }
/* line-height 1.3, not 1.15: tighter than the font box the span overflows itself by 2px and every
   clip check fires. A long name WRAPS. */
/* TWO LINES RESERVED: at 175% nine of the eighty names wrap ("Warblade Doctrine I") and a
   centred card grew upwards, so the pictures beside them sat 11px higher. */
.pv-lvl .what { font-family: var(--body); font-size: var(--t-xs); line-height: 1.3; min-height: 2.6em; display: flex; align-items: center; justify-content: center; color: var(--text); overflow-wrap: anywhere; }
/* Aether comes with every level: a small figure, not a word repeated thirty times. */
/* OUT OF FLOW, a corner chip like the tick, and that is what straightens the rail: only one
   level in five pays a batch, and in flow that missing child lifted its neighbours 10px. */
/* AND IT WEARS A PLATE, or it belongs to the wrong card: bare, the chip sat 5px from the NEXT
   rung tick and the two read as one pair. */
.pv-lvl .ae { position: absolute; top: calc(var(--f) * 0.15); left: calc(var(--f) * 0.2); padding: 0 calc(var(--f) * 0.28); background: color-mix(in srgb, var(--amber) 18%, var(--ink)); border-radius: var(--radius-sm); font-family: var(--display); font-size: var(--t-tiny); line-height: 1.4; color: var(--amber); font-variant-numeric: tabular-nums; }
.pv-lvl.prize { border-top-color: var(--amber); }
.pv-lvl.prize .glyph { color: var(--amber); }
/* Claimable is the only coral: the accent marks the actionable, not decoration. */
.pv-lvl.ready { border-color: var(--coral); border-top-color: var(--coral); background: color-mix(in srgb, var(--coral) 12%, var(--ink-2)); }
.pv-lvl.ready .glyph { color: var(--coral); }
/* Claimed: loses its edge and sinks, like a claimed login rung. Darker alone does not read; the
   theme's inks are near black. */
.pv-lvl.done { background: var(--ink); border-color: transparent; box-shadow: inset 0 calc(var(--f) * 0.12) calc(var(--f) * 0.5) rgba(0,0,0,0.55); }
.pv-lvl.done .glyph { color: var(--steel-dark); }
.pv-lvl.done img.item-art { opacity: 0.4; }
.pv-lvl.done .amt, .pv-lvl.done .what { color: var(--steel-faint); }
/* steel-FAINT, like the figure and the name beside it: on steel-dark the claimed batch measured
   1.46:1 against its own card while its siblings read at 6.35 -- sunken, not erased. */
.pv-lvl.done .ae { color: var(--steel-faint); background: color-mix(in srgb, var(--steel-dark) 22%, var(--ink)); }
/* An unreached level does not dim with opacity, the forbidden transparency: it loses its top edge.
   Hierarchy by shape. */
.pv-lvl.off { border-top-color: var(--ink-3); }
.pv-lvl.off .glyph { color: var(--steel-dark); }
/* A picture has no stroke to send to steel-dark, so the art is what dims; the CARD keeps its own
   hierarchy by shape. */
.pv-lvl.off img.item-art { opacity: 0.5; }
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
`,Op=`
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
`,Gi=Wi,Vi=`
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
/* IT TRUNCATES, and that is what lets a kicker carry a NAME. At 0.2em of tracking this is built for
   a short label, and the resume pop-up puts the scene's own title here: measured on real worlds, the
   longest is 36 characters, twice the ink of a four-word phrase. The other pop-ups never reach the
   edge, so for them this rule is a no-op. */
.rl-eyebrow { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--amber); }
/* gap and a SECOND button: a pop-up that asks something has two answers, and until now every one
   of them only had to be acknowledged. With one button the gap is a no-op, so the popups that
   already exist do not move. */
.rl-foot { flex: none; display: flex; justify-content: flex-end; gap: var(--sp-2); }
/* The other answer, and it reads as the quieter one: the same shape and the same height as .rl-ok
   so the pair cannot look like a button beside a link, in the outline treatment the house already
   uses for a secondary act. */
.rl-alt { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--gf-f) * 0.5) var(--sp-3); background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); --cut: 0.6em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.rl-alt:hover { border-color: var(--steel); color: var(--text); }
/* One line of body copy for a pop-up that is a QUESTION, not a prize: the prize ones bring their
   own card. */
.rl-say { font-size: var(--t-sm); line-height: 1.5; color: var(--text); }
.rl-ok { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--gf-f) * 0.5) var(--sp-3); background: var(--coral); border: 0; color: var(--on-coral); --cut: 0.6em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
`,Yi=`
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

`+Wi+nn+Op+un+wn+En;function Bp(t,e,a){let r=t.day<=e,s=!r&&t.day===e+1;return'<div class="ev-slot"><div class="'+["ev-day",t.prize?"prize":"",r?"done":"",s&&a?"next":""].filter(Boolean).join(" ")+'">'+(fe(t.extra.itemId,t.extra.name)||Q(t.extra.kind))+'<span class="amt">'+We(t.extra.qty)+'</span><span class="what">'+t.extra.name+"</span>"+(r?'<span class="tick">&#10003;</span>':"")+'</div><span class="ev-n">Day '+t.day+"</span></div>"}function ss(t,e,a){return'<div class="ev-week">'+t.map(r=>Bp(r,e,a)).join("")+"</div>"}function Ki(t,e,a,r){let s=Number(t[0]&&t[0].aether)||0,n=Number(e),o=Number.isFinite(n)?n<=0?"Resets tonight":"Resets in <b>"+n+"</b>"+(n===1?" day":" days"):"";return'<div class="ev-top">'+(a?'<h3 class="ev-title">'+we(a)+"</h3>":"")+'<span class="ev-every">'+Q("aether")+"<b>"+We(s)+'</b><span>Aether daily</span></span><span class="ev-when">'+o+"</span>"+(r||"")+"</div>"}function Ta(t){return!Array.isArray(t)||!t.length?"":'<span class="ev-gained"><span class="k">Claimed</span>'+t.map(e=>'<span class="it">'+Q(e.kind)+"<b>"+We(e.qty)+"</b> "+we(e.material)+"</span>").join("")+"</span>"}function Xi(t){return t?'<div class="rl-modal" role="dialog" aria-modal="true" aria-label="Relic won"><div class="rl-veil"></div><div class="rl-panel"><div class="rl-top"><div class="rl-eyebrow">You obtained a Relic</div></div>'+_t(t,{actions:!1})+'<div class="rl-foot"><button class="rl-ok" type="button" data-relic-ok>Accept</button></div></div></div>':""}function Ji(t,{onClose:e}={}){let a=t&&t.querySelector("[data-relic-ok]");a&&e&&a.addEventListener("click",()=>e())}function Zi(t,e){let a=t?"Claim":e?"All claimed":"Claimed today";return'<button class="ev-claim" type="button" data-events-claim'+(t?"":" disabled")+">"+a+"</button>"}function Qi(t){let e=t||{},a=Array.isArray(e.rungs)?e.rungs:[],r=Math.max(0,Number(e.claimed)||0);return{rungs:a,claimed:r,ready:!!e.ready,full:a.length>0&&r>=a.length,resetsIn:e.resetsIn,gained:Array.isArray(e.gained)?e.gained:[]}}function zp(t){let e=Math.max(0,Math.round(Number(t)||0)),a=Math.floor(e/864e5),r=Math.floor(e%864e5/36e5);if(a>0)return a+"d "+r+"h";let s=Math.floor(e%36e5/6e4);return r>0?r+"h "+s+"m":s+"m"}function Fp(t){let e=t&&typeof t=="object"?t:{},a=r=>({...r&&typeof r=="object"?r:{},xp:Math.max(0,Number(r&&r.xp)||0),missions:Array.isArray(r&&r.missions)?r.missions:[]});return{...e,seq:Math.max(1,Math.round(Number(e.seq)||1)),level:Math.max(0,Math.round(Number(e.level)||0)),max:Math.max(1,Math.round(Number(e.max)||1)),xpInto:Math.max(0,Number(e.xpInto)||0),xpPerLevel:Math.max(1,Number(e.xpPerLevel)||1),endsInMs:Number(e.endsInMs)||0,rewards:Array.isArray(e.rewards)?e.rewards:[],claimable:Array.isArray(e.claimable)?e.claimable:[],rerollsLeft:Math.max(0,Math.round(Number(e.rerollsLeft)||0)),daily:a(e.daily),weekly:a(e.weekly),season:a(e.season),gained:Array.isArray(e.gained)?e.gained:[]}}function Pp(t,e){let a=t.level>e;return'<div class="pv-slot"><div class="'+["pv-lvl",t.prize?"prize":"",t.claimed?"done":"",a?"off":"",!a&&!t.claimed?"ready":""].filter(Boolean).join(" ")+'">'+(fe(t.extra.itemId,t.extra.name)||Q(t.extra.kind))+'<span class="amt">'+We(t.extra.qty)+'</span><span class="what">'+t.extra.name+"</span>"+(t.aether>0?'<span class="ae">+'+We(t.aether)+"</span>":"")+(t.claimed?'<span class="tick">&#10003;</span>':"")+'</div><span class="pv-n">'+t.level+"</span></div>"}function Hp(t){let e=Math.max(0,Math.round(Number(t)||0));if(!e)return"";let a=Math.floor(e/36e5);return a>=24?Math.floor(a/24)+"d "+a%24+"h":a>=1?a+"h":Math.max(1,Math.round(e/6e4))+"m"}function Dp(t,e){let a=s=>s.missions.filter(n=>n.paid||n.done>=n.need).length,r=(s,n,o)=>{let i=Hp(o.resetsInMs);return'<button class="pv-tab" type="button" data-pass-tab="'+s+'" aria-pressed="'+(s===e)+'"><span class="k">'+n+'</span><span class="ct">'+a(o)+"/"+o.missions.length+"</span>"+(i?'<span class="rs">'+i+"</span>":"")+"</button>"};return r("daily","Daily",t.daily)+r("weekly","Weekly",t.weekly)+r("season","Season",t.season)}function qp(t){let e=t.missions.length<=4,a=t.missions.map(r=>{let s=Math.max(1,Number(r.need)||1),n=Math.min(s,Math.max(0,Number(r.done)||0));return'<li class="pv-m'+(!!r.paid||n>=s?" done":"")+'" data-mission="'+we(r.id)+'"><span class="xp">+'+t.xp+' XP</span><span class="tx">'+$s(r)+'</span><span class="ct"><b>'+n+"</b>/"+s+'</span><span class="bar"><i style="width:'+Math.round(n/s*100)+'%"></i></span></li>'}).join("");return'<ul class="pv-list'+(e?" few":"")+'">'+(a||'<li class="pv-m empty"><span class="tx">Nothing here</span></li>')+"</ul>"}function $p(t,e,a){let r=Fp(t),s=Math.max(0,Math.min(100,Math.round(r.xpInto/r.xpPerLevel*100))),n=r.level>=r.max,o=r.claimable.length?"Claim "+r.claimable.length:n?"All claimed":"Nothing to claim",i='<button class="pv-reroll" type="button" data-pass-reroll'+(r.rerollsLeft>0?"":" disabled")+">Reroll "+r.rerollsLeft+"</button>",c=r[a]?a:"daily";return'<div class="ev-pane pv"><div class="ev-top"><h3 class="ev-title">'+we(e)+'</h3><span class="pv-season">Season <b>'+r.seq+'</b></span><span class="pv-lv">Lv <b>'+r.level+"</b>/"+r.max+'</span><span class="pv-xp"><span class="bar"><i style="width:'+s+'%"></i></span><b>'+We(r.xpInto)+"</b>/"+We(r.xpPerLevel)+' XP</span><span class="ev-when">Ends in <b>'+zp(r.endsInMs)+'</b></span></div><div class="pv-track"><div class="pv-rail">'+r.rewards.map(l=>Pp(l,r.level)).join("")+'</div></div><div class="pv-missions"><div class="pv-tabs">'+Dp(r,c)+(c==="daily"?i:"")+"</div>"+qp(r[c])+'</div><div class="ev-foot">'+Ta(r.gained)+'<button class="ev-claim" type="button" data-pass-claim'+(r.claimable.length?"":" disabled")+">"+o+"</button></div></div>"}var ji={login:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8.5 14.5l2 2 4-4"/></svg>',seasonal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/></svg>'},Ui=t=>ji[String(t)]||ji.seasonal;function jp(t,e,a){let r=we(t.id);return t.live===!1?'<button class="ev-card" type="button" aria-disabled="true" data-event="'+r+'"><span class="ic">'+Ui(t.kind)+'</span><span class="ev-card-id"><b>'+we(t.label)+"</b><i>"+we(t.note||"Not open yet")+"</i></span></button>":'<button class="ev-card" type="button" data-event="'+r+'" aria-pressed="'+(t.id===e)+'"><span class="ic">'+Ui(t.kind)+'</span><span class="ev-card-id"><b>'+we(t.label)+"</b><i>"+we(t.note||"")+"</i></span>"+(a?'<span class="dot"></span>':"")+"</button>"}function Up(t,e){let a=t&&typeof t=="object"?t:{},r=Array.isArray(a.rungs)?a.rungs:[],s=Math.max(0,Math.round(Number(a.claimed)||0)),n=r.length||Number(a.days)||0,o=!!a.ready,i=typeof a.art=="string"&&!!a.art.trim(),c=Number(a.perDay)||Number(r[0]&&r[0].aether)||0;return'<div class="ev-pane nw'+(i?"":" flat")+'"'+(i?' style="background-image:url('+we(a.art)+')"':"")+'><div class="nw-scrim"></div><div class="nw-hero"><div class="nw-id"><span class="kick">Welcome</span><h3>'+we(e||"Journey to a New World")+'</h3></div><div class="nw-figs"><span class="fig">'+Q("aether")+"<b>"+We(c)+'</b><span>a day</span></span><span class="fig dim"><b>'+Math.max(0,n-s)+"</b> of <b>"+n+'</b> left</span></div></div><div class="nw-track">'+ss(r,s,o)+'<div class="ev-foot">'+Ta(a.gained)+'<button class="ev-claim" type="button" data-newworld-claim'+(o?"":" disabled")+">"+(o?"Claim today":"Come back tomorrow")+"</button></div></div></div>"}function el(t){return Array.isArray(t)&&t.length?t:Ds}function tl({slots:t,eventId:e,view:a,seasonal:r=null,newWorld:s=null,board:n=null,roll:o=null,bingo:i=null,bingoHit:c=null,supply:l=null,from:d="Home",passTab:h="daily",alerts:v=null}={}){let u=el(t),g=u.filter(k=>k.live!==!1),y=g.find(k=>k.id===e)||g[0]||null,b=Qi(a),x='<div class="ev-rail"><div class="ev-rail-scroll">'+u.map(k=>jp(k,y&&y.id,!!(v&&v[k.id]))).join("")+"</div></div>",E;return y?y.kind==="pass"?E=$p(a,y.label,h):y.kind==="newworld"?E=Up(s,y.label):y.kind==="supply"?E=kn(l):y.kind==="bingo"?E=gn(i,c):y.kind==="board"?E=pn(n,o):y.kind==="seasonal"?E=en(r):y.kind==="login"?E='<div class="ev-pane">'+Ki(b.rungs,b.resetsIn,y.label)+ss(b.rungs,b.claimed,b.ready)+'<div class="ev-foot">'+Ta(b.gained)+Zi(b.ready,b.full)+"</div></div>":E='<div class="ev-pane"><div class="ev-soon"><span class="k">'+we(y.label)+'</span><span class="h">This event is not ready yet</span></div></div>':E='<div class="ev-pane"><div class="ev-soon"><span class="k">Nothing running</span><span class="h">No events open right now</span></div></div>','<div class="root"><div class="stage"></div><section class="screen" data-screen="events"><div class="head"><button class="back" type="button" data-events-back>&#9664; '+we(d)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Events</h2></div></div><div class="body"><div class="ev-cols">'+x+E+"</div></div></section></div>"}function al({view:t}={}){let e=Qi(t);return'<div class="ev-modal" data-events><div class="ev-veil"></div><div class="ev-panel">'+Ki(e.rungs,e.resetsIn,"7 Day Login Event",'<button class="ev-x" type="button" data-events-close aria-label="Close">Close</button>')+ss(e.rungs,e.claimed,e.ready)+'<div class="ev-foot">'+Ta(e.gained)+Zi(e.ready,e.full)+"</div></div></div>"}function Wp(t){if(!t||typeof t.addEventListener!="function")return()=>{};let e=4,a=!1,r=0,s=0,n=0,o=null,i=h=>{h.stopPropagation(),typeof h.preventDefault=="function"&&h.preventDefault()},c=h=>{h.pointerType!=="touch"&&(typeof h.button=="number"&&h.button!==0||(a=!0,n=0,o=h.pointerId,r=h.clientX,s=t.scrollLeft,t.classList.add("-drag")))},l=h=>{if(!a||o!==null&&h.pointerId!==o)return;let v=h.clientX-r;n=Math.max(n,Math.abs(v)),t.scrollLeft=s-v,n>e&&typeof h.preventDefault=="function"&&h.preventDefault()},d=()=>{a&&(a=!1,o=null,t.classList.remove("-drag"),n>e&&t.addEventListener("click",i,{capture:!0,once:!0}))};return t.addEventListener("pointerdown",c),t.addEventListener("pointermove",l),t.addEventListener("pointerup",d),t.addEventListener("pointercancel",d),t.addEventListener("pointerleave",d),t.addEventListener("dragstart",i),()=>{t.removeEventListener("pointerdown",c),t.removeEventListener("pointermove",l),t.removeEventListener("pointerup",d),t.removeEventListener("pointercancel",d),t.removeEventListener("pointerleave",d),t.removeEventListener("dragstart",i)}}function rl(t,{onBack:e,onPick:a,onClaim:r,onTab:s,onReroll:n,onSeasonalFight:o,onSeasonalDraw:i,onSeasonalDrawMany:c,onSeasonalMilestones:l,onSeasonalHelp:d,onBoardHelp:h,onNewWorldClaim:v,onBoardRoll:u,onBingoMark:g,onBingoHelp:y,onSupplyHelp:b,onSupplyGo:x,boardNextMs:E,onDiceLanded:k,slots:S=null}={}){let H=t.querySelector("[data-events-back]");H&&e&&H.addEventListener("click",()=>e()),Wp(t.querySelector(".pv-track"));let R=t.querySelector("[data-events-claim]");R&&r&&R.addEventListener("click",()=>r());let m=t.querySelector("[data-pass-claim]");if(m&&r&&m.addEventListener("click",()=>r()),s)for(let V of["daily","weekly","season"]){let Y=t.querySelector('[data-pass-tab="'+V+'"]');Y&&Y.addEventListener("click",()=>s(V))}let L=t.querySelector("[data-pass-reroll]");if(L&&n&&L.addEventListener("click",()=>{let V=t.querySelector(".pv-m:not(.done)[data-mission]");V&&n(V.getAttribute("data-mission"))}),o)for(let V of $e){let Y=t.querySelector('[data-seasonal-fight="'+V.difficulty+'"]');Y&&Y.addEventListener("click",()=>o(V.difficulty))}let W=t.querySelector("[data-seasonal-draw]");W&&i&&W.addEventListener("click",()=>i());let F=t.querySelector("[data-seasonal-draw-many]");F&&c&&F.addEventListener("click",()=>c());let J=t.querySelector("[data-seasonal-milestones]");J&&l&&J.addEventListener("click",()=>l());let ee=t.querySelector("[data-newworld-claim]");ee&&v&&ee.addEventListener("click",()=>v());let ie=t.querySelector("[data-seasonal-help]");if(ie&&d&&ie.addEventListener("click",()=>d()),d){let V=t.querySelector(".sv-modal-veil[data-seasonal-help-close]");V&&V.addEventListener("click",()=>d());let Y=t.querySelector("button[data-seasonal-help-close]");Y&&Y.addEventListener("click",()=>d())}if(y){let V=t.querySelector("[data-bingo-help]");V&&V.addEventListener("click",()=>y());let Y=t.querySelector(".sv-modal-veil[data-bingo-help-close]");Y&&Y.addEventListener("click",()=>y());let te=t.querySelector("button[data-bingo-help-close]");te&&te.addEventListener("click",()=>y())}if(h){let V=t.querySelector("[data-board-help]");V&&V.addEventListener("click",()=>h());let Y=t.querySelector(".sv-modal-veil[data-board-help-close]");Y&&Y.addEventListener("click",()=>h());let te=t.querySelector("button[data-board-help-close]");te&&te.addEventListener("click",()=>h())}if(b){let V=t.querySelector("[data-supply-help]");V&&V.addEventListener("click",()=>b());let Y=t.querySelector(".sv-modal-veil[data-supply-help-close]");Y&&Y.addEventListener("click",()=>b());let te=t.querySelector("button[data-supply-help-close]");te&&te.addEventListener("click",()=>b())}if(a)for(let V of el(S)){let Y=t.querySelector('[data-event="'+V.id+'"]');Y&&V.live!==!1&&Y.addEventListener("click",()=>a(V.id))}return yn(t,{onMark:g}),Sn(t,{onGo:x}),fn(t,{onRoll:u,nextMs:E,onLanded:k})}function sl(t,{onClose:e,onClaim:a}={}){let r=t.querySelector("[data-events-close]");r&&e&&r.addEventListener("click",()=>e());let s=t.querySelector("[data-events-claim]");s&&a&&s.addEventListener("click",()=>a());let n=t.querySelector(".ev-veil");n&&e&&n.addEventListener("click",()=>e())}var Na=[{id:"ach-rank",cat:"campaign",kind:"rank",steps:[3,5,8,12,16,20,25,30,40]},{id:"ach-login",cat:"campaign",kind:"login-day",steps:[3,7,14,21,30,45,60,90,120]},{id:"ach-story",cat:"campaign",kind:"story-clear",steps:[3,8,15,25,40,60,85,115,150]},{id:"ach-node",cat:"campaign",kind:"node-clear",steps:[3,8,15,30,50,80,120,180,250]},{id:"ach-chapter",cat:"campaign",kind:"chapter-clear",steps:[1,2,3,5,7,10,13,16,20]},{id:"ach-hard",cat:"campaign",kind:"hard-clear",steps:[1,5,12,25,45,70,100,140,200]},{id:"ach-level",cat:"training",kind:"level-up",steps:[5,15,30,60,100,160,250,380,550]},{id:"ach-ascend",cat:"training",kind:"ascend",steps:[1,3,6,10,15,21,28,36,45]},{id:"ach-form",cat:"training",kind:"form-up",steps:[3,8,15,25,40,60,85,115,150]},{id:"ach-relic",cat:"training",kind:"relic-feed",steps:[3,8,15,25,40,60,85,115,150]},{id:"ach-equip",cat:"training",kind:"equip",steps:[4,10,20,35,55,80,110,145,185]},{id:"ach-farm",cat:"expedition",kind:"farm-clear",steps:[3,8,15,30,50,80,120,180,250]},{id:"ach-vigor",cat:"expedition",kind:"vigor-spent",steps:[100,300,750,1500,3e3,6e3,1e4,16e3,25e3]},{id:"ach-drop",cat:"expedition",kind:"relic-drop",steps:[2,6,12,22,36,55,80,110,150]},{id:"ach-summon",cat:"summon",kind:"summon",steps:[5,10,25,50,100,200,350,600,1e3]},{id:"ach-5star",cat:"summon",kind:"summon-5star",steps:[1,2,4,7,11,16,22,30,40]},{id:"ach-facet",cat:"summon",kind:"facet",steps:[1,3,6,10,15,21,28,36,45]}],Ia=[{id:"campaign",label:"Campaign"},{id:"training",label:"Training"},{id:"expedition",label:"Expeditions"},{id:"summon",label:"Summoning"}],Gp=["rank"],Lm=(()=>{let t=new Set(Object.keys(Ga));for(let e of Na)Gp.indexOf(e.kind)>=0||t.add(e.kind);return t})();function Be(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function At(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var Vp=["I","II","III","IV","V","VI"];function Yp(t){let e=Math.max(1,Math.round(Number(t)||1));return Vp[e-1]||String(e)}function Kp(t){let e=t&&Array.isArray(t.rows)?t.rows:null;if(e&&e.length)return{rows:e,cats:Array.isArray(t.cats)?t.cats:[],ready:Math.max(0,Math.round(Number(t.ready)||0)),readyAether:Math.max(0,Math.round(Number(t.readyAether)||0)),claimed:Math.max(0,Math.round(Number(t.claimed)||0)),steps:Math.max(0,Math.round(Number(t.steps)||0))};let a=Na.map(s=>({id:s.id,cat:s.cat,kind:s.kind,done:0,goal:s.id+"-1",need:s.steps[0],text:"",tier:1,tiers:s.steps.length,aether:0,ready:!1,readyHere:0,complete:!1,steps:s.steps.map((n,o)=>({id:s.id+"-"+(o+1),step:o,need:n,aether:0,text:"",claimed:!1,ready:!1}))})),r=Ia.map(s=>{let n=a.filter(o=>o.cat===s.id);return{id:s.id,label:s.label,ladders:n.length,steps:n.reduce((o,i)=>o+i.tiers,0),claimed:0,ready:0,readyAether:0}});return{rows:a,cats:r,ready:0,readyAether:0,claimed:0,steps:a.reduce((s,n)=>s+n.tiers,0)}}function Xp(t){let e=Array.isArray(t.steps)?t.steps:[];if(!e.length)return"";let a="";for(let r of e){let s=r.claimed?" done":r.ready?" ready":"";a+='<span class="ac-step'+s+'">'+Be(r.need)+"</span>"}return a}function Jp(t){let e=Math.max(0,Math.round(Number(t.done)||0)),a=Math.max(1,Math.round(Number(t.need)||1)),r=t.complete?100:Math.min(100,Math.round(e/a*100)),s=["ac-row",t.complete?"done":"",t.ready?"ready":""].filter(Boolean).join(" "),n='<button class="ac-claim" type="button"'+(t.ready?' data-ach-claim="'+At(t.goal)+'"':" disabled")+">Claim</button>";return'<div class="'+s+'"><span class="ac-tier">'+Yp(t.tier)+'</span><span class="ac-what"><b class="ac-goal">'+At(t.text)+'</b><span class="ac-bar"><i style="width:'+r+'%"></i></span><span class="ac-steps">'+Xp(t)+'</span></span><span class="ac-count"><b>'+Be(Math.min(e,a))+'</b><span class="ac-of">/ '+Be(a)+'</span></span><span class="ac-pay"><span class="ac-prize"><span class="ac-amt">'+Q("aether")+"<b>"+Be(t.aether)+"</b></span>"+(t.readyHere>1?'<span class="ac-more">'+t.readyHere+" ready</span>":"")+"</span>"+n+"</span></div>"}function Zp(t,e){return'<button class="ac-cat'+(e?" on":"")+'" type="button" data-ach-cat="'+At(t.id)+'"><span class="ac-cat-nm">'+At(t.label)+'</span><span class="ac-cat-n">'+Be(t.claimed)+" / "+Be(t.steps)+"</span>"+(t.ready?'<span class="ac-cat-dot"></span>':"")+"</button>"}function nl({view:t,cat:e,from:a="Home"}={}){let r=Kp(t),s=r.cats.length?r.cats:Ia.map(c=>({...c,claimed:0,steps:0,ready:0,readyAether:0})),n=s.find(c=>c.id===e)||s[0],o=r.rows.filter(c=>c.cat===(n&&n.id)),i=r.ready?'<button class="ac-all" type="button" data-ach-claim-all>Claim all<span class="ac-all-n">'+Q("aether")+"<b>"+Be(r.readyAether)+"</b></span></button>":"";return'<div class="root"><div class="stage"></div><section class="screen" data-screen="achievements"><div class="head"><button class="back" type="button" data-ach-back>&#9664; '+At(a)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Achievements</h2></div></div><div class="body"><div class="ac-top"><span class="ac-tally"><b>'+Be(r.claimed)+"</b><span>of "+Be(r.steps)+" claimed</span></span>"+i+'</div><div class="ac-cols"><div class="ac-rail">'+s.map(c=>Zp(c,n&&c.id===n.id)).join("")+'</div><div class="ac-pane"><div class="ac-pane-id"><b>'+At(n?n.label:"")+"</b><span>"+Be(n?n.ready:0)+' ready</span></div><div class="ac-list">'+o.map(Jp).join("")+"</div></div></div></div></section></div>"}function ol(t,{onBack:e,onPick:a,onClaim:r,onClaimAll:s}={}){let n=t.querySelector("[data-ach-back]");n&&e&&n.addEventListener("click",()=>e());let o=t.querySelector("[data-ach-claim-all]");if(o&&s&&o.addEventListener("click",()=>s()),a)for(let i of Ia){let c=t.querySelector('[data-ach-cat="'+i.id+'"]');c&&c.addEventListener("click",()=>a(i.id))}if(r)for(let i of Na)for(let c=1;c<=i.steps.length;c+=1){let l=i.id+"-"+c,d=t.querySelector('[data-ach-claim="'+l+'"]');d&&d.addEventListener("click",()=>r(l))}}var il=`
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
`;function ns(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function Te(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var ef='<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg>';function tf(t,e){let a=Fs(t),r=t.live!==!1,s=r&&a!=null&&Number(e)>=a,n=r?'<button class="sh-buy" type="button"'+(s?' data-shop-buy="'+Te(t.id)+'"':" disabled")+">"+Q("aether")+"<b>"+ns(a)+"</b></button>":'<span class="sh-soon">'+Te(t.note||"Not open yet")+"</span>";return Ue({id:t.id,name:t.name,tag:Qt(t),label:t.name,held:r&&s,extra:[r?"":"off",r&&!s?"short":""].filter(Boolean).join(" "),action:n})}function af(t,e){let a=60,r=t&&t.owned===!0,s=!r&&Number(e)>=a,n=["sh-card","sh-look",r?"owned":"",!r&&!s?"short":""].filter(Boolean).join(" "),o=t&&t.url?'<img class="sh-photo" src="'+Te(t.url)+'" alt="" loading="lazy">':'<span class="sh-photo-none">'+ef+"</span>",i=r?'<span class="sh-owned">Owned</span>':'<button class="sh-buy" type="button"'+(s?' data-shop-outfit="'+Te(t.id)+'"':" disabled")+">"+Q("aether")+"<b>"+ns(a)+"</b></button>";return'<div class="'+n+'"><span class="sh-art sh-art-photo">'+o+'</span><b class="sh-name">'+Te(t&&t.unitName||"")+'</b><span class="sh-what">'+Te(t&&t.name||"")+"</span>"+i+"</div>"}function rf(){return`<div class="sh-empty"><b>This rotation's looks are being made</b><span>Two new outfits arrive with every banner. Come back in a moment.</span></div>`}function ll(t,e){if(!t||!e||!t.unlock)return null;let a=e[t.unlock];return a&&(Number(a.rank)>0||a.off===!0)?a:null}function sf(t,e,a,r){let s=t.id==="outfit",n=s?Array.isArray(a)?a:[]:Ua(t.id),o=n.length,i=s?n.filter(d=>!d.owned).length:n.filter(d=>d.live!==!1).length,c=t.live===!1||!!r,l=t.live===!1?Te(t.note||"Soon"):r&&r.off?"Off":r?"Rank "+r.rank:i+" of "+o;return'<button class="sh-cat'+(e?" on":"")+(c?" off":"")+'" type="button"'+(c?" disabled":' data-shop-cat="'+Te(t.id)+'"')+'><span class="sh-cat-nm">'+Te(t.label)+'</span><span class="sh-cat-n">'+l+"</span></button>"}function cl({wallet:t=null,cat:e,from:a="Home",outfits:r=null,locks:s=null}={}){let n=Math.max(0,Math.round(Number(t&&t.glimmer)||0)),o=Zt.filter(h=>h.live!==!1&&!ll(h,s)),i=o.find(h=>h.id===e)||o[0]||null,c=i?Ua(i.id):[],l=Array.isArray(r)?r:[],d=!!i&&i.id==="outfit";return'<div class="root"><div class="stage"></div><section class="screen" data-screen="shop"><div class="head"><button class="back" type="button" data-shop-back>&#9664; '+Te(a)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Shop</h2></div></div><div class="body"><div class="sh-top"><span class="sh-bal">'+Q("aether")+"<b>"+ns(n)+'</b><span>Glimmer</span></span><span class="sh-hint">Every summon pays Glimmer</span></div><div class="sh-cols"><div class="sh-rail">'+Zt.map(h=>sf(h,i&&h.id===i.id,l,ll(h,s))).join("")+'</div><div class="sh-pane"><div class="sh-pane-id"><b>'+Te(i?i.label:"")+"</b></div>"+(d?'<div class="sh-grid sh-grid-look">'+(l.length?l.map(h=>af(h,n)).join(""):rf())+"</div>":'<div class="item-board"><div class="grid">'+c.map(h=>tf(h,n)).join("")+"</div></div>")+"</div></div></div></section></div>"}function dl(t,{onBack:e,onPick:a,onBuy:r,onBuyOutfit:s}={}){let n=t.querySelector("[data-shop-back]");if(n&&e&&n.addEventListener("click",()=>e()),a)for(let o of Zt){let i=t.querySelector('[data-shop-cat="'+o.id+'"]');i&&i.addEventListener("click",()=>a(o.id))}if(r)for(let o of lt){let i=t.querySelector('[data-shop-buy="'+o.id+'"]');i&&i.addEventListener("click",()=>r(o.id))}if(s)for(let o of t.querySelectorAll("[data-shop-outfit]")){let i=o.getAttribute("data-shop-outfit");i&&o.addEventListener("click",()=>s(i))}}var hl=St+`
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
`;function Ra(t){return(Number(t)||0).toLocaleString("en-US")}function pl(t){if(!t)return[];let e=[];Number(t.funds)>0&&e.push({kind:"funds",itemId:"funds",qty:Number(t.funds),name:"Funds"}),Number(t.aether)>0&&e.push({kind:"aether",itemId:"aether",qty:Number(t.aether),name:"Aether"});let a=t.insight||{},r={shard:"Insight Shard",core:"Insight Core",prism:"Insight Prism"};for(let s of["shard","core","prism"])Number(a[s])>0&&e.push({kind:"xp",itemId:s,qty:Number(a[s]),name:r[s]});return e}function nf(t){let e=String(t);return e==="funds"||e==="aether"||e==="glimmer"||e==="rank"?e:e==="coin-event"?"glimmer":e.indexOf("relic:")===0?"relic":e==="shard"||e==="core"||e==="prism"?"xp":e.indexOf("tenet:")===0?"form":e.indexOf("mandate")===0?"mandate":"asc"}function fl(t){if(!t)return[];if(t.relic)return[];let e=String(t.itemId||"");return[{kind:e?nf(e):/Funds/i.test(String(t.material))?"funds":/Insight/i.test(String(t.material))?"xp":"asc",itemId:e,qty:Number(t.qty)||0,name:String(t.material||"")},...Number(t.first)>0?[{kind:"aether",itemId:"aether",qty:Math.round(Number(t.first)),name:"Aether"}]:[]]}var ul=kt+St+`
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
/* The prize tile: the shared item tile, sized for a moment instead of for a grid. A FIXED width,
   never content-sized -- three prizes whose names differ in length used to come out three widths. */
.rs-rw { flex: none; width: calc(var(--f) * 9.5); border-top-color: var(--amber); padding: var(--sp-2) calc(var(--f) * 0.5); }
.rs-loot .tile.item .art { width: 88%; max-width: calc(var(--f) * 7); }
.rs-loot .tile.item .fig { font-size: var(--t-lg); line-height: 1.1; }
.rs-loot .tile.item .lv { letter-spacing: 0.14em; }
/* Nothing to show is a sentence, not a gap: a defeat lands here too. */
.rs-none { flex: none; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; line-height: 1.5; color: var(--steel-faint); text-align: center; max-width: 46%; }

/* The piece that dropped: the SAME inventory card, at its own width. */
.rs-piece { flex: none; width: min(30%, calc(var(--f) * 19)); display: flex; flex-direction: column; gap: calc(var(--f) * 0.4); }
.rs-piece .rs-cap { text-align: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.24em; text-transform: var(--case); color: var(--amber); }
/* The Supply Line credit rides over the loot, in the same voice as the vault caption. */
.rs-supply { text-align: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.24em; text-transform: var(--case); color: var(--amber); }

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
`;function of(t){return Ue({id:t.itemId||t.kind,name:t.name,fig:(Number(t.qty)>0?"+":"")+Ra(t.qty),label:t.name,held:!0,extra:"rs-rw"})}function os(t,e){let a=Number(e);return!Number.isFinite(a)||a<=0?100:Math.max(0,Math.min(100,Math.round(Number(t)/a*1e3)/10))}function vl({outcome:t="win",where:e="",rewards:a=[],relic:r=null,rank:s=null,supply:n=0,bonus:o=null,canReplay:i=!1}={}){let c=t!=="lose",l=Array.isArray(a)?a:[],d=s&&s.from||null,h=d?os(d.xp,d.xpNeeded):s?os(s.xp,s.xpNeeded):0,v=s?os(s.xp,s.xpNeeded):0,u=Number(s&&s.levels)||0;return'<div class="root'+(c?"":" lose")+'"><div class="stage"></div><section class="screen" data-screen="result"><div class="rs-verdict"><h2>'+(c?"Victory":"Defeat")+"</h2>"+(e?'<span class="rs-where">'+f(e)+"</span>":"")+"</div>"+(r?'<div class="rs-piece"><div class="rs-cap">A piece from the Vault</div>'+_t(r,{actions:!1})+"</div>":"")+(c&&Number(n)>1?'<div class="rs-supply">Supply Line &mdash; loot &times;'+Math.round(Number(n))+"</div>":"")+(c&&o&&Number(o.units)>0?'<div class="rs-supply">Banner bonus &mdash; coin &times;'+Math.round(Number(o.mult)*100)/100+" &middot; "+Math.round(Number(o.units))+" of "+Math.round(Number(o.of)||4)+" characters</div>":"")+(l.length?'<div class="rs-loot">'+l.map(of).join("")+"</div>":r?"":'<div class="rs-none">'+(c?"Nothing dropped here &mdash; this node pays in progress, not in materials.":"You keep nothing. The Vigor was spent when the stage started, so a loss costs the run.")+"</div>")+(s?'<div class="rs-rank'+(u>0?" leveled":"")+'" data-rank data-start="'+h+'" data-end="'+v+'" data-levels="'+u+'"><div class="rs-top"><span>Commander</span><b data-rank-level>'+Number(s.level)+'</b><span class="rs-gain">+'+Ra(s.gain)+' XP</span></div><div class="rs-track"><i data-rank-bar style="width:'+h+'%"></i></div><div class="rs-foot"><span data-rank-xp>'+Ra(s.xp)+" / "+(s.xpNeeded===null||s.xpNeeded===void 0?"&mdash;":Ra(s.xpNeeded))+" XP</span><span>"+(s.xpNeeded===null||s.xpNeeded===void 0?"At the rank cap":"to Commander "+(Number(s.level)+1))+"</span></div>"+(Number(s.vigorMax)>0&&Number(s.from&&s.from.vigorMax)>0?'<div class="rs-up">'+(Number(s.vigor)>0?"<span>Vigor <b>+"+Number(s.vigor)+"</b></span>":"")+"<span>Cap <b>"+Number(s.from.vigorMax)+" &rarr; "+Number(s.vigorMax)+"</b></span></div>":"")+"</div>":"")+'<div class="rs-acts">'+(i?'<button class="ghost" type="button" data-result-again>Run it again</button>':"")+'<button type="button" data-result-continue>Continue &rsaquo;</button></div></section></div>'}function ml(t,{onContinue:e,onAgain:a}={}){(t.querySelector(".root")||t).addEventListener("click",d=>{let h=d&&d.target&&d.target.closest?d.target:null;if(h){if(h.closest("[data-result-again]")){a&&a();return}h.closest("[data-result-continue]")&&e&&e()}});let s=t.querySelector("[data-rank]"),n=t.querySelector("[data-rank-bar]");if(!s||!n)return;let o=Number(s.getAttribute("data-end"))||0,i=Number(s.getAttribute("data-levels"))||0,c=(d,h)=>{typeof setTimeout=="function"&&setTimeout(h,d)},l=d=>{n.style&&(n.style.width=d+"%")};if(i>0){c(30,()=>l(100)),c(900,()=>{n.style&&(n.style.transition="none"),l(0),c(30,()=>{n.style&&(n.style.transition=""),l(o)})});return}c(30,()=>l(o))}var lf=[{match:/:chapter:(\d+)$/,cost:"tokens",label:t=>`Forging chapter ${t[1]}`},{match:/:combat:(\d+):(\d+)$/,cost:"tokens",label:t=>`Designing a fight \xB7 chapter ${t[1]}`},{match:/:beat:(\d+):(\d+)$/,cost:"tokens",label:()=>"Writing the next scene"},{match:/:banner:char:/,cost:"tokens",label:()=>"Minting this week's characters"},{match:/:banner:wpn:/,cost:"tokens",label:()=>"Minting this week's weapons"},{match:/:banner:standard$/,cost:"tokens",label:()=>"Forging the founding cast"},{match:/:banner-art:/,cost:"images",label:()=>"Painting the banner"},{match:/:portrait$/,cost:"images",label:()=>"Painting a portrait"},{match:/:bg:/,cost:"images",label:()=>"Painting a location"},{match:/:cgart:/,cost:"images",label:()=>"Painting a key image"},{match:/:unit:protagonist-weapon$/,cost:"tokens",label:()=>"Forging their signature weapon"},{match:/:unit:protagonist$/,cost:"tokens",label:()=>"Building your unit"}],cf=[{at:"/banner",cost:"tokens",label:"Forging the founding cast"},{at:"/summon-banner",cost:"tokens",label:"Checking this week's banner"},{at:"/chapter-plan",cost:"tokens",label:"Forging the chapter"},{at:"/combat-guide",cost:"tokens",label:"Designing a fight"},{at:"/beat",cost:"tokens",label:"Writing the next scene"},{at:"/compress",cost:"tokens",label:"Compressing a chapter"},{at:"/portrait/upload",cost:"images",label:"Sending your image"},{at:"/portrait",cost:"images",label:"Painting a portrait"},{at:"/background",cost:"images",label:"Painting a location"},{at:"/cg-art",cost:"images",label:"Painting a key image"},{at:"/banner-art",cost:"images",label:"Painting the banner"}],df=["/portrait/select"];function gl(t){let e=String(t||"");if(df.includes(e))return null;for(let a of cf)if(e===a.at||e.startsWith(a.at+"/"))return{cost:a.cost,label:a.label};return null}function hf(t){let e=String(t||"");for(let a of lf){let r=e.match(a.match);if(r)return{cost:a.cost,label:a.label(r)}}return e?{cost:"tokens",label:"Generating"}:null}function pf(t){let e=Number(t&&t.total)||0;if(!e)return null;let a=Math.min(e,Number(t.done)||0);return{cost:"images",label:t&&t.name?`Painting ${t.name}`:"Painting portraits",detail:`${a+1} of ${e}`}}function bl({generating:t=[],local:e=[],art:a=null,background:r=null}={}){let s=[],n=new Set,o=i=>{!i||n.has(i.label)||(n.add(i.label),s.push(i))};for(let i of Array.isArray(e)?e:[])o(i);for(let i of Array.isArray(t)?t:[])o(hf(i));return o(pf(a)),r&&o({cost:"images",label:"Painting a location",detail:String(r)}),s}function yl(t){return(Array.isArray(t)?t:[]).map(e=>e.label+(e.detail||"")).join("|")}var wl=`
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
`;function xl(t,{max:e=2}={}){let a=Array.isArray(t)?t.filter(Boolean):[];if(!a.length)return"";let r=a.slice(0,e),s=a.length-r.length;return'<div class="gb-busy" data-busy aria-live="polite">'+r.map(n=>'<div class="gb-row '+(n.cost==="images"?"images":"text")+'"><span class="gb-dot"></span><span class="gb-what"><b>'+f(n.label)+"</b>"+(n.detail?" &middot; "+f(n.detail):"")+'</span><span class="gb-cost">'+(n.cost==="images"?"image":"tokens")+"</span></div>").join("")+(s>0?'<div class="gb-more">+'+s+" more running</div>":"")+"</div>"}function _l(t){return t>=5?"\u2605\u2605\u2605\u2605\u2605":t===4?"\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605"}function Ca(t){let e=Number(t)||0;return(e*100>=10,(e*100).toFixed(1)).replace(/\.0$/,"")+"%"}var ff={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',material:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><path d="M50 20 78 52 50 110 22 52Z"/><path d="M50 20 50 110M22 52h56" stroke="#0E1420" stroke-opacity="0.35" stroke-width="3"/></g></svg>',glimmer:'<svg viewBox="0 0 100 130" aria-hidden="true"><path d="M50 22 76 52 50 108 24 52Z" fill="none" stroke="url(#gf-ssil)" stroke-width="5"/><path d="M50 45 56 60 71 66 56 72 50 87 44 72 29 66 44 60Z" fill="url(#gf-ssil)"/></svg>'};var is='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="#F0B429" stroke="#B8860B" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2 7 12l5 10" stroke="#FFF" stroke-opacity="0.5" stroke-width="1.2"/></svg>',uf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="var(--on-coral)" stroke="var(--on-coral)" stroke-width="1.4" stroke-linejoin="round"/></svg>',vf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';var mf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" stroke="currentColor" stroke-width="1.8"/></svg>',gf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',ls='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-ssil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',ds=`
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
`,bf={bulwark:"Bulwark",blade:"Blade",focus:"Focus",tome:"Tome",edge:"Edge"};function Wt(t){let e=t.kind==="weapon"?"weapon":t.kind==="material"?"material":t.kind==="glimmer"?"glimmer":"character",a=Number(t.rarity)||3,r=Math.max(0,Math.round(Number(t.glimmer)||0)),s=e==="material"?"Material":e==="glimmer"?"Glimmer":he(t.name)||"Unit",n;if(e==="material")n="Material";else if(e==="glimmer")n="+"+r;else if(e==="weapon"){let o=bf[t.weaponType]||(t.weaponType?t.weaponType:"Weapon");n=t.dedicatedTo?`${o} \xB7 ${he(t.dedicatedTo)}'s signature`:o}else n=t.role?`${t.role}${t.affinity?" \xB7 "+t.affinity:""}`:"";return{kind:e,rarity:a,name:s,role:n,weaponType:t.weaponType||"",dedicatedTo:t.dedicatedTo||"",portrait:t.portrait||null,isNew:!!t.isNew,up:!!t.up,facet:t.facet||null,glimmer:r}}function yf(t,e){let a=t.kind==="material"||t.kind==="glimmer"?" mat":t.kind==="weapon"?" wpn":"",r=e&&t.kind!=="character"?'<span class="kind-tag">'+(t.kind==="weapon"?"Weapon":t.kind==="glimmer"?"Glimmer":"Material")+"</span>":"",s=t.up?'<span class="pill-up">UP</span>':"";return'<div class="u-art'+a+'">'+bt(t.portrait,"")+'<span class="u-stars">'+_l(t.rarity)+"</span>"+s+(t.portrait?"":t.kind==="weapon"?Pe(t.weaponType,"gf-ssil"):ff[t.kind])+r+(t.isNew?'<span class="tag-new">NEW</span>':t.facet?'<span class="tag-new fct">'+(t.facet.gained?"FACET "+t.facet.facet:"FACET "+t.facet.facet+"/"+t.facet.max)+"</span>":t.glimmer?'<span class="tag-new fct">+'+t.glimmer+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+f(t.name)+'</div><div class="u-role">'+f(t.role)+"</div></div>"}function cs(t,e){return'<article class="u r'+(Number(t.rarity)||3)+'">'+yf(t,e)+"</article>"}function kl(t){let e=null;for(let a of t){let r=Wt(a);(!e||r.rarity>e.rarity)&&(e=r)}return e}function Sl(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return"";let a=Math.floor(e/6e4);if(a<60)return Math.max(1,a)+"m left";let r=Math.floor(a/60);if(r<24)return r+"h left";let s=Math.floor(r/24),n=r-s*24;return n>0?s+"d "+n+"h left":s+"d left"}function wf(t,e){let a=f(t.id);if(t.live===!1)return'<button class="bcard" type="button" aria-disabled="true" data-banner="'+a+'"><span class="bt-face empty">'+mf+'</span><span class="bt-id"><b>'+f(t.title||t.id)+"</b><i>"+f(t.note||"Not open yet")+"</i></span></button>";let r=t.face?'<span class="bt-face" style="background-image:url('+f(t.face)+')"></span>':t.kind==="weapon"?'<span class="bt-face sil">'+Pe(t.weaponType||"blade","gf-ssil")+"</span>":'<span class="bt-face empty">'+vf+"</span>",s=t.pity||{},n=Number(s.hard)||80,o=Number(s.count)||0,i=Math.max(0,Math.min(100,o/n*100)),c=t.pending?"Opens when you pick it":t.type==="featured"?"Featured \xB7 "+(Sl(t.endsInMs)||"ending"):"Permanent";return'<button class="bcard" type="button" data-banner="'+a+'" aria-pressed="'+(t.id===e)+'">'+r+'<span class="bt-id"><b>'+f(t.title||t.id)+"</b><i>"+c+'</i><span class="bt-pity"><span class="bt-track"><i style="width:'+i.toFixed(0)+'%"></i></span><em>'+o+"/"+n+(s.guaranteed?" \xB7 gtd":"")+"</em></span></span></button>"}function El({banners:t=[],banner:e,rates:a,pity:r,wallet:s,cost:n=160,bannerId:o="char-standard",state:i="ready",details:c=!1,history:l=null,arting:d=!1}={}){let h=Number(s&&s.aether)||0,v=Array.isArray(t)?t:[],u='<div class="rail"><div class="rail-scroll">'+(v.length?v.map(ne=>wf(ne,o)).join(""):"")+"</div></div>";if(i!=="ready"||!e){let ne=i==="error"?"Try again in a moment, or pick another banner.":"Summoning this week's featured cast \u2014 the first open of a new week takes a few seconds. Pick another banner to pull now.";return`
<div class="root">
  ${ls}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${is}<b>${h.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show"><div class="soon-panel"><div class="h">${i==="error"?"Couldn't open the banner":"Working\u2026"}</div><p>${ne}</p></div></div>
    </div>
  </section>
</div>`}let g=e,y=g.kind==="weapon"?"weapon":"character",b=Array.isArray(g.featured)?g.featured.map(Wt):[],x=b.find(ne=>ne.rarity===5)||b[0]||null,E=b.find(ne=>ne.rarity===4)||null,k=typeof g.art=="string"&&!!g.art.trim(),S;if(k)S='<div class="art wide" style="background-image:url('+f(g.art)+')"></div>';else if(y==="weapon")S='<div class="art"><div class="artback flat"></div><div class="plates"><div class="plate sil">'+Pe(x&&x.weaponType||"blade","gf-ssil")+"</div></div></div>";else{let ne=x&&x.portrait?f(x.portrait):"",pe=E&&E.portrait?f(E.portrait):"";S='<div class="art">'+(ne?'<div class="artback" style="background-image:url('+ne+')"></div>':'<div class="artback flat"></div>')+'<div class="plates">'+(ne?'<div class="plate five" style="background-image:url('+ne+')"></div>':"")+(pe?'<div class="plate four" style="background-image:url('+pe+')"></div>':"")+"</div></div>"}let H=g.type==="featured"?Sl(g.endsInMs):"",R=g.type==="featured"?"Featured \xB7 5\u2605 "+y+(H?" \xB7 "+H:""):"Permanent pool",m=g.title||(x?x.name:"Banner"),L=x?f(he(x.name))+(x.role?" \xB7 "+f(x.role):""):"The permanent pool. Every retired featured unit folds in here.",W=a||{},F=ne=>g.type==="featured"?" <em>\u2191"+Ca(ne)+"</em>":"",J='<div class="rates"><span><b class="g">\u2605\u2605\u2605\u2605\u2605</b> '+Ca(W.five)+F(W.featured)+'</span><span><b class="e">\u2605\u2605\u2605\u2605</b> '+Ca(W.four)+F(W.featuredFour)+"</span>"+(g.type==="featured"?"":"<span>No rate-up</span>")+"</div>",ee=r||{},ie=Number(ee.count)||0,V=Number(ee.hard)||80,Y=Number(ee.soft)||74,te=Math.max(0,V-ie),re=Math.min(100,ie/V*100),me=Math.min(100,Y/V*100),se=Ca(W.featured),C=g.type==="featured"?"Guaranteed 5\u2605 in <b>"+te+"</b> \xB7 soft pity from "+Y+" \xB7 "+(ee.guaranteed?"next 5\u2605 <b>is</b> the rate-up":"next 5\u2605 is a "+se+" chance for the rate-up"):"Guaranteed 5\u2605 in <b>"+te+"</b> \xB7 soft pity from "+Y+" \xB7 5\u2605 from the standard pool",A='<div class="pity"><div class="fig"><span>Pity to 5\u2605 '+(g.kind==="character"?"character":"weapon")+"</span><span><b>"+ie+"</b> / "+V+'</span></div><div class="track"><i style="width:'+re.toFixed(1)+'%"></i><span class="soft" style="left:'+me.toFixed(1)+'%"></span></div><div class="note">'+C+"</div></div>",N=h>=n,I=h>=n*10,O='<div class="pulls"><button class="pull one" type="button" data-pull="1"'+(N?"":' aria-disabled="true"')+'><span class="big">Summon</span><span class="cost">'+is+" "+n+' \xB7 \xD71</span></button><button class="pull ten" type="button" data-pull="10"'+(I?"":' aria-disabled="true"')+'><span class="big">Summon \xD710</span><span class="cost">'+uf+" "+n*10+" \xB7 one 4\u2605+ guaranteed</span></button></div>",K=g.canArt===!0?'<button class="chip" type="button" data-redo-art'+(d?' aria-disabled="true"':"")+">"+gf+(d?"Painting\u2026":k?"Redo art":"Paint art")+"</button>":"",de=Array.isArray(g.pool4)?g.pool4.map(Wt):[],Ne=g.type==="featured"?"Also in this banner":"Also in the permanent pool",De=c?'<div class="sheet" data-sheet><div class="sheet-head"><h4>'+f(m)+'</h4><span class="spacer"></span><button class="chip" type="button" data-details-close>Close</button></div>'+J+'<div class="strips"><span class="strip-label">'+(g.type==="featured"?"Rate-up":"Standard 5\u2605")+'</span><div class="strip-scroll"><div class="featured">'+b.map(ne=>cs({...ne,up:g.type==="featured"},!0)).join("")+"</div></div>"+(de.length?'<span class="strip-label">'+Ne+'</span><div class="strip-scroll"><div class="featured">'+de.map(ne=>cs({...ne,up:!1},!0)).join("")+"</div></div>":"")+"</div></div>":"",xe=l?_f(l,m):"";return`
<div class="root">
  ${ls}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${is}<b>${h.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show">
        ${S}
        <div class="veil"></div>
        <div class="bname"><span class="kicker">${R}</span><h3>${f(m)}</h3><p>${L}</p></div>
        <div class="chips">${K}<button class="chip" type="button" data-history>History</button><button class="chip" type="button" data-details>Details &amp; pool</button></div>
        <div class="float">${J}${A}${O}</div>
        ${De}${xe}
      </div>
    </div>
  </section>
</div>`}function xf(t){let e=new Date(Number(t)||0),a=r=>String(r).padStart(2,"0");return e.getFullYear()+"-"+a(e.getMonth()+1)+"-"+a(e.getDate())+" "+a(e.getHours())+":"+a(e.getMinutes())}function kf(t,e){let r=[...new Set([1,e,t-1,t,t+1])].filter(o=>o>=1&&o<=e).sort((o,i)=>o-i),s=[],n=0;for(let o of r)n&&o-n>1&&s.push(null),s.push(o),n=o;return s}function _f(t,e){let a=t&&t.state||"ready",r=Array.isArray(t&&t.rows)?t.rows:[],s=Math.max(1,Number(t&&t.pages)||1),n=Math.min(Math.max(1,Number(t&&t.page)||1),s),o=Number(t&&t.total)||0,i;a==="loading"?i='<div class="hs-note">Loading\u2026</div>':a==="error"?i='<div class="hs-note">Could not load this history.</div>':r.length?i='<div class="hs-rows">'+r.map(l=>{let d=Number(l&&l.r)||3,h="\u2605".repeat(d),v=l&&l.k==="glimmer"?"Glimmer +"+(Number(l.g)||0):l&&l.n||"";return'<div class="hs-row r'+d+'"><span class="hs-pity">'+(Number(l&&l.p)||0)+'</span><span class="hs-name">'+f(v)+'</span><span class="hs-stars">'+h+'</span><span class="hs-when">'+f(xf(l&&l.t))+"</span></div>"}).join("")+"</div>":i='<div class="hs-note">No pulls recorded yet. Pulls are saved here from now on.</div>';let c=s>1?'<div class="hs-pager">'+kf(n,s).map(l=>l===null?'<span class="hs-gap">&hellip;</span>':'<button class="hs-page" type="button" data-history-page="'+l+'"'+(l===n?' aria-current="true"':"")+">"+l+"</button>").join("")+"</div>":"";return'<div class="sheet" data-sheet data-history-sheet><div class="sheet-head"><h4>History</h4><span class="hs-of">'+f(e||"")+'</span><span class="spacer"></span><span class="hs-total">'+o.toLocaleString("en-US")+' pulls</span><button class="chip" type="button" data-history-close>Close</button></div>'+i+c+"</div>"}function Al({results:t=[]}={}){let e=t.map(Wt),a=e.length===1,r=e.map((s,n)=>'<div class="rv-card r'+s.rarity+'" data-i="'+n+'"><div class="rv-rays"></div><div class="rv-flare"></div><div class="rv-inner"><div class="rv-face rv-facedown"><span></span></div><div class="rv-face rv-front">'+cs(s,!0)+"</div></div></div>").join("");return`
<div class="root">
  ${ls}
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
</div>`}function Tl(t,{banners:e=[],onBanner:a,onPull:r,onBack:s,onDetails:n,onHistory:o,onHistoryPage:i,onRedoArt:c}){for(let y of Array.isArray(e)?e:[]){if(!y||!y.id||y.live===!1)continue;let b=t.querySelector('[data-banner="'+y.id+'"]');b&&b.addEventListener("click",(x=>()=>a&&a(x))(y.id))}let l=t.querySelector("[data-details]");l&&l.addEventListener("click",()=>n&&n(!0));let d=t.querySelector("[data-details-close]");d&&d.addEventListener("click",()=>n&&n(!1));let h=t.querySelector("[data-history]");h&&h.addEventListener("click",()=>o&&o(!0));let v=t.querySelector("[data-history-close]");v&&v.addEventListener("click",()=>o&&o(!1));for(let y of t.querySelectorAll("[data-history-page]"))y.addEventListener("click",()=>i&&i(Number(y.dataset.historyPage)||1));let u=t.querySelector("[data-redo-art]");u&&u.addEventListener("click",()=>{u.getAttribute("aria-disabled")!=="true"&&c&&c()});for(let y of t.querySelectorAll("[data-pull]"))y.addEventListener("click",()=>{y.getAttribute("aria-disabled")!=="true"&&r&&r(Number(y.dataset.pull)===10?10:1)});let g=t.querySelector("[data-summon-back]");g&&g.addEventListener("click",()=>s&&s())}function Nl(t,{results:e=[],onContinue:a}){let r=t.querySelector('[data-screen="reveal"]'),s=t.querySelector("[data-rv-back]"),n=t.querySelector("[data-rv-grid]"),o=t.querySelector("[data-rv-headline]"),i=e.map(Wt),c=[],l=0,d=()=>{for(let E of c)clearTimeout(E);c.length=0},h=E=>{!r||!r.classList||(r.classList.remove("phase-charge","phase-flash","phase-reveal","phase-done"),E&&r.classList.add("phase-"+E))},v=E=>{let k=n&&n.querySelector('[data-i="'+E+'"]');k&&k.classList&&k.classList.add("revealed")},u=()=>{let E=kl(e);o&&(o.innerHTML=E?"Best pull: <b>"+f(E.name)+"</b> \xB7 "+_l(E.rarity):""),h("done")},g=()=>{for(;l<i.length;l+=1)v(l);u()};h("charge");let y=(kl(e)||{rarity:3}).rarity;s&&s.classList&&s.classList.remove("gold","epic","steel"),c.push(setTimeout(()=>{s&&s.classList&&s.classList.add(y===5?"gold":y===4?"epic":"steel")},620)),c.push(setTimeout(()=>h("flash"),1180)),c.push(setTimeout(()=>{h("reveal");let E=i.length===1?0:230;for(let k=0;k<i.length;k+=1)c.push(setTimeout(()=>{v(l),l+=1},260+k*E));c.push(setTimeout(u,260+i.length*E+260))},1560)),r&&r.addEventListener("click",E=>{E.target&&E.target.closest&&(E.target.closest(".rv-foot")||E.target.closest(".rv-top"))||r.classList&&r.classList.contains("phase-done")||(d(),h("reveal"),g())});let b=t.querySelector("[data-rv-skip]");b&&b.addEventListener("click",()=>{d(),h("reveal"),g()});let x=t.querySelector("[data-rv-continue]");return x&&x.addEventListener("click",()=>{d(),a&&a()}),d}var Cl=`
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
`,Sf='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="fm-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',Ll='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#fm-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',Ef='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8l4 4 4-6 4 6 4-4v9H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',Af={4:"\u2605\u2605\u2605\u2605",5:"\u2605\u2605\u2605\u2605\u2605"},Tf={Fire:"var(--af-fire)",Water:"var(--af-water)",Wind:"var(--af-wind)",Earth:"var(--af-earth)",Light:"var(--af-light)",Dark:"var(--af-dark)"};function Nf(t){return(Number(t)||0).toLocaleString("en-US")}function Ml(t){let e=t&&t.leaderSlot||"leader",a=t&&t.leader||{name:"You",role:"\u2014",affinity:"Fire",cp:0},r={id:e,leader:!0,name:a.name||"You",r:5,role:a.role||"\u2014",aff:a.affinity||"Fire",pos:a.position==="back"?"back":"front",cp:Number(a.cp)||0,portrait:a.portrait||null},s=new Map,n=(t&&Array.isArray(t.units)?t.units:[]).map(o=>{let i={id:o.id,name:o.name,r:o.rarity===5?5:4,role:o.role||"",aff:o.affinity||"Fire",pos:o.position==="back"?"back":"front",cp:Number(o.cp)||0,portrait:o.portrait||null};return s.set(i.id,i),i});return{LEADER:e,leaderObj:r,byId:s,units:n}}function Ol(t,e){return e===t.LEADER?t.leaderObj:t.byId.get(e)||null}function Bl(t){let e=t&&typeof t=="object"?t:{},a=r=>{let s=Array.isArray(r)?r:[];return[s[0]||null,s[1]||null,s[2]||null]};return{front:a(e.front),back:a(e.back)}}function La(t,e){return t.front.indexOf(e)>=0||t.back.indexOf(e)>=0}function If(t,e){let a=0;return["front","back"].forEach(r=>{e[r].forEach(s=>{let n=s&&Ol(t,s);n&&(a+=n.cp)})}),a}function zl(t,e){return(t&&Array.isArray(t.presets)&&t.presets.length?t.presets:[{name:"Team 1",board:{front:[e,null,null],back:[null,null,null]}}]).map((r,s)=>({name:r&&r.name||"Team "+(s+1),board:Bl(r&&r.board)}))}function Ma(t,e){return Bl(t&&t.board)}function Rf(t,e,a,r,s){let n=e[r][s],o=a&&a.row===r&&a.idx===s;if(!n)return'<button class="slot empty'+(o?" held":"")+'" data-slot="'+r+":"+s+'"><span class="plus">+<small>Add</small></span></button>';let i=Ol(t,n)||t.leaderObj;return'<button class="'+("slot filled "+(i.leader?"leader":"r"+i.r)+(o?" held":""))+'" data-slot="'+r+":"+s+'">'+(i.leader?'<span class="slot-tag">LEADER</span>':"")+'<div class="slot-art">'+bt(i.portrait,"","slot-photo")+(i.portrait?"":Ll)+'</div><span class="slot-remove" data-remove="'+r+":"+s+'">\xD7</span><div class="slot-meta"><div class="slot-name">'+f(he(i.name))+'</div><div class="slot-role">'+f(i.role)+" \xB7 "+f(i.aff)+"</div></div></button>"}function Oa(t,e,a,r){return e[r].map((s,n)=>Rf(t,e,a,r,n)).join("")}function Il(t,e,a,r,s){let n=La(r,e.id),o=s&&s.bench===e.id,i="b "+(a?"leader":"r"+e.r)+(n?" inteam":"")+(o?" held":""),c=a?"\u2605\u2605\u2605\u2605\u2605":Af[e.r],l=a&&!n?'<span class="youtag">YOU</span>':"";return'<button class="'+i+'" data-pick="'+e.id+'"><span class="b-ic">'+(a?Ef:e.portrait?'<img class="b-photo" src="'+f(e.portrait)+'" alt="" loading="lazy">':Ll)+'<span class="aff" style="background:'+(Tf[e.aff]||"var(--steel)")+'"></span></span><span class="b-main"><span class="b-name">'+f(he(e.name))+'</span><span class="b-sub">'+f(e.role)+" \xB7 "+f(e.aff)+'</span></span><span class="b-stars">'+c+"</span>"+l+"</button>"}function Fl(t,e,a,r){let s=t.units.filter(o=>r==="all"||String(o.r)===r),n=Il(t,t.leaderObj,!0,e,a);return s.forEach(o=>{n+=Il(t,o,!1,e,a)}),n}function Pl(t,e){return t.units.filter(a=>!La(e,a.id)).length}function Hl(t,e,a,r,s){let n="";return a.forEach((o,i)=>{let c=i===r,l=If(t,c?e:Ma(o,t.LEADER));n+='<div class="preset'+(c&&s?" dirty":"")+'" data-preset="'+i+'" aria-pressed="'+c+'"><span class="nm" data-name="'+i+'">'+f(o.name)+'</span><span class="cp">'+Nf(l)+'</span><span class="x" data-del="'+i+'">\xD7</span></div>'}),n}function Dl({state:t="loading",data:e=null,battleMode:a=!1}={}){let r;if(t==="ready"&&e){let s=Ml(e),n=zl(e,s.LEADER),o=Math.min(Math.max(0,Number(e.active)||0),n.length-1),i=Ma(n[o],s.LEADER);return r='<div class="fm-body"><div class="board"><div class="row-lab">Front line &mdash; melee &amp; guard</div><div class="slots" data-row="front">'+Oa(s,i,null,"front")+'</div><div class="row-lab">Back line &mdash; ranged &amp; support</div><div class="slots" data-row="back">'+Oa(s,i,null,"back")+'</div><div class="board-foot"><span class="hint">Tap a unit, then a slot to place &middot; <b>\xD7</b> benches a unit</span></div></div><div class="picker"><div class="picker-head"><span class="t">Your units</span><span class="n" data-bench-n>'+Pl(s,i)+' available</span></div><div class="filters" data-filters><button class="chip" type="button" data-rar="all" aria-pressed="true">All</button><button class="chip" type="button" data-rar="5" aria-pressed="false">5&#9733;</button><button class="chip" type="button" data-rar="4" aria-pressed="false">4&#9733;</button></div><div class="bench-scroll"><div class="bench" data-bench>'+Fl(s,i,null,"all")+"</div></div>"+(a?'<button class="into-battle" type="button" data-into-battle>Into battle &raquo;<small>Start the fight with this team</small></button>':"")+'</div></div><div class="presets"><span class="lab">Presets</span><div class="preset-strip" data-presets>'+Hl(s,i,n,o,!1)+'</div><div class="preset-actions"><span class="autosaved">Auto-saved</span><button class="btn" type="button" data-saveas>New team</button></div></div>',Rl(r,a)}return t==="error"?r=`<div class="fm-msg"><span class="t">Couldn't load the formation.</span><button class="retry" type="button" data-retry>Retry</button></div>`:r='<div class="fm-msg"><span class="t">Marshalling your units\u2026</span></div>',Rl(r,a)}function Rl(t,e){return'<div class="root">'+Sf+'<div class="stage"></div><section class="screen"><div class="head"><button class="back" type="button" data-back>&#9664; '+(e?"Cancel":"Command")+'</button><div class="head-id"><div class="eyebrow">'+(e?"Before the fight":"Command")+"</div><h2>"+(e?"Choose your team":"Formation")+"</h2></div></div>"+t+"</section></div>"}function ql(t,{data:e,onSave:a,onBack:r,onRetry:s,onIntoBattle:n}={}){let o=t.querySelector("[data-back]");o&&o.addEventListener("click",()=>r&&r());let i=t.querySelector("[data-retry]");i&&i.addEventListener("click",()=>s&&s());let c=t.querySelector("[data-into-battle]");if(c&&c.addEventListener("click",()=>n&&n()),!e)return()=>{};let l=Ml(e),d=l.LEADER,h=zl(e,d),v=Math.min(Math.max(0,Number(e.active)||0),h.length-1),u=Ma(h[v],d),g=null,y="all",b=!1,x=null,E=t.querySelector("[data-bench-n]"),k=t.querySelector("[data-bench]"),S=t.querySelector("[data-presets]"),H=t.querySelector("[data-save]");function R(){b=!0}function m(){let N=h.map((I,O)=>({name:I.name,board:O===v?{front:u.front.slice(),back:u.back.slice()}:{front:I.board.front.slice(),back:I.board.back.slice()}}));a&&a(N,v)}function L(){h[v].board={front:u.front.slice(),back:u.back.slice()},b=!1,m()}function W(N,I){v=N,u=Ma(h[N],d),b=!1,g=null,I||C()}function F(N,I,O){let $=N.bench?N.bench:u[N.row][N.idx];if(!$)return!1;let K=u[I][O];if(N.bench)u[I][O]=$;else{if(N.row===I&&N.idx===O)return!1;u[N.row][N.idx]=K,u[I][O]=$}return R(),!0}function J(N){return N.bench?!1:(u[N.row][N.idx]=null,R(),!0)}function ee(N){let I=["front","back"];for(let O=0;O<2;O++){let $=u[I[O]].indexOf(N);if($>=0)return{row:I[O],idx:$}}return null}function ie(N){if(La(u,N)){let I=ee(N);g=g&&g.row===I.row&&g.idx===I.idx?null:{row:I.row,idx:I.idx},C();return}g=g&&g.bench===N?null:{bench:N},C()}function V(N){let I=N.split(":")[0],O=+N.split(":")[1];if(!g){u[I][O]&&(g={row:I,idx:O}),C();return}let $=F(g,I,O);g=null,$&&L(),C()}function Y(N){let I=N.split(":")[0],O=+N.split(":")[1],$=J({row:I,idx:O});g=null,$&&L(),C()}function te(N){let I=N.split(":");return{row:I[0],idx:+I[1]}}function re(){for(let N of t.querySelectorAll(".drop-ok"))N.classList.remove("drop-ok")}function me(){for(let I of t.querySelectorAll("[data-slot].filled"))I.setAttribute("draggable","true"),I.addEventListener("dragstart",function(O){if(g=null,x=te(this.dataset.slot),O.dataTransfer){O.dataTransfer.effectAllowed="move";try{O.dataTransfer.setData("text/plain",this.dataset.slot)}catch{}}}),I.addEventListener("dragend",function(){x=null,re()});for(let I of t.querySelectorAll("[data-slot]"))I.addEventListener("dragover",function(O){x&&(O.preventDefault(),this.classList.add("drop-ok"))}),I.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),I.addEventListener("drop",function(O){if(O.preventDefault(),!x){re();return}let $=te(this.dataset.slot),K=F(x,$.row,$.idx);x=null,K&&L(),C()});for(let I of t.querySelectorAll("[data-pick]")){let O=I.dataset.pick;La(u,O)||(I.setAttribute("draggable","true"),I.addEventListener("dragstart",function($){if(g=null,x={bench:this.dataset.pick},$.dataTransfer){$.dataTransfer.effectAllowed="copy";try{$.dataTransfer.setData("text/plain",this.dataset.pick)}catch{}}}),I.addEventListener("dragend",function(){x=null,re()}))}let N=t.querySelector(".picker");N&&!N._fmDrop&&(N._fmDrop=!0,N.addEventListener("dragover",function(I){x&&!x.bench&&(I.preventDefault(),this.classList.add("drop-ok"))}),N.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),N.addEventListener("drop",function(I){if(I.preventDefault(),this.classList.remove("drop-ok"),x&&!x.bench){let O=J(x);x=null,O&&L(),C()}}))}function se(N){h.length<=1||(h.splice(N,1),v>=h.length?v=h.length-1:N<v&&v--,W(v),m())}function C(){let N=t.querySelector('[data-row="front"]'),I=t.querySelector('[data-row="back"]');N&&(N.innerHTML=Oa(l,u,g,"front")),I&&(I.innerHTML=Oa(l,u,g,"back")),k&&(k.innerHTML=Fl(l,u,g,y)),E&&(E.textContent=Pl(l,u)+" available"),S&&(S.innerHTML=Hl(l,u,h,v,b)),H&&(H.disabled=!b);for(let O of t.querySelectorAll("[data-slot]"))O.addEventListener("click",function(){V(this.dataset.slot)});for(let O of t.querySelectorAll("[data-remove]"))O.addEventListener("click",function($){$.stopPropagation(),Y(this.dataset.remove)});for(let O of t.querySelectorAll("[data-pick]"))O.addEventListener("click",function(){ie(this.dataset.pick)});for(let O of t.querySelectorAll("[data-preset]"))O.addEventListener("click",function($){$.target.closest&&($.target.closest("[data-del]")||$.target.closest("[data-name]"))||(W(+this.dataset.preset),m())});for(let O of t.querySelectorAll("[data-del]"))O.addEventListener("click",function($){$.stopPropagation(),se(+this.dataset.del)});for(let O of t.querySelectorAll("[data-name]"))O.addEventListener("click",function($){$.stopPropagation(),this.setAttribute("contenteditable","true"),this.focus()}),O.addEventListener("blur",function(){this.removeAttribute("contenteditable"),h[+this.dataset.name].name=(this.textContent||"").trim().slice(0,40)||"Team",C(),m()}),O.addEventListener("keydown",function($){$.key==="Enter"&&($.preventDefault(),this.blur())});me()}H&&H.addEventListener("click",function(){b&&(h[v].board={front:u.front.slice(),back:u.back.slice()},b=!1,C(),m())});let A=t.querySelector("[data-saveas]");A&&A.addEventListener("click",function(){h.push({name:"Team "+(h.length+1),board:{front:u.front.slice(),back:u.back.slice()}}),W(h.length-1),m()});for(let N of t.querySelectorAll("[data-rar]"))N.addEventListener("click",function(){y=this.dataset.rar;for(let I of t.querySelectorAll("[data-rar]"))I.setAttribute("aria-pressed",String(I.dataset.rar===y));C()});return C(),()=>{}}var Cf={Tank:"T",Warrior:"W",Mage:"M",Support:"S",Assassin:"A"},Lf='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#cb-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',Mf={fire:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5.2A6 6 0 0 1 6 14c0-4.5 4.5-6.5 6-12Z"/></svg>',water:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3c4 5.2 6 8.2 6 11.2A6 6 0 0 1 6 14.2c0-3 2-6 6-11.2Z"/></svg>',wind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 18h8"/></svg>',earth:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 21 9 12 21 3 9Z"/></svg>',light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>',dark:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 3a9 9 0 1 0 5.5 15.5A7 7 0 0 1 15.5 3Z"/></svg>'};function Of(t){return String(t||"").toLowerCase()}var Ul=`
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
/* The row box HUGS the lattice (3 tracks + 2 gaps = 5.3cw) instead of stretching to the side:
   stretched, the offset back row pushed its own empty box 103px past the stage and the screen scrolled. */
.side.enemies .row { position: relative; display: grid; grid-template-columns: repeat(3, var(--cw)); gap: calc(var(--cw)*1.15); justify-content: center; width: max-content; align-self: center; }
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
`,Bf='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="cb-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.14"/></linearGradient></defs></svg>';function zf(t,e){let a=Of(t.affinity);return'<div class="cbt'+(e?" enemy":"")+'" data-id="'+f(t.id)+'" data-aff="'+a+'" style="--aff:var(--'+a+')"><div class="fx" data-fx></div><div class="ava">'+(t.portrait?'<img class="ava-photo" src="'+f(t.portrait)+'" alt="" loading="lazy">':Lf)+'<span class="role">'+(Cf[t.role]||"?")+'</span><span class="aff-badge" title="'+a+'">'+(Mf[a]||"")+'</span></div><div class="bars"><div class="hp"><i style="width:100%"></i></div><span class="hpn"></span><div class="en"><i></i></div></div><div class="nm">'+f(he(t.name))+"</div></div>"}function $l(t,e){let a=t.filter(n=>(n.position||"front")==="front"),r=t.filter(n=>n.position==="back"),s=(n,o)=>n.length?'<div class="row '+o+'">'+n.map(i=>zf(i,e)).join("")+"</div>":"";return e?s(r,"back")+s(a,"front"):s(a,"front")+s(r,"back")}function jl(t,e){return'<div class="arena"><div class="side enemies" data-side-enemies>'+$l(e,!0)+'</div><div class="midline"></div><div class="side allies" data-side-allies>'+$l(t,!1)+"</div></div>"}function Ff(t){let e=Array.isArray(t&&t.presets)?t.presets:[];if(e.length<=1)return"";let a=typeof t.activePreset=="number"?t.activePreset:0;return'<div class="cbt-presets" data-cbt-presets><span class="lab">Team</span>'+e.map(r=>'<button class="cbt-preset" type="button" data-preset-pick="'+r.index+'"'+(r.index===a?' aria-pressed="true"':"")+'><span class="nm">'+f(he(r.name))+'</span><span class="cp">'+(Number(r.cp)||0).toLocaleString("en-US")+"</span></button>").join("")+"</div>"}function Wl({phase:t="loading",payload:e=null,node:a=null,result:r=null,vigor:s=null,error:n=""}={}){let o=a&&a.title||"Combat",i;if(t==="prebattle"&&e)i=jl(e.allies||[],e.enemies||[])+'<div class="veil"></div><div class="head"><button class="back" type="button" data-back>&#9664; Chapter</button><div class="head-id"><div class="eyebrow">Combat</div><h2>'+f(o)+'</h2></div></div><div class="briefing"><div class="brief-scroll"><span class="brief-kicker">Objective</span>'+(e.opening?'<p class="brief-open">'+f(e.opening)+"</p>":"")+'<p class="brief-obj">'+f(e.objective||"Defeat the enemy formation.")+'</p></div><div class="brief-meta">'+(a&&a.chapter?"<span>Chapter <b>"+f(String(a.chapter))+"</b></span>":"")+"<span>Your team <b>"+(e.allies||[]).length+"</b></span><span>Enemies <b>"+(e.enemies||[]).length+"</b></span>"+(e.supply&&e.supply.left>0?'<span class="brief-supply">Supply Line <b>&times;'+(Number(e.supply.mult)||2)+" loot</b> &middot; "+e.supply.left+" of "+e.supply.perDay+" today</span>":"")+(e.bonus&&e.bonus.of>0?'<span class="brief-supply">Banner bonus <b>&times;'+Math.round(Number(e.bonus.mult)*100)/100+" coin</b> &middot; "+e.bonus.units+" of "+e.bonus.of+"</span>":"")+"</div>"+Ff(e)+(s&&Number.isFinite(s.cost)?'<button class="fstart" type="button" data-start'+(s.have>=s.cost?"":" disabled")+">Start battle &raquo; <b>"+s.cost+" Vigor</b></button>"+(s.have>=s.cost?'<div class="vig-note">'+s.have+" Vigor left</div>":'<div class="vig-note short">Not enough Vigor &mdash; '+s.have+" of "+s.cost+(s.nextMs?", +1 in "+Math.max(1,Math.ceil(s.nextMs/6e4))+"m":"")+"</div>"):'<button class="fstart" type="button" data-start>Start battle &raquo;</button>')+"</div>";else if(t==="battle"&&e)i=jl(e.allies||[],e.enemies||[])+'<div class="cbar"><button class="back" type="button" data-back>&#9664; Retreat</button><div class="wave-id"><small>'+f(o)+'</small>Auto-battle</div><div class="ctrls"><button type="button" data-play aria-pressed="true">&#10074;&#10074; Pause</button><button type="button" data-speed aria-pressed="false">&times;1</button><button type="button" data-skip>Skip &raquo;</button><button class="gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">'+qa+'</button></div></div><div class="abanner" data-abanner><span class="big"></span><span class="sub"></span></div>';else if(t==="error"){let c=n==="empty-party";i='<div class="cb-msg"><div class="box"><span class="t">'+(c?"This team has no units. Seat at least one in Formation.":"Couldn't set up the battle.")+"</span>"+(c?"":'<button class="retry" type="button" data-retry>Retry</button>')+'<button class="retry" type="button" data-back style="background:transparent;border-color:var(--steel);color:var(--text)">Back</button></div></div>'}else i='<div class="cb-msg"><div class="box"><span class="t">Preparing the battle\u2026</span></div></div>';return'<div class="root">'+Bf+'<section class="screen">'+i+"</section></div>"}function Gl(t,{phase:e,steps:a=[],result:r=null,onStart:s,onBack:n,onFinished:o,onRetry:i,onPickPreset:c}={}){let l=t.querySelector("[data-back]");l&&l.addEventListener("click",()=>n&&n());for(let C of t.querySelectorAll("[data-preset-pick]"))C.addEventListener("click",function(){c&&c(+this.dataset.presetPick)});let d=t.querySelector("[data-retry]");d&&d.addEventListener("click",()=>i&&i());let h=t.querySelector("[data-start]");if(h&&h.addEventListener("click",()=>s&&s()),e!=="battle")return()=>{};let v=1.9,u=null,g=0,y=!1,b=1,x=C=>t.querySelector('.cbt[data-id="'+String(C).replace(/"/g,"")+'"]'),E=t.querySelector("[data-abanner]");function k(C,A,N,I){let O=x(C);if(!O)return;let $=O.querySelector(".hp > i");$&&($.style.width=Math.max(0,A)+"%");let K=O.querySelector(".hpn");K&&Number.isFinite(N)&&Number.isFinite(I)&&(K.textContent=Math.max(0,N).toLocaleString("en-US")+" / "+I.toLocaleString("en-US")),A<=0?(O.classList.add("dead"),O.classList.remove("charged")):O.classList.remove("dead")}function S(C,A){let N=x(C);if(!N)return;let I=N.querySelector(".en > i");I&&(I.style.width=Math.min(100,A)+"%"),N.classList.toggle("charged",A>=100&&!N.classList.contains("dead"))}function H(C,A,N){let I=x(C);if(!I)return;let O=I.querySelector("[data-fx]");if(!O)return;let $=document.createElement("div");$.className="vfx "+A,N&&$.style.setProperty("--fxc",N),O.appendChild($),setTimeout(()=>{$.parentNode&&$.parentNode.removeChild($)},1e3/b)}function R(C,A,N,I){let O=x(C);if(!O)return;let $=O.querySelector("[data-fx]");if(!$)return;let K=document.createElement("span");K.className="dmg "+N,I?K.innerHTML=f(A)+'<b class="eff '+I.toLowerCase()+'">'+I+(I==="STRONG"?" \xD71.5":" \xD70.75")+"</b>":K.textContent=A,$.appendChild(K),setTimeout(()=>{K.parentNode&&K.parentNode.removeChild(K)},1100/b)}function m(C){let A=x(C);A&&(A.classList.add("acting"),setTimeout(()=>A.classList.remove("acting"),520/b))}function L(C){let A=x(C);A&&(A.classList.add("hit"),setTimeout(()=>A.classList.remove("hit"),340/b))}function W(C,A){E&&(E.querySelector(".big").textContent=C,E.querySelector(".sub").textContent=A||"",E.classList.remove("show"),E.offsetWidth,E.classList.add("show"))}function F(C,A){let N=t.querySelector(C==="enemies"?"[data-side-enemies]":"[data-side-allies]");if(!N)return;let I=document.createElement("div");I.className="vfx wave",I.style.cssText="left:12%;top:20%;width:76%;height:60%;--fxc:"+A,N.style.position="relative",N.appendChild(I),setTimeout(()=>{I.parentNode&&I.parentNode.removeChild(I)},700/b)}function J(C,A){switch(C.op){case"start":A&&W("Battle start","Affinity rules every hit");break;case"act":A&&m(C.id);break;case"ult":A&&(m(C.id),W(C.name,C.sub));break;case"hit":A&&(L(C.id),H(C.id,"hit"),H(C.id,"slash","#fff"),R(C.id,"-"+C.amount+(C.crit?"!":""),"d"+(C.crit?" crit":""),C.effLabel||"")),k(C.id,C.hpPct,C.hp,C.hpMax);break;case"heal":A&&(H(C.id,"heal"),R(C.id,"+"+C.amount,"h")),k(C.id,C.hpPct,C.hp,C.hpMax);break;case"energy":S(C.id,C.pct);break;case"hp":k(C.id,C.pct,C.hp,C.hpMax);break;case"shieldFx":if(A)for(let N of C.ids||[])H(N,"shield");break;case"buff":A&&(H(C.id,"buff"),R(C.id,C.text,"b"));break;case"debuff":A&&(H(C.id,"debuff"),R(C.id,C.text,"f"));break;case"stun":A&&H(C.id,"stun");break;case"aoe":A&&F(C.side,C.color);break;case"death":{let N=x(C.id);N&&N.classList.add("dead");break}case"revive":{let N=x(C.id);N&&N.classList.remove("dead"),A&&(H(C.id,"heal"),R(C.id,"REVIVE","b"));break}case"end":ie(C.result);break;default:break}}let ee=!1;function ie(C){ee||(ee=!0,o&&o(C==="lose"?"lose":"win"))}function V(){let C=a[g++];for(let A of C.events)J(A,!0)}function Y(){if(y||g>=a.length)return;let C=a[g];V(),u=setTimeout(Y,(C.d||500)*v/b)}function te(){for(clearTimeout(u);g<a.length;){let C=a[g++];for(let A of C.events)J(A,!1)}}let re=t.querySelector("[data-play]");re&&re.addEventListener("click",function(){y=!y,this.setAttribute("aria-pressed",String(!y)),this.innerHTML=y?"&#9654; Play":"&#10074;&#10074; Pause",y?clearTimeout(u):Y()});let me=t.querySelector("[data-speed]");me&&me.addEventListener("click",function(){b=b===1?2:b===2?3:1,this.setAttribute("aria-pressed",String(b>1)),this.innerHTML="&times;"+b});let se=t.querySelector("[data-skip]");return se&&se.addEventListener("click",()=>{te()}),r?te():Y(),()=>{clearTimeout(u)}}var Vl=10;function Pf(t){let e=t&&t.progress||{},a=1;for(let r of Object.keys(e)){let s=Number(r);Number.isInteger(s)&&s>a&&(a=s)}return a}function Hf(t){let e=Pf(t),a=t&&t.progress&&t.progress[String(e)]||{},r=Number(a.normal)||0,s=`Chapter ${ke(e)}`;return r<=0?`${s} \xB7 not started`:r>=Vl?`${s} \xB7 complete`:`${s} \xB7 ${r} / ${Vl}`}var Yl=`
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
`;function Kl({runs:t,activeRunId:e}){return`
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
    <div class="rn-list">${(Array.isArray(t)?t:[]).map(s=>{let n=f(s.runId),o=s.runId===e,i=s.name&&String(s.name).trim()?s.name:"Untitled run",c=o?'<span class="rn-badge">Active</span>':"",l=o?`<button class="rn-go" type="button" data-go="${n}">Continue</button>`:`<button class="rn-go switch" type="button" data-go="${n}">Switch</button>`;return`<article class="rn-run${o?" active":""}">`+c+`<div class="rn-info"><div class="rn-name">${f(i)}</div><p class="rn-scn">${f(s.scenario)}</p><span class="rn-prog">${f(Hf(s))}</span></div><div class="rn-actions">`+l+`<button class="rn-del" type="button">Delete</button><span class="rn-confirm"><button class="rn-yes" type="button" data-del="${n}">Delete</button><button class="rn-no" type="button">Cancel</button></span></div><p class="rn-warn">Delete this world? Everything goes with it &mdash; its cast, its art and its story. It cannot be undone.</p></article>`}).join("")||'<p class="rn-empty">No runs yet.</p>'}</div>
    <button class="rn-back" type="button" data-back>&#9664; Back to the game</button>
  </div>
</div>`}function Xl(t,{onNew:e,onSwitch:a,onDelete:r,onBack:s}){t.querySelector("[data-new]")?.addEventListener("click",()=>e&&e()),t.querySelector("[data-back]")?.addEventListener("click",()=>s&&s());for(let n of t.querySelectorAll("[data-go]"))n.addEventListener("click",()=>a&&a(n.getAttribute("data-go")));for(let n of t.querySelectorAll(".rn-del"))n.addEventListener("click",()=>n.closest(".rn-run")?.classList.add("confirming"));for(let n of t.querySelectorAll(".rn-no"))n.addEventListener("click",()=>n.closest(".rn-run")?.classList.remove("confirming"));for(let n of t.querySelectorAll("[data-del]"))n.addEventListener("click",()=>r&&r(n.getAttribute("data-del")))}function Ba(t){return(t<10?"0":"")+t}var Zl=`
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
/* While a key image covers its span the characters are IN the picture: sprites step aside. */
.vn[data-cg] .vn-cast { display: none; }
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
`,Df=380,qf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4l14 8-14 8V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',$f='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5l9 7-9 7V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',jf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14M5 12h14M5 19h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Uf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',Wf='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function Gf(t){return'<svg class="vn-figure" data-figure viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"'+(t?" hidden":"")+'><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>'}function hs(t){return String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/gu,"").replace(/[^a-z0-9 ]/gu," ").replace(/\s+/gu," ").trim()}var Vf=new Set(["you","yourself","me","myself","i","player","protagonist"]);function ps(t,e){let a=hs(e);if(!a||!Array.isArray(t)||!t.length)return null;for(let o of t)if(o&&hs(o.name)===a)return o;if(Vf.has(a)){let o=t.find(i=>i&&i.prota);if(o)return o}let r=a.split(" ")[0];if(!r)return null;let s=!a.includes(" "),n=null;for(let o of t){if(!o)continue;let i=hs(o.name).split(" ");if(s?i.includes(a):i[0]===r){if(n)return null;n=o}}return n}function za(t){return t?t.prota?"left":"right":""}function Jl(t,e){let a=!!e&&za(e)===t,r=a&&e.art?String(e.art):"",s=n=>{let o=n==="a"&&r;return'<div class="vn-art" data-art="'+n+'"><img data-img alt=""'+(o?' src="'+f(r)+'"':"")+(o?"":" hidden")+" />"+Gf(!!o)+"</div>"};return'<div class="vn-plate" data-side="'+t+'" data-plate="'+t+'" data-open="'+(a?"true":"false")+'" data-front="a">'+s("a")+s("b")+"</div>"}function fs(t,e){if(!t||typeof t!="object"||!t.url)return"";let a=Number(t.from)||0,r=Number(t.to)||0;return e>=a&&e<=r?String(t.url).trim():""}function us(t,e,a){let r=t&&typeof t.place=="string"?t.place:"",s=e&&typeof e=="object"?e:null,n=r&&s&&typeof s[r]=="string"?s[r].trim():"";return n||(typeof a=="string"?a.trim():"")}var Yf=new Set(["a","an","and","as","at","but","by","for","in","nor","of","on","or","the","to","with"]);function Kf(t){let e=String(t??"").trim();if(!e)return"";let a=e.split(/\s+/u);return a.map((r,s)=>{if(/[A-Z]/u.test(r))return r;let n=r.replace(/[^a-z0-9]/gu,"");return s>0&&s<a.length-1&&Yf.has(n)?r:r.charAt(0).toUpperCase()+r.slice(1)}).join(" ")}function Ql(t){if(!t)return"";let e=Math.max(1,Math.round(Number(t.total)||0)),a=Math.max(0,Math.min(e-1,Math.round(Number(t.at)||0))),r=String(t.title==null?"":t.title).trim();return'<div class="rl-modal" role="dialog" aria-modal="true" aria-label="Pick up where you left off"><div class="rl-veil"></div><div class="rl-panel">'+(r?'<div class="rl-top"><div class="rl-eyebrow">'+f(r)+"</div></div>":"")+'<p class="rl-say">You got as far as line <b>'+(a+1)+"</b> of <b>"+e+'</b>.</p><div class="rl-foot"><button class="rl-alt" type="button" data-vn-restart>Start over</button><button class="rl-ok" type="button" data-vn-resume>Keep reading</button></div></div></div>'}function ec(t,{onResume:e,onRestart:a}={}){let r=t&&t.querySelector("[data-vn-resume]"),s=t&&t.querySelector("[data-vn-restart]");r&&e&&r.addEventListener("click",()=>e()),s&&a&&s.addEventListener("click",()=>a())}function vs(t){if(!t||!t.speaker)return t&&t.thought?"Thought":"Narration";let e=Kf(t.speaker);return t.thought?e+" (thought)":e}function tc({chapterLabel:t,nodeTitle:e,segments:a,cast:r=[],background:s="",places:n=null,cg:o=null,replay:i=!1,prologue:c=!1}){let l=Array.isArray(a)&&a.length?a:[{speaker:"",text:""}],d=l[0],h=!d.speaker,v=!!d.thought,u=Ba(1)+" / "+Ba(l.length),g=fs(o,0),y=g||us(d,n,s),b=`<div class="vn-bg" data-bg="a"${y?` data-on style="background-image:url('${f(y)}')"`:""}></div><div class="vn-bg" data-bg="b"></div>`,x=Array.isArray(r)?r.filter(Boolean):[],E=x.length?ps(x,d.speaker):null,k=x.length?`<div class="vn-cast" data-cast><div class="vn-cast-in">${Jl("left",E)}${Jl("right",E)}</div></div>`:"",S=za(E);return`
<div class="root">
  <div class="vn-scene">${b}</div>
  <div class="vn"${S?` data-portrait="${S}"`:""}${g?" data-cg":""} data-vn>
    <div class="vn-top">
      ${c?"":'<button class="vn-exit" type="button" data-exit>&#9664; Chapter</button>'}
      <span class="vn-caption"><span class="loc">${f(e||"Story")}</span><span class="mood">${f(t||"")}${i?'<b class="vn-re">Rereading &middot; free</b>':""}</span></span>
    </div>

    <div class="vn-stage">${k}</div>

    <div class="vn-dock">
      <div class="vn-bar">
        <span class="vn-who"${h?" data-narration":""}${v?" data-thought":""} data-who>${f(vs(d))}</span>
        <div class="vn-tools">
          <button class="vn-tool" type="button" data-auto>${qf}Auto</button>
          <button class="vn-tool" type="button" data-skip>${$f}Skip</button>
          <button class="vn-tool" type="button" data-log>${jf}Log</button>
        </div>
      </div>

      <div class="vn-box"${h?" data-narration":""}${v?" data-thought":""} data-box>
        <div class="vn-text" data-text>${f(d.text)}</div>
        <span class="vn-count" data-count>${u}</span>
        <span class="vn-next" data-next hidden>${Uf}</span>
        <button class="vn-continue" type="button" data-continue hidden>${c?"Go to Home":i?"Back to the map":"Continue"}${Wf}</button>
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
</div>`}function ac(t,e){let a=Array.isArray(e.segments)&&e.segments.length?e.segments:[{speaker:"",text:""}],{onContinue:r,onExit:s}=e,n=t.querySelector(".root"),o=t.querySelector("[data-box]"),i=t.querySelector("[data-who]"),c=t.querySelector("[data-text]"),l=t.querySelector("[data-count]"),d=t.querySelector("[data-next]"),h=t.querySelector("[data-continue]"),v=t.querySelector("[data-exit]"),u=t.querySelector("[data-auto]"),g=t.querySelector("[data-skip]"),y=t.querySelector("[data-log]"),b=t.querySelector("[data-log-box]"),x=t.querySelector("[data-log-list]"),E=t.querySelector("[data-log-close]"),k=typeof window<"u"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,S=Math.max(0,Math.min(a.length-1,Math.round(Number(e.startAt)||0))),H=!1,R=null,m=!1,L=null;function W(){R&&(clearInterval(R),R=null),H=!1}function F(){L&&(clearTimeout(L),L=null)}let J=t.querySelector("[data-vn]"),ee={left:t.querySelector('[data-plate="left"]'),right:t.querySelector('[data-plate="right"]')},ie=Array.isArray(e.cast)?e.cast.filter(Boolean):[],V=ps(ie,a[0].speaker),Y=V?V.name:null,te=za(V),re=null,me={a:t.querySelector('[data-bg="a"]'),b:t.querySelector('[data-bg="b"]')},se="a",C=fs(e.cg,0)||us(a[0],e.places,e.background);function A(w,T){!w||typeof w.setAttribute!="function"||(T?w.setAttribute("hidden",""):w.removeAttribute("hidden"))}function N(w,T,P){!w||typeof w.setAttribute!="function"||(P?w.setAttribute(T,""):w.removeAttribute(T))}function I(w,T){if(!w)return;let P=w.getAttribute("data-front")==="a"?"b":"a",B=w.querySelector('[data-art="'+P+'"]');if(B){let q=B.querySelector("[data-img]"),M=B.querySelector("[data-figure]"),z=T&&T.art?String(T.art):"";q&&(z&&q.setAttribute("src",z),A(q,!z)),A(M,!!z)}w.setAttribute("data-front",P)}function O(w,T){I(ee[w],T),ee[w]&&ee[w].setAttribute("data-open","true"),J&&J.setAttribute("data-portrait",w),te=w}function $(){for(let w of["left","right"])ee[w]&&ee[w].setAttribute("data-open","false");J&&J.removeAttribute("data-portrait"),te=""}function K(w){if(!ee.left&&!ee.right)return;let T=ps(ie,w.speaker),P=T?T.name:null;if(P===Y)return;if(Y=P,re&&(clearTimeout(re),re=null),!T){$();return}let B=za(T);if(te&&te!==B){$(),re=setTimeout(()=>{re=null,O(B,T)},Df);return}O(B,T)}function de(w){let T=fs(e.cg,S);N(J,"data-cg",!!T);let P=T||us(w,e.places,e.background);if(P===C)return;C=P;let B=se==="a"?"b":"a",q=me[B],M=me[se];q&&q.style&&(q.style.backgroundImage=P?"url("+JSON.stringify(P)+")":""),N(q,"data-on",!!P),N(M,"data-on",!1),se=B}function Ne(w){let T=!w.speaker,P=!!w.thought;i&&(i.textContent=vs(w),N(i,"data-narration",T),N(i,"data-thought",P)),o&&(N(o,"data-narration",T),N(o,"data-thought",P)),K(w)}function De(){let w=S>=a.length-1;d&&(d.hidden=w),h&&(h.hidden=!w)}function xe(w){W(),c&&(c.textContent=w.text),De(),m&&S<a.length-1&&(L=setTimeout(pe,1500))}function ne(w,T){if(W(),F(),typeof e.onAt=="function"&&e.onAt(S),Ne(w),de(w),l&&(l.textContent=Ba(S+1)+" / "+Ba(a.length)),d&&(d.hidden=!0),h&&(h.hidden=!0),!T||k){xe(w);return}c&&(c.textContent=""),H=!0;let P=0;R=setInterval(()=>{P+=1,c&&(c.textContent=w.text.slice(0,P)),P>=w.text.length&&xe(w)},18)}function pe(){if(F(),H){xe(a[S]);return}S<a.length-1&&(S+=1,ne(a[S],!0))}function p(){if(!x)return;let w="";for(let P=0;P<=S;P+=1){let B=!!a[P].speaker;w+='<div class="vn-log-item'+(B?" said":"")+(a[P].thought?" thought":"")+'">'+(B?'<div class="vn-log-who"></div>':"")+'<div class="vn-log-line"></div></div>'}x.innerHTML=w;let T=x.querySelectorAll(".vn-log-item");for(let P=0;P<=S;P+=1){let B=T[P];if(!B)continue;let q=B.querySelector(".vn-log-who"),M=B.querySelector(".vn-log-line");q&&(q.textContent=vs(a[P])),M&&(M.textContent=a[P].text)}b&&(b.hidden=!1),x.scrollTop=x.scrollHeight}function _(){b&&(b.hidden=!0)}return n&&n.addEventListener("click",w=>{let T=w&&w.target;T&&T.closest&&T.closest("[data-exit],[data-continue],[data-auto],[data-skip],[data-log],[data-log-box]")||pe()}),h&&h.addEventListener("click",w=>{w&&w.stopPropagation&&w.stopPropagation(),r&&r()}),v&&v.addEventListener("click",w=>{w&&w.stopPropagation&&w.stopPropagation(),s&&s()}),u&&u.addEventListener("click",w=>{w&&w.stopPropagation&&w.stopPropagation(),m=!m,m?u.setAttribute("data-on",""):u.removeAttribute("data-on"),m&&!H&&S<a.length-1?L=setTimeout(pe,1200):F()}),g&&g.addEventListener("click",w=>{w&&w.stopPropagation&&w.stopPropagation(),F(),m=!1,u&&u.removeAttribute("data-on"),S=a.length-1,ne(a[S],!1)}),y&&y.addEventListener("click",w=>{w&&w.stopPropagation&&w.stopPropagation(),p()}),E&&E.addEventListener("click",w=>{w&&w.stopPropagation&&w.stopPropagation(),_()}),b&&b.addEventListener("click",w=>{let T=w&&w.target;if(!T)return;(typeof T.closest=="function"?T.closest(".vn-log-panel"):T!==b)||_()}),ne(a[S],!1),()=>{W(),F(),re&&(clearTimeout(re),re=null)}}var rc="marinara-capability-gacha-forge",Xf=900,Jf=new Set(["boot","banner","art","forge"]),Zf={busy:"Another portrait for this unit is still on its way. Give it a moment.","no-image-connection":"This world has no image connection \u2014 pick one in settings > Style.","engine-unreachable":"Could not reach the image service.","generation-failed":"The image backend refused this prompt. Shorter tags usually help.","upload-failed":"The gallery would not take that image.","bad-image":"That is not an image the gallery accepts (PNG, JPEG, WebP, GIF or AVIF).","too-large":"That image is too big to send. Crop it smaller or save it at a lower quality.","not-in-history":"That portrait is not kept any more.","not-allowed":"This unit's portrait is not ours to repaint.","not-found":"This unit is gone.","bad-request":"Something was missing from that request."},Fa="/api/gacha-forge",sc=`.gf-boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0E1420;color:#7E93AE;font-family:"Bahnschrift","Segoe UI",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem}.gf-boot::before{content:'';width:.6rem;height:.6rem;background:#F2603C;transform:rotate(45deg);margin-right:.6rem;animation:gf-boot-blink .9s steps(2) infinite}@keyframes gf-boot-blink{50%{opacity:.2}}.gf-boot-bad{flex-direction:column;gap:.8rem;color:#C7D3E2;text-transform:none;letter-spacing:.04em;font-size:.85rem;text-align:center;padding:1.2rem}.gf-boot-bad::before{display:none}.gf-boot-bad button{cursor:pointer;font:inherit;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;border:1px solid #F2603C;background:#F2603C;color:#10151F}`,ms=class extends HTMLElement{constructor(){super(),this._root=this.attachShadow({mode:"open"}),this._props={},this._onPropsChange=()=>this._apply(),this._initState()}_initState(){this._drawnView=null,this._renderKey=null,this._helpOpen=new Set,this._eventId="",this._forgeCancelAsking=!1,this._forgeAsked=!1,this._forgeCancelling=!1,this._eventsRev=0,this._login=null,this._loginKey="",this._eventGained=null,this._eventRelic=null,this._loginOpen=!1,this._loginSeen=!1,this._pass=null,this._passKey="",this._passTab="daily",this._seasonal=null,this._seasonalKey="",this._seasonalGained=null,this._seasonalDrawing=!1,this._seasonalHelp=!1,this._seasonalMs=!1,this._seasonalClaiming=!1,this._boardHelp=!1,this._bingoHelp=!1,this._bingo=null,this._bingoKey="",this._bingoHit=null,this._bingoMarking=!1,this._bingoWon=0,this._bingoNews=null,this._board=null,this._boardKey="",this._boardRoll=null,this._boardRolling=!1,this._supply=null,this._supplyKey="",this._supplyHelp=!1,this._supplySeenSent=!1,this._newWorld=null,this._newWorldKey="",this._eventSlots=null,this._eventSlotsKey="",this._claimingNewWorld=!1,this._newWorldGained=null,this._achCat="campaign",this._achRev=0,this._achievements=null,this._achKey="",this._alerts=null,this._nextStepCtx=null,this._shopCat="key",this._shopRev=0,this._outfits=[],this._shelfKey="",this._vigorMenu=!1,this._boot="idle",this._bootError="",this._pick=null,this._pickOptions=null,this._pickRev=0,this._runs=[],this._runsRev=0,this._runsKey="",this._activeRunId=null,this._run=null,this._showRuns=!1,this._creatingNew=!1,this._bannerReady=!1,this._bannerState="idle",this._wallet=null,this._nodePay=null,this._storyNotice="",this._storyStarting=!1,this._rosterCount=0,this._artReady=!0,this._prologue=!1,this._unlocks={},this._unlockNews=[],this._prologueGift=null,this._claimingUnlock=!1,this._artState="idle",this._art={done:0,total:0,name:""},this._forge={done:0,total:0,name:""},this._forgeFailure=null,this._artBlocking=!1,this._plan=null,this._planState="idle",this._planChapter=1,this._preforge=null,this._preforgeRunning=null,this._preforgeRev=0,this._preforgeEpoch=0,this._preforgeAsked=new Set,this._forgeCleanup=null,this._roster=null,this._rosterState="idle",this._rosterCat="char",this._rosterRarity="all",this._rosterQuery="",this._rosterUnitId=null,this._rosterRev=0,this._unit=null,this._farmBusy=!1,this._farm=null,this._farmState="idle",this._farmView="root",this._farmRev=0,this._inventory=null,this._inventoryState="idle",this._invSection="relics",this._invView={slot:"all",rarity:"all",picked:"",feeding:null,gained:[]},this._invRev=0,this._invBusy=!1,this._result=null,this._busyLocal=new Map,this._busySeq=0,this._resultRev=0,this._growth=null,this._growthRev=0,this._feed=null,this._unitLevel=1,this._unitBond=0,this._unitState="idle",this._gearSlot=null,this._gearFeed=null,this._relics=null,this._relicsRev=0,this._feedBusy=!1,this._equipBusy=!1,this._unitTab="profile",this._outfitAt=0,this._outfitBusy=!1,this._outfitEditing=!1,this._outfitHistoryMax=6,this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev=0,this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonHistory=null,this._summonHistoryOpen=!1,this._summonHistoryState="idle",this._summonHistoryPage=1,this._summonArting=!1,this._summonResults=null,this._summonCleanup=null,this._formation=null,this._formationState="idle",this._formationBattleMode=!1,this._pendingCombat=null,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._combatNode=null,this._combatPreset=null,this._battleLoading=!1,this._combatCleanup=null,this._hudView="home",this._difficulty="normal",this._chapterProgress={normal:0,hard:0,veryhard:0},this._chaptersData=null,this._chaptersState="idle",this._beatState="idle",this._beat=null,this._beatCast=null,this._beatPlaces=null,this._beatCg=null,this._beatArt=null,this._activeStoryNode=null,this._beatRequested=!1,this._beatAt=0,this._beatStartAt=0,this._beatResumeAsk=0,this._beatCleanup=null,this._contextTokens=0,this._warnTokens=3e4,this._continuity=null,this._continuityState="idle",this._logShown=Rt,this._fold=null,this._merging=!1,this._foldBlocked=!1,this._compressing=null,this._settingsCategory=mt,this._settingsFrom="home",this._settingsRev=0}get capabilityProps(){return this._props}set capabilityProps(e){this._props=e&&typeof e=="object"?e:{},this._boot==="ready"&&this._refreshState(),this._apply()}static get observedAttributes(){return["view"]}attributeChangedCallback(){this._apply()}connectedCallback(){this.addEventListener("marinara-capability-props",this._onPropsChange),this._boot==="ready"&&this._resync(),this._apply()}disconnectedCallback(){this.removeEventListener("marinara-capability-props",this._onPropsChange),this._stopForge(),this._stopBeat(),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null),this._stopDiceClock&&(this._stopDiceClock(),this._stopDiceClock=null)}_reportError(e){let a=e instanceof Error?e.message:String(e);this.capabilityRuntimeError=a,this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:a}}))}_apply(){try{(this.getAttribute("view")||"browser")==="browser"?this._renderBrowser():this._root.innerHTML=""}catch(e){this._reportError(e)}}_adoptUnlocks(e){this._unlocks=e&&e.unlocks||{},this._unlockNews=Array.isArray(e&&e.unlockNews)?e.unlockNews:[],this._prologueGift=e&&e.prologueGift||null}_lockOf(e){return this._unlocks&&this._unlocks[e]||null}_currentUnlockNews(){let e=this._unlockNews[0];if(!e||!Va[e])return null;let a={key:e,...Va[e]};return a.gift&&this._prologueGift!=="ready"&&delete a.gift,a}_closeUnlockNews(e){if(!this._run||this._claimingUnlock)return;let a=this._currentUnlockNews(),r=!!(a&&a.key===e&&a.gift),s=()=>{this._claimingUnlock=!1,this._unlockNews=this._unlockNews.filter(n=>n!==e),this._postJson("/unlock/seen",{runId:this._run.runId,keys:[e]}).catch(()=>{}),this._renderBrowser()};if(!r){s();return}this._claimingUnlock=!0,this._postJson("/prologue-gift",{runId:this._run.runId}).then(n=>{n&&n.ok&&(this._prologueGift="claimed",n.wallet&&(this._wallet=n.wallet)),s()})}_state(){return this._boot!=="ready"?"boot":this._showRuns?"runs":this._bootError&&!this._creatingNew?"unreachable":this._creatingNew||!this._run?"setup":this._bannerReady?!this._artReady&&this._artBlocking?"art":this._hudView==="roster"?this._rosterUnitId?"unit":"roster":this._hudView==="summon"?"summon":this._hudView==="formation"?"formation":this._hudView==="combat"?"combat":this._hudView==="modes"?"modes":this._hudView==="chapters"?"chapters":this._hudView==="farm"?"farm":this._hudView==="inventory"?"inventory":this._hudView==="missions"?"achievements":this._hudView==="shop"?"shop":this._hudView==="settings"?"settings":this._hudView==="events"?"events":this._hudView==="result"&&this._result?"result":this._plan==null?"forge":this._beatState!=="idle"?"beat":this._hudView==="chapter"?"chapter":"hud":"banner"}_onLoaderScreen(e){return Jf.has(e)?!0:e==="beat"?this._beatState!=="ready":e==="combat"?this._combatPhase==="loading":!1}_chapterLabel(){return`Chapter ${ke(this._planChapter)} \xB7 ${this._plan&&this._plan.title||"Story"}`}_walletKey(){let e=this._wallet;return e?[e.aether,e.funds,e.vigor,e.vigorMax].join(","):""}_decorKey(){let e=this._run&&this._run.decor||null;return e?JSON.stringify(e):""}_pickKey(){return this._pick?[this._pick.slot,this._pick.source,this._pick.mode||"default",this._pick.page||1,this._pickRev].join("/"):""}_narrationScale(){let e=this._run||{};return ot(e.narrationScale==null?e.textScale:e.narrationScale)}_syncTypeScale(){let e=nt(this._run&&this._run.textScale),a=this._narrationScale();this._typeScale===e&&this._narrScale===a||(this._typeScale=e,this._narrScale=a,this.style&&typeof this.style.setProperty=="function"&&(this.style.setProperty("--gf-type-scale",String(e)),this.style.setProperty("--gf-narr-scale",String(a))))}async _setTextScale(e){if(!this._run)return;let a=nt(e),r=this._run.textScale;if(nt(r)===a)return;this._run.textScale=a,this._renderBrowser();let s=await this._postJson("/run/text-scale",{runId:this._run.runId,textScale:a});(!s||!s.ok)&&(this._run.textScale=r,this._renderBrowser())}async _setNarrationScale(e){if(!this._run)return;let a=ot(e),r=this._run.narrationScale;if(ot(r)===a)return;this._run.narrationScale=a,this._renderBrowser();let s=await this._postJson("/run/narration-scale",{runId:this._run.runId,narrationScale:a});(!s||!s.ok)&&(this._run.narrationScale=r,this._renderBrowser())}_renderBrowser(){this._syncTypeScale();let e=this._state();this._persistNav();let a=e==="hud"&&this._hudView==="home";a&&!this._wasHome&&this._boot==="ready"&&this._refreshStepData(),this._wasHome=a;let r=e==="runs"?`runs:${this._runsRev}:${this._activeRunId}`:e==="setup"?`setup:${this._creatingNew?"new":"first"}`:e==="banner"?`banner:${this._bannerState}:${this._forge.done}/${this._forge.total}:${this._forge.name}:${this._forgeFailure?`${this._forgeFailure.error}|${this._forgeFailure.detail}`:""}`:e==="art"?`art:${this._artState}:${this._art.done}/${this._art.total}:${this._art.name}`:e==="forge"?`forge:${this._planState==="error"?"error":"loading"}:${this._forgeFailure?`${this._forgeFailure.error}|${this._forgeFailure.detail}`:""}`:e==="beat"?`beat:${this._forgeFailure?`${this._forgeFailure.error}|${this._forgeFailure.detail}`:""}:${this._beatState}:${this._activeStoryNode?this._activeStoryNode.nodeIndex:0}:${this._activeStoryNode&&this._activeStoryNode.replay?"re":""}:${this._beatArt?`${this._beatArt.done}/${this._beatArt.total}:${this._beatArt.name}`:""}:${this._beatCg?`cg${this._beatCg.from}-${this._beatCg.to}:${this._beatCg.url?1:0}`:""}:${this._beatResumeAsk}:${this._beatStartAt}`:e==="modes"?`modes:${this._currentChapter()}:${this._homeNodesDone()}`:e==="chapters"?"chapters":e==="roster"?`roster:${this._rosterState}:${this._rosterCat}:${this._rosterRarity}:${this._rosterQuery}:${this._rosterRev}`:e==="summon"?`summon:${this._summonPhase}:${this._summonBannerId}:${this._summonBannerState}:${this._summonDetails?"d":""}:${this._summonHistoryOpen?"h":""}:${this._summonHistoryState}:${this._summonHistoryPage}:${this._summonHistory&&this._summonHistory.total||0}:${this._summonArting?"a":""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.title||""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.art||""}`:e==="formation"?`formation:${this._formationState}:${this._formationBattleMode?"battle":"hud"}`:e==="combat"?`combat:${this._combatPhase}:${this._combatNode?this._combatNode.combatIndex:0}:${this._combatNonce||0}:${this._combatVigorError?"nv":""}`:e==="unit"?`unit:${this._rosterUnitId}:${this._unitState}:${this._unitTab}:${this._growthRev}:${this._gearSlot||""}:${this._gearFeed?this._gearFeed.picked.join(",")+":"+this._relicsRev:""}:${this._portraitOpen?"pt":""}${this._portraitCrop?":crop":""}:${this._portraitRev}:${this._portraitBusy?"busy":""}:${this._portraitError?"err":""}${this._unitTab==="outfits"?`:of${this._outfitAt}${this._outfitBusy?":busy":""}${this._outfitEditing?":ed":""}`:""}:w${this._unit&&this._unit.wornOutfit||""}`:e==="chapter"?`chapter:${this._planChapter}:${this._difficulty}:${this._chapterProgress[this._difficulty]}:${this._chapterProgress.normal}:${this._nodePay?"pay":""}:${this._storyNotice}:pf${this._preforgeRev}${this._preforgeLocked()?":lk":""}${this._preforgeRunning===this._planChapter?":run":""}`:e==="farm"?`farm:${this._farmView}:${this._farmState}:${this._farmRev}`:e==="result"?`result:${this._resultRev}`:e==="settings"?`set:${this._settingsCategory}:${this._run.hudStyle||""}:${this._contextTokens}:${this._warnTokens}:${this._settingsRev}`:e==="events"?`ev:${this._eventId}:${this._passTab}:${this._eventsRev}:${JSON.stringify(this._eventAlerts||{})}:${this._boardKey}:${this._boardHelp?"bh":""}:${this._bingoKey}:${this._bingoHelp?"ch":""}:${this._bingoHit===null?"":this._bingoHit}:${this._bingoMarking?1:0}:${this._supplyKey}:${this._supplyHelp?"sh":""}:${this._boardRoll?this._boardRoll.state+this._boardRoll.face+"@"+this._boardRoll.at+":"+(this._boardRoll.step||0):""}:${this._boardRolling?1:0}`:e==="achievements"?`ach:${this._achCat}:${this._achRev}`:e==="shop"?`shop:${this._shopCat}:${this._wallet&&this._wallet.glimmer||0}:${this._shopRev}:${JSON.stringify(this._unlocks&&this._unlocks.outfits||null)}`:e==="inventory"?`inv:${this._invSection}:${this._inventoryState}:${this._invRev}:${this._invView.slot}:${this._invView.rarity}:${this._invView.picked}:${this._invView.feeding?this._invView.feeding.targetId+","+this._invView.feeding.picked.join("|"):""}`:e==="hud"?`hud:${this._currentChapter()}:${this._plan&&this._plan.title||""}:${this._homeNodesDone()}:${this._run.hudStyle||""}:${this._decorKey()}:${this._pickKey()}:${this._loginOpen?"ev"+this._eventsRev:""}:${this._contextTokens}/${this._warnTokens}:${JSON.stringify(this._alerts||{})}:${JSON.stringify(this._unlockNews||[])}:${JSON.stringify(this._unlocks||{})}:${this._prologueGift||""}:${JSON.stringify(this._nextStepCtx||{})}`:e,s=this._onLoaderScreen(e)?[]:this._busyTasks(),n=r+"|ts:"+(this._typeScale||1)+"|ns:"+(this._narrScale||1)+"|vm:"+(this._vigorMenu?"1":"0")+"|rl:"+(this._eventRelic?"1":"0")+"|bw:"+(this._bingoWon||0)+"|bn:"+(this._bingoNews?this._bingoNews.at||1:0)+"|sp:"+(this._seasonalMs?1:0)+(this._seasonalClaiming?"c":"")+"|cx:"+(this._forgeCancelAsking?"1":"0")+"|fa:"+(this._forgeAsked?"1":"0")+"|lg:"+(this._logShown||0)+"|busy:"+yl(s);if(this._syncBar(),Ze(this._root,this._contextTokens,this._warnTokens),this._drawnView==="browser"&&this._renderKey===n)return;let o=this._lastScreen!==e;this._entering=o;let i=!o&&this._drawnView==="browser";this._lastScreen=e,this._drawnView="browser",this._renderKey=n,this._stopForge(),this._stopBeat(),this._stopSummon(),this._stopCombat();let c="";if(e==="boot")c=`<style>${sc}</style><div class="gf-boot">Loading</div>`;else if(e==="unreachable"){let m=String(this._bootError||"").replace(/[&<>"]/g,L=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[L]);c=`<style>${sc}</style><div class="gf-boot gf-boot-bad"><span>Couldn&rsquo;t reach the game server &mdash; ${m}</span><button type="button" data-boot-retry>Retry</button></div>`}else if(e==="runs")c=`<style>${Yl}</style>${Kl({runs:this._runs,activeRunId:this._activeRunId})}`;else if(e==="setup")c=`<style>${Zn}</style>${eo({cancelable:this._creatingNew})}`;else if(e==="banner")c=`<style>${Ft}</style>${ga({mode:"banner",error:this._bannerState==="error",progress:this._forge,cancel:!0,confirming:this._forgeCancelAsking,failure:this._forgeFailure,paused:this._bannerState==="idle"&&!this._forgeAsked})}`;else if(e==="art")c=`<style>${Ft}</style>${ga({mode:"art",error:this._artState==="blocked",progress:this._art,cancel:!0,confirming:this._forgeCancelAsking})}`;else if(e==="roster")c=`<style>${Yr}</style>${yi({cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,state:this._rosterState,q:this._rosterQuery})}`;else if(e==="unit")this._portraitOpen?c=`<style>${Ei}</style>${Ai({unit:this._unit,view:this._portraitCrop?"crop":"edit",draft:this._portraitDraft,history:this._portrait&&this._portrait.strip||[],historyMax:this._portrait&&this._portrait.historyMax||0,busy:this._portraitBusy,error:this._portraitError,crop:this._portraitCrop,promptName:this._portrait&&this._portrait.promptName||""})}`:c=`<style>${Yr}</style>${ki({unit:this._unit,level:this._unit?this._unitLevel:1,bond:this._unit?this._unitBond:0,tab:this._unitTab,state:this._unitState,growth:this._growthView(),gear:this._growth&&this._growth.gear,gearSlot:this._gearSlot,gearFeed:this._gearFeedView(),facets:this._growth&&this._growth.facets,outfitAt:this._outfitAt,outfitBusy:this._outfitBusy,outfitEditing:this._outfitEditing,outfitHistoryMax:this._outfitHistoryMax})}`;else if(e==="summon")if(this._summonPhase==="reveal")c=`<style>${ds}</style>${Al({results:this._summonResults||[]})}`;else{let m=this._summonBanner;c=`<style>${ds}</style>${El({banners:m&&m.banners||[],banner:m&&m.banner,rates:m&&m.rates,pity:m&&m.pity,wallet:m&&m.wallet||this._wallet,cost:m&&m.cost||ta,bannerId:this._summonBannerId,state:this._summonBannerState,details:this._summonDetails,history:this._summonHistoryOpen?{state:this._summonHistoryState,...this._summonHistory||{}}:null,arting:this._summonArting})}`}else if(e==="formation")c=`<style>${Cl}</style>${Dl({state:this._formationState==="ready"?"ready":this._formationState==="error"?"error":"loading",data:this._formation,battleMode:this._formationBattleMode})}`;else if(e==="combat")c=`<style>${Ul}</style>${Wl({phase:this._combatPhase,payload:this._combat,node:this._combatNode,vigor:this._vigorView(),error:this._combatError||""})}`;else if(e==="forge")c=`<style>${Ft}</style>${ga({chapter:this._planChapter,error:this._planState==="error",cancel:this._prologue,confirming:this._forgeCancelAsking,failure:this._forgeFailure})}`;else if(e==="beat")c=this._beatState==="ready"?`<style>${Zl}</style>${tc({chapterLabel:this._chapterLabel(),nodeTitle:this._activeStoryNode&&this._activeStoryNode.title,segments:this._beat,cast:this._beatCast||[],background:this._nodeBackground(),places:this._beatPlaces,cg:this._beatCg,replay:!!(this._activeStoryNode&&this._activeStoryNode.replay),prologue:!!(this._activeStoryNode&&this._activeStoryNode.prologue)})}`:`<style>${Ft}</style>${_o({chapterTitle:this._plan&&this._plan.title,error:this._beatState==="error",prologue:!!(this._activeStoryNode&&this._activeStoryNode.prologue),art:this._beatArt,cancel:this._prologue,confirming:this._forgeCancelAsking,failure:this._forgeFailure})}`;else if(e==="modes"){let m=this._plan;c=`<style>${Ni}</style>${Ii({story:{hasPlan:!!m,title:m?m.title:"",blurb:Nr(m?{...m,cleared:this._homeNodesDone()>=10}:null),chapterLabel:`Chapter ${this._currentChapter()}`,done:this._homeNodesDone(),total:10}})}`}else e==="farm"?c=`<style>${Mi}</style>${Oi({view:this._farmView,data:this._farm,state:this._farmState})}`:e==="result"?c=`<style>${ul}</style>${vl(this._result||{})}`:e==="inventory"?c=`<style>${Hi}</style>${qi({section:this._invSection,data:this._inventory,view:this._invView,state:this._inventoryState})}`:e==="events"?c=`<style>${Yi}</style>${tl({eventId:this._eventId,view:this._eventId==="pass"?this._passViewOut():this._loginViewOut(),seasonal:this._seasonalViewOut(),board:this._boardViewOut(),roll:this._boardRoll,bingo:this._bingoViewOut(),bingoHit:this._bingoHit,supply:this._supplyViewOut(),newWorld:this._newWorldViewOut(),slots:this._eventSlots,from:"Home",passTab:this._passTab,alerts:this._eventAlerts})}`:e==="shop"?c=`<style>${hl}</style>${cl({wallet:this._wallet,cat:this._shopCat,from:"Home",outfits:this._outfits,locks:this._unlocks})}`:e==="achievements"?c=`<style>${il}</style>${nl({view:this._achievements,cat:this._achCat,from:"Home"})}`:e==="settings"?c=`<style>${go}</style>${uo({category:this._settingsCategory,backLabel:this._settingsBackLabel(),contextTokens:this._contextTokens,warnTokens:this._warnTokens,hudStyle:this._run.hudStyle,textScale:this._run.textScale,narrationScale:this._narrationScale(),tokenLog:this._tokenLog,loreStatus:this._loreStatus,run:this._run,helpOpen:this._helpOpen,logShown:this._logShown})}`:e==="chapters"?c=`<style>${Ao}</style>${To()}`:e==="chapter"?c=`<style>${Rn}</style>${Ln({plan:this._plan,difficulty:this._difficulty,progress:this._chapterProgress,chapterNumber:this._planChapter,pay:this._nodePay&&this._nodePay[this._difficulty],cp:this._chapterCp,notice:this._storyNotice,preforge:this._preforgeView()})}`:c=`<style>${bs}</style>${qn({plan:this._plan,chapterNumber:this._currentChapter(),nodesDone:this._homeNodesDone(),decor:this._run.decor,pick:this._pick,pickOptions:this._pickOptions,contextTokens:this._contextTokens,warnTokens:this._warnTokens,alerts:this._alerts,locks:this._unlocks,step:Gs(this._nextStepCtx)})}`+(this._loginOpen?`<style>${Gi}</style>${al({view:this._loginViewOut()})}`:"");let l=e==="combat"&&this._combatPhase!=="prebattle",d=!!this._run&&!l&&_s.has(e),h=d?As({username:this._run.username,wallet:this._wallet,account:this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:null}):"",v=d&&this._vigorMenu?Es({vigor:Number(this._wallet&&this._wallet.vigor||0),vigorMax:Number(this._wallet&&this._wallet.vigorMax||60),items:ea.filter(m=>m.grants&&m.grants.vigor).map(m=>({id:m.id,name:m.name,vigor:m.grants.vigor,held:Number(this._wallet&&this._wallet.keyItems&&this._wallet.keyItems[m.id]||0)}))}):"",u=this._run&&this._state()==="hud"?Un(this._currentUnlockNews()):"",g=this._seasonalHelp&&e==="events"&&this._eventId==="seasonal"?tr():"",y=this._boardHelp&&e==="events"&&this._eventId==="board"?dt({topics:hn(this._boardDays()),attr:"board-help"}):"",b=this._bingoHelp&&e==="events"&&this._eventId==="bingo"?dt({topics:mn(this._bingoDays()),attr:"bingo-help"}):"",x=this._supplyHelp&&e==="events"&&this._eventId==="supply"?dt({topics:_n(this._supplyDays(),this._supply&&this._supply.excluded),attr:"supply-help"}):"",E=this._bingoWon>0?dr(this._bingoWon):"",k=this._bingoNews?pr(this._bingoNews):"",S=this._seasonalMs&&this._seasonal&&e==="events"&&this._eventId==="seasonal"?Qa(this._seasonal):"",H=this._eventRelic?Xi(this._eventRelic):"",R=e==="beat"&&this._beatResumeAsk>0&&Array.isArray(this._beat)?Ql({at:this._beatResumeAsk,total:this._beat.length,title:this._activeStoryNode&&this._activeStoryNode.title||""}):"";this._root.innerHTML=`<style>${Ms}${wl}${zs}${jn}${Vi}${bn}${Qs}${kt}</style>`+Bs(c+xl(s),{runs:!!this._run&&e!=="runs",style:this._run&&this._run.hudStyle,entering:o,swapping:i,bar:h,overlay:v+g+y+b+x+E+k+S+u+H+R,help:this._helpOpen,logShown:this._logShown,onScreen:e==="settings"?this._settingsCategory:""}),d&&Rs(this._root),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null),d&&(this._stopVigorClock=Is(this._root,{nextMs:this._wallet?this._wallet.vigorNextMs:null,periodMs:this._wallet&&this._wallet.vigorPerMs||this._run&&this._run.vigorPerMs,onLanded:()=>this._refreshState&&this._refreshState()})),vo(this._root,{open:e==="settings",category:this._settingsCategory,run:this._run,onOpen:m=>this._openSettings(m),onBack:()=>this._leaveSettings(),onCategory:m=>this._openSettings(m),onStyle:m=>this._setHudStyle(m),onTextScale:m=>this._setTextScale(m),onNarrationScale:m=>this._setNarrationScale(m),onWarnTokens:m=>this._setWarnTokens(m),onSources:m=>this._setSources(m)}),Os(this._root,{onToggle:(m,L)=>{L?this._helpOpen.add(m):this._helpOpen.delete(m)}});for(let m of this._root.querySelectorAll("[data-log-more]"))m.addEventListener("click",()=>{this._logShown=(Number(this._logShown)||Rt)+Rt,this._renderBrowser()});Wn(this._root,{onOk:m=>this._closeUnlockNews(m)}),Ji(this._root,{onClose:()=>{this._eventRelic=null,this._eventsRev+=1,this._renderBrowser()}}),hr(this._root,{onClose:()=>{this._bingoWon=0,this._renderBrowser()}}),fr(this._root,{onClose:()=>this._bingoNewsSeen()}),er(this._root,{onClaim:m=>this._seasonalMilestone(m),onClose:()=>{this._seasonalMs=!1,this._renderBrowser()}}),Ts(this._root,{onToggle:()=>{this._vigorMenu=!this._vigorMenu,this._renderBrowser()},onClose:()=>{this._vigorMenu=!1,this._renderBrowser()},onUse:m=>this._useItem(m)}),this._wireFullscreen(),this._wireRunsButton();{let m=this._root.querySelector("[data-boot-retry]");m&&m.addEventListener("click",()=>{this._boot="idle",this._loadState(),this._renderBrowser()})}if(e==="runs")this._wireRuns();else if(e==="setup")ao(this._root,{onCreate:m=>this._createRun(m),onCancel:()=>{this._creatingNew=!1,this._renderBrowser()}});else if(e==="banner"){let m=this._bannerState==="error";this._forgeCleanup=gt(this._root,{cycle:!1,phases:Tr,onRetry:()=>{this._forgeAsked=!0,this._loadStandardBanner()},...this._forgeCancelWiring()}),this._bannerState==="idle"&&this._forgeAsked&&this._loadStandardBanner()}else if(e==="art")this._forgeCleanup=gt(this._root,{cycle:!1,onRetry:()=>this._finishArt(),...this._forgeCancelWiring()}),this._ensureArtRunning();else if(e==="roster")_i(this._root,{onOpenUnit:m=>this._openUnit(m),onBack:()=>{this._hudView="home",this._renderBrowser()},onCat:m=>{this._rosterCat=m==="wpn"?"wpn":"char",this._renderBrowser()},onRarity:m=>{this._rosterRarity=m,this._renderBrowser()},onSearch:m=>{this._rosterQuery=m,bi(this._root,{cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,q:m,state:this._rosterState})}}),this._rosterState==="idle"&&this._loadRoster();else if(e==="unit"&&this._portraitOpen)Ti(this._root,{onBack:()=>this._portraitClose(),onDraft:m=>this._portraitEdit(m),onGenerate:()=>this._portraitGenerate(),onPick:m=>this._portraitPick(m),onFile:m=>this._portraitFile(m),onCropSize:m=>this._portraitSize(m),onCropFrame:m=>this._portraitDrag(m),onCropOk:()=>this._portraitUpload(),onCropCancel:()=>{this._portraitCrop=null,this._renderBrowser()}});else if(e==="unit")fi(this._root,{onStep:m=>this._stepOutfit(m),onWear:m=>this._wearOutfit(m),onEdit:()=>{this._outfitEditing=!this._outfitEditing,this._renderBrowser()},onRedo:m=>this._redoOutfit(m),onRestore:m=>this._restoreOutfit(m)}),Si(this._root,{onTab:m=>{this._unitTab=m,m==="outfits"&&(this._outfitAt=wt(this._unit).at),this._renderBrowser()},onFeed:m=>this._feedAdd(m),onFeedReset:()=>this._feedReset(),onFeedGo:()=>this._feedCommit(),onAscend:()=>this._ascend(),onFormUp:m=>this._formUp(m),onBack:()=>{this._rosterUnitId=null,this._unit=null,this._unitState="idle",this._gearSlot=null,this._loadRoster()},onSetParty:()=>this._openFormation(),onPortrait:()=>this._portraitOpenStudio(),onGearSlot:m=>{this._gearSlot=m,this._renderBrowser()},onGearBack:()=>{this._gearSlot=null,this._gearFeed=null,this._renderBrowser()},onEquip:m=>this._equip(m),onOpenWeapon:m=>this._openUnit(m,"growth"),onRelicFeed:m=>this._relicFeed(m)}),this._unitState==="idle"&&this._loadUnit();else if(e==="summon")this._summonPhase==="reveal"?this._summonCleanup=Nl(this._root,{results:this._summonResults||[],onContinue:()=>{this._summonPhase="banner",this._renderBrowser()}}):(Tl(this._root,{banners:this._summonBanner&&this._summonBanner.banners||[],onBanner:m=>{m!==this._summonBannerId&&(this._summonBannerId=m,this._summonDetails=!1,this._summonArting=!1,this._summonBannerState="idle",this._summonBanner=null,this._closeSummonHistory(),this._renderBrowser())},onDetails:m=>{this._summonDetails=!!m,m&&this._closeSummonHistory(),this._renderBrowser()},onHistory:m=>{if(!m){this._closeSummonHistory(),this._renderBrowser();return}this._summonDetails=!1,this._summonHistoryOpen=!0,this._loadSummonHistory(1)},onHistoryPage:m=>this._loadSummonHistory(m),onRedoArt:()=>this._redoBannerArt(),onPull:m=>this._summonPull(m),onBack:()=>{this._hudView="home",this._renderBrowser()}}),this._summonBannerState==="idle"&&this._loadSummonBanner());else if(e==="formation")ql(this._root,{data:this._formationState==="ready"?this._formation:null,onSave:(m,L)=>this._saveFormation(m,L),onBack:()=>{if(this._formationBattleMode){let m=!!(this._pendingCombat&&this._pendingCombat.farm),L=!!(this._pendingCombat&&this._pendingCombat.stage==="seasonal");this._formationBattleMode=!1,this._pendingCombat=null,m?(this._farmBusy=!1,this._pendingFarm=null,this._hudView=L?"events":"farm"):this._hudView="chapter"}else this._hudView="home";this._renderBrowser()},onIntoBattle:()=>this._enterBattle(),onRetry:()=>this._loadFormation()}),this._formationState==="idle"&&this._loadFormation();else if(e==="combat")this._combatCleanup=Gl(this._root,{phase:this._combatPhase,steps:this._combatSteps||[],onStart:()=>this._startBattle(),onPickPreset:m=>this._pickCombatPreset(m),onRetry:()=>this._loadBattle(),onBack:()=>this._exitCombat(!1),onFinished:m=>this._combatFinished(m)}),this._combatPhase==="loading"&&this._loadBattle();else if(e==="forge"){let m=this._planState==="error";this._forgeCleanup=gt(this._root,{cycle:!m,onRetry:()=>this._loadChapterPlan(),...this._forgeCancelWiring()}),this._planState==="idle"&&this._loadChapterPlan()}else e==="beat"?this._beatState==="loading"?(this._forgeCleanup=gt(this._root,{cycle:!1,...this._forgeCancelWiring()}),this._beatRequested||(this._beatRequested=!0,this._loadBeat())):this._beatState==="error"?this._forgeCleanup=gt(this._root,{cycle:!1,onRetry:()=>this._retryBeat(),...this._forgeCancelWiring()}):(this._beatResumeAsk>0&&ec(this._root,{onResume:()=>{this._beatStartAt=this._beatResumeAsk,this._beatResumeAsk=0,this._renderBrowser()},onRestart:()=>{this._beatStartAt=0,this._beatResumeAsk=0,this._markBeatAt(0),this._renderBrowser()}}),this._beatCleanup=ac(this._root,{startAt:this._beatStartAt,onAt:m=>{this._beatAt=m},segments:this._beat,cast:this._beatCast||[],places:this._beatPlaces,cg:this._beatCg,background:this._nodeBackground(),onContinue:()=>this._activeStoryNode&&this._activeStoryNode.replay?this._exitStoryBeat():this._completeStoryBeat(),onExit:()=>this._exitStoryBeat()})):e==="modes"?Ri(this._root,{onPick:m=>{if(m==="materials"){this._openFarm();return}m==="story"&&(this._hudView="chapters",this._renderBrowser())},onBack:()=>{this._hudView="home",this._renderBrowser()}}):e==="farm"?(Bi(this._root,{onBack:()=>{if(this._farmView!=="root"){this._farmView="root",this._renderBrowser();return}this._hudView="modes",this._renderBrowser()},onOpen:m=>{this._farmView=m==="form"?"form":"asc",this._renderBrowser()},onRun:m=>this._farmRun(m)}),this._farmState==="idle"&&this._loadFarm()):e==="result"?ml(this._root,{onContinue:()=>this._closeResult(),onAgain:()=>this._resultAgain()}):e==="inventory"?($i(this._root,{onBack:()=>{if(this._invView.feeding){this._invView.feeding=null,this._renderBrowser();return}this._hudView="home",this._renderBrowser()},onSection:m=>{this._invSection!==m&&(this._invSection=m,this._invView={...this._invView,feeding:null,gained:[]},this._renderBrowser())},onFilter:(m,L)=>{this._invView={...this._invView,[m]:L},this._renderBrowser()},onPick:m=>{this._invView={...this._invView,picked:m,gained:[]},this._renderBrowser()},onLock:m=>this._relicLock(m),onUpgrade:m=>{this._invView={...this._invView,picked:m,gained:[],feeding:{targetId:m,picked:[]}},this._renderBrowser()},onFeedPick:m=>{let L=this._invView.feeding;if(!L)return;let F=L.picked.indexOf(m)>=0?L.picked.filter(J=>J!==m):L.picked.concat([m]);this._invView={...this._invView,feeding:{...L,picked:F}},this._renderBrowser()},onFeedGo:()=>this._relicFeedFromInventory(),onFeedCancel:()=>{this._invView={...this._invView,feeding:null},this._renderBrowser()},onUseItem:m=>this._useItem(m)}),this._inventoryState==="idle"&&this._loadInventory()):e==="events"?(this._stopDiceClock&&(this._stopDiceClock(),this._stopDiceClock=null),this._stopDiceClock=rl(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},slots:this._eventSlots,onPick:m=>{this._eventId!==m&&(this._eventId=m,this._eventGained=null,this._eventRelic=null,this._seasonalGained=null,this._seasonalHelp=!1,this._boardHelp=!1,this._bingoHelp=!1,this._supplyHelp=!1,this._newWorldGained=null,this._eventsRev+=1,this._renderBrowser())},onClaim:()=>this._eventId==="pass"?this._claimPass():this._claimLogin(),onTab:m=>{this._passTab!==m&&(this._passTab=m,this._renderBrowser())},onReroll:m=>this._rerollMission(m),onSeasonalFight:m=>this._seasonalRun(m),onSeasonalDraw:()=>this._seasonalDraw(),onSeasonalDrawMany:()=>this._seasonalDraw(ze),onSeasonalMilestones:()=>{this._seasonalMs=!0,this._renderBrowser()},onBoardRoll:()=>this._boardRollOnce(),boardNextMs:this._board&&Number.isFinite(this._board.nextInMs)?this._board.nextInMs:null,onDiceLanded:()=>this._refreshState(),onNewWorldClaim:()=>this._claimNewWorld(),onSeasonalHelp:()=>{this._seasonalHelp=!this._seasonalHelp,this._eventsRev+=1,this._renderBrowser()},onBoardHelp:()=>{this._boardHelp=!this._boardHelp,this._renderBrowser()},onBingoHelp:()=>{this._bingoHelp=!this._bingoHelp,this._renderBrowser()},onBingoMark:()=>this._bingoMarkOnce(),onSupplyHelp:()=>{this._supplyHelp=!this._supplyHelp,this._renderBrowser()},onSupplyGo:()=>this._openFarm()}),this._eventId==="supply"&&this._supplySeenOnce(),this._entering&&this._refreshState()):e==="shop"?(dl(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},onPick:m=>{this._shopCat!==m&&(this._shopCat=m,this._renderBrowser())},onBuy:m=>this._buyShop(m),onBuyOutfit:m=>this._buyOutfit(m)}),this._entering&&this._refreshState()):e==="achievements"?(ol(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},onPick:m=>{this._achCat!==m&&(this._achCat=m,this._renderBrowser())},onClaim:m=>this._claimAchievement(m),onClaimAll:()=>this._claimAchievement(null)}),this._entering&&this._refreshState()):e==="chapters"?this._wireChapters():e==="chapter"?this._wireChapter():e==="hud"&&($n(this._root,{onOpenModes:()=>{this._hudView="modes",this._renderBrowser()},onOpenRoster:()=>this._openRoster(),onOpenSummon:()=>this._openSummon(),onOpenFormation:()=>this._openFormation(),onOpenInventory:()=>this._openInventory(),onOpenShop:()=>{this._hudView="shop",this._renderBrowser()},onOpenMissions:()=>{this._hudView="missions",this._renderBrowser()},onOpenEvents:()=>{this._hudView="events",this._renderBrowser()},onPickOpen:m=>this._openPick(m),onPickClose:()=>this._closePick(),onPickSource:m=>this._pickSource(m),onPickTake:m=>this._takePick(m),onPickMode:m=>this._pickMode(m),onPickPage:m=>this._pickPage(m)}),this._loginOpen&&sl(this._root,{onClose:()=>{this._loginOpen=!1,this._loginSeen=!0,this._renderBrowser()},onClaim:()=>this._claimLogin()}));e==="settings"&&this._settingsCategory==="continuity"&&this._continuity&&this._fillContinuity(),this._boot==="idle"&&this._loadState(),this._ensureArtRunning()}async _setHudStyle(e){if(!this._run||!this._run.runId)return;let a=this._run.hudStyle;this._run.hudStyle=e,this._renderBrowser();let r=await this._postJson("/run/style",{runId:this._run.runId,hudStyle:e});r&&r.ok||(this._run.hudStyle=a,this._renderBrowser())}_currentChapterOf(e){let a=e&&e.progress||{},r=0;for(let s of Object.keys(a)){let n=Number(s);Number.isInteger(n)&&n>r&&(r=n)}return Math.max(1,r)}_currentChapter(){let e=this._run&&this._run.progress||{},a=0;for(let r of Object.keys(e)){let s=Number(r);Number.isInteger(s)&&s>a&&(a=s)}return Math.max(1,a,Number(this._planChapter)||1)}_homeNodesDone(){let a=(this._run&&this._run.progress||{})[String(this._currentChapter())]||{};return Number(a.normal)||0}_wireFullscreen(){let e=()=>{document.fullscreenElement?document.exitFullscreen?.():this.requestFullscreen?.()};for(let a of[".gf-fs",".gf-fs-exit",".gf-fs-bar"]){let r=this._root.querySelector(a);r&&r.addEventListener("click",e)}this._wireLandscape()}_wireLandscape(){let e=this._root.querySelector("[data-go-landscape]");e&&e.addEventListener("click",async()=>{try{!document.fullscreenElement&&this.requestFullscreen&&await this.requestFullscreen()}catch{}let a=typeof screen<"u"?screen.orientation:null;if(!a||typeof a.lock!="function"){this._landscapeFallback();return}try{await a.lock("landscape")}catch{this._landscapeFallback()}})}_landscapeFallback(){let e=this._root.querySelector("[data-rot-title]"),a=this._root.querySelector("[data-rot-note]");e&&(e.textContent="Turn your phone"),a&&(a.textContent="This game plays in a 16:9 landscape frame. Your browser cannot rotate it for you.")}_wireRunsButton(){let e=[];for(let a of["[data-open-runs]",".gf-runs-bar"]){let r=this._root.querySelector(a);!r||e.indexOf(r)>=0||(e.push(r),r.addEventListener("click",()=>{this._showRuns=!0,this._renderBrowser(),this._refreshState()}))}}_adoptRun(e){this._stopSummon(),this._stopCombat();let a={_boot:this._boot,_bootError:this._bootError,_runs:this._runs,_activeRunId:this._activeRunId,_busyLocal:this._busyLocal,_busySeq:this._busySeq};this._initState(),Object.assign(this,a),this._run=e||null,this._activeRunId=e?e.runId:null,this._creatingNew=!1,this._planChapter=this._currentChapterOf(e),this._hudView="home",this._bannerReady=!!(e&&e.hasStandardBanner),this._artReady=!(e&&Number(e.artPending)>0),this._prologue=!!(e&&e.prologuePending),this._adoptUnlocks(e),this._wallet=e&&e.wallet||null,this._adoptShelf(e&&e.outfits),this._rosterCount=e&&Number(e.rosterCount)||0,this._warnTokens=e&&Number(e.warnTokens)||3e4}_adoptRuns(e){let a=Array.isArray(e)?e:[],r=JSON.stringify(a.map(s=>[s.runId,s.name,s.scenario,s.progress]));if(r===this._runsKey){this._runs=a;return}this._runsKey=r,this._runs=a,this._runsRev+=1}_adoptGlobals(e){if(!e)return;e.nodePay&&(this._nodePay=e.nodePay);let a=e.achievements||e.activeRun&&e.activeRun.achievements||null;if(a){let d=JSON.stringify(a);d!==this._achKey&&(this._achKey=d,this._achievements=a,this._achRev+=1)}let r=e.alerts||e.activeRun&&e.activeRun.alerts||null;r&&(this._alerts=r);let s=e.nextStepCtx!==void 0?e.nextStepCtx:e.activeRun?e.activeRun.nextStepCtx:void 0;s!==void 0&&(this._nextStepCtx=s);let o=e.events||e.activeRun&&e.activeRun.events||(e.pass||e.seasonal||e.newworld?{pass:e.pass,seasonal:e.seasonal,newworld:e.newworld}:null);if(!o)return;if(o.alerts&&(this._eventAlerts=o.alerts),o.pass){let d=JSON.stringify(o.pass);d!==this._passKey&&(this._passKey=d,this._pass=o.pass,this._eventsRev+=1)}if(o.board!==void 0&&!this._boardRolling){let d=lr(o.board);d!==this._boardKey&&(this._boardKey=d,this._board=o.board||null)}if(o.bingo!==void 0&&!this._bingoMarking){let d=cr(o.bingo);d!==this._bingoKey&&(this._bingoKey=d,this._bingo=o.bingo||null)}if(o.bingoNews!==void 0&&(this._bingoNews=o.bingoNews||null),o.supply!==void 0){let d=xn(o.supply);d!==this._supplyKey&&(this._supplyKey=d,this._supply=o.supply||null)}if(o.seasonal){let d=JSON.stringify(o.seasonal);d!==this._seasonalKey&&(this._seasonalKey=d,this._seasonal=o.seasonal,this._eventsRev+=1)}if(Array.isArray(o.slots)&&o.slots.length){let d=JSON.stringify(o.slots);d!==this._eventSlotsKey&&(this._eventSlotsKey=d,this._eventSlots=o.slots,this._eventsRev+=1)}if(o.newworld){let d=JSON.stringify(o.newworld);d!==this._newWorldKey&&(this._newWorldKey=d,this._newWorld=o.newworld,this._eventsRev+=1)}if(!o.login)return;let i=JSON.stringify(o.login);if(i===this._loginKey)return;this._loginKey=i,this._login=o.login,this._eventsRev+=1;let c=e.activeRun&&e.activeRun.unlocks?e.activeRun.unlocks.events:e.unlocks?e.unlocks.events:void 0,l=c!==void 0?!!c:!!this._lockOf("events");this._login.ready&&!this._loginSeen&&!l&&(this._loginOpen=!0)}_loginViewOut(){return this._login?this._eventGained?{...this._login,gained:this._eventGained}:this._login:null}_passViewOut(){return this._pass?this._eventGained?{...this._pass,gained:this._eventGained}:this._pass:null}_boardViewOut(){return this._board?this._boardHelp?{...this._board,help:!0}:this._board:null}_bingoViewOut(){return this._bingo?this._bingoHelp?{...this._bingo,help:!0}:this._bingo:null}_supplyViewOut(){return this._supply?this._supplyHelp?{...this._supply,help:!0}:this._supply:null}_supplyDays(){let e=(Array.isArray(this._eventSlots)?this._eventSlots:[]).find(a=>a&&a.id==="supply");return e&&Number.isFinite(Number(e.days))?Number(e.days):0}_supplySeenOnce(){!this._supply||this._supply.seen||this._supplySeenSent||!this._run||(this._supplySeenSent=!0,this._postJson("/mini/supply/seen",{runId:this._activeRunId}).then(e=>{e&&e.ok&&this._adoptFromResponse(e)}).finally(()=>{this._supplySeenSent=!1,this._renderBrowser()}))}_bingoDays(){let e=(Array.isArray(this._eventSlots)?this._eventSlots:[]).find(a=>a&&a.id==="bingo");return e&&Number.isFinite(Number(e.days))?Number(e.days):0}_bingoMarkOnce(){this._bingoMarking||(this._bingoMarking=!0,this._renderBrowser(),this._postJson("/mini/bingo/mark",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._bingo=e.bingo||this._bingo,this._bingoKey=cr(this._bingo),this._bingoHit=Number.isFinite(Number(e.at))?Math.round(Number(e.at)):null,this._eventGained=Array.isArray(e.gained)?e.gained:null,Number(e.won)>0&&(this._bingoWon=Math.round(Number(e.won))),e.wallet&&(this._wallet=e.wallet),this._adoptGlobals(e))}).finally(()=>{this._bingoMarking=!1,this._renderBrowser(),setTimeout(()=>{this._bingoHit=null,this._renderBrowser()},900)}))}_bingoNewsSeen(){this._bingoNews&&(this._bingoNews=null,this._postJson("/mini/bingo/seen",{runId:this._activeRunId}).catch(()=>{}),this._renderBrowser())}_boardDays(){let e=(Array.isArray(this._eventSlots)?this._eventSlots:[]).find(a=>a&&a.id==="board");return e&&Number.isFinite(Number(e.days))?Number(e.days):0}_seasonalViewOut(){if(!this._seasonal)return null;let e=this._seasonalGained?{...this._seasonal,gained:this._seasonalGained}:this._seasonal;return this._seasonalHelp?{...e,help:!0}:e}_claimPass(){this._claimingLogin||(this._claimingLogin=!0,this._postJson("/pass/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._eventGained=Array.isArray(e.gained)?e.gained:null,this._eventRelic=e.relic||null,this._eventsRev+=1)}).catch(()=>{}).then(()=>{this._claimingLogin=!1,this._renderBrowser()}))}_claimAchievement(e){if(this._claimingAch)return;this._claimingAch=!0;let a={runId:this._activeRunId};e&&(a.stepId=e),this._postJson("/achievements/claim",a).catch(()=>{}).then(()=>{this._claimingAch=!1,this._renderBrowser()})}_useItem(e){!e||this._usingItem||(this._usingItem=!0,this._postJson("/item/use",{runId:this._activeRunId,itemId:e}).then(a=>{a&&a.ok&&(this._vigorMenu=!1,this._invRev+=1,this._shopRev+=1)}).catch(()=>{}).then(()=>{this._usingItem=!1,this._renderBrowser(),this._loadInventory()}))}_buyShop(e){!e||this._buying||(this._buying=!0,this._postJson("/shop/buy",{runId:this._activeRunId,itemId:e}).then(a=>{a&&a.ok&&(this._shopRev+=1)}).catch(()=>{}).then(()=>{this._buying=!1,this._renderBrowser()}))}_adoptShelf(e){let a=Array.isArray(e)?e:[],r=JSON.stringify(a.map(s=>[s&&s.id,s&&s.url,!!(s&&s.owned)]));r!==this._shelfKey&&(this._shelfKey=r,this._outfits=a,this._shopRev+=1)}_buyOutfit(e){!e||this._buying||(this._buying=!0,this._postJson("/shop/buy-outfit",{runId:this._activeRunId,outfitId:e}).then(a=>{a&&a.ok&&(a.wallet&&(this._wallet=a.wallet),Array.isArray(a.outfits)&&this._adoptShelf(a.outfits),this._shopRev+=1)}).catch(()=>{}).then(()=>{this._buying=!1,this._renderBrowser()}))}_stepOutfit(e){let a=wt(this._unit).slots.length;a<2||(this._outfitAt=(this._outfitAt+e+a)%a,this._outfitEditing=!1,this._renderBrowser())}_wearOutfit(e){this._outfitBusy||!this._rosterUnitId||(this._outfitBusy=!0,this._renderBrowser(),this._postJson("/outfit/wear",{runId:this._activeRunId,unitId:this._rosterUnitId,outfitId:e||""}).then(a=>{a&&a.ok&&this._unit&&(this._unit={...this._unit,wornOutfit:a.wornOutfit||""},this._refreshState())}).catch(()=>{}).then(()=>{this._outfitBusy=!1,this._renderBrowser()}))}_redoOutfit(e){let r=wt(this._unit).slots[this._outfitAt];!r||r.base||this._outfitBusy||!this._rosterUnitId||(this._outfitBusy=!0,this._renderBrowser(),this._postJson("/outfit/redo",{runId:this._activeRunId,unitId:this._rosterUnitId,outfitId:r.id,prompt:e&&e.prompt||"",tags:e&&e.tags||[]}).then(s=>this._adoptOutfits(s)).catch(()=>{}).then(()=>{this._outfitBusy=!1,this._renderBrowser()}))}_restoreOutfit(e){let r=wt(this._unit).slots[this._outfitAt];!r||r.base||!e||this._outfitBusy||!this._rosterUnitId||(this._outfitBusy=!0,this._renderBrowser(),this._postJson("/outfit/restore",{runId:this._activeRunId,unitId:this._rosterUnitId,outfitId:r.id,url:e}).then(s=>this._adoptOutfits(s)).catch(()=>{}).then(()=>{this._outfitBusy=!1,this._renderBrowser()}))}_adoptOutfits(e){!e||!this._unit||(Array.isArray(e.outfits)&&(this._unit={...this._unit,outfits:e.outfits}),Number(e.historyMax)>0&&(this._outfitHistoryMax=Number(e.historyMax)),e.ok&&this._refreshState())}_rerollMission(e){!e||this._rerolling||(this._rerolling=!0,this._postJson("/pass/reroll",{runId:this._activeRunId,missionId:e}).then(()=>{this._eventsRev+=1}).catch(()=>{}).then(()=>{this._rerolling=!1,this._renderBrowser()}))}_claimLogin(){this._claimingLogin||(this._claimingLogin=!0,this._postJson("/events/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._eventGained=Array.isArray(e.gained)?e.gained:null,this._eventRelic=e.relic||null,this._eventsRev+=1)}).catch(()=>{}).then(()=>{this._claimingLogin=!1,this._renderBrowser()}))}_loadState(){this._boot="loading",this._bootError="",ge(`${Fa}/state`).then(e=>{if(!e)throw new Error("no response");if(!e.ok)throw new Error("HTTP "+e.status);return typeof e.json=="function"?e.json():null}).then(e=>{this._adoptRuns(e&&e.runs),this._activeRunId=e&&e.activeRunId||null,this._run=e&&e.activeRun||null,this._adoptGlobals(e),this._run&&Number.isFinite(Number(this._run.contextTokens))&&(this._contextTokens=Number(this._run.contextTokens)||0),this._warnTokens=this._run&&Number(this._run.warnTokens)||3e4,this._bannerReady=!!(this._run&&this._run.hasStandardBanner),this._artReady=!(this._run&&Number(this._run.artPending)>0),this._prologue=!!(this._run&&this._run.prologuePending),this._adoptUnlocks(this._run),this._wallet=this._run&&this._run.wallet||null,this._run&&Array.isArray(this._run.outfits)&&this._adoptShelf(this._run.outfits),this._rosterCount=this._run&&Number(this._run.rosterCount)||0}).catch(e=>{this._run=null,this._bootError=String(e&&e.message||"unreachable")}).then(()=>{this._run&&(this._restoreNav(),this._reconcileGenerating({boot:!0})),this._boot="ready",this._renderBrowser()})}_navKey(){return`gacha-forge:nav:${this._run?this._run.runId:"none"}`}_persistNav(){if(!(!this._run||this._boot!=="ready"))try{if(typeof localStorage>"u")return;localStorage.setItem(this._navKey(),JSON.stringify({v:this._hudView,ch:this._planChapter,combat:this._combatNode}))}catch{}}_restoreNav(){let e=null;try{if(typeof localStorage>"u")return;let a=localStorage.getItem(this._navKey());a&&(e=JSON.parse(a))}catch{return}!e||typeof e!="object"||(Number.isInteger(e.ch)&&e.ch>=1&&(this._planChapter=e.ch),["chapters","chapter","roster","summon","formation","inventory","settings","events"].includes(e.v)?this._hudView=e.v:e.v==="farm"&&(this._hudView="farm"),e.v==="combat"&&e.combat&&(typeof e.combat.combatIndex=="number"||e.combat.farm)&&(this._combatNode=e.combat,this._hudView="combat",this._combatPhase="loading"))}_resync(){this._renderKey=null,this._bannerState==="loading"&&(this._bannerState="idle"),this._planState==="loading"&&(this._planState="idle"),this._summonBannerState==="loading"&&(this._summonBannerState="idle"),this._formationState==="loading"&&(this._formationState="idle"),this._rosterState==="loading"&&(this._rosterState="idle"),this._farmState==="loading"&&(this._farmState="idle"),this._inventoryState==="loading"&&(this._inventoryState="idle"),this._unitState==="loading"&&(this._unitState="idle"),this._continuityState==="loading"&&(this._continuityState="idle"),this._tokenLog&&this._tokenLog.status==="loading"&&(this._tokenLog={...this._tokenLog,status:"idle"}),this._beatState==="loading"&&(this._beatRequested=!1),this._combatPhase==="loading"&&(this._combatPhase="loading"),this._refreshState()}_refreshStepData(){this._stepRefreshing||(this._stepRefreshing=!0,ge(`${Fa}/state`).then(e=>e&&typeof e.json=="function"?e.json():null).then(e=>{!e||!e.activeRun||(this._adoptGlobals(e),this._adoptUnlocks(e.activeRun))}).catch(()=>{}).then(()=>{this._stepRefreshing=!1,this._renderBrowser()}))}_refreshState(){this._refreshing||(this._refreshing=!0,ge(`${Fa}/state`).then(e=>e&&typeof e.json=="function"?e.json():null).then(e=>{e&&(Array.isArray(e.runs)&&this._adoptRuns(e.runs),this._activeRunId=e.activeRunId||this._activeRunId,this._adoptGlobals(e),e.activeRun&&(this._run=e.activeRun,this._bannerReady=!!e.activeRun.hasStandardBanner,this._artState==="idle"&&(this._artReady=!(Number(e.activeRun.artPending)>0)),e.activeRun.prologuePending||(this._prologue=!1),this._adoptUnlocks(e.activeRun),this._wallet=e.activeRun.wallet||this._wallet,Array.isArray(e.activeRun.outfits)&&this._adoptShelf(e.activeRun.outfits),this._rosterCount=Number(e.activeRun.rosterCount)||this._rosterCount))}).catch(()=>{}).then(()=>{this._refreshing=!1,this._renderBrowser()}))}_reconcileGenerating({boot:e=!1}={}){if(!e)return;let a=this._run&&Array.isArray(this._run.generating)?this._run.generating:[];if(!a.length)return;let r=this._run.runId,s=d=>a.find(h=>typeof h=="string"&&h.startsWith(`${r}:${d}`)),n=s("chapter:"),o=s("combat:");if(n||o){let d=Number(n?n.split(":").pop():o.split(":")[2]);if(Number.isInteger(d)&&d>=1){this._planChapter=d,this._plan=null,this._planState="idle",this._hudView=this._hudView==="chapter"?"chapter":"home";return}}let i=s("banner:wpn:"),c=s("banner:char:");if(i||c){this._hudView="summon",this._summonPhase="banner",this._summonBannerId=i?"wpn-featured":"char-featured",this._summonBanner=null,this._summonBannerState="idle";return}let l=s("beat:");if(l){let d=l.split(":"),h=Number(d[2]),v=Number(d[3]);if(Number.isInteger(h)&&h>=1&&Number.isInteger(v)&&v>=0){this._planChapter=h,this._hudView="chapter";let u=this._run.progress&&this._run.progress[String(h)]||{};this._chapterProgress={normal:u.normal||0,hard:u.hard||0,veryhard:u.veryhard||0},this._activeStoryNode={chapter:h,difficulty:this._difficulty,nodeIndex:this._chapterProgress[this._difficulty]||0,storyIndex:v,title:"Story",restored:!0},this._beat=null,this._beatCast=null,this._beatState="loading",this._beatRequested=!1}}}_postJson(e,a){let r=gl(e),s=r?this._busyStart(r):0;return ge(`${Fa}${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}).then(n=>n&&typeof n.json=="function"?n.json():null).catch(()=>null).then(n=>(this._adoptFromResponse(n),s&&this._busyEnd(s),s&&this._run&&Array.isArray(this._run.generating)&&this._run.generating.length&&this._refreshState(),n))}_adoptFromResponse(e){if(!e||typeof e!="object")return;if(this._adoptGlobals(e),e.wallet&&typeof e.wallet=="object"&&(this._wallet={...this._wallet||{},...e.wallet}),e.account&&typeof e.account=="object"&&this._run){let n=this._run.account||null,o=e.account;(!n||n.level!==o.level||n.xp!==o.xp||n.xpNeeded!==o.xpNeeded)&&(this._run={...this._run,account:{...n,...o}})}this._syncBar();let a=typeof e.unitId=="string"?e.unitId:"",r=typeof e.portrait=="string"?e.portrait:"",s=this._run&&this._run.decor;a&&r&&s&&s.unit&&s.unit.id===a&&s.unit.portrait!==r&&(this._run={...this._run,decor:{...s,unit:{...s.unit,portrait:r}}})}_syncBar(){Ns(this._root,{wallet:this._wallet,account:this._run&&this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:void 0})}_busyStart(e){return this._busySeq+=1,this._busyLocal.set(this._busySeq,e),this._renderBrowser(),this._busySeq}_busyEnd(e){this._busyLocal.delete(e)&&this._renderBrowser()}_busyTasks(){return bl({local:[...this._busyLocal.values()],generating:this._run&&Array.isArray(this._run.generating)?this._run.generating:[],art:this._artState==="painting"?this._art:null})}async _createRun(e){let a=await this._postJson("/run",e);if(!(a&&a.ok&&a.run))throw new Error(a&&a.error||"Could not create the run.");this._adoptRun(a.run),this._adoptRuns([...this._runs,a.run]),this._creatingNew=!1,this._showRuns=!1,this._forgeAsked=!0,this._renderBrowser()}_openSettings(e){if(!this._run)return;let a=vt.some(r=>r.id===e)?e:mt;this._hudView!=="settings"&&(this._settingsFrom=this._hudView||"home"),this._hudView="settings",this._settingsCategory=a,this._renderBrowser(),a==="continuity"&&this._loadContinuity(),a==="debug"&&this._loadTokenLog()}_settingsBackLabel(){return{home:"Home",modes:"Battle",roster:"Units",unit:"Units",summon:"Summon",formation:"Formation",inventory:"Inventory",farm:"Materials",chapters:"Chapters",chapter:"Chapter",result:"Result",combat:"Battle"}[this._settingsFrom]||"Home"}_leaveSettings(){this._hudView=this._settingsFrom==="settings"?"home":this._settingsFrom||"home",this._renderBrowser()}async _setSources(e){if(!this._run||!this._run.runId||!e||typeof e!="object")return;let a=this._run;this._run={...this._run,...e},this._settingsRev+=1;let r=await this._postJson("/run/sources",{runId:this._run.runId,sources:e});if(!r||!r.ok){this._run=a,this._settingsRev+=1,this._renderBrowser();return}if(r.run&&typeof r.run=="object"){let s={...this._run,...r.run};for(let n of Object.keys(e))Object.prototype.hasOwnProperty.call(r.run,n)||delete s[n];this._run=s,this._settingsRev+=1}Object.prototype.hasOwnProperty.call(e,"story")&&this._plan&&await this._preforgeCheck()}_switchRun(e){if(e){if(e===this._activeRunId){this._creatingNew=!1,this._showRuns=!1,this._renderBrowser();return}this._postJson("/run/activate",{runId:e}).then(a=>{a&&a.ok&&a.run&&(this._adoptRun(a.run),this._showRuns=!1,this._renderBrowser(),this._loadState())})}}_forgeCancelWiring(){return{onCancel:()=>{this._forgeCancelAsking=!0,this._renderBrowser()},onCancelKeep:()=>{this._forgeCancelAsking=!1,this._renderBrowser()},onCancelGo:()=>this._cancelWorldCreation()}}_cancelWorldCreation(){let e=this._run&&this._run.runId;!e||this._forgeCancelling||(this._forgeCancelling=!0,this._bannerState="cancelled",this._artState="cancelled",this._postJson("/run/delete",{runId:e}).then(a=>{a&&a.ok&&(this._adoptRuns(a.runs),this._activeRunId=a.activeRunId||null,this._adoptRun(a.activeRun||null),this._creatingNew=!1,this._showRuns=!1)}).catch(()=>{}).then(()=>{this._forgeCancelling=!1,this._forgeCancelAsking=!1,this._renderBrowser()}))}_deleteRun(e){e&&this._postJson("/run/delete",{runId:e}).then(a=>{a&&a.ok&&(this._adoptRuns(a.runs),this._activeRunId=a.activeRunId||null,this._run&&e===this._run.runId&&this._adoptRun(a.activeRun||null),this._runs.length===0&&(this._showRuns=!1,this._creatingNew=!1),this._renderBrowser())})}_loadChapterPlan(){if(this._planState="loading",this._renderBrowser(),!this._run){this._planState="error",this._renderBrowser();return}let e=null;this._postJson("/chapter-plan",{runId:this._run.runId,chapter:this._planChapter}).then(a=>{if(a&&a.ok&&a.plan){e=a.plan;let r=a.progress&&a.progress[String(this._planChapter)]||{};this._chapterProgress={normal:r.normal||0,hard:r.hard||0,veryhard:r.veryhard||0},this._difficulty=da(this._difficulty,this._chapterProgress,Ot(e)),this._chapterCp=a.cp||null}else this._planState="error",this._forgeFailure={error:String(a&&a.error||"generation-failed"),detail:String(a&&a.detail||"")}}).then(()=>{if(!(this._planState==="error"||!e))return this._prewarmCombats(e)}).then(()=>{if(this._planState!=="error"&&e){this._plan=e,this._planState="idle",this._loadLocations();let a=this._activeStoryNode;if(a&&a.restored&&a.chapter===this._planChapter){let r=Xe(e,a.difficulty).find(s=>s.type==="story"&&s.storyIndex===a.storyIndex);r&&Object.assign(a,r),a.restored=!1}this._openPrologueIfOwed(e)}this._run&&this._renderBrowser()}).then(()=>{if(this._planState!=="error"&&this._plan)return this._preforgeCheck()})}_openPrologueIfOwed(e){if(!this._prologue||this._activeStoryNode&&this._activeStoryNode.prologue)return;let a=this._planChapter===1?Xe(e,"normal")[0]:null;if(!a||a.type!=="story"){this._prologue=!1;return}this._difficulty="normal",this._openStoryNode(a,{nodeIndex:0,prologue:!0})}_prewarmCombats(e){let a=Ot(e);if(!a||!this._run)return Promise.resolve();let r=this._planChapter,s=Promise.resolve();for(let n=0;n<a;n+=1){let o=n;s=s.then(()=>this._postJson("/combat-guide",{runId:this._run.runId,chapter:r,combatIndex:o}))}return s}_preforgeRead(e,a){if(!this._run)return Promise.resolve(null);let r=Number.isInteger(e)?e:this._planChapter,s=typeof a=="string"&&a?a:this._run.runId;return this._postJson("/preforge",{runId:s,chapter:r}).then(n=>n&&n.ok&&n.preforge?(this._adoptPreforge(n.preforge),n.preforge):null)}_adoptPreforge(e){this._preforge=e&&typeof e=="object"?e:null,this._preforgeRev+=1}_preforgeCheck(){if(!this._run)return Promise.resolve();let e=this._run.runId+":"+this._planChapter;return this._preforgeAsked.has(e)?this._preforgeRead(this._planChapter).then(()=>this._renderBrowser()):(this._preforgeAsked.add(e),this._postJson("/preforge/start",{runId:this._run.runId,chapter:this._planChapter}).then(a=>{if(a&&a.ok){if(this._adoptPreforge(a.preforge),!a.allowed){this._renderBrowser();return}return this._preforgeRun()}}))}_preforgeRun(){let e=this._planChapter;if(this._preforgeRunning)return Promise.resolve();this._preforgeRunning=e;let a=this._preforgeEpoch,r=this._run.runId;this._renderBrowser();let s=()=>this._run&&this._run.runId===r&&this._preforgeRunning===e&&this._preforgeEpoch===a,n=(c,l)=>!s()||!Number.isInteger(c)||c<0?Promise.resolve():this._postJson("/beat",{runId:r,chapter:e,storyIndex:c,background:!0}).then(()=>{if(l)return this._postJson("/cg-art",{runId:r,chapter:e,storyIndex:c,background:!0})}).then(()=>s()?this._preforgeRead(e,r):null).then(d=>(this._renderBrowser(),!d||d.mode==="off"||d.cancelled||d.next<0||d.next===c?Promise.resolve():n(d.next,!!d.art))),o=this._preforge&&this._preforge.chapter===e&&!this._preforge.cancelled?this._preforge:null,i=o&&o.mode!=="off"?o.next:-1;return n(i,!!(o&&o.art)).then(()=>{this._preforgeRunning===e&&(this._preforgeRunning=null),this._renderBrowser()})}_preforgeCancel(){this._run&&(this._preforgeRunning=null,this._postJson("/preforge/cancel",{runId:this._run.runId,chapter:this._planChapter}).then(e=>{e&&e.ok&&this._adoptPreforge(e.preforge),this._renderBrowser()}))}_preforgeRetry(){this._run&&(this._run&&this._preforgeAsked.delete(this._run.runId+":"+this._planChapter),this._preforgeEpoch+=1,this._postJson("/preforge/retry",{runId:this._run.runId,chapter:this._planChapter}).then(e=>{e&&e.ok&&(this._adoptPreforge(e.preforge),e.allowed?this._preforgeRun():this._renderBrowser())}))}_preforgeLocked(){let e=this._preforge;return!!(e&&e.locked&&e.chapter===this._planChapter)}_preforgeView(){let e=this._preforge;if(!e||e.chapter!==this._planChapter)return null;let a=this._preforgeLocked();return{...e,locked:a,running:this._preforgeRunning===this._planChapter,owed:!a&&e.mode!=="off"&&e.next>=0}}_loadStandardBanner(){if(this._bannerState="loading",this._forgeFailure=null,this._renderBrowser(),!this._run){this._bannerState="error",this._renderBrowser();return}let e=this._run.runId,a=24,r=s=>!this._run||this._run.runId!==e?Promise.resolve():s>a?(this._bannerState="error",Promise.resolve()):this._postJson("/banner/step",{runId:e}).then(n=>{if(!n||!n.ok){this._bannerState="error",this._forgeFailure={error:String(n&&n.error||"generation-failed"),detail:String(n&&n.detail||"")};return}if(typeof n.total=="number"&&n.total>0&&(this._forge={done:Number(n.done)||0,total:n.total,name:String(n.label||"")},this._renderBrowser()),!n.finished)return r(s+1);this._bannerState="idle",this._bannerReady=!0,this._artReady=!1,this._artState="idle",this._artBlocking=!0;let o=n.result||n;typeof o.granted=="number"&&(this._rosterCount=o.granted)});r(1).then(()=>{this._forge={done:0,total:0,name:""},this._run&&this._renderBrowser()})}_nodeBackground(){let e=this._activeStoryNode,a=e&&typeof e.location=="string"?e.location:"",r=xs(a),s=this._locations||{};return r&&s[r]&&s[r].url||""}_showBackgroundNow(){let e=this._root&&this._root.querySelector('[data-bg="a"]'),a=this._nodeBackground();!e||!a||(e.style.backgroundImage=`url(${a})`,e.setAttribute("data-on",""))}_loadLocations(){return this._postJson("/locations",{runId:this._run?this._run.runId:""}).then(e=>{e&&e.ok&&e.places&&(this._locations=e.places,this._showBackgroundNow())}).catch(()=>{})}_imageSlot(e){let a=()=>e(),r=(this._imageChain||Promise.resolve()).then(a,a);return this._imageChain=r.then(()=>{},()=>{}),r}_ensureArtRunning(){!this._run||this._artReady||this._artState!=="idle"||this._bannerReady&&this._startArt()}_startArt(){if(this._artState="painting",this._art={done:0,total:0,name:""},!this._run){this._artReady=!0,this._renderBrowser();return}this._planState==="idle"&&this._plan==null&&this._loadChapterPlan(),this._postJson("/portraits",{runId:this._run.runId}).then(e=>{let a=e&&e.ok&&Array.isArray(e.pending)?e.pending:[];return a.length?(this._art={done:Number(e.done)||0,total:Number(e.total)||a.length,name:a[0].name},this._artBlocking&&this._renderBrowser(),this._paintNext(a,0,0)):this._finishArt()}).catch(()=>this._finishArt())}_paintNext(e,a,r){if(!this._run||this._artState!=="painting")return Promise.resolve();if(a>=e.length){if(r>0&&r===e.length){if(this._artBlocking)return this._artState="blocked",this._renderBrowser(),Promise.resolve();console.warn("[gacha-forge] every background portrait failed ("+r+") \u2014 units keep their silhouette")}return this._paintFoundingArt().then(()=>this._finishArt())}let s=e[a];return this._art={...this._art,name:s.name},this._artBlocking&&this._renderBrowser(),this._imageSlot(()=>this._postJson("/portrait",{runId:this._run.runId,unitId:s.unitId})).catch(()=>null).then(n=>{let o=!!(n&&n.ok);return o&&(this._art={...this._art,done:this._art.done+1}),this._paintNext(e,a+1,r+(o?0:1))})}_paintFoundingArt(){return!this._artBlocking||!this._run?Promise.resolve():(this._art={...this._art,name:"The banner splash"},this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:"char-standard"})).catch(()=>null))}_finishArt(){let e=!this._artBlocking;this._artState="idle",this._artReady=!0,this._artBlocking=!1,e&&(this._hudView==="roster"&&!this._rosterUnitId&&this._rosterState!=="loading"?this._loadRoster():this._hudView==="summon"&&this._summonBannerState!=="loading"&&this._loadSummonBanner()),this._renderBrowser()}_openPick(e){e!=="bg"&&e!=="unit"||(this._pick={slot:e,source:e==="bg"?"story":"all",mode:"default",page:1},this._renderBrowser(),this._postJson("/home-options",{runId:this._run?this._run.runId:""}).then(a=>{!a||a.ok===!1||(this._pickOptions={backgrounds:a.backgrounds||{},units:a.units||[],outfits:a.outfits||[]},this._pickRev+=1,this._pick&&this._renderBrowser())}))}_closePick(){this._pick&&(this._pick=null,this._renderBrowser())}_pickSource(e){this._pick&&(this._pick={...this._pick,source:String(e||""),page:1},this._renderBrowser())}_pickMode(e){this._pick&&(this._pick={...this._pick,mode:e==="outfit"?"outfit":"default",page:1},this._renderBrowser())}_pickPage(e){this._pick&&(this._pick={...this._pick,page:Math.max(1,Number(e)||1)},this._renderBrowser())}_takePick(e){if(!this._pick||!this._run)return;let a={runId:this._run.runId};if(this._pick.slot==="bg")a.bg=e?{src:this._pick.source,key:e}:null;else{if(!e)return;if(this._pick.mode==="outfit"){let r=(this._pickOptions&&this._pickOptions.outfits||[]).find(s=>s&&s.key===e);if(!r)return;a.unitId=r.unitId,a.unitOutfit=e}else a.unitId=e,a.unitOutfit=""}this._pick=null,this._renderBrowser(),this._postJson("/home-decor",a).then(r=>{!r||r.ok===!1||!r.decor||(this._run={...this._run,decor:r.decor},this._renderBrowser())})}_openRoster(){this._hudView="roster",this._rosterUnitId=null,this._rosterState="idle",this._renderBrowser()}_loadRoster(){if((!Array.isArray(this._roster)||!this._roster.length)&&(this._rosterState="loading"),this._renderBrowser(),!this._run){this._rosterState="error",this._renderBrowser();return}this._postJson("/roster",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.cards)?(this._roster=e.cards,this._rosterRev+=1,this._rosterCount=e.cards.length,this._rosterState="ready"):(!Array.isArray(this._roster)||!this._roster.length)&&(this._rosterState="error")}).then(()=>{this._hudView==="roster"&&this._renderBrowser()})}_openUnit(e,a="profile"){e&&(this._rosterUnitId=e,this._unit=null,this._unitTab=a==="growth"||a==="gear"||a==="bond"?a:"profile",this._growth=null,this._growthRev+=1,this._feed=null,this._unitState="idle",this._portraitReset(),this._renderBrowser())}_portraitReset(){this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev+=1}_loadUnit(){if(this._unitState="loading",this._renderBrowser(),!this._run||!this._rosterUnitId){this._unitState="error",this._renderBrowser();return}let e=this._rosterUnitId;this._postJson("/unit",{runId:this._run.runId,unitId:e}).then(a=>{this._rosterUnitId===e&&(a&&a.ok&&a.unit?(this._unit=a.unit,this._unitLevel=Number(a.level)||1,this._unitBond=Number(a.bond)||0,this._growth=a,this._growthRev+=1,this._feed=null,this._portrait=a.portrait||null,this._portraitRev+=1,this._unitState="ready"):this._unitState="error")}).then(()=>{this._rosterUnitId===e&&this._renderBrowser()})}_portraitOpenStudio(){this._portrait&&(this._portraitDraft={appearance:this._portrait.appearance||"",tags:$t(this._portrait.tags)},this._portraitOpen=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser())}_portraitClose(){this._portraitOpen=!1,this._portraitCrop=null,this._portraitError="",this._portraitRev+=1,this._renderBrowser()}_portraitEdit(e){if(!(!this._portraitDraft||!e)){if(typeof e.appearance=="string"){this._portraitDraft.appearance=e.appearance;return}if(typeof e.addTag=="string")for(let a of $t(e.addTag))this._portraitDraft.tags.includes(a)||this._portraitDraft.tags.push(a);else if(Number.isInteger(e.dropTag))this._portraitDraft.tags.splice(e.dropTag,1);else return;this._portraitRev+=1,this._renderBrowser()}}_portraitGenerate(){if(this._portraitBusy||!this._run||!this._rosterUnitId||!this._portraitDraft)return;let e=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait",{runId:this._run.runId,unitId:e,force:!0,appearance:this._portraitDraft.appearance,imageTags:this._portraitDraft.tags}).then(a=>this._portraitApply(e,a,"That did not paint."))}_portraitPick(e){let r=(this._portrait&&this._portrait.strip||[])[e];if(!r||r.current||this._portraitBusy||!this._run||!this._rosterUnitId)return;let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait/select",{runId:this._run.runId,unitId:s,url:r.url}).then(n=>this._portraitApply(s,n,"That one could not be restored."))}_portraitApply(e,a,r){if(this._portraitBusy=!1,this._rosterUnitId===e){if(a&&a.ok&&a.view){let s=a.view;this._portrait=s,this._portraitDraft={appearance:s.appearance||"",tags:$t(s.tags)},this._portraitCrop=null,this._portraitError="";let n=Array.isArray(s.strip)&&s.strip.length?s.strip[0].url:"";this._unit&&(this._unit={...this._unit,portrait:n,appearance:s.appearance,imageTags:s.tags}),this._rosterState="idle"}else this._portraitError=Zf[a&&a.error||""]||a&&a.detail||r;this._portraitRev+=1,this._renderBrowser()}}_portraitFile(e){if(!e||this._portraitBusy)return;let a=s=>{this._portraitError=s,this._portraitCrop=null,this._portraitRev+=1,this._renderBrowser()},r=new FileReader;r.onerror=()=>a("That file could not be read."),r.onload=()=>{let s=String(r.result||""),n=new Image;n.onerror=()=>a("That file is not an image this gallery accepts."),n.onload=()=>{let o=n.naturalWidth||n.width,i=n.naturalHeight||n.height;if(!o||!i)return a("That image has no size.");this._portraitCrop={src:s,natural:{w:o,h:i},size:1,frame:Kr(o,i,1,.5,.42)},this._portraitError="",this._portraitRev+=1,this._renderBrowser()},n.src=s},r.readAsDataURL(e)}_portraitDrag(e){let a=this._portraitCrop;!a||!e||(a.frame=Xr({...a.frame,x:a.frame.x+(Number(e.dx)||0)*a.natural.w,y:a.frame.y+(Number(e.dy)||0)*a.natural.h},a.natural.w,a.natural.h),Jr(this._root,a.frame,a.natural.w,a.natural.h))}_portraitSize(e){let a=this._portraitCrop;if(!a)return;let r=(a.frame.x+a.frame.w/2)/a.natural.w,s=(a.frame.y+a.frame.h/2)/a.natural.h;a.size=e,a.frame=Kr(a.natural.w,a.natural.h,e,r,s),Jr(this._root,a.frame,a.natural.w,a.natural.h)}_portraitUpload(){let e=this._portraitCrop;if(!e||this._portraitBusy||!this._run||!this._rosterUnitId)return;let a=Number(this._portrait&&this._portrait.width)||0,r=Number(this._portrait&&this._portrait.height)||0;if(!a||!r){this._portraitError="This world did not say what size a portrait is.",this._portraitRev+=1,this._renderBrowser();return}let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser();let n=new Image;n.onerror=()=>this._portraitApply(s,null,"That image could not be prepared."),n.onload=()=>{let o="";try{let i=document.createElement("canvas");i.width=a,i.height=r,i.getContext("2d").drawImage(n,e.frame.x,e.frame.y,e.frame.w,e.frame.h,0,0,a,r),o=i.toDataURL("image/jpeg",.92)}catch{o=""}if(!o)return this._portraitApply(s,null,"That image could not be prepared.");this._postJson("/portrait/upload",{runId:this._run.runId,unitId:s,image:o}).then(i=>this._portraitApply(s,i,"That image was not accepted."))},n.src=e.src}_wireRuns(){Xl(this._root,{onNew:()=>{this._creatingNew=!0,this._showRuns=!1,this._renderBrowser()},onSwitch:e=>this._switchRun(e),onDelete:e=>this._deleteRun(e),onBack:()=>{this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}})}_wireChapter(){Mn(this._root,{plan:this._plan,difficulty:this._difficulty,progress:this._chapterProgress,onBack:()=>{this._hudView="chapters",this._renderBrowser()},onDifficulty:e=>{this._difficulty=e,this._renderBrowser()},onPlayStory:e=>this._playStoryNode(e),onReplayStory:(e,a)=>this._replayStoryNode(e,a),onPreforgeRetry:()=>this._preforgeRetry(),onPreforgeCancel:()=>this._preforgeCancel(),onStartCombat:e=>this._openCombat(e)})}_openChapter(e){if(!this._run||e<1)return;let a=e===this._planChapter&&!!this._plan;this._planChapter=e,a||(this._plan=null),this._planState="idle",this._hudView="chapter",this._continuity=null,this._continuityState="idle",this._renderBrowser(),a&&this._loadChapterPlan()}_wireChapters(){let e=this._root.querySelector("[data-back]");e&&e.addEventListener("click",()=>{this._hudView="home",this._renderBrowser()}),this._chaptersData=null,this._chaptersState="idle",this._loadChapters()}_loadChapters(){this._run&&(this._chaptersState="loading",this._fillChapters(),this._postJson("/chapters",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.chapters)?(this._chaptersData=e,this._chaptersState="ready"):this._chaptersState="error",this._fillChapters()}))}_fillChapters(){let e=this._root.querySelector("[data-chapters-list]");if(!e)return;if(this._chaptersState==="loading"&&!this._chaptersData){e.innerHTML='<p class="sel-empty">Loading&hellip;</p>';return}if(this._chaptersState==="error"&&!this._chaptersData){e.innerHTML='<p class="sel-empty">Could not load chapters.</p>';return}let a=this._chaptersData||{chapters:[],nextChapter:1,nextUnlocked:!0};e.innerHTML=No(a.chapters,a.nextChapter,a.nextUnlocked);let r=(a.chapters||[]).map(s=>s.chapter);a.nextUnlocked&&r.push(a.nextChapter);for(let s of r){let n=this._root.querySelector('[data-open-chapter="'+s+'"]');n&&n.addEventListener("click",()=>this._openChapter(s))}}_playStoryNode(e){!this._run||this._storyStarting||(this._storyStarting=!0,this._storyNotice="",this._postJson("/story/start",{runId:this._run.runId,chapter:this._planChapter,storyIndex:e&&e.storyIndex}).then(a=>{if(this._storyStarting=!1,a&&a.ok){this._run&&(this._run.wallet=a.wallet||this._run.wallet),this._openStoryNode(e);return}this._storyNotice=a&&a.error==="no-vigor"?`Not enough Vigor: this beat costs ${a.cost} and you have ${a.vigor}.`:"That beat could not be started.",this._renderBrowser()}))}_replayStoryNode(e,a){this._run&&(this._storyNotice="",this._openStoryNode(e,{nodeIndex:a,replay:!0}))}_openStoryNode(e,{nodeIndex:a=null,replay:r=!1,prologue:s=!1}={}){if(!this._run)return;let n=this._difficulty,o=a??(this._chapterProgress[n]||0);this._activeStoryNode={...e||{},chapter:this._planChapter,difficulty:n,nodeIndex:o,storyIndex:e&&e.storyIndex,title:e&&e.title||"Story",replay:r,prologue:s},this._beat=null,this._beatCast=null,this._beatState="loading",this._beatRequested=!1,this._renderBrowser()}_loadBeat(){let e=this._activeStoryNode;if(!this._run||!e){this._beatState="error",this._beatRequested=!1,this._renderBrowser();return}this._postJson("/beat",{runId:this._run.runId,chapter:e.chapter,nodeIndex:e.nodeIndex,storyIndex:e.storyIndex}).then(async a=>{if(a&&a.ok&&Array.isArray(a.segments)&&a.segments.length){this._beat=a.segments,this._beatCast=Array.isArray(a.cast)?a.cast:null,this._contextTokens=Number(a.contextTokens)||0,this._beatPlaces=await this._paintBeatPlaces(a.places),this._beatCg=await this._paintBeatCg(a.cg,e);let r=e.replay?0:Math.max(0,Math.round(Number(a.resumeAt)||0));this._beatResumeAsk=r>0&&r<this._beat.length-1?r:0,this._beatStartAt=0,this._beatAt=0,this._beatState="ready"}else this._beatState="error",this._forgeFailure={error:String(a&&a.error||"generation-failed"),detail:String(a&&a.detail||"")}}).then(()=>{this._beatRequested=!1,this._renderBrowser()})}async _paintBeatPlaces(e){let a=Array.isArray(e)?e.filter(Boolean):[];if(!a.length)return null;let r=this._run?this._run.runId:"",s={},n=r?a.filter(i=>!i.url).length:0,o=0;for(let i of a){if(i.url){s[i.name]=i.url;continue}if(!r)continue;this._beatArt={done:o,total:n,name:i.name},this._renderBrowser();let c=await this._imageSlot(()=>this._postJson("/background",{runId:r,slug:i.slug,name:i.name,tags:i.tags})).catch(l=>({ok:!1,error:String(l&&l.message||l)}));o+=1,c&&c.ok&&c.url?s[i.name]=c.url:console.warn("[gacha-forge] beat background failed",i.name,c&&(c.detail||c.error))}return this._beatArt=null,await this._loadLocations(),s}async _paintBeatCg(e,a){if(!e||typeof e!="object")return null;let r=this._run?this._run.runId:"";if(!r)return null;let s={from:Number(e.from)||0,to:Number(e.to)||0,title:String(e.title||""),url:String(e.url||"")};if(s.url)return s;this._beatArt={done:0,total:1,name:s.title||"Key image"},this._renderBrowser();let n=await this._imageSlot(()=>this._postJson("/cg-art",{runId:r,chapter:a.chapter,storyIndex:a.storyIndex})).catch(o=>({ok:!1,error:String(o&&o.message||o)}));return this._beatArt=null,n&&n.ok&&n.url?(s.url=String(n.url),s):(console.warn("[gacha-forge] key image failed",s.title,n&&(n.detail||n.error)),null)}_retryBeat(){this._beatState="loading",this._beatArt=null,this._beatRequested=!1,this._renderBrowser()}_completeStoryBeat(){let e=this._activeStoryNode,a=!!(e&&e.prologue);if(this._clearBeat(),e&&this._run){let r=e.nodeIndex==null?this._chapterProgress[e.difficulty]||0:e.nodeIndex;this._chapterProgress[e.difficulty]=(this._chapterProgress[e.difficulty]||0)+1,this._postJson("/complete",{runId:this._run.runId,chapter:e.chapter,difficulty:e.difficulty,nodeIndex:r}).then(s=>{s&&s.ok||(this._chapterProgress[e.difficulty]=Math.max(0,(this._chapterProgress[e.difficulty]||0)-1),this._hudView==="chapter"&&this._renderBrowser())})}a&&(this._prologue=!1),this._hudView=a?"home":"chapter",this._renderBrowser()}_markBeatAt(e){let a=this._activeStoryNode;!a||!this._run||a.replay||this._postJson("/beat/mark",{runId:this._run.runId,chapter:a.chapter,storyIndex:a.storyIndex,at:Math.max(0,Math.round(Number(e)||0))}).catch(()=>{})}_exitStoryBeat(){this._markBeatAt(this._beatAt),this._clearBeat(),this._hudView="chapter",this._renderBrowser()}_clearBeat(){this._stopBeat(),this._beatState="idle",this._beat=null,this._beatPlaces=null,this._beatCg=null,this._beatArt=null,this._activeStoryNode=null,this._beatRequested=!1,this._beatAt=0,this._beatStartAt=0,this._beatResumeAsk=0}_advanceNode(){if(!this._run)return;let e=this._difficulty,a=this._chapterProgress[e]||0;this._chapterProgress[e]=a+1;let r=this._nodeTitle(a);this._postJson("/complete",{runId:this._run.runId,chapter:this._planChapter,difficulty:e,nodeIndex:a}).then(s=>{!(s&&s.ok)&&s&&s.error!=="lost"&&(this._chapterProgress[e]||0)===a+1&&(this._chapterProgress[e]=a),this._afterComplete(s,r)}).catch(()=>{(this._chapterProgress[e]||0)===a+1&&(this._chapterProgress[e]=a),this._renderBrowser()}),this._renderBrowser()}_nodeTitle(e){let a=this._plan&&Array.isArray(this._plan.nodes)?this._plan.nodes:[];return this._titleOfNode(a[e])}_titleOfNode(e){return`${this._chapterLabel()}${e&&e.title?" \xB7 "+e.title:""}`}_afterComplete(e,a){if(e&&e.error==="lost"){this._openResult({outcome:"lose",where:a,rewards:[],relic:null,rank:null,back:"chapter",canReplay:!0,again:this._combatNode});return}if(!(e&&e.ok)){this._leaveCombat("chapter");return}let r=pl(e.reward);if(!r.length&&!e.rank){this._leaveCombat("chapter");return}this._openResult({outcome:"win",where:a,rewards:r,rank:e.rank||null,back:"chapter"})}_openResult(e){this._result=e,this._resultRev+=1,this._stopCombat(),this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._hudView="result",this._renderBrowser()}_closeResult(){let e=this._result&&this._result.back||"chapter";this._result=null,this._resultRev+=1,this._hudView=e,e==="farm"&&this._loadFarm(),e==="events"&&(this._eventId="seasonal"),this._renderBrowser()}_resultAgain(){let e=this._result&&this._result.again,a=this._result&&this._result.back||"farm";if(this._result=null,this._resultRev+=1,!e){this._hudView="farm",this._renderBrowser();return}if(a==="events"){this._hudView="events",this._eventId="seasonal",this._seasonalRun(e&&e.difficulty);return}if(a==="farm"){this._hudView="farm",this._farmRun(e);return}this._combatNode=e,this._combatPhase="loading",this._hudView="combat",this._renderBrowser()}_loadContinuity(){this._run&&(this._continuityState="loading",this._fillContinuity(),this._postJson("/continuity",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.chapters)?(this._continuity=e.chapters,this._continuityState="ready",e.warnTokens&&(this._warnTokens=Number(e.warnTokens)||this._warnTokens,Ze(this._root,this._contextTokens,this._warnTokens))):this._continuityState="error",this._fillContinuity()}))}_vigorView(){let e=this._wallet||this._run&&this._run.wallet||null,a=this._combatVigorError,r=Number(a&&Number.isFinite(Number(a.cost))?a.cost:this._combat&&this._combat.cost);return!e||!Number.isFinite(r)?null:{have:Number(e.vigor)||0,cost:r,nextMs:a&&Number.isFinite(a.vigorNextMs)?a.vigorNextMs:this._wallet&&this._wallet.vigorNextMs||null}}_startBattle(){if(!this._run||this._combatStarting)return;this._combatStarting=!0;let e=this._combatNode;(e&&e.farm?this._postJson("/farm/start",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}):this._postJson("/battle/start",{runId:this._run.runId,chapter:e.chapter,combatIndex:e.combatIndex,difficulty:this._difficulty,presetIndex:this._combatPreset})).then(r=>{this._combatStarting=!1,r&&r.ok?(this._run&&(this._run.wallet=r.wallet||this._run.wallet),this._combatPhase="battle",this._combatVigorError=null):this._combatVigorError=r&&r.error==="no-vigor"?r:{error:r&&r.error||"failed"},this._renderBrowser()})}_feedRoom(e){if(!e)return 0;let a=Number(e.level)||1,r=(Array.isArray(e.ladder)?e.ladder:[]).filter(s=>Number(s.level)>=a).reduce((s,n)=>s+(Number(n.xp)||0),0);return Math.max(0,r-Math.max(0,Number(e.xp)||0))}_growthView(){let e=this._growth;if(!e)return null;let a=this._feed;if(!a)return e;let r=Array.isArray(e.tiers)?e.tiers:[],s=Math.max(0,Number(e.xp)||0),n=0;for(let u of r)n+=(Number(a[u.id])||0)*(Number(u.xp)||0);s+=n;let o=Number(e.wallet&&e.wallet.funds)||0,i=Number(e.level)||1,c=0,l=!1;for(let u of Array.isArray(e.ladder)?e.ladder:[])if(u.level===i){if(s<u.xp)break;if(o<u.funds){l=!0;break}s-=u.xp,o-=u.funds,c+=u.funds,i=u.level+1}let d=(Array.isArray(e.ladder)?e.ladder:[]).find(u=>u.level===i-1),h=(Array.isArray(e.ladder)?e.ladder:[]).find(u=>u.level===i),v=i-(Number(e.level)||1);return{...e,preview:{ready:n>0&&!(v===0&&l),short:l,xp:n,levelTo:i,cpTo:d?d.cpAfter:Number(e.cp)||0,funds:c||(l?this._nextStepFunds(e,i):0),spent:{...a},xpAfter:s,needAfter:h?h.xp:null,solid:v>0?0:Math.max(0,Number(e.xp)||0),roomLeft:Math.max(0,this._feedRoom(e)-n)}}}_nextStepFunds(e,a){let r=(Array.isArray(e.ladder)?e.ladder:[]).find(s=>s.level===a);return r?r.funds:0}_feedAdd(e){let a=this._growth;if(!a||!e)return;let r=Math.max(0,Number(a.wallet&&a.wallet.insight&&a.wallet.insight[e])||0),s=this._feed||{},n=Number(s[e])||0;if(n>=r)return;let o=Array.isArray(a.tiers)?a.tiers:[],i=0;for(let c of o)i+=(Number(s[c.id])||0)*(Number(c.xp)||0);this._feedRoom(a)-i<=0||(this._feed={...s,[e]:n+1},this._paintGrowth())}_feedReset(){this._feed&&(this._feed=null,this._paintGrowth())}_feedCommit(){let e=this._growth,a=!!e&&!this._feed&&Number(e.xpNeeded)>0&&Number(e.xp)>=Number(e.xpNeeded)&&Number(e.level)<Number(e.levelCap);if(!this._run||!this._rosterUnitId||!this._feed&&!a)return;let r=this._feed||{};this._feed=null,this._paintGrowth(),this._postJson("/level-up",{runId:this._run.runId,unitId:this._rosterUnitId,spend:r}).then(s=>{s&&s.ok?(this._unitLevel=Number(s.level)||this._unitLevel,this._growth={...this._growth,...s},this._growthRev+=1,this._renderBrowser()):this._paintGrowth()})}_openInventory(){this._hudView="inventory",this._invSection="relics",this._invView={slot:"all",rarity:"all",picked:"",feeding:null,gained:[]},this._inventoryState=this._inventory?"ready":"loading",this._renderBrowser(),this._loadInventory()}_loadInventory(){this._run&&(this._inventoryState=this._inventoryState==="ready"?"ready":"loading",this._postJson("/inventory",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._inventory=e,this._inventoryState="ready"):this._inventoryState="error",this._invRev+=1,this._renderBrowser()}).catch(()=>{this._inventoryState="error",this._invRev+=1,this._renderBrowser()}))}_relicLock(e){!this._run||!e||this._invBusy||(this._invBusy=!0,this._postJson("/relic/lock",{runId:this._run.runId,relicId:e}).catch(()=>null).then(()=>{this._invBusy=!1,this._loadInventory()}))}_relicFeedFromInventory(){let e=this._invView.feeding;!this._run||!e||!e.picked.length||this._invBusy||(this._invBusy=!0,this._postJson("/relic/feed",{runId:this._run.runId,relicId:e.targetId,food:e.picked}).then(a=>{this._invBusy=!1,a&&a.ok?this._invView={...this._invView,feeding:null,picked:e.targetId,gained:a.gained||[]}:this._invView={...this._invView,feeding:null},this._loadInventory()}).catch(()=>{this._invBusy=!1,this._invView={...this._invView,feeding:null},this._loadInventory()}))}_openFarm(){this._hudView="farm",this._farmView="root",this._farmState=this._farm?"ready":"loading",this._renderBrowser(),this._loadFarm()}_loadFarm(){this._run&&this._postJson("/farm",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._farm=e,this._farmState="ready"):this._farmState="error",this._farmRev+=1,this._hudView==="farm"&&this._renderBrowser()})}_farmRun(e){!this._run||!e||this._farmBusy||(this._farmBusy=!0,this._pendingFarm={...e},this._stopCombat(),this._pendingCombat={farm:!0,...e,title:"Materials"},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser())}_claimFarm(){if(!this._run)return;let e=this._pendingFarm?{...this._pendingFarm}:null,a=!!(e&&e.stage==="seasonal"),r=this._farmStageLabel(e);this._postJson("/farm/claim",{runId:this._run.runId}).then(s=>{if(!(s&&s.ok)){this._leaveCombat("farm");return}let n=s.dropped||null;this._pendingFarm=null,this._openResult({outcome:"win",where:r,rewards:fl(n),relic:n&&n.relic||null,supply:n&&n.supply||0,bonus:n&&n.bonus||null,rank:s&&s.rank||null,back:a?"events":"farm",canReplay:!!e,again:e}),a||this._loadFarm()}).catch(()=>this._leaveCombat("farm"))}_newWorldViewOut(){return this._newWorld?this._newWorldGained?{...this._newWorld,gained:this._newWorldGained}:this._newWorld:null}_claimNewWorld(){!this._run||this._claimingNewWorld||(this._claimingNewWorld=!0,this._postJson("/newworld/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._newWorldGained=Array.isArray(e.gained)?e.gained:null,this._eventsRev+=1,e.done&&(this._eventId="login",this._newWorldGained=null,this._refreshState()))}).catch(()=>{}).then(()=>{this._claimingNewWorld=!1,this._renderBrowser()}))}_seasonalRun(e){if(!this._run||this._farmBusy)return;let a=Math.round(Number(e)||0);if(!a)return;let r={stage:"seasonal",difficulty:a,family:""};this._farmBusy=!0,this._pendingFarm={...r},this._stopCombat(),this._pendingCombat={farm:!0,...r,title:this._seasonalLabel()},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_seasonalLabel(){return this._seasonal&&this._seasonal.label||"Seasonal Event"}_seasonalRunLabel(e){let a=e?$e.find(r=>r.difficulty===Number(e.difficulty)):null;return(a?a.label+" \xB7 ":"")+this._seasonalLabel()}_boardRollOnce(){if(!this._run||this._boardRolling)return;this._boardRolling=!0;let e=this._root&&this._root.querySelector("[data-board-roll]");e&&e.setAttribute("disabled",""),this._boardRoll={state:"spin",face:0,at:-1},this._renderBrowser(),this._postJson("/mini/board/roll",{runId:this._run.runId}).then(a=>a&&a.ok?a:null).catch(()=>null).then(a=>new Promise(r=>{setTimeout(()=>r(a),cn)})).then(a=>new Promise(r=>{if(!a)return r(null);let s=Math.max(1,Math.round(Number(a.face)||1)),n=Math.round(Number(a.from)||0),o=Math.round(Number(a.at)||0),i=0,c=()=>{if(i+=1,i<s){this._boardRoll={state:"walk",face:s,from:n,at:o,step:i},this._renderBrowser(),setTimeout(c,ir);return}this._board=a.board||this._board,this._boardKey=a.board?lr(a.board):this._boardKey,this._boardRoll={state:"land",face:s,from:n,at:o,step:i},a.wallet&&(this._wallet=a.wallet),this._adoptGlobals(a),this._renderBrowser(),setTimeout(()=>r(a),dn)};this._boardRoll={state:"walk",face:s,from:n,at:o,step:0},this._renderBrowser(),setTimeout(c,ir)})).then(()=>{this._boardRoll=null,this._boardRolling=!1,this._eventsRev+=1,this._renderBrowser()})}_seasonalMilestone(e){!this._run||this._seasonalClaiming||!(this._seasonal&&Array.isArray(this._seasonal.milestones)&&this._seasonal.milestones[e])||(this._seasonalClaiming=!0,this._renderBrowser(),this._postJson("/seasonal/milestone",{runId:this._run.runId,index:e}).then(r=>{!r||!r.ok||(this._seasonalGained=Array.isArray(r.gained)?r.gained:null,this._adoptFromResponse(r),this._eventsRev+=1)}).catch(()=>null).then(()=>{this._seasonalClaiming=!1,this._renderBrowser()}))}_seasonalDraw(e=1){if(!(!this._run||this._seasonalDrawing)){this._seasonalDrawing=!0;for(let a of this._root?this._root.querySelectorAll("[data-seasonal-draw], [data-seasonal-draw-many]"):[])a.setAttribute("disabled","");this._postJson("/seasonal/draw",{runId:this._run.runId,count:Math.max(1,Math.round(Number(e)||1))}).then(a=>!a||!a.ok?null:(this._seasonalGained=Array.isArray(a.gained)?a.gained:null,this._eventsRev+=1,a)).catch(()=>null).then(a=>new Promise(r=>{if(!a||!Number.isFinite(Number(a.at)))return r();if(Array.isArray(a.ats)&&a.ats.length>1)return rr(this._root,a.ats,r);ar(this._root,Number(a.at),r)})).then(()=>{this._seasonalDrawing=!1,this._renderBrowser()})}}_farmStageLabel(e){if(e&&e.stage==="seasonal")return this._seasonalRunLabel(e);if(!e)return"Materials";let a=["","Normal","Hard","Very Hard"][Number(e.difficulty)]||"",s=((this._farm&&this._farm.stages||{})[e.stage]||[]).find(o=>Number(o.difficulty)===Number(e.difficulty));if(e.stage==="asc"){let o=(this._farm&&this._farm.families||[]).find(i=>i.id===e.family);return`${a} \xB7 ${o?o.name:"Ascension"}`}let n=this._farm&&this._farm.stageNames||{};return`${a} \xB7 ${n[e.stage]||s&&s.material||"Materials"}`}_gearFeedView(){return!this._gearFeed||!this._gearFeed.open?null:{open:!0,picked:this._gearFeed.picked||[],gained:this._gearFeed.gained||null,inventory:this._relics&&this._relics.items||[],funds:Number(this._wallet&&this._wallet.funds)||0,cost:Number(this._relics&&this._relics.feedFunds)||0,tickEvery:Number(this._relics&&this._relics.tickEvery)||3}}_relicFeed(e){if(!(!e||!this._run)){if(e.type==="open"){this._gearFeed={open:!0,picked:[],gained:null},this._renderBrowser(),this._loadRelics();return}if(e.type==="back"){this._gearFeed=null,this._renderBrowser();return}if(this._gearFeed){if(e.type==="clear"){this._gearFeed.picked=[],this._gearFeed.gained=null,this._renderBrowser();return}if(e.type==="pick"){let a=this._gearFeed.picked||[],r=a.indexOf(e.id);r>=0?a.splice(r,1):a.push(e.id),this._gearFeed.picked=a,this._gearFeed.gained=null,this._renderBrowser();return}e.type==="go"&&this._relicFeedGo()}}}_loadRelics(){this._postJson("/relics",{runId:this._run.runId}).then(e=>{e&&e.ok&&(this._relics=e,this._relicsRev+=1,this._renderBrowser())})}_relicFeedGo(){let e=this._gearSlot,a=this._growth&&this._growth.gear,r=a&&(a.slots||[]).find(i=>i.key===e),s=r&&r.item?r.item.id:"",n=this._gearFeed&&this._gearFeed.picked||[];if(!s||!n.length||this._feedBusy)return;this._feedBusy=!0;let o=this._rosterUnitId;this._postJson("/relic/feed",{runId:this._run.runId,relicId:s,food:n}).then(i=>{this._feedBusy=!1,this._rosterUnitId===o&&(i&&i.ok&&(this._gearFeed={open:!0,picked:[],gained:i.gained||[]},this._loadRelics(),this._loadUnit()),this._renderBrowser())}).catch(()=>{this._feedBusy=!1})}_equip(e){if(!this._run||!this._rosterUnitId||this._equipBusy)return;this._equipBusy=!0;let a=this._rosterUnitId,r=this._gearSlot||"weapon",s=r!=="weapon";this._postJson("/equip",{runId:this._run.runId,unitId:a,slot:r,weaponId:s?"":e||"",relicId:s&&e||""}).then(n=>{this._equipBusy=!1,this._rosterUnitId===a&&(n&&n.ok&&(this._growth={...this._growth,...n},this._growthRev+=1,this._gearSlot=null),this._renderBrowser())}).catch(()=>{this._equipBusy=!1})}_ascend(){if(!this._run||!this._rosterUnitId)return;let e=this._growth;!e||!e.ascension||!e.ascension.ready||this._growthBusy||(this._growthBusy=!0,this._postJson("/ascend",{runId:this._run.runId,unitId:this._rosterUnitId}).then(a=>{this._growthBusy=!1,a&&a.ok?(this._growth={...this._growth,...a},this._growthRev+=1):a&&a.ascension&&(this._growth={...this._growth,ascension:a.ascension},this._growthRev+=1),this._paintGrowth()}))}_formUp(e){if(!this._run||!this._rosterUnitId)return;let a=this._growth,r=a&&a.form&&Array.isArray(a.form.tracks)?a.form.tracks.find(s=>s.key===e):null;!r||!r.ready||this._growthBusy||(this._growthBusy=!0,this._postJson("/form-up",{runId:this._run.runId,unitId:this._rosterUnitId,track:e}).then(s=>{this._growthBusy=!1,s&&s.ok?(s.unit&&(this._unit=s.unit),this._growth={...this._growth,...s},this._growthRev+=1):s&&s.form&&(this._growth={...this._growth,form:s.form},this._growthRev+=1),this._paintGrowth()}))}_paintGrowth(){let e=this._root.querySelector(".cp-panel");!e||this._unitTab!=="growth"||!this._unit||(e.innerHTML=wi(this._unit,this._growthView()))}_loadTokenLog(){this._tokenLog={status:"loading",entries:this._tokenLog&&this._tokenLog.entries||[],totals:this._tokenLog&&this._tokenLog.totals},this._fillTokenLog(),this._loreStatus={status:"loading"},this._postJson("/lore-status",{runId:this._run?this._run.runId:""}).then(e=>{this._loreStatus=e&&e.ok?{status:"ready",data:e}:{status:"error"},this._fillTokenLog()}),this._postJson("/token-log",{runId:this._run?this._run.runId:""}).then(e=>{e&&e.ok&&Array.isArray(e.entries)?this._tokenLog={status:"ready",entries:e.entries,totals:e.totals||null}:this._tokenLog={status:"error",entries:[],totals:null},this._fillTokenLog()})}_fillTokenLog(){let e=this._root.querySelector('[data-view-body="debug"]');e&&(e.innerHTML=Ar(this._loreStatus,this._tokenLog))}_fillContinuity(){let e=this._root.querySelector("[data-continuity-list]");if(!e)return;if(this._continuityState==="loading"&&!this._continuity){e.innerHTML='<p class="st-empty">Loading&hellip;</p>';return}if(this._continuityState==="error"&&!this._continuity){e.innerHTML='<p class="st-empty">Could not load chapters.</p>';return}let a=this._continuity||[];e.innerHTML=ho(a,this._compressing,this._fold);for(let r of a)if(r&&r.complete&&!r.compressed&&this._compressing==null&&!(this._fold&&this._fold.on)){let s=this._root.querySelector('[data-compress="'+r.chapter+'"]');s&&s.addEventListener("click",()=>this._compressChapter(r.chapter))}this._fillFold(a)}_fillFold(e){let a=this._root.querySelector("[data-continuity-fold]");if(!a)return;a.innerHTML=co({chapters:e,fold:this._fold,merging:this._merging,blocked:this._foldBlocked});let r=a.querySelector("[data-fold-start]");r&&r.addEventListener("click",()=>{this._fold={on:!0,from:0,to:0},this._foldBlocked=!1,this._fillContinuity()});let s=a.querySelector("[data-fold-cancel]");s&&s.addEventListener("click",()=>{this._fold=null,this._fillContinuity()});let n=a.querySelector("[data-fold-go]");if(n&&!n.disabled&&n.addEventListener("click",()=>this._mergeFold()),!(!(this._fold&&this._fold.on)||this._merging))for(let o of e){if(!o||!o.compressed)continue;let i=this._root.querySelector('[data-pick="'+o.chapter+'"]');i&&i.addEventListener("click",()=>this._pickFold(o.chapter,e))}}_pickFold(e,a){let r=this._fold||{on:!0,from:0,to:0};if(!r.from||r.from===r.to&&r.from===e){this._fold={on:!0,from:e,to:e},this._fillContinuity();return}let s=Math.min(r.from,e),n=Math.max(r.from,e);if(a.filter(i=>i&&i.chapter>=s&&i.chapter<=n).some(i=>!i.compressed)){this._foldBlocked=!0,this._fillContinuity();return}this._foldBlocked=!1,this._fold={on:!0,from:s,to:n},this._fillContinuity()}_mergeFold(){let e=this._fold;!this._run||this._merging||!e||!e.from||e.to<=e.from||(this._merging=!0,this._fillContinuity(),this._postJson("/compress/merge",{runId:this._run.runId,from:e.from,to:e.to}).then(a=>{this._merging=!1,this._fold=null,a&&a.ok&&typeof a.contextTokens=="number"&&(this._contextTokens=a.contextTokens,Ze(this._root,this._contextTokens,this._warnTokens)),this._continuity=null,this._continuityState="idle",this._loadContinuity()}))}_compressChapter(e){!this._run||this._compressing!=null||(this._compressing=e,this._fillContinuity(),this._postJson("/compress",{runId:this._run.runId,chapter:e}).then(a=>{this._compressing=null,a&&a.ok&&Array.isArray(this._continuity)&&(this._continuity=this._continuity.map(r=>r.chapter===e?{...r,compressed:!0}:r)),a&&a.ok&&Number.isFinite(Number(a.contextTokens))&&(this._contextTokens=Number(a.contextTokens)||0,Ze(this._root,this._contextTokens,this._warnTokens)),this._fillContinuity()}))}_setWarnTokens(e){let a=Math.max(1e3,Math.round(Number(e)||0));!a||!this._run||(this._warnTokens=a,Ze(this._root,this._contextTokens,this._warnTokens),this._postJson("/warn-threshold",{runId:this._run.runId,warnTokens:a}).then(r=>{r&&r.ok&&r.warnTokens&&(this._warnTokens=Number(r.warnTokens)||this._warnTokens,Ze(this._root,this._contextTokens,this._warnTokens))}))}_stopForge(){this._forgeCleanup&&(this._forgeCleanup(),this._forgeCleanup=null)}_stopBeat(){this._beatCleanup&&(this._beatCleanup(),this._beatCleanup=null)}_stopSummon(){this._summonCleanup&&(this._summonCleanup(),this._summonCleanup=null)}_stopCombat(){this._combatCleanup&&(this._combatCleanup(),this._combatCleanup=null)}_openCombat(e){if(!this._run||!e||typeof e.combatIndex!="number")return;let a=this._difficulty,r=this._chapterProgress[a]||0;this._pendingCombat={chapter:this._planChapter,combatIndex:e.combatIndex,title:e&&e.title||"Combat",difficulty:a,nodeIndex:r},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_enterBattle(){let e=this._pendingCombat;e&&(this._formationBattleMode=!1,this._combatNode={...e},this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatNonce=0,this._combatPreset=null,this._combatPhase="loading",this._hudView="combat",this._renderBrowser())}_loadBattle(){if(this._battleLoading)return;this._battleLoading=!0;let e=this._combatNode;if(this._combatError="",this._combatPhase="loading",this._renderBrowser(),!this._run||!e){this._battleLoading=!1,this._combatPhase="error",this._renderBrowser();return}(e.farm?this._postJson("/farm/battle",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}):this._postJson("/battle",{runId:this._run.runId,chapter:e.chapter,combatIndex:e.combatIndex,difficulty:this._difficulty,presetIndex:this._combatPreset})).then(r=>{if(r&&r.ok&&Array.isArray(r.allies)&&Array.isArray(r.enemies)){this._combat=r,this._combatPreset=typeof r.activePreset=="number"?r.activePreset:this._combatPreset,this._combatNode={...e,objective:r.objective||""};let s=ai({allies:r.allies,enemies:r.enemies,seed:ti(r.battleKey||e.combatIndex)});this._combatSteps=s.steps,this._combatResult=s.result,this._combatPhase="prebattle"}else this._combatError=r&&r.error||"",this._combatPhase="error"}).then(()=>{this._battleLoading=!1,this._farmBusy=!1,this._hudView==="combat"&&this._renderBrowser()})}_pickCombatPreset(e){!this._run||this._combatPreset===e||(this._combatPreset=e,this._loadBattle())}_combatFinished(e){if(this._combatOutcome)return;if(this._combatOutcome=e==="lose"?"lose":"win",this._stopCombat(),this._combatOutcome==="win"){this._exitCombat(!0);return}let a=this._combatNode,r=!!(a&&a.farm);setTimeout(()=>{this._combatOutcome==="lose"&&this._openResult({outcome:"lose",where:a&&a.title||"",rewards:[],rank:null,canReplay:!0,back:this._battleBack(a),again:a||null})},Xf)}_exitCombat(e){let a=this._combatNode;if(e&&(this._combatOutcome||this._combatResult)==="win"){this._stopCombat(),a&&a.farm?this._claimFarm():this._completeCombatNode();return}if(e&&a){let s=!!a.farm,n=s&&this._pendingFarm?{...this._pendingFarm}:null;s&&(this._pendingFarm=null),this._openResult({outcome:"lose",where:s?this._farmStageLabel(n):this._titleOfNode(a),rewards:[],relic:null,rank:null,back:this._battleBack(a),canReplay:!0,again:s?n:a}),s&&a.stage!=="seasonal"&&this._loadFarm();return}this._leaveCombat(this._battleBack(a))}_battleBack(e){return!e||!e.farm?"chapter":e.stage==="seasonal"?"events":"farm"}_leaveCombat(e){this._stopCombat(),this._hudView=e,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,e==="farm"&&(this._pendingFarm=null),this._renderBrowser()}_completeCombatNode(){let e=this._combatNode;if(!this._run||!e)return;let a=e.difficulty||this._difficulty,r=typeof e.nodeIndex=="number"?e.nodeIndex:this._chapterProgress[a]||0;if((this._chapterProgress[a]||0)!==r)return;this._chapterProgress[a]=r+1;let s=this._nodeTitle(r);this._postJson("/complete",{runId:this._run.runId,chapter:e.chapter,difficulty:a,nodeIndex:r}).then(n=>{!(n&&n.ok)&&n&&n.error!=="lost"&&(this._chapterProgress[a]||0)===r+1&&(this._chapterProgress[a]=r),this._afterComplete(n,s)}).catch(()=>{(this._chapterProgress[a]||0)===r+1&&(this._chapterProgress[a]=r),this._renderBrowser()})}_openSummon(){this._hudView="summon",this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._renderBrowser()}_loadSummonBanner(){if(this._summonBannerState="loading",this._renderBrowser(),!this._run){this._summonBannerState="error",this._renderBrowser();return}let e=this._summonBannerId;this._postJson("/summon-banner",{runId:this._run.runId,banner:e}).then(a=>{this._summonBannerId===e&&(a&&a.ok&&a.banner?(this._summonBanner=a,this._summonBannerState="ready",this._ensureBannerArt(a.banner)):this._summonBannerState="error")}).then(()=>{this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()})}_redoBannerArt(){this._paintBannerArt(this._summonBannerId,!0)}_ensureBannerArt(e){!e||!e.canArt||e.art||this._paintBannerArt(e.id,!1)}_paintBannerArt(e,a){!this._run||this._summonArting||!e||(this._summonArting=!0,this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:e,force:!!a})).then(r=>{if(this._summonBannerId===e&&r&&r.ok&&r.art&&this._summonBanner&&this._summonBanner.banner){this._summonBanner.banner.art=r.art;let s=(this._summonBanner.banners||[]).find(n=>n&&n.id===e);s&&(s.art=r.art)}}).catch(()=>{}).then(()=>{this._summonArting=!1,this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()}))}_closeSummonHistory(){this._summonHistoryOpen=!1,this._summonHistory=null,this._summonHistoryState="idle",this._summonHistoryPage=1}_loadSummonHistory(e){if(!this._run)return;let a=Math.max(1,Number(e)||1);this._summonHistoryPage=a,this._summonHistoryState="loading",this._renderBrowser();let r=this._summonBannerId;this._postJson("/summon/history",{runId:this._run.runId,banner:r,page:a}).then(s=>{!this._summonHistoryOpen||this._summonBannerId!==r||(s&&s.ok?(this._summonHistory=s,this._summonHistoryPage=Number(s.page)||a,this._summonHistoryState="ready"):this._summonHistoryState="error",this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser())})}_summonPull(e){if(!this._run||this._summonPulling)return;this._summonPulling=!0;let a=this._summonBannerId;this._postJson("/summon",{runId:this._run.runId,banner:a,count:e===10?10:1}).then(r=>{this._summonPulling=!1,r&&r.ok&&Array.isArray(r.results)&&(this._summonResults=r.results,this._summonBannerState="idle",this._summonBanner=null,this._closeSummonHistory(),this._rosterCount+=r.results.filter(s=>s&&s.isNew).length,this._summonPhase="reveal",this._renderBrowser())})}_openFormation(){this._formationBattleMode=!1,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_loadFormation(){if(this._formationState="loading",this._renderBrowser(),!this._run){this._formationState="error",this._renderBrowser();return}this._postJson("/formation",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._formation=e,this._formationState="ready"):this._formationState="error"}).then(()=>{this._hudView==="formation"&&this._renderBrowser()})}_saveFormation(e,a){this._run&&(this._formation&&(this._formation={...this._formation,presets:e,active:a}),this._postJson("/formation/save",{runId:this._run.runId,presets:e,active:a}).then(r=>{r&&r.ok&&Array.isArray(r.presets)&&this._formation&&(this._formation={...this._formation,presets:r.presets,active:r.active})}))}};typeof customElements<"u"&&!customElements.get(rc)&&customElements.define(rc,ms);
