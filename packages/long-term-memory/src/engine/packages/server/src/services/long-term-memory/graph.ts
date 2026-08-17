import type {
  LtmGraphIndex,
  LtmNote,
  LtmMemoryChunk,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

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

export function expandLtmGraph(
  index: LtmGraphIndex,
  seedNoteIds: string[],
  options: {
    maxHops?: number;
    topK?: number;
    maxVisited?: number;
    maxCandidates?: number;
    allowedNoteIds?: Set<string>;
  } = {},
) {
  const maxHops = options.maxHops ?? 2;
  const maxVisited = Math.max(1, options.maxVisited ?? 256);
  const maxCandidates = Math.max(1, options.maxCandidates ?? options.topK ?? 50);
  const boundedSeeds = seedNoteIds
    .filter((id) => !options.allowedNoteIds || options.allowedNoteIds.has(id))
    .slice(0, maxVisited);
  const visited = new Set(boundedSeeds);
  const queue = boundedSeeds.map((noteId) => ({ noteId, distance: 0 }));
  const scores = new Map<string, { score: number; viaNoteId: string; distance: number }>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.distance >= maxHops) continue;

    const node = index.nodes[current.noteId];
    if (!node) continue;

    const neighbors = [...node.outgoing.map((edge) => edge.target), ...node.incoming.map((edge) => edge.source)].sort(
      (a, b) => a.localeCompare(b),
    );

    for (const neighbor of neighbors) {
      if (options.allowedNoteIds && !options.allowedNoteIds.has(neighbor)) continue;
      const distance = current.distance + 1;
      if (!visited.has(neighbor) && visited.size < maxVisited) {
        visited.add(neighbor);
        queue.push({ noteId: neighbor, distance });
      }

      const neighborNode = index.nodes[neighbor];
      if (!neighborNode) continue;
      for (const chunkId of neighborNode.chunkIds) {
        if (!scores.has(chunkId) && scores.size >= maxCandidates) continue;
        const score = 1 / (distance + 1);
        const existing = scores.get(chunkId);
        if (!existing || score > existing.score) {
          scores.set(chunkId, { score, viaNoteId: neighbor, distance });
        }
      }
    }
  }

  return Array.from(scores.entries())
    .map(([chunkId, value]) => ({ chunkId, ...value }))
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, maxCandidates);
}
