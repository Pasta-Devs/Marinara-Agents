// The Vigor countdown, kept live from one deadline per wallet.
//
// Replies carry vigorNextMs, a delay measured when the server answered. Reusing that number on later renders
// restarted the countdown, and a reply or merge without it blanked the bar until the one-second clock wrote it
// back, so the timer flickered. Each wallet now keeps the deadline and reports the delay when it is read.

/** Time to the next Vigor point, or null when Vigor is full or the deadline is unknown. */
export function forgeVigorRemaining(deadline, vigor, max, period, now = Date.now()) {
  if (!Number.isFinite(deadline) || (max > 0 && vigor >= max)) return null;
  const late = now - deadline;
  if (late < 0) return -late;
  if (!(period > 0)) return 0;
  // Points restored since the deadline arrive with the next refresh; until then the countdown keeps going.
  return max > 0 && vigor + 1 + Math.floor(late / period) >= max ? null : period - (late % period);
}

export function stampForgeVigorWallet(next, previous, fallbackPeriod, now = Date.now()) {
  if (!next || typeof next !== "object") return next;
  const wallet = { ...next };
  const vigor = Number(wallet.vigor) || 0;
  const max = Number(wallet.vigorMax) || 0;
  const period = Number(wallet.vigorPerMs) || Number(previous?.vigorPerMs) || Number(fallbackPeriod) || 0;
  let deadline = null;
  if (!(max > 0 && vigor >= max)) {
    if (Number.isFinite(wallet.vigorNextMs)) deadline = now + wallet.vigorNextMs;
    else if (Number.isFinite(previous?.vigorNextAt)) deadline = previous.vigorNextAt;
    else if (period > 0 && Number(wallet.vigorAt) > 0) deadline = Number(wallet.vigorAt) + period;
  }
  Object.defineProperty(wallet, "vigorNextAt", { value: deadline, configurable: true });
  Object.defineProperty(wallet, "vigorNextMs", {
    configurable: true,
    enumerable: true,
    get() {
      return forgeVigorRemaining(deadline, Number(this.vigor) || 0, Number(this.vigorMax) || 0, period);
    },
  });
  return wallet;
}

/** Every wallet the client adopts, from any reply or merge, gets a live countdown. */
export function wireForgeVigorWallet(host) {
  let wallet = null;
  Object.defineProperty(host, "_wallet", {
    configurable: true,
    enumerable: true,
    get: () => wallet,
    set: (next) => {
      wallet = stampForgeVigorWallet(next, wallet, host._run?.vigorPerMs);
    },
  });
}

// Deadlines a clock has already asked about, per root, so a re-render does not ask again for the same point.
const forgeVigorReported = new WeakMap();

/** Writes the countdown every second and asks for fresh state once each time a point lands. */
export function startForgeVigorClock(root, { read, due, format, onLanded } = {}) {
  let last = null;
  const tick = () => {
    const node = root?.querySelector?.("[data-vigor-next]");
    if (!node) return;
    const ms = read?.();
    const remaining = Number.isFinite(ms) ? ms : null;
    const text = remaining === null ? "" : format(remaining);
    if (node.textContent !== text) node.textContent = text;
    // A point that landed while no clock was watching (the bar hidden, or between renders) still asks once.
    const at = due?.();
    let landed = last !== null && (remaining === null || remaining > last);
    if (Number.isFinite(at) && Date.now() >= at && forgeVigorReported.get(root) !== at) landed = true;
    if (landed && Number.isFinite(at)) forgeVigorReported.set(root, at);
    if (landed) onLanded?.();
    last = remaining;
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}
