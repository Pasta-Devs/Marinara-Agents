# 5e (SRD 5.1)

A downloadable Game Mode **ruleset** (capability package, `ruleset` kind). It provides 5e rules
from the System Reference Document 5.1 for ability checks, skill checks, saving throws, spell
slots, hit dice, class resources, conditions, rests, a full character sheet, and 5e combat itself:
a battle in a game on this ruleset is fought by these rules, on screen, against the SRD's own
monsters.

Requires **Marinara Engine 2.4.6+ with Capability API 1.28** (the ruleset seam, catalogs, the
battle block, scaled catalog columns, the combat block, bestiaries and a fight with positions:
hash-pinned `ruleset.json` and `catalogs/<id>.json` assets the Engine reads by reserved filename,
exactly like `gm-verbs.json`). Today that means the Engine `staging` branch; older hosts reject the manifest and
cannot install this package. This package ships no server entrypoint, no client entrypoint, and no
Agent. It is pure data: nothing here runs code, and no restart is needed after install.

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
- A `combat` block: how a battle is fought by 5e's own rules, which is what a game plays on,
  including what one square of a battlefield is worth. See 5e combat and On a board below.

Every id in `ruleset.json` (`level`, `dex`, `slots`, and so on) is this file's own naming choice.
The Engine does not look for 5e-specific names; it reads the same closed set of resolution kinds
and sheet primitives that any ruleset package can use.

## Catalogs

A catalog is a collection of ready-made entries the sheet editor offers in a picker, so you do not
type a spell list or a page of class features row by row. This package ships four:

| Catalog | Entries | Fills | Ships as |
| --- | --- | --- | --- |
| Spells | 319 | Spells | `catalogs/spells.json` |
| Class features | 208 | Features and traits, Class resources | `catalogs/features.json` |
| Weapons | 36 | Attacks | inline in `ruleset.json` |
| Creatures | 319 | nothing: it is a bestiary | `catalogs/creatures.json` |

The bestiary is the odd one out. It writes no rows onto anyone's sheet, so the picker never offers
it; it is the other side of a fight, and the Creatures section below says what is in it.

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

The catalog files, the inline weapon catalog and the `combat` block are all generated. Rebuild them
with `node scripts/build-5e-srd-catalogs.mjs --source <fixtures dir>` from the repository root; do
not hand-edit them. The source, and the commit it was taken at, is recorded in each file and in
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

**The battle bridge is not a 5e combat system**, and it is no longer the usual path. A game with
the combat director on fights by the `combat` block below instead, with real attack rolls and saves.
The battle bridge is what a game with the combat director OFF still uses, and on that path attack
rolls, saving throws, concentration and what a higher slot would add are recorded on the catalog
entries and applied by nobody. A fight never uses both blocks.

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
block has drifted below. The `combat` block is generated and sits below, because its threat scale
is measured from the bestiary; the converter refuses to run when one has been typed above.

## 5e combat

`ruleset.json` also carries a `combat` block, which is the other thing entirely: it says how a
fight is **resolved** by 5e's rules rather than what a fight may borrow from the sheet.

**This is what a battle now plays on.** In a new game on this ruleset, with the combat director on,
a fight is resolved by 5e's rules and shown on the battle screen: you pick from your character's own
attacks and prepared spells, you roll against an opponent's Armor Class with advantage or
disadvantage, a natural 20 is a critical, saves are rolled against your Spell save DC, conditions
and concentration hold, a character at zero rolls against death, and every accepted action is
written to the sheet as it happens, spell slots included. Opponents come from the 319-creature
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
- The six standard actions, twelve of the fourteen SRD conditions, concentration (a Constitution
  save at DC 10 or half the damage, whichever is higher), death saves (three and three, a natural
  20 brings you back up at one hit point, a natural 1 counts twice, a blow while down costs a
  failure and a critical costs two) and the thirteen damage types.
- A challenge-rating scale, `threat`, measured from the bestiary at build time. It exists so an
  opponent a Game Master invents can be pulled onto it. Nothing in this package's own bestiary is
  ever clamped to it.

**About the scale.** Health, armour class and the attack bonus are measured from every SRD creature
of the rating. The damage band is measured only from the ones whose fighting is really in their
actions: a spellcaster's printed attack is a dagger and its fireballs are a trait, so counting it
would say a rating 12 monster deals nine damage a round. 36 casters and 4 creatures whose damage
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

