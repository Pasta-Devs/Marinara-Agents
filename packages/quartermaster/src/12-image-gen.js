// Generate Image: an AI-generated alternative to uploading an item image or
// outfit portrait, ported from the legacy RPG Inventory extension's own
// Generate/Upload menu + editable "review prompt" step (see server.mjs's
// buildItemImagePrompt/buildOutfitPortraitPrompt/generateImageViaEngine for
// the actual prompt-building and generation logic). Attaches onto QM.dock
// (built in 10-dock.js), same cross-file pattern 11-wardrobe.js already uses.
//
// Neither route this calls writes to storage -- the "Generate" step returns
// an unsaved data URL, which this file then hands to the ALREADY-EXISTING
// QM.state.uploadItemImage/uploadOutfitPortrait to actually persist it,
// exactly like a real upload would (see server.mjs's own comment on why).

// Friendlier text for the known server-side failure codes, same convention
// QM_WARDROBE_ERROR_MESSAGES (11-wardrobe.js) uses.
const QM_IMAGE_GEN_ERROR_MESSAGES = {
  "no-image-connection":
    "No image connection is configured. Choose one in Settings → Image generation, or use Upload instead.",
  "engine-unreachable": "Could not reach the Engine's own image-generation API.",
  "generation-failed": "Image generation failed. Try again, or use Upload instead.",
};

