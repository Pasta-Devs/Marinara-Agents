// ── Core singleton + custom element (double-mount adapter) ────────────────────
// The host instantiates the SAME element twice with view="surface": an underlay
// (props: {layer:"underlay", backgroundUrl}) that must render the world, and a
// z-30 main mount (full engine props, no `layer` key) that must render only the
// HUD. `layer` is UNKNOWN at connectedCallback — props land afterwards — so all
// role wiring happens on props arrival. Both instances couple through this
// module-scope singleton with a one-canvas-ever invariant; a version bump or
// error-retry remounts BOTH elements and the singleton must survive it.
PF.core = {
  chatId: null,
  sim: null,
  render: null,
  hud: null,
  host: null, // latest main-mount props
  input: { up: false, down: false, left: false, right: false },
  canvas: null,
  _underlayEl: null,
  _underlayWrap: null,
  _mainEl: null,
  _raf: 0,
  _lastT: 0,
  _acc: 0,
  _narrationDoneWas: true,
  // The person the Talk button is currently asking to skip unread story for AND
  // the GM turn it is asking about, or null. See interact() — it is one press of
  // state and nothing persists it.
  _talkConfirm: null,
  _keysBound: false,
  _resizeObs: null,
  _resumeMode: "walk", // mode to restore when combat/replay ends
  _combatOverride: false, // player chose to keep exploring during a narrative "combat" state
  _lastPosSave: 0,

  // ── attachment ──────────────────────────────────────────────────────────────
  attachUnderlay(el, props) {
    if (this._underlayEl === el) return;
    this._underlayEl = el;
    el.style.display = "block";
    if (!this.canvas) {
      this.canvas = PF.offscreen(PF.VW, PF.VH);
      this.canvas.style.cssText = "image-rendering:pixelated;image-rendering:crisp-edges;display:block;";
      this.render = new PF.Render(this.canvas);
    }
    if (!this._underlayWrap) {
      this._underlayWrap = PF.el("div", {
        style: "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;",
      });
      this._underlayWrap.appendChild(this.canvas);
    }
    el.replaceChildren(this._underlayWrap);
    this._resizeObs?.disconnect();
    this._resizeObs = new ResizeObserver(() => this._rescale());
    this._resizeObs.observe(el);
    this._rescale();
    this._ensureLoop();
    void props; // backgroundUrl is painted by the host behind us; nothing to do yet
  },

  attachMain(el, props) {
    if (this._mainEl !== el) {
      this._mainEl = el;
      el.style.display = "block";
      this.hud?.destroy();
      this.hud = new PF.Hud(el, this);
      this._bindKeys();
    }
    this.onMainProps(props);
    this._ensureLoop();
  },

  detach(el) {
    if (el === this._underlayEl) {
      this._underlayEl = null;
      this._resizeObs?.disconnect();
      this._resizeObs = null;
    }
    if (el === this._mainEl) {
      this._mainEl = null;
      this.hud?.destroy();
      this.hud = null;
      this._unbindKeys();
      // Hand classic chrome back so an error/unmount can never strand the
      // player with no turn input (review blocker): the host clears its seam
      // state only on chat switch, not on element unmount.
      this._releaseChrome();
    }
    if (!this._underlayEl && !this._mainEl) {
      // Last detach: stop the loop and flush. Element remounts (version bump,
      // retry) recreate both instances momentarily; state stays in the module
      // so the rebuild is seamless. The page is still alive here — a real exit
      // fires pagehide, which takes the out-of-band teardown path — so this
      // keeps the ordinary checked flush and may still re-arm on failure.
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      void PF.save.flush(this, true);
    }
  },

  _rescale() {
    if (!this._underlayEl || !this.canvas) return;
    const w = this._underlayEl.clientWidth || PF.VW;
    const h = this._underlayEl.clientHeight || PF.VH;
    let scale = Math.min(w / PF.VW, h / PF.VH);
    if (scale >= 1) scale = Math.floor(scale); // integer scale = real pixel art
    this.canvas.style.width = `${Math.round(PF.VW * scale)}px`;
    this.canvas.style.height = `${Math.round(PF.VH * scale)}px`;
  },

  // ── props / state ───────────────────────────────────────────────────────────
  onMainProps(p) {
    if (!p || typeof p.chatId !== "string") return;
    if (p.chatId !== this.chatId) this._switchChat(p);
    this.host = p;
    // Tier-1 art rides the packageId/packageVersion the host injects (engine
    // #5092); load() is idempotent and Tier-0 remains the fallback throughout.
    void PF.assets.load(this);

    // Self-heal an erased save key (engine's unqueued updateMetadata writers —
    // issue #5076 class; review finding).
    const meta = p.chatMeta && typeof p.chatMeta === "object" ? p.chatMeta : {};
    PF.save.ensurePresent(this, meta);

    // Mode arbitration: replay > combat > (walk|dialogue kept as-is).
    // Prefer the real combat signal (Capability API 1.11, #5094): true the
    // instant the combat UI actually mounts. Fallback for older engines is the
    // GM's NARRATIVE gameActiveState — which can say "combat" without any
    // combat UI mounting, so it pauses the world but the HUD always keeps a
    // Resume exit, and the player's override wins until the state clears.
    this._combatSignalIsReal = typeof p.combatActive === "boolean";
    const combatState = this._combatSignalIsReal ? p.combatActive : meta.gameActiveState === "combat";
    if (!combatState) this._combatOverride = false;
    // A failed encounter generation would otherwise leave the player watching
    // for a combat that never comes — surface it once per distinct error.
    if (p.combatError && p.combatError !== this._lastCombatError) {
      this._lastCombatError = p.combatError;
      this.hud?.toast("The encounter fizzled — try again.");
    }
    if (p.replayActive) this.setMode("replay");
    else if (combatState && !this._combatOverride) this.setMode("combat");
    else if (this.sim && (this.sim.mode === "replay" || this.sim.mode === "combat")) this.setMode(this._resumeMode);

    // Turn finished → the GM may have moved the party or changed the world —
    // and the timeline may have moved under us (swipe/branch/checkpoint load):
    // in routes mode the anchored server row is the authority, so check it.
    const narrationDone = p.narrationDone !== false;
    if (narrationDone && !this._narrationDoneWas) {
      void PF.spatial.refresh(this);
      void PF.save.checkRewind(this);
      PF.save.markDirty(this);
    }
    this._narrationDoneWas = narrationDone;
    // Declared every props delivery: the host wipes its seam state on scope
    // changes the package can't see, and it dedupes identical declarations
    // by value itself — a package-side cache only causes lost declarations.
    this._declareChrome();
  },

  _switchChat(p) {
    // The pending write belongs to the chat we are LEAVING, so capture it
    // SYNCHRONOUSLY — reset() clears the dedupe caches and the lines below
    // reassign chatId/sim, and a chained flush that snapshotted later wrote
    // the NEW chat's world under the new id while the old chat's last
    // mutation went in the bin.
    const pending = this.chatId ? PF.save.captureFlush(this) : null;
    PF.spatial.reset();
    PF.save.reset();
    if (pending) void PF.save.flush(this, false, pending);
    this.chatId = p.chatId;
    // Synchronous boot from the metadata cache (instant world), then adopt()
    // probes the experience-state routes (#5102) and, when available, promotes
    // the timeline-anchored server row to authority — rebuilding if it differs.
    this.sim = PF.save.restore(p.chatMeta ?? {}, p.chatId);
    this.host = p;
    // THE LOADING GATE (plan §Q3b, maintainer ruling #7). A generate-configured
    // chat whose brief is not sealed yet does not enter play: the surface shows a
    // loading state, the sim does not step, no mutator resolves and no save is
    // emitted, until the brief seals and the world compiles. Armed BEFORE adopt
    // because adopt's row-3 branch is a write, and a chat that has not been
    // entered must not have its placeholder world written up as somebody's play.
    // Legacy and non-generate chats never arm it and play immediately.
    if (!PF.save.armGate(this, p.chatMeta ?? {})) void PF.save.adopt(this);
    // Generation runs behind the gate; on success it compiles the world, lifts the
    // gate and calls adopt itself. On failure the gate offers retry and the chat
    // stays unsealed, so the next visit arms it again.
    void PF.save.maybeGenerateBrief(this);
    // New chat, new world: drop every cached zone composite — the cache is
    // keyed by zone id alone, so a stale entry would show the previous game.
    this.render?.clearZones();
    this._resumeMode = "walk";
    this._combatOverride = false;
    // A pending skip-confirm belongs to the chat that armed it: the NPC it names
    // is an id in the OLD world, and the arriving chat's narration is its own
    // question. (talkConfirmArmed drops it on its own too — this is the seam
    // where "the same id in a different world" could otherwise match.)
    this._talkConfirm = null;
    this._lastPosSave = 0;
    this.hud?.refreshChips();
    void PF.spatial.refresh(this);
  },

  setMode(mode) {
    if (!this.sim || this.sim.mode === mode) return;
    const prev = this.sim.mode;
    if ((mode === "combat" || mode === "replay") && (prev === "walk" || prev === "dialogue")) {
      this._resumeMode = prev; // don't collapse dialogue into walk on exit (review finding)
    }
    this.sim.mode = mode;
    // A pending skip-confirm does not survive the mode changing under it. The
    // question is asked in walk mode standing next to somebody, and every way out
    // of that frame — the Keyboard button handing the turn to the host, a cutscene
    // beat, combat, the send path itself — is the player doing something else with
    // the narration than the question was about. Cheapest honest rule: switching
    // modes drops it, so coming back to walk asks again. (Named as a clear
    // condition by the fix that introduced the confirm; this is where it is true.)
    this._talkConfirm = null;
    // Replay returns out of the frame loop before sim.step(), so the sim's own
    // walk-only guard can never fire for it — the one function that changes mode
    // drops the beat instead, and the declaration below is honest immediately.
    if (mode !== "walk") {
      this.sim.cutscene = null;
      // The frame loop re-declares only when the beat state DIFFERS from the
      // memo of what we last asked for, so dropping the beat has to move the
      // memo too. Left stale at true, the next beat matches it and is never
      // declared — the host is never asked to collapse that one (review finding).
      this._cutsceneDeclared = false;
    }
    this.input.up = this.input.down = this.input.left = this.input.right = false;
    this._declareChrome();
    this.hud?.update();
  },

  /** Resume button: exits dialogue, or overrides a narrative-only combat state.
   *  When the engine provides the REAL combat signal (Capability API 1.11) the
   *  combat UI actually owns the screen, so there is nothing to override —
   *  the HUD simply stays hidden until combat ends. */
  resume() {
    if (!this.sim) return;
    if (this.sim.mode === "combat") {
      if (this._combatSignalIsReal) return;
      this._combatOverride = true;
    }
    this._resumeMode = "walk";
    this.setMode("walk");
  },

  _declareChrome() {
    const fn = this.host?.setExperienceChrome;
    if (typeof fn !== "function" || !this.sim) return;
    try {
      fn({
        // The gate takes the input claim with it: while it holds there is nothing
        // to walk in, and leaving the claim up would strand the player with the
        // classic turn chrome hidden behind a loading panel.
        providesPlayerInput: this.sim.mode === "walk" && !PF.save.gateHolds(this),
        // Transient: asked only while a cutscene beat runs. The host restores
        // the player's own setting the moment we stop asking, and its own
        // safety rules still outrank us, so this can never trap a player.
        requestsCollapsedNarration: !!this.sim.cutscene,
        providesChoices: false,
        providesInventory: false,
        providesCombat: false,
      });
    } catch (err) {
      // Recoverable — never escalate to the runtime-error contract (it unmounts
      // the surface and its retry card is pointer-events-none; review blocker).
      console.warn("[pixelforge] chrome declaration failed", err);
    }
  },

  _releaseChrome() {
    const fn = this.host?.setExperienceChrome;
    if (typeof fn !== "function") return;
    try {
      fn(null);
    } catch {
      /* releasing must never throw */
    }
  },

  // ── interaction ─────────────────────────────────────────────────────────────

  /** Does the latest GM turn still hold narration the player has not been shown?
   *
   *  `narrationDone` is the host's per-turn presentation flag: it goes true when
   *  the player reaches the last segment of the latest assistant message, and it
   *  is the ONLY narration-presentation signal on the surface props — there is no
   *  segment count, no cursor, and no way to advance the presentation from here.
   *  So this is a question the package can ask and not one it can answer.
   *
   *  `latestAssistant` is the second half and not a belt-and-braces check: with
   *  no assistant turn on the chat at all the host has no message to compare its
   *  done-marker against, so `narrationDone` is false for a chat that has no
   *  story in it yet — and a greeting in an empty chat skips nothing. */
  _storyPending() {
    return this.host?.narrationDone === false && !!this.host?.latestAssistant;
  },

  /** Is the Talk button asking to skip unread story right now?
   *
   *  ALSO where the question goes stale, so the button and the verb can never
   *  disagree about what a press means: the narration finishing, walking away,
   *  and walking to somebody else all drop it. Read every frame by the HUD.
   *
   *  THE TURN IS PART OF THE QUESTION, not just the person. `narrationDone` is
   *  per-turn and goes false again for every new GM turn, so "still pending" is
   *  not the same fact from one turn to the next: the player can arm the confirm
   *  against turn A, type into the host's own message box instead of pressing
   *  again, and have turn B arrive unread — and a confirm that only remembered
   *  the NPC would let ONE press spend B on the permission they gave for A. The
   *  permission was for the narration they had decided to skip; a different one
   *  is asked about in its own right. */
  talkConfirmArmed() {
    if (!this._talkConfirm) return false;
    const npc = this.sim?.nearNpc;
    const turn = this.host?.latestAssistant?.id ?? null;
    if (!this._storyPending() || !npc || npc.id !== this._talkConfirm.id || turn !== this._talkConfirm.turn) {
      this._talkConfirm = null;
      return false;
    }
    return true;
  },

  interact() {
    const sim = this.sim;
    if (!sim || sim.mode !== "walk" || !sim.nearNpc) return;
    if (PF.save.gateHolds(this)) return; // nobody to talk to in a world still being written
    if (!this.host?.sendMessage) return;
    if (this.host.isStreaming) {
      this.hud?.toast("The story is still being written…");
      return;
    }
    const npc = sim.nearNpc;
    // UNREAD STORY IS NOT SOMETHING A GREETING GETS TO SPEND (playtest 2).
    // The maintainer wandered off mid-narration, pressed E on the nearest NPC,
    // and lost everything from the arrival narration onward: the turn this sends
    // ends the one being presented, so the segments they had not reached simply
    // never appeared — survived only in Logs — and they never said to skip them.
    //
    // WALKING IS NOT BLOCKED and never should be; the world staying live under
    // the narration is the point of it. What is gated is the TURN, and the
    // smallest honest gate is an affirmative press: the first one turns the
    // button into the question and sends nothing, the second sends. The keyboard
    // path is the same button, so `e` asks once too.
    //
    // A CONFIRM AND NOT A FAST-FORWARD, deliberately. Fast-forwarding is the
    // better affordance and the package cannot do it: presentation is advanced by
    // host-private state (there is no such call on the surface props), so a
    // package-side "skip" could only ever mean sending anyway and calling it
    // skipping. The dialogue model that would make this moot is a roadmap item.
    if (this._storyPending() && !this.talkConfirmArmed()) {
      // Keyed on the TURN as well as the person: _storyPending() has already
      // established there is a latest assistant turn, and the permission the
      // second press gives is permission to spend THAT one.
      this._talkConfirm = { id: npc.id, turn: this.host?.latestAssistant?.id ?? null };
      this.hud?.toast("Story still to read — press again to skip ahead and talk.");
      this.hud?.update();
      return;
    }
    this._talkConfirm = null;
    // The generation this turn belongs to. The .then() below runs after an await,
    // so a chat switch can land under it — and every mutator RE-RESOLVES core.sim,
    // which means an unfenced bump would credit the arriving chat's block with the
    // departing chat's conversation.
    const gen = PF.save._gen ?? 0;
    this.setMode("dialogue");
    this.hud?.toast(`Talking to ${npc.name}`);
    const text = `${sim.composePrefix(npc)} I walk up to ${npc.name} the ${npc.role} and greet them.`;
    // THE COMPOSED TURN'S OWN PENDING, captured HERE and closure-local. Two
    // readings of this would be wrong and both are easy: re-reading
    // `sim._pendingIntro` after the await finds the null commitIntro left behind
    // and burns nothing FOREVER (the wrap-up would then be re-told on every turn
    // for the rest of the save), and re-reading it before the burn finds whatever
    // a sender that interleaved with this one composed instead. The object
    // reference survives the wholesale null, so the turn that was sent is the
    // turn that gets burned.
    const pend = sim._pendingIntro;
    void Promise.resolve(this.host.sendMessage(text))
      .then((ok) => {
        if (ok === false) {
          this.setMode("walk");
          this.hud?.toast("The story isn't accepting turns right now.");
        } else {
          sim.commitIntro();
          // THE WRAP-UP BURN, on the same accepted-turn signal the one-shot flags
          // burn on and for the same reason: a refused or failed send is not a
          // telling. The mutator guards itself against the sim having moved under
          // the await, and a refusal is SWALLOWED — no toast, no retry. The tell
          // stays in history un-burned and the next compose says it again, which
          // is a §5 lost-flush and not something to interrupt anybody about.
          // The pending carries the notice ROWS as well as the day, so the burn
          // marks the band THIS turn told rather than the live one, which a
          // rebuild can have appended to under the await (plan §2.5).
          if (pend?.ledger) PF.player.flush(this, pend.ledger.throughDay, pend.ledger.notices, gen);
          // P2's ledger goes live on the cheapest honest signal there is: the
          // encounter count moves when the host ACCEPTS the turn, exactly where
          // the one-shot intro flags burn, and for the same reason — a refused
          // or failed send is not a conversation. SETTLEMENT-scoped (plan §2:
          // rel keys are per settlement), so one person is one row wherever in
          // the world you happen to meet them. Surfacing the disposition in the
          // turn header is P2's own item and deliberately not here.
          PF.player.bump(this, sim.world.startZone, npc.name, { t: 1 }, gen);
        }
      })
      .catch((err) => {
        // Recoverable per-turn failure: stay mounted, tell the player, move on.
        this.setMode("walk");
        this.hud?.toast("That didn't go through — try again.");
        console.warn("[pixelforge] interact send failed", err);
      });
    PF.save.markDirty(this);
  },

  markDirty() {
    if (this.sim) PF.save.markDirty(this);
  },

  // ── input ───────────────────────────────────────────────────────────────────
  _hostOwnsKeyboard() {
    // Never fight the host for keys. Two checks, deliberately narrow (the
    // first live playtest showed broad ones misfire — the toast container is
    // a permanently-mounted [data-chat-floating-panel]):
    // 1) focus is inside a host control (covers inputs, selects, menus,
    //    floating panels — focus follows interaction);
    // 2) a visible MODAL dialog is open (aria-modal, e.g. the setup wizard).
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae !== document.documentElement && !(this._mainEl && this._mainEl.contains(ae)))
      return true;
    for (const node of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  },

  _bindKeys() {
    if (this._keysBound) return;
    this._keysBound = true;
    const DIRS = {
      w: "up",
      arrowup: "up",
      s: "down",
      arrowdown: "down",
      a: "left",
      arrowleft: "left",
      d: "right",
      arrowright: "right",
    };
    this._keyDown = (ev) => {
      if (!this.sim || !this._mainEl) return;
      if (PF.save.gateHolds(this)) return; // nothing to walk in yet
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = ev.key.toLowerCase();
      if (this.sim.mode === "dialogue" && k === "escape") {
        this.setMode("walk");
        return;
      }
      if (this.sim.mode !== "walk" || this._hostOwnsKeyboard()) return;
      if (DIRS[k]) {
        this.input[DIRS[k]] = true;
        ev.preventDefault();
      } else if (k === "e") {
        // "e" only — Enter belongs to host buttons/menus (review finding)
        this.interact();
      } else if (k === "c") {
        // THE CHARACTER SHEET, and it is HERE rather than up beside the
        // dialogue-Escape branch on purpose (plan §2.8): everything above this
        // line is a guard the sheet needs — the loading gate, focus inside a
        // host control, a visible host modal, and walk mode — and a branch at
        // :451's level would skip every one of them.
        this.hud?.toggleSheet();
      } else if (k === "escape") {
        // …and Escape closes whichever panel is open. It cannot race the
        // dialogue-Escape branch above: that one returns, and a panel cannot be
        // open in dialogue mode at all, because leaving walk closes the sheet
        // and hides the journal (70-hud update()). No preventDefault, exactly as
        // the branch above and `e` beside it decline it — the host's own Escape
        // handling is not ours to cancel.
        this.hud?.closePanels();
      }
    };
    // keyup ALWAYS clears, whatever the target or open panels — otherwise a
    // keyup landing on an input leaves the avatar walking forever.
    this._keyUp = (ev) => {
      const dir = DIRS[ev.key.toLowerCase()];
      if (dir) this.input[dir] = false;
    };
    this._onBlur = () => {
      this.input.up = this.input.down = this.input.left = this.input.right = false;
    };
    window.addEventListener("keydown", this._keyDown);
    window.addEventListener("keyup", this._keyUp);
    window.addEventListener("blur", this._onBlur);
    if (!PF.core._pagehideBound) {
      PF.core._pagehideBound = true;
      // Out-of-band, NOT on the flush chain: the page is going away, and an
      // ordinary flush sitting mid-await would swallow the last write of the
      // session. Last-detach below keeps the chained path — that one is a
      // remount on a live page as often as it is a real exit.
      window.addEventListener("pagehide", () => PF.save.flushTeardown(PF.core));
    }
    if (!PF.core._capEventsBound) {
      PF.core._capEventsBound = true;
      // Capability API 1.12: the host addresses spatial transition events to
      // the game-owning package. One always-on listener, guarded by the live
      // chat id, so chat switches never leak or misroute a stale event.
      window.addEventListener("marinara-capability-server-event", (ev) => {
        const detail = ev?.detail;
        const core = PF.core;
        if (!detail || !core.chatId) return;
        if (detail.packageId !== (typeof core.host?.packageId === "string" ? core.host.packageId : "pixelforge"))
          return;
        if (detail.chatId !== core.chatId) return;
        PF.spatial.onHostEvent(core, detail);
      });
    }
  },

  _unbindKeys() {
    if (!this._keysBound) return;
    this._keysBound = false;
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("keyup", this._keyUp);
    window.removeEventListener("blur", this._onBlur);
  },

  // ── loop ────────────────────────────────────────────────────────────────────
  _ensureLoop() {
    if (this._raf) return;
    this._lastT = performance.now();
    const tick = (t) => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (t - this._lastT) / 1000);
      this._lastT = t;
      const sim = this.sim;
      if (!sim) return;
      if (PF.save.gateHolds(this)) {
        // THE LOADING GATE, ahead of every mode: no step, no clock, no draw. A sim
        // that stepped behind the loading panel would age a world nobody is in,
        // dirty itself against a save path that refuses to write, and burn the
        // cutscene beat before the player ever saw the place.
        this.render?.ctx.clearRect(0, 0, PF.VW, PF.VH);
        this.hud?.update();
        return;
      }
      if (sim.mode === "replay") {
        // Replay owns the screen: clear so the host visuals show through.
        this.render?.ctx.clearRect(0, 0, PF.VW, PF.VH);
        this.hud?.update();
        return;
      }
      this._acc = Math.min(this._acc + dt, 0.25);
      const STEP = 1 / 60;
      while (this._acc >= STEP) {
        this._acc -= STEP;
        const res = sim.step(STEP, this.input);
        // A beat starting or ending changes what chrome we are asking for.
        if (!!sim.cutscene !== this._cutsceneDeclared) {
          this._cutsceneDeclared = !!sim.cutscene;
          this._declareChrome();
        }
        if (res.zoneChanged) {
          this.hud?.refreshChips();
          // "location": the top strip, clear of the narration panel the bottom
          // toast surface sits over (70-hud `toast`).
          this.hud?.toast(sim.zone().name, "location");
          PF.save.markDirty(this);
        }
      }
      if (this._underlayEl) this.render?.draw(sim);
      // Positional autosave: at most one save per 30s of movement — the real
      // save triggers are events (zone change, dialogue, travel, turn end).
      // Never per-frame, never every debounce window (review finding).
      if (sim.dirty && t - this._lastPosSave > 30_000) {
        this._lastPosSave = t;
        PF.save.markDirty(this);
      }
      this.hud?.update();
    };
    this._raf = requestAnimationFrame(tick);
  },
};

