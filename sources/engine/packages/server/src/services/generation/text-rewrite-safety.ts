function hasHtmlOrXmlTag(text: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(text);
}

function hasFencedBlock(text: string): boolean {
  return /```/.test(text);
}

export function textRewriteDropsProtectedMarkup(original: string | null | undefined, edited: string): boolean {
  if (!original) return false;

  const originalHasTags = hasHtmlOrXmlTag(original);
  const originalHasFences = hasFencedBlock(original);
  if (!originalHasTags && !originalHasFences) return false;

  return (originalHasTags && !hasHtmlOrXmlTag(edited)) || (originalHasFences && !hasFencedBlock(edited));
}
