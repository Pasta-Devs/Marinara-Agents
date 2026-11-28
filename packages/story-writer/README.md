# Story Writer

Story Writer is a co-writing book for long stories and fanfiction. You set the story up, the model writes it one chapter at a time, and you steer: leave instructions on a sticky note, fix anything on the page, or write a chapter yourself and let the model carry on from there.

It has its own settings and its own prompt, separate from your chats. Your chats, characters and lorebooks are never changed by it; it only reads the ones you pick.

## Install and open it

1. Open **Agents → Download Agents** and install **Story Writer**.
2. Restart Marinara Engine when it asks you to.
3. Open **Home → Story Writer** (the book icon).

It needs a Marinara Engine newer than v2.5.1 (the next release, or a current staging build); older Engines do not offer it.

## Your first story

The settings live in a sidebar that slides out from the edge of the screen. Click the arrow tab on the edge to open it, and again to close it (or press Escape).

1. **Writing → Connection**: pick the model that writes your story. **Edit connection** opens the Engine's connection editor if you want to change its model or parameters there.
2. **Cast & world**: tick the characters, personas and lorebooks the story should know about. Your personas count as characters in the story too.
3. **Story**: give it a title and write an **Overview**: what the story is about, where it starts, anything the model should know. A few sentences is enough; more detail gives the model more to work with.
4. Optional: set the **Chapter length**, a **Story length target**, an author whose style to borrow, or tags.
5. Press **Write next chapter** at the bottom of the screen.

The chapter appears on the page as the model writes it (or all at once if **Stream text** is off). When it is done, read it, change what you like, and press **Write next chapter** again. **Stop** ends a chapter early; whatever was written so far stays on the page as a draft you can continue later.

## Book, e-book or document, light or dark

Under **Appearance → Theme**, choose **Book** for an old open book on a wooden desk, **E-book** for a clean reader screen, or **Document** for text you scroll, with no pages at all. **Mode** follows the app's light or dark theme by default, or you can pick **Light** or **Dark** for Story Writer alone. Your choice applies to every story, on every device you use with this Engine.

In the book, text fills the pages and the page turns when it runs out of room. In the e-book, the pages slide sideways. Every chapter starts on a new page.

To move around the book and the e-book:

- the ‹ and › arrows beside the book,
- the ← and → keys (or Page Up and Page Down) when you are not typing,
- a sideways swipe on a touch screen when you are not editing,
- the chapter buttons and the "Chapter 2 · Page 5 of 18" bar above the book (on a phone it sits beside the sticky note and reads "Ch. 2 · 5/18"),
- or a chapter's name in **Author tools → Chapters**, which jumps straight to it.

While the model writes, the book follows along and turns pages for you, unless you have moved somewhere else in the meantime.

### Document

**Document** shows the story as one column you scroll down, like a web page: no pages, page numbers or page turns. Each chapter keeps its "Chapter N" heading, with a line above it that separates it from the chapter before. Nothing splits the text into pages, so you can select a long passage in one go, and on a phone you read by scrolling.

- Scroll with the mouse wheel, the scroll bar, the keyboard or a swipe.
- The bar above the text names the chapter you are reading, "Chapter 2 of 5" (on a phone, "Ch. 2/5"), and its buttons go to the previous or next chapter's heading.
- A chapter's name in **Author tools → Chapters** scrolls to its heading.

A story opens at the end of its last chapter. While the model writes, the text scrolls along with the new chapter until you scroll yourself. Each chapter is edited separately, so while the story can be edited, a selection may not reach from one chapter into the next. **Page-turn animation** is not shown, because there are no pages to turn.

## Edit anything, or start a chapter yourself

Click anywhere in the text and type. Your changes save on their own.

Story Writer understands simple Markdown: `*italics*`, `**bold**`, a line with `***` (or `---`) for a scene break, and `# Title` for a heading. Type the asterisks and they turn into formatting when you click away. Pasted text comes in as plain text.

You don't have to let the model start. On a brand-new story, click the empty first page and begin writing. After the last chapter there is always an empty page waiting for the next one: type there and you have started a new chapter. A chapter you started is a draft, so the main button changes to **Continue chapter N** and the model picks up where you stopped instead of starting a new chapter.

