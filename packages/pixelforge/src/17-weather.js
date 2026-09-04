// ── Sky, climate and calendar ─────────────────────────────────────────────────
// The substrate every weather consumer derives from: two climate AXES minted per
// world, a 365-day calendar whose phase is the world's own, and one continuous
// derivation that turns (latitude, precipitation, season) into the day's odds.
//
// POSITION 17, BEFORE 18-brief, and the rule that buys it: NO MODULE NUMBERED
// BELOW 17 MAY READ `PF.weather`. The bundle is one IIFE concatenated in filename
// order, so a backward read is a `TypeError` at load and a forward one is free —
// 18-brief folds the two axis fields against the enums below, 20-world stamps the
// mint, 30-sim wraps the draw, and 59/61 read the word list the way 61 already
// reads 59's daypart list.
//
// WEATHER ADDS ZERO SAVE FIELDS, exactly as schedules do: the sky at day D is a
// pure function of (world seed, day) and the clock is already saved, so a reload,
// a rebuild and a timeline rewind all re-derive the same sky. The one thing that
// is not derived is the GM's override, and that lives in chat metadata (60-save),
// never in the save envelope.
PF.weather = (() => {
  // ── The two axes ───────────────────────────────────────────────────────────
  // Plain arrays, exported, and the single authority every door folds against —
  // the brief's seal pass, the brief's load pass, and the digest that describes
  // the world to a generation call all spend THESE, by name, rather than copying
  // the words into a third file.
  //
  // THE `Extreme` SEAM, RECORDED AND NOT DESIGNED: a colony world may eventually
  // want a climate two temperate axes cannot say. The shape of that — a sixth
  // band, a third axis, something else — is a conversation with the maintainer
  // and nothing here anticipates it. What the module owes it is additivity, and
  // it has it by construction: every fold reads the exported array and every
  // table below is paired against it at boot, so a new entry is one row in three
  // literals and not a migration. See the plan's §2.1 before building on this.
  const LATITUDES = ["equatorial", "tropical", "temperate", "subpolar", "polar"];
  const PRECIPS = ["arid", "moderate", "wet"];

  // ONE FIELD NAME PER AXIS, everywhere: the brief field, the schema property,
  // the fold row, the world stamp and axesFor's return are all `latitude` and
  // `precipitation`. The only short forms in this file are the CONSTANT names
  // below (which are never read off a brief) and the two side-stream hash tokens
  // (which are stream ids, permanent once shipped, and not a read surface). A
  // `brief.precip` written somewhere would fold nothing and pin nothing, silently.

  // `warmth` is the band's base temperature term and `swing` its seasonal
  // amplitude — nearer the equator is hotter AND flatter, which is the whole
  // gradient as two numbers. `structure` names the season set: two seasons in the
  // tropics, four poleward.
  const LAT_META = {
    equatorial: { warmth: 3, swing: 0, structure: "two" },
    tropical: { warmth: 3, swing: 1, structure: "two" },
    temperate: { warmth: 2, swing: 2, structure: "four" },
    subpolar: { warmth: 1, swing: 2, structure: "four" },
    // Warmth 0 with a swing of 1 means what it says: polar summer reaches t = 1,
    // where flurries and cold drizzle are both possible and a storm is
    // arithmetically unreachable (the storm gate opens above t = 2). WINTER IS
    // THE ONLY POLAR SEASON AT OR BELOW THE FULL-SNOW LINE: that line is
    // `freezePoint - mixBand` = -0.5 and winter sits at t = -1, while spring and
    // autumn sit at t = 0 — a snow-heavy mix that still falls a quarter rain, and
    // summer three quarters.
    polar: { warmth: 0, swing: 1, structure: "four" },
  };

  // The wet-draw mass term. Arid-hot and wet-hot are the same latitude row read
  // through two different numbers here, which is the distinction the two-axis
  // design exists for.
  const PRECIP_META = {
    arid: { wetness: 0.5 },
    moderate: { wetness: 2 },
    wet: { wetness: 3.5 },
  };

  // Season NAMES, keyed by structure. The two-season names are
  // PRECIPITATION-RELATIVE and the honest caveat is stated in player-state: an
  // arid tropic's "wet season" is merely its storm-leaning half, not a monsoon.
  const SEASON_SETS = {
    four: ["spring", "summer", "autumn", "winter"],
    two: ["wet season", "dry season"],
  };

  // ── The tuning surface ─────────────────────────────────────────────────────
  // One file, one retune — the economy's idiom. These are coefficients, not
  // vocabulary: nothing here is compat-bearing, and moving any of them re-skies
  // unpinned worlds on their next load (the rolling-compat class, stated in
  // player-state).
  const TUNING = {
    yearDays: 365,
    // The words worth a ledger line when a day-crossing brings them in.
    notable: ["snow", "storm"],
    // THE THREE BAND EDGES. `freezePoint` is the temperature at which the snow
    // share reaches ZERO — the top of a mix band, not a step — and `mixBand` is
    // how wide that band is: full snow at freezePoint - mixBand, full rain at
    // freezePoint, a real sleet mix between. `stormFloor`/`stormBand` gate storm
    // on genuine warmth, so a cold world's blizzard is heavy snow and never a
    // thunderstorm.
    freezePoint: 1.5,
    mixBand: 2,
    stormFloor: 2,
    stormBand: 1.5,
    stormShare: 0.25,
    overcastBase: 1,
    overcastWet: 0.4,
    fairBase: 4,
    fairDry: 1.5,
    dryPivot: 2,
    // The two-season wet/dry alternation. The wet half must be the wetter one —
    // the name has to be true of the numbers, and the boot assert says so.
    wetSeasonFactor: 1.8,
    drySeasonFactor: 0.3,
    heavyBase: 0.12,
    heavyMax: 0.75,
    // Particle counts and fall speed per intensity (the render pass). Heavy runs
    // ~2.7x the streaks at ~1.7x the speed; storm rides the heavy row.
    particles: { light: { n: 45, fall: 1.0 }, heavy: { n: 120, fall: 1.7 } },
  };

  // ── The two phase tables ───────────────────────────────────────────────────
  // KEYED BY ORDINAL INDEX INTO `SEASON_SETS[structure]`, deliberately: a table
  // keyed by season WORD would have to agree with two different vocabularies at
  // once, and the half that disagreed would compute NaN for every cell of one
  // structure rather than throwing anywhere a reader would look. Index order is
  // the season set's own — four = spring/summer/autumn/winter, two = wet/dry.
  //
  // Two's +-0.5 amplitude is half of four's +-1 on purpose: the tropics swing
  // less than the temperate belt, the same gradient LAT_META's `swing` states.
  const TEMP_PHASE = {
    four: [0, 1, 0, -1],
    two: [0.5, -0.5],
  };
  // Four-structure worlds run FLAT wetness — the wet/dry alternation IS the
  // two-season structure's weather identity, and giving four seasons a wetness
  // curve too would be inventing a season layer nothing has asked for.
  //
  // ONE IDENTITY THIS FLATNESS BUYS, recorded as a decision rather than left to
  // be discovered: with `TEMP_PHASE.four` symmetric about the shoulders and
  // wetness flat, SPRING AND AUTUMN ARE THE SAME SKY, byte for byte, in every
  // four-structure (band x precipitation) pair. Four season names buy three
  // distinct skies per band. Nothing breaks — the header and the ledger still
  // print two different words, because the calendar is real and the symmetry is
  // the sky's — and if the playtest ever wants autumn to read wetter than
  // spring, that is a one-array retune here and not a design hole.
  const WET_PHASE = {
    four: [1, 1, 1, 1],
    two: [TUNING.wetSeasonFactor, TUNING.drySeasonFactor],
  };

  // ── Per-theme axis distributions ───────────────────────────────────────────
  // A cozy village is USUALLY mid-latitude and CAN roll tropical or subpolar; the
  // colony leans cold and dry. An omitted band is the distribution speaking — no
  // cozy world is polar — and the boot assert below says so rather than treating
  // a missing key as a hole.
  //
  // THE COUPLING, STATED: this is a theme-keyed table in a third file, which is
  // exactly the drift 18-brief's foldStored refuses to introduce (it asks
  // `PF.art.themeIds()` instead of copying the list). The boot assert turns that
  // drift into a load-time throw ON PURPOSE — adding a theme to 10-art now breaks
  // boot until this table learns it too, which is a red at the desk instead of a
  // world with no climate at somebody's.
  const THEME_AXES = {
    "cozy-village": {
      latitude: { tropical: 1, temperate: 6, subpolar: 2 },
      precipitation: { arid: 1, moderate: 6, wet: 3 },
    },
    "sci-fi-colony": {
      latitude: { equatorial: 1, tropical: 1, temperate: 3, subpolar: 4, polar: 2 },
      precipitation: { arid: 3, moderate: 4, wet: 2 },
    },
  };

  // ── The weather vocabulary ─────────────────────────────────────────────────
  // FIVE WORDS. Intensity is a SECOND, smaller dimension taken by rain and snow
  // only — not two more words: the pack's weather axis, the catch tables, the
  // indoors bias flag and the snow tile substitution all stay five-valued, and
  // only the header label, the rain tint and the particle pass ever read the
  // intensity. The ledger reads neither — light snow hardening into heavy snow is
  // the same weather to it.
  const WORDS = ["fair", "overcast", "rain", "storm", "snow"];
  const INTENSITIES = ["light", "heavy"];

  // Two names, two jobs: WORDS is the axis, this is what each word DOES. `label`
  // is the header's wire text (per-intensity where one is taken), `tint` the
  // render pass's multiply colour (per-intensity for rain — heavy rain has to
  // read as heavier), `indoors` the schedule bias flag, and `takesIntensity` is
  // the ONE home of "does this word carry a light/heavy": the draw, the metadata
  // fold, labelFor and the boot assert all read this flag rather than restating
  // the pair in four places.
  const WORD_META = {
    fair: { label: "fair", tint: null, indoors: false, takesIntensity: false },
    overcast: { label: "overcast", tint: "rgba(120,125,135,.12)", indoors: false, takesIntensity: false },
    rain: {
      label: { light: "light rain", heavy: "heavy rain" },
      tint: { light: "rgba(70,90,110,.12)", heavy: "rgba(70,90,110,.24)" },
      // INTENSITY-BLIND on purpose: light rain still empties the street. A
      // drizzle reads as weather, not as an exception.
      indoors: true,
      takesIntensity: true,
    },
    storm: { label: "storm", tint: "rgba(50,65,90,.30)", indoors: true, takesIntensity: false },
    // No tint — the snow TILES carry it. The ground treatment is binary by the
    // same scoping: a light-snow day and a blizzard stand on the same white
    // tiles, and what differs is how much is falling.
    snow: { label: { light: "light snow", heavy: "heavy snow" }, tint: null, indoors: true, takesIntensity: true },
  };

  // ── The ground substitution ────────────────────────────────────────────────
  // Snow is the one word that changes what you STAND on rather than the light
  // over it, and this is the whole mechanism: a paint-time rename, read by the
  // renderer's zone composite and by nothing else. The zone arrays are never
  // touched — a compiled world holds `grass` in January exactly as it does in
  // July, and the substitution lives in the picture.
  //
  // KEYED BY WORD, NOT INTENSITY, deliberately: the snow ground is binary. A
  // flurry and a blizzard stand on the same white tiles, and what tells them
  // apart is how much is falling and how dark the sky sits — the intensity
  // reaches the header label, the rain tint and the particle pass, and stops.
  //
  // WHAT IS NOT HERE IS THE DESIGN. Paths, roads and stone stay bare because a
  // trodden way is the first thing to clear; `dirt` stays bare too, and the
  // snowed-crop-beside-bare-dirt seam at a field edge is the accepted price of
  // that; water STAYS WATER, because it is liquid and fishable and a frozen
  // pond is a mechanic nobody has asked for.
  const SUBS = {
    snow: { grass: "grassSnow", grass2: "grassSnow2", crop: "cropSnow", canopy: "canopySnow" },
  };

  // ── Defensive resolution ───────────────────────────────────────────────────
  /** The world's axes, or the legacy defaults. Every table read in this module
   *  goes through here or through PF.own: a world object can arrive from a save
   *  path, a degrade arm or a console, and `LAT_META[undefined]` is the read
   *  that turns a missing stamp into NaN weather instead of temperate weather. */
  function axesOf(world) {
    return {
      latitude: PF.own(LAT_META, world?.latitude) ? world.latitude : "temperate",
      precipitation: PF.own(PRECIP_META, world?.precipitation) ? world.precipitation : "moderate",
    };
  }

  /** A day the calendar arithmetic is total for. `day` is a plain incrementing
   *  int minted at 1 and the save path already clamps it, but a console, a
   *  hostile row or a future caller can hand this anything — and the modulo below
   *  wants an exact integer, so the ceiling keeps `day - 1 + dayOffset` inside
   *  safe-integer range rather than trusting the caller's arithmetic. */
  function dayOf(day) {
    const n = Math.trunc(Number(day));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, Number.MAX_SAFE_INTEGER - TUNING.yearDays);
  }

  /** Where a day falls in this world's own year. The phase is per-seed and runs
   *  the FULL year, which subsumes the hemisphere question entirely: "southern"
   *  and "day 1 lands in autumn" are the same fact, and one offset says both. */
  function calendarOf(world, day) {
    const band = LAT_META[axesOf(world).latitude];
    const names = SEASON_SETS[band.structure];
    const n = names.length;
    const d = dayOf(day);
    const offset = PF.hashStr(`${(world?.seed ?? 0) >>> 0}|calendar`) % TUNING.yearDays;
    // `doy` is non-negative because `day >= 1` holds above — the unsigned hash
    // only makes `offset >= 0`, and offset CAN be zero.
    const doy = (d - 1 + offset) % TUNING.yearDays;
    return { d, doy, n, names, idx: Math.floor((doy * n) / TUNING.yearDays) };
  }

  /** The season ORDINAL — the form every table read spends. The floor form
   *  partitions the year into n spans (four: 92/91/91/91; two: 183/182) and a
   *  season never straddles the year boundary, so there is no boundary table to
   *  keep in step with anything. */
  function seasonIndex(world, day) {
    return calendarOf(world, day).idx;
  }

  /** The season WORD — display and pack-facing text only. */
  function season(world, day) {
    const c = calendarOf(world, day);
    return c.names[c.idx];
  }

  /** The first day of the season `day` falls in, FLOORED AT DAY 1. The full-year
   *  offset lands almost every world's day 1 mid-season (361 of 365 offsets on a
   *  four-season world), so an unfloored answer names days before the world
   *  existed — up to 182 of them, measured.
   *
   *  WHAT THE FLOOR BUYS, said honestly rather than overclaimed: the RETURNED
   *  DAY is a day somebody could have lived, and the ledger's first-of-season
   *  scan costs the season rather than the year. It does NOT change the scan's
   *  answer, because dayOf() clamps a sub-1 day to 1 as well — an unfloored scan
   *  would re-read day 1 up to 182 times over and reach the same verdict. Walked
   *  across 1478 snow crossings (5 latitudes x 3 precipitations x 6 seeds x 400
   *  days), floored and unfloored differ on none.
   *
   *  So "first" means first OF THE DAYS THE WORLD HAS LIVED, which is the honest
   *  scope and the one player-state states. Every day the scan feeds back into
   *  at() is >= 1 again, so the totality argument above holds unchanged. Callers
   *  derive their bound FROM HERE and never by hand: under a 365-day year a
   *  hand-derived season length is wrong by up to 182 days. */
  function seasonStartDay(world, day) {
    const c = calendarOf(world, day);
    const firstDoy = Math.ceil((c.idx * TUNING.yearDays) / c.n);
    return Math.max(1, c.d - (c.doy - firstDoy));
  }

  // ── The derivation ─────────────────────────────────────────────────────────
  /** THE WET MASS, and it has exactly ONE HOME. Both `weightsFor` (which splits
   *  it into snow and rain) and the intensity draw (whose heavy/light threshold
   *  derives from it) call this function, and neither recomputes the product
   *  inline. That is the whole point: a `PRECIP_META` or phase retune lands in
   *  one place and moves both consumers together, where two copies would let a
   *  monsoon get wetter and softer at the same time with every assert still
   *  green.
   *
   *  PRECONDITION, named so a fourth caller inherits it deliberately:
   *  `seasonIndex` must be in range for THIS latitude's own structure.
   *  `TEMP_PHASE.two[3]` is undefined and NaNs the whole row, and the boot assert
   *  walks only in-range pairs so it cannot see one. All three callers today
   *  derive the index from the same latitude's season set. */
  function wetMass(latitude, precipitation, index) {
    const band = PF.own(LAT_META, latitude) ?? LAT_META.temperate;
    const wetness = (PF.own(PRECIP_META, precipitation) ?? PRECIP_META.moderate).wetness;
    return wetness * WET_PHASE[band.structure][index];
  }

  /** The day's odds as a weight row over WORDS. ONE derivation replaces every
   *  hand-written per-climate table, and the temperature is spent CONTINUOUSLY —
   *  as a magnitude through two clamped ramps, not as one bit.
   *
   *  `cold` is the snow SHARE of the wet mass, so `snow + rain` is identically
   *  the wet mass and only the storm term lets latitude touch how often the
   *  streets empty. `warmHalf` is the storm gate: convective violence needs real
   *  warmth, which is why a polar year cannot produce a thunderstorm at any
   *  precipitation and in any season.
   *
   *  THE RETURN ROW IS THE ROW. Nothing else rides in it — the boot assert walks
   *  every key of every row against WORDS, and a convenience field smuggled in
   *  here would red the whole product at load. */
  function weightsFor(latitude, precipitation, index) {
    const band = PF.own(LAT_META, latitude) ?? LAT_META.temperate;
    const t = band.warmth + band.swing * TEMP_PHASE[band.structure][index];
    const w = wetMass(latitude, precipitation, index);
    const cold = PF.clamp((TUNING.freezePoint - t) / TUNING.mixBand, 0, 1);
    const warmHalf = PF.clamp((t - TUNING.stormFloor) / TUNING.stormBand, 0, 1);
    const rain = w * (1 - cold);
    return {
      fair: TUNING.fairBase + TUNING.fairDry * Math.max(0, TUNING.dryPivot - w),
      overcast: TUNING.overcastBase + TUNING.overcastWet * w,
      rain,
      storm: rain * TUNING.stormShare * warmHalf,
      snow: w * cold,
    };
  }

  /** EVERY SKY A CLIMATE CAN PRODUCE, in WORDS order: the union of the words
   *  carrying a non-zero weight across this latitude's own season set. It lives
   *  here, beside the derivation it reads, for `wetMass`'s reason — the digest
   *  that tells a generation which weather to write lines for has to describe the
   *  same sky `at()` will draw, and a hand table saying "the tropics get no snow"
   *  is an opinion a coefficient retune falsifies silently while every assert
   *  stays green. Through the derivation it is arithmetic, and it moves when the
   *  arithmetic does.
   *
   *  It walks the season set of THIS band's structure, which is the precondition
   *  `wetMass` states: an index out of range for the band NaNs the whole row. A
   *  latitude the table does not know folds to temperate, the same fallback
   *  `axesOf` and `weightsFor` already spend. */
  function wordsFor(latitude, precipitation) {
    const band = PF.own(LAT_META, latitude) ?? LAT_META.temperate;
    const seen = new Set();
    for (let index = 0; index < SEASON_SETS[band.structure].length; index++) {
      const row = weightsFor(latitude, precipitation, index);
      for (const word of WORDS) if (row[word] > 0) seen.add(word);
    }
    return WORDS.filter((word) => seen.has(word));
  }

  /** One weighted pick off a weight row, in WORDS order so the walk is stable. */
  function drawWord(row, roll) {
    let sum = 0;
    for (const word of WORDS) sum += row[word];
    let cut = roll * sum;
    for (const word of WORDS) {
      cut -= row[word];
      if (cut < 0) return word;
    }
    // Unreachable: `roll` is in [0,1) and the sum is at least
    // fairBase + overcastBase, two independent floors no axis input can zero. If
    // a retune ever takes both to nothing, fair is the honest answer.
    return WORDS[0];
  }

  /** Is this override the authority for `day`? A DAY-RANGE predicate, because the
   *  live day moves BACKWARD on the rewind path: rewinding INTO an override's
   *  range must re-arm it (the sky at day D is what it was the first time through
   *  day D), while rewinding to before it was ever set must not. `sinceDay`
   *  defaults to 1 and `untilDay` to forever. */
  function overrideLive(override, day) {
    if (!override || typeof override !== "object") return false;
    if (!WORDS.includes(override.word)) return false;
    return (override.sinceDay ?? 1) <= day && day <= (override.untilDay ?? Infinity);
  }

  /** THE SKY AT A DAY: `{word, intensity}`, intensity null for words that take
   *  none. A pure function of (world seed, day, override) — day-grain, zero save
   *  fields, and rewind-exact for the same reason the quest board is.
   *
   *  DRAW ORDER, and it is deliberate: the WORD draw is always made and simply
   *  discarded when an override covers the day, and the INTENSITY draw is always
   *  second. So an override naming the very word the derivation rolled cannot
   *  flip the day's intensity, and the live path and the ledger's first-of-season
   *  scan consume the stream identically. Words that take no intensity consume no
   *  second draw — the stream is day-local, so that costs nothing anywhere.
   *
   *  A FRESH OBJECT EVERY CALL, which the transition compare depends on: a
   *  consumer that compared the returned objects by reference would see a change
   *  every single day. Compare `.word`. */
  function at(world, day, override) {
    const { latitude, precipitation } = axesOf(world);
    const d = dayOf(day);
    const index = calendarOf(world, d).idx;
    const rng = PF.rng(PF.hashStr(`${(world?.seed ?? 0) >>> 0}|weather|${d}`));
    const drawn = drawWord(weightsFor(latitude, precipitation, index), rng());
    const live = overrideLive(override, d) ? override : null;
    const word = live ? live.word : drawn;
    const meta = WORD_META[word];
    let intensity = null;
    if (meta.takesIntensity) {
      if (live && typeof live.intensity === "string" && INTENSITIES.includes(live.intensity)) {
        // A GM who said "heavy rain" gets exactly that.
        intensity = live.intensity;
      } else {
        // …and a GM who just said "rain" gets a day-stable intensity for free,
        // off the same axes the odds came from: wet worlds rain harder, and
        // desert rain is almost always light.
        const share = Math.min(TUNING.heavyMax, TUNING.heavyBase * wetMass(latitude, precipitation, index));
        intensity = rng() < share ? "heavy" : "light";
      }
    }
    return { word, intensity };
  }

  /** The header's wire text for a sky. */
  function labelFor(word, intensity) {
    const meta = PF.own(WORD_META, word) ?? WORD_META.fair;
    if (!meta.takesIntensity) return meta.label;
    return PF.own(meta.label, intensity) ?? meta.label.light;
  }

  // ── The GM override slot ───────────────────────────────────────────────────
  // WRITTEN BY NOTHING IN THIS RELEASE except a console, deliberately: the host
  // dispatches `onHostEvent` on engine-defined type strings only, so there is no
  // surface for a real writer to sit on yet (that is the feature request's).
  // What exists is the READ side, whole and verifiable, and the incantation is
  // TWO lines — the runtime slot is a sim field, and the town only re-places on
  // a resolve:
  //
  //     core.sim.weatherOverride = { word: "storm" };
  //     core.sim.resolveSchedules();
  //
  // Any of the five words; rain and snow take an optional `intensity: "heavy"`.
  // The renderer answers on the next frame either way — only the schedule bias
  // needs the second line. A console write touches the RUNTIME slot only:
  // metadata stays untouched, which is exactly right for a throwaway check, and
  // the mid-session reconciler compares metadata against its own applied memo so
  // no props delivery claws the summoned sky back.
  /** Fold a raw `pixelforgeWeather` metadata row into an override, or null.
   *
   *  FOLD, NEVER THROW, AND NEVER WRITE BACK. The key is chat metadata, which is
   *  per-key shallow-merge PATCH territory: a word from a build that has not
   *  shipped yet folds to "no override" FOR THIS RUNTIME ONLY and the stored row
   *  survives verbatim for the build that understands it. This is the whole
   *  forward-compat argument, and it is the pack key's own, in its own words.
   *
   *  An intensity on a word that takes none is DROPPED and the row survives — a
   *  GM who wrote `{word: "storm", intensity: "heavy"}` meant a storm. */
  function foldOverride(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const word = PF.own(raw, "word");
    if (typeof word !== "string" || !WORDS.includes(word)) return null;
    const row = { word };
    const intensity = PF.own(raw, "intensity");
    if (WORD_META[word].takesIntensity && typeof intensity === "string" && INTENSITIES.includes(intensity))
      row.intensity = intensity;
    const since = positiveDay(PF.own(raw, "sinceDay"));
    if (since !== null) row.sinceDay = since;
    const until = positiveDay(PF.own(raw, "untilDay"));
    if (until !== null) row.untilDay = until;
    return row;
  }

  function positiveDay(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value : null;
  }

  /** The comparand the mid-session reconciler memoises: the SERIALIZED WHOLE of a
   *  folded override, never the word alone. A console change from
   *  `{word:"storm"}` to `{word:"storm", intensity:"heavy"}` is this release's
   *  documented verification incantation, and a word-only key would sit on it
   *  until the day rolled. */
  function overrideKey(override) {
    if (!override || typeof override !== "object") return "";
    return `${override.word ?? ""}|${override.intensity ?? ""}|${override.sinceDay ?? ""}|${override.untilDay ?? ""}`;
  }

  // ── The axis mint ──────────────────────────────────────────────────────────
  /** One band off one distribution, on one named side stream. */
  function mintAxis(hint, list, weights, stream) {
    // The brief's hint wins when it names a real band. A hostile or unknown hint
    // is not defaulted — it simply is not a hint, and the roll below owns the
    // axis, which is the richer answer than pinning a word nobody wrote.
    if (typeof hint === "string" && list.includes(hint)) return hint;
    const rnd = PF.rng(PF.hashStr(stream));
    const weightOf = (band) => Math.max(0, PF.own(weights, band) ?? 0);
    let sum = 0;
    for (const band of list) sum += weightOf(band);
    let cut = rnd() * sum;
    for (const band of list) {
      cut -= weightOf(band);
      if (cut < 0) return band;
    }
    // Unreachable while the row sums positive, which the boot assert pins.
    return list.find((band) => weightOf(band) > 0) ?? list[0];
  }

  /** THE ONE AUTHORITY FOR A WORLD'S CLIMATE. Per axis: the brief's hint when it
   *  names a real band, else a weighted draw from the theme's distribution on
   *  THAT AXIS'S OWN SIDE STREAM.
   *
   *  TWO NAMED STREAMS, ONE PER AXIS, and the discipline is 20-world's own, in
   *  its own words: "a side stream, so minting residents does not shift the tile
   *  RNG under the ground cover and every world that had no minting still lays
   *  the same grass." The main `PF.rng(seed)` stream and every existing side
   *  stream are untouched, so EVERY EXISTING SEED KEEPS ITS EXACT LAYOUT and
   *  gains a climate — and a brief that pins one axis never moves the other's
   *  roll, because the two rolls do not share a stream.
   *
   *  PURE, which is what lets the compile stamp and the digest door describe the
   *  same sky BY CONSTRUCTION rather than by whichever world happened to be
   *  standing. It is also why a future distribution retune re-skies existing
   *  UNPINNED worlds on their next load — the accepted rolling-compat class, and
   *  one more reason the brief hint exists. */
  function axesFor(brief, seed, theme) {
    // Through PF.own so the fallback is REACHABLE — a theme named "constructor"
    // answers a bare read with a function, and `LAT_META[undefined]` is one line
    // further on. The same guard 20-world's resident name book already spends.
    const row = PF.own(THEME_AXES, theme) ?? THEME_AXES["cozy-village"];
    const key = seed >>> 0;
    return {
      latitude: mintAxis(PF.own(brief, "latitude"), LATITUDES, row.latitude, `${key}|climate|lat`),
      precipitation: mintAxis(PF.own(brief, "precipitation"), PRECIPS, row.precipitation, `${key}|climate|precip`),
    };
  }

  return {
    LATITUDES,
    PRECIPS,
    LAT_META,
    PRECIP_META,
    SEASON_SETS,
    TEMP_PHASE,
    WET_PHASE,
    THEME_AXES,
    WORDS,
    INTENSITIES,
    WORD_META,
    SUBS,
    TUNING,
    axesFor,
    axesOf,
    season,
    seasonIndex,
    seasonStartDay,
    wetMass,
    weightsFor,
    wordsFor,
    at,
    labelFor,
    foldOverride,
    overrideKey,
    overrideLive,
  };
})();

