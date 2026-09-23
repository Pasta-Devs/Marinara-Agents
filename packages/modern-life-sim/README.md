# Modern Life Sim

Modern Life Sim is a life simulation in its own Home tab. You live in a small town on a clock — a job with shifts and reviews, rent that falls due each season, energy and hunger to look after — and the people around you are a cast drawn from your own character cards. Each of them keeps a week of their own, remembers what you did together, and grows closer (or drifts away) scene by scene.

Find the package in **Agents → Download Agents**. Installation requires a restart: once installed and Marinara Engine restarts, **Life Sim** appears as a tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes after restart.

This is an **alpha** and the package is **staging only**: Engine `staging` testers are offered it and stable `main` users are not. It is listed in the repository README's *In development* table for that reason. While it is in alpha, a release that changes something older saves stand on marks them: opening such a save says so, and you can start a new life or continue at your own risk.

## What this release contains

0.1.0 is the first release, and it is a whole life rather than a slice:

- **Creating a life** in three steps: a persona, a cast picked from your character cards (the model reads each card for an archetype, gift tastes and the week that person lives, and you can change any of it), and the town — which places exist, what they are called, where everyone lives.
- **The town**: a map of places with opening hours, travel time between them, day and night, four seasons of thirty days, and generated backgrounds for every place.
- **Your days**: a job with shifts, performance and reviews; rent; energy and hunger; skills (Fitness, Charm, Knowledge); a home with furniture, a fridge, cooking and a closet; shops, a mall with its own stores, and online orders.
- **People**: quick moments (chat, flirt, gifts), longer scenes told by a visual-novel narrator, three bonds per person (friendship, romance, trust) with tier events, relationship steps from dating to marriage, and memories you can read, pin and edit.
- **Sleep and visits**: everyone's week marks when they sleep; you can wake them (it lands as their archetype and the hour decide), knock on a friend's door, be asked in, and do things together at their home or yours.
- **The phone**: contacts and their sheets, a calendar, your own sheet, and the settings of the life (its cast, its rules, which model writes it).

All generation — cast readings, scene lines, backgrounds and outfit pictures — runs through the Engine profile's own configured model and image connections. The package adds no external services and sends nothing anywhere else. The numbers (bonds, money, time, outcomes) are always decided by the package's code; the model only writes the words.

## Requirements

- Marinara Engine 2.4.4 or newer, below 4.0.0.
- A text connection for the model. An image connection is optional: without one, places show their illustrated cards instead of generated backgrounds.
