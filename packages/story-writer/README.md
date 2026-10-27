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

## Book or e-book, light or dark

Under **Appearance → Theme**, choose **Book** for an old open book on a wooden desk, or **E-book** for a clean reader screen. **Mode** follows the app's light or dark theme by default, or you can pick **Light** or **Dark** for Story Writer alone.

In the book, text fills the pages and the page turns when it runs out of room. In the e-book, the pages slide sideways. Every chapter starts on a new page.

To move around:

- the ‹ and › arrows beside the book,
- the ← and → keys (or Page Up and Page Down) when you are not typing,
- a sideways swipe on a touch screen when you are not editing,
- the chapter buttons and the "Chapter 2 · Page 5 of 18" line under the book,
- or a chapter's name in **Author tools → Chapters**, which jumps straight to it.

While the model writes, the book follows along and turns pages for you, unless you have moved somewhere else in the meantime.

## Edit anything, or start a chapter yourself

Click anywhere in the text and type. Your changes save on their own.

Story Writer understands simple Markdown: `*italics*`, `**bold**`, a line with `***` (or `---`) for a scene break, and `# Title` for a heading. Type the asterisks and they turn into formatting when you click away. Pasted text comes in as plain text.

You don't have to let the model start. On a brand-new story, click the empty first page and begin writing. After the last chapter there is always an empty page waiting for the next one: type there and you have started a new chapter. A chapter you started is a draft, so the main button changes to **Continue chapter N** and the model picks up where you stopped instead of starting a new chapter.

The page can't be edited while the model is writing.

## The author's note

The sticky note in the top corner holds your instructions for the next chapter, such as "Mira finally tells Jon the truth" or "slow down, more dialogue". Click it to unroll it and type. These instructions are sent with every chapter until you change them. Turn on **Author tools → Clear after the next chapter** if you want the note to empty itself once a chapter is written.

The note works like **Author's Notes** in Roleplay: it is sent as one of your messages, at the **Depth** you set on the note. Depth **0** (the default) puts it right before your continue message, so the model reads it last. Depth **1** puts it before the latest chapter, **2** one message further back, and so on; it never goes above the system prompt.

## The buttons at the bottom

- **Write next chapter**: writes a new chapter. When the last chapter is a draft, it reads **Continue chapter N** and finishes that chapter instead.
- **Stop**: shown while the model writes, with a live word count.
- **Continue the last chapter**: asks the model for more of a finished chapter, for example when it ended too soon.
- **Finish this chapter** (shown while the last chapter is a draft): marks it finished and writes the next chapter, for when a draft is done as it is.
- **Rewrite the last chapter**: throws the last chapter away and writes it again. Story Writer asks first.
- **Your stories**: opens your story list.
- **Fullscreen**: hides the rest of Marinara Engine.
- The word count of the whole story, with a progress bar when you have set a story length target.

On small screens the buttons shrink to icons.

## Your stories: save, come back, start new ones

Every story saves itself on your Marinara Engine server as you write: chapters, edits, the sticky note and every setting. Nothing is lost when you switch stories, close the tab or come back days later, and the story you had open last opens again.

Press the **Your stories** button (the bookshelf icon) at the bottom of the screen to see all of them, newest first, with their length, chapter count and when you last changed them. Click one to open it. From there you can also start a **New story**, **Duplicate** one (handy for trying a different direction), **Delete** one (Story Writer asks first), and **Download** the open story as **Markdown (.md)** to keep its formatting or **Plain text (.txt)** for anywhere else.

**Save now** (or Ctrl+S / Cmd+S) sends any change that is still waiting to be saved right away.

## The sidebar

Every change saves on its own after a moment. A small "Saving…" or "All changes saved" shows how it is going. The **Appearance** settings and **Stream text** apply to all your stories; everything else belongs to the story you have open.

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

For each character and persona the model gets its description, personality, backstory, appearance, scenario and example dialogue. From lorebooks it gets only the entries that matter right now: the Engine's own keyword scanner checks your overview, author's note and the last few chapters, and always-on entries are always included.

### Writing

| Setting | What it does | Default |
| --- | --- | --- |
| Connection | The model that writes. **Edit connection** opens the Engine's connection editor. | your default connection |
| Chapter length | About how many words each chapter should have. Short is 1,000, Medium 2,000 and Long 4,000; anything from 100 to 20,000 works. | 2,000 words |
| Story length target | About how long the whole story should be. Leave it empty for an open-ended story. | empty |
| Chapter titles | Ask the model to open each chapter with its own title. | on |
| Continue message | What you "say" to the model each time you ask for more. | `Continue.` |
| Prompt | The instructions at the very top of everything the model reads. **Reset to default** brings back the original. | `You are an excellent writer for the user. Your goal is to write the next chapter of this fictional story.` |
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
| Update automatically after each chapter | Refreshes the timeline after every chapter the model writes. | off |
| Clear after the next chapter | Empties the author's note once the next chapter is written. | off |
| Depth (on the sticky note) | Where the author's note goes among the messages: 0 = right before your continue message. | 0 |

### Appearance

