# Saucelings release notes

## 0.20.0 — 2026-10-25

### Added

- **Your own instructions for an Album painting.** Under the Paint button, **Add instructions** lets you say what the scene should show (up to 200 characters), such as a teacup at a café. It replaces the plain background, and your caretaker can appear in the picture. The Album shows your words as the painting's caption. Leave it empty for the plain portrait as before.

## 0.19.1 — 2026-10-25

### Changed

- Paintings, forms, life sheets, caretaker figures and Nook backgrounds are asked for in words that weaker image models follow more reliably: the pixel-art style comes first, and what must stay out of the picture goes in the image model's negative prompt. Forms are asked for at 1024×1024.
- An Album painting is no longer drawn as a face-and-shoulders chat avatar: it shows the whole sauceling in the sprites' style.
- When a caretaker's figure can't be read, Saucelings asks once more without the reference pictures, which some image models use as the starting picture.

### Added

- **Simpler caretaker figures** in **Settings** (off by default): when a caretaker's figure still doesn't come out, Saucelings asks for just three drawings in one row. It helps weaker image models but uses an extra image call.

## 0.19.0 — 2026-10-25

### Changed

- Any character can find an egg while chatting with you, not only the caretaker, as long as the nook has a sauceling and Egg hunting is on. The caretaker's line in the nook names who found it, and the egg is that character's own. The one find a day and the odds are unchanged.

## 0.18.3 — 2026-10-25

### Added

- Living sprites for three more species: Clockrit's clock ticks with a thin red second hand, and in its side view the winding key on its back turns. A silk thread hangs onto Webbit's head and a dewdrop slides down it, lands and splashes. Prismite's streaks drift through soft colours and little stars twinkle near its crystal tips. They hold still with reduced effects, and pause while the window is in the background.

## 0.18.2 — 2026-10-25

### Changed

- Clockrit is redrawn as the same little brass cat at every stage. It always stands upright, and in its side view the clock is a rounded bump on its belly seen edge-on instead of a flat face on its side. The elder is warm aged bronze.
- Webbit is redrawn so it reads as a spider from the first stage, with eight stubby legs and its orange belly. It keeps the same body shape as it grows, shows against dark backgrounds, and happy, content and grumpy are easy to tell apart.

## 0.18.1 — 2026-10-25

### Added

- Special hatchings: when a special or October sauceling hatches, its egg cracks open into its own move. Prismite hatches in a Star Burst, Thundrake with a Lightning Zap, Clockrit with a Shockwave, Wickwisp with a Fire Puff, and Cauldrop with a Bubble Blow and a Splash. Webbit drops in on a thread instead. Reduced effects skip the moment.
- A rare mark: a gold star beside a special sauceling's name and a pumpkin beside a Halloween one's, in the Nook and the Menagerie. Screen readers hear "Special sauceling" or "Halloween sauceling".

## 0.18.0 — 2026-10-25

### Added

- Living sprites: Wickwisp's candle flame burns and flickers, Cauldrop's brew bubbles and pops, and sparks crackle around Thundrake, with its horns and eyes flashing now and then. They hold still with reduced effects, and pause while the window is in the background.

### Changed

- Thundrake is redrawn standing on four feet from the front as well as the side, with wings that match its mood. It walks on the floor instead of hovering.
- Prismite is redrawn as clear blue crystal with rainbow facets instead of grey stone.
- Cauldrop is redrawn with a lit rim, so it shows against dark backgrounds. Its brew changes colour as it grows: green as a hatchling, then teal, purple and finally magenta as an elder.
- Thundrake's painted portraits ask for four legs too.

## 0.17.1 — 2026-10-25

### Added

- Fourteen new signature moves, drawn as pixel effects, two or three for each colour: Fire Puff, Icicles, Leaf Whirl, Wiggle, Petal Shower, Triple Hop, Star Burst, Coin Shower, Shockwave, Vanish, Lightning Zap, Dash, Bubble Blow and Splash.
- Choosing a look plays an evolution moment on the Nook stage: the stage dims, the sauceling glows and flickers between its old and new colours, bursts out of the light, then does its first move. With reduced effects it is a short, soft change.
- Tap a happy evolved sauceling and it sometimes does its move. Once in a while it does a bigger encore.

### Changed

- Twirl, Float, Shine, Roar and Sparkle are redrawn with their colour's effects.
- A move faces the way the sauceling is going, leaves marks on the floor that fade, and lights the stage in its colour (Shade dims it instead). Moves that travel play on the spot in Evolve… tiles.
- Fire Puff and Bubble Blow come out of each species' mouth.

## 0.17.0 — 2026-10-24

### Added

- Evolution paths: each evolution colour now brings its own aura, like rising embers for Ember or drifting snow for Frost. Two new colours: Storm and Tide.
- Eleven new floating extras: gem, snowflake, cloud, bolt, feather, heart, mushroom, orb, bow, flower and shell.

