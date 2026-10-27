// Canonical English copy for package-owned generation and chat recovery states.
const forgeChatEnglish = {
  "chat.noAnswer": "They did not answer.",
  "chat.waitingForReply": "Waiting for a reply…",
  "chat.outputCapacity":
    "This reply needs at least {minimum} output tokens. Increase the connection's context size or Max Output Tokens Override in Connections, then retry.",
  "chat.capacityContext": "Available context: {available} tokens.",
  "chat.capacityOverride": "Configured output override: {configured} tokens.",
  "generation.capacityStatus": "Generation needs more output space.",
  "generation.outputCapacity":
    "This generation needs at least {minimum} output tokens. Increase the connection's context size or Max Output Tokens Override in Connections, then retry.",
};

export function forgeChatGenerationError(response, fallback, template = forgeChatEnglish["chat.outputCapacity"]) {
  if (response?.detail !== "generation-output-capacity" && response?.error !== "generation-output-capacity")
    return fallback;
  const parts = [template.replace("{minimum}", "8192")];
  const capacity = response.capacity;
  for (const [field, key, placeholder] of [
    ["availableContextTokens", "chat.capacityContext", "{available}"],
    ["configuredMaxOutputTokens", "chat.capacityOverride", "{configured}"],
  ]) {
    const value = capacity?.[field];
    if (Number.isSafeInteger(value) && value >= 0)
      parts.push(forgeChatEnglish[key].replace(placeholder, String(value)));
  }
  return parts.join(" ");
}

export function forgeGenerationCapacityFailure(response) {
  if (response?.detail !== "generation-output-capacity" && response?.error !== "generation-output-capacity")
    return null;
  let capacity = response.capacity;
  if (!capacity && typeof response.detail === "string" && response.detail.length <= 4096) {
    try {
      capacity = JSON.parse(response.detail);
    } catch {
      // An error code or an older host's non-JSON detail still receives the generic settings guidance.
    }
  }
  return {
    status: forgeChatEnglish["generation.capacityStatus"],
    head: forgeChatGenerationError({ ...response, capacity }, "", forgeChatEnglish["generation.outputCapacity"]),
    why: "",
  };
}

function forgeChatIsCurrent(host, runId, unitId) {
  return host._run?.runId === runId && host._chat?.unit?.id === unitId;
}

// Each admitted send owns this slot; late cleanup must not release a newer operation.
const forgeChatSendGuards = new WeakMap();

export function beginForgeChatSend(host) {
  const guard = { unitId: host._chat?.unit?.id };
  forgeChatSendGuards.set(host, guard);
  return guard;
}

export function finishForgeChatSend(host, guard) {
  if (forgeChatSendGuards.get(host) !== guard) return;
  forgeChatSendGuards.delete(host);
  if (host._chatSending !== guard.unitId || host._chatClosing) return;
  host._chatSending = "";
  if (host._chat?.open) host._renderBrowser();
}

function forgeChatMergeRows(earlier, later, freshest = later) {
  const order = [];
  const rows = new Map();
  for (const row of [...earlier, ...later]) {
    const key = row?.id || row;
    if (!rows.has(key)) order.push(key);
    rows.set(key, row);
  }
  for (const row of freshest) if (rows.has(row?.id || row)) rows.set(row?.id || row, row);
  return order.map((key) => rows.get(key));
}

function forgeChatFindSaved(snapshot, attempt, used = new Set()) {
  const previous = new Set((attempt.previous || []).map((row) => row?.id));
  const id = typeof attempt.playerMessageId === "string" ? attempt.playerMessageId : "";
  return (snapshot.messages || []).find(
    (row) =>
      row?.who === "player" &&
      !previous.has(row.id) &&
      !used.has(row.id) &&
      (id
        ? row.id === id
        : String(row.text || "").trim() === attempt.text.trim().slice(0, 600) &&
          (row.ask === "photo") === (attempt.intent?.ask === "photo")),
  );
}

