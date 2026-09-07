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

// ── THE PLAYER'S WORDS PICK THE KIT (0.16.2) ─────────────────────────────────
// The theme dropdown is gone, and it is not replaced by a second question: the
// ruling is that the theme is "determined by the player in Game Mode setup via
// freestyle input, not a selector". A GENERATED world gets its kit from the
// model, which answers `artTheme` inside the brief call that was already being
// paid for. A DECLINED world never mints a brief, so no model ever answers —
// and `PF.world.build(seed, theme, null)` still needs a theme. Without a
// resolver here every declined world would be a cozy village forever, whatever
// the player wrote, which is the one hole deleting the dropdown opens.
//
// So: a small pure function over the player's own Setting text. Fold it, count
// how many of its words each kit's lexicon claims, higher count wins, and a tie
// or no hits at all is `cozy-village` — the honest default a player who said
// nothing already gets, rather than a preset that answered for them.
// Deterministic: no call, no seed, no model.
//
// ITS INPUT IS THE RAW BOX AND NOTHING ELSE, and that is the whole discipline.
// `settingOf` composes "A cozy pixel village called Hearthvale." for an
// untouched box, and that sentence ships as the config's `setting` and reaches
// the brief payload — so a resolver reading the COMPOSED text would be counting
// the wizard's own preset words as the player's evidence. That is 0.16.1's bug
// one layer down, and it is why the ordering at launch is theme, then preset,
// then setting.
//
// The lexicons are hand-written per kit, so they are the one thing that can
// silently fall behind a third theme: an id can reach PF.art and the brief
// schema while remaining unreachable through here. The harness pins
// `PF.setup.kitIds()` against `PF.art.themeIds()` for exactly that.
const KIT_WORDS = {
  "cozy-village": [
    "village",
    "hamlet",
    "farm",
    "cottage",
    "orchard",
    "meadow",
    "valley",
    "forest",
    "wood",
    "harvest",
    "tavern",
    "innkeep",
    "barn",
    "thatch",
    "hearth",
    "cozy",
    "pastoral",
    "medieval",
    "blacksmith",
    "bakery",
    "goat",
    "sheep",
  ],
  "sci-fi-colony": [
    "colony",
    "coloni",
    "station",
    "habitat",
    "hab",
    "dome",
    "terraform",
    "orbit",
    "spaceport",
    "starship",
    "shuttle",
    "android",
    "robot",
    "reactor",
    "hydroponic",
    "airlock",
    "alien",
    "asteroid",
    "frontier",
    "outpost",
    "cyber",
    "plasma",
    "oxygen",
    "crew",
    "corridor",
    "vacuum",
  ],
};

/** Tokens rather than substrings, so "a well-lit inner room" cannot vote for a
 *  village on the word "inn". A token counts once for a kit however many of that
 *  kit's words it matches, and a prefix match is what carries the plurals and the
 *  ordinary suffixes ("farms", "farmhand", "colonies", "domed"). */
const themeFromWords = (text) => {
  const tokens = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  let best = "cozy-village";
  let bestHits = 0;
  for (const [theme, words] of Object.entries(KIT_WORDS)) {
    let hits = 0;
    for (const token of tokens) if (words.some((word) => token.startsWith(word))) hits++;
    // STRICTLY greater, so a tie keeps the incumbent and nothing wins by being
    // first in the table: a tie and zero hits both land on cozy-village.
    if (hits > bestHits) {
      best = theme;
      bestHits = hits;
    }
  }
  return best;
};

/** On PF because the harness has to be able to drive the resolver DIRECTLY. The
 *  lane that matters is which INPUT it was handed — the raw box, never the
 *  composed sentence — and the only way to pin that is to watch the call, so the
 *  wizard calls it through this object rather than through the local binding. */
PF.setup = {
  themeFromWords,
  kitIds: () => Object.keys(KIT_WORDS),
};

/** The bound on the one unbounded string the package contributes to the config
 *  the host nests inside itself. The arithmetic that produced this number is at
 *  the emit site, beside `setting`, because that is where the next person adding
 *  a field will be standing. */
