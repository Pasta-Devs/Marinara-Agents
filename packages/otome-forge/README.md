# Otome Hearth

Otome Hearth is a single-player otome game made from your own characters. Its love interests remember what you chose and change because of it, wait for you at Home, send you messages and go on dates with you. Wishes bring you their side stories and looks, paid for only with Starlight you earn by playing. There is no real money in it, banners never expire, and nothing runs on stamina.

Release 1, **0.1.0 "First Date"**, holds the whole first loop:

- story setup with hidden character bibles;
- main chapters and a route for each love interest, with confrontations, warm Closers and grievances;
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

1. **Story:** a premise, or **Surprise me** to have your model write one (an original world). The story keeps your premise's genre, era and technology. A premise or a card set in an existing world, such as Teyvat from Genshin Impact, keeps that world and its canon. Then the language the story is written in, **How it's written** (tense, point of view, pacing: anything you want every scene, message and note to follow; also in **Settings → Content**), **Banned phrases** (words and phrases you never want to read; also in **Settings → Content**), and an optional title.
2. **You:** the persona you play, your pronouns, up to five traits, and a goal of your own that isn't romance. Your persona's **Description, Personality, Backstory and Appearance** reach story writing and personal interactions whole; see [What leaves your device](#what-leaves-your-device) for the prompt list and refresh behavior. Scenario, greetings and example dialogue are excluded. An unavailable persona keeps its own saved text as a fallback.
3. **Cast:** two to five love interests. Pick them from your character cards or from six original archetypes: Brilliant Monster, Gilded Tyrant, Gentle Liar, Loyal Blade, Ruined Saint and Laughing Stranger. Love interests can be any gender and use the pronouns you pick. A card stays canon: the story never contradicts it.
4. **Content:** Heat, Darkness, Lines & Veils and the image rating (see [Content settings](#content-settings-nsfw-mode-and-lines--veils)).
5. **Connections:**
   - **Story** writes the scenes, and does every job you leave on **Same as Story**;
   - **Planning** plans the world, the bibles and each chapter;
   - **Messages** writes replies in the message threads;
   - **Memory** summarizes what happened, so the cast remembers it;
   - an optional image connection, its **Image style**, **Ask before painting**, and **Expressions** (on by default). **Don't paint** keeps to your Engine art (see [Your Engine art first](#pictures-faces-music-and-voices)). Love interests are painted on a bright chroma backdrop that the Engine's sprite cleanup then removes, so they stand on every screen without one.
6. **Review:** what forging will cost, then **Forge our story**.

Forging writes the world and its central mystery: each love interest holds one piece of it and has their own reason to hide it. It then writes a hidden bible for each love interest:

- age, always 18 or over;
- wound, the lie they believe, want, need and fear;
- mask and tells, and their true self;
- flaws, moral code and red lines;
- voice, including how they care, get angry and get jealous;
- how they stand with each of the others;
- secrets that come out stage by stage.

Bibles sit behind a spoiler gate, and you can edit them. A step that fails or is stopped waits for you to try it again. Base looks are painted only when you tap **Paint the cast**. To paint one again later, open **Your cast** from **Settings → Stories** and choose **Repaint**. Then choose **Begin**.

With **Expressions** on, **Repaint expressions** beside a love interest's repaint action replaces the five faces for the look they currently wear. It uses that look as the image reference and your configured image style. The current set stays available while replacements paint, and a failed replacement keeps it. With prompt review on, review all five prompts first; the last confirmation starts the five paid images. Canceling the review paints nothing. Reading or replaying a scene never triggers this replacement.

**Begin** plays the **prologue** first: one short scene of your protagonist's own life, just before the story opens. No love interest is in it; you meet them in chapter 1, which picks up where the prologue ends. It is written once, and the Story screen offers it again. **Skip** goes straight Home.

You can keep several stories. **Your stories** lists them, and deleting one asks you to type its title; open it from **Settings → Stories**. **Settings** changes a story's content, connections, images and audio later. On desktop, Settings uses the available stage space. On phones, its categories form one horizontally scrolling row, and long settings pages remain vertically scrollable.

In **Your cast**, open a love interest and choose their **Character card** to link an Engine card explicitly. Its assigned voice and image references apply without replacing the love interest's story, progress or saved pictures. **No linked card** removes the association. Future paints prefer the card's **Full Body → Neutral** sprite, then its current avatar, then the retained Otome look; linking never paints automatically.

## The story

Main chapters come in **arcs**. Before an arc's first chapter is planned, the arc planner sets a goal, a big event near its end, and where the mystery's answers come out, and plans eight to twelve chapters toward it in one short line each. It is the only planner that sees the mystery's whole answer. A chapter sees it only in the chapter scheduled to reveal it, and must put it on the page there; a chapter that reveals nothing never touches it. The Story screen shows the arc's name and how far in you are. Its chapter list is grouped under each arc, a chapter's reader says which arc it belongs to, and a breathing-room arc carries a quiet-stretch badge. A story that began before arcs keeps its chapters as they are, and its first arc starts at the next chapter.

When an arc closes, the story asks how it goes on. **Take a breath** plans three to five chapters with the people you love, no plot in them, and its last one lands warm. **Go on with the story** plans another arc, with a new threat and a new question. **Meet someone new** brings in one of your character cards or someone invented, and writes them in: their bible, their ties to everyone already there, and an arc whose first chapter puts them in a room with at least one of the others. The cast holds five love interests; at five the option is gone.

Each main chapter is led by one love interest. Otome Hearth offers two to choose from: the one you have spent the least time with, and the one with the most unresolved between you. A love interest who holds a grievance against you is never offered (see [Grievances](#routes-confrontations-closers-and-grievances)), though they can still appear in the chapter. The chapter planner adds a second love interest whose goals get in the way, and writes six to nine scenes that build to a climax: a Confrontation, or a warm Closer. After two main chapters in a row end the same way, the next one ends with the other. Each scene is written when you reach it, and the next one is written ahead while you read.

- **Who speaks:** every line names its speaker. Each love interest's line shows one of five faces: tender, flustered, cold, hurt or angry. Your thoughts are set apart, and after something that matters to you (a first kiss, a night together, a quarrel, a secret learned) your protagonist takes a moment to sit with it in their own voice, doubts and hopes included. From the second stage of a love interest's story you may hear one of their thoughts too.
- **Choices:** your first choice in a scene is canon. Replaying a chapter shows the other branches without changing anything. A choice that changes things between you names who will remember it, and the last scene may end on one lasting choice. You can answer that one in your own words with **Write your own…**: something you say or something you do, up to 280 characters. It moves no one's trust or affection; the next chapter of that storyline starts from it.
- **Side with:** now and then, when two to four love interests in a scene argue or want to handle something differently, you get to back one of them. There is one option per love interest, and no staying out of it. The one you back gains 30 affection; each one you pass over loses 10, never below a level you've reached. It comes at most once every four main chapters (chapter 4 at the earliest), and only when the story gives them a real disagreement. Like any first choice it is canon: later scenes remember whom you sided with, and replaying changes nothing.
- **What you know:** your protagonist knows only what the story has shown them. A love interest's past, habits and words for their world reach you when you are told, see or find them out, and a protagonist new to the world learns its people and customs as they go.
- **A life of your own:** chapters have other people in them, scenes without any love interest, and time to rest and sleep after a long day or a night.
- **Private memory:** each love interest remembers only what they saw, did or were told. Their route and repair chapters and their Character Stories join the story's timeline marked private, so they always remember them and the others act only on what they could see. Their dates and message threads are recalled only in scenes they're in, and on their own Home and in their messages. A conversation you closed in the group chat is recalled the same way by each love interest who was in it, never by anyone else. Your last Character Story (a Memory's story, a Moment, a first-wear scene or a birthday scene, whichever you finished last) always reaches the main, route and repair chapters that follow, whoever leads them, marked private between you and its love interest, so those chapters keep to what happened in it and the others still don't know about it. A love interest's side of a chapter, once you read it, goes in full right after that chapter into the next main, route or repair chapter written after it (and that chapter's plan), whoever leads it; anywhere else (messages, Home, dates, Tarot night, Character Stories) it reaches only that love interest's own prompts and scenes they're in, and the others know it only from the timeline. It also joins the timeline by its summary, which takes its place after that. Its thoughts are marked as theirs alone: nobody else, your protagonist included, knows them.
- **Story memory:** finished chapters are summarized in the background. If a summary fails, every screen of the story says so at the top, with what the connection answered (for example, that the model's context is too small). **Retry the summary** tries it again; a failed summary is never retried by itself. **Change connection** opens **Settings → Connections** at the **Memory** connection (under **More connections**), where you can give it a model with a larger context; a pick you have not saved yet stays. While no connection can write summaries, the banner offers only **Change connection**, to **Settings → Connections**, and goes once you save one. The story list shows no banner: open the story to see it. **Settings → Connections** and **Settings → Debug** show the memory's status, the connection's whole message and Retry.
- **While you wait:** while an arc is planned, **What happened so far…** shows the story's running summary. While any other chapter is planned, **Play the personality quiz** offers statements to answer from strongly disagree (1) to strongly agree (5). Your first answer is kept, and you then see each love interest's own answer and how alike the two of you are so far. Statements about sex and kinks appear only while Heat is NSFW. Once you have answered every statement you can see, 50 new ones are written in the background. While a scene is written, **Who said what?** asks which love interest said a line from the story so far.
- **Rewrite** writes the scene you are reading again, before you make any of its choices.
- **Ease off** ends a scene at once, with no model call of its own, and can veil that kind of content from then on. If the next scene was already written ahead, it is written again from the aftermath (1 call), and its key moment, if it has one, is painted again (1 image).
- **When your model declines a scene,** Otome Hearth says so and saves nothing. You can ease off past it, try again, or switch the connection.
- **Rewards:** reading pays 30 Starlight for each scene read to its end and 160 for a chapter. Affection is 150 for the chapter's lead and 60 for the second love interest, and 30 for the one you side with. Story earnings are never capped.
- **Reader controls:** Auto, Skip what you've read, the Backlog (which can play a line again), Hide the text and Cancel.
- **On mobile:** the three-dot button opens the secondary controls in a vertical list. The audio button mutes or unmutes music and voices, and the fullscreen button stays beside it. Chapter cutouts continue behind the dialogue panel.

## Routes, confrontations, Closers and grievances

Each love interest moves through six stages, from Mask to Bond.

- **Affection progress:** **Story → Between you** shows the points earned within the current level beneath **Level**, out of the points needed for the next: 200 for level 2, then 50 more for each level, up to 600 for level 10. Level 10 is the maximum. These levels unlock route chapters; completing their gates advances the relationship's six-stage arc.
- **Prestige:** past level 10, affection keeps counting. Every 300 points earns a prestige point, and **Between you** shows the three prestige pips and the progress toward the next point. Three points unlock an extra story with that love interest, and the pips start again. **A new story with …** writes it with one model call, and it plays like a Character Story. It's something the two of you imagine or play out for fun: a what-if like a wedding, a family or a honeymoon, a mini AU like a vampire or a modern AU, or, in an NSFW story, a kink you explore together. Each one is new, it follows your story's Heat, and it never changes the main story: its choices move nothing, and the main story never recalls it.
- **Route chapters are free.** The next one opens at an affection level (3, 5, 7, 8, then 10). It takes one model call to plan.
- **Slow burn:** through the first four stages, neither of you says what you feel; it shows in tension, glances and near misses. Desire can still come first, out of lust or to get what they want, as your Heat allows, and feelings may grow from it. In the fifth stage a love interest may confess once the story has earned it, and by their route's finale at the latest they say it; in the sixth, if they never have, they do.
- **The gate:** only a route chapter's last scene moves a love interest on a stage. The fourth stage's gate reveals one of their secrets. The fifth stage's chapter holds a confrontation, and its gate ends on a choice that cannot be undone.
- **Rewards:** a route chapter earns 300 Starlight and 150 affection, and the repair chapter that clears their grievance 160 Starlight and 300 affection. A hostile first-play choice in the story or on a date, a Confrontation walkout, or being shut out of a Closer can cost 15 affection points per affected love interest for each chosen option, and passing someone over when you side with another costs 10. Points never fall below the start of the highest level you have reached, with a new level every 300 points, and they never take back an extra story you've unlocked. Replaying costs nothing, and losses never refund the daily earning cap.
- **Confrontations:** a main chapter can build to one: three rounds in which you Press, Hold, Yield or Reveal. It ends in the truth, a walkout or a standoff, and what you reveal is something they know from then on. The whole confrontation is written in one model call, and your first play of it is canon. Route chapters keep theirs.
- **Closers:** the warm climax a main chapter can end with instead. Over three rounds the Lead offers something of themselves, and you answer: Reassure, Tease, Mirror (share something of your own, which they know from then on) or Ask. They end **Opened up** (trust grows, and the first time it's a first on your Love Timeline), **Almost** (nothing changes) or **Shut out** if it goes wrong (trust falls, and they hold a minor grievance). In an NSFW story, Opened up can turn intimate, drawing on their tastes and your role, within your content settings. Like a confrontation, it is one model call, and your first play is canon.
- **Their grievance:** only a serious break earns one: a Confrontation walkout, or a scene's betrayal, when their trust in you has fallen to its lowest but one. Anything milder is remembered as a grievance and still costs 15 affection, without the rest. A love interest holds at most one per story arc, and one only while someone else could still lead a chapter. While it stands:
  - they can't lead a chapter (Who walks with you says why), though they can still be in one;
  - their affection doesn't grow from anything, though losses still apply;
  - every date with them waits, open ones included, and nothing in them is lost;
  - their route chapters stay shut (you can still finish the scene on screen), Home's note is curt and their lines are cold.

  **Make it right** in Routes offers a short repair chapter once you have given them space: two main chapters read to the end after the grievance began, shown on the Story screen. Only that chapter clears it, and reading its last scene pays 160 Starlight and 300 affection. A grievance from before 0.16.0 needs no space.

- **Your grievance:** **I'm upset with them**, beside each love interest in Routes, asks first, then tells them (1 call: they answer in Messages). They know it in their messages and in the story, and work out why from what happened. Tap it again to take it back at any time. Once while you're upset, they may ask you out to clear the air, if who they are allows it and they hold no grievance of their own: their invitation waits in their thread with **Accept** and **Decline**. Accepting lets your upset go, and the invitation waits as your next Date Night with them, at a place they choose; declining ends their asking until you take it back and tell them again.
- **Their side:** after a big moment with a love interest (a route chapter's gate that moves their stage, a confrontation that ends in the truth or a walkout, a Closer that ends Opened up or Shut out, or a rift a repair chapter mends), Routes offers **their side** under their route once that chapter is finished: one scene that tells the moment again from their point of view, with their thoughts, told as things stood between you then (their stage, trust, grievances and what they knew), not as they are now. The chapter's end says when one waits.
  - Each love interest has at most one per story arc, breathing arcs included. Until you read it, it follows the arc's newest big moment, and one from an earlier arc waits until you read it. A moment you eased off, a Standoff and Almost never count. A story from before 0.15.0 gets its first with its next big moment.
  - **Read** writes it with no model call. Its scene is 1 call, offers no choices and opens in the place the moment played in, so it paints only a place that has no picture yet, and it has no key image. Reading it pays 30 Starlight and moves nothing else. It stays in the chapter list to replay.
  - It is part of the chapter it follows: the next chapter after that one is written with both in full, and later it is remembered by its summary (see **Private memory**).
- **Nothing is taken back:** a grievance never removes anything you have unlocked.

## Pictures, faces, music and voices

Everything works without images or sound: a love interest from a character card appears in that card's sprites or avatar and you in your persona's avatar, a place without art shows a gradient for its mood (or a background you choose), anyone without a picture shows their initials in their own colour, and a key moment without a painting shows a quiet card.

In **Your cast**, edit **Image appearance** above each love interest’s spoiler Bible to change how they look. Saving paints nothing and leaves the rest of their story Bible unchanged; future paintings and the story itself use the saved description from the next scene on, with the look they wear. Clear the field and save to restore the Bible’s original image description. Open **Image description** in **Who’s home** or an owned Wardrobe look to read its intended appearance without opening Bible spoilers. The reader also offers the current location’s description while it has no painted background, and a key moment’s brief once you reach it, until its image is painted. These are the existing visual instructions, not a new generated caption; opening them makes no model calls.

You can add an image connection later in **Settings → Images**. Saving it paints nothing. Open **Your cast** to paint missing base portraits, open owned items from **Wardrobe** or **Album** to add their missing artwork, or use **Paint** beside a reached story location or key moment. Each action shows its image cost and uses the existing prompt-review setting. Existing artwork, story text, progress and Starlight stay intact.

- **Your Engine art first:** a love interest from a character card stands in the card's **Full Body → Neutral** sprite (else its **Neutral** sprite, else its avatar), and you in your persona's avatar, from the moment the story is made; their paint step is done and nothing is painted for them. Their sprites become their faces: love, happy or tender for tender; blushing, embarrassed or flustered for flustered; smirk, disgusted or cold for cold; sad, crying, worried or hurt for hurt; angry or determined for angry. With an image connection, **Expressions** on and **Ask before painting** off, only the faces they lack are painted, as edits of their sprite, the first time they speak; with **Ask before painting** on, and on an avatar, no face is painted unless you choose **Repaint expressions**, which paints all five. A story in progress gives Engine art to anyone who has no portrait yet, and looks already painted stay. **Repaint** still paints over Engine art, and no Engine file is ever changed or deleted. A sprite you change in the Engine later is not picked up by a story that already shows it. A new card or persona avatar is, the next time the Engine starts, unless faces were painted on the old one; Home's **Me** shows your persona's avatar as it is now.
- **Backgrounds from the Engine:** **Background** beside a story location opens your Engine backgrounds (yours and Game Assets'), with a search by name or tag. Picking one shows it there, on Home, on dates and in photos, and paints nothing; a painting it replaces stays saved until you delete the story. With an image connection and **Ask before painting** off, a new place is painted as soon as its scene is written, so turn **Ask before painting** on to choose a background first.
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

- **Cut-outs:** your generated looks and the love interests' stand on a flat chroma background, removed for Home by the Engine's sprite cleanup. Engine sprites go through the same free cleanup, and a transparent sprite comes back as it is; card and persona avatars are never cut out. On an Engine with the preservation repair, Otome uses its built-in matte cleanup and rebuilds obsolete cut-outs from their retained originals, with no paid image call. The previous cut-out stays visible while its replacement is made, and stays if that free refresh fails; restarting the Engine lets a failed refresh try again. A first cleanup that fails shows the uncut look instead. Your original persona avatar stays as supplied, and the Wardrobe keeps every original look.
- **Message of the day:** each love interest leaves one handwritten note, written on your first visit of your local day and kept for the rest of it, with their mood. **Reply** opens their thread with the note quoted. During a rift the note is curt. The newest photo you took with that love interest in the **Photo Shoot** is taped into their note, its words wrapping around it.
- **Touch:** tap their head, cheek, chest or hand, and under NSFW Heat (Fade or Explicit) their crotch, for a line written ahead in their own voice, so a touch never waits for the model and gives no affection. Each place brings its own face, and their answers grow bolder with their stage, from their mask at the first to someone who is yours at the last. Without a picture of them, the places are labelled buttons under their initials; on a computer, Tab to one and press Enter. Too many pokes in a row annoy them, and during a rift every line is cold and the crotch is hidden. The lines are written in the background on your first Home visit, again when a love interest reaches a new stage, and once after 0.14.0 to add the new places. Until then, Home uses a few stock lines.
- **Touch and your Heat:** under NSFW Heat their touch lines follow your Heat, Darkness and Lines & Veils, their tastes included, and a touch to the chest or crotch is an intimate one; under SFW Heat they stay SFW. Under NSFW Heat, changing Heat, Darkness, Lines & Veils or your role writes their lines, Claw Machine lines included, once more; until then, lines written under other settings are never used, and earlier SFW lines or stock lines stand in. Lowering Heat to SFW hides the crotch at once.
- **Rough day?** offers comfort from lines written ahead, with no model call. Comfort lines never give medical advice or guess about your body.
- **Your thoughts…:** the thought-bubble button beside **Remind Me** asks what you think about what happened lately. Write whatever is on your protagonist's mind, up to 1000 characters: something to look into, something a love interest did that you can't forget, or a wish such as being held today. **Send** keeps it for the next main story chapter: its plan and each of its scenes take it into account, then let it go. Until that chapter is planned, a dot on the button shows your thoughts are waiting, and the window opens with them so you can change them or **Clear** them. Other chapters (routes, repairs, dates and stories) don't read them, and a love interest knows only what your protagonist says or does. Sending them calls no model.
- **Figurines:** each figurine you buy in the Shop stands on a small shelf in the room once it is painted, cut out of its backdrop like a look (a faint stand-in until its backdrop is cleared). Home never paints one.
- **Faces on Home:** their face follows the note's mood, each touch (the face that place brings at their stage) and a rift, once their five faces are painted (and cut out like the look). Before that, their look or initials name the face.
- **Voices on Home:** **Play** reads the note aloud, and taps and **Rough day?** are spoken in the voice the story gives them. Home plays the story's home music.
- **Reduced motion** turns off the parallax and the breathing.

## Messages

Each love interest has one private thread, written in whatever carries messages in your world, in their own colour, with stickers. Enter starts a new line, and only **Send** sends. Only one reply is written at a time. **Close** (its full name is **Close and remember**) saves the conversation as a memory that only that love interest recalls, and earns 5 affection (within the daily cap for everything outside the story).

- **Stickers:** with images on, your five stickers (laughing, in love, shy, sad, pouting) are 2D chibi busts of your protagonist, painted in the background the first time you open Messages; without images they are simple labelled icons. Each love interest has nine chibi stickers of their own, designed to fit them, and one unlocks at each affection level from 2 to 10 ("You unlocked a new sticker"); they need images on. A love interest can send their stickers or yours by writing a name in brackets, like `[dottore_pensive]` or `[mari_laugh]`; a name nobody owns is dropped. When two names would read the same, the love interest's gets the end of their id (`kai_ab12_smug`). Messages from before 0.6.19 keep the face stickers they had. Every sticker you have is in the Album's **Stickers** tab, cut out, to view and save.
- **When you're upset with them:** they know it in every reply, and after you tell them from Routes they write to you about it once, in the background. Their invitation to clear the air comes with **Accept** and **Decline** under it (see [Your grievance](#routes-confrontations-closers-and-grievances)).
- **Love interests who message you each day:** Settings → Connections sets how many of the love interests you've met may message you first each day, on their own (0, the default, turns it off). Each one who does writes once that day, in one or a few messages. Their messages are spread across your local day, only while Otome Hearth is open, never in the thread you have open, and arrive unread.
- **Everyone, the group chat:** once you've met two love interests, **Everyone** is pinned at the top of Messages: one thread with every love interest you've met. The starting cast are in it after the first chapter, and someone new once the first chapter of their arc is read. When you write there, someone always answers: whoever you name or write to, and the others when it suits them. Each message shows who sent it, in their colour. You can send your five stickers there, and they can send theirs or yours. Everyone in it reads everything said there, and each still knows only what the story showed them. **Close** saves the conversation as a memory that everyone in it recalls, and earns no affection. The group remembers only what you close: until then its prompt reads the newest 24 messages.
- **Group chat squabbles each day:** Settings → Connections also sets how many times a day the love interests in Everyone may start squabbling there on their own (0, the default, turns it off). Squabbles are spread across your local day, only while Otome Hearth is open, never while you have Everyone open or are waiting for its answer, and arrive unread.

## Wish, the Wardrobe and the Album

Wishes cost Starlight you earn by playing: 100 each, or 1,000 for ten. There is no real money, and a new story starts with 2,000.

- **Banners:** every 14 days, counted from the day the story began, opening Wish creates three banners: **Memories**, a love interest's **wardrobe**, and **yours**. Each features the love interest featured least recently.
- **Seasonal banners:** the first fortnight that starts in each month (on the 1st to the 14th) is that month's seasonal one: all three of its banners follow the month's theme, and a badge names it, such as **October · Halloween**. Any later fortnight that month is your model's free choice, as before. A story set in the real world gets the holiday itself; a world without it gets its own version, such as a winter festival of gifts and lights in December or a night of masks and spirits in October. The themes, January to December: New Year, Valentine's Day, White Day, cherry blossoms, gardens in bloom, June bride, summer festival, summer nights, harvest moon, Halloween, autumn and Christmas. Next year's seasonal banner knows the titles of earlier ones from the same month, so it does not repeat them. Banners made before 0.6.5 have no season.
- **Echoes:** banners never expire. Past ones wait in **Echoes**, and you can still wish on them; a seasonal one keeps its badge.
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
- **The Shop:** the last tab of Wish spends Starlight on gifts and figurines. Buying never calls a model, and a double tap pays once.
  - **Gifts** to give on a date or a birthday: a bouquet of flowers (200), a box of chocolates (300) and a bottle of wine (600), and under NSFW Heat an aphrodisiac (1,000). Buy as many as you like; they wait in your Wardrobe. An aphrodisiac bought under NSFW stays yours if you lower Heat, but the Shop, the Wardrobe, Date Night and a birthday leave it out until Heat is NSFW again.
  - **Figurines:** one of each love interest, 5,000 Starlight each. Buying one unlocks a short, funny scene with them, a Character Story you play from the Shop, the Wardrobe or the Story screen, and the figurine joins you on Home.
  - **A figurine's picture:** with an image connection, buying it paints it once, right after you buy it and in the background: **1 image** of them as a small collectible figure in the look they wear, standing on a round display base, with the same likeness reference as their looks, cut out of its backdrop for the shelf and Home. **Ask before painting** and prompt review hold it for your tap on **Paint it**. A paint that fails shows **Try painting it again** in the Shop and the Wardrobe and is never retried by itself. Opening the Shop or Home paints nothing. Until it is painted, and without an image connection, it shows their portrait frame; a figurine bought before you added an image connection offers **Paint it** once you have one.
- **Art:** a banner's art is its featured item's picture, painted when the banner is created, or held for your tap. Tap a ready banner image to see the whole picture without making a wish. Wardrobe banner artwork is centered and shown whole, with its chroma backdrop removed for display. Other looks, Memories, Moments and Snapshots paint once on their first open. Moment and Snapshot artwork each costs **1 image** and respects **Ask before painting** and prompt review. Existing Moments can gain their illustration without rewriting their scene or changing reading progress; existing Snapshots illustrate their saved vignette without rerolling it. Both keep their illustrations in the Album. Opening lists or making a wish paints neither, and later opens reuse saved artwork.
- **The Wardrobe:**
  - Looks, theirs and yours, are displayed with their chroma backdrop removed. The original paintings stay saved.
  - **Wear at home** puts a look, theirs or yours, on Home.
  - **Show them** shows them one of your looks. The first time you show a love interest a look, it earns 5 affection with them.
  - Your featured look and theirs from the same two weeks make a couple set.
  - A look they wear gets its own faces.
  - When you wear a new look of yours, the love interest on Home notices it, and Home's **Me** shows their line beside your look while you wear it.
  - **Me** also lists your **Gifts**: each gift from the Shop with how many you have, and each figurine with **Play the scene** (and **Paint it** or **Try painting it again** while its picture waits for you).
- **Memory Selector:** at affection 10, each love interest gives you one. Claim any of their Memories from past banners that you do not have yet, at no cost.
- **The Album** keeps:
  - **Memories** offers All, 3★, 4★ and 5★ filters. Unplayed Memories and Moments appear first; partially read and completed stories keep their saved progress. Snapshots are vignettes without a playable chapter.
  - the CGs you have seen and your Memories;
  - **Photos**: the photos you take in the Photo Shoot, to view, save or delete;
  - the Love Timeline: each stage and first with a love interest, each Snapshot, Moment and Memory you won with them on the day you won it, and each couple set. A Snapshot, Moment or Memory opens from there;
  - the tells you have learned;
  - your favourite lines and the soundtrack.

  It saves an image through the Engine's own image saving.

## Dates: Read Them, Read Me, Tarot night, Date Night, the Photo Shoot and the Claw Machine

Dates is where you spend time with one love interest at a time. Every activity but the Photo Shoot pays, even when it goes badly. Only the rewards are capped each day: 400 Starlight from activities in all, and 150 affection per love interest from outside the story. Play is never capped, and the day ends at your own midnight.

### Read Them

Over five moments, pick what your love interest really feels from three or four readings, then hear the thought behind it.

- Each moment shows the face it names, once their five faces are painted. With voices on, their line is read aloud.
- The tells you learn reach later scenes.

### Read Me

Read Them in reverse: your love interest studies you and makes four guesses about you, from what you want right now and what you think to your likes, dislikes, habits, fears, memories and things you would rather not admit. A guess is never what your persona already states: from a persona who loves sweets he guesses the sweet, not the liking, so every answer teaches him something new. Answer each with **Spot on**, **Close** or **Not at all**, and tell them the truth in your own words if you like.

- It pays 40 Starlight and 20 affection, plus 10 for each guess they get spot on and 5 for each close one, within the day's caps. It is 1 model call, and it follows your story's Heat.
- **What they know about you:** every answer goes into that love interest's notebook, and he never guesses it again. Open it from Read Me to read it, rewrite your own words or delete an entry.
- Only that love interest knows it. It reaches the scenes they're in, their Home notes and messages, and dates and stories with them, never another love interest's prompts. Others in a scene only learn what happens on the page.
- It is never part of story memory, so a delete is final. A scene already written ahead keeps the notebook it was written with; your change reaches the next one.
- Guesses never touch your health, medication or cycle, and words about them can't be kept.

### Tarot night

Lay out three cards of the Major Arcana with your love interest, as Past, Present and Future. Each card is drawn upright or reversed. Pick who reads (each option names your love interest):

- **They read my cards:** ask a question with a chip (**Us**, **What's coming**, **My heart**) or in your own words, up to 200 characters, or ask nothing. Pick three of 22 face-down cards, in the order they call to you, or tap **Let fate choose**. They turn the cards one at a time: the Past is a moment of your story they were there for or were told (before your story has one, your own past or what they have seen of you), the Present is what stands between you now, and the Future only hints, in images and feelings, at what your story has planned next. Then they answer your question.
- **I read their cards:** they ask the cards a question of their own, and you pick three cards for them. As each card turns they say something, and you choose one of three readings for it; your reading is spoken in your persona's voice, and they react to it.

- It pays 40 Starlight and 40 affection, within the day's caps, however it goes. It is 1 model call, and it follows your story's Heat.
- Nothing in a reading changes the story: no trust, tension or grievance moves. Only that love interest remembers it, as they remember a date or an exchange of messages, and the first one joins your Love Timeline.
- A reading you leave half-way opens again: when they read your cards, from its start, with every card face down again; when you read theirs, at the card you still have to read.
- **The deck:** with an image connection, each card is painted the first time it is drawn, 1 image, and kept for every later reading. Your cards (the Fool, the High Priestess, the Empress, Strength, Justice, the Star and the World) show you; the Magician, the Emperor, the Hierophant, the Chariot, the Hermit, the Hanged Man and the Devil show your love interest; the Lovers, Temperance, the Sun and Judgement show the two of you; and the Wheel of Fortune, Death, the Tower and the Moon show no one. A card that shows your love interest is painted for each love interest, so theirs always shows them. A reading paints at most 3 images, only for cards not painted yet. **Ask before painting** and prompt review hold them for your tap on **Paint these cards**, shown once a card is turned, and a card that fails shows **Try painting it again**. Each picture is the illustration only, painted as every picture kept outside the story is (at most Suggestive), with each person's likeness as a keepsake sends it; Otome Hearth draws the frame, the number and the name over it. Without an image connection, or until a card is painted, the cards are Otome Hearth's own gold line art. Tap a turned card to see it larger.

### Date Night

1. **Pick a place:** one of eight, one your love interest chooses, or a place your story has painted (shown with its picture).
2. **Pick what you both wear:** your everyday looks, or any painted look either of you owns in the Wardrobe (4★ and 5★). The date's scenes, key images and keepsake dress you both in them, each look worn over that person's own appearance, and the looks stay on at Home afterwards. A look you own appears once it is painted: open it in the Wardrobe.
   - **Bring a gift:** with a gift from the Shop in your Wardrobe, you can also bring one. You give it in the first scene, a special exchange where they react in their own voice, and it can change how the evening goes. An aphrodisiac is offered only under NSFW Heat: desire builds through the evening, as far as your content settings allow. The gift is used up once the date is planned, never on a resumed date or a plan that failed. When the date is counted it earns its own affection on top of the date's (40, 60, 120 or 200 by gift), even past the daily cap. Only that love interest remembers it.
3. **Play three scenes of choices,** judged by what they like and voiced like any scene. You can ask for a keepsake image at the end.

While a love interest holds a grievance against you, every date with them waits (see [Grievances](#routes-confrontations-closers-and-grievances)). A rift you held from before 0.16.0 still makes Date Night **Make it right**. After you accept their invitation to clear the air, the next Date Night you start with them is that evening (one already open comes first): it opens on what you wear, at a place they choose (you can still change it), and pays as any date.

### Photo Shoot

Take one photo of you and your love interest posing for the camera together.

1. **Pick a place** your story has painted.
2. **Pick what you both wear:** your everyday looks, or any painted look either of you owns. Only the photo wears them; what you wear at home stays as it is.
3. **Pick an expression and a pose for each of you,** from the buttons or in your own words (written into the image prompt as you type them, so English works best). A pose together, such as a kiss, a hug, play-fighting or a piggyback, is one pick for you both: choosing it sets the other's pose to match, and a solo pose for either of you ends it.
4. **Take picture** paints 1 image, sent their look, your look and the place's picture as references, in that order. It makes no model call, which is why you pick their expression and pose too.

It follows your image connection, **Ask before painting**, prompt review and the image rating, costs no Starlight and pays nothing. A photo that fails is taken again only when you ask. Without an image connection the Photo Shoot shows as unavailable.

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

**Birthdays to celebrate:** once you have read a chapter after the prologue, a love interest's birthday (the one in their bible) puts a dot on Home's **Remind Me**, and Remind Me lists it at the top. A 29 February birthday falls on 28 February in other years, and a date no year has, such as 30 February, is no birthday.

- **Celebrate** opens a choice of gift: one of your Shop gifts, or none. It calls no model. Their birthday scene then opens in the reader, a Character Story of the two of you, written as you open it and voiced like any scene. The gift is its special moment: they react to it in their own voice.
- **Missed the day?** You can still celebrate for 7 days after it, and the scene knows how late you are. After that, that year's birthday is gone. Each birthday is celebrated once a year, even if you change the date in their bible.
- **What it costs and earns:** the gift is used up when you celebrate. The scene pays 30 Starlight like any scene, and the gift's own affection (40, 60, 120 or 200) when you read it to its end, even past the daily cap. Without a gift it earns no affection. A scene you left unfinished waits on the Story screen, and in Remind Me (**Play the scene**) until its 7 days are over.
- Only that love interest remembers it, as with any Character Story. Messages don't know it's their birthday; their Home note does.

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

**Banned phrases:** when you set up a story or later in **Settings → Content**, type the words and phrases you never want to read, separated by commas or one per line. Every scene, message and note avoids them, on top of the built-in list of overused phrases. Set during setup, they also apply to the world and every love interest’s Bible as they are forged.

**NSFW mode:** NSFW Heat or Dark romance turns it on for the story, its chapters and Messages.

- Romance escalates without stopping to ask, love interests may make the first move, and language is not sanitized: swearing, dirty talk and crude words are fine wherever they fit a character's voice.
- NSFW: Fade writes the build-up and cuts at the threshold; NSFW: Explicit writes sex on the page in full, unhurried, from the build-up to the aftermath, with the characters talking through it. A scene that reaches sex may run longer than other scenes.
- Dark romance lets villains play dirty and aim menace at you, with graphic violence wherever your limits allow it. Its darkness has a reason, a hidden cost and lines they won't cross. Your choices always include refusing, and the story honours what you pick.
- What you set to Allow is told to the model, and your Lines and Veils always win. Non-consent can move off Line only under Dark romance with NSFW Heat.
- The model never stops a scene to ask, and no love interest checks in or offers to stop, sex included: **Ease off** is your stop.
- Notes and Snapshots always stay SFW; touches on Home follow your Heat (see [Home](#home)).
- In an SFW story, and in notes and Snapshots, characters may still swear when it fits their voice; the explicit sexual words are NSFW mode's.
- Story memory follows your settings: its summaries record intimacy and darkness as the story wrote them, never a Line, and a Veil only as having happened off the page. Nothing from the period tracker is ever remembered.

**Intimacy preferences** (NSFW Heat only, Fade or Explicit, never SFW):

- **Your role:** an optional Sub, Dom or Switch beside the Heat setting, in setup and **Settings → Content**. It is unspecified by default. It colours intimate scenes when they come, never every scene, and never decides what a love interest is like. Lowering Heat to SFW, or withdrawing the 18+ confirmation, clears it.
- **Love interests' own tastes:** a new bible in an NSFW story gets a short intimacy part: what they are into, kinks included, and what draws them. They are tastes, not a checklist, and scenes, banner stories and touch on Home bring them in when a moment turns intimate, not every time. What a scene may hold is still up to your Heat, Darkness and Lines & Veils, consent toggles included.
- **Older casts:** a love interest whose bible has none gets **Add intimacy preferences** on the forge's cast list (**Settings → Stories → Your cast**). It costs 1 call on the Planning connection, writes only that part, and keeps the rest of the bible, your story and your progress as they are. The text stays in the spoiler-gated bible.
- **In the bible:** behind **Show spoilers**, an **Intimacy** part lists them as **Into** and **Drawn to**. Edit them there, or empty both to remove them; the cast then offers to add them again.
- An SFW story never writes or sends any of it, even for a bible that kept it from before Heat was lowered.

**Images** follow their own rating.

- Suggestive is a ceiling, not an instruction to make every image suggestive. Neutral portraits and expression edits stay neutral; romantic image briefs follow the actual moment.
- Facial expression edits use the same adult, nonsexual face-edit policy at every rating, preserving the current look's body, clothing coverage, pose and style. A provider may still refuse the reference image or request; retry remains explicit.
- Looks, faces, outfits, couple portraits, Photo Shoot photos, Moment and Snapshot illustrations and Tarot cards always stay clothed (at most Suggestive), and places, like the Tarot cards of no one, never show people.
- Only a story CG of an explicit scene, or the art of an explicit Memory, under NSFW: Explicit Heat and the Explicit image rating, may show nudity or sex. Other Memory art stays clothed, and an explicit Memory painted after you lower either setting shows the same moment clothed.
- Every image prompt says everyone is an adult, and its negative prompt keeps the child terms whatever you edit. Above SFW, any part of a prompt that names a minor is dropped.
- Your image connection decides the rest:
  - Grok (xAI) ignores negative prompts, uses at most three reference images, and may refuse an image.
  - ComfyUI and RunPod follow your workflow, which needs `%negative_prompt%` to receive the negatives.
  - A refused image shows as a failed paint with Retry.

## What costs what

Anything that costs money to generate is labelled where you start it, and almost nothing paid is retried by itself. Text gets at most one automatic repair turn when a reply comes back in the wrong format, a love interest's lines written ahead that failed are tried again on a Home visit at least 10 minutes later, and a love interest's plush that failed is drawn again on a visit to Dates at least 10 minutes later. Images, music and voices never retry without a tap. "Call" means one request to a text connection.

If a text endpoint rejects the optional JSON-format parameter, Otome Hearth can make one additional request without that parameter, and leaves the parameter off that connection's later requests to the same model until Otome Hearth is reloaded or Marinara Engine restarts. The reply still has to pass the same validation, and any content repair keeps that compatible request format. Authentication, rate-limit, server and network failures do not trigger this compatibility retry.

| What you do                                                 | Text model                                                                                                                                                                        | Images                                                                                                                     | Music                                 | Voices                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **Surprise me** in setup                                    | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| **Forge our story**                                         | 1 call for the world, 1 per love interest's bible, then 1 in the background for their personality quiz answers                                                                    | —                                                                                                                          | —                                     | —                                                          |
| **Add intimacy preferences** (NSFW, an older bible)         | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| **Begin** (the prologue)                                    | 1 call, once                                                                                                                                                                      | —                                                                                                                          | —                                     | —                                                          |
| **Paint the cast**                                          | —                                                                                                                                                                                 | 1 per love interest and 1 for you                                                                                          | —                                     | —                                                          |
| Faces (**Expressions** on)                                  | —                                                                                                                                                                                 | about 5 per look, in the background                                                                                        | —                                     | —                                                          |
| **Repaint expressions**                                     | —                                                                                                                                                                                 | 5, on your confirmation, for the current look                                                                              | —                                     | —                                                          |
| Start a main chapter                                        | 1 call to plan it, 2 when no arc covers it yet (the story's first chapter): the arc is planned first                                                                              | —                                                                                                                          | —                                     | —                                                          |
| An arc's end: **Take a breath** or **Go on with the story** | 1 call to plan the next arc                                                                                                                                                       | —                                                                                                                          | —                                     | —                                                          |
| An arc's end: **Meet someone new**                          | 2 calls: their bible, then the arc (trying again after a failed arc plan reuses the bible)                                                                                        | —                                                                                                                          | —                                     | —                                                          |
| The personality quiz                                        | in the background: 1 call for answers still missing, when you open the story (an older story, someone new, Heat raised), and 1 for 50 new statements once you've answered every one | —                                                                                                                          | —                                     | —                                                          |
| Read a scene                                                | 1 call per scene (the next one is written ahead)                                                                                                                                  | 1 per new place and per key moment (with **Ask before painting**, on your tap)                                             | —                                     | each voiced line, once                                     |
| A confrontation or a Closer                                 | 1 call for all three rounds                                                                                                                                                       | —                                                                                                                          | —                                     | each voiced line, once                                     |
| **Rewrite**                                                 | 1 call, plus 1 to write the next scene again when it was already written ahead                                                                                                    | this scene's key moment and the next scene's, painted again when they have one (with **Ask before painting**, on your tap) | —                                     | as any scene                                               |
| **Ease off**                                                | none, plus 1 to write the next scene again when it was already written ahead                                                                                                      | the next scene's key moment, painted again when it has one (with **Ask before painting**, on your tap)                     | —                                     | —                                                          |
| **Their side** (in Routes)                                  | none to open it, then 1 call for its scene                                                                                                                                        | only its place, when that has no picture yet (with **Ask before painting**, on your tap)                                   | —                                     | as any scene                                               |
| A route or repair chapter                                   | 1 call to plan, then 1 per scene                                                                                                                                                  | as any scene                                                                                                               | —                                     | as any scene                                               |
| Story memory                                                | background summaries of finished chapters (and of each side you read)                                                                                                             | —                                                                                                                          | —                                     | —                                                          |
| **Generate music** on                                       | 1 call per mood, for its brief                                                                                                                                                    | —                                                                                                                          | 1 track per mood (up to 6), made once | —                                                          |
| **Chapter themes** on                                       | 1 call per chapter, for its thematic brief                                                                                                                                        | —                                                                                                                          | 1 track per chapter, reused on replay | —                                                          |
| Home's message of the day                                   | 1 call per love interest you see, per day (again when a rift opens or closes)                                                                                                     | —                                                                                                                          | —                                     | **Play**: once                                             |
| Home's lines written ahead                                  | in the background: 1 call per love interest per stage (the first adds comfort and Claw Machine lines), once more after 0.14.0 or new NSFW settings, and 10 min after a failed try | —                                                                                                                          | —                                     | each tap line once; comfort lines every time, never cached |
| A love interest's plush                                     | in the background: 1 call per love interest, once (again 10+ minutes after a failure)                                                                                             | —                                                                                                                          | —                                     | —                                                          |
| **Celebrate** a birthday                                    | none; its scene: 1 call as you read it                                                                                                                                            | as any scene                                                                                                               | —                                     | as any scene                                               |
| A love interest's figurine                                  | —                                                                                                                                                                                 | 1, once, in the background right after you buy it (with **Ask before painting** or prompt review, on your tap)             | —                                     | —                                                          |
| **I'm upset with them** (Routes)                            | 1 call, in the background, for their answer in Messages; taking it back costs nothing                                                                                             | —                                                                                                                          | —                                     | —                                                          |
| A Messages reply                                            | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | —                                                          |
| A message they write first (**Messages a day**)             | in the background: 1 call each, at most the number you set per day                                                                                                                | —                                                                                                                          | —                                     | —                                                          |
| A reply in **Everyone**                                     | 1 call, for everyone's answer, and 1 more when it leaves out someone you named                                                                                                    | —                                                                                                                          | —                                     | —                                                          |
| A squabble in **Everyone** (**Squabbles each day**)         | in the background: 1 call each, at most the number you set per day; it reads the story as a message reply does                                                                    | —                                                                                                                          | —                                     | —                                                          |
| Stickers (images on)                                        | in the background: 1 call per love interest at level 2, for their nine                                                                                                            | yours: 5, once you open Messages; theirs: 1 per affection level from 2 to 10, one at a time (Ask before painting waits)    | —                                     | —                                                          |
| **Close and remember**                                      | 1 call (in Everyone too)                                                                                                                                                          | —                                                                                                                          | —                                     | —                                                          |
| Open Wish in a new fortnight                                | 1 call per banner (3)                                                                                                                                                             | up to 3, for banner art                                                                                                    | —                                     | —                                                          |
| First open of a Memory                                      | 1 call to plan it, then 1 per scene as you read                                                                                                                                   | 1, unless it was the banner art                                                                                            | —                                     | its voiced line, once                                      |
| First open of a Moment                                      | 1 call for its scene                                                                                                                                                              | 1, once; held for your tap under Ask before painting or prompt review                                                      | —                                     | as any scene                                               |
| First open of a Snapshot                                    | —                                                                                                                                                                                 | 1, once; held for your tap under Ask before painting or prompt review                                                      | —                                     | —                                                          |
| First open of a look                                        | 1 call for its first-wear scene, for a featured 5★ look only, theirs or yours                                                                                                     | 1, unless it was the banner art                                                                                            | —                                     | as any scene                                               |
| **Wear at home**                                            | your new look: 1 call, as they notice it                                                                                                                                          | their look: its faces, about 5                                                                                             | —                                     | —                                                          |
| **Show them**                                               | 1 call each time                                                                                                                                                                  | —                                                                                                                          | —                                     | its line, every time, never cached                         |
| A couple set's portrait                                     | —                                                                                                                                                                                 | 1, on your tap                                                                                                             | —                                     | —                                                          |
| Read Them                                                   | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | each voiced line, once                                     |
| Read Me                                                     | 1 call                                                                                                                                                                            | —                                                                                                                          | —                                     | each voiced line, once                                     |
| Tarot night                                                 | 1 call                                                                                                                                                                            | 1 for each card drawn for the first time, at most 3 (with **Ask before painting** or prompt review, on your tap)           | —                                     | each voiced line, once                                     |
| Date Night                                                  | 4 calls                                                                                                                                                                           | new places and missing faces as in any scene, and 1 for a keepsake if you ask                                              | —                                     | as any scene                                               |
| **Photo Shoot**                                             | —                                                                                                                                                                                 | 1, on your tap                                                                                                             | —                                     | —                                                          |
| **Caring message**                                          | 1 call, or none with **Keep it off the model** or a debug condition on                                                                                                            | —                                                                                                                          | —                                     | **Play**: every time, never cached                         |

These never call a model or paint anything. With voices on, their lines are voiced: Claw Machine lines once each, comfort lines every time.

- a wish, single or ten;
- a Claw Machine round;
- a touch on Home and **Rough day?** (they speak lines already written);
- Remind Me and the period tracker;
- **Keep it off the model**;
- sending **Your thoughts…** (they go with the next main chapter's plan and its scenes, in the calls those make anyway);
- answering a closing decision with **Write your own…** (your words go with later story calls that are made anyway);
- accepting or declining an invitation to clear the air, and taking back **I'm upset with them**;
- browsing the Album, Echoes and the Wardrobe;
- **What happened so far…** while an arc is planned, your answers in the personality quiz (its own calls are in the table above), and **Who said what?** while a scene is written;
- **Read** on a love interest's side in Routes (its scene costs 1 call as you read it, as any scene does);
- claiming with a Memory Selector (opening the Memory afterwards costs what any first open does);
- buying a gift in the Shop (a figurine's picture costs the 1 image in the table above, and its scene 1 call as you read it, as any scene does);
- cut-outs (a love interest without the backdrop), which are the Engine's own sprite cleanup.

## Privacy & data

### Where your stories live

- **Package documents:** stories are kept in Marinara Engine's own database, on the computer that runs it, as documents whose ids start with `otome-forge:`. This covers the world, the cast and their bibles, chapters and scenes, progress, messages of the day, message threads (the group chat's too), lines written ahead, banners, the items you win, the plush shelf, your latest Claw Machine rounds and each love interest's plush, the gifts and figurines you bought in the Shop, your Read Me games, your Tarot night readings and the story's Tarot deck, your personality quiz answers and each love interest's, each love interest's notebook of what they know about you, your own words included, and **Your thoughts…** (waiting in the story's progress until the next main chapter is planned, then kept with that chapter).
  - They travel with Engine backups and profile exports.
  - Package documents aren't isolated per package, so other installed packages could read them.
- **The Global Gallery:** painted looks, places, faces, CGs, banner art, figurines, Tarot cards and Home cut-outs are saved there, and deleting a story deletes them too.
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
- **Everyone:** the group chat's prompt carries the story everyone in it may know, the group's own closed conversations and its newest messages, each member's character card and how things stand between you as the whole cast may know it, and the ties between them without their secrets. It never carries a private thread, a date, Read Me notebooks, a love interest's own chapter in full, or a grievance or something you told them from one.
- **Your thoughts…:** what you send goes to the model provider with the next main chapter's plan and with each of that chapter's scenes, a Rewrite of one included, and with no other prompt.
- **Write your own…:** your words become part of that chapter, like any choice you make. They go to the model provider with the later story prompts that include that chapter: in full while it is the previous chapter, then in its summary.
- **Persona grounding:** prompts that describe your protagonist include their whole **Description, Personality, Backstory and authored Appearance**. This covers world/cast setup, chapter and scene writing, routes and repairs, dates, item stories and outfit reactions, phone replies (the group chat's too), Home notes and touch lines, Caring messages, Read Him, Read Me and Tarot night. Scenario, greetings and example dialogue are excluded; an image-only Appearance Override is not story appearance. The fields refresh when you open a story and before setup, main-chapter planning, scene writing, route/repair planning and date planning. Other prompts use the story's last saved copy.
- **Other providers:** image prompts go to your image connection. Every image of your persona uses their current **Appearance**, whole, or **Image Appearance Override** while you have it enabled; an outfit's clothing changes are added to it. An empty Appearance uses your avatar reference and the requested clothing without an invented body description or extra model call. An unavailable persona keeps its own saved look as a fallback. A linked love interest's likeness reference is their card's **Full Body → Neutral** sprite when available, then the current card avatar, then their retained Otome look. Your persona keeps their avatar reference. A figurine sends the same likeness reference as their looks, and a Tarot card sends each person in it as a date's keepsake does. Scenes add the outfits people wear after their identity references, within the Engine's four-image limit. Music briefs go to your audio connection, and voiced lines to your voice provider.
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
