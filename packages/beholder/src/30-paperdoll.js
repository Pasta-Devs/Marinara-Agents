/**
 * Beholder — paper-doll renderer.
 *
 * Renders ONE character's state as an anatomical card: a creature silhouette
 * (SVG) flanked by per-slot item labels arranged at the matching body height,
 * with armor-damage and wound state tinted directly onto each body region.
 *
 * Tracked slots: head, face, neck, chest, back, waist, the L/R shoulder, arm,
 * hand, leg and foot pairs, plus facial features (eyes, ears, mouth) and the
 * species-conditional slots (tail, centaur hind pairs).
 *   Per slot: { worn: [{item, damage, color}], holding, wounds: [...], ... }
 *   Per char: species (top-level scalar)
 *
 * The renderer is sparse: only slots with state get a populated card. The
 * silhouette itself is always rendered (so the user has spatial reference even
 * for a freshly-stripped character), and facial features always draw as quiet
 * idle anatomy so "nothing tracked" reads differently from "lost".
 *
 * Four silhouette families share one upper body and swap the lower body:
 * humanoid, digitigrade, serpentine, centauroid. Geometry only — the
 * state→class logic is family-agnostic.
 */

// 3-state damage scale (SCHEMA.md / shared/schema_axes.py D22, 2026-06-17:
// cracked dropped). pristine → damaged → broken on a green→amber→red ramp.
const DAMAGE_TIER = {
  pristine: { class: "bh-tier-0", label: "pristine", tier: 0 },
  damaged: { class: "bh-tier-2", label: "damaged", tier: 2 },
  broken: { class: "bh-tier-4", label: "broken", tier: 4 },
  // Legacy coercion: pre-D22 saved chats may carry 'cracked'; map it onto the
  // nearest current tier (renders as 'damaged') so old state still displays.
  cracked: { class: "bh-tier-2", label: "damaged", tier: 2 },
};

function tierOf(damageStr) {
  return DAMAGE_TIER[String(damageStr ?? "").toLowerCase()]?.tier ?? 0;
}

/**
 * Wound severity tier 1..3 (minor / serious / critical).
 *
 * A wound may be a bare string or an object with an explicit `severity` field.
 * When `severity` is present it's used directly; otherwise severity is inferred
 * from the wound text via a keyword heuristic, so the explicit field is picked
 * up automatically with no caller change.
 *
 * Coverage isn't exhaustive; it's good enough to keep "bruise" from
 * looking as alarming as "stab wound" when no explicit severity is given.
 */
function woundSeverity(w) {
  if (w && typeof w === "object" && w.severity) {
    const s = String(w.severity).toLowerCase();
    if (s === "minor") return 1;
    if (s === "serious") return 2;
    if (s === "critical") return 3;
  }
  const text = String(typeof w === "string" ? w : (w?.text ?? "")).toLowerCase();
  // Explicit severity modifiers in the text override everything else.
  if (/\b(minor|light|small|superficial|tiny|faint|mild)\b/.test(text)) return 1;
  if (/\b(deep|severe|heavy|grave|mortal|fatal|massive|critical)\b/.test(text)) return 3;
  // Critical-by-default wound nouns (penetrating, broken, hemorrhagic).
  if (
    /\b(stab|impal|gunshot|arrow wound|hemorrhag|gushing|spurt|shattered|crushed|broken|fracture|sever(ed|al)?|amputat|disembowel)\b/.test(
      text,
    )
  )
    return 3;
  // Minor-by-default wound nouns (cosmetic, superficial).
  if (/\b(bruis|scratch|scrape|abrasion|graze|scuff|blister|chafe|red mark|faint mark|nick)\b/.test(text)) return 1;
  // Default: serious (middle tier). Covers "cut", "gash", "burn", "wound",
  // "laceration", "contusion" — distinct injuries but not necessarily critical.
  return 2;
}

function woundText(w) {
  return typeof w === "string" ? w : (w?.text ?? "");
}

// Side of the body each slot lives on. Determines which column the label goes in.
// Center-line slots (head, face, neck, chest, back, waist) draw their label on
// the side with fewer items, balancing visual weight.
const SLOT_SIDE = {
  head: "center",
  face: "center",
  neck: "center",
  chest: "center",
  back: "center",
  waist: "center",
  mouth: "center",
  left_eye: "left",
  left_ear: "left",
  left_shoulder: "left",
  left_arm: "left",
  left_hand: "left",
  left_leg: "left",
  left_foot: "left",
  right_eye: "right",
  right_ear: "right",
  right_shoulder: "right",
  right_arm: "right",
  right_hand: "right",
  right_leg: "right",
  right_foot: "right",
  // Species-conditional slots (tail + centaur hind pair)
  tail: "center",
  hind_left_leg: "left",
  hind_left_foot: "left",
  hind_right_leg: "right",
  hind_right_foot: "right",
};

// Vertical position of each slot's CONNECTION POINT on the silhouette (in % of
// silhouette height). Drives label vertical ordering. Top of doll = 0%, feet = 100%.
// Facial features (eyes/ears/mouth) and species-conditional slots (tail, centaur
// hind pairs) are listed so the layout can place them when state references them.
const SLOT_Y = {
  head: 6,
  left_eye: 8,
  right_eye: 8,
  left_ear: 9,
  right_ear: 9,
  face: 12,
  mouth: 14,
  neck: 20,
  left_shoulder: 25,
  right_shoulder: 25,
  chest: 38,
  back: 38,
  left_arm: 42,
  right_arm: 42,
  waist: 56,
  left_hand: 60,
  right_hand: 60,
  left_leg: 74,
  right_leg: 74,
  left_foot: 94,
  right_foot: 94,
  // Quadruped hind pair (centaurs etc.) — visually behind the front legs
  hind_left_leg: 78,
  hind_right_leg: 78,
  hind_left_foot: 96,
  hind_right_foot: 96,
  tail: 88, // generally below the waist, varies by family
};

// Human-readable slot label for display.
const SLOT_LABEL = {
  head: "head",
  face: "face",
  neck: "neck",
  chest: "chest",
  back: "back",
  waist: "waist",
  mouth: "mouth",
  left_eye: "L. eye",
  right_eye: "R. eye",
  left_ear: "L. ear",
  right_ear: "R. ear",
  left_shoulder: "L. shoulder",
  right_shoulder: "R. shoulder",
  left_arm: "L. arm",
  right_arm: "R. arm",
  left_hand: "L. hand",
  right_hand: "R. hand",
  left_leg: "L. leg",
  right_leg: "R. leg",
  left_foot: "L. foot",
  right_foot: "R. foot",
  // Species-conditional slots
  tail: "tail",
  hind_left_leg: "L. hind leg",
  hind_right_leg: "R. hind leg",
  hind_left_foot: "L. hind foot",
  hind_right_foot: "R. hind foot",
};

// Family-aware label overrides. Schema slot key stays the same
// (left_foot is always left_foot in JSON); only the displayed label
// shifts per silhouette family. Pure UI concern.
//   digitigrade (catfolk/foxfolk/wolffolk/etc.) — feet are paws
//   centauroid  (centaur)                       — feet are hooves, legs distinguished fore/hind
//   serpentine  (lamia/naga/merfolk)            — no legs/feet to label; tail label stays generic
const FAMILY_LABEL_OVERRIDES = {
  digitigrade: {
    left_foot: "L. paw",
    right_foot: "R. paw",
  },
  centauroid: {
    left_leg: "L. fore-leg",
    right_leg: "R. fore-leg",
    left_foot: "L. fore-hoof",
    right_foot: "R. fore-hoof",
    hind_left_leg: "L. hind-leg",
    hind_right_leg: "R. hind-leg",
    hind_left_foot: "L. hind-hoof",
    hind_right_foot: "R. hind-hoof",
  },
};
function labelOf(slot, family) {
  const override = FAMILY_LABEL_OVERRIDES[family];
  if (override && override[slot]) return override[slot];
  return SLOT_LABEL[slot] || slot;
}

// Slots that should NOT auto-render as ghost-empty CARDS. They only get a card
// when state actually populates them — otherwise a plain human would sprout a
// ghost "tail" row, etc. SPECIES-CONDITIONAL ONLY: facial features (eyes/ears/
// mouth) are universal to every humanoid head, so they render an empty card like
// face/head/neck — an empty 'face' card showing while 'mouth' did not was an
// inconsistency. Tail + the centaur hind pair stay proposed (a human has no tail).
// This governs the slot CARDS only; the silhouette still always draws the facial
// features as idle anatomy (see silhouetteSvg), and paired layout couples a
// populated half of a pair with a ghost for its empty half.
const PROPOSED_SLOTS = new Set(["tail", "hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot"]);

// Slots a given family ALWAYS shows (overrides PROPOSED_SLOTS for that family):
// centaurs always have 4 hind-legs + a tail; lamia always has a tail.
// Winged families (avian/draconic) and the wings slot are not yet drawn.
const FAMILY_ALWAYS_SLOTS = {
  centauroid: new Set(["hind_left_leg", "hind_right_leg", "hind_left_foot", "hind_right_foot", "tail"]),
  serpentine: new Set(["tail"]),
  digitigrade: new Set(["tail"]), // cats, foxes, wolves all have tails
  // humanoid doesn't auto-add — tail (rare for humans) appears only when populated
};

// ─── Panel layout ───────────────────────────────────────────────────────────
// One of three densities, driven by a single in-panel switch:
//   'paired'  → silhouette + L/R aligned rows, ghost-fill coupling (default)
//   'columns' → silhouette + packed two-column layout (paired off)
//   'list'    → the digest only: single-column Wounds→Held→Worn→State, no
//               silhouette, most compact (also auto-used below 360px via CSS)
// The mode is read at render time so the doll grid is built natively for the
// current layout. Persisted layout is owned by the host (settings); this is the
// in-memory mirror the renderer reads.
let currentLayout = "paired";

