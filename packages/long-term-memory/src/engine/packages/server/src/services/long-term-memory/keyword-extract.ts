import type { LtmNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { getLtmKeywordIntent } from "../../../../shared/src/features/agents/long-term-memory/keywords.js";

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const SENTENCE_SPLIT_PATTERN = /[.!?\n\r]+/;
const STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "ago",
  "all",
  "also",
  "although",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "despite",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "either",
  "even",
  "ever",
  "every",
  "few",
  "fine",
  "for",
  "from",
  "further",
  "got",
  "going",
  "had",
  "has",
  "have",
  "having",
  "he",
  "hence",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "however",
  "i",
  "i'd",
  "i'll",
  "i'm",
  "i've",
  "if",
  "in",
  "instead",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "later",
  "may",
  "me",
  "might",
  "more",
  "most",
  "must",
  "my",
  "myself",
  "need",
  "neither",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "often",
  "okay",
  "on",
  "once",
  "only",
  "or",
  "other",
  "otherwise",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "rather",
  "really",
  "recently",
  "said",
  "same",
  "shall",
  "she",
  "should",
  "so",
  "some",
  "sometimes",
  "soon",
  "such",
  "sure",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "thus",
  "to",
  "too",
  "under",
  "unless",
  "until",
  "up",
  "usually",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "whereas",
  "whether",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "yes",
  "you",
  "you're",
  "you've",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

const MAX_NOTE_KEYWORDS = 30;

/** Lowercase and strip edge punctuation, plus normalize curly apostrophes so
 * `don’t` and `don't` collapse to the same keyword. */
function normalizeStopWordCandidate(token: string) {
  return token
    .toLocaleLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds the user-configured stop-word set used to block recall triggering.
 * Each entry contributes its normalized whole phrase (so a hyphenated entry
 * such as `cobalt-moon` blocks the collapsed token `cobalt moon`) plus every
 * token found on `TOKEN_PATTERN` boundaries (so multi-word, hyphenated or
 * punctuated entries cannot silently become dead configuration).
 */
export function buildStopWordSet(extra?: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>();
  for (const word of extra ?? []) {
    const normalized = normalizeStopWordCandidate(word);
    if (!normalized) continue;
    set.add(normalized);
    for (const match of normalized.matchAll(TOKEN_PATTERN)) {
      const token = normalizeStopWordCandidate(match[0]!);
      if (token) set.add(token);
    }
  }
  return set;
}

function isStopWord(token: string, extraStopWords?: ReadonlySet<string>) {
  return STOP_WORDS.has(token) || (extraStopWords?.has(token) ?? false);
}

export function normalizeKeywordToken(token: string, extraStopWords?: ReadonlySet<string>) {
  const normalized = normalizeStopWordCandidate(token);
  if (normalized.length < 3) return null;
  if (/^\d+$/.test(normalized)) return null;
  if (isStopWord(normalized, extraStopWords)) return null;
  if (normalized.split(" ").some((part) => isStopWord(part, extraStopWords))) return null;
  return normalized;
}

function tokenizeKeywordText(text: string, extraStopWords?: ReadonlySet<string>) {
  return Array.from(text.matchAll(TOKEN_PATTERN), (match) => normalizeKeywordToken(match[0]!, extraStopWords)).filter(
    (token): token is string => Boolean(token),
  );
}

function normalizePhrase(value: string, extraStopWords?: ReadonlySet<string>) {
  const tokens = tokenizeKeywordText(value, extraStopWords);
  if (tokens.length === 0) return null;
  return tokens.join(" ");
}

function collectPhrases(tokens: string[], extraStopWords?: ReadonlySet<string>) {
  const phrases: string[] = [];
  for (let size = 1; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const slice = tokens.slice(index, index + size);
      if (slice.length !== size) continue;
      if (slice.every((token) => isStopWord(token, extraStopWords))) continue;
      const phrase = slice.join(" ");
      if (phrase.length < 3 || /^\d+$/.test(phrase.replace(/\s+/g, ""))) continue;
      phrases.push(phrase);
    }
  }
  return phrases;
}

export function normalizeKeywordTerms(text: string, extraStopWords?: ReadonlySet<string>) {
  const normalized = new Set<string>();
  for (const token of tokenizeKeywordText(text, extraStopWords)) normalized.add(token);
  return [...normalized];
}

export function mergeKeywords(
  primary: string[],
  secondary: string[],
  maxTotal: number,
  extraStopWords?: ReadonlySet<string>,
) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const keyword of [...primary, ...secondary]) {
    const normalized = normalizePhrase(keyword, extraStopWords);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
    if (merged.length >= maxTotal) break;
  }

  return merged;
}

