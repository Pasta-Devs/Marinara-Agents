// What the guided character builder needs from the SRD, read out of the Open5e fixtures and checked
// against them: each class's hit die, saving throws, skill choices, weapon training and spellcasting
// ability; each race's ability score increases; the Acolyte's skills and languages. The builder's own
// keys are the Engine's to name (design-records/design-5e-character-builder.md), so this module only
// reads and checks; build-5e-srd-catalogs.mjs writes it into the catalogs once the keys exist.

function fail(message) {
  throw new Error(message);
}

const ABILITY_IDS = new Map([
  ["strength", "str"],
  ["dexterity", "dex"],
  ["constitution", "con"],
  ["intelligence", "int"],
  ["wisdom", "wis"],
  ["charisma", "cha"],
]);
const SKILL_IDS = new Map(
  [
    "Acrobatics",
    "Animal Handling",
    "Arcana",
    "Athletics",
    "Deception",
    "History",
    "Insight",
    "Intimidation",
    "Investigation",
    "Medicine",
    "Nature",
    "Perception",
    "Performance",
    "Persuasion",
    "Religion",
    "Sleight of Hand",
    "Stealth",
    "Survival",
  ].map((name) => [name.toLowerCase(), name.toLowerCase().replaceAll(" ", "_")]),
);
const COUNT_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
]);

const oneLine = (text) =>
  String(text ?? "")
    .replace(/\s+/gu, " ")
    .trim();

/** The sheet's `weapon_training` value for what a class's Weapons line says. The sheet's field names
 *  four groups; the druid's, sorcerer's and wizard's short lists and the monk's shortswords read as the
 *  nearest, as the field's own comment says. */
function weaponTraining(line) {
  const text = line.toLowerCase();
  if (/simple weapons, martial weapons/u.test(text)) return "simple_martial";
  if (/simple weapons, hand crossbows, longswords, rapiers, shortswords/u.test(text)) return "simple_named";
  if (/^simple weapons, shortswords$/u.test(text)) return "simple_shortsword";
  return "simple";
}

/** One entry for each SRD class (not subclasses), keyed by class name. `features` are the fixture's
 *  class features, read for the Proficiencies and Spellcasting texts. */
export function classBuilderData(classes, features) {
  const byPk = new Map(features.map((feature) => [feature.pk, feature]));
  const out = new Map();
  for (const { pk, fields } of classes) {
    if (fields.subclass_of) continue;
    const name = fields.name;
    const slug = pk.replace(/^srd_/u, "");
    // The fixture spells the sorcerer's proficiencies "sorceror".
    const proficiencies =
      byPk.get(`${pk}_proficiencies`) ?? byPk.get(`srd_${slug === "sorcerer" ? "sorceror" : slug}_proficiencies`);
    if (!proficiencies) fail(`${name} has no Proficiencies feature`);
    const text = oneLine(proficiencies.fields.desc);
    const part = (label) => {
      const match = new RegExp(`\\*\\*${label}:\\*\\* (.*?)(?= \\*\\*|$)`, "u").exec(text);
      if (!match) fail(`${name}'s Proficiencies no longer has a ${label} line`);
      return match[1].trim();
    };
    const saves = part("Saving Throws")
      .split(/,\s*/u)
      .map((word) => ABILITY_IDS.get(word.toLowerCase()) ?? fail(`${name} saves "${word}"`))
      .map((ability) => `${ability}_save`);
    const fixtureSaves = (fields.saving_throws ?? []).map((ability) => `${ability}_save`).sort();
    if (JSON.stringify([...saves].sort()) !== JSON.stringify(fixtureSaves)) {
      fail(`${name}'s saving throws disagree: the text says ${saves}, the class record ${fixtureSaves}`);
    }
    const skillsLine = part("Skills");
    const any = /^Choose any (\w+)$/u.exec(skillsLine);
    const from = /^Choose (\w+) (?:skills )?from (.+)$/u.exec(skillsLine);
    let skills;
    if (any) {
      skills = {
        choose: COUNT_WORDS.get(any[1]) ?? fail(`${name} chooses "${any[1]}"`),
        from: [...SKILL_IDS.values()],
      };
    } else if (from) {
      const list = from[2]
        .replace(/,? and /u, ", ")
        .split(/,\s*/u)
        .map((skill) => SKILL_IDS.get(skill.trim().toLowerCase()) ?? fail(`${name} offers the skill "${skill}"`));
      skills = { choose: COUNT_WORDS.get(from[1]) ?? fail(`${name} chooses "${from[1]}"`), from: list };
    } else fail(`${name}'s Skills line is "${skillsLine}"`);
    const die = /^D(6|8|10|12)$/u.exec(fields.hit_dice ?? "") ?? fail(`${name}'s hit die is ${fields.hit_dice}`);
    const ability = features
      .filter((feature) => feature.fields.parent === pk)
      .map((feature) =>
        /(Intelligence|Wisdom|Charisma) is your spellcasting ability/u.exec(oneLine(feature.fields.desc)),
      )
      .find(Boolean);
    out.set(name, {
      level: `level_${slug}`,
      hitDie: `d${die[1]}`,
      saves,
      skills,
      armor: part("Armor"),
      weapons: part("Weapons"),
      weaponTraining: weaponTraining(part("Weapons")),
      tools: part("Tools"),
      ...(ability ? { spellcastingAbility: ABILITY_IDS.get(ability[1].toLowerCase()) } : {}),
    });
  }
  if (out.size !== 12) fail(`expected the SRD's 12 classes, read ${out.size}`);
  return out;
}

