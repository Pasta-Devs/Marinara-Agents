import type {
  LtmGraphIndex,
  LtmNote,
  LtmNoteType,
  LtmMemoryChunk,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";

export function buildLtmGraphIndex(notes: LtmNote[], chunks: LtmMemoryChunk[]): LtmGraphIndex {
  const chunkIdsByNote = new Map<string, string[]>();
  for (const chunk of chunks) {
    const ids = chunkIdsByNote.get(chunk.noteId) ?? [];
    ids.push(chunk.id);
    chunkIdsByNote.set(chunk.noteId, ids);
  }

  const nodes: LtmGraphIndex["nodes"] = {};
  const liveNoteIds = new Set(chunks.map((chunk) => chunk.noteId));
  const liveNotes = notes.filter((note) => liveNoteIds.has(note.id));

  for (const note of liveNotes.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    nodes[note.id] = {
      chunkIds: (chunkIdsByNote.get(note.id) ?? []).sort((a, b) => a.localeCompare(b)),
      outgoing: [],
      incoming: [],
    };
  }

  for (const note of liveNotes.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    for (const link of note.links
      .slice()
      .sort((a, b) => a.target.localeCompare(b.target) || a.relation.localeCompare(b.relation))) {
      if (!liveNoteIds.has(link.target)) continue;
      const edge = {
        source: note.id,
        target: link.target,
        relation: link.relation,
      };
      nodes[note.id]?.outgoing.push(edge);
      nodes[link.target]?.incoming.push(edge);
    }
  }

  return {
    version: 1,
    nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => a.localeCompare(b))),
  };
}

/**
 * Explanatory links only: `evidenced_by` in either direction, a thread joined to its
 * cause, trigger or pay-off event, a relationship joined to its cause event, and an
 * event joined to the event that caused it. Other links (world `planted_in`, character
 * `caused_by`, `extracted_from`) measured as noise.
 */
function isExplanatoryLink(
  seedType: LtmNoteType | undefined,
  seedStoresLink: boolean,
  relation: string,
  otherType: LtmNoteType | undefined,
) {
  if (relation === "evidenced_by") return true;
  const [stateType, eventType] = seedStoresLink ? [seedType, otherType] : [otherType, seedType];
  if (eventType !== "timeline_event") return false;
  if (stateType === "thread")
    return relation === "caused_by" || relation === "triggered_by" || relation === "paid_off_in";
  return (stateType === "relationship" || stateType === "timeline_event") && relation === "caused_by";
}

/** One-hop explanatory neighbours of the recalled seed notes, never a seed itself, each with the seed it came from. */
export function findLtmLinkedNotes(
  index: LtmGraphIndex,
  seedNoteIds: Iterable<string>,
  noteTypeOf: (noteId: string) => LtmNoteType | undefined,
) {
  const seeds = new Set(seedNoteIds);
  const linked = new Map<string, { noteId: string; seedNoteId: string; relation: string }>();
  for (const seedNoteId of seeds) {
    const node = index.nodes[seedNoteId];
    if (!node) continue;
    const links = [
      ...node.outgoing.map((edge) => ({ noteId: edge.target, relation: edge.relation, seedStoresLink: true })),
      ...node.incoming.map((edge) => ({ noteId: edge.source, relation: edge.relation, seedStoresLink: false })),
    ];
    for (const link of links) {
      if (seeds.has(link.noteId) || linked.has(link.noteId)) continue;
      if (!isExplanatoryLink(noteTypeOf(seedNoteId), link.seedStoresLink, link.relation, noteTypeOf(link.noteId)))
        continue;
      linked.set(link.noteId, { noteId: link.noteId, seedNoteId, relation: link.relation });
    }
  }
  return Array.from(linked.values());
}
