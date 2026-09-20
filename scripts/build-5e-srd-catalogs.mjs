// Turn Open5e's `srd-2014` fixtures into the ruleset catalogs the
// `ruleset-5e-2014` package ships: a spell catalog, a class-feature catalog, an
// inline weapon catalog and a bestiary, plus the `combat` block whose threat
// scale is measured from that bestiary.
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
// The places a number is typed by hand are COUNTERS, HEALING_SPELLS,
// SPELL_RIDERS and LEGENDARY_POINTS below, where the SRD states something no
// fixture field carries. Each row cites the SRD sentence it came from, every
// counter a class-table column also carries has its whole step table BUILT from
// that column, a hand-typed step table has its levels cross-checked against the
// ones the source marks the feature at, and every hand-written pk is checked
// against the source, so a typo cannot survive a rebuild.
//
// Creature numbers are never hand-typed. The PRINTED action text is the truth
// and the structured attack row is a cross-check, because the row's damage type
// says "thunder" on 532 of 542 rows and its flat bonus is null on 513 of 517.
// Every disagreement is counted in the build report.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import {
  RULESET_CATALOG_DICE_PATTERN,
  RULESET_CREATURE_MAX_ACTIONS,
  RULESET_CREATURE_MAX_TRAITS,
  assertRulesetBattle,
  assertRulesetCatalogs,
  assertRulesetCombat,
  assertRulesetCreatures,
  assertRulesetScaled,
} from "./ruleset-package-checks.mjs";

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
const CREATURE_CATALOG = "creatures";
const DISTANCE_UNITS = { distance: { label: "ft", perCell: 5 } };

// The three distance columns of the attacks list, wired through combat.attacks
// so one weapon row says how far it swings and how far it is thrown or shot.
const ATTACK_REACH_COLUMN = "reach";
const ATTACK_RANGE_COLUMN = "range";
const ATTACK_LONG_RANGE_COLUMN = "long_range";

// The combat block's own ids, all declared by ruleset.json: the budgets a turn
// holds, the save the sheet keeps concentration on and the thirteen damage
// types. assertRulesetCombat re-checks every one of them against the sheet.
const BUDGET_ACTION = "action";
const BUDGET_BONUS = "bonus";
const BUDGET_REACTION = "reaction";
const DAMAGE_TYPES = Object.freeze([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);
const DAMAGE_TYPE_SET = new Set(DAMAGE_TYPES);

// The conditions ruleset.json declares. Exhaustion is deliberately absent: the
// sheet counts it on a track rather than holding it as a condition, so a
// creature immune to exhaustion says so in a trait instead.
const CONDITIONS = Object.freeze([
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
]);
const CONDITION_SET = new Set(CONDITIONS);

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

// The catalog's area shapes are a closed set the Engine reads on a board: a
// burst, a cone and a line. A sphere and a cylinder are a burst with the radius
// the SRD prints, so those carry straight over.
//
// A CUBE and a SQUARE are neither. The nearest honest thing is the burst that
// covers the same patch of ground: a burst of radius r covers 2r + 1 cells
// across, so an edge of N feet is the burst of radius (N - 5) / 2. A cube whose
// edge is an odd number of cells comes out exact (a 15-foot cube is three cells
// across, and so is a burst of radius 5 feet), and an even one comes out one
// cell wider. It is the one place a shipped area is not the SRD's own outline,
// and the README says so.
const AREA_SHAPES = Object.freeze({
  sphere: "burst",
  cylinder: "burst",
  // "in a 10-foot radius", which is how a stat block writes a sphere.
  radius: "burst",
  cube: "burst",
  square: "burst",
  cone: "cone",
  line: "line",
});
const BOXED_SHAPES = new Set(["cube", "square"]);
const GRID_FEET = DISTANCE_UNITS.distance.perCell;

/** One printed shape as the catalog carries it, or nothing when the source
 *  states no shape at all. A boxed shape becomes the burst nearest its own
 *  footprint; every other shape keeps the number the SRD prints. */
function areaFrom(shapeType, size, name) {
  if (!shapeType) return undefined;
  const shape = AREA_SHAPES[shapeType];
  if (!shape) fail(`Spell "${name}" has the shape "${shapeType}", which this converter has no reading for`);
  if (!(size > 0)) return undefined;
  if (!BOXED_SHAPES.has(shapeType)) return { shape, size };
  // Never zero: a burst has to cover at least the cell it is centred on, and
  // the schema refuses a size of nothing.
  return { shape, size: Math.max(GRID_FEET / 2, (size - GRID_FEET) / 2) };
}

// The areas the SRD prints in a spell's own sentence and the Open5e fixture
// carries no shape fields for. Each row quotes the fragment it was read from,
// and assertSpellAreas below fails the run when the pk leaves the source, when
// the source grows shape fields of its own (the table would then be a second
// opinion), or when the quoted fragment is no longer in the spell's text.
const SPELL_AREAS = new Map([
  // "Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range."
  ["srd_black-tentacles", { shape: "square", size: 20, printed: "a 20-foot square" }],
  // "an intense tremor rips through the ground in a 100-foot-radius circle centered on that point"
  ["srd_earthquake", { shape: "sphere", size: 100, printed: "a 100-foot-radius circle" }],
  // "Grasping weeds and vines sprout from the ground in a 20-foot square starting form a point within range."
  ["srd_entangle", { shape: "square", size: 20, printed: "a 20-foot square" }],
  // "Each creature in a 10-foot-radius, 40-foot-high cylinder centered on a point within range"
  ["srd_flame-strike", { shape: "cylinder", size: 10, printed: "a 10-foot-radius, 40-foot-high cylinder" }],
  // "Slick grease covers the ground in a 10-foot square centered on a point within range"
  ["srd_grease", { shape: "square", size: 10, printed: "a 10-foot square" }],
  // "A hail of rock-hard ice pounds to the ground in a 20-foot-radius, 40-foot-high cylinder"
  ["srd_ice-storm", { shape: "cylinder", size: 20, printed: "a 20-foot-radius, 40-foot-high cylinder" }],
  // "A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you"
  ["srd_lightning-bolt", { shape: "line", size: 100, printed: "a line 100 feet long and 5 feet wide" }],
  // "A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high cylinder"
  ["srd_moonbeam", { shape: "cylinder", size: 5, printed: "a 5-foot-radius, 40-foot-high cylinder" }],
  // "The ground in a 20-foot radius centered on a point within range twists and sprouts hard spikes"
  ["srd_spike-growth", { shape: "sphere", size: 20, printed: "a 20-foot radius" }],
  // "A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-long line."
  ["srd_sunbeam", { shape: "line", size: 60, printed: "a 5-foot-wide, 60-foot-long line" }],
  // "Brilliant sunlight flashes in a 60-foot radius centered on a point you choose within range."
  ["srd_sunburst", { shape: "sphere", size: 60, printed: "a 60-foot radius" }],
]);

// Spells whose FIXTURE states shape fields that are not the patch of ground the
// spell catches creatures in. The source models one number per spell, so a size
// the text gives for something else entirely arrives looking exactly like an
// area. Each row quotes the sentence the number really belongs to, and
// assertSpellAreas fails the run when the pk leaves the source or stops stating
// a shape of its own, so the table cannot go stale in either direction.
const SPELL_FIXTURE_SHAPES_NOT_AREAS = new Map([
  // "The area of the storm consists of up to ten 10-foot cubes, which you can arrange as you wish."
  // One cube is a tenth of the storm, and the Engine has no shape made of several.
  [
    "srd_fire-storm",
    {
      printed: "up to ten 10-foot cubes",
      reason: "the storm is up to ten 10-foot cubes arranged as you wish, and the Engine has no shape made of several",
    },
  ],
  // "If you target an object, it must be able to fit entirely inside a 10-foot cube": the size of
  // the thing you may send, not a patch of ground. The spell itself takes willing creatures.
  [
    "srd_teleport",
    {
      printed: "fit entirely inside a 10-foot cube",
      reason: "the 10-foot cube is how big an object it may send, not an area it catches creatures in",
    },
  ],
]);

// A shape made of SEVERAL boxes. The fixture states one box and one size, so a
// sentence like this would otherwise ship as a single burst a tenth of the
// printed size. Any boxed shape whose text says this has to be accounted for in
// the table above, or the run stops.
const SEVERAL_BOXES =
  /\b(?:up to\s+)?(?:two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+\d{1,3}[- ]foot[- ](?:cubes|squares|square panels)/iu;

// Spells a fight resolves whose text prints a distance in the shape of an area
// and where that shape is NOT the patch of ground the spell catches creatures
// in. Written down rather than silently ignored, so the scan below can fail the
// run on a printed shape nobody has looked at.
const SPELL_SHAPES_NOT_AREAS = new Map([
  ["srd_control-water", "the 20-foot wave is moving water, and the Engine has no shape that moves"],
  ["srd_disintegrate", "the 10-foot cube is what the ray destroys of an object; the spell itself takes one target"],
  ["srd_flame-blade", "the 10-foot radius is the light the blade sheds"],
  ["srd_produce-flame", "the 10-foot radius is the light the flame sheds"],
  ["srd_wall-of-ice", "ten 10-foot-square panels are a wall, and the Engine has no wall to build"],
]);

// Loose on purpose: it only has to notice that a sentence states a distance in
// the shape of an area, so that the two tables above have to account for it.
const PRINTED_SHAPE =
  /(\d{1,3})[- ]foot(?:[- ](?:radius|cone|cube|square|line|sphere|cylinder|wide|long|tall|high))|\bline\s+(\d{1,3})\s+feet\s+long/iu;

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
const RULESET_VERSION = 6;

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

// A round is six seconds, which is what turns an SRD duration into a number of
// rounds a fight can count down.
const ROUNDS_PER_MINUTE = 10;
const ROUNDS_PER_HOUR = 600;

// The SRD spells whose effect a fight can resolve but whose fixture fields do
// not say so: the conditions they put on a target, the ones that simply land,
// and the ones that grant temporary hit points. Deliberately short. Each row
// quotes the SRD sentence it was read out of, is keyed by fixture pk, and is
// checked against the source on every build by assertSpellRiders, so a pk that
// left the SRD or a spell that grew a damage roll stops the run.
//
// `applies` lands only on a failed save, so every row here either has a save the
// fixture already carries or states one of its own. A spell whose gate is not a
// saving throw (Sleep's hit point total, Colour Spray's, Web's escape check) is
// NOT here: it would land unconditionally, which the SRD does not say.
const SPELL_RIDERS = new Map([
  // "The target must succeed on a wisdom saving throw or be paralyzed for the duration. At the end
  // of each of its turns, the target can make another wisdom saving throw."
  [
    "srd_hold-person",
    { applies: [{ condition: "paralyzed", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } }] },
  ],
  // "The target must make a saving throw of Wisdom or be paralyzed for the duration of the spell.
  // ... the target can make a new saving throw of Wisdom."
  [
    "srd_hold-monster",
    {
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "paralyzed", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } }],
    },
  ],
  // "Each creature in a 30-foot cone must succeed on a wisdom saving throw or drop whatever it is
  // holding and become frightened for the duration." The duration is 1 minute. The save that ends it
  // early needs line of sight, which a fight has no positions for, so only the clock is carried.
  ["srd_fear", { applies: [{ condition: "frightened", duration: { rounds: ROUNDS_PER_MINUTE } }] }],
  // "It must make a wisdom saving throw ... If it fails the saving throw, it is charmed by you until
  // the spell ends." The duration is 1 hour.
  [
    "srd_charm-person",
    {
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "charmed", duration: { rounds: ROUNDS_PER_HOUR } }],
    },
  ],
  // "The target must succeed on a wisdom saving throw or fall prone, becoming incapacitated and
  // unable to stand up for the duration. ... At the end of each of its turns ... the target can make
  // another wisdom saving throw."
  [
    "srd_hideous-laughter",
    {
      applies: [
        { condition: "prone", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } },
        { condition: "incapacitated", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } },
      ],
    },
  ],
  // "It must succeed on a wisdom saving throw or be charmed by you for the duration." 1 minute. The
  // new save each time the target takes damage is not a clock the format can hold.
  ["srd_dominate-person", { applies: [{ condition: "charmed", duration: { rounds: ROUNDS_PER_MINUTE } }] }],
  ["srd_dominate-beast", { applies: [{ condition: "charmed", duration: { rounds: ROUNDS_PER_MINUTE } }] }],
  // The same sentence, for 1 hour.
  ["srd_dominate-monster", { applies: [{ condition: "charmed", duration: { rounds: ROUNDS_PER_HOUR } }] }],
  // "each creature standing in its area must succeed on a dexterity saving throw or fall prone."
  // Prone has no clock of its own: you stand up, which is what "instant" means here.
  ["srd_grease", { applies: [{ condition: "prone", duration: "instant" }] }],
  // "A creature in the area when you cast the spell must succeed on a strength saving throw or be
  // restrained by the entangling plants until the spell ends." 1 minute. Escaping is a Strength
  // CHECK against an action, not a saving throw, so only the clock is carried.
  ["srd_entangle", { applies: [{ condition: "restrained", duration: { rounds: ROUNDS_PER_MINUTE } }] }],
  // "Each creature in the area who sees the pattern must make a wisdom saving throw. On a failed
  // save, the creature becomes charmed for the duration. While charmed by this spell, the creature
  // is incapacitated." 1 minute.
  [
    "srd_hypnotic-pattern",
    {
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [
        { condition: "charmed", duration: { rounds: ROUNDS_PER_MINUTE } },
        { condition: "incapacitated", duration: { rounds: ROUNDS_PER_MINUTE } },
      ],
    },
  ],
  // "the creature must make a constitution saving throw. On a failed save, it is restrained as its
  // flesh begins to harden. ... must make another constitution saving throw at the end of each of
  // its turns." Turning to stone after three failures is not a count the format keeps.
  [
    "srd_flesh-to-stone",
    {
      save: { save: "con_save", onSuccess: "negates" },
      applies: [{ condition: "restrained", duration: "until-save", saveEnds: { save: "con_save", at: "turn-end" } }],
    },
  ],
  // "The target must make a wisdom saving throw. On a failed save, the target becomes frightened for
  // the duration." 1 minute. The 4d10 psychic damage on each of the target's later turns is a second
  // clock the format has nowhere to put.
  [
    "srd_phantasmal-killer",
    {
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "frightened", duration: { rounds: ROUNDS_PER_MINUTE } }],
    },
  ],
  // "Each creature in a 30-foot-radius sphere ... must make a wisdom saving throw. On a failed save,
  // a creature becomes frightened for the duration." 1 minute.
  [
    "srd_weird",
    {
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "frightened", duration: { rounds: ROUNDS_PER_MINUTE } }],
    },
  ],
  // "Each creature in the line must make a constitution saving throw. On a failed save, a creature
  // takes 6d8 radiant damage and is blinded until your next turn. On a successful save, it takes
  // half as much damage and isn't blinded by this spell." The fixture's own wording does not match
  // the half-damage sentences the converter reads, so the save is stated here.
  [
    "srd_sunbeam",
    { save: { save: "con_save", onSuccess: "half" }, applies: [{ condition: "blinded", duration: { rounds: 1 } }] },
  ],
  // "You create three glowing darts of magical force. Each dart hits a creature of your choice ... A
  // dart deals 1d4 + 1 force damage to its target." The fixture carries no damage roll for it at all
  // and its target_count says 1, so both are stated here. One more dart per slot level above 1st is
  // a target the format cannot add, so no perCostStep is written.
  [
    "srd_magic-missile",
    {
      kind: "attack",
      amount: { dice: "1d4+1" },
      damageType: "force",
      autoHit: true,
      targetCount: 3,
    },
  ],
  // "you gain 1d4 + 4 temporary hit points for the duration."
  ["srd_false-life", { kind: "buff", targets: "self", temporary: { dice: "1d4+4" } }],
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
    // "On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter
    // level." The 1d10 is carried; the flat class level is not, because an amount grows in DICE.
    mechanics: { kind: "heal", amount: { dice: "1d10" }, targets: "self", budget: BUDGET_BONUS },
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
// SRD entries state instead (the blowgun's 1, Guardian of Faith's 20). The dice
// shape is the Engine's: at least one die, of at least two sides, no leading zeros.
// One copy of it, kept beside the package checks that restate the Engine's rules.
const CATALOG_DICE_PATTERN = RULESET_CATALOG_DICE_PATTERN;
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

