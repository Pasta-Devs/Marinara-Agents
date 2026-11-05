# 5e (SRD 5.1)

A downloadable Game Mode **ruleset** (capability package, `ruleset` kind). It provides 5e rules
from the System Reference Document 5.1 for ability checks, skill checks, saving throws, spell
slots, hit dice, class resources, conditions, rests, a full character sheet, and 5e combat itself:
a battle in a game on this ruleset is fought by these rules, on screen, against the SRD's own
monsters.

It is pure data: no server entrypoint, no client entrypoint and no Agent, so nothing here runs
code and no restart is needed after install.

**Requires** Marinara Engine 2.5.1 or newer with Capability API 1.812. Today that means the Engine
`staging` branch; older Engines refuse the manifest and cannot install it.

This README is the guide to what the package holds and how it plays. [MODELING.md](MODELING.md)
says, feature by feature, how each class feature, spell, monster and item is written in the
Engine's terms, and [CHANGELOG.md](CHANGELOG.md) is the release history.

## Installing

Install it from **Agents** and **Download Agents** in Marinara Engine. After installing, choose it
under **Rules** in the Game Mode setup wizard when you create a new game. Choose the **Tactical**
combat style in the same wizard if you want the fight played on a board; **Classic** plays the
same fight without positions.

The ruleset's text follows the Engine's language setting. The Engine downloads only that
language's pack and falls back to English for a language without one.

## What it contains

`ruleset.json` declares:

- A d20 resolution kind, ability modifiers, proficiency tiers, and a difficulty ladder.
- A full character sheet: six abilities, six saves, eighteen skills, a level in each class (for
  multiclassing), identity/combat/spellcasting fields, derived values (character level, proficiency
  bonus, initiative, passive Perception, spell save DC, spell attack bonus, caster level, spell and
  pact slots, and the Bardic Inspiration, Divine Sense and Lay on Hands maximums), and lists for
  attacks, spells, features, class resources, and proficiencies.
- Live play state: hit points, hit dice (one pool per die), spell slots, pact slots, death saves,
  exhaustion, concentration, and the standard conditions.
- Short and long rest recovery rules.
- GM guidance text for when to call for a check or save and how to read the sheet.
- A `battle` block: what a fight may read from the sheet, and what it writes back.
- A `combat` block: how a battle is fought by 5e's own rules, which is what a game plays on,
  including what one square of a battlefield is worth. See 5e combat and On a board below.

Every id in `ruleset.json` (`level_fighter`, `dex`, `slots_1`, and so on) is this file's own naming choice.
The Engine does not look for 5e-specific names; it reads the same closed set of resolution kinds
and sheet primitives that any ruleset package can use.

## Catalogs

A catalog is a collection of ready-made entries the sheet editor offers in a picker, so you do not
type a spell list or a page of class features row by row. This package ships twelve:

| Catalog         | Entries | Fills                                                       | Ships as                        |
| --------------- | ------- | ----------------------------------------------------------- | ------------------------------- |
| Spells          | 325     | Spells                                                      | `catalogs/spells.json`          |
| Class features  | 326     | Features and traits, Class resources                        | `catalogs/features.json`        |
| Races           | 23      | Features and traits, proficiencies, Class resources, Spells | `catalogs/races.json`           |
| Classes         | 12      | proficiencies (the guided builder's Class step)             | `catalogs/classes.json`         |
| Backgrounds     | 1       | Features and traits, proficiencies                          | `catalogs/backgrounds.json`     |
| Languages       | 16      | proficiencies                                               | `catalogs/languages.json`       |
| Tools           | 35      | proficiencies                                               | `catalogs/tools.json`           |
| Fighting styles | 6       | Features and traits                                         | `catalogs/fighting_styles.json` |
| Weapons         | 36      | Attacks                                                     | `catalogs/weapons.json`         |
| Equipment       | 197     | nothing: it holds items for the bag                         | `catalogs/equipment.json`       |
| Magic items     | 966     | nothing: it holds items for the bag                         | `catalogs/magic_items.json`     |
| Creatures       | 323     | nothing: it is a bestiary                                   | `catalogs/creatures.json`       |

Every catalog is its own file, and `ruleset.json` holds only each one's header. The Engine drops a
`ruleset.json` over 512 KB (524,288 bytes, spaces and `$comment` text included, since Capability API
1.340; it was 256 KB before), so since 0.187.0 the
file is written compact, one line per derived value, condition or builder step, and `validate-catalog`
refuses a build that grows past the cap.

Three are the odd ones out. The bestiary writes no rows onto anyone's sheet, so the picker never
offers it; it is the other side of a fight, and the Creatures section below says what is in it. The
equipment and the magic items are items for a character's bag, and the sections below say what they
do.

**A picked row is a copy.** It is yours from that moment: edit the numbers, rename it, delete it.
Your sheet keeps working while this package is uninstalled, and a later version of the package
never rewrites a character you already made.

**Battles read the mechanics.** Each entry records its range, damage, save and resource cost.
The usual 5e combat path applies attack rolls, saves, concentration and higher-slot damage.
With the combat director off, the battle bridge lends marked rows to Marinara's combat, where
those 5e rules are recorded but not applied; see Battles below.

**Class resources keep themselves.** Picking a feature that the SRD gives a plain number of uses,
such as Second Wind, Rage, Wild Shape or Ki, also adds the class resource that tracks it. Nine of
them are **scaled**: the sheet works the maximum out and keeps it current as you level up, and the
cell is shown as read only.

| Class resource     | Maximum follows | Where the number comes from                       |
| ------------------ | --------------- | ------------------------------------------------- |
| Rage               | Barbarian level | The Barbarian table's Rages column                |
| Ki                 | Monk level      | The Monk table's Ki Points column                 |
| Sorcery Points     | Sorcerer level  | The Sorcerer table's Sorcery Points column        |
| Channel Divinity   | Cleric level    | The Cleric table: 1 at 2nd, 2 at 6th, 3 at 18th   |
| Action Surge       | Fighter level   | The Fighter table: 1 at 2nd, 2 at 17th            |
| Indomitable        | Fighter level   | The Fighter table: 1 at 9th, 2 at 13th, 3 at 17th |
| Bardic Inspiration | Charisma        | Your Charisma modifier, at least one              |
| Divine Sense       | Charisma        | 1 plus your Charisma modifier                     |
| Lay on Hands       | Paladin level   | Your paladin level times 5                        |
| Wild Shape         | Druid level     | 2, and unlimited from 20th level (Archdruid)      |

"Unlimited" is 999 uses, more than a day between rests can spend: the Barbarian table's Rages column
at 20th level, and a 20th-level druid's Wild Shape with Archdruid (since 0.211.0). Second Wind,
Arcane Recovery and Wholeness of Body are not scaled, because the SRD never raises them. A feature
whose uses the SRD does not state as a plain count gets no resource at all rather than a guessed one.

**Each resource follows its own class's level**, so a Barbarian 3 / Fighter 2 rages three times and
has one Action Surge. Sneak Attack grows with the rogue level, and a cantrip with the character level,
as the SRD has them. If you want your own number, delete the picked row and type one: a row you
typed is never kept by the ruleset.

## Classes and multiclassing

The sheet has a level for each SRD class under **Class levels**, and an **Other class** level for a
class the SRD does not have. A single-class character fills in one of them; a multiclass character
fills in each. The rest is worked out:

- **Level** is every class level together, from 1 to 20, and the proficiency bonus follows it.
- **Hit dice** are kept one pool per die: d12 for barbarian levels, d10 for fighter, paladin and
  ranger, d8 for bard, cleric, druid, monk, rogue and warlock, d6 for sorcerer and wizard, and the
  **Other class hit die** for the Other class level. A long rest gives back half of all of them
  (at least one), shared out over d12, d10, d8 and d6 dice in that order, then the Other class's.
  At a short rest the Game Master spends them for you: each die rolled plus your Constitution
  modifier, from the pool it names or the biggest die first, with the party's Song of Rest on top.
- **Spell slots** follow the caster level, as SRD 5.1 Multiclassing says: all your bard, cleric,
  druid, sorcerer and wizard levels and half your paladin and ranger levels (rounded down), on the
  Multiclass Spellcaster table. A paladin or ranger with no other Spellcasting class follows their own
  table instead, which a paladin or ranger level counts toward from 2nd level. The slot fields under
  Spellcasting are now **by hand**: the sheet takes the higher of the table and what you type, so a
  monster's printed slots, or a homebrew class's, still count.
- Each spell's **Class** picks its spell attack and save DC; the guided builder fills it from the class that offered the spell (Capability API 1.130), and **Any** uses the sheet's **Spellcasting ability** (Capability API 1.108).
- **Hit points** follow the method chosen under **Hit points**:
  - **Average** takes the SRD's fixed values: the largest hit die among your class levels at its
    highest face for 1st level, the die's average for every level after, and your Constitution
    modifier for each level.
  - **Rolled** takes 1st level at its highest face too, then one row of **Hit point rolls** for each
    later level: pick that level's class hit die and press **Roll** (the Engine's own dice), or type
    what you rolled at the table. Constitution is added by the sheet.
  - **By hand** is the number typed under **Hit point maximum by hand**.
  - **Auto**, the default, is Average unless a number is typed by hand, so a character made before
    0.21.0 keeps the number it had, and a creature its printed hit points.

  Every method gives at least 1. 1st level is the largest hit die among your class levels unless
  **1st level hit die** names your first class's (a wizard who later took fighter levels picks d6).
  With Rolled, **Hit point rolls still to make** says how many levels have no row yet (below 0: too
  many rows; 1st level needs none).

  A character made before 0.21.0 keeps the number it had typed, which for one whose hit points were
  never touched is the old default of 8: switch **Hit points** to **Average** to have them worked out.

