var ea=`
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
/* SLICE: the locked Battle block of the Collection slice had its own state class and a "Soon"
   label. Battle is live here, so both are gone: a stylesheet with no consumer never fails and
   never tells you it stopped applying. */
.hm-cta .eyebrow { font-size: var(--t-tiny); letter-spacing: 0.22em; text-transform: var(--case); color: var(--steel-faint); }
/* line-height 1.2 and not 1: at exactly 1 the glyph box can overshoot the line box on some
   styles. A line height that cannot contain its own font is a trap for the day the text changes. */
.hm-cta .big { font-family: var(--title); font-size: var(--t-xl); font-weight: 700; font-stretch: var(--stretch); letter-spacing: 0.04em; text-transform: var(--case); line-height: 1.2; }
/* SLICE: .title and the .nodes diamonds printed the chapter this block leads to. They come back
   with the story package, which is what produces a chapter to print. */
.hm-cta .go { font-size: var(--t-sm); font-weight: 700; letter-spacing: 0.14em; text-transform: var(--case); color: var(--coral); }

/* \u2500\u2500 THE RIGHT RAIL: the less frequent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Continuity and Settings are NOT here \u2014 the bar already carries their doors, and a second door
   to the same place is duplication. Locked entries are drawn because no system exists behind
   them yet. */
.hm-rail { flex: none; display: flex; flex-direction: column; gap: var(--sp-1); align-items: stretch; width: 34%; }

/* SLICE: the story-context warning (.hm-warn) lived here. Context is produced by the story
   package, so nothing in this slice can cross the threshold that draws it. */
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
`;var Be="vanguard",Fe=[{id:"aurora",label:"Aurora",description:"Frosted glass and gold",swatch:["#171334","rgba(255,255,255,.10)","#E8C87A"]},{id:"bloom",label:"Bloom",description:"Bright and playful",swatch:["#2B3F63","#FFFFFF","#FF6E9C"]},{id:"signal",label:"Signal",description:"Technical and minimal",swatch:["#0C0D10","rgba(255,255,255,.10)","#C8FF3D"]},{id:"ember",label:"Ember",description:"Warm and painted",swatch:["#2C1E14","#6B4A2A","#F0B429"]},{id:"vanguard",label:"Vanguard",description:"Sharp and industrial",swatch:["#0E1725","#1E2C44","#F2603C"]}];function ta(t){return Fe.some(e=>e.id===String(t))}function Ue(t){return ta(t)?String(t):Be}var Qe=[1,1.15,1.3,1.5,1.75],Fs=1.5;function Ie(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return Fs;let a=Qe[0];for(let r of Qe)Math.abs(r-e)<Math.abs(a-e)&&(a=r);return a}var Is='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',Ms='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/></svg>',zs='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Os='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="11" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><path d="M6 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Ds='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ps='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" stroke-width="1.7"/></svg>';function et(t){let e=Math.max(0,Math.floor((Number(t)||0)/1e3)),a=Math.floor(e/60),r=e%60;return a+":"+String(r).padStart(2,"0")}function _e(t){return(Number(t)||0).toLocaleString("en-US")}function aa(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var ra=new Set(["hud","modes","summon","roster","unit","formation","chapter","chapters","combat","farm","inventory","settings","events"]),sa=`
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
/* Whatever trailing widget the screen's head carried (a tally, a progress meter) rides
   along rather than being dropped \u2014 that data has nowhere else to go. */
.gf-bar-slot .head-tally, .gf-bar-slot .sel-tally, .gf-bar-slot .cap-progress { font-family: var(--display); font-size: var(--gf-xs); color: var(--steel-faint); white-space: nowrap; }
.gf-bar-slot .cap-progress { min-width: calc(var(--gf-f) * 9); }
/* The Summon head carried its own Aether chip; the bar already shows Aether. */
.gf-bar-slot .wallet { display: none; }

/* Controls NEVER fall off the edge: the FIGURES yield. This group holds the currencies AND
   the buttons; as flex none nothing yielded, and on a narrow stage the figures pushed the
   buttons out of the box. What INFORMS yields; what is PRESSED never does \u2014 a clipped figure
   still says half, a button off screen says nothing. */
.gf-bar .currencies { display: flex; gap: var(--gf-sp-1); margin-left: auto; align-items: stretch; flex: 0 1 auto; min-width: 0; }
/* Figures shrink and, if needed, clip. */
.gf-bar .currencies > .currency { flex: 0 1 auto; min-width: 0; overflow: hidden; }
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
`,oa="1.1.0";function ia({username:t="",wallet:e=null,account:a=null,vigorNextMs:r=null}={}){let s=e&&typeof e=="object"?e:{},o=Number(s.aether)||0,i=Number(s.funds)||0,c=Number(s.vigor)||0,d=Number(s.vigorMax)||60,h=a||null,p=h?Math.max(1,Number(h.level)||1):1,n=h?h.xpNeeded?_e(Number(h.xp)||0)+" / "+_e(h.xpNeeded)+" XP":"MAX":"&mdash;",u=h&&Number(h.xpNeeded)||0,f=h?u>0?Math.max(0,Math.min(100,Math.round((Number(h.xp)||0)/u*1e3)/10)):100:0,w=Number.isFinite(r)?et(r):"",E=t&&t.trim()||"Commander",A=E.split(/\s+/).filter(Boolean).slice(0,2).map(_=>_[0]).join("").toUpperCase()||"C";return`
<header class="gf-bar">
  <div class="command">
    <div class="avatar">${aa(A)}</div>
    <div class="rank"><span data-bar-rank>${p}</span><small>RANK</small></div>
    <div class="xp">
      <div class="figure"><span>${aa(E)}</span><span data-bar-rankxp>${n}</span></div>
      <div class="xp-bar"><i data-bar-rankfill style="width:${f}%"></i></div>
    </div>
  </div>

  <div class="gf-bar-slot" data-bar-slot></div>

  <div class="currencies">
    <div class="currency aet">${Is}<div><div class="value" data-bar-aether>${_e(o)}</div></div></div>
    <div class="currency">${Ms}<div><div class="value" data-bar-funds>${_e(i)}</div></div></div>
    <div class="currency vig">${zs}<div class="value"><span data-bar-vigor>${c}</span><span class="dim" data-bar-vigormax>/${d}</span></div><span class="refill" data-vigor-next>${w}</span></div>
    <button class="icon-button gf-runs-bar" type="button" data-open-runs aria-label="Worlds" title="Switch or start a world">${Os}</button>
    <button class="icon-button" type="button" aria-label="Game settings">${Ps}</button>
    <button class="icon-button gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">${Ds}</button>
  </div>
</header>`}function na(t,{wallet:e=null,account:a=null,vigorNextMs:r=void 0}={}){if(!t||typeof t.querySelector!="function")return!1;let s=d=>t.querySelector(d);if(!(s("[data-bar-aether]")?t:null))return!1;let i=(d,h)=>{let p=s(d);p&&p.textContent!==h&&(p.textContent=h)},c=e&&typeof e=="object"?e:null;if(c&&(i("[data-bar-aether]",_e(Number(c.aether)||0)),i("[data-bar-funds]",_e(Number(c.funds)||0)),i("[data-bar-vigor]",String(Number(c.vigor)||0)),i("[data-bar-vigormax]","/"+(Number(c.vigorMax)||60))),r!==void 0){let d=s("[data-vigor-next]");if(d){let h=Number.isFinite(r)?et(r):"";d.textContent!==h&&(d.textContent=h)}}if(a){let d=Math.max(1,Number(a.level)||1),h=Number(a.xpNeeded)||0;i("[data-bar-rank]",String(d)),i("[data-bar-rankxp]",h>0?_e(Number(a.xp)||0)+" / "+_e(h)+" XP":"MAX");let p=s("[data-bar-rankfill]");if(p&&p.style){let n=h>0?Math.max(0,Math.min(100,Math.round((Number(a.xp)||0)/h*1e3)/10)):100;p.style.width=n+"%"}}return!0}function la(t,{nextMs:e,periodMs:a,onLanded:r}={}){if(!Number.isFinite(e))return()=>{};let s=Number(e),o=Number(a)>0?Number(a):0,i=Date.now()+s,c=()=>{let h=t&&t.querySelector?t.querySelector("[data-vigor-next]"):null;if(!h)return;let p=i-Date.now();if(p>0){h.textContent=et(p);return}i=o?Date.now()+o:Date.now(),h.textContent=o?et(o):"",r&&r()};c();let d=setInterval(c,1e3);return()=>clearInterval(d)}function ca(t){let e=t.querySelector&&t.querySelector("[data-bar-slot]");if(!e||typeof e.appendChild!="function")return!1;let a=t.querySelector(".head")||t.querySelector(".cap-head")||t.querySelector(".sel-head");if(!a||!a.childNodes)return!1;for(;e.firstChild;)e.removeChild(e.firstChild);let r=a.parentElement,s=[];for(let i of Array.from(a.childNodes))i.classList&&i.classList.contains("gf-stay")?s.push(i):e.appendChild(i);for(let i of s)r&&typeof r.appendChild=="function"&&r.appendChild(i);let o=typeof e.querySelectorAll=="function"?e.querySelectorAll(".eyebrow"):null;if(o&&typeof o.length=="number")for(let i=o.length-1;i>=0;i-=1){let c=o[i];c&&typeof c.remove=="function"&&c.remove()}return typeof a.remove=="function"&&a.remove(),!0}var da=`

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
.gf-gutter { align-self: stretch; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem; padding: 0.3rem 0; overflow: hidden; }
.gf-gutter-title { font-size: 0.66rem; letter-spacing: 0.2em; text-transform: var(--case); color: var(--steel-faint); padding-left: 0.2rem; }
.gf-news { background: linear-gradient(180deg, var(--ink-2), var(--ink)); border: 1px solid var(--ink-3); border-left: 2px solid var(--steel); padding: 0.55rem 0.65rem; display: flex; flex-direction: column; gap: 0.15rem; }
.gf-news .k { font-size: 0.58rem; letter-spacing: 0.14em; text-transform: var(--case); color: var(--coral); }
.gf-news .t { font-size: 0.8rem; color: var(--text); line-height: 1.2; }
.gf-news .d { font-size: 0.66rem; color: var(--steel-faint); }
/* A glance only: the gutter is whatever is left beside a 16:9 stage, which can be 0px and is
   hidden in fullscreen. The readable log lives in settings > Debug. */
