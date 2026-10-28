# Otome Forge

Otome Forge will be a single-player otome game made from your own characters: love interests who remember what you chose, their texts on your phone, dates and mini-games, and wishes for outfits and memories paid for only with Starlight you earn. There is no real money in it.

This is an early test build. You set up a story: a premise, your protagonist from one of your personas, and two to five love interests from your character cards or from original archetypes. The forge then plans the story's mystery and writes a hidden character bible for each love interest, and can paint the cast's base looks. Then you play its main chapters, come Home to the love interest you pick, text each one on the phone, and spend time with them in Dates. Wishes arrive in a later build. The plan is in [Pasta-Devs/Marinara-Agents#1781](https://github.com/Pasta-Devs/Marinara-Agents/issues/1781).

## Install and open it

It is offered to Engine `staging` testers only: an Engine on the `staging` branch lists it in **Agents → Download Agents**, and a stable Engine does not.

1. Install **Otome Forge** from **Agents → Download Agents**.
2. Restart Marinara Engine when it asks you to.
3. Open **Home → Otome Forge**.

It needs an Engine with Capability API 1.386. Its routes need admin access, so playing from another device needs `ADMIN_SECRET` set on the server and the same value in **Settings → Advanced → Admin Access**.

## The story

Each main chapter is led by one love interest. Otome Forge offers two to choose from: the one you have spent the least time with, and the one with the most unresolved between you. The chapter planner adds a second love interest whose goals get in the way, and writes six to nine scenes that build to a confrontation. Each scene is written when you reach it, with the next one written ahead while you read.

- Every line shows who speaks, and each love interest's line names one of five faces: tender, flustered, cold, hurt or angry (a later build paints them). Thoughts are set apart, and from the second stage of a love interest's story you may hear one of their own.
- Your first choice in a scene is canon. Replaying a chapter shows the other branches without changing anything, and a choice that changes things between you shows "He'll remember that." The last scene may end on one lasting choice.
- Each love interest remembers only what they saw, did or were told: every scene is written with that boundary, and a private moment (a date; later a phone thread) is recalled only in scenes that love interest is in, never in the shared story summary. Finished chapters are summarized in the background; **Settings → Debug** shows the story memory's status, with Retry when a summary failed.
- **Rewrite** writes the scene you are reading again before you make any of its choices; it costs one model call. **Ease off** ends a scene at once with no model call, and can veil that kind of content from then on. If your model declines a scene, it says so and nothing is saved; you can ease off past it, try again, or switch the connection.
- Reading earns Starlight (30 for each scene read to its end, 160 for a chapter) and affection (150 for the chapter's lead, 60 for the second love interest). Story earnings are never capped.

## Home

Home shows the love interest you pick, or you (**Him / Me** shows their name and "Me"), standing in a scene tinted by the time of day where you are.

- A painted look is cut out of its flat background by the Engine's sprite cleanup (the background remover when it is installed). When that fails, Home pans slowly over the uncut look and does not try again. Without images, Home shows initials on a gradient; it never needs audio either.
- Each love interest leaves one handwritten message of the day, written by the first visit of your local day and kept for the rest of it, with their mood. **Reply** opens their thread with the note quoted. During a rupture the note is curt.
- Tap their head, hand or heart for a line written ahead in their own voice, so a tap never waits for the model. Too many pokes in a row annoy them, and during a rupture every line is cold. The lines are written in the background on your first Home visit and again when a love interest reaches a new stage; until then Home uses a few stock lines.
- **Rough day?** offers comfort from lines written ahead, with no model call. Comfort lines never give medical advice or guess about your body.
- Reduced motion turns off the parallax and the breathing.

## The phone

Each love interest has one private thread, in their own colour, with suggested replies and their faces as stickers. Only one reply is written at a time. **Close and remember** saves the conversation as a memory that only that love interest recalls, and earns 20 affection (within the daily cap for everything outside the story).

## Dates

Dates is where you spend time with one love interest at a time. Every activity pays even when it goes badly. Only the rewards are capped each day (400 Starlight from activities in all, and 300 affection per love interest from outside the story); play never is, and the day ends at your own midnight.

- **Read Them** (one model call): over five moments, pick what your love interest really feels from three or four readings, then hear the thought behind it. The tells you learn reach later scenes.
- **Date Night** (four model calls, plus one image for a keepsake if you want one): pick a place and what you both wear (your everyday looks until the Wardrobe opens), then three scenes of choices judged by what they like. During a rupture it becomes **Make it right**.
- **Claw Machine** (no model calls and no images): six drops, taking turns. Hold the arrows or drag on the glass to move the claw, which swings when it stops, and drop it before ten seconds run out. On their turns, cheer: the eighth cheer makes them cheat in their own way, steadying the claw, bumping the machine, slipping you an extra try, slowing your swing or showing you where to drop. A round pays 20 Starlight, 30 more for each plush, and 30 affection. Every plush either of you wins lines your shelf: six series plushies, and one of each love interest with their portrait or initials. It plays by keyboard (arrows to move, Space to drop or held down to cheer), resolves each drop at once under reduced motion, and its sounds and vibration can be turned off.
- Each love interest alone remembers the games you played together: they never reach the shared story summary.

## Content settings and the 18+ gate

Each story has its own Heat (SFW, NSFW: Fade or NSFW: Explicit; SFW by default), Darkness (Gentle, Angst or Dark romance; Angst by default), Lines & Veils (a Line is never written; a Veil happens only off the page), and image rating (SFW, Suggestive or Explicit; SFW by default). NSFW Heat, Dark romance and the image ratings above SFW unlock only after a one-time confirmation: "I am 18 or older. Love interests are always adults. This is fiction." The confirmation is self-reported, stored with its time, and checked by the server on every change. Turning a setting down never asks, and withdrawing the confirmation turns every story back to SFW, Angst and SFW images. Love interests are always adults, and non-consent and pregnancy start as Lines.

## Your data

Otome Forge keeps its saves in Marinara Engine's package storage, in documents whose ids start with `otome-forge:`, so it works alongside Gacha Forge. They travel with your backups and profile exports, and they are not isolated from other packages in the Engine's storage. Messages of the day, phone threads, line packs, the plush shelf and your latest Claw Machine rounds are saved there too. Painted looks and Home cut-outs are saved in the Global Gallery, and deleting a story deletes them too. The look you pick (Midnight, Pearl or Follow system) and an unfinished setup are kept only in this browser, in storage the Engine's page shares with other installed packages.
