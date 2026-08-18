import type { LtmNote } from "./schema.js";

type LtmKeywordNote = Pick<LtmNote, "keywords"> & Partial<Pick<LtmNote, "manualKeywords" | "suppressedKeywords">>;

export function ltmKeywordKey(keyword: string) {
  return keyword.trim().toLowerCase();
}

export function uniqueLtmKeywords(keywords: readonly string[]) {
  const seen = new Set<string>();
  return keywords.flatMap((keyword) => {
    const value = keyword.trim();
    const key = ltmKeywordKey(value);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

export function getLtmKeywordIntent(note: LtmKeywordNote) {
  // Legacy keywords predate origin tracking, so keep them user-editable.
  if (note.manualKeywords === undefined) {
    return {
      generated: [],
      manual: uniqueLtmKeywords(note.keywords),
      suppressed: [],
    };
  }
  return {
    generated: uniqueLtmKeywords(note.keywords),
    manual: uniqueLtmKeywords(note.manualKeywords),
    suppressed: uniqueLtmKeywords(note.suppressedKeywords ?? []),
  };
}

export function getLtmActiveKeywords(note: LtmKeywordNote) {
  const { generated, manual, suppressed } = getLtmKeywordIntent(note);
  const suppressedKeys = new Set(suppressed.map(ltmKeywordKey));
  return uniqueLtmKeywords([...generated, ...manual]).filter((keyword) => !suppressedKeys.has(ltmKeywordKey(keyword)));
}

export function normalizeLtmKeywordIntent(note: LtmKeywordNote) {
  const { generated, manual, suppressed } = getLtmKeywordIntent(note);
  return {
    keywords: generated,
    manualKeywords: manual,
    suppressedKeywords: suppressed,
  };
}

export function setLtmManualKeywords(note: LtmKeywordNote, keywords: readonly string[]) {
  const { generated, suppressed } = getLtmKeywordIntent(note);
  const generatedKeys = new Set(generated.map(ltmKeywordKey));
  const requested = uniqueLtmKeywords(keywords);
  const requestedKeys = new Set(requested.map(ltmKeywordKey));
  return {
    keywords: generated,
    manualKeywords: requested.filter((keyword) => !generatedKeys.has(ltmKeywordKey(keyword))),
    suppressedKeywords: suppressed.filter((keyword) => !requestedKeys.has(ltmKeywordKey(keyword))),
  };
}

export function removeLtmKeyword(note: LtmKeywordNote, keyword: string) {
  const { generated, manual, suppressed } = getLtmKeywordIntent(note);
  const key = ltmKeywordKey(keyword);
  const generatedKeyword = generated.find((value) => ltmKeywordKey(value) === key);
  return {
    keywords: generated,
    manualKeywords: manual.filter((value) => ltmKeywordKey(value) !== key),
    suppressedKeywords: generatedKeyword ? uniqueLtmKeywords([...suppressed, generatedKeyword]) : suppressed,
  };
}
