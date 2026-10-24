// Maintained source inlined after story-memory-en.mjs. Status reads never generate memories.
/* global forgeStoryMemoryEnglish, Ze */
const forgeStoryMemoryPhases = new Set(["pending", "ready", "stale", "error", "context-unknown"]);
const forgeStoryMemoryLayout = `
.gf-story-memory { margin-bottom: var(--sp-2); }
.gf-story-memory h4 { margin: 0 0 .4rem; font: 700 var(--t-sm)/1.35 var(--display); color: var(--text); }
.gf-story-memory p { margin: 0 0 .5rem; max-width: 70ch; font: var(--t-xs)/1.5 var(--body); color: var(--steel-faint); overflow-wrap: anywhere; }
.gf-story-memory [role="status"] { color: var(--text); }
.gf-story-memory .st-compress { min-height: 44px; white-space: normal; }
`;

export function forgeStoryMemoryStatusHtml(memory, { busy = false, retrying = false, unavailable = false } = {}) {
  const phase = forgeStoryMemoryPhases.has(memory?.phase) ? memory.phase : null;
  const key = retrying
    ? "retrying"
    : busy
      ? "checking"
      : unavailable
        ? "unavailable"
        : phase === "context-unknown"
          ? "contextUnknown"
          : phase || "checking";
  const retry = phase === "context-unknown" || (memory?.retryable === true && (phase === "stale" || phase === "error"));
  const label = unavailable ? "checkAgain" : phase === "context-unknown" ? "checkContext" : "retry";
  return `<style>${forgeStoryMemoryLayout}</style><div class="gf-story-memory"><h4>${forgeStoryMemoryEnglish["story.memory.title"]}</h4><p>${forgeStoryMemoryEnglish["story.memory.hint"]}</p><p role="status" aria-live="polite">${forgeStoryMemoryEnglish[`story.memory.${key}`]}</p>${unavailable || retry ? `<button class="st-compress" type="button" data-forge-memory-retry${busy ? " disabled" : ""}>${forgeStoryMemoryEnglish[`story.memory.${label}`]}</button>` : ""}</div>`;
}

export function adoptForgeStoryMemoryStatus(host, response, runId) {
  if (host._run?.runId !== runId) return;
  host._storyMemoryRunId = runId;
  host._storyMemoryStatus = forgeStoryMemoryPhases.has(response?.memory?.phase) ? response.memory : null;
}

export function wireForgeStoryMemoryStatus(host, request = Ze) {
  host._stopForgeStoryMemoryStatus?.();
  const root = host._root;
  const mount = root.querySelector("[data-forge-story-memory]");
  const runId = host._run?.runId;
  if (!mount || !runId) return;
  let memory = host._storyMemoryRunId === runId ? host._storyMemoryStatus : null;
  let timer;
  let controller;
  let stopped = false;
  let requesting = false;
  let retrying = false;
  let unavailable = false;
  const current = () =>
    !stopped &&
    host.isConnected &&
    host._run?.runId === runId &&
    host._hudView === "settings" &&
    host._settingsCategory === "continuity" &&
    root.querySelector("[data-forge-story-memory]") === mount;
  const render = () => {
    mount.innerHTML = forgeStoryMemoryStatusHtml(memory, { busy: requesting, retrying, unavailable });
  };
  const refresh = async (retry = false) => {
    if (!current() || requesting) return;
    clearTimeout(timer);
    requesting = true;
    retrying = retry;
    controller = new AbortController();
    render();
    try {
      const response = await request(`/api/gacha-forge/story-memory/${retry ? "retry" : "status"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
        signal: controller.signal,
      });
      const value = response.ok ? await response.json() : null;
      if (!current()) return;
      if (!value?.ok || !forgeStoryMemoryPhases.has(value.memory?.phase)) throw new Error("memory-status-unavailable");
      memory = value.memory;
      unavailable = false;
      adoptForgeStoryMemoryStatus(host, value, runId);
    } catch {
      if (!current()) return;
      unavailable = true;
    } finally {
      requesting = false;
      retrying = false;
      if (current()) {
        render();
        if (!unavailable && memory?.phase === "pending") timer = setTimeout(() => refresh(), 2000);
      }
    }
  };
  mount.onclick = (event) => {
    if (event.target.closest("[data-forge-memory-retry]")) void refresh(!unavailable);
  };
  host._stopForgeStoryMemoryStatus = () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
    mount.onclick = null;
  };
  render();
  if (!memory) void refresh();
  else if (memory.phase === "pending") timer = setTimeout(() => refresh(), 2000);
}