The page can't be edited while the model is writing.

## Write a passage at a time

Set **Writing → Chapter length** to **Off (I decide)** when you want to steer the story a few paragraphs at a time and decide yourself where each chapter ends. Each story keeps its own choice.

- One **Generate** button replaces **Write next chapter** and **Continue chapter N**. It continues the chapter you are on, from where its text ends. Its label names that chapter: "Generate in chapter 2".
- The chapter you are on is the one the chapter bar names, or the one you last clicked into. On the title page or the blank page after the last chapter, it is the last chapter.
- Your quick replies write into that chapter too.
- The model gets no chapter length. Put how much you want in the author's note, for example "Two paragraphs, then stop." It never starts a new chapter and ends one only when you ask it to.
- Generate never marks a chapter finished. To start the next chapter, type on the blank page after the last one.
- When Generate continues an earlier chapter, the model reads the story only up to the end of that chapter.
- **Continue the last chapter** and **Finish this chapter** are not shown. **Rewrite the last chapter** and **Redo** work as before; Redo takes back what Generate last wrote, in whichever chapter it wrote.
- A brand-new story has no chapter yet, so Generate waits until you start one on the page.

Pick **Short**, **Medium**, **Long** or type a length to go back to writing chapter by chapter. The length you had before is kept.

## Pictures: illustrate a passage

**Illustrate** (the picture button at the bottom of the screen) paints a picture of a passage of your story.

1. Pick the connection that paints under **Writing → Image connection**. It starts at **None**, and with None, Illustrate sends nothing and costs nothing; it tells you where to choose one. On a phone held upright, the button shows only once you have chosen one.
2. Click in the paragraph you want a picture of, or select a passage.
3. Press **Illustrate**. The story's own connection writes a picture prompt in English from that passage and the looks of your characters and personas: who is there, by name, what they look like, where they are, the light, what they are doing, and no text in the picture. Your **Picture prompt prefix** goes at the start of it.
4. If **Settings → Generations → Expose media prompts before sending** is on in Marinara Engine, Story Writer shows you that prompt first, prefix included: change it as you like and press **Paint**, or **Cancel**. When it is off, the picture is painted straight away.

The image connection paints exactly the prompt it gets; your image style profiles are not added to it. To add your own tags, such as the artist and quality tags your Illustrator agent uses, put them in **Writing → Picture prompt prefix**, and the ones to avoid in **Negative prompt prefix**. Story Writer always asks for no text in the picture after your negative prefix. A picture takes a little while to paint; you can keep writing meanwhile.

With **Writing → Use character pictures as references** on (the default), the picture goes with the avatars of your characters and personas that its prompt names by their full name, capitalized as on the card or persona (so Amber is not found in "amber light"), up to four, in the order the prompt names them. A connection that takes reference pictures, such as NovelAI with Precise Reference, uses them to keep their looks. When the prompt says what they wear, NovelAI V5 dresses them as the prompt says rather than as the avatar shows. Someone without an avatar is left out, and a picture that names no one from your cast is painted without references. Each connection uses reference pictures in its own way: AUTOMATIC1111, for one, starts from the first picture instead of a blank canvas; turn the setting off for such a connection to have it paint from the prompt alone.

Where the picture goes:

- **Book** and **E-book**: beside its paragraph, with the text wrapping around it. On a page too narrow for that (a phone), it sits full width between paragraphs. It is at most 60% of a page tall, so it always fits on one page: if it does not fit where its paragraph is, it moves to the top of the next page.
- **Document**: beside the column, next to its paragraph, in a wide window, and between paragraphs in a narrower one.

The picture belongs to the chapter, not to its text: it stays beside its paragraph when you edit the text above it, and writing, Generate, **Continue** and **Rewrite** never remove it. If its paragraph is gone, it stays at the same place in the chapter.

Point at a picture (on a touch screen its buttons are always shown) for its two buttons:

- **Illustrate again** paints a new picture from the same prompt (with the prefix it had), in its place. The old picture stays in the Global Gallery. With **Expose media prompts before sending** on, you can change the prompt first.
- **Remove this picture** takes it out of the chapter, after asking. It is deleted from the Global Gallery too, unless something else uses it (a duplicated story, for example).