// What a saving throw does about the damage, read from the spell's own printed
// sentence. Three shapes, and nothing outside them is guessed at:
//
//   half     "On a successful save, it takes half as much damage", in either
//            order: the SRD's commonest wording.
//   negates  "must succeed on a Dexterity saving throw or take 3d6", or "On a
//            failed save, the target takes 10d6 + 40 force damage": the damage
//            IS what failing brings, so a success avoids all of it.
//   none     the damage is dealt before the save is even called for, so the
//            save gates something else and the damage lands either way.
//
// A damaging spell whose wording fits none of them lands on nobody's judgement:
// SPELL_SAVES_BY_HAND says which it is and quotes the sentence, and
// assertSpellLands below stops the run for a damaging spell that is in neither
// place. This matters because an entry with no save at all does not ask for one
// in the middle of a turn: it simply deals its whole damage, every time.
const SAVE_HALVES =
  /half as much damage on a successful|takes? half (?:as much )?damage on a success|half damage on a successful|on a successful save[^.]{0,140}?\bhalf\b/iu;
const SAVE_NEGATES = /on a failed save[^.]{0,200}?\bdamage\b|saving throw or (?:take|takes)\b/iu;

// The damaging spells whose sentence neither reading above fits, decided by
// hand from the words quoted beside each. assertSpellSaves keeps them honest.
const SPELL_SAVES_BY_HAND = new Map([
  // "On a failed save, echoes of the phantasmal monstrosity spawn a nightmare ... In addition, when
  // the target wakes up, it takes 3d6 psychic damage." The damage follows the failed save, two
  // sentences later, so a success avoids it.
  ["srd_dream", { onSuccess: "negates", printed: "when the target wakes up, it takes 3d6 psychic damage" }],
  // "The target takes 4d6 psychic damage and must make an intelligence saving throw." The damage is
  // dealt before the save; the save only decides whether its mind goes with it.
  [
    "srd_feeblemind",
    { onSuccess: "none", printed: "The target takes 4d6 psychic damage and must make an intelligence saving throw" },
  ],
  // "Any creature in physical contact with the object takes 2d8 fire damage when you cast the
  // spell." The save that follows is about dropping the object, not about the burn.
  ["srd_heat-metal", { onSuccess: "none", printed: "takes 2d8 fire damage when you cast the spell" }],
]);

// Spells the source gives a damage roll that is NOT what the spell does to
// somebody it is cast at: a row of a table it rolls on, a ward that burns
// whoever walks in, ground that cuts whoever crosses it. Shipped as `utility`,
// which keeps them off a fight menu entirely, because an entry that deals
// damage with nothing rolled for it simply lands.
const SPELL_DAMAGE_NOT_ITS_OWN = new Map([
  // "On a mishap ... each teleporting creature takes 3d10 force damage": one row of the spell's own
  // d100 table, and it hurts the travellers rather than anybody they are aimed at.
  [
    "srd_teleport",
    {
      printed: "takes 3d10 force damage",
      reason: "the 3d10 is the mishap row of its own d100 table and hurts the travellers, not a target",
    },
  ],
  // "While the creature is charmed by you, it takes 5d10 psychic damage each time it acts in a
  // manner directly counter to your instructions, but no more than once each day."
  [
    "srd_geas",
    {
      printed: "each time it acts in a manner directly counter to your instructions",
      reason: "the 5d10 only comes later, when a charmed creature disobeys, and never when it is cast",
    },
  ],
  // "When a chosen creature enters the spell's area for the first time on a turn or starts its turn
  // there, the creature takes 5d10 radiant or necrotic damage."
  [
    "srd_forbiddance",
    {
      printed: "enters the spell's area for the first time on a turn",
      reason: "the 5d10 is a ward that burns a named kind of creature walking in, not something it is aimed at",
    },
  ],
  // "When a creature moves into or within the area, it takes 2d4 piercing damage for every 5 feet
  // it travels."
  [
    "srd_spike-growth",
    {
      printed: "2d4 piercing damage for every 5 feet it travels",
      reason: "the 2d4 is ground that cuts whoever walks over it, counted per 5 feet rather than per cast",
    },
  ],
]);

// The SRD prints "Make a melee spell attack" and the fixture says otherwise.
// One entry, corrected from the printed sentence and checked both ways, so a
// source that fixes itself stops the run rather than leaving a stale override.
const SPELL_ATTACK_ROLL_CORRECTIONS = new Map([["srd_inflict-wounds", "Make a melee spell attack"]]);

function spellSave(pk, fields) {
  const ability = ABILITY_BY_SOURCE_NAME[fields.saving_throw_ability];
  if (fields.saving_throw_ability && !ability) fail(`Unknown saving throw ability "${fields.saving_throw_ability}"`);
  if (!ability) return undefined;
  const desc = oneLine(fields.desc);
  const byHand = SPELL_SAVES_BY_HAND.get(pk);
  if (byHand) return { save: `${ability}_save`, onSuccess: byHand.onSuccess };
  if (SAVE_HALVES.test(desc)) return { save: `${ability}_save`, onSuccess: "half" };
  if (SAVE_NEGATES.test(desc)) return { save: `${ability}_save`, onSuccess: "negates" };
  // And the spell that deals no damage at all: "must succeed on a Wisdom saving throw or be
  // paralyzed" is the save being the whole story, which is what negates says.
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

/** Every rider names a spell the source still has, and never a condition or save the sheet does not
 *  declare, so a table that drifted from the SRD or from ruleset.json stops the build. A row that
 *  states its own `amount` is only for a spell the fixture carries no damage roll for, which is what
 *  makes it a statement of the SRD rather than a second opinion about one. */
function assertSpellRiders(spells) {
  for (const [pk, rider] of SPELL_RIDERS) {
    const spell = spells.find((entry) => entry.pk === pk);
    if (!spell) fail(`${pk} is written as a spell rider but is not in the source`);
    if (rider.amount && spell.fields.damage_roll) {
      fail(`${pk} now carries a damage roll of its own, so its hand-written amount is a second opinion`);
    }
    for (const applies of rider.applies ?? []) {
      if (!CONDITION_SET.has(applies.condition)) fail(`${pk} applies "${applies.condition}", which the sheet has not`);
    }
    if (rider.damageType && !DAMAGE_TYPE_SET.has(rider.damageType)) {
      fail(`${pk} deals "${rider.damageType}", which is not one of the ruleset's damage types`);
    }
    // `applies` lands on anything the save did not turn aside, so a row that puts a condition on a
    // target without a save to resist it would be harsher than the SRD. Checked against the save the
    // entry will really carry, so a fixture that stopped stating one stops the build.
    if (rider.applies && !(rider.save ?? spellSave(pk, spell.fields))) {
      fail(`${pk} applies a condition with no saving throw to resist it`);
    }
  }
}

/** Which part of the action economy a casting time spends. A spell that takes longer than a turn
 *  spends nothing this block can name, so it is left out and falls back to the list's own budget. */
function spellBudget(fields) {
  if (fields.casting_time === "bonus-action") return BUDGET_BONUS;
  if (fields.casting_time === "reaction") return BUDGET_REACTION;
  return undefined;
}

/** A cantrip's damage read off the source's own per-character-level options: the EXTRA dice it
 *  throws at each level its count goes up, which is exactly what `scales.table` holds. Eldritch
 *  Blast has no such options in the source, because it adds beams rather than dice, so it correctly
 *  gets none. A table that raised a different die, or lowered a count, is left out rather than
 *  approximated. */
function spellScales(fields, options) {
  const base = DICE_PATTERN.exec(fields.damage_roll ?? "");
  if (fields.level !== 0 || !base) return undefined;
  const die = base[2];
  const first = Number(base[1]);
  const table = [[1, 0]];
  let previous = 0;
  for (let level = 2; level <= 20; level += 1) {
    const raised = DICE_PATTERN.exec(options.get(`player_level_${level}`)?.damage_roll ?? "");
    if (!raised) continue;
    if (raised[2] !== die) return undefined;
    const extra = Number(raised[1]) - first;
    if (extra < previous) return undefined;
    if (extra > previous) table.push([level, extra]);
    previous = extra;
  }
  return table.length > 1 ? { from: { field: "level" }, table } : undefined;
}

function spellMechanics(pk, fields, options, healing, rider) {
  // The fixture's own shape fields first, then the sentence the SRD prints for
  // a spell the fixture gives none for.
  const printed = SPELL_AREAS.get(pk);
  const area = SPELL_FIXTURE_SHAPES_NOT_AREAS.has(pk)
    ? undefined
    : fields.shape_type
      ? areaFrom(fields.shape_type, fields.shape_size, fields.name)
      : printed && areaFrom(printed.shape, printed.size, fields.name);
  // "Range: Self" names no distance to aim at, and for a spell that draws a SHAPE that is the
  // whole of it: the Engine sends a burst off on the caster's own cell and lets a cone or a line
  // be aimed anywhere within its own length, which is exactly what a spell starting at the caster
  // does. So a Self shape carries no range at all. "Range: Touch" is a different sentence: the
  // glyph is set down on something beside you, so it keeps its 0 and may be aimed one cell off.
  const selfShape = !!area && oneLine(fields.range_text).toLowerCase() === "self";
  const amount =
    rider?.amount ?? (fields.damage_roll ? amountFrom(fields.damage_roll, `Spell "${fields.name}"`) : undefined);
  // A spell that puts a condition on what it touches is a debuff even when it deals no damage, and
  // one that only hands out temporary points is a buff. Without that they would both read as
  // `utility`, which a fight leaves off the menu entirely.
  // A spell whose damage roll belongs to something other than what it does to a target is not an
  // attack at all, whatever the source's damage field says.
  const kind = SPELL_DAMAGE_NOT_ITS_OWN.has(pk)
    ? "utility"
    : (rider?.kind ?? (healing ? "heal" : amount ? "attack" : rider?.applies ? "debuff" : "utility"));
  return compact({
    // The source marks no spell as healing, so a heal is the hand-checked
    // HEALING_SPELLS table above rather than a guess at the wording. Everything
    // not in that table stays exactly what it was.
    kind,
    range: selfShape ? undefined : spellRange(fields, fields.name),
    area,
    targets: rider?.targets ?? (healing ? "ally" : undefined),
    amount: healing ? healing.amount : amount,
    damageType: rider?.damageType ?? fields.damage_types[0],
    attackRoll: fields.attack_roll || SPELL_ATTACK_ROLL_CORRECTIONS.has(pk) ? true : undefined,
    autoHit: rider?.autoHit,
    save: rider?.save ?? spellSave(pk, fields),
    applies: rider?.applies,
    temporary: rider?.temporary,
    // The source states how many creatures a spell may be pointed at, and states it only where the
    // SRD gives a number above one. A count a higher slot would raise is not carried: `perCostStep`
    // is an amount, and one more dart is not an amount.
    targetCount: rider?.targetCount ?? (fields.target_count > 1 ? fields.target_count : undefined),
    scales: spellScales(fields, options),
    cost: fields.level >= 1 ? [{ pool: `slots_${fields.level}`, amount: 1 }] : undefined,
    // A healing step comes from the table, which read it out of the spell's own
    // "At Higher Levels" paragraph; the source's slot options only carry damage.
    perCostStep: healing ? healing.perCostStep : spellPerCostStep(fields, options),
    concentration: fields.concentration ? true : undefined,
    reaction: fields.casting_time === "reaction" ? true : undefined,
    budget: spellBudget(fields),
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

/** Every hand-read area still names a spell the source has, still has no shape fields of its own,
 *  and still prints the sentence it was read from. A fixture that grew the shape would make the row
 *  a second opinion, and a sentence that changed would make it a stale one, so both stop the run. */
function assertSpellAreas(spells) {
  for (const [pk, printed] of SPELL_AREAS) {
    const spell = spells.find((entry) => entry.pk === pk);
    if (!spell) fail(`${pk} is written with a hand-read area but is not in the source`);
    if (spell.fields.shape_type) {
      fail(`${pk} now carries its own shape fields, so its hand-read area is a second opinion`);
    }
    if (!oneLine(spell.fields.desc).includes(printed.printed)) {
      fail(`${pk} no longer prints ${JSON.stringify(printed.printed)}, so its hand-read area is stale`);
    }
  }
  for (const pk of SPELL_SHAPES_NOT_AREAS.keys()) {
    if (!spells.some((entry) => entry.pk === pk)) fail(`${pk} is written as a printed shape that is not an area`);
    if (SPELL_AREAS.has(pk)) fail(`${pk} is both a carried area and one that is not an area`);
  }
  for (const [pk, entry] of SPELL_SAVES_BY_HAND) {
    const spell = spells.find((candidate) => candidate.pk === pk);
    if (!spell) fail(`${pk} has a hand-read saving throw but is not in the source`);
    if (SPELL_RIDERS.get(pk)?.save) fail(`${pk} has a hand-read save and a rider that states one too`);
    if (!spell.fields.saving_throw_ability) fail(`${pk} no longer states a saving throw for its reading to name`);
    if (!spell.fields.damage_roll) fail(`${pk} no longer deals damage, so there is nothing for its save to relieve`);
    if (!oneLine(spell.fields.desc).includes(entry.printed)) {
      fail(`${pk} no longer prints ${JSON.stringify(entry.printed)}, so its saving throw reading is stale`);
    }
  }
  for (const [pk, entry] of SPELL_DAMAGE_NOT_ITS_OWN) {
    const spell = spells.find((candidate) => candidate.pk === pk);
    if (!spell) fail(`${pk} is written as damage that is not its own but is not in the source`);
    // Two readings of the same spell would be one of them quietly losing.
    if (SPELL_RIDERS.has(pk)) fail(`${pk} is both a spell rider and damage that is not its own`);
    if (SPELL_SAVES_BY_HAND.has(pk)) fail(`${pk} has a hand-read save and damage that is not its own`);
    if (!spell.fields.damage_roll) fail(`${pk} no longer carries a damage roll, so it has nothing to leave out`);
    if (!oneLine(spell.fields.desc).includes(entry.printed)) {
      fail(`${pk} no longer prints ${JSON.stringify(entry.printed)}, so its reading is stale`);
    }
  }
  for (const [pk, printed] of SPELL_ATTACK_ROLL_CORRECTIONS) {
    const spell = spells.find((candidate) => candidate.pk === pk);
    if (!spell) fail(`${pk} is written as a missing attack roll but is not in the source`);
    if (spell.fields.attack_roll) fail(`${pk} now states its attack roll, so the correction is stale`);
    if (!oneLine(spell.fields.desc).toLowerCase().includes(printed.toLowerCase())) {
      fail(`${pk} no longer prints ${JSON.stringify(printed)}, so its attack roll correction is stale`);
    }
  }
  for (const [pk, entry] of SPELL_FIXTURE_SHAPES_NOT_AREAS) {
    const spell = spells.find((candidate) => candidate.pk === pk);
    if (!spell) fail(`${pk} is written as a fixture shape that is not an area but is not in the source`);
    if (!spell.fields.shape_type) {
      fail(`${pk} no longer states shape fields of its own, so it has nothing left to leave out`);
    }
    if (!oneLine(spell.fields.desc).includes(entry.printed)) {
      fail(`${pk} no longer prints ${JSON.stringify(entry.printed)}, so its reading is stale`);
    }
    if (SPELL_AREAS.has(pk)) fail(`${pk} is both a hand-read area and a fixture shape that is not an area`);
  }
}

function buildSpellEntries(spells, castingOptions, classNames, report) {
  assertHealingSpells(spells);
  assertSpellRiders(spells);
  assertSpellAreas(spells);
  return spells
    .map(({ pk, fields }) => {
      const classes = fields.classes.map((id) => classNames.get(id) ?? fail(`Spell "${fields.name}" names ${id}`));
      const mechanics = spellMechanics(
        pk,
        fields,
        castingOptions.get(pk) ?? new Map(),
        HEALING_SPELLS.get(pk),
        SPELL_RIDERS.get(pk),
      );
      assertSpellLands(pk, fields, mechanics);
      countSpellDistances(pk, fields, mechanics, report);
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
        mechanics,
      };
    })
    .sort(byId);
}

/**
 * What a fight can measure about one spell, counted for the build report.
 *
 * Only the spells a fight resolves are counted and scanned: a `utility` entry
 * and a reaction never reach a menu, so a shape printed in one of them costs
 * nobody anything. A resolvable spell that prints a shape and carries no area
 * has to be accounted for by one of the two tables above, or the run stops:
 * nothing is approximated silently, and nothing is dropped silently either.
 */
/**
 * Nothing a fight can pick deals damage with nobody rolling for it.
 *
 * An entry with an amount and no attack roll, no saving throw and no `autoHit` simply LANDS: the
 * resolver has nothing to check, so it takes off its whole damage every single time. For a spell
 * that really does land, `autoHit` says so out loud. For everything else that means either a save
 * the converter failed to read, which makes a spell far harsher than the page, or a damage roll
 * that was never the spell's own effect at all.
 *
 * Neither is something to discover by playing, so it stops the run here and the three tables above
 * are where the answer is written down, each with the sentence it came from.
 */
function assertSpellLands(pk, fields, mechanics) {
  if (mechanics.kind === "utility" || mechanics.kind === "heal" || mechanics.reaction) return;
  if (!mechanics.amount) return;
  if (mechanics.attackRoll || mechanics.save || mechanics.autoHit) return;
  fail(
    `Spell "${fields.name}" (${pk}) deals ${JSON.stringify(fields.damage_roll)} with no attack roll, no saving throw ` +
      "and no autoHit, so a fight would land all of it every time. Say which it is: a save in " +
      "SPELL_SAVES_BY_HAND, damage that is not its own in SPELL_DAMAGE_NOT_ITS_OWN, an attack the source " +
      "forgot in SPELL_ATTACK_ROLL_CORRECTIONS, or an autoHit in SPELL_RIDERS.",
  );
}

function countSpellDistances(pk, fields, mechanics, report) {
  if (mechanics.kind === "utility" || mechanics.reaction) return;
  const self = mechanics.area && oneLine(fields.range_text).toLowerCase() === "self";
  if (self) report.spellsFromTheCaster += 1;
  else if (mechanics.range === undefined) {
    report.spellsWithoutRange.push(`${fields.name} (${oneLine(fields.range_text)})`);
  } else report.spellsWithRange += 1;
  const text = oneLine(fields.desc);
  // A shape made of several boxes would otherwise ship as one burst a fraction of the printed size,
  // which is worse than shipping no shape at all. It has to be written down before it can be left
  // out, so a source that grows another one stops the run.
  if (BOXED_SHAPES.has(fields.shape_type) && SEVERAL_BOXES.test(text) && !SPELL_FIXTURE_SHAPES_NOT_AREAS.has(pk)) {
    fail(
      `Spell "${fields.name}" states one ${fields.shape_type} and its text says ${JSON.stringify(SEVERAL_BOXES.exec(text)[0])}. One box is not the shape, so say in SPELL_FIXTURE_SHAPES_NOT_AREAS why it carries none.`,
    );
  }
  if (mechanics.area) {
    const printed = fields.shape_type ?? SPELL_AREAS.get(pk)?.shape;
    report.spellAreasByShape.set(printed, (report.spellAreasByShape.get(printed) ?? 0) + 1);
    return;
  }
  const left = SPELL_FIXTURE_SHAPES_NOT_AREAS.get(pk);
  if (left) {
    report.spellAreasNotMapped.push(`${fields.name} - ${left.reason}`);
    return;
  }
  const match = PRINTED_SHAPE.exec(text);
  if (!match) return;
  const reason = SPELL_SHAPES_NOT_AREAS.get(pk);
  if (!reason) {
    fail(
      `Spell "${fields.name}" prints ${JSON.stringify(match[0])} and carries no area. Add it to SPELL_AREAS, or say in SPELL_SHAPES_NOT_AREAS why that shape is not an area.`,
    );
  }
  report.spellAreasNotMapped.push(`${fields.name} - ${reason}`);
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

/**
 * How far one weapon row reaches and carries, in feet, for the three distance
 * columns of the attacks list.
 *
 * SRD 5.1, Melee Attacks: "you can attack a target within 5 feet of you". The
 * Reach property: "This weapon adds 5 feet to your reach when you attack with
 * it." Range: "A weapon that can be used to make a ranged attack has a range in
 * parentheses after the ammunition or thrown property. The range lists two
 * numbers." A weapon under the SRD's own Ranged Weapons heading is shot rather
 * than swung, so it reaches nothing and only carries; a thrown melee weapon
 * carries BOTH, exactly as the table prints it.
 *
 * Nothing here is typed: the two numbers are the fixture's own, and the fixture
 * is cross-checked against the properties it also carries, so a weapon that
 * grew or lost a range without the matching property stops the run.
 */
function weaponDistances(pk, fields, properties) {
  const ranged = RANGED_WEAPONS.has(pk);
  const thrown = properties.includes("Thrown");
  if (fields.range > 0 !== (ranged || thrown)) {
    fail(
      `${fields.name} has range ${fields.range} in the source but is ${ranged || thrown ? "" : "neither "}listed as a ranged weapon ${ranged || thrown ? "or thrown" : "nor thrown"}`,
    );
  }
  if (fields.long_range > 0 && fields.long_range < fields.range) {
    fail(`${fields.name} has a long range of ${fields.long_range} below its ordinary ${fields.range}`);
  }
  if (fields.range > 0 && fields.long_range <= 0) fail(`${fields.name} has a range but no long range`);
  return {
    [ATTACK_REACH_COLUMN]: ranged ? 0 : properties.includes("Reach") ? 10 : 5,
    [ATTACK_RANGE_COLUMN]: fields.range,
    [ATTACK_LONG_RANGE_COLUMN]: fields.long_range,
  };
}

/** Which of the four kinds of distance a weapon row carries, for the build report. */
function weaponDistanceKind(distances) {
  const swings = distances[ATTACK_REACH_COLUMN] > 0;
  const carries = distances[ATTACK_RANGE_COLUMN] > 0;
  if (swings && carries) return "thrown";
  if (carries) return "ranged";
  return distances[ATTACK_REACH_COLUMN] > 5 ? "reach" : "melee";
}

function buildWeaponEntries(weapons, propertiesByWeapon, report) {
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
      const distances = weaponDistances(pk, fields, properties);
      report.weaponsByDistance[weaponDistanceKind(distances)] += 1;
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
              ...distances,
            },
          },
        ],
        mechanics: compact({
          kind: "attack",
          // The one distance an entry's own mechanics can hold, read off the
          // same columns the row carries: how far a ranged or thrown weapon
          // carries, and how far anything else reaches.
          range: distances[ATTACK_RANGE_COLUMN] > 0 ? distances[ATTACK_RANGE_COLUMN] : distances[ATTACK_REACH_COLUMN],
          amount,
          damageType: fields.damage_type,
          attackRoll: true,
        }),
      };
    })
    .sort(byId);
}

