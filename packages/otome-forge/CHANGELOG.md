# Otome Hearth release notes

## 0.8.10 — 2026-11-06 [highlight]

- **Scenes are written as they were before 0.8.9**: each one when you reach it, and the next one ahead while you read. 0.8.9 wrote the rest of the chapter ahead, so later scenes missed the small choices you made along the way. The fixes for pictures that hung and for the Story connection stay.

## 0.8.9 — 2026-11-05 [highlight]

- **A chapter's art is painted ahead.** Opening a chapter, a date or a story now writes its scenes ahead in the background and paints each one's places and key image as soon as it is written, so the art is waiting when you get there. Writing ahead stops at a big choice or a Confrontation, because what comes next depends on what you pick, and goes on once you have picked. Ease off and Rewrite still let go of the scenes they replace.
- **No more endless "Painting this moment…".** A picture the image service never finishes now stops after 10 minutes and shows Retry, and the pictures waiting behind it carry on.
- **Dates, banners and Character Stories are written with your Story connection**, like the chapters: Date Night, Read Them, Read Me, the banners' scenes and Memories, Character Stories and the extra stories that unlock past level 10.

## 0.8.8 — 2026-11-05

- **Enter no longer sends a message.** In Messages, Enter starts a new line, on a phone and on a computer alike, and only **Send** sends what you wrote.

## 0.8.7 — 2026-11-05

- **The story knows what you're wearing**, like it does for love interests: the look you put on with Wear at home or picked for a date.
- **Chapters keep the world you chose.** The planner reads your premise for its genre, era and technology whenever it plans an arc or a chapter, instead of drifting to a period look you never picked. A new story's world keeps them from the start.
- **Your 5★ look gets a first-wear scene** with the love interest of its couple set, like theirs does. A 5★ look you already own gets it the next time you open it, at no cost.
- **Story memory no longer fails while condensing** a long story on thinking models such as Claude Opus 5.5, and **Retry the summary** runs at once: the banner goes, and comes back only if it fails again.
- **Couple set looks line up** at the top, and the premise box shows a new example.

## 0.8.6 — 2026-11-04

- **Each affection level takes a little more than the last.** Level 2 now takes 200 affection, and each level after it 50 more, up to 600 for level 10, so the first levels come sooner and the last ones mean more. Past level 10, every 300 affection still earns a prestige point. A love interest's level is worked out from their affection, so a story already under way may show a different level after updating; anything you've already unlocked stays.

## 0.8.5 — 2026-11-04

- **A love interest who appears in another's Character Story remembers it.** When another love interest speaks in a Character Story, that story is now theirs to remember too, and its summary says who was there and for which parts, so they know what they saw and not what they missed. A name that is only mentioned doesn't count. Character Stories you have already finished get this too. Dates stay private to their love interest.
- **Character Stories may have cameos.** Another love interest can now appear in a Character Story when the story calls for it.

## 0.8.4 — 2026-11-04

- **The cast keeps your earlier chapters in mind.** Story prompts now always keep the summaries of earlier chapters, with the last chapter in full, and send a chapter in full only while it has no summary yet. Before, while any summary was still being written or had failed, the summaries were left out and only the most recent chapters went in full.
- **Memory no longer waits on a model's context size.** Summaries are written with any connection, even one that reports no context size. If its model is too small for a summary, you see its error and can switch to a connection with a larger context.
- **A failed summary shows on every screen.** When a summary fails, every screen of the open story says so at the top, with what the connection answered, Retry the summary and Change connection. Before, it showed only in Settings.

## 0.8.3 — 2026-11-03

- **A new 5★ look's scene shows the new look.** The short scene that comes with a love interest's 5★ look now shows them on stage in that look, not in what they wear on Home, and keeps it when you replay the scene after they change. If you open the scene while the look is still painting, they change into it as soon as it is ready. Its expressions show once that look has them. Reading the scene paints none: a look's expressions are still painted when they first wear it.
- **Fewer meals forced on you.** The story planners no longer tell the cast that you eat; they remember you're human, resting, sleeping, washing and seeing to a day's small needs in passing.

## 0.8.2 — 2026-11-03

- **Key images are ready when you reach them again.** The next scene's key image now starts painting as soon as that scene is written ahead, as it did before 0.6.27, so it is usually waiting when its moment comes. If you use Ease off or Rewrite on the scene you are reading, the scene written ahead is written again and its key image painted again (1 image); the buttons say so.
- **Showing off a look earns 5 affection**, down from 20, the first time you show it to a love interest.
- **Fewer extra limbs in pictures of two or more people.** Key images, Memory art, pair portraits and date keepsakes now send one picture of each person, say whose each one is and how many people to draw. A date keepsake now has a picture of you too. Photo Shoot poses say where every hand and leg goes.
- **Pick the image prompt style.** Settings → Images and setup now let you choose which Engine image style profile your pictures follow. Pick one that writes sentences for GPT Image.

## 0.8.1 — 2026-11-03

