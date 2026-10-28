# Otome Hearth

Otome Hearth will be a single-player otome game made from your own characters: love interests who remember what you chose, their texts on your phone, dates and mini-games, and wishes for outfits and memories paid for only with Starlight you earn. There is no real money in it.

This is an early test build. You set up a story: a premise, your protagonist from one of your personas, and two to five love interests from your character cards or from original archetypes. The forge then plans the story's mystery and writes a hidden character bible for each love interest, and can paint the cast's base looks. Then you play its main chapters and each love interest's own route, come Home to the love interest you pick, and text each one on the phone. Dates and wishes arrive in later builds. The plan is in [Pasta-Devs/Marinara-Agents#1781](https://github.com/Pasta-Devs/Marinara-Agents/issues/1781).

## Install and open it

It is offered to Engine `staging` testers only: an Engine on the `staging` branch lists it in **Agents → Download Agents**, and a stable Engine does not.

1. Install **Otome Hearth** from **Agents → Download Agents**.
2. Restart Marinara Engine when it asks you to.
3. Open **Home → Otome Hearth**.

It needs an Engine with Capability API 1.386. Its routes need admin access, so playing from another device needs `ADMIN_SECRET` set on the server and the same value in **Settings → Advanced → Admin Access**.

## The story

Each main chapter is led by one love interest. Otome Hearth offers two to choose from: the one you have spent the least time with, and the one with the most unresolved between you. The chapter planner adds a second love interest whose goals get in the way, and writes six to nine scenes that build to a confrontation. Each scene is written when you reach it, with the next one written ahead while you read.

- Every line shows who speaks, and each love interest's line names one of five faces: tender, flustered, cold, hurt or angry (a later build paints them). Thoughts are set apart, and from the second stage of a love interest's story you may hear one of their own.
- Your first choice in a scene is canon. Replaying a chapter shows the other branches without changing anything, and a choice that changes things between you names who will remember it. The last scene may end on one lasting choice.
- Each love interest remembers only what they saw, did or were told: every scene is written with that boundary, and a private moment (their own route or repair chapter, a date, a phone thread) is recalled only in scenes that love interest is in and on their own Home and phone, never in the shared story summary. Finished chapters are summarized in the background; **Settings → Debug** shows the story memory's status, with Retry when a summary failed.
- **Rewrite** writes the scene you are reading again before you make any of its choices; it costs one model call. **Ease off** ends a scene at once with no model call, and can veil that kind of content from then on. If your model declines a scene, it says so and nothing is saved; you can ease off past it, try again, or switch the connection.
- Reading earns Starlight (30 for each scene read to its end, 160 for a chapter) and affection (150 for the chapter's lead, 60 for the second love interest). Story earnings are never capped.

## Routes, confrontations and rifts

Each love interest moves through six stages, from Mask to Bond. Their route chapters are free: the next one opens at an affection level (3, 5, 7, 8, then 10), it takes one model call to plan, and only its last scene, the gate, moves them on a stage. The gate of the fourth stage reveals one of their secrets; the fifth stage's chapter holds a confrontation, and its gate ends on a choice that cannot be undone. A route chapter earns 300 Starlight and 150 affection.

- Every main chapter builds to a confrontation: three rounds in which you Press, Hold, Yield or Reveal. It ends in the truth, a walkout or a standoff, and what you reveal is something they know from then on. The whole confrontation is written in one model call, and your first play of it is canon.
- A walkout can leave a rift. While one stands, that love interest's route chapters stay shut (the scene on screen can still be finished), and **Make it right** offers a short repair chapter. Reading its last scene closes the rift. Nothing you have unlocked is ever taken back.

## Art, faces, music and voices

Everything works without images or sound: a place without art shows a gradient for its mood, a love interest without a portrait shows their initials, and a key moment without a painting shows a quiet card.

- With an image connection, each scene's places and a chapter's key moments (CGs) are painted when the scene is written. With **Ask before painting** on, or the Engine's **Review image prompts before sending**, each one waits for your tap instead (the review opens its prompt for editing first), and the button says what it costs. A CG joins your Album once you have seen it, and nothing is repainted without a tap.
- Each love interest's five faces (tender, flustered, cold, hurt and angry) are painted in the background as edits of their look, about five images each. Turning faces off in **Settings → Images** stops any paid image before it starts.
- Music follows each scene's mood: the Engine's own music, or, with **Generate music** on and an audio connection, a track written for this world, made once per mood and never retried by itself.
- Dialogue can be voiced through the Engine's voice settings: a love interest from a card uses the voice assigned to that card, the others a default voice, and you speak with your persona's voice. Narration and thoughts stay silent, and the backlog can play a line again.

## Home

Home shows the love interest you pick, or you (**Him / Me** shows their name and "Me"), standing in a scene tinted by the time of day where you are. Behind them is the newest CG you have unlocked with that love interest, else the newest painted place, else a gradient.

- A painted look is cut out of its flat background by the Engine's sprite cleanup (the background remover when it is installed). When that fails, Home pans slowly over the uncut look and does not try again. Without images, Home shows initials on a gradient; it never needs audio either.
- Each love interest leaves one handwritten message of the day, written by the first visit of your local day and kept for the rest of it, with their mood. **Reply** opens their thread with the note quoted. During a rupture the note is curt.
- Tap their head, hand or heart for a line written ahead in their own voice, so a tap never waits for the model. Too many pokes in a row annoy them, and during a rupture every line is cold. The lines are written in the background on your first Home visit and again when a love interest reaches a new stage; until then Home uses a few stock lines.
- **Rough day?** offers comfort from lines written ahead, with no model call. Comfort lines never give medical advice or guess about your body.
- Their face follows the note's mood, each tap and a rift, painted once their five faces are (and cut out like the look); before that, their look or initials name the face.
- With voices on in **Settings → Audio**, **Play** reads the note, and taps and **Rough day?** are read aloud, in the voice the story gives them. Comfort lines are never kept in the Engine's audio cache. Home plays the story's home music.
- Reduced motion turns off the parallax and the breathing.

## The phone

Each love interest has one private thread, in their own colour, with suggested replies and their faces as stickers. Only one reply is written at a time. **Close and remember** saves the conversation as a memory that only that love interest recalls, and earns 20 affection (within the daily cap for everything outside the story).

## Content settings and the 18+ gate

Each story has its own Heat (SFW, NSFW: Fade or NSFW: Explicit; SFW by default), Darkness (Gentle, Angst or Dark romance; Angst by default), Lines & Veils (a Line is never written; a Veil happens only off the page), and image rating (SFW, Suggestive or Explicit; SFW by default). NSFW Heat, Dark romance and the image ratings above SFW unlock only after a one-time confirmation: "I am 18 or older. Love interests are always adults. This is fiction." The confirmation is self-reported, stored with its time, and checked by the server on every change. Turning a setting down never asks, and withdrawing the confirmation turns every story back to SFW, Angst and SFW images. Love interests are always adults, and non-consent and pregnancy start as Lines.

## Your data

Otome Hearth keeps its saves in Marinara Engine's package storage, in documents whose ids start with `otome-forge:`, so it works alongside Gacha Forge. They travel with your backups and profile exports, and they are not isolated from other packages in the Engine's storage. Messages of the day, phone threads and line packs are saved there too. Painted looks, places, faces, CGs and Home cut-outs are saved in the Global Gallery, and deleting a story deletes them too. Generated music is kept by the Engine with its other generated audio. The look you pick (Midnight, Pearl or Follow system) and an unfinished setup are kept only in this browser, in storage the Engine's page shares with other installed packages.
