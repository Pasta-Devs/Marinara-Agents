// Apply terminal punctuation to both saved new labels and legacy labels at display time.
export function forgeChoiceLabel(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /[.!?。！？…؟।॥][\s\p{Pf}\p{Pe}"']*$/u.test(text)) return text;
  const core = text.replace(/[\s\p{Pf}\p{Pe}"']+$/u, "");
  return text + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(core) ? "。" : ".");
}
