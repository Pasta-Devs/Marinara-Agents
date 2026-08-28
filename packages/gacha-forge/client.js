var $a=`
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

  /* The type ramp lives in theme.js on .gf-view/.root; only the SPACING is local, built from --f.
     --f is geometric and must not carry the player's text scale, or the whole layout would grow
     against a fixed 16:9 stage. cqh requires container-type: size on THIS element. */
  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
  --sp-5: calc(var(--f) * 3.6);
}

/* \u2500\u2500 THE SCREEN: two rows, and neither scrolls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The scene is minmax(0, 1fr) \u2014 the elastic row \u2014 and the dock is auto. The dock has no height of
   its own: its padding is geometric and its content is type, so the text-scale control grows the
   dock and the SCENE pays the difference. */
.hm-screen {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  pointer-events: auto;
}

/* The background hangs off the SCREEN and not off the scene, so it bleeds behind the dock: the
   dock reads as floating on the art while still being a real grid row that can never overlap it. */
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

/* The scene is a ROW. Flex and not grid: the plate's width comes from its height through the
   2:3 ratio, and a grid auto track would have to resolve width-from-height and
   height-from-content at once, which is circular. */
.hm-scene { position: relative; min-height: 0; z-index: 2; display: flex; align-items: stretch; }

/* The rail and the Battle block are IN FLOW with margin-top auto, never absolutely anchored:
   anchored, the gap between them was a leftover that shrank as the text scaled; in flow it has a
   floor and cannot go negative. */
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
   A portrait carries its own painted scene, so fading its edges leaves a patch of somewhere else
   floating on the chosen background. It is the same plate as the VN speaker: one art with two
   treatments reads as two objects.
   The edge is drawn as BACKGROUND, not border \u2014 clip-path cuts the border box and a real
   border comes out unstroked along the diagonal. Width comes from HEIGHT through the ratio, and
   the height is a knob tuned so the chosen background stays visible. */
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
/* THE ART TAKES THE FRAME'S CORNER TOO. --plate-clip-left is a polygon in the default style
   and none in four of the five, and where it is none the only thing shaping this corner is the
   frame's border-radius -- which a child does not inherit and an absolutely positioned one is not
   clipped by. So the picture squared off the rounded corner and hung out of its frame: measured,
   it shows in the three styles with a big radius (14, 20 and 18px) and hides in the 2px one, which
   is exactly the three the user reported. The radius is DERIVED from the frame's, minus the edge
   this box is inset by, so the two can never disagree. */
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
   The plate IS the control for the unit and the chip IS the control for the background: you click
   the slot, same pattern as Gear. A name plate says the name and nothing else. */
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
/* It WRAPS, never truncates: an ellipsis eats the chosen name at the default scale, and an
   N-line clamp is the same lie once text scales. It grows upward, over art. */
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

/* The unit's name plate lives INSIDE the plate, resting on its foot veil: it is the same piece,
   not a label beside it. No background of its own \u2014 the art's veil already is the background, and
   a second opaque box on top would be a plate inside a plate. */
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
   Beside the unit, where the reference puts its own. It says where it goes and how the story
   stands \u2014 nothing else: anything more is writing on the Home what the destination already says. */
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
/* line-height 1.2 and not 1: at exactly 1 the glyph box can overshoot the line box on some
   styles. A line height that cannot contain its own font is a trap for the day the text changes. */
.hm-cta .big { font-family: var(--title); font-size: var(--t-xl); font-weight: 700; font-stretch: var(--stretch); letter-spacing: 0.04em; text-transform: var(--case); line-height: 1.2; }
.hm-cta .title { font-size: var(--t-md); font-weight: 700; font-stretch: var(--stretch); }
.hm-cta .nodes { display: flex; align-items: center; gap: calc(var(--f) * 0.35); flex-wrap: wrap; }
.hm-cta .nodes i { width: calc(var(--f) * 0.55); height: calc(var(--f) * 0.55); background: var(--steel-dark); transform: rotate(45deg); display: block; }
.hm-cta .nodes i.done { background: var(--coral); }
.hm-cta .nodes i.now { background: var(--amber); }
.hm-cta .nodes span { font-size: var(--t-xs); color: var(--porcelain-3); margin-left: calc(var(--f) * 0.4); }
.hm-cta .go { font-size: var(--t-sm); font-weight: 700; letter-spacing: 0.14em; text-transform: var(--case); color: var(--coral); }

/* \u2500\u2500 THE RIGHT RAIL: the less frequent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Continuity and Settings are NOT here \u2014 the bar already carries their doors, and a second door
   to the same place is duplication. Locked entries are drawn because no system exists behind
   them yet. */
.hm-rail { flex: none; display: flex; flex-direction: column; gap: var(--sp-1); align-items: stretch; width: 34%; }

/* \u2500\u2500 THE CONTEXT NOTICE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Drawn only once the story context passes the threshold: below it there is no element, and
   that absence IS the information. It sits in the right column between the rail and Battle,
   at the SAME 34% as both \u2014 a third width would split the column into two edges.
   IT MOVES NOTHING WHEN IT APPEARS, which is the property to measure, not whether it fits: a
      full-width band pushed the Battle block up 68px, so the screen changed shape under the
      player. Here it eats slack from the rail-Battle gap, which is in FLOW with margin-top
      auto and therefore has a floor. Measured with and without: 20/418/634 either way.
   Two lines only: what counts, how much against how much, and where the click leads. The
      numbers come from the payload, never written here.
   In ember --coral and --amber are both golds, so this notice and the Battle block separate
      by the tinted fill, not by the edge. */
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
/* All text OPAQUE: on the glass styles a colour faded with transparent composites against the
   stage and gives a different contrast per style. The hierarchy is carried by SIZE. */
.hm-warn .k { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.hm-warn .n { font-family: var(--display); font-size: var(--t-sm); color: var(--text); font-variant-numeric: tabular-nums; }
.hm-warn .n b { color: var(--amber); }
/* The reason goes IN the control: one word, where the player is already looking. */
.hm-warn .go {
  margin-left: auto; flex: none;
  font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case);
  color: var(--amber);
}
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
  /* The height comes from the PADDING, and the padding is geometric: growing the box this way
     keeps it still when the player scales the text, and the scene absorbs the difference. */
  padding: calc(var(--f) * 1.05) var(--sp-2);
  --cut: 0.45em;
  clip-path: var(--clip-chip);
  border-radius: var(--radius-sm);
}
.hm-side:hover { border-color: var(--coral); }
.hm-side .lbl { display: flex; align-items: center; gap: calc(var(--f) * 0.5); min-width: 0; }
.hm-side svg { width: calc(var(--f) * 1.45); height: calc(var(--f) * 1.45); flex: none; color: var(--steel-faint); }
/* The reason goes IN the control, not in a paragraph beside it: a disabled button with no reason
   is as bad as the extra paragraph, and one word where the player is already looking is enough. */
.hm-side .soon { font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
/* A live rail entry must differ from a locked one before hover: the same grey glyph on both
   reads as two locked doors. */
.hm-side:not(.off) svg { color: var(--steel); }
.hm-side.off { cursor: default; }
.hm-side.off:hover { border-color: var(--ink-3); }
.hm-side.off .lbl { color: var(--porcelain-3); }

/* \u2500\u2500 THE DOCK: the most frequent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Materials is deliberately absent: it is a MODE, so its door is Battle, and a tile here would be
   two doors to one screen. With grid-auto-flow column, adding a door is one entry in DOCK. */
.hm-dock {
  position: relative;
  z-index: 3;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2) var(--sp-2);
}
/* ICON AND NAME, nothing else: a dock button names a place, and its number lives inside the
   destination. The every-sentence-carries-its-number rule is for sentences that EXPLAIN; a
   navigation label explains nothing. */
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
/* clip-path clips an outline away, so the focus ring is drawn inside. */
.hm-tile:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--coral); }
.hm-tile svg { flex: none; width: calc(var(--f) * 2.4); height: calc(var(--f) * 2.4); color: var(--coral); }
.hm-tile .nm { min-width: 0; font-size: var(--t-md); font-weight: 700; font-stretch: var(--stretch); letter-spacing: 0.04em; text-transform: var(--case); line-height: 1.05; }
.hm-tile.summon svg { color: var(--amber); }
/* A door that has not opened yet. It is drawn NOW and locked so the dock does not change shape
   under the player the day it ships \u2014 the same mechanism as the four relic slots, drawn with their
   glyph and their Soon months before they existed. Turning it on is changing one false in DOCK. */
.hm-tile.off { cursor: default; opacity: 0.62; }
.hm-tile.off:hover { transform: none; border-top-color: var(--steel-dark); }
.hm-tile.off svg { color: var(--steel-faint); }
.hm-tile .soon { margin-left: auto; font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }



/* \u2500\u2500 THE TWO SLOT PICKERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   One panel OVER the Home, not another screen. Same pattern as Gear: header with title and exit,
   side rail, and a card grid with contained scroll. ONE picker serves both slots \u2014 what changes
   between choosing a background and a unit is data. */
.hm-pk-wrap { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; pointer-events: auto; }

/* The house scrim, shared with the mode menu. */
.hm-pk-veil {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}

/* The panel is OPAQUE: the style's surface is painted over an opaque base. On the glass
   styles a translucent panel composites against the stage and the contrast shifts per style. */
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

/* The header says WHAT is being chosen and WHICH is in use \u2014 the current card may be scrolled
   out of view. */
.hm-pk-head { display: flex; align-items: baseline; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); border-bottom: 1px solid var(--ink-3); }
.hm-pk-head .ttl { font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.hm-pk-head .cur { min-width: 0; font-family: var(--body); font-size: var(--t-sm); color: var(--porcelain-3); overflow-wrap: anywhere; }
.hm-pk-head .x { margin-left: auto; flex: none; cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.hm-pk-head .x:hover { border-color: var(--coral); color: var(--coral); }

.hm-pk-body { display: grid; grid-template-columns: auto minmax(0, 1fr); min-height: 0; }

/* The rail: for the background the SOURCES (BG_SOURCES, unopened ones locked); for the unit the
   rarities from RARITY_TIERS, the same list the roster's pills read. */
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
/* The reason goes IN the control: a disabled button with no reason is as bad as an extra
   paragraph. */
.hm-pk-cat .soon { font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }

/* Cards with CONTAINED scroll: the house rule is that the SCREEN never scrolls; a grid
   inside its own box may. align-content start does not stretch rows to hide a gap. */
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
/* The one in use is marked with border AND word, never colour alone: an accent frame does
   not stand out equally on five palettes. */
.hm-pk-card.on { border-color: var(--amber); background: color-mix(in srgb, var(--amber) 12%, var(--ink-2)); }
/* The ASPECT comes from the ART, not the grid: backgrounds are landscape and portraits are
   tall, and a box-driven height crops a place beyond recognition. */
/* position: relative because the no-portrait card reuses the plate's .hm-figure, which is
   absolutely positioned: without an anchor here the silhouette anchors to the PANEL \u2014 a giant
   figure over the grid that also swallows every click under its box. First walked the day a
   world had a unit with no portrait at all. */
.hm-pk-card .shot { position: relative; width: 100%; aspect-ratio: 3 / 2; overflow: hidden; background: var(--ink-3); }
.hm-pk-card .shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
.hm-pk-card .nm { font-size: var(--t-xs); line-height: 1.25; overflow-wrap: anywhere; }
.hm-pk-card .kit { font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); overflow-wrap: anywhere; }
.hm-pk-card .kit b { color: var(--amber); font-weight: 700; }
.hm-pk-card .tag { font-size: var(--t-tiny); letter-spacing: 0.16em; text-transform: var(--case); color: var(--amber); }

/* The NONE card shows the gradient you will actually get, not an empty frame. It exists only
   for the background: there is always a unit, because the protagonist cannot be removed. */
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
`;var je="vanguard",Ue=[{id:"aurora",label:"Aurora",description:"Frosted glass and gold",swatch:["#171334","rgba(255,255,255,.10)","#E8C87A"]},{id:"bloom",label:"Bloom",description:"Bright and playful",swatch:["#2B3F63","#FFFFFF","#FF6E9C"]},{id:"signal",label:"Signal",description:"Technical and minimal",swatch:["#0C0D10","rgba(255,255,255,.10)","#C8FF3D"]},{id:"ember",label:"Ember",description:"Warm and painted",swatch:["#2C1E14","#6B4A2A","#F0B429"]},{id:"vanguard",label:"Vanguard",description:"Sharp and industrial",swatch:["#0E1725","#1E2C44","#F2603C"]}];function ja(t){return Ue.some(e=>e.id===String(t))}function it(t){return ja(t)?String(t):je}var nt=[1,1.15,1.3,1.5,1.75],Ua=1.15;function Ve(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return Ua;let a=nt[0];for(let r of nt)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}var bt=nt,ui=Ua;function We(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return ui;let a=bt[0];for(let r of bt)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}var vi='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',gi='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/></svg>',mi='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',bi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="11" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><path d="M6 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',yi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',wi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" stroke-width="1.7"/></svg>';function yt(t){let e=Math.max(0,Math.floor((Number(t)||0)/1e3)),a=Math.floor(e/60),r=e%60;return a+":"+String(r).padStart(2,"0")}function ze(t){return(Number(t)||0).toLocaleString("en-US")}function Va(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var Wa=new Set(["hud","modes","summon","roster","unit","formation","chapter","chapters","combat","farm","inventory","settings","events"]),Ga=`
.gf-bar {
  position: relative;
  z-index: 8;
  flex: none;
  display: flex;
  align-items: stretch;
  gap: var(--gf-sp-2);
  padding: var(--gf-sp-2) var(--gf-sp-3);
  background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 92%, transparent) 0%, transparent 100%);

  /* The bar sits in the shell, outside any view, so it cannot use a view's container-query
     ramp. It measures the STAGE instead, with the same clamp so the two agree. */
  /* Ceiling raised to match the screens, but the WIDTH term only: this ramp lives on .gf-bar,
     whose container (.gf-stage) is inline-size, and an inline-size container provides no cqh at
     all \u2014 a height term here would silently fall back to the small viewport. The bar is a fixed
     strip anyway; it has no height of its own to fill. */
  /* The bar has its OWN ramp and still obeys the text-size control. A second ramp on purpose:
     the bar is a fixed-height strip and must not follow the stage's height \u2014 but if the control
     grew the screens and not the bar, a small bar would sit over a big game. The cap scales too,
     or the control's last step would hit a fixed ceiling. */
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
  /* It YIELDS, and yields first: the widest, least urgent piece. A name and an XP bar can be
     clipped; a stamina counter cannot. min-width: 0 is what lets a flex item shrink below its
     content \u2014 without it the browser treats it as untouchable and a neighbour pays. */
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
/* A box that holds TEXT is not sized with the geometric scale: tied to it, the text grows
   and the box does not, so the name clipped with room to spare beside it. The basis is the
   CONTENT (auto) with a cap in the TEXT ramp: it takes free room when there is some and yields
   when there truly is none. */
.gf-bar .xp { display: flex; flex-direction: column; gap: calc(var(--gf-f) * 0.35); min-width: 0; flex: 0 1 auto; max-width: calc(var(--gf-sm) * 16); }
/* \u{1F41E} A long commander name used to run into the XP figure. */
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
/* The track is DARK (--ink-3) and the fill is the ACCENT \u2014 the house pattern, same as the
   combat health bars. It used to be inverted, and full read as empty. */
.gf-bar .xp-bar { height: calc(var(--gf-f) * 0.4); background: var(--ink-3); }
/* The width comes from the account, inline. It used to be a hardcoded 68% left over from the
   mockup, so the bar painted two thirds full next to a label reading "0 / 300 XP". */
.gf-bar .xp-bar > i { display: block; height: 100%; width: 0; background: var(--coral); }

/* \u2500\u2500 The slot: the sub-screen's own head, moved in here \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* The build label. Deliberately quiet \u2014 it is a diagnostic you glance at, not information the
   player needs. It earns its place because the engine caches the client bundle by version
   (/client?v=<version>): if a reload did not take, this is the one thing that says so. */
/* Basis auto, NOT zero: with flex 1 1 0 the slot asks for nothing, so pieces that can yield
   never get asked and the hoisted title pays alone. With basis auto the content IS the base and
   the shortfall is shared. min-width 0 stays: if it still does not fit, the title clips \u2014 from
   its own size, not from zero. */
.gf-bar-slot { display: flex; align-items: center; gap: var(--gf-sp-2); min-width: 0; flex: 1 1 auto; overflow: hidden; }
.gf-bar-slot:empty { display: none; }
/* The hoisted title CLIPS, never pushes: it is the one piece of the bar with an arbitrary
   length, so it is the one that yields as text grows. */
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
/* The trailing counters the screen heads used to carry are gone from every screen: each rode
   the hoist into the bar and ate width from the title slot, and each screen already says the same
   thing row by row. Nothing emits them, so their rules went too. */
/* The Summon head carried its own Aether chip; the bar already shows Aether. */
.gf-bar-slot .wallet { display: none; }

/* Controls NEVER fall off the edge: the FIGURES yield. This group holds the currencies AND
   the buttons; as flex none nothing yielded, and on a narrow stage the figures pushed the
   buttons out of the box. What INFORMS yields; what is PRESSED never does \u2014 a clipped figure
   still says half, a button off screen says nothing. */
/* NO min-width zero here, and that is what holds the rule above. Zero is an explicit licence to
   shrink BELOW the content, so with rigid figures the group still yielded and its content spilled:
   measured at 175%, a 634px box for 680px of content and the whole bar overflowing 23px, which put
   the buttons back on their way off the edge. Without it the group's automatic minimum IS its
   content, and the one that yields becomes the title slot. */
.gf-bar .currencies { display: flex; gap: var(--gf-sp-1); margin-left: auto; align-items: stretch; flex: 0 1 auto; }
/* THE FIGURES NEVER SHRINK. They used to yield and clip, and at the 175% text step that stopped
   being graceful: measured, the three chips lost 13, 13 and 18px, so 64,640 was drawn as "64,64".
   A clipped NUMBER does not say half \u2014 it lies, because it reads as a different whole number. A
   clipped title reads as clipped. What yields is the title SLOT, which can do it honestly. */
.gf-bar .currencies > .currency { flex: none; }
/* Buttons and the build stamp never shrink. The stamp is the one thing that vanishes outright
   when even clipping is not enough: it is a diagnostic, not a control. */
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
/* Vigor is ONE line, like Aether and Funds: with the note below, the icon centred against
   two rows and the number read off-axis. And the width is RESERVED with tabular figures \u2014 the
   counter ticks every second and the value can jump, so without a minimum the pill would push
   its neighbours. */
.gf-bar .currency.vig .value { font-variant-numeric: tabular-nums; }
/* The counter always takes the same width (worst case is the over-the-cap word), so the pill
   never resizes and never moves its neighbours. */
/* The counter is NOTE-sized, not number-sized: moved out of .note it inherited the pill's
   font-size and read as big as the figure it annotates. No reserved width here \u2014 with tabular
   figures the counter never changes width. */
.gf-bar .currency.vig .refill {
  font-family: var(--display); font-size: var(--gf-tiny); letter-spacing: 0.08em;
  margin-left: calc(var(--gf-f) * -0.15);
}
.gf-bar .currency .dim { opacity: 0.45; }
.gf-bar .currency.aet .value { color: var(--amber); }
.gf-bar .currency.vig .value { color: var(--jade); }

/* The context chip LEFT the bar (its CSS, markup and live write went with it; this note is
   here so it does not come back). It was a permanent figure for a state that is almost never
   true, paying with width the bar does not have. Continuity lives inside Settings now, and the
   warning is a Home notice that appears only past the threshold. */

/* SQUARE, and the height of the ROW. The height comes from the row (align-self: stretch)
   and the width from the height (aspect-ratio 1): square by construction and sized like their
   neighbours by construction \u2014 no two numbers that can drift apart. A hand-picked side cannot
   follow a row that grows with the text-size control. */
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
/* The Runs door appears here only where the gutter cannot reach \u2014 the same narrow cut
   shell.js hides the gutters at. Never both at once: that would be a second door. */
/* The Runs door lives HERE and nowhere else. The gutter hid it twice over: it disappears in
   fullscreen, and it is whatever is left beside a 16:9 stage, which can be zero. The bar is on
   every game screen and depends on nothing being left over. ONE door: the gutter button left
   the markup. */
/* On a LANDSCAPE phone the gutters exist again, so the narrow-screen condition is the one
   that decides \u2014 the same one shell.js hides them with. */
.gf-bar .icon-button:hover { border-color: var(--coral); color: var(--coral); }
.gf-bar .icon-button:focus-visible { outline: 2px solid var(--coral); outline-offset: 2px; }
/* The glyph grows with the box: a tiny icon in a large button reads as an empty button. */
.gf-bar .icon-button svg { width: calc(var(--gf-f) * 2); height: calc(var(--gf-f) * 2); }

/* Leaving fullscreen used to be a floating button pinned to the stage corner, which
   landed ON TOP of this bar and covered the settings gear. When the bar is on screen the
   control belongs IN it; the floating one only exists on screens that have no bar. */
/* Always present, both ways. It used to appear only WHILE fullscreen, which meant a second,
   separate button had to live out in the gutter just to get in - two controls for one
   toggle, in two different places depending on state. One button that toggles is simpler to
   find and simpler to explain. */
`,wt="1.3.0";function Ya({username:t="",wallet:e=null,account:a=null,vigorNextMs:r=null}={}){let s=e&&typeof e=="object"?e:{},n=Number(s.aether)||0,i=Number(s.funds)||0,l=Number(s.vigor)||0,h=Number(s.vigorMax)||60,p=a||null,d=p?Math.max(1,Number(p.level)||1):1,o=p?p.xpNeeded?ze(Number(p.xp)||0)+" / "+ze(p.xpNeeded)+" XP":"MAX":"&mdash;",u=p&&Number(p.xpNeeded)||0,f=p?u>0?Math.max(0,Math.min(100,Math.round((Number(p.xp)||0)/u*1e3)/10)):100:0,v=Number.isFinite(r)?yt(r):"",w=t&&t.trim()||"Commander",g=w.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"C";return`
<header class="gf-bar">
  <div class="command">
    <div class="avatar">${Va(g)}</div>
    <div class="rank"><span data-bar-rank>${d}</span><small>RANK</small></div>
    <div class="xp">
      <div class="figure"><span>${Va(w)}</span><span data-bar-rankxp>${o}</span></div>
      <div class="xp-bar"><i data-bar-rankfill style="width:${f}%"></i></div>
    </div>
  </div>

  <div class="gf-bar-slot" data-bar-slot></div>

  <div class="currencies">
    <div class="currency aet">${vi}<div><div class="value" data-bar-aether>${ze(n)}</div></div></div>
    <div class="currency">${gi}<div><div class="value" data-bar-funds>${ze(i)}</div></div></div>
    <div class="currency vig">${mi}<div class="value"><span data-bar-vigor>${l}</span><span class="dim" data-bar-vigormax>/${h}</span></div><span class="refill" data-vigor-next>${v}</span></div>
    <button class="icon-button gf-runs-bar" type="button" data-open-runs aria-label="Worlds" title="Switch or start a world">${bi}</button>
    <button class="icon-button" type="button" aria-label="Game settings">${wi}</button>
    <button class="icon-button gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">${yi}</button>
  </div>
</header>`}function Ka(t,{wallet:e=null,account:a=null,vigorNextMs:r=void 0}={}){if(!t||typeof t.querySelector!="function")return!1;let s=h=>t.querySelector(h);if(!(s("[data-bar-aether]")?t:null))return!1;let i=(h,p)=>{let d=s(h);d&&d.textContent!==p&&(d.textContent=p)},l=e&&typeof e=="object"?e:null;if(l&&(i("[data-bar-aether]",ze(Number(l.aether)||0)),i("[data-bar-funds]",ze(Number(l.funds)||0)),i("[data-bar-vigor]",String(Number(l.vigor)||0)),i("[data-bar-vigormax]","/"+(Number(l.vigorMax)||60))),r!==void 0){let h=s("[data-vigor-next]");if(h){let p=Number.isFinite(r)?yt(r):"";h.textContent!==p&&(h.textContent=p)}}if(a){let h=Math.max(1,Number(a.level)||1),p=Number(a.xpNeeded)||0;i("[data-bar-rank]",String(h)),i("[data-bar-rankxp]",p>0?ze(Number(a.xp)||0)+" / "+ze(p)+" XP":"MAX");let d=s("[data-bar-rankfill]");if(d&&d.style){let o=p>0?Math.max(0,Math.min(100,Math.round((Number(a.xp)||0)/p*1e3)/10)):100;d.style.width=o+"%"}}return!0}function Xa(t,{nextMs:e,periodMs:a,onLanded:r}={}){if(!Number.isFinite(e))return()=>{};let s=Number(e),n=Number(a)>0?Number(a):0,i=Date.now()+s,l=()=>{let p=t&&t.querySelector?t.querySelector("[data-vigor-next]"):null;if(!p)return;let d=i-Date.now();if(d>0){p.textContent=yt(d);return}i=n?Date.now()+n:Date.now(),p.textContent=n?yt(n):"",r&&r()};l();let h=setInterval(l,1e3);return()=>clearInterval(h)}function Ja(t){let e=t.querySelector&&t.querySelector("[data-bar-slot]");if(!e||typeof e.appendChild!="function")return!1;let a=t.querySelector(".head")||t.querySelector(".cap-head")||t.querySelector(".sel-head");if(!a||!a.childNodes)return!1;for(;e.firstChild;)e.removeChild(e.firstChild);let r=a.parentElement,s=[];for(let i of Array.from(a.childNodes))i.classList&&i.classList.contains("gf-stay")?s.push(i):e.appendChild(i);for(let i of s)r&&typeof r.appendChild=="function"&&r.appendChild(i);let n=typeof e.querySelectorAll=="function"?e.querySelectorAll(".eyebrow"):null;if(n&&typeof n.length=="number")for(let i=n.length-1;i>=0;i-=1){let l=n[i];l&&typeof l.remove=="function"&&l.remove()}return typeof a.remove=="function"&&a.remove(),!0}function xi(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var ki=[["New","new","g-new"],["Changed","changed","g-changed"],["Bugfix","fixed","g-fixed"]];function xt(){return _i.map((t,e)=>({version:t.version||wt,now:e===0,body:ki.map(([a,r,s])=>{let n=Array.isArray(t[r])?t[r]:[];return n.length?'<div class="gf-log-grp '+s+'"><span class="k">'+a+":</span><ul>"+n.map(i=>"<li>"+xi(i)+"</li>").join("")+"</ul></div>":""}).join("")}))}var _i=[{version:null,new:["Inventory screen","Gear: weapons and relics","Form: three skill tracks","Facets for duplicates","Relic Vault and Tenet Trial open","Events, login and battle pass","Help Q&A in the rail"],changed:["Bigger text on unit cards"],fixed:["Unit levels update right away","Worlds list shows real progress","Story rewards always save"]},{version:"1.2.0",new:["Story chapters","Visual-novel narrator","Painted story locations","Continuity and compression"],changed:["Insight now farmed in Materials","Materials made roomier"],fixed:["Backlog readable in every style","Coin figures no longer clipped","World creation more reliable"]},{version:"1.1.0",new:["Materials farming","Formation","Level up and ascend"],changed:["Difficulty actually differs"],fixed:["Level cap could get stuck"]},{version:"1.0.0",new:["Forge a world from lorebooks","Banners and summoning","Unit roster and sheets"]}];function Kt(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var Za=[{id:"start",label:"Getting started"},{id:"summon",label:"Summoning"},{id:"units",label:"Your units"},{id:"fight",label:"Fights and farming"},{id:"story",label:"Story and events"}],Si='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';function kt(t,e){return'<details class="gf-faq-q" data-help="'+Kt(t.id)+'"'+(e?" open":"")+'><summary><span class="ic">'+Si+'</span><span class="q">'+Kt(t.q)+'</span></summary><p class="a">'+Kt(t.a)+"</p></details>"}function Qa(t){return Xt.filter(e=>e.topic===t)}var Xt=[{id:"about",topic:"start",q:"What is Gacha Forge?",a:"A gacha game built out of your own lorebooks. The model writes the cast, you pull for them on banners, and you take the ones you get through story chapters and farming runs."},{id:"summon",topic:"summon",q:"How do I get characters?",a:"You pull for them on a banner, in Summon. Each pull costs 160 Aether, so a ten-pull costs 1,600."},{id:"pity",topic:"summon",q:"What is pity?",a:"It stops a long dry streak. You are guaranteed a 4\u2605 or better every 10 pulls, and a 5\u2605 by your 80th. Each banner counts your pulls on its own."},{id:"featured",topic:"summon",q:"How long is a featured banner?",a:"It runs for 14 days, counted from the day it shows up. When it ends, its units are added to the permanent banner, so you can still pull them later."},{id:"dupes",topic:"summon",q:"What are duplicates for?",a:"Every extra copy of a character unlocks one of their 6 Facets, and each one changes how their kit behaves. A repeated weapon does not give you anything."},{id:"vigor",topic:"fight",q:"What is Vigor?",a:"Your stamina. Every fight costs some, and you get 1 point back every 3 minutes, which is 480 a day. It stops at 60, and that limit goes up by 1 each time your commander rank does."},{id:"aether",topic:"story",q:"Where does Aether come from?",a:"The login event gives you 1,000 a day, and the battle pass another 1,000 every 5 levels, which adds up to 16,000 over a season. Story and combat nodes pay 100 each."},{id:"levelcap",topic:"units",q:"Why won't a unit level up?",a:"Something is capping it. Ascending a unit raises its own limit through 20, 40, 50, 60, 70, 80, 90 \u2014 and on top of that, no unit can pass twice your commander rank."},{id:"materials",topic:"fight",q:"Where do materials come from?",a:"From Materials, inside Battle. There are 5 stages and 3 difficulties, costing 6, 8 and 10 Vigor a run. The harder ones give you less of a better material, and every card tells you what its run is worth."},{id:"gear",topic:"units",q:"Weapons or relics?",a:"Both, and they work differently. You choose a weapon on purpose, for its stat and because a 5\u2605 signature gives its owner a second skill. Relics are the random half: 4 slots, each rolling a main stat plus 4 subs."},{id:"form",topic:"units",q:"What is Form?",a:"It is how you train a unit's skills. There are three tracks \u2014 Ultimate, Passive and the weapon skill \u2014 and each goes up 10 levels, for 30% more at the end."},{id:"mandate",topic:"story",q:"Where do Mandates come from?",a:"One a week, from Day 6 of the login event, and 4 more spread across a battle-pass season. You need them for the last steps of Form."},{id:"combat",topic:"fight",q:"How does a fight work?",a:"Your team fights on its own, so what matters is who you bring. Fire beats Water beats Wind beats Earth beats Fire, and Light and Dark beat each other. A good matchup hits for 1.5x, a bad one for 0.75x."},{id:"cp",topic:"units",q:"What is CP?",a:"A rough score for how strong a unit is with everything it is carrying. Stages tell you the CP they expect: Materials asks for 2,000, then 80,000, then 200,000."},{id:"story",topic:"story",q:"Does replaying a beat cost?",a:"No. Once you have paid for a story beat you can reopen it as often as you like. Only a node you have not played costs Vigor: 5 for a story one, 8 for a fight."},{id:"context",topic:"story",q:"What is the context warning?",a:"It means your story is getting too long to fit in one prompt. Open Settings and use Continuity to compress the older chapters into a summary."},{id:"art",topic:"start",q:"Where does the art come from?",a:"Whichever image connection you picked when you made the world draws it: unit portraits, banner art and story backgrounds. You can turn it off in Settings, under Sources."}];var Ei={help:"left",changelog:"right"};function Ti(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var er=`

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

/* CONTAINED both ways, not fitted to one dimension: height + max-width fits to height only and
   breaks the ratio silently in a taller box. Positioned, so the view's absolute layout fills it. */
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

/* Never widen past 16:9: widening does not grant height, it eats it. Width-driven pieces grow and
   push what follows off the bottom. Every screen is built for 16:9. */
.gf-view { position: relative; flex: 1; min-height: 0; }


/* The HOST goes fullscreen, so it survives inner re-renders. */
:host(:fullscreen) .gf-arena { grid-template-columns: 1fr; padding: 0; }
:host(:fullscreen) .gf-gutter { display: none; }
/* Fullscreen KEEPS the ratio. Filling and fitting are identical on a 16:9 monitor, which is why
   this hid for so long; on a landscape phone filling squashes the height. */
:host(:fullscreen) .gf-stage { border: 0; }

/* \u2500\u2500 side gutters: the "Runs" entry (meta-control, outside the box) + news / feed \u2500\u2500 */
/* A CONTAINER, so what lives here can answer to the width it actually got. The gutter is
   whatever is left beside a 16:9 stage, so its width is (W - (H - engine chrome) * 16/9) / 2 --
   it follows the window's SHAPE, and a taller window makes it NARROWER, not wider. Measured:
   452px at 2200x900, 152px at 1920x1080, 153px at 1790x918, 81px at 1280x800.
   NOTE: it is display:none in fullscreen (above), and browser fullscreen removes the chrome,
   which makes the stage taller AND wider -- so the rail shrinks toward zero exactly when the
   player commits to the game. Nothing here is ever the only place something is said. */
.gf-gutter { container-type: inline-size; align-self: stretch; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem; padding: 0.3rem 0; overflow: hidden; }
.gf-gutter-title { font-size: 0.66rem; letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding-left: 0.2rem; }
/* \u2500\u2500 the left rail: the help Q&A, collapsed \u2500\u2500
   ONE scrolling region for the whole list, never one per question: siblings that each scroll
   split the height between them and none of them finishes showing its own. Same rule the
   changelog below follows, and the same the Summon detail strips had to learn. */
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
   stacks give it five different metrics and five different optical centres. The tick of every
   checkbox in the game was moved to a path for exactly this. */
.gf-faq-q .ic { flex: none; width: 0.6rem; height: 0.6rem; margin-top: 0.16rem; color: var(--steel); transition: transform 120ms ease; }
.gf-faq-q .ic svg { display: block; width: 100%; height: 100%; }
.gf-faq-q[open] .ic { transform: rotate(90deg); color: var(--coral); }
/* The answer lines up under the question text, not under the chevron: 0.5 padding + 0.6 icon +
   0.4 gap. And it WRAPS between words, never inside one -- see the changelog note below. */
.gf-faq-q .a { margin: 0; padding: 0 0.5rem 0.5rem 1.5rem; font-size: 0.68rem; line-height: 1.35; color: var(--porcelain-3); overflow-wrap: normal; word-break: normal; }
/* The changelog: the one region of the rail that SCROLLS, inside its own box -- the house rule
   is that the SCREEN never scrolls, and this lives outside the stage entirely. min-height 0 is
   what lets it cede: without it a flex item will not shrink below its content and the scroll
   escapes to the gutter, which has overflow hidden and would simply cut the oldest releases.
   The gutter is whatever is left beside a 16:9 stage, so it can be 0px wide and is gone in
   fullscreen -- nothing here may be the only place something is said. */
.gf-log { flex: 1 1 auto; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 0.7rem; padding-right: 0.2rem; }
.gf-log-rel { min-width: 0; background: linear-gradient(180deg, var(--ink-2), var(--ink)); border: 1px solid var(--ink-3); border-left: 2px solid var(--coral); padding: 0.55rem 0.6rem 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
/* The version LEADS the entry, and the running build wears the accent so you can tell at a
   glance which one you are on. The rule under it is what makes each release read as a BLOCK:
   without it the version was just one more small line in a column of small lines.
   NOTE: it led in the dim steel until it was measured against the plate it sits on -- 3.57:1 in
   vanguard and 3.83 in bloom, the two styles whose fronts are dark, on the one line that heads
   each block. A dim token is only dim where the palette expects it to be. */
.gf-log-rel .ver { font-family: var(--display); font-weight: 700; font-size: 0.86rem; letter-spacing: 0.08em; color: var(--text); font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--ink-3); padding-bottom: 0.35rem; }
.gf-log-rel.now .ver { color: var(--coral); border-bottom-color: color-mix(in srgb, var(--coral) 40%, transparent); }
.gf-log-grp { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
/* The three labels are the only thing that can be SCANNED here, so they carry the contrast: the
   bright text colour against dimmer items, and each kind its own accent -- jade for what is new,
   amber for what moved, steel for what was broken. Without this the panel read as one grey block. */
.gf-log-grp .k { font-family: var(--display); font-weight: 700; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text); }
.gf-log-grp.g-new .k { color: var(--jade); }
.gf-log-grp.g-changed .k { color: var(--amber); }
.gf-log-grp.g-fixed .k { color: var(--porcelain-3); }
/* NOTE: the third label is NEUTRAL, not a third hue. It read in the dim steel until it was
   measured against the plate it actually sits on: 3.57:1 in vanguard and 3.83 in bloom, DIMMER
   than the items it heads, which is the opposite of what these labels are for. The two light-front
   styles are where a dim token falls apart, and a per-style table is not the answer -- one token
   that reads on ink everywhere is. Measured after: 8.1 to 12.5 across the five. */
.gf-log-grp ul { margin: 0; padding: 0 0 0 0.7rem; list-style: none; display: flex; flex-direction: column; gap: 0.28rem; }
/* A long line WRAPS, never truncates: a clipped line lies about what shipped. Entries are kept
   to a label's length precisely so this rarely has to happen -- see changelog.js. */
/* The bullet is a LITERAL glyph, never a CSS escape. This sheet lives in a JS template
   literal, so JS resolves the backslash first and CSS gets a control character instead of a
   dot. Same reason the arrows elsewhere are literal. The build guards it. */
/* NEVER break a word. anywhere shattered them in a narrow rail -- measured at 33px of text
   width it drew Inven/tory/scree/n, which is worse than saying nothing. Wrapping between
   words is the only honest option; when even that will not fit, the panel hides itself. */
.gf-log-grp li { position: relative; font-size: 0.72rem; line-height: 1.3; color: var(--porcelain-3); overflow-wrap: normal; word-break: normal; }
.gf-log-grp li::before { content: "\u2022"; position: absolute; left: -0.7rem; color: var(--steel-dark); }
/* FAIL HIDDEN, never fail-shredded. Below this the column cannot hold two words on a line, so
   both rails leave rather than draw broken text -- the same direction the shell already takes
   when it drops both gutters on a narrow screen. Nothing here may be the only place something is
   said, which is exactly why hiding it is allowed. */
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

/* ONE toggle, in two flavours by POSITION and never by state: inside the bar when a screen has
   one, floating at the stage corner when it does not. Exactly one is rendered at a time. */
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

/* No gutters on a narrow screen, and nothing else may live in this grid: the stage sizes itself
   against the ARENA, so an extra column breaks the ratio. Extra controls go in the bar. */
@media (max-width: 860px) {
  .gf-arena { grid-template-columns: 1fr; padding: 0.3rem; }
  .gf-gutter { display: none; }
}

/* PORTRAIT NOTICE. Shown by media query, so it costs no JS and no state. Coarse pointer is part
   of the test: a narrow desktop window is not a rotated phone. It hangs off the ARENA, not the
   stage, so it can use the letterboxed space. Its ramp comes from theme.js, not a local copy. */
.gf-rot { display: none; }
@media (orientation: portrait) and (pointer: coarse) {
  .gf-rot {
    position: absolute;
    /* Leaves the engine's chrome free. Both numbers are the engine's own (AppShell.tsx), and are
       a SECOND COPY of constants a package cannot import: if it moves its bar, this covers it. */
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
`,Ai='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ni='<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1" y="1" width="12.5" height="22" rx="2"/><rect x="18.5" y="6.5" width="14.5" height="11" rx="1.8"/><path d="M15.4 7.6a6 6 0 0 1 2.6-2.4" stroke-dasharray="2.2 1.8"/><path d="M18.4 4.2l-1 2 2.1.5"/></svg>',Ci=`
  <div class="gf-rot">
    <span class="gf-rot-ph">${Ni}</span>
    <h3 data-rot-title>Landscape only</h3>
    <p data-rot-note>This game plays in a 16:9 landscape frame.</p>
    <button type="button" data-go-landscape>Play in landscape</button>
  </div>`;function Ii(t){let e=a=>!!(t&&typeof t.has=="function"&&t.has(a));return'<div class="gf-faq">'+Xt.map(a=>kt(a,e(a.id))).join("")+"</div>"}function tr(t,e){let a=e&&e.onToggle;if(!(!a||!t||typeof t.querySelectorAll!="function"))for(let r of t.querySelectorAll("details[data-help]"))r.addEventListener("toggle",()=>a(r.getAttribute("data-help"),!!r.open))}function Ri(){return'<div class="gf-log">'+xt().map(t=>'<section class="gf-log-rel'+(t.now?" now":"")+'"><div class="ver">'+Ti(t.version)+"</div>"+t.body+"</section>").join("")+"</div>"}function ar(t,e){let a=it(e&&e.style),r=e&&e.entering?" data-enter":e&&e.swapping?" data-swap":"",s=Ei[e&&e.onScreen||""]||"";return`
<div class="gf-arena" data-style="${a}">
  ${Ci}
  <aside class="gf-gutter">
    ${s==="left"?"":`<div class="gf-gutter-title">Help</div>${Ii(e&&e.help)}`}
  </aside>

  <div class="gf-stage">
    ${e&&e.bar?"":`<button class="gf-fs-exit" type="button" title="Fullscreen" aria-label="Toggle fullscreen">${Ai}</button>`}
    ${e&&e.bar||""}
    <div class="gf-view"${r}>${t}</div>
  </div>

  <aside class="gf-gutter">
    ${s==="right"?"":`<div class="gf-gutter-title">Changelog</div>${Ri()}`}
  </aside>
</div>
<style>${Ga}</style>`}var Li="marinara_admin_secret";function Mi(){try{if(typeof localStorage>"u")return{};let t=(localStorage.getItem(Li)||"").trim();return t?{"X-Admin-Secret":t}:{}}catch{return{}}}function be(t,e){let a=e&&typeof e=="object"?e:{};return fetch(t,{...a,headers:{...Mi(),...a.headers||{}}})}var rr=`
/* THE TYPE SCALE AND RAMP, DECLARED ONCE. It used to be copied identically into every screen
   file; a copy that drifts leaves that screen with different type and nothing fails.
   Declared on .gf-view AND .root: the first is how the shell mounts, the second is how a harness
   mounts a lone screen \u2014 ONE rule with two anchors, not two sources.
   cq units resolve against .gf-stage, the container: it cannot be declared on the stage itself,
   because an element cannot query itself. */
/* .gf-rot BELONGS IN THIS SAME SELECTOR, never on a ramp of its own: it hangs off the
   shell's arena, OUTSIDE .gf-view, and without this line --f does not exist there \u2014 the token is
   read, undeclared, and thrown away silently. One line here; one ramp. */
.gf-view, .root, .gf-rot {
  /* --f IS GEOMETRIC AND DOES NOT CARRY THE PLAYER'S SCALE, on purpose: the spacings, strip
     heights and box sizes hang from it, so multiplying it grows the whole LAYOUT against a 16:9
     stage that cannot scroll. The text-size control moves the TEXT inside boxes that stay put. */
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
   Declared on the shell so every mounted view inherits it. The per-view scale
   tokens (--f and the type/space ramp built from it) are NOT here: they depend on
   container queries against each view's own .root and must stay local to it.
   Never write a star-slash pair inside these comments \u2014 it closes the comment
   early and the rest of the block is parsed as garbage CSS. */
.gf-arena {
  /* motion */
  /* A long, gentle out-curve: most of the motion happens early and it settles slowly,
     which is what reads as "smooth" rather than snappy. */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 160ms;
  --dur: 380ms;
  --dur-swap: 220ms;

  /* Shape. The three chamfers the screens actually use: a cut bottom-right corner (cards
     and rows), a cut top-left corner (chips), and a slanted right edge (buttons).
     \u{1F511} Each ELEMENT sets its own --cut, because the cut size varies with the element, and
     the clip is written in terms of it. A rounded style overrides the clips with none, so
     the element's own --cut becomes irrelevant and --radius takes over. Setting --cut to 0
     would NOT work: a zero-cut polygon is still a rectangle clip, and it would shave off
     the rounded corners. */
  --cut: 0.7em;
  --clip-card: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%);
  --clip-chip: polygon(var(--cut) 0, 100% 0, 100% 100%, 0 100%);
  --clip-btn: polygon(0 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
  /* The VN speaker frame. It needs its own cut because --clip-chip cannot be reused: on a chip
     that polygon shaves a small corner, but it slants the WHOLE left side, so on a full-height
     column it would cut an enormous diagonal across the art. Only the frame's inner-top corner is
     exposed (the outer flank and the foot run into the screen edge), hence one polygon per side.
     --plate-cut is in em on purpose: --f lives on each screen's .root (it depends on that
     screen's container query) and does NOT exist here, so a value built from it would compute
     invalid at this level, inherit down empty, and make clip-path fall back to none in silence. */
  --plate-cut: 1.7em;
  --plate-clip-right: polygon(var(--plate-cut) 0, 100% 0, 100% 100%, 0 100%, 0 var(--plate-cut));
  --plate-clip-left: polygon(0 0, calc(100% - var(--plate-cut)) 0, 100% var(--plate-cut), 100% 100%, 0 100%);
  /* Shapes an SVG or a pseudo-element cannot take from a clip-path token. The loading emblem is
     drawn BOTH ways in one SVG and the style says which half is visible; the little status pip is a
     rotated square here and a dot in the rounded styles. Without these two the loading screen kept
     Vanguard's geometry under every palette. */
  --emblem-cut: block;
  --emblem-round: none;
  /* The CRT scanline wash over a full-bleed stage. A texture, not a colour, so it cannot come from
     the palette \u2014 and left fixed it made every world feel like the same hard-tech screen. */
  --scanlines: 0.2;
  --pip-rotate: 45deg;
  --pip-radius: 0;
  --radius: 0;
  --radius-sm: 0;
  --pill: 999px;

  /* Depth. Panels read these as a two-part box-shadow (shadow first, bevel second), so the
     "off" value cannot be none \u2014 a box-shadow of none, none is invalid CSS and the whole
     declaration would be dropped. A fully transparent shadow is the no-op instead.
     No backticks anywhere in this template literal, comments included: one breaks the build. */
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
      These are the exact literals the HUD shipped with, so turning the theme on
      changes nothing until another style is chosen. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.gf-arena, .gf-arena[data-style="vanguard"] {
  /* The three ROLE tokens. --porcelain used to be both the light panel fill and the
     primary text, and --steel-dark both the text on that panel and a border on dark ones.
     One value can serve both only while the style is dark; a light style needs a white
     card with near-black text, so the roles are separate tokens now. In Vanguard they
     hold the same literals as before, which is why nothing moved on screen. */
  --text: #EDF1F6;        /* primary text on the dark ground */
  --surface: #EDF1F6;     /* the light panel fill */
  --on-surface: #23374F;  /* text sitting on that light panel */
  /* Text on the primary action. Was hardcoded as #FFF3EF in 29 places, which would have
     made Signal's acid-green button unreadable. Pure white rather than the old warm white
     purely to clear 3:1 on coral (2.97 -> 3.05); the difference is not visible. */
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

  /* Affinity colours. Two naming schemes exist because the screens grew apart:
     formation.js reads --af-*, combat.js reads the bare names. Both are kept so this
     refactor stays behaviour-identical; unifying them is its own small cleanup. */
  --af-fire: #F2603C; --af-water: #3E8FD8; --af-wind: #2E9E7B;
  --af-earth: #C9902B; --af-light: #F0D060; --af-dark: #9B6FD4;
  --fire: #F2603C; --water: #4A9BD4; --wind: #2EBE9E;
  --earth: #F0B429; --light: #F5E3A2; --dark: #9B6FD4;

  /* The backdrop. Every screen paints its own gradient with its own geometry \u2014 the angles
     differ on purpose \u2014 but they all draw from these four colours, so tokenising the
     COLOURS and leaving the geometry alone is what makes a style reach the background
     without flattening the screens into one another. */
  --glow-1: #2B3D57;
  --glow-2: #1A2740;
  --ground-1: #17212F;
  --ground-2: #0B1119;
}


/* \u2500\u2500 2 \xB7 AURORA \u2014 frosted glass and gold \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      There is no opaque light card here: --surface is translucent white glass and
      --on-surface stays light, which is exactly what splitting the roles bought us. */
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
      The one light style. The PAGE is a deep blue-grey and the cards are white on
      top of it: the first pass was white on near-white and everything dissolved. */
.gf-arena[data-style="bloom"] {
  --scanlines: 0;
  --text: #EAF1FC;
  --surface: #FFFFFF;
  --on-surface: #16233A;
  --on-coral: #FFFFFF;

  /* Darker than the page gradient on purpose: the panels have to separate from the
     ground, and a lighter ink left --steel with no room to read on both white cards
     and dark panels at once (it measured 2.85). */
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
      Like Aurora, the panels are dark: --surface is a warm brown and --on-surface
      is the parchment tone that sits on it. */
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
   Regions inside a screen may scroll (a roster grid, a log), and the browser's default
   bar looks nothing like the game. These follow the style like everything else: square
   and steel in Vanguard, rounded where --radius-sm is set. Both syntaxes are here \u2014
   the standard one for Firefox, the WebKit pseudo-elements for Chromium. */
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
   Every repaint replaces the view's markup wholesale, which read as a hard cut. There
   are TWO kinds, because they are not the same event:

     [data-enter]  you moved to a different SCREEN \u2014 a fuller move, with a slight rise
     [data-swap]   the same screen repainted with new content (another banner, another
                   roster tab) \u2014 a short cross-fade, no movement, so it reads as the
                   content changing rather than the screen changing

   The bar is deliberately outside the animated view: it stays put while the content
   moves under it, which is what makes the whole thing feel anchored. */
@keyframes gf-view-enter {
  from { opacity: 0; transform: translateY(1.1%) scale(0.992); }
  to { opacity: 1; transform: none; }
}
@keyframes gf-view-swap {
  from { opacity: 0; transform: translateY(0.5%); }
  to { opacity: 1; transform: none; }
}
.gf-view[data-enter] { animation: gf-view-enter var(--dur) var(--ease) both; }
/* A swap animates the CONTENT REGION, never the whole screen. Fading the view dipped the
   header and the tab bar too \u2014 so switching a tab made the control you had just clicked blink at
   you, which read as a flash rather than as content changing. A screen opts in by marking its body
   "gf-swap"; one that marks nothing simply does not animate, which is still better than a flash. */
.gf-view[data-swap] .gf-swap { animation: gf-view-swap var(--dur-swap) var(--ease) both; }

@media (prefers-reduced-motion: reduce) {
  .gf-view[data-enter], .gf-view[data-swap] .gf-swap { animation-duration: 0.01ms; }
}
`;var _t={funds:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/></svg>',xp:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.2 5 5.3.5-4 3.6 1.2 5.3L12 14.7 7.3 17.4l1.2-5.3-4-3.6L9.8 8z"/></svg>',asc:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',relic:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3h8l4 6-8 12L4 9z"/><path d="M4 9h16M8 3l-1 6 5 12 5-12-1-6"/></svg>',aether:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 4 12l8 10 8-10z"/><path d="M4 12h16M12 2v20"/></svg>',form:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M8.5 7.5h6M8.5 11h4"/></svg>',mandate:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M9.6 9.2l1.7 1.7 3.1-3.4"/><path d="M8 13.4 6.5 21l5.5-2.6L17.5 21 16 13.4"/></svg>',rank:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.6 5.6L21 9.4l-4.5 4.3 1.1 6.3L12 17l-5.6 3 1.1-6.3L3 9.4l6.4-.8z"/></svg>'};function Ie(t){return _t[String(t)]||_t.funds}function St(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var Bi=["Breakwater clash","Pier skirmish","Drowned checkpoint","The undertow","Last berth"],zi=10,Zt=[{key:"normal",label:"Normal",all:!0,tag:""},{key:"hard",label:"Hard",all:!1,tag:"Rare"},{key:"veryhard",label:"Very Hard",all:!1,tag:"Epic"}],sr=t=>Zt.find(e=>e.key===t)||Zt[0],Fi=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function we(t){return Fi[t]||String(t)}function nr(t){if(t&&Array.isArray(t.nodes))return t.nodes;let e=t&&Array.isArray(t.storyNodes)?t.storyNodes:[],a=[];for(let r=0;r<e.length;r+=1)a.push({type:"story",title:e[r].title,goal:e[r].goal,guide:e[r].guide}),a.push({type:"combat",title:Bi[r]||`Battle ${r+1}`,setup:""});return a}function Qt(t){return nr(t).filter(e=>e.type==="combat").length}function Ge(t,e){let a=nr(t),r=[],s=0,n=0;for(let i of a)i.type==="combat"?(r.push({...i,type:"combat",title:i.title||`Battle ${n+1}`,setup:i.setup||"",combatIndex:n}),n+=1):(r.push({...i,type:"story",title:i.title||`Story beat ${s+1}`,storyIndex:s}),s+=1);return sr(e).all?r:r.filter(i=>i.type==="combat")}function Oi(t,e,a){return t==="normal"?!0:t==="hard"?(e.normal||0)>=zi:(e.hard||0)>=(a||0)}var ir=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */






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

/* Fills the 16:9 stage from its top (standalone: no engine game-surface buttons). */
/* hoistHeadIntoBar REMOVES the .cap-head once its contents move to the bar, so this box is left
   with TWO children, not three. Declared as three fixed rows, the scroll region landed on the
   second one -- an auto row, sized to its content instead of to the screen -- and the 1fr went to
   a row with nothing in it. So the third row is declared only while the head is still here, and
   the LAST row is the elastic one either way. Same shape farm.js and inventory.js use. */
.cap {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  pointer-events: none;
}
.cap:has(> .cap-head) { grid-template-rows: auto auto minmax(0, 1fr); }
/* And the padding goes with the head it left with, so the pills landed flush against the bar.
   Restored under :not() so it applies exactly in the hoisted case and never doubles up. */
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

/* THE NODE TALLY IS GONE, AND ITS CSS WITH IT. This header is HOISTED into the bar, so the
   "6 / 10 nodes" counter travelled up and ate 18 ramp units of an already oversubscribed title
   slot: measured at 1440x960 and 150%, the slot has 338px of 1381 and Back takes 155, and the
   title came out as "Sin crede...". The screen below already says it row by row (Cleared on
   each node). Same tally already removed from Roster and Formation, for the same reason.
   It leaves the MARKUP, not the hoist: emitting something for the hoist to throw away is
   drawing what nobody ever sees. */

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
/* --t-sm and NOT --t-xs: this line stopped being a label the day it carried the required CP,
   the number the player decides on. Measured, --t-xs rendered it at 8.67px. A paragraph cannot
   use a label's token. */
.diff-hint { margin-left: auto; font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
/* The NUMBER cannot share the sentence's muted tone: a figure the player has to read, painted
   with a label's token, already measured 1.4:1 once, i.e. absent. */
.diff-hint b { color: var(--text); font-weight: 700; }

.cap-scroll { min-height: 0; overflow: auto; pointer-events: auto; }
/* The Preview band left with the view that produced it: a locked difficulty can no longer be
   selected, so no click reaches that state. A stylesheet with no consumer never fails, which is
   why it goes now. */

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
/* Replaying a beat already seen. Drawn QUIETER than Start: a cleared row must not compete for
   the eye with the row you are on, the only one that moves the chapter. The green is the one
   from the Cleared mark it replaces, so the row does not change vocabulary. */
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

/* A map notice: why a node did not start. It goes where the player just tapped, not in a
   corner -- a reason you have to go looking for is a reason nobody reads. */
.notice { margin: 0 0 var(--sp-2); font-size: var(--t-sm); color: var(--coral); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Pi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',Di='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4l9 9M20 4l-9 9M14.5 14.5 20 20M9.5 14.5 4 20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',qi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 4 13.5h6L11 22l9-11.5h-6Z" fill="#2E9E7B" stroke="#1C6B54" stroke-width="1.2" stroke-linejoin="round"/></svg>';var Jt=t=>String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",");function Hi(t,e){let a=t&&t[e.type==="combat"?"combat":"story"];if(!a)return"";let r=(i,l)=>'<span class="prize">'+Ie(i)+l+"</span>",s=[];Number(a.funds)>0&&s.push(r("funds",Jt(a.funds))),Number(a.aether)>0&&s.push(r("aether",Jt(a.aether)));let n=Number(a.insight&&a.insight.shard)||0;return n>0&&s.push(r("xp",String(n))),Number(a.rank)>0&&s.push(r("rank","+"+Jt(a.rank))),`<span class="meta"><span class="cost">${qi}${Number(a.vigor)||0}</span>${s.join("")}</span>`}function $i(t,e,a){return t<a?e.type==="story"?`<button class="act again" type="button" data-replay="${t}"><span>Read again</span><small>&#10004; cleared &middot; free</small></button>`:'<span class="mark done">&#10004; Cleared</span>':t===a?e.type==="story"?'<button class="act play" type="button" data-play><span>Play</span><small>story beat</small></button>':'<button class="act start" type="button" data-start><span>Start</span><small>auto-battle</small></button>':'<span class="mark locked">&#128274; Locked</span>'}function ji(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function Ui(t,e){let a=t&&Number.isFinite(Number(t[e]))?Number(t[e]):null;return a===null?"Higher difficulty &middot; harder fight, better rewards":a<=0?"Opening chapter &middot; no CP asked yet":`Recommended CP <b>${ji(a)}</b> &middot; harder fight, better rewards`}function or({plan:t,difficulty:e,progress:a,chapterNumber:r=1,pay:s=null,cp:n=null,notice:i=""}){let l=sr(e),h=Ge(t,e),p=a[e]||0,d=t&&t.title||"Chapter",o=Qt(t),u=Zt.map(w=>{let g=w.key===e,x=Oi(w.key,a,o),S=x?"":'<span class="lock">&#128274;</span>',A=w.key==="hard"?"Clear Normal to unlock":"Clear Hard to unlock";return`<button class="diff-pill" type="button" role="tab" aria-selected="${g}" data-diff="${w.key}"${x?"":` disabled title="${A}"`}>${w.label}${S}</button>`}).join(""),f=h.map((w,g)=>{let x=g<p?"done":g===p?"current":"locked",S=w.type==="story"?"Story":"Combat",A=String(g+1).padStart(2,"0");return`<div class="node-row ${x}"><div class="node-rail"><span class="node-idx">${A}</span></div><div class="node-card"><span class="kind">${w.type==="story"?Pi:Di}${S}</span><span class="title">${St(w.title)}</span>`+Hi(s,w)+`</div><div class="node-action">${$i(g,w,p)}</div></div>`}).join(""),v=p>=h.length?`<div class="cap-end">${l.all?"Chapter":St(l.label)} complete</div>`:"";return`
<div class="root">
  <div class="stage"></div>
  <div class="cap">
    <div class="cap-head">
      <button class="back" type="button" data-back>&#9664; Command</button>
      <div class="cap-id"><div class="eyebrow">Chapter ${we(r)}</div><h2>${St(d)}</h2></div>
    </div>
    <div class="cap-diff">
      <div class="diff-pills">${u}</div>
      <span class="diff-hint">${Ui(n,e)}</span>
    </div>
    <div class="cap-scroll">
      <p class="notice"${i?"":" hidden"}>${St(i)}</p>
      <div class="node-list">${f}${v}</div>
    </div>
  </div>
</div>`}function lr(t,e){let{plan:a,difficulty:r,progress:s,onBack:n,onDifficulty:i,onPlayStory:l,onStartCombat:h,onReplayStory:p}=e,d=t.querySelector("[data-back]");d&&d.addEventListener("click",()=>n&&n());for(let g of t.querySelectorAll("[data-diff]"))g.addEventListener("click",()=>{g.disabled||i&&i(g.dataset.diff)});let o=Ge(a,r),u=o[s[r]||0],f=t.querySelector("[data-play]");f&&u&&f.addEventListener("click",()=>l&&l(u));let v=t.querySelector("[data-start]");v&&u&&v.addEventListener("click",()=>h&&h(u));let w=s[r]||0;for(let g=0;g<w&&g<o.length;g+=1){if(o[g].type!=="story")continue;let x=t.querySelector('[data-replay="'+g+'"]');x&&x.addEventListener("click",((S,A)=>()=>p&&p(S,A))(o[g],g))}}var Et=[{id:"all",label:"All"},{id:"5",label:"5&#9733;",tone:"g"},{id:"4",label:"4&#9733;",tone:"e"}];function de(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var ea={roster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20c0-2.8 2-4.6 4.6-4.6"/></svg>',formation:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="5.5" height="5.5"/><rect x="9.5" y="4" width="5.5" height="5.5"/><rect x="16" y="4" width="5.5" height="5.5"/><rect x="3" y="14" width="5.5" height="5.5"/><rect x="9.5" y="14" width="5.5" height="5.5"/></svg>',summon:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16l-1.4 12H5.4z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>',inventory:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5V18l-9 4.5L3 18z"/><path d="M3 9.5 12 14l9-4.5M12 14v8.5"/></svg>',events:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5V6h18v2.5a2 2 0 0 0 0 4V15H3v-2.5a2 2 0 0 0 0-4z"/><path d="M9 6v9" stroke-dasharray="2 2"/></svg>',missions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg>'},hr='<svg class="hm-figure" viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>',Vi=[{id:"roster",label:"Units",live:!0},{id:"formation",label:"Formation",live:!0},{id:"summon",label:"Summon",live:!0},{id:"shop",label:"Shop",live:!1},{id:"inventory",label:"Inventory",live:!0}],Wi=[{id:"events",label:"Events",live:!0},{id:"missions",label:"Achievements",live:!1}];function Gi(t,e){let a="";for(let r=0;r<t;r+=1){let s=r<e?' class="done"':r===e?' class="now"':"";a+=`<i${s}></i>`}return a}var Yi=[{id:"story",label:"Story",live:!0},{id:"banner",label:"Banners",live:!0},{id:"bond",label:"Bond",live:!1},{id:"event",label:"Events",live:!1},{id:"unit",label:"Units",live:!1}];function cr({kind:t,title:e,rail:a,source:r,items:s,current:n,currentName:i,none:l,emptyHint:h}){let p=a.map(f=>{let v=f.live!==!1;return'<button class="hm-pk-cat'+(v?"":" off")+'" type="button"'+(v?` aria-selected="${f.id===r}" data-pk-src="${de(f.id)}"`:" disabled")+`><span>${f.label}</span>`+(v?"":'<span class="soon">Soon</span>')+"</button>"}).join(""),d=f=>'<button class="hm-pk-card'+(f.key===n?" on":"")+`" type="button" data-pk-take="${de(f.key)}"><span class="shot">${f.url?`<img src="${de(f.url)}" alt="">`:hr}</span><span class="nm">${de(f.name)}</span>`+(f.kit?`<span class="kit"><b>${Number(f.rarity)||0}&#9733;</b> ${de(f.kit)}</span>`:"")+(f.key===n?'<span class="tag">In use</span>':"")+"</button>",u=(l?'<button class="hm-pk-card none'+(n?"":" on")+'" type="button" data-pk-take=""><span class="shot"><span>None</span></span><span class="nm">No background</span>'+(n?"":'<span class="tag">In use</span>')+"</button>":"")+(s.length?s.map(d).join(""):`<p class="hm-pk-empty">${de(h)}</p>`);return`
  <div class="hm-pk-wrap">
    <div class="hm-pk-veil" data-pk-close></div>
    <div class="hm-pk ${t}">
      <div class="hm-pk-head">
        <span class="ttl">${de(e)}</span>
        <span class="cur">${de(i||"None")}</span>
        <button class="x" type="button" data-pk-close>Close</button>
      </div>
      <div class="hm-pk-body">
        <div class="hm-pk-cats">${p}</div>
        <div class="hm-pk-grid">${u}</div>
      </div>
    </div>
  </div>`}function Ki(t,e,a){if(!t)return"";let r=e||{},s=a||{};if(t.slot==="bg"){let l=t.source||"story",h=r.backgrounds&&r.backgrounds[l]||[],p=s.bg?s.bg.key:"";return cr({kind:"bg",title:"Background",rail:Yi,source:l,items:h,current:p,currentName:s.bg?s.bg.name:"",none:!0,emptyHint:l==="banner"?"Banner art appears here once a banner has its picture painted.":"Story backgrounds are painted as your chapters reach a new place."})}let n=t.source||"all",i=(r.units||[]).filter(l=>n==="all"||String(l.rarity)===n);return cr({kind:"units",title:"Home unit",rail:Et,source:n,items:i,current:s.unit?s.unit.id:"",currentName:s.unit?s.unit.name:"",none:!1,emptyHint:n==="all"?"No characters yet.":`No ${n}-star characters yet. Summon on any banner to find one.`})}function dr(t){let e=Number(t)||0;return e>=1e3?(e%1e3===0?String(e/1e3):(e/1e3).toFixed(1))+"k":String(e)}var Xi='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.2v.6"/></svg>';function Ji(t,e){let a=Number(t)||0,r=Number(e)||0;return a>0&&r>0&&a>=r?'<button class="hm-warn" type="button" data-open-continuity aria-label="Story context is past your threshold \u2014 open Continuity"><span class="ic">'+Xi+'</span><span class="tx"><span class="k">Story context</span><span class="n"><b>'+dr(a)+"</b> / "+dr(r)+'</span></span><span class="go">Compress</span></button>':""}function pr({plan:t,chapterNumber:e=1,nodesDone:a=0,decor:r=null,contextTokens:s=0,warnTokens:n=0,pick:i=null,pickOptions:l=null}){let h=!!(t&&typeof t=="object"&&t.title),p=`Chapter ${we(e)}`,o=(h?Ge(t):[]).length||10,u=Math.max(0,Math.min(o,Number(a)||0)),f=r&&typeof r=="object"?r:{},v=f.bg&&f.bg.url?f.bg:null,w=f.unit||null,g=S=>`<button class="hm-tile ${S.id}${S.live?"":" off"}" type="button"`+(S.live?` data-go="${S.id}"`:" disabled")+">"+ea[S.id]+`<span class="nm">${de(S.label)}</span>`+(S.live?"":'<span class="soon">Soon</span>')+"</button>",x=S=>S.live?`<button class="hm-side" type="button" data-go="${S.id}"><span class="lbl">${ea[S.id]}<span>${de(S.label)}</span></span></button>`:`<button class="hm-side off" type="button" disabled><span class="lbl">${ea[S.id]}<span>${de(S.label)}</span></span><span class="soon">Soon</span></button>`;return`
<div class="root">
  <div class="hm-screen">
    ${v?`<img class="hm-bg" src="${de(v.url)}" alt="">`:'<div class="hm-ground"></div>'}
    <div class="hm-scrim"></div>

    <div class="hm-scene">
      <div class="hm-plate">
        <div class="hm-art">${w&&w.portrait?`<img src="${de(w.portrait)}" alt="">`:hr}</div>
        <button class="hm-slot hm-slot-unit" type="button" data-pick="unit">
          <span class="nm">${de(w&&w.name?w.name:"No unit set")}</span>
          <span class="swap">Change</span>
        </button>
      </div>

      <div class="hm-right">
        <button class="hm-slot hm-slot-bg" type="button" data-pick="bg">
          <span class="nm">${de(v?v.name:"No background set")}</span>
          <span class="swap">Change</span>
        </button>

        <div class="hm-rail">${Wi.map(x).join("")}</div>
${Ji(s,n)}
        <button class="hm-cta" type="button" data-open-modes>
          <span class="eyebrow">${de(p)}</span>
          <span class="big">Battle</span>
          <span class="title">${de(h?t.title:"Your world is forged")}</span>
          <span class="nodes">${Gi(o,u)}<span>${h?`${u} of ${o} cleared`:"Not started"}</span></span>
          <span class="go">${u>0?"Continue":"Begin"}</span>
        </button>
      </div>
    </div>

    <div class="hm-dock">${Vi.map(g).join("")}</div>
  </div>
${Ki(i,l,f)}
</div>`}function fr(t,{onOpenModes:e,onOpenRoster:a,onOpenSummon:r,onOpenFormation:s,onOpenInventory:n,onOpenEvents:i,onPickOpen:l,onPickClose:h,onPickSource:p,onPickTake:d}){for(let f of t.querySelectorAll("[data-open-modes]"))f.addEventListener("click",()=>e&&e());let o={roster:a,formation:s,summon:r,inventory:n,events:i};for(let f of t.querySelectorAll("[data-go]")){let v=o[f.getAttribute("data-go")];f.addEventListener("click",w=>{w&&typeof w.stopPropagation=="function"&&w.stopPropagation(),v&&v()})}(t.querySelector(".root")||t).addEventListener("click",f=>{let v=S=>f&&f.target&&f.target.closest?f.target.closest(S):null,w=v("[data-pick]");if(w){l&&l(w.getAttribute("data-pick"));return}if(v("[data-pk-close]")){h&&h();return}let g=v("[data-pk-src]");if(g){p&&p(g.getAttribute("data-pk-src"));return}let x=v("[data-pk-take]");x&&d&&d(x.getAttribute("data-pk-take"))})}var De=[{id:"world",label:"World",lead:"Chapters, banners and the cast you pull all grow from what you write here."},{id:"you",label:"You"},{id:"sources",label:"Sources",lead:"The forge <b>reads</b> your books &mdash; it never edits them."},{id:"look",label:"Look",lead:"All of it is per world, and none of it changes the game."}],Zi=[{value:"English",label:"English"},{value:"Japanese",label:"\u65E5\u672C\u8A9E"},{value:"Korean",label:"\uD55C\uAD6D\uC5B4"},{value:"Chinese",label:"\u4E2D\u6587"},{value:"Spanish",label:"Espa\xF1ol"},{value:"French",label:"Fran\xE7ais"},{value:"German",label:"Deutsch"},{value:"Polish",label:"Polski"},{value:"Portuguese",label:"Portugu\xEAs"},{value:"Russian",label:"\u0420\u0443\u0441\u0441\u043A\u0438\u0439"}],qe=[{id:"scenario",step:"world",type:"textarea",label:"Your gacha world",required:"Describe your gacha world before continuing.",maxLength:4e3,placeholder:"e.g. A drowned neon city where salvaged spirits are bound into cards and fight for the tide-courts\u2026",hint:"A theme, a tone, and what you collect.",wide:!0},{id:"language",step:"world",settings:"sources",group:"narrator",type:"select",label:"Narration language",options:Zi},{id:"name",step:"world",type:"text",label:"Name this run",maxLength:80,placeholder:"Untitled run"},{id:"protagonist",step:"you",type:"custom",render:"personas",label:"Your protagonist",required:"Pick your protagonist \u2014 a Marinara persona.",hint:"Their full sheet shapes the narration, not just their name.",wide:!0},{id:"username",step:"you",type:"text",label:"Your name",maxLength:40,placeholder:"Commander",hint:"Shown on your HUD profile &mdash; not the protagonist."},{id:"connectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Narrator connection",required:"Pick the connection that will narrate.",hint:"Only text models are listed &mdash; image/video connections can't narrate."},{id:"lore",step:"sources",settings:"sources",group:"lore",type:"custom",render:"lorebooks",label:"Lorebooks",help:"<b>Tick Cast only on a book whose entries are ALL characters.</b> Every entry is offered as a sheet to mint, so a place or a rule in that book gets minted as a unit.<br />Macros go in an entry&rsquo;s <b>description</b>: <b>[5STAR]</b> or <b>[4STAR]</b> picks its rarity slot, and <b>[ORDER1]</b>, <b>[ORDER2]</b>&hellip; set the order inside that rarity, lowest first. Case does not matter.",wide:!0},{id:"hudStyle",step:"look",type:"custom",render:"styles",label:"HUD style",wide:!0},{id:"images.connectionId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageConnections",label:"Image connection",emptyOption:"Off \u2014 no art at all"},{id:"images.portraits",step:"look",settings:"sources",group:"images",type:"toggle",label:"Hero portraits",default:!0,showIf:t=>!!t["images.connectionId"],hint:"Painted right after your founding cast &mdash; it adds a few minutes to this setup."},{id:"images.styleProfileId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageProfiles",label:"Portrait style",showIf:t=>!!t["images.connectionId"]},{id:"images.backgrounds",step:"look",settings:"sources",group:"images",type:"toggle",label:"Backgrounds",showIf:t=>!!t["images.connectionId"],hint:"Separate from portraits because it multiplies how many images a world paints."}],Qi=[{id:"narrator",label:"Narrator"},{id:"lore",label:"Lorebooks"},{id:"images",label:"Images"}];function ur(t){let e=Tt(t);return Qi.map(a=>({...a,fields:e.filter(r=>r.group===a.id)})).filter(a=>a.fields.length)}function Tt(t){return qe.filter(e=>e.settings===t)}function ta(t){return qe.filter(e=>e.step===t)}function Fe(t,e){return!t.showIf||!!t.showIf(e||{})}function eo(t){return qe.filter(e=>Fe(e,t))}function vr(t,e){for(let a of ta(t)){if(!a.required||!Fe(a,e))continue;let r=e?e[a.id]:null;if(r==null||r===""||Array.isArray(r)&&!r.length)return a}return null}function At(t){let e={};for(let a of eo(t)){let r=t[a.id];if(r===void 0)continue;let s=a.id.split("."),n=e;for(let i=0;i<s.length-1;i+=1)(!n[s[i]]||typeof n[s[i]]!="object")&&(n[s[i]]={}),n=n[s[i]];n[s[s.length-1]]=r}return e}var br=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
/* The UA rule [hidden] { display: none } LOSES against any author display declaration,
   so a flex/inline-flex element with the hidden attribute stays on screen. This screen
   toggles several of those, so the rule is enforced once here. */
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
/* NO SCROLL: the intake is split into steps you complete, and every step is sized to fit the
   16:9 stage. The frame centres the card and never grows past the stage. */
.ob-frame {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1rem, 3vw, 2.5rem);
}

/* Wider than it was, because the steps now hold four to six fields instead of one or two. The
   stage is 16:9 and never scrolls, so height is the scarce axis and width was simply unused. */
.ob-intake { width: min(900px, 100%); max-height: 100%; display: flex; flex-direction: column; gap: clamp(.7rem, 1.6vw, 1.1rem); }
/* Two fields to a row. min-width:0 on the children is not optional: a grid item defaults to
   min-content, so one long label or an unbreakable option would refuse to shrink and push the whole
   intake past the stage \u2014 sideways, the axis a no-scroll check forgets to measure. */
/* The grid is the step's CONTENT REGION and it scrolls INSIDE its box when the card runs out
   of height (a short window, or the no-connection banner adding a row). Every level of this card
   can flex-shrink, so without the overflow the FIELDS were the ones that gave way: they compressed
   below their content and their children painted over each other \u2014 the language select rode up
   into the world textarea. A field never shrinks; the region scrolls, which the house rule allows. */
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: max-content; gap: clamp(.6rem, 1.4vw, 1rem); align-content: start; flex: 1 1 auto; min-height: 0; overflow: auto; }
.ob-grid > * { min-width: 0; }
/* A field that needs the whole row says so in the schema, not here. */
.ob-wide { grid-column: 1 / -1; }
/* Its own class, not a borrowed one. It used to reuse .ob-book, and a check counting
   \xABone row per lorebook\xBB then counted the toggle as a book. A selector that lies is worse than
   a duplicated rule. */
.ob-toggle { display: grid; grid-template-columns: 1.3rem minmax(0, 1fr); gap: 0 .55rem;
  padding: .4rem .55rem; align-items: center;
  border-left: 2px solid transparent; cursor: pointer; }
.ob-toggle:hover { background: color-mix(in srgb, var(--steel-dark) 22%, transparent); }
.ob-toggle b { display: block; color: var(--text); font-weight: 600; font-size: .8rem; line-height: 1.2; }
.ob-toggle .bd { display: block; font-size: .66rem; line-height: 1.3; color: var(--steel-faint); }

/* \u2500\u2500 Step rail: the tabs you complete \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 Step footer: Back on the left, the actions on the right \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.ob-nav { display: flex; align-items: center; gap: .6rem; }
.ob-spacer { flex: 1 1 auto; }
/* The arrow glyphs are taller than the label text, so without a fixed line-height each
   button ends up a different height and the footer jumps between steps. */
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

/* NO reading-width cap. A 46ch limit is right on a page that can scroll; inside a 16:9 stage
   that never scrolls, HEIGHT is the scarce axis and width is the free one \u2014 capping the width
   spends the scarce thing to save the abundant one. The paragraph fills its row and gets shorter. */
.ob-lead { margin: 0; color: var(--steel-faint); line-height: 1.45; font-size: .88rem; }

.ob-field { display: flex; flex-direction: column; gap: .4rem; min-height: 0; }
.ob-field > label { font-size: .74rem; letter-spacing: .12em; text-transform: var(--case); color: var(--text); }
.ob-field .hint { font-size: .74rem; color: var(--steel-faint); line-height: 1.45; }

/* The label ROW anchors the tip, so it spans the FIELD and not the word the button follows:
   anchored to the button, a wide tip starting where the name ends would run off the right edge. */
.ob-labelrow { position: relative; display: flex; align-items: center; gap: .4rem; }
.ob-labelrow > label { flex: none; }
.ob-help { width: 1.15rem; height: 1.15rem; display: inline-grid; place-items: center; padding: 0; cursor: help;
  background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); border-radius: 50%;
  color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: .62rem; line-height: 1; }
.ob-help:hover, .ob-help:focus-visible { color: var(--text); border-color: var(--steel); outline: none; }
/* DOWNWARD from the label, which is the top of the field: it opens over the field's own control
   and so cannot reach past the step's grid, which is the scroll region and would clip it. */
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

/* Two short fields side by side (username + run name). */
.ob-two { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; }
@media (max-width: 520px) { .ob-two { grid-template-columns: 1fr; } }

/* Persona picker (the protagonist). A horizontal strip of selectable persona cards. */
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
/* \u2500\u2500 Step 4: the HUD style. Picking one previews it immediately, because the choice is
      about how the world FEELS and a swatch alone does not carry that. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
/* The label sits over ANOTHER style's palette, in THIS style's text colour. Bloom's panel is
   pure white and its bottom bar lands right under the label \u2014 light on white, unreadable. The
   scrim gives the label a known backdrop whatever the swatch is painting, which is the only
   version of this fix that keeps working when a sixth style is added. */
.ob-sw::after { content: ""; position: absolute; inset: auto 0 0 0; height: 82%; z-index: 1; pointer-events: none;
  /* Opaque WHERE THE TEXT SITS, fading only after: a fade that starts earlier leaves the title's
     top edge on a translucent veil and the contrast collapses on the light styles. */
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
   ONE full-width list with a toggle per ROLE on each row, not two lists side by side.
   Two columns was wrong twice over. It broke: a grid item defaults to min-width: auto
   (= min-content), so a long book name made its column REFUSE to shrink and pushed the whole
   intake past the stage \u2014 sideways, the axis a no-scroll check forgets to measure. And even
   fixed it read badly: at ~290px a real book name is mostly ellipsis. One row per book also says
   the true thing, which is that one book can serve both roles. */
.ob-bookgrid { display: grid; grid-template-columns: minmax(0, 1fr) 3.4rem 3.4rem; align-items: center; gap: 0 .3rem; }
/* THE HEADING MEASURES LIKE A ROW, or its columns are not the rows' columns. Two drifts add
   up and neither shows in the markup: rows carry a left border the heading lacks, and the list
   scrolls while the heading does not, so the scrollbar eats width from only one. Same border on
   both, and the scroll channel RESERVED with scrollbar-gutter stable whether the bar is there or
   not. */
.ob-bookhead { font-size: .62rem; letter-spacing: .12em; text-transform: var(--case); color: var(--steel);
  padding: 0 .45rem .25rem; border-left: 2px solid transparent; }
.ob-bookhead span:not(:first-child) { text-align: center; }
/* The one region on this screen allowed to scroll, and it scrolls INSIDE its own box: a
   library holds any number of books, and the SCREEN never scrolls \u2014 on either axis. */
/* flex: 1 1 auto + min-height: 0 is what makes the LIST absorb the squeeze. Without the
   min-height the box refuses to go below its content and the section overflows instead, which
   is invisible to a scrollHeight check on the section's own ancestors \u2014 it shows up as the foot
   note sitting on top of the nav. */
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
/* The two budgets, side by side under the list. Each shows what the CHOSEN books actually weigh,
   because a token cap set without knowing that is a guess \u2014 and the guess is what once let three
   entries of a twenty-two entry book through. */
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
`,to='<svg class="ob-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="0,0 100,0 100,80 80,100 0,100" fill="var(--ink)"/><polygon points="4,4 96,4 96,78 78,96 4,96" fill="none" stroke="var(--steel-dark)" stroke-width="2.5"/><path d="M50 14 C53 41 59 47 86 50 C59 53 53 59 50 86 C47 59 41 53 14 50 C41 47 47 41 50 14 Z" fill="var(--coral)"/><path d="M50 30 C51.5 45 55 48.5 70 50 C55 51.5 51.5 55 50 70 C48.5 55 45 51.5 30 50 C45 48.5 48.5 45 50 30 Z" fill="var(--amber)" opacity=".9"/></svg>',yr='Forge this world <span class="arrow">&#9656;</span>';function Ct(t){let e=Math.max(1,Math.min(3,Number(t)||1));return new Array(e).fill('<div class="ob-bookhead ob-bookgrid"><span>Book</span><span>World</span><span>Cast</span></div>').join("")}var ao='<svg class="bx-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.4 6.6 11.5 12.5 4.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function ro(t,e){let a=n=>e&&e[n]?"true":"false",r=(n,i)=>'<button class="ob-bx" type="button" role="checkbox" aria-label="'+i+": "+Te(t.name)+'" aria-checked="'+a(n)+'" data-book="'+Te(t.id)+'" data-role="'+n+'">'+ao+"</button>";return'<div class="ob-book ob-bookgrid'+(e&&(e.world||e.cast)?" on":"")+'"><span class="bt"><b>'+Te(t.name)+"</b>"+(t.description?'<span class="bd">'+Te(t.description)+"</span>":"")+"</span>"+r("world","World lore")+r("cast","Cast book")+"</div>"}function aa(t,e){let a=t.wide?" ob-wide":"",r=e&&e.hidden?" hidden":"",s=!!(e&&e.terse),n=t.help?'<button class="ob-help" type="button" aria-label="About '+he(t.label||t.id)+'">?</button><span class="ob-tip" role="tooltip">'+t.help+"</span>":"",i=t.label&&t.type!=="toggle"?"<label"+(t.type==="text"||t.type==="textarea"||t.type==="select"?' for="ob-'+Nt(t.id)+'"':"")+">"+t.label+(t.required?' <span class="ob-req">*</span>':"")+"</label>":"",l=i&&n?'<div class="ob-labelrow">'+i+n+"</div>":i,h=t.hint&&!s?'<span class="hint">'+t.hint+"</span>":"",p="";if(t.type==="custom")p=e&&e.custom?e.custom(t):"";else if(t.type==="textarea")p='<textarea id="ob-'+Nt(t.id)+'" class="ob-control" data-input="'+he(t.id)+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+he(t.placeholder)+'"':"")+"></textarea>";else if(t.type==="select"){let d=Array.isArray(t.options)?t.options.map(o=>'<option value="'+he(o.value)+'">'+he(o.label||o.value)+"</option>").join(""):"";p='<select id="ob-'+Nt(t.id)+'" class="ob-control" data-input="'+he(t.id)+'">'+(t.emptyOption?'<option value="">'+he(t.emptyOption)+"</option>":"")+d+"</select>"}else t.type==="toggle"?p='<label class="ob-toggle"><button class="ob-bx" type="button" role="checkbox" aria-checked="false" data-input="'+he(t.id)+'" aria-label="'+he(t.label||t.id)+'"><span>\u2713</span></button><span class="bt"><b>'+(t.boxLabel||t.label||"")+"</b>"+(t.boxHint&&!s?'<span class="bd">'+t.boxHint+"</span>":"")+"</span></label>":p='<input id="ob-'+Nt(t.id)+'" class="ob-control" data-input="'+he(t.id)+'" type="'+(t.type==="number"?"number":"text")+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+he(t.placeholder)+'"':"")+" />";return'<div class="ob-field'+a+'" data-field="'+he(t.id)+'"'+r+">"+l+p+h+"</div>"}function Nt(t){return String(t).replace(/[^A-Za-z0-9_-]+/g,"-")}function so(){return'<span class="hint"><b>World</b>: what is true here &mdash; <b>constant</b> entries always, the rest on their keywords; what does not fit the budget is <b>dropped</b>. <b>Cast</b>: the forge picks the sheets it is about to mint &mdash; <b>5</b> when the world is forged, <b>2</b> per featured banner &mdash; and never offers the same character twice.</span>'}function ra(t,e){if(t.render==="personas")return'<div class="ob-personas" role="radiogroup" aria-label="Protagonist persona" data-personas><span class="ob-personas-empty">Loading personas&hellip;</span></div>';if(t.render==="styles")return'<div class="ob-styles" role="radiogroup" aria-label="HUD style">'+Ue.map(r=>{let[s,n,i]=r.swatch;return'<button class="ob-sw" type="button" role="radio" data-style-pick="'+r.id+'" aria-pressed="'+(r.id===je)+'"><span class="mini" style="background:'+s+'"><i style="left:8%;top:9%;width:84%;height:14%;background:'+n+'"></i><i style="left:8%;top:30%;width:50%;height:36%;background:'+n+'"></i><i style="left:62%;top:30%;width:30%;height:16%;background:'+i+'"></i><i style="left:62%;top:50%;width:30%;height:16%;background:'+n+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+n+'"></i></span><span class="tick">&#10003;</span><span class="lbl"><b>'+r.label+"</b><span>"+r.description+"</span></span></button>"}).join("")+"</div>";if(t.render==="lorebooks"){let a=Math.max(1,Math.min(3,Number(e&&e.cols)||1));return'<div class="ob-booklist" role="group" aria-label="Lorebooks" data-cols="'+a+'" data-books>'+Ct(a)+'<span class="ob-books-empty">Reading your library&hellip;</span></div><div class="ob-budget"><label class="ob-bud"><span class="k">World tk</span><input type="number" min="0" step="500" data-budget="world" aria-label="World token budget" /><span class="w" data-weight="world"></span></label><label class="ob-bud"><span class="k">Cast tk</span><input type="number" min="0" step="500" data-budget="cast" aria-label="Cast token budget" /><span class="w" data-weight="cast"></span></label></div>'+so()}return""}function no(t,e){let a=ta(t.id).map(s=>aa(s,{custom:ra,hidden:!Fe(s,e||{})})).join("");return'<div class="ob-grid">'+(t.lead?'<p class="ob-lead ob-wide">'+t.lead+"</p>":"")+a+"</div>"}function wr({cancelable:t=!1,values:e={}}={}){let a=t?'<button class="ob-cancel" type="button" data-cancel>Cancel</button>':"",r=De.map((n,i)=>'<button type="button" data-goto="'+(i+1)+'" data-state="'+(i===0?"active":"todo")+'" data-reachable="'+(i===0?"true":"false")+'"><span class="n">'+(i+1)+"</span>"+n.label+"</button>").join(""),s=De.map((n,i)=>'<section class="ob-step" data-step="'+(i+1)+'" data-step-id="'+n.id+'"'+(i===0?"":" hidden")+">"+no(n,e)+(i===De.length-1?'<p class="ob-foot">Forging generates your <b>first chapter</b> &mdash; takes a moment.</p>':"")+"</section>").join("");return`
<div class="ob-root">
  <div class="ob-frame">
  <div class="ob-intake">
    <div class="ob-brand">
      ${to}
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
      <button class="ob-forge" type="button" data-forge hidden>${yr}</button>
    </div>
  </div>
  </div>
</div>`}var io=new Set(["image_generation","video_generation"]),xr="/api/gacha-forge";function Te(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}function gr(t){return t===!0||t==="true"||t===1||t==="1"}function he(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function oo(t){let e=String(t||"").trim().split(/\s+/).filter(Boolean),a=e[0]?e[0][0]:"",r=e[1]?e[1][0]:"";return(a+r).toUpperCase()||"?"}function lo(t,e){let a=String(t?.id??""),r=String(t?.name??"Unnamed"),s=String(t?.comment??""),n=t?.avatarPath?`<span class="pav"><img src="${he(t.avatarPath)}" alt=""></span>`:`<span class="pav">${he(oo(r))}</span>`;return`<button class="ob-persona" type="button" role="radio" data-persona="${he(a)}" data-selected="false">`+(e?'<span class="pactive">Active</span>':"")+'<span class="pcheck">&#10003;</span>'+n+`<span class="pname">${he(r)}</span><span class="pcomment">${he(s)}</span></button>`}function mr(t){return t?{personaId:String(t.id??""),name:String(t.name??"").trim(),comment:String(t.comment??""),description:String(t.description??""),personality:String(t.personality??""),appearance:String(t.appearance??""),backstory:String(t.backstory??""),scenario:String(t.scenario??""),tags:Array.isArray(t.tags)?t.tags.map(e=>String(e)):[],avatarPath:t.avatarPath?String(t.avatarPath):null}:null}function sa(t,{initial:e,onChange:a}={}){let r=e&&typeof e=="object"?e:{},s={world:new Set(Array.isArray(r.worldIds)?r.worldIds:[]),cast:new Set(Array.isArray(r.castIds)?r.castIds:[])},n=new Map,i=o=>t.querySelector('[data-budget="'+o+'"]'),l=()=>({worldIds:[...s.world],castIds:[...s.cast],worldBudget:Number(i("world")&&i("world").value),castBudget:Number(i("cast")&&i("cast").value)}),h=()=>{a&&a(l())};function p(){for(let o of["world","cast"]){let u=t.querySelector('[data-weight="'+o+'"]');if(!u)continue;let f=0,v=!1;for(let A of s[o]){let z=n.get(A);typeof z=="number"?f+=z:v=!0}let w=i(o),g=w&&w.value!==""?Number(w.value):NaN,x=Number.isFinite(g)?g:Number(w&&w.placeholder);if(!s[o].size){u.textContent="",u.setAttribute("data-over","false");continue}let S=f>=1e3?Math.round(f/100)/10+"k":String(f);u.textContent="picked \u2248"+S+(v?"+":""),u.setAttribute("data-over",Number.isFinite(x)&&f>x?"true":"false")}}function d(o,u){let f=t.querySelector("[data-books]");if(f){if(u){f.innerHTML=Ct(f.getAttribute("data-cols"))+'<span class="ob-books-empty">'+Te(u)+"</span>";return}if(!o.length){f.innerHTML=Ct(f.getAttribute("data-cols"))+'<span class="ob-books-empty">No lorebooks in your library yet. Write or import one in Marinara and it shows up here.</span>';return}f.innerHTML=Ct(f.getAttribute("data-cols"))+o.map(v=>ro(v,{world:s.world.has(v.id),cast:s.cast.has(v.id)})).join("");for(let v of f.querySelectorAll("[data-role]"))v.addEventListener("click",()=>{let w=v.getAttribute("data-book"),g=s[v.getAttribute("data-role")];if(!g)return;g.has(w)?g.delete(w):g.add(w),v.setAttribute("aria-checked",g.has(w)?"true":"false"),p();let x=v.parentNode;x&&x.classList&&x.classList.toggle("on",s.world.has(w)||s.cast.has(w)),h()})}}for(let o of["world","cast"]){let u=i(o),f=r[o+"Budget"];u&&f!==null&&f!==void 0&&Number.isFinite(Number(f))&&(u.value=String(f))}be(xr+"/lorebooks").then(o=>o&&o.ok&&typeof o.json=="function"?o.json():null).then(o=>{if(o&&o.ok&&Array.isArray(o.books)){for(let f of o.books)f&&typeof f.tokens=="number"&&n.set(f.id,f.tokens);let u=o&&o.defaults||{};for(let f of["world","cast"]){let v=i(f);v&&(v.placeholder=String(Number(u[f])||(f==="cast"?2e4:6e3)))}d(o.books,null),p()}else d([],"Could not read your lorebooks. The world can still be forged without them.")}).catch(()=>d([],"Could not read your lorebooks. The world can still be forged without them."));for(let o of["world","cast"]){let u=i(o);u&&(u.addEventListener("input",p),u.addEventListener("change",h))}return{value:l}}function kr(t,{onCreate:e,onCancel:a}){let r=b=>t.querySelector('[data-input="'+b+'"]'),s=b=>t.querySelector('[data-field="'+b+'"]'),n={};function i(){for(let b of qe){let y=s(b.id);y&&(y.hidden=!Fe(b,n))}}let l=r("scenario"),h=r("name"),p=r("username"),d=r("connectionId"),o=r("images.connectionId"),u=s("images.connectionId")&&s("images.connectionId").querySelector(".hint"),f=s("images.styleProfileId"),v=r("images.styleProfileId"),w=t.querySelector("[data-personas]"),g=t.querySelector(".ob-error"),x=t.querySelector("[data-forge]"),S=t.querySelector("[data-cancel]");S&&S.addEventListener("click",()=>a&&a());let A=De.length,z=Array.from(t.querySelectorAll("[data-step]")),U=Array.from(t.querySelectorAll("[data-goto]")),R=t.querySelector("[data-back]"),q=t.querySelector("[data-next]"),L=1,P=1;function X(b){L=Math.min(A,Math.max(1,b)),P=Math.max(P,L);for(let y of z)y.hidden=Number(y.getAttribute("data-step"))!==L;for(let y of U){let k=Number(y.getAttribute("data-goto"));y.setAttribute("data-state",k===L?"active":k<P?"done":"todo"),y.setAttribute("data-reachable",k<=P?"true":"false")}R&&(R.hidden=L===1),q&&(q.hidden=L===A),x&&(x.hidden=L!==A),ne("")}for(let b of U)b.addEventListener("click",()=>{let y=Number(b.getAttribute("data-goto"));y<=P&&X(y)});R&&R.addEventListener("click",()=>X(L-1)),q&&q.addEventListener("click",()=>{J(L)&&X(L+1)});function J(b){te();let y=De[b-1]&&De[b-1].id,k=y?vr(y,n):null;if(!k)return!0;ne(k.required);let N=r(k.id);return N&&N.focus&&N.focus(),!1}function te(){for(let b of qe){if(b.type==="custom")continue;let y=r(b.id);y&&(b.type==="toggle"?n[b.id]=y.getAttribute("aria-checked")==="true":b.type==="number"?n[b.id]=Number(y.value):n[b.id]=typeof y.value=="string"?y.value.trim():"")}i()}let le=sa(t,{}),oe=je;n.hudStyle=je;let se=t.querySelector(".gf-arena");for(let b of t.querySelectorAll("[data-style-pick]"))b.addEventListener("click",()=>{oe=b.getAttribute("data-style-pick"),n.hudStyle=oe;for(let y of t.querySelectorAll("[data-style-pick]"))y.setAttribute("aria-pressed",String(y===b));se&&se.setAttribute&&se.setAttribute("data-style",oe)});let re=null,Q=[];function ve(b){re=b,n.protagonist=mr(b);for(let y of Q)y.el.setAttribute("data-selected",y.persona===b?"true":"false")}function ne(b){g&&(g.textContent=b||"",g.hidden=!b)}be("/api/connections").then(b=>b&&b.ok&&typeof b.json=="function"?b.json():Promise.reject(new Error("connections"))).then(b=>{let y=Array.isArray(b)?b:[],k=y.filter(I=>!io.has(String(I?.provider??"")));if(y.length===0){ne("No connection configured. Create one in the engine settings and come back.");return}if(k.length===0){ne("Your connections are image or video only, and none can narrate. Configure a text connection in the engine settings.");return}d.innerHTML=k.map(I=>{let G=String(I?.id??""),ke=String(I?.name??G),Be=String(I?.model??"").trim(),ae=Be?`${ke} \u2014 ${Be}`:ke;return`<option value="${G}">${ae.replace(/</g,"&lt;")}</option>`}).join("");let N=k.find(I=>gr(I?.isDefault))??k.find(I=>gr(I?.fallbackForMain));N?.id&&(d.value=String(N.id))}).catch(()=>ne("Could not read the engine connections."));for(let b of qe.filter(y=>y.type==="toggle")){let y=r(b.id);y&&(n[b.id]=b.default===!0,y.setAttribute("aria-checked",n[b.id]?"true":"false"),y.addEventListener("click",()=>{n[b.id]=!n[b.id],y.setAttribute("aria-checked",n[b.id]?"true":"false")}))}let E=b=>{n["images.connectionId"]=b?o&&o.value||"on":"",i()};be(`${xr}/image-options`).then(b=>b&&b.ok&&typeof b.json=="function"?b.json():null).then(b=>{let y=b&&Array.isArray(b.connections)?b.connections:[];if(!y.length){u&&(u.textContent="No image connection is configured in the engine, so portraits stay off. Heroes show a silhouette when they speak."),o&&(o.disabled=!0);return}o&&(o.innerHTML='<option value="">Off</option>'+y.map(N=>`<option value="${Te(N.id)}">${Te(N.name)}</option>`).join(""));let k=b&&Array.isArray(b.profiles)?b.profiles:[];v&&(v.innerHTML=k.length?k.map(N=>`<option value="${Te(N.id)}">${Te(N.name)} &mdash; ${Te(N.promptMode)}</option>`).join(""):'<option value="">Engine default</option>')}).catch(()=>{}),o&&o.addEventListener("change",()=>E(!!o.value)),Promise.all([be("/api/characters/personas/list").then(b=>b&&b.ok&&typeof b.json=="function"?b.json():[]).catch(()=>[]),be("/api/characters/personas/active").then(b=>b&&b.ok&&typeof b.json=="function"?b.json():null).catch(()=>null)]).then(([b,y])=>{if(!w)return;let k=Array.isArray(b)?b:b&&Array.isArray(b.items)?b.items:[];if(k.length===0){w.innerHTML='<span class="ob-personas-empty">No personas in Marinara yet &mdash; create one there first, then come back.</span>';return}let N=y&&y.id;w.innerHTML=k.map(I=>lo(I,I.id===N)).join(""),Q=[];for(let I of k){let G=t.querySelector('[data-persona="'+String(I.id??"")+'"]');G&&(Q.push({persona:I,el:G}),G.addEventListener("click",()=>ve(I)))}ve(k.find(I=>I.id===N)||k[0])}),x?.addEventListener("click",async()=>{if(!(l?.value||"").trim()){ne("Describe your gacha world before forging."),l?.focus?.();return}if(!re){ne("Pick your protagonist \u2014 a Marinara persona.");return}if(!(d?.value||"")){ne("Pick the connection that will narrate.");return}let k=(h?.value||"").trim(),N=(p?.value||"").trim(),I=mr(re);ne(""),x&&(x.disabled=!0,x.textContent="Forging\u2026");try{te(),n.protagonist=I,n.hudStyle=oe,n.lore=le.value(),await e(At(n))}catch(G){x&&(x.disabled=!1,x.innerHTML=yr),ne(`Could not start: ${G instanceof Error?G.message:String(G)}`)}}),X(1)}var Ye=[{id:"continuity",kicker:"Story",label:"Continuity"},{id:"visual",kicker:"Look",label:"Visual"},{id:"sources",kicker:"World",label:"Sources"},{id:"help",kicker:"Guide",label:"Help"},{id:"changelog",kicker:"Updates",label:"Changelog"},{id:"debug",kicker:"Diagnostics",label:"Debug"}],Ke="visual";function pe(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var _r=5,na=3e4,ia=[2e4,3e4,5e4,1e5],co='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Sr='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5 4 12l5 7M15 5l5 7-5 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',ho='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4 10-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';function It(t){let e=Number(t)||0;return e>=1e3?(e%1e3===0?String(e/1e3):(e/1e3).toFixed(1))+"k":String(e)}function Rt(t){return(Number(t)||0).toLocaleString("en-US")}function po({contextTokens:t,warnTokens:e}){let a=Number(t)||0,r=Number(e)||na,s=r>0?Math.min(100,Math.round(a/r*100)):0,n=ia.map(i=>'<button class="st-chip" type="button" data-warn="'+i+'" aria-pressed="'+(i===r)+'">'+It(i)+"</button>").join("");return'<div class="st-plate"><div class="hd"><h3>Model context</h3><span class="st-figs"><b data-meter-n>'+Rt(a)+"</b>&nbsp;/&nbsp;<span data-meter-max>"+Rt(r)+'</span>&nbsp;tokens</span></div><div class="st-track"><i data-meter-bar style="width:'+s+'%"></i><span class="st-mark" data-meter-mark data-label="'+It(r)+'" style="left:100%"></span></div><div class="st-thresh"><span class="st-lbl">Alert at</span><div class="st-chips" role="group" aria-label="Alert threshold">'+n+'</div><span class="st-or">or</span><span class="st-custom"><input type="number" data-warn-custom min="1" step="5" value="'+Math.round(r/1e3)+'" aria-label="Custom threshold in thousands of tokens"><span class="st-k">k</span></span></div><div class="st-banner">'+co+'<span>Long story &mdash; compress old chapters to keep turns fast and cheap. Nothing is lost.</span></div></div><div class="st-plate"><div class="hd"><h3>Chapters</h3></div><p>Compressing swaps the copy the model reads for a summary. The beats stay readable in the log.</p><div class="st-list" data-continuity-list><p class="st-empty">Loading&hellip;</p></div></div>'}function Er(t,e=null){return!Array.isArray(t)||!t.length?'<p class="st-empty">No chapters yet.</p>':t.map(a=>{let r=String(a.chapter).padStart(2,"0"),s,n,i,l;return a.compressed?(s="-compressed",n='<span class="st-status -compressed">Compressed</span>',i='<span class="st-done">'+ho+"done</span>",l=(a.storyBeats||_r)+" beats &middot; compressed"):a.complete?(s="-ready",n='<span class="st-status -ready">Complete</span>',i=e!=null&&Number(e)===Number(a.chapter)?'<button class="st-compress" type="button" disabled data-compress="'+a.chapter+'">'+Sr+"Compressing&hellip;</button>":'<button class="st-compress" type="button" data-compress="'+a.chapter+'">'+Sr+"Compress</button>",l=(a.storyBeats||0)+" beats narrated"):(s="-playing",n='<span class="st-status -playing">In progress</span>',i='<span class="st-lock">Finish to compress</span>',l=(a.storyBeats||0)+" of "+_r+" beats"),'<article class="st-ch '+s+'"><div class="st-idx">'+r+"</div><div><h4>"+pe(a.title)+"</h4><p>"+l+"</p></div>"+n+i+"</article>"}).join("")}function Xe(t,e,a){let r=Number(e)||0,s=Number(a)||0;for(let o of[t.querySelector(".root"),t.querySelector(".gf-bar")])o&&(r>0&&s>0&&r>=s?o.setAttribute("data-ctx","warn"):o.removeAttribute("data-ctx"));let n=t.querySelector("[data-ctx-n]");n&&(n.textContent=It(r));let i=t.querySelector("[data-meter-n]");i&&(i.textContent=Rt(r));let l=t.querySelector("[data-meter-max]");l&&(l.textContent=Rt(s));let h=t.querySelector("[data-meter-mark]");h&&h.setAttribute("data-label",It(s));let p=t.querySelector("[data-meter-bar]");p&&p.style&&(p.style.width=(s>0?Math.min(100,Math.round(r/s*100)):0)+"%");for(let o of ia){let u=t.querySelector('[data-warn="'+o+'"]');u&&u.setAttribute("aria-pressed",String(o===s))}let d=t.querySelector("[data-warn-custom]");d&&t.activeElement!==d&&(d.value=String(Math.round(s/1e3)))}function fo(t){let e=it(t);return Ue.map(a=>{let[r,s,n]=a.swatch;return'<button class="st-sty" type="button" data-style-set="'+a.id+'" aria-pressed="'+(a.id===e)+'"><span class="st-mini" style="background:'+r+'"><i style="left:8%;top:10%;width:84%;height:14%;background:'+s+'"></i><i style="left:8%;top:31%;width:50%;height:34%;background:'+s+'"></i><i style="left:62%;top:31%;width:30%;height:15%;background:'+n+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+s+'"></i></span><span class="st-tick">&#10003;</span><span class="st-swlbl"><b>'+a.label+"</b><span>"+a.description+"</span></span></button>"}).join("")}function uo(t){let e=Ve(t);return nt.map(a=>'<button class="st-chip" type="button" data-text-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function vo(t){let e=We(t);return bt.map(a=>'<button class="st-chip" type="button" data-narr-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function go({hudStyle:t,textScale:e,narrationScale:a}){return'<div class="st-plate"><div class="hd"><h3>HUD style</h3></div><div class="st-styles">'+fo(t)+'</div></div><div class="st-plate"><div class="hd"><h3>Interface text</h3></div><div class="st-chips" role="group" aria-label="Interface text size">'+uo(e)+'</div></div><div class="st-plate"><div class="hd"><h3>Narration text</h3></div><div class="st-chips" role="group" aria-label="Narration text size">'+vo(a)+"</div></div>"}function mo(t,e){let a=t;for(let r of String(e).split(".")){if(!a||typeof a!="object")return;a=a[r]}return a}function Tr(t,e){let a={};for(let r of Tt(e)){let s=mo(t,r.id);a[r.id]=s===void 0?r.default:s}return a}function bo(t){return ur("sources").map(e=>{let a=e.fields.length===1,r=e.fields.map(s=>aa(a?{...s,label:""}:s,{custom:ra,hidden:!Fe(s,t),terse:!0})).join("");return'<div class="st-plate"><div class="hd"><h3>'+pe(e.label)+'</h3></div><div class="ob-grid">'+r+"</div></div>"}).join("")+'<p class="st-foot">Applies to what this world generates next; nothing already made is redrawn.</p>'}function yo(t){let e=t&&t.status||"idle";if(e==="loading")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Reading&hellip;</div></div>';if(e==="error")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Could not read the lorebook status.</div></div>';if(e!=="ready")return"";let a=t&&t.data||{};if(!a.enabled)return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">This world uses no lorebooks. Pick them in Sources.</div></div>';let r=h=>Number.isFinite(Number(h))?Number(h).toLocaleString("en-US"):"&mdash;",s=(h,p,d)=>{if(!p)return"";let o=p.dropped>0;return'<span class="st-tl-tot"><i>'+h+"</i><b>"+r(p.entries)+" / "+r(p.pool)+' entries</b></span><span class="st-tl-tot"><i>tokens</i><b>'+r(p.tokens)+" / "+r(d)+"</b></span>"+(o?'<span class="st-tl-warn">'+r(p.dropped)+" entr"+(p.dropped===1?"y":"ies")+" will NOT fit &mdash; the generator works from a fragment</span>":"")},n=(Array.isArray(a.next)?a.next:[]).map(h=>h.uses===!1?'<div class="st-tl-row"><span class="st-tl-l">'+pe(h.label)+'</span><span class="st-tl-o">no lore</span></div><div class="st-tl-note">'+pe(h.why||"")+"</div>":'<div class="st-tl-row"><span class="st-tl-l">'+pe(h.label)+'</span></div><div class="st-tl-totals">'+s("world",h.world,a.budgets&&a.budgets.world)+s("cast",h.cast,a.budgets&&a.budgets.cast)+"</div>").join(""),i=a.library||{};return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks &mdash; what the next call carries</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+('<div class="st-tl-totals"><span class="st-tl-tot"><i>world books</i><b>'+r(i.world&&i.world.books)+'</b></span><span class="st-tl-tot"><i>cast books</i><b>'+r(i.cast&&i.cast.books)+'</b></span><span class="st-tl-tot"><i>already minted</i><b>'+r(a.minted)+"</b></span>"+((a.missing||[]).length?'<span class="st-tl-warn">'+(a.missing||[]).length+" book(s) this world points at no longer exist</span>":"")+"</div>")+n+"</div>"}function wo(){return'<section class="st-plate st-build"><div class="hd"><h3>Build</h3></div><div class="st-build-row"><span class="k">Package version</span><b data-build-version>v'+pe(wt)+"</b></div></section>"}function oa(t,e){return wo()+yo(t)+_o(e)}function xo(t){let e=r=>!!(t&&typeof t.has=="function"&&t.has(r));return'<div class="st-help">'+Za.map(r=>{let s=Qa(r.id);return s.length?'<section class="st-plate st-help-topic"><div class="hd"><h3>'+pe(r.label)+'</h3></div><div class="st-help-list">'+s.map(n=>kt(n,e(n.id))).join("")+"</div></section>":""}).join("")+"</div>"}function ko(){return'<div class="st-cl">'+xt().map(t=>'<section class="st-plate st-cl-rel'+(t.now?" now":"")+'"><div class="hd"><h3>'+pe(t.version)+"</h3>"+(t.now?'<span class="k">Current</span>':"")+'</div><div class="st-cl-cols">'+t.body+"</div></section>").join("")+"</div>"}function _o(t){let e=t&&t.status||"idle",a=t&&Array.isArray(t.entries)&&t.entries||[],r=t&&t.totals||null,s=h=>Number.isFinite(h)?Number(h).toLocaleString("en-US"):"&mdash;",n=h=>{let p=new Date(Number(h)||0),d=o=>String(o).padStart(2,"0");return d(p.getHours())+":"+d(p.getMinutes())+":"+d(p.getSeconds())},i;return e==="loading"?i='<div class="st-tl-msg">Reading&hellip;</div>':e==="error"?i='<div class="st-tl-msg">Could not read the token log.</div>':a.length?i='<div class="st-tl-rows">'+a.map(h=>'<div class="st-tl-row'+(h.outcome==="ok"?"":" bad")+'"><span class="st-tl-t">'+n(h.at)+'</span><span class="st-tl-l">'+pe(h.label)+(h.attempt>1?'<b class="st-tl-retry">retry '+h.attempt+"</b>":"")+'</span><span class="st-tl-u st-tl-up">'+s(h.sent)+'</span><span class="st-tl-u st-tl-dn">'+s(h.received)+'</span><span class="st-tl-o">'+pe(h.outcome)+"</span></div>").join("")+"</div>":i='<div class="st-tl-msg">No model calls recorded for this world yet.</div>','<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Model calls</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+(r?'<div class="st-tl-totals"><span class="st-tl-tot"><i>sent</i><b>'+s(r.sent)+'</b></span><span class="st-tl-tot"><i>received</i><b>'+s(r.received)+'</b></span><span class="st-tl-tot"><i>calls</i><b>'+s(r.calls)+"</b></span>"+(r.cached?'<span class="st-tl-tot"><i>of that cached</i><b>'+s(r.cached)+"</b></span>":"")+(r.cacheWrite?'<span class="st-tl-tot"><i>cache writes</i><b>'+s(r.cacheWrite)+"</b></span>":"")+(r.unreported?'<span class="st-tl-warn">'+r.unreported+" call(s) reported no usage &mdash; the totals are short by that much</span>":"")+(r.dropped?'<span class="st-tl-warn">'+s(r.dropped)+" older call(s) dropped past the "+s(r.capped)+"-row cap</span>":"")+"</div>":"")+i+'<p class="st-tl-note">Every model call this world has ever made, newest first &mdash; kept across restarts. Portrait generation is not here: it goes to the engine over HTTP, not through the language model.</p></div>'}function Ar({category:t=Ke,backLabel:e="Home",contextTokens:a=0,warnTokens:r=na,hudStyle:s="",textScale:n=null,narrationScale:i=null,tokenLog:l=null,loreStatus:h=null,run:p=null,helpOpen:d=null}={}){let o=Ye.some(A=>A.id===t)?t:Ke,u=Ye.find(A=>A.id===o)||Ye[0],f=Number(a)||0,v=Number(r)||na,w=f>0&&f>=v,g=Ye.map(A=>'<button class="st-sect" type="button" role="tab" aria-selected="'+(A.id===o)+'" data-view="'+A.id+'"><span class="k">'+pe(A.kicker)+'</span><span class="n">'+pe(A.label)+"</span></button>").join(""),x={continuity:()=>po({contextTokens:f,warnTokens:v}),visual:()=>go({hudStyle:s,textScale:n,narrationScale:i}),sources:()=>bo(Tr(p,"sources")),help:()=>xo(d),changelog:()=>ko(),debug:()=>oa(h,l)},S=x[o]?x[o]():"";return'<div class="root"'+(w?' data-ctx="warn"':"")+'><div class="stage"></div><section class="screen" data-screen="settings"><div class="head"><button class="back" type="button" data-settings-back>&#9664; '+pe(e)+'</button><div class="head-id"><div class="eyebrow">Settings</div><h2>'+pe(u.label)+'</h2></div></div><div class="body"><div class="st-rail" role="tablist">'+g+'</div><div class="st-pane" data-view-body="'+o+'">'+S+"</div></div></section></div>"}function Nr(t,{open:e,category:a,run:r,onOpen:s,onBack:n,onCategory:i,onStyle:l,onTextScale:h,onNarrationScale:p,onWarnTokens:d,onSources:o}={}){for(let f of t.querySelectorAll('[aria-label="Game settings"]'))f.addEventListener("click",()=>s&&s(Ke));for(let f of t.querySelectorAll("[data-open-continuity]"))f.addEventListener("click",()=>s&&s("continuity"));if(!e)return;for(let f of[t.querySelector(".root"),t.querySelector(".gf-bar")])f&&f.addEventListener("click",v=>{let w=x=>v&&v.target&&v.target.closest?v.target.closest(x):null;if(w("[data-settings-back]")){n&&n();return}let g=w("[data-view]");g&&i&&i(g.getAttribute("data-view"))});let u=t.querySelector(".st-pane");if(u&&u.addEventListener("click",f=>{f&&f.target&&f.target.closest&&f.target.closest("[data-token-refresh]")&&i&&i("debug")}),a==="visual"){for(let f of t.querySelectorAll("[data-style-set]"))f.addEventListener("click",()=>{let v=f.getAttribute("data-style-set");for(let w of t.querySelectorAll("[data-style-set]"))w.setAttribute("aria-pressed",String(w===f));l&&l(v)});for(let f of t.querySelectorAll("[data-text-scale]"))f.addEventListener("click",()=>h&&h(f.getAttribute("data-text-scale")));for(let f of t.querySelectorAll("[data-narr-scale]"))f.addEventListener("click",()=>p&&p(f.getAttribute("data-narr-scale")))}if(a==="continuity"){for(let v of ia){let w=t.querySelector('[data-warn="'+v+'"]');w&&w.addEventListener("click",()=>d&&d(v))}let f=t.querySelector("[data-warn-custom]");f&&f.addEventListener("change",()=>{let v=Number(f.value);v>0&&d&&d(Math.round(v*1e3))})}a==="sources"&&So(t,{run:r,onSources:o})}function So(t,{run:e,onSources:a}){let r=Tt("sources"),s=d=>t.querySelector('[data-input="'+d+'"]'),n=d=>t.querySelector('[data-field="'+d+'"]'),i=Tr(e,"sources"),l=()=>{for(let d of r){let o=n(d.id);o&&(o.hidden=!Fe(d,i))}},h=()=>{l(),a&&a(At(i))},p=sa(t,{initial:i.lore,onChange:d=>{i.lore=d,h()}});i.lore=p.value();for(let d of r){if(d.type==="custom")continue;let o=s(d.id);o&&(d.type==="toggle"?(o.setAttribute("aria-checked",i[d.id]?"true":"false"),o.addEventListener("click",()=>{let u=o.getAttribute("aria-checked")!=="true";o.setAttribute("aria-checked",u?"true":"false"),i[d.id]=u,h()})):(typeof i[d.id]=="string"&&(o.value=i[d.id]),o.addEventListener("change",()=>{i[d.id]=typeof o.value=="string"?o.value.trim():"",h()})))}l(),To(t,r,i)}var Eo=new Set(["image_generation","video_generation"]);function To(t,e,a){let r=i=>e.some(l=>l.optionsFrom===i),s=(i,l,h)=>{let p=t.querySelector('[data-input="'+i+'"]');if(!p)return;p.innerHTML=(h?'<option value="">'+pe(h)+"</option>":"")+l.map(o=>'<option value="'+pe(o.value)+'">'+pe(o.label)+"</option>").join("");let d=a[i];typeof d=="string"&&l.some(o=>o.value===d)?p.value=d:h&&(p.value=""),p.disabled=l.length===0&&!h},n=i=>{let l=e.find(h=>h.optionsFrom===i);return l&&l.emptyOption?l.emptyOption:""};r("connections")&&be("/api/connections").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{let h=(Array.isArray(i)?i:i&&Array.isArray(i.connections)?i.connections:[]).filter(p=>p&&!Eo.has(String(p.provider??""))).map(p=>({value:String(p.id),label:String(p.name||p.model||p.id)}));for(let p of e)p.optionsFrom==="connections"&&s(p.id,h,n("connections"))}).catch(()=>{}),(r("imageConnections")||r("imageProfiles"))&&be("/api/gacha-forge/image-options").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{let l=(i&&Array.isArray(i.connections)?i.connections:[]).map(p=>({value:String(p.id),label:String(p.name||p.model||p.id)})),h=(i&&Array.isArray(i.profiles)?i.profiles:[]).map(p=>({value:String(p.id),label:String(p.name)+" \u2014 "+String(p.promptMode)}));for(let p of e)p.optionsFrom==="imageConnections"&&s(p.id,l,n("imageConnections")),p.optionsFrom==="imageProfiles"&&s(p.id,h,h.length?"":"Engine default")}).catch(()=>{})}var Cr=`

/* \u2500\u2500 THE SETTINGS SCREEN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Built from the REST OF THE GAME'S pieces, never a pattern of its own: header as brow + h2
   hoisted to the bar, a rail of PLATE buttons, translucent plates with a steel-dark top edge, and
   coral only on what is selected or pressed. Everything local is st- prefixed \u2014 only root, screen
   and head go bare, per the house convention. */

/* The spacing scale is declared HERE, as on every screen: the theme declares the type ramp
   but NOT the spacings. A token that is read but not declared does not fail \u2014 the declaration is
   silently invalid and every padding and gap collapses to zero. */
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
/* The second row ONLY while the header is still present: hoistHeadIntoBar REMOVES it, and an
   auto 1fr screen left with one child sizes to content instead of to the screen. */
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id { min-width: 0; }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

.body { min-height: 0; min-width: 0; display: flex; gap: var(--sp-3); padding: 0 var(--sp-3) var(--sp-3); }
/* Winning the bar costs the screen the air its own header gave it: hoistHeadIntoBar removes the
   .head and its padding with it. */
.screen:not(:has(> .head)) .body { padding-top: var(--sp-2); }

/* \u2500\u2500 The rail: Inventory's .sect \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 The panel: plates, and the ONE contained scroll \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* A gap is not filled with MORE THINGS: it is filled by letting the content FILL. The rows
   share the height that exists, and a new plate shares itself in.
   minmax(min-content, 1fr), NOT minmax(0, 1fr): a plate whose content wraps must still fit,
   because a clipped plate clips silently. */
/* Measured and reverted: stretching the plates' BOXES does not stretch what is inside them,
   and on the fullest category it made the screen scroll. */
.st-pane { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); overflow: auto; }

/* The house plate: translucent with blur, steel-dark top edge, chamfer. */
/* The plate holding a LONG LIST takes the leftover height, chosen by what it CONTAINS, not
   by position: an nth-child pick grows the wrong plate the day a group is added. */
/* The PANEL yields, never the plate: flex-shrink defaults to 1, so unshrinkable content
   spills silently instead of the panel scrolling. What must not shrink says flex: none. */
/* The Build row: label left, figure right, like any Debug datum. */
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
.st-plate .k { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); font-family: var(--display); }
.st-plate h3 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.06em; text-transform: var(--case); color: var(--text); }
/* NO reading-width cap. A max-width in ch is right on a page that scrolls; inside a 16:9 stage
   that never scrolls the HEIGHT is the scarce axis and the width is the free one, so capping the
   width spends the scarce thing to save the abundant one. Measured with the 76ch cap the
   Chapters line wrapped onto a second row with a third of the plate still empty to its right. */
.st-plate p { margin: 0; font-size: var(--t-sm); line-height: 1.55; color: var(--steel-faint); }
.st-foot { margin: 0; flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.08em; line-height: 1.5; color: var(--steel-faint); }
/* What takes the spare height inside a plate; headings and paragraphs do not stretch. */
.st-list { flex: 1 1 auto; min-height: 0; }

/* The house chip. */
.st-chip { cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.6) calc(var(--f) * 1.1); background: var(--ink-3); border: 1px solid transparent; color: var(--steel-faint); font-variant-numeric: tabular-nums; --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-chip:hover { color: var(--text); border-color: var(--coral); }
.st-chip[aria-pressed="true"] { background: var(--coral); color: var(--on-coral); }
.st-chips { display: flex; gap: calc(var(--f) * 0.4); flex-wrap: wrap; }

/* \u2500\u2500 Continuity \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.st-figs { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.st-figs b { color: var(--text); font-size: var(--t-sm); }
.st-track { position: relative; height: calc(var(--f) * 0.9); background: var(--ink-3); margin-top: calc(var(--f) * 1.2); }
.st-track > i { display: block; height: 100%; background: var(--steel); transition: width 240ms ease, background 240ms ease; }
.st-mark { position: absolute; top: calc(var(--f) * -0.4); bottom: calc(var(--f) * -0.4); width: 2px; background: color-mix(in srgb, var(--amber) 70%, transparent); }
/* THE LABEL ALIGNS RIGHT, it is not centred on the mark. The mark is pinned at 100% of the bar,
   so a centred label leaves half of it outside: measured, 15px of HORIZONTAL overflow. */
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

/* \u2500\u2500 Help and Changelog: the two rail panels, re-laid-out for the width a plate has \u2500\u2500
   TWO COLUMNS by ORDER. The rail can only be one column at 152px; here there are ~1200, so the
   same list is read by topic instead of scanned end to end. The plates refuse to break, so a
   topic is never split across the fold. */
.st-help, .st-cl { column-count: 2; column-gap: var(--sp-3); }
.st-help > .st-plate, .st-cl > .st-plate { break-inside: avoid; margin-bottom: var(--sp-3); }
.st-help-list { display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); }
/* The item markup is the rail's, and so is its look. What is re-expressed is the SIZE: the rail
   sits outside the view and is written in rem, and inside the stage every font-size has to pass
   through the player's text control or half the screen stops answering it. */
.st-help .gf-faq-q > summary { font-size: var(--t-sm); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.6); gap: calc(var(--f) * 0.5); }
.st-help .gf-faq-q .ic { width: calc(var(--f) * 0.8); height: calc(var(--f) * 0.8); margin-top: calc(var(--f) * 0.22); }
.st-help .gf-faq-q .a { font-size: var(--t-sm); line-height: 1.5; padding: 0 calc(var(--f) * 0.6) calc(var(--f) * 0.6) calc(var(--f) * 1.9); }
/* THE COLOUR IS NOT RE-EXPRESSED, and that is deliberate. The first version put the answers in
   the surface FRONT token, which is a legitimate front over the light panel it is named for and
   near-BLACK in two of the five styles -- measured 1.4:1 on this plate, which is dark in all five.
   A front token is only a front over its own ground. The rail's colour already reads on ink, so
   what travels is exactly nothing. */
/* The buckets sit SIDE BY SIDE here instead of stacked: three short lists across a plate read as
   one release, and stacked they read as three. */
.st-cl-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(var(--f) * 9), 1fr)); gap: var(--sp-3); align-items: start; }
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

/* \u2500\u2500 Visual: the swatches \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
/* The label rests on ANOTHER style's palette with the CURRENT style's text colour, so it
   needs a veil of its own \u2014 opaque WHERE THE TEXT SITS, fading only below it. */
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

/* \u2500\u2500 Debug: the ledger \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Debug uses the same plates as everyone: the SAME declaration, not a similar one \u2014 it was
   the one category without the no-shrink rule and its blocks drew over each other. */
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
/* The call list scrolls inside its own box. Without this cap a long ledger compresses the
   block below it and the two texts draw on top of each other. */
.st-tl-rows { display: flex; flex-direction: column; gap: 1px; min-height: 0; max-height: calc(var(--f) * 22); overflow-y: auto; }
.st-tl-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: baseline; gap: calc(var(--f) * 0.7); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.5); background: var(--ink-3); font-size: var(--t-xs); }
.st-tl-row.bad { border-left: 2px solid var(--alarm); }
.st-tl-t { color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.st-tl-l { color: var(--text); font-family: var(--display); font-weight: 700; letter-spacing: 0.06em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-tl-retry { margin-left: calc(var(--f) * 0.4); font-weight: 700; color: var(--amber); }
.st-tl-u { font-variant-numeric: tabular-nums; min-width: calc(var(--f) * 3.6); text-align: right; }
.st-tl-up { color: var(--steel); }
.st-tl-up::before { content: "\u2191"; margin-right: 2px; color: var(--steel-faint); }
.st-tl-dn { color: var(--jade); }
.st-tl-dn::before { content: "\u2193"; margin-right: 2px; color: var(--steel-faint); }
.st-tl-o { color: var(--steel-faint); }
.st-tl-row.bad .st-tl-o { color: var(--alarm); }
.st-tl-msg { padding: var(--sp-3); text-align: center; color: var(--steel-faint); font-size: var(--t-sm); }
.st-tl-note { margin: 0; font-size: var(--t-tiny); line-height: 1.45; color: var(--steel-faint); }

/* \u2500\u2500 Sources: the setup's controls, re-expressed in the HUD's vocabulary \u2500\u2500\u2500\u2500\u2500\u2500
   The CONTROL is the same one the wizard renders (same markup, ids, wiring); only the skin
   differs. The .st-pane scope exists so these rules cannot reach the wizard. */
/* ONE height for every control in the category: selects and checkboxes draw different
   markup, so heights must come from ONE place or they drift apart. */
/* And the height comes from the TEXT, not the geometric scale: tied to --f the box stays
   fixed while the text inside grows with the text-size control, and the word gets clipped. */
.st-pane { --st-ctl: calc(var(--t-sm) * 1.3 + var(--f) * 1.3); --st-sb: calc(var(--f) * 0.55); }
.st-pane .ob-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); align-content: start; }
.st-pane .ob-grid > * { min-width: 0; }
.st-pane .ob-wide { grid-column: 1 / -1; }
/* A checkbox aligns with the CONTROL beside it, not with its label: it has no label above,
   so top-aligned it sat at the neighbour's label height. It is pushed to the FOOT of its cell. */
.st-pane .ob-field { display: flex; flex-direction: column; gap: calc(var(--f) * 0.35); min-height: 0; }
.st-pane .ob-field:has(> .ob-toggle) { justify-content: flex-end; }
.st-pane .ob-field > label { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.st-pane .ob-field .hint { font-size: var(--t-tiny); line-height: 1.45; color: var(--steel-faint); }
/* The field's ?, in this sheet's units. Same control as the wizard's, markup in onboarding.js;
   only the scale changes, exactly like .ob-bookgrid below. */
.st-pane .ob-labelrow { gap: calc(var(--f) * 0.4); }
.st-pane .ob-help { width: calc(var(--f) * 1.35); height: calc(var(--f) * 1.35); font-size: var(--t-tiny); }
.st-pane .ob-tip { top: calc(100% + var(--f) * 0.35); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.65); font-size: var(--t-tiny); line-height: 1.5; }
.st-pane .ob-req { color: var(--coral); }
/* Control height matches the rest of the game's controls, measured against a real screen. */
.st-pane .ob-control {
  width: 100%; min-height: var(--st-ctl); font: inherit; font-family: var(--display); font-size: var(--t-sm); color: var(--text);
  background: var(--ink-3); border: 1px solid var(--steel-dark); border-left: 2px solid var(--steel-dark);
  padding: 0 calc(var(--f) * 0.8); outline: none;
  --cut: 0.45em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
}
.st-pane .ob-control:hover { border-color: var(--steel); }
/* A select with min-height centres its own text; an input needs the padding. */
.st-pane .ob-control:not(select) { padding-top: calc(var(--f) * 0.5); padding-bottom: calc(var(--f) * 0.5); }
.st-pane .ob-control:focus { border-color: var(--coral); border-left-color: var(--coral); }
/* Same height as the select, from the same arithmetic \u2014 a copied number drifts the first time
   the other one is touched. */
.st-pane .ob-toggle { display: grid; grid-template-columns: calc(var(--f) * 1.4) minmax(0, 1fr); gap: 0 calc(var(--f) * 0.6); align-items: center; cursor: pointer; min-height: var(--st-ctl); padding: 0 calc(var(--f) * 0.8); background: color-mix(in srgb, var(--ink-2) 82%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel-dark); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius-sm); }
.st-pane .ob-toggle:hover { border-color: var(--coral); border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-2) 82%, transparent); }
.st-pane .ob-toggle b { display: block; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.05em; text-transform: var(--case); color: var(--text); line-height: 1.2; }
.st-pane .ob-toggle .bd { display: block; font-size: var(--t-tiny); line-height: 1.35; color: var(--steel-faint); }
.st-pane .ob-bx { width: calc(var(--f) * 1.4); height: calc(var(--f) * 1.4); display: grid; place-items: center; cursor: pointer; background: var(--ink-3); border: 1px solid var(--steel-dark); color: transparent; font-size: var(--t-xs); --cut: 0.3em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-pane .ob-bx[aria-checked="true"] { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }
/* The checkbox columns are sized by their HEADING, not the box \u2014 and heading and rows are
   two grids, so their columns must be declared equal or the labels sit over the wrong boxes. */
.st-pane .ob-bookgrid { display: grid; grid-template-columns: minmax(0, 1fr) calc(var(--f) * 4) calc(var(--f) * 4); align-items: center; gap: 0 calc(var(--f) * 0.4); }
.st-pane .ob-bookhead span:not(:first-child) { text-align: center; letter-spacing: 0.1em; }
/* Heading and row share ONE indent declaration: written separately they drift, because the
   row carries a left border and its own padding. */
.st-pane .ob-bookgrid { padding-inline: calc(var(--f) * 0.5); border-left: 2px solid transparent; }
.st-pane .ob-bookhead { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding-bottom: calc(var(--f) * 0.3); }
.st-pane .ob-bookhead span:not(:first-child) { text-align: center; }
/* The library takes the height its field gives it, with a floor: it is the screen's only long
   list, and a fixed cap left air under it while the books scrolled. */
/* The wide field may shrink; the LIST may not (it has its own floor). Together in one rule,
   this one outranked the list's floor and the floor did nothing. */
.st-pane .ob-field.ob-wide { min-height: 0; }
/* The books get the whole row. The panel may scroll inside its box; the SCREEN may not. */
/* The library in TWO columns: rows flow row-first, so column 1 falls under the first heading
   and column 2 under the second. */
/* The list's scrollbar takes width the heading does not have: the bar gets a width of its
   own and the heading reserves THAT SAME width, from one token. */
.st-pane .ob-booklist::-webkit-scrollbar { width: var(--st-sb); }
.st-pane .ob-booklist::-webkit-scrollbar-thumb { background: var(--steel-dark); }
/* The heading lives INSIDE the list as its first row: as a sibling box, the list scrolls
   and it does not, so the scrollbar eats width from one and their columns drift. Two boxes are
   not aligned by tuning numbers \u2014 they align by being ONE. Sticky keeps it in view. */
.st-pane .ob-booklist .ob-bookhead { position: sticky; top: 0; z-index: 1; background: var(--ink-2); }
/* The stretch is VERTICAL and the visible count is the user's choice: every visible book is
   height the plate takes from the panel, and the rest scrolls inside the list under a sticky
   heading. */
/* A fixed number of books in view, the user's choice \u2014 the rest scroll inside the list.
   The heading occupies one slot of the list, so the height is N rows PLUS its own. */
.st-pane .ob-booklist { min-width: 0; flex: 0 1 auto; min-height: calc(var(--f) * 20); max-height: calc(var(--f) * 20); overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 1px; }
.st-pane .ob-field.ob-wide { min-height: 0; }
.st-pane .ob-book { min-width: 0; padding-block: calc(var(--f) * 0.35); background: var(--ink-3); }
.st-pane .ob-book:hover { border-left-color: var(--steel); }
.st-pane .ob-book.on { border-left-color: var(--coral); background: color-mix(in srgb, var(--ink-3) 70%, var(--coral) 10%); }
.st-pane .ob-book .bt { min-width: 0; }
.st-pane .ob-book b { display: block; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.04em; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The book's description does not travel to Settings: it earns its place in the WIZARD,
   where books are new. Here the NAME distinguishes them, and the height buys visible books \u2014
   the one thing this plate is short of. */
.st-pane .ob-book .bd { display: none; }
.st-pane .ob-books-empty { font-size: var(--t-xs); color: var(--steel-faint); padding: calc(var(--f) * 0.5); }
.st-pane .ob-budget { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
.st-pane .ob-bud { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); }
.st-pane .ob-bud .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
/* Wide enough for the full figure: a value clipped INSIDE an input is invisible to every
   ancestor-based overflow check, because the control itself does the clipping. */
.st-pane .ob-bud input { width: calc(var(--f) * 8.5); font-family: var(--display); font-weight: 700; font-size: var(--t-sm); color: var(--text); background: var(--ink-3); border: 1px solid var(--steel-dark); padding: calc(var(--f) * 0.3) calc(var(--f) * 0.5); text-align: right; font-variant-numeric: tabular-nums; outline: none; --cut: 0.35em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-pane .ob-bud input:focus { border-color: var(--coral); }
.st-pane .ob-bud .w { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.08em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
/* That something does NOT fit is what this number exists for. */
.st-pane .ob-bud .w[data-over="true"] { color: var(--amber); }
`;function Oe(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var Ao=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function No(t){let e=Ao[t];return e?`Chapter ${e}`:`Chapter ${t}`}var Ir=["Reading the scenario\u2026","Forging the chapter\u2026","Writing the story beats\u2026"],la=["Reading the scenario\u2026","Summoning the founding cast\u2026","Naming the heroes\u2026"],ot=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
}

/* The forge backdrop: the HUD's room, tinted by the ember heat rising from below. */
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
`,Rr=`
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
</svg>`,Lr='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';function Co(){return{label:"Founding Cast",status:la[0],eyebrow:"Summoning the founding cast",brandNote:"&middot; first-time setup",foot:"Summoning this world's founding heroes from your scenario &mdash; the cast the story is built around. This happens once.",errorStatus:"Couldn't summon the founding cast.",errorBody:"The summon returned units that didn't match the expected format. Nothing was saved."}}function Io({done:t=0,total:e=0,name:a=""}={}){let r=Math.min(t+1,Math.max(e,1));return{label:"Founding Cast",status:a?`Painting ${a}\u2026 ${r}/${e}`:`Painting the founding cast\u2026 ${t}/${e}`,eyebrow:"Painting the founding cast",brandNote:"&middot; first-time setup",foot:"Generating each hero's portrait, one at a time, so they have a face when they speak in the story. The first chapter is being forged at the same time.",errorStatus:"Couldn't paint the cast.",errorBody:"No portrait could be generated. Check the world's image connection &mdash; the story is ready either way, and the heroes will show their silhouette until art exists.",retryLabel:"Continue"}}function Ro(t,e){let a=Number(e)<=1;return{label:t,status:Ir[0],eyebrow:a?"Forging the first chapter":"Forging the next chapter",brandNote:a?"&middot; first-time setup":"&middot; new chapter",foot:a?`Forging ${Oe(t)}'s story beats from your scenario. This happens once &mdash; the story is written before you play it.`:`Forging ${Oe(t)}'s story beats from your scenario &mdash; the story is written before you play it.`,errorStatus:"Couldn't read the forged chapter.",errorBody:"The forge returned a plan that didn't match the expected format. Nothing was saved."}}function Lt({scenario:t,chapter:e=1,error:a=!1,mode:r="chapter",art:s}){let n=t&&t.trim()?t.trim():"Your scenario",i=r==="banner"?Co():r==="art"?Io(s):Ro(No(e),e),l=i.label,h=a?i.errorStatus:i.status,p=i.eyebrow,d=i.brandNote,o=i.foot;return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${a?" -error":""}">
    <div class="forge-brand">
      <span class="rhombus" aria-hidden="true"></span>
      <b>Gacha Forge</b><span>${d}</span>
    </div>

    <div class="forge-center">
      ${Rr}
      <span class="eyebrow">${p}</span>
      <h2>${Oe(l)}</h2>
      <span class="scenario">${Oe(n)}</span>
      <div class="forge-status" aria-live="polite">${Oe(h)}</div>
      <p class="forge-error"${a?"":" hidden"}>${i.errorBody}</p>
      <button class="forge-retry" type="button"${a?"":" hidden"}>${Oe(i.retryLabel||"Retry")}</button>
    </div>

    <p class="forge-foot">
      ${Lr}
      <span>${o}</span>
    </p>
  </div>
</div>`}function Mr({chapterTitle:t,error:e=!1}={}){let a=t&&t.trim()?t.trim():"Chapter One",r=e?"Couldn't write this beat.":"Generating story\u2026";return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${e?" -error":""}">
    <div class="forge-brand"><span class="rhombus" aria-hidden="true"></span><b>Gacha Forge</b></div>
    <div class="forge-center">
      ${Rr}
      <span class="eyebrow">Story</span>
      <h2>${Oe(a)}</h2>
      <div class="forge-status" aria-live="polite">${Oe(r)}</div>
      <p class="forge-error"${e?"":" hidden"}>The narrator returned something unreadable. Nothing was saved.</p>
      <button class="forge-retry" type="button"${e?"":" hidden"}>Retry</button>
    </div>
    <p class="forge-foot">${Lr}<span>The narrator is writing this beat. It will appear when it's ready.</span></p>
  </div>
</div>`}function lt(t,{onRetry:e,cycle:a,phases:r}){let s=t.querySelector(".forge-retry");s&&s.addEventListener("click",()=>e?.());let n=t.querySelector(".forge-status");if(!a||!n)return()=>{};let i=Array.isArray(r)&&r.length?r:Ir,l=0;n.textContent=i[0];let h=setInterval(()=>{l=(l+1)%i.length,n.textContent=i[l]},1100);return()=>clearInterval(h)}function Br(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Fr(t){return(t<10?"0":"")+t}var zr=10,Lo=5,Mo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Bo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>',zo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Or=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */







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

/* The head is NOT always here. hoistHeadIntoBar MOVES it into the shell's top bar and
   calls head.remove(), so this box is normally left holding ONE child: the body. With a fixed
   auto 1fr template that child auto-places into row 1 \u2014 the AUTO one \u2014 and sizes itself to its
   own content instead of to the screen. That is what made the character sheet's portrait plate a
   different height on every tab (Bond 231px, Profile ~700px: measured on screen) and what left
   the dead band under Summon. No harness could reproduce it either, because a harness renders
   the screen standalone and never hoists.
   :has() gives the second row only while the head is actually present. */
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
/* Enter/Continue/Begin navigate \u2014 they don't spend a turn, so NOT solid coral: coral
   outline that fills on hover. Solid coral stays reserved for the node map's Play. */
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
`;function Pr(){return`
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
</div>`}function Fo(t){let e=Fr(t.chapter),a=`Chapter ${we(t.chapter)} &middot; ${t.cleared?"Cleared":"In progress"}`,r,s;if(t.cleared){let n=t.combats||Lo,i=(t.hard||0)>=n?" on":"",l=(t.veryhard||0)>=n?" on":"";r=`<span class="diffs"><span class="on">N</span><span class="${i.trim()}">H</span><span class="${l.trim()}">V</span></span>`,s='<button class="btn btn-enter" type="button">Enter</button>'}else{let n=t.normal||0,i=Math.min(100,Math.round(n/zr*100));r=`<div class="ch-bar"><div class="fig">${n} / ${zr} nodes</div><div class="track"><i style="width:${i}%"></i></div></div>`,s=`<button class="btn btn-go" type="button">${n>0?"Continue":"Enter"}</button>`}return`<article class="ch-card ${t.cleared?"cleared":"current"}" data-open-chapter="${t.chapter}"><div class="ch-index">${e}</div><div class="ch-body"><div class="ch-eyebrow">${a}</div><h3 class="ch-title">${Br(t.title)}</h3><p class="ch-premise">${Br(t.premise)}</p><div class="ch-foot">${r}</div></div><div class="ch-action">${s}</div></article>`}function Oo(t,e){let a=Fr(t);if(e)return`<article class="ch-card new" data-open-chapter="${t}"><div class="ch-index">${a}</div><div class="ch-body"><div class="ch-eyebrow">Chapter ${we(t)} &middot; New</div><h3 class="ch-title">A new chapter awaits</h3><p class="ch-premise">Unlocked. Forge it when you're ready &mdash; it continues from everything so far.</p><div class="ch-foot"><span class="ch-hint">${Mo}Fresh chapter, ready to forge</span></div></div><div class="ch-action"><button class="btn btn-go" type="button">Begin${zo}</button></div></article>`;let r=we(t-1);return`<article class="ch-card locked"><div class="ch-index">${a}</div><div class="ch-body"><div class="ch-eyebrow">Chapter ${we(t)} &middot; Locked</div><h3 class="ch-title">Uncharted</h3><p class="ch-premise">The next chapter hasn't been written. Clear Chapter ${r} on Normal to unlock it.</p><div class="ch-foot"><span class="ch-hint">${Bo}Clear Chapter ${r} on Normal</span></div></div><div class="ch-action"></div></article>`}function Dr(t,e,a){let r=Array.isArray(t)?t:[];return r.map(Fo).join("")+Oo(e||r.length+1,!!a)}var qr={blade:()=>'<path d="M150 30 176 150 166 320 150 350 134 320 124 150Z"/><rect x="108" y="300" width="84" height="18"/><rect x="140" y="318" width="20" height="56"/><circle cx="150" cy="384" r="12"/>',edge:()=>'<path d="M150 96c22 44 30 108 21 176l-13 30-8 8-8-8-13-30c-9-68-1-132 21-176Z"/><path d="M104 306h92v18h-92Z"/><rect x="139" y="324" width="22" height="48"/><path d="M150 360 168 380 150 400 132 380Z"/>',bulwark:()=>'<path d="M150 34 254 74c0 130-30 232-104 300C76 306 46 204 46 74Z"/><path d="M150 96v212M92 150h116" stroke="#0E1420" stroke-opacity="0.32" stroke-width="9" fill="none"/>',focus:t=>'<circle cx="150" cy="228" r="74"/><path d="M150 40 172 86 150 132 128 86Z"/><ellipse cx="150" cy="228" rx="122" ry="44" fill="none" stroke="'+t+'" stroke-width="11"/>',tome:()=>'<path d="M132 70h74q18 0 18 18v224q0 18-18 18h-74Z"/><path d="M78 70h36v260H78q-9 0-9-12V82q0-12 9-12Z"/><path d="M224 98h18v204h-18Z"/>'};function Re(t,e){let a="url(#"+e+")",r=qr[t]||qr.blade;return'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="'+a+'">'+r(a)+"</g></svg>"}var _e={core:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 6l6 5v10l-6 5-6-5V11z"/><circle cx="12" cy="16" r="2.5"/></svg>',edge:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5l4 8-4 14-4-14z"/><path d="M8 13h8"/></svg>',flow:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5c5 5 5 9 0 12S7 24 12 27"/><circle cx="12" cy="16" r="7"/></svg>',crest:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 8h12v9c0 5-6 8-6 8s-6-3-6-8z"/><path d="M12 12v7"/></svg>'};function ct(t){return _e[String(t)]||_e.core}function ue(t,e){let r=String(t).endsWith("Pct")?Number(e)*100:Number(e);return"+"+Math.round(r*10)/10+"%"}function dt(t){let e=String(t||"");return e?e.charAt(0).toUpperCase()+e.slice(1):""}var Hr={fire:"water",water:"wind",wind:"earth",earth:"fire",light:"dark",dark:"light"},Po={fire:"#F2603C",water:"#4A9BD4",wind:"#2EBE9E",earth:"#F0B429",light:"#F5E3A2",dark:"#9B6FD4"},$r=20,jr=6,Gr=1.5,Do=.4,ca=1.6,Yr=.65,ht=.15,da=1.1,Kr=.25,Xr=.15,Jr=.1,Zr=.6;function ce(t){let e=Number(t);return Math.max(.2,Math.min(6,(Number.isFinite(e)?e:100)/100))}function ye(t){return Math.max(Jr,Math.min(Zr,ce(t)*Xr))}var Ur=30,qo=10,Qr=30,He={crit:15,critDmg:150,recharge:100,effectHit:0,effectRes:0,healBonus:0},Ho=.15,$o=1;var ha=3,es=.4,ts=1,as=3,rs=.35,ss=35,ns=.5,is=1,jo=30,Uo=3,pa=1.8,os=.05,ls=2,cs=.08,ds=15,hs=.4,ps=12,fs=.3,Mt=.35,us=.02,vs=.1,gs=.18,ms=.2,bs={ATK_K:Gr,ULT_SINGLE:ca,ULT_AOE:Yr,HEAL_SCALE:ht,SHIELD_SCALE:da,DOT_SCALE:Kr,BUFF_SCALE:Xr,BUFF_MIN:Jr,BUFF_MAX:Zr,FOCUS:pa,DOT_ROUNDS:as,BUFF_ROUNDS:ha,REVIVE_PCT:rs,ENERGY_GRANT:ss,DRAIN_SHARE:es,LOW_PCT:Mt,AURA_REGEN:us,AURA_MITIGATION:vs,AURA_SHIELD:gs,RESIST_MITIGATION:ms,RIDER_BURN:os,RIDER_FLOW:cs,RIDER_HASTE:ds,RIDER_BULWARK:hs,RIDER_RADIANCE:ps,RIDER_BLIGHT:fs,EXECUTE_BONUS:ts,ENERGY_KILL:Qr,RIDER_BURN_ROUNDS:ls,CLEANSE_SHARE:ns,STUN_TURNS:is};function V(t,e,a){let r=t&&t.fx?Number(t.fx[e]):NaN;return Number.isFinite(r)?r:a}function Bt(t){return String(t||"").toLowerCase()}function Vr(t){return Po[Bt(t)]||"#FFFFFF"}function Je(t,e){let a=Bt(t),r=Bt(e);return Hr[a]===r?{mult:1.5,label:"STRONG"}:Hr[r]===a?{mult:.75,label:"WEAK"}:{mult:1,label:""}}function Vo(t){let e=t>>>0;return function(){e|=0,e=e+1831565813|0;let a=Math.imul(e^e>>>15,1|e);return a=a+Math.imul(a^a>>>7,61|a)^a,((a^a>>>14)>>>0)/4294967296}}function ys(t){let e=2166136261,a=String(t||"seed");for(let r=0;r<a.length;r+=1)e^=a.charCodeAt(r),e=Math.imul(e,16777619);return e>>>0}function Ze(t,e){let a=Number(t);return Number.isFinite(a)?a:e}function Wr(t,e,a){let r=t&&t.stats||{},s=Number(t&&t.power)>0?Number(t.power):1,n=(Number(r.hp)||50)*s,i=(Number(r.atk)||50)*s,l=(Number(r.def)||50)*s,h=Number(r.spd)||50;return{id:t.id||`${e}-${a}`,name:t.name||(e==="ally"?"Hero":"Foe"),side:e,role:t.role||"Warrior",aff:Bt(t.affinity),position:t.position==="back"?"back":"front",hpMax:$r+n*jr,hp:$r+n*jr,atk:i,def:l,spd:h,energy:0,shield:0,atkMod:1,defMod:1,modRounds:0,burn:0,burnRounds:0,dmgReduction:0,roundShield:0,stunTurns:0,fx:t&&t.facets||null,regen:0,skill:t&&t.skill||null,passive:t&&t.passive||null,granted:t&&t.granted||null,grantedCd:0,grantedArmed:!1,crit:Ze(r.crit,He.crit),critDmg:Ze(r.critDmg,He.critDmg),recharge:Ze(r.recharge,He.recharge),effectHit:Ze(r.effectHit,He.effectHit),effectRes:Ze(r.effectRes,He.effectRes),healBonus:Ze(r.healBonus,He.healBonus),alive:!0}}function ws({allies:t=[],enemies:e=[],seed:a=1}={}){let r=Vo(a>>>0||1),s=t.map((c,m)=>Wr(c,"ally",m)),n=e.map((c,m)=>Wr(c,"enemy",m)),i=s.concat(n),l=new Map(i.map(c=>[c.id,c])),h=[],p=c=>c.side==="ally"?s:n,d=c=>c.side==="ally"?n:s,o=c=>c.filter(m=>m.alive),u=c=>Math.max(0,Math.round(c.hp/c.hpMax*100)),f=c=>({hp:Math.max(0,Math.round(c.hp)),hpMax:Math.round(c.hpMax)});function v(c,m){h.push({d:c,events:m.filter(Boolean)})}function w(c){return{op:"hp",id:c.id,pct:u(c),...f(c)}}function g(c){return{op:"energy",id:c.id,pct:Math.round(c.energy)}}function x(c,m){return c.alive?(c.energy=Math.min(100,c.energy+m*(c.recharge/100)),g(c)):null}function S(c,m,_){let T=Math.max(1,Math.round(m));if(c.shield>0){let W=Math.min(c.shield,T);c.shield-=W,T-=W}return T=Math.round(T*(1-(c.dmgReduction||0))),T=Math.max(1,T),c.hp=Math.max(0,c.hp-T),c.hp<=0&&c.alive&&(c.alive=!1),T}function A(c,m){let _=Math.max(Ho,Math.min($o,1+(c.effectHit-m.effectRes)/100));return _>=1||r()<_}function z(c){let m=o(d(c));if(!m.length)return null;let _=m.filter(W=>W.position==="front"),T=_.length?_:m;return T.reduce((W,O)=>O.hp<W.hp?O:W,T[0])}let U=new Set(["damage","aoe_damage","debuff","drain","execute","dot","stun"]);function R(c){let m=o(p(c));return m.length?m.reduce((_,T)=>T.hp/T.hpMax<_.hp/_.hpMax?T:_,m[0]):null}function q(c,m,_){let T=U.has(m),W=o(T?d(c):p(c));if(!W.length)return[];let O=$=>{let Y=W.filter(fe=>fe.position===$);return Y.length?Y:W},j;switch(_){case"self":j=T?[z(c)]:[c];break;case"ally":case"enemy":j=T?[z(c)]:[R(c)];break;case"allies":case"all_enemies":j=W;break;case"front_row":j=O("front");break;case"back_row":j=O("back");break;default:j=T?[z(c)]:W;break}return j=j.filter(Boolean),m==="aoe_damage"&&j.length<=1&&(j=W),j}let L=c=>c<=1?pa:1,P=2;function X(c,m){return m.effect==="debuff"?o(d(c)):m.target==="self"?[c]:o(p(c))}function J(c,m,_,T){let W=Number(T)||1,O=Number(m.power)||20,j=X(c,m);if(j.length){if(m.effect==="buff"){for(let $ of j)$.atkMod+=ye(O)*W,$.modRounds=Math.max($.modRounds,P);_.push({op:"buff",id:c.id,text:"ATK \u25B2"})}else if(m.effect==="debuff"){for(let $ of j)$.defMod=Math.max(.5,$.defMod-ye(O)*W),$.modRounds=Math.max($.modRounds,P);_.push({op:"debuff",id:c.id,text:"DEF \u25BC"})}else if(m.effect==="shield"){let $=Math.round(c.def*da*.5*ce(O)*W);for(let Y of j)Y.shield+=$;_.push({op:"shieldFx",ids:j.map(Y=>Y.id)})}else if(m.effect==="heal"){let $=Math.round(c.hpMax*ht*.5*ce(O)*W);for(let Y of j)Y.hp=Math.min(Y.hpMax,Y.hp+$),_.push({op:"heal",id:Y.id,amount:$,hpPct:u(Y),...f(Y)})}else if(m.effect==="damage"||m.effect==="aoe_damage"){let $=m.effect==="aoe_damage"?o(d(c)):[z(c)].filter(Boolean);for(let Y of $){let fe=Je(c.aff,Y.aff),st=S(Y,c.atk*ca*.4*ce(O)*W*fe.mult,_);_.push({op:"hit",id:Y.id,amount:st,effLabel:fe.label,crit:!1,hpPct:u(Y),...f(Y)}),Y.alive||(_.push({op:"death",id:Y.id}),b(Y,_),k(c,_))}}}}function te(){let c=[{op:"start"}];for(let m of i)c.push(w(m),g(m));for(let m of i){let _=m.passive;if(!(!_||!m.alive))if(_.trigger==="battle_start"||_.trigger==="self")J(m,_,c,V(m,"passiveScale",1));else if(_.trigger==="aura")for(let T of p(m))_.effect==="buff"?T.dmgReduction=Math.max(T.dmgReduction,V(m,"auraMitigation",vs)):_.effect==="heal"?T.regen=Math.max(T.regen,Math.round(m.hpMax*V(m,"auraRegen",us)*ce(_.power))):_.effect==="shield"&&(T.roundShield=Math.max(T.roundShield||0,Math.round(m.def*V(m,"auraShield",gs)*ce(_.power))));else _.trigger==="resist"&&(m.dmgReduction=Math.max(m.dmgReduction,V(m,"resistMitigation",ms)),c.push({op:"buff",id:m.id,text:"RESIST"}))}return c}function le(c,m){let _=c.passive;!_||!c.alive||_.trigger!=="on_attack"||J(c,_,m,V(c,"onAttackScale",.5))}function oe(c,m,_){let T=c.passive;T&&c.alive&&T.trigger==="on_hit"&&J(c,T,_,V(c,"onHitScale",.5)),E(c,_),Q(c,_)}let se=new Map,re=(c,m)=>Number(c.get(m))||0;function Q(c,m){for(let _ of o(p(c))){let T=_.passive;!T||T.trigger!=="on_ally_low"||re(se,_.id)>=V(_,"lowFires",1)||c.hp/c.hpMax>Mt||(se.set(_.id,re(se,_.id)+1),J(_,T,m,1.2))}}function ve(c){let m=c.passive;if(!m||!c.alive||m.trigger!=="on_round")return;let _=[];J(c,m,_,V(c,"onRoundScale",Mt)),_.length&&v(260,_)}let ne=new Map;function E(c,m){let _=c.passive;!_||!c.alive||_.trigger!=="on_low"||re(ne,c.id)>=V(c,"lowFires",1)||c.hp/c.hpMax>Mt||(ne.set(c.id,re(ne,c.id)+1),J(c,_,m,1.2))}function b(c,m){let _=c.passive;!_||_.trigger!=="on_death"||J(c,_,m,V(c,"onDeathScale",1.4))}function y(c,m){let _=c.passive;!_||!c.alive||_.trigger!=="on_ult"||J(c,_,m,V(c,"onUltScale",.7))}function k(c,m){if(!c.passive||!c.alive||c.passive.trigger!=="on_kill")return;let _=x(c,V(c,"energyKill",Qr));_&&m.push(_),J(c,c.passive,m,.6)}function N(c,m){c.modRounds>0&&(c.modRounds-=1,c.modRounds===0&&(c.atkMod=1,c.defMod=1)),c.roundShield>0&&c.alive&&(c.shield+=c.roundShield,m.push({op:"shieldFx",ids:[c.id]})),c.burnRounds>0&&c.alive&&(c.burnRounds-=1,S(c,c.burn,m),m.push({op:"hit",id:c.id,amount:c.burn,effLabel:"",crit:!1,hpPct:u(c),...f(c)}),c.alive||m.push({op:"death",id:c.id})),c.regen>0&&c.alive&&c.hp<c.hpMax&&(c.hp=Math.min(c.hpMax,c.hp+c.regen))}function I(c,m,_,T){let W=V(c,"riderExtra",1);switch(c.aff){case"fire":for(let O of m)O.alive&&(O.burn=Math.round(O.hpMax*V(c,"riderBurn",os)*W),O.burnRounds=V(c,"riderBurnRounds",ls));break;case"water":{let O=o(p(c));if(O.length){let j=O.reduce((Y,fe)=>fe.hp/fe.hpMax<Y.hp/Y.hpMax?fe:Y,O[0]),$=Math.round(c.hpMax*V(c,"riderFlow",cs)*W);j.hp=Math.min(j.hpMax,j.hp+$),T.push({op:"heal",id:j.id,amount:$,hpPct:u(j),...f(j)})}break}case"wind":for(let O of o(p(c))){let j=x(O,V(c,"riderHaste",ds)*W);j&&T.push(j)}break;case"earth":for(let O of o(p(c)).filter(j=>j.position==="front"))O.shield+=Math.round(c.def*V(c,"riderBulwark",hs)*W);T.push({op:"shieldFx",ids:o(p(c)).filter(O=>O.position==="front").map(O=>O.id)});break;case"light":for(let O of o(p(c))){O.defMod=Math.min(1,O.defMod),V(c,"riderRadianceFull",0)&&O.atkMod<1&&(O.atkMod=1);let j=x(O,V(c,"riderRadiance",ps)*W);j&&T.push(j)}break;case"dark":{let O=Math.round(_*V(c,"riderBlight",fs)*W);O>0&&c.alive&&(c.hp=Math.min(c.hpMax,c.hp+O),T.push({op:"heal",id:c.id,amount:O,hpPct:u(c),...f(c)}));break}default:break}}function G(c){let m=z(c);if(!m)return;let _=[{op:"act",id:c.id}];le(c,_);let T=Je(c.aff,m.aff),W=r()<c.crit/100,O=(c.atk*c.atkMod*Gr-m.def*m.defMod*Do)*T.mult*(W?c.critDmg/100:1),j=S(m,O,_);_.push({op:"hit",id:m.id,amount:j,effLabel:T.label,crit:W,hpPct:u(m),...f(m)}),V(c,"riderOnAttack",0)&&c.alive&&I(c,m.alive?[m]:[],j,_),m.alive?oe(m,c,_):(_.push({op:"death",id:m.id}),b(m,_),k(c,_));let $=x(c,Ur);$&&_.push($);let Y=x(m,qo);Y&&m.alive&&_.push(Y),v(520,_)}function ke(c,m,_){let T=[{op:"ult",id:c.id,name:m.name||"Ultimate",sub:`${c.name} \xB7 ${c.role} \xB7 ${m.effect}`,weapon:!!_}];_||y(c,T);let W=0,O=m.effect,j=!_&&c.fx&&c.fx.reach?c.fx.reach:m.target,$=q(c,O,j),Y=$.length>1,fe=!_&&V(c,"keepFocus",0)?pa:L($.length),st=V(c,"ultSingle",ca),qa=V(c,"ultAoe",Yr);if(O==="damage"||O==="aoe_damage"){Y&&T.push({op:"aoe",side:c.side==="ally"?"enemies":"allies",color:Vr(c.aff)});let F=(Y?qa:st)*ce(m.power);for(let M of $){let ie=Je(c.aff,M.aff),Ee=!Y&&r()<c.crit/100,Pe=c.atk*c.atkMod*F*ie.mult*(Ee?c.critDmg/100:1),Ha=S(M,Pe,T);W+=Ha,T.push({op:"hit",id:M.id,amount:Ha,effLabel:ie.label,crit:Ee,hpPct:u(M),...f(M)}),M.alive||(T.push({op:"death",id:M.id}),b(M,T),k(c,T))}}else if(O==="heal"){let F=Math.round(c.hpMax*V(c,"healScale",ht)*ce(m.power)*fe*(1+c.healBonus/100));for(let M of $)M.hp=Math.min(M.hpMax,M.hp+F),T.push({op:"heal",id:M.id,amount:F,hpPct:u(M),...f(M)})}else if(O==="shield"){let F=Math.round(c.def*V(c,"shieldScale",da)*ce(m.power)*fe);for(let M of $)M.shield+=F;T.push({op:"shieldFx",ids:$.map(M=>M.id)}),T.push({op:"buff",id:c.id,text:"SHIELD"})}else if(O==="buff"){for(let F of $)F.atkMod+=ye(m.power)*fe,F.modRounds=Math.max(F.modRounds,V(c,"buffRounds",ha));T.push({op:"buff",id:c.id,text:"ATK \u25B2"})}else if(O==="debuff")for(let F of $){if(!A(c,F)){T.push({op:"debuff",id:F.id,text:"RESIST"});continue}F.defMod=Math.max(.5,F.defMod-ye(m.power)*fe),F.modRounds=Math.max(F.modRounds,V(c,"buffRounds",ha)),T.push({op:"debuff",id:F.id,text:"DEF \u25BC"})}else if(O==="drain"){let F=(Y?qa:st)*ce(m.power);Y&&T.push({op:"aoe",side:c.side==="ally"?"enemies":"allies",color:Vr(c.aff)});for(let ie of $){let Ee=Je(c.aff,ie.aff),Pe=S(ie,c.atk*c.atkMod*F*Ee.mult,T);W+=Pe,T.push({op:"hit",id:ie.id,amount:Pe,effLabel:Ee.label,crit:!1,hpPct:u(ie),...f(ie)}),ie.alive||(T.push({op:"death",id:ie.id}),b(ie,T),k(c,T))}let M=Math.round(W*V(c,"drainShare",es));M>0&&c.alive&&(c.hp=Math.min(c.hpMax,c.hp+M),T.push({op:"heal",id:c.id,amount:M,hpPct:u(c),...f(c)}))}else if(O==="execute")for(let F of $){let M=Je(c.aff,F.aff),ie=1-F.hp/F.hpMax,Ee=1+ie*V(c,"executeBonus",ts),Pe=S(F,c.atk*c.atkMod*st*ce(m.power)*M.mult*Ee,T);W+=Pe,T.push({op:"hit",id:F.id,amount:Pe,effLabel:M.label,crit:ie>.5,hpPct:u(F),...f(F)}),F.alive||(T.push({op:"death",id:F.id}),b(F,T),k(c,T))}else if(O==="dot")for(let F of $){if(!A(c,F)){T.push({op:"debuff",id:F.id,text:"RESIST"});continue}F.burn=Math.max(F.burn,Math.round(c.atk*c.atkMod*Kr*ce(m.power)*Je(c.aff,F.aff).mult)),F.burnRounds=Math.max(F.burnRounds,V(c,"dotRounds",as)),T.push({op:"debuff",id:F.id,text:"DOT"})}else if(O==="stun")for(let F of $){if(!A(c,F)){T.push({op:"debuff",id:F.id,text:"RESIST"});continue}F.stunTurns=Math.max(F.stunTurns,V(c,"stunTurns",is)),T.push({op:"stun",id:F.id})}else if(O==="cleanse"){let F=Math.round(c.hpMax*ht*V(c,"cleanseShare",ns)*ce(m.power)*fe);for(let M of $)M.burn=0,M.burnRounds=0,M.stunTurns=0,M.atkMod<1&&(M.atkMod=1),M.defMod<1&&(M.defMod=1),M.hp=Math.min(M.hpMax,M.hp+F),T.push({op:"heal",id:M.id,amount:F,hpPct:u(M),...f(M)});T.push({op:"buff",id:c.id,text:"CLEANSE"})}else if(O==="revive"){let F=p(c).filter(M=>!M.alive);if(F.length){let M=F.reduce((ie,Ee)=>Ee.hpMax>ie.hpMax?Ee:ie,F[0]);M.alive=!0,M.hp=Math.round(M.hpMax*V(c,"revivePct",rs)),M.energy=0,T.push({op:"revive",id:M.id}),T.push({op:"heal",id:M.id,amount:M.hp,hpPct:u(M),...f(M)})}else for(let M of o(p(c))){let ie=Math.round(c.hpMax*ht*.4*ce(m.power));M.hp=Math.min(M.hpMax,M.hp+ie),T.push({op:"heal",id:M.id,amount:ie,hpPct:u(M),...f(M)})}}else if(O==="energy"){let F=Math.round(V(c,"energyGrant",ss)*fe);for(let M of $){let ie=x(M,F);ie&&T.push(ie)}T.push({op:"buff",id:c.id,text:"CHARGE"})}if(I(c,U.has(O)?$:[],W,T),!_)c.energy=0,T.push(g(c)),c.granted&&c.granted.trigger==="energy"&&(c.grantedArmed=!0);else{let F=x(c,Ur);F&&T.push(F),c.granted&&c.granted.trigger!=="energy"?c.grantedCd=Uo:c.grantedArmed=!1}v(950,T)}function Be(c){ke(c,c.skill||{effect:"damage",power:60,target:"enemy",name:"Strike"},!1)}function ae(c){return!c.granted||!c.granted.effect?!1:c.granted.trigger==="energy"?c.grantedArmed:c.grantedCd<=0}function C(c){return o(c).length===0}v(700,te());let K=0,Z=null;for(;K<jo;){K+=1;let c=o(i).slice().sort((m,_)=>_.spd-m.spd||(m.id<_.id?-1:1));for(let m of c){if(!m.alive)continue;let _=[];if(N(m,_),_.length&&v(220,_),!!m.alive){if(C(n)){Z="win";break}if(C(s)){Z="lose";break}if(m.stunTurns>0){m.stunTurns-=1,v(300,[{op:"stun",id:m.id}]);continue}if(ve(m),!!m.alive){if(m.grantedCd>0&&(m.grantedCd-=1),m.energy>=100?Be(m):ae(m)?ke(m,m.granted,!0):G(m),C(n)){Z="win";break}if(C(s)){Z="lose";break}}}}if(Z)break}if(!Z){let c=m=>m.reduce((_,T)=>_+Math.max(0,T.hp)/T.hpMax,0)/(m.length||1);Z=c(s)>c(n)?"win":"lose"}return v(800,[{op:"end",result:Z}]),{result:Z,steps:h}}var D=bs;function H(t){return Math.round(Number(t)*1e3)/10+"%"}var xs=new Set(["enemy","ally","self"]),Wo=["damage","aoe_damage","debuff","drain","execute","dot","stun"];function Go(t,e){let a=Wo.includes(t);if(t==="aoe_damage"&&xs.has(e))return"every enemy";switch(e){case"self":return a?"the weakest front-line enemy":"itself";case"enemy":return"the weakest front-line enemy";case"ally":return"the ally who needs it most";case"allies":return"the whole team";case"all_enemies":return"every enemy";case"front_row":return a?"the enemy front line":"your front line";case"back_row":return a?"the enemy BACK line \u2014 past the front":"your back line";default:return a?"the weakest front-line enemy":"the whole team"}}function fa(t){return!xs.has(t.target)||t.effect==="aoe_damage"}var Yo={fire:"<b>Fire</b> also burns what it hits for <b>"+H(D.RIDER_BURN)+" of that target's max HP</b> per round, for 2 rounds.",water:"<b>Water</b> also heals your most hurt ally for <b>"+H(D.RIDER_FLOW)+" of the caster's own max HP</b>.",wind:"<b>Wind</b> also gives every teammate <b>+"+D.RIDER_HASTE+" energy</b> (a full bar is 100).",earth:"<b>Earth</b> also shields your front line for <b>"+H(D.RIDER_BULWARK)+" of the caster's DEF</b> each.",light:"<b>Light</b> also clears one DEF debuff from the team and gives everyone <b>+"+D.RIDER_RADIANCE+" energy</b>.",dark:"<b>Dark</b> also returns <b>"+H(D.RIDER_BLIGHT)+" of the damage dealt</b> to the caster as health."};function ks(t){return Yo[String(t||"").toLowerCase()]||""}function ua(t){if(!t||!t.effect)return"";let e=ce(t.power),a=Go(t.effect,t.target),r=fa(t),s=r?1:D.FOCUS;switch(t.effect){case"damage":case"drain":{let n=(r?D.ULT_AOE:D.ULT_SINGLE)*e,i=t.effect==="drain"?" Heals the caster for "+H(D.DRAIN_SHARE)+" of what it deals.":"";return"Hits "+a+" for <b>"+H(n)+" of ATK</b>"+(r?" each":"")+"."+i}case"aoe_damage":return"Sweeps "+a+" for <b>"+H(D.ULT_AOE*e)+" of ATK</b> each.";case"execute":return"Hits "+a+" for <b>"+H(D.ULT_SINGLE*e)+" of ATK</b>, up to <b>"+H(D.ULT_SINGLE*e*2)+"</b> against a target that is nearly down.";case"dot":return"Poisons "+a+" for <b>"+H(D.DOT_SCALE*e)+" of ATK</b> per round, for "+D.DOT_ROUNDS+" rounds. Ignores shields.";case"stun":return"Makes "+a+" lose its next turn.";case"heal":return"Heals "+a+" for <b>"+H(D.HEAL_SCALE*e*s)+" of the caster's own max HP</b>.";case"shield":return"Shields "+a+" for <b>"+H(D.SHIELD_SCALE*e*s)+" of the caster's DEF</b>.";case"cleanse":return"Clears poison, stuns and debuffs from "+a+", and heals <b>"+H(D.HEAL_SCALE*.5*e*s)+" of the caster's max HP</b>.";case"revive":return"Brings one fallen ally back at <b>"+H(D.REVIVE_PCT)+"</b> health.";case"energy":return"Fills "+a+"'s ultimate bar by <b>"+Math.round(D.ENERGY_GRANT*s)+"</b> points.";case"buff":return"Raises "+a+"'s ATK by <b>"+H(ye(t.power)*s)+"</b> for "+D.BUFF_ROUNDS+" rounds.";case"debuff":return"Drops "+a+"'s DEF by <b>"+H(ye(t.power)*s)+"</b> for "+D.BUFF_ROUNDS+" rounds.";default:return""}}function _s(t){return!t||!["damage","drain","execute"].includes(t.effect)?"":((fa(t)?D.ULT_AOE:D.ULT_SINGLE)*ce(t.power)/D.ATK_K).toFixed(1)+"&times; a normal hit"}var Ko={battle_start:"As the fight opens",self:"As the fight opens",aura:"For the whole fight",on_hit:"Each time this unit is struck",on_attack:"Each time this unit swings",on_kill:"Each time this unit finishes someone",on_ally_low:"The first time an ally drops below <b>"+H(D.LOW_PCT)+" health</b> (once per battle)",on_low:"The first time this unit drops below <b>"+H(D.LOW_PCT)+" health</b> (once per battle)",resist:"For the whole fight",on_round:"On every one of this unit's turns",on_ult:"When this unit casts its Ultimate",on_death:"When this unit falls",cooldown:"Every few rounds",energy:"When the energy bar fills"};function Ss(t){if(!t||!t.trigger)return"";let e=Ko[t.trigger]||"Sometimes",a=t.target==="self"?"itself":t.effect==="debuff"?"every enemy":"the whole team",r=ce(t.power),s;t.trigger==="resist"?s="it takes <b>"+H(D.RESIST_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="buff"?s="the whole team takes <b>"+H(D.AURA_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="heal"?s="every ally regenerates <b>"+H(D.AURA_REGEN*r)+" of THIS unit's max HP</b> at the start of each of their turns":t.trigger==="aura"&&t.effect==="shield"?s="every ally gets a fresh shield worth <b>"+H(D.AURA_SHIELD*r)+" of its DEF</b> at the start of each of their turns":t.effect==="buff"?s="it raises "+a+"'s ATK by <b>"+H(ye(t.power))+"</b>":t.effect==="debuff"?s="it drops "+a+"'s DEF by <b>"+H(ye(t.power))+"</b>":t.effect==="shield"?s="it shields "+a+" for <b>"+H(D.SHIELD_SCALE*.5*r)+" of its DEF</b>":t.effect==="heal"?s="it heals "+a+" for <b>"+H(D.HEAL_SCALE*.5*r)+" of its max HP</b>":s="it strikes back";let n=t.trigger==="on_kill"?" It also gains energy.":"";return e+", "+s+"."+n}function Es(t,e){if(!t||!(Number(t.power)>0))return null;let a=ce(t.power),r=fa(t),s=r?1:D.FOCUS;if(e)return t.trigger==="resist"?{value:H(D.RESIST_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="buff"?{value:H(D.AURA_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="heal"?{value:"",stat:"Regen"}:t.trigger==="aura"&&t.effect==="shield"?{value:"",stat:"Shield each round"}:t.effect==="buff"?{value:H(ye(t.power)),stat:"ATK up"}:t.effect==="debuff"?{value:H(ye(t.power)),stat:"DEF down"}:t.effect==="shield"?{value:H(D.SHIELD_SCALE*.5*a),stat:"of DEF"}:t.effect==="heal"?{value:H(D.HEAL_SCALE*.5*a),stat:"of max HP"}:null;switch(t.effect){case"damage":case"drain":return{value:H((r?D.ULT_AOE:D.ULT_SINGLE)*a),stat:"ATK"};case"aoe_damage":return{value:H(D.ULT_AOE*a),stat:"ATK"};case"execute":return{value:H(D.ULT_SINGLE*a),stat:"ATK"};case"dot":return{value:H(D.DOT_SCALE*a),stat:"ATK per round"};case"heal":return{value:H(D.HEAL_SCALE*a*s),stat:"of max HP"};case"shield":return{value:H(D.SHIELD_SCALE*a*s),stat:"of DEF"};case"buff":return{value:H(ye(t.power)*s),stat:"ATK up"};case"debuff":return{value:H(ye(t.power)*s),stat:"DEF down"};case"energy":return{value:String(Math.round(D.ENERGY_GRANT*s)),stat:"energy"};case"revive":return{value:H(D.REVIVE_PCT),stat:"health"};default:return null}}var Pd=1/3,Xo=["crit","critDmg","recharge","effectHit","effectRes","healBonus"],qd=new Set(Xo);var As={hp:"HP",atk:"ATK",def:"DEF",spd:"SPD",crit:"Crit rate",critDmg:"Crit DMG",recharge:"Energy rech.",effectHit:"Effect hit",effectRes:"Effect RES",healBonus:"Healing"};function Ns(t){let e=Number(t);return Number.isFinite(e)?e:0}function Jo(t,e,a){return Math.max(e,Math.min(a,t))}var Ts={3:{cap:4,mainScale:.45,ticks:1},4:{cap:8,mainScale:.7,ticks:2},5:{cap:12,mainScale:1,ticks:4}};var Zo=3;var Hd=1/3;function Qo(t){return Ts[Math.max(3,Math.min(5,Math.round(Ns(t)||3)))]||Ts[3]}function va(t,e){let a=Qo(t),r=Jo(Math.round(Ns(e)),0,a.cap);return Math.min(a.ticks,Math.floor(r/Zo))}function B(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Cs(t){return t===5?"\u2605\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605\u2605"}function Is(t){return t===5?"r5":"r4"}function et(t){return String(t||"").split(",")[0].trim()}var el={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>'},tl={character:'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="150" cy="92" r="44"/><path d="M150 144c-48 0-82 32-90 78l-12 178h204l-12-178c-8-46-42-78-90-78Z"/></g><path d="M150 50c0 0 28 15 28 45s-28 45-28 45-28-15-28-45 28-45 28-45Z" fill="none" stroke="#F2603C" stroke-opacity="0.4" stroke-width="2"/></svg>'};function ee(t){return(Number(t)||0).toLocaleString("en-US")}var al='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',rl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h11a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',sl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',nl='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 16.4 8.4 11.6l4 4 3.2-3.2 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="8" r="1.6" stroke="currentColor" stroke-width="1.6"/></svg>',il='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3 21 3 21 10 9 22 3 22 3 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.5 9.5 8 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',ma='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',ba=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%), radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* The head is NOT always here. hoistHeadIntoBar MOVES it into the shell's top bar and
   calls head.remove(), so this box is normally left holding ONE child: the body. With a fixed
   auto 1fr template that child auto-places into row 1 \u2014 the AUTO one \u2014 and sizes itself to its
   own content instead of to the screen. That is what made the character sheet's portrait plate a
   different height on every tab (Bond 231px, Profile ~700px: measured on screen) and what left
   the dead band under Summon. No harness could reproduce it either, because a harness renders
   the screen standalone and never hoists.
   :has() gives the second row only while the head is actually present. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }

/* \u2500\u2500 Roster grid \u2500\u2500 */
.roster-body { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.toolbar { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.cats { display: flex; gap: calc(var(--f) * 0.4); }
.cats button { cursor: pointer; background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); }
.cats button svg { width: calc(var(--f) * 1.4); height: calc(var(--f) * 1.4); }
.cats button[aria-pressed="true"] { background: var(--steel-dark); border-color: var(--steel); color: var(--text); }
.filters { display: flex; align-items: center; gap: calc(var(--f) * 0.4); margin-left: auto; }
/* \u2500\u2500 THE UNITS SEARCH BOX \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   In the TOOLBAR, between the categories and the rarity rail \u2014 a row of its own would cost grid
   height, which is the scarce axis on a stage that does not scroll.
   min-width: 0 on the input is what holds this: without it a flex item will not shrink below
   its intrinsic size and the rarity rail drops to a second row, which no overflow check sees \u2014
   the GRID quietly pays. */
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
/* The browser's own clear cross is removed: there is a dedicated button, and two ways to clear
   the same thing is one too many. */
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

/* flex: 1, or this sizes to its content and the grid stops short of the stage \u2014 the same
   failure as an implicit auto grid row, in a flex column. */
.grid-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
/* FOUR columns, and the art slot carries the portrait's OWN 2:3 ratio.
   Measured against the old 6-column square slot: the square kept 68% of a generated portrait
   (it ate the top and bottom) and one row of it reached only ~45% down the stage. 2:3 keeps 97%.
   The column count is what fills the height, NOT the ratio: at 5 columns the same 2:3 art
   still stopped at 69%, and letting the row take the height instead collapsed the slot to a
   192x21 letterbox. Fewer, wider cards is the only way to have both. */
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: calc(var(--f) * 0.8); align-content: start; }
.grid-empty { grid-column: 1 / -1; padding: var(--sp-4); text-align: center; font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }

.u { position: relative; min-width: 0; cursor: pointer; background: var(--surface); color: var(--on-surface); --cut: 0.5em; clip-path: var(--clip-card); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; border-top: 3px solid var(--steel-faint); transition: transform 130ms ease; text-align: left; padding: 0; font: inherit; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.u:hover { transform: translateY(calc(var(--f) * -0.3)); }
.u-art { position: relative; aspect-ratio: 2 / 3; background: linear-gradient(160deg, #26364E 0%, #141D2B 100%); display: grid; place-items: end center; overflow: hidden; color: rgba(199, 211, 226, 0.5); }
.u-art svg { width: 74%; height: 96%; }
.u-art.wpn svg { width: 52%; height: 72%; align-self: center; }
.u-stars { position: absolute; top: calc(var(--f) * 0.3); left: calc(var(--f) * 0.4); font-size: var(--t-sm); letter-spacing: 0.5px; line-height: 1; z-index: 1; }
/* Generated unit art. Cropped rather than fitted: an image model returns whatever aspect it
   likes, and a letterboxed portrait in a card reads as a bug. Sits under the slot's badges. */
.u-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
/* z-index ONLY. Every one of these badges is already absolutely positioned by its own rule, so
   forcing position:relative here would drop them out of their corners \u2014 an absolutely positioned
   element takes a z-index without any help. */
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip, .u-art > .tag-new, .u-art > .kind-tag, .u-art > .pill-up { z-index: 1; }
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip { text-shadow: 0 1px 3px rgba(0,0,0,0.7); }
/* .cp-portrait was built to hold a SILHOUETTE: a floating column, inset from the right, sized by
   the svg's own ratio. A real portrait has to fill the plate instead, or it sits in the middle of
   the panel with dead background around it. :has() flips the box only when there is art, so the
   silhouette keeps the layout it was designed for. */
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

/* \u2500\u2500 Character page \u2500\u2500 */
/* minmax(0, 1fr), not the implicit auto row. Auto sizes to the TALLEST cell, so a long tab
   (Bond, Growth) stretched the row, the portrait plate stretched with it, and the same image
   was cropped differently depending on which tab you were on. Pinning the row also lets
   .cp-panel's own overflow do its job instead of pushing the layout around. */
.cp-body { min-height: 0; display: grid; grid-template-columns: 0.82fr 1.18fr; grid-template-rows: minmax(0, 1fr); gap: var(--sp-3); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.cp-id { position: relative; min-height: 0; overflow: hidden; background: radial-gradient(120% 90% at 60% 0%, #33507A 0%, #16233a 58%, #0E1725 100%); border: 1px solid var(--ink-3); --cut: 0.9em; clip-path: var(--clip-card); border-radius: var(--radius); display: flex; flex-direction: column; justify-content: flex-end; backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel); }
.cp-portrait { position: absolute; right: -6%; bottom: 0; height: 92%; opacity: 0.92; color: color-mix(in srgb, var(--amber) 55%, transparent); }
.cp-id.wpn .cp-portrait { color: color-mix(in srgb, var(--epic) 55%, transparent); }
.cp-portrait svg { height: 100%; }
.cp-id-top { position: absolute; top: var(--sp-2); left: var(--sp-2); right: var(--sp-2); display: flex; align-items: center; gap: var(--sp-2); z-index: 2; }
/* The way into the portrait studio. It sits in the row that already exists for plate controls,
   on the free side (the heart is pushed right by margin-left: auto), and it is LABELLED: an icon
   alone on top of a picture is a guess, and this one leads to a screen that spends an image
   generation. Characters only, and never the protagonist \u2014 his face comes from the Engine's
   persona, not from anything this package can repaint. */
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
/* What the EQUIPMENT contributes, marked apart from the unit's own stat: the player must see
   at a glance which part of the number leaves if they unequip. */
.stat .v em { font-style: normal; font-size: var(--t-xs); color: var(--jade); }
.stats.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--sp-3); }
/* No bar: a percentage does not live on the primaries' 1..100 band, and a bar would invite
   comparing it against them. The unit's own values are marked; the rest are the default. */
.stat.sec2 { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.stat.sec2 .v { color: var(--steel-faint); }
.stat.sec2.own .v { color: var(--amber); font-weight: 700; }

.skill { display: flex; gap: var(--sp-2); align-items: flex-start; }
.skill .ic { flex: none; width: calc(var(--f) * 3); height: calc(var(--f) * 3); display: grid; place-items: center; border: 1px solid var(--steel-dark); color: var(--coral); }
.skill .ic svg { width: calc(var(--f) * 1.7); height: calc(var(--f) * 1.7); }
.skill .sn { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.skill .tag { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel-faint); }
/* The derived line: what the ability ACTUALLY does, built from the fields the sim reads. It leads
   the card and the model's prose follows as flavour, which is the reverse of how it shipped. */
.derived { margin: calc(var(--f) * 0.5) 0 calc(var(--f) * 0.4); padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7); background: color-mix(in srgb, var(--jade) 12%, var(--ink-2)); border-left: 2px solid var(--jade); font-family: var(--display); font-size: var(--t-sm); line-height: 1.45; color: var(--text); }
.derived b { color: var(--jade); font-weight: 700; }
.derived .vs { display: inline-block; margin-left: calc(var(--f) * 0.4); font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); color: var(--amber); }
.derived .rider { display: block; margin-top: calc(var(--f) * 0.25); font-size: var(--t-xs); color: var(--steel-faint); }
.skill p.flavour { color: var(--steel-faint); }

/* Machine-readable mechanics chips (effect / power / target / affinity / trigger). */
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
   Built to sit UNDER the levelling plate in the same tab, so it borrows that plate's frame and
   changes only its accent: amber (the ascension colour, matching the pips) instead of coral. */
.asc-plate { background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 3px solid var(--amber); padding: calc(var(--f) * 0.8) var(--sp-3); margin-bottom: calc(var(--f) * 0.6); }
.asc-head { display: flex; align-items: center; gap: var(--sp-2); }
.asc-head .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); color: var(--steel-faint); }
.asc-head .asc-cap { margin-left: auto; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.06em; text-transform: var(--case); color: var(--text); font-variant-numeric: tabular-nums; }
/* auto-fit, not a fixed column count: the bill is two materials plus Funds today and the catalogue
   may price a step with more. A fixed grid would leave a hole or overflow the moment it does. */
.asc-cost { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(var(--f) * 9), 1fr)); gap: calc(var(--f) * 0.4); margin: calc(var(--f) * 0.7) 0 calc(var(--f) * 0.6); }
.asc-item { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.5); background: var(--ink-3); border: 1px solid transparent; padding: calc(var(--f) * 0.35) calc(var(--f) * 0.6); }
/* min-width: 0 on the flex child too, or a long material name grows the grid column instead of
   ellipsing -- the same min-content trap that overflowed the lorebook picker sideways. */
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
   Borrows the asc-plate frame on purpose: the two sit on the same tab and answer the same question
   ("how do I make this unit stronger"), so a second frame would read as a second, unrelated system.
   What changes is the accent, jade instead of amber, because it spends a different material.
   ZERO BACKTICKS in this comment -- the sheet lives in a JS template literal and a pair of them
   closes and reopens it, spilling the text between as code. I wrote this very warning WITH
   backticks in it and the module stopped parsing: "plate is not defined". Fourth time in this
   project. */
.fm-plate { border-left-color: var(--jade); }
/* One rail per skill, split by a thin line and not by three plates: all three answer the same
   question about the same unit, and three frames would read as three systems. The air between
   rails is tightened so the sheet panel fits with all three alive. */
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
   Built for FIVE pieces from day one, not for the weapon alone. The weapon is one slot; the four
   relic slots ship LOCKED and light up by flipping a flag, the same way a mode goes live in
   modes.js. A layout designed around a single slot is a layout thrown away the week the relics
   land \u2014 which is exactly what happened to the first version of this tab.
   And it is SLOTS, not a list: you click a slot and the picker opens on it. NO BACKTICKS in this
   comment \u2014 the CSS is a JS template literal and one closes it mid-sentence. */
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
   All SIX rungs are drawn from the first day, the unbought ones dimmed and still SAYING what
   they do. A ladder that only showed what you own would hide the reason to pull again, which is
   the whole point of the screen. Same call as the four relic slots in the rack above.
   The list scrolls INSIDE its own box: six rungs with a long sentence each will not fit the
   panel at every scale, and the screen itself must never scroll.
   NO BACKTICKS in this comment: the sheet lives in a template literal. */
.fct-head { flex: none; display: flex; align-items: baseline; gap: var(--sp-2); border-bottom: 1px solid var(--ink-3); padding-bottom: calc(var(--f) * 0.4); }
.fct-head .lab { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--coral); }
.fct-head .cnt { margin-left: auto; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.06em; color: var(--amber); font-variant-numeric: tabular-nums; }
.fct-head .cnt small { font-size: var(--t-xs); color: var(--steel-faint); }
.fct-list { flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: calc(var(--f) * 0.3); padding: calc(var(--f) * 0.5) 0; }
.fct-row { display: grid; grid-template-columns: auto 1fr; gap: calc(var(--f) * 0.1) var(--sp-2); align-items: baseline; background: var(--ink-2); border: 1px solid var(--ink-3); border-left: 3px solid var(--steel-dark); padding: calc(var(--f) * 0.45) calc(var(--f) * 0.7); }
.fct-row.on { border-left-color: var(--amber); }
/* --steel-faint here, and NOT the darker steel. Measured on the mock, the locked rung's number
   came out at 1.4:1 against its row, which is not "dim", it is ABSENT \u2014 and then the sentence
   beside it belongs to no rung the player can name. The lock reads from the colour (grey against
   amber), never from making the figure unreadable. Same lesson as the VN caption that shipped
   painted with a surface token and scored 1.6:1 in three of the five styles.
   And no token name may be followed by a colon in this comment: the probe that forbids a screen
   from re-declaring a theme token reads that as a declaration, and it is right to. */
.fct-row .no { grid-row: 1 / 3; align-self: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.fct-row.on .no { color: var(--amber); }
.fct-row .nm { min-width: 0; font-family: var(--display); font-weight: 700; font-size: var(--t-sm); color: var(--steel-faint); }
.fct-row.on .nm { color: var(--text); }
/* --t-sm, NOT --t-xs. This is the line the player reads to decide whether another five-star is
   worth pulling, and --t-xs is the LABEL token: measured at 1440x960 it rendered at 8.7px,
   unreadable. A paragraph does not get to wear a label's size. */
.fct-row .ln { grid-column: 2; font-size: var(--t-sm); line-height: 1.4; color: var(--steel-faint); }
.fct-row.on .ln { color: var(--text); }
.fct-row .ln b { color: var(--jade); font-weight: 700; font-variant-numeric: tabular-nums; }
.fct-why { flex: none; font-size: var(--t-sm); line-height: 1.4; color: var(--steel-faint); border-top: 1px solid var(--ink-3); padding-top: calc(var(--f) * 0.35); }
.fct-why b { color: var(--text); font-weight: 700; }

/* \u2500\u2500 The picker: the second view of the same screen, opened by clicking a slot \u2500\u2500 */
.gr-pick { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; gap: calc(var(--f) * 0.5); }
.gr-pick-head { flex: none; display: flex; align-items: baseline; gap: var(--sp-2); }
.gr-pick-head .ttl { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.gr-pick-head .sub { min-width: 0; font-size: var(--t-xs); color: var(--steel-faint); }
.gr-back { flex: none; cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.3) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.gr-back:hover { border-color: var(--coral); color: var(--coral); }
/* CARDS, not rows: what the user asked for over the list, and also what makes the silhouette
   readable \u2014 at row height a weapon glyph is a smudge. Contained scroll, which the rule allows. */
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
/* The feed bar: every figure with its label. A count that does not say what level it buys asks
   the player to redo the arithmetic the server already did. */
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
   Compact on purpose: ascension, skill levels and the rest of progression share this panel, so the
   levelling block is four rows and no more. */
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
`;function ol(t,e){let a=typeof t=="string"?t.trim():"";return a?'<img class="u-photo" src="'+B(a)+'" alt="" loading="lazy">':e}function ll(t){let e=t.kind!=="weapon",a=e?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+et(t.dedicatedTo):"");return'<button class="'+("u "+Is(t.rarity)+(t.isProtagonist?" you":""))+'" type="button" data-unit="'+B(t.id)+'"><div class="u-art'+(e?"":" wpn")+'">'+ol(t.portrait,"")+'<span class="u-stars">'+Cs(t.rarity)+"</span>"+(t.portrait?"":e?el.character:Re(t.weaponType,"gf-sil"))+'<span class="u-lvl">Lv '+(Number(t.level)||1)+"</span>"+(e?'<span class="bond-pip">&#9829;'+(Number(t.bond)||0)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+B(t.name)+'</div><div class="u-role">'+B(a)+"</div></div></button>"}var cl='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>',dl='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';function hl(t,e){let a=String(e||"").trim().toLowerCase();return!a||String(t.name||"").toLowerCase().includes(a)?!0:(t.kind==="weapon"?[t.weaponType]:[t.role,t.affinity]).some(s=>String(s||"").toLowerCase()===a)}function Ot(t,e,a,r){let s=e!=="wpn";return(t||[]).filter(n=>n.kind!=="weapon"===s).filter(n=>a==="all"||String(n.rarity)===a).filter(n=>hl(n,r))}function Rs(t,e,a){return a==="loading"?'<div class="grid-empty">Loading units&hellip;</div>':a==="error"?'<div class="grid-empty">Couldn&rsquo;t load your units.</div>':t.length?t.map(ll).join(""):'<div class="grid-empty">No '+(e?"characters":"weapons")+" here yet.</div>"}function pl(t,e,a){let r=!!String(t||"").trim();return'<div class="u-search'+(r?" on":"")+'"><span class="ic">'+cl+'</span><input type="search" data-unit-search placeholder="Search by name, role or affinity" value="'+B(t||"")+'">'+(r?'<button class="clr" type="button" data-unit-search-clear aria-label="Clear search">'+dl+"</button>":"")+'<span class="ct" data-unit-search-count>'+(r?e+" / "+a:a)+"</span></div>"}function Ls(t,{cards:e=[],cat:a="char",rarity:r="all",q:s="",state:n="ready"}={}){if(!t||typeof t.querySelector!="function")return!1;let i=t.querySelector("[data-grid]");if(!i)return!1;let l=a!=="wpn",h=Ot(e,a,r,s);i.innerHTML=Rs(h,l,n);let p=t.querySelector(".u-search");p&&typeof p.setAttribute=="function"&&(String(s||"").trim()?p.setAttribute("data-on","1"):p.removeAttribute("data-on"));let d=t.querySelector("[data-unit-search-count]");if(d){let o=Ot(e,a,r,"").length;d.textContent=String(s||"").trim()?h.length+" / "+o:String(o)}return!0}function Ms({cards:t=[],cat:e="char",rarity:a="all",state:r="ready",q:s=""}={}){let n=e!=="wpn",i=Ot(t,e,a,s),l=Ot(t,e,a,"").length,h=d=>d?' aria-pressed="true"':' aria-pressed="false"',p=Rs(i,n,r);return`
<div class="root">
  ${ma}
  <div class="stage"></div>
  <section class="screen" data-screen="roster">
    <div class="head">
      <button class="back" type="button" data-roster-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Command</div><h2>Units</h2></div>
    </div>
    <div class="roster-body gf-swap">
      <div class="toolbar">
        <div class="cats">
          <button type="button" data-cat="char"${h(n)}>${sl}Characters</button>
          <button type="button" data-cat="wpn"${h(!n)}>${il}Weapons</button>
        </div>
        ${pl(s,i.length,l)}
        <div class="filters">
          <span class="lbl">Rarity</span>
          ${Et.map(d=>`<button class="chip${d.tone?" "+d.tone:""}" type="button" data-rar="${d.id}"${h(a===d.id)}>${d.label}</button>`).join("")}
        </div>
      </div>
      <div class="grid-scroll"><div class="grid" data-grid>${p}</div></div>
    </div>
  </section>
</div>`}function Qe(t,e,a,r){let s=Math.min(100,Math.max(0,Number(e)||0)),n=a===void 0?Number(e)||0:Number(a)||0,i=Number(r)>0?" <em>+"+ee(Math.round(Number(r)))+"</em>":"";return'<div class="stat"><span class="k">'+t+'</span><div class="bar"><i style="width:'+s+'%"></i></div><span class="v">'+ee(n)+i+"</span></div>"}var fl=[["crit","Crit rate",15,"%"],["critDmg","Crit DMG",150,"%"],["recharge","Energy rech.",100,"%"],["effectHit","Effect hit",0,"%"],["effectRes","Effect RES",0,"%"],["healBonus","Healing",0,"%"]];function ul(t,e){let a=e||{};return fl.map(([r,s,n,i])=>{let l=Number(t[r]),h=Number.isFinite(l),p=h?l:n,d=Number(a[r])||0;return'<div class="stat sec2'+(h?" own":"")+'"><span class="k">'+s+'</span><span class="v">'+Math.round((p+d)*10)/10+i+(d>0?" <em>+"+Math.round(d*10)/10+i+"</em>":"")+"</span></div>"}).join("")}var vl={damage:"Damage",aoe_damage:"AoE damage",heal:"Heal",shield:"Shield",buff:"Buff",debuff:"Debuff"},gl={enemy:"Enemy",all_enemies:"All enemies",ally:"Ally",allies:"Allies",self:"Self",front_row:"Front row",back_row:"Back row"},ml={front:"Front-line role",back:"Back-line role"};function Ft(t){return String(t||"").replace(/_/g," ").replace(/^\w/,e=>e.toUpperCase())}function bl(t,e,a,r){let s=[];a&&t.trigger&&s.push('<span class="m trig">'+B(Ft(t.trigger))+"</span>"),t.effect&&s.push('<span class="m">'+B(vl[t.effect]||Ft(t.effect))+"</span>");let n=Es(t,!!r);return n&&s.push('<span class="m">'+(n.value?n.value+" ":"")+"<b>"+n.stat+"</b></span>"),t.target&&s.push('<span class="m">'+B(gl[t.target]||Ft(t.target))+"</span>"),e&&s.push('<span class="m aff">'+B(e)+"</span>"),s.length?'<div class="mech">'+s.join("")+"</div>":""}function zt(t,e,a,r,s){if(!e||!e.name)return"";let n=s?Ss(e):ua(e),i=s?"":_s(e),l=s?"":ks(a),h=n?'<div class="derived">'+n+(i?' <span class="vs">'+i+"</span>":"")+(l?'<span class="rider">'+l+"</span>":"")+"</div>":"";return'<div class="sec"><div class="h">'+t+'</div><div class="skill"><span class="ic">'+al+'</span><div><div class="sn">'+B(e.name)+"</div>"+bl(e,a,r,s)+h+'<p class="flavour">'+B(e.description)+"</p></div></div></div>"}function yl(t,e,a){let r=t.kind!=="weapon",s="";if(r&&(s+='<div class="sec"><div class="h">Combat</div><div class="mech">',t.role&&(s+='<span class="m">'+B(t.role)+"</span>"),t.affinity&&(s+='<span class="m aff">'+B(t.affinity)+"</span>"),t.position&&(s+='<span class="m">'+B(ml[t.position]||Ft(t.position))+"</span>"),s+="</div></div>"),s+='<div class="sec"><div class="h">Stats</div><div class="stats">',r){let n=t.stats||{},l=1+((Number(e)>0?Number(e):1)-1)*.06,h=a||{},p=(v,w)=>(Number(v)||0)*(1+(Number(w)||0)),d=Math.round(20+p(n.hp,h.hpPct)*6*l),o=Math.round(p(n.atk,h.atkPct)*l),u=Math.round(p(n.def,h.defPct)*l),f=Math.round(p(n.spd,h.spdPct));s+=Qe("HP",n.hp,d,d-Math.round(20+(Number(n.hp)||0)*6*l)),s+=Qe("ATK",n.atk,o,o-Math.round((Number(n.atk)||0)*l)),s+=Qe("DEF",n.def,u,u-Math.round((Number(n.def)||0)*l)),s+=Qe("SPD",n.spd,f,f-(Number(n.spd)||0)),s+="</div></div>",s+='<div class="sec"><div class="h">Combat stats</div><div class="stats two">'+ul(n,h)}else{let n=t.mainStat||{},i=t.subStat||{};s+=Qe("ATK",n.value)+Qe(String(i.key||"SUB").toUpperCase(),i.value)}if(s+="</div></div>",r?(s+=zt("Skill",t.skill,t.affinity,!1,!1),s+=zt("Passive",t.passive,t.affinity,!0,!0),s+='<div class="sec"><div class="h">Profile</div>',t.description&&(s+="<p>"+B(t.description)+"</p>"),t.personality&&(s+="<p>"+B(t.personality)+"</p>"),s+="</div>"):(s+=zt("Granted skill",t.grantedSkill,null,!0,!1),s+=zt("Passive",t.passive,null,!0,!0),s+='<div class="sec"><div class="h">About</div><p>'+B(t.description)+"</p></div>"),!t.isProtagonist){let n=t.origin||{},i=n.banner==="standard"?"Standard Banner":n.banner||"Standard Banner";s+='<div class="sec"><div class="h">Origin</div><div class="origin"><span>From <b>'+B(i)+"</b></span>"+(r?'<span class="story-chip">'+rl+"In the story cast pool</span>":"")+"</div></div>"}return s}function ga(t,e,a,r){let s=n=>(Math.round(Number(n)*10)/10).toLocaleString("en-US");return'<span class="k">'+B(t)+'</span><span class="v">+'+s(e)+r+'</span><span class="m">'+(a>e?"&rarr; +"+s(a)+r+" at cap":"at cap")+"</span>"}var Ae=t=>Math.round(Number(t)*1e3)/10;function wl(t,e){let a=t.item||null,r=!!t.locked,s="gr-slot"+(a?"":" empty"),n=a?a.main?_e[t.key]||_e.core:Re(a.weaponType,"gf-gsil"):r?_e[t.key]||_e.core:'<span class="plus">+</span>',i=a?a.main?"Lv "+(Number(a.level)||0)+" &middot; <b>"+ue(a.main.key,a.main.value)+"</b>":"Lv "+(Number(a.level)||1)+" &middot; <b>+"+Ae(a.atkPct)+"%</b>":r?"Soon":"Empty";return'<button class="'+s+'" type="button"'+(r?" disabled":' data-gear-slot="'+B(t.key)+'" aria-pressed="'+(e===t.key?"true":"false")+'"')+'><span class="lab">'+B(t.label)+'</span><span class="art">'+n+"</span>"+(a?'<span class="rr">'+(Number(a.rarity)||4)+"&#9733;</span>":"")+'<span class="foot">'+i+"</span></button>"}function xl(t){let e=ga("ATK",Ae(t.atkPct),Ae(t.atkPctMax),"%")+(t.sub?t.sub.points!==void 0?ga(t.sub.label,t.sub.points,t.sub.pointsMax,"%"):ga(t.sub.label,Ae(t.sub.pct),Ae(t.sub.pctMax),"%"):""),a=t.grantedSkill?'<div class="gr-ab"><div class="t"><span class="lab">2nd skill</span><span class="nm">'+B(t.grantedSkill.name)+'</span><span class="gr-tag'+(t.grantedActive?"":" off")+'">'+(t.grantedActive?"Active":"Inactive")+"</span></div>"+(t.grantedActive?'<div class="gr-line">'+ua(t.grantedSkill)+"</div>":'<div class="gr-why">Only '+B(t.dedicatedTo||"its owner")+" draws this skill from it. Here it is stats only.</div>")+"</div>":"";return'<div class="gr-name">'+B(t.name)+'</div><div class="gr-meta"><span class="st">'+"&#9733;".repeat(Math.max(1,Number(t.rarity)||4))+"</span> "+B(t.weaponType||"")+" &middot; Lv "+(Number(t.level)||1)+" / "+(Number(t.levelCap)||90)+'</div><div class="gr-stats">'+e+"</div>"+a}function kl(t){let e=(t.subs||[]).map(a=>'<span class="k">'+B(a.label)+'</span><span class="v">'+ue(a.key,a.value)+'</span><span class="m">'+(Number(a.rolls)>1?"&times;"+a.rolls:"")+"</span>").join("");return'<div class="gr-name">'+(Number(t.rarity)||3)+"&#9733; "+B(Pt(t.slot))+'</div><div class="gr-meta"><span class="st">'+"&#9733;".repeat(Math.max(1,Number(t.rarity)||3))+"</span> Lv "+(Number(t.level)||0)+" / "+(Number(t.levelCap)||0)+'</div><div class="gr-stats"><span class="k">'+B(t.main.label)+'</span><span class="v">'+ue(t.main.key,t.main.value)+'</span><span class="m">'+(t.main.valueMax>t.main.value?"&rarr; "+ue(t.main.key,t.main.valueMax)+" at cap":"at cap")+'</span></div><div class="gr-ab"><div class="t"><span class="lab">Sub-stats</span></div><div class="gr-stats">'+e+"</div></div>"}function Pt(t){let e=String(t||"");return e.charAt(0).toUpperCase()+e.slice(1)}function _l(t,e,a,r,s,n,i){let l=Array.isArray(e)?e:[],h=a||[],p=Number(t.levelCap)||0,d=Number(t.level)||0,o=Math.min(p,d+h.length),u=Number(t.feedCost)||Number(s)||0,f=h.length*u,v=f>r,w=Number(n)||3,g=Math.floor(d/w),x=Math.floor(o/w),S=l.filter(R=>R.id!==t.id&&!R.equipped&&!R.locked),A=Math.max(0,p-d),z=S.length?S.map(R=>{let q=h.includes(R.id),L=!q&&h.length>=A;return'<button class="gr-card sm'+(q?" on":"")+'" type="button"'+(L?" disabled":"")+' data-rfeed-pick="'+B(R.id)+'"><span class="art">'+(_e[R.slot]||_e.core)+'</span><span class="rr">'+(Number(R.rarity)||3)+'&#9733;</span><span class="nm">'+Pt(R.slot)+" &middot; Lv "+(Number(R.level)||0)+'</span><span class="gv">'+B(R.main.label)+" "+ue(R.main.key,R.main.value)+"</span></button>"}).join(""):'<div class="gr-none">Nothing spare to feed. Everything you hold is either equipped or locked &mdash; run the <b>Relic Vault</b> in Materials for more.</div>',U=i&&i.length?'<div class="gr-grew">Reinforced: '+i.map(R=>"<b>"+B(R.label)+" "+ue(R.key,R.by)+"</b>").join(", ")+"</div>":"";return'<div class="gr-pick"><div class="gr-pick-head"><button class="gr-back" type="button" data-rfeed-back>&#9664; Back</button><span class="ttl">Upgrade '+B(Pt(t.slot))+'</span><span class="sub">Lv '+d+" / "+p+'</span></div><div class="gr-feedbar"><span class="fig">Feeding<b>'+h.length+"</b>"+(h.length===1?" piece":" pieces")+'</span><span class="fig">Level<b>'+d+" &rarr; "+o+'</b></span><span class="fig">Reinforcements<b>+'+(x-g)+"</b>"+(x===g&&h.length?(g+1)*w<=p?" (next at Lv "+(g+1)*w+")":" (at cap)":"")+'</span><span class="fig'+(v?" short":"")+'">Funds<b>'+ee(f)+"</b>of "+ee(r)+" <i>("+ee(u)+" per level)</i></span></div>"+U+'<div class="gr-grid sm">'+z+'</div><div class="gr-act"><button type="button" data-rfeed-go'+(!h.length||v||o===d?" disabled":"")+">Feed</button>"+(h.length?'<button class="ghost" type="button" data-rfeed-clear>Clear</button>':"")+"</div></div>"}function Sl(t,e,a){let r=t.kind==="relic",s=e.length?e.map(n=>{let i=n.equipped?"Equipped":n.heldByName?"On "+n.heldByName:n.wornElsewhere?"In use":"Free",l=r?B(n.main.label)+" "+ue(n.main.key,n.main.value):"+"+Ae(n.atkPct)+"% ATK"+(n.grantsHere?" &middot; 2nd skill":""),h=r?_e[n.slot]||_e.core:Re(n.weaponType,"gf-gsil"),p=r?Pt(n.slot)+" &middot; Lv "+(Number(n.level)||0):B(n.name);return'<button class="gr-card'+(n.equipped?" on":"")+'" type="button" data-equip="'+B(n.id)+'"><span class="art">'+h+'</span><span class="rr">'+(Number(n.rarity)||4)+"&#9733;</span>"+(n.locked?'<span class="lk">&#128274;</span>':"")+'<span class="nm">'+p+'</span><span class="gv">'+l+'</span><span class="who">'+B(i)+"</span></button>"}).join(""):'<div class="gr-none">'+(r?"No "+B(t.label)+" relics yet &mdash; they drop from the <b>Relic Vault</b> stage in Materials.":"You hold no "+B(t.accepts||"piece")+" for this slot yet &mdash; they come from the weapon banner in Summon.")+"</div>";return'<div class="gr-pick"><div class="gr-pick-head"><button class="gr-back" type="button" data-gear-back>&#9664; Slots</button><span class="ttl">'+B(t.label)+'</span><span class="sub">'+B(a.role||"This unit")+" holds a <b>"+B(t.accepts||"piece")+'</b></span></div><div class="gr-grid">'+s+"</div>"+(t.item?'<div class="gr-act">'+(r?'<button type="button" data-rfeed-open>Upgrade</button>':'<button type="button" data-wlevel="'+B(t.item.id)+'">Upgrade</button>')+'<button class="ghost" type="button" data-equip="">Remove</button></div>':"")+"</div>"}function El(t,e,a,r){let s=e||null;if(!s)return'<div class="gr-root"><div class="gr-none">This unit has no equipment slots.</div></div>';let n=Array.isArray(s.slots)?s.slots:[],i=Array.isArray(s.options)?s.options:[],l=a?n.find(g=>g.key===a&&!g.locked):null;if(l&&r&&r.open&&l.item)return'<div class="gr-root">'+_l(l.item,r.inventory||[],r.picked||[],Number(r.funds)||0,Number(r.cost)||0,Number(r.tickEvery)||3,r.gained)+"</div>";if(l)return'<div class="gr-root">'+Sl(l,l.options||i,t)+"</div>";let h='<div class="gr-rack">'+n.map(g=>wl(g,a)).join("")+"</div>",p=Number(s.cp)||0,d=Number(s.cpBare)||0,o=n.filter(g=>g.item).length,u=[];if(o>1){let g=s.totals||{};g.atkPct&&u.push('<span class="fig">ATK<b>+'+Ae(g.atkPct)+"%</b></span>"),g.hpPct&&u.push('<span class="fig">HP<b>+'+Ae(g.hpPct)+"%</b></span>"),g.defPct&&u.push('<span class="fig">DEF<b>+'+Ae(g.defPct)+"%</b></span>"),g.spdPct&&u.push('<span class="fig">SPD<b>+'+Ae(g.spdPct)+"%</b></span>");for(let x of["crit","critDmg","recharge","effectHit","effectRes","healBonus"])g[x]&&u.push('<span class="fig">'+B(As[x]||x)+"<b>+"+Math.round(g[x]*10)/10+"%</b></span>")}else o?u.push('<span class="fig">1 of '+n.length+" slots filled</span>"):u.push('<span class="fig">Nothing equipped yet</span>');let f='<div class="gr-sum">'+u.join("")+'<span class="pw">Power<b>'+ee(p)+"</b>"+(p>d?" <em>+"+ee(p-d)+"</em>":"")+"</span></div>",v=n.find(g=>g.item),w=v?'<div class="gr-detail">'+(v.item.main?kl(v.item):xl(v.item))+"</div>":'<div class="gr-detail"><div class="gr-why">Nothing equipped. Click a slot to choose a piece for it. The four relic slots open when relics ship &mdash; they are drawn here so the rack never changes shape under you.</div></div>';return'<div class="gr-root">'+h+f+w+"</div>"}function Tl(t,e){let a=e||{},r=Array.isArray(a.rungs)?a.rungs:[],s=Math.max(0,Number(a.owned)||0),n=Number(a.max)||r.length,i=et(t.name)||"this unit",l=r.map(p=>'<div class="fct-row'+(!!p.owned?" on":"")+'"><span class="no">'+B(String(p.n))+'</span><span class="nm">'+B(p.name||"")+'</span><span class="ln">'+B(p.line||"")+"</span></div>").join(""),h=s>=n?"<b>Every facet is unlocked.</b> Another copy of "+B(i)+" adds nothing \u2014 this ladder is the only thing copies feed.":"Pull "+B(i)+" again to raise the next one.";return'<div class="gr-root"><div class="fct-head"><span class="lab">Facets</span><span class="cnt">'+s+"<small> / "+n+'</small></span></div><div class="fct-list">'+l+'</div><div class="fct-why">'+h+"</div></div>"}function Al(t,e){let a=Number(e)||0,r=et(t.name)||"this unit";return'<div class="bond-meter"><div class="top"><span class="lv">&#9829; Bond '+a+'</span><span class="xp">'+(a>0?"in progress":"not started")+'</span></div><div class="track"><i style="width:'+(a>0?12:0)+'%"></i></div><div class="note">Affinity grows by bringing '+B(r)+' into story beats and battles. Each bond level will unlock a character event.</div></div><div class="sec"><div class="h">Character events</div><p>Character events unlock as bond grows &mdash; the relationship system is coming.</p></div>'}function Bs(t,e){return zs(t,e)}function zs(t,e){let a=e||{},r=Number(a.level)||1,s=Number(a.levelCap)||r,n=r>=s,i=Math.max(0,Number(a.xp)||0),l=Number(a.xpNeeded)||0,h=Array.isArray(a.tiers)?a.tiers:[],p=a.wallet&&a.wallet.insight||{},d=Number(a.wallet&&a.wallet.funds)||0,o=Number(a.cp)||0,u=a.preview||null,f=u&&Number.isFinite(u.xpAfter)?u.xpAfter:i,v=u&&Number.isFinite(u.needAfter)?u.needAfter:l,w=u&&Number.isFinite(u.solid)?u.solid:i,g=v>0?Math.min(100,Math.round(w/v*100)):100,x=u&&v>0?Math.min(100-g,Math.round((f-w)/v*100)):0,S={account:"Capped by your Account Rank &mdash; a unit cannot pass twice your rank.",ascension:"Capped until the next ascension.",max:"Fully levelled."}[a.levelCapReason||"max"],A='<div class="gw-plate"><div class="gw-top"><span class="gw-lv">Lv <b data-gw-lv>'+r+"</b>"+(u&&u.levelTo>r?"<em data-gw-lv-to>&rarr; "+u.levelTo+"</em>":"<i>/ "+s+"</i>")+'</span><span class="gw-cp">CP <b>'+ee(o)+"</b>"+(u&&u.cpTo>o?"<em>&rarr; "+ee(u.cpTo)+"</em>":"")+'</span></div><div class="gw-track'+(n?" full":"")+'"><i data-gw-bar style="width:'+g+'%"></i><u data-gw-ghost style="width:'+x+'%"></u></div><div class="gw-figs">'+(n?'<span class="gw-capped">'+S+"</span>":"<span><b data-gw-xp>"+ee(f)+"</b> / "+ee(v)+' XP</span><span class="gw-cost'+(u&&u.short?" short":"")+'" data-gw-cost>'+(u?ee(u.funds)+" Funds"+(u.short?" &mdash; short, the XP still banks":""):ee(d)+" Funds")+"</span>")+"</div></div>",z=u&&Number.isFinite(u.roomLeft)?u.roomLeft:1/0,U=n?"":'<div class="gw-feed"><div class="gw-items">'+h.map(q=>{let L=Math.max(0,Number(p[q.id])||0),P=u&&u.spent?Math.max(0,Number(u.spent[q.id])||0):0,X=z>0&&P<L;return'<button class="gw-item'+(L?"":" empty")+(P?" on":"")+'" type="button"'+(X?"":" disabled")+' data-feed="'+B(q.id)+'"><span class="gw-i-name">'+B(String(q.name).replace(/^Insight /,""))+'</span><span class="gw-i-xp">+'+ee(q.xp)+'</span><span class="gw-i-held" data-feed-held="'+B(q.id)+'">'+ee(L-P)+(P?"<em>&minus;"+ee(P)+"</em>":"")+"</span></button>"}).join("")+'</div><div class="gw-acts"><button class="gw-reset" type="button" data-feed-reset'+(u?"":" disabled")+'>Reset</button><button class="gw-go" type="button" data-feed-go'+(u&&u.ready?"":" disabled")+">Level up</button></div></div>",R=Rl(a.ascension,d)+Cl(a.form,d);return A+U+R}var Nl={"no-signature":"Equip this unit's signature weapon to train its skill.","no-ability":"This unit has no such ability.","at-cap":"Ascend this unit to train it further.","needs-mandate":"Mandates come from the 7 Day Login Event &mdash; day 6, one a week.","none-held":"You hold none of these &mdash; farm them in Materials, at the Tenet Trial.","short-materials":"Not enough Tenets yet &mdash; the Tenet Trial in Materials is open every day.","short-funds":"Not enough Funds.",max:"Fully trained."};function Cl(t,e){if(!t||!Array.isArray(t.tracks))return"";let a=Math.max(1,Number(t.max)||10),s='<div class="asc-head"><span class="lab">Form</span><span class="asc-cap">Cap '+Math.max(1,Number(t.cap)||a)+"</span></div>",n=i=>{let l=Math.max(1,Number(i.level)||1),h=i.live?i.next:null,p=Nl[i.reason]||"",d='<div class="fm-id"><span class="k">'+B(i.label)+"</span>"+(i.live?'<span class="fm-lv">Lv '+l+"<small> / "+a+"</small></span>"+(i.powers?'<span class="v">'+ee(i.powers.now)+'%</span><span class="m">'+ee(i.powers.max)+"% at Lv "+a+"</span>":""):'<span class="fm-off">Locked</span>')+"</div>",o=h?'<div class="asc-cost">'+(h.items||[]).map(f=>'<div class="asc-item'+(f.short?" short":"")+'"><span class="n">'+B(f.name)+'</span><span class="c">'+ee(f.held)+" / "+ee(f.need)+"</span></div>").join("")+'<div class="asc-item'+(e<h.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+ee(e)+" / "+ee(h.funds)+"</span></div></div>":"",u='<div class="asc-foot"><span class="asc-why">'+p+"</span>"+(h?'<button class="asc-go" type="button" data-form-up="'+B(i.key)+'"'+(i.ready?"":" disabled")+">Train</button>":"")+"</div>";return'<div class="fm-track'+(i.live?"":" off")+'">'+d+o+u+"</div>"};return'<div class="asc-plate fm-plate">'+s+t.tracks.map(n).join("")+"</div>"}var Il={"none-held":"You hold none of these &mdash; farm them in Materials.","short-materials":"Not enough materials for the next ascension.","short-funds":"Not enough Funds for the next ascension.",max:"Fully ascended.",ready:""};function Rl(t,e){if(!t)return"";let a=Math.max(0,Number(t.step)||0),r=Math.max(1,Number(t.max)||6),s=t.next||null,n="";for(let o=0;o<r;o+=1)n+='<span class="'+(o<a?"on":"off")+'">&#9733;</span>';let i='<div class="asc-head"><span class="lab">Ascension</span><span class="asc">'+n+'</span><span class="asc-cap">'+(s?"Cap "+s.capFrom+" &rarr; "+s.capTo:"Cap "+(Number(t.cap)||90))+"</span></div>",l=(s?s.items:[]).map(o=>'<div class="asc-item'+(o.short?" short":"")+'"><span class="n">'+B(o.name)+'</span><span class="c">'+ee(o.held)+" / "+ee(o.need)+"</span></div>").join("")+(s?'<div class="asc-item'+(e<s.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+ee(e)+" / "+ee(s.funds)+"</span></div>":""),h=s?"Reach Lv "+(Number(t.cap)||s.capFrom)+" to ascend &mdash; this unit is Lv "+(Number(t.level)||1)+".":"",d='<div class="asc-foot"><span class="asc-why">'+[t.reason==="not-at-cap"?h:Il[t.reason]||"",t.gated===!1&&s?"The level cap stays open until then.":""].filter(Boolean).join(" ")+"</span>"+(s?'<button class="asc-go" type="button" data-ascend'+(t.ready?"":" disabled")+">Ascend</button>":"")+"</div>";return'<div class="asc-plate">'+i+(s?'<div class="asc-cost">'+l+"</div>":"")+d+"</div>"}function Fs({unit:t,level:e=1,bond:a=0,tab:r="profile",state:s="ready",growth:n=null,gear:i=null,gearSlot:l=null,gearFeed:h=null,facets:p=null}={}){if(s==="loading"||!t)return`
<div class="root">
  ${ma}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">Unit</div><h2>${s==="error"?"Unavailable":"Loading\u2026"}</h2></div>
    </div>
    <div class="cp-body"><div class="grid-empty" style="grid-column:1/-1">${s==="error"?"Couldn't load this unit.":"Loading\u2026"}</div></div>
  </section>
</div>`;let d=t.kind!=="weapon",o=d&&!!p,u=d&&!t.isProtagonist,f=d?[["profile","Profile"],["growth","Growth"],["gear","Gear"],...o?[["facets","Facets"]]:[],...u?[["bond","Bond"]]:[]]:[["profile","Profile"],["growth","Growth"]],v=r;!d&&(v==="bond"||v==="gear")&&(v="profile"),v==="bond"&&!u&&(v="profile"),v==="facets"&&!o&&(v="profile");let w=f.map(A=>'<button type="button" role="tab" data-tab="'+A[0]+'" aria-selected="'+(A[0]===v?"true":"false")+'">'+A[1]+"</button>").join(""),g=v==="bond"?Al(t,a):v==="facets"?Tl(t,p):v==="gear"?El(t,i,l,h):v==="growth"?zs(t,n):yl(t,e,i&&i.totals),x=d?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+et(t.dedicatedTo):""),S='<div class="cp-portrait">'+(t.portrait?'<img class="cp-photo" src="'+B(t.portrait)+'" alt="" loading="lazy">':d?tl.character:Re(t.weaponType,"gf-sil"))+'</div><div class="cp-id-top">'+(d&&!t.isProtagonist?'<button class="cp-art-btn" type="button" data-portrait>'+nl+"Portrait</button>":"")+'<button class="cp-fav" type="button" aria-pressed="false" data-fav><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 3.2C20 14.5 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="cp-id-plate"><div class="plate-stars '+Is(t.rarity)+'">'+Cs(t.rarity)+"</div><h3>"+B(et(t.name))+'</h3><div class="role">'+B(x)+'</div><div class="chips"><span>Lv '+(Number(e)||1)+"</span>"+(d?'<span class="bond">&#9829; Bond '+(Number(a)||0)+"</span>":"")+'</div><button class="cp-party" type="button"'+(d?" data-set-party":" disabled")+">"+(d?"Set to party":"Equip to a character")+"</button></div>";return`
<div class="root">
  ${ma}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">${d?"Character":"Weapon"}</div><h2>${B(et(t.name))}</h2></div>
    </div>
    <div class="cp-body gf-swap">
      <div class="cp-id${d?"":" wpn"}">${S}</div>
      <div class="cp-main">
        <div class="cp-tabs" role="tablist">${w}</div>
        <div class="cp-panel">${g}</div>
      </div>
    </div>
  </section>
</div>`}function Os(t,{onOpenUnit:e,onBack:a,onCat:r,onRarity:s,onSearch:n}){(t.querySelector(".root")||t).addEventListener("click",d=>{let o=d&&d.target&&d.target.closest?d.target:null,u=o&&o.closest("[data-unit]");u&&e&&e(u.getAttribute("data-unit"))});for(let d of t.querySelectorAll("[data-cat]"))d.addEventListener("click",()=>r&&r(d.dataset.cat));for(let d of t.querySelectorAll("[data-rar]"))d.addEventListener("click",()=>s&&s(d.dataset.rar));let l=t.querySelector("[data-unit-search]");l&&l.addEventListener("input",()=>n&&n(l.value||""));let h=t.querySelector("[data-unit-search-clear]");h&&h.addEventListener("click",()=>{l&&(l.value=""),n&&n(""),l&&typeof l.focus=="function"&&l.focus()});let p=t.querySelector("[data-roster-back]");p&&p.addEventListener("click",()=>a&&a())}function Ps(t,{onTab:e,onBack:a,onSetParty:r,onPortrait:s,onFeed:n,onFeedReset:i,onFeedGo:l,onAscend:h,onFormUp:p,onGearSlot:d,onGearBack:o,onEquip:u,onRelicFeed:f,onOpenWeapon:v}){for(let L of t.querySelectorAll("[data-tab]"))L.addEventListener("click",()=>e&&e(L.dataset.tab));let w=t.querySelector("[data-back-roster]");w&&w.addEventListener("click",()=>a&&a());let g=t.querySelector("[data-set-party]");g&&g.addEventListener("click",()=>r&&r());let x=t.querySelector("[data-portrait]");x&&x.addEventListener("click",()=>s&&s());let S=t.querySelector(".root")||t,A=null,z=null,U=0,R=()=>{A&&(clearTimeout(A),A=null),z=null,U=0},q=()=>{if(!z)return;let L=S.querySelector('[data-feed="'+z+'"]');if(!L||L.disabled){R();return}U+=1,n&&n(z),A=setTimeout(q,Math.max(55,300-U*24))};S.addEventListener("pointerdown",L=>{let P=L&&L.target&&L.target.closest?L.target:null,X=P&&P.closest("[data-feed]");!X||X.disabled||(R(),z=X.getAttribute("data-feed"),A=setTimeout(q,420))});for(let L of["pointerup","pointercancel","pointerleave"])S.addEventListener(L,R);S.addEventListener("click",L=>{let P=L&&L.target&&L.target.closest?L.target:null;if(!P)return;let X=P.closest("[data-feed]");if(X&&!X.disabled){n&&n(X.dataset.feed);return}if(P.closest("[data-feed-reset]")){i&&i();return}if(P.closest("[data-feed-go]")){l&&l();return}let J=P.closest("[data-ascend]");if(J&&!J.disabled){h&&h();return}let te=P.closest("[data-form-up]");if(te&&!te.disabled){p&&p(te.getAttribute("data-form-up"));return}let le=P.closest("[data-gear-slot]");if(le&&!le.disabled){d&&d(le.getAttribute("data-gear-slot"));return}if(P.closest("[data-gear-back]")){o&&o();return}let oe=P.closest("[data-wlevel]");if(oe&&!oe.disabled){v&&v(oe.getAttribute("data-wlevel"));return}let se=P.closest("[data-equip]");if(se&&!se.disabled){u&&u(se.getAttribute("data-equip")||"");return}if(!f)return;if(P.closest("[data-rfeed-open]")){f({type:"open"});return}if(P.closest("[data-rfeed-back]")){f({type:"back"});return}if(P.closest("[data-rfeed-clear]")){f({type:"clear"});return}let re=P.closest("[data-rfeed-go]");if(re&&!re.disabled){f({type:"go"});return}let Q=P.closest("[data-rfeed-pick]");Q&&f({type:"pick",id:Q.getAttribute("data-rfeed-pick")})})}var Dt=.6666666666666666;function Ne(t){return String(t??"").replace(/[&<>"']/gu,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function pt(t){let e=Array.isArray(t)?t:String(t??"").split(","),a=[];for(let r of e){let s=String(r??"").trim();s&&!a.includes(s)&&a.push(s)}return a}function ya(t,e,a=1,r=.5,s=.5){let n=Math.max(1,Number(t)||1),i=Math.max(1,Number(e)||1),l=Math.min(n,i*Dt),h=Math.min(1,Math.max(.2,Number(a)||1)),p=l*h,d=p/Dt;return wa({x:n*r-p/2,y:i*s-d/2,w:p,h:d},n,i)}function wa(t,e,a){let r=Math.max(1,Number(e)||1),s=Math.max(1,Number(a)||1),n=Math.min(Math.max(1,Number(t&&t.w)||1),r),i=n/Dt;i>s&&(i=s,n=i*Dt);let l=Math.min(Math.max(0,Number(t&&t.x)||0),r-n),h=Math.min(Math.max(0,Number(t&&t.y)||0),s-i);return{x:l,y:h,w:n,h:i}}var Ds=`
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

/* Same head contract as every other screen: hoistHeadIntoBar REMOVES it, so the second row only
   exists while it is still here. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }

/* \u2500\u2500 The body: the plate and the editor, with the history along the bottom \u2500\u2500\u2500\u2500 */
.pt-body { min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.pt-main { min-height: 0; display: flex; gap: var(--sp-3); }

/* The plate takes its width from its HEIGHT and the portrait's own ratio, so it never
   letterboxes and never dictates how much room the editor gets. */
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
   FIXED HEIGHT, even with nothing in it. As an auto row it collapsed when a unit had no
   earlier art, and the plate above grew from 302x453 to 347x521 \u2014 the same portrait cropped
   differently on the same screen depending on how many times you had redone it. It is the exact
   failure the sheet's own portrait plate already paid for with minmax(0, 1fr).
   (No backticks in here, ever: this sheet is a JS template literal and one closes it.) */
.pt-past { flex: none; height: calc(var(--f) * 10); display: flex; align-items: flex-end; gap: var(--sp-2); }
.pt-past .cap { flex: none; width: calc(var(--f) * 9); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.pt-strip { flex: 1 1 auto; min-width: 0; display: flex; gap: var(--sp-1); overflow-x: auto; padding-bottom: calc(var(--f) * 0.2); }
.pt-thumb { flex: none; position: relative; height: calc(var(--f) * 8.6); aspect-ratio: 2 / 3; padding: 0; cursor: pointer; background: var(--steel-dark); border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); overflow: hidden; }
.pt-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%; display: block; }
.pt-thumb:hover { border-color: var(--coral); }
.pt-thumb[aria-current="true"] { border-color: var(--amber); cursor: default; }
.pt-thumb .now { position: absolute; inset: auto 0 0 0; background: color-mix(in srgb, var(--amber) 85%, transparent); color: var(--ink); font-family: var(--display); font-size: calc(var(--f) * 0.62 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; text-transform: var(--case); }
.pt-empty { font-size: var(--t-xs); color: var(--steel-faint); align-self: center; }

/* \u2500\u2500 The crop view \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pt-crop { min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }
.pt-canvas { position: relative; min-height: 0; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--ground-1) 60%, transparent); border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); overflow: hidden; }
/* The box carries the image's OWN ratio, set inline from naturalWidth/naturalHeight, and is
   sized height-first with a max-width that clamps it. Written the obvious way \u2014 a bare wrapper
   with max-width/max-height on the img \u2014 a percentage max-height against an auto-height parent
   resolves to none: measured, a 1600x900 picture drew 604px tall inside a 507px box (clipped by
   the canvas, so nothing overflowed and no scroll check saw it) and a 700x1900 one drew at its
   FULL 1900px. The ratio here is also what makes the frame's percentages mean 2:3 on screen. */
.pt-shot { position: relative; height: 100%; max-width: 100%; max-height: 100%; }
.pt-shot img { display: block; width: 100%; height: 100%; }
/* The veil is what makes the frame READ as a frame: the part that stays is the bright part. */
.pt-frame { position: absolute; border: 2px solid var(--amber); box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--ground-2) 72%, transparent); cursor: grab; touch-action: none; }
.pt-frame.drag { cursor: grabbing; }
.pt-frame::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to right, transparent 33%, color-mix(in srgb, var(--amber) 28%, transparent) 33%, color-mix(in srgb, var(--amber) 28%, transparent) 33.4%, transparent 33.4%, transparent 66.6%, color-mix(in srgb, var(--amber) 28%, transparent) 66.6%, color-mix(in srgb, var(--amber) 28%, transparent) 67%, transparent 67%); pointer-events: none; }
.pt-crop-bar { flex: none; display: flex; align-items: center; gap: var(--sp-3); }
.pt-size { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: var(--sp-2); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
.pt-size input { flex: 1 1 auto; min-width: 0; accent-color: var(--coral); }
`;function Ll(t,e){return'<span class="pt-chip">'+Ne(t)+'<button type="button" data-tag-drop="'+e+'" aria-label="Remove '+Ne(t)+'">&times;</button></span>'}function Ml(t,e){return t.length?'<div class="pt-strip">'+t.map((a,r)=>'<button class="pt-thumb" type="button" aria-current="'+(a.current?"true":"false")+'"'+(a.current?" disabled":' data-pick="'+r+'"')+' title="'+Ne(a.source==="upload"?"Your own image":"Generated")+'"><img src="'+Ne(a.url)+'" alt="" loading="lazy">'+(a.current?'<span class="now">Now</span>':"")+"</button>").join("")+"</div>":'<div class="pt-empty">No earlier art yet \u2014 the first redo puts this one here, and the last '+e+" are kept.</div>"}function qs({unit:t=null,view:e="edit",draft:a=null,history:r=[],historyMax:s=0,busy:n=!1,error:i="",crop:l=null,promptName:h=""}={}){let p=t&&t.name?String(t.name):"Portrait",d=a||{appearance:"",tags:[]},o=pt(d.tags),u='<div class="head"><button class="back" type="button" data-portrait-back>&#9664; '+Ne(p)+'</button><div class="head-id"><div class="eyebrow">Portrait</div><h2>'+(e==="crop"?"Choose the frame":"Redo the art")+"</h2></div></div>";if(e==="crop"){let w=l&&l.src||"",g=Math.round((l&&l.size||1)*100),x=l&&l.natural,S=x&&l.frame?' style="left:'+l.frame.x/x.w*100+"%;top:"+l.frame.y/x.h*100+"%;width:"+l.frame.w/x.w*100+"%;height:"+l.frame.h/x.h*100+'%"':"";return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait-crop">
    ${u}
    <div class="pt-crop gf-swap">
      <div class="pt-canvas">
        <div class="pt-shot" data-shot${x?' style="aspect-ratio:'+x.w+" / "+x.h+'"':""}>
          <img src="${Ne(w)}" alt="" data-crop-img>
          <div class="pt-frame" data-frame${S}></div>
        </div>
      </div>
      <div class="pt-crop-bar">
        <label class="pt-size">Frame<input type="range" min="20" max="100" value="${g}" data-size></label>
        <button class="pt-alt" type="button" data-crop-cancel>Cancel</button>
        <button class="pt-go" type="button" data-crop-ok${n?" disabled":""}>${n?"Uploading\u2026":"Use this frame"}</button>
      </div>
    </div>
  </section>
</div>`}let f=r.find(w=>w.current)||null,v=i?'<div class="pt-note bad">'+Ne(i)+"</div>":'<div class="pt-note">Art goes through the image API \u2014 it costs no story tokens.</div>';return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait">
    ${u}
    <div class="pt-body gf-swap">
      <div class="pt-main">
        <div class="pt-now">
          ${f?'<img src="'+Ne(f.url)+'" alt="" loading="lazy">':'<div class="pt-none">No portrait yet</div>'}
          ${f?'<span class="pt-tag">'+(f.source==="upload"?"Your image":"Generated")+"</span>":""}
        </div>
        <div class="pt-editor">
          <div class="pt-field grow">
            <!-- The name is shown because it is always sent: it leads the prompt and cannot be
                 edited. This screen labels its fields as what will be sent, and the name was not
                 among them, so it told half a truth. -->
            <div class="pt-sent"><b>Sent first:</b> <span data-prompt-name>${Ne(h||"(no name)")}</span>
              <span class="pt-hint">Added automatically, always ahead of the text below.</span></div>
            <div class="pt-label">Appearance<span class="pt-hint">What the image model reads. English only &mdash; a backend rejects the rest.</span></div>
            <textarea class="pt-text" data-appearance spellcheck="false" placeholder="Describe her as the image model should see her.">${Ne(d.appearance)}</textarea>
          </div>
          <div class="pt-field">
            <div class="pt-label">Tags<span class="pt-hint">Booru tags. These win over the prose when your style profile is tagged.</span></div>
            <div class="pt-tags" data-tags>
              ${o.map(Ll).join("")}
              <input class="pt-add" data-tag-add type="text" placeholder="add a tag, Enter" spellcheck="false">
            </div>
          </div>
          <div class="pt-actions">
            <button class="pt-go" type="button" data-generate${n?" disabled":""}>${n?"Painting\u2026":"Paint it again"}</button>
            <button class="pt-alt" type="button" data-upload${n?" disabled":""}>Use my own image\u2026</button>
            <input class="pt-file" type="file" accept="image/png,image/jpeg,image/webp" data-file>
            ${v}
          </div>
        </div>
      </div>
      <div class="pt-past">
        <div class="cap">Earlier</div>
        ${Ml(r,s)}
      </div>
    </div>
  </section>
</div>`}function Hs(t,{onBack:e,onDraft:a,onGenerate:r,onPick:s,onFile:n,onCropSize:i,onCropFrame:l,onCropOk:h,onCropCancel:p}={}){let d=R=>t.querySelector(R),o=d("[data-portrait-back]");o&&o.addEventListener("click",()=>e&&e());let u=d("[data-appearance]");u&&u.addEventListener("input",()=>a&&a({appearance:u.value}));let f=d("[data-tag-add]");f&&f.addEventListener("keydown",R=>{if(R.key!=="Enter"&&R.key!==",")return;R.preventDefault();let q=String(f.value||"").trim();q&&(f.value="",a&&a({addTag:q}))});for(let R of t.querySelectorAll("[data-tag-drop]"))R.addEventListener("click",()=>a&&a({dropTag:Number(R.getAttribute("data-tag-drop"))}));let v=d("[data-generate]");v&&v.addEventListener("click",()=>r&&r());for(let R of t.querySelectorAll("[data-pick]"))R.addEventListener("click",()=>s&&s(Number(R.getAttribute("data-pick"))));let w=d("[data-file]"),g=d("[data-upload]");g&&w&&g.addEventListener("click",()=>w.click()),w&&w.addEventListener("change",()=>{let R=w.files&&w.files[0];w.value="",R&&n&&n(R)});let x=d("[data-size]");x&&x.addEventListener("input",()=>i&&i(Number(x.value)/100));let S=d("[data-crop-ok]");S&&S.addEventListener("click",()=>h&&h());let A=d("[data-crop-cancel]");A&&A.addEventListener("click",()=>p&&p());let z=d("[data-frame]"),U=d("[data-shot]");if(z&&U&&l){let R=null;z.addEventListener("pointerdown",L=>{R={x:L.clientX,y:L.clientY},z.classList.add("drag"),z.setPointerCapture&&z.setPointerCapture(L.pointerId),L.preventDefault()}),z.addEventListener("pointermove",L=>{if(!R)return;let P=U.getBoundingClientRect();l({dx:(L.clientX-R.x)/(P.width||1),dy:(L.clientY-R.y)/(P.height||1)}),R={x:L.clientX,y:L.clientY}});let q=()=>{R=null,z.classList.remove("drag")};z.addEventListener("pointerup",q),z.addEventListener("pointercancel",q)}}function xa(t,e,a,r){let s=t.querySelector("[data-frame]"),n=t.querySelector("[data-crop-img]");if(!s||!n||!e)return;let i=Math.max(1,Number(a)||1),l=Math.max(1,Number(r)||1);s.style.left=e.x/i*100+"%",s.style.top=e.y/l*100+"%",s.style.width=e.w/i*100+"%",s.style.height=e.h/l*100+"%"}var ft={story:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',events:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.4 5.4 5.9.6-4.4 4 1.2 5.8L12 15.9 6.9 18.8l1.2-5.8-4.4-4 5.9-.6z"/></svg>',materials:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',tower:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 21V8l6-5 6 5v13z"/><path d="M10 21v-5h4v5M9 11h6"/></svg>'},Bl=[{id:"story",label:"Story",live:!0,blurb:"The main line. Chapters of beats and fights that move the world forward."},{id:"events",label:"Story Events",live:!1,blurb:"Limited-time side stories, tied to the event system."},{id:"materials",label:"Materials",live:!0,blurb:"Farm what levels and ascends your units. Spends stamina; pays in materials."},{id:"tower",label:"Tower",live:!1,wide:!0,blurb:"A monthly climb. Resets, gets harder, pays in materials."},{id:"pvp",label:"PvP",live:!1,blurb:"Your formation against another commander's, resolved by the same sim. No live opponent."}],$s=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;

  /* THE SHARED RAMP, never a private one. There were TWO in the project and this screen used the
     small one, ~12% below the rest: measured, the hero paragraph came out at 8.4px. A per-screen
     ramp is the same class of bug as a copied colour token. */






  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);
  /* How much the footer strip takes. ONE knob, in ramp units so it scales with the screen instead
     of being pinned in pixels. Whatever the strip measures comes off the hero. */
  --strip-h: calc(var(--f) * 11);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) and the :has() row, not "auto 1fr": hoistHeadIntoBar REMOVES the .head, and a
   screen declared with two fixed rows would then put its only child in the auto row and size it to
   its content instead of to the screen. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }
.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }

/* The board: the hero mode takes the left column across both rows, the rest stack beside it. The
   same block language as the Home, because it is the same kind of choice. */
/* Hero beside a column, not a grid: a 3x2 grid fits four modes with a HOLE in the last cell, and
   the hole moves every time a mode ships. This shape takes any number of them. */
/* The board is a COLUMN: the hero with its column beside it on top, the strips full width below.
   The strip does not grow and the top absorbs, so the strip's height comes off the HERO. */
.board { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
.board-top { flex: 1; min-height: 0; display: flex; gap: var(--sp-2); }
.rest { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
.rest > .m { flex: 1; min-height: 0; }

/* The strip: wide, contents IN A ROW. Stacked it would grow tall, and height is what is being
   given back to the hero.
   Its height comes from --strip-h, not from the content. With the content deciding it measured
   50px -- a band that read as a separator rather than a mode. As a knob, changing what the strip
   weighs is a number and not a redesign. */
.m.strip { flex: none; min-height: var(--strip-h); flex-direction: row; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); justify-content: flex-start; }
/* The glyph grows with the strip: at 50px it was an icon; with real height it can be the watermark
   the other cards already use. It stays in flow (not absolute) because here it orders the row. */
.m.strip .glyph { position: static; width: var(--strip-h); height: var(--strip-h); max-width: calc(var(--f) * 4.4); max-height: calc(var(--f) * 4.4); flex: none; opacity: 0.5; }
.m.strip .strip-id { display: flex; flex-direction: column; gap: calc(var(--f) * 0.1); flex: none; }
.m.strip .kicker { font-size: var(--t-xs); }
.m.strip .name { font-size: calc(var(--f) * 1.9 * var(--gf-type-scale, 1)); }
.m.strip .blurb { font-size: var(--t-sm); }
/* min-width: 0 or the blurb does NOT shrink: a flex child has min-width auto = min-content, and a
   long sentence would push the chip out of the strip. */
.m.strip .blurb { flex: 1; min-width: 0; margin: 0; }
.m.strip .tag { position: static; flex: none; margin-left: auto; }
/* The card is the HOME's block, not a plainer cousin of it. What made the first pass read as
   "basic" was three concrete differences from .block, all of them structural rather than colour:
   the glyph is a huge WATERMARK bleeding off the corner (42% wide, barely visible) instead of a
   small icon in the flow; the content is anchored to the BOTTOM; and the name uses the --title
   face with its own weight and tracking, not --display. */
.m {
  position: relative; overflow: hidden; min-width: 0; min-height: 0;
  cursor: pointer; text-align: left; font-family: var(--display);
  padding: var(--sp-2) var(--sp-3);
  /* THE CONTENT SITS AT THE BOTTOM VIA AN AUTO MARGIN, NOT justify-content flex-end.
     With justify-content: flex-end, content that does NOT FIT overflows past the START edge --
     upwards -- where the neighbour covers it and no scroll can reach it. On a phone --f hits its
     7.5px floor and the tile's three lines stop fitting, so the case is permanent, not theoretical.
     With margin-top: auto on the first child in flow the layout is identical when there is room to
     SPARE, and when there is NOT the overflow goes DOWN, where overflow: hidden clips it against
     its own box instead of against the neighbour's text. */
  display: flex; flex-direction: column; justify-content: flex-start; gap: calc(var(--f) * 0.2);
  background: color-mix(in srgb, var(--ink-2) 82%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  color: var(--text);
  --cut: 0.7em; clip-path: var(--clip-card); border-radius: var(--radius);
  backdrop-filter: var(--panel-blur); box-shadow: var(--panel-shadow), var(--panel-bevel);
  transition: border-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease), background-color var(--dur-fast) ease;
}
.m.live:hover { transform: translateY(-2px); border-top-color: var(--coral); background: color-mix(in srgb, var(--ink-2) 96%, transparent); }
/* clip-path clips an outline away, so the focus ring is drawn inside. */
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
/* A PARAGRAPH cannot use a label's size. It was on --t-xs, the kicker's token, and on the small
   ramp that came out at 8.4px. */
.m .blurb { font-size: var(--t-sm); letter-spacing: 0.04em; line-height: 1.45; color: var(--porcelain-3); }
.m .tag {
  position: absolute; top: calc(var(--f) * 0.7); right: calc(var(--f) * 0.9);
  font-family: var(--display); font-weight: 700; font-size: var(--t-tiny); letter-spacing: 0.14em;
  text-transform: var(--case); padding: 0 calc(var(--f) * 0.6);
  border: 1px solid var(--steel-dark); color: var(--steel-faint);
}
.m.live .tag { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }

/* The hero echoes .block.battle: its own lit backdrop and a rule-led eyebrow, because it is the
   one card with somewhere to go and something to report. */
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
/* THE PREMISE FILLS THE ROOM IT HAS, NOT A FIXED NUMBER OF LINES.
   Pinned at 3 lines, at 150% text those 3 lines hold MUCH less text and the player never learns
   what the chapter is about -- while the card had spare room below it. A clamp of N lines is a lie
   as soon as the text scales: the block takes the available height and the paragraph fills it.
   The fade at the end replaces the ellipsis, which a height clip does not give. */
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
`;function Se(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function zl(t,e){let a="";for(let r=0;r<t;r+=1)a+='<i class="'+(r<e?"on":"")+'"></i>';return a}function js({story:t=null,modes:e=Bl}={}){let a=t||{},r=!!a.hasPlan,s=Number(a.total)||10,n=Math.max(0,Math.min(s,Number(a.done)||0)),i=e.map(d=>{if(d.id==="story"){let o=!!d.live;return'<button class="m hero'+(o?" live":"")+'" type="button"'+(o?' data-mode="story"':" disabled")+'><span class="tag">'+(o?"Open":"Soon")+"</span>"+ft.story+'<span class="hero-top"><span class="kicker">'+(o?Se(a.chapterLabel||"Chapter 1"):"Not open yet")+'</span><span class="name">Story</span>'+(o?'<span class="title">'+Se(r?a.title||"":"Your world is forged")+'</span><p class="premise">'+Se(r?a.premise||"":"Open the first chapter to start the story.")+"</p>":'<p class="premise">'+Se(d.blurb||"")+"</p>")+"</span>"+(o?'<span class="hero-foot"><span class="nodes">'+zl(s,n)+"<span>"+(r?n+" of "+s+" cleared":"Not started")+'</span></span><span class="cta">'+(n>0?"Continue":"Begin")+"<small>"+Se(a.chapterLabel||"Chapter 1")+"</small></span></span>":"")+"</button>"}return d.wide?'<button class="m strip'+(d.live?" live":"")+'" type="button"'+(d.live?' data-mode="'+Se(d.id)+'"':" disabled")+">"+(ft[d.id]||ft.events)+'<span class="strip-id"><span class="kicker">'+(d.live?"Ready":"Not open yet")+'</span><span class="name">'+Se(d.label)+'</span></span><p class="blurb">'+Se(d.blurb)+'</p><span class="tag">'+(d.live?"Open":"Soon")+"</span></button>":'<button class="m'+(d.live?" live":"")+'" type="button"'+(d.live?' data-mode="'+Se(d.id)+'"':" disabled")+'><span class="tag">'+(d.live?"Open":"Soon")+"</span>"+(ft[d.id]||ft.events)+'<span class="kicker">'+(d.live?"Ready":"Not open yet")+'</span><span class="name">'+Se(d.label)+'</span><p class="blurb">'+Se(d.blurb)+"</p></button>"}),l=i[0],h=i.filter((d,o)=>o>0&&!e[o].wide).join(""),p=i.filter((d,o)=>o>0&&e[o].wide).join("");return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="modes">
    <div class="head">
      <button class="back" type="button" data-back-home>&#9664; Home</button>
      <div class="head-id"><div class="eyebrow">Battle</div><h2>Pick a mode</h2></div>
    </div>
    <div class="board"><div class="board-top">${l}<div class="rest">${h}</div></div>${p}</div>
  </section>
</div>`}function Us(t,{onPick:e,onBack:a}={}){for(let s of t.querySelectorAll("[data-mode]"))s.addEventListener("click",()=>e&&e(s.dataset.mode));let r=t.querySelector("[data-back-home]");r&&r.addEventListener("click",()=>a&&a())}function ge(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function ka(t){return(Number(t)||0).toLocaleString("en-US")}var ut=_t,Fl='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Ws=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute; inset: 0; overflow: hidden;

  /* THE SHARED RAMP, never a private one. There were TWO in the project and this screen used the
     small one, ~12% below the rest: the symptom was "nothing is readable". A per-screen ramp is
     the same class of bug as a copied colour token -- it drifts and nobody notices until someone
     cannot read. */





  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  font-family: var(--body);
  color: var(--text);
}
.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 8%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 8% 94%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }

/* minmax(0,1fr) and the :has() row, never "auto 1fr": hoistHeadIntoBar REMOVES the .head, and a
   screen with two fixed rows would drop its only child into the AUTO row and size it to its
   content instead of to the screen \u2014 dead band at the bottom. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; pointer-events: auto; }
.screen:has(> .head) { grid-template-rows: auto minmax(0, 1fr); }

.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.back { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.4) var(--sp-2); background: transparent; border: 1px solid var(--steel-dark); color: var(--text); --cut: 0.45em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.back:hover { border-color: var(--coral); color: var(--coral); }
.head-id .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.head-id h2 { margin: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
/* The top bar already carries Vigor; the head repeats it because THIS is the screen that spends it
   and the bar is gone in fullscreen on narrow windows. */

/* \u2500\u2500 The board: three plates, equal weight \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* The band is a SIBLING of the board, never a child of it. Nested, it became a fourth item in
   a three-column grid: it landed in column 1 of a new row, took a third of the screen, and then
   split THAT into three -- 110px per cell for text that needs 232 to fit on one line, so every
   line of it wrapped three ways on a screen 1108px wide. Height is the scarce dimension here and
   width is the free one; that spent the scarce one to save the abundant one. */
.body { min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: 0 var(--sp-3) var(--sp-3); }
/* hoistHeadIntoBar REMOVES the .head, and its padding goes with it, so the content lands against
   the bar: measured, 0px of air here against 13px on Inventory. It goes under :not(:has(> .head))
   so it applies EXACTLY in the hoisted case and never doubles up. Copied from inventory.js, which
   is the screen this one is measured against -- coherence is copied, not chosen.
   Both containers need it: the root view uses .body and the rotation view uses .detail. */
.screen:not(:has(> .head)) .body,
.screen:not(:has(> .head)) .detail { padding-top: var(--sp-2); }
/* TWO ROWS: three plates and then two, and the second row centres ITSELF -- flex-wrap plus
   justify-content, never an nth-child, because a count written by hand breaks the day a sixth
   stage ships. Same trick the events tab uses for its seven day-tiles.
   Why not one row of five: at five columns a plate is narrow and tall, so a tier card carrying
   three rows got a 193px box and 63% of it sat empty; the plate painted 21% ink. Two rows put the
   card at 402x74 and the plate at 39%, against 52% for an Inventory block.
   WHAT MAKES TWO ROWS FIT is that the card is three rows for EVERY stage. Only the Relic Vault
   has a rarity table, and giving it a fourth row -- or reserving that row in the others so the
   heights matched -- added 48px per plate, which is exactly what pushed the second row off the
   screen: measured over nine window sizes it then overflowed at six of them. The odds share the
   figure's line instead, and the cards come out equal with nothing reserved.
   SAFE centre, never a bare one. Centred, whatever does not fit spills out of BOTH edges, and the
   half that goes past the top edge cannot be scrolled to -- scroll offset does not go negative, so
   that content is simply gone. Measured at 1920x1080: the first plate sat 40px above the board at
   150% and 111px above it at 175%, cut and unreachable, while the scrollbar only offered the
   bottom. The safe keyword falls back to start the moment it would overflow, so the leftover all
   goes downward, where the scroll reaches it. Same family as a flex column with justify-content
   flex-end, which spills upward for the same reason.
   Measured over 9 window sizes: fits at 100% and at the 115% default in ALL of them, and the
   SCREEN never scrolls at any scale. Past 130% the board scrolls inside its own box, which is the
   house rule -- a player who chose a big HUD chose to see less at a time, and compressing the
   layout to avoid the scroll would undo their choice. */
.board { flex: 1 1 auto; min-height: 0; display: flex; flex-wrap: wrap; align-content: safe center; justify-content: center; gap: var(--sp-2); overflow-y: auto; }
/* One plate carries the whole width: the loading state has a single one, and a fifth of the board
   for one plate reads as a broken layout rather than a waiting one. */
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
/* A stage whose drop has no sink yet: drawn, named, and unpressable. Same treatment the dock
   gives a locked tile, so the board keeps its five columns the day the sink opens. */
/* What the run pays the COMMANDER, beside what it costs. It is the figure that decides whether
   a harder run is worth it, and it rises with the price -- so it belongs in the same foot. */
.tcard .rxp { font-size: var(--t-tiny); letter-spacing: 0.06em; text-transform: var(--case); color: var(--jade); font-variant-numeric: tabular-nums; }
.p-soon { flex: 1 1 auto; display: grid; place-items: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-dark); }
.p-id .kicker { font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.p-id .name { display: block; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); line-height: 1.15; }
/* THE "?" IN THE CORNER, THE EXPLANATION INSIDE IT. Each plate carried a permanent paragraph:
   five fixed sentences taking height in a stage that does not scroll, for something read ONCE.
   THE BUBBLE IS A CHILD OF THE PLATE, not of the button: the plate has clip-path and overflow
   hidden, so a bubble anchored to the button would be CLIPPED IN SILENCE -- a clip-path cut never
   shows up in scrollWidth. As a child of the plate it stretches between its margins instead.
   The bubble is OPAQUE (--ink-2, not a mix with transparent): text must not blend into what is
   behind it, and this one sits over the cards.
   THE ? IS A GRID CELL, NOT AN ABSOLUTE. In position:absolute it sat ON TOP of the title box in
   all five plates -- both inside the plate, so neither overflow nor clipping fires. Two siblings
   that overlap is the third question a measurement has to ask. With its own row and column they
   cannot overlap by construction. */
.p-id { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: var(--sp-2); }
.p-id .kicker, .p-id .name, .p-id .blurb { grid-column: 1; }
.p-help { grid-column: 2; grid-row: 1 / span 2; align-self: start; width: calc(var(--f) * 1.7); height: calc(var(--f) * 1.7); display: grid; place-items: center; padding: 0; cursor: help; background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); border-radius: 50%; color: var(--steel-faint); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); line-height: 1; }
.p-help:hover, .p-help:focus-visible { color: var(--text); border-color: var(--steel); outline: none; }
.p-tip { position: absolute; z-index: 5; top: calc(var(--f) * 2.6); left: var(--sp-2); right: var(--sp-2); padding: calc(var(--f) * 0.55) calc(var(--f) * 0.7); background: var(--ink-2); border: 1px solid var(--steel-dark); color: var(--text); font-family: var(--display); font-size: var(--t-xs); line-height: 1.45; letter-spacing: 0.03em; text-transform: none; text-align: left; opacity: 0; visibility: hidden; transition: opacity 120ms ease; pointer-events: none; box-shadow: var(--panel-shadow); }
.plate:has(.p-help:hover) .p-tip, .plate:has(.p-help:focus-visible) .p-tip { opacity: 1; visibility: visible; }
.p-id .blurb { display: block; margin-top: calc(var(--f) * 0.25); font-size: var(--t-xs); letter-spacing: 0.04em; line-height: 1.4; color: var(--porcelain-3); }

/* \u2500\u2500 The tier card. The card IS the button \u2014 no separate Run. \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* One component, two arrangements: stacked where the space is tall (a root plate), in a row of
   three where it is wide and short (inside a family card). */
.tcards { flex: 1 1 auto; min-height: 0; display: grid; gap: calc(var(--f) * 0.4); }
/* min-content, never 1fr: with 1fr the three cards split the WHOLE height of a plate the board
   stretches to the screen, so a card carrying 59px of rows got a 193px box. */
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
/* The material's OWN rank, said without a number: the quantity falls as the difficulty rises, so
   the quantity is exactly the thing that misleads here. */
.tcard .rank { flex: none; display: inline-flex; gap: calc(var(--f) * 0.2); }
.tcard .rank i { width: calc(var(--f) * 0.38); height: calc(var(--f) * 0.38); transform: rotate(45deg); background: var(--ink-2); border: 1px solid var(--steel-dark); display: block; }
.tcard .rank i.on { background: var(--amber); border-color: var(--amber); }
/* The headline names the material IN FULL. A bare "Tier II" made the player look up at the card
   header to find out what they would even be getting. */
/* The figure and the odds share ONE line. Only the Relic Vault has a rarity table, and giving
   it a line of its own made its cards 16px taller than the Funds and XP ones beside them -- and
   reserving that line in every card instead added 48px per plate, which is what stopped two rows
   of plates from fitting. On one line all three cards are three rows tall by construction, with
   nothing reserved and nothing to keep in sync. */
.tcard .vrow { display: flex; align-items: baseline; justify-content: space-between; gap: calc(var(--f) * 0.5); min-width: 0; }
.tcard .odds { flex: none; }
.tcard .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-md); line-height: 1.15; letter-spacing: var(--track); color: var(--text); }
.tcard .v em { font-style: normal; font-weight: 400; font-size: 0.8em; color: var(--steel-faint); }
/* What the run is WORTH, in a unit shared across the three difficulties. This is the line that
   proves 2 x Prism beats 12 x Shard. */
.tcard .u { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--jade); }
.tcard[disabled] .u { color: var(--steel-faint); }
/* The relic stage drops ONE piece at every difficulty, so its card cannot say what it gives with a
   quantity -- what the difficulty moves is the TABLE. These three figures ARE the decision, so they
   go on the card rather than in a tooltip nobody opens. The 5-star is lit because it is the one the
   player is buying; the others are what they are settling for. */
.tcard .odds { display: flex; gap: calc(var(--f) * 0.5); min-width: 0; font-family: var(--display); font-size: var(--t-tiny); line-height: 1.4; letter-spacing: 0.06em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.tcard .odds span { display: inline-flex; align-items: baseline; gap: calc(var(--f) * 0.18); }
.tcard .odds b { font-weight: 700; color: var(--porcelain-3); }
.tcard .odds .five, .tcard .odds .five b { color: var(--amber); }
.tcard[disabled] .odds, .tcard[disabled] .odds b, .tcard[disabled] .odds .five, .tcard[disabled] .odds .five b { color: var(--steel-faint); }
.tcard .cost { margin-top: calc(var(--f) * 0.3); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.25); font-size: var(--t-xs); color: var(--steel-faint); font-variant-numeric: tabular-nums; }
.tcard .cost svg { width: calc(var(--f) * 0.9); height: calc(var(--f) * 0.9); color: var(--amber); }
.tcard[disabled] .cost, .tcard[disabled] .cost svg { color: var(--coral); }

/* \u2500\u2500 The ascension plate: the only one that opens a second view \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* The families open today are CARDS here too, not a list of names. A text list left this plate
   with three short lines at the top and the rest empty, beside two plates packed with cards -- the
   same emptiness as the dead band, just inside a box. Same card component, so the three plates
   share one rhythm. */
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

/* \u2500\u2500 The bottom band: what this does for the units you already have \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 The ascension view \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* Columns come from the COUNT, and the rows STRETCH. An auto-fill track list left three cards
   at the top of the region with 333px of dead screen under them (measured) \u2014 on a fixed 16:9 stage
   that reads as a broken screen. A region may scroll inside its box; it may not sit two thirds
   empty. Capped at 4 so eleven families do not shrink to slivers \u2014 past that the region scrolls. */
/* ROWS FIRST, then columns. Three tries got measured here and the first two were wrong:
     \xB7 auto-fill columns + align-content:start -> three cards at the top and 333px of dead screen
       under them. On a fixed 16:9 stage that reads as a broken screen.
     \xB7 one stretched row -> tier cards 108 wide by 383 tall, skinny slivers. The opposite failure.
     \xB7 rows = min(count, 3) and columns derived from it -> at least two rows always, so nothing
       stretches into a sliver, and the rows fill the region instead of floating centred in it.
   Wednesday (3 families) becomes 3 wide rows; Sunday (11) becomes 4 x 3. Both fill, measured 0/0.
   No backticks in this comment: it lives inside a JS template literal and one would close it. */
.fams-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); grid-auto-rows: minmax(calc(var(--f) * 7.5), 1fr); gap: var(--sp-2); padding-right: calc(var(--f) * 0.3); }
/* The family name sits BESIDE its three cards, not above them. Stacked, every row had to be tall
   enough for a header plus a card, and with eleven families the cards were squeezed to 34px for
   four lines of content (measured). Beside, the header spends WIDTH -- which the 16:9 stage has to
   spare -- and the row is only as tall as one card. */
.fam-card { min-width: 0; min-height: 0; display: flex; align-items: center; gap: var(--sp-2); background: color-mix(in srgb, var(--ink-2) 88%, transparent); border: 1px solid var(--ink-3); border-left: 2px solid var(--amber); padding: calc(var(--f) * 0.6) calc(var(--f) * 0.8); --cut: 0.6em; clip-path: var(--clip-card); border-radius: var(--radius); }
.fam-id { flex: 0 0 22%; min-width: 0; }
.fam-id .n { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.04em; text-transform: var(--case); color: var(--text); }
.fam-id .m { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.14em; text-transform: var(--case); color: var(--steel-faint); }
/* A dead control has to say why. Same rule the level cap and the ascension bill already follow. */
.why { flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.04em; color: var(--coral); }
`;function qt(t,e,a){let r=Number(t.vigor)>Number(e),s=t.cp===null||t.cp===void 0?null:Number(t.cp),n="";for(let h=1;h<=3;h+=1)n+='<i class="'+(h<=Number(t.difficulty)?"on":"")+'"></i>';let i=h=>Math.round(Number(h)*100)+"%",l=t.odds?'<div class="odds"><span>3&#9733;<b>'+i(t.odds[3])+"</b></span><span>4&#9733;<b>"+i(t.odds[4])+'</b></span><span class="five">5&#9733;<b>'+i(t.odds[5])+"</b></span></div>":"";return'<button class="tcard" type="button"'+(r?" disabled":"")+" "+a+'><div class="tl"><span>'+ge(t.label)+'</span><span class="rank">'+n+'</span></div><div class="vrow"><span class="v">'+ka(t.qty)+" <em>&times;</em> "+ge(t.material)+"</span>"+l+'</div><div class="foot"><span class="cp'+(s===null?" tbd":"")+'">CP '+(s===null?"&mdash;":ka(s))+"</span>"+(Number(t.rankXp)>0?'<span class="rxp">+'+ka(t.rankXp)+" Rank XP</span>":"")+'<span class="cost">'+Fl+"<b>"+Number(t.vigor)+"</b></span></div></button>"}var Vs={root:"Materials",asc:"Ascension Materials",form:"Tenet Trial"};function _a(t){return'<div class="head"><button class="back" type="button" data-farm-back>&#9664; '+(t==="root"?"Battle":"Materials")+'</button><div class="head-id"><div class="eyebrow">'+(t==="root"?"Mode":"Materials")+"</div><h2>"+(Vs[t]||Vs.asc)+"</h2></div></div>"}function Sa(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="materials">'+t+"</section></div>"}function Gs({view:t="root",data:e=null,state:a="ready"}={}){if(a!=="ready"||!e)return Sa(_a(t)+'<div class="body"><div class="board solo"><section class="plate"><div class="p-id"><span class="name">'+(a==="error"?"Unavailable":"Loading&hellip;")+'</span><span class="blurb">'+(a==="error"?"Couldn&rsquo;t read the farm.":"Reading what is open today&hellip;")+"</span></div></section></div></div>");let r=Number(e.vigor)||0,s=Array.isArray(e.days)?e.days:[],n=Number(e.today)||0;if(t==="root"){let u=Array.isArray(e.families)?e.families:[],f=u.slice(0,3),v=Array.isArray(e.formFamilies)?e.formFamilies:[],w=v.slice(0,3),g=Array.isArray(e.locked)?e.locked:[],x=A=>g.includes(A),S='<div class="p-soon">Soon</div>';return Sa(_a("root")+'<div class="body"><div class="board"><section class="plate">'+ut.funds+'<div class="p-id"><div class="kicker">Currency</div><span class="name">Funds</span><button class="p-help" type="button" aria-label="What Funds is">?</button></div><span class="p-tip">The toll every level and every ascension charges.</span>'+(x("funds")?S:'<div class="tcards col">'+(e.stages.funds||[]).map(A=>qt(A,r,'data-farm-run="funds" data-diff="'+A.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+ut.xp+'<div class="p-id"><div class="kicker">Levelling</div><span class="name">XP Materials</span><button class="p-help" type="button" aria-label="What XP Materials is">?</button></div><span class="p-tip">Insight, in its three denominations. Feeds any unit.</span>'+(x("xp")?S:'<div class="tcards col">'+(e.stages.xp||[]).map(A=>qt(A,r,'data-farm-run="xp" data-diff="'+A.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+ut.relic+'<div class="p-id"><div class="kicker">Gear</div><span class="name">Relic Vault</span><button class="p-help" type="button" aria-label="What Relic Vault is">?</button></div><span class="p-tip">One piece per run, whatever the difficulty. What rises is the rarity.</span>'+(x("relic")?S:'<div class="tcards col">'+(e.stages.relic||[]).map(A=>qt(A,r,'data-farm-run="relic" data-diff="'+A.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+ut.form+'<div class="p-id"><div class="kicker">Abilities</div><span class="name">Tenet Trial</span><button class="p-help" type="button" aria-label="What Tenet Trial is">?</button></div><span class="p-tip">Trains a unit&rsquo;s abilities. Tenets by affinity, six families, on rotation.</span>'+(x("form")?S:'<div class="p-open"><div class="k">Open today &middot; '+ge((s[n]||{}).day||"")+'</div><div class="fcards">'+w.map((A,z)=>'<button class="fcard" type="button" data-farm-open="form"><span class="n">'+ge(A.name)+'</span><span class="m">'+ge(A.matches)+"</span>"+(z===w.length-1&&v.length>w.length?'<span class="more">+'+(v.length-w.length)+" more open today</span>":"")+"</button>").join("")+'</div><button class="cta" type="button" data-farm-open="form"><span>Open rotation</span><span>&#9654;</span></button></div>')+'</section><section class="plate">'+ut.asc+'<div class="p-id"><div class="kicker">Ceilings</div><span class="name">Ascension Materials</span><button class="p-help" type="button" aria-label="What Ascension Materials is">?</button></div><span class="p-tip">Sigils by affinity, Doctrines by role. Eleven families, on rotation.</span><div class="p-open"><div class="k">Open today &middot; '+ge((s[n]||{}).day||"")+'</div><div class="fcards">'+f.map((A,z)=>'<button class="fcard" type="button" data-farm-open="asc"><span class="n">'+ge(A.name)+'</span><span class="m">'+ge(A.matches)+"</span>"+(z===f.length-1&&u.length>f.length?'<span class="more">+'+(u.length-f.length)+" more open today</span>":"")+"</button>").join("")+'</div><button class="cta" type="button" data-farm-open="asc"><span>Open rotation</span><span>&#9654;</span></button></div></section></div></div>')}let i=t==="form",l=i?"form":"asc",h=Array.isArray(i?e.formFamilies:e.families)?i?e.formFamilies:e.families:[],p=Array.isArray(e.helped)?e.helped:[],d=Array.isArray(e.missed)?e.missed:[],o=h.some(u=>(u.rows||[]).some(f=>Number(f.vigor)>r));return Sa(_a(l)+'<div class="detail"><div class="rota"><div class="rota-lab">Rotation</div><div class="rota-days">'+s.map((u,f)=>'<button class="day'+(f===n?" on":"")+(u.all?" all":"")+'" type="button" disabled>'+ge(u.day)+"</button>").join("")+'</div></div><div class="rota-note">Sunday opens every family.</div><div class="fams-grid" style="--cols:1">'+h.map(u=>'<article class="fam-card"><div class="fam-id"><span class="n">'+ge(u.name)+'</span><span class="m">'+ge(u.matches)+'</span></div><div class="tcards row">'+(u.rows||[]).map(f=>qt(f,r,'data-farm-run="'+l+'" data-diff="'+f.difficulty+'" data-family="'+ge(u.id)+'"')).join("")+"</div></article>").join("")+"</div>"+(i?'<div class="band" style="--bcols:1"><div class="bnd-cell"><span class="k">What Tenets buy</span><span class="t">A unit trains with the Tenet of <b>its own affinity</b>, so what is open today decides <b>who</b> you can train.</span></div></div>':'<div class="band" style="--bcols:2"><div class="bnd-cell"><span class="k">Open today helps</span>'+(p.length?'<div class="who">'+p.map(u=>'<span class="u">'+ge(u.name)+(u.maxed?"<i>fully ascended</i>":"<i>A"+Number(u.at)+" &rarr; cap "+Number(u.to)+"</i>")+"</span>").join("")+"</div>":'<span class="t">Nothing you own uses today&rsquo;s families. <em>Come back tomorrow, or Sunday.</em></span>')+'</div><div class="bnd-cell"><span class="k">Not today</span>'+(d.length?'<span class="t"><b>'+d.length+"</b> more of your units wait on families that are closed: "+d.map(u=>ge(u)).join(", ")+".</span>":'<span class="t">Every unit you own is covered by what is open.</span>')+"</div></div>")+(o?'<div class="band-note">Vigor regenerates one point every '+Math.round((Number(e.vigorPerMs)||18e4)/6e4)+" minutes, up to "+(Number(e.vigorMax)||60)+".</div>":"")+"</div>")}function Ys(t,{onBack:e,onOpen:a,onRun:r}){let s=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);s.length||s.push(t);let n=i=>{let l=i&&i.target&&i.target.closest?i.target:null;if(!l)return;if(l.closest("[data-farm-back]")){e&&e();return}let h=l.closest("[data-farm-open]");if(h){a&&a(h.getAttribute("data-farm-open")||"asc");return}let p=l.closest("[data-farm-run]");p&&!p.disabled&&r&&r({stage:p.getAttribute("data-farm-run"),difficulty:Number(p.getAttribute("data-diff"))||0,family:p.getAttribute("data-family")||""})};for(let i of s)i.addEventListener("click",n)}function tt(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Ea(t){return(Number(t)||0).toLocaleString("en-US")}function Ol(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var Ht=`
/* \u2500\u2500 The detail of the picked piece \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* The card does NOT declare its own flex. It carried "flex: 0 0 31%" from the Inventory, where
   that is WIDTH inside a horizontal split; mounted in a column (the result screen) the same 31%
   becomes HEIGHT and the card is crushed -- measured, 114px of overflow. A shared component does
   not carry the POSITION of the screen it was born in: whoever mounts it decides the size. */
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
/* BOTH figures, always: a piece that prints only its final number tells the player it is already
   there, and one that prints only today's hides what upgrading buys. Same rule as the weapon. */
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

`;function $t(t,{gained:e=[],actions:a=!0,projection:r=null}={}){if(!t)return'<aside class="detail"><div class="d-none">Pick a piece to see its four sub-stats, what it gives now and what it gives at its cap.</div></aside>';let s=Number(t.rarity)||3,n=new Set((e||[]).map(o=>String(o.key))),i=t.main||null,l=Number(t.levelCap)||0,h=Number(t.level)||0,p=h>=l,d=Array.isArray(t.subs)?t.subs:[];return'<aside class="detail r'+s+'"><div class="d-head"><span class="d-art">'+ct(t.slot)+'</span><span class="d-id"><span class="n">'+tt(dt(t.slot))+'</span><span class="m"><em>'+Ol(s)+"</em> &middot; Lv "+h+" / "+l+"</span></span></div>"+(i?'<div class="d-main"><span class="k">'+tt(i.label||i.key)+'</span><span class="v">'+ue(i.key,i.value)+'</span><span class="m">'+(Number(i.valueMax)>Number(i.value)?"&rarr; "+ue(i.key,i.valueMax)+" at cap":"at cap")+"</span></div>":"")+'<div class="d-subs"><span class="h">Sub-stats &middot; '+d.length+"</span>"+d.map(o=>'<div class="d-sub'+(n.has(String(o.key))?" grew":"")+'"><span class="k">'+tt(o.label||o.key)+'</span><span class="v">'+ue(o.key,o.value)+"</span></div>").join("")+'</div><div class="d-worn">'+(t.wornBy?"Worn by <b>"+tt(t.wornBy)+"</b>":"Not equipped")+"</div>"+(r?'<div class="d-proj"><span class="big">Lv '+r.from+" &rarr; "+r.to+"</span><span>Eats <b>"+r.picked+"</b> "+(r.picked===1?"piece":"pieces")+" and <b>"+Ea(r.funds)+"</b> Funds"+(r.short?' &mdash; <span class="short">you hold '+Ea(r.have)+"</span>":"")+".</span><span>"+(r.ticks?"Reinforces <b>"+r.ticks+"</b> sub-stat"+(r.ticks===1?"":"s")+", picked at random.":"No sub-stat is reinforced yet &mdash; the next one lands at <b>Lv "+r.nextTick+"</b>.")+"</span></div>":"")+(a&&r?'<div class="d-acts"><button type="button" data-inv-feed-go'+(!r.picked||r.short?" disabled":"")+'>Feed</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></div>':a?'<div class="d-acts"><button type="button" data-inv-upgrade="'+tt(t.id)+'"'+(p?" disabled":"")+">"+(p?"At its cap":"Upgrade")+'</button><button class="ghost" type="button" data-inv-lock="'+tt(t.id)+'">'+(t.locked?"Unlock":"Lock")+'</button></div><div class="d-cost">'+(p?"Fully reinforced &mdash; <b>"+d.length+"</b> sub-stats at their rolled ceiling.":"One level eats <b>1</b> spare relic and <b>"+Ea(t.feedCost)+"</b> Funds. A sub is reinforced every <b>"+(Number(t.tickEvery)||3)+"</b> levels.")+"</div>":"")+"</aside>"}function xe(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function at(t){return(Number(t)||0).toLocaleString("en-US")}function Ks(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var Ta=[{key:"relics",label:"Relics",kicker:"Gear",live:!0,count:"relics",blurb:"Every piece you hold, worn or spare."},{key:"materials",label:"Materials",kicker:"Stock",live:!0,count:"materials",blurb:"Insight, ascension families and your currencies."}],Zs=Ht+`
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
.rail-note { margin-top: auto; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.04em; line-height: 1.35; color: var(--steel-faint); }

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

/* \u2500\u2500 The band: what the stock MEANS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.band { flex: none; display: grid; grid-template-columns: repeat(var(--bcols, 3), minmax(0, 1fr)); gap: var(--sp-2); border-top: 1px solid var(--ink-3); padding-top: calc(var(--f) * 0.6); }
.bnd { min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.2); }
.bnd .k { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); }
.bnd .t { min-width: 0; font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.04em; line-height: 1.4; color: var(--porcelain-3); }
.bnd .t b { color: var(--text); }
.bnd .t em { font-style: normal; color: var(--amber); }

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
`;function Qs(t,e){return t.id===e?"itself":t.wornBy?"worn":t.locked?"locked":""}function Pl(t,e,a){let r=Number(t.rarity)||3,s=t.id===e,n=(t.wornBy?'<span class="worn" title="Worn">&#9679;</span>':"")+(t.locked?'<span class="lock">&#128274;</span>':"");if(a){let i=Qs(t,a.targetId),l=t.id===a.targetId,h=a.picked.indexOf(t.id)>=0,p=!h&&a.picked.length>=a.room,d=!!i||p;return'<button class="tile r'+r+(h?" food":"")+(l?" target":"")+'" type="button"'+(d?" disabled":"")+' title="'+(l?"The piece being fed":i==="worn"?"Worn by "+xe(t.wornBy):i==="locked"?"Locked":p?"Already at its cap with what is picked":"Feed this")+'"'+(d?"":' data-inv-feed-pick="'+xe(t.id)+'"')+">"+(n?'<span class="flags">'+n+"</span>":"")+'<span class="art">'+ct(t.slot)+'</span><span class="st">'+Ks(r)+'</span><span class="fig">'+(t.main?ue(t.main.key,t.main.value):"&mdash;")+'</span><span class="lv">'+(l?"Feeding this":h?"Picked":xe(dt(t.slot)))+"</span></button>"}return'<button class="tile r'+r+'" type="button" aria-pressed="'+(s?"true":"false")+'" data-inv-pick="'+xe(t.id)+'">'+(n?'<span class="flags">'+n+"</span>":"")+'<span class="art">'+ct(t.slot)+'</span><span class="st">'+Ks(r)+'</span><span class="fig">'+(t.main?ue(t.main.key,t.main.value):"&mdash;")+'</span><span class="lv">'+xe(dt(t.slot))+" &middot; Lv "+(Number(t.level)||0)+"</span></button>"}function Dl(t,e,a){let r=Number(t.levelCap)||0,s=Number(t.level)||0,n=Math.max(0,r-s),i=Math.min(e.length,n),l=s+i,h=(Number(t.feedCost)||0)*i,p=Number(t.tickEvery)||3;return{from:s,to:l,room:n,picked:i,funds:h,have:Number(a)||0,short:h>(Number(a)||0),ticks:va(t.rarity,l)-va(t.rarity,s),nextTick:(Math.floor(s/p)+1)*p}}function ql(t,e){let a=Array.isArray(t.relics)?t.relics:[],r=e.slot||"all",s=e.rarity||"all",n=a.filter(g=>(r==="all"||g.slot===r)&&(s==="all"||String(g.rarity)===String(s))),i=e.feeding&&e.feeding.targetId?{targetId:e.feeding.targetId,picked:Array.isArray(e.feeding.picked)?e.feeding.picked:[]}:null,l=i&&a.find(g=>g.id===i.targetId)||null,h=l?Math.max(0,(Number(l.levelCap)||0)-(Number(l.level)||0)):0,p=l?{targetId:l.id,picked:i.picked.slice(0,h),room:h}:null,d=l||n.find(g=>g.id===e.picked)||n[0]||null,o=l?Dl(l,p.picked,t.wallet&&t.wallet.funds):null,u=[["all","All"],["core","Core"],["edge","Edge"],["flow","Flow"],["crest","Crest"]],f=[["all","All"],["5","5&#9733;"],["4","4&#9733;"],["3","3&#9733;"]],v=(g,x,S)=>x.map(([A,z])=>'<button class="chip" type="button" aria-pressed="'+(String(A)===String(S)?"true":"false")+'" data-inv-filter="'+g+'" data-value="'+A+'">'+z+"</button>").join(""),w=a.filter(g=>!Qs(g,p?p.targetId:"")).length;return(p?'<div class="feedbar">Pick what to feed &mdash; each piece is <b>1</b> level and <b>'+at(l?l.feedCost:0)+"</b> Funds. Room for <b>"+(o.room-o.picked)+"</b> more, <b>"+w+'</b> spare in your stock.<span class="sp"><button type="button" data-inv-feed-go'+(!o.picked||o.short?" disabled":"")+">Feed "+o.picked+'</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></span></div>':"")+'<div class="tools"><span class="fgroup"><span class="lbl">Slot</span>'+v("slot",u,r)+'</span><span class="fgroup"><span class="lbl">Rarity</span>'+v("rarity",f,s)+'</span><span class="tally">'+n.length+" of "+a.length+' shown</span></div><div class="split"><div class="grid-wrap"><div class="grid">'+(n.length?n.map(g=>Pl(g,d?d.id:"",p)).join(""):'<div class="grid-empty">'+(a.length?"Nothing matches this filter.":"You hold no relics yet &mdash; they drop from the <b>Relic Vault</b> stage in Materials, one piece per run.")+"</div>")+"</div></div>"+$t(d,{gained:e.gained||[],projection:o})+"</div>"}function Hl(t){let e=t.materials||{},a=Array.isArray(e.insight)?e.insight:[],r=Array.isArray(e.families)?e.families:[];return'<div class="mats"><div class="mrow"><div class="h">Insight &middot; levelling</div><div class="mcards">'+a.map(s=>'<div class="mcard'+(Number(s.qty)?" has":" none")+'"><span class="n">'+xe(s.name)+'</span><span class="q">'+at(s.qty)+'</span><span class="w">'+at(Number(s.qty)*Number(s.xp))+" XP held</span></div>").join("")+'</div></div><div class="mrow" style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column"><div class="h">Ascension &middot; '+r.length+' families</div><div class="fams">'+r.map(s=>'<div class="fam'+((s.tiers||[]).some(i=>Number(i.qty)>0)?" has":" none")+'"><div class="fam-id"><span class="n">'+xe(s.name)+'</span><span class="m">'+xe(s.matches)+'</span></div><div class="fam-t">'+(s.tiers||[]).map(i=>'<span class="tpill'+(Number(i.qty)?"":" none")+'">'+xe(i.tier)+"<b>"+at(i.qty)+"</b></span>").join("")+'</div><div class="fam-w">'+at(s.asTierI)+" &times; T1</div></div>").join("")+"</div></div></div>"}function Xs(t){return'<div class="head"><button class="back" type="button" data-inv-back>&#9664; Home</button><div class="head-id"><div class="eyebrow">Your world</div><h2>'+xe(t)+"</h2></div></div>"}function Js(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="inventory">'+t+"</section></div>"}function en({section:t="relics",data:e=null,view:a={},state:r="ready"}={}){if(r!=="ready"||!e)return Js(Xs("Inventory")+'<div class="body"><div class="cols"><div class="pane"><div class="grid-empty">'+(r==="error"?"Couldn&rsquo;t read your inventory.":"Reading what you hold&hellip;")+"</div></div></div></div>");let s=e.counts||{},n=Ta.filter(o=>o.live),i=n.find(o=>o.key===t)||n[0]||Ta[0],l=e.relicBand||{},h=e.materials&&e.materials.ascension||{},p='<div class="rail">'+Ta.map(o=>'<button class="sect" type="button"'+(o.live?' aria-pressed="'+(o.key===i.key?"true":"false")+'" data-inv-section="'+o.key+'"':" disabled")+'><span class="k">'+xe(o.kicker)+'</span><span class="n">'+xe(o.label)+"<i>"+(o.live?at(s[o.count]):"&mdash;")+"</i></span>"+(o.live?"":'<span class="soon">Not open yet</span>')+"</button>").join("")+"</div>";return Js(Xs("Inventory")+'<div class="body"><div class="cols">'+p+'<div class="pane">'+(i.key==="relics"?ql(e,a):Hl(e))+"</div></div>"+""+"</div>")}function tn(t,{onBack:e,onSection:a,onFilter:r,onPick:s,onLock:n,onUpgrade:i,onFeedPick:l,onFeedGo:h,onFeedCancel:p}){let d=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);d.length||d.push(t);let o=u=>{let f=u&&u.target&&u.target.closest?u.target:null;if(!f)return;if(f.closest("[data-inv-feed-go]")){!f.closest("[data-inv-feed-go]").disabled&&h&&h();return}if(f.closest("[data-inv-feed-cancel]")){p&&p();return}let v=f.closest("[data-inv-feed-pick]");if(v){!v.disabled&&l&&l(v.getAttribute("data-inv-feed-pick"));return}if(f.closest("[data-inv-back]")){e&&e();return}let w=f.closest("[data-inv-section]");if(w){a&&a(w.getAttribute("data-inv-section"));return}let g=f.closest("[data-inv-filter]");if(g){r&&r(g.getAttribute("data-inv-filter"),g.getAttribute("data-value"));return}let x=f.closest("[data-inv-lock]");if(x){n&&n(x.getAttribute("data-inv-lock"));return}let S=f.closest("[data-inv-upgrade]");if(S&&!S.disabled){i&&i(S.getAttribute("data-inv-upgrade"));return}let A=f.closest("[data-inv-pick]");A&&s&&s(A.getAttribute("data-inv-pick"))};for(let u of d)u.addEventListener("click",o)}var Na=[{id:"login",kind:"login",label:"7 Day Login Event",note:"Permanent",live:!0},{id:"pass",kind:"pass",label:"Battle Pass",note:"Season \xB7 30 days",live:!0},{id:"seasonal",kind:"seasonal",label:"Seasonal Event",note:"Not open yet",live:!1}];var rn=30,nh=rn*24*60*60*1e3,Aa=80;var $l={"farm-clear":{one:"Clear a Materials stage",many:"Clear N Materials stages"},"node-clear":{one:"Clear a combat node",many:"Clear N combat nodes"},"story-clear":{one:"Play a story node",many:"Play N story nodes"},summon:{one:"Summon once",many:"Summon N times"},"level-up":{one:"Level a unit once",many:"Level a unit N times"},"form-up":{one:"Train an ability once",many:"Train an ability N times"},ascend:{one:"Ascend a unit",many:"Ascend a unit N times"},"relic-feed":{one:"Reinforce a relic",many:"Reinforce a relic N times"},"vigor-spent":{one:"Spend 1 Vigor",many:"Spend N Vigor"}};function sn(t){let e=$l[t&&t.kind];if(!e)return"";let a=Math.max(1,Math.round(Number(t&&t.need)||1));return a===1?e.one:e.many.replace("N",String(a))}var jl=5,Ul=1e3,Vl=[20,40,60,75],Wl=t=>t<=26?{tier:"shard",qty:3,name:"Insight Shard"}:t<=53?{tier:"core",qty:2,name:"Insight Core"}:{tier:"prism",qty:1,name:"Insight Prism"},Gl=t=>t<=26?1:t<=53?2:3;var an=["funds","xp","sigil","doctrine","tenet"],Yl=(()=>{let t=[],e={};for(let a=1;a<=Aa;a+=1){let r=a%jl===0?Ul:0;if(a===Aa){t.push({level:a,aether:r,extra:{kind:"relic",qty:1,rarity:5,name:"5&#9733; Relic"},prize:!0});continue}if(Vl.includes(a)){t.push({level:a,aether:r,extra:{kind:"mandate",qty:1,name:"Mandate"},prize:!0});continue}if(r){t.push({level:a,aether:r,extra:{kind:"aether",qty:r,name:"Aether"}});continue}let s=an[t.filter(n=>!n.aether&&n.extra.kind!=="mandate").length%an.length];if(e[s]=(e[s]||0)+1,s==="funds")t.push({level:a,aether:r,extra:{kind:"funds",qty:8e3,name:"Funds"}});else if(s==="xp"){let n=Wl(a);t.push({level:a,aether:r,extra:{kind:"xp",tier:n.tier,qty:n.qty,name:n.name}})}else{let n=s==="tenet"?2:4;t.push({level:a,aether:r,extra:{kind:s,qty:n,tier:Gl(a),pick:e[s]-1}})}}return t})();function $e(t){return String(Math.round(Number(t)||0)).replace(/\B(?=(\d{3})+(?!\d))/gu,",")}function Le(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}var ln=`
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
.ev-card .ev-card-id i { font-style: normal; font-size: var(--t-tiny); letter-spacing: 0.1em; color: var(--steel-faint); }
/* A MARK, not a sentence: the dot says something here can be claimed, the one thing the rail cannot
   say with the name. State by shape, not by paragraph. */
.ev-card .dot { flex: none; width: calc(var(--f) * 0.5); height: calc(var(--f) * 0.5); border-radius: 99px; background: var(--coral); }

/* -- The event pane -- the Summon splash box: ink-3 edge, wide chamfer, plate shadow. */
/* THE PANE IS NOT A PLATE, and only looking shows it: the Summon splash reads because ART fills it;
   with no art this was an ink-2 plate holding ink-2 cards, both measured rgb(14,20,32), so a
   normal card was invisible as a card. Inventory is the fix: a TRANSPARENT pane whose plates are
   the CARDS, resting on the stage gradient. */
/* THE PANE IS THE SCROLLING REGION (user request). The house rule stands: the SCREEN does not scroll,
   the bar and the rail stay put. Measured with the bug in at 1440x960 the pane held 663px with
   children asking 685, so the Claim button fell 22px below it (37 at 175%); on a phone --f hits
   its 7.5px floor and the mission block got ZERO height. Shrinking has a floor; scrolling does
   not. */
.ev-pane {
  flex: 1 1 auto; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; gap: var(--sp-2);
  overflow-y: auto; overflow-x: hidden;
  /* The scroll gutter comes out of padding, as in the rail: without it the bar eats content width and
     the mission columns stop measuring alike. */
  padding-right: calc(var(--f) * 0.3);
}

/* The data row: what EVERY day pays, and when the week resets. */
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

/* On the SCREEN the week wraps to two rows, and that is measurement, not taste: one row left 514px of
   air inside the pane, and stretching gave 146x650 splinters. Two rows SHARE the height. The MODAL
   keeps seven across: there the panel sizes to its content and the row is what a login says at a
   glance. One board, two presentations. */
/* Four up, three down, centred: an EIGHT-column grid with each card spanning two, so the second row
   starts half a card in and centres itself with no hand-written numbers. Giving day 7 the two
   spare cells made a 528x293 box with a 70px glyph: an empty card, not a big one. */
.ev-pane .ev-week { grid-template-columns: repeat(8, minmax(0, 1fr)); grid-auto-rows: minmax(min-content, 1fr); align-content: stretch; }
.ev-pane .ev-slot { grid-column: span 2; }
.ev-pane .ev-slot:nth-child(5) { grid-column: 2 / span 2; }
/* And the content FILLS the card: the first pass had the glyph at 27% of the width and the content at
   46% of the height. The pane's hole moved inside the card, and it closes the same way: by
   filling, never by adding pieces. */
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
/* The NAME of what a day pays: a glyph with a number does not say what you receive (user rule). A
   figure without its noun is as useless as a noun without its figure. And it WRAPS, never
   truncates: a line clamp lies as soon as text scales. */
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
/* Measured: the sunk ground did not exist. Claimed against normal gave 1.14:1, because the theme's
   inks are near black in all five styles. What reads is the card LOSING ITS EDGE plus an inset
   shadow; the text drops to steel-faint, an OPAQUE colour (6.6:1 in the worst style): the rule is
   against transparency, not hierarchy. */
.ev-day.done { background: var(--ink); border-color: transparent; box-shadow: inset 0 calc(var(--f) * 0.15) calc(var(--f) * 0.6) rgba(0,0,0,0.55); }
.ev-day.done .glyph { color: var(--steel-dark); }
.ev-day.done .amt, .ev-day.done .what { color: var(--steel-faint); }
/* The tick sits in the CORNER: centred and large it fought the glyph and the figure. */
/* display: block with a line-height box: as an inline span the glyph overflowed its own box by 2px
   and the clip meter counted it. */
.ev-day .tick { position: absolute; top: calc(var(--f) * 0.25); right: calc(var(--f) * 0.4); display: block; font-size: var(--t-sm); line-height: 1.25; color: var(--jade); }

.ev-foot { flex: none; display: flex; align-items: center; gap: var(--sp-2); }
/* What is granted is SHOWN: day 7 drops a RELIC that appears nowhere else on this screen. It goes in
   the foot, beside the button the player just pressed, never in a band narrating what is already
   visible. */
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

/* An event not yet open: the pane says what it is and nothing more. */
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
/* The LADDER is the elastic region (user request) and the mission block holds a fixed height: the
   same split as the Home, where the dock has no height of its own and the scene pays the
   difference. Earlier passes had the weight reversed, 153px of ladder against 526 of missions. */
/* Height falls out of the TWO rows of squares: with the card tied to its ratio and the column width
   fixed, ladder height is a consequence, not a knob. */
.pv-track { flex: 0 0 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; padding-bottom: calc(var(--f) * 0.3); }
/* TWO rows, a consequence of the square card: the only way more room means BIGGER cards rather than
   taller ones is stacking two. Column flow (1 up, 2 down, 3 up...) keeps progress reading left to
   right, and 80 levels show twelve at once instead of six. */
/* The column carries an EXPLICIT width. Without it the track must solve width-from-height and height-
   from-content at once: circular, browser-defined, and names came out cut in half (Warblade
   Doctr). The Home plate's trap, walked into again when the rail moved from flex to grid. */
.pv-rail { display: grid; grid-auto-flow: column; grid-auto-columns: calc(var(--f) * 13); grid-template-rows: repeat(2, auto); gap: calc(var(--f) * 0.5) calc(var(--f) * 0.4); width: max-content; }
.pv-slot { min-height: 0; display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.25); }
.pv-n { font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }

/* A level is the SAME card as a login rung, small: glyph, figure and NAME. A glyph with a number does
   not say what you receive. */
.pv-lvl {
  position: relative; width: 100%; min-width: 0;
  /* SQUARE, not rectangular (user request): width COMES FROM height via the ratio, so more ladder
     room grows the card instead of stretching it. FLEX, never an auto grid track, which would
     have to solve the circular pair. */
  aspect-ratio: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--f) * 0.2); padding: calc(var(--f) * 0.5) calc(var(--f) * 0.25);
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
  border: 1px solid var(--ink-3); border-top: 2px solid var(--steel-dark);
  --cut: 0.4em; clip-path: var(--clip-card); border-radius: var(--radius-sm);
  text-align: center;
}
/* Every child is capped to the card: a flex-column item will not shrink below max-content, so text
   overflowed, and clip-path CUT IT SILENTLY. A clip-path cut never shows in scrollWidth, so the
   meter read ZERO over a ladder with half its names cut. The user saw it; the measurement did not. */
.pv-lvl > * { max-width: 100%; min-width: 0; }
.pv-lvl .glyph { width: 44%; max-width: calc(var(--f) * 4.6); height: auto; color: var(--steel); flex: none; }
.pv-lvl .amt { font-family: var(--display); font-size: var(--t-md); color: var(--text); font-variant-numeric: tabular-nums; }
/* line-height 1.3, not 1.15: tighter than the font's natural box the span overflows itself by 2px and
   EVERY clip check fires, 67 false alarms at once. A long name WRAPS. */
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
/* The mission block PREFERS what its tabs and grid measure, the spare belongs to the ladder, but it
   MUST give way when room runs out: measured, the Claim button fell 22px below the pane (37 at
   175%) with all four children flex none. So flex 0 1 auto: never grows, does shrink. And NO min-
   height 0: a flex item's default min-height is min-content, exactly the floor this block needs;
   with the zero it shrank to NOTHING on a phone with every measurement green. What does not fit
   past that floor scrolls in the PANE. */
.pv-missions { flex: 0 1 auto; min-width: 0; display: flex; flex-direction: column; gap: calc(var(--f) * 0.5); }
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

/* The list prefers a FIXED height, two rows of cards, so switching tabs cannot resize the ladder
   above it. CONTAINED scroll (user request). And minmax(min-content, 1fr), NOT minmax(0, 1fr):
   with the zero a row shrinks below its card and the card is CUT SILENTLY by overflow hidden plus
   the plate's clip-path. Measured on Season: eight cards drew 72px asking 89, eating their own
   padding, with every meter green. With min-content the list grows to what its cards need and the
   PANE scrolls the rest, once, in one place. */
.pv-list {
  flex: 0 1 auto; height: calc(var(--f) * 12); min-width: 0; margin: 0; padding: 0; list-style: none;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(min-content, 1fr)); gap: calc(var(--f) * 0.5);
}
/* A four-mission drawer spans both rows: four tall cards instead of four flat ones over a row of air. */
.pv-list.few .pv-m { grid-row: span 2; }

/* A mission is a CARD, not a line: the big figure is what reads at a glance, and the bar rides with
   it. */
.pv-m {
  min-width: 0; overflow: hidden;
  /* NOTHING absolute inside the card: the XP tag was absolutely placed and the mission text ran UNDER
     it. No meter sees two children overlapping inside their own box; the user did. In a grid
     with a row and a column each, two children cannot overlap by construction. */
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
/* --t-md, not --t-lg: with EIGHT season missions the cards drew 81px with content asking 87. The
   figure stays the biggest thing on the card without forcing a stretch; the fullest drawer sets
   the size. */
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

/* -- THE HOME MODAL -- the house panel, same as the Home picker (hm-pk in styles.js): opaque over
   ink, ink-3 edge, coral top edge and chamfer. A translucent panel composes against the stage and
   shifts per style, aurora and signal surfaces being glass, and the Home bleeds through. */
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
`,cn=ln,dn=`
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
`+ln;function Kl(t,e,a){let r=t.day<=e,s=!r&&t.day===e+1;return'<div class="ev-slot"><div class="'+["ev-day",t.prize?"prize":"",r?"done":"",s&&a?"next":""].filter(Boolean).join(" ")+'">'+Ie(t.extra.kind)+'<span class="amt">'+$e(t.extra.qty)+'</span><span class="what">'+t.extra.name+"</span>"+(r?'<span class="tick">&#10003;</span>':"")+'</div><span class="ev-n">Day '+t.day+"</span></div>"}function hn(t,e,a){return'<div class="ev-week">'+t.map(r=>Kl(r,e,a)).join("")+"</div>"}function pn(t,e,a,r){let s=Number(t[0]&&t[0].aether)||0,n=Number(e),i=Number.isFinite(n)?n<=0?"Resets tonight":"Resets in <b>"+n+"</b>"+(n===1?" day":" days"):"";return'<div class="ev-top">'+(a?'<h3 class="ev-title">'+Le(a)+"</h3>":"")+'<span class="ev-every">'+Ie("aether")+"<b>"+$e(s)+'</b><span>Aether daily</span></span><span class="ev-when">'+i+"</span>"+(r||"")+"</div>"}function Ca(t){return!Array.isArray(t)||!t.length?"":'<span class="ev-gained"><span class="k">Claimed</span>'+t.map(e=>'<span class="it">'+Ie(e.kind)+"<b>"+$e(e.qty)+"</b> "+e.material+"</span>").join("")+"</span>"}function fn(t,e){let a=t?"Claim":e?"All claimed":"Claimed today";return'<button class="ev-claim" type="button" data-events-claim'+(t?"":" disabled")+">"+a+"</button>"}function un(t){let e=t||{},a=Array.isArray(e.rungs)?e.rungs:[],r=Math.max(0,Number(e.claimed)||0);return{rungs:a,claimed:r,ready:!!e.ready,full:a.length>0&&r>=a.length,resetsIn:e.resetsIn,gained:Array.isArray(e.gained)?e.gained:[]}}function Xl(t){let e=Math.max(0,Math.round(Number(t)||0)),a=Math.floor(e/864e5),r=Math.floor(e%864e5/36e5);if(a>0)return a+"d "+r+"h";let s=Math.floor(e%36e5/6e4);return r>0?r+"h "+s+"m":s+"m"}function Jl(t){let e=t&&typeof t=="object"?t:{},a=r=>({...r&&typeof r=="object"?r:{},xp:Math.max(0,Number(r&&r.xp)||0),missions:Array.isArray(r&&r.missions)?r.missions:[]});return{...e,seq:Math.max(1,Math.round(Number(e.seq)||1)),level:Math.max(0,Math.round(Number(e.level)||0)),max:Math.max(1,Math.round(Number(e.max)||1)),xpInto:Math.max(0,Number(e.xpInto)||0),xpPerLevel:Math.max(1,Number(e.xpPerLevel)||1),endsInMs:Number(e.endsInMs)||0,rewards:Array.isArray(e.rewards)?e.rewards:[],claimable:Array.isArray(e.claimable)?e.claimable:[],rerollsLeft:Math.max(0,Math.round(Number(e.rerollsLeft)||0)),daily:a(e.daily),weekly:a(e.weekly),season:a(e.season),gained:Array.isArray(e.gained)?e.gained:[]}}function Zl(t,e){let a=t.level>e;return'<div class="pv-slot"><div class="'+["pv-lvl",t.prize?"prize":"",t.claimed?"done":"",a?"off":"",!a&&!t.claimed?"ready":""].filter(Boolean).join(" ")+'">'+Ie(t.extra.kind)+'<span class="amt">'+$e(t.extra.qty)+'</span><span class="what">'+t.extra.name+"</span>"+(t.aether>0?'<span class="ae">+'+$e(t.aether)+"</span>":"")+(t.claimed?'<span class="tick">&#10003;</span>':"")+'</div><span class="pv-n">'+t.level+"</span></div>"}function Ql(t){let e=Math.max(0,Math.round(Number(t)||0));if(!e)return"";let a=Math.floor(e/36e5);return a>=24?Math.floor(a/24)+"d "+a%24+"h":a>=1?a+"h":Math.max(1,Math.round(e/6e4))+"m"}function ec(t,e){let a=s=>s.missions.filter(n=>n.paid||n.done>=n.need).length,r=(s,n,i)=>{let l=Ql(i.resetsInMs);return'<button class="pv-tab" type="button" data-pass-tab="'+s+'" aria-pressed="'+(s===e)+'"><span class="k">'+n+'</span><span class="ct">'+a(i)+"/"+i.missions.length+"</span>"+(l?'<span class="rs">'+l+"</span>":"")+"</button>"};return r("daily","Daily",t.daily)+r("weekly","Weekly",t.weekly)+r("season","Season",t.season)}function tc(t){let e=t.missions.length<=4,a=t.missions.map(r=>{let s=Math.max(1,Number(r.need)||1),n=Math.min(s,Math.max(0,Number(r.done)||0));return'<li class="pv-m'+(!!r.paid||n>=s?" done":"")+'" data-mission="'+Le(r.id)+'"><span class="xp">+'+t.xp+' XP</span><span class="tx">'+sn(r)+'</span><span class="ct"><b>'+n+"</b>/"+s+'</span><span class="bar"><i style="width:'+Math.round(n/s*100)+'%"></i></span></li>'}).join("");return'<ul class="pv-list'+(e?" few":"")+'">'+(a||'<li class="pv-m empty"><span class="tx">Nothing here</span></li>')+"</ul>"}function ac(t,e,a){let r=Jl(t),s=Math.max(0,Math.min(100,Math.round(r.xpInto/r.xpPerLevel*100))),n=r.level>=r.max,i=r.claimable.length?"Claim "+r.claimable.length:n?"All claimed":"Nothing to claim",l='<button class="pv-reroll" type="button" data-pass-reroll'+(r.rerollsLeft>0?"":" disabled")+">Reroll "+r.rerollsLeft+"</button>",h=r[a]?a:"daily";return'<div class="ev-pane pv"><div class="ev-top"><h3 class="ev-title">'+Le(e)+'</h3><span class="pv-season">Season <b>'+r.seq+'</b></span><span class="pv-lv">Lv <b>'+r.level+"</b>/"+r.max+'</span><span class="pv-xp"><span class="bar"><i style="width:'+s+'%"></i></span><b>'+$e(r.xpInto)+"</b>/"+$e(r.xpPerLevel)+' XP</span><span class="ev-when">Ends in <b>'+Xl(r.endsInMs)+'</b></span></div><div class="pv-track"><div class="pv-rail">'+r.rewards.map(p=>Zl(p,r.level)).join("")+'</div></div><div class="pv-missions"><div class="pv-tabs">'+ec(r,h)+(h==="daily"?l:"")+"</div>"+tc(r[h])+'</div><div class="ev-foot">'+Ca(r.gained)+'<button class="ev-claim" type="button" data-pass-claim'+(r.claimable.length?"":" disabled")+">"+i+"</button></div></div>"}var nn={login:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8.5 14.5l2 2 4-4"/></svg>',seasonal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/></svg>'},on=t=>nn[String(t)]||nn.seasonal;function rc(t,e,a){let r=Le(t.id);return t.live===!1?'<button class="ev-card" type="button" aria-disabled="true" data-event="'+r+'"><span class="ic">'+on(t.kind)+'</span><span class="ev-card-id"><b>'+Le(t.label)+"</b><i>"+Le(t.note||"Not open yet")+"</i></span></button>":'<button class="ev-card" type="button" data-event="'+r+'" aria-pressed="'+(t.id===e)+'"><span class="ic">'+on(t.kind)+'</span><span class="ev-card-id"><b>'+Le(t.label)+"</b><i>"+Le(t.note||"")+"</i></span>"+(a?'<span class="dot"></span>':"")+"</button>"}function vn({slots:t,eventId:e,view:a,from:r="Home",passTab:s="daily"}={}){let n=Array.isArray(t)&&t.length?t:Na,i=n.filter(o=>o.live!==!1),l=i.find(o=>o.id===e)||i[0]||null,h=un(a),p='<div class="ev-rail"><div class="ev-rail-scroll">'+n.map(o=>rc(o,l&&l.id,o.kind==="login"&&h.ready)).join("")+"</div></div>",d;return l?l.kind==="pass"?d=ac(a,l.label,s):d='<div class="ev-pane">'+pn(h.rungs,h.resetsIn,l.label)+hn(h.rungs,h.claimed,h.ready)+'<div class="ev-foot">'+Ca(h.gained)+fn(h.ready,h.full)+"</div></div>":d='<div class="ev-pane"><div class="ev-soon"><span class="k">Nothing running</span><span class="h">No events open right now</span></div></div>','<div class="root"><div class="stage"></div><section class="screen" data-screen="events"><div class="head"><button class="back" type="button" data-events-back>&#9664; '+Le(r)+'</button><div class="head-id"><div class="eyebrow">Command</div><h2>Events</h2></div></div><div class="body"><div class="ev-cols">'+p+d+"</div></div></section></div>"}function gn({view:t}={}){let e=un(t);return'<div class="ev-modal" data-events><div class="ev-veil"></div><div class="ev-panel">'+pn(e.rungs,e.resetsIn,"7 Day Login Event",'<button class="ev-x" type="button" data-events-close aria-label="Close">Close</button>')+hn(e.rungs,e.claimed,e.ready)+'<div class="ev-foot">'+Ca(e.gained)+fn(e.ready,e.full)+"</div></div></div>"}function mn(t,{onBack:e,onPick:a,onClaim:r,onTab:s,onReroll:n}={}){let i=t.querySelector("[data-events-back]");i&&e&&i.addEventListener("click",()=>e());let l=t.querySelector("[data-events-claim]");l&&r&&l.addEventListener("click",()=>r());let h=t.querySelector("[data-pass-claim]");if(h&&r&&h.addEventListener("click",()=>r()),s)for(let d of["daily","weekly","season"]){let o=t.querySelector('[data-pass-tab="'+d+'"]');o&&o.addEventListener("click",()=>s(d))}let p=t.querySelector("[data-pass-reroll]");if(p&&n&&p.addEventListener("click",()=>{let d=t.querySelector(".pv-m:not(.done)[data-mission]");d&&n(d.getAttribute("data-mission"))}),a)for(let d of Na){let o=t.querySelector('[data-event="'+d.id+'"]');o&&d.live!==!1&&o.addEventListener("click",()=>a(d.id))}}function bn(t,{onClose:e,onClaim:a}={}){let r=t.querySelector("[data-events-close]");r&&e&&r.addEventListener("click",()=>e());let s=t.querySelector("[data-events-claim]");s&&a&&s.addEventListener("click",()=>a());let n=t.querySelector(".ev-veil");n&&e&&n.addEventListener("click",()=>e())}function yn(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function vt(t){return(Number(t)||0).toLocaleString("en-US")}function wn(t){if(!t)return[];let e=[];Number(t.funds)>0&&e.push({kind:"funds",qty:Number(t.funds),name:"Funds"}),Number(t.aether)>0&&e.push({kind:"aether",qty:Number(t.aether),name:"Aether"});let a=t.insight||{},r={shard:"Insight Shard",core:"Insight Core",prism:"Insight Prism"};for(let s of["shard","core","prism"])Number(a[s])>0&&e.push({kind:"xp",qty:Number(a[s]),name:r[s]});return e}function xn(t){return t?t.relic?[]:[{kind:/Funds/i.test(String(t.material))?"funds":/Insight/i.test(String(t.material))?"xp":"asc",qty:Number(t.qty)||0,name:String(t.material||"")}]:[]}var kn=Ht+`
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
.rs-rank .rs-up { display: none; align-items: center; gap: calc(var(--f) * 0.4); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: var(--case); color: var(--amber); }
.rs-rank.leveled .rs-up { display: flex; }
.rs-rank .rs-up b { color: var(--text); font-variant-numeric: tabular-nums; }

.rs-acts { flex: none; display: flex; gap: var(--sp-2); margin-top: var(--sp-1); }
.rs-acts button { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.55) var(--sp-3); background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.rs-acts button:hover { background: var(--coral-deep); border-color: var(--coral-deep); }
.rs-acts button.ghost { background: transparent; border-color: var(--steel-dark); color: var(--text); }
.rs-acts button.ghost:hover { border-color: var(--amber); color: var(--amber); }
`;function sc(t){return'<div class="rs-rw"><span class="rs-ic">'+Ie(t.kind)+'</span><span class="rs-q">'+(Number(t.qty)>0?"+"+vt(t.qty):vt(t.qty))+'</span><span class="rs-n">'+yn(t.name)+"</span></div>"}function Ia(t,e){let a=Number(e);return!Number.isFinite(a)||a<=0?100:Math.max(0,Math.min(100,Math.round(Number(t)/a*1e3)/10))}function _n({outcome:t="win",where:e="",rewards:a=[],relic:r=null,rank:s=null,canReplay:n=!1}={}){let i=t!=="lose",l=Array.isArray(a)?a:[],h=s&&s.from||null,p=h?Ia(h.xp,h.xpNeeded):s?Ia(s.xp,s.xpNeeded):0,d=s?Ia(s.xp,s.xpNeeded):0,o=Number(s&&s.levels)||0;return'<div class="root'+(i?"":" lose")+'"><div class="stage"></div><section class="screen" data-screen="result"><div class="rs-verdict"><h2>'+(i?"Victory":"Defeat")+"</h2>"+(e?'<span class="rs-where">'+yn(e)+"</span>":"")+"</div>"+(r?'<div class="rs-piece"><div class="rs-cap">A piece from the Vault</div>'+$t(r,{actions:!1})+"</div>":"")+(l.length?'<div class="rs-loot">'+l.map(sc).join("")+"</div>":r?"":'<div class="rs-none">'+(i?"Nothing dropped here &mdash; this node pays in progress, not in materials.":"You keep nothing. The Vigor was spent when the stage started, so a loss costs the run.")+"</div>")+(s?'<div class="rs-rank'+(o>0?" leveled":"")+'" data-rank data-start="'+p+'" data-end="'+d+'" data-levels="'+o+'"><div class="rs-top"><span>Commander</span><b data-rank-level>'+Number(s.level)+'</b><span class="rs-gain">+'+vt(s.gain)+' XP</span></div><div class="rs-track"><i data-rank-bar style="width:'+p+'%"></i></div><div class="rs-foot"><span data-rank-xp>'+vt(s.xp)+" / "+(s.xpNeeded===null||s.xpNeeded===void 0?"&mdash;":vt(s.xpNeeded))+" XP</span><span>"+(s.xpNeeded===null||s.xpNeeded===void 0?"At the rank cap":"to Commander "+(Number(s.level)+1))+"</span></div>"+(Number(s.vigorMax)>0&&Number(s.from&&s.from.vigorMax)>0?'<div class="rs-up">Vigor <b>'+Number(s.from.vigorMax)+" &rarr; "+Number(s.vigorMax)+"</b></div>":"")+"</div>":"")+'<div class="rs-acts">'+(n?'<button class="ghost" type="button" data-result-again>Run it again</button>':"")+'<button type="button" data-result-continue>Continue &rsaquo;</button></div></section></div>'}function Sn(t,{onContinue:e,onAgain:a}={}){(t.querySelector(".root")||t).addEventListener("click",d=>{let o=d&&d.target&&d.target.closest?d.target:null;if(o){if(o.closest("[data-result-again]")){a&&a();return}o.closest("[data-result-continue]")&&e&&e()}});let s=t.querySelector("[data-rank]"),n=t.querySelector("[data-rank-bar]");if(!s||!n)return;let i=Number(s.getAttribute("data-end"))||0,l=Number(s.getAttribute("data-levels"))||0,h=(d,o)=>{typeof setTimeout=="function"&&setTimeout(o,d)},p=d=>{n.style&&(n.style.width=d+"%")};if(l>0){h(30,()=>p(100)),h(900,()=>{n.style&&(n.style.transition="none"),p(0),h(30,()=>{n.style&&(n.style.transition=""),p(i)})});return}h(30,()=>p(i))}function En(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var nc=[{match:/:chapter:(\d+)$/,cost:"tokens",label:t=>`Forging chapter ${t[1]}`},{match:/:combat:(\d+):(\d+)$/,cost:"tokens",label:t=>`Designing a fight \xB7 chapter ${t[1]}`},{match:/:beat:(\d+):(\d+)$/,cost:"tokens",label:()=>"Writing the next scene"},{match:/:banner:char:/,cost:"tokens",label:()=>"Minting this week's characters"},{match:/:banner:wpn:/,cost:"tokens",label:()=>"Minting this week's weapons"},{match:/:banner:standard$/,cost:"tokens",label:()=>"Forging the founding cast"},{match:/:banner-art:/,cost:"images",label:()=>"Painting the banner"},{match:/:portrait$/,cost:"images",label:()=>"Painting a portrait"},{match:/:bg:/,cost:"images",label:()=>"Painting a location"},{match:/:unit:protagonist-weapon$/,cost:"tokens",label:()=>"Forging their signature weapon"},{match:/:unit:protagonist$/,cost:"tokens",label:()=>"Building your unit"}],ic=[{at:"/banner",cost:"tokens",label:"Forging the founding cast"},{at:"/summon-banner",cost:"tokens",label:"Checking this week's banner"},{at:"/chapter-plan",cost:"tokens",label:"Forging the chapter"},{at:"/combat-guide",cost:"tokens",label:"Designing a fight"},{at:"/beat",cost:"tokens",label:"Writing the next scene"},{at:"/compress",cost:"tokens",label:"Compressing a chapter"},{at:"/protagonist",cost:"tokens",label:"Building your unit"},{at:"/portrait/upload",cost:"images",label:"Sending your image"},{at:"/portrait",cost:"images",label:"Painting a portrait"},{at:"/background",cost:"images",label:"Painting a location"},{at:"/banner-art",cost:"images",label:"Painting the banner"}],oc=["/portrait/select"];function Tn(t){let e=String(t||"");if(oc.includes(e))return null;for(let a of ic)if(e===a.at||e.startsWith(a.at+"/"))return{cost:a.cost,label:a.label};return null}function lc(t){let e=String(t||"");for(let a of nc){let r=e.match(a.match);if(r)return{cost:a.cost,label:a.label(r)}}return e?{cost:"tokens",label:"Generating"}:null}function cc(t){let e=Number(t&&t.total)||0;if(!e)return null;let a=Math.min(e,Number(t.done)||0);return{cost:"images",label:t&&t.name?`Painting ${t.name}`:"Painting portraits",detail:`${a+1} of ${e}`}}function An({generating:t=[],local:e=[],art:a=null,background:r=null}={}){let s=[],n=new Set,i=l=>{!l||n.has(l.label)||(n.add(l.label),s.push(l))};for(let l of Array.isArray(e)?e:[])i(l);for(let l of Array.isArray(t)?t:[])i(lc(l));return i(cc(a)),r&&i({cost:"images",label:"Painting a location",detail:String(r)}),s}function Nn(t){return(Array.isArray(t)?t:[]).map(e=>e.label+(e.detail||"")).join("|")}var Cn=`
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
`;function In(t,{max:e=2}={}){let a=Array.isArray(t)?t.filter(Boolean):[];if(!a.length)return"";let r=a.slice(0,e),s=a.length-r.length;return'<div class="gb-busy" data-busy aria-live="polite">'+r.map(n=>'<div class="gb-row '+(n.cost==="images"?"images":"text")+'"><span class="gb-dot"></span><span class="gb-what"><b>'+En(n.label)+"</b>"+(n.detail?" &middot; "+En(n.detail):"")+'</span><span class="gb-cost">'+(n.cost==="images"?"image":"tokens")+"</span></div>").join("")+(s>0?'<div class="gb-more">+'+s+" more running</div>":"")+"</div>"}function me(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Ln(t){return t>=5?"\u2605\u2605\u2605\u2605\u2605":t===4?"\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605"}function La(t){return String(t||"").split(",")[0].trim()}function jt(t){let e=Number(t)||0;return(e*100>=10,(e*100).toFixed(1)).replace(/\.0$/,"")+"%"}var dc={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',material:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><path d="M50 20 78 52 50 110 22 52Z"/><path d="M50 20 50 110M22 52h56" stroke="#0E1420" stroke-opacity="0.35" stroke-width="3"/></g></svg>'};var Ra='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="#F0B429" stroke="#B8860B" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2 7 12l5 10" stroke="#FFF" stroke-opacity="0.5" stroke-width="1.2"/></svg>',hc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="var(--on-coral)" stroke="var(--on-coral)" stroke-width="1.4" stroke-linejoin="round"/></svg>',pc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';var fc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" stroke="currentColor" stroke-width="1.8"/></svg>',uc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ma='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-ssil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',za=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */



  --sp-1: calc(var(--f) * 0.5); --sp-2: calc(var(--f) * 1.0); --sp-3: calc(var(--f) * 1.6); --sp-4: calc(var(--f) * 2.4);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 10%, var(--glow-1) 0%, transparent 60%), radial-gradient(80% 60% at 8% 92%, var(--glow-2) 0%, transparent 64%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
/* The head is NOT always here. hoistHeadIntoBar MOVES it into the shell's top bar and
   calls head.remove(), so this box is normally left holding ONE child: the body. With a fixed
   auto 1fr template that child auto-places into row 1 \u2014 the AUTO one \u2014 and sizes itself to its
   own content instead of to the screen. That is what made the character sheet's portrait plate a
   different height on every tab (Bond 231px, Profile ~700px: measured on screen) and what left
   the dead band under Summon. No harness could reproduce it either, because a harness renders
   the screen standalone and never hoists.
   :has() gives the second row only while the head is actually present. */
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

/* \u2500\u2500 Banner \u2500\u2500 */
/* BANNERS ARE A LIST, NOT A MATRIX. This was two category tabs by two pool tabs, written by
   hand: a fifth banner had nowhere to go. The left rail draws whatever the server sends, and
   adding a banner no longer touches this screen.
   The row must be pinned: an implicit auto row sizes to its CONTENT, and this box used to end
   where the content did, leaving the rest of the stage empty. */
.banner-body { min-height: 0; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: var(--sp-2); padding: var(--sp-1) var(--sp-3) var(--sp-3); }

/* The rail. Fixed width in ramp units, so a long title cannot eat it. */
.rail { width: calc(var(--f) * 21); min-width: 0; min-height: 0; display: flex; }
/* CONTAINED region: the screen does not scroll, this list does \u2014 inside its own box, which is
   what the house rule allows. Without min-height 0 the flex item will not shrink and the scroll
   escapes to the parent. */
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
/* The pity ON the card, with its number: there are four separate counters per world, and a
   bar alone is a qualitative sentence. */
.bt-pity { display: flex; align-items: center; gap: calc(var(--f) * 0.35); min-width: 0; }
.bt-track { flex: 1; min-width: 0; height: calc(var(--f) * 0.28); background: var(--ink-3); border-radius: 99px; overflow: hidden; }
.bt-track > i { display: block; height: 100%; background: var(--coral); }
.bt-pity em { font-style: normal; font-size: calc(var(--f) * 0.62 * var(--gf-type-scale, 1)); letter-spacing: 0.06em; color: var(--steel-faint); white-space: nowrap; }

/* The splash: the art takes the whole area and the controls float on top. */
.show { position: relative; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--ink-3); --cut: 0.9em; clip-path: var(--clip-card); border-radius: var(--radius); background: radial-gradient(120% 90% at 70% 0%, #33507A 0%, var(--glow-2) 55%, #0E1725 100%); box-shadow: var(--panel-shadow), var(--panel-bevel); }
/* With banner art, cover is CORRECT: the image is born landscape for this box. Without it
   the only art is the 2:3 portrait, and cover eats the face \u2014 the width must come from the
   HEIGHT, the VN portrait's lesson. */
.art { position: absolute; inset: 0; overflow: hidden; }
.art.wide { background-size: cover; background-position: center 22%; }
/* The fallback when no art exists (new world, images off, failed generation): a plate at its
   own ratio over a blurred copy of itself. Never a hole, never a stretched portrait \u2014 a degraded
   state that looks broken is worse than one that looks deliberate. */
.artback { position: absolute; inset: calc(var(--f) * -3); background-size: cover; background-position: center 30%; filter: blur(calc(var(--f) * 1.6)) saturate(0.9); opacity: 0.55; }
.artback.flat { background: radial-gradient(70% 60% at 60% 30%, var(--glow-1) 0%, transparent 70%); opacity: 1; }
.plates { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: flex-end; padding-right: var(--sp-3); }
.plate { height: 78%; aspect-ratio: 2 / 3; background-size: cover; background-position: center top; border-radius: var(--radius); }
.plate.four { height: 54%; margin-right: calc(var(--f) * -1.2); order: -1; opacity: 0.92; }
.plate.sil { height: 74%; aspect-ratio: 3 / 4; display: grid; place-items: center; color: color-mix(in srgb, var(--epic) 60%, transparent); }
.plate.sil svg { width: 100%; height: 100%; }
/* The veil rises from BELOW (for the controls) and falls from ABOVE (for the name): generated
   art can be pale, and without this the label disappears. */
.veil { position: absolute; inset: 0; background: linear-gradient(0deg, color-mix(in srgb, var(--ground-2) 94%, transparent) 0%, color-mix(in srgb, var(--ground-2) 72%, transparent) 26%, transparent 55%), linear-gradient(180deg, color-mix(in srgb, var(--ground-2) 82%, transparent) 0%, transparent 34%); }
/* THE VEIL FOLLOWS THE GLYPHS, NOT A BOX. The name is read over model-generated art and the
   sheet's veil above falls to a FIXED 34% while this block's height is VARIABLE, so a two-line
   title at 150% text drops the subtitle onto whatever was painted -- measured, text on bare white
   art is 1.13:1.
   A PANEL BEHIND THE TEXT WAS THE WRONG SHAPE. It works and the user threw it out on sight: a
   translucent band across the top third of the art, with its own hard edge where the gradient met
   the end of the box. What it has to darken is what is UNDER THE LETTERS, so the veil is the
   shadow itself -- two tight layers that hug the glyph and one wide one that lowers the ground
   around it, with nothing that has a border to notice. */
.bname { position: absolute; left: var(--sp-3); top: var(--sp-3); right: calc(var(--f) * 16); z-index: 2; }
.bname .kicker, .bname h3, .bname p { text-shadow: 0 1px 2px rgba(0,0,0,0.92), 0 0 6px rgba(0,0,0,0.85), 0 0 20px rgba(0,0,0,0.6); }
.bname .kicker { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.bname h3 { margin: calc(var(--f) * 0.15) 0 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-2xl); line-height: 1.0; letter-spacing: var(--track); text-transform: var(--case); color: var(--text); }
.bname p { margin: calc(var(--f) * 0.25) 0 0; font-size: var(--t-xs); color: var(--porcelain-3); }
/* The top-right chips: what the splash does NOT show lives behind Details, and redoing the art
   has a button of its own. */
.chips { position: absolute; right: var(--sp-3); top: var(--sp-3); z-index: 3; display: flex; gap: calc(var(--f) * 0.4); }
.chip { cursor: pointer; font-family: var(--display); font-size: calc(var(--f) * 0.78 * var(--gf-type-scale, 1)); letter-spacing: 0.14em; text-transform: var(--case); padding: calc(var(--f) * 0.35) var(--sp-2); background: color-mix(in srgb, var(--ink) 62%, transparent); border: 1px solid var(--steel-dark); color: var(--text); border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: calc(var(--f) * 0.35); }
.chip:hover { border-color: var(--coral); color: var(--coral); }
.chip[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.chip[aria-disabled="true"]:hover { border-color: var(--steel-dark); color: var(--text); }
.chip svg { width: calc(var(--f) * 1.0); height: calc(var(--f) * 1.0); }
/* The controls, floating over the art, anchored at the foot. */
.float { position: absolute; left: var(--sp-3); right: var(--sp-3); bottom: var(--sp-3); z-index: 2; display: flex; flex-direction: column; gap: calc(var(--f) * 0.7); }
/* Same reason as the name above: these read over generated art. The veil rising from the foot
   already carries them (0.72 to 0.94 alpha in this band, 6.3:1 or better over white), so what is
   added here is only the shadow that survives detail at letter scale. The BUTTONS are opaque
   plates of their own and need none. */
.float .rates, .float .pity .fig, .float .pity .note { text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.float .pulls { max-width: calc(var(--f) * 34); }

/* The Details sheet: the one thing the splash hides. It opens OVER the art \u2014 comparing the
   pool with the banner offering it is the point of looking. */
.sheet { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); background: color-mix(in srgb, var(--ground-2) 92%, transparent); backdrop-filter: var(--panel-blur); }
.sheet-head { display: flex; align-items: center; gap: var(--sp-2); flex: none; }
.sheet-head h4 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); }
.sheet-head .spacer { flex: 1; }
/* ONE scroll for the whole sheet body, never one per strip. With a scroll box per strip each one
   got HALF the height and shrank its cards until a card had to be scrolled inside its own row to be
   seen whole -- and the second strip was cut against the panel's floor. The strips now take their
   natural height and the region that holds them is the single thing that scrolls. */
.strips { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
.strip-label { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); flex: none; }
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
/* Generated unit art. Cropped rather than fitted: an image model returns whatever aspect it
   likes, and a letterboxed portrait in a card reads as a bug. Sits under the slot's badges. */
.u-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
/* z-index ONLY. Every one of these badges is already absolutely positioned by its own rule, so
   forcing position:relative here would drop them out of their corners \u2014 an absolutely positioned
   element takes a z-index without any help. */
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip, .u-art > .tag-new, .u-art > .kind-tag, .u-art > .pill-up { z-index: 1; }
.u-art > .u-stars, .u-art > .u-lvl, .u-art > .bond-pip { text-shadow: 0 1px 3px rgba(0,0,0,0.7); }
/* The showcase art replaces the big silhouette entirely, so it can bleed off the right edge
   the way the silhouette did and still be readable behind the name plate. */
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
   on a unit you already have, and reading it as "NEW" is the one thing it must not say. --amber
   over --ink is dark-on-light in all five styles (9.9 to 14.4 : 1), the same pair the Ascend
   button already uses, so no new token joins the contract for one badge. */
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
/* Derived from the button's own text colour, never a fixed tint: this was #FFE6DE, a near
   white pink chosen against coral, and on a style whose accent is lime it became unreadable. */
.pull.ten .cost { color: color-mix(in srgb, var(--on-coral) 82%, transparent); }
.pull[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.pull[aria-disabled="true"]:hover { background: transparent; color: var(--text); border-color: var(--steel); }
.pull.ten[aria-disabled="true"]:hover { background: var(--coral); color: var(--on-coral); }

/* \u2500\u2500 Weapons "coming" panel \u2500\u2500 */
.soon-panel { min-height: 0; display: grid; place-items: center; text-align: center; gap: var(--sp-2); padding: var(--sp-4); border: 1px dashed var(--steel-dark); }
.soon-panel .h { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--text); }
.soon-panel p { margin: 0; font-size: var(--t-sm); color: var(--steel-faint); line-height: 1.5; }

/* \u2500\u2500 Reveal (invocation animation) \u2500\u2500 */
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

/* \u2500\u2500 Result grid \u2500\u2500 */
.result-body { min-height: 0; overflow: hidden; padding: var(--sp-2) var(--sp-3) var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
.result-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: calc(var(--f) * 0.8); width: 100%; max-width: calc(var(--f) * 64); margin: 0 auto; align-content: center; flex: 1; min-height: 0; }
.result-grid.single { grid-template-columns: repeat(3, 1fr); max-width: calc(var(--f) * 22); }
.result-grid .u-name { white-space: normal; }
.result-foot { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
.result-foot .headline { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); color: var(--text); }
.result-foot .headline b { color: var(--amber); }
.result-foot .spacer { flex: 1; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,vc={bulwark:"Bulwark",blade:"Blade",focus:"Focus",tome:"Tome",edge:"Edge"};function gt(t){let e=t.kind==="weapon"?"weapon":t.kind==="material"?"material":"character",a=Number(t.rarity)||3,r=e==="material"?"Material":La(t.name)||"Unit",s;if(e==="material")s="Material";else if(e==="weapon"){let n=vc[t.weaponType]||(t.weaponType?t.weaponType:"Weapon");s=t.dedicatedTo?`${n} \xB7 ${La(t.dedicatedTo)}'s signature`:n}else s=t.role?`${t.role}${t.affinity?" \xB7 "+t.affinity:""}`:"";return{kind:e,rarity:a,name:r,role:s,weaponType:t.weaponType||"",dedicatedTo:t.dedicatedTo||"",portrait:t.portrait||null,isNew:!!t.isNew,up:!!t.up,facet:t.facet||null}}function gc(t,e){let a=typeof t=="string"?t.trim():"";return a?'<img class="u-photo" src="'+me(a)+'" alt="" loading="lazy">':e}function mc(t,e){let a=t.kind==="material"?" mat":t.kind==="weapon"?" wpn":"",r=e&&t.kind!=="character"?'<span class="kind-tag">'+(t.kind==="weapon"?"Weapon":"Material")+"</span>":"",s=t.up?'<span class="pill-up">UP</span>':"";return'<div class="u-art'+a+'">'+gc(t.portrait,"")+'<span class="u-stars">'+Ln(t.rarity)+"</span>"+s+(t.portrait?"":t.kind==="weapon"?Re(t.weaponType,"gf-ssil"):dc[t.kind])+r+(t.isNew?'<span class="tag-new">NEW</span>':t.facet?'<span class="tag-new fct">'+(t.facet.gained?"FACET "+t.facet.facet:"FACET "+t.facet.facet+"/"+t.facet.max)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+me(t.name)+'</div><div class="u-role">'+me(t.role)+"</div></div>"}function Ba(t,e){return'<article class="u r'+(Number(t.rarity)||3)+'">'+mc(t,e)+"</article>"}function Rn(t){let e=null;for(let a of t){let r=gt(a);(!e||r.rarity>e.rarity)&&(e=r)}return e}function Mn(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return"";let a=Math.floor(e/6e4);if(a<60)return Math.max(1,a)+"m left";let r=Math.floor(a/60);if(r<24)return r+"h left";let s=Math.floor(r/24),n=r-s*24;return n>0?s+"d "+n+"h left":s+"d left"}function bc(t,e){let a=me(t.id);if(t.live===!1)return'<button class="bcard" type="button" aria-disabled="true" data-banner="'+a+'"><span class="bt-face empty">'+fc+'</span><span class="bt-id"><b>'+me(t.title||t.id)+"</b><i>Not open yet</i></span></button>";let r=t.face?'<span class="bt-face" style="background-image:url('+me(t.face)+')"></span>':t.kind==="weapon"?'<span class="bt-face sil">'+Re(t.weaponType||"blade","gf-ssil")+"</span>":'<span class="bt-face empty">'+pc+"</span>",s=t.pity||{},n=Number(s.hard)||80,i=Number(s.count)||0,l=Math.max(0,Math.min(100,i/n*100)),h=t.pending?"Opens when you pick it":t.type==="featured"?"Featured \xB7 "+(Mn(t.endsInMs)||"ending"):"Permanent";return'<button class="bcard" type="button" data-banner="'+a+'" aria-pressed="'+(t.id===e)+'">'+r+'<span class="bt-id"><b>'+me(t.title||t.id)+"</b><i>"+h+'</i><span class="bt-pity"><span class="bt-track"><i style="width:'+l.toFixed(0)+'%"></i></span><em>'+i+"/"+n+(s.guaranteed?" \xB7 gtd":"")+"</em></span></span></button>"}function Bn({banners:t=[],banner:e,rates:a,pity:r,wallet:s,cost:n=160,bannerId:i="char-standard",state:l="ready",details:h=!1,arting:p=!1}={}){let d=Number(s&&s.aether)||0,o=Array.isArray(t)?t:[],u='<div class="rail"><div class="rail-scroll">'+(o.length?o.map(ae=>bc(ae,i)).join(""):"")+"</div></div>";if(l!=="ready"||!e){let ae=l==="error"?"Try again in a moment, or pick another banner.":"Summoning this week's featured cast \u2014 the first open of a new week takes a few seconds. Pick another banner to pull now.";return`
<div class="root">
  ${Ma}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${Ra}<b>${d.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show"><div class="soon-panel"><div class="h">${l==="error"?"Couldn't open the banner":"Working\u2026"}</div><p>${ae}</p></div></div>
    </div>
  </section>
</div>`}let f=e,v=f.kind==="weapon"?"weapon":"character",w=Array.isArray(f.featured)?f.featured.map(gt):[],g=w.find(ae=>ae.rarity===5)||w[0]||null,x=w.find(ae=>ae.rarity===4)||null,S=typeof f.art=="string"&&!!f.art.trim(),A;if(S)A='<div class="art wide" style="background-image:url('+me(f.art)+')"></div>';else if(v==="weapon")A='<div class="art"><div class="artback flat"></div><div class="plates"><div class="plate sil">'+Re(g&&g.weaponType||"blade","gf-ssil")+"</div></div></div>";else{let ae=g&&g.portrait?me(g.portrait):"",C=x&&x.portrait?me(x.portrait):"";A='<div class="art">'+(ae?'<div class="artback" style="background-image:url('+ae+')"></div>':'<div class="artback flat"></div>')+'<div class="plates">'+(ae?'<div class="plate five" style="background-image:url('+ae+')"></div>':"")+(C?'<div class="plate four" style="background-image:url('+C+')"></div>':"")+"</div></div>"}let z=f.type==="featured"?Mn(f.endsInMs):"",U=f.type==="featured"?"Featured \xB7 5\u2605 "+v+(z?" \xB7 "+z:""):"Permanent pool",R=f.title||(g?g.name:"Banner"),q=g?La(g.name)+(g.role?" \xB7 "+me(g.role):""):"The permanent pool. Every retired featured unit folds in here.",L=a||{},P=ae=>f.type==="featured"?" <em>\u2191"+jt(ae)+"</em>":"",X='<div class="rates"><span><b class="g">\u2605\u2605\u2605\u2605\u2605</b> '+jt(L.five)+P(L.featured)+'</span><span><b class="e">\u2605\u2605\u2605\u2605</b> '+jt(L.four)+P(L.featuredFour)+"</span>"+(f.type==="featured"?"":"<span>No rate-up</span>")+"</div>",J=r||{},te=Number(J.count)||0,le=Number(J.hard)||80,oe=Number(J.soft)||74,se=Math.max(0,le-te),re=Math.min(100,te/le*100),Q=Math.min(100,oe/le*100),ve=jt(L.featured),ne=f.type==="featured"?"Guaranteed 5\u2605 in <b>"+se+"</b> \xB7 soft pity from "+oe+" \xB7 "+(J.guaranteed?"next 5\u2605 <b>is</b> the rate-up":"next 5\u2605 is a "+ve+" chance for the rate-up"):"Guaranteed 5\u2605 in <b>"+se+"</b> \xB7 soft pity from "+oe+" \xB7 5\u2605 from the standard pool",E='<div class="pity"><div class="fig"><span>Pity to 5\u2605 '+(f.kind==="character"?"character":"weapon")+"</span><span><b>"+te+"</b> / "+le+'</span></div><div class="track"><i style="width:'+re.toFixed(1)+'%"></i><span class="soft" style="left:'+Q.toFixed(1)+'%"></span></div><div class="note">'+ne+"</div></div>",b=d>=n,y=d>=n*10,k='<div class="pulls"><button class="pull one" type="button" data-pull="1"'+(b?"":' aria-disabled="true"')+'><span class="big">Summon</span><span class="cost">'+Ra+" "+n+' \xB7 \xD71</span></button><button class="pull ten" type="button" data-pull="10"'+(y?"":' aria-disabled="true"')+'><span class="big">Summon \xD710</span><span class="cost">'+hc+" "+n*10+" \xB7 one 4\u2605+ guaranteed</span></button></div>",I=f.canArt===!0?'<button class="chip" type="button" data-redo-art'+(p?' aria-disabled="true"':"")+">"+uc+(p?"Painting\u2026":S?"Redo art":"Paint art")+"</button>":"",G=Array.isArray(f.pool4)?f.pool4.map(gt):[],ke=f.type==="featured"?"Also in this banner":"Also in the permanent pool",Be=h?'<div class="sheet" data-sheet><div class="sheet-head"><h4>'+me(R)+'</h4><span class="spacer"></span><button class="chip" type="button" data-details-close>Close</button></div>'+X+'<div class="strips"><span class="strip-label">'+(f.type==="featured"?"Rate-up":"Standard 5\u2605")+'</span><div class="strip-scroll"><div class="featured">'+w.map(ae=>Ba({...ae,up:f.type==="featured"},!0)).join("")+"</div></div>"+(G.length?'<span class="strip-label">'+ke+'</span><div class="strip-scroll"><div class="featured">'+G.map(ae=>Ba({...ae,up:!1},!0)).join("")+"</div></div>":"")+"</div></div>":"";return`
<div class="root">
  ${Ma}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${Ra}<b>${d.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show">
        ${A}
        <div class="veil"></div>
        <div class="bname"><span class="kicker">${U}</span><h3>${me(R)}</h3><p>${q}</p></div>
        <div class="chips">${I}<button class="chip" type="button" data-details>Details &amp; pool</button></div>
        <div class="float">${X}${E}${k}</div>
        ${Be}
      </div>
    </div>
  </section>
</div>`}function zn({results:t=[]}={}){let e=t.map(gt),a=e.length===1,r=e.map((s,n)=>'<div class="rv-card r'+s.rarity+'" data-i="'+n+'"><div class="rv-rays"></div><div class="rv-flare"></div><div class="rv-inner"><div class="rv-face rv-facedown"><span></span></div><div class="rv-face rv-front">'+Ba(s,!0)+"</div></div></div>").join("");return`
<div class="root">
  ${Ma}
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
</div>`}function Fn(t,{banners:e=[],onBanner:a,onPull:r,onBack:s,onDetails:n,onRedoArt:i}){for(let o of Array.isArray(e)?e:[]){if(!o||!o.id||o.live===!1)continue;let u=t.querySelector('[data-banner="'+o.id+'"]');u&&u.addEventListener("click",(f=>()=>a&&a(f))(o.id))}let l=t.querySelector("[data-details]");l&&l.addEventListener("click",()=>n&&n(!0));let h=t.querySelector("[data-details-close]");h&&h.addEventListener("click",()=>n&&n(!1));let p=t.querySelector("[data-redo-art]");p&&p.addEventListener("click",()=>{p.getAttribute("aria-disabled")!=="true"&&i&&i()});for(let o of t.querySelectorAll("[data-pull]"))o.addEventListener("click",()=>{o.getAttribute("aria-disabled")!=="true"&&r&&r(Number(o.dataset.pull)===10?10:1)});let d=t.querySelector("[data-summon-back]");d&&d.addEventListener("click",()=>s&&s())}function On(t,{results:e=[],onContinue:a}){let r=t.querySelector('[data-screen="reveal"]'),s=t.querySelector("[data-rv-back]"),n=t.querySelector("[data-rv-grid]"),i=t.querySelector("[data-rv-headline]"),l=e.map(gt),h=[],p=0,d=()=>{for(let S of h)clearTimeout(S);h.length=0},o=S=>{!r||!r.classList||(r.classList.remove("phase-charge","phase-flash","phase-reveal","phase-done"),S&&r.classList.add("phase-"+S))},u=S=>{let A=n&&n.querySelector('[data-i="'+S+'"]');A&&A.classList&&A.classList.add("revealed")},f=()=>{let S=Rn(e);i&&(i.innerHTML=S?"Best pull: <b>"+me(S.name)+"</b> \xB7 "+Ln(S.rarity):""),o("done")},v=()=>{for(;p<l.length;p+=1)u(p);f()};o("charge");let w=(Rn(e)||{rarity:3}).rarity;s&&s.classList&&s.classList.remove("gold","epic","steel"),h.push(setTimeout(()=>{s&&s.classList&&s.classList.add(w===5?"gold":w===4?"epic":"steel")},620)),h.push(setTimeout(()=>o("flash"),1180)),h.push(setTimeout(()=>{o("reveal");let S=l.length===1?0:230;for(let A=0;A<l.length;A+=1)h.push(setTimeout(()=>{u(p),p+=1},260+A*S));h.push(setTimeout(f,260+l.length*S+260))},1560)),r&&r.addEventListener("click",S=>{S.target&&S.target.closest&&(S.target.closest(".rv-foot")||S.target.closest(".rv-top"))||r.classList&&r.classList.contains("phase-done")||(d(),o("reveal"),v())});let g=t.querySelector("[data-rv-skip]");g&&g.addEventListener("click",()=>{d(),o("reveal"),v()});let x=t.querySelector("[data-rv-continue]");return x&&x.addEventListener("click",()=>{d(),a&&a()}),d}var qn=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */



  --sp-1: calc(var(--f) * 0.5); --sp-2: calc(var(--f) * 1.0); --sp-3: calc(var(--f) * 1.6); --sp-4: calc(var(--f) * 2.4);
}

.stage { position: absolute; inset: 0; background: radial-gradient(90% 70% at 82% 6%, var(--glow-1) 0%, transparent 58%), radial-gradient(80% 70% at 10% 96%, var(--glow-2) 0%, transparent 62%), linear-gradient(165deg, var(--ground-1) 0%, var(--ground-2) 100%); }
/* The scanline OPACITY is the style token, never a hand number: two styles turn it off. */
.stage::after { content: ""; position: absolute; inset: 0; opacity: var(--scanlines); background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px); }

/* THE ROWS ARE DECLARED FOR THE HOISTED SCREEN, WHICH IS THE ONE THE PLAYER SEES. hoistHeadIntoBar
   REMOVES the .head (head.remove(), it does not copy), so TWO children are left against THREE
   hand-written rows: the body fell into the first, which is auto, sizing to its content instead of
   to the screen. Measured: the board ended at 740 of 1080 with dead space below.
   Every other screen declares the 1fr by default and adds the header row only under
   :has(> .head). A harness never reproduces this: it renders the screen loose and never hoists. */
.screen { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0,1fr) auto; min-height: 0; }
.screen:has(> .head) { grid-template-rows: auto minmax(0,1fr) auto; }

/* Header */
.head { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3) var(--sp-1); }
.back { display: inline-flex; align-items: center; gap: calc(var(--f) * 0.4); background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--on-surface); border: 0; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-2); cursor: pointer; --cut: 0.7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.back:hover { background: #FFFFFF; }
.head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; letter-spacing: 0.02em; }
/* The primary action of the pre-battle screen. It used to be a chip in the header, which
   read as a minor control and then got even smaller once the header moved into the shell
   bar. It sits under the roster now, full width, at the weight it deserves. */
.into-battle { flex: none; width: 100%; cursor: pointer; background: var(--coral); border: 1px solid var(--coral); color: var(--on-coral); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.9) var(--sp-3); --cut: 0.7em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; gap: calc(var(--f) * 0.15); line-height: 1.1; box-shadow: var(--panel-shadow), var(--panel-bevel); }
.into-battle small { font-size: var(--t-tiny); font-weight: 400; letter-spacing: 0.08em; text-transform: none; opacity: 0.85; }
.into-battle:hover { background: var(--coral-deep); }

/* Body: board | picker */
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

/* TOP RIGHT, OVER THE ART. At the bottom it landed on the role and affinity line, which is text
   the player reads to decide who to bench. The art says nothing in that corner. */
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

/* Picker */
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
/* A COLUMN, not two loose spans. Both are inline <span>, so the browser put them on the SAME line
   ("RoverWarrior - Light") and the name's ellipsis could never work: an inline does not clip. */
.b-main { grid-column: 2; grid-row: 1 / span 2; min-width: 0; display: flex; flex-direction: column; }
.b-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.92 * var(--gf-type-scale, 1)); line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.b-sub { font-family: var(--display); font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.08em; text-transform: var(--case); color: var(--steel); }
/* NOTHING ABSOLUTE INSIDE A CARD. The stars, IN TEAM and YOU were all three position:absolute over
   the text, which takes the remaining width: both inside the box, so neither overflow nor clipping
   fires. With its own row and column they cannot overlap by construction. */
.b-stars { grid-column: 3; grid-row: 1; justify-self: end; font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); }
.b.r5 .b-stars { color: var(--amber); } .b.r4 .b-stars { color: var(--epic); } .b.leader .b-stars { color: var(--coral); }
.b.inteam { opacity: 0.5; }
.b.inteam::after { content: "IN TEAM"; grid-column: 3; grid-row: 2; justify-self: end; font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.66 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; color: var(--jade); }
.b.held { transform: translateY(calc(var(--f) * -0.2)); box-shadow: 0 0 0 2px var(--coral); opacity: 1; }
.b .youtag { grid-column: 3; grid-row: 2; justify-self: end; font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.66 * var(--gf-type-scale, 1)); letter-spacing: 0.12em; color: var(--coral); }

/* Presets strip */
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

/* Loading / error */
.fm-msg { grid-row: 1 / -1; align-self: center; justify-self: center; text-align: center; font-family: var(--display); color: var(--steel-faint); display: flex; flex-direction: column; gap: var(--sp-2); }
.fm-msg .t { font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); color: var(--porcelain-3); letter-spacing: 0.04em; }
.fm-msg .retry { cursor: pointer; align-self: center; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f) * 0.5) var(--sp-3); border: 1px solid var(--coral); background: var(--coral); color: var(--on-coral); --cut: 0.5em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

/* Generated unit art. Cropped rather than fitted (an image model returns whatever aspect it
   likes) and sitting UNDER the badges the slot already had, so nothing it used to show is lost. */
.slot-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; }
.b-ic .b-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
`,yc='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="fm-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',Hn='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#fm-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>';function wc(t,e){let a=typeof t=="string"?t.trim():"";return a?'<img class="slot-photo" src="'+Me(a)+'" alt="" loading="lazy">':e}var xc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8l4 4 4-6 4 6 4-4v9H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',kc={4:"\u2605\u2605\u2605\u2605",5:"\u2605\u2605\u2605\u2605\u2605"},_c={Fire:"var(--af-fire)",Water:"var(--af-water)",Wind:"var(--af-wind)",Earth:"var(--af-earth)",Light:"var(--af-light)",Dark:"var(--af-dark)"};function Me(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function $n(t){return String(t||"").split(",")[0]}function Sc(t){return(Number(t)||0).toLocaleString("en-US")}function jn(t){let e=t&&t.leaderSlot||"leader",a=t&&t.leader||{name:"You",role:"\u2014",affinity:"Fire",cp:0},r={id:e,leader:!0,name:a.name||"You",r:5,role:a.role||"\u2014",aff:a.affinity||"Fire",pos:a.position==="back"?"back":"front",cp:Number(a.cp)||0,portrait:a.portrait||null},s=new Map,n=(t&&Array.isArray(t.units)?t.units:[]).map(i=>{let l={id:i.id,name:i.name,r:i.rarity===5?5:4,role:i.role||"",aff:i.affinity||"Fire",pos:i.position==="back"?"back":"front",cp:Number(i.cp)||0,portrait:i.portrait||null};return s.set(l.id,l),l});return{LEADER:e,leaderObj:r,byId:s,units:n}}function Un(t,e){return e===t.LEADER?t.leaderObj:t.byId.get(e)||null}function Vn(t){let e=t&&typeof t=="object"?t:{},a=r=>{let s=Array.isArray(r)?r:[];return[s[0]||null,s[1]||null,s[2]||null]};return{front:a(e.front),back:a(e.back)}}function mt(t,e){return t.front.indexOf(e)>=0||t.back.indexOf(e)>=0}function Ec(t,e){let a=0;return["front","back"].forEach(r=>{e[r].forEach(s=>{let n=s&&Un(t,s);n&&(a+=n.cp)})}),a}function Wn(t,e){return(t&&Array.isArray(t.presets)&&t.presets.length?t.presets:[{name:"Team 1",board:{front:[e,null,null],back:[null,null,null]}}]).map((r,s)=>({name:r&&r.name||"Team "+(s+1),board:Vn(r&&r.board)}))}function Ut(t,e){return Vn(t&&t.board)}function Tc(t,e,a,r,s){let n=e[r][s],i=a&&a.row===r&&a.idx===s;if(!n)return'<button class="slot empty'+(i?" held":"")+'" data-slot="'+r+":"+s+'"><span class="plus">+<small>Add</small></span></button>';let l=Un(t,n)||t.leaderObj;return'<button class="'+("slot filled "+(l.leader?"leader":"r"+l.r)+(i?" held":""))+'" data-slot="'+r+":"+s+'">'+(l.leader?'<span class="slot-tag">LEADER</span>':"")+'<div class="slot-art">'+wc(l.portrait,"")+(l.portrait?"":Hn)+'</div><span class="slot-remove" data-remove="'+r+":"+s+'">\xD7</span><div class="slot-meta"><div class="slot-name">'+Me($n(l.name))+'</div><div class="slot-role">'+Me(l.role)+" \xB7 "+Me(l.aff)+"</div></div></button>"}function Vt(t,e,a,r){return e[r].map((s,n)=>Tc(t,e,a,r,n)).join("")}function Pn(t,e,a,r,s){let n=mt(r,e.id),i=s&&s.bench===e.id,l="b "+(a?"leader":"r"+e.r)+(n&&!a?" inteam":"")+(i?" held":""),h=a?"\u2605\u2605\u2605\u2605\u2605":kc[e.r],p=a?'<span class="youtag">YOU</span>':"";return'<button class="'+l+'" data-pick="'+e.id+'"><span class="b-ic">'+(a?xc:e.portrait?'<img class="b-photo" src="'+Me(e.portrait)+'" alt="" loading="lazy">':Hn)+'<span class="aff" style="background:'+(_c[e.aff]||"var(--steel)")+'"></span></span><span class="b-main"><span class="b-name">'+Me($n(e.name))+'</span><span class="b-sub">'+Me(e.role)+" \xB7 "+Me(e.aff)+'</span></span><span class="b-stars">'+h+"</span>"+p+"</button>"}function Gn(t,e,a,r){let s=t.units.filter(i=>r==="all"||String(i.r)===r),n=Pn(t,t.leaderObj,!0,e,a);return s.forEach(i=>{n+=Pn(t,i,!1,e,a)}),n}function Yn(t,e){return t.units.filter(a=>!mt(e,a.id)).length}function Kn(t,e,a,r,s){let n="";return a.forEach((i,l)=>{let h=l===r,p=Ec(t,h?e:Ut(i,t.LEADER));n+='<div class="preset'+(h&&s?" dirty":"")+'" data-preset="'+l+'" aria-pressed="'+h+'"><span class="nm" data-name="'+l+'">'+Me(i.name)+'</span><span class="cp">'+Sc(p)+'</span><span class="x" data-del="'+l+'">\xD7</span></div>'}),n}function Xn({state:t="loading",data:e=null,battleMode:a=!1}={}){let r;if(t==="ready"&&e){let s=jn(e),n=Wn(e,s.LEADER),i=Math.min(Math.max(0,Number(e.active)||0),n.length-1),l=Ut(n[i],s.LEADER);return r='<div class="fm-body"><div class="board"><div class="row-lab">Front line &mdash; melee &amp; guard</div><div class="slots" data-row="front">'+Vt(s,l,null,"front")+'</div><div class="row-lab">Back line &mdash; ranged &amp; support</div><div class="slots" data-row="back">'+Vt(s,l,null,"back")+'</div><div class="board-foot"><span class="hint">Tap a unit, then a slot to place &middot; <b>\xD7</b> benches a unit</span></div></div><div class="picker"><div class="picker-head"><span class="t">Your units</span><span class="n" data-bench-n>'+Yn(s,l)+' available</span></div><div class="filters" data-filters><button class="chip" type="button" data-rar="all" aria-pressed="true">All</button><button class="chip" type="button" data-rar="5" aria-pressed="false">5&#9733;</button><button class="chip" type="button" data-rar="4" aria-pressed="false">4&#9733;</button></div><div class="bench-scroll"><div class="bench" data-bench>'+Gn(s,l,null,"all")+"</div></div>"+(a?'<button class="into-battle" type="button" data-into-battle>Into battle &raquo;<small>Start the fight with this team</small></button>':"")+'</div></div><div class="presets"><span class="lab">Presets</span><div class="preset-strip" data-presets>'+Kn(s,l,n,i,!1)+'</div><div class="preset-actions"><span class="autosaved">Auto-saved</span><button class="btn" type="button" data-saveas>New team</button></div></div>',Dn(r,a)}return t==="error"?r=`<div class="fm-msg"><span class="t">Couldn't load the formation.</span><button class="retry" type="button" data-retry>Retry</button></div>`:r='<div class="fm-msg"><span class="t">Marshalling your units\u2026</span></div>',Dn(r,a)}function Dn(t,e){return'<div class="root">'+yc+'<div class="stage"></div><section class="screen"><div class="head"><button class="back" type="button" data-back>&#9664; '+(e?"Cancel":"Command")+'</button><div class="head-id"><div class="eyebrow">'+(e?"Before the fight":"Command")+"</div><h2>"+(e?"Choose your team":"Formation")+"</h2></div></div>"+t+"</section></div>"}function Jn(t,{data:e,onSave:a,onBack:r,onRetry:s,onIntoBattle:n}={}){let i=t.querySelector("[data-back]");i&&i.addEventListener("click",()=>r&&r());let l=t.querySelector("[data-retry]");l&&l.addEventListener("click",()=>s&&s());let h=t.querySelector("[data-into-battle]");if(h&&h.addEventListener("click",()=>n&&n()),!e)return()=>{};let p=jn(e),d=p.LEADER,o=Wn(e,d),u=Math.min(Math.max(0,Number(e.active)||0),o.length-1),f=Ut(o[u],d),v=null,w="all",g=!1,x=null,S=t.querySelector("[data-bench-n]"),A=t.querySelector("[data-bench]"),z=t.querySelector("[data-presets]"),U=t.querySelector("[data-save]");function R(){g=!0}function q(){let y=o.map((k,N)=>({name:k.name,board:N===u?{front:f.front.slice(),back:f.back.slice()}:{front:k.board.front.slice(),back:k.board.back.slice()}}));a&&a(y,u)}function L(){o[u].board={front:f.front.slice(),back:f.back.slice()},g=!1,q()}function P(y,k){u=y,f=Ut(o[y],d),g=!1,v=null,k||E()}function X(y,k,N){let I=y.bench?y.bench:f[y.row][y.idx];if(!I)return!1;let G=f[k][N];if(y.bench)f[k][N]=I;else{if(y.row===k&&y.idx===N)return!1;f[y.row][y.idx]=G,f[k][N]=I}return R(),!0}function J(y){return y.bench?!1:(f[y.row][y.idx]=null,R(),!0)}function te(y){let k=["front","back"];for(let N=0;N<2;N++){let I=f[k[N]].indexOf(y);if(I>=0)return{row:k[N],idx:I}}return null}function le(y){if(y===d&&mt(f,d)){let k=te(d);v={row:k.row,idx:k.idx},E();return}mt(f,y)||(v=v&&v.bench===y?null:{bench:y},E())}function oe(y){let k=y.split(":")[0],N=+y.split(":")[1];if(!v){f[k][N]&&(v={row:k,idx:N}),E();return}let I=X(v,k,N);v=null,I&&L(),E()}function se(y){let k=y.split(":")[0],N=+y.split(":")[1],I=J({row:k,idx:N});v=null,I&&L(),E()}function re(y){let k=y.split(":");return{row:k[0],idx:+k[1]}}function Q(){for(let y of t.querySelectorAll(".drop-ok"))y.classList.remove("drop-ok")}function ve(){for(let k of t.querySelectorAll("[data-slot].filled"))k.setAttribute("draggable","true"),k.addEventListener("dragstart",function(N){if(v=null,x=re(this.dataset.slot),N.dataTransfer){N.dataTransfer.effectAllowed="move";try{N.dataTransfer.setData("text/plain",this.dataset.slot)}catch{}}}),k.addEventListener("dragend",function(){x=null,Q()});for(let k of t.querySelectorAll("[data-slot]"))k.addEventListener("dragover",function(N){x&&(N.preventDefault(),this.classList.add("drop-ok"))}),k.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),k.addEventListener("drop",function(N){if(N.preventDefault(),!x){Q();return}let I=re(this.dataset.slot),G=X(x,I.row,I.idx);x=null,G&&L(),E()});for(let k of t.querySelectorAll("[data-pick]")){let N=k.dataset.pick;N!==d&&!mt(f,N)&&(k.setAttribute("draggable","true"),k.addEventListener("dragstart",function(I){if(v=null,x={bench:this.dataset.pick},I.dataTransfer){I.dataTransfer.effectAllowed="copy";try{I.dataTransfer.setData("text/plain",this.dataset.pick)}catch{}}}),k.addEventListener("dragend",function(){x=null,Q()}))}let y=t.querySelector(".picker");y&&!y._fmDrop&&(y._fmDrop=!0,y.addEventListener("dragover",function(k){x&&!x.bench&&(k.preventDefault(),this.classList.add("drop-ok"))}),y.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),y.addEventListener("drop",function(k){if(k.preventDefault(),this.classList.remove("drop-ok"),x&&!x.bench){let N=J(x);x=null,N&&L(),E()}}))}function ne(y){o.length<=1||(o.splice(y,1),u>=o.length?u=o.length-1:y<u&&u--,P(u),q())}function E(){let y=t.querySelector('[data-row="front"]'),k=t.querySelector('[data-row="back"]');y&&(y.innerHTML=Vt(p,f,v,"front")),k&&(k.innerHTML=Vt(p,f,v,"back")),A&&(A.innerHTML=Gn(p,f,v,w)),S&&(S.textContent=Yn(p,f)+" available"),z&&(z.innerHTML=Kn(p,f,o,u,g)),U&&(U.disabled=!g);for(let N of t.querySelectorAll("[data-slot]"))N.addEventListener("click",function(){oe(this.dataset.slot)});for(let N of t.querySelectorAll("[data-remove]"))N.addEventListener("click",function(I){I.stopPropagation(),se(this.dataset.remove)});for(let N of t.querySelectorAll("[data-pick]"))N.addEventListener("click",function(){le(this.dataset.pick)});for(let N of t.querySelectorAll("[data-preset]"))N.addEventListener("click",function(I){I.target.closest&&(I.target.closest("[data-del]")||I.target.closest("[data-name]"))||(P(+this.dataset.preset),q())});for(let N of t.querySelectorAll("[data-del]"))N.addEventListener("click",function(I){I.stopPropagation(),ne(+this.dataset.del)});for(let N of t.querySelectorAll("[data-name]"))N.addEventListener("click",function(I){I.stopPropagation(),this.setAttribute("contenteditable","true"),this.focus()}),N.addEventListener("blur",function(){this.removeAttribute("contenteditable"),o[+this.dataset.name].name=(this.textContent||"").trim().slice(0,40)||"Team",E(),q()}),N.addEventListener("keydown",function(I){I.key==="Enter"&&(I.preventDefault(),this.blur())});ve()}U&&U.addEventListener("click",function(){g&&(o[u].board={front:f.front.slice(),back:f.back.slice()},g=!1,E(),q())});let b=t.querySelector("[data-saveas]");b&&b.addEventListener("click",function(){o.push({name:"Team "+(o.length+1),board:{front:f.front.slice(),back:f.back.slice()}}),P(o.length-1),q()});for(let y of t.querySelectorAll("[data-rar]"))y.addEventListener("click",function(){w=this.dataset.rar;for(let k of t.querySelectorAll("[data-rar]"))k.setAttribute("aria-pressed",String(k.dataset.rar===w));E()});return E(),()=>{}}var Ac={Tank:"T",Warrior:"W",Mage:"M",Support:"S",Assassin:"A"},Nc='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#cb-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',Cc={fire:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5.2A6 6 0 0 1 6 14c0-4.5 4.5-6.5 6-12Z"/></svg>',water:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3c4 5.2 6 8.2 6 11.2A6 6 0 0 1 6 14.2c0-3 2-6 6-11.2Z"/></svg>',wind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 18h8"/></svg>',earth:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 21 9 12 21 3 9Z"/></svg>',light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>',dark:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 3a9 9 0 1 0 5.5 15.5A7 7 0 0 1 15.5 3Z"/></svg>'};function Ce(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function ei(t){return String(t||"").split(",")[0]}function Ic(t){return String(t||"").toLowerCase()}var ti=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }

.root {
  container-type: size; position: absolute; inset: 0; overflow: hidden;
  font-family: var(--body); color: var(--text);
  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */


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
/* The unit token is an ICON: crop to the face rather than shrink the whole portrait into a
   ~7em square, the same call as the Summon strip. The badges sit outside the box, so nothing
   needs a stacking fix here. */
/* No overflow:hidden here on purpose: the role and affinity badges are children of .ava and sit
   OUTSIDE its box at -0.5em, so clipping the box would cut them. object-fit: cover already keeps
   the image inside its own border box. */
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
/* Real HP figures, over the bar. Tabular so they do not jitter, hard shadow because they sit on
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

.abanner { position: absolute; top: 42%; left: 0; right: 0; text-align: center; z-index: 9; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; letter-spacing: 0.1em; text-transform: var(--case); color: var(--text); pointer-events: none; opacity: 0; }
.abanner.show { animation: abanner 900ms ease forwards; }
.abanner .big { font-size: var(--t-2xl); text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
.abanner .sub { display: block; font-size: var(--t-sm); color: var(--coral); letter-spacing: 0.24em; }
@keyframes abanner { 0% { opacity: 0; transform: translateY(10px) scale(0.96); } 20% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; } }

.result { position: absolute; inset: 0; z-index: 12; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); background: radial-gradient(60% 60% at 50% 45%, rgba(20,30,45,0.85), rgba(9,13,20,0.95)); opacity: 0; pointer-events: none; transition: opacity 300ms ease; }
.result.show { opacity: 1; pointer-events: auto; }
.result h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-2xl); letter-spacing: 0.12em; text-transform: var(--case); color: var(--amber); text-shadow: 0 0 18px color-mix(in srgb,var(--amber) 50%,transparent); }
.result.lose h2 { color: var(--alarm); text-shadow: 0 0 18px color-mix(in srgb,var(--alarm) 50%,transparent); }
.result .sub { font-family: var(--display); font-size: var(--t-sm); letter-spacing: 0.08em; color: var(--porcelain-3); max-width: 60%; text-align: center; }
.result .rbtns { display: flex; gap: var(--sp-2); margin-top: var(--sp-2); }
.rbtn { cursor: pointer; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-md); letter-spacing: 0.1em; text-transform: var(--case); padding: calc(var(--f)*0.6) var(--sp-3); border: 1px solid; --cut: 0.6em; clip-path: var(--clip-btn); border-radius: var(--radius-sm); }
.rbtn.solid { background: var(--coral); border-color: var(--coral); color: var(--on-coral); } .rbtn.ghost { background: transparent; border-color: var(--steel); color: var(--text); }

/* THIS HEADER HEIGHT IS DECLARED ONCE AND BOTH SIDES READ IT. The bar floats over the arena and
   the briefing has to clear it. Written by hand in --f (a GEOMETRIC unit) the header grew with the
   text-size control and the gap did not: measured, at 175% the Objective kicker landed 24px under
   it. A box that holds TEXT is not measured on the geometric scale. */
.root { --fbar-h: calc(var(--sp-1) * 2 + var(--t-xs) * 1.3 + var(--t-lg)); }
.head { position: absolute; top: 0; left: 0; right: 0; z-index: 10; min-height: var(--fbar-h); display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-1) var(--sp-3); }
.head .head-id .eyebrow { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.2em; text-transform: var(--case); color: var(--coral); }
.head .head-id h2 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: 700; font-size: var(--t-lg); }
/* \u2500\u2500 Prebattle briefing (maqueta gacha-combat-prebattle-01) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The arena used to fight the controls for the middle of the screen: Start sat on top of the
   player's own formation and the objective was a one-line pill. Now the battlefield RECEDES \u2014
   blurred and dimmed into a backdrop \u2014 and the centre becomes the briefing: objective,
   the team preset and one large Start, stacked and centred. Nothing scrolls; the top bar stays
   above the veil so Chapter/title/CP remain readable. */
.vig-note { margin-top: var(--sp-1); font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: var(--case); color: var(--steel-faint); }
.vig-note.short { color: var(--alarm); }
.fstart b { font-weight: 700; color: inherit; opacity: 0.85; margin-left: calc(var(--f)*0.4); }
.fstart[disabled] { opacity: 0.5; cursor: default; }
.veil { position: absolute; inset: 0; z-index: 6; backdrop-filter: blur(5px) saturate(0.75); background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb,var(--ink) 62%,transparent) 0%, color-mix(in srgb,var(--ink) 88%,transparent) 70%); }
/* THE BRIEFING FILLS THE SCREEN, IT IS NOT ABSOLUTELY CENTRED. Two causes, both fixed here:
   1) top 52% + translate(-50%,-50%) centres a box with NO HEIGHT CAP: it grows both ways and, being
      absolute, never enlarges its parent, so no overflow test sees it. Start ended up BELOW THE
      CUT. Now a flex fills the inset and only the prose region gives, scrolling inside its box.
   2) width: min(46rem, 82%) -- a rem. No screen in this package has one on purpose: a rem follows
      the root font-size (the ENGINE's size control and browser zoom), not the stage. It was also
      NARROW: 736px of a 1920 stage (38%), wrapping the objective into five huge lines when in 16:9
      width is what is FREE and height is what is scarce.
   The top padding applies only WHILE the header is still on screen: hoisting removes it, and a
   fixed padding would leave dead space its height. */
.briefing { position: absolute; inset: 0; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); }
.root:has(.head) .briefing { padding-top: calc(var(--fbar-h) + var(--sp-2)); }
.briefing > * { flex: none; max-width: 100%; }
/* Only the prose gives: objective and opening scroll inside their box when the model overruns.
   The button, the counter and the presets are chrome and never move. */
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

/* \u2500\u2500 THE CARD + THE BAND (maqueta gacha-combat-frontback-01, variant B1) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The unit token stops being a 7em square holding a small avatar and becomes a 2:3 PORTRAIT CARD
   the generated art fills, with the name and the bars overlaid on its lower third. The party is
   drawn ONCE, as a band of six along the bottom; the field above belongs to the enemy.
   Measured on the real screen, before -> after: unit ink 12% -> 42.6% of the arena, the player's
   card 91x107 -> 156x234, and the formation spans 95% of the width instead of 29%.
   It is all CSS on purpose: the markup, the class names and every wireCombat selector are
   untouched, so the VFX, the bars and the act/hit/dead classes keep working as they are. */
.root { --cw: calc(var(--f)*9.4); } /* the enemy card; the band sets its own below */

.cbt { width: var(--cw); height: calc(var(--cw)*1.5); display: block; }
.cbt .ava { position: absolute; inset: 0; width: 100%; height: 100%; --cut: 0.75em; }
.cbt .ava > svg { width: 100%; height: 100%; } /* the no-portrait silhouette fills the card */
.cbt .ava-photo { object-position: 50% 8%; }
/* The badges used to hang OUTSIDE a 7em square at -0.5em; on a full-bleed card they come inside,
   or they float over the neighbouring unit. */
.cbt .role { top: calc(var(--f)*0.45); left: calc(var(--f)*0.45); width: calc(var(--f)*1.9); height: calc(var(--f)*1.9); font-size: calc(var(--f)*0.95 * var(--gf-type-scale, 1)); }
.cbt .aff-badge { top: calc(var(--f)*0.45); right: calc(var(--f)*0.45); width: calc(var(--f)*2); height: calc(var(--f)*2); }
.cbt::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 42%; z-index: 2;
  background: linear-gradient(0deg, rgba(9,13,20,0.94) 12%, rgba(9,13,20,0.55) 52%, transparent 100%); pointer-events: none; }
.cbt .bars { position: absolute; left: 7%; right: 7%; bottom: 7%; width: auto; z-index: 3; }
.cbt .hp, .cbt .en { height: calc(var(--f)*0.62); }
.cbt .nm { position: absolute; left: 7%; right: 7%; bottom: 20%; z-index: 3; text-align: center;
  font-size: calc(var(--f)*1.05 * var(--gf-type-scale, 1)); text-shadow: 0 1px 3px rgba(0,0,0,0.9); }

/* THE ENEMY FIELD. A 2:3 card is tall: two rows of them do not fit in the field, so the rows
   overlap -- and a straight overlap puts the row in front over the bottom of the row behind, which
   is exactly where the name and the bars live. So the rows sit a full card apart and the back row
   is offset HALF A STEP into the gaps of the front row: they never share a column, so they can
   overlap as deeply as the height demands and still hide nothing.
   The track is a FIXED 3 columns rather than centred content, because centring each row on its own
   breaks the interleave the moment the rows hold different counts: 2 front + 1 back centres the
   lone card exactly ON a front card, right over its nameplate. */
.side.enemies { flex: 1; padding: calc(var(--f)*3.4) calc(var(--f)*1.2) 0; justify-content: center; }
.side.enemies .row { position: relative; display: grid; grid-template-columns: repeat(3, var(--cw)); gap: calc(var(--cw)*1.15); justify-content: center; }
.side.enemies .row.back { transform: translateX(calc(var(--cw)*1.075)); filter: brightness(0.84); }
.side.enemies .row.front { margin-top: calc(var(--cw)*-0.85); z-index: 3; }
/* A formation is 1..6 units (MAX_ENEMIES) placed wherever the model likes, so a row can arrive with
   more than the three the track holds. Then the side drops the interleave altogether: smaller
   cards, rows that simply stack. No shared lattice to get wrong, nothing to collide. */
.side.enemies:has(.row > .cbt:nth-child(4)) { --cw: calc(var(--f)*8.6); }
.side.enemies:has(.row > .cbt:nth-child(4)) .row { display: flex; gap: calc(var(--cw)*0.25); }
.side.enemies:has(.row > .cbt:nth-child(4)) .row.back { transform: none; }
.side.enemies:has(.row > .cbt:nth-child(4)) .row.front { margin-top: 0; }

/* THE BAND. The party is ONE line of six: "display: contents" dissolves the two row boxes without
   touching the markup, so the same DOM serves the field and the band. The step that lifts the front
   line is a MARGIN, not a transform: wireCombat drives .acting and .dead through transform, and a
   row-scoped transform rule would outrank them and swallow both. */
.side.allies { flex: 0 0 calc(var(--f)*24.5); flex-direction: row; align-items: flex-end;
  justify-content: center; gap: calc(var(--f)*1.1); padding: 0 calc(var(--f)*1.4) calc(var(--f)*1.2);
  --cw: calc(var(--f)*14.6); }
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
/* The divider marks the field/band split, not the middle of the screen any more. */
.midline { top: auto; bottom: calc(var(--f)*24.5); }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Rc='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="cb-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.14"/></linearGradient></defs></svg>';function Lc(t,e){let a=Ic(t.affinity);return'<div class="cbt'+(e?" enemy":"")+'" data-id="'+Ce(t.id)+'" data-aff="'+a+'" style="--aff:var(--'+a+')"><div class="fx" data-fx></div><div class="ava">'+(t.portrait?'<img class="ava-photo" src="'+Ce(t.portrait)+'" alt="" loading="lazy">':Nc)+'<span class="role">'+(Ac[t.role]||"?")+'</span><span class="aff-badge" title="'+a+'">'+(Cc[a]||"")+'</span></div><div class="bars"><div class="hp"><i style="width:100%"></i></div><span class="hpn"></span><div class="en"><i></i></div></div><div class="nm">'+Ce(ei(t.name))+"</div></div>"}function Zn(t,e){let a=t.filter(n=>(n.position||"front")==="front"),r=t.filter(n=>n.position==="back"),s=(n,i)=>n.length?'<div class="row '+i+'">'+n.map(l=>Lc(l,e)).join("")+"</div>":"";return e?s(r,"back")+s(a,"front"):s(a,"front")+s(r,"back")}function Qn(t,e){return'<div class="arena"><div class="side enemies" data-side-enemies>'+Zn(e,!0)+'</div><div class="midline"></div><div class="side allies" data-side-allies>'+Zn(t,!1)+"</div></div>"}function Mc(t){let e=Array.isArray(t&&t.presets)?t.presets:[];if(e.length<=1)return"";let a=typeof t.activePreset=="number"?t.activePreset:0;return'<div class="cbt-presets" data-cbt-presets><span class="lab">Team</span>'+e.map(r=>'<button class="cbt-preset" type="button" data-preset-pick="'+r.index+'"'+(r.index===a?' aria-pressed="true"':"")+'><span class="nm">'+Ce(ei(r.name))+'</span><span class="cp">'+(Number(r.cp)||0).toLocaleString("en-US")+"</span></button>").join("")+"</div>"}function ai({phase:t="loading",payload:e=null,node:a=null,result:r=null,vigor:s=null,error:n=""}={}){let i=a&&a.title||"Combat",l;if(t==="prebattle"&&e)l=Qn(e.allies||[],e.enemies||[])+'<div class="veil"></div><div class="head"><button class="back" type="button" data-back>&#9664; Chapter</button><div class="head-id"><div class="eyebrow">Combat</div><h2>'+Ce(i)+'</h2></div></div><div class="briefing"><div class="brief-scroll"><span class="brief-kicker">Objective</span>'+(e.opening?'<p class="brief-open">'+Ce(e.opening)+"</p>":"")+'<p class="brief-obj">'+Ce(e.objective||"Defeat the enemy formation.")+'</p></div><div class="brief-meta">'+(a&&a.chapter?"<span>Chapter <b>"+Ce(String(a.chapter))+"</b></span>":"")+"<span>Your team <b>"+(e.allies||[]).length+"</b></span><span>Enemies <b>"+(e.enemies||[]).length+"</b></span></div>"+Mc(e)+(s&&Number.isFinite(s.cost)?'<button class="fstart" type="button" data-start'+(s.have>=s.cost?"":" disabled")+">Start battle &raquo; <b>"+s.cost+" Vigor</b></button>"+(s.have>=s.cost?'<div class="vig-note">'+s.have+" Vigor left</div>":'<div class="vig-note short">Not enough Vigor &mdash; '+s.have+" of "+s.cost+(s.nextMs?", +1 in "+Math.max(1,Math.ceil(s.nextMs/6e4))+"m":"")+"</div>"):'<button class="fstart" type="button" data-start>Start battle &raquo;</button>')+"</div>";else if(t==="battle"&&e)l=Qn(e.allies||[],e.enemies||[])+'<div class="cbar"><button class="back" type="button" data-back>&#9664; Retreat</button><div class="wave-id"><small>'+Ce(i)+'</small>Auto-battle</div><div class="ctrls"><button type="button" data-play aria-pressed="true">&#10074;&#10074; Pause</button><button type="button" data-speed aria-pressed="false">&times;1</button><button type="button" data-skip>Skip &raquo;</button></div></div><div class="abanner" data-abanner><span class="big"></span><span class="sub"></span></div>';else if(t==="error"){let h=n==="empty-party";l='<div class="cb-msg"><div class="box"><span class="t">'+(h?"This team has no units. Seat at least one in Formation.":"Couldn't set up the battle.")+"</span>"+(h?"":'<button class="retry" type="button" data-retry>Retry</button>')+'<button class="retry" type="button" data-back style="background:transparent;border-color:var(--steel);color:var(--text)">Back</button></div></div>'}else l='<div class="cb-msg"><div class="box"><span class="t">Preparing the battle\u2026</span></div></div>';return'<div class="root">'+Rc+'<section class="screen">'+l+"</section></div>"}function ri(t,{phase:e,steps:a=[],result:r=null,onStart:s,onBack:n,onFinished:i,onRetry:l,onPickPreset:h}={}){let p=t.querySelector("[data-back]");p&&p.addEventListener("click",()=>n&&n());for(let E of t.querySelectorAll("[data-preset-pick]"))E.addEventListener("click",function(){h&&h(+this.dataset.presetPick)});let d=t.querySelector("[data-retry]");d&&d.addEventListener("click",()=>l&&l());let o=t.querySelector("[data-start]");if(o&&o.addEventListener("click",()=>s&&s()),e!=="battle")return()=>{};let u=1.9,f=null,v=0,w=!1,g=1,x=E=>t.querySelector('.cbt[data-id="'+String(E).replace(/"/g,"")+'"]'),S=t.querySelector("[data-abanner]");function A(E,b,y,k){let N=x(E);if(!N)return;let I=N.querySelector(".hp > i");I&&(I.style.width=Math.max(0,b)+"%");let G=N.querySelector(".hpn");G&&Number.isFinite(y)&&Number.isFinite(k)&&(G.textContent=Math.max(0,y).toLocaleString("en-US")+" / "+k.toLocaleString("en-US")),b<=0?(N.classList.add("dead"),N.classList.remove("charged")):N.classList.remove("dead")}function z(E,b){let y=x(E);if(!y)return;let k=y.querySelector(".en > i");k&&(k.style.width=Math.min(100,b)+"%"),y.classList.toggle("charged",b>=100&&!y.classList.contains("dead"))}function U(E,b,y){let k=x(E);if(!k)return;let N=k.querySelector("[data-fx]");if(!N)return;let I=document.createElement("div");I.className="vfx "+b,y&&I.style.setProperty("--fxc",y),N.appendChild(I),setTimeout(()=>{I.parentNode&&I.parentNode.removeChild(I)},1e3/g)}function R(E,b,y,k){let N=x(E);if(!N)return;let I=N.querySelector("[data-fx]");if(!I)return;let G=document.createElement("span");G.className="dmg "+y,k?G.innerHTML=Ce(b)+'<b class="eff '+k.toLowerCase()+'">'+k+(k==="STRONG"?" \xD71.5":" \xD70.75")+"</b>":G.textContent=b,I.appendChild(G),setTimeout(()=>{G.parentNode&&G.parentNode.removeChild(G)},1100/g)}function q(E){let b=x(E);b&&(b.classList.add("acting"),setTimeout(()=>b.classList.remove("acting"),520/g))}function L(E){let b=x(E);b&&(b.classList.add("hit"),setTimeout(()=>b.classList.remove("hit"),340/g))}function P(E,b){S&&(S.querySelector(".big").textContent=E,S.querySelector(".sub").textContent=b||"",S.classList.remove("show"),S.offsetWidth,S.classList.add("show"))}function X(E,b){let y=t.querySelector(E==="enemies"?"[data-side-enemies]":"[data-side-allies]");if(!y)return;let k=document.createElement("div");k.className="vfx wave",k.style.cssText="left:12%;top:20%;width:76%;height:60%;--fxc:"+b,y.style.position="relative",y.appendChild(k),setTimeout(()=>{k.parentNode&&k.parentNode.removeChild(k)},700/g)}function J(E,b){switch(E.op){case"start":b&&P("Battle start","Affinity rules every hit");break;case"act":b&&q(E.id);break;case"ult":b&&(q(E.id),P(E.name,E.sub));break;case"hit":b&&(L(E.id),U(E.id,"hit"),U(E.id,"slash","#fff"),R(E.id,"-"+E.amount+(E.crit?"!":""),"d"+(E.crit?" crit":""),E.effLabel||"")),A(E.id,E.hpPct,E.hp,E.hpMax);break;case"heal":b&&(U(E.id,"heal"),R(E.id,"+"+E.amount,"h")),A(E.id,E.hpPct,E.hp,E.hpMax);break;case"energy":z(E.id,E.pct);break;case"hp":A(E.id,E.pct,E.hp,E.hpMax);break;case"shieldFx":if(b)for(let y of E.ids||[])U(y,"shield");break;case"buff":b&&(U(E.id,"buff"),R(E.id,E.text,"b"));break;case"debuff":b&&(U(E.id,"debuff"),R(E.id,E.text,"f"));break;case"stun":b&&U(E.id,"stun");break;case"aoe":b&&X(E.side,E.color);break;case"death":{let y=x(E.id);y&&y.classList.add("dead");break}case"revive":{let y=x(E.id);y&&y.classList.remove("dead"),b&&(U(E.id,"heal"),R(E.id,"REVIVE","b"));break}case"end":le(E.result);break;default:break}}let te=!1;function le(E){te||(te=!0,i&&i(E==="lose"?"lose":"win"))}function oe(){let E=a[v++];for(let b of E.events)J(b,!0)}function se(){if(w||v>=a.length)return;let E=a[v];oe(),f=setTimeout(se,(E.d||500)*u/g)}function re(){for(clearTimeout(f);v<a.length;){let E=a[v++];for(let b of E.events)J(b,!1)}}let Q=t.querySelector("[data-play]");Q&&Q.addEventListener("click",function(){w=!w,this.setAttribute("aria-pressed",String(!w)),this.innerHTML=w?"&#9654; Play":"&#10074;&#10074; Pause",w?clearTimeout(f):se()});let ve=t.querySelector("[data-speed]");ve&&ve.addEventListener("click",function(){g=g===1?2:g===2?3:1,this.setAttribute("aria-pressed",String(g>1)),this.innerHTML="&times;"+g});let ne=t.querySelector("[data-skip]");return ne&&ne.addEventListener("click",()=>{re()}),r?re():se(),()=>{clearTimeout(f)}}function Wt(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var si=10;function Bc(t){let e=t&&t.progress||{},a=1;for(let r of Object.keys(e)){let s=Number(r);Number.isInteger(s)&&s>a&&(a=s)}return a}function zc(t){let e=Bc(t),a=t&&t.progress&&t.progress[String(e)]||{},r=Number(a.normal)||0,s=`Chapter ${we(e)}`;return r<=0?`${s} \xB7 not started`:r>=si?`${s} \xB7 complete`:`${s} \xB7 ${r} / ${si}`}var ni=`
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
.rn-del { background: transparent; border: 0; color: var(--steel); cursor: pointer; font-size: .72rem; letter-spacing: .08em; text-transform: var(--case); padding: .25rem .5rem; }
.rn-del:hover { color: var(--alarm); }
.rn-confirm { display: none; gap: .3rem; }
.rn-run.confirming .rn-del { display: none; }
.rn-run.confirming .rn-confirm { display: flex; }
.rn-yes { background: var(--alarm); color: #fff; border: 0; cursor: pointer; font-size: .7rem; letter-spacing: .08em; text-transform: var(--case); padding: .25rem .5rem; }
.rn-no { background: transparent; border: 1px solid var(--steel-faint); color: var(--steel); cursor: pointer; font-size: .7rem; letter-spacing: .08em; text-transform: var(--case); padding: .25rem .5rem; }

.rn-back { flex: none; align-self: flex-start; background: transparent; border: 1px solid var(--steel-dark); color: var(--steel-faint); cursor: pointer; font-size: .8rem; letter-spacing: .1em; text-transform: var(--case); padding: .5rem .9rem; --cut: .7em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.rn-back:hover { border-color: var(--coral); color: var(--coral); }
`;function ii({runs:t,activeRunId:e}){return`
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
    <div class="rn-list">${(Array.isArray(t)?t:[]).map(s=>{let n=Wt(s.runId),i=s.runId===e,l=s.name&&String(s.name).trim()?s.name:"Untitled run",h=i?'<span class="rn-badge">Active</span>':"",p=i?`<button class="rn-go" type="button" data-go="${n}">Continue</button>`:`<button class="rn-go switch" type="button" data-go="${n}">Switch</button>`;return`<article class="rn-run${i?" active":""}">`+h+`<div class="rn-info"><div class="rn-name">${Wt(l)}</div><p class="rn-scn">${Wt(s.scenario)}</p><span class="rn-prog">${Wt(zc(s))}</span></div><div class="rn-actions">`+p+`<button class="rn-del" type="button">Delete</button><span class="rn-confirm"><button class="rn-yes" type="button" data-del="${n}">Delete</button><button class="rn-no" type="button">Cancel</button></span></div></article>`}).join("")||'<p class="rn-empty">No runs yet.</p>'}</div>
    <button class="rn-back" type="button" data-back>&#9664; Back to the game</button>
  </div>
</div>`}function oi(t,{onNew:e,onSwitch:a,onDelete:r,onBack:s}){t.querySelector("[data-new]")?.addEventListener("click",()=>e&&e()),t.querySelector("[data-back]")?.addEventListener("click",()=>s&&s());for(let n of t.querySelectorAll("[data-go]"))n.addEventListener("click",()=>a&&a(n.getAttribute("data-go")));for(let n of t.querySelectorAll(".rn-del"))n.addEventListener("click",()=>n.closest(".rn-run")?.classList.add("confirming"));for(let n of t.querySelectorAll(".rn-no"))n.addEventListener("click",()=>n.closest(".rn-run")?.classList.remove("confirming"));for(let n of t.querySelectorAll("[data-del]"))n.addEventListener("click",()=>r&&r(n.getAttribute("data-del")))}function rt(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Gt(t){return(t<10?"0":"")+t}var ci=`
:host { all: initial; display: block; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.root {
  container-type: size;
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: pointer;
  /* The whole screen is a click-to-advance surface, so a click must never start a selection: you
     tap through a line and end up with the paragraph highlighted, or dragging the portrait. The
     backlog opts back in below, because there the text is meant to be read and copied. */
  user-select: none;
  -webkit-user-select: none;
  font-family: var(--body);
  color: var(--text);

  /* The scale ramp. Everything on this screen derives from it.
     \u2192 min(): the SCARCER dimension wins, so the screen fills its box without ever overflowing.
       1.81cqh IS 1.02cqw expressed in height at 16:9, so a 16:9 box behaves exactly as designed
       and only a taller or shorter box is affected \u2014 16:9 first, adaptive second.
     \u2192 the ceiling is a guard, not a working limit: at 13px a 1920 screen drew the interface at
       the size a 1275 one gets, which is what left it looking small and empty.
     cqh requires container-type: size on THIS element. topbar.js declares its ramp on
       .gf-bar, whose container is inline-size only, so it keeps the width term alone. */







  --sp-1: calc(var(--f) * 0.5);
  --sp-2: calc(var(--f) * 1.0);
  --sp-3: calc(var(--f) * 1.6);
  --sp-4: calc(var(--f) * 2.4);

  /* How much of the BAND the speaker's portrait takes. The band is .vn-stage, between the label
     and the narration box; the width comes from this height through the portrait's 2:3 ratio.
     Measured at 100%: 267x401, 15.4% of the stage. */
  --plate-h: 100%;
}

/* The scene. Atmospheric gradient today; character sprites drop into .vn-stage later. */
.vn-scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(80% 60% at 50% 116%, color-mix(in srgb, var(--coral) 14%, transparent) 0%, transparent 60%),
    radial-gradient(95% 75% at 82% 4%, #26364F 0%, transparent 58%),
    linear-gradient(168deg, #16202F 0%, #090E15 100%);
}
.vn-scene::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(0deg, rgba(6,10,16,0.72) 0%, transparent 42%);
}
/* THE TOP SCRIM. A story background can be a pale sky or fog, on which light text simply
   disappears, so the chapter label needs its own veil. It is checked by compositing the
   gradient's alpha AT THE TEXT'S HEIGHT against the worst case (white) and taking the WCAG
   ratio, in all five styles.
   It stays near-opaque until past the label and only then falls: a gradient already falling
   where the text lives is not enough. */
.vn-scene::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(6,10,16,0.92) 0%, rgba(6,10,16,0.88) 7%, transparent 16%);
}

.vn { position: absolute; inset: 0; display: flex; flex-direction: column; }

/* Top bar: exit + scene caption. Leaves the top-right corner free for the shell's
   fullscreen button (which floats over the stage). */
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
/* Uses --text, NOT --porcelain-2. This line is TEXT and that token is a SURFACE in half the
   styles: white at 14% and at 10% on the glass ones, and a dark brown on ember's black scrim.
   Measured: 1.6:1, 1.4:1 and 2.0:1, i.e. absent. Decide by the CSS PROPERTY, never by the
   value -- the two roles only coincide in the default style, which is what hid this. */
.vn-caption .loc { font-family: var(--display); font-size: var(--t-sm); font-weight: 700; letter-spacing: 0.1em; text-transform: var(--case); color: var(--text); }
.vn-caption .mood { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); }
/* The replay mark. Uses the TEXT token, never a surface one: this label is read against a
   generated background, and --porcelain-2 already left the title invisible in three styles. */
.vn-caption .vn-re { margin-left: calc(var(--f) * 0.7); padding: 0 calc(var(--f) * 0.4); font-weight: 700; color: var(--text); border: 1px solid color-mix(in srgb, var(--text) 40%, transparent); border-radius: var(--radius-sm); }

/* The sprite area (empty for now). */
.vn-stage { flex: 1; min-height: 0; position: relative; }

/* The dock trims the bar + box off the very edges and centres them (the box was too wide,
   edge to edge). Kept WIDE \u2014 the narration uses almost the whole width. Bar and box share
   this width, so they stay aligned. */
.vn-dock { width: min(88%, calc(var(--f) * 160)); margin: 0 auto; }

/* Band over the box: speaker tab (left) + tools (right). */
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

/* The text box. Translucent over the scene; chamfer at the bottom-right. */
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
.vn-text {
  font-family: var(--body);
  /* THE NARRATION READS ITS OWN SCALE, not the HUD one. Labels and figures want one size and
     long prose wants another: welded to the same knob their ratio was pinned at 1.42:1 across
     every step, so comfortable labels forced 31px of prose at the default. */
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
   A PANEL OVER THE SCENE, in the house vocabulary, and not a full-bleed sheet of its own.
   What it was: a hardcoded rgba veil filling the stage, a list capped to 70 units of ramp that
   left a third of the screen showing the artwork beside it, and every narration line wearing a
   NARRATION label of its own -- measured on a real beat, 9 of 11 entries carried it, so the
   labels weighed as much as the prose they introduced.
   It is the picker's shape because a picker is the same problem: something opened OVER a screen
   you have not left. Scrim, opaque panel, header with the title and the way out. */
.vn-log { user-select: text; -webkit-user-select: text; position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; cursor: pointer; }
/* The house scrim, the same one the picker and the mode menu use. The old one was a literal
   rgba(): a hardcoded colour cannot follow the five styles, which is the whole point of a token. */
.vn-log-veil {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(5px) saturate(0.75);
  background: radial-gradient(90% 70% at 50% 50%, color-mix(in srgb, var(--ink) 62%, transparent), color-mix(in srgb, var(--ink) 90%, transparent) 72%);
}
/* OPAQUE, over an opaque base: on the glass styles a translucent panel composites against the
   scene behind it and the contrast lands somewhere different in every style. */
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
/* Title and the way out, nothing else. It used to carry a Close button AND a "Tap outside to
   close" caption beside it: the button already says it, and tapping outside still works. */
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
/* NO reading cap: the panel IS the measure. Capping the list inside it left the prose in a column
   with the panel empty beside it, which is the gap the house rule says to fill rather than tile. */
.vn-log-list { overflow: auto; display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-3); min-height: 0; cursor: default; }
/* A NAMED speaker gets their name; NARRATION GETS NOTHING. Narration is the default voice of this
   screen, so labelling it repeats what the absence already says -- and it repeated on almost every
   row. Dialogue is set apart by the name plus the edge below, not by a caption on its neighbour. */
.vn-log-who { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--coral); margin-bottom: calc(var(--f) * 0.2); }
.vn-log-item.said { border-left: 2px solid var(--steel-dark); padding-left: var(--sp-2); }
/* The backlog is the same prose, re-read, so it follows the NARRATION scale and not the HUD one.
   Colour is --text and never --porcelain-2, which is a SURFACE token that only vanguard and bloom
   happen to give a light value. Measured against the panel ground, the ratios were 1.27 on signal,
   1.50 on aurora and 2.17 on ember -- the same colour as what it sits on. Same trap the speaker
   caption above carries a note about; decide by the CSS PROPERTY, never by the value.
   (No token name may be followed by a colon in a comment: the probe reads that as a re-declaration.) */
.vn-log-line { font-size: calc(var(--f) * 1.0 * var(--gf-narr-scale, 1)); line-height: 1.55; color: var(--text); }

/* \u2500\u2500 The speaker frame \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A framed column that OPENS at one side and pushes the narration box over, rather than a sprite
   floating over the scene. Why this shape and not a portrait laid on top:
   - Generated art is NOT a cut-out. Every image arrives opaque, with its own background and its
     own composition, so feathering it into the scene is content-dependent \u2014 the same fade flatters
     one portrait and ruins the next. A frame is deterministic, and object-fit NORMALIZES: a tall
     image and a square one reach the screen as the same silhouette.
   - Overlaying the box was the source of every defect: a full-height edge always surfaces in the
     gaps the centred box does not cover, and cutting the column at the box's top slices the art in
     half. With the box moved aside, nothing overlaps, so nothing can cross anything.
   The frame is flush to its screen edge and to the foot, and starts under the top bar, so exactly
   ONE edge is exposed \u2014 the inner one. That is the only thing to design, and it cannot look
   inconsistent from one portrait to the next. */
.vn-cast { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.vn-cast-in { position: relative; width: 100%; height: 100%; }

/* THE PORTRAIT RESTS ON THE BOX'S CEILING, not on the screen's floor, and that costs no
   number: .vn-cast lives INSIDE .vn-stage, the band between the label and the box, so bottom: 0
   IS that ceiling and stays correct when the box grows with a longer paragraph. A hand-measured
   bottom: 177px would be wrong on the first longer beat.
   It replaces a plate that reached the floor and made the BOX step aside instead (975 to 758px
   of width). With nothing beside it, the box runs full width and the dock needs no margin.
   And the WIDTH comes from the HEIGHT through the 2:3 ratio, never the other way round:
   anchored top and bottom the window decided the proportion (0.58 against 0.67) and cover ate
   the face from the sides. */
.vn-plate {
  position: absolute;
  bottom: 0;
  height: var(--plate-h);
  width: auto;
  aspect-ratio: 2 / 3;
  box-sizing: border-box;
  /* The edge is drawn as BACKGROUND, not as a border: clip-path cuts the border box, so on a
     chamfered style a real border comes out unstroked along the diagonal and the colour breaks at
     the corner. The plate IS the stroke and .vn-art sits on it, inset by the padding. */
  /* The style's accent, NOT the rarity ramp. Rarity (amber/violet) is Roster and Summon
     language, where rarity is the subject; here the frame is furniture, and painting it by rarity
     put a yellow frame on Signal's green palette. This is deliberately the SAME expression as
     .vn-box's top border above, so the frame and the narration box read as one piece of chrome. */
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

/* The art, clipped on the same angle so the stroke keeps an even width along the diagonal. Two
   layers so a second speaker on the same side CROSSFADES inside a frame that never moves. */
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
/* The same corner the Home's plate lost: where --plate-clip-* is none, only the frame's radius
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
/* No art yet (every hero until unit images exist): a figure in shadow, same box, same edges, so
   dropping art in later changes nothing about the layout. */
.vn-figure { position: absolute; left: 4%; bottom: 0; width: 92%; height: 88%; opacity: 0.4; color: var(--porcelain-3); }

/* THE DOCK NO LONGER MOVES. Two rules used to shrink it to clear the portrait, which reached
   the floor and stood beside it. With the plate on the box's ceiling there is nothing to clear:
   the box keeps its full width (975 against 758) instead of resizing whenever the speaker
   changes. The .vn data-portrait attribute stays: it expresses castSide(), which side each
   speaker opens on, and five checks read it. */

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`,Fc=380,Oc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4l14 8-14 8V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',Pc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5l9 7-9 7V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Dc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14M5 12h14M5 19h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',qc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',Hc='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function $c(t){return'<svg class="vn-figure" data-figure viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"'+(t?" hidden":"")+'><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>'}function Fa(t){return String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/gu,"").replace(/[^a-z0-9 ]/gu," ").replace(/\s+/gu," ").trim()}var jc=new Set(["you","yourself","me","myself","i","player","protagonist"]);function Oa(t,e){let a=Fa(e);if(!a||!Array.isArray(t)||!t.length)return null;for(let n of t)if(n&&Fa(n.name)===a)return n;if(jc.has(a)){let n=t.find(i=>i&&i.prota);if(n)return n}let r=a.split(" ")[0];if(!r)return null;let s=null;for(let n of t)if(n&&Fa(n.name).split(" ")[0]===r){if(s)return null;s=n}return s}function Yt(t){return t?t.prota?"left":"right":""}function li(t,e){let a=!!e&&Yt(e)===t,r=a&&e.art?String(e.art):"",s=n=>{let i=n==="a"&&r;return'<div class="vn-art" data-art="'+n+'"><img data-img alt=""'+(i?' src="'+rt(r)+'"':"")+(i?"":" hidden")+" />"+$c(!!i)+"</div>"};return'<div class="vn-plate" data-side="'+t+'" data-plate="'+t+'" data-open="'+(a?"true":"false")+'" data-front="a">'+s("a")+s("b")+"</div>"}function di({chapterLabel:t,nodeTitle:e,segments:a,cast:r=[],background:s="",replay:n=!1}){let i=Array.isArray(a)&&a.length?a:[{speaker:"",text:""}],l=i[0],h=!l.speaker,p=h?"Narration":l.speaker,d=Gt(1)+" / "+Gt(i.length),o=typeof s=="string"?s.trim():"",u=o?` style="background-image:url(${rt(o)});background-size:cover;background-position:center"`:"",f=Array.isArray(r)?r.filter(Boolean):[],v=f.length?Oa(f,l.speaker):null,w=f.length?`<div class="vn-cast" data-cast><div class="vn-cast-in">${li("left",v)}${li("right",v)}</div></div>`:"",g=Yt(v);return`
<div class="root">
  <div class="vn-scene"${u}></div>
  <div class="vn"${g?` data-portrait="${g}"`:""} data-vn>
    <div class="vn-top">
      <button class="vn-exit" type="button" data-exit>&#9664; Chapter</button>
      <span class="vn-caption"><span class="loc">${rt(e||"Story")}</span><span class="mood">${rt(t||"")}${n?'<b class="vn-re">Rereading &middot; free</b>':""}</span></span>
    </div>

    <div class="vn-stage">${w}</div>

    <div class="vn-dock">
      <div class="vn-bar">
        <span class="vn-who"${h?" data-narration":""} data-who>${rt(p)}</span>
        <div class="vn-tools">
          <button class="vn-tool" type="button" data-auto>${Oc}Auto</button>
          <button class="vn-tool" type="button" data-skip>${Pc}Skip</button>
          <button class="vn-tool" type="button" data-log>${Dc}Log</button>
        </div>
      </div>

      <div class="vn-box"${h?" data-narration":""} data-box>
        <div class="vn-text" data-text>${rt(l.text)}</div>
        <span class="vn-count" data-count>${d}</span>
        <span class="vn-next" data-next hidden>${qc}</span>
        <button class="vn-continue" type="button" data-continue hidden>${n?"Back to the map":"Continue"}${Hc}</button>
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
</div>`}function hi(t,e){let a=Array.isArray(e.segments)&&e.segments.length?e.segments:[{speaker:"",text:""}],{onContinue:r,onExit:s}=e,n=t.querySelector(".root"),i=t.querySelector("[data-box]"),l=t.querySelector("[data-who]"),h=t.querySelector("[data-text]"),p=t.querySelector("[data-count]"),d=t.querySelector("[data-next]"),o=t.querySelector("[data-continue]"),u=t.querySelector("[data-exit]"),f=t.querySelector("[data-auto]"),v=t.querySelector("[data-skip]"),w=t.querySelector("[data-log]"),g=t.querySelector("[data-log-box]"),x=t.querySelector("[data-log-list]"),S=t.querySelector("[data-log-close]"),A=typeof window<"u"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,z=0,U=!1,R=null,q=!1,L=null;function P(){R&&(clearInterval(R),R=null),U=!1}function X(){L&&(clearTimeout(L),L=null)}let J=t.querySelector("[data-vn]"),te={left:t.querySelector('[data-plate="left"]'),right:t.querySelector('[data-plate="right"]')},le=Array.isArray(e.cast)?e.cast.filter(Boolean):[],oe=Oa(le,a[0].speaker),se=oe?oe.name:null,re=Yt(oe),Q=null;function ve(C,K){!C||typeof C.setAttribute!="function"||(K?C.setAttribute("hidden",""):C.removeAttribute("hidden"))}function ne(C,K){if(!C)return;let Z=C.getAttribute("data-front")==="a"?"b":"a",c=C.querySelector('[data-art="'+Z+'"]');if(c){let m=c.querySelector("[data-img]"),_=c.querySelector("[data-figure]"),T=K&&K.art?String(K.art):"";m&&(T&&m.setAttribute("src",T),ve(m,!T)),ve(_,!!T)}C.setAttribute("data-front",Z)}function E(C,K){ne(te[C],K),te[C]&&te[C].setAttribute("data-open","true"),J&&J.setAttribute("data-portrait",C),re=C}function b(){for(let C of["left","right"])te[C]&&te[C].setAttribute("data-open","false");J&&J.removeAttribute("data-portrait"),re=""}function y(C){if(!te.left&&!te.right)return;let K=Oa(le,C.speaker),Z=K?K.name:null;if(Z===se)return;if(se=Z,Q&&(clearTimeout(Q),Q=null),!K){b();return}let c=Yt(K);if(re&&re!==c){b(),Q=setTimeout(()=>{Q=null,E(c,K)},Fc);return}E(c,K)}function k(C){let K=!C.speaker;l&&(l.textContent=K?"Narration":C.speaker,K?l.setAttribute("data-narration",""):l.removeAttribute("data-narration")),i&&(K?i.setAttribute("data-narration",""):i.removeAttribute("data-narration")),y(C)}function N(){let C=z>=a.length-1;d&&(d.hidden=C),o&&(o.hidden=!C)}function I(C){P(),h&&(h.textContent=C.text),N(),q&&z<a.length-1&&(L=setTimeout(ke,1500))}function G(C,K){if(P(),X(),k(C),p&&(p.textContent=Gt(z+1)+" / "+Gt(a.length)),d&&(d.hidden=!0),o&&(o.hidden=!0),!K||A){I(C);return}h&&(h.textContent=""),U=!0;let Z=0;R=setInterval(()=>{Z+=1,h&&(h.textContent=C.text.slice(0,Z)),Z>=C.text.length&&I(C)},18)}function ke(){if(X(),U){I(a[z]);return}z<a.length-1&&(z+=1,G(a[z],!0))}function Be(){if(!x)return;let C="";for(let Z=0;Z<=z;Z+=1){let c=!!a[Z].speaker;C+='<div class="vn-log-item'+(c?" said":"")+'">'+(c?'<div class="vn-log-who"></div>':"")+'<div class="vn-log-line"></div></div>'}x.innerHTML=C;let K=x.querySelectorAll(".vn-log-item");for(let Z=0;Z<=z;Z+=1){let c=K[Z];if(!c)continue;let m=c.querySelector(".vn-log-who"),_=c.querySelector(".vn-log-line");m&&(m.textContent=a[Z].speaker),_&&(_.textContent=a[Z].text)}g&&(g.hidden=!1)}function ae(){g&&(g.hidden=!0)}return n&&n.addEventListener("click",C=>{let K=C&&C.target;K&&K.closest&&K.closest("[data-exit],[data-continue],[data-auto],[data-skip],[data-log],[data-log-box]")||ke()}),o&&o.addEventListener("click",C=>{C&&C.stopPropagation&&C.stopPropagation(),r&&r()}),u&&u.addEventListener("click",C=>{C&&C.stopPropagation&&C.stopPropagation(),s&&s()}),f&&f.addEventListener("click",C=>{C&&C.stopPropagation&&C.stopPropagation(),q=!q,q?f.setAttribute("data-on",""):f.removeAttribute("data-on"),q&&!U&&z<a.length-1?L=setTimeout(ke,1200):X()}),v&&v.addEventListener("click",C=>{C&&C.stopPropagation&&C.stopPropagation(),X(),q=!1,f&&f.removeAttribute("data-on"),z=a.length-1,G(a[z],!1)}),w&&w.addEventListener("click",C=>{C&&C.stopPropagation&&C.stopPropagation(),Be()}),S&&S.addEventListener("click",C=>{C&&C.stopPropagation&&C.stopPropagation(),ae()}),g&&g.addEventListener("click",C=>{let K=C&&C.target;if(!K)return;(typeof K.closest=="function"?K.closest(".vn-log-panel"):K!==g)||ae()}),G(a[0],!1),()=>{P(),X(),Q&&(clearTimeout(Q),Q=null)}}var pi="marinara-capability-gacha-forge",Uc=900,Vc=new Set(["boot","banner","art","forge"]),Wc={busy:"Another portrait for this unit is still on its way. Give it a moment.","no-image-connection":"This world has no image connection \u2014 pick one in settings > Style.","engine-unreachable":"Could not reach the image service.","generation-failed":"The image backend refused this prompt. Shorter tags usually help.","upload-failed":"The gallery would not take that image.","bad-image":"That is not an image the gallery accepts (PNG, JPEG, WebP, GIF or AVIF).","too-large":"That image is too big to send. Crop it smaller or save it at a lower quality.","not-in-history":"That portrait is not kept any more.","not-allowed":"This unit's portrait is not ours to repaint.","not-found":"This unit is gone.","bad-request":"Something was missing from that request."},Pa="/api/gacha-forge",fi=`.gf-boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0E1420;color:#7E93AE;font-family:"Bahnschrift","Segoe UI",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem}.gf-boot::before{content:'';width:.6rem;height:.6rem;background:#F2603C;transform:rotate(45deg);margin-right:.6rem;animation:gf-boot-blink .9s steps(2) infinite}@keyframes gf-boot-blink{50%{opacity:.2}}.gf-boot-bad{flex-direction:column;gap:.8rem;color:#C7D3E2;text-transform:none;letter-spacing:.04em;font-size:.85rem;text-align:center;padding:1.2rem}.gf-boot-bad::before{display:none}.gf-boot-bad button{cursor:pointer;font:inherit;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;border:1px solid #F2603C;background:#F2603C;color:#10151F}`,Da=class extends HTMLElement{constructor(){super(),this._root=this.attachShadow({mode:"open"}),this._props={},this._onPropsChange=()=>this._apply(),this._initState()}_initState(){this._drawnView=null,this._renderKey=null,this._helpOpen=new Set,this._eventId="login",this._eventsRev=0,this._login=null,this._loginKey="",this._eventGained=null,this._loginOpen=!1,this._loginSeen=!1,this._pass=null,this._passKey="",this._passTab="daily",this._boot="idle",this._bootError="",this._pick=null,this._pickOptions=null,this._pickRev=0,this._runs=[],this._runsRev=0,this._runsKey="",this._activeRunId=null,this._run=null,this._showRuns=!1,this._creatingNew=!1,this._bannerReady=!1,this._bannerState="idle",this._wallet=null,this._nodePay=null,this._storyNotice="",this._storyStarting=!1,this._rosterCount=0,this._artReady=!0,this._artState="idle",this._art={done:0,total:0,name:""},this._artBlocking=!1,this._plan=null,this._planState="idle",this._planChapter=1,this._forgeCleanup=null,this._roster=null,this._rosterState="idle",this._rosterCat="char",this._rosterRarity="all",this._rosterQuery="",this._rosterUnitId=null,this._rosterRev=0,this._unit=null,this._farmBusy=!1,this._farm=null,this._farmState="idle",this._farmView="root",this._farmRev=0,this._inventory=null,this._inventoryState="idle",this._invSection="relics",this._invView={slot:"all",rarity:"all",picked:"",feeding:null,gained:[]},this._invRev=0,this._invBusy=!1,this._result=null,this._busyLocal=new Map,this._busySeq=0,this._resultRev=0,this._growth=null,this._growthRev=0,this._feed=null,this._unitLevel=1,this._unitBond=0,this._unitState="idle",this._gearSlot=null,this._gearFeed=null,this._relics=null,this._relicsRev=0,this._feedBusy=!1,this._equipBusy=!1,this._unitTab="profile",this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev=0,this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._summonResults=null,this._summonWallet=null,this._summonCleanup=null,this._formation=null,this._formationState="idle",this._formationBattleMode=!1,this._pendingCombat=null,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._combatNode=null,this._combatPreset=null,this._battleLoading=!1,this._combatCleanup=null,this._hudView="home",this._difficulty="normal",this._chapterProgress={normal:0,hard:0,veryhard:0},this._chaptersData=null,this._chaptersState="idle",this._beatState="idle",this._beat=null,this._beatCast=null,this._activeStoryNode=null,this._beatRequested=!1,this._beatCleanup=null,this._contextTokens=0,this._warnTokens=3e4,this._continuity=null,this._continuityState="idle",this._compressing=null,this._settingsCategory=Ke,this._settingsFrom="home",this._settingsRev=0}get capabilityProps(){return this._props}set capabilityProps(e){this._props=e&&typeof e=="object"?e:{},this._boot==="ready"&&this._refreshState(),this._apply()}static get observedAttributes(){return["view"]}attributeChangedCallback(){this._apply()}connectedCallback(){this.addEventListener("marinara-capability-props",this._onPropsChange),this._boot==="ready"&&this._resync(),this._apply()}disconnectedCallback(){this.removeEventListener("marinara-capability-props",this._onPropsChange),this._stopForge(),this._stopBeat(),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null)}_reportError(e){let a=e instanceof Error?e.message:String(e);this.capabilityRuntimeError=a,this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:a}}))}_apply(){try{(this.getAttribute("view")||"browser")==="browser"?this._renderBrowser():this._root.innerHTML=""}catch(e){this._reportError(e)}}_state(){return this._boot!=="ready"?"boot":this._showRuns?"runs":this._bootError&&!this._creatingNew?"unreachable":this._creatingNew||!this._run?"setup":this._bannerReady?!this._artReady&&this._artBlocking?"art":this._hudView==="roster"?this._rosterUnitId?"unit":"roster":this._hudView==="summon"?"summon":this._hudView==="formation"?"formation":this._hudView==="combat"?"combat":this._hudView==="modes"?"modes":this._hudView==="chapters"?"chapters":this._hudView==="farm"?"farm":this._hudView==="inventory"?"inventory":this._hudView==="settings"?"settings":this._hudView==="events"?"events":this._hudView==="result"&&this._result?"result":this._plan==null?"forge":this._beatState!=="idle"?"beat":this._hudView==="chapter"?"chapter":"hud":"banner"}_onLoaderScreen(e){return Vc.has(e)?!0:e==="beat"?this._beatState!=="ready":e==="combat"?this._combatPhase==="loading":!1}_chapterLabel(){return`Chapter ${we(this._planChapter)} \xB7 ${this._plan&&this._plan.title||"Story"}`}_walletKey(){let e=this._wallet;return e?[e.aether,e.funds,e.vigor,e.vigorMax].join(","):""}_decorKey(){let e=this._run&&this._run.decor||null;return e?JSON.stringify(e):""}_pickKey(){return this._pick?[this._pick.slot,this._pick.source,this._pickRev].join("/"):""}_narrationScale(){let e=this._run||{};return We(e.narrationScale==null?e.textScale:e.narrationScale)}_syncTypeScale(){let e=Ve(this._run&&this._run.textScale),a=this._narrationScale();this._typeScale===e&&this._narrScale===a||(this._typeScale=e,this._narrScale=a,this.style&&typeof this.style.setProperty=="function"&&(this.style.setProperty("--gf-type-scale",String(e)),this.style.setProperty("--gf-narr-scale",String(a))))}async _setTextScale(e){if(!this._run)return;let a=Ve(e),r=this._run.textScale;if(Ve(r)===a)return;this._run.textScale=a,this._renderBrowser();let s=await this._postJson("/run/text-scale",{runId:this._run.runId,textScale:a});(!s||!s.ok)&&(this._run.textScale=r,this._renderBrowser())}async _setNarrationScale(e){if(!this._run)return;let a=We(e),r=this._run.narrationScale;if(We(r)===a)return;this._run.narrationScale=a,this._renderBrowser();let s=await this._postJson("/run/narration-scale",{runId:this._run.runId,narrationScale:a});(!s||!s.ok)&&(this._run.narrationScale=r,this._renderBrowser())}_renderBrowser(){this._syncTypeScale();let e=this._state();this._persistNav();let a=e==="runs"?`runs:${this._runsRev}:${this._activeRunId}`:e==="setup"?`setup:${this._creatingNew?"new":"first"}`:e==="banner"?`banner:${this._bannerState==="error"?"error":"loading"}`:e==="art"?`art:${this._artState}:${this._art.done}/${this._art.total}:${this._art.name}`:e==="forge"?`forge:${this._planState==="error"?"error":"loading"}`:e==="beat"?`beat:${this._beatState}:${this._activeStoryNode?this._activeStoryNode.nodeIndex:0}:${this._activeStoryNode&&this._activeStoryNode.replay?"re":""}`:e==="modes"?`modes:${this._planChapter}:${this._homeNodesDone()}`:e==="chapters"?"chapters":e==="roster"?`roster:${this._rosterState}:${this._rosterCat}:${this._rosterRarity}:${this._rosterQuery}:${this._rosterRev}`:e==="summon"?`summon:${this._summonPhase}:${this._summonBannerId}:${this._summonBannerState}:${this._summonDetails?"d":""}:${this._summonArting?"a":""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.title||""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.art||""}`:e==="formation"?`formation:${this._formationState}:${this._formationBattleMode?"battle":"hud"}`:e==="combat"?`combat:${this._combatPhase}:${this._combatNode?this._combatNode.combatIndex:0}:${this._combatNonce||0}`:e==="unit"?`unit:${this._rosterUnitId}:${this._unitState}:${this._unitTab}:${this._growthRev}:${this._gearSlot||""}:${this._gearFeed?this._gearFeed.picked.join(",")+":"+this._relicsRev:""}:${this._portraitOpen?"pt":""}${this._portraitCrop?":crop":""}:${this._portraitRev}:${this._portraitBusy?"busy":""}:${this._portraitError?"err":""}`:e==="chapter"?`chapter:${this._planChapter}:${this._difficulty}:${this._chapterProgress[this._difficulty]}:${this._nodePay?"pay":""}:${this._storyNotice}`:e==="farm"?`farm:${this._farmView}:${this._farmState}:${this._farmRev}`:e==="result"?`result:${this._resultRev}`:e==="settings"?`set:${this._settingsCategory}:${this._run.hudStyle||""}:${this._contextTokens}:${this._warnTokens}:${this._settingsRev}`:e==="events"?`ev:${this._eventId}:${this._passTab}:${this._eventsRev}`:e==="inventory"?`inv:${this._invSection}:${this._inventoryState}:${this._invRev}:${this._invView.slot}:${this._invView.rarity}:${this._invView.picked}:${this._invView.feeding?this._invView.feeding.targetId+","+this._invView.feeding.picked.join("|"):""}`:e==="hud"?`hud:${this._planChapter}:${this._plan&&this._plan.title||""}:${this._homeNodesDone()}:${this._run.hudStyle||""}:${this._decorKey()}:${this._pickKey()}:${this._loginOpen?"ev"+this._eventsRev:""}:${this._contextTokens}/${this._warnTokens}`:e,r=this._onLoaderScreen(e)?[]:this._busyTasks(),s=a+"|ts:"+(this._typeScale||1)+"|ns:"+(this._narrScale||1)+"|busy:"+Nn(r);if(this._syncBar(),Xe(this._root,this._contextTokens,this._warnTokens),this._drawnView==="browser"&&this._renderKey===s)return;let n=this._lastScreen!==e;this._entering=n;let i=!n&&this._drawnView==="browser";this._lastScreen=e,this._drawnView="browser",this._renderKey=s,this._stopForge(),this._stopBeat(),this._stopSummon(),this._stopCombat();let l="";if(e==="boot")l=`<style>${fi}</style><div class="gf-boot">Loading</div>`;else if(e==="unreachable"){let o=String(this._bootError||"").replace(/[&<>"]/g,u=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[u]);l=`<style>${fi}</style><div class="gf-boot gf-boot-bad"><span>Couldn&rsquo;t reach the game server &mdash; ${o}</span><button type="button" data-boot-retry>Retry</button></div>`}else if(e==="runs")l=`<style>${ni}</style>${ii({runs:this._runs,activeRunId:this._activeRunId})}`;else if(e==="setup")l=`<style>${br}</style>${wr({cancelable:this._creatingNew})}`;else if(e==="banner")l=`<style>${ot}</style>${Lt({scenario:this._run.scenario,mode:"banner",error:this._bannerState==="error"})}`;else if(e==="art")l=`<style>${ot}</style>${Lt({scenario:this._run.scenario,mode:"art",error:this._artState==="blocked",art:this._art})}`;else if(e==="roster")l=`<style>${ba}</style>${Ms({cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,state:this._rosterState,q:this._rosterQuery})}`;else if(e==="unit")this._portraitOpen?l=`<style>${Ds}</style>${qs({unit:this._unit,view:this._portraitCrop?"crop":"edit",draft:this._portraitDraft,history:this._portrait&&this._portrait.strip||[],historyMax:this._portrait&&this._portrait.historyMax||0,busy:this._portraitBusy,error:this._portraitError,crop:this._portraitCrop,promptName:this._portrait&&this._portrait.promptName||""})}`:l=`<style>${ba}</style>${Fs({unit:this._unit,level:this._unit?this._unitLevel:1,bond:this._unit?this._unitBond:0,tab:this._unitTab,state:this._unitState,growth:this._growthView(),gear:this._growth&&this._growth.gear,gearSlot:this._gearSlot,gearFeed:this._gearFeedView(),facets:this._growth&&this._growth.facets})}`;else if(e==="summon")if(this._summonPhase==="reveal")l=`<style>${za}</style>${zn({results:this._summonResults||[]})}`;else{let o=this._summonBanner;l=`<style>${za}</style>${Bn({banners:o&&o.banners||[],banner:o&&o.banner,rates:o&&o.rates,pity:o&&o.pity,wallet:o&&o.wallet||this._wallet,cost:o&&o.cost||160,bannerId:this._summonBannerId,state:this._summonBannerState,details:this._summonDetails,arting:this._summonArting})}`}else if(e==="formation")l=`<style>${qn}</style>${Xn({state:this._formationState==="ready"?"ready":this._formationState==="error"?"error":"loading",data:this._formation,battleMode:this._formationBattleMode})}`;else if(e==="combat")l=`<style>${ti}</style>${ai({phase:this._combatPhase,payload:this._combat,node:this._combatNode,vigor:this._vigorView(),error:this._combatError||""})}`;else if(e==="forge")l=`<style>${ot}</style>${Lt({scenario:this._run.scenario,chapter:this._planChapter,error:this._planState==="error"})}`;else if(e==="beat")l=this._beatState==="ready"?`<style>${ci}</style>${di({chapterLabel:this._chapterLabel(),nodeTitle:this._activeStoryNode&&this._activeStoryNode.title,segments:this._beat,cast:this._beatCast||[],background:this._nodeBackground(),replay:!!(this._activeStoryNode&&this._activeStoryNode.replay)})}`:`<style>${ot}</style>${Mr({chapterTitle:this._plan&&this._plan.title,error:this._beatState==="error"})}`;else if(e==="modes"){let o=this._plan;l=`<style>${$s}</style>${js({story:{hasPlan:!!o,title:o?o.title:"",premise:o?o.premise:"",chapterLabel:`Chapter ${this._planChapter}`,done:this._homeNodesDone(),total:10}})}`}else e==="farm"?l=`<style>${Ws}</style>${Gs({view:this._farmView,data:this._farm,state:this._farmState})}`:e==="result"?l=`<style>${kn}</style>${_n(this._result||{})}`:e==="inventory"?l=`<style>${Zs}</style>${en({section:this._invSection,data:this._inventory,view:this._invView,state:this._inventoryState})}`:e==="events"?l=`<style>${dn}</style>${vn({eventId:this._eventId,view:this._eventId==="pass"?this._passViewOut():this._loginViewOut(),from:"Home",passTab:this._passTab})}`:e==="settings"?l=`<style>${Cr}</style>${Ar({category:this._settingsCategory,backLabel:this._settingsBackLabel(),contextTokens:this._contextTokens,warnTokens:this._warnTokens,hudStyle:this._run.hudStyle,textScale:this._run.textScale,narrationScale:this._narrationScale(),tokenLog:this._tokenLog,loreStatus:this._loreStatus,run:this._run,helpOpen:this._helpOpen})}`:e==="chapters"?l=`<style>${Or}</style>${Pr()}`:e==="chapter"?l=`<style>${ir}</style>${or({plan:this._plan,difficulty:this._difficulty,progress:this._chapterProgress,chapterNumber:this._planChapter,pay:this._nodePay&&this._nodePay[this._difficulty],cp:this._chapterCp,notice:this._storyNotice})}`:l=`<style>${$a}</style>${pr({plan:this._plan,chapterNumber:this._planChapter,nodesDone:this._homeNodesDone(),decor:this._run.decor,pick:this._pick,pickOptions:this._pickOptions,contextTokens:this._contextTokens,warnTokens:this._warnTokens})}`+(this._loginOpen?`<style>${cn}</style>${gn({view:this._loginViewOut()})}`:"");let h=e==="combat"&&this._combatPhase!=="prebattle",p=!!this._run&&!h&&Wa.has(e),d=p?Ya({username:this._run.username,wallet:this._wallet,account:this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:null}):"";this._root.innerHTML=`<style>${er}${Cn}${rr}</style>`+ar(l+In(r),{runs:!!this._run&&e!=="runs",style:this._run&&this._run.hudStyle,entering:n,swapping:i,bar:d,help:this._helpOpen,onScreen:e==="settings"?this._settingsCategory:""}),p&&Ja(this._root),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null),p&&(this._stopVigorClock=Xa(this._root,{nextMs:this._wallet?this._wallet.vigorNextMs:null,periodMs:this._wallet&&this._wallet.vigorPerMs||this._run&&this._run.vigorPerMs,onLanded:()=>this._refreshState&&this._refreshState()})),Nr(this._root,{open:e==="settings",category:this._settingsCategory,run:this._run,onOpen:o=>this._openSettings(o),onBack:()=>this._leaveSettings(),onCategory:o=>this._openSettings(o),onStyle:o=>this._setHudStyle(o),onTextScale:o=>this._setTextScale(o),onNarrationScale:o=>this._setNarrationScale(o),onWarnTokens:o=>this._setWarnTokens(o),onSources:o=>this._setSources(o)}),tr(this._root,{onToggle:(o,u)=>{u?this._helpOpen.add(o):this._helpOpen.delete(o)}}),this._wireFullscreen(),this._wireRunsButton();{let o=this._root.querySelector("[data-boot-retry]");o&&o.addEventListener("click",()=>{this._boot="idle",this._loadState(),this._renderBrowser()})}if(e==="runs")this._wireRuns();else if(e==="setup")kr(this._root,{onCreate:o=>this._createRun(o),onCancel:()=>{this._creatingNew=!1,this._renderBrowser()}});else if(e==="banner"){let o=this._bannerState==="error";this._forgeCleanup=lt(this._root,{cycle:!o,phases:la,onRetry:()=>this._loadStandardBanner()}),this._bannerState==="idle"&&this._loadStandardBanner()}else if(e==="art")this._forgeCleanup=lt(this._root,{cycle:!1,onRetry:()=>this._finishArt()}),this._ensureArtRunning();else if(e==="roster")Os(this._root,{onOpenUnit:o=>this._openUnit(o),onBack:()=>{this._hudView="home",this._renderBrowser()},onCat:o=>{this._rosterCat=o==="wpn"?"wpn":"char",this._renderBrowser()},onRarity:o=>{this._rosterRarity=o,this._renderBrowser()},onSearch:o=>{this._rosterQuery=o,Ls(this._root,{cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,q:o,state:this._rosterState})}}),this._rosterState==="idle"&&this._loadRoster();else if(e==="unit"&&this._portraitOpen)Hs(this._root,{onBack:()=>this._portraitClose(),onDraft:o=>this._portraitEdit(o),onGenerate:()=>this._portraitGenerate(),onPick:o=>this._portraitPick(o),onFile:o=>this._portraitFile(o),onCropSize:o=>this._portraitSize(o),onCropFrame:o=>this._portraitDrag(o),onCropOk:()=>this._portraitUpload(),onCropCancel:()=>{this._portraitCrop=null,this._renderBrowser()}});else if(e==="unit")Ps(this._root,{onTab:o=>{this._unitTab=o,this._renderBrowser()},onFeed:o=>this._feedAdd(o),onFeedReset:()=>this._feedReset(),onFeedGo:()=>this._feedCommit(),onAscend:()=>this._ascend(),onFormUp:o=>this._formUp(o),onBack:()=>{this._rosterUnitId=null,this._unit=null,this._unitState="idle",this._gearSlot=null,this._loadRoster()},onSetParty:()=>this._openFormation(),onPortrait:()=>this._portraitOpenStudio(),onGearSlot:o=>{this._gearSlot=o,this._renderBrowser()},onGearBack:()=>{this._gearSlot=null,this._gearFeed=null,this._renderBrowser()},onEquip:o=>this._equip(o),onOpenWeapon:o=>this._openUnit(o,"growth"),onRelicFeed:o=>this._relicFeed(o)}),this._unitState==="idle"&&this._loadUnit();else if(e==="summon")this._summonPhase==="reveal"?this._summonCleanup=On(this._root,{results:this._summonResults||[],onContinue:()=>{this._summonPhase="banner",this._renderBrowser()}}):(Fn(this._root,{banners:this._summonBanner&&this._summonBanner.banners||[],onBanner:o=>{o!==this._summonBannerId&&(this._summonBannerId=o,this._summonDetails=!1,this._summonArting=!1,this._summonBannerState="idle",this._summonBanner=null,this._renderBrowser())},onDetails:o=>{this._summonDetails=!!o,this._renderBrowser()},onRedoArt:()=>this._redoBannerArt(),onPull:o=>this._summonPull(o),onBack:()=>{this._hudView="home",this._renderBrowser()}}),this._summonBannerState==="idle"&&this._loadSummonBanner());else if(e==="formation")Jn(this._root,{data:this._formationState==="ready"?this._formation:null,onSave:(o,u)=>this._saveFormation(o,u),onBack:()=>{if(this._formationBattleMode){let o=!!(this._pendingCombat&&this._pendingCombat.farm);this._formationBattleMode=!1,this._pendingCombat=null,o?(this._farmBusy=!1,this._pendingFarm=null,this._hudView="farm"):this._hudView="chapter"}else this._hudView="home";this._renderBrowser()},onIntoBattle:()=>this._enterBattle(),onRetry:()=>this._loadFormation()}),this._formationState==="idle"&&this._loadFormation();else if(e==="combat")this._combatCleanup=ri(this._root,{phase:this._combatPhase,steps:this._combatSteps||[],onStart:()=>this._startBattle(),onPickPreset:o=>this._pickCombatPreset(o),onRetry:()=>this._loadBattle(),onBack:()=>this._exitCombat(!1),onFinished:o=>this._combatFinished(o)}),this._combatPhase==="loading"&&this._loadBattle();else if(e==="forge"){let o=this._planState==="error";this._forgeCleanup=lt(this._root,{cycle:!o,onRetry:()=>this._loadChapterPlan()}),this._planState==="idle"&&this._loadChapterPlan()}else e==="beat"?this._beatState==="loading"?this._beatRequested||(this._beatRequested=!0,this._loadBeat()):this._beatState==="error"?this._forgeCleanup=lt(this._root,{cycle:!1,onRetry:()=>this._retryBeat()}):this._beatCleanup=hi(this._root,{segments:this._beat,cast:this._beatCast||[],onContinue:()=>this._activeStoryNode&&this._activeStoryNode.replay?this._exitStoryBeat():this._completeStoryBeat(),onExit:()=>this._exitStoryBeat()}):e==="modes"?Us(this._root,{onPick:o=>{if(o==="materials"){this._openFarm();return}o==="story"&&(this._hudView="chapters",this._renderBrowser())},onBack:()=>{this._hudView="home",this._renderBrowser()}}):e==="farm"?(Ys(this._root,{onBack:()=>{if(this._farmView!=="root"){this._farmView="root",this._renderBrowser();return}this._hudView="modes",this._renderBrowser()},onOpen:o=>{this._farmView=o==="form"?"form":"asc",this._renderBrowser()},onRun:o=>this._farmRun(o)}),this._farmState==="idle"&&this._loadFarm()):e==="result"?Sn(this._root,{onContinue:()=>this._closeResult(),onAgain:()=>this._resultAgain()}):e==="inventory"?(tn(this._root,{onBack:()=>{if(this._invView.feeding){this._invView.feeding=null,this._renderBrowser();return}this._hudView="home",this._renderBrowser()},onSection:o=>{this._invSection!==o&&(this._invSection=o,this._invView={...this._invView,feeding:null,gained:[]},this._renderBrowser())},onFilter:(o,u)=>{this._invView={...this._invView,[o]:u},this._renderBrowser()},onPick:o=>{this._invView={...this._invView,picked:o,gained:[]},this._renderBrowser()},onLock:o=>this._relicLock(o),onUpgrade:o=>{this._invView={...this._invView,picked:o,gained:[],feeding:{targetId:o,picked:[]}},this._renderBrowser()},onFeedPick:o=>{let u=this._invView.feeding;if(!u)return;let v=u.picked.indexOf(o)>=0?u.picked.filter(w=>w!==o):u.picked.concat([o]);this._invView={...this._invView,feeding:{...u,picked:v}},this._renderBrowser()},onFeedGo:()=>this._relicFeedFromInventory(),onFeedCancel:()=>{this._invView={...this._invView,feeding:null},this._renderBrowser()}}),this._inventoryState==="idle"&&this._loadInventory()):e==="events"?(mn(this._root,{onBack:()=>{this._hudView="home",this._renderBrowser()},onPick:o=>{this._eventId!==o&&(this._eventId=o,this._eventGained=null,this._eventsRev+=1,this._renderBrowser())},onClaim:()=>this._eventId==="pass"?this._claimPass():this._claimLogin(),onTab:o=>{this._passTab!==o&&(this._passTab=o,this._renderBrowser())},onReroll:o=>this._rerollMission(o)}),this._entering&&this._refreshState()):e==="chapters"?this._wireChapters():e==="chapter"?this._wireChapter():e==="hud"&&(fr(this._root,{onOpenModes:()=>{this._hudView="modes",this._renderBrowser()},onOpenRoster:()=>this._openRoster(),onOpenSummon:()=>this._openSummon(),onOpenFormation:()=>this._openFormation(),onOpenInventory:()=>this._openInventory(),onOpenEvents:()=>{this._hudView="events",this._renderBrowser()},onPickOpen:o=>this._openPick(o),onPickClose:()=>this._closePick(),onPickSource:o=>this._pickSource(o),onPickTake:o=>this._takePick(o)}),this._loginOpen&&bn(this._root,{onClose:()=>{this._loginOpen=!1,this._loginSeen=!0,this._renderBrowser()},onClaim:()=>this._claimLogin()}));e==="settings"&&this._settingsCategory==="continuity"&&this._continuity&&this._fillContinuity(),this._boot==="idle"&&this._loadState(),this._ensureArtRunning()}async _setHudStyle(e){if(!this._run||!this._run.runId)return;let a=this._run.hudStyle;this._run.hudStyle=e,this._renderBrowser();let r=await this._postJson("/run/style",{runId:this._run.runId,hudStyle:e});r&&r.ok||(this._run.hudStyle=a,this._renderBrowser())}_homeNodesDone(){let a=(this._run&&this._run.progress||{})[String(this._planChapter)]||{};return Number(a.normal)||0}_wireFullscreen(){let e=()=>{document.fullscreenElement?document.exitFullscreen?.():this.requestFullscreen?.()};for(let a of[".gf-fs",".gf-fs-exit",".gf-fs-bar"]){let r=this._root.querySelector(a);r&&r.addEventListener("click",e)}this._wireLandscape()}_wireLandscape(){let e=this._root.querySelector("[data-go-landscape]");e&&e.addEventListener("click",async()=>{try{!document.fullscreenElement&&this.requestFullscreen&&await this.requestFullscreen()}catch{}let a=typeof screen<"u"?screen.orientation:null;if(!a||typeof a.lock!="function"){this._landscapeFallback();return}try{await a.lock("landscape")}catch{this._landscapeFallback()}})}_landscapeFallback(){let e=this._root.querySelector("[data-rot-title]"),a=this._root.querySelector("[data-rot-note]");e&&(e.textContent="Turn your phone"),a&&(a.textContent="This game plays in a 16:9 landscape frame. Your browser cannot rotate it for you.")}_wireRunsButton(){let e=[];for(let a of["[data-open-runs]",".gf-runs-bar"]){let r=this._root.querySelector(a);!r||e.indexOf(r)>=0||(e.push(r),r.addEventListener("click",()=>{this._showRuns=!0,this._renderBrowser(),this._refreshState()}))}}_adoptRun(e){this._stopSummon(),this._stopCombat();let a={_boot:this._boot,_bootError:this._bootError,_runs:this._runs,_activeRunId:this._activeRunId,_busyLocal:this._busyLocal,_busySeq:this._busySeq};this._initState(),Object.assign(this,a),this._run=e||null,this._activeRunId=e?e.runId:null,this._creatingNew=!1,this._planChapter=1,this._hudView="home",this._bannerReady=!!(e&&e.hasStandardBanner),this._artReady=!(e&&Number(e.artPending)>0),this._wallet=e&&e.wallet||null,this._rosterCount=e&&Number(e.rosterCount)||0,this._warnTokens=e&&Number(e.warnTokens)||3e4}_adoptRuns(e){let a=Array.isArray(e)?e:[],r=JSON.stringify(a.map(s=>[s.runId,s.name,s.scenario,s.progress]));if(r===this._runsKey){this._runs=a;return}this._runsKey=r,this._runs=a,this._runsRev+=1}_adoptGlobals(e){if(!e)return;e.nodePay&&(this._nodePay=e.nodePay);let r=e.events||e.activeRun&&e.activeRun.events||(e.pass?{pass:e.pass}:null);if(!r)return;if(r.pass){let n=JSON.stringify(r.pass);n!==this._passKey&&(this._passKey=n,this._pass=r.pass,this._eventsRev+=1)}if(!r.login)return;let s=JSON.stringify(r.login);s!==this._loginKey&&(this._loginKey=s,this._login=r.login,this._eventsRev+=1,this._login.ready&&!this._loginSeen&&(this._loginOpen=!0))}_loginViewOut(){return this._login?this._eventGained?{...this._login,gained:this._eventGained}:this._login:null}_passViewOut(){return this._pass?this._eventGained?{...this._pass,gained:this._eventGained}:this._pass:null}_claimPass(){this._claimingLogin||(this._claimingLogin=!0,this._postJson("/pass/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._eventGained=Array.isArray(e.gained)?e.gained:null,this._eventsRev+=1)}).catch(()=>{}).then(()=>{this._claimingLogin=!1,this._renderBrowser()}))}_rerollMission(e){!e||this._rerolling||(this._rerolling=!0,this._postJson("/pass/reroll",{runId:this._activeRunId,missionId:e}).then(()=>{this._eventsRev+=1}).catch(()=>{}).then(()=>{this._rerolling=!1,this._renderBrowser()}))}_claimLogin(){this._claimingLogin||(this._claimingLogin=!0,this._postJson("/events/claim",{runId:this._activeRunId}).then(e=>{!e||!e.ok||(this._eventGained=Array.isArray(e.gained)?e.gained:null,this._eventsRev+=1)}).catch(()=>{}).then(()=>{this._claimingLogin=!1,this._renderBrowser()}))}_loadState(){this._boot="loading",this._bootError="",be(`${Pa}/state`).then(e=>{if(!e)throw new Error("no response");if(!e.ok)throw new Error("HTTP "+e.status);return typeof e.json=="function"?e.json():null}).then(e=>{this._adoptRuns(e&&e.runs),this._activeRunId=e&&e.activeRunId||null,this._run=e&&e.activeRun||null,this._adoptGlobals(e),this._run&&Number.isFinite(Number(this._run.contextTokens))&&(this._contextTokens=Number(this._run.contextTokens)||0),this._warnTokens=this._run&&Number(this._run.warnTokens)||3e4,this._bannerReady=!!(this._run&&this._run.hasStandardBanner),this._artReady=!(this._run&&Number(this._run.artPending)>0),this._wallet=this._run&&this._run.wallet||null,this._rosterCount=this._run&&Number(this._run.rosterCount)||0}).catch(e=>{this._run=null,this._bootError=String(e&&e.message||"unreachable")}).then(()=>{this._run&&(this._restoreNav(),this._reconcileGenerating({boot:!0})),this._boot="ready",this._renderBrowser()})}_navKey(){return`gacha-forge:nav:${this._run?this._run.runId:"none"}`}_persistNav(){if(!(!this._run||this._boot!=="ready"))try{if(typeof localStorage>"u")return;localStorage.setItem(this._navKey(),JSON.stringify({v:this._hudView,ch:this._planChapter,combat:this._combatNode}))}catch{}}_restoreNav(){let e=null;try{if(typeof localStorage>"u")return;let a=localStorage.getItem(this._navKey());a&&(e=JSON.parse(a))}catch{return}!e||typeof e!="object"||(Number.isInteger(e.ch)&&e.ch>=1&&(this._planChapter=e.ch),["chapters","chapter","roster","summon","formation","combat","farm","inventory","settings","events"].includes(e.v)&&(this._hudView=e.v),e.v==="combat"&&e.combat&&typeof e.combat.combatIndex=="number"&&(this._combatNode=e.combat,this._combatPhase="loading"))}_resync(){this._renderKey=null,this._bannerState==="loading"&&(this._bannerState="idle"),this._planState==="loading"&&(this._planState="idle"),this._summonBannerState==="loading"&&(this._summonBannerState="idle"),this._formationState==="loading"&&(this._formationState="idle"),this._rosterState==="loading"&&(this._rosterState="idle"),this._farmState==="loading"&&(this._farmState="idle"),this._inventoryState==="loading"&&(this._inventoryState="idle"),this._unitState==="loading"&&(this._unitState="idle"),this._continuityState==="loading"&&(this._continuityState="idle"),this._tokenLog&&this._tokenLog.status==="loading"&&(this._tokenLog={...this._tokenLog,status:"idle"}),this._beatState==="loading"&&(this._beatRequested=!1),this._combatPhase==="loading"&&(this._combatPhase="loading"),this._refreshState()}_refreshState(){this._refreshing||(this._refreshing=!0,be(`${Pa}/state`).then(e=>e&&typeof e.json=="function"?e.json():null).then(e=>{e&&(Array.isArray(e.runs)&&this._adoptRuns(e.runs),this._activeRunId=e.activeRunId||this._activeRunId,this._adoptGlobals(e),e.activeRun&&(this._run=e.activeRun,this._bannerReady=!!e.activeRun.hasStandardBanner,this._artState==="idle"&&(this._artReady=!(Number(e.activeRun.artPending)>0)),this._wallet=e.activeRun.wallet||this._wallet,this._rosterCount=Number(e.activeRun.rosterCount)||this._rosterCount))}).catch(()=>{}).then(()=>{this._refreshing=!1,this._renderBrowser()}))}_reconcileGenerating({boot:e=!1}={}){if(!e)return;let a=this._run&&Array.isArray(this._run.generating)?this._run.generating:[];if(!a.length)return;let r=this._run.runId,s=d=>a.find(o=>typeof o=="string"&&o.startsWith(`${r}:${d}`)),n=s("chapter:"),i=s("combat:");if(n||i){let d=Number(n?n.split(":").pop():i.split(":")[2]);if(Number.isInteger(d)&&d>=1){this._planChapter=d,this._plan=null,this._planState="idle",this._hudView=this._hudView==="chapter"?"chapter":"home";return}}let l=s("banner:wpn:"),h=s("banner:char:");if(l||h){this._hudView="summon",this._summonPhase="banner",this._summonBannerId=l?"wpn-featured":"char-featured",this._summonBanner=null,this._summonBannerState="idle";return}let p=s("beat:");if(p){let d=p.split(":"),o=Number(d[2]),u=Number(d[3]);if(Number.isInteger(o)&&o>=1&&Number.isInteger(u)&&u>=0){this._planChapter=o,this._hudView="chapter";let f=this._run.progress&&this._run.progress[String(o)]||{};this._chapterProgress={normal:f.normal||0,hard:f.hard||0,veryhard:f.veryhard||0},this._activeStoryNode={chapter:o,difficulty:this._difficulty,nodeIndex:this._chapterProgress[this._difficulty]||0,storyIndex:u,title:"Story",restored:!0},this._beat=null,this._beatCast=null,this._beatState="loading",this._beatRequested=!1}}}_postJson(e,a){let r=Tn(e),s=r?this._busyStart(r):0;return be(`${Pa}${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}).then(n=>n&&typeof n.json=="function"?n.json():null).catch(()=>null).then(n=>(this._adoptFromResponse(n),s&&this._busyEnd(s),s&&this._run&&Array.isArray(this._run.generating)&&this._run.generating.length&&this._refreshState(),n))}_adoptFromResponse(e){if(!e||typeof e!="object")return;if(this._adoptGlobals(e),e.wallet&&typeof e.wallet=="object"&&(this._wallet={...this._wallet||{},...e.wallet}),e.account&&typeof e.account=="object"&&this._run){let n=this._run.account||null,i=e.account;(!n||n.level!==i.level||n.xp!==i.xp||n.xpNeeded!==i.xpNeeded)&&(this._run={...this._run,account:{...n,...i}})}this._syncBar();let a=typeof e.unitId=="string"?e.unitId:"",r=typeof e.portrait=="string"?e.portrait:"",s=this._run&&this._run.decor;a&&r&&s&&s.unit&&s.unit.id===a&&s.unit.portrait!==r&&(this._run={...this._run,decor:{...s,unit:{...s.unit,portrait:r}}})}_syncBar(){Ka(this._root,{wallet:this._wallet,account:this._run&&this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:void 0})}_busyStart(e){return this._busySeq+=1,this._busyLocal.set(this._busySeq,e),this._renderBrowser(),this._busySeq}_busyEnd(e){this._busyLocal.delete(e)&&this._renderBrowser()}_busyTasks(){return An({local:[...this._busyLocal.values()],generating:this._run&&Array.isArray(this._run.generating)?this._run.generating:[],art:this._artState==="painting"?this._art:null})}async _createRun(e){let a=await this._postJson("/run",e);if(!(a&&a.ok&&a.run))throw new Error(a&&a.error||"Could not create the run.");this._adoptRun(a.run),this._adoptRuns([...this._runs,a.run]),this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}_openSettings(e){if(!this._run)return;let a=Ye.some(r=>r.id===e)?e:Ke;this._hudView!=="settings"&&(this._settingsFrom=this._hudView||"home"),this._hudView="settings",this._settingsCategory=a,this._renderBrowser(),a==="continuity"&&this._loadContinuity(),a==="debug"&&this._loadTokenLog()}_settingsBackLabel(){return{home:"Home",modes:"Battle",roster:"Units",unit:"Units",summon:"Summon",formation:"Formation",inventory:"Inventory",farm:"Materials",chapters:"Chapters",chapter:"Chapter",result:"Result",combat:"Battle"}[this._settingsFrom]||"Home"}_leaveSettings(){this._hudView=this._settingsFrom==="settings"?"home":this._settingsFrom||"home",this._renderBrowser()}async _setSources(e){if(!this._run||!this._run.runId||!e||typeof e!="object")return;let a=this._run;this._run={...this._run,...e},this._settingsRev+=1;let r=await this._postJson("/run/sources",{runId:this._run.runId,sources:e});if(!r||!r.ok){this._run=a,this._settingsRev+=1,this._renderBrowser();return}r.run&&typeof r.run=="object"&&(this._run={...this._run,...r.run},this._settingsRev+=1)}_switchRun(e){if(e){if(e===this._activeRunId){this._creatingNew=!1,this._showRuns=!1,this._renderBrowser();return}this._postJson("/run/activate",{runId:e}).then(a=>{a&&a.ok&&a.run&&(this._adoptRun(a.run),this._showRuns=!1,this._renderBrowser(),this._loadState())})}}_deleteRun(e){e&&this._postJson("/run/delete",{runId:e}).then(a=>{a&&a.ok&&(this._adoptRuns(a.runs),this._activeRunId=a.activeRunId||null,this._run&&e===this._run.runId&&this._adoptRun(a.activeRun||null),this._runs.length===0&&(this._showRuns=!1,this._creatingNew=!1),this._renderBrowser())})}_loadChapterPlan(){if(this._planState="loading",this._renderBrowser(),!this._run){this._planState="error",this._renderBrowser();return}let e=null;this._postJson("/chapter-plan",{runId:this._run.runId,chapter:this._planChapter}).then(a=>{if(a&&a.ok&&a.plan){e=a.plan;let r=a.progress&&a.progress[String(this._planChapter)]||{};this._chapterProgress={normal:r.normal||0,hard:r.hard||0,veryhard:r.veryhard||0},this._chapterCp=a.cp||null}else this._planState="error"}).then(()=>{if(!(this._planState==="error"||!e))return this._prewarmCombats(e)}).then(()=>{if(this._planState!=="error"&&e){this._plan=e,this._planState="idle",this._loadLocations(),this._paintPlaces();let a=this._activeStoryNode;if(a&&a.restored&&a.chapter===this._planChapter){let r=Ge(e,a.difficulty).find(s=>s.type==="story"&&s.storyIndex===a.storyIndex);r&&Object.assign(a,r),a.restored=!1}}this._run&&this._renderBrowser()})}_prewarmCombats(e){let a=Qt(e);if(!a||!this._run)return Promise.resolve();let r=this._planChapter,s=Promise.resolve();for(let n=0;n<a;n+=1){let i=n;s=s.then(()=>this._postJson("/combat-guide",{runId:this._run.runId,chapter:r,combatIndex:i}))}return s}_loadStandardBanner(){if(this._bannerState="loading",this._renderBrowser(),!this._run){this._bannerState="error",this._renderBrowser();return}this._postJson("/banner",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._bannerState="idle",this._bannerReady=!0,this._artReady=!1,this._artState="idle",this._artBlocking=!0,typeof e.granted=="number"&&(this._rosterCount=e.granted)):this._bannerState="error"}).then(()=>{this._run&&this._renderBrowser()})}_nodeBackground(){let e=this._activeStoryNode,a=e&&typeof e.location=="string"?e.location:"",r=this._locationSlug(a),s=this._locations||{};return r&&s[r]&&s[r].url||""}_showBackgroundNow(){let e=this._root&&this._root.querySelector(".vn-scene"),a=this._nodeBackground();!e||!a||(e.style.backgroundImage=`url(${a})`,e.style.backgroundSize="cover",e.style.backgroundPosition="center")}_locationSlug(e){return String(e??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60)}_loadLocations(){return this._postJson("/locations",{runId:this._run?this._run.runId:""}).then(e=>{e&&e.ok&&e.places&&(this._locations=e.places,this._showBackgroundNow())}).catch(()=>{})}_paintPlaces(){if(this._paintingPlaces)return;let e=this._run?this._run.runId:"";e&&(this._paintingPlaces=!0,this._postJson("/backgrounds",{runId:e}).then(async a=>{if(a&&a.ok&&a.enabled&&Array.isArray(a.pending)&&a.pending.length)for(let r of a.pending){let s=await this._imageSlot(()=>this._postJson("/background",{runId:e,slug:r.slug,name:r.name,tags:r.tags})).catch(n=>({ok:!1,error:String(n&&n.message||n)}));s&&s.ok?await this._loadLocations():console.warn("[gacha-forge] background paint failed",r.name,s&&(s.detail||s.error))}}).finally(()=>{this._paintingPlaces=!1}))}_imageSlot(e){let a=()=>e(),r=(this._imageChain||Promise.resolve()).then(a,a);return this._imageChain=r.then(()=>{},()=>{}),r}_ensureArtRunning(){!this._run||this._artReady||this._artState!=="idle"||this._startArt()}_startArt(){if(this._artState="painting",this._art={done:0,total:0,name:""},!this._run){this._artReady=!0,this._renderBrowser();return}this._planState==="idle"&&this._plan==null&&this._loadChapterPlan(),this._postJson("/portraits",{runId:this._run.runId}).then(e=>{let a=e&&e.ok&&Array.isArray(e.pending)?e.pending:[];return a.length?(this._art={done:Number(e.done)||0,total:Number(e.total)||a.length,name:a[0].name},this._artBlocking&&this._renderBrowser(),this._paintNext(a,0,0)):this._finishArt()}).catch(()=>this._finishArt())}_paintNext(e,a,r){if(!this._run||this._artState!=="painting")return Promise.resolve();if(a>=e.length){if(r>0&&r===e.length){if(this._artBlocking)return this._artState="blocked",this._renderBrowser(),Promise.resolve();console.warn("[gacha-forge] every background portrait failed ("+r+") \u2014 units keep their silhouette")}return this._paintFoundingArt().then(()=>this._finishArt())}let s=e[a];return this._art={...this._art,name:s.name},this._artBlocking&&this._renderBrowser(),this._imageSlot(()=>this._postJson("/portrait",{runId:this._run.runId,unitId:s.unitId})).catch(()=>null).then(n=>{let i=!!(n&&n.ok);return i&&(this._art={...this._art,done:this._art.done+1}),this._paintNext(e,a+1,r+(i?0:1))})}_paintFoundingArt(){return!this._artBlocking||!this._run?Promise.resolve():(this._art={...this._art,name:"The banner splash"},this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:"char-standard"})).catch(()=>null))}_finishArt(){let e=!this._artBlocking;this._artState="idle",this._artReady=!0,this._artBlocking=!1,e&&(this._hudView==="roster"&&!this._rosterUnitId&&this._rosterState!=="loading"?this._loadRoster():this._hudView==="summon"&&this._summonBannerState!=="loading"&&this._loadSummonBanner()),this._renderBrowser()}_openPick(e){e!=="bg"&&e!=="unit"||(this._pick={slot:e,source:e==="bg"?"story":"all"},this._renderBrowser(),this._postJson("/home-options",{runId:this._run?this._run.runId:""}).then(a=>{!a||a.ok===!1||(this._pickOptions={backgrounds:a.backgrounds||{},units:a.units||[]},this._pickRev+=1,this._pick&&this._renderBrowser())}))}_closePick(){this._pick&&(this._pick=null,this._renderBrowser())}_pickSource(e){this._pick&&(this._pick={...this._pick,source:String(e||"")},this._renderBrowser())}_takePick(e){if(!this._pick||!this._run)return;let a={runId:this._run.runId};if(this._pick.slot==="bg")a.bg=e?{src:this._pick.source,key:e}:null;else{if(!e)return;a.unitId=e}this._pick=null,this._renderBrowser(),this._postJson("/home-decor",a).then(r=>{!r||r.ok===!1||!r.decor||(this._run={...this._run,decor:r.decor},this._renderBrowser())})}_openRoster(){this._hudView="roster",this._rosterUnitId=null,this._rosterState="idle",this._renderBrowser()}_loadRoster(){if((!Array.isArray(this._roster)||!this._roster.length)&&(this._rosterState="loading"),this._renderBrowser(),!this._run){this._rosterState="error",this._renderBrowser();return}this._postJson("/roster",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.cards)?(this._roster=e.cards,this._rosterRev+=1,this._rosterCount=e.cards.length,this._rosterState="ready"):(!Array.isArray(this._roster)||!this._roster.length)&&(this._rosterState="error")}).then(()=>{this._hudView==="roster"&&this._renderBrowser()})}_openUnit(e,a="profile"){e&&(this._rosterUnitId=e,this._unit=null,this._unitTab=a==="growth"||a==="gear"||a==="bond"?a:"profile",this._growth=null,this._growthRev+=1,this._feed=null,this._unitState="idle",this._portraitReset(),this._renderBrowser())}_portraitReset(){this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev+=1}_loadUnit(){if(this._unitState="loading",this._renderBrowser(),!this._run||!this._rosterUnitId){this._unitState="error",this._renderBrowser();return}let e=this._rosterUnitId;this._postJson("/unit",{runId:this._run.runId,unitId:e}).then(a=>{this._rosterUnitId===e&&(a&&a.ok&&a.unit?(this._unit=a.unit,this._unitLevel=Number(a.level)||1,this._unitBond=Number(a.bond)||0,this._growth=a,this._growthRev+=1,this._feed=null,this._portrait=a.portrait||null,this._portraitRev+=1,this._unitState="ready"):this._unitState="error")}).then(()=>{this._rosterUnitId===e&&this._renderBrowser()})}_portraitOpenStudio(){this._portrait&&(this._portraitDraft={appearance:this._portrait.appearance||"",tags:pt(this._portrait.tags)},this._portraitOpen=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser())}_portraitClose(){this._portraitOpen=!1,this._portraitCrop=null,this._portraitError="",this._portraitRev+=1,this._renderBrowser()}_portraitEdit(e){if(!(!this._portraitDraft||!e)){if(typeof e.appearance=="string"){this._portraitDraft.appearance=e.appearance;return}if(typeof e.addTag=="string")for(let a of pt(e.addTag))this._portraitDraft.tags.includes(a)||this._portraitDraft.tags.push(a);else if(Number.isInteger(e.dropTag))this._portraitDraft.tags.splice(e.dropTag,1);else return;this._portraitRev+=1,this._renderBrowser()}}_portraitGenerate(){if(this._portraitBusy||!this._run||!this._rosterUnitId||!this._portraitDraft)return;let e=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait",{runId:this._run.runId,unitId:e,force:!0,appearance:this._portraitDraft.appearance,imageTags:this._portraitDraft.tags}).then(a=>this._portraitApply(e,a,"That did not paint."))}_portraitPick(e){let r=(this._portrait&&this._portrait.strip||[])[e];if(!r||r.current||this._portraitBusy||!this._run||!this._rosterUnitId)return;let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait/select",{runId:this._run.runId,unitId:s,url:r.url}).then(n=>this._portraitApply(s,n,"That one could not be restored."))}_portraitApply(e,a,r){if(this._portraitBusy=!1,this._rosterUnitId===e){if(a&&a.ok&&a.view){let s=a.view;this._portrait=s,this._portraitDraft={appearance:s.appearance||"",tags:pt(s.tags)},this._portraitCrop=null,this._portraitError="";let n=Array.isArray(s.strip)&&s.strip.length?s.strip[0].url:"";this._unit&&(this._unit={...this._unit,portrait:n,appearance:s.appearance,imageTags:s.tags}),this._rosterState="idle"}else this._portraitError=Wc[a&&a.error||""]||a&&a.detail||r;this._portraitRev+=1,this._renderBrowser()}}_portraitFile(e){if(!e||this._portraitBusy)return;let a=s=>{this._portraitError=s,this._portraitCrop=null,this._portraitRev+=1,this._renderBrowser()},r=new FileReader;r.onerror=()=>a("That file could not be read."),r.onload=()=>{let s=String(r.result||""),n=new Image;n.onerror=()=>a("That file is not an image this gallery accepts."),n.onload=()=>{let i=n.naturalWidth||n.width,l=n.naturalHeight||n.height;if(!i||!l)return a("That image has no size.");this._portraitCrop={src:s,natural:{w:i,h:l},size:1,frame:ya(i,l,1,.5,.42)},this._portraitError="",this._portraitRev+=1,this._renderBrowser()},n.src=s},r.readAsDataURL(e)}_portraitDrag(e){let a=this._portraitCrop;!a||!e||(a.frame=wa({...a.frame,x:a.frame.x+(Number(e.dx)||0)*a.natural.w,y:a.frame.y+(Number(e.dy)||0)*a.natural.h},a.natural.w,a.natural.h),xa(this._root,a.frame,a.natural.w,a.natural.h))}_portraitSize(e){let a=this._portraitCrop;if(!a)return;let r=(a.frame.x+a.frame.w/2)/a.natural.w,s=(a.frame.y+a.frame.h/2)/a.natural.h;a.size=e,a.frame=ya(a.natural.w,a.natural.h,e,r,s),xa(this._root,a.frame,a.natural.w,a.natural.h)}_portraitUpload(){let e=this._portraitCrop;if(!e||this._portraitBusy||!this._run||!this._rosterUnitId)return;let a=Number(this._portrait&&this._portrait.width)||0,r=Number(this._portrait&&this._portrait.height)||0;if(!a||!r){this._portraitError="This world did not say what size a portrait is.",this._portraitRev+=1,this._renderBrowser();return}let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser();let n=new Image;n.onerror=()=>this._portraitApply(s,null,"That image could not be prepared."),n.onload=()=>{let i="";try{let l=document.createElement("canvas");l.width=a,l.height=r,l.getContext("2d").drawImage(n,e.frame.x,e.frame.y,e.frame.w,e.frame.h,0,0,a,r),i=l.toDataURL("image/jpeg",.92)}catch{i=""}if(!i)return this._portraitApply(s,null,"That image could not be prepared.");this._postJson("/portrait/upload",{runId:this._run.runId,unitId:s,image:i}).then(l=>this._portraitApply(s,l,"That image was not accepted."))},n.src=e.src}_wireRuns(){oi(this._root,{onNew:()=>{this._creatingNew=!0,this._showRuns=!1,this._renderBrowser()},onSwitch:e=>this._switchRun(e),onDelete:e=>this._deleteRun(e),onBack:()=>{this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}})}_wireChapter(){lr(this._root,{plan:this._plan,difficulty:this._difficulty,progress:this._chapterProgress,onBack:()=>{this._hudView="chapters",this._renderBrowser()},onDifficulty:e=>{this._difficulty=e,this._renderBrowser()},onPlayStory:e=>this._playStoryNode(e),onReplayStory:(e,a)=>this._replayStoryNode(e,a),onStartCombat:e=>this._openCombat(e)})}_openChapter(e){!this._run||e<1||(this._planChapter=e,this._plan=null,this._planState="idle",this._hudView="chapter",this._continuity=null,this._continuityState="idle",this._renderBrowser())}_wireChapters(){let e=this._root.querySelector("[data-back]");e&&e.addEventListener("click",()=>{this._hudView="home",this._renderBrowser()}),this._chaptersData=null,this._chaptersState="idle",this._loadChapters()}_loadChapters(){this._run&&(this._chaptersState="loading",this._fillChapters(),this._postJson("/chapters",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.chapters)?(this._chaptersData=e,this._chaptersState="ready"):this._chaptersState="error",this._fillChapters()}))}_fillChapters(){let e=this._root.querySelector("[data-chapters-list]");if(!e)return;if(this._chaptersState==="loading"&&!this._chaptersData){e.innerHTML='<p class="sel-empty">Loading&hellip;</p>';return}if(this._chaptersState==="error"&&!this._chaptersData){e.innerHTML='<p class="sel-empty">Could not load chapters.</p>';return}let a=this._chaptersData||{chapters:[],nextChapter:1,nextUnlocked:!0};e.innerHTML=Dr(a.chapters,a.nextChapter,a.nextUnlocked);let r=(a.chapters||[]).map(s=>s.chapter);a.nextUnlocked&&r.push(a.nextChapter);for(let s of r){let n=this._root.querySelector('[data-open-chapter="'+s+'"]');n&&n.addEventListener("click",()=>this._openChapter(s))}}_playStoryNode(e){!this._run||this._storyStarting||(this._storyStarting=!0,this._storyNotice="",this._postJson("/story/start",{runId:this._run.runId,chapter:this._planChapter,storyIndex:e&&e.storyIndex}).then(a=>{if(this._storyStarting=!1,a&&a.ok){this._run&&(this._run.wallet=a.wallet||this._run.wallet),this._openStoryNode(e);return}this._storyNotice=a&&a.error==="no-vigor"?`Not enough Vigor: this beat costs ${a.cost} and you have ${a.vigor}.`:"That beat could not be started.",this._renderBrowser()}))}_replayStoryNode(e,a){this._run&&(this._storyNotice="",this._openStoryNode(e,{nodeIndex:a,replay:!0}))}_openStoryNode(e,{nodeIndex:a=null,replay:r=!1}={}){if(!this._run)return;let s=this._difficulty,n=a??(this._chapterProgress[s]||0);this._activeStoryNode={...e||{},chapter:this._planChapter,difficulty:s,nodeIndex:n,storyIndex:e&&e.storyIndex,title:e&&e.title||"Story",replay:r},this._beat=null,this._beatCast=null,this._beatState="loading",this._beatRequested=!1,this._renderBrowser()}_loadBeat(){let e=this._activeStoryNode;if(!this._run||!e){this._beatState="error",this._beatRequested=!1,this._renderBrowser();return}this._postJson("/beat",{runId:this._run.runId,chapter:e.chapter,nodeIndex:e.nodeIndex,storyIndex:e.storyIndex}).then(a=>{a&&a.ok&&Array.isArray(a.segments)&&a.segments.length?(this._beat=a.segments,this._beatCast=Array.isArray(a.cast)?a.cast:null,this._contextTokens=Number(a.contextTokens)||0,this._beatState="ready"):this._beatState="error"}).then(()=>{this._beatRequested=!1,this._renderBrowser()})}_retryBeat(){this._beatState="loading",this._beatRequested=!1,this._renderBrowser()}_completeStoryBeat(){let e=this._activeStoryNode;if(this._clearBeat(),e&&this._run){let a=e.nodeIndex==null?this._chapterProgress[e.difficulty]||0:e.nodeIndex;this._chapterProgress[e.difficulty]=(this._chapterProgress[e.difficulty]||0)+1,this._postJson("/complete",{runId:this._run.runId,chapter:e.chapter,difficulty:e.difficulty,nodeIndex:a}).then(r=>{r&&r.ok||(this._chapterProgress[e.difficulty]=Math.max(0,(this._chapterProgress[e.difficulty]||0)-1),this._hudView==="chapter"&&this._renderBrowser())})}this._hudView="chapter",this._renderBrowser()}_exitStoryBeat(){this._clearBeat(),this._hudView="chapter",this._renderBrowser()}_clearBeat(){this._stopBeat(),this._beatState="idle",this._beat=null,this._activeStoryNode=null,this._beatRequested=!1}_advanceNode(){if(!this._run)return;let e=this._difficulty,a=this._chapterProgress[e]||0;this._chapterProgress[e]=a+1;let r=this._nodeTitle(a);this._postJson("/complete",{runId:this._run.runId,chapter:this._planChapter,difficulty:e,nodeIndex:a}).then(s=>this._afterComplete(s,r)).catch(()=>this._renderBrowser()),this._renderBrowser()}_nodeTitle(e){let a=this._plan&&Array.isArray(this._plan.nodes)?this._plan.nodes:[];return this._titleOfNode(a[e])}_titleOfNode(e){return`${this._chapterLabel()}${e&&e.title?" \xB7 "+e.title:""}`}_afterComplete(e,a){if(e&&e.error==="lost"){this._openResult({outcome:"lose",where:a,rewards:[],relic:null,rank:null,back:"chapter",canReplay:!0,again:this._combatNode});return}if(!(e&&e.ok)){this._leaveCombat("chapter");return}let r=wn(e.reward);if(!r.length&&!e.rank){this._leaveCombat("chapter");return}this._openResult({outcome:"win",where:a,rewards:r,rank:e.rank||null,back:"chapter"})}_openResult(e){this._result=e,this._resultRev+=1,this._stopCombat(),this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._hudView="result",this._renderBrowser()}_closeResult(){let e=this._result&&this._result.back||"chapter";this._result=null,this._resultRev+=1,this._hudView=e,e==="farm"&&this._loadFarm(),this._renderBrowser()}_resultAgain(){let e=this._result&&this._result.again,a=this._result&&this._result.back||"farm";if(this._result=null,this._resultRev+=1,!e){this._hudView="farm",this._renderBrowser();return}if(a==="farm"){this._hudView="farm",this._farmRun(e);return}this._combatNode=e,this._combatPhase="loading",this._hudView="combat",this._renderBrowser()}_loadContinuity(){this._run&&(this._continuityState="loading",this._fillContinuity(),this._postJson("/continuity",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.chapters)?(this._continuity=e.chapters,this._continuityState="ready",e.warnTokens&&(this._warnTokens=Number(e.warnTokens)||this._warnTokens,Xe(this._root,this._contextTokens,this._warnTokens))):this._continuityState="error",this._fillContinuity()}))}_vigorView(){let e=this._wallet||this._run&&this._run.wallet||null,a=this._combatVigorError,r=Number(a&&Number.isFinite(Number(a.cost))?a.cost:this._combat&&this._combat.cost);return!e||!Number.isFinite(r)?null:{have:Number(e.vigor)||0,cost:r,nextMs:a&&Number.isFinite(a.vigorNextMs)?a.vigorNextMs:this._wallet&&this._wallet.vigorNextMs||null}}_startBattle(){if(!this._run||this._combatStarting)return;this._combatStarting=!0;let e=this._combatNode;(e&&e.farm?this._postJson("/farm/start",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}):this._postJson("/battle/start",{runId:this._run.runId,chapter:e.chapter,combatIndex:e.combatIndex,difficulty:this._difficulty,presetIndex:this._combatPreset})).then(r=>{this._combatStarting=!1,r&&r.ok?(this._run&&(this._run.wallet=r.wallet||this._run.wallet),this._combatPhase="battle",this._combatVigorError=null):this._combatVigorError=r&&r.error==="no-vigor"?r:{error:r&&r.error||"failed"},this._renderBrowser()})}_feedRoom(e){if(!e)return 0;let a=Number(e.level)||1,r=(Array.isArray(e.ladder)?e.ladder:[]).filter(s=>Number(s.level)>=a).reduce((s,n)=>s+(Number(n.xp)||0),0);return Math.max(0,r-Math.max(0,Number(e.xp)||0))}_growthView(){let e=this._growth;if(!e)return null;let a=this._feed;if(!a)return e;let r=Array.isArray(e.tiers)?e.tiers:[],s=Math.max(0,Number(e.xp)||0),n=0;for(let f of r)n+=(Number(a[f.id])||0)*(Number(f.xp)||0);s+=n;let i=Number(e.wallet&&e.wallet.funds)||0,l=Number(e.level)||1,h=0,p=!1;for(let f of Array.isArray(e.ladder)?e.ladder:[])if(f.level===l){if(s<f.xp)break;if(i<f.funds){p=!0;break}s-=f.xp,i-=f.funds,h+=f.funds,l=f.level+1}let d=(Array.isArray(e.ladder)?e.ladder:[]).find(f=>f.level===l-1),o=(Array.isArray(e.ladder)?e.ladder:[]).find(f=>f.level===l),u=l-(Number(e.level)||1);return{...e,preview:{ready:n>0,short:p,xp:n,levelTo:l,cpTo:d?d.cpAfter:Number(e.cp)||0,funds:h||(p?this._nextStepFunds(e,l):0),spent:{...a},xpAfter:s,needAfter:o?o.xp:null,solid:u>0?0:Math.max(0,Number(e.xp)||0),roomLeft:Math.max(0,this._feedRoom(e)-n)}}}_nextStepFunds(e,a){let r=(Array.isArray(e.ladder)?e.ladder:[]).find(s=>s.level===a);return r?r.funds:0}_feedAdd(e){let a=this._growth;if(!a||!e)return;let r=Math.max(0,Number(a.wallet&&a.wallet.insight&&a.wallet.insight[e])||0),s=this._feed||{},n=Number(s[e])||0;if(n>=r)return;let i=Array.isArray(a.tiers)?a.tiers:[],l=0;for(let h of i)l+=(Number(s[h.id])||0)*(Number(h.xp)||0);this._feedRoom(a)-l<=0||(this._feed={...s,[e]:n+1},this._paintGrowth())}_feedReset(){this._feed&&(this._feed=null,this._paintGrowth())}_feedCommit(){if(!this._run||!this._rosterUnitId||!this._feed)return;let e=this._feed;this._feed=null,this._paintGrowth(),this._postJson("/level-up",{runId:this._run.runId,unitId:this._rosterUnitId,spend:e}).then(a=>{a&&a.ok?(this._unitLevel=Number(a.level)||this._unitLevel,this._growth={...this._growth,...a},this._growthRev+=1,this._renderBrowser()):this._paintGrowth()})}_openInventory(){this._hudView="inventory",this._invSection="relics",this._invView={slot:"all",rarity:"all",picked:"",feeding:null,gained:[]},this._inventoryState=this._inventory?"ready":"loading",this._renderBrowser(),this._loadInventory()}_loadInventory(){this._run&&(this._inventoryState=this._inventoryState==="ready"?"ready":"loading",this._postJson("/inventory",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._inventory=e,this._inventoryState="ready"):this._inventoryState="error",this._invRev+=1,this._renderBrowser()}).catch(()=>{this._inventoryState="error",this._invRev+=1,this._renderBrowser()}))}_relicLock(e){!this._run||!e||this._invBusy||(this._invBusy=!0,this._postJson("/relic/lock",{runId:this._run.runId,relicId:e}).catch(()=>null).then(()=>{this._invBusy=!1,this._loadInventory()}))}_relicFeedFromInventory(){let e=this._invView.feeding;!this._run||!e||!e.picked.length||this._invBusy||(this._invBusy=!0,this._postJson("/relic/feed",{runId:this._run.runId,relicId:e.targetId,food:e.picked}).then(a=>{this._invBusy=!1,a&&a.ok?this._invView={...this._invView,feeding:null,picked:e.targetId,gained:a.gained||[]}:this._invView={...this._invView,feeding:null},this._loadInventory()}).catch(()=>{this._invBusy=!1,this._invView={...this._invView,feeding:null},this._loadInventory()}))}_openFarm(){this._hudView="farm",this._farmView="root",this._farmState=this._farm?"ready":"loading",this._renderBrowser(),this._loadFarm()}_loadFarm(){this._run&&this._postJson("/farm",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._farm=e,this._farmState="ready"):this._farmState="error",this._farmRev+=1,this._hudView==="farm"&&this._renderBrowser()})}_farmRun(e){!this._run||!e||this._farmBusy||(this._farmBusy=!0,this._pendingFarm={...e},this._stopCombat(),this._pendingCombat={farm:!0,...e,title:"Materials"},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser())}_claimFarm(){if(!this._run)return;let e=this._pendingFarm?{...this._pendingFarm}:null,a=this._farmStageLabel(e);this._postJson("/farm/claim",{runId:this._run.runId}).then(r=>{if(!(r&&r.ok)){this._leaveCombat("farm");return}let s=r.dropped||null;this._pendingFarm=null,this._openResult({outcome:"win",where:a,rewards:xn(s),relic:s&&s.relic||null,rank:r&&r.rank||null,back:"farm",canReplay:!!e,again:e}),this._loadFarm()}).catch(()=>this._leaveCombat("farm"))}_farmStageLabel(e){if(!e)return"Materials";let a=["","Normal","Hard","Very Hard"][Number(e.difficulty)]||"",s=((this._farm&&this._farm.stages||{})[e.stage]||[]).find(i=>Number(i.difficulty)===Number(e.difficulty));if(e.stage==="asc"){let i=(this._farm&&this._farm.families||[]).find(l=>l.id===e.family);return`${a} \xB7 ${i?i.name:"Ascension"}`}let n=this._farm&&this._farm.stageNames||{};return`${a} \xB7 ${n[e.stage]||s&&s.material||"Materials"}`}_gearFeedView(){return!this._gearFeed||!this._gearFeed.open?null:{open:!0,picked:this._gearFeed.picked||[],gained:this._gearFeed.gained||null,inventory:this._relics&&this._relics.items||[],funds:Number(this._wallet&&this._wallet.funds)||0,cost:Number(this._relics&&this._relics.feedFunds)||0,tickEvery:Number(this._relics&&this._relics.tickEvery)||3}}_relicFeed(e){if(!(!e||!this._run)){if(e.type==="open"){this._gearFeed={open:!0,picked:[],gained:null},this._renderBrowser(),this._loadRelics();return}if(e.type==="back"){this._gearFeed=null,this._renderBrowser();return}if(this._gearFeed){if(e.type==="clear"){this._gearFeed.picked=[],this._gearFeed.gained=null,this._renderBrowser();return}if(e.type==="pick"){let a=this._gearFeed.picked||[],r=a.indexOf(e.id);r>=0?a.splice(r,1):a.push(e.id),this._gearFeed.picked=a,this._gearFeed.gained=null,this._renderBrowser();return}e.type==="go"&&this._relicFeedGo()}}}_loadRelics(){this._postJson("/relics",{runId:this._run.runId}).then(e=>{e&&e.ok&&(this._relics=e,this._relicsRev+=1,this._renderBrowser())})}_relicFeedGo(){let e=this._gearSlot,a=this._growth&&this._growth.gear,r=a&&(a.slots||[]).find(l=>l.key===e),s=r&&r.item?r.item.id:"",n=this._gearFeed&&this._gearFeed.picked||[];if(!s||!n.length||this._feedBusy)return;this._feedBusy=!0;let i=this._rosterUnitId;this._postJson("/relic/feed",{runId:this._run.runId,relicId:s,food:n}).then(l=>{this._feedBusy=!1,this._rosterUnitId===i&&(l&&l.ok&&(this._gearFeed={open:!0,picked:[],gained:l.gained||[]},this._loadRelics(),this._loadUnit()),this._renderBrowser())}).catch(()=>{this._feedBusy=!1})}_equip(e){if(!this._run||!this._rosterUnitId||this._equipBusy)return;this._equipBusy=!0;let a=this._rosterUnitId,r=this._gearSlot||"weapon",s=r!=="weapon";this._postJson("/equip",{runId:this._run.runId,unitId:a,slot:r,weaponId:s?"":e||"",relicId:s&&e||""}).then(n=>{this._equipBusy=!1,this._rosterUnitId===a&&(n&&n.ok&&(this._growth={...this._growth,...n},this._growthRev+=1,this._gearSlot=null),this._renderBrowser())}).catch(()=>{this._equipBusy=!1})}_ascend(){if(!this._run||!this._rosterUnitId)return;let e=this._growth;!e||!e.ascension||!e.ascension.ready||this._postJson("/ascend",{runId:this._run.runId,unitId:this._rosterUnitId}).then(a=>{a&&a.ok?(this._growth={...this._growth,...a},this._growthRev+=1):a&&a.ascension&&(this._growth={...this._growth,ascension:a.ascension},this._growthRev+=1),this._paintGrowth()})}_formUp(e){if(!this._run||!this._rosterUnitId)return;let a=this._growth,r=a&&a.form&&Array.isArray(a.form.tracks)?a.form.tracks.find(s=>s.key===e):null;!r||!r.ready||this._postJson("/form-up",{runId:this._run.runId,unitId:this._rosterUnitId,track:e}).then(s=>{s&&s.ok?(s.unit&&(this._unit=s.unit),this._growth={...this._growth,...s},this._growthRev+=1):s&&s.form&&(this._growth={...this._growth,form:s.form},this._growthRev+=1),this._paintGrowth()})}_paintGrowth(){let e=this._root.querySelector(".cp-panel");!e||this._unitTab!=="growth"||!this._unit||(e.innerHTML=Bs(this._unit,this._growthView()))}_loadTokenLog(){this._tokenLog={status:"loading",entries:this._tokenLog&&this._tokenLog.entries||[],totals:this._tokenLog&&this._tokenLog.totals},this._fillTokenLog(),this._loreStatus={status:"loading"},this._postJson("/lore-status",{runId:this._run?this._run.runId:""}).then(e=>{this._loreStatus=e&&e.ok?{status:"ready",data:e}:{status:"error"},this._fillTokenLog()}),this._postJson("/token-log",{runId:this._run?this._run.runId:""}).then(e=>{e&&e.ok&&Array.isArray(e.entries)?this._tokenLog={status:"ready",entries:e.entries,totals:e.totals||null}:this._tokenLog={status:"error",entries:[],totals:null},this._fillTokenLog()})}_fillTokenLog(){let e=this._root.querySelector('[data-view-body="debug"]');e&&(e.innerHTML=oa(this._loreStatus,this._tokenLog))}_fillContinuity(){let e=this._root.querySelector("[data-continuity-list]");if(e){if(this._continuityState==="loading"&&!this._continuity){e.innerHTML='<p class="st-empty">Loading&hellip;</p>';return}if(this._continuityState==="error"&&!this._continuity){e.innerHTML='<p class="st-empty">Could not load chapters.</p>';return}e.innerHTML=Er(this._continuity||[],this._compressing);for(let a of this._continuity||[])if(a&&a.complete&&!a.compressed&&this._compressing==null){let r=this._root.querySelector('[data-compress="'+a.chapter+'"]');r&&r.addEventListener("click",()=>this._compressChapter(a.chapter))}}}_compressChapter(e){!this._run||this._compressing!=null||(this._compressing=e,this._fillContinuity(),this._postJson("/compress",{runId:this._run.runId,chapter:e}).then(a=>{this._compressing=null,a&&a.ok&&Array.isArray(this._continuity)&&(this._continuity=this._continuity.map(r=>r.chapter===e?{...r,compressed:!0}:r)),a&&a.ok&&Number.isFinite(Number(a.contextTokens))&&(this._contextTokens=Number(a.contextTokens)||0,Xe(this._root,this._contextTokens,this._warnTokens)),this._fillContinuity()}))}_setWarnTokens(e){let a=Math.max(1e3,Math.round(Number(e)||0));!a||!this._run||(this._warnTokens=a,Xe(this._root,this._contextTokens,this._warnTokens),this._postJson("/warn-threshold",{runId:this._run.runId,warnTokens:a}).then(r=>{r&&r.ok&&r.warnTokens&&(this._warnTokens=Number(r.warnTokens)||this._warnTokens,Xe(this._root,this._contextTokens,this._warnTokens))}))}_stopForge(){this._forgeCleanup&&(this._forgeCleanup(),this._forgeCleanup=null)}_stopBeat(){this._beatCleanup&&(this._beatCleanup(),this._beatCleanup=null)}_stopSummon(){this._summonCleanup&&(this._summonCleanup(),this._summonCleanup=null)}_stopCombat(){this._combatCleanup&&(this._combatCleanup(),this._combatCleanup=null)}_openCombat(e){if(!this._run||!e||typeof e.combatIndex!="number")return;let a=this._difficulty,r=this._chapterProgress[a]||0;this._pendingCombat={chapter:this._planChapter,combatIndex:e.combatIndex,title:e&&e.title||"Combat",difficulty:a,nodeIndex:r},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_enterBattle(){let e=this._pendingCombat;e&&(this._formationBattleMode=!1,this._combatNode={...e},this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatNonce=0,this._combatPreset=null,this._combatPhase="loading",this._hudView="combat",this._renderBrowser())}_loadBattle(){if(this._battleLoading)return;this._battleLoading=!0;let e=this._combatNode;if(this._combatError="",this._combatPhase="loading",this._renderBrowser(),!this._run||!e){this._battleLoading=!1,this._combatPhase="error",this._renderBrowser();return}(e.farm?this._postJson("/farm/battle",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}):this._postJson("/battle",{runId:this._run.runId,chapter:e.chapter,combatIndex:e.combatIndex,difficulty:this._difficulty,presetIndex:this._combatPreset})).then(r=>{if(r&&r.ok&&Array.isArray(r.allies)&&Array.isArray(r.enemies)){this._combat=r,this._combatPreset=typeof r.activePreset=="number"?r.activePreset:this._combatPreset,this._combatNode={...e,objective:r.objective||""};let s=ws({allies:r.allies,enemies:r.enemies,seed:ys(r.battleKey||e.combatIndex)});this._combatSteps=s.steps,this._combatResult=s.result,this._combatPhase="prebattle"}else this._combatError=r&&r.error||"",this._combatPhase="error"}).then(()=>{this._battleLoading=!1,this._farmBusy=!1,this._hudView==="combat"&&this._renderBrowser()})}_pickCombatPreset(e){!this._run||this._combatPreset===e||(this._combatPreset=e,this._loadBattle())}_combatFinished(e){if(this._combatOutcome)return;if(this._combatOutcome=e==="lose"?"lose":"win",this._stopCombat(),this._combatOutcome==="win"){this._exitCombat(!0);return}let a=this._combatNode,r=!!(a&&a.farm);setTimeout(()=>{this._combatOutcome==="lose"&&this._openResult({outcome:"lose",where:a&&a.title||"",rewards:[],rank:null,canReplay:!0,back:r?"farm":"chapter",again:a||null})},Uc)}_exitCombat(e){let a=this._combatNode;if(e&&(this._combatOutcome||this._combatResult)==="win"){this._stopCombat(),a&&a.farm?this._claimFarm():this._completeCombatNode();return}if(e&&a){let s=!!a.farm,n=s&&this._pendingFarm?{...this._pendingFarm}:null;s&&(this._pendingFarm=null),this._openResult({outcome:"lose",where:s?this._farmStageLabel(n):this._titleOfNode(a),rewards:[],relic:null,rank:null,back:s?"farm":"chapter",canReplay:!0,again:s?n:a}),s&&this._loadFarm();return}this._leaveCombat(a&&a.farm?"farm":"chapter")}_leaveCombat(e){this._stopCombat(),this._hudView=e,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,e==="farm"&&(this._pendingFarm=null),this._renderBrowser()}_completeCombatNode(){let e=this._combatNode;if(!this._run||!e)return;let a=e.difficulty||this._difficulty,r=typeof e.nodeIndex=="number"?e.nodeIndex:this._chapterProgress[a]||0;if((this._chapterProgress[a]||0)!==r)return;this._chapterProgress[a]=r+1;let s=this._nodeTitle(r);this._postJson("/complete",{runId:this._run.runId,chapter:e.chapter,difficulty:a,nodeIndex:r}).then(n=>this._afterComplete(n,s)).catch(()=>this._renderBrowser())}_openSummon(){this._hudView="summon",this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._renderBrowser()}_loadSummonBanner(){if(this._summonBannerState="loading",this._renderBrowser(),!this._run){this._summonBannerState="error",this._renderBrowser();return}let e=this._summonBannerId;this._postJson("/summon-banner",{runId:this._run.runId,banner:e}).then(a=>{this._summonBannerId===e&&(a&&a.ok&&a.banner?(this._summonBanner=a,this._summonBannerState="ready",this._ensureBannerArt(a.banner)):this._summonBannerState="error")}).then(()=>{this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()})}_redoBannerArt(){this._paintBannerArt(this._summonBannerId,!0)}_ensureBannerArt(e){!e||!e.canArt||e.art||this._paintBannerArt(e.id,!1)}_paintBannerArt(e,a){!this._run||this._summonArting||!e||(this._summonArting=!0,this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:e,force:!!a})).then(r=>{if(this._summonBannerId===e&&r&&r.ok&&r.art&&this._summonBanner&&this._summonBanner.banner){this._summonBanner.banner.art=r.art;let s=(this._summonBanner.banners||[]).find(n=>n&&n.id===e);s&&(s.art=r.art)}}).catch(()=>{}).then(()=>{this._summonArting=!1,this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()}))}_summonPull(e){if(!this._run)return;let a=this._summonBannerId;this._postJson("/summon",{runId:this._run.runId,banner:a,count:e===10?10:1}).then(r=>{r&&r.ok&&Array.isArray(r.results)&&(this._summonResults=r.results,this._summonWallet=r.wallet||this._summonWallet,this._summonBannerState="idle",this._summonBanner=null,this._rosterCount+=r.results.filter(s=>s&&s.isNew).length,this._summonPhase="reveal",this._renderBrowser())})}_openFormation(){this._formationBattleMode=!1,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_loadFormation(){if(this._formationState="loading",this._renderBrowser(),!this._run){this._formationState="error",this._renderBrowser();return}this._postJson("/formation",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._formation=e,this._formationState="ready"):this._formationState="error"}).then(()=>{this._hudView==="formation"&&this._renderBrowser()})}_saveFormation(e,a){this._run&&(this._formation&&(this._formation={...this._formation,presets:e,active:a}),this._postJson("/formation/save",{runId:this._run.runId,presets:e,active:a}).then(r=>{r&&r.ok&&Array.isArray(r.presets)&&this._formation&&(this._formation={...this._formation,presets:r.presets,active:r.active})}))}};typeof customElements<"u"&&!customElements.get(pi)&&customElements.define(pi,Da);
