// The 5e package's starting gear (Capability API 1.78), read off the SRD's own sentences: each class's
// "Equipment" feature and the Acolyte's equipment. Every phrase those sentences use is in a table
// below, and a phrase the table does not know stops the build, so the gear can never drift from the
// text it cites.
//
// Taking the gear is the player's choice, never the Engine's: a character who starts above level 1,
// or with a concept of their own, takes nothing, or asks the Game Master.

function fail(message) {
  throw new Error(`Starting gear: ${message}`);
}

const EQUIPMENT = "equipment";
const COUNTS = new Map([
  ["a", 1],
  ["an", 1],
  ["two", 2],
  ["four", 4],
  ["five", 5],
]);

// What each phrase of the sentences gives, by the words after its count ("a", "two", "10" and the
// like), as the SRD writes them. `item` is an equipment entry; `tags` is a pick of one of the weapons
// carrying every tag, and `set` one of an SRD item set's items, which "any" and a kind of focus mean;
// `pack` is an equipment pack, given as what its own sentence says it holds; `name` is a plain item,
// for the few things the SRD's equipment lists do not have.
const GEAR_NOUNS = new Map([
  // Class equipment (SRD 5.1, each class's "Equipment").
  ["greataxe", { item: "greataxe" }],
  ["handaxes", { item: "handaxe" }],
  ["javelins", { item: "javelin" }],
  ["rapier", { item: "rapier" }],
  ["longsword", { item: "longsword" }],
  ["lute", { item: "lute" }],
  ["leather armor", { item: "leather-armor" }],
  ["dagger", { item: "dagger" }],
  ["daggers", { item: "dagger" }],
  ["mace", { item: "mace" }],
  ["warhammer", { item: "warhammer" }],
  ["scale mail", { item: "scale-mail" }],
  ["chain mail", { item: "chain-mail" }],
  ["light crossbow", { item: "crossbow-light" }],
  ["bolts", { item: "crossbow-bolt" }],
  ["shield", { item: "shield" }],
  // The SRD's one shield is wood or metal: "A shield is made from wood or metal".
  ["wooden shield", { item: "shield" }],
  ["scimitar", { item: "scimitar" }],
  ["longbow", { item: "longbow" }],
  ["arrows", { item: "arrow-bow" }],
  ["shortsword", { item: "shortsword" }],
  ["shortswords", { item: "shortsword" }],
  ["darts", { item: "dart" }],
  ["shortbow", { item: "shortbow" }],
  ["thieves' tools", { item: "thieves-tools" }],
  ["component pouch", { item: "component-pouch" }],
  ["quarterstaff", { item: "quarterstaff" }],
  ["spellbook", { item: "spellbook" }],
  ["martial melee weapon", { tags: ["martial", "melee"] }],
  ["martial weapon", { tags: ["martial"] }],
  ["martial weapons", { tags: ["martial"] }],
  ["simple weapon", { tags: ["simple"] }],
  ["simple melee weapon", { tags: ["simple", "melee"] }],
  ["simple melee weapons", { tags: ["simple", "melee"] }],
  ["other musical instrument", { set: "musical-instruments", except: ["lute"] }],
  ["holy symbol", { set: "holy-symbols" }],
  ["druidic focus", { set: "druidic-focuses" }],
  ["arcane focus", { set: "arcane-focuses" }],
  ["burglar's pack", { pack: "burglars-pack" }],
  ["diplomat's pack", { pack: "diplomats-pack" }],
  ["dungeoneer's pack", { pack: "dungeoneers-pack" }],
  ["entertainer's pack", { pack: "entertainers-pack" }],
  ["explorer's pack", { pack: "explorers-pack" }],
  ["priest's pack", { pack: "priests-pack" }],
  ["scholar's pack", { pack: "scholars-pack" }],
  // What the packs hold (SRD 5.1, Equipment Packs).
  ["backpack", { item: "backpack" }],
  ["bell", { item: "bell" }],
  ["candles", { item: "candle" }],
  ["crowbar", { item: "crowbar" }],
  ["hammer", { item: "hammer" }],
  ["pitons", { item: "piton" }],
  ["hooded lantern", { item: "lantern-hooded" }],
  ["flasks of oil", { item: "lamp-oil-flask" }],
  ["days rations", { item: "rations-1-day" }],
  ["days of rations", { item: "rations-1-day" }],
  ["tinderbox", { item: "tinderbox" }],
  ["waterskin", { item: "waterskin" }],
  ["chest", { item: "chest" }],
  ["cases for maps and scrolls", { item: "case-map-or-scroll" }],
  ["set of fine clothes", { item: "clothes-fine" }],
  ["bottle of ink", { item: "ink-1-ounce-bottle" }],
  ["ink pen", { item: "ink-pen" }],
  ["lamp", { item: "lamp" }],
  ["sheets of paper", { item: "paper-one-sheet" }],
  ["vial of perfume", { item: "perfume-vial" }],
  ["sealing wax", { item: "sealing-wax" }],
  ["soap", { item: "soap" }],
  ["torches", { item: "torch" }],
  ["bedroll", { item: "bedroll" }],
  ["costumes", { item: "clothes-costume" }],
  ["disguise kit", { item: "disguise-kit" }],
  ["mess kit", { item: "mess-kit" }],
  ["blanket", { item: "blanket" }],
  ["book of lore", { item: "book" }],
  ["sheets of parchment", { item: "parchment-one-sheet" }],
  ["alms box", { name: "Alms box" }],
  ["blocks of incense", { name: "Block of incense" }],
  ["censer", { name: "Censer" }],
  ["vestments", { name: "Vestments" }],
  ["little bag of sand", { name: "Little bag of sand" }],
  ["small knife", { name: "Small knife" }],
  // The Acolyte's equipment (SRD 5.1, Backgrounds, Acolyte).
  ["prayer book", { item: "book" }],
  ["prayer wheel", { name: "Prayer wheel" }],
  ["sticks of incense", { name: "Stick of incense" }],
  ["set of common clothes", { item: "clothes-common" }],
]);