/** Set the doll layout mode read by the next render. */
function setDollLayout(mode) {
  currentLayout = ["paired", "columns", "list"].includes(mode) ? mode : "paired";
  return currentLayout;
}

// True left/right pairs that share one row in paired layout.
const LAYOUT_PAIRS = [
  ["left_eye", "right_eye"],
  ["left_ear", "right_ear"],
  ["left_shoulder", "right_shoulder"],
  ["left_arm", "right_arm"],
  ["left_hand", "right_hand"],
  ["left_leg", "right_leg"],
  ["hind_left_leg", "hind_right_leg"],
  ["left_foot", "right_foot"],
  ["hind_left_foot", "hind_right_foot"],
];
const PAIR_OF = (() => {
  const m = {};
  for (const [l, r] of LAYOUT_PAIRS) {
    m[l] = r;
    m[r] = l;
  }
  return m;
})();
// Anatomical top→bottom order for the paired-layout walk (mirrors SLOT_Y).
const LAYOUT_SLOT_ORDER = [
  "head",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "face",
  "mouth",
  "neck",
  "left_shoulder",
  "right_shoulder",
  "chest",
  "back",
  "left_arm",
  "right_arm",
  "waist",
  "left_hand",
  "right_hand",
  "left_leg",
  "right_leg",
  "hind_left_leg",
  "hind_right_leg",
  "tail",
  "left_foot",
  "right_foot",
  "hind_left_foot",
  "hind_right_foot",
];

