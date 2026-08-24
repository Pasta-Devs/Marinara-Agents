var rt=`
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
.hm-art {
  position: absolute;
  inset: var(--edge-w) var(--edge-w) 0 0;
  overflow: hidden;
  clip-path: var(--plate-clip-left);
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
/* SLICE: the locked Battle block, in the same vocabulary the dock and the rail already use for a
   blocked entry. It loses the coral top edge on purpose: coral marks what is live, so leaving it
   would read as the one thing on this screen you are meant to press. */
.hm-cta.off { cursor: default; opacity: 0.62; border-top-color: var(--steel-dark); }
.hm-cta.off:hover { border-color: var(--ink-3); }
.hm-cta .soon { font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-faint); }
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
`;var Q="vanguard",ee=[{id:"aurora",label:"Aurora",description:"Frosted glass and gold",swatch:["#171334","rgba(255,255,255,.10)","#E8C87A"]},{id:"bloom",label:"Bloom",description:"Bright and playful",swatch:["#2B3F63","#FFFFFF","#FF6E9C"]},{id:"signal",label:"Signal",description:"Technical and minimal",swatch:["#0C0D10","rgba(255,255,255,.10)","#C8FF3D"]},{id:"ember",label:"Ember",description:"Warm and painted",swatch:["#2C1E14","#6B4A2A","#F0B429"]},{id:"vanguard",label:"Vanguard",description:"Sharp and industrial",swatch:["#0E1725","#1E2C44","#F2603C"]}];function at(e){return ee.some(t=>t.id===String(e))}function pe(e){return at(e)?String(e):Q}var ye=[1,1.15,1.3,1.5,1.75],wr=1.5;function te(e){let t=Number(e);if(!Number.isFinite(t)||t<=0)return wr;let r=ye[0];for(let a of ye)Math.abs(a-t)<Math.abs(r-t)&&(r=a);return r}var xr='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',kr='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/></svg>',_r='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',Sr='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="11" width="18" height="5" stroke="currentColor" stroke-width="1.8"/><path d="M6 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Er='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Tr='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" stroke-width="1.7"/></svg>';function we(e){let t=Math.max(0,Math.floor((Number(e)||0)/1e3)),r=Math.floor(t/60),a=t%60;return r+":"+String(a).padStart(2,"0")}function G(e){return(Number(e)||0).toLocaleString("en-US")}function ot(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var st=new Set(["hud","modes","summon","roster","unit","formation","chapter","chapters","combat","farm","inventory","settings","events"]),nt=`
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
`,it="1.0.0";function lt({username:e="",wallet:t=null,account:r=null,vigorNextMs:a=null}={}){let o=t&&typeof t=="object"?t:{},s=Number(o.aether)||0,n=Number(o.funds)||0,l=Number(o.vigor)||0,d=Number(o.vigorMax)||60,c=r||null,h=c?Math.max(1,Number(c.level)||1):1,i=c?c.xpNeeded?G(Number(c.xp)||0)+" / "+G(c.xpNeeded)+" XP":"MAX":"&mdash;",u=c&&Number(c.xpNeeded)||0,p=c?u>0?Math.max(0,Math.min(100,Math.round((Number(c.xp)||0)/u*1e3)/10)):100:0,m=Number.isFinite(a)?we(a):"",b=e&&e.trim()||"Commander",x=b.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"C";return`
<header class="gf-bar">
  <div class="command">
    <div class="avatar">${ot(x)}</div>
    <div class="rank"><span data-bar-rank>${h}</span><small>RANK</small></div>
    <div class="xp">
      <div class="figure"><span>${ot(b)}</span><span data-bar-rankxp>${i}</span></div>
      <div class="xp-bar"><i data-bar-rankfill style="width:${p}%"></i></div>
    </div>
  </div>

  <div class="gf-bar-slot" data-bar-slot></div>

  <div class="currencies">
    <div class="currency aet">${xr}<div><div class="value" data-bar-aether>${G(s)}</div></div></div>
    <div class="currency">${kr}<div><div class="value" data-bar-funds>${G(n)}</div></div></div>
    <div class="currency vig">${_r}<div class="value"><span data-bar-vigor>${l}</span><span class="dim" data-bar-vigormax>/${d}</span></div><span class="refill" data-vigor-next>${m}</span></div>
    <button class="icon-button gf-runs-bar" type="button" data-open-runs aria-label="Worlds" title="Switch or start a world">${Sr}</button>
    <button class="icon-button" type="button" aria-label="Game settings">${Tr}</button>
    <button class="icon-button gf-fs-bar" type="button" aria-label="Toggle fullscreen" title="Fullscreen">${Er}</button>
  </div>
</header>`}function ct(e,{wallet:t=null,account:r=null,vigorNextMs:a=void 0}={}){if(!e||typeof e.querySelector!="function")return!1;let o=d=>e.querySelector(d);if(!(o("[data-bar-aether]")?e:null))return!1;let n=(d,c)=>{let h=o(d);h&&h.textContent!==c&&(h.textContent=c)},l=t&&typeof t=="object"?t:null;if(l&&(n("[data-bar-aether]",G(Number(l.aether)||0)),n("[data-bar-funds]",G(Number(l.funds)||0)),n("[data-bar-vigor]",String(Number(l.vigor)||0)),n("[data-bar-vigormax]","/"+(Number(l.vigorMax)||60))),a!==void 0){let d=o("[data-vigor-next]");if(d){let c=Number.isFinite(a)?we(a):"";d.textContent!==c&&(d.textContent=c)}}if(r){let d=Math.max(1,Number(r.level)||1),c=Number(r.xpNeeded)||0;n("[data-bar-rank]",String(d)),n("[data-bar-rankxp]",c>0?G(Number(r.xp)||0)+" / "+G(c)+" XP":"MAX");let h=o("[data-bar-rankfill]");if(h&&h.style){let i=c>0?Math.max(0,Math.min(100,Math.round((Number(r.xp)||0)/c*1e3)/10)):100;h.style.width=i+"%"}}return!0}function dt(e,{nextMs:t,periodMs:r,onLanded:a}={}){if(!Number.isFinite(t))return()=>{};let o=Number(t),s=Number(r)>0?Number(r):0,n=Date.now()+o,l=()=>{let c=e&&e.querySelector?e.querySelector("[data-vigor-next]"):null;if(!c)return;let h=n-Date.now();if(h>0){c.textContent=we(h);return}n=s?Date.now()+s:Date.now(),c.textContent=s?we(s):"",a&&a()};l();let d=setInterval(l,1e3);return()=>clearInterval(d)}function ht(e){let t=e.querySelector&&e.querySelector("[data-bar-slot]");if(!t||typeof t.appendChild!="function")return!1;let r=e.querySelector(".head")||e.querySelector(".cap-head")||e.querySelector(".sel-head");if(!r||!r.childNodes)return!1;for(;t.firstChild;)t.removeChild(t.firstChild);let a=r.parentElement,o=[];for(let n of Array.from(r.childNodes))n.classList&&n.classList.contains("gf-stay")?o.push(n):t.appendChild(n);for(let n of o)a&&typeof a.appendChild=="function"&&a.appendChild(n);let s=typeof t.querySelectorAll=="function"?t.querySelectorAll(".eyebrow"):null;if(s&&typeof s.length=="number")for(let n=s.length-1;n>=0;n-=1){let l=s[n];l&&typeof l.remove=="function"&&l.remove()}return typeof r.remove=="function"&&r.remove(),!0}var pt=`

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
`,Ar='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Cr='<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1" y="1" width="12.5" height="22" rx="2"/><rect x="18.5" y="6.5" width="14.5" height="11" rx="1.8"/><path d="M15.4 7.6a6 6 0 0 1 2.6-2.4" stroke-dasharray="2.2 1.8"/><path d="M18.4 4.2l-1 2 2.1.5"/></svg>',Nr=`
  <div class="gf-rot">
    <span class="gf-rot-ph">${Cr}</span>
    <h3 data-rot-title>Landscape only</h3>
    <p data-rot-note>This game plays in a 16:9 landscape frame.</p>
    <button type="button" data-go-landscape>Play in landscape</button>
  </div>`;function ft(e,t){let r=pe(t&&t.style),a=t&&t.entering?" data-enter":t&&t.swapping?" data-swap":"";return`
<div class="gf-arena" data-style="${r}">
  ${Nr}
  <aside class="gf-gutter">
    <div class="gf-gutter-title">News</div>
    <div class="gf-news"><span class="k">Update</span><span class="t">More soon</span><span class="d">&mdash;</span></div>
    <div class="gf-side-hint">side rail &middot; later</div>
  </aside>

  <div class="gf-stage">
    ${t&&t.bar?"":`<button class="gf-fs-exit" type="button" title="Fullscreen" aria-label="Toggle fullscreen">${Ar}</button>`}
    ${t&&t.bar||""}
    <div class="gf-view"${a}>${e}</div>
  </div>

  <aside class="gf-gutter">
    <div class="gf-gutter-title">Feed</div>
    ${t&&t.tokens?`<div class="gf-tokens" title="Model tokens this engine run \u2014 the full log is in settings > Debug">
           <span class="k">Tokens</span>
           <span class="v"><i>&uarr;</i>${t.tokens.sent}</span>
           <span class="v"><i>&darr;</i>${t.tokens.received}</span>
         </div>`:'<div class="gf-side-hint">side rail &middot; later</div>'}
  </aside>
</div>
<style>${nt}</style>`}var Rr="marinara_admin_secret";function Br(){try{if(typeof localStorage>"u")return{};let e=(localStorage.getItem(Rr)||"").trim();return e?{"X-Admin-Secret":e}:{}}catch{return{}}}function z(e,t){let r=t&&typeof t=="object"?t:{};return fetch(e,{...r,headers:{...Br(),...r.headers||{}}})}var ut=`
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
`;var xe=[{id:"all",label:"All"},{id:"5",label:"5&#9733;",tone:"g"},{id:"4",label:"4&#9733;",tone:"e"}];function F(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var Ie={roster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20c0-2.8 2-4.6 4.6-4.6"/></svg>',formation:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="4" width="5.5" height="5.5"/><rect x="9.5" y="4" width="5.5" height="5.5"/><rect x="16" y="4" width="5.5" height="5.5"/><rect x="3" y="14" width="5.5" height="5.5"/><rect x="9.5" y="14" width="5.5" height="5.5"/></svg>',summon:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16l-1.4 12H5.4z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>',inventory:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5V18l-9 4.5L3 18z"/><path d="M3 9.5 12 14l9-4.5M12 14v8.5"/></svg>',events:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5V6h18v2.5a2 2 0 0 0 0 4V15H3v-2.5a2 2 0 0 0 0-4z"/><path d="M9 6v9" stroke-dasharray="2 2"/></svg>',missions:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg>'},vt='<svg class="hm-figure" viewBox="0 0 100 130" fill="currentColor" aria-hidden="true"><path d="M50 12c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16zM22 118c0-18 12-30 28-30s28 12 28 30z"/></svg>',Ir=[{id:"roster",label:"Units",live:!0},{id:"formation",label:"Formation",live:!1},{id:"summon",label:"Summon",live:!0},{id:"shop",label:"Shop",live:!1},{id:"inventory",label:"Inventory",live:!1}],Fr=[{id:"events",label:"Events",live:!1},{id:"missions",label:"Achievements",live:!1}],Lr=[{id:"story",label:"Story",live:!1},{id:"banner",label:"Banners",live:!0},{id:"bond",label:"Bond",live:!1},{id:"event",label:"Events",live:!1},{id:"unit",label:"Units",live:!1}];function gt({kind:e,title:t,rail:r,source:a,items:o,current:s,currentName:n,none:l,emptyHint:d}){let c=r.map(p=>{let m=p.live!==!1;return'<button class="hm-pk-cat'+(m?"":" off")+'" type="button"'+(m?` aria-selected="${p.id===a}" data-pk-src="${F(p.id)}"`:" disabled")+`><span>${p.label}</span>`+(m?"":'<span class="soon">Soon</span>')+"</button>"}).join(""),h=p=>'<button class="hm-pk-card'+(p.key===s?" on":"")+`" type="button" data-pk-take="${F(p.key)}"><span class="shot">${p.url?`<img src="${F(p.url)}" alt="">`:vt}</span><span class="nm">${F(p.name)}</span>`+(p.kit?`<span class="kit"><b>${Number(p.rarity)||0}&#9733;</b> ${F(p.kit)}</span>`:"")+(p.key===s?'<span class="tag">In use</span>':"")+"</button>",u=(l?'<button class="hm-pk-card none'+(s?"":" on")+'" type="button" data-pk-take=""><span class="shot"><span>None</span></span><span class="nm">No background</span>'+(s?"":'<span class="tag">In use</span>')+"</button>":"")+(o.length?o.map(h).join(""):`<p class="hm-pk-empty">${F(d)}</p>`);return`
  <div class="hm-pk-wrap">
    <div class="hm-pk-veil" data-pk-close></div>
    <div class="hm-pk ${e}">
      <div class="hm-pk-head">
        <span class="ttl">${F(t)}</span>
        <span class="cur">${F(n||"None")}</span>
        <button class="x" type="button" data-pk-close>Close</button>
      </div>
      <div class="hm-pk-body">
        <div class="hm-pk-cats">${c}</div>
        <div class="hm-pk-grid">${u}</div>
      </div>
    </div>
  </div>`}function Mr(e,t,r){if(!e)return"";let a=t||{},o=r||{};if(e.slot==="bg"){let l=e.source||"story",d=a.backgrounds&&a.backgrounds[l]||[],c=o.bg?o.bg.key:"";return gt({kind:"bg",title:"Background",rail:Lr,source:l,items:d,current:c,currentName:o.bg?o.bg.name:"",none:!0,emptyHint:l==="banner"?"Banner art appears here once a banner has its picture painted.":"Story backgrounds are painted as your chapters reach a new place."})}let s=e.source||"all",n=(a.units||[]).filter(l=>s==="all"||String(l.rarity)===s);return gt({kind:"units",title:"Home unit",rail:xe,source:s,items:n,current:o.unit?o.unit.id:"",currentName:o.unit?o.unit.name:"",none:!1,emptyHint:s==="all"?"No characters yet.":`No ${s}-star characters yet. Summon on any banner to find one.`})}function mt({decor:e=null,pick:t=null,pickOptions:r=null}){let a=e&&typeof e=="object"?e:{},o=a.bg&&a.bg.url?a.bg:null,s=a.unit||null,n=d=>`<button class="hm-tile ${d.id}${d.live?"":" off"}" type="button"`+(d.live?` data-go="${d.id}"`:" disabled")+">"+Ie[d.id]+`<span class="nm">${F(d.label)}</span>`+(d.live?"":'<span class="soon">Soon</span>')+"</button>",l=d=>d.live?`<button class="hm-side" type="button" data-go="${d.id}"><span class="lbl">${Ie[d.id]}<span>${F(d.label)}</span></span></button>`:`<button class="hm-side off" type="button" disabled><span class="lbl">${Ie[d.id]}<span>${F(d.label)}</span></span><span class="soon">Soon</span></button>`;return`
<div class="root">
  <div class="hm-screen">
    ${o?`<img class="hm-bg" src="${F(o.url)}" alt="">`:'<div class="hm-ground"></div>'}
    <div class="hm-scrim"></div>

    <div class="hm-scene">
      <div class="hm-plate">
        <div class="hm-art">${s&&s.portrait?`<img src="${F(s.portrait)}" alt="">`:vt}</div>
        <button class="hm-slot hm-slot-unit" type="button" data-pick="unit">
          <span class="nm">${F(s&&s.name?s.name:"No unit set")}</span>
          <span class="swap">Change</span>
        </button>
      </div>

      <div class="hm-right">
        <button class="hm-slot hm-slot-bg" type="button" data-pick="bg">
          <span class="nm">${F(o?o.name:"No background set")}</span>
          <span class="swap">Change</span>
        </button>

        <div class="hm-rail">${Fr.map(l).join("")}</div>
        <!-- SLICE: Battle is the door to the MODES screen, where Story and the other modes
             live \u2014 not just combat. It reopens with whichever of those ships first. -->
        <button class="hm-cta off" type="button" disabled>
          <span class="big">Battle</span>
          <span class="soon">Soon</span>
        </button>
      </div>
    </div>

    <div class="hm-dock">${Ir.map(n).join("")}</div>
  </div>
${Mr(t,r,a)}
</div>`}function bt(e,{onOpenRoster:t,onOpenSummon:r,onPickOpen:a,onPickClose:o,onPickSource:s,onPickTake:n}){let l={roster:t,summon:r};for(let c of e.querySelectorAll("[data-go]")){let h=l[c.getAttribute("data-go")];c.addEventListener("click",i=>{i&&typeof i.stopPropagation=="function"&&i.stopPropagation(),h&&h()})}(e.querySelector(".root")||e).addEventListener("click",c=>{let h=m=>c&&c.target&&c.target.closest?c.target.closest(m):null,i=h("[data-pick]");if(i){a&&a(i.getAttribute("data-pick"));return}if(h("[data-pk-close]")){o&&o();return}let u=h("[data-pk-src]");if(u){s&&s(u.getAttribute("data-pk-src"));return}let p=h("[data-pk-take]");p&&n&&n(p.getAttribute("data-pk-take"))})}var Z=[{id:"world",label:"World",lead:"Chapters, banners and the cast you pull all grow from what you write here."},{id:"you",label:"You"},{id:"sources",label:"Sources",lead:"The forge <b>reads</b> your books &mdash; it never edits them."},{id:"look",label:"Look",lead:"All of it is per world, and none of it changes the game."}],zr=[{value:"English",label:"English"},{value:"Japanese",label:"\u65E5\u672C\u8A9E"},{value:"Korean",label:"\uD55C\uAD6D\uC5B4"},{value:"Chinese",label:"\u4E2D\u6587"},{value:"Spanish",label:"Espa\xF1ol"},{value:"French",label:"Fran\xE7ais"},{value:"German",label:"Deutsch"},{value:"Polish",label:"Polski"},{value:"Portuguese",label:"Portugu\xEAs"},{value:"Russian",label:"\u0420\u0443\u0441\u0441\u043A\u0438\u0439"}],X=[{id:"scenario",step:"world",type:"textarea",label:"Your gacha world",required:"Describe your gacha world before continuing.",maxLength:4e3,placeholder:"e.g. A drowned neon city where salvaged spirits are bound into cards and fight for the tide-courts\u2026",hint:"A theme, a tone, and what you collect.",wide:!0},{id:"language",step:"world",settings:"sources",group:"narrator",type:"select",label:"Narration language",options:zr},{id:"name",step:"world",type:"text",label:"Name this run",maxLength:80,placeholder:"Untitled run"},{id:"protagonist",step:"you",type:"custom",render:"personas",label:"Your protagonist",required:"Pick your protagonist \u2014 a Marinara persona.",hint:"Their full sheet shapes the narration, not just their name.",wide:!0},{id:"username",step:"you",type:"text",label:"Your name",maxLength:40,placeholder:"Commander",hint:"Shown on your HUD profile &mdash; not the protagonist."},{id:"connectionId",step:"sources",settings:"sources",group:"narrator",type:"select",optionsFrom:"connections",label:"Narrator connection",required:"Pick the connection that will narrate.",hint:"Only text models are listed &mdash; image/video connections can't narrate."},{id:"lore",step:"sources",settings:"sources",group:"lore",type:"custom",render:"lorebooks",label:"Your lorebooks",wide:!0},{id:"hudStyle",step:"look",type:"custom",render:"styles",label:"HUD style",wide:!0},{id:"images.connectionId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageConnections",label:"Image connection",emptyOption:"Off \u2014 no art at all"},{id:"images.portraits",step:"look",settings:"sources",group:"images",type:"toggle",label:"Hero portraits",default:!0,showIf:e=>!!e["images.connectionId"],hint:"Painted right after your founding cast &mdash; it adds a few minutes to this setup."},{id:"images.styleProfileId",step:"look",settings:"sources",group:"images",type:"select",optionsFrom:"imageProfiles",label:"Portrait style",showIf:e=>!!e["images.connectionId"]},{id:"images.backgrounds",step:"look",settings:"sources",group:"images",type:"toggle",label:"Backgrounds",showIf:e=>!!e["images.connectionId"],hint:"Separate from portraits because it multiplies how many images a world paints."}],Or=[{id:"narrator",label:"Narrator"},{id:"lore",label:"Lorebooks"},{id:"images",label:"Images"}];function yt(e){let t=ke(e);return Or.map(r=>({...r,fields:t.filter(a=>a.group===r.id)})).filter(r=>r.fields.length)}function ke(e){return X.filter(t=>t.settings===e)}function Fe(e){return X.filter(t=>t.step===e)}function W(e,t){return!e.showIf||!!e.showIf(t||{})}function Dr(e){return X.filter(t=>W(t,e))}function wt(e,t){for(let r of Fe(e)){if(!r.required||!W(r,t))continue;let a=t?t[r.id]:null;if(a==null||a===""||Array.isArray(a)&&!a.length)return r}return null}function _e(e){let t={};for(let r of Dr(e)){let a=e[r.id];if(a===void 0)continue;let o=r.id.split("."),s=t;for(let n=0;n<o.length-1;n+=1)(!s[o[n]]||typeof s[o[n]]!="object")&&(s[o[n]]={}),s=s[o[n]];s[o[o.length-1]]=a}return t}var _t=`
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
`,$r='<svg class="ob-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="0,0 100,0 100,80 80,100 0,100" fill="var(--ink)"/><polygon points="4,4 96,4 96,78 78,96 4,96" fill="none" stroke="var(--steel-dark)" stroke-width="2.5"/><path d="M50 14 C53 41 59 47 86 50 C59 53 53 59 50 86 C47 59 41 53 14 50 C41 47 47 41 50 14 Z" fill="var(--coral)"/><path d="M50 30 C51.5 45 55 48.5 70 50 C55 51.5 51.5 55 50 70 C48.5 55 45 51.5 30 50 C45 48.5 48.5 45 50 30 Z" fill="var(--amber)" opacity=".9"/></svg>',St='Forge this world <span class="arrow">&#9656;</span>';function Ee(e){let t=Math.max(1,Math.min(3,Number(e)||1));return new Array(t).fill('<div class="ob-bookhead ob-bookgrid"><span>Book</span><span>World</span><span>Cast</span></div>').join("")}var Pr='<svg class="bx-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.4 6.6 11.5 12.5 4.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';function Hr(e,t){let r=s=>t&&t[s]?"true":"false",a=(s,n)=>'<button class="ob-bx" type="button" role="checkbox" aria-label="'+n+": "+H(e.name)+'" aria-checked="'+r(s)+'" data-book="'+H(e.id)+'" data-role="'+s+'">'+Pr+"</button>";return'<div class="ob-book ob-bookgrid'+(t&&(t.world||t.cast)?" on":"")+'"><span class="bt"><b>'+H(e.name)+"</b>"+(e.description?'<span class="bd">'+H(e.description)+"</span>":"")+"</span>"+a("world","World lore")+a("cast","Cast book")+"</div>"}function Le(e,t){let r=e.wide?" ob-wide":"",a=t&&t.hidden?" hidden":"",o=!!(t&&t.terse),s=e.label&&e.type!=="toggle"?"<label"+(e.type==="text"||e.type==="textarea"||e.type==="select"?' for="ob-'+Se(e.id)+'"':"")+">"+e.label+(e.required?' <span class="ob-req">*</span>':"")+"</label>":"",n=e.hint&&!o?'<span class="hint">'+e.hint+"</span>":"",l="";if(e.type==="custom")l=t&&t.custom?t.custom(e):"";else if(e.type==="textarea")l='<textarea id="ob-'+Se(e.id)+'" class="ob-control" data-input="'+I(e.id)+'"'+(e.maxLength?' maxlength="'+e.maxLength+'"':"")+(e.placeholder?' placeholder="'+I(e.placeholder)+'"':"")+"></textarea>";else if(e.type==="select"){let d=Array.isArray(e.options)?e.options.map(c=>'<option value="'+I(c.value)+'">'+I(c.label||c.value)+"</option>").join(""):"";l='<select id="ob-'+Se(e.id)+'" class="ob-control" data-input="'+I(e.id)+'">'+(e.emptyOption?'<option value="">'+I(e.emptyOption)+"</option>":"")+d+"</select>"}else e.type==="toggle"?l='<label class="ob-toggle"><button class="ob-bx" type="button" role="checkbox" aria-checked="false" data-input="'+I(e.id)+'" aria-label="'+I(e.label||e.id)+'"><span>\u2713</span></button><span class="bt"><b>'+(e.boxLabel||e.label||"")+"</b>"+(e.boxHint&&!o?'<span class="bd">'+e.boxHint+"</span>":"")+"</span></label>":l='<input id="ob-'+Se(e.id)+'" class="ob-control" data-input="'+I(e.id)+'" type="'+(e.type==="number"?"number":"text")+'"'+(e.maxLength?' maxlength="'+e.maxLength+'"':"")+(e.placeholder?' placeholder="'+I(e.placeholder)+'"':"")+" />";return'<div class="ob-field'+r+'" data-field="'+I(e.id)+'"'+a+">"+s+l+n+"</div>"}function Se(e){return String(e).replace(/[^A-Za-z0-9_-]+/g,"-")}function Ur(){return'<span class="hint"><b>World</b>: what is true here &mdash; <b>constant</b> entries always, the rest on their keywords; what does not fit the budget is <b>dropped</b>. <b>Cast</b>: the forge picks the sheets it is about to mint &mdash; <b>5</b> when the world is forged, <b>2</b> per featured banner &mdash; and never offers the same character twice.</span>'}function Me(e,t){if(e.render==="personas")return'<div class="ob-personas" role="radiogroup" aria-label="Protagonist persona" data-personas><span class="ob-personas-empty">Loading personas&hellip;</span></div>';if(e.render==="styles")return'<div class="ob-styles" role="radiogroup" aria-label="HUD style">'+ee.map(a=>{let[o,s,n]=a.swatch;return'<button class="ob-sw" type="button" role="radio" data-style-pick="'+a.id+'" aria-pressed="'+(a.id===Q)+'"><span class="mini" style="background:'+o+'"><i style="left:8%;top:9%;width:84%;height:14%;background:'+s+'"></i><i style="left:8%;top:30%;width:50%;height:36%;background:'+s+'"></i><i style="left:62%;top:30%;width:30%;height:16%;background:'+n+'"></i><i style="left:62%;top:50%;width:30%;height:16%;background:'+s+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+s+'"></i></span><span class="tick">&#10003;</span><span class="lbl"><b>'+a.label+"</b><span>"+a.description+"</span></span></button>"}).join("")+"</div>";if(e.render==="lorebooks"){let r=Math.max(1,Math.min(3,Number(t&&t.cols)||1));return'<div class="ob-booklist" role="group" aria-label="Lorebooks" data-cols="'+r+'" data-books>'+Ee(r)+'<span class="ob-books-empty">Reading your library&hellip;</span></div><div class="ob-budget"><label class="ob-bud"><span class="k">World tk</span><input type="number" min="0" step="500" data-budget="world" aria-label="World token budget" /><span class="w" data-weight="world"></span></label><label class="ob-bud"><span class="k">Cast tk</span><input type="number" min="0" step="500" data-budget="cast" aria-label="Cast token budget" /><span class="w" data-weight="cast"></span></label></div>'+Ur()}return""}function qr(e,t){let r=Fe(e.id).map(o=>Le(o,{custom:Me,hidden:!W(o,t||{})})).join("");return'<div class="ob-grid">'+(e.lead?'<p class="ob-lead ob-wide">'+e.lead+"</p>":"")+r+"</div>"}function Et({cancelable:e=!1,values:t={}}={}){let r=e?'<button class="ob-cancel" type="button" data-cancel>Cancel</button>':"",a=Z.map((s,n)=>'<button type="button" data-goto="'+(n+1)+'" data-state="'+(n===0?"active":"todo")+'" data-reachable="'+(n===0?"true":"false")+'"><span class="n">'+(n+1)+"</span>"+s.label+"</button>").join(""),o=Z.map((s,n)=>'<section class="ob-step" data-step="'+(n+1)+'" data-step-id="'+s.id+'"'+(n===0?"":" hidden")+">"+qr(s,t)+(n===Z.length-1?'<p class="ob-foot">Forging generates your <b>first chapter</b> &mdash; takes a moment.</p>':"")+"</section>").join("");return`
<div class="ob-root">
  <div class="ob-frame">
  <div class="ob-intake">
    <div class="ob-brand">
      ${$r}
      <div class="ob-word"><span class="name">Gacha <b>Forge</b></span></div>
    </div>
    <nav class="ob-steps" data-steps>${a}</nav>
    ${o}
    <p class="ob-error" hidden></p>
    <div class="ob-nav">
      <button class="ob-back" type="button" data-back hidden>&#9664; Back</button>
      <span class="ob-spacer"></span>
      ${r}
      <button class="ob-next" type="button" data-next>Next <span class="arrow">&#9656;</span></button>
      <button class="ob-forge" type="button" data-forge hidden>${St}</button>
    </div>
  </div>
  </div>
</div>`}var jr=new Set(["image_generation","video_generation"]),Tt="/api/gacha-forge";function H(e){return String(e??"").replace(/&/gu,"&amp;").replace(/</gu,"&lt;").replace(/>/gu,"&gt;").replace(/"/gu,"&quot;")}function xt(e){return e===!0||e==="true"||e===1||e==="1"}function I(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Gr(e){let t=String(e||"").trim().split(/\s+/).filter(Boolean),r=t[0]?t[0][0]:"",a=t[1]?t[1][0]:"";return(r+a).toUpperCase()||"?"}function Wr(e,t){let r=String(e?.id??""),a=String(e?.name??"Unnamed"),o=String(e?.comment??""),s=e?.avatarPath?`<span class="pav"><img src="${I(e.avatarPath)}" alt=""></span>`:`<span class="pav">${I(Gr(a))}</span>`;return`<button class="ob-persona" type="button" role="radio" data-persona="${I(r)}" data-selected="false">`+(t?'<span class="pactive">Active</span>':"")+'<span class="pcheck">&#10003;</span>'+s+`<span class="pname">${I(a)}</span><span class="pcomment">${I(o)}</span></button>`}function kt(e){return e?{personaId:String(e.id??""),name:String(e.name??"").trim(),comment:String(e.comment??""),description:String(e.description??""),personality:String(e.personality??""),appearance:String(e.appearance??""),backstory:String(e.backstory??""),scenario:String(e.scenario??""),tags:Array.isArray(e.tags)?e.tags.map(t=>String(t)):[],avatarPath:e.avatarPath?String(e.avatarPath):null}:null}function ze(e,{initial:t,onChange:r}={}){let a=t&&typeof t=="object"?t:{},o={world:new Set(Array.isArray(a.worldIds)?a.worldIds:[]),cast:new Set(Array.isArray(a.castIds)?a.castIds:[])},s=new Map,n=i=>e.querySelector('[data-budget="'+i+'"]'),l=()=>({worldIds:[...o.world],castIds:[...o.cast],worldBudget:Number(n("world")&&n("world").value),castBudget:Number(n("cast")&&n("cast").value)}),d=()=>{r&&r(l())};function c(){for(let i of["world","cast"]){let u=e.querySelector('[data-weight="'+i+'"]');if(!u)continue;let p=0,m=!1;for(let C of o[i]){let B=s.get(C);typeof B=="number"?p+=B:m=!0}let b=n(i),x=b&&b.value!==""?Number(b.value):NaN,w=Number.isFinite(x)?x:Number(b&&b.placeholder);if(!o[i].size){u.textContent="",u.setAttribute("data-over","false");continue}let k=p>=1e3?Math.round(p/100)/10+"k":String(p);u.textContent="picked \u2248"+k+(m?"+":""),u.setAttribute("data-over",Number.isFinite(w)&&p>w?"true":"false")}}function h(i,u){let p=e.querySelector("[data-books]");if(p){if(u){p.innerHTML=Ee(p.getAttribute("data-cols"))+'<span class="ob-books-empty">'+H(u)+"</span>";return}if(!i.length){p.innerHTML=Ee(p.getAttribute("data-cols"))+'<span class="ob-books-empty">No lorebooks in your library yet. Write or import one in Marinara and it shows up here.</span>';return}p.innerHTML=Ee(p.getAttribute("data-cols"))+i.map(m=>Hr(m,{world:o.world.has(m.id),cast:o.cast.has(m.id)})).join("");for(let m of p.querySelectorAll("[data-role]"))m.addEventListener("click",()=>{let b=m.getAttribute("data-book"),x=o[m.getAttribute("data-role")];if(!x)return;x.has(b)?x.delete(b):x.add(b),m.setAttribute("aria-checked",x.has(b)?"true":"false"),c();let w=m.parentNode;w&&w.classList&&w.classList.toggle("on",o.world.has(b)||o.cast.has(b)),d()})}}for(let i of["world","cast"]){let u=n(i),p=a[i+"Budget"];u&&p!==null&&p!==void 0&&Number.isFinite(Number(p))&&(u.value=String(p))}z(Tt+"/lorebooks").then(i=>i&&i.ok&&typeof i.json=="function"?i.json():null).then(i=>{if(i&&i.ok&&Array.isArray(i.books)){for(let p of i.books)p&&typeof p.tokens=="number"&&s.set(p.id,p.tokens);let u=i&&i.defaults||{};for(let p of["world","cast"]){let m=n(p);m&&(m.placeholder=String(Number(u[p])||(p==="cast"?2e4:6e3)))}h(i.books,null),c()}else h([],"Could not read your lorebooks. The world can still be forged without them.")}).catch(()=>h([],"Could not read your lorebooks. The world can still be forged without them."));for(let i of["world","cast"]){let u=n(i);u&&(u.addEventListener("input",c),u.addEventListener("change",d))}return{value:l}}function At(e,{onCreate:t,onCancel:r}){let a=f=>e.querySelector('[data-input="'+f+'"]'),o=f=>e.querySelector('[data-field="'+f+'"]'),s={};function n(){for(let f of X){let v=o(f.id);v&&(v.hidden=!W(f,s))}}let l=a("scenario"),d=a("name"),c=a("username"),h=a("connectionId"),i=a("images.connectionId"),u=o("images.connectionId")&&o("images.connectionId").querySelector(".hint"),p=o("images.styleProfileId"),m=a("images.styleProfileId"),b=e.querySelector("[data-personas]"),x=e.querySelector(".ob-error"),w=e.querySelector("[data-forge]"),k=e.querySelector("[data-cancel]");k&&k.addEventListener("click",()=>r&&r());let C=Z.length,B=Array.from(e.querySelectorAll("[data-step]")),Y=Array.from(e.querySelectorAll("[data-goto]")),_=e.querySelector("[data-back]"),O=e.querySelector("[data-next]"),S=1,P=1;function q(f){S=Math.min(C,Math.max(1,f)),P=Math.max(P,S);for(let v of B)v.hidden=Number(v.getAttribute("data-step"))!==S;for(let v of Y){let E=Number(v.getAttribute("data-goto"));v.setAttribute("data-state",E===S?"active":E<P?"done":"todo"),v.setAttribute("data-reachable",E<=P?"true":"false")}_&&(_.hidden=S===1),O&&(O.hidden=S===C),w&&(w.hidden=S!==C),D("")}for(let f of Y)f.addEventListener("click",()=>{let v=Number(f.getAttribute("data-goto"));v<=P&&q(v)});_&&_.addEventListener("click",()=>q(S-1)),O&&O.addEventListener("click",()=>{ie(S)&&q(S+1)});function ie(f){V();let v=Z[f-1]&&Z[f-1].id,E=v?wt(v,s):null;if(!E)return!0;D(E.required);let N=a(E.id);return N&&N.focus&&N.focus(),!1}function V(){for(let f of X){if(f.type==="custom")continue;let v=a(f.id);v&&(f.type==="toggle"?s[f.id]=v.getAttribute("aria-checked")==="true":f.type==="number"?s[f.id]=Number(v.value):s[f.id]=typeof v.value=="string"?v.value.trim():"")}n()}let le=ze(e,{}),K=Q;s.hudStyle=Q;let ce=e.querySelector(".gf-arena");for(let f of e.querySelectorAll("[data-style-pick]"))f.addEventListener("click",()=>{K=f.getAttribute("data-style-pick"),s.hudStyle=K;for(let v of e.querySelectorAll("[data-style-pick]"))v.setAttribute("aria-pressed",String(v===f));ce&&ce.setAttribute&&ce.setAttribute("data-style",K)});let de=null,he=[];function ve(f){de=f,s.protagonist=kt(f);for(let v of he)v.el.setAttribute("data-selected",v.persona===f?"true":"false")}function D(f){x&&(x.textContent=f||"",x.hidden=!f)}z("/api/connections").then(f=>f&&f.ok&&typeof f.json=="function"?f.json():Promise.reject(new Error("connections"))).then(f=>{let v=Array.isArray(f)?f:[],E=v.filter(T=>!jr.has(String(T?.provider??"")));if(v.length===0){D("No connection configured. Create one in the engine settings and come back.");return}if(E.length===0){D("Your connections are image or video only, and none can narrate. Configure a text connection in the engine settings.");return}h.innerHTML=E.map(T=>{let $=String(T?.id??""),me=String(T?.name??$),R=String(T?.model??"").trim(),be=R?`${me} \u2014 ${R}`:me;return`<option value="${$}">${be.replace(/</g,"&lt;")}</option>`}).join("");let N=E.find(T=>xt(T?.isDefault))??E.find(T=>xt(T?.fallbackForMain));N?.id&&(h.value=String(N.id))}).catch(()=>D("Could not read the engine connections."));for(let f of X.filter(v=>v.type==="toggle")){let v=a(f.id);v&&(s[f.id]=f.default===!0,v.setAttribute("aria-checked",s[f.id]?"true":"false"),v.addEventListener("click",()=>{s[f.id]=!s[f.id],v.setAttribute("aria-checked",s[f.id]?"true":"false")}))}let Be=f=>{s["images.connectionId"]=f?i&&i.value||"on":"",n()};z(`${Tt}/image-options`).then(f=>f&&f.ok&&typeof f.json=="function"?f.json():null).then(f=>{let v=f&&Array.isArray(f.connections)?f.connections:[];if(!v.length){u&&(u.textContent="No image connection is configured in the engine, so portraits stay off. Heroes show a silhouette when they speak."),i&&(i.disabled=!0);return}i&&(i.innerHTML='<option value="">Off</option>'+v.map(N=>`<option value="${H(N.id)}">${H(N.name)}</option>`).join(""));let E=f&&Array.isArray(f.profiles)?f.profiles:[];m&&(m.innerHTML=E.length?E.map(N=>`<option value="${H(N.id)}">${H(N.name)} &mdash; ${H(N.promptMode)}</option>`).join(""):'<option value="">Engine default</option>')}).catch(()=>{}),i&&i.addEventListener("change",()=>Be(!!i.value)),Promise.all([z("/api/characters/personas/list").then(f=>f&&f.ok&&typeof f.json=="function"?f.json():[]).catch(()=>[]),z("/api/characters/personas/active").then(f=>f&&f.ok&&typeof f.json=="function"?f.json():null).catch(()=>null)]).then(([f,v])=>{if(!b)return;let E=Array.isArray(f)?f:f&&Array.isArray(f.items)?f.items:[];if(E.length===0){b.innerHTML='<span class="ob-personas-empty">No personas in Marinara yet &mdash; create one there first, then come back.</span>';return}let N=v&&v.id;b.innerHTML=E.map(T=>Wr(T,T.id===N)).join(""),he=[];for(let T of E){let $=e.querySelector('[data-persona="'+String(T.id??"")+'"]');$&&(he.push({persona:T,el:$}),$.addEventListener("click",()=>ve(T)))}ve(E.find(T=>T.id===N)||E[0])}),w?.addEventListener("click",async()=>{if(!(l?.value||"").trim()){D("Describe your gacha world before forging."),l?.focus?.();return}if(!de){D("Pick your protagonist \u2014 a Marinara persona.");return}if(!(h?.value||"")){D("Pick the connection that will narrate.");return}let E=(d?.value||"").trim(),N=(c?.value||"").trim(),T=kt(de);D(""),w&&(w.disabled=!0,w.textContent="Forging\u2026");try{V(),s.protagonist=T,s.hudStyle=K,s.lore=le.value(),await t(_e(s))}catch($){w&&(w.disabled=!1,w.innerHTML=St),D(`Could not start: ${$ instanceof Error?$.message:String($)}`)}}),q(1)}var re=[{id:"visual",kicker:"Look",label:"Visual"},{id:"sources",kicker:"World",label:"Sources"},{id:"debug",kicker:"Diagnostics",label:"Debug"}],ae="visual";function L(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Yr(e){let t=pe(e);return ee.map(r=>{let[a,o,s]=r.swatch;return'<button class="st-sty" type="button" data-style-set="'+r.id+'" aria-pressed="'+(r.id===t)+'"><span class="st-mini" style="background:'+a+'"><i style="left:8%;top:10%;width:84%;height:14%;background:'+o+'"></i><i style="left:8%;top:31%;width:50%;height:34%;background:'+o+'"></i><i style="left:62%;top:31%;width:30%;height:15%;background:'+s+'"></i><i style="left:8%;top:72%;width:84%;height:18%;background:'+o+'"></i></span><span class="st-tick">&#10003;</span><span class="st-swlbl"><b>'+r.label+"</b><span>"+r.description+"</span></span></button>"}).join("")}function Vr(e){let t=te(e);return ye.map(r=>'<button class="st-chip" type="button" data-text-scale="'+r+'" aria-pressed="'+(r===t)+'">'+Math.round(r*100)+"%</button>").join("")}function Kr({hudStyle:e,textScale:t}){return'<div class="st-plate"><div class="hd"><h3>HUD style</h3></div><div class="st-styles">'+Yr(e)+'</div></div><div class="st-plate"><div class="hd"><h3>Text size</h3></div><div class="st-chips" role="group" aria-label="Text size">'+Vr(t)+"</div></div>"}function Zr(e,t){let r=e;for(let a of String(t).split(".")){if(!r||typeof r!="object")return;r=r[a]}return r}function Ct(e,t){let r={};for(let a of ke(t)){let o=Zr(e,a.id);r[a.id]=o===void 0?a.default:o}return r}function Xr(e){return yt("sources").map(t=>{let r=t.fields.length===1,a=t.fields.map(o=>Le(r?{...o,label:""}:o,{custom:Me,hidden:!W(o,e),terse:!0})).join("");return'<div class="st-plate"><div class="hd"><h3>'+L(t.label)+'</h3></div><div class="ob-grid">'+a+"</div></div>"}).join("")+'<p class="st-foot">Applies to what this world generates next; nothing already made is redrawn.</p>'}function Jr(e){let t=e&&e.status||"idle";if(t==="loading")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Reading&hellip;</div></div>';if(t==="error")return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">Could not read the lorebook status.</div></div>';if(t!=="ready")return"";let r=e&&e.data||{};if(!r.enabled)return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks</span></div><div class="st-tl-msg">This world uses no lorebooks. Pick them in Sources.</div></div>';let a=d=>Number.isFinite(Number(d))?Number(d).toLocaleString("en-US"):"&mdash;",o=(d,c,h)=>{if(!c)return"";let i=c.dropped>0;return'<span class="st-tl-tot"><i>'+d+"</i><b>"+a(c.entries)+" / "+a(c.pool)+' entries</b></span><span class="st-tl-tot"><i>tokens</i><b>'+a(c.tokens)+" / "+a(h)+"</b></span>"+(i?'<span class="st-tl-warn">'+a(c.dropped)+" entr"+(c.dropped===1?"y":"ies")+" will NOT fit &mdash; the generator works from a fragment</span>":"")},s=(Array.isArray(r.next)?r.next:[]).map(d=>d.uses===!1?'<div class="st-tl-row"><span class="st-tl-l">'+L(d.label)+'</span><span class="st-tl-o">no lore</span></div><div class="st-tl-note">'+L(d.why||"")+"</div>":'<div class="st-tl-row"><span class="st-tl-l">'+L(d.label)+'</span></div><div class="st-tl-totals">'+o("world",d.world,r.budgets&&r.budgets.world)+o("cast",d.cast,r.budgets&&r.budgets.cast)+"</div>").join(""),n=r.library||{};return'<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Lorebooks &mdash; what the next call carries</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+('<div class="st-tl-totals"><span class="st-tl-tot"><i>world books</i><b>'+a(n.world&&n.world.books)+'</b></span><span class="st-tl-tot"><i>cast books</i><b>'+a(n.cast&&n.cast.books)+'</b></span><span class="st-tl-tot"><i>already minted</i><b>'+a(r.minted)+"</b></span>"+((r.missing||[]).length?'<span class="st-tl-warn">'+(r.missing||[]).length+" book(s) this world points at no longer exist</span>":"")+"</div>")+s+"</div>"}function Qr(){return'<section class="st-plate st-build"><div class="hd"><h3>Build</h3></div><div class="st-build-row"><span class="k">Package version</span><b data-build-version>v'+L(it)+"</b></div></section>"}function Oe(e,t){return Qr()+Jr(e)+ea(t)}function ea(e){let t=e&&e.status||"idle",r=e&&Array.isArray(e.entries)&&e.entries||[],a=e&&e.totals||null,o=d=>Number.isFinite(d)?Number(d).toLocaleString("en-US"):"&mdash;",s=d=>{let c=new Date(Number(d)||0),h=i=>String(i).padStart(2,"0");return h(c.getHours())+":"+h(c.getMinutes())+":"+h(c.getSeconds())},n;return t==="loading"?n='<div class="st-tl-msg">Reading&hellip;</div>':t==="error"?n='<div class="st-tl-msg">Could not read the token log.</div>':r.length?n='<div class="st-tl-rows">'+r.map(d=>'<div class="st-tl-row'+(d.outcome==="ok"?"":" bad")+'"><span class="st-tl-t">'+s(d.at)+'</span><span class="st-tl-l">'+L(d.label)+(d.attempt>1?'<b class="st-tl-retry">retry '+d.attempt+"</b>":"")+'</span><span class="st-tl-u st-tl-up">'+o(d.sent)+'</span><span class="st-tl-u st-tl-dn">'+o(d.received)+'</span><span class="st-tl-o">'+L(d.outcome)+"</span></div>").join("")+"</div>":n='<div class="st-tl-msg">No model calls recorded for this world yet.</div>','<div class="st-tl"><div class="st-tl-head"><span class="st-tl-title">Model calls</span><button class="st-tl-refresh" type="button" data-token-refresh>Refresh</button></div>'+(a?'<div class="st-tl-totals"><span class="st-tl-tot"><i>sent</i><b>'+o(a.sent)+'</b></span><span class="st-tl-tot"><i>received</i><b>'+o(a.received)+'</b></span><span class="st-tl-tot"><i>calls</i><b>'+o(a.calls)+"</b></span>"+(a.cached?'<span class="st-tl-tot"><i>of that cached</i><b>'+o(a.cached)+"</b></span>":"")+(a.cacheWrite?'<span class="st-tl-tot"><i>cache writes</i><b>'+o(a.cacheWrite)+"</b></span>":"")+(a.unreported?'<span class="st-tl-warn">'+a.unreported+" call(s) reported no usage &mdash; the totals are short by that much</span>":"")+(a.dropped?'<span class="st-tl-warn">'+o(a.dropped)+" older call(s) dropped past the "+o(a.capped)+"-row cap</span>":"")+"</div>":"")+n+'<p class="st-tl-note">Every model call this world has ever made, newest first &mdash; kept across restarts. Portrait generation is not here: it goes to the engine over HTTP, not through the language model.</p></div>'}function Nt({category:e=ae,backLabel:t="Home",hudStyle:r="",textScale:a=null,tokenLog:o=null,loreStatus:s=null,run:n=null}={}){let l=re.some(u=>u.id===e)?e:ae,d=re.find(u=>u.id===l)||re[0],c=re.map(u=>'<button class="st-sect" type="button" role="tab" aria-selected="'+(u.id===l)+'" data-view="'+u.id+'"><span class="k">'+L(u.kicker)+'</span><span class="n">'+L(u.label)+"</span></button>").join(""),h={visual:()=>Kr({hudStyle:r,textScale:a}),sources:()=>Xr(Ct(n,"sources")),debug:()=>Oe(s,o)},i=h[l]?h[l]():"";return'<div class="root"><div class="stage"></div><section class="screen" data-screen="settings"><div class="head"><button class="back" type="button" data-settings-back>&#9664; '+L(t)+'</button><div class="head-id"><div class="eyebrow">Settings</div><h2>'+L(d.label)+'</h2></div></div><div class="body"><div class="st-rail" role="tablist">'+c+'</div><div class="st-pane" data-view-body="'+l+'">'+i+"</div></div></section></div>"}function Rt(e,{open:t,category:r,run:a,onOpen:o,onBack:s,onCategory:n,onStyle:l,onTextScale:d,onSources:c}={}){for(let i of e.querySelectorAll('[aria-label="Game settings"]'))i.addEventListener("click",()=>o&&o(ae));if(!t)return;for(let i of[e.querySelector(".root"),e.querySelector(".gf-bar")])i&&i.addEventListener("click",u=>{let p=b=>u&&u.target&&u.target.closest?u.target.closest(b):null;if(p("[data-settings-back]")){s&&s();return}let m=p("[data-view]");m&&n&&n(m.getAttribute("data-view"))});let h=e.querySelector(".st-pane");if(h&&h.addEventListener("click",i=>{i&&i.target&&i.target.closest&&i.target.closest("[data-token-refresh]")&&n&&n("debug")}),r==="visual"){for(let i of e.querySelectorAll("[data-style-set]"))i.addEventListener("click",()=>{let u=i.getAttribute("data-style-set");for(let p of e.querySelectorAll("[data-style-set]"))p.setAttribute("aria-pressed",String(p===i));l&&l(u)});for(let i of e.querySelectorAll("[data-text-scale]"))i.addEventListener("click",()=>d&&d(i.getAttribute("data-text-scale")))}r==="sources"&&ta(e,{run:a,onSources:c})}function ta(e,{run:t,onSources:r}){let a=ke("sources"),o=h=>e.querySelector('[data-input="'+h+'"]'),s=h=>e.querySelector('[data-field="'+h+'"]'),n=Ct(t,"sources"),l=()=>{for(let h of a){let i=s(h.id);i&&(i.hidden=!W(h,n))}},d=()=>{l(),r&&r(_e(n))},c=ze(e,{initial:n.lore,onChange:h=>{n.lore=h,d()}});n.lore=c.value();for(let h of a){if(h.type==="custom")continue;let i=o(h.id);i&&(h.type==="toggle"?(i.setAttribute("aria-checked",n[h.id]?"true":"false"),i.addEventListener("click",()=>{let u=i.getAttribute("aria-checked")!=="true";i.setAttribute("aria-checked",u?"true":"false"),n[h.id]=u,d()})):(typeof n[h.id]=="string"&&(i.value=n[h.id]),i.addEventListener("change",()=>{n[h.id]=typeof i.value=="string"?i.value.trim():"",d()})))}l(),aa(e,a,n)}var ra=new Set(["image_generation","video_generation"]);function aa(e,t,r){let a=n=>t.some(l=>l.optionsFrom===n),o=(n,l,d)=>{let c=e.querySelector('[data-input="'+n+'"]');if(!c)return;c.innerHTML=(d?'<option value="">'+L(d)+"</option>":"")+l.map(i=>'<option value="'+L(i.value)+'">'+L(i.label)+"</option>").join("");let h=r[n];typeof h=="string"&&l.some(i=>i.value===h)?c.value=h:d&&(c.value=""),c.disabled=l.length===0&&!d},s=n=>{let l=t.find(d=>d.optionsFrom===n);return l&&l.emptyOption?l.emptyOption:""};a("connections")&&z("/api/connections").then(n=>n&&n.ok&&typeof n.json=="function"?n.json():null).then(n=>{let d=(Array.isArray(n)?n:n&&Array.isArray(n.connections)?n.connections:[]).filter(c=>c&&!ra.has(String(c.provider??""))).map(c=>({value:String(c.id),label:String(c.name||c.model||c.id)}));for(let c of t)c.optionsFrom==="connections"&&o(c.id,d,s("connections"))}).catch(()=>{}),(a("imageConnections")||a("imageProfiles"))&&z("/api/gacha-forge/image-options").then(n=>n&&n.ok&&typeof n.json=="function"?n.json():null).then(n=>{let l=(n&&Array.isArray(n.connections)?n.connections:[]).map(c=>({value:String(c.id),label:String(c.name||c.model||c.id)})),d=(n&&Array.isArray(n.profiles)?n.profiles:[]).map(c=>({value:String(c.id),label:String(c.name)+" \u2014 "+String(c.promptMode)}));for(let c of t)c.optionsFrom==="imageConnections"&&o(c.id,l,s("imageConnections")),c.optionsFrom==="imageProfiles"&&o(c.id,d,d.length?"":"Engine default")}).catch(()=>{})}var Bt=`

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
`;function oe(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var oa=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];function sa(e){let t=oa[e];return t?`Chapter ${t}`:`Chapter ${e}`}var It=["Reading the scenario\u2026","Forging the chapter\u2026","Writing the story beats\u2026"],De=["Reading the scenario\u2026","Summoning the founding cast\u2026","Naming the heroes\u2026"],$e=`
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
`,na=`
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
</svg>`,ia='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';function la(){return{label:"Founding Cast",status:De[0],eyebrow:"Summoning the founding cast",brandNote:"&middot; first-time setup",foot:"Summoning this world's founding heroes from your scenario &mdash; the cast the story is built around. This happens once.",errorStatus:"Couldn't summon the founding cast.",errorBody:"The summon returned units that didn't match the expected format. Nothing was saved."}}function ca({done:e=0,total:t=0,name:r=""}={}){let a=Math.min(e+1,Math.max(t,1));return{label:"Founding Cast",status:r?`Painting ${r}\u2026 ${a}/${t}`:`Painting the founding cast\u2026 ${e}/${t}`,eyebrow:"Painting the founding cast",brandNote:"&middot; first-time setup",foot:"Generating each hero's portrait, one at a time, so they have a face when they speak in the story. The first chapter is being forged at the same time.",errorStatus:"Couldn't paint the cast.",errorBody:"No portrait could be generated. Check the world's image connection &mdash; the story is ready either way, and the heroes will show their silhouette until art exists.",retryLabel:"Continue"}}function da(e,t){let r=Number(t)<=1;return{label:e,status:It[0],eyebrow:r?"Forging the first chapter":"Forging the next chapter",brandNote:r?"&middot; first-time setup":"&middot; new chapter",foot:r?`Forging ${oe(e)}'s story beats from your scenario. This happens once &mdash; the story is written before you play it.`:`Forging ${oe(e)}'s story beats from your scenario &mdash; the story is written before you play it.`,errorStatus:"Couldn't read the forged chapter.",errorBody:"The forge returned a plan that didn't match the expected format. Nothing was saved."}}function Pe({scenario:e,chapter:t=1,error:r=!1,mode:a="chapter",art:o}){let s=e&&e.trim()?e.trim():"Your scenario",n=a==="banner"?la():a==="art"?ca(o):da(sa(t),t),l=n.label,d=r?n.errorStatus:n.status,c=n.eyebrow,h=n.brandNote,i=n.foot;return`
<div class="root">
  <div class="forge-stage"></div>
  <div class="forge${r?" -error":""}">
    <div class="forge-brand">
      <span class="rhombus" aria-hidden="true"></span>
      <b>Gacha Forge</b><span>${h}</span>
    </div>

    <div class="forge-center">
      ${na}
      <span class="eyebrow">${c}</span>
      <h2>${oe(l)}</h2>
      <span class="scenario">${oe(s)}</span>
      <div class="forge-status" aria-live="polite">${oe(d)}</div>
      <p class="forge-error"${r?"":" hidden"}>${n.errorBody}</p>
      <button class="forge-retry" type="button"${r?"":" hidden"}>${oe(n.retryLabel||"Retry")}</button>
    </div>

    <p class="forge-foot">
      ${ia}
      <span>${i}</span>
    </p>
  </div>
</div>`}function He(e,{onRetry:t,cycle:r,phases:a}){let o=e.querySelector(".forge-retry");o&&o.addEventListener("click",()=>t?.());let s=e.querySelector(".forge-status");if(!r||!s)return()=>{};let n=Array.isArray(a)&&a.length?a:It,l=0;s.textContent=n[0];let d=setInterval(()=>{l=(l+1)%n.length,s.textContent=n[l]},1100);return()=>clearInterval(d)}var Ft={blade:()=>'<path d="M150 30 176 150 166 320 150 350 134 320 124 150Z"/><rect x="108" y="300" width="84" height="18"/><rect x="140" y="318" width="20" height="56"/><circle cx="150" cy="384" r="12"/>',edge:()=>'<path d="M150 96c22 44 30 108 21 176l-13 30-8 8-8-8-13-30c-9-68-1-132 21-176Z"/><path d="M104 306h92v18h-92Z"/><rect x="139" y="324" width="22" height="48"/><path d="M150 360 168 380 150 400 132 380Z"/>',bulwark:()=>'<path d="M150 34 254 74c0 130-30 232-104 300C76 306 46 204 46 74Z"/><path d="M150 96v212M92 150h116" stroke="#0E1420" stroke-opacity="0.32" stroke-width="9" fill="none"/>',focus:e=>'<circle cx="150" cy="228" r="74"/><path d="M150 40 172 86 150 132 128 86Z"/><ellipse cx="150" cy="228" rx="122" ry="44" fill="none" stroke="'+e+'" stroke-width="11"/>',tome:()=>'<path d="M132 70h74q18 0 18 18v224q0 18-18 18h-74Z"/><path d="M78 70h36v260H78q-9 0-9-12V82q0-12 9-12Z"/><path d="M224 98h18v204h-18Z"/>'};function J(e,t){let r="url(#"+t+")",a=Ft[e]||Ft.blade;return'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="'+r+'">'+a(r)+"</g></svg>"}var ha=1.5;var pa=1.6,fa=.65,ua=.15,ga=1.1,va=.25,Lt=.15,Mt=.1,zt=.6;function se(e){let t=Number(e);return Math.max(.2,Math.min(6,(Number.isFinite(t)?t:100)/100))}function j(e){return Math.max(Mt,Math.min(zt,se(e)*Lt))}var ma=30;var ba=3,ya=.4,wa=1,xa=3,ka=.35,_a=35,Sa=.5,Ea=1;var Ta=1.8,Aa=.05,Ca=2,Na=.08,Ra=15,Ba=.4,Ia=12,Fa=.3,La=.35,Ma=.02,za=.1,Oa=.18,Da=.2,Ot={ATK_K:ha,ULT_SINGLE:pa,ULT_AOE:fa,HEAL_SCALE:ua,SHIELD_SCALE:ga,DOT_SCALE:va,BUFF_SCALE:Lt,BUFF_MIN:Mt,BUFF_MAX:zt,FOCUS:Ta,DOT_ROUNDS:xa,BUFF_ROUNDS:ba,REVIVE_PCT:ka,ENERGY_GRANT:_a,DRAIN_SHARE:ya,LOW_PCT:La,AURA_REGEN:Ma,AURA_MITIGATION:za,AURA_SHIELD:Oa,RESIST_MITIGATION:Da,RIDER_BURN:Aa,RIDER_FLOW:Na,RIDER_HASTE:Ra,RIDER_BULWARK:Ba,RIDER_RADIANCE:Ia,RIDER_BLIGHT:Fa,EXECUTE_BONUS:wa,ENERGY_KILL:ma,RIDER_BURN_ROUNDS:Ca,CLEANSE_SHARE:Sa,STUN_TURNS:Ea};var g=Ot;function y(e){return Math.round(Number(e)*1e3)/10+"%"}var Dt=new Set(["enemy","ally","self"]),$a=["damage","aoe_damage","debuff","drain","execute","dot","stun"];function Pa(e,t){let r=$a.includes(e);if(e==="aoe_damage"&&Dt.has(t))return"every enemy";switch(t){case"self":return r?"the weakest front-line enemy":"itself";case"enemy":return"the weakest front-line enemy";case"ally":return"the ally who needs it most";case"allies":return"the whole team";case"all_enemies":return"every enemy";case"front_row":return r?"the enemy front line":"your front line";case"back_row":return r?"the enemy BACK line \u2014 past the front":"your back line";default:return r?"the weakest front-line enemy":"the whole team"}}function Ue(e){return!Dt.has(e.target)||e.effect==="aoe_damage"}var Ha={fire:"<b>Fire</b> also burns what it hits for <b>"+y(g.RIDER_BURN)+" of that target's max HP</b> per round, for 2 rounds.",water:"<b>Water</b> also heals your most hurt ally for <b>"+y(g.RIDER_FLOW)+" of the caster's own max HP</b>.",wind:"<b>Wind</b> also gives every teammate <b>+"+g.RIDER_HASTE+" energy</b> (a full bar is 100).",earth:"<b>Earth</b> also shields your front line for <b>"+y(g.RIDER_BULWARK)+" of the caster's DEF</b> each.",light:"<b>Light</b> also clears one DEF debuff from the team and gives everyone <b>+"+g.RIDER_RADIANCE+" energy</b>.",dark:"<b>Dark</b> also returns <b>"+y(g.RIDER_BLIGHT)+" of the damage dealt</b> to the caster as health."};function $t(e){return Ha[String(e||"").toLowerCase()]||""}function Pt(e){if(!e||!e.effect)return"";let t=se(e.power),r=Pa(e.effect,e.target),a=Ue(e),o=a?1:g.FOCUS;switch(e.effect){case"damage":case"drain":{let s=(a?g.ULT_AOE:g.ULT_SINGLE)*t,n=e.effect==="drain"?" Heals the caster for "+y(g.DRAIN_SHARE)+" of what it deals.":"";return"Hits "+r+" for <b>"+y(s)+" of ATK</b>"+(a?" each":"")+"."+n}case"aoe_damage":return"Sweeps "+r+" for <b>"+y(g.ULT_AOE*t)+" of ATK</b> each.";case"execute":return"Hits "+r+" for <b>"+y(g.ULT_SINGLE*t)+" of ATK</b>, up to <b>"+y(g.ULT_SINGLE*t*2)+"</b> against a target that is nearly down.";case"dot":return"Poisons "+r+" for <b>"+y(g.DOT_SCALE*t)+" of ATK</b> per round, for "+g.DOT_ROUNDS+" rounds. Ignores shields.";case"stun":return"Makes "+r+" lose its next turn.";case"heal":return"Heals "+r+" for <b>"+y(g.HEAL_SCALE*t*o)+" of the caster's own max HP</b>.";case"shield":return"Shields "+r+" for <b>"+y(g.SHIELD_SCALE*t*o)+" of the caster's DEF</b>.";case"cleanse":return"Clears poison, stuns and debuffs from "+r+", and heals <b>"+y(g.HEAL_SCALE*.5*t*o)+" of the caster's max HP</b>.";case"revive":return"Brings one fallen ally back at <b>"+y(g.REVIVE_PCT)+"</b> health.";case"energy":return"Fills "+r+"'s ultimate bar by <b>"+Math.round(g.ENERGY_GRANT*o)+"</b> points.";case"buff":return"Raises "+r+"'s ATK by <b>"+y(j(e.power)*o)+"</b> for "+g.BUFF_ROUNDS+" rounds.";case"debuff":return"Drops "+r+"'s DEF by <b>"+y(j(e.power)*o)+"</b> for "+g.BUFF_ROUNDS+" rounds.";default:return""}}function Ht(e){return!e||!["damage","drain","execute"].includes(e.effect)?"":((Ue(e)?g.ULT_AOE:g.ULT_SINGLE)*se(e.power)/g.ATK_K).toFixed(1)+"&times; a normal hit"}var Ua={battle_start:"As the fight opens",self:"As the fight opens",aura:"For the whole fight",on_hit:"Each time this unit is struck",on_attack:"Each time this unit swings",on_kill:"Each time this unit finishes someone",on_ally_low:"The first time an ally drops below <b>"+y(g.LOW_PCT)+" health</b> (once per battle)",on_low:"The first time this unit drops below <b>"+y(g.LOW_PCT)+" health</b> (once per battle)",resist:"For the whole fight",on_round:"On every one of this unit's turns",on_ult:"When this unit casts its Ultimate",on_death:"When this unit falls",cooldown:"Every few rounds",energy:"When the energy bar fills"};function Ut(e){if(!e||!e.trigger)return"";let t=Ua[e.trigger]||"Sometimes",r=e.target==="self"?"itself":e.effect==="debuff"?"every enemy":"the whole team",a=se(e.power),o;e.trigger==="resist"?o="it takes <b>"+y(g.RESIST_MITIGATION)+" less damage</b>":e.trigger==="aura"&&e.effect==="buff"?o="the whole team takes <b>"+y(g.AURA_MITIGATION)+" less damage</b>":e.trigger==="aura"&&e.effect==="heal"?o="every ally regenerates <b>"+y(g.AURA_REGEN*a)+" of THIS unit's max HP</b> at the start of each of their turns":e.trigger==="aura"&&e.effect==="shield"?o="every ally gets a fresh shield worth <b>"+y(g.AURA_SHIELD*a)+" of its DEF</b> at the start of each of their turns":e.effect==="buff"?o="it raises "+r+"'s ATK by <b>"+y(j(e.power))+"</b>":e.effect==="debuff"?o="it drops "+r+"'s DEF by <b>"+y(j(e.power))+"</b>":e.effect==="shield"?o="it shields "+r+" for <b>"+y(g.SHIELD_SCALE*.5*a)+" of its DEF</b>":e.effect==="heal"?o="it heals "+r+" for <b>"+y(g.HEAL_SCALE*.5*a)+" of its max HP</b>":o="it strikes back";let s=e.trigger==="on_kill"?" It also gains energy.":"";return t+", "+o+"."+s}function qt(e,t){if(!e||!(Number(e.power)>0))return null;let r=se(e.power),a=Ue(e),o=a?1:g.FOCUS;if(t)return e.trigger==="resist"?{value:y(g.RESIST_MITIGATION),stat:"less damage"}:e.trigger==="aura"&&e.effect==="buff"?{value:y(g.AURA_MITIGATION),stat:"less damage"}:e.trigger==="aura"&&e.effect==="heal"?{value:"",stat:"Regen"}:e.trigger==="aura"&&e.effect==="shield"?{value:"",stat:"Shield each round"}:e.effect==="buff"?{value:y(j(e.power)),stat:"ATK up"}:e.effect==="debuff"?{value:y(j(e.power)),stat:"DEF down"}:e.effect==="shield"?{value:y(g.SHIELD_SCALE*.5*r),stat:"of DEF"}:e.effect==="heal"?{value:y(g.HEAL_SCALE*.5*r),stat:"of max HP"}:null;switch(e.effect){case"damage":case"drain":return{value:y((a?g.ULT_AOE:g.ULT_SINGLE)*r),stat:"ATK"};case"aoe_damage":return{value:y(g.ULT_AOE*r),stat:"ATK"};case"execute":return{value:y(g.ULT_SINGLE*r),stat:"ATK"};case"dot":return{value:y(g.DOT_SCALE*r),stat:"ATK per round"};case"heal":return{value:y(g.HEAL_SCALE*r*o),stat:"of max HP"};case"shield":return{value:y(g.SHIELD_SCALE*r*o),stat:"of DEF"};case"buff":return{value:y(j(e.power)*o),stat:"ATK up"};case"debuff":return{value:y(j(e.power)*o),stat:"DEF down"};case"energy":return{value:String(Math.round(g.ENERGY_GRANT*o)),stat:"energy"};case"revive":return{value:y(g.REVIVE_PCT),stat:"health"};default:return null}}function A(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Gt(e){return e===5?"\u2605\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605\u2605"}function Wt(e){return e===5?"r5":"r4"}function fe(e){return String(e||"").split(",")[0].trim()}var qa={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>'},ja={character:'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g fill="url(#gf-sil)"><circle cx="150" cy="92" r="44"/><path d="M150 144c-48 0-82 32-90 78l-12 178h204l-12-178c-8-46-42-78-90-78Z"/></g><path d="M150 50c0 0 28 15 28 45s-28 45-28 45-28-15-28-45 28-45 28-45Z" fill="none" stroke="#F2603C" stroke-opacity="0.4" stroke-width="2"/></svg>'};function jt(e){return(Number(e)||0).toLocaleString("en-US")}var Ga='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Wa='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h11a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',Ya='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',Va='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 16.4 8.4 11.6l4 4 3.2-3.2 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="8" r="1.6" stroke="currentColor" stroke-width="1.6"/></svg>',Ka='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3 21 3 21 10 9 22 3 22 3 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.5 9.5 8 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',qe='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-sil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',je=`
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

/* SLICE: the Growth, Ascension, Form, Gear (rack + picker + feed) and Facets styles
   lived here \u2014 all progression, which ships in later PRs. */
/* The blocked tabs and the disabled party button, in the vocabulary the dock uses. */
.cp-tabs button[disabled] { cursor: default; color: var(--steel-dark); }
.cp-tabs button[disabled] .soon { margin-left: calc(var(--f) * 0.4); font-size: var(--t-tiny); letter-spacing: 0.18em; text-transform: var(--case); color: var(--steel-dark); }
.cp-party[disabled] { cursor: default; background: var(--ink-2); border-color: var(--ink-3); color: var(--steel-faint); }


@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;function Za(e,t){let r=typeof e=="string"?e.trim():"";return r?'<img class="u-photo" src="'+A(r)+'" alt="" loading="lazy">':t}function Xa(e){let t=e.kind!=="weapon",r=t?e.role:e.weaponType+(e.dedicatedTo?" \xB7 for "+fe(e.dedicatedTo):"");return'<button class="'+("u "+Wt(e.rarity)+(e.isProtagonist?" you":""))+'" type="button" data-unit="'+A(e.id)+'">'+(e.isProtagonist?'<span class="u-you">You</span>':"")+'<div class="u-art'+(t?"":" wpn")+'">'+Za(e.portrait,"")+'<span class="u-stars">'+Gt(e.rarity)+"</span>"+(e.portrait?"":t?qa.character:J(e.weaponType,"gf-sil"))+'<span class="u-lvl">Lv '+(Number(e.level)||1)+"</span>"+(t?'<span class="bond-pip">&#9829;'+(Number(e.bond)||0)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+A(e.name)+'</div><div class="u-role">'+A(r)+"</div></div></button>"}var Ja='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/></svg>',Qa='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';function eo(e,t){let r=String(t||"").trim().toLowerCase();return!r||String(e.name||"").toLowerCase().includes(r)?!0:(e.kind==="weapon"?[e.weaponType]:[e.role,e.affinity]).some(o=>String(o||"").toLowerCase()===r)}function Ce(e,t,r,a){let o=t!=="wpn";return(e||[]).filter(s=>s.kind!=="weapon"===o).filter(s=>r==="all"||String(s.rarity)===r).filter(s=>eo(s,a))}function Yt(e,t,r){return r==="loading"?'<div class="grid-empty">Loading units&hellip;</div>':r==="error"?'<div class="grid-empty">Couldn&rsquo;t load your units.</div>':e.length?e.map(Xa).join(""):'<div class="grid-empty">No '+(t?"characters":"weapons")+" here yet.</div>"}function to(e,t,r){let a=!!String(e||"").trim();return'<div class="u-search'+(a?" on":"")+'"><span class="ic">'+Ja+'</span><input type="search" data-unit-search placeholder="Search by name, role or affinity" value="'+A(e||"")+'">'+(a?'<button class="clr" type="button" data-unit-search-clear aria-label="Clear search">'+Qa+"</button>":"")+'<span class="ct" data-unit-search-count>'+(a?t+" / "+r:r)+"</span></div>"}function Vt(e,{cards:t=[],cat:r="char",rarity:a="all",q:o="",state:s="ready"}={}){if(!e||typeof e.querySelector!="function")return!1;let n=e.querySelector("[data-grid]");if(!n)return!1;let l=r!=="wpn",d=Ce(t,r,a,o);n.innerHTML=Yt(d,l,s);let c=e.querySelector(".u-search");c&&typeof c.setAttribute=="function"&&(String(o||"").trim()?c.setAttribute("data-on","1"):c.removeAttribute("data-on"));let h=e.querySelector("[data-unit-search-count]");if(h){let i=Ce(t,r,a,"").length;h.textContent=String(o||"").trim()?d.length+" / "+i:String(i)}return!0}function Kt({cards:e=[],cat:t="char",rarity:r="all",state:a="ready",q:o=""}={}){let s=t!=="wpn",n=Ce(e,t,r,o),l=Ce(e,t,r,"").length,d=h=>h?' aria-pressed="true"':' aria-pressed="false"',c=Yt(n,s,a);return`
<div class="root">
  ${qe}
  <div class="stage"></div>
  <section class="screen" data-screen="roster">
    <div class="head">
      <button class="back" type="button" data-roster-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Command</div><h2>Units</h2></div>
    </div>
    <div class="roster-body gf-swap">
      <div class="toolbar">
        <div class="cats">
          <button type="button" data-cat="char"${d(s)}>${Ya}Characters</button>
          <button type="button" data-cat="wpn"${d(!s)}>${Ka}Weapons</button>
        </div>
        ${to(o,n.length,l)}
        <div class="filters">
          <span class="lbl">Rarity</span>
          ${xe.map(h=>`<button class="chip${h.tone?" "+h.tone:""}" type="button" data-rar="${h.id}"${d(r===h.id)}>${h.label}</button>`).join("")}
        </div>
      </div>
      <div class="grid-scroll"><div class="grid" data-grid>${c}</div></div>
    </div>
  </section>
</div>`}function ne(e,t,r,a){let o=Math.min(100,Math.max(0,Number(t)||0)),s=r===void 0?Number(t)||0:Number(r)||0,n=Number(a)>0?" <em>+"+jt(Math.round(Number(a)))+"</em>":"";return'<div class="stat"><span class="k">'+e+'</span><div class="bar"><i style="width:'+o+'%"></i></div><span class="v">'+jt(s)+n+"</span></div>"}var ro=[["crit","Crit rate",15,"%"],["critDmg","Crit DMG",150,"%"],["recharge","Energy rech.",100,"%"],["effectHit","Effect hit",0,"%"],["effectRes","Effect RES",0,"%"],["healBonus","Healing",0,"%"]];function ao(e,t){let r=t||{};return ro.map(([a,o,s,n])=>{let l=Number(e[a]),d=Number.isFinite(l),c=d?l:s,h=Number(r[a])||0;return'<div class="stat sec2'+(d?" own":"")+'"><span class="k">'+o+'</span><span class="v">'+Math.round((c+h)*10)/10+n+(h>0?" <em>+"+Math.round(h*10)/10+n+"</em>":"")+"</span></div>"}).join("")}var oo={damage:"Damage",aoe_damage:"AoE damage",heal:"Heal",shield:"Shield",buff:"Buff",debuff:"Debuff"},so={enemy:"Enemy",all_enemies:"All enemies",ally:"Ally",allies:"Allies",self:"Self",front_row:"Front row",back_row:"Back row"},no={front:"Front-line role",back:"Back-line role"};function Ae(e){return String(e||"").replace(/_/g," ").replace(/^\w/,t=>t.toUpperCase())}function io(e,t,r,a){let o=[];r&&e.trigger&&o.push('<span class="m trig">'+A(Ae(e.trigger))+"</span>"),e.effect&&o.push('<span class="m">'+A(oo[e.effect]||Ae(e.effect))+"</span>");let s=qt(e,!!a);return s&&o.push('<span class="m">'+(s.value?s.value+" ":"")+"<b>"+s.stat+"</b></span>"),e.target&&o.push('<span class="m">'+A(so[e.target]||Ae(e.target))+"</span>"),t&&o.push('<span class="m aff">'+A(t)+"</span>"),o.length?'<div class="mech">'+o.join("")+"</div>":""}function Te(e,t,r,a,o){if(!t||!t.name)return"";let s=o?Ut(t):Pt(t),n=o?"":Ht(t),l=o?"":$t(r),d=s?'<div class="derived">'+s+(n?' <span class="vs">'+n+"</span>":"")+(l?'<span class="rider">'+l+"</span>":"")+"</div>":"";return'<div class="sec"><div class="h">'+e+'</div><div class="skill"><span class="ic">'+Ga+'</span><div><div class="sn">'+A(t.name)+"</div>"+io(t,r,a,o)+d+'<p class="flavour">'+A(t.description)+"</p></div></div></div>"}function lo(e,t,r){let a=e.kind!=="weapon",o="";if(a&&(o+='<div class="sec"><div class="h">Combat</div><div class="mech">',e.role&&(o+='<span class="m">'+A(e.role)+"</span>"),e.affinity&&(o+='<span class="m aff">'+A(e.affinity)+"</span>"),e.position&&(o+='<span class="m">'+A(no[e.position]||Ae(e.position))+"</span>"),o+="</div></div>"),o+='<div class="sec"><div class="h">Stats</div><div class="stats">',a){let s=e.stats||{},l=1+((Number(t)>0?Number(t):1)-1)*.06,d=r||{},c=(m,b)=>(Number(m)||0)*(1+(Number(b)||0)),h=Math.round(20+c(s.hp,d.hpPct)*6*l),i=Math.round(c(s.atk,d.atkPct)*l),u=Math.round(c(s.def,d.defPct)*l),p=Math.round(c(s.spd,d.spdPct));o+=ne("HP",s.hp,h,h-Math.round(20+(Number(s.hp)||0)*6*l)),o+=ne("ATK",s.atk,i,i-Math.round((Number(s.atk)||0)*l)),o+=ne("DEF",s.def,u,u-Math.round((Number(s.def)||0)*l)),o+=ne("SPD",s.spd,p,p-(Number(s.spd)||0)),o+="</div></div>",o+='<div class="sec"><div class="h">Combat stats</div><div class="stats two">'+ao(s,d)}else{let s=e.mainStat||{},n=e.subStat||{};o+=ne("ATK",s.value)+ne(String(n.key||"SUB").toUpperCase(),n.value)}if(o+="</div></div>",a?(o+=Te("Skill",e.skill,e.affinity,!1,!1),o+=Te("Passive",e.passive,e.affinity,!0,!0),o+='<div class="sec"><div class="h">Profile</div>',e.description&&(o+="<p>"+A(e.description)+"</p>"),e.personality&&(o+="<p>"+A(e.personality)+"</p>"),o+="</div>"):(o+=Te("Granted skill",e.grantedSkill,null,!0,!1),o+=Te("Passive",e.passive,null,!0,!0),o+='<div class="sec"><div class="h">About</div><p>'+A(e.description)+"</p></div>"),!e.isProtagonist){let s=e.origin||{},n=s.banner==="standard"?"Standard Banner":s.banner||"Standard Banner";o+='<div class="sec"><div class="h">Origin</div><div class="origin"><span>From <b>'+A(n)+"</b></span>"+(a?'<span class="story-chip">'+Wa+"In the story cast pool</span>":"")+"</div></div>"}return o}function co(e,t){let r=Number(t)||0,a=fe(e.name)||"this unit";return'<div class="bond-meter"><div class="top"><span class="lv">&#9829; Bond '+r+'</span><span class="xp">'+(r>0?"in progress":"not started")+'</span></div><div class="track"><i style="width:'+(r>0?12:0)+'%"></i></div><div class="note">Affinity grows by bringing '+A(a)+' into story beats and battles. Each bond level will unlock a character event.</div></div><div class="sec"><div class="h">Character events</div><p>Character events unlock as bond grows &mdash; the relationship system is coming.</p></div>'}function Zt({unit:e,level:t=1,bond:r=0,tab:a="profile",state:o="ready"}={}){if(o==="loading"||!e)return`
<div class="root">
  ${qe}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">Unit</div><h2>${o==="error"?"Unavailable":"Loading\u2026"}</h2></div>
    </div>
    <div class="cp-body"><div class="grid-empty" style="grid-column:1/-1">${o==="error"?"Couldn't load this unit.":"Loading\u2026"}</div></div>
  </section>
</div>`;let s=e.kind!=="weapon",n=s&&!e.isProtagonist,l=s?[["profile","Profile",!0],["growth","Growth",!1],["gear","Gear",!1],...n?[["bond","Bond",!0]]:[]]:[["profile","Profile",!0],["growth","Growth",!1]],d=a==="bond"&&n?"bond":"profile",c=l.map(([p,m,b])=>b?'<button type="button" role="tab" data-tab="'+p+'" aria-selected="'+(p===d?"true":"false")+'">'+m+"</button>":'<button type="button" role="tab" disabled>'+m+'<span class="soon">Soon</span></button>').join(""),h=d==="bond"?co(e,r):lo(e,t,null),i=s?e.role:e.weaponType+(e.dedicatedTo?" \xB7 for "+fe(e.dedicatedTo):""),u='<div class="cp-portrait">'+(e.portrait?'<img class="cp-photo" src="'+A(e.portrait)+'" alt="" loading="lazy">':s?ja.character:J(e.weaponType,"gf-sil"))+'</div><div class="cp-id-top">'+(s&&!e.isProtagonist?'<button class="cp-art-btn" type="button" data-portrait>'+Va+"Portrait</button>":"")+'<button class="cp-fav" type="button" aria-pressed="false" data-fav><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 3.2C20 14.5 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div><div class="cp-id-plate"><div class="plate-stars '+Wt(e.rarity)+'">'+Gt(e.rarity)+"</div><h3>"+A(fe(e.name))+'</h3><div class="role">'+A(i)+'</div><div class="chips"><span>Lv '+(Number(t)||1)+"</span>"+(s?'<span class="bond">&#9829; Bond '+(Number(r)||0)+"</span>":"")+'</div><button class="cp-party" type="button" disabled>'+(s?"Set to party":"Equip to a character")+"</button></div>";return`
<div class="root">
  ${qe}
  <div class="stage"></div>
  <section class="screen" data-screen="unit">
    <div class="head">
      <button class="back" type="button" data-back-roster>&#9664; Units</button>
      <div class="head-id"><div class="eyebrow">${s?"Character":"Weapon"}</div><h2>${A(fe(e.name))}</h2></div>
    </div>
    <div class="cp-body gf-swap">
      <div class="cp-id${s?"":" wpn"}">${u}</div>
      <div class="cp-main">
        <div class="cp-tabs" role="tablist">${c}</div>
        <div class="cp-panel">${h}</div>
      </div>
    </div>
  </section>
</div>`}function Xt(e,{onOpenUnit:t,onBack:r,onCat:a,onRarity:o,onSearch:s}){for(let c of e.querySelectorAll("[data-unit]"))c.addEventListener("click",()=>t&&t(c.dataset.unit));for(let c of e.querySelectorAll("[data-cat]"))c.addEventListener("click",()=>a&&a(c.dataset.cat));for(let c of e.querySelectorAll("[data-rar]"))c.addEventListener("click",()=>o&&o(c.dataset.rar));let n=e.querySelector("[data-unit-search]");n&&n.addEventListener("input",()=>s&&s(n.value||""));let l=e.querySelector("[data-unit-search-clear]");l&&l.addEventListener("click",()=>{n&&(n.value=""),s&&s(""),n&&typeof n.focus=="function"&&n.focus()});let d=e.querySelector("[data-roster-back]");d&&d.addEventListener("click",()=>r&&r())}function Jt(e,{onTab:t,onBack:r,onPortrait:a}){for(let n of e.querySelectorAll("[data-tab]"))n.addEventListener("click",()=>t&&t(n.dataset.tab));let o=e.querySelector("[data-back-roster]");o&&o.addEventListener("click",()=>r&&r());let s=e.querySelector("[data-portrait]");s&&s.addEventListener("click",()=>a&&a())}var Ne=.6666666666666666;function U(e){return String(e??"").replace(/[&<>"']/gu,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function ue(e){let t=Array.isArray(e)?e:String(e??"").split(","),r=[];for(let a of t){let o=String(a??"").trim();o&&!r.includes(o)&&r.push(o)}return r}function Ge(e,t,r=1,a=.5,o=.5){let s=Math.max(1,Number(e)||1),n=Math.max(1,Number(t)||1),l=Math.min(s,n*Ne),d=Math.min(1,Math.max(.2,Number(r)||1)),c=l*d,h=c/Ne;return We({x:s*a-c/2,y:n*o-h/2,w:c,h},s,n)}function We(e,t,r){let a=Math.max(1,Number(t)||1),o=Math.max(1,Number(r)||1),s=Math.min(Math.max(1,Number(e&&e.w)||1),a),n=s/Ne;n>o&&(n=o,s=n*Ne);let l=Math.min(Math.max(0,Number(e&&e.x)||0),a-s),d=Math.min(Math.max(0,Number(e&&e.y)||0),o-n);return{x:l,y:d,w:s,h:n}}var Qt=`
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
`;function ho(e,t){return'<span class="pt-chip">'+U(e)+'<button type="button" data-tag-drop="'+t+'" aria-label="Remove '+U(e)+'">&times;</button></span>'}function po(e,t){return e.length?'<div class="pt-strip">'+e.map((r,a)=>'<button class="pt-thumb" type="button" aria-current="'+(r.current?"true":"false")+'"'+(r.current?" disabled":' data-pick="'+a+'"')+' title="'+U(r.source==="upload"?"Your own image":"Generated")+'"><img src="'+U(r.url)+'" alt="" loading="lazy">'+(r.current?'<span class="now">Now</span>':"")+"</button>").join("")+"</div>":'<div class="pt-empty">No earlier art yet \u2014 the first redo puts this one here, and the last '+t+" are kept.</div>"}function er({unit:e=null,view:t="edit",draft:r=null,history:a=[],historyMax:o=0,busy:s=!1,error:n="",crop:l=null,promptName:d=""}={}){let c=e&&e.name?String(e.name):"Portrait",h=r||{appearance:"",tags:[]},i=ue(h.tags),u='<div class="head"><button class="back" type="button" data-portrait-back>&#9664; '+U(c)+'</button><div class="head-id"><div class="eyebrow">Portrait</div><h2>'+(t==="crop"?"Choose the frame":"Redo the art")+"</h2></div></div>";if(t==="crop"){let b=l&&l.src||"",x=Math.round((l&&l.size||1)*100),w=l&&l.natural,k=w&&l.frame?' style="left:'+l.frame.x/w.w*100+"%;top:"+l.frame.y/w.h*100+"%;width:"+l.frame.w/w.w*100+"%;height:"+l.frame.h/w.h*100+'%"':"";return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait-crop">
    ${u}
    <div class="pt-crop gf-swap">
      <div class="pt-canvas">
        <div class="pt-shot" data-shot${w?' style="aspect-ratio:'+w.w+" / "+w.h+'"':""}>
          <img src="${U(b)}" alt="" data-crop-img>
          <div class="pt-frame" data-frame${k}></div>
        </div>
      </div>
      <div class="pt-crop-bar">
        <label class="pt-size">Frame<input type="range" min="20" max="100" value="${x}" data-size></label>
        <button class="pt-alt" type="button" data-crop-cancel>Cancel</button>
        <button class="pt-go" type="button" data-crop-ok${s?" disabled":""}>${s?"Uploading\u2026":"Use this frame"}</button>
      </div>
    </div>
  </section>
</div>`}let p=a.find(b=>b.current)||null,m=n?'<div class="pt-note bad">'+U(n)+"</div>":'<div class="pt-note">Art goes through the image API \u2014 it costs no story tokens.</div>';return`
<div class="root">
  <div class="stage"></div>
  <section class="screen" data-screen="portrait">
    ${u}
    <div class="pt-body gf-swap">
      <div class="pt-main">
        <div class="pt-now">
          ${p?'<img src="'+U(p.url)+'" alt="" loading="lazy">':'<div class="pt-none">No portrait yet</div>'}
          ${p?'<span class="pt-tag">'+(p.source==="upload"?"Your image":"Generated")+"</span>":""}
        </div>
        <div class="pt-editor">
          <div class="pt-field grow">
            <!-- \u{1F534} EL NOMBRE, A LA VISTA. Se antepone al prompt SIEMPRE y no se puede editar: un
                 modelo entrenado con booru conoce nombres de personaje como etiqueta, asi que un
                 heroe sacado de un libro de elenco se REPLICA en vez de solo describirse, y la
                 posicion pesa. Pero esta pantalla rotula sus campos como \xABlo que se va a enviar\xBB y
                 el nombre no estaba entre ellos: preguntado por el user, \xABno aparece en el prompt\xBB.
                 Se enviaba. La pantalla decia media verdad, que es peor que no decir nada. -->
            <div class="pt-sent"><b>Sent first:</b> <span data-prompt-name>${U(d||"(no name)")}</span>
              <span class="pt-hint">Added automatically, always ahead of the text below.</span></div>
            <div class="pt-label">Appearance<span class="pt-hint">What the image model reads. English only &mdash; a backend rejects the rest.</span></div>
            <textarea class="pt-text" data-appearance spellcheck="false" placeholder="Describe her as the image model should see her.">${U(h.appearance)}</textarea>
          </div>
          <div class="pt-field">
            <div class="pt-label">Tags<span class="pt-hint">Booru tags. These win over the prose when your style profile is tagged.</span></div>
            <div class="pt-tags" data-tags>
              ${i.map(ho).join("")}
              <input class="pt-add" data-tag-add type="text" placeholder="add a tag, Enter" spellcheck="false">
            </div>
          </div>
          <div class="pt-actions">
            <button class="pt-go" type="button" data-generate${s?" disabled":""}>${s?"Painting\u2026":"Paint it again"}</button>
            <button class="pt-alt" type="button" data-upload${s?" disabled":""}>Use my own image\u2026</button>
            <input class="pt-file" type="file" accept="image/png,image/jpeg,image/webp" data-file>
            ${m}
          </div>
        </div>
      </div>
      <div class="pt-past">
        <div class="cap">Earlier</div>
        ${po(a,o)}
      </div>
    </div>
  </section>
</div>`}function tr(e,{onBack:t,onDraft:r,onGenerate:a,onPick:o,onFile:s,onCropSize:n,onCropFrame:l,onCropOk:d,onCropCancel:c}={}){let h=_=>e.querySelector(_),i=h("[data-portrait-back]");i&&i.addEventListener("click",()=>t&&t());let u=h("[data-appearance]");u&&u.addEventListener("input",()=>r&&r({appearance:u.value}));let p=h("[data-tag-add]");p&&p.addEventListener("keydown",_=>{if(_.key!=="Enter"&&_.key!==",")return;_.preventDefault();let O=String(p.value||"").trim();O&&(p.value="",r&&r({addTag:O}))});for(let _ of e.querySelectorAll("[data-tag-drop]"))_.addEventListener("click",()=>r&&r({dropTag:Number(_.getAttribute("data-tag-drop"))}));let m=h("[data-generate]");m&&m.addEventListener("click",()=>a&&a());for(let _ of e.querySelectorAll("[data-pick]"))_.addEventListener("click",()=>o&&o(Number(_.getAttribute("data-pick"))));let b=h("[data-file]"),x=h("[data-upload]");x&&b&&x.addEventListener("click",()=>b.click()),b&&b.addEventListener("change",()=>{let _=b.files&&b.files[0];b.value="",_&&s&&s(_)});let w=h("[data-size]");w&&w.addEventListener("input",()=>n&&n(Number(w.value)/100));let k=h("[data-crop-ok]");k&&k.addEventListener("click",()=>d&&d());let C=h("[data-crop-cancel]");C&&C.addEventListener("click",()=>c&&c());let B=h("[data-frame]"),Y=h("[data-shot]");if(B&&Y&&l){let _=null;B.addEventListener("pointerdown",S=>{_={x:S.clientX,y:S.clientY},B.classList.add("drag"),B.setPointerCapture&&B.setPointerCapture(S.pointerId),S.preventDefault()}),B.addEventListener("pointermove",S=>{if(!_)return;let P=Y.getBoundingClientRect();l({dx:(S.clientX-_.x)/(P.width||1),dy:(S.clientY-_.y)/(P.height||1)}),_={x:S.clientX,y:S.clientY}});let O=()=>{_=null,B.classList.remove("drag")};B.addEventListener("pointerup",O),B.addEventListener("pointercancel",O)}}function Ye(e,t,r,a){let o=e.querySelector("[data-frame]"),s=e.querySelector("[data-crop-img]");if(!o||!s||!t)return;let n=Math.max(1,Number(r)||1),l=Math.max(1,Number(a)||1);o.style.left=t.x/n*100+"%",o.style.top=t.y/l*100+"%",o.style.width=t.w/n*100+"%",o.style.height=t.h/l*100+"%"}function rr(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var fo=[{match:/:banner:char:/,cost:"tokens",label:()=>"Minting this week's characters"},{match:/:banner:wpn:/,cost:"tokens",label:()=>"Minting this week's weapons"},{match:/:banner:standard$/,cost:"tokens",label:()=>"Forging the founding cast"},{match:/:banner-art:/,cost:"images",label:()=>"Painting the banner"}],uo=[{at:"/banner",cost:"tokens",label:"Forging the founding cast"},{at:"/summon-banner",cost:"tokens",label:"Checking this week's banner"},{at:"/protagonist",cost:"tokens",label:"Building your unit"},{at:"/portrait/upload",cost:"images",label:"Sending your image"},{at:"/portrait",cost:"images",label:"Painting a portrait"},{at:"/banner-art",cost:"images",label:"Painting the banner"}],go=["/portrait/select"];function ar(e){let t=String(e||"");if(go.includes(t))return null;for(let r of uo)if(t===r.at||t.startsWith(r.at+"/"))return{cost:r.cost,label:r.label};return null}function vo(e){let t=String(e||"");for(let r of fo){let a=t.match(r.match);if(a)return{cost:r.cost,label:r.label(a)}}return t?{cost:"tokens",label:"Generating"}:null}function mo(e){let t=Number(e&&e.total)||0;if(!t)return null;let r=Math.min(t,Number(e.done)||0);return{cost:"images",label:e&&e.name?`Painting ${e.name}`:"Painting portraits",detail:`${r+1} of ${t}`}}function or({generating:e=[],local:t=[],art:r=null,background:a=null}={}){let o=[],s=new Set,n=l=>{!l||s.has(l.label)||(s.add(l.label),o.push(l))};for(let l of Array.isArray(t)?t:[])n(l);for(let l of Array.isArray(e)?e:[])n(vo(l));return n(mo(r)),a&&n({cost:"images",label:"Painting a location",detail:String(a)}),o}function sr(e){return(Array.isArray(e)?e:[]).map(t=>t.label+(t.detail||"")).join("|")}var nr=`
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
`;function ir(e,{max:t=2}={}){let r=Array.isArray(e)?e.filter(Boolean):[];if(!r.length)return"";let a=r.slice(0,t),o=r.length-a.length;return'<div class="gb-busy" data-busy aria-live="polite">'+a.map(s=>'<div class="gb-row '+(s.cost==="images"?"images":"text")+'"><span class="gb-dot"></span><span class="gb-what"><b>'+rr(s.label)+"</b>"+(s.detail?" &middot; "+rr(s.detail):"")+'</span><span class="gb-cost">'+(s.cost==="images"?"image":"tokens")+"</span></div>").join("")+(o>0?'<div class="gb-more">+'+o+" more running</div>":"")+"</div>"}function M(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function cr(e){return e>=5?"\u2605\u2605\u2605\u2605\u2605":e===4?"\u2605\u2605\u2605\u2605":"\u2605\u2605\u2605"}function Ke(e){return String(e||"").split(",")[0].trim()}function Re(e){let t=Number(e)||0;return(t*100>=10,(t*100).toFixed(1)).replace(/\.0$/,"")+"%"}var bo={character:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><circle cx="50" cy="34" r="16"/><path d="M50 52c-17 0-29 11-32 27l-4 46h72l-4-46c-3-16-15-27-32-27Z"/></g></svg>',material:'<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="url(#gf-ssil)"><path d="M50 20 78 52 50 110 22 52Z"/><path d="M50 20 50 110M22 52h56" stroke="#0E1420" stroke-opacity="0.35" stroke-width="3"/></g></svg>'};var Ve='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="#F0B429" stroke="#B8860B" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2 7 12l5 10" stroke="#FFF" stroke-opacity="0.5" stroke-width="1.2"/></svg>',yo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z" fill="var(--on-coral)" stroke="var(--on-coral)" stroke-width="1.4" stroke-linejoin="round"/></svg>',wo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';var xo='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" stroke="currentColor" stroke-width="1.8"/></svg>',ko='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ze='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gf-ssil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.9"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.12"/></linearGradient></defs></svg>',Je=`
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
.bname { position: absolute; left: var(--sp-3); top: var(--sp-3); right: calc(var(--f) * 16); z-index: 2; }
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
.float .pulls { max-width: calc(var(--f) * 34); }

/* The Details sheet: the one thing the splash hides. It opens OVER the art \u2014 comparing the
   pool with the banner offering it is the point of looking. */
.sheet { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); background: color-mix(in srgb, var(--ground-2) 92%, transparent); backdrop-filter: var(--panel-blur); }
.sheet-head { display: flex; align-items: center; gap: var(--sp-2); flex: none; }
.sheet-head h4 { margin: 0; font-family: var(--title); font-stretch: var(--stretch); font-weight: var(--title-weight); font-size: var(--t-lg); letter-spacing: var(--track); text-transform: var(--case); }
.sheet-head .spacer { flex: 1; }
.strips { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-2); overflow: hidden; }
.strip-label { font-family: var(--display); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: var(--case); color: var(--steel-faint); flex: none; }
.strip-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
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
`,_o={bulwark:"Bulwark",blade:"Blade",focus:"Focus",tome:"Tome",edge:"Edge"};function ge(e){let t=e.kind==="weapon"?"weapon":e.kind==="material"?"material":"character",r=Number(e.rarity)||3,a=t==="material"?"Material":Ke(e.name)||"Unit",o;if(t==="material")o="Material";else if(t==="weapon"){let s=_o[e.weaponType]||(e.weaponType?e.weaponType:"Weapon");o=e.dedicatedTo?`${s} \xB7 ${Ke(e.dedicatedTo)}'s signature`:s}else o=e.role?`${e.role}${e.affinity?" \xB7 "+e.affinity:""}`:"";return{kind:t,rarity:r,name:a,role:o,weaponType:e.weaponType||"",dedicatedTo:e.dedicatedTo||"",portrait:e.portrait||null,isNew:!!e.isNew,up:!!e.up,facet:e.facet||null}}function So(e,t){let r=typeof e=="string"?e.trim():"";return r?'<img class="u-photo" src="'+M(r)+'" alt="" loading="lazy">':t}function Eo(e,t){let r=e.kind==="material"?" mat":e.kind==="weapon"?" wpn":"",a=t&&e.kind!=="character"?'<span class="kind-tag">'+(e.kind==="weapon"?"Weapon":"Material")+"</span>":"",o=e.up?'<span class="pill-up">UP</span>':"";return'<div class="u-art'+r+'">'+So(e.portrait,"")+'<span class="u-stars">'+cr(e.rarity)+"</span>"+o+(e.portrait?"":e.kind==="weapon"?J(e.weaponType,"gf-ssil"):bo[e.kind])+a+(e.isNew?'<span class="tag-new">NEW</span>':e.facet?'<span class="tag-new fct">'+(e.facet.gained?"FACET "+e.facet.facet:"FACET "+e.facet.facet+"/"+e.facet.max)+"</span>":"")+'</div><div class="u-meta"><div class="u-name">'+M(e.name)+'</div><div class="u-role">'+M(e.role)+"</div></div>"}function Xe(e,t){return'<article class="u r'+(Number(e.rarity)||3)+'">'+Eo(e,t)+"</article>"}function lr(e){let t=null;for(let r of e){let a=ge(r);(!t||a.rarity>t.rarity)&&(t=a)}return t}function dr(e){let t=Number(e);if(!Number.isFinite(t)||t<=0)return"";let r=Math.floor(t/6e4);if(r<60)return Math.max(1,r)+"m left";let a=Math.floor(r/60);if(a<24)return a+"h left";let o=Math.floor(a/24),s=a-o*24;return s>0?o+"d "+s+"h left":o+"d left"}function To(e,t){let r=M(e.id);if(e.live===!1)return'<button class="bcard" type="button" aria-disabled="true" data-banner="'+r+'"><span class="bt-face empty">'+xo+'</span><span class="bt-id"><b>'+M(e.title||e.id)+"</b><i>Not open yet</i></span></button>";let a=e.face?'<span class="bt-face" style="background-image:url('+M(e.face)+')"></span>':e.kind==="weapon"?'<span class="bt-face sil">'+J(e.weaponType||"blade","gf-ssil")+"</span>":'<span class="bt-face empty">'+wo+"</span>",o=e.pity||{},s=Number(o.hard)||80,n=Number(o.count)||0,l=Math.max(0,Math.min(100,n/s*100)),d=e.pending?"Opens when you pick it":e.type==="featured"?"Featured \xB7 "+(dr(e.endsInMs)||"ending"):"Permanent";return'<button class="bcard" type="button" data-banner="'+r+'" aria-pressed="'+(e.id===t)+'">'+a+'<span class="bt-id"><b>'+M(e.title||e.id)+"</b><i>"+d+'</i><span class="bt-pity"><span class="bt-track"><i style="width:'+l.toFixed(0)+'%"></i></span><em>'+n+"/"+s+(o.guaranteed?" \xB7 gtd":"")+"</em></span></span></button>"}function hr({banners:e=[],banner:t,rates:r,pity:a,wallet:o,cost:s=160,bannerId:n="char-standard",state:l="ready",details:d=!1,arting:c=!1}={}){let h=Number(o&&o.aether)||0,i=Array.isArray(e)?e:[],u='<div class="rail"><div class="rail-scroll">'+(i.length?i.map(R=>To(R,n)).join(""):"")+"</div></div>";if(l!=="ready"||!t){let R=l==="error"?"Try again in a moment, or pick another banner.":"Summoning this week's featured cast \u2014 the first open of a new week takes a few seconds. Pick another banner to pull now.";return`
<div class="root">
  ${Ze}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${Ve}<b>${h.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show"><div class="soon-panel"><div class="h">${l==="error"?"Couldn't open the banner":"Working\u2026"}</div><p>${R}</p></div></div>
    </div>
  </section>
</div>`}let p=t,m=p.kind==="weapon"?"weapon":"character",b=Array.isArray(p.featured)?p.featured.map(ge):[],x=b.find(R=>R.rarity===5)||b[0]||null,w=b.find(R=>R.rarity===4)||null,k=typeof p.art=="string"&&!!p.art.trim(),C;if(k)C='<div class="art wide" style="background-image:url('+M(p.art)+')"></div>';else if(m==="weapon")C='<div class="art"><div class="artback flat"></div><div class="plates"><div class="plate sil">'+J(x&&x.weaponType||"blade","gf-ssil")+"</div></div></div>";else{let R=x&&x.portrait?M(x.portrait):"",be=w&&w.portrait?M(w.portrait):"";C='<div class="art">'+(R?'<div class="artback" style="background-image:url('+R+')"></div>':'<div class="artback flat"></div>')+'<div class="plates">'+(R?'<div class="plate five" style="background-image:url('+R+')"></div>':"")+(be?'<div class="plate four" style="background-image:url('+be+')"></div>':"")+"</div></div>"}let B=p.type==="featured"?dr(p.endsInMs):"",Y=p.type==="featured"?"Featured \xB7 5\u2605 "+m+(B?" \xB7 "+B:""):"Permanent pool",_=p.title||(x?x.name:"Banner"),O=x?Ke(x.name)+(x.role?" \xB7 "+M(x.role):""):"The permanent pool. Every retired featured unit folds in here.",S=r||{},P='<div class="rates"><span><b class="g">\u2605\u2605\u2605\u2605\u2605</b> '+Re(S.five)+'</span><span><b class="e">\u2605\u2605\u2605\u2605</b> '+Re(S.four)+"</span>"+(p.type==="featured"?'<span>Rate-up <b class="g">'+Re(S.featured)+"</b></span>":"<span>No rate-up</span>")+"</div>",q=a||{},ie=Number(q.count)||0,V=Number(q.hard)||80,le=Number(q.soft)||74,K=Math.max(0,V-ie),ce=Math.min(100,ie/V*100),de=Math.min(100,le/V*100),he=Re(S.featured||(p.kind==="weapon"?.75:.5)),ve=p.type==="featured"?"Guaranteed 5\u2605 in <b>"+K+"</b> \xB7 soft pity from "+le+" \xB7 "+(q.guaranteed?"next 5\u2605 <b>is</b> the rate-up":"next 5\u2605 is a "+he+" chance for the rate-up"):"Guaranteed 5\u2605 in <b>"+K+"</b> \xB7 soft pity from "+le+" \xB7 5\u2605 from the standard pool",D='<div class="pity"><div class="fig"><span>Pity to 5\u2605 '+(p.kind==="character"?"character":"weapon")+"</span><span><b>"+ie+"</b> / "+V+'</span></div><div class="track"><i style="width:'+ce.toFixed(1)+'%"></i><span class="soft" style="left:'+de.toFixed(1)+'%"></span></div><div class="note">'+ve+"</div></div>",Be=h>=s,f=h>=s*10,v='<div class="pulls"><button class="pull one" type="button" data-pull="1"'+(Be?"":' aria-disabled="true"')+'><span class="big">Summon</span><span class="cost">'+Ve+" "+s+' \xB7 \xD71</span></button><button class="pull ten" type="button" data-pull="10"'+(f?"":' aria-disabled="true"')+'><span class="big">Summon \xD710</span><span class="cost">'+yo+" "+s*10+" \xB7 one 4\u2605+ guaranteed</span></button></div>",N=p.canArt===!0?'<button class="chip" type="button" data-redo-art'+(c?' aria-disabled="true"':"")+">"+ko+(c?"Painting\u2026":k?"Redo art":"Paint art")+"</button>":"",T=Array.isArray(p.pool4)?p.pool4.map(ge):[],$=p.type==="featured"?"Also in this banner":"Also in the permanent pool",me=d?'<div class="sheet" data-sheet><div class="sheet-head"><h4>'+M(_)+'</h4><span class="spacer"></span><button class="chip" type="button" data-details-close>Close</button></div>'+P+'<div class="strips"><span class="strip-label">'+(p.type==="featured"?"Rate-up":"Standard 5\u2605")+'</span><div class="strip-scroll"><div class="featured">'+b.map(R=>Xe({...R,up:p.type==="featured"},!0)).join("")+"</div></div>"+(T.length?'<span class="strip-label">'+$+'</span><div class="strip-scroll"><div class="featured">'+T.map(R=>Xe({...R,up:!1},!0)).join("")+"</div></div>":"")+"</div></div>":"";return`
<div class="root">
  ${Ze}
  <div class="stage"></div>
  <section class="screen" data-screen="banner">
    <div class="head">
      <button class="back" type="button" data-summon-back>&#9664; Command</button>
      <div class="head-id"><div class="eyebrow">Summon</div><h2>Banners</h2></div>
      <div class="wallet">${Ve}<b>${h.toLocaleString("en-US")}</b><small>Aether</small></div>
    </div>
    <div class="banner-body gf-swap">
      ${u}
      <div class="show">
        ${C}
        <div class="veil"></div>
        <div class="bname"><span class="kicker">${Y}</span><h3>${M(_)}</h3><p>${O}</p></div>
        <div class="chips">${N}<button class="chip" type="button" data-details>Details &amp; pool</button></div>
        <div class="float">${P}${D}${v}</div>
        ${me}
      </div>
    </div>
  </section>
</div>`}function pr({results:e=[]}={}){let t=e.map(ge),r=t.length===1,a=t.map((o,s)=>'<div class="rv-card r'+o.rarity+'" data-i="'+s+'"><div class="rv-rays"></div><div class="rv-flare"></div><div class="rv-inner"><div class="rv-face rv-facedown"><span></span></div><div class="rv-face rv-front">'+Xe(o,!0)+"</div></div></div>").join("");return`
<div class="root">
  ${Ze}
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
    <div class="rv-deal"><div class="rv-grid${r?" single":""}" data-rv-grid>${a}</div></div>
    <div class="rv-top"><button class="rv-skip" type="button" data-rv-skip>Skip &raquo;</button></div>
    <div class="rv-foot">
      <span class="headline" data-rv-headline></span>
      <span class="spacer"></span>
      <button class="foot-btn solid" type="button" data-rv-continue>Continue &rsaquo;</button>
    </div>
  </section>
</div>`}function fr(e,{banners:t=[],onBanner:r,onPull:a,onBack:o,onDetails:s,onRedoArt:n}){for(let i of Array.isArray(t)?t:[]){if(!i||!i.id||i.live===!1)continue;let u=e.querySelector('[data-banner="'+i.id+'"]');u&&u.addEventListener("click",(p=>()=>r&&r(p))(i.id))}let l=e.querySelector("[data-details]");l&&l.addEventListener("click",()=>s&&s(!0));let d=e.querySelector("[data-details-close]");d&&d.addEventListener("click",()=>s&&s(!1));let c=e.querySelector("[data-redo-art]");c&&c.addEventListener("click",()=>{c.getAttribute("aria-disabled")!=="true"&&n&&n()});for(let i of e.querySelectorAll("[data-pull]"))i.addEventListener("click",()=>{i.getAttribute("aria-disabled")!=="true"&&a&&a(Number(i.dataset.pull)===10?10:1)});let h=e.querySelector("[data-summon-back]");h&&h.addEventListener("click",()=>o&&o())}function ur(e,{results:t=[],onContinue:r}){let a=e.querySelector('[data-screen="reveal"]'),o=e.querySelector("[data-rv-back]"),s=e.querySelector("[data-rv-grid]"),n=e.querySelector("[data-rv-headline]"),l=t.map(ge),d=[],c=0,h=()=>{for(let k of d)clearTimeout(k);d.length=0},i=k=>{!a||!a.classList||(a.classList.remove("phase-charge","phase-flash","phase-reveal","phase-done"),k&&a.classList.add("phase-"+k))},u=k=>{let C=s&&s.querySelector('[data-i="'+k+'"]');C&&C.classList&&C.classList.add("revealed")},p=()=>{let k=lr(t);n&&(n.innerHTML=k?"Best pull: <b>"+M(k.name)+"</b> \xB7 "+cr(k.rarity):""),i("done")},m=()=>{for(;c<l.length;c+=1)u(c);p()};i("charge");let b=(lr(t)||{rarity:3}).rarity;o&&o.classList&&o.classList.remove("gold","epic","steel"),d.push(setTimeout(()=>{o&&o.classList&&o.classList.add(b===5?"gold":b===4?"epic":"steel")},620)),d.push(setTimeout(()=>i("flash"),1180)),d.push(setTimeout(()=>{i("reveal");let k=l.length===1?0:230;for(let C=0;C<l.length;C+=1)d.push(setTimeout(()=>{u(c),c+=1},260+C*k));d.push(setTimeout(p,260+l.length*k+260))},1560)),a&&a.addEventListener("click",k=>{k.target&&k.target.closest&&(k.target.closest(".rv-foot")||k.target.closest(".rv-top"))||a.classList&&a.classList.contains("phase-done")||(h(),i("reveal"),m())});let x=e.querySelector("[data-rv-skip]");x&&x.addEventListener("click",()=>{h(),i("reveal"),m()});let w=e.querySelector("[data-rv-continue]");return w&&w.addEventListener("click",()=>{h(),r&&r()}),h}function Qe(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}var gr=`
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
`;function vr({runs:e,activeRunId:t}){return`
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
    <div class="rn-list">${(Array.isArray(e)?e:[]).map(o=>{let s=Qe(o.runId),n=o.runId===t,l=o.name&&String(o.name).trim()?o.name:"Untitled run",d=n?'<span class="rn-badge">Active</span>':"",c=n?`<button class="rn-go" type="button" data-go="${s}">Continue</button>`:`<button class="rn-go switch" type="button" data-go="${s}">Switch</button>`;return`<article class="rn-run${n?" active":""}">`+d+`<div class="rn-info"><div class="rn-name">${Qe(l)}</div><p class="rn-scn">${Qe(o.scenario)}</p></div><div class="rn-actions">`+c+`<button class="rn-del" type="button">Delete</button><span class="rn-confirm"><button class="rn-yes" type="button" data-del="${s}">Delete</button><button class="rn-no" type="button">Cancel</button></span></div></article>`}).join("")||'<p class="rn-empty">No runs yet.</p>'}</div>
    <button class="rn-back" type="button" data-back>&#9664; Back to the game</button>
  </div>
</div>`}function mr(e,{onNew:t,onSwitch:r,onDelete:a,onBack:o}){e.querySelector("[data-new]")?.addEventListener("click",()=>t&&t()),e.querySelector("[data-back]")?.addEventListener("click",()=>o&&o());for(let s of e.querySelectorAll("[data-go]"))s.addEventListener("click",()=>r&&r(s.getAttribute("data-go")));for(let s of e.querySelectorAll(".rn-del"))s.addEventListener("click",()=>s.closest(".rn-run")?.classList.add("confirming"));for(let s of e.querySelectorAll(".rn-no"))s.addEventListener("click",()=>s.closest(".rn-run")?.classList.remove("confirming"));for(let s of e.querySelectorAll("[data-del]"))s.addEventListener("click",()=>a&&a(s.getAttribute("data-del")))}var br="marinara-capability-gacha-forge";var Ao=new Set(["boot","banner","art","forge"]),Co={busy:"Another portrait for this unit is still on its way. Give it a moment.","no-image-connection":"This world has no image connection \u2014 pick one in settings > Style.","engine-unreachable":"Could not reach the image service.","generation-failed":"The image backend refused this prompt. Shorter tags usually help.","upload-failed":"The gallery would not take that image.","bad-image":"That is not an image the gallery accepts (PNG, JPEG, WebP, GIF or AVIF).","too-large":"That image is too big to send. Crop it smaller or save it at a lower quality.","not-in-history":"That portrait is not kept any more.","not-allowed":"This unit's portrait is not ours to repaint.","not-found":"This unit is gone.","bad-request":"Something was missing from that request."},et="/api/gacha-forge",yr=`.gf-boot{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0E1420;color:#7E93AE;font-family:"Bahnschrift","Segoe UI",system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem}.gf-boot::before{content:'';width:.6rem;height:.6rem;background:#F2603C;transform:rotate(45deg);margin-right:.6rem;animation:gf-boot-blink .9s steps(2) infinite}@keyframes gf-boot-blink{50%{opacity:.2}}.gf-boot-bad{flex-direction:column;gap:.8rem;color:#C7D3E2;text-transform:none;letter-spacing:.04em;font-size:.85rem;text-align:center;padding:1.2rem}.gf-boot-bad::before{display:none}.gf-boot-bad button{cursor:pointer;font:inherit;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;border:1px solid #F2603C;background:#F2603C;color:#10151F}`,tt=class extends HTMLElement{constructor(){super(),this._root=this.attachShadow({mode:"open"}),this._props={},this._drawnView=null,this._renderKey=null,this._onPropsChange=()=>this._apply(),this._boot="idle",this._bootError="",this._pick=null,this._pickOptions=null,this._runs=[],this._activeRunId=null,this._run=null,this._showRuns=!1,this._creatingNew=!1,this._bannerReady=!1,this._bannerState="idle",this._wallet=null,this._rosterCount=0,this._artReady=!0,this._artState="idle",this._art={done:0,total:0,name:""},this._artBlocking=!1,this._planChapter=1,this._forgeCleanup=null,this._roster=null,this._rosterState="idle",this._rosterCat="char",this._rosterRarity="all",this._rosterQuery="",this._rosterUnitId=null,this._unit=null,this._busyLocal=new Map,this._busySeq=0,this._growthRev=0,this._unitLevel=1,this._unitBond=0,this._unitState="idle",this._unitTab="profile",this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev=0,this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._summonResults=null,this._summonWallet=null,this._summonCleanup=null,this._combatPhase="loading",this._combatNode=null,this._combatCleanup=null,this._hudView="home",this._beatState="idle",this._beatCleanup=null,this._settingsCategory=ae,this._settingsFrom="home",this._settingsRev=0}get capabilityProps(){return this._props}set capabilityProps(t){this._props=t&&typeof t=="object"?t:{},this._boot==="ready"&&this._refreshState(),this._apply()}static get observedAttributes(){return["view"]}attributeChangedCallback(){this._apply()}connectedCallback(){this.addEventListener("marinara-capability-props",this._onPropsChange),this._boot==="ready"&&this._resync(),this._apply()}disconnectedCallback(){this.removeEventListener("marinara-capability-props",this._onPropsChange),this._stopForge(),this._stopBeat(),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null)}_reportError(t){let r=t instanceof Error?t.message:String(t);this.capabilityRuntimeError=r,this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error",{detail:{message:r}}))}_apply(){try{(this.getAttribute("view")||"browser")==="browser"?this._renderBrowser():this._root.innerHTML=""}catch(t){this._reportError(t)}}_state(){return this._boot!=="ready"?"boot":this._showRuns?"runs":this._bootError&&!this._creatingNew?"unreachable":this._creatingNew||!this._run?"setup":this._bannerReady?!this._artReady&&this._artBlocking?"art":this._hudView==="roster"?this._rosterUnitId?"unit":"roster":this._hudView==="summon"?"summon":this._hudView==="settings"?"settings":"hud":"banner"}_onLoaderScreen(t){return Ao.has(t)?!0:t==="beat"?this._beatState!=="ready":t==="combat"?this._combatPhase==="loading":!1}_decorKey(){let t=this._run&&this._run.decor||null;return t?JSON.stringify(t):""}_pickKey(){return this._pick?[this._pick.slot,this._pick.source,this._pickOptions?"1":"0"].join("/"):""}_syncTypeScale(){let t=te(this._run&&this._run.textScale);this._typeScale!==t&&(this._typeScale=t,this.style&&typeof this.style.setProperty=="function"&&this.style.setProperty("--gf-type-scale",String(t)))}async _setTextScale(t){if(!this._run)return;let r=te(t),a=this._run.textScale;if(te(a)===r)return;this._run.textScale=r,this._renderBrowser();let o=await this._postJson("/run/text-scale",{runId:this._run.runId,textScale:r});(!o||!o.ok)&&(this._run.textScale=a,this._renderBrowser())}_renderBrowser(){this._syncTypeScale();let t=this._state();this._persistNav();let r=t==="runs"?`runs:${this._runs.length}:${this._activeRunId}`:t==="setup"?`setup:${this._creatingNew?"new":"first"}`:t==="banner"?`banner:${this._bannerState==="error"?"error":"loading"}`:t==="art"?`art:${this._artState}:${this._art.done}/${this._art.total}:${this._art.name}`:t==="roster"?`roster:${this._rosterState}:${this._rosterCat}:${this._rosterRarity}:${this._rosterQuery}:${this._roster?this._roster.length:0}`:t==="summon"?`summon:${this._summonPhase}:${this._summonBannerId}:${this._summonBannerState}:${this._summonDetails?"d":""}:${this._summonArting?"a":""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.title||""}:${this._summonBanner&&this._summonBanner.banner&&this._summonBanner.banner.art||""}`:t==="unit"?`unit:${this._rosterUnitId}:${this._unitState}:${this._unitTab}:${this._portraitOpen?"pt":""}${this._portraitCrop?":crop":""}:${this._portraitRev}:${this._portraitBusy?"busy":""}:${this._portraitError?"err":""}`:t==="settings"?`set:${this._settingsCategory}:${this._run.hudStyle||""}:${this._settingsRev}`:t==="hud"?`hud:${this._run.hudStyle||""}:${this._decorKey()}:${this._pickKey()}`:t,a=this._onLoaderScreen(t)?[]:this._busyTasks(),o=r+"|ts:"+(this._typeScale||1)+"|busy:"+sr(a);if(this._syncBar(),this._drawnView==="browser"&&this._renderKey===o)return;let s=this._lastScreen!==t,n=!s&&this._drawnView==="browser";this._lastScreen=t,this._drawnView="browser",this._renderKey=o,this._stopForge(),this._stopBeat(),this._stopSummon(),this._stopCombat();let l="";if(t==="boot")l=`<style>${yr}</style><div class="gf-boot">Loading</div>`;else if(t==="unreachable"){let i=String(this._bootError||"").replace(/[&<>"]/g,u=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[u]);l=`<style>${yr}</style><div class="gf-boot gf-boot-bad"><span>Couldn&rsquo;t reach the game server &mdash; ${i}</span><button type="button" data-boot-retry>Retry</button></div>`}else if(t==="runs")l=`<style>${gr}</style>${vr({runs:this._runs,activeRunId:this._activeRunId})}`;else if(t==="setup")l=`<style>${_t}</style>${Et({cancelable:this._creatingNew})}`;else if(t==="banner")l=`<style>${$e}</style>${Pe({scenario:this._run.scenario,mode:"banner",error:this._bannerState==="error"})}`;else if(t==="art")l=`<style>${$e}</style>${Pe({scenario:this._run.scenario,mode:"art",error:this._artState==="blocked",art:this._art})}`;else if(t==="roster")l=`<style>${je}</style>${Kt({cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,state:this._rosterState,q:this._rosterQuery})}`;else if(t==="unit")this._portraitOpen?l=`<style>${Qt}</style>${er({unit:this._unit,view:this._portraitCrop?"crop":"edit",draft:this._portraitDraft,history:this._portrait&&this._portrait.strip||[],historyMax:this._portrait&&this._portrait.historyMax||0,busy:this._portraitBusy,error:this._portraitError,crop:this._portraitCrop,promptName:this._portrait&&this._portrait.promptName||""})}`:l=`<style>${je}</style>${Zt({unit:this._unit,level:this._unit?this._unitLevel:1,bond:this._unit?this._unitBond:0,tab:this._unitTab,state:this._unitState})}`;else if(t==="summon")if(this._summonPhase==="reveal")l=`<style>${Je}</style>${pr({results:this._summonResults||[]})}`;else{let i=this._summonBanner;l=`<style>${Je}</style>${hr({banners:i&&i.banners||[],banner:i&&i.banner,rates:i&&i.rates,pity:i&&i.pity,wallet:i&&i.wallet||this._wallet,cost:i&&i.cost||160,bannerId:this._summonBannerId,state:this._summonBannerState,details:this._summonDetails,arting:this._summonArting})}`}else t==="settings"?l=`<style>${Bt}</style>${Nt({category:this._settingsCategory,backLabel:this._settingsBackLabel(),hudStyle:this._run.hudStyle,textScale:this._run.textScale,tokenLog:this._tokenLog,loreStatus:this._loreStatus,run:this._run})}`:l=`<style>${rt}</style>${mt({decor:this._run.decor,pick:this._pick,pickOptions:this._pickOptions})}`;let d=t==="combat"&&this._combatPhase!=="prebattle",c=!!this._run&&!d&&st.has(t),h=c?lt({username:this._run.username,wallet:this._wallet,account:this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:null}):"";this._root.innerHTML=`<style>${pt}${nr}${ut}</style>`+ft(l+ir(a),{runs:!!this._run&&t!=="runs",style:this._run&&this._run.hudStyle,entering:s,swapping:n,bar:h,tokens:this._tokenTotals}),c&&ht(this._root),this._stopVigorClock&&(this._stopVigorClock(),this._stopVigorClock=null),c&&(this._stopVigorClock=dt(this._root,{nextMs:this._wallet?this._wallet.vigorNextMs:null,periodMs:this._wallet&&this._wallet.vigorPerMs||this._run&&this._run.vigorPerMs,onLanded:()=>this._refreshState&&this._refreshState()})),Rt(this._root,{open:t==="settings",category:this._settingsCategory,run:this._run,onOpen:i=>this._openSettings(i),onBack:()=>this._leaveSettings(),onCategory:i=>this._openSettings(i),onStyle:i=>this._setHudStyle(i),onTextScale:i=>this._setTextScale(i),onSources:i=>this._setSources(i)}),this._wireFullscreen(),this._wireRunsButton();{let i=this._root.querySelector("[data-boot-retry]");i&&i.addEventListener("click",()=>{this._boot="idle",this._loadState(),this._renderBrowser()})}if(t==="runs")this._wireRuns();else if(t==="setup")At(this._root,{onCreate:i=>this._createRun(i),onCancel:()=>{this._creatingNew=!1,this._renderBrowser()}});else if(t==="banner"){let i=this._bannerState==="error";this._forgeCleanup=He(this._root,{cycle:!i,phases:De,onRetry:()=>this._loadStandardBanner()}),this._bannerState==="idle"&&this._loadStandardBanner()}else t==="art"?(this._forgeCleanup=He(this._root,{cycle:!1,onRetry:()=>this._finishArt()}),this._ensureArtRunning()):t==="roster"?(Xt(this._root,{onOpenUnit:i=>this._openUnit(i),onBack:()=>{this._hudView="home",this._renderBrowser()},onCat:i=>{this._rosterCat=i==="wpn"?"wpn":"char",this._rosterRarity="all",this._rosterQuery="",this._renderBrowser()},onRarity:i=>{this._rosterRarity=i,this._renderBrowser()},onSearch:i=>{this._rosterQuery=i,Vt(this._root,{cards:this._roster||[],cat:this._rosterCat,rarity:this._rosterRarity,q:i,state:this._rosterState})}}),this._rosterState==="idle"&&this._loadRoster()):t==="unit"&&this._portraitOpen?tr(this._root,{onBack:()=>this._portraitClose(),onDraft:i=>this._portraitEdit(i),onGenerate:()=>this._portraitGenerate(),onPick:i=>this._portraitPick(i),onFile:i=>this._portraitFile(i),onCropSize:i=>this._portraitSize(i),onCropFrame:i=>this._portraitDrag(i),onCropOk:()=>this._portraitUpload(),onCropCancel:()=>{this._portraitCrop=null,this._renderBrowser()}}):t==="unit"?(Jt(this._root,{onTab:i=>{this._unitTab=i,this._renderBrowser()},onBack:()=>{this._rosterUnitId=null,this._unit=null,this._unitState="idle",this._renderBrowser()},onPortrait:()=>this._portraitOpenStudio()}),this._unitState==="idle"&&this._loadUnit()):t==="summon"?this._summonPhase==="reveal"?this._summonCleanup=ur(this._root,{results:this._summonResults||[],onContinue:()=>{this._summonPhase="banner",this._renderBrowser()}}):(fr(this._root,{banners:this._summonBanner&&this._summonBanner.banners||[],onBanner:i=>{i!==this._summonBannerId&&(this._summonBannerId=i,this._summonDetails=!1,this._summonArting=!1,this._summonBannerState="idle",this._summonBanner=null,this._renderBrowser())},onDetails:i=>{this._summonDetails=!!i,this._renderBrowser()},onRedoArt:()=>this._redoBannerArt(),onPull:i=>this._summonPull(i),onBack:()=>{this._hudView="home",this._renderBrowser()}}),this._summonBannerState==="idle"&&this._loadSummonBanner()):t==="hud"&&bt(this._root,{onOpenRoster:()=>this._openRoster(),onOpenSummon:()=>this._openSummon(),onPickOpen:i=>this._openPick(i),onPickClose:()=>this._closePick(),onPickSource:i=>this._pickSource(i),onPickTake:i=>this._takePick(i)});this._boot==="idle"&&this._loadState(),this._ensureArtRunning()}async _setHudStyle(t){if(!this._run||!this._run.runId)return;let r=this._run.hudStyle;this._run.hudStyle=t,this._renderBrowser();let a=await this._postJson("/run/style",{runId:this._run.runId,hudStyle:t});a&&a.ok||(this._run.hudStyle=r,this._renderBrowser())}_wireFullscreen(){let t=()=>{document.fullscreenElement?document.exitFullscreen?.():this.requestFullscreen?.()};for(let r of[".gf-fs",".gf-fs-exit",".gf-fs-bar"]){let a=this._root.querySelector(r);a&&a.addEventListener("click",t)}this._wireLandscape()}_wireLandscape(){let t=this._root.querySelector("[data-go-landscape]");t&&t.addEventListener("click",async()=>{try{!document.fullscreenElement&&this.requestFullscreen&&await this.requestFullscreen()}catch{}let r=typeof screen<"u"?screen.orientation:null;if(!r||typeof r.lock!="function"){this._landscapeFallback();return}try{await r.lock("landscape")}catch{this._landscapeFallback()}})}_landscapeFallback(){let t=this._root.querySelector("[data-rot-title]"),r=this._root.querySelector("[data-rot-note]");t&&(t.textContent="Turn your phone"),r&&(r.textContent="This game plays in a 16:9 landscape frame. Your browser cannot rotate it for you.")}_wireRunsButton(){let t=[];for(let r of["[data-open-runs]",".gf-runs-bar"]){let a=this._root.querySelector(r);!a||t.indexOf(a)>=0||(t.push(a),a.addEventListener("click",()=>{this._showRuns=!0,this._renderBrowser()}))}}_adoptRun(t){this._run=t||null,this._activeRunId=t?t.runId:null,this._creatingNew=!1,this._planChapter=1,this._hudView="home",this._bannerReady=!!(t&&t.hasStandardBanner),this._bannerState="idle",this._artReady=!(t&&Number(t.artPending)>0),this._artState="idle",this._art={done:0,total:0,name:""},this._wallet=t&&t.wallet||null,this._rosterCount=t&&Number(t.rosterCount)||0,this._roster=null,this._rosterState="idle",this._rosterCat="char",this._rosterRarity="all",this._rosterQuery="",this._rosterUnitId=null,this._unit=null,this._unitState="idle",this._unitTab="profile"}_adoptGlobals(t){}_loadState(){this._boot="loading",this._bootError="",z(`${et}/state`).then(t=>{if(!t)throw new Error("no response");if(!t.ok)throw new Error("HTTP "+t.status);return typeof t.json=="function"?t.json():null}).then(t=>{this._runs=t&&Array.isArray(t.runs)?t.runs:[],this._activeRunId=t&&t.activeRunId||null,this._run=t&&t.activeRun||null,this._adoptGlobals(t),this._run&&Number.isFinite(Number(this._run.contextTokens)),this._bannerReady=!!(this._run&&this._run.hasStandardBanner),this._artReady=!(this._run&&Number(this._run.artPending)>0),this._wallet=this._run&&this._run.wallet||null,this._rosterCount=this._run&&Number(this._run.rosterCount)||0}).catch(t=>{this._run=null,this._bootError=String(t&&t.message||"unreachable")}).then(()=>{this._run&&(this._restoreNav(),this._reconcileGenerating({boot:!0})),this._boot="ready",this._renderBrowser()})}_navKey(){return`gacha-forge:nav:${this._run?this._run.runId:"none"}`}_persistNav(){if(!(!this._run||this._boot!=="ready"))try{if(typeof localStorage>"u")return;localStorage.setItem(this._navKey(),JSON.stringify({v:this._hudView,ch:this._planChapter,combat:this._combatNode}))}catch{}}_restoreNav(){let t=null;try{if(typeof localStorage>"u")return;let r=localStorage.getItem(this._navKey());r&&(t=JSON.parse(r))}catch{return}!t||typeof t!="object"||(Number.isInteger(t.ch)&&t.ch>=1&&(this._planChapter=t.ch),["roster","summon","settings"].includes(t.v)&&(this._hudView=t.v))}_resync(){this._renderKey=null,this._bannerState==="loading"&&(this._bannerState="idle"),this._summonBannerState==="loading"&&(this._summonBannerState="idle"),this._rosterState==="loading"&&(this._rosterState="idle"),this._unitState==="loading"&&(this._unitState="idle"),this._tokenLog&&this._tokenLog.status==="loading"&&(this._tokenLog={...this._tokenLog,status:"idle"}),this._refreshState()}_refreshState(){this._refreshing||(this._refreshing=!0,z(`${et}/state`).then(t=>t&&typeof t.json=="function"?t.json():null).then(t=>{t&&(this._runs=Array.isArray(t.runs)?t.runs:this._runs,this._activeRunId=t.activeRunId||this._activeRunId,this._adoptGlobals(t),t.activeRun&&(this._run=t.activeRun,this._bannerReady=!!t.activeRun.hasStandardBanner,this._artState==="idle"&&(this._artReady=!(Number(t.activeRun.artPending)>0)),this._wallet=t.activeRun.wallet||this._wallet,this._rosterCount=Number(t.activeRun.rosterCount)||this._rosterCount))}).catch(()=>{}).then(()=>{this._refreshing=!1,this._renderBrowser()}))}_reconcileGenerating({boot:t=!1}={}){if(!t)return;let r=this._run&&Array.isArray(this._run.generating)?this._run.generating:[];if(!r.length)return;let a=this._run.runId,o=l=>r.find(d=>typeof d=="string"&&d.startsWith(`${a}:${l}`)),s=o("banner:wpn:"),n=o("banner:char:");if(s||n){this._hudView="summon",this._summonPhase="banner",this._summonBannerId=s?"wpn-featured":"char-featured",this._summonBanner=null,this._summonBannerState="idle";return}}_postJson(t,r){let a=ar(t),o=a?this._busyStart(a):0;return z(`${et}${t}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}).then(s=>s&&typeof s.json=="function"?s.json():null).catch(()=>null).then(s=>(this._adoptFromResponse(s),o&&this._busyEnd(o),s))}_adoptFromResponse(t){if(!t||typeof t!="object")return;if(this._adoptGlobals(t),t.wallet&&typeof t.wallet=="object"&&(this._wallet={...this._wallet||{},...t.wallet}),t.account&&typeof t.account=="object"&&this._run){let s=this._run.account||null,n=t.account;(!s||s.level!==n.level||s.xp!==n.xp||s.xpNeeded!==n.xpNeeded)&&(this._run={...this._run,account:{...s,...n}})}this._syncBar();let r=typeof t.unitId=="string"?t.unitId:"",a=typeof t.portrait=="string"?t.portrait:"",o=this._run&&this._run.decor;r&&a&&o&&o.unit&&o.unit.id===r&&o.unit.portrait!==a&&(this._run={...this._run,decor:{...o,unit:{...o.unit,portrait:a}}})}_syncBar(){ct(this._root,{wallet:this._wallet,account:this._run&&this._run.account||null,vigorNextMs:this._wallet?this._wallet.vigorNextMs:void 0})}_busyStart(t){return this._busySeq+=1,this._busyLocal.set(this._busySeq,t),this._renderBrowser(),this._busySeq}_busyEnd(t){this._busyLocal.delete(t)&&this._renderBrowser()}_busyTasks(){return or({local:[...this._busyLocal.values()],generating:this._run&&Array.isArray(this._run.generating)?this._run.generating:[],art:this._artState==="painting"?this._art:null})}async _createRun(t){let r=await this._postJson("/run",t);if(!(r&&r.ok&&r.run))throw new Error(r&&r.error||"Could not create the run.");this._adoptRun(r.run),this._runs=[...this._runs,r.run],this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}_openSettings(t){if(!this._run)return;let r=re.some(a=>a.id===t)?t:ae;this._hudView!=="settings"&&(this._settingsFrom=this._hudView||"home"),this._hudView="settings",this._settingsCategory=r,this._renderBrowser(),r==="debug"&&this._loadTokenLog()}_settingsBackLabel(){return{home:"Home",modes:"Battle",roster:"Units",unit:"Units",summon:"Summon",formation:"Formation",inventory:"Inventory",farm:"Materials",chapters:"Chapters",chapter:"Chapter",result:"Result",combat:"Battle"}[this._settingsFrom]||"Home"}_leaveSettings(){this._hudView=this._settingsFrom==="settings"?"home":this._settingsFrom||"home",this._renderBrowser()}async _setSources(t){if(!this._run||!this._run.runId||!t||typeof t!="object")return;let r=this._run;this._run={...this._run,...t},this._settingsRev+=1;let a=await this._postJson("/run/sources",{runId:this._run.runId,sources:t});if(!a||!a.ok){this._run=r,this._settingsRev+=1,this._renderBrowser();return}a.run&&typeof a.run=="object"&&(this._run={...this._run,...a.run},this._settingsRev+=1)}_switchRun(t){if(t){if(t===this._activeRunId){this._creatingNew=!1,this._showRuns=!1,this._renderBrowser();return}this._postJson("/run/activate",{runId:t}).then(r=>{r&&r.ok&&r.run&&(this._adoptRun(r.run),this._showRuns=!1,this._renderBrowser())})}}_deleteRun(t){t&&this._postJson("/run/delete",{runId:t}).then(r=>{r&&r.ok&&(this._runs=Array.isArray(r.runs)?r.runs:[],this._activeRunId=r.activeRunId||null,this._run&&t===this._run.runId&&this._adoptRun(r.activeRun||null),this._runs.length===0&&(this._showRuns=!1,this._creatingNew=!1),this._renderBrowser())})}_loadStandardBanner(){if(this._bannerState="loading",this._renderBrowser(),!this._run){this._bannerState="error",this._renderBrowser();return}this._postJson("/banner",{runId:this._run.runId}).then(t=>{t&&t.ok?(this._bannerState="idle",this._bannerReady=!0,this._artReady=!1,this._artState="idle",this._artBlocking=!0,typeof t.granted=="number"&&(this._rosterCount=t.granted)):this._bannerState="error"}).then(()=>{this._run&&this._renderBrowser()})}_imageSlot(t){let r=()=>t(),a=(this._imageChain||Promise.resolve()).then(r,r);return this._imageChain=a.then(()=>{},()=>{}),a}_ensureArtRunning(){!this._run||this._artReady||this._artState!=="idle"||this._startArt()}_startArt(){if(this._artState="painting",this._art={done:0,total:0,name:""},!this._run){this._artReady=!0,this._renderBrowser();return}this._postJson("/portraits",{runId:this._run.runId}).then(t=>{let r=t&&t.ok&&Array.isArray(t.pending)?t.pending:[];return r.length?(this._art={done:Number(t.done)||0,total:Number(t.total)||r.length,name:r[0].name},this._artBlocking&&this._renderBrowser(),this._paintNext(r,0,0)):this._finishArt()}).catch(()=>this._finishArt())}_paintNext(t,r,a){if(!this._run||this._artState!=="painting")return Promise.resolve();if(r>=t.length){if(a>0&&a===t.length){if(this._artBlocking)return this._artState="blocked",this._renderBrowser(),Promise.resolve();console.warn("[gacha-forge] every background portrait failed ("+a+") \u2014 units keep their silhouette")}return this._paintFoundingArt().then(()=>this._finishArt())}let o=t[r];return this._art={...this._art,name:o.name},this._artBlocking&&this._renderBrowser(),this._imageSlot(()=>this._postJson("/portrait",{runId:this._run.runId,unitId:o.unitId})).catch(()=>null).then(s=>{let n=!!(s&&s.ok);return n&&(this._art={...this._art,done:this._art.done+1}),this._paintNext(t,r+1,a+(n?0:1))})}_paintFoundingArt(){return!this._artBlocking||!this._run?Promise.resolve():(this._art={...this._art,name:"The banner splash"},this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:"char-standard"})).catch(()=>null))}_finishArt(){let t=!this._artBlocking;this._artState="idle",this._artReady=!0,this._artBlocking=!1,t&&(this._hudView==="roster"&&!this._rosterUnitId&&this._rosterState!=="loading"?this._loadRoster():this._hudView==="summon"&&this._summonBannerState!=="loading"&&this._loadSummonBanner()),this._renderBrowser()}_openPick(t){t!=="bg"&&t!=="unit"||(this._pick={slot:t,source:t==="bg"?"story":"all"},this._renderBrowser(),!this._pickOptions&&this._postJson("/home-options",{runId:this._run?this._run.runId:""}).then(r=>{!r||r.ok===!1||(this._pickOptions={backgrounds:r.backgrounds||{},units:r.units||[]},this._pick&&this._renderBrowser())}))}_closePick(){this._pick&&(this._pick=null,this._renderBrowser())}_pickSource(t){this._pick&&(this._pick={...this._pick,source:String(t||"")},this._renderBrowser())}_takePick(t){if(!this._pick||!this._run)return;let r={runId:this._run.runId};if(this._pick.slot==="bg")r.bg=t?{src:this._pick.source,key:t}:null;else{if(!t)return;r.unitId=t}this._pick=null,this._renderBrowser(),this._postJson("/home-decor",r).then(a=>{!a||a.ok===!1||!a.decor||(this._run={...this._run,decor:a.decor},this._renderBrowser())})}_openRoster(){this._hudView="roster",this._rosterUnitId=null,this._rosterState="idle",this._renderBrowser()}_loadRoster(){if(this._rosterState="loading",this._renderBrowser(),!this._run){this._rosterState="error",this._renderBrowser();return}this._postJson("/roster",{runId:this._run.runId}).then(t=>{t&&t.ok&&Array.isArray(t.cards)?(this._roster=t.cards,this._rosterCount=t.cards.length,this._rosterState="ready"):this._rosterState="error"}).then(()=>{this._hudView==="roster"&&this._renderBrowser()})}_openUnit(t,r="profile"){t&&(this._rosterUnitId=t,this._unit=null,this._unitTab=r==="growth"||r==="gear"||r==="bond"?r:"profile",this._growthRev+=1,this._unitState="idle",this._portraitReset(),this._renderBrowser())}_portraitReset(){this._portrait=null,this._portraitOpen=!1,this._portraitDraft=null,this._portraitCrop=null,this._portraitBusy=!1,this._portraitError="",this._portraitRev+=1}_loadUnit(){if(this._unitState="loading",this._renderBrowser(),!this._run||!this._rosterUnitId){this._unitState="error",this._renderBrowser();return}let t=this._rosterUnitId;this._postJson("/unit",{runId:this._run.runId,unitId:t}).then(r=>{this._rosterUnitId===t&&(r&&r.ok&&r.unit?(this._unit=r.unit,this._unitLevel=Number(r.level)||1,this._unitBond=Number(r.bond)||0,this._growthRev+=1,this._portrait=r.portrait||null,this._portraitRev+=1,this._unitState="ready"):this._unitState="error")}).then(()=>{this._rosterUnitId===t&&this._renderBrowser()})}_portraitOpenStudio(){this._portrait&&(this._portraitDraft={appearance:this._portrait.appearance||"",tags:ue(this._portrait.tags)},this._portraitOpen=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser())}_portraitClose(){this._portraitOpen=!1,this._portraitCrop=null,this._portraitError="",this._portraitRev+=1,this._renderBrowser()}_portraitEdit(t){if(!(!this._portraitDraft||!t)){if(typeof t.appearance=="string"){this._portraitDraft.appearance=t.appearance;return}if(typeof t.addTag=="string")for(let r of ue(t.addTag))this._portraitDraft.tags.includes(r)||this._portraitDraft.tags.push(r);else if(Number.isInteger(t.dropTag))this._portraitDraft.tags.splice(t.dropTag,1);else return;this._portraitRev+=1,this._renderBrowser()}}_portraitGenerate(){if(this._portraitBusy||!this._run||!this._rosterUnitId||!this._portraitDraft)return;let t=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait",{runId:this._run.runId,unitId:t,force:!0,appearance:this._portraitDraft.appearance,imageTags:this._portraitDraft.tags}).then(r=>this._portraitApply(t,r,"That did not paint."))}_portraitPick(t){let a=(this._portrait&&this._portrait.strip||[])[t];if(!a||a.current||this._portraitBusy||!this._run||!this._rosterUnitId)return;let o=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser(),this._postJson("/portrait/select",{runId:this._run.runId,unitId:o,url:a.url}).then(s=>this._portraitApply(o,s,"That one could not be restored."))}_portraitApply(t,r,a){if(this._portraitBusy=!1,this._rosterUnitId===t){if(r&&r.ok&&r.view){let o=r.view;this._portrait=o,this._portraitDraft={appearance:o.appearance||"",tags:ue(o.tags)},this._portraitCrop=null,this._portraitError="";let s=Array.isArray(o.strip)&&o.strip.length?o.strip[0].url:"";this._unit&&(this._unit={...this._unit,portrait:s,appearance:o.appearance,imageTags:o.tags}),this._rosterState="idle"}else this._portraitError=Co[r&&r.error||""]||r&&r.detail||a;this._portraitRev+=1,this._renderBrowser()}}_portraitFile(t){if(!t||this._portraitBusy)return;let r=o=>{this._portraitError=o,this._portraitCrop=null,this._portraitRev+=1,this._renderBrowser()},a=new FileReader;a.onerror=()=>r("That file could not be read."),a.onload=()=>{let o=String(a.result||""),s=new Image;s.onerror=()=>r("That file is not an image this gallery accepts."),s.onload=()=>{let n=s.naturalWidth||s.width,l=s.naturalHeight||s.height;if(!n||!l)return r("That image has no size.");this._portraitCrop={src:o,natural:{w:n,h:l},size:1,frame:Ge(n,l,1,.5,.42)},this._portraitError="",this._portraitRev+=1,this._renderBrowser()},s.src=o},a.readAsDataURL(t)}_portraitDrag(t){let r=this._portraitCrop;!r||!t||(r.frame=We({...r.frame,x:r.frame.x+(Number(t.dx)||0)*r.natural.w,y:r.frame.y+(Number(t.dy)||0)*r.natural.h},r.natural.w,r.natural.h),Ye(this._root,r.frame,r.natural.w,r.natural.h))}_portraitSize(t){let r=this._portraitCrop;if(!r)return;let a=(r.frame.x+r.frame.w/2)/r.natural.w,o=(r.frame.y+r.frame.h/2)/r.natural.h;r.size=t,r.frame=Ge(r.natural.w,r.natural.h,t,a,o),Ye(this._root,r.frame,r.natural.w,r.natural.h)}_portraitUpload(){let t=this._portraitCrop;if(!t||this._portraitBusy||!this._run||!this._rosterUnitId)return;let r=Number(this._portrait&&this._portrait.width)||0,a=Number(this._portrait&&this._portrait.height)||0;if(!r||!a){this._portraitError="This world did not say what size a portrait is.",this._portraitRev+=1,this._renderBrowser();return}let o=this._rosterUnitId;this._portraitBusy=!0,this._portraitError="",this._portraitRev+=1,this._renderBrowser();let s=new Image;s.onerror=()=>this._portraitApply(o,null,"That image could not be prepared."),s.onload=()=>{let n="";try{let l=document.createElement("canvas");l.width=r,l.height=a,l.getContext("2d").drawImage(s,t.frame.x,t.frame.y,t.frame.w,t.frame.h,0,0,r,a),n=l.toDataURL("image/jpeg",.92)}catch{n=""}if(!n)return this._portraitApply(o,null,"That image could not be prepared.");this._postJson("/portrait/upload",{runId:this._run.runId,unitId:o,image:n}).then(l=>this._portraitApply(o,l,"That image was not accepted."))},s.src=t.src}_wireRuns(){mr(this._root,{onNew:()=>{this._creatingNew=!0,this._showRuns=!1,this._renderBrowser()},onSwitch:t=>this._switchRun(t),onDelete:t=>this._deleteRun(t),onBack:()=>{this._creatingNew=!1,this._showRuns=!1,this._renderBrowser()}})}_loadTokenLog(){this._tokenLog={status:"loading",entries:this._tokenLog&&this._tokenLog.entries||[],totals:this._tokenLog&&this._tokenLog.totals},this._fillTokenLog(),this._loreStatus={status:"loading"},this._postJson("/lore-status",{runId:this._run?this._run.runId:""}).then(t=>{this._loreStatus=t&&t.ok?{status:"ready",data:t}:{status:"error"},this._fillTokenLog()}),this._postJson("/token-log",{runId:this._run?this._run.runId:""}).then(t=>{if(t&&t.ok&&Array.isArray(t.entries)){this._tokenLog={status:"ready",entries:t.entries,totals:t.totals||null};let r=o=>{let s=Number(o)||0;return s>=1e3?(s/1e3).toFixed(s>=1e4?0:1)+"k":String(s)},a=t.totals||{};this._tokenTotals={sent:r(a.sent),received:r(a.received)}}else this._tokenLog={status:"error",entries:[],totals:null};this._fillTokenLog()})}_fillTokenLog(){let t=this._root.querySelector('[data-view-body="debug"]');t&&(t.innerHTML=Oe(this._loreStatus,this._tokenLog))}_stopForge(){this._forgeCleanup&&(this._forgeCleanup(),this._forgeCleanup=null)}_stopBeat(){this._beatCleanup&&(this._beatCleanup(),this._beatCleanup=null)}_stopSummon(){this._summonCleanup&&(this._summonCleanup(),this._summonCleanup=null)}_stopCombat(){this._combatCleanup&&(this._combatCleanup(),this._combatCleanup=null)}_openSummon(){this._hudView="summon",this._summonPhase="banner",this._summonBannerId="char-standard",this._summonBanner=null,this._summonBannerState="idle",this._summonDetails=!1,this._summonArting=!1,this._renderBrowser()}_loadSummonBanner(){if(this._summonBannerState="loading",this._renderBrowser(),!this._run){this._summonBannerState="error",this._renderBrowser();return}let t=this._summonBannerId;this._postJson("/summon-banner",{runId:this._run.runId,banner:t}).then(r=>{this._summonBannerId===t&&(r&&r.ok&&r.banner?(this._summonBanner=r,this._summonBannerState="ready",this._ensureBannerArt(r.banner)):this._summonBannerState="error")}).then(()=>{this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()})}_redoBannerArt(){this._paintBannerArt(this._summonBannerId,!0)}_ensureBannerArt(t){!t||!t.canArt||t.art||this._paintBannerArt(t.id,!1)}_paintBannerArt(t,r){!this._run||this._summonArting||!t||(this._summonArting=!0,this._renderBrowser(),this._imageSlot(()=>this._postJson("/banner-art",{runId:this._run.runId,banner:t,force:!!r})).then(a=>{if(this._summonBannerId===t&&a&&a.ok&&a.art&&this._summonBanner&&this._summonBanner.banner){this._summonBanner.banner.art=a.art;let o=(this._summonBanner.banners||[]).find(s=>s&&s.id===t);o&&(o.art=a.art)}}).catch(()=>{}).then(()=>{this._summonArting=!1,this._hudView==="summon"&&this._summonPhase==="banner"&&this._renderBrowser()}))}_summonPull(t){if(!this._run)return;let r=this._summonBannerId;this._postJson("/summon",{runId:this._run.runId,banner:r,count:t===10?10:1}).then(a=>{a&&a.ok&&Array.isArray(a.results)&&(this._summonResults=a.results,this._summonWallet=a.wallet||this._summonWallet,this._summonBannerState="idle",this._summonBanner=null,this._rosterCount+=a.results.filter(o=>o&&o.isNew).length,this._summonPhase="reveal",this._renderBrowser())})}};typeof customElements<"u"&&!customElements.get(br)&&customElements.define(br,tt);