| What | This package | SRD 5.1 |
| --- | --- | --- |
| One square | 5 ft | Playing on a Grid: "Each square on the grid represents 5 feet." |
| Movement | Your **Speed** field, which starts at 30 | Speed: "Your speed defines how far you can move when you move on your turn." |
| A long shot | Disadvantage | Range: "Your attack has disadvantage when your target is beyond normal range." |
| A shot with a foe next to you | Disadvantage | Ranged Attacks in Close Combat: "You have disadvantage on a ranged attack roll if you are within 5 feet of a hostile creature." |
| Cover | +2 to Armor Class | Cover: "A target with half cover has a +2 bonus to AC and Dexterity saving throws." |
| Walking out of a reach | Costs the enemy its **reaction** | Opportunity Attacks: "To make the opportunity attack, you use your reaction." |

**Speed is a plain sheet field defaulting to 30**, because this sheet has no notion of a race and so
cannot read a race's speed off one. A Wood Elf's 35 or a Dwarf's 25 is a number you type into the
Speed box yourself, exactly like Armor Class.

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

**Spells land as the shape the SRD prints.** 82 of the 84 spells a fight can resolve carry a range
in feet, and 30 carry an area: 13 spheres, 4 cylinders, 4 cones, 2 lines and 7 cubes or squares.
Dream ("Special") and Meteor Swarm ("1 mile") carry no range, because neither is a number of feet.
A range of **Touch** is written as 0, which the Engine reads as a reach of one square rather than a
shot, so touching somebody standing beside an enemy costs nothing. A spell whose range is **Self**
and which draws a shape carries no distance at all, because Self names none: the Engine sets a burst
down on the caster's own square and lets a cone or a line be aimed anywhere within its own length,
since there the aimed square only picks the direction. Seven of the spells a fight resolves work that
way, Burning Hands and Thunderwave among them.

**A cube or a square becomes the nearest burst**, because the Engine has a burst, a cone and a line
and nothing else. A burst of radius r covers 2r + 1 squares across, so an edge of N feet ships as a
burst of radius (N - 5) / 2: Thunderwave's 15-foot cube is three squares across either way, and a
cube with an even number of squares comes out one square wider than the printed cube. It is the one
place a shipped area is not the SRD's own outline.

Five printed shapes in a resolvable spell are deliberately not areas: Control Water's 20-foot wave
(moving water), Disintegrate's 10-foot cube (what the ray does to an object), Flame Blade's and
Produce Flame's 10-foot radius (the light they shed) and Wall of Ice's 10-foot-square panels (a
wall). The build refuses to run if a resolvable spell ever prints a shape that is in neither list.

