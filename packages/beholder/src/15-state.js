// Beholder state-merge logic — the contract:
//   * Field present with value: REPLACE
//   * Field present with `[]` (empty list) or `""` (empty string): CLEAR (remove)
//   * Field absent: UNCHANGED
//
// Mirrors the server-side delta-apply semantics, including the default-human
// species carve-out. Keep this behavior stable so round-trip parity holds.

/**
 * Canonical garment identity: fold a plural surface onto its singular ("boots" →
 * "boot") so the seed's "boot" and the model's "boots" are ONE identity instead of
 * two that stack forever (GROUND 3a). Table is generated offline from the coverage
 * map (datagen scripts/dump_garment_canon.py) and vendored in garment_data.js.
 */
function canonicalGarment(item) {
  if (typeof item !== "string") return "";
  const n = item.trim().toLowerCase();
  return GARMENT_CANON[n] ?? n;
}

/**
 * v2 output wrapper: `{"changed": bool, "delta": <obj>}`. Returns the inner delta
 * (or `{}` for changed=false). Pass-through if not a v2 wrapper.
 */
function unwrapV2(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (!("changed" in obj)) return obj;
  if (!obj.changed) return {};
  const d = obj.delta;
  return d && typeof d === "object" ? d : {};
}

// ── Default-human species carve-out (G1: two-set semantics) ──
// "human is the absence of species." A delta that merely (re)asserts a default-human
// species carries no tracked info and is stripped at apply time. Two disjoint sub-sets
// decide how a default-human emission interacts with a REAL non-human prev:
//   • REVEAL set {human, humans, person, people} — an explicit HUMANITY ASSERTION.
//     These MAY overwrite a non-human prev (the disguise/anomaly → human reveal), so
//     they strip only when prev is absent/human.
//   • REDUNDANT set (bare gender/age nouns: man/woman/boy/girl/lady/…) — ALWAYS
//     stripped regardless of prev. "the woman turned" must never clobber a kitsune
//     prev; a genuine gender-noun transformation is the MODEL's job to emit as an
//     explicit species, not something the merge layer infers from a bare noun.
// Creature-overloaded age words (elder/kid/baby/gal) are deliberately EXCLUDED.
// Keep both sets + the predicate in sync with the server-side semantics (shared/species.py).
const SPECIES_REVEAL_HUMAN = new Set(["human", "humans", "person", "people"]);
const SPECIES_REDUNDANT_HUMAN = new Set([
  "man",
  "men",
  "woman",
  "women",
  "boy",
  "girl",
  "guy",
  "lady",
  "gentleman",
  "child",
  "adult",
  "teenager",
  "teen",
  "toddler",
  "infant",
]);
const HUMAN_DEFAULT_SPECIES = new Set([...SPECIES_REVEAL_HUMAN, ...SPECIES_REDUNDANT_HUMAN]);

function isDefaultHuman(species) {
  if (typeof species !== "string") return species == null; // null/undefined → default
  const s = species.trim().toLowerCase();
  return s === "" || HUMAN_DEFAULT_SPECIES.has(s);
}

function shouldStripHumanSpecies(newSpecies, prevSpecies) {
  const n = typeof newSpecies === "string" ? newSpecies.trim().toLowerCase() : newSpecies == null ? "" : null;
  if (n === null) return false; // a non-string, non-null value: leave it
  if (SPECIES_REDUNDANT_HUMAN.has(n)) return true; // bare gender/age noun: always redundant
  if (n === "" || SPECIES_REVEAL_HUMAN.has(n)) {
    // humanity assertion (or empty default)
    return isDefaultHuman(prevSpecies); // strip unless prev is a real non-human (reveal)
  }
  return false; // a real non-human species is never stripped
}

// Beholder's UI surfaces color, not material — but the trained extractor schema
// also emits `material` (silver/gold/wool), which would otherwise land in state
// invisibly (a "silver" necklace filed as material:silver shows nothing). Fold
// material into color wherever items enter state: a stated color wins when both
// are present, otherwise the material becomes the color; then drop material.
function foldMaterialIntoColor(item) {
  if (!item || typeof item !== "object" || Array.isArray(item) || !("material" in item)) return item;
  const { material, ...rest } = item;
  if (material && !rest.color) rest.color = material;
  return rest;
}

