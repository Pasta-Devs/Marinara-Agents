/* global Ze, forgeAnimationEnglish */
export function forgeAnimationFailureMessage(result) {
  if (result?.error === "animation-unavailable") return forgeAnimationEnglish.hostUnavailable;
  if (result?.error === "banner-image-missing" || result?.reason === "source-image")
    return forgeAnimationEnglish.sourceImageMissing;
  if (result?.reason === "seedance-reference-setup") return forgeAnimationEnglish.seedanceSetup;
  if (result?.reason === "connection") return forgeAnimationEnglish.connectionFailed;
  if (result?.reason === "provider")
    return Number.isInteger(result.providerStatus) && result.providerStatus >= 400 && result.providerStatus <= 599
      ? forgeAnimationEnglish.providerFailed.replace("{status}", String(result.providerStatus))
      : forgeAnimationEnglish.providerRejected;
  if (result?.reason === "invalid-response") return forgeAnimationEnglish.responseFailed;
  if (result?.reason === "storage") return forgeAnimationEnglish.storageFailed;
  if (result?.reason === "timeout") return forgeAnimationEnglish.timeoutFailed;
  if (result?.reason === "interrupted") return forgeAnimationEnglish.interruptedFailed;
  if (result?.reason === "unknown") return forgeAnimationEnglish.unknownFailed;
  return result?.reason === "playback" ? forgeAnimationEnglish.playbackFailed : forgeAnimationEnglish.failed;
}

