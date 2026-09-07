# Pixelforge

A downloadable Game Mode **Experience** (capability package, `game-surface` slot): a walkable
top-down pixel village in the spirit of pre-3D Harvest Moon / Stardew Valley, rendered by a
package-owned Canvas2D engine. NPC dialogue flows into the normal GM turn loop, World Maps
(hierarchical spatial context) is read and written as you move, and combat hands off to the
engine's own vanilla combat — the package never replaces it.

Requires **Marinara Engine 2.4.3+** (capability API 1.10 for `contributions.assets`). It is
client-only: no server entrypoint, no restart after install. The package agent definition is a
runtime-inert stub that satisfies the catalog loader; all behavior lives in `client.js`.

## How to play

Install Pixelforge from the agent catalog, create a **Game Mode** chat, and choose **Pixelforge**
in the Experience chooser. Walk with the arrow keys / WASD or the on-screen D-pad, talk to NPCs to
drive the story, and let the GM narrate. The world saves into the chat (debounced), so reloading
resumes where you left off.

## World generation (0.4.0)

Since 0.4.0 the wizard's preferences drive what the world *is*, under one rule: **the LLM decides
what exists, the algorithm decides where every tile goes.** After launch the surface makes one
host-run structured generation call (`POST /api/game/:chatId/experience-generation`, Engine
2.4.3-staging+) with themed guidance and a strict schema; the model returns a compact **World
Brief** — settlement, cast with household structure, places, features — and a deterministic
compiler builds the tile world from it (30 villagers in 6 households → ~6 houses, never 30). The
brief is validated, repaired, and floored (`src/18-brief.js`, spec in `docs/brief-schema.md`),
then sealed into chat metadata; the compiled zones carry the prose the GM sees, metered so it
never taxes more than one turn.

**Since 0.11.0 generation is a LOADING GATE, not a background upgrade** (maintainer ruling, S5
§Q3b). Through 0.10 the chat booted a themed default world instantly and rebuilt in place when the
brief landed — and the discarded world was real enough to play, so a player could put ten minutes
into a place that was about to be thrown away. A chat configured to generate now shows a loading
state until its brief is sealed and its world compiles: the sim does not step, no player-state
mutator resolves, and no save is written until then.

A generation failure is a **retry screen**, never a default world sealed on the player's behalf:
nothing is stored, so the chat is exactly as it was and the next visit tries again. That is now
true of EVERY failure — 0.11 revised the 0.4.0-era ladder, which still sealed a themed default on a
deterministic 400/422; the retry screen says which kind of failure it was instead. Chats that
never asked for generation — pre-0.4.0 saves, and any chat whose brief was explicitly declined —
are untouched and play immediately on the themed default world, exactly as they did in 0.3.0.
**Declining is a checkbox in the setup** ("Generate a unique world with your GM connection"),
checked by default; unchecking it means no loading gate, no generation call, and no starting
purse — the themed village or colony, the moment the chat opens. The
known cost: on an engine whose generation route is missing entirely, every attempt is a transient
failure and the retry screen is the whole experience — the manifest's `engine.min` is what keeps
that off a supported install.

Run the validator/compiler regression harness with:

```sh
node packages/pixelforge/test-brief.mjs
```

## Things, money and a bed (0.11.0)

0.11 gives the player a namespaced, versioned block of their own inside the save — a pouch and a
purse, skills and equipped tools, a relationship ledger, quest state, a day ledger, discovery
state, and a home anchor. It carries its own version and migrates on read, and a field a newer
build added survives a round trip through an older one rather than being deleted by its next save.
Everything else in the world stays a pure function of `(seed, theme, brief, clock)`, which is what
keeps a rebuild byte-identical and a timeline rewind safe. The wire contract, the three field
classes, the quarantine slots, the save-row decision ladder and the loading gate are specified in
`docs/player-state.md`.

