// Generated encounter lines are one-shot per cue; round/everyNRounds choose the first eligible round.
const forgeEnemyEnglish = {
  "enemy.tier.soldier": "Soldier",
  "enemy.tier.elite": "Elite",
  "enemy.tier.boss": "Boss",
  "combat.dialogue.next": "Continue",
  "combat.dialogue.label": "Combat dialogue",
};

export function forgeEnemyTier(enemy) {
  if (["soldier", "elite", "boss"].includes(enemy?.tier)) return enemy.tier;
  const mechanics = ["phases", "charge", "guard", "summon", "double", "immune", "counter", "aura"];
  return Array.isArray(enemy?.mech) && enemy.mech.some((mechanic) => mechanics.includes(mechanic)) ? "boss" : "soldier";
}

export function forgeEnemyTierLabel(enemy) {
  return forgeEnemyEnglish[`enemy.tier.${forgeEnemyTier(enemy)}`];
}

export function forgeEnemyTierBadge(enemy) {
  return `<span class="gf-enemy-tier" data-forge-tier="${forgeEnemyTier(enemy)}">${forgeEnemyTierLabel(enemy)}</span>`;
}

export function forgeEncounterTier(payload) {
  const tiers = (payload?.enemies || []).map(forgeEnemyTier);
  return tiers.includes("boss") ? "boss" : tiers.includes("elite") ? "elite" : "soldier";
}

export const forgeEnemyEncounterStyles = `
.gf-enemy-tier { display: inline-block; color: var(--text); background: var(--ink-2);
  border: 1px solid var(--steel-dark); border-radius: var(--radius-sm); padding: .1em .35em;
  font-family: var(--display); font-size: var(--t-xs); line-height: 1.3; }
.cbt .gf-enemy-tier { position: absolute; top: calc(var(--f)*2.6); left: calc(var(--f)*.45);
  z-index: 4; font-size: calc(var(--f)*.78*var(--gf-scale,1)); }
.gf-combat-dialogue { position: absolute; z-index: 20; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: min(34rem,92%); max-height: 42%; box-sizing: border-box; display: grid;
  grid-template-columns: minmax(0,1fr) auto; gap: .45rem .75rem; padding: var(--sp-2);
  border: 1px solid var(--steel); border-radius: var(--radius); background: var(--ink-2); color: var(--text); }
.gf-combat-dialogue[hidden] { display: none; }
.gf-combat-dialogue b { grid-column: 1 / -1; font: 700 var(--t-sm) var(--display); color: var(--coral); }
.gf-combat-dialogue p { margin: 0; min-height: 0; overflow: auto; overflow-wrap: anywhere;
  font: var(--t-sm)/1.45 var(--body); white-space: pre-wrap; }
.gf-combat-dialogue[data-type="thought"] p,.gf-combat-dialogue[data-type="whisper"] p { font-style: italic; }
.gf-combat-dialogue button { align-self: end; min-height: 44px; padding: .35em .7em; cursor: pointer;
  border: 1px solid var(--steel); border-radius: var(--radius-sm); background: var(--ink); color: var(--text);
  font: 700 var(--t-sm) var(--display); }
.gf-combat-dialogue button:focus-visible,.gf-combat-dialogue p:focus-visible { outline: 2px solid var(--coral); outline-offset: 2px; }
`;

