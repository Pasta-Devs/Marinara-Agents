/* global forgeUnitMessagesEnglish, forgeChatGenerationError */
const forgeUnitMessageStyle = `
.gf-unit-message-notice{position:absolute;inset:8px 8px auto auto;z-index:12;max-inline-size:min(42ch,calc(100% - 16px));max-block-size:45%;overflow:auto;box-sizing:border-box;padding:8px 12px;background:var(--ink);color:var(--text);border:1px solid var(--steel-dark);font:var(--t-sm)/1.4 var(--body)}
.gf-unit-message-notice p{margin:0 0 4px;overflow-wrap:anywhere}
.gf-unit-message-notice button{min-block-size:44px;margin-inline-end:8px;padding:4px 8px;font:inherit;cursor:pointer}
`;

function forgeUnitMessageCount(value) {
  const number = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

export function disposeForgeUnitMessages(host) {
  host._forgeUnitMessages?.dispose();
  host._forgeUnitMessages = null;
}

function forgeUnitMessageVisible(host) {
  if (
    !host.isConnected ||
    host.ownerDocument?.hidden ||
    (host.getAttribute("view") || "browser") !== "browser" ||
    host._creatingNew ||
    host._showRuns ||
    host._showThemes ||
    host._forgeUnitMessagesSettingsPending ||
    host.closest?.('[hidden], [inert], [aria-hidden="true"]')
  )
    return false;
  const bounds = host.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0 && getComputedStyle(host).visibility !== "hidden";
}

/** Append a saved incoming row without stealing focus or moving a reader through older history. */
export function adoptForgeUnitMessage(host, delivery) {
  const chat = host._chat;
  if (!delivery?.said?.id || delivery.said.who !== "unit" || !chat?.open || chat.unit?.id !== delivery.unitId)
    return false;
  if ((chat.messages || []).some((row) => row.id === delivery.said.id)) return true;
  const root = host._root;
  const focused = root.activeElement;
  if (
    host._chatSending ||
    host._chatClosing ||
    host._chatArchive ||
    host._chatDraft?.trim() ||
    focused?.matches?.('input,textarea,button,a,[contenteditable="true"]')
  )
    return false;
  const log = root.querySelector("[data-chat-log]");
  const top = log?.scrollTop || 0;
  const atBottom = !log || log.scrollHeight - log.clientHeight - top <= 24;
  host._chat = {
    ...chat,
    messages: [...(chat.messages || []), delivery.said],
    activeCount: (chat.activeCount || 0) + 1,
  };
  host._chatRev += 1;
  host._forgeChatQuietRefresh = true;
  try {
    host._renderBrowser();
  } finally {
    host._forgeChatQuietRefresh = false;
  }
  const updated = root.querySelector("[data-chat-log]");
  if (updated) {
    // WebKit otherwise adjusts this restored position again when the rebuilt rows finish layout.
    if (!atBottom) updated.style.overflowAnchor = "none";
    updated.scrollTop = atBottom ? updated.scrollHeight : top;
  }
  return true;
}

export function wireForgeUnitMessages(host) {
  const root = host._root;
  const input = root?.querySelector('[data-field="story.dailyUnitMessages"] input');
  if (input && !input.dataset.forgeUnitMessageCount) {
    input.dataset.forgeUnitMessageCount = "true";
    input.inputMode = "numeric";
    input.addEventListener(
      "change",
      (event) => {
        const number = input.value.trim() ? Number(input.value) : 0;
        const valid = Number.isSafeInteger(number) && number >= 0;
        input.setCustomValidity(valid ? "" : forgeUnitMessagesEnglish["messages.settings.invalid"]);
        if (!valid) {
          event.stopImmediatePropagation();
          input.reportValidity();
        } else input.value = String(number);
      },
      true,
    );
    input.addEventListener("input", () => input.setCustomValidity(""));
  }
  const runId = host._run?.runId;
  const count = forgeUnitMessageCount(host._run?.story?.dailyUnitMessages);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = JSON.stringify([runId, count, zone]);
  if (!runId || !count || (host.getAttribute("view") || "browser") !== "browser") {
    disposeForgeUnitMessages(host);
    return;
  }
  if (host._forgeUnitMessages?.key === key) {
    host._forgeUnitMessages.renderNotice();
    return;
  }
  disposeForgeUnitMessages(host);
  let disposed = false;
  let timer;
  let notice = null;
  let pending = null;
  const current = () =>
    !disposed &&
    host._run?.runId === runId &&
    forgeUnitMessageCount(host._run?.story?.dailyUnitMessages) === count &&
    Intl.DateTimeFormat().resolvedOptions().timeZone === zone;
  const renderNotice = () => {
    if (!current() || !pending || !forgeUnitMessageVisible(host)) return;
    if (adoptForgeUnitMessage(host, pending)) pending = null;
    if (!pending) {
      notice?.remove();
      notice = null;
      return;
    }
    const stage = root.querySelector(".gf-stage");
    if (!stage || notice?.isConnected) return;
    notice = document.createElement("aside");
    notice.className = "gf-unit-message-notice";
    const style = document.createElement("style");
    style.textContent = forgeUnitMessageStyle;
    const text = document.createElement("p");
    text.setAttribute("role", "status");
    const name = pending.unitName || forgeUnitMessagesEnglish["messages.someone"];
    text.textContent = pending.failed
      ? forgeChatGenerationError(
          pending,
          forgeUnitMessagesEnglish["messages.failed"],
          forgeUnitMessagesEnglish["messages.capacity"],
        )
      : forgeUnitMessagesEnglish["messages.incoming"].replace("{name}", name);
    notice.append(style, text);
    const button = (key, action) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = forgeUnitMessagesEnglish[key];
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        action();
      });
      notice.append(item);
    };
    // A notification must not discard a draft in a different conversation.
    if (!pending.failed && (!host._chatDraft?.trim() || host._chat?.unit?.id === pending.unitId))
      button("messages.read", () => {
        const unitId = pending?.unitId;
        if (!unitId || (host._chatDraft?.trim() && host._chat?.unit?.id !== unitId)) return;
        pending = null;
        notice?.remove();
        notice = null;
        if (host._chat?.unit?.id === unitId) {
          host._chatArchive = null;
          host._chatPhoto = "";
          host._chatReload();
        } else host._chatWith(unitId);
      });
    button("messages.dismiss", () => {
      pending = null;
      notice?.remove();
      notice = null;
    });
    stage.append(notice);
  };
  const poll = async () => {
    if (!current()) return;
    if (forgeUnitMessageVisible(host)) {
      renderNotice();
      try {
        const response = await host._postJson("/chat/proactive/due", { runId });
        if (current() && ((response?.ok && response.status === "sent") || response?.error === "generation-failed")) {
          notice?.remove();
          notice = null;
          pending = response.ok ? response : { ...response, failed: true };
          renderNotice();
        }
      } catch {
        // The server durably budgets failed attempts. The next heartbeat cannot retry that attempt.
      }
    }
    if (current()) timer = setTimeout(poll, 60000);
  };
  host._forgeUnitMessages = {
    key,
    renderNotice,
    dispose() {
      disposed = true;
      clearTimeout(timer);
      notice?.remove();
      pending = null;
    },
  };
  timer = setTimeout(poll, 60000);
}