- **Love interests keep their own side stories while memory catches up.** When the story memory is still summarizing, a scene now keeps the dates and private chapters played since the last main chapter for the love interests who were there, newest first, within the usual length limit. Before, only the newest of them could make it in.
- **No hour-long cache paid for nothing.** When chapter plans run on a different connection from the scenes, the plan no longer asks for a cache the scenes could never read.

## 0.8.0 — 2026-11-03

- **A Photo Shoot in Dates.** With a love interest picked in Dates, choose a place your story has painted, what you both wear, and an expression and a pose for each of you: shared poses like kissing, hugging, play-fighting or a piggyback, solo poses, or your own words. **Take picture** paints one photo of you two posing for the camera, sent the place and both outfits as references, with no model call. It follows your image connection, Ask before painting, prompt review and image rating, costs no Starlight and pays nothing. Photos are kept in the Album's new **Photos**, to view, save or delete, and the newest is taped into that love interest's note on Home. Without an image connection it shows as unavailable.

## 0.7.6 — 2026-11-03

- **Prompt caching that keeps working through a chapter.** On an Anthropic connection, a chapter's plan, scenes and Confrontation or Closer ask for the hour-long cache, so a scene read minutes after the last still reads the story context from the cache. The cached part now holds only what every scene of the chapter may know, so it stays the same when the love interests in a scene change. What only some of them may know (their own chapters, dates and small memories) comes after it, for the people in each scene. The chapter's last scene shares the other scenes' cached instructions too. Older Engines keep the connection's own cache time.
- **The last chapter's summary is no longer repeated.** The story sends the previous main chapter in full and leaves its summary out of the timeline. Condensing a long timeline now keeps that chapter's summary apart, so it stays out.

## 0.7.5 — 2026-11-03

- **A slower burn.** Love interests no longer confess in stages 3 and 4. In stage 5 they may, once the story has earned it, and in stage 6 they say it if they haven't yet.

## 0.7.4 — 2026-11-03

- **Stickers send on iPhone again.** Tapping a sticker in Messages sends it as a message. Before, the tap closed the sticker panel and nothing was sent.

## 0.7.3 — 2026-11-03

- **Love interests remember their Character Stories.** A Memory's Character Story, a Moment, and the scene the first time they wear a new look now join the story's timeline, marked private, as route chapters do. Its love interest always knows what happened there, and the others act only on what they could see. Before, it was one of the small memories that newer ones often pushed out. Stories in progress rebuild their timeline once, from the summaries they already have.

## 0.7.2 — 2026-11-03

- **Long lines keep up on iPhone.** A line too long for the dialogue box now follows its typing smoothly and ends on its last row. Before, the box shook as it tried to scroll and fell back short of the end. Once a line is whole, typed out or shown with Next, you can scroll it.
- **A fuller condensed timeline.** Once the story's timeline passes 14,000 tokens, its older part is condensed to about 5,000 words, half that size, instead of at most 3,000.
- **Love interests who message you each day.** The Settings number now counts love interests, not messages. Each one who writes first does so once that day, in one or a few messages. Their messages spread over the day even when the number is higher than the love interests you've met.

## 0.7.1 — 2026-11-03

- **Closing a conversation** now shows only that they remember it and the line they keep. It earns +5 affection.
- **Your connection's settings decide.** Otome Hearth now sends only the reply's length, never its own temperature or JSON mode, so your connection's temperature, reasoning effort and other settings are what's used.
- **Longer chapter summaries**, up to 1,000 words.
- **More room before condensing.** The story's timeline can reach 14,000 tokens and recent memories 6,000 before anything is condensed or left out, 20,000 together at most.
- **Fixes.** The daily note, Read Him and Read Me draw on recent memories again. Messages no longer repeat their newest conversations as memories. A small memory model condenses the timeline in steps instead of failing, and a model with an unknown context asks for it again.

## 0.7.0 — 2026-11-02

- **A story memory that stays small.** Each chapter is summarized once, in up to 500 words with its key lines and every choice you made, and joins the story's timeline at no extra cost. Only once the timeline passes about 10,000 tokens is its older part condensed. Stories in progress switch over from their saved summaries without new summary calls.
- **Recent small memories.** Messages, Snapshots, Read Me, Read Him, claw machine rounds, dates and Character Stories come back, newest first, to the love interest they belong to.
- **Cheaper chapters.** A chapter's plan and scenes share one cached story context, so providers that cache, like Claude, charge less after the first call.
- **No suggested replies** in Messages: you write your own.
- **Stickers without white outlines.**
- **A warning** when a story connection has under 32k tokens of context.

## 0.6.28 — 2026-11-02

- **Newest CGs first.** The Album's CGs now open on the newest, with the oldest at the bottom; the full-screen viewer steps through them in the same order.
- **Chapter themes in the Soundtrack.** A chapter's own theme now appears in the Album's Soundtrack after the six moods, under the chapter's title, once you've reached that chapter, and plays like the others.

## 0.6.27 — 2026-11-02

