# 5e (SRD 5.1)

## 1.0.2 - 2026-10-31

- A Low magic layer, turned on when a game is created: magic is rare and feared. No spell above 5th level is offered, and no spell scroll above 5th level is found or sold. Every magic item still exists, but no shop sells one (the magic dealer and the scribe are gone, and temples and alchemists sell only mundane goods), treasure drops one about a fifth as often, and a town's fence is the one shady way to buy one. The Game Master keeps creatures of magic out of random encounters, may still build a fight around one on purpose, and, when the player gives no reason, decides at game creation why magic is rare in this world. Magic items' spell scrolls carry a Spell level filter. It needs Capability API 1.813.

## 1.0.1 - 2026-10-31 [highlight]

- The whole SRD 5.1 in Game Mode: build a character from any SRD race, class, background and subclass, up to 20th level, and fight on screen by the SRD's rules against its 323 monsters, with its 325 spells, 966 magic items and every piece of equipment. It ships with 11 translations as language packs beside the English ruleset, and the Engine downloads only the one it is set to. It needs Capability API 1.812, whose numbers it now follows, upstream having taken 1.391 (the 5e minors move up one, to 1.392-1.812). A monk taken as a second or third class is proficient with shortswords, as the SRD's Multiclassing Proficiencies say.

## 1.0.0 - 2026-10-31

- The first full release of 5e (SRD 5.1): the whole SRD 5.1 played in Game Mode, from character creation through tactical combat, in 12 languages. Its data is 0.451.0's; the version games pin keeps counting (452), so every existing game and install updates to it.

## 0.451.0 - 2026-10-31

- No challenge 3 caster throws a 3rd-level spell that hurts everyone around it: a veteran battle priest casts Bestow Curse instead of Spirit Guardians, and a veteran pyromancer Magic Missile instead of Fireball (two veteran priests still wiped a 4th-level party in a Moderate fight, Spirit Guardians dealing over half the damage). The plain Arrow of Slaying names its 14 kinds and says a goblin takes Humanoid, a wyvern Dragon.

## 0.450.0 - 2026-10-31

- Capability API numbers follow the Engine's renumbering after it merged upstream staging, where 1.379-1.390 are upstream's, so the 5e minors move up past them. Nothing plays differently.

## 0.449.0 - 2026-10-30

- The 35 made-up casters (pyromancer, cryomancer, necromancer, enchanter, support, battle and nature priests) are as dangerous as their challenge rating: each rank's Armor Class, spell attack and save DC sit within 1 of its tier (novice and adept AC 13, +4, DC 12; veteran AC 15, +5, DC 13; master AC 16, +7, DC 15; legendary AC 18, +10, DC 18). A veteran battle priest cast Guiding Bolt at +8 and wiped a 4th-level party in a Moderate fight. The plain Arrow of Slaying says it is the family's name and to give an arrow of one kind, such as Arrow of Undead Slaying.

## 0.448.0 - 2026-10-30

- Magic ammunition hits more often as well as harder: an Arrow, Crossbow Bolt, Sling Bullet or Blowgun Needle (+1, +2 or +3) adds its bonus to the attack roll as well as the damage (Capability API 1.812). It declares 1.812.

## 0.447.0 - 2026-10-27

- The Light weapon property reads "Light (weapon)" on its chip and item tag, so each language can tell it from the Light cantrip: in Spanish it read "Luz" (illumination) beside the weapons.

## 0.446.0 - 2026-10-27

- True Polymorph and Shapechange offer creatures only: a flying carpet, a dancing sword, an arcane hand, an illusory double or an animated object is no longer a form, nor what True Polymorph makes of an object. The creatures catalog marks what a spell, item or ability makes with a "Made by" filter.

## 0.445.0 - 2026-10-27

- Spanish: the scimitar reads "Cimitarra" again, in its own name and the 22 other strings that name it (it read "Cimitaciónra").

## 0.444.0 - 2026-10-27

- Polymorph and Animal Shapes leave out the SRD's ten swarms too, as Wild Shape does: a swarm is many beasts, not "a beast".

## 0.443.0 - 2026-10-27

- Wild Shape no longer offers the SRD's ten swarms: a swarm is many beasts, not "the shape of a beast". The creatures catalog marks them with a Swarm filter.

## 0.442.0 - 2026-10-26

- Every language's store-card description fits the Engine's 2,000-character cap, so the official catalog lists the SRD again: the German and French ones ran over (2,008 and 2,001). The sentence on starting equipment in your inventory is dropped from the description in every language, English included; the equipment itself is still offered.

## 0.441.0 - 2026-10-26

- Translations ship as language packs, one download per language beside the ruleset file, and the Engine fetches only the language it is set to (Capability API 1.811): the ruleset file drops from 34 MB to 7 MB. The catalog lists each pack with its translated name and description for the store card.
- Each translation's package description says once, at its end, how to choose the ruleset, as the English one does: the earlier line, carried over from a draft, is gone.
- One long rest in 24 hours: "A character can't benefit from more than one long rest in a 24-hour period" (Capability API 1.810), counted on the game's clock from the start of the last one.
- Sheet layout 10: a sheet made before 0.438.0 has its cantrips marked prepared, so the GM's sheet summary lists them. The summary also names the character's features, fighting styles among them, and a warlock's invocations and pact boon.
- 81 more strings are translated, the Features tab among them.

## 0.440.0 - 2026-10-26

- A carried weapon is drawn when it is used: the items block names weapons as drawn on use (Capability API 1.808), so a ranger's spare Longbow, a barbarian's javelins or a rogue's dagger can be attacked with without first being equipped, other drawn weapons put away. Only a character with Ritual Casting (a bard, cleric, druid or wizard, or a warlock with the Book of Ancient Secrets) casts rituals: the spells list names those features as what a ritual needs (Capability API 1.809). It declares 1.809.

## 0.439.0 - 2026-10-26

- Translations for 11 languages (Arabic, German, Spanish, French, Hindi, Japanese, Korean, Polish, Brazilian Portuguese, Russian and Simplified Chinese) ship in the ruleset file: every name, label and rules text, plus the package name and description. The license attribution stays in English.

## 0.438.0 - 2026-10-26

- Ritual spells can be cast as rituals, for no slot, outside a fight: the spells list names its Ritual column as the ritual mark (Capability API 1.807). Cantrips come onto the sheet prepared, since they are always ready, so the GM's sheet summary lists them. It declares 1.807.

## 0.437.0 - 2026-10-26

- Attribution for release: the package's license names SRD 5.2.1 (the encounter budget table) beside SRD 5.1, with its CC BY 4.0 notice, and credits the Open5e srd-2014 data; it says the SRD material was adapted and reformatted, and that the package is not affiliated with or endorsed by Wizards of the Coast; the package description says it includes SRD 5.1 and 5.2.1 material under CC BY 4.0 and is not affiliated with or endorsed by Wizards of the Coast. The Engine's Capability API numbers from 1.385 up moved two places (upstream took 1.385 and 1.386), so every number the package names moved with them. It declares 1.806, so translations dropped in as locales/<language>.json ship with it.

## 0.436.0 - 2026-10-25

- A long rest ends temporary hit points (Capability API 1.804): "they last until they're depleted or you finish a long rest".

## 0.435.0 - 2026-10-25

- An encounter budget (Capability API 1.803): each challenge rating counts for its SRD 5.1 experience points, and a party may face up to SRD 5.2.1's XP Budget per Character (Low, Moderate, High) times its members, with no multiplier for numbers. Casual games play Low, normal Moderate, hard and brutal High; a boss fight may reach a step higher. The SRD 5.2.1 attribution is in LICENSE-SRD.md. A first class also writes its name into Class, so a sheet with only a class level still opens that class's spells.

## 0.434.0 - 2026-10-25

- Caster archetypes the GM can pick instead of inventing one: Pyromancer, Cryomancer, Necromancer, Enchanter, Support Priest, Battle Priest and Nature Priest, each at novice (challenge 1/2), adept (1), veteran (3) and master (6) and as a legendary (12) with Legendary Resistance and a cantrip legendary action. Each casts from a wizard, cleric or druid sheet at a class level near its challenge, so its slots come back on that class's rests; save DC 12, 14, 16, 18 (19 legendary), 2-3 cantrips and 4-6 leveled SRD spells (8 when legendary), Counterspell only from master up. Mages keep their distance, support priests stay back and heal, battle priests wade in. Not SRD stat blocks; marked as such.

## 0.433.0 - 2026-10-25

- A village herbalist sells potions of healing, antitoxin, healer's kits and herbalism kits; a potion of healing is sold from a village up

## 0.432.0 - 2026-10-25

- Fakes can be spotted (Capability API 1.802): each of the fence's eight fakes has tells anyone may check, untrained or not (Arcana, History, Medicine, Investigation, Religion and the tools that know them), and the fence's manner is an Insight check at DC 13, with advantage for a Guild Artisan or Merchant, Criminal or Spy, Charlatan or Urchin. Companions notice by passive score before a buy. Identify and Detect Poison and Disease see through them. New sheet values: six tool checks, History about magic items with Artificer's Lore. Spirit Guardians deals radiant or necrotic as picked.

## 0.431.0 - 2026-10-25

- SRD items Open5e leaves out, written from SRD 5.1: Armor, Shield and Ammunition +1/+2/+3, the Berserker Axe and the Ioun Stone of Fortitude. Audit fixes: Deflect Missiles answers only ranged weapon attacks, Uncanny Dodge only a seen attacker, Empty Body turns the monk invisible, the Rock Gnome gets tinker's tools, the Spells and Cantrips steps take 30 and 12; the Robe of Eyes and Belt of Dwarvenkind give darkvision (the robe sees the invisible), the Nine Lives Stealer has 1d8 + 1 charges, the Scarab crumbles on its last, Agility is very rare, the Armor of Vulnerability comes in three types; Geas needs sight.

## 0.430.0 - 2026-10-25

- Audit fixes from the 0.429 review: charms and Telekinesis count as the conditions they are; gazes and charms need the target's sight, and the vampire's and dryad's take only the creatures printed; the Shadow's Strength Drain takes 2 Strength until a rest; Regenerate heals 1 hit point a round for an hour; Slow takes up to six of the caster's choice; Hold Person, Hold Monster and Hideous Laughter last a minute; Blink can be ended; paralyzed creatures can't move; Elven Chain needs no armor training; the Periapt of Proof against Poison also wards off poisoned potions; more printed Multiattack choices (veteran, xorn, chuul, gladiator, mummies, roper); the assassin's Evasion; centipede and wasp poison knocks out instead of killing; the kraken's Lightning Storm strikes three; the duergar's Invisibility recharges on a rest.

## 0.429.0 - 2026-10-25

- The dwarf's tool and the Acolyte's languages list only what was chosen

## 0.428.0 - 2026-10-25

- Fiendish Resilience asks only for its damage type, and the bard's and monk's Proficiencies list only the tools chosen

## 0.427.0 - 2026-10-25

- Relentless Rage and Overchannel read as uses counted, not uses to spend, and Brutal Critical's lines say what they add (Capability API 1.801)

## 0.426.0 - 2026-10-25

- Archery's +2 reaches the Attacks list's bows and crossbows too (Capability API 1.800). Hit point roll rows start blank until rolled

## 0.425.0 - 2026-10-25

- A Pact of the Chain warlock's one Find Familiar row calls any form, the spell's fifteen and the pact's four. A druid is proficient with the scimitar

## 0.424.0 - 2026-10-25

- The guided builder's Hit point rolls step starts with one row for each level after 1st under Rolled, and waits until each is rolled (Capability API 1.799). A tiefling's Infernal Legacy casts Hellish Rebuke (2nd level) and Darkness in a fight, off its own uses, at the racial spell DC

## 0.423.0 - 2026-10-24

- A ranger's Favored enemies and Favored terrain say how many to choose (one, more at 6th and 14th or 10th level), and Step of the Wind is a bonus action on the menu

## 0.422.0 - 2026-10-24

- The Dragonborn's ancestry row is named Draconic Ancestry once, and a saved sheet's row is renamed (layout 8)

## 0.421.0 - 2026-10-24

- Pact of the Chain's Find Familiar comes prepared, so its familiar can be called before a fight

## 0.420.0 - 2026-10-24

- Humanoid foes carry the weapons their stat blocks attack with, and a ranger's favored enemies and terrain are offered as chips (Capability API 1.796)

## 0.419.0 - 2026-10-24

- Class build fixes: Fiend Fireball, Open Hand Knock Prone, monk weapon rows, Equipment step label

## 0.418.0 - 2026-10-24

- Finesse rows already on a sheet switch to the better of Strength and Dexterity

## 0.417.0 - 2026-10-24

- Finesse weapons use the better of Strength and Dexterity

## 0.416.0 - 2026-10-23

- Burning oil only from fire, and once

## 0.415.0 - 2026-10-23

- Sequester, Gaseous Form, Warding Bond, Oil of Sharpness and four item spells

## 0.414.0 - 2026-10-23

- Erinyes with a rope of entanglement; Warding Bond ends when recast

## 0.413.0 - 2026-10-23

- Games on the SRD fight on the Tactical battlefield only (Capability API 1.379), and weights read in lb (1.791).

## 0.412.0 - 2026-10-23

- Spells with a priced material need it carried, and use it up where the spell says (Capability API 1.790); a town's jeweler sells 43 gems and materials.

## 0.411.0 - 2026-10-23

- Your load sets your speed: 5 feet over carrying capacity, 0 over twice it.

## 0.410.0 - 2026-10-23

- Arcane Recovery and Natural Recovery offered as a short rest ends (Capability API 1.789).

## 0.409.0 - 2026-10-23

- A fake weighs what it passes for.

## 0.408.0 - 2026-10-23

- Your Armor Class comes from your armor: the typed one is Other Armor Class.

## 0.407.0 - 2026-10-23

- A Hit point rolls step for the Rolled method, and the typed maximum on the Levels step for By hand.

## 0.406.0 - 2026-10-23

- Languages given outright, Second Wind outside a fight, short armor names, the dragon ancestor waits to be picked (Capability API 1.788).

## 0.405.0 - 2026-10-23

- Features and Proficiencies tabs in play; the Hunter's parent features taken as they are.

## 0.404.0 - 2026-10-23

- The guided builder asks a Draconic Bloodline sorcerer for their dragon ancestor and a ranger for their favored enemies and terrain, on a Class choices step after the subclass that waits for each answer. The poison reads "Essence of ether" (its id unchanged). Divine Intervention's row for an unanswered call is "Unanswered Intervention".

## 0.403.0 - 2026-10-23

- Disintegrate (and its scroll) leaves dust: whoever its damage drops to 0 dies outright (fellsKill). The wyvern's claws are offered only while it flies, with two flying Multiattacks (bite and claws, claws and stinger). The glabrezu's second Multiattack is two pincers and then one spell. The Scarab of Protection has its 12 charges: a reaction turns a failed save against a necromancy spell or an undead's harm into a success. The manifest declares Capability API 1.787.

## 0.402.0 - 2026-10-23

- Thieves' tools are a skill on the sheet (Dexterity), trained by the Rogue class and a Rogue multiclass, so a rogue's Expertise can double them as the SRD allows. Every open choice of skills (Skill Versatility, Bonus Proficiencies, a bard's Expertise, a multiclass's any skill) names the eighteen skills only. The thieves' tools check reads the skill, or Dexterity and the proficiency bonus with a Proficiencies row for the tools. A Rogue multiclass's row reads "Tools: thieves' tools", so it counts.

## 0.401.0 - 2026-10-23

- Capability API numbers follow the Engine's merge with upstream: 1.342-1.748 are now 1.392-1.785 and the sheet's own words 1.378. Fight poses (who is drawn sneaking, who kneels to pray) need Capability API 1.786. A subrace's builder Info says its traits add to its race's instead of asking to pick the race again. The manifest declares Capability API 1.786.

## 0.400.0 - 2026-10-23

- Audit fixes, part 2: the quasit's poison, the magmin's fire and the vrock's spores every turn; 13 multiattack alternatives (Hurl Flame, Swallow, Life Drain, Fling and more); Gaseous Form's limits; Fire Shield dismissed as an action; Enslave and the succubus's Charm control their target; petrified keeps poison and disease off; the roper's grip saps Strength; leaping frogs and lions, climbing vampires; Etherealness for the night hag and the succubus; the oni's and the imp's and quasit's shapes; a Fiendish Resilience for each damage type; the Dagger of Venom's coating.

## 0.399.0 - 2026-10-23

- Audit fixes: fourteen recharges the source left out (ankheg, giant spider, mephits, storm giant and more); Frightful Presence and Horror Nimbus open their multiattacks; every "each creature within N feet" action is a burst that reaches everyone in range; Disintegrate, False Life and Wall of Fire cast at higher levels.

## 0.398.0 - 2026-10-23

- UI review, Engine 1.378: spell and item states left out of the Add condition picker; a Spells tab grouped by level, and spells under Spells on the fight menu; slot names that count right; plain item actions and save wording; situational sheet fields only when they matter; signed bonuses; every creature trait in full.

## 0.397.0 - 2026-10-22

- UI review, part 3: a Subrace field the builder fills; each race's Info opens with its traits; creature spell lists in full; Magical sleep; only a wizard sees Prepared spells.

## 0.396.0 - 2026-10-22

- Undead and fiends never surrender: when they break, they flee.

## 0.395.0 - 2026-10-22

- The hungry: crocodiles, the ankheg, the roper and the grick seize one victim and drag it off.

## 0.394.0 - 2026-10-22

- The honourable: the Knight, metallic dragons and celestials answer whoever struck them and spare the fallen.

## 0.393.0 - 2026-10-22

- The cruel: ghouls, hags and devils finish off the weak.

## 0.392.0 - 2026-10-22

- Guardians of a place: golems hold their ground and the treant its grove.

## 0.391.0 - 2026-10-22

- Arrogant dragons, lich and vampire: they think little of their foes until bloodied or one of their side falls.

## 0.390.0 - 2026-10-22

- Temperaments that turn: dragons, the lich and the vampire toy with foes until bloodied, and any creature at bay fights desperately.

## 0.389.0 - 2026-10-22

- Fanatics and drilled soldiers: the cult fanatic and cultists never lose heart, guards and knights hold their drill.

## 0.388.0 - 2026-10-22

- Bodyguards: the guard keeps by its leader, the cultist and the shield guardian by their leader or caster.

## 0.387.0 - 2026-10-22

- Combat roles where the stat block reads otherwise: the lich fights a party alone, the imp, quasit, phase spider, harpy and blink dog strike and slip away, the knight guards; the ghost and invisible stalker lie in wait.

## 0.386.0 - 2026-10-22

- The Dungeon Master's full morale variant: creatures also lose heart when surprised or with no way to harm the other side, and half a side down counts only while the other side has lost nobody.

## 0.385.0 - 2026-10-22

- Combat AI data from the re-scan: animal monstrosities fight by instinct, the homunculus thinks, spell-made objects never plan, morale breaks when half a side falls, and four more leaders.

## 0.384.0 - 2026-10-22

- The bandit captain's Multiattack also has its ranged form, two dagger throws, read from the SRD's second sentence (re-test 9).

## 0.383.0 - 2026-10-22

- Command's plain entry holds its five words, and Approach is one of them, so the fight names it Command (Approach) (re-test 9).

## 0.382.0 - 2026-10-22

- The guided builder names each class's subclass in the Subclasses field, from the level the class chooses it (Capability API 1.773).

## 0.381.0 - 2026-10-22

- An Ability Score Improvement is taken with its class level until a feat replaces it (Capability API 1.772), so the class features step no longer waits on it; the ranger's favored enemies and terrain hide for other classes.

## 0.380.0 - 2026-10-22

- Help is 5e's Help: offered only while the helper has a foe within 5 feet, and it counts only for an attack against a foe who was beside the helper (Capability API 1.771).

## 0.379.0 - 2026-10-22

- Spells cast several ways are one spell (Capability API 1.769 and 1.770): the guided builder and the catalog offer Magic Circle, Glyph of Warding, Hallow, Enhance Ability, Command, Symbol, Wish and the 15 others once, and a sheet's one row casts any of its ways in a fight (Magic Circle against fiends, a fire Glyph, Hallow's Daylight). Alter Self, Antipathy/Sympathy and Enhance Ability, whose every casting is a choice, each have a plain entry for it. Woods and ruins give cover only when they stand between the attacker and the target, not to a target merely standing in them.

## 0.378.0 - 2026-10-22