function forgeChatSavedAttempts(snapshot, attempts, runId, unitId) {
  const pending = attempts.filter((attempt) => attempt.runId === runId && attempt.unitId === unitId);
  // Only this send's response can prove row ownership. Resolve exact IDs before UI-only text recovery.
  pending.sort((left, right) => Number(!!right.playerMessageId) - Number(!!left.playerMessageId));
  const used = new Set();
  const saved = new Map();
  for (const attempt of pending) {
    const row = forgeChatFindSaved(snapshot, attempt, used);
    if (row) {
      used.add(row.id);
      saved.set(attempt, row);
    }
  }
  return saved;
}

export function removeForgeChatOptimistic(messages, optimistic) {
  const ids = new Set((optimistic || []).map((row) => row.id));
  return (messages || []).filter((row) => !ids.has(row?.id));
}

export function forgeChatHasCurrentMessages(messages) {
  return (messages || []).some(
    (row) => row?.archived !== true && !String(row?.id || "").startsWith("local-") && String(row?.text || "").trim(),
  );
}

export function retainForgeChatSuccess(host, attempt, response) {
  if (host._run?.runId !== attempt.runId) return;
  const reply = response?.said?.id && response.said.who === "unit" ? response.said : null;
  // Success is known, but the canonical player ID may still be unavailable. Keep the
  // existing local text until a later snapshot can replace it, including after reopening.
  const pending = {
    ...attempt,
    playerMessageId: response?.playerMessageId,
    confirmed: true,
    ...(reply ? { reply } : {}),
  };
  host._chatStash = {
    ...host._chatStash,
    runId: attempt.runId,
    unitId: attempt.unitId,
    error: "",
    draft: "",
    unknowns: [...(host._chatStash?.unknowns || []), pending],
  };
  if (!forgeChatIsCurrent(host, attempt.runId, attempt.unitId)) return;
  host._chat = {
    ...host._chat,
    messages: forgeChatMergeRows(host._chat.messages || [], reply ? [reply] : []),
    error: "",
    retry: false,
  };
  host._chatRev += 1;
  host._renderBrowser();
}

export function adoptForgeChatSnapshot(host, snapshot, { runId, unitId, opening = false } = {}) {
  if (!snapshot?.ok || !forgeChatIsCurrent(host, runId, unitId)) return false;
  const stash = host._chatStash;
  const matches = stash?.unitId === unitId && (!stash.runId || stash.runId === runId);
  const savedRows = forgeChatSavedAttempts(snapshot, stash?.unknowns || [], runId, unitId);
  const resolvedLocalRows = new Map();
  const unresolved = [];
  const unknowns = (stash?.unknowns || []).filter((attempt) => {
    if (attempt.runId !== runId || attempt.unitId !== unitId) return true;
    const saved = savedRows.get(attempt);
    const replied = attempt.reply?.id && snapshot.messages?.some((row) => row.id === attempt.reply.id);
    if (saved || replied) {
      for (const row of attempt.optimistic || []) {
        resolvedLocalRows.set(row.id, row.who === "player" ? saved : null);
      }
      return false;
    }
    // Keep another attempt's proven canonical rows excluded on later refreshes too.
    attempt.previous = forgeChatMergeRows(attempt.previous || [], [...savedRows.values()]);
    unresolved.push(attempt);
    return true;
  });
  let oldRows = opening
    ? []
    : (host._chat.messages || [])
        .map((row) => (resolvedLocalRows.has(row?.id) ? resolvedLocalRows.get(row.id) : row))
        .filter(Boolean);
  // Closing a session archives every prior row, including history loaded before the latest page.
  if (snapshot.activeCount === 0) oldRows = oldRows.map((row) => ({ ...row, archived: true }));
  let messages = forgeChatMergeRows(oldRows, snapshot.messages || []);
  messages = forgeChatMergeRows(
    messages,
    unresolved.flatMap((attempt) => [...(attempt.optimistic || []), ...(attempt.reply ? [attempt.reply] : [])]),
  );
  const retry = unresolved.length === 0 && snapshot.retry === true;
  host._chat = {
    ...host._chat,
    ...snapshot,
    open: true,
    opening: false,
    messages,
    error: unresolved.some((attempt) => !attempt.confirmed)
      ? (matches && stash.error) || forgeChatEnglish["chat.noAnswer"]
      : retry
        ? forgeChatEnglish["chat.noAnswer"]
        : "",
    retry,
    page: opening ? Number(snapshot.page) || 1 : Math.max(Number(host._chat.page) || 1, Number(snapshot.page) || 1),
  };
  if (matches && stash.draft) host._chatDraft = stash.draft;
  // Keep attempts until their canonical row IDs are known. This stash never sends a request itself.
  host._chatStash = unknowns.length ? { ...(matches ? { runId, unitId } : stash), unknowns } : matches ? null : stash;
  return true;
}