Every picture is also kept in the Engine's **Global Gallery**. Deleting a chapter or a story keeps its pictures there, and so does painting a picture again. A downloaded **Markdown** file shows the pictures as images linked to your Engine; **Plain text** leaves them out.

## The author's note

The sticky note in the top corner holds your instructions for the next chapter, such as "Mira finally tells Jon the truth" or "slow down, more dialogue". Click it to unroll it and type. These instructions are sent with every chapter until you change them. Turn on **Author tools → Clear after the next chapter** if you want the note to empty itself once a chapter is written.

The note works like **Author's Notes** in Roleplay: it is sent as one of your messages, at the **Depth** you set on the note. Depth **0** (the default) puts it right before your continue message, so the model reads it last. Depth **1** puts it before the latest chapter, **2** one message further back, and so on; it never goes above the system prompt.

To get the note out of the way, press the hide button on the open note, or turn off **Appearance → Show the author's note**. A hidden note is still sent with every chapter; turn the setting back on to see or change it. On narrower screens the book grows into the space the note took.

## Quick replies

Quick replies are instructions you use again and again, such as "More dialogue" or "Slow down and describe the place", saved as buttons next to **Write next chapter**. Clicking one does what **Write next chapter** would (it writes the next chapter, or continues a draft), but sends that instruction in place of your continue message. Your author's note still goes with it. With **Chapter length** set to **Off (I decide)**, a quick reply does what **Generate** does: it writes into the chapter you are on.

Add them in the sidebar under **Quick replies**: an **Instruction**, and optionally a short **Button label** (without one, the button shows the instruction). You can change or delete them there at any time, and **Edit quick replies** (the pencil at the end of the row) takes you there. **Show quick replies** hides the row when you want the room for the book. Every story shares the same quick replies, and the row only appears once you have added one.

A new chapter remembers the quick reply it was written from, so the model sees it again in the story's history and **Rewrite the last chapter** asks for the same thing. Continuing a draft with a quick reply sends it once; the draft keeps the request it was started with.

## The buttons at the bottom