What is *live* in 0.11 is deliberately small: the purse, the pouch, and one transaction.
**There is no automatic home** — a modern setting probably houses its protagonist and a wandering
adventurer probably does not, and only your setup and your GM know which — so the player-driven
path to a bed is **renting a berth at the settlement's inn**. Stand next to whoever keeps it and
the price is on the button; it costs money, hands you a key, notes the day in your ledger, and the
keeper remembers you. Renting the same room twice is refused, and so is renting one you cannot
afford. A new world starts you with a small purse so the first thing money is for is reachable;
quest rewards are the real income and arrive with the quest layer.

Item names and the currency are **theme-bearing** — a sci-fi colony pays in credits and issues
berth chits, not coins and room keys — and a theme that ships without naming them fails a
startup assertion rather than rendering raw tags at a player.

## Something to do with the day (0.12.0)

0.12 is the first release with a **second thing to do**. Stand beside water — a village pond, a
stream, a colony's coolant pool — and a **Fish** button appears, naming the water it is about.
Cast once, or fish until dawn, morning, dusk or night; a cast spends a fixed window of the clock,
and a session that runs past midnight carries on into the next day. What comes out depends on how
good you have got at it, what you are holding, and what time it is: each world has its own catch
tables, and the fish, kelp, hauls and salvage in them are named for the place they came out of.
Bait improves your odds and gets used up — and bait is also something the water gives back, so
fishing supplies itself. Running out mid-session is not a stop; you just carry on casting bare.

**Rods are bought, never given.** The innkeeper who lets you a room also sells tackle, one rung at
a time: your first rod is cheap and comes with a starter tin of bait, and the button offers you the
next one up until you own it, then goes away. A colony treats angling as a niche hobby and prices
the same first rod accordingly. None of it is compulsory — nothing in the game needs you to own a
rod, and any keeper anywhere will sell you the same next rod later, so you can ignore the whole
thing forever if fishing is not why you are here.

**Sleep, and a recap of the day.** With a bed — the berth you rent at the inn — you can sleep until
dawn, morning, dusk or night. Sleeping costs no GM turn at all: it moves the clock, and the next
message you send for your own reasons quietly carries a summary of the days that finished while the
narrator was not looking. So the GM finds out you spent Tuesday at the millpond without you having
to type it, and without a turn spent per cast.

**Two new panels, on chips beside the purse.** The **journal** (📖) is your day ledger, grouped by
day with the newest first, plus a band for the things that happened to the *save* rather than in a
day. The **character sheet** (👤, or the `C` key) is your skills and what they are worth, what you
have equipped, your purse, and how the settlement feels about you — drawn live, so a level earned
while it is open shows up as soon as it happens.

**Bridges.** Where a road runs through water, it is now planked over instead of the pond being
dropped for getting in the road's way — which is what lets the **wilds** have one at all: the pool
is wide enough that it always reached the road band the compiler holds in reserve, so a pond a brief
asked for out in the wood simply never existed. A walkway over a pool is also a perfectly good place
to stand and fish from.

## Work on the board (0.13.0)

Every settlement now has a **notice board** — a job terminal in a colony — standing where people
already gather: beside the inn's door, on the green, or on the road you spawn onto. Walk up to it
and a **Board** button appears. Reading it costs nothing and sends nothing.

**Four jobs a day, and they are the day's, not the board's forever.** Take one and it goes on your
jobs list; the offer stays on the board dimmed, as the day's receipt. Jobs never expire and never
cost you anything to ignore, so nothing on the board is a deadline. You can carry ten at once, and
when the list is full the board says so and names the two ways out of it — finish one, or set one
aside.

**Three kinds of work, and each finishes where it happens.** Catch this many fish and bring it back
to the board. Take word to somebody, which finishes the moment you greet them. Walk out to a place,
which finishes the moment you get there. Nothing has to be carried, and nothing has to be handed
over twice.