/** Fold material→color across a slot field's item(s): the `worn` list / `holding` object. */
function foldSlotFieldMaterials(field, value) {
  if (field === "worn" && Array.isArray(value)) return value.map(foldMaterialIntoColor);
  if (field === "holding" && value && typeof value === "object" && !Array.isArray(value)) {
    return foldMaterialIntoColor(value);
  }
  return value;
}

// ── worn merge-by-identity + worn_remove (schema v0.5 contract) ──
// The extractor gold is DELTA, not snapshot: a change emits only the *changed*
// garment on a slot. The old REPLACE-if-present merge therefore wiped co-located
// garments (a "blazer damaged" delta on the arms deleted the blouse and the
// blazer's own navy). v0.5 flips `worn` to MERGE BY GARMENT IDENTITY (the `item`
// name; color/damage live in their own fields and never affect identity) and adds
// `worn_remove` as the per-garment takeoff primitive. `worn: []` still clears the
// WHOLE stack. holding stays single-object replace.
//
// PARITY NOTE: this deliberately diverges from the datagen `apply_state.py`
// (still REPLACE on v0.4 gold) — it is the extension half of the coordinated
// worn-merge change (datagen/docs/planning/WORN_MERGE_CONTRACT.md). Safe against
// current gold because that gold is already delta: co-located garments survive.

/** Garment identity: the `item` name, compared by CANONICAL (plural→singular) form,
 *  so "boot" and "boots" are the same garment and update in place instead of stacking. */
function sameGarment(a, b) {
  return typeof a === "string" && typeof b === "string" && canonicalGarment(a) === canonicalGarment(b);
}

/**
 * Merge an incoming `worn` list into the existing stack BY GARMENT IDENTITY. A
 * garment already present is updated IN PLACE (incoming fields win; fields it
 * doesn't re-emit — e.g. a previously-revealed color — are KEPT), so "blazer
 * damaged" updates the damage without dropping the navy or the co-located blouse.
 * An unseen garment is appended; existing garments the delta omits are kept.
 * Material→color is folded on the way in. Returns a NEW array (no mutation).
 */
function mergeWorn(existing, incoming) {
  const out = Array.isArray(existing) ? existing.map((w) => ({ ...w })) : [];
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const inc = foldMaterialIntoColor(raw);
    if (!inc || typeof inc !== "object" || Array.isArray(inc)) continue;
    const i = typeof inc.item === "string" ? out.findIndex((w) => sameGarment(w.item, inc.item)) : -1;
    // MERGE-PRESERVE-SURFACE: on a canonical match, keep the FIRST-SEEN surface
    // so the doll label doesn't flicker between "boot" and "boots".
    if (i >= 0) out[i] = { ...out[i], ...inc, item: out[i].item };
    else out.push(inc);
  }
  return out;
}

/**
 * Subtract named garments from a worn stack by identity — the v0.5 `worn_remove`
 * primitive. `names` is a list of item-name strings (a `{item}` object is also
 * tolerated). Unmatched names are ignored. Returns a NEW array (no mutation).
 */
function removeWorn(existing, names) {
  if (!Array.isArray(existing)) return [];
  const drop = new Set();
  for (const n of Array.isArray(names) ? names : []) {
    const s = typeof n === "string" ? n : n && typeof n.item === "string" ? n.item : null;
    // Canonicalize the drop set so worn_remove:["boots"] clears a stored "boot".
    if (s) drop.add(canonicalGarment(s));
  }
  return existing
    .filter((w) => !(drop.size && w && typeof w.item === "string" && drop.has(canonicalGarment(w.item))))
    .map((w) => ({ ...w }));
}

// ── wounds merge-by-identity (parity with the worn merge above) ──
// Wounds are a DELTA too: a turn emits only the freshly-evident injury, so the
// old REPLACE wiped co-located wounds — a "broken nose" delta on the head
// deleted the fractured skull already there. Like `worn`, `wounds` now MERGES BY
// INJURY IDENTITY (the `text`), updating a known wound in place (a worsening
// severity / new bleeding win) and appending an unseen one. `wounds: []` still
// clears the WHOLE slot (handled by the empty-array sentinel in applyCharDelta).
// Distinct-wound healing (drop ONE of several) awaits a `wounds_remove` primitive
// + retrain — the same deferred gap as worn partial-takeoff; until then the model
// clears a slot wholesale with `wounds: []` and the editor removes wounds by hand.

