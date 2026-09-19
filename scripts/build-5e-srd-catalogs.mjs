// Turn Open5e's `srd-2014` fixtures into the ruleset catalogs the
// `ruleset-5e-2014` package ships: a spell catalog, a class-feature catalog and
// an inline weapon catalog.
//
// Run it as:
//
//   node scripts/build-5e-srd-catalogs.mjs --source <dir>
//
// where <dir> holds the Django fixtures from open5e/open5e-api, path
// `data/v2/wizards-of-the-coast/srd-2014`, plus the `SOURCE_COMMIT` file naming
// the commit they were taken at. Those fixtures are NOT committed here: this
// script and its output are, and the commit is recorded in every generated
// file, in the package README and in LICENSE-SRD.md.
//
// Rules this converter holds itself to:
//
// - SRD 5.1 only. Every record whose `document` is not `srd-2014` is dropped.
// - Never invent a rules number. Where the source is ambiguous the optional
//   field is left out, and where a record cannot be mapped at all the run
//   fails rather than guessing.
// - Deterministic. Entries are sorted by id, nothing reads the clock, and the
//   output is formatted with the repository's own Prettier settings so a
//   rebuild that changes nothing leaves the tree byte-identical.
//
// The two places a number is typed by hand are COUNTERS and HEALING_SPELLS
// below, where the SRD states something no fixture field carries. Each row
// cites the SRD sentence it came from, every counter a class-table column also
// carries has its whole step table BUILT from that column, a hand-typed step
// table has its levels cross-checked against the ones the source marks the
// feature at, and every healing pk is checked against the source, so a typo
// cannot survive a rebuild.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { assertRulesetBattle, assertRulesetCatalogs, assertRulesetScaled } from "./ruleset-package-checks.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/ruleset-5e-2014");

const SOURCE_DOCUMENT = "srd-2014";
const SOURCE_REPOSITORY = "https://github.com/open5e/open5e-api";
const SOURCE_PATH = "data/v2/wizards-of-the-coast/srd-2014";

// The ruleset's own ids. Nothing here is Engine vocabulary: these are the list,
// column, field, save and pool ids that packages/ruleset-5e-2014/ruleset.json
// declares, and assertRulesetCatalogs re-checks every one of them.
const SPELL_LIST = "spells";
const FEATURE_LIST = "features";
const COUNTER_LIST = "counters";
const ATTACK_LIST = "attacks";
const DISTANCE_UNITS = { distance: { label: "ft", perCell: 5 } };

// Sheet column ceilings, mirrored here so the converter trims to fit instead of
// emitting a row the sheet would refuse. assertRulesetCatalogs is the check;
// these are the budgets the text is built to.
const SPELL_NOTES_MAX = 300;
const FEATURE_TEXT_MAX = 800;
const SUMMARY_MAX = 300;
const TRUNCATION_NOTE = "See the SRD for the full text.";

const ABILITY_BY_SOURCE_NAME = Object.freeze({
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
});

// Plain words for the fixture's casting-time tokens. An unknown token fails the
// run rather than reaching a player as a raw slug.
const CASTING_TIMES = Object.freeze({
  action: "action",
  "bonus-action": "bonus action",
  reaction: "reaction",
  "1minute": "1 minute",
  "10minutes": "10 minutes",
  "1hour": "1 hour",
  "8hours": "8 hours",
  "12hours": "12 hours",
  "24hours": "24 hours",
});

// The catalog's area shapes are a closed set the later combat bridge has to
// read. A sphere, a cylinder and a cube are all "everything within a size of a
// point" to it; anything else is left out rather than forced into the set.
const AREA_SHAPES = Object.freeze({ sphere: "burst", cylinder: "burst", cube: "burst", cone: "cone", line: "line" });

// The SRD 5.1 weapons table splits its rows into melee and ranged, but the
// fixture carries no flag for it: a thrown melee weapon and a ranged weapon
// both just have a range. These are the nine rows under "Ranged Weapons",
// keyed by fixture pk so a rename fails the run. assertRangedWeapons below
// cross-checks the set against the Ammunition property the fixture does carry.
const RANGED_WEAPONS = new Set([
  "srd_crossbow-light",
  "srd_dart",
  "srd_shortbow",
  "srd_sling",
  "srd_blowgun",
  "srd_crossbow-hand",
  "srd_crossbow-heavy",
  "srd_longbow",
  "srd_net",
]);

// The ruleset version this converter writes. Raise it when the generated
// content changes what an installed ruleset means; a rebuild refuses to lower
// a version that is already higher.
const RULESET_VERSION = 4;