| Setting | Choices | Default |
| --- | --- | --- |
| Theme | Book or E-book | Book |
| Mode | Match the app, Light or Dark | Match the app |
| Font | The theme's own font, Serif, Sans, Monospace, the app's font, or any custom font added to Marinara Engine | the theme's font |
| Font color | Any color; **Reset** goes back to the theme's ink | the theme's ink |
| Font size | 12 to 36 | 18 |
| Sidebar side | Left or Right | Left |
| Sticky note corner | Left or Right | Right |
| Page-turn animation | On or off. It is skipped when your device asks for reduced motion. | on |

## What the model reads

Each time you ask for a chapter, Story Writer puts together the same kind of conversation a chat would, but just for your story:

1. **One system message** with, in this order: your prompt; the story details (title, fandom, genre, rating, relationships, content warnings, tags, author and style); the overview; the lorebook entries that matter right now; your characters; your personas; your story notes; the timeline; summaries of earlier chapters; where the story is in length; your banned phrases; the language; and how to format the chapter. `{{char}}` and `{{user}}` in cards and lorebooks become the character's name and your first persona's name.
2. **The chapters it reads in full**, oldest first (see Summaries below). Each one is sent as your request (a user message) followed by the chapter itself (an assistant message), just as if the model had written it in a chat.
3. **Your author's note** as a user message at its depth (right before the continue message at depth 0).
4. **Your continue message** as the final user message.

When the model continues an unfinished chapter, that chapter is the last assistant message and the model is asked to pick up exactly where it stops, without repeating anything or adding a heading.

If a model writes its thinking inside `<think>` tags, Story Writer leaves that out of the chapter.

## Summaries: long stories without running out of room

Sending every chapter word for word gets expensive and eventually stops fitting. So the latest chapters, three unless you change **Keep the last N chapters in full**, always go to the model in full. An older chapter that has a summary is sent as that summary instead. An older chapter without a summary is still sent in full, so nothing is lost by accident.

Summaries are written by the same model: press **Summarize** on a chapter, **Summarize older chapters** for all of them at once, or turn on **Auto-summarize**. A summary is plain text you can read and edit, or you can write your own.

## The timeline

The timeline is a list of events you want to happen, in order. Tick the ones that have already happened. The model moves the story toward the next unticked event and is told not to skip past events that haven't happened yet. Add, edit, reorder and delete events in **Author tools**.

**Fill with AI** plans the timeline for you from your overview, notes and chapters: usually 5 to 20 events that carry the story to its end. It keeps your existing events unless the story contradicts them, and ticks the ones that have happened. Turn on **Update automatically after each chapter** to have it refreshed after every chapter the model writes.

## Story length

With a **Story length target**, the model is told how long the story is so far, what share of the target that is, and to pace the plot so it ends near the target. When the words left fit in one chapter, it is told to bring the story to its ending.

**Chapter length** is a target, not a hard limit. Story Writer asks the connection for enough room for a chapter of that length, or for the connection's own saved maximum if that is larger. If a chapter gets cut off anyway, it stays a draft and **Continue chapter N** finishes it.

## Where your stories are kept

Stories, chapters and settings are saved on your Marinara Engine server with its other data, not in the browser. That means you see the same stories on every device you use with that Engine. Uninstalling Story Writer does not delete them: install it again and they are still there.

## On a phone or tablet

Story Writer works in portrait and landscape. In portrait, the book shows a single page at a time; turn the device sideways for a two-page spread. Swipe sideways to turn pages, and tap the text when you want to edit it. The sidebar covers most of the screen while it is open; close it with its arrow. **Fullscreen** gives the book the whole screen.

## Privacy

Everything the model reads goes to the connection you pick: your prompt, the selected characters, personas and lorebook entries, your overview and notes, the chapters and your author's note. If that connection is an online provider, they receive your story. For a fully private story, use a model that runs on your own computer. Story Writer itself sends your story nowhere else.

## Troubleshooting

**Write is greyed out, or no connection is listed.** Story Writer needs a connection that writes text. Image, video and audio connections are not listed, and neither are imported connections still waiting for your review. Add or review one in the Engine's connections, then pick it in **Writing → Connection**.

**A chapter fails with an error.** The message comes from the Engine or the provider, so it usually says what went wrong: a wrong API key, an unavailable model, a request that is too large. Open **Edit connection** to check the connection. If the problem only happens while streaming, try turning **Stream text** off. If the request is too large, summarize older chapters or lower **Keep the last N chapters in full**.

**Chapters stop in the middle.** The connection ran out of room for the answer. Press **Continue chapter N**, or raise the maximum tokens in the connection's settings.

**A finished chapter is still marked as a draft.** Story Writer guesses that a chapter was cut off when it ends without a sentence ending. If the chapter is really done, press **Finish this chapter** to move on to the next one.

**"403" or "not allowed" when using Story Writer from another device.** Story Writer saves through the Engine's protected package routes. On the computer running Marinara Engine this just works, but from another device on your network (or through a tunnel) those routes need the admin secret: set `ADMIN_SECRET` in the server's `.env`, then paste the same value into **Settings → Advanced → Admin Access** on that device and click **Save**.

**The model keeps using a phrase you hate.** Add it to **Banned words and phrases**. Story Writer also tells you after each chapter which banned phrases slipped through, so you can edit them out.

## For developers

Rebuild only this package from the repository root with a neighboring Engine checkout:

```bash
node scripts/build-feature-packages.mjs story-writer
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
```