- Domain, oath and circle spells come prepared, and the class spell lists are the SRD's: the guided builder's Domain, oath and circle spells step adds a Life cleric's Bless and Cure Wounds (and the rest of the domain table as the cleric level reaches it), an Oath of Devotion paladin's oath spells and a Circle of the Land druid's circle spells for the land picked at the Class features step, always prepared. The cleric, warlock and druid lists drop the Player's Handbook subclass spells the source tagged them with (Barkskin and Burning Hands for a cleric, the Archfey's and Great Old One's for a warlock, every land's for a druid), and a druid gets Plane Shift. A Life cleric's heavy armor shows on the proficiencies, and the Draconic ancestry field shows only for a sorcerer. The Background step asks for a background instead of skipping as if nothing were left.

## 0.377.0 - 2026-10-22

- Starting weapons arrive in hand, and hit points in the character summary: a class's weapons picked at its equipment choices (or its fixed weapons where it has no choice of one, never four javelins or ten darts) are put on as the gear is taken, beside the armor and shield already worn. The summary the Game Master and the builder read shows the hit point maximum.

## 0.376.0 - 2026-10-21

- A wizard prepares from the spellbook (Capability API 1.767 and 1.768): the guided builder's Spellbook step fills a wizard's spellbook (six spells at 1st level, two more each wizard level), unprepared, and its Prepared spells step ticks Intelligence modifier + wizard level of them (at least one). The Spells step offers only the other classes' spells, still prepared as they are picked.

## 0.375.0 - 2026-10-21

- Class features come with the class (Capability API 1.766): the guided builder's Class features step takes every feature a character's levels give, each class up to its own level, so a fighter 4 / wizard 1 gets Action Surge and Arcane Recovery but not Extra Attack. It asks only where the SRD gives a choice: the Ability Score Improvement or a feat (Grappler) in its place.

## 0.374.0 - 2026-10-21

- Unconscious creatures fall prone (Capability API 1.765): dropping to 0 hit points, Sleep, Eyebite, a brass dragon's sleep breath, oil of taggit, couatl venom and the other sleeps leave the creature prone, still prone once it wakes until it stands. Spirit Guardians, Moonbeam, Cloudkill and Incendiary Cloud (1.764) catch only a creature that moves into them, not one they come onto as they move. The ruleset definition's version now moves with every release, so the Engine takes a new release over the old one.

## 0.373.0 - 2026-10-21

- Spells picked in the guided builder come prepared: the Spells and Magical Secrets steps tick each one, so a new cleric, druid, paladin or known-spells caster can cast them in their first fight. A wizard's spellbook is all prepared too; a spell copied in later still starts unprepared.

## 0.372.0 - 2026-10-21

- Creature behaviour (Capability API 1.763): a hundred SRD creatures say how they go about a fight. Pack Tactics and Martial Advantage hunt as a pack; False Appearance, the camouflages, Ambusher, Surprise Attack and Shadow Stealth lie in wait, as do ghouls and ghasts; every breath weapon opens the fight and dragons go for spellcasters; wolves, jackals and hyenas go for the wounded, goblins for the weakest (and run), hobgoblins hold their discipline; mages, archmages and liches control the field and go for casters, priests and acolytes support.

## 0.371.0 - 2026-10-21

- Monsters can lose heart (the Dungeon Master's optional morale rule, not part of the SRD): when their leader drops (a bandit captain, a knight, a cult fanatic) or they first fall to half their hit points, they make a DC 10 Wisdom save or flee the fight, and those that think surrender instead if a foe stands beside them; mindless, called and fearless creatures never break.

## 0.370.0 - 2026-10-21

- Monsters now fight with the mind their stat block suggests: beasts by instinct, constructs, oozes, zombies and skeletons without a thought, and the rest by Intelligence (cunning from 3, tactical from 8, a genius from 15, and legendary tacticians geniuses).

## 0.369.0 - 2026-10-21

- Wish can now grant up to ten creatures immunity to one spell or creature action for 8 hours, picked as it is cast; the Ring of X-ray Vision sees through only 1 foot of stone, 1 inch of metal or 3 feet of wood or dirt, and Wall of Stone is 6 inches thick; Creation makes an object that vanishes when its material's time is up (a day for vegetable matter down to a minute for adamantine or mithral), and Goodberry's berries vanish after a day.

## 0.368.0 - 2026-10-21

- Wish's other uses now work in a fight: healing up to twenty creatures of everything they are missing (and Greater Restoration's effects) and granting up to ten creatures resistance to a damage type; any of them puts its stress on the caster (necrotic damage with each spell cast until a long rest, Strength 3 for 2d4 days, a 33 percent chance of never casting Wish again). The object, the immunity and the reroll are in the rules reference.

## 0.367.0 - 2026-10-21

- Forbiddance now burns only the kinds its caster names, in radiant or necrotic as they choose, and stops creatures teleporting into its area; Magic Jar cannot possess a creature standing in a Magic Circle; the vampire can turn into a bat or a cloud of mist, and Misty Escape turns it to mist instead of falling at 0 hit points.

## 0.366.0 - 2026-10-21

- Magic Jar now works in a fight: the caster's soul waits in the container, possesses a humanoid that fails a Charisma save (not one warded by Protection from Evil and Good, and not one that saved within the day), controls the host, can leave it as an action, and risks death when the host dies.

## 0.365.0 - 2026-10-21

- Pale tincture and midnight tears work: pale tincture's save is repeated each day that passes, 1d6 poison on a failure that can't be healed until seven successes end it, and midnight tears deal 9d6 poison at midnight, half on a DC 17 Constitution save (Capability API 1.750, 1.751); Gloves of Swimming and Climbing add +5 to Athletics checks made to climb or swim (1.752).

## 0.364.0 - 2026-10-21

- Contingency works in a fight: its caster wears a Contingency statuette holding the contingent spell, which is cast on them by itself when they first take damage or drop to 0 hit points (Capability API 1.569).

## 0.363.0 - 2026-10-21

- Forbiddance wards the area around its caster for the day: a celestial, elemental, fey, fiend or undead foe takes 5d10 radiant damage as it enters or starts its turn there.

## 0.362.0 - 2026-10-21

- The Game Master gets a rules reference for what stays theirs: surprise and False Appearance, delivering contact and ingested poisons, midnight tears and pale tincture, the gloves' climbing and swimming bonus, manacles, the Ring of Telekinesis and the four feather tokens that work outside a fight.

## 0.361.0 - 2026-10-21

- Five more poisons can be used in a fight: assassin's blood, crawler mucus, oil of taggit, torpor and truth serum, each put to a creature within 5 feet; the mummy lord's Blinding Dust now catches every creature beside it.

## 0.360.0 - 2026-10-20

- The Necklace of Prayer Beads holds 1d4 + 2 beads of kinds rolled on the SRD's table, each casting its spell as a bonus action once a dawn (Capability API 1.746 to 1.749).

## 0.359.0 - 2026-10-20

- A creature bound by Dimensional Shackles can try a DC 30 Athletics check to break free, destroying them.

## 0.358.0 - 2026-10-20

- The Figurine of Wondrous Power (Ebony Fly) becomes a giant fly for up to 12 hours that can be ridden, and waits 2 days before it can be used again; the Onyx Dog's mastiff speaks Common and sees invisible creatures within its 60-foot darkvision.

## 0.357.0 - 2026-10-20

- The harpy keeps its Luring Song going with a bonus action on each later turn, and the song ends once it stops (Capability API 1.727).

## 0.356.0 - 2026-10-20

- A Spell Scroll of Goodberry is read in a fight as its spell is cast, putting ten berries into its reader's hand (Capability API 1.745).

## 0.355.0 - 2026-10-20

- The Ring of X-ray Vision lets its wearer see through solid matter out to 30 feet for a minute, and each use after the first before a long rest asks a DC 15 Constitution save or adds a level of exhaustion (Capability API 1.744).

## 0.354.0 - 2026-10-20

- The chain devil's Chain grapples only while the devil grapples nobody; the ice devil's wall falls as the devil is incapacitated; a Dancing Sword returns after its fourth attack.

## 0.353.0 - 2026-10-20

- A flask of oil can be poured and lit: a 5-foot square burning 2 rounds for 5 fire damage to whoever enters it or ends a turn there.

## 0.352.0 - 2026-10-20

- The Feather Token (Bird) calls an enormous bird with a roc's statistics that can't attack, carrying 500 pounds at full speed or 1,000 at half.

## 0.351.0 - 2026-10-20

- The Mirror of Life Trapping traps each creature but its user within 30 feet that fails a DC 15 Charisma save, constructs never.

## 0.350.0 - 2026-10-20

- The Helm of Comprehending Languages casts Comprehend Languages at will with an action; the Cloak of the Manta Ray's wearer breathes underwater.

## 0.349.0 - 2026-10-20

- The Helm of Brilliance is found with 1d10 diamonds, 2d10 rubies, 3d10 fire opals and 4d10 opals, each count rolled, in place of their averages.

## 0.348.0 - 2026-10-20

- The Necklace of Fireballs is found with 1d6 + 3 beads and throws one or several at once, a level higher for each bead beyond the first; README no longer says the Ring of Elemental Command's advantage and the whip's vanishing wait on the Engine.

## 0.347.0 - 2026-10-20

- Simulacrum's duplicate: a lasting simulacrum condition halves its hit point maximum, and the Game Master is told to add the duplicate to the party as a fresh copy holding it. The Game Master is also told to set Back from the dead to 4 when Raise Dead or Resurrection returns a character.

## 0.346.0 - 2026-10-20

- The Dwarven Thrower binds only a dwarf: a new hidden derived value reads the sheet's Race, so a Dwarf or Hill Dwarf may attune and anybody else may not.

## 0.345.0 - 2026-10-20

- Raise Dead and Resurrection leave their -4 ordeal: a new sheet track, Back from the dead, whose every level is -1 to attack rolls, saving throws and ability checks, set to 4 by either spell and one lower at each long rest.

## 0.344.0 - 2026-10-20

- A ghoul's Claws no longer paralyze an elf: drow carry the elf tag, and a character whose Race names an elf carries it too (a half-elf does not). Objects the package makes up (the floating whip, animated chains, dancing swords, carpets, the broom, animated and polymorphed objects) now give every check, at +0.

## 0.343.0 - 2026-10-20

- Dancing Sword: tossed with a bonus action, the sword becomes a hovering sword that attacks with its wielder's attack roll and ability modifier, its first attack free and each later one the wielder's bonus action, four attacks in all; taken back at will, and gone once its wielder is more than 30 feet away. Eight hidden derived values work its numbers out (the sheet now holds 408).

## 0.342.0 - 2026-10-20

- The ice devil's Wall of Ice (recharge 6): a 30-foot wall or 20-foot dome of ice sections (AC 5, 30 health, vulnerable to fire) dealing 10d6 cold (Dex 17 half) as it rises, blocking movement and sight for a minute, with frigid air (5d6 cold, Con 17 half) at a broken section.

## 0.341.0 - 2026-10-20

- The ivory goat of terror's horns come off as a +1 lance and a +2 longsword, and its rider's foes nearby must brave its aura of terror.

## 0.340.0 - 2026-10-20

- A bard's Magical Secrets may take cantrips as well as spells.

## 0.339.0 - 2026-10-20

- A scroll of Counterspell now counters a spell as it is cast, as the spell does.

## 0.338.0 - 2026-10-20

- The chain devil's chains hold their victims restrained and bleeding 2d6 piercing each turn, and its Animate Chains wakes four chains that lash out whenever it uses its Multiattack; Defender lets its wielder move some of its +3 to their Armor Class.

## 0.337.0 - 2026-10-20

- Shocking Grasp hits metal-armored creatures with advantage, Comprehend Languages lets its caster understand every tongue for an hour, the feather token's whip goes away when its caller is incapacitated, and the Helm of Brilliance loses its fire resistance and its fire aura once its gems are gone.

## 0.336.0 - 2026-10-20

- The rakshasa's claw curses its target so that no rest helps them until remove curse lifts it, and the tarrasque's carapace turns Magic Missile, line spells and ranged spell attacks aside, sending some back at the caster.

## 0.335.0 - 2026-10-20

- Goodberry puts ten berries in its caster's hand, each restoring 1 hit point when eaten.

## 0.334.0 - 2026-10-20

- Horseshoes of Speed and of a Zephyr work on the horse their rider rides, and Dwarven Plate braces its wearer against being moved.

## 0.333.0 - 2026-10-20

- The ankheg sprays acid only while it grapples nobody, and the bulette leaps: 30 feet long and 15 high, and its Deadly Leap lands on whoever stands there.

## 0.332.0 - 2026-10-20

- Vampires take 20 acid damage when they end a turn in running water.

## 0.331.0 - 2026-10-20

- Hideous Laughter's target saves with advantage each time it takes damage.

## 0.330.0 - 2026-10-20

- After casting a spell with a bonus action, only a cantrip with an action is left to cast that turn.

## 0.329.0 - 2026-10-20

- Massive damage kills outright, and a character can pull their melee blows to knock a foe out.

## 0.328.0 - 2026-10-20

- A Ring of Elemental Command's wearer attacks its plane's elementals at advantage, and Demon Armor's wearer attacks demons at disadvantage.

## 0.327.0 - 2026-10-20

- The ivory goat figurines are three: the goat of travail, the goat of traveling and the goat of terror.

## 0.326.0 - 2026-10-20

- Elementals of a Ring of Elemental Command's plane attack its wearer at disadvantage.

## 0.325.0 - 2026-10-20

- The Feather Token (Whip) calls a floating whip for an hour that lashes with force on its owner's bonus action.

## 0.324.0 - 2026-10-20

- Dimensional Shackles keep a bound creature from teleporting or crossing planes with its spells.

## 0.323.0 - 2026-10-20

- Each Ring of Elemental Command dominates its plane's elemental, gives its plane's protections and, once an elemental is slain, casts its plane's spells.

## 0.322.0 - 2026-10-20

- The Helm of Brilliance casts its gems' spells, sears nearby undead, guards against fire and sets a weapon ablaze.

## 0.321.0 - 2026-10-20

- The Helm of Telepathy casts Suggestion once a day.

## 0.320.0 - 2026-10-20

- The character builder offers bards their Magical Secrets: spells from any class.

## 0.319.0 - 2026-10-20

- The couatl's bite poisons for a day and puts its target to sleep until someone shakes it awake.

## 0.318.0 - 2026-10-20

- Scrolls of Shield, Feather Fall and Hellish Rebuke are read as a reaction, when they're needed.

## 0.317.0 - 2026-10-20

- Wearing armor or a shield you aren't trained in gives disadvantage on Strength and Dexterity rolls and stops spellcasting.

## 0.316.0 - 2026-10-20

- The obsidian steed figurine may ignore a good-hearted owner's orders.

## 0.315.0 - 2026-10-20

- The Ring of Animal Influence casts Animal Friendship and Fear (on simple beasts only).
- Phantom Steed calls a swift, fragile horse to ride.

## 0.314.0 - 2026-10-20

- Serpent venom coats a weapon like the other injury poisons.
- Burnt othur fumes, essence of ether and malice can be blown into a foe's face.
- A thrown flask of oil makes its target burn harder.

## 0.313.0 - 2026-10-20

- The harpy's Luring Song charms and draws in every humanoid and giant that hears it.
- The kraken's Ink Cloud is written as a cloud that blinds the water around it and poisons whoever stays in it.

## 0.312.0 - 2026-10-20

- Dominate Person, Beast and Monster count as charmed, so charm immunity and Calm Emotions reach them.
- Demon Armor's gauntlets claw, and its curse weakens saves against demons.
- Sphinxes and the Amulet of Proof against Detection and Location turn divination spells away.

## 0.311.0 - 2026-10-20

- The Mace of Terror sends nearby foes fleeing in fear.
- The Plate Armor of Etherealness takes its wearer to the Ethereal Plane once a day.
- The Gloves of Swimming and Climbing let their wearer climb and swim at full speed.

## 0.310.0 - 2026-10-20

- Heat Metal makes its target's attacks and checks harder until your next turn.
- The pit fiend's bite and the bearded devil's beard poison stops healing, and the pit fiend's burns each turn.
- Vampires burn and falter in sunlight. The mimic's pseudopod sticks to what it hits.
- The chuul's tentacles paralyze whom it grapples, and the otyugh's slam hits only whom it grapples, for half on a save.

## 0.309.0 - 2026-10-20

- Dominate spells are saved against with advantage by a target you are fighting. Barbarians can end their rage with a bonus action.
- Shocking Grasp stops reactions, Sunburst blinds, and Wall of Force stops shots and spells too.
- Ghoul and ghast claws spare undead. Monster effects that last until the end of a turn now end then. The pseudodragon's sting can put its target to sleep.

## 0.308.0 - 2026-10-20

- Spiders and their kin walk through webs unhindered (Web Walker). White dragons cross snow and Sleet Storm's ice easily (Ice Walk), and the fire elemental is hurt by water (Water Susceptibility).
- The Wand of the War Mage ignores half cover on spell attacks. The Animated Shield can hover for a minute, leaving its holder's hands free.
- The solar's Flying Sword flies out to strike at its command with the solar's own greatsword.

## 0.307.0 - 2026-10-20

- Magic Circle and Hallow keep possession out too. The merrow's Harpoon pulls only a Huge or smaller target.
- Creatures and characters carry their alignment, so effects can tell good from evil.
- The Talismans of Pure Good and Ultimate Evil open their slaying fissure under the opposed alignment, hurt the wrong hands and give a good (evil) cleric or paladin +2 to spell attacks.
- The Sphere of Annihilation moves on an Arcana check and destroys what it touches; the Talisman of the Sphere helps control it.

## 0.306.0 - 2026-10-20

- Bats, the darkmantle and the killer whale lose their blindsight while deafened (Echolocation).
- A creature whose spellcasting trait names its ability makes Spellcasting ability checks with it.

## 0.305.0 - 2026-10-20

- The androsphinx's three roars grow louder each time. The merrow's Harpoon pulls only on a won Strength contest.
- A ghost can possess a humanoid, and Dominate spells put their target on the caster's side.
- Telekinesis can pull an object from a creature's grip. The talismans attune only to good or evil characters.
- Spell scrolls are read only by classes whose list has the spell. Dust of Sneezing and Choking can catch its thrower.
- Creatures now use their own ability modifiers in Strength, Wisdom, Charisma and Dexterity contests.

## 0.304.0 - 2026-10-20

- Basic, drow, purple worm and wyvern poison coat a weapon and work on its next hit. Caltrops slow a walk until healed, and an infernal wound closes on magical healing.
- The ghost, phase spider and nightmare slip into the Border Ethereal and back. A set hunting trap can be disarmed with thieves' tools, on a bonus action with Fast Hands.
- The Periapt of Wound Closure stabilizes and doubles Hit Die healing. Caltrops and ball bearings can be crossed carefully at half speed.

## 0.303.0 - 2026-10-20

- The balor's whip and the roper's Reel pull their targets in. The stirge, cloaker and darkmantle hang on to whoever they hit; the stirge drains blood, the others smother and blind.
- A giant spider's bite that drops a creature leaves it stable, poisoned and paralyzed. The solar's Slaying Longbow slays only at 190 hit points or fewer, and the sea hag's Death Glare drops a frightened creature to 0.
- Owls and flying snakes fly out of reach freely. Swarms share spaces, swarms and oozes slip through tiny openings, and anybody can squeeze through a space one size smaller. The bearded devil can't be frightened near an ally.

## 0.302.0 - 2026-10-20

- Bull's Strength doubles carrying capacity. Quivering Palm's vibrations last the monk's level in days. Armor of Invulnerability's immunity ends when the armor comes off.
- Items that require attunement by a class or a spellcaster work only for those characters, unless a 13th-level thief uses Use Magic Device.
- Hallow, set up before a fight, can leave some kinds out of its ward and keep its extra effect to the deity's followers.
- Teleport is cast by how well its caster knows where it goes, rolling the SRD's mishap table. The Slippers of Spider Climbing can't climb on Grease. Class levels are held to 20 in all.
- The mummy's Dreadful Glare paralyzes on a failure by 5, drow and homunculus poison and the sprite's arrow put targets to sleep, and a creature that resists a dragon's Frightful Presence (and other such actions) is immune until its long rest.

## 0.301.0 - 2026-10-20

- The Robe of Scintillating Colors puts only attackers that can see it at disadvantage. The Pearl of Power gives back a spent spell slot of 3rd level or lower once a dawn.
- Each creature type has its own arrow of slaying, dealing 6d10 more piercing damage to that type (half on a DC 17 Constitution save) and then becoming a plain arrow.
- The Shield of Missile Attraction draws ranged weapon attacks at anyone within 10 feet to its holder. The Cube of Force's first face keeps out gases, wind and fog, and its second stops arrows and other shots.
- The Broom of Flying is ridden: 50 feet, or 30 above 200 pounds, up to 400. The cleric's warhammer and chain mail are offered only to those proficient.

## 0.300.0 - 2026-10-19

- Feeblemind takes every language away; Tongues gives them all, for an hour, by touch.
- Truesight and Witch Sight see through called images and illusory duplicates. Cat's Grace lands a fall of 20 feet or less.
- Dust of Sneezing and Choking incapacitates and suffocates whoever fails its save. Cloudkill, Stinking Cloud and five dragons' gas breaths are gases, which the Necklace of Adaptation gives advantage against; its wearer breathes anywhere.
- The held Holy Avenger gives its wielder and friends nearby advantage on saves against magic. Alter Self's natural weapons deal 1d6, and their +1 and magic, which never reached the unarmed strike before, now do.

## 0.299.0 - 2026-10-19

- The violet fungus makes 1d4 Rotting Touch attacks, the grick bites with its beak only after its tentacles hit, and the gibbering mouther spits only when it can.
- Geas gives one of four commands, three of which can be broken for 5d10 psychic. Mind Blank wards off divination spells. Sequester holds a willing creature out of time until it is damaged.

## 0.298.0 - 2026-10-19

- Phantasmal Killer and Weird deal 4d10 psychic each turn until saved against, Phantasmal Killer more when cast higher.
- The Cube of Force keeps out living matter, spells or everything around its user for a minute, by face. The Shield of Missile Attraction halves damage from ranged weapon attacks.

## 0.297.0 - 2026-10-19

- A hag coven shares its printed spell slots by level, each coven spell spending the lowest slot left at or above its level. Coven spells are cast at the coven's DC and attack bonus, and a hag's innate spells at her own.
- The bearded and horned devils' infernal wounds bleed each turn until stanched with Medicine. The priest's Divine Eminence adds radiant damage to its melee hits for a slot.
- Lycanthropes change into their beast and hybrid forms, each with its own Armor Class, size and speed, and attack only as each form allows. The wereboar charges and the weretiger pounces.
- Animal Shapes and Alter Self's swimming and natural weapons work. The Rings of Shooting Stars and Jumping, Gem of Brightness, Dust of Dryness, Robe of Scintillating Colors and Iron Flask work. So do antitoxin, ball bearings, caltrops and hunting traps.
- Earthquake shakes creatures prone and breaks concentration on difficult ground, instead of dealing 5d6.

## 0.296.0 - 2026-10-19

- Suggestion gives one of four courses, heard and understood. Imprisonment, Astral Projection (and Empty Body), Etherealness, True Polymorph and looking through Mislead's or Project Image's double work.
- Poison clauses after a creature's hit are their own saves. Stomps reach only prone targets. Stone gazes restrain toward stone. Golems slow and haste, octopuses ink, the darkmantle darkens, the cloaker makes phantasms.
- Weapons are metal or wood: rust monsters, gray oozes and black puddings corrode them. Fast Hands and the Trident of Fish Command work.

## 0.295.0 - 2026-10-19

- The Carpet of Flying comes in its four sizes, each ridden by as many as its capacity bears, at half speed up to twice that. The Ring of Three Wishes casts any spell of 8th level or lower, three times.
- The Pipes of Haunting need wind instruments, the Horn of Blasting can explode, and a Bead of Force pushes out whoever saves. The Rope of Entanglement and Iron Bands are released at will.
- The Potion of Poison, the Potion of Animal Friendship and the Philter of Love work as printed. An Ioun Stone of Mastery adds 1 to proficiency.

## 0.294.0 - 2026-10-19

- The Iron Bands of Binding are thrown at a Huge or smaller creature within 60 feet, a ranged attack at Dexterity plus proficiency that restrains on a hit, broken by a DC 20 Strength check from the bound creature or anyone beside it, once a dawn.
- The Oil of Slipperiness gives 8 hours of Freedom of Movement, applied before the fight, or is poured as an action for Grease's slick over a 10-foot square (DC 13).

## 0.293.0 - 2026-10-19

- The Ring of Invisibility's invisibility ends as a bonus action, and Boots of Speed spend their 10 minutes a round at a time, clicked off as a bonus action and kept for the next use. A potion's gaseous form ends as a bonus action.
- The Wind Fan may tear each use after the first in a day (20%, adding up). Growth and Diminution last 1d4 hours, Dust of Disappearance 2d4 minutes, and Restorative Ointment holds 1d4 + 1 doses.
- Gloves of Missile Snaring catch a missile whose damage they cut to 0, if a hand is free. The Robe of Stars carries its wearer into the Astral Plane and back.

## 0.292.0 - 2026-10-19

- The Pipes of the Sewers are played as an action by one proficient with a wind instrument; swarms are called and swayed (for nothing more) only while they play. A lost contest, or a swayed swarm that stops hearing the pipes or its piper, leaves the swarm unswayable for a day. Rats and giant rats leave the attuned piper alone until harmed.
- The Staff of the Python's snake is commanded only within 60 feet; farther off it acts on its own.
- A treant's animated trees, and the creatures of Conjure Animals and every other summoning spell, appear within the range they print, near the caster's foes, where the spell says the caster sees.

## 0.291.0 - 2026-10-19

- Animate Objects calls Tiny, Small, Medium, Large or Huge animated objects (five new stat blocks), more from higher slots.

## 0.290.0 - 2026-10-19

- The Pipes of Haunting, the Rod of Rulership, the Horn of Blasting, Dust of Disappearance, the Rope of Entanglement and the Bead of Force now work in a fight; the fight has a Dexterity check.

## 0.289.0 - 2026-10-19

- Gloves of Missile Snaring, the Robe of Stars, the Ring of Invisibility, the Wind Fan, Restorative Ointment, Boots of Speed and the Potion of Gaseous Form now work in a fight.

## 0.288.0 - 2026-10-19

- A treant's Animate Trees calls one or two animated trees that leave on its bonus action or beyond 120 feet; a vampire's Children of the Night calls bats or rats out of the sun, or wolves outdoors, arriving in 1d4 rounds; the Pipes of the Sewers call uncontrolled swarms of rats and sway one with a contested Charisma check while played; a wind walker can turn back into a cloud for what is left of the spell.

## 0.287.0 - 2026-10-19

- The brass, bronze and iron Horns of Valhalla call their berserkers, who attack a user lacking the horn's proficiency (medium armor proficiency is now a derived value); the Ring of Djinni Summoning waits 24 hours from the djinni's departure and is spent if it dies; the Staff of the Python becomes its snake, turned back on a bonus action and shattered if it dies; the Staff of Swarming Insects adds Insect Cloud, obscuring for everybody but its user.

## 0.286.0 - 2026-10-19

- A shadow's Sunlight Weakness holds only in sunlight; the berserker's and minotaur's Reckless is a free action before they attack; an orc's Aggressive moves it toward a hostile it sees on a bonus action; a knight's Leadership gives allies it sees, who hear and understand it, a d4 on attacks and saves for a minute, ending if the knight is incapacitated.

## 0.285.0 - 2026-10-19

- The Wand of Polymorph, the Helm of Teleportation and the Eyes of Charming cast their spells from their charges, and a Potion of Invisibility makes its drinker invisible for an hour until they attack or cast a spell.

## 0.284.0 - 2026-10-19

- Wind Walk's cloud form can revert (a minute incapacitated) and lands safely when it ends; Forcecage is always a cage or a 10-foot box that also blocks spells, and a creature teleporting out makes a Charisma save first; Hunter's Mark moves to a new quarry on a bonus action once its target drops.

## 0.283.0 - 2026-10-19

- The bowl, brazier, censer and stone of commanding elementals summon their elemental as Conjure Elemental does, once a dawn; the silver Horn of Valhalla calls 2d4 + 2 berserkers for an hour, once a week; the Ring of Djinni Summoning calls its djinni while you concentrate; and the Staff of Swarming Insects casts Giant Insect.

## 0.282.0 - 2026-10-19

- Stat blocks that print a save trait now roll it: Turn Resistance and Turn Defiance against Turn Undead (the ghast's reaching ghouls within 30 feet), Dark Devotion, Brave, Duergar Resilience and Sure-Footed, and the kraken ignores difficult terrain and magical restraint.

## 0.281.0 - 2026-10-19

- Forcecage traps whoever is inside its 20-foot cage, and Wind Walk gives 300 feet of flight, resistance to nonmagical weapons and only the Dash action.

## 0.280.0 - 2026-10-19

- Arcane Hand's Grasping Hand grapples with the hand's Strength and advantage on the small, Forceful Hand follows whoever it pushes, Interposing Hand lasts until another command, and only the very strong pass through the hand.

## 0.279.0 - 2026-10-19

- Chain Lightning leaps within 30 feet of its first target, Antilife Shell stops reach through it and ends when carried over a creature it hedges out, and Death Ward ends after it works and also negates being slain outright.

## 0.278.0 - 2026-10-19

- The Wand of Wonder's gems strike everyone in their line for an even share of 1d4 × 10, and its petrification is instant on a save failed by 5 or more.

## 0.277.0 - 2026-10-19

- The Efreeti Bottle's first roll holds: an attacking efreeti fights 5 rounds and the bottle loses its magic, a servant returns twice more and then escapes, and the wishes spend the bottle.

## 0.276.0 - 2026-10-19

- Command does nothing to a creature that doesn't understand its caster; every creature and character has its languages.
- The Rod of Absorption makes spell slots only up to 5th level, and only of levels its holder has slots of.

## 0.275.0 - 2026-10-18

- Arcane Hand calls a Large hand of force with its caster's hit points and spell attack, moved and commanded with a bonus action.
- The hand strikes with Clenched Fist, pushes with Forceful Hand, grapples and crushes, or gives its caster half cover with Interposing Hand.
- Clenched Fist and the crush grow with higher slots.

## 0.274.0 - 2026-10-18

- Chain Lightning leaps to up to three more targets, and one more for each slot level above 6th.
- Death Ward leaves its creature at 1 hit point the first time it would drop to 0.
- Antilife Shell keeps everything but undead and constructs out of the 10 feet around its caster.

## 0.273.0 - 2026-10-18

- Mislead turns its caster invisible and leaves an illusory double; Project Image sets an image down within 500 feet. Attacks and areas pass through either image, and whoever touched it is never fooled again.

## 0.272.0 - 2026-10-18

- Enthrall ends for a creature that can no longer hear its caster.

## 0.271.0 - 2026-10-18

- The Rod of Absorption absorbs for a reaction, stops at 50 levels ever, is found with 1d10 and pays for spell slots.
- The Ioun Stones of Absorption and Greater Absorption cancel spells for a reaction, only from casters their holder can see; the lesser stone works at last.
- The Ring of Spell Storing and the Ioun Stone of Reserve are found holding a few spells.

## 0.270.0 - 2026-10-18

- The Rod of Lordly Might's buttons turn it into a flame tongue, a +3 battleaxe or a +3 spear, and back.

## 0.269.0 - 2026-10-18

- The Wand of Wonder rolls its whole table: spells at DC 15, a stunned or shrunken wielder, rain, butterflies, a stray beast, a blinding burst and creeping stone.

## 0.268.0 - 2026-10-18

- Bags of Tricks come in gray, rust and tan, and each pulls a random beast from its own table, three a day.
- An Efreeti Bottle rolls what its efreeti does: attack you, serve you for an hour, or grant three wishes.

## 0.267.0 - 2026-10-18

- Scrolls of Telekinesis, Vampiric Touch, Call Lightning, Heat Metal and Eyebite, and the Staff of the Magi's Telekinesis, can be used again on later turns while you concentrate, without spending the item again.
- Enthrall ends if you are incapacitated or silenced.
- Enthrall and Geas count as being charmed, so anything that can't be charmed shrugs them off.

## 0.266.0 - 2026-10-18

- Reverse Gravity's Dexterity save is made as it is cast, so a creature that grabs on is never lifted.
- Storm of Vengeance's gusts force concentration saves on whoever starts a turn under them and blow away fog.
- Wind Wall turns aside ordinary arrows and bolts shot into, out of or across it; a giant's boulders go through.
- Charm Person and Enthrall are saved against with advantage by a creature you or your friends are fighting.

## 0.265.0 - 2026-10-18

- Geas charms its target, and attacking you or your friends costs it 5d10 psychic damage.
- Enthrall gives disadvantage on Perception to spot anyone but you.
- Telekinesis moves a creature that loses a contest of your spellcasting ability against its Strength, up to 30 feet and into the air, and holds it.
- A giant's Rock Catching catches any hurled rock, and a shield guardian's Shield guards only whoever wears its amulet.
- The Grappler feat can pin a creature you grapple.

## 0.264.0 - 2026-10-18

- Storm of Vengeance rains acid, then lightning, hail, and freezing gusts on its later turns.
- Reverse Gravity lifts everyone in it who fails to grab hold, and drops them when it ends.
- Siege Monster creatures deal double damage to walls and objects.
- Preserve Life shares five times the cleric's level among up to six allies, up to half their maximum.
- The warhorse's Trampling Charge follows with another hooves attack at a prone target.

## 0.263.0 - 2026-10-18

- Blade Barrier gives three-quarters cover, and Gaseous Form's flight is its holder's only movement.
- Vampires and vampire spawn don't regenerate in sunlight or running water.
- Wind Wall keeps out small fliers and creatures in gaseous form.
- Figurines of Wondrous Power come back after their printed days, Wings of Flying after 1d12 hours.

## 0.262.0 - 2026-10-18

- The hydra loses heads to heavy damage and grows them back unless burned, with a bite and an opportunity reaction for each head and save advantage while it has more than one.
- The Grappler feat and the mimic's Grappler give advantage against a creature their holder is grappling.

## 0.261.0 - 2026-10-18

- Clay and flesh golems roll for Berserk at the start of each turn when hurt, attacking the nearest creature until healed in full.
- The assassin's Assassinate, the bugbear's and doppelganger's Surprise Attack and the doppelganger's Ambusher work against surprised and not-yet-acted targets.
- Gnolls and giant hyenas Rampage after dropping a creature.
- Pounce and Trampling Charge follow up with their bonus-action attack on the prone target.
- The marilith reacts on every turn.

## 0.260.0 - 2026-10-18

- Conjure Elemental, Conjure Fey, Conjure Celestial, Conjure Minor Elementals, Animate Dead, Create Undead, Giant Insect and Find Steed call their creatures, more or stronger with higher slots.
- A conjured elemental or fey turns on its caster when concentration breaks.
- A wraith raises a specter from a humanoid that died within the last minute, up to seven.
- Fire makes a flesh golem fight and act at disadvantage; cold slows a water elemental by 20 feet.
- The Gem of Seeing has its own truesight again.

## 0.259.0 - 2026-10-18

- The Staff of Thunder and Lightning's Thunder and Lightning strikes and thunders at once, once a dawn.
- Faithful Hound bites a hostile creature within 5 feet at the start of each of your turns, for 8 hours.
- Mephits' Death Burst and the balor's Death Throes go off as they die.
- Flesh golems and shambling mounds are healed by lightning, clay golems by acid, iron golems by fire.

## 0.258.0 - 2026-10-18

- Water Walk and the Ring of Water Walking let you walk and stand on water.
- A net does nothing to formless creatures, and 5 slashing damage to the net (AC 10) cuts its target free.
- The Staff of Thunder and Lightning adds Thunderclap and its once-a-dawn Lightning and Thunder on a hit.
- The Rod of Lordly Might is a +3 mace with Terrify, Drain Life and Paralyze.
- Antimagic Field sets aside creatures that spells called while it covers them.

## 0.257.0 - 2026-10-18

- The Rod of Absorption and the Ioun Stone of Greater Absorption take in spells aimed only at you.
- The Ring of Spell Turning gives advantage on saves against spells aimed only at you and turns them back on a 20.
- The Ring of Spell Storing, the Ioun Stone of Reserve and the shield guardian store spells to cast later.
- Feeblemind also stops magic items and allows a new save every 30 days. Branding Smite reaches 9d6.
- Heated Body and Fire Form burn whoever grapples or shoves them, and the Cloak of Displacement stops working while you can't move.

## 0.256.0 - 2026-10-18

- Antimagic Field stops spells and magic items inside it, and constructs that need magic stop moving.
- The rakshasa shrugs off spells of 6th level or lower.
- The Staffs of Power, the Magi and the Woodlands offer their full spell lists, including the Magi's free spells.

## 0.255.0 - 2026-10-18

- Potions of Giant Strength raise your Strength to the giant's score for an hour.
- Manuals and Tomes raise a score and its maximum by 2 for good.
- Feeblemind drops its target's Intelligence and Charisma to 1 and stops them casting spells.
- Magic Weapon grows to +2 and +3 with higher slots, and Branding Smite adds a d6 for each slot above 2nd.
- Alchemist's fire burns 1d4 at the start of each of its target's turns. Anyone next to a creature can put out its fire or free it from a net.

## 0.254.0 - 2026-10-18

- Mirror Image: three illusory duplicates draw attacks, each destroyed when hit.
- Blink: on an 11 or higher at the end of each turn you vanish until your next turn.
- Time Stop: you take 1d4 + 1 turns in a row, ending early if you affect anyone else.
- Fire Shield burns or chills whoever hits you in melee. Azers, salamanders, remorhazes and fire elementals burn melee attackers.
- Arrow-Catching Shield: +2 AC against ranged attacks, and your reaction makes you the target of a ranged attack at a nearby ally.
- Adamantine Armor turns critical hits into normal hits.
- The net restrains its target until a DC 10 Strength check, and the blowgun deals its 1 piercing damage.
- Sharks, octopuses, quippers and sea horses can only breathe underwater.
- Boots of Striding and Springing triple your jumps. The Cloak of Displacement gives attackers disadvantage until you take damage. The Ioun Stone of Awareness keeps you from being surprised.

## 0.253.0 - 2026-10-18

- Magic Weapon: +1 to hit and damage, and the weapon counts as magical.
- Shillelagh: a club or quarterstaff attacks with your spellcasting ability, deals a d8 and counts as magical.
- Oil of Sharpness: +3 to hit and damage with slashing and piercing weapons for an hour.
- True Strike: advantage on your first attack roll against the target on your next turn.
- Branding Smite: your next weapon hit deals 2d6 more radiant damage and keeps the target visible and lit.
- Air, fire and water elementals can stop in an enemy's space. The fire elemental sets creatures on fire when it enters their space or touches them. A burning creature can use its action to put the fire out.
- A rider whose mount falls prone can use their reaction to land on their feet.
- Sacred Weapon makes the weapon magical.

## 0.252.0 - 2026-10-18

- Under water: without a swim speed, melee attacks have disadvantage except with a dagger, javelin, shortsword, spear or trident. Ranged attacks stop at normal range and have disadvantage except with a crossbow, net or thrown weapon. Fire damage is halved.
- You hold your breath for 1 + your Constitution modifier minutes before you start to drown. Water Breathing, its potion and amphibious creatures breathe under water.
- Jumping: jump your Strength score in feet after a 10-foot run-up, or half that from standing.
- Jump, Step of the Wind, Remarkable Athlete and Second-Story Work make your jumps longer.
- Death saving throws count as saves, so Bless and Aura of Protection add to them.
- Beacon of Hope: advantage on Wisdom and death saving throws, and the most hit points from any healing.

## 0.251.0 - 2026-10-18

- You can move through a hostile creature's space when it is at least two sizes larger or smaller than you. Another creature's space costs double movement, and you can't end your move there.
- Halfling Nimbleness: a halfling can move through the space of any creature larger than them.
- Ghosts, specters, wraiths and will-o'-wisps move through creatures and objects as difficult terrain, taking 1d10 force damage if they end a turn inside an object. Air, fire and water elementals move through creatures.
- Mounted combat: mount a willing ally at least one size larger than you, for half your speed. A mount you control moves with you and can only Dash, Disengage or Dodge, while an intelligent mount acts on its own. If your mount falls prone or is pushed, make a DC 10 Dexterity save or fall off prone.
- When you move while grappling a creature, you drag it with you at half speed, unless it is two or more sizes smaller than you.

## 0.250.0 - 2026-10-18

- Glibness: for an hour, any Charisma check you make rolls at least 15.
- Detect Evil and Good shows you aberrations, celestials, elementals, fey, fiends and undead within 30 feet, even hidden ones.
- Meteor Swarm drops four 40-foot spheres at points you choose up to a mile away, each dealing fire and bludgeoning damage.
- Oath of Devotion: Sacred Weapon. Use Channel Divinity to add your Charisma modifier (at least +1) to weapon attack rolls for a minute, while your weapon sheds light.
- A Scroll of Passwall can be read at a Prismatic Wall to destroy its green layer.
- Pact of the Chain's Find Familiar and a tiefling's racial spells count as the spells themselves wherever a rule names them.

## 0.249.0 - 2026-10-18

- Passwall can be cast at a Prismatic Wall to destroy its green layer once the layers before it are gone.
- Prismatic Wall's red layer stops nonmagical ranged attacks, its orange layer magical ones, and its indigo layer spells cast through it, each while that layer stands.
- Prismatic Wall spares you and the creatures you pick as you cast it, rather than your whole side.

## 0.248.0 - 2026-10-17

- Find Familiar's familiar is a celestial, fey or fiend of your choice, and it can be set up before a fight.
- Seeing through its eyes and Voice of the Chain Master work only on your own familiar.
- Pact of the Chain: give up one of your attacks to let your familiar attack with its reaction.
- A Ring of Free Action lets you cross difficult terrain at full speed.
- Holy Aura wards the creatures you choose within 30 feet as you cast it. A fiend or undead that hits one in melee must make a Constitution save or be blinded.
- Prismatic Wall is a wall or sphere of seven layers, each with its own save and effect, destroyed one at a time in order. It spares your allies and blinds others who come near.

## 0.247.0 - 2026-10-17

- A Periapt of Health holds off every disease you already carry, Contagion's included.
- Continual Flame lasts until dispelled.
- Freedom of Movement: magic can't lower your speed, and you can slip out of a grapple or nonmagical restraints for 5 feet of movement.
- A Ring of Free Action keeps magic from paralyzing or restraining you or lowering your speed.
- Holy Aura gives your allies within 30 feet advantage on saving throws, makes attacks against them harder, and makes them shed dim light.
- The black pudding and ochre jelly split even when the damage that splits them does nothing to them.

## 0.246.0 - 2026-10-17

- Antipathy/Sympathy can be cast on an object or an area: its aura spreads from the object to the kind of creature you name.
- Find Familiar calls your familiar (bat, cat, owl and the other SRD forms), which takes its own turns and can't attack. As an action you can see through its eyes, blind and deaf to your own surroundings until your next turn.
- Pact of the Chain's familiar can also be an imp, pseudodragon, quasit or sprite. Voice of the Chain Master lets you see through it at any time.
- Gaze of Two Minds lets you see through a willing humanoid's senses.
- A pact weapon left more than 5 feet away from you for a minute disappears.

## 0.245.0 - 2026-10-17

- Wish can cast any other spell of 8th level or lower, each listed on its own.
- Black puddings and ochre jellies split in two when lightning or slashing damage leaves them at 10 hit points or more.
- Freedom of Movement works: no paralysis or restraint from spells or magic items, and difficult terrain is ignored.
- The Ring of Feather Falling prevents falling damage. The Periapt of Health holds off diseases you already have.
- The aboleth's disease allows healing underwater.
- Long effects now last their full time, up to a day: Aid, Heroes' Feast, Mind Blank, Mage Armor, Foresight, Darkvision and more. Hunter's Mark lasts longer from higher slots, and a 9th-level Bestow Curse lasts until dispelled.
- Prismatic Spray's Violet ray is saved against on the caster's turn, and a failure sends the creature away.
- The package now needs Capability API 1.483.

## 0.244.0 - 2026-10-17

- Bestow Curse is one spell again, with all nine curses to pick from. Cast from a 4th-level slot it lasts 10 minutes, and from a 5th-level slot or higher it lasts 8 hours or 24 hours with no concentration. Its extra necrotic damage now lands on spells with a save too.
- Compulsion lets its targets act before they walk.
- Aid works: up to three allies gain 5 hit points and maximum hit points, 5 more for each slot level above 2nd. Heroes' Feast raises maximum hit points by 2d10.
- The package now needs Capability API 1.473.

## 0.243.0 - 2026-10-17

- Prismatic Spray works: each creature in the cone gets its own d8 ray off one Dexterity save. Red, Orange, Yellow, Green and Blue deal 10d6 fire, acid, lightning, poison or cold damage (half on a save). Indigo restrains, with a Constitution save each turn: three successes end it, three failures turn the target to stone. Violet blinds, and a failed Wisdom save after that banishes the target. Special strikes with two more rays.
- The package now needs Capability API 1.468.

## 0.242.0 - 2026-10-17

- Bestow Curse works, the curse picked as it is cast: disadvantage on one ability's checks and saves, disadvantage on attacks against the caster, a wasted action on a failed Wisdom save each turn, or an extra 1d8 necrotic damage from the caster's attacks.
- Compulsion works: targets that fail the Wisdom save are walked as far as they can toward the point the caster picks with a bonus action (Compulsion: Direct), with a new save at the end of each turn. Creatures that can't be charmed are unaffected.
- Every spell that takes 10 minutes or longer to cast is off the fight menu, and the GM can have it cast before the fight starts. Heroes' Feast now protects up to twelve allies for the whole fight.
- Hallow's extra effect can work on one creature type picked as it is cast, or on everybody.
- Hallow's Extradimensional Interference works: creatures it affects can't teleport into, out of or within the area.
- The package now needs Capability API 1.467.

## 0.241.0 - 2026-10-17

- Spells with a 1-minute casting time take 10 rounds to cast in a fight, with the caster concentrating on the casting: Magic Circle, Symbol, the Conjure spells, Foresight, Regenerate and others.
- Glyph of Warding and Hallow take longer than a fight to cast, so they are off the fight menu. The GM sets them up before the fight starts, and a hidden glyph is placed without being announced.
- Magic Circle cast in reverse also gives disadvantage to attacks from inside against creatures outside, and the creatures it holds can't charm or frighten anyone outside.
- Stepping into Hallow ends any charm or fear a warded creature put on you. Hallow's extra effects are spell choices: Courage, Darkness, Daylight, Energy Protection, Energy Vulnerability, Fear and Silence, with a Charisma save to ignore them.
- The package now needs Capability API 1.462.

## 0.240.0 - 2026-10-17

- Glyph of Warding and Symbol are hidden from enemies until someone finds one with a Search, an Intelligence (Investigation) check against the caster's spell save DC. The new Investigation check reads the sheet's skill, or a creature's printed Investigation or Intelligence modifier.
- Spells that need no concentration keep going after their caster falls or leaves: Glyph of Warding, Symbol, Magic Circle, Hallow, Grease, Guardian of Faith and Plant Growth.
- Symbol's Fear (frightened, drops what it holds and flees the glyph) and Hopelessness (can't attack or harm anyone for a minute) are now spell choices too.
- The package now needs Capability API 1.457.

## 0.239.0 - 2026-10-17

- Symbol works: the glyph waits where it was drawn, and when anyone but the caster steps on it, it fills a 60-foot sphere with dim light for 10 minutes, striking everyone inside, anyone who enters, and anyone who ends a turn there. Death (10d10 necrotic, Constitution save for half), Discord, Insanity, Pain, Sleep and Stunning are separate spell choices. Fear and Hopelessness come later.
- Glyph of Warding can hold a spell: when you draw it, pick one of your prepared spells of the glyph's level or lower. Whoever sets the glyph off is hit with that spell.
- The package now needs Capability API 1.454.

## 0.238.0 - 2026-10-17

- Magic Circle works: celestials, elementals, fey, fiends and undead can't walk into the 10-foot circle, attack anyone inside it at disadvantage, and can't charm or frighten anyone inside. Pick all five kinds or just one as separate spell choices. The reversed circle traps those kinds inside instead.
- Hallow's ward works: those five kinds can't walk into the area and can't charm or frighten anyone inside it.
- The package now needs Capability API 1.452.

## 0.237.0 - 2026-10-17

- Glyph of Warding's explosive runes work: the glyph waits where it was drawn and goes off when anyone but the caster steps on it, hitting everyone within 20 feet with 5d8 damage (Dexterity save for half, 1d8 more for each slot level above 3rd). Pick acid, cold, fire, lightning or thunder as a separate spell choice, as with Protection from Energy.
- The package now needs Capability API 1.451.

## 0.236.0 - 2026-10-17

- Divine Word works: up to 20 creatures that can hear the caster make a Charisma save. One that fails is deafened at 50 hit points or fewer, also blinded at 40 or fewer, also stunned at 30 or fewer (for a minute, 10 minutes or an hour), and killed at 20 or fewer. A celestial, elemental, fey or fiend that fails is sent back to its plane.
- The package now needs Capability API 1.450.

## 0.235.0 - 2026-10-17

- A demon or mephit can send away the creatures it summoned, as an action.
- The package now needs Capability API 1.449.

## 0.234.0 - 2026-10-17

- Primeval Awareness lasts a minute for each level of the spell slot spent, and the ranger can pick its favored-terrain reach of 6 miles instead of 1 mile.
- The package now needs Capability API 1.448.

## 0.233.0 - 2026-10-17

- Demons and mephits can summon help, the SRD's variant: once a day, a vrock, hezrou, glabrezu, nalfeshnee, marilith or balor picks which demons to call and has a 30 or 50 percent chance; a mephit has a 25 percent chance of 1d4 more of its kind. They fight on its side for a minute, leave if it dies, and cannot summon others. The balor's goristro is not in the SRD, so the balor picks among the other five.

## 0.232.0 - 2026-10-17

- Divine Intervention comes back by itself 7 days of game time after an answered call, counted when the GM says days pass; rests in between leave it spent. The counter's new recharge choice is Week (7 days).

## 0.231.0 - 2026-10-17

- Divine Intervention works: as an action, the cleric rolls percentile dice and is answered on a roll at or under their cleric level, always from 20th level. An answered call spends Divine Intervention, which comes back on no rest (the GM gives it back after 7 days); an unanswered one spends a new Divine Plea use instead, back after a long rest. The GM decides what the deity does.
- Primeval Awareness works: as an action and a spell slot, for a minute the log says which of aberrations, celestials, dragons, elementals, fey, fiends and undead are within a mile, never where or how many.

## 0.230.0 - 2026-10-17

- Lesser Restoration ends the disease or condition the caster picks among those the target has, not the first on its list, from a spell scroll too. (Greater Restoration already lets the caster pick.)
- The guided builder's Class features step takes up to 40 picks, so a 20th-level monk or rogue can take every feature (it stopped at 20).

## 0.229.0 - 2026-10-17

- Rage ends when the barbarian is knocked unconscious while still above 0 hit points, by the Sleep spell or anything else that puts them to sleep.

## 0.228.0 - 2026-10-17

- Divine Sense works: as an action, until the end of the paladin's next turn, no celestial, fiend or undead within 60 feet that is not behind total cover can hide from them.

## 0.227.0 - 2026-10-17

- Beast Spells and Archdruid apply only to druid spells: rows whose Class is Druid, or Any for a single-class druid. A multiclass druid's other spells, marked by class, are not kept in Wild Shape and still need their components.
- Rage: a raging barbarian can't cast spells (from scrolls and items too) or concentrate, and raging ends any concentration they hold. Rage ends when they drop to 0 hit points.

## 0.226.0 - 2026-10-17

- Rage ends at the end of a turn in which the barbarian neither attacked a hostile creature nor took damage since their last turn, the turn they rage on included. Persistent Rage: from 15th level it no longer ends that way.

## 0.225.0 - 2026-10-16

- Beast Spells: an 18th-level druid casts spells in Wild Shape, except those with a material component.
- Archdruid: a 20th-level druid ignores verbal, somatic and costless material components, so Silence and a gag don't stop those spells. Spells with a costly or consumed material are tagged with a new `material_cost` component.

## 0.224.0 - 2026-10-16

- Sorcerous Restoration: a 20th-level sorcerer regains 4 spent sorcery points at the end of each short rest, never past their most.

## 0.223.0 - 2026-10-16

- Intimidating Presence: a 10th-level Berserker's action frightens a creature within 30 feet that fails a Wisdom save (8 + proficiency + Charisma) until the end of their next turn, kept up with an action each turn; it ends beyond 60 feet or out of sight, and a creature that saves is spared until the barbarian's long rest.

## 0.222.0 - 2026-10-16

- Land's Stride: a ranger (8th) or Circle of the Land druid (6th) walks the board's difficult terrain and plants as plain ground, and has advantage on saves against Entangle and Wall of Thorns. A spell's lasting difficult terrain still slows them.
- Unarmored Movement at 9th level: an unarmored monk runs up walls of any height and across water on their turn, coming ashore if they would stop on it.

## 0.221.0 - 2026-10-16

- The Hunter's Defensive Tactics offers Escape the Horde (opportunity attacks against the ranger have disadvantage) and Multiattack Defense (+4 AC against a creature's later attacks that turn once it hits) beside Steel Will.