// In-panel quick switch: a small segmented [paired | columns | list] toggle so
// the layout density can flip without opening Settings. It lives in BOTH the
// figure (under the silhouette's controls) and the digest (right-aligned),
// since each is hidden in the other. Click handlers are bound by the panel.
function layoutSwitchHtml() {
  const opt = (mode, icon, title, label) =>
    `<button class="bh-ls-opt${mode === currentLayout ? " bh-ls-active" : ""}" data-layout="${mode}" title="${title}" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
  return `<div class="bh-layout-switch" role="group" aria-label="Panel layout">
        ${opt("paired", "fa-grip-lines", "Paired rows — L/R aligned, every box coupled to the body", "Paired rows")}
        ${opt("columns", "fa-table-columns", "Columns — packed two-column layout", "Columns")}
        ${opt("list", "fa-list", "Compact list — no silhouette, saves space", "Compact list")}
    </div>`;
}

// ─── Species → silhouette family ──────────────────────────────────────────
// Four families. Unmapped species fall back to humanoid (never errors) and
// get a small "humanoid silhouette" tag so the user knows the model emitted
// something unmapped. The MODEL still emits the full schema; we just pick
// which SVG legs/feet shape to draw. Body slots are identical across
// families (a lamia still has "left_foot" in the schema, even if it doesn't
// have a foot to wear a boot on — we render the slot row with an
// "off-silhouette" hint in that case).
const SPECIES_FAMILIES = {
  humanoid: [
    "human",
    "elf",
    "half-elf",
    "dwarf",
    "gnome",
    "halfling",
    "orc",
    "tiefling",
    "aasimar",
    "genasi",
    "goliath",
    "firbolg",
    "minotaur",
  ],
  digitigrade: [
    "catfolk",
    "felid",
    "cat",
    "tabaxi",
    "leonin",
    "wolffolk",
    "wolf",
    "lupine",
    "canid",
    "gnoll",
    "jackal",
    "foxfolk",
    "fox",
    "vulpine",
    "kitsune",
    "mousegirl",
    "mousefolk",
    "rodent",
    "ratfolk",
    "rabbitfolk",
    "harengon",
    "lagomorph",
    "goat",
    "satyr",
    "caprine",
  ],
  serpentine: ["lamia", "naga", "merfolk", "echidna", "serpent", "snake", "yuan-ti", "medusa"],
  centauroid: ["centaur", "driderkin"],
  // Winged families (avian / draconic) and the wings slot are not yet drawn.
  // Unmapped winged species fall back to humanoid until then.
};

function familyOf(species) {
  const s = String(species || "")
    .toLowerCase()
    .trim();
  if (!s) return "humanoid";
  for (const [family, members] of Object.entries(SPECIES_FAMILIES)) {
    if (members.includes(s)) return family;
  }
  return "humanoid"; // unmapped — fall back, never error
}

// Slots that don't visually exist on certain non-humanoid families. The
// renderer still shows the slot rows in left/right columns, but the body
// part is omitted from the silhouette and gets a small "⌀" off-body hint
// in the row.
const OFF_BODY_SLOTS = {
  humanoid: new Set(),
  digitigrade: new Set(),
  serpentine: new Set(["left_leg", "right_leg", "left_foot", "right_foot"]),
  centauroid: new Set(),
};

/**
 * Accept `holding` as either a bare string or an `{item, damage, color}` object
 * (held items can be damaged/colored too). Returns a normalized
 * `{item, damage, color}` object or null.
 */
function normalizeHolding(h) {
  if (!h) return null;
  if (typeof h === "string") return { item: h, damage: null, color: null };
  if (typeof h === "object" && h.item) {
    return { item: h.item, damage: h.damage || null, color: h.color || null };
  }
  return null;
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function damageMeta(d) {
  const key = String(d ?? "").toLowerCase();
  return DAMAGE_TIER[key] || { class: "bh-tier-0", label: key || "" };
}

/**
 * Aggregate per-slot state into the data the silhouette needs:
 *   { slot: { tier: 0..4, wounds: int, hasHolding: bool } }
 *
 * Body-part visual encoding:
 *   - STROKE on the part = worst worn-item damage tier (only at tier ≥ 2)
 *   - FILL  on the part = wound presence (capped at 3 intensity levels)
 *
 * This was the user's redesign signal: outline communicates "armor is
 * damaged here", fill communicates "the body itself is hurt here".
 * Dot-on-anatomy was less legible at small panel sizes.
 */
function computeSlotStates(state) {
  // D30: a missing limb's dependents (hand, foot) render missing too — derived,
  // not stored, so it reverses cleanly if the limb is ever restored.
  const body = withDependentMissing(state.body || {});
  const out = {};
  for (const [slot, sd] of Object.entries(body)) {
    // Per-slot flags:
    //   missing: true → acquired loss (lost arm, missing eye, gone ear).
    //                   Distinct from off-body and empty. Renders gray-striped.
    //   bare: true    → slot is exposed/unclothed (stripped, ripped off,
    //                   never worn anything). Distinct from "slot absent
    //                   from state" — bare is an explicit assertion.
    const s = {
      tier: 0,
      wornCount: 0,
      wounds: 0,
      maxWoundSev: 0,
      hasHolding: false,
      missing: sd?.missing === true,
      bare: sd?.bare === true,
    };
    if (sd?.worn?.length) {
      s.wornCount = sd.worn.length;
      for (const w of sd.worn) {
        const t = tierOf(w.damage);
        if (t > s.tier) s.tier = t;
      }
    }
    if (sd?.wounds?.length) {
      s.wounds = sd.wounds.length;
      for (const w of sd.wounds) {
        const sev = woundSeverity(w);
        if (sev > s.maxWoundSev) s.maxWoundSev = sev;
      }
    }
    if (sd?.holding) s.hasHolding = true;
    out[slot] = s;
  }
  return out;
}

/** Torso path state. Front view = chest; Back view = back. Shoulders used to
 *  be pooled in here, but they now have their own deltoid-cap regions on the
 *  silhouette (see silhouetteSvg), so pooling them would double-tint the
 *  same damage. The torso path now reflects ONLY its own slot. */
function torsoState(perSlot, view) {
  const slot = view === "back" ? "back" : "chest";
  const p = perSlot[slot];
  if (!p) return { tier: 0, wounds: 0, maxWoundSev: 0, hasHolding: false };
  return {
    tier: p.tier || 0,
    wounds: p.wounds || 0,
    maxWoundSev: p.maxWoundSev || 0,
    hasHolding: !!p.hasHolding,
  };
}

// Coverable-loss slots: a worn cover (eyepatch / ear-cover / gag) sits OVER the
// loss, so it shows the cover instead of a "missing" marker. After validation,
// missing+worn coexist ONLY on these slots (a missing limb has its worn stripped),
// so a wornCount alongside missing reliably means "covered loss".
const COVERABLE_MISSING_SLOTS = new Set(["left_eye", "right_eye", "left_ear", "right_ear", "mouth"]);

/** Build the SVG class string for one body part given its slot-state.
 *  Body-part fill intensity now reflects MAX wound SEVERITY, not count.
 *  3 bruises (all minor) → light pink; 1 stab wound → deep red. */
function partClasses(slotState) {
  const cls = ["bh-body-fill"];
  if (!slotState) return cls.join(" ");
  // A covered loss (patched eye, covered ear) shows the cover, not the missing hatch.
  if (slotState.missing && !(slotState.wornCount > 0)) {
    cls.push("bh-part-missing");
    return cls.join(" "); // uncovered missing wins over everything
  }
  if (slotState.tier >= 2) cls.push(`bh-part-tier-${slotState.tier}`);
  if (slotState.maxWoundSev > 0) cls.push(`bh-part-wound-${slotState.maxWoundSev}`);
  return cls.join(" ");
}

/** Tooltip text for a body part (hover the SVG element to see). */
function partTitle(slotKey, slotState, family) {
  const label = labelOf(slotKey, family);
  const bits = [label];
  if (slotState?.tier >= 2) {
    const tierName = ["pristine", "light wear", "damaged", "torn", "ruined"][slotState.tier];
    bits.push(`armor: ${tierName}`);
  }
  if (slotState?.wounds > 0) bits.push(`wounds: ${slotState.wounds}`);
  return bits.join(" · ");
}

// ─── Silhouette geometry ────────────────────────────────────────────────────
// One neutral, anatomically-generic mannequin. All characters render with the
// same form; the only thing that varies is the lower body, swapped per family.
//
// Shared upper body — a flowing dress-form mannequin: egg head with a chin
// taper, neck that flares into the trapezius, deltoid caps that read as
// shoulder balls, lat taper into the waist, elbow + wrist pinch on the arms,
// mitten hands.

const HEAD =
  "M 70 5 C 80.5 5, 87.5 13, 87.5 25 C 87.5 35.5, 80 45.5, 70 47.5 C 60 45.5, 52.5 35.5, 52.5 25 C 52.5 13, 59.5 5, 70 5 Z";

const NECK =
  "M 63.5 44 C 64.5 50, 64 56, 61 61 C 66.5 63.5, 73.5 63.5, 79 61 C 76 56, 75.5 50, 76.5 44 C 72.5 46.5, 67.5 46.5, 63.5 44 Z";

// Chest/back torso: shoulder line at y≈66, lats taper to the waist at y≈152.
const TORSO_PATH =
  "M 40 66 C 39 86, 42 112, 46 130 C 47.5 142, 48.5 150, 48.5 152 L 91.5 152 C 91.5 150, 92.5 142, 94 130 C 98 112, 101 86, 100 66 C 80 61, 60 61, 40 66 Z";

// Deltoid caps. Drawn after the arms so the shoulder ball sits over the joint.
const SHOULDER_L =
  "M 53 64 C 43 61, 33 64, 28.5 72 C 26 77, 25.5 83, 27 88 C 32.5 82, 39 78.5, 46.5 77.5 C 49.5 73, 51.5 68.5, 53 64 Z";

// Arm: upper arm tapers to an elbow pinch (~y132), forearm to a narrow wrist.
const ARM_L =
  "M 27 86 C 24.5 102, 23.5 118, 24 132 C 22.5 150, 22 168, 23.5 186 L 31.5 188 C 33.5 170, 34.5 152, 34 134 C 36 118, 37.5 100, 38 88 C 34 84.5, 30.5 84, 27 86 Z";

// Mitten hand under the wrist.
const HAND_L =
  "M 23.5 188 C 19.5 193, 18 200, 19 207 C 20 214, 23.5 219, 27.5 219.5 C 31.5 219, 34.5 214, 35 207 C 35.5 200, 34 193, 31.5 188 C 29 190, 26 190, 23.5 188 Z";

// Pelvis variants. Humanoid/digitigrade get a hip flare + crotch notch so the
// legs read as separate; serpentine omits the notch (flows into the tail);
// centauroid flares outward into the horse chest.
const PELVIS_BIPED =
  "M 48.5 152 C 48 162, 46 172, 44 182 C 42.5 192, 44 202, 49 208 C 55 212, 62 213.5, 68 206 L 70 202 L 72 206 C 78 213.5, 85 212, 91 208 C 96 202, 97.5 192, 96 182 C 94 172, 92 162, 91.5 152 Z";
const PELVIS_SERPENT =
  "M 48.5 152 C 48 162, 46 172, 44 182 C 42.5 192, 44 200, 47 206 C 62 201, 78 201, 93 207 C 96 200, 97.5 192, 96 182 C 94 172, 92 162, 91.5 152 Z";
const PELVIS_CENTAUR =
  "M 48.5 152 C 47 165, 44 180, 40 196 C 50 191, 60 189, 70 189 C 80 189, 90 191, 100 196 C 96 180, 93 165, 91.5 152 Z";

// ─── Lower bodies per family ────────────────────────────────────────────────

// Humanoid leg: thigh → knee pinch (~y300) → calf → ankle (~y380).
const LEG_HUM_L =
  "M 46 198 C 45 235, 48 270, 51.5 298 C 49.5 318, 50 324, 51 332 C 52.5 352, 54 368, 55 380 L 62.5 380 C 63.5 364, 64.5 345, 64.8 326 C 65 318, 64.5 310, 63.8 300 C 66 268, 67.5 232, 68.5 204 C 61 197, 53 196, 46 198 Z";

// Shoe pointing slightly outward, rounded toe.
const FOOT_HUM_L =
  "M 54.5 378 C 53 388, 51 394, 46 397 C 41 400, 38.5 404, 41 407 C 45 409.5, 54 409, 60 407 C 63 405, 64 400, 63.5 393 L 63 380 Z";

// Digitigrade leg: thigh → knee → backward hock (~y345) → metatarsus → paw.
const LEG_DIGI_L =
  "M 45 198 C 43 235, 46 268, 50 295 C 47 315, 48.5 330, 53 345 C 50 360, 49 372, 50.5 382 L 60 382 C 61.5 370, 62 358, 60.5 346 C 64.5 332, 65 315, 63 298 C 65.5 268, 67 234, 68 204 C 60 196.5, 52 196.5, 45 198 Z";

// Paw: flat rounded pad with two toe notches.
const FOOT_DIGI_L =
  "M 49 380 C 45 384, 42.5 390, 43 396 C 43.5 401, 47 404, 51.5 404.5 C 53.5 404.8, 54.5 403.2, 55.5 404.2 C 57.5 405.4, 59.5 404.8, 61 402.5 C 63 398.5, 63 390.5, 61.5 382 Z";

// Digitigrade tail: swishy curl with an inner hook. Front anchors behind the
// right hip; back view re-anchors to the centerline.
const TAIL_DIGI_FRONT =
  "M 95 205 C 113 213, 124 232, 122 256 C 120.5 272, 112 283, 103 283.5 C 97.5 283.5, 95.5 277.5, 99.5 274 C 106 271, 111 264, 110 252 C 109 238, 102 222, 93 213 Z";
const TAIL_DIGI_BACK =
  "M 62 205 C 80 213, 91 232, 89 256 C 87.5 272, 79 283, 70 283.5 C 64.5 283.5, 62.5 277.5, 66.5 274 C 73 271, 78 264, 77 252 C 76 238, 69 222, 60 213 Z";

// Rare humanoid tail (only when state populates the slot).
const TAIL_HUM = "M 96 210 C 116 220, 122 246, 110 268 C 102 276, 98 268, 102 260 C 110 244, 108 230, 100 220 Z";

// Serpentine tail: a THICK body-width serpent tail (a lamia/naga tail is as
// wide as the body, not a thin ribbon). Starts at full hip width (~52px,
// matching the pelvis), sways gently to one side, and tapers to a rounded tip.
// Drawn as a closed outline: down the left edge, around the tip, back up.
const TAIL_SERPENT = `M 45 206
    C 46 232, 48 246, 52 260
    C 57 286, 60 300, 62 315
    C 65 336, 67 350, 68 362
    C 68 380, 67 392, 68 401
    C 68 414, 67 421, 70 428
    C 71 431, 73 431, 74 427
    C 77 415, 81 407, 85 400
    C 91 387, 96 374, 96 360
    C 99 341, 102 329, 102 315
    C 101 290, 100 274, 100 260
    C 99 240, 97 221, 95 206 Z`;

// Centaur barrel (front = chest, back = rump; roughly cylindrical so the
// outline is shared, the rump just rounds the bottom edge a little more).
const BARREL_FRONT =
  "M 36 202 C 22 214, 16 238, 19 262 C 22 282, 34 294, 52 297 L 88 297 C 106 294, 118 282, 121 262 C 124 238, 118 214, 104 202 C 82 194, 58 194, 36 202 Z";
const BARREL_BACK =
  "M 36 202 C 22 214, 15 240, 19 266 C 23 286, 36 297, 54 299 L 86 299 C 104 297, 117 286, 121 266 C 125 240, 118 214, 104 202 C 82 194, 58 194, 36 202 Z";

// Horse leg: forearm/gaskin → knee/hock pinch → slim cannon → fetlock.
function horseLegPath(x) {
  return `M ${x} 290 C ${x - 2} 312, ${x - 1} 330, ${x + 2} 344 C ${x + 1} 350, ${x + 1} 354, ${x + 2} 358 C ${x + 2.5} 374, ${x + 3} 390, ${x + 3.5} 402 L ${x + 13} 402 C ${x + 13.5} 390, ${x + 14} 374, ${x + 14.5} 358 C ${x + 15.5} 354, ${x + 15.5} 350, ${x + 14.5} 344 C ${x + 17} 330, ${x + 17.5} 312, ${x + 16} 292 Z`;
}
// Hoof: flared trapezoid (not an ellipse).
function hoofPath(cx) {
  return `M ${cx - 7.5} 404 L ${cx + 6.5} 404 C ${cx + 8} 410, ${cx + 8.5} 416, ${cx + 7.5} 419 L ${cx - 8.5} 419 C ${cx - 9.5} 416, ${cx - 9} 410, ${cx - 7.5} 404 Z`;
}

// Horse tail: thick hair rope from the top of the rump, slight sway + taper.
const TAIL_HORSE = "M 64 203 C 58 240, 56 290, 62 330 C 65 346, 76 348, 80 336 C 86 296, 84 240, 78 205 Z";

// ─── Mirror + small helpers ────────────────────────────────────────────────

/** Mirror an SVG path's x coordinates around the centerline (x' = 140 − x). */
function mirrorPath(d) {
  // Tokenize numbers; in this path language every coordinate pair is "x y".
  // Commands used are M/C/L (absolute) so x is every even-indexed number
  // within each command's argument run.
  return d.replace(/([MLC])([^MLCZz]+)/g, (_, cmd, args) => {
    const nums = args
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const out = [];
    for (let i = 0; i < nums.length; i += 2) {
      out.push(`${+(140 - nums[i]).toFixed(2)} ${nums[i + 1]}`);
    }
    return cmd + " " + out.join(", ");
  });
}

const ARM_R = mirrorPath(ARM_L);
const HAND_R = mirrorPath(HAND_L);
const SHOULDER_R = mirrorPath(SHOULDER_L);
const LEG_HUM_R = mirrorPath(LEG_HUM_L);
const FOOT_HUM_R = mirrorPath(FOOT_HUM_L);
const LEG_DIGI_R = mirrorPath(LEG_DIGI_L);
const FOOT_DIGI_R = mirrorPath(FOOT_DIGI_L);

// Facial anatomy. These are ALWAYS drawn (a face has two eyes, two ears, a
// mouth) — when a slot is untracked they render as quiet "idle" features;
// tracked state tints them exactly like any body part. Drawing them only when
// populated would make "nothing tracked on the right ear" indistinguishable
// from "lost the right ear" (the latter is what `missing: true` + the hatch
// pattern are for).
const FACE_FEATURES = {
  left_eye: '<ellipse cx="62" cy="24.5" rx="3.1" ry="2.2"',
  right_eye: '<ellipse cx="78" cy="24.5" rx="3.1" ry="2.2"',
  left_ear: '<ellipse cx="52" cy="27" rx="2.4" ry="4.5"',
  right_ear: '<ellipse cx="88" cy="27" rx="2.4" ry="4.5"',
  mouth: '<ellipse cx="70" cy="38.5" rx="5.2" ry="1.7"',
};

// The `face` slot (veils, visors, masks, war paint, rouge) gets a facial oval
// on the head front — drawn behind the eye/ear/mouth features and only in
// front view (the face isn't visible from behind). Positioned on the lower
// face (cheeks → jaw, around the mouth) so the crown above reads clearly as
// the separate `head` slot (head = hats/helms/circlets; face = veils/masks).
const FACE_OVAL = '<ellipse cx="70" cy="39" rx="9.5" ry="8.5"';

function silhouetteSvg(perSlot, view, holding, family) {
  family = family || "humanoid";
  const part = (slotKey) => partClasses(perSlot[slotKey]);
  const title = (slotKey) => `<title>${escapeHtml(partTitle(slotKey, perSlot[slotKey], family))}</title>`;
  const torsoSlot = view === "back" ? "back" : "chest";
  const torsoClass = partClasses(torsoState(perSlot, view));
  const torsoTip = `<title>${escapeHtml(partTitle(torsoSlot, torsoState(perSlot, view), family))}</title>`;

  const holdMarkers = holding
    .map(({ slot, item, damage }) => {
      const pos = HAND_POSITIONS[slot];
      if (!pos) return "";
      const handSide = slot === "left_hand" ? "left" : "right";
      const tip = damage
        ? `Held in ${handSide} hand (character's POV) — ${item} (${damage})`
        : `Held in ${handSide} hand (character's POV) — ${item}`;
      return `<g class="bh-hold-marker" transform="translate(${pos.x},${pos.y})">
            <title>${escapeHtml(tip)}</title>
            <text y="2" text-anchor="middle" class="bh-hold-icon">✦</text>
        </g>`;
    })
    .join("");

  // Subtle spine indicator visible only in back view. Pure decorative —
  // gives the viewer a "yes this is the back" anchor.
  const spineHint =
    view === "back"
      ? `<line x1="70" y1="66" x2="70" y2="150" class="bh-spine-line"/>
           <line x1="70" y1="156" x2="70" y2="198" class="bh-spine-line"/>`
      : "";

  // Lower-body geometry varies by species family. Upper body is shared.
  const lowerBody = lowerBodyParts(perSlot, family, part, title, view);

  // Facial anatomy — ALWAYS drawn. Tracked slots get their per-slot tier /
  // wound classes; untracked ones render as quiet idle features. Eyes + mouth
  // hide in back view (you're behind the head); ears stay (visible from
  // behind). A face's right ear with nothing tracked should look different
  // from a face that lost its right ear (missing → the hatch pattern).
  const faceFeature = (s, shape) => {
    const hidden = view === "back" && (s.endsWith("eye") || s === "mouth");
    if (hidden) return "";
    if (perSlot[s]) {
      return `<g class="bh-part" data-slot="${s}">${title(s)}${shape} class="${part(s)}"/></g>`;
    }
    return `<g class="bh-part bh-face-idle-part" data-slot="${s}"><title>${escapeHtml(labelOf(s, family))} — nothing tracked</title>${shape} class="bh-body-fill bh-face-idle"/></g>`;
  };
  const featureOverlay = Object.keys(FACE_FEATURES)
    .map((s) => faceFeature(s, FACE_FEATURES[s]))
    .join("");

  // Face region — on the head front, behind the eye/ear/mouth features, front
  // view only (the face isn't visible from behind). Always drawn (idle when
  // untracked) so face items (veils, masks, paint) have a region to couple to.
  const faceRegion =
    view === "back"
      ? ""
      : (() => {
          if (perSlot.face) {
            return `<g class="bh-part" data-slot="face">${title("face")}${FACE_OVAL} class="${part("face")}"/></g>`;
          }
          return `<g class="bh-part bh-face-idle-part" data-slot="face"><title>face — nothing tracked</title>${FACE_OVAL} class="bh-body-fill bh-face-idle"/></g>`;
        })();

  // Front view mirrors the body so character-left visually appears on
  // viewer-right (the character faces you, so their right is on your left
  // — standard anatomical convention). Back view does NOT mirror because
  // you're behind the character now, so their left is on your left.
  const mirror = view === "front" ? 'transform="scale(-1, 1) translate(-140, 0)"' : "";

  // Flowing dress-form mannequin. Each region is a separate path/shape tagged
  // with data-slot so per-slot tinting (.bh-part-tier-N for armor stroke,
  // .bh-part-wound-N for wound fill) works unchanged. Shoulder deltoid caps
  // are drawn AFTER the arms so the shoulder ball sits over the joint.
  return `<svg class="bh-silhouette" viewBox="0 0 140 440" data-view="${view}" data-family="${family}" aria-hidden="true">
        <defs>
            <pattern id="bh-missing-pattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#888" stroke-width="1.2" stroke-opacity="0.6"/>
            </pattern>
        </defs>
        <g class="bh-body-group" ${mirror}>
            <g class="bh-part" data-slot="head">${title("head")}<path d="${HEAD}" class="${part("head")}"/></g>
            ${faceRegion}
            ${featureOverlay}
            <g class="bh-part" data-slot="neck">${title("neck")}<path d="${NECK}" class="${part("neck")}"/></g>
            <g class="bh-part" data-slot="${torsoSlot}">${torsoTip}<path d="${TORSO_PATH}" class="${torsoClass}"/></g>
            ${pelvisHtml(perSlot, family, part, title)}
            <g class="bh-part" data-slot="left_arm">${title("left_arm")}<path d="${ARM_L}" class="${part("left_arm")}"/></g>
            <g class="bh-part" data-slot="right_arm">${title("right_arm")}<path d="${ARM_R}" class="${part("right_arm")}"/></g>
            <g class="bh-part" data-slot="left_hand">${title("left_hand")}<path d="${HAND_L}" class="${part("left_hand")}"/></g>
            <g class="bh-part" data-slot="right_hand">${title("right_hand")}<path d="${HAND_R}" class="${part("right_hand")}"/></g>
            <g class="bh-part bh-shoulder" data-slot="left_shoulder">${title("left_shoulder")}<path d="${SHOULDER_L}" class="${part("left_shoulder")}"/></g>
            <g class="bh-part bh-shoulder" data-slot="right_shoulder">${title("right_shoulder")}<path d="${SHOULDER_R}" class="${part("right_shoulder")}"/></g>
            ${lowerBody}

            ${spineHint}
            ${holdMarkers}
        </g>
    </svg>`;
}

