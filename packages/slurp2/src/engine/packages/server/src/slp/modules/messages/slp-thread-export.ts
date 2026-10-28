/**
 * A DM thread as plain text, to paste into a lorebook or a memory agent (docs/FEEDBACK-2026-10.md
 * R10), and the prompt that sums one up. Pure. The messages arrive already masked for the side
 * that asks, so a locked picture's words never reach the transcript.
 */
type Line = {
  role: "viewer" | "creator";
  kind: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  senderSnapshot: Record<string, unknown>;
};

/** Enough for a long relationship; a summary of more than this reads the newest part. */
export const SLURP_EXPORT_MAX_MESSAGES = 2000;
/** What the summary prompt reads, from the end (about 30k tokens). */
const SUMMARY_MAX_CHARS = 120_000;

export function slurpThreadTranscript(lines: readonly Line[], names: { viewer: string; creator: string }): string {
  return lines
    .map((line) => {
      const fallback = line.role === "creator" ? names.creator : names.viewer;
      const name = typeof line.senderSnapshot.displayName === "string" ? line.senderSnapshot.displayName : fallback;
      const picture = line.imageUrl ? "[picture]" : line.kind === "ppv" ? "[locked picture]" : "";
      const text = [line.content.trim(), picture].filter(Boolean).join(" ");
      return text ? `[${line.createdAt.slice(0, 16).replace("T", " ")}] ${name}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function slurpThreadSummaryMessages(transcript: string, names: { viewer: string; creator: string }) {
  const tail = transcript.length > SUMMARY_MAX_CHARS ? transcript.slice(-SUMMARY_MAX_CHARS) : transcript;
  return [
    {
      role: "system" as const,
      content: [
        `Summarize the direct messages between ${names.viewer} and ${names.creator} for a lorebook or long-term memory entry.`,
        "Write plain prose in the third person, past tense, in the language the messages use. Keep names exactly as written.",
        "Cover: how they know each other and how the relationship changed, the facts each one shared about themselves, promises, plans and things still open, inside jokes and nicknames, and the current mood between them.",
        "Leave out greetings, small talk and anything said only once in passing. No headings, no lists, no commentary. At most 300 words.",
      ].join("\n"),
    },
    { role: "user" as const, content: tail },
  ];
}
