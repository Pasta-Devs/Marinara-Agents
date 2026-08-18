import type { LtmNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmActiveKeywords,
  getLtmKeywordIntent,
  ltmKeywordKey,
} from "../../../../shared/src/features/agents/long-term-memory/keywords.js";

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const SENTENCE_SPLIT_PATTERN = /[.!?\n\r]+/;
const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
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
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "me",
  "more",
  "most",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
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
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

const MAX_NOTE_KEYWORDS = 30;

export function normalizeKeywordToken(token: string) {
  const normalized = token
    .toLocaleLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 3) return null;
  if (/^\d+$/.test(normalized)) return null;
  if (STOP_WORDS.has(normalized)) return null;
  return normalized;
}

function tokenizeKeywordText(text: string) {
  return Array.from(text.matchAll(TOKEN_PATTERN), (match) => normalizeKeywordToken(match[0]!)).filter(
    (token): token is string => Boolean(token),
  );
}

function normalizePhrase(value: string) {
  const tokens = tokenizeKeywordText(value);
  if (tokens.length === 0) return null;
  return tokens.join(" ");
}

function collectPhrases(tokens: string[]) {
  const phrases: string[] = [];
  for (let size = 1; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const slice = tokens.slice(index, index + size);
      if (slice.length !== size) continue;
      if (slice.every((token) => STOP_WORDS.has(token))) continue;
      const phrase = slice.join(" ");
      if (phrase.length < 3 || /^\d+$/.test(phrase.replace(/\s+/g, ""))) continue;
      phrases.push(phrase);
    }
  }
  return phrases;
}

export function normalizeKeywordTerms(text: string) {
  const normalized = new Set<string>();
  for (const token of tokenizeKeywordText(text)) normalized.add(token);
  return [...normalized];
}

export function mergeKeywords(primary: string[], secondary: string[], maxTotal: number) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const keyword of [...primary, ...secondary]) {
    const normalized = normalizePhrase(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
    if (merged.length >= maxTotal) break;
  }

  return merged;
}

export function extractKeywordsTfIdf(text: string, maxKeywords: number) {
  const sentences = text
    .split(SENTENCE_SPLIT_PATTERN)
    .map((part) => tokenizeKeywordText(part))
    .filter((tokens) => tokens.length > 0);
  if (sentences.length === 0) return [];

  const documentFrequency = new Map<string, number>();
  const termFrequency = new Map<string, number>();
  const firstSeenOrder = new Map<string, number>();

  sentences.forEach((tokens, sentenceIndex) => {
    const seenInSentence = new Set<string>();
    for (const phrase of collectPhrases(tokens)) {
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

export function extractNoteKeywords(note: LtmNote) {
  const noteText = noteTextForKeywordExtraction(note);
  const tfIdfKeywords = noteText ? extractKeywordsTfIdf(noteText, MAX_NOTE_KEYWORDS) : [];
  const suppressed = new Set(
    getLtmKeywordIntent(note)
      .suppressed.map(normalizePhrase)
      .filter((keyword): keyword is string => Boolean(keyword)),
  );
  return mergeKeywords(
    getLtmActiveKeywords(note),
    tfIdfKeywords.filter((keyword) => !suppressed.has(normalizePhrase(keyword))),
    MAX_NOTE_KEYWORDS,
  );
}