/**
 * Pelvis / hip region. It belongs to the waist slot (one slot, two shapes — the
 * torso lats taper into it). Centauroid uses a wider flare into the horse chest;
 * the other families share the biped/serpent pelvis. Drawn before the arms so
 * the arms layer over the hip edge.
 */
function pelvisHtml(perSlot, family, part, title) {
  let pelvis;
  if (family === "centauroid") pelvis = PELVIS_CENTAUR;
  else if (family === "serpentine") pelvis = PELVIS_SERPENT;
  else pelvis = PELVIS_BIPED;
  return `<g class="bh-part" data-slot="waist">${title("waist")}<path d="${pelvis}" class="${part("waist")}"/></g>`;
}

/**
 * Lower-body SVG paths per species family. Upper body is shared.
 *
 *   humanoid    — two tapered legs + shoe-shaped feet
 *   digitigrade — legs with a backward hock; flat paw feet
 *   serpentine  — no legs; a thick body-width tail. left/right_leg + foot slots
 *                 are marked off-silhouette in the slot rows.
 *   centauroid  — horse-like quadruped extension below the waist. The four
 *                 leg slots get distributed (left_leg=fore-left, etc.).
 */
function lowerBodyParts(perSlot, family, part, title, view) {
  view = view === "back" ? "back" : "front";
  const pathPart = (slot, d, extra) =>
    `<g class="bh-part" data-slot="${slot}">${title(slot)}<path d="${d}" class="${part(slot)}${extra ? " " + extra : ""}"/></g>`;

  if (family === "serpentine") {
    // Lamia / naga / merfolk tail — a thick, body-width serpent tail
    // (as wide as the body, not a thin ribbon). Wrapped in data-slot="tail"
    // so items (silver bands, magical wraps) can land on it.
    return pathPart("tail", TAIL_SERPENT, "bh-tail");
  }
  if (family === "centauroid") {
    // Centaur — view-aware. Real horse anatomy: from the FRONT you see the
    // chest + 2 fore legs; the hind legs and tail are HIDDEN behind the
    // body. From the BACK you see the rump + 2 hind legs + tail; the fore
    // legs are HIDDEN behind. The slot cards stay in the columns regardless
    // of view — they just don't light up the silhouette when the part isn't
    // visible from the current angle. The barrel belongs to the waist slot.
    const fore = view !== "back";
    const legL = fore ? "left_leg" : "hind_left_leg";
    const legR = fore ? "right_leg" : "hind_right_leg";
    const footL = fore ? "left_foot" : "hind_left_foot";
    const footR = fore ? "right_foot" : "hind_right_foot";
    const barrel = view === "back" ? BARREL_BACK : BARREL_FRONT;
    const barrelHtml = pathPart("waist", barrel);
    // Horse tail hangs from the top of the rump — only visible from behind.
    const tail = view === "back" ? pathPart("tail", TAIL_HORSE, "bh-tail") : "";
    return [
      barrelHtml,
      tail,
      pathPart(legL, horseLegPath(41)),
      pathPart(legR, horseLegPath(83)),
      pathPart(footL, hoofPath(49.5)),
      pathPart(footR, hoofPath(91.5)),
    ].join("");
  }
  if (family === "digitigrade") {
    // Catfolk / foxfolk / wolffolk / etc. Legs bend back at a hock; the
    // foot reads as a flat paw rather than a shoe. View-aware tail: peeks
    // from behind the right hip in FRONT view; re-anchors to the centerline
    // in BACK view.
    const tailD = view === "back" ? TAIL_DIGI_BACK : TAIL_DIGI_FRONT;
    return [
      pathPart("left_leg", LEG_DIGI_L),
      pathPart("right_leg", LEG_DIGI_R),
      pathPart("left_foot", FOOT_DIGI_L),
      pathPart("right_foot", FOOT_DIGI_R),
      pathPart("tail", tailD, "bh-tail"),
    ].join("");
  }
  // humanoid (default fallback for any family without its own lower body).
  // Tapered legs, shoe-shaped feet pointing outward. A tail is rendered when
  // the family always has one OR when state explicitly populates it (rare
  // humanoid case).
  const familyAlwaysHasTail = (FAMILY_ALWAYS_SLOTS[family] || new Set()).has("tail");
  const optionalTail = perSlot.tail || familyAlwaysHasTail ? pathPart("tail", TAIL_HUM, "bh-tail") : "";
  return [
    pathPart("left_leg", LEG_HUM_L),
    pathPart("right_leg", LEG_HUM_R),
    pathPart("left_foot", FOOT_HUM_L),
    pathPart("right_foot", FOOT_HUM_R),
    optionalTail,
  ].join("");
}