.gf-tokens { background: linear-gradient(180deg, var(--ink-2), var(--ink)); border: 1px solid var(--ink-3); border-left: 2px solid var(--coral); padding: 0.45rem 0.55rem; display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.gf-tokens .k { font-size: 0.55rem; letter-spacing: 0.14em; text-transform: var(--case); color: var(--coral); }
.gf-tokens .v { font-size: 0.72rem; color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gf-tokens .v i { font-style: normal; color: var(--steel-faint); margin-right: 0.15rem; }
.gf-side-hint { margin-top: auto; font-size: 0.64rem; color: var(--steel-dark); text-align: center; letter-spacing: 0.08em; }

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
`,Hs='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',$s='<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1" y="1" width="12.5" height="22" rx="2"/><rect x="18.5" y="6.5" width="14.5" height="11" rx="1.8"/><path d="M15.4 7.6a6 6 0 0 1 2.6-2.4" stroke-dasharray="2.2 1.8"/><path d="M18.4 4.2l-1 2 2.1.5"/></svg>',qs=`
  <div class="gf-rot">
    <span class="gf-rot-ph">${$s}</span>
    <h3 data-rot-title>Landscape only</h3>
    <p data-rot-note>This game plays in a 16:9 landscape frame.</p>
    <button type="button" data-go-landscape>Play in landscape</button>
  </div>`;function ha(t,e){let a=Ue(e&&e.style),r=e&&e.entering?" data-enter":e&&e.swapping?" data-swap":"";return`
<div class="gf-arena" data-style="${a}">
  ${qs}
  <aside class="gf-gutter">
    <div class="gf-gutter-title">News</div>
    <div class="gf-news"><span class="k">Update</span><span class="t">More soon</span><span class="d">&mdash;</span></div>
    <div class="gf-side-hint">side rail &middot; later</div>
  </aside>

  <div class="gf-stage">
    ${e&&e.bar?"":`<button class="gf-fs-exit" type="button" title="Fullscreen" aria-label="Toggle fullscreen">${Hs}</button>`}
    ${e&&e.bar||""}
    <div class="gf-view"${r}>${t}</div>
  </div>

  <aside class="gf-gutter">
    <div class="gf-gutter-title">Feed</div>
    ${e&&e.tokens?`<div class="gf-tokens" title="Model tokens this engine run \u2014 the full log is in settings > Debug">
           <span class="k">Tokens</span>
           <span class="v"><i>&uarr;</i>${e.tokens.sent}</span>
           <span class="v"><i>&darr;</i>${e.tokens.received}</span>
         </div>`:'<div class="gf-side-hint">side rail &middot; later</div>'}
  </aside>
</div>
<style>${sa}</style>`}var js="marinara_admin_secret";function Us(){try{if(typeof localStorage>"u")return{};let t=(localStorage.getItem(js)||"").trim();return t?{"X-Admin-Secret":t}:{}}catch{return{}}}function pe(t,e){let a=e&&typeof e=="object"?e:{};return fetch(t,{...a,headers:{...Us(),...a.headers||{}}})}var pa=`
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
`;var tt=[{id:"all",label:"All"},{id:"5",label:"5&#9733;",tone:"g"},{id:"4",label:"4&#9733;",tone:"e"}];function se(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var bt={roster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20c0-2.8 2-4.6 4.6-4.6"/></svg>',formation:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="5.5" height="5.5"/><rect x="9.5" y="4" width="5.5" height="5.5"/><rect x="16" y="4" width="5.5" height="5.5"/><rect x="3" y="14" width="5.5" height="5.5"/><rect x="9.5" y="14" width="5.5" height="5.5"/></svg>',summon:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16l-1.4 12H5.4z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>',inventory:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5V18l-9 4.5L3 18z"/><path d="M3 9.5 12 14l9-4.5M12 14v8.5"/></svg>',events:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5V6h18v2.5a2 2 0 0 0 0 4V15H3v-2.5a2 2 0 0 0 0-4z"/><path d="M9 6v9" stroke-dasharray="2 2"/></svg>',missions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg>'},ua='<svg class="hm-figure" viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>',Gs=[{id:"roster",label:"Units",live:!0},{id:"formation",label:"Formation",live:!0},{id:"summon",label:"Summon",live:!0},{id:"shop",label:"Shop",live:!1},{id:"inventory",label:"Inventory",live:!1}],Vs=[{id:"events",label:"Events",live:!1},{id:"missions",label:"Achievements",live:!1}],Ws=[{id:"story",label:"Story",live:!1},{id:"banner",label:"Banners",live:!0},{id:"bond",label:"Bond",live:!1},{id:"event",label:"Events",live:!1},{id:"unit",label:"Units",live:!1}];function fa({kind:t,title:e,rail:a,source:r,items:s,current:o,currentName:i,none:c,emptyHint:d}){let h=a.map(f=>{let w=f.live!==!1;return'<button class="hm-pk-cat'+(w?"":" off")+'" type="button"'+(w?` aria-selected="${f.id===r}" data-pk-src="${se(f.id)}"`:" disabled")+`><span>${f.label}</span>`+(w?"":'<span class="soon">Soon</span>')+"</button>"}).join(""),p=f=>'<button class="hm-pk-card'+(f.key===o?" on":"")+`" type="button" data-pk-take="${se(f.key)}"><span class="shot">${f.url?`<img src="${se(f.url)}" alt="">`:ua}</span><span class="nm">${se(f.name)}</span>`+(f.kit?`<span class="kit"><b>${Number(f.rarity)||0}&#9733;</b> ${se(f.kit)}</span>`:"")+(f.key===o?'<span class="tag">In use</span>':"")+"</button>",u=(c?'<button class="hm-pk-card none'+(o?"":" on")+'" type="button" data-pk-take=""><span class="shot"><span>None</span></span><span class="nm">No background</span>'+(o?"":'<span class="tag">In use</span>')+"</button>":"")+(s.length?s.map(p).join(""):`<p class="hm-pk-empty">${se(d)}</p>`);return`
  <div class="hm-pk-wrap">
    <div class="hm-pk-veil" data-pk-close></div>
    <div class="hm-pk ${t}">
      <div class="hm-pk-head">
        <span class="ttl">${se(e)}</span>
        <span class="cur">${se(i||"None")}</span>
        <button class="x" type="button" data-pk-close>Close</button>
      </div>
      <div class="hm-pk-body">
        <div class="hm-pk-cats">${h}</div>
        <div class="hm-pk-grid">${u}</div>
      </div>
    </div>
  </div>`}function Ys(t,e,a){if(!t)return"";let r=e||{},s=a||{};if(t.slot==="bg"){let c=t.source||"story",d=r.backgrounds&&r.backgrounds[c]||[],h=s.bg?s.bg.key:"";return fa({kind:"bg",title:"Background",rail:Ws,source:c,items:d,current:h,currentName:s.bg?s.bg.name:"",none:!0,emptyHint:c==="banner"?"Banner art appears here once a banner has its picture painted.":"Story backgrounds are painted as your chapters reach a new place."})}let o=t.source||"all",i=(r.units||[]).filter(c=>o==="all"||String(c.rarity)===o);return fa({kind:"units",title:"Home unit",rail:tt,source:o,items:i,current:s.unit?s.unit.id:"",currentName:s.unit?s.unit.name:"",none:!1,emptyHint:o==="all"?"No characters yet.":`No ${o}-star characters yet. Summon on any banner to find one.`})}function va({decor:t=null,pick:e=null,pickOptions:a=null}){let r=t&&typeof t=="object"?t:{},s=r.bg&&r.bg.url?r.bg:null,o=r.unit||null,i=d=>`<button class="hm-tile ${d.id}${d.live?"":" off"}" type="button"`+(d.live?` data-go="${d.id}"`:" disabled")+">"+bt[d.id]+`<span class="nm">${se(d.label)}</span>`+(d.live?"":'<span class="soon">Soon</span>')+"</button>",c=d=>d.live?`<button class="hm-side" type="button" data-go="${d.id}"><span class="lbl">${bt[d.id]}<span>${se(d.label)}</span></span></button>`:`<button class="hm-side off" type="button" disabled><span class="lbl">${bt[d.id]}<span>${se(d.label)}</span></span><span class="soon">Soon</span></button>`;return`
<div class="root">
  <div class="hm-screen">
    ${s?`<img class="hm-bg" src="${se(s.url)}" alt="">`:'<div class="hm-ground"></div>'}
    <div class="hm-scrim"></div>

    <div class="hm-scene">
      <div class="hm-plate">
        <div class="hm-art">${o&&o.portrait?`<img src="${se(o.portrait)}" alt="">`:ua}</div>
        <button class="hm-slot hm-slot-unit" type="button" data-pick="unit">
          <span class="nm">${se(o&&o.name?o.name:"No unit set")}</span>
          <span class="swap">Change</span>
        </button>
      </div>

      <div class="hm-right">
        <button class="hm-slot hm-slot-bg" type="button" data-pick="bg">
          <span class="nm">${se(s?s.name:"No background set")}</span>
          <span class="swap">Change</span>
        </button>

        <div class="hm-rail">${Vs.map(c).join("")}</div>
        <!-- Battle is the door to the MODES screen, not straight to a fight: Materials is one
             mode of several. SLICE: the full game also prints the current chapter here (label,
             title and node progress) \u2014 story data this package has none of, and inventing a
             stand-in line is what the Home already had cut out of it. -->
        <button class="hm-cta" type="button" data-open-modes>
          <span class="big">Battle</span>
          <span class="go">Enter</span>
        </button>
      </div>
    </div>

    <div class="hm-dock">${Gs.map(i).join("")}</div>
  </div>
${Ys(e,a,r)}
</div>`}function ga(t,{onOpenRoster:e,onOpenSummon:a,onOpenModes:r,onOpenFormation:s,onPickOpen:o,onPickClose:i,onPickSource:c,onPickTake:d}){for(let n of t.querySelectorAll("[data-open-modes]"))n.addEventListener("click",()=>r&&r());let h={roster:e,formation:s,summon:a};for(let n of t.querySelectorAll("[data-go]")){let u=h[n.getAttribute("data-go")];n.addEventListener("click",f=>{f&&typeof f.stopPropagation=="function"&&f.stopPropagation(),u&&u()})}(t.querySelector(".root")||t).addEventListener("click",n=>{let u=A=>n&&n.target&&n.target.closest?n.target.closest(A):null,f=u("[data-pick]");if(f){o&&o(f.getAttribute("data-pick"));return}if(u("[data-pk-close]")){i&&i();return}let w=u("[data-pk-src]");if(w){c&&c(w.getAttribute("data-pk-src"));return}let E=u("[data-pk-take]");E&&d&&d(E.getAttribute("data-pk-take"))})}var Ne=[{id:"world",label:"World",lead:"Chapters, banners and the cast you pull all grow from what you write here."},{id:"you",label:"You"},{id:"sources",label:"Sources",lead:"The forge <b>reads</b> your books &mdash; it never edits them."},{id:"look",label:"Look",lead:"All of it is per world, and none of it changes the game."}],Xs=[{value:"English",label:"English"},{value:"Japanese",label:"\u65E5\u672C\u8A9E"},{value:"Korean",label:"\uD55C\uAD6D\uC5B4"},{value:"Chinese",label:"\u4E2D\u6587"},{value:"Spanish",label:"Espa\xF1ol"},{value:"French",label:"Fran\xE7ais"},{value:"German",label:"Deutsch"},{value:"Polish",label:"Polski"},{value:"Portuguese",label:"Portugu\xEAs"},{value:"Russian",label:"\u0420\u0443\u0441\u0441\u043A\u0438\u0439"}],Ce=[{id:"scenario",step:"world",type:"textarea",label:"Your gacha world",required:"Describe your gacha world before continuing.",maxLength:4e3,placeholder:"e.g. A drowned neon city where salvaged spirits are bound into cards and fight for the tide-courts\u2026",hint:"A theme, a tone, and what you collect.",wide:!0},{id:"language",step:"world",settings:"sources",group:"narrator",type:"select",label:"Narration language",options:Xs},{id:"name",step:"world",type:"text",label:"Name this run",maxLength:80,placeholder:"Untitled run"},{id:"protagonist",step:"you",type:"custom",render:"personas",label:"Your protagonist",required:"Pick your protagonist \u2014 a Marinara persona.",hint:"Their full sheet shapes the narration, not just their name.",wide:!0},{id:"username",step:"you",type:"text",label:"Your name",maxLength:40,placeholder:"Commander",hint:"Shown on your HUD profile &mdash; not the protagonist."},{id:"connectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Narrator connection",required:"Pick the connection that will narrate.",hint:"Only text models are listed &mdash; image/video connections can't narrate."},{id:"lore",step:"sources",settings:"sources",group:"lore",type:"custom",render:"lorebooks",label:"Your lorebooks",wide:!0},{id:"hudStyle",step:"look",type:"custom",render:"styles",label:"HUD style",wide:!0},{id:"images.connectionId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageConnections",label:"Image connection",emptyOption:"Off \u2014 no art at all"},{id:"images.portraits",step:"look",settings:"sources",group:"images",type:"toggle",label:"Hero portraits",default:!0,showIf:t=>!!t["images.connectionId"],hint:"Painted right after your founding cast &mdash; it adds a few minutes to this setup."},{id:"images.styleProfileId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageProfiles",label:"Portrait style",showIf:t=>!!t["images.connectionId"]},{id:"images.backgrounds",step:"look",settings:"sources",group:"images",type:"toggle",label:"Backgrounds",showIf:t=>!!t["images.connectionId"],hint:"Separate from portraits because it multiplies how many images a world paints."}],Ks=[{id:"narrator",label:"Narrator"},{id:"lore",label:"Lorebooks"},{id:"images",label:"Images"}];function ma(t){let e=at(t);return Ks.map(a=>({...a,fields:e.filter(r=>r.group===a.id)})).filter(a=>a.fields.length)}function at(t){return Ce.filter(e=>e.settings===t)}function yt(t){return Ce.filter(e=>e.step===t)}function Se(t,e){return!t.showIf||!!t.showIf(e||{})}function Zs(t){return Ce.filter(e=>Se(e,t))}function ba(t,e){for(let a of yt(t)){if(!a.required||!Se(a,e))continue;let r=e?e[a.id]:null;if(r==null||r===""||Array.isArray(r)&&!r.length)return a}return null}function rt(t){let e={};for(let a of Zs(t)){let r=t[a.id];if(r===void 0)continue;let s=a.id.split("."),o=e;for(let i=0;i<s.length-1;i+=1)(!o[s[i]]||typeof o[s[i]]!="object")&&(o[s[i]]={}),o=o[s[i]];o[s[s.length-1]]=r}return e}var xa=`
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
`,Js='<svg class="ob-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="0,0 100,0 100,80 80,100 0,100" fill="var(--ink)"/><polygon points="4,4 96,4 96,78 78,96 4,96" fill="none" stroke="var(--steel-dark)" stroke-width="2.5"/><path d="M50 14 C53 41 59 47 86 50 C59 53 53 59 50 86 C47 59 41 53 14 50 C41 47 47 41 50 14 Z" fill="var(--coral)"/><path d="M50 30 C51.5 45 55 48.5 70 50 C55 51.5 51.5 55 50 70 C48.5 55 45 51.5 30 50 C45 48.5 48.5 45 50 30 Z" fill="var(--amber)" opacity=".9"/></svg>',ka='Forge this world <span class="arrow">&#9656;</span>';function ot(t){let e=Math.max(1,Math.min(3,Number(t)||1));return new Array(e).fill('<div class="ob-bookhead ob-bookgrid"><span>Book</span><span>World</span><span>Cast</span></div>').join("")}var Qs='<svg class="bx-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.4 6.6 11.5 12.5 4.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function eo(t,e){let a=o=>e&&e[o]?"true":"false",r=(o,i)=>'<button class="ob-bx" type="button" role="checkbox" aria-label="'+i+": "+be(t.name)+'" aria-checked="'+a(o)+'" data-book="'+be(t.id)+'" data-role="'+o+'">'+Qs+"</button>";return'<div class="ob-book ob-bookgrid'+(e&&(e.world||e.cast)?" on":"")+'"><span class="bt"><b>'+be(t.name)+"</b>"+(t.description?'<span class="bd">'+be(t.description)+"</span>":"")+"</span>"+r("world","World lore")+r("cast","Cast book")+"</div>"}function wt(t,e){let a=t.wide?" ob-wide":"",r=e&&e.hidden?" hidden":"",s=!!(e&&e.terse),o=t.label&&t.type!=="toggle"?"<label"+(t.type==="text"||t.type==="textarea"||t.type==="select"?' for="ob-'+st(t.id)+'"':"")+">"+t.label+(t.required?' <span class="ob-req">*</span>':"")+"</label>":"",i=t.hint&&!s?'<span class="hint">'+t.hint+"</span>":"",c="";if(t.type==="custom")c=e&&e.custom?e.custom(t):"";else if(t.type==="textarea")c='<textarea id="ob-'+st(t.id)+'" class="ob-control" data-input="'+ae(t.id)+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+ae(t.placeholder)+'"':"")+"></textarea>";else if(t.type==="select"){let d=Array.isArray(t.options)?t.options.map(h=>'<option value="'+ae(h.value)+'">'+ae(h.label||h.value)+"</option>").join(""):"";c='<select id="ob-'+st(t.id)+'" class="ob-control" data-input="'+ae(t.id)+'">'+(t.emptyOption?'<option value="">'+ae(t.emptyOption)+"</option>":"")+d+"</select>"}else t.type==="toggle"?c='<label class="ob-toggle"><button class="ob-bx" type="button" role="checkbox" aria-checked="false" data-input="'+ae(t.id)+'" aria-label="'+ae(t.label||t.id)+'"><span>\u2713</span></button><span class="bt"><b>'+(t.boxLabel||t.label||"")+"</b>"+(t.boxHint&&!s?'<span class="bd">'+t.boxHint+"</span>":"")+"</span></label>":c='<input id="ob-'+st(t.id)+'" class="ob-control" data-input="'+ae(t.id)+'" type="'+(t.type==="number"?"number":"text")+'"'+(t.maxLength?' maxlength="'+t.maxLength+'"':"")+(t.placeholder?' placeholder="'+ae(t.placeholder)+'"':"")+" />";return'<div class="ob-field'+a+'" data-field="'+ae(t.id)+'"'+r+">"+o+c+i+"</div>"}function st(t){return String(t).replace(/[^A-Za-z0-9_-]+/g,"-")}function to(){return'<span class="hint"><b>World</b>: what is true here &mdash; <b>constant</b> entries always, the rest on their keywords; what does not fit the budget is <b>dropped</b>. <b>Cast</b>: the forge picks the sheets it is about to mint &mdash; <b>5</b> when the world is forged, <b>2</b> per featured banner &mdash; and never offers the same character twice.</span>'}function xt(t,e){if(t.render==="personas")return'<div class="ob-personas" role="radiogroup" aria-label="Protagonist persona" data-personas><span class="ob-personas-empty">Loading personas&hellip;</span></div>';if(t.render==="styles")return'<div class="ob-styles" role="radiogroup" aria-label="HUD style">'+Fe.map(r=>{let[s,o,i]=r.swatch;return'<button class="ob-sw" type="button" role="radio" data-style-pick="'+r.id+'" aria-pressed="'+(r.id===Be)+'"><span class="mini" style="background:'+s+'"><i style="left:8%;top:9%;width:84%;height:14%;background:'+o+'"></i><i style="left:8%;top:30%;width:50%;height:36%;background:'+o+'"></i><i style="left:62%;top:30%;width:30%;height:16%;background:'+i+'"></i><i style="left:62%;top:50%;width:30%;height:16%;background:'+o+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+o+'"></i></span><span class="tick">&#10003;</span><span class="lbl"><b>'+r.label+"</b><span>"+r.description+"</span></span></button>"}).join("")+"</div>";if(t.render==="lorebooks"){let a=Math.max(1,Math.min(3,Number(e&&e.cols)||1));return'<div class="ob-booklist" role="group" aria-label="Lorebooks" data-cols="'+a+'" data-books>'+ot(a)+'<span class="ob-books-empty">Reading your library&hellip;</span></div><div class="ob-budget"><label class="ob-bud"><span class="k">World tk</span><input type="number" min="0" step="500" data-budget="world" aria-label="World token budget" /><span class="w" data-weight="world"></span></label><label class="ob-bud"><span class="k">Cast tk</span><input type="number" min="0" step="500" data-budget="cast" aria-label="Cast token budget" /><span class="w" data-weight="cast"></span></label></div>'+to()}return""}function ao(t,e){let a=yt(t.id).map(s=>wt(s,{custom:xt,hidden:!Se(s,e||{})})).join("");return'<div class="ob-grid">'+(t.lead?'<p class="ob-lead ob-wide">'+t.lead+"</p>":"")+a+"</div>"}function _a({cancelable:t=!1,values:e={}}={}){let a=t?'<button class="ob-cancel" type="button" data-cancel>Cancel</button>':"",r=Ne.map((o,i)=>'<button type="button" data-goto="'+(i+1)+'" data-state="'+(i===0?"active":"todo")+'" data-reachable="'+(i===0?"true":"false")+'"><span class="n">'+(i+1)+"</span>"+o.label+"</button>").join(""),s=Ne.map((o,i)=>'<section class="ob-step" data-step="'+(i+1)+'" data-step-id="'+o.id+'"'+(i===0?"":" hidden")+">"+ao(o,e)+(i===Ne.length-1?'<p class="ob-foot">Forging generates your <b>first chapter</b> &mdash; takes a moment.</p>':"")+"</section>").join("");return`
<div class="ob-root">
  <div class="ob-frame">
  <div class="ob-intake">
    <div class="ob-brand">
      ${Js}
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
      <button class="ob-forge" type="button" data-forge hidden>${ka}</button>
    </div>
  </div>
  </div>
</div>`}var ro=new Set(["image_generation","video_generation"]),Sa="/api/gacha-forge";function be(t){return String(t??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}function ya(t){return t===!0||t==="true"||t===1||t==="1"}function ae(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function so(t){let e=String(t||"").trim().split(/\s+/).filter(Boolean),a=e[0]?e[0][0]:"",r=e[1]?e[1][0]:"";return(a+r).toUpperCase()||"?"}function oo(t,e){let a=String(t?.id??""),r=String(t?.name??"Unnamed"),s=String(t?.comment??""),o=t?.avatarPath?`<span class="pav"><img src="${ae(t.avatarPath)}" alt=""></span>`:`<span class="pav">${ae(so(r))}</span>`;return`<button class="ob-persona" type="button" role="radio" data-persona="${ae(a)}" data-selected="false">`+(e?'<span class="pactive">Active</span>':"")+'<span class="pcheck">&#10003;</span>'+o+`<span class="pname">${ae(r)}</span><span class="pcomment">${ae(s)}</span></button>`}function wa(t){return t?{personaId:String(t.id??""),name:String(t.name??"").trim(),comment:String(t.comment??""),description:String(t.description??""),personality:String(t.personality??""),appearance:String(t.appearance??""),backstory:String(t.backstory??""),scenario:String(t.scenario??""),tags:Array.isArray(t.tags)?t.tags.map(e=>String(e)):[],avatarPath:t.avatarPath?String(t.avatarPath):null}:null}function kt(t,{initial:e,onChange:a}={}){let r=e&&typeof e=="object"?e:{},s={world:new Set(Array.isArray(r.worldIds)?r.worldIds:[]),cast:new Set(Array.isArray(r.castIds)?r.castIds:[])},o=new Map,i=n=>t.querySelector('[data-budget="'+n+'"]'),c=()=>({worldIds:[...s.world],castIds:[...s.cast],worldBudget:Number(i("world")&&i("world").value),castBudget:Number(i("cast")&&i("cast").value)}),d=()=>{a&&a(c())};function h(){for(let n of["world","cast"]){let u=t.querySelector('[data-weight="'+n+'"]');if(!u)continue;let f=0,w=!1;for(let R of s[n]){let I=o.get(R);typeof I=="number"?f+=I:w=!0}let E=i(n),A=E&&E.value!==""?Number(E.value):NaN,_=Number.isFinite(A)?A:Number(E&&E.placeholder);if(!s[n].size){u.textContent="",u.setAttribute("data-over","false");continue}let T=f>=1e3?Math.round(f/100)/10+"k":String(f);u.textContent="picked \u2248"+T+(w?"+":""),u.setAttribute("data-over",Number.isFinite(_)&&f>_?"true":"false")}}function p(n,u){let f=t.querySelector("[data-books]");if(f){if(u){f.innerHTML=ot(f.getAttribute("data-cols"))+'<span class="ob-books-empty">'+be(u)+"</span>";return}if(!n.length){f.innerHTML=ot(f.getAttribute("data-cols"))+'<span class="ob-books-empty">No lorebooks in your library yet. Write or import one in Marinara and it shows up here.</span>';return}f.innerHTML=ot(f.getAttribute("data-cols"))+n.map(w=>eo(w,{world:s.world.has(w.id),cast:s.cast.has(w.id)})).join("");for(let w of f.querySelectorAll("[data-role]"))w.addEventListener("click",()=>{let E=w.getAttribute("data-book"),A=s[w.getAttribute("data-role")];if(!A)return;A.has(E)?A.delete(E):A.add(E),w.setAttribute("aria-checked",A.has(E)?"true":"false"),h();let _=w.parentNode;_&&_.classList&&_.classList.toggle("on",s.world.has(E)||s.cast.has(E)),d()})}}for(let n of["world","cast"]){let u=i(n),f=r[n+"Budget"];u&&f!==null&&f!==void 0&&Number.isFinite(Number(f))&&(u.value=String(f))}pe(Sa+"/lorebooks").then(n=>n&&n.ok&&typeof n.json=="function"?n.json():null).then(n=>{if(n&&n.ok&&Array.isArray(n.books)){for(let f of n.books)f&&typeof f.tokens=="number"&&o.set(f.id,f.tokens);let u=n&&n.defaults||{};for(let f of["world","cast"]){let w=i(f);w&&(w.placeholder=String(Number(u[f])||(f==="cast"?2e4:6e3)))}p(n.books,null),h()}else p([],"Could not read your lorebooks. The world can still be forged without them.")}).catch(()=>p([],"Could not read your lorebooks. The world can still be forged without them."));for(let n of["world","cast"]){let u=i(n);u&&(u.addEventListener("input",h),u.addEventListener("change",d))}return{value:c}}function Ea(t,{onCreate:e,onCancel:a}){let r=g=>t.querySelector('[data-input="'+g+'"]'),s=g=>t.querySelector('[data-field="'+g+'"]'),o={};function i(){for(let g of Ce){let m=s(g.id);m&&(m.hidden=!Se(g,o))}}let c=r("scenario"),d=r("name"),h=r("username"),p=r("connectionId"),n=r("images.connectionId"),u=s("images.connectionId")&&s("images.connectionId").querySelector(".hint"),f=s("images.styleProfileId"),w=r("images.styleProfileId"),E=t.querySelector("[data-personas]"),A=t.querySelector(".ob-error"),_=t.querySelector("[data-forge]"),T=t.querySelector("[data-cancel]");T&&T.addEventListener("click",()=>a&&a());let R=Ne.length,I=Array.from(t.querySelectorAll("[data-step]")),G=Array.from(t.querySelectorAll("[data-goto]")),M=t.querySelector("[data-back]"),j=t.querySelector("[data-next]"),O=1,V=1;function Q(g){O=Math.min(R,Math.max(1,g)),V=Math.max(V,O);for(let m of I)m.hidden=Number(m.getAttribute("data-step"))!==O;for(let m of G){let b=Number(m.getAttribute("data-goto"));m.setAttribute("data-state",b===O?"active":b<V?"done":"todo"),m.setAttribute("data-reachable",b<=V?"true":"false")}M&&(M.hidden=O===1),j&&(j.hidden=O===R),_&&(_.hidden=O!==R),Z("")}for(let g of G)g.addEventListener("click",()=>{let m=Number(g.getAttribute("data-goto"));m<=V&&Q(m)});M&&M.addEventListener("click",()=>Q(O-1)),j&&j.addEventListener("click",()=>{X(O)&&Q(O+1)});function X(g){he();let m=Ne[g-1]&&Ne[g-1].id,b=m?ba(m,o):null;if(!b)return!0;Z(b.required);let S=r(b.id);return S&&S.focus&&S.focus(),!1}function he(){for(let g of Ce){if(g.type==="custom")continue;let m=r(g.id);m&&(g.type==="toggle"?o[g.id]=m.getAttribute("aria-checked")==="true":g.type==="number"?o[g.id]=Number(m.value):o[g.id]=typeof m.value=="string"?m.value.trim():"")}i()}let ue=kt(t,{}),ie=Be;o.hudStyle=Be;let ee=t.querySelector(".gf-arena");for(let g of t.querySelectorAll("[data-style-pick]"))g.addEventListener("click",()=>{ie=g.getAttribute("data-style-pick"),o.hudStyle=ie;for(let m of t.querySelectorAll("[data-style-pick]"))m.setAttribute("aria-pressed",String(m===g));ee&&ee.setAttribute&&ee.setAttribute("data-style",ie)});let te=null,ne=[];function ve(g){te=g,o.protagonist=wa(g);for(let m of ne)m.el.setAttribute("data-selected",m.persona===g?"true":"false")}function Z(g){A&&(A.textContent=g||"",A.hidden=!g)}pe("/api/connections").then(g=>g&&g.ok&&typeof g.json=="function"?g.json():Promise.reject(new Error("connections"))).then(g=>{let m=Array.isArray(g)?g:[],b=m.filter(N=>!ro.has(String(N?.provider??"")));if(m.length===0){Z("No connection configured. Create one in the engine settings and come back.");return}if(b.length===0){Z("Your connections are image or video only, and none can narrate. Configure a text connection in the engine settings.");return}p.innerHTML=b.map(N=>{let U=String(N?.id??""),Ee=String(N?.name??U),Le=String(N?.model??"").trim(),K=Le?`${Ee} \u2014 ${Le}`:Ee;return`<option value="${U}">${K.replace(/</g,"&lt;")}</option>`}).join("");let S=b.find(N=>ya(N?.isDefault))??b.find(N=>ya(N?.fallbackForMain));S?.id&&(p.value=String(S.id))}).catch(()=>Z("Could not read the engine connections."));for(let g of Ce.filter(m=>m.type==="toggle")){let m=r(g.id);m&&(o[g.id]=g.default===!0,m.setAttribute("aria-checked",o[g.id]?"true":"false"),m.addEventListener("click",()=>{o[g.id]=!o[g.id],m.setAttribute("aria-checked",o[g.id]?"true":"false")}))}let x=g=>{o["images.connectionId"]=g?n&&n.value||"on":"",i()};pe(`${Sa}/image-options`).then(g=>g&&g.ok&&typeof g.json=="function"?g.json():null).then(g=>{let m=g&&Array.isArray(g.connections)?g.connections:[];if(!m.length){u&&(u.textContent="No image connection is configured in the engine, so portraits stay off. Heroes show a silhouette when they speak."),n&&(n.disabled=!0);return}n&&(n.innerHTML='<option value="">Off</option>'+m.map(S=>`<option value="${be(S.id)}">${be(S.name)}</option>`).join(""));let b=g&&Array.isArray(g.profiles)?g.profiles:[];w&&(w.innerHTML=b.length?b.map(S=>`<option value="${be(S.id)}">${be(S.name)} &mdash; ${be(S.promptMode)}</option>`).join(""):'<option value="">Engine default</option>')}).catch(()=>{}),n&&n.addEventListener("change",()=>x(!!n.value)),Promise.all([pe("/api/characters/personas/list").then(g=>g&&g.ok&&typeof g.json=="function"?g.json():[]).catch(()=>[]),pe("/api/characters/personas/active").then(g=>g&&g.ok&&typeof g.json=="function"?g.json():null).catch(()=>null)]).then(([g,m])=>{if(!E)return;let b=Array.isArray(g)?g:g&&Array.isArray(g.items)?g.items:[];if(b.length===0){E.innerHTML='<span class="ob-personas-empty">No personas in Marinara yet &mdash; create one there first, then come back.</span>';return}let S=m&&m.id;E.innerHTML=b.map(N=>oo(N,N.id===S)).join(""),ne=[];for(let N of b){let U=t.querySelector('[data-persona="'+String(N.id??"")+'"]');U&&(ne.push({persona:N,el:U}),U.addEventListener("click",()=>ve(N)))}ve(b.find(N=>N.id===S)||b[0])}),_?.addEventListener("click",async()=>{if(!(c?.value||"").trim()){Z("Describe your gacha world before forging."),c?.focus?.();return}if(!te){Z("Pick your protagonist \u2014 a Marinara persona.");return}if(!(p?.value||"")){Z("Pick the connection that will narrate.");return}let b=(d?.value||"").trim(),S=(h?.value||"").trim(),N=wa(te);Z(""),_&&(_.disabled=!0,_.textContent="Forging\u2026");try{he(),o.protagonist=N,o.hudStyle=ie,o.lore=ue.value(),await e(rt(o))}catch(U){_&&(_.disabled=!1,_.innerHTML=ka),Z(`Could not start: ${U instanceof Error?U.message:String(U)}`)}}),Q(1)}var Me=[{id:"visual",kicker:"Look",label:"Visual"},{id:"sources",kicker:"World",label:"Sources"},{id:"debug",kicker:"Diagnostics",label:"Debug"}],ze="visual";function le(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function io(t){let e=Ue(t);return Fe.map(a=>{let[r,s,o]=a.swatch;return'<button class="st-sty" type="button" data-style-set="'+a.id+'" aria-pressed="'+(a.id===e)+'"><span class="st-mini" style="background:'+r+'"><i style="left:8%;top:10%;width:84%;height:14%;background:'+s+'"></i><i style="left:8%;top:31%;width:50%;height:34%;background:'+s+'"></i><i style="left:62%;top:31%;width:30%;height:15%;background:'+o+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+s+'"></i></span><span class="st-tick">&#10003;</span><span class="st-swlbl"><b>'+a.label+"</b><span>"+a.description+"</span></span></button>"}).join("")}function no(t){let e=Ie(t);return Qe.map(a=>'<button class="st-chip" type="button" data-text-scale="'+a+'" aria-pressed="'+(a===e)+'">'+Math.round(a*100)+"%</button>").join("")}function lo({hudStyle:t,textScale:e}){return'<div class="st-plate"><div class="hd"><h3>HUD style</h3></div><div class="st-styles">'+io(t)+'</div></div><div class="st-plate"><div class="hd"><h3>Text size</h3></div><div class="st-chips" role="group" aria-label="Text size">'+no(e)+"</div></div>"}function co(t,e){let a=t;for(let r of String(e).split(".")){if(!a||typeof a!="object")return;a=a[r]}return a}function Ta(t,e){let a={};for(let r of at(e)){let s=co(t,r.id);a[r.id]=s===void 0?r.default:s}return a}function ho(t){return ma("sources").map(e=>{let a=e.fields.length===1,r=e.fields.map(s=>wt(a?{...s,label:""}:s,{custom:xt,hidden:!Se(s,t),terse:!0})).join("");return'<div class="st-plate"><div class="hd"><h3>'+le(e.label)+'</h3></div><div class="ob-grid">'+r+"</div></div>"}).join("")+'<p class="st-foot">Applies to what this world generates next; nothing already made is redrawn.</p>'}function po(t){let e=t&&t.status||"idle";if(e==="loading")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Reading&hellip;</div></div>';if(e==="error")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Could not read the lorebook status.</div></div>';if(e!=="ready")return"";let a=t&&t.data||{};if(!a.enabled)return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">This world uses no lorebooks. Pick them in Sources.</div></div>';let r=d=>Number.isFinite(Number(d))?Number(d).toLocaleString("en-US"):"&mdash;",s=(d,h,p)=>{if(!h)return"";let n=h.dropped>0;return'<span class="st-tl-tot"><i>'+d+"</i><b>"+r(h.entries)+" / "+r(h.pool)+' entries</b></span><span class="st-tl-tot"><i>tokens</i><b>'+r(h.tokens)+" / "+r(p)+"</b></span>"+(n?'<span class="st-tl-warn">'+r(h.dropped)+" entr"+(h.dropped===1?"y":"ies")+" will NOT fit &mdash; the generator works from a fragment</span>":"")},o=(Array.isArray(a.next)?a.next:[]).map(d=>d.uses===!1?'<div class="st-tl-row"><span class="st-tl-l">'+le(d.label)+'</span><span class="st-tl-o">no lore</span></div><div class="st-tl-note">'+le(d.why||"")+"</div>":'<div class="st-tl-row"><span class="st-tl-l">'+le(d.label)+'</span></div><div class="st-tl-totals">'+s("world",d.world,a.budgets&&a.budgets.world)+s("cast",d.cast,a.budgets&&a.budgets.cast)+"</div>").join(""),i=a.library||{};return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks &mdash; what the next call carries</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+('<div class="st-tl-totals"><span class="st-tl-tot"><i>world books</i><b>'+r(i.world&&i.world.books)+'</b></span><span class="st-tl-tot"><i>cast books</i><b>'+r(i.cast&&i.cast.books)+'</b></span><span class="st-tl-tot"><i>already minted</i><b>'+r(a.minted)+"</b></span>"+((a.missing||[]).length?'<span class="st-tl-warn">'+(a.missing||[]).length+" book(s) this world points at no longer exist</span>":"")+"</div>")+o+"</div>"}function fo(){return'<section class="st-plate st-build"><div class="hd"><h3>Build</h3></div><div class="st-build-row"><span class="k">Package version</span><b data-build-version>v'+le(oa)+"</b></div></section>"}function _t(t,e){return fo()+po(t)+uo(e)}function uo(t){let e=t&&t.status||"idle",a=t&&Array.isArray(t.entries)&&t.entries||[],r=t&&t.totals||null,s=d=>Number.isFinite(d)?Number(d).toLocaleString("en-US"):"&mdash;",o=d=>{let h=new Date(Number(d)||0),p=n=>String(n).padStart(2,"0");return p(h.getHours())+":"+p(h.getMinutes())+":"+p(h.getSeconds())},i;return e==="loading"?i='<div class="st-tl-msg">Reading&hellip;</div>':e==="error"?i='<div class="st-tl-msg">Could not read the token log.</div>':a.length?i='<div class="st-tl-rows">'+a.map(d=>'<div class="st-tl-row'+(d.outcome==="ok"?"":" bad")+'"><span class="st-tl-t">'+o(d.at)+'</span><span class="st-tl-l">'+le(d.label)+(d.attempt>1?'<b class="st-tl-retry">retry '+d.attempt+"</b>":"")+'</span><span class="st-tl-u st-tl-up">'+s(d.sent)+'</span><span class="st-tl-u st-tl-dn">'+s(d.received)+'</span><span class="st-tl-o">'+le(d.outcome)+"</span></div>").join("")+"</div>":i='<div class="st-tl-msg">No model calls recorded for this world yet.</div>','<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Model calls</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+(r?'<div class="st-tl-totals"><span class="st-tl-tot"><i>sent</i><b>'+s(r.sent)+'</b></span><span class="st-tl-tot"><i>received</i><b>'+s(r.received)+'</b></span><span class="st-tl-tot"><i>calls</i><b>'+s(r.calls)+"</b></span>"+(r.cached?'<span class="st-tl-tot"><i>of that cached</i><b>'+s(r.cached)+"</b></span>":"")+(r.cacheWrite?'<span class="st-tl-tot"><i>cache writes</i><b>'+s(r.cacheWrite)+"</b></span>":"")+(r.unreported?'<span class="st-tl-warn">'+r.unreported+" call(s) reported no usage &mdash; the totals are short by that much</span>":"")+(r.dropped?'<span class="st-tl-warn">'+s(r.dropped)+" older call(s) dropped past the "+s(r.capped)+"-row cap</span>":"")+"</div>":"")+i+'<p class="st-tl-note">Every model call this world has ever made, newest first &mdash; kept across restarts. Portrait generation is not here: it goes to the engine over HTTP, not through the language model.</p></div>'}function Aa({category:t=ze,backLabel:e="Home",hudStyle:a="",textScale:r=null,tokenLog:s=null,loreStatus:o=null,run:i=null}={}){let c=Me.some(u=>u.id===t)?t:ze,d=Me.find(u=>u.id===c)||Me[0],h=Me.map(u=>'<button class="st-sect" type="button" role="tab" aria-selected="'+(u.id===c)+'" data-view="'+u.id+'"><span class="k">'+le(u.kicker)+'</span><span class="n">'+le(u.label)+"</span></button>").join(""),p={visual:()=>lo({hudStyle:a,textScale:r}),sources:()=>ho(Ta(i,"sources")),debug:()=>_t(o,s)},n=p[c]?p[c]():"";return'<div class="root"><div class="stage"></div><section class="screen" data-screen="settings"><div class="head"><button class="back" type="button" data-settings-back>&#9664; '+le(e)+'</button><div class="head-id"><div class="eyebrow">Settings</div><h2>'+le(d.label)+'</h2></div></div><div class="body"><div class="st-rail" role="tablist">'+h+'</div><div class="st-pane" data-view-body="'+c+'">'+n+"</div></div></section></div>"}function Na(t,{open:e,category:a,run:r,onOpen:s,onBack:o,onCategory:i,onStyle:c,onTextScale:d,onSources:h}={}){for(let n of t.querySelectorAll('[aria-label="Game settings"]'))n.addEventListener("click",()=>s&&s(ze));if(!e)return;for(let n of[t.querySelector(".root"),t.querySelector(".gf-bar")])n&&n.addEventListener("click",u=>{let f=E=>u&&u.target&&u.target.closest?u.target.closest(E):null;if(f("[data-settings-back]")){o&&o();return}let w=f("[data-view]");w&&i&&i(w.getAttribute("data-view"))});let p=t.querySelector(".st-pane");if(p&&p.addEventListener("click",n=>{n&&n.target&&n.target.closest&&n.target.closest("[data-token-refresh]")&&i&&i("debug")}),a==="visual"){for(let n of t.querySelectorAll("[data-style-set]"))n.addEventListener("click",()=>{let u=n.getAttribute("data-style-set");for(let f of t.querySelectorAll("[data-style-set]"))f.setAttribute("aria-pressed",String(f===n));c&&c(u)});for(let n of t.querySelectorAll("[data-text-scale]"))n.addEventListener("click",()=>d&&d(n.getAttribute("data-text-scale")))}a==="sources"&&vo(t,{run:r,onSources:h})}function vo(t,{run:e,onSources:a}){let r=at("sources"),s=p=>t.querySelector('[data-input="'+p+'"]'),o=p=>t.querySelector('[data-field="'+p+'"]'),i=Ta(e,"sources"),c=()=>{for(let p of r){let n=o(p.id);n&&(n.hidden=!Se(p,i))}},d=()=>{c(),a&&a(rt(i))},h=kt(t,{initial:i.lore,onChange:p=>{i.lore=p,d()}});i.lore=h.value();for(let p of r){if(p.type==="custom")continue;let n=s(p.id);n&&(p.type==="toggle"?(n.setAttribute("aria-checked",i[p.id]?"true":"false"),n.addEventListener("click",()=>{let u=n.getAttribute("aria-checked")!=="true";n.setAttribute("aria-checked",u?"true":"false"),i[p.id]=u,d()})):(typeof i[p.id]=="string"&&(n.value=i[p.id]),n.addEventListener("change",()=>{i[p.id]=typeof n.value=="string"?n.value.trim():"",d()})))}c(),mo(t,r,i)}var go=new Set(["image_generation","video_generation"]);function mo(t,e,a){let r=i=>e.some(c=>c.optionsFrom===i),s=(i,c,d)=>{let h=t.querySelector('[data-input="'+i+'"]');if(!h)return;h.innerHTML=(d?'<option value="">'+le(d)+"</option>":"")+c.map(n=>'<option value="'+le(n.value)+'">'+le(n.label)+"</option>").join("");let p=a[i];typeof p=="string"&&c.some(n=>n.value===p)?h.value=p:d&&(h.value=""),h.disabled=c.length===0&&!d},o=i=>{let c=e.find(d=>d.optionsFrom===i);return c&&c.emptyOption?c.emptyOption:""};r("connections")&&pe("/api/connections").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{let d=(Array.isArray(i)?i:i&&Array.isArray(i.connections)?i.connections:[]).filter(h=>h&&!go.has(String(h.provider??""))).map(h=>({value:String(h.id),label:String(h.name||h.model||h.id)}));for(let h of e)h.optionsFrom==="connections"&&s(h.id,d,o("connections"))}).catch(()=>{}),(r("imageConnections")||r("imageProfiles"))&&pe("/api/gacha-forge/image-options").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{let c=(i&&Array.isArray(i.connections)?i.connections:[]).map(h=>({value:String(h.id),label:String(h.name||h.model||h.id)})),d=(i&&Array.isArray(i.profiles)?i.profiles:[]).map(h=>({value:String(h.id),label:String(h.name)+" \u2014 "+String(h.promptMode)}));for(let h of e)h.optionsFrom==="imageConnections"&&s(h.id,c,o("imageConnections")),h.optionsFrom==="imageProfiles"&&s(h.id,d,d.length?"":"Engine default")}).catch(()=>{})}var Ca=`

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
.st-plate p { margin: 0; font-size: var(--t-sm); line-height: 1.55; color: var(--steel-faint); max-width: 76ch; }
.st-foot { margin: 0; flex: none; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.08em; line-height: 1.5; color: var(--steel-faint); }
/* What takes the spare height inside a plate; headings and paragraphs do not stretch. */
.st-list { flex: 1 1 auto; min-height: 0; }

/* The house chip. */
.st-chip { cursor: pointer; font-family: var(--display); font-weight: 700; font-size: var(--t-xs); letter-spacing: 0.12em; text-transform: var(--case); padding: calc(var(--f) * 0.6) calc(var(--f) * 1.1); background: var(--ink-3); border: 1px solid transparent; color: var(--steel-faint); font-variant-numeric: tabular-nums; --cut: 0.4em; clip-path: var(--clip-chip); border-radius: var(--radius-sm); }
.st-chip:hover { color: var(--text); border-color: var(--coral); }
.st-chip[aria-pressed="true"] { background: var(--coral); color: var(--on-coral); }
.st-chips { display: flex; gap: calc(var(--f) * 0.4); flex-wrap: wrap; }

/* SLICE: the Continuity styles lived here (meter, threshold chips, chapter rows). */

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
`;function Oe(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var bo=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function yo(t){let e=bo[t];return e?`Chapter ${e}`:`Chapter ${t}`}var Ra=["Reading the scenario\u2026","Forging the chapter\u2026","Writing the story beats\u2026"],St=["Reading the scenario\u2026","Summoning the founding cast\u2026","Naming the heroes\u2026"],Et=`
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
`,wo=`
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
</svg>`,xo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';function ko(){return{label:"Founding Cast",status:St[0],eyebrow:"Summoning the founding cast",brandNote:"&middot; first-time setup",foot:"Summoning this world's founding heroes from your scenario &mdash; the cast the story is built around. This happens once.",errorStatus:"Couldn't summon the founding cast.",errorBody:"The summon returned units that didn't match the expected format. Nothing was saved."}}function _o({done:t=0,total:e=0,name:a=""}={}){let r=Math.min(t+1,Math.max(e,1));return{label:"Founding Cast",status:a?`Painting ${a}\u2026 ${r}/${e}`:`Painting the founding cast\u2026 ${t}/${e}`,eyebrow:"Painting the founding cast",brandNote:"&middot; first-time setup",foot:"Generating each hero's portrait, one at a time, so they have a face when they speak in the story. The first chapter is being forged at the same time.",errorStatus:"Couldn't paint the cast.",errorBody:"No portrait could be generated. Check the world's image connection &mdash; the story is ready either way, and the heroes will show their silhouette until art exists.",retryLabel:"Continue"}}function So(t,e){let a=Number(e)<=1;return{label:t,status:Ra[0],eyebrow:a?"Forging the first chapter":"Forging the next chapter",brandNote:a?"&middot; first-time setup":"&middot; new chapter",foot:a?`Forging ${Oe(t)}'s story beats from your scenario. This happens once &mdash; the story is written before you play it.`:`Forging ${Oe(t)}'s story beats from your scenario &mdash; the story is written before you play it.`,errorStatus:"Couldn't read the forged chapter.",errorBody:"The forge returned a plan that didn't match the expected format. Nothing was saved."}}function Tt({scenario:t,chapter:e=1,error:a=!1,mode:r="chapter",art:s}){let o=t&&t.trim()?t.trim():"Your scenario",i=r==="banner"?ko():r==="art"?_o(s):So(yo(e),e),c=i.label,d=a?i.errorStatus:i.status,h=i.eyebrow,p=i.brandNote,n=i.foot;return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${a?" -error":""}">
    <div class="forge-brand">
      <span class="rhombus" aria-hidden="true"></span>
      <b>Gacha Forge</b><span>${p}</span>
    </div>

    <div class="forge-center">
      ${wo}
      <span class="eyebrow">${h}</span>
      <h2>${Oe(c)}</h2>
      <span class="scenario">${Oe(o)}</span>
      <div class="forge-status" aria-live="polite">${Oe(d)}</div>
      <p class="forge-error"${a?"":" hidden"}>${i.errorBody}</p>
      <button class="forge-retry" type="button"${a?"":" hidden"}>${Oe(i.retryLabel||"Retry")}</button>
    </div>

    <p class="forge-foot">
      ${xo}
      <span>${n}</span>
    </p>
  </div>
</div>`}function At(t,{onRetry:e,cycle:a,phases:r}){let s=t.querySelector(".forge-retry");s&&s.addEventListener("click",()=>e?.());let o=t.querySelector(".forge-status");if(!a||!o)return()=>{};let i=Array.isArray(r)&&r.length?r:Ra,c=0;o.textContent=i[0];let d=setInterval(()=>{c=(c+1)%i.length,o.textContent=i[c]},1100);return()=>clearInterval(d)}var La={blade:()=>'<path d="M150 30 176 150 166 320 150 350 134 320 124 150Z"/><rect x="108" y="300" width="84" height="18"/><rect x="140" y="318" width="20" height="56"/><circle cx="150" cy="384" r="12"/>',edge:()=>'<path d="M150 96c22 44 30 108 21 176l-13 30-8 8-8-8-13-30c-9-68-1-132 21-176Z"/><path d="M104 306h92v18h-92Z"/><rect x="139" y="324" width="22" height="48"/><path d="M150 360 168 380 150 400 132 380Z"/>',bulwark:()=>'<path d="M150 34 254 74c0 130-30 232-104 300C76 306 46 204 46 74Z"/><path d="M150 96v212M92 150h116" stroke="#0E1420" stroke-opacity="0.32" stroke-width="9" fill="none"/>',focus:t=>'<circle cx="150" cy="228" r="74"/><path d="M150 40 172 86 150 132 128 86Z"/><ellipse cx="150" cy="228" rx="122" ry="44" fill="none" stroke="'+t+'" stroke-width="11"/>',tome:()=>'<path d="M132 70h74q18 0 18 18v224q0 18-18 18h-74Z"/><path d="M78 70h36v260H78q-9 0-9-12V82q0-12 9-12Z"/><path d="M224 98h18v204h-18Z"/>'};function Re(t,e){let a="url(#"+e+")",r=La[t]||La.blade;return'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="'+a+'">'+r(a)+"</g></svg>"}var Ba={fire:"water",water:"wind",wind:"earth",earth:"fire",light:"dark",dark:"light"},Eo={fire:"#F2603C",water:"#4A9BD4",wind:"#2EBE9E",earth:"#F0B429",light:"#F5E3A2",dark:"#9B6FD4"},Fa=20,Ia=6,Da=1.5,To=.4,Nt=1.6,Pa=.65,Ge=.15,Ct=1.1,Ha=.25,$a=.15,qa=.1,ja=.6;function J(t){let e=Number(t);return Math.max(.2,Math.min(6,(Number.isFinite(e)?e:100)/100))}function fe(t){return Math.max(qa,Math.min(ja,J(t)*$a))}var Ma=30,Ao=10,Ua=30,De={crit:15,critDmg:150,recharge:100,effectHit:0,effectRes:0,healBonus:0},No=.15,Co=1;var Rt=3,Ga=.4,Va=1,Wa=3,Ya=.35,Xa=35,Ka=.5,Za=1,Ro=30,Lo=3,Lt=1.8,Ja=.05,Qa=2,er=.08,tr=15,ar=.4,rr=12,sr=.3,it=.35,or=.02,ir=.1,nr=.18,lr=.2,cr={ATK_K:Da,ULT_SINGLE:Nt,ULT_AOE:Pa,HEAL_SCALE:Ge,SHIELD_SCALE:Ct,DOT_SCALE:Ha,BUFF_SCALE:$a,BUFF_MIN:qa,BUFF_MAX:ja,FOCUS:Lt,DOT_ROUNDS:Wa,BUFF_ROUNDS:Rt,REVIVE_PCT:Ya,ENERGY_GRANT:Xa,DRAIN_SHARE:Ga,LOW_PCT:it,AURA_REGEN:or,AURA_MITIGATION:ir,AURA_SHIELD:nr,RESIST_MITIGATION:lr,RIDER_BURN:Ja,RIDER_FLOW:er,RIDER_HASTE:tr,RIDER_BULWARK:ar,RIDER_RADIANCE:rr,RIDER_BLIGHT:sr,EXECUTE_BONUS:Va,ENERGY_KILL:Ua,RIDER_BURN_ROUNDS:Qa,CLEANSE_SHARE:Ka,STUN_TURNS:Za};function H(t,e,a){let r=t&&t.fx?Number(t.fx[e]):NaN;return Number.isFinite(r)?r:a}function nt(t){return String(t||"").toLowerCase()}function za(t){return Eo[nt(t)]||"#FFFFFF"}function Pe(t,e){let a=nt(t),r=nt(e);return Ba[a]===r?{mult:1.5,label:"STRONG"}:Ba[r]===a?{mult:.75,label:"WEAK"}:{mult:1,label:""}}function Bo(t){let e=t>>>0;return function(){e|=0,e=e+1831565813|0;let a=Math.imul(e^e>>>15,1|e);return a=a+Math.imul(a^a>>>7,61|a)^a,((a^a>>>14)>>>0)/4294967296}}function dr(t){let e=2166136261,a=String(t||"seed");for(let r=0;r<a.length;r+=1)e^=a.charCodeAt(r),e=Math.imul(e,16777619);return e>>>0}function He(t,e){let a=Number(t);return Number.isFinite(a)?a:e}function Oa(t,e,a){let r=t&&t.stats||{},s=Number(t&&t.power)>0?Number(t.power):1,o=(Number(r.hp)||50)*s,i=(Number(r.atk)||50)*s,c=(Number(r.def)||50)*s,d=Number(r.spd)||50;return{id:t.id||`${e}-${a}`,name:t.name||(e==="ally"?"Hero":"Foe"),side:e,role:t.role||"Warrior",aff:nt(t.affinity),position:t.position==="back"?"back":"front",hpMax:Fa+o*Ia,hp:Fa+o*Ia,atk:i,def:c,spd:d,energy:0,shield:0,atkMod:1,defMod:1,modRounds:0,burn:0,burnRounds:0,dmgReduction:0,roundShield:0,stunTurns:0,fx:t&&t.facets||null,regen:0,skill:t&&t.skill||null,passive:t&&t.passive||null,granted:t&&t.granted||null,grantedCd:0,grantedArmed:!1,crit:He(r.crit,De.crit),critDmg:He(r.critDmg,De.critDmg),recharge:He(r.recharge,De.recharge),effectHit:He(r.effectHit,De.effectHit),effectRes:He(r.effectRes,De.effectRes),healBonus:He(r.healBonus,De.healBonus),alive:!0}}function hr({allies:t=[],enemies:e=[],seed:a=1}={}){let r=Bo(a>>>0||1),s=t.map((l,v)=>Oa(l,"ally",v)),o=e.map((l,v)=>Oa(l,"enemy",v)),i=s.concat(o),c=new Map(i.map(l=>[l.id,l])),d=[],h=l=>l.side==="ally"?s:o,p=l=>l.side==="ally"?o:s,n=l=>l.filter(v=>v.alive),u=l=>Math.max(0,Math.round(l.hp/l.hpMax*100)),f=l=>({hp:Math.max(0,Math.round(l.hp)),hpMax:Math.round(l.hpMax)});function w(l,v){d.push({d:l,events:v.filter(Boolean)})}function E(l){return{op:"hp",id:l.id,pct:u(l),...f(l)}}function A(l){return{op:"energy",id:l.id,pct:Math.round(l.energy)}}function _(l,v){return l.alive?(l.energy=Math.min(100,l.energy+v*(l.recharge/100)),A(l)):null}function T(l,v,y){let k=Math.max(1,Math.round(v));if(l.shield>0){let $=Math.min(l.shield,k);l.shield-=$,k-=$}return k=Math.round(k*(1-(l.dmgReduction||0))),k=Math.max(1,k),l.hp=Math.max(0,l.hp-k),l.hp<=0&&l.alive&&(l.alive=!1),k}function R(l,v){let y=Math.max(No,Math.min(Co,1+(l.effectHit-v.effectRes)/100));return y>=1||r()<y}function I(l){let v=n(p(l));if(!v.length)return null;let y=v.filter($=>$.position==="front"),k=y.length?y:v;return k.reduce(($,B)=>B.hp<$.hp?B:$,k[0])}let G=new Set(["damage","aoe_damage","debuff","drain","execute","dot","stun"]);function M(l){let v=n(h(l));return v.length?v.reduce((y,k)=>k.hp/k.hpMax<y.hp/y.hpMax?k:y,v[0]):null}function j(l,v,y){let k=G.has(v),$=n(k?p(l):h(l));if(!$.length)return[];let B=D=>{let q=$.filter(re=>re.position===D);return q.length?q:$},P;switch(y){case"self":P=k?[I(l)]:[l];break;case"ally":case"enemy":P=k?[I(l)]:[M(l)];break;case"allies":case"all_enemies":P=$;break;case"front_row":P=B("front");break;case"back_row":P=B("back");break;default:P=k?[I(l)]:$;break}return P=P.filter(Boolean),v==="aoe_damage"&&P.length<=1&&(P=$),P}let O=l=>l<=1?Lt:1,V=2;function Q(l,v){return v.effect==="debuff"?n(p(l)):v.target==="self"?[l]:n(h(l))}function X(l,v,y,k){let $=Number(k)||1,B=Number(v.power)||20,P=Q(l,v);if(P.length){if(v.effect==="buff"){for(let D of P)D.atkMod+=fe(B)*$,D.modRounds=Math.max(D.modRounds,V);y.push({op:"buff",id:l.id,text:"ATK \u25B2"})}else if(v.effect==="debuff"){for(let D of P)D.defMod=Math.max(.5,D.defMod-fe(B)*$),D.modRounds=Math.max(D.modRounds,V);y.push({op:"debuff",id:l.id,text:"DEF \u25BC"})}else if(v.effect==="shield"){let D=Math.round(l.def*Ct*.5*J(B)*$);for(let q of P)q.shield+=D;y.push({op:"shieldFx",ids:P.map(q=>q.id)})}else if(v.effect==="heal"){let D=Math.round(l.hpMax*Ge*.5*J(B)*$);for(let q of P)q.hp=Math.min(q.hpMax,q.hp+D),y.push({op:"heal",id:q.id,amount:D,hpPct:u(q),...f(q)})}else if(v.effect==="damage"||v.effect==="aoe_damage"){let D=v.effect==="aoe_damage"?n(p(l)):[I(l)].filter(Boolean);for(let q of D){let re=Pe(l.aff,q.aff),je=T(q,l.atk*Nt*.4*J(B)*$*re.mult,y);y.push({op:"hit",id:q.id,amount:je,effLabel:re.label,crit:!1,hpPct:u(q),...f(q)}),q.alive||(y.push({op:"death",id:q.id}),g(q,y),b(l,y))}}}}function he(){let l=[{op:"start"}];for(let v of i)l.push(E(v),A(v));for(let v of i){let y=v.passive;if(!(!y||!v.alive))if(y.trigger==="battle_start"||y.trigger==="self")X(v,y,l,H(v,"passiveScale",1));else if(y.trigger==="aura")for(let k of h(v))y.effect==="buff"?k.dmgReduction=Math.max(k.dmgReduction,H(v,"auraMitigation",ir)):y.effect==="heal"?k.regen=Math.max(k.regen,Math.round(v.hpMax*H(v,"auraRegen",or)*J(y.power))):y.effect==="shield"&&(k.roundShield=Math.max(k.roundShield||0,Math.round(v.def*H(v,"auraShield",nr)*J(y.power))));else y.trigger==="resist"&&(v.dmgReduction=Math.max(v.dmgReduction,H(v,"resistMitigation",lr)),l.push({op:"buff",id:v.id,text:"RESIST"}))}return l}function ue(l,v){let y=l.passive;!y||!l.alive||y.trigger!=="on_attack"||X(l,y,v,H(l,"onAttackScale",.5))}function ie(l,v,y){let k=l.passive;k&&l.alive&&k.trigger==="on_hit"&&X(l,k,y,H(l,"onHitScale",.5)),x(l,y),ne(l,y)}let ee=new Map,te=(l,v)=>Number(l.get(v))||0;function ne(l,v){for(let y of n(h(l))){let k=y.passive;!k||k.trigger!=="on_ally_low"||te(ee,y.id)>=H(y,"lowFires",1)||l.hp/l.hpMax>it||(ee.set(y.id,te(ee,y.id)+1),X(y,k,v,1.2))}}function ve(l){let v=l.passive;if(!v||!l.alive||v.trigger!=="on_round")return;let y=[];X(l,v,y,H(l,"onRoundScale",it)),y.length&&w(260,y)}let Z=new Map;function x(l,v){let y=l.passive;!y||!l.alive||y.trigger!=="on_low"||te(Z,l.id)>=H(l,"lowFires",1)||l.hp/l.hpMax>it||(Z.set(l.id,te(Z,l.id)+1),X(l,y,v,1.2))}function g(l,v){let y=l.passive;!y||y.trigger!=="on_death"||X(l,y,v,H(l,"onDeathScale",1.4))}function m(l,v){let y=l.passive;!y||!l.alive||y.trigger!=="on_ult"||X(l,y,v,H(l,"onUltScale",.7))}function b(l,v){if(!l.passive||!l.alive||l.passive.trigger!=="on_kill")return;let y=_(l,H(l,"energyKill",Ua));y&&v.push(y),X(l,l.passive,v,.6)}function S(l,v){l.modRounds>0&&(l.modRounds-=1,l.modRounds===0&&(l.atkMod=1,l.defMod=1)),l.roundShield>0&&l.alive&&(l.shield+=l.roundShield,v.push({op:"shieldFx",ids:[l.id]})),l.burnRounds>0&&l.alive&&(l.burnRounds-=1,T(l,l.burn,v),v.push({op:"hit",id:l.id,amount:l.burn,effLabel:"",crit:!1,hpPct:u(l),...f(l)}),l.alive||v.push({op:"death",id:l.id})),l.regen>0&&l.alive&&l.hp<l.hpMax&&(l.hp=Math.min(l.hpMax,l.hp+l.regen))}function N(l,v,y,k){let $=H(l,"riderExtra",1);switch(l.aff){case"fire":for(let B of v)B.alive&&(B.burn=Math.round(B.hpMax*H(l,"riderBurn",Ja)*$),B.burnRounds=H(l,"riderBurnRounds",Qa));break;case"water":{let B=n(h(l));if(B.length){let P=B.reduce((q,re)=>re.hp/re.hpMax<q.hp/q.hpMax?re:q,B[0]),D=Math.round(l.hpMax*H(l,"riderFlow",er)*$);P.hp=Math.min(P.hpMax,P.hp+D),k.push({op:"heal",id:P.id,amount:D,hpPct:u(P),...f(P)})}break}case"wind":for(let B of n(h(l))){let P=_(B,H(l,"riderHaste",tr)*$);P&&k.push(P)}break;case"earth":for(let B of n(h(l)).filter(P=>P.position==="front"))B.shield+=Math.round(l.def*H(l,"riderBulwark",ar)*$);k.push({op:"shieldFx",ids:n(h(l)).filter(B=>B.position==="front").map(B=>B.id)});break;case"light":for(let B of n(h(l))){B.defMod=Math.min(1,B.defMod),H(l,"riderRadianceFull",0)&&B.atkMod<1&&(B.atkMod=1);let P=_(B,H(l,"riderRadiance",rr)*$);P&&k.push(P)}break;case"dark":{let B=Math.round(y*H(l,"riderBlight",sr)*$);B>0&&l.alive&&(l.hp=Math.min(l.hpMax,l.hp+B),k.push({op:"heal",id:l.id,amount:B,hpPct:u(l),...f(l)}));break}default:break}}function U(l){let v=I(l);if(!v)return;let y=[{op:"act",id:l.id}];ue(l,y);let k=Pe(l.aff,v.aff),$=r()<l.crit/100,B=(l.atk*l.atkMod*Da-v.def*v.defMod*To)*k.mult*($?l.critDmg/100:1),P=T(v,B,y);y.push({op:"hit",id:v.id,amount:P,effLabel:k.label,crit:$,hpPct:u(v),...f(v)}),H(l,"riderOnAttack",0)&&l.alive&&N(l,v.alive?[v]:[],P,y),v.alive?ie(v,l,y):(y.push({op:"death",id:v.id}),g(v,y),b(l,y));let D=_(l,Ma);D&&y.push(D);let q=_(v,Ao);q&&v.alive&&y.push(q),w(520,y)}function Ee(l,v,y){let k=[{op:"ult",id:l.id,name:v.name||"Ultimate",sub:`${l.name} \xB7 ${l.role} \xB7 ${v.effect}`,weapon:!!y}];y||m(l,k);let $=0,B=v.effect,P=!y&&l.fx&&l.fx.reach?l.fx.reach:v.target,D=j(l,B,P),q=D.length>1,re=!y&&H(l,"keepFocus",0)?Lt:O(D.length),je=H(l,"ultSingle",Nt),Jt=H(l,"ultAoe",Pa);if(B==="damage"||B==="aoe_damage"){q&&k.push({op:"aoe",side:l.side==="ally"?"enemies":"allies",color:za(l.aff)});let L=(q?Jt:je)*J(v.power);for(let C of D){let Y=Pe(l.aff,C.aff),me=!q&&r()<l.crit/100,Ae=l.atk*l.atkMod*L*Y.mult*(me?l.critDmg/100:1),Qt=T(C,Ae,k);$+=Qt,k.push({op:"hit",id:C.id,amount:Qt,effLabel:Y.label,crit:me,hpPct:u(C),...f(C)}),C.alive||(k.push({op:"death",id:C.id}),g(C,k),b(l,k))}}else if(B==="heal"){let L=Math.round(l.hpMax*H(l,"healScale",Ge)*J(v.power)*re*(1+l.healBonus/100));for(let C of D)C.hp=Math.min(C.hpMax,C.hp+L),k.push({op:"heal",id:C.id,amount:L,hpPct:u(C),...f(C)})}else if(B==="shield"){let L=Math.round(l.def*H(l,"shieldScale",Ct)*J(v.power)*re);for(let C of D)C.shield+=L;k.push({op:"shieldFx",ids:D.map(C=>C.id)}),k.push({op:"buff",id:l.id,text:"SHIELD"})}else if(B==="buff"){for(let L of D)L.atkMod+=fe(v.power)*re,L.modRounds=Math.max(L.modRounds,H(l,"buffRounds",Rt));k.push({op:"buff",id:l.id,text:"ATK \u25B2"})}else if(B==="debuff")for(let L of D){if(!R(l,L)){k.push({op:"debuff",id:L.id,text:"RESIST"});continue}L.defMod=Math.max(.5,L.defMod-fe(v.power)*re),L.modRounds=Math.max(L.modRounds,H(l,"buffRounds",Rt)),k.push({op:"debuff",id:L.id,text:"DEF \u25BC"})}else if(B==="drain"){let L=(q?Jt:je)*J(v.power);q&&k.push({op:"aoe",side:l.side==="ally"?"enemies":"allies",color:za(l.aff)});for(let Y of D){let me=Pe(l.aff,Y.aff),Ae=T(Y,l.atk*l.atkMod*L*me.mult,k);$+=Ae,k.push({op:"hit",id:Y.id,amount:Ae,effLabel:me.label,crit:!1,hpPct:u(Y),...f(Y)}),Y.alive||(k.push({op:"death",id:Y.id}),g(Y,k),b(l,k))}let C=Math.round($*H(l,"drainShare",Ga));C>0&&l.alive&&(l.hp=Math.min(l.hpMax,l.hp+C),k.push({op:"heal",id:l.id,amount:C,hpPct:u(l),...f(l)}))}else if(B==="execute")for(let L of D){let C=Pe(l.aff,L.aff),Y=1-L.hp/L.hpMax,me=1+Y*H(l,"executeBonus",Va),Ae=T(L,l.atk*l.atkMod*je*J(v.power)*C.mult*me,k);$+=Ae,k.push({op:"hit",id:L.id,amount:Ae,effLabel:C.label,crit:Y>.5,hpPct:u(L),...f(L)}),L.alive||(k.push({op:"death",id:L.id}),g(L,k),b(l,k))}else if(B==="dot")for(let L of D){if(!R(l,L)){k.push({op:"debuff",id:L.id,text:"RESIST"});continue}L.burn=Math.max(L.burn,Math.round(l.atk*l.atkMod*Ha*J(v.power)*Pe(l.aff,L.aff).mult)),L.burnRounds=Math.max(L.burnRounds,H(l,"dotRounds",Wa)),k.push({op:"debuff",id:L.id,text:"DOT"})}else if(B==="stun")for(let L of D){if(!R(l,L)){k.push({op:"debuff",id:L.id,text:"RESIST"});continue}L.stunTurns=Math.max(L.stunTurns,H(l,"stunTurns",Za)),k.push({op:"stun",id:L.id})}else if(B==="cleanse"){let L=Math.round(l.hpMax*Ge*H(l,"cleanseShare",Ka)*J(v.power)*re);for(let C of D)C.burn=0,C.burnRounds=0,C.stunTurns=0,C.atkMod<1&&(C.atkMod=1),C.defMod<1&&(C.defMod=1),C.hp=Math.min(C.hpMax,C.hp+L),k.push({op:"heal",id:C.id,amount:L,hpPct:u(C),...f(C)});k.push({op:"buff",id:l.id,text:"CLEANSE"})}else if(B==="revive"){let L=h(l).filter(C=>!C.alive);if(L.length){let C=L.reduce((Y,me)=>me.hpMax>Y.hpMax?me:Y,L[0]);C.alive=!0,C.hp=Math.round(C.hpMax*H(l,"revivePct",Ya)),C.energy=0,k.push({op:"revive",id:C.id}),k.push({op:"heal",id:C.id,amount:C.hp,hpPct:u(C),...f(C)})}else for(let C of n(h(l))){let Y=Math.round(l.hpMax*Ge*.4*J(v.power));C.hp=Math.min(C.hpMax,C.hp+Y),k.push({op:"heal",id:C.id,amount:Y,hpPct:u(C),...f(C)})}}else if(B==="energy"){let L=Math.round(H(l,"energyGrant",Xa)*re);for(let C of D){let Y=_(C,L);Y&&k.push(Y)}k.push({op:"buff",id:l.id,text:"CHARGE"})}if(N(l,G.has(B)?D:[],$,k),!y)l.energy=0,k.push(A(l)),l.granted&&l.granted.trigger==="energy"&&(l.grantedArmed=!0);else{let L=_(l,Ma);L&&k.push(L),l.granted&&l.granted.trigger!=="energy"?l.grantedCd=Lo:l.grantedArmed=!1}w(950,k)}function Le(l){Ee(l,l.skill||{effect:"damage",power:60,target:"enemy",name:"Strike"},!1)}function K(l){return!l.granted||!l.granted.effect?!1:l.granted.trigger==="energy"?l.grantedArmed:l.grantedCd<=0}function Te(l){return n(l).length===0}w(700,he());let Zt=0,xe=null;for(;Zt<Ro;){Zt+=1;let l=n(i).slice().sort((v,y)=>y.spd-v.spd||(v.id<y.id?-1:1));for(let v of l){if(!v.alive)continue;let y=[];if(S(v,y),y.length&&w(220,y),!!v.alive){if(Te(o)){xe="win";break}if(Te(s)){xe="lose";break}if(v.stunTurns>0){v.stunTurns-=1,w(300,[{op:"stun",id:v.id}]);continue}if(ve(v),!!v.alive){if(v.grantedCd>0&&(v.grantedCd-=1),v.energy>=100?Le(v):K(v)?Ee(v,v.granted,!0):U(v),Te(o)){xe="win";break}if(Te(s)){xe="lose";break}}}}if(xe)break}if(!xe){let l=v=>v.reduce((y,k)=>y+Math.max(0,k.hp)/k.hpMax,0)/(v.length||1);xe=l(s)>l(o)?"win":"lose"}return w(800,[{op:"end",result:xe}]),{result:xe,steps:d}}var F=cr;function z(t){return Math.round(Number(t)*1e3)/10+"%"}var pr=new Set(["enemy","ally","self"]),Fo=["damage","aoe_damage","debuff","drain","execute","dot","stun"];function Io(t,e){let a=Fo.includes(t);if(t==="aoe_damage"&&pr.has(e))return"every enemy";switch(e){case"self":return a?"the weakest front-line enemy":"itself";case"enemy":return"the weakest front-line enemy";case"ally":return"the ally who needs it most";case"allies":return"the whole team";case"all_enemies":return"every enemy";case"front_row":return a?"the enemy front line":"your front line";case"back_row":return a?"the enemy BACK line \u2014 past the front":"your back line";default:return a?"the weakest front-line enemy":"the whole team"}}function Bt(t){return!pr.has(t.target)||t.effect==="aoe_damage"}var Mo={fire:"<b>Fire</b> also burns what it hits for <b>"+z(F.RIDER_BURN)+" of that target's max HP</b> per round, for 2 rounds.",water:"<b>Water</b> also heals your most hurt ally for <b>"+z(F.RIDER_FLOW)+" of the caster's own max HP</b>.",wind:"<b>Wind</b> also gives every teammate <b>+"+F.RIDER_HASTE+" energy</b> (a full bar is 100).",earth:"<b>Earth</b> also shields your front line for <b>"+z(F.RIDER_BULWARK)+" of the caster's DEF</b> each.",light:"<b>Light</b> also clears one DEF debuff from the team and gives everyone <b>+"+F.RIDER_RADIANCE+" energy</b>.",dark:"<b>Dark</b> also returns <b>"+z(F.RIDER_BLIGHT)+" of the damage dealt</b> to the caster as health."};function fr(t){return Mo[String(t||"").toLowerCase()]||""}function ur(t){if(!t||!t.effect)return"";let e=J(t.power),a=Io(t.effect,t.target),r=Bt(t),s=r?1:F.FOCUS;switch(t.effect){case"damage":case"drain":{let o=(r?F.ULT_AOE:F.ULT_SINGLE)*e,i=t.effect==="drain"?" Heals the caster for "+z(F.DRAIN_SHARE)+" of what it deals.":"";return"Hits "+a+" for <b>"+z(o)+" of ATK</b>"+(r?" each":"")+"."+i}case"aoe_damage":return"Sweeps "+a+" for <b>"+z(F.ULT_AOE*e)+" of ATK</b> each.";case"execute":return"Hits "+a+" for <b>"+z(F.ULT_SINGLE*e)+" of ATK</b>, up to <b>"+z(F.ULT_SINGLE*e*2)+"</b> against a target that is nearly down.";case"dot":return"Poisons "+a+" for <b>"+z(F.DOT_SCALE*e)+" of ATK</b> per round, for "+F.DOT_ROUNDS+" rounds. Ignores shields.";case"stun":return"Makes "+a+" lose its next turn.";case"heal":return"Heals "+a+" for <b>"+z(F.HEAL_SCALE*e*s)+" of the caster's own max HP</b>.";case"shield":return"Shields "+a+" for <b>"+z(F.SHIELD_SCALE*e*s)+" of the caster's DEF</b>.";case"cleanse":return"Clears poison, stuns and debuffs from "+a+", and heals <b>"+z(F.HEAL_SCALE*.5*e*s)+" of the caster's max HP</b>.";case"revive":return"Brings one fallen ally back at <b>"+z(F.REVIVE_PCT)+"</b> health.";case"energy":return"Fills "+a+"'s ultimate bar by <b>"+Math.round(F.ENERGY_GRANT*s)+"</b> points.";case"buff":return"Raises "+a+"'s ATK by <b>"+z(fe(t.power)*s)+"</b> for "+F.BUFF_ROUNDS+" rounds.";case"debuff":return"Drops "+a+"'s DEF by <b>"+z(fe(t.power)*s)+"</b> for "+F.BUFF_ROUNDS+" rounds.";default:return""}}function vr(t){return!t||!["damage","drain","execute"].includes(t.effect)?"":((Bt(t)?F.ULT_AOE:F.ULT_SINGLE)*J(t.power)/F.ATK_K).toFixed(1)+"&times; a normal hit"}var zo={battle_start:"As the fight opens",self:"As the fight opens",aura:"For the whole fight",on_hit:"Each time this unit is struck",on_attack:"Each time this unit swings",on_kill:"Each time this unit finishes someone",on_ally_low:"The first time an ally drops below <b>"+z(F.LOW_PCT)+" health</b> (once per battle)",on_low:"The first time this unit drops below <b>"+z(F.LOW_PCT)+" health</b> (once per battle)",resist:"For the whole fight",on_round:"On every one of this unit's turns",on_ult:"When this unit casts its Ultimate",on_death:"When this unit falls",cooldown:"Every few rounds",energy:"When the energy bar fills"};function gr(t){if(!t||!t.trigger)return"";let e=zo[t.trigger]||"Sometimes",a=t.target==="self"?"itself":t.effect==="debuff"?"every enemy":"the whole team",r=J(t.power),s;t.trigger==="resist"?s="it takes <b>"+z(F.RESIST_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="buff"?s="the whole team takes <b>"+z(F.AURA_MITIGATION)+" less damage</b>":t.trigger==="aura"&&t.effect==="heal"?s="every ally regenerates <b>"+z(F.AURA_REGEN*r)+" of THIS unit's max HP</b> at the start of each of their turns":t.trigger==="aura"&&t.effect==="shield"?s="every ally gets a fresh shield worth <b>"+z(F.AURA_SHIELD*r)+" of its DEF</b> at the start of each of their turns":t.effect==="buff"?s="it raises "+a+"'s ATK by <b>"+z(fe(t.power))+"</b>":t.effect==="debuff"?s="it drops "+a+"'s DEF by <b>"+z(fe(t.power))+"</b>":t.effect==="shield"?s="it shields "+a+" for <b>"+z(F.SHIELD_SCALE*.5*r)+" of its DEF</b>":t.effect==="heal"?s="it heals "+a+" for <b>"+z(F.HEAL_SCALE*.5*r)+" of its max HP</b>":s="it strikes back";let o=t.trigger==="on_kill"?" It also gains energy.":"";return e+", "+s+"."+o}function mr(t,e){if(!t||!(Number(t.power)>0))return null;let a=J(t.power),r=Bt(t),s=r?1:F.FOCUS;if(e)return t.trigger==="resist"?{value:z(F.RESIST_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="buff"?{value:z(F.AURA_MITIGATION),stat:"less damage"}:t.trigger==="aura"&&t.effect==="heal"?{value:"",stat:"Regen"}:t.trigger==="aura"&&t.effect==="shield"?{value:"",stat:"Shield each round"}:t.effect==="buff"?{value:z(fe(t.power)),stat:"ATK up"}:t.effect==="debuff"?{value:z(fe(t.power)),stat:"DEF down"}:t.effect==="shield"?{value:z(F.SHIELD_SCALE*.5*a),stat:"of DEF"}:t.effect==="heal"?{value:z(F.HEAL_SCALE*.5*a),stat:"of max HP"}:null;switch(t.effect){case"damage":case"drain":return{value:z((r?F.ULT_AOE:F.ULT_SINGLE)*a),stat:"ATK"};case"aoe_damage":return{value:z(F.ULT_AOE*a),stat:"ATK"};case"execute":return{value:z(F.ULT_SINGLE*a),stat:"ATK"};case"dot":return{value:z(F.DOT_SCALE*a),stat:"ATK per round"};case"heal":return{value:z(F.HEAL_SCALE*a*s),stat:"of max HP"};case"shield":return{value:z(F.SHIELD_SCALE*a*s),stat:"of DEF"};case"buff":return{value:z(fe(t.power)*s),stat:"ATK up"};case"debuff":return{value:z(fe(t.power)*s),stat:"DEF down"};case"energy":return{value:String(Math.round(F.ENERGY_GRANT*s)),stat:"energy"};case"revive":return{value:z(F.REVIVE_PCT),stat:"health"};default:return null}}function W(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function br(t){return t===5?"\u2605\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605\u2605"}function yr(t){return t===5?"r5":"r4"}function Ve(t){return String(t||"").split(",")[0].trim()}var Oo={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>'},Do={character:'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="150" cy="92" r="44"/><path d="M150 144c-48 0-82 32-90 78l-12 178h204l-12-178c-8-46-42-78-90-78Z"/></g><path d="M150 50c0 0 28 15 28 45s-28 45-28 45-28-15-28-45 28-45 28-45Z" fill="none" stroke="#F2603C" stroke-opacity="0.4" stroke-width="2"/></svg>'};function oe(t){return(Number(t)||0).toLocaleString("en-US")}var Po='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Ho='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h11a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',$o='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',qo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 16.4 8.4 11.6l4 4 3.2-3.2 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="8" r="1.6" stroke="currentColor" stroke-width="1.6"/></svg>',jo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3 21 3 21 10 9 22 3 22 3 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.5 9.5 8 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Ft='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',It=`
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
.u-stars { position: absolute; top: calc(var(--f) * 0.3); left: calc(var(--f) * 0.4); font-size: calc(var(--f) * 0.85 * var(--gf-type-scale, 1)); letter-spacing: 0.5px; line-height: 1; z-index: 1; }
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
.u-you { position: absolute; top: 0; left: 0; z-index: 2; font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.72 * var(--gf-type-scale, 1)); letter-spacing: 0.14em; text-transform: var(--case); background: var(--coral); color: var(--on-coral); padding: 0 calc(var(--f) * 0.5); }
.u-lvl { position: absolute; bottom: calc(var(--f) * 0.3); left: calc(var(--f) * 0.4); font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.82 * var(--gf-type-scale, 1)); letter-spacing: 0.06em; color: var(--text); background: color-mix(in srgb, var(--ink) 62%, transparent); padding: 0 calc(var(--f) * 0.4); }
.u-meta { padding: calc(var(--f) * 0.4) calc(var(--f) * 0.55) calc(var(--f) * 0.5); }
.u-name { font-family: var(--display); font-stretch: var(--stretch); font-weight: 700; font-size: calc(var(--f) * 0.95 * var(--gf-type-scale, 1)); line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.u-role { font-family: var(--display); font-size: calc(var(--f) * 0.75 * var(--gf-type-scale, 1)); letter-spacing: 0.1em; text-transform: var(--case); color: var(--steel); }
.u.r5 { border-top-color: var(--amber); } .u.r5 .u-stars { color: var(--amber); text-shadow: 0 0 6px color-mix(in srgb, var(--amber) 60%, transparent); } .u.r5 .u-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--amber) 30%, #26364E) 0%, #141D2B 70%); color: color-mix(in srgb, var(--amber) 55%, #C7D3E2); }
.u.r4 { border-top-color: var(--epic); } .u.r4 .u-stars { color: var(--epic); text-shadow: 0 0 6px color-mix(in srgb, var(--epic) 55%, transparent); } .u.r4 .u-art { background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--epic) 26%, #26364E) 0%, #141D2B 72%); color: color-mix(in srgb, var(--epic) 50%, #C7D3E2); }
.u .bond-pip { position: absolute; bottom: calc(var(--f) * 0.3); right: calc(var(--f) * 0.4); font-family: var(--display); font-weight: 700; font-size: calc(var(--f) * 0.78 * var(--gf-type-scale, 1)); letter-spacing: 0.04em; color: var(--coral); background: color-mix(in srgb, var(--ink) 62%, transparent); padding: 0 calc(var(--f) * 0.35); }

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

/* SLICE: the Form, Gear (rack + picker + feed) and Facets styles lived here -- the
   progression that ships in later PRs. Growth and Ascension stay: this package spends. */
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

/* The blocked tabs and the disabled party button, in the vocabulary the dock uses. */
.cp-tabs button[disabled] { cursor: default; color: var(--steel-dark); }
.cp-tabs button[disabled] .soon { margin-left: calc(var(--f) * 0.4); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-dark); }
.cp-party[disabled] { cursor: default; background: var(--ink-2); border-color: var(--ink-3); color: var(--steel-faint); }


@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;function Uo(t,e){let a=typeof t=="string"?t.trim():"";return a?'<img class="u-photo" src="'+W(a)+'" alt="" loading="lazy">':e}function Go(t){let e=t.kind!=="weapon",a=e?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+Ve(t.dedicatedTo):"");return'<button class="'+("u "+yr(t.rarity)+(t.isProtagonist?" you":""))+'" type="button" data-unit="'+W(t.id)+'">'+(t.isProtagonist?'<span class="u-you">You</span>':"")+'<div class="u-art'+(e?"":" wpn")+'">'+Uo(t.portrait,"")+'<span class="u-stars">'+br(t.rarity)+"</span>"+(t.portrait?"":e?Oo.character:Re(t.weaponType,"gf-sil"))+'<span class="u-lvl">Lv '+(Number(t.level)||1)+"</span>"+(e?'<span class="bond-pip">&#9829;'+(Number(t.bond)||0)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+W(t.name)+'</div><div class="u-role">'+W(a)+"</div></div></button>"}var Vo='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>',Wo='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';function Yo(t,e){let a=String(e||"").trim().toLowerCase();return!a||String(t.name||"").toLowerCase().includes(a)?!0:(t.kind==="weapon"?[t.weaponType]:[t.role,t.affinity]).some(s=>String(s||"").toLowerCase()===a)}function dt(t,e,a,r){let s=e!=="wpn";return(t||[]).filter(o=>o.kind!=="weapon"===s).filter(o=>a==="all"||String(o.rarity)===a).filter(o=>Yo(o,r))}function wr(t,e,a){return a==="loading"?'<div class="grid-empty">Loading units&hellip;</div>':a==="error"?'<div class="grid-empty">Couldn&rsquo;t load your units.</div>':t.length?t.map(Go).join(""):'<div class="grid-empty">No '+(e?"characters":"weapons")+" here yet.</div>"}function Xo(t,e,a){let r=!!String(t||"").trim();return'<div class="u-search'+(r?" on":"")+'"><span class="ic">'+Vo+'</span><input type="search" data-unit-search placeholder="Search by name, role or affinity" value="'+W(t||"")+'">'+(r?'<button class="clr" type="button" data-unit-search-clear aria-label="Clear search">'+Wo+"</button>":"")+'<span class="ct" data-unit-search-count>'+(r?e+" / "+a:a)+"</span></div>"}function xr(t,{cards:e=[],cat:a="char",rarity:r="all",q:s="",state:o="ready"}={}){if(!t||typeof t.querySelector!="function")return!1;let i=t.querySelector("[data-grid]");if(!i)return!1;let c=a!=="wpn",d=dt(e,a,r,s);i.innerHTML=wr(d,c,o);let h=t.querySelector(".u-search");h&&typeof h.setAttribute=="function"&&(String(s||"").trim()?h.setAttribute("data-on","1"):h.removeAttribute("data-on"));let p=t.querySelector("[data-unit-search-count]");if(p){let n=dt(e,a,r,"").length;p.textContent=String(s||"").trim()?d.length+" / "+n:String(n)}return!0}function kr({cards:t=[],cat:e="char",rarity:a="all",state:r="ready",q:s=""}={}){let o=e!=="wpn",i=dt(t,e,a,s),c=dt(t,e,a,"").length,d=p=>p?' aria-pressed="true"':' aria-pressed="false"',h=wr(i,o,r);return`
<div class="root">
  ${Ft}
  <div class="stage"></div>
  <section class="screen" data-screen="roster">
    <div class="head">
      <button class="back" type="button" data-roster-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Command</div><h2>Units</h2></div>
    </div>
    <div class="roster-body gf-swap">
      <div class="toolbar">
        <div class="cats">
          <button type="button" data-cat="char"${d(o)}>${$o}Characters</button>
          <button type="button" data-cat="wpn"${d(!o)}>${jo}Weapons</button>
        </div>
        ${Xo(s,i.length,c)}
        <div class="filters">
          <span class="lbl">Rarity</span>
          ${tt.map(p=>`<button class="chip${p.tone?" "+p.tone:""}" type="button" data-rar="${p.id}"${d(a===p.id)}>${p.label}</button>`).join("")}
        </div>
      </div>
      <div class="grid-scroll"><div class="grid" data-grid>${h}</div></div>
    </div>
  </section>
</div>`}function $e(t,e,a,r){let s=Math.min(100,Math.max(0,Number(e)||0)),o=a===void 0?Number(e)||0:Number(a)||0,i=Number(r)>0?" <em>+"+oe(Math.round(Number(r)))+"</em>":"";return'<div class="stat"><span class="k">'+t+'</span><div class="bar"><i style="width:'+s+'%"></i></div><span class="v">'+oe(o)+i+"</span></div>"}var Ko=[["crit","Crit rate",15,"%"],["critDmg","Crit DMG",150,"%"],["recharge","Energy rech.",100,"%"],["effectHit","Effect hit",0,"%"],["effectRes","Effect RES",0,"%"],["healBonus","Healing",0,"%"]];function Zo(t,e){let a=e||{};return Ko.map(([r,s,o,i])=>{let c=Number(t[r]),d=Number.isFinite(c),h=d?c:o,p=Number(a[r])||0;return'<div class="stat sec2'+(d?" own":"")+'"><span class="k">'+s+'</span><span class="v">'+Math.round((h+p)*10)/10+i+(p>0?" <em>+"+Math.round(p*10)/10+i+"</em>":"")+"</span></div>"}).join("")}var Jo={damage:"Damage",aoe_damage:"AoE damage",heal:"Heal",shield:"Shield",buff:"Buff",debuff:"Debuff"},Qo={enemy:"Enemy",all_enemies:"All enemies",ally:"Ally",allies:"Allies",self:"Self",front_row:"Front row",back_row:"Back row"},ei={front:"Front-line role",back:"Back-line role"};function ct(t){return String(t||"").replace(/_/g," ").replace(/^\w/,e=>e.toUpperCase())}function ti(t,e,a,r){let s=[];a&&t.trigger&&s.push('<span class="m trig">'+W(ct(t.trigger))+"</span>"),t.effect&&s.push('<span class="m">'+W(Jo[t.effect]||ct(t.effect))+"</span>");let o=mr(t,!!r);return o&&s.push('<span class="m">'+(o.value?o.value+" ":"")+"<b>"+o.stat+"</b></span>"),t.target&&s.push('<span class="m">'+W(Qo[t.target]||ct(t.target))+"</span>"),e&&s.push('<span class="m aff">'+W(e)+"</span>"),s.length?'<div class="mech">'+s.join("")+"</div>":""}function lt(t,e,a,r,s){if(!e||!e.name)return"";let o=s?gr(e):ur(e),i=s?"":vr(e),c=s?"":fr(a),d=o?'<div class="derived">'+o+(i?' <span class="vs">'+i+"</span>":"")+(c?'<span class="rider">'+c+"</span>":"")+"</div>":"";return'<div class="sec"><div class="h">'+t+'</div><div class="skill"><span class="ic">'+Po+'</span><div><div class="sn">'+W(e.name)+"</div>"+ti(e,a,r,s)+d+'<p class="flavour">'+W(e.description)+"</p></div></div></div>"}function ai(t,e,a){let r=t.kind!=="weapon",s="";if(r&&(s+='<div class="sec"><div class="h">Combat</div><div class="mech">',t.role&&(s+='<span class="m">'+W(t.role)+"</span>"),t.affinity&&(s+='<span class="m aff">'+W(t.affinity)+"</span>"),t.position&&(s+='<span class="m">'+W(ei[t.position]||ct(t.position))+"</span>"),s+="</div></div>"),s+='<div class="sec"><div class="h">Stats</div><div class="stats">',r){let o=t.stats||{},c=1+((Number(e)>0?Number(e):1)-1)*.06,d=a||{},h=(w,E)=>(Number(w)||0)*(1+(Number(E)||0)),p=Math.round(20+h(o.hp,d.hpPct)*6*c),n=Math.round(h(o.atk,d.atkPct)*c),u=Math.round(h(o.def,d.defPct)*c),f=Math.round(h(o.spd,d.spdPct));s+=$e("HP",o.hp,p,p-Math.round(20+(Number(o.hp)||0)*6*c)),s+=$e("ATK",o.atk,n,n-Math.round((Number(o.atk)||0)*c)),s+=$e("DEF",o.def,u,u-Math.round((Number(o.def)||0)*c)),s+=$e("SPD",o.spd,f,f-(Number(o.spd)||0)),s+="</div></div>",s+='<div class="sec"><div class="h">Combat stats</div><div class="stats two">'+Zo(o,d)}else{let o=t.mainStat||{},i=t.subStat||{};s+=$e("ATK",o.value)+$e(String(i.key||"SUB").toUpperCase(),i.value)}if(s+="</div></div>",r?(s+=lt("Skill",t.skill,t.affinity,!1,!1),s+=lt("Passive",t.passive,t.affinity,!0,!0),s+='<div class="sec"><div class="h">Profile</div>',t.description&&(s+="<p>"+W(t.description)+"</p>"),t.personality&&(s+="<p>"+W(t.personality)+"</p>"),s+="</div>"):(s+=lt("Granted skill",t.grantedSkill,null,!0,!1),s+=lt("Passive",t.passive,null,!0,!0),s+='<div class="sec"><div class="h">About</div><p>'+W(t.description)+"</p></div>"),!t.isProtagonist){let o=t.origin||{},i=o.banner==="standard"?"Standard Banner":o.banner||"Standard Banner";s+='<div class="sec"><div class="h">Origin</div><div class="origin"><span>From <b>'+W(i)+"</b></span>"+(r?'<span class="story-chip">'+Ho+"In the story cast pool</span>":"")+"</div></div>"}return s}function ri(t,e){let a=Number(e)||0,r=Ve(t.name)||"this unit";return'<div class="bond-meter"><div class="top"><span class="lv">&#9829; Bond '+a+'</span><span class="xp">'+(a>0?"in progress":"not started")+'</span></div><div class="track"><i style="width:'+(a>0?12:0)+'%"></i></div><div class="note">Affinity grows by bringing '+W(r)+' into story beats and battles. Each bond level will unlock a character event.</div></div><div class="sec"><div class="h">Character events</div><p>Character events unlock as bond grows &mdash; the relationship system is coming.</p></div>'}function _r(t,e){return Sr(t,e)}function Sr(t,e){let a=e||{},r=Number(a.level)||1,s=Number(a.levelCap)||r,o=r>=s,i=Math.max(0,Number(a.xp)||0),c=Number(a.xpNeeded)||0,d=Array.isArray(a.tiers)?a.tiers:[],h=a.wallet&&a.wallet.insight||{},p=Number(a.wallet&&a.wallet.funds)||0,n=Number(a.cp)||0,u=a.preview||null,f=u&&Number.isFinite(u.xpAfter)?u.xpAfter:i,w=u&&Number.isFinite(u.needAfter)?u.needAfter:c,E=u&&Number.isFinite(u.solid)?u.solid:i,A=w>0?Math.min(100,Math.round(E/w*100)):100,_=u&&w>0?Math.min(100-A,Math.round((f-E)/w*100)):0,T={account:"Capped by your Account Rank &mdash; a unit cannot pass twice your rank.",ascension:"Capped until the next ascension.",max:"Fully levelled."}[a.levelCapReason||"max"],R='<div class="gw-plate"><div class="gw-top"><span class="gw-lv">Lv <b data-gw-lv>'+r+"</b>"+(u&&u.levelTo>r?"<em data-gw-lv-to>&rarr; "+u.levelTo+"</em>":"<i>/ "+s+"</i>")+'</span><span class="gw-cp">CP <b>'+oe(n)+"</b>"+(u&&u.cpTo>n?"<em>&rarr; "+oe(u.cpTo)+"</em>":"")+'</span></div><div class="gw-track'+(o?" full":"")+'"><i data-gw-bar style="width:'+A+'%"></i><u data-gw-ghost style="width:'+_+'%"></u></div><div class="gw-figs">'+(o?'<span class="gw-capped">'+T+"</span>":"<span><b data-gw-xp>"+oe(f)+"</b> / "+oe(w)+' XP</span><span class="gw-cost'+(u&&u.short?" short":"")+'" data-gw-cost>'+(u?oe(u.funds)+" Funds"+(u.short?" &mdash; short, the XP still banks":""):oe(p)+" Funds")+"</span>")+"</div></div>",I=u&&Number.isFinite(u.roomLeft)?u.roomLeft:1/0,G=o?"":'<div class="gw-feed"><div class="gw-items">'+d.map(j=>{let O=Math.max(0,Number(h[j.id])||0),V=u&&u.spent?Math.max(0,Number(u.spent[j.id])||0):0,Q=I>0&&V<O;return'<button class="gw-item'+(O?"":" empty")+(V?" on":"")+'" type="button"'+(Q?"":" disabled")+' data-feed="'+W(j.id)+'"><span class="gw-i-name">'+W(String(j.name).replace(/^Insight /,""))+'</span><span class="gw-i-xp">+'+oe(j.xp)+'</span><span class="gw-i-held" data-feed-held="'+W(j.id)+'">'+oe(O-V)+(V?"<em>&minus;"+oe(V)+"</em>":"")+"</span></button>"}).join("")+'</div><div class="gw-acts"><button class="gw-reset" type="button" data-feed-reset'+(u?"":" disabled")+'>Reset</button><button class="gw-go" type="button" data-feed-go'+(u&&u.ready?"":" disabled")+">Level up</button></div></div>",M=oi(a.ascension,p);return R+G+M}var si={"none-held":"You hold none of these &mdash; farm them in Materials.","short-materials":"Not enough materials for the next ascension.","short-funds":"Not enough Funds for the next ascension.",max:"Fully ascended.",ready:""};function oi(t,e){if(!t)return"";let a=Math.max(0,Number(t.step)||0),r=Math.max(1,Number(t.max)||6),s=t.next||null,o="";for(let n=0;n<r;n+=1)o+='<span class="'+(n<a?"on":"off")+'">&#9733;</span>';let i='<div class="asc-head"><span class="lab">Ascension</span><span class="asc">'+o+'</span><span class="asc-cap">'+(s?"Cap "+s.capFrom+" &rarr; "+s.capTo:"Cap "+(Number(t.cap)||90))+"</span></div>",c=(s?s.items:[]).map(n=>'<div class="asc-item'+(n.short?" short":"")+'"><span class="n">'+W(n.name)+'</span><span class="c">'+oe(n.held)+" / "+oe(n.need)+"</span></div>").join("")+(s?'<div class="asc-item'+(e<s.funds?" short":"")+'"><span class="n">Funds</span><span class="c">'+oe(e)+" / "+oe(s.funds)+"</span></div>":""),d=s?"Reach Lv "+(Number(t.cap)||s.capFrom)+" to ascend &mdash; this unit is Lv "+(Number(t.level)||1)+".":"",p='<div class="asc-foot"><span class="asc-why">'+[t.reason==="not-at-cap"?d:si[t.reason]||"",t.gated===!1&&s?"The level cap stays open until then.":""].filter(Boolean).join(" ")+"</span>"+(s?'<button class="asc-go" type="button" data-ascend'+(t.ready?"":" disabled")+">Ascend</button>":"")+"</div>";return'<div class="asc-plate">'+i+(s?'<div class="asc-cost">'+c+"</div>":"")+p+"</div>"}function Er({unit:t,level:e=1,bond:a=0,tab:r="profile",state:s="ready",growth:o=null}={}){if(s==="loading"||!t)return`
<div class="root">
  ${Ft}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">Unit</div><h2>${s==="error"?"Unavailable":"Loading\u2026"}</h2></div>
    </div>
    <div class="cp-body"><div class="grid-empty" style="grid-column:1/-1">${s==="error"?"Couldn't load this unit.":"Loading\u2026"}</div></div>
  </section>
</div>`;let i=t.kind!=="weapon",c=i&&!t.isProtagonist,d=i?[["profile","Profile",!0],["growth","Growth",!0],["gear","Gear",!1],...c?[["bond","Bond",!0]]:[]]:[["profile","Profile",!0],["growth","Growth",!0]],h=r==="growth"?"growth":r==="bond"&&c?"bond":"profile",p=d.map(([w,E,A])=>A?'<button type="button" role="tab" data-tab="'+w+'" aria-selected="'+(w===h?"true":"false")+'">'+E+"</button>":'<button type="button" role="tab" disabled>'+E+'<span class="soon">Soon</span></button>').join(""),n=h==="bond"?ri(t,a):h==="growth"?Sr(t,o):ai(t,e,null),u=i?t.role:t.weaponType+(t.dedicatedTo?" \xB7 for "+Ve(t.dedicatedTo):""),f='<div class="cp-portrait">'+(t.portrait?'<img class="cp-photo" src="'+W(t.portrait)+'" alt="" loading="lazy">':i?Do.character:Re(t.weaponType,"gf-sil"))+'</div><div class="cp-id-top">'+(i&&!t.isProtagonist?'<button class="cp-art-btn" type="button" data-portrait>'+qo+"Portrait</button>":"")+'<button class="cp-fav" type="button" aria-pressed="false" data-fav><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 3.2C20 14.5 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="cp-id-plate"><div class="plate-stars '+yr(t.rarity)+'">'+br(t.rarity)+"</div><h3>"+W(Ve(t.name))+'</h3><div class="role">'+W(u)+'</div><div class="chips"><span>Lv '+(Number(e)||1)+"</span>"+(i?'<span class="bond">&#9829; Bond '+(Number(a)||0)+"</span>":"")+'</div><button class="cp-party" type="button"'+(i?" data-set-party":" disabled")+">"+(i?"Set to party":"Equip to a character")+"</button></div>";return`
<div class="root">
  ${Ft}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">${i?"Character":"Weapon"}</div><h2>${W(Ve(t.name))}</h2></div>
    </div>
    <div class="cp-body gf-swap">
      <div class="cp-id${i?"":" wpn"}">${f}</div>
      <div class="cp-main">
        <div class="cp-tabs" role="tablist">${p}</div>
        <div class="cp-panel">${n}</div>
      </div>
    </div>
  </section>
</div>`}function Tr(t,{onOpenUnit:e,onBack:a,onCat:r,onRarity:s,onSearch:o}){(t.querySelector(".root")||t).addEventListener("click",p=>{let n=p&&p.target&&p.target.closest?p.target:null,u=n&&n.closest("[data-unit]");u&&e&&e(u.getAttribute("data-unit"))});for(let p of t.querySelectorAll("[data-cat]"))p.addEventListener("click",()=>r&&r(p.dataset.cat));for(let p of t.querySelectorAll("[data-rar]"))p.addEventListener("click",()=>s&&s(p.dataset.rar));let c=t.querySelector("[data-unit-search]");c&&c.addEventListener("input",()=>o&&o(c.value||""));let d=t.querySelector("[data-unit-search-clear]");d&&d.addEventListener("click",()=>{c&&(c.value=""),o&&o(""),c&&typeof c.focus=="function"&&c.focus()});let h=t.querySelector("[data-roster-back]");h&&h.addEventListener("click",()=>a&&a())}function Ar(t,{onTab:e,onBack:a,onPortrait:r,onSetParty:s,onFeed:o,onFeedReset:i,onFeedGo:c,onAscend:d}){for(let T of t.querySelectorAll("[data-tab]"))T.addEventListener("click",()=>e&&e(T.dataset.tab));let h=t.querySelector("[data-back-roster]");h&&h.addEventListener("click",()=>a&&a());let p=t.querySelector("[data-set-party]");p&&p.addEventListener("click",()=>s&&s());let n=t.querySelector("[data-portrait]");n&&n.addEventListener("click",()=>r&&r());let u=t.querySelector(".root")||t,f=null,w=null,E=0,A=()=>{f&&(clearTimeout(f),f=null),w=null,E=0},_=()=>{if(!w)return;let T=u.querySelector('[data-feed="'+w+'"]');if(!T||T.disabled){A();return}E+=1,o&&o(w),f=setTimeout(_,Math.max(55,300-E*24))};u.addEventListener("pointerdown",T=>{let R=T&&T.target&&T.target.closest?T.target:null,I=R&&R.closest("[data-feed]");!I||I.disabled||(A(),w=I.getAttribute("data-feed"),f=setTimeout(_,420))});for(let T of["pointerup","pointercancel","pointerleave"])u.addEventListener(T,A);u.addEventListener("click",T=>{let R=T&&T.target&&T.target.closest?T.target:null;if(!R)return;let I=R.closest("[data-feed]");if(I&&!I.disabled){o&&o(I.dataset.feed);return}if(R.closest("[data-feed-reset]")){i&&i();return}if(R.closest("[data-feed-go]")){c&&c();return}let G=R.closest("[data-ascend]");if(G&&!G.disabled){d&&d();return}})}var ht=.6666666666666666;function ye(t){return String(t??"").replace(/[&<>"']/gu,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function We(t){let e=Array.isArray(t)?t:String(t??"").split(","),a=[];for(let r of e){let s=String(r??"").trim();s&&!a.includes(s)&&a.push(s)}return a}function Mt(t,e,a=1,r=.5,s=.5){let o=Math.max(1,Number(t)||1),i=Math.max(1,Number(e)||1),c=Math.min(o,i*ht),d=Math.min(1,Math.max(.2,Number(a)||1)),h=c*d,p=h/ht;return zt({x:o*r-h/2,y:i*s-p/2,w:h,h:p},o,i)}function zt(t,e,a){let r=Math.max(1,Number(e)||1),s=Math.max(1,Number(a)||1),o=Math.min(Math.max(1,Number(t&&t.w)||1),r),i=o/ht;i>s&&(i=s,o=i*ht);let c=Math.min(Math.max(0,Number(t&&t.x)||0),r-o),d=Math.min(Math.max(0,Number(t&&t.y)||0),s-i);return{x:c,y:d,w:o,h:i}}var Nr=`
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
`;function ii(t,e){return'<span class="pt-chip">'+ye(t)+'<button type="button" data-tag-drop="'+e+'" aria-label="Remove '+ye(t)+'">&times;</button></span>'}function ni(t,e){return t.length?'<div class="pt-strip">'+t.map((a,r)=>'<button class="pt-thumb" type="button" aria-current="'+(a.current?"true":"false")+'"'+(a.current?" disabled":' data-pick="'+r+'"')+' title="'+ye(a.source==="upload"?"Your own image":"Generated")+'"><img src="'+ye(a.url)+'" alt="" loading="lazy">'+(a.current?'<span class="now">Now</span>':"")+"</button>").join("")+"</div>":'<div class="pt-empty">No earlier art yet \u2014 the first redo puts this one here, and the last '+e+" are kept.</div>"}function Cr({unit:t=null,view:e="edit",draft:a=null,history:r=[],historyMax:s=0,busy:o=!1,error:i="",crop:c=null,promptName:d=""}={}){let h=t&&t.name?String(t.name):"Portrait",p=a||{appearance:"",tags:[]},n=We(p.tags),u='<div class="head"><button class="back" type="button" data-portrait-back>&#9664; '+ye(h)+'</button><div class="head-id"><div class="eyebrow">Portrait</div><h2>'+(e==="crop"?"Choose the frame":"Redo the art")+"</h2></div></div>";if(e==="crop"){let E=c&&c.src||"",A=Math.round((c&&c.size||1)*100),_=c&&c.natural,T=_&&c.frame?' style="left:'+c.frame.x/_.w*100+"%;top:"+c.frame.y/_.h*100+"%;width:"+c.frame.w/_.w*100+"%;height:"+c.frame.h/_.h*100+'%"':"";return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait-crop">
    ${u}
    <div class="pt-crop gf-swap">
      <div class="pt-canvas">
        <div class="pt-shot" data-shot${_?' style="aspect-ratio:'+_.w+" / "+_.h+'"':""}>
          <img src="${ye(E)}" alt="" data-crop-img>
          <div class="pt-frame" data-frame${T}></div>
        </div>
      </div>
      <div class="pt-crop-bar">
        <label class="pt-size">Frame<input type="range" min="20" max="100" value="${A}" data-size></label>
        <button class="pt-alt" type="button" data-crop-cancel>Cancel</button>
        <button class="pt-go" type="button" data-crop-ok${o?" disabled":""}>${o?"Uploading\u2026":"Use this frame"}</button>
      </div>
    </div>
  </section>
</div>`}let f=r.find(E=>E.current)||null,w=i?'<div class="pt-note bad">'+ye(i)+"</div>":'<div class="pt-note">Art goes through the image API \u2014 it costs no story tokens.</div>';return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait">
    ${u}
    <div class="pt-body gf-swap">
      <div class="pt-main">
        <div class="pt-now">
          ${f?'<img src="'+ye(f.url)+'" alt="" loading="lazy">':'<div class="pt-none">No portrait yet</div>'}
          ${f?'<span class="pt-tag">'+(f.source==="upload"?"Your image":"Generated")+"</span>":""}
        </div>
        <div class="pt-editor">
          <div class="pt-field grow">
            <!-- The name is shown because it is always sent: it leads the prompt and cannot be
                 edited. This screen labels its fields as what will be sent, and the name was not
                 among them, so it told half a truth. -->
            <div class="pt-sent"><b>Sent first:</b> <span data-prompt-name>${ye(d||"(no name)")}</span>
              <span class="pt-hint">Added automatically, always ahead of the text below.</span></div>
            <div class="pt-label">Appearance<span class="pt-hint">What the image model reads. English only &mdash; a backend rejects the rest.</span></div>
            <textarea class="pt-text" data-appearance spellcheck="false" placeholder="Describe her as the image model should see her.">${ye(p.appearance)}</textarea>
          </div>
          <div class="pt-field">
            <div class="pt-label">Tags<span class="pt-hint">Booru tags. These win over the prose when your style profile is tagged.</span></div>
            <div class="pt-tags" data-tags>
              ${n.map(ii).join("")}
              <input class="pt-add" data-tag-add type="text" placeholder="add a tag, Enter" spellcheck="false">
            </div>
          </div>
          <div class="pt-actions">
            <button class="pt-go" type="button" data-generate${o?" disabled":""}>${o?"Painting\u2026":"Paint it again"}</button>
            <button class="pt-alt" type="button" data-upload${o?" disabled":""}>Use my own image\u2026</button>
            <input class="pt-file" type="file" accept="image/png,image/jpeg,image/webp" data-file>
            ${w}
          </div>
        </div>
      </div>
      <div class="pt-past">
        <div class="cap">Earlier</div>
        ${ni(r,s)}
      </div>
    </div>
  </section>
</div>`}function Rr(t,{onBack:e,onDraft:a,onGenerate:r,onPick:s,onFile:o,onCropSize:i,onCropFrame:c,onCropOk:d,onCropCancel:h}={}){let p=M=>t.querySelector(M),n=p("[data-portrait-back]");n&&n.addEventListener("click",()=>e&&e());let u=p("[data-appearance]");u&&u.addEventListener("input",()=>a&&a({appearance:u.value}));let f=p("[data-tag-add]");f&&f.addEventListener("keydown",M=>{if(M.key!=="Enter"&&M.key!==",")return;M.preventDefault();let j=String(f.value||"").trim();j&&(f.value="",a&&a({addTag:j}))});for(let M of t.querySelectorAll("[data-tag-drop]"))M.addEventListener("click",()=>a&&a({dropTag:Number(M.getAttribute("data-tag-drop"))}));let w=p("[data-generate]");w&&w.addEventListener("click",()=>r&&r());for(let M of t.querySelectorAll("[data-pick]"))M.addEventListener("click",()=>s&&s(Number(M.getAttribute("data-pick"))));let E=p("[data-file]"),A=p("[data-upload]");A&&E&&A.addEventListener("click",()=>E.click()),E&&E.addEventListener("change",()=>{let M=E.files&&E.files[0];E.value="",M&&o&&o(M)});let _=p("[data-size]");_&&_.addEventListener("input",()=>i&&i(Number(_.value)/100));let T=p("[data-crop-ok]");T&&T.addEventListener("click",()=>d&&d());let R=p("[data-crop-cancel]");R&&R.addEventListener("click",()=>h&&h());let I=p("[data-frame]"),G=p("[data-shot]");if(I&&G&&c){let M=null;I.addEventListener("pointerdown",O=>{M={x:O.clientX,y:O.clientY},I.classList.add("drag"),I.setPointerCapture&&I.setPointerCapture(O.pointerId),O.preventDefault()}),I.addEventListener("pointermove",O=>{if(!M)return;let V=G.getBoundingClientRect();c({dx:(O.clientX-M.x)/(V.width||1),dy:(O.clientY-M.y)/(V.height||1)}),M={x:O.clientX,y:O.clientY}});let j=()=>{M=null,I.classList.remove("drag")};I.addEventListener("pointerup",j),I.addEventListener("pointercancel",j)}}function Ot(t,e,a,r){let s=t.querySelector("[data-frame]"),o=t.querySelector("[data-crop-img]");if(!s||!o||!e)return;let i=Math.max(1,Number(a)||1),c=Math.max(1,Number(r)||1);s.style.left=e.x/i*100+"%",s.style.top=e.y/c*100+"%",s.style.width=e.w/i*100+"%",s.style.height=e.h/c*100+"%"}var Ye={story:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',events:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.4 5.4 5.9.6-4.4 4 1.2 5.8L12 15.9 6.9 18.8l1.2-5.8-4.4-4 5.9-.6z"/></svg>',materials:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',tower:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 21V8l6-5 6 5v13z"/><path d="M10 21v-5h4v5M9 11h6"/></svg>'},li=[{id:"story",label:"Story",live:!1,blurb:"The main line. Chapters of beats and fights that move the world forward."},{id:"events",label:"Story Events",live:!1,blurb:"Limited-time side stories, tied to the event system."},{id:"materials",label:"Materials",live:!0,blurb:"Farm what levels and ascends your units. Spends stamina; pays in materials."},{id:"tower",label:"Tower",live:!1,wide:!0,blurb:"A monthly climb. Resets, gets harder, pays in materials."},{id:"pvp",label:"PvP",live:!1,blurb:"Your formation against another commander's, resolved by the same sim. No live opponent."}],Lr=`
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
`;function ge(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function ci(t,e){let a="";for(let r=0;r<t;r+=1)a+='<i class="'+(r<e?"on":"")+'"></i>';return a}function Br({story:t=null,modes:e=li}={}){let a=t||{},r=!!a.hasPlan,s=Number(a.total)||10,o=Math.max(0,Math.min(s,Number(a.done)||0)),i=e.map(p=>{if(p.id==="story"){let n=!!p.live;return'<button class="m hero'+(n?" live":"")+'" type="button"'+(n?' data-mode="story"':" disabled")+'><span class="tag">'+(n?"Open":"Soon")+"</span>"+Ye.story+'<span class="hero-top"><span class="kicker">'+(n?ge(a.chapterLabel||"Chapter 1"):"Not open yet")+'</span><span class="name">Story</span>'+(n?'<span class="title">'+ge(r?a.title||"":"Your world is forged")+'</span><p class="premise">'+ge(r?a.premise||"":"Open the first chapter to start the story.")+"</p>":'<p class="premise">'+ge(p.blurb||"")+"</p>")+"</span>"+(n?'<span class="hero-foot"><span class="nodes">'+ci(s,o)+"<span>"+(r?o+" of "+s+" cleared":"Not started")+'</span></span><span class="cta">'+(o>0?"Continue":"Begin")+"<small>"+ge(a.chapterLabel||"Chapter 1")+"</small></span></span>":"")+"</button>"}return p.wide?'<button class="m strip'+(p.live?" live":"")+'" type="button"'+(p.live?' data-mode="'+ge(p.id)+'"':" disabled")+">"+(Ye[p.id]||Ye.events)+'<span class="strip-id"><span class="kicker">'+(p.live?"Ready":"Not open yet")+'</span><span class="name">'+ge(p.label)+'</span></span><p class="blurb">'+ge(p.blurb)+'</p><span class="tag">'+(p.live?"Open":"Soon")+"</span></button>":'<button class="m'+(p.live?" live":"")+'" type="button"'+(p.live?' data-mode="'+ge(p.id)+'"':" disabled")+'><span class="tag">'+(p.live?"Open":"Soon")+"</span>"+(Ye[p.id]||Ye.events)+'<span class="kicker">'+(p.live?"Ready":"Not open yet")+'</span><span class="name">'+ge(p.label)+'</span><p class="blurb">'+ge(p.blurb)+"</p></button>"}),c=i[0],d=i.filter((p,n)=>n>0&&!e[n].wide).join(""),h=i.filter((p,n)=>n>0&&e[n].wide).join("");return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="modes">
    <div class="head">
      <button class="back" type="button" data-back-home>&#9664; Home</button>
      <div class="head-id"><div class="eyebrow">Battle</div><h2>Pick a mode</h2></div>
    </div>
    <div class="board"><div class="board-top">${c}<div class="rest">${d}</div></div>${h}</div>
  </section>
</div>`}function Fr(t,{onPick:e,onBack:a}={}){for(let s of t.querySelectorAll("[data-mode]"))s.addEventListener("click",()=>e&&e(s.dataset.mode));let r=t.querySelector("[data-back-home]");r&&r.addEventListener("click",()=>a&&a())}var pt={funds:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/></svg>',xp:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.2 5 5.3.5-4 3.6 1.2 5.3L12 14.7 7.3 17.4l1.2-5.3-4-3.6L9.8 8z"/></svg>',asc:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',relic:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3h8l4 6-8 12L4 9z"/><path d="M4 9h16M8 3l-1 6 5 12 5-12-1-6"/></svg>',aether:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2 4 12l8 10 8-10z"/><path d="M4 12h16M12 2v20"/></svg>',form:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M8.5 7.5h6M8.5 11h4"/></svg>',mandate:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M9.6 9.2l1.7 1.7 3.1-3.4"/><path d="M8 13.4 6.5 21l5.5-2.6L17.5 21 16 13.4"/></svg>',rank:'<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l2.6 5.6L21 9.4l-4.5 4.3 1.1 6.3L12 17l-5.6 3 1.1-6.3L3 9.4l6.4-.8z"/></svg>'};function Ir(t){return pt[String(t)]||pt.funds}function ce(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Dt(t){return(Number(t)||0).toLocaleString("en-US")}var Xe=pt,di='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',zr=`
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
/* FIVE plates since the Tenet Trial shipped. Width is the free dimension on a 16:9 stage and height
   is the scarce one, so a fourth COLUMN costs nothing the layout needs, while a second row would
   halve every plate's height \u2014 and the tier cards inside them are already the tightest boxes here. */
.board { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sp-2); }
.plate {
  position: relative; overflow: hidden; min-width: 0; min-height: 0;
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
.p-id .name { display: block; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: calc(var(--f) * 1.5 * var(--gf-type-scale, 1)); letter-spacing: var(--track); text-transform: var(--case); line-height: 1.15; }
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
.tcards.col { grid-auto-rows: minmax(0, 1fr); }
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
.tcard .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: calc(var(--f) * 1.15 * var(--gf-type-scale, 1)); line-height: 1.15; letter-spacing: var(--track); color: var(--text); }
.tcard .v em { font-style: normal; font-weight: 400; font-size: 0.8em; color: var(--steel-faint); }
/* What the run is WORTH, in a unit shared across the three difficulties. This is the line that
   proves 2 x Prism beats 12 x Shard. */
.tcard .u { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.12em; text-transform: var(--case); color: var(--jade); }
.tcard[disabled] .u { color: var(--steel-faint); }
/* The relic stage drops ONE piece at every difficulty, so its card cannot say what it gives with a
   quantity -- what the difficulty moves is the TABLE. These three figures ARE the decision, so they
   go on the card rather than in a tooltip nobody opens. The 5-star is lit because it is the one the
   player is buying; the others are what they are settling for. */
.tcard .odds { display: flex; gap: calc(var(--f) * 0.5); min-width: 0; font-family: var(--display); font-size: var(--t-tiny); letter-spacing: 0.06em; color: var(--steel-faint); font-variant-numeric: tabular-nums; }
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
.fcard .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: calc(var(--f) * 1.2 * var(--gf-type-scale, 1)); line-height: 1.1; letter-spacing: var(--track); color: var(--text); }
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
`;function ft(t,e,a){let r=Number(t.vigor)>Number(e),s=t.cp===null||t.cp===void 0?null:Number(t.cp),o="";for(let d=1;d<=3;d+=1)o+='<i class="'+(d<=Number(t.difficulty)?"on":"")+'"></i>';let i=d=>Math.round(Number(d)*100)+"%",c=t.odds?'<div class="odds"><span>3&#9733;<b>'+i(t.odds[3])+"</b></span><span>4&#9733;<b>"+i(t.odds[4])+'</b></span><span class="five">5&#9733;<b>'+i(t.odds[5])+"</b></span></div>":"";return'<button class="tcard" type="button"'+(r?" disabled":"")+" "+a+'><div class="tl"><span>'+ce(t.label)+'</span><span class="rank">'+o+'</span></div><span class="v">'+Dt(t.qty)+" <em>&times;</em> "+ce(t.material)+"</span>"+c+'<div class="foot"><span class="cp'+(s===null?" tbd":"")+'">CP '+(s===null?"&mdash;":Dt(s))+"</span>"+(Number(t.rankXp)>0?'<span class="rxp">+'+Dt(t.rankXp)+" Rank XP</span>":"")+'<span class="cost">'+di+"<b>"+Number(t.vigor)+"</b></span></div></button>"}var Mr={root:"Materials",asc:"Ascension Materials",form:"Tenet Trial"};function Pt(t){return'<div class="head"><button class="back" type="button" data-farm-back>&#9664; '+(t==="root"?"Battle":"Materials")+'</button><div class="head-id"><div class="eyebrow">'+(t==="root"?"Mode":"Materials")+"</div><h2>"+(Mr[t]||Mr.asc)+"</h2></div></div>"}function Ht(t){return'<div class="root"><div class="stage"></div><section class="screen" data-screen="materials">'+t+"</section></div>"}function Or({view:t="root",data:e=null,state:a="ready"}={}){if(a!=="ready"||!e)return Ht(Pt(t)+'<div class="body"><div class="board" style="grid-template-columns:1fr"><section class="plate"><div class="p-id"><span class="name">'+(a==="error"?"Unavailable":"Loading&hellip;")+'</span><span class="blurb">'+(a==="error"?"Couldn&rsquo;t read the farm.":"Reading what is open today&hellip;")+"</span></div></section></div></div>");let r=Number(e.vigor)||0,s=Array.isArray(e.days)?e.days:[],o=Number(e.today)||0;if(t==="root"){let u=Array.isArray(e.families)?e.families:[],f=u.slice(0,3),w=Array.isArray(e.formFamilies)?e.formFamilies:[],E=w.slice(0,3),A=Array.isArray(e.locked)?e.locked:[],_=R=>A.includes(R),T='<div class="p-soon">Soon</div>';return Ht(Pt("root")+'<div class="body"><div class="board"><section class="plate">'+Xe.funds+'<div class="p-id"><div class="kicker">Currency</div><span class="name">Funds</span><button class="p-help" type="button" aria-label="What Funds is">?</button></div><span class="p-tip">The toll every level and every ascension charges.</span>'+(_("funds")?T:'<div class="tcards col">'+(e.stages.funds||[]).map(R=>ft(R,r,'data-farm-run="funds" data-diff="'+R.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+Xe.xp+'<div class="p-id"><div class="kicker">Levelling</div><span class="name">XP Materials</span><button class="p-help" type="button" aria-label="What XP Materials is">?</button></div><span class="p-tip">Insight, in its three denominations. Feeds any unit.</span>'+(_("xp")?T:'<div class="tcards col">'+(e.stages.xp||[]).map(R=>ft(R,r,'data-farm-run="xp" data-diff="'+R.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+Xe.relic+'<div class="p-id"><div class="kicker">Gear</div><span class="name">Relic Vault</span><button class="p-help" type="button" aria-label="What Relic Vault is">?</button></div><span class="p-tip">One piece per run, whatever the difficulty. What rises is the rarity.</span>'+(_("relic")?T:'<div class="tcards col">'+(e.stages.relic||[]).map(R=>ft(R,r,'data-farm-run="relic" data-diff="'+R.difficulty+'"')).join("")+"</div>")+'</section><section class="plate">'+Xe.form+'<div class="p-id"><div class="kicker">Abilities</div><span class="name">Tenet Trial</span><button class="p-help" type="button" aria-label="What Tenet Trial is">?</button></div><span class="p-tip">Trains a unit&rsquo;s abilities. Tenets by affinity, six families, on rotation.</span>'+(_("form")?T:'<div class="p-open"><div class="k">Open today &middot; '+ce((s[o]||{}).day||"")+'</div><div class="fcards">'+E.map((R,I)=>'<button class="fcard" type="button" data-farm-open="form"><span class="n">'+ce(R.name)+'</span><span class="m">'+ce(R.matches)+"</span>"+(I===E.length-1&&w.length>E.length?'<span class="more">+'+(w.length-E.length)+" more open today</span>":"")+"</button>").join("")+'</div><button class="cta" type="button" data-farm-open="form"><span>Open rotation</span><span>&#9654;</span></button></div>')+'</section><section class="plate">'+Xe.asc+'<div class="p-id"><div class="kicker">Ceilings</div><span class="name">Ascension Materials</span><button class="p-help" type="button" aria-label="What Ascension Materials is">?</button></div><span class="p-tip">Sigils by affinity, Doctrines by role. Eleven families, on rotation.</span><div class="p-open"><div class="k">Open today &middot; '+ce((s[o]||{}).day||"")+'</div><div class="fcards">'+f.map((R,I)=>'<button class="fcard" type="button" data-farm-open="asc"><span class="n">'+ce(R.name)+'</span><span class="m">'+ce(R.matches)+"</span>"+(I===f.length-1&&u.length>f.length?'<span class="more">+'+(u.length-f.length)+" more open today</span>":"")+"</button>").join("")+'</div><button class="cta" type="button" data-farm-open="asc"><span>Open rotation</span><span>&#9654;</span></button></div></section></div></div>')}let i=t==="form",c=i?"form":"asc",d=Array.isArray(i?e.formFamilies:e.families)?i?e.formFamilies:e.families:[],h=Array.isArray(e.helped)?e.helped:[],p=Array.isArray(e.missed)?e.missed:[],n=d.some(u=>(u.rows||[]).some(f=>Number(f.vigor)>r));return Ht(Pt(c)+'<div class="detail"><div class="rota"><div class="rota-lab">Rotation</div><div class="rota-days">'+s.map((u,f)=>'<button class="day'+(f===o?" on":"")+(u.all?" all":"")+'" type="button" disabled>'+ce(u.day)+"</button>").join("")+'</div></div><div class="rota-note">Sunday opens every family.</div><div class="fams-grid" style="--cols:1">'+d.map(u=>'<article class="fam-card"><div class="fam-id"><span class="n">'+ce(u.name)+'</span><span class="m">'+ce(u.matches)+'</span></div><div class="tcards row">'+(u.rows||[]).map(f=>ft(f,r,'data-farm-run="'+c+'" data-diff="'+f.difficulty+'" data-family="'+ce(u.id)+'"')).join("")+"</div></article>").join("")+"</div>"+(i?'<div class="band" style="--bcols:1"><div class="bnd-cell"><span class="k">What Tenets buy</span><span class="t">A unit trains with the Tenet of <b>its own affinity</b>, so what is open today decides <b>who</b> you can train.</span></div></div>':'<div class="band" style="--bcols:2"><div class="bnd-cell"><span class="k">Open today helps</span>'+(h.length?'<div class="who">'+h.map(u=>'<span class="u">'+ce(u.name)+(u.maxed?"<i>fully ascended</i>":"<i>A"+Number(u.at)+" &rarr; cap "+Number(u.to)+"</i>")+"</span>").join("")+"</div>":'<span class="t">Nothing you own uses today&rsquo;s families. <em>Come back tomorrow, or Sunday.</em></span>')+'</div><div class="bnd-cell"><span class="k">Not today</span>'+(p.length?'<span class="t"><b>'+p.length+"</b> more of your units wait on families that are closed: "+p.map(u=>ce(u)).join(", ")+".</span>":'<span class="t">Every unit you own is covered by what is open.</span>')+"</div></div>")+(n?'<div class="band-note">Vigor regenerates one point every '+Math.round((Number(e.vigorPerMs)||18e4)/6e4)+" minutes, up to "+(Number(e.vigorMax)||60)+".</div>":"")+"</div>")}function Dr(t,{onBack:e,onOpen:a,onRun:r}){let s=[t.querySelector(".root"),t.querySelector(".gf-bar")].filter(Boolean);s.length||s.push(t);let o=i=>{let c=i&&i.target&&i.target.closest?i.target:null;if(!c)return;if(c.closest("[data-farm-back]")){e&&e();return}let d=c.closest("[data-farm-open]");if(d){a&&a(d.getAttribute("data-farm-open")||"asc");return}let h=c.closest("[data-farm-run]");h&&!h.disabled&&r&&r({stage:h.getAttribute("data-farm-run"),difficulty:Number(h.getAttribute("data-diff"))||0,family:h.getAttribute("data-family")||""})};for(let i of s)i.addEventListener("click",o)}var Pr={core:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 6l6 5v10l-6 5-6-5V11z"/><circle cx="12" cy="16" r="2.5"/></svg>',edge:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5l4 8-4 14-4-14z"/><path d="M8 13h8"/></svg>',flow:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 5c5 5 5 9 0 12S7 24 12 27"/><circle cx="12" cy="16" r="7"/></svg>',crest:'<svg viewBox="0 0 24 32" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 8h12v9c0 5-6 8-6 8s-6-3-6-8z"/><path d="M12 12v7"/></svg>'};function Hr(t){return Pr[String(t)]||Pr.core}function ut(t,e){let r=String(t).endsWith("Pct")?Number(e)*100:Number(e);return"+"+Math.round(r*10)/10+"%"}function $r(t){let e=String(t||"");return e?e.charAt(0).toUpperCase()+e.slice(1):""}function qe(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function $t(t){return(Number(t)||0).toLocaleString("en-US")}function hi(t){let e="";for(let a=0;a<(Number(t)||0);a+=1)e+="&#9733;";return e}var qr=`
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

`;function jr(t,{gained:e=[],actions:a=!0,projection:r=null}={}){if(!t)return'<aside class="detail"><div class="d-none">Pick a piece to see its four sub-stats, what it gives now and what it gives at its cap.</div></aside>';let s=Number(t.rarity)||3,o=new Set((e||[]).map(n=>String(n.key))),i=t.main||null,c=Number(t.levelCap)||0,d=Number(t.level)||0,h=d>=c,p=Array.isArray(t.subs)?t.subs:[];return'<aside class="detail r'+s+'"><div class="d-head"><span class="d-art">'+Hr(t.slot)+'</span><span class="d-id"><span class="n">'+qe($r(t.slot))+'</span><span class="m"><em>'+hi(s)+"</em> &middot; Lv "+d+" / "+c+"</span></span></div>"+(i?'<div class="d-main"><span class="k">'+qe(i.label||i.key)+'</span><span class="v">'+ut(i.key,i.value)+'</span><span class="m">'+(Number(i.valueMax)>Number(i.value)?"&rarr; "+ut(i.key,i.valueMax)+" at cap":"at cap")+"</span></div>":"")+'<div class="d-subs"><span class="h">Sub-stats &middot; '+p.length+"</span>"+p.map(n=>'<div class="d-sub'+(o.has(String(n.key))?" grew":"")+'"><span class="k">'+qe(n.label||n.key)+'</span><span class="v">'+ut(n.key,n.value)+"</span></div>").join("")+'</div><div class="d-worn">'+(t.wornBy?"Worn by <b>"+qe(t.wornBy)+"</b>":"Not equipped")+"</div>"+(r?'<div class="d-proj"><span class="big">Lv '+r.from+" &rarr; "+r.to+"</span><span>Eats <b>"+r.picked+"</b> "+(r.picked===1?"piece":"pieces")+" and <b>"+$t(r.funds)+"</b> Funds"+(r.short?' &mdash; <span class="short">you hold '+$t(r.have)+"</span>":"")+".</span><span>"+(r.ticks?"Reinforces <b>"+r.ticks+"</b> sub-stat"+(r.ticks===1?"":"s")+", picked at random.":"No sub-stat is reinforced yet &mdash; the next one lands at <b>Lv "+r.nextTick+"</b>.")+"</span></div>":"")+(a&&r?'<div class="d-acts"><button type="button" data-inv-feed-go'+(!r.picked||r.short?" disabled":"")+'>Feed</button><button class="ghost" type="button" data-inv-feed-cancel>Cancel</button></div>':a?'<div class="d-acts"><button type="button" data-inv-upgrade="'+qe(t.id)+'"'+(h?" disabled":"")+">"+(h?"At its cap":"Upgrade")+'</button><button class="ghost" type="button" data-inv-lock="'+qe(t.id)+'">'+(t.locked?"Unlock":"Lock")+'</button></div><div class="d-cost">'+(h?"Fully reinforced &mdash; <b>"+p.length+"</b> sub-stats at their rolled ceiling.":"One level eats <b>1</b> spare relic and <b>"+$t(t.feedCost)+"</b> Funds. A sub is reinforced every <b>"+(Number(t.tickEvery)||3)+"</b> levels.")+"</div>":"")+"</aside>"}function Ur(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Ke(t){return(Number(t)||0).toLocaleString("en-US")}function Gr(t){return t?t.relic?[]:[{kind:/Funds/i.test(String(t.material))?"funds":/Insight/i.test(String(t.material))?"xp":"asc",qty:Number(t.qty)||0,name:String(t.material||"")}]:[]}var Vr=qr+`
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
`;function pi(t){return'<div class="rs-rw"><span class="rs-ic">'+Ir(t.kind)+'</span><span class="rs-q">'+(Number(t.qty)>0?"+"+Ke(t.qty):Ke(t.qty))+'</span><span class="rs-n">'+Ur(t.name)+"</span></div>"}function qt(t,e){let a=Number(e);return!Number.isFinite(a)||a<=0?100:Math.max(0,Math.min(100,Math.round(Number(t)/a*1e3)/10))}function Wr({outcome:t="win",where:e="",rewards:a=[],relic:r=null,rank:s=null,canReplay:o=!1}={}){let i=t!=="lose",c=Array.isArray(a)?a:[],d=s&&s.from||null,h=d?qt(d.xp,d.xpNeeded):s?qt(s.xp,s.xpNeeded):0,p=s?qt(s.xp,s.xpNeeded):0,n=Number(s&&s.levels)||0;return'<div class="root'+(i?"":" lose")+'"><div class="stage"></div><section class="screen" data-screen="result"><div class="rs-verdict"><h2>'+(i?"Victory":"Defeat")+"</h2>"+(e?'<span class="rs-where">'+Ur(e)+"</span>":"")+"</div>"+(r?'<div class="rs-piece"><div class="rs-cap">A piece from the Vault</div>'+jr(r,{actions:!1})+"</div>":"")+(c.length?'<div class="rs-loot">'+c.map(pi).join("")+"</div>":r?"":'<div class="rs-none">'+(i?"Nothing dropped here &mdash; this node pays in progress, not in materials.":"You keep nothing. The Vigor was spent when the stage started, so a loss costs the run.")+"</div>")+(s?'<div class="rs-rank'+(n>0?" leveled":"")+'" data-rank data-start="'+h+'" data-end="'+p+'" data-levels="'+n+'"><div class="rs-top"><span>Commander</span><b data-rank-level>'+Number(s.level)+'</b><span class="rs-gain">+'+Ke(s.gain)+' XP</span></div><div class="rs-track"><i data-rank-bar style="width:'+h+'%"></i></div><div class="rs-foot"><span data-rank-xp>'+Ke(s.xp)+" / "+(s.xpNeeded===null||s.xpNeeded===void 0?"&mdash;":Ke(s.xpNeeded))+" XP</span><span>"+(s.xpNeeded===null||s.xpNeeded===void 0?"At the rank cap":"to Commander "+(Number(s.level)+1))+"</span></div>"+(Number(s.vigorMax)>0&&Number(s.from&&s.from.vigorMax)>0?'<div class="rs-up">Vigor <b>'+Number(s.from.vigorMax)+" &rarr; "+Number(s.vigorMax)+"</b></div>":"")+"</div>":"")+'<div class="rs-acts">'+(o?'<button class="ghost" type="button" data-result-again>Run it again</button>':"")+'<button type="button" data-result-continue>Continue &rsaquo;</button></div></section></div>'}function Yr(t,{onContinue:e,onAgain:a}={}){(t.querySelector(".root")||t).addEventListener("click",p=>{let n=p&&p.target&&p.target.closest?p.target:null;if(n){if(n.closest("[data-result-again]")){a&&a();return}n.closest("[data-result-continue]")&&e&&e()}});let s=t.querySelector("[data-rank]"),o=t.querySelector("[data-rank-bar]");if(!s||!o)return;let i=Number(s.getAttribute("data-end"))||0,c=Number(s.getAttribute("data-levels"))||0,d=(p,n)=>{typeof setTimeout=="function"&&setTimeout(n,p)},h=p=>{o.style&&(o.style.width=p+"%")};if(c>0){d(30,()=>h(100)),d(900,()=>{o.style&&(o.style.transition="none"),h(0),d(30,()=>{o.style&&(o.style.transition=""),h(i)})});return}d(30,()=>h(i))}function Xr(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var fi=[{match:/:banner:char:/,cost:"tokens",label:()=>"Minting this week's characters"},{match:/:banner:wpn:/,cost:"tokens",label:()=>"Minting this week's weapons"},{match:/:banner:standard$/,cost:"tokens",label:()=>"Forging the founding cast"},{match:/:banner-art:/,cost:"images",label:()=>"Painting the banner"}],ui=[{at:"/banner",cost:"tokens",label:"Forging the founding cast"},{at:"/summon-banner",cost:"tokens",label:"Checking this week's banner"},{at:"/protagonist",cost:"tokens",label:"Building your unit"},{at:"/portrait/upload",cost:"images",label:"Sending your image"},{at:"/portrait",cost:"images",label:"Painting a portrait"},{at:"/banner-art",cost:"images",label:"Painting the banner"}],vi=["/portrait/select"];function Kr(t){let e=String(t||"");if(vi.includes(e))return null;for(let a of ui)if(e===a.at||e.startsWith(a.at+"/"))return{cost:a.cost,label:a.label};return null}function gi(t){let e=String(t||"");for(let a of fi){let r=e.match(a.match);if(r)return{cost:a.cost,label:a.label(r)}}return e?{cost:"tokens",label:"Generating"}:null}function mi(t){let e=Number(t&&t.total)||0;if(!e)return null;let a=Math.min(e,Number(t.done)||0);return{cost:"images",label:t&&t.name?`Painting ${t.name}`:"Painting portraits",detail:`${a+1} of ${e}`}}function Zr({generating:t=[],local:e=[],art:a=null,background:r=null}={}){let s=[],o=new Set,i=c=>{!c||o.has(c.label)||(o.add(c.label),s.push(c))};for(let c of Array.isArray(e)?e:[])i(c);for(let c of Array.isArray(t)?t:[])i(gi(c));return i(mi(a)),r&&i({cost:"images",label:"Painting a location",detail:String(r)}),s}function Jr(t){return(Array.isArray(t)?t:[]).map(e=>e.label+(e.detail||"")).join("|")}var Qr=`
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
`;function es(t,{max:e=2}={}){let a=Array.isArray(t)?t.filter(Boolean):[];if(!a.length)return"";let r=a.slice(0,e),s=a.length-r.length;return'<div class="gb-busy" data-busy aria-live="polite">'+r.map(o=>'<div class="gb-row '+(o.cost==="images"?"images":"text")+'"><span class="gb-dot"></span><span class="gb-what"><b>'+Xr(o.label)+"</b>"+(o.detail?" &middot; "+Xr(o.detail):"")+'</span><span class="gb-cost">'+(o.cost==="images"?"image":"tokens")+"</span></div>").join("")+(s>0?'<div class="gb-more">+'+s+" more running</div>":"")+"</div>"}function de(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function as(t){return t>=5?"\u2605\u2605\u2605\u2605\u2605":t===4?"\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605"}function Ut(t){return String(t||"").split(",")[0].trim()}function vt(t){let e=Number(t)||0;return(e*100>=10,(e*100).toFixed(1)).replace(/\.0$/,"")+"%"}var bi={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',material:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><path d="M50 20 78 52 50 110 22 52Z"/><path d="M50 20 50 110M22 52h56" stroke="#0E1420" stroke-opacity="0.35" stroke-width="3"/></g></svg>'};var jt='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="#F0B429" stroke="#B8860B" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2 7 12l5 10" stroke="#FFF" stroke-opacity="0.5" stroke-width="1.2"/></svg>',yi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="var(--on-coral)" stroke="var(--on-coral)" stroke-width="1.4" stroke-linejoin="round"/></svg>',wi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';var xi='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" stroke="currentColor" stroke-width="1.8"/></svg>',ki='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',Gt='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-ssil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',Wt=`
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
`,_i={bulwark:"Bulwark",blade:"Blade",focus:"Focus",tome:"Tome",edge:"Edge"};function Ze(t){let e=t.kind==="weapon"?"weapon":t.kind==="material"?"material":"character",a=Number(t.rarity)||3,r=e==="material"?"Material":Ut(t.name)||"Unit",s;if(e==="material")s="Material";else if(e==="weapon"){let o=_i[t.weaponType]||(t.weaponType?t.weaponType:"Weapon");s=t.dedicatedTo?`${o} \xB7 ${Ut(t.dedicatedTo)}'s signature`:o}else s=t.role?`${t.role}${t.affinity?" \xB7 "+t.affinity:""}`:"";return{kind:e,rarity:a,name:r,role:s,weaponType:t.weaponType||"",dedicatedTo:t.dedicatedTo||"",portrait:t.portrait||null,isNew:!!t.isNew,up:!!t.up,facet:t.facet||null}}function Si(t,e){let a=typeof t=="string"?t.trim():"";return a?'<img class="u-photo" src="'+de(a)+'" alt="" loading="lazy">':e}function Ei(t,e){let a=t.kind==="material"?" mat":t.kind==="weapon"?" wpn":"",r=e&&t.kind!=="character"?'<span class="kind-tag">'+(t.kind==="weapon"?"Weapon":"Material")+"</span>":"",s=t.up?'<span class="pill-up">UP</span>':"";return'<div class="u-art'+a+'">'+Si(t.portrait,"")+'<span class="u-stars">'+as(t.rarity)+"</span>"+s+(t.portrait?"":t.kind==="weapon"?Re(t.weaponType,"gf-ssil"):bi[t.kind])+r+(t.isNew?'<span class="tag-new">NEW</span>':t.facet?'<span class="tag-new fct">'+(t.facet.gained?"FACET "+t.facet.facet:"FACET "+t.facet.facet+"/"+t.facet.max)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+de(t.name)+'</div><div class="u-role">'+de(t.role)+"</div></div>"}function Vt(t,e){return'<article class="u r'+(Number(t.rarity)||3)+'">'+Ei(t,e)+"</article>"}function ts(t){let e=null;for(let a of t){let r=Ze(a);(!e||r.rarity>e.rarity)&&(e=r)}return e}function rs(t){let e=Number(t);if(!Number.isFinite(e)||e<=0)return"";let a=Math.floor(e/6e4);if(a<60)return Math.max(1,a)+"m left";let r=Math.floor(a/60);if(r<24)return r+"h left";let s=Math.floor(r/24),o=r-s*24;return o>0?s+"d "+o+"h left":s+"d left"}function Ti(t,e){let a=de(t.id);if(t.live===!1)return'<button class="bcard" type="button" aria-disabled="true" data-banner="'+a+'"><span class="bt-face empty">'+xi+'</span><span class="bt-id"><b>'+de(t.title||t.id)+"</b><i>Not open yet</i></span></button>";let r=t.face?'<span class="bt-face" style="background-image:url('+de(t.face)+')"></span>':t.kind==="weapon"?'<span class="bt-face sil">'+Re(t.weaponType||"blade","gf-ssil")+"</span>":'<span class="bt-face empty">'+wi+"</span>",s=t.pity||{},o=Number(s.hard)||80,i=Number(s.count)||0,c=Math.max(0,Math.min(100,i/o*100)),d=t.pending?"Opens when you pick it":t.type==="featured"?"Featured \xB7 "+(rs(t.endsInMs)||"ending"):"Permanent";return'<button class="bcard" type="button" data-banner="'+a+'" aria-pressed="'+(t.id===e)+'">'+r+'<span class="bt-id"><b>'+de(t.title||t.id)+"</b><i>"+d+'</i><span class="bt-pity"><span class="bt-track"><i style="width:'+c.toFixed(0)+'%"></i></span><em>'+i+"/"+o+(s.guaranteed?" \xB7 gtd":"")+"</em></span></span></button>"}function ss({banners:t=[],banner:e,rates:a,pity:r,wallet:s,cost:o=160,bannerId:i="char-standard",state:c="ready",details:d=!1,arting:h=!1}={}){let p=Number(s&&s.aether)||0,n=Array.isArray(t)?t:[],u='<div class="rail"><div class="rail-scroll">'+(n.length?n.map(K=>Ti(K,i)).join(""):"")+"</div></div>";if(c!=="ready"||!e){let K=c==="error"?"Try again in a moment, or pick another banner.":"Summoning this week's featured cast \u2014 the first open of a new week takes a few seconds. Pick another banner to pull now.";return`
<div class="root">
  ${Gt}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${jt}<b>${p.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show"><div class="soon-panel"><div class="h">${c==="error"?"Couldn't open the banner":"Working\u2026"}</div><p>${K}</p></div></div>
    </div>
  </section>
</div>`}let f=e,w=f.kind==="weapon"?"weapon":"character",E=Array.isArray(f.featured)?f.featured.map(Ze):[],A=E.find(K=>K.rarity===5)||E[0]||null,_=E.find(K=>K.rarity===4)||null,T=typeof f.art=="string"&&!!f.art.trim(),R;if(T)R='<div class="art wide" style="background-image:url('+de(f.art)+')"></div>';else if(w==="weapon")R='<div class="art"><div class="artback flat"></div><div class="plates"><div class="plate sil">'+Re(A&&A.weaponType||"blade","gf-ssil")+"</div></div></div>";else{let K=A&&A.portrait?de(A.portrait):"",Te=_&&_.portrait?de(_.portrait):"";R='<div class="art">'+(K?'<div class="artback" style="background-image:url('+K+')"></div>':'<div class="artback flat"></div>')+'<div class="plates">'+(K?'<div class="plate five" style="background-image:url('+K+')"></div>':"")+(Te?'<div class="plate four" style="background-image:url('+Te+')"></div>':"")+"</div></div>"}let I=f.type==="featured"?rs(f.endsInMs):"",G=f.type==="featured"?"Featured \xB7 5\u2605 "+w+(I?" \xB7 "+I:""):"Permanent pool",M=f.title||(A?A.name:"Banner"),j=A?Ut(A.name)+(A.role?" \xB7 "+de(A.role):""):"The permanent pool. Every retired featured unit folds in here.",O=a||{},V=K=>f.type==="featured"?" <em>\u2191"+vt(K)+"</em>":"",Q='<div class="rates"><span><b class="g">\u2605\u2605\u2605\u2605\u2605</b> '+vt(O.five)+V(O.featured)+'</span><span><b class="e">\u2605\u2605\u2605\u2605</b> '+vt(O.four)+V(O.featuredFour)+"</span>"+(f.type==="featured"?"":"<span>No rate-up</span>")+"</div>",X=r||{},he=Number(X.count)||0,ue=Number(X.hard)||80,ie=Number(X.soft)||74,ee=Math.max(0,ue-he),te=Math.min(100,he/ue*100),ne=Math.min(100,ie/ue*100),ve=vt(O.featured),Z=f.type==="featured"?"Guaranteed 5\u2605 in <b>"+ee+"</b> \xB7 soft pity from "+ie+" \xB7 "+(X.guaranteed?"next 5\u2605 <b>is</b> the rate-up":"next 5\u2605 is a "+ve+" chance for the rate-up"):"Guaranteed 5\u2605 in <b>"+ee+"</b> \xB7 soft pity from "+ie+" \xB7 5\u2605 from the standard pool",x='<div class="pity"><div class="fig"><span>Pity to 5\u2605 '+(f.kind==="character"?"character":"weapon")+"</span><span><b>"+he+"</b> / "+ue+'</span></div><div class="track"><i style="width:'+te.toFixed(1)+'%"></i><span class="soft" style="left:'+ne.toFixed(1)+'%"></span></div><div class="note">'+Z+"</div></div>",g=p>=o,m=p>=o*10,b='<div class="pulls"><button class="pull one" type="button" data-pull="1"'+(g?"":' aria-disabled="true"')+'><span class="big">Summon</span><span class="cost">'+jt+" "+o+' \xB7 \xD71</span></button><button class="pull ten" type="button" data-pull="10"'+(m?"":' aria-disabled="true"')+'><span class="big">Summon \xD710</span><span class="cost">'+yi+" "+o*10+" \xB7 one 4\u2605+ guaranteed</span></button></div>",N=f.canArt===!0?'<button class="chip" type="button" data-redo-art'+(h?' aria-disabled="true"':"")+">"+ki+(h?"Painting\u2026":T?"Redo art":"Paint art")+"</button>":"",U=Array.isArray(f.pool4)?f.pool4.map(Ze):[],Ee=f.type==="featured"?"Also in this banner":"Also in the permanent pool",Le=d?'<div class="sheet" data-sheet><div class="sheet-head"><h4>'+de(M)+'</h4><span class="spacer"></span><button class="chip" type="button" data-details-close>Close</button></div>'+Q+'<div class="strips"><span class="strip-label">'+(f.type==="featured"?"Rate-up":"Standard 5\u2605")+'</span><div class="strip-scroll"><div class="featured">'+E.map(K=>Vt({...K,up:f.type==="featured"},!0)).join("")+"</div></div>"+(U.length?'<span class="strip-label">'+Ee+'</span><div class="strip-scroll"><div class="featured">'+U.map(K=>Vt({...K,up:!1},!0)).join("")+"</div></div>":"")+"</div></div>":"";return`
<div class="root">
  ${Gt}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${jt}<b>${p.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show">
        ${R}
        <div class="veil"></div>
        <div class="bname"><span class="kicker">${G}</span><h3>${de(M)}</h3><p>${j}</p></div>
        <div class="chips">${N}<button class="chip" type="button" data-details>Details &amp; pool</button></div>
        <div class="float">${Q}${x}${b}</div>
        ${Le}
      </div>
    </div>
  </section>
</div>`}function os({results:t=[]}={}){let e=t.map(Ze),a=e.length===1,r=e.map((s,o)=>'<div class="rv-card r'+s.rarity+'" data-i="'+o+'"><div class="rv-rays"></div><div class="rv-flare"></div><div class="rv-inner"><div class="rv-face rv-facedown"><span></span></div><div class="rv-face rv-front">'+Vt(s,!0)+"</div></div></div>").join("");return`
<div class="root">
  ${Gt}
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
</div>`}function is(t,{banners:e=[],onBanner:a,onPull:r,onBack:s,onDetails:o,onRedoArt:i}){for(let n of Array.isArray(e)?e:[]){if(!n||!n.id||n.live===!1)continue;let u=t.querySelector('[data-banner="'+n.id+'"]');u&&u.addEventListener("click",(f=>()=>a&&a(f))(n.id))}let c=t.querySelector("[data-details]");c&&c.addEventListener("click",()=>o&&o(!0));let d=t.querySelector("[data-details-close]");d&&d.addEventListener("click",()=>o&&o(!1));let h=t.querySelector("[data-redo-art]");h&&h.addEventListener("click",()=>{h.getAttribute("aria-disabled")!=="true"&&i&&i()});for(let n of t.querySelectorAll("[data-pull]"))n.addEventListener("click",()=>{n.getAttribute("aria-disabled")!=="true"&&r&&r(Number(n.dataset.pull)===10?10:1)});let p=t.querySelector("[data-summon-back]");p&&p.addEventListener("click",()=>s&&s())}function ns(t,{results:e=[],onContinue:a}){let r=t.querySelector('[data-screen="reveal"]'),s=t.querySelector("[data-rv-back]"),o=t.querySelector("[data-rv-grid]"),i=t.querySelector("[data-rv-headline]"),c=e.map(Ze),d=[],h=0,p=()=>{for(let T of d)clearTimeout(T);d.length=0},n=T=>{!r||!r.classList||(r.classList.remove("phase-charge","phase-flash","phase-reveal","phase-done"),T&&r.classList.add("phase-"+T))},u=T=>{let R=o&&o.querySelector('[data-i="'+T+'"]');R&&R.classList&&R.classList.add("revealed")},f=()=>{let T=ts(e);i&&(i.innerHTML=T?"Best pull: <b>"+de(T.name)+"</b> \xB7 "+as(T.rarity):""),n("done")},w=()=>{for(;h<c.length;h+=1)u(h);f()};n("charge");let E=(ts(e)||{rarity:3}).rarity;s&&s.classList&&s.classList.remove("gold","epic","steel"),d.push(setTimeout(()=>{s&&s.classList&&s.classList.add(E===5?"gold":E===4?"epic":"steel")},620)),d.push(setTimeout(()=>n("flash"),1180)),d.push(setTimeout(()=>{n("reveal");let T=c.length===1?0:230;for(let R=0;R<c.length;R+=1)d.push(setTimeout(()=>{u(h),h+=1},260+R*T));d.push(setTimeout(f,260+c.length*T+260))},1560)),r&&r.addEventListener("click",T=>{T.target&&T.target.closest&&(T.target.closest(".rv-foot")||T.target.closest(".rv-top"))||r.classList&&r.classList.contains("phase-done")||(p(),n("reveal"),w())});let A=t.querySelector("[data-rv-skip]");A&&A.addEventListener("click",()=>{p(),n("reveal"),w()});let _=t.querySelector("[data-rv-continue]");return _&&_.addEventListener("click",()=>{p(),a&&a()}),p}var ds=`
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
.stage::after { content: ""; position: absolute; inset: 0; opacity: 0.18; background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px); }

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
`,Ai='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="fm-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',hs='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#fm-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>';function Ni(t,e){let a=typeof t=="string"?t.trim():"";return a?'<img class="slot-photo" src="'+ke(a)+'" alt="" loading="lazy">':e}var Ci='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8l4 4 4-6 4 6 4-4v9H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',Ri={4:"\u2605\u2605\u2605\u2605",5:"\u2605\u2605\u2605\u2605\u2605"},Li={Fire:"var(--af-fire)",Water:"var(--af-water)",Wind:"var(--af-wind)",Earth:"var(--af-earth)",Light:"var(--af-light)",Dark:"var(--af-dark)"};function ke(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function ps(t){return String(t||"").split(",")[0]}function Bi(t){return(Number(t)||0).toLocaleString("en-US")}function fs(t){let e=t&&t.leaderSlot||"leader",a=t&&t.leader||{name:"You",role:"\u2014",affinity:"Fire",cp:0},r={id:e,leader:!0,name:a.name||"You",r:5,role:a.role||"\u2014",aff:a.affinity||"Fire",pos:a.position==="back"?"back":"front",cp:Number(a.cp)||0,portrait:a.portrait||null},s=new Map,o=(t&&Array.isArray(t.units)?t.units:[]).map(i=>{let c={id:i.id,name:i.name,r:i.rarity===5?5:4,role:i.role||"",aff:i.affinity||"Fire",pos:i.position==="back"?"back":"front",cp:Number(i.cp)||0,portrait:i.portrait||null};return s.set(c.id,c),c});return{LEADER:e,leaderObj:r,byId:s,units:o}}function us(t,e){return e===t.LEADER?t.leaderObj:t.byId.get(e)||null}function vs(t){let e=t&&typeof t=="object"?t:{},a=r=>{let s=Array.isArray(r)?r:[];return[s[0]||null,s[1]||null,s[2]||null]};return{front:a(e.front),back:a(e.back)}}function Je(t,e){return t.front.indexOf(e)>=0||t.back.indexOf(e)>=0}function Fi(t,e){let a=0;return["front","back"].forEach(r=>{e[r].forEach(s=>{let o=s&&us(t,s);o&&(a+=o.cp)})}),a}function gs(t,e){return(t&&Array.isArray(t.presets)&&t.presets.length?t.presets:[{name:"Team 1",board:{front:[e,null,null],back:[null,null,null]}}]).map((r,s)=>({name:r&&r.name||"Team "+(s+1),board:vs(r&&r.board)}))}function gt(t,e){return vs(t&&t.board)}function Ii(t,e,a,r,s){let o=e[r][s],i=a&&a.row===r&&a.idx===s;if(!o)return'<button class="slot empty'+(i?" held":"")+'" data-slot="'+r+":"+s+'"><span class="plus">+<small>Add</small></span></button>';let c=us(t,o)||t.leaderObj;return'<button class="'+("slot filled "+(c.leader?"leader":"r"+c.r)+(i?" held":""))+'" data-slot="'+r+":"+s+'">'+(c.leader?'<span class="slot-tag">LEADER</span>':"")+'<div class="slot-art">'+Ni(c.portrait,"")+(c.portrait?"":hs)+'</div><span class="slot-remove" data-remove="'+r+":"+s+'">\xD7</span><div class="slot-meta"><div class="slot-name">'+ke(ps(c.name))+'</div><div class="slot-role">'+ke(c.role)+" \xB7 "+ke(c.aff)+"</div></div></button>"}function mt(t,e,a,r){return e[r].map((s,o)=>Ii(t,e,a,r,o)).join("")}function ls(t,e,a,r,s){let o=Je(r,e.id),i=s&&s.bench===e.id,c="b "+(a?"leader":"r"+e.r)+(o&&!a?" inteam":"")+(i?" held":""),d=a?"\u2605\u2605\u2605\u2605\u2605":Ri[e.r],h=a?'<span class="youtag">YOU</span>':"";return'<button class="'+c+'" data-pick="'+e.id+'"><span class="b-ic">'+(a?Ci:e.portrait?'<img class="b-photo" src="'+ke(e.portrait)+'" alt="" loading="lazy">':hs)+'<span class="aff" style="background:'+(Li[e.aff]||"var(--steel)")+'"></span></span><span class="b-main"><span class="b-name">'+ke(ps(e.name))+'</span><span class="b-sub">'+ke(e.role)+" \xB7 "+ke(e.aff)+'</span></span><span class="b-stars">'+d+"</span>"+h+"</button>"}function ms(t,e,a,r){let s=t.units.filter(i=>r==="all"||String(i.r)===r),o=ls(t,t.leaderObj,!0,e,a);return s.forEach(i=>{o+=ls(t,i,!1,e,a)}),o}function bs(t,e){return t.units.filter(a=>!Je(e,a.id)).length}function ys(t,e,a,r,s){let o="";return a.forEach((i,c)=>{let d=c===r,h=Fi(t,d?e:gt(i,t.LEADER));o+='<div class="preset'+(d&&s?" dirty":"")+'" data-preset="'+c+'" aria-pressed="'+d+'"><span class="nm" data-name="'+c+'">'+ke(i.name)+'</span><span class="cp">'+Bi(h)+'</span><span class="x" data-del="'+c+'">\xD7</span></div>'}),o}function ws({state:t="loading",data:e=null,battleMode:a=!1}={}){let r;if(t==="ready"&&e){let s=fs(e),o=gs(e,s.LEADER),i=Math.min(Math.max(0,Number(e.active)||0),o.length-1),c=gt(o[i],s.LEADER);return r='<div class="fm-body"><div class="board"><div class="row-lab">Front line &mdash; melee &amp; guard</div><div class="slots" data-row="front">'+mt(s,c,null,"front")+'</div><div class="row-lab">Back line &mdash; ranged &amp; support</div><div class="slots" data-row="back">'+mt(s,c,null,"back")+'</div><div class="board-foot"><span class="hint">Tap a unit, then a slot to place &middot; <b>\xD7</b> benches a unit</span></div></div><div class="picker"><div class="picker-head"><span class="t">Your units</span><span class="n" data-bench-n>'+bs(s,c)+' available</span></div><div class="filters" data-filters><button class="chip" type="button" data-rar="all" aria-pressed="true">All</button><button class="chip" type="button" data-rar="5" aria-pressed="false">5&#9733;</button><button class="chip" type="button" data-rar="4" aria-pressed="false">4&#9733;</button></div><div class="bench-scroll"><div class="bench" data-bench>'+ms(s,c,null,"all")+"</div></div>"+(a?'<button class="into-battle" type="button" data-into-battle>Into battle &raquo;<small>Start the fight with this team</small></button>':"")+'</div></div><div class="presets"><span class="lab">Presets</span><div class="preset-strip" data-presets>'+ys(s,c,o,i,!1)+'</div><div class="preset-actions"><span class="autosaved">Auto-saved</span><button class="btn" type="button" data-saveas>New team</button></div></div>',cs(r,a)}return t==="error"?r=`<div class="fm-msg"><span class="t">Couldn't load the formation.</span><button class="retry" type="button" data-retry>Retry</button></div>`:r='<div class="fm-msg"><span class="t">Marshalling your units\u2026</span></div>',cs(r,a)}function cs(t,e){return'<div class="root">'+Ai+'<div class="stage"></div><section class="screen"><div class="head"><button class="back" type="button" data-back>&#9664; '+(e?"Cancel":"Command")+'</button><div class="head-id"><div class="eyebrow">'+(e?"Before the fight":"Command")+"</div><h2>"+(e?"Choose your team":"Formation")+"</h2></div></div>"+t+"</section></div>"}function xs(t,{data:e,onSave:a,onBack:r,onRetry:s,onIntoBattle:o}={}){let i=t.querySelector("[data-back]");i&&i.addEventListener("click",()=>r&&r());let c=t.querySelector("[data-retry]");c&&c.addEventListener("click",()=>s&&s());let d=t.querySelector("[data-into-battle]");if(d&&d.addEventListener("click",()=>o&&o()),!e)return()=>{};let h=fs(e),p=h.LEADER,n=gs(e,p),u=Math.min(Math.max(0,Number(e.active)||0),n.length-1),f=gt(n[u],p),w=null,E="all",A=!1,_=null,T=t.querySelector("[data-bench-n]"),R=t.querySelector("[data-bench]"),I=t.querySelector("[data-presets]"),G=t.querySelector("[data-save]");function M(){A=!0}function j(){let m=n.map((b,S)=>({name:b.name,board:S===u?{front:f.front.slice(),back:f.back.slice()}:{front:b.board.front.slice(),back:b.board.back.slice()}}));a&&a(m,u)}function O(){n[u].board={front:f.front.slice(),back:f.back.slice()},A=!1,j()}function V(m,b){u=m,f=gt(n[m],p),A=!1,w=null,b||x()}function Q(m,b,S){let N=m.bench?m.bench:f[m.row][m.idx];if(!N)return!1;let U=f[b][S];if(m.bench)f[b][S]=N;else{if(m.row===b&&m.idx===S)return!1;f[m.row][m.idx]=U,f[b][S]=N}return M(),!0}function X(m){return m.bench?!1:(f[m.row][m.idx]=null,M(),!0)}function he(m){let b=["front","back"];for(let S=0;S<2;S++){let N=f[b[S]].indexOf(m);if(N>=0)return{row:b[S],idx:N}}return null}function ue(m){if(m===p&&Je(f,p)){let b=he(p);w={row:b.row,idx:b.idx},x();return}Je(f,m)||(w=w&&w.bench===m?null:{bench:m},x())}function ie(m){let b=m.split(":")[0],S=+m.split(":")[1];if(!w){f[b][S]&&(w={row:b,idx:S}),x();return}let N=Q(w,b,S);w=null,N&&O(),x()}function ee(m){let b=m.split(":")[0],S=+m.split(":")[1],N=X({row:b,idx:S});w=null,N&&O(),x()}function te(m){let b=m.split(":");return{row:b[0],idx:+b[1]}}function ne(){for(let m of t.querySelectorAll(".drop-ok"))m.classList.remove("drop-ok")}function ve(){for(let b of t.querySelectorAll("[data-slot].filled"))b.setAttribute("draggable","true"),b.addEventListener("dragstart",function(S){if(w=null,_=te(this.dataset.slot),S.dataTransfer){S.dataTransfer.effectAllowed="move";try{S.dataTransfer.setData("text/plain",this.dataset.slot)}catch{}}}),b.addEventListener("dragend",function(){_=null,ne()});for(let b of t.querySelectorAll("[data-slot]"))b.addEventListener("dragover",function(S){_&&(S.preventDefault(),this.classList.add("drop-ok"))}),b.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),b.addEventListener("drop",function(S){if(S.preventDefault(),!_){ne();return}let N=te(this.dataset.slot),U=Q(_,N.row,N.idx);_=null,U&&O(),x()});for(let b of t.querySelectorAll("[data-pick]")){let S=b.dataset.pick;S!==p&&!Je(f,S)&&(b.setAttribute("draggable","true"),b.addEventListener("dragstart",function(N){if(w=null,_={bench:this.dataset.pick},N.dataTransfer){N.dataTransfer.effectAllowed="copy";try{N.dataTransfer.setData("text/plain",this.dataset.pick)}catch{}}}),b.addEventListener("dragend",function(){_=null,ne()}))}let m=t.querySelector(".picker");m&&!m._fmDrop&&(m._fmDrop=!0,m.addEventListener("dragover",function(b){_&&!_.bench&&(b.preventDefault(),this.classList.add("drop-ok"))}),m.addEventListener("dragleave",function(){this.classList.remove("drop-ok")}),m.addEventListener("drop",function(b){if(b.preventDefault(),this.classList.remove("drop-ok"),_&&!_.bench){let S=X(_);_=null,S&&O(),x()}}))}function Z(m){n.length<=1||(n.splice(m,1),u>=n.length?u=n.length-1:m<u&&u--,V(u),j())}function x(){let m=t.querySelector('[data-row="front"]'),b=t.querySelector('[data-row="back"]');m&&(m.innerHTML=mt(h,f,w,"front")),b&&(b.innerHTML=mt(h,f,w,"back")),R&&(R.innerHTML=ms(h,f,w,E)),T&&(T.textContent=bs(h,f)+" available"),I&&(I.innerHTML=ys(h,f,n,u,A)),G&&(G.disabled=!A);for(let S of t.querySelectorAll("[data-slot]"))S.addEventListener("click",function(){ie(this.dataset.slot)});for(let S of t.querySelectorAll("[data-remove]"))S.addEventListener("click",function(N){N.stopPropagation(),ee(this.dataset.remove)});for(let S of t.querySelectorAll("[data-pick]"))S.addEventListener("click",function(){ue(this.dataset.pick)});for(let S of t.querySelectorAll("[data-preset]"))S.addEventListener("click",function(N){N.target.closest&&(N.target.closest("[data-del]")||N.target.closest("[data-name]"))||(V(+this.dataset.preset),j())});for(let S of t.querySelectorAll("[data-del]"))S.addEventListener("click",function(N){N.stopPropagation(),Z(+this.dataset.del)});for(let S of t.querySelectorAll("[data-name]"))S.addEventListener("click",function(N){N.stopPropagation(),this.setAttribute("contenteditable","true"),this.focus()}),S.addEventListener("blur",function(){this.removeAttribute("contenteditable"),n[+this.dataset.name].name=(this.textContent||"").trim().slice(0,40)||"Team",x(),j()}),S.addEventListener("keydown",function(N){N.key==="Enter"&&(N.preventDefault(),this.blur())});ve()}G&&G.addEventListener("click",function(){A&&(n[u].board={front:f.front.slice(),back:f.back.slice()},A=!1,x(),j())});let g=t.querySelector("[data-saveas]");g&&g.addEventListener("click",function(){n.push({name:"Team "+(n.length+1),board:{front:f.front.slice(),back:f.back.slice()}}),V(n.length-1),j()});for(let m of t.querySelectorAll("[data-rar]"))m.addEventListener("click",function(){E=this.dataset.rar;for(let b of t.querySelectorAll("[data-rar]"))b.setAttribute("aria-pressed",String(b.dataset.rar===E));x()});return x(),()=>{}}var Mi={Tank:"T",Warrior:"W",Mage:"M",Support:"S",Assassin:"A"},zi='<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#cb-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',Oi={fire:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5.2A6 6 0 0 1 6 14c0-4.5 4.5-6.5 6-12Z"/></svg>',water:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3c4 5.2 6 8.2 6 11.2A6 6 0 0 1 6 14.2c0-3 2-6 6-11.2Z"/></svg>',wind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 18h8"/></svg>',earth:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 21 9 12 21 3 9Z"/></svg>',light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>',dark:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 3a9 9 0 1 0 5.5 15.5A7 7 0 0 1 15.5 3Z"/></svg>'};function we(t){return String(t??"").replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e])}function Ss(t){return String(t||"").split(",")[0]}function Di(t){return String(t||"").toLowerCase()}var Es=`
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
`,Pi='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="cb-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.14"/></linearGradient></defs></svg>';function Hi(t,e){let a=Di(t.affinity);return'<div class="cbt'+(e?" enemy":"")+'" data-id="'+we(t.id)+'" data-aff="'+a+'" style="--aff:var(--'+a+')"><div class="fx" data-fx></div><div class="ava">'+(t.portrait?'<img class="ava-photo" src="'+we(t.portrait)+'" alt="" loading="lazy">':zi)+'<span class="role">'+(Mi[t.role]||"?")+'</span><span class="aff-badge" title="'+a+'">'+(Oi[a]||"")+'</span></div><div class="bars"><div class="hp"><i style="width:100%"></i></div><span class="hpn"></span><div class="en"><i></i></div></div><div class="nm">'+we(Ss(t.name))+"</div></div>"}function ks(t,e){let a=t.filter(o=>(o.position||"front")==="front"),r=t.filter(o=>o.position==="back"),s=(o,i)=>o.length?'<div class="row '+i+'">'+o.map(c=>Hi(c,e)).join("")+"</div>":"";return e?s(r,"back")+s(a,"front"):s(a,"front")+s(r,"back")}function _s(t,e){return'<div class="arena"><div class="side enemies" data-side-enemies>'+ks(e,!0)+'</div><div class="midline"></div><div class="side allies" data-side-allies>'+ks(t,!1)+"</div></div>"}function $i(t){let e=Array.isArray(t&&t.presets)?t.presets:[];if(e.length<=1)return"";let a=typeof t.activePreset=="number"?t.activePreset:0;return'<div class="cbt-presets" data-cbt-presets><span class="lab">Team</span>'+e.map(r=>'<button class="cbt-preset" type="button" data-preset-pick="'+r.index+'"'+(r.index===a?' aria-pressed="true"':"")+'><span class="nm">'+we(Ss(r.name))+'</span><span class="cp">'+(Number(r.cp)||0).toLocaleString("en-US")+"</span></button>").join("")+"</div>"}function Ts({phase:t="loading",payload:e=null,node:a=null,result:r=null,vigor:s=null,error:o=""}={}){let i=a&&a.title||"Combat",c;if(t==="prebattle"&&e)c=_s(e.allies||[],e.enemies||[])+'<div class="veil"></div><div class="head"><button class="back" type="button" data-back>&#9664; Chapter</button><div class="head-id"><div class="eyebrow">Combat</div><h2>'+we(i)+'</h2></div></div><div class="briefing"><div class="brief-scroll"><span class="brief-kicker">Objective</span>'+(e.opening?'<p class="brief-open">'+we(e.opening)+"</p>":"")+'<p class="brief-obj">'+we(e.objective||"Defeat the enemy formation.")+'</p></div><div class="brief-meta">'+(a&&a.chapter?"<span>Chapter <b>"+we(String(a.chapter))+"</b></span>":"")+"<span>Your team <b>"+(e.allies||[]).length+"</b></span><span>Enemies <b>"+(e.enemies||[]).length+"</b></span></div>"+$i(e)+(s&&Number.isFinite(s.cost)?'<button class="fstart" type="button" data-start'+(s.have>=s.cost?"":" disabled")+">Start battle &raquo; <b>"+s.cost+" Vigor</b></button>"+(s.have>=s.cost?'<div class="vig-note">'+s.have+" Vigor left</div>":'<div class="vig-note short">Not enough Vigor &mdash; '+s.have+" of "+s.cost+(s.nextMs?", +1 in "+Math.max(1,Math.ceil(s.nextMs/6e4))+"m":"")+"</div>"):'<button class="fstart" type="button" data-start>Start battle &raquo;</button>')+"</div>";else if(t==="battle"&&e)c=_s(e.allies||[],e.enemies||[])+'<div class="cbar"><button class="back" type="button" data-back>&#9664; Retreat</button><div class="wave-id"><small>'+we(i)+'</small>Auto-battle</div><div class="ctrls"><button type="button" data-play aria-pressed="true">&#10074;&#10074; Pause</button><button type="button" data-speed aria-pressed="false">&times;1</button><button type="button" data-skip>Skip &raquo;</button></div></div><div class="abanner" data-abanner><span class="big"></span><span class="sub"></span></div>';else if(t==="error"){let d=o==="empty-party";c='<div class="cb-msg"><div class="box"><span class="t">'+(d?"This team has no units. Seat at least one in Formation.":"Couldn't set up the battle.")+"</span>"+(d?"":'<button class="retry" type="button" data-retry>Retry</button>')+'<button class="retry" type="button" data-back style="background:transparent;border-color:var(--steel);color:var(--text)">Back</button></div></div>'}else c='<div class="cb-msg"><div class="box"><span class="t">Preparing the battle\u2026</span></div></div>';return'<div class="root">'+Pi+'<section class="screen">'+c+"</section></div>"}function As(t,{phase:e,steps:a=[],result:r=null,onStart:s,onBack:o,onFinished:i,onRetry:c,onPickPreset:d}={}){let h=t.querySelector("[data-back]");h&&h.addEventListener("click",()=>o&&o());for(let x of t.querySelectorAll("[data-preset-pick]"))x.addEventListener("click",function(){d&&d(+this.dataset.presetPick)});let p=t.querySelector("[data-retry]");p&&p.addEventListener("click",()=>c&&c());let n=t.querySelector("[data-start]");if(n&&n.addEventListener("click",()=>s&&s()),e!=="battle")return()=>{};let u=1.9,f=null,w=0,E=!1,A=1,_=x=>t.querySelector('.cbt[data-id="'+String(x).replace(/"/g,"")+'"]'),T=t.querySelector("[data-abanner]");function R(x,g,m,b){let S=_(x);if(!S)return;let N=S.querySelector(".hp > i");N&&(N.style.width=Math.max(0,g)+"%");let U=S.querySelector(".hpn");U&&Number.isFinite(m)&&Number.isFinite(b)&&(U.textContent=Math.max(0,m).toLocaleString("en-US")+" / "+b.toLocaleString("en-US")),g<=0?(S.classList.add("dead"),S.classList.remove("charged")):S.classList.remove("dead")}function I(x,g){let m=_(x);if(!m)return;let b=m.querySelector(".en > i");b&&(b.style.width=Math.min(100,g)+"%"),m.classList.toggle("charged",g>=100&&!m.classList.contains("dead"))}function G(x,g,m){let b=_(x);if(!b)return;let S=b.querySelector("[data-fx]");if(!S)return;let N=document.createElement("div");N.className="vfx "+g,m&&N.style.setProperty("--fxc",m),S.appendChild(N),setTimeout(()=>{N.parentNode&&N.parentNode.removeChild(N)},1e3/A)}function M(x,g,m,b){let S=_(x);if(!S)return;let N=S.querySelector("[data-fx]");if(!N)return;let U=document.createElement("span");U.className="dmg "+m,b?U.innerHTML=we(g)+'<b class="eff '+b.toLowerCase()+'">'+b+(b==="STRONG"?" \xD71.5":" \xD70.75")+"</b>":U.textContent=g,N.appendChild(U),setTimeout(()=>{U.parentNode&&U.parentNode.removeChild(U)},1100/A)}function j(x){let g=_(x);g&&(g.classList.add("acting"),setTimeout(()=>g.classList.remove("acting"),520/A))}function O(x){let g=_(x);g&&(g.classList.add("hit"),setTimeout(()=>g.classList.remove("hit"),340/A))}function V(x,g){T&&(T.querySelector(".big").textContent=x,T.querySelector(".sub").textContent=g||"",T.classList.remove("show"),T.offsetWidth,T.classList.add("show"))}function Q(x,g){let m=t.querySelector(x==="enemies"?"[data-side-enemies]":"[data-side-allies]");if(!m)return;let b=document.createElement("div");b.className="vfx wave",b.style.cssText="left:12%;top:20%;width:76%;height:60%;--fxc:"+g,m.style.position="relative",m.appendChild(b),setTimeout(()=>{b.parentNode&&b.parentNode.removeChild(b)},700/A)}function X(x,g){switch(x.op){case"start":g&&V("Battle start","Affinity rules every hit");break;case"act":g&&j(x.id);break;case"ult":g&&(j(x.id),V(x.name,x.sub));break;case"hit":g&&(O(x.id),G(x.id,"hit"),G(x.id,"slash","#fff"),M(x.id,"-"+x.amount+(x.crit?"!":""),"d"+(x.crit?" crit":""),x.effLabel||"")),R(x.id,x.hpPct,x.hp,x.hpMax);break;case"heal":g&&(G(x.id,"heal"),M(x.id,"+"+x.amount,"h")),R(x.id,x.hpPct,x.hp,x.hpMax);break;case"energy":I(x.id,x.pct);break;case"hp":R(x.id,x.pct,x.hp,x.hpMax);break;case"shieldFx":if(g)for(let m of x.ids||[])G(m,"shield");break;case"buff":g&&(G(x.id,"buff"),M(x.id,x.text,"b"));break;case"debuff":g&&(G(x.id,"debuff"),M(x.id,x.text,"f"));break;case"stun":g&&G(x.id,"stun");break;case"aoe":g&&Q(x.side,x.color);break;case"death":{let m=_(x.id);m&&m.classList.add("dead");break}case"revive":{let m=_(x.id);m&&m.classList.remove("dead"),g&&(G(x.id,"heal"),M(x.id,"REVIVE","b"));break}case"end":ue(x.result);break;default:break}}let he=!1;function ue(x){he||(he=!0,i&&i(x==="lose"?"lose":"win"))}function ie(){let x=a[w++];for(let g of x.events)X(g,!0)}function ee(){if(E||w>=a.length)return;let x=a[w];ie(),f=setTimeout(ee,(x.d||500)*u/A)}function te(){for(clearTimeout(f);w<a.length;){let x=a[w++];for(let g of x.events)X(g,!1)}}let ne=t.querySelector("[data-play]");ne&&ne.addEventListener("click",function(){E=!E,this.setAttribute("aria-pressed",String(!E)),this.innerHTML=E?"&#9654; Play":"&#10074;&#10074; Pause",E?clearTimeout(f):ee()});let ve=t.querySelector("[data-speed]");ve&&ve.addEventListener("click",function(){A=A===1?2:A===2?3:1,this.setAttribute("aria-pressed",String(A>1)),this.innerHTML="&times;"+A});let Z=t.querySelector("[data-skip]");return Z&&Z.addEventListener("click",()=>{te()}),r?te():ee(),()=>{clearTimeout(f)}}function Yt(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var Ns=`
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
`;function Cs({runs:t,activeRunId:e}){return`
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
    <div class="rn-list">${(Array.isArray(t)?t:[]).map(s=>{let o=Yt(s.runId),i=s.runId===e,c=s.name&&String(s.name).trim()?s.name:"Untitled run",d=i?'<span class="rn-badge">Active</span>':"",h=i?`<button class="rn-go" type="button" data-go="${o}">Continue</button>`:`<button class="rn-go switch" type="button" data-go="${o}">Switch</button>`;return`<article class="rn-run${i?" active":""}">`+d+`<div class="rn-info"><div class="rn-name">${Yt(c)}</div><p class="rn-scn">${Yt(s.scenario)}</p></div><div class="rn-actions">`+h+`<button class="rn-del" type="button">Delete</button><span class="rn-confirm"><button class="rn-yes" type="button" data-del="${o}">Delete</button><button class="rn-no" type="button">Cancel</button></span></div></article>`}).join("")||'<p class="rn-empty">No runs yet.</p>'}</div>
    <button class="rn-back" type="button" data-back>&#9664; Back to the game</button>
  </div>
</div>`}function Rs(t,{onNew:e,onSwitch:a,onDelete:r,onBack:s}){t.querySelector("[data-new]")?.addEventListener("click",()=>e&&e()),t.querySelector("[data-back]")?.addEventListener("click",()=>s&&s());for(let o of t.querySelectorAll("[data-go]"))o.addEventListener("click",()=>a&&a(o.getAttribute("data-go")));for(let o of t.querySelectorAll(".rn-del"))o.addEventListener("click",()=>o.closest(".rn-run")?.classList.add("confirming"));for(let o of t.querySelectorAll(".rn-no"))o.addEventListener("click",()=>o.closest(".rn-run")?.classList.remove("confirming"));for(let o of t.querySelectorAll("[data-del]"))o.addEventListener("click",()=>r&&r(o.getAttribute("data-del")))}var Ls="marinara-capability-gacha-forge",qi=900,ji=new Set(["boot","banner","art","forge"]),Ui={busy:"Another portrait for this unit is still on its way. Give it a moment.","no-image-connection":"This world has no image connection \u2014 pick one in settings > Style.","engine-unreachable":"Could not reach the image service.","generation-failed":"The image backend refused this prompt. Shorter tags usually help.","upload-failed":"The gallery would not take that image.","bad-image":"That is not an image the gallery accepts (PNG, JPEG, WebP, GIF or AVIF).","too-large":"That image is too big to send. Crop it smaller or save it at a lower quality.","not-in-history":"That portrait is not kept any more.","not-allowed":"This unit's portrait is not ours to repaint.","not-found":"This unit is gone.","bad-request":"Something was missing from that request."},Xt="/api/gacha-forge",Bs=`.gf-boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0E1420;color:#7E93AE;font-family:"Bahnschrift","Segoe UI",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem}.gf-boot::before{content:'';width:.6rem;height:.6rem;background:#F2603C;transform:rotate(45deg);margin-right:.6rem;animation:gf-boot-blink .9s steps(2) infinite}@keyframes gf-boot-blink{50%{opacity:.2}}.gf-boot-bad{flex-direction:column;gap:.8rem;color:#C7D3E2;text-transform:none;letter-spacing:.04em;font-size:.85rem;text-align:center;padding:1.2rem}.gf-boot-bad::before{display:none}.gf-boot-bad button{cursor:pointer;font:inherit;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;border:1px solid #F2603C;background:#F2603C;color:#10151F}`,Kt=class extends HTMLElement{constructor(){super(),this._root=this.attachShadow({mode:"open"}),this._props={},this._onPropsChange=()=>this._apply(),this._initState()}_initState(){this._drawnView=null,this._renderKey=null,this._boot="idle",this._bootError="",this._pick=null,this._pickOptions=null,this._runs=[],this._activeRunId=null,this._run=null,this._showRuns=!1,this._creatingNew=!1,this._bannerReady=!1,this._bannerState="idle",this._wallet=null,this._rosterCount=0,this._artReady=!0,this._artState="idle",this._art={done:0,total:0,name:""},this._artBlocking=!1,this._planChapter=1,this._forgeCleanup=null,this._roster=null,this._rosterState="idle",this._rosterCat="char",this._rosterRarity="all",this._rosterQuery="",this._rosterUnitId=null,this._unit=null,this._farmBusy=!1,this._farm=null,this._farmState="idle",this._farmView="root",this._farmRev=0,this._result=null,this._resultRev=0,this._busyLocal=new Map,this._busySeq=0,this._growth=null,this._growthRev=0,this._feed=null,this._unitLevel=1,this._unitBond=0,this._unitState="idle",this._unitTab="profile",this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev=0,this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._summonResults=null,this._summonWallet=null,this._summonCleanup=null,this._formation=null,this._formationState="idle",this._formationBattleMode=!1,this._pendingCombat=null,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._combatNode=null,this._combatPreset=null,this._combatError="",this._combatStarting=!1,this._combatVigorError=null,this._battleLoading=!1,this._combatCleanup=null,this._hudView="home",this._beatState="idle",this._beatCleanup=null,this._settingsCategory=ze,this._settingsFrom="home",this._settingsRev=0}get capabilityProps(){return this._props}set capabilityProps(e){this._props=e&&typeof e=="object"?e:{},this._boot==="ready"&&this._refreshState(),this._apply()}static get observedAttributes(){return["view"]}attributeChangedCallback(){this._apply()}connectedCallback(){this.addEventListener("marinara-capability-props",this._onPropsChange),this._boot==="ready"&&this._resync(),this._apply()}disconnectedCallback(){this.removeEventListener("marinara-capability-props",this._onPropsChange),this._stopForge(),this._stopBeat(),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null)}_reportError(e){let a=e instanceof Error?e.message:String(e);this.capabilityRuntimeError=a,this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:a}}))}_apply(){try{(this.getAttribute("view")||"browser")==="browser"?this._renderBrowser():this._root.innerHTML=""}catch(e){this._reportError(e)}}_state(){return this._boot!=="ready"?"boot":this._showRuns?"runs":this._bootError&&!this._creatingNew?"unreachable":this._creatingNew||!this._run?"setup":this._bannerReady?!this._artReady&&this._artBlocking?"art":this._hudView==="roster"?this._rosterUnitId?"unit":"roster":this._hudView==="summon"?"summon":this._hudView==="formation"?"formation":this._hudView==="combat"?"combat":this._hudView==="modes"?"modes":this._hudView==="farm"?"farm":this._hudView==="settings"?"settings":this._hudView==="result"&&this._result?"result":"hud":"banner"}_onLoaderScreen(e){return ji.has(e)?!0:e==="beat"?this._beatState!=="ready":e==="combat"?this._combatPhase==="loading":!1}_decorKey(){let e=this._run&&this._run.decor||null;return e?JSON.stringify(e):""}_pickKey(){return this._pick?[this._pick.slot,this._pick.source,this._pickOptions?"1":"0"].join("/"):""}_syncTypeScale(){let e=Ie(this._run&&this._run.textScale);this._typeScale!==e&&(this._typeScale=e,this.style&&typeof this.style.setProperty=="function"&&this.style.setProperty("--gf-type-scale",String(e)))}async _setTextScale(e){if(!this._run)return;let a=Ie(e),r=this._run.textScale;if(Ie(r)===a)return;this._run.textScale=a,this._renderBrowser();let s=await this._postJson("/run/text-scale",{runId:this._run.runId,textScale:a});(!s||!s.ok)&&(this._run.textScale=r,this._renderBrowser())}_renderBrowser(){this._syncTypeScale();let e=this._state();this._persistNav();let a=e==="runs"?`runs:${this._runs.length}:${this._activeRunId}`:e==="setup"?`setup:${this._creatingNew?"new":"first"}`:e==="banner"?`banner:${this._bannerState==="error"?"error":"loading"}`:e==="art"?`art:${this._artState}:${this._art.done}/${this._art.total}:${this._art.name}`:e==="modes"?"modes":e==="roster"?`roster:${this._rosterState}:${this._rosterCat}:${this._rosterRarity}:${this._rosterQuery}:${this._roster?this._roster.length:0}`:e==="summon"?`summon:${this._summonPhase}:${this._summonBannerId}:${this._summonBannerState}:${this._summonDetails?"d":""}:${this._summonArting?"a":""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.title||""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.art||""}`:e==="formation"?`formation:${this._formationState}:${this._formationBattleMode?"battle":"hud"}`:e==="combat"?`combat:${this._combatPhase}:${this._combatNonce||0}`:e==="farm"?`farm:${this._farmView}:${this._farmState}:${this._farmRev}`:e==="result"?`result:${this._resultRev}`:e==="unit"?`unit:${this._rosterUnitId}:${this._unitState}:${this._unitTab}:${this._growthRev}:${this._feed?Object.values(this._feed).join(","):""}:${this._portraitOpen?"pt":""}${this._portraitCrop?":crop":""}:${this._portraitRev}:${this._portraitBusy?"busy":""}:${this._portraitError?"err":""}`:e==="settings"?`set:${this._settingsCategory}:${this._run.hudStyle||""}:${this._settingsRev}`:e==="hud"?`hud:${this._run.hudStyle||""}:${this._decorKey()}:${this._pickKey()}`:e,r=this._onLoaderScreen(e)?[]:this._busyTasks(),s=a+"|ts:"+(this._typeScale||1)+"|busy:"+Jr(r);if(this._syncBar(),this._drawnView==="browser"&&this._renderKey===s)return;let o=this._lastScreen!==e,i=!o&&this._drawnView==="browser";this._lastScreen=e,this._drawnView="browser",this._renderKey=s,this._stopForge(),this._stopBeat(),this._stopSummon(),this._stopCombat();let c="";if(e==="boot")c=`<style>${Bs}</style><div class="gf-boot">Loading</div>`;else if(e==="unreachable"){let n=String(this._bootError||"").replace(/[&<>"]/g,u=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[u]);c=`<style>${Bs}</style><div class="gf-boot gf-boot-bad"><span>Couldn&rsquo;t reach the game server &mdash; ${n}</span><button type="button" data-boot-retry>Retry</button></div>`}else if(e==="runs")c=`<style>${Ns}</style>${Cs({runs:this._runs,activeRunId:this._activeRunId})}`;else if(e==="setup")c=`<style>${xa}</style>${_a({cancelable:this._creatingNew})}`;else if(e==="banner")c=`<style>${Et}</style>${Tt({scenario:this._run.scenario,mode:"banner",error:this._bannerState==="error"})}`;else if(e==="art")c=`<style>${Et}</style>${Tt({scenario:this._run.scenario,mode:"art",error:this._artState==="blocked",art:this._art})}`;else if(e==="roster")c=`<style>${It}</style>${kr({cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,state:this._rosterState,q:this._rosterQuery})}`;else if(e==="unit")this._portraitOpen?c=`<style>${Nr}</style>${Cr({unit:this._unit,view:this._portraitCrop?"crop":"edit",draft:this._portraitDraft,history:this._portrait&&this._portrait.strip||[],historyMax:this._portrait&&this._portrait.historyMax||0,busy:this._portraitBusy,error:this._portraitError,crop:this._portraitCrop,promptName:this._portrait&&this._portrait.promptName||""})}`:c=`<style>${It}</style>${Er({unit:this._unit,level:this._unit?this._unitLevel:1,bond:this._unit?this._unitBond:0,tab:this._unitTab,state:this._unitState,growth:this._growthView()})}`;else if(e==="summon")if(this._summonPhase==="reveal")c=`<style>${Wt}</style>${os({results:this._summonResults||[]})}`;else{let n=this._summonBanner;c=`<style>${Wt}</style>${ss({banners:n&&n.banners||[],banner:n&&n.banner,rates:n&&n.rates,pity:n&&n.pity,wallet:n&&n.wallet||this._wallet,cost:n&&n.cost||160,bannerId:this._summonBannerId,state:this._summonBannerState,details:this._summonDetails,arting:this._summonArting})}`}else e==="formation"?c=`<style>${ds}</style>${ws({state:this._formationState==="ready"?"ready":this._formationState==="error"?"error":"loading",data:this._formation,battleMode:this._formationBattleMode})}`:e==="combat"?c=`<style>${Es}</style>${Ts({phase:this._combatPhase,payload:this._combat,node:this._combatNode,vigor:this._vigorView(),error:this._combatError||""})}`:e==="modes"?c=`<style>${Lr}</style>${Br({story:{hasPlan:!1,title:"",premise:"",chapterLabel:"",done:0,total:10}})}`:e==="farm"?c=`<style>${zr}</style>${Or({view:this._farmView,data:this._farm,state:this._farmState})}`:e==="result"?c=`<style>${Vr}</style>${Wr(this._result||{})}`:e==="settings"?c=`<style>${Ca}</style>${Aa({category:this._settingsCategory,backLabel:this._settingsBackLabel(),hudStyle:this._run.hudStyle,textScale:this._run.textScale,tokenLog:this._tokenLog,loreStatus:this._loreStatus,run:this._run})}`:c=`<style>${ea}</style>${va({decor:this._run.decor,pick:this._pick,pickOptions:this._pickOptions})}`;let d=e==="combat"&&this._combatPhase!=="prebattle",h=!!this._run&&!d&&ra.has(e),p=h?ia({username:this._run.username,wallet:this._wallet,account:this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:null}):"";this._root.innerHTML=`<style>${da}${Qr}${pa}</style>`+ha(c+es(r),{runs:!!this._run&&e!=="runs",style:this._run&&this._run.hudStyle,entering:o,swapping:i,bar:p,tokens:this._tokenTotals}),h&&ca(this._root),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null),h&&(this._stopVigorClock=la(this._root,{nextMs:this._wallet?this._wallet.vigorNextMs:null,periodMs:this._wallet&&this._wallet.vigorPerMs||this._run&&this._run.vigorPerMs,onLanded:()=>this._refreshState&&this._refreshState()})),Na(this._root,{open:e==="settings",category:this._settingsCategory,run:this._run,onOpen:n=>this._openSettings(n),onBack:()=>this._leaveSettings(),onCategory:n=>this._openSettings(n),onStyle:n=>this._setHudStyle(n),onTextScale:n=>this._setTextScale(n),onSources:n=>this._setSources(n)}),this._wireFullscreen(),this._wireRunsButton();{let n=this._root.querySelector("[data-boot-retry]");n&&n.addEventListener("click",()=>{this._boot="idle",this._loadState(),this._renderBrowser()})}if(e==="runs")this._wireRuns();else if(e==="setup")Ea(this._root,{onCreate:n=>this._createRun(n),onCancel:()=>{this._creatingNew=!1,this._renderBrowser()}});else if(e==="banner"){let n=this._bannerState==="error";this._forgeCleanup=At(this._root,{cycle:!n,phases:St,onRetry:()=>this._loadStandardBanner()}),this._bannerState==="idle"&&this._loadStandardBanner()}else e==="art"?(this._forgeCleanup=At(this._root,{cycle:!1,onRetry:()=>this._finishArt()}),this._ensureArtRunning()):e==="roster"?(Tr(this._root,{onOpenUnit:n=>this._openUnit(n),onBack:()=>{this._hudView="home",this._renderBrowser()},onCat:n=>{this._rosterCat=n==="wpn"?"wpn":"char",this._rosterRarity="all",this._rosterQuery="",this._renderBrowser()},onRarity:n=>{this._rosterRarity=n,this._renderBrowser()},onSearch:n=>{this._rosterQuery=n,xr(this._root,{cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,q:n,state:this._rosterState})}}),this._rosterState==="idle"&&this._loadRoster()):e==="unit"&&this._portraitOpen?Rr(this._root,{onBack:()=>this._portraitClose(),onDraft:n=>this._portraitEdit(n),onGenerate:()=>this._portraitGenerate(),onPick:n=>this._portraitPick(n),onFile:n=>this._portraitFile(n),onCropSize:n=>this._portraitSize(n),onCropFrame:n=>this._portraitDrag(n),onCropOk:()=>this._portraitUpload(),onCropCancel:()=>{this._portraitCrop=null,this._renderBrowser()}}):e==="unit"?(Ar(this._root,{onTab:n=>{this._unitTab=n,this._renderBrowser()},onBack:()=>{this._rosterUnitId=null,this._unit=null,this._unitState="idle",this._renderBrowser()},onPortrait:()=>this._portraitOpenStudio(),onSetParty:()=>this._openFormation(),onFeed:n=>this._feedAdd(n),onFeedReset:()=>this._feedReset(),onFeedGo:()=>this._feedCommit(),onAscend:()=>this._ascend()}),this._unitState==="idle"&&this._loadUnit()):e==="summon"?this._summonPhase==="reveal"?this._summonCleanup=ns(this._root,{results:this._summonResults||[],onContinue:()=>{this._summonPhase="banner",this._renderBrowser()}}):(is(this._root,{banners:this._summonBanner&&this._summonBanner.banners||[],onBanner:n=>{n!==this._summonBannerId&&(this._summonBannerId=n,this._summonDetails=!1,this._summonArting=!1,this._summonBannerState="idle",this._summonBanner=null,this._renderBrowser())},onDetails:n=>{this._summonDetails=!!n,this._renderBrowser()},onRedoArt:()=>this._redoBannerArt(),onPull:n=>this._summonPull(n),onBack:()=>{this._hudView="home",this._renderBrowser()}}),this._summonBannerState==="idle"&&this._loadSummonBanner()):e==="formation"?(xs(this._root,{data:this._formationState==="ready"?this._formation:null,onSave:(n,u)=>this._saveFormation(n,u),onBack:()=>{this._formationBattleMode?(this._formationBattleMode=!1,this._pendingCombat=null,this._farmBusy=!1,this._pendingFarm=null,this._hudView="farm"):this._hudView="home",this._renderBrowser()},onIntoBattle:()=>this._enterBattle(),onRetry:()=>this._loadFormation()}),this._formationState==="idle"&&this._loadFormation()):e==="combat"?(this._combatCleanup=As(this._root,{phase:this._combatPhase,steps:this._combatSteps||[],onStart:()=>this._startBattle(),onPickPreset:n=>this._pickCombatPreset(n),onRetry:()=>this._loadBattle(),onBack:()=>this._exitCombat(!1),onFinished:n=>this._combatFinished(n)}),this._combatPhase==="loading"&&this._loadBattle()):e==="modes"?Fr(this._root,{onPick:n=>{n==="materials"&&this._openFarm()},onBack:()=>{this._hudView="home",this._renderBrowser()}}):e==="farm"?(Dr(this._root,{onBack:()=>{if(this._farmView!=="root"){this._farmView="root",this._renderBrowser();return}this._hudView="modes",this._renderBrowser()},onOpen:n=>{this._farmView=n==="form"?"form":"asc",this._renderBrowser()},onRun:n=>this._farmRun(n)}),this._farmState==="idle"&&this._loadFarm()):e==="result"?Yr(this._root,{onContinue:()=>this._closeResult(),onAgain:()=>this._resultAgain()}):e==="hud"&&ga(this._root,{onOpenRoster:()=>this._openRoster(),onOpenSummon:()=>this._openSummon(),onOpenModes:()=>{this._hudView="modes",this._renderBrowser()},onOpenFormation:()=>this._openFormation(),onPickOpen:n=>this._openPick(n),onPickClose:()=>this._closePick(),onPickSource:n=>this._pickSource(n),onPickTake:n=>this._takePick(n)});this._boot==="idle"&&this._loadState(),this._ensureArtRunning()}async _setHudStyle(e){if(!this._run||!this._run.runId)return;let a=this._run.hudStyle;this._run.hudStyle=e,this._renderBrowser();let r=await this._postJson("/run/style",{runId:this._run.runId,hudStyle:e});r&&r.ok||(this._run.hudStyle=a,this._renderBrowser())}_wireFullscreen(){let e=()=>{document.fullscreenElement?document.exitFullscreen?.():this.requestFullscreen?.()};for(let a of[".gf-fs",".gf-fs-exit",".gf-fs-bar"]){let r=this._root.querySelector(a);r&&r.addEventListener("click",e)}this._wireLandscape()}_wireLandscape(){let e=this._root.querySelector("[data-go-landscape]");e&&e.addEventListener("click",async()=>{try{!document.fullscreenElement&&this.requestFullscreen&&await this.requestFullscreen()}catch{}let a=typeof screen<"u"?screen.orientation:null;if(!a||typeof a.lock!="function"){this._landscapeFallback();return}try{await a.lock("landscape")}catch{this._landscapeFallback()}})}_landscapeFallback(){let e=this._root.querySelector("[data-rot-title]"),a=this._root.querySelector("[data-rot-note]");e&&(e.textContent="Turn your phone"),a&&(a.textContent="This game plays in a 16:9 landscape frame. Your browser cannot rotate it for you.")}_wireRunsButton(){let e=[];for(let a of["[data-open-runs]",".gf-runs-bar"]){let r=this._root.querySelector(a);!r||e.indexOf(r)>=0||(e.push(r),r.addEventListener("click",()=>{this._showRuns=!0,this._renderBrowser()}))}}_adoptRun(e){this._stopSummon(),this._stopCombat();let a={_boot:this._boot,_bootError:this._bootError,_runs:this._runs,_activeRunId:this._activeRunId,_busyLocal:this._busyLocal,_busySeq:this._busySeq,_tokenTotals:this._tokenTotals};this._initState(),Object.assign(this,a),this._run=e||null,this._activeRunId=e?e.runId:null,this._creatingNew=!1,this._planChapter=1,this._hudView="home",this._bannerReady=!!(e&&e.hasStandardBanner),this._artReady=!(e&&Number(e.artPending)>0),this._wallet=e&&e.wallet||null,this._rosterCount=e&&Number(e.rosterCount)||0}_adoptGlobals(e){}_loadState(){this._boot="loading",this._bootError="",pe(`${Xt}/state`).then(e=>{if(!e)throw new Error("no response");if(!e.ok)throw new Error("HTTP "+e.status);return typeof e.json=="function"?e.json():null}).then(e=>{this._runs=e&&Array.isArray(e.runs)?e.runs:[],this._activeRunId=e&&e.activeRunId||null,this._run=e&&e.activeRun||null,this._adoptGlobals(e),this._run&&Number.isFinite(Number(this._run.contextTokens)),this._bannerReady=!!(this._run&&this._run.hasStandardBanner),this._artReady=!(this._run&&Number(this._run.artPending)>0),this._wallet=this._run&&this._run.wallet||null,this._rosterCount=this._run&&Number(this._run.rosterCount)||0}).catch(e=>{this._run=null,this._bootError=String(e&&e.message||"unreachable")}).then(()=>{this._run&&(this._restoreNav(),this._reconcileGenerating({boot:!0})),this._boot="ready",this._renderBrowser()})}_navKey(){return`gacha-forge:nav:${this._run?this._run.runId:"none"}`}_persistNav(){if(!(!this._run||this._boot!=="ready"))try{if(typeof localStorage>"u")return;localStorage.setItem(this._navKey(),JSON.stringify({v:this._hudView,ch:this._planChapter,combat:this._combatNode}))}catch{}}_restoreNav(){let e=null;try{if(typeof localStorage>"u")return;let a=localStorage.getItem(this._navKey());a&&(e=JSON.parse(a))}catch{return}!e||typeof e!="object"||(Number.isInteger(e.ch)&&e.ch>=1&&(this._planChapter=e.ch),["roster","summon","formation","combat","farm","settings"].includes(e.v)&&(this._hudView=e.v),e.v==="combat"&&e.combat&&e.combat.farm&&typeof e.combat.stage=="string"&&(this._combatNode=e.combat,this._combatPhase="loading"))}_resync(){this._renderKey=null,this._bannerState==="loading"&&(this._bannerState="idle"),this._summonBannerState==="loading"&&(this._summonBannerState="idle"),this._formationState==="loading"&&(this._formationState="idle"),this._rosterState==="loading"&&(this._rosterState="idle"),this._farmState==="loading"&&(this._farmState="idle"),this._unitState==="loading"&&(this._unitState="idle"),this._tokenLog&&this._tokenLog.status==="loading"&&(this._tokenLog={...this._tokenLog,status:"idle"}),this._combatPhase==="loading"&&(this._combatPhase="loading"),this._refreshState()}_refreshState(){this._refreshing||(this._refreshing=!0,pe(`${Xt}/state`).then(e=>e&&typeof e.json=="function"?e.json():null).then(e=>{e&&(this._runs=Array.isArray(e.runs)?e.runs:this._runs,this._activeRunId=e.activeRunId||this._activeRunId,this._adoptGlobals(e),e.activeRun&&(this._run=e.activeRun,this._bannerReady=!!e.activeRun.hasStandardBanner,this._artState==="idle"&&(this._artReady=!(Number(e.activeRun.artPending)>0)),this._wallet=e.activeRun.wallet||this._wallet,this._rosterCount=Number(e.activeRun.rosterCount)||this._rosterCount))}).catch(()=>{}).then(()=>{this._refreshing=!1,this._renderBrowser()}))}_reconcileGenerating({boot:e=!1}={}){if(!e)return;let a=this._run&&Array.isArray(this._run.generating)?this._run.generating:[];if(!a.length)return;let r=this._run.runId,s=c=>a.find(d=>typeof d=="string"&&d.startsWith(`${r}:${c}`)),o=s("banner:wpn:"),i=s("banner:char:");if(o||i){this._hudView="summon",this._summonPhase="banner",this._summonBannerId=o?"wpn-featured":"char-featured",this._summonBanner=null,this._summonBannerState="idle";return}}_postJson(e,a){let r=Kr(e),s=r?this._busyStart(r):0;return pe(`${Xt}${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}).then(o=>o&&typeof o.json=="function"?o.json():null).catch(()=>null).then(o=>(this._adoptFromResponse(o),s&&this._busyEnd(s),o))}_adoptFromResponse(e){if(!e||typeof e!="object")return;if(this._adoptGlobals(e),e.wallet&&typeof e.wallet=="object"&&(this._wallet={...this._wallet||{},...e.wallet}),e.account&&typeof e.account=="object"&&this._run){let o=this._run.account||null,i=e.account;(!o||o.level!==i.level||o.xp!==i.xp||o.xpNeeded!==i.xpNeeded)&&(this._run={...this._run,account:{...o,...i}})}this._syncBar();let a=typeof e.unitId=="string"?e.unitId:"",r=typeof e.portrait=="string"?e.portrait:"",s=this._run&&this._run.decor;a&&r&&s&&s.unit&&s.unit.id===a&&s.unit.portrait!==r&&(this._run={...this._run,decor:{...s,unit:{...s.unit,portrait:r}}})}_syncBar(){na(this._root,{wallet:this._wallet,account:this._run&&this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:void 0})}_busyStart(e){return this._busySeq+=1,this._busyLocal.set(this._busySeq,e),this._renderBrowser(),this._busySeq}_busyEnd(e){this._busyLocal.delete(e)&&this._renderBrowser()}_busyTasks(){return Zr({local:[...this._busyLocal.values()],generating:this._run&&Array.isArray(this._run.generating)?this._run.generating:[],art:this._artState==="painting"?this._art:null})}async _createRun(e){let a=await this._postJson("/run",e);if(!(a&&a.ok&&a.run))throw new Error(a&&a.error||"Could not create the run.");this._adoptRun(a.run),this._runs=[...this._runs,a.run],this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}_openSettings(e){if(!this._run)return;let a=Me.some(r=>r.id===e)?e:ze;this._hudView!=="settings"&&(this._settingsFrom=this._hudView||"home"),this._hudView="settings",this._settingsCategory=a,this._renderBrowser(),a==="debug"&&this._loadTokenLog()}_settingsBackLabel(){return{home:"Home",modes:"Battle",roster:"Units",unit:"Units",summon:"Summon",formation:"Formation",inventory:"Inventory",farm:"Materials",chapters:"Chapters",chapter:"Chapter",result:"Result",combat:"Battle"}[this._settingsFrom]||"Home"}_leaveSettings(){this._hudView=this._settingsFrom==="settings"?"home":this._settingsFrom||"home",this._renderBrowser()}async _setSources(e){if(!this._run||!this._run.runId||!e||typeof e!="object")return;let a=this._run;this._run={...this._run,...e},this._settingsRev+=1;let r=await this._postJson("/run/sources",{runId:this._run.runId,sources:e});if(!r||!r.ok){this._run=a,this._settingsRev+=1,this._renderBrowser();return}r.run&&typeof r.run=="object"&&(this._run={...this._run,...r.run},this._settingsRev+=1)}_switchRun(e){if(e){if(e===this._activeRunId){this._creatingNew=!1,this._showRuns=!1,this._renderBrowser();return}this._postJson("/run/activate",{runId:e}).then(a=>{a&&a.ok&&a.run&&(this._adoptRun(a.run),this._showRuns=!1,this._renderBrowser(),this._loadState())})}}_deleteRun(e){e&&this._postJson("/run/delete",{runId:e}).then(a=>{a&&a.ok&&(this._runs=Array.isArray(a.runs)?a.runs:[],this._activeRunId=a.activeRunId||null,this._run&&e===this._run.runId&&this._adoptRun(a.activeRun||null),this._runs.length===0&&(this._showRuns=!1,this._creatingNew=!1),this._renderBrowser())})}_loadStandardBanner(){if(this._bannerState="loading",this._renderBrowser(),!this._run){this._bannerState="error",this._renderBrowser();return}this._postJson("/banner",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._bannerState="idle",this._bannerReady=!0,this._artReady=!1,this._artState="idle",this._artBlocking=!0,typeof e.granted=="number"&&(this._rosterCount=e.granted)):this._bannerState="error"}).then(()=>{this._run&&this._renderBrowser()})}_imageSlot(e){let a=()=>e(),r=(this._imageChain||Promise.resolve()).then(a,a);return this._imageChain=r.then(()=>{},()=>{}),r}_ensureArtRunning(){!this._run||this._artReady||this._artState!=="idle"||this._startArt()}_startArt(){if(this._artState="painting",this._art={done:0,total:0,name:""},!this._run){this._artReady=!0,this._renderBrowser();return}this._postJson("/portraits",{runId:this._run.runId}).then(e=>{let a=e&&e.ok&&Array.isArray(e.pending)?e.pending:[];return a.length?(this._art={done:Number(e.done)||0,total:Number(e.total)||a.length,name:a[0].name},this._artBlocking&&this._renderBrowser(),this._paintNext(a,0,0)):this._finishArt()}).catch(()=>this._finishArt())}_paintNext(e,a,r){if(!this._run||this._artState!=="painting")return Promise.resolve();if(a>=e.length){if(r>0&&r===e.length){if(this._artBlocking)return this._artState="blocked",this._renderBrowser(),Promise.resolve();console.warn("[gacha-forge] every background portrait failed ("+r+") \u2014 units keep their silhouette")}return this._paintFoundingArt().then(()=>this._finishArt())}let s=e[a];return this._art={...this._art,name:s.name},this._artBlocking&&this._renderBrowser(),this._imageSlot(()=>this._postJson("/portrait",{runId:this._run.runId,unitId:s.unitId})).catch(()=>null).then(o=>{let i=!!(o&&o.ok);return i&&(this._art={...this._art,done:this._art.done+1}),this._paintNext(e,a+1,r+(i?0:1))})}_paintFoundingArt(){return!this._artBlocking||!this._run?Promise.resolve():(this._art={...this._art,name:"The banner splash"},this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:"char-standard"})).catch(()=>null))}_finishArt(){let e=!this._artBlocking;this._artState="idle",this._artReady=!0,this._artBlocking=!1,e&&(this._hudView==="roster"&&!this._rosterUnitId&&this._rosterState!=="loading"?this._loadRoster():this._hudView==="summon"&&this._summonBannerState!=="loading"&&this._loadSummonBanner()),this._renderBrowser()}_openPick(e){e!=="bg"&&e!=="unit"||(this._pick={slot:e,source:e==="bg"?"story":"all"},this._renderBrowser(),!this._pickOptions&&this._postJson("/home-options",{runId:this._run?this._run.runId:""}).then(a=>{!a||a.ok===!1||(this._pickOptions={backgrounds:a.backgrounds||{},units:a.units||[]},this._pick&&this._renderBrowser())}))}_closePick(){this._pick&&(this._pick=null,this._renderBrowser())}_pickSource(e){this._pick&&(this._pick={...this._pick,source:String(e||"")},this._renderBrowser())}_takePick(e){if(!this._pick||!this._run)return;let a={runId:this._run.runId};if(this._pick.slot==="bg")a.bg=e?{src:this._pick.source,key:e}:null;else{if(!e)return;a.unitId=e}this._pick=null,this._renderBrowser(),this._postJson("/home-decor",a).then(r=>{!r||r.ok===!1||!r.decor||(this._run={...this._run,decor:r.decor},this._renderBrowser())})}_openRoster(){this._hudView="roster",this._rosterUnitId=null,this._rosterState="idle",this._renderBrowser()}_loadRoster(){if(this._rosterState="loading",this._renderBrowser(),!this._run){this._rosterState="error",this._renderBrowser();return}this._postJson("/roster",{runId:this._run.runId}).then(e=>{e&&e.ok&&Array.isArray(e.cards)?(this._roster=e.cards,this._rosterCount=e.cards.length,this._rosterState="ready"):this._rosterState="error"}).then(()=>{this._hudView==="roster"&&this._renderBrowser()})}_openUnit(e,a="profile"){e&&(this._rosterUnitId=e,this._unit=null,this._unitTab=a==="growth"||a==="gear"||a==="bond"?a:"profile",this._growthRev+=1,this._unitState="idle",this._portraitReset(),this._renderBrowser())}_portraitReset(){this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev+=1}_loadUnit(){if(this._unitState="loading",this._renderBrowser(),!this._run||!this._rosterUnitId){this._unitState="error",this._renderBrowser();return}let e=this._rosterUnitId;this._postJson("/unit",{runId:this._run.runId,unitId:e}).then(a=>{this._rosterUnitId===e&&(a&&a.ok&&a.unit?(this._unit=a.unit,this._unitLevel=Number(a.level)||1,this._unitBond=Number(a.bond)||0,this._growth=a,this._growthRev+=1,this._feed=null,this._portrait=a.portrait||null,this._portraitRev+=1,this._unitState="ready"):this._unitState="error")}).then(()=>{this._rosterUnitId===e&&this._renderBrowser()})}_portraitOpenStudio(){this._portrait&&(this._portraitDraft={appearance:this._portrait.appearance||"",tags:We(this._portrait.tags)},this._portraitOpen=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser())}_portraitClose(){this._portraitOpen=!1,this._portraitCrop=null,this._portraitError="",this._portraitRev+=1,this._renderBrowser()}_portraitEdit(e){if(!(!this._portraitDraft||!e)){if(typeof e.appearance=="string"){this._portraitDraft.appearance=e.appearance;return}if(typeof e.addTag=="string")for(let a of We(e.addTag))this._portraitDraft.tags.includes(a)||this._portraitDraft.tags.push(a);else if(Number.isInteger(e.dropTag))this._portraitDraft.tags.splice(e.dropTag,1);else return;this._portraitRev+=1,this._renderBrowser()}}_portraitGenerate(){if(this._portraitBusy||!this._run||!this._rosterUnitId||!this._portraitDraft)return;let e=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait",{runId:this._run.runId,unitId:e,force:!0,appearance:this._portraitDraft.appearance,imageTags:this._portraitDraft.tags}).then(a=>this._portraitApply(e,a,"That did not paint."))}_portraitPick(e){let r=(this._portrait&&this._portrait.strip||[])[e];if(!r||r.current||this._portraitBusy||!this._run||!this._rosterUnitId)return;let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait/select",{runId:this._run.runId,unitId:s,url:r.url}).then(o=>this._portraitApply(s,o,"That one could not be restored."))}_portraitApply(e,a,r){if(this._portraitBusy=!1,this._rosterUnitId===e){if(a&&a.ok&&a.view){let s=a.view;this._portrait=s,this._portraitDraft={appearance:s.appearance||"",tags:We(s.tags)},this._portraitCrop=null,this._portraitError="";let o=Array.isArray(s.strip)&&s.strip.length?s.strip[0].url:"";this._unit&&(this._unit={...this._unit,portrait:o,appearance:s.appearance,imageTags:s.tags}),this._rosterState="idle"}else this._portraitError=Ui[a&&a.error||""]||a&&a.detail||r;this._portraitRev+=1,this._renderBrowser()}}_portraitFile(e){if(!e||this._portraitBusy)return;let a=s=>{this._portraitError=s,this._portraitCrop=null,this._portraitRev+=1,this._renderBrowser()},r=new FileReader;r.onerror=()=>a("That file could not be read."),r.onload=()=>{let s=String(r.result||""),o=new Image;o.onerror=()=>a("That file is not an image this gallery accepts."),o.onload=()=>{let i=o.naturalWidth||o.width,c=o.naturalHeight||o.height;if(!i||!c)return a("That image has no size.");this._portraitCrop={src:s,natural:{w:i,h:c},size:1,frame:Mt(i,c,1,.5,.42)},this._portraitError="",this._portraitRev+=1,this._renderBrowser()},o.src=s},r.readAsDataURL(e)}_portraitDrag(e){let a=this._portraitCrop;!a||!e||(a.frame=zt({...a.frame,x:a.frame.x+(Number(e.dx)||0)*a.natural.w,y:a.frame.y+(Number(e.dy)||0)*a.natural.h},a.natural.w,a.natural.h),Ot(this._root,a.frame,a.natural.w,a.natural.h))}_portraitSize(e){let a=this._portraitCrop;if(!a)return;let r=(a.frame.x+a.frame.w/2)/a.natural.w,s=(a.frame.y+a.frame.h/2)/a.natural.h;a.size=e,a.frame=Mt(a.natural.w,a.natural.h,e,r,s),Ot(this._root,a.frame,a.natural.w,a.natural.h)}_portraitUpload(){let e=this._portraitCrop;if(!e||this._portraitBusy||!this._run||!this._rosterUnitId)return;let a=Number(this._portrait&&this._portrait.width)||0,r=Number(this._portrait&&this._portrait.height)||0;if(!a||!r){this._portraitError="This world did not say what size a portrait is.",this._portraitRev+=1,this._renderBrowser();return}let s=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser();let o=new Image;o.onerror=()=>this._portraitApply(s,null,"That image could not be prepared."),o.onload=()=>{let i="";try{let c=document.createElement("canvas");c.width=a,c.height=r,c.getContext("2d").drawImage(o,e.frame.x,e.frame.y,e.frame.w,e.frame.h,0,0,a,r),i=c.toDataURL("image/jpeg",.92)}catch{i=""}if(!i)return this._portraitApply(s,null,"That image could not be prepared.");this._postJson("/portrait/upload",{runId:this._run.runId,unitId:s,image:i}).then(c=>this._portraitApply(s,c,"That image was not accepted."))},o.src=e.src}_wireRuns(){Rs(this._root,{onNew:()=>{this._creatingNew=!0,this._showRuns=!1,this._renderBrowser()},onSwitch:e=>this._switchRun(e),onDelete:e=>this._deleteRun(e),onBack:()=>{this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}})}_loadTokenLog(){this._tokenLog={status:"loading",entries:this._tokenLog&&this._tokenLog.entries||[],totals:this._tokenLog&&this._tokenLog.totals},this._fillTokenLog(),this._loreStatus={status:"loading"},this._postJson("/lore-status",{runId:this._run?this._run.runId:""}).then(e=>{this._loreStatus=e&&e.ok?{status:"ready",data:e}:{status:"error"},this._fillTokenLog()}),this._postJson("/token-log",{runId:this._run?this._run.runId:""}).then(e=>{if(e&&e.ok&&Array.isArray(e.entries)){this._tokenLog={status:"ready",entries:e.entries,totals:e.totals||null};let a=s=>{let o=Number(s)||0;return o>=1e3?(o/1e3).toFixed(o>=1e4?0:1)+"k":String(o)},r=e.totals||{};this._tokenTotals={sent:a(r.sent),received:a(r.received)}}else this._tokenLog={status:"error",entries:[],totals:null};this._fillTokenLog()})}_fillTokenLog(){let e=this._root.querySelector('[data-view-body="debug"]');e&&(e.innerHTML=_t(this._loreStatus,this._tokenLog))}_stopForge(){this._forgeCleanup&&(this._forgeCleanup(),this._forgeCleanup=null)}_stopBeat(){this._beatCleanup&&(this._beatCleanup(),this._beatCleanup=null)}_stopSummon(){this._summonCleanup&&(this._summonCleanup(),this._summonCleanup=null)}_stopCombat(){this._combatCleanup&&(this._combatCleanup(),this._combatCleanup=null)}_openSummon(){this._hudView="summon",this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._renderBrowser()}_loadSummonBanner(){if(this._summonBannerState="loading",this._renderBrowser(),!this._run){this._summonBannerState="error",this._renderBrowser();return}let e=this._summonBannerId;this._postJson("/summon-banner",{runId:this._run.runId,banner:e}).then(a=>{this._summonBannerId===e&&(a&&a.ok&&a.banner?(this._summonBanner=a,this._summonBannerState="ready",this._ensureBannerArt(a.banner)):this._summonBannerState="error")}).then(()=>{this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()})}_redoBannerArt(){this._paintBannerArt(this._summonBannerId,!0)}_ensureBannerArt(e){!e||!e.canArt||e.art||this._paintBannerArt(e.id,!1)}_paintBannerArt(e,a){!this._run||this._summonArting||!e||(this._summonArting=!0,this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:e,force:!!a})).then(r=>{if(this._summonBannerId===e&&r&&r.ok&&r.art&&this._summonBanner&&this._summonBanner.banner){this._summonBanner.banner.art=r.art;let s=(this._summonBanner.banners||[]).find(o=>o&&o.id===e);s&&(s.art=r.art)}}).catch(()=>{}).then(()=>{this._summonArting=!1,this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()}))}_summonPull(e){if(!this._run)return;let a=this._summonBannerId;this._postJson("/summon",{runId:this._run.runId,banner:a,count:e===10?10:1}).then(r=>{r&&r.ok&&Array.isArray(r.results)&&(this._summonResults=r.results,this._summonWallet=r.wallet||this._summonWallet,this._summonBannerState="idle",this._summonBanner=null,this._rosterCount+=r.results.filter(s=>s&&s.isNew).length,this._summonPhase="reveal",this._renderBrowser())})}_openResult(e){this._result=e,this._resultRev+=1,this._stopCombat(),this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,this._hudView="result",this._renderBrowser()}_closeResult(){let e=this._result&&this._result.back||"farm";this._result=null,this._resultRev+=1,this._hudView=e,e==="farm"&&this._loadFarm(),this._renderBrowser()}_resultAgain(){let e=this._result&&this._result.again;if(this._result=null,this._resultRev+=1,this._hudView="farm",!e){this._renderBrowser();return}this._farmRun(e)}_vigorView(){let e=this._wallet||this._run&&this._run.wallet||null,a=this._combatVigorError,r=Number(a&&Number.isFinite(Number(a.cost))?a.cost:this._combat&&this._combat.cost);return!e||!Number.isFinite(r)?null:{have:Number(e.vigor)||0,cost:r,nextMs:a&&Number.isFinite(a.vigorNextMs)?a.vigorNextMs:this._wallet&&this._wallet.vigorNextMs||null}}_startBattle(){if(!this._run||this._combatStarting)return;this._combatStarting=!0;let e=this._combatNode;e&&this._postJson("/farm/start",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}).then(a=>{this._combatStarting=!1,a&&a.ok?(this._run&&(this._run.wallet=a.wallet||this._run.wallet),this._combatPhase="battle",this._combatVigorError=null):this._combatVigorError=a&&a.error==="no-vigor"?a:{error:a&&a.error||"failed"},this._renderBrowser()})}_openFarm(){this._hudView="farm",this._farmView="root",this._farmState=this._farm?"ready":"loading",this._renderBrowser(),this._loadFarm()}_loadFarm(){this._run&&this._postJson("/farm",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._farm=e,this._farmState="ready"):this._farmState="error",this._farmRev+=1,this._hudView==="farm"&&this._renderBrowser()})}_farmRun(e){!this._run||!e||this._farmBusy||(this._farmBusy=!0,this._pendingFarm={...e},this._stopCombat(),this._pendingCombat={farm:!0,...e,title:"Materials"},this._formationBattleMode=!0,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser())}_claimFarm(){if(!this._run)return;let e=this._pendingFarm?{...this._pendingFarm}:null,a=this._farmStageLabel(e);this._postJson("/farm/claim",{runId:this._run.runId}).then(r=>{if(!(r&&r.ok)){this._leaveCombat("farm");return}let s=r.dropped||null;this._pendingFarm=null,this._openResult({outcome:"win",where:a,rewards:Gr(s),relic:s&&s.relic||null,rank:r&&r.rank||null,back:"farm",canReplay:!!e,again:e}),this._loadFarm()}).catch(()=>this._leaveCombat("farm"))}_farmStageLabel(e){if(!e)return"Materials";let a=["","Normal","Hard","Very Hard"][Number(e.difficulty)]||"",s=((this._farm&&this._farm.stages||{})[e.stage]||[]).find(i=>Number(i.difficulty)===Number(e.difficulty));if(e.stage==="asc"){let i=(this._farm&&this._farm.families||[]).find(c=>c.id===e.family);return`${a} \xB7 ${i?i.name:"Ascension"}`}let o=this._farm&&this._farm.stageNames||{};return`${a} \xB7 ${o[e.stage]||s&&s.material||"Materials"}`}_enterBattle(){let e=this._pendingCombat;e&&(this._formationBattleMode=!1,this._combatNode={...e},this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatNonce=0,this._combatPreset=null,this._combatPhase="loading",this._hudView="combat",this._renderBrowser())}_loadBattle(){if(this._battleLoading)return;this._battleLoading=!0;let e=this._combatNode;if(this._combatError="",this._combatPhase="loading",this._renderBrowser(),!this._run||!e){this._battleLoading=!1,this._combatPhase="error",this._renderBrowser();return}this._postJson("/farm/battle",{runId:this._run.runId,stage:e.stage,difficulty:e.difficulty,family:e.family||"",presetIndex:this._combatPreset}).then(a=>{if(a&&a.ok&&Array.isArray(a.allies)&&Array.isArray(a.enemies)){this._combat=a,this._combatPreset=typeof a.activePreset=="number"?a.activePreset:this._combatPreset,this._combatNode={...e,objective:a.objective||""};let r=hr({allies:a.allies,enemies:a.enemies,seed:dr(a.battleKey||e.stage)});this._combatSteps=r.steps,this._combatResult=r.result,this._combatPhase="prebattle"}else this._combatError=a&&a.error||"",this._combatPhase="error"}).then(()=>{this._battleLoading=!1,this._farmBusy=!1,this._hudView==="combat"&&this._renderBrowser()})}_pickCombatPreset(e){!this._run||this._combatPreset===e||(this._combatPreset=e,this._loadBattle())}_combatFinished(e){if(this._combatOutcome)return;if(this._combatOutcome=e==="lose"?"lose":"win",this._stopCombat(),this._combatOutcome==="win"){this._exitCombat(!0);return}let a=this._combatNode;setTimeout(()=>{this._combatOutcome==="lose"&&this._openResult({outcome:"lose",where:a&&a.title||"",rewards:[],rank:null,canReplay:!0,back:"farm",again:a||null})},qi)}_exitCombat(e){let a=this._combatNode;if(e&&(this._combatOutcome||this._combatResult)==="win"){this._stopCombat(),this._claimFarm();return}if(e&&a){let s=this._pendingFarm?{...this._pendingFarm}:null;this._pendingFarm=null,this._openResult({outcome:"lose",where:this._farmStageLabel(s),rewards:[],relic:null,rank:null,back:"farm",canReplay:!0,again:s}),this._loadFarm();return}this._leaveCombat("farm")}_leaveCombat(e){this._stopCombat(),this._hudView=e,this._combatPhase="loading",this._combat=null,this._combatSteps=null,this._combatResult=null,this._combatOutcome=null,this._combatNonce=0,e==="farm"&&(this._pendingFarm=null),this._renderBrowser()}_openFormation(){this._formationBattleMode=!1,this._hudView="formation",this._formation=null,this._formationState="idle",this._renderBrowser()}_loadFormation(){if(this._formationState="loading",this._renderBrowser(),!this._run){this._formationState="error",this._renderBrowser();return}this._postJson("/formation",{runId:this._run.runId}).then(e=>{e&&e.ok?(this._formation=e,this._formationState="ready"):this._formationState="error"}).then(()=>{this._hudView==="formation"&&this._renderBrowser()})}_saveFormation(e,a){this._run&&(this._formation&&(this._formation={...this._formation,presets:e,active:a}),this._postJson("/formation/save",{runId:this._run.runId,presets:e,active:a}).then(r=>{r&&r.ok&&Array.isArray(r.presets)&&this._formation&&(this._formation={...this._formation,presets:r.presets,active:r.active})}))}_feedRoom(e){if(!e)return 0;let a=Number(e.level)||1,r=(Array.isArray(e.ladder)?e.ladder:[]).filter(s=>Number(s.level)>=a).reduce((s,o)=>s+(Number(o.xp)||0),0);return Math.max(0,r-Math.max(0,Number(e.xp)||0))}_growthView(){let e=this._growth;if(!e)return null;let a=this._feed;if(!a)return e;let r=Array.isArray(e.tiers)?e.tiers:[],s=Math.max(0,Number(e.xp)||0),o=0;for(let f of r)o+=(Number(a[f.id])||0)*(Number(f.xp)||0);s+=o;let i=Number(e.wallet&&e.wallet.funds)||0,c=Number(e.level)||1,d=0,h=!1;for(let f of Array.isArray(e.ladder)?e.ladder:[])if(f.level===c){if(s<f.xp)break;if(i<f.funds){h=!0;break}s-=f.xp,i-=f.funds,d+=f.funds,c=f.level+1}let p=(Array.isArray(e.ladder)?e.ladder:[]).find(f=>f.level===c-1),n=(Array.isArray(e.ladder)?e.ladder:[]).find(f=>f.level===c),u=c-(Number(e.level)||1);return{...e,preview:{ready:o>0,short:h,xp:o,levelTo:c,cpTo:p?p.cpAfter:Number(e.cp)||0,funds:d||(h?this._nextStepFunds(e,c):0),spent:{...a},xpAfter:s,needAfter:n?n.xp:null,solid:u>0?0:Math.max(0,Number(e.xp)||0),roomLeft:Math.max(0,this._feedRoom(e)-o)}}}_nextStepFunds(e,a){let r=(Array.isArray(e.ladder)?e.ladder:[]).find(s=>s.level===a);return r?r.funds:0}_feedAdd(e){let a=this._growth;if(!a||!e)return;let r=Math.max(0,Number(a.wallet&&a.wallet.insight&&a.wallet.insight[e])||0),s=this._feed||{},o=Number(s[e])||0;if(o>=r)return;let i=Array.isArray(a.tiers)?a.tiers:[],c=0;for(let d of i)c+=(Number(s[d.id])||0)*(Number(d.xp)||0);this._feedRoom(a)-c<=0||(this._feed={...s,[e]:o+1},this._paintGrowth())}_feedReset(){this._feed&&(this._feed=null,this._paintGrowth())}_feedCommit(){if(!this._run||!this._rosterUnitId||!this._feed)return;let e=this._feed;this._feed=null,this._paintGrowth(),this._postJson("/level-up",{runId:this._run.runId,unitId:this._rosterUnitId,spend:e}).then(a=>{a&&a.ok?(this._unitLevel=Number(a.level)||this._unitLevel,this._growth={...this._growth,...a},this._growthRev+=1,this._renderBrowser()):this._paintGrowth()})}_ascend(){if(!this._run||!this._rosterUnitId)return;let e=this._growth;!e||!e.ascension||!e.ascension.ready||this._postJson("/ascend",{runId:this._run.runId,unitId:this._rosterUnitId}).then(a=>{a&&a.ok?(this._growth={...this._growth,...a},this._growthRev+=1):a&&a.ascension&&(this._growth={...this._growth,ascension:a.ascension},this._growthRev+=1),this._paintGrowth()})}_paintGrowth(){let e=this._root.querySelector(".cp-panel");!e||this._unitTab!=="growth"||!this._unit||(e.innerHTML=_r(this._unit,this._growthView()))}};typeof customElements<"u"&&!customElements.get(Ls)&&customElements.define(Ls,Kt);
