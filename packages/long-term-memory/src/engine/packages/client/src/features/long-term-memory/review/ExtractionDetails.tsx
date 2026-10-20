import { type LtmDraftReviewDraft } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { humanizeLabel } from "../display-labels";
import { useLtmTranslation } from "../localization";

const diagnosticCategoryKeys: Record<string, string> = {
  source_backed_npc_identity: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  subject_identity_corrected: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  subject_identity_normalized: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  borrowed_subject_identity: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  low_lexical_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  missing_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  missing_source_note_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  resolved_thread_missing_fanout: "ui.longTermMemory.extractiondetails.resolvedThreadHandling",
  relationship_state_missing_caused_by: "ui.longTermMemory.extractiondetails.resolvedThreadHandling",
  ambiguous_subject_link_target: "ui.longTermMemory.extractiondetails.identityTargetHandling",
  unknown_link_target: "ui.longTermMemory.extractiondetails.identityTargetHandling",
  target_note_identity_variant: "ui.longTermMemory.extractiondetails.identityTargetHandling",
  target_note_scoped_variant: "ui.longTermMemory.extractiondetails.identityTargetHandling",
};

export function hasExtractionDetails(item: LtmDraftReviewDraft) {
  return (
    Boolean(item.draft.accounting) ||
    item.diagnostics.some((diagnostic) => diagnostic.code !== "deduplicated_evidence_unit") ||
    item.deduplications.length > 0
  );
}

export function ExtractionDetails({
  item,
  humanizeText,
}: {
  item: LtmDraftReviewDraft;
  humanizeText: (text: string) => string;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const accounting = item.draft.accounting;
  const diagnostics = item.diagnostics.filter((diagnostic) => diagnostic.code !== "deduplicated_evidence_unit");
  const diagnosticsByCategory = new Map<string, typeof diagnostics>();
  for (const diagnostic of diagnostics) {
    const category = diagnosticCategoryKeys[diagnostic.code] ?? "ui.longTermMemory.extractiondetails.otherWarnings";
    diagnosticsByCategory.set(category, [...(diagnosticsByCategory.get(category) ?? []), diagnostic]);
  }
  if (!hasExtractionDetails(item)) return null;

  return (
    <section data-ltm-extraction-details className="mari-editor-panel space-y-3 p-3 text-xs">
      <header className="border-b border-[var(--border)] pb-3">
        <h2 className="font-semibold">{localizeUi("ui.longTermMemory.extractiondetails.extractionDetails")}</h2>
        {accounting ? (
          <p className="mt-1 text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.extractiondetails.value1KeptValue2RejectedValue3Deduplicated", {
              value1: accounting.keptUnits,
              value2: accounting.parserRejections + accounting.validationRejections,
              value3: accounting.deduplications,
            })}
          </p>
        ) : null}
      </header>
      <div className="space-y-3 text-[var(--muted-foreground)]">
        {accounting ? (
          <p data-ltm-extraction-accounting>
            {accounting.providerCandidates} {localizeUi("ui.longTermMemory.extractiondetails.providerCandidates")}{" "}
            {accounting.normalizedAdditions} {localizeUi("ui.longTermMemory.extractiondetails.normalizedAdditions")}{" "}
            {accounting.keptUnits} {localizeUi("ui.longTermMemory.extractiondetails.kept")}{" "}
            {accounting.parserRejections} {localizeUi("ui.longTermMemory.extractiondetails.parserRejected")}{" "}
            {accounting.validationRejections} {localizeUi("ui.longTermMemory.extractiondetails.validationRejectedAnd")}{" "}
            {accounting.deduplications} {localizeUi("ui.longTermMemory.extractiondetails.deduplicated")}
          </p>
        ) : null}
        {item.deduplications.length ? (
          <details data-ltm-deduplications className="space-y-1">
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.deduplications")} ( {item.deduplications.length} )
            </summary>
            <div className="mt-2 space-y-1">
              {item.deduplications.map((diagnostic, index) => (
                <p key={`${diagnostic.code}-${index}`}>{humanizeText(diagnostic.message)}</p>
              ))}
            </div>
          </details>
        ) : null}
        {diagnostics.length ? (
          <details data-ltm-draft-diagnostics>
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.advancedExtractionDetails")}
            </summary>
            <div className="mt-2 space-y-2">
              {[...diagnosticsByCategory].map(([category, entries]) => (
                <details key={category}>
                  <summary className="cursor-pointer font-medium">
                    {localizeUi(category)} ({entries.length})
                  </summary>
                  <div className="mt-1 space-y-1 pl-3">
                    {entries.map((diagnostic, index) => (
                      <p key={`${diagnostic.code}-${index}`}>
                        {humanizeLabel(diagnostic.code)}: {humanizeText(diagnostic.message)}
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
