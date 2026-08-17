import {
  type LtmDraftSource,
  type LtmSection,
  type LtmSectionContribution,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { uniqueStrings } from "./ltm-utils.js";

function contributionFields(section: LtmSection) {
  const { contributions: _contributions, ...fields } = section;
  return fields;
}

export function manualContribution(section: LtmSection): LtmSectionContribution {
  return { owner: "manual", ...contributionFields(section) };
}

export function sourceContribution(section: LtmSection, source: LtmDraftSource): LtmSectionContribution {
  if (!source.sourceNoteId || !source.sourceHash)
    throw new Error("Source-backed sections require source identity and hash.");
  return {
    owner: "source",
    sourceNoteId: source.sourceNoteId,
    sourceHash: source.sourceHash,
    ...contributionFields(section),
  };
}

export function sectionContributions(section: LtmSection) {
  return section.contributions?.length ? section.contributions : [manualContribution(section)];
}

export function renderSectionContributions(
  contributions: LtmSectionContribution[],
  additive: boolean,
): LtmSection | null {
  if (!contributions.length) return null;
  const manual = contributions.filter((contribution) => contribution.owner === "manual");
  const rendered = additive
    ? [
        ...contributions.filter((contribution) => contribution.owner === "source"),
        ...(manual.length ? [manual.at(-1)!] : []),
      ]
    : manual.length
      ? [manual.at(-1)!]
      : [contributions.at(-1)!];
  const latest = [...rendered].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).at(-1)!;
  let text = "";
  if (additive) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const contribution of rendered)
      for (const line of contribution.text.split(/\n{2,}|\r?\n/)) {
        const trimmed = line.trim();
        const normalized = trimmed.toLocaleLowerCase().replace(/\s+/g, " ");
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        lines.push(trimmed);
      }
    text = lines.join("\n\n");
  } else text = latest.text.trim();
  const salience = rendered.flatMap((item) => item.salience ?? []).sort((a, b) => b - a)[0];
  const confidence = rendered.flatMap((item) => item.confidence ?? []).sort((a, b) => b - a)[0];
  const importance = (["critical", "major", "moderate", "minor"] as const).find((value) =>
    rendered.some((item) => item.importance === value),
  );
  const evidence = uniqueStrings(contributions.flatMap((item) => item.evidence ?? [])).slice(0, 100);
  return {
    text,
    updatedAt: latest.updatedAt,
    ...(salience !== undefined ? { salience } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(importance ? { importance } : {}),
    ...(latest.dimensions ? { dimensions: latest.dimensions } : {}),
    ...(latest.dimensionChanges ? { dimensionChanges: latest.dimensionChanges } : {}),
    ...(evidence.length ? { evidence } : {}),
    contributions,
  };
}
