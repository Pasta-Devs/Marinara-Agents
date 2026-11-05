// Response-only history views. Stored session boundaries still own model context and memory compression.
const forgeChatInFlight = new Set();

function forgeChatOperationKey(runId, unitId) {
  return JSON.stringify([String(runId || ""), String(unitId || "")]);
}

export function forgeChatReplyBusy(runId, unitId) {
  return forgeChatInFlight.has(forgeChatOperationKey(runId, unitId));
}

export async function withForgeChatSend(runId, unitId, send) {
  const key = forgeChatOperationKey(runId, unitId);
  if (forgeChatInFlight.has(key)) return { ok: false, error: "generation-in-progress", busy: true, retry: false };
  forgeChatInFlight.add(key);
  try {
    return await send();
  } finally {
    forgeChatInFlight.delete(key);
  }
}

export function forgeChatHistoryPage(data, requestedPage, pageSize, busy = false) {
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const archived = Math.min(
    messages.length,
    sessions.reduce((count, session) => count + Math.max(0, Number(session?.count) || 0), 0),
  );
  const size = Math.max(1, Math.round(Number(pageSize) || 80));
  const pages = Math.max(1, Math.ceil(messages.length / size));
  const page = Math.min(pages, Math.max(1, Math.round(Number(requestedPage) || 1)));
  const end = messages.length - (page - 1) * size;
  const start = Math.max(0, end - size);
  const activeCount = messages.length - archived;
  return {
    messages: messages.slice(start, end).map((message, index) => ({ ...message, archived: start + index < archived })),
    page,
    pages,
    past: sessions.length,
    activeCount,
    busy,
    retry: !busy && activeCount > 0 && messages.at(-1)?.who === "player",
  };
}
