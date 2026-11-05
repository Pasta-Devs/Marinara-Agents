// Build Wardrobe: a one-shot, user-triggered LLM generation of new items +
// outfits from a free-text style direction (see server.mjs's
// generateWardrobeProposal/applyGeneratedWardrobe for the actual generation
// and commit logic). Attaches onto QM.dock (built in 10-dock.js) rather
// than being folded into that already-large file -- cross-file references
// work fine here since everything below only ever runs from event-handler
// closures, well after the whole bundle has finished loading (same pattern
// 15-panel.js already relies on for constants defined in 90-element.js).
//
// No per-item editing in this first version -- Confirm/Retry/Cancel only,
// matching exactly what was asked for. A future version could let someone
// uncheck individual proposed items/outfits before confirming.

// Friendlier text for the known server-side failure codes (raw codes come
// through as the thrown Error's own .message -- see qmRequest's own
// (body?.error) fallback in 00-api.js); anything else (e.g. the 400
// "A style direction is required" validation message) is already
// human-readable and passes through unchanged.
const QM_WARDROBE_ERROR_MESSAGES = {
  truncated: "The response was too long — try a shorter or simpler direction.",
  "no-connection": "No language model connection is available for this chat.",
  "generation-failed": "The wardrobe could not be generated. Try again.",
};

