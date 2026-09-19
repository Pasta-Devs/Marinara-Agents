import { Fragment, useMemo, useRef } from "react";
import { canManageNoodleReply, findNoodleTextMentions, type NoodleAccount } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { renderInlineWithCustomEmojis } from "../../../lib/custom-emoji-render";
import { useTranslation as useUiTranslation } from "react-i18next";

export function NoodleCustomEmojiText({
  text,
  emojiMap,
  keyPrefix,
}: {
  text: string;
  emojiMap: Map<string, string>;
  keyPrefix: string;
}) {
  return (
    <>
      {renderInlineWithCustomEmojis(text, keyPrefix, emojiMap, (segment, key) => [
        <Fragment key={key}>{segment}</Fragment>,
      ])}
    </>
  );
}

export function NoodleTextContent({
  content,
  accountByHandle,
  onOpenProfile,
  className,
}: {
  content: string;
  accountByHandle: Map<string, NoodleAccount>;
  onOpenProfile: (account: NoodleAccount) => void;
  className?: string;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const handlers = useRef({ onOpenProfile, localizeUi });
  handlers.current = { onOpenProfile, localizeUi };
  const rendered = useMemo(
    () =>
      renderNoodleMarkdown(content, {
        accountByHandle,
        onOpenProfile: (account) => handlers.current.onOpenProfile(account),
        mentionLabel: (handle) =>
          handlers.current.localizeUi("ui.noodle.noodletextcontent.viewValue1Profile", { value1: handle }),
      }),
    [content, accountByHandle, i18n.language],
  );
  return <div className={cn("text-sm [&>*+*]:mt-2", className)}>{rendered}</div>;
}

type NoodleMarkdownContext = {
  accountByHandle: Map<string, NoodleAccount>;
  onOpenProfile: (account: NoodleAccount) => void;
  mentionLabel: (handle: string) => string;
};

function renderNoodleMarkdown(content: string, context: NoodleMarkdownContext): React.ReactNode[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const parts: React.ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const marker = fence[1]![0]!;
      const minimumLength = fence[1]!.length;
      const closingFence = new RegExp(`^ {0,3}${marker}{${minimumLength},}\\s*$`);
      const codeLines: string[] = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !closingFence.test(lines[lineIndex] ?? "")) {
        codeLines.push(lines[lineIndex] ?? "");
        lineIndex += 1;
      }
      if (lineIndex < lines.length) lineIndex += 1;
      parts.push(
        <pre
          key={`code:${lineIndex}`}
          className="overflow-x-auto whitespace-pre rounded-lg bg-foreground/10 p-3 text-xs leading-5"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1]!.length;
      const headingContent = renderNoodleInlineMarkdown(heading[2]!, context, `heading:${lineIndex}`);
      const headingClass = cn(
        "break-words font-bold",
        level === 1 && "text-xl leading-7",
        level === 2 && "text-lg leading-7",
        level >= 3 && "text-base leading-6",
      );
      parts.push(
        level === 1 ? (
          <h1 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h1>
        ) : level === 2 ? (
          <h2 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h2>
        ) : level === 3 ? (
          <h3 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h3>
        ) : level === 4 ? (
          <h4 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h4>
        ) : level === 5 ? (
          <h5 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h5>
        ) : (
          <h6 key={`heading:${lineIndex}`} className={headingClass}>
            {headingContent}
          </h6>
        ),
      );
      lineIndex += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && /^ {0,3}>/.test(lines[lineIndex] ?? "")) {
        quoteLines.push((lines[lineIndex] ?? "").replace(/^ {0,3}> ?/, ""));
        lineIndex += 1;
      }
      parts.push(
        <blockquote
          key={`quote:${lineIndex}`}
          className="border-l-2 border-[var(--noodle-divider)] pl-3 text-[var(--muted-foreground)]"
        >
          {renderNoodleMarkdown(quoteLines.join("\n"), context)}
        </blockquote>,
      );
      continue;
    }

    const listMatch = line.match(/^ {0,3}(?:(\d+)[.)]|([-+*]))\s+(.+)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[1]);
      const start = ordered ? Number(listMatch[1]) : undefined;
      const items: React.ReactNode[] = [];
      while (lineIndex < lines.length) {
        const item = (lines[lineIndex] ?? "").match(/^ {0,3}(?:(\d+)[.)]|([-+*]))\s+(.+)$/);
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push(
          <li key={`item:${lineIndex}`} className="pl-1">
            {renderNoodleInlineMarkdown(item[3]!, context, `item:${lineIndex}`)}
          </li>,
        );
        lineIndex += 1;
      }
      parts.push(
        ordered ? (
          <ol key={`list:${lineIndex}`} start={start} className="list-decimal space-y-1 pl-6">
            {items}
          </ol>
        ) : (
          <ul key={`list:${lineIndex}`} className="list-disc space-y-1 pl-6">
            {items}
          </ul>
        ),
      );
      continue;
    }

    const paragraphLines = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length &&
      (lines[lineIndex] ?? "").trim() &&
      !isNoodleMarkdownBlockStart(lines[lineIndex] ?? "")
    ) {
      paragraphLines.push(lines[lineIndex] ?? "");
      lineIndex += 1;
    }
    parts.push(
      <p key={`paragraph:${lineIndex}`} className="whitespace-pre-wrap break-words">
        {renderNoodleInlineMarkdown(paragraphLines.join("\n"), context, `paragraph:${lineIndex}`)}
      </p>,
    );
  }

  return parts;
}

