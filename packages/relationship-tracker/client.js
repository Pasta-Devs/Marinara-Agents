"use strict";

(() => {
  const TAG_NAME = "marinara-capability-relationship-tracker";
  const DEFAULT_LOOKBACK = 15;
  const MIN_HISTORY_MESSAGES = 1;
  const MAX_HISTORY_MESSAGES = 100;
  const DEFAULT_HISTORY_MESSAGES = 20;
  const GRAPH_WIDTH = 640;
  const GRAPH_HEIGHT = 440;
  const ACTIVE_STATUS_POLL_MS = 500;
  const IDLE_STATUS_POLL_MS = 1_500;
  const CATEGORY_COLORS = Object.freeze({
    positive: "#34d399",
    neutral: "#94a3b8",
    negative: "#fb7185",
    complicated: "#c084fc",
  });

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const truncate = (value, limit) => {
    const text = String(value ?? "").trim();
    return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
  };

  const initials = (name) => {
    const words = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
    if (words.length === 0) return "?";
    return words.slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toUpperCase();
  };

  function nodeRadius(characterCount) {
    if (characterCount > 12) return 22;
    if (characterCount > 8) return 27;
    return 34;
  }

  function circularPositions(characters) {
    const count = characters.length;
    if (count === 0) return [];
    if (count === 1) return [{ ...characters[0], x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }];
    const startAngle = count === 2 ? 0 : -Math.PI / 2;
    const radiusX = count > 12 ? 270 : 248;
    const radiusY = count > 12 ? 168 : 150;
    return characters.map((character, index) => {
      const angle = startAngle + (Math.PI * 2 * index) / count;
      return {
        ...character,
        x: Math.round((GRAPH_WIDTH / 2 + Math.cos(angle) * radiusX) * 100) / 100,
        y: Math.round((GRAPH_HEIGHT / 2 + Math.sin(angle) * radiusY) * 100) / 100,
      };
    });
  }

  function definedEdges(value, positions) {
    const nodesById = new Map(positions.map((node) => [node.characterId, node]));
    return (Array.isArray(value?.relationships) ? value.relationships : [])
      .filter((edge) => edge?.state === "defined" && nodesById.has(edge.characterAId) && nodesById.has(edge.characterBId))
      .map((edge) => ({ ...edge, nodeA: nodesById.get(edge.characterAId), nodeB: nodesById.get(edge.characterBId) }));
  }

  function canonicalPair(characterAId, characterBId) {
    return characterAId < characterBId
      ? { characterAId, characterBId }
      : { characterAId: characterBId, characterBId: characterAId };
  }

  function pairKey(characterAId, characterBId) {
    const pair = canonicalPair(characterAId, characterBId);
    return `${encodeURIComponent(pair.characterAId)}::${encodeURIComponent(pair.characterBId)}`;
  }

  function parsePairKey(value) {
    const parts = String(value ?? "").split("::");
    if (parts.length !== 2) return null;
    try {
      const pair = canonicalPair(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
      return pair.characterAId && pair.characterBId && pair.characterAId !== pair.characterBId ? pair : null;
    } catch {
      return null;
    }
  }

  function selectedRelationship(value, characterAId, characterBId) {
    const key = pairKey(characterAId, characterBId);
    return (Array.isArray(value?.relationships) ? value.relationships : [])
      .find((edge) => pairKey(edge.characterAId, edge.characterBId) === key) ?? null;
  }

  class RelationshipTrackerElement extends HTMLElement {
    static get observedAttributes() {
      return ["view"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._props = null;
      this._panel = { chatId: null, status: "idle", value: null, portraits: {}, error: "" };
      this._processing = this.emptyProcessingStatus(null);
      this._history = this.emptyHistoryState(null);
      this._editorPairKey = null;
      this._editorPersonaCharacterId = null;
      this._activeLineLabel = null;
      this._requestToken = 0;
      this._historyRequestToken = 0;
      this._statusGeneration = 0;
      this._statusTimer = null;
      this.onCapabilityProps = () => this.syncProps();
    }

    set capabilityProps(value) {
      this._props = value;
      if (this.isConnected) this.syncProps();
    }

    get capabilityProps() {
      return this._props;
    }

    connectedCallback() {
      this.addEventListener("marinara-capability-props", this.onCapabilityProps);
      this.syncProps();
    }

    disconnectedCallback() {
      this.removeEventListener("marinara-capability-props", this.onCapabilityProps);
      this._requestToken += 1;
      this._historyRequestToken += 1;
      this.stopStatusPolling();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.syncProps();
    }

    currentChatId() {
      return typeof this._props?.chatId === "string" && this._props.chatId ? this._props.chatId : null;
    }

    syncProps() {
      const chatId = this.currentChatId();
      if (this._panel.chatId !== chatId) {
        this._panel = { chatId, status: chatId ? "loading" : "idle", value: null, portraits: {}, error: "" };
        this._historyRequestToken += 1;
        this._history = this.emptyHistoryState(chatId);
        this._activeLineLabel = null;
        this._editorPairKey = null;
        this._editorPersonaCharacterId = null;
        if (chatId) void this.loadPanel(chatId);
      }
      this.syncStatusPolling(chatId);
      this.render();
    }

    emptyProcessingStatus(chatId) {
      return {
        chatId,
        initialized: false,
        processing: false,
        source: null,
        startedAt: null,
        expiresAt: null,
        completedRevision: 0,
        error: "",
      };
    }

    emptyHistoryState(chatId) {
      return {
        chatId,
        messageCount: DEFAULT_HISTORY_MESSAGES,
        status: "idle",
        error: "",
        result: null,
      };
    }

    stopStatusPolling({ reset = true } = {}) {
      this._statusGeneration += 1;
      if (this._statusTimer !== null) clearTimeout(this._statusTimer);
      this._statusTimer = null;
      if (reset) this._processing = this.emptyProcessingStatus(null);
    }

    syncStatusPolling(chatId) {
      const shouldPoll = this.isConnected && this.getAttribute("view") === "tracker" && Boolean(chatId);
      if (!shouldPoll) {
        if (this._statusTimer !== null || this._processing.chatId !== null) this.stopStatusPolling();
        return;
      }
      if (this._processing.chatId === chatId) return;
      this.stopStatusPolling({ reset: false });
      this._processing = this.emptyProcessingStatus(chatId);
      const generation = this._statusGeneration;
      void this.pollProcessingStatus(chatId, generation);
    }

    scheduleStatusPoll(chatId, generation, delay) {
      if (!this.isConnected || this.getAttribute("view") !== "tracker" ||
          chatId !== this.currentChatId() || generation !== this._statusGeneration) return;
      this._statusTimer = setTimeout(() => {
        this._statusTimer = null;
        void this.pollProcessingStatus(chatId, generation);
      }, delay);
    }

    async pollProcessingStatus(chatId, generation = this._statusGeneration) {
      let delay = IDLE_STATUS_POLL_MS;
      try {
        const response = await fetch(`/api/relationship-tracker/v1/chats/${encodeURIComponent(chatId)}/status`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || `Processing status read failed (${response.status}).`);
        if (generation !== this._statusGeneration || chatId !== this.currentChatId()) return;
        const previous = this._processing.chatId === chatId ? this._processing : this.emptyProcessingStatus(chatId);
        const completedRevision = Number.isInteger(body?.completedRevision) && body.completedRevision >= 0
          ? body.completedRevision
          : previous.completedRevision;
        const refreshAfterCompletion = completedRevision > previous.completedRevision;
        const processing = body?.processing === true;
        this._processing = {
          chatId,
          initialized: true,
          processing,
          source: processing && (body?.source === "automatic" || body?.source === "history") ? body.source : null,
          startedAt: processing && typeof body?.startedAt === "string" ? body.startedAt : null,
          expiresAt: processing && typeof body?.expiresAt === "string" ? body.expiresAt : null,
          completedRevision,
          error: "",
        };
        delay = processing ? ACTIVE_STATUS_POLL_MS : IDLE_STATUS_POLL_MS;
        this.updateProcessingStatusView();
        if (refreshAfterCompletion && this._panel.status !== "saving") await this.loadPanel(chatId);
      } catch {
        if (generation !== this._statusGeneration || chatId !== this.currentChatId()) return;
        const previous = this._processing.chatId === chatId ? this._processing : this.emptyProcessingStatus(chatId);
        const expiresAt = Date.parse(previous.expiresAt ?? "");
        const expired = previous.processing && Number.isFinite(expiresAt) && expiresAt <= Date.now();
        this._processing = {
          ...previous,
          processing: expired ? false : previous.processing,
          source: expired ? null : previous.source,
          startedAt: expired ? null : previous.startedAt,
          expiresAt: expired ? null : previous.expiresAt,
          error: "Processing status unavailable; retrying.",
        };
        this.updateProcessingStatusView();
      } finally {
        this.scheduleStatusPoll(chatId, generation, delay);
      }
    }

    async loadPortrait(characterId) {
      try {
        const response = await fetch(`/api/characters/${encodeURIComponent(characterId)}`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return null;
        const body = await response.json().catch(() => ({}));
        return typeof body?.avatarPath === "string" && body.avatarPath.trim() ? body.avatarPath : null;
      } catch {
        return null;
      }
    }

    async loadPanel(chatId) {
      const token = ++this._requestToken;
      try {
        const response = await fetch(`/api/relationship-tracker/v1/chats/${encodeURIComponent(chatId)}/panel`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || `Relationship web read failed (${response.status}).`);
        const characters = Array.isArray(body?.characters) ? body.characters : [];
        const portraits = Object.fromEntries(await Promise.all(characters.map(async (character) => [
          character.characterId,
          await this.loadPortrait(character.characterId),
        ])));
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = { chatId, status: "ready", value: body, portraits, error: "" };
      } catch (error) {
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = {
          chatId,
          status: "error",
          value: null,
          portraits: {},
          error: error instanceof Error ? error.message : String(error),
        };
      }
      this.render();
    }

    async saveSettings(injectionMode, presenceLookbackMessages) {
      const chatId = this.currentChatId();
      if (!chatId || this._history.status === "updating") return;
      const token = ++this._requestToken;
      this._panel = { ...this._panel, status: "saving", error: "" };
      this.render();
      try {
        const response = await fetch(`/api/relationship-tracker/v1/chats/${encodeURIComponent(chatId)}/settings`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ injectionMode, presenceLookbackMessages }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || `Settings update failed (${response.status}).`);
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = {
          ...this._panel,
          status: "ready",
          value: {
            ...this._panel.value,
            configured: true,
            settings: {
              injectionMode: body.injectionMode,
              presenceLookbackMessages: body.presenceLookbackMessages,
            },
          },
          error: "",
        };
      } catch (error) {
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = { ...this._panel, status: "error", error: error instanceof Error ? error.message : String(error) };
      }
      this.render();
    }

    async postRelationshipAction(path, body, failureLabel) {
      const chatId = this.currentChatId();
      if (!chatId || this._history.status === "updating") return;
      const token = ++this._requestToken;
      this._panel = { ...this._panel, status: "saving", error: "" };
      this.render();
      try {
        const response = await fetch(`/api/relationship-tracker/v1/chats/${encodeURIComponent(chatId)}/${path}`, {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const responseBody = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(responseBody?.error || `${failureLabel} (${response.status}).`);
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = { ...this._panel, status: "ready", value: responseBody, error: "" };
      } catch (error) {
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = {
          ...this._panel,
          status: "ready",
          error: error instanceof Error ? error.message : String(error),
        };
      }
      this.render();
    }

    async saveManualRelationship(relationship) {
      return this.postRelationshipAction("relationships/manual", relationship, "Manual relationship update failed");
    }

    async resumeAutomaticRelationship(pair) {
      return this.postRelationshipAction("relationships/resume", pair, "Resume automatic updates failed");
    }

    async saveManualPersonaPerception(perception) {
      return this.postRelationshipAction("persona/manual", perception, "Manual persona perception update failed");
    }

    async resumeAutomaticPersonaPerception(identity) {
      return this.postRelationshipAction("persona/resume", identity, "Resume automatic persona perception failed");
    }

    async setPersonaVisibility(showPersona) {
      const chatId = this.currentChatId();
      if (!chatId || this._history.status === "updating") return;
      const token = ++this._requestToken;
      this._panel = { ...this._panel, status: "saving", error: "" };
      this.render();
      try {
        const response = await fetch(`/api/relationship-tracker/v1/chats/${encodeURIComponent(chatId)}/persona/visibility`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ showPersona }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || `Persona visibility update failed (${response.status}).`);
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = { ...this._panel, status: "ready", value: body, error: "" };
      } catch (error) {
        if (token !== this._requestToken || chatId !== this.currentChatId()) return;
        this._panel = { ...this._panel, status: "ready", error: error instanceof Error ? error.message : String(error) };
      }
      this.render();
    }

    async updateFromHistory(messageCount) {
      const chatId = this.currentChatId();
      if (!chatId || this._panel.status === "saving" || this._history.status === "updating") return;
      if (!Number.isInteger(messageCount) || messageCount < MIN_HISTORY_MESSAGES || messageCount > MAX_HISTORY_MESSAGES) {
        this._history = {
          ...this._history,
          chatId,
          status: "error",
          error: `Choose an integer from ${MIN_HISTORY_MESSAGES} through ${MAX_HISTORY_MESSAGES}.`,
          result: null,
        };
        this.render();
        return;
      }
      const token = ++this._historyRequestToken;
      this._history = { chatId, messageCount, status: "updating", error: "", result: null };
      this.render();
      try {
        const response = await fetch(`/api/relationship-tracker/v1/chats/${encodeURIComponent(chatId)}/history-update`, {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ messageCount }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || `History update failed (${response.status}).`);
        if (token !== this._historyRequestToken || chatId !== this.currentChatId()) return;
        this._history = { chatId, messageCount, status: "success", error: "", result: body };
        await this.loadPanel(chatId);
      } catch (error) {
        if (token !== this._historyRequestToken || chatId !== this.currentChatId()) return;
        this._history = {
          chatId,
          messageCount,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          result: null,
        };
        this.render();
      }
    }

    bindControls() {
      const settings = this._panel.value?.settings;
      const lookback = Number.isInteger(settings?.presenceLookbackMessages)
        ? settings.presenceLookbackMessages
        : DEFAULT_LOOKBACK;
      for (const button of this.shadowRoot.querySelectorAll?.("[data-mode]") ?? []) {
        button.addEventListener("click", () => void this.saveSettings(button.dataset.mode, lookback));
      }
      const input = this.shadowRoot.querySelector?.("[data-lookback]");
      input?.addEventListener("change", () => {
        const next = Number.parseInt(input.value, 10);
        if (settings?.injectionMode && Number.isInteger(next) && next > 0) {
          void this.saveSettings(settings.injectionMode, next);
        } else {
          this.render();
        }
      });
      const characterASelect = this.shadowRoot.querySelector?.("[data-editor-character-a]");
      const characterBSelect = this.shadowRoot.querySelector?.("[data-editor-character-b]");
      const selectPair = () => {
        const characterAId = characterASelect?.value;
        const characterBId = characterBSelect?.value;
        if (!characterAId || !characterBId || characterAId === characterBId) return;
        this._editorPairKey = pairKey(characterAId, characterBId);
        this.render();
      };
      characterASelect?.addEventListener("change", selectPair);
      characterBSelect?.addEventListener("change", selectPair);
      const stateSelect = this.shadowRoot.querySelector?.("[data-editor-state]");
      stateSelect?.addEventListener("change", () => {
        const defined = stateSelect.value === "defined";
        for (const control of this.shadowRoot.querySelectorAll?.("[data-defined-field]") ?? []) {
          control.disabled = !defined;
        }
        const labelInput = this.shadowRoot.querySelector?.("[data-editor-label]");
        if (labelInput) labelInput.required = defined;
      });
      const editorForm = this.shadowRoot.querySelector?.("[data-relationship-editor]");
      editorForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        const pair = parsePairKey(this._editorPairKey);
        if (!pair) return;
        const state = stateSelect?.value === "defined" ? "defined" : "undefined";
        const label = this.shadowRoot.querySelector?.("[data-editor-label]")?.value?.trim() ?? "";
        const description = this.shadowRoot.querySelector?.("[data-editor-description]")?.value?.trim() ?? "";
        const category = this.shadowRoot.querySelector?.("[data-editor-category]")?.value ?? "neutral";
        void this.saveManualRelationship({
          ...pair,
          state,
          label: state === "defined" ? label : "",
          description: state === "defined" ? description : "",
          colorCategory: state === "defined" ? category : null,
          manuallyLocked: this.shadowRoot.querySelector?.("[data-editor-lock]")?.checked === true,
        });
      });
      const resume = this.shadowRoot.querySelector?.("[data-resume-automatic]");
      resume?.addEventListener("click", () => {
        const pair = parsePairKey(this._editorPairKey);
        if (pair) void this.resumeAutomaticRelationship(pair);
      });
      this.shadowRoot.querySelector?.("[data-persona-visibility]")?.addEventListener("click", () => {
        void this.setPersonaVisibility(this._panel.value?.showPersona !== true);
      });
      const personaCharacter = this.shadowRoot.querySelector?.("[data-persona-character]");
      personaCharacter?.addEventListener("change", () => {
        this._editorPersonaCharacterId = personaCharacter.value;
        this.render();
      });
      const personaState = this.shadowRoot.querySelector?.("[data-persona-state]");
      personaState?.addEventListener("change", () => {
        const defined = personaState.value === "defined";
        for (const control of this.shadowRoot.querySelectorAll?.("[data-persona-defined-field]") ?? []) control.disabled = !defined;
      });
      this.shadowRoot.querySelector?.("[data-persona-editor]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const persona = this._panel.value?.persona;
        const characterId = personaCharacter?.value;
        if (!persona?.id || !characterId) return;
        const state = personaState?.value === "defined" ? "defined" : "undefined";
        void this.saveManualPersonaPerception({
          characterId,
          personaId: persona.id,
          state,
          label: state === "defined" ? this.shadowRoot.querySelector?.("[data-persona-label]")?.value?.trim() ?? "" : "",
          description: state === "defined" ? this.shadowRoot.querySelector?.("[data-persona-description]")?.value?.trim() ?? "" : "",
          colorCategory: state === "defined" ? this.shadowRoot.querySelector?.("[data-persona-category]")?.value ?? "neutral" : null,
          manuallyLocked: this.shadowRoot.querySelector?.("[data-persona-lock]")?.checked === true,
        });
      });
      this.shadowRoot.querySelector?.("[data-persona-resume]")?.addEventListener("click", () => {
        const persona = this._panel.value?.persona;
        const characterId = personaCharacter?.value;
        if (persona?.id && characterId) void this.resumeAutomaticPersonaPerception({ characterId, personaId: persona.id });
      });
      const historyForm = this.shadowRoot.querySelector?.("[data-history-update]");
      const historyCount = this.shadowRoot.querySelector?.("[data-history-count]");
      historyForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        const messageCount = Number(historyCount?.value ?? "");
        void this.updateFromHistory(messageCount);
      });
      historyCount?.addEventListener("change", () => {
        const messageCount = Number(historyCount.value);
        if (Number.isInteger(messageCount) && messageCount >= MIN_HISTORY_MESSAGES && messageCount <= MAX_HISTORY_MESSAGES) {
          this._history.messageCount = messageCount;
        }
      });
      for (const hitTarget of this.shadowRoot.querySelectorAll?.("[data-line-key]") ?? []) {
        hitTarget.addEventListener("pointerup", (event) => {
          if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
          event.preventDefault();
          this._activeLineLabel = hitTarget.dataset.lineKey;
          this.render();
        });
      }
      const graph = this.shadowRoot.querySelector?.("[data-relationship-web]");
      graph?.addEventListener("pointerup", (event) => {
        const packageLine = event.target?.closest?.("[data-line-key]");
        if ((event.pointerType === "touch" || event.pointerType === "pen") && !packageLine && this._activeLineLabel !== null) {
          this._activeLineLabel = null;
          this.render();
        }
      });
      const retry = this.shadowRoot.querySelector?.("[data-retry]");
      retry?.addEventListener("click", () => {
        const chatId = this.currentChatId();
        if (!chatId) return;
        this._panel = { ...this._panel, status: "loading", error: "" };
        this.render();
        void this.loadPanel(chatId);
      });
    }

    renderEdges(edges) {
      return edges.map((edge) => {
        const color = CATEGORY_COLORS[edge.colorCategory] ?? CATEGORY_COLORS.neutral;
        const midpointX = (edge.nodeA.x + edge.nodeB.x) / 2;
        const midpointY = (edge.nodeA.y + edge.nodeB.y) / 2;
        const label = truncate(edge.label || "Relationship", 44);
        const accessible = `${edge.nodeA.name} and ${edge.nodeB.name}: ${edge.label || "relationship"}`;
        const edgeId = `${edge.characterAId}--${edge.characterBId}`;
        return `
          <g class="edge${this._activeLineLabel === edgeId ? " line-label-active" : ""}" data-edge="${escapeHtml(edgeId)}" style="--edge-color:${color}">
            <line class="edge-visible" x1="${edge.nodeA.x}" y1="${edge.nodeA.y}" x2="${edge.nodeB.x}" y2="${edge.nodeB.y}"></line>
            <line class="edge-hit" data-line-key="${escapeHtml(edgeId)}" x1="${edge.nodeA.x}" y1="${edge.nodeA.y}" x2="${edge.nodeB.x}" y2="${edge.nodeB.y}" tabindex="0" role="img" aria-label="${escapeHtml(accessible)}">
              <title>${escapeHtml(accessible)}</title>
            </line>
            <text class="edge-label" x="${midpointX}" y="${midpointY - 8}" text-anchor="middle">${escapeHtml(label)}</text>
          </g>
        `;
      }).join("");
    }

    renderNodes(positions) {
      const radius = nodeRadius(positions.length);
      return positions.map((node, index) => {
        const portrait = this._panel.portraits?.[node.characterId];
        const name = truncate(node.name || node.characterId, positions.length > 10 ? 16 : 22);
        const portraitImage = portrait ? `
          <image href="${escapeHtml(portrait)}" x="${-radius}" y="${-radius}" width="${radius * 2}" height="${radius * 2}"
            preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait-clip-${index})"></image>
        ` : "";
        return `
          <g class="character-node" data-character-id="${escapeHtml(node.characterId)}" transform="translate(${node.x} ${node.y})" role="img" aria-label="${escapeHtml(node.name)}">
            <title>${escapeHtml(node.name)}</title>
            <defs><clipPath id="portrait-clip-${index}"><circle r="${radius}"></circle></clipPath></defs>
            <circle class="portrait-fallback" r="${radius}"></circle>
            <text class="portrait-initials" text-anchor="middle" dominant-baseline="central">${escapeHtml(initials(node.name))}</text>
            ${portraitImage}
            <circle class="portrait-outline" r="${radius}"></circle>
            <text class="character-name" y="${radius + 18}" text-anchor="middle">${escapeHtml(name)}</text>
          </g>
        `;
      }).join("");
    }

    renderPersonaSpokes(value, positions) {
      if (value?.showPersona !== true || !value?.persona) return "";
      const nodes = new Map(positions.map((node) => [node.characterId, node]));
      return (Array.isArray(value.personaPerceptions) ? value.personaPerceptions : [])
        .filter((entry) => entry?.state === "defined" && nodes.has(entry.characterId))
        .map((entry) => {
          const node = nodes.get(entry.characterId);
          const color = CATEGORY_COLORS[entry.colorCategory] ?? CATEGORY_COLORS.neutral;
          const accessible = `${node.name}'s perception of ${value.persona.name}: ${entry.label}`;
          const spokeId = `persona--${entry.characterId}--${value.persona.id}`;
          const midpointX = (node.x + GRAPH_WIDTH / 2) / 2;
          const midpointY = (node.y + GRAPH_HEIGHT / 2) / 2;
          return `<g class="persona-spoke${this._activeLineLabel === spokeId ? " line-label-active" : ""}" style="--edge-color:${color}">
            <line class="persona-spoke-visible" x1="${node.x}" y1="${node.y}" x2="${GRAPH_WIDTH / 2}" y2="${GRAPH_HEIGHT / 2}" marker-end="url(#persona-arrow)"></line>
            <line class="edge-hit" data-line-key="${escapeHtml(spokeId)}" x1="${node.x}" y1="${node.y}" x2="${GRAPH_WIDTH / 2}" y2="${GRAPH_HEIGHT / 2}" tabindex="0" role="img" aria-label="${escapeHtml(accessible)}"><title>${escapeHtml(accessible)}</title></line>
            <text class="edge-label" x="${midpointX}" y="${midpointY - 8}" text-anchor="middle">${escapeHtml(truncate(entry.label || "Perception", 44))}</text>
          </g>`;
        }).join("");
    }

    renderPersonaNode(value) {
      if (value?.showPersona !== true || !value?.persona) return "";
      return `<g class="persona-node" transform="translate(${GRAPH_WIDTH / 2} ${GRAPH_HEIGHT / 2})" role="img" aria-label="Active persona ${escapeHtml(value.persona.name)}">
        <circle class="persona-halo" r="48"></circle><circle class="persona-core" r="36"></circle>
        <text class="portrait-initials" text-anchor="middle" dominant-baseline="central">${escapeHtml(initials(value.persona.name))}</text>
        <text class="character-name" y="58" text-anchor="middle">${escapeHtml(truncate(value.persona.name, 22))}</text>
      </g>`;
    }

    renderGraph(value) {
      const characters = Array.isArray(value?.characters) ? value.characters : [];
      if (characters.length === 0) {
        return `<div class="empty-web"><span aria-hidden="true">◎</span><p>No character cards are assigned to this Roleplay chat.</p></div>`;
      }
      const positions = circularPositions(characters);
      const edges = definedEdges(value, positions);
      const personaSpokes = this.renderPersonaSpokes(value, positions);
      return `
        <div class="web-frame ${characters.length > 12 ? "dense-web" : ""}" data-character-count="${characters.length}">
          <svg class="relationship-web" data-relationship-web viewBox="0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}" role="img" aria-label="Relationship web with ${characters.length} characters and ${edges.length} defined relationships">
            <defs><marker id="persona-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"></path></marker></defs>
            <g class="edges">${this.renderEdges(edges)}${personaSpokes}</g>
            <g class="nodes">${this.renderNodes(positions)}${this.renderPersonaNode(value)}</g>
          </svg>
          ${edges.length === 0 && !personaSpokes ? `<p class="web-note">No defined relationships yet.</p>` : ""}
        </div>
      `;
    }

    renderEditor(value, busy) {
      const saving = this._panel.status === "saving";
      const characters = Array.isArray(value?.characters) ? value.characters : [];
      if (characters.length < 2) {
        return `<section class="editor" aria-label="Relationship editor"><h4>Relationship editor</h4><p>Assign at least two character cards to edit a relationship.</p></section>`;
      }
      const requestedPair = parsePairKey(this._editorPairKey);
      const selectedCharacterA = characters.find((character) => character.characterId === requestedPair?.characterAId) ?? characters[0];
      const selectedCharacterB = characters.find((character) =>
        character.characterId === requestedPair?.characterBId && character.characterId !== selectedCharacterA.characterId
      ) ?? characters.find((character) => character.characterId !== selectedCharacterA.characterId);
      this._editorPairKey = pairKey(selectedCharacterA.characterId, selectedCharacterB.characterId);
      const relationship = selectedRelationship(value, selectedCharacterA.characterId, selectedCharacterB.characterId) ?? {
        state: "undefined",
        label: "",
        description: "",
        colorCategory: "neutral",
        manuallyLocked: false,
      };
      const defined = relationship.state === "defined";
      const unavailable = busy || value?.configured !== true;
      const characterOptions = (selectedId, disabledId) => characters.map((character) => `
        <option value="${escapeHtml(character.characterId)}" ${character.characterId === selectedId ? "selected" : ""} ${character.characterId === disabledId ? "disabled" : ""}>
          ${escapeHtml(character.name)}
        </option>
      `).join("");
      return `
        <section class="editor" aria-label="Relationship editor">
          <div class="section-heading">
            <h4>Relationship editor</h4>
            ${relationship.manuallyLocked ? `<span class="lock-status">Manually locked</span>` : `<span class="automatic-status">Automatic</span>`}
          </div>
          ${this._panel.error ? `<p class="error" role="alert">${escapeHtml(this._panel.error)}</p>` : ""}
          <form data-relationship-editor>
            <fieldset ${unavailable ? "disabled" : ""}>
              <label>
                Character A
                <select data-editor-character-a>${characterOptions(selectedCharacterA.characterId, selectedCharacterB.characterId)}</select>
              </label>
              <label>
                Character B
                <select data-editor-character-b>${characterOptions(selectedCharacterB.characterId, selectedCharacterA.characterId)}</select>
              </label>
              <label>
                State
                <select data-editor-state>
                  <option value="defined" ${defined ? "selected" : ""}>Defined</option>
                  <option value="undefined" ${defined ? "" : "selected"}>Undefined</option>
                </select>
              </label>
              <label>
                Color category
                <select data-editor-category data-defined-field ${defined ? "" : "disabled"}>
                  ${["positive", "neutral", "negative", "complicated"].map((category) => `
                    <option value="${category}" ${relationship.colorCategory === category ? "selected" : ""}>${category[0].toUpperCase()}${category.slice(1)}</option>
                  `).join("")}
                </select>
              </label>
              <label class="wide-field">
                Label
                <input data-editor-label data-defined-field type="text" maxlength="80" value="${escapeHtml(relationship.label)}" ${defined ? "required" : "disabled"}>
              </label>
              <label class="wide-field">
                Description
                <textarea data-editor-description data-defined-field maxlength="240" rows="3" aria-describedby="relationship-description-help" ${defined ? "required" : "disabled"}>${escapeHtml(relationship.description)}</textarea>
                <small id="relationship-description-help">Write any brief single-line summary of this pair's dynamic. Character-card IDs are not allowed.</small>
              </label>
              <label class="wide-field lock-choice">
                <input data-editor-lock type="checkbox" ${relationship.manuallyLocked ? "checked" : ""}>
                Lock this relationship against automatic updates
              </label>
              <div class="editor-actions wide-field">
                <button type="submit">${saving ? "Saving…" : "Save relationship"}</button>
                ${relationship.manuallyLocked ? `<button type="button" class="secondary" data-resume-automatic>Resume automatic updates</button>` : ""}
              </div>
            </fieldset>
          </form>
          <p>${value?.configured === true
            ? "Setting a relationship to \"Undefined\" and saving will remove it from the web"
            : "Select an injection mode below to initialize this chat before editing relationships."}</p>
        </section>
      `;
    }

    renderPersonaEditor(value, busy) {
      const persona = value?.persona;
      const characters = Array.isArray(value?.characters) ? value.characters : [];
      if (!persona) return `<section class="editor persona-editor"><div class="section-heading"><h4>Active persona</h4></div><p>This chat has no active persona.</p></section>`;
      const selected = characters.find((entry) => entry.characterId === this._editorPersonaCharacterId) ?? characters[0];
      if (!selected) return "";
      this._editorPersonaCharacterId = selected.characterId;
      const perception = (Array.isArray(value.personaPerceptions) ? value.personaPerceptions : []).find((entry) => entry.characterId === selected.characterId) ?? {
        state: "undefined", label: "", description: "", colorCategory: "neutral", manuallyLocked: false,
      };
      const defined = perception.state === "defined";
      return `<section class="editor persona-editor" aria-label="Persona perception editor">
        <div class="section-heading"><h4>Character perception of ${escapeHtml(persona.name)}</h4><button type="button" class="secondary" data-persona-visibility>${value.showPersona === true ? "Hide persona from graphic" : "Show persona in graphic"}</button></div>
        <p>Graphics visibility does not disable tracking or prompt injection.</p>
        <form data-persona-editor><fieldset ${busy || value?.configured !== true ? "disabled" : ""}>
          <label>Character<select data-persona-character>${characters.map((entry) => `<option value="${escapeHtml(entry.characterId)}" ${entry.characterId === selected.characterId ? "selected" : ""}>${escapeHtml(entry.name)}</option>`).join("")}</select></label>
          <label>State<select data-persona-state><option value="defined" ${defined ? "selected" : ""}>Defined</option><option value="undefined" ${defined ? "" : "selected"}>Undefined</option></select></label>
          <label>Color category<select data-persona-category data-persona-defined-field ${defined ? "" : "disabled"}>${["positive", "neutral", "negative", "complicated"].map((category) => `<option value="${category}" ${perception.colorCategory === category ? "selected" : ""}>${category[0].toUpperCase()}${category.slice(1)}</option>`).join("")}</select></label>
          <label class="wide-field">Label<input data-persona-label data-persona-defined-field maxlength="80" value="${escapeHtml(perception.label)}" ${defined ? "required" : "disabled"}></label>
          <label class="wide-field">Character's Perception<textarea data-persona-description data-persona-defined-field maxlength="240" rows="3" ${defined ? "required" : "disabled"}>${escapeHtml(perception.description)}</textarea></label>
          <label class="wide-field lock-choice"><input data-persona-lock type="checkbox" ${perception.manuallyLocked ? "checked" : ""}>Lock this perception against automatic updates</label>
          <div class="editor-actions wide-field"><button type="submit">Save perception</button>${perception.manuallyLocked ? `<button type="button" class="secondary" data-persona-resume>Resume automatic updates</button>` : ""}</div>
        </fieldset></form>
      </section>`;
    }

    renderHistory(value, busy) {
      const history = this._history.chatId === this.currentChatId()
        ? this._history
        : this.emptyHistoryState(this.currentChatId());
      const messageCount = Number.isInteger(history.messageCount) ? history.messageCount : DEFAULT_HISTORY_MESSAGES;
      const updating = history.status === "updating";
      const unavailable = busy || value?.configured !== true;
      let feedback = "";
      if (history.status === "success" && history.result) {
        const processed = Number.isInteger(history.result.processedMessageCount) ? history.result.processedMessageCount : messageCount;
        const saved = Number.isInteger(history.result.diagnostics?.savedUpdates) ? history.result.diagnostics.savedUpdates : 0;
        const ignored = Number.isInteger(history.result.diagnostics?.ignoredLockedUpdates)
          ? history.result.diagnostics.ignoredLockedUpdates
          : 0;
        feedback = `<p class="history-success" role="status">Processed ${processed} recent message${processed === 1 ? "" : "s"}; saved ${saved} relationship change${saved === 1 ? "" : "s"}${ignored > 0 ? `; preserved ${ignored} manually locked update${ignored === 1 ? "" : "s"}` : ""}.</p>`;
      } else if (history.status === "error") {
        feedback = `<p class="error" role="alert">${escapeHtml(history.error)}</p>`;
      } else if (updating) {
        feedback = `<p role="status" aria-live="polite">Starting the bounded history update…</p>`;
      }
      return `
        <section class="history-update" aria-label="Update relationships from history">
          <div class="section-heading"><h4>Update from History</h4><span>1–100 messages</span></div>
          <form class="history-form" data-history-update>
            <label>
              Recent messages
              <input data-history-count type="number" min="${MIN_HISTORY_MESSAGES}" max="${MAX_HISTORY_MESSAGES}" step="1" value="${messageCount}" ${unavailable ? "disabled" : ""} required>
            </label>
            <button type="submit" ${unavailable ? "disabled" : ""}>${updating ? "Updating…" : "Update relationship web"}</button>
          </form>
          <p>${value?.configured === true
            ? "Check the latest recent messages and updates all lines in the web that aren't locked."
            : "Select an injection mode below to initialize this chat before updating from history."}</p>
          ${feedback}
        </section>
      `;
    }

    renderSettings(value, busy) {
      const saving = this._panel.status === "saving";
      const settings = value?.settings;
      const mode = settings?.injectionMode ?? null;
      const lookback = Number.isInteger(settings?.presenceLookbackMessages)
        ? settings.presenceLookbackMessages
        : DEFAULT_LOOKBACK;
      return `
        <details class="settings" ${mode ? "" : "open"}>
          <summary>Tracker settings</summary>
          <div class="settings-body">
            <fieldset ${busy ? "disabled" : ""}>
              <legend>Prompt injection</legend>
              <button type="button" data-mode="all" aria-pressed="${mode === "all"}">All relationships</button>
              <button type="button" data-mode="sceneOnly" aria-pressed="${mode === "sceneOnly"}">Scene-only relationships</button>
            </fieldset>
            <label>
              Presence lookback
              <input data-lookback type="number" min="1" step="1" value="${lookback}" ${mode && !busy ? "" : "disabled"}>
              <span>messages</span>
            </label>
            <p>${mode
              ? "Presence lookback only determines who qualifies for Scene-only prompt injection. It does not control automatic model context or update relationships."
              : "Select an injection mode to initialize this chat. Presence lookback defaults to 15 messages and is separate from the agent’s automatic Context Size and Update from History count."}</p>
            ${saving ? "<p>Saving…</p>" : ""}
          </div>
        </details>
      `;
    }

    updateProcessingStatusView() {
      const slot = this.shadowRoot.querySelector?.("[data-processing-status-slot]");
      if (slot) slot.innerHTML = this.renderProcessingStatus();
    }

    renderProcessingStatus() {
      const status = this._processing;
      if (status.chatId !== this.currentChatId()) return "";
      if (status.processing) {
        const history = status.source === "history";
        const label = history
          ? "Relationship Tracker is updating from history…"
          : "Relationship Tracker is processing this turn…";
        return `
          <div class="processing-status" role="status" aria-live="polite" data-processing-source="${history ? "history" : "automatic"}">
            <span class="processing-spinner" aria-hidden="true"></span>
            <span>${label}</span>
          </div>
        `;
      }
      return status.error ? `<p class="status-warning" role="status">${escapeHtml(status.error)}</p>` : "";
    }

    renderTracker() {
      const chatId = this.currentChatId();
      const state = this._panel;
      let content;
      if (!chatId) {
        content = "<p>Open a Roleplay group chat to view its relationship web.</p>";
      } else if (state.status === "loading" || (state.status === "idle" && !state.value)) {
        content = "<div class=\"loading\"><span aria-hidden=\"true\"></span><p>Loading relationship web…</p></div>";
      } else if (state.status === "error") {
        content = `<p class="error">${escapeHtml(state.error)}</p><button type="button" data-retry>Retry</button>`;
      } else {
        const saving = state.status === "saving";
        const busy = saving || this._history.status === "updating";
        content = `${this.renderGraph(state.value)}${this.renderHistory(state.value, busy)}${this.renderEditor(state.value, busy)}${this.renderPersonaEditor(state.value, busy)}${this.renderSettings(state.value, busy)}`;
      }
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; min-width: 0; color: var(--foreground, #f5f5f5); container-type: inline-size; }
          * { box-sizing: border-box; }
          .relationship-tracker { display: grid; min-width: 0; gap: 0.7rem; padding: clamp(0.45rem, 2.5cqw, 0.8rem); border: 1px solid var(--border, rgba(127,127,127,.35)); border-radius: 0.8rem; background: var(--tracker-panel-section-background, transparent); font: inherit; overflow: hidden; }
          h3, h4, p, fieldset { margin: 0; }
          h3 { font-size: 0.95rem; line-height: 1.25; }
          h4 { font-size: 0.84rem; line-height: 1.3; }
          p { color: var(--muted-foreground, #a3a3a3); font-size: 0.78rem; line-height: 1.4; }
          .error { color: #fca5a5; }
          .processing-slot { display: contents; }
          .processing-slot:empty { display: none; }
          .processing-status { display: flex; align-items: center; gap: 0.5rem; min-width: 0; border: 1px solid color-mix(in srgb, var(--primary, #67e8f9) 45%, transparent); border-radius: 0.55rem; padding: 0.42rem 0.55rem; color: var(--foreground, #f5f5f5); background: color-mix(in srgb, var(--primary, #67e8f9) 10%, transparent); font-size: 0.75rem; font-weight: 650; }
          .processing-spinner { flex: 0 0 auto; width: 0.85rem; height: 0.85rem; border: 2px solid color-mix(in srgb, var(--primary, #67e8f9) 28%, transparent); border-top-color: var(--primary, #67e8f9); border-radius: 999px; animation: spin .8s linear infinite; }
          .status-warning { color: #fde68a; }
          .loading, .empty-web { display: grid; place-items: center; gap: 0.45rem; min-height: 9rem; text-align: center; }
          .loading span { width: 1.25rem; height: 1.25rem; border: 2px solid color-mix(in srgb, var(--primary, #67e8f9) 25%, transparent); border-top-color: var(--primary, #67e8f9); border-radius: 999px; animation: spin .8s linear infinite; }
          .empty-web span { font-size: 2.25rem; color: var(--muted-foreground, #a3a3a3); opacity: .65; }
          @keyframes spin { to { transform: rotate(360deg); } }
          .web-frame { position: relative; min-width: 0; min-height: 14rem; border: 1px solid color-mix(in srgb, var(--border, #64748b) 72%, transparent); border-radius: 0.7rem; overflow: hidden; background: radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--primary, #67e8f9) 7%, transparent), transparent 62%); }
          .relationship-web { display: block; width: 100%; min-height: 14rem; max-height: min(31rem, 72vh); aspect-ratio: ${GRAPH_WIDTH} / ${GRAPH_HEIGHT}; overflow: visible; }
          .edge-visible { stroke: var(--edge-color); stroke-width: 4; stroke-linecap: round; opacity: .82; vector-effect: non-scaling-stroke; }
          .persona-spoke-visible { stroke: var(--edge-color); stroke-width: 3; stroke-dasharray: 7 5; opacity: .88; vector-effect: non-scaling-stroke; }
          #persona-arrow path { fill: var(--muted-foreground, #a3a3a3); }
          .persona-halo { fill: color-mix(in srgb, var(--primary, #67e8f9) 12%, transparent); stroke: var(--primary, #67e8f9); stroke-width: 2; stroke-dasharray: 5 4; }
          .persona-core { fill: color-mix(in srgb, var(--primary, #67e8f9) 32%, var(--background, #111827)); stroke: var(--primary, #67e8f9); stroke-width: 3; }
          .edge-hit { stroke: transparent; stroke-width: 18; stroke-linecap: round; pointer-events: stroke; cursor: help; vector-effect: non-scaling-stroke; }
          .edge:focus-within .edge-visible, .edge:hover .edge-visible, .edge.line-label-active .edge-visible { opacity: 1; stroke-width: 6; }
          .persona-spoke:focus-within .persona-spoke-visible, .persona-spoke:hover .persona-spoke-visible, .persona-spoke.line-label-active .persona-spoke-visible { opacity: 1; stroke-width: 5; }
          .edge-label { fill: var(--foreground, #fff); stroke: color-mix(in srgb, var(--background, #111827) 92%, transparent); stroke-width: 5px; paint-order: stroke; stroke-linejoin: round; font-size: 14px; font-weight: 700; opacity: 0; pointer-events: none; transition: opacity .12s ease; }
          .edge:focus-within .edge-label, .edge:hover .edge-label, .edge.line-label-active .edge-label, .persona-spoke:focus-within .edge-label, .persona-spoke:hover .edge-label, .persona-spoke.line-label-active .edge-label { opacity: 1; }
          .portrait-fallback { fill: color-mix(in srgb, var(--primary, #67e8f9) 22%, var(--background, #111827)); }
          .portrait-initials { fill: var(--foreground, #fff); font-size: 19px; font-weight: 750; }
          .portrait-outline { fill: none; stroke: color-mix(in srgb, var(--primary, #67e8f9) 70%, var(--border, #64748b)); stroke-width: 3; vector-effect: non-scaling-stroke; }
          .character-name { fill: var(--foreground, #fff); stroke: color-mix(in srgb, var(--background, #111827) 92%, transparent); stroke-width: 4px; paint-order: stroke; stroke-linejoin: round; font-size: 14px; font-weight: 700; }
          .dense-web .character-name { font-size: 11px; }
          .dense-web .portrait-initials { font-size: 15px; }
          .web-note { position: absolute; inset-inline: 0; bottom: 0.4rem; text-align: center; pointer-events: none; }
          .history-update, .editor, .settings { border-top: 1px solid var(--border, rgba(127,127,127,.35)); padding-top: 0.6rem; }
          .history-update, .editor { display: grid; gap: 0.55rem; }
          .history-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(8rem, auto); align-items: end; gap: 0.5rem; }
          .history-form label { display: grid; gap: 0.3rem; }
          .history-form input { width: 6rem; }
          .history-success { color: #a7f3d0; }
          .section-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4rem; }
          .lock-status, .automatic-status { border-radius: 999px; padding: 0.16rem 0.45rem; font-size: 0.68rem; font-weight: 700; }
          .lock-status { color: #fde68a; background: rgba(245, 158, 11, .16); }
          .automatic-status { color: #a7f3d0; background: rgba(16, 185, 129, .14); }
          .editor fieldset { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.55rem; padding: 0; border: 0; }
          .wide-field { grid-column: 1 / -1; }
          .editor label { display: grid; align-content: start; gap: 0.3rem; }
          .editor .lock-choice { display: flex; flex-direction: row; justify-content: flex-start; }
          .lock-choice input { width: auto; }
          .editor-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
          .editor-actions button { flex: 1 1 9rem; }
          .secondary { color: var(--muted-foreground, #a3a3a3); }
          summary { cursor: pointer; color: var(--muted-foreground, #a3a3a3); font-size: 0.78rem; font-weight: 650; }
          .panel-help { border-bottom: 1px solid var(--border, rgba(127,127,127,.35)); padding-bottom: 0.55rem; }
          .panel-help p { padding-top: 0.4rem; }
          .settings-body { display: grid; gap: 0.6rem; padding-top: 0.65rem; }
          .settings fieldset { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.4rem; padding: 0; border: 0; }
          legend { grid-column: 1 / -1; margin-bottom: 0.3rem; font-size: 0.75rem; color: var(--muted-foreground, #a3a3a3); }
          button, input, select, textarea { min-width: 0; border: 1px solid var(--border, rgba(127,127,127,.4)); border-radius: 0.45rem; color: inherit; background: var(--background, rgba(127,127,127,.08)); font: inherit; }
          button { padding: 0.45rem 0.55rem; cursor: pointer; overflow-wrap: anywhere; }
          button[aria-pressed="true"] { border-color: var(--primary, #67e8f9); background: color-mix(in srgb, var(--primary, #67e8f9) 18%, transparent); }
          button:disabled, input:disabled, select:disabled, textarea:disabled { cursor: default; opacity: 0.55; }
          label { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.78rem; }
          input, select, textarea { width: 100%; padding: 0.38rem 0.45rem; }
          .settings input { width: 4.5rem; }
          textarea { resize: vertical; line-height: 1.35; }
          @container (max-width: 320px) {
            .relationship-tracker { padding: 0.45rem; }
            .history-form, .editor fieldset, .settings fieldset { grid-template-columns: 1fr; }
            .editor label, .wide-field { grid-column: 1; }
            .relationship-web { min-height: 12rem; }
            .edge-label, .character-name { font-size: 13px; }
          }
          @media (prefers-reduced-motion: reduce) { .loading span, .processing-spinner { animation: none; } .edge-label { transition: none; } }
        </style>
        <section class="relationship-tracker" aria-label="Relationship Tracker">
          <h3>Relationship Tracker</h3>
          <details class="panel-help">
            <summary>Panel size & layout</summary>
            <p>Choose Compact, Standard, or Expanded under Settings → Appearance → Tracker Panel → Desktop size. Use the Tracker Panel header controls to dock or detach the whole panel.</p>
          </details>
          <div class="processing-slot" data-processing-status-slot>${this.renderProcessingStatus()}</div>
          ${content}
        </section>
      `;
      this.bindControls();
    }

    render() {
      const view = this.getAttribute("view");
      if (view === "toolbar") {
        this.shadowRoot.innerHTML = `
          <style>
            :host { display: contents; }
            button { display: inline-flex; align-items: center; justify-content: center; min-width: 2rem; min-height: 2rem; padding: 0.4rem; border: 0; border-radius: 0.5rem; color: inherit; background: transparent; font: inherit; opacity: 0.7; }
          </style>
          <button type="button" disabled aria-label="Relationship Tracker" title="Relationship Tracker web loaded">↔</button>
        `;
        return;
      }
      if (view === "tracker") {
        this.renderTracker();
        return;
      }
      this.shadowRoot.innerHTML = "";
    }
  }

  RelationshipTrackerElement.contract = Object.freeze({
    packageId: "relationship-tracker",
    stateSchemaVersion: 1,
    readApiVersion: 1,
  });

  if (!customElements.get(TAG_NAME)) customElements.define(TAG_NAME, RelationshipTrackerElement);
})();
