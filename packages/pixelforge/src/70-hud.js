// ── HUD (main mount) ──────────────────────────────────────────────────────────
// Everything interactive lives here, in the z-30 main mount: location/clock
// chips, touch D-pad, Talk / Travel / Keyboard controls, toasts. The root is
// pointer-events:none; each control opts back in — clicks in empty space fall
// through to the narration below (host contract).
PF.Hud = class {
  constructor(rootEl, core) {
    this.core = core;
    const chip =
      "pointer-events:auto;background:rgba(20,24,20,0.82);color:#f3efe2;border:1px solid rgba(243,239,226,0.25);" +
      "border-radius:6px;padding:3px 9px;font:600 11px/1.5 ui-monospace,Consolas,monospace;white-space:nowrap;";
    const S = {
      chip,
      // THE PANEL OPENERS' clothes (plan §2.8). The topbar has NO width machinery
      // — centred flex, nowrap chips, unbounded location prose, no overflow
      // handling — so the openers are GLYPH-WIDTH by construction: one emoji plus
      // an aria-label, never a word that grows with a translation. That IS the
      // width argument, and it is what keeps the bar to the single row the
      // location toast is pinned 42px under. They are BUTTONS rather than the
      // spans beside them, because a control has to be pressable and focusable;
      // `pointer-events:auto` is already on the chip they wear.
      chipBtn: `${chip}cursor:pointer;padding:3px 8px;`,
      btn:
        "pointer-events:auto;background:rgba(20,24,20,0.88);color:#f3efe2;border:1px solid rgba(243,239,226,0.35);" +
        "border-radius:8px;padding:9px 13px;font:700 12px/1 ui-monospace,Consolas,monospace;cursor:pointer;min-height:40px;",
    };
    this.S = S;

    // Cutscene caption: centred, non-interactive, only while a beat runs.
    this.captionEl = PF.el("div", {
      style:
        "position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);max-width:70%;text-align:center;" +
        "pointer-events:none;opacity:0;transition:opacity .5s;background:rgba(12,14,12,0.72);color:#f3efe2;" +
        "border-radius:10px;padding:10px 16px;font:600 13px/1.55 ui-monospace,Consolas,monospace;z-index:3;",
    });
    // A beat appears and clears on its own, so the caption has to announce itself:
    // opacity is invisible to a screen reader, which would neither read a new beat
    // out nor stop offering the last one long after it faded. `aria-hidden` tracks
    // the fade so exactly one state is ever in the tree.
    this.captionEl.setAttribute("role", "status");
    this.captionEl.setAttribute("aria-live", "polite");
    this.captionEl.setAttribute("aria-atomic", "true");
    this.captionEl.setAttribute("aria-hidden", "true");
    this.locChip = PF.el("span", { style: S.chip, text: "…" });
    this.clockChip = PF.el("span", { style: S.chip, text: "" });
    // The purse (S3). Hidden until there is something in it: a legacy world with
    // no economy in it should not carry a permanent "0 coins" telling the player
    // about a system they are not playing.
    this.purseChip = PF.el("span", { style: `${S.chip}display:none;`, text: "" });
    // THE TWO PANEL OPENERS (plan §2.8), beside the chips that already say where
    // you are rather than in the action column — the thumb zone belongs to the
    // verbs. Boot HIDDEN on the berth button's discipline: the gate hides the
    // whole topbar for free, but the topbar STAYS UP in dialogue mode, so
    // `!inWorld` hiding is a toggle these two have to own (see update()).
    this.journalChip = this._chip("📖", "open the journal", () => this.toggleJournal());
    this.sheetChip = this._chip("👤", "open the character sheet", () => this.toggleSheet());
    this.topbar = PF.el(
      "div",
      { style: "position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2;" },
      [this.locChip, this.clockChip, this.purseChip, this.journalChip, this.sheetChip],
    );

    this.talkBtn = this._btn("Talk (E)", () => core.interact());
    // S3's one live transaction (P1's bed). Shown whenever there is a berth to be
    // had where the player is standing — a keeper within reach, or the room they
    // keep with them in it (59-economy berthOffer) — and shown REFUSING rather
    // than hidden when the offer stands but the purse is short, because a button
    // that vanishes teaches the player nothing about why.
    //
    // Booted HIDDEN, unlike Talk beside it. Talk is up for the whole of walk mode
    // and only dims; this one is display-gated, and update() is what decides. A
    // button that ships visible is on screen for every frame before the first
    // update — and for the whole of a mount that never reaches one (no sim yet),
    // quoting a room in a world that has not compiled.
    this.berthBtn = this._btn("Rent a berth", () => this.rentBerth());
    this.berthBtn.style.display = "none";
    // The keeper's SECOND trade (M8's amendment: no rod is ever free). Same
    // discipline as the berth beside it — boot hidden, offer-gated per frame,
    // dimmed rather than hidden when the purse is short — with one deliberate
    // divergence: it VANISHES once the ladder is topped out, because rod
    // ownership is global and permanent and a forever-dimmed chip is dead chrome.
    this.buyRodBtn = this._btn("Buy a rod", () => this.buyRod());
    this.buyRodBtn.style.display = "none";
    this.travelBtn = this._btn("Travel", () => this.toggleTravel());
    // 0.12's headline verb, on the same gating as the berth: shown whenever the
    // player is standing at a registry spot that holds water — INCLUDING when
    // they have no rod, because the refusal is what points them at the vendor and
    // a button that hides itself teaches nobody the mechanic exists.
    this.fishBtn = this._btn("🎣 Fish…", () => this.toggleFish());
    this.fishBtn.style.display = "none";
    this.fishMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    // P5's bed, beside the other clock mover because that is what it is — a Wait
    // you can only do where you have a bed, and the only one that leaves a
    // wrap-up behind. Boot hidden and offer-gated per frame, like the berth that
    // sells the bed in the first place.
    this.sleepBtn = this._btn("🛏 Sleep…", () => this.toggleSleep());
    this.sleepBtn.style.display = "none";
    this.sleepMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    this.waitBtn = this._btn("⏩ Wait…", () => this.toggleWait());
    this.keyboardBtn = this._btn("Keyboard", () => core.setMode("dialogue"));
    this.resumeBtn = this._btn("▶ Resume walking", () => core.resume());
    this.waitMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    this.actions = PF.el(
      "div",
      {
        style:
          "position:absolute;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px;align-items:flex-end;z-index:2;",
      },
      [
        this.talkBtn,
        this.berthBtn,
        this.buyRodBtn,
        this.travelBtn,
        this.fishMenu,
        this.fishBtn,
        this.sleepMenu,
        this.sleepBtn,
        this.waitMenu,
        this.waitBtn,
        this.keyboardBtn,
        this.resumeBtn,
      ],
    );

    // Touch D-pad. touch-action:none so the browser doesn't claim the gesture
    // (same requirement the host documents on its own drag surfaces).
    this.dpad = PF.el("div", {
      style:
        "position:absolute;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:132px;height:132px;z-index:2;" +
        "pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;",
    });
    const pads = [
      ["up", "▲", 44, 0],
      ["left", "◀", 0, 44],
      ["right", "▶", 88, 44],
      ["down", "▼", 44, 88],
    ];
    for (const [dir, label, x, y] of pads) {
      const pad = PF.el("button", {
        type: "button",
        "aria-label": `move ${dir}`,
        // Pointer/touch affordance only: out of the tab order so the keyboard
        // path stays the WASD/arrow bindings (a focused pad would swallow them).
        tabindex: "-1",
        style:
          `position:absolute;left:${x}px;top:${y}px;width:44px;height:44px;border-radius:10px;` +
          "background:rgba(20,24,20,0.75);color:#f3efe2;border:1px solid rgba(243,239,226,0.3);font-size:15px;touch-action:none;",
        text: label,
      });
      const press = (on) => (ev) => {
        ev.preventDefault();
        this.core.input[dir] = on;
      };
      pad.addEventListener("pointerdown", press(true));
      pad.addEventListener("pointerup", press(false));
      pad.addEventListener("pointercancel", press(false));
      pad.addEventListener("pointerleave", press(false));
      this.dpad.appendChild(pad);
    }

    this.travelMenu = PF.el("div", {
      style:
        "position:absolute;right:12px;bottom:calc(64px + env(safe-area-inset-bottom,0px));display:none;flex-direction:column;gap:5px;" +
        "background:rgba(20,24,20,0.94);border:1px solid rgba(243,239,226,0.3);border-radius:10px;padding:8px;max-height:45%;overflow:auto;z-index:3;pointer-events:auto;",
    });

    this.toastEl = PF.el("div", {
      style:
        "position:absolute;bottom:calc(156px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);" +
        `${S.chip}opacity:0;transition:opacity 0.25s;z-index:3;pointer-events:none;`,
    });
    // LOCATION NOTICES RIDE THE TOP. Everything used to share the bottom surface
    // above, which is where the host's narration panel is: crossing into a zone
    // printed its name across the middle of the GM's sentence ("Tam's farm" over a
    // line of NARRATION, playtest). Where you have just arrived belongs beside the
    // chip that already says where you are, and it is the one toast class that
    // fires while the player is reading rather than because they pressed
    // something. Sits under the topbar so the two never stack.
    this.locToastEl = PF.el("div", {
      style:
        "position:absolute;top:42px;left:50%;transform:translateX(-50%);" +
        `${S.chip}opacity:0;transition:opacity 0.25s;z-index:3;pointer-events:none;`,
    });

    // THE LOADING GATE's face (plan §Q3b). Full-surface and pointer-events:auto,
    // so nothing behind it is clickable while it holds — a chat whose world has
    // not been generated yet has no world to talk about, no clock worth reading
    // and nowhere to walk, and every other control is hidden under it. Announced
    // to a screen reader, because the whole state is "wait, then something
    // changes" and a silent one is a hung app.
    this.gateTitle = PF.el("div", {
      style: "font:700 14px/1.5 inherit;margin-bottom:6px;",
    });
    this.gateBody = PF.el("div", {
      style: "font:12px/1.65 inherit;opacity:0.85;max-width:34ch;margin-bottom:12px;",
    });
    this.gateRetry = this._btn("Try again", () => PF.save.retryGeneration(this.core));
    this.gateEl = PF.el(
      "div",
      {
        style:
          "position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;" +
          "text-align:center;padding:24px;box-sizing:border-box;gap:0;pointer-events:auto;z-index:4;" +
          "background:rgba(12,14,12,0.9);color:#f3efe2;",
      },
      [this.gateTitle, this.gateBody, this.gateRetry],
    );
    this.gateEl.setAttribute("role", "status");
    this.gateEl.setAttribute("aria-live", "polite");

    // ── The two panels (plan §2.5, §2.8) ────────────────────────────────────
    // Both are full-surface, on the gate's own shape one block up, and both are
    // children of `this.root` — which is their WHOLE teardown story. The gate is
    // the precedent: it is built here, appended to the root below, and
    // `destroy()`'s `this.root.remove()` takes it away with everything else. A
    // panel with a teardown of its own would be a second thing to forget.
    //
    // Under the gate in z as well as in the list: a world still being written has
    // no journal to read and nobody to be a sheet about.
    //
    // AND NEITHER IS AN `aria-modal` DIALOG, deliberately. `_hostOwnsKeyboard`
    // (90-element) treats any visible `[role="dialog"][aria-modal="true"]` as the
    // host owning the keyboard — so marking our own panel one would make the very
    // keys that close it inert the moment it opened.
    const panelStyle =
      "position:absolute;inset:0;flex-direction:column;gap:8px;pointer-events:auto;z-index:3;" +
      "padding:12px;box-sizing:border-box;background:rgba(12,14,12,0.94);color:#f3efe2;" +
      "font:12px/1.6 ui-monospace,Consolas,monospace;";
    const panelHead = "display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;";
    const panelTitle = "font:700 13px/1.5 inherit;";
    this.journalBody = PF.el("div", {
      style: "flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:10px;",
    });
    this.journalEl = PF.el("div", { style: panelStyle, "aria-label": "journal" }, [
      PF.el("div", { style: panelHead }, [
        PF.el("div", { style: panelTitle, text: "Journal" }),
        this._btn("✕ Close", () => this.closeJournal()),
      ]),
      this.journalBody,
    ]);
    // The sheet's two columns: the sprite on the left with the themed generic
    // label under it, the sections on the right (plan §2.8).
    this.sheetArt = PF.el("div", {
      style: "flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;",
    });
    this.sheetStats = PF.el("div", {
      style: "flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:2px;",
    });
    this.sheetEl = PF.el("div", { style: panelStyle, "aria-label": "character sheet" }, [
      PF.el("div", { style: panelHead }, [
        PF.el("div", { style: panelTitle, text: "Character" }),
        this._btn("✕ Close", () => this.closeSheet()),
      ]),
      PF.el("div", { style: "flex:1 1 auto;display:flex;gap:14px;overflow:hidden;" }, [this.sheetArt, this.sheetStats]),
    ]);
    // Both boot DOWN, as a property rather than inside the style string: the
    // toggles and update() write this same property, and a boot state expressed
    // only in `cssText` is one nothing can read back (the berth button's own
    // discipline).
    this.journalEl.style.display = "none";
    this.sheetEl.style.display = "none";

    this.root = PF.el(
      "div",
      { style: "position:absolute;inset:0;pointer-events:none;font-family:ui-monospace,Consolas,monospace;" },
      [
        this.topbar,
        this.actions,
        this.dpad,
        this.travelMenu,
        this.captionEl,
        this.toastEl,
        this.locToastEl,
        this.journalEl,
        this.sheetEl,
        this.gateEl,
      ],
    );
    rootEl.appendChild(this.root);
    this._toastTimer = 0;
    this._locToastTimer = 0;
    this._mode = null;
    // The panels' open flags and their memos. Both memos are CLEARED rather than
    // compared against a sentinel when a panel opens, so opening always paints.
    this._journal = false;
    this._journalMemo = null;
    this._sheet = false;
    this._sheetKey = null;
    this.refreshChips();
  }

  _btn(text, onclick) {
    return PF.el("button", { type: "button", style: this.S.btn, text, onclick });
  }

  /** A glyph-width topbar opener: a button wearing the chip's styling, boot
   *  hidden, and carrying the words the glyph does not say. */
  _chip(glyph, label, onclick) {
    const node = PF.el("button", { type: "button", "aria-label": label, style: this.S.chipBtn, text: glyph, onclick });
    // Hidden as a PROPERTY rather than inside the style string, exactly as the
    // berth button beside it is: update() writes this same property, and a
    // boot state expressed only in `cssText` is one nothing can read back.
    node.style.display = "none";
    return node;
  }

  destroy() {
    clearTimeout(this._toastTimer);
    clearTimeout(this._locToastTimer);
    this.root.remove();
  }

  /** `kind` picks the SURFACE, not the styling: "location" goes to the top strip
   *  (see locToastEl), everything else keeps the bottom one. Two nodes and two
   *  timers, so an arrival and a refusal can be on screen together instead of
   *  overwriting each other — they answer different questions. An unknown kind
   *  falls to the bottom, which is where every caller that names none already
   *  wanted to be. */
  toast(msg, kind) {
    const atTop = kind === "location";
    const node = atTop ? this.locToastEl : this.toastEl;
    node.textContent = msg;
    node.style.opacity = "1";
    const timer = atTop ? "_locToastTimer" : "_toastTimer";
    clearTimeout(this[timer]);
    this[timer] = setTimeout(() => {
      node.style.opacity = "0";
    }, 2600);
  }

  /** Skip ahead to the next dawn / midday / dusk / night. The clock is
   *  otherwise only moved by walking, so without this a player who wants to see
   *  the town after dark has to walk in circles for an hour. */
  toggleWait() {
    const open = this.waitMenu.style.display !== "flex";
    if (!open) {
      this.waitMenu.style.display = "none";
      return;
    }
    this.waitMenu.replaceChildren();
    for (const [part, label] of [
      ["dawn", "Wait for dawn"],
      ["day", "Wait for morning"],
      ["dusk", "Wait for dusk"],
      ["night", "Wait for night"],
    ]) {
      this.waitMenu.appendChild(
        this._btn(label, () => {
          this.waitMenu.style.display = "none";
          if (!this.core.sim.waitUntil(part)) {
            this.toast("Not while you're talking — resume walking first");
            return;
          }
          // waitUntil moves clockMin/day but does not flag the save itself, and
          // the autosave only fires on a dirty sim — without this the skipped
          // hours are lost on reload.
          this.core.markDirty();
          this.refreshChips();
          this.toast(`Time passes — ${this.core.sim.clockLabel()}`);
        }),
      );
    }
    this.waitMenu.style.display = "flex";
  }

  /** The bed's menu, mirroring the Wait menu one method up — the same four
   *  dayparts, because a sleep is a rest that happens to be somewhere. It SENDS
   *  NOTHING: the hours pass, the wrap-up is staged, and the next turn the player
   *  sends for their own reasons carries it (plan §2.6). */
  toggleSleep() {
    const open = this.sleepMenu.style.display !== "flex";
    if (!open) {
      this.sleepMenu.style.display = "none";
      return;
    }
    const offer = PF.economy.sleepOffer(this.core);
    if (!offer.available) {
      // Answered where it was pressed, rather than behind a menu whose every
      // entry then refuses — the fishing verb's own idiom.
      this.sleepMenu.style.display = "none";
      this.toast(this.sleepRefusal(offer.reason));
      return;
    }
    this.sleepMenu.replaceChildren();
    for (const [part, label] of [
      ["dawn", "Sleep until dawn"],
      ["day", "Sleep until morning"],
      ["dusk", "Sleep until dusk"],
      ["night", "Sleep until night"],
    ]) {
      this.sleepMenu.appendChild(
        this._btn(label, () => {
          this.sleepMenu.style.display = "none";
          this.sleep(part);
        }),
      );
    }
    this.sleepMenu.style.display = "flex";
  }

  /** The bed's refusals, turned into sentences. `no-bed` is absent on purpose:
   *  the button is not on screen where there is no bed, so a line for it would be
   *  copy nobody can reach. */
  sleepRefusal(reason) {
    if (reason === "wrong-mode") return "Not while you're talking — resume walking first";
    if (reason === "streaming") return "The story is still being written…";
    if (reason === "gate-held") return "Not yet — your world is still being written.";
    return "You can't sleep just now.";
  }

  /** Spend the night (or the morning). `sleep` moves the clock, stages the
   *  wrap-up and flags the save itself, so this only says what happened — and
   *  re-reads the chips, because the clock is one of them. */
  sleep(target) {
    const result = PF.economy.sleep(this.core, target);
    if (!result.ok) {
      this.toast(this.sleepRefusal(result.reason));
      return;
    }
    this.refreshChips();
    this.toast(`You sleep — ${this.core.sim.clockLabel()}`);
  }

  /** The session menu, mirroring the Wait menu one method up: a single cast, or
   *  a session that runs until one of the four dayparts. The BAIT LINE at the top
   *  is not a control — it is what the session is about to spend, shown before it
   *  spends it, because the slotting is automatic and the player would otherwise
   *  watch a stack drain without ever having been told it was in play. */
  toggleFish() {
    const open = this.fishMenu.style.display !== "flex";
    if (!open) {
      this.fishMenu.style.display = "none";
      return;
    }
    const offer = PF.economy.fishOffer(this.core);
    if (!offer.available) {
      // A refusal is answered where it is pressed, not behind a menu that then
      // refuses every entry in it.
      this.fishMenu.style.display = "none";
      this.toast(offer.hint || this.fishRefusal(offer.reason));
      return;
    }
    this.fishMenu.replaceChildren();
    const world = this.core.sim.world;
    this.fishMenu.appendChild(
      PF.el("span", {
        style: this.S.chip,
        text: offer.bait
          ? `Bait: ${offer.bait.q} × ${PF.economy.describe(world, offer.bait)}`
          : "No bait — casting bare",
      }),
    );
    for (const [target, label] of [
      [null, "Cast once"],
      ["dawn", "Fish until dawn"],
      ["day", "Fish until morning"],
      ["dusk", "Fish until dusk"],
      ["night", "Fish until night"],
    ]) {
      this.fishMenu.appendChild(
        this._btn(label, () => {
          this.fishMenu.style.display = "none";
          this.fish(target);
        }),
      );
    }
    this.fishMenu.style.display = "flex";
  }

  /** The verb's refusal values, turned into sentences. `no-rod` is absent on
   *  purpose: it carries its own themed hint naming the keeper who sells one, and
   *  a generic line here would throw that away.
   *
   *  `unknown-target` and `no-player` are absent on purpose too, for the opposite
   *  reason: neither is a refusal about the PLAYER. One is a caller handing the
   *  verb a daypart word that does not exist and the other is a sim with no
   *  player block on it, so both take the fall-through rather than copy written
   *  about a state nobody can be in — which is exactly why that fall-through has
   *  to be a real sentence. Both callers toast `hint || fishRefusal(reason)`, and
   *  an empty line there is a pressed button that does nothing at all. */
  fishRefusal(reason) {
    if (reason === "wrong-mode") return "Not while you're talking — resume walking first";
    if (reason === "not-near-water") return "There is no water to fish here.";
    if (reason === "pouch-full") return "Your bag is full — there is nowhere to put a catch.";
    if (reason === "gate-held") return "Not yet — your world is still being written.";
    return "You can't fish just now.";
  }

  /** Spend the session. `fish` moves the clock and flags the save itself, so this
   *  only turns what came back into a sentence — and re-reads the chips, because
   *  the purse chip counts what is in the bag. */
  fish(target) {
    const result = PF.economy.fish(this.core, target);
    if (!result.ok) {
      this.toast(result.hint || this.fishRefusal(result.reason));
      return;
    }
    const world = this.core.sim.world;
    const clock = this.core.sim.clockLabel();
    this.refreshChips();
    if (result.leveled) {
      // THEMED, out of the same word book the sheet reads (`verbSkin`): a colony
      // levels "Angling", and this line was the one place the raw verb reached a
      // player at all.
      this.toast(`${PF.economy.verbSkin(world, "fishing").name} is level ${result.leveled} now — ${clock}`);
      return;
    }
    if (!result.caught.length) {
      this.toast(`Nothing biting — ${clock}`);
      return;
    }
    const last = PF.economy.describe(world, result.caught[result.caught.length - 1]);
    this.toast(
      result.caught.length === 1
        ? `You land a ${last} — ${clock}`
        : `${result.caught.length} landed, the last a ${last} — ${clock}`,
    );
  }

  /** Take the rod the button is offering. The offer is re-read inside buyRod, so
   *  a frame-old button cannot overcharge anybody; this turns the refusals into
   *  sentences, exactly as rentBerth's caller does. */
  buyRod() {
    const world = this.core.sim?.world;
    const result = PF.economy.buyRod(this.core);
    if (result.ok) {
      const named = PF.economy.describe(world, { t: "rod", k: result.tier });
      this.toast(
        result.bait
          ? `A ${named} is yours, line and tackle included — ${PF.economy.money(world, result.price)}.`
          : `A ${named} is yours — ${PF.economy.money(world, result.price)}.`,
      );
      this.refreshChips();
      return;
    }
    if (result.reason === "cannot-afford")
      this.toast(`Not enough on you — that rod is ${PF.economy.money(world, result.price)}.`);
    else if (result.reason === "pouch-full") this.toast("Your bag is too full to carry it.");
    else this.toast("There is no rod to be had here.");
  }

  toggleTravel() {
    const open = this.travelMenu.style.display !== "flex";
    if (!open) {
      this.travelMenu.style.display = "none";
      return;
    }
    this.travelMenu.replaceChildren();
    const dests = PF.spatial.destinations();
    if (!dests.length) {
      this.travelMenu.appendChild(PF.el("span", { style: this.S.chip, text: "No known destinations yet" }));
    }
    for (const dest of dests.slice(0, 12)) {
      this.travelMenu.appendChild(
        this._btn(dest.name, () => {
          this.travelMenu.style.display = "none";
          void PF.spatial.travel(this.core, dest);
        }),
      );
    }
    this.travelMenu.style.display = "flex";
  }

  /** Take the berth the button is offering. The offer is re-read inside
   *  rentBerth, so what the button was rendering a frame ago cannot overcharge
   *  anybody; this only turns the verb's refusal reasons into sentences. */
  rentBerth() {
    const world = this.core.sim?.world;
    const result = PF.economy.rentBerth(this.core);
    if (result.ok) {
      this.toast(`A berth is yours — ${PF.economy.money(world, result.price)} the night.`);
      this.refreshChips();
      return;
    }
    if (result.reason === "already-yours") this.toast("You already keep a berth here.");
    else if (result.reason === "cannot-afford")
      this.toast(`Not enough on you — a berth is ${PF.economy.money(world, result.price)}.`);
    else this.toast("There is no room to be had here.");
  }

  // ── The panels (plan §2.5, §2.8) ───────────────────────────────────────────
  // Two surfaces, one rule each. The JOURNAL is a list that changes when the
  // arrays under it change, so its memo is the arrays themselves. The SHEET is a
  // portrait of live state that no array identity tracks — every player mutator
  // mutates IN PLACE — so its memo is a VALUE key, on the purse chip's idiom
  // further down. Neither writes DOM at rest.

  /** Is the surface in a state where a panel may be open at all? Both openers
   *  answer to this: the chips are hidden outside walk mode and under the gate,
   *  and the key branches (90-element) inherit the same guards, but a click can
   *  still land on a frame-old chip. */
  _panelsAllowed() {
    return this.core.sim?.mode === "walk" && !PF.save.gateHolds(this.core);
  }

  /** Close whatever panel is open, and say whether anything was open to close.
   *
   *  The Escape branch (90-element) DISCARDS that answer on purpose: it declines
   *  `preventDefault` either way, because the host's own Escape handling is not
   *  ours to cancel, so "the key meant something here" is not a question it has
   *  to ask. The return is the honest answer for a caller that does — today that
   *  is the harness, which pins it. */
  closePanels() {
    const open = this._journal || this._sheet;
    this.closeJournal();
    this.closeSheet();
    return open;
  }

  toggleJournal() {
    if (!this._panelsAllowed()) return;
    if (this._journal) {
      this.closeJournal();
      return;
    }
    // One surface at a time: both are full-screen, so a second one opening over
    // the first would be a panel nobody can see under a panel nobody closed.
    this.closeSheet();
    this._journal = true;
    this._journalMemo = null;
    this._journalSync();
    this.journalEl.style.display = "flex";
  }

  closeJournal() {
    this._journal = false;
    this._journalMemo = null;
    this.journalEl.style.display = "none";
  }

  /** The journal's memo: the two ARRAYS and their two lengths (plan §2.5). The
   *  identities catch a wholesale replacement — `_compactLedger` rebuilds
   *  `ledger.lines` on every append, and a restore assigns a fresh band — and
   *  the lengths catch an append that kept the array it pushed onto, which is
   *  exactly what `notice()` does while the band is under its cap.
   *
   *  What it deliberately does NOT track is the told flag: the band shows told
   *  and untold rows alike, so a burn changes nothing the panel draws. */
  _journalSync() {
    const player = PF.player.get(this.core);
    const lines = Array.isArray(player?.ledger?.lines) ? player.ledger.lines : null;
    const notices = Array.isArray(player?.ledger?.notices) ? player.ledger.notices : null;
    const memo = this._journalMemo;
    if (
      memo &&
      memo.lines === lines &&
      memo.notices === notices &&
      memo.lineCount === (lines?.length ?? 0) &&
      memo.noticeCount === (notices?.length ?? 0)
    )
      return;
    this._journalMemo = { lines, notices, lineCount: lines?.length ?? 0, noticeCount: notices?.length ?? 0 };
    this._renderJournal(lines ?? [], notices ?? []);
  }

  /** ONE LIST, day-grouped from each line's own day, newest day first — and the
   *  NOTICE BAND outside the grouping entirely, because it reads a DIFFERENT
   *  array (plan §2.5). A notice explains something that happened to the SAVE
   *  rather than something the player did in a day, so it has no day group to
   *  belong to; the band is history and shows told and untold rows alike.
   *
   *  Lines inside a day keep the order they were logged in, which is the order
   *  the wrap-up tells them in. A STUB renders as its stub text and nothing else
   *  — the sentence the ledger holds ("Day 4: 12 things happened.") is the same
   *  sentence the GM was given, and rewriting it here would be the panel telling
   *  a different story from the tell. */
  _renderJournal(lines, notices) {
    const body = this.journalBody;
    body.replaceChildren();
    const dim = "opacity:0.7;";
    if (notices.length) {
      // The band's framing echoes the tell's own framing sentence (30-sim
      // `_composeLedger`) so the player reads here the words they were told
      // there — and it is written to receive an ACTOR when the autonomous-change
      // mechanism arrives and a notice can say who did it (M3, roadmap).
      const band = PF.el("div", {
        style:
          "display:flex;flex-direction:column;gap:2px;padding-left:8px;border-left:2px solid rgba(243,239,226,0.35);",
      });
      band.appendChild(
        PF.el("div", { style: `font:700 12px/1.6 inherit;${dim}`, text: "About the world itself, not the days in it" }),
      );
      // NEWEST FIRST — and newest here means most recently WRITTEN, not the
      // highest day. The two agree everywhere except after a rewind, where a
      // restore's notice carries a day BELOW the severance notice it is the
      // sequel to, so the descending day sort the groups below use would print
      // the sentence saying the world went above the notice of it coming back.
      // Reverse insertion order is what puts the sequel on top. These rows are
      // events about the save and the day on them is a stamp, not the order
      // they happened in; the day groups below sort, because a line really does
      // belong to its day.
      for (const row of notices.slice().reverse()) {
        const said = typeof row?.[1] === "string" ? row[1] : "";
        band.appendChild(PF.el("div", { text: `Day ${PF.player.resolvedDay(row?.[0])} — ${said}` }));
      }
      body.appendChild(band);
    }
    const days = [...new Set(lines.map((line) => PF.player.resolvedDay(line?.[0])))].sort((a, b) => b - a);
    for (const day of days) {
      const group = PF.el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [
        PF.el("div", { style: `font:700 12px/1.6 inherit;${dim}`, text: `Day ${day}` }),
      ]);
      for (const line of lines) {
        if (PF.player.resolvedDay(line?.[0]) !== day) continue;
        const stub = PF.player.resolvedDay(line?.[2]) > 0;
        group.appendChild(PF.el("div", { style: stub ? dim : "", text: typeof line?.[1] === "string" ? line[1] : "" }));
      }
      body.appendChild(group);
    }
    if (!days.length && !notices.length)
      body.appendChild(PF.el("div", { style: dim, text: "Nothing written down yet." }));
  }

  toggleSheet() {
    if (!this._panelsAllowed()) return;
    if (this._sheet) {
      this.closeSheet();
      return;
    }
    this.closeJournal();
    this._sheet = true;
    this._sheetKey = this._sheetValueKey();
    this._renderSheet();
    this.sheetEl.style.display = "flex";
  }

  /** CLOSED, not hidden (plan §2.8). A hidden sheet resurfacing after a mode
   *  change is the stale path — it comes back drawn against whoever the player
   *  was before the combat or the replay — so the flag and the memo both go and
   *  the next open rebuilds from scratch. */
  closeSheet() {
    this._sheet = false;
    this._sheetKey = null;
    this.sheetEl.style.display = "none";
  }

  /** A whole number off untrusted block state. The sheet renders save JSON, so
   *  an `x` can be "12", -3 or a NaN; ONE reader for the key and the render,
   *  which is what makes "the key is the projection of what the sheet draws"
   *  true rather than nearly true. */
  _num(value) {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  _carried(pouch) {
    return (Array.isArray(pouch?.items) ? pouch.items : []).reduce((n, item) => n + this._num(item?.q), 0);
  }

  /** Standing as the sheet shows it: how many people sit on each rung of the
   *  disposition ladder across every zone, and how many are hostile. The
   *  hostile flag is COUNTED SEPARATELY because it is a flag and not a rung —
   *  and because an `h` flipping with `d` unmoved has to move the key. */
  _standing(player) {
    const tiers = [0, 0, 0, 0];
    let hostile = 0;
    for (const [, rows] of Object.entries(player?.rel ?? {})) {
      for (const [, row] of Object.entries(rows ?? {})) {
        if (!row || typeof row !== "object") continue;
        tiers[PF.clamp(this._num(row.d), 0, 3)] += 1;
        if (row.h) hostile += 1;
      }
    }
    return { tiers, hostile };
  }

  /** THE LIVE VALUE KEY (plan §2.8), on the purse chip's idiom: cheap enough to
   *  compute every frame the sheet is open, and it moves exactly when something
   *  the sheet draws moves. The player block carries no identity signal to watch
   *  — every mutator mutates in place — so a built-at-open sheet would go stale
   *  the moment a Talk bumped somebody or a cast paid xp.
   *
   *  THE INVARIANT: this key is the projection of PRECISELY what the sheet
   *  renders. Widening the sheet — per-NPC rows, names, a new section — widens
   *  the key in the same change, or the new half never re-renders. */
  _sheetValueKey() {
    const player = PF.player.get(this.core);
    const world = this.core.sim?.world;
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const verbs = Object.entries(player?.skills?.verbs ?? {})
      .sort(byKey)
      .map(([verb, row]) => `${verb}:${PF.player.resolvedLevel(row)}:${this._num(row?.x)}`)
      .join(",");
    // The pairs BY VALUE, which covers the fresh-pair equip and the `delete`
    // unequip alike: a slot that lost its pair renders as an empty half.
    const gear = Object.entries(player?.skills?.equipped ?? {})
      .sort(byKey)
      .map(
        ([verb, slots]) =>
          `${verb}:${["tool", "mod"]
            .map((slot) => (Array.isArray(slots?.[slot]) ? `${slots[slot][0]}/${slots[slot][1]}` : ""))
            .join("+")}`,
      )
      .join(",");
    const { tiers, hostile } = this._standing(player);
    return [
      this._num(player?.pouch?.money),
      this._carried(player?.pouch),
      verbs,
      gear,
      tiers.join("/"),
      hostile,
      // FOUR ROWS AT ONCE: the skill names, `describe()`'s prose, the money
      // heading and the label under the portrait all come out of the WORLD's
      // word book, so a rebuild that lands a different theme has moved what the
      // sheet draws without moving one player field. The loader usually carries
      // it (a theme change moves `assets.status` below), but a PARKED loader —
      // no packageId, or inside the failed backoff — never moves at all.
      world?.theme ?? "",
      // The portrait's own input: the pre-ready Tier-0 window is accepted, and
      // this is what upgrades it the frame the authored sheets arrive.
      PF.assets?.status ?? "",
    ].join("|");
  }

  /** The sheet as DATA (plan §2.8): `[{section, rows: [{label, value, kind,
   *  detail?, source?}]}]`. `detail` and `source` ship in the shape and empty —
   *  they are the seam the extended journal fills when perks, boons and
   *  enchanted equipment land, and a shape grown later is a shape every consumer
   *  has to be re-taught. */
  _sheetDescriptor() {
    const world = this.core.sim?.world;
    const player = PF.player.get(this.core);
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const out = [];

    const skills = Object.entries(player?.skills?.verbs ?? {})
      .sort(byKey)
      .map(([verb, row]) => {
        const level = PF.player.resolvedLevel(row);
        // A CAPPED SKILL READS "MAX", never "0 xp to go": award() zeroes `x` at
        // the ceiling, so the ordinary arithmetic would draw a bar that is
        // permanently empty and permanently full at once (plan §2.8).
        const value =
          level >= PF.player.CAPS.skillLevel
            ? `Level ${level} — MAX`
            : `Level ${level} — ${Math.max(0, PF.player.xpPerLevel(level) - this._num(row?.x))} xp to go`;
        return { label: PF.economy.verbSkin(world, verb).name, value, kind: "skill" };
      });
    out.push({
      section: "Skills",
      rows: skills.length ? skills : [{ label: "Nothing practised yet", value: "", kind: "skill" }],
    });

    const gear = [];
    for (const [verb, slots] of Object.entries(player?.skills?.equipped ?? {}).sort(byKey)) {
      const skin = PF.economy.verbSkin(world, verb);
      for (const slot of ["tool", "mod"]) {
        const pair = slots?.[slot];
        if (!Array.isArray(pair) || typeof pair[0] !== "string" || !pair[0]) continue;
        gear.push({
          label: `${skin.name} ${skin[slot]}`,
          value: PF.economy.describe(world, { t: pair[0], k: typeof pair[1] === "string" ? pair[1] : "" }),
          kind: "equipment",
        });
      }
    }
    out.push({
      section: "Equipment",
      rows: gear.length ? gear : [{ label: "Nothing to hand", value: "", kind: "equipment" }],
    });

    const carried = this._carried(player?.pouch);
    const { one } = PF.economy.currency(world);
    out.push({
      // Named for what this world calls its money, so a colony's sheet carries no
      // "Coin" heading over a purse full of credits.
      section: `${one.charAt(0).toUpperCase()}${one.slice(1)}`,
      rows: [
        { label: "Purse", value: PF.economy.money(world, this._num(player?.pouch?.money)), kind: "money" },
        { label: "Carried", value: `${carried} ${carried === 1 ? "thing" : "things"}`, kind: "count" },
      ],
    });

    // THE AGGREGATE, not a roll-call: how many people stand on each rung, across
    // every zone. Per-NPC rows belong to the extended surface the journal becomes
    // (plan §2.8). The rung words are theme-BLIND on purpose — a stranger is a
    // stranger in any world, and the ladder is the same four steps everywhere.
    const { tiers, hostile } = this._standing(player);
    const standing = ["Strangers", "Acquainted", "Friendly", "Close"].map((label, rung) => ({
      label,
      value: String(tiers[rung]),
      kind: "standing",
    }));
    if (hostile) standing.push({ label: "Hostile", value: String(hostile), kind: "standing" });
    out.push({ section: "Standing", rows: standing });
    return out;
  }

  /** The portrait: the player's own walk sprite, facing the reader, drawn onto a
   *  frame-sized offscreen canvas and integer-scaled up with
   *  `image-rendering: pixelated` — which is what the underlay does with the
   *  world canvas (90-element `attachUnderlay`), and the only way pixel art
   *  survives being made bigger.
   *
   *  Hue 158 is the world draw's own fallback constant for the player
   *  (40-render), so the Tier-0 portrait is the same person the map shows. A
   *  refused 2d context draws nothing and is not a reason to fail: the sheet is
   *  a panel of text with a picture on it. */
  _portrait() {
    const sprites = PF.assets?.status === "ready" ? PF.assets.sprites : null;
    const fw = this._num(sprites?.frameWidth) || 12;
    const fh = this._num(sprites?.frameHeight) || 16;
    const canvas = PF.offscreen(fw, fh);
    const pctx = canvas.getContext?.("2d");
    if (pctx) {
      pctx.imageSmoothingEnabled = false;
      PF.art.drawActor(pctx, "player", 158, 0, 0, false, 0, 0);
    }
    const scale = 6;
    canvas.style.cssText =
      `width:${fw * scale}px;height:${fh * scale}px;` +
      "image-rendering:pixelated;image-rendering:crisp-edges;display:block;";
    return canvas;
  }

  _renderSheet() {
    const world = this.core.sim?.world;
    // THE THEMED GENERIC LABEL. The package has no player name and the host props
    // expose none, so the sheet says what KIND of person is standing there rather
    // than inventing one (plan §2.8; engine persona name + avatar is an
    // enumerated Engine FR).
    this.sheetArt.replaceChildren(
      this._portrait(),
      PF.el("div", { style: "font:700 12px/1.5 inherit;", text: PF.economy.playerLabel(world) }),
    );
    const stats = this.sheetStats;
    stats.replaceChildren();
    for (const { section, rows } of this._sheetDescriptor()) {
      stats.appendChild(
        PF.el("div", { style: "font:700 12px/1.6 inherit;opacity:0.7;margin-top:6px;", text: section }),
      );
      for (const row of rows) {
        stats.appendChild(
          PF.el("div", { style: "display:flex;justify-content:space-between;gap:12px;" }, [
            PF.el("span", { style: "opacity:0.8;", text: row.label }),
            PF.el("span", { text: row.value }),
          ]),
        );
      }
    }
  }

  refreshChips() {
    const sim = this.core.sim;
    if (!sim) return;
    // The spatial name is the ENGINE's committed party location, which only
    // moves on a narrated transition or a Travel — walking is package-local, so
    // it does not follow the player between zones. Showing it unconditionally
    // pinned a stale name to every zone ("The Tailings — The Slag Bar"), and on
    // the start zone it could even show a leftover location from a DIFFERENT
    // world in the same chat. Annotate only when it really is this zone's
    // binding, and never annotate the exterior, whose binding is seeded from
    // whatever the map already said.
    const zoneName = sim.zone().name;
    const locationId = PF.spatial.data && PF.spatial.data.currentLocationId;
    const bound =
      locationId && sim.zoneId !== sim.world.startZone && sim.world.bindings[locationId] === sim.zoneId
        ? PF.spatial.locationName()
        : null;
    this.locChip.textContent = bound && bound !== zoneName ? `${zoneName} — ${bound}` : zoneName;
    this.clockChip.textContent = sim.clockLabel();
    // The purse. Money and the pouch's row count, in this theme's own words —
    // and nothing at all until one of them exists, so a legacy world carries no
    // chip about an economy it does not have.
    const pouch = PF.player.get(this.core)?.pouch;
    const money = pouch?.money ?? 0;
    const carried = (pouch?.items ?? []).reduce((n, item) => n + Math.max(0, item?.q ?? 0), 0);
    const { glyph } = PF.economy.currency(sim.world);
    this.purseChip.style.display = money || carried ? "" : "none";
    this.purseChip.textContent = carried
      ? `${glyph} ${PF.economy.money(sim.world, money)} · ${carried} carried`
      : `${glyph} ${PF.economy.money(sim.world, money)}`;
  }

  /** Cheap per-frame sync — writes DOM only on change. */
  update() {
    const sim = this.core.sim;
    if (!sim) return;
    const mode = sim.mode;
    const spatialAvail = PF.spatial.available;
    // The gate's STATE, not merely whether it holds: "generating" and "failed" are
    // two different screens, and folding them into a boolean would leave the retry
    // button hidden behind a change the memo below never saw.
    const gate = PF.save.gateHolds(this.core) ? PF.save.gate.state : null;
    // WHY it failed is part of the screen, not only THAT it failed. The ladder
    // refuses to seal a default world on any failure now (18-brief `generate`),
    // deterministic ones included — which is right, and which also means a
    // player can be looking at a retry button that will keep giving the same
    // answer. It has to be in the memo key or the sentence never changes.
    const gateWhy = gate === "failed" ? (PF.save.gate.failure ?? null) : null;
    if (
      mode !== this._mode ||
      spatialAvail !== this._spatialAvail ||
      gate !== this._gate ||
      gateWhy !== this._gateWhy
    ) {
      this._mode = mode;
      this._spatialAvail = spatialAvail;
      this._gate = gate;
      this._gateWhy = gateWhy;
      const inWorld = mode === "walk" && !gate;
      this.gateEl.style.display = gate ? "flex" : "none";
      this.gateRetry.style.display = gate === "failed" ? "" : "none";
      this.gateTitle.textContent = gate === "failed" ? "The world didn't finish being written." : "Writing your world…";
      this.gateBody.textContent =
        gate === "failed"
          ? `${PF.save.gateReason(gateWhy)} Nothing was lost and nothing was decided for you — this chat is exactly as you left it. Try again whenever you like.`
          : "One generation call is shaping the settlement, its people and the places in it. This can take a minute.";
      this.topbar.style.display = gate ? "none" : "";
      // Replay: the host owns the whole screen. Combat: keep a minimal HUD —
      // the mode is inferred from the narrative gameActiveState, which can flip
      // without any combat UI mounting, so the player must NEVER be left with
      // zero controls (review finding). Resume is the guaranteed exit.
      this.root.style.display = mode === "replay" ? "none" : "";
      this.dpad.style.display = inWorld ? "" : "none";
      this.talkBtn.style.display = inWorld ? "" : "none";
      // The berth button is proximity-driven as well as mode-driven, so leaving
      // walk mode hides it here and the walk block below decides when it is back.
      if (!inWorld) {
        this.berthBtn.style.display = "none";
        this._berth = null;
        this.buyRodBtn.style.display = "none";
        this._rod = null;
        this.fishBtn.style.display = "none";
        this._fish = null;
        this.sleepBtn.style.display = "none";
        this._sleep = null;
      }
      // THE PANEL OPENERS, on the berth button's cadence and for a reason of
      // their own: the gate hides the whole topbar, but the topbar STAYS UP in
      // dialogue mode, so `!inWorld` hiding is a toggle these two have to own.
      this.journalChip.style.display = inWorld ? "" : "none";
      this.sheetChip.style.display = inWorld ? "" : "none";
      // …AND THE PANELS THEMSELVES. The sheet CLOSES (plan §2.8): `e`, a cutscene
      // beat, and the props-driven replay/combat modes can all fire under an open
      // one, and a sheet that merely hid would resurface drawn against whoever
      // the player was before. The journal only hides — it is a list of what is
      // written down, with no live descriptor to go stale, and losing a scroll
      // position to a passing combat state would be its own small rudeness.
      if (!inWorld) {
        this.closeSheet();
        this.journalEl.style.display = "none";
      } else if (this._journal) {
        this.journalEl.style.display = "flex";
      }
      this.travelBtn.style.display = inWorld && spatialAvail ? "" : "none";
      this.waitBtn.style.display = inWorld ? "" : "none";
      this.keyboardBtn.style.display = inWorld ? "" : "none";
      // In combat, Resume exists only for the NARRATIVE fallback signal (which
      // can flip without any combat UI). With the real Capability API 1.11
      // signal the combat UI owns the screen — no package controls at all.
      const combatResumeApplies = mode === "combat" && !this.core._combatSignalIsReal && !gate;
      this.resumeBtn.style.display = (mode === "dialogue" && !gate) || combatResumeApplies ? "" : "none";
      this.resumeBtn.textContent = combatResumeApplies ? "▶ Resume exploring" : "▶ Resume walking";
      this.travelMenu.style.display = "none";
      this.waitMenu.style.display = "none";
      this.fishMenu.style.display = "none";
      this.sleepMenu.style.display = "none";
      if (mode === "dialogue" && !gate) this.toast("Type in the message box below — Resume to keep walking");
    }
    // Nothing below the gate means anything: there is no beat to caption, nobody
    // to be standing next to, and the clock is not running.
    if (gate) return;
    // Cutscene caption — writes DOM only when the beat starts or ends.
    const caption = sim.cutscene ? sim.cutscene.text : "";
    if (caption !== this._caption) {
      this._caption = caption;
      if (caption) this.captionEl.textContent = caption;
      this.captionEl.setAttribute("aria-hidden", caption ? "false" : "true");
      this.captionEl.style.opacity = caption ? "1" : "0";
    }
    if (this._mode === "walk") {
      const canTalk = !!sim.nearNpc;
      // The Talk button is ALSO where a skip is confirmed (90-element `interact`):
      // while the latest GM turn still holds narration the player has not been
      // shown, the first press asks instead of sending. It has to be part of the
      // memo key or the question would be asked and never drawn — the old key was
      // the bare `canTalk` boolean, which does not move when only the label does.
      const asking = canTalk && this.core.talkConfirmArmed?.() === true;
      const talkKey = canTalk ? `${asking ? "skip" : "talk"}:${sim.nearNpc.name}` : "";
      if (talkKey !== this._talkKey) {
        this._talkKey = talkKey;
        this.talkBtn.style.opacity = canTalk ? "1" : "0.45";
        this.talkBtn.textContent = asking
          ? "Skip story & talk?"
          : canTalk
            ? `Talk to ${sim.nearNpc.name} (E)`
            : "Talk (E)";
      }
      // The berth offer, on the same cadence as Talk and memoised the same way:
      // both answer to who is within reach, and both would otherwise write DOM
      // sixty times a second. `already-yours` and `cannot-afford` still SHOW the
      // button — dimmed and saying why — because a control that disappears when
      // the purse runs short teaches the player nothing about the price.
      const offer = PF.economy.berthOffer(this.core);
      // A price is only ever quoted when a real keeper with a real room is within
      // reach — every other refusal comes back with a null price — so this one
      // test covers "is there anything to show at all".
      const shown = offer.price !== null;
      const berthKey = shown ? `${offer.reason ?? "ok"}:${offer.price}` : "";
      if (berthKey !== this._berth) {
        this._berth = berthKey;
        this.berthBtn.style.display = shown ? "" : "none";
        if (shown) {
          this.berthBtn.style.opacity = offer.available ? "1" : "0.45";
          this.berthBtn.textContent =
            offer.reason === "already-yours"
              ? "Your berth"
              : `Rent a berth (${PF.economy.money(sim.world, offer.price)})`;
        }
      }
      // The rod ladder, on the berth's cadence and memoised the same way. The
      // key carries the TIER as well as the reason, so the button re-labels when
      // the ladder moves up a rung under it.
      const rod = PF.economy.rodOffer(this.core);
      // A price is quoted only when a real keeper is within reach and there is a
      // rung left to sell, so — exactly as with the berth — one test covers "is
      // there anything to show at all". This is also where the button VANISHES at
      // the top of the ladder: no rung, no price, no button.
      const rodShown = rod.price !== null;
      const rodKey = rodShown ? `${rod.reason ?? "ok"}:${rod.tier}:${rod.price}` : "";
      if (rodKey !== this._rod) {
        this._rod = rodKey;
        this.buyRodBtn.style.display = rodShown ? "" : "none";
        if (rodShown) {
          this.buyRodBtn.style.opacity = rod.available ? "1" : "0.45";
          const named = PF.economy.describe(sim.world, { t: "rod", k: rod.tier });
          this.buyRodBtn.textContent = `Buy a ${named} (${PF.economy.money(sim.world, rod.price)})`;
        }
      }
      // The spot. `offer.spot` is the render test here — a refusal that still
      // names a spot is one about the PLAYER (no rod, full bag) and belongs on
      // screen saying so; one that names none is about the place, and there is
      // nothing to say. The bait count rides the memo key so the menu's line is
      // never a stack ago.
      const water = PF.economy.fishOffer(this.core);
      const fishKey = water.spot ? `${water.reason ?? "ok"}:${water.spot.id}:${water.bait?.q ?? 0}` : "";
      if (fishKey !== this._fish) {
        this._fish = fishKey;
        this.fishBtn.style.display = water.spot ? "" : "none";
        if (water.spot) {
          this.fishBtn.style.opacity = water.available ? "1" : "0.45";
          this.fishBtn.textContent = `🎣 Fish ${water.spot.name}`;
        } else {
          // Walking away from the bank closes the menu with the button: a list of
          // casts for water nobody is standing at is a list that refuses.
          this.fishMenu.style.display = "none";
        }
      }
      // The bed, on the same cadence: `bed` is the render test, the reason rides
      // the key so a refusal re-labels nothing but re-dims correctly, and walking
      // out of the room takes the menu with the button.
      const bed = PF.economy.sleepOffer(this.core);
      const sleepKey = bed.bed ? `${bed.reason ?? "ok"}` : "";
      if (sleepKey !== this._sleep) {
        this._sleep = sleepKey;
        this.sleepBtn.style.display = bed.bed ? "" : "none";
        if (bed.bed) this.sleepBtn.style.opacity = bed.available ? "1" : "0.45";
        else this.sleepMenu.style.display = "none";
      }
      const clock = sim.clockLabel();
      if (clock !== this._clock) {
        this._clock = clock;
        this.refreshChips();
      }
      // THE OPEN PANELS, each on its own memo. Both run only while their panel is
      // up, and both write DOM only on a change — a journal nobody has opened
      // costs nothing, and an open sheet at rest costs one string compare beside
      // an update() already running berthOffer's zone scan.
      if (this._journal) this._journalSync();
      if (this._sheet) {
        const key = this._sheetValueKey();
        if (key !== this._sheetKey) {
          this._sheetKey = key;
          this._renderSheet();
        }
      }
    }
  }
};