// Vocabulary completeness, in the placers' idiom (20-world PLACERS, 59-economy's
// catch tables): every table this module ships is paired against the enum it is
// keyed by, at load, inside the bundle's own IIFE. A pairing that only failed at
// the read site would fail as `undefined` weather on somebody's world, months
// later, on the one band nobody plays.
{
  const W = PF.weather;
  const say = (message) => {
    throw new Error(`pixelforge: ${message}`);
  };
  const keys = (map) => Object.keys(map);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);

  // ── Pairings ───────────────────────────────────────────────────────────────
  for (const band of W.LATITUDES) if (!PF.own(W.LAT_META, band)) say(`latitude "${band}" has no LAT_META row`);
  for (const band of keys(W.LAT_META))
    if (!W.LATITUDES.includes(band)) say(`LAT_META names a latitude "${band}" the axis does not`);
  for (const band of W.LATITUDES) {
    const row = W.LAT_META[band];
    if (!finite(row.warmth) || !finite(row.swing)) say(`latitude "${band}" has no finite warmth/swing`);
    if (!PF.own(W.SEASON_SETS, row.structure)) say(`latitude "${band}" names a season structure "${row.structure}"`);
  }
  for (const band of W.PRECIPS) if (!PF.own(W.PRECIP_META, band)) say(`precipitation "${band}" has no PRECIP_META row`);
  for (const band of keys(W.PRECIP_META))
    if (!W.PRECIPS.includes(band)) say(`PRECIP_META names a precipitation "${band}" the axis does not`);
  for (const band of W.PRECIPS)
    if (!finite(W.PRECIP_META[band].wetness)) say(`precipitation "${band}" has no finite wetness`);

  // The phase tables, paired against the season sets BY LENGTH. An index-keyed
  // table that is one entry short computes NaN for the season it is missing and
  // for nothing else, which is the least findable failure in the module.
  for (const structure of keys(W.SEASON_SETS)) {
    const n = W.SEASON_SETS[structure].length;
    for (const [name, table] of [
      ["TEMP_PHASE", W.TEMP_PHASE],
      ["WET_PHASE", W.WET_PHASE],
    ]) {
      const row = PF.own(table, structure);
      if (!Array.isArray(row) || row.length !== n)
        say(`${name}.${structure} has ${row?.length} entries for ${n} seasons`);
      if (!row.every(finite)) say(`${name}.${structure} holds a non-finite entry`);
    }
  }
  // The name has to be true of the numbers.
  if (!(W.WET_PHASE.two[0] > W.WET_PHASE.two[1])) say("the wet season is not wetter than the dry one");

  // ── The weather words ──────────────────────────────────────────────────────
  for (const word of W.WORDS) if (!PF.own(W.WORD_META, word)) say(`weather "${word}" has no WORD_META row`);
  for (const word of keys(W.WORD_META))
    if (!W.WORDS.includes(word)) say(`WORD_META names a weather "${word}" the axis does not`);
  for (const word of W.WORDS) {
    const row = W.WORD_META[word];
    if (typeof row.indoors !== "boolean") say(`weather "${word}" has no indoors flag`);
    // THE FLAG IS THE AUTHORITY, not a sentence in this assert: whichever words
    // carry `takesIntensity` are the words that must carry per-intensity wire
    // text — and per-intensity TINT alphas too, wherever such a word tints at
    // all. A missing heavy alpha would ship "heavy rain looks exactly like light
    // rain", which is a promise this release makes out loud.
    if (!row.takesIntensity) {
      if (typeof row.label !== "string" || !row.label) say(`weather "${word}" has no label`);
      continue;
    }
    for (const level of W.INTENSITIES) {
      if (typeof PF.own(row.label, level) !== "string" || !row.label[level])
        say(`weather "${word}" has no "${level}" label`);
      if (row.tint != null && typeof PF.own(row.tint, level) !== "string")
        say(`weather "${word}" tints but has no "${level}" tint`);
    }
  }

  // ── The ground substitution ────────────────────────────────────────────────
  // Both halves of every row are painter ids, and 10-art answers an id it does
  // not know with the GRASS painter — so a typo here is not a crash, it is a
  // green square in the middle of a snowfield, on the one kind of day the table
  // exists for. `painterNames()` is exported for exactly this comparison.
  {
    const painters = new Set(PF.art?.painterNames?.() ?? []);
    for (const [word, map] of Object.entries(W.SUBS)) {
      if (!W.WORDS.includes(word)) say(`SUBS keys on a weather "${word}" the axis does not name`);
      for (const [from, to] of Object.entries(map)) {
        if (!painters.has(from)) say(`SUBS substitutes a tile "${from}" the art module cannot paint`);
        if (!painters.has(to)) say(`SUBS.${word} names a painter "${to}" the art module does not have`);
      }
    }
  }

  // ── Distributions ──────────────────────────────────────────────────────────
  // Every theme this build ships must have a climate. A ZERO OR OMITTED BAND IS
  // DATA, not an error — cozy rolls no polar, and that is the distribution
  // speaking — so the demand is a positive SUM and nothing narrower.
  for (const theme of PF.art?.themeIds?.() ?? []) {
    const entry = PF.own(W.THEME_AXES, theme);
    if (!entry) say(`theme "${theme}" has no THEME_AXES entry`);
    for (const [axis, list] of [
      ["latitude", W.LATITUDES],
      ["precipitation", W.PRECIPS],
    ]) {
      const row = PF.own(entry, axis);
      if (!row || typeof row !== "object") say(`theme "${theme}" has no ${axis} distribution`);
      let sum = 0;
      for (const band of keys(row)) {
        if (!list.includes(band)) say(`theme "${theme}" weights a ${axis} "${band}" the axis does not name`);
        if (!finite(row[band]) || row[band] < 0) say(`theme "${theme}" weights ${axis} "${band}" at ${row[band]}`);
        sum += row[band];
      }
      if (!(sum > 0)) say(`theme "${theme}" has no ${axis} band it can ever roll`);
    }
  }

  // ── THE DERIVATION, WALKED WHOLE ───────────────────────────────────────────
  // Every (latitude x precipitation x that latitude's own seasons) — 48 rows: two
  // two-season bands at 3 x 2, three four-season bands at 3 x 4. The count is
  // asserted because a walk that quietly stopped covering a band would be a green
  // run over an untested sky.
  //
  // WHAT EACH CLAUSE BUYS, honestly: FINITENESS is the real catch — it is what
  // turns a phase-table keying mistake into a named boot failure instead of NaN
  // weather. Key membership catches a typo'd word. The positive-sum clause is
  // unfalsifiable for any axis input, since fair and overcast both have positive
  // floors no cell can reach — it guards a coefficient retune that zeroes both
  // bases, and nothing else.
  const rowsByBand = new Map();
  let walked = 0;
  for (const latitude of W.LATITUDES) {
    const seasons = W.SEASON_SETS[W.LAT_META[latitude].structure];
    const serialized = [];
    for (const precipitation of W.PRECIPS) {
      for (let index = 0; index < seasons.length; index++) {
        const row = W.weightsFor(latitude, precipitation, index);
        const where = `${latitude}/${precipitation}/${seasons[index]}`;
        let sum = 0;
        for (const word of keys(row)) {
          if (!W.WORDS.includes(word)) say(`the ${where} weight row carries a word "${word}"`);
          if (!finite(row[word]) || row[word] < 0) say(`the ${where} weight row has ${word} at ${row[word]}`);
          sum += row[word];
        }
        if (!(sum > 0)) say(`the ${where} weight row has no sky at all`);
        serialized.push(W.WORDS.map((word) => `${word}:${row[word].toFixed(6)}`).join(","));
        walked++;
      }
    }
    rowsByBand.set(latitude, serialized.join(" | "));
  }
  if (walked !== 48) say(`the derivation walk covered ${walked} rows, not the axis product's 48`);

  // DEGENERACY. Five bands have to buy five skies: no two latitudes sharing a
  // season structure may produce IDENTICAL row sets across their whole
  // (precipitation x season) product. AT LEAST ONE DIFFERING CELL is the correct
  // strength and it must not be tightened — subpolar and polar genuinely share
  // their three winter cells (both saturate `cold`, both at the same wet mass),
  // because the winter-heavy edge and the frozen pole are different YEARS, not
  // different winters. Covering latitude alone is sound rather than an asymmetry:
  // overcast is strictly monotone in the wet mass, so a precipitation collapse
  // would show up as a literally duplicated wetness number in a three-row table,
  // where latitude reaches the row through two clamps that can hide one.
  for (const a of W.LATITUDES)
    for (const b of W.LATITUDES) {
      if (a >= b) continue;
      if (W.LAT_META[a].structure !== W.LAT_META[b].structure) continue;
      if (rowsByBand.get(a) === rowsByBand.get(b)) say(`latitudes "${a}" and "${b}" produce the same sky all year`);
    }
}
