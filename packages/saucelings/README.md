# Saucelings

Saucelings is a Tamagotchi-style pet package for Marinara Engine. It lives in **Home → Saucelings** and on the Home widget grid.

Pick one of your characters to look after a sauceling. They bring an egg that suits their personality, then feed, play with and cuddle it on their own schedule, guided by a care profile drawn from their character card. When you open Home, they tell you what they did, and you cover the gaps they missed. A hungry sauceling stops growing, so keep an eye on its meters.

Saucelings has five tabs: **Nook**, **Journal**, **Album**, **Menagerie** and **Settings**.

## Your caretaker

The caretaker speaks in their own words. They tell you what happened and talk to the sauceling while they look after it. Their care profile reads every part of the card that shows how they talk (description, personality, backstory, scenario, system prompt and other instructions, example dialogue and first message), and gives them a speech style and a phrasebook of their own for everyday care.

That voice is made only when you ask. When a character without one becomes the caretaker (by bringing an egg, a switch under **About**, or **Bring back** from the Menagerie), Saucelings offers to read their card once with your text connection. **Not now** keeps lines guessed from the card, and the offer comes back on the next switch. An edited card keeps its voice; **About → Refresh voice** reads the card again.

Lines you ask for with a click (Check in, a new caretaker's hello, a welcome back, a farewell) don't count against the daily limit in **Settings**. Past that limit, other moments use the phrasebook. **Caretaker writes every line** in **Settings** (off by default) has your text connection write every line instead, which uses more model calls.

The **Journal** keeps a record of everything that happened.

## Temperament and species

How the two of you care for a pasta sauceling shapes its sauce temperament. It starts as `Marinara` and can shift into one of six others. A sauceling that isn't pasta has a temperament of its own: it takes after whoever found its egg, and slowly picks up the ways of whoever looks after it. The caretaker's lines follow the temperament.

At hatch your text connection gives the sauceling a name that plays on what it is, in one call that doesn't count against the daily limit. Without a connection it keeps its kind's name until you name it.

An ordinary egg hatches into one of the everyday species, and a caretaker's card leans towards some of them. Not every sauceling comes from an ordinary egg, though:

- Some eggs only turn up at certain times of year.
- **Special eggs** are earned by looking after your saucelings well over time. The Adopt and Swap panels show how close you are.
- A sauceling that is happy and close to its caretaker may one day be offered a new look. You choose it in **Evolve…**, or keep the one it has.

## The Nook

The Nook is a stage: a 16:9 pixel-art background with your sauceling standing on it. Each species has its own background, and every egg shares one nest, so the species stays a surprise until it hatches. Drag the egg, tap where it should go or use the arrow keys, and it stays there. The sauceling walks, turns, hums, hops and naps by itself, and comes over when you tap the stage. Before any care plays, it hurries over to the caretaker and turns to face them.

You can replace the background with a picture you upload (resized in your browser to at most 1280×720) or one generated through your image connection. **Suggest one** asks your text connection for a place that suits this sauceling and its caretaker, for you to edit before you generate. Uploaded and generated backgrounds stay in a library shared by every sauceling, up to 24, under **Background**.

When the caretaker has sprites in the Engine, they stand at the right of the stage. They look happy after good news and when you fill a gap, worried while a meter is low, and calm otherwise. A caretaker without sprites shows their avatar in the message box under the stage.

With image generation on, **About → Paint <name> for the Nook** paints the caretaker as a pixel figure in the saucelings' style, in one image request from their avatar, a sprite and their card's appearance. The figure stands on the stage in place of their sprites: it waves hello, talks while a line comes in, turns to the sauceling when care plays, breathes and blinks. If the drawings can't be read, Saucelings asks once more without the reference pictures. **Simpler caretaker figures** in **Settings** (off by default) then asks for a smaller set of poses, which weaker image models manage more often. **Undo <name>'s repaint** goes back to the old figure, and **Flip <name>** turns them to face the other way, with no image request.

The sauceling and the caretaker hold still when the Engine's reduced effects or your system's reduced motion is on.

## Home widgets

The compact widget shows the meters and the caretaker's latest remark. The large widget is the Nook's stage filling the card, with the meters along its top edge and round Feed and Play buttons beside them. The sauceling walks there only while Home is open.

## Album

Optional paintings fill the **Album**. Each one is drawn by an image-generation connection you pick in **Settings**, through Marinara Engine's own avatar generator with its style profile set to Off and Saucelings' own prompt in its place, so the paintings keep the sprites' pixel-art style. Each request sends the sauceling's sprite as a reference picture; models that take no reference pictures ignore it. **Add instructions** under the Paint button takes up to 200 characters about what the scene should show, and is kept as the painting's caption. The Album keeps every painting until you delete it, including paintings of released saucelings.

## Menagerie

Elders can retire to the **Menagerie** with a farewell scene. **Swap** sends the current sauceling there and brings a new egg. A sauceling in the Menagerie can come back to the nook at whichever stage you choose, looked after by the caretaker it had or another of your characters; **Release** lets one go for good. The Menagerie shows its saucelings as tiles grouped by stage, and each one keeps the name of whoever found its egg.

## Egg hunting

**Egg hunting** is in **Settings** and on by default. While the nook has a sauceling, a character replying to you in a chat may now and then find an egg, at most once a day. Your text connection invents the creature from their card, the egg waits in the Menagerie, and the caretaker tells you who found it. Without a text connection a find is an ordinary egg.

Egg hunting uses the Engine's prompt-context permission only to notice that a reply is being written. The package adds nothing to the prompt and reads no chat text. The Engine also counts Peek Prompt, regenerate, swipe, impersonate and failed generations as replies. In a group chat with no reply target every character counts, and multiplayer rooms never roll.

An invented sauceling has no sprite of its own. With image generation on, the first time the Nook or the Album shows a stage with no picture, a dialog asks whether to paint it. Its whole life is painted in one picture, which your browser cuts into moving forms like the built-in species. Until then it shows a silhouette. **About → Repaint** paints it again, **About → Undo repaint** goes back, and **About → Flip <name>** turns it round with no image request.

## Privacy

Saucelings never contacts an image or model service itself. Every text and image request goes through the connections you set up in Marinara Engine.