- **Extra Attack** follows the class levels: a fighter attacks twice from 5th level, three times
  from 11th and four times at 20th; a barbarian, monk, paladin or ranger twice from 5th. A character
  with Extra Attack from two classes gets the highest, as SRD 5.1 Multiclassing says. **Attacks per
  Attack action by hand** is a floor for anything else that grants more attacks.
- **Cantrips known**, **Spells known** and **Spells prepared** follow each class's level: the class
  tables' columns for the bard, cleric, druid, ranger, sorcerer, warlock and wizard, and the ability
  modifier plus the level (half the level for a paladin, at least one) for the classes that prepare.
  The builder's Cantrips and Spells steps ask for that many.
- **Pact slots** and the **pact slot level** follow the warlock level, and stay apart from the other
  slots as the SRD keeps them. The typed pact fields are by hand too.
- **Class** and **Subclasses** stay free text ("Fighter 3 / Wizard 2"). The Game Master reads them,
  and the spell and feature catalogs open on the class when the text is one class's name ("Wizard"),
  on any class otherwise. Nothing in a fight reads which subclass you have;
  pick each subclass's features from the Class features catalog at that class's level.

**Characters made before this version** keep their numbers. Their one Level goes to the class their
Class text names (a subclass name or a few common variants count too), and their spent hit dice to
that class's die. A Class text that names no SRD class, or several ("Fighter 3 / Wizard 2"), puts the
whole level on the Other class: move the levels to the right classes by hand. A paladin on the Other
class has no Lay on Hands until then, since nothing reads Other levels. The Game Master's sheet
commands name the hit dice by die now (`hit_dice_d10`), not `hit_dice`.

**Limits.**

- Other class levels count toward your level and Other class hit dice, and nothing else: no class
  table, resource or spell slot reads them. Type a homebrew caster's slots by hand.
- A high elf's or tiefling's racial spells have their own (**Racial spells ability**).
- A spell is paid from the spell slots of its level or higher. Pact slots pay for any spell up to
  the pact slot level, at that level (Capability API 1.171), so a 5th-level warlock's Hold Person
  is cast at 3rd level and takes two humanoids. They refill on a short rest.
- Eldritch Knights and Arcane Tricksters, whose third-caster tables are not SRD, type their slots.
- Spent hit dice land on a die once, at the first change after the update. Class levels corrected by
  hand after that leave them where they landed, and a rewind to a save from before a second class was
  added sends them to the Other class's dice.
- **Levels and hit points** in the guided builder refuses a combined class level above 20.
  **All fields** caps each class at 20, and since 0.302.0 their combined total too (`sheet.totals`,
  Capability API 1.672): each class field's most is lowered by the levels the others hold.

## The guided builder

The sheet editor opens on a **Guided** view (beside **All fields**) that makes a character in steps, after
Dungeon Master's Vault's: **Race** and **Subrace**, **Class**, **Levels and hit points**, **Ability Scores**,
**Background**, **Proficiencies**, **Languages**, **Tools**, **Class features**, **Fighting Style**, **Metamagic**, **Pact Boon**, **Eldritch Invocations**, **Bonus cantrip**, **Cantrips**, **Spells**, **Racial cantrip** and **Equipment**. Each step says how many
choices it still waits on, and none of them blocks the next.

- **Ability Scores**: point buy (27 points, every score from 8 up to 15, at the SRD's costs), the standard
  array (15, 14, 13, 12, 10, 8), 4d6 keeping the best three for each score (the Engine's dice), or typed.
  The race's increases go on top, and the half-elf picks its two here.
- **Race** adds its increases and, for an elf or a half-orc, the skill a trait trains (a half-elf picks
  two). **Subrace** offers the picked race's subraces.
- **Class** sets that class's level to 1, its hit die for 1st level, its weapon training, its spellcasting
  ability and, for a barbarian or a monk, Unarmored Defense; it trains the class's saving throws, offers
  its skills on **Proficiencies**, and puts its armor, weapon and tool training on the proficiencies list.
  More class levels, the hit point method and the subclass's name are on **Levels and hit points** (a subclass's features are picked on **Class features**).
- **Background** is the SRD's Acolyte: Insight and Religion, two languages of your choice and Shelter of
  the Faithful. Its gear is in **Equipment**, the starting gear you take from the inventory in a game.
- **Languages** and **Tools** are where the picks' own choices are made: a human's, half-elf's or high
  elf's extra language (never one the race already speaks) and the Acolyte's two; the dwarf's one of
  smith's tools, brewer's supplies or mason's tools, the bard's three musical instruments and the
  monk's one artisan's tools or instrument. Each goes on the proficiencies list.
- **Class features**, **Cantrips** and **Spells** offer the picked class's entries from those catalogs.
- **Fighting Style**: picking a fighter's, paladin's or ranger's Fighting Style (or a Champion's
  Additional Fighting Style) asks for one style from that class's list, never one already taken.
  **Defense** adds 1 to Armor Class while armor is worn, and **Archery** adds 2 to the attack rolls of
  every ranged weapon held from the bag (Capability API 1.95; a thrown dagger is a melee weapon and
  takes none) and to every Attacks row that only shoots, its Reach 0 (1.800). **Dueling** adds 2 to the
  damage of a melee weapon held in one hand while it is the only weapon held, and **Two-Weapon
  Fighting** keeps the ability modifier on the off-hand attack's damage (Capability API 1.97).
  **Great Weapon Fighting** throws a melee weapon's 1s and 2s on its damage dice again once, the new
  face standing, while it is wielded two-handed (Capability API 1.98). **Protection** is a reaction
  taken when a creature you can see attacks an ally within 5 feet of you (Capability API 1.131): that
  attack roll has disadvantage. It is offered only while you wear a shield (`usableWhen`, Capability
  API 1.166).
- **Ability Score Improvement** is one Class features entry for each level the class gets it (4th, 8th,
  12th, 16th and 19th; a fighter also 6th and 14th, a rogue 10th). Picking one asks, at **Ability
  Scores**, for +2 to one score or +1 to two, never past 20 (Capability API 1.96): a score at 20
  takes no more from it, though a belt or a manual may still raise one past it.
- **Feats**: the SRD has one, **Grappler** (Strength 13 or higher). **Class features** offers it at each
  improvement's level, in its place: picking one drops the other (Capability API 1.94). It is offered
  only while Strength is 13 or more without the improvement it takes the place of (Capability API
  1.100). Take it once; picked at two levels it writes its row twice. The catalog picker in **All
  fields** offers it on its own, to anyone.
- **Cantrips** asks for the class's cantrips known at its level. **Spells** asks for its spells known
  (bard, ranger, sorcerer, warlock) or the spells it prepares (cleric, druid, paladin). A wizard fills
  **Spellbook** instead, up to 44 picks: six at 1st level and two more each level after, so 32 to 44
  from 14th to 20th level; **Prepared spells** then ticks the ones prepared. A level lowered later keeps the picks
  past the new count but they count for nothing until the level comes back.
- **Racial cantrip**: a high elf picks one wizard cantrip. A tiefling's thaumaturgy comes with the race.
  Either race sets **Racial spells ability** (Intelligence or Charisma), and the sheet shows a racial
  spell save DC and attack bonus off it, whatever the class casts with.
- Unpicking takes back what a pick gave, and only that. The builder trains skills to Proficient.
- **Beginner-safe by default.** A new character's scores open on point buy, and **Class features**
  and **Spells** offer only what the character's level allows: features up to their level, spells up
  to the highest level they have a slot for, and cantrips. **Manual entry** and **All fields** are the
  free edit, for anyone who wants scores or picks beyond the rules.
  A level raised in **All fields** opens new features and spells once the builder next changes (a
  pick, or a level typed on **Levels and hit points**, applies at once).
- A character made before, or in **All fields**, opens **described**: its picks record what it already
  is and change nothing, until **Done: let picks change the sheet**. A class pick never lowers a
  level already set.
- **Multiclassing**: the Class step takes a first class and, once their SRD prerequisites are met, a
  second and a third (Capability API 1.99): Strength 13 for a barbarian, Strength or Dexterity 13 for
  a fighter, and so on, and the minimums of the classes already taken too (a third needs all three).
  A second or third class sets its level to 1 and gives only the SRD's Multiclassing Proficiencies (a fighter's armor and weapons, a rogue's light
  armor, one skill and thieves' tools), never saving throws; its features and spells are offered as
  the first class's are. Raise their levels on **Levels and hit points**. A fourth class is typed there
  and picked in **All fields**. A monk or warlock taken second keeps the first class's weapon
  training on the sheet; a class with martial weapons widens it, and any Monk level adds shortswords.
- **Class features** take up to 20 picks, **Spells** up to 30 and **Cantrips** up to 12 (0.431.0, enough
  for any SRD count); a higher-level monk adds the rest of its features in **All fields**. A wizard's
  spellbook has its own step of up to 44. The paladin's spells are the SRD's
  Paladin Spells list, which the Open5e data leaves untagged.
- Where a background and a class give the same skill, pick another one yourself (the SRD lets you).
  The Acolyte's languages may repeat one the race speaks; pick another in **All fields**.

