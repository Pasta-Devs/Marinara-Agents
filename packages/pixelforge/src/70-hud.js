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
    // ── THE RAIL CORRIDOR (plan §2.5, geometry constraint (a)) ───────────────
    // The action column is anchored 12px from the right and its buttons grow
    // LEFTWARD, so the talk window's own right inset is a PROMISE about how wide
    // they are allowed to get — and it was a guess until this block. The window's
    // bottom clears about three stacked buttons; the fourth and every one above it
    // sit beside the conversation, and "Leave <24-character cast name> (E)" is 34
    // characters — near 270px of 12px monospace against a corridor of 172. Any
    // generated name over about nine characters painted over the window.
    //
    // ONE NUMBER, DERIVED, AND BOTH SURFACES SPEND IT — BUT ONLY WHILE A WINDOW
    // IS UP. THE WINDOW IS WHAT CREATES THE CORRIDOR: with nothing docked over
    // the play field the column has the whole width to grow leftward into and
    // there is no second surface for a long label to land on. So the cap is a
    // CONVERSATION-STATE style rather than a construction one — set on the ten
    // rail buttons when the window mounts, cleared when it unmounts (`_railCap`,
    // driven off the mounted predicate in `_syncTalk`) — and in normal walking
    // play every label this package writes is drawn WHOLE.
    //
    // WHAT THE THIRTY BUYS AND WHAT IT COSTS. Thirty characters is a BUDGET
    // struck between the two surfaces, not a measurement of the widest label the
    // rail can produce: the widest with nothing generated in it is the rod
    // ladder's top rung — "Buy a decent angling rig (40 credits)", thirty-seven
    // characters — and reserving for that would put the window's right inset at
    // 319px, which is most of a phone. So WHILE A WINDOW IS OPEN the long ones
    // ellipsize, and they are named here rather than left to be discovered: all
    // four rod offers (thirty-three to thirty-seven characters, both themes and
    // both rungs), the census button carrying a cast name over twenty, and any
    // generated spot or board name past the same bound. That is the trade, and
    // it is paid only in the state that causes it.
    //
    // THE CLIP IS VISUAL ONLY in every one of those cases — `textContent` stays
    // whole, so the accessible name still reads the full label, price included.
    //
    // The window's own title row is deliberately NOT clipped: the window bounds it
    // already, and cutting "<name> — <role>" would lose the role to save a line.
    const RAIL_ADVANCE = 7.2; // one 12px monospace character, the widest common advance
    const RAIL_CHROME = 28; // 13px of padding and a 1px border, on both sides
    const RAIL_INSET = 12; // what the column and the window are both inset by
    this.RAIL_BTN_MAX = Math.ceil(30 * RAIL_ADVANCE + RAIL_CHROME);
    // The window's right inset: the column's own inset, the widest button it may
    // draw WHILE THE WINDOW IS THERE TO BE CLEARED, and one inset of clear air
    // between the two.
    this.RAIL_RESERVE = RAIL_INSET + this.RAIL_BTN_MAX + RAIL_INSET;
    // The ellipsis clothes ship on the button and the WIDTH does not. With no
    // max-width beside them these three rules do nothing at all, which is exactly
    // the closed-window state: nothing to overflow, so nothing to cut.
    S.railBtn = `${S.btn}overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
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

    this.talkBtn = this._btn("Talk (E)", () => core.interact(), S.railBtn);
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
    this.berthBtn = this._btn("Rent a berth", () => this.rentBerth(), S.railBtn);
    this.berthBtn.style.display = "none";
    // The keeper's SECOND trade (M8's amendment: no rod is ever free). Same
    // discipline as the berth beside it — boot hidden, offer-gated per frame,
    // dimmed rather than hidden when the purse is short — with one deliberate
    // divergence: it VANISHES once the ladder is topped out, because rod
    // ownership is global and permanent and a forever-dimmed chip is dead chrome.
    this.buyRodBtn = this._btn("Buy a rod", () => this.buyRod(), S.railBtn);
    this.buyRodBtn.style.display = "none";
    this.travelBtn = this._btn("Travel", () => this.toggleTravel(), S.railBtn);
    // 0.12's headline verb, on the same gating as the berth: shown whenever the
    // player is standing at a registry spot that holds water — INCLUDING when
    // they have no rod, because the refusal is what points them at the vendor and
    // a button that hides itself teaches nobody the mechanic exists.
    this.fishBtn = this._btn("🎣 Fish…", () => this.toggleFish(), S.railBtn);
    this.fishBtn.style.display = "none";
    this.fishMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    // P5's bed, beside the other clock mover because that is what it is — a Wait
    // you can only do where you have a bed, and the only one that leaves a
    // wrap-up behind. Boot hidden and offer-gated per frame, like the berth that
    // sells the bed in the first place.
    this.sleepBtn = this._btn("🛏 Sleep…", () => this.toggleSleep(), S.railBtn);
    this.sleepBtn.style.display = "none";
    this.sleepMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    // 0.13's reading surface, on the fishing verb's gating shape and its menu
    // idiom. Proximity-gated on `nearBoard` ALONE — no offer test, no purse test,
    // no pack test: reading a board costs nothing, sends nothing, and a board
    // that hid itself on a world with no work would be the one board a player
    // most needs to be able to walk up to and be told so.
    //
    // THE EXPOSURE IS TRIGGER-ONLY, and that containment is deliberate (plan
    // §2.1, M5 provisional pending the 0.12 browser playtest): everything about
    // WHERE this lives is these two lines plus the census entry and the gating in
    // update(). Nothing about the menu below or the pack behind it knows it was
    // reached from a button in this column, so a post-playtest reshape — a
    // different trigger, a different surface — moves the entry and the gate and
    // leaves the work untouched.
    this.boardBtn = this._btn("📋 Board", () => this.toggleBoard(), S.railBtn);
    this.boardBtn.style.display = "none";
    this.boardMenu = PF.el("div", {
      style:
        "display:none;flex-direction:column;gap:6px;align-items:flex-end;max-height:40vh;overflow:auto;pointer-events:auto;",
    });
    this.waitBtn = this._btn("⏩ Wait…", () => this.toggleWait(), S.railBtn);
    this.keyboardBtn = this._btn("Keyboard", () => core.setMode("dialogue"), S.railBtn);
    this.resumeBtn = this._btn("▶ Resume walking", () => core.resume(), S.railBtn);
    // THE TEN THE CORRIDOR IS ABOUT, named once so `_railCap` has a list to write
    // and nothing has to infer one. Written out rather than filtered off
    // `this.actions.children`, because that container also holds the four action
    // MENUS — bounded, scrolling panels of their own that never wear the cap —
    // and a filter that got the distinction wrong would be silent. The harness
    // cross-checks this list against the container's real buttons, so an
    // eleventh rail button added without a line here fails there.
    this._railBtns = [
      this.talkBtn,
      this.berthBtn,
      this.buyRodBtn,
      this.travelBtn,
      this.fishBtn,
      this.sleepBtn,
      this.boardBtn,
      this.waitBtn,
      this.keyboardBtn,
      this.resumeBtn,
    ];
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
        this.boardMenu,
        this.boardBtn,
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
    // THE TAB STRIP (0.13 §2.4), and the panel's interior is now three rows:
    // header, strip, body — with the BODY the only thing that scrolls. The strip
    // and the header both sit on `flex:0 0 auto` so a long list cannot push the
    // tabs off the top of the surface, which is the one layout mistake a scroller
    // wrapped around the whole interior makes.
    this.journalTabs = PF.el("div", { style: "display:flex;gap:6px;flex:0 0 auto;" });
    this.journalEl = PF.el("div", { style: panelStyle, "aria-label": "journal" }, [
      PF.el("div", { style: panelHead }, [
        PF.el("div", { style: panelTitle, text: "Journal" }),
        this._btn("✕ Close", () => this.closeJournal()),
      ]),
      this.journalTabs,
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

    // ── THE TALK WINDOW (plan §2.5) ─────────────────────────────────────────
    // The release's flagship surface, and the one panel here that is deliberately
    // NOT `inset:0`. The other three own the screen; this one is docked over the
    // play field and leaves the topbar, the right-hand action rail and the d-pad
    // VISIBLE AND INTERACTIVE, because the ruling this is built to says the player
    // stays mobile while it is open. A full-surface window would make a pointer
    // player immobile and put the clock movers — the presses that END the
    // conversation and restart time — behind the very thing they close.
    //
    // THE THREE GEOMETRY CONSTRAINTS ARE THE PLAN'S; the exact look is the browser
    // pass's. (a) nothing of it overlaps topbar, rail or d-pad at any z-index;
    // (b) it clears the bottom TOAST band, which is the only channel a streaming
    // refusal has while the window stays mounted — painted over, that refusal is a
    // press that visibly did nothing; (c) it SCROLLS INSIDE ITSELF on the four
    // action menus' own idiom (max-height 40vh, overflow auto), because the row
    // count is variable by construction — name and role, up to two record
    // branches, up to four topic branches, an escalation pair, one row per live
    // errand, three doors and Leave. The scroller is the ROW LIST alone, on the
    // journal's three-row shape: the Leave row and the Say input must never scroll
    // out of reach.
    //
    // AND IT IS NOT AN `aria-modal` DIALOG, for the panels' reason above: it would
    // make `_hostOwnsKeyboard` true and kill the keys that close it.
    this.talkWho = PF.el("div", { style: "font:700 12px/1.5 inherit;flex:0 0 auto;" });
    this.talkSaid = PF.el("div", {
      style:
        "flex:0 0 auto;display:none;font:12px/1.6 inherit;opacity:0.92;border-left:2px solid rgba(243,239,226,0.35);padding-left:8px;",
    });
    // The spoken line announces itself: it replaces itself in place, and a reader
    // who cannot see the swap would otherwise never learn the person answered.
    this.talkSaid.setAttribute("role", "status");
    this.talkSaid.setAttribute("aria-live", "polite");
    this.talkRows = PF.el("div", {
      style: "flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;gap:6px;align-items:stretch;",
    });
    // NO AUTOFOCUS, deliberately: the window opens with the walk keys live, and a
    // focused input would swallow WASD from the first frame. Its own keydown is
    // bound below — Escape closes, Enter sends, and neither calls preventDefault,
    // because the host's own handling of those keys is not ours to cancel.
    this.talkInput = PF.el("input", {
      type: "text",
      "aria-label": "say something",
      placeholder: "Say something…",
      style:
        "flex:1 1 auto;min-width:0;pointer-events:auto;background:rgba(20,24,20,0.9);color:#f3efe2;" +
        "border:1px solid rgba(243,239,226,0.35);border-radius:8px;padding:8px 10px;font:12px/1.3 inherit;",
    });
    this.talkInput.addEventListener("keydown", (ev) => this._talkInputKey(ev));
    // THE SAY DOOR IS A PAID CONTROL and takes the same repeat binding the rebuilt
    // rows take — more urgently, in fact: this node is PERMANENT, its text swapped
    // in place, so a hold that arms the confirm on it keeps both the node and the
    // focus the browser would synthesize the spending click from.
    this.talkSendBtn = this._bindPaidPress(this._btn("Send (asks the GM)"), () => this._talkSay());
    this.talkSayRow = PF.el("div", { style: "flex:0 0 auto;display:flex;gap:6px;align-items:stretch;" }, [
      this.talkInput,
      this.talkSendBtn,
    ]);
    this.talkLeaveBtn = this._btn("Leave", () => this.core.closeTalk());
    this.talkLeaveBtn.style.flex = "0 0 auto";
    this.talkEl = PF.el(
      "div",
      {
        "aria-label": "conversation",
        style:
          `position:absolute;left:12px;right:${this.RAIL_RESERVE}px;bottom:calc(190px + env(safe-area-inset-bottom,0px));` +
          "display:none;flex-direction:column;gap:8px;max-height:40vh;z-index:3;pointer-events:auto;" +
          "padding:10px 12px;box-sizing:border-box;border-radius:10px;background:rgba(12,14,12,0.94);" +
          "border:1px solid rgba(243,239,226,0.3);color:#f3efe2;font:12px/1.6 ui-monospace,Consolas,monospace;",
      },
      [this.talkWho, this.talkSaid, this.talkRows, this.talkSayRow, this.talkLeaveBtn],
    );

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
        this.talkEl,
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
    // ── THE TABS THEMSELVES (0.13 §2.4) ──────────────────────────────────────
    // A LIST of {label, render, memoSync}, and it is a list rather than two
    // branches because the third occupant is already committed (P8's extended
    // view). Nothing below this line counts them: the strip is built by walking
    // the list, the active tab is an INDEX into it, and `_journalSync` asks
    // whichever one is active. Landing a third tab is one more entry here.
    //
    // WHAT THE TWO FIELDS DO, and why the memo is one slot rather than one per
    // tab. `memoSync(held)` is asked once a frame while the panel is up and
    // answers the only question the frame has: has what I draw MOVED — handing
    // back the new memo when it has and `null` when it has not. `render()` draws
    // the body from live state. The slot belongs to whichever tab is active and
    // is nulled when the panel opens and when the tab switches, so the two never
    // have to agree about its shape: the ledger watches two array identities and
    // two lengths (a wholesale rebuild and an append that kept its array), the
    // quest tab watches a value-key string, and neither knows the other exists.
    this._journalTabs = [
      {
        label: "Journal",
        render: () => {
          const held = this._ledgerArrays();
          this._renderJournal(held.lines ?? [], held.notices ?? []);
        },
        memoSync: (held) => {
          const { lines, notices } = this._ledgerArrays();
          const lineCount = lines?.length ?? 0;
          const noticeCount = notices?.length ?? 0;
          if (
            held &&
            held.lines === lines &&
            held.notices === notices &&
            held.lineCount === lineCount &&
            held.noticeCount === noticeCount
          )
            return null;
          return { lines, notices, lineCount, noticeCount };
        },
      },
      {
        label: "Jobs",
        render: () => this._renderQuests(),
        memoSync: (held) => {
          const key = this._questValueKey();
          if (held === key) return null;
          // ANY REPAINT THIS TAB DID NOT ASK FOR DROPS THE ARMED CONFIRM (§2.3).
          // A confirm is armed on one row; if the list moved under it — a catch
          // landed, a severance took rows away, the purse changed — the row the
          // second press would land on is not the row the first press meant.
          // The arming press repaints through `_repaintQuests`, which seeds this
          // slot itself, so it is never the repaint that disarms it.
          this._dropQuestPress();
          return key;
        },
      },
    ];
    this._journalTab = 0;
    // The talk window's own state: whether the DOM is up, the memo key its rows
    // were drawn from, and the latched document-level pointerdown pair (see
    // `_bindTalkOutside`). All three are cleared by the unmount.
    this._talkMounted = false;
    this._talkRowKey = null;
    this._talkOutside = null;
    // The instance id of the row whose "set aside" has been pressed once, and the
    // sentence the last press left behind (see `_dropQuestPress`).
    this._dropQuestPress();
    this._buildTabs();
    this.refreshChips();
  }

  /** A button in this HUD's clothes. `style` is the seam the RAIL spends: its
   *  column shares a corridor with the talk window, so its buttons wear the
   *  clipping variant while menu rows inside a bounded panel wear the plain one. */
  _btn(text, onclick, style) {
    return PF.el("button", { type: "button", style: style ?? this.S.btn, text, onclick });
  }

  /** A PAID CONTROL'S ACTIVATION, and the repeat refusal is BOUND here rather
   *  than tested inside the press, because `repeat` only exists on the event that
   *  carries it. `_btn` binds a CLICK listener — 00-prelude's `PF.el` maps an
   *  `onclick` attr to `addEventListener("click", …)` — and the click a browser
   *  synthesizes from a held Enter on a focused button is a MouseEvent, on which
   *  `repeat` is undefined. So an `if (ev.repeat) return` on the click path is
   *  ALWAYS false: a hold fired activation twice, press one arming the story-skip
   *  confirm and press two spending a GM call, defeating "the smallest honest
   *  gate is an affirmative press" through a gap the walk fence cannot cover —
   *  and defeating it SILENTLY, because the inert test read like the guard.
   *
   *  So the node watches its own key run, which is where the fact lives:
   *   • a keydown carrying `repeat` raises the latch AND cancels the browser's
   *     synthesized activation, so the echo's click is never generated;
   *   • the latch is the second half and is kept deliberately — cancellation is a
   *     browser behaviour, and the refusal should not be the only thing standing
   *     between a hold and a paid call. Anything that dispatches a click mid-run
   *     is refused on the latch instead;
   *   • the keyup that ends the hold lowers it, so the next press is live.
   *
   *  A MOUSE PRESS IS UNTOUCHED — it arrives with no key run at all — and so is
   *  the FIRST key of a hold, which carries `repeat === false`. The latch is
   *  PER-NODE, which is the right grain: the row controls are rebuilt by the
   *  arming repaint and the latch that matters is the one on the node the hold is
   *  actually held on. That node is `talkSendBtn` in the case that bites — it is
   *  a permanent child whose text is swapped in place, so a hold keeps both the
   *  node and the focus the second click would come from.
   *
   *  This is the discipline `_talkInputKey` already spends on a genuine keydown,
   *  brought to the controls whose activation only ever arrives as a click. */
  _bindPaidPress(node, onpress) {
    let held = false;
    node.addEventListener("keydown", (ev) => {
      if (!ev?.repeat) return;
      held = true;
      ev.preventDefault?.();
    });
    node.addEventListener("keyup", () => {
      held = false;
    });
    node.addEventListener("click", () => {
      if (held) return;
      onpress();
    });
    return node;
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
    // THE TALK WINDOW'S TWO TEARDOWN DUTIES, and they are here because neither is
    // covered by the line below. `root.remove()` takes every CHILD of the root
    // with it — which is the whole teardown story for the gate and the two panels
    // — but the window owns a DOCUMENT-level pointerdown pair, which is not a
    // child of anything we remove, and a LATCH on the sim, which SURVIVES this by
    // design (a version bump or an error retry remounts the element around the
    // same singleton, 90-element). A latch left set on a surviving sim is a world
    // whose clock never runs again, and a listener left bound is a closure over a
    // window nobody can see.
    //
    // The first goes through the window's own UNMOUNT rather than the unbind
    // alone, so a close is a close wherever it comes from: ONE path clears the
    // listener, the mounted flag, the row memo and the rail's while-open width
    // cap, and nothing here has to keep a second copy of that list in step.
    this._talkUnmount();
    if (this.core?.sim) this.core.sim.talkAnchorId = null;
    this.root.remove();
  }

  // ── The talk window (plan §2.5) ────────────────────────────────────────────

  /** THE MOUNTED PREDICATE, RECONCILED — the first thing `update()` does, on
   *  every path it has (gated, replay and stepped alike), which is what lets the
   *  window close while the sim is not being stepped at all.
   *
   *  The window's DOM is up IFF `sim.mode === "walk" && sim.talkAnchorId != null`.
   *  There is no second source of truth and no "close the window" call that does
   *  not go through the latch: closing IS clearing it, and the DOM follows here.
   *  That is what makes the exception story a property rather than a discipline —
   *  a throw out of any window handler loses at most one frame's reconcile, and
   *  the next frame renders whatever the latch says.
   *
   *  LEAVING WALK UNMOUNTS AND DOES NOT CLEAR. That asymmetry is the handoff: a
   *  paid press enters dialogue, the window goes, and the latch keeps the partner
   *  frozen and the clock stopped through the GM's whole answer. It clears at
   *  `setMode`'s walk ENTRY, which every dialogue exit reaches. */
  _syncTalk() {
    const core = this.core;
    const sim = core?.sim;
    if (!sim || sim.talkAnchorId == null || sim.mode !== "walk") {
      if (this._talkMounted) this._talkUnmount();
      return;
    }
    // In walk with the latch set, every leave condition IS a latch clear.
    const anchor = core._talkAnchor;
    const leave =
      // The anchor object and the latch disagreeing is a state nothing should be
      // able to reach; if it ever is, the conversation is over rather than
      // rendered against whichever half is stale.
      !anchor ||
      anchor.id !== sim.talkAnchorId ||
      // ANCHOR LIVENESS, evaluated BEFORE the band. NPC coordinates are
      // zone-local tiles rewritten into the destination frame on a splice, so a
      // cross-zone distance compare is a category error that can land ~0px
      // "away" — identity membership in the live zone's array is the question,
      // and it answers a splice, a despawn, a zone change and a world
      // replacement in one read.
      !sim.zone().npcs.includes(anchor) ||
      // THE ONE-TILE BAND. Two full tiles centre to centre is over the line, and
      // the predicate says exactly what the prose says: `>=`, not `>`, so 32px
      // from a tile-aligned rest closes it. The geometry is derived rather than
      // tuned — "within one tile" is the adjacency ring (16px orthogonal, ~22.6
      // diagonal) plus the half-tile of slack continuous player coordinates
      // need, and 32 strictly covers the 26px open radius, so no position a
      // window can open at is born closed.
      Math.hypot(anchor.x * PF.TILE + 8 - sim.x, anchor.y * PF.TILE + 8 - sim.y) >= PF.Hud.TUNING.leavePx() ||
      // THE LOADING GATE, which is orthogonal to mode: under it the tick returns
      // before `sim.step`, so a window left mounted there is a keyboard-dead
      // surface over "Writing your world…".
      PF.save.gateHolds(core);
    if (leave) {
      core.closeTalk();
      return;
    }
    if (!this._talkMounted) {
      this._talkMounted = true;
      this.talkEl.style.display = "flex";
      this._railCap(true);
    }
    this._talkRender(anchor);
  }

  _talkUnmount() {
    this._talkMounted = false;
    this._talkRowKey = null;
    this.talkEl.style.display = "none";
    this._railCap(false);
    this._unbindTalkOutside();
  }

  /** THE CONVERSATION-STATE WIDTH CAP (the corridor block at the top of this
   *  file). Set when the window mounts, cleared when it unmounts, and written
   *  from nowhere else — so it is two writes a conversation rather than a style
   *  the per-frame `update()` has to keep re-asserting.
   *
   *  Closed, the rail has the whole width and every label is drawn whole, which
   *  is the state the player spends nearly all of their time in. Open, the ten
   *  are held inside the corridor the window's own right inset promised, and the
   *  labels too long for it ellipsize — visually, `textContent` untouched. */
  _railCap(on) {
    const width = on ? `${this.RAIL_BTN_MAX}px` : "";
    for (const node of this._railBtns) node.style.maxWidth = width;
  }

  /** Called by the core when the window OPENS. The panels close from this side of
   *  the exclusion — the other three toggles close the window from theirs — and
   *  the reveal starts empty, because the last thing somebody said is not
   *  something the next person says. */
  onTalkOpened() {
    this.closeJournal();
    this.closeSheet();
    this.closeBoard();
    this._talkRowKey = null;
    this._talkReveal("");
    this.talkInput.value = "";
    this._bindTalkOutside();
    this.update();
  }

  /** POINTER-DOWN OUTSIDE CLOSES IT — the mouse exit, and the reason it needs a
   *  latched pair rather than a child listener: a document-level handler is not a
   *  child of `this.root`, so `destroy()`'s `root.remove()` does not take it.
   *  Bound at open, unbound at close AND in `destroy()`.
   *
   *  THE EXEMPTION SET IS THE WHOLE DESIGN, and it is THREE SURFACES: the window
   *  itself, the d-pad, and the action rail. The handler hears every press whose
   *  surface does not stopPropagation, and the d-pad and rail buttons deliberately
   *  do not — they `preventDefault` and let the event through. So without these,
   *  a pointer player's FIRST movement press closed the window at zero tiles,
   *  against the ruling's own "more than one tile", on exactly the controls the
   *  window's partial geometry was shaped to keep live. With them, movement leaves
   *  through the 32px band and a rail press leaves through the mover's own latch
   *  clear — both honest closes through their own doors. Everything else outside
   *  still closes.
   *
   *  THE CENSUS BUTTON IS NOT A FOURTH ENTRY. It is a child of the rail, so the
   *  rail's own `contains` already answers for it, and naming it again was a line
   *  that could never fire — while reading as though the rail did not cover it.
   *  The harness presses it by name anyway, which is what keeps that true. */
  _bindTalkOutside() {
    if (this._talkOutside) return;
    this._talkOutside = (ev) => {
      const target = ev?.target;
      if (!target) return;
      for (const exempt of [this.talkEl, this.dpad, this.actions]) if (exempt?.contains?.(target)) return;
      this.core.closeTalk();
    };
    document.addEventListener("pointerdown", this._talkOutside);
  }

  _unbindTalkOutside() {
    if (!this._talkOutside) return;
    document.removeEventListener("pointerdown", this._talkOutside);
    this._talkOutside = null;
  }

  /** The line the anchor just said, or "" for nothing said yet. */
  _talkReveal(text) {
    this.talkSaid.textContent = text;
    this.talkSaid.style.display = text ? "" : "none";
  }

  /** Why every paid control is dimmed right now, or null. The covenant is that
   *  the doors NEVER VANISH — they dim, with the title saying why — so a player
   *  can always see that talking is a thing this window does. */
  _talkDoorNote() {
    const core = this.core;
    if (typeof core.host?.sendMessage !== "function") return "The story isn't taking turns right now.";
    if (core.host.isStreaming) return "The story is still being written…";
    return null;
  }

  /** What the row list is drawn FROM. The clock is frozen while the window is
   *  open, so the day, the daypart and the sky cannot move under it — they are in
   *  the key anyway, because an override write is a props delivery and not a
   *  clock. What genuinely does move is the errand list (a settle), the
   *  escalation ratchet, the dim state and which control is holding the confirm. */
  _talkKeyOf(anchor) {
    const sim = this.core.sim;
    const errands = this._talkErrands(anchor)
      .map((row) => row.id)
      .join(",");
    // THE ARMED READ AND NOT THE RAW MEMO. `talkConfirmArmed` is also where the
    // question goes stale — the narration finishing drops it with no press at all
    // — so a key built off the memo alone would leave "Skip story & talk?" drawn
    // on a control whose question no longer exists.
    const confirm = this.core.talkConfirmArmed?.() === true ? (this.core._talkConfirm?.controlId ?? "") : "";
    return [
      anchor.id,
      sim.day,
      sim.daypart(),
      sim.weather().word,
      errands,
      PF.pack.askBurned(this.core, anchor) ? "burnt" : "",
      this._talkDoorNote() ?? "",
      confirm,
    ].join("|");
  }

  /** The live `deliver` rows this person is the target of. Read fresh: the
   *  window draws one labelled branch per row, and a row settled a press ago is
   *  a branch that should already be gone. */
  _talkErrands(anchor) {
    const player = PF.player.get(this.core);
    const rows = Array.isArray(player?.quests?.active) ? player.quests.active : [];
    return rows.filter((row) => String(row?.verb) === "deliver" && String(row?.target) === anchor.name);
  }

  _talkRender(anchor) {
    const key = this._talkKeyOf(anchor);
    if (key === this._talkRowKey) return;
    this._talkRowKey = key;
    // THE STANDING RIDES THE TITLE (0.15, plan §13.4) — one word, and only when
    // it says something: a stranger's window reads exactly as 0.14's did, and
    // "stranger" written out would be the ladder announcing its own floor.
    // Hostile outranks the rung, here as everywhere: whatever you built before,
    // THIS is the standing that decides the room.
    const stand = PF.player.rung(this.core, this.core.sim?.world?.startZone, anchor.name);
    const standWord = stand.h ? "hostile" : stand.d > 0 ? PF.player.RUNGS[stand.d] : "";
    const who = anchor.role ? `${anchor.name} — ${anchor.role}` : anchor.name;
    this.talkWho.textContent = standWord ? `${who} · ${standWord}` : who;
    const core = this.core;
    const note = this._talkDoorNote();
    const armed = core._talkConfirm?.controlId ?? null;
    /** One paid control. Labelled "(asks the GM)" on its face — that suffix IS
     *  the covenant's marker — dimmed with a reason rather than removed, and
     *  re-labelled into the question when the confirm is armed on THIS control.
     *  Key repeat is refused by `_bindPaidPress`, which is why the button is
     *  built with no handler and bound afterwards: `_keyDown` has no repeat guard
     *  and the prologue's confirm returns in WALK mode without changing it, so
     *  the refusal has to live on the control's own key run. */
    const paid = (id, label, onpress) => {
      const asking = armed === id && core.talkConfirmArmed?.(id) === true;
      const node = this._bindPaidPress(this._btn(asking ? "Skip story & talk?" : `${label} (asks the GM)`), onpress);
      node.style.textAlign = "left";
      if (note) {
        node.style.opacity = "0.45";
        node.setAttribute("title", note);
      }
      return node;
    };
    /** One FREE branch: a pack or record read, zero GM calls, and the answer
     *  lands in the reveal above rather than anywhere the narrator can see. */
    const free = (label, answer) =>
      this._btn(label, () => {
        const said = typeof answer === "function" ? answer() : answer;
        if (said) this._talkReveal(said);
      });
    const rows = [];
    // 2. THE COMPILED RECORD — only the halves the record actually carries.
    const record = PF.pack.askRecord(core, anchor);
    if (record.work) rows.push(free("What do you do?", record.work));
    if (record.home) rows.push(free("Where do you live?", record.home));
    // 3. THE PACK'S TOPICS, WITH HONEST SUPPRESSION: a branch with no servable
    // line does not render. On a thin generated pack that is one or two buttons
    // rather than four that answer with somebody else's topic — and on the
    // enriched defaults it is all four, which is the inversion 0.14 ships with:
    // the worlds that paid two GM calls meet the thinnest window.
    for (const [branch, label] of [
      ["rumor", "Ask about the local rumors"],
      ["work", "Ask about work"],
      ["place", "Ask about this place"],
      ["smalltalk", "Pass the time"],
    ])
      if (PF.pack.askHas(core, anchor, branch)) rows.push(free(label, () => PF.pack.ask(core, anchor, branch)));
    // 4. THE ESCALATION PAIR: the sealed door-line is FREE and re-readable
    // forever; the follow-up behind it is paid and RATCHETED per session.
    const sealedLine = PF.pack.askEscalation(core, anchor);
    if (sealedLine) {
      rows.push(free("Ask what's going on", sealedLine));
      if (!PF.pack.askBurned(core, anchor))
        rows.push(paid("press", "Press them about it", () => this.core.talkPress()));
    }
    // 5. ONE ROW PER ERRAND, and the label names what the press settles. Two
    // errands to Bram are two labelled presses: a label is a mechanism only if it
    // says which row it is about.
    // The row itself carries no title — a quest row is a closed eight-field
    // literal and the words live on the TEMPLATE — so the title is resolved the
    // way `rowText` resolves it, off the fold, with the mechanical phrase behind
    // it for a row whose template this world no longer offers.
    const folded = PF.save.packFold(core);
    for (const row of this._talkErrands(anchor)) {
      const template = PF.pack.templateOf(row.id);
      const title = (template ? folded?.byId?.get(template)?.title : "") || `word for ${anchor.name}`;
      rows.push(paid(`deliver:${row.id}`, `Hand over: ${title}`, () => this.core.talkHandOver(row.id)));
    }
    // 6. THE DOOR THAT NEVER VANISHES. (The other one is the Say row below, which
    // is a permanent child rather than a rebuilt row — rebuilding it would throw
    // away whatever the player had half-typed.)
    rows.push(paid("free", "Just talk", () => this.core.talkFree()));
    this.talkRows.replaceChildren(...rows);
    // The Say door's own dim state, applied to the permanent node.
    const sayAsking = armed === "say" && core.talkConfirmArmed?.("say") === true;
    this.talkSendBtn.textContent = sayAsking ? "Skip story & talk?" : "Send (asks the GM)";
    this.talkSendBtn.style.opacity = note ? "0.45" : "1";
    if (note) this.talkSendBtn.setAttribute("title", note);
    else this.talkSendBtn.removeAttribute?.("title");
  }

  /** The say door's own keydown. Escape closes the window (a SIM write — a
   *  DOM-only close would leave the latch set and the mounted predicate would
   *  put the window straight back on the next frame); Enter sends. Neither calls
   *  preventDefault, and WASD types text while focus is in here — which is the
   *  whole reason the d-pad had to stay reachable. */
  _talkInputKey(ev) {
    const key = String(ev?.key ?? "").toLowerCase();
    if (key === "escape") {
      this.talkInput.blur?.();
      this.core.closeTalk();
      return;
    }
    if (key === "enter" && !ev.repeat) this._talkSay();
  }

  _talkSay() {
    const text = String(this.talkInput.value ?? "").trim();
    if (!text) return;
    this.core.talkSay(text);
  }

  /** ONE SENTENCE PER EVENT (0.15). `toast` below is ONE node and ONE timer per
   *  surface, which makes two toasts in a tick exactly one toast: the second
   *  overwrites the first and the player never sees it. That is not a queue
   *  waiting to be built — it is a rule about the copy. Everything a single
   *  press has to say is composed HERE and said once, parts joined by a middot,
   *  so a rung earned at a hand-in rides the money receipt instead of erasing
   *  it. Empty parts drop out, so the ordinary receipt is unchanged. */
  _said(...parts) {
    return parts.filter(Boolean).join(" · ");
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

  // ── THE BOARD (plan §2.1) ──────────────────────────────────────────────────
  // Two sections in one list, and the surface owns NONE of the rules: what is
  // offered, what state each offer is in and whether a job can be handed in are
  // all answered by 61-pack's `boardOffers`, re-read at every press. This is the
  // drawing.

  /** Open the board, or close it. The fishing menu's shape one method up: a
   *  refusal is answered WHERE IT WAS PRESSED rather than behind a list whose
   *  every row then refuses. */
  toggleBoard() {
    const open = this.boardMenu.style.display !== "flex";
    if (!open) {
      this.boardMenu.style.display = "none";
      return;
    }
    const view = PF.pack.boardOffers(this.core);
    if (!view.available) {
      this.boardMenu.style.display = "none";
      this.toast(this.boardRefusal(view.reason));
      return;
    }
    // The window is the one member of the set the board CAN be opened over — the
    // rail stays live by the window's own geometry — so this is the direction
    // that had to be wired, and it is a latch clear: the clock starts again.
    this.core.closeTalk?.();
    this._renderBoard(view);
    this.boardMenu.style.display = "flex";
  }

  closeBoard() {
    this.boardMenu.style.display = "none";
  }

  /** BOTH SECTIONS, every time. A press changes both — accepting puts a row in
   *  the jobs list AND dims the offer it came from, handing one in empties a job
   *  AND can free the cap that was dimming every offer on the board — so the
   *  handlers below re-render the whole list rather than patching a row.
   *  Event-driven and never per frame: update() only decides whether the BUTTON
   *  is on screen.
   *
   *  THE JOBS SECTION LEADS WHEN IT HOLDS SOMETHING FINISHED. A player walking
   *  back with five carp wants the hand-in above the fold, not under four fresh
   *  offers; with nothing finished, the day's work is the reason they walked up.
   *
   *  A row accepted today renders in BOTH sections on purpose (plan §2.1): the
   *  dimmed offer is the day's receipt — it is what the board posted — and the
   *  jobs row is the live object with the count on it. */
  _renderBoard(view) {
    const chip = (text, dim) => PF.el("span", { style: dim ? `${this.S.chip}opacity:0.55;` : this.S.chip, text });
    const offers = [];
    if (!view.folded.ids.length) {
      // THE PACKLESS WORLD'S OWN STATE (Q9), and it is deliberately none of the
      // others. Not "not yet", not "check back", not "everything is taken" — a
      // world sealed before this release, or one whose owner declined the second
      // call, has no work in it and will not grow any on its own. The board is
      // still standing there to say so, which is the whole reason the fixture is
      // unconditional.
      offers.push(chip("No work posted here.", true));
    } else {
      offers.push(chip("Today's work"));
      for (const offer of view.offers) {
        const money = PF.economy.money(this.core.sim.world, offer.reward.money);
        const label = `${offer.template.title} — ${money}`;
        if (offer.state === "open") {
          offers.push(this._btn(label, () => this.acceptWork(offer.template.id)));
          continue;
        }
        // DIMMED AND STILL PRESSABLE, on the berth button's rule: a control that
        // vanishes teaches the player nothing about why. The press says which of
        // the three reasons it is.
        //
        // AND THE COPY NAMES NO DIRECTION. It used to say "below", which was true
        // on the day it was written and false the moment the row it points at
        // finished: a finished job lifts the jobs section ABOVE the offers (see
        // the ordering rule at the foot of this method), so the receipt was
        // telling the player to look the wrong way at exactly the moment they had
        // something to hand in. The list is named instead of placed.
        //
        // TWO OF THE STATES CARRY THEIR OWN WORDS and the other two keep the
        // price. `taken` and `filled` are things the player DID today, and a row
        // still quoting its fee after it has been paid out reads as work still on
        // offer; `dup` and `at-cap` are about the list rather than the row, and
        // the fee is still the honest label for work that is genuinely open to
        // somebody with room for it.
        const state = offer.state;
        const row = this._btn(
          state === "taken"
            ? `${offer.template.title} — taken — see your jobs list`
            : state === "filled"
              ? `${offer.template.title} — filled today`
              : label,
          () => this.acceptWork(offer.template.id),
        );
        row.style.opacity = "0.45";
        offers.push(row);
      }
    }
    const jobs = [];
    if (view.jobs.length) {
      jobs.push(chip("Your jobs here"));
      for (const row of view.jobs) {
        const text = PF.pack.rowText(row, view.folded);
        const done = Math.round(Number(row.have) || 0) >= Math.max(1, Math.round(Number(row.n) || 1));
        if (!done) {
          jobs.push(chip(text, true));
          continue;
        }
        jobs.push(this._btn(`${text} — hand it in`, () => this.turnInJob(row.id)));
      }
    }
    const finished = view.jobs.some(
      (row) => Math.round(Number(row.have) || 0) >= Math.max(1, Math.round(Number(row.n) || 1)),
    );
    this.boardMenu.replaceChildren(...(finished ? [...jobs, ...offers] : [...offers, ...jobs]));
  }

  /** Take an offer. The offer is re-read inside `accept`, so a menu drawn a press
   *  ago cannot take a row twice or take one past the cap; this turns the answer
   *  into a sentence and redraws both sections. */
  acceptWork(templateId) {
    const result = PF.pack.accept(this.core, templateId);
    if (!result.ok) {
      this.toast(this.boardRefusal(result.reason));
      // A refusal that came from the BOARD's own state — taken, duplicated, at
      // the cap — is still a change the list may not be showing (another press
      // filled the cap), so the redraw happens on both arms. A refusal about the
      // place or the mode leaves nothing to draw and the menu is already closing.
      const view = PF.pack.boardOffers(this.core);
      if (view.available) this._renderBoard(view);
      else this.closeBoard();
      return;
    }
    this.toast(`Taken on: ${result.title}`);
    const view = PF.pack.boardOffers(this.core);
    if (view.available) this._renderBoard(view);
  }

  /** Hand a finished job in. `turnIn` re-finds the row and re-checks `have >= n`
   *  at the press, so a row that moved under the menu cannot be paid twice. */
  turnInJob(id) {
    const result = PF.pack.turnIn(this.core, id);
    if (!result.ok) {
      this.toast(this.boardRefusal(result.reason));
      const refused = PF.pack.boardOffers(this.core);
      if (refused.available) this._renderBoard(refused);
      else this.closeBoard();
      return;
    }
    // The purse moved, so the chips have.
    this.refreshChips();
    const paid = PF.economy.money(this.core.sim.world, result.money);
    // The receipt already names the giver, so the rise rides it as a CLAUSE —
    // one sentence, and the money survives the rung (see `_said`).
    this.toast(
      this._said(
        result.giver ? `Handed in to ${result.giver} — ${paid}` : `Handed in — ${paid}`,
        result.giver && result.rose ? this.roseClause(result.rose) : "",
      ),
    );
    const view = PF.pack.boardOffers(this.core);
    if (view.available) this._renderBoard(view);
  }

  /** The board's refusals, turned into sentences — the fishing verb's
   *  reason-to-sentence map, not a fork of it.
   *
   *  `not-at-board` and `no-world` are absent for fishRefusal's own reason: the
   *  button is not on screen where there is no board, so a line for them would be
   *  copy nobody can reach — which is exactly why the fall-through has to be a
   *  real sentence.
   *
   *  THE AT-CAP COPY NAMES BOTH RELIEFS and both are now built: finishing is the
   *  board's own hand-in, and setting aside is the quest tab's per-row confirm
   *  (§2.3, `setAsideJob`). The wording is §2.1's verbatim, and it was written
   *  one slice before the affordance it points at because the arc ships as ONE
   *  submission — no player is ever handed a build where "set aside" points at
   *  nothing.
   *
   *  AND IT IS THE ONE MAP, read from both surfaces. The name is the board's
   *  because the board is where it was written, not because the sentences are:
   *  every reason in it is a reason about a JOB, and the two places a job can be
   *  pressed answer them identically. A second map for the tab is how one of them
   *  comes to say something the other does not.
   *
   *  `unknown-id` IS THE BOARD'S OWN, corrected: slice 3 filed it with the
   *  surfaces the board cannot reach, and the board reaches it every time a row
   *  leaves `quests.active` under an open menu — a mint severance parking it, the
   *  repair pass dropping it, a rebuild landing between the draw and the press.
   *  The press then re-finds nothing and the generic fall-through said "there is
   *  nothing to do at the board", which is a sentence about the BOARD written for
   *  a row that went away. `abandon-unknown` is that same fact one surface along
   *  — the quest tab pressing a row the block no longer holds — and it shipped
   *  with this enumeration a slice before its producer existed, which is why the
   *  two read alike (plan §2.3's refusal list is complete here). */
  boardRefusal(reason) {
    if (reason === "wrong-mode") return "Not while you're talking — resume walking first";
    if (reason === "gate-held") return "Not yet — your world is still being written.";
    if (reason === "at-cap") return "Your job list is full — finish or set aside a job first.";
    if (reason === "taken") return "You took that one today — it is on your jobs list.";
    if (reason === "filled") return "That work is done for today — the board posts it again another day.";
    if (reason === "dup") return "You are already on that one.";
    if (reason === "not-done") return "That one isn't finished yet.";
    // The row left today's selection between the draw and the press — the day
    // rolled over under an open menu, or a rebuild landed beneath it. A sentence
    // about the ROW, on `unknown-id`'s own reasoning one line down.
    if (reason === "not-offered") return "The board isn't posting that one now.";
    if (reason === "unknown-id") return "That job is no longer on your list.";
    if (reason === "abandon-unknown") return "That job is no longer on your list.";
    return "There is nothing to do at the board just now.";
  }

  /** A JOB THAT FINISHED WHERE THE PLAYER WAS STANDING, rather than at the board.
   *  The visit and deliver verbs complete at their own sites (61-pack), and a
   *  completion the player is never told about is a purse that moved for no
   *  reason they can see — the board's hand-in toasts, and a session of fishing
   *  toasts, so an errand run and a walk taken have to as well.
   *
   *  ONE PLACE FOR THE COPY, called from three sites (the frame loop's arrival,
   *  50-spatial's drift arm, and Talk's accepted turn). It takes the LIST rather
   *  than one row because both verbs are answered with a filter: two rows asking
   *  for the same walk are both filled by taking it, and each is its own sentence.
   *  An empty list says nothing and touches nothing, which is the ordinary case
   *  for every arrival and every greeting in the game. */
  questFilled(done, rise) {
    const rows = Array.isArray(done) ? done : [];
    if (!rows.length && !rise?.rung) return;
    const world = this.core.sim?.world;
    // ONE SENTENCE FOR THE WHOLE PRESS. Two errands filled by one walk used to
    // toast twice and show once; a rise beside a receipt did the same to the
    // money. Everything the press has to say is composed and said together.
    const parts = rows.map((row) => {
      const paid = PF.economy.money(world, row.money);
      // The rise rides the settle's own return, so it is said exactly when the
      // rung was earned and never re-fires on a reload — there is nothing stored
      // to re-announce (plan §13.4). The CLAUSE form, because this half of the
      // sentence has already named the person.
      return this._said(
        row.giver ? `Done for ${row.giver} — ${paid}` : `Job done — ${paid}`,
        row.giver && row.rose ? this.roseClause(row.rose) : "",
      );
    });
    // The TURN'S OWN rise — the greeting that crossed a line on the way to the
    // handover — joins the same sentence NAMED, because the person who warmed
    // to you need not be the person the errand was for.
    if (rise?.rung) parts.push(this.roseLine(rise.name, rise.rung));
    this.toast(this._said(...parts));
    // The purse moved, so the chips have.
    this.refreshChips();
  }

  /** The promotion, said once, in plain words. 0.12's precedent: a level change
   *  is toasted the moment it happens and then lives on the sheet — a rung
   *  change is the same kind of moment, and the Standing panel is its sheet. */
  roseLine(name, rung) {
    if (rung >= 3) return `${name} counts you a close friend now.`;
    if (rung >= 2) return `${name} counts you a friend now.`;
    return `${name} knows you now.`;
  }

  /** The same rise as a CLAUSE, for a receipt that has already said who it was
   *  about ("Handed in to Alder — 6 coins · they know you now."). Two spellings
   *  of one moment is the bug roseLine's own header warns about, so this is the
   *  same authority and the same ladder words — only the subject moves to a
   *  pronoun, so the sentence does not say the name twice. */
  roseClause(rung) {
    if (rung >= 3) return "they count you a close friend now.";
    if (rung >= 2) return "they count you a friend now.";
    return "they know you now.";
  }

  /** Take the rod the button is offering. The offer is re-read inside buyRod, so
   *  a frame-old button cannot overcharge anybody; this turns the refusals into
   *  sentences, exactly as rentBerth's caller does. */
  buyRod() {
    const world = this.core.sim?.world;
    const result = PF.economy.buyRod(this.core);
    if (result.ok) {
      const named = PF.economy.describe(world, { t: "rod", k: result.tier });
      // The rod's receipt names the rod, not the keeper — so the rise rides it
      // named, exactly as the berth's does.
      this.toast(
        this._said(
          result.bait
            ? `A ${named} is yours, line and tackle included — ${PF.economy.money(world, result.price)}.`
            : `A ${named} is yours — ${PF.economy.money(world, result.price)}.`,
          result.rose ? this.roseLine(result.keeper, result.rose) : "",
        ),
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
      // The berth's receipt never names the keeper, so a rise it carries is said
      // in the NAMED form and composed into the same sentence (see `_said`).
      this.toast(
        this._said(
          `A berth is yours — ${PF.economy.money(world, result.price)} the night.`,
          result.rose ? this.roseLine(result.keeper, result.rose) : "",
        ),
      );
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
   *  is the harness, which pins it.
   *
   *  THE BOARD'S LIST CLOSES HERE TOO (0.13 §2.1). It is not a panel — it is a
   *  floating list in the action column, like the fishing and sleeping menus —
   *  but Escape is the only key that can reach any of them, and a list of work
   *  left standing over a closed surface is the one of the four that holds a
   *  press with consequences behind it. It rides the return for the same reason
   *  the panels do: "something was open" is the honest answer either way. */
  closePanels() {
    // THE TALK WINDOW COUNTS AS ONE OF THEM, in both halves of the exclusion.
    // This is Escape's close-ALL path; the direction that actually matters is the
    // other one — each of the three toggles closes the WINDOW before it opens, and
    // the window's own open closes all three — because the topbar openers stay
    // interactive over an open window by geometry, and an unexcluded journal
    // mounts `inset:0` at z-3 over the top of it: a player reading a journal over
    // a FROZEN CLOCK with an invisible window underneath, whose first Escape
    // closes a surface they cannot see.
    const open =
      this._journal || this._sheet || this.boardMenu.style.display === "flex" || this.core.talkOpen?.() === true;
    this.core.closeTalk?.();
    this.closeJournal();
    this.closeSheet();
    this.closeBoard();
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
    // THE BOARD COUNTS AS ONE OF THEM, and it is the one with consequences: the
    // quest tab can retire the very row a standing board is drawing, and a board
    // left mounted underneath comes back out showing it. `update`'s nearBoard arm
    // already closes the list when the player walks away from the fixture; this
    // is that same rule for the other way they leave it.
    this.closeSheet();
    this.closeBoard();
    // …AND THE TALK WINDOW, which is the one member of the set that also stops
    // the clock: closing it here is a latch clear, and time starts again.
    this.core.closeTalk?.();
    this._journal = true;
    // THESE TWO ARE DEFENSIVE SYMMETRY, and saying so is the point: the CLOSE
    // side is the load-bearing one, and every close routes through
    // `closeJournal` — the chip, and Escape via `closePanels` — so nothing can
    // reach this line with a press still armed or a slot still held. (Leaving
    // the world is NOT one of them: `update` HIDES the journal and leaves
    // `_journal` true, so the panel comes back as it was on the next in-world
    // frame. It never reaches this line at all.)
    // They are unkillable by construction and a mutation test will never red on
    // them; they stay because an open that assumed a clean slot would be resting
    // on a guarantee written in another method.
    this._journalMemo = null;
    this._dropQuestPress();
    this._journalSync();
    this.journalEl.style.display = "flex";
  }

  closeJournal() {
    this._journal = false;
    this._journalMemo = null;
    // A CLOSED PANEL HOLDS NO ARMED CONFIRM (§2.3). The tab it was armed on is
    // repainted from scratch on the next open, and a press half-made an hour ago
    // is not permission for the press that reopens the panel.
    this._dropQuestPress();
    this.journalEl.style.display = "none";
  }

  /** THE STRIP, built by WALKING THE LIST (§2.4). Nothing here knows there are
   *  two of them: a third descriptor lands a third button with no other change,
   *  which is the whole reason the tabs are a list. Rebuildable rather than
   *  inlined into the constructor for the same reason — a list that can only be
   *  read once at mount is a list with a two-tab assumption in it. */
  _buildTabs() {
    this._tabBtns = this._journalTabs.map((tab, index) => this._btn(tab.label, () => this._selectTab(index)));
    this.journalTabs.replaceChildren(...this._tabBtns);
    this._paintTabs();
  }

  /** Which tab is active, said TWICE: the style property every other state in
   *  this file is said in, and the pressed state a screen reader can actually
   *  read. Opacity alone is a mark only a sighted user gets — the cutscene
   *  caption at the top of this file carries the same argument — so the shade and
   *  the attribute move together in one loop.
   *
   *  WHAT IS STILL FORBIDDEN IS `role`/`aria-modal`, and the distinction is the
   *  whole reason the pressed state is safe: `_hostOwnsKeyboard` (90-element)
   *  believes any visible `[role="dialog"][aria-modal="true"]`, so a strip that
   *  dressed its buttons as DIALOG furniture would make the keys that close the
   *  panel inert the moment it opened. `aria-pressed` matches neither half of
   *  that selector. The panel beside them carries the same prohibition and the
   *  harness pins both. */
  _paintTabs() {
    for (let i = 0; i < this._tabBtns.length; i++) {
      const active = i === this._journalTab;
      this._tabBtns[i].style.opacity = active ? "1" : "0.5";
      // The same state, said again in the channel opacity cannot reach — the
      // caption's reasoning at the top of this file, applied to the strip. This
      // is NOT the furniture the paragraph above forbids: `_hostOwnsKeyboard`
      // believes `[role="dialog"][aria-modal="true"]`, and a pressed state
      // matches neither half of that selector, so the keys that close the panel
      // stay live. `aria-pressed` and not `role="tab"` because a tablist owes a
      // reader `aria-controls` and arrow-key navigation, and the strip has
      // neither to give.
      this._tabBtns[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  /** Switch tabs. Three things go with the switch and each is its own rule:
   *  the MEMO (the slot belongs to the tab that is active, and the incoming tab
   *  has never seen it), the ARMED CONFIRM (§2.3 — a half-made press does not
   *  survive leaving the surface it was made on), and the SCROLL POSITION, which
   *  is reset because the body is one scroller shared by every tab and arriving
   *  at a short list two hundred pixels down is arriving at a blank panel.
   *
   *  Re-pressing the ACTIVE tab is a no-op on purpose: it is not a switch, so it
   *  neither repaints nor disarms anything. */
  _selectTab(index) {
    if (index === this._journalTab || !this._journalTabs[index]) return;
    this._journalTab = index;
    this._journalMemo = null;
    this._dropQuestPress();
    this.journalBody.scrollTop = 0;
    this._paintTabs();
    this._journalSync();
  }

  /** THE PANEL'S ONE PER-FRAME QUESTION, asked of whichever tab is up. The tab
   *  answers with its new memo or with `null` for "nothing I draw has moved",
   *  and this seeds the slot and paints. Two lines of driver and no branch per
   *  tab: everything that differs between them lives in the descriptors. */
  _journalSync() {
    const tab = this._journalTabs[this._journalTab];
    if (!tab) return;
    const memo = tab.memoSync(this._journalMemo);
    if (memo === null) return;
    this._journalMemo = memo;
    tab.render();
  }

  /** The ledger tab's two arrays, through ONE reader — which is what makes "the
   *  memo is the projection of what the tab draws" true rather than nearly true
   *  (the sheet's `_num` discipline). The memo watches their IDENTITIES because
   *  `_compactLedger` rebuilds `ledger.lines` on every append and a restore
   *  assigns a fresh band, and their LENGTHS because `notice()` pushes onto the
   *  array it already had while the band is under its cap.
   *
   *  What it deliberately does NOT track is the told flag: the band shows told
   *  and untold rows alike, so a burn changes nothing the panel draws. */
  _ledgerArrays() {
    const player = PF.player.get(this.core);
    return {
      lines: Array.isArray(player?.ledger?.lines) ? player.ledger.lines : null,
      notices: Array.isArray(player?.ledger?.notices) ? player.ledger.notices : null,
    };
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

  // ── THE QUEST TAB (0.13 §2.4) ─────────────────────────────────────────────
  // What the player is carrying, what they have finished, and what a world they
  // no longer stand in is holding for them. It renders through the SHARED row
  // renderer (61-pack `rowText`) and adds no branch of its own to it: the board's
  // jobs section and this list are the same sentences, because they are the same
  // rows and there is one function that turns a row into words.

  /** The two press-driven pieces of state this tab draws, dropped together. They
   *  are HUD-side and nowhere else — an abandon is free and player-initiated, so
   *  there is nothing to persist and nothing a reload should remember — and
   *  neither is in the value key, deliberately: a press paints its own answer
   *  immediately (`_repaintQuests`), while the key is what catches the BLOCK
   *  moving underneath. Anything that moves the block drops both, which is the
   *  point: the row a second press would land on must be the row the first press
   *  meant. */
  _dropQuestPress() {
    this._armedAbandon = null;
    this._questSaid = "";
  }

  /** A press has changed what this tab draws, so paint it AND seed the memo with
   *  the key the paint was made from. Seeding is what keeps the armed confirm
   *  alive: the next frame compares equal, `memoSync` answers "nothing moved",
   *  and nothing disarms the press the player has half-made. Only ever called
   *  from this tab's own buttons, which exist only while this tab is painted. */
  _repaintQuests() {
    this._journalMemo = this._questValueKey();
    this._renderQuests();
  }

  /** Where this world's board is, read ONCE for both the value key and the empty
   *  state (the sheet's one-reader discipline). The fixture is unconditional and
   *  lives on the settlement root, so this answers on every world that has one —
   *  and `null` rather than a guess on one that somehow has not, which is the
   *  only case the empty state has nothing to point at. */
  _boardWhere() {
    const world = this.core.sim?.world;
    const zone = PF.own(world?.zones, world?.startZone) ?? null;
    const board = (Array.isArray(zone?.features) ? zone.features : []).find(
      (row) => row?.id === PF.world.BOARD_FEATURE_ID,
    );
    return board ? { board: String(board.name), zone: String(zone.name) } : null;
  }

  /** How many quest rows the stamp bag is holding for another world. A severance
   *  parks the world-bound half of the block (58-player `applyStamps`) and the
   *  notice band narrates it in story order; this is the same fact told where the
   *  rows themselves are missing from. */
  _parkedQuests() {
    const parked = PF.quarantine?.peek?.("stamp")?.fields?.questsActive;
    return Array.isArray(parked) ? parked.length : 0;
  }

  /** THE EMPTY STATE (§2.4): present-tense fact, a pointer and not a promise, no
   *  nag — and it must not contradict the board it points at. The two arms are
   *  the board's own test (`folded.ids.length`), so a packless or demoted world
   *  says the same thing here that the board says there ("No work posted here")
   *  rather than sending the player across the settlement to read it. */
  _questEmpty(folded) {
    const where = this._boardWhere();
    if (!where) return "Nothing taken on.";
    return folded?.ids?.length
      ? `Nothing taken on. ${where.board} in ${where.zone} has work.`
      : `Nothing taken on. ${where.board} in ${where.zone} has none posted.`;
  }

  /** The counter's own word when the pack cannot name it: the last segment of the
   *  template id (`p:<pack>:<slug>` and `b:<slug>` both end in it). A finished
   *  job's counter outlives the pack that minted it — a demotion, a world sealed
   *  against another brief, a `b:` counter that travelled here from somewhere
   *  else — so the tally has to be legible without a title, exactly as a live row
   *  is (`rowText`'s own fallback). */
  _slugOf(id) {
    const text = String(id ?? "");
    return text.slice(text.lastIndexOf(":") + 1) || text;
  }

  /** THE LIVE VALUE KEY (§2.4, the sheet's projection invariant adopted verbatim
   *  — see `_sheetValueKey`). Every field of every live row, both completion maps
   *  as sorted `template:count` joins (NEVER sums: trimming a counter and
   *  incrementing another is a sum that does not move), the world's theme, and
   *  THE PACK'S OWN IDENTITY.
   *
   *  THE PACK HASH IS THE TERM WITH TEETH. A demotion moves no quest state at all
   *  — the rows stay, complete and abandon exactly as before — and changes every
   *  TITLE on this tab, because the titles come out of the fold. Without the hash
   *  in the key the tab would sit there showing a demoted world the sealed pack's
   *  words until something unrelated moved.
   *
   *  TWO TERMS BEYOND §2.4'S LIST, and both are the invariant asking for them
   *  rather than the list being widened for comfort: the tab also draws the
   *  PARKED-ROW notice and the empty state's BOARD AND ZONE NAMES, and a key that
   *  did not carry them would leave those two halves unable to re-render. (A
   *  severance under an open panel moves the rows as well, and a rebuild usually
   *  moves the theme — "usually" is exactly what a projection may not rest on.)
   *
   *  Rows join their nine fields with `|` (§2.4's own separator), rows join with
   *  `,`, and the sections with `~`. THREE SEPARATORS ARE NOT THREE FENCES, and
   *  the earlier claim here that a value carrying one could not forge a boundary
   *  above it was simply wrong: `g` is `"zoneId|Name"` and carries the field
   *  separator in every row this build mints (58-player's `giverOf` still
   *  tolerates a bar-less legacy value, which is the only kind that does not),
   *  and a board or zone name with a `~` in it lands at the top level. What
   *  makes that harmless is not the separators but what happens to the key
   *  afterwards — NOTHING PARSES IT. It is built, compared whole against the
   *  last one, and thrown away; no reader ever splits it back into fields, so
   *  there is no structure for a forged boundary to mislead. The only failure a
   *  separator in a value could ever buy is a COLLISION — two different blocks
   *  rendering the same string — which takes a row hand-built to collide (the
   *  numeric fields go through `_num` and cannot carry one), and which costs
   *  exactly one missed repaint: a line left stale until the next thing moves.
   *  Not a wrong render, not a lost mutation. */
  _questValueKey() {
    const player = PF.player.get(this.core);
    const world = this.core.sim?.world;
    const text = (value) => (typeof value === "string" ? value : "");
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const tally = (map) =>
      Object.entries(map ?? {})
        .sort(byKey)
        .map(([id, n]) => `${id}:${this._num(n)}`)
        .join(",");
    const rows = (Array.isArray(player?.quests?.active) ? player.quests.active : [])
      .map((row) =>
        [
          text(row?.id),
          text(row?.verb),
          text(row?.target),
          this._num(row?.have),
          this._num(row?.n),
          text(row?.g),
          this._num(row?.day),
          this._num(row?.r?.money),
          this._num(row?.r?.xp),
        ].join("|"),
      )
      .join(",");
    const where = this._boardWhere();
    return [
      rows,
      tally(player?.quests?.done_pack),
      tally(player?.quests_done_board),
      world?.theme ?? "",
      PF.save.packFold(this.core)?.pack?.briefHash ?? "",
      this._parkedQuests(),
      where ? `${where.board}@${where.zone}` : "",
    ].join("~");
  }

  /** The tab, top to bottom: what a lost world is holding, what the last press
   *  said, the live list (or the empty state), then the two done groups. */
  _renderQuests() {
    const body = this.journalBody;
    body.replaceChildren();
    const dim = "opacity:0.7;";
    const head = (label) => PF.el("div", { style: `font:700 12px/1.6 inherit;${dim}`, text: label });
    const player = PF.player.get(this.core);
    const folded = PF.save.packFold(this.core);
    const rows = Array.isArray(player?.quests?.active) ? player.quests.active : [];

    // THE LOSS, SAID WHERE THE HOLE IS (§2.4). The notice band on the tab beside
    // this one narrates the severance in story order and is the record of it;
    // this line is why the list under it is shorter than the player remembers.
    if (this._parkedQuests())
      body.appendChild(PF.el("div", { style: dim, text: "Some tasks belong to another world and are set aside." }));
    if (this._questSaid) body.appendChild(PF.el("div", { style: dim, text: this._questSaid }));

    if (!rows.length) {
      body.appendChild(PF.el("div", { style: dim, text: this._questEmpty(folded) }));
    } else {
      const live = PF.el("div", { style: "display:flex;flex-direction:column;gap:6px;" }, [head("Your job list")]);
      for (const row of rows) {
        const id = String(row?.id ?? "");
        // THE ABANDON AFFORDANCE, and it is on THIS tab and only this one (§2.3).
        // One press arms it and the second lets the job go; the armed state is a
        // style property and a word, held hud-side, dropped by anything that
        // moves the list. Free, and never anything but the player's own doing —
        // nothing in the package abandons a quest for them.
        const armed = this._armedAbandon === id;
        const drop = this._btn(armed ? "Set it aside?" : "Set aside", () => this.setAsideJob(id));
        drop.style.opacity = armed ? "1" : "0.55";
        live.appendChild(
          PF.el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:8px;" }, [
            PF.el("div", { text: PF.pack.rowText(row, folded) }),
            drop,
          ]),
        );
      }
      body.appendChild(live);
    }

    // THE TWO DONE GROUPS, and the split is the counter classes' own (§2.2e). A
    // `p:` counter was minted by work this world's pack posted and means nothing
    // anywhere else; a `b:` counter came off the generic templates, whose targets
    // are ROLE-grain and whose givers are the stock cast, so it means the same
    // thing in the next world — which is what `quests_done_board` claims about
    // itself, said out loud where the player can read it.
    for (const [label, map, cap] of [
      ["Done — this world's", player?.quests?.done_pack, PF.player.CAPS.packDone],
      ["Done — travels with you", player?.quests_done_board, PF.player.CAPS.boardDone],
    ]) {
      const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
      const tallies = Object.entries(map ?? {}).sort(byKey);
      if (!tallies.length) continue;
      const group = PF.el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [head(label)]);
      for (const [id, count] of tallies)
        group.appendChild(
          PF.el("div", {
            style: dim,
            text: `${folded?.byId?.get(id)?.title || this._slugOf(id)} ×${this._num(count)}`,
          }),
        );
      // A BOUNDED TALLY SAYS SO WHEN IT IS AT THE BOUND. These maps EVICT — the
      // least-earned counter goes to make room for a new kind of work — so a full
      // one is a list that has already lost something, and a tally that let the
      // player read it as a complete history would be lying quietly.
      if (tallies.length >= cap)
        group.appendChild(PF.el("div", { style: dim, text: `Only the last ${cap} kinds of work are kept.` }));
      body.appendChild(group);
    }
  }

  /** Let one job go. THE FIRST PRESS ARMS AND CHANGES NOTHING — no mutator runs,
   *  no line is written — and the second one does it. A confirm rather than an
   *  undo because there is nothing to undo to: the row carries the count the
   *  player earned toward it, and re-accepting tomorrow's copy of the same
   *  template starts at zero.
   *
   *  THE VANISHED ROW SELF-HEALS through the mutator rather than through a guard
   *  here: `quest("abandon")` refuses an id it cannot find, so a row that left the
   *  list between the paint and the press (a severance, the repair pass, a
   *  rebuild) comes back as a refusal and a repaint that no longer shows it. The
   *  generation fence answers with the same value on purpose — from where the
   *  player is standing, a block that moved under them and a row that was never
   *  there are the same sentence. */
  setAsideJob(id) {
    if (this._armedAbandon !== id) {
      this._dropQuestPress();
      this._armedAbandon = id;
      this._repaintQuests();
      return;
    }
    const result = PF.pack.abandon(this.core, id);
    this._dropQuestPress();
    // SAID IN THE PANEL AND NOT IN A TOAST, because a toast cannot be read from
    // here: the panels are full-surface and opaque and sit above the toast
    // surface in the root's own order, so a sentence sent there while one is open
    // is a sentence nobody sees.
    this._questSaid = result.ok
      ? result.giver
        ? `Set aside ${result.giver}'s job.`
        : "Set aside."
      : this.boardRefusal(result.reason);
    this._repaintQuests();
  }

  toggleSheet() {
    if (!this._panelsAllowed()) return;
    if (this._sheet) {
      this.closeSheet();
      return;
    }
    // The other full-surface panel, and the board goes down for it too — a rule
    // that covered only the journal would be a rule waiting for the next tab.
    this.closeJournal();
    this.closeBoard();
    this.core.closeTalk?.();
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
    // THE TALK WINDOW'S LEAVE CHECK AND MOUNT RECONCILE, FIRST — above the
    // `if (gate) return` further down, and that placement is the whole point. The
    // element tick calls this on its GATED and REPLAY branches too, where
    // `sim.step` is skipped entirely; a check written where it reads naturally,
    // inside the walk block at the foot of this method, could never fire on the
    // one condition it was sited for. One site serves every frame.
    this._syncTalk();
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
    // WHICH ARTIFACT the gate is waiting on — the world itself or the content
    // written for it (0.13's second generation call). Two different screens: at the
    // brief stage nothing has been settled on this chat at all, and at the pack
    // stage the SETTING is sealed and kept whatever happens next. What is not
    // settled at the pack stage is the world in front of the player: the stamp
    // outlives the pack call itself, so this stage also covers a pack that sealed
    // and an install that then threw — see `PF.save.gateStageNote`, whose whole
    // job is a sentence true on every one of those arms. In the memo key for the
    // same reason `gateWhy` is: a stage that changed without the state changing
    // would leave the wrong sentence up.
    const gateStage = gate ? (PF.save.gate.stage ?? "brief") : null;
    if (
      mode !== this._mode ||
      spatialAvail !== this._spatialAvail ||
      gate !== this._gate ||
      gateWhy !== this._gateWhy ||
      gateStage !== this._gateStage
    ) {
      this._mode = mode;
      this._spatialAvail = spatialAvail;
      this._gate = gate;
      this._gateWhy = gateWhy;
      this._gateStage = gateStage;
      const inWorld = mode === "walk" && !gate;
      this.gateEl.style.display = gate ? "flex" : "none";
      this.gateRetry.style.display = gate === "failed" ? "" : "none";
      this.gateTitle.textContent =
        gate === "failed"
          ? gateStage === "pack"
            ? // NOT "the work for this world didn't finish being written": the pack
              // stage is stamped on both sides of the pack's own seal, so on the
              // arm where the work IS written and the install threw, that title
              // named the wrong thing as missing. What is true on every arm is
              // that the world did not finish coming up, which is also the thing
              // the player is looking at a spinner instead of.
              "This world didn't finish opening."
            : "The world didn't finish being written."
          : gateStage === "pack"
            ? "Writing what your world has to say…"
            : "Writing your world…";
      this.gateBody.textContent =
        gate === "failed"
          ? `${PF.save.gateReason(gateWhy, gateStage)} ${PF.save.gateStageNote(gateStage)}`
          : gateStage === "pack"
            ? "The settlement is written. One more call is filling in what its people say and the work they have to offer."
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
        this.boardBtn.style.display = "none";
        this._board = null;
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
      this.boardMenu.style.display = "none";
      // THE DIALOGUE TOAST IS CONDITIONAL NOW. It is an instruction for the
      // Keyboard button, which hands the turn over with nothing else said. A
      // dialogue entered through a talk-window door needs no instruction: the
      // player pressed a control with "(asks the GM)" written on it, and the
      // sender's own toast names who is answering. The latch still being set is
      // exactly "this dialogue came out of a conversation".
      if (mode === "dialogue" && !gate && sim.talkAnchorId == null)
        this.toast("Type in the message box below — Resume to keep walking");
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
      // THE CENSUS CONTROL, DECOUPLED FROM THE CONFIRM (plan §2.5). The skip
      // question now belongs to the control inside the window that is asking it,
      // so this button is a plain toggle again — and while a window is MOUNTED it
      // names the LATCHED ANCHOR, never `nearNpc`. That is not tidiness: the
      // anchor floats free of proximity by design, so a button reading "Talk to
      // Bram (E)" whose press closed the WREN window would be exactly the
      // label/verb disagreement the confirm's own docstring exists to forbid.
      // Between 26px and the 32px close bound `nearNpc` is already null while the
      // window is still open, which is precisely where the two would part.
      const mounted = this.core.talkOpen?.() === true;
      const anchor = mounted ? this.core._talkAnchor : null;
      const canTalk = mounted || !!sim.nearNpc;
      const talkKey = mounted ? `leave:${anchor?.name ?? ""}` : sim.nearNpc ? `talk:${sim.nearNpc.name}` : "";
      if (talkKey !== this._talkKey) {
        this._talkKey = talkKey;
        this.talkBtn.style.opacity = canTalk ? "1" : "0.45";
        this.talkBtn.textContent = mounted
          ? `Leave ${anchor?.name ?? "them"} (E)`
          : sim.nearNpc
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
      // THE BOARD, and it is the simplest gate in this block: the fixture within
      // reach or nothing. No offer is read here and no state is answered — a
      // board is a thing you walk up to, and everything it might refuse is
      // answered at menu-open and at each press instead (§2.2d). It never dims
      // either, because there is no refusal that belongs to standing in front of
      // it: an empty board says so in words, in the menu, where the words fit.
      const board = sim.nearBoard;
      const boardKey = board ? `${board.id}:${board.name}` : "";
      if (boardKey !== this._board) {
        this._board = boardKey;
        this.boardBtn.style.display = board ? "" : "none";
        // Walking away closes the list with the button, exactly as the bank
        // does: a board's offers are the offers of a board you are standing at.
        if (board) this.boardBtn.textContent = `📋 ${board.name}`;
        else this.closeBoard();
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

// ── The talk window's one tuned number (plan §2.5) ────────────────────────────
// The economy's TUNING idiom: a number the layer spends is written down once,
// with the reason it is that number.
PF.Hud.TUNING = {
  // How far the player may step from a held conversation partner before the
  // window closes, in tiles (the dialogue window's band). This is the live one —
  // a second `leaveTiles` sat in `PF.weather.TUNING` with no reader at all, and
  // the half of it worth keeping was this sentence.
  //
  // "Stepping more than one tile from the partner closes the window" — ruling
  // B2-3b's own words, turned into a predicate that says the same thing the prose
  // says. Two full tiles centre to centre is over the line, so the bound is
  // `(leaveTiles + 1) * TILE` and the test is `>=`: at 32px the window closes.
  // Both halves of that agreeing matters — an earlier draft said "≥ 2 tiles is
  // over the line" while its predicate said "exceeds", and the two disagreed at
  // exactly the distance an axis-aligned step from a tile-aligned rest lands on.
  leaveTiles: 1,
  leavePx() {
    return (this.leaveTiles + 1) * PF.TILE;
  },
};
