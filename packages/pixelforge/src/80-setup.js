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
  // text for the GM, default name, the Setting box's PLACEHOLDER, the goals and
  // spatial templates, and the tile theme the world builder paints with (PF.art
  // themes). Fields the player has already edited are never overwritten by a
  // theme change.
  //
  // THREE OF THESE USED TO BE THE PLAYER'S ANSWER WHETHER THE PLAYER ANSWERED OR
  // NOT (0.16.1, and it is the whole of this patch). `setting` was the textarea's
  // VALUE, so leaving the box alone was an active instruction to build the shipped
  // village; `goals` and `spatial` were constants naming Hearthvale with no
  // control anywhere in the wizard. All three reached generators — the Engine's
  // blueprint call, the GM's per-turn prompt and this package's own brief call —
  // so a player who typed "Pallet Town" and cleared the Setting box got Hearthvale
  // with Mira, Tam and Rook in it, and nothing had failed: it is the world the
  // wizard asked for. `setting` is a placeholder now, and `goals` and `spatial`
  // are templates that take the name the player actually typed.
  const THEME_PRESETS = {
    "cozy-village": {
      genre: "Cozy pixel-art village RPG (Stardew/Harvest-Moon-like), slice of life with gentle adventure",
      name: "Hearthvale",
      // What the theme IS, in the fewest words that still name a place — the one
      // honest sentence an empty Setting box composes with (see `settingOf`).
      kind: "cozy pixel village",
      setting:
        "The pixel village of Hearthvale: a cozy closed valley with an inn (The Amber Hearth, kept by Mira), " +
        "Tam's farm, and a small guard post watched by Rook. Slice-of-life with gentle mystery; danger exists but is rare.",
      goals: (name) => `Settle into ${name}, get to know its people, and follow whatever quiet mysteries surface.`,
      // THE CHILD LIST IS GONE, and deliberately: it named four buildings — the
      // Amber Hearth Inn, Tam's Farm, the Guard Post, the Village Pond — that the
      // brief has not invented yet, so the Engine's hierarchical World Map was
      // seeded with a settlement the walkable world does not contain. The root
      // location is the one thing this field genuinely knows.
      spatial: (name) => `A small closed valley. Root location: ${name}. Keep the world compact and walkable.`,
    },
    "sci-fi-colony": {
      genre: "Pixel-art sci-fi frontier-colony RPG, slice of life with gentle mystery among the stars",
      name: "Meridian Base",
      kind: "small frontier colony",
      setting:
        "Meridian Base, a small frontier colony under a sealed sky: a hab ring with a cantina (kept by Mira), " +
        "Tam's hydroponics bay, and a landing pad watched by Rook. Slice-of-life with gentle mystery; danger exists but is rare.",
      goals: (name) => `Settle into ${name}, get to know its crew, and follow whatever quiet mysteries surface.`,
      spatial: (name) => `A compact pressurised colony. Root location: ${name}. Keep the world compact and walkable.`,
    },
  };

  /** The Setting the launch actually ships, and the reason the `||` survives:
   *  the host declares `setting: z.string().min(1)` (game.routes
   *  `gameSetupConfigSchema`), so an empty one is a 400 rather than a blank
   *  field. What changed is WHAT the fallback says. It used to be the theme
   *  preset — the paragraph naming Hearthvale, Mira, Tam and Rook — which is the
   *  most specific instruction in the whole config and was reached by doing
   *  nothing. Now an untouched box composes ONE line out of what the player did
   *  give us, the typed name and the chosen theme, and invents no cast at all. */
  const settingOf = (preset, typed, worldName) => typed.trim() || `A ${preset.kind} called ${worldName}.`;

  /** Engine list rows carry TEXT booleans, not booleans. `connections.is_default`
   *  and `connections.fallback_for_main` are `text().notNull().default("false")`,
   *  so the literal string `"false"` is what a non-default row holds — and
   *  `"false"` is truthy. Every `c?.isDefault` test in this file matched the
   *  FIRST row unconditionally, and `list()` orders by `desc(updatedAt)`, so the
   *  wizard preselected the most-recently-edited connection and the user's actual
   *  default was never honoured. The Engine's own `getDefault()` compares
   *  `eq(apiConnections.isDefault, "true")`; this is that comparison, with the
   *  real boolean still accepted so a future projection does not re-break it. */
  const isYes = (value) => value === "true" || value === true;

  const themeSel = select(
    (PF.art.themeIds ? PF.art.themeIds() : ["cozy-village"])
      .filter((id) => THEME_PRESETS[id])
      .map((id) => [id, id === "cozy-village" ? "Cozy village" : "Sci-fi colony"]),
  );

  const nameIn = input(THEME_PRESETS["cozy-village"].name);
  const seedIn = input(String((Math.random() * 0xffffffff) >>> 0));
  // THE PRESET IS A PLACEHOLDER AND NEVER A VALUE. It shipped as `settingIn.value`,
  // which made "leave it alone" the strongest instruction the wizard could send:
  // the box read as a helpful default and arrived at three generators as the
  // player's own words. As a placeholder it shows exactly the same prose, in the
  // same place, and carries none of it — an untouched box submits empty and
  // `settingOf` composes the honest line instead.
  const settingIn = PF.el("textarea", { style: `${S.input}min-height:64px;`, rows: "3" });
  settingIn.placeholder = THEME_PRESETS["cozy-village"].setting;
  // Written rather than left to the element's own default, because "this box
  // starts empty" is the whole change and it should be a line in the source
  // rather than a property of `<textarea>` a reader has to remember.
  settingIn.value = "";

  // Swap theme-derived defaults on selection, but only for fields still holding
  // the previous theme's default — a player's own text always wins. The Setting
  // box needs no such test any more: a placeholder is never the player's text, so
  // it swaps unconditionally and the "a player's own text always wins" promise is
  // true by construction rather than by string comparison.
  let appliedTheme = "cozy-village";
  themeSel.addEventListener("change", () => {
    const previous = THEME_PRESETS[appliedTheme];
    const next = THEME_PRESETS[themeSel.value];
    if (!next || !previous) return;
    if (nameIn.value === previous.name) nameIn.value = next.name;
    settingIn.placeholder = next.setting;
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
    // TWO CALLS, and the label says so because the player is the one who pays for
    // them: the brief that describes the settlement, and the content pack that
    // gives its people something to say. It has been two since the pack landed.
    [generateIn, PF.el("span", { text: "Generate a unique world with your GM connection (two calls)" })],
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
      //
      // …AND CONNECTIONS THAT CANNOT RESOLVE A KEY. A row with
      // `profileImportReviewRequired === "true"` is one an import parked for the
      // user to look at, and the Engine's `getWithKey()` returns null for exactly
      // those — so offering one launched a game whose very first GM call had no
      // credential behind it, with the failure arriving a minute later on the
      // retry screen instead of here where it is a row not to show.
      const list = (Array.isArray(conns) ? conns : []).filter(
        (c) =>
          c?.provider !== "image_generation" &&
          c?.provider !== "video_generation" &&
          !isYes(c?.profileImportReviewRequired),
      );
      connSel.replaceChildren(
        ...list.map((c) => {
          const label =
            typeof c?.name === "string" ? c.name : typeof c?.label === "string" ? c.label : String(c?.id ?? "?");
          // THE MODEL, BESIDE THE NAME, because the name is a label the user chose
          // and the model is the thing that writes the world. Two connections
          // called "princess" pointed at two different models are one dropdown row
          // apart and were indistinguishable. `model` is a top-level column on the
          // connections table and rides the list route verbatim, so this costs a
          // read and nothing else — it is what the Engine's own Start Game screen
          // renders (GameSurface's `{connection.name}{connection.model ? … : ""}`).
          const model = typeof c?.model === "string" && c.model ? c.model : "";
          return PF.el("option", {
            value: typeof c?.id === "string" ? c.id : "",
            text: model ? `${label} — ${model}` : label,
          });
        }),
      );
      const preferred = list.find((c) => isYes(c?.isDefault)) ?? list.find((c) => isYes(c?.fallbackForMain));
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
        // THE ROW IS RAW STORAGE, NOT THE ENGINE CLIENT'S VIEW MODEL, and this
        // list rendered every character as its id because of it. `/characters`
        // answers `storage.list()` — the characters table verbatim — and that
        // table has NO `name` column: the V2 card lives in `data` as a JSON
        // STRING. So `c.name` was undefined for every row, `c.data?.name` was
        // undefined for every row (a string has no `.name`), and the id fallback
        // was not an edge case, it was 100% of the list. Parsed the way the
        // Engine's own character picker parses it, with the id surviving only as
        // the last resort a corrupt card lands on.
        let card = null;
        try {
          card = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        } catch {
          card = null;
        }
        const carded = card && typeof card.name === "string" ? card.name.trim() : "";
        const name = carded || (typeof c?.name === "string" && c.name.trim()) || id;
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
    // THE NAME, RESOLVED ONCE AND SPENT EVERYWHERE. It used to be resolved at the
    // `onLaunch` call and nowhere else, which is why it named the chat and reached
    // no generator: the Engine's blueprint call, the GM's per-turn prompt and this
    // package's own brief call between them read `setting`, `genre`, `playerGoals`
    // and `spatialMapInstructions`, and the game name was in none of them.
    const worldName = nameIn.value.trim() || preset.name;
    const setupConfig = {
      genre: preset.genre,
      setting: settingOf(preset, settingIn.value, worldName),
      tone: toneSel.value,
      difficulty: diffSel.value,
      rating: ratingSel.value,
      gmMode: "standalone",
      playerGoals: preset.goals(worldName),
      partyCharacterIds: partyChecks.filter((cb) => cb.checked).map((cb) => cb.value),
      gameWorldMapMode: "hierarchical",
      enableAgents: true,
      spatialMapInstructions: preset.spatial(worldName),
      combatStyle: "classic",
      // THE HOST'S OWN HUD WIDGETS, DECLINED (roadmap S7, the "suppress at setup"
      // option). This surface has never drawn an engine widget and has no reader
      // for one — the day, the purse and the sky are the package's own header —
      // but the key was simply never emitted, and every gate on the engine side is
      // written `!== false`, so `undefined` read as YES at all five of them: the
      // setup call was handed the widget catalogue and designed four, chat
      // metadata recorded them, the GM was told to emit `[widget:]` commands for
      // them every single turn, and the player was walked through a "Review
      // Starting Widgets" step for a rail that never appears. Two of the four the
      // model invented were a second purse and a second relationship ledger beside
      // the ones this package actually keeps, so the double bookkeeping was real
      // and diverging. One literal closes all five, with no Engine change, and it
      // is reversible the day the package wants to seed widgets of its own
      // (`customHudWidgets` is the hook).
      enableCustomWidgets: false,
      // `packWanted` rides the SAME answer rather than asking a second question
      // (0.13): the offline content pack is written by a second call in the same
      // creation, and a player who wants a generated world wants its people to
      // have something to say and something to ask for. Splitting it would put a
      // cost decision in front of somebody who has already made it. It is read at
      // exactly one place — the seal PATCH, which copies it beside the sealed
      // brief — because THIS object is rewritable and that copy is not
      // (60-save PACK_WANTED_META_KEY).
      experienceConfig: {
        seed,
        theme: themeSel.value,
        generate: generateIn.checked,
        packWanted: generateIn.checked,
        // THE NAME, WHERE THE PACKAGE CAN READ IT BACK. `gameSetupConfigSchema`
        // has no field for a world name — the chat's `name` is where the host
        // keeps it, and nothing in the config reaches it — so it rides the one
        // object on this config the package owns outright. Two readers: the brief
        // call's payload, so the model is asked to dress THE PLAYER'S name rather
        // than invent one, and the loading gate, so the screen says which world it
        // is writing. `_configWorldName` reads it at both nesting depths, exactly
        // as the seed and the theme are read (60-save).
        worldName,
      },
    };
    launchBtn.disabled = true;
    cancelBtn.disabled = true; // mirror the host's mid-launch freeze
    launchBtn.textContent = "Setting up…";
    try {
      await el._pfProps.onLaunch(setupConfig, worldName, undefined, {
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