## Races

The **Races** catalog has the SRD's nine races (dragonborn, dwarf, elf, gnome, half-elf, half-orc,
halfling, human, tiefling) and its four subraces (hill dwarf, high elf, lightfoot halfling, rock
gnome). The picker opens on the race your **Race** text names ("Hill Dwarf" opens the dwarf and the
hill dwarf). Pick the race, then its subrace, and only one race: one pick puts every trait on your
Features list, its languages, weapon and tool training on your proficiencies, and
the half-orc's Relentless Endurance (back after a long rest) or the tiefling's two Infernal Legacy
spells on your class resources. A dragonborn's ancestry pick supplies its Breath Weapon counter
(back after a short or long rest) alongside the action. An entry may write six rows at
most, so traits without a number share a row, each under its own name (the tiefling's Speed shares one
too, its number with it).

- **Speed** is the race's walking speed, off its Speed row: 25 feet for a dwarf, a gnome or a
  halfling, 30 for the rest. With no race picked, the speed you type stays. A **Speed bonus** adds to
  either for other manual bonuses. Picked Fast Movement and Unarmored Movement now add their own
  armor-gated bonuses; remove a typed bonus that previously represented them.
- **Dwarven Toughness** adds a hit point at every level to every hit point method but By hand.
- **Infernal Legacy**: a tiefling knows thaumaturgy (on the spells list), and its class resources
  gain **Hellish Rebuke** once a long rest from character level 3 and **Darkness** from level 5, each
  appearing when the level is reached (Capability API 1.92).
- **Ability score increases** are added by the guided builder; in **All fields**, add them yourself.
- **Keen Senses** trains an elf in Perception through the guided race pick. Menacing trains a
  half-orc in Intimidation; Skill Versatility offers a half-elf two skills.