**What a job pays is money and the giver remembering you** — and that is the whole of it: a job
never hands you skill experience. Catching fish for a fishing order still levels your fishing,
because the *catching* does, but the reward is coins and a person who now knows you did them a
favour. **This is the release that gives you an income**, so the first rod stops being a thing you
have to have saved for.

**The journal grows a second tab.** Your jobs live beside your day ledger — what you are carrying,
with counts on it, and two tallies of what you have finished: the work this world posted, and the
generic work that travels with you into the next one. Setting a job aside is here and only here (a
board is the last place you want a mis-press), and it takes two presses.

**Where the work comes from.** A chat that generates its own world now makes a **second** generation
call after the brief is sealed, writing the jobs its own people would actually post — a miller who
wants fish, a forager who wants word carried — plus a matrix of things they say, which a later
release will put behind an Ask key. It happens once, at creation, behind the same loading screen;
after that the board restocks itself every day with no calls at all. If that second call fails,
nothing is lost and trying again is free: your world is already written and settled.

**Worlds made before 0.13 have no work written for them**, and their boards say so plainly rather
than pretending — "No work posted here", never "not yet" and never "check back". Chats that declined
generation get a hand-written stock set of jobs instead, posted by the four people the default
village stands up. Jobs you have already taken are never affected by any of this: they stay on your
list and finish normally, whatever the board is offering.

## Weather, seasons and talk (0.14.0)

**Every world now has a climate and a year of its own.** When a world is made it is given a place on
the map — somewhere between the equator and the pole — and how wet that place is, and everything
else follows from those two facts. A temperate valley gets four seasons and a proper winter; the
tropics get a wet half of the year and a dry one; a desert gets rain that hardly ever comes and is
almost always light when it does. Days are fair, overcast, rainy, stormy or snowy, and rain and snow
come light or heavy. **The sky is the same every time you load** — it is worked out from the world's
seed and the day, so it costs nothing, saves nothing, and a rewind puts back the weather that was
actually there.

**The town notices.** On a wet or snowy morning the people who would have been out in it go home to
their own firesides instead — the streets empty and the windows light up — while anyone whose work
is outdoors stays at it: the watch keeps the night, the grower works the land in the rain, the
keeper keeps the inn. Snow lies on the grass and the crops and the treetops, and not on the paths,
because a trodden way is the first thing to clear. Your journal notes the first snow of the season
and a storm rolling in. And the GM is told the weather and the season in the same breath as the time
of day, so the story you are told matches the world you are standing in.

**Fishing has a good day and a bad one.** Fish bite roughly twice as often under a grey sky as under
a clear one — the ruling of thumb is a bite every ten minutes on a fair day and every five on a
wet one — so waiting for weather is now a real way to spend an afternoon. It never becomes a sure
thing: a cast can still come up empty in a downpour. Where the world sits matters too: a wet region
has more water and more in it, an arid one fishes sparse — **fewer bites, never fewer kinds of
fish**. And a storm is the one sky that changes *what* you catch as well as how often, tilting the
odds toward the rare end. Worth knowing before you go looking for one: a polar world never gets
thunderstorms at all.

**Press E and somebody actually says something back.** Talking to a townsperson no longer spends a
GM turn on "I walk up and say hello". It opens a small window with things you can actually ask —
what they do, where they live, the local rumors, whether there is work, what they make of the place,
or just passing the time — all answered instantly and free. **The clock stops while the window is
open**, because a conversation should never cost you the afternoon, and the town carries on moving
around you while you read. Walk more than a step away and the conversation ends by itself.

**The two doors to the story are always there.** "Just talk" hands the moment to the GM as it always
did, and there is a box you can type your own line into, which cues the narrator to answer *as that
person*. Everything else in the window is free — so a hundred and twenty people in a city are
finally worth walking up to, whether or not the model ever wrote a word about them.