// The SRD's healing spells. The fixture has no healing field at all: a spell
// carries a damage roll or nothing, so a heal arrives here looking exactly like
// a utility spell and would stay one. These are the SRD 5.1 spells whose effect
// is restoring hit points, keyed by fixture pk, with the amount the spell's own
// text states and, where its "At Higher Levels" paragraph is a plain "+NdM per
// slot level", the step that paragraph states. A spell whose higher-level text
// is anything else gets no `perCostStep` rather than a guessed one.
// assertHealingSpells fails the run when one of these leaves the source or
// starts carrying damage, so the table cannot quietly go stale. Nothing else
// about these entries changes: the rows, notes and filters stay as generated.
const HEALING_SPELLS = new Map([
  // "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability
  // modifier." At Higher Levels: "the healing increases by 1d8 for each slot level above 1st."
  ["srd_cure-wounds", { amount: { dice: "1d8" }, perCostStep: { dice: "1d8" } }],
  // "A creature of your choice that you can see within range regains hit points equal to 1d4 + your
  // spellcasting ability modifier." At Higher Levels: "increases by 1d4 for each slot level above 1st."
  ["srd_healing-word", { amount: { dice: "1d4" }, perCostStep: { dice: "1d4" } }],
  // "Each target regains hit points equal to 3d8 + your spellcasting ability modifier." At Higher
  // Levels: "the healing increases by 1d8 for each slot level above 5th."
  ["srd_mass-cure-wounds", { amount: { dice: "3d8" }, perCostStep: { dice: "1d8" } }],
  // "up to six creatures of your choice that you can see within range regain hit points equal to 1d4
  // + your spellcasting ability modifier." At Higher Levels: "increases by 1d4 for each slot level
  // above 3rd."
  ["srd_mass-healing-word", { amount: { dice: "1d4" }, perCostStep: { dice: "1d4" } }],
  // "Up to six creatures of your choice that you can see within range each regain hit points equal to
  // 2d8 + your spellcasting ability modifier." At Higher Levels: "increases by 1d8 for each slot level
  // above 2nd."
  ["srd_prayer-of-healing", { amount: { dice: "2d8" }, perCostStep: { dice: "1d8" } }],
  // "A surge of positive energy washes through the creature, causing it to regain 70 hit points." At
  // Higher Levels: "the amount of healing increases by 10 for each slot level above 6th."
  ["srd_heal", { amount: { flat: 70 }, perCostStep: { flat: 10 } }],
  // "You restore up to 700 hit points, divided as you choose among any number of creatures." That is
  // a shared pool, not what one target regains, so the amount is left out rather than misread as a
  // 700-point heal. The entry is still a heal, which is the honest part.
  ["srd_mass-heal", {}],
  // "The target regains 4d8 + 15 hit points." The regeneration over the spell's duration and the
  // restored limbs are not a number a catalog entry can carry, and the SRD states no higher-level
  // effect, so neither is here.
  ["srd_regenerate", { amount: { dice: "4d8+15" } }],
]);

// The fixture's property assignments disagree with the SRD 5.1 weapons table
// (Equipment, "Weapons") for these rows: it never assigns Heavy, and it drops
// or adds a property on a few others. Each entry is the row's FULL property
// list as the SRD prints it, keyed by fixture pk. assertWeaponCorrections
// fails the run when a pk disappears or the fixture catches up, so this table
// cannot quietly go stale.
const WEAPON_PROPERTY_CORRECTIONS = new Map([
  ["srd_crossbow-heavy", ["Ammunition", "Heavy", "Loading", "Two-Handed"]],
  ["srd_crossbow-light", ["Ammunition", "Loading", "Two-Handed"]],
  ["srd_glaive", ["Heavy", "Reach", "Two-Handed"]],
  ["srd_greataxe", ["Heavy", "Two-Handed"]],
  ["srd_greatsword", ["Heavy", "Two-Handed"]],
  ["srd_halberd", ["Heavy", "Reach", "Two-Handed"]],
  ["srd_handaxe", ["Light", "Thrown"]],
  ["srd_longbow", ["Ammunition", "Heavy", "Two-Handed"]],
  ["srd_maul", ["Heavy", "Two-Handed"]],
  ["srd_pike", ["Heavy", "Reach", "Two-Handed"]],
  ["srd_trident", ["Thrown", "Versatile"]],
  ["srd_whip", ["Finesse", "Reach"]],
]);

// The net deals no damage ("damage_dice": "0") and its whole effect is the
// restrained condition, which a sheet attack row cannot hold. Skipped on
// purpose rather than shipped as an attack for 0 damage.
const SKIPPED_WEAPONS = new Set(["srd_net"]);

// The sheet has one Level field, because a ruleset sheet has no notion of a class
// and cannot have one per class. A resource that follows a class table therefore
// reads the character's TOTAL level, which is right for a single-class character
// and generous for a multiclass one. Said on every row it affects, and in the
// package README; a player who wants their own number deletes the picked row and
// types one, because a hand-typed row is never scaled.
const MULTICLASS_NOTE = "Your sheet has one level, so a multiclass character follows the total.";

// The word an Open5e class-table column prints where the SRD states no number.
const COLUMN_UNLIMITED = "Unlimited";
const COLUMN_NUMBER_PATTERN = /^\d{1,2}$/u;

