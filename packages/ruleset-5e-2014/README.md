# 5e (SRD 5.1)

A downloadable Game Mode **ruleset** (capability package, `ruleset` kind). It provides 5e rules
from the System Reference Document 5.1 for ability checks, skill checks, saving throws, spell
slots, hit dice, class resources, conditions, rests, and a full character sheet. Battles start from
the sheet's own hit points and spell slots, but the combat arithmetic is still Marinara's, not 5e
combat.

Requires **Marinara Engine 2.4.6+ with Capability API 1.23** (the ruleset seam, catalogs, the
battle block, and scaled catalog columns: hash-pinned `ruleset.json` and `catalogs/<id>.json`
assets the Engine reads by reserved filename, exactly like `gm-verbs.json`). Today that means the
Engine `staging` branch; older hosts reject the manifest and cannot install this package. This
package ships no server entrypoint, no client entrypoint, and no Agent. It is pure data: nothing
here runs code, and no restart is needed after install.

## What it contains

`ruleset.json` declares:

- A d20 resolution kind, ability modifiers, proficiency tiers, and a difficulty ladder.
- A full character sheet: six abilities, six saves, eighteen skills, identity/combat/spellcasting
  fields, derived values (proficiency bonus, initiative, passive Perception, spell save DC, spell
  attack bonus, and the Bardic Inspiration, Divine Sense and Lay on Hands maximums), and lists for
  attacks, spells, features, class resources, and proficiencies.
- Live play state: hit points, hit dice, spell slots, pact slots, death saves, exhaustion,
  concentration, and the standard conditions.
- Short and long rest recovery rules.
- GM guidance text for when to call for a check or save and how to read the sheet.
- A `battle` block: what a fight may read from the sheet, and what it writes back.

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

**Battles read some of the numbers.** Each entry also records what it does in plain numbers
(range, damage dice, the save it calls for, the slot it spends). A fight turns the marked rows into
its own skills from that block, as described under Battles below. The save, the attack roll, the
concentration and what a higher slot would add are recorded but not applied.

**Class resources keep themselves.** Picking a feature that the SRD gives a plain number of uses,
such as Second Wind, Rage, Wild Shape or Ki, also adds the class resource that tracks it. Nine of
them are **scaled**: the sheet works the maximum out and keeps it current as you level up, and the
cell is shown as read only.

| Class resource | Maximum follows | Where the number comes from |
| --- | --- | --- |
| Rage | Level | The Barbarian table's Rages column |
| Ki | Level | The Monk table's Ki Points column |
| Sorcery Points | Level | The Sorcerer table's Sorcery Points column |
| Channel Divinity | Level | The Cleric table: 1 at 2nd, 2 at 6th, 3 at 18th |
| Action Surge | Level | The Fighter table: 1 at 2nd, 2 at 17th |
| Indomitable | Level | The Fighter table: 1 at 9th, 2 at 13th, 3 at 17th |
| Bardic Inspiration | Charisma | Your Charisma modifier, at least one |
| Divine Sense | Charisma | 1 plus your Charisma modifier |
| Lay on Hands | Level | Your level times 5 |

Second Wind, Wild Shape and Arcane Recovery are not scaled, because the SRD never raises them: a
20th-level druid's unlimited Wild Shape comes from the separate Archdruid feature, not from a
bigger number. Rage stops at six for the same reason: the Barbarian table says Unlimited at 20th
level, which is not a number a counter can hold. A feature whose uses the SRD does not state as a
plain count gets no resource at all rather than a guessed one.

**Your sheet has one Level field**, because a ruleset sheet has no notion of a class and so cannot
have a level per class. A multiclass character's class resources therefore follow the **total**
level, which is right for a single-class character and generous for a multiclass one. If you want
your own number, delete the picked row and type one: a row you typed is never kept by the ruleset.

**Armor is not a catalog.** A catalog fills a list, and armor sets the sheet's Armor Class field,
which is not a list. Set **Armor Class** by hand on the Combat section of the sheet.

`catalogs/spells.json` and `catalogs/features.json` are generated. Rebuild them with
`node scripts/build-5e-srd-catalogs.mjs --source <fixtures dir>` from the repository root; do not
hand-edit them. The source, and the commit it was taken at, is recorded in each file and in
[LICENSE-SRD.md](LICENSE-SRD.md).

## Battles

`ruleset.json` carries a `battle` block, so a fight starts from the character sheet:

- **In:** the hit point pool, the nine spell slot pools, and the rows you marked on the Spells and
  Attacks lists. A spell counts when it is prepared, and a cantrip counts whether or not it is
  marked prepared, because a cantrip is cast without being prepared.
- **Out:** the damage you took, and the slots the fight spent, through the same sheet operations
  your own buttons use. A refused change is skipped and reported, not forced. An abandoned fight
  writes nothing.

Health crosses as a **share of the maximum**, not as your own number: a character at half hit
points starts at half of the health bar Marinara built for them, so an 8-point level 1 wizard is not
killed by the first blow. Everything else about the fight stays Marinara's: maximum hit points,
attack, defense, speed and level, and all of the damage arithmetic.

**This is not a 5e combat system.** Attack rolls, saving throws, concentration, and what a higher
slot would add are recorded on the catalog entries and applied by nobody. `coverage.combat` is
still `false` and means what it always meant.

**Only catalog rows become skills.** A row you typed by hand has no numbers behind it, so it brings
nothing into the fight. Utility entries and reactions (Shield) stay out too, because Marinara's
combat has nowhere to put them.

**Pact Magic slots stay out.** Their level follows the character's own level, and a fixed list of
levels cannot say that. A warlock's pact slots are still on the sheet and still refill on a short
rest; they are simply not lent to a fight.

**Healing spells heal.** The SRD's eight healing spells (Cure Wounds, Healing Word, Mass Cure
Wounds, Mass Healing Word, Prayer of Healing, Heal, Mass Heal, Regenerate) are marked as heals with
the amount their own text states. Mass Heal carries no amount, because its 700 hit points are a pool
shared among any number of creatures rather than what one target regains.

The `battle` block is hand-authored and sits **above** `catalogs` in `ruleset.json`, because the
converter rewrites the catalogs key and every byte after it. The converter refuses to run when the
block has drifted below.

## Status

Available to Engine `staging` users only. The package is listed in `STAGING_ONLY_PACKAGE_IDS`, so
it is published to the preview overlay under `catalog/preview/` that staging Engines read, and is
hidden from stable `main` users. It stays there until the Capability API 1.23 ruleset, catalog,
battle and scaled-column seam reaches a stable Engine release.

## Installing

Install it from **Agents** and **Download Agents** in a Marinara Engine build that supports
Capability API 1.23. After installing, choose it under Rules in the Game Mode setup wizard when you
create a new game.

## License

`ruleset.json` and the catalog files include material from the System Reference Document 5.1. See
[LICENSE-SRD.md](LICENSE-SRD.md) for the required attribution and for where the machine-readable
form of the catalog entries came from.