Object.assign(QM.dock, {
  _imageGenViewState: "choice", // "choice" | "prompt" | "loading" | "error"
  _imageGenKind: null, // "item" | "outfit"
  _imageGenSubjectId: null,
  _imageGenFileInput: null, // the existing hidden <input type=file>, reused for "Upload"
  _imageGenHasConnections: null, // null = still checking, true/false once resolved
  _imageGenConnectionsError: false, // the check itself failed (distinct from "checked, found none")
  _imageGenPrompt: "",
  _imageGenLoadingLabel: "",
  _imageGenError: null,
  _imageGenContentContainer: null,

  _openImageGenModal({ kind, subjectId, fileInput }) {
    this._closeImageGenModal();
    this._imageGenKind = kind;
    this._imageGenSubjectId = subjectId;
    this._imageGenFileInput = fileInput;
    this._imageGenViewState = "choice";
    this._imageGenHasConnections = null;
    this._imageGenConnectionsError = false;
    this._imageGenPrompt = "";
    this._imageGenError = null;

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
      if (event.target === backdrop) this._closeImageGenModal();
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
    title.textContent = kind === "outfit" ? "Add outfit portrait" : "Add item image";
    title.style.fontSize = "13px";
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.addEventListener("click", () => this._closeImageGenModal());
    header.append(title, closeButton);

    const contentContainer = document.createElement("div");
    Object.assign(contentContainer.style, { display: "flex", flexDirection: "column", gap: "8px" });
    this._imageGenContentContainer = contentContainer;

    panel.append(header, contentContainer);
    backdrop.appendChild(panel);
    this.imageGenBackdrop = backdrop;
    (this.root || this.body).appendChild(backdrop);
    this._imageGenEscapeHandler = this._bindEscapeClose(() => this._closeImageGenModal());

    this._renderImageGenContent();
    this._checkImageGenConnections();
  },

  _closeImageGenModal() {
    this.imageGenBackdrop?.remove();
    this.imageGenBackdrop = null;
    this._imageGenContentContainer = null;
    this._unbindEscapeClose(this._imageGenEscapeHandler);
    this._imageGenEscapeHandler = null;
  },

  async _checkImageGenConnections() {
    this._imageGenHasConnections = null;
    this._imageGenConnectionsError = false;
    this._renderImageGenContent();
    try {
      const connections = await QM.listImageConnections();
      this._imageGenHasConnections = connections.length > 0;
    } catch {
      this._imageGenHasConnections = false;
      this._imageGenConnectionsError = true;
    }
    this._renderImageGenContent();
  },

  _renderImageGenContent() {
    if (!this._imageGenContentContainer) return;
    const node =
      this._imageGenViewState === "loading"
        ? this._renderImageGenLoading()
        : this._imageGenViewState === "prompt"
          ? this._renderImageGenPrompt()
          : this._imageGenViewState === "error"
            ? this._renderImageGenError()
            : this._renderImageGenChoice();
    this._imageGenContentContainer.replaceChildren(node);
  },

  _renderImageGenChoice() {
    const fragment = document.createDocumentFragment();

    if (this._imageGenHasConnections === null) {
      const checking = document.createElement("div");
      checking.textContent = "Checking for an image connection…";
      Object.assign(checking.style, { fontSize: "12px", color: "var(--muted-foreground, inherit)" });
      fragment.appendChild(checking);
    } else if (this._imageGenConnectionsError) {
      const message = document.createElement("div");
      Object.assign(message.style, { fontSize: "11px", color: "var(--muted-foreground, inherit)" });
      message.textContent = "Could not check for an image connection — you can still upload.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "↻ Retry";
      Object.assign(retry.style, {
        marginLeft: "6px",
        background: "none",
        border: "none",
        color: "var(--primary, currentcolor)",
        cursor: "pointer",
        font: "inherit",
        fontSize: "11px",
        padding: "0",
      });
      retry.addEventListener("click", () => this._checkImageGenConnections());
      message.appendChild(retry);
      fragment.appendChild(message);
    } else if (!this._imageGenHasConnections) {
      const message = document.createElement("div");
      message.textContent =
        "No image connection selected. Choose one in Settings → Image generation to generate. You can still upload an image below.";
      Object.assign(message.style, { fontSize: "11px", color: "var(--muted-foreground, inherit)" });
      fragment.appendChild(message);
    }

    const buttonRow = document.createElement("div");
    Object.assign(buttonRow.style, { display: "flex", gap: "6px" });

    if (this._imageGenHasConnections) {
      const generateButton = QM.button("Generate", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
      generateButton.style.flex = "1";
      generateButton.addEventListener("click", () => this._submitImageGenPromptPreview());
      buttonRow.appendChild(generateButton);
    }

    const uploadButton = QM.button("Upload", { border: true });
    uploadButton.style.flex = "1";
    uploadButton.addEventListener("click", () => {
      this._imageGenFileInput?.click();
      this._closeImageGenModal();
    });
    buttonRow.appendChild(uploadButton);

    fragment.appendChild(buttonRow);
    return fragment;
  },

  async _submitImageGenPromptPreview() {
    this._imageGenViewState = "loading";
    this._imageGenLoadingLabel = "Building prompt…";
    this._renderImageGenContent();
    try {
      const result =
        this._imageGenKind === "outfit"
          ? await QM.outfitPortraitPromptPreview(QM.state.chatId, QM_OWNER_ID, this._imageGenSubjectId)
          : await QM.itemImagePromptPreview(QM.state.chatId, QM_OWNER_ID, this._imageGenSubjectId);
      this._imageGenPrompt = result.prompt;
      this._imageGenViewState = "prompt";
    } catch (error) {
      const code = error && error.message;
      this._imageGenError = (code && QM_IMAGE_GEN_ERROR_MESSAGES[code]) || code || "Could not build a prompt.";
      this._imageGenViewState = "error";
    }
    this._renderImageGenContent();
  },

  _renderImageGenPrompt() {
    const fragment = document.createDocumentFragment();

    const hint = document.createElement("div");
    hint.textContent =
      "Edit the prompt for this one generation if you like. This won't change your saved template in Settings.";
    Object.assign(hint.style, { fontSize: "11px", color: "var(--muted-foreground, inherit)" });

    const promptInput = QM.smallInput("textarea");
    promptInput.value = this._imageGenPrompt;
    promptInput.rows = 5;
    Object.assign(promptInput.style, { width: "100%", boxSizing: "border-box", resize: "vertical", font: "inherit" });

    const buttonRow = document.createElement("div");
    Object.assign(buttonRow.style, { display: "flex", gap: "6px" });
    const generateButton = QM.button("Generate", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    generateButton.style.flex = "1";
    generateButton.disabled = !this._imageGenPrompt.trim();
    generateButton.addEventListener("click", () => this._submitImageGenGenerate());
    const cancelButton = QM.button("Cancel", { border: true });
    cancelButton.addEventListener("click", () => this._closeImageGenModal());
    buttonRow.append(generateButton, cancelButton);

    promptInput.addEventListener("input", () => {
      this._imageGenPrompt = promptInput.value;
      generateButton.disabled = !promptInput.value.trim();
    });

    fragment.append(hint, promptInput, buttonRow);
    return fragment;
  },

  _renderImageGenLoading() {
    const node = document.createElement("div");
    node.textContent = this._imageGenLoadingLabel || "Working…";
    Object.assign(node.style, {
      fontSize: "12px",
      textAlign: "center",
      padding: "12px 0",
      color: "var(--muted-foreground, inherit)",
    });
    return node;
  },

  async _submitImageGenGenerate() {
    this._imageGenViewState = "loading";
    this._imageGenLoadingLabel = "Generating image…";
    this._renderImageGenContent();
    try {
      const isOutfit = this._imageGenKind === "outfit";
      const result = isOutfit
        ? await QM.generateOutfitPortrait(QM.state.chatId, QM_OWNER_ID, this._imageGenSubjectId, this._imageGenPrompt)
        : await QM.generateItemImage(QM.state.chatId, QM_OWNER_ID, this._imageGenSubjectId, this._imageGenPrompt);

      this._imageGenLoadingLabel = "Saving…";
      this._renderImageGenContent();
      if (isOutfit) {
        await QM.state.uploadOutfitPortrait(this._imageGenSubjectId, result.imageDataUrl);
      } else {
        await QM.state.uploadItemImage(this._imageGenSubjectId, result.imageDataUrl);
      }
      if (QM.state.error) throw new Error(QM.state.error);
      this._closeImageGenModal();
    } catch (error) {
      const code = error && error.message;
      this._imageGenError =
        (code && QM_IMAGE_GEN_ERROR_MESSAGES[code]) ||
        code ||
        "Image generation failed. Try again, or use Upload instead.";
      this._imageGenViewState = "error";
      this._renderImageGenContent();
    }
  },

  _renderImageGenError() {
    const fragment = document.createDocumentFragment();
    const message = document.createElement("div");
    message.textContent = this._imageGenError || "Something went wrong.";
    Object.assign(message.style, { fontSize: "12px", color: QM_COLOR_DANGER });
    const buttonRow = document.createElement("div");
    Object.assign(buttonRow.style, { display: "flex", gap: "6px" });
    const tryAgainButton = QM.button("Try Again", { border: true });
    tryAgainButton.addEventListener("click", () => {
      this._imageGenViewState = "choice";
      this._imageGenError = null;
      this._renderImageGenContent();
      this._checkImageGenConnections();
    });
    const cancelButton = QM.button("Cancel", { border: true });
    cancelButton.addEventListener("click", () => this._closeImageGenModal());
    buttonRow.append(tryAgainButton, cancelButton);
    fragment.append(message, buttonRow);
    return fragment;
  },
});