export async function reconcileForgeChatFailure(host, attempt) {
  attempt = { ...attempt, playerMessageId: attempt.response?.playerMessageId };
  const { runId, unitId } = attempt;
  const failure = forgeChatGenerationError(attempt.response, attempt.error);
  let snapshot = null;
  try {
    snapshot = await host._postJson("/chat/open", { runId, unitId });
  } catch {
    // A second network failure still must not erase or automatically resend the unconfirmed text.
  }
  if (host._run?.runId !== runId) return;
  const unknowns = host._chatStash?.unknowns || [];
  const rejected = new Set([
    "bad-request",
    "no-vigor",
    "locked",
    "images-off",
    "nothing-to-retry",
    "generation-in-progress",
  ]);
  const definitelyRejected = rejected.has(attempt.response?.error);
  const pending = definitelyRejected ? unknowns : [...unknowns, attempt];
  const saved =
    !definitelyRejected &&
    snapshot?.ok &&
    (attempt.intent?.retry || forgeChatSavedAttempts(snapshot, pending, runId, unitId).get(attempt));
  const retain = !definitelyRejected && (attempt.optimistic || []).length > 0;
  host._chatStash = {
    runId,
    unitId,
    error: failure,
    draft: definitelyRejected ? attempt.text : "",
    unknowns: retain ? pending : unknowns,
  };
  if (!forgeChatIsCurrent(host, runId, unitId)) return;
  if (saved || definitelyRejected) {
    host._chat = { ...host._chat, messages: removeForgeChatOptimistic(host._chat.messages, attempt.optimistic) };
  }
  if (snapshot?.ok) adoptForgeChatSnapshot(host, snapshot, { runId, unitId });
  else host._chat = { ...host._chat, error: failure, retry: false };
  host._chatDraft = definitelyRejected ? attempt.text : "";
  const replied = saved && snapshot.messages?.at(-1)?.who === "unit";
  host._chat.error = replied ? "" : snapshot?.busy ? forgeChatEnglish["chat.waitingForReply"] : failure;
  host._chatRev += 1;
  host._renderBrowser();
}

export function prependForgeChatHistory(host, snapshot, { runId, unitId, page } = {}) {
  if (!snapshot?.ok || !forgeChatIsCurrent(host, runId, unitId)) return;
  const log = host._root?.querySelector("[data-chat-log]");
  const before = log ? { height: log.scrollHeight, top: log.scrollTop } : null;
  host._chat = {
    ...host._chat,
    messages: forgeChatMergeRows(snapshot.messages || [], host._chat.messages || [], snapshot.messages || []),
    page: Number(snapshot.page) || page,
    pages: Number(snapshot.pages) || 1,
  };
  host._chatRev += 1;
  host._renderBrowser();
  const revision = host._chatRev;
  const restore = () => {
    if (!before || !forgeChatIsCurrent(host, runId, unitId) || host._chatRev !== revision) return;
    const current = host._root?.querySelector("[data-chat-log]");
    if (current) current.scrollTop = before.top + current.scrollHeight - before.height;
  };
  restore();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
}
