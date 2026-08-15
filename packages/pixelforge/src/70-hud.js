// ── HUD (main mount) ──────────────────────────────────────────────────────────
// Everything interactive lives here, in the z-30 main mount: location/clock
// chips, touch D-pad, Talk / Travel / Keyboard controls, toasts. The root is
// pointer-events:none; each control opts back in — clicks in empty space fall
// through to the narration below (host contract).
PF.Hud = class {
  constructor(rootEl, core) {
    this.core = core;
    const S = {
      chip:
        "pointer-events:auto;background:rgba(20,24,20,0.82);color:#f3efe2;border:1px solid rgba(243,239,226,0.25);" +
        "border-radius:6px;padding:3px 9px;font:600 11px/1.5 ui-monospace,Consolas,monospace;white-space:nowrap;",
      btn:
        "pointer-events:auto;background:rgba(20,24,20,0.88);color:#f3efe2;border:1px solid rgba(243,239,226,0.35);" +
        "border-radius:8px;padding:9px 13px;font:700 12px/1 ui-monospace,Consolas,monospace;cursor:pointer;min-height:40px;",
    };
    this.S = S;

    this.locChip = PF.el("span", { style: S.chip, text: "…" });
    this.clockChip = PF.el("span", { style: S.chip, text: "" });
    this.topbar = PF.el(
      "div",
      { style: "position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2;" },
      [this.locChip, this.clockChip],
    );

    this.talkBtn = this._btn("Talk (E)", () => core.interact());
    this.travelBtn = this._btn("Travel", () => this.toggleTravel());
    this.keyboardBtn = this._btn("Keyboard", () => core.setMode("dialogue"));
    this.resumeBtn = this._btn("▶ Resume walking", () => core.resume());
    this.actions = PF.el(
      "div",
      {
        style:
          "position:absolute;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px;align-items:flex-end;z-index:2;",
      },
      [this.talkBtn, this.travelBtn, this.keyboardBtn, this.resumeBtn],
    );

    // Touch D-pad. touch-action:none so the browser doesn't claim the gesture
    // (same requirement the host documents on its own drag surfaces).
    this.dpad = PF.el("div", {
      style:
        "position:absolute;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:132px;height:132px;z-index:2;" +
        "pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;",
    });
    const pads = [
      ["up", "▲", 44, 0], ["left", "◀", 0, 44], ["right", "▶", 88, 44], ["down", "▼", 44, 88],
    ];
    for (const [dir, label, x, y] of pads) {
      const pad = PF.el("button", {
        type: "button",
        "aria-label": `move ${dir}`,
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

    this.root = PF.el(
      "div",
      { style: "position:absolute;inset:0;pointer-events:none;font-family:ui-monospace,Consolas,monospace;" },
      [this.topbar, this.actions, this.dpad, this.travelMenu, this.toastEl],
    );
    rootEl.appendChild(this.root);
    this._toastTimer = 0;
    this._mode = null;
    this.refreshChips();
  }

  _btn(text, onclick) {
    return PF.el("button", { type: "button", style: this.S.btn, text, onclick });
  }

  destroy() {
    clearTimeout(this._toastTimer);
    this.root.remove();
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = "1";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.style.opacity = "0";
    }, 2600);
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

  refreshChips() {
    const sim = this.core.sim;
    if (!sim) return;
    const spatialName = PF.spatial.locationName();
    this.locChip.textContent = spatialName ? `${sim.zone().name} — ${spatialName}` : sim.zone().name;
    this.clockChip.textContent = sim.clockLabel();
  }

  /** Cheap per-frame sync — writes DOM only on change. */
  update() {
    const sim = this.core.sim;
    if (!sim) return;
    const mode = sim.mode;
    const spatialAvail = PF.spatial.available;
    if (mode !== this._mode || spatialAvail !== this._spatialAvail) {
      this._mode = mode;
      this._spatialAvail = spatialAvail;
      const inWorld = mode === "walk";
      // Replay: the host owns the whole screen. Combat: keep a minimal HUD —
      // the mode is inferred from the narrative gameActiveState, which can flip
      // without any combat UI mounting, so the player must NEVER be left with
      // zero controls (review finding). Resume is the guaranteed exit.
      this.root.style.display = mode === "replay" ? "none" : "";
      this.dpad.style.display = inWorld ? "" : "none";
      this.talkBtn.style.display = inWorld ? "" : "none";
      this.travelBtn.style.display = inWorld && spatialAvail ? "" : "none";
      this.keyboardBtn.style.display = inWorld ? "" : "none";
      // In combat, Resume exists only for the NARRATIVE fallback signal (which
      // can flip without any combat UI). With the real Capability API 1.11
      // signal the combat UI owns the screen — no package controls at all.
      const combatResumeApplies = mode === "combat" && !this.core._combatSignalIsReal;
      this.resumeBtn.style.display = mode === "dialogue" || combatResumeApplies ? "" : "none";
      this.resumeBtn.textContent = combatResumeApplies ? "▶ Resume exploring" : "▶ Resume walking";
      this.travelMenu.style.display = "none";
      if (mode === "dialogue") this.toast("Type in the message box below — Resume to keep walking");
    }
    if (this._mode === "walk") {
      const canTalk = !!sim.nearNpc;
      if (canTalk !== this._canTalk) {
        this._canTalk = canTalk;
        this.talkBtn.style.opacity = canTalk ? "1" : "0.45";
        this.talkBtn.textContent = canTalk ? `Talk to ${sim.nearNpc.name} (E)` : "Talk (E)";
      }
      const clock = sim.clockLabel();
      if (clock !== this._clock) {
        this._clock = clock;
        this.refreshChips();
      }
    }
  }
};
