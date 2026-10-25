// Apply terminal punctuation to both saved new labels and legacy labels at display time.
export function forgeChoiceLabel(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[.!?。！？…؟।॥][\s\p{Pf}"')\]]*$/u.test(text)) return text;
  return text + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(text) ? "。" : ".");
}
