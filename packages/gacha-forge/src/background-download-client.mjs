// Image saving stays in the Engine's gallery service, including its prepared iPhone share gesture.
const forgeBackgroundDownloadEnglish = {
  "home.background.download": "Download image",
  "home.background.downloadNamed": "Download {name}",
  "home.background.preparing": "Preparing image…",
  "home.background.failed": "Could not download this image.",
};
const forgeBackgroundDownloadStyle = `
.gf-background-download-card{position:relative;display:grid;min-width:0}
.gf-background-download-card>.hm-pk-card{width:100%;height:100%;min-width:0}
.gf-background-download{position:absolute;inset-block-start:0;inset-inline-end:0;z-index:1;display:grid;place-items:center;width:44px;height:44px;padding:0;clip-path:none;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text);cursor:pointer}
.gf-background-download::before{content:"";position:absolute;inset:8px;border:1px solid var(--steel-dark);border-radius:var(--radius-sm);background:var(--ink-2)}
.gf-background-download svg{position:relative;width:16px;height:16px;display:block}
.gf-background-download:hover::before{border-color:var(--coral)}
.gf-background-download:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.gf-background-download:disabled{opacity:.55;cursor:default}
`;
const forgeBackgroundDownloadIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>';

function forgeBackgroundDownloadFilename(url) {
  try {
    const name = decodeURIComponent(new URL(url, window.location.href).pathname.split("/").at(-1) || "");
    if (/^[\w.-]{1,180}\.(?:png|jpe?g|webp|gif|avif)$/iu.test(name)) return name;
  } catch {
    // Generated gallery URLs have a filename; a legacy URL still gets a usable fallback name.
  }
  return "gacha-background.png";
}

export function disposeForgeBackgroundDownloads(host) {
  const state = host._forgeBackgroundDownloads;
  if (state) {
    state.active = false;
    state.prepared.clear();
    for (const wrapper of state.wrappers) {
      const card = wrapper.querySelector(".hm-pk-card");
      if (card) wrapper.replaceWith(card);
    }
    state.wrappers.clear();
  }
  host._forgeBackgroundDownloads = null;
}

export function wireForgeBackgroundDownloads(
  host,
  service = globalThis.__MARINARA_HOST__?.services?.imageDownloads,
  toast = globalThis.__MARINARA_HOST__?.modules?.sonner?.toast,
) {
  const root = host._root;
  const picker = root?.querySelector(".hm-pk.bg");
  const runId = host._run?.runId;
  if (host._forgeBackgroundDownloads?.picker === picker && host._forgeBackgroundDownloads?.runId === runId) return;
  disposeForgeBackgroundDownloads(host);
  if (
    !picker ||
    !runId ||
    !["downloadUrlToDevice", "prepareImageSave", "savePreparedImageToDevice", "shouldUseIosImageShare"].every(
      (name) => typeof service?.[name] === "function",
    )
  )
    return;
  const state = { picker, runId, active: true, prepared: new Map(), wrappers: new Set(), preparationFailed: false };
  host._forgeBackgroundDownloads = state;
  if (!root.querySelector("[data-forge-background-download-style]")) {
    const style = document.createElement("style");
    style.dataset.forgeBackgroundDownloadStyle = "";
    style.textContent = forgeBackgroundDownloadStyle;
    root.append(style);
  }
  const ios = service.shouldUseIosImageShare();
  const current = (button) => state.active && host._run?.runId === runId && button.isConnected;
  const failed = () => toast?.error?.(forgeBackgroundDownloadEnglish["home.background.failed"]);
  for (const card of picker.querySelectorAll(".hm-pk-card[data-pk-take]")) {
    const image = card.querySelector("img");
    const url = image?.currentSrc || image?.src;
    if (!url) continue;
    const filename = forgeBackgroundDownloadFilename(url);
    const name = card.querySelector(".nm")?.textContent?.trim();
    const label = name
      ? forgeBackgroundDownloadEnglish["home.background.downloadNamed"].replace("{name}", name)
      : forgeBackgroundDownloadEnglish["home.background.download"];
    const wrapper = document.createElement("div");
    wrapper.className = "gf-background-download-card";
    state.wrappers.add(wrapper);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gf-background-download";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = forgeBackgroundDownloadIcon;
    card.before(wrapper);
    wrapper.append(card, button);
    let prepared = null;
    if (ios) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.title = forgeBackgroundDownloadEnglish["home.background.preparing"];
      const key = `${url}\n${filename}`;
      if (!state.prepared.has(key))
        state.prepared.set(
          key,
          Promise.resolve().then(() => service.prepareImageSave(url, filename)),
        );
      void state.prepared.get(key).then(
        (value) => {
          if (!current(button)) return;
          prepared = value;
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.title = label;
        },
        () => {
          if (!current(button)) return;
          button.removeAttribute("aria-busy");
          button.title = forgeBackgroundDownloadEnglish["home.background.failed"];
          if (!state.preparationFailed) {
            state.preparationFailed = true;
            failed();
          }
        },
      );
    }
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled || !current(button)) return;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      let save;
      try {
        // Keep the prepared-file share in this exact tap stack, as ImageDownloadButton does.
        save = ios ? service.savePreparedImageToDevice(prepared) : service.downloadUrlToDevice(url, filename);
      } catch (error) {
        save = Promise.reject(error);
      }
      void Promise.resolve(save)
        .catch(() => {
          if (current(button)) failed();
        })
        .finally(() => {
          if (!current(button)) return;
          button.disabled = false;
          button.removeAttribute("aria-busy");
        });
    };
  }
}