// Phrases whose number is part of the thing rather than how many of it there are.
const WHOLE_PHRASES = new Map([
  ["a bag of 1,000 ball bearings", [{ item: "ball-bearings-bag-of-1000" }]],
  ["10 feet of string", [{ name: "String (10 feet)" }]],
  ["50 feet of hempen rope", [{ item: "rope-hempen-50-feet" }]],
  ["a quiver of 20 arrows", [{ item: "quiver" }, { item: "arrow-bow", count: 20 }]],
  ["quiver of 20 arrows", [{ item: "quiver" }, { item: "arrow-bow", count: 20 }]],
  ["a pouch containing 15 gp", [{ item: "pouch" }, { coins: "gp", count: 15 }]],
]);

const WORN = new Set(["armor", "shield"]);

function plainPhrase(phrase) {
  return phrase
    .replace(/\s*\([^)]*\)/gu, "")
    .replaceAll("’", "'")
    .trim()
    .toLowerCase();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The SRD's phrases joined by commas and "and", one by one. */
function splitPhrases(text) {
  return text
    .split(/,\s+(?:and\s+)?|\s+and\s+/u)
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}

/**
 * Starting gear for every class the source has, and the Acolyte, as the ruleset's `items.startingGear`.
 * `equipment` is the equipment catalog's entries; `itemSets` the source's item sets by pk.
 */