const forgeAnimationClipPath = /^\/api\/gacha-forge\/banner-animation\/file\/[a-f0-9]{64}\/[a-f0-9]{64}\.mp4$/u;

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
  const eventBanner = host._forgeSeasonalBanner,
    activeBanner = () => (eventBanner ? host._forgeSeasonalBanner : host._summonBanner?.banner),
    banner = activeBanner();
  const runId = run?.runId,
    connectionId = run?.animationConnectionId,
    art = banner?.art,
    bannerId = banner?.id,
    rotation = banner?.music?.cue || "";
  const target =
    eventBanner && host._hudView === "events" && host._eventId === "story-events"
      ? host._root.querySelector("[data-story-event-banner]")
      : host._hudView === "summon" && host._summonPhase === "banner" && host._summonBannerState === "ready"
        ? host._root.querySelector('[data-screen="banner"] .show > .art.wide')
        : null;
  const identity = JSON.stringify([runId, connectionId, bannerId, rotation, art]);
  if (state.target === target && state.identity === identity && state.banner === banner) return;
  state.cleanup?.();
  state.target = target;
  if (!target || !run?.animationConnectionId || !banner?.art) return;
  if (state.identity !== identity) state.paused = false;
  if (state.identity !== identity || state.banner !== banner) state.staleBanner = null;
  // A rotated banner's earlier clip is never shown again in this view; let its memory go.
  if (state.identity !== identity)
    for (const key of state.requests.keys())
      if (key !== identity && JSON.parse(key)[2] === bannerId) state.requests.delete(key);
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
    source,
    pause,
    labelPause = () => {},
    observer,
    visible = !globalThis.IntersectionObserver,
    disposed = false;
  const current = () =>
    !disposed &&
    host._run?.runId === runId &&
    host._run?.animationConnectionId === connectionId &&
    activeBanner()?.art === art &&
    activeBanner()?.id === bannerId &&
    (activeBanner()?.music?.cue || "") === rotation &&
    target.isConnected;
  const update = () => {
    if (!current()) return;
    const active = visible && document.visibilityState !== "hidden" && !state.media?.matches;
    const playing = active && !state.paused;
    if (video) {
      const clip = video;
      if (playing)
        clip.play().catch((error) => {
          if (!current() || video !== clip || error?.name === "AbortError") return;
          if (error?.name !== "NotAllowedError") return failPlayback(clip);
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
  const offerRetry = (message) => {
    notice(`${message} ${forgeAnimationEnglish.retryCost}`);
    if (chips?.querySelector("[data-animation-retry]")) return;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "chip";
    retry.dataset.animationRetry = "";
    retry.textContent = forgeAnimationEnglish.retry;
    retry.onclick = () => {
      if (retry.disabled || !current()) return;
      retry.disabled = true;
      retry.textContent = forgeAnimationEnglish.retrying;
      retry.setAttribute("aria-busy", "true");
      retry.setAttribute("aria-disabled", "true");
      state.requests.delete(identity);
      state.staleBanner = null;
      void ensure(true).finally(() => {
        if (!current()) return;
        retry.disabled = false;
        retry.textContent = forgeAnimationEnglish.retry;
        retry.setAttribute("aria-busy", "false");
        retry.setAttribute("aria-disabled", "false");
      });
    };
    chips?.append(retry);
  };
  const release = () => {
    if (source) URL.revokeObjectURL(source);
    source = null;
  };
  const failPlayback = (clip) => {
    if (!current() || video !== clip) return;
    clip.pause();
    clip.remove();
    video = null;
    release();
    pause?.remove();
    pause = null;
    // The clip downloaded, so this browser cannot decode it (for example H.265). Only an explicit, priced retry
    // replaces it; a refused or dropped download never reaches here.
    state.requests.set(identity, Promise.resolve({ ok: false, retry: true, reason: "playback" }));
    offerRetry(forgeAnimationEnglish.playbackFailed);
  };
  const load = async (result) => {
    if (!result?.ok || result.animation?.poster !== art || !forgeAnimationClipPath.test(result.animation?.url || ""))
      return result;
    // ponytail: <video> cannot send the host's X-Admin-Secret header, so the whole clip is held in memory for each
    // viewed banner of this world. Upgrade path: a host-signed media URL that the element can stream directly.
    const response = await Ze(result.animation.url).catch(() => null);
    // A busy proxy or tunnel is temporary: asking again later is free. A refused clip stays refused.
    if (response && !response.ok)
      return response.status === 408 || response.status === 429 || response.status >= 500
        ? null
        : { ok: false, reason: "playback" };
    const clip = await response?.blob().catch(() => null);
    // A dropped download is handled like a dropped generation request: asking again reads the saved clip for free.
    return clip ? { ...result, clip } : null;
  };
  const mount = (result) => {
    if (!current()) return;
    if (result?.ok && result.animation?.poster !== art) {
      state.requests.delete(identity);
      state.staleBanner = banner;
      offerRetry(forgeAnimationEnglish.failed);
      return;
    }
    if (!result.ok || !forgeAnimationClipPath.test(result.animation?.url || "")) {
      const message = forgeAnimationFailureMessage(result);
      if (result.retry || result.ok) offerRetry(message);
      else {
        notice(message);
        chips?.querySelector("[data-animation-retry]")?.remove();
      }
      return;
    }
    if (video) return;
    chips?.querySelector("[data-animation-retry]")?.remove();
    video = document.createElement("video");
    const clip = video;
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
      if (current() && video === clip) {
        clip.style.opacity = "1";
        status.remove();
      }
    });
    video.addEventListener("error", () => failPlayback(clip));
    video.src = source = URL.createObjectURL(result.clip);
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
      offerRetry(forgeAnimationEnglish.failed);
      return;
    }
    let request = state.requests.get(identity);
    if (!request) {
      notice(forgeAnimationEnglish.generating);
      request = host
        ._postJson("/banner-animation", {
          runId,
          banner: bannerId,
          retry,
          debugMode: host.capabilityProps?.debugMode === true,
        })
        .then(load);
      state.requests.set(identity, request);
    }
    try {
      const result = await request;
      if (result === null) {
        // The long request lost its connection (for example while iOS suspended the page) but the Engine job may
        // still finish. Asking again joins that job or reads its saved result without paying for another clip.
        if (state.requests.get(identity) === request) state.requests.delete(identity);
        if (!current()) return;
        notice(forgeAnimationEnglish.connectionLost);
        chips?.querySelector("[data-animation-retry]")?.remove();
        return;
      }
      mount(result);
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
    release();
    pause?.remove();
    status.remove();
    chips?.querySelector("[data-animation-retry]")?.remove();
    state.update = null;
  };
  update();
}
