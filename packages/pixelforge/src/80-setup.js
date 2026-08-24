// ── Setup view (view="setup") ─────────────────────────────────────────────────
// Replaces the classic wizard body. Must emit the full classic required set
// (genre/setting/tone/difficulty/gmMode/partyCharacterIds — game.routes.ts
// gameSetupConfigSchema) plus gmConnectionId, or the host refuses the launch.
// World Maps: requests hierarchical mode + agents; if the World Maps agent
// isn't active the host falls back to standard mode and the surface runs
// unbound — both are handled (verified trap #6).
// World generation does NOT happen here (spec §5, amended): the wizard only
// stamps the player's `generate` answer into the experience config; the surface
// picks it up after launch (PF.save.maybeGenerateBrief) so the whole 90s window
// runs behind a loading gate instead of a torn-down setup UI. Answering NO is a
// supported outcome, not a failure — the chat plays the themed default world
// immediately, with no gate and no generation call ever made for it.

PF.mountSetup = (el, props) => {
  // The host delivers a FRESH props object on every render, and its onCancel
  // closes over the current `launching` state — capturing the first one would
  // let "Back" defeat the host's mid-launch freeze (review finding). Keep the
  // latest props on the element and read them at click time.
  el._pfProps = props;
  if (el._pfSetupMounted) return;
  el._pfSetupMounted = true;
  el.style.display = "block";

  const S = {
    label: "display:block;font:600 11px/1.6 ui-monospace,Consolas,monospace;opacity:0.75;margin:10px 0 3px;",
    input:
      "width:100%;box-sizing:border-box;background:var(--background,#1b201b);color:var(--foreground,#e6e8e0);" +
      "border:1px solid var(--border,#444);border-radius:8px;padding:8px 10px;font:13px/1.4 inherit;",
    row: "display:flex;gap:10px;",
    btn: "min-height:44px;border-radius:8px;padding:0 16px;font:700 13px/1 inherit;cursor:pointer;border:1px solid var(--border,#444);",
  };
  const field = (labelText, node) => PF.el("div", null, [PF.el("label", { style: S.label, text: labelText }), node]);
  const input = (value) => PF.el("input", { style: S.input, value });
  const select = (options) =>
    PF.el(
      "select",
      { style: S.input },
      options.map(([v, t]) => PF.el("option", { value: v, text: t })),
    );

  // Per-theme wizard defaults: picking a theme re-skins the whole run — genre
  // text for the GM, default name/setting/goals, spatial seed, and the tile
  // theme the world builder paints with (PF.art themes). Fields the player has
  // already edited are never overwritten by a theme change.
  const THEME_PRESETS = {
    "cozy-village": {
      genre: "Cozy pixel-art village RPG (Stardew/Harvest-Moon-like), slice of life with gentle adventure",
      name: "Hearthvale",
      setting:
        "The pixel village of Hearthvale: a cozy closed valley with an inn (The Amber Hearth, kept by Mira), " +
        "Tam's farm, and a small guard post watched by Rook. Slice-of-life with gentle mystery; danger exists but is rare.",
      goals: "Settle into Hearthvale, get to know its people, and follow whatever quiet mysteries surface.",
      spatial:
        "A small closed valley. Root location: the village of Hearthvale. Children: The Amber Hearth Inn, " +
        "Tam's Farm, the Guard Post, the Village Pond. Keep the world compact and walkable.",
    },
    "sci-fi-colony": {
      genre: "Pixel-art sci-fi frontier-colony RPG, slice of life with gentle mystery among the stars",
      name: "Meridian Base",
      setting:
        "Meridian Base, a small frontier colony under a sealed sky: a hab ring with a cantina (kept by Mira), " +
        "Tam's hydroponics bay, and a landing pad watched by Rook. Slice-of-life with gentle mystery; danger exists but is rare.",
      goals: "Settle into the colony, get to know its crew, and follow whatever quiet mysteries surface.",
      spatial:
        "A compact pressurised colony. Root location: Meridian Base. Children: the Cantina, the Hydroponics Bay, " +
        "the Landing Pad, the Coolant Pool. Keep the world compact and walkable.",
    },
  };

  const themeSel = select(
    (PF.art.themeIds ? PF.art.themeIds() : ["cozy-village"])
      .filter((id) => THEME_PRESETS[id])
      .map((id) => [id, id === "cozy-village" ? "Cozy village" : "Sci-fi colony"]),
  );

  const nameIn = input(THEME_PRESETS["cozy-village"].name);
  const seedIn = input(String((Math.random() * 0xffffffff) >>> 0));
  const settingIn = PF.el("textarea", { style: `${S.input}min-height:64px;`, rows: "3" });
  settingIn.value = THEME_PRESETS["cozy-village"].setting;

  // Swap theme-derived defaults on selection, but only for fields still holding
  // the previous theme's default — a player's own text always wins.
  let appliedTheme = "cozy-village";
  themeSel.addEventListener("change", () => {
    const previous = THEME_PRESETS[appliedTheme];
    const next = THEME_PRESETS[themeSel.value];
    if (!next || !previous) return;
    if (nameIn.value === previous.name) nameIn.value = next.name;
    if (settingIn.value === previous.setting) settingIn.value = next.setting;
    appliedTheme = themeSel.value;
  });
  const toneSel = select([
    ["cozy, warm, gently comedic", "Cozy & warm"],
    ["wistful, quiet, bittersweet", "Wistful & quiet"],
    ["adventurous with cozy downtime", "Adventurous"],
  ]);
  const diffSel = select([
    ["easy", "Easy"],
    ["normal", "Normal"],
    ["hard", "Hard"],
  ]);
  const ratingSel = select([
    ["sfw", "SFW"],
    ["nsfw", "NSFW"],
  ]);
  // DECLINING IS A CHOICE AGAIN. The wizard stamped `generate: true`
  // unconditionally, which quietly retired the skip affordance: the themed-default
  // immediate-play path — no loading gate, no starting purse, walk in and play —
  // became unreachable for every new chat, even though the save path never stopped
  // supporting it (`briefExpected` is exactly this flag, and the `{skipped:true}`
  // marker is a second, post-hoc route it also still reads). Checked by default,
  // because a generated world IS the package; unchecked is somebody who wants the
  // village they already know, or does not want to spend the call.
  const generateIn = PF.el("input", { type: "checkbox" });
  generateIn.checked = true;
  const generateRow = PF.el(
    "label",
    { style: "display:flex;gap:8px;align-items:center;font:12px/1.5 inherit;cursor:pointer;margin-top:10px;" },
    [generateIn, PF.el("span", { text: "Generate a unique world with your GM connection (one call)" })],
  );
  const connSel = select([["", "Loading connections…"]]);
  const partyBox = PF.el("div", {
    style: "display:flex;flex-direction:column;gap:4px;max-height:130px;overflow:auto;" + S.input,
  });
  partyBox.textContent = "Loading characters…";

  const errEl = PF.el("div", {
    style: "color:#e0837f;font:600 12px/1.5 inherit;margin-top:10px;white-space:pre-wrap;display:none;",
  });
  const launchBtn = PF.el("button", {
    type: "button",
    style: `${S.btn}background:var(--primary,#2f6b4f);color:var(--primary-foreground,#fff);border:none;`,
  });
  // The button names the world you are about to walk into, so it answers to the
  // name field and the theme rather than to a literal. It shipped as the constant
  // "Begin in Hearthvale" and only the RETRY path below ever rewrote it, so a
  // sci-fi colony called Meridian Base offered to begin in a cozy village that was
  // not in the game. One function, called at every site that can change the answer.
  const syncLaunchLabel = () => {
    const preset = THEME_PRESETS[themeSel.value] || THEME_PRESETS["cozy-village"];
    launchBtn.textContent = `Begin in ${nameIn.value.trim() || preset.name}`;
  };
  syncLaunchLabel();
  nameIn.addEventListener("input", syncLaunchLabel);
  // Registered AFTER the defaults-swap listener above, so it reads the name that
  // listener may have just re-skinned rather than the one it replaced.
  themeSel.addEventListener("change", syncLaunchLabel);
  const cancelBtn = PF.el("button", {
    type: "button",
    style: `${S.btn}background:transparent;color:inherit;`,
    text: "Back",
    onclick: () => el._pfProps?.onCancel?.(),
  });

  const root = PF.el("div", { style: "font-family:inherit;color:inherit;" }, [
    PF.el("p", {
      style: "font:12px/1.6 inherit;opacity:0.8;margin:0 0 4px;",
      text:
        "A walkable pixel village. Talk to villagers to drive the story; the GM narrates in the panel below the world. " +
        "Uses the engine's own combat, and follows the World Map when its agent is active.",
    }),
    field("Game name", nameIn),
    PF.el("div", { style: S.row }, [
      PF.el("div", { style: "flex:1;" }, [field("Theme", themeSel)]),
      PF.el("div", { style: "flex:1;" }, [field("World seed", seedIn)]),
    ]),
    field("Setting", settingIn),
    generateRow,
    PF.el("div", { style: S.row }, [
      PF.el("div", { style: "flex:1;" }, [field("Tone", toneSel)]),
      PF.el("div", { style: "flex:1;" }, [field("Difficulty", diffSel)]),
      PF.el("div", { style: "flex:1;" }, [field("Rating", ratingSel)]),
    ]),
    field("GM connection", connSel),
    field("Party characters (the villagers are NPCs; pick your party or none)", partyBox),
    errEl,
    PF.el("div", { style: `${S.row}margin-top:14px;justify-content:flex-end;` }, [cancelBtn, launchBtn]),
  ]);
  el.replaceChildren(root);

  const partyChecks = [];
  void (async () => {
    try {
      const conns = await PF.api.getJson("/connections");
      // Text-capable connections only — the host doesn't re-check eligibility,
      // and an image/video connection here fails at first generation (review finding).
      const list = (Array.isArray(conns) ? conns : []).filter(
        (c) => c?.provider !== "image_generation" && c?.provider !== "video_generation",
      );
      connSel.replaceChildren(
        ...list.map((c) =>
          PF.el("option", {
            value: typeof c?.id === "string" ? c.id : "",
            text: typeof c?.name === "string" ? c.name : typeof c?.label === "string" ? c.label : String(c?.id ?? "?"),
          }),
        ),
      );
      const preferred = list.find((c) => c?.isDefault) ?? list.find((c) => c?.fallbackForMain);
      if (preferred && typeof preferred.id === "string") connSel.value = preferred.id;
      if (!list.length) connSel.replaceChildren(PF.el("option", { value: "", text: "No text connections configured" }));
    } catch {
      connSel.replaceChildren(PF.el("option", { value: "", text: "Could not load connections" }));
    }
    try {
      const chars = await PF.api.getJson("/characters");
      partyBox.replaceChildren();
      for (const c of Array.isArray(chars) ? chars : []) {
        const id = typeof c?.id === "string" ? c.id : null;
        if (!id) continue;
        const name =
          typeof c?.name === "string" && c.name ? c.name : typeof c?.data?.name === "string" ? c.data.name : id;
        const cb = PF.el("input", { type: "checkbox", value: id });
        partyChecks.push(cb);
        partyBox.appendChild(
          PF.el("label", { style: "display:flex;gap:8px;align-items:center;font:12px/1.5 inherit;cursor:pointer;" }, [
            cb,
            PF.el("span", { text: name }),
          ]),
        );
      }
      if (!partyBox.children.length)
        partyBox.textContent = "No characters yet — that's fine, the GM plays the villagers.";
    } catch {
      partyBox.textContent = "Could not load characters (the GM will play the villagers).";
    }
  })();

  launchBtn.addEventListener("click", async () => {
    errEl.style.display = "none";
    const gmConnectionId = connSel.value || null;
    if (!gmConnectionId) {
      errEl.textContent = "Pick a GM connection first — the game cannot run without one.";
      errEl.style.display = "block";
      return;
    }
    // Strict parse: a purely-numeric entry (including 0) is used verbatim;
    // anything else — "42abc" included — hashes as a text seed instead of
    // silently truncating at the first non-digit.
    const seedText = seedIn.value.trim();
    const seed = (/^\d+$/.test(seedText) ? Number.parseInt(seedText, 10) : PF.hashStr(seedText || nameIn.value)) >>> 0;
    const preset = THEME_PRESETS[themeSel.value] || THEME_PRESETS["cozy-village"];
    const setupConfig = {
      genre: preset.genre,
      setting: settingIn.value.trim() || preset.setting,
      tone: toneSel.value,
      difficulty: diffSel.value,
      rating: ratingSel.value,
      gmMode: "standalone",
      playerGoals: preset.goals,
      partyCharacterIds: partyChecks.filter((cb) => cb.checked).map((cb) => cb.value),
      gameWorldMapMode: "hierarchical",
      enableAgents: true,
      spatialMapInstructions: preset.spatial,
      combatStyle: "classic",
      experienceConfig: { seed, theme: themeSel.value, generate: generateIn.checked },
    };
    launchBtn.disabled = true;
    cancelBtn.disabled = true; // mirror the host's mid-launch freeze
    launchBtn.textContent = "Setting up…";
    try {
      await el._pfProps.onLaunch(setupConfig, nameIn.value.trim() || preset.name, undefined, {
        gmConnectionId,
      });
      // NO WORLD IS SEEDED HERE ANY MORE (plan §Q3b, maintainer ruling #7). The
      // wizard used to write a default themed snapshot into chat metadata so the
      // first surface load had something to show while generation ran behind a
      // toast — and that snapshot WAS the throwaway world the ruling abolished:
      // the first thing a brand-new chat stored was a save for a world nobody
      // meant to keep. The surface now holds a loading gate until the brief seals,
      // so there is nothing to show and nothing to seed, and determinism is
      // unaffected because simFromSaved re-derives the seed and theme from
      // `experienceConfig` (PF.save._configSeed/_configTheme) exactly as this
      // snapshot did. The `generate` flag above is the whole handoff — and when it
      // is false there is nothing to hand off: no gate arms, no call is made, and
      // the themed default world is what the player walks into.
    } catch (err) {
      errEl.textContent =
        err && err.message ? String(err.message) : "Launch failed — check the connection and try again.";
      errEl.style.display = "block";
      launchBtn.disabled = false;
      cancelBtn.disabled = false;
      syncLaunchLabel();
    }
  });
};
