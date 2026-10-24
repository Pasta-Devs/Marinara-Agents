/* global Ze, forgeAnimationEnglish */
export async function loadForgeAnimationConnections(root, values) {
  const select = root.querySelector('[data-input="animationConnectionId"]');
  if (!select || select.dataset.forgeAnimationLoading) return;
  select.setAttribute("aria-label", forgeAnimationEnglish.connection);
  select.dataset.forgeAnimationLoading = "true";
  const selected = values?.animationConnectionId || "";
  const populate = (entries, empty = forgeAnimationEnglish.off) => {
    select.replaceChildren(new Option(empty, ""));
    for (const row of entries) select.add(new Option(row.name || row.model || row.id, row.id));
    if (selected && !entries.some((row) => row.id === selected)) {
      const unavailable = new Option(forgeAnimationEnglish.unavailable, selected);
      unavailable.disabled = true;
      select.add(unavailable);
    }
    select.value = selected;
  };
  populate([]);
  select.disabled = true;
  try {
    const response = await Ze("/api/connections");
    if (!response.ok) throw new Error("Connections unavailable");
    const rows = await response.json();
    populate(
      (Array.isArray(rows) ? rows : rows?.connections || []).filter(
        (row) =>
          row?.provider === "video_generation" &&
          row.profileImportReviewRequired !== true &&
          row.profileImportReviewRequired !== "true",
      ),
    );
  } catch {
    populate([], forgeAnimationEnglish.connectionsFailed);
  } finally {
    select.disabled = false;
  }
}

export function disposeForgeBannerAnimation(host) {
  const state = host._forgeBannerAnimation;
  state?.cleanup?.();
  state?.media?.removeEventListener("change", state.onMotion);
  document.removeEventListener("visibilitychange", state?.onVisibility);
  host._forgeBannerAnimation = null;
}