### Changed

- An evolved sauceling keeps its shading, eyes and outline in its new colours instead of turning one flat hue.
- Floating extras are painted and animated, and each colour offers its own three.
- The shining outline around an evolved sauceling gently breathes.
- Saucelings that already evolved get their colour's aura in place of their sparkles or lights.
- Menagerie tiles are a little taller, so a grown sauceling's floating extra is no longer cut off.

## 0.16.1 — 2026-10-24

- Signature moves: an evolved sauceling has a move of its own (Twirl, Float, Shine, Roar or Sparkle) that it does now and then, more often when happy. Evolve… shows each look's move.
- The Album keeps a before-and-after of each evolved sauceling, side by side on its Nook background. It is drawn in the browser, with no image request.
- Evolving a sauceling counts towards the Prismite egg, like raising one to elder (once per sauceling).

## 0.16.0 — 2026-10-24

- Evolution: a sauceling that has been happy and close to its caretaker for a few days may be offered an evolution, once in its life. Evolve… shows two new looks drawn on its own sprite (new colours, a glow and a floating extra) with a name and the story behind each; pick one or keep it as it is. Undo evolution brings the choice back, and Not interested hides it for good.
- An adult no longer evolves on its own while its caretaker chats; egg finds are unchanged. Saucelings that evolved the old way keep their look and count as evolved.

## 0.15.0 — 2026-10-24

- A sauceling now grows up only while it is fed. Time with hunger below 35 does not count toward its next stage, and the Nook says "Growing paused: hungry" until it eats. Stages take the same growing time as before (juvenile 18 h, adult 60 h, elder 144 h, with the same bond).
- A pet saved earlier keeps the age it had, so none shrinks back a stage. One returning early from the Menagerie picks up the growth it left with; time in the Menagerie does not count.

## 0.14.0 — 2026-10-24

- A fed pet stops showing hungry: forgotten meals count only since the last meal anyone gave, yours or the caretaker's.
- A caretaker can lift hunger, mood and an egg's warmth only up to 85; your own Feed, Play and Warm still go higher, and a meter already above 85 is not pulled down.
- Time passes by the hour: hunger drops 2 an hour, mood 1.5 and an egg's warmth 2, as before at 6 hours. A shorter care window rolls a share of each chance, so a day comes out about the same, and a long absence catches up for at most 14 days.
- An attentive caretaker has more chances to care and a distracted one fewer, from about 0.7 times to 1.8 times; an average one is unchanged. Asking them to watch for milestones lifts it too.
- "Care score" is replaced by a meal count, such as "Meals: 12 of 14 this week" or, for an egg, "Kept warm: 5 of 6 this week". It stays hidden until the caretaker has had a turn.

## 0.13.1 — 2026-10-24

- The Ask row shows what you have asked the caretaker for and how long each ask has left, such as "Asked: remember meals (31 h left), play more (12 h left)", in place of "Lasts 48 hours." An ask made while it was an egg shows as what it helps with now, so "keep it warm" becomes "remember meals" once it hatches.

## 0.13.0 — 2026-10-24

- Reading a caretaker's card now also writes their phrasebook, in one more call: four lines in their voice for each routine moment (feeding, a poor or too-big dinner, a forgotten one, play, cuddles, a milestone, warming, chilling and chatting to the egg, hatching and growing up), and short sign-offs they add to about half their lines, pleased, worried or neutral to fit the moment. A voice read before this keeps its lines, and its catchphrases serve as neutral sign-offs, until Refresh voice.
- A caretaker with no phrasebook, or one missing a moment, uses a new house phrasebook with four lines for every moment, Check in, hello and farewell included, so the same line comes round less often.
- **Caretaker writes every line** in Settings, off by default, has the model write every caretaker line instead of the phrasebook, up to six a save. It uses more model calls, and the daily limit doesn't apply.

## 0.12.1 — 2026-10-24

- The large Home widget is one column wide and two rows high, so it is a tall square-ish card instead of a wide one. Its care buttons now run down the right side below Home's move handle, no longer hidden under it. Each bar has a small picture beside it (a plate for hunger, a face for mood, a heart for bond, a flame for warmth, an egg for hatching), and the bars are a little thicker.

## 0.12.0 — 2026-10-24

- The large Home widget is now the stage itself, filling the card, with the caretaker on it. The meters are thin bars along its top edge (hover one for its name and number) and Feed and Play are round icon buttons beside them; a button that is waiting shows how long in its tooltip. On a narrow Home the stage keeps 16:9 and the bars and buttons sit under it. The name, species and caretaker line and the latest remark are no longer on the large widget (the compact one keeps them), and an egg's widget shows Warmth, Hatching and Bond.

## 0.11.0 — 2026-10-23