// ── Creatures ──
//
// A bestiary entry is written entirely in the keys the `combat` block declares,
// and every number in it is read out of the PRINTED action text. The structured
// attack row is used for two things only: it says which actions are attacks at
// all (every action with `Hit:` has one, and nothing else does), and its
// `to_hit_mod` is cross-checked against the text. Its damage type, flat bonus
// and dice are not read, because they are wrong on most rows.
//
// Everything the creature format cannot say becomes a trait the Game Master is
// shown and a line in the build report. Nothing is ever approximated silently.

/** How many actions and traits one creature may carry, mirrored from the Engine's schema so the
 *  converter trims to fit rather than emitting a block the Engine would refuse. */
const CREATURE_MAX_ACTIONS = RULESET_CREATURE_MAX_ACTIONS;
const CREATURE_MAX_TRAITS = RULESET_CREATURE_MAX_TRAITS;
const TRAIT_NAME_MAX = 60;
const TRAIT_TEXT_MAX = 400;
const CREATURE_SUMMARY_MAX = 300;

// "The dragon can take 3 legendary actions, choosing from the options below." Every SRD 5.1 stat
// block with legendary actions says three, and the fixtures carry the per-action cost but not the
// pool it is spent from, so the pool is stated here once. assertLegendaryCosts fails the run if a
// creature ever prints an option that costs more than the pool holds.
const LEGENDARY_POINTS = 3;

const ABILITY_BY_SAVE_NAME = Object.freeze({
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
});

// The SRD prints its bestiary alphabetically and cross-references some creatures under a second
// heading: "Elf, Drow" is an index entry pointing at the Drow's stat block, not a second creature.
// The fixture models both headings as records, so the index entry arrives as a stub with the real
// one's name, armour class, hit points and actions, and none of its hit dice, speed or challenge
// rating. Shipping both would put the same creature in the bestiary twice.
//
// An alias is left out and said in the build report. assertCreatureAliases below fails the run when
// either side leaves the source, when the alias grows hit dice of its own (it is then no longer a
// stub, and somebody has to look at it), or when the two stop printing the same actions. Nothing
// here corrects a number: the canonical record already holds every one of them.
const CREATURE_ALIASES = new Map([
  ["srd_elf-drow", "srd_drow"],
  ["srd_gnome-deep-svirfneblin", "srd_deep-gnome-svirfneblin"],
]);

// Things the SRD really prints that look like converter bugs, kept here so nobody "corrects" the
// data later. The printed text is the truth, and these are the places it surprises a reader:
//
// - The Ancient Green Dragon claws for 22 (4d6 + 8) where every other ancient dragon claws for
//   2d6 + 8. SRD 5.1 prints 4d6 for that one dragon, so 4d6 is what ships.
// - A thrown weapon's melee and ranged rows carry the same numbers, so the first row stands for the
//   printed action and the second is not a second attack.
// - Eldritch Blast has no per-level damage options in the source, because it adds beams rather than
//   dice, so it correctly gets no `scales` while every other damaging cantrip does.

// The SRD's own counting words, which is how a Multiattack says how many times it strikes.
const COUNT_WORDS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
});

// A damage clause as the SRD prints it: `15 (3d6 + 5) bludgeoning damage`, or the bare `1 piercing
// damage` a few tiny creatures deal. The word in front of it decides what it is: `plus` adds a
// second helping of damage, `or` offers an alternative the fight has no way to choose between.
const DAMAGE_CLAUSE =
  /(plus|or|and)?\s*(\d{1,3})\s*\(\s*(\d{1,3})d(\d{1,3})(?:\s*([+-])\s*(\d{1,3}))?\s*\)\s+([a-z]+(?:\s+[a-z]+)?)\s+damage/giu;
const BARE_DAMAGE_CLAUSE = /(plus|or|and)?\s*(?:^|[\s,:])(\d{1,3})\s+([a-z]+)\s+damage/giu;
const TO_HIT = /([+-]\d{1,3})\s+to hit/iu;
const REACH = /reach\s+(\d{1,3})\s*(?:ft|feet)/iu;
const RANGE = /range\s+(\d{1,4})(?:\/(\d{1,4}))?\s*(?:ft|feet)/iu;

// "The dragon exhales fire in a 60-foot cone." A creature action carries the shape it lands in, so
// that sentence ships as a real cone on a board, aimed and resolved exactly as a spell's own area
// is. `targetCount` below stays beside it, because that is what a fight WITHOUT a board reads.
//
// The size is the number the stat block prints, in feet. A shape with no aiming distance of its own
// carries no `range`, which the Engine reads as aimed from where the creature stands.
// Loose about its punctuation on purpose: the SRD prints "60-foot cone", "10 -foot radius", "a line
// that is 30 ft. long" and "a line of lightning that is 20 ft. long", and all four say the same
// thing.
const PRINTED_AREA =
  /(\d{1,4})\s*-?\s*foot\s*-?\s*(radius|cone|line|cube|square|sphere|cylinder)|\bline\b(?:\s+of\s+\w+)?\s+(?:that is\s+)?(\d{1,4})\s*(?:ft\.?|feet)\s+long/iu;

function printedArea(text) {
  const match = PRINTED_AREA.exec(text);
  if (!match) return undefined;
  return { shape: (match[2] ?? "line").toLowerCase(), size: Number(match[1] ?? match[3]) };
}

// "Each creature of the dragon's choice that is within 120 feet of the dragon ... must succeed on a
// DC 16 Wisdom saving throw." A stat block writes the distance of an aura, a presence or a thrown
// bolt this way rather than as a range, and the FIRST one in the text is always the sentence that
// says who has to save: the rest, where there is a rest, are a radius around the point it landed on.
// Read only when the block prints no range of its own, so it never overrides one. A shape may have
// one too ("a cylinder ... on a point the djinni can see within 120 feet of it"), and then it is
// how far off that shape may be aimed.
const PRINTED_WITHIN = /within\s+(\d{1,4})\s*(?:ft|feet)/iu;

function printedWithin(text) {
  const match = PRINTED_WITHIN.exec(text);
  return match ? Number(match[1]) : undefined;
}

// A shape catches everybody standing in it, friend and foe, unless the stat block's own sentence
// says otherwise. These are the two SRD 5.1 actions whose printed text keeps the shape off the
// creature's own side, each with the fragment it was read from; `friendlyFire: false` is what the
// format says it with. Every OTHER printed shape in the bestiary catches everybody, which is what
// the SRD means by "Each creature in that area".
const CREATURE_AREAS_SPARING_THEIR_OWN = new Map([
  // "Each creature other than the kraken that ends its turn there must succeed on a DC 23
  // Constitution saving throw..."
  ["srd_kraken_ink-cloud", "other than the kraken"],
  // "Each creature of its choice in a 10 -foot radius must make a DC 23 Dexterity saving throw..."
  ["srd_solar_searing-burst", "of its choice"],
]);

// Wording that says a shape does NOT simply catch everybody standing in it. Deliberately loose: it
// only has to notice the sentence so the table above has to account for it, and a shape whose text
// says something new stops the run rather than quietly frying the creature's own pack.
const AREA_SPARES_SOMEBODY = /other than|isn't a\b|aren't\b|of its choice|excluding|except/iu;

/** Whether a printed shape spares the creature's own side, as `friendlyFire` says it. */
function creatureAreaSparing(pk, text, label) {
  const printed = CREATURE_AREAS_SPARING_THEIR_OWN.get(pk);
  if (printed) {
    if (!text.includes(printed)) {
      fail(`${label} no longer prints ${JSON.stringify(printed)}, so its friendlyFire reading is stale`);
    }
    return { friendlyFire: false };
  }
  const match = AREA_SPARES_SOMEBODY.exec(text);
  if (match) {
    fail(
      `${label} (${pk}) lands in a shape and its text says ${JSON.stringify(match[0])}. Decide whether it spares the creature's own side and say so in CREATURE_AREAS_SPARING_THEIR_OWN.`,
    );
  }
  return {};
}

/** A printed "range 20/60 ft." as a creature action writes its distance: a plain number when the
 *  stat block prints one, and the pair when it prints both. Never invented: a block that prints no
 *  range at all carries none. */