- **Fewer wasted calls.** Picking how the story goes on twice no longer plans the arc twice. A newcomer whose arc failed to plan keeps their character sheet for the next try. A scene written ahead paints its key moment only once you reach it. A connection that refuses JSON mode is asked without it from then on.
- **Daily messages wait for chapter 1.** Love interests you haven't met yet no longer text you after the prologue.
- **Stickers stay put.** While their backgrounds are cut out again, your stickers keep showing and never read as newly unlocked.
- **Fixes.** Every Album tab can be reached with a mouse. A story delete that stops partway can be finished. Close says to wait for the reply while one is on its way. Cost notes count 2 calls where 2 are made.

## 0.6.26 — 2026-11-02

- **Every prompt in one place.** All of Otome Hearth's prompts now live in one file, `prompts.ts`, in story order with a table of contents, so they can be read and rewritten in one place. Nothing the models receive changed.

## 0.6.25 — 2026-11-02

- **Updated writing rules.** A love interest now wants something of their own in every chapter, not every scene, and the rules about what your protagonist knows and an existing world's canon are shorter.

## 0.6.24 — 2026-11-02

- **Long lines show in full on iPhone.** On iPhone, a line longer than the dialogue box could come back cut off mid-word, with only its final period showing, although the Log had all of it. Every row now shows as it types, and a click on a line that is still typing still shows it whole.

## 0.6.23 — 2026-11-02

- **Chibi stickers.** With images on, your five phone stickers are chibi busts of your protagonist, and each love interest gets nine of their own, one unlocked per affection level from 2 to 10 ("You unlocked a new sticker"). They're painted in the background, one at a time, and Ask before painting holds them for a tap; stories in progress catch up. Without images your five are simple labelled icons.
- **Love interests send stickers too**, theirs or yours, by name in brackets, like `[dottore_pensive]`. Old face stickers still show.
- **A Stickers tab in the Album** to view and save each sticker, named like `mari_laugh`.
- **Messages a day from love interests**: in Settings → Connections, choose how many times a day one you've met may message you first (0 to 24, off by default). They're spread across your day and arrive unread.
- **A love interest's thread header fits on one row on phones**, with **Close** beside their name.

## 0.6.22 — 2026-11-02

- **Love interests may be genuinely evil.** A villain or a monster stays one, and taming them is the point; as affection grows they may become a better partner to you, in their own way. Scenes, climaxes and phone replies now see their darkness.
- **Angst and Dark say it plainly.** Under Angst, cruelty isn't sanitized within your Lines and Veils, and a love interest may be a villain to everyone but you. Under Dark romance, they can be the villain. Gentle is unchanged.
- **Real villains are back**, and a moral code fits who they are: firm, far looser, or none at all. This applies to love interests written from now on.
- **Side with one of them.** From chapter 4, at most once every four main chapters, when love interests disagree you choose whom to back: +30 affection for them, −10 for each one you pass over, never below a level they've reached.

## 0.6.21 — 2026-11-02

- **A chapter may close on a judgment you can get wrong.** When an arc holds a mystery, a traitor or a disputed account, the end of a chapter can now ask you to judge it: who did it, who betrayed you, whom to believe. The true answer is always among the options, nothing hints which it is, and whatever you pick is what happens; a wrong guess plays out in the chapters after it. Arcs without such a question never get one.

## 0.6.20 — 2026-11-02

- **A line under new scene art types out after the art appears.** When a scene's art arrives, the line in the dialogue box now waits until the picture has loaded and its reveal has finished, then types from the start, so you no longer find it already complete and scrolled to the end on phones.

## 0.6.19 — 2026-11-02

- **"What happened so far…" reads as a recollection of your story.** It now tells what has happened so far in story order, with the choices you made woven in, instead of notes about your persona, a summary per chapter and bold labels. Stories already in progress rewrite it in the background the next time Otome Hearth writes; nothing you played is changed.

## 0.6.18 — 2026-11-02

- **"What happened so far…" while a chapter is planned.** Planning a new chapter (and a route, repair or extra story chapter) now shows the story's running summary to read while you wait. It scrolls on its own and appears once the first summary is ready.
- **Who said what? while a scene is written.** Tap **Play Who said what?** under "Writing the next scene…" to guess which love interest said a line from the chapters you've read. It's optional, makes no model calls, saves nothing, and steps aside the moment the scene is ready.
- **Keyboard focus on quotes.** The quoted line in the Wardrobe and in Who said what? now shows where keyboard focus is.

## 0.6.17 — 2026-11-02

- **Love interests remember the whole story.** Route, repair, date and Character Story chapters are now summarized too and included in the story's running summary, so long routes keep their early chapters. Their details still come back only in his chats and the scenes he is in.
- **The last chapter is sent in full** when your model can hold it, with only the choices you made.
- **Small memories come back when a scene touches them:** Read Me (your notebook as it is now, so deleted stays deleted), Read Him, dates, banner stories, phone talks, Snapshots and Claw rounds.
- **Too long for your model?** The least relevant memories go first; if it still can't fit, you're asked for a bigger connection, not given a cut-off reply.
- **Smaller summary models work:** a summary model with a 16k window no longer stops with an error. Memory status and Retry are in Settings → Connections.
- Stories in progress catch up in the background; nothing you played is rewritten.