// Limited-use class resources. `max` is what the row holds before it lands on a
// sheet, and `scaled` is how the sheet then keeps it: a value reference the
// Engine resolves, plus the step table it is looked up in. A table is BUILT from
// the Open5e class-table column named by `column` wherever the source has one,
// and hand-typed from the cited SRD sentence only where it does not, in which
// case its thresholds are cross-checked against the levels the source marks the
// feature at. Every row quotes the SRD sentence that states the count; a feature
// whose uses the SRD does not state as a plain number is not here.
const COUNTERS = [
  // "Once you use this feature, you must finish a short or long rest before you can use it again."
  // The SRD raises it at no level, so this one does not scale.
  {
    feature: "srd_fighter_second-wind",
    name: "Second Wind",
    max: 1,
    recharge: "short",
    mechanics: { kind: "heal", amount: { dice: "1d10" }, targets: "self" },
  },
  // "Once you use this feature, you must finish a short or long rest before you can use it again."
  // "Starting at 17th level, you can use it twice before a rest, but only once on the same turn."
  {
    feature: "srd_fighter_action-surge",
    name: "Action Surge",
    max: 1,
    recharge: "short",
    scaled: {
      from: { field: "level" },
      table: [
        [2, 1],
        [17, 2],
      ],
      follows: "the Fighter table",
      readsLevel: true,
    },
  },
  // "you can't use this feature again until you finish a long rest." "You can use this feature
  // twice between long rests starting at 13th level and three times between long rests starting
  // at 17th level."
  {
    feature: "srd_fighter_indomitable",
    name: "Indomitable",
    max: 1,
    recharge: "long",
    scaled: {
      from: { field: "level" },
      table: [
        [9, 1],
        [13, 2],
        [17, 3],
      ],
      follows: "the Fighter table",
      readsLevel: true,
    },
  },
  // Barbarian table, Rages column: 2 at 1st level. "Once you have raged the number of times shown
  // for your barbarian level in the Rages column of the Barbarian table, you must finish a long
  // rest before you can rage again."
  {
    feature: "srd_barbarian_rage",
    name: "Rage",
    max: 2,
    recharge: "long",
    column: "srd_barbarian_rages",
    // The 20th-level cell of that column reads "Unlimited", which is not a number a counter can
    // hold, so the table stops at the last one the SRD states and the row says so.
    columnUnlimitedAt: 20,
    scaled: { from: { field: "level" }, follows: "the Barbarian table", readsLevel: true },
    note: "The table says Unlimited at 20th level, so the maximum stays 6.",
  },
  // "You can use this feature a number of times equal to your Charisma modifier (a minimum of once).
  // You regain any expended uses when you finish a long rest."
  {
    feature: "srd_bard_bardic-inspiration",
    name: "Bardic Inspiration",
    max: 1,
    recharge: "long",
    // Charisma tops out at 30 on the sheet, a modifier of +10.
    scaled: {
      from: { derived: "bardic_inspiration_uses" },
      follows: "your Charisma modifier, at least one",
      highest: 10,
    },
  },
  // "You must then finish a short or long rest to use your Channel Divinity again." "Beginning at
  // 6th level, you can use your Channel Divinity twice between rests, and beginning at 18th level,
  // you can use it three times between rests."
  {
    feature: "srd_cleric_channel-divinity",
    name: "Channel Divinity",
    max: 1,
    recharge: "short",
    scaled: {
      from: { field: "level" },
      table: [
        [2, 1],
        [6, 2],
        [18, 3],
      ],
      follows: "the Cleric table",
      readsLevel: true,
    },
  },
  // "You can use this feature twice. You regain expended uses when you finish a short or long rest."
  // The SRD never raises that two; the 20th-level Archdruid feature lifts the limit instead, which
  // is a different feature and not a number, so this one does not scale.
  {
    feature: "srd_druid_wild-shape",
    name: "Wild Shape",
    max: 2,
    recharge: "short",
    note: "At 20th level the Archdruid feature makes Wild Shape unlimited.",
  },
  // Monk table, Ki Points column: 2 at 2nd level. "When you spend a ki point, it is unavailable
  // until you finish a short or long rest."
  {
    feature: "srd_monk_ki",
    name: "Ki",
    max: 2,
    recharge: "short",
    column: "srd_monk_ki-points",
    scaled: { from: { field: "level" }, follows: "the Monk table", readsLevel: true },
  },
  // "You can use this feature a number of times equal to 1 + your Charisma modifier. When you finish
  // a long rest, you regain all expended uses."
  {
    feature: "srd_paladin_divine-sense",
    name: "Divine Sense",
    max: 1,
    recharge: "long",
    scaled: { from: { derived: "divine_sense_uses" }, follows: "1 plus your Charisma modifier", highest: 11 },
  },
  // "You have a pool of healing power that replenishes when you take a long rest. With that pool,
  // you can restore a total number of hit points equal to your paladin level x 5."
  {
    feature: "srd_paladin_lay-on-hands",
    name: "Lay on Hands",
    max: 5,
    recharge: "long",
    // Level 20 times 5.
    scaled: { from: { derived: "lay_on_hands_pool" }, follows: "your level times 5", readsLevel: true, highest: 100 },
  },
  // Sorcerer table, Sorcery Points column: 2 at 2nd level. "You regain all spent sorcery points
  // when you finish a long rest."
  {
    feature: "srd_sorcerer_font-of-magic",
    name: "Sorcery Points",
    max: 2,
    recharge: "long",
    column: "srd_sorcerer_sorcery-points",
    scaled: { from: { field: "level" }, follows: "the Sorcerer table", readsLevel: true },
  },
  // "Once per day when you finish a short rest, you can choose expended spell slots to recover."
  // The SRD raises it at no level, so this one does not scale.
  {
    feature: "srd_wizard_arcane-recovery",
    name: "Arcane Recovery",
    max: 1,
    recharge: "long",
    note: "The SRD says once per day, which the sheet tracks as a long rest.",
  },
];

// ── Small helpers ──

function fail(message) {
  throw new Error(message);
}

/** One line of plain text: every run of whitespace, including the line and
 *  paragraph separators a catalog string may not carry, becomes one space. */
function oneLine(text) {
  return String(text ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Cut `text` to `max` characters at a sentence boundary. `note` is appended
 *  only when something was actually cut, and is paid for out of the budget, so
 *  the result never exceeds `max`. */
function trimToSentence(text, max, note = "") {
  const line = oneLine(text);
  if (line.length <= max) return line;
  const budget = note ? max - note.length - 1 : max;
  const head = line.slice(0, budget);
  // A sentence ends at .!? followed by whitespace. Requiring the whitespace is
  // what keeps a decimal such as "1.5" from reading as an ending. A first
  // sentence longer than the whole budget has no boundary to find, so it falls
  // back to the last whole word.
  const boundary = [...head.matchAll(/[.!?]\s/gu)].pop();
  const cut = boundary ? head.slice(0, boundary.index + 1) : head.replace(/\s+\S*$/u, "");
  return note ? `${cut} ${note}` : cut;
}

function capitalize(text) {
  const line = oneLine(text);
  return line.length > 0 ? line[0].toUpperCase() + line.slice(1) : line;
}

/** A catalog entry id from a fixture primary key: the `srd_` prefix dropped and
 *  the remaining underscores turned into the hyphens an entry id allows. */
function entryId(pk) {
  const id = String(pk).replace(/^srd_/u, "").replaceAll("_", "-");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) || id.length > 80) fail(`${pk} does not yield a usable entry id`);
  return id;
}

