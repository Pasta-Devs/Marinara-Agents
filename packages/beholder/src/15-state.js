// ── State helpers used by the renderer ───────────────────────────────────────
// Ported from the Beholder extension's state module, reduced to the two helpers
// the paper doll actually calls. The extension's module also carries the delta
// merge engine (applyDelta, lock handling, alias resolution); none of it belongs
// here, because in Marinara the server merges each extraction into chat state and
// this client only draws the result. Dropping it keeps the bundle to what runs
// and leaves no unused path handling untrusted model output.

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