// ── Custom element ────────────────────────────────────────────────────────────
class PixelforgeElement extends HTMLElement {
  constructor() {
    super();
    this._props = null;
    this._onPropsEvent = () => this._sync();
  }
  // The host assigns node.capabilityProps then dispatches marinara-capability-props;
  // support both the accessor and the event so either ordering works.
  set capabilityProps(value) {
    this._props = value;
    this._sync();
  }
  get capabilityProps() {
    return this._props;
  }
  connectedCallback() {
    this.addEventListener("marinara-capability-props", this._onPropsEvent);
    this._sync();
  }
  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this._onPropsEvent);
    PF.core.detach(this);
  }
  _sync() {
    try {
      const view = this.getAttribute("view");
      const p = this._props;
      if (view === "setup") {
        if (p && typeof p.onLaunch === "function") PF.mountSetup(this, p);
        return;
      }
      if (view !== "surface" || !p) return;
      if (p.layer === "underlay") PF.core.attachUnderlay(this, p);
      else if (typeof p.chatId === "string") PF.core.attachMain(this, p);
    } catch (err) {
      // Unrecoverable wiring failure: hand classic chrome back FIRST so the
      // host's error card never strands the player without turn input.
      PF.core._releaseChrome();
      PF.fail(this, err);
    }
  }
}

const PF_TAG = "marinara-capability-pixelforge";
if (!customElements.get(PF_TAG)) customElements.define(PF_TAG, PixelforgeElement);

// Debug/testing handle: lets automated playtests (and future Playwright smoke
// lanes) inspect and step the world without relying on requestAnimationFrame,
// which browsers pause for non-composited tabs. The package runs full-trust in
// the main realm anyway, so this exposes nothing that wasn't already reachable.
// Gated behind an explicit opt-in so a shipped install doesn't hand other page
// scripts a ready-made driving handle (capability-equivalent to what any
// same-document script already has, but no reason to pre-assemble it).
try {
  if (globalThis.localStorage?.getItem("pixelforge-debug") === "1") globalThis.__pixelforge = PF;
} catch {
  // Storage access can throw in exotic embeddings; the handle just stays off.
}