/** Drop everything that is not SRD 5.1. Fixtures without a `document` field
 *  (the child tables) are keyed to a parent that has already been filtered. */
function srdOnly(records, label) {
  const kept = records.filter((record) => record.fields.document === SOURCE_DOCUMENT);
  const dropped = records.length - kept.length;
  if (dropped > 0) console.log(`  dropped ${dropped} non-${SOURCE_DOCUMENT} ${label} record(s)`);
  return kept;
}

function byId(left, right) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** Drop the keys an optional block left undefined, so a catalog file never
 *  carries `"range": null` for something the source did not say. */
function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

// A count and a die, which is what a per-slot-level step has to be read out of.
const DICE_PATTERN = /^(\d{1,3})d(\d{1,4})$/u;
// Everything the catalog's own dice field accepts, plus the plain number a few
// SRD entries state instead (the blowgun's 1, Guardian of Faith's 20).
const CATALOG_DICE_PATTERN = /^\d{1,3}d\d{1,4}(?:[+-]\d{1,4})?$/u;
const FLAT_DAMAGE_PATTERN = /^\d{1,3}$/u;

/** The damage a source string states, or a loud failure when it states a shape
 *  this converter has no reading for. */
function amountFrom(roll, label) {
  if (CATALOG_DICE_PATTERN.test(roll)) return { dice: roll };
  if (FLAT_DAMAGE_PATTERN.test(roll)) return { flat: Number(roll) };
  return fail(`${label} has damage this converter cannot map: ${roll}`);
}

// ── Spells ──

function spellRange(fields, name) {
  if (fields.range_unit === "feet") return fields.range;
  const text = oneLine(fields.range_text).toLowerCase();
  if (text === "self" || text === "touch") return 0;
  // Miles, "Unlimited" and "Special" are not a plain number of feet, and the
  // catalog's distance unit is feet, so the range is left out.
  if (text === "special" || text === "unlimited" || fields.range_unit === "miles") return undefined;
  fail(`Spell "${name}" has a range this converter cannot map: ${fields.range_text}`);
}

function spellSave(fields) {
  const ability = ABILITY_BY_SOURCE_NAME[fields.saving_throw_ability];
  if (fields.saving_throw_ability && !ability) fail(`Unknown saving throw ability "${fields.saving_throw_ability}"`);
  if (!ability) return undefined;
  const desc = fields.desc;
  if (
    /half as much damage on a successful|takes half (?:as much )?damage on a success|half damage on a successful/iu.test(
      desc,
    )
  ) {
    return { save: `${ability}_save`, onSuccess: "half" };
  }
  // "negates" only where the description says the save is the whole story: the
  // creature must succeed or the effect lands. A spell that deals damage
  // alongside the save (Heat Metal, Geas) is left out, because a success there
  // does not undo the damage.
  const succeeds = new RegExp(`must succeed on an? ${fields.saving_throw_ability} saving throw or\\b`, "iu");
  if (!fields.attack_roll && !fields.damage_roll && succeeds.test(desc)) {
    return { save: `${ability}_save`, onSuccess: "negates" };
  }
  return undefined;
}

/** What one more slot level adds, but only when every higher-level option in the
 *  source raises the same die by the same amount. Scorching Ray adds a ray and
 *  Flame Blade steps every second level, so neither gets one. */
function spellPerCostStep(fields, options) {
  const base = DICE_PATTERN.exec(fields.damage_roll ?? "");
  if (fields.level < 1 || !base) return undefined;
  const die = base[2];
  let previous = Number(base[1]);
  let step;
  for (let slot = fields.level + 1; slot <= 9; slot += 1) {
    const option = options.get(`slot_level_${slot}`);
    const raised = DICE_PATTERN.exec(option?.damage_roll ?? "");
    if (!raised || raised[2] !== die) return undefined;
    const delta = Number(raised[1]) - previous;
    if (delta < 1 || (step !== undefined && delta !== step)) return undefined;
    step = delta;
    previous = Number(raised[1]);
  }
  return step === undefined ? undefined : { dice: `${step}d${die}` };
}

/** Every healing spell named above is still in the source, and still a plain heal. A pk that
 *  vanished would take its healing with it silently; one that grew a damage roll would be two
 *  readings at once, so both stop the run instead of one quietly winning. */
function assertHealingSpells(spells) {
  for (const pk of HEALING_SPELLS.keys()) {
    const spell = spells.find((entry) => entry.pk === pk);
    if (!spell) fail(`${pk} is written as a healing spell but is not in the source`);
    if (spell.fields.damage_roll) fail(`${pk} now carries a damage roll, so it is no longer a plain healing spell`);
  }
}

function spellMechanics(fields, options, healing) {
  const shape = fields.shape_type ? AREA_SHAPES[fields.shape_type] : undefined;
  return compact({
    // The source marks no spell as healing, so a heal is the hand-checked
    // HEALING_SPELLS table above rather than a guess at the wording. Everything
    // not in that table stays exactly what it was.
    kind: healing ? "heal" : fields.damage_roll ? "attack" : "utility",
    range: spellRange(fields, fields.name),
    area: shape && fields.shape_size > 0 ? { shape, size: fields.shape_size } : undefined,
    targets: healing ? "ally" : undefined,
    amount: healing
      ? healing.amount
      : fields.damage_roll
        ? amountFrom(fields.damage_roll, `Spell "${fields.name}"`)
        : undefined,
    damageType: fields.damage_types[0],
    attackRoll: fields.attack_roll ? true : undefined,
    save: spellSave(fields),
    cost: fields.level >= 1 ? [{ pool: `slots_${fields.level}`, amount: 1 }] : undefined,
    // A healing step comes from the table, which read it out of the spell's own
    // "At Higher Levels" paragraph; the source's slot options only carry damage.
    perCostStep: healing ? healing.perCostStep : spellPerCostStep(fields, options),
    concentration: fields.concentration ? true : undefined,
    reaction: fields.casting_time === "reaction" ? true : undefined,
  });
}