const SETTING_MAX = 8_000;

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

  // Per-theme wizard defaults, and 0.16.2 leaves TWO FIELDS of them standing.
  //
  // 0.16.1 stopped this table answering for the player: `setting` became a
  // placeholder instead of the textarea's VALUE, and `goals` and `spatial`
  // became templates that take the name the player actually typed instead of
  // constants naming Hearthvale. 0.16.2 deletes the rest of it, because a
  // template that names no place still asserts a GENRE and a MAP CONSTRAINT the
  // package has no way to know:
  //
  //   `genre`   — the player's genre is whatever their Setting text says. The
  //               package now sends one honest literal about the renderer.
  //   `goals`   — nobody asked the player for a goal; the schema defaults it.
  //   `spatial` — deleted outright, not trimmed, and the ruling is wider than
  //               the theme sentence it started at: "the GM should never intend
  //               to keep the player bound to a location and the world need not
  //               be compact and walkable necessarily". Both halves of that
  //               string said otherwise, so the package emits no map guidance at
  //               all.
  //   `setting` — its last consumer was the Setting box's placeholder, and the
  //               listener that swapped it per theme died with the dropdown. A
  //               player describing a space station would have been shown
  //               village prose permanently, so the placeholder is theme-free
  //               now and this paragraph has no reader left.
  //
  // What survives is what the wizard still genuinely needs: a default world name
  // for a cleared name field, and the one-line `kind` an empty Setting box
  // composes with (see `settingOf`).
  const THEME_PRESETS = {
    "cozy-village": {
      name: "Hearthvale",
      // What the theme IS, in the fewest words that still name a place.
      kind: "cozy pixel village",
    },
    "sci-fi-colony": {
      name: "Meridian Base",
      kind: "small frontier colony",
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

  const nameIn = input(THEME_PRESETS["cozy-village"].name);
  const seedIn = input(String((Math.random() * 0xffffffff) >>> 0));
  // THE PRESET IS A PLACEHOLDER AND NEVER A VALUE. It shipped as `settingIn.value`,
  // which made "leave it alone" the strongest instruction the wizard could send:
  // the box read as a helpful default and arrived at three generators as the
  // player's own words. As a placeholder it shows exactly the same prose, in the
  // same place, and carries none of it — an untouched box submits empty and
  // `settingOf` composes the honest line instead.
  const settingIn = PF.el("textarea", { style: `${S.input}min-height:64px;`, rows: "3" });
  // THE PLACEHOLDER STOPS BEING A THEME (0.16.2), and it has to: it was the cozy
  // preset's paragraph — the one naming Mira, Tam, Rook and The Amber Hearth —
  // and the listener that swapped it for the colony's was part of the dropdown
  // this release deletes. Left alone it would show village prose to a player
  // describing a space station, permanently and with no control to change it.
  // What replaces it is not a shorter suggestion but a QUESTION, and it is the
  // sentence that makes the whole release work: this box is now the only place
  // the player's freestyle words exist, so it should ask for the words the
  // resolver reads and the model is about to be shown.
  settingIn.placeholder = "Describe the place: what it is made of, what the weather does, who lives there.";
  // Written rather than left to the element's own default, because "this box
  // starts empty" is the whole change and it should be a line in the source
  // rather than a property of `<textarea>` a reader has to remember.
  settingIn.value = "";

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
  // THE PARTY PICKER IS GONE (0.16.2). The party belongs to Game Mode's own
  // setup, and this Experience carries only parameters that are its own — it
  // never duplicates or overrides what the GM setup collects. That the chooser
  // currently swaps the classic wizard out before its Party step ever runs is
  // the reason this is a COST rather than a tidy-up, and it is stated plainly:
  // for this one release every Pixelforge game starts with an empty party and
  // nothing anywhere asks otherwise. It is survivable because the villagers are
  // NPCs the GM plays and a party is additive rather than load-bearing for a
  // walkable world; it stops being true the moment the seam lands and the
  // Engine's own Party step runs again.

  const errEl = PF.el("div", {
    style: "color:#e0837f;font:600 12px/1.5 inherit;margin-top:10px;white-space:pre-wrap;display:none;",
  });
  const launchBtn = PF.el("button", {
    type: "button",
    style: `${S.btn}background:var(--primary,#2f6b4f);color:var(--primary-foreground,#fff);border:none;`,
  });
  // The button names the world you are about to walk into, so it answers to the
  // name field rather than to a literal. It shipped as the constant "Begin in
  // Hearthvale" and only the RETRY path below ever rewrote it, so a colony called
  // Meridian Base offered to begin in a cozy village that was not in the game.
  // 0.16.2 leaves it answering to the NAME FIELD ALONE: the theme is derived from
  // the Setting box at launch and there is no longer a control whose change could
  // re-skin the label mid-form.
  const syncLaunchLabel = () => {
    launchBtn.textContent = `Begin in ${nameIn.value.trim() || THEME_PRESETS["cozy-village"].name}`;
  };
  syncLaunchLabel();
  nameIn.addEventListener("input", syncLaunchLabel);
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
    // The seed stands alone now: this row held it beside the theme dropdown, and
    // the seed is the one field of the package's own that survives every shape
    // this form is heading for.
    field("World seed", seedIn),
    field("Setting", settingIn),
    generateRow,
    PF.el("div", { style: S.row }, [
      PF.el("div", { style: "flex:1;" }, [field("Tone", toneSel)]),
      PF.el("div", { style: "flex:1;" }, [field("Difficulty", diffSel)]),
      PF.el("div", { style: "flex:1;" }, [field("Rating", ratingSel)]),
    ]),
    field("GM connection", connSel),
    errEl,
    PF.el("div", { style: `${S.row}margin-top:14px;justify-content:flex-end;` }, [cancelBtn, launchBtn]),
  ]);
  el.replaceChildren(root);

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
    // `/characters` IS NO LONGER READ HERE. It loaded the party picker, and the
    // picker is gone — so is the raw-row parse 0.16.1 put in front of it (the
    // characters table has no `name` column and keeps the V2 card in `data` as a
    // JSON STRING, which is why the list used to be a column of nanoids). That
    // parse retires WITH its reader rather than being kept warm for a list
    // nothing renders; the Engine's own character picker is where it lives now.
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
    // ORDER MATTERS, AND IT IS THE ONE ORDERING BUG THIS SECTION CAN HAVE: the
    // theme is resolved from the RAW box first, the preset is picked from the
    // resolved theme, and only then is the setting composed. Composing first and
    // resolving from the result would feed the resolver `settingOf`'s own
    // sentence — "A cozy pixel village called Hearthvale." — so the wizard's
    // preset words would be counted as the player's evidence, which is exactly
    // the class of bug 0.16.1 removed one layer up.
    const theme = PF.setup.themeFromWords(settingIn.value);
    const preset = PF.own(THEME_PRESETS, theme) || THEME_PRESETS["cozy-village"];
    // THE NAME, RESOLVED ONCE AND SPENT EVERYWHERE. It used to be resolved at the
    // `onLaunch` call and nowhere else, which is why it named the chat and reached
    // no generator: the Engine's blueprint call, the GM's per-turn prompt and this
    // package's own brief call between them read `setting`, `genre`, `playerGoals`
    // and `spatialMapInstructions`, and the game name was in none of them.
    const worldName = nameIn.value.trim() || preset.name;
    const setupConfig = {
      // ONE HONEST LITERAL, because the package does not know the player's genre
      // and never did. This field was the theme preset's paragraph — "Cozy
      // pixel-art village RPG (Stardew/Harvest-Moon-like)…" — asserted over
      // whatever the player actually described, and it is `.min(1)` and required
      // so something has to go here. What is true of every Pixelforge game
      // regardless of setting is the RENDERER, so that is what it says. The real
      // genre is in `setting`, which is the player's own words and reaches the
      // GM's per-turn prompt on the very next line of the same block.
      genre: "A tile-based pixel-art RPG.",
      // ── THE ONE UNBOUNDED STRING THIS PACKAGE CONTRIBUTES ──────────────────
      // `/game/create`'s chooser nests the package's whole returned config inside
      // itself (`experienceConfig: cfg`) and the route caps THAT nested copy at
      // 32,000 characters, while `setting` is declared `z.string().min(1)` with
      // no maximum at all. Everything else here is a scalar or a short literal —
      // about 1 KB — so the Setting box is the only field that can push the copy
      // over and turn a launch into a hard 400 on a field the player never sees.
      // 8,000 is the bound, and it is derived rather than picked: the brief call
      // clamps its preferences to 7,800 against the route's own 8,000 cap, so
      // the world-writing call loses nothing it was ever going to read. 8,000
      // plus ~1 KB of scalars is ~9 KB against 32,000, with ~23 KB spare. The
      // cost, stated once rather than twice in opposite directions: Setting text
      // past 8,000 characters stops reaching the GM's per-turn prompt, at a
      // length no setup box invites. Anyone adding a field here inherits this
      // budget — the spare is the room, not the cap.
      setting: settingOf(preset, settingIn.value, worldName).slice(0, SETTING_MAX),
      tone: toneSel.value,
      difficulty: diffSel.value,
      rating: ratingSel.value,
      gmMode: "standalone",
      // NOBODY WAS ASKED FOR A GOAL. This was a preset template — "Settle into
      // ${name}, get to know its people…" — written on the player's behalf and
      // shipped to the GM as their stated goal. The schema defaults it, and an
      // empty string is the truthful answer to a question the form never put.
      playerGoals: "",
      // The party belongs to Game Mode's own setup; this Experience never
      // duplicates or overrides what that setup collects.
      partyCharacterIds: [],
      gameWorldMapMode: "hierarchical",
      enableAgents: true,
      // NO `spatialMapInstructions` KEY AT ALL, and the deletion is the field
      // rather than the sentence: "the GM should never intend to keep the player
      // bound to a location and the world need not be compact and walkable
      // necessarily". What used to ship said "Root location: ${name}. Keep the
      // world compact and walkable." — both halves of which the ruling strikes,
      // so there is nothing left to trim to. The package does not know enough
      // about the player's setting to assert a constraint on its shape.
      //
      // Verified safe to omit rather than assumed: the field is
      // `z.string().max(4000).optional()` with no default, and the one place its
      // absence could have bitten — the Engine inferring "hierarchical" from
      // `enableAgents && spatialMapInstructions?.trim()` — is `??`-guarded and
      // `gameWorldMapMode` is set explicitly two lines above, so the map mode is
      // unchanged by the deletion.
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
        // THE ONLY CARRIER OF THE PLAYER'S FREESTYLE ANSWER INTO THE WORLD. It
        // used to be a dropdown value; it is now derived from the Setting box,
        // and that changes who reads it and how much it matters. `_configTheme`
        // hands it to the interim world under the loading gate, to the legacy
        // world a DECLINED chat plays, and — through the brief call's `theme`
        // argument — to the rung the model's own `artTheme` answer has to beat.
        theme,
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