// Hand-marker anchor points for held items (✦), matched to the v2 mitten hands.
const HAND_POSITIONS = {
  left_hand: { x: 27, y: 205 },
  right_hand: { x: 113, y: 205 },
};

/**
 * Collect renderable rows from a character state. Worn items spanning
 * multiple slots are GROUPED — a sundress at chest + waist + L_leg + R_leg
 * renders as one row "Sundress · chest · waist · legs", not four. Grouping
 * key is (lowercased item, damage); two "boots" with different damage stay
 * separate rows.
 *
 * Returns: [{slots: [str], kind: 'worn'|'holding', item, damage?}].
 */
function collectSlotRows(state) {
  const body = state.body || {};

  // Group worn entries by (item, damage, color) → merged slot list.
  // Each worn entry may carry an optional `color`. Two "shirts" with
  // different colors stay separate groups so the chip can render both
  // distinctly (a red shirt and a blue shirt aren't "both shirts").
  const wornGroups = new Map();
  for (const [slot, sd] of Object.entries(body)) {
    if (!sd?.worn?.length) continue;
    for (const w of sd.worn) {
      const item = w.item || "?";
      const dmg = w.damage || "";
      const color = w.color || "";
      // Group by CANONICAL garment (boot==boots) + CANONICAL color (crimson==red).
      // The displayed `item`/`color` keep the original (first-seen) surface; only
      // the grouping key is normalized, so a cross-slot "boot"/"boots" split renders
      // as ONE row instead of two.
      const key = `${canonicalGarment(item)}|${dmg.toLowerCase()}|${normalizeColor(color)}`;
      if (!wornGroups.has(key)) {
        wornGroups.set(key, { kind: "worn", item, damage: dmg, color, slots: [] });
      }
      wornGroups.get(key).slots.push(slot);
    }
  }

  // Holding entries are inherently per-slot (each hand can hold one thing).
  // holding is {item, damage, [color]} (with a bare-string fallback).
  const holdRows = [];
  for (const [slot, sd] of Object.entries(body)) {
    const h = normalizeHolding(sd?.holding);
    if (h) {
      holdRows.push({ kind: "holding", item: h.item, damage: h.damage, color: h.color, slots: [slot] });
    }
  }

  // Wounds become first-class rows. Each wound carries its inferred (or
  // explicit) severity tier 1..3 so the chip can render colored accordingly
  // — bruise vs stab wound shouldn't look identical. A wound may also carry a
  // `bleeding` flag — the chip uses it to render a small drop indicator and a
  // subtle pulse, separating fresh wounds from sealed/scabbed ones.
  const woundRows = [];
  for (const [slot, sd] of Object.entries(body)) {
    if (!sd?.wounds?.length) continue;
    for (const w of sd.wounds) {
      const bleeding = typeof w === "object" && w !== null && w.bleeding === true;
      woundRows.push({
        kind: "wound",
        item: woundText(w),
        severity: woundSeverity(w),
        bleeding,
        slots: [slot],
      });
    }
  }

  return [...wornGroups.values(), ...holdRows, ...woundRows];
}

/**
 * Format a list of slot keys for display. Collapses symmetric pairs:
 *   ['left_leg', 'right_leg'] → 'both legs'
 *   ['chest', 'waist']        → 'chest · waist'
 *   ['left_hand']             → 'L. hand'
 */
function formatSlotList(slots) {
  if (slots.length === 2) {
    const [a, b] = slots;
    const PAIRS = {
      "left_hand|right_hand": "both hands",
      "left_arm|right_arm": "both arms",
      "left_leg|right_leg": "both legs",
      "left_foot|right_foot": "both feet",
      "left_shoulder|right_shoulder": "both shoulders",
    };
    const key = [a, b].sort().join("|");
    if (PAIRS[key]) return PAIRS[key];
  }
  return slots.map((s) => SLOT_LABEL[s] || s).join(" · ");
}

/**
 * Which column (left/right/center) does a merged row belong in?
 * Single-side items go to their side; mixed/center rows go to whichever
 * column is shorter at render time (returned as 'center').
 */
function rowSide(slots) {
  const sides = new Set(slots.map((s) => SLOT_SIDE[s] || "center"));
  if (sides.size === 1) {
    const only = [...sides][0];
    if (only === "left" || only === "right") return only;
  }
  return "center";
}

/**
 * Render a single character's paper doll. Returns HTML string.
 *
 * `view` is 'front' (default) or 'back'. In back view the torso reflects the
 * 'back' slot's state instead of 'chest', and a subtle spine line appears so
 * the user knows they're seeing the rear silhouette.
 */
