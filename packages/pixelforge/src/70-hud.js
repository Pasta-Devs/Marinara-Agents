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
    this.topbar = PF.el(
      "div",
      { style: "position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2;" },
      [this.locChip, this.clockChip, this.purseChip],
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
        this.gateEl,
      ],
    );
    rootEl.appendChild(this.root);
    this._toastTimer = 0;
    this._locToastTimer = 0;
    this._mode = null;
    this.refreshChips();
  }

  _btn(text, onclick) {
    return PF.el("button", { type: "button", style: this.S.btn, text, onclick });
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
   *  a generic line here would throw that away. */
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
      this.toast(`Fishing is level ${result.leveled} now — ${clock}`);
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
      const clock = sim.clockLabel();
      if (clock !== this._clock) {
        this._clock = clock;
        this.refreshChips();
      }
    }
  }
};