function spellNotes(fields) {
  const castingTime = CASTING_TIMES[fields.casting_time];
  if (!castingTime) fail(`Spell "${fields.name}" has an unknown casting time: ${fields.casting_time}`);
  const components = ["verbal", "somatic", "material"]
    .filter((component) => fields[component])
    .map((component) => component[0].toUpperCase());
  const notes = [
    `${capitalize(fields.school)}.`,
    `Casting time: ${castingTime}.`,
    `Range: ${oneLine(fields.range_text)}.`,
    `Duration: ${oneLine(fields.duration)}.`,
    `Components: ${components.length > 0 ? components.join(", ") : "none"}.`,
  ].join(" ");
  if (notes.length > SPELL_NOTES_MAX) fail(`Spell "${fields.name}" notes are ${notes.length} characters`);
  return notes;
}

function buildSpellEntries(spells, castingOptions, classNames) {
  assertHealingSpells(spells);
  return spells
    .map(({ pk, fields }) => {
      const classes = fields.classes.map((id) => classNames.get(id) ?? fail(`Spell "${fields.name}" names ${id}`));
      return {
        id: entryId(pk),
        label: fields.name,
        summary: trimToSentence(fields.desc, SUMMARY_MAX),
        filters: { level: fields.level, school: capitalize(fields.school), classes: classes.sort() },
        rows: [
          {
            list: SPELL_LIST,
            values: {
              name: fields.name,
              level: fields.level,
              ritual: fields.ritual,
              concentration: fields.concentration,
              // Picking a spell puts it on the sheet, not into today's
              // preparations, so the player still chooses what is prepared.
              prepared: false,
              notes: spellNotes(fields),
            },
          },
        ],
        mechanics: spellMechanics(fields, castingOptions.get(pk) ?? new Map(), HEALING_SPELLS.get(pk)),
      };
    })
    .sort(byId);
}

// ── Class features ──

/** The Engine's step lookup, restated: the value of the highest threshold at or below the input,
 *  and the first value for an input below the first threshold. */
function stepTableAt(table, input) {
  let value = table[0][1];
  for (const [threshold, entry] of table) {
    if (input < threshold) break;
    value = entry;
  }
  return value;
}

/** A counter's step table read out of its Open5e class-table column, equal neighbours collapsed
 *  into one step. This is the whole reason to prefer the source: the numbers are the SRD's own,
 *  and a column that changed shape stops the build rather than shipping a stale hand-typed table. */
function stepTableFromColumn(counter, levels) {
  const rows = levels.get(counter.column);
  if (!rows?.length) fail(`${counter.name} names the class-table column ${counter.column}, which the source has not`);
  const unlimitedAt = counter.columnUnlimitedAt;
  if (unlimitedAt !== undefined && !rows.some((row) => row.level === unlimitedAt)) {
    fail(`${counter.column} has no level ${unlimitedAt}; drop columnUnlimitedAt from ${counter.name}`);
  }
  const table = [];
  let previous;
  for (const { level, value } of rows) {
    if (level === unlimitedAt) {
      // The SRD prints a word here rather than a number. Checked both ways, so a source that
      // started stating one would stop the build instead of quietly keeping the lower maximum.
      if (value !== COLUMN_UNLIMITED) {
        fail(`${counter.column} says ${JSON.stringify(value)} at level ${level}, not ${COLUMN_UNLIMITED}`);
      }
      break;
    }
    if (!COLUMN_NUMBER_PATTERN.test(String(value))) {
      fail(`${counter.column} says ${JSON.stringify(value)} at level ${level}, which is not a number`);
    }
    const number = Number(value);
    if (number !== previous) table.push([level, number]);
    previous = number;
  }
  if (table.length === 0) fail(`${counter.column} states no numbers`);
  return table;
}

/** What each kept counter can reach at most, gathered while the rows are built. */
const SCALED_CEILINGS = new Map();

/** The `scaled` block a counter row carries: which column the ruleset keeps, what it reads off the
 *  sheet, and the step table that reading is looked up in. */
function scaledFor(counter, levels) {
  const spec = counter.scaled;
  if (!spec) return undefined;
  if (spec.table && counter.column) {
    fail(`${counter.name} has a hand-typed table and the ${counter.column} column; keep the column`);
  }
  let table;
  if (spec.table) {
    // The class table marks the feature at every level its cell changes, which is the one thing
    // the source does say about a counter with no column of its own, so a threshold that drifted
    // from the SRD stops the build.
    const marked = (levels.get(counter.feature) ?? []).map((item) => item.level).join(", ");
    const typed = spec.table.map(([level]) => level).join(", ");
    if (typed !== marked) fail(`${counter.name} steps at ${typed}, but the source marks it at ${marked}`);
    table = spec.table;
  } else if (counter.column) {
    table = stepTableFromColumn(counter, levels);
  }
  // `values.max` is what the row holds before anything knows which sheet it lands on, so it has to
  // be what the table says at the sheet's own lowest level.
  if (table && stepTableAt(table, 1) !== counter.max) {
    fail(`${counter.name} starts at ${counter.max} but its table says ${stepTableAt(table, 1)} at level 1`);
  }
  // The most the kept number can ever be. A table says so itself; a derived value has to be told,
  // because nothing here evaluates the sheet. It is checked against the column's own ceiling once
  // the ruleset is written, so a counter can never be clamped short of what the rules give.
  const highest = table ? Math.max(...table.map(([, value]) => value)) : spec.highest;
  if (!Number.isInteger(highest)) fail(`${counter.name} follows a derived value and must say the highest it can reach`);
  SCALED_CEILINGS.set(counter.name, highest);
  return { max: compact({ from: spec.from, table }) };
}