Object.assign(QM.dock, {
  _wardrobeDirection: "",
  _wardrobeIncludePersonaContext: true,
  _wardrobeViewState: "form", // "form" | "loading" | "preview" | "hidden" | "error"
  _wardrobeProposal: null,
  // Hidden items the proposal would use (server.mjs's wardrobeHiddenMatches)
  // and what the user picked for each: { [itemId]: { action, show } }.
  _wardrobeHiddenMatches: [],
  _wardrobeHiddenChoices: {},
  _wardrobeError: null,
  _wardrobeSummary: null,
  _wardrobeContentContainer: null,
  // Bumped every time the modal closes (including the close-then-reopen
  // _openWardrobeBuilder already does) -- lets _submitWardrobeGeneration tell
  // a still-in-flight generation from a previous session apart from the
  // current one, so a stale response can't overwrite what the user's looking
  // at now.
  _wardrobeSessionToken: 0,

  _openWardrobeBuilder() {
    this._closeWardrobeBuilder();
    this._wardrobeViewState = "form";
    this._wardrobeProposal = null;
    this._wardrobeHiddenMatches = [];
    this._wardrobeHiddenChoices = {};
    this._wardrobeError = null;
    this._wardrobeSummary = null;

    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      boxSizing: "border-box",
      zIndex: "30",
    });
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) this._closeWardrobeBuilder();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "var(--card, #1c1c1c)",
      border: `1px solid ${QM_COLOR_SUCCESS}`,
      borderRadius: "var(--radius, 6px)",
      padding: "12px",
      width: "min(360px, 100%)",
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
    const title = document.createElement("strong");
    title.textContent = "Build Wardrobe";
    title.style.fontSize = "13px";
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.addEventListener("click", () => this._closeWardrobeBuilder());
    header.append(title, closeButton);

    const contentContainer = document.createElement("div");
    Object.assign(contentContainer.style, { display: "flex", flexDirection: "column", gap: "8px" });
    this._wardrobeContentContainer = contentContainer;

    panel.append(header, contentContainer);
    backdrop.appendChild(panel);
    this.wardrobeBuilderBackdrop = backdrop;
    (this.root || this.body).appendChild(backdrop);
    this._wardrobeEscapeHandler = this._bindEscapeClose(() => this._closeWardrobeBuilder());

    this._renderWardrobeBuilderContent();
  },

  _closeWardrobeBuilder() {
    this._wardrobeSessionToken++;
    this.wardrobeBuilderBackdrop?.remove();
    this.wardrobeBuilderBackdrop = null;
    this._wardrobeContentContainer = null;
    this._unbindEscapeClose(this._wardrobeEscapeHandler);
    this._wardrobeEscapeHandler = null;
  },

  _renderWardrobeBuilderContent() {
    if (!this._wardrobeContentContainer) return;
    const node =
      this._wardrobeViewState === "loading"
        ? this._renderWardrobeBuilderLoading()
        : this._wardrobeViewState === "preview"
          ? this._renderWardrobeBuilderPreview()
          : this._wardrobeViewState === "hidden"
            ? this._renderWardrobeHiddenChoices()
            : this._wardrobeViewState === "error"
              ? this._renderWardrobeBuilderError()
              : this._renderWardrobeBuilderForm();
    this._wardrobeContentContainer.replaceChildren(node);
  },

  _renderWardrobeBuilderForm() {
    const fragment = document.createDocumentFragment();

    const directionInput = QM.smallInput("textarea");
    directionInput.placeholder =
      'Describe the outfits you want, e.g. "Build me 3 outfits, something casual with jeans and a jacket, something for cold weather with a hat and gloves, and something rugged with full suit of fancy armor and a glaive"';
    directionInput.rows = 5;
    directionInput.value = this._wardrobeDirection;
    Object.assign(directionInput.style, {
      width: "100%",
      boxSizing: "border-box",
      resize: "vertical",
      font: "inherit",
    });

    const contextRow = document.createElement("label");
    Object.assign(contextRow.style, { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" });
    const contextCheckbox = document.createElement("input");
    contextCheckbox.type = "checkbox";
    contextCheckbox.checked = this._wardrobeIncludePersonaContext;
    contextCheckbox.addEventListener("change", () => {
      this._wardrobeIncludePersonaContext = contextCheckbox.checked;
    });
    const contextLabel = document.createElement("span");
    contextLabel.textContent = "Include persona details (description, personality, appearance)";
    contextRow.append(contextCheckbox, contextLabel);

    const generateButton = QM.button("Generate", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    generateButton.style.width = "100%";
    generateButton.disabled = !this._wardrobeDirection.trim();
    generateButton.addEventListener("click", () => this._submitWardrobeGeneration());

    directionInput.addEventListener("input", () => {
      this._wardrobeDirection = directionInput.value;
      generateButton.disabled = !directionInput.value.trim();
    });

    fragment.append(directionInput, contextRow, generateButton);
    return fragment;
  },

  _renderWardrobeBuilderLoading() {
    const node = document.createElement("div");
    node.textContent = "Generating wardrobe…";
    Object.assign(node.style, {
      fontSize: "12px",
      textAlign: "center",
      padding: "12px 0",
      color: "var(--muted-foreground, inherit)",
    });
    return node;
  },

  async _submitWardrobeGeneration() {
    const token = this._wardrobeSessionToken;
    this._wardrobeViewState = "loading";
    this._renderWardrobeBuilderContent();
    try {
      const result = await QM.state.generateWardrobe(this._wardrobeDirection, this._wardrobeIncludePersonaContext);
      if (token !== this._wardrobeSessionToken) return; // modal closed/reopened while this was in flight
      this._wardrobeProposal = result.proposal;
      this._wardrobeHiddenMatches = result.hiddenMatches ?? [];
      // Skip by default; Show starts from the chat's access setting.
      this._wardrobeHiddenChoices = Object.fromEntries(
        this._wardrobeHiddenMatches.map((match) => [
          match.itemId,
          { action: "skip", show: qmAccessModeShows(QM.state.hiddenItemAccess) },
        ]),
      );
      this._wardrobeSummary = null;
      this._wardrobeViewState = "preview";
    } catch (error) {
      if (token !== this._wardrobeSessionToken) return;
      const code = error && error.message;
      this._wardrobeError =
        (code && QM_WARDROBE_ERROR_MESSAGES[code]) || code || "The wardrobe could not be generated.";
      this._wardrobeViewState = "error";
    }
    this._renderWardrobeBuilderContent();
  },

  // Sectioned, not one run-on sentence — a wardrobe touching a dozen
  // existing items reads as an unreadable wall of text otherwise (found via
  // real testing). A bold stat line, then each list (reused/skipped) gets
  // its own labeled <ul>, one entry per line.
  _buildWardrobeSummaryNode(summary) {
    const container = document.createElement("div");
    Object.assign(container.style, { fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px" });

    const statParts = [];
    if (summary.createdItemNames.length > 0) statParts.push(`${summary.createdItemNames.length} item(s)`);
    if (summary.createdOutfitNames.length > 0) statParts.push(`${summary.createdOutfitNames.length} outfit(s)`);
    const statLine = document.createElement("div");
    statLine.style.fontWeight = "600";
    statLine.textContent = statParts.length > 0 ? `Added ${statParts.join(" and ")}.` : "Nothing new to add.";
    container.appendChild(statLine);

    const buildList = (label, entries) => {
      if (entries.length === 0) return;
      const section = document.createElement("div");
      const sectionLabel = document.createElement("div");
      sectionLabel.textContent = label;
      sectionLabel.style.opacity = "0.85";
      const list = document.createElement("ul");
      Object.assign(list.style, { margin: "2px 0 0", paddingLeft: "18px" });
      for (const entry of entries) {
        const item = document.createElement("li");
        item.textContent = entry;
        list.appendChild(item);
      }
      section.append(sectionLabel, list);
      container.appendChild(section);
    };

    buildList("Reused from your existing inventory:", summary.reusedItemNames);
    buildList(
      "Skipped:",
      summary.skipped.map((entry) =>
        entry.reason === "duplicate-name"
          ? `"${entry.name}" — an outfit with that name already exists`
          : entry.reason === "hidden"
            ? `"${entry.itemName}" in "${entry.outfitName}" — a hidden item you skipped`
            : `"${entry.itemName}" in "${entry.outfitName}" — that slot was already used`,
      ),
    );

    return container;
  },

  _renderWardrobeBuilderPreview() {
    const fragment = document.createDocumentFragment();

    if (this._wardrobeSummary) {
      fragment.append(this._buildWardrobeSummaryNode(this._wardrobeSummary));
      const closeButton = QM.button("Close", { border: true });
      closeButton.style.width = "100%";
      closeButton.addEventListener("click", () => this._closeWardrobeBuilder());
      fragment.append(closeButton);
      return fragment;
    }

    const proposal = this._wardrobeProposal;
    const list = document.createElement("div");
    Object.assign(list.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontSize: "12px",
      maxHeight: "260px",
      overflowY: "auto",
    });

    for (const outfit of proposal.outfits) {
      const row = document.createElement("div");
      Object.assign(row.style, {
        border: "1px solid var(--border, rgba(128,128,128,0.3))",
        borderRadius: "var(--radius, 4px)",
        padding: "6px",
      });
      const name = document.createElement("strong");
      name.textContent = outfit.name;
      const description = document.createElement("div");
      description.textContent = outfit.description || "";
      description.style.opacity = "0.85";
      const members = document.createElement("div");
      members.textContent = outfit.itemNames.join(", ");
      Object.assign(members.style, { opacity: "0.7", fontSize: "11px" });
      row.append(name, description, members);
      list.appendChild(row);
    }
    if (proposal.items.length > 0) {
      const itemsRow = document.createElement("div");
      Object.assign(itemsRow.style, { fontSize: "11px", opacity: "0.7" });
      itemsRow.textContent = `New items: ${proposal.items.map((item) => item.name).join(", ")}`;
      list.appendChild(itemsRow);
    }

    const buttonRow = document.createElement("div");
    Object.assign(buttonRow.style, { display: "flex", gap: "6px" });
    const confirmButton = QM.button("Confirm and Add to Inventory", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    confirmButton.style.flex = "1";
    if (this._wardrobeHiddenMatches.length > 0) {
      confirmButton.textContent = "Next: Hidden Items";
      confirmButton.addEventListener("click", () => {
        this._wardrobeViewState = "hidden";
        this._renderWardrobeBuilderContent();
      });
    } else {
      confirmButton.addEventListener("click", () => this._submitWardrobeConfirm(confirmButton));
    }
    const retryButton = QM.button("Retry", { border: true });
    retryButton.addEventListener("click", () => this._submitWardrobeGeneration());
    const cancelButton = QM.button("Cancel", { border: true });
    cancelButton.addEventListener("click", () => this._closeWardrobeBuilder());
    buttonRow.append(confirmButton, retryButton, cancelButton);

    fragment.append(list, buttonRow);
    return fragment;
  },

  // The step before committing whenever the proposal uses hidden items:
  // each one's details beside the new ones, then Overwrite / Keep / Skip
  // (skipping drops it from its outfits) and whether to show it again.
  _renderWardrobeHiddenChoices() {
    const fragment = document.createDocumentFragment();
    const intro = document.createElement("div");
    intro.textContent = "This wardrobe uses hidden items. Choose what happens to each one.";
    Object.assign(intro.style, { fontSize: "12px" });

    const list = document.createElement("div");
    Object.assign(list.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontSize: "12px",
      maxHeight: "300px",
      overflowY: "auto",
    });
    for (const match of this._wardrobeHiddenMatches) list.appendChild(this._buildWardrobeHiddenMatchRow(match));

    const buttonRow = document.createElement("div");
    Object.assign(buttonRow.style, { display: "flex", gap: "6px" });
    const confirmButton = QM.button("Confirm and Add to Inventory", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    confirmButton.style.flex = "1";
    confirmButton.addEventListener("click", () => this._submitWardrobeConfirm(confirmButton));
    const backButton = QM.button("Back", { border: true });
    backButton.addEventListener("click", () => {
      this._wardrobeViewState = "preview";
      this._renderWardrobeBuilderContent();
    });
    buttonRow.append(confirmButton, backButton);

    fragment.append(intro, list, buttonRow);
    return fragment;
  },

  _buildWardrobeHiddenMatchRow(match) {
    const choice = this._wardrobeHiddenChoices[match.itemId];
    const row = document.createElement("div");
    Object.assign(row.style, {
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "var(--radius, 4px)",
      padding: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });
    const name = document.createElement("strong");
    name.textContent = match.name;
    row.appendChild(name);

    const sides = document.createElement("div");
    Object.assign(sides.style, { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "8px" });
    const side = (title, description) => {
      const column = document.createElement("div");
      const heading = document.createElement("div");
      heading.textContent = title;
      Object.assign(heading.style, { fontSize: "11px", fontWeight: "600" });
      const body = document.createElement("div");
      body.textContent = description || "(no description)";
      Object.assign(body.style, {
        fontSize: "11px",
        opacity: "0.85",
        maxHeight: "84px",
        overflowY: "auto",
        wordBreak: "break-word",
        fontStyle: description ? "normal" : "italic",
      });
      column.append(heading, body);
      return column;
    };
    sides.append(
      side(match.descriptionLocked ? "Hidden item (locked)" : "Hidden item", match.description),
      match.proposed
        ? side("New", match.proposed.description)
        : side("New", "Only named in an outfit — no new details."),
    );
    row.appendChild(sides);

    const showLabel = document.createElement("label");
    const showBox = document.createElement("input");
    const options = [
      { value: "overwrite", label: "Overwrite with new details", disabled: !match.proposed },
      { value: "keep", label: "Keep hidden item's details" },
      { value: "skip", label: "Skip (leave it out of these outfits)" },
    ];
    const optionsColumn = document.createElement("div");
    Object.assign(optionsColumn.style, { display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" });
    for (const option of options) {
      const label = document.createElement("label");
      Object.assign(label.style, {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        cursor: option.disabled ? "default" : "pointer",
        opacity: option.disabled ? "0.5" : "1",
      });
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `qm-wardrobe-hidden-${match.itemId}`;
      radio.value = option.value;
      radio.checked = choice.action === option.value;
      radio.disabled = Boolean(option.disabled);
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        choice.action = option.value;
        showBox.disabled = option.value === "skip";
        showLabel.style.opacity = showBox.disabled ? "0.5" : "1";
      });
      const text = document.createElement("span");
      text.textContent = option.label;
      label.append(radio, text);
      optionsColumn.appendChild(label);
    }
    row.appendChild(optionsColumn);

    Object.assign(showLabel.style, { display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" });
    showBox.type = "checkbox";
    showBox.checked = choice.show;
    showBox.disabled = choice.action === "skip";
    showLabel.style.opacity = showBox.disabled ? "0.5" : "1";
    showBox.addEventListener("change", () => {
      choice.show = showBox.checked;
    });
    const showText = document.createElement("span");
    showText.textContent = "Show (unhide) this item";
    showLabel.append(showBox, showText);
    row.appendChild(showLabel);
    return row;
  },

  async _submitWardrobeConfirm(confirmButton) {
    const token = this._wardrobeSessionToken;
    const chatId = QM.state.chatId;
    confirmButton.disabled = true;
    try {
      const result = await QM.state.confirmWardrobe(this._wardrobeProposal, this._wardrobeHiddenChoices);
      if (token !== this._wardrobeSessionToken || chatId !== QM.state.chatId) return;
      this._wardrobeSummary = result.summary;
      this._wardrobeViewState = "preview";
      this._renderWardrobeBuilderContent();
    } catch (error) {
      if (token !== this._wardrobeSessionToken || chatId !== QM.state.chatId) return;
      confirmButton.disabled = false;
      this._wardrobeError = (error && error.message) || "The wardrobe could not be added.";
      this._wardrobeViewState = "error";
      this._renderWardrobeBuilderContent();
    }
  },

  _renderWardrobeBuilderError() {
    const fragment = document.createDocumentFragment();
    const message = document.createElement("div");
    message.textContent = this._wardrobeError || "Something went wrong.";
    Object.assign(message.style, { fontSize: "12px", color: QM_COLOR_DANGER });
    const buttonRow = document.createElement("div");
    Object.assign(buttonRow.style, { display: "flex", gap: "6px" });
    const tryAgainButton = QM.button("Try Again", { border: true });
    tryAgainButton.addEventListener("click", () => {
      this._wardrobeViewState = "form";
      this._wardrobeError = null;
      this._renderWardrobeBuilderContent();
    });
    const cancelButton = QM.button("Cancel", { border: true });
    cancelButton.addEventListener("click", () => this._closeWardrobeBuilder());
    buttonRow.append(tryAgainButton, cancelButton);
    fragment.append(message, buttonRow);
    return fragment;
  },
});
