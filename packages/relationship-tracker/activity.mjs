export const DEFAULT_PROCESSING_TIMEOUT_MS = 150_000;

const SOURCES = new Set(["automatic", "history"]);
const compareNumbers = (left, right) => left - right;

function requireChatId(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("Processing status requires a non-empty chat ID.");
  return value;
}

export function createProcessingStatusManager({
  timeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("Processing timeout must be a positive integer.");
  const operationsByChat = new Map();
  const completedRevisionsByChat = new Map();
  let sequence = 0;

  function remove(chatId, token) {
    const operations = operationsByChat.get(chatId);
    const operation = operations?.get(token);
    if (!operation) return false;
    clearTimer(operation.timer);
    operations.delete(token);
    if (operations.size === 0) operationsByChat.delete(chatId);
    completedRevisionsByChat.set(chatId, (completedRevisionsByChat.get(chatId) ?? 0) + 1);
    return true;
  }

  function begin(chatId, source) {
    const validChatId = requireChatId(chatId);
    if (!SOURCES.has(source)) throw new Error("Processing source must be automatic or history.");
    const startedAtMs = now();
    const token = `${startedAtMs}:${++sequence}`;
    const operations = operationsByChat.get(validChatId) ?? new Map();
    const timer = setTimer(() => remove(validChatId, token), timeoutMs);
    timer?.unref?.();
    operations.set(token, {
      token,
      source,
      sequence,
      startedAtMs,
      expiresAtMs: startedAtMs + timeoutMs,
      timer,
    });
    operationsByChat.set(validChatId, operations);
    return token;
  }

  function finish(chatId, token) {
    return remove(requireChatId(chatId), token);
  }

  function finishSource(chatId, source) {
    const validChatId = requireChatId(chatId);
    if (!SOURCES.has(source)) throw new Error("Processing source must be automatic or history.");
    const operation = [...(operationsByChat.get(validChatId)?.values() ?? [])]
      .filter((entry) => entry.source === source)
      .sort((left, right) => compareNumbers(left.sequence, right.sequence))[0];
    return operation ? remove(validChatId, operation.token) : false;
  }

  function getStatus(chatId) {
    const validChatId = requireChatId(chatId);
    const operations = operationsByChat.get(validChatId);
    if (!operations || operations.size === 0) {
      return {
        schemaVersion: 1,
        chatId: validChatId,
        processing: false,
        source: null,
        startedAt: null,
        expiresAt: null,
        completedRevision: completedRevisionsByChat.get(validChatId) ?? 0,
      };
    }
    for (const operation of [...operations.values()]) {
      if (operation.expiresAtMs <= now()) remove(validChatId, operation.token);
    }
    const active = [...(operationsByChat.get(validChatId)?.values() ?? [])]
      .sort((left, right) => compareNumbers(left.startedAtMs, right.startedAtMs) || compareNumbers(left.sequence, right.sequence));
    const latest = active.at(-1);
    if (!latest) return getStatus(validChatId);
    return {
      schemaVersion: 1,
      chatId: validChatId,
      processing: true,
      source: latest.source,
      startedAt: new Date(latest.startedAtMs).toISOString(),
      expiresAt: new Date(latest.expiresAtMs).toISOString(),
      completedRevision: completedRevisionsByChat.get(validChatId) ?? 0,
    };
  }

  function clear() {
    for (const [chatId, operations] of operationsByChat) {
      for (const operation of operations.values()) clearTimer(operation.timer);
      operations.clear();
      operationsByChat.delete(chatId);
    }
    completedRevisionsByChat.clear();
  }

  return Object.freeze({ begin, finish, finishSource, getStatus, clear });
}