## 0.6.16 — 2026-11-01

- **Otome Hearth follows "Reduce Ambient Animations & Effects".** Marinara Engine's setting now does in Otome Hearth what your device's reduce-motion setting already did: stars, drift, parallax, the typing text and the Wish and CG pans stop, and the frosted glass panels turn solid, as the Engine's own panels do. The claw machine keeps its normal motion, because it is a game rather than decoration; your device's reduce-motion setting still calms it.
- **A finished setup leaves no old draft behind.** If you made your world within a moment of your last change in the wizard, the draft could be saved again afterwards, so the next setup opened with the old answers.

## 0.6.15 — 2026-11-01 [highlight]

- **Prestige: your bond keeps growing past level 10.** Once a love interest reaches the top affection level, every 300 more affection earns a prestige point, shown as three stars under "Between you" on the Story screen. Every three points unlock an **extra story** with him, and the stars start over, as often as you like.
- **Extra stories are something the two of you imagine for fun**, written like a Character Story: a what-if (a wedding, starting a family, a honeymoon), a mini AU (vampires, a modern-day life), or, in an NSFW story, something new to explore together. Each one is different from the last.
- **They never change the main story.** Choices inside an extra story don't move his trust or open grievances, and later chapters never remember an AU as if it happened. A choice that costs affection can never take an unlocked story back.

## 0.6.14 — 2026-11-01

- **Confrontation and Closer choices speak to you.** Their option buttons sometimes talked about you in the third person ("Say what she pays") instead of speaking to you ("Say what you pay"), unlike every other choice in the story. The writer is now asked to word them as something you do, and to tell an action you pick as "you", like the rest of the scene. Confrontations and Closers written before this update keep their old wording.

## 0.6.13 — 2026-11-01

- **A love interest's sprite leaves the stage when he does.** When he walked out of a scene, or you left him behind, his sprite used to stay on screen until the end of the beat, as if he were still there. The writer now marks who leaves on that line, and the stage clears from there; he comes back the moment he speaks again, and anyone still in the scene stays. Scenes written before this update keep their old staging.

## 0.6.12 — 2026-11-01

- **Every Settings category stays reachable with a mouse.** On a desktop window just under the wide layout, or with wider system fonts, the category bar could cut off its last tab with no scrollbar to reach it. With a mouse the categories now wrap onto a second row instead; phones keep their single swipeable strip.
- **CGs show whole on a PC.** A CG is painted tall, and on a wide screen (fullscreen on a PC) it was zoomed to fill the width, cropping away its top and bottom and often the faces. On a wide stage the CG now shows in full, framed by a soft blurred copy of itself; phones still fill the screen with it.

## 0.6.11 — 2026-10-31

- **His portrait is painted from his card's full-body image and his avatar together**, instead of one standing in for the other. A love interest drawn from a character card now keeps both his build and his face, which the reference could only carry one of before. Scenes still send one likeness per person, so a large cast is not crowded out of the reference budget.

## 0.6.10 — 2026-10-31

- **Each love interest has his own colour again** on his name plate and in the glow behind his art. It is picked from a vivid detail of his portrait (an earring, his eyes) rather than averaged from the picture, so no two love interests in a cast share one, and the backdrop a look is painted on never becomes it.
- Stories already in progress re-pick their colours when opened: an accent chosen by the old picker is treated as unset.

## 0.6.9 — 2026-10-31

- The chapter list groups chapters under their arc, and a chapter's reader says which arc it belongs to ("Arc 2 · Chapter 4").
- A breathing-room arc says so: "Take a breath" arcs show a quiet-stretch badge, so a plot-free stretch is never mistaken for the story stalling.

## 0.6.8 — 2026-10-31

- **The end of an arc is a choice:** when one closes, pick **Take a breath** (a few quiet chapters with the people you love), **Go on with the story** (a new arc with a new threat), or **Meet someone new**. The next arc is planned from your answer.
- **Meet someone new:** bring in one of your character cards, or someone invented for this story. They meet you and the others on the page, and the story writes how each of the cast takes them. The cast holds five love interests at most.

## 0.6.7 — 2026-10-31

- **Story arcs:** each stretch of main chapters now follows a plan made before it starts: a goal, a big event near the end, and where the mystery's answers come out. The Story screen shows the arc's name and how far you are ("Arc The drowned bell · chapter 4 of 10"). Before this, no plan looked past the next chapter and the mystery's answer was never allowed to be said.

## 0.6.6 — 2026-10-31

- **Banned phrases** when you start a new story: type them right under **How it's written**, so the world and every love interest's Bible avoid them from the start. Still in Settings → Content.
- Read Him and Read Me guess instead of repeating: one specific guess past what your persona states, across wants, thoughts, likes, dislikes, habits, fears and memories. He never guesses what he already knows.
- **Group scenes:** two or more love interests at stage 3 and up may share one intimacy when the scene fits. Heat decides how far, each keeps their own tastes, and scenes are no longer capped to a couple of love interests.
- Narration says what the protagonist feels in her body, not only the action.