/** The counter row a feature carries, plus the sentence that explains it.
 *  `levels` maps a feature to its class-table rows, ascending by level. */
function counterFor(pk, levels) {
  const counter = COUNTERS.find((row) => row.feature === pk);
  if (!counter) return undefined;
  if (counter.column) {
    // The class table carries the same number, so a hand-typed max that drifts
    // from the source stops the build instead of shipping.
    const gained = levels.get(pk)?.[0]?.level;
    const stated = levels.get(counter.column)?.find((item) => item.level === gained)?.value;
    if (String(counter.max) !== stated) {
      fail(`${counter.name} is written as ${counter.max} but ${counter.column} says ${stated} at level ${gained}`);
    }
  }
  const scaled = scaledFor(counter, levels);
  const rest = counter.recharge === "short" ? "short" : "long";
  const summary = [
    scaled
      ? `Picking this also adds the ${counter.name} class resource: its maximum follows ${counter.scaled.follows}, back after a ${rest} rest.`
      : `Picking this also adds the ${counter.name} class resource: starts at ${counter.max}, back after a ${rest} rest.`,
    counter.note,
    counter.scaled?.readsLevel ? MULTICLASS_NOTE : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  // The feature's own description is appended to this and the whole thing trimmed at a sentence
  // boundary, so a counter that filled the budget by itself would be cut mid-explanation.
  if (summary.length > SUMMARY_MAX) fail(`${counter.name} says ${summary.length} characters before its description`);
  return { counter, scaled, summary };
}

function buildFeatureEntries(features, classes, featureLevels) {
  return features
    .map(({ pk, fields }) => {
      const owner = classes.get(fields.parent) ?? fail(`Feature "${fields.name}" names ${fields.parent}`);
      const base = owner.subclass_of ? classes.get(owner.subclass_of) : owner;
      if (!base) fail(`Feature "${fields.name}" names a subclass of ${owner.subclass_of}`);
      const gainedAt = featureLevels.get(pk)?.[0]?.level;
      const counter = counterFor(pk, featureLevels);
      const rows = [
        {
          list: FEATURE_LIST,
          values: { name: fields.name, text: trimToSentence(fields.desc, FEATURE_TEXT_MAX, TRUNCATION_NOTE) },
        },
      ];
      if (counter) {
        rows.push(
          compact({
            list: COUNTER_LIST,
            values: { name: counter.counter.name, max: counter.counter.max, recharge: counter.counter.recharge },
            scaled: counter.scaled,
          }),
        );
      }
      return {
        id: entryId(pk),
        label: fields.name,
        summary: counter
          ? trimToSentence(`${counter.summary} ${fields.desc}`, SUMMARY_MAX)
          : trimToSentence(fields.desc, SUMMARY_MAX),
        filters: compact({
          class: base.name,
          subclass: owner.subclass_of ? owner.name : "Base class",
          // A feature the fixture never puts on a class table (Equipment,
          // Proficiencies) has no level, so it simply carries no level filter.
          level: gainedAt,
        }),
        rows,
        mechanics: counter?.counter.mechanics,
      };
    })
    .sort(byId);
}

// ── Weapons ──

function assertRangedWeapons(weapons, propertiesByWeapon) {
  for (const pk of RANGED_WEAPONS) {
    if (!weapons.some((weapon) => weapon.pk === pk))
      fail(`${pk} is listed as a ranged weapon but is not in the source`);
  }
  for (const { pk, fields } of weapons) {
    const ammunition = (propertiesByWeapon.get(pk) ?? []).some((entry) => entry.name === "Ammunition");
    if (ammunition && !RANGED_WEAPONS.has(pk)) fail(`${fields.name} takes ammunition but is not listed as ranged`);
  }
}

function assertWeaponCorrections(weapons, propertiesByWeapon) {
  for (const [pk, corrected] of WEAPON_PROPERTY_CORRECTIONS) {
    if (!weapons.some((weapon) => weapon.pk === pk))
      fail(`Weapon correction names ${pk}, which the source no longer has`);
    const sourced = (propertiesByWeapon.get(pk) ?? [])
      .map((entry) => entry.name.replace(/^Special \(.*\)$/u, "Special"))
      .sort();
    if (sourced.join("|") === [...corrected].sort().join("|")) {
      fail(`The source now lists ${pk} the way the SRD does; remove its entry from WEAPON_PROPERTY_CORRECTIONS`);
    }
  }
}

function buildWeaponEntries(weapons, propertiesByWeapon) {
  assertRangedWeapons(weapons, propertiesByWeapon);
  assertWeaponCorrections(weapons, propertiesByWeapon);
  return weapons
    .filter(({ pk, fields }) => !SKIPPED_WEAPONS.has(pk) && !fields.is_improvised)
    .map(({ pk, fields }) => {
      const assigned = (propertiesByWeapon.get(pk) ?? [])
        .slice()
        .sort((left, right) => (left.name < right.name ? -1 : 1));
      // "Special (Lance)" and "Special (Net)" are one SRD property, Special,
      // named per weapon in the fixture.
      const sourced = assigned.map((entry) => entry.name.replace(/^Special \(.*\)$/u, "Special"));
      const properties = WEAPON_PROPERTY_CORRECTIONS.get(pk) ?? sourced;
      const has = (name) => properties.includes(name);
      const ranged = RANGED_WEAPONS.has(pk);
      const category = `${fields.is_simple ? "Simple" : "Martial"} ${ranged ? "ranged" : "melee"}`;
      const amount = amountFrom(fields.damage_dice, fields.name);
      const versatile = assigned.find((entry) => entry.name === "Versatile")?.detail;
      const summary = [
        `${category} weapon.`,
        properties.length > 0 ? `Properties: ${properties.join(", ")}.` : "",
        // Kept as Strength so the row matches the sheet's single ability
        // column; the player switches it when Dexterity is better.
        has("Finesse") ? "Finesse: may use Dexterity." : "",
        versatile ? `Versatile: ${versatile} in two hands.` : "",
        fields.range > 0 ? `Range ${fields.range}/${fields.long_range} feet.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return {
        id: entryId(pk),
        label: fields.name,
        summary: trimToSentence(summary, SUMMARY_MAX),
        filters: { category, properties },
        rows: [
          {
            list: ATTACK_LIST,
            values: {
              name: fields.name,
              ability: ranged ? "dex" : "str",
              proficient: true,
              bonus: 0,
              damage: fields.damage_dice,
              damage_type: fields.damage_type,
            },
          },
        ],
        mechanics: compact({
          kind: "attack",
          // A ranged or thrown weapon uses its own normal range; any other
          // melee weapon reaches 5 feet, or 10 with the Reach property.
          range: fields.range > 0 ? fields.range : has("Reach") ? 10 : 5,
          amount,
          damageType: fields.damage_type,
          attackRoll: true,
        }),
      };
    })
    .sort(byId);
}

// ── Output ──

const prettierOptions = await prettier.resolveConfig(join(packageRoot, "ruleset.json"));

async function writeJson(path, value) {
  const formatted = await prettier.format(JSON.stringify(value), { ...prettierOptions, parser: "json" });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, formatted);
  return Buffer.byteLength(formatted);
}

/** Splice the catalog headers into the committed `ruleset.json` as TEXT rather
 *  than re-serializing the parsed document, so every line the catalogs do not
 *  touch keeps the bytes it already had. The file already carries a root
 *  `$comment` of its own, so the provenance rides on each catalog header
 *  instead; a second root key would silently replace the first one on parse. */
async function writeRuleset(path, catalogs) {
  const raw = await readFile(path, "utf8");
  const versions = raw.match(/^ {2}"version": \d+,$/gmu) ?? [];
  if (versions.length !== 1) fail(`Expected exactly one top-level version in ruleset.json, found ${versions.length}`);
  // A rebuild must never lower the version somebody raised by hand for another reason.
  const current = Number(/\d+/u.exec(versions[0])[0]);
  if (current > RULESET_VERSION) {
    fail(`ruleset.json is at version ${current}; raise RULESET_VERSION in this script before rebuilding`);
  }
  // The hand-authored `battle` block has to sit ABOVE the catalogs key, because
  // the splice below replaces that key and every byte after it. A block that
  // drifted below would be deleted by a rebuild without a word.
  const battleAt = raw.search(/^ {2}"battle":/mu);
  const catalogsAt = raw.search(/^ {2}"catalogs":/mu);
  if (battleAt >= 0 && catalogsAt >= 0 && battleAt > catalogsAt) {
    fail(
      'ruleset.json has "battle" after "catalogs"; move it above, because a rebuild replaces the catalogs key and everything after it',
    );
  }
  const closing = raw.lastIndexOf("\n}");
  if (closing < 0 || raw.slice(closing) !== "\n}\n") fail("ruleset.json does not end with a closing brace");
  const body = raw
    .slice(0, closing)
    .replace(/^ {2}"version": \d+,$/mu, `  "version": ${RULESET_VERSION},`)
    // Drop a catalogs block an earlier run wrote, with the comma that joined it
    // to the key before, so rebuilding is idempotent instead of stacking blocks.
    .replace(/^ {2}"catalogs": [\s\S]*$/mu, "")
    .replace(/,?\s*$/u, "");
  const spliced = `${body},\n"catalogs":${JSON.stringify(catalogs)}\n}\n`;
  const formatted = await prettier.format(spliced, { ...prettierOptions, parser: "json" });
  await writeFile(path, formatted);
  return { bytes: Buffer.byteLength(formatted), document: JSON.parse(formatted) };
}

// ── Run ──

const sourceFlag = process.argv.indexOf("--source");
if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  fail("Usage: node scripts/build-5e-srd-catalogs.mjs --source <fixtures dir>");
}
const sourceDir = resolve(process.argv[sourceFlag + 1]);
const fixture = async (name) => JSON.parse(await readFile(join(sourceDir, name), "utf8"));

const documents = await fixture("Document.json");
if (!documents.some((entry) => entry.pk === SOURCE_DOCUMENT)) {
  fail(`${sourceDir} does not contain the ${SOURCE_DOCUMENT} document`);
}
const sourceCommit = oneLine(await readFile(join(sourceDir, "SOURCE_COMMIT"), "utf8"));
if (!/^[a-f0-9]{40}$/u.test(sourceCommit)) fail(`SOURCE_COMMIT is not a commit sha: ${sourceCommit}`);

const provenance =
  `Generated by scripts/build-5e-srd-catalogs.mjs. Do not edit by hand. Source: Open5e ${SOURCE_DOCUMENT} data, ` +
  `${SOURCE_REPOSITORY}, ${SOURCE_PATH}, commit ${sourceCommit}, licensed CC-BY-4.0 like SRD 5.1 itself.`;

const classes = new Map(srdOnly(await fixture("CharacterClass.json"), "class").map(({ pk, fields }) => [pk, fields]));
const classNames = new Map([...classes].map(([pk, fields]) => [pk, fields.name]));

const castingOptions = new Map();
for (const { fields } of await fixture("SpellCastingOption.json")) {
  if (!castingOptions.has(fields.parent)) castingOptions.set(fields.parent, new Map());
  castingOptions.get(fields.parent).set(fields.type, fields);
}
const spells = buildSpellEntries(srdOnly(await fixture("Spell.json"), "spell"), castingOptions, classNames);

// A class table's rows are modelled as features whose description is the marker
// "[Column data]". They are the source for a counter maximum, never a feature a
// player picks, so they are indexed and then kept out of the catalog.
const allFeatures = srdOnly(await fixture("ClassFeature.json"), "class feature");
const featureLevels = new Map();
for (const { fields } of await fixture("ClassFeatureItem.json")) {
  if (!featureLevels.has(fields.parent)) featureLevels.set(fields.parent, []);
  featureLevels.get(fields.parent).push({ level: fields.level, value: fields.column_value });
}
for (const items of featureLevels.values()) items.sort((left, right) => left.level - right.level);
const features = buildFeatureEntries(
  allFeatures.filter(({ fields }) => oneLine(fields.desc) !== "[Column data]"),
  classes,
  featureLevels,
);
for (const counter of COUNTERS) {
  if (!allFeatures.some(({ pk }) => pk === counter.feature)) fail(`${counter.feature} is not an SRD class feature`);
}

const weaponProperties = new Map(
  srdOnly(await fixture("WeaponProperty.json"), "weapon property").map(({ pk, fields }) => [pk, fields.name]),
);
const propertiesByWeapon = new Map();
for (const { fields } of srdOnly(await fixture("WeaponPropertyAssignment.json"), "weapon property assignment")) {
  const name = weaponProperties.get(fields.property) ?? fail(`Unknown weapon property ${fields.property}`);
  if (!propertiesByWeapon.has(fields.weapon)) propertiesByWeapon.set(fields.weapon, []);
  propertiesByWeapon.get(fields.weapon).push({ name, detail: fields.detail });
}
const weaponRecords = srdOnly(await fixture("Weapon.json"), "weapon");
const weapons = buildWeaponEntries(weaponRecords, propertiesByWeapon);

// Two catalogs are long enough to need a file of their own; the weapon list is
// short, so it rides inline and keeps ruleset.json self-contained.
const catalogs = [
  {
    $comment: `Ready-made SRD 5.1 spells. A picked row is a copy the player can edit. ${provenance}`,
    id: "spells",
    label: "Spells",
    feeds: [SPELL_LIST],
    filters: [
      { id: "level", label: "Level", type: "number" },
      { id: "school", label: "School", type: "text" },
      { id: "classes", label: "Class", type: "tags", startFrom: { field: "class" } },
    ],
    units: DISTANCE_UNITS,
    asset: "catalogs/spells.json",
  },
  {
    $comment:
      "Class and subclass features. One pick fills the feature row and, where the SRD states a plain count, " +
      `the class resource that tracks it. ${provenance}`,
    id: "features",
    label: "Class features",
    feeds: [FEATURE_LIST, COUNTER_LIST],
    filters: [
      { id: "class", label: "Class", type: "text", startFrom: { field: "class" } },
      { id: "subclass", label: "Subclass", type: "text" },
      { id: "level", label: "Level", type: "number" },
    ],
    units: DISTANCE_UNITS,
    asset: "catalogs/features.json",
  },
  {
    $comment: `The SRD weapon table as attack rows. Short enough to ship inline. ${provenance}`,
    id: "weapons",
    label: "Weapons",
    feeds: [ATTACK_LIST],
    filters: [
      { id: "category", label: "Category", type: "text" },
      { id: "properties", label: "Properties", type: "tags" },
    ],
    units: DISTANCE_UNITS,
    entries: weapons,
  },
];

const assets = new Map([
  ["catalogs/spells.json", { schemaVersion: 1, $comment: provenance, catalog: "spells", entries: spells }],
  ["catalogs/features.json", { schemaVersion: 1, $comment: provenance, catalog: "features", entries: features }],
]);

const rulesetPath = join(packageRoot, "ruleset.json");
const { bytes: rulesetBytes, document } = await writeRuleset(rulesetPath, catalogs);
const written = new Map();
for (const [assetPath, value] of assets) {
  written.set(assetPath, { bytes: await writeJson(join(packageRoot, assetPath), value) });
}

// The package's own contract checks run over what was just written, so a file
// the validator would reject never survives a build.
const manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
const sources = new Map();
for (const assetPath of assets.keys()) sources.set(assetPath, await readFile(join(packageRoot, assetPath), "utf8"));
const summaries = assertRulesetCatalogs(manifest, document, sources);
assertRulesetBattle(manifest, document);
const scaledRows = assertRulesetScaled(manifest, document, sources);
// A kept maximum is fitted to its column when the sheet is edited, so the column has to have room
// for the most the rules can give (Lay on Hands is 100 at level 20).
const counterMax = document.sheet.lists
  .find((list) => list.id === COUNTER_LIST)
  ?.columns.find((column) => column.id === "max")?.max;
for (const [name, highest] of SCALED_CEILINGS) {
  if (!(highest <= counterMax)) {
    fail(`${name} can reach ${highest}, but the ${COUNTER_LIST} list's max column stops at ${counterMax}`);
  }
}

console.log(`5e SRD catalogs built from ${SOURCE_DOCUMENT} at ${sourceCommit}`);
console.log(`  ruleset.json ${rulesetBytes} bytes`);
for (const summary of summaries) {
  const bytes = written.get(`catalogs/${summary.id}.json`)?.bytes;
  console.log(
    `  ${summary.id}: ${summary.entryCount} entries${bytes === undefined ? " (inline)" : `, ${bytes} bytes`}`,
  );
}
console.log(
  `  ${weaponRecords.length - weapons.length} weapon(s) skipped, ${COUNTERS.length} counter(s) declared, ` +
    `${scaledRows} of them kept by the sheet`,
);