export function extractKeywordsTfIdf(text: string, maxKeywords: number, extraStopWords?: ReadonlySet<string>) {
  const sentences = text
    .split(SENTENCE_SPLIT_PATTERN)
    .map((part) => tokenizeKeywordText(part, extraStopWords))
    .filter((tokens) => tokens.length > 0);
  if (sentences.length === 0) return [];

  const documentFrequency = new Map<string, number>();
  const termFrequency = new Map<string, number>();
  const firstSeenOrder = new Map<string, number>();

  sentences.forEach((tokens, sentenceIndex) => {
    const seenInSentence = new Set<string>();
    for (const phrase of collectPhrases(tokens, extraStopWords)) {
      termFrequency.set(phrase, (termFrequency.get(phrase) ?? 0) + 1);
      if (!firstSeenOrder.has(phrase)) firstSeenOrder.set(phrase, sentenceIndex);
      if (seenInSentence.has(phrase)) continue;
      seenInSentence.add(phrase);
      documentFrequency.set(phrase, (documentFrequency.get(phrase) ?? 0) + 1);
    }
  });

  return [...termFrequency.entries()]
    .map(([phrase, tf]) => {
      const df = documentFrequency.get(phrase) ?? 1;
      const idf = Math.log(1 + sentences.length / df);
      const termCount = phrase.split(" ").length;
      const lengthBoost = termCount === 1 ? 1 : termCount === 2 ? 1.2 : 1.3;
      return {
        phrase,
        score: tf * idf * lengthBoost,
        order: firstSeenOrder.get(phrase) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort(
      (left, right) => right.score - left.score || left.order - right.order || left.phrase.localeCompare(right.phrase),
    )
    .map((entry) => entry.phrase)
    .filter((phrase, index, list) => list.findIndex((candidate) => candidate === phrase) === index)
    .slice(0, maxKeywords);
}

function noteTextForKeywordExtraction(note: LtmNote) {
  return Object.values(note.sections)
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Combines stored and text-derived keywords for one note.
 *
 * `extraStopWords` (the user's custom list) filters only the generated side —
 * the note's stored generated keywords and the text-derived TF-IDF keywords.
 * Manual keywords are merged without that filter so a configured stop word
 * never removes a user-owned keyword. Built-in stop words still apply to every
 * side, as they always have.
 */
export function extractNoteKeywords(note: LtmNote, extraStopWords?: ReadonlySet<string>) {
  const noteText = noteTextForKeywordExtraction(note);
  const tfIdfKeywords = noteText ? extractKeywordsTfIdf(noteText, MAX_NOTE_KEYWORDS, extraStopWords) : [];
  const { generated, manual, suppressed } = getLtmKeywordIntent(note);
  const suppressedKeys = new Set(
    suppressed.map((keyword) => normalizePhrase(keyword)).filter((keyword): keyword is string => Boolean(keyword)),
  );
  const keep = (keyword: string) => {
    const normalized = normalizePhrase(keyword);
    return normalized !== null && !suppressedKeys.has(normalized);
  };
  const generatedKeywords = mergeKeywords(
    generated.filter(keep),
    tfIdfKeywords.filter(keep),
    MAX_NOTE_KEYWORDS,
    extraStopWords,
  );
  const manualKeywords = mergeKeywords(manual.filter(keep), [], MAX_NOTE_KEYWORDS);
  return mergeKeywords(manualKeywords, generatedKeywords, MAX_NOTE_KEYWORDS);
}
