import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultStorySettings,
  type StoryChapter,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/model.ts";
import {
  anchorIndex,
  anchorText,
  htmlToMarkdown,
  markdownBlockTexts,
  markdownBlocks,
  markdownToHtml,
  markdownToPlainText,
  type MarkdownNode,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/markdown.ts";
import {
  storyFileName,
  storyToMarkdown,
  storyToPlainText,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/export.ts";

interface FakeNode extends MarkdownNode {
  childNodes: FakeNode[];
}

function element(name: string, children: Array<FakeNode | string> = []): FakeNode {
  return {
    nodeType: 1,
    nodeName: name.toUpperCase(),
    childNodes: children.map((child) => (typeof child === "string" ? textNode(child) : child)),
    textContent: null,
  };
}

function textNode(value: string): FakeNode {
  return { nodeType: 3, nodeName: "#text", childNodes: [], textContent: value };
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };

/** Just enough of an HTML parser for the tags markdownToHtml writes. */
function parseHtml(html: string): FakeNode {
  const root = element("div");
  const stack = [root];
  for (const match of html.matchAll(/<(\/?)([a-z0-9]+)>|([^<]+)/gi)) {
    const top = stack[stack.length - 1]!;
    if (match[3] !== undefined) {
      top.childNodes.push(textNode(match[3].replace(/&(?:lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity]!)));
      continue;
    }
    if (match[1]) {
      stack.pop();
      continue;
    }
    const name = match[2]!.toLowerCase();
    const node = element(name);
    top.childNodes.push(node);
    if (name !== "br" && name !== "hr") stack.push(node);
  }
  return root;
}

test("text is escaped before any tag is added, so raw HTML never passes through", () => {
  assert.equal(
    markdownToHtml(`<script>alert("x")</script> & 'q'`),
    "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;</p>",
  );
  const hostile = markdownToHtml('# <img src=x onerror="alert(1)">\n\n> <iframe>\n\n**<b>bold</b>**');
  assert.doesNotMatch(hostile, /<(?:img|iframe|b)[\s>]/);
  assert.equal(
    hostile,
    "<h1>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</h1><blockquote><p>&lt;iframe&gt;</p></blockquote>" +
      "<p><strong>&lt;b&gt;bold&lt;/b&gt;</strong></p>",
  );
});

test("headings, scene breaks, blockquotes and line breaks", () => {
  assert.equal(
    markdownToHtml("# One\n## Two\n### Three ###\n#### Four"),
    "<h1>One</h1><h2>Two</h2><h3>Three</h3><p>#### Four</p>",
  );
  assert.equal(markdownToHtml("#hashtag"), "<p>#hashtag</p>");
  for (const rule of ["***", "---", "* * *", "___", "  - - -  "]) {
    assert.equal(markdownToHtml(`Before\n${rule}\nAfter`), "<p>Before</p><hr><p>After</p>", rule);
  }
  assert.equal(
    markdownToHtml("> quoted\n> more\n>\n> second\n\nafter"),
    "<blockquote><p>quoted<br>more</p><p>second</p></blockquote><p>after</p>",
  );
  assert.equal(markdownToHtml("line one\nline two\r\n\r\n\n\nnext"), "<p>line one<br>line two</p><p>next</p>");
  assert.equal(markdownToHtml(""), "");
});

test("inline bold, italics, underline and strike-through", () => {
  assert.equal(
    markdownToHtml("**bold** *italic* _also_ __under__ ~~gone~~ ***both***"),
    "<p><strong>bold</strong> <em>italic</em> <em>also</em> <u>under</u> <s>gone</s> <strong><em>both</em></strong></p>",
  );
  assert.equal(
    markdownToHtml("**bold with *italic* inside** and *italic with **bold** inside*"),
    "<p><strong>bold with <em>italic</em> inside</strong> and <em>italic with <strong>bold</strong> inside</em></p>",
  );
  // Markers that are not emphasis stay text.
  assert.equal(markdownToHtml("snake_case_name and 2 * 3 * 4"), "<p>snake_case_name and 2 * 3 * 4</p>");
  assert.equal(markdownToHtml("* not a list"), "<p>* not a list</p>");
});

test("htmlToMarkdown round-trips the rendered document", () => {
  const markdown = [
    "# The Storm",
    "It was a *dark* and **stormy** night.\nThe wind __howled__ and ~~whispered~~ roared.",
    "***",
    '> "Run," she said.\n> It was ***too late***.',
    "## Part two",
    "Plain & simple <tags> stay text.",
  ].join("\n\n");
  const html = markdownToHtml(markdown);
  assert.equal(htmlToMarkdown(parseHtml(html)), markdown);
  assert.equal(markdownToHtml(htmlToMarkdown(parseHtml(html))), html);
  // Other scene-break spellings come back as ***.
  assert.equal(htmlToMarkdown(parseHtml(markdownToHtml("a\n\n---\n\nb"))), "a\n\n***\n\nb");
});

test("htmlToMarkdown reads what a contentEditable produces", () => {
  // Typing into an empty editable: a bare text node, then Enter-made blocks, an empty line and a trailing <br>.
  const typed = element("div", [
    "First line",
    element("div", ["Second", element("br")]),
    element("div", [element("br")]),
    element("p", ["Third with", " space", element("br"), "and a break"]),
  ]);
  assert.equal(htmlToMarkdown(typed), "First line\n\nSecond\n\nThird with space\nand a break");
  // Edge spaces move outside the markers and multi-line emphasis is wrapped per line, so both parse back.
  const formatted = element("div", [
    element("p", ["A", element("em", [" spaced "]), "word ", element("b", ["one", element("br"), "two"])]),
    element("h4", ["Deep ", element("i", ["heading"])]),
    element("blockquote", [element("p", ["q1"]), element("p", [element("strike", ["q2"])])]),
    element("hr"),
    element("p", [element("u", [element("strong", ["mixed"])]), element("del", [""])]),
    element("p", ["  ", element("br")]),
  ]);
  assert.equal(
    htmlToMarkdown(formatted),
    "A *spaced* word **one**\n**two**\n\n### Deep *heading*\n\n> q1\n>\n> ~~q2~~\n\n***\n\n__**mixed**__",
  );
  assert.equal(
    markdownToHtml(htmlToMarkdown(formatted)),
    "<p>A <em>spaced</em> word <strong>one</strong><br><strong>two</strong></p><h3>Deep <em>heading</em></h3>" +
      "<blockquote><p>q1</p><p><s>q2</s></p></blockquote><hr><p><u><strong>mixed</strong></u></p>",
  );
});

test("markdownToPlainText drops the markers", () => {
  assert.equal(
    markdownToPlainText("# Title\n\n**Bold** and *it* and __u__ and ~~s~~.\n\n---\n\n> quoted\n\n\n\nend"),
    "Title\n\nBold and it and u and s.\n\n* * *\n\nquoted\n\nend",
  );
});

function exportChapter(index: number, text: string): StoryChapter {
  return {
    id: `chapter-${index}-0000`,
    storyId: "story-1",
    text,
    summary: "",
    status: "complete",
    request: "",
    createdAt: "",
    updatedAt: "",
  };
}

test("exports print the title once and each chapter under its own heading", () => {
  const story = {
    story: {
      id: "story-1",
      settings: { ...defaultStorySettings(), title: "" },
      chapterIds: [],
      wordCount: 0,
      chapterCount: 3,
      createdAt: "",
      updatedAt: "",
    },
    chapters: [
      exportChapter(1, "# The Storm\n\nIt was **dark**."),
      exportChapter(2, "   "),
      exportChapter(3, "No title here."),
    ],
  };
  assert.equal(
    storyToMarkdown(story, "Untitled story"),
    "# Untitled story\n\n## Chapter 1: The Storm\n\nIt was **dark**.\n\n## Chapter 3\n\nNo title here.\n",
  );
  assert.equal(
    storyToPlainText(story, "Untitled story", { chapterLabel: (number) => `Rozdział ${number}` }),
    "Untitled story\n\nRozdział 1: The Storm\n\nIt was dark.\n\nRozdział 3\n\nNo title here.\n",
  );
  assert.equal(storyFileName('Zażółć: "gęślą"/jaźń', "md"), "Zażółć_ _gęślą_jaźń.md");
  assert.equal(storyFileName("  ", "txt"), "story.txt");
});

test("censored words stay literal, and deep quote nesting cannot overflow the stack", () => {
  assert.equal(markdownToHtml('"What the f***?" she asked.'), "<p>&quot;What the f***?&quot; she asked.</p>");
  assert.equal(markdownToPlainText("F*** this."), "F*** this.");
  assert.equal(markdownToHtml("***a*** **b** *c*"), "<p><strong><em>a</em></strong> <strong>b</strong> <em>c</em></p>");
  const deep = `${"> ".repeat(20_000)}deep`;
  const html = markdownToHtml(deep);
  assert.equal(html.match(/<blockquote>/g)?.length, 8);
  assert.ok(html.endsWith("</blockquote>".repeat(8)));
});

test("a picture finds its paragraph again by its opening words after the text above it changes", () => {
  const text = "# The Storm\n\nIt was **dark**.\nVery dark.\n\n***\n\n> A quote\n> on two lines\n\nThe gutter sang.";
  // The blocks are the chapter body's children, in order, as markdownToHtml renders them.
  assert.equal(
    markdownBlocks(text)
      .map((block) => block.html)
      .join(""),
    markdownToHtml(text),
  );
  const texts = markdownBlockTexts(text);
  assert.deepEqual(texts, [
    "The Storm",
    "It was dark.\nVery dark.",
    "* * *",
    "A quote\non two lines",
    "The gutter sang.",
  ]);
  // A line break inside the paragraph reads the same as the DOM's text of it, which has none.
  assert.equal(anchorIndex(texts, 1, anchorText("It was dark.Very dark.")), 1);
  const anchor = anchorText(texts[4]!);
  assert.equal(anchorIndex(texts, 4, anchor), 4);
  // Two paragraphs written above it: it moves down with its paragraph.
  const moved = markdownBlockTexts(`New one.\n\nNew two.\n\n${text}`);
  assert.equal(anchorIndex(moved, 4, anchor), 6);
  // Its paragraph rewritten: it stays at the index it had, and past the end it goes to the last block.
  assert.equal(anchorIndex(markdownBlockTexts("One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.\n\nSix."), 4, anchor), 4);
  assert.equal(anchorIndex(markdownBlockTexts("One.\n\nTwo."), 4, anchor), 1);
  assert.equal(anchorIndex([], 4, anchor), -1);
  // The same opening twice: the one nearer where it was.
  assert.equal(anchorIndex(["Rain.", "x", "x", "Rain.", "x"], 4, "Rain."), 3);
});

test("a picture in the edited text never reaches the Markdown, nor splits the paragraph it was moved into", () => {
  const figure = element("figure", [element("img"), element("span", [element("button")])]);
  const body = element("div", [
    figure,
    element("p", ["Before the picture."]),
    element("p", ["Half ", element("figure", [element("img")]), "and half."]),
  ]);
  assert.equal(htmlToMarkdown(body), "Before the picture.\n\nHalf and half.");
});

test("the Markdown export shows each picture before its paragraph, after the chapter's title; plain text has none", () => {
  const picture = (id: string, paragraph: number, anchor: string, prompt: string) => ({
    id,
    image: `global-gallery:${id}`,
    url: `/api/global-gallery/file/${id}.png`,
    prompt,
    width: 896,
    height: 1152,
    paragraph,
    anchor,
  });
  const story = {
    story: {
      id: "story-1",
      settings: { ...defaultStorySettings(), title: "Pictures" },
      chapterIds: [],
      wordCount: 0,
      chapterCount: 1,
      createdAt: "",
      updatedAt: "",
    },
    chapters: [
      {
        ...exportChapter(1, "# The Storm\n\nIt was dark.\n\nThe gutter sang."),
        illustrations: [
          picture("img-1", 2, "The gutter sang.", "A gutter [singing]\nat night."),
          picture("img-2", 0, "The Storm", "A storm."),
        ],
      },
    ],
  };
  assert.equal(
    storyToMarkdown(story, "Untitled", { pictureBaseUrl: "http://127.0.0.1:7860" }),
    "# Pictures\n\n## Chapter 1: The Storm\n\n![A storm.](http://127.0.0.1:7860/api/global-gallery/file/img-2.png)\n\n" +
      "It was dark.\n\n![A gutter singing at night.](http://127.0.0.1:7860/api/global-gallery/file/img-1.png)\n\n" +
      "The gutter sang.\n",
  );
  assert.equal(
    storyToPlainText(story, "Untitled", { pictureBaseUrl: "http://127.0.0.1:7860" }),
    "Pictures\n\nChapter 1: The Storm\n\nIt was dark.\n\nThe gutter sang.\n",
  );
});
