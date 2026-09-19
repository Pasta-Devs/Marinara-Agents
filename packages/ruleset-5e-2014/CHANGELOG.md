# 5e (SRD 5.1)

## 0.5.0 — 2026-09-19
- The package now describes 5e combat itself: the d20 attack roll with advantage, a natural 20 that hits and doubles the damage dice, a natural 1 that misses, the action, bonus action and reaction a turn holds, your weapons and prepared spells, the SRD conditions, concentration, death saves and the damage types.
- Adds a bestiary: 321 SRD monsters with their armour class, hit dice, saves, resistances, immunities, attacks, breath weapons, multiattacks and legendary actions, every number taken from the printed stat block.
- A challenge-rating scale measured from those monsters, so an opponent a Game Master invents can be pulled onto it.
- Cantrip damage now grows with your level, Magic Missile is three darts that simply hit, and fifteen well-known spells say which condition they apply.
- Second Wind is spent as a bonus action, which is what the SRD says.
- No Engine release plays a fight on any of this yet. Battles still work as they did.
- Needs an Engine with Capability API 1.27.

## 0.4.0 — 2026-09-19
- Class resources you pick now keep themselves. Rage, Ki, Sorcery Points, Channel Divinity, Action Surge and Indomitable follow their class tables, Bardic Inspiration and Divine Sense follow your Charisma, and the sheet sets the maximum and keeps it current as you level up.
- Lay on Hands is a new class resource. Its pool is your level times 5.
- A kept maximum is shown as read only on the sheet. If you want your own number, delete the picked row and type one: a row you typed is never kept by the ruleset.
- Your sheet has one Level field, so a multiclass character's class resources follow the total level.
- Rage stops at six. The Barbarian table says Unlimited at 20th level, which a counter cannot hold.
- Needs an Engine with Capability API 1.23.

## 0.3.0 — 2026-09-19
- Battles now start from your character sheet. Your hit points and spell slots go into the fight, and when it ends the damage you took and the slots you spent are written back. Pact Magic slots do not transfer: their level follows the character, which the battle block cannot say yet.
- Your prepared spells and the weapons you picked from the catalogs show up as skills. Cantrips come too, because they are cast without being prepared. A row you typed by hand carries no numbers, so it stays out.
- Health is carried as a share of your maximum, so a character at half hit points starts the fight at half of the health bar.
- The damage is still Marinara's own combat math. Attack rolls, saving throws and concentration are not applied, so this is not a 5e combat system.
- SRD healing spells now heal: Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word, Prayer of Healing, Heal, Mass Heal and Regenerate.
- Needs an Engine with Capability API 1.22.

## 0.2.0 — 2026-09-19
- Adds catalogs: ready-made SRD 5.1 entries the character sheet editor offers in a picker, so you no longer type a spell list or a page of class features row by row. 319 spells, 208 class and subclass features, and 36 weapons.
- Picking a class feature that the SRD gives a plain number of uses, such as Second Wind, Rage or Ki, also fills in the class resource that tracks it.
- A picked row is a copy. Edit it however you like, and nothing rewrites your character later.
- Battles still use Marinara's default combat, so the numbers a catalog entry carries are recorded but not yet rolled.
- Needs an Engine with Capability API 1.21.

## 0.1.0 — 2026-09-18
- First release. Ships the 5e SRD 5.1 ruleset data for Game Mode ability checks, skill checks, saving throws, spell slots, hit dice, class resources, conditions, rests, and a full character sheet. Battles still use Marinara's default combat, not 5e combat.
- Available to Engine staging users only, and needs an Engine with Capability API 1.20.