function printedRange(match, label) {
  if (!match) return undefined;
  const normal = Number(match[1]);
  if (match[2] === undefined) return normal;
  const long = Number(match[2]);
  if (long < normal) fail(`${label} prints a long range of ${long} below its ordinary ${normal}`);
  return { normal, long };
}
const SAVE_DC = /DC\s*(\d{1,3})\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/iu;
const HALF_ON_SUCCESS = /half as much damage on a success/iu;
const REPEATS_SAVE = /saving throw at the end of (?:each of its turns|its next turn)/iu;
// "**Fire Breath.** ... **Weakening Breath.** ...": one printed action that is really several,
// sharing one recharge.
const OPTION_HEADING = /\*\*([^*]{1,60}?)\*\*/gu;
// "or be poisoned", "or become frightened", "or be knocked prone", "and is restrained". Deliberately
// narrow: a condition merely mentioned in passing ("poisoned until the disease is cured") is not a
// condition this action applies.
const APPLIES_CONDITION = new RegExp(
  String.raw`\b(?:or|and)\s+(?:the\s+\w+\s+)?(?:be|is|becomes?|become|fall|falls)\s+(?:knocked\s+|magically\s+)?(${CONDITIONS.join("|")})\b`,
  "giu",
);
// An attack whose whole effect is a condition states it flatly: "Hit: The target is restrained by
// webbing." Only read where there is no damage at all, because anywhere else this would pick up a
// condition the sentence merely mentions.
const STATED_CONDITION = new RegExp(String.raw`\b(?:is|are|becomes?)\s+(${CONDITIONS.join("|")})\b`, "giu");
const DURATION_MINUTES = /for\s+(\d{1,3})\s+minutes?\b/iu;

/** Plain text a `promptSafeText` field will take: one line, no square brackets, no macro braces and
 *  no Markdown emphasis, because a trait is read by a person and not by a parser. */
function plainText(text) {
  return oneLine(text)
    .replace(/\*\*/gu, "")
    .replace(/[[\]]/gu, "")
    .replace(/\{\{|\}\}/gu, "")
    .trim();
}

/** One line the Game Master is shown. `kind` is only for the build report, and is dropped before the
 *  trait is written, so the report can say what each trait is standing in for. */
function trait(kind, name, text) {
  const line = plainText(text);
  if (!line) return undefined;
  return {
    kind,
    name: trimToSentence(plainText(name), TRAIT_NAME_MAX),
    text: trimToSentence(line, TRAIT_TEXT_MAX, TRUNCATION_NOTE),
  };
}

/** A sheet id from a creature's own name, so `srd_adult-red-dragon_fire-breath` becomes an action id
 *  the block can point a sequence at. Ids are lowercase letters, digits and underscores. */
function actionId(pk, parent) {
  const id = String(pk)
    .replace(`${parent}_`, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 40);
  return /^[a-z][a-z0-9_]*$/u.test(id) ? id : `action_${id}`.slice(0, 40);
}

function averageOf(amount) {
  if (!amount) return 0;
  return (amount.count ?? 0) * (((amount.sides ?? 0) + 1) / 2) + (amount.flat ?? 0);
}

/** The damage clauses one piece of text prints, in the order it prints them, each with the word that
 *  joined it to the one before. */
function damageClauses(text) {
  const found = [];
  for (const pattern of [DAMAGE_CLAUSE, BARE_DAMAGE_CLAUSE]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const bare = pattern === BARE_DAMAGE_CLAUSE;
      // The bare pattern also matches the printed average in front of a dice clause, so anything
      // overlapping a clause the dice pattern already found is dropped rather than counted twice.
      if (bare && found.some((clause) => match.index >= clause.at - 2 && match.index <= clause.at + clause.length)) {
        continue;
      }
      found.push(
        bare
          ? {
              at: match.index,
              length: match[0].length,
              joiner: match[1],
              count: 0,
              sides: 0,
              flat: Number(match[2]),
              type: match[3],
            }
          : {
              at: match.index,
              length: match[0].length,
              joiner: match[1],
              count: Number(match[3]),
              sides: Number(match[4]),
              flat: match[5] ? (match[5] === "-" ? -1 : 1) * Number(match[6]) : 0,
              type: match[7],
            },
      );
    }
  }
  return found.sort((left, right) => left.at - right.at).filter((clause) => DAMAGE_TYPE_SET.has(clause.type));
}

function damageFrom(clause) {
  return compact({
    dice: clause.count > 0 ? `${clause.count}d${clause.sides}` : undefined,
    flat: clause.flat !== 0 || clause.count === 0 ? clause.flat : undefined,
    type: clause.type,
  });
}

/** How long a condition this text applies lasts: the repeated save the SRD states, then its own
 *  stated minutes, and otherwise no clock of its own.
 *
 *  `window` is the save clause, so the clock belongs to the condition rather than to some later
 *  sentence; `full` is the whole action, because the sentence that grants the repeated save is the
 *  one after it and is never about anything else. A duration the SRD prints in hours or days
 *  outlasts every fight, so it is read as "until something takes it off" rather than as a count of
 *  rounds nobody would reach. */
function appliesDuration(window, full, ability) {
  if (REPEATS_SAVE.test(full)) {
    return { duration: "until-save", saveEnds: { save: `${ability}_save`, at: "turn-end" } };
  }
  const minutes = DURATION_MINUTES.exec(window);
  if (minutes) return { duration: { rounds: Number(minutes[1]) * ROUNDS_PER_MINUTE } };
  return { duration: "instant" };
}

/** The part of an action's text that belongs to its saving throw: the sentence that names the
 *  difficulty, plus the one after it when that one says what a failure brings.
 *
 *  Anything further on is a knock-on the action does not itself apply: the giant spider's paralysis
 *  only follows its poison dropping somebody to zero, and the cockatrice's petrification only
 *  follows a second failed save. Reading the whole paragraph would put both on a target that never
 *  met their condition. */
function saveClause(text, at) {
  const rest = text.slice(at);
  const first = /[.!?](?:\s|$)/u.exec(rest);
  const end = first ? first.index + 1 : rest.length;
  const after = rest.slice(end);
  if (!/^\s*On a fail/iu.test(after)) return rest.slice(0, end);
  const second = /[.!?](?:\s|$)/u.exec(after);
  return rest.slice(0, end + (second ? second.index + 1 : after.length));
}

/** The conditions an action's own saving throw puts on what it touches, in the order it names them. */
function appliedConditions(text, at, ability) {
  const window = saveClause(text, at);
  const found = [];
  APPLIES_CONDITION.lastIndex = 0;
  let match;
  while ((match = APPLIES_CONDITION.exec(window))) {
    const condition = match[1].toLowerCase();
    if (!found.some((entry) => entry.condition === condition)) {
      found.push({ condition, ...appliesDuration(window, text, ability) });
    }
  }
  return found.slice(0, 4);
}

/** One creature action, as far as the format can say it, plus the trait lines for everything it
 *  could not. `null` means the action itself is nothing a fight could resolve.
 *
 *  `hiddenDamage` says that some of what this printed action DEALS ended up in a trait rather than
 *  in the block. The threat scale reads it: a creature whose hitting is partly written in prose
 *  cannot be measured for damage, because its actions no longer say what it does in a round. */
function creatureAction(action, attackRow, report) {
  const parent = action.fields.parent;
  const name = plainText(action.fields.name);
  // Kept with its emphasis markers, because they are what marks a block of options apart.
  const marked = oneLine(action.fields.desc);
  const full = plainText(marked);
  const id = actionId(action.pk, parent);
  const notes = [];
  let hiddenDamage = false;
  // A block of options is several actions sharing one recharge, which the format has no way to
  // hold. The first is the action; the rest are traits.
  const headings = [...marked.matchAll(OPTION_HEADING)];
  let label = name;
  let text = full;
  if (headings.length > 1 && !attackRow) {
    const first = headings[0];
    const second = headings[1];
    label = plainText(first[1]).replace(/\.$/u, "");
    text = plainText(marked.slice(first.index + first[0].length, second.index));
    notes.push(trait("other options of one printed action", name, marked.slice(second.index)));
    report.optionBlocksSplit += 1;
    if (damageClauses(plainText(marked.slice(second.index))).length > 0) hiddenDamage = true;
  }
  text = plainText(text);

  const hitAt = text.search(/\bHit:/u);
  const effect = attackRow && hitAt >= 0 ? text.slice(hitAt) : text;
  const clauses = damageClauses(effect);
  const primary = clauses[0];
  const dropped = clauses.slice(1);

  if (attackRow) {
    const printed = TO_HIT.exec(text);
    if (!printed) {
      report.attacksWithoutPrintedToHit.push(action.pk);
      return { action: null, notes, hiddenDamage: hiddenDamage || clauses.length > 0 };
    }
    const toHit = Number(printed[1]);
    if (toHit !== attackRow.to_hit_mod) report.toHitDisagreements.push(action.pk);
    if (primary) {
      const rowSays =
        attackRow.damage_die_count !== null &&
        attackRow.damage_die_type !== null &&
        (attackRow.damage_die_count !== primary.count || `D${primary.sides}` !== attackRow.damage_die_type);
      if (rowSays) report.diceDisagreements.push(action.pk);
      if (attackRow.damage_type && attackRow.damage_type.toLowerCase() !== primary.type) {
        report.damageTypeDisagreements += 1;
      }
    }
    const save = SAVE_DC.exec(effect);
    const ability = save ? ABILITY_BY_SAVE_NAME[save[2].toLowerCase()] : undefined;
    const conditions = ability ? appliedConditions(effect, save.index, ability) : [];
    // A hit that deals no damage at all does whatever the sentence says flatly, with no save to make
    // first, which is what the SRD's webs and tendrils do. Escaping one is a Strength CHECK against
    // an action, not a saving throw, so the condition carries no clock and the printed escape rides
    // along as a trait.
    if (!primary && conditions.length === 0) {
      STATED_CONDITION.lastIndex = 0;
      for (const match of effect.matchAll(STATED_CONDITION)) {
        const condition = match[1].toLowerCase();
        if (conditions.length < 4 && !conditions.some((entry) => entry.condition === condition)) {
          conditions.push({ condition, duration: "instant" });
        }
      }
      if (conditions.length > 0) {
        notes.push(trait("how a condition an attack applies is escaped", label, effect));
        report.attacksThatOnlyApplyAConditionCount += 1;
      }
    }
    // A rider that deals its own damage on a failed save is a second helping of damage with its own
    // roll, which one action cannot hold, so the sentence is kept as a trait instead.
    const riderDamage = save && dropped.some((clause) => clause.at > save.index);
    const reach = REACH.exec(text);
    const range = RANGE.exec(text);
    const built = compact({
      id,
      name: label,
      budget: BUDGET_ACTION,
      toHit,
      damage: primary ? damageFrom(primary) : undefined,
      // A save on an ATTACK never relieves the damage: the blow already landed. `none` is what says
      // that a success only keeps the rider condition off.
      save:
        ability && conditions.length > 0
          ? { save: `${ability}_save`, difficulty: Number(save[1]), onSuccess: "none" }
          : undefined,
      applies: conditions.length > 0 ? conditions : undefined,
      // "Melee Weapon Attack: +4 to hit, reach 5 ft." is the reach the block prints; an attack that
      // only ever carries prints a range and no reach at all. A thrown weapon prints both, and this
      // carries both, exactly as the stat block does.
      reach: reach ? Number(reach[1]) : range ? undefined : 5,
      range: printedRange(range, label),
    });
    if (!built.damage && !built.applies) {
      report.attacksWithNothingToResolve.push(action.pk);
      return {
        action: null,
        notes: [...notes, trait("a printed action nothing can resolve", name, full)],
        hiddenDamage: hiddenDamage || clauses.length > 0,
      };
    }
    for (const clause of dropped) {
      if (clause.joiner?.toLowerCase() === "plus") report.foldedRiders += 1;
      else report.alternativeClauses += 1;
    }
    // A rider save this format cannot roll without also relieving the damage, or one whose effect is
    // not a condition the sheet has, is kept as a trait so the rule is still in front of the Game
    // Master rather than quietly gone.
    const carried = conditions.length > 0 && !riderDamage;
    if (dropped.length > 0 || riderDamage || (ability && !carried)) {
      notes.push(trait(dropped.length > 0 ? "a damage clause one roll cannot hold" : "a rider save", label, effect));
    }
    if (ability && !carried) report.riderSavesNotCarried += 1;
    return { action: built, notes, hiddenDamage };
  }

  // Not an attack. A save the text states is the whole of it: the damage it deals, what a success
  // does about that damage, and the conditions a failure brings.
  const save = SAVE_DC.exec(text);
  if (!save) {
    report.actionsWithNeitherAttackNorSave += 1;
    // Only a printed action that DEALS something hides damage. A summons, an aura or a stare hides
    // nothing a round's worth of damage would have counted.
    return {
      action: null,
      notes: [...notes, trait("a printed action nothing can resolve", name, full)],
      hiddenDamage: hiddenDamage || clauses.length > 0,
    };
  }
  const ability = ABILITY_BY_SAVE_NAME[save[2].toLowerCase()];
  const conditions = appliedConditions(text, save.index, ability);
  const onSuccess = HALF_ON_SUCCESS.test(text) ? "half" : "negates";
  const printedDistance = printedRange(RANGE.exec(text), label);
  const printedShape = printedArea(text);
  const area = printedShape
    ? { ...areaFrom(printedShape.shape, printedShape.size, label), ...creatureAreaSparing(action.pk, text, label) }
    : undefined;
  const within = printedDistance === undefined ? printedWithin(text) : undefined;
  if (within !== undefined) report.creatureActionsFromWithin += 1;
  const built = compact({
    id,
    name: label,
    budget: BUDGET_ACTION,
    damage: primary ? damageFrom(primary) : undefined,
    save: { save: `${ability}_save`, difficulty: Number(save[1]), onSuccess },
    applies: conditions.length > 0 ? conditions : undefined,
    // An area action reaches more than one target, and the creature format has no shape to count
    // them with, so the count is the conservative one the SRD's own shapes suggest. It is what the
    // Engine reads with a board and without one alike: `targetCount` is only ignored for an entry
    // that carries a real `area`, and a creature action never can.
    targetCount: primary || conditions.length > 0 ? areaTargets(text) : undefined,
    // The printed aiming distance where the block states one, and otherwise the distance the
    // sentence itself names, so a presence felt at 120 feet is not read as something that only
    // reaches the next cell. A shape that names neither is aimed from where the creature stands.
    range: printedDistance ?? within,
    area,
  });
  if (!built.damage && !built.applies) {
    report.savesWithNothingToResolve.push(action.pk);
    return {
      action: null,
      notes: [...notes, trait("a printed action nothing can resolve", name, full)],
      hiddenDamage: hiddenDamage || clauses.length > 0,
    };
  }
  for (const clause of dropped) {
    if (clause.joiner?.toLowerCase() === "plus") report.foldedRiders += 1;
    else report.alternativeClauses += 1;
  }
  if (dropped.length > 0) notes.push(trait("a damage clause one roll cannot hold", label, text));
  return { action: built, notes, hiddenDamage };
}

// How many targets one area action is pointed at. A fight has no positions yet, so nothing can count
// who is standing in a cone: these are deliberately conservative numbers for the shapes the SRD
// prints, chosen once here and said in the README rather than guessed per creature.
const AREA_TARGETS = Object.freeze([
  { pattern: /\bline\b/iu, targets: 2 },
  { pattern: /\bcone\b/iu, targets: 3 },
  { pattern: /\b(?:radius|sphere|cube|cylinder)\b/iu, targets: 3 },
  { pattern: /each creature\b/iu, targets: 2 },
]);

function areaTargets(text) {
  for (const { pattern, targets } of AREA_TARGETS) if (pattern.test(text)) return targets;
  return undefined;
}

// ── Multiattack ──
//
// The SRD writes a Multiattack as prose. These are the SHAPES that prose really uses, tried in
// order, and every one of them is general: nothing here knows a creature by name. A sentence whose
// shape is not among them falls back to the creature's own single attacks and is listed in the
// build report, and whatever the sentence says beyond its strikes always stays a trait.
//
// A sentence may offer alternatives ("three melee attacks or two ranged attacks"), and each becomes
// its own sequence action, named so a Game Master can tell them apart.