**A creature carries how far its actions reach.** Of the bestiary's 828 actions, 505 reach (a printed
"reach 5 ft."), 128 carry (a printed "range 30/120 ft.", 56 of them with the long range as well), 18
do both, and 156 state no distance at all: 150 of those are multiattack sequences, whose parts carry
their own, and the last 6 are things done to somebody already grappled or standing in the creature's
own square. 72 actions print no range and take their distance from the sentence that names who has
to save, which is how a stat block writes an aura or a presence ("each creature within 120 feet of
the dragon").

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

`catalogs/creatures.json` is 319 of the SRD 5.1 monsters, each written in the numbers above:
hit dice a fight rolls, armour class, speed, ability scores, saving throw bonuses, resistances,
vulnerabilities, immunities, condition immunities, the challenge rating it sits at, its attacks and
saving-throw actions, its multiattack as one action that strikes several times, breath weapons that
recharge, and legendary actions bought from a pool of three points.

Every number is read off the **printed stat block**, never off the machine-readable attack rows
beside it, because those say the damage type is thunder on 514 of the SRD's attacks and leave the
flat bonus out of 475 of them.

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

Four creatures are left out, because the Engine's format needs a creature to have at least one
action a fight can resolve and these have none: **Donkey**, **Frog**, **Sea Horse** (the source
gives them no action at all) and **Shrieker** (its only action is a noise).

**A creature has one speed.** It is the walking speed, and for the 14 SRD creatures that cannot walk
at all it is the fastest of the other printed modes, so a shark travels at its swimming speed rather
than standing still. Whenever there is more than walking to say, the whole printed line rides along
as a trait ("0 ft., fly 90 ft. (hover)"), which is 172 of them.

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
  how many creatures it takes: two for a line, three for a cone or a sphere, two for anything else
  that says "each creature". Those counts are deliberately low, chosen once, and they are the one
  place in the bestiary where a number is not the SRD's own. With the Tactical style the shape
  decides instead and the count is not read at all; with Classic the count is the whole of it.
- **A line has no width.** "A line 100 feet long and 5 feet wide" is a line of single squares, which
  is what the SRD's own line is at this width and would not be at a wider one.
- **Half cover only, and only against an attack.** Ground the Engine's battlefield calls cover is
  worth +2 and never the +5 of three-quarters cover, there is no total cover, no elevation and no
  flying height, and the bonus is read when the attack roll is made and never when a saving throw
  is: SRD half cover also adds +2 to a Dexterity save, which nothing here can say.
- **A strike at somebody walking away is automatic**, for you as well as for the monsters, because
  choosing whether to take one is a reaction window and there are no reactions yet.
- **No grapple, no shove**, and nothing pushes anybody anywhere.
- **One speed per creature.** A creature that walks, swims and flies carries the fastest of them as
  its number and the rest as a trait, because the format has one speed.
- **No reactions**, so a reaction spell such as Shield is left off the menu and a creature's printed
  reactions are traits.
- **Legendary actions are carried, priced and resolved, but nothing opens the window they are spent
  in**, which arrives with reactions. A creature's three points and its options are all here.
- **Charmed and deafened** have no effect the Engine's closed list can express, so they stay plain
  records on the sheet. So does exhaustion, which this sheet counts on a track rather than as a
  condition, so a creature immune to it says so in a trait.
- **One damage roll per action.** An SRD attack that deals a second helping of a different type
  ("plus 7 (2d6) fire damage") keeps the first and says the rest in a trait: 64 of them. So does an
  attack that prints an alternative ("or 8 (1d10 + 3) if used with two hands", "or 5 (2d4) if the
  swarm has half its hit points"), which is a choice a fight has no way to make: 61 of them.
  The second helpings are a trait in this release because a creature action holds one damage roll in
  Capability API 1.28; the Engine is scheduled to carry them, and the converter already counts them,
  so they come back as numbers the release after that seam lands.
- **Spellcasting monsters** are traits. A stat block's spell list is not something a creature action
  can hold.
- **A creature cannot heal.** An action such as the deva's Healing Touch is a trait.
- **No qualifiers.** "Bludgeoning, piercing and slashing from nonmagical attacks" is carried as
  plain resistance to those three types with a trait saying so, because a fight cannot ask whether a
  weapon is magical. 57 creatures carry that trait.
- **Second Wind** heals 1d10 and not the "+ your fighter level" the SRD adds, because an amount here
  grows in dice and not in a flat number.
- **A class feature's own difficulty** is not the spell save DC, so the Features list rolls neither
  to hit nor against a difficulty. No entry this package ships needs one; an entry that did would
  stop the build rather than borrow the caster's number.
- **Extra Attack, Action Surge, Cunning Action and Sneak Attack** are text on your sheet and nothing
  more. The Engine's format has no way to say "attack twice with one action", to hand a turn a
  second action, or to add damage when a condition holds.

## Status

Available to Engine `staging` users only. The package is listed in `STAGING_ONLY_PACKAGE_IDS`, so
it is published to the preview overlay under `catalog/preview/` that staging Engines read, and is
hidden from stable `main` users. It stays there until the Capability API 1.28 ruleset, catalog,
battle, scaled-column, combat, bestiary and positions seam reaches a stable Engine release.

## Installing

Install it from **Agents** and **Download Agents** in a Marinara Engine build that supports
Capability API 1.28. After installing, choose it under Rules in the Game Mode setup wizard when you
create a new game. Choose the **Tactical** combat style in the same wizard if you want the fight
played on a board; **Classic** plays the same fight without positions.

## License

`ruleset.json` and the catalog files include material from the System Reference Document 5.1. See
[LICENSE-SRD.md](LICENSE-SRD.md) for the required attribution and for where the machine-readable
form of the catalog entries came from.