- **Draconic ancestry** (the builder's Subrace step) gives a usable **Breath Weapon**: a 5-by-30-foot
  line or 15-foot cone, its ancestry's damage type and Dexterity or Constitution save, DC 8 +
  Constitution modifier + proficiency bonus, half damage on success. Damage is 2d6, rising to 3d6
  at character level 6, 4d6 at 11 and 5d6 at 16. It spends one use, restored by a short or long rest.
  Pick one ancestry. Its action and counter share that catalog entry so the Engine spends the counter.
- **Dwarves keep their walking speed in heavy armor**, even below its Strength requirement.
  The exemption changes only the speed requirement; Stealth disadvantage still applies.
- The rest is text the Game Master reads: darkvision, resistances (including the dragonborn's
  ancestry resistance), a dwarf's poison save and a halfling's Lucky.

For copied race rows from before 0.58.0, repick the dwarf to gain its armor speed exemption.
For an existing dragonborn, remove the old Breath Weapon counter and repick its ancestry so the
action and counter share the ancestry's catalog mark. The package preserves existing sheet copies;
without repicking, an old ancestry row has no linked counter to spend.

## Starting gear

Each class's starting equipment and the Acolyte's are offered in the game's inventory, under
**Starting gear**, read off the SRD's own sentences. Taking it is up to you: a character who starts
above level 1, or with a concept of their own, can take none of it and agree their kit with the Game
Master instead.

- A class's gear and a background's are taken once each, and the gear for your class is listed first.
  You choose each "(a) or (b)" of the SRD, and pick the weapon, focus or instrument where it says
  "any".
- Packs come as what they hold (an explorer's pack is a backpack, a bedroll, a mess kit, a tinderbox,
  10 torches, 10 days of rations, a waterskin and 50 feet of hempen rope). The few things the SRD's
  equipment lists lack (the priest's pack's alms box, incense, censer and vestments, the scholar's
  pack's bag of sand and small knife, the burglar's pack's string, and the Acolyte's prayer wheel and
  incense) come as plain items.
- Armor and a shield are put on as they are taken, where nothing else is worn.
- The cleric's "(if proficient)" options are offered only to a sheet that has the training: the
  warhammer with martial weapons, the chain mail with heavy armor (0.301.0).
- Gear heavier than you can still carry is refused whole: choose lighter options, or take less.

The catalog files, the inline weapon catalog, the starting gear and the `combat` block are all
generated. Rebuild them with `node scripts/build-5e-srd-catalogs.mjs --source <fixtures dir>` from
the repository root; do not hand-edit them. The source, and the commit it was taken at, is recorded in each file and in
[LICENSE-SRD.md](LICENSE-SRD.md).

## Armor and weapons

The Equipment catalog holds the SRD's armor, shield, weapons, ammunition, adventuring gear, tools and
poisons as items for a character's bag, each with its price and weight. Trade goods and vehicles are
left out.

**Armor Class follows what you wear.** A suit of armor gives its base and the Dexterity it lets you
add: all of it in light armor, at most 2 in medium armor, and none in heavy armor, which never takes
a negative Dexterity away either. A shield adds 2. **Armor Class without armor**, on the sheet, says
what you have while you wear no armor: 10 + Dexterity; with Constitution (Barbarian) or Wisdom (Monk)
on top; or 13 + Dexterity (Mage Armor, Draconic Resilience). A shield adds to any of them but the
Monk's, which a shield takes away. Anything else, such as a natural armor, goes in **Armor Class by
hand**, and the sheet takes the highest. A character made before this version keeps the Armor Class
they typed there. Armor with a
Strength requirement slows you by 10 feet below it unless your picked dwarf trait exempts you.
Armor that says so gives disadvantage on Stealth, including for dwarves.

**A weapon you hold is an attack.** It needs no row on the attack list: a fight offers it while you
hold it, and nothing while it is in your pack. It adds your proficiency bonus when **Weapon
proficiency** on the sheet covers it (simple and martial weapons; simple weapons and the hand
crossbow, longsword, rapier and shortsword the Bard and the Rogue name; simple weapons; or none).
The Druid's, Sorcerer's and Wizard's short lists of simple weapons, the Monk's shortswords and a
people's weapon training are read as the nearest of those. It rolls with Strength, Dexterity for a
ranged weapon, or the better of the two for a finesse weapon; deals its versatile die with a hand
free; fires once a turn if it loads, however many attacks you have; and shoots the arrows, bolts,
bullets or needles you carry, half of them found again after a fight you win. A light melee weapon
strikes again as a bonus action, without your ability modifier unless it is negative. Sneak Attack
fires with a held finesse or ranged weapon as it does with a row.

Rows already on your attack list keep working. Delete one once you hold the same weapon, or the
fight offers it twice. Since 0.254.0 the blowgun deals its flat 1 piercing plus Dexterity, and the
net deals nothing but restrains a Large or smaller target until it, or anybody beside it, frees it
with a DC 10 Strength check, or a blow cuts the net; it does nothing to a formless creature. One throw
an action. Neither has a row; the item carries the attack.

**Carrying.** You can carry your Strength score times 15 pounds, and the bag refuses more. Coins
are items too: copper, silver, electrum, gold and platinum pieces, fifty to the pound.

**Prices** are the SRD's, each item priced on its own. Sling bullets cost 1 cp each rather than the
SRD's 4 cp for twenty, because no price is smaller than a copper piece.

## Magic items

The Magic items catalog holds every SRD magic item and a spell scroll of every SRD spell, each with
its rarity, a price and, where it asks for one, attunement (no more than three at once).

- **Arms and armor.** A magic weapon or armor is the SRD one it is made of. A +1, +2 or +3 weapon,
  and a named one whose text gives a bonus (a sun blade's +2), adds it to hit and to damage. Armor
  whose text gives a bonus to AC adds it (dwarven plate +2, elven chain +1), mithral loses its
  Strength requirement and Stealth disadvantage, and a magic shield is a shield. What else a weapon
  or armor does (a flame tongue's fire, adamantine's critical hits) is its text.
- **Worn.** A worn item does what one sentence of its text says in a number: a ring or cloak of
  protection +1 to Armor Class and saves, bracers of defense +2 to Armor Class without armor or a
  shield, gauntlets of ogre power and a headband of intellect a score of 19, a belt of giant strength 21 to
  29, a stone of good luck +1 to checks and saves, boots of elvenkind advantage on Stealth, a ring
  of warmth resistance to cold. Armor of Resistance, Ring of Resistance and Dragon Scale Mail
  also offer variants for every damage type or dragon in their printed tables. Their original
  entries remain available for a GM to choose the type later.
  Wands of the War Mage +1/+2/+3 add to every spell attack formula; the Robe of the Archmagi adds
  2 to spell attacks and save DCs. Staffs of Power, the Magi and the Woodlands add 2 to spell attacks;
  Staff of Power also adds 2 to Armor Class and saves. No staff grants a spell save DC bonus.
  Bracers of Archery add 2 damage and grant proficiency to inventory longbows and shortbows,
  including magic bows. Attack rows copied into the sheet are separate: update those by hand.
  Attunement is binding: an item that asks for it works only while
  bound, and a cursed one stays bound.
  Bracers know a shield by its "Armor Class bonus while no armor or shield is worn" of 0, which
  every shield in this package carries; a shield invented in play without it does not take the
  bracers' +2 away.
- **Charged.** The wands of fireballs, lightning bolts and magic missiles cast their spell for a
  charge at the wand's own DC (higher levels for more charges are their text), hold seven charges,
  regain theirs at a long rest (the SRD's "daily at dawn") and, on a 1 when the last is spent,
  crumble. A staff that "can be wielded as a magic quarterstaff" is one, with its +2 or +3. Every
  other wand's and staff's properties remain text except the uses below.
  A Wand of Paralysis spends one of seven charges for its 60-foot ray (DC 15 Constitution,
  paralyzed for a minute with a save at each turn end), with the same recharge and destruction roll.
  Staff of Power spends one of twenty charges for Magic Missile and regains 2d8 + 4 at a long rest.
  Staff of Thunder and Lightning offers Lightning Strike once per long rest: a 120-foot line,
  DC 17 Dexterity, 9d6 lightning damage, half on success. A Circlet of Blasting casts Scorching Ray
  once per long rest at the source's +5 spell attack bonus.
- **Movement.** Winged Boots supply flying speed equal to walking speed, Slippers of Spider Climbing
  climbing speed equal to walking speed, a Ring of Swimming swimming speed 40, and a Cloak of the
  Manta Ray with its hood up swimming speed 60. These are floors under the typed movement fields.
  Wearing the cloak means its hood is up; taking it off disables that speed. Flight hours, hood
  actions and underwater breathing remain manual. Since 0.302.0 the slippers climb nowhere slippery in a
  fight (Grease's ground).
- **Necklace beads.** The necklace is found with 1d6 + 3 beads (its charges, rolled), and an action
  throws one up to 60 feet as a 3rd-level Fireball (DC 15, 8d6 fire), or several at once, one level higher
  for each bead beyond the first, up to 9th. A detached bead is also its own consumable item.

Using a potion or a scroll from the bag, or in a fight, uses it up.

- **Potions.** The four potions of healing heal 2d4 + 2, 4d4 + 4, 8d4 + 8 and 10d4 + 20. Heroism gives
  10 temporary hit points and Bless for an hour, and Speed gives haste for a minute, neither needing
  concentration. The other potions and oils say what they do in their text, for the Game Master to
  narrate.
- **Spell scrolls.** A scroll casts its spell with the scroll's own save DC and attack bonus from the
  SRD's table (DC 13 and +5 for a cantrip or a 1st- or 2nd-level spell, up to DC 19 and +11 at 9th),
  whatever the reader's own numbers. A spell above the level you have slots for asks you to roll
  your spellcasting ability against 10 + the spell's level first, and a failure wastes the scroll.
  Not checked: whether the spell is on your class's list (anyone may try). A scroll of a
  concentration spell holds its reader's concentration, and a scroll of a spell whose area stays
  leaves that area (0.73.0). A scroll of a spell that does nothing a fight can
  resolve (Knock, Fly) or that answers something (Shield, Counterspell) is text.
- **Thrown.** Acid and alchemist's fire are thrown 20 feet as an improvised weapon, rolling Dexterity
  without proficiency. Acid deals 2d6 acid. Alchemist's fire sets its target burning for 1d4 fire at
  the start of each of its turns until anybody next to it (or the target) spends an action on a DC 10
  Dexterity check (0.255.0). Holy water is thrown the same way and deals 2d6 radiant only to a fiend or undead
  (Capability API 1.168); a hit on anything else does nothing.

### Item effects still needing Engine support

The following remain text; no unsupported keys are emitted. This is the 0.59.0 scope by group.

| Group                    | Written                                                                                                                                                                                                                                                                          | Left and reason                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resistance               | All ten damage types for each of the twelve Armor of Resistance materials and for Ring of Resistance; all ten Dragon Scale Mail colors. Ten Potion of Resistance choices, and Armor of Invulnerability's nonmagical resistance/immunity. Existing fixed-type resistances remain. | armor of vulnerability: persistent curse effects after removal. Generic undecided resistance entries keep their text.                                                                                                                                                                                                                                                                                                                                                     |
| Spell bonuses and scores | War Mage +1/+2/+3, Robe of the Archmagi, Staff of Power/Magi/Woodlands. Existing Gauntlets of Ogre Power, Headband of Intellect and six giant-strength belts already set scores.                                                                                                 | Rod of the Pact Keeper is absent from this SRD source. Ioun Stones of Agility, Insight, Intellect, Leadership and Strength add 2 to their score, to at most 20 (0.181.0), and the Ioun Stone of Fortitude adds 2 Constitution the same way (0.431.0), written from the sentence the source prints under the Ioun Stone of Absorption. Hammer of Thunderbolts binds only with a belt of giant strength and gauntlets of ogre power worn, unbinds when either comes off, and adds 4 Strength, to at most 30 (0.181.0). War Mage's half-cover exception and the robe's unarmored AC remain text. The robe's advantage on saves against magic works (Capability API 1.134). |
| Movement                 | Winged Boots, Ring of Swimming, hooded Cloak of the Manta Ray, Slippers of Spider Climbing, Broom of Flying (0.301.0).                                                                                                                                                                                      | Gloves of Swimming and Climbing: movement-cost and task-scoped Athletics predicates. Boots' four-hour budget and slippers' surface predicate are manual.                                                                                                                                                                    |
| Single uses              | Wand of Paralysis, Circlet of Blasting, individual Necklace of Fireballs beads; existing spell wands, healing potions, Heroism, Speed and resolvable scrolls.                                                                                                                    | Wand of Fear: its Cone of Fear works since 0.131.0; its Command (Flee or Grovel) since 0.134.0. Wand of Web casts Web since 0.74.0. Dust of Sneezing and Choking: breathing-only targets (`item.use.needs` is unavailable), suffocation and conscious-only repeat saves. Elemental Gem calls its elemental since 0.193.0. Potion of Fire Breath is absent from this source. Necklace: dice for initial charges and charge-scaled casts.                                              |
| Charged weapons          | Staffs of Charming, Fire, Frost, Healing, Power, Swarming Insects, the Magi and the Woodlands cast their fight spells at your DC (0.136.0, 0.138.0); Staff of Thunder and Lightning's daily Lightning Strike.                                                                    | Luck Blade: Wish resolution and a once-per-day gate distinct from charge recharge. Thunder and Lightning's on-hit Lightning and Thunder, its Thunderclap and its Thunder and Lightning work since 0.258.0 and 0.259.0. The Trident of Fish Command's Dominate Beast on a beast with a swimming speed works since 0.296.0.                                                                                                                                                       |
| Special worn effects     | Bracers of Archery, for inventory bows.                                                                                                                                                                                                                                          | Ring of Feather Falling lands its wearer safely since 0.245.0 (`fallsSafely`). Belt of Dwarvenkind adds 2 Constitution, to at most 20 (0.181.0). Its dwarf-specific benefits and Persuasion against dwarves need predicates too.                                                                                             |

Item-use concentration, summons, menus and predicates also limit other spell-granting items; their
printed properties stay available to the Game Master. No new Engine primitive is inferred from prose.

## Prices and treasure

**Prices.** Ordinary equipment costs what the SRD prints, and its rarity is common. The SRD prices
only one magic item (a potion of healing, 50 gp), so the package sets its own. They follow the
approach of the community guide _Sane Magical Prices_ (by Saidoro): an item costs what it does for
you, inside what its rarity says about how hard it is to find. The guide's own table is not used;
the numbers are the package's.

| Rarity    | Helps elsewhere | Fights    | Changes the game |
| --------- | --------------- | --------- | ---------------- |
| Common    | 200 gp          | 500 gp    | 2,000 gp         |
| Uncommon  | 600 gp          | 1,500 gp  | 6,000 gp         |
| Rare      | 2,400 gp        | 6,000 gp  | 24,000 gp        |
| Very rare | 9,600 gp        | 24,000 gp | 96,000 gp        |
| Legendary | 38,400 gp       | 96,000 gp | 384,000 gp       |

- **Fights:** a magic weapon, armor or shield, a wand, staff or rod, and an item that adds to Armor
  Class, saves or an ability, gives a resistance, or harms, heals or holds a foe. **Helps
  elsewhere:** travel, the senses, disguise, storage. A magic weapon or armor adds the price of the
  SRD one it is made of (a +1 longsword is 1,515 gp).
- **Changes the game:** flight whenever wanted (a broom, carpet, winged boots, wings), crossing the
  world or the planes (the helm of teleportation, cubic gate, amulet of the planes, well of many
  worlds), seeing anywhere (the crystal balls), an endless supply or an unmaking (the decanter of
  endless water, the sphere of annihilation), being unseen or beyond harm at will
  (the ring of invisibility, armor of invulnerability, plate armor of etherealness), Daern's instant
  fortress and the candle of invocation. A Game Master may well keep these out of a game.
- **By hand** where the numbers cannot tell: the belt of dwarvenkind's +2 Constitution fights, a
  wand that only finds things helps, and the talisman of the sphere fights, since it only steers the
  sphere.
- **Brings creatures:** five gold pieces a point of their experience (the SRD's own measure of a
  creature), never less than a helping item of its rarity: a silver horn of Valhalla's seven
  berserkers 15,750 gp, a bowl of commanding water elementals 9,000 gp, and an elemental gem, used up
  once, a tenth of that.
- **Used up:** a potion, an oil, an arrow, a bead or a pinch of dust costs a tenth of a lasting item
  of its rarity and use, times the uses it comes with: a potion of healing 50 gp, a necklace of
  fireballs (seven beads, on average) 4,200 gp, a candle of invocation 9,600 gp. A book whose
  reading leaves something that lasts (a manual or tome's +2, a golem) is priced as lasting.
- **Spell scrolls** double a level: 25 gp for a cantrip, 50 gp for level 1, up to 12,800 gp for
  level 9.
- **Wild chance:** the deck of many things (38,400 gp; it can grant a wish, a deliberate exception),
  the wand of wonder (6,000 gp) and the bag of beans (used up, about 1,920 gp) are priced, and an
  honest seller warns of what each can do before selling it.
- **Fakes:** the bag of devouring passes for a bag of holding, dust of sneezing and choking for dust
  of disappearance, a potion of poison for a potion of healing, armor of vulnerability for plate armor
  of resistance, and a shield of missile attraction for an arrow-catching shield. Each is priced at
  what it truly is worth (from 10 gp for the shield to 1,500 gp for the armor, which is still plate),
  always below what it passes for. Only a dishonest seller sells one, as what it passes for.
- **Never for sale:** artifacts, a wish (the ring of three wishes, a luck blade, a spell scroll of
  Wish), the efreeti bottle, and a cursed item with nothing to pass for (demon armor). They can still
  be found.

**Treasure.** A beaten creature that can use money (an aberration, celestial, dragon, fey, fiend,
giant, humanoid, monstrosity or undead of Intelligence 6 or more) drops its challenge's pocket
treasure into the party's bags: coins, and now and then a potion, a scroll or a magic item of a
rarity that fits, more and rarer as the challenge grows (0 to 4, 5 to 10, 11 to 16, 17 and up). The
tables are the package's own, since the SRD has none. Beasts, oozes, plants, constructs, elementals
and mindless creatures drop nothing. The Game Master can roll a table in the story with
`[loot: table="treasure_mid"]`.

## The market

The Game Master says where the party is, `[place: name="Millbrook" size="town"]` (a hamlet, a
village, a town or a city), and buys and sells for you there at the price level the haggling earns:
cheap (three quarters), fair, or dear (half again). Who sells what is the package's own, since the
SRD has no rules for shops:

| Seller        | From      | Sells                                                                                                                                    |
| ------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| General store | a hamlet  | Adventuring gear, tools, ammunition                                                                                                      |
| Smith         | a village | Weapons, armor, shields, ammunition (and, now and then, an uncommon magic weapon)                                                        |
| Temple        | a village | Holy symbols, common potions                                                                                                             |
| Alchemist     | a town    | Common potions, poisons                                                                                                                  |
| Scribe        | a town    | Common spell scrolls                                                                                                                     |
| Magic dealer  | a city    | Common and uncommon magic items, and an odd lot each day: rare most days, very rare seldom, the deck of many things once in a long while |
| Fence         | a town    | Common and uncommon magic items, and now and then a fake passed off as the real thing                                                    |

Common magic items are sold from a town up, and uncommon ones on a city's shelves, one or two of each
a day; a smith's odd lot may also turn up an uncommon weapon in any village. Nothing rarer is ever on
a shelf, only in a magic dealer's odd lot; legendary items (the deck of many things aside) and artifacts
are never sold at all. A seller buys
back what they deal in at half the fair price, up to a purse a day for the whole place: 20 gp in a
hamlet, 100 gp in a village, 1,000 gp in a town and 10,000 gp in a city. A day lasts until the party
moves on, or until the Game Master starts a new one with `day="new"`.

**Honest and dishonest sellers.** Every seller but the fence is honest: they warn you of a wild chance
item before selling it, never sell a cursed or fake one, and see through a fake you try to sell them,
telling you what it really is and paying what that is worth. The fence passes its fakes off as the real
thing, and takes yours as what they seem. A fake looks like what it passes for in your bag until it is
found out: by the Game Master (an identify spell, a sharp-eyed friend), by attuning to it, by using it,
or by an honest buyer. Needs an Engine with Capability API 1.79.

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

**The battle bridge is not a 5e combat system**, and it is no longer the usual path. A game with
the combat director on fights by the `combat` block below instead, with real attack rolls and saves.
The battle bridge is what a game with the combat director OFF still uses, and on that path attack
rolls, saving throws, concentration and what a higher slot would add are recorded on the catalog
entries and applied by nobody. A fight never uses both blocks.

**Only catalog rows become skills.** A row you typed by hand has no numbers behind it, so it brings
nothing into the fight. Utility entries and reactions (Shield) stay out too, because Marinara's
combat has nowhere to put them.

**Pact Magic slots pay for spells (0.70.0).** A fight offers a warlock's spells paid from pact
slots at the pact slot level, the spell growing with each level above its own as a higher slot
grows it. A spell whose own slots are spent is offered from a higher slot or a pact slot.

**Targets grow with the slot (0.70.0).** Bane, Bless, Blindness/Deafness, Charm Person, Hold
Monster, Hold Person, Longstrider and Scorching Ray take one more target (or ray) for each slot level
above their own.

**Healing spells heal.** The SRD's eight healing spells (Cure Wounds, Healing Word, Mass Cure
Wounds, Mass Healing Word, Prayer of Healing, Heal, Mass Heal, Regenerate) are marked as heals with
the amount their own text states, and the five that add "your spellcasting ability modifier" (and
Spiritual Weapon's strike) add the caster's (0.138.0). Mass Heal carries no amount, because its 700 hit points are a pool
shared among any number of creatures rather than what one target regains.

The `battle` block is hand-authored and sits **above** `catalogs` in `ruleset.json`, because the
converter rewrites the catalogs key and every byte after it. The converter refuses to run when the
block has drifted below. The `combat` block is generated and sits below, because its threat scale
is measured from the bestiary; the converter refuses to run when one has been typed above.

## 5e combat

`ruleset.json` also carries a `combat` block, which is the other thing entirely: it says how a
fight is **resolved** by 5e's rules rather than what a fight may borrow from the sheet.

**This is what a battle now plays on.** In a new game on this ruleset, with the combat director on,
a fight is resolved by 5e's rules and shown on the battle screen: you pick from your character's own
attacks and prepared spells, you roll against an opponent's Armor Class with advantage or
disadvantage, a natural 20 is a critical, saves are rolled against each effect's own DC, conditions
and concentration hold, a character at zero rolls against death, and every accepted action is
written to the sheet as it happens, spell slots included. Opponents come from the 323-creature
bestiary below when the Game Master names one, and are otherwise built on the measured threat scale.
`coverage.combat` is `true`. The known ceilings are listed at the end of this section.

What the block says:

- Hit points are the sheet's own pool, with its temporary points. Armour Class is the defense.
  Initiative is a d20 plus the sheet's Initiative.
- The attack roll is a d20 with advantage and disadvantage. A natural 20 always hits and is a
  critical, which rolls the damage dice twice. A natural 1 always misses.
- A turn holds an action, a bonus action and a reaction, and movement comes from your Speed.
- Your Attacks list is your weapons: the ability, the proficiency tick, the other bonus, the dice
  and the damage type are all read off the row.
- Your prepared spells, your cantrips and the class features you picked are the things you do with
  an action, rolling the sheet's Spell attack bonus and asking for its Spell save DC.
- A reaction that names its moment is offered at that moment and no other. When something damages
  you, the fight stops and asks whether you cast **Hellish Rebuke**, and the flames go back at
  whoever hurt you. When an attack hits you, it asks whether you cast **Shield** (+5 to Armor Class
  until the start of your next turn, and the attack is checked again against it; it is offered when
  Magic Missile is aimed at you too, and keeps all of its darts off) or, for a rogue,
  take **Uncanny Dodge** (that attack's damage is halved). When somebody casts a spell, it asks
  whether you cast **Counterspell**: a spell no higher than Counterspell's slot never happens, and
  a higher one is stopped only on a spellcasting ability check against 10 + its level. A bandit captain, an erinyes, a
  gladiator, a knight, a marilith and a noble **Parry** the same way, adding their printed 2 to 5 to
  their Armor Class against a melee blow from somebody they can see that would have hit; an arrow,
  or an attacker hidden from them, is not parried.
- **Capability API 1.131 reactions (0.61.0):**
  - **Shield Guardian: Shield** answers a hit on an ally within 5 feet of the guardian. `at: "target"`
    puts +2 Armor Class on that ally for `this-action`, including rechecking the triggering hit.
    Only the wearer of the guardian's amulet is shielded (`forHolds`, 0.265.0).
  - **Chain Devil: Unnerving Mask** answers an enemy's turn start within 30 feet. The devil must see
    the creature, which must see the devil; a DC 14 Wisdom save negates frightened. On failure,
    frightened expires at the end of that same turn.
  - **Stone Giant: Rock Catching** answers an aimed stat-block action named **Rock** (whole name,
    case-insensitive). A DC 10 Dexterity save by the giant cancels the attack on success; the
    reaction is spent on either result. Stone Giant is the only SRD 5.1 stat block with Rock Catching.
    Since 0.265.0 it catches any thrown rock or similar object (`thrown_object`), whatever the action is named.
  - **Feather Fall** catches up to **five** creatures falling in the same event, nearest first,
    within its 60-foot range, and prevents their falling damage for one minute.
    No additional unresolved SRD class or spell reaction is fully expressible with these keys.
    The black pudding and ochre jelly split in two on lightning or slashing damage since 0.245.0 (`splits`).
    The remaining class reactions and their missing capabilities are listed in the feature audit below
    (Giant Killer, Retaliation and Stand Against the Tide work since 0.214.0, Deflect Missiles and Slow Fall since 0.205.0). Stroke of
    Luck works since 0.116.0, and Cutting Words on attack rolls since 0.117.0 (checks and damage
    rolls since 0.124.0).
- **Grapple and shove.** Either takes the place of one strike of your Attack action: your Athletics
  against the target's Athletics or Acrobatics, whichever is better, with a tie to the target. A
  grapple leaves the target grappled by you until you go down or it escapes, which is its own action
  with the sides reversed. A shove knocks the target prone or, on a board, pushes it 5 feet away. A
  monster uses its printed Athletics or Acrobatics, or its Strength or Dexterity modifier when it
  prints none. Neither works on a target more than one size larger than you: a creature's size is
  its printed one and a character's is the sheet's Size, which the race sets. A monster that grapples
  on a hit (a crocodile's bite, a constrictor's coils) holds the target until it escapes against the
  monster's printed escape DC.
- **Spells that change the numbers.** Bless adds 1d4 to attack rolls and saves and Bane takes 1d4
  off them, rolled every time. Shield of Faith adds 2 to Armor Class. Haste adds 2 to Armor Class,
  doubles Speed, gives advantage on Dexterity saves and an extra action each turn, for one weapon
  attack, Dash, Disengage, Hide or using a mundane item (never activating a magic one); when it ends,
  its target loses its next turn to lethargy. Slow takes 2 off Armor Class and Dexterity saves, halves Speed, takes the reaction away,
  leaves an action or a bonus action but not both, and allows one attack a turn, until a Wisdom save
  at the end of a turn ends it.
  Blur makes attacks against you roll with disadvantage, Faerie Fire makes attacks against whoever it
  outlines roll with advantage, Guiding Bolt gives the next attack against its target advantage,
  Vicious Mockery gives its target's next attack disadvantage, Longstrider adds 10 feet and Ray of
  Frost takes 10 feet off.
- **Class features in numbers.** Second Wind heals 1d10 + your fighter level. The Champion's Improved
  Critical makes a natural 19 a critical hit and Superior Critical an 18, once the feature is on your
  Features list (its Widens critical hits column says by how much). A Champion who picked the
  feature before 0.21.0 removes it and picks it again, so the row carries the column. The wider range counts for every
  attack roll you make, not only with a weapon as the SRD says, so a Champion's spell attacks crit
  on a 19 too; a creature's stat block always crits on a 20.
- **Exhaustion counts.** Each level the Exhaustion track has reached adds to the ones below it:
  disadvantage on the contests above at 1, half Speed at 2, disadvantage on attacks and saves at 3,
  half the hit point maximum at 4, no movement at all at 5, and death at 6. Creatures count it too,
  and the 33 the SRD makes immune to it are. A poisoned creature now also rolls its contests with disadvantage,
  and a frightened one does while it can see what frightens it.
- **A turn does what a tabletop turn does.** One Attack action buys as many strikes as your Extra
  Attack gives (Attacks per Attack action on the sheet), the first spending the action and the rest offered free, so you may
  change weapon, change target and walk between them. Sneak Attack adds itself to the first
  qualifying hit of your turn, growing with the Rogue table. Action Surge costs nothing and hands
  back an action. Cunning Action puts Dash, Disengage and Hide on the menu for a bonus action.
  Dodge gives advantage on Dexterity saves as well as making you harder to hit. A creature's blow
  may carry a second helping of a different type, rolled and resisted on its own.
- The six standard actions, thirteen of the fourteen SRD conditions, concentration (a Constitution
  save at DC 10 or half the damage, whichever is higher), death saves (three and three, a natural
  20 brings you back up at one hit point, a natural 1 counts twice, a blow while down costs a
  failure and a critical costs two) and the thirteen damage types.
- Charm Person ends when its caster or their side harms the target. Dominate Person, Beast and
  Monster re-roll their Wisdom save each time the target takes damage. Hypnotic Pattern ends on damage or an ally within
  5 feet spending an action to shake the target awake. Vampire Charm and Dryad Fey Charm use the
  source-side harm ending too. These conditions keep the existing source-down failsafe.
- A challenge-rating scale, `threat`, measured from the bestiary at build time. It exists so an
  opponent a Game Master invents can be pulled onto it. Nothing in this package's own bestiary is
  ever clamped to it.

**About the scale.** Health, armour class and the attack bonus are measured from every SRD creature
of the rating. The damage band is measured only from the ones whose fighting is really in their
actions: a spellcaster's printed attack is a dagger and its fireballs come off a spell list this
measurement does not read, so counting it would say a rating 12 monster deals nine damage a round. 37 casters and 4 creatures whose damage
this format had to leave in a trait are out of that one measurement, and in every other.

The caps and the floors are then made **monotone** along the rating order, and that is the one place
this table is smoothed. A higher rating may never allow less than a lower one, because the scale is
what bounds a monster a Game Master made up, and two unlucky SRD creatures at one rating should not
cap everybody else's. The numbers are still the SRD creatures' own; only which rating may reach them
changes. This is live: when a Game Master invents an opponent instead of naming one out of the
bestiary, the fight you play is built on this table.

### On a board

A fight can also be **positioned**: fought on a battlefield of squares, in feet. Two things have to
agree before any of it happens. This package declares what one square is worth, and the player sets
the game's combat style to **Tactical**. With **Classic**, the fight is exactly the theatre of the
mind it was before: anybody can be pointed at anybody, and nothing in this section is read at all.

What the block says, with the SRD sentence each number came from:

| What                          | This package                                                                                        | SRD 5.1                                                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One square                    | 5 ft                                                                                                | Playing on a Grid: "Each square on the grid represents 5 feet."                                                                                                                                                                                            |
| Movement                      | Your race's walking speed plus **Speed bonus**; typed **Speed** if no race is picked                | Speed: "Your speed defines how far you can move when you move on your turn."                                                                                                                                                                               |
| A long shot                   | Disadvantage                                                                                        | Range: "Your attack has disadvantage when your target is beyond normal range."                                                                                                                                                                             |
| A shot with a foe next to you | Disadvantage                                                                                        | Ranged Attacks in Close Combat: "You have disadvantage on a ranged attack roll if you are within 5 feet of a hostile creature."                                                                                                                            |
| Cover                         | +2 (half) or +5 (three-quarters) to Armor Class and Dexterity saves; total cover cannot be targeted | Cover: "A target with half cover has a +2 bonus to AC and Dexterity saving throws." "A target with three-quarters cover has a +5 bonus to AC and Dexterity saving throws." "A target with total cover can't be targeted directly by an attack or a spell." |
| Falling                       | 1d6 bludgeoning per 10 ft fallen, at most 20d6, then prone; a board level is 5 ft                   | Falling: "At the end of a fall, a creature takes 1d6 bludgeoning damage for every 10 feet it fell, to a maximum of 20d6."                                                                                                                                  |
| Walking out of a reach        | The enemy may strike, spending its **reaction**                                                     | Opportunity Attacks: "To make the opportunity attack, you use your reaction."                                                                                                                                                                              |

**Speed follows the picked race** through `speed_race`: a dwarf walks 25 feet, for example.
With no race picked, the **Speed** field defaults to 30. **Speed bonus** adds to either;
`speed_total` supplies a fight's movement. Non-SRD races use the typed field.

**Weapons carry three new distances.** The Attacks list gains a **Reach (ft)** column defaulting to
5, and **Range (ft)** and **Long range (ft)** columns defaulting to 0, and every weapon in the
catalog fills them from the SRD's own weapons table: 17 weapons reach 5 feet, 5 reach 10 feet (the
Reach property adds 5), 8 are shot and reach nothing at all, and 6 both swing and are thrown. A 0 in
a column means that row carries no such distance, which is how a sword and a thrown axe sit in the
same list.

A row that carries **both** is a thrown weapon, and it is read as each of them where each applies: a
handaxe is a swing inside its 5 feet, with none of the penalties a shot takes, and a throw beyond
that, at disadvantage past 20 feet and out of the question past 60. It is also something to strike
somebody walking past you with, which a bow is not.

**Pick your weapons again.** A picked row is a copy, so a weapon you added before this version has
none of the three columns, and the Engine reads a row with no reach as reaching exactly one square:
an old longbow will only fire at somebody standing next to you. The sheet editor's **Newer text**
review will not fix it, because it only ever compares text-like columns and deliberately leaves a
number alone, since a number is where your own edits live. Delete each weapon row and pick it from
the catalog again, or type the three numbers into the row yourself. A character built from here on
gets them with the row.

**Spells land as the shape the SRD prints.** Of the 95 spells with mapped fight distances, 86 carry a range
in feet, 7 draw a shape from the caster and so name no distance at all, and the last 2 are Dream
("Special") and Meteor Swarm ("1 mile"), neither of which is a number of feet. 29 carry an area: 12
spheres, 4 cylinders, 4 cones, 2 lines and 7 cubes or squares.

A range of **Touch** is written as 0, which the Engine reads as a reach of one square rather than a
shot, so touching somebody standing beside an enemy costs nothing. A spell whose range is **Self**
and which draws a shape carries no distance at all, because Self names none: the Engine sets a burst
down on the caster's own square and lets a cone or a line be aimed anywhere within its own length,
since there the aimed square only picks the direction. Burning Hands and Thunderwave are two of the
seven.

**A cube or a square becomes the nearest burst**, because the Engine has a burst, a cone and a line
and nothing else. A burst of radius r covers 2r + 1 squares across, so an edge of N feet ships as a
burst of radius (N - 5) / 2: Thunderwave's 15-foot cube is three squares across either way, and a
cube with an even number of squares comes out one square wider than the printed cube. It is the one
place a shipped area is not the SRD's own outline.

Seven printed shapes are deliberately not areas, because none of them is a patch of ground the spell
catches creatures in:

| Spell         | What the number really is                                                                 |
| ------------- | ----------------------------------------------------------------------------------------- |
| Control Water | a 20-foot wave of moving water, and the Engine has no shape that moves                    |
| Disintegrate  | the 10-foot cube the ray destroys of an object; the spell itself takes one target         |
| Fire Storm    | up to ten 10-foot cubes arranged as you wish, and the Engine has no shape made of several |
| Flame Blade   | the 10-foot radius of light the blade sheds                                               |
| Produce Flame | the 10-foot radius of light the flame sheds                                               |
| Teleport      | how big an object it may send, not ground it covers                                       |
| Wall of Ice   | ten 10-foot-square panels, which is a wall                                                |

(Teleport is not on a fight's menu at all any more; see below.)

Fire Storm and Teleport are the two the machine-readable source itself states a shape for, and both
would otherwise have shipped as a single 10-foot cube: a tenth of Fire Storm's real footprint, and
something Teleport does not have at all. The build refuses to run if a resolvable spell ever prints a
shape that is in neither list, or if one that states a boxed shape says in its own text that there
are several of them.

**Nothing a fight offers you deals damage with nobody rolling for it.** An entry with damage and no
attack roll, no saving throw and nothing saying it simply lands would take off its whole damage every
single time, so the build refuses to ship one. That rule turned up two different problems in the SRD
data, both now fixed:

- **Seven spells were missing their saving throw**, because the converter only knew the SRD's
  commonest way of writing it. Blade Barrier, Control Water, Earthquake, Freezing Sphere, Spirit
  Guardians, Sunburst and Thunderwave all print "On a successful save, the creature takes half as
  much damage", and all seven now ask for that save. Black Tentacles and Disintegrate print the
  damage as what FAILING brings, so a success avoids all of it. Dream, Feeblemind and Heat Metal are
  read by hand from their own sentences, because no general wording fits them.
- **Four spells carry a damage roll that is not what they do to anybody**, and they are now shipped
  as utility so a fight never offers them at all: **Teleport** (its 3d10 is the mishap row of its own
  d100 table, and it hurts the travellers; since 0.191.0 it is a teleport without it), **Geas** (5d10 only later, when a charmed creature
  disobeys; since 0.265.0 its charm carries that harm instead), **Forbiddance** (a ward that burns a named kind of creature walking in) and **Spike
  Growth** (ground that cuts whoever crosses it, counted per 5 feet travelled).

**Inflict Wounds** is the one place a spell's attack roll is corrected: the SRD prints "Make a melee
spell attack" and the machine-readable source says it makes none. The build stops if the source ever
fixes that itself.

**Five spells print damage the machine-readable source leaves out.** It carries only the larger rolls
Sacred Flame, Acid Splash, Poison Spray and Vicious Mockery reach at 5th level and up, and none at all
for Spiritual Weapon, so all five used to ship as utility spells a fight never offered. Each now
carries the base damage roll its own text prints, and the four cantrips still grow with your level off
the source's own table. The build stops if the source ever gives one of them a roll of its own.

**A creature carries how far its actions reach.** The bestiary's 834 actions divide up exactly, each
one into a single row:

| What it carries     | How many | What they are                                                                                                                                                                                     |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A reach only        | 487      | a printed "reach 5 ft.", the ordinary swing                                                                                                                                                       |
| A reach and a range | 18       | the thrown weapons: "reach 5 ft. or range 20/60 ft."                                                                                                                                              |
| A range only        | 109      | bows, bolts and everything that only carries                                                                                                                                                      |
| A shape only        | 57       | breath weapons, sprays and clouds                                                                                                                                                                 |
| A shape and a range | 1        | the Djinni's whirlwind, formed on a point within 120 feet                                                                                                                                         |
| Nothing at all      | 162      | 150 multiattack sequences, whose parts carry their own, 6 things done to somebody already grappled or standing in the creature's own square, and the 6 Parries, which the creature does to itself |

So 505 actions reach, 128 carry (56 of those with a long range beyond the ordinary one) and 58 land
in a shape; the only overlaps are the 18 that both reach and carry and the 1 that both shapes and
carries. 72 of them print no range of their own and take their distance from the sentence that names
who has to save, which is how a stat block writes an aura or a presence ("each creature within 120
feet of the dragon").

**And a creature's breath lands in a real shape.** 58 actions carry the shape the SRD prints: 31
cones, 22 lines and 5 bursts. A dragon's "60-foot cone" is a cone of twelve squares aimed from where
the dragon stands, the Behir's "line of lightning that is 20 ft. long" is a line, and the Vrock's
"15-foot-radius cloud of toxic spores" is a burst. Each of them also keeps the target count below,
because that is what a fight in the Classic style reads instead.

Two of them spare the creature's own side, and only because their own sentence says so: the Kraken's
Ink Cloud ("Each creature other than the kraken") and the Solar's Searing Burst ("Each creature of
its choice"). Every other shape catches everybody standing in it, which is what "Each creature in
that area" means. The build stops if any other printed shape ever grows wording like that without
somebody deciding what it means.

Only the Djinni's whirlwind prints how far off its shape may be formed ("on a point the djinni can
see within 120 feet of it"); every other shape carries no range, which is what makes it start at the
creature. A burst with no range goes off on the creature's own square and nowhere else, so the
Kraken's 60-foot ink cloud is centred on the kraken; a cone or a line with no range is aimed anywhere
within its own length, because there the aimed square only picks the direction.

### Creatures

`catalogs/creatures.json` is 323 of the SRD 5.1 monsters, each written in the numbers above:
hit dice a fight rolls, armour class, speed, ability scores, saving throw bonuses, resistances,
vulnerabilities, immunities, condition immunities, the challenge rating it sits at, its attacks and
saving-throw actions, its multiattack as one action that strikes several times, breath weapons that
recharge, and legendary actions bought from a pool of three points, offered at the end of each other
creature's turn and back to full at the start of its own.

Every number is read off the **printed stat block**, never off the machine-readable attack rows
beside it, because those say the damage type is thunder on 514 of the SRD's attacks and leave the
flat bonus out of 475 of them.

**Resistance to nonmagical attacks.** The 57 creatures that resist (or are immune to) "bludgeoning,
piercing, and slashing from nonmagical attacks" take those three in full from magic: a magic weapon,
any spell, and the weapon attacks of the 16 creatures whose stat block says "its weapon attacks are
magical" (the deva's mace, a golem's slam), as well as a creature's spell attacks. An ordinary blow is
still halved, or does nothing. Where the line adds "not made with silvered weapons" (devils,
lycanthropes, the wight) a silvered weapon gets through too, and "adamantine" likewise (the golems,
the gargoyle, the xorn). Three stat blocks are read as the SRD prints them where the source
disagrees: the mummy is immune to necrotic and poison only, the xorn resists piercing and slashing
only, and the wight resists necrotic and nonmagical blows that aren't silvered and is immune to
poison.

**Twelve spellcasters are sheets.** A stat block with a Spellcasting trait (the Acolyte, Priest,
Cult Fanatic, Druid, Mage, Archmage, Lich, Mummy Lord, Guardian Naga, Spirit Naga, Androsphinx and
Gynosphinx) is written as a character sheet in this ruleset's own terms: its ability scores, Armor
Class, hit points, Speed, caster level, spellcasting ability, spell slots and prepared spells, each
spell a row of this package's own spell catalog. A fight builds it the way it builds your character,
and the creature spell menu also records each prepared spell with its printed daily uses and
casting level, against its printed save DC. Its printed attacks, such as the Mage's dagger, stay beside the sheet as actions, and the trait stays
for the Game Master to read.

A monster's proficiency bonus follows its challenge rating and a sheet's follows its level, so the
Archmage (18th level, challenge 12) would otherwise throw its spells two points too hard. The
difference goes into the sheet's own **Spell attack: other bonus** and **Spell save DC: other
bonus** fields, and into a bonus on each printed save and skill, never into an ability score. The
build computes every one of those numbers the way the Engine does, and stops if any of them differs
from the stat block. Its hit points are the printed number rather than rolled hit dice, because a
sheet holds a maximum and not dice. The Gynosphinx prepares nothing a fight can resolve (Suggestion,
Banishment, Legend Lore and the like), so it still fights with its claws.

**Innate and coven spells join combat.** Creature spell menus reference this package's spell
catalog: at-will spells have no use limit, and daily spells carry their printed count. The four
mephits' once-a-day spells are included. Hags share coven spell slots when three members of
`hag_coven` are within 30 feet. Existing spellcasting trait text stays where it was for the Game Master to read;
spells without combat mechanics still rely on the story.

That also means the SRD's own oddities ship as printed. The **Ancient Green Dragon** claws for
22 (4d6 + 8) where every other ancient dragon claws for 2d6 + 8, because that is what SRD 5.1 prints
for that one dragon. It is not a converter bug and it is not to be "corrected".

**A Multiattack becomes one action that strikes several times.** The SRD writes it as prose, and the
build reads the shapes that prose uses rather than knowing any creature by name. Where the sentence
offers a choice, each alternative is its own action, named so a Game Master can tell them apart:
the Medusa carries **Multiattack (melee)** (snake hair once, shortsword twice) beside **Multiattack
(ranged)** (longbow twice). Three creatures keep their single attacks, because a sequence cannot say
what they do: the **Grick** (its beak only follows a tentacle that hit), the **Violet Fungus** (1d4
attacks) and the **Gibbering Mouther** (one bite plus an optional spittle). Their printed sentence is
a trait, as is anything any other Multiattack says beyond its strikes.

**Donkey**, **Frog**, **Sea Horse** and **Shrieker** use sheets with no attacks, which the Engine
format allows. They keep their printed hit points as fixed sheet health, Armor Class, movement,
ability scores and save/skill bonuses. The supplied Donkey record has no hit dice or walking speed;
those are not invented. **Shriek** is a trait for the Game Master to read, not a damaging action.

**A creature moves as it is printed.** Its walking speed is its speed, and every other mode the stat
block prints (fly, swim, climb, burrow) is carried as its own, with "(hover)" where it says so: 174
creatures move some way besides walking, 15 of them not on foot at all, and 7 hover. On a board a
flier crosses water and drops and flies up a level for every 5 feet, a swimmer crosses water, a
climber takes a step of any height, and a burrower's speed is shown and moves as a walk, since a
board has no ground to tunnel through. A character's other speeds are the **Fly speed**, **Swim
speed** and **Climb speed** fields as manual floors, combined with the worn movement items above.
Spells and items that grant a speed give it through their condition.

**Each creature appears once.** The SRD prints its bestiary alphabetically and cross-references two
of them under a second heading: "Elf, Drow" is an index entry pointing at the Drow's stat block, and
"Gnome, Deep (Svirfneblin)" at the Deep Gnome's. The machine-readable source models both headings as
records, so those two arrive as stubs with the real creature's name, armour class, hit points and
actions and none of its hit dice, speed or challenge rating. They are left out, because they are not
second creatures. The build refuses to run if either side leaves the source, if a stub grows hit dice
of its own, or if the two stop printing the same actions.

### What is written down but not resolved

A fight plays, so this is the honest list of what it still does not do:

- **A target count instead of a shape, for a fight with no positions.** Every area action also says
  how many creatures it takes, using the printed size in feet: cone size / 10; sphere or cylinder
  radius, cube or square side / 5; line length / 30. Round down, with a minimum of one. Spells,
  breath weapons and creature actions use this same approximation; "each creature within N feet"
  of a creature or a point is a burst of that radius, and any other shapeless "each creature" still
  takes two. These counts are the package's rule, not the SRD's. Tactical uses the shape
  instead; Classic uses the count.
- **A line's width is read only where it is wider than 5 feet** (the five ancient dragons' 10-foot
  breath lines, Capability API 1.128); every other line is a line of single squares, as the SRD prints it.
- **Cover is read off the board, by corner lines.** From the attacker's best corner, a line to each
  corner of the target's square: one or two lines through a wall, three or four, or any through
  trees, rubble or another creature, decide half or three-quarters cover. That is the DMG's optional
  grid rule, not the SRD's, which leaves it to the table. Total cover is a target the attacker cannot
  see at all. A creature in the way gives half cover whatever its size. A target standing in woods or
  ruins has half cover against an attack, while a Dexterity save is helped only by what stands between
  the target and where the effect comes from (where a burst lands, else its caster). Sacred Flame's
  save takes no cover, as its text says.
- **Height is the board's.** A board level is 5 feet. Climbing a level costs 5 more feet of movement,
  nobody walks a step of 10 feet or more, and ground higher than both ends blocks sight; those are the
  Engine's rules, not the SRD's, and so is this one: shooting down from higher ground, low cover between
  (trees, rubble, a creature) gives the target no cover. Higher ground gives an attack roll nothing,
  as in the SRD. Somebody shoved
  off a drop of 10 feet or more falls and lands prone even when the fall does them no harm (the SRD
  spares a creature that takes no damage). A flier is up to 20 levels (100 feet) above the ground
  below it; knocked prone or held to a speed of 0 it falls the same way, unless it hovers.
- **A grab that holds only a target of some size** ("If the target is Medium or smaller, it is
  grappled") holds only a target that size (`targetIs.upToSize`, since 0.195.0).
  A vampire's Unarmed Strike and a vampire spawn's Claws instead offer separate damage and grapple
  actions, with escape DC 18 and 13 respectively. Multiattack offers the grab choices too.
- **Four attacks now offer separate alternatives**: the bugbear's Javelin (melee/ranged), the
  djinni's Scimitar (lightning/thunder), the dryad's Club (with shillelagh), and the druid's Quarterstaff
  (with shillelagh or two hands, with the attack bonuses and damage printed in the supplied source).
  The oni's Glaive "in Small or Medium form" is its own action in its humanoid form since 0.400.0 (the
  duergar's "while enlarged" is real since 0.94.0). The 25 two-hand or half-health swarm alternatives remain real damage (Capability API 1.102).
  A second HELPING of a different type ("plus 7 (2d6) fire
  damage") is no longer among them: Capability API 1.29 lets one blow carry up to three damage
  clauses, each rolled and resisted on its own, and all 66 of them are now real damage.
- **Coven slots are shared by level** since 0.297.0 (`spellcasting.slots`, Capability API 1.642): the
  coven's "1st level (4 slots)" is four 1st-level slots that any member spends, each spell taking the lowest
  left at or above its level. (The twelve slot casters cast from their sheets, whose slots are shared as
  printed.) A hag's coven spells keep the coven's DC and attack bonus (12 and 4 + her Intelligence
  modifier) beside her innate ones (`saveDifficulty` and `toHit` on each spell). Casting restrictions such
  as "self only" remain prose.
- **Ray of Sickness is not in the SRD**, so the hags' coven menus leave it out (the generator reports it).
- **Feature save difficulty** defaults to the Breath Weapon's Constitution-based DC. Monk rows
  now select their own 8 + proficiency + Wisdom Ki DC through Class. Paid condition saves on
  weapon hits still need Engine support, as the audit below explains.

### Spell and class-feature audit for 0.60.0

**Resolved spell effects:** Blindness/Deafness now offers the blinded choice (the original entry)
and a separate deafened choice. Both ask for a Constitution save, last at most one minute and
allow a Constitution save at each turn end. They never apply both conditions. Greater Invisibility
applies Invisible for one minute with concentration. A higher slot adds the extra targets it
prints (`targetsPerCostStep`).

**Features written in this release:**

- Ki: Patient Defense offers the actual Dodge action for a bonus action, spending one point from
  the feature's existing Ki resource. Flurry of Blows and Step of the Wind remain text below.
- Wholeness of Body heals three monk levels as an action, once per long rest.
- Vanish offers Hide for a bonus action. Its nonmagical tracking protection remains story text.
- Fast Movement adds 10 feet while no heavy armor is worn; shields and other armor permit it.
- Unarmored Movement scales its speed bonus from the Monk table while no armor or shield is worn.
- Draconic Resilience adds one HP per sorcerer level to automatic/average/rolled HP and selects
  the existing 13 + Dexterity unarmored AC formula. By hand HP remains the player's total.
- Slippery Mind grants Wisdom saving throw proficiency.
- Diamond Soul grants proficiency in all six saving throws, and since 0.116.0 its Ki-paid reroll of a
  failed save works.
- Superior Hunter's Defense offers a separate Uncanny Dodge choice using the Rogue's existing
  hit reaction, and since 0.117.0 a separate Evasion choice. The choices are exclusive; Stand Against
  the Tide remains text.

Pick these features again to obtain their new columns/grants. Clear a manually typed movement
bonus that previously stood in for Fast Movement or Unarmored Movement to avoid counting it twice.
Monk feature rows carry Class = Monk and use their own Ki DC, 8 + proficiency + Wisdom, through
`combat.abilities.byColumn` (Capability API 1.108). Spell DC bonuses do not change it. Racial Breath
Weapon retains its Constitution DC. This supplies the correct source for future hit-save mechanics;
it does not turn Stunning Strike into an ordinary action.

The existing Second Wind, Action Surge, Cunning Action, Sneak Attack and Uncanny Dodge mechanics
remain. Extra Attack already follows the barbarian, fighter, monk, paladin and ranger levels;
Unarmored Defense already follows the class pick. The existing fighting styles, ASI and Expertise
grants remain. Hunter's Mark is a spell; Favored Enemy grants no damage bonus in SRD 5.1.

**NEEDS ENGINE** below identifies missing keys/capabilities in the existing parent blocks,
not proposed JSON keys. Unsupported spells keep utility mechanics; unsupported feature effects
keep their printed text and any existing resource counters. Partial features name what now works.
No new Engine keys or substitute saves are emitted.

<!-- NEEDS ENGINE spells -->

| Spell                                                                                     | Missing Engine key / capability                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

<!-- NEEDS ENGINE features -->

| Feature                                                                                                                                                                          | Missing Engine key / capability                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thief: Fast Hands (`thief-fast-hands`)                                                                                                                                           | `mechanics`: a bonus-action Sleight of Hand check. Use an Object and disarming a trap with thieves' tools as a bonus action work (`fast_hands`, 0.304.0); no lock exists on a board.                                                                                                      |

<!-- END NEEDS ENGINE -->

## License

`ruleset.json` and the catalog files include material from the System Reference Document 5.1. See
[LICENSE-SRD.md](LICENSE-SRD.md) for the required attribution and for where the machine-readable
form of the catalog entries came from.