## 0.220.0 - 2026-10-16

- New sheet fields for a ranger's favored enemies and favored terrain and a Draconic sorcerer's ancestry damage type, in the builder's Levels step.
- Foe Slayer: once a turn, a 20th-level ranger adds their Wisdom modifier to an attack that would miss a favored enemy, or to its damage.
- Elemental Affinity: spells of the ancestry's damage type deal the Charisma modifier more, and 1 sorcery point gives an hour's resistance to it.
- Natural Explorer doubles the proficiency bonus on Intelligence and Wisdom checks the Game Master ties to the favored terrain.

## 0.219.0 - 2026-10-16

- Hunter's Multiattack is a choice: Volley shoots every foe within 10 feet of a point in the ranger's weapon range, and Whirlwind Attack strikes every foe within 5 feet, each with its own attack roll.
- Horde Breaker, a new Hunter's Prey choice: once a turn, after a weapon attack, the ranger can attack another creature within 5 feet of the first with the same weapon.

## 0.218.0 - 2026-10-16

- Dispel Magic can be aimed at a lasting area or wall another spell left standing, such as a Wall of Fire, ending it on the same terms as a spell on a creature.
- A Spell Scroll of Dispel Magic now casts it at 3rd level, and the Staff of the Magi casts it for 3 charges.
- Cleansing Touch lets the paladin pick which spell ends.