## 0.6.5 — 2026-10-31

- Seasonal banners: the first fortnight that starts in each month brings three banners on that month's theme, with a badge such as “October · Halloween”: New Year in January, Valentine's Day in February, through Halloween in October, autumn in November and Christmas in December. A world without the holiday gets its own version of it. Later fortnights that month are your model's free choice, as before.

## 0.6.4 — 2026-10-31

- **Your cast** and **Your stories** moved from **Who's home** to **Settings → Stories**, each with a line on what it's for. **Who's home** now only picks who's home.

## 0.6.3 — 2026-10-31

- Date Night offers your Wardrobe looks: pick any painted look either of you owns, 4★ and 5★ alike. The date's scenes, key images and keepsake dress you both in them, and they stay on afterwards.
- The story now knows how each love interest looks: their Image appearance and the look they wear. Fixing their Image appearance changes how the story describes them from the next scene on, not only their pictures.
- On a phone, the date's keepsake card no longer squeezes its title and **Paint the keepsake** button into columns.

## 0.6.2 — 2026-10-31

- After a love interest's finale, the story no longer assumes they already confessed: if you eased off before the words came, they can still say it later.

## 0.6.1 — 2026-10-30

- **Banned phrases** in Settings → Content: type the words and phrases you never want to read, separated by commas or one per line, and every scene, message and note avoids them.
- Love interests no longer stop an intimate scene to check in or offer to stop, sex included. Ease off is still yours.
- Your protagonist takes a moment to sit with what matters to them, a first kiss, a night together, a quarrel, a secret learned, in thoughts in their own voice, with their doubts and hopes showing, before the story moves on.
- **Slow burn:** through a love interest's first two stages, neither of you says what you feel. From the third stage they may confess once the story has earned it, and by their route's finale at the latest. Desire can still come first, as your Heat allows.
- Under NSFW: Explicit, sex scenes are no longer rushed: they take the room they need, from the build-up to the aftermath, with the characters talking, asking for what they want and saying what they feel along the way.

## 0.6.0 — 2026-10-30

- Each love interest has their own Claw Machine plush: the animal that fits them best, in their colours (a cyan raven with red eyes, a black cat with violet eyes). Your Planning model draws it once, in the background, the first time you open Dates. Until then their plush wears their look, as before.

## 0.5.3 — 2026-10-30

- Your protagonist knows only what the story has shown them: love interests no longer talk as if you already know their past, their habits or the words of their world, and a newcomer learns this world as they go.
- A story set in an existing world, such as Teyvat from Genshin Impact, stays that world and keeps its canon.
- Chapters make room for other people, scenes without a love interest, and rest or sleep after a long day.

## 0.5.2 — 2026-10-30

- Memories banners follow your Heat: under NSFW: Fade their Memories and Moments mix SFW and suggestive situations, and under NSFW: Explicit explicit ones too. Snapshots stay SFW.
- An explicit Memory's art can now be explicit under NSFW: Explicit with the Explicit image rating. Lower either setting before it's painted, and it shows the same moment clothed. Other Memory art stays clothed, as before.

## 0.5.1 — 2026-10-30

- Chapters no longer all end the same way. Each one builds differently, and its closing choice is a different kind of decision from the last few, not a love interest stepping in again to ask whom you'll go with. A rival love interest competes over more than just you, too.

## 0.5.0 — 2026-10-30

- **Read Me**, a new game in Dates: a love interest studies you and makes four guesses about you. Answer Spot on, Close or Not at all, and tell them the truth in your own words if you like.
- They remember: each answer goes into their notebook of what they know about you (likes, dislikes, habits, fears, dreams), and they bring it up in scenes, Home notes, messages and dates. No other love interest ever sees it.
- Open the notebook from Read Me to read it, rewrite your words or delete an entry. A delete is final.

## 0.4.2 — 2026-10-30

- The Love Timeline shows every 4★ Moment and 5★ Memory you've won, on the day you won it, including ones won before this update. Each Snapshot, Moment and Memory says what it is and opens in the Album.

## 0.4.1 — 2026-10-30

- The story's **Image description** shows only for a picture that isn't on screen: a painted background or key image no longer has its description under the chapter title, and one whose file fails to load gets it back.
- NSFW stories now say outright that crude and vulgar words, swearing and dirty talk included, are fine wherever they fit a character's voice. In SFW stories characters may swear too, without the sexual words.
- A 5★ reveal with a long premise fits on a phone: the card never grows past the screen, so the title shows whole and the premise scrolls inside it.

## 0.4.0 — 2026-10-30