- **Write next chapter**: writes a new chapter. When the last chapter is a draft, it reads **Continue chapter N** and finishes that chapter instead.
- **Generate in chapter N** (Chapter length Off): takes the place of **Write next chapter** and writes the next passage of the chapter you are on. See [Write a passage at a time](#write-a-passage-at-a-time).
- **Stop**: shown while the model writes, with a live word count.
- **Continue the last chapter**: asks the model for more of a finished chapter, for example when it ended too soon.
- **Finish this chapter** (shown while the last chapter is a draft): marks it finished and writes the next chapter, for when a draft is done as it is.
- **Rewrite the last chapter**: throws the last chapter away and writes it again from the request it was written from: the quick reply, or your continue message as it was then, even if you have changed it since. To steer a rewrite, change the author's note first. Story Writer asks first.
- **Redo** (shown after the model has written something): takes back only what the model last wrote and writes it again with the same instruction, for when it refused or stopped partway. A continued chapter goes back to where it was before, and a new chapter is written again in its place. If **Clear after the next chapter** emptied the author's note, Redo puts the note back first. The button goes away as soon as you change that chapter or its summary, and your changes are kept. It also goes away when you reload the page. On a phone, the word count makes room for it. Story Writer asks first.
- **Illustrate** (the picture button, once there is a chapter): paints a picture of the paragraph at the cursor or the passage you selected. On a phone held upright, it shows once you have chosen an image connection. See [Pictures](#pictures-illustrate-a-passage).
- **Your stories**: opens your story list.
- **Fullscreen**: hides the rest of Marinara Engine.
- The word count of the whole story, with a progress bar when you have set a story length target.
- Your **quick replies**, when you have some: beside these buttons on a wide screen, just above them on a narrower one.

On small screens the buttons shrink to icons. On a phone held upright, the word count makes room for **Redo** and **Illustrate**, and while both are shown the main button shows only its icon.

## Your stories: save, come back, start new ones

Every story saves itself on your Marinara Engine server as you write: chapters, edits, the sticky note and every setting. Nothing is lost when you switch stories, close the tab or come back days later, and the story you had open last opens again.

Press the **Your stories** button (the bookshelf icon) at the bottom of the screen to see all of them, newest first, with their length, chapter count and when you last changed them. Click one to open it. From there you can also start a **New story**, **Duplicate** one (handy for trying a different direction), **Delete** one (Story Writer asks first), and **Download** the open story as **Markdown (.md)** to keep its formatting and pictures or **Plain text (.txt)** for anywhere else.

**Save now** (or Ctrl+S / Cmd+S) sends any change that is still waiting to be saved right away.

## The sidebar

Every change saves on its own after a moment. A small "Saving…" or "All changes saved" shows how it is going. The **Appearance** settings, your **Quick replies** and **Stream text** apply to all your stories; everything else belongs to the story you have open.

### Stories

The same list as **Your stories**: open, start, duplicate, delete and download stories, and **Save now**.

### Story

| Setting | What it does | Default |
| --- | --- | --- |
| Title | The story's name, shown on its title page. | empty |
| Overview | What the story is about. The model reads it before every chapter. | empty |
| Fandom, Genre, Rating, Relationships, Content warnings, Tags | Story details, like on a fanfiction site, for example tags such as "hurt/comfort, angst". | empty |
| Author | Write in the style of this author, for example Terry Pratchett. | empty |
| Style | How it is narrated, for example "third person limited, present tense". | empty |
| Language | The language to write in, for example English. Empty lets the model decide. | empty |
| Story notes | Your story bible: names, facts and rules the model must keep straight. | empty |

### Cast & world

**Characters**, **Personas** and **Lorebooks**, each a searchable list you tick. Nothing is selected in a new story.

The lists follow Marinara Engine: a character, persona or lorebook you create or change there shows up here while Story Writer is open.

For each character and persona the model gets its description, personality, backstory, appearance, scenario and example dialogue. From lorebooks it gets only the entries that matter right now: the Engine's own keyword scanner checks your overview, author's note, the last few chapters, and the quick reply you clicked (or the older request a rewrite sends again), and always-on entries are always included.

### Writing

| Setting | What it does | Default |
| --- | --- | --- |
| Connection | The model that writes. **Edit connection** opens the Engine's connection editor. | your default connection |
| Image connection | The connection **Illustrate** paints with. Only image connections are listed. With **None**, Illustrate sends nothing. | None |
| Picture prompt prefix | Goes at the start of every picture prompt Illustrate writes, such as artist or quality tags. Shown once you pick an image connection, like the next two. | empty |
| Negative prompt prefix | Goes before the negative prompt every picture is painted with. | empty |
| Use character pictures as references | Sends the avatars of the characters and personas a picture prompt names, up to four, with the picture. See [Pictures](#pictures-illustrate-a-passage). | on |
| Chapter length | About how many words each chapter should have. Short is 1,000, Medium 2,000 and Long 4,000; anything from 100 to 20,000 works. **Off (I decide)** gives the chapters no length: see [Write a passage at a time](#write-a-passage-at-a-time). | 2,000 words |
| Story length target | About how long the whole story should be. Leave it empty for an open-ended story. | empty |
| Chapter titles | Ask the model to open each chapter with its own title. | on |
| Continue message | What you "say" to the model each time you ask for more. | `Continue.` |
| Prompt | The instructions at the very top of everything the model reads. **Reset to default** brings back the original. | `You are an excellent writer for the user. Your goal is to write the next chapter of this fictional story.` With Chapter length Off, the default reads "the next part" instead of "the next chapter". |
| Banned words and phrases | Words and phrases the model is told never to use, separated by commas. | `ozone, jaws working, Elara` |
| Stream text | Show the chapter as it is written. Off, it appears all at once. | on |

Only connections that write text are listed. When you have none yet, add one in the Engine's connections first.

After each chapter, Story Writer tells you if any of your banned words or phrases slipped through anyway, so you can fix them.

### Author tools

| Setting | What it does | Default |
| --- | --- | --- |
| Chapters | The table of contents. Click a chapter to jump to it. Each one has its summary, a **Summarize** button and a delete button (Story Writer asks first). | |
| Summarize older chapters | Writes a summary for every older chapter that does not have one yet. | |
| Keep the last N chapters in full | How many of the latest chapters the model always reads word for word. | 3 |
| Auto-summarize | Summarize a chapter on its own once it is no longer one of the last N. | off |
| Timeline | The plot events you have planned, in order. | empty |
| Fill with AI | Lets the model plan or refresh the timeline. | |
| Update automatically after each chapter | Refreshes the timeline after every chapter the model writes, or after every Generate when Chapter length is Off. | off |
| Clear after the next chapter | Empties the author's note once the next chapter is written, or after every Generate when Chapter length is Off. | off |
| Depth (on the sticky note) | Where the author's note goes among the messages: 0 = right before your continue message. | 0 |
| Peek at the prompt | Shows what **Write** (or **Generate**) would send next, without writing anything. See [What the model reads](#what-the-model-reads). | |

### Quick replies

| Setting | What it does | Default |
| --- | --- | --- |
| Show quick replies | Shows the row of quick replies next to **Write next chapter**. | on |
| Quick replies | Up to 24 instructions, each with an optional button label, shared by every story. | none |

### Appearance

| Setting | Choices | Default |
| --- | --- | --- |
| Theme | Book, E-book or Document | Book |
| Mode | Match the app, Light or Dark | Match the app |
| Font | The theme's own font, Serif, Sans, Monospace, the app's font, or any custom font added to Marinara Engine | the theme's font |
| Font color | Any color; **Reset** goes back to the theme's ink | the theme's ink |
| Font size | 12 to 36 | 18 |
| Sidebar side | Left or Right | Left |
| Sticky note corner | Left or Right | Right |
| Show the author's note | On or off. A hidden note is still sent to the model with every chapter. | on |
| Page-turn animation | On or off. It is skipped when your device asks for reduced motion, and not shown for Document. | on |

## What the model reads

Each time you ask for a chapter, Story Writer puts together the same kind of conversation a chat would, but just for your story:

1. **One system message** with, in this order: your prompt; the story details (title, fandom, genre, rating, relationships, content warnings, tags, author and style); the overview; the lorebook entries that matter right now; your characters; your personas; your story notes; the timeline; summaries of earlier chapters; where the story is in length; your banned phrases; the language; and how to format the chapter. `{{char}}` and `{{user}}` in cards and lorebooks become the character's name and your first persona's name.
2. **The chapters it reads in full**, oldest first (see Summaries below). Each one is sent as your request (a user message) followed by the chapter itself (an assistant message), just as if the model had written it in a chat.
3. **Your author's note** as a user message at its depth (right before the final message at depth 0).
4. **Your continue message**, or the quick reply you clicked, as the final user message. A rewrite sends the request the chapter was written from instead.

When the model continues an unfinished chapter, that chapter is the last assistant message and the model is asked to pick up exactly where it stops, without repeating anything or adding a heading. **Generate** (Chapter length Off) works the same way for the chapter you are on: the chapters before it come first, the chapters after it are left out, and the model is asked for the next passage instead of a chapter of a set length.

If a model writes its thinking inside `<think>` tags, Story Writer leaves that out of the chapter.

To see it for yourself, open **Author tools → Peek at the prompt**. It shows the messages as the Engine would send them for the next **Write next chapter** (or **Continue chapter N**, or **Generate**), with the model and the token limit, and writes nothing. Long messages start folded; click one to open it.

## Summaries: long stories without running out of room

Sending every chapter word for word gets expensive and eventually stops fitting. So the latest chapters, three unless you change **Keep the last N chapters in full**, always go to the model in full. An older chapter that has a summary is sent as that summary instead. An older chapter without a summary is still sent in full, so nothing is lost by accident.

Summaries are written by the same model: press **Summarize** on a chapter, **Summarize older chapters** for all of them at once, or turn on **Auto-summarize**. A summary is plain text you can read and edit, or you can write your own.

## The timeline

The timeline is a list of events you want to happen, in order. Tick the ones that have already happened. The model moves the story toward the next unticked event and is told not to skip past events that haven't happened yet. Add, edit, reorder and delete events in **Author tools**.

**Fill with AI** plans the timeline for you from your overview, notes and chapters: usually 5 to 20 events that carry the story to its end. It keeps your existing events unless the story contradicts them, and ticks the ones that have happened. Turn on **Update automatically after each chapter** to have it refreshed after every chapter the model writes.

## Story length

With a **Story length target**, the model is told how long the story is so far, what share of the target that is, and to pace the plot so it ends near the target. When the words left fit in one chapter, it is told to bring the story to its ending.

With **Chapter length** set to **Off (I decide)**, the model is still told how long the story is and how close it is to the target, but never that a chapter should be the last one. Each Generate gets room for about 4,000 words, or the connection's own saved maximum if that is larger.

**Chapter length** is a target, not a hard limit. Story Writer asks the connection for enough room for a chapter of that length, or for the connection's own saved maximum if that is larger. If a chapter gets cut off anyway, it stays a draft and **Continue chapter N** finishes it.

## Where your stories are kept

Stories, chapters and settings are saved on your Marinara Engine server with its other data, not in the browser; pictures are kept in its Global Gallery. That means you see the same stories on every device you use with that Engine. Uninstalling Story Writer does not delete them: install it again and they are still there.

## On a phone or tablet

Story Writer works in portrait and landscape. In portrait, the book shows a single page at a time; turn the device sideways for a two-page spread. Sideways, the buttons stand upright at the side and your quick replies sit at the bottom of the screen. Swipe sideways to turn pages, and tap the text when you want to edit it. If you would rather scroll, or want to select long passages with your finger, choose **Document** under **Appearance → Theme**. The sidebar covers most of the screen while it is open; close it with its arrow. **Fullscreen** gives the book the whole screen.

## Privacy

Everything the model reads goes to the connection you pick: your prompt, the selected characters, personas and lorebook entries, your overview and notes, the chapters and your author's note. If that connection is an online provider, they receive your story. For a fully private story, use a model that runs on your own computer. Story Writer itself sends your story nowhere else.

**Illustrate** sends the passage, the text just before it, your overview and notes, the lorebook entries that match it and the looks of your characters and personas to the same connection, and the picture prompt it writes to your image connection, with the avatars of the characters and personas that prompt names unless **Use character pictures as references** is off.

## Troubleshooting

**Write is greyed out, or no connection is listed.** Story Writer needs a connection that writes text. Image, video and audio connections are not listed, and neither are imported connections still waiting for your review. Add or review one in the Engine's connections, then pick it in **Writing → Connection**.

**A chapter fails with an error.** The message comes from the Engine or the provider, so it usually says what went wrong: a wrong API key, an unavailable model, a request that is too large. Open **Edit connection** to check the connection. If the problem only happens while streaming, try turning **Stream text** off. If the request is too large, summarize older chapters or lower **Keep the last N chapters in full**.

**Chapters stop in the middle.** The connection ran out of room for the answer. Press **Continue chapter N**, or raise the maximum tokens in the connection's settings.

**A finished chapter is still marked as a draft.** Story Writer guesses that a chapter was cut off when it ends without a sentence ending. If the chapter is really done, press **Finish this chapter** to move on to the next one.

**"403" or "not allowed" when using Story Writer from another device.** Story Writer saves through the Engine's protected package routes. On the computer running Marinara Engine this just works, but from another device on your network (or through a tunnel) those routes need the admin secret: set `ADMIN_SECRET` in the server's `.env`, then paste the same value into **Settings → Advanced → Admin Access** on that device and click **Save**.

**Illustrate says it needs an image connection.** Choose one under **Writing → Image connection**. If none is listed, add an image connection in the Engine's connections first.

**Illustrate asks you to click in a paragraph.** It paints the paragraph at the cursor, or the text you selected, in the chapter you are on. Click in the text first; after you turn to another chapter, click in that one.

**A picture fails to paint.** The message comes from the image connection or its provider. Check the connection in the Engine; nothing is stored in the chapter when painting fails.

**The model keeps using a phrase you hate.** Add it to **Banned words and phrases**. Story Writer also tells you after each chapter which banned phrases slipped through, so you can edit them out.

## For developers

Rebuild only this package from the repository root with a neighboring Engine checkout:

```bash
node scripts/build-feature-packages.mjs story-writer
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
```
