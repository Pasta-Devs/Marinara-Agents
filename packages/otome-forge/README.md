# Otome Hearth

Otome Hearth will be a single-player otome game made from your own characters: love interests who remember what you chose, their texts on your phone, dates and mini-games, and wishes for outfits and memories paid for only with Starlight you earn. There is no real money in it.

This is an early test build. You set up a story: a premise, your protagonist from one of your personas, and two to five love interests from your character cards or from original archetypes. The forge then plans the story's mystery and writes a hidden character bible for each love interest, and can paint the cast's base looks. Then you play its main chapters and each love interest's own route, come Home to the love interest you pick, text each one on the phone, wish for their side stories and looks, spend time with them in Dates, and keep their days in Remind Me. The plan is in [Pasta-Devs/Marinara-Agents#1781](https://github.com/Pasta-Devs/Marinara-Agents/issues/1781).

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

Home shows the love interest you pick, or you (**Him / Me** shows their name and "Me"), in the look each of you wears at home, standing in a scene tinted by the time of day where you are. Behind them is the newest CG you have unlocked with that love interest (a Memory's too), else the newest painted place, else a gradient.

- A love interest's painted look is cut out of its flat background by the Engine's sprite cleanup (the background remover when it is installed), on the first Home visit that shows it. When that fails, Home pans slowly over the uncut look and does not try again. Your own look is shown uncut. Without images, Home shows initials on a gradient; it never needs audio either.
- Each love interest leaves one handwritten message of the day, written by the first visit of your local day and kept for the rest of it, with their mood. **Reply** opens their thread with the note quoted. During a rupture the note is curt.
- Tap their head, hand or heart for a line written ahead in their own voice, so a tap never waits for the model. Too many pokes in a row annoy them, and during a rupture every line is cold. The lines are written in the background on your first Home visit and again when a love interest reaches a new stage; until then Home uses a few stock lines.
- **Rough day?** offers comfort from lines written ahead, with no model call. Comfort lines never give medical advice or guess about your body.
- Their face follows the note's mood, each tap and a rift, painted once their five faces are (and cut out like the look); before that, their look or initials name the face.
- With voices on in **Settings → Audio**, **Play** reads the note, and taps and **Rough day?** are read aloud, in the voice the story gives them. Comfort lines are never kept in the Engine's audio cache. Home plays the story's home music.
- Reduced motion turns off the parallax and the breathing.

## The phone

Each love interest has one private thread, in their own colour, with suggested replies and their faces as stickers. Only one reply is written at a time. **Close and remember** saves the conversation as a memory that only that love interest recalls, and earns 20 affection (within the daily cap for everything outside the story).

## Wish, the Wardrobe and the Album

Wishes cost Starlight you earn by playing (100 each, 1,000 for ten; there is no real money), and a new story starts with 2,000. Every 14 days, counted from the day the story began, the next time you open Wish it creates three banners, each featuring the love interest featured least recently: **Memories**, that love interest's **wardrobe**, and **yours**. Creating them takes one model call per banner, and painting their art up to three images. Banners never expire: past ones wait in **Echoes**, and you can still wish on them.

- A banner holds one featured 5★, three 4★s and six 3★ Snapshots. A Memory (5★) is a key image, a short Character Story and a voiced line; a Moment (4★) is one scene; a look (5★ or 4★) is a complete outfit; a Snapshot is a short vignette that joins that love interest's Love Timeline, and only they remember it.
- The pity count is exact and shown as "5★ in 23". A 5★ starts at 1.5% a wish, rises from the 46th wish without one, and the 60th is always one; every 10th wish is a 4★ at least. The 5★ is always the featured item, with no 50/50. Pity is kept per kind of banner and carries over, Echoes included. A wish charges and rolls in one save, so it is never paid twice, and it never calls a model. A duplicate refunds 400, 60 or 10 Starlight by rarity.
- A banner's art is its featured item's picture, painted when the banner is created, or held for your tap with **Ask before painting** or the Engine's prompt review. Other items are painted, and stories written, the first time you open them, and only once.
- In the **Wardrobe**, a love interest's looks and yours can be worn at home, which is the look Home shows, and shown to them; your featured look and theirs from the same two weeks make a couple set. A look they wear gets its own faces. When you wear a new look of yours, the love interest on Home notices it (one model call), and Home's **Me** shows their line beside your look while you wear it.
- At affection 10, each love interest gives one **Memory Selector**: claim any of their Memories from past banners (Echoes) that you do not have yet, at no cost.
- The **Album** keeps the CGs you have seen, your Memories, the Love Timeline, your favourite lines and the soundtrack, and saves an image through the Engine.

## Dates

Dates is where you spend time with one love interest at a time. Every activity pays even when it goes badly. Only the rewards are capped each day (400 Starlight from activities in all, and 300 affection per love interest from outside the story); play never is, and the day ends at your own midnight.

- **Read Them** (one model call): over five moments, pick what your love interest really feels from three or four readings, then hear the thought behind it. Each moment shows the face it names, painted once their five faces are; with voices on, their line is read aloud. The tells you learn reach later scenes.
- **Date Night** (four model calls; with an image connection, a new place and any face not painted yet are painted as in any scene, plus one image for a keepsake if you want one): pick a place (one of eight, theirs to choose, or a place your story has painted, shown with its picture) and what you both wear (your base looks; a date does not offer Wardrobe looks yet), then three scenes of choices judged by what they like, voiced like any scene. During a rupture it becomes **Make it right**.
- **Claw Machine** (no model calls and no images): six drops, taking turns. Hold the arrows or drag on the glass to move the claw, which swings when it stops, and drop it before ten seconds run out. On their turns, cheer: the eighth cheer makes them cheat in their own way, steadying the claw, bumping the machine, slipping you an extra try, slowing your swing or showing you where to drop. A round pays 20 Starlight, 30 more for each plush, and 30 affection. Every plush either of you wins lines your shelf: six series plushies, and one of each love interest wearing their look (cut out once Home has cut it out) or their initials. With voices on and the machine's sound on, their lines are read aloud. It plays by keyboard (arrows to move, Space to drop or held down to cheer), resolves each drop at once under reduced motion, and its sounds and vibration can be turned off (Mute everything in Settings → Audio silences them too).
- Each love interest alone remembers the games you played together, as they remember a phone conversation: never in the shared story summary, and never told what another love interest's own chapters left behind.

## Remind Me and the period tracker

**Remind Me** (the calendar button under **Who’s home** on Home) shows a month at a time: each love interest's birthday, the day your story began, the firsts of your Love Timeline, such as each stage you reach with a love interest (Snapshots and couple sets stay in the Album), and your own birthday if you add it, which stays on this device and is never sent with a prompt. The last day of each running Wish banner joins it. Arrow keys move through the days, Home and End to the ends of a week, Page Up and Page Down by month; **Coming up** lists the next two months.

**Settings → Tracker** holds an optional period tracker, for anyone who has periods, off by default:

- It is stored only in this browser (`otome-forge:cycle:v1`), never in package documents, backups, story memory, ledgers or logs. **Delete all cycle data** (here or in **Privacy & data**) removes it and today's caring messages in one click, and an export file moves it to another device. Safari may clear browser storage after about 7 days without a visit, which is what the export is for.
- You log first days; it predicts the next from your cycle length, or not at all when your cycle is irregular. Remind Me shows logged days as filled hearts and predicted ones as outlined hearts labelled "predicted". It never computes "late": a predicted day that passes simply gives way to the next one. It isn't medical advice.
- On a day it has something to say (a day of a logged period, or a predicted start within three days), Home offers **Caring message**, a rose button beside Remind Me. Pressing it sends one line about today, such as "Mira has told you: today is day 2 of her period." (with your protagonist's own pronoun, "their" by default), to the model provider of the story's chat connection, and nothing else: never the history. Pressing Play also sends the note to your voice provider, with no audio cache. The note is kept in this browser for that day only, and is never quoted into a reply.
- **Keep it off the model** sends nothing: a comfort line written in advance answers instead. The same happens whenever a debug condition is on (the Engine's debug mode, `DEBUG_AGENTS`, or a debug log level), because the Engine's providers log whole requests then. Otome Hearth redacts the line from its own prompt log, and the server stores nothing about it. The Engine writes no request line for a Caring message, but a provider warning during its model call (a rate limit, a retry, a fallback) names the request's route and time, never the line or the note, so a server log can show that a Caring message was asked for that day. Love interests comfort and never diagnose or prescribe.

## Content settings and the 18+ gate

Each story has its own Heat (SFW, NSFW: Fade or NSFW: Explicit; SFW by default), Darkness (Gentle, Angst or Dark romance; Angst by default), Lines & Veils (a Line is never written; a Veil happens only off the page), and image rating (SFW, Suggestive or Explicit; SFW by default). NSFW Heat, Dark romance and the image ratings above SFW unlock only after a one-time confirmation: "I am 18 or older. Love interests are always adults. This is fiction." The confirmation is self-reported, stored with its time, and checked by the server on every change. Turning a setting down never asks, and withdrawing the confirmation turns every story back to SFW, Angst and SFW images. Love interests are always adults, and non-consent and pregnancy start as Lines.

NSFW Heat or Dark romance turns on NSFW mode for the story, its chapters and the phone. Romance escalates without stopping to ask, love interests may make the first move, and language is not sanitized. NSFW: Fade writes the build-up and cuts at the threshold; NSFW: Explicit writes sex on the page in full. Dark romance lets villains play dirty and aim menace at you, with graphic violence wherever your limits allow it. What you set to Allow is told to the model, and your Lines and Veils always win. Non-consent can move off Line only under Dark romance with NSFW Heat. The model never stops a scene to ask; **Ease off** is your stop. Home, notes, Snapshots and memory summaries always stay SFW.

Images follow their own rating. Looks, faces, outfits, couple portraits and Memory art always stay clothed (at most Suggestive), and places never show people. Only a story CG of an explicit scene, under NSFW: Explicit Heat and the Explicit image rating, may show nudity or sex. Every image prompt says everyone is an adult, its negative prompt keeps the child terms whatever you edit, and above SFW any part of a prompt that names a minor is dropped. Your image connection decides the rest. Grok (xAI) ignores negative prompts and may refuse an image. ComfyUI and RunPod follow your workflow, which needs `%negative_prompt%` to receive the negatives. A refused image shows as a failed paint with Retry.

## Your data

Otome Hearth keeps its saves in Marinara Engine's package storage, in documents whose ids start with `otome-forge:`, so it works alongside Gacha Forge. They travel with your backups and profile exports, and they are not isolated from other packages in the Engine's storage. Messages of the day, phone threads, line packs, banners, the items you win, the plush shelf and your latest Claw Machine rounds are saved there too. Painted looks, places, faces, CGs, banner art and Home cut-outs are saved in the Global Gallery, and deleting a story deletes them too. Generated music is kept by the Engine with its other generated audio. The look you pick (Midnight, Pearl or Follow system), an unfinished setup, the period tracker, today's caring messages and your own birthday are kept only in this browser, in storage the Engine's page shares with other installed packages.