**What you will see if your world is older.** Worlds made before 0.14 get a climate too, rolled from
their own seed — the same sky every time, and their layout is untouched. Worlds made before 0.13
still have no written dialogue of their own, so they use the hand-written stock lines, which
actually means they have *more* to say at the moment, not less. And one small thing changed
everywhere: fences, wells and tree trunks no longer bring their own patch of grass with them, so
they stand on whatever ground is actually under them — which is what lets snow lie around them
properly.

## The country past the edge (0.16.0)

**Walking out of town used to end at a wall.** A world was a handful of small grids joined by
portals, and the wilderness was exactly two of them with a solid ring of trees at the far side.
Now the settlement stands at the middle of a **lattice with no edge**: every direction has country
in it, and every patch of that country already *exists* — its ground, its name, whatever it
carries — whether or not anyone has ever walked there. Reaching one builds it; it is not decided
at that moment, it is only drawn. Which is why **a place you walk back into is the place you
left**, tile for tile, however long you were away and whichever way you came at it.

**Six kinds of country, and the world's own climate picks the mix.** Woods, heath, scree, fen, far
fields and old fallen walls — a wet world gets more standing water, an arid one more bare rock, a
polar one hardly any woodland; the land the settlement stands in is felt strongest in the ring you
can see from town and lets go the further out you get. **The colony reads as itself**: the same
country in a sci-fi world is mast fields and antenna farms, sintered pans, talus slopes, catchment
basins and collapsed outstations, and the names say so rather than pretending the picture is the
same one.

**Roughly one patch in seven has something in it** — a leaning stone, a watchpoint, still water, a
fallen steading — and those are the ones with a line of prose and a place in your journal. Ordinary
country gets a name and a notice and nothing else, which is deliberate: your discoveries are a
list of eighty, and a walk that filed every field would push the ruin you found on day three off
the end of it.

**The edges are signposts, not doors.** Stand beside the tile where the country carries on and the
topbar tells you the bearing and the name of what is over there — "North — The Tangled Thicket" —
so finding your way home from four patches out is something you can read rather than something you
have to have counted. Walk into it and you are there; there is no button and no travel menu.

**Walking is free, and that is a deliberate change.** Crossing between patches writes nothing to
the save — the position rides the same thirty-second autosave the game already ran — so a long
walk is not a hundred and fifty writes. Everything else keeps the write it had: leaving town,
arriving in it, a discovery, a job, a conversation. The cost, stated plainly: a browser killed
mid-walk can lose up to thirty seconds of position, which out here is a patch or two of backtrack
through country that comes back identical.

**The wilderness does not remember you.** Nothing you do out there is stored — there is nothing to
fell, gather or leave behind yet, and a patch you walk out of is dropped and rebuilt from scratch
when you return. That is a real limitation and it is on the roadmap as one; it is what keeps a
walk of any length costing the same as a walk of one step.

## Every town is its own town (0.16.0)

**"Always the same main village map" was true of generated worlds too, and this is the release
that ends it.** The crossroad was the middle of the map, the square was the same eight-by-eight
around it, and every band of buildings sat centred in its own span — so at a given size the fifth
house landed on the same tile in every world that ever compiled. Four things move now, all of them
rolled from the world's own seed: **where the crossroad falls**, **what shape the square is** (a
square, or a market street running one way or the other), **how each row of buildings slides along
its street**, and **what the surrounding country does to the ground** — a rocky surround strews a
stone verge along the roads, a settlement on water thickens the grass in a band inside the ring.

**What could not change is what a town is made of, and it does not.** The number of building plots
is what the whole population hangs off — the households, the people minted into them, every
building's identity — so the layout search only ever offers plans that seat exactly what the old
centred one did. A save reloading into a re-laid town keeps every person, every friendship, every
job and every home it had. The streets move; nobody moves house.

## When part of a world didn't finish (0.16.0)

