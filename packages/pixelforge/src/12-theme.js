// Resolve the unsealed world's visual kit from the Engine's Setting text.
// Generated briefs may choose a supported artTheme; their sealed theme remains
// authoritative afterward. Legacy explicit theme selections keep their reader.
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

/** THE SUFFIXES A LEXICON WORD IS ALLOWED TO GROW, and this list is the whole
 *  cost of matching on prefixes at all.
 *
 *  A bare `startsWith` mis-kits ordinary English, and it does it in the one
 *  direction that matters: `cozy-village` scores ZERO on most prose that is not
 *  explicitly about farms and inns, so a single stray token flips the answer.
 *  Measured against the shipped lexicon — "hab", "dome" and "crew" are all in it
 *  — "Domestic and slow" reads as a space colony, so does "habitually … a habit
 *  of centuries", and so does "a crewel-work shop". The first of those is the
 *  maintainer's own worked example rendered as a hab ring.
 *
 *  Exact-token matching fixes those three and breaks more than it fixes:
 *  "coloni", "hydroponic", "terraform" and "innkeep" are deliberate STEMS, and
 *  exact matching silently retires all four — "colonies", "terraforming",
 *  "hydroponics" and "innkeeper" would stop voting. A minimum prefix length is
 *  no better: it loses "domes", "crews" and "domed", and its passes on the cozy
 *  side are the default masking a miss rather than a detection.
 *
 *  So the prefix stays and the REMAINDER is checked: `dome` + `s` is a dome,
 *  `dome` + `stic` is not. Four matchers were run against the three
 *  counterexamples, suffix-only prose and short-word plurals; this is the only
 *  one that took all three sets. The trade is stated rather than assumed — the
 *  list is a closed vocabulary, so a real word ending this list does not carry
 *  ("domelike", say) is a miss, and the answer to a miss is to add the suffix
 *  here rather than to loosen the match.
 *
 *  THE `-ion` FAMILY IS HERE BECAUSE THE FIRST CUT OF THIS LIST LOST THE COLONY
 *  NOUN, and that is the shape of the mistake worth naming: bounding the
 *  remainder traded a false-POSITIVE class for a false-NEGATIVE one, and only
 *  the half it was aiming at got measured. `colonisation`, `colonization` and
 *  `habitation` are the noun forms of the three most on-theme words in the
 *  lexicon, and every one of them scored zero — so "Colonization of Mars, one
 *  habitation module at a time." came out a cozy village. Measured over the
 *  whole lexicon, this family turns 18 tokens ON and none off. Two spellings of
 *  each, because the STEM decides the remainder: `coloni` + `sation`, but
 *  `robot` + `ised`.
 *
 *  Two suffixes were measured and DELIBERATELY LEFT OUT. `ary` recovers
 *  `stationary` and re-opens the exact false-positive class this list exists to
 *  close — "The cart stood stationary in the rain." reads as a space colony.
 *  `like` recovers `domelike` and nothing else, and the paragraph above already
 *  carries that one as the acknowledged miss. The collateral that IS accepted is
 *  `alienation` and `oxygenation`: both stems already vote colony bare, so
 *  neither is a new class, only a new inflection of an old one. */
const SUFFIX =
  /^(s|es|ed|d|ing|er|ers|ies|y|st|sts|ist|ists|land|lands|house|houses|hand|hands|man|men|folk|side|smith|keeper|keepers|al|ic|ics|ion|ions|ation|ations|sation|sations|zation|zations|sing|zing|sed|zed|ising|izing|ised|ized)$/;
/** `st`/`sts`/`ist`/`ists` are in the set for `colonist` = `coloni` + `st`,
 *  which is the multi-line lane's own word; without them that lane passes only
 *  because `dome` and `airlock` also hit, which is a lane passing for the wrong
 *  reason. */
const matches = (token, word) => token === word || (token.startsWith(word) && SUFFIX.test(token.slice(word.length)));

/** Tokens rather than substrings, and then a bounded prefix on top of that. A
 *  token counts once for a kit however many of that kit's words it matches —
 *  `hits++` sits outside `words.some(…)` and counts the TOKEN, not the word.
 *
 *  THAT RULE IS UNOBSERVABLE TODAY, AND THE COMMENT USED TO CLAIM OTHERWISE.
 *  It offered "hydroponics domes is two votes and not four" as its worked
 *  example, which is simply false: `hydroponics` fires `hydroponic` and nothing
 *  else, `domes` fires `dome` and nothing else, so that phrase is two votes
 *  under either counting rule. A review round then read the rule as an untested
 *  claim and set out to pin it, on "a colony village" — also false, because
 *  `colony` and the stem `coloni` diverge at their sixth letter and no token
 *  starts with both.
 *
 *  The precondition, measured over the whole lexicon: both arms of `matches`
 *  require the token to START WITH the word, so a token can only fire two words
 *  of one kit if one of those words is a prefix of the other. Exactly one such
 *  pair exists — `hab` inside `habitat` — and its remainder, "itat", is not in
 *  SUFFIX, so nothing fires both. Swept across every word × every suffix, the
 *  most words of one kit any generated token fires is ONE.
 *
 *  So the rule is a guard against a lexicon that does not exist yet, and the
 *  harness carries no lane for it because every lane would pass with `some` and
 *  without it. THE EDIT THAT ENDS THAT: adding a word whose own kit already
 *  carries a prefix of it with a live suffix between them — `colonies` beside
 *  `coloni`, say, or `habitation` beside `hab` if `itation` ever joined SUFFIX.
 *  On the day that lands, the rule starts deciding real sentences ("a colonies
 *  village" would tie under it and go sci-fi without it) and wants a lane. */
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
    for (const token of tokens) if (words.some((word) => matches(token, word))) hits++;
    // STRICTLY greater, so a tie keeps the incumbent and nothing wins by being
    // first in the table: a tie and zero hits both land on cozy-village.
    if (hits > bestHits) {
      best = theme;
      bestHits = hits;
    }
  }
  return best;
};

PF.theme = { themeFromWords, kitIds: () => Object.keys(KIT_WORDS) };