export function createForgeCombatDialogue(root, { payload, run, host, audio, resume, isPaused = () => false }) {
  const enemies = new Map((payload?.enemies || []).map((enemy) => [String(enemy.id), enemy]));
  const types = new Set(["main", "side", "extra", "thought", "whisper"]);
  const triggers = new Set([
    "intro",
    "round",
    "attack",
    "hit",
    "charge",
    "phase_75",
    "phase_50",
    "phase_25",
    "low_hp",
    "victory",
    "defeat",
  ]);
  const cues = (Array.isArray(payload?.dialogueCues) ? payload.dialogueCues : []).filter(
    (cue) =>
      enemies.has(cue?.speaker) &&
      typeof cue.content === "string" &&
      cue.content.trim() &&
      types.has(cue.type) &&
      triggers.has(cue.trigger),
  );
  // The combat run survives fullscreen/theme renders; a new battle receives a new run and fresh cue state.
  const state = (run._forgeDialogue ??= { seen: new Set(), queue: [], round: 0, hp: new Map(), finished: false });
  let panel = null;
  let current = null;
  let voice = null;
  let voiceReady = false;
  let timer = null;
  let disposed = false;
  let onFinished = null;
  let returnFocus = null;
  let focusPending = false;
  const autoButton = root.querySelector("[data-auto]");
  const key = (cue) => JSON.stringify([cue.speaker, cue.content, cue.type, cue.trigger, cue.round, cue.everyNRounds]);
  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };
  const canFocus = (element) =>
    element?.isConnected &&
    !element.disabled &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";
  const focusNewPanel = () => {
    if (disposed || !focusPending || isPaused()) return;
    returnFocus = root.activeElement;
    panel.querySelector("button").focus({ preventScroll: true });
    focusPending = false;
  };
  const syncAuto = () => {
    focusNewPanel();
    clearTimer();
    if (disposed || !current || !voiceReady || !run.auto || isPaused()) return;
    const seconds = Number(host?._run?.audio?.autoplayPauseSeconds ?? 3);
    timer = setTimeout(next, Math.max(0, Number.isFinite(seconds) ? seconds : 3) * 1000);
  };
  function show() {
    if (disposed) return;
    current = state.queue[0] || null;
    if (!current) {
      const restore =
        panel &&
        (panel.contains(root.activeElement) ||
          (!root.activeElement &&
            (document.activeElement === root.host ||
              document.activeElement === document.body ||
              document.activeElement?.contains?.(root.host))));
      focusPending = false;
      if (panel) panel.hidden = true;
      if (onFinished && !state.finished) {
        state.finished = true;
        const finish = onFinished;
        onFinished = null;
        finish();
      } else resume?.();
      if (!state.queue.length && restore && (!root.activeElement || panel.contains(root.activeElement))) {
        const target = [
          returnFocus,
          root.querySelector("[data-auto]"),
          ...root.querySelectorAll(".screen button, .gf-bar button"),
        ].find(canFocus);
        target?.focus({ preventScroll: true });
      }
      if (!state.queue.length) returnFocus = null;
      return;
    }
    const opening = !panel || panel.hidden;
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "gf-combat-dialogue";
      panel.dataset.forgeCombatDialogue = "";
      panel.setAttribute("aria-label", forgeEnemyEnglish["combat.dialogue.label"]);
      panel.setAttribute("aria-live", "polite");
      panel.innerHTML = '<b></b><p tabindex="0"></p><button type="button" data-forge-dialogue-next></button>';
      panel.querySelector("button").textContent = forgeEnemyEnglish["combat.dialogue.next"];
      panel.querySelector("button").addEventListener("click", next);
      root.querySelector(".screen")?.append(panel);
    }
    panel.hidden = false;
    panel.dataset.type = current.cue.type;
    panel.dataset.speaker = current.cue.speaker;
    panel.querySelector("b").textContent = current.enemy.name || current.enemy.id;
    panel.querySelector("p").textContent = current.cue.content;
    panel.querySelector("p").scrollTop = 0;
    if (opening) focusPending = true;
    focusNewPanel();
    voiceReady = false;
    const line = current;
    voice = new AbortController();
    const signal = voice.signal;
    const spoken = line.spoken;
    line.spoken = true;
    Promise.resolve()
      .then(() => {
        if (disposed || signal.aborted || spoken) return;
        return audio?.speak(
          { speaker: line.enemy.name, text: line.cue.content, thought: line.cue.type === "thought" },
          line.enemy,
          signal,
        );
      })
      .catch(() => {})
      .finally(() => {
        if (disposed || signal.aborted || current !== line) return;
        voiceReady = true;
        syncAuto();
      });
  }
  function next() {
    if (disposed || !current) return;
    clearTimer();
    voice?.abort();
    state.queue.shift();
    show();
  }
  function enqueue(matches) {
    for (const cue of matches) {
      const id = key(cue);
      if (state.seen.has(id)) continue;
      state.seen.add(id);
      state.queue.push({ cue, enemy: enemies.get(cue.speaker), spoken: false });
    }
    if (!current && state.queue.length) show();
  }
  autoButton?.addEventListener("click", syncAuto);
  if (state.queue.length) show();
  return {
    get busy() {
      return state.queue.length > 0;
    },
    frame(frame) {
      const round = frame.round;
      if (!(round > state.round)) return;
      state.round = round;
      if (frame.events?.some((event) => event.op === "start")) enqueue(cues.filter((cue) => cue.trigger === "intro"));
      enqueue(
        cues.filter(
          (cue) =>
            cue.trigger === "round" &&
            (state.hp.get(cue.speaker) ?? 100) > 0 &&
            round >= (cue.round || 1) &&
            (!cue.everyNRounds || round % cue.everyNRounds === 0),
        ),
      );
    },
    event(event) {
      const trigger = { start: "intro", act: "attack", ult: "attack", hit: "hit", charge: "charge" }[event.op];
      if (trigger)
        enqueue(
          cues.filter((cue) => cue.trigger === trigger && (trigger === "intro" || cue.speaker === String(event.id))),
        );
      if (event.op !== "hit" && event.op !== "hp") return;
      const id = String(event.id);
      if (!enemies.has(id)) return;
      const hp = Number(event.hpPct ?? event.pct);
      if (!Number.isFinite(hp)) return;
      const previous = state.hp.get(id) ?? 100;
      state.hp.set(id, hp);
      if (hp <= 0) return;
      enqueue(
        cues.filter((cue) => {
          const threshold = { phase_75: 75, phase_50: 50, phase_25: 25, low_hp: 25 }[cue.trigger];
          return cue.speaker === id && threshold && previous > threshold && hp <= threshold;
        }),
      );
    },
    finish(result, callback) {
      if (disposed || state.finished) return;
      onFinished = callback;
      enqueue(cues.filter((cue) => cue.trigger === (result === "lose" ? "defeat" : "victory")));
      if (!state.queue.length) show();
    },
    syncAuto,
    dispose() {
      disposed = true;
      clearTimer();
      voice?.abort();
      onFinished = null;
      autoButton?.removeEventListener("click", syncAuto);
      panel?.remove();
    },
  };
}
