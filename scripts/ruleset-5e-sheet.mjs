// The 5e package's own sheet arithmetic, shared by the catalog build and the package regression so the
// shipped ruleset.json is checked in CI and not only when the catalogs are rebuilt. It computes what the
// Engine computes for the ops this sheet uses, and refuses anything else rather than guessing.

function fail(message) {
  throw new Error(message);
}

/** The sheet's numbers as the Engine computes them, restated for the formula pieces the 5e sheet
 *  uses, so a caster can be checked against its printed stat block here rather than only in a fight.
 *  A piece this does not know stops the build, because a number it cannot compute is one nothing
 *  checked. */
export function evaluateSheet(definition, build) {
  const { sheet, resolution } = definition;
  if (resolution.abilityModifier?.op !== "floorHalfMinusTen") {
    fail(`the converter cannot compute the ability modifier "${resolution.abilityModifier?.op}"`);
  }
  const abilityMod = (id) => Math.floor(((build.abilities[id] ?? 10) - 10) / 2);
  const numbers = new Map(
    sheet.fields
      .filter((field) => field.type === "number")
      .map((field) => [
        field.id,
        build.fields[field.id] ?? field.default ?? Math.min(Math.max(0, field.min), field.max),
      ]),
  );
  const derived = new Map();
  const tiers = new Map(resolution.proficiencyTiers.map((tier) => [tier.id, tier]));
  const trained = (entry, chosen) => {
    const tier = tiers.get(chosen[entry.id]) ?? resolution.proficiencyTiers[0];
    if (!Number.isInteger(tier.multiplier) || (tier.flat ?? 0) !== 0) {
      fail(`the converter cannot compute the proficiency tier "${tier.id}"`);
    }
    return (
      abilityMod(entry.ability) + tier.multiplier * value(resolution.proficiency.bonus) + (build.bonuses[entry.id] ?? 0)
    );
  };
  // A hideWhen as the Engine reads it: an enum or text field's value, or its default.
  const hidden = (item) => {
    const hide = item?.hideWhen;
    if (!hide) return false;
    const field = sheet.fields.find((each) => each.id === hide.field);
    const value = build.fields[hide.field] ?? field?.default;
    if (hide.in) return value !== undefined && hide.in.includes(value);
    if (hide.notEquals !== undefined) return value !== hide.notEquals;
    return value === hide.equals;
  };
  function value(ref) {
    if (ref.const !== undefined) return ref.const;
    if (ref.field !== undefined) return numbers.get(ref.field) ?? 0;
    if (ref.derived !== undefined) return derived.get(ref.derived) ?? 0;
    if (ref.abilityMod !== undefined) return abilityMod(ref.abilityMod);
    if (ref.abilityScore !== undefined) return build.abilities[ref.abilityScore] ?? 10;
    // A creature's sheet holds no items, so what it wears reads as the value's own default.
    if (ref.itemStat !== undefined) return ref.itemStat.default ?? 0;
    if (ref.abilityModFromField !== undefined) {
      const chosen = build.fields[ref.abilityModFromField];
      return sheet.abilities.some((ability) => ability.id === chosen) ? abilityMod(chosen) : 0;
    }
    // A list's number column added up over its rows, as the Engine's sumListColumn does: nothing from a
    // list its hideWhen hides, and an empty cell read as the column's default.
    if (ref.listSum !== undefined) {
      const list = sheet.lists.find((entry) => entry.id === ref.listSum.list);
      const rows = build.lists?.[ref.listSum.list];
      if (!list || !Array.isArray(rows) || hidden(list)) return 0;
      const column = list.columns.find((entry) => entry.id === ref.listSum.column);
      const marker = ref.listSum.onlyWhen && list.columns.find((entry) => entry.id === ref.listSum.onlyWhen);
      return rows
        .filter((row) => !marker || (row[marker.id] ?? marker.default) === true)
        .reduce(
          (total, row) =>
            total +
            (Number.isFinite(row[ref.listSum.column])
              ? row[ref.listSum.column]
              : column?.type === "number"
                ? (column.default ?? 0)
                : 0),
          0,
        );
    }
    if (ref.skillMod !== undefined)
      return trained(
        sheet.skills.find((skill) => skill.id === ref.skillMod),
        build.skills,
      );
    fail(`the converter cannot compute the sheet value ${JSON.stringify(ref)}`);
  }
  for (const entry of sheet.derived) {
    if (entry.op === "sum")
      derived.set(
        entry.id,
        entry.of.reduce((total, ref) => total + value(ref), 0),
      );
    else if (entry.op === "stepTable") {
      const at = value(entry.from);
      let stepped = entry.table[0][1];
      for (const [threshold, step] of entry.table) if (at >= threshold) stepped = step;
      derived.set(entry.id, stepped);
    } else if (entry.op === "scale") {
      const scaled = value(entry.of) * entry.multiplier;
      derived.set(
        entry.id,
        entry.round === "up" ? Math.ceil(scaled) : entry.round === "nearest" ? Math.round(scaled) : Math.floor(scaled),
      );
    } else if (entry.op === "multiply")
      derived.set(
        entry.id,
        entry.of.reduce((product, ref) => product * value(ref), 1),
      );
    else if (entry.op === "max") derived.set(entry.id, Math.max(...entry.of.map(value)));
    else if (entry.op === "min") derived.set(entry.id, Math.min(...entry.of.map(value)));
    else if (entry.op === "enumTable" && entry.from.field !== undefined) {
      const field = sheet.fields.find((each) => each.id === entry.from.field);
      const chosen = build.fields[entry.from.field] ?? field?.default;
      derived.set(entry.id, entry.table[chosen] ?? entry.default ?? 0);
    } else if (entry.op === "wordsTable") {
      // The first word or phrase of the table the field names, whole words ignoring case, as the Engine reads it.
      const text = build.fields[entry.from.field] ?? sheet.fields.find((each) => each.id === entry.from.field)?.default;
      const names = (phrase) =>
        new RegExp(
          `(^|[^\\p{L}])${phrase
            .trim()
            .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
            .replace(/\s+/gu, "\\s+")}($|[^\\p{L}])`,
          "iu",
        ).test(text);
      const key = typeof text === "string" ? Object.keys(entry.table).find(names) : undefined;
      derived.set(entry.id, key !== undefined ? entry.table[key] : (entry.default ?? 0));
    } else fail(`the converter cannot compute the derived value "${entry.op}"`);
  }
  return {
    derived: (id) => derived.get(id) ?? fail(`the sheet has no derived value "${id}"`),
    save: (id) =>
      trained(
        sheet.saves.find((save) => save.id === id),
        build.saves,
      ),
    skill: (id) =>
      trained(
        sheet.skills.find((skill) => skill.id === id),
        build.skills,
      ),
  };
}