export function wireForgeBannerAnimation(host) {
  const run = host._run;
  if (host._forgeBannerAnimation && host._forgeBannerAnimation.runId !== run?.runId) disposeForgeBannerAnimation(host);
  if (!host._forgeBannerAnimation) {
    const state = {
      runId: run?.runId,
      requests: new Map(),
      media: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)"),
    };
    state.onMotion = () => {
      state.target = null;
      wireForgeBannerAnimation(host);
    };
    state.onVisibility = () => state.update?.();
    state.media?.addEventListener("change", state.onMotion);
    document.addEventListener("visibilitychange", state.onVisibility);
    host._forgeBannerAnimation = state;
  }
  const state = host._forgeBannerAnimation;
  const banner = host._summonBanner?.banner;
  const runId = run?.runId,
    connectionId = run?.animationConnectionId,
    art = banner?.art,
    bannerId = banner?.id,
    rotation = banner?.music?.cue || "";
  const target =
    host._hudView === "summon" && host._summonPhase === "banner" && host._summonBannerState === "ready"
      ? host._root.querySelector('[data-screen="banner"] .show > .art.wide')
      : null;
  const identity = JSON.stringify([runId, connectionId, bannerId, rotation, art]);
  if (state.target === target && state.identity === identity && state.banner === banner) return;
  state.cleanup?.();
  state.target = target;
  if (!target || !run?.animationConnectionId || !banner?.art) return;
  if (state.identity !== identity) state.paused = false;
  if (state.identity !== identity || state.banner !== banner) state.staleBanner = null;
  state.identity = identity;
  state.banner = banner;
  if (state.media?.matches) return;
  const chips = target.parentElement?.querySelector(".chips");
  const statusHost = target.parentElement?.querySelector(".float") || chips;
  const status = document.createElement("span");
  status.className = "chip";
  status.setAttribute("role", "status");
  status.setAttribute("data-banner-animation-status", "");
  Object.assign(status.style, {
    maxWidth: "min(65ch, 100%)",
    alignSelf: "flex-start",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    textTransform: "none",
    letterSpacing: "normal",
    cursor: "default",
  });
  let video,
    pause,
    labelPause = () => {},
    observer,
    visible = !globalThis.IntersectionObserver,
    disposed = false;
  const current = () =>
    !disposed &&
    host._run?.runId === runId &&
    host._run?.animationConnectionId === connectionId &&
    host._summonBanner?.banner?.art === art &&
    host._summonBanner?.banner?.id === bannerId &&
    (host._summonBanner?.banner?.music?.cue || "") === rotation &&
    target.isConnected;
  const update = () => {
    if (!current()) return;
    const active = visible && document.visibilityState !== "hidden" && !state.media?.matches;
    const playing = active && !state.paused;
    if (video) {
      if (playing)
        video.play().catch((error) => {
          if (!current() || error?.name === "AbortError") return;
          state.paused = true;
          video.style.opacity = "0";
          notice(forgeAnimationEnglish.playbackFailed);
          labelPause();
        });
      else video.pause();
    }
    if (active && !video) void ensure();
  };
  const notice = (text) => {
    status.textContent = text;
    statusHost?.prepend(status);
  };
  const mount = (result) => {
    if (!current()) return;
    if (result?.ok && result.animation?.poster !== art) {
      state.requests.delete(identity);
      state.staleBanner = banner;
      chips?.querySelector("[data-animation-retry]")?.remove();
      notice(forgeAnimationEnglish.failed);
      return;
    }
    if (
      !result.ok ||
      !/^\/api\/gacha-forge\/banner-animation\/file\/[a-f0-9]{64}\/[a-f0-9]{64}\.mp4$/u.test(
        result.animation?.url || "",
      )
    ) {
      notice(forgeAnimationEnglish[result.reason === "seedance-reference-setup" ? "seedanceSetup" : "failed"]);
      if (!result.retry) chips?.querySelector("[data-animation-retry]")?.remove();
      if (result.retry && !chips?.querySelector("[data-animation-retry]")) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "chip";
        retry.dataset.animationRetry = "";
        retry.textContent = forgeAnimationEnglish.retry;
        retry.onclick = () => {
          if (retry.disabled) return;
          retry.disabled = true;
          retry.textContent = forgeAnimationEnglish.retrying;
          retry.setAttribute("aria-busy", "true");
          retry.setAttribute("aria-disabled", "true");
          state.requests.delete(identity);
          void ensure(true).finally(() => {
            if (!current()) return;
            retry.disabled = false;
            retry.textContent = forgeAnimationEnglish.retry;
            retry.setAttribute("aria-busy", "false");
            retry.setAttribute("aria-disabled", "false");
          });
        };
        chips?.append(retry);
      }
      return;
    }
    if (video) return;
    chips?.querySelector("[data-animation-retry]")?.remove();
    video = document.createElement("video");
    video.dataset.bannerAnimation = "";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.preload = "metadata";
    video.poster = art;
    Object.assign(video.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity: "0",
      pointerEvents: "none",
    });
    video.addEventListener("playing", () => {
      if (current()) {
        video.style.opacity = "1";
        status.remove();
      }
    });
    video.addEventListener("error", () => {
      if (!current()) return;
      video.pause();
      video.remove();
      pause?.remove();
      notice(forgeAnimationEnglish.playbackFailed);
    });
    video.src = result.animation.url;
    target.append(video);
    pause = document.createElement("button");
    pause.type = "button";
    pause.className = "chip";
    pause.dataset.animationPause = "";
    labelPause = () => {
      pause.textContent = forgeAnimationEnglish[state.paused ? "play" : "pause"];
      pause.setAttribute("aria-pressed", String(!!state.paused));
    };
    labelPause();
    pause.onclick = () => {
      state.paused = !state.paused;
      labelPause();
      update();
    };
    chips?.append(pause);
    update();
  };
  const ensure = async (retry = false) => {
    if (!current() || !visible || document.visibilityState === "hidden" || state.media?.matches) return;
    if (state.staleBanner === banner) {
      notice(forgeAnimationEnglish.failed);
      return;
    }
    let request = state.requests.get(identity);
    if (!request) {
      notice(forgeAnimationEnglish.generating);
      request = host._postJson("/banner-animation", {
        runId,
        banner: bannerId,
        retry,
        debugMode: host.capabilityProps?.debugMode === true,
      });
      state.requests.set(identity, request);
    }
    try {
      mount(await request);
    } catch {
      if (current()) {
        state.requests.set(identity, Promise.resolve({ ok: false, retry: true }));
        mount({ ok: false, retry: true });
      }
    }
  };
  if (globalThis.IntersectionObserver) {
    observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      update();
    });
    observer.observe(target);
  }
  state.update = update;
  state.cleanup = () => {
    disposed = true;
    observer?.disconnect();
    video?.pause();
    video?.remove();
    pause?.remove();
    status.remove();
    chips?.querySelector("[data-animation-retry]")?.remove();
    state.update = null;
  };
  update();
}