- **Flip <name>** in About turns your sauceling to walk the other way, and another **Flip <name>** turns your caretaker to face the other way, whatever their art: built-in or painted, with or without side views. It is a saved switch, one per sauceling (it keeps it through every stage, and when it goes to the Menagerie and comes back) and one per caretaker, with no image request and nothing repainted.
- The old Flip, which redrew and saved a side view, is gone; a figure or form you flipped with it stays as it was saved.

## 0.10.0 — 2026-10-23

- **Undo repaint** in About, for each sauceling, and **Undo <name>'s repaint** beside a caretaker's Repaint, go back to the pictures from before the last repaint. Pressing it again brings the repaint back, so nothing is lost by trying. A sheet repaint keeps the whole set it replaced. A repaint now keeps only the one set before it, and releasing a sauceling deletes its kept pictures.
- Flip is not a repaint: it leaves the kept pictures alone.

## 0.9.2 — 2026-10-23

- A found or evolved sauceling's habits come from its finder's ways, as things an animal does (a tidy finder's pet lines its pebbles up in rows), never reading, judging or talking. Its look is in plain words, without art-style words like "low-poly" that fought the pixel art.
- The caretaker's lines know where they are from the Nook's background (a built-in scene, or the prompt a background was painted from; an uploaded picture isn't described) and know the pet's traits and habit. Check in tells its mood in words, never the meter numbers, through its temperament, traits and habit. A pet that isn't pasta gets no pasta jokes.
- Reading a caretaker's card explains each care habit and the worry scale, so voices don't copy an example. A voice already read keeps its profile until Refresh voice.
- Background ideas read the caretaker's card. A life sheet leaves the habit out of the picture, and an Album painting shows the temperament in the face and pose instead of naming it.

## 0.9.1 — 2026-10-23

- A sauceling's own temperament reads like a pet's now, in the style of the sauces: one word, then a few words for how it acts ("Cheeky: mischievous, nippy, hard to impress"). Your text connection turns its finder's ways into things a small animal does, without the jokes or opinions on their card. A temperament written before this that doesn't fit is written again the next time Saucelings opens, in one call.
- About says it more briefly: the sauceling takes after whoever found its egg and slowly picks up the ways of whoever looks after it.

## 0.9.0 — 2026-10-23

- On a phone, opening About no longer widens the page. Its longer notes sit behind a **?** that shows them on hover, focus or tap.
- A sauceling keeps the name of whoever found its egg, shown under About and on its Menagerie tile.
- At hatch your text connection gives the sauceling a name that plays on what it is, in one call that doesn't count against the daily limit.
- The egg sits in its nest. Drag it, tap where it should go, or use the arrow keys; it stays there on that background.
- Nothing is painted by itself any more: when the stage on show has no picture, a dialog asks once whether to paint it.
- A sauceling that isn't pasta has a temperament of its own, taking after whoever found its egg, and the caretaker's lines follow it. Two weeks with another caretaker bring it a step closer to theirs, three steps in all.
- A painted caretaker breathes like the saucelings, sinking one pixel at the chest instead of floating.

## 0.8.0 — 2026-10-23

- A painted caretaker blinks every few seconds, sometimes twice. Your browser finds the eyes in their drawing, so figures you already have blink with no image request. A face whose eyes it can't find, often behind a mask or hair, keeps them open, and Engine sprites don't blink.
- Before a care plays, the sauceling hurries over to the caretaker, as far as its walking space goes, and turns to face them; then its reaction and the caretaker's pose play together. The same happens for the caretaker's own care. An egg stays in its nest.
- The large Home widget shows the caretaker on its stage too, and the stage is 4:3 beside the meters, so it fills the card. Above the meters, on a narrow Home, it stays 16:9.

## 0.7.1 — 2026-10-23

- The caretaker on the stage breathes: a painted figure or Engine sprite rises one art pixel and settles every few seconds, and holds still with reduced effects or reduced motion.
- A painted caretaker turns to the sauceling when you care for it: the bowl for Feed, the toy for Play, reaching down for Cuddle, Rest and Warm, for two seconds while the care plays. Their own care pose lasts two seconds too, instead of 1.2. A caretaker with Engine sprites smiles for those two seconds.

## 0.7.0 — 2026-10-23

- When a character without a voice of their own becomes the caretaker (bringing an egg, a switch under About, or Bring back), a dialog offers to read their card once with your writing connection. Not now keeps lines guessed from the card and asks again on the next switch; closing it before an egg brings no egg. Switching no longer makes a profile call in the background, and an edited card keeps its voice until Refresh voice.
- Check in, a new caretaker's hello, a welcome back and a farewell no longer count against the daily limit, so Check in always works.

## 0.6.1 — 2026-10-22

- Painting a caretaker works again with image models that draw the eight poses close together: drawings that touch (big hair, a tail) are cut apart, scraps of a neighbour are left out, and four poses over four are read too. When only the top row can be read, the figure keeps its first three poses and About says Repaint can try for all eight.

## 0.6.0 — 2026-10-22

- A painted caretaker no longer stays smiling after Check in: they talk while a line comes in, wave through a hello, then go back to calm. They look happy for a moment after good news or a gap you fill, and worried while a meter is low.
- Painting a caretaker now draws eight poses: calm, happy, worried, talking and waving facing you, and side views facing the sauceling for feeding, playing and tending, which they hold while their care plays on the stage. A figure painted before 0.6.0 keeps its three looks.
- About has **Flip** for a caretaker's side views and for an invented sauceling's side view, to turn one that faces the wrong way, with no image request.
- Clockrit, Lentino and Wickwisp no longer walk backwards.

## 0.5.0 — 2026-10-22

- About can paint the caretaker as a pixel figure in the saucelings' style, from their avatar, a sprite and their card, in one image request. The figure stands in the Nook in place of their sprites and looks calm, happy or worried like them.
- Switching caretaker under About shows the new caretaker's name at once: they say hello to the sauceling in their own words.
- Bringing a sauceling back from the Menagerie asks who looks after it, starting on the caretaker it had. One that never lived in the nook, such as an egg found while chatting, waits for you to pick.

## 0.4.0 — 2026-10-22

- A caretaker with sprites in the Engine now stands in the Nook's scene, at the right of the stage, and looks worried, happy or calm with how things are. Their message box sits right under the stage, with Check in and Ask in it on a wide panel (under the care buttons on a narrow one). A caretaker without sprites has their picture in the box.
- The sauceling turns to the caretaker and hops when a new line arrives, and the line types out (all at once with reduced motion). The caretaker's latest feeding, play or cuddle plays on the stage when you open the Nook, and they look happy for a moment after you fill a gap.
- On a wide panel the meters and care buttons sit beside the stage. The name, sauce and species share one line, and Background is a small button.

## 0.3.3 — 2026-10-22

- The Menagerie is tidier with many saucelings: they are small tiles grouped by stage (elders, adults, juveniles, hatchlings, eggs), and opening one shows its farewell, its stage choice and the Bring back and Release buttons. Closing it goes back to its tile.

## 0.3.2 — 2026-10-22

- Swapping saucelings, retiring one and adopting an egg no longer wait for the caretaker's written line: the change shows at once, the caretaker's box says they are writing, and their line appears when the model has written it. Check in still waits, since the line is what it asks for.

## 0.3.1 — 2026-10-21

- Switching caretaker is instant: the new caretaker starts with a profile read from their card, and the model's replaces it when it is ready.
- A happy sauceling bounces in place instead of hopping nonstop, and hops less often.
- The face follows what the sauceling is doing: it smiles when it hums, hops or is cared for, relaxes when it looks around or naps, and now and then shows the next mood over.

## 0.3.0 — 2026-10-21

- Ten new species, none of them pasta: Mossaboo, Puddlepip, Snufflump and Burrowl; Wickwisp, Cauldrop and Webbit in October; and Prismite, Thundrake and Clockrit, unlocked by raising 3 elders, 100 care actions and care on 30 days. Adopt shows the progress under Special eggs.
- Every species walks in a side view.
- An invented sauceling's whole life is painted in one picture, so a found egg costs one image request instead of five. Its forms bob, squash and stretch like the built-ins, walk in side view and show their mood. A picture that cannot be read falls back to painting the stage on show. Repaint redoes every stage in one request.
- Painting by itself stops after two failed tries, and two open pages never paint the same form.

## 0.2.0 — 2026-10-21

- Uploaded and generated backgrounds stay in a shared library of up to 24. Suggest one writes a prompt that suits the sauceling.
- The large Home widget shows the Nook's stage.
- Paintings send the sauceling's sprite as a reference picture, so the image model paints the same creature.
- Egg hunting (on by default): when the caretaker replies in a chat, they may find an egg of a creature they invent from their card, which waits in the Menagerie, and an adult may evolve once. The new prompt-context permission only rolls the chance; it adds nothing to the prompt and reads no chat text. Without a writing connection a find is an ordinary egg.
- With image generation on, an invented sauceling's forms (a picture per stage) are painted by themselves when Saucelings is open, found eggs in the Menagerie too; until then a found one shows a silhouette. Paint retries a failure, and About → Repaint replaces a bad picture.

## 0.1.0 — 2026-10-20

- Initial local release of Saucelings: a Home companion nook, two Home widgets, character-driven care windows, caretakers who talk to you and your sauceling in their character card's voice, shifting sauce temperaments, daily written-line budgets with zero-cost templates, a Menagerie with stage-locked returns, an Album of optional pixel-art paintings, and a Nook stage where the sauceling walks around a background that fits its species (or one you upload or generate).