## 0.217.0 - 2026-10-16

- Tranquility: an 11th-level Open Hand monk ends each long rest under a sanctuary at their ki save DC, held from fight to fight until they attack or cast a spell at an enemy.
- Sanctuary stops only attacks and harmful spells, and ends only on an attack or a spell that affects an enemy, so healing a friend keeps it. Nature's Sanctuary stops only attacks.

## 0.216.0 - 2026-10-16

- Dispel Magic ends the spells on a creature: those up to the slot's level outright, higher ones on a spellcasting check against 10 + their level. A concentration spell it ends is gone from everyone it held.
- Cleansing Touch: a 14th-level paladin can touch themself or an ally to end the highest-level spell on them, Charisma modifier times (at least once) a long rest.

## 0.215.0 - 2026-10-16

- Sanctuary: a creature that attacks the warded creature, or aims a harmful spell at it, makes a Wisdom save against the caster's DC first; failed, its attack goes to the nearest other creature or is lost. Areas still catch the warded creature, and the ward ends when it attacks or casts a spell.
- Nature's Sanctuary: a 14th-level Land druid makes beasts and plants that attack them save against their spell save DC first, and one that saves is free of it for the rest of the fight.

## 0.214.0 - 2026-10-16

- Retaliation: a 14th-level Berserker hurt by a creature within 5 feet can strike back at it with their best melee weapon as a reaction.
- Giant Killer, a new Hunter's Prey choice: when a Large or larger creature within 5 feet that the ranger can see attacks them, hit or miss, the ranger strikes back as a reaction.
- Stand Against the Tide, a new Superior Hunter's Defense choice: when a melee attack misses the ranger, they can make the attacker repeat it against another creature of their choice.

## 0.213.0 - 2026-10-16

- Disciple of Life: a Life cleric's healing spells of 1st level or higher heal each creature 2 + the spell's level more.
- Blessed Healer: when such a spell heals somebody else, the cleric regains 2 + the spell's level too.

## 0.212.0 - 2026-10-16

- Fiendish Resilience works in a fight: after a rest, write the chosen damage type before "except magic_weapon silvered" in its Damage resistances cell (for example "fire except magic_weapon silvered"). Magic weapons and silvered weapons get through it; spells of that type are still resisted.
- Magic weapons, magic ammunition, staffs used as magic quarterstaffs, pact weapons and the weapon attacks of creatures whose weapons are magical now carry a "Magic weapon" tag.

## 0.211.0 - 2026-10-16

- Step of the Wind: a monk can spend 1 ki to Dash or Disengage as a bonus action. Empty Body: 4 ki for a minute of invisibility and resistance to all but force. Stillness of Mind ends one charm or fright with an action.
- Steel Will (Hunter) gives advantage on saves against being frightened. Nature's Ward keeps charms and frights from elementals and fey off. Second-Story Work climbs as fast as the walk.
- Favored Enemy gives advantage on tracking and recalling lore when the Game Master applies it. Eldritch Master gives back every pact slot once a long rest.
- Rage at 20th level and Wild Shape with Archdruid are unlimited.
- Deflect Missiles' throw back has a 20/60-foot range and rolls the Martial Arts die.

## 0.210.0 - 2026-10-16

- Reliable Talent: an 11th-level rogue treats a d20 roll of 9 or lower as a 10 on any ability check with a skill they are proficient in.
- Indomitable Might: an 18th-level barbarian whose Strength check total is less than their Strength score uses the score in its place.
- Jack of All Trades: from 2nd level a bard adds half their proficiency bonus, rounded down, to every ability check without proficiency: untrained skills, plain ability checks and initiative.
- Remarkable Athlete: from 7th level a Champion adds half their proficiency bonus, rounded up, to every Strength, Dexterity and Constitution check without proficiency, initiative too. It doesn't stack with Jack of All Trades.

## 0.209.0 - 2026-10-15

- Elusive: no attack roll has advantage against an 18th-level rogue who can act.
- Danger Sense: a barbarian has advantage on Dexterity saves against effects they can see, unless blinded, deafened or unable to act.
- Primal Champion: a 20th-level barbarian's Strength and Constitution go up by 4.

## 0.208.0 - 2026-10-15

- Deflect Missiles: when a ranged weapon hit is reduced to 0 and the monk has a hand free, they can catch the missile and, for 1 ki as part of the same reaction, throw it back with proficiency, dealing its own damage dice and type plus the higher of their Strength or Dexterity modifier.

## 0.207.0 - 2026-10-15

- Overchannel: a 14th-level evoker can deal maximum damage with a wizard spell of 1st to 5th level. The first use after a long rest is free; each later one deals 2d12 necrotic damage per spell level to the wizard, 1d12 more per level each time, ignoring resistance and immunity.
- Supreme Healing: a 17th-level Life cleric's healing spells restore the most their dice can.

## 0.206.0 - 2026-10-15

- School of Evocation: Sculpt Spells spares 1 + the spell's level creatures the wizard picks from their evocation spells (a made save, and nothing where a save would halve); Potent Cantrip leaves half a cantrip's damage on a made save; Empowered Evocation adds the Intelligence modifier to one damage roll of an evocation spell.

## 0.205.0 - 2026-10-15

- Deflect Missiles: a monk hit by a ranged weapon attack can use their reaction to take 1d10 + Dexterity modifier + monk level less damage from it.
- Slow Fall: a monk of 4th level or higher who falls can use their reaction to take five times their monk level less falling damage.

## 0.204.0 - 2026-10-15

- Dark One's Blessing: a Fiend warlock who drops a hostile creature to 0 hit points gains temporary hit points equal to their Charisma modifier + warlock level (at least 1).

## 0.203.0 - 2026-10-15

- Font of Inspiration: from 5th level a bard's Bardic Inspiration comes back on a short rest as well as a long one.
- Superior Inspiration (bard 20th) gives back one Bardic Inspiration, and Perfect Self (monk 20th) 4 ki, when initiative is rolled with none left.

## 0.202.0 - 2026-10-15

- Arcane Recovery (wizard) and Natural Recovery (Circle of the Land druid) give back spent spell slots the player picks, with a combined level of up to half the class level rounded up and none of 6th level or higher, once per long rest.

## 0.201.0 - 2026-10-15

- Warding Bond can be cast in a fight: the warded ally gets +1 AC and saves and resists all damage, the caster takes the same damage the ally takes, and the bond ends at 0 hit points or beyond 60 feet.

## 0.200.0 - 2026-10-15

- A halfling's Lucky rerolls a 1 on an attack roll, saving throw or ability check in a fight, and the new roll stands.

## 0.199.0 - 2026-10-15

- A swallow ends the grapple, as printed.
- The kraken's bite swallows a Large or smaller creature its tentacles hold.
- An ally beside a gelatinous cube or a water elemental can pull a creature out with a Strength check; the cube burns the one pulling for 3d6 acid.
- The rug of smothering's Smother grapples, blinds and restrains one creature and hurts it each turn, and the smothered creature takes half of each blow to the rug.

## 0.198.0 - 2026-10-15

- Barkskin keeps its target's Armor Class at 16 or better while the caster concentrates.
- Mage Armor gives a creature not wearing armor an Armor Class of at least 13 + its Dexterity modifier, plus any shield or ring it wears.

## 0.197.0 - 2026-10-15

- The behir, remorhaz, purple worm and tarrasque regurgitate a creature that hurts them enough from inside, and swallowed creatures climb out of a dead swallower.
- Swallowers, the shambling mound, the gelatinous cube and the water elemental hold only as many creatures as printed.
- Constrict, the ettercap's Web and Smother can only be aimed at a target of the printed size.
- The shambling mound grapples and engulfs a target both its slams hit.

## 0.196.0 - 2026-10-15

- A half-orc drops to 1 hit point instead of 0 once per long rest (Relentless Endurance).
- A raging barbarian of 11th level who drops to 0 makes a Constitution save to stay at 1, harder each time until a rest (Relentless Rage).
- In Wild Shape and Shapechange a proficient save or skill uses your proficiency with the form's ability, or the form's own bonus if higher.

## 0.195.0 - 2026-10-15

- Grapples and other riders printed "If the target is Medium or smaller" hold only targets that size or smaller.
- The behir, giant frog, giant toad, remorhaz, tarrasque and purple worm swallow what they bite, with acid each turn inside them.
- The gelatinous cube walks over creatures and engulfs them, with an action to escape; the shambling mound engulfs a creature it holds.
- The water elemental's Whelm holds a Large or smaller creature and crushes it each turn.

## 0.194.0 - 2026-10-15

- Zombies' Undead Fortitude and boars' Relentless leave them at 1 hit point as printed.
- Wild Shape turns a druid into any beast the Beast Shapes table allows, with a bonus action back.
- Polymorph and True Polymorph (each with an unwilling choice and a Wisdom save) and Shapechange change a creature's shape, and metallic dragons, the couatl and the deva use Change Shape.
- Conjure Animals and Conjure Woodland Beings call any beast or fey of the band's challenge rating, and more of them from a higher slot.
- Blood Frenzy's advantage holds on melee attacks only.

## 0.193.0 - 2026-10-15

- Conjure Animals and Conjure Woodland Beings call creatures to your side for the spell's hour of concentration, by the printed choice of how many, and so do their scrolls.
- Figurines of Wondrous Power become their creatures when thrown, and an Elemental Gem calls its elemental.
- Fly, Spider Climb, Levitate (an unwilling target saves on Constitution), Gaseous Form, Dragon Wings, Potions of Flying and Climbing, Wings of Flying, the Broom of Flying and Boots of Levitation give their ways of moving in a fight.
- Trolls, oni, shield guardians and vampires regenerate at the start of their turns, and a Champion's Survivor heals at half hit points or less.

## 0.192.0 - 2026-10-15

- Pack Tactics (16 creatures) and Blood Frenzy (5 creatures) give advantage beside an ally of the creature or against a hurt target.
- Hunter's Prey: Colossus Slayer is a choice of its own: 1d8 more once a turn on a weapon hit against a hurt creature.
- Divine Strike adds 1d8 radiant (2d8 from cleric 14) once on each of the cleric's own turns.

## 0.191.0 - 2026-10-14

- Teleport, Word of Recall and Plane Shift take the caster and willing allies out of the fight (eight, five and eight of them). Teleport can also land anywhere on the board.
- Plane Shift (Banish): a melee spell attack and a failed Charisma save send a creature away for good.

## 0.190.0 - 2026-10-14

- Draconic Presence: an 18th-level Draconic Bloodline sorcerer spends 5 sorcery points for an aura of awe or fear. Foes starting their turn within 60 feet save or are charmed or frightened, and a success keeps them clear of it.

## 0.189.0 - 2026-10-14

- Mystic Arcanum: the guided builder asks a warlock for one 6th-, 7th-, 8th- and 9th-level warlock spell at 11th, 13th, 15th and 17th level, each cast once a long rest without a slot.
- Spell Mastery: an 18th-level wizard picks a 1st- and a 2nd-level wizard spell to cast at will at their lowest level.
- Signature Spells: a 20th-level wizard picks two 3rd-level wizard spells, each cast once a short rest without a slot.

## 0.188.0 - 2026-10-14

- Magic Resistance works on the 31 SRD monsters that print it: advantage on saves against spells and other magical effects.
- Charge, Pounce and Trampling Charge work on 21 monsters (boar, lion, tiger, elephant, unicorn, warhorse and more): extra damage or a Strength save against being knocked prone after a straight run.
- The hobgoblin's Martial Advantage and the spy's and assassin's Sneak Attack add their dice once a turn.
- The half-orc's Savage Attacks adds one more weapon die to a melee critical.

## 0.187.0 - 2026-10-13

- Fits the Engine's 256 KB limit on a ruleset file, which 0.186.0 was over, so the Engine dropped it. The classes, backgrounds, languages, tools, fighting styles and weapons now ship as catalog files, and `ruleset.json` is written compact. No rule changes.

## 0.186.0 - 2026-10-13

- Ships as one `ruleset-5e-2014-0.186.0.ruleset.json` file instead of a package zip (held Engine catalog work, number given when it lands upstream). No rule changes.

## 0.185.0 - 2026-10-12

- Uses Capability API 1.786 (poses for characters drawn in layers; art only, no rule changes).
- An invisible or camouflaged party member is drawn sneaking as they move, as one who has hidden already is.
- Cleric and paladin spells and features are cast kneeling in prayer instead of the plain cast.

## 0.184.0 - 2026-10-11

- Uses Capability API 1.337 (dice a rest spends to heal, one entry per pool).
- A short rest spends hit dice: each die plus your Constitution modifier, from the pool the Game Master names or the biggest die first, multiclass included.
- Song of Rest works: a bard's party heals an extra 1d6 (1d8 at 9th, 1d10 at 13th, 1d12 at 17th) when it spends hit dice.

## 0.183.0 - 2026-10-11

