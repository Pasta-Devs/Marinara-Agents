/**
 * The canon anchor editor's text form: one entry per line, so a player can correct an extraction
 * in plain textareas. People are "Name — relation", routine blocks are "HH:MM activity".
 */
export type SlpCanonAnchors = {
  people: { name: string; relation: string }[];
  places: string[];
  work: string[];
  objects: string[];
  habits: string[];
  runningJokes: string[];
  palette: Record<string, number>;
  heat: { min: number; max: number };
  routine?: { time: string; activity: string }[];
};

export type SlpCanonAnchorDraft = Record<
  "people" | "places" | "work" | "objects" | "habits" | "runningJokes" | "routine",
  string
> & { heatMin: number; heatMax: number };

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function slpCanonAnchorDraft(anchors: SlpCanonAnchors | null): SlpCanonAnchorDraft {
  return {
    people: (anchors?.people ?? [])
      .map((person) => (person.relation ? `${person.name} — ${person.relation}` : person.name))
      .join("\n"),
    places: (anchors?.places ?? []).join("\n"),
    work: (anchors?.work ?? []).join("\n"),
    objects: (anchors?.objects ?? []).join("\n"),
    habits: (anchors?.habits ?? []).join("\n"),
    runningJokes: (anchors?.runningJokes ?? []).join("\n"),
    routine: (anchors?.routine ?? []).map((block) => `${block.time} ${block.activity}`).join("\n"),
    heatMin: anchors?.heat.min ?? 0,
    heatMax: anchors?.heat.max ?? 1,
  };
}

/** Back to anchors. The palette is not edited here, so the stored one is kept. */
export function slpCanonAnchorsFromDraft(draft: SlpCanonAnchorDraft, palette: Record<string, number>): SlpCanonAnchors {
  const heatMin = Math.min(3, Math.max(0, draft.heatMin));
  return {
    people: lines(draft.people).map((line) => {
      const [name, ...relation] = line.split(/\s+[—–-]\s+/u);
      return { name: name!.trim(), relation: relation.join(" - ").trim() };
    }),
    places: lines(draft.places),
    work: lines(draft.work),
    objects: lines(draft.objects),
    habits: lines(draft.habits),
    runningJokes: lines(draft.runningJokes),
    palette,
    heat: { min: heatMin, max: Math.max(heatMin, Math.min(3, draft.heatMax)) },
    routine: lines(draft.routine).flatMap((line) => {
      const match = /^(\d{1,2}:\d{2})\s+(.+)$/u.exec(line);
      return match ? [{ time: match[1]!, activity: match[2]!.trim() }] : [];
    }),
  };
}
