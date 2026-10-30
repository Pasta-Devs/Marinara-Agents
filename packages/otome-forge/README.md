# Otome Hearth

Otome Hearth is a single-player otome game made from your own characters. Its love interests remember what you chose and change because of it, wait for you at Home, send you messages and go on dates with you. Wishes bring you their side stories and looks, paid for only with Starlight you earn by playing. There is no real money in it, banners never expire, and nothing runs on stamina.

Release 1, **0.1.0 "First Date"**, holds the whole first loop:

- story setup with hidden character bibles;
- main chapters and a route for each love interest, with confrontations, warm Closers and rifts;
- Home and Messages;
- Wish, the Wardrobe and the Album;
- four games in Dates, among them Read Me, where a love interest learns about you;
- Remind Me with an opt-in period tracker;
- content settings with Lines & Veils and an 18+ gate.

The design is in [Pasta-Devs/Marinara-Agents#1781](https://github.com/Pasta-Devs/Marinara-Agents/issues/1781).

## Install and open it

For now it is offered to Engine `staging` testers only: an Engine on the `staging` branch lists it in **Agents → Download Agents**, and a stable Engine does not.

1. Install **Otome Hearth** from **Agents → Download Agents**.
2. Restart Marinara Engine when it asks you to.
3. Open **Home → Otome Hearth**.

It needs Marinara Engine 2.5.1 or later with Capability API 1.386, and at least one text connection. An image connection, an audio connection that makes music and the Engine's voice settings are optional: everything works without images or sound. To play from a phone or another device, see [Playing from a phone or another device](#playing-from-a-phone-or-another-device).

On desktop, **Enter fullscreen** fills the Home browser panel across Otome Hearth, including the story reader and Wish. **Exit fullscreen** returns ordinary screens to their portrait layout; Settings continues to use the available panel. The control preserves your draft and reading position and does not change the browser's own fullscreen mode.

## Setting up a story

Choose **Begin a new story**. Setup has six steps, and an unfinished setup is kept in this browser until the story is made.

1. **Story:** a premise, or **Surprise me** to have your model write one (an original world). A premise or a card set in an existing world, such as Teyvat from Genshin Impact, keeps that world and its canon. Then the language the story is written in, **How it's written** (tense, point of view, pacing: anything you want every scene, message and note to follow; also in **Settings → Content**), and an optional title.
2. **You:** the persona you play, your pronouns, up to five traits, and a goal of your own that isn't romance. Your persona's **Description, Personality, Backstory and Appearance** reach story writing and personal interactions whole; see [What leaves your device](#what-leaves-your-device) for the prompt list and refresh behavior. Scenario, greetings and example dialogue are excluded. An unavailable persona keeps its own saved text as a fallback.
3. **Cast:** two to five love interests. Pick them from your character cards or from six original archetypes: Brilliant Monster, Gilded Tyrant, Gentle Liar, Loyal Blade, Ruined Saint and Laughing Stranger. Love interests can be any gender and use the pronouns you pick. A card stays canon: the story never contradicts it.
4. **Content:** Heat, Darkness, Lines & Veils and the image rating (see [Content settings](#content-settings-nsfw-mode-and-lines--veils)).
5. **Connections:**
   - **Story** writes the scenes, and does every job you leave on **Same as Story**;
   - **Planning** plans the world, the bibles and each chapter;
   - **Messages** writes replies in the message threads;
   - **Memory** summarizes what happened, so the cast remembers it;
   - an optional image connection, its **Image style**, **Ask before painting**, and **Expressions** (on by default). Love interests are painted on a bright chroma backdrop that the Engine's sprite cleanup then removes, so they stand on every screen without one.
6. **Review:** what forging will cost, then **Forge our story**.

Forging writes the world and its central mystery: each love interest holds one piece of it and has their own reason to hide it. It then writes a hidden bible for each love interest:

- age, always 18 or over;
- wound, the lie they believe, want, need and fear;
- mask and tells, and their true self;
- flaws, moral code and red lines;
- voice, including how they care, get angry and get jealous;
- how they stand with each of the others;
- secrets that come out stage by stage.

Bibles sit behind a spoiler gate, and you can edit them. A step that fails or is stopped waits for you to try it again. Base looks are painted only when you tap **Paint the cast**. To paint one again later, open **Your cast** from Home's **Who's home** and choose **Repaint**. Then choose **Begin**.

With **Expressions** on, **Repaint expressions** beside a love interest's repaint action replaces the five faces for the look they currently wear. It uses that look as the image reference and your configured image style. The current set stays available while replacements paint, and a failed replacement keeps it. With prompt review on, review all five prompts first; the last confirmation starts the five paid images. Canceling the review paints nothing. Reading or replaying a scene never triggers this replacement.

**Begin** plays the **prologue** first: one short scene of your protagonist's own life, just before the story opens. No love interest is in it; you meet them in chapter 1, which picks up where the prologue ends. It is written once, and the Story screen offers it again. **Skip** goes straight Home.

You can keep several stories. **Your stories** lists them, and deleting one asks you to type its title. **Settings** changes a story's content, connections, images and audio later. On desktop, Settings uses the available stage space. On phones, its categories form one horizontally scrolling row, and long settings pages remain vertically scrollable.

In **Your cast**, open a love interest and choose their **Character card** to link an Engine card explicitly. Its assigned voice and image references apply without replacing the love interest's story, progress or saved pictures. **No linked card** removes the association. Future paints prefer the card's **Full Body → Neutral** sprite, then its current avatar, then the retained Otome look; linking never paints automatically.

## The story

Each main chapter is led by one love interest. Otome Hearth offers two to choose from: the one you have spent the least time with, and the one with the most unresolved between you. The chapter planner adds a second love interest whose goals get in the way, and writes six to nine scenes that build to a climax: a Confrontation, or a warm Closer. After two main chapters in a row end the same way, the next one ends with the other. Each scene is written when you reach it, and the next one is written ahead while you read.

- **Who speaks:** every line names its speaker. Each love interest's line shows one of five faces: tender, flustered, cold, hurt or angry. Your thoughts are set apart, and after something that matters to you (a first kiss, a night together, a quarrel, a secret learned) your protagonist takes a moment to sit with it in their own voice, doubts and hopes included. From the second stage of a love interest's story you may hear one of their thoughts too.
- **Choices:** your first choice in a scene is canon. Replaying a chapter shows the other branches without changing anything. A choice that changes things between you names who will remember it, and the last scene may end on one lasting choice.
- **What you know:** your protagonist knows only what the story has shown them. A love interest's past, habits and words for their world reach you when you are told, see or find them out, and a protagonist new to the world learns its people and customs as they go.
- **A life of your own:** chapters have other people in them, scenes without any love interest, and time to rest and sleep after a long day or a night.
- **Private memory:** each love interest remembers only what they saw, did or were told. A private moment is recalled only in scenes that love interest is in, and on their own Home and in their messages, never in the shared story summary. Private moments are their route and repair chapters, dates and message threads.
- **Story memory:** finished chapters are summarized in the background. **Settings → Debug** shows the story memory's status, with Retry when a summary failed.
- **Rewrite** writes the scene you are reading again, before you make any of its choices.
- **Ease off** ends a scene at once, with no model call, and can veil that kind of content from then on.
- **When your model declines a scene,** Otome Hearth says so and saves nothing. You can ease off past it, try again, or switch the connection.
- **Rewards:** reading pays 30 Starlight for each scene read to its end and 160 for a chapter. Affection is 150 for the chapter's lead and 60 for the second love interest. Story earnings are never capped.
- **Reader controls:** Auto, Skip what you've read, the Backlog (which can play a line again), Hide the text and Cancel.
- **On mobile:** the three-dot button opens the secondary controls in a vertical list. The audio button mutes or unmutes music and voices, and the fullscreen button stays beside it. Chapter cutouts continue behind the dialogue panel.

## Routes, confrontations, Closers and rifts

Each love interest moves through six stages, from Mask to Bond.

- **Affection progress:** **Story → Between you** shows the points earned within the current level beneath **Level**, out of the 300 needed for the next. Level 10 is the maximum and shows a complete counter. These levels unlock route chapters; completing their gates advances the relationship's six-stage arc.
- **Route chapters are free.** The next one opens at an affection level (3, 5, 7, 8, then 10). It takes one model call to plan.
- **Slow burn:** through the first two stages, neither of you says what you feel; it shows in tension, glances and near misses. Desire can still come first, out of lust or to get what they want, as your Heat allows, and feelings may grow from it. From the third stage a love interest may confess once the story has earned it, and by their route's finale at the latest they say it.
- **The gate:** only a route chapter's last scene moves a love interest on a stage. The fourth stage's gate reveals one of their secrets. The fifth stage's chapter holds a confrontation, and its gate ends on a choice that cannot be undone.
- **Rewards:** a route chapter earns 300 Starlight and 150 affection. A hostile first-play choice in the story or on a date, a Confrontation walkout, or being shut out of a Closer can cost 15 affection points per affected love interest for each chosen option. Points never fall below the start of the highest level you have reached, with a new level every 300 points. Replaying costs nothing, and losses never refund the daily earning cap.
- **Confrontations:** a main chapter can build to one: three rounds in which you Press, Hold, Yield or Reveal. It ends in the truth, a walkout or a standoff, and what you reveal is something they know from then on. The whole confrontation is written in one model call, and your first play of it is canon. Route chapters keep theirs.
- **Closers:** the warm climax a main chapter can end with instead. Over three rounds the Lead offers something of themselves, and you answer: Reassure, Tease, Mirror (share something of your own, which they know from then on) or Ask. They end **Opened up** (trust grows, and the first time it's a first on your Love Timeline), **Almost** (nothing changes) or **Shut out** if it goes wrong (trust falls, and they hold a minor grievance). In an NSFW story, Opened up can turn intimate, drawing on their tastes and your role, within your content settings. Like a confrontation, it is one model call, and your first play is canon.
- **Rifts:** a walkout can leave a rift. While it stands, that love interest's route chapters stay shut (you can still finish the scene on screen), and **Make it right** offers a short repair chapter. Reading its last scene closes the rift.
- **Nothing is taken back:** a rift never removes anything you have unlocked.

## Pictures, faces, music and voices

Everything works without images or sound: a place without art shows a gradient for its mood, a love interest without a portrait shows their initials in their own colour, and a key moment without a painting shows a quiet card.

In **Your cast**, edit **Image appearance** above each love interest’s spoiler Bible to change their image description. Saving paints nothing and leaves their story Bible unchanged; explicit future painting uses the saved description. Clear the field and save to restore the Bible’s original image description. Open **Image description** in **Who’s home** or an owned Wardrobe look to read its intended appearance without opening Bible spoilers. The reader also offers the current location’s description while it has no painted background, and a key moment’s brief once you reach it, until its image is painted. These are the existing visual instructions, not a new generated caption; opening them makes no model calls.

You can add an image connection later in **Settings → Images**. Saving it paints nothing. Open **Your cast** to paint missing base portraits, open owned items from **Wardrobe** or **Album** to add their missing artwork, or use **Paint** beside a reached story location or key moment. Each action shows its image cost and uses the existing prompt-review setting. Existing artwork, story text, progress and Starlight stay intact.

- **Places and key moments:** with an image connection, a scene's places and a chapter's key moments (CGs) are painted when the scene is written. With automatic painting on, the current location's background is prepared and loaded before its lines begin. Other locations, CGs and expressions do not hold up reading. **Continue without background** lets you read while that work continues; it does not cancel or repaint anything.
- **Returning places:** the writer can refer to an existing saved location and reuse its artwork, including repeated visits whose scene labels differ. Known place keys are validated, and the scene's place labels are made consistent before painting. Distinct numbered rooms and floors keep their own identities; old pictures and location records remain saved.
- **Waiting for your tap:** with **Ask before painting** on, or the Engine's **Review image prompts before sending**, each picture waits for your tap instead, and the button says what it costs. The review opens the prompt for editing first. These manual painting settings still let you read; a failed or stopped automatic background also leaves reading available, with the existing explicit retry controls.
- **Nothing repaints by itself:** a CG joins your Album once you have seen it, and nothing is repainted without a tap. A failed picture waits for Retry.
- **Faces:** each love interest's five faces are painted in the background as edits of their look, about five images per look. The previous clean look stays visible while a face is cut out; failed cleanup keeps that look. Turning **Expressions** off in **Settings → Images** stops every face that has not started yet.
- **Image ratings:** Suggestive is a ceiling, so ordinary portraits, locations and moments keep their requested subject without forced sexual framing. Expression edits are nonsexual changes to the face and preserve the reference’s body, clothing and style. Adult-only and content exclusions remain; a provider may still refuse the reference or request, and retry stays explicit.
- **Opening narration:** no future love-interest portrait is shown before their turn. Later narration can keep the last established love interest onstage.
- **Your protagonist’s voice:** the selected persona’s full Description, Personality, Backstory and authored Appearance are refreshed for generation. Authored dialogue, thoughts, reactions, choice intents/labels and performed selections follow that identity, with distinct options and your accepted choices preserved. Your complete **How it’s written** instructions still apply. This guides newly generated writing; saved scenes are not rewritten automatically.
- **Music** follows each scene's mood. It is the Engine's own music, or a track written for this world when **Generate music** is on and an audio connection makes music. Each track is made once per mood and never retried by itself.
- **Uploaded music:** with **Generate music** off, choose **Music folder** in **Settings → Audio → Music**. Nonempty Music folders from Engine’s Assets library are listed, including subfolders. Save to use their tracks instead of generated music. Automatic music uses previously saved tracks or Engine’s mood library; a missing or empty chosen folder falls back to that library. Music keeps the same mute, volume and tap-to-start behavior on mobile.
- **Chapter themes:** with **Generate music** enabled, **Settings → Audio → Generate a theme for each chapter** optionally gives each chapter its own instrumental theme. It starts generating after you begin reading, using the chapter's public title and summary. The saved theme is reused on replay. Current music keeps playing while a new theme is being made or if it fails. If a saved theme's file is unavailable, it is not generated or paid for again. This option starts off.
- **Other speakers:** when a named character outside your love-interest cast speaks, the previous character's sprite is hidden. An exact, unique matching character card can supply an existing Full Body sprite, with Neutral preferred. Without one, the scene shows no character sprite. Opaque sprites wait for free background cleanup; the card's original stays untouched. This never links cards to love interests or generates paid artwork. The background check uses a transparency heuristic: clear outer padding, faint noise and isolated clear pixels are insufficient, but a silhouette-shaped opaque mask can share the same alpha pattern as a genuine cut-out.
- **Story image descriptions:** the header's **Image description** panel stands in for a picture that isn't there. It shows the location's description only while no painted background (or painted key image) is on screen, and a key moment's brief only until that image shows. A painted picture that fails to load counts as missing, so its description shows. The panel is hidden while a character sprite is shown, and when every picture shows.
- **Character nameplates:** story speaker names use the same rounded shape on every corner.
- **Voices:** with **Voice the dialogue** on in **Settings → Audio**, a love interest from a card speaks with the voice assigned to that card, the others with a default voice, and you with your persona's voice. Narration and thoughts stay silent.

## Home

Home shows the love interest you pick, or you when you switch from their name to **Me**, each in the look you wear at home. The scene is tinted by the time of day where you are. Behind them is the newest CG you have unlocked with that love interest, a Memory's included; without one, the newest painted place, else a gradient.

- **Cut-outs:** your generated looks and the love interests' stand on a flat chroma background, removed for Home by the Engine's sprite cleanup. On an Engine with the preservation repair, Otome uses its built-in matte cleanup and rebuilds obsolete cut-outs from their retained originals, with no paid image call. The previous cut-out stays visible while its replacement is made, and stays if that free refresh fails; restarting the Engine lets a failed refresh try again. A first cleanup that fails shows the uncut look instead. Your original persona avatar stays as supplied, and the Wardrobe keeps every original look.
- **Message of the day:** each love interest leaves one handwritten note, written on your first visit of your local day and kept for the rest of it, with their mood. **Reply** opens their thread with the note quoted. During a rift the note is curt.
- **Taps:** tap their head, hand or heart for a line written ahead in their own voice, so a tap never waits for the model. Too many pokes in a row annoy them, and during a rift every line is cold. The lines are written in the background on your first Home visit, and again when a love interest reaches a new stage. Until then, Home uses a few stock lines.
- **Rough day?** offers comfort from lines written ahead, with no model call. Comfort lines never give medical advice or guess about your body.
- **Faces on Home:** their face follows the note's mood, each tap and a rift, once their five faces are painted (and cut out like the look). Before that, their look or initials name the face.
- **Voices on Home:** **Play** reads the note aloud, and taps and **Rough day?** are spoken in the voice the story gives them. Home plays the story's home music.
- **Reduced motion** turns off the parallax and the breathing.

## Messages

Each love interest has one private thread, written in whatever carries messages in your world, in their own colour, with suggested replies and their faces as stickers. Only one reply is written at a time. **Close and remember** saves the conversation as a memory that only that love interest recalls, and earns 20 affection (within the daily cap for everything outside the story).

## Wish, the Wardrobe and the Album

Wishes cost Starlight you earn by playing: 100 each, or 1,000 for ten. There is no real money, and a new story starts with 2,000.

- **Banners:** every 14 days, counted from the day the story began, opening Wish creates three banners: **Memories**, a love interest's **wardrobe**, and **yours**. Each features the love interest featured least recently.
- **Echoes:** banners never expire. Past ones wait in **Echoes**, and you can still wish on them.
- **What a banner holds:** one featured 5★, three 4★s and six 3★ Snapshots.
  - A **Memory** (5★) is a key image, a short Character Story and a voiced line.
  - A **Moment** (4★) is one playable scene and an illustration.
  - A **look** (5★ or 4★) is a complete outfit.
  - A **Snapshot** (3★ on every banner, including Memories) is a short vignette with a saved illustration. The vignette joins that love interest's Love Timeline, and only they remember it.
- **Heat:** a Memories banner's Memory and Moments follow your story's Heat. Under SFW they are SFW. Under NSFW: Fade they mix SFW and suggestive situations, and under NSFW: Explicit explicit ones too. Snapshots always stay SFW.
- **Pity:** the count is exact and shown as "5★ in 23".
  - A 5★ starts at 1.5% a wish, rises from the 46th wish without one, and the 60th is always one.
  - Every 10th wish is at least a 4★.
  - The 5★ is always the featured item, with no 50/50.
  - Pity is kept per kind of banner and carries over, Echoes included.
- **Paying:** a wish charges and rolls in one save, so it is never paid twice, and it never calls a model. A duplicate refunds 400, 60 or 10 Starlight by rarity.
- **Art:** a banner's art is its featured item's picture, painted when the banner is created, or held for your tap. Tap a ready banner image to see the whole picture without making a wish. Wardrobe banner artwork is centered and shown whole, with its chroma backdrop removed for display. Other looks, Memories, Moments and Snapshots paint once on their first open. Moment and Snapshot artwork each costs **1 image** and respects **Ask before painting** and prompt review. Existing Moments can gain their illustration without rewriting their scene or changing reading progress; existing Snapshots illustrate their saved vignette without rerolling it. Both keep their illustrations in the Album. Opening lists or making a wish paints neither, and later opens reuse saved artwork.
- **The Wardrobe:**
  - Looks, theirs and yours, are displayed with their chroma backdrop removed. The original paintings stay saved.
  - **Wear at home** puts a look, theirs or yours, on Home.
  - **Show them** shows them one of your looks.
  - Your featured look and theirs from the same two weeks make a couple set.
  - A look they wear gets its own faces.
  - When you wear a new look of yours, the love interest on Home notices it, and Home's **Me** shows their line beside your look while you wear it.
- **Memory Selector:** at affection 10, each love interest gives you one. Claim any of their Memories from past banners that you do not have yet, at no cost.
- **The Album** keeps:
  - **Memories** offers All, 3★, 4★ and 5★ filters. Unplayed Memories and Moments appear first; partially read and completed stories keep their saved progress. Snapshots are vignettes without a playable chapter.
  - the CGs you have seen and your Memories;
  - the Love Timeline: each stage and first with a love interest, each Snapshot, Moment and Memory you won with them on the day you won it, and each couple set. A Snapshot, Moment or Memory opens from there;
  - the tells you have learned;
  - your favourite lines and the soundtrack.

  It saves an image through the Engine's own image saving.

## Dates: Read Them, Read Me, Date Night and the Claw Machine

Dates is where you spend time with one love interest at a time. Every activity pays even when it goes badly. Only the rewards are capped each day: 400 Starlight from activities in all, and 300 affection per love interest from outside the story. Play is never capped, and the day ends at your own midnight.

### Read Them

Over five moments, pick what your love interest really feels from three or four readings, then hear the thought behind it.

- Each moment shows the face it names, once their five faces are painted. With voices on, their line is read aloud.
- The tells you learn reach later scenes.

### Read Me

Read Them in reverse: your love interest studies you and makes four guesses about you, from what you like and dislike to your habits, fears and dreams. Answer each with **Spot on**, **Close** or **Not at all**, and tell them the truth in your own words if you like.

- It pays 40 Starlight and 20 affection, plus 10 for each guess they get spot on and 5 for each close one, within the day's caps. It is 1 model call, and it follows your story's Heat.
- **What they know about you:** every answer goes into that love interest's notebook. Open it from Read Me to read it, rewrite your own words or delete an entry.
- Only that love interest knows it. It reaches the scenes they're in, their Home notes and messages, and dates and stories with them, never another love interest's prompts. Others in a scene only learn what happens on the page.
- It is never part of story memory, so a delete is final. A scene already written ahead keeps the notebook it was written with; your change reaches the next one.
- Guesses never touch your health, medication or cycle, and words about them can't be kept.

### Date Night

1. **Pick a place:** one of eight, one your love interest chooses, or a place your story has painted (shown with its picture).
2. **Pick what you both wear:** your base looks. A date does not offer Wardrobe looks yet.
3. **Play three scenes of choices,** judged by what they like and voiced like any scene. You can ask for a keepsake image at the end.

During a rift, Date Night becomes **Make it right**.

### Claw Machine

A round makes no model calls and paints no images. You get six drops, and you take turns.

- **Your turn:** hold the arrows or drag on the glass to move the claw, which swings when it stops, and drop it before ten seconds run out.
- **Their turn:** cheer. The eighth cheer makes them cheat in their own way:
  - steadying the claw;
  - bumping the machine;
  - slipping you an extra try;
  - slowing your swing;
  - or showing you where to drop.
- **Rewards:** a round pays 20 Starlight, 30 more for each plush, and 30 affection.
- **The shelf:** every plush either of you wins goes on your shelf. There are six series plushies, and one of each love interest.
- **Their own plush:** each love interest's plush is the animal that fits them best, in their colours: a raven, a black cat, a fox. Your Planning model draws it once, in the background, the first time you open Dates. Until then, or if it can't draw one, their plush wears their look (cut out once Home has cut it out) or shows their initials. The drawing is kept as a checked SVG with shapes only, never a script or a link.
- **Sound:** with voices on and the machine's sound on, their lines are read aloud.
- **Controls:** it plays by keyboard (arrows to move; Space to drop, or held down to cheer). Under reduced motion it resolves each drop at once. Its sounds and vibration can be turned off, and **Mute everything** in **Settings → Audio** silences them too.

Each love interest alone remembers the games you played together, as they remember an exchange of messages. These memories are never in the shared story summary, and no love interest is told what another one's own chapters left behind.

## Remind Me and the period tracker

**Remind Me** is the calendar button under **Who’s home** on Home. It shows a month at a time:

- each love interest's birthday;
- the day your story began;
- the firsts of your Love Timeline, such as each stage you reach with a love interest, or the first time one opens up in a Closer (Snapshots, Moments, Memories and couple sets stay in the Album);
- the last day of each running Wish banner;
- your own birthday, if you add it. It stays on this device and is never sent with a prompt.

Arrow keys move through the days, Home and End go to the ends of a week, and Page Up and Page Down move by month. **Coming up** lists the next two months.

**Settings → Tracker** holds an optional period tracker, for anyone who has periods. It is off by default.

- **Logging:** you log first days. It predicts the next from your cycle length, or predicts nothing when your cycle is irregular.
- **Hearts:** Remind Me shows logged days as filled hearts, and predicted ones as outlined hearts labelled "predicted".
- **Never late:** it never computes "late". A predicted day that passes simply gives way to the next one. It isn't medical advice.
- **Caring message:** on a day the tracker has something to say (a day of a logged period, or a predicted start within three days), Home shows **Caring message**, a rose button beside Remind Me. The love interest on Home writes you a note from one line about today.
- **Keep it off the model** answers with a comfort line written in advance instead, and sends nothing.

What the tracker keeps, what it sends and what it never sends are under [The period tracker's rules](#the-period-trackers-rules).

## Content settings, NSFW mode and Lines & Veils

Each story has its own content settings:

- **Heat:** SFW (the default), NSFW: Fade or NSFW: Explicit.
- **Darkness:** Gentle, Angst (the default) or Dark romance.
- **Lines & Veils:** a Line is never written; a Veil happens only off the page.
- **Image rating:** SFW (the default), Suggestive or Explicit.

**The 18+ gate:** NSFW Heat, Dark romance and the image ratings above SFW unlock only after a one-time confirmation: "I am 18 or older. Love interests are always adults. This is fiction."

- The confirmation is self-reported, stored with its time, and checked by the server on every change.
- Turning a setting down never asks.
- Withdrawing the confirmation turns every story back to SFW Heat, at most Angst, and SFW images.

**Fixed rules:** love interests are always adults, and non-consent and pregnancy start as Lines. Darkness gives the rest of the Lines & Veils catalog its defaults:

- you can add limits of your own;
- changing Darkness keeps the levels you set yourself.

**Banned phrases:** in **Settings → Content**, type the words and phrases you never want to read, separated by commas or one per line. Every scene, message and note avoids them, on top of the built-in list of overused phrases.

**NSFW mode:** NSFW Heat or Dark romance turns it on for the story, its chapters and Messages.

- Romance escalates without stopping to ask, love interests may make the first move, and language is not sanitized: swearing, dirty talk and crude words are fine wherever they fit a character's voice.
- NSFW: Fade writes the build-up and cuts at the threshold; NSFW: Explicit writes sex on the page in full, unhurried, from the build-up to the aftermath, with the characters talking through it. A scene that reaches sex may run longer than other scenes.
- Dark romance lets villains play dirty and aim menace at you, with graphic violence wherever your limits allow it. Its darkness has a reason, a hidden cost and lines they won't cross. Your choices always include refusing, and the story honours what you pick.
- What you set to Allow is told to the model, and your Lines and Veils always win. Non-consent can move off Line only under Dark romance with NSFW Heat.
- The model never stops a scene to ask, and no love interest checks in or offers to stop, sex included: **Ease off** is your stop.
- Home, notes and Snapshots always stay SFW.
- In an SFW story, and on Home, characters may still swear when it fits their voice; the explicit sexual words are NSFW mode's.
- Story memory follows your settings: its summaries record intimacy and darkness as the story wrote them, never a Line, and a Veil only as having happened off the page. Nothing from the period tracker is ever remembered.

**Intimacy preferences** (NSFW Heat only, Fade or Explicit, never SFW):

- **Your role:** an optional Sub, Dom or Switch beside the Heat setting, in setup and **Settings → Content**. It is unspecified by default. It colours intimate scenes when they come, never every scene, and never decides what a love interest is like. Lowering Heat to SFW, or withdrawing the 18+ confirmation, clears it.
- **Love interests' own tastes:** a new bible in an NSFW story gets a short intimacy part: what they are into, kinks included, and what draws them. They are tastes, not a checklist, and scenes and banner stories bring them in when a scene turns intimate, not in every scene. What a scene may hold is still up to your Heat, Darkness and Lines & Veils, consent toggles included.
- **Older casts:** a love interest whose bible has none gets **Add intimacy preferences** on the forge's cast list (Home → **Who's home** → **Your cast**). It costs 1 call on the Planning connection, writes only that part, and keeps the rest of the bible, your story and your progress as they are. The text stays in the spoiler-gated bible.
- **In the bible:** behind **Show spoilers**, an **Intimacy** part lists them as **Into** and **Drawn to**. Edit them there, or empty both to remove them; the cast then offers to add them again.
- An SFW story never writes or sends any of it, even for a bible that kept it from before Heat was lowered.

**Images** follow their own rating.

- Suggestive is a ceiling, not an instruction to make every image suggestive. Neutral portraits and expression edits stay neutral; romantic image briefs follow the actual moment.
- Facial expression edits use the same adult, nonsexual face-edit policy at every rating, preserving the current look's body, clothing coverage, pose and style. A provider may still refuse the reference image or request; retry remains explicit.
- Looks, faces, outfits, couple portraits, Moment and Snapshot illustrations always stay clothed (at most Suggestive), and places never show people.
- Only a story CG of an explicit scene, or the art of an explicit Memory, under NSFW: Explicit Heat and the Explicit image rating, may show nudity or sex. Other Memory art stays clothed, and an explicit Memory painted after you lower either setting shows the same moment clothed.
- Every image prompt says everyone is an adult, and its negative prompt keeps the child terms whatever you edit. Above SFW, any part of a prompt that names a minor is dropped.
- Your image connection decides the rest:
  - Grok (xAI) ignores negative prompts, uses at most three reference images, and may refuse an image.
  - ComfyUI and RunPod follow your workflow, which needs `%negative_prompt%` to receive the negatives.
  - A refused image shows as a failed paint with Retry.

## What costs what

Anything that costs money to generate is labelled where you start it, and almost nothing paid is retried by itself. Text gets at most one automatic repair turn when a reply comes back in the wrong format, a love interest's lines written ahead that failed are tried again on a Home visit at least 10 minutes later, and a love interest's plush that failed is drawn again on a visit to Dates at least 10 minutes later. Images, music and voices never retry without a tap. "Call" means one request to a text connection.

If a text endpoint rejects the optional JSON-format parameter, Otome Hearth can make one additional request without that parameter. The reply still has to pass the same validation, and any content repair keeps that compatible request format. Authentication, rate-limit, server and network failures do not trigger this compatibility retry.

| What you do                                         | Text model                                                                                                                                                                        | Images                                                                                                                     | Music                                 | Voices                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **Surprise me** in setup                            | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| **Forge our story**                                 | 1 call for the world, 1 per love interest's bible                                                                                                                                 | —                                                                                                                          | —                                     | —                                                          |
| **Add intimacy preferences** (NSFW, an older bible) | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| **Begin** (the prologue)                            | 1 call, once                                                                                                                                                                      | —                                                                                                                          | —                                     | —                                                          |
| **Paint the cast**                                  | —                                                                                                                                                                                 | 1 per love interest and 1 for you                                                                                          | —                                     | —                                                          |
| Faces (**Expressions** on)                          | —                                                                                                                                                                                 | about 5 per look, in the background                                                                                        | —                                     | —                                                          |
| **Repaint expressions**                             | —                                                                                                                                                                                 | 5, on your confirmation, for the current look                                                                              | —                                     | —                                                          |
| Start a main chapter                                | 1 call to plan it                                                                                                                                                                 | —                                                                                                                          | —                                     | —                                                          |
| Read a scene                                        | 1 call per scene (the next one is written ahead)                                                                                                                                  | 1 per new place and per key moment (with **Ask before painting**, on your tap)                                             | —                                     | each voiced line, once                                     |
| A confrontation or a Closer                         | 1 call for all three rounds                                                                                                                                                       | —                                                                                                                          | —                                     | each voiced line, once                                     |
| **Rewrite**                                         | 1 call, plus 1 to write the next scene again when it was already written ahead                                                                                                    | this scene's key moment and the next scene's, painted again when they have one (with **Ask before painting**, on your tap) | —                                     | as any scene                                               |
| A route or repair chapter                           | 1 call to plan, then 1 per scene                                                                                                                                                  | as any scene                                                                                                               | —                                     | as any scene                                               |
| Story memory                                        | background summaries of finished chapters                                                                                                                                         | —                                                                                                                          | —                                     | —                                                          |
| **Generate music** on                               | 1 call per mood, for its brief                                                                                                                                                    | —                                                                                                                          | 1 track per mood (up to 6), made once | —                                                          |
| **Chapter themes** on                               | 1 call per chapter, for its thematic brief                                                                                                                                        | —                                                                                                                          | 1 track per chapter, reused on replay | —                                                          |
| Home's message of the day                           | 1 call per love interest you see, per day (again when a rift opens or closes)                                                                                                     | —                                                                                                                          | —                                     | **Play**: once                                             |
| Home's lines written ahead                          | in the background: 1 call per love interest per stage (the first also writes their comfort and Claw Machine lines), and again on a Home visit at least 10 minutes after a failure | —                                                                                                                          | —                                     | each tap line once; comfort lines every time, never cached |
| A love interest's plush                             | in the background: 1 call per love interest, once (again 10+ minutes after a failure)                                                                                             | —                                                                                                                          | —                                     | —                                                          |
| A Messages reply                                    | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| **Close and remember**                              | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| Open Wish in a new fortnight                        | 1 call per banner (3)                                                                                                                                                             | up to 3, for banner art                                                                                                    | —                                     | —                                                          |
| First open of a Memory                              | 1 call to plan it, then 1 per scene as you read                                                                                                                                   | 1, unless it was the banner art                                                                                            | —                                     | its voiced line, once                                      |
| First open of a Moment                              | 1 call for its scene                                                                                                                                                              | 1, once; held for your tap under Ask before painting or prompt review                                                      | —                                     | as any scene                                               |
| First open of a Snapshot                            | —                                                                                                                                                                                 | 1, once; held for your tap under Ask before painting or prompt review                                                      | —                                     | —                                                          |
| First open of a look                                | 1 call for its first-wear scene, for a love interest's featured 5★ look only                                                                                                      | 1, unless it was the banner art                                                                                            | —                                     | as any scene                                               |
| **Wear at home**                                    | your new look: 1 call, as they notice it                                                                                                                                          | their look: its faces, about 5                                                                                             | —                                     | —                                                          |
| **Show them**                                       | 1 call each time                                                                                                                                                                  | —                                                                                                                          | —                                     | its line, every time, never cached                         |
| A couple set's portrait                             | —                                                                                                                                                                                 | 1, on your tap                                                                                                             | —                                     | —                                                          |
| Read Them                                           | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | each voiced line, once                                     |
| Read Me                                             | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | each voiced line, once                                     |
| Date Night                                          | 4 calls                                                                                                                                                                           | new places and missing faces as in any scene, and 1 for a keepsake if you ask                                              | —                                     | as any scene                                               |
| **Caring message**                                  | 1 call, or none with **Keep it off the model** or a debug condition on                                                                                                            | —                                                                                                                          | —                                     | **Play**: every time, never cached                         |

These never call a model or paint anything. With voices on, their lines are voiced: Claw Machine lines once each, comfort lines every time.

- a wish, single or ten;
- a Claw Machine round;
- **Ease off**;
- a tap on Home and **Rough day?** (they speak lines already written);
- Remind Me and the period tracker;
- **Keep it off the model**;
- browsing the Album, Echoes and the Wardrobe;
- claiming with a Memory Selector (opening the Memory afterwards costs what any first open does);
- cut-outs (a love interest without the backdrop), which are the Engine's own sprite cleanup.

## Privacy & data

### Where your stories live

- **Package documents:** stories are kept in Marinara Engine's own database, on the computer that runs it, as documents whose ids start with `otome-forge:`. This covers the world, the cast and their bibles, chapters and scenes, progress, messages of the day, message threads, lines written ahead, banners, the items you win, the plush shelf, your latest Claw Machine rounds and each love interest's plush, your Read Me games, and each love interest's notebook of what they know about you, your own words included.
  - They travel with Engine backups and profile exports.
  - Package documents aren't isolated per package, so other installed packages could read them.
- **The Global Gallery:** painted looks, places, faces, CGs, banner art and Home cut-outs are saved there, and deleting a story deletes them too.
- **Music and voices:** generated music is kept by the Engine with its other generated audio. The Engine caches voiced lines, except comfort lines and caring messages.
- **This browser:** these are kept here and nowhere else, under these keys:
  - your look (Midnight, Pearl or Follow system): `otome-forge:look:v1`;
  - an unfinished setup: `otome-forge:setup-draft:v1`;
  - the period tracker: `otome-forge:cycle:v1`;
  - today's caring messages: `otome-forge:care-note:v1`;
  - your own birthday: `otome-forge:profile:v1`.

  Browser storage is shared with the Engine page, so other installed packages could read it. Safari may clear it after about 7 days without a visit.

- **The 18+ confirmation** is self-reported and stored with the date you gave it.
- **Deleting a story:** deleting it from **Your stories** removes its saves and painted images. Its generated music stays with the Engine's other generated audio, and its voiced lines stay in the Engine's voice cache in this browser.

### What leaves your device

- **Prompts:** prompts go to the model provider of the connection that writes them, with your writing style. With a cloud provider, that text leaves your device.
- **Persona grounding:** prompts that describe your protagonist include their whole **Description, Personality, Backstory and authored Appearance**. This covers world/cast setup, chapter and scene writing, routes and repairs, dates, item stories and outfit reactions, phone replies, Home notes and touch lines, Caring messages, Read Him and Read Me. Scenario, greetings and example dialogue are excluded; an image-only Appearance Override is not story appearance. The fields refresh when you open a story and before setup, main-chapter planning, scene writing, route/repair planning and date planning. Other prompts use the story's last saved copy.
- **Other providers:** image prompts go to your image connection. Every image of your persona uses their current **Appearance**, whole, or **Image Appearance Override** while you have it enabled; an outfit's clothing changes are added to it. An empty Appearance uses your avatar reference and the requested clothing without an invented body description or extra model call. An unavailable persona keeps its own saved look as a fallback. A linked love interest's likeness reference is their card's **Full Body → Neutral** sprite when available, then the current card avatar, then their retained Otome look. Your persona keeps their avatar reference. Scenes add the outfits people wear after their identity references, within the Engine's four-image limit. Music briefs go to your audio connection, and voiced lines to your voice provider.
- **Debug mode:** with the Engine's Debug mode or `DEBUG_AGENTS` on, every prompt Otome Hearth sends is written to the Engine's server log as `[debug/otome-forge/…]`, and the Engine logs image prompts too. In debug mode, and at a debug log level, the Engine's model providers also log whole requests.

### The period tracker's rules

1. **Opt-in for anyone:** "Period tracker — for anyone who has periods. Off by default."
2. **Stored only in this browser** (`otome-forge:cycle:v1`). It is never in package documents, backups, story memory, summaries, ledgers or logs.
   - **Delete all cycle data**, in **Settings → Tracker** or **Privacy & data**, removes it and today's caring messages in one click.
   - An export file moves it to another device. If Safari clears browser storage, the export is your copy.
3. **Only today reaches a prompt, never the history.** The browser works out one line about today: a period predicted in up to three days, one predicted around today, day N of a logged period, or nothing. "Late" is never computed.
4. **What a Caring message sends:** one line about today goes to the model provider of the story's Messages connection, and nothing else. An example is "Mira has told you: today is day 2 of her period.", with your protagonist's own pronoun ("their" by default). Pressing **Play** also sends the note to your voice provider, with no audio cache.
5. **Where the note stays:** the note is kept in this browser for that day only. It is never stored on the server, never enters story memory or another prompt, and is never quoted into a reply.
6. **When nothing is sent:** with **Keep it off the model**, or whenever a debug condition is on, a comfort line written in advance answers instead. The debug conditions are the Engine's debug mode, `DEBUG_AGENTS` and a debug log level; the Engine's providers log whole requests under each of them.
7. **What the logs can show:** Otome Hearth redacts the line from its own prompt log, and the server stores nothing about it. The Engine writes no request line for a Caring message. One limit remains: a provider warning during its model call (a rate limit, a retry, a fallback) names the request's route and time, never the line or the note. So a server log can show that a Caring message was asked for that day.
8. **Comfort, never advice:** love interests comfort and never diagnose or prescribe. Comfort lines are written for every love interest as generic "rough day" comfort, so writing them reveals nothing.

## Playing from a phone or another device

Otome Hearth's routes are privileged Engine routes. On the computer that runs Marinara Engine they work as they are. From a phone, a tablet or another computer:

1. Set `ADMIN_SECRET` in the server's `.env`.
2. Enter the same value in **Settings → Advanced → Admin Access** on that device. Marinara sends it as the `X-Admin-Secret` header.

Signing in with the Engine's login is not enough yet, because package routes do not accept a signed-in browser.

## Gacha Forge

Otome Hearth is a package of its own. It installs and plays without Gacha Forge, and the two can be installed side by side.

- **Separate saves:** it never reads or writes Gacha Forge's saves, and its documents all start with `otome-forge:`.
- **Shared parts:** it reuses the parts that personalize Gacha Forge:
  - story memory and recall, with private memory;
  - day keys and choices;
  - faces and avatar references;
  - music briefs and voice picking.

  These come from a shared forge kit, built into Otome Hearth's own files, so updating or removing one game never changes the other.

## Fonts

Otome Hearth's type is Cormorant Garamond for titles, Nunito Sans for text and Caveat for handwritten notes. They are embedded in Otome Hearth's own files as Latin and Latin Extended subsets, so nothing is fetched from a font service. Text in other scripts uses your system's fonts. The families load under Otome-only names, so they never replace a font the Engine or another package uses.

All three are licensed under the SIL Open Font License 1.1. The licence ships with the package as `fonts/OFL.txt`, and the font files are in [`fonts/`](fonts/).
