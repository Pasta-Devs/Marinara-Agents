import type {
  LtmDraftMutation,
  LtmDraftReviewMutation,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type AmbiguousLinkDiagnostic = LtmDraftReviewMutation["diagnostics"][number];
export type AmbiguousLinkDetails = NonNullable<ReturnType<typeof ambiguousLinkDetails>>;

export function ambiguousLinkDetails(diagnostic: AmbiguousLinkDiagnostic) {
  if (diagnostic.code !== "ambiguous_subject_link_target") return null;
  const details = diagnostic.details as {
    linkTarget?: string;
    linkRelation?: string;
    candidateTargetNoteIds?: string[];
  };
  if (!details.linkTarget || !details.linkRelation || !details.candidateTargetNoteIds?.length) return null;
  return details;
}

export function replaceAmbiguousLinkTarget(mutation: LtmDraftMutation, details: AmbiguousLinkDetails, target: string) {
  if (mutation.kind === "create_note") {
    return {
      ...mutation,
      note: {
        ...mutation.note,
        links: mutation.note.links.map((link) =>
          link.target === details.linkTarget && link.relation === details.linkRelation ? { ...link, target } : link,
        ),
      },
    };
  }
  if (mutation.kind === "add_link") {
    return mutation.link.target === details.linkTarget && mutation.link.relation === details.linkRelation
      ? { ...mutation, link: { ...mutation.link, target } }
      : mutation;
  }
  return mutation;
}

/**
 * Current select value for an ambiguous-link diagnostic, or null when the
 * control cannot represent the mutation state (diagnostic gone, link removed,
 * or a target outside the candidate set) and must not render.
 */
export function ambiguousLinkChoiceTarget(
  mutation: LtmDraftMutation,
  diagnostic: AmbiguousLinkDiagnostic,
): string | null {
  const details = ambiguousLinkDetails(diagnostic);
  if (!details) return null;
  const targets = new Set([details.linkTarget, ...details.candidateTargetNoteIds]);
  if (mutation.kind === "create_note") {
    const matches = mutation.note.links.filter(
      (link) => link.relation === details.linkRelation && targets.has(link.target),
    );
    return matches.length === 1 ? matches[0].target : null;
  }
  if (mutation.kind === "add_link") {
    return mutation.link.relation === details.linkRelation && targets.has(mutation.link.target)
      ? mutation.link.target
      : null;
  }
  return null;
}