export function buildStartingGear({ classFeatures, classNames, acolyteText, itemSets, equipment }) {
  const entries = new Map(equipment.map((entry) => [entry.id, entry]));
  const ref = (id) => {
    if (!entries.has(id)) fail(`no equipment entry "${id}"`);
    return `${EQUIPMENT}/${id}`;
  };
  const setItems = (pk) => {
    const set = itemSets.get(`${pk}`);
    if (!set) fail(`the source has no item set "${pk}"`);
    return set;
  };
  const listOf = (spec, phrase) => {
    let ids;
    if (spec.tags) {
      ids = equipment
        .filter((entry) => entry.item.category === "weapon" && spec.tags.every((tag) => entry.item.tags?.includes(tag)))
        .map((entry) => entry.id);
    } else {
      ids = setItems(spec.set)
        .items.filter((pk) => pk.startsWith("srd_"))
        .map((pk) => pk.slice("srd_".length))
        .filter((id) => !(spec.except ?? []).includes(id));
    }
    const oneOf = [...new Set(ids)].sort().map(ref);
    if (oneOf.length < 2 || oneOf.length > 48) fail(`"${phrase}" lists ${oneOf.length} items`);
    return oneOf;
  };
  const line = (spec, count, phrase) => {
    if (spec.item) {
      const worn = WORN.has(entries.get(spec.item)?.item.category);
      return [{ item: ref(spec.item), ...(count > 1 ? { count } : {}), ...(worn ? { equip: true } : {}) }];
    }
    if (spec.coins) return [{ coins: spec.coins, count }];
    if (spec.name) return [{ name: spec.name, ...(count > 1 ? { count } : {}) }];
    if (spec.tags || spec.set) return Array.from({ length: count }, () => ({ oneOf: listOf(spec, phrase) }));
    if (count !== 1) fail(`"${phrase}" asks ${count} packs`);
    return packLines(spec.pack);
  };
  const linesOf = (phrase) => {
    const plain = plainPhrase(phrase);
    const whole = WHOLE_PHRASES.get(plain);
    if (whole) return whole.flatMap((spec) => line(spec, spec.count ?? 1, phrase));
    const [, word, rest] = /^(?:(a|an|any|two|four|five|\d+)\s+)?(.+)$/u.exec(plain);
    const spec = GEAR_NOUNS.get(rest);
    if (!spec) fail(`no table entry for "${phrase}"`);
    if (word === "any" && !spec.tags && !spec.set) fail(`"${phrase}" says "any" of one item`);
    const count = word === undefined || word === "any" ? 1 : (COUNTS.get(word) ?? Number(word));
    return line(spec, count, phrase);
  };
  // SRD 5.1, Equipment Packs: "Includes a backpack, ... and a waterskin. The pack also has 50 feet of
  // hempen rope strapped to the side of it."
  const packLines = (pk) => {
    const text = setItems(pk).desc;
    const match = /^Includes (.+?)\.(?: The pack also has (.+?) strapped to the side of it\.)?$/u.exec(text);
    if (!match) fail(`the ${pk} sentence is not "Includes ...": ${JSON.stringify(text)}`);
    const phrases = [...match[1].split(/,\s+(?:and\s+)?/u), ...(match[2] ? [match[2]] : [])];
    return phrases.flatMap(linesOf);
  };

  const gear = [];
  const byClass = [...classFeatures].sort((left, right) => left.className.localeCompare(right.className, "en"));
  for (const { pk, desc, className } of byClass) {
    const id = className.toLowerCase();
    if (!classNames.has(id)) fail(`${pk} is for no class the sheet has a level of`);
    const bullets = desc.split("\n").filter((each) => each.startsWith("* "));
    if (bullets.length < 1) fail(`${pk} lists no equipment`);
    const lines = [];
    const choices = [];
    for (const bullet of bullets) {
      const text = bullet.slice(2);
      const marks = [...text.matchAll(/\(\*([a-c])\*\)\s*/gu)];
      // A bullet with one "(a)" (the Rogue's last) has nothing to choose between.
      if (marks.length < 2) {
        lines.push(...splitPhrases(text.replace(/\(\*a\*\)\s*/u, "")).flatMap(linesOf));
        continue;
      }
      const options = marks.map((mark, index) => {
        const end = index + 1 < marks.length ? marks[index + 1].index : text.length;
        const said = text
          .slice(mark.index + mark[0].length, end)
          .replace(/[\s,]*(?:\bor)?[\s,]*$/u, "")
          .replaceAll("’", "'");
        const lines = splitPhrases(said).flatMap(linesOf);
        // The cleric's "a warhammer (if proficient)" and "chain mail (if proficient)" (0.301.0, Capability
        // API 1.661): offered only to a sheet trained in martial weapons or heavy armor.
        if (!/\(if proficient\)$/u.test(said)) return { label: capitalize(said), lines };
        const tags =
          lines.length === 1 ? (entries.get(lines[0].item?.slice(`${EQUIPMENT}/`.length))?.item.tags ?? []) : [];
        const derived = tags.includes("martial")
          ? "prof_martial_weapons"
          : tags.includes("heavy_armor")
            ? "prof_heavy_armor"
            : undefined;
        if (!derived) fail(`"${said}" names no martial weapon or heavy armor to be proficient with`);
        return { label: capitalize(said), lines, offeredWhen: { derived } };
      });
      choices.push({ label: `Choice ${choices.length + 1}`, options });
    }
    // Weapons arrive in hand (0.377.0): the ones picked at a choice, or the fixed ones where no choice
    // offers a weapon, never a stack thrown or spent (four javelins, ten darts). Armor and shields are
    // already worn. The Engine puts each on where its slots are still free, in order.
    const isWeapon = (ref) => entries.get(ref.slice(`${EQUIPMENT}/`.length))?.item.category === "weapon";
    const wielded = (one) =>
      (one.count ?? 1) <= 2 &&
      (one.item ? isWeapon(one.item) : (one.oneOf ?? []).length > 0 && one.oneOf.every(isWeapon));
    const chosen = choices.flatMap((choice) => choice.options.flatMap((option) => option.lines));
    for (const one of chosen.some(wielded) ? chosen : lines) if (wielded(one)) one.equip = true;
    gear.push({
      id,
      label: className,
      summary: `The SRD's ${className.toLowerCase()} equipment, taken beside a background's.`,
      group: "class",
      fits: { value: { field: `level_${id}` }, atLeast: 1 },
      lines,
      ...(choices.length > 0 ? { choices } : {}),
    });
  }

  // SRD 5.1, Acolyte, Equipment: "A holy symbol (...), a prayer book or prayer wheel, 5 sticks of
  // incense, vestments, a set of common clothes, and a pouch containing 15 gp". Its "or" is a choice.
  const acolyteLines = [];
  const acolyteChoices = [];
  for (const phrase of acolyteText.split(/,\s+(?:and\s+)?/u)) {
    const either = phrase.split(/\s+or\s+/u);
    if (either.length === 1) {
      acolyteLines.push(...linesOf(phrase));
      continue;
    }
    acolyteChoices.push({
      label: `Choice ${acolyteChoices.length + 1}`,
      options: either.map((said) => ({ label: capitalize(said), lines: linesOf(said) })),
    });
  }
  gear.push({
    id: "acolyte",
    label: "Acolyte",
    summary: "The SRD's Acolyte background equipment, taken beside a class's.",
    group: "background",
    lines: acolyteLines,
    ...(acolyteChoices.length > 0 ? { choices: acolyteChoices } : {}),
  });
  return gear;
}
