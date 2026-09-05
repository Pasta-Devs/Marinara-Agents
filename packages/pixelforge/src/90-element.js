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
  // The window control currently asking to skip unread story, WHO it is asking
  // about and WHICH GM turn — `{anchorId, controlId, turn}`, or null. See
  // `talkSend()` — it is one press of state and nothing persists it.
  _talkConfirm: null,
  // The NPC OBJECT the open talk window is anchored to, captured at open. The
  // sim's `talkAnchorId` is the truth about whether a conversation is live; this
  // is what the window RENDERS from and what press-time liveness is checked
  // against by identity. Meaningful only while the latch is set — every reader
  // tests the latch first, and the HUD's reconcile closes the window outright if
  // the two ever disagree, so a stale object here can never be read.
  _talkAnchor: null,
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

    // THE GM'S SKY, RECONCILED. The host hands us the whole metadata blob on
    // every props delivery, so a future writer patching `pixelforgeWeather`
    // mid-story is answered here — the town re-places under the new sky the
    // moment the key lands, without waiting for a boundary.
    //
    // COMPARED AGAINST THE APPLIED MEMO, never against `sim.weatherOverride`.
    // The memo tracks METADATA, which a console never touches, so a summoned
    // storm is invisible to this and no props delivery claws it back — where a
    // comparison against the live field would have re-folded the absent key to
    // null on the first streamed token, called that a change, and undone it. An
    // unchanged or absent key assigns nothing and re-resolves nothing, which
    // matters on a surface that runs once per turn and then some.
    if (this.sim) {
      const folded = PF.weather.foldOverride(meta.pixelforgeWeather);
      const applied = PF.weather.overrideKey(folded);
      if (applied !== this.sim._weatherMetaApplied) {
        this.sim.weatherOverride = folded;
        this.sim._weatherMetaApplied = applied;
        this.sim.resolveSchedules();
      }
    }

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
    // AND SO DOES AN OPEN CONVERSATION, for the same reason and with one more
    // thing to take with it: the window's DOM and the document-level pointerdown
    // pair it bound, which is not a child of anything a teardown removes.
    //
    // ONE SITING HONESTY, so a later fix does not "repair" it: `this.sim` was
    // reassigned two screens up (`PF.save.restore`), so the latch cleared here is
    // a CONSTRUCTOR-FRESH null on a brand-new sim, not the departing sim's. That
    // is harmless by design — the old sim is discarded whole, and the declaration
    // in the constructor is what actually carries the "a fresh sim cannot inherit
    // a freeze" guarantee. Do not capture the old sim to make this line "work";
    // the load-bearing half here is the DOM and the listener.
    this.closeTalk();
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
    // THE CONVERSATION LATCH IS CLEARED ON THE WALK ENTRY, and this is the ONE
    // site that does it (plan §2.5). Not a new discipline — the function's own:
    // this is already "the one function that changes mode", and it already drops
    // `_talkConfirm` two lines down under a comment arguing exactly this hazard
    // class. Every dialogue exit in the tree ends in `setMode("walk")` — the
    // dialogue-Escape branch, `resume()`, the refusal arm and the `.catch` — so
    // the four-site clear-set a per-exit repair would create is one line here.
    //
    // THE RULE IS "THE WALK ENTRY", NOT "THE RETURN PATH", and that wording is
    // what makes it cover the fifth exit: combat or replay entered over a live
    // conversation returns through `setMode(this._resumeMode)`, whose range is
    // {walk, dialogue} by construction — walk when it interrupted an open window
    // (cleared here) and dialogue when it interrupted a paid press (where the
    // latch is SUPPOSED to survive, and the conversation ends at that mode's own
    // exits, which all end here). Do not bolt a second clear onto that call.
    //
    // AND THE EARLY RETURN AT THE TOP OF THIS FUNCTION IS LOAD-BEARING FOR IT:
    // Escape out of a paid press, open a new window on the next person, and the
    // original send's stale `.catch` finally fires its `setMode("walk")` — which
    // the already-in-walk return no-ops, so a stale rejection cannot null a live
    // latch. A "fix" that hoisted this clear above that return, or hung it off a
    // mode test outside this function, would kill live conversations.
    if (mode === "walk") this.sim.talkAnchorId = null;
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
  talkConfirmArmed(controlId) {
    if (!this._talkConfirm) return false;
    const anchorId = this.sim?.talkAnchorId ?? null;
    const turn = this.host?.latestAssistant?.id ?? null;
    // THE STALENESS HALF, and it is keyed to the ANCHOR rather than to a live
    // proximity read (plan §2.5). `nearNpc` self-clears the moment anybody
    // wanders nearer, so in the crowd this window exists for — a plaza, an inn —
    // the whole paid set was unpressable: press one armed, a neighbour drifted,
    // press two found the question gone and asked it again. The question belongs
    // to the person the conversation is WITH, and it goes stale when the
    // conversation ends, when the story is read, or when a new turn arrives.
    if (
      !this._storyPending() ||
      anchorId == null ||
      anchorId !== this._talkConfirm.anchorId ||
      turn !== this._talkConfirm.turn
    ) {
      this._talkConfirm = null;
      return false;
    }
    // THE CONTROL HALF, and it deliberately does NOT clear. A per-person memo
    // leaks permission across controls: arming on "Say something…" must not be
    // spendable on "Hand over", which settles an errand. Asking about a different
    // control is how that control comes to arm its own question, so the answer is
    // false and the memo stands. An argument-less read is the HUD asking "is
    // anything armed at all", which is a question about the person.
    return controlId === undefined || controlId === this._talkConfirm.controlId;
  },

  /** Is the talk window mounted right now? The mounted predicate, in one place,
   *  so the census button, the panel toggles and `interact()` all read the same
   *  fact the HUD renders from. */
  talkOpen() {
    return !!this.sim && this.sim.mode === "walk" && this.sim.talkAnchorId != null;
  },

  /** OPEN THE WINDOW on somebody. A zero-call read: nothing is composed, nothing
   *  is sent, and the GM is not told a conversation started. */
  openTalk(npc) {
    const sim = this.sim;
    if (!sim || !npc) return;
    this._talkAnchor = npc;
    sim.talkAnchorId = npc.id;
    // THE CUTSCENE CLEAR AT OPEN, on `setMode`'s own idiom two screens up and for
    // the same reason it lives there. The clock gate stops a beat from STARTING
    // over an open window; a beat already RUNNING when E was pressed would be the
    // symmetric, worse case — `stepCutscene` is the only thing that advances a
    // beat and the only thing that clears one, and it is now gated off, so the
    // beat would pin `sim.cutscene` non-null for the window's whole life: the
    // narration-collapse request stuck asserted and the caption painted dead
    // centre of the play field, which is where this panel goes. `_vistaArmed`
    // stays down deliberately: the player who pressed E mid-beat chose the
    // conversation over the view.
    sim.cutscene = null;
    this._cutsceneDeclared = false;
    this._declareChrome();
    this.hud?.onTalkOpened();
  },

  /** CLOSE IT, which is the same thing as ending the conversation: the latch is
   *  the single close authority, and unfreezing the clock and the partner is what
   *  closing MEANS. The DOM is reconciled off the same latch. */
  closeTalk() {
    if (this.sim) this.sim.talkAnchorId = null;
    this._talkAnchor = null;
    this.hud?._talkUnmount?.();
  },

  /** THE INTERACT PRESS — the E key and the census Talk button, unchanged as a
   *  surface and completely changed in what it does. It no longer SENDS: it opens
   *  the talk window on the person within reach, and pressing again closes it.
   *  Every GM call this used to make now lives behind a labelled control inside
   *  that window, routed through the one prologue below.
   *
   *  THE CLOSE HALF COMES FIRST, and as its own branch ahead of the WHOLE guard
   *  compound rather than merely ahead of the `nearNpc` term. Opening needs
   *  `nearNpc` (26px); the window survives out to 32px — so without the reroute,
   *  E was dead in that six-pixel band, neither opening nor closing. The compound
   *  below is one statement, so "ahead of the nearNpc guard" necessarily means
   *  ahead of the mode and null-sim terms too, and saying so is the point: this
   *  branch runs before all three. (The census button stays visible in dialogue
   *  mode, harmlessly — no window is mounted there and this branch no-ops.) */
  interact() {
    if (this.talkOpen()) {
      this.closeTalk();
      return;
    }
    const sim = this.sim;
    // OPENING IS A ZERO-CALL READ, so the guards are the ones that decide whether
    // there is anybody to talk to at all: walk mode (which is also the same-tick
    // re-entrancy fence), somebody within reach, and a world that has finished
    // being written. `sendMessage` and `isStreaming` are NOT among them any more —
    // those refuse a TURN, and this press no longer takes one; they moved into
    // the paid prologue, where the doors dim and say why.
    if (!sim || sim.mode !== "walk" || !sim.nearNpc) return;
    if (PF.save.gateHolds(this)) return; // nobody to talk to in a world still being written
    this.openTalk(sim.nearNpc);
  },

  /** THE ONE PAID PRESS (plan §2.5). Every control in the window labelled "(asks
   *  the GM)" comes through here — the free-talk door, the say door, the
   *  escalation follow-up, and one per outstanding errand — so the guard block
   *  that used to live inline in `interact()` is written once and every paid press
   *  passes all of it.
   *
   *  THE SEVEN STEPS, in order, and none of them was dropped in the move:
   *   (1) WALK MODE — the same-tick re-entrancy fence. A second press inside the
   *       setMode-to-rAF gap dies here, key repeat included: "the window closes on
   *       a mode change" is a next-frame RENDERING property, not a same-tick state
   *       check, and `isStreaming` is a prop that cannot cover the gap.
   *   (2) PRESS-TIME LIVENESS, AND THE LATCH BESIDE IT. `sentSim` is captured at
   *       SEND and is blind to a splice or a rebuild that landed BEFORE the press;
   *       this is that fence's missing front half. The latch check is the other
   *       half of a one-frame gap: a clock mover clears the latch sim-side, and
   *       the HUD does not reconcile the DOM away until the next frame — a press
   *       out of that zombie window must die here rather than compose.
   *   (3) `gateHolds`, which can ARM AFTER the window opened (`_switchChat` and
   *       `maybeGenerateBrief` both arm it) — and under the gate the sim is not
   *       stepped, so no sim-side check would ever run.
   *   (4) the host can take a turn at all;
   *   (5) `isStreaming` — a toast and no send. This is the ONE refusal that leaves
   *       the window MOUNTED, which is why the window's geometry has to leave the
   *       bottom toast band clear: painted over, it is a press that visibly did
   *       nothing.
   *   (6) THE RELOCATED SKIP CONFIRM, keyed {anchorId, controlId, turn} and read
   *       BEFORE anything is composed — `composePrefix` overwrites `_pendingIntro`,
   *       so a confirm asked after it would burn a tell for a turn never sent. The
   *       first press re-labels THE PRESSED CONTROL into the question; the second
   *       spends it. The 0.11 protection survives whole, translated from
   *       per-person staleness to per-anchor + per-control staleness: no press can
   *       spend unread narration without an affirmative press on the same control
   *       against the same person.
   *   (7) compose, send, and the single accepted-turn `.then`.
   *
   *  `settles` is per branch AND per row: a row id settles THAT errand, `true`
   *  settles every errand to the name (0.13's implicit handover, preserved
   *  verbatim for the free-talk door), and anything else settles nothing. */
  talkSend({ controlId, action, settles, onAccepted }) {
    const sim = this.sim;
    const anchor = this._talkAnchor;
    if (!sim || sim.mode !== "walk") return;
    if (!anchor || sim.talkAnchorId !== anchor.id || !sim.zone().npcs.includes(anchor)) {
      this.closeTalk();
      this.hud?.toast("They're not there any more.");
      return;
    }
    if (PF.save.gateHolds(this)) return;
    if (typeof this.host?.sendMessage !== "function") return;
    if (this.host.isStreaming) {
      this.hud?.toast("The story is still being written…");
      return;
    }
    // UNREAD STORY IS NOT SOMETHING A PRESS GETS TO SPEND (playtest 2). The
    // maintainer wandered off mid-narration, pressed E on the nearest NPC, and
    // lost everything from the arrival narration onward: the turn this sends ends
    // the one being presented, so the segments they had not reached never
    // appeared — they survived only in Logs — and nobody had said to skip them.
    //
    // WALKING IS NOT BLOCKED and never should be; the world staying live under
    // the narration is the point of it. What is gated is the TURN, and the
    // smallest honest gate is an affirmative press.
    //
    // A CONFIRM AND NOT A FAST-FORWARD, deliberately: presentation is advanced by
    // host-private state, so a package-side "skip" could only ever mean sending
    // anyway and calling it skipping.
    if (this._storyPending() && !this.talkConfirmArmed(controlId)) {
      this._talkConfirm = { anchorId: anchor.id, controlId, turn: this.host?.latestAssistant?.id ?? null };
      this.hud?.update();
      return;
    }
    this._talkConfirm = null;
    // The generation this turn belongs to. The .then() below runs after an await,
    // so a chat switch can land under it — and every mutator RE-RESOLVES core.sim,
    // which means an unfenced bump would credit the arriving chat's block with the
    // departing chat's conversation.
    const gen = PF.save._gen ?? 0;
    // THE HANDOFF, FREEZE TO FREEZE. This unmounts the window on the mounted
    // predicate's mode term and does NOT clear the latch: walk-with-latch froze
    // the clock and the partner through the gate, dialogue freezes them through
    // the mode test, and at the transition instant both are true. The latch
    // clears on the eventual `setMode("walk")`, whichever exit gets there.
    this.setMode("dialogue");
    this.hud?.toast(`Talking to ${anchor.name}`);
    const text = `${sim.composePrefix(anchor)} ${action}`;
    // THE COMPOSED TURN'S OWN PENDING, captured HERE and closure-local. Two
    // readings of this would be wrong and both are easy: re-reading
    // `sim._pendingIntro` after the await finds the null commitIntro left behind
    // and burns nothing FOREVER (the wrap-up would then be re-told on every turn
    // for the rest of the save), and re-reading it before the burn finds whatever
    // a sender that interleaved with this one composed instead. The object
    // reference survives the wholesale null, so the turn that was sent is the
    // turn that gets burned.
    const pend = sim._pendingIntro;
    // THE SIM THIS TURN WAS COMPOSED AGAINST, captured beside the pending and
    // read after the await. The generation fence one screen up cannot see this
    // one: `_gen` moves on a CHAT switch, while `_rebuild` replaces core.sim
    // wholesale on the same chat (a rewind, a checkpoint load, a swipe) without
    // touching it — and an errand settled against the replaced sim would pay out
    // of a story that no longer contains the walk up to this person. The refusal
    // is silent and costs one extra GM call in a race nobody will see: the quest
    // stays active and the player talks to them again.
    const sentSim = sim;
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
          //
          // AND IT STAYS OUTSIDE THE sentSim FENCE BELOW, deliberately. flush is
          // idempotent and monotone — a `flushedDay` gate that only ever moves
          // forward — and REBUILD-DESIGNED: it carries the told-flag notice rows
          // so a burn landing on a replaced sim marks the band THIS turn told, and
          // it reads the LIVE sim's own numbers to refuse on them. Fencing it on
          // object identity would drop the tell on a rebuild and re-say it forever
          // (§5 lost-flush). gen-guarded is the whole guard flush needs; the
          // promotion below needs more, which is why the two sit on opposite sides
          // of the fence.
          if (pend?.ledger) PF.player.flush(this, pend.ledger.throughDay, pend.ledger.notices, gen);
          if (sentSim === this.sim) {
            // P2's ledger goes live on the cheapest honest signal there is: the
            // encounter count moves when the host ACCEPTS the turn, exactly where
            // the one-shot intro flags burn, and for the same reason — a refused
            // or failed send is not a conversation. SETTLEMENT-scoped (plan §2:
            // rel keys are per settlement), so one person is one row wherever in
            // the world you happen to meet them.
            // CASUAL, and deliberately: this is the talk press, and small talk is
            // the class that cannot carry anybody past acquainted however long it
            // goes on (58-player CASUAL_CEILING).
            //
            // INSIDE THE sentSim FENCE, the SAME one `delivered()` below uses and
            // for the same reason it does: `_gen` moves on a chat switch, but
            // `_rebuild` (a rewind, a checkpoint load, a swipe) replaces `core.sim`
            // wholesale WITHOUT touching it, so the gen guard alone would let this
            // bump promote against the REPLACEMENT sim. A rung earned in a world
            // that was replaced under the await is not written to its replacement —
            // object identity catches the seam the generation cannot see.
            const bumped = PF.player.bump(this, sim.world.startZone, anchor.name, { t: 1 }, gen);
            // A rung earned by TALKING is announced where a rung earned by a job
            // already is (hud.questFilled) — same phrase, same authority, and only
            // on the call that crossed the line. HANDED to questFilled rather than
            // toasted beside it: an accepted turn is ONE event to the player, and
            // two toasts in a tick is one toast, so a rise said separately erased
            // the handover receipt standing next to it (70-hud `_said`).
            const rise = bumped?.rose ? { name: anchor.name, rung: bumped.rose } : null;
            onAccepted?.();
            // WHO THE ERRAND WAS RUN TO IS `anchor`, the binding the window and
            // this whole send were composed against, and NOT a live proximity
            // read: the `.then` runs after the host has had its whole thinking
            // time for somebody else to wander in. The delivery was to the
            // person the player was talking to.
            let done = [];
            if (settles) done = PF.pack.delivered(this, anchor.name, gen, settles === true ? "" : settles);
            // ONE EVENT, ONE SENTENCE: the errands filed and the rung earned on
            // this accepted turn are handed to the composer together (70-hud
            // `_said`). A replaced sim reaches none of this — no promotion and no
            // announcement — which is the whole point of moving it inside.
            this.hud?.questFilled(done, rise);
          }
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

  /** THE FREE-TALK DOOR — the 0.13 greeting, verbatim, relocated into the window.
   *  It settles EVERY errand to the name, which is 0.13's implicit handover kept
   *  exactly as it was: the labelled rows are A mechanism for finishing an errand
   *  on purpose, not the only one. */
  talkFree() {
    const npc = this._talkAnchor;
    if (!npc) return;
    this.talkSend({
      controlId: "free",
      action: `I walk up to ${npc.name} the ${npc.role} and greet them.`,
      settles: true,
    });
  },

  /** THE SAY DOOR. NO LENGTH CAP is imposed here, and that is the one deliberate
   *  exception in a package that caps every other part of a composed turn at a
   *  named number (situation 240, place flavor 120, persona 100, names 24). The
   *  difference is what the text IS: every door those caps govern is STORED DATA
   *  re-entering composition, and this is live player input, typed this second by
   *  the person whose turn it is. If the host refuses the turn the player gets the
   *  generic refusal and the typed text is not preserved — said plainly, because
   *  the downstream bound is not something this package can see. */
  talkSay(text) {
    const npc = this._talkAnchor;
    const said = String(text ?? "");
    if (!npc || !said) return;
    this.talkSend({ controlId: "say", action: `I say to ${npc.name} the ${npc.role}: "${said}"`, settles: false });
  },

  /** THE ESCALATION FOLLOW-UP, ratcheted per session: it retires on the ACCEPTED
   *  turn and comes back only when the pack fold is rebuilt (a reload, a rewind, a
   *  chat switch) — the `_filled` class of recorded cost. */
  talkPress() {
    const npc = this._talkAnchor;
    if (!npc) return;
    this.talkSend({
      controlId: "press",
      action: `I press ${npc.name} the ${npc.role} about what they were hinting at.`,
      settles: false,
      onAccepted: () => PF.pack.askBurn(this, npc),
    });
  },

  /** ONE ERRAND, BY ROW ID. The id and never the row object: the branch was drawn
   *  when the window opened and settles after an await, so the object is stale by
   *  construction and `settle` pays off whatever it is handed. `delivered` re-finds
   *  the live row at press time and refuses on a miss. */
  talkHandOver(rowId) {
    const npc = this._talkAnchor;
    const id = String(rowId ?? "");
    if (!npc || !id) return;
    this.talkSend({
      controlId: `deliver:${id}`,
      action: `I hand over what I was asked to bring ${npc.name} the ${npc.role}.`,
      settles: id,
    });
  },

  /** A ZONE THE PLAYER WALKED INTO — the frame loop's own arrival, and one of the
   *  two real zone-change callers in the package (50-spatial's drift arm is the
   *  other, and it is the async one). Lifted out of the tick rather than left
   *  inline: this is arrival BEHAVIOUR and not frame plumbing, the drift arm has
   *  to do the same things, and inline in a `requestAnimationFrame` closure it
   *  was the one branch here nothing could drive.
   *
   *  SYNCHRONOUS, so the generation is read FRESH (plan §2.3's gen sourcing): the
   *  player is standing in the new zone by the time this runs and there is no
   *  await for a chat switch to slip through. The captures belong to the two
   *  senders, which really do wait. */
  _zoneChanged() {
    const sim = this.sim;
    if (!sim) return;
    this.hud?.refreshChips();
    // "location": the top strip, clear of the narration panel the bottom
    // toast surface sits over (70-hud `toast`).
    this.hud?.toast(sim.zone().name, "location");
    // THE VISIT VERB COMPLETES ON ENTRY (0.13 §2.3): the walk was the quest. The
    // pack answers whether this arrival finished anything and the HUD says so —
    // the toast above is where the player is, this is what it was worth.
    this.hud?.questFilled(PF.pack.visited(this, sim.zoneId, PF.save._gen ?? 0));
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
      // ESCAPE CLOSES THE TALK WINDOW, and it is ABOVE the gate return on purpose
      // (plan §2.5). The gate can ARM while a window is open — `_switchChat` and
      // `maybeGenerateBrief` both do it — and under it every branch below this
      // line is dead, so a window mounted at that moment was a keyboard-dead
      // surface over "Writing your world…" with the clock stopped behind it. The
      // HUD's per-frame reconcile closes it too; this is the key half of the same
      // hole, and it is worth having because the two run on different signals.
      //
      // AND IT CLOSES THE ONLY WAY A CLOSE IS DEFINED: by CLEARING THE LATCH, a
      // sim write. A DOM-only close would leave the latch set, and the mounted
      // predicate would put the window straight back on the next frame — a window
      // that will not close, with a symptom pointing nowhere near its cause.
      const t = ev.target;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!typing && this.talkOpen() && String(ev.key).toLowerCase() === "escape") {
        this.closeTalk();
        return;
      }
      if (PF.save.gateHolds(this)) return; // nothing to walk in yet
      // Typing goes to whoever is being typed into — the host's message box, or
      // the window's own Say field, which carries its own Escape and Enter.
      if (typing) return;
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
        if (res.zoneChanged) this._zoneChanged();
      }
      // The notable-sky lines the clock movers parked. The sim holds no core and
      // no generation, so it cannot file its own — it queues `{text, day}` rows
      // and a frame spends them. The DAY RIDES: a multi-day fishing session files
      // day 12's snow under day 12, not under the day the drain happened to run.
      if (sim._weatherNotes.length) {
        const gen = PF.save._gen ?? 0;
        for (const note of sim._weatherNotes.splice(0)) PF.player.log(this, note.text, note.day, gen);
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
