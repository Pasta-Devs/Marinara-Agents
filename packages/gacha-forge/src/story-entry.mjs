// A newly opened scene reveals its first line. Remounting or resuming keeps the saved line visible.
export function prepareForgeStoryEntry(host, { resumeAt = 0, startAt = 0, replay = false } = {}) {
  host._forgeStoryEntry = {
    node: host._activeStoryNode,
    runId: host._run?.runId,
    reveal: !replay && resumeAt === 0 && startAt === 0,
  };
}

export function takeForgeStoryEntry(host) {
  const entry = host._forgeStoryEntry;
  host._forgeStoryEntry = null;
  return Boolean(
    entry?.node && entry.node === host._activeStoryNode && entry.runId === host._run?.runId && entry.reveal,
  );
}