function isNoodleMarkdownBlockStart(line: string) {
  return /^(?: {0,3}(?:#{1,6}\s+|>|`{3,}|~{3,}|(?:(?:\d+)[.)]|[-+*])\s+))/.test(line);
}

function renderNoodleInlineMarkdown(
  text: string,
  context: NoodleMarkdownContext,
  keyPrefix: string,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let plain = "";
  let index = 0;

  const flushPlain = () => {
    if (!plain) return;
    parts.push(...renderNoodleMentionText(plain, context, `${keyPrefix}:text:${index - plain.length}`));
    plain = "";
  };

  while (index < text.length) {
    if (text[index] === "\\" && index + 1 < text.length) {
      plain += text[index + 1];
      index += 2;
      continue;
    }

    if (text[index] === "`") {
      const markerLength = text.slice(index).match(/^`+/)?.[0].length ?? 1;
      const marker = "`".repeat(markerLength);
      const end = text.indexOf(marker, index + markerLength);
      if (end >= 0) {
        flushPlain();
        parts.push(
          <code
            key={`${keyPrefix}:code:${index}`}
            className="whitespace-pre-wrap rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.9em]"
          >
            {text.slice(index + markerLength, end).replace(/\n/g, " ")}
          </code>,
        );
        index = end + markerLength;
        continue;
      }
    }

    const image = readNoodleMarkdownLabel(text, index, true);
    if (image) {
      flushPlain();
      parts.push(
        <Fragment key={`${keyPrefix}:image:${index}`}>
          {renderNoodleInlineMarkdown(image.label, context, `${keyPrefix}:image-label:${index}`)}
        </Fragment>,
      );
      index = image.end;
      continue;
    }

    const link = readNoodleMarkdownLabel(text, index, false);
    if (link) {
      flushPlain();
      parts.push(
        <Fragment key={`${keyPrefix}:link:${index}`}>
          {renderNoodleInlineMarkdown(link.label, context, `${keyPrefix}:link-label:${index}`)}
        </Fragment>,
      );
      index = link.end;
      continue;
    }

    const delimiter = text.startsWith("**", index)
      ? "**"
      : text.startsWith("__", index)
        ? "__"
        : text.startsWith("~~", index)
          ? "~~"
          : text[index] === "*" || text[index] === "_"
            ? text[index]!
            : null;
    if (delimiter) {
      const isUnderscore = delimiter === "_" || delimiter === "__";
      const openerOk = !isUnderscore || index === 0 || !isMarkdownWordChar(text[index - 1]!);
      const end = openerOk ? text.indexOf(delimiter, index + delimiter.length) : -1;
      const closerOk =
        !isUnderscore || end + delimiter.length >= text.length || !isMarkdownWordChar(text[end + delimiter.length]!);
      if (end > index + delimiter.length && closerOk) {
        flushPlain();
        const children = renderNoodleInlineMarkdown(
          text.slice(index + delimiter.length, end),
          context,
          `${keyPrefix}:format:${index}`,
        );
        parts.push(
          delimiter === "**" || delimiter === "__" ? (
            <strong key={`${keyPrefix}:strong:${index}`}>{children}</strong>
          ) : delimiter === "~~" ? (
            <del key={`${keyPrefix}:del:${index}`}>{children}</del>
          ) : (
            <em key={`${keyPrefix}:em:${index}`}>{children}</em>
          ),
        );
        index = end + delimiter.length;
        continue;
      }
    }

    plain += text[index];
    index += 1;
  }

  flushPlain();
  return parts;
}

function isMarkdownWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

function readNoodleMarkdownLabel(text: string, start: number, image: boolean): { label: string; end: number } | null {
  const labelStart = start + (image ? 2 : 1);
  if (image ? !text.startsWith("![", start) : text[start] !== "[") return null;
  let labelEnd = labelStart;
  while (labelEnd < text.length && text[labelEnd] !== "]") labelEnd += 1;
  if (labelEnd >= text.length || text[labelEnd + 1] !== "(") return null;

  let destinationEnd = labelEnd + 2;
  let depth = 1;
  while (destinationEnd < text.length && depth > 0) {
    if (text[destinationEnd] === "\\") destinationEnd += 1;
    else if (text[destinationEnd] === "(") depth += 1;
    else if (text[destinationEnd] === ")") depth -= 1;
    destinationEnd += 1;
  }
  if (depth !== 0) return null;
  return { label: text.slice(labelStart, labelEnd), end: destinationEnd };
}

function renderNoodleMentionText(text: string, context: NoodleMarkdownContext, keyPrefix: string): React.ReactNode[] {
  const mentions = findNoodleTextMentions(text);
  if (mentions.length === 0) return [text];

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const mention of mentions) {
    if (mention.start > cursor) parts.push(text.slice(cursor, mention.start));
    const label = text.slice(mention.start, mention.end);
    const account = context.accountByHandle.get(mention.handle);
    parts.push(
      account ? (
        <button
          key={`${keyPrefix}:${mention.start}:${mention.handle}`}
          type="button"
          onClick={() => context.onOpenProfile(account)}
          className="inline font-semibold text-[var(--noodle-accent)] hover:underline focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
          aria-label={context.mentionLabel(account.handle)}
        >
          {label}
        </button>
      ) : (
        label
      ),
    );
    cursor = mention.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
