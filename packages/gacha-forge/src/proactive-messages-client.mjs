/* global forgeUnitMessagesEnglish, forgeChatGenerationError */
// A letter card in the Home panel style. It lives in .gf-view, below the stats bar, where the type scale is defined,
// above an open Letters panel (z-index 20) and below dialogs.
const forgeUnitMessageStyle = `
.gf-unit-message-notice{position:absolute;z-index:25;top:calc(var(--f) * 1);left:50%;translate:-50% 0;box-sizing:border-box;inline-size:min(calc(var(--f) * 44),calc(100% - var(--f) * 2));max-block-size:calc(100% - var(--f) * 2);overflow:auto;display:grid;gap:calc(var(--f) * 0.5);padding:calc(var(--f) * 0.9) calc(var(--f) * 1.2);background:linear-gradient(0deg,var(--ink-2),var(--ink-2)),var(--ink);color:var(--text);border:1px solid var(--ink-3);border-top:2px solid var(--coral);--cut:1em;clip-path:var(--clip-card);border-radius:var(--radius);box-shadow:var(--panel-shadow),var(--panel-bevel);font-family:var(--body);font-size:var(--t-sm);line-height:1.4;animation:gf-unit-message-in 300ms ease-out backwards}
.gf-unit-message-notice .kick{margin:0;overflow-wrap:anywhere;font-family:var(--display);font-size:var(--t-tiny);letter-spacing:0.2em;text-transform:var(--case);color:var(--coral)}
.gf-unit-message-notice .who{margin:0;font-family:var(--title);font-stretch:var(--stretch);font-weight:var(--title-weight);font-size:var(--t-md);line-height:1.2;overflow-wrap:anywhere}
.gf-unit-message-notice .said{margin:0;font-style:italic;color:var(--porcelain-3);overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.gf-unit-message-notice .why{margin:0;overflow-wrap:anywhere}
.gf-unit-message-notice .acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:calc(var(--f) * 0.5)}
.gf-unit-message-notice button{min-block-size:44px;padding:calc(var(--f) * 0.32) calc(var(--f) * 1.1);cursor:pointer;font-family:var(--display);font-weight:700;font-size:var(--t-xs);letter-spacing:0.08em;text-transform:var(--case);background:transparent;color:var(--text);border:1px solid var(--steel-dark);--cut:0.45em;clip-path:var(--clip-btn);border-radius:var(--radius-sm)}
.gf-unit-message-notice button:hover{border-color:var(--coral);color:var(--coral)}
.gf-unit-message-notice button.go{border-color:var(--coral);color:var(--coral)}
.gf-unit-message-notice button:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
@keyframes gf-unit-message-in{from{opacity:0;translate:-50% calc(var(--f) * -0.6)}}
@media (prefers-reduced-motion:reduce){.gf-unit-message-notice{animation:none}}
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
  let shown = null;
  const current = () =>
    !disposed &&
    host._run?.runId === runId &&
    forgeUnitMessageCount(host._run?.story?.dailyUnitMessages) === count &&
    Intl.DateTimeFormat().resolvedOptions().timeZone === zone;
  const renderNotice = () => {
    if (!current() || !pending || !forgeUnitMessageVisible(host)) return;
    if (adoptForgeUnitMessage(host, pending)) pending = null;
    // Letters open on Home, so the card waits there instead of covering a fight, a story or another screen.
    if (!pending || (typeof host._state === "function" && host._state() !== "hud")) {
      notice?.remove();
      notice = null;
      return;
    }
    // Only the incoming Home view: a render's first pass can still hold the outgoing screen.
    const view = root.querySelector(".gf-stage > .gf-view");
    if (!view?.querySelector(".hm-screen") || notice?.isConnected) return;
    notice = document.createElement("aside");
    notice.className = "gf-unit-message-notice";
    const style = document.createElement("style");
    style.textContent = forgeUnitMessageStyle;
    const line = (className, value) => {
      const item = document.createElement("p");
      item.className = className;
      item.textContent = value;
      return item;
    };
    // The run carries the channel's name; older saves may still hold the { name, blurb } record.
    const channel = host._run?.chatChannel;
    const channelName = String((typeof channel === "string" ? channel : channel?.name) || "").trim();
    const kick = line("kick", channelName || forgeUnitMessagesEnglish["messages.kick"]);
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    if (pending.failed)
      status.append(
        line(
          "why",
          forgeChatGenerationError(
            pending,
            forgeUnitMessagesEnglish["messages.failed"],
            forgeUnitMessagesEnglish["messages.capacity"],
          ),
        ),
      );
    else {
      const name = pending.unitName || forgeUnitMessagesEnglish["messages.someone"];
      status.append(line("who", forgeUnitMessagesEnglish["messages.incoming"].replace("{name}", name)));
      const said = String(pending.said?.text || "").trim();
      if (said) status.append(line("said", said));
    }
    const actions = document.createElement("div");
    actions.className = "acts";
    notice.append(style, kick, status, actions);
    const button = (key, action, primary = false) => {
      const item = document.createElement("button");
      item.type = "button";
      if (primary) item.className = "go";
      item.textContent = forgeUnitMessagesEnglish[key];
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        action();
      });
      actions.append(item);
    };
    button("messages.dismiss", () => {
      pending = null;
      notice?.remove();
      notice = null;
    });
    // A notification must not discard a draft in a different conversation.
    if (!pending.failed && (!host._chatDraft?.trim() || host._chat?.unit?.id === pending.unitId))
      button(
        "messages.read",
        () => {
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
        },
        true,
      );
    // The same letter coming back with Home does not replay its arrival.
    if (shown === pending) notice.style.animation = "none";
    shown = pending;
    view.append(notice);
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