function renderCharacterDoll(name, state, view, opts = {}) {
  state = state || {};
  view = view === "back" ? "back" : "front";
  const placeholder = opts.placeholder === true;
  const body = state.body || {};
  const family = familyOf(state.species);
  const offBodySlots = OFF_BODY_SLOTS[family] || OFF_BODY_SLOTS.humanoid;

  // Per-slot aggregate state drives body-part stroke (armor damage) and
  // fill (wound) coloring. Replaces the old wound-dot-on-anatomy approach.
  const perSlot = computeSlotStates(state);

  // Hold markers on the silhouette (✦ on hand positions). Wounds are now
  // first-class slot rows via collectSlotRows (kind='wound'), so we don't
  // need a separate wounds list here.
  const holding = [];
  for (const [slot, sd] of Object.entries(body)) {
    const h = normalizeHolding(sd?.holding);
    if (h) holding.push({ slot, item: h.item, damage: h.damage });
  }

  const realRows = collectSlotRows(state);

  // Group rows BY each slot they cover. Multi-slot items (sundress on
  // chest+waist+legs) are included in EVERY slot card they touch — the
  // user explicitly preferred this over a separate "spanning" section.
  // Same row object referenced in multiple slots' lists is fine; it's
  // just rendered once per card.
  const rowsBySlot = new Map();
  for (const row of realRows) {
    for (const s of row.slots) {
      if (!rowsBySlot.has(s)) rowsBySlot.set(s, []);
      rowsBySlot.get(s).push(row);
    }
  }

  // Build one card per anatomical slot (or skip off-body slots for species
  // that don't have them). Empty slot → ghost card (faint one-liner).
  // PROPOSED slots (facial features, species-conditional slots) only render
  // a card when state explicitly references them OR when the family always
  // has them (centaurs always get hind-legs + tail, lamia always gets tail,
  // digitigrade species always get tail).
  const alwaysSlots = FAMILY_ALWAYS_SLOTS[family] || new Set();
  const allSlotKeys = Object.keys(SLOT_Y).filter((s) => {
    if (offBodySlots.has(s)) return false;
    if (PROPOSED_SLOTS.has(s) && !rowsBySlot.has(s) && !perSlot[s] && !alwaysSlots.has(s)) return false;
    return true;
  });
  const slotCards = allSlotKeys
    .map((slot) => ({ slot, items: rowsBySlot.get(slot) || [] }))
    .sort((a, b) => (SLOT_Y[a.slot] ?? 50) - (SLOT_Y[b.slot] ?? 50));

  const paired = currentLayout === "paired";

  // Distribute slot cards into left/right columns.
  //
  // Columns mode: pack by anatomical side, center slots into the shorter
  // column (the host's two-column layout).
  //
  // Paired mode: lay the grid out so every true L/R pair shares one row
  // (col 1 ← left, col 3 ← right); a populated half of a pair forces a ghost
  // card for the empty half so every silhouette region has a coupled box and
  // pairs stay symmetric; center / unpaired slots flow in anatomical order,
  // packing two-per-row to fill the gaps beside the figure. Each card gets an
  // inline grid-column/grid-row so the CSS grid (.bh-doll-grid.bh-paired)
  // places it; the figure spans the middle column across all rows.
  const cols = { left: [], right: [] };
  let figureSpan = "";
  if (paired) {
    const bySlot = new Map(slotCards.map((sc) => [sc.slot, sc]));
    // Couple every populated half of a pair with a ghost for its empty half.
    // Off-body slots (e.g. serpentine legs) are excluded above, so they
    // never create a ghost.
    for (const sc of slotCards) {
      const mate = PAIR_OF[sc.slot];
      if (mate && !bySlot.has(mate) && !offBodySlots.has(mate)) {
        bySlot.set(mate, { slot: mate, items: [], ghost: true });
      }
    }
    const place = (entry, col, r) => {
      entry.style = `grid-column:${col};grid-row:${r}`;
      (col === 1 ? cols.left : cols.right).push(entry);
    };
    let row = 0;
    let pendingCenterCol = 0; // 0 = none; 3 = a row with a free col-3 cell
    const seen = new Set();
    for (const slot of LAYOUT_SLOT_ORDER) {
      const entry = bySlot.get(slot);
      if (!entry || seen.has(slot)) continue;
      const mate = PAIR_OF[slot];
      if (mate && bySlot.has(mate)) {
        // True pair → its own fresh row. left key → col1, right → col3.
        row += 1;
        const isLeft = slot.startsWith("left") || slot.startsWith("hind_left");
        place(entry, isLeft ? 1 : 3, row);
        place(bySlot.get(mate), isLeft ? 3 : 1, row);
        seen.add(slot);
        seen.add(mate);
        pendingCenterCol = 0;
      } else {
        // Center / unpaired slot → fill a pending col-3, else open col1.
        if (pendingCenterCol === 3) {
          place(entry, 3, row);
          pendingCenterCol = 0;
        } else {
          row += 1;
          place(entry, 1, row);
          pendingCenterCol = 3;
        }
        seen.add(slot);
      }
    }
    figureSpan = `grid-column:2;grid-row:1 / ${row + 2}`;
  } else {
    for (const sc of slotCards) {
      const side = SLOT_SIDE[sc.slot] || "center";
      if (side === "left") cols.left.push(sc);
      else if (side === "right") cols.right.push(sc);
      else {
        (cols.left.length <= cols.right.length ? cols.left : cols.right).push(sc);
      }
    }
  }

  /** Render one inline chip representing a worn item, held item, or wound.
   *
   *  Layout: [glyph/dot] [item name].
   *  Damage tier / wound severity is encoded SOLELY by the dot/glyph color.
   *  Exact word ("frayed" / "critical" / etc.) lives in the title tooltip,
   *  not in inline text — inline text was forcing mid-word wraps on long
   *  item names (`cracked breastpla|te`, `silver wedding|band`) by stealing
   *  the second column.  */
  // Color → swatch. The palette below is the set of controlled values;
  // free-text variants ("crimson", "burgundy") fall back to a neutral and
  // rely on the tooltip for the exact word. Color renders as an inline swatch
  // beside the damage dot, NOT as a word prefix — text reads cleanly, color
  // reads as color. The tooltip preserves the literal color word.
  const PALETTE = new Set([
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "brown",
    "black",
    "white",
    "gray",
    "beige",
    "gold",
    "silver",
    "navy",
    "tan",
  ]);
  const colorClass = (color) => {
    if (!color) return "";
    const c = String(color).trim().toLowerCase();
    if (!c) return "";
    return PALETTE.has(c) ? `bh-c-${c}` : "bh-c-other";
  };
  const colorSwatch = (row) => {
    if (!row.color) return "";
    const cls = colorClass(row.color);
    return `<span class="bh-chip-swatch ${cls}" title="color: ${escapeHtml(row.color)}"></span>`;
  };
  // Escaped like every sibling label: this lands inside a title="…" attribute,
  // and the colour word comes from the extractor, i.e. ultimately from prose.
  const colorTitle = (row) => (row.color ? ` · color: ${escapeHtml(row.color)}` : "");

  // (Severity dots ▪/▪▪/▪▪▪ removed — the wound chip's COLOR already
  // encodes severity, the dots were redundant noise.)

  // Multi-slot indicator: when a row covers >1 slot (e.g. sundress on chest +
  // waist + both legs), append a small chain glyph + count. Chip stays in
  // every slot it covers (testers explicitly preferred this), but readers
  // can see "this item also lives elsewhere" at a glance.
  const multiSlot = (row) => {
    if (!row.slots || row.slots.length <= 1) return "";
    const list = row.slots.map((s) => labelOf(s, family)).join(", ");
    return `<span class="bh-chip-multi" title="also on: ${escapeHtml(list)}">⌖${row.slots.length}</span>`;
  };

  // Verbose label sub-row — wraps onto a second line in Full view so the
  // chip text on line 1 isn't pushed off the card by the labels. The row
  // wrapper is hidden in non-Full views; in Full it's flex-basis:100% to
  // force a line break, indented to align under the item text.
  const verboseRow = (parts) => {
    const labels = parts.filter(Boolean).join("");
    if (!labels) return "";
    return `<span class="bh-chip-verbose-row">${labels}</span>`;
  };
  const dmgLabel = (damage) => {
    if (!damage) return "";
    const label = damageMeta(damage).label;
    return `<span class="bh-chip-verbose bh-chip-verbose-dmg">${escapeHtml(label)}</span>`;
  };
  // Verbose color label — the literal color word ("rust-red", "ivory",
  // "burgundy"). The swatch carries the same info graphically, so this is
  // gated behind the Color layer: users who want a clean view can disable
  // the layer and rely on swatches alone; users who want full annotation
  // get the word too. Free-text colors that don't map to a palette class
  // are STILL useful here (the swatch falls back to neutral).
  const colorLabel = (row) => {
    if (!row?.color) return "";
    return `<span class="bh-chip-verbose bh-chip-verbose-color">${escapeHtml(row.color)}</span>`;
  };
  const sevLabel = (sev) => {
    const label = ["", "minor", "serious", "critical"][sev || 2];
    return `<span class="bh-chip-verbose bh-chip-verbose-sev">${label}</span>`;
  };
  const bleedLabel = (bleed) => (bleed ? `<span class="bh-chip-verbose bh-chip-verbose-bleed">bleeding</span>` : "");

  const renderChip = (row) => {
    if (row.kind === "wound") {
      const sev = row.severity || 2;
      const sevText = ["", "minor", "serious", "critical"][sev];
      const bleed = row.bleeding === true;
      const bleedTitle = bleed ? " · bleeding" : "";
      // Bleeding wounds: the ✚ glyph itself pulses red. No separate
      // status dot — the glyph IS the indicator.
      return `<span class="bh-chip bh-chip-wound bh-chip-wound-${sev} ${bleed ? "bh-chip-bleeding" : ""}" title="wound · ${sevText}${bleedTitle}">
                <span class="bh-chip-head"><span class="bh-chip-glyph">✚</span><span class="bh-chip-text">${escapeHtml(row.item)}</span>${multiSlot(row)}</span>${verboseRow([sevLabel(sev), bleedLabel(bleed)])}
            </span>`;
    }
    if (row.kind === "holding") {
      // Held items can carry damage too. Apply the same tier class as
      // worn so .bh-chip-dot picks up the right color; the ✦ glyph stays
      // the "held" identifier.
      const meta = damageMeta(row.damage);
      const dmgTitle = row.damage ? ` · ${escapeHtml(meta.label)}` : "";
      return `<span class="bh-chip bh-chip-hold ${meta.class}" title="held${dmgTitle}${colorTitle(row)}">
                <span class="bh-chip-head"><span class="bh-chip-dot"></span><span class="bh-chip-glyph">✦</span>${colorSwatch(row)}<span class="bh-chip-text">${escapeHtml(row.item)}</span>${multiSlot(row)}</span>${verboseRow([dmgLabel(row.damage), colorLabel(row)])}
            </span>`;
    }
    // worn
    const meta = damageMeta(row.damage);
    const dmgTitle = row.damage ? ` · ${escapeHtml(meta.label)}` : "";
    return `<span class="bh-chip ${meta.class}" title="worn${dmgTitle}${colorTitle(row)}">
            <span class="bh-chip-head"><span class="bh-chip-dot"></span>${colorSwatch(row)}<span class="bh-chip-text">${escapeHtml(row.item)}</span>${multiSlot(row)}</span>${verboseRow([dmgLabel(row.damage), colorLabel(row)])}
        </span>`;
  };

  /** Render one slot card. Empty slots get a faint one-liner placeholder.
   *  Border color reflects ARMOR damage only (worst worn tier in this slot).
   *  Wounds get their own ✚N marker in the header — combining them into a
   *  green-red gradient looked off when a slot had ONLY a wound.
   *  Missing slots (acquired loss — lost arm, missing eye) render with
   *  gray hatch/strikethrough. Distinct from "empty" and "off-body". */
  const renderSlotCard = ({ slot, items, style }) => {
    const slotLabel = labelOf(slot, family);
    const slotState = perSlot[slot];
    const styleAttr = style ? ` style="${style}"` : "";
    // A covered loss (patched eye / covered ear / gag) shows the cover, not the
    // "missing" tag — the cover IS the visible, tracked state there.
    const coveredLoss = COVERABLE_MISSING_SLOTS.has(slot) && slotState?.wornCount > 0;
    if (slotState?.missing && !coveredLoss) {
      return `<div class="bh-slot-card bh-slot-missing" data-slot="${slot}" data-slots="${slot}"${styleAttr} title="${escapeHtml(slotLabel)} — missing / lost">
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
                <span class="bh-slot-missing-tag">missing</span>
            </div>`;
    }
    // bare: narration explicitly confirmed the slot is uncovered. Distinct
    // from empty: empty = unknown, bare = known-uncovered. Renders with a
    // skin-tone left bar instead of the gray "missing" hatch.
    if (slotState?.bare && items.length === 0) {
      return `<div class="bh-slot-card bh-slot-bare" data-slot="${slot}" data-slots="${slot}"${styleAttr} title="${escapeHtml(slotLabel)} — bare (narration confirmed uncovered)">
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
                <span class="bh-slot-bare-tag">bare</span>
            </div>`;
    }
    if (items.length === 0) {
      return `<div class="bh-slot-card bh-slot-empty" data-slot="${slot}" data-slots="${slot}"${styleAttr}>
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
            </div>`;
    }
    // Sort: worn first (outer→inner per schema), then holding, then wounds.
    const wornItems = items.filter((i) => i.kind === "worn");
    const heldItems = items.filter((i) => i.kind === "holding");
    const ordered = [...wornItems, ...heldItems, ...items.filter((i) => i.kind === "wound")];
    // Damage tier now reads from each CHIP's own left bar (CSS ::before
    // colored by .bh-tier-N), so the card itself no longer carries a
    // tier border. Each item's bar matches its own chip's height — three
    // items = three same-height bars, naturally aligned. Wounds get no
    // bar (they aren't gear damage; the ✚ glyph + severity dots speak
    // for themselves). The wound-only slot also has no card border now;
    // the wound chips inside identify themselves.
    const woundChips = ordered.filter((i) => i.kind === "wound");
    const woundCount = woundChips.length;
    const cardClasses = [
      "bh-slot-card",
      wornItems.length > 1 ? "bh-slot-worn-stacked" : "", // drives the per-chip 1/N indices
    ]
      .filter(Boolean)
      .join(" ");
    // Render chips. Worn stacks get layer indices; held chips render
    // as-is. Wounds go into their own sub-group (.bh-slot-wounds) so
    // they're visually separated from the gear with a dashed divider.
    const wornStacked = wornItems.length > 1;
    let wornIdx = 0;
    const itemChips = ordered
      .filter((row) => row.kind !== "wound")
      .map((row) => {
        if (row.kind === "worn" && wornStacked) {
          wornIdx += 1;
          const role = wornIdx === 1 ? "outermost" : wornIdx === wornItems.length ? "innermost" : `layer ${wornIdx}`;
          // Copy the chip's tier class onto the wrapper so the
          // wrapper's ::before bar (positioned at the card edge)
          // picks up the right tier color.
          const meta = damageMeta(row.damage);
          return `<div class="bh-chip-layered ${meta.class}" data-layer="${wornIdx}" title="${role}">
                        <span class="bh-chip-layer-idx">${wornIdx}</span>
                        ${renderChip(row)}
                    </div>`;
        }
        return renderChip(row);
      })
      .join("");
    const woundChipsHtml = woundCount ? `<div class="bh-slot-wounds">${woundChips.map(renderChip).join("")}</div>` : "";
    return `<div class="${cardClasses}" data-slot="${slot}" data-slots="${slot}"${styleAttr}>
            <div class="bh-slot-card-head">
                <span class="bh-slot-name">${escapeHtml(slotLabel)}</span>
            </div>
            <div class="bh-slot-chips">${itemChips}${woundChipsHtml}</div>
        </div>`;
  };

  /** A ghost card: a faint empty placeholder for the unpopulated half of a
   *  populated L/R pair, so every silhouette region has a coupled box and
   *  pairs stay symmetric in paired layout. */
  const ghostCard = (slot, style) => {
    const styleAttr = style ? ` style="${style}"` : "";
    return `<div class="bh-slot-card bh-slot-empty bh-slot-ghosted" data-slot="${slot}" data-slots="${slot}"${styleAttr}>
            <span class="bh-slot-name">${escapeHtml(labelOf(slot, family))}</span>
        </div>`;
  };

  const renderColCard = (entry) => (entry.ghost ? ghostCard(entry.slot, entry.style) : renderSlotCard(entry));
  const leftCol = cols.left.map(renderColCard).join("");
  const rightCol = cols.right.map(renderColCard).join("");

  // "Empty" = no real state (only ghost placeholders + nothing else).
  // Don't treat the ghost slot rows as content.
  const isEmpty = realRows.length === 0 && holding.length === 0;

  // Identity badge next to the character name. Species ALWAYS shown when
  // known (including 'human').
  const sp = state.species ? String(state.species).trim() : "";
  const speciesTag = sp ? `<span class="bh-char-species">${escapeHtml(sp)}</span>` : "";

  // Wounds are now first-class rows (kind='wound') rendered alongside worn
  // and holding rows — no separate <details> list at the bottom.

  // ── Digest (compact list) ──────────────────────────────────────────
  // Alternative DOM rendered alongside the doll grid. CSS swaps which one
  // shows: in List layout, or auto below 360px width, the digest replaces
  // the doll. The digest reorders information by IMPORTANCE (wounds first →
  // held → worn → state flags) rather than by anatomy, since the silhouette
  // spatial cue isn't shown here. A toolbar at the top carries the "Edit
  // slots" affordance (the list view's only edit entry point) and a copy of
  // the layout switch (hidden when auto-narrow).
  const digestHtml = isEmpty
    ? placeholder
      ? // Placeholder in list view: render just the layout switch so the user
        // can switch back out of the (empty) list — no "Edit slots", nothing to edit.
        `<div class="bh-digest"><div class="bh-digest-toolbar"><div class="bh-layout-switch-row">${layoutSwitchHtml()}</div></div></div>`
      : ""
    : (() => {
        const slotLabelOf = (s) => labelOf(s, family);
        // Build flat lists from collected rows (already grouped by kind).
        // Wounds: sort by severity DESC, bleeding first, then slot order.
        const wounds = realRows
          .filter((r) => r.kind === "wound")
          .map((r) => ({ row: r, slot: r.slots[0] }))
          .sort((a, b) => {
            const sevDiff = (b.row.severity || 2) - (a.row.severity || 2);
            if (sevDiff !== 0) return sevDiff;
            const bleedDiff = (b.row.bleeding ? 1 : 0) - (a.row.bleeding ? 1 : 0);
            if (bleedDiff !== 0) return bleedDiff;
            return (SLOT_Y[a.slot] ?? 50) - (SLOT_Y[b.slot] ?? 50);
          });
        // Held: left then right (hand reading order).
        const held = holding.slice().sort((a, b) => (SLOT_Y[a.slot] ?? 50) - (SLOT_Y[b.slot] ?? 50));
        // Worn: by slot Y (head → feet). Multi-slot items show in the first
        // (topmost) slot they cover; the chip's ⌖N annotation calls out the
        // rest. Layered items get the 1/N index — critical info.
        const wornBySlot = new Map();
        for (const row of realRows.filter((r) => r.kind === "worn")) {
          const topSlot = [...row.slots].sort((a, b) => (SLOT_Y[a] ?? 50) - (SLOT_Y[b] ?? 50))[0];
          if (!wornBySlot.has(topSlot)) wornBySlot.set(topSlot, []);
          wornBySlot.get(topSlot).push(row);
        }
        // Group worn rows by anatomical region for the digest. Within a
        // region, slots stay in Y order; layered items within a slot keep
        // outer→inner sequence.
        const REGIONS = [
          {
            key: "head",
            label: "Head & Face",
            slots: ["head", "face", "left_eye", "right_eye", "left_ear", "right_ear", "mouth", "neck"],
          },
          { key: "torso", label: "Torso", slots: ["left_shoulder", "right_shoulder", "chest", "back", "waist"] },
          { key: "arms", label: "Arms & Hands", slots: ["left_arm", "right_arm", "left_hand", "right_hand"] },
          { key: "legs", label: "Legs & Feet", slots: ["left_leg", "right_leg", "left_foot", "right_foot"] },
        ];
        const regionOf = (slot) => {
          for (const r of REGIONS) if (r.slots.includes(slot)) return r.key;
          return "other";
        };
        const wornByRegion = new Map(REGIONS.map((r) => [r.key, []]));
        wornByRegion.set("other", []);
        for (const [slot, rows] of [...wornBySlot.entries()].sort(
          (a, b) => (SLOT_Y[a[0]] ?? 50) - (SLOT_Y[b[0]] ?? 50),
        )) {
          const region = regionOf(slot);
          rows.forEach((row, i) => {
            wornByRegion.get(region).push({
              row,
              slot,
              layerIdx: rows.length > 1 ? i + 1 : 0,
              layerTotal: rows.length,
            });
          });
        }
        const wornTotalCount = [...wornByRegion.values()].reduce((n, group) => n + group.length, 0);
        // Missing + bare slots (semantic flags worth surfacing).
        const missingSlots = [],
          bareSlots = [];
        for (const [s, st] of Object.entries(perSlot)) {
          // A covered loss surfaces as its cover (in the worn list), not a "missing" flag.
          const coveredLoss = COVERABLE_MISSING_SLOTS.has(s) && st?.wornCount > 0;
          if (st?.missing && !coveredLoss) missingSlots.push(s);
          else if (st?.bare) bareSlots.push(s);
        }
        const slotTag = (slot, layerIdx, layerTotal) => {
          const layer = layerTotal > 1 ? `<span class="bh-digest-layer">${layerIdx}/${layerTotal}</span>` : "";
          return `<span class="bh-digest-slot">${escapeHtml(slotLabelOf(slot))}</span>${layer}`;
        };
        const digestRow = ({ row, slot, layerIdx, layerTotal }) => `
            <li class="bh-digest-row">
                ${renderChip(row)}
                ${slotTag(slot, layerIdx || 0, layerTotal || 0)}
            </li>`;
        const section = (key, label, count, items) => {
          if (!items.length) return "";
          return `<section class="bh-digest-section bh-digest-section-${key}" data-section="${key}">
                <h4 class="bh-digest-heading">${escapeHtml(label)}<span class="bh-digest-count">${count}</span></h4>
                <ul class="bh-digest-list">${items.join("")}</ul>
            </section>`;
        };
        const woundItems = wounds.map(({ row, slot }) => digestRow({ row, slot, layerIdx: 0, layerTotal: 0 }));
        const heldItems = held.map(({ slot, item, damage }) => {
          // Reconstruct a holding row that renderChip understands.
          const row = realRows.find((r) => r.kind === "holding" && r.slots[0] === slot) || {
            kind: "holding",
            item,
            damage,
            slots: [slot],
          };
          return digestRow({ row, slot, layerIdx: 0, layerTotal: 0 });
        });
        // Worn section is the big one — render with region subheadings so a
        // long list doesn't read as one undifferentiated wall.
        const wornGroupedHtml =
          REGIONS.map((r) => {
            const rows = wornByRegion.get(r.key) || [];
            if (!rows.length) return "";
            return `<li class="bh-digest-group">
                <h5 class="bh-digest-subhead">${escapeHtml(r.label)}</h5>
                <ul class="bh-digest-group-list">${rows.map(digestRow).join("")}</ul>
            </li>`;
          }).join("") +
          (wornByRegion.get("other").length
            ? `<li class="bh-digest-group">
                <h5 class="bh-digest-subhead">Other</h5>
                <ul class="bh-digest-group-list">${wornByRegion.get("other").map(digestRow).join("")}</ul>
            </li>`
            : "");
        const flagItems = [];
        for (const s of missingSlots)
          flagItems.push(
            `<li class="bh-digest-row bh-digest-row-flag">
                <span class="bh-digest-flag bh-digest-flag-missing">missing</span>
                ${slotTag(s, 0, 0)}
            </li>`,
          );
        for (const s of bareSlots)
          flagItems.push(
            `<li class="bh-digest-row bh-digest-row-flag">
                <span class="bh-digest-flag bh-digest-flag-bare">bare</span>
                ${slotTag(s, 0, 0)}
            </li>`,
          );
        const wornSectionHtml = wornTotalCount
          ? `<section class="bh-digest-section bh-digest-section-worn" data-section="worn">
                <h4 class="bh-digest-heading">Worn<span class="bh-digest-count">${wornTotalCount}</span></h4>
                <ul class="bh-digest-list bh-digest-list-grouped">${wornGroupedHtml}</ul>
            </section>`
          : "";
        const toolbar = `<div class="bh-digest-toolbar">
            <button class="bh-digest-edit"><i class="fa-solid fa-pen"></i> Edit slots</button>
            <div class="bh-layout-switch-row">${layoutSwitchHtml()}</div>
        </div>`;
        return `<div class="bh-digest">
            ${toolbar}
            ${section("wounds", "Wounds", wounds.length, woundItems)}
            ${section("held", "Held", held.length, heldItems)}
            ${wornSectionHtml}
            ${section("state", "State", flagItems.length, flagItems)}
        </div>`;
      })();

  const gridClass = paired ? "bh-doll-grid bh-paired" : "bh-doll-grid";
  const figureStyle = figureSpan ? ` style="${figureSpan}"` : "";
  return `<section class="bh-char-doll" data-char="${escapeHtml(name)}">
        <header class="bh-char-head">
            <span class="bh-char-name">${escapeHtml(name)}</span>
            ${speciesTag}
        </header>
        ${
          isEmpty && !placeholder
            ? `<div class="bh-doll-empty">
                ${silhouetteSvg(perSlot, view, [], family)}
                <p class="bh-empty-text">No tracked state.</p>
            </div>`
            : `<div class="${gridClass}">
                <div class="bh-col bh-col-left">${leftCol}</div>
                <div class="bh-figure"${figureStyle}>
                    ${silhouetteSvg(perSlot, view, holding, family)}
                    <div class="bh-figure-controls">
                        <button class="bh-view-toggle ${view === "back" ? "bh-view-back" : ""}" data-char="${escapeHtml(name)}" data-view="${view}" title="Switch to ${view === "back" ? "front" : "back"} view (for back wounds)">
                            <span class="bh-view-front-label ${view === "front" ? "bh-view-active" : ""}">Front</span>
                            <span class="bh-view-sep">⇄</span>
                            <span class="bh-view-back-label ${view === "back" ? "bh-view-active" : ""}">Back</span>
                        </button>
                    </div>
                    <div class="bh-pov-hint" title="${view === "back" ? "Back view — figure faces away. Your left = character's left." : "Front view — figure faces you. Your left = character's right."}">
                        ${
                          view === "back"
                            ? '<span>L</span><span class="bh-pov-axis">·</span><span>R</span>'
                            : '<span>R</span><span class="bh-pov-axis">·</span><span>L</span>'
                        }
                    </div>
                    ${layoutSwitchHtml()}
                </div>
                <div class="bh-col bh-col-right">${rightCol}</div>
            </div>${digestHtml}`
        }
    </section>`;
}