const COUNT_WORD = Object.keys(COUNT_WORDS).join("|");
// "two with its claws", and the SRD's other way of saying it: "one to constrict".
const MULTI_PART = new RegExp(
  String.raw`^\s*(${COUNT_WORD})\s+(?:with\s+(?:its|his|her|their)|to)\s+([a-z' ]+?)\s*$`,
  "iu",
);
const MULTI_WITH_WEAPON = new RegExp(
  String.raw`\b(?:makes?|make)\s+(${COUNT_WORD})\s+attacks?\s+with\s+(?:its|his|her|their)\s+([a-z' ]+?)(?=[,.;]|\s+and\b|\s+or\b|$)`,
  "giu",
);
const MULTI_COUNTED = new RegExp(String.raw`\b(${COUNT_WORD})\s+([a-z' ]*?)\s*attacks?\b`, "iu");
const MULTI_NAMED_PARTS = new RegExp(
  String.raw`\b(?:makes?|make)\s+(?:either\s+)?(?:${COUNT_WORD})\s+(?:melee\s+|ranged\s+|weapon\s+)?attacks?\s*[:,-]\s*(.+)$`,
  "iu",
);
// "makes three attacks, either with its longsword or its longbow": one count, two weapons, and the
// creature picks. Read before the sentence is split on "or", which would cut it in half.
const MULTI_EITHER_WITH = new RegExp(
  String.raw`\b(?:makes?|make)\s+(${COUNT_WORD})\s+attacks?,?\s+either\s+with\s+(?:its|his|her|their)\s+([a-z' ]+?)\s+or\s+(?:with\s+)?(?:its|his|her|their)\s+([a-z' ]+?)(?=[,.;]|$)`,
  "iu",
);
// "makes two attacks, only one of which can be a bite attack": one named strike, and anything else
// for the rest.
const MULTI_ONLY_ONE = new RegExp(
  String.raw`only\s+one\s+of\s+which\s+can\s+be\s+(?:a|an|with)?\s*(?:its|his|her|their)?\s*([a-z' ]+?)(?:\s+attack)?(?=[,.;]|$)`,
  "iu",
);
// "makes as many bite attacks as it has heads", with the count printed in a trait of its own.
const MULTI_AS_MANY = new RegExp(String.raw`as\s+many\s+([a-z' ]+?)\s+attacks?\s+as\s+it\s+has\s+(\w+)`, "iu");
const MULTI_HEAD_COUNT = new RegExp(String.raw`\bhas\s+(${COUNT_WORD})\s+(\w+)`, "iu");
// "can use its Dreadful Glare and makes one attack with its rotting fist": joined by "and" in the
// same clause, so it is part of the round. An opener in its own sentence, or hedged with "if it
// can", is an option the creature may take instead, and stays a trait.
const MULTI_AND_USES = /\b(?:can\s+use|uses)\s+(?:its|his|her|their)\s+([a-z' ]+?)\s+and\s+(?:makes?|make)\b/iu;
const MULTI_DIFFERENT = /each\s+one\s+with\s+a\s+different\s+weapon/iu;
const MULTI_PARENTHETICAL = /\(([^)]{1,40})\)/gu;
const MULTI_SENTENCE_WITH_MAKES = /(?:^|(?<=[.;]\s))[^.;]*\b(?:makes?|make)\b[^.;]*/iu;
// Where a printed Multiattack says more than its strikes, which is what decides whether the whole
// sentence still has to ride along as a trait.
const MULTI_RIDER = /\b(?:or|alternatively|instead|it can|if |while |each of which|only one of which)\b/iu;

/** The numbers a creature's own traits print of itself, keyed by the thing counted: "The hydra has
 *  five heads" is what makes "as many bite attacks as it has heads" a number. Read from the traits
 *  rather than typed here, so a creature that prints a different count gets that count. */
function headCounts(traits) {
  const counts = new Map();
  for (const source of traits) {
    const match = MULTI_HEAD_COUNT.exec(plainText(source.fields.desc));
    if (!match) continue;
    const thing = oneLine(match[2]).toLowerCase().replace(/s$/u, "");
    if (!counts.has(thing)) counts.set(thing, COUNT_WORDS[match[1].toLowerCase()]);
  }
  return counts;
}

/** Which of this creature's own actions a printed part names ("two with its claws"). */
function namedAttack(word, attacks) {
  const wanted = oneLine(word).toLowerCase().replace(/s$/u, "");
  if (!wanted) return null;
  const plain = (name) => name.toLowerCase().replace(/s$/u, "");
  return (
    attacks.find((entry) => entry.name.toLowerCase() === wanted) ??
    attacks.find((entry) => plain(entry.name) === wanted) ??
    attacks.find((entry) => plain(entry.name).endsWith(` ${wanted}`)) ??
    attacks.find((entry) => plain(entry.name).startsWith(`${wanted} `)) ??
    null
  );
}

/** What one action does on average, for picking the best of a kind. */
function strikeAverage(action) {
  return averageOfDamage(action);
}

/** The heaviest attack of a list, with the block's own printed order breaking a tie so a rebuild
 *  always picks the same one. */
function bestStrike(list) {
  let best = null;
  for (const action of list) {
    if (!best || strikeAverage(action) > strikeAverage(best)) best = action;
  }
  return best;
}

/** The strikes of one block, split by the kind of attack they are. A thrown weapon reaches and
 *  throws, so it counts as both, exactly as the SRD's own "melee or ranged" line says. */
function strikesOf(attacks) {
  const strikes = attacks.filter((action) => action.toHit !== undefined && action.damage);
  return {
    all: attacks,
    strikes,
    melee: strikes.filter((action) => action.reach !== undefined),
    ranged: strikes.filter((action) => action.range !== undefined),
  };
}

/** What to call an alternative that names several actions: the first one it strikes with, which is
 *  what a Game Master reads it by ("Multiattack (pike)" beside "Multiattack (longbow)"). */
function leadingName(steps, block) {
  const first = block.all.find((action) => action.id === steps[0]?.action);
  return first ? first.name.toLowerCase() : undefined;
}

/** The strikes one alternative of a printed sentence asks for, or null when its shape is not one of
 *  the ones below. `suffix` names the alternative when there is more than one. */
function multiattackChunk(chunk, block, headCounts) {
  const labels = [...chunk.matchAll(MULTI_PARENTHETICAL)].map((match) => oneLine(match[1]).toLowerCase());
  const text = chunk.replace(MULTI_PARENTHETICAL, " ");
  // What to call this alternative: the form the SRD names in brackets, then the kind of attacks it
  // asks for, then whatever the branch itself worked out.
  const kindWord = /\b(melee|ranged)\b/iu.exec(text)?.[1].toLowerCase();
  const suffixFrom = (fallback) => labels[0] ?? kindWord ?? fallback;

  // "as many bite attacks as it has heads", with the number printed in a trait.
  const asMany = MULTI_AS_MANY.exec(text);
  if (asMany) {
    const attack = namedAttack(asMany[1], block.all);
    const times = headCounts.get(oneLine(asMany[2]).toLowerCase().replace(/s$/u, ""));
    if (!attack || !times) return null;
    return { shape: "as many as it has", steps: [{ action: attack.id, times }], suffix: suffixFrom(undefined) };
  }

  // "only one of which can be a bite attack": the named strike once, and the best of the rest once.
  const onlyOne = MULTI_ONLY_ONE.exec(text);
  if (onlyOne) {
    const limited = namedAttack(onlyOne[1], block.strikes);
    if (!limited) return null;
    const other = bestStrike(block.strikes.filter((action) => action.id !== limited.id));
    if (!other) return null;
    return {
      shape: "only one of which",
      steps: [
        { action: limited.id, times: 1 },
        { action: other.id, times: 1 },
      ],
      suffix: suffixFrom(undefined),
    };
  }

  // "one with its bite and two with its claws", the SRD's most common shape. The parts are read out
  // of whatever follows the count, and out of the chunk itself when an alternative carries the parts
  // without repeating the "makes two attacks" in front of them.
  const named = MULTI_NAMED_PARTS.exec(text);
  {
    const steps = [];
    for (const fragment of (named ? named[1] : text).split(/,|\band\b/iu)) {
      // The SRD sets an aside in dashes ("three melee attacks - one with its snake hair - or ..."),
      // which belong to the sentence rather than to the part.
      const part = MULTI_PART.exec(fragment.replace(/[-.;]+/gu, " "));
      if (!part) continue;
      const attack = namedAttack(part[2], block.all);
      if (!attack) return null;
      steps.push({ action: attack.id, times: COUNT_WORDS[part[1].toLowerCase()] });
    }
    if (steps.length > 0) {
      return { shape: "named parts", steps, suffix: suffixFrom(leadingName(steps, block)) };
    }
  }

  // "makes four attacks with its tendrils ... and makes one attack with its bite".
  MULTI_WITH_WEAPON.lastIndex = 0;
  const withWeapon = [...text.matchAll(MULTI_WITH_WEAPON)];
  if (withWeapon.length > 0) {
    const steps = [];
    for (const match of withWeapon) {
      const attack = namedAttack(match[2], block.all);
      if (!attack) return null;
      steps.push({ action: attack.id, times: COUNT_WORDS[match[1].toLowerCase()] });
    }
    return { shape: "with its weapon", steps, suffix: suffixFrom(leadingName(steps, block)) };
  }

  // "three melee attacks", "two ranged attacks", "two scimitar attacks", "three attacks".
  const counted = MULTI_COUNTED.exec(text);
  if (!counted) return null;
  const times = COUNT_WORDS[counted[1].toLowerCase()];
  const word = oneLine(counted[2]).toLowerCase();
  const kind = word === "melee" || word === "ranged" ? word : undefined;
  const namedKind = !kind && word && word !== "weapon" ? namedAttack(word, block.all) : null;
  if (namedKind) {
    return {
      shape: "counted weapon",
      steps: [{ action: namedKind.id, times }],
      suffix: suffixFrom(namedKind.name.toLowerCase()),
    };
  }
  if (word && !kind && word !== "weapon") return null;
  const pool = kind === "ranged" ? block.ranged : block.melee;
  // "each one with a different weapon": as many DIFFERENT strikes as the count asks for.
  if (MULTI_DIFFERENT.test(text)) {
    const ordered = [...pool].sort((left, right) => strikeAverage(right) - strikeAverage(left));
    const steps = ordered.slice(0, times).map((action) => ({ action: action.id, times: 1 }));
    if (steps.length < times) return null;
    return { shape: "a different weapon each", steps, suffix: suffixFrom(kind) };
  }
  const best = bestStrike(pool);
  if (!best) return null;
  return {
    shape: kind ? `counted ${kind}` : "counted attacks",
    steps: [{ action: best.id, times }],
    suffix: suffixFrom(kind ?? best.name.toLowerCase()),
    bare: !kind,
  };
}

/** Every sequence a Multiattack's printed prose states, in the order it states them.
 *
 *  `attacks` are the block's own resolvable actions, with sequences and points-bought actions
 *  already out: a sequence may never name either. `headCounts` are the numbers a creature's traits
 *  print of itself ("The hydra has five heads"). */
function multiattackSequences(text, attacks, headCounts) {
  const block = strikesOf(attacks);
  if (block.strikes.length === 0) return { sequences: [], opening: false };
  const sentence = MULTI_SENTENCE_WITH_MAKES.exec(text)?.[0] ?? text;

  // An action joined to the strikes by "and" in the same clause happens in the same round. One in a
  // sentence of its own, or hedged with "if it can", is an option and stays a trait.
  const opener = MULTI_AND_USES.exec(sentence);
  const opening = opener ? namedAttack(opener[1], attacks) : null;

  // "three attacks, either with its longsword or its longbow" is one count and two weapons; it has
  // to be read before the sentence is split on "or".
  const either = MULTI_EITHER_WITH.exec(sentence);
  const chunks = either
    ? [either[2], either[3]].map((weapon) => `makes ${either[1]} attacks with its ${weapon}`)
    : sentence.split(/\bor\b/iu);

  const built = [];
  for (const chunk of chunks) {
    const parsed = multiattackChunk(chunk, block, headCounts);
    if (!parsed) continue;
    built.push(parsed);
  }
  if (built.length === 0) return { sequences: [], opening: false };

  // A bare "makes three attacks" with no weapon named and no "melee" in the sentence lets a creature
  // that also shoots use its bow, which is what the SRD means by an attack.
  if (built.length === 1 && built[0].bare && block.ranged.length > 0) {
    const shooter = bestStrike(block.ranged);
    const puncher = built[0].steps[0];
    if (shooter && shooter.id !== puncher.action) {
      built[0].suffix = "melee";
      built.push({
        shape: "counted attacks",
        steps: [{ action: shooter.id, times: puncher.times }],
        suffix: "ranged",
      });
    }
  }

  if (opening) {
    for (const sequence of built) sequence.steps.unshift({ action: opening.id, times: 1 });
  }

  // A sequence that resolves one strike once is the strike itself, not a multiattack.
  const kept = built.filter((sequence) => sequence.steps.reduce((total, step) => total + step.times, 0) > 1);
  if (kept.length === 0) return { sequences: [], opening: false };

  const ids = new Set(attacks.map((action) => action.id));
  for (const sequence of kept) {
    for (const step of sequence.steps) {
      if (!ids.has(step.action)) fail(`a multiattack names "${step.action}", which is not an action of this block`);
      if (!Number.isInteger(step.times) || step.times < 1 || step.times > 10) {
        fail(`a multiattack repeats "${step.action}" ${step.times} times, which is not 1 to 10`);
      }
    }
  }
  return { sequences: kept, opening: !!opening };
}

// ── One creature ──

// A stat block whose fighting is written in prose. Its printed attack is a dagger and the rest of
// what it does is a spell list, so its actions do not say what it deals in a round.
const SPELLCASTING_TRAIT = /spellcasting/iu;

/** The names the actions of one creature print, sorted, so two records can be compared by what they
 *  do rather than by the order the fixture happens to list them in. */
function actionNames(pk, actions) {
  return (actions.get(pk) ?? [])
    .map((action) => plainText(action.fields.name))
    .sort()
    .join(", ");
}

/** Every alias still points at a creature the source has, is still a stub rather than a stat block
 *  of its own, and still prints the same actions as the creature it points at. Any of those failing
 *  means the fixture changed under the map, and a real creature could be dropped without a word. */
function assertCreatureAliases(records, actions) {
  for (const [alias, canonical] of CREATURE_ALIASES) {
    const stub = records.find((entry) => entry.pk === alias);
    const real = records.find((entry) => entry.pk === canonical);
    if (!stub) fail(`${alias} is written as an index alias but is not in the source`);
    if (!real) fail(`${alias} points at ${canonical}, which is not in the source`);
    if (stub.fields.hit_dice) {
      fail(
        `${alias} now prints its own hit dice (${stub.fields.hit_dice}), so it is no longer an index entry for ${canonical}`,
      );
    }
    const stubActions = actionNames(alias, actions);
    const realActions = actionNames(canonical, actions);
    if (stubActions !== realActions) {
      fail(`${alias} does "${stubActions}" and ${canonical} does "${realActions}", so they are not the same creature`);
    }
  }
}

/** Other pairs wearing the shape the aliases wear: the same actions and the same printed hit points,
 *  with one of the two carrying no hit dice. Reported and never dropped, because which of a pair is
 *  the index entry is a decision for somebody holding the book. */
function aliasShapedPairs(records, actions) {
  const named = CREATURE_ALIASES;
  const pairs = [];
  const stubs = records.filter((record) => !record.fields.hit_dice && !named.has(record.pk));
  for (const stub of stubs) {
    const doing = actionNames(stub.pk, actions);
    if (!doing) continue;
    for (const other of records) {
      if (other.pk === stub.pk) continue;
      if (other.fields.hit_points !== stub.fields.hit_points) continue;
      if (actionNames(other.pk, actions) !== doing) continue;
      pairs.push(
        `${stub.pk} ("${stub.fields.name}") looks like an index entry for ${other.pk} ("${other.fields.name}")`,
      );
    }
  }
  return pairs;
}

// The speed modes a stat block prints after its walking speed, in the order the SRD prints them.
const SPEED_MODES = Object.freeze(["burrow", "climb", "fly", "swim"]);

/** The one number the Engine's creature carries, and the whole printed line for the Game Master.
 *
 *  A creature has one `speed`, and a later slice moves it by that number, so a shark whose walking
 *  speed is 0 must travel at its swimming speed or it cannot move at all. The line itself rides
 *  along as a trait wherever there is more than walking to say. */
function speedOf(fields) {
  const modes = SPEED_MODES.flatMap((mode) => (fields[mode] ? [{ mode, feet: fields[mode] }] : []));
  const walk = fields.walk ?? 0;
  const fastest = modes.length > 0 ? Math.max(...modes.map((entry) => entry.feet)) : 0;
  const printed = [
    `${walk} ft.`,
    ...modes.map(({ mode, feet }) => `${mode} ${feet} ft.${mode === "fly" && fields.hover ? " (hover)" : ""}`),
  ].join(", ");
  return { speed: walk > 0 ? walk : fastest, fromAnotherMode: walk === 0 && fastest > 0, printed, modes: modes.length };
}

/** The entry a creature record becomes, and whether its DAMAGE can be measured from its actions.
 *  The second is only for the threat scale: a creature is in the bestiary, and in the health,
 *  defense and to-hit measurements, either way. */
function creatureEntry(record, sources, report) {
  const { pk, fields } = record;
  const actions = (sources.actions.get(pk) ?? []).filter((action) => action.fields.action_type !== "REACTION");
  if (actions.length === 0) {
    report.skipped.push({ id: pk, reason: "the source gives it no action at all, and a block needs one" });
    return null;
  }

  const notes = [];
  const built = [];
  const legendaryActions = [];
  let hiddenDamage = false;
  let multiattack = null;
  for (const action of actions) {
    if (/^multiattack$/iu.test(action.fields.name)) {
      multiattack = action;
      continue;
    }
    // Legendary actions wait, because one of them may only point at an attack printed further down.
    if (action.fields.action_type === "LEGENDARY_ACTION") {
      legendaryActions.push(action);
      continue;
    }
    const result = creatureAction(action, sources.attacks.get(action.pk), report);
    for (const note of result.notes) if (note) notes.push(note);
    if (result.hiddenDamage) hiddenDamage = true;
    if (result.action) built.push(compact({ ...result.action, ...usesFrom(action.fields) }));
  }

  // A legendary action that only points at an attack the block already has ("The dragon makes a tail
  // attack") is that attack, bought with a point instead of the turn's action.
  const strikes = [...built];
  let signaturePoints;
  for (const action of legendaryActions) {
    const cost = action.fields.legendary_action_cost ?? 1;
    if (cost > LEGENDARY_POINTS) {
      fail(`${pk} prints a legendary action costing ${cost}, more than the ${LEGENDARY_POINTS}-point pool`);
    }
    signaturePoints = LEGENDARY_POINTS;
    const id = actionId(action.pk, pk);
    const name = plainText(action.fields.name);
    const pointed = /\bmakes?\s+(?:a|one)\s+([a-z' ]+?)\s+attack/iu.exec(plainText(action.fields.desc));
    const target = pointed ? namedAttack(pointed[1], strikes) : null;
    if (target) {
      built.push({ ...target, id, name, signature: { cost } });
      report.legendaryReusingAnAttack += 1;
      continue;
    }
    const result = creatureAction(action, sources.attacks.get(action.pk), report);
    for (const note of result.notes) if (note) notes.push(note);
    if (result.hiddenDamage) hiddenDamage = true;
    if (result.action) built.push({ ...result.action, signature: { cost } });
  }
  // Points are only worth declaring when something can be bought with them.
  if (!built.some((action) => action.signature)) signaturePoints = undefined;

  if (multiattack) {
    const text = plainText(multiattack.fields.desc);
    // A sequence may never name another sequence, and never an action bought with points.
    const namable = built.filter((action) => !action.sequence && !action.signature);
    const parsed = multiattackSequences(text, namable, headCounts(sources.traits.get(pk) ?? []));
    // A creature already at the action cap keeps its single attacks and drops the LAST alternative,
    // because the first sequence a sentence states is the one it leads with.
    const room = Math.max(0, CREATURE_MAX_ACTIONS - built.length);
    const kept = parsed.sequences.slice(0, room);
    if (kept.length < parsed.sequences.length) report.multiattackAlternativesDropped.push(pk);
    const id = actionId(multiattack.pk, pk);
    // Unshifted back to front, so the block prints the alternatives in the order the sentence does.
    [...kept].reverse().forEach((sequence, index) => {
      const at = kept.length - 1 - index;
      const suffix = kept.length > 1 ? sequence.suffix || `${at + 1}` : undefined;
      built.unshift({
        id: suffix ? `${id}_${suffix.replace(/[^a-z0-9]+/giu, "_").replace(/^_+|_+$/gu, "")}`.slice(0, 40) : id,
        name: suffix ? `Multiattack (${suffix})` : "Multiattack",
        budget: BUDGET_ACTION,
        sequence: sequence.steps,
      });
      report.multiattackShapes.set(sequence.shape, (report.multiattackShapes.get(sequence.shape) ?? 0) + 1);
    });
    if (kept.length > 0) report.multiattacksParsed += 1;
    else report.multiattacksFallenBack.push(`${pk}: ${text}`);
    // A sequence carries the strikes and never the riders and alternatives the same sentence states,
    // so the printed sentence rides along as a trait unless the sequence is the whole of it. A
    // sentence that also SPENDS something ("uses Reel") only counts as carried when that use was
    // folded into the round.
    const spends = /\buses?\b/iu.test(text) && !parsed.opening;
    if (kept.length === 0 || spends || MULTI_RIDER.test(text) || /[.;]\s+\S/u.test(text)) {
      notes.push(trait("what a multiattack says beyond its strikes", "Multiattack", text));
    } else report.multiattacksFullyCarried += 1;
  }

  if (built.length === 0) {
    report.skipped.push({ id: pk, reason: "none of its actions is something a fight could resolve" });
    return null;
  }
  if (built.length > CREATURE_MAX_ACTIONS) {
    fail(`${pk} has ${built.length} actions, over the ${CREATURE_MAX_ACTIONS} the Engine allows`);
  }

  // Everything about the creature itself that the block cannot hold.
  const conditionImmunities = [];
  for (const condition of fields.condition_immunities) {
    if (CONDITION_SET.has(condition)) conditionImmunities.push(condition);
    else {
      notes.push(
        trait(
          "a condition immunity this sheet cannot hold",
          "Immune to exhaustion",
          `The ${fields.name} is immune to ${condition}, which this sheet counts on a track rather than as a condition.`,
        ),
      );
      report.conditionImmunitiesNotCarried += 1;
    }
  }
  if (fields.nonmagical_attack_resistance || fields.nonmagical_attack_immunity) {
    const word = fields.nonmagical_attack_immunity ? "immune to" : "resistant to";
    notes.push(
      trait(
        "a qualifier on a resistance",
        "Nonmagical attacks",
        `${plainText(fields.damage_resistances_display || fields.damage_immunities_display) || `It is ${word} damage from nonmagical attacks.`} A fight has no way to ask whether a weapon is magical, so this qualifier is not applied.`,
      ),
    );
    report.nonmagicalQualifiers += 1;
  }
  // The printed speed line, wherever there is more than walking to say. It sits ABOVE the stat
  // block's own traits, because the block carries one speed number and this is the only place the
  // rest of them survive; a creature already at the cap drops a printed trait from the end instead.
  const speed = speedOf(fields);
  if (speed.modes > 0) {
    notes.push(trait("the speed modes one number cannot hold", "Speed", speed.printed));
    report.speedTraits += 1;
  }
  if (speed.fromAnotherMode) report.speedFromAnotherMode += 1;
  for (const source of sources.traits.get(pk) ?? []) {
    notes.push(trait("a trait the stat block prints", source.fields.name, source.fields.desc));
  }

  const kept = notes.filter(Boolean).slice(0, CREATURE_MAX_TRAITS);
  report.traitsShipped += kept.length;
  report.traitsDropped += notes.filter(Boolean).length - kept.length;
  for (const note of kept) report.traitsByKind.set(note.kind, (report.traitsByKind.get(note.kind) ?? 0) + 1);

  const health = fields.hit_dice ? { dice: fields.hit_dice } : fields.hit_points;
  if (typeof health === "object") {
    const dice =
      DICE_PATTERN.exec(fields.hit_dice.replace(/[+-]\d+$/u, "")) ?? fail(`${pk} has hit dice ${fields.hit_dice}`);
    const flat = /([+-]\d+)$/u.exec(fields.hit_dice);
    const average = Math.floor(Number(dice[1]) * ((Number(dice[2]) + 1) / 2)) + (flat ? Number(flat[1]) : 0);
    if (average !== fields.hit_points)
      report.hitPointDisagreements.push(`${pk} (${fields.hit_dice} averages ${average}, printed ${fields.hit_points})`);
  } else {
    report.creaturesWithoutHitDice.push(pk);
  }

  const abilities = {
    str: fields.ability_score_strength,
    dex: fields.ability_score_dexterity,
    con: fields.ability_score_constitution,
    int: fields.ability_score_intelligence,
    wis: fields.ability_score_wisdom,
    cha: fields.ability_score_charisma,
  };
  const saves = compact({
    str_save: fields.saving_throw_strength ?? undefined,
    dex_save: fields.saving_throw_dexterity ?? undefined,
    con_save: fields.saving_throw_constitution ?? undefined,
    int_save: fields.saving_throw_intelligence ?? undefined,
    wis_save: fields.saving_throw_wisdom ?? undefined,
    cha_save: fields.saving_throw_charisma ?? undefined,
  });
  for (const key of ["damage_resistances", "damage_vulnerabilities", "damage_immunities"]) {
    for (const type of fields[key]) if (!DAMAGE_TYPE_SET.has(type)) fail(`${pk} names the damage type "${type}"`);
  }

  const challenge = Number(fields.challenge_rating);
  const creature = compact({
    health,
    defense: fields.armor_class,
    speed: speed.speed,
    initiativeModifier: Math.floor((fields.ability_score_dexterity - 10) / 2),
    abilities,
    saves: Object.keys(saves).length > 0 ? saves : undefined,
    resist: fields.damage_resistances.length > 0 ? [...fields.damage_resistances] : undefined,
    vulnerable: fields.damage_vulnerabilities.length > 0 ? [...fields.damage_vulnerabilities] : undefined,
    immune: fields.damage_immunities.length > 0 ? [...fields.damage_immunities] : undefined,
    conditionImmunities: conditionImmunities.length > 0 ? conditionImmunities : undefined,
    tier: tierId(challenge),
    traits: kept.length > 0 ? kept.map(({ name, text }) => ({ name, text })) : undefined,
    signaturePoints,
    actions: built,
  });

  // A creature whose fighting is not all in its actions cannot be measured for damage: a
  // spellcaster's best printed attack is a dagger, and an action the converter could not resolve is
  // a trait a fight never rolls. It stays in the bestiary and in every other measurement.
  const casts = (sources.traits.get(pk) ?? []).some((source) => SPELLCASTING_TRAIT.test(source.fields.name));
  if (casts) report.damageMeasurementSkippedCasters += 1;
  else if (hiddenDamage) report.damageMeasurementSkippedHiddenDamage += 1;

  return {
    damageMeasurable: !casts && !hiddenDamage,
    id: entryId(pk),
    label: fields.name,
    summary: trimToSentence(
      `${capitalize(fields.size)} ${fields.type}${fields.alignment ? `, ${fields.alignment}` : ""}. Armor Class ${fields.armor_class}, ${fields.hit_points} hit points, challenge rating ${challengeLabel(challenge)}.`,
      CREATURE_SUMMARY_MAX,
    ),
    filters: compact({
      challenge,
      type: capitalize(fields.type),
      size: capitalize(fields.size),
      environment:
        fields.environments.length > 0
          ? fields.environments
              .map((slug) => environmentName(slug, sources.environments))
              .sort()
              .slice(0, 24)
          : undefined,
    }),
    creature,
  };
}

/** What a source action's own bookkeeping says: how many times it can be done, or the face it comes
 *  back on. `uses_param` is the face for a recharge and the count for a per-day use. */
function usesFrom(fields) {
  if (fields.uses_type === "RECHARGE_ON_ROLL") {
    return { recharge: { dice: { count: 1, sides: 6 }, from: Number(fields.uses_param) } };
  }
  if (fields.uses_type === "PER_DAY") return { uses: { per: "day", count: Number(fields.uses_param) } };
  return {};
}

/** The environment tags the picker filters on. The source names eleven of them in a record of their
 *  own and leaves the rest as plain slugs, so a slug becomes the words it is made of. */
function environmentName(slug, names) {
  const known = names.get(slug);
  if (known) return known;
  return String(slug)
    .replace(/^(?:srd|tob)_/u, "")
    .split(/[-_]/u)
    .map((word) => capitalize(word))
    .join(" ");
}

// ── The threat scale ──
//
// One rung per challenge rating the SRD has creatures for, MEASURED from those creatures: the health
// band is the lowest to the highest, defense and to-hit are medians, damage per round is the lowest
// to the highest best round, and the save difficulty is the median of the ones that name any. A
// rating with no creatures takes the midpoint of its neighbours, which is said in the block's own
// comment. Nothing here is typed by hand.

/** Every challenge rating the scale has a rung for, as the SRD prints them. */
const CHALLENGE_RATINGS = Object.freeze([
  0,
  0.125,
  0.25,
  0.5,
  ...Array.from({ length: 24 }, (item, index) => index + 1),
  30,
]);

function challengeLabel(challenge) {
  if (challenge === 0.125) return "1/8";
  if (challenge === 0.25) return "1/4";
  if (challenge === 0.5) return "1/2";
  return String(challenge);
}

function tierId(challenge) {
  return `cr_${challengeLabel(challenge).replace("/", "_")}`;
}

function median(values) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The best one round of this block can do against ONE target: its heaviest sequence, or its
 *  heaviest single action. The same reading the Engine's own clamp uses. */
function bestRound(creature) {
  const byId = new Map(creature.actions.map((action) => [action.id, action]));
  let best = 0;
  for (const action of creature.actions) {
    const total = action.sequence
      ? action.sequence.reduce((sum, step) => sum + step.times * averageOfDamage(byId.get(step.action)), 0)
      : averageOfDamage(action);
    if (total > best) best = total;
  }
  return best;
}

function averageOfDamage(action) {
  const damage = action?.damage;
  if (!damage) return 0;
  const dice = damage.dice ? DICE_PATTERN.exec(damage.dice) : null;
  return Math.max(
    0,
    averageOf({ count: dice ? Number(dice[1]) : 0, sides: dice ? Number(dice[2]) : 0, flat: damage.flat ?? 0 }),
  );
}

/** Every save difficulty a creature's own actions name. */
function saveDifficulties(creature) {
  return creature.actions.flatMap((action) => (action.save ? [action.save.difficulty] : []));
}

function averageHealth(creature) {
  if (typeof creature.health === "number") return creature.health;
  const dice = DICE_PATTERN.exec(creature.health.dice.replace(/[+-]\d+$/u, ""));
  const flat = /([+-]\d+)$/u.exec(creature.health.dice);
  return Math.floor(Number(dice[1]) * ((Number(dice[2]) + 1) / 2)) + (flat ? Number(flat[1]) : 0);
}

function threatTiers(entries, report) {
  const byTier = new Map(CHALLENGE_RATINGS.map((challenge) => [tierId(challenge), []]));
  for (const entry of entries) {
    const group = byTier.get(entry.creature.tier);
    // A rating the scale has no rung for would otherwise be pushed into nothing and disappear from
    // every measurement without a word.
    if (!group) fail(`${entry.id} sits on the tier "${entry.creature.tier}", which this scale has no rung for`);
    group.push(entry);
  }
  const measured = CHALLENGE_RATINGS.map((challenge) => {
    const id = tierId(challenge);
    const group = byTier.get(id);
    const creatures = group.map((entry) => entry.creature);
    // Health, defense and to-hit are read off EVERY creature of the rating. Damage is read only off
    // the ones whose fighting is in their actions, because a spellcaster's printed attack is a
    // dagger and a printed action the converter could not resolve is a trait a fight never rolls.
    // Measuring damage from those would cap the whole rating at what a wizard does with a knife.
    const hitters = group.filter((entry) => entry.damageMeasurable).map((entry) => entry.creature);
    const rounds = hitters.map(bestRound);
    const base = {
      id,
      challenge,
      label: `CR ${challengeLabel(challenge)}`,
      count: creatures.length,
      hitters: hitters.length,
    };
    if (creatures.length === 0) return base;
    const healths = creatures.map(averageHealth);
    const toHits = creatures.flatMap((creature) => {
      const best = creature.actions.flatMap((action) => (action.toHit === undefined ? [] : [action.toHit]));
      return best.length > 0 ? [Math.max(...best)] : [];
    });
    const difficulties = creatures.flatMap((creature) => {
      const named = saveDifficulties(creature);
      return named.length > 0 ? [median(named)] : [];
    });
    return {
      ...base,
      health: [Math.max(1, Math.min(...healths)), Math.max(...healths)],
      defense: Math.round(median(creatures.map((creature) => creature.defense))),
      toHit: toHits.length > 0 ? Math.round(median(toHits)) : undefined,
      damagePerRound: rounds.length > 0 ? [Math.floor(Math.min(...rounds)), Math.ceil(Math.max(...rounds))] : undefined,
      saveDifficulty: difficulties.length > 0 ? Math.round(median(difficulties)) : undefined,
    };
  });

  // A rating the SRD has no creature for, and a rating whose creatures all fight in prose, take the
  // midpoint of the nearest rung on each side that has the number in question, so the scale never
  // has a hole an opponent could be clamped into.
  const filled = measured.map((tier, index) => {
    const nearest = (pick, step) => {
      for (let at = index + step; at >= 0 && at < measured.length; at += step) {
        const value = pick(measured[at]);
        if (value !== undefined) return value;
      }
      return undefined;
    };
    const between = (pick) => {
      const low = nearest(pick, -1);
      const high = nearest(pick, 1);
      if (low === undefined) return high;
      if (high === undefined) return low;
      return Math.round((low + high) / 2);
    };
    const band = (pick) => {
      const own = pick(tier);
      if (own !== undefined) return own;
      const low = between((entry) => pick(entry)?.[0]);
      const high = between((entry) => pick(entry)?.[1]);
      return [low, high];
    };
    if (tier.count === 0) report.tiersFilledFromNeighbours.push(tier.id);
    if (tier.count > 0 && tier.damagePerRound === undefined) report.tiersWithNoHitters.push(tier.id);
    return {
      ...tier,
      health: band((entry) => entry.health),
      defense: tier.defense ?? between((entry) => entry.defense),
      toHit: tier.toHit ?? between((entry) => entry.toHit) ?? 0,
      damagePerRound: band((entry) => entry.damagePerRound),
      saveDifficulty: tier.saveDifficulty ?? between((entry) => entry.saveDifficulty) ?? 10,
    };
  });

  // The one place this table is smoothed. It is the scale an opponent NOBODY WROTE is pulled onto,
  // so a higher rating may never allow less than a lower one: a Game Master's own rating 12 monster
  // would otherwise be clamped to what the two SRD creatures of that rating happen to print. Every
  // cap and every floor becomes a running maximum along the rating order. The numbers are still the
  // SRD creatures' own; only which rating may use them changes.
  const running = {
    healthLow: 0,
    healthHigh: 0,
    defense: 0,
    toHit: -Infinity,
    damageLow: 0,
    damageHigh: 0,
    difficulty: 0,
  };
  const shipped = filled.map((tier) => {
    running.healthLow = Math.max(running.healthLow, tier.health[0]);
    running.healthHigh = Math.max(running.healthHigh, tier.health[1]);
    running.defense = Math.max(running.defense, tier.defense);
    running.toHit = Math.max(running.toHit, tier.toHit);
    running.damageLow = Math.max(running.damageLow, tier.damagePerRound[0]);
    running.damageHigh = Math.max(running.damageHigh, tier.damagePerRound[1]);
    running.difficulty = Math.max(running.difficulty, tier.saveDifficulty);
    return {
      ...tier,
      // A floor can never pass its own cap: both are running maxima of numbers that were already
      // ordered that way, so this only ever confirms it.
      health: [Math.max(1, Math.min(running.healthLow, running.healthHigh)), running.healthHigh],
      defense: running.defense,
      toHit: running.toHit,
      damagePerRound: [Math.min(running.damageLow, running.damageHigh), running.damageHigh],
      saveDifficulty: running.difficulty,
    };
  });

  for (const tier of shipped) {
    if (tier.toHit === undefined || tier.saveDifficulty === undefined) fail(`Threat tier ${tier.id} has no numbers`);
    if (tier.health[0] > tier.health[1] || tier.damagePerRound[0] > tier.damagePerRound[1]) {
      fail(`Threat tier ${tier.id} has a band whose lowest is above its highest`);
    }
  }
  return { measured: filled, tiers: shipped };
}

// ── The combat block ──
//
// How a fight is RESOLVED by these rules. Every name in it is ruleset.json's own, and the threat
// scale is the one measured above, so nobody types the table.

function combatBlock(tiers) {
  return {
    $comment:
      "How a battle is FOUGHT by these rules, which is what a game on this ruleset plays on. Generated by scripts/build-5e-srd-catalogs.mjs: the threat scale below is MEASURED from the SRD creatures of each challenge rating. The battle block above is what a game without the combat director still uses; a fight never uses both.",
    kind: "attack-vs-defense",
    health: { pool: "hp" },
    defense: { field: "ac" },
    initiative: { dice: { count: 1, sides: 20 }, modifier: { derived: "initiative" } },
    attackRoll: {
      $comment:
        "2014 rules: a natural 20 on an attack roll always hits and is a critical, and a natural 1 always misses. A critical rolls the damage dice twice.",
      dice: { count: 1, sides: 20 },
      advantage: true,
      naturals: { max: "critical", min: "miss" },
      critical: "double-dice",
    },
    economy: {
      budgets: [
        { id: BUDGET_ACTION, label: "Action", per: "turn", count: 1 },
        { id: BUDGET_BONUS, label: "Bonus action", per: "turn", count: 1 },
        { id: BUDGET_REACTION, label: "Reaction", per: "turn", count: 1 },
      ],
      movement: { field: "speed" },
    },
    distance: {
      $comment:
        'SRD 5.1, Playing on a Grid: "Each square on the grid represents 5 feet." Every distance in this ruleset is in feet, so one cell is five of them.',
      label: DISTANCE_UNITS.distance.label,
      perCell: DISTANCE_UNITS.distance.perCell,
    },
    ranged: {
      $comment:
        'SRD 5.1, Range: "Your attack has disadvantage when your target is beyond normal range." Ranged Attacks in Close Combat: "You have disadvantage on a ranged attack roll if you are within 5 feet of a hostile creature who can see you and who isn\'t incapacitated." The Engine reads the second rule from the shooter\'s own neighbours and cannot ask whether that neighbour sees them.',
      long: "disadvantage",
      adjacentFoe: "disadvantage",
    },
    cover: {
      $comment:
        'SRD 5.1, Cover: "A target with half cover has a +2 bonus to AC and Dexterity saving throws." Three-quarters cover and total cover are not in the Engine yet, so every piece of covering ground here is half cover, and the bonus applies to the attack roll and not to a saving throw.',
      bonus: 2,
    },
    opportunity: {
      $comment:
        'SRD 5.1, Opportunity Attacks: "You can make an opportunity attack when a hostile creature that you can see moves out of your reach. To make the opportunity attack, you use your reaction." Taking it is automatic in this Engine, because nothing opens a reaction window yet.',
      budget: BUDGET_REACTION,
    },
    attacks: [
      {
        list: ATTACK_LIST,
        budget: BUDGET_ACTION,
        name: "name",
        toHit: { ability: { column: "ability" }, proficiency: { column: "proficient" }, bonus: { column: "bonus" } },
        damage: { dice: { column: "damage" }, ability: { column: "ability" }, type: { column: "damage_type" } },
        reach: { column: ATTACK_REACH_COLUMN },
        range: { normal: { column: ATTACK_RANGE_COLUMN }, long: { column: ATTACK_LONG_RANGE_COLUMN } },
      },
    ],
    abilities: [
      {
        $comment:
          "Prepared spells, plus cantrips, which are cast without being prepared and are level 0 on this sheet. What each one does is the catalog entry's own mechanics.",
        list: SPELL_LIST,
        onlyWhen: "prepared",
        alwaysWhen: { column: "level", equals: 0 },
        budget: BUDGET_ACTION,
        toHit: { derived: "spell_attack" },
        saveDifficulty: { derived: "spell_save_dc" },
      },
      {
        $comment:
          "Class features you picked, for the ones the SRD states in numbers, such as Second Wind. No toHit and no saveDifficulty: a class feature's own difficulty is not the spell save DC, and none of the entries this package ships rolls to hit or asks for a save.",
        list: FEATURE_LIST,
        budget: BUDGET_ACTION,
      },
    ],
    standard: ["dash", "disengage", "dodge", "help", "hide", "ready"],
    conditions: [
      {
        $comment:
          "Only the parts of each condition the closed effect list can say today. Charmed and deafened have no effect it can express, so they are left out and stay plain records on the sheet.",
        condition: "blinded",
        effects: ["own-attacks-disadvantage", "attacks-against-advantage"],
      },
      { condition: "frightened", effects: ["own-attacks-disadvantage"] },
      { condition: "grappled", effects: ["speed-zero"] },
      { condition: "incapacitated", effects: ["cannot-act", "cannot-react"] },
      { condition: "invisible", effects: ["own-attacks-advantage", "attacks-against-disadvantage"] },
      {
        condition: "paralyzed",
        effects: ["cannot-act", "cannot-react", "attacks-against-advantage", "attacks-from-adjacent-critical"],
        failsSaves: ["str_save", "dex_save"],
      },
      {
        condition: "petrified",
        effects: ["cannot-act", "cannot-react", "speed-zero", "attacks-against-advantage"],
        failsSaves: ["str_save", "dex_save"],
      },
      { condition: "poisoned", effects: ["own-attacks-disadvantage"] },
      {
        condition: "prone",
        effects: [
          "own-attacks-disadvantage",
          "attacks-against-adjacent-advantage",
          "attacks-against-far-disadvantage",
          "half-move-to-stand",
        ],
      },
      { condition: "restrained", effects: ["own-attacks-disadvantage", "attacks-against-advantage", "speed-zero"] },
      {
        condition: "stunned",
        effects: ["cannot-act", "cannot-react", "speed-zero", "attacks-against-advantage"],
        failsSaves: ["str_save", "dex_save"],
      },
      {
        condition: "unconscious",
        effects: [
          "cannot-act",
          "cannot-react",
          "speed-zero",
          "attacks-against-advantage",
          "attacks-from-adjacent-critical",
        ],
        failsSaves: ["str_save", "dex_save"],
      },
    ],
    concentration: { text: "concentration", save: "con_save", floor: 10, fromDamage: 0.5 },
    dying: {
      $comment:
        "Three successes stabilise and three failures kill, which is each track's own maximum. A natural 20 brings the character back up with one hit point and a natural 1 counts twice.",
      kind: "saves",
      successes: "death_save_successes",
      failures: "death_save_failures",
      dice: { count: 1, sides: 20 },
      succeedAt: 10,
      naturals: { max: "revive-1", min: "two-failures" },
      damageWhileDown: "one-failure",
      criticalWhileDown: "two-failures",
      condition: "unconscious",
    },
    damageTypes: [...DAMAGE_TYPES],
    threat: {
      $comment:
        "The scale an opponent NOBODY WROTE is pulled onto. MEASURED from the SRD 5.1 creatures of each challenge rating: health is the lowest to the highest average hit points, defense and toHit are the median Armor Class and the median best attack bonus, damagePerRound is the lowest to the highest best round against one target, and saveDifficulty is the median of the difficulties those creatures' actions name. Damage is measured only from the creatures whose fighting is in their actions, because a spellcaster's printed attack is a dagger and an action this format could not hold is a trait a fight never rolls. A rating the SRD has no creature for, or none that can be measured for damage, takes the midpoint of its nearest neighbours. The caps and floors are then made monotone along the rating order, which is the one place this table is smoothed: a higher rating may never allow less than a lower one, and the numbers themselves are still the SRD creatures' own. This package's own bestiary is never clamped to it.",
      tiers: tiers.map((tier) => ({
        id: tier.id,
        label: tier.label,
        health: tier.health,
        defense: tier.defense,
        toHit: tier.toHit,
        damagePerRound: tier.damagePerRound,
        saveDifficulty: tier.saveDifficulty,
      })),
    },
  };
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
async function writeRuleset(path, catalogs, combat) {
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
  // The `combat` block is GENERATED, because its threat scale is measured from the bestiary, so it
  // rides below the catalogs key with everything else this run writes. One typed by hand above it
  // would survive the splice and the file would carry the key twice.
  const combatAt = raw.search(/^ {2}"combat":/mu);
  if (combatAt >= 0 && catalogsAt >= 0 && combatAt < catalogsAt) {
    fail('ruleset.json has a hand-written "combat" above "catalogs"; this script generates that block');
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
  const spliced = `${body},\n"catalogs":${JSON.stringify(catalogs)},\n"combat":${JSON.stringify(combat)}\n}\n`;
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

/** Everything the build report counts. Deterministic: lists are pushed in source order and printed
 *  in it, so two runs over the same fixtures print the same report. */
const report = {
  weaponsByDistance: { melee: 0, reach: 0, ranged: 0, thrown: 0 },
  spellsWithRange: 0,
  spellsFromTheCaster: 0,
  spellsWithoutRange: [],
  spellAreasByShape: new Map(),
  spellAreasNotMapped: [],
  creatureActionsWithReach: 0,
  creatureActionsWithRange: 0,
  creatureActionsWithLongRange: 0,
  creatureActionsWithBoth: 0,
  creatureActionsWithNoDistance: 0,
  creatureAreasByShape: new Map(),
  creatureAreasSparingTheirOwn: 0,
  creatureAreasWithPrintedRange: 0,
  creatureActionsFromWithin: 0,
  skipped: [],
  multiattacksParsed: 0,
  multiattackShapes: new Map(),
  multiattackAlternativesDropped: [],
  multiattacksFullyCarried: 0,
  multiattacksFallenBack: [],
  foldedRiders: 0,
  alternativeClauses: 0,
  riderSavesNotCarried: 0,
  attacksThatOnlyApplyAConditionCount: 0,
  optionBlocksSplit: 0,
  legendaryReusingAnAttack: 0,
  attacksWithoutPrintedToHit: [],
  attacksWithNothingToResolve: [],
  savesWithNothingToResolve: [],
  actionsWithNeitherAttackNorSave: 0,
  toHitDisagreements: [],
  diceDisagreements: [],
  damageTypeDisagreements: 0,
  hitPointDisagreements: [],
  creaturesWithoutHitDice: [],
  conditionImmunitiesNotCarried: 0,
  nonmagicalQualifiers: 0,
  traitsShipped: 0,
  traitsByKind: new Map(),
  traitsDropped: 0,
  tiersFilledFromNeighbours: [],
  tiersWithNoHitters: [],
  speedFromAnotherMode: 0,
  speedTraits: 0,
  aliasesLeftOut: [],
  aliasShapedPairs: [],
  damageMeasurementSkippedCasters: 0,
  damageMeasurementSkippedHiddenDamage: 0,
};

const classes = new Map(srdOnly(await fixture("CharacterClass.json"), "class").map(({ pk, fields }) => [pk, fields]));
const classNames = new Map([...classes].map(([pk, fields]) => [pk, fields.name]));

const castingOptions = new Map();
for (const { fields } of await fixture("SpellCastingOption.json")) {
  if (!castingOptions.has(fields.parent)) castingOptions.set(fields.parent, new Map());
  castingOptions.get(fields.parent).set(fields.type, fields);
}
const srdSpells = srdOnly(await fixture("Spell.json"), "spell");
const spells = buildSpellEntries(srdSpells, castingOptions, classNames, report);

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
const weapons = buildWeaponEntries(weaponRecords, propertiesByWeapon, report);

// ── The bestiary, and the threat scale measured from it ──

const creatureRecords = srdOnly(await fixture("Creature.json"), "creature");
const creatureActions = new Map();
for (const action of await fixture("CreatureAction.json")) {
  if (!creatureActions.has(action.fields.parent)) creatureActions.set(action.fields.parent, []);
  creatureActions.get(action.fields.parent).push(action);
}
// A stat block prints its actions in one order, and the fixture says which, so a rebuild never
// reshuffles a creature's menu.
for (const list of creatureActions.values()) {
  list.sort(
    (left, right) => left.fields.order_in_statblock - right.fields.order_in_statblock || (left.pk < right.pk ? -1 : 1),
  );
}
const creatureAttackRows = new Map();
for (const row of await fixture("CreatureActionAttack.json")) {
  // A thrown weapon prints one action and the fixture gives it a melee row and a ranged row. They
  // carry the same numbers, so the first one stands for the action.
  if (!creatureAttackRows.has(row.fields.parent)) creatureAttackRows.set(row.fields.parent, row.fields);
}
const creatureTraits = new Map();
for (const source of await fixture("CreatureTrait.json")) {
  if (!creatureTraits.has(source.fields.parent)) creatureTraits.set(source.fields.parent, []);
  creatureTraits.get(source.fields.parent).push(source);
}
const environments = new Map(
  srdOnly(await fixture("Environment.json"), "environment").map(({ pk, fields }) => [pk, fields.name]),
);
const creatureSources = {
  actions: creatureActions,
  attacks: creatureAttackRows,
  traits: creatureTraits,
  environments,
};
assertCreatureAliases(creatureRecords, creatureActions);
report.aliasShapedPairs.push(...aliasShapedPairs(creatureRecords, creatureActions));

const parsedCreatures = creatureRecords
  .filter((record) => {
    // An index entry is the same creature under a second heading, so it is left out rather than
    // shipped as a duplicate of the stat block it points at.
    const canonical = CREATURE_ALIASES.get(record.pk);
    if (!canonical) return true;
    const real = creatureRecords.find((entry) => entry.pk === canonical);
    report.aliasesLeftOut.push(`${record.fields.name} is ${real.fields.name}`);
    return false;
  })
  .map((record) => creatureEntry(record, creatureSources, report))
  .filter(Boolean)
  .sort(byId);
const { measured: measuredTiers, tiers } = threatTiers(parsedCreatures, report);
// `damageMeasurable` is the threat scale's business and nothing the Engine reads, so it comes off
// before the entries are written.
const creatures = parsedCreatures.map(({ damageMeasurable, ...entry }) => entry);
const combat = combatBlock(tiers);

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
  {
    $comment:
      "The SRD 5.1 monsters as opponents a fight reads. It writes no rows onto a sheet, so the sheet editor's picker never offers it, and every number in it is written in the keys the combat block declares. " +
      provenance,
    id: CREATURE_CATALOG,
    label: "Creatures",
    holds: "creatures",
    filters: [
      { id: "challenge", label: "Challenge", type: "number" },
      { id: "type", label: "Type", type: "text" },
      { id: "size", label: "Size", type: "text" },
      { id: "environment", label: "Found in", type: "tags" },
    ],
    units: DISTANCE_UNITS,
    asset: `catalogs/${CREATURE_CATALOG}.json`,
  },
];

const assets = new Map([
  ["catalogs/spells.json", { schemaVersion: 1, $comment: provenance, catalog: "spells", entries: spells }],
  ["catalogs/features.json", { schemaVersion: 1, $comment: provenance, catalog: "features", entries: features }],
  [
    `catalogs/${CREATURE_CATALOG}.json`,
    { schemaVersion: 1, $comment: provenance, catalog: CREATURE_CATALOG, entries: creatures },
  ],
]);

const rulesetPath = join(packageRoot, "ruleset.json");
const { bytes: rulesetBytes, document } = await writeRuleset(rulesetPath, catalogs, combat);
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
assertRulesetCombat(manifest, document);
assertRulesetCreatures(manifest, document, sources);
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

// ── The build report ──
//
// Everything the SRD says that the creature format could not hold, counted. Deterministic, so two
// runs over the same fixtures print the same lines and a reviewer can diff them.

const list = (items, limit = 8) =>
  items.length === 0
    ? "none"
    : `${items.slice(0, limit).join(", ")}${items.length > limit ? `, and ${items.length - limit} more` : ""}`;

console.log("");
console.log("Bestiary build report");
console.log(
  `  ${creatures.length} of ${creatureRecords.length} SRD creature records shipped: ` +
    `${report.skipped.length} left out and ${report.aliasesLeftOut.length} are index aliases for a stat block already here`,
);
for (const entry of report.skipped) console.log(`    left out: ${entry.id} — ${entry.reason}`);
console.log(
  `  multiattack: ${report.multiattacksParsed} parsed into a sequence (${report.multiattacksFullyCarried} of them say nothing the ` +
    `sequence leaves out), ${report.multiattacksFallenBack.length} fell back to single attacks`,
);
for (const [shape, count] of [...report.multiattackShapes].sort((left, right) => right[1] - left[1])) {
  console.log(`    ${String(count).padStart(4)}  sequences from "${shape}"`);
}
for (const entry of report.multiattacksFallenBack) console.log(`    fell back: ${entry}`);
if (report.multiattackAlternativesDropped.length > 0) {
  console.log(
    `    ${report.multiattackAlternativesDropped.length} creature(s) at the action cap dropped their last alternative: ${list(report.multiattackAlternativesDropped)}`,
  );
}
console.log(`  ${report.legendaryReusingAnAttack} legendary action(s) reuse an attack the block already prints`);
console.log(
  `  ${report.optionBlocksSplit} printed action(s) hold several options; the first is the action, the rest are traits`,
);
console.log(
  `  damage clauses: ${report.foldedRiders} "plus" rider(s) and ${report.alternativeClauses} "or" alternative(s) kept as traits`,
);
console.log(
  `  ${report.riderSavesNotCarried} attack rider save(s) could not be carried in full (a second damage roll, or an effect ` +
    "this sheet has no condition for) and kept the printed sentence as a trait",
);
console.log(`  ${report.attacksThatOnlyApplyAConditionCount} attack(s) deal no damage and only apply a condition`);
console.log(
  `  ${report.attacksWithNothingToResolve.length} attack(s) and ${report.savesWithNothingToResolve.length} save action(s) resolve to nothing and became traits`,
);
console.log(`    attacks: ${list(report.attacksWithNothingToResolve)}`);
console.log(`    saves: ${list(report.savesWithNothingToResolve, 12)}`);
console.log(
  `  ${report.actionsWithNeitherAttackNorSave} printed action(s) roll no attack and name no saving throw (summons, healing touches, auras) and became traits`,
);
console.log(
  `  traits: ${report.traitsShipped} shipped, ${report.traitsDropped} dropped over the ${CREATURE_MAX_TRAITS} a creature may carry`,
);
for (const [kind, count] of [...report.traitsByKind].sort((left, right) => right[1] - left[1])) {
  console.log(`    ${String(count).padStart(4)}  ${kind}`);
}
console.log(
  `  ${report.conditionImmunitiesNotCarried} condition immunity/immunities and ${report.nonmagicalQualifiers} nonmagical-attack qualifier(s) became traits`,
);
console.log(
  `  speed: ${report.speedFromAnotherMode} creature(s) take theirs from a mode other than walking, ` +
    `${report.speedTraits} carry the printed speed line as a trait`,
);
console.log(`  ${report.aliasesLeftOut.length} index aliases left out: ${report.aliasesLeftOut.join("; ")}`);
console.log(`  ${report.aliasShapedPairs.length} other pair(s) look like an index entry and its stat block:`);
for (const entry of report.aliasShapedPairs) console.log(`    ${entry}`);
console.log("  text against structured rows:");
console.log(`    to hit: ${report.toHitDisagreements.length} disagreement(s) — ${list(report.toHitDisagreements)}`);
console.log(`    dice: ${report.diceDisagreements.length} disagreement(s) — ${list(report.diceDisagreements, 6)}`);
console.log(`    damage type: ${report.damageTypeDisagreements} disagreement(s)`);
console.log(
  `    hit dice average against printed hit points: ${report.hitPointDisagreements.length} — ${list(report.hitPointDisagreements, 4)}`,
);
console.log(
  `    ${report.creaturesWithoutHitDice.length} creature(s) print hit points but no hit dice — ${list(report.creaturesWithoutHitDice)}`,
);
// What the spell catalog now says in numbers, for the same reason: a reviewer can see at a glance
// how much of a fight the entries can actually resolve.
const withMechanic = (key) => spells.filter((entry) => entry.mechanics?.[key] !== undefined).length;
const longCastDamage = srdSpells.filter(
  (spell) => spell.fields.damage_roll && !["action", "bonus-action", "reaction"].includes(spell.fields.casting_time),
).length;
console.log("");
console.log("Spell mechanics");
console.log(
  `  ${withMechanic("scales")} cantrip(s) grow with the character's level, ${withMechanic("applies")} spell(s) apply a ` +
    `condition, ${withMechanic("temporary")} grant temporary points, ${withMechanic("autoHit")} simply land`,
);
console.log(
  `  ${withMechanic("budget")} spell(s) spend a named budget, ${withMechanic("targetCount")} take more than one target, ` +
    `${withMechanic("save")} ask for a save`,
);
console.log(
  `  ${longCastDamage} damage spell(s) take longer than a turn to cast, which the economy has no budget for, so they ` +
    "spend the list's own action",
);
console.log(
  `  ${SPELL_DAMAGE_NOT_ITS_OWN.size} spell(s) carry a damage roll that is not their own effect and ship as utility, ` +
    "so a fight never offers them:",
);
for (const [pk, entry] of SPELL_DAMAGE_NOT_ITS_OWN) console.log(`    ${pk} - ${entry.reason}`);
console.log(
  `  ${SPELL_SAVES_BY_HAND.size} saving throw(s) are read by hand, because neither printed shape fits: ` +
    `${[...SPELL_SAVES_BY_HAND].map(([pk, entry]) => `${pk} (${entry.onSuccess})`).join(", ")}`,
);
console.log(
  `  ${SPELL_ATTACK_ROLL_CORRECTIONS.size} attack roll(s) corrected from the printed sentence: ` +
    `${[...SPELL_ATTACK_ROLL_CORRECTIONS.keys()].join(", ")}`,
);

// What a fight on a BOARD can measure, counted for every catalog this package ships: how far each
// weapon row swings and carries, how far each spell reaches and what shape it covers, and how far
// each creature action reaches. Everything a printed distance could not be carried into is named.
for (const creature of creatures) {
  for (const action of creature.creature.actions) {
    const reach = action.reach !== undefined;
    const range = action.range !== undefined;
    if (reach) report.creatureActionsWithReach += 1;
    if (range) report.creatureActionsWithRange += 1;
    if (range && typeof action.range === "object") report.creatureActionsWithLongRange += 1;
    if (reach && range) report.creatureActionsWithBoth += 1;
    if (!reach && !range && !action.area) report.creatureActionsWithNoDistance += 1;
    if (action.area) {
      const shapes = report.creatureAreasByShape;
      shapes.set(action.area.shape, (shapes.get(action.area.shape) ?? 0) + 1);
      if (action.area.friendlyFire === false) report.creatureAreasSparingTheirOwn += 1;
      if (action.range !== undefined) report.creatureAreasWithPrintedRange += 1;
    }
  }
}
console.log("");
console.log("Distances");
const weaponKinds = report.weaponsByDistance;
console.log(
  `  weapons: ${weaponKinds.melee} reach 5 ft, ${weaponKinds.reach} reach 10 ft, ${weaponKinds.ranged} shoot and do ` +
    `not reach, ${weaponKinds.thrown} reach and are thrown`,
);
console.log(
  `  spells a fight resolves: ${report.spellsWithRange} carry a range in feet, ${report.spellsFromTheCaster} draw a ` +
    `shape from the caster and name no distance at all, ${report.spellsWithoutRange.length} could not be mapped ` +
    `(${list(report.spellsWithoutRange, 4)})`,
);
console.log(`  spell areas: ${[...report.spellAreasByShape].map(([shape, count]) => `${count} ${shape}`).join(", ")}`);
console.log(
  `  ${report.spellAreasNotMapped.length} printed shape(s) in a resolvable spell are not an area a fight reads:`,
);
for (const entry of report.spellAreasNotMapped) console.log(`    ${entry}`);
const creatureActionCount = creatures.reduce((total, entry) => total + entry.creature.actions.length, 0);
console.log(
  `  creature actions: ${creatureActionCount} in all, ${report.creatureActionsWithReach} reach, ` +
    `${report.creatureActionsWithRange} carry (${report.creatureActionsWithLongRange} of them with a long range), ` +
    `${report.creatureActionsWithBoth} do both, ${report.creatureActionsWithNoDistance} state no distance at all`,
);
const creatureAreaCount = [...report.creatureAreasByShape.values()].reduce((total, count) => total + count, 0);
console.log(
  `  creature areas: ${creatureAreaCount} action(s) land in a shape the SRD prints ` +
    `(${[...report.creatureAreasByShape].map(([shape, count]) => `${count} ${shape}`).join(", ")}); ` +
    `${report.creatureAreasSparingTheirOwn} spare the creature's own side, and ` +
    `${report.creatureAreasWithPrintedRange} name how far off the shape may be aimed`,
);
console.log(
  `  ${report.creatureActionsFromWithin} creature action(s) print no range of their own and take their distance from ` +
    'the sentence that says who must save ("within 120 feet of the dragon")',
);

console.log("");
console.log(
  `Threat scale: ${tiers.length} tiers, ${report.tiersFilledFromNeighbours.length} filled from neighbours (${list(report.tiersFilledFromNeighbours)})`,
);
console.log(
  `  ${report.damageMeasurementSkippedCasters} creature(s) cast rather than swing and ` +
    `${report.damageMeasurementSkippedHiddenDamage} carry damage this format left in a trait, so neither is measured for ` +
    "damage (they are still in the bestiary, and in the health, defense and to-hit measurements)",
);
console.log(
  `  ${report.tiersWithNoHitters.length} rating(s) have creatures but none that can be measured for damage ` +
    `(${list(report.tiersWithNoHitters)}), so that band comes from their neighbours`,
);
console.log("  n = creatures at the rating, d = the ones its damage band was measured from");
const tierRow = (tier) =>
  `  ${tier.id.padEnd(12)} ${String(tier.count).padStart(3)} ${String(tier.hitters).padStart(3)}   ` +
  `${`${tier.health[0]}..${tier.health[1]}`.padEnd(10)}  ${String(tier.defense).padStart(7)}  ` +
  `${String(tier.toHit).padStart(5)}  ${`${tier.damagePerRound[0]}..${tier.damagePerRound[1]}`.padStart(12)}  ` +
  `${String(tier.saveDifficulty).padStart(7)}`;
const tierHead = "  tier          n   d   health      defense  toHit  damage/round  save DC";
console.log("");
console.log("  As measured");
console.log(tierHead);
for (const tier of measuredTiers) console.log(tierRow(tier));
console.log("");
console.log("  As shipped, with every cap and floor made monotone along the rating order");
console.log(tierHead);
for (const tier of tiers) console.log(tierRow(tier));
