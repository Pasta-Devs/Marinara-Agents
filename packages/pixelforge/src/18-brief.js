// ── The World Brief (schema v1) ───────────────────────────────────────────────
// The contract between the one LLM call and the deterministic compiler — see
// docs/brief-schema.md (sealed spec). The LLM decides WHAT exists; the compiler
// decides where every tile goes. validate() runs the repair passes ONCE; the
// sealed brief (with compiler-assigned _ids and a _repairs log) is stored in the
// wizard config and never re-repaired. All entropy for repairs derives from
// hash(seed, fieldPath) — one source, deterministic forever.
PF.brief = (() => {
  const VERSION = 1;

  // ── Vocabularies (the form does the teaching) ───────────────────────────────
  // Sized so the STREET GRID has somewhere to put a street. The grid lays a lot
  // every 8 rows and every 9 columns, and a map only 30 tall has room for two
  // rows of them however wide it is — so a village used to lay six lots on 1320
  // tiles and read as a hamlet with a lot of grass. Lots per rank now run
  // 4 / 8 / 16 / 36 / 80, which is the first progression where each rank looks
  // like a bigger VERSION of the one below rather than the same place zoomed.
  //
  // `buildings` is the ceiling on how many of those lots get laid out, and it is
  // deliberately kept ABOVE what the population arithmetic asks for at each rank
  // (20-world's RESIDENT_HOUSEHOLDS). The ground should permit and the people
  // should decide; when this number binds first, every settlement of a rank comes
  // out the same size no matter who lives there, which is the bug that made a
  // city eighteen buildings wide whatever its brief said.
  const SCALES = {
    outpost: { w: 28, h: 20, buildings: 4 },
    hamlet: { w: 48, h: 28, buildings: 8 },
    village: { w: 60, h: 40, buildings: 16 },
    town: { w: 76, h: 52, buildings: 34 },
    // A CITY. Roomy on purpose: it is the rank where districts (roadmap W3) will
    // eventually carve the map into wards with their own gravity, and the ground
    // wants to be there before the machinery that divides it.
    city: { w: 104, h: 72, buildings: 76 },
  };
  const SURROUNDS = ["woods", "fields", "rocky", "water", "barren"];
  const PROSPERITY = ["struggling", "modest", "thriving"];
  const PLACE_KINDS = ["gathering", "workshop", "hall", "sanctuary", "dwelling", "wilds"];
  const CAST_KINDS = [
    "leader",
    "host",
    "grower",
    "maker",
    "merchant",
    "guard",
    "healer",
    "scholar",
    "elder",
    "child",
    "wanderer",
    "folk",
  ];
  // Rootedness/integration — orthogonal to kind. resident is the strong default;
  // non-residents get NO dwelling and a standing-specific rest anchor (the inn,
  // the wilds/edge, or the town's public center). See docs/brief-schema.md.
  const STANDING = ["resident", "transient", "fringe", "destitute"];
  // Nine buckets cannot cluster; sprite legibility is an invariant, not a repair.
  const TINTS = {
    red: 4,
    orange: 28,
    amber: 48,
    green: 110,
    teal: 168,
    blue: 214,
    violet: 268,
    rose: 330,
    grey: 210,
  };
  const FEATURE_TAGS = [
    "water-feature",
    "crop-plots",
    "market-stalls",
    "workyard",
    "landmark-stone",
    "shrine",
    "water-crossing",
    "dense-growth",
    "ruin",
    "lookout",
  ];
  // Which tags make sense per zone kind (invalid-for-zone drops at compile, not parse).
  const SETTLEMENT_TAGS = new Set(FEATURE_TAGS.filter((t) => t !== "water-crossing" && t !== "dense-growth"));

  const CAPS = {
    // The ceiling a brief may ASK for. What a settlement can actually hold is
    // per-scale (FEATURE_ROOM below) — an outpost is 560 tiles and four of its
    // lots are now houses, so four named features have nowhere to stand and the
    // last two are dropped in silence. Small settlements holding fewer features
    // is correct; asking for four and losing two without a word is not.
    features: 4,
    places: 4,
    wilds: 2,
    hall: 1,
    gathering: 1,
    sanctuary: 1,
    castMin: 4,
    castMax: 10,
    // AN ID SPACE, not an occupancy bound. The two were the same constant, and
    // that conflation is the same bug as `household` carrying both kinship and
    // address: `Math.min(CAPS.household, n)` clamps WHICH group you are in, while
    // the oversize-split pass used the identical number to bound HOW MANY share
    // one. Ten people must be able to be ten unrelated households — a convent, a
    // barracks, a boarding house — so the id space is the cast size, and nothing
    // caps the members of a group any more.
    household: 10,
  };
  // How many named features the GROUND of each rank can actually carry, measured
  // rather than guessed: with the street-grid allocator an outpost seats two, a
  // hamlet three, and everything from a village up seats the full ask.
  const FEATURE_ROOM = { outpost: 2, hamlet: 3, village: 4, town: 4, city: 4 };
  // Named places take LOTS, and an outpost lays four of them. Four places leave
  // nothing for the houses the cast still needs, so the drop guard fires and the
  // brief loses buildings it named. What the rank can seat, it seals; the rest
  // never gets promised.
  const PLACE_ROOM = { outpost: 2, hamlet: 3, village: 4, town: 4, city: 4 };
  const BRIEF_BYTE_BUDGET = 8_192;

  // ── Deterministic entropy: ONE source ───────────────────────────────────────
  const det = (seed, fieldPath) => PF.rng(PF.hashStr(`${seed >>> 0}|${fieldPath}`));
  const pick = (seed, fieldPath, list) => list[(det(seed, fieldPath)() * list.length) | 0];

  // ── Text hygiene: sanitize + grapheme-aware caps, Unicode-aware folding ─────
  function sanitize(value) {
    if (typeof value !== "string") return "";
    let text = value.replace(/[\x00-\x1f\x7f]/g, " ");
    // One-pass tag stripping can reassemble a tag from its own fragments
    // ("<scr<b>ipt>" → "<script>"), so strip to a fixpoint FIRST — before the
    // markdown pass eats the ">" characters the tag regex needs to match…
    let previous;
    do {
      previous = text;
      text = text.replace(/<[^>]*>/g, "");
    } while (text !== previous);
    // …then drop the markdown set and ANY surviving angle bracket. Brief prose
    // has no legitimate use for them, and zero brackets in the output means no
    // tag fragment can ever survive (CodeQL js/incomplete-multi-character-sanitization).
    return text
      .replace(/[`*_~#>|<]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const segmenter =
    typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  function graphemes(value) {
    if (segmenter) return [...segmenter.segment(value)].map((s) => s.segment);
    return [...value];
  }
  function capText(value, max, { wholeSentence = false } = {}) {
    const clean = sanitize(value);
    const parts = graphemes(clean);
    if (parts.length <= max) return clean;
    if (wholeSentence) return ""; // a clause-losing cut of a hook is worse than none
    const cut = parts.slice(0, max).join("");
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
  }
  const fold = (value) =>
    sanitize(value).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  // ── Enum folding ────────────────────────────────────────────────────────────
  function foldEnum(value, list, fallback) {
    if (typeof value !== "string") return fallback;
    const folded = fold(value);
    return list.find((entry) => entry === folded) ?? fallback;
  }
  /** scale may arrive as a POPULATION NUMBER (the most-observed weak-model slip). */
  function foldScale(value, repairs) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const bucket =
        value < 8 ? "outpost" : value < 20 ? "hamlet" : value < 60 ? "village" : value < 200 ? "town" : "city";
      repairs.push(`scale: bucketed number ${value} -> ${bucket}`);
      return bucket;
    }
    return foldEnum(value, Object.keys(SCALES), "village");
  }

  /** Arrays may arrive as objects keyed by id — a common shape without provider
   *  json_schema. Object.values() BEFORE the array check saves the whole list. */
  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  // ── validate(): the repair passes; runs ONCE, seals the brief ───────────────
  function validate(raw, { theme: rawTheme, seed }) {
    const repairs = [];
    // Theme whitelist: lexicon lookups use bracket access, so a hostile theme
    // string (a prototype key) must never reach them. The wizard's theme is
    // still authoritative — an unknown one just resolves to the default.
    const theme = Object.prototype.hasOwnProperty.call(DEFAULT_BRIEFS, rawTheme) ? rawTheme : "cozy-village";
    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    if (src !== raw) repairs.push("transport: non-object root replaced");

    // Pass 2 — scalars.
    const scale = foldScale(src.scale, repairs);
    const brief = {
      briefVersion: VERSION,
      theme, // ALWAYS the wizard's theme; the model's echo is discarded unconditionally.
      scale,
      surround: foldEnum(src.surround, SURROUNDS, pick(seed, "surround", SURROUNDS)),
      prosperity: foldEnum(src.prosperity, PROSPERITY, "modest"),
      name: capText(src.name, 24) || pick(seed, "name", DEFAULT_NAMES[theme] || DEFAULT_NAMES["cozy-village"]),
      flavor: capText(src.flavor, 140),
      // A clause-losing cut of the hook is worse than none (§4.2): over-length
      // degrades to empty rather than shipping half a sentence.
      situation: capText(src.situation, 240, { wholeSentence: true }),
      features: [],
      places: [],
      cast: [],
      backgroundPopulation: 0,
    };
    const population = Number(src.backgroundPopulation);
    brief.backgroundPopulation = Number.isFinite(population) ? Math.max(0, Math.min(500, Math.round(population))) : 0;

    // Pass 3 — zones. Item-level drop: an unknown tag drops the WHOLE feature.
    // The cap applies to KEPT items (a leading run of junk must not discard
    // the valid features behind it — the places loop's semantics).
    const featureRoom = Math.min(CAPS.features, FEATURE_ROOM[brief.scale] ?? CAPS.features);
    for (const item of asArray(src.features)) {
      if (brief.features.length >= featureRoom) {
        // SAID OUT LOUD. Everything else in this pass records what it dropped
        // and why; a rank running out of ground is a better reason than most,
        // and the whole point of the cap is that a settlement stops PROMISING
        // what it cannot hold. Losing the promise silently would just move the
        // silence one layer up.
        repairs.push(`features: ${brief.scale} has room for ${featureRoom}; dropped the rest`);
        break;
      }
      const tag = foldEnum(item?.tag, FEATURE_TAGS, null);
      if (!tag || !SETTLEMENT_TAGS.has(tag)) {
        repairs.push(`features: dropped item with tag ${JSON.stringify(item?.tag ?? null)}`);
        continue;
      }
      brief.features.push({ tag, name: capText(item?.name, 24) || FEATURE_LABELS[tag] });
    }
    // Diversity floor (§4.6): no tag may occupy more than two of the kept
    // slots; the surplus re-rolls from the remaining settlement vocabulary.
    {
      const byTag = new Map();
      for (const feature of brief.features) byTag.set(feature.tag, (byTag.get(feature.tag) ?? 0) + 1);
      let rerollIndex = 0;
      for (const feature of brief.features) {
        if ((byTag.get(feature.tag) ?? 0) <= 2) continue;
        const alternatives = [...SETTLEMENT_TAGS].filter((tag) => (byTag.get(tag) ?? 0) === 0);
        if (alternatives.length === 0) break;
        byTag.set(feature.tag, byTag.get(feature.tag) - 1);
        const replacement = pick(seed, `feature-dedupe-${rerollIndex++}`, alternatives);
        repairs.push(`features: tag ${feature.tag} over-represented -> ${replacement}`);
        feature.tag = replacement;
        feature.name = FEATURE_LABELS[replacement];
        byTag.set(replacement, 1);
      }
    }

    const usedNames = new Set(); // folded names, for label dedupe
    const dedupeName = (name, fieldPath) => {
      // The result must ITSELF be unique: a suffix can collide with a literal
      // later name, and a duplicate display name collapses two ordinal ids into
      // one at compile — the misbinding §1 forbids. Loop the suffixes, then
      // fall to ordinals, and always register the final label.
      let candidate = name;
      let attempt = 0;
      while (usedNames.has(fold(candidate))) {
        const suffix =
          attempt < DEDUPE_SUFFIXES.length
            ? pick(seed, `${fieldPath}-dedupe-${attempt}`, DEDUPE_SUFFIXES)
            : String(attempt - DEDUPE_SUFFIXES.length + 2);
        candidate = `${name} ${suffix}`;
        attempt++;
      }
      if (candidate !== name)
        repairs.push(`${fieldPath}: duplicate name ${JSON.stringify(name)} -> ${JSON.stringify(candidate)}`);
      usedNames.add(fold(candidate));
      return candidate;
    };
    usedNames.add(fold(brief.name));

    let wildsCount = 0;
    let hallCount = 0;
    let gatheringCount = 0;
    let sanctuaryCount = 0;
    const placeRoom = Math.min(CAPS.places, PLACE_ROOM[brief.scale] ?? CAPS.places);
    for (const item of asArray(src.places)) {
      if (brief.places.length >= placeRoom) {
        repairs.push(`places: ${brief.scale} has room for ${placeRoom}; dropped the rest`);
        break;
      }
      const kind = foldEnum(item?.kind, PLACE_KINDS, null);
      if (!kind) {
        repairs.push(`places: dropped item with kind ${JSON.stringify(item?.kind ?? null)}`);
        continue;
      }
      if (kind === "wilds" && wildsCount >= CAPS.wilds) continue;
      if (kind === "hall" && hallCount >= CAPS.hall) continue;
      if (kind === "gathering" && gatheringCount >= CAPS.gathering) continue;
      if (kind === "sanctuary" && sanctuaryCount >= CAPS.sanctuary) continue;
      if (kind === "wilds") wildsCount++;
      if (kind === "hall") hallCount++;
      if (kind === "gathering") gatheringCount++;
      if (kind === "sanctuary") sanctuaryCount++;
      const name = dedupeName(capText(item?.name, 24) || PLACE_LABELS[kind], `places[${brief.places.length}]`);
      const place = { kind, name, flavor: capText(item?.flavor, 120) };
      if (kind === "wilds") {
        place.features = [];
        // Same kept-items rule as the settlement loop: the cap counts what we
        // KEEP, so a leading run of junk cannot discard valid features behind it.
        for (const feature of asArray(item?.features)) {
          if (place.features.length >= 3) break;
          const tag = foldEnum(feature?.tag, FEATURE_TAGS, null);
          if (!tag) continue;
          place.features.push({ tag, name: capText(feature?.name, 24) || FEATURE_LABELS[tag] });
        }
      }
      brief.places.push(place);
    }

    // §4.3: a host with no gathering place synthesizes AT MOST ONE interior
    // named from the host — the player must be able to walk into the inn.
    //
    // Run TWICE, against two different casts, because §4.3 is a post-condition on
    // the SEALED cast and this call can only see the model's draft. The raw cast
    // is not the sealed one: pass 6's quality floor tops up from STOCK, and every
    // stock roster leads with a `host`. So the brief that needs the synthesis most
    // — one whose cast failed validation outright — was the one brief that never
    // got it, and the compiler builds the common room from the gathering PLACE (a
    // `host` in the cast alone binds to nothing). Measured on a live playtest: a
    // colony compiled fifteen zones of "X's home" plus a farm, with a keeper who
    // had nowhere to keep and a berth nobody could rent. This call stays where it
    // is anyway, one pass ahead of the cast, so a model that named a host CAN
    // still resolve a `home` at the interior it just earned.
    const gatheringForHost = (people) => {
      if (brief.places.some((p) => p.kind === "gathering")) return;
      if (brief.places.length >= placeRoom) return;
      const host = people.find((item) => foldEnum(item?.kind ?? item?.role, CAST_KINDS, null) === "host");
      // The theme's own word for its common room. `${hostName}'s` alone reads as
      // one more house on the row — it stood in a street of "Rook's home" and
      // "Fen's home" and the player could not tell which door was the inn. Both
      // default briefs already carry the idiom (the Amber Hearth INN, the Meridian
      // CANTINA); the host's name is budgeted so `${name}'s ${noun}` still fits the
      // 24 characters the schema asks a model for — "'s " is three of them.
      const noun = GATHERING_NOUNS[theme] || GATHERING_NOUNS["cozy-village"];
      const hostName = host ? capText(host.name, Math.max(6, 24 - 3 - noun.length)) : "";
      if (!hostName) return;
      brief.places.push({
        kind: "gathering",
        name: dedupeName(`${hostName}'s ${noun}`, "places-host"),
        flavor: "",
      });
      repairs.push(`places: synthesized a gathering interior for host ${hostName}`);
    };
    const rawCast = asArray(src.cast);
    gatheringForHost(rawCast);

    // Pass 4 — cast. Over the cap, the leader survives (§4.4): hoist the first
    // leader to the front before truncating by original order.
    const zoneNames = [brief.name, ...brief.places.map((p) => p.name)];
    const zoneFolds = new Map(zoneNames.map((n) => [fold(n), n]));
    const leaderIndex = rawCast.findIndex((item) => foldEnum(item?.kind ?? item?.role, CAST_KINDS, null) === "leader");
    if (leaderIndex >= CAPS.castMax) {
      rawCast.unshift(rawCast.splice(leaderIndex, 1)[0]);
      repairs.push("cast: leader hoisted ahead of the cap");
    }
    for (const item of rawCast) {
      if (brief.cast.length >= CAPS.castMax) {
        repairs.push(`cast: over ${CAPS.castMax}, dropped the rest`);
        break;
      }
      const name = capText(item?.name, 24);
      if (!name) continue;
      const kind = foldEnum(item?.kind ?? item?.role, CAST_KINDS, "folk");
      const homeRaw = capText(item?.home, 24);
      // Resolution: exact -> folded -> root. NO substring matching (a guessed
      // binding is forever).
      let home = zoneNames.includes(homeRaw) ? homeRaw : (zoneFolds.get(fold(homeRaw)) ?? null);
      if (!home) {
        if (homeRaw) repairs.push(`cast[${brief.cast.length}].home: unresolved ${JSON.stringify(homeRaw)} -> root`);
        home = brief.name;
      }
      // WORKPLACE — where the working day is spent, when OWNERSHIP cannot say.
      // Ownership answers it for a smith with a forge, but it is one building per
      // person and one person per building, so it can never place a school's second
      // teacher, a market's fourth seller, or a shop assistant.
      //
      // Same exact -> folded resolution as `home`, and no substring matching for the
      // same reason: a guessed binding is forever.
      //
      // Unresolved falls to NULL, not to the root the way `home` does. "Works at the
      // settlement" says nothing a wander box could be built from, and a null
      // workplace IS every brief that has ever compiled — so the derivation in
      // 20-world runs exactly as before for anyone who does not name one.
      const workplaceRaw = capText(item?.workplace, 24);
      const workplace = zoneNames.includes(workplaceRaw) ? workplaceRaw : (zoneFolds.get(fold(workplaceRaw)) ?? null);
      if (workplaceRaw && !workplace)
        repairs.push(`cast[${brief.cast.length}].workplace: unresolved ${JSON.stringify(workplaceRaw)} -> none`);
      const householdNumber = Number(item?.household);
      brief.cast.push({
        name: dedupeName(name, `cast[${brief.cast.length}]`),
        role: capText(item?.role, 24) || KIND_LABELS[kind],
        kind,
        tint: foldEnum(
          item?.tint,
          Object.keys(TINTS),
          pick(seed, `cast-tint-${brief.cast.length}`, Object.keys(TINTS)),
        ),
        home,
        ...(workplace ? { workplace } : {}),
        household: Number.isFinite(householdNumber)
          ? Math.max(1, Math.min(CAPS.household, Math.round(householdNumber)))
          : 1,
        persona: capText(item?.persona ?? item?.flavor, 100),
        standing: foldEnum(item?.standing, STANDING, "resident"),
      });
    }

    // Pass 5 for the schema layer is compile-time (building arithmetic lives in
    // the compiler; see docs/brief-schema.md §4.5). Pass 6 — quality floors for
    // valid-but-degenerate briefs. Every top-up derives from the seed.
    if (brief.cast.length < CAPS.castMin) {
      const roster = STOCK_CAST[theme] || STOCK_CAST["cozy-village"];
      const offset = (det(seed, "cast-topup")() * roster.length) | 0;
      while (brief.cast.length < CAPS.castMin) {
        const stock = roster[(offset + brief.cast.length) % roster.length];
        brief.cast.push({
          ...stock,
          name: dedupeName(stock.name, `cast-topup[${brief.cast.length}]`),
          home: brief.name,
          household: brief.cast.length + 1,
          standing: stock.standing ?? "resident",
        });
        repairs.push(`cast: floor top-up ${stock.name}`);
      }
    }
    const households = new Set(brief.cast.map((c) => c.household));
    if (households.size < 2 && brief.cast.length >= 2) {
      // All-in-one-roof is the classic weak-model shape: split by seed.
      const splitAt = 1 + ((det(seed, "household-split")() * (brief.cast.length - 1)) | 0);
      for (let i = splitAt; i < brief.cast.length; i++) brief.cast[i].household = 2;
      repairs.push("cast: single household split into two");
    }
    // The oversized-household split is GONE. It bounded how many people could
    // share one number, using the same constant that bounds which numbers exist —
    // and a group is no longer bounded at all, because ten unrelated lodgers under
    // one roof is a thing a brief has to be able to say.
    //
    // It also shipped a live contract violation. `next` escaped its own cap by
    // `(next % (CAPS.household * 2)) + 1`, so the pass sealed household numbers
    // ABOVE the schema's own maximum: measured at 263 members over 400 seeds with
    // seven kin and three singletons. And it wrote into `byHousehold` while
    // iterating that same Map. Deleting the pass retires both.
    const tints = new Set(brief.cast.map((c) => c.tint));
    if (tints.size < Math.min(3, brief.cast.length)) {
      const keys = Object.keys(TINTS);
      const start = (det(seed, "tint-rotate")() * keys.length) | 0;
      brief.cast.forEach((member, index) => {
        member.tint = keys[(start + index) % keys.length];
      });
      repairs.push("cast: tints rotated for legibility");
    }
    if (brief.places.length === 0) {
      brief.places.push({
        kind: "wilds",
        name: dedupeName(pick(seed, "wilds-topup", WILDS_NAMES[theme] || WILDS_NAMES["cozy-village"]), "places-topup"),
        flavor: "",
        features: [{ tag: "landmark-stone", name: FEATURE_LABELS["landmark-stone"] }],
      });
      repairs.push("places: floor top-up wilds zone");
    }
    // §4.3 again, against the cast that actually SEALED — see gatheringForHost.
    // Last of the floors on purpose: the wilds top-up answers "this settlement has
    // no named place at all", which is a different lack, and running ahead of it
    // would silently spend that floor and leave a colony with an inn and no
    // outside. So a TOP-UPPED host gets both floors. (The pass-3 call is the one
    // path that still spends the wilds floor: a model host with zero surviving
    // places seals [gathering] and no wilds — deliberate, because that model DID
    // name a place through its host, and the floor answers namelessness, not a
    // missing outdoors.)
    gatheringForHost(brief.cast);

    // Identity (§2): opaque ordinal ids assigned once, stored in the sealed brief.
    const ids = { zones: {}, cast: {}, features: {} };
    ids.zones["z1"] = brief.name;
    brief.places.forEach((place, index) => {
      ids.zones[`z${index + 2}`] = place.name;
    });
    brief.cast.forEach((member, index) => {
      ids.cast[`n${index + 1}`] = member.name;
    });
    let featureOrdinal = 1;
    for (const feature of brief.features) ids.features[`f${featureOrdinal++}`] = feature.name;
    for (const place of brief.places)
      for (const feature of place.features ?? []) ids.features[`f${featureOrdinal++}`] = feature.name;
    brief._ids = ids;

    // Global byte budget: truncate prose in reverse-leverage order. Measured
    // in UTF-8 BYTES — String.length counts UTF-16 code units, which
    // undercounts CJK threefold (emoji fourfold vs two) and would defeat the
    // ≤8KB contract for exactly the non-Latin briefs §2 promises to support.
    const encoder = new TextEncoder();
    const overBudget = () => encoder.encode(JSON.stringify(brief)).length > BRIEF_BYTE_BUDGET;
    if (overBudget()) for (const member of brief.cast) member.persona = "";
    if (overBudget()) for (const place of brief.places) place.flavor = "";
    if (overBudget()) brief.flavor = "";
    if (overBudget()) repairs.push("budget: still over after prose truncation");

    brief._repairs = repairs;
    return brief;
  }

  // ── foldStored(): the READ-side fold (#566) ─────────────────────────────────
  // validate() above is a SEAL-TIME guarantee, and it does not survive the round
  // trip through chat metadata. `PF.save._configBrief` hands the compiler whatever
  // the metadata holds, and ~14 reads inside 20-world's compile() index tables with
  // it: a stored `prosperity: "constructor"` resolved to a function on
  // Object.prototype and cost a town 38 of its 48 zones with nothing said, and a
  // stored `scale` or `place.kind` threw and left build()'s catch-all degrading a
  // compiled settlement to the 3-zone legacy layout behind one console.warn.
  //
  // THIS IS A FOLD, NOT A SECOND validate(), and that is the whole design. Running
  // validate() again on read would re-run the seal-time POLICY passes too — the
  // per-scale feature and place caps, the floors, the dedupe — against a brief
  // sealed under a table that may not be this build's. A newer build that seats
  // four places at hamlet rank writes a brief this one would strip to two on every
  // load, which is the same silent zone loss the seam was opened for, arriving
  // through the front door. Seal time may DROP; read time may only FOLD. Every
  // array length, every name and every id crosses this function untouched, and
  // what changes is only a value the compiler was about to use as a table key.
  //
  // AND IT NEVER TOUCHES THE CALLER'S OBJECT. The brief the save path holds is what
  // PF.player.briefHashOf() stamps a save against, so a byte of it moving under the
  // load path is a SPURIOUS SEVERANCE — rel rows, quests and home quarantined for a
  // world that did not change. Neither hazard is theoretical: validate() reorders
  // `src.cast` in place on the leader-hoist path, and it is not byte-idempotent
  // anyway (a brief that took repairs at seal time re-validates with an empty
  // `_repairs`, and a stock top-up member's key order is not the main path's). So
  // the fold works on a deep copy that lives and dies inside build(), the stored
  // object stays the identity source it has always been, and `_folds` — the
  // read-side counterpart of `_repairs` — rides the copy and is never written back.
  //
  // Where the compiler's readings all agree on a fallback, the fold changes
  // nothing observable: an unknown `tint` was already grey's hue (`?? 210`) and an
  // unknown `tag` was already a plain rect with no painter — measured, those two
  // compile identically folded or not. Everything else MOVES, deliberately.
  // `prosperity` moving is this function's headline (the silent 38-of-48-zone
  // loss above). `place.kind` moves because FURNISH's `|| dwelling` was never the
  // only reading — upperPlan refuses non-household kinds outright and cellarPlan
  // gives them no cellar, so an unfolded unknown compiled to a stunted dwelling,
  // not a dwelling. `surround` and `standing` move to validate's own defaults,
  // which beat a flat ground mix and a person with no rest anchor. In every case
  // the fold's answer is the one seal time would have given, and a value naming
  // something on Object.prototype can no longer pretend to be a table's entry.
  //
  // An ABSENT value stays absent. `?? "resident"` and `|| SCALES.village` are the
  // compiler's reading of a missing field, and folding one in would rewrite a brief
  // sealed before that field existed.
  function foldStored(stored, seed) {
    const brief = JSON.parse(JSON.stringify(stored));
    const folds = [];
    const foldAt = (owner, key, list, fallback, fieldPath) => {
      if (!owner || typeof owner !== "object") return;
      if (!Object.prototype.hasOwnProperty.call(owner, key)) return;
      const was = owner[key];
      if (was === null || was === undefined) return;
      const now = foldEnum(was, list, fallback);
      if (now === was) return;
      owner[key] = now;
      folds.push(`${fieldPath}: ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
    };
    const foldFeatures = (list, fieldPath) => {
      if (!Array.isArray(list)) return;
      // No default tag exists to fold to, and inventing one would put a feature on
      // the map the brief never asked for. null is what the placement loops already
      // read an unknown tag as (`FEATURE_RECTS[tag] ?? FEATURE_RECT`, `PLACERS[tag]?.`),
      // and the row keeps its name, so the registry can still say what stands there.
      list.forEach((feature, index) => foldAt(feature, "tag", FEATURE_TAGS, null, `${fieldPath}[${index}].tag`));
    };
    // Theme is the one fold whose vocabulary is not this module's to state.
    // compile() spends `brief.theme` on a single read — `PF.art.setTheme()`
    // (20-world) — so 10-art's table IS the whitelist, and it is asked for it at
    // fold time rather than copied at load time. A copy would drift the moment a
    // theme ships with art but no worked example here, and folding an art-only
    // theme to cozy-village would replace a VALID value one screen before
    // setTheme() would have accepted it: the future-theme divergence class the
    // roadmap's swamp-biome prerequisites already track. No art module, no
    // authority and so no fold — which is what 20-world's own `PF.art.setTheme ?`
    // guard does with the same absence.
    const themeIds = PF.art?.themeIds?.();
    if (themeIds) foldAt(brief, "theme", themeIds, "cozy-village", "theme");
    foldAt(brief, "scale", Object.keys(SCALES), "village", "scale");
    foldAt(brief, "surround", SURROUNDS, pick(seed, "surround", SURROUNDS), "surround");
    foldAt(brief, "prosperity", PROSPERITY, "modest", "prosperity");
    foldFeatures(brief.features, "features");
    if (Array.isArray(brief.places))
      brief.places.forEach((place, index) => {
        foldAt(place, "kind", PLACE_KINDS, "dwelling", `places[${index}].kind`);
        foldFeatures(place?.features, `places[${index}].features`);
      });
    if (Array.isArray(brief.cast))
      brief.cast.forEach((member, index) => {
        foldAt(member, "kind", CAST_KINDS, "folk", `cast[${index}].kind`);
        foldAt(member, "tint", Object.keys(TINTS), "grey", `cast[${index}].tint`);
        foldAt(member, "standing", STANDING, "resident", `cast[${index}].standing`);
      });
    brief._folds = folds;
    return brief;
  }

  // ── defaults(): the themed brief a world compiles to when nobody wrote one ──
  // NOT a failure path any more (see generate()'s design revision): no failure
  // seals anything. What it remains is the schema's own worked example per theme —
  // the fixture the compiler's invariants are driven through, and the answer for
  // any future caller that needs a brief without a generation call behind it.
  function defaults(theme, seed) {
    // PF.own, because this read happens BEFORE validate() applies the same guard
    // one screen up — and it is the parameter of an exported function, so the
    // word arrives from wherever the caller got it. Bare, `defaults("__proto__")`
    // handed Object.prototype to validate() as the worked example: an object, so
    // it survived the transport check, and every field then floored to nothing.
    // The theme came back cozy-village and the brief came back EMPTY, which is
    // the fallback on this line reading as if it had fired when it had not.
    return validate(PF.own(DEFAULT_BRIEFS, theme) || DEFAULT_BRIEFS["cozy-village"], { theme, seed });
  }

  /** Truncation salvage (§4.1/§5): strip fences, take the outermost balanced
   *  JSON object span, parse. Returns the parsed object or null — the caller's
   *  validate() then repairs and floors whatever survived the cut. */
  function salvageText(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    let text = raw.replace(/```[a-z]*\n?/gi, "").trim();
    const start = text.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let end = -1;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    // A cut-off document has no balanced end: close whatever is open after
    // trimming a trailing partial element (back to the last , { [ or complete
    // value) so complete array elements survive the amputation.
    let candidate;
    if (end >= 0) {
      candidate = text.slice(start, end + 1);
    } else {
      let body = text.slice(start).replace(/,[^,{}[\]]*$/, "");
      const opens = [];
      inString = false;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (inString) {
          if (ch === "\\") i++;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "{" || ch === "[") opens.push(ch);
        else if (ch === "}" || ch === "]") opens.pop();
      }
      if (inString) body += '"';
      candidate =
        body +
        opens
          .reverse()
          .map((ch) => (ch === "{" ? "}" : "]"))
          .join("");
    }
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** The route caps userContent at 8,000 chars and 400s past it — a hard
   *  contract, so an unbounded wizard Setting must be clamped here or the
   *  most detailed settings would silently forfeit generation (review). */
  const capPreferences = (text) =>
    typeof text === "string" && text.length > 7_800 ? `${text.slice(0, 7_800)}…` : text;

  /** The one #5135 generation call with the §5 failure ladder (amended):
   *  bounded wait; one wait-out on the server's documented-transient 409
   *  chat_busy; one plain re-roll on truncation (the route's maxTokens is
   *  min()-only — "never a raise" — so a numeric override could only shrink
   *  the budget); salvage of the LONGEST truncated raw seen across attempts.
   *
   *  Returns a SEALED brief for the two outcomes that produce a REAL one —
   *  success and salvage — and NULL for every failure, so the caller leaves the
   *  chat unsealed and the next visit simply tries again.
   *
   *  DESIGN REVISION (this release, maintainer ruling #7 / plan §Q3b). The 0.4.0
   *  ladder sealed THEMED DEFAULTS on a deterministic/paid failure — 400 contract,
   *  422 provider/parse — on the reasoning that a paid call per visit is worse
   *  than the default world. That decision predates the loading gate and does not
   *  survive it: back then a default world was what the player was already walking
   *  in, so sealing it changed nothing they could see. Now the gate holds play
   *  precisely so that nobody invests in a world that is going to be discarded,
   *  and the README states the contract plainly — "a generation failure is a retry
   *  screen; nothing is stored". Sealing defaults on a 400 makes that sentence
   *  false in the one case a player cannot undo: the key is written, the chat is
   *  permanently a themed default, and the three paragraphs of setting they wrote
   *  are gone with no way back. The paid-call worry is also nearly hypothetical
   *  now — capPreferences clamps to 7,800 against the route's 8,000 cap, so the
   *  reachable 400 is a contract bug rather than a long setting.
   *
   *  `onFailure(kind)` reports WHY, once, so the retry screen can say something
   *  truer than "something went wrong" — a deterministic refusal and a busy engine
   *  want different sentences from the player. Kinds: "unavailable" (404/409/429/
   *  5xx), "refused" (400/422 with nothing salvageable), "network", "timeout". */
  async function generate(
    chatId,
    { theme, seed, preferences, onProgress, onFailure, budgetMs = 90_000, busyWaitMs = Math.min(15_000, budgetMs / 6) },
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgetMs);
    try {
      const base = { instructions: guidance(theme), userContent: capPreferences(preferences), schema: schema() };
      let response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
      if (response.status === 409) {
        // chat_busy ships Retry-After: 15 — wait it out once inside the budget
        // (busyWaitMs is a timer seam so the harness never sleeps for real).
        await new Promise((resolve) => setTimeout(resolve, busyWaitMs));
        if (!controller.signal.aborted)
          response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
      }
      const rawOf = (r) =>
        r.status === 422 && r.body?.truncated && typeof r.body.raw === "string" ? r.body.raw : null;
      let bestRaw = rawOf(response);
      if (response.status === 422 && response.body?.truncated) {
        onProgress?.("Generating your world… (one more try)");
        response = await PF.api.postExperienceGeneration(chatId, base, controller.signal);
        const retryRaw = rawOf(response);
        if (retryRaw && (!bestRaw || retryRaw.length > bestRaw.length)) bestRaw = retryRaw;
      }
      if (
        response.status === 200 &&
        response.body?.ok &&
        response.body.data &&
        typeof response.body.data === "object"
      ) {
        return validate(response.body.data, { theme, seed });
      }
      if (bestRaw) {
        const salvaged = salvageText(bestRaw);
        if (salvaged) {
          const sealed = validate(salvaged, { theme, seed });
          sealed._repairs.push("transport: salvaged from a truncated response");
          return sealed;
        }
      }
      if (response.status === 404 || response.status === 409 || response.status === 429 || response.status >= 500) {
        console.warn("[pixelforge] world generation unavailable (transient); retrying next visit", response.status);
        onFailure?.("unavailable");
        return null;
      }
      // 400 (contract) and 422 (provider/parse, nothing salvageable). Deterministic
      // — trying again probably gets the same answer — but STILL a retry screen and
      // still nothing stored, because the alternative is deciding a themed default
      // world on the player's behalf and writing it down where they cannot undo it.
      console.warn(
        "[pixelforge] world generation was refused; the chat stays unsealed",
        response.status,
        response.body?.error ?? null,
      );
      onFailure?.("refused");
      return null;
    } catch (err) {
      // Network trouble and the budget timeout are both transient — leave the
      // chat unsealed rather than freezing the default world in forever.
      if (!controller.signal.aborted) {
        console.warn("[pixelforge] world generation failed (network); retrying next visit", err);
        onFailure?.("network");
      } else {
        console.warn("[pixelforge] world generation timed out; retrying next visit");
        onFailure?.("timeout");
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── guidance(): the exact text that ships in the one call ───────────────────
  function guidance(theme) {
    return [
      "You are generating a WORLD BRIEF for a walkable pixel-art RPG. You decide WHAT exists;",
      "a deterministic generator decides where every tile goes. Reply with ONLY a JSON object.",
      "",
      `The visual theme is "${theme}" and it is AUTHORITATIVE: dress the player's setting text to fit it.`,
      "",
      "Fields (all limits are hard):",
      `- scale: one of ${Object.keys(SCALES).join(" | ")} — the settlement's size class. Never a number.`,
      `- surround: one of ${SURROUNDS.join(" | ")}.`,
      `- prosperity: one of ${PROSPERITY.join(" | ")}.`,
      "- name: the settlement's name, <=24 characters.",
      "- flavor: ONE sentence of arrival atmosphere, <=140 characters.",
      "- situation: ONE sentence, <=240 characters — the unresolved thing happening right now.",
      "  Name a cause and a person, not a mood.",
      `- features: 0-4 of {tag, name} placed in the settlement. tag from: ${[...SETTLEMENT_TAGS].join(", ")}.`,
      "  name <=24 chars — becomes a map location.",
      `- places: 0-4 additional zones of {kind, name, flavor}. kind from: ${PLACE_KINDS.join(" | ")}.`,
      "  At most 2 wilds, 1 hall, 1 gathering, 1 sanctuary. Home an elder at a sanctuary to give it a keeper. A sanctuary is the settlement's",
      "  church, temple or memorial hall — it is built taller than the houses. wilds may carry",
      "  0-3 features (water-crossing and dense-growth are wilds-only). flavor: ONE sentence <=120 chars.",
      "- cast: 4-10 story-relevant people of {name, role, kind, tint, home, household, persona, standing}.",
      `  kind (machine field) from: ${CAST_KINDS.join(" | ")}. role: <=24 chars free text (their title).`,
      `  tint from: ${Object.keys(TINTS).join(" | ")}. home: the NAME of the zone they live in.`,
      "  workplace (optional): the NAME of the zone they work in, when it is not the one they",
      "  live in and they do not run it themselves — a second teacher at the school, a shop",
      "  assistant, one of several sellers at a market. Omit it for anyone who works at home.",
      "  household: 1-10 — people sharing a number share a roof. Buildings are derived from",
      "  households, so do NOT give everyone their own number unless they truly live apart.",
      "  Unrelated people CAN share one: lodgers at a boarding house, sisters at a convent,",
      "  recruits in a barracks are all one number, and there is no limit on how many.",
      "  persona: <=100 chars — what they want, and what they are hiding.",
      `  standing (optional, default resident): one of ${STANDING.join(" | ")}. transient = passing`,
      "  through; fringe = lives apart at the edges (hermit, outcast, refugee); destitute = no home.",
      "  Keep most people resident; a crossroads or waystation may have many transients.",
      "- backgroundPopulation: total inhabitants including the cast (0-500). This is narrative",
      "  texture for the map description — it never creates buildings.",
      "",
      "Only the cast, features, and places you name will exist. Keep names in the player's language.",
    ].join("\n");
  }

  function schema() {
    const text = (maxLength) => ({ type: "string", maxLength });
    const featureItem = {
      type: "object",
      properties: { tag: { type: "string", enum: FEATURE_TAGS }, name: text(24) },
      required: ["tag", "name"],
    };
    return {
      type: "object",
      properties: {
        scale: { type: "string", enum: Object.keys(SCALES) },
        surround: { type: "string", enum: SURROUNDS },
        prosperity: { type: "string", enum: PROSPERITY },
        name: text(24),
        flavor: text(140),
        situation: text(240),
        features: { type: "array", maxItems: 4, items: featureItem },
        places: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: PLACE_KINDS },
              name: text(24),
              flavor: text(120),
              features: { type: "array", maxItems: 3, items: featureItem },
            },
            required: ["kind", "name"],
          },
        },
        cast: {
          type: "array",
          minItems: 4,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              name: text(24),
              role: text(24),
              kind: { type: "string", enum: CAST_KINDS },
              tint: { type: "string", enum: Object.keys(TINTS) },
              home: text(24),
              workplace: text(24),
              household: { type: "integer", minimum: 1, maximum: 10 },
              persona: text(100),
              standing: { type: "string", enum: STANDING },
            },
            required: ["name", "kind", "tint", "home", "household"],
          },
        },
        backgroundPopulation: { type: "integer", minimum: 0, maximum: 500 },
      },
      required: ["scale", "name", "cast"],
    };
  }

  // ── Theme lexicon (the repair layer's per-theme content — §weakness 6) ──────
  const FEATURE_LABELS = {
    "water-feature": "The Pool",
    "crop-plots": "The Plots",
    "market-stalls": "The Stalls",
    workyard: "The Yard",
    "landmark-stone": "The Old Marker",
    shrine: "The Shrine",
    "water-crossing": "The Crossing",
    "dense-growth": "The Thicket",
    ruin: "The Ruin",
    lookout: "The Lookout",
  };
  // What each theme calls its common room, for the §4.3 host synthesis. Read off
  // the default briefs, which name theirs in full: "The Amber Hearth Inn" and
  // "The Meridian Cantina". PLACE_LABELS is the generic fallback for a place the
  // model named nothing at all; this is the possessive a person's own house of
  // hospitality takes.
  const GATHERING_NOUNS = { "cozy-village": "Inn", "sci-fi-colony": "Cantina" };
  const PLACE_LABELS = {
    gathering: "The Hearth",
    workshop: "The Works",
    hall: "The Hall",
    sanctuary: "The Sanctuary",
    dwelling: "The House",
    wilds: "The Wilds",
  };
  const KIND_LABELS = {
    leader: "leader",
    host: "keeper",
    grower: "grower",
    maker: "artisan",
    merchant: "trader",
    guard: "watch",
    healer: "healer",
    scholar: "archivist",
    elder: "elder",
    child: "youngster",
    wanderer: "wanderer",
    folk: "resident",
  };
  const DEDUPE_SUFFIXES = ["Upper", "Lower", "Old", "New", "Far", "Near"];
  const DEFAULT_NAMES = {
    "cozy-village": ["Hearthvale", "Mossbrook", "Emberfield"],
    "sci-fi-colony": ["Meridian Base", "Anchorage Nine", "Halcyon Point"],
  };
  const WILDS_NAMES = {
    "cozy-village": ["The Whisperwood", "The Fallow Reach"],
    "sci-fi-colony": ["The Mast Field", "The Outer Flats"],
  };
  const STOCK_CAST = {
    "cozy-village": [
      { name: "Mira", role: "innkeeper", kind: "host", tint: "rose", persona: "" },
      { name: "Tam", role: "farmer", kind: "grower", tint: "green", persona: "" },
      { name: "Rook", role: "guard", kind: "guard", tint: "blue", persona: "" },
      { name: "Fen", role: "forager", kind: "wanderer", tint: "teal", persona: "" },
    ],
    "sci-fi-colony": [
      { name: "Mira", role: "cantina keeper", kind: "host", tint: "rose", persona: "" },
      { name: "Tam", role: "hydroponics lead", kind: "grower", tint: "green", persona: "" },
      { name: "Rook", role: "pad marshal", kind: "guard", tint: "blue", persona: "" },
      { name: "Fen", role: "salvage scout", kind: "wanderer", tint: "teal", persona: "" },
    ],
  };
  const DEFAULT_BRIEFS = {
    "cozy-village": {
      scale: "village",
      surround: "woods",
      prosperity: "modest",
      name: "Hearthvale",
      flavor: "A cozy closed valley where the roads all end at somebody's gate.",
      situation: "",
      features: [
        { tag: "water-feature", name: "The Village Pond" },
        { tag: "crop-plots", name: "Tam's Rows" },
      ],
      places: [
        { kind: "gathering", name: "The Amber Hearth Inn", flavor: "Low beams, warm bread, long memories." },
        {
          kind: "wilds",
          name: "The Whisperwood",
          flavor: "Dense trees, a shallow stream, an old stone.",
          features: [
            { tag: "water-crossing", name: "The Stepping Stones" },
            { tag: "landmark-stone", name: "The Old Marker" },
          ],
        },
      ],
      cast: [
        {
          name: "Mira",
          role: "innkeeper",
          kind: "host",
          tint: "rose",
          home: "The Amber Hearth Inn",
          household: 1,
          persona: "",
        },
        { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Hearthvale", household: 2, persona: "" },
        { name: "Rook", role: "guard", kind: "guard", tint: "blue", home: "Hearthvale", household: 3, persona: "" },
        {
          name: "Fen",
          role: "forager",
          kind: "wanderer",
          tint: "teal",
          home: "The Whisperwood",
          household: 4,
          persona: "",
        },
      ],
      backgroundPopulation: 30,
    },
    "sci-fi-colony": {
      scale: "village",
      surround: "barren",
      prosperity: "modest",
      name: "Meridian Base",
      flavor: "A frontier colony under a sealed sky, humming at all hours.",
      situation: "",
      features: [
        { tag: "water-feature", name: "The Coolant Pool" },
        { tag: "crop-plots", name: "The Hydro Bay" },
      ],
      places: [
        { kind: "gathering", name: "The Meridian Cantina", flavor: "Recycled air, real coffee, questionable cards." },
        {
          kind: "wilds",
          name: "The Mast Field",
          flavor: "Antenna rows marching into the dust.",
          features: [
            { tag: "water-crossing", name: "The Conduit Bridge" },
            { tag: "landmark-stone", name: "The Beacon" },
          ],
        },
      ],
      cast: [
        {
          name: "Mira",
          role: "cantina keeper",
          kind: "host",
          tint: "rose",
          home: "The Meridian Cantina",
          household: 1,
          persona: "",
        },
        {
          name: "Tam",
          role: "hydroponics lead",
          kind: "grower",
          tint: "green",
          home: "Meridian Base",
          household: 2,
          persona: "",
        },
        {
          name: "Rook",
          role: "pad marshal",
          kind: "guard",
          tint: "blue",
          home: "Meridian Base",
          household: 3,
          persona: "",
        },
        {
          name: "Fen",
          role: "salvage scout",
          kind: "wanderer",
          tint: "teal",
          home: "The Mast Field",
          household: 4,
          persona: "",
        },
      ],
      backgroundPopulation: 24,
    },
  };

  return {
    VERSION,
    SCALES,
    TINTS,
    FEATURE_TAGS,
    CAPS,
    validate,
    foldStored,
    defaults,
    guidance,
    schema,
    generate,
    salvageText,
  };
})();
