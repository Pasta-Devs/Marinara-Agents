# Formation combat

Formation is an optional Gacha Forge combat mode alongside Classic. It is based on the maintainer's Formation Combat proposal and reuses existing elements, progression, enemies, rewards, battle dialogue and presentation.

## Rules and player flow (1.24.0)

- Choose Classic or Formation when creating a playthrough. Classic remains the default and is unchanged.
- A team seats up to six characters: one to three Front Row fighters and up to three Back Row supports. At the start of each team turn every living support adds one energy of its own element to the team's shared bank. A team with no supports gains one energy every other turn from its fighters. Energy never expires and has no cap.
- Supports never act and cannot be attacked; they power the team and carry passives. Front Row fighters act. Each turn the player taps a fighter, chooses its Normal skill, Ultimate, Move / Swap or Hold, and taps its target. A summary lists the plan in order with the energy it spends. Any action can be changed or cleared before **Fight**, and Fight resolves the plan in that order. A target that has fallen is replaced by the weakest valid enemy fighter. An action that can no longer be paid, reached or carried out holds, with a note on the card. Auto plans and plays whole turns.
- Normal skills cost 0–4 energy of any element. Ultimates cost 2–8, of which their element share (1..cost) must be the user's element; Light and Dark stand in for it one for one. Every point spent adds its element's bonus: Fire and Dark damage, Wind crit, an Earth shield, a Water heal for the weakest ally, a Light heal for the user.
- Move / Swap moves a fighter to an empty Back Row seat, swaps it with a support, or brings a support into an empty Front Row seat; whoever arrives in front acts next turn. Hold does nothing and keeps the energy. A team whose Front Row falls loses; Echo tokens do not count.
- Effects include damage, area damage, drain, execute, damage over time, heal, restore, shield, regeneration, ATK/DEF/crit buffs and debuffs, stun, silence, taunt, immunity, cleanse, revive, energy, swap and shuffle of the enemy board, and Echo summons. Durations count the target's own turns. A unit that just lost a turn to stun or silence resists the next one. From round 12 healing fades and hits grow stronger, so every fight ends.
- Kits follow the character's preferred row. Front fighters hit or protect. Supports have weak actions, strong passives and situational Ultimates that a team saves for. Hybrids may take a perk that rewards switching rows: a free Ultimate after advancing, or a free recast on retreating. Five-stars may take one signature: a solo-frontline bonus, or Echo tokens that fill empty front seats.
- Bosses keep their mechanics and saved combat dialogue and may set an element barrier or a defeat order, shown on the board and in a rule chip. Generated guides are read leniently: a fixable kit or rule is adjusted rather than paid for again.
- Kits written for the rules before 1.24.0 keep fighting and are remade automatically before a Formation world's next battle, with the usual progress in **Story Continuity**. A cancelled or failed remake leaves the old kits in play, and Continuity offers the remake again. Classic worlds never generate Formation kits.
- The server replays every Formation fight from its saved snapshot and the recorded plans before granting rewards. A fight played on the previous engine is scored by that engine. A tab still running it must reload before it can start a new Formation fight, and spends nothing until then.
- Existing runs can switch modes in Story Continuity after a confirmation, in both directions. Identity, classic kits, level, equipment, inventory and story are preserved; switching back restores the saved Classic kits.

## Voice and presentation

Show the acting character's portrait with existing elemental effects when using an Ultimate. Preserve reduced motion, readable status, mobile controls and saved themes.

Add an opt-in Combat voice lines control under World Sources Audio. Only voiced characters receive a fixed saved set of four lines: death, enemy defeat and two Ultimate variants. Generate through current voice/provider contracts, persist the resulting audio in package storage, and reuse it on later battles and reloads. No automatic regeneration or unvoiced fallback generation.

## Validation target

Prove deterministic client/server replay, valid payments/turns/repositioning/defeat, status/trigger bounds, legacy fights, every battle/reward path, migration failure/retry/restart/concurrency, fixed audio cache reuse, ultimate effects and enemy speech. Run source/package, actual SDK/HTTP, browser and lifecycle checks. No physical-device or paid-provider claim without that proof.
