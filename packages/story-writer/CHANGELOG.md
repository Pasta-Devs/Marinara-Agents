# Story Writer release notes

## 0.7.0 — 2026-11-26

- **Illustrate** can use your own image tags and your characters' pictures. Once you pick an image connection, **Writing** has a **Picture prompt prefix** that goes at the start of every picture prompt (your artist or quality tags, say), shown in the prompt review, and a **Negative prompt prefix** that goes before the negative prompt. With **Use character pictures as references** on, as it is by default, each picture goes with the avatars of the story's characters and personas that its prompt names, up to four, so a connection that takes reference pictures, such as NovelAI with Precise Reference, keeps their looks. A picture that names nobody sends none. Stories you already have start with empty prefixes and references on.

## 0.6.0 — 2026-11-25

- **Illustrate** paints a picture of a passage. Click in a paragraph or select some text and press the picture button: the story's model writes a prompt from the passage and your cast's looks, and the image connection you pick under **Writing → Image connection** paints it. Until you pick one, Illustrate sends nothing. If the Engine shows you media prompts before sending, you can change the prompt first. The picture sits beside its paragraph with the text wrapping around it, full width on a phone, and beside the column in Document. Writing, Continue and Rewrite keep it. **Illustrate again** paints a new one in its place and keeps the old one in the Global Gallery; **Remove** also deletes it from the gallery unless something else uses it. On a phone, the picture button waits for an image connection. Markdown downloads include the pictures.

## 0.5.0 — 2026-11-25

- **Chapter length** has a new choice, **Off (I decide)**, for steering the story a passage at a time. One **Generate** button replaces **Write next chapter** and **Continue**: it continues the chapter you are on, from where its text ends, and quick replies write into that chapter too. The model gets no chapter length, never starts a chapter, and ends one only when you ask it to. You start the next chapter yourself on the blank page after the last one. Your author's note decides how much each Generate writes. Every other chapter length works as before.

## 0.4.0 — 2026-11-17

- **Redo** appears next to **Rewrite the last chapter** after the model writes something. It takes back only what the model just wrote and writes it again with the same instruction, so you no longer have to select and delete a refusal or a cut-off answer by hand. It works after **Write**, **Continue**, a quick reply and **Rewrite**. If **Clear after the next chapter** emptied your author's note, Redo puts it back. Story Writer asks first. If you change that chapter or its summary, the button goes away and your changes are kept.

## 0.3.0 — 2026-11-17

- A third theme, **Document**: no pages, just your chapters one under another in a column you scroll, with a line between chapters. You can select text across what used to be a page break, and on a phone you read by scrolling. The chapter bar reads "Chapter 2 of 5", and its buttons move from chapter to chapter.
- **Author tools → Peek at the prompt** shows what **Write** would send next: every message, the model and the token limit. It writes nothing.
- The sticky note can be hidden, with the hide button on the open note or **Appearance → Show the author's note**. A hidden note is still sent with every chapter, and on smaller screens the book takes its place.
- Characters, personas and lorebooks you add or change elsewhere in Marinara Engine now show up in **Cast & world** while Story Writer is open.

## 0.2.0 — 2026-11-07

- Quick replies: save instructions such as "More dialogue" or "Slow down" as buttons next to Write. Click one to write the next chapter (or continue a draft) with that instruction instead of your continue message. Add and edit them under **Quick replies** in the sidebar; **Show quick replies** hides the row. Every story shares the same list.
- A quick reply's words also pick lorebook entries, like the author's note's do.
- The chapter bar ("Chapter 2 · Page 5 of 18") moved above the book and got smaller, so the book itself is bigger.
- Rewriting the last chapter now sends the request it was written from: the quick reply, or your continue message as it was then, even if you have changed it since. A chapter written from a quick reply keeps that instruction; to steer a rewrite, change the author's note.

## 0.1.1 — 2026-10-26

- On a phone turned sideways, the closed settings drawer now hides completely behind its arrow, and the book no longer loses extra room beside the camera.

## 0.1.0 — 2026-10-25

- New Home tab: Story Writer, a co-writing book where the model writes your story chapter by chapter.
- Pick a connection, characters, personas and lorebooks, describe the story, and press Write. The chapter streams onto the page.
- Read it as an open book or an e-book, light or dark, with your own font, color and size. A portrait phone shows one page.
- Click anywhere to edit, or start a chapter yourself and let the model continue it.
- A sticky author's note tells the model what you want next, placed at a depth like Roleplay's Author's Notes.
- Author tools: chapter summaries for long stories, a timeline the model follows (it can fill it in for you), and a target story length.
- Every story saves itself: start new ones, come back to old ones any time, and download them as Markdown or plain text.
- Change the prompt, banned phrases and continue message.
