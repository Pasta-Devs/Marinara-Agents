# 5e (SRD 5.1)

A downloadable Game Mode **ruleset** (capability package, `ruleset` kind). It provides 5e rules
from the System Reference Document 5.1 for ability checks, skill checks, saving throws, spell
slots, hit dice, class resources, conditions, rests, and a full character sheet. Battles still use
Marinara's default combat, not 5e combat.

Requires **Marinara Engine 2.4.6+ with Capability API 1.21** (the ruleset seam plus catalogs:
hash-pinned `ruleset.json` and `catalogs/<id>.json` assets the Engine reads by reserved filename,
exactly like `gm-verbs.json`). Today that means the Engine `staging` branch; older hosts reject the
manifest and cannot install this package. This package ships no server entrypoint, no client
entrypoint, and no Agent. It is pure data: nothing here runs code, and no restart is needed after
install.

## What it contains

`ruleset.json` declares:

- A d20 resolution kind, ability modifiers, proficiency tiers, and a difficulty ladder.
- A full character sheet: six abilities, six saves, eighteen skills, identity/combat/spellcasting
  fields, derived values (proficiency bonus, initiative, passive Perception, spell save DC, spell
  attack bonus), and lists for attacks, spells, features, class resources, and proficiencies.
- Live play state: hit points, hit dice, spell slots, pact slots, death saves, exhaustion,
  concentration, and the standard conditions.
- Short and long rest recovery rules.
- GM guidance text for when to call for a check or save and how to read the sheet.

Every id in `ruleset.json` (`level`, `dex`, `slots`, and so on) is this file's own naming choice.
The Engine does not look for 5e-specific names; it reads the same closed set of resolution kinds
and sheet primitives that any ruleset package can use.

## Catalogs

A catalog is a collection of ready-made entries the sheet editor offers in a picker, so you do not
type a spell list or a page of class features row by row. This package ships three:

| Catalog | Entries | Fills | Ships as |
| --- | --- | --- | --- |
| Spells | 319 | Spells | `catalogs/spells.json` |
| Class features | 208 | Features and traits, Class resources | `catalogs/features.json` |
| Weapons | 36 | Attacks | inline in `ruleset.json` |

**A picked row is a copy.** It is yours from that moment: edit the numbers, rename it, delete it.
Your sheet keeps working while this package is uninstalled, and a later version of the package
never rewrites a character you already made.

**Battles do not use the numbers yet.** Each entry also records what it does in plain numbers
(range, damage dice, the save it calls for, the slot it spends). The Engine validates that block
and shows it in the picker, but combat still uses Marinara's default rules, not 5e combat. The
numbers are there so the content is entered once, ready for the combat work that will read it.

**Class resources start at their first value.** Picking a feature that the SRD gives a plain number
of uses, such as Second Wind, Rage, Wild Shape or Ki, also adds the class resource that tracks it.
The Engine has no class tables, so the maximum is the value at the level the feature is gained, and
you raise it yourself as you level up. Where the SRD ties the number to an ability modifier
(Bardic Inspiration, Divine Sense) the picker says so. A feature whose uses the SRD does not state
as a plain count gets no resource at all rather than a guessed one.

**Armor is not a catalog.** A catalog fills a list, and armor sets the sheet's Armor Class field,
which is not a list. Set **Armor Class** by hand on the Combat section of the sheet.

`catalogs/spells.json` and `catalogs/features.json` are generated. Rebuild them with
`node scripts/build-5e-srd-catalogs.mjs --source <fixtures dir>` from the repository root; do not
hand-edit them. The source, and the commit it was taken at, is recorded in each file and in
[LICENSE-SRD.md](LICENSE-SRD.md).

## Status

Available to Engine `staging` users only. The package is listed in `STAGING_ONLY_PACKAGE_IDS`, so
it is published to the preview overlay under `catalog/preview/` that staging Engines read, and is
hidden from stable `main` users. It stays there until the Capability API 1.21 ruleset and catalog
seam reaches a stable Engine release.

## Installing

Install it from **Agents** and **Download Agents** in a Marinara Engine build that supports
Capability API 1.21. After installing, choose it under Rules in the Game Mode setup wizard when you
create a new game.

## License

`ruleset.json` and the catalog files include material from the System Reference Document 5.1. See
[LICENSE-SRD.md](LICENSE-SRD.md) for the required attribution and for where the machine-readable
form of the catalog entries came from.
