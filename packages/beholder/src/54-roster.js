// ── The roster: who the panel shows, and in what order ──────────────────────
//
// A long scene accumulates people — a barman named once, a guard, someone's horse —
// and the panel gives each of them a tab whether or not anyone cares. The reference
// extension answers that with a characters view: hide the ones you are not tracking,
// drag the ones you are into the order you think in, and merge the duplicates the
// extractor spelled two ways.
//
// Scope worth being explicit about: this is presentation. Hiding someone does not stop
// the extractor tracking them, and merging two names here does not teach it they are
// the same person — it just stops the panel showing them twice. The view says so,
// because a control that looks like it changes extraction and does not is worse than
// no control.
//
// Stored per chat in localStorage, next to the locks, for the same reason: it is a
// per-operator display choice, not part of the state the next prompt is built from.

BH.roster = {
  key(chatId) {
    return `marinara.beholder.roster.${chatId}`;
  },

  all(chatId = BH.dock.chatId) {
    if (!chatId) return { hidden: [], order: [], aliases: {} };
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.key(chatId)) || "{}") || {};
      return {
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        order: Array.isArray(parsed.order) ? parsed.order : [],
        aliases: parsed.aliases && typeof parsed.aliases === "object" ? parsed.aliases : {},
      };
    } catch {
      return { hidden: [], order: [], aliases: {} };
    }
  },

  save(next, chatId = BH.dock.chatId) {
    if (!chatId) return;
    try {
      window.localStorage.setItem(this.key(chatId), JSON.stringify(next));
    } catch {
      // A full or blocked store costs the preference, not the panel.
    }
  },

  setHidden(name, hidden) {
    const data = this.all();
    const set = new Set(data.hidden);
    if (hidden) set.add(name);
    else set.delete(name);
    data.hidden = [...set];
    this.save(data);
  },

  setOrder(order) {
    const data = this.all();
    data.order = order;
    this.save(data);
  },

  /** Merge `variant` into `canonical` for display. */
  addAlias(variant, canonical) {
    if (!variant || !canonical || variant.toLowerCase() === canonical.toLowerCase()) return;
    const data = this.all();
    data.aliases[variant] = canonical;
    this.save(data);
  },

  removeAlias(variant) {
    const data = this.all();
    delete data.aliases[variant];
    this.save(data);
  },

  /** Names merged into this one. */
  variantsOf(name, data = this.all()) {
    return Object.entries(data.aliases)
      .filter(([, canonical]) => canonical === name)
      .map(([variant]) => variant);
  },

  /**
   * The names to show, in the operator's order, with hidden ones separated.
   *
   * Applied by the dock when it builds its character tabs, so every surface agrees on
   * who is on screen.
   */
  arrange(names) {
    const data = this.all();
    const hidden = new Set(data.hidden);
    // A merged variant is not its own row; it belongs to the name it was merged into.
    const merged = new Set(Object.keys(data.aliases).filter((variant) => names.includes(data.aliases[variant])));
    const remaining = names.filter((name) => !merged.has(name));
    const ordered = [
      ...data.order.filter((name) => remaining.includes(name)),
      ...remaining.filter((name) => !data.order.includes(name)),
    ];
    return {
      visible: ordered.filter((name) => !hidden.has(name)),
      hidden: ordered.filter((name) => hidden.has(name)),
    };
  },
};
