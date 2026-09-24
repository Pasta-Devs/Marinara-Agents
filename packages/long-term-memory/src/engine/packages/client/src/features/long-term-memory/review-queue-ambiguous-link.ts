import type {
  LtmDraftMutation,
  LtmDraftReviewMutation,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type AmbiguousLinkDiagnostic = LtmDraftReviewMutation["diagnostics"][number];
export type AmbiguousLinkDetails = NonNullable<ReturnType<typeof ambiguousLinkDetails>>;

export function ambiguousLinkUnresolvedChoiceValue(details: AmbiguousLinkDetails) {
  let value = `\u0000unresolved:${details.linkRelation}:${details.linkTarget}`;
  while ([details.linkTarget, ...details.candidateTargetNoteIds].includes(value)) value += "\u0000";
  return value;
}

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
  const nextTarget = target === ambiguousLinkUnresolvedChoiceValue(details) ? details.linkTarget : target;
  const isAmbiguousTarget = (candidate: string) =>
    candidate === details.linkTarget || details.candidateTargetNoteIds.includes(candidate);
  if (mutation.kind === "create_note") {
    return {
      ...mutation,
      note: {
        ...mutation.note,
        links: mutation.note.links.map((link) =>
          isAmbiguousTarget(link.target) && link.relation === details.linkRelation
            ? { ...link, target: nextTarget }
            : link,
        ),
      },
    };
  }
  if (mutation.kind === "add_link") {
    return isAmbiguousTarget(mutation.link.target) && mutation.link.relation === details.linkRelation
      ? { ...mutation, link: { ...mutation.link, target: nextTarget } }
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
  explicitTarget?: string,
): string | null {
  const details = ambiguousLinkDetails(diagnostic);
  if (!details) return null;
  const targets = new Set([details.linkTarget, ...details.candidateTargetNoteIds]);
  if (explicitTarget && details.candidateTargetNoteIds.includes(explicitTarget)) return explicitTarget;
  if (mutation.kind === "create_note") {
    const matches = mutation.note.links.filter(
      (link) => link.relation === details.linkRelation && targets.has(link.target),
    );
    if (matches.length !== 1) return null;
    return matches[0].target === details.linkTarget ? ambiguousLinkUnresolvedChoiceValue(details) : matches[0].target;
  }
  if (mutation.kind === "add_link") {
    if (mutation.link.relation !== details.linkRelation || !targets.has(mutation.link.target)) return null;
    return mutation.link.target === details.linkTarget
      ? ambiguousLinkUnresolvedChoiceValue(details)
      : mutation.link.target;
  }
  return null;
}