/**
 * Render character tabs + the active character's doll. State is the full
 * multi-character state object: { name1: charState1, name2: charState2, ... }.
 *
 * `updatedNames` is a Set of character names that changed since last render
 * but the user hasn't yet viewed (i.e., they're not the active tab). Those
 * tabs get an accent dot so testers know other characters' state evolved
 * even while a different tab is foregrounded. CRITICAL for multi-char RP —
 * without this, users assume Beholder only tracks the visible character.
 *
 * Returns { html, activeName }. The caller is responsible for wiring tab
 * clicks; this renderer is pure.
 */
function renderDollPanel(state, activeName, updatedNames, view) {
  const updated = updatedNames || new Set();
  view = view === "back" ? "back" : "front";
  const names = Object.keys(state || {});
  if (!names.length) {
    // No tracked state yet: render a full-size default-human placeholder
    // (visual only) so the panel shows at its real size immediately rather
    // than collapsing to a chip. `placeholder: true` forces the full grid
    // (empty flanking columns + silhouette) instead of the silhouette-only
    // empty view; the muted name + caption + hidden view controls are styled
    // via [data-empty] in style.css. The first AI message / "Build from
    // history" replaces this with real state.
    const doll = renderCharacterDoll("—", {}, view, { placeholder: true });
    return {
      html: `${doll}<p class="bh-placeholder-note">Showing a <b>default human</b> — nothing's tracked yet. It fills in as the scene plays out.</p>`,
      activeName: null,
    };
  }
  // Pick active: requested name if present, else first PRESENT char (an
  // off-screen char shouldn't become active by default), else fall back to
  // first listed.
  const presentNames = names.filter((n) => state[n]?.present !== false);
  const active = activeName && names.includes(activeName) ? activeName : presentNames[0] || names[0];

  const tabs =
    names.length > 1
      ? `<nav class="bh-tabs" aria-label="${escapeHtml(names.length)} characters tracked">
            ${names
              .map((n) => {
                // A char with `present: false` is tracked but off-screen.
                // Tab stays visible (clickable, last-known state preserved)
                // but renders dimmed/italic so a reader can tell at a glance
                // who's in the scene right now versus who's just on the roster.
                const absent = state[n]?.present === false;
                const classes = [
                  "bh-tab",
                  n === active ? "bh-tab-active" : "",
                  updated.has(n) && n !== active ? "bh-tab-updated" : "",
                  absent ? "bh-tab-absent" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const label =
                  updated.has(n) && n !== active
                    ? `${escapeHtml(n)} <span class="bh-tab-pulse" aria-label="updated">●</span>`
                    : escapeHtml(n);
                return `<button class="${classes}" data-char="${escapeHtml(n)}" aria-label="${escapeHtml(n)}${absent ? " (not in scene)" : ""}">${label}</button>`;
              })
              .join("")}
        </nav>`
      : "";

  const doll = renderCharacterDoll(active, state[active] || {}, view);

  return {
    html: `${tabs}<div class="bh-doll-host">${doll}</div>`,
    activeName: active,
  };
}