/** Each race's and subrace's ability score increases, read off its Ability Score Increase trait:
 *  fixed ones as `add`, and the half-elf's "two other ability scores of your choice" as `choose`. */
export function raceIncreases(species, traits) {
  const out = new Map();
  for (const { pk, fields } of species) {
    const trait = traits.find((each) => each.fields.parent === pk && each.fields.name === "Ability Score Increase");
    if (!trait) fail(`${fields.name} has no Ability Score Increase`);
    const text = oneLine(trait.fields.desc);
    const add = {};
    for (const match of text.matchAll(/(?:Your|your) (\w+) score increases by (\d)/gu)) {
      add[ABILITY_IDS.get(match[1].toLowerCase()) ?? fail(`${fields.name} raises "${match[1]}"`)] = Number(match[2]);
    }
    if (/Your ability scores each increase by 1/u.test(text)) for (const id of ABILITY_IDS.values()) add[id] = 1;
    const choose = /(\w+) other ability scores of your choice increase by (\d)/u.exec(text);
    if (Object.keys(add).length === 0 && !choose) fail(`${fields.name}'s increase "${text}" was not read`);
    out.set(fields.name, {
      add,
      ...(choose
        ? { choose: { count: COUNT_WORDS.get(choose[1]), amount: Number(choose[2]), except: Object.keys(add) } }
        : {}),
    });
  }
  return out;
}

/** The SRD's one background, the Acolyte: its skills and its languages to choose. */
export function backgroundData(backgrounds, benefits) {
  const out = new Map();
  for (const { pk, fields } of backgrounds) {
    const of = (type) => benefits.find((benefit) => benefit.fields.parent === pk && benefit.fields.type === type);
    const skills = of("skill_proficiency");
    const languages = of("language");
    const fixed = skills
      ? oneLine(skills.fields.desc)
          .replace(/\.$/u, "")
          .split(/,\s*| and /u)
          .map((skill) => SKILL_IDS.get(skill.trim().toLowerCase()) ?? fail(`${fields.name} trains "${skill}"`))
      : [];
    out.set(fields.name, {
      skills: fixed,
      languages: languages ? oneLine(languages.fields.desc) : null,
    });
  }
  return out;
}

/** The rows of a Markdown table in an SRD rule's text, after its header and rule line. */
function tableRows(text) {
  return String(text ?? "")
    .split(/\r?\n/u)
    .filter((line) => /^\|/u.test(line.trim()))
    .slice(2)
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/gu, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
}

const PROFICIENCY_WORDS = new Map([
  ["light armor", { armor: "light" }],
  ["medium armor", { armor: "medium" }],
  ["shields", { armor: "shields" }],
  ["simple weapons", { weapons: "simple" }],
  ["martial weapons", { weapons: "martial" }],
  ["shortswords", { weapons: "shortswords" }],
  ["thieves' tools", { tools: "thieves-tools" }],
  ["one skill of your choice", { skills: "any" }],
  ["one skill from the class's skill list", { skills: "class" }],
  ["one musical instrument of your choice", { tools: "instrument" }],
]);

/**
 * SRD 5.1 Multiclassing, read out of its two rules: each class's ability prerequisites (`all` of them
 * at 13 or more, or `any` of them) and the part of its training a class taken after the first gives.
 * Checked against `classes` (classBuilderData's map): every class is read once, and what a second
 * class gives is a part of what its first level gives.
 */
export function multiclassData(rules, classes) {
  const rule = (pk) => rules.find((record) => record.pk === pk)?.fields?.desc ?? fail(`no SRD rule ${pk}`);
  const out = new Map();
  for (const [name, minimum] of tableRows(rule("srd_multiclassing_prerequistes"))) {
    const parts = minimum.split(/ (and|or) /u);
    const abilities = parts
      .filter((_, index) => index % 2 === 0)
      .map((part) => {
        const read = /^(\w+) 13$/u.exec(part.trim()) ?? fail(`${name}'s prerequisite "${part}" is not "Ability 13"`);
        return ABILITY_IDS.get(read[1].toLowerCase()) ?? fail(`${name}'s prerequisite names "${read[1]}"`);
      });
    out.set(name, { prerequisites: { [parts.includes("or") ? "any" : "all"]: abilities }, gains: {} });
  }
  for (const [name, gained] of tableRows(rule("srd_multiclassing_proficiencies"))) {
    const entry = out.get(name) ?? fail(`${name} has proficiencies but no prerequisites`);
    const gains = { armor: [], weapons: [], tools: [], skills: [] };
    const text = gained.replace(/\s*\([^)]*\)/gu, "").trim();
    if (text !== "-") {
      for (const part of text.split(/,\s*/u)) {
        const read = PROFICIENCY_WORDS.get(part.trim().toLowerCase()) ?? fail(`${name} gains "${part}", not read`);
        for (const [kind, value] of Object.entries(read)) gains[kind].push(value);
      }
    }
    entry.gains = gains;
  }
  if (out.size !== 12) fail(`expected the SRD's 12 classes in the multiclassing tables, read ${out.size}`);
  for (const [name, data] of out) {
    const full = classes.get(name) ?? fail(`multiclassing names "${name}", no SRD class`);
    const armor = full.armor.toLowerCase();
    for (const kind of data.gains.armor) {
      // A class whose line says "All armor" trains the light and the medium.
      const trained =
        kind === "shields" ? armor.includes("shield") : armor.includes(kind) || armor.includes("all armor");
      if (!trained) fail(`${name} multiclasses into ${kind}, which it never trains`);
    }
    if (data.gains.skills.includes("class") && full.skills.from.length === 0) fail(`${name} has no skill list`);
  }
  return out;
}
