# 5e (SRD 5.1)

A downloadable Game Mode **ruleset** (capability package, `ruleset` kind). It provides 5e rules
from the System Reference Document 5.1 for ability checks, skill checks, saving throws, spell
slots, hit dice, class resources, conditions, rests, and a full character sheet. Battles still use
Marinara's default combat, not 5e combat.

Requires **Marinara Engine 2.4.6+ with Capability API 1.20** (the ruleset seam: a hash-pinned
`ruleset.json` asset the Engine reads by reserved filename, exactly like `gm-verbs.json`). The
version range stays at 2.4.6 until an Engine release carries this interface; older hosts reject the
manifest and cannot install this package. This package ships no server entrypoint, no client
entrypoint, and no Agent. It is pure data: nothing here runs code, and no restart is needed after
install.

## What it contains

`ruleset.json` is the whole package payload. It declares:

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

## Status

This package is a skeleton and is listed in `INCOMPLETE_PACKAGE_IDS`, so it is hidden from every
Engine channel until the Capability API 1.20 ruleset seam ships in the Engine and this package is
rebuilt and validated against it.

## License

`ruleset.json` includes material from the System Reference Document 5.1. See
[LICENSE-SRD.md](LICENSE-SRD.md) for the required attribution.
