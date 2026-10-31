# 5e (SRD 5.1)

A downloadable Game Mode **ruleset** (capability package, `ruleset` kind). It provides 5e rules
from the System Reference Document 5.1 for ability checks, skill checks, saving throws, spell
slots, hit dice, class resources, conditions, rests, a full character sheet, and 5e combat itself:
a battle in a game on this ruleset is fought by these rules, on screen, against the SRD's own
monsters.

Requires **Marinara Engine 2.4.6+ with Capability API 1.274** (the ruleset seam, catalogs, the
battle block, scaled catalog columns, the combat block, bestiaries, a fight with positions, what
one TURN of that fight can do, a weapon that caps its own strikes, the moment a reaction waits for,
creatures written as sheets, contests, a reaction to something being used, conditions that change
numbers and count levels, a reaction to being hit, and items: a bag, worn armor, held weapons and
what they add to a strike, coins, loot and markets, cover by degrees, height, and conditions that
change the action economy, sheet migrations with a long rest shared over the hit dice, starting gear,
honest and dishonest sellers, a critical range off the sheet, derived values that multiply, a sheet
value added to an ability's amount, a list column rolled with the Engine's dice, a guided builder, up to 400 derived values, a coin's name for one of itself, a builder step's count off the sheet, entries of a catalog to choose, several leveled rows on one entry, a score choice that repeats, picks exclusive of each other, an item's to-hit read off the sheet, a score choice's cap, damage and an off hand read off the sheet, low damage dice rerolled, entries offered only while the sheet allows, and typed resistances and immunities:
hash-pinned `ruleset.json` and `catalogs/<id>.json` assets the Engine reads by reserved filename,
exactly like `gm-verbs.json`). Today that means the Engine `staging` branch; older hosts reject the manifest and
cannot install this package. This package ships no server entrypoint, no client entrypoint, and no
Agent. It is pure data: nothing here runs code, and no restart is needed after install.

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

A deafened creature lacks hearing. Effects that need hearing cannot target it, and areas skip it
entirely: no save, damage or applied condition. This covers Compulsion, Divine Word, Enthrall,
Mass Suggestion, Suggestion, Vicious Mockery, the cloaker's Moan, the harpy's Luring Song, the mummy
lord's Blasphemous Word and the vrock's Stunning Screech. Command's supplied text does not require
hearing; Power Word Kill, Power Word Stun and Shatter do not either. Dissonant Whispers and the
banshee are absent from the supplied SRD 5.1 source. Item uses cannot carry sense requirements in
API 1.127, so spell scrolls retain that limitation. Scrolls of concentration spells hold their
concentration since 0.73.0 (Capability API 1.174).

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
`ruleset.json` over 256 KB (262,144 bytes, spaces and `$comment` text included), so since 0.187.0 the
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
  (bard, ranger, sorcerer, warlock), the spells it prepares (cleric, druid, paladin), or a wizard's
  spellbook: six at 1st level and two more each level after. A level lowered later keeps the picks
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
  training on the sheet; a class with martial weapons widens it.
- **Class features** take up to 20 picks, **Spells** up to 30 and **Cantrips** up to 12 (0.431.0, enough
  for any SRD count); a higher-level monk adds the rest of its features in **All fields**. A wizard's spellbook passes 20 at
  9th level. The paladin's spells are the SRD's
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

## Typed defenses (0.62.0)

Capability API 1.132 combines condition, track, item and creature defenses: immunity wins over
resistance, and two resistances do not halve twice. Gaining a condition immunity ends that condition
and blocks reapplication. Sheet hide columns accept comma-separated words, including
`bludgeoning except magical`; unknown damage words are ignored. `except magical` lets magical
weapons and spell damage through. The package checks validate these declarations and refuse them
under an older capability declaration; qualified worn/carried item hides are gated too.

- Racial resistance works in a fight. Dwarven Resilience ("you have resistance against poison
  damage"), Hellish Resistance ("You have resistance to fire damage") and the dragonborn's Damage
  Resistance ("You have resistance to the damage type associated with your draconic ancestry") write
  their damage type in the Features list's Damage resistances column, which `combat.sheetHides`
  reads. It is the list's 16th column, which Capability API 1.165 allows. No other SRD 5.1 race
  grants damage resistance; the stout halfling is not in SRD 5.1.
- Rage spends its existing resource and a bonus action to apply Raging for ten rounds, resisting
  bludgeoning, piercing and slashing. It is not offered while heavy armor is worn (`usableWhen`,
  Capability API 1.166); donning armor takes longer than a rage lasts. Raging gives advantage on
  Strength saves and Strength checks, contests included (Capability API 1.188), and Rage adds its
  Rage Damage (+2, +3 from 9th level, +4 from 16th) to melee weapon hits made with Strength
  (Capability API 1.133 and 1.167). It forbids casting and concentration, and ends early on a turn without an attack or damage taken, or on falling unconscious (0.226.0 to 0.229.0). It can be ended early as a bonus action.
- Stoneskin resists nonmagical bludgeoning, piercing and slashing for an hour with concentration.
  Protection from Energy offers acid (the original entry), cold, fire, lightning and thunder choices,
  one hour with concentration. Protection from Poison grants one hour of poison resistance and
  advantage on saves against being poisoned (Capability API 1.134); neutralizing a poison already
  there is the GM's.
- Heroism grants frightened immunity for one minute with concentration, and temporary hit points
  equal to the caster's spellcasting modifier at the start of each of the target's turns, lost when it
  ends (0.141.0). Higher-slot extra targets remain manual: this source prints no higher-level text
  for it. Calm Emotions holds charm and fear off for its
  minute and lets them resume after, allies may choose to fail its save, and its indifference ends on hostility; it does not grant frightened immunity.
- Fire Shield offers cold resistance (warm shield, the original entry) or fire resistance (chill
  shield) for ten minutes, and since 0.254.0 deals 2d8 fire (warm) or cold (chill) to whoever hits
  its caster with a melee attack from within 5 feet; its caster can dismiss it as an action (0.400.0). Gaseous Form grants nonmagical resistance and Strength/Dexterity/
  Constitution save advantage for one hour with concentration; it only flies, 10 feet (0.263.0); since 0.400.0 its
  holder can't attack, cast spells, speak or use items, and the form ends at 0 hit points. Since
  0.415.0 it squeezes through small holes as a Tiny creature does (`squeezesAs`).
- Mind Blank is a buff on one ally since 0.245.0: psychic and charm immunity, including this
  package's custom charm conditions, for 24 hours (14,400 rounds), and divination spells can't reach its holder. Hypnotic Pattern's incapacitation ends with the charm Mind Blank removes. Heroes' Feast is set up before a fight since 0.242.0:
  up to twelve allies gain its poison/poisoned/frightened immunity and Wisdom save advantage for the
  fight. Since 0.244.0 it also cures every disease and poisoning and raises their maximum and current
  hit points by 2d10.
- Warding Bond's condition supplies resistance to all damage and +1 AC/saves, its caster takes the
  same damage, and it ends when its caster drops to 0 or they are more than 60 feet apart, or when its caster
  bonds another ally (0.414.0). Since 0.415.0 its caster can dismiss it as an action, since casting it puts
  an `endable` `warding_bond_link` on the caster too. Hallow's courage, energy resistance and vulnerability
  work as its extra effects since 0.241.0. Wind Walk's cloud form,
  with its nonmagical resistance, works since 0.281.0. Wish duplicates
  any spell of 8th level or lower since 0.245.0. It also grants up to ten creatures permanent
  resistance to a damage type (13 `wish-resistance-*` entries) or 8 hours' immunity to a single
  spell (`wish-immunity`, `wardPick`), and its stress (`wish_stressed`, `wish_weakened` for 2d4 days,
  `wish_lost`) falls on its caster.
- Ten Potion of Resistance variants apply their printed type for 600 rounds; the original undecided
  bottle stays text for the GM's selection.
- Armor of Invulnerability resists every nonmagical damage type while worn. Its action spends one
  daily use to grant nonmagical immunity for 100 rounds; it is used only while worn, and since 0.302.0 taking the armor off ends it. The existing Long
  rest proxy restores its dawn use. Immunity takes precedence over its worn resistance.
- Purity of Body and Nature's Ward add passive poison damage and poisoned condition immunity
  through Defensive traits at their level-10 picks. Its two hide columns are read by `combat.sheetHides`. That separate list avoids adding more immunity
  columns to Features; their disease immunity is a Defenses row's `disease_immune` column (0.125.0). Nature's Ward's charm and fear
  immunity holds against elementals and fey only. Diamond Soul remains saving throw proficiency; its text grants no damage
  resistance or immunity. Its Ki reroll of a failed save works since 0.116.0.
  Empty Body spends four Ki for a minute of invisibility and resistance to all damage except force
  (0.211.0), and eight Ki for Astral Projection on the monk alone, set up before a fight. Aura of
  Devotion keeps the paladin and allies within 10 feet (30 at level 18) from being charmed.
- Petrified now uses typed resistance to all damage and poison damage immunity. Since 0.400.0 it also
  keeps every poison and disease condition off, and holds twelve of them already on in suspense rather
  than ending them.

Each generator declaration cites its SRD sentence; regression facts are inline and never read
`srd-src/`. The [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) remains the
source of the racial, class and spell rules above. This release does not change Engine snapshots or
executable package payloads. Package verification covers generation, declarations, hashes and archives;
an installed Capability API 1.132 Engine has not been exercised in this worktree.

## Damage that conditions change (0.64.0)

Capability API 1.133 lets a condition change the damage its holder deals or takes on an attack hit.

- **Divine Favor**: "your weapon attacks deal an extra 1d4 radiant damage on a hit", for a minute
  with concentration.
- **Hunter's Mark** marks the target for an hour with concentration: "you deal an extra 1d6 damage to
  the target whenever you hit it with a weapon attack". Only the marker's weapon hits add it. Moving
  the mark after the target drops, the Perception and Survival advantage, and the 8 and 24 hour
  durations of higher slots are the GM's.
- **Ray of Enfeeblement**: on a hit, "the target deals only half damage with weapon attacks that use
  Strength", until it succeeds on the Constitution save at the end of one of its turns.
- **Enlarge/Reduce** has two entries. Enlarge, on any creature you choose, adds 1d4 to its weapon
  damage and gives advantage on Strength saving throws. Reduce, on an enemy who may make a
  Constitution save to shrug it off, takes 1d4 away and gives disadvantage on Strength saves.
  Each also changes Strength checks the same way (Capability API 1.188), and makes its target one
  size bigger or smaller for its space and reach (Capability API 1.195).
- **Rage** damage (+2, +3 at 9th level, +4 at 16th) came with 0.66.0: Rage applies one of three
  damage conditions chosen by barbarian level (`applies[].when`, Capability API 1.167).

## Saves against conditions, damage or magic (0.65.0)

Capability API 1.134 lets a save modifier count only against certain conditions, damage types or
magic.

- **Races**: a dwarf has advantage on saves against poison (the poisoned condition and poison
  damage), a halfling against being frightened, an elf or half-elf against being charmed (every
  charm this sheet declares, Charm Person's and the Dominate spells' included), and a gnome on
  Intelligence, Wisdom and Charisma saves against magic. Each is a 1 in its trait row's column
  (the Features list's 17th to 20th), counted by a derived value that a combat level reads.
  Fey Ancestry's "magic can't put you to sleep" keeps the Sleep spell off (0.94.0).
- **Spells**: every hostile spell a fight resolves carries the `magical` quality, so a save against
  it is a save against magic.
- **Items**: the Robe of the Archmagi, Mantle of Spell Resistance, Spellguard Shield and Staff of the
  Magi give advantage on saves against magic while worn or held, and the Scarab of Protection while
  carried. The Belt of Dwarvenkind gives advantage on saves against poison and poison resistance.
- **Protection from Poison** gives advantage on saves against being poisoned beside its resistance.
- **Magic Resistance** on the 31 SRD creatures that print it holds from 0.188.0 (see below).
- The Necklace of Adaptation's saves against gases and the Holy Avenger's aura work since 0.300.0.
  The Ring of Spell Turning's single-target spells work since 0.257.0.

## Creature types (0.67.0)

Capability API 1.168 lets a creature be a type and carry tags, and lets a spell or an item ask what
its target is.

- **Creatures**: every monster has its SRD type (aberration, beast, celestial, construct, dragon,
  elemental, fey, fiend, giant, humanoid, monstrosity, ooze, plant or undead). Devils and demons are
  tagged `devil` and `demon` (the imp and the quasit included), and the 11 creatures with the
  Shapechanger trait are tagged `shapechanger`. A character is a humanoid, as every SRD race is.
- **Spells**: Charm Person, Dominate Person and Hold Person can be cast only on a humanoid, and
  Dominate Beast only on a beast. Hold Monster passes over the undead. Cure Wounds, Healing Word,
  Mass Healing Word, Mass Cure Wounds, Prayer of Healing, Heal, Mass Heal and Blight have no effect
  on undead or constructs, and an area spell among them simply skips them. A spell scroll of each
  follows the same rule.
- **Holy water**: 2d6 radiant to a fiend or undead on a hit, and nothing to anything else.
- **Creature types in saves and targets**: Sunbeam and Sunburst give undead and oozes disadvantage on
  their saves, Moonbeam shapechangers and Blight plants (which take its maximum damage); Polymorph and
  True Polymorph fail on a shapechanger; Animal Friendship needs Intelligence 3 or lower and Sleep passes
  over creatures immune to being charmed; Protection from Evil and Good and Dispel Evil and Good give
  attackers of those types disadvantage; Chill Touch's undead rider works; and the Dragon Scale Mail
  gives advantage on saves against dragons. Weapons that deal more to a creature type work from 0.68.0.

## Weapons that deal extra damage (0.68.0)

Capability API 1.169 lets a weapon item add damage on a hit, to everyone, to a creature type, or only
on a critical hit (a natural 20). Extra dice are doubled on a critical hit like the weapon's own.

- **Against a creature type**: a dragon slayer adds 3d6 of the weapon's type against dragons, a
  giant slayer 2d6 against giants, a holy avenger 2d10 radiant and a mace of disruption 2d6 radiant
  against fiends and undead, and a sun blade 1d8 radiant against undead. The sun blade is a finesse
  weapon that deals radiant damage instead of slashing.
- **Always**: a frost brand adds 1d6 cold.
- **On a 20**: a sword of sharpness adds 4d6 slashing, a vicious weapon 2d6 of its type, a sword of
  life stealing 3d6 necrotic (not to constructs or undead), and a mace of smiting 2d6 bludgeoning,
  4d6 against a construct. The mace also deals 2 more damage to a construct.
- The giant slayer's prone save, the mace of smiting's +2 to hit, the instant kills, the sword of
  life stealing's temporary hit points and the dwarven thrower came with 1.187 (0.86.0, below).
  The sword of wounding and the oathbow came with 1.189 (0.87.0, below).
- **Flame tongue (0.69.0, Capability API 1.170)**: "Ignite" is a switch on the sword, a bonus action
  either way in a fight or a button in the inventory, and while it burns every hit adds 2d6 fire. It
  stays lit between fights, as the sword stays drawn, and starts unlit.
- The javelin of lightning's once-a-day bolt works since 0.88.0: a 5-foot line to its target (Dex 13
  for half of 4d6 lightning to everyone else in it) and a ranged attack that adds 4d6 lightning.

## Spell areas that stay (0.71.0)

Capability API 1.172 lets a spell's area stay for its duration and strike again.

- **Cloudkill, Moonbeam, Black Tentacles and Sleet Storm** strike a creature that enters the area
  for the first time on a turn or starts its turn there, and nothing as they appear.
- **Incendiary Cloud, Insect Plague and Grease** strike everyone in the area as they appear, then a
  creature that enters it or ends its turn there.
- **Spirit Guardians** surround the caster at 15 feet and move with them, sparing the caster's side,
  and strike a creature that enters or starts its turn there.
- Sleet Storm now resolves: a Dexterity save or fall prone.
- Each lasts its duration (1 or 10 minutes), or until its concentration ends.
- Sleet Storm's concentration save and the scrolls of these spells came in 0.73.0. Black Tentacles'
  restraint is in "Escapes and zone rules (0.73.0)" below.

## Spell areas that move and change the ground (0.72.0)

Capability API 1.173 lets a lasting area move and change the ground under it.

- **Moonbeam** moves up to 60 feet for its caster's action, and **Flaming Sphere** up to 30 feet for
  a bonus action. Cloudkill and Incendiary Cloud drift 10 feet away from their caster as each of the
  caster's turns starts. A creature the area now covers is caught as if it had walked in.
- **Flaming Sphere** burns a creature that ends its turn within 5 feet of it. The source gave it the
  20-foot radius of its light as its area, which this version puts right.
- **Spike Growth** is difficult terrain that deals 2d4 piercing damage for every 5 feet a creature
  moves inside it, with no save. Its scroll leaves the same ground (0.73.0).
- **Black Tentacles, Grease, Insect Plague and Sleet Storm** are difficult terrain, and **Spirit
  Guardians** make each step cost double for the creatures they affect (their half speed).
- Flaming Sphere's ram, Spirit Guardians' half speed on difficult ground and Plant Growth came in
  0.74.0, below.

## Escapes and zone rules (0.73.0)

Capability API 1.174 adds a zone's concentration save, a zone's damage cap, and concentration and
zones on an item's use.

- **Sleet Storm** makes a creature concentrating in it roll a Constitution save against the spell
  save DC as it enters or starts its turn there, or lose concentration.
- **Guardian of Faith** strikes only a hostile creature that moves within 10 feet of it, 20 radiant
  with a Dexterity save for half, and nothing as it appears. It vanishes once it has dealt 60
  damage. It used to strike once as it was cast. Its 8 hours are kept as 1,000 rounds, longer than
  any fight.
- **Spell scrolls** of concentration spells hold the reader's concentration, so Heroism, Stoneskin,
  Greater Invisibility, Hunter's Mark, Divine Favor, Protection from Energy, Gaseous Form, Ray of
  Enfeeblement and Enlarge/Reduce scrolls now work. Scrolls of Moonbeam, Cloudkill, Spirit Guardians,
  Spike Growth and the other lasting areas leave their area, and Spirit Guardians and Guardian of
  Faith scrolls spare the reader's side.
- Web, Entangle and Black Tentacles' restraint came in 0.74.0, below. Guardian of Faith's Large body
  is a 10-foot burst around one cell.

## Holds you break free of, and harder ground (0.74.0)

Capability API 1.175 lets a hold name its own escape DC and checks, a moved zone ram a creature, and
ground cost more than double.

- **Web** is a lasting area of difficult ground: a creature entering it or starting its turn there
  makes a Dexterity save or is restrained. **Entangle** restrains on a failed Strength save as it is
  cast, and its ground stays difficult. **Black Tentacles** restrain on a failed save too, and a
  creature they already hold takes 3d6 bludgeoning as its turn starts, with no save.
- **Break free** is an action: a Strength check against the spell save DC for Web and Entangle,
  Strength or Dexterity for Black Tentacles, and Strength against DC 12 or 11 for a giant spider's or
  an ettercap's web. Only a hold with an escape DC can be broken, so a creature turning to stone
  stays held.
- **Flaming Sphere** rammed into a creature makes it save against the sphere's damage, and the
  sphere stops for the turn. A creature walking up to it is burned only as its turn ends.
- **Plant Growth** costs 4 feet of movement for every foot, for as long as a zone lasts (1,000
  rounds). Its 8-hour enrichment is text. **Spirit Guardians** halve speed in their area, so
  difficult ground there costs four times.
- Web, Entangle, Black Tentacles and Grease are squares or cubes, and fire burns Web's strands away;
  walls (Wall of Fire, Blade Barrier, Wall of Thorns), heavily obscured areas (Fog Cloud, Darkness,
  Stinking Cloud), Stinking Cloud's lost action, Silence, Globe of Invulnerability, Gust of Wind and
  Delayed Blast Fireball all work. Web's anchoring needs nothing on a board with walls.

## Cures, the dying and the dead (0.75.0)

Capability API 1.176 lets a spell or item end conditions, stabilize a dying creature, or bring back
one that died a few rounds ago.

- **Lesser Restoration** ends one of blinded, deafened, paralyzed or poisoned. **Greater
  Restoration** ends one effect that charmed or petrified its target. **Heal** and **Mass Heal**
  also end blindness and deafness, and **Protection from Poison** neutralizes a poison already on
  its target. Each is offered only against a creature holding something it ends.
- **Spare the Dying** stabilizes a dying creature that is not undead or a construct, and a
  **healer's kit** does the same with one of its ten uses, for an action.
- **Revivify** brings back a creature that died within the last 10 rounds (one minute), with 1 hit
  point.
- Spell scrolls of these spells cure as the spells do.
- A creature caught in its own side's Web or Entangle can break free of it.
- Greater Restoration lowering exhaustion by one and undoing a lowered hit point maximum is done in
  0.98.0 (a lowered ability score is not tracked in a fight), and the DC 10 Wisdom (Medicine) check
  to stabilize in 0.91.0, and a cure that ends a charm also ending the conditions applied with it
  (Hypnotic Pattern's incapacitated) in 0.99.0. Curses are not tracked in a fight, so curing them is
  the GM's; diseases are, since 0.125.0.

## Boxes and walls (0.76.0)

Capability API 1.177 adds box areas and walls.

- Cubes and squares are boxes with the side the SRD prints, no longer the nearest burst: Web,
  Entangle, Black Tentacles, Grease, Faerie Fire, Hypnotic Pattern, Slow and Thunderwave. A box's
  near corner sits on the aimed cell and it reaches away from the caster; Thunderwave's sits against
  its caster.
- **Wall of Fire** is an opaque wall up to 60 feet long or a ring 20 feet across. It burns creatures
  in it as it appears, then those entering it or ending a turn in it, or ending a turn within 10 feet
  of the side its caster picks. **Blade Barrier** (100 feet, or a 60-foot ring) is difficult ground
  that cuts a creature entering it or starting a turn there. **Wall of Thorns** (60 feet, or a
  20-foot ring) blocks sight, costs 4 feet of movement per foot, and tears creatures entering it or
  ending a turn there. **Wall of Stone** blocks movement and sight; **Wall of Force** and **Wall of
  Ice** block movement. **Wind Wall** strikes creatures in it as it appears. Panels are laid as one
  straight run.
- Fire Storm's ten cubes are placed at once, Wall of Thorns cuts whoever moves through it (0.95.0),
  and Wall of Ice breaks in sections (0.97.0). Blade Barrier's cover works since 0.263.0 and Wind Wall's deflected arrows since 0.266.0; Prismatic Wall's layers work since 0.248.0.

## Seeing (0.77.0)

Capability API 1.178 lets a fight know who can see whom.

- **Senses.** A character's darkvision is read off their race's Darkvision trait (60 feet for
  dwarves, elves, gnomes, half-elves, half-orcs and tieflings). A monster has the darkvision,
  blindsight, tremorsense and truesight its stat block prints. Blindsight and tremorsense work
  without eyes.
- **Unseen attackers and targets.** An attack against a target you can't see has disadvantage, and
  one against a target that can't see you has advantage. **Blinded** takes away sight and
  **invisible** hides its holder from everyone but blindsight, tremorsense and truesight, so both
  now work through this instead of fixed bonuses.
- **Obscured areas.** Fog Cloud, Stinking Cloud, Cloudkill, Incendiary Cloud and Sleet Storm are
  heavily obscured: nobody sees into, out of or through them. **Darkness** stops darkvision too;
  only blindsight, tremorsense and truesight see through it. Wall of Fire and Wall of Thorns block
  sight as walls.
- **"A creature you can see."** 31 spells (Hold Person, Magic Missile, Healing Word, Sacred Flame,
  Dominate Monster and others) and 9 monster actions (the lich's and mummies' gazes, a vampire's
  charm) only target what their maker can see.
- **Fire Storm** is ten 10-foot cubes, each touching another.
- Invisibility ends when its holder attacks or casts a spell; spells and items that grant a sense
  (Darkvision, See Invisibility, True Seeing, goggles of night, gem of seeing) grant it; Faerie Fire's
  outline cancels invisibility.

## Components and warding zones (0.78.0)

Capability API 1.179 lets a spell need components and an area change what happens inside it.

- **Components.** Every spell needs the verbal, somatic and material components the SRD prints. A
  spell cast from a scroll or a wand needs none (since 0.79.0).
- **Silence** is a 20-foot sphere for 10 minutes. Creatures inside are deafened and immune to
  thunder damage, and nobody inside can cast a spell with a verbal component.
- **Globe of Invulnerability** is a 10-foot barrier around its caster for a minute. A spell of 5th
  level or lower cast from outside it has no effect on anyone inside.
- **Stinking Cloud.** A creature that starts its turn inside saves on Constitution or loses its
  action that turn, as well as being heavily obscured.
- **Shatter** hits everyone in its 10-foot sphere; it was read as a single target before.
- Globe of Invulnerability reads a spell's own level, not the slot it is cast with, and blocks one
  level higher per slot above 6th; creatures immune to poison pass Stinking Cloud's save; monsters
  whose innate spellcasting needs no components cast without them; and scrolls of spells that only
  leave an area (Fog Cloud, Darkness, Silence, Globe) can be read.

## Invisibility and granted senses (0.79.0)

Capability API 1.180 lets a condition end when its holder attacks or casts, and lets spells and
items give senses.

- **Invisibility** makes a creature touched invisible for an hour, one more creature per slot above
  2nd, and ends for a creature once it attacks or casts a spell. Reading a scroll or using a wand
  counts as casting.
- **Darkvision** gives darkvision out to 60 feet, **See Invisibility** lets its caster see invisible
  creatures, and **True Seeing** gives truesight out to 120 feet.
- **Goggles of night** give darkvision out to 60 feet while worn. A **gem of seeing** has 3 charges
  (1d3 back at dawn) and spends one for 10 minutes of truesight out to 120 feet.
- **Faerie Fire**'s outline shows invisible creatures; fog and walls still hide them.
- A spell cast from a scroll or a wand needs no components (SRD 5.1, Activating an Item), so Silence
  doesn't stop it.
- Goggles of night add to darkvision a wearer already has since 0.81.0.

## Spell levels, poison and monster components (0.80.0)

Capability API 1.181 finishes what 0.78.0 left with the Engine.

- **Globe of Invulnerability** compares a spell by its own level, so an upcast Fireball still
  doesn't get through, and keeps out one level more for each slot above 6th it is cast with.
- **Stinking Cloud**'s save is against poison (a dwarf has advantage on it). Creatures immune to
  poison damage or to being poisoned pass it without rolling. No SRD 5.1 stat block says a creature
  doesn't breathe, so that half of the rule has nothing to read.
- **Monster spellcasting.** Innate spells "requiring no components" (the unicorn), "only verbal
  components" (the couatl, the deva) or "no material components" are cast that way, so Silence
  stops only what needs a voice. The nagas' slot spellcasting keeps the spells' own components;
  only their verbal one matters to Silence.
- **Scrolls** of Fog Cloud, Darkness, Silence and Globe of Invulnerability can be read in a fight.

## Pushes and Gust of Wind (0.81.0)

Capability API 1.182 lets an effect push, and a line stay pointed from its caster.

- **Gust of Wind** is a 60-foot line, 10 feet wide, held from its caster for a minute. A creature
  that starts its turn in it saves on Strength or is pushed 15 feet away, walking toward the caster
  inside it costs double, and the caster turns it with a bonus action.
- **Thunderwave** pushes whoever fails its save 10 feet away.
- **Ring of the ram:** 3 charges, 1d3 back at dawn. One charge is a +7 attack for 2d10 force that
  pushes 5 feet; spending two or three for more, and breaking objects, are text.
- **Goggles of night** add 60 feet to darkvision a wearer already has.
- Monster actions push (the bronze dragons' repulsion breath, the dragon turtle's tail, the minotaur
  skeleton's charge), and an item's use has a line's width, so a scroll of Gust of Wind can be read.

## Delayed Blast Fireball and burning webs (0.82.0)

Capability API 1.183 lets an area burst as it ends, and catch fire.

- **Delayed Blast Fireball** leaves a bead at a point for up to a minute. When the spell or the
  caster's concentration ends, it bursts in a 20-foot radius for 12d6 fire, Dexterity for half,
  plus 1d6 for each of the caster's turns that ended with it waiting, and 1d6 per slot above 7th.
  A creature moving onto the bead saves on Dexterity or sets it off. Throwing the bead after a
  successful save is text. A scroll of it can be read.
- **Web** is flammable: fire damage landing in it, or a fire area overlapping it, sets it burning.
  Whoever starts a turn in the burning webs takes 2d4 fire, and the webs are gone when the
  caster's turn comes round. The wand of web and scrolls of Web burn the same way.

## Monster pushes and wider scroll lines (0.83.0)

Capability API 1.184 lets a monster's action push, and an item's line be wider than one square.

- **Dragon turtle Tail:** on a hit, a creature fails a DC 20 Strength save or is pushed 10 feet
  and knocked prone.
- **Scrolls** of Gust of Wind, Wall of Thorns and Blade Barrier can be read in a fight.
- The metallic dragons' second breaths and the minotaurs' Charge came with 1.186 (below).

## What a creature is, read further (0.84.0)

Capability API 1.185 lets a save and its damage depend on what the target is, and attacks depend on
who makes or takes them.

- **Sunbeam** and **Sunburst:** undead and oozes save with disadvantage. **Moonbeam:**
  shapechangers do. **Blight:** plants save with disadvantage and take its maximum damage.
- **Animal Friendship:** a beast with Intelligence 3 or less saves on Wisdom or is charmed until
  the caster's side harms it; one more beast per slot above 1st. Its 24 hours outlast any fight.
- **Chill Touch:** an undead it hits has disadvantage on attacks against the caster until the end
  of the caster's next turn.
- **Protection from Evil and Good:** aberrations, celestials, elementals, fey, fiends and undead
  have disadvantage on attacks against the target, and celestials, elementals, fey, fiends and
  undead on attacks against a caster of **Dispel Evil and Good**. **Foresight:** advantage on attacks, checks and
  saves, and attacks against the target have disadvantage.
- **Dragon scale mail:** advantage on saves against what dragons do. In SRD 5.1 that is their
  Frightful Presence and breath weapons, and also the Wing Attack, which the armor does not name.
- Chill Touch's "can't regain hit points"; Protection from Evil and Good's "can't be charmed
  [or] frightened ... by them"; Dispel Evil and Good's Break Enchantment and Dismissal (0.103.0);
  Foresight's "can't be surprised" (0.104.0); Tasha's Hideous Laughter's "Intelligence 4 or less
  isn't affected"; saves against named actions of a kind (dragon scale mail's Frightful Presence and
  breath only); and Sleep's hit point pool (0.94.0) all work.

## Second breaths, charges and Strength checks (0.85.0)

Capability API 1.186 lets actions share one recharge and a blow add more after a straight run;
1.188 narrows attacks and checks to an ability and allows 160 conditions.

- **Metallic dragons:** each of the 20 breathes either weapon, and breathing one spends both until
  one recharge roll brings them back. Brass **Sleep Breath** leaves a creature that fails its
  Constitution save Asleep (unconscious) for its minutes, until it takes damage or someone within
  5 feet spends an action to wake it. Bronze **Repulsion Breath** pushes a creature that fails its
  Strength save 30, 40 or 60 feet. Copper **Slowing Breath**: no reactions, half speed, one attack,
  an action or a bonus action but not both. Gold **Weakening Breath**: disadvantage on Strength
  saves, checks and attacks. Silver **Paralyzing Breath**: paralyzed. The last three last a minute with a save at the
  end of each turn.
- **Minotaur** and **minotaur skeleton Charge:** a gore after moving at least 10 feet straight at
  the target adds 2d8 piercing, and a creature fails a DC 14 Strength save or is pushed 10 feet
  and knocked prone.
- **Shatter:** animated armor, flying swords, gargoyles, earth elementals and the clay, iron and
  stone golems are inorganic and save with disadvantage.
- **Strength checks and attacks** (Capability API 1.188): Weakening Breath also gives
  disadvantage on Strength checks and on attacks made with Strength; Rage gives advantage on
  Strength checks, and Enlarge and Reduce advantage and disadvantage. **Enhance Ability** has six
  entries, one per choice, each advantage on that ability's checks for an hour, one more target
  per slot above 2nd; Bear's Endurance also gives 2d6 temporary hit points. Bull's Strength
  doubles carrying capacity since 0.302.0; Cat's Grace's safe fall of 20 feet or less works since 0.300.0.
- A monster's own attacks reach Weakening Breath since 1.189 (0.87.0, below).

## Weapons that know what they hit (0.86.0)

Capability API 1.187 lets a weapon add to hit against a kind of creature, kill outright, and give
extra damage only to some targets or only when thrown.

- **Mace of smiting:** +3 to hit and damage against constructs, and a construct left at 25 hit
  points or fewer by its 20 is destroyed. **Mace of disruption:** a fiend or undead left at 25 hit
  points or fewer fails a DC 15 Wisdom save or is destroyed.
- **Giant slayer:** a giant it hits also makes a DC 15 Strength save or falls prone.
- **Sword of life stealing:** its 3d6 necrotic on a 20 gives the wielder that many temporary hit
  points; constructs and undead take none.
- **Dwarven thrower:** thrown out to 20/60 feet, and a thrown hit adds 1d8, or 2d8 against a giant.
- **Nine lives stealer:** 5 charges (1d8 + 1, its average rounded down). A 20 against a creature left
  under 100 hit points, not a construct or undead, is a DC 15 Constitution save or death, spending
  a charge.
- **Vorpal sword:** a 20 beheads, unless the target is immune to slashing, an ooze, has no head
  it needs (elementals, swarms, plants, animated objects, the xorn, the hydra and a few more,
  tagged headless) or has legendary actions (tagged legendary); those take 6d8 more slashing.
- The vorpal sword ignoring resistance to slashing, and the mace of disruption frightening a
  creature that makes its save, came in 0.90.0.

## Staff and ring extras (0.138.0)

Capability API 1.271 lets an item's first use be named on its menu, a use add a value off its
holder's sheet, a charge more push farther, and a last charge give charges back.

- **Menus:** a staff's or wand's first spell is named beside the others ("Staff of Fire: Burning
  Hands"), and the Wand of Fear's first use is its Cone of Fear.
- **Healing:** Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word and Prayer of Healing
  add the caster's spellcasting ability modifier, and Spiritual Weapon's strike does too. The Staff of
  Healing's Cure Wounds and Mass Cure Wounds add the holder's, in a fight and outside one, and a
  scroll of any of them adds its reader's (0.138.1).
- **Ring of the Ram:** each charge more pushes 5 feet farther as well as dealing 2d10 more force.
- **Last charges:** the Staff of the Magi gets 1d12 + 1 charges back on a 20 and the Staff of Power
  1d8 + 2. On a 1 (0.139.0), the staffs of charming and the woodlands become a plain quarterstaff
  and the Staff of Power a +2 quarterstaff, keeping only its +2.

## Sculpt Spells, Potent Cantrip and Empowered Evocation (0.206.0)

Capability API 1.414.

- **Sculpt Spells**: "you can choose a number of them equal to 1 + the spell's level. The chosen
  creatures automatically succeed on their saving throws against the spell, and they take no damage if
  they would normally take half damage on a successful save." Chosen as an evocation spell is cast, at
  no cost, like Careful Spell; the number grows with the slot the spell is cast at.
- **Potent Cantrip**: "When a creature succeeds on a saving throw against your cantrip, the creature
  takes half the cantrip's damage (if any) but suffers no additional effect from the cantrip."
- **Empowered Evocation**: "you can add your Intelligence modifier to one damage roll of any wizard
  evocation spell you cast." It is added to every target of a roll they share (Fireball), and to the
  first hit of a spell that rolls for each. Magic Missile's darts share one roll, so every dart gets it.

## Deflect Missiles and Slow Fall (0.205.0)

Capability API 1.413.

- **Deflect Missiles**: "you can use your reaction to deflect or catch the missile when you are hit by
  a ranged weapon attack. When you do so, the damage you take from the attack is reduced by 1d10 +
  your Dexterity modifier + your monk level." Taken as the ranged hit lands, it lessens that one blow,
  never below 0. Catching the missile and throwing it back works since 0.208.0.
- **Slow Fall**: "you can use your reaction when you fall to reduce any falling damage you take by an
  amount equal to five times your monk level." Taken as the fall happens, it lessens that fall's
  damage only.

## Dark One's Blessing (0.204.0)

Capability API 1.412.

- **Dark One's Blessing**: "when you reduce a hostile creature to 0 hit points, you gain temporary hit
  points equal to your Charisma modifier + your warlock level (minimum of 1)." The feature keeps a
  condition on the warlock: when a foe they dealt the last damage to drops to 0, they gain that many
  temporary hit points, which never stack with ones they already have (the bigger stands).

## Font of Inspiration, Superior Inspiration and Perfect Self (0.203.0)

Capability API 1.411.

- **Font of Inspiration**: "Beginning when you reach 5th level, you regain all of your expended uses of
  Bardic Inspiration when you finish a short or long rest." The Bardic Inspiration counter's recharge
  follows the bard level: a long rest below 5th, a short rest from 5th.
- **Superior Inspiration**: "when you roll initiative and have no uses of Bardic Inspiration left, you
  regain one use." **Perfect Self**: "when you roll for initiative and have no ki points remaining, you
  regain 4 ki points." Each is given back as a fight rolls initiative, never past the counter's maximum.

## Arcane and Natural Recovery (0.202.0)

Capability API 1.410.

- **Arcane Recovery** and **Natural Recovery**: "you can choose expended spell slots to recover. The
  spell slots can have a combined level that is equal to or less than half your wizard [druid] level
  (rounded up), and none of the slots can be 6th level or higher." Used on a short rest, the Game
  Master names the slots the player picks (`recover="1st-level slots:2"`); a pick over the budget, of a
  6th-level or higher slot, or of more slots than were spent is refused whole. Each pays its once per
  long rest counter. Pact Magic slots are a different group and never come back this way.

## Warding Bond (0.201.0)

Capability API 1.409.

- **Warding Bond**: "it gains a +1 bonus to AC and saving throws, and it has resistance to all damage.
  Also, each time it takes damage, you take the same amount of damage." The cleric touches a willing
  ally for an hour: the ally's AC and saves rise by 1 and it resists every damage type, and each time it
  is hurt the cleric takes the same damage (after the ally's resistance, then the cleric's own). The
  bond ends when the cleric drops to 0 hit points or the two are more than 60 feet apart.

## Lucky (0.200.0)

Capability API 1.408.

- **Lucky**: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can
  reroll the die and must use the new roll." A halfling's 1 on an attack, a save or a check in a fight is
  rolled again and the new roll stands, even another 1. With advantage or disadvantage, each die showing
  a 1 is rolled again. The log says "Lucky rolls it again".

## The kraken's swallow, pulling creatures out, and the rug of smothering (0.199.0)

Capability API 1.407.

- **The grapple ends**: "If the attack hits, the target is swallowed, and the grapple ends." The behir,
  giant frog, giant toad, remorhaz and tarrasque let go of the creature they swallow.
- **The kraken's Bite**: "If the target is a Large or smaller creature grappled by the kraken, that
  creature is swallowed, and the grapple ends." The bite hits anybody; one the kraken's tentacles hold is
  also swallowed, blinded and restrained, for 12d6 acid at the start of each of the kraken's turns. It
  lets the creature out, prone, on 50 damage from inside and a failed DC 25 Constitution save, and a
  dead kraken is climbed out of for 15 feet of movement.
- **Pulling a creature out**: "A creature within 5 feet of the cube can take an action to pull a creature
  or object out of the cube. Doing so requires a successful DC 12 Strength check, and the creature
  making the attempt takes 10 (3d6) acid damage." Pull out of the cube is an action for an ally beside
  the cube, and the acid comes win or lose. Pull out of the elemental is the water elemental's DC 14.
- **The rug of smothering**: Smother grapples a Medium or smaller creature (escape DC 13), restrained
  and blinded until the grapple ends, one at a time, for 2d6 + 3 bludgeoning at the start of each of its
  turns. Damage Transfer: "While it is grappling a creature, the rug takes only half the damage dealt to
  it, and the creature grappled by the rug takes the other half."

## Barkskin and Mage Armor (0.198.0)

Capability API 1.406.

- **Barkskin**: "the target's AC can't be less than 16, regardless of what kind of armor it is
  wearing." The druid or ranger touches a willing creature, concentrating for up to an hour; an Armor
  Class already 16 or better stays as it is.
- **Mage Armor**: "The target's base AC becomes 13 + its Dexterity modifier. The spell ends if the
  target dons armor." A willing creature touched has an Armor Class of at least 13 + its Dexterity
  modifier plus a shield or ring it wears, for 8 hours (4,800 rounds since 0.245.0); in armor it does
  nothing. The sheet shows the number as Armor Class under Mage Armor. The Unarmored Defense field's
  Mage Armor choice stays, for a character who keeps the spell up between fights.

## Regurgitating, climbing out and room inside (0.197.0)

Capability API 1.405.

- **Regurgitating**: "If the behir takes 30 damage or more on a single turn from the swallowed
  creature, the behir must succeed on a DC 14 Constitution saving throw at the end of that turn or
  regurgitate the creature, which falls prone." The behir (30, DC 14), remorhaz (30, DC 15), purple worm
  (30, DC 21) and tarrasque (60, DC 20) let a creature out, prone, that hurts them that much from
  inside.
- **Climbing out**: when a swallower dies, its prey stays in the corpse until it spends the printed
  movement to climb out, prone: 5 feet from a giant frog or toad, 15 from a behir or remorhaz, 20 from a
  purple worm, 30 from the tarrasque.
- **Room inside**: the behir, giant frog, giant toad and shambling mound hold one creature at a time.
  The gelatinous cube holds one Large creature or up to four Medium or smaller ones, and the water
  elemental's Whelm one Large or two Medium or smaller.
- **Aimed at a size**: the behir's and couatl's Constrict, the ettercap's Web and the rug of
  smothering's Smother can only be aimed at "one Large (or Medium) or smaller creature".
- **The shambling mound**: when both slams of its Multiattack hit a Medium or smaller target, the
  target is grappled (escape DC 14) and engulfed.

## Relentless Endurance, Relentless Rage and the better of two forms (0.196.0)

Capability API 1.404 and 1.405.

- **Relentless Endurance** (half-orc): "When you are reduced to 0 hit points but not killed outright, you
  can drop to 1 hit point instead." A half-orc in a fight drops to 1 instead, spending the trait's
  once-a-long-rest use from its counters row.
- **Relentless Rage** (barbarian, 11th level): dropping to 0 while raging, the barbarian makes a DC 10
  Constitution save and drops to 1 on a success. Each use after the first raises the DC by 5, counted
  on the Relentless Rage row, which a short or long rest resets.
- **The better of two bonuses** (Wild Shape and Shapechange): "If the creature has the same proficiency
  as you and the bonus in its stat block is higher than yours, use the creature's bonus instead of
  yours." For each save and skill the character is proficient in, the bonus is the form's ability
  modifier plus the character's proficiency bonus (doubled for expertise), or the form's printed bonus
  if that is higher. Every other save and check is the form's.

## Swallows, engulfing and holds by size (0.195.0)

Capability API 1.403.

- **Holds by size**: a rider printed "If the target is a Medium or smaller creature, it is grappled" holds
  only a target of that size or smaller. The tyrannosaurus, marilith, otyugh, glabrezu, ankheg, chuul and
  behir hold that way, the couatl's Constrict and the ettercap's Web reach only their printed size, and
  the gibbering mouther and gladiator knock only a Medium or smaller target prone.
- **Swallow** (the behir, giant frog, giant toad, remorhaz and tarrasque): a bite at a target the
  creature is grappling and that is no bigger than printed. On a hit the target is inside it, blinded
  and restrained, and takes the printed acid at the start of each of its turns (6d6, 2d4, 3d6, 6d6,
  16d6). It comes out when the swallower dies. The **purple worm** swallows a Large or smaller target
  that fails a DC 19 Dexterity save against its bite.
- **The gelatinous cube's Engulf** walks the cube up to its speed into Large or smaller creatures'
  spaces. Each makes a DC 12 Dexterity save; on a failure it takes 3d6 acid and is engulfed, restrained,
  carried along and burned for 6d6 acid at the start of each of the cube's turns. Escape the cube is an
  action and a DC 12 Strength check.
- **The shambling mound's Engulf** takes in a Medium or smaller creature it holds: blinded and
  restrained, it makes a DC 14 Constitution save at the start of each of the mound's turns or takes
  2d8 + 4 bludgeoning. Escaping the grapple (DC 14) ends it.
- **The water elemental's Whelm** holds a Large or smaller creature that fails its Strength save,
  grappled (escape DC 14) and restrained, for 2d8 + 4 bludgeoning at the start of each of its turns.
- NEED ENGINE (asked): regurgitating after 30 damage from inside (60 for the tarrasque), one swallowed
  at a time, the swallow ending the grapple, an attack aimed only at a size, the mound engulfing when
  both slams hit, Whelm's capacity by size, the kraken's bite swallowing only a held target, and
  climbing out of a dead swallower prone.

## Hanging on and shape changes (0.194.0)

Capability API 1.392, 1.400 and 1.401.

- **Undead Fortitude** (the zombie and the ogre zombie): damage that drops it to 0 asks a Constitution
  save at DC 5 + the damage; on a success it is left at 1. Radiant damage and critical hits get no save.
- **Relentless** (the boar 7, the giant boar 10, the wereboar 14): damage of that much or less that would
  drop it to 0 leaves it at 1, once a fight. The half-orc's Relentless Endurance and the barbarian's
  Relentless Rage hang on too, since 0.196.0.
- **Wild Shape**: an action and a use of Wild Shape turn the druid into any beast of the bestiary by the
  Beast Shapes table: challenge 1/4 with no flying or swimming speed at 2nd level, 1/2 with no flying
  speed at 4th, 1 at 8th. The beast's health, defense, speeds and actions replace the druid's, its own
  Intelligence, Wisdom and Charisma saves stay, a bonus action reverts, and damage past the beast's
  health carries over. An hour, at least, the shortest the SRD gives.
- **Polymorph** (any beast up to the target's challenge or level) and **True Polymorph** (a creature into
  any creature up to its challenge or level), each with an unwilling choice beside it that the target
  saves against on Wisdom. Neither unwilling choice reaches a shapechanger; True Polymorph reaches none.
  True Polymorph also turns a creature into an object, and an object into a creature.
- **Shapechange**: any creature up to the caster's level that is not a construct or an undead; the
  caster keeps their Intelligence, Wisdom and Charisma saves.
- **Change Shape** (the adult and ancient metallic dragons, the couatl and the deva): an action turns it into
  a humanoid or beast up to its own challenge, keeping its own hit points and this action; a dragon keeps
  its Intelligence, Wisdom and Charisma saves; a deva keeps its own actions. The night hag's changes
  nothing a fight reads; the oni's turns it into a Medium humanoid with its smaller glaive (0.400.0). Wild Shape and Shapechange take the better of the user's and the form's saves.

## Flying, climbing and regeneration (0.193.0)

Capability API 1.395 and 1.396.

- **Fly** (60 feet, 10 minutes), **Spider Climb** (climbing as fast as you walk, 1 hour), **Potion of
  Flying** (flying as fast as you walk, hovering, 1 hour), **Potion of Climbing**, **Wings of Flying**
  (60 feet for an hour, back at dawn), **Broom of Flying** (50 feet, hovering) and **Dragon Wings**
  (a bonus action, flying as fast as you walk, only with no armor worn). When it ends, someone up in
  the air falls.
- **Levitate**: a willing creature, or an unwilling one that fails a Constitution save
  (`Levitate (unwilling)`), moves only up or down, 20 feet a turn, and hovers. **Boots of
  Levitation** cast it on you at will.
- **Gaseous Form** flies 10 feet and hovers. Its walking speed falls to 0 too (0.263.0).
- **Regeneration**: the troll (10 hit points; acid or fire stops it next turn; down at 0 rather than
  dead until it starts a turn at 0 and regains nothing), oni and shield guardian (10, never at 0),
  vampire (20) and vampire spawn (10), whom radiant damage stops. The vampires' stops in sunlight or
  running water (0.263.0).
- **Survivor**: a 18th-level Champion regains 5 + Constitution modifier at the start of each turn at
  half hit points or less, never at 0.

## Summons (0.193.0)

Capability API 1.394. Called creatures fight on their caller's side with their own initiative.

- **Conjure Animals** and **Conjure Woodland Beings**: the printed choices, any beast (or fey) of the
  bestiary at or below the band's challenge rating, picked as the spell is cast (0.194.0): one of CR 2,
  two of CR 1, four of CR 1/2 or eight of CR 1/4. They stay for the hour of the spell's concentration,
  and their scrolls call them too. A higher slot calls more: twice as many with a 5th-level slot (6th
  for woodland beings), three times with a 7th (8th), four times with a 9th, up to 32 in
  one call.
- **Figurines of Wondrous Power:** the bronze griffon (6 hours), golden lions (one lion per use, two
  uses, 1 hour each), marble elephant (24 hours), obsidian steed (a nightmare, 24 hours), onyx dog
  (a mastiff, 6 hours), serpentine owl (a giant owl, 8 hours) and silver raven (12 hours), thrown
  within 60 feet. Each comes back once the days the SRD makes it wait have passed (0.263.0), the steed may disobey
  a good owner (0.316.0), the ivory goats work since 0.327.0, and since 0.358.0 the ebony fly's giant fly
  is ridden and the onyx dog's mastiff speaks Common and sees the invisible in its darkvision.
- **Elemental Gem:** broken with an action, its elemental (air, earth, fire or water, by the gem)
  stays for an hour of concentration.

## Allies beside the target and hurt targets (0.192.0)

Capability API 1.393.

- **Pack Tactics** (16 blocks, from the wolf and the kobold to the thug and the winter wolf): "advantage on an attack
  roll against a creature if at least one of the [creature's] allies is within 5 feet of the creature
  and the ally isn't incapacitated".
- **Blood Frenzy** (5 blocks: the quipper and its swarm, the sahuagin and two sharks): "advantage on melee attack
  rolls against any creature that doesn't have all its hit points", on melee attacks alone since
  0.194.0: the sahuagin's thrown spear has it only within reach.
- **Hunter's Prey: Colossus Slayer**: a Hunter's third-level choice beside the entry (Giant Killer and
  Horde Breaker). Once a turn, a weapon hit on a creature below its hit point maximum deals 1d8 more.
- **Divine Strike**: once on each of the Life Domain cleric's own turns, a weapon hit deals 1d8 more
  radiant damage (2d8 from cleric level 14). Never on an opportunity attack between turns.

## Draconic Presence (0.190.0)

An 18th-level Draconic Bloodline sorcerer's `Draconic Presence: Awe` and `Draconic Presence: Fear`
each spend 5 sorcery points as an action and hold concentration for up to 1 minute. Each hostile
creature that starts its turn within 60 feet makes a Wisdom save against the sorcerer's spell save
DC or is charmed (awe) or frightened (fear) for the rest of that minute. A creature that succeeds is
left alone by the aura for the rest of the fight.

## Spells cast without a slot (0.189.0)

The guided builder has a step for each of these, and each pick is the spell's own mechanics at its
lowest level with no slot spent. A spell with choices (Eyebite's three) is an entry per choice.

- **Mystic Arcanum**: one 6th-, 7th-, 8th- and 9th-level warlock spell at warlock levels 11, 13, 15
  and 17. It goes on the Eldritch invocations list (Charisma), with a `Mystic Arcanum (6th level)`
  counter that a long rest refills.
- **Spell Mastery**: one 1st- and one 2nd-level wizard spell at wizard level 18, cast at will
  (Intelligence).
- **Signature Spells**: two 3rd-level wizard spells at wizard level 20, each with its own
  `Signature Spell: <name>` counter that a short rest refills. Casting one with a slot at a higher
  level is the Spells list's row, prepared as usual.

## Stat-block traits (0.188.0)

Traits the Engine already reads, now carried on the monsters that print them:

- **Magic Resistance** (31 blocks, from the archmage and the imp to the tarrasque): "advantage on saving
  throws against spells and other magical effects", a `magic_resistance` condition every such block keeps
  on through the fight. A spell is magical, so every save against one rolls twice.
- **Charge, Pounce and Trampling Charge** (23 attacks: boars, elk, goats, the centaur, elephant, gorgon,
  lion, mammoth, minotaurs, panther, rhinoceros, tigers, triceratops, unicorn, warhorse, and since 0.297.0
  the wereboar's tusks and the weretiger's claw in their beast and hybrid forms): after the
  printed straight run, the blow adds its extra dice and the target makes the printed Strength save or
  is knocked prone (the minotaurs' also pushes 10 feet). The elks' untyped extra damage is the ram's.
  Pounce's and Trampling Charge's bonus-action attack against the prone target follows the charge since
  0.261.0.
- **Martial Advantage** (hobgoblin) and **Sneak Attack** (spy, assassin): once a turn on a weapon hit,
  the hobgoblin's when an ally stands next to the target, the others' with advantage or with an ally
  next to the target and no disadvantage.
- **Savage Attacks** (half-orc): one more weapon die on a melee critical, beside a barbarian's Brutal
  Critical.

## Fight poses (0.185.0)

Capability API 1.786. Art only: nothing here changes a rule.

- **Sneaking:** a party member who has hidden (Hide), or who is invisible or camouflaged (Hide in Plain
  Sight), is drawn sneaking as they move: "impossible to see without the aid of magic or a special sense".
- **Praying:** spells and features from a Cleric or Paladin row are cast kneeling in prayer. The cleric
  is "a conduit for divine power", and a paladin draws "on divine magic through meditation and prayer".
  Druids are left out: the class column would make Wild Shape kneel too. Rangers use "the magical
  essence of nature", not divine magic.

## Hit dice and Song of Rest (0.184.0)

Capability API 1.337.

- "A character can spend one or more Hit Dice at the end of a short rest ... the player rolls the die
  and adds the character's Constitution modifier to it." The short rest spends them: the Game Master
  says how many and from which pool (`[sheet: op="rest" rest="short" dice="2" pool="hit_dice_d8"]`),
  or they come from the biggest die first. Each die heals at least 0, and too few dice refuse the rest.
- **Song of Rest:** a bard of 2nd level or higher gives each creature that spends hit dice an extra
  1d6, 1d8 at 9th, 1d10 at 13th and 1d12 at 17th. The party's best song counts, whoever sings it, and
  the sheet shows it as **Song of Rest die**. An item may add to that die with the `song_of_rest_add`
  stat; no SRD item does.

## Legendary Resistance (0.183.0)

Capability API 1.317.

- "Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead."
  The 23 creatures that print it (the twenty adult and ancient dragons, the lich, the tarrasque and the vampire) turn
  their first three failed saves in a fight into successes, always while standing, and the log says how
  many are left.
- A spell scroll of Resilient Sphere reaches only a Large or smaller creature, as the spell does.

## Resilient Sphere (0.182.0)

Capability API 1.314.

- "A sphere of shimmering force encloses a creature or object of Large size or smaller within range. An
  unwilling creature must make a Dexterity saving throw. On a failed save, the creature is enclosed for
  the duration. Nothing ... can pass through the barrier, in or out." No damage, condition, area, aura or
  threat crosses it either way, and the one inside has a speed of 0.
- "An enclosed creature can use its action to push against the sphere's walls and thus roll the sphere
  at up to half the creature's speed. Similarly, the globe can be picked up and moved by other creatures."
  Rolling and lifting each take an action; putting it down is free.
- "A disintegrate spell targeting the globe destroys it without harming anything inside it."
- Only creatures of Large size or smaller can be picked, and since 0.183.0 the same holds for its scroll.

## Maze, Expeditious Retreat, Eyebite's choices, scores with a cap (0.181.0)

Capability API 1.313.

- **Maze:** "You banish a creature that you can see within range into a labyrinthine demiplane ... The
  target can use its action to attempt to escape. When it does so, it makes a DC 20 Intelligence check. If
  it succeeds, it escapes, and the spell ends (a minotaur or goristro demon automatically succeeds)."
  No save. The mazed creature is out of the fight but keeps its turns, on which it may only try to
  escape; it comes back where it was. A new Intelligence check joins the fight's checks. The goristro
  is not in SRD 5.1.
- **Expeditious Retreat:** casting it takes the Dash action, and a bonus-action Dash is offered on each
  later turn while it is held.
- **Eyebite:** on each later turn the caster may pick Asleep, Panicked or Sickened again for a new
  target; a creature that saved against this casting can't be picked.
- **Hammer of Thunderbolts:** "You must be wearing a belt of giant strength (any variety) and gauntlets of
  ogre power to attune to this weapon. The attunement ends if you take off either of those items. While
  you are attuned to this weapon and holding it, your Strength score increases by 4 and can exceed 20, but
  not 30."
- **Capped scores:** the Ioun Stones of Agility, Insight, Intellect, Leadership and Strength, and the belt
  of dwarvenkind, raise their score by 2 "to a maximum of 20". The source's Ioun Stone of Absorption
  prints Fortitude's sentence, so it raises nothing.

## The hammer's thunderclap (0.180.0)

Capability API 1.312 hurls the Hammer of Thunderbolts.

- **Hurled for a charge:** "you can expend 1 charge and make a ranged weapon attack with the hammer,
  hurling it as if it had the thrown property with a normal range of 20 feet and a long range of 60 feet.
  If the attack hits ... The target and every creature within 30 feet of it must succeed on a DC 17
  Constitution saving throw or be stunned until the end of your next turn." Allies and the wielder in
  reach save too. Five charges, 1d4 + 1 back at dawn.
- **Giant's Bane:** "When you roll a 20 on an attack roll made with this weapon against a giant, the
  giant must succeed on a DC 17 Constitution saving throw or die."
- Still text until 0.181.0: the +4 Strength while the belt and gauntlets are on, and attunement ending
  when either comes off.

## Consume Life, the scroll's mote, the camouflage wearing off (0.179.0)

Capability API 1.311 closes what 0.175.0 and 0.177.0 left as text.

- **Will-o'-wisp, Consume Life:** "As a bonus action, the will-o'-wisp can target one creature it can see
  within 5 ft. of it that has 0 hit points and is still alive. The target must succeed on a DC 10
  Constitution saving throw against this magic or die. If the target dies, the will-o'-wisp regains 10
  (3d6) hit points." Its Invisibility now ends "until it attacks or uses its Consume Life" too.
- **A spell scroll of Sunbeam:** the mote goes in the reader's hand, held by the reading's concentration,
  with Sunbeam: Line.
- **Hide in Plain Sight:** "Once you move or take an action or a reaction, you must camouflage yourself
  again to gain this benefit." Camouflaged comes off, from the sheet too, at the ranger's first step or
  anything they do but Hide.
- **Call Lightning (a fix):** "Each creature within 5 feet of that point must make a dexterity saving throw".
  Its bolt had the 60-foot radius of the cloud overhead.

## Again while concentrating (0.178.0)

Capability API 1.310 offers a concentration spell's effect again for no slot, and ends a condition at a
distance.

- **Vampiric Touch:** "Until the spell ends, you can make the attack again on each of your turns as an
  action."
- **Call Lightning:** "On each of your turns until the spell ends, you can use your action to call down
  lightning in this way again, targeting the same point or a different one."
- **Heat Metal:** "Until the spell ends, you can use a bonus action on each of your subsequent turns to
  cause this damage again", at the same target.
- **Eyebite:** "On each of your turns until the spell ends, you can use your action to target another
  creature but can't target a creature again if it has succeeded on a saving throw against this casting".
  Panicked: "If the target moves to a place at least 60 feet away from you where it can no longer see you,
  this effect ends" (more than 55 feet on the board's 5-foot cells).
- Still text: Eyebite's effect picked anew each time (its "again" repeats the effect it was cast with).

## Camouflage, Feral Senses, the cube and the ritual (0.177.0)

Capability API 1.309 sets what hiding needs, lets a creature surprise from a hidden start, and binds a
pact weapon by a sheet note.

- **Hide in Plain Sight:** "Once you are camouflaged in this way, you can try to hide by pressing yourself
  up against a solid surface, such as a tree or wall". The +10 counts only while the ranger holds the new
  Camouflaged condition, ticked on the sheet once the minute's camouflage is made, and stands beside a
  cell that blocks sight.
- **Feral Senses:** "When you attack a creature you can't see, your inability to see it doesn't impose
  disadvantage on your attack rolls against it." Knowing where an invisible creature is that is not hidden
  a fight already gives.
- **Gelatinous cube, Transparent:** "A creature that tries to enter the cube's space while unaware of the
  cube is surprised by the cube": whoever it starts the fight hidden from is surprised.
- **Pact of the Blade's ritual:** "You perform the ritual over the course of 1 hour, which can be done
  during a short rest." The sheet's new Pact weapon note names the magic weapon bound; only that held
  weapon may be made the pact weapon, and none while the note is empty.
- Still text until 0.179.0: the camouflage ending when the ranger moves or takes an action or a reaction
  ("you must camouflage yourself again").

## Thrown pact weapons and scroll beams (0.176.0)

Capability API 1.308 lets an item's use aim like its spell and conjures a thrown melee weapon by its reach.

- **Pact of the Blade:** every one of the SRD's 28 melee weapons, the dagger, handaxe, javelin, light
  hammer, spear and trident too, each conjured by its reach. "if you dismiss the weapon (no action
  required)": a free Dismiss, and the weapon goes when the warlock dies.
- **Scrolls and the wand:** a spell scroll of eldritch blast, Magic Missile or Scorching Ray, and the wand
  of magic missiles, may send every beam, dart or ray at one target; the scroll's eldritch blast has its
  reader's beams for their level.
- **With this Engine:** One with Shadows ends on a reaction too ("until you move or take an action or a
  reaction"), and Chains of Carceri bars only "the same creature", not each creature of that name.
- Still text: binding a magic weapon with the hour's ritual outside a fight (it is a form picked as the
  pact weapon is made).

## Concentration and the mote (0.175.0)

Capability API 1.307 lets a creature's own action be held by its concentration, ends a condition when its
holder uses a named action, and puts conditions on a spell's own caster.

- **A monster's Invisibility:** "The imp magically turns invisible until it attacks, or until its
  concentration ends (as if concentrating on a spell)." The imp's, quasit's, sprite's, duergar's, green
  hag's and will-o'-wisp's are held by their concentration, so damage tests it. The quasit's ends when it
  "uses Scare", the duergar's when it "uses its Enlarge".
- **The invisible stalker:** "The stalker is invisible", all fight long.
- **Sunbeam:** "For the duration, a mote of brilliant radiance shines in your hand. It sheds bright light in
  a 30-foot radius and dim light for an additional 30 feet. This light is sunlight." Cast, the mote goes on
  the caster, held by the spell's concentration, and gives Sunbeam: Line, "a new line of radiance as your
  action on any turn until the spell ends", with no slot spent.
- Still text until 0.179.0: the will-o'-wisp's Consume Life (a dying target that dies on a failed save,
  and hit points back), so it could not end the wisp's invisibility; and the mote from a spell scroll of Sunbeam.

## The pact weapon (0.174.0)

Capability API 1.306 puts a conjured weapon in hand and lets invocations change it.

- **Pact of the Blade:** "You can use your action to create a pact weapon in your empty hand. You can
  choose the form that this melee weapon takes each time you create it. You are proficient with it while
  you wield it. This weapon counts as magical". The action offers each of the SRD's 28 melee weapons, and
  any magic melee weapon the warlock holds ("You can transform one magic weapon into your pact weapon").
  Using it again puts another in its place.
- **Lifedrinker:** "extra necrotic damage equal to your Charisma modifier (minimum 1)" on each hit with
  the pact weapon.
- **Thirsting Blade:** "You can attack with your pact weapon twice, instead of once".
- A thrown melee weapon (dagger, handaxe, javelin, light hammer, spear, trident) can be the pact weapon
  (Capability API 1.308), and the hour's ritual binds a magic weapon, the one named in the sheet's Pact
  weapon note (`boundIn`, 1.309). The weapon vanishing 5 feet away for a minute works since 0.246.0.

## Beams, darts and rays (0.173.0)

Capability API 1.305 lets an entry's targets grow with the sheet and name one target more than once.

- **Eldritch blast:** "two beams at 5th level, three beams at 11th level, and four beams at 17th level.
  You can direct the beams at the same target or at different ones. Make a separate attack roll for
  each beam." Agonizing Blast's Charisma and Repelling Blast's 10-foot push go on every beam that hits.
- **Magic Missile and Scorching Ray:** "you can direct them to hit one creature or several", each dart
  or ray at any target, as many on one as wanted.
- Still text: a scroll or wand of them sends one dart, ray or beam at each target, the base number.

## Chains of Carceri once a creature (0.172.0)

Capability API 1.304 keeps an entry off a creature it was used on until its user rests.

- **Chains of Carceri:** "You must finish a long rest before you can use this invocation on the same
  creature again." Once it is cast on a creature, it is not offered against that creature until the
  warlock's next long rest, across fights; others it can still hold.

## One with Shadows (0.171.0)

Capability API 1.303 offers an action only in some light and ends a condition when its holder moves
or acts.

- **One with Shadows:** "When you are in an area of dim light or darkness, you can use your action to
  become invisible until you move or take an action or a reaction." On the menu only where the
  warlock stands in dim light or darkness; moving, attacking, casting or taking another action ends it.
  Taking a reaction ends it too (Capability API 1.308).

## Invocations that change eldritch blast (0.170.0)

Capability API 1.302 lets an invocation change a spell each time its holder casts it.

- **Agonizing Blast:** "add your Charisma modifier to the damage it deals on a hit."
- **Eldritch Spear:** "its range is 300 feet."
- **Repelling Blast:** "you can push the creature up to 10 feet away from you in a straight line", or
  not: the menu also offers Eldritch Blast (no push).
- All three stack on the one cantrip.

## Light that moves with its holder (0.169.0)

Capability API 1.301 lets a zone go where a creature goes and lets copies of a zone stand apart.

- **Darkness and Daylight:** "If the point you choose is on an object you are holding ... the darkness
  emanates from the object and moves with it." Cast on the caster's own space, the sphere is centred
  on them as they move, and so is what it lights, darkens or dispels. Cast anywhere else it stays put.
  Still text: an object lying loose, and covering it with a bowl or a helm.
- **Dancing Lights:** "You create up to four torch-sized lights within range ... A light must be within
  20 feet of another light created by this spell." Four 10-foot spheres of dim light, moved together
  60 feet with a bonus action. Combining them into one Medium form stays text.

## Every second slot level (0.168.0)

Capability API 1.300 lets a higher slot add its step once for every two levels, and lets the action a
spell's condition gives grow with the slot that spell was cast with.

- **Flame Blade:** "the damage increases by 1d6 for every two slot levels above 2nd." The Strike is
  3d6 from a 2nd- or 3rd-level slot, 4d6 from 4th, 5d6 from 6th and 6d6 from 8th, for the whole
  minute the blade lasts.
- **Spiritual Weapon:** "the damage increases by 1d8 for every two slot levels above the 2nd."

## Darkness against light (0.167.0)

Capability API 1.299 lets magical darkness put out spell light and keeps other light out of it.

- **Darkness:** "If any of this spell's area overlaps with an area of light created by a spell of 2nd
  level or lower, the spell that created the light is dispelled." Light, Continual Flame, Flame Blade
  and Produce Flame end where they meet it, Flame Blade's concentration with it; Daylight and Fire
  Shield do not. "Nonmagical light can't illuminate it": a torch, lamp or lantern in it lights
  nothing, while a magic item's light (sun blade, flame tongue, mace of disruption, gem of
  brightness, lantern of revealing) is magical and still does.
- **Daylight:** ends darkness of 3rd level or lower only where its 60-foot bright sphere meets it,
  not its dim light beyond.

## Sunlight and monsters that vanish (0.166.0)

Capability API 1.298 lets a light be sunlight and a monster's own light go out while it is invisible.

- **Sun blade:** "The light is sunlight." Sunlight Sensitivity reads its bright light, so a drow or a
  kobold in it attacks with disadvantage, on a dark board or a bright one.
- **Invisibility:** the imp, quasit, sprite, duergar and will-o'-wisp, and the green hag's Invisible
  Passage, are an action that turns the creature invisible until it attacks, or casts a spell where
  the SRD says so. The will-o'-wisp's light turns invisible with it and comes back when it shows
  itself. Still text: their concentration (a creature's action keeps none), the quasit's Scare and the
  wisp's Consume Life ending it, and the invisible stalker, which is always invisible.
- **Still text:** Sunbeam's mote of sunlight in the caster's hand, which waits on a cast that also
  puts a condition on its caster.

## Eldritch invocations (0.165.0)

The guided builder has a **Pact Boon** step and an **Eldritch Invocations** step after Metamagic. A
warlock picks one pact at 3rd warlock level and as many of the SRD's 32 invocations as the Invocations
Known column gives (2 at 2nd level, up to 8 at 18th). Each invocation is offered only once its
prerequisite is met: a warlock level, the eldritch blast cantrip, a pact, or a level and a pact. The
picks go on two new sheet lists, **Pact boon** and **Eldritch invocations**.

- **Pact of the Chain:** puts Find Familiar, a ritual, on the spells list, with its own copy for the four
  special forms; since 0.248.0 the familiar can attack in place of one of the warlock's attacks.
- **Pact of the Tome:** picks three cantrips of any class at the Bonus cantrip step.
- **Book of Ancient Secrets:** picks two 1st-level ritual spells of any class.
- **Devil's Sight:** sees normally 120 feet in darkness and through Darkness.
- **Beguiling Influence:** trains Deception and Persuasion.
- **At will:** Armor of Shadows, Ascendant Step, Beast Speech, Eldritch Sight, Fiendish Vigor, Mask of
  Many Faces, Master of Myriad Forms, Misty Visions, Otherworldly Leap, Visions of Distant Realms and
  Whispers of the Grave cast their spell in a fight with no slot (and no material component where the
  SRD says so), with the warlock's Charisma.
- **Once a long rest:** Bewitching Whispers, Dreadful Word, Minions of Chaos, Mire the Mind, Sculptor of
  Flesh, Sign of Ill Omen and Thief of Five Fates cast with a warlock slot and spend a class resource of
  their own, back after a long rest.
- **Chains of Carceri:** casts hold monster at will on a celestial, fiend or elemental only.
- **Still text:** Eyes of the Rune Keeper, which waits on the Engine. Witch Sight works since 0.300.0. Gaze of Two Minds
  and Voice of the Chain Master work since 0.246.0.

## Light from spells and lanterns (0.164.0)

Capability API 1.297 lets an area shed light, Daylight end magical darkness, and a light show the
invisible.

- **Daylight:** a zone at a point within 60 feet for an hour, bright light 60 feet from its middle and
  dim light 60 feet beyond. Where it meets a Darkness of 3rd level or lower, that Darkness ends. Its
  zone reaches its dim light, so it ends a Darkness its dim light meets too, not only its bright
  sphere. Daylight on a held object is no longer a choice.
- **Darkness:** is magical darkness, which Daylight ends.
- **Dancing Lights:** one glowing form (the SRD's combined Medium shape), dim light 10 feet, moved 60
  feet with a bonus action. The four separate lights are not offered.
- **Bullseye lantern:** lit and pointed with an action ("Lantern" on the item's use), a cone held by its
  carrier: bright light 60 feet ahead and dim light 60 more, nothing behind; turned with a bonus action.
- **Lantern of revealing:** invisible creatures in its bright light are seen.
- **Light:** may be cast on a hostile's held object; that creature avoids it with a Dexterity save,
  and an ally lets it land.
- **Flame Blade:** cast with a bonus action, the blade sheds bright light 10 feet and dim 10 more, and
  "Flame Blade: Strike" is the action's melee spell attack for 3d6 fire, with no slot spent. Before,
  each strike was a cast that spent a slot. Its higher-slot damage is still text.
- **Produce Flame:** hurled as it is cast, now at 30 feet (before, only at touch range). "Produce Flame
  (held)" holds the flame instead, shedding 10 and 10, and "Produce Flame: Hurl" throws it on a later
  turn, which ends it.
- **Devil's Sight:** the bearded, barbed, bone, chain, horned and ice devils, the imp and the lemure see
  through Darkness with their darkvision. The warlock's invocation is in 0.165.0.
- **Fix:** the cloud giant's innate spells save against DC 15 (8 + its proficiency + its Charisma), as
  the SRD reckons a DC it doesn't print.

## Lights monsters switch (0.163.0)

Capability API 1.296 lets a monster light and put out its own light, and an item shed light while
switched off.

- **Magmin:** Ignited Illumination. It begins with its flames out; "Ignite" (a bonus action) sets it
  ablaze, shedding 10 feet of bright light and 10 of dim, and "Extinguish" (a bonus action) puts it out.
- **Will-o'-wisp:** Variable Illumination. It begins at 20 and 20, and a bonus action sets the radius to
  5, 10, 15 or 20 feet ("Light 5 ft." and so on), dim light as far again. The SRD prints no way to put
  it out.
- **Lanterns:** the hooded lantern and the lantern of revealing with the hood down shed dim light in a
  5-foot radius.

## Putting lights out (0.162.0)

Capability API 1.295 adds a switch for a light.

- **Torch:** a character's torch can be put out and lit again, free once a turn (an object
  interaction). With it out they shed no light and may go unseen in the dark; lit again, they are seen
  and found if hiding.
- **Lanterns and the gem of brightness:** the hooded lantern and the lantern of revealing light with an
  action ("Lantern"), and so does the gem of brightness's first command word ("Light"). They start
  unlit. A lowered hood's dim 5 feet comes in 0.163.0.
- **Flame tongue and sun blade:** a flame tongue's light (40 and 40) shines only while it is ablaze
  ("Ignite", a bonus action), and the sun blade's (15 and 15) while its blade exists ("Blade", a bonus
  action). The sun blade's light being sunlight, and its attacks needing the blade, are still text.

## Darkness and light (0.161.0)

Capability API 1.294 makes darkness keep eyes from seeing (SRD 5.1, Vision and Light).

- **Darkness and dim light:** nobody in darkness is seen, and nobody in dim light is seen clearly, so
  attacks against the unseen have disadvantage and anyone not seen clearly may Hide. Darkvision sees darkness as dim
  light and dim light as bright within its range; truesight, blindsight and tremorsense see in any
  light within theirs. Caves and dungeons are dark at any hour; outdoors the scene's time of day
  sets the light.
- **Torches:** a character without darkvision carries one: bright light 20 feet and dim light 20 more.
  Walls keep light out.
- **Spells:** Light (20 and 20) and Continual Flame (like a torch) on an ally's held thing; Daylight
  (60 and 60) shining from the caster; Fire Shield (10 and 10) and the paladin's Holy Nimbus (30 and 30) from the caster.
- **Items:** carried, a candle (5 and 5), lamp (15 and 30), torch (20 and 20), hooded lantern and
  lantern of revealing (30 and 30); held, the mace of disruption (20 and 20).
- **Monsters:** the azer, giant fire beetle and nightmare shed 10 and 10, the fire elemental 30 and 30.
- **Still text:** the bullseye lantern's cone (from 0.164.0 none), a lantern's lowered hood (from
  0.163.0 none), lighting and dousing in a fight (from 0.162.0 only the magmin's flames and the
  will-o'-wisp's chosen radius, from 0.163.0 none), Daylight on a point rather than a held object and
  its dispelling darkness, Light on a hostile's object, the lantern of revealing showing the invisible,
  Flame Blade's and Produce Flame's light (from 0.164.0 none of these), and Devil's Sight (from 0.164.0
  only the warlock's invocation, from 0.165.0 none).

## Attacks in the sun (0.160.0)

Capability API 1.293 lets a monster's attack rolls change with where it stands. Sunlight Sensitivity
(drow, duergar, kobold, wight, wraith, specter, drider) gives disadvantage on attack rolls in sunlight,
and the cloaker's Light Sensitivity in bright light. Any advantage cancels it as usual.

## Hiding your own way (0.159.0)

Capability API 1.292 gives characters and monsters their own ways of hiding and finding the hidden.

- **Naturally Stealthy:** a lightfoot halfling can Hide while somebody at least one size larger stands
  between it and whoever looks, on every line between them.
- **Hide in Plain Sight:** a 10th-level ranger's Hide adds 10 to its Stealth total, taken off once the
  ranger moves or acts. The minute of camouflage and the solid surface to press against are still text.
- **Supreme Sneak:** a 9th-level thief hides with advantage after moving no more than half its speed
  that turn.
- **Blindsense:** nobody within 10 feet hides from a 14th-level rogue, unless the rogue is deafened.
- **Transparent:** the gelatinous cube starts the fight hidden in plain sight with a total of 15 from
  anyone whose passive Perception doesn't beat it, until it moves or attacks; a Search beating 15
  finds it. Surprising a creature that walks into it unaware is still text.

## Monsters that hide and look (0.158.0)

Capability API 1.291 gives monsters their own ways of hiding and looking.

- **Bonus-action Hide:** the goblin's Nimble Escape (Disengage or Hide), the spy's Cunning Action
  (Dash, Disengage or Hide), and the shadow's Shadow Stealth (Hide, only in dim light, darkness or a
  fog).
- **Keen Sight, Hearing and Smell** (48 monsters): advantage on Perception, so Search rolls twice and
  passive Perception is 5 higher. Keen Sight alone needs the monster's eyes. The ettin's Two Heads and
  the death dog's Two-Headed give the same advantage.
- **Sunlight Sensitivity** (drow, duergar, kobold, wight, wraith, specter, drider) puts disadvantage on
  sight-based Perception in sunlight, and the cloaker's Light Sensitivity in bright light. The light
  comes from the scene's time of day outdoors. From 0.160.0 (Capability API 1.293) their attack rolls have
  disadvantage in that light too.
- **Camouflage:** Stone Camouflage (deep gnome, grick, grimlock, stone giant, xorn) gives advantage on
  Stealth on mountain or ruin tiles and in caves, mountains and ruins; Snow Camouflage (winter wolf) in
  snow; Underwater Camouflage (both octopuses) in water.
- **Printed passive Perception:** the eight monsters whose printed passive isn't 10 + their
  Perception use the printed one (black bear 13, blink dog 10, bone devil 9, camel 9, chain devil 8,
  spider 12, swarm of ravens 15, warhorse 11).

## Looking for the hidden (0.157.0)

Capability API 1.290 lets the things that change Stealth and Perception reach Hide and Search.

- **Armor:** heavy armor and the other armor the SRD gives "disadvantage on Dexterity (Stealth)
  checks" now make Hide roll at disadvantage.
- **Boots and Cloak of Elvenkind, Cloak of the Bat:** advantage on Hide. **Eyes of the Eagle, Robe of
  Eyes:** advantage on Search, and 5 more on passive Perception.
- **Passive Perception** is 5 higher with advantage on Perception and 5 lower with disadvantage, as
  the SRD says.
- **Cloak of Elvenkind** also gives "Wisdom (Perception) checks made to see you have disadvantage": a
  searcher rolls at disadvantage for its wearer, and an enemy's passive is 5 lower.
- **Pass without Trace** works: for its hour, its caster and every ally within 30 feet of them have
  +10 on Stealth. It reaches the caster's whole side, not only the creatures they choose.

## Stinking Cloud in the wind (0.156.0)

Capability API 1.289 lets a wind take a while to blow fog away.

- **Stinking Cloud:** "A strong wind (at least 20 miles per hour) disperses it after 1 round." A Gust
  of Wind blowing on it for a whole round ends it, along with the concentration holding it. If the
  gust stops reaching it first, the round starts over.

## Ready (0.155.0)

Capability API 1.288 makes the Ready action real.

- **Ready** offers every attack, spell or creature action you could take with your action now, and a
  move up to your speed, each held for one of two triggers: an enemy you can see comes within reach
  of it, or an enemy you can see finishes doing something. When the trigger happens you take it with
  your reaction, or let it go. It is held until the start of your next turn.
- **A readied spell** spends its slot as you ready it and is held with concentration, so readying it
  ends any other concentration. If the concentration breaks it is lost, and if it never goes off the
  slot stays spent.

## Hiding (0.154.0)

Capability API 1.287 makes Hide, Search and passive Perception real.

- **Hide** rolls Dexterity (Stealth). You are then hidden from each enemy that can't see you clearly
  (you are behind a wall, in a fog or darkness it can't see through, invisible, or only lightly
  obscured to it) and whose passive Perception, 10 + its Perception (5 less when you are only lightly
  obscured to it), your total meets. An enemy you are hidden from can't target you, and your attacks
  on it have advantage. You stay hidden across turns until you attack, harm somebody, force a save or
  cast a spell with a verbal component, and from each enemy once it sees you clearly. Cunning Action
  and Vanish still offer Hide for a bonus action.
- **Search** is a new action: it rolls Wisdom (Perception) and finds every enemy hidden from you whose
  Stealth total it meets.
- **Creatures** hide and look with their printed Stealth and Perception, or their Dexterity and
  Wisdom modifiers.
- **Detect** (1 point), the aboleth's and all twenty adult and ancient dragons' legendary action, is
  a Search between turns.

## Smoke and wind (0.153.0)

Capability API 1.286 lets an area lightly obscure, and lets a wind blow fog away.

- **Cape of the Mountebank:** its Dimension Door leaves a cloud of smoke where its wearer stood and
  where they land, until the end of their next turn. The smoke lightly obscures: it hides nobody.
- **Gust of Wind** "disperses gas or vapor": where its line meets Fog Cloud, Cloudkill, Incendiary
  Cloud or the cape's smoke, they are gone, along with the concentration holding them. Darkness and
  Sleet Storm stay. Stinking Cloud takes a round of wind first (0.156.0).

## Wing Attack (0.152.0)

Capability API 1.285 lets a legendary action move its maker after what it does, on one of its speeds.

- **Wing Attack** (2 points), all twenty adult and ancient dragons: every creature within 10 feet of
  an adult dragon or 15 feet of an ancient one makes the Dexterity save or takes the bludgeoning
  damage and falls prone, and then the dragon may fly up to half its flying speed. Off a board it
  still catches two creatures and stays put.

## Legendary casts (0.151.0)

Capability API 1.284 lets a creature cast between turns with its legendary actions.

- **The lich's Cantrip** (1 point): any of its cantrips (Mage Hand, Prestidigitation, Ray of Frost).
- **The sphinxes' Cast a Spell** (3 points): any of the androsphinx's or gynosphinx's prepared
  spells, using a spell slot as on its own turn.

## Legendary moves (0.150.0)

Capability API 1.283 lets a creature move between turns with its legendary actions, on a board.

- **The tarrasque's Move** (1 point): up to half its speed.
- **The vampire's Move** (1 point): up to its speed, provoking no opportunity attacks.
- **The mummy lord's Whirlwind of Sand** (2 points): up to 60 feet. It lets go of whatever grapples
  or restrains it first, nobody can strike at it on the way, and nothing it crosses harms it.

The dragons' Wing Attack flies after its buffet since 0.152.0.

## Channel Negative Energy and Eyebite (0.149.0)

Capability API 1.282 lets a burst be centred on its user and reach through walls.

- **Channel Negative Energy** (the mummy lord's legendary action, 2 points): every other creature
  within 60 feet, walls or not, can't regain hit points until the end of the mummy lord's next
  turn.
- **Eyebite:** one of three picks on a creature the caster sees within 60 feet, on a failed Wisdom
  save, for the minute: Asleep (as Sleep: damage or a shake wakes it; elves are immune), Panicked
  (frightened of the caster and fleeing, as Fear) or Sickened (disadvantage on attack rolls and
  ability checks, a Wisdom save at the end of each of its turns ends it).

Still text: Eyebite's new target "on each of your turns" (with the concentration repeats, an Engine
ask), and Panicked's end "If the target moves to a place at least 60 feet away from you where it can
no longer see you" (an ending with no save, an Engine ask).

## Drains and the Arcane Sword (0.148.0)

Capability API 1.281 lets a blow heal its maker by the damage it dealt.

- **Vampiric Touch:** on a hit, the caster regains half the necrotic damage dealt (after
  resistances, never past their maximum). The target's maximum is untouched.
- **Psychic Drain** (the aboleth's legendary action, 2 points): one creature the aboleth has
  charmed, at any distance, takes 3d6 psychic and the aboleth regains what it took.
- **Arcane Sword:** the sword appears within 60 feet and strikes (3d10 force, a melee spell
  attack), then for the minute moves 20 feet and strikes again as a bonus action, as Spiritual
  Weapon does. Before, it was one attack and nothing after.

Still text: making the attack again "on each of your turns as an action" while concentrating, for
Vampiric Touch, Call Lightning, Heat Metal and Eyebite (an Engine ask).

## Calm Emotions in full (0.145.0)

Capability API 1.278 finishes Calm Emotions.

- **Allies fail on purpose:** "a creature can choose to fail this saving throw if it wishes". The
  caster's own side fails without rolling, so a frightened ally can be calmed.
- **Indifference:** the creature points nothing at the caster or the caster's side, and it ends when
  the creature is attacked (hit or miss, by anyone), harmed by a spell (its scroll's and a standing
  spell area's too), or sees one of its friends harmed.

## Mindless Rage, fear by real sight and legendary actions (0.144.0)

Capability API 1.277 lets one use put on up to six conditions, and reads "can see" as its holder
really sees.

- **Mindless Rage:** a 6th-level Berserker who rages, or goes into a Frenzy, can't be charmed or
  frightened while raging, and any charm or fright already on them is held off until the rage ends,
  then back if its time is left.
- **Legendary actions:** those that point at an action the creature already has are that action,
  bought with points: the kraken's Fling and Lightning Storm, the lich's Paralyzing Touch, the mummy
  lord's rotting fist or Dreadful Glare, the tarrasque's claw or tail and bite or Swallow, the
  vampire's unarmed strike, and the unicorn's Hooves. The unicorn's Heal Self (2d8 + 2, 3 points)
  and Shimmering Shield (+2 AC to itself or an ally it sees within 60 feet until the end of its next
  turn, 2 points) work too. Detect came in 0.154.0. The sphinxes'
  Cast a Spell and the lich's Cantrip came in 0.151.0. Psychic Drain came in 0.148.0, Channel Negative
  Energy in 0.149.0, and the tarrasque's and vampire's Move and the mummy lord's Whirlwind of Sand in
  0.150.0.
- **Seeing the source:** frightened's disadvantage, and Antipathy's own fright and keeping away, now
  lift when their holder is blinded, in fog or darkness they can't see through, or the source is
  invisible, as well as behind a wall.

## Teleports (0.143.0)

Capability API 1.276 lets a spell, an item or a creature teleport its user on a board: no step, so
nobody gets an opportunity attack.

- **Misty Step:** a bonus action, up to 30 feet to a free space you can see.
- **Dimension Door:** up to 500 feet, anywhere, taking one willing creature of your side no bigger
  than you from within 5 feet; it lands beside you.
- **Scrolls** of both are read with an action, as every scroll is.
- **Cape of the Mountebank:** Dimension Door once until the next dawn (a long rest).
- **Creatures:** the balor, marilith, nalfeshnee and solar teleport 120 feet to a space they can
  see; the sphinxes as a legendary action for 2 points (the solar's costs 1); the blink dog 40 feet;
  the unicorn once a day up to a mile with three willing creatures from within 5 feet, landing on
  the board.
- **Teleport, Word of Recall and Plane Shift (0.191.0):** the caster and willing creatures of their
  side leave the fight together: Teleport with up to eight it can see within 10 feet (or, on a
  board, anywhere on it), Word of Recall with up to five within 5 feet, Plane Shift with up to eight
  within 5 feet. Since 0.302.0 Teleport's caster picks a row of its familiarity table as they cast it,
  and its mishap, similar area and off-target chances are rolled (Capability API 1.670). `Plane Shift (Banish)` is a melee
  spell attack, then a Charisma save, and a creature that fails leaves the fight for good. Word of
  Recall and Plane Shift may also be spent on a 5-foot hop on a board; the Engine has no teleport
  that only leaves yet.
- **Leaving the fight (0.146.0):** the unicorn's mile may instead take it, and the allies it can
  see within 5 feet, out of the fight to a place it knows (Capability API 1.279). It got away, its
  hit points kept; off a board this is the only way it goes. Only allies it can see go along.

- **Bite and blink (0.147.0):** the blink dog's Teleport (Recharge 4-6) bites before or after it
  teleports, all one action (Capability API 1.280).

The Cape's puff of smoke came in 0.153.0, once the Engine had a light one.

## Frights held off and Calm Emotions (0.142.0)

Capability API 1.275 lets a condition be held off, not ended.

- **Antipathy:** its fright pauses while the creature is more than 60 feet from the target and
  can't see it, and comes back when it can see the target again or comes within 60 feet. Its
  disadvantage needs the target in sight; its keeping away holds in sight or within 60 feet. It
  counts as frightened for every immunity, cure and save bonus.
- **Calm Emotions:** two picks. Suppress: humanoids in the 20-foot sphere that fail a Charisma save
  have their charms and frights held off until the spell ends, then back if their time is left.
  Indifference: they point nothing at the caster until harmed.

## Heroism and Antipathy/Sympathy at the caster's numbers (0.141.0)

Capability API 1.274 fixes a condition's numbers off whoever put it on.

- **Heroism:** the caster's spellcasting modifier in temporary hit points at the start of each of the
  target's turns, the rest gone when it ends.
- **Antipathy/Sympathy:** saves at the caster's spell save DC. Sympathy's drawn creatures stay
  within 5 feet once there, and save again when the target harms them. Its scroll names its kind.

## Charges spent on a hit (0.140.0)

Capability API 1.273 lets a weapon's holder spend its charges once a blow with it has hit.

- **Staff of Power, Power Strike:** 1 charge after a melee hit for 1d6 force more.
- **Staff of Striking:** 10 charges, 1d6 + 4 back at dawn. After a melee hit, 1 to 3 charges for 1d6
  force each. On its last charge's 1 it becomes a quarterstaff.
- **Staff of Withering:** 3 charges, 1d3 back at dawn. After a hit, 1 charge for 2d10 necrotic, and
  the target makes a DC 15 Constitution save or has disadvantage on Strength and Constitution checks
  and saves for an hour (Withered).
- The dice double on a critical hit.

## Antipathy and Sympathy (0.137.0)

Capability API 1.270 lets a spell name a kind of creature as it is cast, an aura reach only that kind
or whoever can see its holder, and a save be rolled only far enough away.

- **Antipathy/Sympathy** is two picks, Antipathy and Sympathy, each cast on a creature or object
  within 60 feet. The caster names the kind as they cast: a creature type (dragon, fiend, undead and
  so on), a family (vampire, golem, hag, lycanthrope, naga and the other SRD families), a dragon by
  colour (red dragon, gold dragon and the rest), or a people (goblinoid, orc, kobold, gnoll, drow,
  duergar and more).
- A creature of that kind that comes within 60 feet of the target or can see it saves (Wisdom). On
  a failure, Antipathy frightens it and drives it away; Sympathy draws it toward the target. It
  saves again only at the end of a turn more than 60 feet off and out of sight of the target, and a
  creature that saves, or shakes the effect off, is left alone for the rest of the fight. Out
  there, Antipathy's fright is held off until it can see the target or comes back within 60 feet
  (0.142.0).
- Its save DC is the caster's spell save DC (0.141.0). A creature drawn by Sympathy that reaches
  the target can't walk away from it, and saves again whenever the target harms it. A scroll of it
  names the kind as it is read.

## Staffs and wands that cast (0.136.0)

Capability API 1.269 lets an item cast with its holder's own spell save DC and attack bonus, and
spend more charges for more.

- **Staffs:** each one's fight spells are on its menu for their printed charges, at your spell save
  DC and spell attack bonus. Charming: Charm Person, Command. Fire: Burning Hands, Fireball, Wall of
  Fire. Frost: Fog Cloud, Ice Storm, Wall of Ice, Cone of Cold. Healing: Cure Wounds (a charge a
  level, up to 4th), Lesser Restoration, Mass Cure Wounds. Power: Magic Missile, Ray of
  Enfeeblement, Hold Monster, Cone of Cold, Fireball and Lightning Bolt (5th level), Wall of Force,
  Globe of Invulnerability. Swarming Insects: Insect Plague. The Magi: Flaming Sphere, Invisibility,
  Web, Ice Storm, Wall of Fire, Fireball and Lightning Bolt (7th level). The Woodlands: Animal
  Friendship, Wall of Thorns. Spells a fight can't use (Levitate, Barkskin, Awaken and the like) stay
  in the text.
- **Wand of Binding:** Hold Person for 2 charges and Hold Monster for 5, at DC 17.
- **Wands of Fireballs, Lightning Bolts and Magic Missiles:** a slot level higher for each charge
  more, as far as the wand's charges go. **Ring of the Ram:** 2d10 force more a charge, up to 3.
- **Magic Missile** makes one more dart a slot level above 1st, from a slot as from a wand.

## Gazes and who an aura reaches (0.135.0)

Capability API 1.268 and 1.269 let a gaze be avoided by averting the eyes, a save failed by enough
do more, an aura reach only some creatures and stay off one whose effect has ended, and a ruleset
declare up to 320 conditions.

- **Basilisk and medusa, Petrifying Gaze:** anyone it reaches may avert their eyes on their turn,
  for nothing. Until they look again they skip the save, but they can't see the gazer, so they
  attack it as unseen (with disadvantage). A save against the medusa failed by 5 or more petrifies
  outright.
- **Sea hag, Horrific Appearance:** only a humanoid that starts its turn within 30 feet and can see
  her saves (Wisdom, DC 11) or is frightened for a minute. It saves again at the end of each of its
  turns, with disadvantage while she is in sight. One success, or the fright ending any other way,
  keeps the aura off it for the rest of the fight. It may avert its eyes instead, as from a gaze.
- **Barbed devil, Barbed Hide:** 1d10 piercing, as its turn starts, to each creature grappling it.

## Senses, spreads and more uses (0.134.0)

Capability API 1.267 lets a target qualify by any one sense, keeps picked targets near each other,
grows an area with the slot, gives an item more uses than one, and lets a stat block hold a shield.

- **Turn Undead and Turn the Unholy** reach an undead (or fiend) that can see or hear the user, so a
  blinded zombie that can still hear is turned, and only one both blinded and deafened is not.
- **Command, Charm Person, Hold Person and Hold Monster:** the extra targets of a higher slot must
  stand within 30 feet of each other. **Acid Splash** takes one creature, or two within 5 feet of
  each other.
- **Confusion** grows 5 feet of radius for each slot level above 4th, and **Fog Cloud** 20 feet for
  each above 1st.
- **Wand of Fear:** Command (Flee) and Command (Grovel) for 1 charge (DC 15, not on undead), beside
  the Cone of Fear for 2.
- **Fear and the Cone of Fear:** the fleeing ends with the fright, on the one save.
- **Printed shields:** the azer, bugbear, duergar, gladiator, gnoll, goblin, guard, hobgoblin and
  lizardfolk hold a shield; when Fear or Command's Drop makes them let go, their Armor Class falls by
  2 until they pick it up.

## Dropping and destroying (0.133.0)

Capability API 1.266 lets a condition make its holder drop what they hold, keep them out of a ring
around its source, free a cornered turn, roll its save only out of sight, and destroy by challenge
rating.

- **Fear:** a target that fails drops whatever it holds in its hands (a stat block's weapon attacks
  too), and a dropped shield stops counting. It picks things back up from where they fell. It saves
  again (Wisdom) at the end of a turn it ends out of the caster's line of sight, and acts freely on a
  turn that starts with nowhere to run.
- **Command, Drop:** the target drops what it holds as its next turn starts and does nothing else.
- **Turn Undead, Turn the Unholy and the Wand of Fear's Cone of Fear:** the creature never walks to a
  space within 30 feet of the one who turned it, and stops outside that ring when it can.
- **Destroy Undead** (cleric 5th level): an undead failing Turn Undead's save is destroyed outright at
  CR 1/2 or lower, CR 1 at 8th level, CR 2 at 11th, CR 3 at 14th and CR 4 at 17th.
- Still waiting on the Engine: a stat block's printed shield (its Armor Class does not drop when the
  shield does), and Fear's two parts ending on one save.

## Aura turns (0.132.0)

Capability API 1.265 lets an aura need senses, harm on its holder's turn, and ask a save of whoever
starts a turn in it.

- **Balor, Fire Aura:** 3d6 fire to everyone within 5 feet as the balor's own turn starts.
- **Countercharm** reaches only allies who can hear the bard: not a deafened one, and not across
  Silence.
- **Holy Nimbus:** its advantage is on saves against spells cast by fiends and undead.
- **Pit fiend, Fear Aura:** an enemy starting its turn within 20 feet saves (Wisdom, DC 21) or is
  frightened until the start of its next turn; one success keeps the aura off it for the fight.
- **Gibbering mouther, Gibbering:** anyone starting a turn within 20 feet who can hear it saves
  (Wisdom, DC 10) or, until its next turn starts, takes no reactions and rolls a d8: 1-4 nothing,
  5-6 wanders, 7-8 lashes out at whoever is in reach.
- **Basilisk and medusa, Petrifying Gaze:** an enemy starting its turn within 30 feet that can see it
  and be seen saves (Constitution, DC 12 or 14) or begins turning to stone (restrained); a failed save
  at the end of its next turn petrifies it, a made one ends it.
- **Ghast and hezrou, Stench:** anyone starting a turn within 5 (10) feet saves (Constitution, DC 10
  or 14) or is poisoned until its next turn starts; a success keeps it off for the fight.
- Still waiting on the Engine: averting the eyes from a gaze, the medusa's instant petrification on a
  save failed by 5 or more, the sea hag's Horrific Appearance (humanoids only), and the barbed devil's
  Barbed Hide (whoever is grappling it).

## Forced behavior (0.131.0)

Capability API 1.264 lets a condition decide what its holder does with their turn, and lets a save
be one its holder spends their action on.

- **Turn Undead** (cleric 2nd level) and **Turn the Unholy** (Oath of Devotion 3rd): an action and one
  use of Channel Divinity. Each undead (Turn the Unholy: fiend or undead) within 30 feet makes a Wisdom
  save against the spell save DC or is turned for a minute or until it takes damage: it walks only
  away from the caster, can only Dash or break free, Dodges only when it has nowhere to go, and takes
  no reactions. A Devotion paladin has one Channel Divinity use per short rest.
- **Command:** Approach (walks only toward the caster), Flee (walks or Dashes only away), Grovel (prone,
  then does nothing) and Halt (does nothing), for the target's next turn. One more target for each slot
  level above 1st, and no effect on undead.
- **Confusion** (a 10-foot sphere) and **Mindfire:** a d10 as each turn starts. 1, the creature
  wanders its whole speed a random way; 2-6, it does nothing; 7-8, it can only make a melee attack at a
  random creature in reach, friend or foe, or does nothing with nobody there; 9-10, a normal turn. No
  reactions. Confusion's Wisdom save at each turn's end ends it.
- **Irresistible Dance:** no save to resist (creatures that can't be charmed are immune). The dancer
  can't move, has disadvantage on attacks and Dexterity saves, and is easier to hit; it can spend its
  action on a Wisdom save to stop.
- **Fear:** a frightened creature also has to Dash away from the caster each turn.
- **Wand of Fear, Cone of Fear:** 2 charges, a 60-foot cone, DC 15 Wisdom or frightened and fleeing as a
  turned creature does for a minute, with a save at the end of each turn.
- Still waiting on the Engine: Command's Drop and Fear's dropped item (a held-item drop); Destroy
  Undead's challenge-rating gate; Turn Undead's "can see or hear you"; Confusion's bigger sphere from
  a higher slot; the Wand of Fear's Command (an item-use menu); Antipathy/Sympathy (a chosen creature
  kind and an aura on an object or area); Fear's free turn when there is nowhere to move. The Wand of
  Fear's frightened and fleeing each roll their own save at turn end until a condition can end with
  another.

## Auras (0.130.0)

Capability API 1.263 lets a condition spread others to whoever stands near its holder, and lets a
feature or a stat block keep a condition on for the whole fight.

- **Aura of Protection** (paladin 6th level): the paladin and allies within 10 feet add the paladin's
  Charisma modifier (at least +1, at most +5) to their saves. It follows them as they move, and an
  unconscious or incapacitated paladin grants nothing.
- **Aura of Courage** (10th) and **Aura of Devotion** (Oath of Devotion 7th): the paladin and allies
  within 10 feet can't be frightened, or charmed. All three auras reach 30 feet from 18th level.
- **Holy Nimbus** (Oath of Devotion 20th): an action, once per long rest. For a minute, each enemy that
  starts its turn within 30 feet takes 10 radiant damage, and the paladin has advantage on saves against
  spells cast by fiends and undead.
- **Purity of Spirit** (Oath of Devotion 15th): Protection from Evil and Good is always on.
- **Countercharm** (bard 6th): an action. Until the end of the bard's next turn, the bard and allies
  within 30 feet have advantage on saves against being frightened or charmed.
- **Balor, Fire Aura:** each creature within 5 feet of the balor takes 3d6 fire damage.
- The balor's timing, Countercharm's hearing and the turn-start saves came in 0.132.0.

## Magic monster actions (0.129.0)

Capability API 1.262 lets a stat block's action carry qualities, and gives an item's use in a fight
its item's tags.

- **Magic actions:** 19 monster actions their stat block calls magical are magic in a fight: the
  deva's, planetar's, solar's and unicorn's Healing Touch, the aboleth's Enslave, the cockatrice's
  petrifying Bite, the dryad's Fey Charm, the harpy's Luring Song, the succubus's Charm, the mummy
  lord's Blinding Dust and Blasphemous Word, the nalfeshnee's Horror Nimbus, the solar's Searing
  Burst, the storm giant's Lightning Strike, the kraken's Lightning Storm and others. A Healing Touch
  heals a diseased giant rat's victim, and a gnome saves against these with Gnome Cunning's
  advantage, as against any magic. Their damage is not made magical by this: a cockatrice's beak is
  still a beak against resistance to nonmagical piercing.

## Disease stages (0.128.0)

Capability API 1.261 lets a condition bring on another each time its holder takes damage, run out
into another condition, be cured only by a cure of some level, give back its lasting rest loss when
cured, and keep off all but magical healing. A stat block's action can cure.

- **Slimy Doom:** whenever the creature takes damage, it is stunned until the end of its next turn,
  from Contagion's hit as well as once the disease has set in.
- **Diseased giant rat:** its disease keeps off every heal but a magical one. Healing spells, their
  scrolls and potions still heal; Second Wind, Lay on Hands, Wholeness of Body, hit dice and rests
  don't.
- **Aboleth:** its Tentacle (DC 14 Constitution) gives a disease with no effect for its first minute
  (10 rounds), which any disease cure ends. When that minute runs out, a fight's end included, it
  becomes the later disease: the creature can't regain hit points, and only Heal or another
  disease-curing spell of 6th level or higher ends it (Mass Heal, or a scroll of Heal).
- **Back on a cure:** the death dog's and the otyugh's lowered maximum comes back when the disease is
  cured, by a spell or by the otyugh's own made save, as they print. The giant rat's and Mummy Rot's
  print no such line, so their loss stays until Greater Restoration restores it.
- **Healing Touch:** the deva's, planetar's and solar's frees the target from any curse, disease,
  poison, blindness or deafness, and the unicorn's removes all diseases and poisons, before it heals.
- **Greater Restoration** lets the caster pick which one effect it ends (one charm, the petrification,
  one curse, a level of exhaustion or the lowered maximum), as before.
- The aboleth's "unless it is underwater" holds its curse off on water since 0.245.0
  (`whileOffTerrain`). Still waiting on the Engine: the acid it deals outside water every 10 minutes
  (with movement and environment). A stat block's heal counting as magical came
  in 0.129.0.

## Diseases between fights (0.127.0)

Capability API 1.260 lets a condition lower the hit point maximum at each rest it names, after a save
if it has one, and rolls out counted saves as a fight ends.

- **Daily loss:** each long rest stands for "every 24 hours". The diseased giant rat's disease takes
  1d6 off the hit point maximum at each long rest. The death dog's and the otyugh's take 1d10 on a
  failed Constitution save (DC 12 and DC 15); a made save spares that day, and cures the otyugh's.
  What they take adds up, and no rest gives it back (a cure does for the death dog's and the
  otyugh's since 0.128.0).
- **Mummy Rot:** the mummy's (DC 12) and the mummy lord's (DC 16) Rotting Fist curse a creature on a
  failed Constitution save. It can't regain hit points, and each long rest takes 3d6 off its maximum.
  Remove Curse ends it, and so does Greater Restoration (one curse). It is a curse, not a disease, so
  Lesser Restoration, Heal and disease immunity don't touch it.
- **Contagion:** when a fight ends, won or fled, the remaining saves are rolled, so the disease is
  either shaken off or set in.
- A cure giving back what the disease took, and the giant rat's "except by magical means", came in
  0.128.0.

## Ring of evasion (0.126.0)

Capability API 1.259 lets a worn item's use carry a rescue paid with the item's own charges.

- **Ring of evasion:** while it is worn, a failed Dexterity save becomes a success for the wearer's
  reaction and one of the ring's 3 charges, which regain 1d3 at dawn. It does nothing with no charge
  left, no reaction left, on another kind of save, or carried rather than worn.

## Diseases (0.125.0)

Capability API 1.258 gives conditions a kind ("disease") that a cure or an immunity can name, and
counts the saves that end a condition or worsen it into another.

- **Contagion:** the caster picks one of the six diseases (Blinding Sickness, Filth Fever, Flesh Rot,
  Mindfire, Seizure, Slimy Doom), each its own entry, and touches with a melee spell attack. On a hit
  the disease's effects hold at once. At the end of each of the target's turns it makes a
  Constitution save against the caster's DC: three successes end it, and three failures set it in for
  the spell's seven days, so it outlasts the fight and no more saves are made. Blinding Sickness
  blinds; Filth Fever and Seizure give disadvantage on Strength or Dexterity checks, saves and attacks;
  Flesh Rot makes the creature vulnerable to all damage; each gives its printed disadvantages.
- **Bites:** the diseased giant rat (DC 10), the death dog (DC 12) and the otyugh (DC 15) give a
  disease on a failed Constitution save that lasts until cured. The death dog's and the otyugh's leave
  the target poisoned (disadvantage on attacks and checks) while it lasts.
- **Cures:** Lesser Restoration ends one disease or one of its four conditions, Lay on Hands ends one
  disease or poison for 5 points, and Heal and Mass Heal end every disease.
- **Immunity:** Divine Health (paladin 3rd level), Purity of Body (monk 10th level), Nature's Ward
  (Circle of the Land 10th level) and a worn periapt of health keep any disease off.
- A worn periapt holds off a disease already caught since 0.245.0 (`suppresses`), and every disease,
  Contagion's first days included, since 0.247.0 (`"suppresses": ["disease"]`). Mindfire's confusion came in 0.131.0. The hit point maximum the bites take every 24 hours came in 0.127.0; Slimy Doom's
  stun, the giant rat's "except by magical means", the aboleth's disease and Healing Touch's cures
  came in 0.128.0.

## Cutting Words on checks and damage (0.124.0)

Capability API 1.257 takes an answer's dice off somebody else's ability check or damage roll as it
is made, and lets an item's use deal half on a miss.

- **Cutting Words:** besides an attack that hits, the bard's die also comes off an enemy's ability
  check (a grapple, say) or damage roll within 60 feet, where it could turn the result: a check that
  would win and could then lose, or damage that would drop the bard or an ally and could then leave
  them standing. A creature that can't hear (deafened) or is immune to being charmed is immune to it.
- **Scroll of Acid Arrow:** a miss now splashes for half, as the spell does.
- The ring of evasion waited on the Engine for an item's rescue paid with its charges; it came in
  0.126.0.

## A rescue die of one's own (0.123.0)

Capability API 1.256 lets a feature add its holder's own die to a failed roll, count a check's d20 as a
20, keep an entry off its own user, and keep a creature to one die of a kind at a time.

- **Bardic Inspiration:** the bard can't inspire themselves, and a creature holds only one Bardic
  Inspiration die at a time, of any size.
- **Stroke of Luck: Ability Check:** a failed ability check's d20 counts as a 20, so a check that a
  20 still loses stays failed and the use is kept.
- **Peerless Skill (Lore bard 14th level):** one Bardic Inspiration use adds the bard's own die to a
  failed ability check it can turn, after any die somebody else gave them.
- **Dark One's Own Luck (Fiend warlock 6th level):** once per short or long rest, a d10 is added to a
  failed save, or to a failed ability check with its **Ability Check** pick, when it can turn it.

## Heightened picks and Acid Arrow's miss (0.122.0)

Capability API 1.255 lets the sorcerer pick who Heightened Spell falls on, lets a miss deal half,
and lets a condition's damage grow with a higher slot.

- **Heightened Spell:** the sorcerer picks which creature the spell catches has disadvantage on its
  first save, rather than the first one caught.
- **Acid Arrow:** a miss splashes the target for half the hit's damage and leaves no later damage;
  cast with a higher slot, the later damage grows by 1d4 a level too (3d4 from a 3rd-level slot).
  A scroll of Acid Arrow still deals nothing on a miss: an item's use has no `halfOnMiss` yet.

## Careful picks, Empowered, Acid Arrow and two-type spells (0.121.0)

Capability API 1.254 lets the sorcerer pick who Careful Spell spares and has Empowered Spell reach
all of a spell's damage dice.

- **Careful Spell:** when the spell catches more of the sorcerer's side than Careful spares, the
  sorcerer picks which of them make the save outright.
- **Empowered Spell:** the low dice thrown again are picked from all of the spell's damage dice,
  extra damage included, and a critical's extra dice can be thrown again too.
- **Font of Magic with pact slots:** a sorcerer-warlock can turn a Pact Magic slot into sorcery
  points equal to the slot's level.
- **Acid Arrow:** a hit deals 4d4 acid and 2d4 more as the target's next turn ends; a higher slot
  adds 1d4 to the hit. Half damage on a miss and the later damage growing with the slot came in
  0.122.0.
- **Flame Strike, Ice Storm and Meteor Swarm:** both of their damage types now land (4d6 fire and
  4d6 radiant; 2d8 bludgeoning and 4d6 cold; 20d6 fire and 20d6 bludgeoning), halved together by
  the save, from a scroll too. Before, only the first type was dealt.

## Metamagic (0.120.0)

Capability API 1.253 lets a feature be chosen with a spell as it is cast and change how it works.

- **Metamagic (sorcerer 3rd level):** the guided builder's new Metamagic step picks two options at 3rd
  level and one more at 10th and at 17th. In a fight each option is offered with every spell it can
  change, paid in sorcery points. Only one per spell, except Empowered Spell, which goes with one other.
  - **Careful Spell (1 point):** up to the sorcerer's Charisma modifier (at least one) of the sorcerer
    and their allies caught by the spell make its save outright.
  - **Distant Spell (1 point):** double range, and touch becomes 30 feet.
  - **Empowered Spell (1 point):** up to the Charisma modifier (at least one) of the damage dice that
    rolled low are thrown again.
  - **Extended Spell (1 point):** a spell lasting 1 minute or longer lasts twice as long, at most a day.
  - **Heightened Spell (3 points):** its first target has disadvantage on its first save against it.
  - **Quickened Spell (2 points):** a spell cast with an action is cast with the bonus action instead.
  - **Subtle Spell (1 point):** no verbal or somatic components, so it works in Silence and can't be
    countered.
  - **Twinned Spell (points equal to the spell's level, 1 for a cantrip):** a single-target spell that
    doesn't target only the caster takes a second target.

## Font of Magic (0.119.0)

Capability API 1.252 lets a feature give back a pool, past its maximum if the rules say so.

- **Font of Magic: Convert a Slot (sorcerer 2nd level):** as a bonus action, the sorcerer spends a spell
  slot of the level they pick and gains that many sorcery points, never past their maximum.
- **Font of Magic: Create a 1st- to 5th-Level Slot:** as a bonus action, the sorcerer spends 2, 3, 5, 6
  or 7 sorcery points for one spell slot of that level, even past the slots' maximum. Slots made past
  the maximum vanish at the next long rest. A slot level the sorcerer has no slots of isn't offered.
- A warlock's pact slots can't be turned into sorcery points yet.

## Lay on Hands (0.118.0)

Capability API 1.251 lets a heal's user pick how many uses one use spends.

- **Lay on Hands (paladin 1st level):** as an action, the paladin touches a creature and picks how many
  points of the pool (5 per paladin level, back on a long rest) to spend, from 1 up to what is left,
  and heals that many hit points. "Just enough" spends what heals the creature fully, capped at what is
  left. Undead and constructs can't be healed by it.
- **Lay on Hands: Neutralize Poison:** spends 5 points of the same pool to end the poisoned condition
  on the creature touched. It cures one disease too since 0.125.0.

## Cutting Words and Evasion (0.117.0)

Capability API 1.250 takes dice off an attack roll that hit, and lets a save evade half damage.

- **Cutting Words (College of Lore, 3rd level):** when a creature the bard can see hits the bard or an
  ally within 60 feet, the bard can use their reaction and one Bardic Inspiration use to roll their
  Bardic Inspiration die (d6, d8 at 5th level, d10 at 10th, d12 at 15th) and take it off the attack
  roll. The attack is checked again and misses if it now falls short; a natural 20 still hits.
  Ability checks and damage rolls, and creatures immune because they can't hear or can't be charmed,
  came in 0.124.0.
- **Evasion (rogue and monk 7th level, and the Hunter's Superior Hunter's Defense pick):** against an
  effect that lets a Dexterity save halve its damage, a made save takes no damage and a failed one
  takes half. Pick the feature again to get its new column.

## Dice after the roll and rerolls (0.116.0)

Capability API 1.249 holds a die back until its holder's own roll falls short, and spends a feature by
itself when its holder's roll fails.

- **Bardic Inspiration:** a bonus action gives a creature within 60 feet a Bardic Inspiration die (d6,
  d8 at 5th level, d10 at 10th, d12 at 15th) for 10 minutes. It is rolled and added to the first attack
  roll, save or ability check that falls short and that the die could still turn, and is then gone.
- **Guidance** (a d4 on an ability check) and **Resistance** (a d4 on a save) work the same way, while
  the caster concentrates, up to 1 minute.
- **Indomitable (fighter 9th level):** a failed save is rolled again once and the new roll stands, using
  one of its uses (1, 2 at 13th, 3 at 17th, per long rest).
- **Diamond Soul (monk 14th level):** the same, for 1 ki point.
- **Stroke of Luck (rogue 20th level):** once per short or long rest, a missed attack hits. Its
  **Stroke of Luck: Ability Check** pick, sharing that use, makes a failed ability check succeed
  (since 0.123.0, by counting its d20 as a 20).
- These are used as soon as they can help, without asking: a held die is never wasted on a roll it
  can't turn, and Indomitable is spent on the first failed save.

## Open Hand Technique (0.115.0)

Capability API 1.248 lets a hit reaction wait for strikes paid from one budget, and lets several
answers share a hit so only one of them is taken.

- **Open Hand Technique (Way of the Open Hand, monk 3rd level):** when one of the two Flurry of Blows
  strikes hits, the monk can impose one of three effects, against the Ki save DC:
  - the entry itself: a Dexterity save or be knocked prone;
  - **Open Hand Technique: Push:** a Strength save or be pushed 15 feet away;
  - **Open Hand Technique: No Reactions:** no reactions until the end of the monk's next turn.
- Only one of them per hit, and each Flurry hit is asked again. Martial Arts' bonus strike and the
  Attack action's own strikes don't offer them.

## Reckless Attack and Brutal Critical (0.114.0)

Capability API 1.247 lets a feature wait for its holder's first attack of a turn, narrows attack
changes to weapon or spell attacks and to melee or ranged blows, and adds dice only on a critical.

- **Reckless Attack (barbarian 2nd level):** offered on the barbarian's turn until they have attacked.
  For the rest of that turn their melee weapon attacks with Strength have advantage (a finesse weapon
  swung with Dexterity, a thrown or ranged attack and a spell attack do not), and attacks against them
  have advantage until their next turn starts.
- **Brutal Critical (barbarian 9th level):** a critical hit with a melee weapon rolls one more of the
  weapon's damage dice, two at 13th level and three at 17th. The extra dice are not doubled.

## The bonus strike after a magic monk weapon (0.113.0)

Capability API 1.246 lets what follows the Attack action match held weapons by their tags.

- **Martial Arts' bonus unarmed strike** now follows an attack with any held monk weapon, magic ones
  included: a Dagger (+1) or a dagger of venom counts as a dagger. Before, only a weapon whose name
  was on the monk weapon list did.

## Quivering Palm and Hurl Through Hell (0.112.0)

Capability API 1.245 lets one use spend several uses, a failed save drop a target to 0, a hit reaction
wait for named attacks, and a condition deal damage as it ends.

- **Quivering Palm (Way of the Open Hand, monk 17th level):** when an unarmed strike hits, the monk can
  spend 3 ki points (offered only while 3 are left) to start the vibrations. Only one creature quivers
  at a time: starting them in another ends them in the first.
- **Quivering Palm: End the Vibrations** is its own pick: as an action against the creature the monk's
  vibrations are in, a Constitution save against the Ki save DC. On a failure it drops to 0 hit points
  (a monster is out, a character is dying); on a success it takes 10d10 necrotic.
- **Quivering Palm: End Harmlessly** ends them without an action and without harm.
- **Hurl Through Hell (The Fiend, warlock 14th level):** once per long rest, when any attack of the
  warlock's hits, the target vanishes from the fight until the end of the warlock's next turn. It then
  comes back and takes 10d10 psychic damage from the warlock, unless it is a fiend.
- The vibrations last up to 14,400 rounds (a day) since 0.245.0; the SRD's longer days are outside
  combat and stay with the Game Master.

## Unarmed strikes and held monk weapons (0.111.0)

Capability API 1.244 gives every sheet's attack list rows of its own and lets attack rules reach held
weapons.

- **Every character has an Unarmed Strike:** 1 + Strength bludgeoning, proficient, 5-foot reach, as the
  SRD's Melee Attacks section says. A sheet row of the same name takes its place.
- **Martial Arts reaches held monk weapons:** a shortsword, or any simple melee weapon without the
  two-handed or heavy property (magic ones too, such as a +1 dagger), uses Dexterity when higher and
  the martial arts die when it beats the weapon's own.
- Martial Arts and its bonus strike hold only while the monk wears no armor and no shield and holds
  nothing but monk weapons (or nothing).

## Smites on opportunity attacks (0.110.0)

Capability API 1.243 holds an opportunity attack's hit the way it holds a turn's attack.

- **Divine Smite** and **Stunning Strike** can be added to an opportunity attack, and Shield and the
  other answers to a hit are asked about it too.
- A creature stunned (or otherwise stopped) by it mid-walk stays in the square where it was struck.

## Martial Arts and Flurry of Blows (0.109.0)

Capability API 1.242 lets a feature change named attacks, grant a strike after the Attack action, and
wait for that action.

- **Martial Arts (monk 1st level):** while
  the monk wears no armor and no shield, unarmed strikes use Dexterity instead of Strength when that is
  higher, and roll the martial arts die (d4, d6 at 5th, d8 at 11th, d10 at 17th) when it beats their
  own damage. After the Attack action with an unarmed strike or a monk weapon, the monk can make one
  unarmed strike as a bonus action.
- **Flurry of Blows** is its own pick beside Ki: right after the Attack action, 1 ki point and the
  bonus action for two unarmed strikes.
- **Ki-Empowered Strikes (monk 6th level):** unarmed strikes count as magical against resistance.
- Since 0.111.0 (Capability API 1.244) every character has the Unarmed Strike, and held monk weapons
  get Martial Arts too (see below).

## Divine Smite and Stunning Strike (0.108.0)

Capability API 1.241 asks an attacker, once their own weapon has hit, whether to add something to that
blow.

- **Divine Smite (paladin 2nd level):** after a melee weapon hit, spend a spell slot for 2d8 radiant,
  1d8 more for each slot level above 1st, to 5d8 at most (a 5th-level slot or higher). An undead or a
  fiend takes 1d8 more. The dice join the weapon's, so a critical hit doubles them.
- **Improved Divine Smite (paladin 11th level):** every melee weapon hit deals 1d8 more radiant.
- **Stunning Strike (monk 5th level):** after a melee weapon hit, spend 1 ki point; the target makes a
  Constitution save against the monk's Ki save DC or is stunned until the end of the monk's next turn.
- Both can be used on the same hit, and neither costs a reaction. Since 0.110.0 (Capability API 1.243)
  they work on opportunity attacks too, and a walker stunned that way stops where it was struck.

## Advantage on initiative (0.107.0)

Capability API 1.240 reads initiative as the Dexterity check it is in 5e, and lets a feature roll it
twice.

- Anything that gives advantage (or disadvantage) on Dexterity checks gives it on initiative too:
  **Foresight**, and Enhance Ability's **Cat's Grace**. One that only covers Strength checks, like
  Rage, does not.
- **Feral Instinct (barbarian 7th level):** advantage on initiative rolls.
- Advantage and disadvantage cancel, and a fight that rolls initiative each round rolls it the same way.

## Berserker Frenzy (0.106.0)

Capability API 1.239 lets a use spend another feature's uses, a granted strike be melee only, and a
condition move a track as it ends.

- **Frenzy (Path of the Berserker, 3rd level):** a Frenzied Rage is a second way to rage, spending
  one of Rage's uses and giving all of Rage's benefits. While it lasts the barbarian can make one
  melee weapon attack as a bonus action each turn (a thrown weapon at its reach only, no bows), and
  when the rage ends, however it ends, they gain a level of exhaustion.

## Thief's Reflexes (0.105.0)

Capability API 1.238 gives a combatant a second turn in the first round.

- **Thief's Reflexes (thief 17th level):** the rogue takes two turns in the first round of a fight,
  the second at their initiative minus 10, each a whole turn with its own reaction. Not when
  surprised. From the second round on, one turn a round.

## Surprise, Foresight and Feral Instinct (0.104.0)

Capability API 1.237 lets a fight begin with some combatants surprised: the GM says who is caught
unaware, and on their first turn they can't move or act, and they take no reaction until that turn
ends.

- **Foresight:** its target can't be surprised.
- **Feral Instinct (barbarian 7th level):** a surprised barbarian may still enter a rage on that first
  turn, and once raging acts normally for the rest of it. Being incapacitated still stops it.
- Initiative rolled with advantage for Feral Instinct, Foresight and Cat's Grace came in 0.107.0.

## Dispel Evil and Good and Banishment (0.103.0)

Capability API 1.236 lets a condition give its holder actions, lets a use end the condition it came
from, lets a cure end only what some kinds of creature put on, and sends somebody out of the fight.

- **Dispel Evil and Good:** while it lasts its caster has two more actions, with their own spell
  attack and save DC and no slot: **Break Enchantment** touches a creature and ends every charm,
  domination or fright a celestial, elemental, fey, fiend or undead put on it (one put on by
  anybody else stays), and **Dismissal** is a melee spell attack against a celestial, elemental,
  fey, fiend or undead; on a hit it makes a Charisma save or leaves the fight for good. Using
  either ends the spell, hit or miss. They sit in the Spells catalog as "special function" entries
  with no class, so the builder never offers them and no scroll carries them.
- **Banishment:** on a failed Charisma save the target is banished (it can't act or react) and
  leaves the board. When the spell ends early (its caster's concentration breaks) it comes back
  where it was, or the nearest free space. If it runs the whole minute, a celestial, elemental,
  fey or fiend stays gone; anything else comes back. A slot above 4th adds a target per level. A
  scroll of Banishment banishes the same way.
- Possession is not a condition this ruleset keeps, so Break Enchantment's "possessed" is the GM's.

## Vampire Bite, Draining Kiss and Harm (0.102.0)

Capability API 1.235 lets a blow lower a hit point maximum without a save of its own, by one damage
type, healing its maker, and lets an attack be aimed only at targets holding some condition.

- **Vampire and vampire spawn Bite:** the target's hit point maximum drops by the necrotic damage
  until it rests, and the vampire regains as many hit points. A maximum brought to 0 kills. The
  bite can be aimed only at a creature the vampire is grappling, or one that is incapacitated or
  restrained.
- **Succubus/incubus Draining Kiss:** the maximum drops by all the psychic damage, half on a made
  save, until a rest. The kiss can be aimed only at a creature the fiend has charmed.
- **Harm:** its damage can't bring the target below 1 hit point, and on a failed save the
  target's maximum drops by the necrotic damage until it rests (an hour outlasts any fight).
- A willing target is the GM's: a fight keeps no "willing" state.

## Greater Restoration picks one (0.101.0)

Capability API 1.204 lets a cure do just one of its cures.

- **Greater Restoration** (and its scroll) does one thing, as the SRD says: end one charm or
  petrification, take one level of exhaustion off, or give back a lowered hit point maximum. The
  caster picks which; left unpicked, it ends a charm or petrification first, then exhaustion, then
  the lowered maximum, whichever the target has.

## Life Drain (0.100.0)

Capability API 1.203 lets a monster's blow lower its target's hit point maximum.

- **Specter, wight and wraith:** a creature hit by Life Drain makes a Constitution save (DC 10,
  13 and 14). On a failure its hit point maximum drops by the damage it took until it finishes a
  rest, and healing can't go past the lowered maximum. Brought to a maximum of 0, it dies.
- **Clay golem:** its Slam does the same against DC 15, but no rest gives the hit points back;
  Greater Restoration does.
- The vampire's Bite, the succubus's Draining Kiss and Harm are done in 0.102.0.

## Conditions that end together (0.99.0)

Capability API 1.202 lets a condition end when another one put on with it ends, however that one
ends.

- **Hypnotic Pattern:** the incapacitated condition ends with the charm, so damage, an ally
  shaking the creature awake, a cure or the end of concentration frees it fully. Before, the
  incapacitated stayed for the full minute. Greater Restoration can now end the charm too.
- **Grapples that restrain:** sixteen monsters whose grapple says "Until this grapple ends, the
  target is restrained" now restrain as they grab, and the restraint ends when the grapple does:
  the behir, chain devil, constrictor and giant constrictor snakes, couatl, crocodile and giant
  crocodile, giant frog, giant octopus, giant toad, kraken, remorhaz, roc, roper, salamander and
  tarrasque. Before, only the roper restrained, and its restraint stayed after an escape.
- **Rage:** its damage bonus ends with the rage.

## Greater Restoration and the frigid air (0.98.0)

Capability API 1.201 lets a cure move a live track by levels and give back hit points only a rest
would.

- **Greater Restoration** (and its scroll) also takes one level of exhaustion off its target and
  gives back the hit points a sealing blow took off their maximum, such as a sword of wounding's.
  It is offered only on a creature with something to cure. Since 0.101.0 it does one of these, the
  caster's pick, as the SRD says.
- **Wall of Ice:** the frigid air left by a broken section deals 1d6 more cold for each slot above
  6th.
- The Berserker's exhaustion when Frenzy's rage ends works since 0.106.0, Life Drain since 0.100.0
  and Greater Restoration's choice of one effect since 0.101.0.

## Wall of Ice breaks (0.97.0)

Capability API 1.200 lets a wall stand in sections that are attacked and broken one by one.

- **Wall of Ice:** each 10-foot section has AC 12 and 30 hit points and takes double damage from
  fire. Any attack aimed at one creature can be aimed at a section instead. A section brought to 0
  stops blocking and leaves a sheet of frigid air: a creature that moves into it, the first time on
  a turn, saves on Constitution against 5d6 cold, half on a success. The wall can also be raised as
  a dome 10 feet in radius, and the damage as it appears rises by 2d6 for each slot above 6th.
- The frigid air's 1d6 more for each slot above 6th is done in 0.98.0.

## Sleep and Color Spray pass over who they can't affect (0.96.0)

Capability API 1.199 lets a hit point pool pass over some of the creatures in its area.

- **Sleep** ignores creatures already unconscious or asleep: they use none of its pool.
- **Color Spray** ignores those and also creatures that can't see the caster (blinded, invisible
  to them, or out of sight).

## Wall of Thorns cuts (0.95.0)

Capability API 1.198 lets a lasting area deal a damage type of its own at its triggers.

- **Wall of Thorns:** creatures in its area as it appears save against 7d8 piercing; a creature
  that enters the wall on a turn or ends its turn there saves against 7d8 slashing, as the SRD
  says. Both rise by 1d8 for each slot above 6th.

## Sleep, Color Spray, the Power Words and the duergar's Enlarge (0.94.0)

Capability API 1.196 lets a spell pick its targets by the hit points they have left, and 1.197 lets a
monster's action land on itself on its turn and a weapon throw its dice twice.

- **Sleep:** rolls 5d8 (2d8 more for each slot above 1st) and puts creatures within 20 feet of the
  point to sleep from the lowest current hit points up, each only while the roll still covers all
  of its hit points, which it then uses up. A sleeper wakes when it takes damage or someone uses an
  action to shake it, or after a minute. Undead, creatures immune to being charmed and elves and
  half-elves (Fey Ancestry: "magic can't put you to sleep") are not affected.
- **Color Spray:** 6d10 (2d10 more a slot) the same way across its 15-foot cone, blinding until the
  end of the caster's next turn.
- **Power Word Stun:** stuns a creature with 150 hit points or fewer, which saves on Constitution at
  the end of each of its turns to end it. **Power Word Kill** kills a creature with 100 or fewer.
  Neither does anything to one with more.
- **Duergar, Enlarge:** an action, once a fight (it recharges after a short or long rest). For a
  minute the duergar is Large, throws its War Pick's and Javelin's damage dice twice (2d8 + 2 and
  2d6 + 2), and has advantage on Strength checks and Strength saving throws.
- Sleep and Color Spray passing over creatures already unconscious, and Color Spray over
  creatures that can't see, came in 0.96.0.

## Enlarge and Reduce change size (0.93.0)

Capability API 1.195 lets a condition make its holder bigger or smaller while it holds.

- **Enlarge/Reduce:** an enlarged creature is one size bigger and a reduced one a size smaller,
  never past Tiny or Gargantuan, until the spell ends. A Medium fighter enlarged fills 2 by 2 cells
  and reaches from all of them. If there is no room to grow, it grows as big as the room allows, as
  the spell says; a shrinking creature keeps its top-left cell. Enlarge and Reduce on the
  same creature cancel out.
- The duergar's own Enlarge came in 0.94.0.

## Big creatures fill their space (0.92.0)

Capability API 1.194 lets a creature fill more than one cell of the board.

- **Size on the board:** as SRD 5.1's Size Categories say, a Large creature fills 2 by 2 cells
  (10 by 10 feet), a Huge one 3 by 3 and a Gargantuan one 4 by 4; Tiny, Small and Medium fill one.
- Reach and range count to its nearest cell, it walks only where all of it fits and nobody walks
  through it, an area catches it if any of its cells are inside, and it sees or is seen along any
  clear line from any of its cells. An ogre's greatclub reaches from the side of its whole body, and a
  dragon's breath starts from its edge.

## First aid and treating wounds (0.91.0)

Capability API 1.193 lets a contest roll against a fixed number, aim at anybody holding a condition
or dying, and stabilize; and lets a weapon's damage come back only with a rest.

- **Stabilize (first aid):** an action, a DC 10 Wisdom (Medicine) check on a dying creature; on a
  success it is stable. No healer's kit needed (the kit still stabilizes without a check).
- **Treat wounds:** an action by the wounded creature or anybody beside it, a DC 15 Wisdom (Medicine)
  check that ends all of a sword of wounding's wounds.
- **Sword of wounding:** hit points lost to it, its wounds' necrotic included, come back only with a
  short or long rest; no spell, potion or other healing lifts them.

## Vorpal, disruption and oathbow riders (0.90.0)

Capability API 1.192 lets a weapon ignore resistance to its own damage, a slay put conditions on a
creature that makes its save, and a mark make every other weapon roll worse.

- **Vorpal sword:** its slashing damage ignores resistance (immunity still holds).
- **Mace of disruption:** a fiend or undead at 25 hit points or fewer that makes its DC 15 Wisdom
  save is frightened of the wielder until the end of the wielder's next turn.
- **Oathbow:** while its sworn enemy stands, the wielder attacks with disadvantage with every other
  weapon (spells are not weapons).
- Without a board, a creature's or a spell's area can now catch its maker's allies too, as the SRD's
  "each creature" says.

## Heals that fail, wards by kind, and dragon scale mail (0.89.0)

Capability API 1.191 lets a condition stop healing, keep conditions off when a kind of creature
applies them, a spell need a least ability score, and a save count against named actions.

- **Chill Touch:** whatever it hits can't regain hit points until the caster's next turn: spells,
  potions and death-save revives still roll and restore nothing.
- **Protection from Evil and Good:** aberrations, celestials, elementals, fey, fiends and undead
  can't charm, dominate or frighten the target; one already charmed or frightened by such a creature
  saves against it with advantage.
- **Tasha's Hideous Laughter:** a creature with Intelligence 4 or less can't be chosen.
- **Dragon scale mail:** advantage only on saves against a dragon's Frightful Presence and breath
  weapons (every breath, the metallic dragons' second ones too), no longer its Wing Attack.
- Dispel Evil and Good's Break Enchantment and Dismissal work since 0.103.0, Foresight's "can't be
  surprised" since 0.104.0 and Sleep's hit point pool since 0.94.0.

## The javelin of lightning (0.88.0)

Capability API 1.190 lets a weapon's mode have its own range, its own extra on a hit, a line that
everybody on the way saves against, and the item's charges it spends.

- **Javelin of lightning:** besides its plain throw (30/120 feet), **Lightning bolt** hurls it as a
  5-foot-wide line to a target within 120 feet. Every creature on the way, allies too but not the
  thrower or the target, makes a DC 13 Dexterity save against 4d6 lightning, half on a success;
  then the javelin's ranged attack deals its own damage plus 4d6 lightning on a hit. Once a dawn
  (a charge); meanwhile it is still a magic javelin.

## Wounds, sworn enemies and monster attacks by ability (0.87.0)

Capability API 1.189 lets a condition harm its holder each turn and stack, keep to one holder per
source, a weapon read a mark its wielder put on, and a monster's attack name its ability.

- **Monster weapon attacks** name Strength or Dexterity, read off the printed bonus (proficiency by
  challenge rating plus the modifier; the nearer one, and on a tie Strength in reach and Dexterity at
  range). So Weakening Breath gives a weakened ogre disadvantage on its greatclub, and Ray of
  Enfeeblement halves a monster's Strength weapon damage. Spell attacks name none.
- **Sword of wounding:** once a turn a hit wounds; at the start of each of its turns the target
  takes 1d4 necrotic per wound (up to 20), then a DC 15 Constitution save ends them all.
- **Oathbow:** "Swift death to you who have wronged me" is free with an attack, once a dawn (a
  charge): the target becomes the bow's sworn enemy for 24 hours (14,400 rounds since 0.245.0), and the bow attacks it with
  advantage, ignoring cover short of total and long range, for 3d6 more piercing.
- The sword of wounding's DC 15 Medicine action and hit points coming back only with a rest came in
  0.91.0, the oathbow's disadvantage with other weapons in 0.90.0.

Available to Engine `staging` users only. The package is listed in `STAGING_ONLY_PACKAGE_IDS`, so
it is published to the preview overlay under `catalog/preview/` that staging Engines read, and is
hidden from stable `main` users. It stays there until the Capability API 1.165 ruleset, catalog,
battle, scaled-column, combat, bestiary, positions, turn-economy, strike-cap, reaction-moment,
creature-sheet, contest, used-moment, condition-number, hit-moment, items and sheet-hook seam reaches a stable
Engine release.

## Installing

Install it from **Agents** and **Download Agents** in a Marinara Engine build that supports
Capability API 1.165. After installing, choose it under Rules in the Game Mode setup wizard when you
create a new game. Choose the **Tactical** combat style in the same wizard if you want the fight
played on a board; **Classic** plays the same fight without positions.

## License

`ruleset.json` and the catalog files include material from the System Reference Document 5.1. See
[LICENSE-SRD.md](LICENSE-SRD.md) for the required attribution and for where the machine-readable
form of the catalog entries came from.

## Overchannel and Supreme Healing (0.207.0)

Capability API 1.415.

- **Overchannel**: "When you cast a wizard spell of 1st through 5th level that deals damage, you can
  deal maximum damage with that spell. The first time you do so, you suffer no adverse effect. If you
  use this feature again before you finish a long rest, you take 2d12 necrotic damage for each level of
  the spell, immediately after you cast it. Each time you use this feature again before finishing a long
  rest, the necrotic damage per spell level increases by 1d12. This damage ignores resistance and
  immunity." Chosen as the spell is cast. The "Overchannel uses" counter counts the uses since a long
  rest; its 20 is never reached, since the necrotic damage passes any wizard's hit points long before.
- **Supreme Healing**: "when you would normally roll one or more dice to restore hit points with a
  spell, you instead use the highest number possible for each die."

## Deflect Missiles: catching and throwing back (0.208.0)

Capability API 1.416.

- **Deflect Missiles**: "If you reduce the damage to 0, you can catch the missile if it is small enough
  for you to hold in one hand and you have at least one hand free. If you catch a missile in this way,
  you can spend 1 ki point to make a ranged attack with the weapon or piece of ammunition you just
  caught, as part of the same reaction. You make this attack with proficiency, regardless of your
  weapon proficiencies, and the missile counts as a monk weapon for the attack." A new pick,
  "Deflect Missiles: Throw It Back", is offered once a ranged blow is lessened to 0 and the monk has a
  hand free: it rolls with proficiency and the higher of Strength or Dexterity, and deals the
  missile's own damage type plus that modifier, for 1 ki and no further reaction. Since 0.211.0
  (Capability API 1.420) it has the dart's range of 20/60 feet, with disadvantage beyond 20, and rolls
  the Martial Arts die (d4 to d10 by monk level).

## Elusive, Danger Sense and Primal Champion (0.209.0)

Capability API 1.417.

- **Elusive** (rogue 18th level): "No attack roll has advantage against you while you aren't
  incapacitated." Disadvantage still counts, and the rule is off while the rogue can't act.
- **Danger Sense** (barbarian 2nd level): "You have advantage on Dexterity saving throws against
  effects that you can see, such as traps and spells. To gain this benefit, you can't be blinded,
  deafened, or incapacitated." Counted only against a save whose source the barbarian can see (a save
  with no source counts as seen), and held off while blinded, deafened or unable to act.
- **Primal Champion** (barbarian 20th level): "your Strength and Constitution scores increase by 4.
  Your maximum for those scores is now 24." Picking it in the builder adds the 4s; scores already go to
  30 here and Ability Score Improvements still stop at 20, so the 24 needs nothing more.

## Reliable Talent, Indomitable Might, Jack of All Trades and Remarkable Athlete (0.210.0)

Capability API 1.419 (check floors are 1.418; more than 20 combat levels and untrained adds are 1.419).

- **Reliable Talent** (rogue 11th level): "Whenever you make an ability check that lets you add your
  proficiency bonus, you can treat a d20 roll of 9 or lower as a 10." Every check on a skill the rogue
  is proficient in (Expertise too) rolls no lower than 10, in a fight and out of it; Jack of All
  Trades' half bonus doesn't count, and saving throws never do.
- **Indomitable Might** (barbarian 18th level): "if your total for a Strength check is less than your
  Strength score, you can use that score in place of the total." Any Strength check, Athletics
  included, totals at least the barbarian's Strength score, in a fight and out of it.
- **Jack of All Trades** (bard 2nd level): "you can add half your proficiency bonus, rounded down, to
  any ability check you make that doesn't already include your proficiency bonus." Every skill the
  bard isn't proficient in, every plain ability check and initiative add it; saves don't.
- **Remarkable Athlete** (Champion 7th level): "you can add half your proficiency bonus (round up) to
  any Strength, Dexterity, or Constitution check you make that doesn't already use your proficiency
  bonus." The same for Strength, Dexterity and Constitution checks, initiative included; a bard and
  Champion takes the larger of the two. Its longer running long jump (the Strength modifier in feet)
  works since 0.252.0.

## Item 21 features without new Engine keys (0.211.0)

Capability API 1.420 (its throw back's long range and die; the rest needs only 1.419, as 0.210.0).

- **Step of the Wind** (monk 2nd level): "You can spend 1 ki point to take the Disengage or Dash
  action as a bonus action on your turn." Its own pick beside Ki, as Flurry of Blows is. The doubled
  jump works since 0.252.0.
- **Empty Body** (monk 18th level): "spend 4 ki points to become invisible for 1 minute", with
  resistance to all damage but force. Spending 8 ki casts Astral Projection on the monk alone, set up before a fight
  (`monk-empty-body-astral-projection`).
- **Stillness of Mind** (monk 7th level): "use your action to end one effect on yourself that is
  causing you to be charmed or frightened."
- **Steel Will** (Hunter 7th level, Defensive Tactics): "advantage on saving throws against being
  frightened", its own pick, one of the three.
- **Nature's Ward** (Land druid 10th level): "you can't be charmed or frightened by elementals or
  fey", held all fight; its poison and disease immunity worked already.
- **Second-Story Work** (Thief 3rd level): "climbing no longer costs you extra movement", a climbing
  speed equal to the walk. Its longer running jump works since 0.252.0.
- **Favored Enemy** (ranger 1st level): advantage on Survival to track the chosen enemy and on
  Arcana, History, Nature and Religion to recall what is known of it, when the Game Master applies
  it to the check (`apply="Favored Enemy"`); only they know what is tracked or recalled.
- **Eldritch Master** (warlock 20th level): every expended pact slot back, once a long rest.
- **Rage** at 20th level and **Wild Shape** with **Archdruid**: unlimited, 999 uses.
- **Deflect Missiles' throw back** (Capability API 1.420): a 20/60-foot range, disadvantage beyond 20
  feet, and the Martial Arts die in place of the missile's dice, as the monk weapon it counts as.

## Fiendish Resilience (0.212.0)

No new Engine key: typed defenses as in 0.62.0.

- **Fiendish Resilience** (Fiend warlock 10th level): "you can choose one damage type when you
  finish a short or long rest. You gain resistance to that damage type until you choose a different
  one with this feature. Damage from magical weapons or silver weapons ignores this resistance." Its
  Features row's Damage resistances cell comes with "except magic_weapon silvered"; after a rest the
  player writes the chosen type before it, such as "slashing except magic_weapon silvered", and
  changes it at the next rest. Until a type is written the cell resists nothing. Since 0.400.0 each
  damage type is its own choice with the cell already written, and since 0.428.0 the feature's own row
  is taken as it is and carries no cell.
- **Magic weapon** is a new item tag, beside Magical: every magic weapon, magic ammunition (the arrow
  of slaying too), the staffs wielded as magic quarterstaffs, a Pact of the Blade weapon, a druid's
  or dryad's club with shillelagh and the weapon attacks of the creatures whose weapon attacks are
  magical carry it. A spell is magical but never a magic weapon, so a slashing spell is still
  resisted while a +1 longsword gets through.

## Disciple of Life and Blessed Healer (0.213.0)

Capability API 1.421.

- **Disciple of Life** (Life cleric 1st level): "Whenever you use a spell of 1st level or higher to
  restore hit points to a creature, the creature regains additional hit points equal to 2 + the
  spell's level." Every creature a cleric's healing spell of 1st level or higher heals regains 2 + the
  level it was cast at more: Cure Wounds at 1st level heals 1d8 + Wisdom + 3, and Mass Healing Word at
  3rd level adds 5 to each creature it heals. Cantrips add nothing.
- **Blessed Healer** (Life cleric 6th level): "When you cast a spell of 1st level or higher that
  restores hit points to a creature other than you, you regain hit points equal to 2 + the spell's
  level." The cleric regains 2 + the spell's level once a casting when it heals somebody else, and
  nothing when it heals only the cleric.

## Retaliation, Giant Killer and Stand Against the Tide (0.214.0)

Capability API 1.422.

- **Retaliation** (Berserker 14th level): "when you take damage from a creature that is within 5
  feet of you, you can use your reaction to make a melee weapon attack against that creature." Once
  the harm lands, the barbarian is offered their own best melee weapon strike at whoever dealt it, if
  it stands within 5 feet, for their reaction.
- **Giant Killer** (Hunter 3rd level, a Hunter's Prey choice beside Colossus Slayer): "When a Large
  or larger creature within 5 feet of you hits or misses you with an attack, you can use your
  reaction to attack that creature immediately after its attack, provided that you can see the
  creature." Offered once such an attack is over, hit or missed, while the ranger sees the attacker;
  the answer is the ranger's best melee weapon strike, the attacker being within 5 feet.
- **Stand Against the Tide** (Hunter 15th level, a Superior Hunter's Defense choice beside Evasion
  and Uncanny Dodge): "When a hostile creature misses you with a melee attack, you can use your
  reaction to force that creature to repeat the same attack against another creature (other than
  itself) of your choice." The ranger picks the creature, which must be within that attack's reach.

## Sanctuary and Nature's Sanctuary (0.215.0)

Capability API 1.423.

- **Sanctuary** (1st-level abjuration, a bonus action, 1 minute): "any creature who targets the
  warded creature with an attack or a harmful spell must first make a wisdom saving throw. On a
  failed save, the creature must choose a new target or lose the attack or spell. This spell doesn't
  protect the warded creature from area effects." The warded creature holds the Sanctuary
  condition, saved against at the DC the spell was cast with; a failed save sends the attack to the
  nearest other creature it could be made at that holds no sanctuary, or loses it. The spell ends
  when the warded creature attacks or casts a spell. A scroll of Sanctuary does the same.
- **Nature's Sanctuary** (Circle of the Land 14th level): "When a beast or plant creature attacks
  you, that creature must make a Wisdom saving throw against your druid spell save DC. On a failed
  save, the creature must choose a different target, or the attack automatically misses. On a
  successful save, the creature is immune to this effect for 24 hours." The druid holds it every
  fight; one that saved is free of it for the rest of the fight, as no fight lasts 24 hours.
- Still needing the Engine: Tranquility's ward put on at a long rest, Sanctuary ending only on a
  spell that affects an enemy, and both stopping only what they name (attacks, and for Sanctuary
  harmful spells).

## Dispel Magic and Cleansing Touch (0.216.0)

Capability API 1.424.

- **Dispel Magic** (3rd-level abjuration): "Any spell of 3rd level or lower on the target ends. For
  each spell of 4th level or higher on the target, make an ability check using your spellcasting
  ability. The DC equals 10 + the spell's level. On a successful check, the spell ends." Cast on a
  creature, every spell on it up to the slot's level ends, and each higher one ends on a check of
  the caster's spellcasting modifier against 10 + its level. A spell held by its caster's
  concentration ends everywhere it holds.
- **Cleansing Touch** (Paladin 14th level): "you can use your action to end one spell on yourself or
  on one willing creature that you touch. You can use this feature a number of times equal to your
  Charisma modifier (a minimum of once). You regain expended uses when you finish a long rest." It
  ends the highest-level spell on the creature, with a Cleansing Touch counter of Charisma modifier
  uses (at least one) a long rest.
- Still needing the Engine: Dispel Magic on a lasting area or wall, and the paladin choosing which
  spell Cleansing Touch ends.

## Tranquility, and Sanctuary in full (0.217.0)

Capability API 1.425 and 1.426.

- **Tranquility** (Way of the Open Hand 11th level): "At the end of a long rest, you gain the effect
  of a sanctuary spell that lasts until the start of your next long rest (the spell can end early as
  normal). The saving throw DC for the spell equals 8 + your Wisdom modifier + your proficiency
  bonus." Each long rest puts the Tranquility condition on the monk's sheet fresh, at the ki save DC.
  It holds from fight to fight until the monk attacks or casts a spell at an enemy, and then stays
  off until the next long rest.
- **Sanctuary** now stops only attacks and harmful spells, as printed, and ends only when the warded
  creature attacks or casts a spell that affects an enemy: healing a friend keeps it.
- **Nature's Sanctuary** now stops only attacks.

## Dispel Magic in full, and Cleansing Touch's pick (0.218.0)

Capability API 1.427.

- **Dispel Magic**: "Choose one creature, object, or magical effect within range." It can now be aimed
  at a lasting area or wall another spell left standing within 120 feet, such as a Wall of Fire or a
  Cloudkill, which ends on the same terms as a spell on a creature, with the concentration that holds
  it.
- **Spell Scroll of Dispel Magic**: read, it casts Dispel Magic at 3rd level, so spells of 3rd level
  or lower end outright and higher ones on the reader's spellcasting check. Before, it was a scroll of
  text.
- **Staff of the Magi**: casts Dispel Magic for 3 charges, at 3rd level, as printed. Before, the staff
  left it out.
- **Cleansing Touch**: "end one spell". The paladin now picks which spell on the creature ends; with no
  pick, the highest-level one ends.

## Volley, Whirlwind Attack and Horde Breaker (0.219.0)

Capability API 1.428.

- **Multiattack** (Hunter 11th level) is now a choice of two, each its own entry:
  - **Volley**: "You can use your action to make a ranged attack against any number of creatures
    within 10 feet of a point you can see within your weapon's range. You must have ammunition for
    each target, as normal, and you make a separate attack roll for each target." The ranger sets a
    10-foot burst down as far as their best ranged weapon carries, and it shoots every foe inside,
    one attack roll and one piece of ammunition each, until the ammunition runs out.
  - **Whirlwind Attack**: "You can use your action to make a melee attack against any number of
    creatures within 5 feet of you, with a separate attack roll for each target." Every foe within
    5 feet takes a strike from the ranger's best melee weapon, each rolled on its own.
  - Allies in the area are never struck.
- **Horde Breaker**, a new Hunter's Prey choice: "Once on each of your turns when you make a weapon
  attack, you can make another attack with the same weapon against a different creature that is
  within 5 feet of the original target and within range of your weapon." After a weapon attack on
  their own turn, the ranger is offered the same weapon at another creature within 5 feet of the
  first target, for nothing, once a turn.

## Foe Slayer, Elemental Affinity and Natural Explorer (0.220.0)

Capability API 1.429. Three new sheet fields hold the choices these features read, shown in the
builder's Levels step for a ranger or a sorcerer, and on the sheet:

- **Favored enemies (ranger)** (`favored_enemies`): the Favored Enemy choice, creature types or tags
  separated by commas, such as `undead`, or `orc, gnoll` for two races of humanoid.
- **Favored terrain (ranger)** (`favored_terrain`): the Natural Explorer choice, for the Game Master.
- **Draconic ancestry damage type (sorcerer)** (`draconic_damage_type`): the Dragon Ancestor's damage
  type off the Draconic Ancestry table, picked by dragon (Fire for brass, gold or red).

- **Foe Slayer** (Ranger 20th level): "Once on each of your turns, you can add your Wisdom modifier to
  the attack roll or the damage roll of an attack you make against one of your favored enemies. You can
  choose to use this feature before or after the roll, but before any effects of the roll are applied."
  Against a creature the favored enemies field names, the Wisdom modifier is held back until an attack
  falls short and turns it into a hit, or goes onto the damage of an attack that hits without it, once
  on each of the ranger's turns.
- **Elemental Affinity** (Draconic Bloodline 6th level): "when you cast a spell that deals damage of
  the type associated with your draconic ancestry, you can add your Charisma modifier to one damage roll
  of that spell. At the same time, you can spend 1 sorcery point to gain resistance to that damage type
  for 1 hour." Spells of the field's damage type deal the Charisma modifier more, once a cast; for 1
  sorcery point, at no action, the sorcerer resists that type for an hour.
- **Natural Explorer** (Ranger 1st level): "When you make an Intelligence or Wisdom check related to
  your favored terrain, your proficiency bonus is doubled if you are using a skill that you're
  proficient in." The Game Master applies it to a check related to the favored terrain
  (`apply="Natural Explorer"`): an Intelligence or Wisdom check with a skill the ranger is proficient
  in adds the proficiency bonus again. Its travel benefits (difficult terrain, never lost, foraging,
  tracking) are for the Game Master as they narrate the journey.

## Escape the Horde and Multiattack Defense (0.221.0)

Capability API 1.430. The Hunter's Defensive Tactics (7th level) is a choice of three, one per
character: Steel Will (since 0.211.0) and now these two, each a Class features pick that keeps its
combat condition on the ranger all fight.

- **Escape the Horde**: "Opportunity attacks against you are made with disadvantage." Only opportunity
  attacks: an attack on the foe's own turn is rolled as usual.
- **Multiattack Defense**: "When a creature hits you with an attack, you gain a +4 bonus to AC against
  all subsequent attacks made by that creature for the rest of the turn." Only that creature, and only
  after its hit: its first attack and every other creature's are against the ranger's own AC.

## Land's Stride and Unarmored Movement on walls and water (0.222.0)

Capability API 1.432.

- **Land's Stride** (Ranger 8th level, Circle of the Land 6th level): "moving through nonmagical
  difficult terrain costs you no extra movement. You can also pass through nonmagical plants without
  being slowed by them". The board's own terrain and growth cost a plain step; hard going a spell
  leaves behind (Spike Growth, Web, Plant Growth) still counts in full, as it is magical. "In
  addition, you have advantage on saving throws against plants that are magically created or
  manipulated to impede movement, such those created by the entangle spell": Entangle's and Wall of
  Thorns' saves.
- **Unarmored Movement** (Monk 9th level): "you gain the ability to move along vertical surfaces and
  across liquids on your turn without falling during the move." With no armor or shield, a climb of
  any height costs only what the ground costs, and water is crossed for a plain step. A monk can't
  stop on water: a walk that would end there comes ashore on the nearest open ground.

## Intimidating Presence (0.223.0)

Capability API 1.431 and 1.433. A 10th-level Berserker's Intimidating Presence is on the fight menu: "you can use
your action to frighten someone with your menacing presence. When you do so, choose one creature that
you can see within 30 feet of you. If the creature can see or hear you, it must succeed on a Wisdom
saving throw (DC equal to 8 + your proficiency bonus + your Charisma modifier) or be frightened of you
until the end of your next turn."

- The DC is 8 + proficiency + Charisma, read as the Charisma spell save DC (the same sum) for a
  character whose class is Barbarian.
- "On subsequent turns, you can use your action to extend the duration": **Keep up Intimidating
  Presence** is offered for an action while the creature is still frightened, with no new save.
- "This effect ends if the creature ends its turn out of line of sight or more than 60 feet away from
  you": either one ends it, checked as the creature ends its turn.
- "If the creature succeeds on its saving throw, you can't use this feature on that creature again for
  24 hours": a creature that saved is spared until the barbarian's long rest; one that failed can be
  frightened again later.

## Sorcerous Restoration (0.224.0)

A 20th-level sorcerer gets 4 spent sorcery points back at the end of every short rest (SRD 5.1: "At 20th level, you regain 4 expended sorcery points whenever you finish a short rest"). The short rest's last `restore` step gives back only the Sorcery Points row of the counters list (`row`), and only while `level_sorcerer` is 20 (`when`), never past the row's most; every other counter is left alone, and a sorcerer below 20th level gets nothing back. Capability API 1.434; the package checker refuses a `row` without `listPools`, and a `when` without a bound or with a value the sheet does not have.

## Beast Spells and Archdruid (0.225.0)

A druid in Wild Shape casts no spells, and from 18th level casts their spells in any beast shape (SRD 5.1, Beast Spells: "you can cast many of your druid spells in any shape you assume using Wild Shape"): the `beast_spells` derived value, 1 from druid 18, is a combat level with `"shapeKeeps": ["spells/*"]`. A beast can't hold a material component ("you aren't able to provide material components"), so the `wild_shaped` condition forbids `material` and `material_cost`.

At 20th level, Archdruid lets the druid "ignore the verbal and somatic components of your druid spells, as well as any material components that lack a cost and aren't consumed by a spell": the `archdruid` derived value, 1 from druid 20, is a combat level that `waives` `verbal`, `somatic` and `material`. Silence and a gag don't stop those casts, and casting them doesn't give the druid away while hiding. Every spell whose material has a cost or is consumed also needs the new `material_cost` component, which Archdruid does not waive, so a beast-shaped archdruid still can't cast Revivify or Stoneskin. Capability API 1.435.

## Rage ends on an idle turn, and Persistent Rage (0.226.0)

Rage "ends early if you are knocked unconscious or if your turn ends and you haven't attacked a hostile creature since your last turn or taken damage since then". The `raging` condition's `endsIdle` takes it off, with its rage damage, as the barbarian ends a turn having made no attack roll at a foe and taken no damage since their last turn ended, the turn they rage on included. Persistent Rage: "Beginning at 15th level, your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it", so `endsIdle.unless` keeps it on while `level_barbarian` is 15 or more. Capability API 1.436.

## Only druid spells for Beast Spells and Archdruid, and Rage's limits (0.227.0)

Beast Spells keeps "your druid spells" and Archdruid ignores the components of "your druid spells". Both levels now carry `"rowsWhere": {"list": "spells", "column": "class", "is": ["druid", "any"]}`: only spells on rows whose Class is Druid, or Any (the sheet's own spellcasting class, which for a single-class druid is druid), are kept in a beast's shape or have their components waived. A druid 18 / wizard 2 whose wizard spells are marked Wizard keeps only the druid spells in Wild Shape, and spells from a race or an item never count. A spell row with no Class reads as Any. Capability API 1.438.

Rage's other limits: "If you are able to cast spells, you can't cast them or concentrate on them while raging", and "It ends early if you are knocked unconscious". The `raging` condition `forbids` `casts` from the spells catalog (scrolls and items that cast a spell included) and `concentration`, ending any concentration the barbarian holds as they rage, and `endsWhenHolder.downed` takes it off when they drop to 0 hit points. Capability API 1.438.

## Divine Sense (0.228.0)

"As an action, you can open your awareness to detect such forces. Until the end of your next turn, you know the location of any celestial, fiend, or undead within 60 feet of you that is not behind total cover." The Divine Sense counter now carries `mechanics`: an action that puts the `divine_sense` condition on the paladin until the end of their next turn. That condition's `aware` is `{"within": 60, "of": {"types": ["celestial", "fiend", "undead"]}, "uncovered": true}`, so a hidden zombie or imp within 60 feet with a clear line is found, while a hidden goblin, or a fiend behind a wall, is not. Sensing consecrated or desecrated places stays with the Game Master. Capability API 1.439.

## Rage ends on falling unconscious (0.229.0)

Rage "ends early if you are knocked unconscious". From 0.227.0 it ended when the barbarian dropped to 0 hit points; now the `raging` condition's `endsWhenHolder` is `{"downed": true, "gains": ["unconscious", "asleep", "slept"]}`, so it also ends the moment they fall unconscious above 0 hit points, as under the Sleep spell (`slept`) or a creature's sleep poison (`asleep`). Persistent Rage keeps this: it "ends early only if you fall unconscious or if you choose to end it". Capability API 1.440.

## Picking what Lesser Restoration ends, and room for every class feature (0.230.0)

Lesser Restoration ends "either one disease or one condition afflicting it". Its `ends` now carries `"chosen": true`: the caster sees which of blinded, deafened, paralyzed, poisoned and the diseases the target holds and picks the one to end; with no pick, the first listed that the target holds ends as before. Greater Restoration already lets the caster pick its one effect through its own choices (0.101.0). Capability API 1.442.

The guided builder's Class features step allowed 20 picks, but a 20th-level Way of the Open Hand monk has 34 features to take and a Thief rogue more than 20. The step now allows 40.

## Divine Intervention and Primeval Awareness (0.231.0)

Divine Intervention: "Imploring your deity's aid requires you to use your action. ... roll percentile dice. If you roll a number equal to or lower than your cleric level, your deity intervenes." The feature now carries two counter rows, Divine Intervention (back on no rest) and Unanswered Intervention (back after a long rest), and `mechanics` with `"usesOf": "Divine Intervention"` and `"chance": {"sides": 100, "atMost": {"field": "level_cleric"}, "sure": {"value": {"field": "level_cleric"}, "atLeast": 20}, "failUses": "Unanswered Intervention"}`. An answered call spends Divine Intervention, as "If your deity intervenes, you can't use this feature again for 7 days", and puts `divine_intervention` on the cleric until the end of their next turn while "The GM chooses the nature of the intervention"; the GM gives the use back after the seven days. An unanswered call spends Unanswered Intervention instead, "Otherwise, you can use it again after you finish a long rest". "At 20th level, your call for intervention succeeds automatically, no roll required." Capability API 1.443.

Primeval Awareness: "you can use your action and expend one ranger spell slot to focus your awareness ... you can sense whether the following types of creatures are present within 1 mile of you ...: aberrations, celestials, dragons, elementals, fey, fiends, and undead. This feature doesn't reveal the creatures' location or number." It costs a spell slot and puts `primeval_awareness` on the ranger for a minute; that condition's `presence` makes the log name the kinds within 5,280 feet as it comes on and at each of the ranger's turns, never their places or numbers, and it never stops anyone hiding. Each slot level above 1st adds a minute (duration `perStep`, 1.447), and in favored terrain it reaches 6 miles (`primeval_awareness_terrain`, `appliesOneOf`, 1.448). Capability API 1.444.

## Divine Intervention after seven days (0.232.0)

"If your deity intervenes, you can't use this feature again for 7 days." The counters list's recharge column gains a `week` value, labeled Week (7 days), and its pools say `"rechargeDays": {"week": 7}`; the Divine Intervention row recharges on `week`. A spent row counts the days the sheet's `pass` command says have passed (`[sheet: who="Name" op="pass" days="N"]`) and fills again at seven, while short and long rests leave it alone. Unanswered Intervention stays on the long rest. Capability API 1.445.

## Summon Demon and Summon Mephits (0.233.0)

The SRD's variant actions: "A vrock has a 30 percent chance of summoning 2d4 dretches or one vrock. A summoned demon appears in an unoccupied space within 60 feet of its summoner, acts as an ally of its summoner, and can't summon other demons. It remains for 1 minute, until it or its summoner dies". Each demon's Summon Demon is an action with `"uses": {"per": "day", "count": 1}`, `"chance": {"sides": 100, "atMost": 30}` (50 for the nalfeshnee, marilith and balor), and `calls` with one `options` entry per printed kind, `"rounds": 10`, `"endsWithCaller": true` and `"cantCall": true`. The mephits' Summon Mephits calls `{"dice": "1d4"}` of their own kind on a 25 percent chance, the same way. The balor's "or one goristro" is left out: the goristro is not an SRD creature. Capability API 1.446.

## Primeval Awareness in full (0.234.0)

"For 1 minute per level of the spell slot you expend, you can sense whether the following types of creatures are present within 1 mile of you (or within up to 6 miles if you are in your favored terrain)". Both conditions it can put on last `{"rounds": 10, "perStep": 10}`, a minute more for each slot level above 1st (Capability API 1.447), and its mechanics say `"appliesOneOf": true` over `primeval_awareness` (5,280 feet) and `primeval_awareness_terrain`, labeled Primeval Awareness (favored terrain), with 31,680 feet: the ranger picks the second in their favored terrain (Capability API 1.448). The manifest now declares Capability API 1.448.

## Dismissing summoned demons and mephits (0.235.0)

"It remains for 1 minute, until it or its summoner dies, or until its summoner dismisses it as an action." Summon Demon's and Summon Mephits' `calls` now say `"dismissible": true`: while any creature that call brought is still here, the summoner's menu offers Dismiss Summon Demon (or Summon Mephits) on its action, sending them all away. The manifest now declares Capability API 1.449.

## Divine Word (0.236.0)

"Choose any number of creatures you can see within range. Each creature that can hear you must make a Charisma saving throw. On a failed save, a creature suffers an effect based on its current hit points". Divine Word is now a debuff on up to 20 targets (the most an entry can name) with a Charisma save, and `applies` gated by `targetHealthAtMost`: deafened for a minute at 50, deafened and blinded for 10 minutes at 40, deafened, blinded and stunned for an hour at 30. `"killsAtMost": 20` kills outright, and `"dismisses": true` with `"dismissesIs": {"types": ["celestial", "elemental", "fey", "fiend"]}` sends those kinds back to their planes. The SRD fixture prints the hour tier's third condition as "dazed", a word 5e has no condition for; SRD 5.1 reads stunned. The manifest now declares Capability API 1.450.

## Glyph of Warding's explosive runes (0.237.0)

"When triggered, the glyph erupts with magical energy in a 20-foot-radius sphere centered on the glyph. ... Each creature in the area must make a Dexterity saving throw. A creature takes 5d8 acid, cold, fire, lightning, or thunder damage on a failed saving throw (your choice when you create the glyph), or half as much damage on a successful one." Glyph of Warding is now an attack drawn by touch on a 5-foot burst (the glyph's 10-foot diameter) whose `zone` stands for 1,000 rounds with `"detonates": {"entered": true, "within": 20}`: anyone but its caster who steps on it sets it off, and the blast reaches 20 feet from its middle, a Dexterity save for half and `"perCostStep": {"dice": "1d8"}`. Cold, fire, lightning and thunder are entries of their own (`glyph-of-warding-cold` and so on), as Protection from Energy's types are, so a wizard's Signature Spells now offer 36 picks. The blast counts 4 targets, as Fireball's 20-foot sphere does. The manifest now declares Capability API 1.451.

## Magic Circle and Hallow's ward (0.238.0)

Magic Circle: "The creature can't willingly enter the cylinder by nonmagical means. ... The creature has disadvantage on attack rolls against targets within the cylinder. ... Targets within the cylinder can't be charmed, frightened, or possessed by the creature." It is now a 10-foot burst whose `zone` stands for 600 rounds (an hour) with `"keepsOut": {"is": {"types": [...]}, "attacksInto": "disadvantage", "cantGive": [...]}`. `cantGive` names every charm and fright of this package a creature can put on: charmed, charmed by a person or creature, dominated, frightened, Antipathy's fright and Fear's flight. "Choose one or more of the following types": all five kinds is the spell's own entry, and each kind alone is an entry of its own (`magic-circle-fiend` and so on). The reversed circle (`magic-circle-reversed`, and one for each kind) says `"way": "out"`: those kinds can't walk out once inside. Magic Circle's twelve entries bring a wizard's Signature Spells to 47 picks and add eleven spell scrolls.

Hallow: "celestials, elementals, fey, fiends, and undead can't enter the area, nor can such creatures charm, frighten, or possess creatures within it." It is now a 60-foot burst whose `zone` stands for 1,000 rounds, the longest a zone stands, with the same `keepsOut` and no disadvantage. Its extra effects are 24 `hallow-*` entries of their own (zone `inside`): Courage, Darkness, Daylight, Energy Protection and Energy Vulnerability for each damage type, Extradimensional Interference, Fear and Silence. Tongues has none. The manifest now declares Capability API 1.452.

## Symbol and the spell glyph (0.239.0)

Symbol: "Once triggered, the glyph glows, filling a 60-foot-radius sphere with dim light for 10 minutes, after which time the spell ends. Each creature in the sphere when the glyph activates is targeted by its effect, as is a creature that enters the sphere for the first time on a turn or ends its turn there." It is now drawn by touch on a 5-foot burst, as Glyph of Warding is, with `"detonates": {"entered": true, "within": 60, "becomes": {"size": 60, "rounds": 100, "triggers": ["enter", "turn-end"], "lights": {"bright": 0, "dim": 60}}}` (Capability API 1.453), counting 12 targets as Circle of Death's sphere does. Death is the spell's own entry (10d10 necrotic, Constitution save for half). Discord (`symbol-discord`, Constitution save, the new Bickering condition: disadvantage on attack rolls and ability checks for a minute), Insanity (`symbol-insanity`, Intelligence save, the new Insane condition: no reactions and a wander every turn for a minute), Pain (`symbol-pain`, Constitution save, incapacitated for a minute), Sleep (`symbol-sleep`, Wisdom save, slept for 10 minutes, waking when damaged or shaken) and Stunning (`symbol-stunning`, Wisdom save, stunned for a minute) are entries of their own.

Glyph of Warding's spell glyph: "You can store a prepared spell of 3rd level or lower in the glyph by casting it as part of creating the glyph. ... When the glyph is triggered, the stored spell is cast." The spell's own entry now says `"stores": true` (Capability API 1.454): drawing it, the caster picks one of their own spells as a mode, of 1st level or higher and no higher than the slot the glyph was cast with, and pays for both. Set off, the stored spell is cast at whoever stepped on it, or centred on them for a spell with an area, and a concentration spell lasts its full time. With no spell picked, the glyph is explosive runes. The manifest now declares Capability API 1.454.

## Hidden glyphs, outlasting zones, Fear and Hopelessness (0.240.0)

Glyph of Warding and Symbol carry `"hidden": {"check": "investigation"}` (Capability API 1.455): their caster's foes see them only once one finds them with a Search, an Investigation check against the spell save DC. The fight's new Investigation check reads the sheet's skill, or a creature's printed Investigation or Intelligence modifier. Every zone held by no concentration and set at a point (the glyphs, Symbol, Magic Circle, Hallow, Grease, Guardian of Faith, Plant Growth) `outlasts` its caster (1.456). Symbol's Fear (`symbol-fear`: frightened, and the new Fleeing the glyph condition, which drops what is held and moves away from the glyph, `from: "point"`) and Hopelessness (`symbol-hopelessness`: the new Hopeless condition, `cannot-harm`) are entries of their own (1.457). The manifest declares Capability API 1.457.

## Casting over rounds, set-up zones and Hallow's effects (0.241.0)

Every spell with a casting time of 1 minute says `"castingRounds": 10` (Capability API 1.461): Magic Circle, Symbol, the Conjure spells, Foresight, Regenerate and the rest, their scrolls too. A zone that takes longer to cast than a fight lasts says `"beforeFight": true` (1.462): Glyph of Warding (an hour) and Hallow (a day) are off the fight menu, and the GM sets them up as the fight starts. Magic Circle reversed keeps its disadvantage and the conditions it can't give, now protecting those outside (1.458). Hallow `frees` whoever steps in of the charms and frights a warded kind put on them (1.459), and its extra effects are entries of their own with `inside` conditions shrugged off by a Charisma save until leaving (1.460): Courage, Darkness, Daylight, Energy Protection and Energy Vulnerability for each of ten damage types (the new Hallow vulnerability conditions), Fear and Silence. Everlasting Rest and Tongues touch no fight. The manifest declares Capability API 1.462.

## Curses, steering, set-up spells and Hallow's kinds (0.242.0)

Bestow Curse: "choose the nature of the curse from the following options". The spell's own entry puts on one of three curses picked as it is cast (`appliesOneOf`, Capability API 1.448): disadvantage on attack rolls against its caster (`atSource`), a Wisdom save at the start of each turn that wastes the action on a failure (`"behavior": {"wastes": {"save": "wis_save", "budget": "action"}}`, 1.463), or an extra 1d8 necrotic damage from its caster's attacks (`damage-taken` `fromSource`). `bestow-curse-ability` picks one of six ability score curses, disadvantage on that ability's checks and saves. Sign of Ill Omen picks the same three. Signature Spells now has 48 picks. All nine curses on one entry, the longer durations of higher slots and the necrotic damage on spells with no attack roll came in 0.244.0 (below).

Compulsion: "you can use a bonus action on each of your turns to designate a direction ... Each affected target must use as much of its movement as possible to move in that direction on its next turn." Targets that fail a Wisdom save are compelled (`"behavior": {"moves": "toward", "from": "steered", "walks": true}`, 1.464), with a new save at the end of each turn. A creature that can't be charmed is immune. Its caster holds Compulsion: Direct (`compulsion-direct`, `"steers": "compelled"`) for the spell's minute, a bonus action aimed at a point. Bewitching Whispers and the spell scroll steer the same way. Since 0.244.0 the target acts first and walks as its turn ends (`"walks": "after"`).

Every spell taking 10 minutes or longer to cast says `"beforeFight": true` (1.465): Heroes' Feast, Antipathy/Sympathy, Prayer of Healing, Planar Ally and the rest are off the fight menu, and the GM can have them cast as the fight starts. Heroes' Feast is now a buff on up to twelve allies. Hallow's extra effects with a save say `"chooses": "type"` (1.466): its caster picks a creature type as it is cast, or none for everybody. Hallow's Extradimensional Interference (`hallow-extradimensional-interference`) says `"forbids": {"teleport": true}` (1.467): those it works on can't teleport into, out of or within it. The manifest declares Capability API 1.467.

## Prismatic Spray's rays (0.243.0)

Prismatic Spray: "For each target, roll a d8 to determine which color ray affects it." The spell says `"rays"` (Capability API 1.468), a d8 table rolled for each target after its one Dexterity save: Red fire, Orange acid, Yellow lightning, Green poison and Blue cold, each 10d6 (half on a success); Indigo restrains a creature that fails, which then saves with Constitution at the end of each of its turns, three successes ending it and three failures turning it to stone (petrified); Violet blinds a creature that fails, which saves with Wisdom at the start of its next turn, a failure sending it to another plane (banished); and Special strikes two more rays, rolled again on an 8. The spell scroll rolls the same rays. Since 0.245.0 Violet's save is rolled at the start of the caster's next turn and a failure sends the creature out of the fight. The manifest declares Capability API 1.468.

## Nine curses, Aid and raised hit point maximums (0.244.0)

Bestow Curse is one entry again, its nine curses picked as it is cast (`appliesOneOf` over up to twelve `applies`, Capability API 1.469); the scroll and Sign of Ill Omen pick the same way, and Signature Spells has 47 picks. Its curses last by the slot paid (`"bySteps": [100, 4800, 4800, 14400, 14400, 14400]`, 1.470): 1 minute from a 3rd-level slot, 10 minutes from a 4th, 8 hours from a 5th or 6th, and 24 hours from a 7th or higher, with concentration only below a 5th (`"concentrationBelowStep": 2`). A 9th-level casting lasts until dispelled since 0.245.0. The necrotic curse's extra 1d8 lands on its caster's spells with a save too (`alsoUnrolled`, 1.471). Compulsion's targets act first and walk as their turn ends (`"walks": "after"`, 1.472). Aid is a buff on up to three allies (`aided`), raising their maximum and current hit points by 5, and 5 more for each slot level above 2nd (`"raisesMax": {"flat": 5, "perStep": 5}`, 1.473). Heroes' Feast raises them by 2d10 (`"raisesMax": {"dice": "2d10"}`) and cures every disease and poisoning. The manifest declares Capability API 1.473.

## Wish, splitting oozes, Freedom of Movement and day-long spells (0.245.0)

Wish duplicates any other spell of 8th level or lower (`"duplicates": {"catalog": "spells", "upTo": 8}`, Capability API 1.474), each on the menu as "Wish: <spell>", paid with the 9th-level slot and needing none of its components. The black pudding and ochre jelly split in two when lightning or slashing damage leaves them with at least 10 hit points, down to Medium (`splits`, 1.475). Freedom of Movement is a buff on one ally for an hour: difficult terrain costs no extra movement, and spells and magic items cannot paralyze or restrain them (`conditionImmunitiesFrom` with `catalogs`, 1.476); since 0.247.0 magic cannot lower their speed and they slip out of a grapple or nonmagical restraints for 5 feet of movement. A worn Ring of Feather Falling lands its wearer safely, and a Periapt of Health holds off a disease already caught (`fallsSafely`, `suppresses`, 1.477). The aboleth's curse lets its victim heal underwater (`whileOffTerrain`, 1.478). Durations reach a day (1.482): Aid, Darkvision, Foresight and Mage Armor 8 hours; Continual Flame (until dispelled since 0.247.0), Animal Friendship, Antipathy/Sympathy, Heroes' Feast, Mind Blank, the Oathbow's sworn enemy, the broom of flying, Dragon Wings and Quivering Palm 24 hours; Hunter's Mark 8 hours from a 3rd- or 4th-level slot and 24 hours from a 5th; and Bestow Curse from a 9th-level slot until dispelled. Prismatic Spray's Violet ray rolls its save as the caster's next turn starts, and a failure sends the creature out of the fight (1.483). The manifest declares Capability API 1.483.

## Familiars, seeing through them, Antipathy/Sympathy on an object and the pact weapon's minute (0.246.0)

Antipathy/Sympathy has two more picks, cast on an object or an area: a stand-in for the object (`enchanted-object`, not an SRD stat block, of the `object` type no kind names) is called beside the caster, takes no turns and keeps no side standing (`"initiative": "none"`, Capability API 1.479), and the aura goes on it (`appliesToCalled`), spreading to the kind named. Find Familiar calls one of its fifteen SRD forms (the creature catalog's `familiar` filter), which rolls its own initiative and can't attack (`familiar`, `cannot-harm`); its caster holds the bond (`familiar_bond`), whose action looks through the familiar's eyes until their next turn, blinded and deafened to their own (`seen_through`, `lendsSenses`, 1.481). Pact of the Chain's own copy also calls the imp, pseudodragon, quasit or sprite. Voice of the Chain Master looks through an ally at no cost for a day, and Gaze of Two Minds through a willing humanoid touched for a turn. The look, the familiar's celestial, fey or fiend type and Pact of the Chain's lent attack came in 0.248.0. The pact weapon vanishes once it has lain more than 5 feet from the warlock for a minute (`vanishes`, 1.480). The manifest still declares Capability API 1.483.

## The periapt's every disease, until dispelled, freedom of movement and Holy Aura (0.247.0)

A Periapt of Health holds off every disease its wearer carries, Contagion's first days included (`"suppresses": ["disease"]`, Capability API 1.484). Continual Flame lasts until dispelled (`"duration": "until-dispelled"`, 1.485). Freedom of Movement keeps spells and magic items from lowering its target's speed (`speedKeptFrom`) and lets them slip out of a grapple or nonmagical restraints for 5 feet of movement (`slipsFree`, 1.486). A worn Ring of Free Action keeps magic from paralyzing or restraining its wearer or lowering their speed (`conditionImmunitiesFrom` and `speedKeptFrom` on the item, 1.486), and since 0.248.0 crosses difficult terrain at full speed. Holy Aura is a buff on its caster, concentration up to a minute: allies within 30 feet shed dim light in a 5-foot radius, have advantage on all saving throws, and attacks against them have disadvantage (`holy_aura`, `holy_aura_warded`); the flash that blinds a fiend or undead hitting one of them came in 0.248.0. The black pudding and ochre jelly split even when immune to the damage that splits them, an Engine fix. The manifest declares Capability API 1.486.

## Water Walk, the net, the Staff of Thunder and Lightning, the Rod of Lordly Might and Antimagic Field's summons (0.258.0)

Water Walk (up to ten willing creatures, an hour) and a worn Ring of Water Walking keep `water_walking` on their holder: they walk onto water and stand on it as on ground (`walksOnLiquid`, Capability API 1.529). A net does nothing to a formless creature (`targetIs.except`, 1.530): the black pudding, gray ooze, ochre jelly and shadow (Amorphous) and the air, water and fire elementals (their Forms) carry the `formless` tag. The net's restraint is its own condition, `netted` ("Restrained (net)", restrained's effects), and a blow of slashing damage struck at it, by its holder or anybody who reaches them, rolls against AC 10 and frees them once 5 damage has worn it down, harming nobody (`cutFree`, 1.531). Freedom of Movement slips out of it, and the Cloak of Displacement stops working in it.

The Staff of Thunder and Lightning adds Thunderclap, a 60-foot burst around its wielder (`area.around` on an item's use, 1.532), once a dawn, and on a melee hit Lightning (2d6 lightning) and Thunder (DC 17 Constitution or stunned until the end of the wielder's next turn), each once a dawn (`attack.spends[].uses`, 1.534). The Rod of Lordly Might is a +3 mace with Terrify (DC 17 Wisdom, frightened for a minute, within 30 feet) and, on a hit, Drain Life (DC 17 Constitution or 4d6 necrotic, half of it back as health) and Paralyze (DC 17 Strength or paralyzed for a minute, saving at the end of each turn), each once a dawn. Antimagic Field sets aside creatures that spells called while it covers them (`suppresses.setsAsideCalled`, 1.533). The Gem of Seeing gives True Seeing's own truesight, the Engine's 320 conditions being reached. The manifest declares Capability API 1.534.

- The rod's buttons work since 0.270.0 (below); its ladder, ram and compass do nothing in a fight.

## Thunder and Lightning, Faithful Hound, death bursts and absorption (0.259.0)

The Staff of Thunder and Lightning's Thunder and Lightning, once a dawn, is its Lightning Strike with Thunderclap's burst around its wielder beside it, spending neither's own daily use (`moreUses[].alongside`, Capability API 1.535). Faithful Hound is a summons that strikes by itself (`summons.strikesAtTurnStart`, 1.539): cast, the hound appears within 30 feet for 8 hours, and as each of its caster's turns starts it bites the nearest hostile creature within 5 feet of it, a spell attack for 4d8 piercing. The dust, ice, magma and steam mephits' and the magmin's Death Burst and the balor's Death Throes go off as they die, on everyone around them (`onDeath`, 1.540). The flesh golem's and shambling mound's Lightning Absorption, the clay golem's Acid Absorption and the iron golem's Fire Absorption heal them by the damage instead of harming them (`healedBy`, 1.541). The manifest declares Capability API 1.541.

## Conjurings and raisings, Create Specter, Aversion of Fire and Freeze (0.260.0)

Conjure Elemental calls one elemental of challenge rating 5 or lower, one higher for each slot level above 5th (`upTo.perStep`, Capability API 1.537); Conjure Fey one fey creature, or a fey spirit as a beast, of challenge rating 6 or lower, one higher a slot above 6th; both turn on their caster when its concentration breaks and stay out their hour (`hostileOnBreak`, 1.538). Conjure Celestial calls a celestial of challenge rating 4 or lower, 5 from a 9th-level slot (`fromStep`). Conjure Minor Elementals picks one, two, four or eight elementals as Conjure Animals does, twice as many from a 6th-level slot and three times from an 8th. Animate Dead raises a skeleton or a zombie, two more each slot level above 3rd (`perStep`), under control 24 hours; Create Undead three ghouls, one more each slot above 6th, or from an 8th-level slot two ghasts or wights, and from a 9th two mummies. Giant Insect calls ten giant centipedes, three giant spiders, five giant wasps or one giant scorpion acting on the caster's turn, and Find Steed a warhorse, pony, camel, elk or mastiff, a celestial, fey or fiend as its caster picks. The Staff of the Magi's Conjure Elemental (7 charges) and the spell scrolls call as their spells do. The corpses, bones and insects they are cast on, and Conjure Elemental's element nearby, are the table's to place.

The wraith's Create Specter raises a specter from a humanoid within 10 feet that died within the last minute, never more than seven at once (`calls.atCorpse`, `calls.atMost`, 1.554). The flesh golem's Aversion of Fire gives it disadvantage on attacks and checks to the end of its next turn once fire harms it, and the water elemental's Freeze takes 20 feet off its speed once cold does (`whenHarmedBy`, 1.542). The Gem of Seeing's truesight is its own condition again, the Engine's conditions being raised to 640 (1.552). The manifest declares Capability API 1.554.

## Berserk golems, Assassinate, Rampage, follow-up charges and the marilith's reactions (0.261.0)

The clay and flesh golems' Berserk rolls a d6 at the start of each of their turns while they are at or below 60 or 40 hit points; on a 6 they go berserk, attacking the nearest creature, until they regain all their hit points (`rollsAtTurnStart`, `behavior.nearest`, `endsAtFullHealth`, Capability API 1.543). The assassin's Assassinate gives it advantage against creatures that have not yet taken a turn and makes every hit on a surprised creature critical; the bugbear's and doppelganger's Surprise Attack deal their extra dice to a surprised target, and the doppelganger's Ambusher gives it advantage against creatures it surprised (`whenTarget`, `critical`, rider `target-surprised`, 1.544). The gnoll's and giant hyena's Rampage lets them move half their speed and bite as a bonus action after dropping a creature to 0 hit points (`rampage`, 1.545). Pounce and Trampling Charge follow the knock-down with the bonus-action attack against a prone target (`charge.then`, 1.546); the warhorse's is another blow of the hooves it charged with (the same action again, 1.574). The marilith's Reactive gives it one reaction on every turn (`refillsEveryTurn`, 1.549). The manifest declares Capability API 1.554.

## The hydra's heads, the Grappler feat and the mimic's Grappler (0.262.0)

The hydra starts with five heads and loses one whenever it takes 25 or more damage in a turn; with none left it dies. At the end of its turn it grows two heads for each that died since its last turn, regaining 10 hit points for each, unless fire damage reached it since then. Each head beyond one gives it a reaction for opportunity attacks alone, while it has more than one head it has advantage on saves against being blinded, charmed, deafened, frightened, stunned and knocked unconscious (the Many heads condition), and its Multiattack bites once for each head (`heads`, sequence `perHead`, Capability API 1.550). The Grappler feat gives advantage on attack rolls against a creature its holder is grappling, and the mimic's Grappler the same against any creature grappled by it (`targetHoldsFromSelf`, 1.553). The feat's pin is a contest offered only against a creature its holder grapples (`targetHeldBySelf`, 1.553; `actorHolds`, 1.578). The manifest declares Capability API 1.554.

## Renumbered for upstream (1.0.1)

The Capability API numbers this package declares and gates on follow the Engine's (1.392-1.812). Nothing plays differently.

## First full release (1.0.0)

The whole SRD 5.1, played in Game Mode in 12 languages. Same data as 0.451.0.

## No area spells at challenge 3 (0.451.0)

A veteran battle priest casts Bestow Curse instead of Spirit Guardians and a veteran pyromancer Magic Missile instead of Fireball, so a Moderate fight with two of them stays Moderate. The plain Arrow of Slaying names its 14 kinds.

## Renumbered for upstream (0.450.0)

The Capability API numbers this package declares and gates on follow the Engine's renumbering (1.392-1.812). Nothing plays differently.

## Casters as strong as their challenge (0.449.0)

The made-up casters' Armor Class, spell attack and save DC now match their challenge rating's threat tier, so a fight rated Moderate plays as one. The plain Arrow of Slaying points the GM to the arrow of one kind.

## Magic ammunition to hit (0.448.0)

"You have a bonus to attack and damage rolls made with this piece of magic ammunition." The +N ammunition's ammoRider gains `toHit: N` beside its +N damage (Capability API 1.812), so a +1 arrow fired from a plain longbow adds 1 to the attack roll as well as the damage. The 12 entries are the +1, +2 and +3 arrows, crossbow bolts, sling bullets and blowgun needles. The ruleset declares 1.812.

## Light weapons and the Light cantrip (0.447.0)

A translation is keyed by its English string, and "Light" was both the weapon property (a weapon's chip and item tag) and the cantrip, so each language had to pick one: Spanish, German, Arabic, Hindi, Korean and Russian read the property as illumination, while French, Polish, Portuguese and Chinese read the cantrip as "light-weight". The property now reads "Light (weapon)" on the weapons catalog's Properties filter and the items block's light tag; "Light" is the cantrip and illumination only. No rule reads either label.

## Forms are creatures, not spell or item effects (0.446.0)

True Polymorph's forms read the whole creatures catalog, and Shapechange's all but constructs and undead, so they offered the stat blocks the catalog holds for spell and item effects: carpets and brooms of flying, dancing swords, feather tokens, Arcane Hand, the Antipathy/Sympathy object, Mislead's double, Animate Objects, Phantom Steed and a chain devil's chains. The creatures catalog gains a "Made by" filter (`origin`, "Spell, item or ability") on those 25 entries, and True Polymorph (willing and unwilling), its object-into-creature option and Shapechange leave them out. Its creature-into-object option still makes the True Polymorph object.

## Spanish scimitar (0.445.0)

A slip in the Spanish translation turned "cimitarra" into "cimitaciónra" in 23 strings: the weapon's name, the class proficiency lines, Vorpal and other magic scimitars. They read "cimitarra" again. No other language had the slip.

## Polymorph and Animal Shapes skip swarms (0.444.0)

Polymorph's beast forms and Animal Shapes read "a beast" as Wild Shape does, so their forms leave out `notFilters: {"swarm": ["Swarm"]}` too. Shapechange, True Polymorph and the conjuring spells are unchanged.

## Wild Shape skips swarms (0.443.0)

The SRD types each swarm ("Medium swarm of Tiny beasts") as a beast, so Wild Shape offered every swarm under the druid's challenge cap. A swarm is many beasts, not one, so the creatures catalog gains a Swarm filter, set on the 10 swarms, and Wild Shape's forms leave out `notFilters: {"swarm": ["Swarm"]}`. Polymorph and Animal Shapes are unchanged.

## Store descriptions within the Engine's cap (0.442.0)

A language pack's store-card description may be at most 2,000 characters (UTF-16 units, as the Engine counts them) and its name 1 to 120; over either, the Engine's catalog parser drops the whole ruleset entry. The German and French descriptions were 2,008 and 2,001. The sentence on each class's and the Acolyte's starting equipment is dropped from the description in all 12 languages; the longest is now German at 1,864. build-ruleset-packages refuses a pack over either cap, and validate-catalog checks every catalog entry's locales name and description against them.

## Language packs (0.441.0)

Language packs (Capability API 1.811): each `locales/<language>.json` ships as its own file beside the ruleset file, `ruleset-5e-2014-<version>.<language>.json`, byte for byte, and the catalog entry lists it under `locales` with its size, checksum and the translated name and description for the store card. The ruleset file carries no translation. The Engine downloads only the language it is set to, and a new one when the player switches.

Long rest (Capability API 1.810): `"every": 24`, one long rest in 24 hours of the game's clock, from the start of the last one.

Sheet layout 10: cantrips (level-0 spell rows) on an older sheet are marked prepared, and the Game Master's sheet summary names the character's features, warlock invocations and pact boon as well as prepared spells and attacks.

The 11 translated package descriptions said where to choose the ruleset twice, once before the SRD credit and once at the end, carried over from a draft of the English text. Each now says it once, last, after the SRD credit and the not-affiliated sentence, as `locales/en.json` does. Nothing else in the translations changed.

Translations cover every tab, group label, choice label and suggestion the sheet shows (`display.tab`, `display.by.labels`, `valueLabels`, `suggestions`) and the fight's languages prefix: 81 strings the first template missed, now in all 11 languages.

## Weapons drawn on use and Ritual Casting (0.440.0)

Drawing a weapon (Capability API 1.808): the items block says `"drawOnUse": {"categories": ["weapon"]}`. A weapon carried but not held is drawn when it is used, putting away other drawn weapons to free the hands it needs (one-handed weapons take one hand, two-handed two). A shield, armor or a cursed item is never put away for it; if only those block it, the use is refused. SRD 5.1, Using Objects: "you can also interact with one object or feature of the environment for free", such as drawing a weapon.

Ritual Casting (Capability API 1.809): the spells list says `"ritualNeeds"`: the bard, cleric, druid and wizard Spellcasting features (each with its Ritual Casting) and the warlock's Book of Ancient Secrets. A ritual is cast only by a character holding one of them; a sorcerer, paladin or ranger casts a ritual spell the usual way, with a slot.

## Translations (0.439.0)

Eleven languages ship as `locales/<language>.json`: ar (right to left), de, es, fr, hi, ja, ko, pl, pt-BR, ru and zh-Hans. Each translates all 8,313 of the ruleset's display strings and the package name and description; a string left empty falls back to English. The license attribution is not translated.

## Rituals and ready cantrips (0.438.0)

Rituals (Capability API 1.807): the spells list names its Ritual column as `ritual`, so a spell with the ritual tag may be cast as a ritual outside a fight, spending no slot; the extra ten minutes are the story's. Cantrips (level 0) come onto the sheet with Prepared ticked: they are always ready, and the GM's sheet summary lists only prepared spells.

## Attribution (0.437.0)

The license shown when the package is installed carries the SRD 5.1 notice in Wizards of the Coast's own words, the SRD 5.2.1 notice for the encounter budget table, a note that the SRD material has been adapted and reformatted into Marinara Engine ruleset data, as CC BY 4.0 asks, a credit for the Open5e API's srd-2014 data, which the spells, class features and weapons were read from, and "Not affiliated with or endorsed by Wizards of the Coast." The package description says it includes material from SRD 5.1 and 5.2.1 by Wizards of the Coast LLC (https://www.dndbeyond.com/srd), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/legalcode), and that it is not affiliated with or endorsed by Wizards of the Coast.


Translations (Capability API 1.806): a `locales/<language>.json` with a `ruleset` section (English strings as keys, the translation as values) is packed into the ruleset file beside the catalogs when the package is built; the English listing, `locales/en.json`, is not. Eleven ship from 0.439.0.
## Temporary hit points end on a long rest (0.436.0)

SRD 5.1: "Unless a feature that grants you temporary hit points has a duration, they last until they're depleted or you finish a long rest." The long rest now clears them (Capability API 1.804); before, temporary hit points with no duration of their own outlasted every rest.

## The encounter budget (0.435.0)

The Game Master is told how much a fight may hold, and invented opponents are held to it (Capability API 1.803). Each challenge rating's rung on the threat scale counts for the experience points SRD 5.1 gives it (10 for CR 0 up to 155,000 for CR 30). A member's level is the sum of the sheet's class levels, and each member adds that level's row of SRD 5.2.1's XP Budget per Character: Low, Moderate or High, 50/75/100 at 1st level up to 6,400/13,200/22,000 at 20th. SRD 5.2.1 spends experience points against the party's sum with no multiplier for how many opponents there are, so none is given. Casual games play Low, normal Moderate, and hard and brutal High; a fight with a boss may reach a step higher. This table is the package's only SRD 5.2.1 material, attributed in LICENSE-SRD.md. A first class also sets Class to its name ("Cleric"), so a sheet made with only a class level still opens that class's catalogs.

## Caster archetypes (0.434.0)

Thirty-five made-up casters (marked "Not an SRD stat block"): seven kinds, Pyromancer, Cryomancer, Necromancer, Enchanter (wizard sheet), Support Priest, Battle Priest (cleric sheet) and Nature Priest (druid sheet), each at five ranks. Rank sets challenge, Armor Class, hit points and class level: novice 1/2, AC 14, 15 hp, level 1; adept 1, AC 15, 35 hp, level 3; veteran 3, AC 16, 60 hp, level 5; master 6, AC 17, 100 hp, level 9; legendary 12, AC 18, 150 hp, level 15. Save DCs run 12, 14, 16, 18 and 19, spell attacks DC minus 8. Slots are the class's own, so they refill on that class's rests. Each carries 2-3 cantrips and 4-6 leveled SRD spells (the legendary one 8), at most two that take a creature out of a fight, and Counterspell only on wizard kinds from master up. Each has a role, a tactical mind (genius when legendary) and a temperament: pyromancers reckless, cryomancers methodical, necromancers cruel, enchanters cautious controllers, support priests supporters who guard casters and healers, battle priests disciplined bruisers, nature priests patient controllers. A legendary one is a solo with Legendary Resistance (3/day) and a one-point cantrip legendary action.

## A village herbalist (0.433.0)

A village now has an **herbalist**, who sells what an herbalism kit makes or holds: potions of healing, antitoxin, healer's kits and herbalism kits (SRD 5.1, Herbalism kit: "proficiency with this kit is required to create antitoxin and potions of healing"). These carry a new **Herbal** tag, and a potion of healing is now sold from a village up (by the herbalist and the temple), where other common magic still waits for a town. The potion of poison carries the tag too, so it still looks like the potion it passes for.

## Spotting fakes (0.432.0)

The fence's eight fakes (the Potion of Poison, Dust of Sneezing and Choking, Bag of Devouring, Shield of Missile Attraction and the four Armors of Vulnerability) now each carry the checks that can give them away, from the 5e scale: 13 or 15 for a medium tell, 18 or 20 for a thing made to fool the senses or divination. Anyone may make any of them, untrained with just the ability modifier. Beating one by 5 also names the fake.

- **Potion of Poison**: poisoner's kit 13; herbalism kit or alchemist's supplies 15; History, Arcana or Medicine 18. Detect Poison and Disease and Identify name it.
- **Dust of Sneezing and Choking**: alchemist's supplies 18; Arcana, Medicine or History 20. Identify is fooled, as the SRD says.
- **Bag of Devouring**: History 13; Arcana, Investigation, leatherworker's or weaver's tools 15. Identify names it.
- **Armor of Vulnerability**: History 18; Arcana, Religion or smith's tools 20. Identify is fooled (its curse hides under the resistance it really has).
- **Shield of Missile Attraction**: Arcana or History 18; Religion or smith's tools 20. Identify names it.
- **The fence**: Insight 13 says something is off about what it sells, never what. A Guild Artisan or Guild Merchant, Criminal or Spy, Charlatan or Urchin rolls it with advantage (read from the Background as written, so a full-5e background typed by hand counts).

A tool check needs the kit in the checker's own bag and is Intelligence plus the proficiency bonus with a Proficiencies row for the tool (the new alchemists_supplies_check, herbalism_kit_check, poisoners_kit_check, smiths_tools_check, leatherworkers_tools_check and weavers_tools_check). History about magic items (history_magic_items) is the History skill, or Intelligence and twice the proficiency bonus for a rock gnome's Artificer's Lore. Before a buy from the fence, every other party member's passive score (10 plus the check, 5 more with advantage) is weighed with no dice; one who notices warns the buyer in character. The Animal Handling tell (a familiar shying from the bag) stays with the Game Master, since the Engine cannot tell that an animal is near.

Spirit Guardians deals radiant or necrotic damage as its caster picks (the first, radiant, when nothing is picked).

This needs Capability API 1.802. The Engine's 5e Capability minors moved up one (1.384-1.800 to 1.400-1.801), and the numbers in this README and the changelog moved with them.

## Missing SRD items (0.431.0)

Open5e's fixtures leave out eleven SRD 5.1 magic items; this version writes them from the SRD's own entries, each checked absent from the source so a later fixture cannot build one twice. Armor +1, +2 and +3 (rare, very rare, legendary) comes for each of the twelve armors, adding its bonus to Armor Class. Shield +1, +2 and +3 (uncommon, rare, very rare) adds its bonus on top of the shield's 2. Ammunition +1, +2 and +3 (uncommon, rare, very rare) comes as arrows, crossbow bolts, sling bullets and blowgun needles: fired, it adds its bonus to the shot's damage and is spent once it hits; its bonus to the attack roll waits on the Engine. The Berserker Axe (a battleaxe, greataxe or handaxe) hits at +1 and binds with its curse; its hit point a level waits on the Engine (the hit point maximum cannot read what is worn), and going berserk when damaged stays with the GM. The Ioun Stone of Fortitude adds 2 Constitution, to at most 20.

From the same audit: Deflect Missiles answers only a ranged weapon attack, not a ranged spell attack; Uncanny Dodge (the rogue's and the hunter's) answers only an attacker its user can see; Empty Body makes the monk invisible for its minute as well as resistant; the Rock Gnome's Tinker gives tinker's tools; and the builder's Spells and Cantrips steps take up to 30 and 12 picks, enough for any SRD count, classes taken together included.

And items: the Robe of Eyes gives darkvision out to 120 feet and sees invisible creatures as far; the Belt of Dwarvenkind gives darkvision out to 60 feet (a dwarf already has it); the Nine Lives Stealer is found with 1d8 + 1 charges; the Scarab of Protection crumbles when its last charge is spent; and the Ioun Stone of Agility is very rare, as the SRD prints it, not rare as the source's rarity field says. The Armor of Vulnerability comes in three, one for each of bludgeoning, piercing and slashing: it resists that type and, cursed, leaves its wearer vulnerable to the other two while worn (the curse outlasting the armor stays the GM's). Geas takes only a creature its caster can see.

## Audit fixes (0.430.0)

The 0.429 completeness audit against SRD 5.1 found these, all fixed here: charms (Charm Person, a creature's charm, Hypnotic Pattern) count as charmed and Telekinesis's hold counts as restrained, so whatever wards those off wards these off too. Gazes and charms that say "if the target can see" need the target's sight, and "against this magic" ones count as magic. The Shadow's Strength Drain takes 2 Strength (the SRD's 1d4, at its average, not yet rolled or stacking) until a short or long rest. Regenerate heals 1 hit point at the start of each turn for an hour. Slow takes up to six creatures of the caster's choice. Hold Person, Hold Monster and Hideous Laughter last a minute, saved off at the end of each turn. Blink can be ended with an action. Paralyzed creatures can't move. Elven Chain counts you proficient. The Periapt of Proof against Poison also wards off poisoned potions. Printed Multiattack choices are offered for the veteran, xorn, chuul, gladiator, mummies and roper; the assassin has Evasion; the giant centipede, giant wasp and centipede swarm knock out rather than kill; the kraken's Lightning Storm strikes three targets; the duergar's Invisibility is once per rest.

## The dwarf's tool and the Acolyte's languages (0.429.0)

No new Engine key.

- **The dwarf's artisan's tools** ("smith's tools, brewer's supplies, or mason's tools") and **the Acolyte's two languages** are no longer stamped on the Proficiencies list as a line of their own ("Tools, one of: ...", "Languages: two of your choice") beside what was chosen; each tool or language chosen keeps its own row, as the bard's and the monk's tools do since 0.428.0. A sheet built before keeps the old line until it is removed by hand.

## Fiendish Resilience's type, and the tools chosen (0.428.0)

No new Engine key.

- **Fiendish Resilience** is taken as it is at 10th level, as Hunter's Prey is, and only its thirteen damage types are offered, one to choose; the builder's Class features step finishes once a type is picked. Its own Features row no longer carries a Damage resistances cell of its own ("except magic_weapon silvered" with no type).
- **The bard's and the monk's tools**: the class's Tools line ("Three musical instruments of your choice", "Choose one type of artisan's tools or one musical instrument") is no longer stamped on the Proficiencies list beside the tools chosen; each chosen tool keeps its own row. A sheet built before keeps the old line until it is removed by hand.

## Counted uses, and Brutal Critical's words (0.427.0)

Relentless Rage and Overchannel's uses now show on the sheet as a count ("Used N times", back to 0 on their rest) instead of twenty uses to spend; each use still raises Relentless Rage's DC by 5 and Overchannel's harm. Brutal Critical's extra dice show as "one more weapon die on a melee critical" for each step reached. A sheet saved before 0.427.0 has those two rows marked as counts when it is read (sheet layout 9). This needs Capability API 1.801.

## Archery on the Attacks list, and blank hit point rolls (0.426.0)

The Archery fighting style's +2 to hit now also reaches every row on the Attacks list that only shoots (its Reach is 0): a bow, a crossbow, a sling or a dart written there by the builder or by hand. A dart counts, as a ranged weapon; a thrown dagger or javelin row reaches 5 feet and takes none, as those are melee weapons. A row where the +2 was typed into Other bonus by hand should have it taken out. The guided builder's hit point roll rows now start blank, not at 1, so the Hit point rolls step stays open until each level's roll is rolled or typed. This needs Capability API 1.800.

## A chain warlock's familiar from one row, and the druid's scimitar (0.425.0)

A Pact of the Chain warlock now gets one Find Familiar row, the pact's own, and it calls any form: the spell's fifteen (bat, cat, owl and the rest) and the pact's imp, pseudodragon, quasit and sprite, each as a celestial, fey or fiend. The pact no longer writes a second, plain Find Familiar row, which had the Game Master pick the narrower one in play. A warlock saved before 0.425.0 keeps its plain row; it can be removed by hand. A druid is now proficient with the scimitar, the one martial weapon the Druid names, so a druid's scimitar from the bag adds the proficiency bonus to hit (a druid taken as a later class gains no weapons).

## One hit point roll for each level, and the tiefling's Infernal Legacy (0.424.0)

When hit points are Rolled, the guided builder's Hit point rolls step now starts with one row for each level after 1st and stays unfinished until each is rolled, so a 20th-level character can no longer finish the builder with only its 1st-level hit points. A tiefling's Infernal Legacy now casts in a fight: Hellish Rebuke as a 2nd-level spell (3d10 fire) as a reaction from 3rd level and Darkness from 5th, each off its own once-a-long-rest use and at the racial spell DC, on Charisma. A tiefling saved before 0.424.0 gets them by picking the race again. This needs Capability API 1.799.

## How many favored enemies a ranger chooses (0.423.0)

A ranger's Favored enemies field now says how many to choose: one at 1st level, two at 6th and three at 14th, as Favored Enemy grants. Favored terrain does the same at 1st, 6th and 10th level. Once that many chips are picked the editor offers no more, though anything can still be typed, so two humanoid races can share one pick. Step of the Wind now sits on the combat menu as the bonus action it is, not as an action. This needs Capability API 1.797.

## The Dragonborn's ancestry is named once (0.422.0)

The Dragonborn's Draconic Ancestry row was named "Draconic Ancestry table, Draconic Ancestry", as the ancestry table and the trait share one row; it now reads Draconic Ancestry. A sheet saved before 0.422.0 has that row renamed when it is read (sheet layout 8).

## Pact of the Chain's familiar can be called (0.421.0)

A Pact of the Chain warlock's two Find Familiar rows now come prepared, as the pact's spell is always known, so the setup before a fight can call the familiar (the imp, quasit, pseudodragon or sprite, or a normal form). A sheet saved before 0.421.0 has its Find Familiar (Pact of the Chain) row ticked Prepared when it is read (sheet layout 7); a plain Find Familiar row from earlier can be ticked by hand.

## Humanoid foes carry their weapons (0.420.0)

The SRD's humanoid foes now have on them the weapons their stat blocks attack with: a bandit's scimitar and light crossbow, a knight's greatsword and heavy crossbow, a goblin's scimitar and shortbow, and so on for 39 creatures. A bow, crossbow, sling or blowgun comes with ten arrows, bolts, bullets or needles, since the SRD gives no count. They carry no armor, so the party's loot after a win holds the weapons but not, say, a knight's plate. A ranger's Favored enemies and Favored terrain fields now offer the SRD's choices as chips: the creature types and the humanoid races the bestiary names, and the eight terrains of Natural Explorer. They stay free text, so a ranger can still type anything. Wild Shape, Polymorph and the conjuring spells no longer offer the beasts only magic makes (Phantom Steed's steed and the figurines' giant fly, goat of terror and onyx mastiff) or the diseased giant rat variant; in a fight they are still beasts. The builder asks for Eldritch Invocations after Cantrips, so Agonizing Blast can be picked once Eldritch Blast is. This needs Capability API 1.796.

## Class build fixes from the playtest (0.419.0)

Fireball is on the warlock's list, as the Fiend's expanded spells add it, and the Expanded Spell List's Info names every added spell. Open Hand Technique's prone pick is now called "Open Hand Technique: Knock Prone", beside Push and No Reactions; a saved sheet's row takes the new name (sheet layout 6). Martial Arts lets every monk weapon's attack row (Quarterstaff, Spear, Handaxe and the rest, not only Shortsword) use Dexterity. The builder's Equipment step now says the gear is worn in game, which is when it sets Armor Class.

## Finesse rows already on a sheet switch over (0.418.0)

A sheet saved before 0.418.0 reads its Dagger, Dart, Rapier, Scimitar, Shortsword and Whip attack rows as "finesse" when they held Strength or Dexterity, so they swing with whichever is better, as new rows have since 0.417.0. The sheet layout is now 5. This needs Capability API 1.794.

## Finesse weapons use the better of Strength and Dexterity (0.417.0)

Finesse weapon rows (dagger, darts, rapier, scimitar, shortsword, whip) now read "finesse" in the Ability column. A fight swings them with whichever of Strength or Dexterity adds more to hit, and deals the damage with that same one (SRD 5.1, Finesse). This needs Capability API 1.793. Rows already on a sheet keep the ability they hold; set the row's Ability to "finesse" to switch.

## Burning oil catches only from fire, and burns once (0.416.0)

A creature covered in oil from a thrown flask now takes the extra 5 fire damage only when something deals it fire damage, and only the first time: the oil burns away. Before, any blow while the oil was on added the 5, every time. The manifest declares Capability API 1.792.

## Sequester's ward, Gaseous Form's squeeze, and item spells the rings and staff were missing (0.415.0)

Sequester now keeps divination spells off its holder, as Mind Blank does, and Gaseous Form squeezes through gaps a Tiny creature could. Warding Bond's caster can end the bond as an action. Applying Oil of Sharpness takes a minute (ten rounds). The Staff of Charming also casts Comprehend Languages, the Ring of Water Elemental Command (elemental slain) casts Control Water for 3 charges, and the Ring of Shooting Stars casts Dancing Lights and Light only in dim light or darkness, while its Ball Lightning sphere sheds dim light 30 feet around it.

## An erinyes with a rope, and one Warding Bond per caster (0.414.0)

The bestiary has a second erinyes, Erinyes (rope of entanglement), the SRD's variant that carries a rope of entanglement: its Multiattack can use the rope in place of two of its three attacks, a DC 15 Dexterity save against being restrained by a rope that can be cut free (AC 20, 20 hit points) or escaped with a DC 15 Strength or Dexterity check. The plain erinyes is unchanged. Warding Bond now ends when its caster casts it on another ally, as the SRD's "cast again on either of the connected creatures" says; dismissing it as an action works since 0.415.0. The satyr's variant panpipes stay with the GM, because the source prints only the Gentle Lullaby line, with no save or range.

## Tactical only, weights in pounds (0.413.0)

A game on this ruleset now always plays its fights on the Tactical battlefield: the New Game wizard and the game's settings offer only Tactical, since the SRD's areas, reach, cover and flanking need positions. Weights now say lb after the number in the inventory, the starting gear picker and the kit options, and the bag and sheet show when you carry over your limit. The manifest declares Capability API 1.791.

## Priced spell materials (0.412.0)

51 SRD spells with a priced material now need it in the caster's bag to be cast from the sheet, and the ones the spell consumes are used up. A new Gem or spell material category holds 43 items at the worths the spells name (diamonds of 300, 500, 1,000 and 5,000 gp, diamond and ruby dust, pearls and more); several smaller ones add up. A jeweler in every town sells them. What a spell needs beside its priced material (Clone's vessel, the extra jacinths of an Astral Projection, Legend Lore's ivory sticks, Imprisonment's component) stays with the Game Master. The manifest declares Capability API 1.790.

## Speed with your load (0.411.0)

The sheet now works out what you carry against your carrying capacity (Strength times 15). Over it, your speed drops to 5 feet; over twice it, you can't move. The sheet shows Speed with your load and how far over capacity you are, and a fight reads that speed.

## Recovery at a short rest (0.410.0)

As a short rest ends, a wizard is offered Arcane Recovery and a Circle of the Land druid Natural Recovery: the sheet lists the spent slots, picks the highest that fit, and spends the feature's use.

## Fakes weigh the same (0.409.0)

A Potion of Poison now weighs the half pound of the Potion of Healing it is sold as, so carrying it no longer gives it away. Every fake is checked against its look-alike when the catalogs are built: same weight, category, slots, stack, tags and charges.

## Armor Class from your armor (0.408.0)

The typed Armor Class is now labelled Other Armor Class (Mage Armor, natural), for what comes from neither armor nor Unarmored Defense, and the builder's Equipment step says it sets your Armor Class. A character's own armor is never typed there: the sheet takes the highest, so a typed number would hold even with the shield off.

## Hit point rolls in the builder (0.407.0)

Choosing Rolled hit points now opens a Hit point rolls step, a row for each level after 1st with its Roll button. Choosing By hand shows the hit point maximum to type on the Levels step itself.

## Languages, Second Wind and armor names (0.406.0)

A race's own languages are now language entries given outright, so the Acolyte's or a race's language choice never offers one already spoken. Second Wind and Wholeness of Body heal outside a fight too. Armor is also found by its table name ("Plate", "Leather", "Hide", "Padded", "Splint", "Studded Leather"), and the poison by its source spelling. The Class choices step keeps waiting until a sorcerer picks a dragon ancestor.

## Tabs and the Hunter's choices (0.405.0)

The features list and the other proficiencies list each get their own tab on the game sheet, so they show in play. The Hunter's four parent features (Hunter's Prey, Defensive Tactics, Multiattack, Superior Hunter's Defense) no longer share a group with their options, so they are taken automatically, as Circle Spells are; the player still picks one option of each.

## Class choices, Essence of ether, Unanswered Intervention (0.404.0)

The guided builder has a Class choices step after the subclass (`class_choices`): a Draconic Bloodline sorcerer's dragon ancestor (the damage type Elemental Affinity and the resistance read) and a ranger's favored enemies and favored terrain, each shown while its class is taken and waited on until answered. The dragon ancestor reads "Not chosen yet" until one is picked. Before, they sat on the Levels step as optional fields and were easy to pass. The SRD's poison "Essence of ether" is spelled so (the source reads "Essense of either"); its id, `essense-of-either`, stays. Divine Intervention's row for a call the deity does not answer, spent until the next long rest, is named "Unanswered Intervention" (it was "Divine Plea").

## Dust, flying claws, a spell after pincers and the scarab (0.403.0)

Disintegrate kills whoever its damage drops to 0 (`"fellsKill": true`, Capability API 1.787), as its scroll does: "If this damage reduces the target to 0 hit points, it is disintegrated". Death Ward's hang-on at 1 still saves. The wyvern's claws carry `"whileFlying": true` ("While flying, it can use its claws in place of one other attack"), offered only while it is up in the air, with two more Multiattacks while flying: bite and claws, and claws and stinger. The glabrezu's "Alternatively, it makes two attacks with its pincers and casts one spell" is a second Multiattack of two pincers with `"castsOne": true`: one spell of its own may follow that turn, its uses still spent. The Scarab of Protection has 12 charges that never return, and its use is a reaction rescue on a failed save, `"against": {"where": {"filter": "school", "equals": "Necromancy"}, "fromTypes": ["undead"]}`: "turn the failed save into a successful one". It crumbling when the last charge is spent is the Game Master's to tell. The manifest declares Capability API 1.787.

## Thieves' tools Expertise (0.402.0)

Thieves' tools are a skill on the sheet, `thieves_tools` (Dexterity), trained by the Rogue class and by a Rogue multiclass beside their Proficiencies row. A rogue's Expertise offers every proficient skill and the tools, as the SRD says: "choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves' tools". A tool is no skill of your choice, so the half-elf's Skill Versatility, the College of Lore's Bonus Proficiencies, a bard's Expertise and a multiclass's one skill name the eighteen skills only. The thieves' tools check (what a fight's Disarm throws) is the larger of the skill and Dexterity plus the proficiency bonus with a Proficiencies row for the tools, so a character made before this keeps their bonus. Untrained, the skill adds what any Dexterity check does (Jack of All Trades, Remarkable Athlete). A Rogue multiclass's row now reads "Tools: thieves' tools", the row the proficiency counts.

## Engine numbering and fight poses (0.401.0)

The Engine's 5e Capability minors moved above upstream's: what was 1.342 to 1.748 is now 1.392 to 1.785, and 1.749 (the sheet's own words) is 1.378. Every number in this README follows. Fight poses ship with Capability API 1.786: the art draws the invisible and the camouflaged sneaking, and a cleric's or paladin's spells and features are cast praying; the fight view lists each fighter's prayed options and marks a hidden party member. A subrace's Info in the guided builder now says its traits add to its race's ("A subrace of the Elf: its traits add to the Elf's.") instead of asking to pick the Elf again. The manifest declares Capability API 1.786.

## Audit fixes, part 2 (0.400.0)

The quasit's claw deals its 2d4 poison, the magmin's touch sets its target alight and the vrock's spores hurt at the start of each turn. Thirteen creatures gain the multiattack alternatives the SRD prints. Gaseous Form stops attacks, spells, speech and items and ends at 0 hit points; Fire Shield can be dismissed as an action. The aboleth's Enslave and the succubus's Charm control their target, who saves again when hurt. Petrified keeps poison and disease off and holds those already on. The roper's tendril gives disadvantage on Strength. Frogs, the giant toad and the lion leap; vampires climb. The night hag and the succubus go ethereal; the oni takes a humanoid form with its smaller glaive; the imp and the quasit take their beast forms. Fiendish Resilience offers one choice per damage type, and the Dagger of Venom coats its blade once a dawn.

## Audit fixes (0.399.0)

Fourteen actions the source prints without their recharge now recharge as the SRD says. A dragon's, the tarrasque's and the nalfeshnee's Multiattack opens with Frightful Presence or Horror Nimbus when it is ready. Frightful Presence, Horrifying Visage, Disrupt Life, Blasphemous Word, Moan, Horror Nimbus, Stunning Screech, Lightning Strike and Blinding Spittle are bursts that catch every creature in range, with the type, sight and hearing tests their sentences print. Disintegrate, False Life and Wall of Fire scale with the slot.

## Your own words on the sheet and the menu (0.398.0)

With Capability API 1.378: only the 14 SRD conditions and seven common states (Blessed, Baned, Shielded, Hasted, Slowed, Dodging, Raging) are offered in the Add condition picker; the spells list gets its own Spells tab grouped Cantrips to 9th level with a Prepared tick, and spells sit under Spells on the fight menu by level; slot costs read "1 3rd-level slot"; the hooded lantern, flame tongues, the sun blade and other switches name their moves, and thrown flasks, caltrops, ball bearings, poisons and the healer's kit name their use; Fey Ancestry and the other race save advantages read in plain words; Concentrating on shows only for a character with a concentration spell, Pact weapon only for Pact of the Blade, and Back from the dead only once it is set; bonuses show their sign; and a creature's traits run in full, a long one split in two.

## Clearer sheets and stat blocks (0.397.0)

From the UI review: the guided builder's Subrace step now writes a new Subrace field (High Elf, Lightfoot), each race's Info opens with its ability increases, size, speed, darkvision and named traits, a creature's Spellcasting trait lists every spell in short words instead of cutting off with "See the SRD", Sleep's condition reads Magical sleep, and only a wizard sees the Prepared spells step.

## Undead and fiends never yield (0.396.0)

A ghoul, a vampire spawn or a devil whose morale breaks now always flees, never surrenders (Capability API 1.785).

## The hungry (0.395.0)

Crocodiles, Giant Crocodiles, the Ankheg, the Roper and the Grick are hungry (Capability API 1.784): they keep at one victim, grab hold, and haul a held victim away from everyone before striking again.

## The honourable (0.394.0)

The Knight, the metallic dragons and the celestials are honourable (Capability API 1.783): they go for whoever last hurt them, then a foe beside them, and never strike the routed, downed or surrendered. Metallic dragons are no longer arrogant.

## The cruel (0.393.0)

Ghouls, Ghasts, the hags and the devils are cruel (Capability API 1.782): they finish off the weak and favour grapples and frights; they strike the fallen only where the game's setup allows it.

## Guardians (0.392.0)

Clay, Flesh, Iron and Stone Golems and the Treant are territorial (Capability API 1.781): they hold the ground where the fight starts (the Treant 60 feet of its grove), strike anyone on it, and leave only to chase whoever hurt them from afar.

## Arrogance (0.391.0)

True dragons, the Lich and the Vampire are arrogant (Capability API 1.780): careless, holding back their best, until bloodied or one of their side falls, when they turn methodical. A legendary arrogant flier takes to the air when nearly beaten.

## Temperaments that turn (0.390.0)

True dragons, the Lich and the Vampire start opportunistic and turn methodical once bloodied; any creature cornered below a quarter of its hit points turns reckless (Capability API 1.779).

## Fanatics and soldiers (0.389.0)

The Cult Fanatic and Cultists are fanatical (Capability API 1.778): they hit as hard as they can, stand by their side and never check morale. Guards and Knights are disciplined: they keep formation and follow their leader's target.

## Bodyguards (0.388.0)

Guards stay beside the leader they serve, and cultists and Shield Guardians beside their leader or caster, going first at whoever is on them (Capability API 1.777).

## Combat roles (0.387.0)

The lich is a solo (Capability API 1.776), still going for casters. The Imp, Quasit, Phase Spider, Harpy and Blink Dog are skirmishers and the Knight a bulwark. The Ghost and Invisible Stalker wait in ambush.

## The full morale variant (0.386.0)

Morale (Capability API 1.775) now checks on a surprised turn, on a turn with no way to harm the other side, when first hurt to half, when the leader drops, and when half the group falls without the other side losing anyone.

## Combat minds and morale (0.385.0)

Eleven animal-like monstrosities (Ankheg, Basilisk, Bulette, Cockatrice, Darkmantle, Gorgon, Griffon, Hippogriff, Hydra, Purple Worm, Rust Monster) now fight by instinct instead of mindlessly; the Homunculus is cunning; the object type is mindless; morale also triggers when half a side is down; the Noble, Veteran, Priest and Archmage lead.

## The captain's two daggers (0.384.0)

The bandit captain can now make its Multiattack at range as the SRD allows: two thrown daggers (Multiattack (ranged)) beside two scimitar strikes and a dagger (Multiattack (melee)).

## Command (Approach) (0.383.0)

Command's plain entry now holds only its words: Approach, Drop, Flee, Grovel and Halt are each a choice in a fight, so the plain button that cast Approach is now named Command (Approach). A Spell Scroll of Command still casts Approach.

## The subclass on the sheet (0.382.0)

The guided builder now has a Subclass step: each class's SRD subclass (Life Domain, Champion, Circle of the Land and the rest) is taken from the level the class chooses it and written to the Subclasses field (Capability API 1.773), and shows on the Features list.

## Improvements taken by default (0.381.0)

Each class's Ability Score Improvement is now its group's default: the class features step takes it with the level, and picking a feat in its place still replaces it. A non-ranger's sheet no longer shows the ranger's favored enemies and terrain.

## Help beside a foe (0.380.0)

The Help action now follows SRD 5.1: you can help only while a foe is within 5 feet of you, and your ally's advantage applies only to an attack against a foe who was beside you when you helped.

## Spells cast several ways (0.379.0)

A family of entries such as "Magic Circle (fiends)" or "Wish: Heal" beside a plain "Magic Circle" or "Wish" is that spell's `variants` (Capability API 1.769): each names the plain entry in `variantOf`, the builder and catalog offer only the plain one, and its sheet row casts any variant in a fight, off the same row. 22 spells have them; Alter Self, Antipathy/Sympathy and Enhance Ability get a plain entry with no mechanics (`alter-self-spell`, `antipathysympathy-spell`, `enhance-ability-spell`) since every casting of them is a choice. `combat.cover.groundUnderTarget: false` (1.770): SRD 5.1's cover is an obstacle between, so woods and ruins under the target no longer give it half cover.

## Domain, oath and circle spells (0.378.0)

SRD 5.1, Life Domain: "you always have it prepared, and it doesn't count against the number of spells you can prepare each day." The Life Domain Spells, Oath Spells and Circle Spells tables are read off the features' own text; each spell they name lists the feature that grants it and `of_<class>` in `granted_ids`, beside a wizard's spellbook classes (a catalog has at most 8 filters). The guided builder's Domain, oath and circle spells step (`takesAll`, Capability API 1.766) takes every one a picked feature grants, up to `granted_level_of_<class>`, stamped with the class and prepared. A Circle of the Land druid picks the land at the Class features step: Arctic, Coast, Desert, Forest, Grassland, Mountain or Swamp, one each (`exclusive`). The source tags a spell with every class that casts it through any Player's Handbook subclass; the cleric, warlock and druid lists are trimmed back to SRD 5.1's (the Fiend's expanded spells, the SRD's own patron, stay on the warlock's), and Plane Shift joins the druid's.

## Starting weapons in hand, hit points in the summary (0.377.0)

Starting gear lines for a class's weapons say `equip: true`: the ones picked at a choice, or the fixed ones where no choice offers a weapon, and no stack over two. The Engine puts each on where its slots are still free, in order, so a fighter's longbow and a later martial weapon do not both fit two hands. `gm.sheetSummary.derived` reads `hp_max_total` after the level.

## A wizard prepares from the spellbook (0.376.0)

SRD 5.1, Wizard, Preparing and Casting Spells: "choose a number of wizard spells from your spellbook equal to your Intelligence modifier + your wizard level (minimum of one spell)". The guided builder's Spellbook step (`granted_ids`, counted by `wizard_spellbook`) puts a wizard's spells on the Spells list unprepared, and its Prepared spells step (`kind: "mark"`, Capability API 1.767; the 25 steps and a spellbook of up to 44 need 1.768) ticks `prepared` on `spells_prepared_wizard` of the wizard's leveled spells. Cantrips are always ready. The Spells step reads `known_ids`, every class but the wizard, and stamps those prepared (0.373.0). A wizard multiclassed with another caster picks that class's spells there and the wizard's in the spellbook.

## Class features come with the class (0.375.0)

The Class features step takes every feature a character's levels give without asking (`takesAll`, Capability API 1.766), each read against its own class's level (`upTo.per`, `level_<class>`), so a multiclass character gets each class's features to its own level. The step waits only on a real choice: at each Ability Score Improvement level, the improvement or the Grappler feat in its place. The SRD has one subclass for each class, and that subclass's features come with the class at their levels; a character playing another subclass removes them from the sheet.

## Prone when unconscious, and zones you walk into (0.374.0)

An unconscious creature "falls prone" (SRD 5.1, Conditions): unconscious, and the magical sleeps of Sleep, Eyebite, the brass dragon's breath, the sprite's arrows, the drow's poison, oil of taggit, couatl venom and Imprisonment's slumber, now put prone on with it (`alsoApplies`, Capability API 1.765), and it stays prone after it wakes or is healed until it spends half its movement to stand. Spirit Guardians, Moonbeam, Cloudkill and Incendiary Cloud harm a creature that "enters the spell's area" (`enterOnlyByMoving`, 1.764): one that walks or is moved in, not one the area comes onto as its caster walks, moves the beam or the cloud drifts; it still harms a creature that starts or ends its turn there. The definition's own version is now the package's minor (374), so an Engine with an earlier release installed takes this one over it.

## Builder spells come prepared (0.373.0)

The guided builder's Spells and Magical Secrets steps stamp each spell they add as prepared. A cleric, druid or paladin picks exactly as many as they prepare, and a bard, ranger, sorcerer or warlock always has their known spells ready, so every one is castable in the first fight. A wizard's whole starting spellbook comes prepared; untick those not prepared today. Spells added later, a scroll copied into a spellbook, start unprepared as before.

## Creature behaviour (0.372.0)

A hundred stat blocks carry a `behavior` (Capability API 1.763), read off what they print where the SRD says it: a creature with Pack Tactics or Martial Advantage goes for whoever a friend stands beside, one with False Appearance, a camouflage, Ambusher, Surprise Attack or Shadow Stealth lies hidden until prey comes close or it is hurt, and a breath weapon is what a creature opens with. The rest is the monsters' lore: dragons go for spellcasters, wolves, jackals and hyenas for the wounded, goblins for the weakest and cowardly, hobgoblins disciplined, ghouls and ghasts lurk, mages, archmages and liches control and go for casters, and priests and acolytes support. Mindless creatures ignore all of it, and a Game Master's temperament for a fight wins.

## Morale (0.371.0)

Morale (Capability API 1.762), the Dungeon Master's optional variant rather than an SRD rule: combat.morale tests a creature with a DC 10 Wisdom save when its leader falls (the bandit captain, the knight and the cult fanatic are leaders) and when it first drops to half its hit points. One that fails flees to the board's edge and leaves the fight, or surrenders if it is cunning, tactical or a genius and a foe stands beside it. Mindless and called creatures, and any that can't be frightened, never check.

## Creature minds (0.370.0)

Each creature fights with a mind (Capability API 1.761). Beasts are instinct and constructs and oozes mindless by their type; zombies, ogre zombies, skeletons, minotaur skeletons and warhorse skeletons are mindless by their own stat block; every other creature by its Intelligence through combat.minds: mindless at 1 or 2, cunning from 3, tactical from 8 and a genius from 15, a legendary tactician being a genius.

## Wish's immunity, X-ray Vision's limits and Creation (0.369.0)

Wish's last menu use, immunity to a single spell or other magical effect for 8 hours, picks the spell or creature action as it is cast and wards up to ten creatures off it (Capability API 1.758). The Ring of X-ray Vision's sight goes through 12 inches of stone, 1 inch of metal and 36 inches of wood or dirt, and Wall of Stone says it is 6 inches of stone, so the ring sees through it; walls of no named material, and the board's own walls, stop it (1.759). Creation makes a Created object lasting by its material, chosen as it is cast, and Goodberry's berries vanish 24 hours after the spell (1.760).

## Wish's other uses and its stress (0.368.0)

Needs Capability API 1.757: Strength lowered and days rolled (1.756) and heals of all one is missing (1.757).

## Forbiddance's choices, Magic Circle's ward and the vampire's forms (0.367.0)

Needs Capability API 1.755: Forbiddance names its kinds and picks its damage type as it is cast (1.753), the vampire carries fifteen actions (1.754), and Magic Jar's target test reads who stands in a Magic Circle (1.755).

## Magic Jar (0.366.0)

The container offers Possess and Return to Your Body; the possessed host fights on the caster's side and can end the possession as an action.

## Pale tincture, midnight tears and climbing gloves (0.365.0)

Pale tincture and midnight tears are given to a creature within 5 feet as the other ingested poisons are. Pale tincture's DC 16 save, failed, deals 1d6 poison and leaves the creature poisoned; after the fight its save is made each time a day passes (`saveEnds` at days with `successes` 7 and `harmsOnFail` 1d6 poison, Capability API 1.750), and the damage it deals stays off healing until it ends (`keepsDamage`). Midnight tears do nothing in the fight; at the next midnight (`lastsDays: "midnight"`, 1.751) the creature makes a DC 17 Constitution save against 9d6 poison, half on a success, unless it was cured first (`onEnd.when` expired). Gloves of Swimming and Climbing add +5 to an Athletics check the Game Master makes `for="climb"` or `for="swim"` (1.752). The manifest declares Capability API 1.752.

## Contingency (0.364.0)

Contingency's material, an ivory statuette worth 1,500 gp, is a worn item in two kinds, Contingency statuette (when downed) and (when harmed): `stores` one spell of 5th level or lower with `castsOn` (Capability API 1.569), cast on its wearer by itself, for nothing, the first time they drop to 0 hit points or take damage. The Game Master stores the contingent spell in it as Contingency is cast, with standing's `into`, as the rules reference says.

## Forbiddance (0.363.0)

Forbiddance, cast before a fight, is a 200-foot square around its caster lasting the day (a zone that outlasts its caster): a celestial, elemental, fey, fiend or undead takes 5d10 radiant damage when it enters or starts its turn there. The caster's side knows the password and is spared. Choosing fewer kinds or necrotic damage, and its bar on teleporting into the area, are not offered yet.

## A rules reference for the Game Master (0.362.0)

The ruleset now carries a `gmReference` (Capability API 1.145), the rulings the Engine leaves to the Game Master: when to mark a side surprised (a creature with False Appearance that kept still), how contact and ingested poisons are delivered out of a fight and what a partial dose does, midnight tears and pale tincture, the +5 to climb or swim from Gloves of Swimming and Climbing, manacles, what the Ring of Telekinesis may lift, and the Anchor, Fan, Swan Boat and Tree feather tokens.

## Contact and ingested poisons (0.361.0)

A dose of a contact or ingested poison is put to a creature within 5 feet as an action (smeared on its skin, or given to it), and it makes the poison's Constitution save: assassin's blood (DC 10, 1d12 poison and poisoned for 24 hours, half and not poisoned on a success), crawler mucus (DC 13, poisoned and paralyzed for 1 minute, saving again at the end of each of its turns), oil of taggit (DC 13, poisoned and unconscious for 24 hours, waking if it takes damage), torpor (DC 15, poisoned and incapacitated for 4d6 hours) and truth serum (DC 11, poisoned for 1 hour and unable to knowingly lie). Midnight tears and pale tincture work on a clock no fight keeps and stay with the Game Master. The mummy lord's Blinding Dust is a burst around it, catching every creature within 5 feet.

## The Necklace of Prayer Beads (0.360.0)

Each Necklace of Prayer Beads is found with 1d4 + 2 magic beads, their kinds rolled on the SRD's d20 (`moreUsesRolled`, Capability API 1.746): blessing (Bless), curing (Cure Wounds at 2nd level, or Lesser Restoration off the same bead, `usesOf`, 1.747), favor (Greater Restoration), smiting (Branding Smite), summons (Planar Ally) and wind walking (Wind Walk). Worn, each bead casts its spell as a bonus action with its wearer's spell save DC, and can't again until the next dawn. A summons bead's Planar Ally brings a celestial, elemental or fiend rolled for its user, the deity's choice, which stays until dismissed (`calls.rolled` from a catalog, 1.748). The necklace has no use but its beads (1.749). The manifest declares Capability API 1.749.

## Breaking Dimensional Shackles (0.359.0)

A creature bound by Dimensional Shackles can spend its action on a DC 30 Strength (Athletics) check: on a success it breaks free and the shackles are destroyed; a failed try is not offered again for a day.

## The ebony fly (0.358.0)

The ebony fly figurine, thrown with an action, becomes a giant fly (`giant-fly` in the creature catalog) for up to 12 hours, friendly and ridden as a mount, and can't be used again until 2 days have passed. The giant fly is the stat block SRD 5.1 prints beside the figurines: a Large beast, AC 11, 19 hit points, 30 feet walking and 60 flying, darkvision 60 feet, with no attacks, carrying 420 pounds. The onyx dog's mastiff (`onyx-dog-mastiff`) has Intelligence 8, speaks Common, and has darkvision 60 feet that also sees invisible creatures.

## The harpy's song kept up (0.357.0)

The harpy's Luring Song now lasts until the song ends rather than a minute of concentration: the harpy keeps it up with a bonus action on each of its later turns (`sustains` on a creature action's area, Capability API 1.727), and the lured stay lured until the end of the harpy's next turn once it does not.

## The Goodberry scroll (0.356.0)

A Spell Scroll of Goodberry, read with an action, puts ten berries (`goodberry` in the magic item catalog) into its reader's hand, as the spell does, and is used up (an item use's `makesItems`, Capability API 1.745). Until 0.356.0 the scroll was text. The manifest declares Capability API 1.745.

## The Ring of X-ray Vision (0.355.0)

The Ring of X-ray Vision's action gives its wearer X-ray Vision for a minute: a sense out to 30 feet that sees through walls and solid matter (`senses`, twelve senses since 1.743). Using it again before a long rest asks a DC 15 Constitution saving throw, and a failure adds a level of exhaustion (`againBeforeRest`, 1.744). The manifest declares Capability API 1.744.

## The chain devil's grapple, the ice devil's wall and the Dancing Sword's return (0.354.0)

Needs Capability API 1.742. The chain devil's Chain grapples (and restrains and barbs) its target only while the devil grapples nobody else (`applies[].unlessImposing`, 1.740). The ice devil's Wall of Ice ends as soon as the devil is incapacitated or dies (creature `zone.endsWithCaller`, 1.741). A Dancing Sword returns to its wielder's hand once it has attacked four times (`calls.endsWhenSpent`, 1.742).

## A flask of oil poured and lit (0.353.0)

A flask of oil can also be poured on the ground and lit with an action: a 5-foot square within 5 feet burns for 2 rounds, dealing 5 fire damage to any creature that enters it or ends its turn there (a lasting `zone`), once a turn. Throwing it is its Throw.

## The Feather Token (Bird) (0.352.0)

The Feather Token (Bird), tossed with an action, is spent and calls an enormous bird (`feather-token-bird` in the creature catalog): a roc's statistics with no attacks, ridden as a mount carrying 500 pounds at full speed and up to 1,000 at half (`mountCarries`, Capability API 1.641), for up to 12 hours, its day of flying, or until dismissed with an action.

## The Mirror of Life Trapping (0.351.0)

Each action speaking the Mirror of Life Trapping's command word catches everybody but its user within 30 feet who can see it: a DC 15 Charisma save or they are trapped, sent out of the fight for good (`dismisses`); constructs always succeed. The GM frees them, and the mirror's twelve cells, its advantage for those who know it and its staying active stay theirs.

## The Helm of Comprehending Languages and the Cloak of the Manta Ray (0.350.0)

The Helm of Comprehending Languages casts Comprehend Languages on its wearer with an action, at will, the spell's hour of understanding every spoken language (`comprehending`). The Cloak of the Manta Ray's wearer breathes underwater (worn `keepsOn` `water_breathing`) beside its 60-foot swimming speed, the hood taken as up.

## The Helm of Brilliance's rolled gems (0.349.0)

The Helm of Brilliance is found with its 1d10 diamonds (its charges, `charges.rolled`, Capability API 1.573), 2d10 rubies, 3d10 fire opals and 4d10 opals (each a use counting its own, `uses.rolled`, 1.536), rolled once for each helm, where it held their averages, 5, 11, 16 and 22, before.

## The Necklace of Fireballs (0.348.0)

The Necklace of Fireballs is found with 1d6 + 3 beads (`charges.rolled`, Capability API 1.570). An action throws one up to 60 feet as a 3rd-level Fireball, save DC 15, or more of them together, a level higher for each bead beyond the first, up to 9th (`chargeStep`, 1.269). A detached bead stays its own consumable.

## Simulacrum's duplicate (0.347.0)

Simulacrum's duplicate joins the party: "it has half the creature's hit point maximum and is formed without any equipment." The Game Master's guidance asks, once the spell is finished, for the party change command with copy_of the one it copies and the new simulacrum condition, which the Engine (from Capability API 1.726) adds as a fresh copy of that member's card and sheet with none of their items. The condition halves its hit point maximum. The command also takes a beast or a humanoid from the bestiary who is not in the party. The guidance also asks the Game Master to set Back from the dead to 4 when Raise Dead or Resurrection returns a character.

## The Dwarven Thrower's dwarf (0.346.0)

"Requires attunement by a dwarf": the Dwarven Thrower's binding needs a Race naming a dwarf (Dwarf, Hill Dwarf), read as words by a new hidden derived value, `race_dwarf` (Capability API 1.667 and 1.690). Bound by anybody else it reads as not worn.

## Back from the dead (0.345.0)

Raise Dead and Resurrection put four levels on a new sheet track, Back from the dead (`returned_from_death`, 0 to 4): "The target takes a -4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1 until it disappears." Each level is -1 to attack rolls, saving throws and ability checks, and each long rest takes one off. The Game Master sets the track by hand for a return the package does not cast.

## Ghouls and elves (0.344.0)

A ghoul's Claws pass over elves as written: "If the target is a creature other than an elf or undead". Drow carry a new creature tag, elf, and a character carries it whenever their Race names an elf (High Elf, Elf), read off the Race field beside the Alignment field (`combat.creatureTypes.tagsFrom`, Capability API 1.713); a half-elf is not an elf. The objects the package makes up, which print no checks, now give every check at +0.

## The Dancing Sword (0.343.0)

Each Dancing Sword (greatsword, longsword, rapier, shortsword) is tossed into the air with a bonus action and becomes a hovering sword out of its wielder's hands (not an SRD stat block: a Tiny steel object, AC 19, 5 hit points, flying 30 feet). It attacks with its wielder's attack roll and ability modifier for that sword, a rapier or shortsword with Strength or Dexterity, the first attack free and each later one the wielder's bonus action, four in all. It stops hovering when its wielder takes it back or moves more than 30 feet away. Since 0.354.0 it flies back to its wielder's hand after the fourth attack (`calls.endsWhenSpent`, 1.742). The sheet holds 408 derived values, which needs Capability API 1.729.

## The ice devil's Wall of Ice (0.342.0)

The ice devil lays its Wall of Ice as written: a 30-foot wall or a 20-foot dome, 10d6 cold (Dexterity 17 halves) to whoever is caught as it rises, ice sections of AC 5 and 30 health that fire hurts more, and frigid air (5d6 cold, Constitution 17 halves) where one breaks. Needs Capability API 1.728.

## The ivory goat of terror (0.341.0)

Needs Capability API 1.739. Once the Figurine of Wondrous Power's goat of terror stands, its user may take each horn in hand with an action: a +1 lance and a +2 longsword, wielded until the goat reverts. While someone rides the goat, each creature hostile to the rider that starts its turn within 30 feet makes a DC 15 Wisdom save or is frightened of the goat for a minute, saving again at the end of each of its turns, immune for a day once it saves; the fright ends when the goat is gone.

## Magical Secrets cantrips (0.340.0)

Needs Capability API 1.739. The guided builder's Magical Secrets step offers cantrips from any class's list beside spells of a level the bard can cast.

## The scroll of Counterspell (0.339.0)

Needs Capability API 1.739. A Spell Scroll of Counterspell is read as a reaction when a creature within 60 feet casts a spell: it stops a spell of 3rd level or lower outright, and a higher one on the reader's spellcasting check against 10 plus that spell's level. Reading it above one's own slots still takes the scroll's check against 13.

## The chain devil's chains and Defender (0.338.0)

Needs Capability API 1.739. The chain devil's Chain grapples and restrains, and its barbs deal 2d6 piercing damage at the start of each of the victim's turns until the grapple ends. Animate Chains (once a fight) brings four animated chains (AC 20, 20 hit points) within 60 feet; each makes one chain attack only when the devil uses its Multiattack, none while it grapples, and all of them go when the devil is incapacitated or dies. Defender, before its wielder's first attack on a turn, moves 1 to 3 of its bonus to their Armor Class until their next turn.

## Shocking Grasp, Comprehend Languages, the feather token whip and the Helm of Brilliance (0.337.0)

Needs Capability API 1.739. Shocking Grasp's attack has advantage against a creature wearing metal armor; fourteen stat blocks (the knight, guard, veteran, hobgoblin and others) wear the metal armor their stat blocks name. Comprehend Languages leaves its caster understanding every spoken language for an hour. The feather token's whip ends when the one who called it is incapacitated. The Helm of Brilliance keeps fire resistance only while a ruby is left, and its fire aura only while any gem is left.

## The rakshasa's curse and the tarrasque's carapace (0.336.0)

The rakshasa's Claw curses a creature it hits (`rakshasa_cursed`, a curse): while it lasts, a short or long rest does nothing for them (`blocksRests: "all"`, Capability API 1.722), until remove curse or similar magic ends it. The tarrasque keeps `reflective_carapace` on: a foe's Magic Missile, line spell or spell with a ranged attack roll aimed at it rolls a d6 instead, leaving it untouched, and on a 6 turns back at its caster as their target (`reflects`, 1.723).

## Goodberry (0.335.0)

Goodberry cast in a fight puts ten berries (`goodberry` in the magic item catalog) into its caster's hand (`makesItems`, Capability API 1.721); eating one is an action and restores 1 hit point, and what is left goes to their bag after the fight. Outside a fight the Game Master hands the berries over, and keeps the day after which they lose their potency, as with an enemy caster without a sheet.

## Horseshoes and Dwarven Plate (0.334.0)

Horseshoes of Speed and Horseshoes of a Zephyr are worn by a rider (a worn slot) and go on the creature they ride (`worn.wornBy: "mount"`, Capability API 1.717): the speed shoes give it 30 more feet of walking speed, the zephyr shoes let it walk on water and lava and ignore difficult terrain. Dwarven Plate keeps `dwarven_plate_braced` on its wearer: moved against their will along the ground, they spend their reaction to go 10 feet less (`pushReducedBy`, 1.718).

## The ankheg's Acid Spray and the bulette's leaps (0.333.0)

The ankheg's Acid Spray is offered only while it grapples nobody (`unlessImposing`, Capability API 1.715). The bulette jumps 30 feet long and 15 high with or without a running start (creature `jump`, 1.716), and its Deadly Leap lands it, after a jump of at least 15 feet, on a space others fill: each makes a DC 16 Strength or Dexterity save, whichever is better (`save.or`, 1.724), taking 3d6 + 4 bludgeoning and 3d6 + 4 slashing damage and falling prone on a failure, half on a success and set down beside it, or prone where it stands with no room (`leapsOnto`, 1.725).

## Vampires and running water (0.332.0)

The vampire and the vampire spawn keep on `running_water_harmed`: ending a turn in running water deals them 20 acid damage. A board's water tiles count as running water, as does a lasting area named running water (`heldOnlyIn.ground`, Capability API 1.714).

## Hideous Laughter's save on damage (0.331.0)

Hideous Laughter puts `laughing` on its target, which ends on a Wisdom save at the end of each of its turns and also each time it takes damage, that save with advantage (`saveWhenDamaged: {"lean": "advantage"}`, Capability API 1.712). Its prone and incapacitated end with it.

## Spells cast with a bonus action (0.330.0)

Once a character has cast a spell with a bonus action on their turn, the only spell they are offered for the rest of that turn is a cantrip with a casting time of 1 action; and once they have cast a leveled spell some other way, no bonus-action spell (`combat.casting.afterBonusSpell`, Capability API 1.710). Scrolls count, and a Quickened spell counts as a bonus-action one.

## Massive damage and knocking out (0.329.0)

Instant Death: when damage drops a character to 0 hit points and what is left over is at least their hit point maximum, they die outright (`dying.instantDeath`, Capability API 1.709). Knocking a Creature Out: every character has a free switch, "Knock out", that pulls their blows; while it is on, a melee attack of theirs that drops a creature to 0 knocks it out instead, unconscious and stable (`dying.knockOut`, 1.720). The Magical Secrets derived value now sits at the end of the list, as new derived values do.

## Attacks against elementals and demons (0.328.0)

A Ring of Elemental Command's wearer has advantage on attack rolls against elementals of its linked plane, and Demon Armor's wearer disadvantage on attack rolls against demons (a worn `attacks` modifier `at` a tag, Capability API 1.726). The manifest declares Capability API 1.726.

## The ivory goats (0.327.0)

The Figurine of Wondrous Power (Ivory Goats) is three figurines. The SRD id is the goat of travail: a giant goat for up to 3 hours, once in 30 days. The goat of traveling (`figurine-of-wondrous-power-ivory-goat-of-traveling`) has 24 charges, each calling a riding horse for an hour, and they all come back 7 days later. The goat of terror (`figurine-of-wondrous-power-ivory-goat-of-terror`) becomes a giant goat for up to 3 hours, once in 30 days, that can't attack but carries its rider (`ivory-goat-of-terror` in the creature catalog). While it is called its rider wields its horns, a +1 lance and a +2 longsword (`wieldsWhileCalled`, 1.739), and while ridden it keeps an aura of terror, DC 15 Wisdom (`goat_of_terror_aura`, aura `whileRidden`, 1.735).

## The elemental rings' disadvantage (0.326.0)

Elementals of a Ring of Elemental Command's linked plane have disadvantage on attack rolls against its wearer (a worn `attacks-taken` modifier `from` the plane's tag, such as `fire_elemental`). Its wearer has advantage on attack rolls against them (a worn `attacks` modifier `at` the same tag, Capability API 1.726).

## The Feather Token whip (0.325.0)

The Feather Token (Whip), thrown with an action to a point within 10 feet, is spent and calls a floating whip for an hour (`feather-token-whip` in the creature catalog): a Tiny object of AC 11 and 5 hit points that flies 20 feet and hovers, immune to poison and psychic damage. Its owner commands it with a bonus action to fly and lash a creature within 10 feet of it, +9 to hit for 1d6 + 5 force damage, and dismisses it with an action. It vanishes when its owner is incapacitated or dies (the call's `endsWithCaller`, Capability API 1.733).

## Dimensional Shackles (0.324.0)

Dimensional Shackles go with an action on an incapacitated creature of Small to Large size within reach. Bound, it casts none of the SRD's spells that teleport or cross planes, from Misty Step and Dimension Door to Plane Shift, Etherealness and Gate (`dimensionally_shackled`, a condition's `forbids.entries`, Capability API 1.646), and anyone beside it can take the shackles off with an action. Since 0.359.0 the bound creature can try a DC 30 Strength (Athletics) check with its action to break free, destroying the shackles, and a failed try is not offered again that day, as near to "once every 30 days" as a fight's count holds (`checkEnds` with `spendsItem`, Capability API 1.636). A creature's own teleporting actions and their use as mundane manacles stay the GM's.

## The Rings of Elemental Command (0.323.0)

The Ring of Elemental Command comes as a ring for each Elemental Plane, and again for each once its wearer has helped slay that plane's elemental: 5 charges, 1d4 + 1 back at dawn, save DC 17. Each spends 2 charges to cast Dominate Monster on its plane's elemental only (four new creature tags, `air_elemental` to `water_elemental`, one on each SRD elemental). The air ring's wearer falls safely and, once an air elemental is slain, resists lightning and flies at walking speed, hovering, and casts Chain Lightning, Gust of Wind and Wind Wall. The earth ring's slayer resists acid and casts Stoneskin and Wall of Stone. The fire ring resists fire, and its slayer is immune to fire and casts Burning Hands, Fireball and Wall of Fire. The water ring walks on water, and its slayer also swims at walking speed and breathes water, and casts Ice Storm and Wall of Ice, and since 0.415.0 Control Water for 3 charges. Each ring gives advantage on attacks against its plane's elementals, and they have disadvantage on attacks against its wearer (modifiers `at` and `from`, 1.726 and 1.185). Stone Shape, Create or Destroy Water, earth's rubble and earth gliding, and the languages stay the GM's. The plain ring stays for the GM to pick a plane.

## The Helm of Brilliance (0.322.0)

The Helm of Brilliance casts its gems' spells at DC 18 with an action, each gem gone once used: Prismatic Spray from its diamonds (the helm's 5 charges), and Daylight, Fireball and Wall of Fire from its opals, fire opals and rubies (22, 16 and 11, each a use counting its own, Capability API 1.519). Those are the averages of its 1d10, 2d10, 3d10 and 4d10; the Game Master may set the helm's counts to the dice. Its wearer resists fire, every undead that starts its turn within 30 feet takes 1d6 radiant damage (`brilliance_radiance` spreading `brilliance_seared`), and with an action a held weapon bursts into flames, adding 1d6 fire damage to weapon hits and lighting 10 feet until a bonus action puts it out (`brilliance_blaze`). Resistance and radiance stay on after the last ruby or diamond is spent (worn effects that end with a use's count are asked), the dim light that shows undead stays the GM's, and so does the d20 roll that bursts the helm when a spell's failed save burns its wearer.

## The Helm of Telepathy's Suggestion (0.321.0)

The Helm of Telepathy casts Suggestion (save DC 13) with an action, once a dawn. Its Detect Thoughts and telepathic messages stay the GM's, so the helm's Suggestion is not kept to a creature its wearer is reading.

## Magical Secrets (0.320.0)

The guided builder asks a bard for Magical Secrets: two spells from any class's list at 10th, 14th and 18th bard level, and two more at 6th for the College of Lore (Additional Magical Secrets), each of a level the bard can cast (a new derived value, `magical_secrets`). A spell picked goes on the spell list as a bard spell, cast with Charisma. A cantrip from another class waits on a builder step offering spells and cantrips together (asked), so the Game Master adds one in All fields. The sheet now holds 400 derived values, the Engine's most (a higher cap asked).

## The couatl's venom (0.319.0)

The couatl's Bite poisons a creature that fails its DC 13 Constitution save for 24 hours, and it lies unconscious until the poison ends (`couatl_venom_sleep`, which ends with the poison). Damage does not wake it; another creature beside it can spend an action to shake it awake (`shakeOff`), and it stays poisoned.

## Scrolls of reaction spells (0.318.0)

A scroll of Shield, Feather Fall or Hellish Rebuke is read as the spell's own reaction, when its moment comes (an attack hits, a creature falls, its reader is harmed), not with an action on its reader's turn (an item use's `reaction`, Capability API 1.322): SRD 5.1, Activating an Item, "The spell uses its normal casting time". A scroll of Counterspell is read as a reaction that cancels a spell of up to 3rd level (an item use's `level` and the reaction's `cancels`, 1.730).

## Armor proficiency (0.317.0)

Armor or a shield worn by a character not trained in it keeps a condition on while worn (`armor_untrained`, an unmet `requires` with `keepsOn`, Capability API 1.513): disadvantage on every attack roll, ability check and saving throw that uses Strength or Dexterity, and no spellcasting. Training comes off class levels, as two new derived values work out (`light_armor_levels`, `shield_levels`) with the two from before: light armor from Bard, Cleric, Druid, Fighter, Paladin, Ranger, Rogue or Warlock levels, or Barbarian as the first class; medium armor as before; heavy armor from Cleric levels (Life Domain), or Fighter or Paladin as the first class; shields from Barbarian, Cleric, Druid, Fighter, Paladin or Ranger levels. A sheet with no first class set (one made without the builder's Class step) counts each of its classes as a first one. Magic armor and shields ask the same as the armor they are made of; mithral drops only the Strength rule. A class the package does not know (other levels) is trained in nothing, so the Game Master removes armor that it should be allowed.

## The obsidian steed's disobedience (0.316.0)

The Figurine of Wondrous Power (obsidian steed) rolls a 10 percent chance, each time a good character uses it, that its nightmare ignores every order, including the command to turn back into a figurine. The sheet reads good or evil off the character's alignment. Riding it off to Hades stays the GM's.

## The Ring of Animal Influence and Phantom Steed (0.315.0)

The Ring of Animal Influence has 3 charges (1d3 back at dawn), each casting Animal Friendship or Fear at DC 13. Its Fear reaches only beasts with an Intelligence of 3 or lower. Speak with Animals stays text.

Phantom Steed calls a phantom steed for an hour: a riding horse with a speed of 100 feet, dismissed with an action. It has one hit point, as "the spell ends ... if the steed takes any damage".

## Serpent venom, inhaled poisons and a flask of oil (0.314.0)

Serpent venom coats a piercing or slashing weapon as the other injury poisons do: the next creature it wounds makes a DC 11 Constitution save, taking 3d6 poison damage, or half on a success (`poison_serpent`).

The three inhaled poisons are blown into a 5-foot cube beside their user, each creature in it making a Constitution save. Burnt othur fumes (DC 13) deal 3d6 poison damage, then 1d6 at the start of each of the creature's turns while it fails, ending after three made saves (`burnt_othur`). Essence of ether (DC 15) leaves a creature poisoned and asleep for 8 hours, waking if hurt or shaken. Malice (DC 15) leaves it poisoned and blinded for an hour. Contact and ingested poisons need a touch or a meal and stay the GM's.

A flask of oil thrown up to 20 feet (an improvised ranged attack) covers its target in oil for a minute (`oiled`): each time it takes fire damage, it takes 5 fire damage more. Oil poured on the ground and lit stays the GM's.

## The harpy's Luring Song and the kraken's Ink Cloud (0.313.0)

The harpy's Luring Song reaches every humanoid and giant within 300 feet that can hear it. On a failed DC 11 Wisdom save they are lured (`harpy_lured`): charmed and incapacitated, moving toward the harpy until within 5 feet, and saving again whenever they take damage and at the end of each of their turns. A creature that saves is spared until its next long rest. Since 0.357.0 the harpy keeps singing with a bonus action on each later turn (`sustains`, Capability API 1.727), and the song ends once it does not, as when it is incapacitated; saving before damaging terrain stays the GM's.

The kraken's Ink Cloud, a legendary action, spreads 60 feet around it and around corners. It is heavily obscured for everyone but the kraken, and whoever else ends a turn in it makes a DC 23 Constitution save, taking 3d10 poison damage, or half on a success. It lasts until the end of the kraken's next turn. Whether it is underwater, and a current that disperses it, stay the GM's. Until an Engine fix lands, a legendary action lays no cloud, so the poison lands at once on everyone in it instead.

## Domination as a charm, Demon Armor, and wards against divination (0.312.0)

A dominated creature also counts as charmed (`countsAs`), as the spells say "or be charmed by you": a creature immune to being charmed can't be dominated, and Calm Emotions reaches it.

Demon Armor's clawed gauntlets make its wearer's unarmed strikes magic, with +1 to hit and damage and a d8 damage die (`demon_armor_claws`); the damage is still listed as bludgeoning, and slashing is the GM's word. Its curse gives disadvantage on saves against anything a demon does. Its disadvantage on attacks against demons waits on an Engine key.

The androsphinx and gynosphinx (Inscrutable) and the wearer of an Amulet of Proof against Detection and Location can't be targeted by divination spells (`inscrutable`, `undetectable`). The sphinx's Insight disadvantage stays the GM's. (Until an Engine fix lands, the Engine reads these divination wards, and Mind Blank's, off catalog rows it doesn't hold during a fight, so they don't stop the spell yet.)

## The Mace of Terror, the Plate Armor of Etherealness and the Gloves of Swimming and Climbing (0.311.0)

The Mace of Terror's 3 charges (1d3 back at dawn) each release a wave of terror: every foe within 30 feet of its holder makes a DC 15 Wisdom save or is frightened of them for a minute, fleeing as from the Wand of Fear's cone, unable to react or come within 30 feet, and saving again at the end of each of its turns.

The Plate Armor of Etherealness, once a dawn, sends its wearer to the Ethereal Plane for 10 minutes as the etherealness spell does, still taking their turns there and coming back with an action.

The Gloves of Swimming and Climbing give their wearer climbing and swimming speeds equal to their walking speed while worn (`gloves_swim_climb`). The +5 to Strength (Athletics) checks to climb or swim stays the GM's.

## Heat Metal's searing, fiends' venom, the vampires' sunlight, grapplers' tentacles and the mimic's Adhesive (0.310.0)

Heat Metal's target, on a failed Constitution save, has disadvantage on attack rolls and ability checks until the start of the caster's next turn (`heat_metal_burned`); whether it drops the object instead stays the holder's word to the GM.

The pit fiend's Bite and the bearded devil's Beard poison with a venom that ends with the poisoning: while it holds, its target can't regain hit points (`cannot-heal`), and the pit fiend's deals 6d6 poison at the start of each of the target's turns (`pit_fiend_venom`, `bearded_devil_venom`).

The vampire and the vampire spawn keep on `sunlight_hypersensitive`: in sunlight they take 20 radiant damage as their turns start and have disadvantage on attack rolls and ability checks (`heldOnlyIn`, 1.605). Harm by running water stays the GM's, as no terrain runs.

The chuul's Tentacles and the otyugh's Tentacle Slam reach only a creature it grapples (`targetHolds.fromSelf`). The chuul's poison now paralyzes until it ends, and the otyugh's slam deals half damage on a made save instead of none.

The mimic's Pseudopod grapples a Huge or smaller target it hits (escape DC 13), its Adhesive trait. The mimic's object form is no form of its own, so it always sticks; the disadvantage on checks to escape stays the GM's.

## Dominate's advantage, ending Rage, Shocking Grasp, Sunburst, Wall of Force, ghoul claws and turn-long monster effects (0.309.0)

Dominate Person, Dominate Beast and Dominate Monster give their target advantage on the save when the caster or the caster's companions are fighting it (`advantageIfFought`, 1.582). A raging barbarian is offered "End Raging" for a bonus action (`endable`, 1.622).

Shocking Grasp's hit puts `shocked` on its target, with no reactions until the start of its next turn. Its advantage against a target wearing metal armor is still the GM's: no target test reads armor. Sunburst blinds whoever fails its save for a minute, a Constitution save ending it at the end of each of their turns. Wall of Force now stops shots and spells across it as well as movement (`blocks` `"ranged"`, 1.659, and `"spells"`, 1.602).

The ghoul's and the ghast's Claws never paralyze undead (`ridersIs` with `except`, 1.698); the ghoul's spares elves too since 0.344.0 (a character's race read as a tag, `tagsFrom`, 1.713). A stat block's effect that lasts "until the end of the cloaker's next turn" (the cloaker's Moan, a mummy's Dreadful Glare, the vrock's Stunning Screech, the otyugh's Tentacle Slam, the mummy lord's Blasphemous Word, the gibbering mouther's Blinding Spittle) now counts on its maker's turns, one lasting until the end or start of the target's own next turn (the mummy lord's Blinding Dust, the dretch's Fetid Cloud) on the target's; they had no clock before. The pseudodragon's Sting puts its target to sleep on a save failed by 5 or more, for as long as the poison lasts, waking on damage or a shake.

## Web Walker, Ice Walk, Water Susceptibility, the War Mage's wand, the Animated Shield and the Flying Sword (0.308.0)

Every creature whose stat block has Web Walker (the spiders, the drider, the ettercap and the swarm of spiders) keeps on `web_walker`: the Web spell's and a spider's Web attack's lasting areas never catch it and their restraint never goes on it (`unhinderedBy`, 1.704).

The white dragons' Ice Walk (`ice_walk`) makes hard going cost them a plain step on a snowy board and in Sleet Storm's ice (`easyGround`, 1.708). The fire elemental's Water Susceptibility (`water_susceptible`) deals it 1 cold damage for each cell it moves into water (`harmedEntering`); water splashed on it stays with the GM.

The Wand of the War Mage keeps on `war_mage_cover`: its holder's spell attacks ignore half cover (`coverIgnored`, 1.705). The Animated Shield's command word, a bonus action, makes it hover for 10 rounds, keeping its Armor Class while its holder's hands are free (`toggle.freesSlots`, 1.706).

The solar's Flying Sword, a bonus action, calls the hovering sword within 5 feet. It acts only as the solar commands, each command a bonus action, and strikes with the solar's own greatsword (`calls.fromCaller` and `commandedWith`, 1.707). It falls when the solar dies. The solar still swinging the greatsword while it flies, and the sword counted as held when it is targeted, stay with the GM.

The manifest declares Capability API 1.708.

## Possession kept out, the Harpoon's size, alignment, the talismans and the Sphere of Annihilation (0.307.0)

Magic Circle and Hallow now also keep their creatures from possessing anyone inside ("can't be charmed, frightened, or possessed"; `keepsOut` names up to 12 conditions since 1.697).

The merrow's Harpoon puts its contest and pull only on a Huge or smaller target (`ridersIs`, 1.698); its damage lands on anybody.

Every stat block carries its Alignment line (`alignment`), and a character's Alignment field gives the same tags (`creatureTypes.tagsFrom`, 1.699): `lawful`, `chaotic`, `good`, `evil` and `neutral`, read as whole words. "Any non-good alignment" gives none, nor "unaligned".

The Talisman of Pure Good opens its fissure only under an evil target, which must make a DC 20 Dexterity save or be destroyed; the Talisman of Ultimate Evil does the same to a good one. Each spends a charge and is gone with its last. A good (evil) cleric or paladin wearing it gets +2 to spell attack rolls (`statsIf`, 1.700). Whoever takes it up and is not of its alignment takes 6d6, or 8d6 if of the opposed one (`touchHarms`, 1.701). "On the ground" and the harm again at each turn's end stay with the GM.

The Sphere of Annihilation, already in the room as the fight starts, is a 2-foot sphere filling one cell (`oneCell`, 1.702). A creature within 60 feet can spend its action on a DC 25 Arcana check to move it 5 × its Intelligence modifier (at least 5 feet); on a failure it moves 10 feet toward them. Whoever it enters makes a DC 13 Dexterity save or takes 4d10 force damage. The fight now has an Arcana check, and creatures make it with their printed Arcana or Intelligence. The Talisman of the Sphere doubles its holder's proficiency on that check and, once they control the sphere, moves it 10 feet plus 10 × their Intelligence modifier (`holding`, 1.703).

The manifest declares Capability API 1.703.

## Echolocation and a creature's spellcasting ability (0.306.0)

A bat, giant bat, swarm of bats, darkmantle or killer whale "can't use its blindsight while deafened". Its blindsight is now a condition it always holds (`echolocation_60`, or `echolocation_120` for the whale), with the stat block's range, held off while it is deafened (`heldOffWhile`, 1.528). The Senses line no longer gives that blindsight directly.

A creature whose Spellcasting or Innate Spellcasting names its spellcasting ability ("The pit fiend's spellcasting ability is Charisma") makes Spellcasting ability checks with that ability's modifier, as a character does. A creature with no such trait has no Spellcasting ability check.

The manifest declares Capability API 1.696.

## The androsphinx's Roar, the merrow's Harpoon, the ghost's Possession, domination, Telekinesis on what a creature holds, the talismans, who reads a scroll and the thrower's own sneeze (0.305.0)

The androsphinx roars three times a day, each roar louder than the last (`byUse`, 1.687, its around bursts fixed in 1.696): the first frightens, the second deafens, frightens and paralyzes while frightened, and the third deals 8d10 thunder and knocks prone, each against every creature within 500 feet that hears it.

The merrow's Harpoon pulls its target 20 feet in only if the merrow wins a Strength contest; the hit's damage lands either way (a creature action's `contest`, 1.695).

The ghost's Possession puts the humanoid it lands on under its control (`possessed`, `controls`) and takes the ghost into the body (`dismisses` with `possesses`, 1.696). The possession ends as the body drops, when the ghost leaves as a bonus action on the body's turn (`endable`), or when Dispel Evil and Good's Break Enchantment drives it out, and the ghost comes back beside the body. Protection from Evil and Good keeps a ghost from possessing the one it guards. Dominate Person, Beast and Monster put their target on the caster's side while they hold (`controls`, 1.577).

Telekinesis is cast in one of two modes (`takesMode`, 1.692): Creature moves and holds a creature as before, and Object pulls what a creature holds out of its hand on the same contest (`takes`, 1.668). A repeat keeps the mode the spell was cast in.

The Talisman of Pure Good and the Talisman of Ultimate Evil attune only to a good or an evil character, read from the sheet's Alignment as the player wrote it (`alignment_good_evil`, a words table, 1.690).

A spell scroll is read only by a character with a level in a class whose spell list has the spell, any one of them (`userNeeds`, 1.667, with `userNeedsAny`, 1.691); a Thief's Use Magic Device still waives it.

Dust of Sneezing and Choking also catches its thrower on a failed save (`appliesSelfSaves`, 1.693).

A creature without a sheet now gives every fight check: its printed Medicine or its Wisdom modifier, and its Strength, Wisdom, Charisma and Dexterity modifiers for a plain ability check and for thieves' tools. Before, those read 0, so a creature resisting Telekinesis or the Pipes of the Sewers threw a bare d20.

The manifest declares Capability API 1.696.

## Poisoned weapons, healed endings, the Border Ethereal, trap disarming, the Periapt of Wound Closure and careful walking (0.304.0)

Basic poison, drow poison, purple worm poison and wyvern poison coat their user's weapon as an action (`poison_basic`, `poison_drow`, `poison_purple_worm`, `poison_wyvern`): the next hit with a piercing or slashing weapon asks the target's Constitution save (DC 10, 13, 19 and 15) and deals the poison's damage, 1d4, 12d6 or 7d6 (none or half on a success), or, for drow poison, poisons for an hour and puts to sleep on a failure by 5 or more (`onHit` with `damage`, `save`, `failedBy` and `damageTypes`, Capability API 1.683). An injury poison is spent on its one wound; basic poison lasts its minute.

Caltrops slow their victim's walk by 10 feet until healed, and an infernal wound closes on magical healing (`endsWhen`: `healed`, `healed-by-magic`, 1.684).

The ghost's Etherealness and the phase spider's Ethereal Jaunt (a bonus action) take it into the Border Ethereal and back, out of the fight but still taking its turns there, and the nightmare's Ethereal Stride takes up to three allies within 5 feet along (`dismisses` and its `carries`, `ethereal_shift`, `ethereal_jaunt`, 1.685).

A set hunting trap is a trap its setter's foes can disarm with thieves' tools (the new Disarm action, the bonus action with Fast Hands), against its DC 13, setting it off on a failure by 5 or more (`zone.disarm`, 1.669). Its check is the thirteenth fight check, thieves' tools (Dexterity, plus proficiency with a Proficiencies row for them; 1.686).

The Periapt of Wound Closure stabilizes its wearer when they start a turn dying, and doubles what each Hit Die heals on a short rest (`stabilizesWhenDying`, `wound_closure`; a rest die's `times`, the new item stat `hit_die_times`, 1.688).

A walker may cross caltrops or ball bearings carefully, at half speed there, without a save; caltrops that catch a walker stop them where they stand (`terrain.spareSlowWalkers`, `endsWalk`, 1.689).

The manifest declares Capability API 1.689.

## Pulls, creatures that hang on, the spiders' poison, slaying held to the low, Flyby, swarms, squeezing and Steadfast (0.303.0)

The balor's whip pulls a target that fails a DC 20 Strength save up to 25 feet toward it, and the roper's Reel pulls each creature its tendrils hold up to 25 feet straight in (`pull`, Capability API 1.675); the roper's Multiattack makes its four tendril attacks and its bite, and Reel is its own action.

The stirge, cloaker and darkmantle hang on to whoever they hit (`attaches`, 1.676), carried along as their target moves and drawing no opportunity attacks. The stirge drains 1d4 + 3 at the start of each of its turns and lets go once it has drained 10 (`stirge_attached`), attacking nobody meanwhile. The cloaker and the darkmantle attack only the creature they hold, with advantage, and blind it when the attack that attached them had advantage (`withAdvantage`); the cloaker passes half the damage it takes to its target (`cloaker_attached`, `darkmantle_attached`). Anybody's action frees the target: no check for a stirge, a DC 16 or 13 Strength check for the others. Breathing, and the darkmantle's and cloaker's size limits, stay the GM's.

A giant spider's, giant wolf spider's or phase spider's bite that drops a creature leaves it stable but poisoned for an hour, and paralyzed while poisoned (`onFell`, 1.677). The solar's Slaying Longbow slays only a creature with 190 hit points or fewer that fails a DC 15 Constitution save (`slaysHealthAtMost`, 1.678), and the sea hag's Death Glare drops a frightened creature that can see her to 0 hit points on a failed DC 11 Wisdom save (`dropsOnFailedSave`).

The owl, giant owl and flying snake draw no opportunity attacks flying out of reach (`flyby`, 1.679). Swarms share spaces with other creatures (`swarming`, `sharesSpace`, 1.680), and swarms and amorphous creatures (the black pudding, gray ooze, ochre jelly and shadow) move through any opening a Tiny creature fits (`squeezesAs`, 1.681). Anybody else squeezes through a space one size smaller at double the movement, with disadvantage on attacks and Dexterity saves and attacks against them at advantage while they stand squeezed (`combat.sizes.squeezing`, `squeezed`). The bearded devil can't be frightened while it sees an ally within 30 feet (`steadfast`, `heldOnlyIn.allySeenWithin`, 1.682).

The manifest declares Capability API 1.682.

## Bull's Strength, Quivering Palm's days, Armor of Invulnerability, attunement by class, Use Magic Device and Hallow's set-up, Teleport's table, the slippers, the level cap and creature saves (0.302.0)

Bull's Strength doubles its target's carrying capacity while it lasts (`derivedChanges`, Capability API 1.662). Quivering Palm's vibrations last the monk's level in days, counted down on the sheet between fights (`lastsDays`, 1.663). Armor of Invulnerability's immunity ends when the armor comes off (`whileItemWorn`, 1.664). An item that "requires attunement by" a class or classes, or by a spellcaster, does nothing for anyone else who binds it (`binds.needs`, 1.667): one class reads its level, several the highest of their levels (six new derived values, `attunes_by_...`), a spellcaster any spell slot. A thief of 13th level waives all of it (Use Magic Device, a new derived value `items.needsWaivedBy` reads). "Outdoors at night" stays the GM's; the class lists a spell scroll asks for work since 0.305.0, attunement by alignment since 0.307.0 and by a dwarf since 0.346.0. Teleport offers each row of its familiarity table as a way to cast it, from a permanent circle to a false destination, and rolls its mishap (3d10 force to every traveller, then again), similar area and off-target chances as the SRD's table gives them (`familiarity`, 1.670). The Slippers of Spider Climbing climb in a fight through a kept-on condition that gives no climb on slippery ground, which Grease's area now is (`climbNotOn`, 1.671); the sheet's climbing speed still shows them. The sheet holds every class level together to 20 (`sheet.totals`, 1.672). A mummy's or mummy lord's Dreadful Glare also paralyzes a target that fails by 5 or more, a drow's hand crossbow and a homunculus's bite put to sleep one that fails by 5 or more (the homunculus's poison then lasting 5 minutes), and a sprite's arrow one whose save comes to 5 or lower (`failedBy`, 1.673). Every creature action that leaves a creature "immune ... for the next 24 hours" spares it until its long rest once it saves, or once the effect ends where the SRD says so: the dragons' and the tarrasque's Frightful Presence, the cloaker's Moan, the dryad's Fey Charm, the ghost's Horrifying Visage and Possession, the harpy's Luring Song, the lich's Frightening Gaze, the nalfeshnee's Horror Nimbus, the succubus's Charm, and the Dreadful Glare, one source for all mummies and another for a mummy lord (`oncePerTarget`, 1.674). A new derived value works out a thieves' tools check (Dexterity, plus the proficiency bonus with a Proficiencies row for them); disarming a trap with it waits on room for a thirteenth fight check (asked). Hallow needs nothing new in the package: set up before a fight (Capability API 1.666), the Game Master may leave some of its five kinds out of the ward (`spares`) and keep its extra effect to creatures carrying a tag, such as the deity's followers (`tag`). The manifest declares Capability API 1.674.

## The robe's seen colors, the Pearl of Power, arrows of slaying, the missile-drawing shield, the Cube of Force's first faces, the Broom of Flying and the cleric's gear (0.301.0)

The Robe of Scintillating Colors' shimmer puts only an attacker that can see its wearer at disadvantage (`whenSeen`, Capability API 1.655). The Pearl of Power gives back one spent spell slot of 3rd level or lower, once a dawn, in a fight or out of one (an item use's `recovers` with `count`, 1.656); a spent slot of 4th level or higher coming back as a 3rd is the GM's. Each creature type has its own arrow of slaying, Arrow of Dragon Slaying to Arrow of Undead Slaying: shot from a bow as its own way to shoot it, it deals a creature of that type 6d10 more piercing damage, half on a DC 17 Constitution save, and then is a plain arrow (`ammoRider`, `spentOnUse`, 1.657). The plain Arrow of Slaying, aimed at a race or group, and bolts of slaying stay the GM's. The Shield of Missile Attraction's curse draws every ranged weapon attack at someone within 10 feet of its holder to its holder instead (`drawsAim`, 1.658). The Cube of Force's first face keeps gases, wind and fog from crossing it (`sealsAir`) and its second stops every shot of a weapon into, out of or across it (`blocks: ["ranged"]`, 1.659), for 1 and 2 charges. The Broom of Flying is ridden: its command word calls the broom, a Tiny flier of 50 feet that hovers and carries 200 pounds at full speed and up to 400 at 30 feet (`mountCarries` `slowedSpeed`, 1.660). The cleric's warhammer and chain mail "(if proficient)" are offered only to a sheet trained in martial weapons or heavy armor (`offeredWhen`, 1.661), the latter read off a new derived value that is 1 for any cleric (Life Domain) and a fighter or paladin who began in that class. The manifest declares Capability API 1.661.

## Feeblemind's and Tongues' languages, true sight, Cat's Grace, choking dust, gases and the Holy Avenger's aura (0.300.0)

Feeblemind's victim understands no language and nobody understands it (`languages: "none"`, Capability API 1.648), so a Command or Suggestion neither reaches it nor comes from it. Tongues, now a touch for an hour, gives its target every language, understood by anybody who knows one (`tongues`, `languages: "all"`).

Truesight and the warlock's Witch Sight see things as they truly are (`seesTrue`, 1.649): an image somebody called is never offered to them as a target, and illusory duplicates draw none of their attacks. Witch Sight is 30 feet off its Eldritch invocations row (`witch_sight`).

Cat's Grace lands its target safely from a fall of 20 feet or less while it isn't incapacitated (`fallsSafely.upTo`, 1.650).

Dust of Sneezing and Choking, thrown, asks every other creature within 30 feet for a DC 15 Constitution save (constructs and the undead pass): a creature that fails is incapacitated and suffocating (`sneezing_and_choking`, `suffocates`, 1.651), choking as a drowning creature does, and saves again as each of its turns ends while it is conscious (`savesUnless`). Lesser Restoration ends it. Its thrower's own save is the GM's.

Cloudkill's and Stinking Cloud's saves are saves against a gas, and so are the green, brass, copper, gold and silver dragons' gas breaths (`against.qualities: ["gas"]`, 1.652). The Necklace of Adaptation gives advantage on all of them, and its wearer breathes in any environment (`adapted_breathing`, spared drowning and choking).

The Holy Avenger, held, keeps an aura on its wielder: they and their friends within 10 feet, 30 from paladin level 17, have advantage on saves against spells and other magic (`holy_avenger_aura`, `holy_avenger_warded`). Alter Self's Natural Weapons deal 1d6 plus Strength (1.654), and their +1 and magic reach the unarmed strike now (`names: ["unarmed"]`, a word of the blow's name); before, they named it whole and never matched. The manifest declares Capability API 1.654.

## Three Multiattacks, Geas's commands, Mind Blank and Sequester (0.299.0)

Three Multiattacks the build could not read before are their sequences now (Capability API 1.643): the violet fungus makes 1d4 Rotting Touch attacks (a step rolled for, `dice`), the grick bites with its beak only at the creature its tentacles hit (`ifHit`), and the gibbering mouther bites and spits only when its Blinding Spittle has recharged, or bites alone (`optional`).

Geas gives one of four commands, picked as it is cast (1.644): don't harm me or my friends (`geased`, as before), harm no one (`geased_harm_none`), keep away from me (`geased_keep_away`) or cast no spells (`geased_no_spells`). Each of the three new ones can be broken: what it forbids is offered still, and doing it deals 5d10 psychic, once (`harms.at: "defies"`). Other commands stay the GM's.

Mind Blank wards off every divination spell (`wards.where` on the school, 1.645), beside its psychic and charm immunities; its foiling of Wish stays text. Sequester hides a willing creature out of time until dispelled or damaged (`sequestered`, `stasis`, 1.647): it takes no turns, so nothing that runs on its turns or anyone else's harms it or counts down, and it is unseen as the invisible are. Its own end condition and the scrying it stops are the GM's. The manifest declares Capability API 1.647.

## Phantasmal Killer, Weird, the Cube of Force and the Shield of Missile Attraction (0.298.0)

Phantasmal Killer and Weird hurt now. Each creature frightened by them takes 4d10 psychic damage as each of its turns ends unless it makes a Wisdom save, and the save ends the spell for it, its fear with it (`phantasmal_4d10`, a `harms.save` that `drops` every die; `endsWith`). Phantasmal Killer cast higher deals 1d10 more a slot level, up to 9d10 (`phantasmal_5d10` to `_9d10`, `paidSteps`).

The Cube of Force has 36 charges, 1d20 back at dawn, and three faces a fight reads, each a minute's 10-foot burst carried around its user (`anchor: "caster"`), pressing another face replacing it. Face 3 (3 charges) keeps out living matter, every creature but the undead and constructs, from passing or reaching in (`keepsOut`, as Antilife Shell's barrier); face 4 (4) lets no spell across and wards those inside from every spell cast from outside (`blocks`, `wards`); face 5 (5) does both, to every creature. Faces 1 and 2 (gases; nonliving matter, missiles among it) work since 0.301.0; face 6's end and the charges Disintegrate and the rest drain stay text.

The Shield of Missile Attraction halves the damage of every ranged weapon blow against its holder, rounded down (`damage-taken`, `times: 0.5`), as resistance to it does. Its curse, "you become the target instead" of a ranged weapon attack at anyone within 10 feet, works since 0.301.0.

## Coven slots, infernal wounds, Divine Eminence, lycanthropes' shapes, Alter Self and Animal Shapes (0.297.0)

A hag coven's Shared Spellcasting gives the coven its printed slots by level (`spellcasting.slots`, Capability API 1.642), spent by any member within 30 feet of the other two: 4 at 1st level, 3 at 2nd, 3rd and 4th, 2 at 5th and 1 at 6th. Each coven spell takes the lowest slot left at or above its level, and is not offered once none is left, rather than counting its own uses for the day. The coven spells are cast at the coven's DC and attack bonus, 12 and 4 + the hag's Intelligence modifier (green hag DC 13, night hag DC 15 and +7), while her innate spells keep their printed numbers (green hag DC 12, night hag DC 14 and +6).

The bearded devil's Glaive (DC 12, 1d10) and the horned devil's Tail (DC 17, 3d6) give a creature other than an undead or a construct an infernal wound on a failed Constitution save (`infernal_wound_1d10`, `infernal_wound_3d6`): it loses that many hit points as each of its turns starts, of no damage type, and each further wounding hit adds as many again (`stacks`). Any creature next to it can spend its action on a DC 12 Wisdom (Medicine) check to stanch it (`checkEnds`, `by: "any"`). "The wound also closes if the target receives magical healing" (`endsWhen: ["healed-by-magic"]`, 1.684).

The priest casts Divine Eminence off its sheet (`priest-divine-eminence` in the feature catalog, not a class feature): a bonus action and a spell slot give its melee weapon attacks 3d6 radiant more until the turn ends, 4d6 from a 2nd-level slot and 5d6 from a 3rd (`divine_eminence_3d6` to `_5d6`, `paidSteps`).

The five lycanthropes change shape (`inShape`, Capability API 1.547). Each has a Shapechanger action for its beast form and its hybrid form (`lycanthrope_form`, a shape keeping its own hit points, back to its true form for an action), and each form is its own block again (`werewolf-wolf-form`, `werewolf-hybrid-form` and so on, not SRD stat blocks): the Armor Class `armor_detail` prints for it (the werewolf 12, the wereboar and werebear 11), the beast's size where the SRD says it differs (the werebear's Large bear and hybrid, the weretiger's Large tiger, the wererat's Small giant rat) and the beast form's speed (40 feet, the werebear's bear also climbing 30; the fixture leaves these out of the block). Every attack is offered only in the forms the SRD names it for, as "Bite (Wolf or Hybrid Form Only)" says, and each multiattack only where its attacks are; the wereboar's two mauls, the weretiger's two claws, the werebear's two greataxes and the wererat's two shortswords are the multiattacks the SRD's "only one of which can be" and "In humanoid form" leave besides. The wereboar's Charge and the weretiger's Pounce ride on their tusks and claw. The mimic's and the doppelganger's shapes change nothing a fight reads ("Its statistics are the same in each form"), so they stay text. The manifest declares Capability API 1.642.

Animal Shapes turns up to 20 willing creatures it can see into Large or smaller beasts of challenge 4 or lower for 24 hours (`animal_shaped`, `forms`): each keeps its Intelligence, Wisdom and Charisma saves and can't cast spells; casting it again is the SRD's "transform affected creatures into new forms". Alter Self offers two of its three options: Aquatic Adaptation gives a swimming speed equal to the walking speed and water breathing (`alter_self_aquatic`), and Natural Weapons makes unarmed strikes magical with +1 to hit and damage (`alter_self_natural_weapons`). Their 1d6 works since 0.300.0; Change Appearance changes nothing a fight reads.

Six more items work. The Ring of Shooting Stars casts Dancing Lights and Light at will, only in dim light or darkness since 0.415.0, and, from 6 charges (1d6 back at dawn), Faerie Fire for 1 with its wearer's spell save DC, one Ball Lightning sphere for 2 (4d12 lightning, DC 15 Dexterity, moved 30 feet for a bonus action and gone on its first discharge, `damageCap`, and since 0.415.0 shedding dim light 30 feet), and Shooting Stars for 1 to 3, a 15-foot cube of 5d4 fire (DC 15 Dexterity, half) a charge; the two-to-four weaker spheres wait on the Engine. The Ring of Jumping casts jump on its wearer as a bonus action. The Gem of Brightness holds 50 charges: a beam (1 charge) at a creature within 60 feet it can see, or a 30-foot cone flare (5 charges), each a DC 15 Constitution save against blindness for a minute, repeated at each turn's end. Dust of Dryness holds 1d6 + 4 pellets; one thrown at a water elemental (`made_of_water`, a new creature tag) deals 10d6 necrotic, half on a DC 13 Constitution save. The Robe of Scintillating Colors has 3 charges, 1d3 back at dawn: until its wearer's next turn ends it sheds bright light 30 feet and dim light 30 feet more (`scintillating`), attacks against its wearer have disadvantage, and each creature within 30 feet that can see it makes a DC 15 Wisdom save or is stunned as long. Only an attacker that can see the robe has that disadvantage since 0.301.0. The Iron Flask traps a celestial, elemental, fey or fiend it can see within 60 feet on a failed DC 17 Wisdom save, taking it out of the fight; holding one creature at a time, the second try's advantage and releasing it stay the GM's. The Pearl of Power's "regain one expended spell slot" works since 0.301.0.

Four pieces of adventuring gear work. Antitoxin gives whoever drinks it, unless undead or a construct, advantage on saves against poison for an hour (`antitoxin`). Ball bearings cover a 10-foot square where whoever enters makes a DC 10 Dexterity save or falls prone; caltrops cover a 5-foot square where whoever enters makes a DC 15 Dexterity save or takes 1 piercing damage and stops moving this turn (`caltrops_stopped`); a set hunting trap deals 1d4 piercing on a failed DC 13 Dexterity save and holds its catch in place (`hunting_trapped`) until it or a creature next to it spends an action on a DC 13 Strength check. Each lies until gathered up. Walking through caltrops or ball bearings at half speed skips the save (zone `terrain.spareSlowWalkers`, 1.689), and caltrops' lost 10 feet of speed lasts until healed (`caltrops_stopped`, `endsWhen: ["healed"]`, 1.684). The trap's 1 damage per failed check stays text (Needs Engine 15 of the 10-19 audit).

Earthquake no longer deals 5d6 to everyone in its 100-foot radius: that is what a collapsing structure deals, which stays the GM's, as do the fissures. For a minute of concentration its ground is difficult terrain, each creature caught there that is concentrating makes a concentration save or loses it (`breaksConcentration`), and each creature makes a Dexterity save as the spell is cast and as each of its turns ends there, falling prone on a failure (`turn-end`, once a round as the SRD's "at the end of each turn you spend concentrating on it" gives). A flier is caught as one on the ground is.

## Suggestion, Imprisonment, Astral Projection, True Polymorph, venom saves, golems, ink and corrosion (0.296.0)

Suggestion and Mass Suggestion give one of four courses, picked as the spell is cast (leave, stand down, drop your weapon, follow me), only to a creature that hears and understands the caster (`targetTypes.understands`), and end when the caster's side harms the target. Imprisonment takes its target away (`imprisoned`), chains it (`imprisoned_chained`, restrained) or sleeps it (`imprisoned_slumber`, unconscious), until dispelled. Astral Projection takes its caster and up to eight others away (`astral_projected`) until dismissed, set up before a fight, and the Monk's Empty Body casts it for 8 ki. True Polymorph turns a creature into an object (`polymorphed_object`, the `polymorphed-object` entry, not an SRD stat block) or an object into a creature of a challenge rating up to its target's level. Mislead's and Project Image's casters look through their image (`double_looking`, `double_seen_through`). Etherealness and the Oil of Etherealness take their creature to the Ethereal Plane (`ethereal`) until dismissed. Fast Hands uses an object as a bonus action, and the Trident of Fish Command dominates swimming beasts.

Creatures: a poison or venom clause after a hit ("must make a DC 11 Constitution saving throw, taking 10 (3d6) poison damage on a failed save, or half as much") is its own save now (`plus[].save`), on 19 actions including the giant spider's bite and the wyvern's stinger. Stomps and hooves aimed at "one prone creature" reach only prone targets. The air elemental's Whirlwind pushes and knocks prone, halved on a save. The gorgon's breath, the cockatrice's bite and Flesh to Stone restrain toward stone (`turning_to_stone`, `saveEnds.failures.becomes`). Fey Ancestry, Gnome Cunning, Two Heads, Immutable Form and a swarm's lack of healing are kept on. The darkmantle's Darkness Aura, the octopuses' Ink Cloud and dash, the lamia's Intoxicating Touch, the stone golem's Slow, the clay golem's Haste and the cloaker's Phantasms are actions. Weapons are tagged `metal` or `wood`: the rust monster's and gray ooze's touch corrode metal and the black pudding's metal and wood (`corrodesWeapons`), magic weapons spared; the black pudding's Corrosive Form burns whoever hits or touches it for 1d8 acid. The manifest declares Capability API 1.641.

## Carpets, wishes, haunting pipes, a blasting horn and three potions (0.295.0)

The Carpet of Flying comes in its four sizes, the 3 by 5 foot carpet keeping the SRD id and the 4 by 6, 5 by 7 and 6 by 9 foot carpets entries of their own. Its use, an action, calls out its carpet (not an SRD stat block: Armor Class 11 for cloth and a resilient object's hit points, 5 Medium or 10 Large), which hovers, flies at the table's speed (80, 60, 40 or 30 feet), acts after its caller and moves as they direct within 30 feet, and is put away at will. It carries its capacity (200, 400, 600 or 800 pounds) at full speed and twice that at half speed (`mountCarries`, Capability API 1.641): its first rider steers it and the rest are carried along. A rider weighs what `combat.mounts.weights` says: a character their body by size plus everything they carry (two new hidden derived values, `rider_body_weight` and `rider_weight`; the SRD prints about 40 pounds for halflings and gnomes and about 150 for dwarves, the rest are the package's), and a creature by its size.

The Ring of Three Wishes casts any spell of 8th level or lower from the spell catalog (`duplicates`, 1.640), a charge each, and becomes nonmagical with its last. The Pipes of Haunting need wind instruments (1.205) and frighten the hostile who hear within 30 feet, a creature that saves immune until a long rest (1.628). The Horn of Blasting deals 10d6 to glass or crystal creatures, which save with disadvantage, and has a 20% chance to explode for 10d6 fire on its blower and be destroyed (1.629, 1.630). A Bead of Force pushes whoever saves outside its sphere (1.631). The Rope of Entanglement restrains in its own way, escaped at DC 15 or cut free, and the Iron Bands' DC 20 Strength check spends them and can't be retried for a day (1.636); both are released at will. The Potion of Poison deals 3d6 poison and poisons on a failed DC 13 save, 3d6 a turn, 1d6 less each save (1.635). The Potion of Animal Friendship casts Animal Friendship at DC 13 at will for an hour (1.634); the Philter of Love charms its drinker by the next creature they see for an hour (1.638). A swarm swayed by the Pipes of the Sewers stops following when it can't hear the piper (1.632), and only a rat swarm no one controls may be swayed (1.633). An Ioun Stone of Mastery adds 1 to its wearer's proficiency bonus (1.639). The Oil of Slipperiness's slick and the Eversmoking Bottle's smoke last their 8 hours and a day (1.637); the bottle's smoke pours out from the bottle in hand, and closing it lets it disperse.

## Iron bands and a slippery oil (0.294.0)

The Iron Bands of Binding take an action and their once-a-dawn charge to throw at a Huge or smaller creature their thrower can see within 60 feet: a ranged attack roll at the thrower's Dexterity modifier plus proficiency bonus that, on a hit, restrains the target with no clock. The bound creature breaks free with a DC 20 Strength check as an action, and anyone beside it may make the same check to break the bands. The Oil of Slipperiness is applied over 10 minutes, so before the fight (`beforeFight`), to a Medium or smaller creature for Freedom of Movement's 8 hours, or poured as an action for the Grease spell's slick on a 10-foot square for the rest of the fight; the oil prints no save DC, so it uses DC 13, as the uncommon items that print one do. All of it is data on what the Engine already does, so the manifest still declares Capability API 1.627.

## Invisibility ended, speed by the round, a tearing fan, rolled durations, caught missiles and the Astral Plane (0.293.0)

The Ring of Invisibility's invisibility, a Potion of Gaseous Form's form (its own condition, counted as Gaseous Form, so Wind Wall still keeps it out) and Boots of Speed's speed each end as a bonus action, offered as "End" on their holder's turn (`endable`, Capability API 1.622). Boots of Speed hold 100 rounds a long rest, one spent each round they run, so clicking them off keeps the rest for the next use (`chargesPerRound`, 1.623). Each use of the Wind Fan after the first in a day has a 20% chance, adding 20% each time, of tearing it to a useless thing (`charges.overuse`, 1.624). A Potion of Growth or Diminution lasts 1d4 hours and Dust of Disappearance 2d4 minutes, rolled as each is used (`duration.times`, 1.625), and a jar of Restorative Ointment is found with 1d4 + 1 doses. Gloves of Missile Snaring offer a reaction to catch a missile whose damage they cut to 0, while a hand is free, and the missile is kept (`keepsCaught`, 1.626). The Robe of Stars, as an action, carries its wearer into the Astral Plane, away from the fight, and back on another action, its "Magic Missile" kept apart (1.627). The manifest declares Capability API 1.627.

## Pipes played, a python's reach, and summons within range (0.292.0)

The Pipes of the Sewers take a new "Play" (an action, for one proficient with bagpipes, a flute, a horn, a pan flute or a shawm: a new hidden derived count of those Proficiencies rows, Capability API 1.205) that holds until the end of the player's next turn. Only while it holds are "Call Swarms" (a bonus action, 1 to 3 charges) and "Sway a Swarm" (no action, the Charisma against Wisdom contest) offered (`userHolds`, 1.617). A swayed swarm stays swayed while its piper plays and goes free when the playing stops (`endsWhenSource.lacks`); one that loses the contest (`contest.onLose`, 1.618) or starts a turn unable to hear its piper (`endsWhenHolder.cantHearSource`) can't be swayed for 24 hours. Worn while attuned, the pipes keep rats, giant rats and swarms of rats from attacking their wearer until the wearer harms them (`worn.ignoredBy`, 1.619). The Staff of the Python's snake is commanded only while within 60 feet of its caller, who is not incapacitated; otherwise it acts on its own (`calls.commandedWithin`, 1.620). A treant's Animate Trees sets its trees within 60 feet that it can see, and every summoning spell (Conjure Animals and the other conjurings, Arcane Hand, Find Familiar, Find Steed, Animate Dead, Create Undead, Animate Objects, Giant Insect, Project Image) sets what it calls within its printed range, seen where the spell says so, nearest the caster's foes (`calls.within`, 1.621). The manifest declares Capability API 1.621.

## Animate Objects (0.291.0)

Animate Objects brings to life ten Tiny or Small objects, five Medium, two Large or one Huge, of one size a cast, for its minute of concentration, two more objects for each slot level above 5th: twelve Tiny or Small, or six Medium, from a 6th-level slot, three Large from 6th and four from 8th, two Huge from 8th. Each is one of five new "animated object" stat blocks (Tiny to Huge) read off the spell's Animated Object Statistics: its hit points, AC, slam and Strength and Dexterity by size, Constitution 10, Intelligence and Wisdom 3, Charisma 1, speed 30 feet and blindsight 30 feet. The manifest still declares Capability API 1.616.

## Haunting pipes, a rod of rulership, a horn of blasting, disappearing dust, an entangling rope and a bead of force (0.290.0)

The Pipes of Haunting spend one of their 3 charges (1d3 back at dawn) to frighten the hostile creatures their player picks within 30 feet for a minute on a failed DC 15 Wisdom save, saved again at the end of each of its turns. The Rod of Rulership charms each creature of its holder's choice they can see within 120 feet for 8 hours on a failed DC 15 Wisdom save, ending on harm from its holder's side, once a dawn. The Horn of Blasting blasts a 30-foot cone for 5d6 thunder damage and a minute deafened on a failed DC 15 Constitution save, half and no deafness on a success. Dust of Disappearance turns its thrower and everybody within 10 feet invisible for 5 minutes, ending for whoever attacks or casts a spell. The Rope of Entanglement restrains a creature within 20 feet on a failed DC 15 Dexterity save until it escapes with a DC 15 Strength or Dexterity check (a new Dexterity check). A Bead of Force deals 5d4 force within 10 feet of where it lands on a failed DC 15 Dexterity save and shuts whoever failed in a sphere of force for a minute. The manifest still declares Capability API 1.616.

## Snaring gloves, a starry robe, an invisibility ring, a wind fan, an ointment, speed boots and a gaseous potion (0.289.0)

Gloves of Missile Snaring cut the damage of a ranged hit by 1d10 + the wearer's Dexterity modifier as a reaction, while a hand is free. The Robe of Stars gives +1 to saving throws, and each of its six stars casts Magic Missile as a 5th-level spell (seven darts), 1d6 back each day. The Ring of Invisibility turns its wearer invisible as an action until they attack or cast a spell. The Wind Fan casts Gust of Wind at save DC 13 once a dawn. Restorative Ointment holds five doses, each restoring 2d8 + 2 hit points and ending poison and disease. Boots of Speed double the wearer's walking speed for 10 minutes a long rest, and opportunity attacks against them have disadvantage. A Potion of Gaseous Form gives Gaseous Form for an hour. All of it is data on what the Engine already does, so the manifest still declares Capability API 1.616.

## Animate Trees, Children of the Night, the Pipes of the Sewers and Wind Walk's way back (0.288.0)

A treant animates one or two trees once a day: each has a treant's statistics with Intelligence and Charisma 1, no speech and only its Slam (a new "animated tree" stat block), and stays a day, until it dies, until the treant dies or is more than 120 feet away, or until the treant turns it back with a bonus action (`calls.leash`, `calls.dismissible.budget`, Capability API 1.610). A vampire's Children of the Night calls 2d4 swarms of bats or rats while the sun isn't up, or 3d6 wolves outdoors, arriving 1d4 rounds later for an hour, sent away on a bonus action (`onlyWhere`, `calls.arrivesIn`, 1.614). The Pipes of the Sewers spend 1 to 3 of their 3 charges on a bonus action, a swarm of rats each, which walk toward their caller under nobody's control (`calls.side: "none"`, 1.615); played as an action at one within 30 feet, a Charisma check against its Wisdom check sways it for as long as the playing goes on each round (`tamedWhile`, the fight's new Wisdom and Charisma checks). A wind walker who reverts can turn back into a cloud over a minute for what is left of the spell's 8 hours (`duration.remainingOf`, 1.616). The manifest declares Capability API 1.616.

## Horns of Valhalla, a djinni's ring, the python staff and an insect cloud (0.287.0)

The brass, bronze and iron Horns of Valhalla call 3d4 + 3, 4d4 + 4 and 5d4 + 5 berserkers for an hour, once in 7 days, and the berserkers attack whoever blew a horn without its requirement: proficiency with all simple weapons, all medium armor (a new derived value, from Cleric, Druid, Fighter, Paladin or Ranger levels, or Barbarian as the first class) or all martial weapons (`calls.hostileUnless`, Capability API 1.611). The Ring of Djinni Summoning waits its 24 hours from the djinni's departure, a round counted as 6 seconds (`combat.roundSeconds`), and becomes nonmagical if the djinni dies (`recharge.after.fromDeparture`, `calls.spendsItemOnDeath`, 1.612). The Staff of the Python becomes a giant constrictor snake within 10 feet on its own initiative, turned back with a bonus action, and shatters if the snake dies (`calls.becomesItem`, `calls.dismissible`, 1.613). The Staff of Swarming Insects' Insect Cloud spends a charge on a 30-foot cloud centered on its user for 10 minutes, heavily obscuring the area for everybody else until a wind disperses it (`obscures.notForCaster`, 1.609). The manifest declares Capability API 1.613.

## Sunlight Weakness, Reckless, Aggressive and Leadership (0.286.0)

A shadow in sunlight has disadvantage on attack rolls, ability checks and saving throws, and only there (`heldOnlyIn`, Capability API 1.605). The berserker and the minotaur take Reckless for free before they attack: advantage on their melee weapon attacks that turn, and attacks against them have advantage until their next turn starts (`free`, `beforeAttack`, 1.606). An orc's Aggressive is a bonus action moving up to its speed, every step nearer a hostile creature it can see (`move.toward`, 1.607). A knight's Leadership, once a fight, lasts a minute: each ally it can see within 30 feet that can hear it and shares a language with it adds a d4 to attack rolls and saving throws, and it ends if the knight is incapacitated (`endsWhenHolder.incapacitated`, `seenByHolder`, `targetTypes.understands`, 1.608). The manifest declares Capability API 1.608.

## Wands, a helm, lenses and a potion that cast (0.285.0)

The Wand of Polymorph casts Polymorph at save DC 15 for a charge, on a willing creature or on an unwilling one who saves, with its 7 charges, 1d6 + 1 regained at dawn and its crumbling last charge. The Helm of Teleportation casts Teleport for one of its 3 charges (1d3 back at dawn) and the Eyes of Charming cast Charm Person at DC 13 on a humanoid within 30 feet for one of theirs (all back at dawn). A Potion of Invisibility makes its drinker invisible for an hour, ending early if they attack or cast a spell. The manifest still declares Capability API 1.604.

## Wind Walk's revert, Forcecage's box and Hunter's Mark moved (0.284.0)

A creature in Wind Walk's cloud form is offered its revert beside moving and the Dash action (`behavior.actions`, Capability API 1.601): reverting ends the cloud form and leaves it incapacitated and unable to move for a minute, and whenever the cloud form ends it lands safely as Feather Fall does. Forcecage is always laid as a cage, never as a straight wall (`area.ringOnly`, 1.602), and now has its box: a 10-foot ring that nothing walks through and no spell is cast into, out of or across (`blocks: ["spells"]`). A creature inside either that teleports out first makes a Charisma saving throw against the caster's spell save DC, wasting the use on a failure (`forbids.teleport.save`, 1.603). Hunter's Mark, once its quarry drops to 0 hit points, is offered again on a bonus action at no cost, moving the mark to a new creature (`repeats.afterTargetDown`, 1.604). A creature out of its cloud form can turn back into one before Wind Walk ends, taking the same minute, for what is left of the spell (`wind-walk-recloud`, condition `actions`, `castingRounds`, `remainingOf`). The manifest declares Capability API 1.604.

## Items that call creatures (0.283.0)

The Bowl of Commanding Water Elementals, Brazier of Commanding Fire Elementals, Censer of Controlling Air Elementals and Stone of Controlling Earth Elementals each summon their elemental within 90 feet as if Conjure Elemental were cast: it stays while its summoner concentrates, up to an hour, and turns on them if the concentration breaks. Each can be used again at the next dawn. The silver Horn of Valhalla calls 2d4 + 2 berserkers within 60 feet for an hour, and waits 7 days before it can be blown again. The Ring of Djinni Summoning calls its djinni within 120 feet while its wearer concentrates, up to an hour, and waits 24 hours. The Staff of Swarming Insects casts Giant Insect for 4 charges beside Insect Plague. The brass, bronze and iron horns' berserkers attack a blower who lacks the proficiency (`calls.hostileUnless`, 1.611), the ring becomes nonmagical when its djinni dies (`spendsItemOnDeath`, 1.612), the Staff of the Python thrown becomes a giant constrictor snake (`becomesItem`, 1.613), and the Pipes of the Sewers call swarms that move toward the music but are not otherwise under their piper's control (1.615 to 1.618). The manifest still declares Capability API 1.600.

## Save traits on stat blocks (0.282.0)

Eleven stat blocks now keep their printed save traits on all fight. The lich's Turn Resistance gives advantage on saving throws against Turn Undead and anything else that turns undead, and the ghast's Turn Defiance gives the same to the ghast and every ghoul within 30 feet of it. The cultist's and cult fanatic's Dark Devotion gives advantage against being charmed or frightened, the gladiator's and knight's Brave against being frightened, and the duergar's Duergar Resilience against poison, spells and illusions and being charmed or paralyzed. The goat's, giant goat's and mule's Sure-Footed gives advantage on Strength and Dexterity saves against being knocked prone. The kraken's Freedom of Movement ignores difficult terrain, keeps spells and magic items from reducing its speed or restraining it, and spends 5 feet of movement to escape a grapple or nonmagical restraint. The manifest still declares Capability API 1.600.

## Forcecage and Wind Walk (0.281.0)

Forcecage lays a ring of bars 20 feet across around the cell aimed at: creatures caught in the bars are pushed to the nearest open side, whoever stands inside can't walk out, and nobody teleports into, out of or within it, for an hour. Wind Walk turns its caster and up to ten willing creatures to cloud for 8 hours: a flying speed of 300 feet, resistance to bludgeoning, piercing and slashing damage from nonmagical weapons, and nothing on their turn but moving and the Dash action. The manifest still declares Capability API 1.600.

## Arcane Hand's commands (0.280.0)

Arcane Hand's Grasping Hand is now the hand's own contest: it grapples a Huge or smaller creature within 5 feet with the hand's Strength, with advantage against a Medium or smaller one, and its caster is never offered it (Capability API 1.597, which holds up to 16 contests). Forceful Hand moves the hand with the creature it pushes, to stay within 5 feet of it (`onWin.follows`, 1.598). Interposing Hand's half cover lasts until the hand is given a different command (`endsWhenSource.acts`, 1.599). A creature can move through the hand's space only if its Strength is above 26, and that space is difficult terrain for it; the hand fills none of its space, so its caster may stand in it (`passableBy`, `fillsSpace`, 1.600). The manifest declares Capability API 1.600.

## Chain Lightning's leaps, Antilife Shell's barrier and Death Ward's end (0.279.0)

Chain Lightning's three leaps each land within 30 feet of the first target, not of each other, so two can strike 60 feet apart on either side of it (`targetsWithinFirst`, Capability API 1.594). Antilife Shell stops a creature it hedges out from reaching through it: a melee attack with no more than 5 feet of reach can't strike anyone inside, while ranged attacks, longer reach and spells still go through; and the spell ends if its caster moves so that the barrier would pass over one of them (`keepsOut.reach`, `endsOnSweep`, 1.595). Death Ward ends once it holds its target at 1 hit point, and it also negates an effect that would slay its target outright without dealing damage, such as Power Word Kill, ending as it does (`hangsOn.ends`, `outright`, 1.596). The manifest declares Capability API 1.596.

## The Wand of Wonder's gems and stone (0.278.0)

The Wand of Wonder's stream of gems now strikes: 1d4 × 10 bludgeoning damage in a line 30 feet long and 5 feet wide, shared out evenly among every creature in the line, rounded down (`amountTimes`, `dividedAmong: "caught"`, Capability API 1.593). Its petrification petrifies a target that fails the DC 15 Constitution save by 5 or more at once, and only begins turning them to stone on any other failed save (`save.failedBy`, 1.592). The manifest declares Capability API 1.593.

## The Efreeti Bottle's openings (0.277.0)

The Efreeti Bottle's first roll holds for every later opening (`calls.keepsRoll`, Capability API 1.591). An efreeti that attacks fights for 5 rounds, then leaves, and the bottle loses its magic; one that grants three wishes takes the bottle's magic with it (`spendsItem`). A servant comes back for an hour twice more, and at the fourth opening the efreeti escapes and the bottle loses its magic (`lifetimeUses: 3`, `pastLifetime`). The manifest declares Capability API 1.591.

## Who understands whom, and the Rod of Absorption's slots (0.276.0)

Command now does nothing to a creature that doesn't understand its caster (`targetTypes.understands`, Capability API 1.561). A character's languages are read off their proficiency rows named "Languages: ...", a race's one row ("Common and Dwarvish") split into each (`combat.languages.split`, 1.589); a character with no such row is unwritten and kept out of nothing. Each creature's languages come off its stat block: "all" and "any language" understand every one, a Primordial dialect (Aquan, Auran, Ignan, Terran) is Primordial too, a people's own tongue (Gnoll, Otyugh, Sahuagin) is written as printed, and "any two languages", "the languages it knew in life" and a creator's languages are left unwritten, never keeping a creature out. The Rod of Absorption makes slots only up to 5th level, and only of levels its holder has slots of (`paysSlotsMax`, 1.590). The manifest declares Capability API 1.590.

## Arcane Hand (0.275.0)

Arcane Hand calls a Large hand of force beside its caster for its minute of concentration, AC 20, Strength 26, with its caster's hit point maximum, spell attack bonus and Intelligence modifier (`calls.fromCaller`, Capability API 1.558). It acts right after its caster as it is cast, then only on the turns its caster spends a bonus action on it (`commandedWith`). Clenched Fist strikes for 4d8 force with none of the modifier, 2d8 more for each slot level above 5th (`callerAdds`, `perCallerStep`, 1.586). Forceful Hand is a contest only the hand makes, with advantage against a Medium or smaller creature, pushing the loser 5 feet plus five times the caster's Intelligence modifier (`actorHolds`, 1.578; `advantageAtMostSize`, `pushRead`, 1.587). Grasping Hand is the Grapple anybody makes, rolled with the hand's own Strength, with advantage against a Medium or smaller creature (`advantageAtMostSize`, 1.587). A creature the hand holds it crushes for 2d6 plus the modifier, 2d6 more a level. Interposing Hand gives the caster half cover against the creature it is set against while the hand stands (`coverFor`, 1.588). The hand is `arcane-hand` in the creature catalog (not an SRD stat block). Forceful Hand moves with what it pushes (`onWin.follows`, 1.598), Interposing Hand ends at the hand's next command (`endsWhenSource.acts`, 1.599), and a creature moves through the hand only with a Strength above 26, and then as through difficult ground (`passableBy`, 1.600). The manifest declares Capability API 1.588.

## Chain Lightning, Death Ward and Antilife Shell (0.274.0)

Chain Lightning strikes up to four creatures it can see, one more for each slot level above 6th, each within 30 feet of the first target (`targetsWithinFirst`, 1.594). Death Ward leaves its creature at 1 hit point the first time in a fight that damage would drop it to 0, for 8 hours (`hangsOn`, Capability API 1.400); it then ends, and it also negates an effect that would kill outright without damage (`hangsOn.ends`, `outright`, 1.596). Antilife Shell keeps every creature but undead and constructs from stepping into the 10 feet around its caster and moves with them (zone `keepsOut`, `anchor: "caster"`, 1.452); it stops melee reach through the barrier, and ends when the caster pushes a creature through it (`keepsOut.reach`, `endsOnSweep`, 1.595). The manifest declares Capability API 1.585.

## Mislead and Project Image (0.273.0)

Mislead turns its caster invisible until they attack or cast a spell and sets an illusory double of them where they stand; Project Image sets one down where its caster points, up to 500 feet away. Each image is called beside the fight's creatures (`calls.illusion`, Capability API 1.568) and moves up to twice its caster's speed only when they spend their action on it (`commandedWith`, 1.558). Anything aimed at an image or catching it in an area passes through, harming nothing, and from then on that side sees it for what it is and is never offered it as a target; the caster's own side always knows. The image is `illusory-double` in the creature catalog (not an SRD stat block). Since 0.296.0 the caster can look and listen through the image for a bonus action (`mislead-see`, `project-image-see`), blinded and deafened where they stand until a bonus action switches back. A creature's Investigation check to discern Project Image does nothing in a fight and is told. The manifest declares Capability API 1.585.

## Enthrall needs to be heard (0.272.0)

Enthrall lets go of a creature that can no longer hear its caster, deafened or out of earshot, as "creatures of your choice that you can see within range and that can hear you" are the only ones it holds (`endsWhenSource.holderLacks`, Capability API 1.584, read against the senses a condition takes away since an Engine fix). The manifest declares Capability API 1.585.

## Absorbing and storing items (0.271.0)

The Rod of Absorption takes a spell in only for its holder's reaction, counts the levels it took in over its whole existence and stops at 50 (`absorbs.spends`, `absorbs.lifetime`, Capability API 1.570, 1.571), is found holding 1d10 levels (`charges.rolled`, 1.573), and pays for its holder's spell slots out of those levels, a level a slot level (`paysSlots`, 1.572). The Ioun Stone of Greater Absorption cancels only a spell from a caster its holder can see, for their reaction (`absorbs.seen`, 1.570). The Ioun Stone of Absorption, whose source text prints the Ioun Stone of Fortitude's sentence in its place, now does what SRD 5.1 says: for a reaction, it cancels a spell of 4th level or lower from a caster its holder can see that targets only them, until it has canceled 20 levels. The Ring of Spell Storing is found holding 1d6 - 1 levels of spells and the Ioun Stone of Reserve 1d4 - 1 (`stores.found`, 1.576), drawn from 23 common spells of 1st to 5th level standing in for the GM's choice. The rod's slots are held to 5th level (`worn.paysSlotsMax`, 1.590); holding them to the levels of its holder's own slots waits on the Engine. The manifest declares Capability API 1.585.

## The Rod of Lordly Might's buttons (0.270.0)

The Rod of Lordly Might's buttons turn it, as a bonus action, into a flame tongue, a +3 battleaxe or a +3 spear and back into its mace (item `forms`, Capability API 1.575), keeping its charges and its Terrify; the form it was left in stays with it. Each form is an item of its own here, `rod-of-lordly-might-flame-tongue`, `rod-of-lordly-might-battleaxe` and `rod-of-lordly-might-spear` (not SRD items, never sold), the weapon with the rod's Drain Life and Paralyze beside its own, as "a melee attack using the rod" is in any form. Its climbing pole, its battering ram's +10 to break through barriers and its compass do nothing in a fight and are told. The manifest declares Capability API 1.585.

## The Wand of Wonder (0.269.0)

The Wand of Wonder spends a charge on an action aimed at a creature within 120 feet and rolls its d100 table (item `useTable`, `rollsTable`, Capability API 1.559): Slow, Faerie Fire, Gust of Wind, Stinking Cloud, Lightning Bolt, Enlarge, Darkness and Fireball cast at DC 15 and 120 feet; its wielder stunned until their next turn, shrunk, or made invisible; rain lightly obscuring 60 feet around the target until their next turn, or butterflies heavily obscuring 30 feet for 10 minutes; a rolled rhinoceros, elephant or rat that is not the wielder's to command; a burst of light that may blind everyone within 30 feet of the wielder, them included; and a Constitution save against turning to stone. Detect Thoughts, grass, a vanished object, leaves and blue skin are told. The gems' damage is divided equally among those in their line (`dividedAmong`, 1.593), and a save failed by 5 or more petrifies outright (`save.failedBy`, 1.592). The manifest declares Capability API 1.585.

## Bags of Tricks and the Efreeti Bottle, rolled (0.268.0)

A Bag of Tricks comes in its three colours, gray (`bag-of-tricks`), rust (`bag-of-tricks-rust`) and tan (`bag-of-tricks-tan`), each throwing its fuzzy object up to 20 feet as an action and rolling its own table of eight beasts, which act right after you; three are pulled from a bag before it waits for the next dawn (calls `rolled`, Capability API 1.559). An Efreeti Bottle opened as an action rolls its d100: 1 in 10 the efreeti attacks you, 8 in 10 it serves you for an hour, 1 in 10 it grants three wishes and comes into no fight; its stopper then stays in for 24 hours. The efreeti's five rounds of attacking, the first roll repeating at later openings, the bottle's lost magic and its fourth opening work too (`calls.options` with `rounds`, `spendsItem` and `pastLifetime`; `keepsRoll`, `lifetimeUses`, 1.591). The manifest declares Capability API 1.585.

## Repeating scrolls, Enthrall's endings and charms that count as charmed (0.267.0)

A scroll of Telekinesis, Vampiric Touch, Call Lightning, Heat Metal or Eyebite, and the Staff of the Magi's Telekinesis, offers the spell again on later turns as the spell does while its reader concentrates, spending nothing more of the item (item use `repeats`, Capability API 1.583). Enthrall comes off when its caster is incapacitated or can no longer speak (`endsWhenSource`, 1.584); its letting go of anyone who can no longer hear the caster waits on an Engine fix. Enthrall and Geas count as charmed, so a creature immune to being charmed is immune to them, and what holds off or ends charms holds off or ends them (`countsAs`, 1.585). The manifest declares Capability API 1.585.

## Reverse Gravity's grab, Storm of Vengeance's gusts, Wind Wall's arrows and the fought creature's save (0.266.0)

Reverse Gravity's Dexterity save is thrown by everyone inside as it is cast, before anybody is lifted; a creature that makes it grabs on and stays down until it leaves the area (zone `inside.save.onCast`, Capability API 1.579). From the fifth round Storm of Vengeance's wind and rain make whoever starts a turn under the cloud while concentrating save to keep their spell, and its gusts disperse fog in the area (stage `breaksConcentration`, `disperses`, 1.580). Wind Wall turns aside every ranged attack with a nonmagical weapon made into, out of or across it, sparing the boulders a giant hurls (`turnsShots` sparing "Rock", 1.581). Charm Person and Enthrall are saved against with advantage by a creature on a side hostile to their caster's (`save.advantageIfFought`, 1.582). The manifest declares Capability API 1.582.

## Geas, Enthrall, Telekinesis, Rock Catching, the shield guardian's amulet and the Grappler's pin (0.265.0)

Geas charms its target until dispelled; while it holds, attacking or harming its caster or their side costs it 5d10 psychic damage, once (condition `harms` at `attacks-source-side`, `once`, Capability API 1.562). Enthrall gives each creature that fails its Wisdom save disadvantage on Perception to find anyone hidden but its caster, for a minute (`exceptSource`, 1.567); a creature being fought makes its save with advantage (`save.advantageIfFought`, 1.582), and it ends when its caster is incapacitated or can't be heard (`endsWhenSource`, 1.584). Telekinesis is a contest of its caster's spellcasting ability against the target's Strength, Huge or smaller; on a win the caster sets it down up to 30 feet away, up in the air if they like, restrained and suspended until the end of their next turn, and they can repeat it as their action (`contest`, `movesTarget`, 1.565); a scroll of it can't repeat, waiting on the Engine. Every Rock a creature throws is a `thrown_object`, which a giant's Rock Catching answers whatever its name (`against.qualities`, 1.564), and a shield guardian's Shield guards only whoever wears its amulet, a magic item of its own here (`forHolds`, 1.564). The Grappler feat's pin, another grapple check against a creature it grapples, restrains them both until the grapple ends, offered only to whoever has the feat (`actorHolds`, 1.578). The manifest declares Capability API 1.578.

## Storm of Vengeance's rounds, Reverse Gravity, Siege Monster, Preserve Life and the warhorse's charge (0.264.0)

Storm of Vengeance thunders and deafens as it is cast, then changes on each of its caster's turns: acid rain (1d6 acid) on the second, six bolts of lightning (10d6, a Dexterity save for half) on the third, hail (2d6 bludgeoning) on the fourth, and gusts and freezing rain (1d6 cold, difficult ground, heavily obscured, no ranged weapon attacks) from the fifth (zone `stages`, Capability API 1.557); the wind and rain break concentration and the gusts disperse fog and gas (`breaksConcentration`, `disperses`). Reverse Gravity lifts everyone in its area who fails a Dexterity save to grab hold, and they fall when it ends (condition `lifts`, 1.566). Creatures with Siege Monster deal double damage to walls and objects (`doubleToObjects`, 1.560). Preserve Life shares five times the cleric's level among up to six creatures within 30 feet, none healed past half their maximum, never undead or constructs (`sharesHeal`, 1.563). The warhorse's Trampling Charge follows with another hooves attack at the prone target (a charge's `then.action` naming itself, 1.574). The manifest declares Capability API 1.574.

## Blade Barrier's cover, Gaseous Form's only speed, the vampires' sunlight and running water, Wind Wall and the figurines' days (0.263.0)

Blade Barrier's wall gives three-quarters cover to whatever stands behind it (zone `cover`, Capability API 1.555). Gaseous Form's flying speed of 10 feet is its holder's only way of moving (`onlySpeeds`, 1.555). A vampire or vampire spawn regenerates only while it isn't in sunlight or running water (regeneration `notIn`, 1.555). Wind Wall keeps out Small or smaller fliers and creatures in gaseous form (`keepsOut` with `flying`, `holding` and `anyOf`, 1.555); arrows, bolts and other ordinary projectiles shot through it miss, a hurled Rock excepted (zone `turnsShots`, 1.581). Each Figurine of Wondrous Power comes back after the days it prints (2, 5 or 7, the golden lions once both are spent) and Wings of Flying after 1d12 hours, not at a rest (`recharge.after`, 1.556). The manifest declares Capability API 1.556.

## Absorbing, turning and storing spells, Feeblemind's items, Branding Smite to 9d6, touches and the Cloak of Displacement (0.257.0)

A spell aimed at its holder alone, never in an area, at the item's level or lower is taken in (`worn.absorbs`, Capability API 1.522): the Rod of Absorption takes in spells of any level and stores their levels as charges, up to 50; the Ioun Stone of Greater Absorption cancels spells of 8th level or lower and spends its 50 levels on them. The Ring of Spell Turning gives advantage on saves against spells aimed at its wearer alone (`against.alone`, 1.523) and turns one of 7th level or lower back at its caster on a 20 (`worn.turns`). The Ring of Spell Storing (5 levels) and the Ioun Stone of Reserve (3 levels) store a spell cast into them, and the shield guardian stores one of 4th level or lower (`stores`, 1.524); whoever wears the item, or the guardian, casts it later with the storer's numbers.

Feeblemind also keeps its target from using magic items (`forbids.items`, 1.525), and they save again every 30 days of game time (`saveEnds.at: "days"`, 1.526). Branding Smite adds 8d6 at 8th level and 9d6 at 9th (twelve conditions by the steps paid, 1.525). Heated Body and Fire Form burn whoever grapples or shoves them, or breaks free of them (`whenHit.touches`, 1.527). The Cloak of Displacement does nothing while its wearer is restrained or can't act or move (`heldOffWhile`, 1.528). The manifest declares Capability API 1.528.

- Since 0.271.0 the Rod of Absorption and the stones take a spell in only for a reaction, the rod counts its 50 levels over its whole existence and pays for spell slots with them, the stones need to see the caster, and the rod, ring and stone are found holding 1d10, 1d6 - 1 and 1d4 - 1 levels; the Ioun Stone of Absorption does what SRD 5.1 says. **NEEDS ENGINE**: a stored spell's "parameters set by the original caster" for the shield guardian's predefined situation.

## Antimagic Field, Limited Magic Immunity and the staffs' full menus (0.256.0)

Antimagic Field is a 10-foot sphere on its caster for up to an hour (concentration): inside it, conditions that only spells put on do nothing (their clocks run on), items tagged `magical` do nothing while worn or carried and their uses are not offered, magic weapons hit as plain ones (`zone.suppresses`, Capability API 1.521), no spell is cast from inside it (`zone.forbids.casts`), and no spell of 9th level or lower reaches anybody inside it (`zone.wards`). The animated armor, flying sword and rug of smothering carry the `antimagic_susceptible` tag from their Antimagic Susceptibility and are incapacitated inside it. The rakshasa keeps Limited Magic Immunity on (`limited_magic_immunity`): no spell of 6th level or lower reaches it from anybody else (a condition's `wards`, 1.520).

Staffs offer up to 16 spells (1.519). The Staff of Power adds Levitate; the Staff of the Magi adds Passwall and Plane Shift for their charges and Enlarge/Reduce, Light and Protection from Evil and Good "without using any charges"; the Staff of the Woodlands adds Barkskin and, at will, Pass without Trace. The manifest declares Capability API 1.521.

- The Helm of Brilliance's rolled gems came in 0.349.0, and the Necklace of Prayer Beads' rolled beads in 0.360.0. Antimagic Field's summons, Thunderclap, Terrify, and the staff's and the rod's on-hit properties came in 0.258.0, and Thunder and Lightning in 0.259.0.

## Giant strength, Manuals and Tomes, Feeblemind, slot-scaled Magic Weapon and Branding Smite, and putting out others (0.255.0)

The six Potions of Giant Strength put `giant_strength_21` to `giant_strength_29` on their drinker for an hour, the score read off the potion's own table (hill 21, frost and stone 23, fire 25, cloud 27, storm 29): a condition's `abilities` `set`, which leaves a higher Strength as it is ("The potion has no effect on you if your Strength is equal to or greater than that score", Capability API 1.515). Feeblemind's failed save puts `feebleminded` on until it is dispelled: Intelligence and Charisma become 1 (`to`), and no spell is offered (`forbids.casts`). The six Manuals and Tomes raise their score by 2 and its maximum by 2 for good, read out of a fight (an item use's `raises`, 1.516), and are used up, since the book "loses its magic, but regains it in a century".

Magic Weapon gives +1 at 2nd and 3rd level, +2 (`magic_weapon_2`) at 4th and 5th and +3 (`magic_weapon_3`) at 6th and up, and Branding Smite 2d6 at 2nd and a die more for each level above (`branding_smite_3d6` and up), each picked by the steps paid (`paidSteps`, 1.517).

Anybody next to a creature may spend their action on the check that ends its condition (`checkEnds.by: "any"`, 1.518): the net's DC 10 Strength check ("freeing itself or another creature within its reach"), dousing Fire Form's and the fire elemental's fire ("until someone takes an action to douse the fire"), and alchemist's fire's DC 10 Dexterity check.

- Feeblemind's "understand language, or communicate in any intelligible way" works since 0.300.0. Its magic items, its save every 30 days and Branding Smite above 7th level work since 0.257.0.

## Mirror Image, Blink, Time Stop, Fire Shield, the Arrow-Catching Shield and worn items (0.254.0)

Mirror Image puts `mirror_image` on its caster for a minute: three duplicates (`duplicates`, Capability API 1.505). Each attack roll against the caster first rolls a d20, and on a 6 or more with three duplicates left, 8 with two or 11 with one, it is made against a duplicate instead, whose AC is 10 + the caster's Dexterity modifier. A duplicate it hits is destroyed, and the spell ends with the last. An attacker who can't see the caster, or who has blindsight, tremorsense or truesight, is never fooled. Blink (`blink`, 1.506): as each of its caster's turns ends for a minute, a d20 of 11 or more takes them off the board until their next turn starts, out of reach of everything, and back where they vanished or the nearest open space. Time Stop (`time_stop`, 1.507) gives its caster 1d4 + 1 turns in a row once the casting turn ends; nobody else acts, reacts or counts down meanwhile, and anything they do that reaches another creature ends it there. The Wizard's Spell Mastery and Signature Spells cast Mirror Image and Blink the same way, as do their scrolls.

A hit that answers back (`whenHit.harms`, 1.508): Fire Shield's warm shield (`fire_shield_warm`) deals 2d8 fire, and its chill shield (`fire_shield_chill`) 2d8 cold, to whoever hits the caster with a melee attack from within 5 feet. The azer (1d10), salamander (2d6) and remorhaz (3d6) keep their Heated Body on (`heated_body_1d10`, `heated_body_2d6`, `heated_body_3d6`), and the fire elemental's Fire Form burns a melee hitter for 1d10, all fire with no save. Since 0.257.0 "a creature that touches" them (a grapple, a shove, breaking free) burns the same way.

The Arrow-Catching Shield gives +2 AC against ranged attacks only, beside the shield's own +2 (`blow: "ranged"` on a worn defense modifier, 1.509), and its wielder can spend their reaction, as a ranged attack is aimed at a creature within 5 feet of them, to become its target instead (`takesAim`). Every Adamantine Armor turns a critical hit on its wearer into a plain hit (`criticals-against-normal`, 1.510). The net and the blowgun attack (1.511): the blowgun's flat 1 piercing plus Dexterity, its +1 to +3 adding to that, and the net's restraint on a Large or smaller target, which ends on the target's DC 10 Strength check (`checkEnds`); a magic net only hits better, and the vicious blowgun deals 2d6 more on a critical hit. Anybody next to the netted creature may make the check for them since 0.255.0, and since 0.258.0 a net does nothing to a formless creature and 5 slashing damage to it (AC 10) cuts its target free. Sharks, octopuses, quippers and sea horses breathe only water (`water_only`, `combat.underwater.breath.waterOnly`, 1.512): out of the water they hold their breath as anybody does under it. Worn items (1.513): Boots of Striding and Springing jump three times as far (`jumps`), the Cloak of Displacement keeps `displaced` on, giving attacks against its wearer disadvantage until damage stops it working until the wearer's next turn starts (`suppressedWhenHarmed`, 1.514), and the Ioun Stone of Awareness keeps `unsurprisable` on (`cannotBeSurprised`). The cloak is "suppressed while you are incapacitated, restrained, or otherwise unable to move" since 0.257.0. The Ring of Water Walking and Water Walk walk on water since 0.258.0. The manifest declares Capability API 1.514.

## Magic Weapon, Shillelagh, True Strike, Branding Smite, Oil of Sharpness and Fire Form (0.253.0)

Magic Weapon puts `magic_weapon` on the creature touched for up to an hour (concentration): its weapon blows get +1 to hit and damage and count as magical (a condition's `weapon`, Capability API 1.501). Shillelagh, for a minute, makes the caster's club or quarterstaff attack with their spellcasting ability (`abilityFrom: "spellcasting_ability"`), deal a d8 and count as magical. Oil of Sharpness, for an hour, gives the holder's slashing and piercing weapons +3 to hit and damage, magical; those weapons now carry the `sharp` tag for it. Applying it takes the minute the SRD gives, ten rounds (`castingRounds`, 0.415.0). Sacred Weapon's weapon becomes magical too. True Strike marks its target until the end of the caster's next turn: the caster's first attack roll against it has advantage, and that ends it (`fromSource` on attacks-taken and `endsAfter: "attacked-by-source"`, 1.502). Branding Smite holds on the caster until their next weapon hit (`endsAfter: "own-hit"`, 1.503): that hit deals 2d6 more radiant and brands the target for a minute (`onHit`), shedding dim light 5 feet and kept from being invisible (`branded`). The air and water elementals' Form and the fire elemental's Fire Form (`fire_form`) may stop in a hostile creature's space (`stopsInFoes`, 1.504); the first time in a turn the fire elemental enters a creature's space, it takes 1d10 fire and catches fire (`entering`), as its Touch also sets alight. On fire (`on_fire`) deals 1d10 fire at the start of each of its holder's turns until they spend an action to douse it. Since 0.255.0 another creature can douse it for them (`checkEnds.by: "any"`). A rider whose mount is knocked prone spends their reaction to land on their feet, with no save (`mounts.fall.landsWith`). Magic Weapon's +2 and +3 from higher slots and Branding Smite's 1d6 more a slot level above 2nd work since 0.255.0. The manifest declares Capability API 1.504.

## Under water, jumping, death saves and Beacon of Hope (0.252.0)

Underwater Combat (`combat.underwater`, Capability API 1.498): whoever stands on water tiles is under water. Their melee weapon attacks have disadvantage unless they have a swim speed or the weapon is a dagger, javelin, shortsword, spear or trident. Shots by or at them never reach past normal range and have disadvantage within it unless the weapon is a crossbow, net, javelin, spear, trident or dart. Fire damage is halved on them. They hold their breath for 1 + their Constitution modifier minutes (at least 30 seconds), then last their Constitution modifier in rounds (at least 1) and drop to 0. Water Breathing (up to ten creatures for 24 hours) and the Potion of Water Breathing (an hour) put on `water_breathing`, which breathes there. Stat blocks with Amphibious or Limited Amphibiousness carry the `water_breather` tag, and those with Hold Breath (15 minutes or more, longer than any fight) carry `holds_breath`; both breathe there. Since 0.254.0 a stat block whose Water Breathing "can breathe only underwater" carries `water_only` and holds its breath out of the water instead. Jumping (`combat.jumping`, 1.499): Jump on the move menu goes a straight line as far as the Strength score in feet after a 10-foot run-up, or half from standing; a high jump clears 3 + the Strength modifier. Landing on difficult terrain takes a DC 10 Acrobatics check or the jumper falls prone. Jump triples it for a minute (`jumping`), Step of the Wind doubles it for the turn (`step_of_the_wind`), Remarkable Athlete adds the Strength modifier to a running long jump (`remarkable_athlete_jump`, kept on) and Second-Story Work the Dexterity modifier to a running jump. Boots of Striding and Springing triple a jump while worn since 0.254.0. Death saving throws are saves (`dying.asSave`, 1.500), so Bless, Aura of Protection and whatever else adds to every save adds to them. Beacon of Hope gives up to 20 creatures within 30 feet (the spell names no limit) advantage on Wisdom and death saving throws, and the most healing its dice can give (`beacon_of_hope`, concentration up to a minute). The manifest declares Capability API 1.500.

## Moving through creatures, mounts and dragging (0.251.0)

A creature walks through a foe's space only when their sizes are at least two steps apart, and any space another creature fills costs double, as the SRD's Moving Around Other Creatures says (`combat.sizes.passing`, Capability API 1.495). Nobody ends a move in another's space. The halfling keeps Halfling Nimbleness on (`halfling_nimbleness`, `passesCreatures: "larger"`) and walks through any larger creature. The ghost, specter, wraith and will-o'-wisp keep Incorporeal Movement on (`incorporeal_movement`): they walk through anybody, and through solid ground as difficult terrain, taking 1d10 force with no save when a turn of theirs ends inside it. The air, fire and water elementals keep their Form on (`elemental_form`) and walk through anybody. Stopping in a hostile creature's space, and the fire elemental burning whoever's space it enters, work since 0.253.0. Mounted combat (`combat.mounts`, 1.496): a combatant mounts a willing creature of its side beside it at least one size larger, for half its speed, and gets down the same way. A mount with no sheet is controlled: its turn comes straight after its rider's, and it moves and takes only Dash, Disengage or Dodge. A creature of Intelligence over 6 big enough to carry somebody acts as it will (`mountIndependent`; Find Steed's steed has "an Intelligence of at least 6" and is still controlled). If the mount is pushed or falls prone, its rider makes a DC 10 Dexterity save or comes off prone, and on a success gets down on their feet. Since 0.253.0 a rider who still has their reaction spends it to land on their feet, with no save, as the SRD says. Grappled (`dragged`, 1.497): the grappler drags whoever they hold into each space they leave, at half speed unless the held creature is at least two sizes smaller. The manifest declares Capability API 1.497.

## Glibness, Detect Evil and Good, Meteor Swarm, Sacred Weapon and the scroll of Passwall (0.250.0)

Glibness is a buff on its caster for an hour (`glib`): any Charisma check rolls at least 15 (`checkFloor`). Detect Evil and Good is a buff on its caster, concentration up to ten minutes (`detecting_evil_and_good`): aberrations, celestials, elementals, fey, fiends and undead within 30 feet are known to them, hidden or not (`aware`, `uncovered`). Meteor Swarm reaches a mile and drops four 40-foot spheres at points the caster picks (`area.copies`), each 20d6 fire and 20d6 bludgeoning, Dexterity save for half. The Oath of Devotion's Channel Divinity offers Sacred Weapon beside Turn the Unholy: for a minute the paladin adds their Charisma modifier, at least +1, to weapon attack rolls (`sacred_weapon_bonus`), the weapon sheds bright light 20 feet and dim 20 more, and it ends early if they fall unconscious. A scroll of Passwall read at a standing Prismatic Wall breaks its green layer as the spell does (`endsLayers` and `endsLayersAs` on the item's use, Capability API 1.494). Pact of the Chain's own Find Familiar and a tiefling's Infernal Legacy spells stand for the catalog spells they copy (`standsFor` on the row, 1.493), so any rule that names the spell finds them. The manifest declares Capability API 1.494.

## Passwall and Prismatic Wall's layers (0.249.0)

Passwall can be aimed at a standing Prismatic Wall within its 30 feet: it destroys the green layer once the red, orange and yellow layers before it are gone, and is offered in a fight only while such a wall stands in reach (`endsLayers`, Capability API 1.491). The wall's layers now stop what the spell says while each stands: red nonmagical ranged attacks, orange magical ones (a spell's, or a magic weapon's), indigo spells cast through it (`blocks` on a layer row, 1.492). The wall is opaque, so nobody sees through it, but it no longer refuses every aim through it; once a layer falls, the next one still standing decides. It spares its caster and the creatures the caster designates as it is cast, up to 20 (the spell names no limit), rather than the caster's whole side, and they pass through and are not blinded by its flash (`spares: { chosen }`, 1.492). A scroll of Passwall breaks the green layer too since 0.250.0. The manifest declares Capability API 1.492.

## Familiars' types and lent attacks, free action, Holy Aura's flash and Prismatic Wall (0.248.0)

Find Familiar's familiar is a celestial, fey or fiend, picked as the spell is cast (`calls.asTypes`, Capability API 1.487), and can be set up before a fight by naming that pick. Pact of the Chain learns the spell itself and keeps its own copy for the imp, pseudodragon, quasit and sprite, which keep their own types. Seeing through the familiar's eyes and Voice of the Chain Master reach only the caster's own familiar (`targetTypes.calledBySelf`). With the pact on the sheet the bond also carries `familiar_chain`: the warlock may give up one attack of the Attack action for the familiar to attack with its reaction (`lendsStrikes`, 1.488). A worn Ring of Free Action crosses difficult terrain at full speed (`ignoresHardGround` on the item, 1.489). Holy Aura now wards the creatures its caster chooses within 30 feet as it is cast, as the spell says, rather than whoever stands near them (the aura held no DC for the flash), and they flash when a fiend or undead hits them in melee: the attacker makes a Constitution save against the caster's spell DC (a scroll's 18) or is blinded while the spell lasts (`whenHit`, 1.489). Prismatic Wall is a wall 90 feet long or a ring 30 feet across for ten minutes, opaque, shedding bright light 100 feet and dim 100 more (`zone.layers`, 1.490): whoever moves into it meets its seven layers in order, each a Dexterity save, red, orange, yellow, green and blue 10d6 fire, acid, lightning, poison and cold (half on a success), indigo restraining toward stone and violet blinding toward another plane as Prismatic Spray's rays do. Each layer falls only once those before it are gone: red to 25 cold, orange to a wind such as Gust of Wind, yellow to 60 force, green to Passwall, blue to 25 fire, indigo to Daylight and violet to Dispel Magic. The caster's side passes and stands near it unharmed; anybody else who sees it within 20 feet as it appears, moves that near or starts a turn there makes a Constitution save or is blinded for a minute. Passwall at the green layer, what the layers stop and the creatures the wall spares work since 0.249.0. Capability API 1.490.