- **The Closer:** a main chapter can now end on a warm climax instead of a Confrontation. Over three rounds the love interest offers something of themselves, and you answer: **Reassure**, **Tease**, **Mirror** (share something of your own) or **Ask**.
- It ends **Opened up** (trust grows, and it's a first on your Love Timeline), **Almost** (nothing changes) or **Shut out** if it goes wrong (trust falls, and they hold it against you).
- In NSFW stories, Opened up can turn intimate, drawing on their tastes and your role.
- After two main chapters end the same way, the next ends with the other, so a story in progress gets its first Closer soon. Route chapters keep their Confrontations.

## 0.3.0 — 2026-10-30

- NSFW stories give each new love interest's bible their tastes in sex and intimacy: what they're into, kinks included, and what draws them. Intimate scenes bring them in when they fit; your content settings still decide what a scene may hold.
- An older cast gets **Add intimacy preferences** on Your cast (1 call). Read and edit them in the bible.
- An optional Sub, Dom or Switch preference for your protagonist sits beside Heat.
- SFW stories never write or send any of it.
- Story memory keeps an NSFW story as it was written: summaries no longer turn it SFW, and a Veil is remembered as having happened off the page.
- The planners no longer call every love interest a monster: each is a human, even if inside a monster.
- A date inside a chapter can go as hoped: it stumbles only when the story gives it a reason, like Date Night.

## 0.2.2 — 2026-10-30

- In stories, hide the header's Image description panel while a character sprite is shown; keep the description available without a sprite.
- Four-star memories include artwork through the existing painting flow alongside their playable memory.
- Round every corner of story character nameplates.

## 0.2.1 — 2026-10-30

- Make desktop fullscreen fill the available Otome Hearth area across its screens. Leaving fullscreen restores ordinary portrait layouts while preserving drafts and the current reader line.

## 0.2.0 — 2026-10-30

- Restore the scrolling mobile Settings category strip, and keep each cast member's repaint actions together.
- Show progress toward the next Affection level in Between you.
- Facial expression edits use an adult, nonsexual face-edit policy while preserving the current look, clothing and style. Non-explicit Suggestive images keep concise content exclusions without unrelated graphic boilerplate.
- Edit a love interest’s image appearance above their spoiler Bible without repainting or changing their story.
- Choose an existing Assets Music folder in Audio settings when music generation is off.
- Give chapters and scenes room for ordinary moments, earned emotional payoffs, and character change.

## 0.1.17 — 2026-10-30

- Read a love interest’s intended appearance from Your cast or Who’s home without opening Bible spoilers. Wardrobe looks and reached story illustrations also expose their existing visual descriptions, including when no image was painted.
- After adding an image connection, missing story locations and key moments offer the existing explicit Paint action with its image cost and prompt review. Reading descriptions and saving image settings paint nothing.

## 0.1.16 — 2026-10-30

- Automatically painted current-location backgrounds prepare before reading begins, with the existing manual-paint and failure paths retained.
- Story generation can reuse saved location artwork for recurring settings instead of painting a new numbered visit.
- Protagonist dialogue, thoughts and performed choices explicitly follow the selected persona’s authored identity and the player’s writing instructions.

## 0.1.15 — 2026-10-29

- Opening narration no longer previews the portrait of a love interest whose speaking turn has not been reached. Established speakers can still stay visible during later narration.

- The pre-chapter warning places its Ease off feather after the guidance sentence.

- Harmful story/date choices and Confrontation outcomes can reduce Affection progress within the current level. Unlocked levels stay permanent, and replaying never repeats the deduction or refunds daily earning limits.

## 0.1.14 — 2026-10-29

- Album Memories can be filtered by 3★, 4★ or 5★, with unplayed content listed first.

- Owned 3★ Snapshots can be illustrated on first opening through the existing image connection, confirmation and prompt review flow. Paintings are saved and reused; old vignettes and story progress stay intact.

## 0.1.13 — 2026-10-29

- Suggestive is an image-content ceiling: neutral portraits and facial expression edits no longer receive mandatory suggestive or sensitive-content tags. Image briefs follow the actual moment, with non-explicit adult intimacy allowed when appropriate.
- Wish and Wardrobe display cleaned love-interest and persona outfits while retaining the original paintings. Wardrobe banner art is centered and shown whole, and tapping a ready banner image opens a full-image view without making a wish.

## 0.1.12 — 2026-10-29

- Desktop settings use the available stage space, with every settings section reachable and long pages scrollable.
- Text generation can recover when an endpoint rejects the optional JSON-format hint, while retaining reply validation and output budgets.

## 0.1.11 — 2026-10-29

- Named speakers outside your love-interest cast clear the previous character's sprite. An exact, unique matching character card can supply an existing Full Body sprite, with Neutral preferred; opaque art waits for free cleanup before appearing.

## 0.1.10 — 2026-10-29

- Repaint a love interest’s five expressions for their current look from Your cast, with a five-image cost and all prompts reviewed before painting when prompt review is enabled. Existing artwork stays available during replacement or after a failure.
- Expression generation preserves the configured image style for both prose and tag-based profiles. Reviewed prompts stay bound to the look they were written for, with their full text and required safety wording retained.

## 0.1.9 — 2026-10-29

- Chapter, scene, route and date writers now receive the selected persona’s full Description, Personality, Backstory and authored Appearance, including on existing runs. The same saved identity fields also ground item stories and outfit reactions, phone replies, Home notes and touch lines, Caring messages, and Read Him. Their authored facts stay distinct from image-only appearance overrides; roleplay scenarios, greetings and dialogue examples are excluded.

## 0.1.8 — 2026-10-29

- Music settings can give every chapter its own saved theme. Enable chapter themes with music generation on; each theme is generated when reading starts and reused on replay.

## 0.1.7 — 2026-10-29

- Chapter and Home expressions keep the clean neutral sprite visible until free background cleanup is ready, instead of showing a green original. Saved and newly painted expressions share the repair, with their originals, outfits and story progress retained.

## 0.1.6 — 2026-10-29

- Mobile reader controls now show mute, fullscreen, then More, with centered icons and the secondary controls aligned directly below More.
- A thought's closing parenthesis now appears when the line finishes typing.
- Removed the daily-storage caption beneath a generated period-day caring message.

## 0.1.5 — 2026-10-29

- The downloadable package now includes the merged reader resize repair: switching from a phone-sized reader to desktop no longer leaves a hidden mobile menu consuming the next story action.
- Linking a generated love interest to a card keeps their existing story bible, without showing the imported-card canon notice.

## 0.1.4 — 2026-10-29

- Link an existing love interest to a character card in Your cast. Its assigned voice and image references apply while their story, progress and pictures stay; unlinking restores their own fallback.
- Future paints prefer the linked card's Full Body → Neutral sprite, then its current avatar, then the retained Otome look. Linking never paints automatically.

## 0.1.3 — 2026-10-29

- Mobile chapter cutouts continue behind the dialogue panel for a closer view. A three-dot button opens the secondary reader controls vertically, beside working mute and fullscreen buttons.

## 0.1.2 — 2026-10-29 [highlight]

- Home cleans your own generated looks and outfits as well as the love interests'. Originals stay in the Wardrobe.
- On an Engine with corrected sprite cleanup, old cut-outs are rebuilt from the retained originals for free. The previous image stays visible until its replacement is ready.
- Card-imported love interests use their card's Full Body → Neutral sprite as the likeness reference when available, then their painted base look, then the card avatar.
- Every image of your persona reads their current Appearance, or the enabled Image Appearance Override, whole. Outfit changes keep that identity instead of reusing a stale generated description.
- Empty Appearance uses your avatar and the requested clothing, with no invented body description or extra model call.
- Otome Hearth's Home tab uses a heart icon.

## 0.1.1 — 2026-10-29

- **Begin** plays a prologue: one short scene of your protagonist's own life, just before the story opens, with no love interest in it. Chapter 1 picks up where it ends, and the Story screen offers it again.
- **Phone** is now **Messages**, so it fits any world, and love interests write by whatever carries messages there.
- **How it's written**, in setup and Settings → Content: your own instructions for every scene, message and note. Your persona's description reaches every story prompt whole.
- Love interests stand without a backdrop: painted on a chroma matte, then cut out, as the Engine's sprites are.
- The reader: fullscreen, a plain **Rewrite**, Ease off that fits, and long lines scroll as they type.

## 0.1.0 — 2026-10-28

- First Date: release 1 of Otome Hearth, an otome game made from your own characters, for Engine staging testers.
- Set up a story from a premise, your persona and two to five love interests of any gender, from your cards or six archetypes. Each gets a hidden bible, a route from Mask to Bond, and memories of only what they saw.
- Main chapters build to a confrontation. Your first choice is canon, and a rift lasts until you make it right.
- Home brings a note a day, and each love interest has a phone thread. Wish for Memories and looks with Starlight you earn (no real money; banners never expire).
- Dates: Read Them, Date Night and the Claw Machine. Remind Me keeps their days, with an opt-in period tracker kept in this browser.
- Your limits hold: Heat, Darkness, Lines & Veils and an 18+ gate. Paid work is labelled where you start it.
- An **Image style** for every picture, **Repaint** for a painted look, and archetype love interests now paint on xAI.

## 0.0.9 — 2026-10-28

- Every prompt that writes the story or a character's words asks the model to read each character's mind more carefully: what they know, want and feel.
- In NSFW mode the content contract opens by stating that the request complies with the adult fiction content policy.

## 0.0.8 — 2026-10-28

- Remind Me, from Home: a month of your story's days, with each love interest's birthday, the day your story began, its firsts with each love interest, and your own birthday if you add it (kept only on this device).
- A period tracker for anyone who has periods, off by default and stored only in this browser. Logged days show as filled hearts, predicted ones as outlined hearts, and it never calls a period late. Export moves it; one click deletes all of it.
- On a tracked day, Caring message asks the love interest on Home for a note. Only one line about today reaches your model provider, never the history; with Keep it off the model, or while debug logging is on, a comfort line written in advance answers instead. The note stays in this browser for the day only.
- Home: on the shortest phones the rail tightens so the note keeps a line of its words, and a long name on Him / Me is cut short inside the rail rather than reach over the love interest's tap zones.

## 0.0.7 — 2026-10-28

- Dates opens: pick a love interest, then play Read Them, Date Night or the Claw Machine. Every activity pays even when it goes badly; only the day's rewards are capped (400 Starlight from activities, 300 affection per love interest), never play.
- Read Them: over five moments, read what your love interest really feels behind the face they wear, hear the thought, and learn tells later scenes remember.
- Date Night: pick a place, even one your story painted, and what you both wear for three scenes of choices judged by what your love interest likes, with an optional keepsake image. During a rupture it becomes Make it right.
- The Claw Machine makes no model or image call: take turns at a swinging claw, cheer until they cheat in their own way, and line a shelf with six plushies and one of each love interest. It plays by keyboard, with reduced motion and without images.
- With voices on, their lines are read aloud. Each love interest alone remembers the games you played together.

## 0.0.6 — 2026-10-28

- Wish opens: three banners every 14 days (Memories, a love interest's wardrobe, and yours), paid only with Starlight you earn (100 a wish; there is no real money). The pity count is exact ("5★ in 23"): a 5★ comes by the 60th wish and is always the featured one, and past banners wait in Echoes on the same pity. Wishing never calls a model, and duplicates refund Starlight.
- Memories hold a Character Story to read; looks go to the Wardrobe, where your look and theirs make a couple set; Snapshots join that love interest's Love Timeline, and only they remember them.
- Wear at home puts a look on Home, and the love interest on Home notices a new look of yours. A Memory's CG can stand behind them.
- At affection 10, each love interest gives a Memory Selector. Banner and item art follows your image settings and is painted once.
- NSFW mode (18+ only): Explicit Heat and Dark romance are written in full, your Lines and Veils still win, and only CGs of explicit scenes show nudity.

## 0.0.5 — 2026-10-28

- Otome Forge is now Otome Hearth.
- Home now shows the love interest you pick, or you in your own look, before their newest CG or a painted place, tinted by your time of day. A painted look is cut out of its background when the Engine can, and pans slowly when it cannot; with no images, initials on a gradient. Reduced motion stills it.
- Each love interest leaves one handwritten note a day, with a mood; Reply opens their thread. During a rupture the note is curt and taps get only cold lines.
- Tap head, hand or heart for lines written ahead in their voice, so a tap never waits; too many pokes annoy them, and their face shows it. Rough day? offers comfort with no model call. With voices on, taps, the note and comfort are read aloud.
- The phone: one private thread per love interest, with suggested replies and stickers. Close and remember saves the talk as a memory only that love interest recalls (+20 affection, capped daily).

## 0.0.4 — 2026-10-28

- Each love interest now has a route: six stages from Mask to Bond, each opened by a free route chapter at an affection level and moved only by its last scene. The fourth reveals a secret; the fifth holds a confrontation and a choice that cannot be undone.
- Every main chapter builds to a confrontation: three rounds of Press, Hold, Yield or Reveal, ending in the truth, a walkout or a standoff. A walkout can open a rift that shuts their route until you Make it right.
- With an image connection, places and key moments are painted (or wait for your tap with Ask before painting), CGs join the Album once seen, and faces are painted in the background. Music follows each scene's mood, and dialogue can be voiced.

## 0.0.3 — 2026-10-28

- Now offered to Engine `staging` testers. The story begins: pick who leads each main chapter from two love interests, the one you have seen least and the one with the most unresolved between you, and play six to nine scenes that build to a confrontation.
- Scenes mark each love interest's face line by line (a later build paints the faces), set thoughts apart, and offer choices. Your first choice is canon; replays show the other branches and change nothing, and a choice that matters names who will remember it.
- Trust, tension and grievances move only through your choices and are never shown. Each love interest remembers only what they saw or were told.
- Rewrite a scene before choosing (one model call), or Ease off to end it at once with no model call, also when your model declines a scene. Settings → Debug shows the story memory.
- Reading earns Starlight and affection. Every prompt that writes the story keeps your content settings and the 18+ gate.

## 0.0.2 — 2026-10-28

- Still a development build, in no catalog. A story now starts from a setup: a premise, your protagonist from a persona, and two to five love interests from your cards or six original archetypes, each with the pronouns you pick.
- The forge plans the story's mystery and writes each love interest a hidden bible, which never contradicts their card. Bibles sit behind a spoiler gate, and you can edit them. Love interests are always adults.
- Content settings: Heat (SFW by default), Darkness (Angst by default), Lines & Veils and an image rating (SFW by default). NSFW Heat, Dark romance and images above SFW need a one-time 18+ confirmation that the server enforces; turning a setting down never asks.
- Base looks are painted only after you tap to paint them, and a failed paint waits for Retry. Without an image connection everything still works, with initials in each love interest's colour, and one added later can paint them.
- In debug mode, every prompt sent to the model is logged.

## 0.0.1 — 2026-10-28

- First development build, not listed in any catalog yet. It adds a Home tab, Otome Forge, with the game's portrait stage, its Midnight and Pearl looks and its fonts. Every screen still says it arrives in a later build.
- Otome Forge keeps its saves in its own `otome-forge:` documents, so it works alongside Gacha Forge.
