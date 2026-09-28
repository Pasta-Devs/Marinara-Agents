# Modern Life Sim

Modern Life Sim is a life simulation in its own Home tab. You live in a small town on a clock — a job to find and keep, bills to pay, energy and hunger to look after — and the people around you are a cast drawn from your own character cards. Each of them has a personality of their own, keeps a week of their own, remembers what you did together, and grows closer (or drifts away) scene by scene.

Find the package in **Agents → Download Agents**. Installation requires a restart: once installed and Marinara Engine restarts, **Life Sim** appears as a tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes after restart.

This is an **alpha** and the package is **staging only**: Engine `staging` testers are offered it and stable `main` users are not. It is listed in the repository README's *In development* table for that reason. While it is in alpha, a release that changes something older saves stand on marks them: opening such a save says so, and you can start a new life or continue at your own risk.

## What this release contains

0.1.0 was the first release, and a whole life rather than a slice: creating a life from your persona and character cards, a town with opening hours, day and night and four seasons, a job, a home, shops, three bonds per person, scenes told by a visual-novel narrator, sleep and visits, and the phone.

0.2.0 is everything since:

- **It plays more like a game**: a title screen with your saved lives dealt out as cards, a welcome the first time, a first-day card, the **GUIDE** (a searchable app on your phone that explains how everything works), a relationship chart in Contacts, and a redone profile and character sheet.
- **Personalities**: each character gets their own mix of traits, read from their card (how jealous, faithful, shy or quick-tempered they are…), instead of twelve fixed archetypes. You discover them as you spend time together, and can change them in Settings.
- **Relationships all the way**: dating, moving in, engagement and weddings (with more than one partner if every one agrees), jealousy, open relationships, secrets, and breakups — always in a scene, never on a pop-up.
- **A town that talks**: people notice what you do and pass it on, NEWS every Monday, and friends with opinions. Outings are one long scene, plans go on a calendar, and birthdays happen.
- **Work and money**: you start without a job and find one in JOBS; BILLS, debt and eviction; HOMES to move; five districts, and a motorbike or a car.
- **Pictures**: key moments get their own picture in the GALLERY, outfits by season, and every kind of picture is manual or automatic per life.
- **Modules**: optional extras, off unless you switch them on for a life. The first one, **Adult**, is for mature content and asks the player to confirm they are an adult.

0.2.1 gives models that think before they answer (GLM, DeepSeek) room to do it, retries once with more room when an answer is still cut off, adds a Reasoning option of none, stops pictures flickering while others are being painted, and makes text sharp again in lists that scroll (the phone, the Guide).

0.2.3 makes people look like themselves in their pictures, lets you choose how big pictures of one person are drawn, picks each season's new clothes for who you play, makes three screens easier to use (the shops, the backpack, the clothes store), and finds Marinara however you run it, even from another device or on a secure connection.

All generation — cast readings, scene lines, backgrounds and outfit pictures — runs through the Engine profile's own configured model and image connections. The package adds no external services and sends nothing anywhere else. The numbers (bonds, money, time, outcomes) are always decided by the package's code; the model only writes the words.

## Requirements

- Marinara Engine 2.4.4 or newer, below 4.0.0.
- A text connection for the model. An image connection is optional: without one, places show their illustrated cards instead of generated backgrounds.
