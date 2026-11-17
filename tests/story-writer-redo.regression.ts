import assert from "node:assert/strict";
import test from "node:test";
import type {
  StoryChapter,
  StoryWithChapters,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/model.ts";
import {
  recordGeneration,
  redoOffer,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/redo.ts";

function chapter(index: number, patch: Partial<StoryChapter> = {}): StoryChapter {
  return {
    id: `chapter-${index}-0000`,
    storyId: "story-1",
    text: `Chapter ${index} text.`,
    summary: "",
    status: "complete",
    request: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

function story(chapters: StoryChapter[], id = "story-1"): StoryWithChapters {
  return {
    story: {
      id,
      settings: {} as StoryWithChapters["story"]["settings"],
      chapterIds: chapters.map((item) => item.id),
      wordCount: 0,
      chapterCount: chapters.length,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    chapters,
  };
}

/** The story with `chapterId` changed by `patch`, as writeChapter's saves leave it. */
function changed(doc: StoryWithChapters, chapterId: string, patch: Partial<StoryChapter>): StoryWithChapters {
  return story(
    doc.chapters.map((item) => (item.id === chapterId ? { ...item, ...patch } : item)),
    doc.story.id,
  );
}

const fields = ({ text, summary, status, request }: StoryChapter) => ({ text, summary, status, request });

test("a continued chapter is remembered as it was, and Redo is offered for it", () => {
  const draft = chapter(1, { text: "It was a dark and stormy night.", status: "draft", summary: "Night." });
  const found = story([draft]);
  const after = "It was a dark and stormy night. Thunder rolled.";
  const written = changed(found, draft.id, { text: after, status: "complete" });
  const record = recordGeneration(found, { requested: "next", override: undefined, chapterId: draft.id, after });

  assert.equal(record.storyId, "story-1");
  assert.equal(record.requested, "next");
  assert.deepEqual(record.before, fields(draft));
  // Continuing leaves the summary alone.
  assert.equal(record.afterSummary, "Night.");
  assert.equal(redoOffer(record, written), 1);
  // A summary the author changes afterwards would be overwritten: Redo goes.
  assert.equal(redoOffer(record, changed(written, draft.id, { summary: "A stormy night." })), null);
  // Putting `before` back leaves the chapter exactly as the run found it.
  assert.deepEqual(changed(written, draft.id, record.before!).chapters, found.chapters);
});

test("a rewritten chapter is remembered with its old text, summary and request, not as the run emptied it", () => {
  const first = chapter(1);
  const original = chapter(2, { text: "The old chapter.", summary: "Old.", request: "Make it pour." });
  const found = story([first, original]);
  const after = "The new chapter.";
  // The rewrite empties the chapter before it streams, then saves what it wrote.
  const written = changed(found, original.id, { text: after, summary: "", status: "complete" });
  const record = recordGeneration(found, { requested: "rewrite", chapterId: original.id, after });

  assert.equal(record.requested, "rewrite");
  assert.deepEqual(record.before, fields(original));
  assert.equal(record.afterSummary, "");
  assert.equal(redoOffer(record, written), 2);
  assert.equal(redoOffer(record, changed(written, original.id, { summary: "New." })), null);
});

test("a created chapter is remembered with nothing to put back, and the quick reply it was sent with", () => {
  const found = story([chapter(1)]);
  const created = chapter(2, { id: "chapter-new-0000", text: "A new chapter.", request: "Make it pour." });
  const written = story([...found.chapters, created]);
  const record = recordGeneration(found, {
    requested: "next",
    override: "Make it pour.",
    chapterId: created.id,
    after: created.text,
  });

  assert.equal(record.before, null);
  assert.equal(record.override, "Make it pour.");
  assert.equal(record.afterSummary, "");
  assert.equal(redoOffer(record, written), 2);
});

test("Redo is withdrawn once the chapter or its summary is edited, it is deleted or no longer last, and in another story", () => {
  const found = story([chapter(1)]);
  const created = chapter(2, { id: "chapter-new-0000", text: "A new chapter." });
  const written = story([...found.chapters, created]);
  const record = recordGeneration(found, { requested: "next", chapterId: created.id, after: created.text });
  assert.equal(redoOffer(record, written), 2);

  assert.equal(redoOffer(null, written), null);
  assert.equal(redoOffer(record, null), null);
  assert.equal(redoOffer(record, changed(written, created.id, { text: "A new chapter. Mine." })), null);
  assert.equal(redoOffer(record, found), null);
  assert.equal(redoOffer(record, story([...written.chapters, chapter(3)])), null);
  assert.equal(redoOffer(record, story(written.chapters, "story-2")), null);
  // A summary written afterwards is the author's too, and Redo would delete it with the chapter.
  assert.equal(redoOffer(record, changed(written, created.id, { summary: "Summary." })), null);

  // A continued chapter the author has started a chapter after: Write would now write that one, not this one.
  const continued = recordGeneration(found, {
    requested: "continue",
    chapterId: "chapter-1-0000",
    after: "Chapter 1 text.",
  });
  assert.equal(redoOffer(continued, found), 1);
  assert.equal(redoOffer(continued, story([...found.chapters, chapter(2)])), null);
});