/** Wound identity: the injury `text`, compared case-insensitively (trimmed). */
function sameWound(a, b) {
  return typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Merge an incoming `wounds` list into the existing list BY INJURY IDENTITY (the
 * `text`). A wound already present is updated IN PLACE (incoming fields —
 * severity, bleeding — win; the first-seen text surface is kept so the doll label
 * doesn't flicker), an unseen wound is appended, and existing wounds the delta
 * omits are kept. Mirrors mergeWorn. Returns a NEW array (no mutation).
 */
function mergeWounds(existing, incoming) {
  const out = Array.isArray(existing) ? existing.map((w) => ({ ...w })) : [];
  for (const inc of Array.isArray(incoming) ? incoming : []) {
    if (!inc || typeof inc !== "object" || Array.isArray(inc)) continue;
    const i = typeof inc.text === "string" ? out.findIndex((w) => sameWound(w.text, inc.text)) : -1;
    if (i >= 0) out[i] = { ...out[i], ...inc, text: out[i].text };
    else out.push(inc);
  }
  return out;
}

// ── D30: anatomical dependency cascade ──
// A missing limb implies its dependents are also missing: shoulder → arm → hand,
// leg → foot, hind_leg → hind_foot. Limbs ONLY — a missing face does NOT imply
// missing eyes (deliberately excluded). This is a DERIVED overlay applied where
// state is consumed (display + prompt injection), never persisted — so restoring
// the limb restores the dependents automatically. Mirrors the datagen D30 axis.
const MISSING_DEPENDENTS = {
  left_shoulder: ["left_arm"],
  right_shoulder: ["right_arm"],
  left_arm: ["left_hand"],
  right_arm: ["right_hand"],
  left_leg: ["left_foot"],
  right_leg: ["right_foot"],
  hind_left_leg: ["hind_left_foot"],
  hind_right_leg: ["hind_right_foot"],
};

/**
 * Return a shallow-cloned `body` with dependent slots marked `missing: true` when
 * their parent limb is missing, applied transitively (shoulder → arm → hand). The
 * input is not mutated. Pass a character's `body` object.
 */
function withDependentMissing(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const out = { ...body };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [parent, children] of Object.entries(MISSING_DEPENDENTS)) {
      if (out[parent]?.missing !== true) continue;
      for (const child of children) {
        if (out[child]?.missing === true) continue;
        out[child] = { ...(out[child] || {}), missing: true };
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Apply a single character's delta into a single character's state. Recurses
 * through `body.<slot>.<field>` and handles the "clear sentinel" cases for
 * `worn`, `wounds`, `holding`.
 *
 * Mutates `state` in place and also returns it for convenience.
 */
function applyCharDelta(state, delta) {
  for (const [key, val] of Object.entries(delta)) {
    if (key === "body") {
      // `body` must be a plain object map of slot → slotDelta. A null,
      // array, or scalar `body` is malformed — skip it rather than letting
      // it fall through and be written as a top-level scalar field.
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      if (!state.body) state.body = {};
      for (const [slot, slotDelta] of Object.entries(val)) {
        if (!slotDelta || typeof slotDelta !== "object") continue;
        if (!state.body[slot]) state.body[slot] = {};
        const slotState = state.body[slot];
        for (const [sf, sv] of Object.entries(slotDelta)) {
          // `worn_remove` is a subtractive primitive — applied after the
          // adds below so an explicit takeoff in the same delta wins.
          if (sf === "worn_remove") continue;
          // Clear sentinels:
          //   []   — lists (worn, wounds); on `worn` this clears the WHOLE stack
          //   ""   — legacy v0.2 string holding
          //   {}   — v0.3+ object holding (and a defensive catch for any
          //          slot field downgraded to an empty object)
          const isEmptyArray = Array.isArray(sv) && sv.length === 0;
          const isEmptyString = sv === "";
          const isEmptyObject =
            sv !== null && typeof sv === "object" && !Array.isArray(sv) && Object.keys(sv).length === 0;
          if (isEmptyArray || isEmptyString || isEmptyObject) {
            delete slotState[sf];
          } else if (sf === "worn") {
            // MERGE BY IDENTITY (v0.5): a worn delta ADDS/updates the
            // named garment(s) and keeps co-located ones — no wipe.
            slotState.worn = mergeWorn(slotState.worn, sv);
          } else if (sf === "wounds") {
            // MERGE BY IDENTITY: a wounds delta ADDS/updates the named
            // injury and keeps co-located ones (skull + nose coexist).
            slotState.wounds = mergeWounds(slotState.wounds, sv);
          } else {
            slotState[sf] = foldSlotFieldMaterials(sf, sv);
          }
        }
        // `worn_remove: ["<item>"]` — subtract by identity, after the adds.
        if ("worn_remove" in slotDelta) {
          slotState.worn = removeWorn(slotState.worn, slotDelta.worn_remove);
        }
        // A slot can't be BOTH bare and clothed. Reconcile toward what THIS delta just
        // asserted (the fresh signal): a `bare:true` this turn drops the worn stack (naked
        // now); a garment ADDED this turn drops a stale `bare` (dressed now). Untouched
        // slots are left alone — only a fresh assertion resolves the contradiction.
        if (slotDelta.bare === true) {
          slotState.worn = [];
        } else if (Array.isArray(slotDelta.worn) && slotDelta.worn.length > 0 && slotState.bare === true) {
          delete slotState.bare;
        }
        // Drop an emptied worn stack, then an emptied slot (parity with
        // the server-side "empty slot is removed" semantics).
        if (Array.isArray(slotState.worn) && slotState.worn.length === 0) {
          delete slotState.worn;
        }
        if (Object.keys(slotState).length === 0) {
          delete state.body[slot];
        }
      }
      // If body is now empty, drop it
      if (Object.keys(state.body).length === 0) {
        delete state.body;
      }
    } else {
      // Top-level scalar field on the character (species, etc.).
      // Default-human carve-out: drop a redundant species:"human"/"man"/…
      // emission (but keep a real non-human → human reveal). Parity with the server-side semantics.
      if (key === "species" && shouldStripHumanSpecies(val, state.species)) {
        continue;
      }
      // Empty-string sentinel clears, otherwise replace.
      if (val === "") {
        delete state[key];
      } else {
        state[key] = val;
      }
    }
  }
  return state;
}

/**
 * Apply a multi-character delta to the running state. Returns a NEW state object
 * (does not mutate the input — important because SillyTavern's chat_metadata
 * persistence is observed for changes).
 *
 * @param {object} prevState - per-character running state, e.g. {"self": {...}, "Mara": {...}}
 * @param {object} delta - same shape as prevState; fields present here MUTATE prevState
 *                          per the worn/wounds/holding clear-sentinel contract.
 *                          Accepts v2-wrapper format {"changed": bool, "delta": obj}.
 * @returns {object} new state
 */
function applyDelta(prevState, delta) {
  // Unwrap v2 if needed
  delta = unwrapV2(delta);
  // Deep clone prev (JSON-safe — our state is pure JSON)
  const next = JSON.parse(JSON.stringify(prevState || {}));
  if (!delta || Object.keys(delta).length === 0) return next;
  for (const [char, charDelta] of Object.entries(delta)) {
    if (!charDelta || typeof charDelta !== "object") continue;
    if (!next[char]) next[char] = {};
    applyCharDelta(next[char], charDelta);
    // Drop characters that became empty after delta (unlikely but possible)
    if (Object.keys(next[char]).length === 0) {
      delete next[char];
    }
  }
  return next;
}

/**
 * Collapse every character key in a (card-seed) delta onto one target character.
 *
 * A character/persona card is read through the extractor, which routinely keys
 * the described traits under `self` or a phantom name (e.g. "Mara") from a
 * 3rd-person bio — those all belong to the ONE character the card describes, so
 * we fold them onto `name`.
 *
 * `exclude` is the SEED CROSS-ATTRIBUTION GUARD: any key it lists is dropped
 * rather than folded. A character card that also describes {{user}} — e.g.
 * "{{user}}. An ancient djinn." — makes the extractor correctly key that trait
 * under `self`/the persona name; without the guard the fold would plant the
 * persona's species/clothes on the character's doll. Those keys are the OTHER
 * card's own seed pass, so the char fold excludes [personaName, 'self'] and the
 * persona fold excludes [charName]. Names match case-insensitively.
 */
function foldDeltaToChar(delta, name, exclude) {
  if (!delta || typeof delta !== "object") return {};
  const skip = new Set([...(exclude || [])].filter(Boolean).map((s) => String(s).toLowerCase()));
  let acc = {};
  for (const k of Object.keys(delta)) {
    if (skip.has(k.toLowerCase())) continue;
    if (delta[k] && typeof delta[k] === "object") {
      acc = applyDelta(acc, { [name]: delta[k] });
    }
  }
  return acc;
}

/**
 * Rename a top-level character key in a state object. Used to map between the
 * extractor's `self` placeholder and the actual persona name at the API boundary.
 *
 * If `from` doesn't exist in the state, returns state unchanged.
 *
 * Example:
 *   renameChar({Tim: {...}, Mara: {...}}, 'Tim', 'self')
 *     -> {self: {...}, Mara: {...}}
 */
function renameChar(state, from, to) {
  if (!state || !(from in state) || from === to) return state;
  const next = {};
  for (const [k, v] of Object.entries(state)) {
    next[k === from ? to : k] = v;
  }
  return next;
}

// ── Character override layer: aliases / hidden / order ───────────────────────
// A second client-side override layer (alongside locks): the user reconciles the
// model's character keys to what THEY want to see. Aliases collapse name variants
// (Katya / Yekaterina Sokolova → Yekaterina) so one person isn't tracked as three;
// hidden drops NPCs from the view; order pins the persona first + honors drags.
// All three are PURE here; persistence (chat_metadata + global settings) lives in
// index.js, same split as the locks layer. None of this touches the parity-locked
// applyDelta — it transforms the delta/state keys around it, like renameChar does.

/**
 * Build a flat, lowercased { variant -> canonical } lookup from one or more
 * GROUPED alias books ({ canonicalName: [variant, ...] }). Later books win on
 * conflict, so callers pass global first, per-chat last (per-chat overrides
 * global). Each canonical maps to itself so an already-canonical key is stable.
 */
function buildAliasLookup(...books) {
  const map = {};
  for (const book of books) {
    if (!book || typeof book !== "object") continue;
    for (const [canonical, variants] of Object.entries(book)) {
      if (!canonical) continue;
      map[canonical.trim().toLowerCase()] = canonical; // canonical → itself
      for (const v of Array.isArray(variants) ? variants : []) {
        if (v && String(v).trim()) map[String(v).trim().toLowerCase()] = canonical;
      }
    }
  }
  return map;
}

/**
 * Rewrite every top-level character key in a state/delta object through an alias
 * lookup (from buildAliasLookup), collapsing variant spellings of one character
 * into a single canonical key. When two keys collapse onto the same canonical,
 * their sub-states are deep-merged (applyDelta semantics). Returns the SAME object
 * reference when nothing changed (cheap no-op for the common all-canonical case).
 *
 *   resolveAliases({ Katya:{...}, "Yekaterina Sokolova":{...}, Mara:{...} },
 *                  { katya:"Yekaterina", "yekaterina sokolova":"Yekaterina" })
 *     -> { Yekaterina: {<merged>}, Mara: {...} }
 */
function resolveAliases(obj, lookup) {
  if (!obj || typeof obj !== "object" || !lookup) return obj;
  const keys = Object.keys(obj);
  if (keys.length === 0) return obj;
  let changed = false;
  const out = {};
  for (const k of keys) {
    const canonical = lookup[k.trim().toLowerCase()] || k;
    if (canonical !== k) changed = true;
    if (Object.prototype.hasOwnProperty.call(out, canonical)) {
      // Two variants collapsed onto one canonical → deep-merge their states.
      out[canonical] = applyDelta({ x: out[canonical] }, { x: obj[k] }).x;
      changed = true;
    } else {
      out[canonical] = obj[k];
    }
  }
  return changed ? out : obj;
}

/**
 * Drop hidden character keys from a state/delta object. Returns the SAME object
 * reference when nothing is hidden. Used both to keep hidden NPCs out of the view
 * and to drop their incoming deltas so they don't get re-added every turn.
 */
function dropHidden(obj, hidden) {
  if (!obj || typeof obj !== "object") return obj;
  const h = hidden instanceof Set ? hidden : new Set(Array.isArray(hidden) ? hidden : []);
  if (h.size === 0) return obj;
  const keys = Object.keys(obj);
  if (!keys.some((k) => h.has(k))) return obj;
  const out = {};
  for (const k of keys) if (!h.has(k)) out[k] = obj[k];
  return out;
}

/**
 * Order character names for display: honor an explicit saved order first (only
 * names still present), then append the rest with the persona pinned ahead of
 * other newcomers. With no saved order this is persona-first by default; once the
 * user drags, the saved order (which records the persona's chosen slot) is honored
 * exactly. `self` is treated as the persona. Stable for same-class names.
 */
function orderChars(names, order, personaName) {
  const present = new Set(names);
  const seen = new Set();
  const result = [];
  for (const n of Array.isArray(order) ? order : []) {
    if (present.has(n) && !seen.has(n)) {
      result.push(n);
      seen.add(n);
    }
  }
  const isPersona = (n) => n === personaName || n === "self";
  const rest = names.filter((n) => !seen.has(n));
  rest.sort((a, b) => (isPersona(a) ? 0 : 1) - (isPersona(b) ? 0 : 1));
  for (const n of rest) result.push(n);
  return result;
}

// ── User overrides & per-slot locks ─────────────────────────────────────────
// User edits and locks are a client-side override layer that sits on top of the
// model's deltas. They are NOT part of the server-side delta-apply parity
// invariant above; they're the local "your value wins" primitives:
//   * A user edit writes a slot directly (and takes priority over the model).
//   * A locked slot is stripped out of any incoming MODEL delta before merge, so
//     the model can never overwrite a value the user has pinned.
//
// A lock is identified by a single string key derived from (char, slot). The
// key is built with JSON.stringify([char, slot]) so a char name containing '/'
// (or any other delimiter) can never collide with a different (char, slot) pair.
// The lock store is accepted as either an Array or a Set (the UI may hold a Set
// in memory; persistence uses a JSON-serializable Array) — predicates normalize
// both. All key construction MUST route through this helper so the display layer
// and the store agree; otherwise locks silently fail to match.

const lockKey = (char, slot) => JSON.stringify([char, slot]);

function lockSet(locks) {
  if (locks instanceof Set) return locks;
  return new Set(Array.isArray(locks) ? locks : []);
}

/**
 * Apply a single user slot edit, returning a NEW state (does not mutate input —
 * same immutability contract as applyDelta, since chat_metadata persistence is
 * observed for changes).
 *
 * `slotState` is the full desired slot object (e.g. {worn:[...], wounds:[...]}).
 * An empty/falsy slotState clears the slot, cascading the same way a model clear
 * does: empty slot → drop slot → empty body → drop body → empty char → drop char.
 *
 * @param {object} prevState - per-character running state
 * @param {string} char - character key (e.g. "self" or "Mara")
 * @param {string} slot - body slot key (e.g. "chest")
 * @param {object} slotState - the slot's full new value, or empty/falsy to clear
 * @returns {object} new state
 */
function applyUserEdit(prevState, char, slot, slotState) {
  const next = JSON.parse(JSON.stringify(prevState || {}));
  const hasValue = slotState && typeof slotState === "object" && Object.keys(slotState).length > 0;
  if (hasValue) {
    if (!next[char]) next[char] = {};
    if (!next[char].body) next[char].body = {};
    // Fold material→color on the way in, same as a model delta (directives +
    // the slot editor land here), so a "silver" necklace shows its color.
    const folded = {};
    for (const [f, v] of Object.entries(slotState)) folded[f] = foldSlotFieldMaterials(f, v);
    next[char].body[slot] = folded;
  } else {
    // Clear cascade: drop the slot, then any now-empty body / char.
    if (next[char] && next[char].body) {
      delete next[char].body[slot];
      if (Object.keys(next[char].body).length === 0) {
        delete next[char].body;
      }
    }
    if (next[char] && Object.keys(next[char]).length === 0) {
      delete next[char];
    }
  }
  return next;
}

/**
 * Carry manual editor edits across a state REPLAY. Manual edits live only in the
 * running state (never recorded as a per-message delta), so a bare replay of the
 * model deltas would drop them. For each user-edited (char, slot) key, overlay the
 * CURRENT value onto the replayed `base`.
 *
 * TOMBSTONE: when the user EMPTIED a slot (removed the held item / stripped it),
 * the slot is absent from `current`. A naive "skip if undefined" would let the
 * replay resurrect it from the stored pickup delta (the "scimitars keep coming
 * back" bug). Instead, an absent current value is an explicit removal — DELETE the
 * slot from the base too, cascading away an emptied body / character. A later
 * genuine model delta re-populates `current`, so the slot is not stuck empty.
 *
 * Keys are lockKey(char, slot) = JSON.stringify([char, slot]). Returns a NEW state
 * (does not mutate `base`).
 */
function graftUserEdits(base, current, editedKeys) {
  if (!Array.isArray(editedKeys) || !editedKeys.length) return base;
  const out = JSON.parse(JSON.stringify(base || {}));
  for (const key of editedKeys) {
    let char, slot;
    try {
      [char, slot] = JSON.parse(key);
    } catch {
      continue;
    }
    const cur = current?.[char]?.body?.[slot];
    if (cur === undefined) {
      // User emptied this slot — honor the removal against the replayed base.
      if (out[char]?.body && slot in out[char].body) {
        delete out[char].body[slot];
        if (Object.keys(out[char].body).length === 0) delete out[char].body;
        if (Object.keys(out[char]).length === 0) delete out[char];
      }
      continue;
    }
    out[char] = out[char] || {};
    out[char].body = out[char].body || {};
    out[char].body[slot] = JSON.parse(JSON.stringify(cur));
  }
  return out;
}

/** Is the (char, slot) lock present in the store? `locks` may be an Array or Set. */
function isSlotLocked(locks, char, slot) {
  return lockSet(locks).has(lockKey(char, slot));
}

/**
 * Add or remove a (char, slot) lock. Returns a NEW Array (JSON-serializable
 * for persistence); does not mutate the input store.
 */
function setSlotLock(locks, char, slot, on) {
  const set = new Set(lockSet(locks));
  if (on) set.add(lockKey(char, slot));
  else set.delete(lockKey(char, slot));
  return Array.from(set);
}

/**
 * Strip locked body slots out of a MODEL delta before it is merged, so the model
 * cannot write a slot the user has locked. Unwraps a v2 wrapper first, then drops
 * each `body.<slot>` whose (char, slot) is locked, cascading away any
 * emptied body / character. Does NOT mutate the input delta.
 *
 * Only model deltas should be filtered — user edits intentionally bypass locks.
 *
 * @param {object} delta - a model delta (accepts the v2 wrapper form)
 * @param {Array|Set} locks - lock store of (char, slot) keys
 * @returns {object} the filtered delta
 */
function filterLockedFromDelta(delta, locks) {
  const inner = unwrapV2(delta);
  const set = lockSet(locks);
  if (!inner || typeof inner !== "object" || Array.isArray(inner) || set.size === 0) {
    // Nothing to filter — a malformed/array delta or an empty lock set. An
    // array would be mangled by the Object.entries loop below, so bail to {}
    // in that case; otherwise return a clone of the unwrapped delta for safety.
    return Array.isArray(inner) ? {} : JSON.parse(JSON.stringify(inner || {}));
  }
  const out = JSON.parse(JSON.stringify(inner));
  for (const [char, charDelta] of Object.entries(out)) {
    if (!charDelta || typeof charDelta !== "object") continue;
    const body = charDelta.body;
    if (body && typeof body === "object") {
      for (const slot of Object.keys(body)) {
        if (set.has(lockKey(char, slot))) {
          delete body[slot];
        }
      }
      if (Object.keys(body).length === 0) {
        delete charDelta.body;
      }
    }
    if (Object.keys(charDelta).length === 0) {
      delete out[char];
    }
  }
  return out;
}