- Uses Capability API 1.317 (Legendary Resistance, an item's use held to a size).
- Legendary Resistance works: the 23 creatures that print it turn their first three failed saves in a fight into successes, and the fight log counts them down.
- A spell scroll of Resilient Sphere now reaches only a Large or smaller creature, as the spell does.

## 0.182.0 - 2026-10-11

- Uses Capability API 1.314 (a condition that shuts its holder away, targets up to a size).
- Resilient Sphere works: a Dexterity save or a Large or smaller creature is shut in for a minute. Nothing passes in or out, it can roll the sphere at half speed with its action, others can pick it up with theirs, and Disintegrate breaks it without harming the one inside.

## 0.181.0 - 2026-10-11

- Uses Capability API 1.313 (Maze, Expeditious Retreat, a casting's choices, capped ability adds).
- Maze works: no save, the creature is gone but keeps its turns, and it escapes on a DC 20 Intelligence check (a minotaur always does). A new Intelligence check joins the fight's checks.
- Expeditious Retreat Dashes when cast, then offers a bonus-action Dash each turn.
- Eyebite lets the caster pick any of its three effects again each turn.
- The Hammer of Thunderbolts binds only with a giant-strength belt and ogre-power gauntlets worn, and adds 4 Strength (up to 30).
- The Ioun Stones of Agility, Insight, Intellect, Leadership and Strength and the belt of dwarvenkind add 2 to their score, up to 20.

## 0.180.0 - 2026-10-11

- Uses Capability API 1.312 (a thunderclap around a weapon's hit).
- The Hammer of Thunderbolts can be hurled for a charge (20/60 feet): on a hit the target and everyone within 30 feet make a DC 17 Constitution save or are stunned until the end of the wielder's next turn. It has 5 charges and regains 1d4 + 1 at dawn.
- Giant's Bane: a natural 20 against a giant forces a DC 17 Constitution save or it dies.

## 0.179.0 - 2026-10-11

- Uses Capability API 1.311 (appliesSelf on an item's use, creature actions that slay the dying, conditions ended by moving or acting).
- The will-o'-wisp's Consume Life works: a bonus action against a dying creature within 5 feet, which dies on a failed DC 10 Constitution save and heals the wisp 3d6. Using it ends the wisp's invisibility.
- A scroll of Sunbeam leaves the mote in its reader's hand, with the later lines.
- Camouflage for Hide in Plain Sight comes off when the ranger moves or does anything but hide.
- Fix: Call Lightning's bolt catches only creatures within 5 feet of its point; it had the 60-foot cloud's reach.

## 0.178.0 - 2026-10-11

- Uses Capability API 1.310 (used again while concentrating, conditions that end at a distance).
- While concentrating, Vampiric Touch's attack and Call Lightning's bolt are offered again as an action, and Heat Metal's damage as a bonus action on the same target, for no slot.
- Eyebite can target another creature each turn as an action, never one that made its save against this casting.
- Eyebite's Panicked ends once the target is at least 60 feet away and can't see the caster.

## 0.177.0 - 2026-10-11

- Uses Capability API 1.309 (hiding's needs, Feral Senses, surprise from a hidden start, the binding ritual).
- Hide in Plain Sight's +10 now needs the Camouflaged condition, set on the sheet after the minute's camouflage, and a wall or tree beside the ranger.
- Feral Senses: no disadvantage attacking a creature the ranger can't see.
- A gelatinous cube surprises whoever it starts hidden from.
- The pact weapon's ritual: write the magic weapon's name in the sheet's new Pact weapon note (during a short rest) and only that weapon is bound.

## 0.176.0 - 2026-10-11

- Uses Capability API 1.308 (beams on an item's use, thrown weapons conjured).
- The pact weapon can now take any of the SRD's 28 melee weapons, the dagger, handaxe, javelin, light hammer, spear and trident too, and can be dismissed for free.
- A scroll of eldritch blast (more beams with its reader's level), Magic Missile or Scorching Ray, and the wand of magic missiles, can send every beam, dart or ray at one target.
- With this Engine One with Shadows also ends on a reaction, and Chains of Carceri bars only the same creature, not every one of its kind.

## 0.175.0 - 2026-10-11

- Uses Capability API 1.307 (a creature's own concentration, conditions ended by a named action, conditions on a spell's caster).
- The imp, quasit, sprite, duergar, green hag and will-o'-wisp stay invisible only while they concentrate: damage can end it. The quasit's Scare and the duergar's Enlarge end it too.
- The invisible stalker is always invisible.
- Sunbeam puts a mote of sunlight (30 feet bright, 30 dim) in its caster's hand while it lasts, and the caster can fire a new line as an action.

## 0.174.0 - 2026-10-11

- Uses Capability API 1.306 (a weapon put in hand, amends with damage of their own and more strikes).
- Pact of the Blade puts a pact weapon in the warlock's hand with an action: any SRD melee weapon that is not thrown, or a magic melee weapon they hold, used with proficiency and magical.
- Lifedrinker adds necrotic damage equal to the Charisma modifier (at least 1) to its hits, and Thirsting Blade attacks with it twice.

## 0.173.0 - 2026-10-11

- Uses Capability API 1.305 (targets that grow with the sheet, one target named more than once).
- Eldritch blast fires two beams at 5th level, three at 11th and four at 17th, each its own attack roll; Agonizing Blast and Repelling Blast apply to every beam.
- Eldritch blast's beams, Magic Missile's darts and Scorching Ray's rays can go at one target or several.

## 0.172.0 - 2026-10-11

- Uses Capability API 1.304 (once a creature until a rest).
- Chains of Carceri can't be used on the same creature again until the warlock finishes a long rest.

## 0.171.0 - 2026-10-11

- Uses Capability API 1.303 (uses only in some light, conditions that moving or acting ends).
- One with Shadows: in dim light or darkness, a warlock's action makes them invisible until they move or take an action.

## 0.170.0 - 2026-10-11

- Uses Capability API 1.302 (entries that change another).
- Agonizing Blast adds the warlock's Charisma modifier to each eldritch blast hit, Eldritch Spear gives it 300 feet of range, and Repelling Blast pushes a creature it hits 10 feet away, or not, as the warlock chooses. They stack.

## 0.169.0 - 2026-10-11

- Uses Capability API 1.301 (zones carried with somebody, copies set down apart and moved together).
- Darkness and Daylight cast on the caster's own space are on an object they hold, and move with them, light, dispelling reach and all.
- Dancing Lights are four lights, each within 20 feet of another, moved together with a bonus action.

## 0.168.0 - 2026-10-11

- Uses Capability API 1.300 (a higher slot's more every second level, and on what a condition gives).
- Flame Blade's Strike grows with the slot the blade was cast with: 3d6 at 2nd and 3rd level, 4d6 at 4th, 5d6 at 6th, 6d6 at 8th.
- Spiritual Weapon deals 1d8 more for every two slot levels above 2nd.

## 0.167.0 - 2026-10-10

- Uses Capability API 1.299 (darkness that puts out spell light, magical light, Daylight's reach).
- Darkness puts out the light of a 2nd-level or lower spell it meets (Light, Flame Blade, Produce Flame, Continual Flame), and only magical light lights it: a torch inside it lights nothing, the sun blade or a flame tongue still does.
- The light of every magic item is magical.
- Daylight ends only darkness its 60-foot bright sphere meets, not its dim light beyond.

## 0.166.0 - 2026-10-10

- Uses Capability API 1.298 (light that is sunlight, light out under a condition).
- The sun blade's light is sunlight: drow, kobolds and other sunlight-sensitive creatures attack with disadvantage in it.
- The imp, quasit, sprite, duergar, green hag and will-o'-wisp turn invisible with an action, until they attack (or cast a spell, where printed). The will-o'-wisp's light goes dark while it is invisible.

## 0.165.0 - 2026-10-10

- Uses Capability API 1.297.
- The guided builder has Pact Boon and Eldritch Invocations steps: a warlock picks a pact at 3rd level and as many of the 32 SRD invocations as Invocations Known gives, each offered once its prerequisite is met. They go on new Pact boon and Eldritch invocations lists.
- Pact of the Chain learns Find Familiar; Pact of the Tome picks three cantrips of any class; Book of Ancient Secrets two 1st-level rituals.
- Devil's Sight sees 120 feet in darkness and through Darkness. Beguiling Influence trains Deception and Persuasion.
- An invocation that casts a spell casts it in a fight: at will with no slot, or once per long rest with a pact slot. Chains of Carceri holds only a celestial, fiend or elemental.

## 0.164.0 - 2026-10-10

- Uses Capability API 1.297 (light from areas, darkness ended, light that shows the invisible).
- Daylight lights a 60-foot sphere at a point (dim 60 feet beyond) and ends a Darkness of 3rd level or lower it meets. Darkness is magical darkness.
- Dancing Lights is a glowing form shedding dim light 10 feet, moved 60 feet with a bonus action.
- The bullseye lantern lights a cone ahead (60 feet bright, 60 more dim), turned with a bonus action.
- The lantern of revealing shows invisible creatures in its bright light.
- Light can be cast on a hostile's held object, which a Dexterity save avoids.
- Flame Blade is cast with a bonus action and sheds light (10 and 10); each strike with it is an action that spends no slot.
- Produce Flame hurls 30 feet (before, only at touch range), or can be held for light (10 and 10) and hurled on a later turn.
- Devils' darkvision sees through Darkness (Devil's Sight). The cloud giant's innate spells get a save DC (15) from its Charisma.

## 0.163.0 - 2026-10-10

- Uses Capability API 1.296 (lights monsters switch, and light an item sheds switched off).
- The magmin begins with its flames out and sets itself ablaze (10 feet bright, 10 dim) or puts them out with a bonus action.
- The will-o'-wisp sets its light to 5, 10, 15 or 20 feet with a bonus action, starting at 20.
- A hooded lantern or lantern of revealing with its hood down sheds dim light in a 5-foot radius.

## 0.162.0 - 2026-10-10

- Uses Capability API 1.295 (putting a light out and lighting it again).
- A character's torch can be put out and lit again in a fight, free once a turn: with it out they may go unseen in the dark.
- The hooded lantern, lantern of revealing and gem of brightness light up with an action, a flame tongue (40 feet bright, 40 dim) with its bonus-action command word, and the sun blade (15 and 15) as its blade appears with a bonus action. They start unlit.

## 0.161.0 - 2026-10-10

- Uses Capability API 1.294 (darkness, darkvision and light).
- In darkness nobody is seen, and in dim light nobody is seen clearly, except with darkvision (darkness as dim light, dim light as bright) or truesight, blindsight and tremorsense within range. Caves and dungeons are dark at any hour.
- A character without darkvision carries a torch: bright light 20 feet, dim 20 more.
- Light, Daylight and Continual Flame shed light from whoever holds the lit thing, and Fire Shield and Holy Nimbus from the caster. A candle, lamp, hooded lantern, torch and lantern of revealing shed light while carried, and the mace of disruption while held.
- The azer, fire elemental, giant fire beetle and nightmare shed their Illumination.

## 0.160.0 - 2026-10-10

- Uses Capability API 1.293 (monsters' attack rolls by light).
- Sunlight Sensitivity puts disadvantage on the attack rolls of the drow, duergar, kobold, wight, wraith, specter and drider in sunlight, and the cloaker's Light Sensitivity in bright light.

## 0.159.0 - 2026-10-10

- Uses Capability API 1.292 (own ways of hiding and finding the hidden).
- A lightfoot halfling can hide behind somebody at least one size larger (Naturally Stealthy).
- A ranger's Hide in Plain Sight adds 10 to the Stealth total until the ranger moves or acts, a thief's Supreme Sneak hides with advantage after moving no more than half speed, and a rogue's Blindsense finds anyone hidden within 10 feet unless deafened.
- The gelatinous cube starts a fight hidden in plain sight (Transparent, DC 15) until it moves or attacks.

## 0.158.0 - 2026-10-10

- Uses Capability API 1.291 (monsters' own ways of hiding and looking).
- The goblin's Nimble Escape, the spy's Cunning Action and the shadow's Shadow Stealth let them Hide (and Disengage or Dash) as a bonus action.
- Keen senses, Two Heads, Sunlight and Light Sensitivity and the Camouflage traits change monsters' Perception and Stealth rolls, and their passive Perception.
- Eight monsters use their printed passive Perception.

## 0.157.0 - 2026-10-10

- Uses Capability API 1.290 (Stealth and Perception changes on Hide and Search).
- Armor's disadvantage on Stealth now applies to Hide, and the elvenkind items, Cloak of the Bat, Eyes of the Eagle and Robe of Eyes give their advantage on Hide or Search.
- Passive Perception is 5 higher with advantage on Perception and 5 lower with disadvantage.
- Cloak of Elvenkind puts disadvantage on Perception checks made to find its wearer, passive ones too.
- Pass without Trace works: its caster and allies within 30 feet have +10 on Stealth for its hour.

## 0.156.0 - 2026-10-10

- Uses Capability API 1.289 (a wind that takes a while).
- Gust of Wind blows Stinking Cloud away after blowing on it for a whole round, as the SRD's "disperses it after 1 round" says. Before, the wind left it.

## 0.155.0 - 2026-10-10

- Uses Capability API 1.288 (Ready).
- Ready works: on your turn you pick an attack, a spell or a move to hold, and whether it goes off when an enemy you can see comes within reach of it or when an enemy you can see finishes doing something. When that happens you take it with your reaction, or let it go. It's held until the start of your next turn. A readied spell spends its slot as you ready it and is held with concentration: if the concentration breaks it is lost, and if it never goes off the slot stays spent. Before, Ready did nothing.

## 0.154.0 - 2026-10-10

- Uses Capability API 1.287 (real Hide, Search and Detect).
- Hide works: it rolls Stealth, and you are hidden from each enemy that can't see you clearly (behind a wall, in a fog or darkness it can't see through, while you are invisible, or in dim light or the cape's smoke) and whose passive Perception your total meets. A creature you are hidden from can't target you, and your attacks on it have advantage. Attacking, harming somebody, forcing a save or casting a spell with a verbal component gives you away; so does being seen clearly. Before, Hide only set a flag.
- The new Search action rolls Perception and finds whoever hides from you with a lower Stealth total.
- Creatures hide and look with their printed Stealth and Perception, or their Dexterity and Wisdom modifiers.
- The aboleth's and the dragons' Detect legendary action (1 point) works, bought at the end of other creatures' turns. Before, it was only text.

## 0.153.0 - 2026-10-10

- Uses Capability API 1.286 (light obscurement and wind).
- The Cape of the Mountebank leaves its smoke: when its wearer casts Dimension Door, a cloud stands where they left and where they land until the end of their next turn. It only lightly obscures, so it hides nobody.
- Gust of Wind blows away Fog Cloud, Cloudkill, Incendiary Cloud and the cape's smoke where its line meets them, ending the spell that holds them. Darkness, Sleet Storm and Stinking Cloud stay (Stinking Cloud's strong wind takes a round, which is still text).

## 0.152.0 - 2026-10-10

- Uses Capability API 1.285 (a move after the action, on one speed).
- The dragons' Wing Attack works in full on a board: it catches every creature within 10 feet of an adult dragon (15 of an ancient one), and the dragon can then fly up to half its flying speed. Before, it caught two creatures in reach and the flight was dropped.

## 0.151.0 - 2026-10-10

- Uses Capability API 1.284 (legendary casts).
- The lich's Cantrip (1 point) and the androsphinx's and gynosphinx's Cast a Spell (3 points) legendary actions work, bought at the end of other creatures' turns. The lich casts any of its cantrips; a sphinx casts any of its prepared spells, using a spell slot as on its own turn. Before, both were only text.

## 0.150.0 - 2026-10-10

- Uses Capability API 1.283 (legendary moves).
- The tarrasque's, vampire's and mummy lord's legendary moves work, bought at the end of other creatures' turns. The tarrasque moves up to half its speed (1 point). The vampire moves up to its speed without provoking opportunity attacks (1 point). The mummy lord's Whirlwind of Sand (2 points) moves it up to 60 feet, letting go of any grapple or restraint, and nothing can harm or hold it on the way. Before, all three were only text.

## 0.149.0 - 2026-10-10

- Uses Capability API 1.282 (bursts around their user, through walls).
- The mummy lord's Channel Negative Energy legendary action works: every other creature within 60 feet of it, behind walls and around corners too, can't regain hit points until the end of its next turn. Before, it was only text.
- Eyebite works in a fight. The caster picks Asleep, Panicked or Sickened for a creature they can see within 60 feet that fails a Wisdom save. Asleep is Sleep's slumber, which wakes on damage or a shake. Panicked is frightened of the caster and fleeing, as Fear makes it. Sickened gives disadvantage on attack rolls and ability checks, saved off at the end of each of its turns. Before, Eyebite did nothing in a fight.

## 0.148.0 - 2026-10-10

- Uses Capability API 1.281 (blows that heal their maker).
- Vampiric Touch heals its caster half the necrotic damage it deals. Before, it only dealt the damage.
- The aboleth's Psychic Drain legendary action works: 3d6 psychic to a creature it has charmed, and the aboleth regains the damage dealt. Before, it was only text.
- Arcane Sword stays for its minute: as a bonus action each turn the sword moves 20 feet and attacks again. Before, it attacked once when cast.

## 0.147.0 - 2026-10-10

- Uses Capability API 1.280 (a creature's teleport with a strike).
- The blink dog's Teleport works as printed: "Before or after teleporting, the dog can make one bite attack." It can bite and then teleport away, or teleport in and then bite, all as one action. Before, the bite and the teleport were two separate actions.
- **Fix:** the blink dog's Teleport recharges on a 4-6, as SRD 5.1 prints it; the source data left the recharge out, so it could teleport every turn.

## 0.146.0 - 2026-10-10

- Uses Capability API 1.279 (teleports out of the fight).
- The unicorn's Teleport can now take it out of the fight to its familiar place a mile away, with up to three willing allies within 5 feet that it can see; before, it could only land on the board and took allies it couldn't see. It still lands on the board when it picks a place there. A unicorn that leaves got away, its hit points kept, and the Engine's director makes it leave at a quarter of its hit points.

## 0.145.0 - 2026-10-10

- Uses Capability API 1.278 (Calm Emotions' remaining rules).
- Calm Emotions: the caster's allies may now choose to fail the save, and do. Its indifference covers the caster's whole side instead of only the caster, and ends when the creature is attacked (hit or miss), harmed by any spell, or sees one of its friends harmed; before, any damage ended it and nothing else did.

## 0.144.0 - 2026-10-10

- Uses Capability API 1.277 (five or six conditions from one use, and fear that needs real sight).
- A Berserker's Mindless Rage works: while raging they can't be charmed or frightened, and any charm or fright already on them is held off until the rage ends. A Frenzied Rage does the same.
- More legendary actions work: the kraken's Fling and Lightning Storm, the lich's Paralyzing Touch, the mummy lord's Dreadful Glare, the tarrasque's tail attack and Swallow, the vampire's unarmed strike, and the unicorn's Hooves, Heal Self and Shimmering Shield (+2 AC to itself or an ally until the end of its next turn). Before, they were only text, or the first of two choices.
- Frightened's disadvantage and Antipathy's fright now need their holder to really see the source: blindness, fog, darkness or an invisible source lift them, not only a wall.

## 0.143.0 - 2026-10-10

- Uses Capability API 1.276 (teleports).
- Misty Step teleports its caster up to 30 feet to a place they can see, as a bonus action. Dimension Door goes up to 500 feet and can take one willing ally within 5 feet. Their scrolls work too, and the Cape of the Mountebank casts Dimension Door once a dawn.
- The balor, marilith, nalfeshnee, androsphinx, gynosphinx and solar teleport up to 120 feet to a place they can see (the sphinxes and the solar as a legendary action), and the blink dog up to 40 feet. The unicorn teleports once a day up to a mile, taking up to three willing allies within 5 feet; it lands on the board.
- Sympathy's drawn creatures can now step about within 5 feet of the target; before, they couldn't move once there.

## 0.142.0 - 2026-10-10

- Uses Capability API 1.275 (conditions held off rather than ended).
- Antipathy's fright pauses while its victim is more than 60 feet away and can't see the target, and comes back when it returns, as the SRD says. Its disadvantage needs the target in sight; its keeping away holds in sight or within 60 feet. The far-off save still ends it for good. It counts as frightened for every immunity, cure and save bonus.
- Calm Emotions works. Humanoids in its 20-foot sphere that fail a Charisma save have their charms and frights held off until it ends (they come back if their time is left), or, as its other choice, become indifferent to the caster until harmed.

## 0.141.0 - 2026-10-10

- Uses Capability API 1.274 (numbers fixed off whoever put a condition on, a save on harm from its source, staying in reach, a kind named as a scroll is read).
- Heroism gives the caster's spellcasting modifier in temporary hit points at the start of each of its target's turns, and takes what is left when it ends.
- Antipathy/Sympathy saves at the caster's spell save DC instead of 18. Sympathy keeps a drawn creature within 5 feet once it gets there, and lets it save again when the target harms it. Its scroll works, naming the kind as it is read.
- Fix: monsters now save with their ability modifier where their stat block lists no saving throw bonus. Before, every unlisted save was +0 (a goblin's Wisdom save was +0 instead of -1, an ogre's Constitution save +0 instead of +3).

## 0.140.0 - 2026-10-10

- Uses Capability API 1.273 (charges spent on a weapon hit).
- After a hit, the Staff of Power spends a charge on Power Strike (1d6 force), the Staff of Striking 1 to 3 charges for 1d6 force each, and the Staff of Withering a charge for 2d10 necrotic and a DC 15 Constitution save against an hour of disadvantage on Strength and Constitution checks and saves.

## 0.139.0 - 2026-10-10

- Uses Capability API 1.272 (an item that becomes another on its last charge).
- When their last charge rolls a 1, the staffs of charming and the woodlands become a nonmagical quarterstaff, and the Staff of Power a +2 quarterstaff that keeps only its +2.

## 0.138.1 - 2026-10-10

- A scroll of Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word, Prayer of Healing or Spiritual Weapon adds its reader's spellcasting ability modifier, as the spell does.

## 0.138.0 - 2026-10-10

- Uses Capability API 1.271 (an item's first use named, a sheet value added to a use, more push a charge, charges back on a last-charge roll).
- Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word, Prayer of Healing and Spiritual Weapon add the caster's spellcasting ability modifier; the Staff of Healing adds its holder's.
- A staff's or wand's first spell is named on its menu, and the Wand of Fear's first use is its Cone of Fear.
- The Ring of the Ram pushes 5 feet farther for each charge more.
- The Staff of the Magi gets 1d12 + 1 charges back when its last charge rolls a 20, and the Staff of Power 1d8 + 2.

## 0.137.0 - 2026-10-10

- Uses Capability API 1.270 (a kind named as a spell is cast, auras by kind or by sight, saves rolled only far off).
- Antipathy/Sympathy works as two picks: the caster names a creature type, family, dragon colour or people, and creatures of that kind within 60 feet or in sight save or are driven off or drawn in.
- Monsters carry their family (vampire, golem, hag and more), dragon colour and people as tags.

## 0.136.0 - 2026-10-09

- Uses Capability API 1.269 (an item's save DC and attack bonus read off its holder, more charges for more).
- The staffs of charming, fire, frost, healing, power, swarming insects, the magi and the woodlands, and the wand of binding, cast their fight spells, each for its printed charges, at the holder's spell save DC and attack bonus (the wand at DC 17).
- The wands of fireballs, lightning bolts and magic missiles cast a level higher for each more charge, the staff of healing's Cure Wounds up to 4th, and the ring of the ram hits 2d10 harder a charge.
- Magic Missile makes one more dart for each slot level above 1st.

## 0.135.0 - 2026-10-09

- Uses Capability API 1.269 (averting the eyes, saves failed by 5, auras by who they reach, saves leaning in sight, immunity once an effect ends, up to 320 conditions).
- The basilisk's and medusa's gazes can be avoided by averting the eyes, which leaves the gazer unseen.
- A save against the medusa's gaze failed by 5 or more petrifies at once.
- The sea hag's Horrific Appearance frightens humanoids only, with disadvantage on the repeated save while she is in sight, and once the fright ends she can't frighten that creature again.
- The barbed devil's Barbed Hide hurts whoever is grappling it.

## 0.134.0 - 2026-10-09

- Uses Capability API 1.267 (any one sense, targets near each other, growing areas, more item uses, held shields).
- Turn Undead and Turn the Unholy reach undead that can see or hear the user.
- Command, Charm Person, Hold Person and Hold Monster need their targets within 30 feet of each other; Acid Splash hits two creatures within 5 feet of each other.
- Confusion and Fog Cloud grow with a higher slot.
- The Wand of Fear's Command (flee or grovel, 1 charge) sits beside its Cone of Fear.
- Fear and the Cone of Fear end on one save. Nine monsters' printed shields fall when they drop what they hold.

## 0.133.0 - 2026-10-09

- Uses Capability API 1.266 (dropping what is held, keep-out rings, saves out of sight, destroying by challenge rating).
- Fear makes its targets drop what they hold, and its save is rolled only out of the caster's sight; a cornered target acts freely.
- Command has its Drop word: the target drops what it holds and ends its turn.
- Turned creatures and the Wand of Fear's cone stay out of 30 feet when they can.
- Destroy Undead: a cleric of 5th level or higher destroys undead of a low enough challenge rating that fail Turn Undead's save.

## 0.132.0 - 2026-10-09

- Uses Capability API 1.265 (auras that need senses, harm on the holder's turn, or ask a save).
- A balor's Fire Aura burns everyone within 5 feet as the balor's own turn starts.
- Countercharm reaches only allies who can hear the bard, so Silence stops it.
- Holy Nimbus's advantage is against spells cast by fiends and undead, not every magic.
- A pit fiend's Fear Aura, a gibbering mouther's Gibbering, the basilisk's and medusa's Petrifying Gaze and the ghast's and hezrou's Stench ask their saves as a creature starts its turn nearby.

## 0.131.0 - 2026-10-09

- Uses Capability API 1.264 (conditions that decide their holder's turn, and saves spent an action on).
- Turn Undead and Turn the Unholy spend Channel Divinity: undead (or fiends) within 30 feet that fail a Wisdom save flee for a minute or until damaged, only Dashing, or Dodging when cornered.
- Command has Approach, Flee, Grovel and Halt picks, one more target per slot level, never on undead.
- Confusion (a 10-foot sphere) and Mindfire roll a d10 each turn: wander, do nothing, lash out at whoever is near, or act normally.
- Irresistible Dance has no save to resist; the dancer spends their action on a Wisdom save to stop.
- Fear makes its frightened creatures Dash away each turn.
- The Wand of Fear's Cone of Fear works.

## 0.130.0 - 2026-10-09

- Uses Capability API 1.263 (auras, and conditions kept on all fight).
- The paladin's Aura of Protection adds their Charisma modifier (at least +1) to their own and nearby allies' saves; Aura of Courage and Aura of Devotion keep fear and charms off. All three reach 10 feet, and 30 feet from 18th level.
- Holy Nimbus burns enemies in its light for 10 radiant as their turns start, for a minute, once per long rest.
- Purity of Spirit keeps Protection from Evil and Good on all the time.
- Countercharm gives the bard and allies within 30 feet advantage on saves against fear and charms until the end of the bard's next turn.
- A balor's Fire Aura burns everyone within 5 feet for 3d6 fire.

## 0.129.0 - 2026-10-09

- Uses Capability API 1.262 (qualities on a stat block's action).
- 19 monster actions their stat block calls magical are magic in a fight: Healing Touch heals as magic, and saves against charms, songs and the like are saves against magic.

## 0.128.0 - 2026-10-09

- Uses Capability API 1.261 (conditions brought on by damage, a clock that runs out into another condition, cures narrowed by level, a lasting rest loss given back on a cure, healing kept to magic, and stat block cures).
- Slimy Doom stuns the creature until the end of its next turn whenever it takes damage.
- The diseased giant rat's disease keeps off all but magical healing; healing spells now count as magical.
- The aboleth's Tentacle gives a disease with no effect for a minute; then the creature can't regain hit points and only a disease-curing spell of 6th level or higher, like Heal, ends it.
- Curing the death dog's or the otyugh's disease gives back the hit point maximum it took.
- The deva's, planetar's, solar's and unicorn's Healing Touch cure what they print.

## 0.127.0 - 2026-10-09

- Uses Capability API 1.260 (conditions that lower the hit point maximum at a rest; counted saves rolled out as a fight ends).
- The diseased giant rat's, death dog's and otyugh's diseases lower the hit point maximum at each long rest (1d6, or 1d10 on a failed Constitution save). A made save cures the otyugh's.
- The mummy's and mummy lord's Rotting Fist curse a creature with mummy rot. It can't regain hit points, its maximum drops 3d6 at each long rest, and Remove Curse or Greater Restoration ends it.
- Contagion's remaining saves are rolled when a fight ends, so the disease is shaken off or sets in by then.

## 0.126.0 - 2026-10-09

- Uses Capability API 1.259 (a rescue on a worn item's use, paid with its charges).
- The ring of evasion works: when its wearer fails a Dexterity save, the reaction and one of its 3 charges (1d3 back at dawn) make it a success.

## 0.125.0 - 2026-10-09

- Uses Capability API 1.258 (condition kinds, saves counted to end a condition or worsen it).
- Contagion works: the caster picks one of its six diseases, whose effects hold from the hit. Three failed Constitution saves at the ends of the target's turns set the disease in past the fight, and three made saves end it.
- The diseased giant rat's, death dog's and otyugh's bites give a disease that stays until cured; the death dog's and otyugh's leave the target poisoned while it lasts.
- Lesser Restoration, Lay on Hands (5 points), Heal and Mass Heal cure disease. Divine Health, Purity of Body, Nature's Ward and a periapt of health keep diseases off.

## 0.124.0 - 2026-10-09

- Uses Capability API 1.257 (an answer's dice off an ability check or damage roll; half on a miss from an item's use).
- Cutting Words also comes off an enemy's ability check or damage roll, and creatures that can't hear or can't be charmed are immune to it. A scroll of Acid Arrow deals half on a miss.

## 0.123.0 - 2026-10-09

- Uses Capability API 1.256 (a holder's own rescue die, a check's d20 as a 20, an entry never on its user, one condition of a group at a time).
- Bardic Inspiration can't target the bard, and a creature holds one Bardic Inspiration die at a time.
- Stroke of Luck's ability check counts the d20 as a 20. Peerless Skill and Dark One's Own Luck add their own dice to a failed check or save.

## 0.122.0 - 2026-10-09

- Uses Capability API 1.255 (a miss that deals half; a condition's harm that grows with the slot; Heightened Spell picks its target).
- Acid Arrow deals half its damage on a miss, and its later damage grows by 1d4 for each slot level above 2nd.

## 0.121.0 - 2026-10-09

- Uses Capability API 1.254 (Careful Spell picks who it spares; Empowered Spell over all damage dice).
- Acid Arrow deals its 2d4 later acid damage at the end of the target's next turn, and a higher slot adds 1d4 to the hit.
- Flame Strike, Ice Storm and Meteor Swarm deal both of their damage types (and their scrolls do too); before, only the first.

## 0.120.0 - 2026-10-09

- Uses Capability API 1.253 (entries chosen with a spell as it is cast).
- Metamagic works: the builder's Metamagic step picks options (two at 3rd level, one more at 10th and 17th), and Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle and Twinned Spell are offered with the spells they change, paid in sorcery points.

## 0.119.0 - 2026-10-09

- Uses Capability API 1.252 (a pool given back, past its maximum until a rest).
- Font of Magic turns a spell slot into sorcery points equal to its level, and sorcery points into a 1st- to 5th-level slot (2, 3, 5, 6 or 7 points) that vanishes at a long rest.

## 0.118.0 - 2026-10-09

- Uses Capability API 1.251 (a heal whose user picks how many uses to spend).
- Lay on Hands heals as many hit points as the paladin picks from the pool, never undead or constructs; Lay on Hands: Neutralize Poison spends 5 points to end poisoned.

## 0.117.0 - 2026-10-09

- Uses Capability API 1.250 (dice off an attack roll that hit, saves evaded).
- Cutting Words takes the bard's inspiration die off an attack that hits the bard or an ally within 60 feet; Evasion (rogue, monk, Superior Hunter's Defense) takes nothing from a made Dexterity half save and half from a failed one.

## 0.116.0 - 2026-10-09

- Uses Capability API 1.249 (dice held back for a roll that falls short, features spent by themselves on a failed roll).
- Bardic Inspiration, Guidance and Resistance add their die to a roll that falls short; Indomitable and Diamond Soul reroll a failed save; Stroke of Luck turns a miss into a hit or a failed check into a success.

## 0.115.0 - 2026-10-09

- Uses Capability API 1.248 (hit reactions by the budget that paid the strike, one of several answers per hit).
- Open Hand Technique works: on a Flurry of Blows hit, knock prone (Dex save), push 15 feet (Str save) or deny reactions until the end of the monk's next turn.

## 0.114.0 - 2026-10-09

- Uses Capability API 1.247 (entries before the first attack, attack changes by weapon or spell and melee or ranged, extra dice on criticals).
- Reckless Attack works: Strength melee weapon attacks have advantage this turn, and attacks against the barbarian until their next turn.
- Brutal Critical works: 1, 2 or 3 more weapon dice on a melee critical by barbarian level.

## 0.113.0 - 2026-10-09

- Uses Capability API 1.246 (what follows the Attack action matches held weapons by tags).
- Martial Arts' bonus unarmed strike follows an attack with a magic monk weapon such as a Dagger (+1).

## 0.112.0 - 2026-10-09

- Uses Capability API 1.245 (uses that spend several at once, saves that drop to 0, hit reactions by named attacks, conditions that harm as they end).
- Quivering Palm works: 3 Ki on an unarmed strike's hit, then End the Vibrations (a failed Con save drops the target to 0, a made one takes 10d10 necrotic) or end them harmlessly; one creature at a time.
- Hurl Through Hell works: once per long rest on any hit, the target is gone until the end of the warlock's next turn and comes back with 10d10 psychic unless it is a fiend.

## 0.111.0 - 2026-10-09

- Uses Capability API 1.244 (rows every attack list has, attack rules for held weapons).
- Every character has an Unarmed Strike; Martial Arts reaches held monk weapons and holds only without armor, shield or other weapons.

## 0.110.0 - 2026-10-09

- Uses Capability API 1.243 (an opportunity attack's hit is held like a turn's attack).
- Divine Smite and Stunning Strike work on opportunity attacks; a walker stunned that way stops.

## 0.109.0 - 2026-10-09

- Uses Capability API 1.242 (held entries that change named attacks, strikes after the Attack action).
- Martial Arts adds an Unarmed Strike with Dexterity, the martial arts die and a bonus-action strike; Flurry of Blows and Ki-Empowered Strikes work.

## 0.108.0 - 2026-10-09

- Uses Capability API 1.241 (answers to one's own weapon hit, damage added to the blow).
- Divine Smite, Improved Divine Smite and Stunning Strike work in a fight.

## 0.107.0 - 2026-10-09

- Uses Capability API 1.240 (initiative as a Dexterity check, features that roll it twice).
- Foresight and Cat's Grace give advantage on initiative, and so does Feral Instinct.

## 0.106.0 - 2026-10-08

- Uses Capability API 1.239 (shared uses, melee-only granted strikes, tracks moved as a condition ends).
- Berserker Frenzy: a Frenzied Rage spends a Rage use, gives a bonus-action melee weapon attack each turn, and leaves a level of exhaustion when the rage ends.

## 0.105.0 - 2026-10-08

- Uses Capability API 1.238 (an extra first-round turn).
- Thief's Reflexes gives a 17th-level thief a second turn in the first round at initiative minus 10, unless surprised.

## 0.104.0 - 2026-10-08

- Uses Capability API 1.237 (surprise).
- Foresight's target can't be surprised.
- Feral Instinct lets a surprised barbarian enter a rage on the first turn and then act normally.

## 0.103.0 - 2026-10-08

- Uses Capability API 1.236 (actions a condition gives, cures of what some creatures put on, sending somebody out of the fight).
- Dispel Evil and Good gives its caster Break Enchantment and Dismissal while it lasts, and either one ends the spell.
- Banishment banishes on a failed Charisma save: the target leaves the board, comes back if the spell ends early, and a creature of another plane stays gone after the full minute. It takes one more target per slot level above 4th, and its scroll banishes too.

## 0.102.0 - 2026-10-08

- Uses Capability API 1.235 (lowered maximums without their own save, a damage floor, targets by what they hold).
- The vampire's and vampire spawn's Bite lower the hit point maximum by the necrotic damage and heal the vampire by as much, aimed only at a creature it grapples or one incapacitated or restrained.
- The succubus/incubus Draining Kiss lowers the maximum by the damage it deals, aimed only at a creature it has charmed.
- Harm can't bring its target below 1 hit point, and lowers the maximum by its damage on a failed save.

## 0.101.0 - 2026-10-08

- Uses Capability API 1.204 (a cure that does one of its cures).
- Greater Restoration and its scroll do one of their effects, the caster's pick: end a charm or petrification, take a level of exhaustion off, or give back a lowered hit point maximum.

## 0.100.0 - 2026-10-08

- Uses Capability API 1.203 (blows that lower the health maximum).
- The specter's, wight's and wraith's Life Drain lowers the hit point maximum by the damage on a failed Constitution save until a rest, killing a creature brought to 0. The clay golem's Slam does the same until Greater Restoration ends it.

## 0.99.0 - 2026-10-08

- Uses Capability API 1.202 (conditions that end with another).
- Hypnotic Pattern's incapacitated ends with its charm, and Greater Restoration can end that charm.
- Sixteen monsters whose grapple restrains now restrain on the grab, and the restraint ends with the grapple.
- Rage's damage bonus ends with the rage.

## 0.98.0 - 2026-10-08

- Uses Capability API 1.201 (tracks moved by cures, sealed health given back, a broken section's cost step).
- Greater Restoration and its scroll also take a level of exhaustion off and give back hit points only a rest would have restored. The SRD's choice of one effect is not offered yet: the spell does all of them.
- Wall of Ice's frigid air deals 1d6 more cold for each slot above 6th.

## 0.97.0 - 2026-10-08

- Uses Capability API 1.200 (walls in sections).
- Wall of Ice stands in 10-foot sections with AC 12 and 30 hit points, vulnerable to fire, that attacks can break; a broken section leaves frigid air that deals 5d6 cold (Constitution save for half) to a creature moving into it. It can be a 10-foot dome, and its damage as it appears rises 2d6 a slot above 6th.

## 0.96.0 - 2026-10-08

- Uses Capability API 1.199 (health pools that pass some targets over).
- Sleep and Color Spray ignore creatures already unconscious or asleep, and Color Spray ignores creatures that can't see.

## 0.95.0 - 2026-10-08

- Uses Capability API 1.198 (a zone's own damage type).
- Wall of Thorns deals piercing as it appears and slashing to a creature that enters it or ends its turn there, each 1d8 more for each slot above 6th.

## 0.94.0 - 2026-10-08

- Uses Capability API 1.196 (targets picked by health left) and 1.197 (self actions on a turn, damage dice thrown again).
- Sleep and Color Spray roll their hit point pools and affect creatures from the lowest current hit points up. Elves and half-elves can't be put to sleep by Sleep.
- Power Word Stun stuns a creature with 150 hit points or fewer; Power Word Kill kills one with 100 or fewer.
- The duergar's Enlarge is an action, once a fight: Large for a minute, doubled damage dice on its War Pick and Javelin, and advantage on Strength checks and saves.

## 0.93.0 - 2026-10-08

- Uses Capability API 1.195 (conditions that change size).
- Enlarge makes its target one size bigger and Reduce one size smaller, for space and reach, growing only as big as there is room for.

## 0.92.0 - 2026-10-08

- Uses Capability API 1.194 (creature footprints).
- Large creatures fill 2 by 2 cells, Huge 3 by 3 and Gargantuan 4 by 4, for reach, movement, areas, cover and sight.

## 0.91.0 - 2026-10-08

- Uses Capability API 1.193 (contests against a fixed number, aimed at the held or dying, that stabilize; hit points only a rest heals).
- Stabilize (first aid): a DC 10 Wisdom (Medicine) check stabilizes a dying creature.
- Treat wounds: a DC 15 Wisdom (Medicine) check ends a sword of wounding's wounds.
- Hit points lost to a sword of wounding come back only with a rest.

## 0.90.0 - 2026-10-08

- Uses Capability API 1.192 (weapons that ignore resistance, slay riders on a made save, other weapons while marked).
- The vorpal sword ignores resistance to slashing damage.
- The mace of disruption frightens a fiend or undead that makes its save against destruction, until the end of the wielder's next turn.
- The oathbow's wielder has disadvantage with every other weapon while the sworn enemy stands.

## 0.89.0 - 2026-10-08

- Uses Capability API 1.191 (heals that restore nothing, condition immunity by source, a least ability score, saves against named actions).
- Chill Touch stops its target regaining hit points until the caster's next turn.
- Protection from Evil and Good keeps charms, domination and fear from aberrations, celestials, elementals, fey, fiends and undead off the target, with advantage on saves against ones already on.
- Tasha's Hideous Laughter can't target a creature with Intelligence 4 or less.
- Dragon scale mail's advantage covers only a dragon's Frightful Presence and breath weapons.

## 0.88.0 - 2026-10-08

- Uses Capability API 1.190 (weapon modes with their own range, extra on a hit, a line and charges).
- The javelin of lightning's Lightning bolt: a 120-foot line whose creatures make a DC 13 Dexterity save against 4d6 lightning (half on a success), then a ranged attack for the javelin plus 4d6 lightning; once a dawn.

## 0.87.0 - 2026-10-08

- Uses Capability API 1.189 (conditions that harm each turn and stack, one mark per source, weapons that read a mark, monster attacks by ability).
- Monster weapon attacks name Strength or Dexterity, so Weakening Breath and Ray of Enfeeblement reach a monster's own attacks.
- The sword of wounding wounds once a turn: 1d4 necrotic per wound at the start of the target's turns until a DC 15 Constitution save.
- The oathbow names a sworn enemy once a dawn, attacking it with advantage, ignoring cover and long range, for 3d6 more piercing.

## 0.86.0 - 2026-10-08

- Uses Capability API 1.188 with 1.187 (weapons that know what they hit).
- The mace of smiting is +3 against constructs and destroys one left at 25 hit points or fewer by a 20; the mace of disruption destroys a fiend or undead left at 25 or fewer that fails a DC 15 Wisdom save.
- The giant slayer knocks a giant prone on a failed DC 15 Strength save. The sword of life stealing gives temporary hit points equal to its necrotic damage.
- The dwarven thrower can be thrown (20/60 feet) and adds 1d8, or 2d8 against a giant, when thrown.
- The nine lives stealer (5 charges) and the vorpal sword kill outright on a 20, as the SRD allows.

## 0.85.0 - 2026-10-08

- Uses Capability API 1.188 (shared recharges, charges, attacks and checks by ability, 160 conditions).
- The metallic dragons breathe either weapon: brass Sleep, bronze Repulsion (a push), copper Slowing, gold Weakening (disadvantage on Strength saves, checks and attacks) and silver Paralyzing. Breathing one spends both; one recharge roll brings both back.
- The minotaur's and minotaur skeleton's Charge: a gore after a 10-foot straight run adds 2d8 piercing, and a creature fails a DC 14 Strength save or is pushed 10 feet and knocked prone.
- Rage gives advantage on Strength checks, and Enlarge/Reduce advantage or disadvantage. Enhance Ability works: one entry per choice, advantage on that ability's checks for an hour (Bear's Endurance with 2d6 temporary hit points), one more target per slot above 2nd.
- Stone and metal monsters (animated armor, flying sword, gargoyle, earth elemental, the golems) are inorganic and save against Shatter with disadvantage.

## 0.84.0 - 2026-10-08

- Uses Capability API 1.185 (saves and damage by what a target is, ability and charm-immunity gates, attacks rolled twice by or against a kind of creature, saves against what a kind of creature does).
- Undead and oozes save against Sunbeam and Sunburst with disadvantage, shapechangers against Moonbeam, and plants against Blight, which also deals them its maximum damage.
- Animal Friendship works: a beast with Intelligence 3 or less saves on Wisdom or is charmed until harmed, with one more beast for each slot above 1st.
- Chill Touch gives an undead it hits disadvantage on attacks against the caster until the end of the caster's next turn.
- Protection from Evil and Good and Dispel Evil and Good give the creature types they name disadvantage on attacks against their target. Foresight gives advantage on attacks, checks and saves, and disadvantage on attacks against its target.
- Dragon scale mail gives advantage on saves against dragons.

## 0.83.0 - 2026-10-08

- Uses Capability API 1.184 (creature actions that push, a line's width on an item's use).
- The dragon turtle's Tail pushes a creature 10 feet and knocks it prone on a failed DC 20 Strength save.
- Scrolls of Gust of Wind, Wall of Thorns and Blade Barrier can be read in a fight.

## 0.82.0 - 2026-10-08

- Uses Capability API 1.183 (zones that burst when they end and grow while they wait, zones that catch fire).
- Delayed Blast Fireball works: a bead held at a point that bursts for 12d6 fire (Dexterity for half) when the spell or concentration ends, adds 1d6 at the end of each of the caster's turns, and goes off when a creature moving onto it fails a Dexterity save. Each slot above 7th adds 1d6. A scroll of it can be read.
- Web burns: fire landing in it, or a fire area over it, sets it alight, dealing 2d4 fire to whoever starts a turn in it until the caster's turn, when the webs are gone.

## 0.81.0 - 2026-10-08

- Uses Capability API 1.182 (pushes, lines held from the caster and turned, senses that add).
- Gust of Wind works: a 60-foot, 10-foot-wide line from its caster for a minute that pushes creatures starting their turn in it 15 feet on a failed Strength save, makes walking toward the caster cost double, and turns with a bonus action.
- Thunderwave pushes creatures that fail their save 10 feet.
- The ring of the ram has 3 charges (1d3 back at dawn) and spends one on a +7 attack for 2d10 force that pushes 5 feet.
- Goggles of night add 60 feet to darkvision a wearer already has.

## 0.80.0 - 2026-10-08

- Uses Capability API 1.181 (wards by a spell's own level, saves passed outright or against poison, monster spell components, items that leave an area).
- Globe of Invulnerability keeps out spells of 5th level or lower even when cast with a higher slot, and one level more for each slot above 6th it is cast with.
- Stinking Cloud's save is against poison, so a dwarf has advantage on it, and creatures immune to poison or to being poisoned pass it without rolling.
- Monsters whose innate spellcasting needs no components, only verbal ones, or no material ones cast those spells that way, so Silence doesn't stop a unicorn's.
- Scrolls of Fog Cloud, Darkness, Silence and Globe of Invulnerability now have a use.

## 0.79.0 - 2026-10-08

- Uses Capability API 1.180 (conditions that end on attacking or casting, senses from spells and items, Faerie Fire against invisibility).
- Invisibility works in a fight: an hour of invisibility on a creature touched, one more creature per slot above 2nd, ending once it attacks or casts a spell.
- Darkvision gives darkvision out to 60 feet, See Invisibility lets its caster see the invisible, and True Seeing gives truesight out to 120 feet.
- Goggles of night give darkvision out to 60 feet, and a gem of seeing spends a charge for 10 minutes of truesight out to 120 feet (priced as a rare item used in a fight, 6,000 gp).
- Faerie Fire's outline shows invisible creatures.
- Reading a scroll or using a wand counts as casting a spell, and no longer needs components (SRD: a spell cast from an item "requires no components"), so Silence doesn't stop it.

## 0.78.0 - 2026-10-08

- Uses Capability API 1.179 (components, zones that hold conditions or stop components, wards).
- Every spell needs the verbal, somatic and material components the SRD prints, and so does reading its scroll.
- Silence is a 20-foot sphere for 10 minutes: creatures inside are deafened and immune to thunder damage, and nobody inside can cast a spell with a verbal component.
- Globe of Invulnerability is a 10-foot barrier around its caster for a minute: spells of 5th level or lower cast from outside it don't affect anyone inside.
- Stinking Cloud now makes each creature that starts its turn inside save on Constitution or lose its action that turn. Its scroll now has a use.
- Shatter hits everyone in its 10-foot sphere instead of one creature.

## 0.77.0 - 2026-10-07

- Uses Capability API 1.178 (senses, sight, obscuring areas).
- Dwarves, elves, gnomes, half-elves, half-orcs and tieflings have darkvision out to 60 feet, and monsters have the darkvision, blindsight, tremorsense and truesight their stat blocks print.
- Attacking a target you can't see has disadvantage, and attacking one that can't see you has advantage. Blindsight, tremorsense and truesight see invisible creatures.
- Fog Cloud, Stinking Cloud, Cloudkill, Incendiary Cloud and Sleet Storm heavily obscure their areas. Darkness can't be seen through even with darkvision, only with blindsight, tremorsense or truesight. Fog Cloud, Darkness and Stinking Cloud can now be cast in a fight.
- 31 spells and 9 monster actions that say "a creature you can see" target only what their caster sees.
- Fire Storm is ten 10-foot cubes its caster places, each touching another.

## 0.76.0 - 2026-10-07

- Uses Capability API 1.177 (box areas, and walls that block movement or sight, lie as a ring, or catch on a chosen side).
- Cubes and squares are boxes of the size the SRD prints instead of the nearest burst: Web, Entangle, Black Tentacles, Grease, Faerie Fire, Hypnotic Pattern, Slow and Thunderwave.
- Wall of Fire, Blade Barrier, Wall of Thorns, Wall of Stone, Wall of Force, Wall of Ice and Wind Wall are walls laid in a line or as a ring. Wall of Fire is opaque and burns creatures within 10 feet of the side its caster picks, Blade Barrier and Wall of Thorns harm creatures moving through them, Wall of Thorns costs 4 feet per foot and blocks sight, Wall of Stone blocks movement and sight, and Walls of Force and Ice block movement.

## 0.75.0 - 2026-10-07

- Uses Capability API 1.176 (cures that end conditions, stabilize the dying or revive the dead).
- Lesser Restoration ends one of blinded, deafened, paralyzed or poisoned. Greater Restoration ends one effect that charmed or petrified its target. Heal and Mass Heal also end blindness and deafness, and Protection from Poison neutralizes a poison already on its target.
- Spare the Dying stabilizes a dying creature that is not undead or a construct, and Revivify brings back a creature that died within the last 10 rounds with 1 hit point.
- A healer's kit has ten uses, each stabilizing a dying creature for an action.
- Spell scrolls of Lesser Restoration, Greater Restoration, Spare the Dying and Revivify now have a use.
- A party member caught in their own side's Web or Entangle can break free of it.

## 0.74.0 - 2026-10-07

- Uses Capability API 1.175 (escapes against a hold's own DC and checks, ramming zones, ground that costs more or halves speed).
- Web works: a lasting, difficult area whose Dexterity save or restrained catches a creature entering it or starting its turn there. Entangle restrains as it is cast and leaves difficult ground. Black Tentacles now restrain too, and a creature they already hold takes 3d6 as its turn starts, with no save.
- A creature restrained by Web or Entangle breaks free with an action and a Strength check against the spell save DC, by Black Tentacles with Strength or Dexterity, and by a giant spider's or ettercap's web with Strength against DC 12 or 11. Restraint with no escape in the SRD, like petrification, still has none.
- Flaming Sphere rammed into a creature makes it save against the sphere's damage and stops for the turn.
- Plant Growth's overgrowth costs 4 feet of movement for every foot. Spirit Guardians halve speed in their area, on top of difficult ground.

## 0.73.0 - 2026-10-07

- Uses Capability API 1.174 (zone concentration saves, damage caps, and concentration and zones on item uses).
- Sleet Storm makes a concentrating creature in it save or lose concentration.
- Guardian of Faith is a lasting area that strikes hostile creatures moving within 10 feet of it and vanishes after dealing 60 damage. It no longer strikes as it is cast.
- Spell scrolls of concentration spells hold the reader's concentration, so 15 more scrolls work (Heroism, Stoneskin, Greater Invisibility, Hunter's Mark, Divine Favor and others). Scrolls of lasting-area spells leave their area, and scrolls of spells that spare their caster's side do too.

## 0.72.0 - 2026-10-07

- Uses Capability API 1.173 (spell areas that move, and ground they change).
- Moonbeam's caster moves the beam up to 60 feet for an action, and Flaming Sphere's moves the sphere up to 30 feet for a bonus action. Cloudkill and Incendiary Cloud drift 10 feet away from their caster as each of the caster's turns starts. A creature the moved area now covers is caught as if it had walked in.
- Flaming Sphere is a 5-foot sphere that burns a creature ending its turn within 5 feet of it (the source gave it the 20-foot radius of its light).
- Spike Growth is difficult terrain that deals 2d4 piercing for every 5 feet a creature moves in it, with no save. Its spell scroll no longer has a use, since an item use cannot leave lasting ground.
- Black Tentacles, Grease, Insect Plague and Sleet Storm make their area difficult terrain. Spirit Guardians' half speed is difficult terrain for the creatures they affect.

## 0.71.0 - 2026-10-07

- Uses Capability API 1.172 (spell areas that stay).
- Cloudkill, Moonbeam, Black Tentacles, Sleet Storm, Incendiary Cloud, Insect Plague, Grease and Spirit Guardians last their duration and strike creatures that enter them or start or end a turn in them. Spirit Guardians move with the caster and spare their side.
- Sleet Storm knocks creatures prone on a failed Dexterity save.

## 0.70.0 - 2026-10-07

- Uses Capability API 1.171 (pools that pay for another group, targets per slot level).
- A warlock casts with pact slots in a fight: each pays for a spell at the pact slot level.
- A spell whose own slots are spent is offered from a higher slot.
- Bane, Bless, Blindness/Deafness, Charm Person, Hold Monster, Hold Person, Longstrider and Scorching Ray take one more target for each slot level above their own.

## 0.69.0 - 2026-10-07

- Uses Capability API 1.170 (items that switch on and off).
- The flame tongue ignites: a bonus action (or the inventory button) lights it, and while it burns every hit adds 2d6 fire damage.

## 0.68.0 - 2026-10-07

- Uses Capability API 1.169 (weapon extra damage).
- Dragon slayers, giant slayers, holy avengers, the mace of disruption and the sun blade deal their extra damage to dragons, giants, fiends and undead as printed. The frost brand adds 1d6 cold to every hit.
- On a natural 20: the sword of sharpness adds 4d6 slashing, vicious weapons 2d6, the sword of life stealing 3d6 necrotic and the mace of smiting 2d6 (4d6 against constructs).
- The sun blade is now a finesse weapon that deals radiant damage.

## 0.67.0 - 2026-10-07

- Uses Capability API 1.168 (creature types).
- Every monster has its SRD creature type, and devils, demons and shapechangers are tagged as such. Characters are humanoids.
- Charm Person, Dominate Person and Hold Person take only a humanoid; Dominate Beast only a beast; Hold Monster passes over the undead.
- Cure Wounds, Healing Word, Mass Healing Word, Mass Cure Wounds, Prayer of Healing, Heal, Mass Heal and Blight have no effect on undead or constructs. Their spell scrolls follow the same rule.
- Holy water can be thrown: on a hit it deals 2d6 radiant damage to a fiend or undead, and nothing to anything else.

## 0.66.0 - 2026-10-07

- Uses Capability API 1.167 (a condition applied only while the applier's sheet allows).
- Rage adds its Rage Damage to melee weapon hits made with Strength: +2, +3 from 9th level, +4 from 16th.
- Raging also gives advantage on Strength saving throws.

## 0.65.0 - 2026-10-07

- Uses Capability API 1.134 (saves against conditions, damage or magic).
- Dwarves have advantage on saves against poison, halflings against being frightened, elves and half-elves against being charmed (every charm the sheet declares), and gnomes on Intelligence, Wisdom and Charisma saves against magic.
- Every hostile spell a fight resolves is magical, so a save against it is a save against magic.
- The Robe of the Archmagi, Mantle of Spell Resistance, Spellguard Shield, Staff of the Magi and Scarab of Protection give advantage on saves against magic; the Belt of Dwarvenkind gives advantage on saves against poison and poison resistance.
- Protection from Poison also gives advantage on saves against being poisoned.

## 0.64.0 - 2026-10-07

- Uses Capability API 1.133 (damage a condition changes).
- Divine Favor adds 1d4 radiant to your weapon hits. Hunter's Mark adds 1d6 to your weapon hits on the marked creature. Ray of Enfeeblement halves the target's Strength weapon damage until it saves.
- Enlarge/Reduce has two choices: Enlarge adds 1d4 to the target's weapon damage and gives advantage on Strength saves; Reduce (Constitution save negates) takes 1d4 away and gives disadvantage.

## 0.63.0 - 2026-10-07

- Uses Capability API 1.166 (an ability usable only while the sheet allows).
- The Protection fighting style works: when a creature you can see attacks an ally within 5 feet of you, your reaction gives that attack roll disadvantage. It is offered only while you wear a shield.
- Rage is not offered while you wear heavy armor.

## 0.62.0 - 2026-10-07

- Uses Capability API 1.132 (typed resistance and immunity).
- Purity of Body and Nature's Ward supply passive poison and poisoned immunity at their level-10 picks.
- Dwarves resist poison, tieflings fire, and a dragonborn its ancestry's damage type, in a fight. The Features list gains a Damage resistances column (its 16th, Capability API 1.165) that the sheet's hides read.
- Rage applies physical resistance. Stoneskin, Protection from Energy choices, Protection from Poison, Heroism, Gaseous Form and Fire Shield choices apply timed defenses; Mind Blank and Heroes' Feast have conditions for the GM to apply.
- Potion of Resistance offers ten timed variants. Armor of Invulnerability has worn nonmagical resistance and a daily ten-minute nonmagical immunity use.
- Petrified uses typed resistance without stacking halves. Package checks validate typed condition, track, item and sheet hides and their capability gates. README records partial effects and missing Engine support.

## 0.61.0 - 2026-10-07

- Uses Capability API 1.131 (reactions for allies, at turn start and on a save).
- Shield Guardian grants an adjacent ally +2 Armor Class for the triggering action. Chain Devil uses Unnerving Mask at a nearby enemy's turn start, with its printed DC 14 Wisdom save and frightened through that turn end.
- Stone Giant catches Rock attacks on its printed DC 10 Dexterity save, spending the reaction whether the save succeeds or fails. Feather Fall catches up to five fallers from one event, nearest first.
- Package checks validate the new reaction moments and action-only durations, including secondary moments and the 1.131 capability gate. Protection still needs a worn-shield feature gate; Split and other unsupported reaction effects are documented in the README.

## 0.60.0 - 2026-10-07

- Blindness/Deafness offers separate blinded and deafened choices with a Constitution save, a one-minute limit and saves at each turn end. Greater Invisibility now applies its timed, concentrated condition.
- Ki offers Patient Defense using the real bonus-action Dodge and its existing resource. Wholeness of Body heals three monk levels once per long rest; Vanish offers bonus-action Hide. Hunters can pick a separate Uncanny Dodge option.
- Fast Movement and Unarmored Movement add their armor-gated speed bonuses. Draconic Resilience adds sorcerer-level HP and its unarmored AC formula. Slippery Mind and Diamond Soul grant saving throw proficiency.
- Monk features select their own Wisdom-based Ki DC, independent of spellcasting bonuses. The README lists every audited unsupported effect and the Engine key or capability it needs.
- Needs an Engine with Capability API 1.165 (sheet lists of more than 12 columns).

## 0.59.0 - 2026-10-07

- Armor and rings of resistance offer all ten printed damage types as variants; Dragon Scale Mail offers its ten colors.
- Wands of the War Mage, the Robe of the Archmagi, and the staffs of Power, the Magi and the Woodlands add their spell bonuses to the sheet. Staff of Power also grants its Armor Class and saving throw bonuses.
- Winged Boots, a Ring of Swimming, a hooded Cloak of the Manta Ray and Slippers of Spider Climbing supply their worn movement speeds. Bracers of Archery grant bow proficiency and damage to inventory longbows and shortbows.
- A Wand of Paralysis spends and recovers charges for its ray; detached necklace beads cast Fireball and a Circlet of Blasting casts Scorching Ray. Staff of Power casts Magic Missile, and Staff of Thunder and Lightning offers its daily Lightning Strike.
- Unsupported item effects and manual steps are listed in the README.

## 0.58.0 - 2026-10-07

- Dwarves keep their speed in heavy armor. Dragonborn ancestry supplies a usable Breath Weapon, with its own save DC, scaling damage and one use per short or long rest.
- Vampires can choose a grapple instead of damage, including in Multiattack. Bugbear javelins, djinni damage types and dryad/druid shillelagh attacks have separate choices.
- Donkey, Frog, Sea Horse and Shrieker join the bestiary as sheets without attacks; Shriek stays a trait.
- Classic area target counts follow the printed size. Documentation now reflects race speed, trained racial skills and the builder's existing combined level cap.
- A combined cap in All fields and enlarged/form-dependent damage still need Engine support.

## 0.57.0 - 2026-10-07

- The guided builder writes each cantrip's and spell's Class from the class that offered it, so a multiclass caster's spells roll with the right ability without editing the sheet.
- Needs an Engine with Capability API 1.130.

## 0.56.0 - 2026-10-07

- A multiclass caster's spells can each name their class: a cleric's spells roll with Wisdom, a wizard's with Intelligence.
- The guided builder's Equipment step offers only your classes' kits (and the Acolyte's background kit); free edit still offers every kit.
- Needs an Engine with Capability API 1.109.

## 0.55.0 - 2026-10-07

- A deafened creature cannot be targeted by what needs hearing: Compulsion, Divine Word, Enthrall, Mass Suggestion, Suggestion, Vicious Mockery, a cloaker's Moan, a harpy's Luring Song, a mummy lord's Blasphemous Word and a vrock's Stunning Screech. Hearing-dependent areas skip it entirely.
- Dominate Person, Beast and Monster re-roll their Wisdom save each time the target takes damage, and only then.
- The ancient black, blue, brass, bronze and copper dragons breathe lines 10 feet wide.
- Needs an Engine with Capability API 1.129.

## 0.54.0 - 2026-10-07

- Charm Person (and the vampire's and dryad's charms) ends when the charmer's side harms the target, and Hypnotic Pattern ends on damage or when an ally within 5 feet spends an action to shake the creature awake.
- Dominate Person, Beast and Monster carry their own condition; its new save on damage waits on the Engine (see the README).
- Sneak Attack's adjacent-ally branch no longer applies when you attack with disadvantage, as the SRD says.
- Needs an Engine with Capability API 1.126.

## 0.53.0 - 2026-10-07

- Feather Fall is a reaction again: when you or a creature within 60 feet falls in a fight, you can cast it, and the faller takes no falling damage and lands on its feet.
- Needs an Engine with Capability API 1.124.

## 0.52.0 - 2026-10-07

- Creatures cast their innate and prepared spells in combat; hags share coven spells.
- Requires Capability API 1.123.

## 0.51.0 - 2026-10-07

- The builder's levels step shows only your classes' levels and keeps them to 20 in total.

## 0.50.0 - 2026-10-07

- Deva, planetar, solar and unicorn Healing Touch heal an ally; Spiritual Weapon stays and strikes as a bonus action for a minute.
- Needs an Engine with Capability API 1.122.

## 0.49.0 - 2026-10-06

- Levels and hit points no longer asks for the first-level hit die: the chosen class already sets it, and the field stays on the sheet.
- A race with subraces requires a subrace pick in the builder.
- The Acolyte's two language choices offer every standard and exotic language except Common, which everyone already speaks.
- Circle of the Land's Bonus Cantrip offers one additional druid cantrip at 2nd level.
- College of Lore's Bonus Proficiencies offers three skills of your choice at 3rd level.

## 0.48.0 - 2026-10-06

- Expertise is chosen in the builder, at **Class features**: two skills you are already proficient in, at a rogue's 1st and 6th levels and a bard's 3rd and 10th, as the SRD says. A rogue who doubles thieves' tools picks one skill and marks the tools by hand.
- Needs an Engine with Capability API 1.120, one that also has 1.105.

## 0.47.0 - 2026-10-06

- A Parry (the bandit captain, erinyes, gladiator, knight, marilith and noble) answers only a melee attack from somebody the creature can see, as the SRD prints it, not an arrow or a hidden attacker.
- Guiding Bolt's advantage lasts until the end of the caster's next turn, as the SRD says, rather than through the target's next turn.
- A slowed caster casting a spell with an action rolls a d20, and on 11 or higher the spell waits until the start of its next turn, as Slow says. It is lost if the caster cannot act then.
- Needs an Engine with Capability API 1.120.

## 0.46.0 - 2026-10-06

- Counterspell stops a spell of its own slot's level or lower outright, and against a higher one rolls your spellcasting ability check against 10 + that spell's level, as the SRD says. Cast from a higher slot, it stops higher spells outright. Before, it stopped everything. A warlock's pact slots count at the warlock's slot level.
- Shield is also cast when Magic Missile is aimed at you, and while you are shielded Magic Missile does you no harm.
- Needs an Engine with Capability API 1.117.

## 0.45.0 - 2026-10-06

- Exhaustion's fourth level halves the hit point maximum in a fight (hit points above it are lost as the fight begins, and healing stops there), and its sixth level is death: the holder is out before anybody moves.
- Creatures count exhaustion too, and the 33 the SRD makes immune to it (undead, constructs, elementals, oozes and angels among them) carry that immunity instead of an "Immune to exhaustion" trait.
- Needs an Engine with Capability API 1.115.

## 0.44.0 - 2026-10-06

- Creatures fly, swim, climb and burrow at their printed speeds: 172 of them move some way besides walking, and on a board a flier crosses water and drops, a swimmer crosses water, and a climber takes a step of any height. The 14 that cannot walk at all (sharks, ghosts, the air elemental) move only their own way, where before they walked at their fastest speed. The "Speed" trait that carried the printed line is gone.
- Fliers fly up and down on a board, a level for every 5 feet: a sword cannot reach a griffon 30 feet up. A flier knocked prone or held to a speed of 0 falls, 1d6 for every 10 feet, unless it hovers (the air elemental, flying sword, ghost, invisible stalker, specter, will-o'-wisp and wraith).
- Fly speed, Swim speed and Climb speed fields on the sheet, typed by hand while a spell or an item grants one, and read by a fight.
- Needs an Engine with Capability API 1.114.

## 0.43.0 - 2026-10-06

- Grapples and shoves now refuse a target more than one size larger, as the SRD says: every creature carries its printed size, and a character's is the new Size field on the sheet, which a race picked in the builder sets (Small for gnomes and halflings, Medium for the rest; Medium for a sheet without one).
- 19 creature attacks that grapple on a hit ("and the target is grappled (escape DC 13)") now do, and with the roper's tendril, a grapple a creature puts on is escaped against its printed DC rather than its Athletics. A grab that holds only a target of some size ("If the target is Medium or smaller") or only instead of its damage stays text.
- Needs an Engine with Capability API 1.103.

## 0.42.0 - 2026-10-06

- A creature's weapon that hits harder with two hands ("or 8 (1d10 + 3) slashing damage if used with two hands") now does so in a fight, unless the creature carries a shield (the azer, bugbear, duergar, gladiator, gnoll, goblin, guard, hobgoblin and lizardfolk), and a swarm's bite weakens once the swarm is down to half its hit points: 25 attacks in all. The druid's quarterstaff keeps its shillelagh line as text, since that amount is the spell's.
- The wight resists necrotic and nonmagical blows that aren't silvered, and is immune to poison, as the SRD prints it; 0.41.0 followed the source, which had it immune to those and not to poison.
- Needs an Engine with Capability API 1.102.

## 0.41.0 - 2026-10-06

- Resistance and immunity to "bludgeoning, piercing, and slashing from nonmagical attacks" now ask whether the blow is magical: 57 creatures take full damage from magic weapons, spells, creature spell attacks and the weapon attacks of the 16 creatures whose weapon attacks are magical, and still halve (or ignore) ordinary blows. Silvered or adamantine weapons get through where the stat block says so. The "Nonmagical attacks" trait is gone.
- The mummy is no longer immune to bludgeoning, piercing and slashing (the source listed them twice); it resists them from nonmagical attacks, as the SRD prints. The xorn no longer resists bludgeoning.
- An Adamantine item tag, for a weapon a table makes of it.
- Needs an Engine with Capability API 1.101.

## 0.40.0 - 2026-10-06

- Grappler is offered at **Class features** only to a character with Strength 13 or higher, the SRD's prerequisite, not counting the ability score improvement it takes the place of. The catalog picker in All fields still offers it to anyone.
- Needs an Engine with Capability API 1.100.

## 0.39.0 - 2026-10-06

- Up to three classes in the builder: the Class step takes a third class once the second is picked, when all three classes' SRD prerequisites are met. It gives the same Multiclassing Proficiencies a second class does, and no saving throws.
- Archery, Two-Weapon Fighting and Great Weapon Fighting read the Features list's columns directly, which leaves room for the third class's gates.
- Needs an Engine with Capability API 1.99.

## 0.38.0 - 2026-10-06

- Multiclassing in the builder: the Class step takes a second class once both classes' SRD prerequisites are met (13 in the abilities each names), setting its level to 1 and giving only the SRD's Multiclassing Proficiencies, never saving throws. Its features and spells are offered as the first class's are.
- Needs an Engine with Capability API 1.99.

## 0.37.0 - 2026-10-06

- Great Weapon Fighting throws a melee weapon's 1s and 2s on its damage dice again once, the new face standing, while the weapon is wielded two-handed (a greatsword, or a longsword with no shield or second weapon), a critical's dice too.
- Needs an Engine with Capability API 1.98.

## 0.36.0 - 2026-10-06

- Dueling adds 2 to the damage of a melee weapon held in one hand while it is the only weapon held (a versatile weapon wielded two-handed, a two-handed weapon or a second weapon gives none).
- Two-Weapon Fighting keeps the ability modifier on the off-hand attack's damage.
- Needs an Engine with Capability API 1.97.

## 0.35.0 - 2026-10-06

- An Ability Score Improvement never raises a score past 20, as the SRD says; the builder disables a score that stands at it.
- Needs an Engine with Capability API 1.96.

## 0.34.0 - 2026-10-05

- Archery adds 2 to the attack rolls of every ranged weapon held from the bag, magic ones too (thrown melee weapons take none).
- Needs an Engine with Capability API 1.95.

## 0.33.0 - 2026-10-05

- Feats: the SRD's one feat, Grappler, can be taken in place of any ability score improvement in the builder (picking one drops the other at that level), and the catalog picker offers it on its own.
- Needs an Engine with Capability API 1.94.

## 0.32.0 - 2026-10-05

- Fighting styles are picks: a Fighting styles catalog (the SRD's six), and a builder Fighting Style step where a fighter's, paladin's or ranger's Fighting Style, or a Champion's Additional Fighting Style, asks for one from that class's list, never one already taken.
- Defense adds 1 to Armor Class while armor is worn; the other styles are text the Game Master reads.
- Needs an Engine with Capability API 1.93.

## 0.31.0 - 2026-10-05

- Ability Score Improvement works in the builder: one Class features entry per level the class gets it (a fighter's 6th and 14th, a rogue's 10th too), each asking at Ability Scores for +2 to one score or +1 to two.
- The cleric's 19th-level improvement, which the Open5e class table leaves out, comes from the feature's own text.
- Needs an Engine with Capability API 1.93.

## 0.30.0 - 2026-10-05

- A tiefling's Infernal Legacy uses are class resources: Hellish Rebuke once a long rest from character level 3, and Darkness from level 5, each appearing as the level is reached.
- The tiefling's Speed shares a row with its other traits, so the entry stays within six rows.
- Needs an Engine with Capability API 1.92.

## 0.29.0 - 2026-10-05

- Languages and tools are picks: a Languages catalog (the 16 languages SRD creatures and races speak, less Druidic) and a Tools catalog (the SRD's 35 tools by kind), and builder Languages and Tools steps.
- The human, half-elf and high elf choose an extra language they do not already speak, the Acolyte two; the dwarf picks smith's tools, brewer's supplies or mason's tools, the bard three instruments, the monk one artisan's tools or instrument.
- Needs an Engine with Capability API 1.91.

## 0.28.0 - 2026-10-05

- The guided builder asks for as many cantrips and spells as the class allows at its level: a Cantrips step for the cantrips known, and the Spells step for spells known (bard, ranger, sorcerer, warlock), spells prepared (cleric, druid, paladin) or the wizard's spellbook (six at 1st level, two more each level).
- The sheet shows the wizard's spellbook size.
- Needs an Engine with Capability API 1.90.

## 0.27.0 - 2026-10-05

- A high elf picks its wizard cantrip in the guided builder (a Racial cantrip step after Spells), and a tiefling's race puts thaumaturgy on the spells list.
- Their own spells use the race's ability whatever the class casts with: the sheet shows a racial spell save DC and attack bonus off Intelligence (high elf) or Charisma (tiefling).
- Race summaries say the guided builder adds the ability score increases (by hand only in All fields).
- Needs an Engine with Capability API 1.89.

## 0.26.0 - 2026-10-05

- A single coin reads as one: prices, purses and starting coins say "1 gold piece" rather than "1 gold pieces".
- Needs an Engine with Capability API 1.89.

## 0.25.0 - 2026-10-05

- The sheet shows how many cantrips and spells each class knows at its level (off the class tables), and how many spells a cleric, druid, wizard or paladin prepares (the ability modifier plus the level, half the level for a paladin from 2nd level, at least one).
- A monk is proficient with shortswords: weapon proficiency gains "Simple weapons, shortswords", which a monk picked in the builder takes.
- Needs an Engine with Capability API 1.88.

## 0.24.0 - 2026-10-05

- A dragonborn chooses a draconic ancestry: the ten dragons of the SRD's table, offered after the race in the builder (and in the Races catalog), each saying its breath's damage, shape and save, and the damage it resists.
- Needs an Engine with Capability API 1.87.

## 0.23.0 - 2026-10-05

- A guided character builder, after Dungeon Master's Vault's: race, class, levels, ability scores, background, proficiencies, class features, spells and gear, each step saying what it still waits on.
- Beginner-safe by default: scores start on point buy, and features and spells are offered up to your level. Manual entry and the full form are the free edit. A character made before opens described, and its picks change nothing until you say so.
- A race adds its ability increases and trained skills; a class trains its saves, offers its skills and sets its weapon training, spellcasting, 1st level hit die and Unarmored Defense.
- Classes and Backgrounds catalogs (the 12 classes, the Acolyte), and the paladin's spells.
- Needs an Engine with Capability API 1.87.

## 0.22.0 - 2026-10-05

- A Races catalog with the SRD's nine races and four subraces (Hill Dwarf, High Elf, Lightfoot Halfling, Rock Gnome). Picking one puts every trait on your Features list, its languages and weapon and tool training on your proficiencies, and the dragonborn's Breath Weapon and the half-orc's Relentless Endurance on your class resources.
- Your speed comes from the race you pick (25 feet for a dwarf, a gnome or a halfling), with a new Speed bonus for anything that adds to it. Without a race picked, the speed you typed stays; a speed typed for another reason (a Monk's Unarmored Movement) moves to the Speed bonus.
- The Hill Dwarf's Dwarven Toughness adds a hit point every level.
- Ability score increases are written as a trait: add them to your scores yourself.

## 0.21.0 - 2026-10-05

- The Champion's Improved Critical scores a critical hit on a 19 or 20, and Superior Critical on an 18 to 20, once the feature is on your Features list (pick it again if it was there before).
- Second Wind heals 1d10 + your fighter level.
- Hit points have a method: Average (the SRD's fixed values from your class levels), Rolled (a hit die for each level after 1st, rolled with the sheet's Roll button or typed) or By hand. The default takes the average unless a number is typed by hand, so a character from before this version keeps what it had. A character whose hit points were never set shows the old 8: switch it to Average. 1st level counts the largest hit die unless you name your first class's.
- Needs an Engine with Capability API 1.85.

## 0.20.0 - 2026-10-04

- Honest and dishonest sellers: every seller but a town's new fence is honest, warns before selling a wild chance item and never sells a cursed or fake one. The fence now and then passes a fake off as the real thing (a bag of devouring as a bag of holding, a potion of poison as a potion of healing), which looks real in your bag until it is found out.
- The deck of many things, the wand of wonder and the bag of beans now have prices, with the warning an honest seller gives; the deck can turn up, rarely, in a city magic dealer's odd lot.
- An honest buyer sees through a fake you sell and pays what it truly is worth.
- Needs an Engine with Capability API 1.79.

## 0.19.0 - 2026-10-04

- Optional starting gear: each class's starting equipment and the Acolyte's, with their choices, taken from the inventory when you want them. A character who starts above level 1, or with a concept of their own, takes none of it.
- Packs come as what they hold, and armor and a shield are put on as they are taken.
- Needs an Engine with Capability API 1.78.

## 0.18.0 - 2026-10-04

- Multiclassing: the sheet has a level for each class (and an Other class), and works the rest out: your level and proficiency bonus, hit dice by die, and spell slots on the Multiclass Spellcaster table, with a paladin or ranger alone on their own table. Pact slots follow the warlock level.
- Class resources follow their own class's level (Rage the barbarian level, Ki the monk level), Sneak Attack the rogue level, and cantrips the character level.
- A long rest gives back half of all your hit dice, shared over the dice largest first.
- Extra Attack follows the class levels (a fighter twice from 5th level, three times from 11th, four at 20th; a barbarian, monk, paladin or ranger twice from 5th), so nobody types it any more. Attacks per Attack action stays as a by-hand floor.
- Characters made before keep their numbers: their level goes to the class their Class text names, or to the Other class when it names none or several.
- Needs an Engine with Capability API 1.77.

## 0.17.0 - 2026-10-04

- Haste gives its target an extra action each turn, for one weapon attack, Dash, Disengage, Hide or using a mundane item (not activating a magic one), and when it ends the target loses its next turn to lethargy.
- Slow leaves its target an action or a bonus action on its turn, not both, and one attack.
- Needs an Engine with Capability API 1.76.

## 0.16.0 - 2026-10-04

- Falling: somebody shoved off a drop of 10 feet or more takes 1d6 bludgeoning damage for every 10 feet, up to 20d6, and lands prone.
- Boards have height, a level being 5 feet: climbing costs extra movement, nobody walks a cliff, and a ridge blocks sight.
- Needs an Engine with Capability API 1.75.

## 0.15.0 - 2026-10-04

- Three-quarters cover: a target mostly hidden behind a wall adds 5 to its Armor Class, and half cover still adds 2. Cover is read from the attacker's position, so moving around an obstacle takes it away.
- Cover also helps a Dexterity saving throw, against an area from where the area starts and against a spell aimed at you from its caster.
- A creature in the way, friend or foe, gives half cover.
- Sacred Flame's save takes no cover, as its text says.
- Needs an Engine with Capability API 1.74.

## 0.14.0 - 2026-10-01

- A market: the Game Master names the place (hamlet, village, town or city) and buys and sells for you there, at cheap, fair or dear prices. A hamlet has a general store, a village a smith and a temple, a town an alchemist and a scribe, and a city a magic dealer.
- Common magic items are sold from a town and uncommon ones in a city, one or two a day; anything rarer turns up only now and then in a magic dealer's or a smith's odd lot.
- Sellers buy back what they deal in at half the fair price, up to a purse a day: 20 gp in a hamlet, 100 in a village, 1,000 in a town and 10,000 in a city.
- Needs an Engine with Capability API 1.70.

## 0.13.0 - 2026-10-01

- Every magic item has a price, set by what it does for you within its rarity, after the approach of the community guide Sane Magical Prices (with the package's own numbers): an item that fights costs more than one that helps elsewhere, a game-changing one (flight at will, teleporting, seeing anywhere) a step more, one that brings creatures by their worth, a used-up one a tenth, and a spell scroll doubles a level from 25 gp. A wish, a cursed or false item, and one whose chance can turn on you are never for sale.
- Ordinary equipment is common, so every item has a rarity.
- A beaten creature that can use money (a humanoid, a giant, a dragon and the like) drops treasure for its challenge: coins, and now and then a potion, a scroll or a magic item of a rarity that fits. Beasts, oozes and mindless creatures drop nothing.

## 0.12.0 - 2026-10-01

- The Magic items catalog now holds every SRD magic item: arms, armor, shields, rings, rods, staffs, wands and wondrous items, with their rarity and attunement.
- A magic weapon or armor is the SRD one it is made of: a +1 sword adds 1 to hit and damage, dwarven plate adds 2 to Armor Class, and mithral loses its Strength requirement and Stealth disadvantage.
- Worn items do what their text says in numbers: rings and cloaks of protection, bracers of defense without armor or a shield, gauntlets, headbands and belts that set an ability, the stone of good luck, advantage on a skill, and resistance to a damage type. Curses keep an attuned item on you.
- Wands of fireballs, lightning bolts and magic missiles cast their spell for a charge at the wand's own DC, regain charges at a long rest and may crumble on the last one. A staff that is a magic quarterstaff fights as one. Other charges, and everything else, stay text.

## 0.11.0 - 2026-10-01

- A Magic items catalog holds the SRD's 27 potions and oils and a spell scroll of every SRD spell.
- A potion of healing heals its dice, Heroism gives 10 temporary hit points and Bless for an hour, and Speed gives haste for a minute. The other potions say what they do for the Game Master to narrate.
- A spell scroll casts its spell at the scroll's own save DC and attack bonus and is used up. Above the level you have slots for, you first roll your spellcasting ability against 10 + the spell's level, and a failure wastes it.
- Acid and alchemist's fire are thrown as attacks, and the SRD's poisons are items you can carry.
- Needs an Engine with Capability API 1.70.

## 0.10.0 - 2026-10-01

- An Equipment catalog puts the SRD's armor, shield, weapons, ammunition, gear and tools in a character's bag, with prices and weights.
- Armor Class follows what you wear: armor's base and the Dexterity it allows, a shield's 2, and Armor Class without armor (Barbarian, Monk, Mage Armor). Your old typed Armor Class is kept as a floor, so none drops.
- A weapon you hold is an attack with no row: proficiency from the new Weapon proficiency field, versatile dice, loading, ammunition and an off-hand strike. Sneak Attack fires with a held finesse or ranged weapon.
- Heavy armor slows you below its Strength, some armor gives disadvantage on Stealth, and you carry Strength times 15 pounds, coins at fifty to the pound.
- The shortsword deals piercing damage, as the SRD prints it. A row you already picked keeps slashing until you pick it again.
- Needs an Engine with Capability API 1.70.

## 0.9.1 - 2026-10-01

- The description now says what it does in plain words.

## 0.9.0 - 2026-09-26

- Shield, Uncanny Dodge and Counterspell work. When a blow hits you, the fight asks whether you cast Shield (the same roll is checked again against your new Armor Class) or take Uncanny Dodge (its damage is halved). When somebody casts a spell, it asks whether you counter it.
- Six SRD monsters Parry, and spellcasting monsters such as the Mage can cast Shield and Counterspell back.
- You can grapple and shove, and break free of a grapple.
- Bless, Bane, Shield of Faith, Haste, Slow, Blur, Faerie Fire, Guiding Bolt, Vicious Mockery, Longstrider and Ray of Frost change the numbers they print.
- Exhaustion levels 1, 2, 3 and 5 count in a fight. A poisoned fighter, or a frightened one while it can see what frightens it, rolls its side of a grapple or shove at disadvantage.
- Needs an Engine with Capability API 1.46.

## 0.8.0 - 2026-09-25

- Eleven SRD spellcasters now cast in a fight, off their own sheet and spell slots, at the numbers their stat block prints: the Acolyte, Priest, Cult Fanatic, Druid, Mage, Archmage, Lich, Mummy Lord, both nagas and the Androsphinx. The Gynosphinx prepares nothing a fight can use, so it still fights with its claws.
- Hellish Rebuke works: when something damages you, the fight asks whether you cast it back at them.
- Sacred Flame, Acid Splash, Poison Spray, Vicious Mockery and Spiritual Weapon now deal damage. Before, a fight never offered them.
- Two new sheet fields, Spell attack: other bonus and Spell save DC: other bonus.
- Counterspell, Shield and Feather Fall still stay off the menu, and the README says why.
- Needs an Engine with Capability API 1.34.

## 0.7.0 - 2026-09-20

- Extra Attack works. Set Attacks per Attack action on your sheet and one Attack buys that many strikes: the first spends the action and the rest are free. A crossbow still fires once, because it loads.
- Sneak Attack is a rider your rogue simply has: hit with a finesse or ranged weapon while you have advantage, or while another enemy stands beside your target. It grows with the Rogue table, 1d6 to 10d6.
- Action Surge hands you a second action and costs nothing. Cunning Action puts Dash, Disengage and Hide on your menu for a bonus action.
- Dodge now also gives advantage on Dexterity saves. Charmed stops you turning on the charmer and lifts if they go down, frightened stops you walking closer, restrained hampers Dexterity saves, and petrified halves all damage.
- A monster's blow carries its second damage clause, so a dragon's bite burns again.
- Weapon rows you already picked know none of the new columns. Pick them again, or tick the boxes.
- Needs an Engine with Capability API 1.32.

## 0.6.0 - 2026-09-19

- A battle can be fought on a board in feet. Set the game's combat style to Tactical and your Speed becomes squares you walk between attacks. Classic plays the same fight flat.
- Weapons know how far they reach: a longsword strikes the next square, a glaive two, and a bow carries to its long range with disadvantage.
- Shooting with an enemy beside you is also rolled with disadvantage, and a target in trees or ruins is 2 harder to hit.
- Spells and breath weapons land as the shapes the SRD prints: Fireball a burst, a dragon's breath a real cone. Everybody in it is caught, friends too.
- Walk out of an ogre's reach and it swings at you, spending its reaction. Disengage first and it does not.
- Weapon rows you already picked have none of the new distances. Delete each one and pick it again, or an old bow only fires at somebody beside you.
- Still to come: choosing whether to strike at a walker, three-quarters cover, elevation, grapple and shove.
- Needs an Engine with Capability API 1.28.

## 0.5.0 - 2026-09-19

- Battles in a new game on this ruleset are now fought with 5e rules, on screen: the d20 attack roll with advantage, a natural 20 that hits and doubles the damage dice, a natural 1 that misses, your weapons and prepared spells, the SRD conditions, concentration, death saves and spell slots spent off your sheet.
- Adds a bestiary: 319 SRD monsters with their armour class, hit dice, saves, resistances, immunities, attacks, breath weapons, multiattacks and legendary actions, every number taken from the printed stat block.
- A challenge-rating scale measured from those monsters, so an opponent a Game Master invents can be pulled onto it.
- Cantrip damage now grows with your level, Magic Missile is three darts that simply hit, and fifteen well-known spells say which condition they apply.
- Second Wind is spent as a bonus action, which is what the SRD says.
- Not yet: positions and movement, reactions, and the window a legendary action is spent in.
- Needs an Engine with Capability API 1.27.

## 0.4.0 - 2026-09-19

- Class resources you pick now keep themselves. Rage, Ki, Sorcery Points, Channel Divinity, Action Surge and Indomitable follow their class tables, Bardic Inspiration and Divine Sense follow your Charisma, and the sheet sets the maximum and keeps it current as you level up.
- Lay on Hands is a new class resource. Its pool is your level times 5.
- A kept maximum is shown as read only on the sheet. If you want your own number, delete the picked row and type one: a row you typed is never kept by the ruleset.
- Your sheet has one Level field, so a multiclass character's class resources follow the total level.
- Rage stops at six. The Barbarian table says Unlimited at 20th level, which a counter cannot hold.
- Needs an Engine with Capability API 1.23.

## 0.3.0 - 2026-09-19

- Battles now start from your character sheet. Your hit points and spell slots go into the fight, and when it ends the damage you took and the slots you spent are written back. Pact Magic slots do not transfer: their level follows the character, which the battle block cannot say yet.
- Your prepared spells and the weapons you picked from the catalogs show up as skills. Cantrips come too, because they are cast without being prepared. A row you typed by hand carries no numbers, so it stays out.
- Health is carried as a share of your maximum, so a character at half hit points starts the fight at half of the health bar.
- The damage is still Marinara's own combat math. Attack rolls, saving throws and concentration are not applied, so this is not a 5e combat system.
- SRD healing spells now heal: Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word, Prayer of Healing, Heal, Mass Heal and Regenerate.
- Needs an Engine with Capability API 1.22.

## 0.2.0 - 2026-09-19

- Adds catalogs: ready-made SRD 5.1 entries the character sheet editor offers in a picker, so you no longer type a spell list or a page of class features row by row. 319 spells, 208 class and subclass features, and 36 weapons.
- Picking a class feature that the SRD gives a plain number of uses, such as Second Wind, Rage or Ki, also fills in the class resource that tracks it.
- A picked row is a copy. Edit it however you like, and nothing rewrites your character later.
- Battles still use Marinara's default combat, so the numbers a catalog entry carries are recorded but not yet rolled.
- Needs an Engine with Capability API 1.21.

## 0.1.0 - 2026-09-18

- First release. Ships the 5e SRD 5.1 ruleset data for Game Mode ability checks, skill checks, saving throws, spell slots, hit dice, class resources, conditions, rests, and a full character sheet. Battles still use Marinara's default combat, not 5e combat.
- Available to Engine staging users only, and needs an Engine with Capability API 1.20.