**If generation half-worked, you used to have two options: play a stand-in world forever, or throw
the chat away.** Now a window tells you which part didn't finish and offers to do that part again —
keeping everything that *did* work, which is the point: your setting, your people, your jobs and
whatever you have already played.

- **The world couldn't be built from your setting.** Try building it again for free — same setting,
  same seed, so it works once an update has fixed the builder and honestly says so until then — or
  write the world again from your setting, which costs a generation call.
- **What your world's people say and do never landed.** Try that call again, or keep playing
  without it.
- **You rewrote your world and its people belong to the old one.** Write it for this world.

**Anything that replaces the world asks first, free presses included**, and the confirmation says
exactly what comes with you and what stays behind: money, items, skills and the clock come across;
friendships, quests, discoveries, your home and anything bought on the old map do not. **Nothing
nags.** The window opens once when you enter a chat that has something to say, never over a panel
you already have open, and after that it is a chip in the topbar that goes away by itself when the
world is whole. "Keep playing" is always an answer, and taking it is remembered.

**What you will see if your world is older.** Worlds made before 0.16 get the wilderness and the
new street layout on their next load — their people, jobs, friendships and homes are untouched, and
the two wilds a brief named are still exactly where they were. The one place that gets none of it
is the **fallback map** a failed generation leaves you on: it has no wilderness, no edges to walk
through and no lattice at all, deliberately. Nobody should be living there, and the window above is
the way out.

## Art

Two tiers, resolved at runtime with graceful degradation:

- **Tier 1 (shipped)** — per-theme tile atlases (`tiles.png` for cozy-village,
  `tiles-sci-fi-colony.png` for the colony theme, both sharing one `atlas.json` id map) and
  4-direction × 4-frame
  walk-cycle sprite sheets (`sprites/*.png` + `sprites.json`) generated at build time by
  `build/build-art.mjs` with a dependency-free PNG encoder (`build/png.mjs`). Deterministic for a
  given Node.js build: the pixel data never varies, but the PNG container bytes depend on Node's
  bundled zlib, so rebuilding on a different Node release may churn them — harmlessly, because the
  build re-stamps every hash from its own output and CI verifies committed bytes without rebuilding. Served through the engine's package-asset route via
  `contributions.assets`.
- **Tier 0 (fallback)** — procedural Canvas painters inside `client.js`. If assets fail to load
  (or on engines without asset serving) the game still runs, just plainer.

## Layout

```text
packages/pixelforge/
├── src/                  # plain-JS modules, concatenated in filename order into client.js
├── docs/brief-schema.md  # the World Brief schema v1 spec (sealed; amendments inline)
├── docs/player-state.md  # the player block + the verbs: wire contract, stamps, quarantine, ladder, gate, fishing, the wrap-up, the quest layer and its content pack, the sky and calendar, the dialogue window, the standing ladder, the wilderness lattice, the generation retry surface
├── test-brief.mjs        # standalone validator/compiler/spatial regression harness
├── build/
│   ├── build-art.mjs     # deterministic Tier-1 art generator (writes build/assets/, untracked)
│   ├── png.mjs           # dependency-free PNG encoder
│   └── cover.mjs         # regenerates artwork/agent-covers/pixelforge.png
├── engine-boundary.json  # capability API + build provenance; zero private engine imports
├── client.js             # generated — do not edit
├── agents.json           # generated — do not edit
├── manifest.json         # generated — do not edit
├── locales/en.json       # generated — do not edit
└── tiles*.png, atlas.json, sprites.json, sprites/*.png   # generated Tier-1 assets
```

## Rebuilding

```sh
node scripts/build-pixelforge-package.mjs
```

Regenerates `client.js`, the Tier-1 assets, `manifest.json`/`agents.json`/`locales/en.json`, the
reproducible `artifacts/pixelforge-<version>.zip` (deterministic store-only zip, no system `zip`
binary needed), and the catalog lanes. Bump `VERSION` in the build script and update
`engine-boundary.json` when rebuilding against a newer engine.