// SRD 5.1 Multiclassing, the Multiclass Spellcaster table: spell slots per spell level (1st to 9th)
// at each caster level. The sheet's slot step tables are checked against it below.
const MULTICLASS_SPELLCASTER = Object.freeze([
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]);
// SRD 5.1 Warlock table, Spell Slots column.
const PACT_SLOTS = Object.freeze([
  [1, 1],
  [2, 2],
  [11, 3],
  [17, 4],
]);

/** The hand-written sheet works the spell slots out as the SRD says, for every way of mixing each
 *  full caster with paladin and ranger levels up to 20 (1771 mixes for each of the five), and the
 *  warlock's pact slots at every level. "If you multiclass but have the Spellcasting feature from only one class, you follow
 *  the rules as described in that class": paladins and rangers gain Spellcasting at 2nd level, and
 *  their own table is the full one at half their level rounded up. Otherwise "add together all your
 *  levels in the bard, cleric, druid, sorcerer, and wizard classes, and half your levels (rounded
 *  down) in the paladin and ranger classes". Nobody with no caster levels has a slot. */
export function assertSpellSlots(document) {
  const wrong = [];
  // Every full caster in turn, so a class left out of the caster level is caught too.
  for (const fullClass of ["bard", "cleric", "druid", "sorcerer", "wizard"]) {
    for (let full = 0; full <= 20; full += 1) {
      for (let paladin = 0; full + paladin <= 20; paladin += 1) {
        for (let ranger = 0; full + paladin + ranger <= 20; ranger += 1) {
          const casters = (full > 0 ? 1 : 0) + (paladin >= 2 ? 1 : 0) + (ranger >= 2 ? 1 : 0);
          const expected =
            casters >= 2
              ? full + Math.floor(paladin / 2) + Math.floor(ranger / 2)
              : full > 0
                ? full
                : paladin >= 2
                  ? Math.ceil(paladin / 2)
                  : ranger >= 2
                    ? Math.ceil(ranger / 2)
                    : 0;
          const sheet = evaluateSheet(document, {
            abilities: {},
            skills: {},
            saves: {},
            bonuses: {},
            fields: {
              [`level_${fullClass}`]: full,
              level_paladin: paladin,
              level_ranger: ranger,
              spellcasting_ability: "int",
            },
            lists: {},
          });
          for (let slot = 1; slot <= 9; slot += 1) {
            const want = MULTICLASS_SPELLCASTER[expected][slot - 1] ?? 0;
            const got = sheet.derived(`slots_${slot}`);
            if (got !== want) {
              wrong.push(
                `${fullClass} ${full} / paladin ${paladin} / ranger ${ranger}: ${slot} slots ${got}, not ${want}`,
              );
            }
          }
        }
      }
    }
  }
  for (let warlock = 0; warlock <= 20; warlock += 1) {
    const want = PACT_SLOTS.filter(([level]) => warlock >= level).at(-1)?.[1] ?? 0;
    const got = evaluateSheet(document, {
      abilities: {},
      skills: {},
      saves: {},
      bonuses: {},
      fields: { level_warlock: warlock },
      lists: {},
    }).derived("pact_slots");
    if (got !== want) wrong.push(`warlock ${warlock}: ${got} pact slots, not ${want}`);
  }
  if (wrong.length > 0) fail(`the sheet's spell slots disagree with the SRD:\n${wrong.slice(0, 12).join("\n")}`);
}
