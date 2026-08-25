// Quartermaster — capability package client entrypoint.
// Registers <marinara-capability-quartermaster>, mounted by the host once per
// slot instance with a "view" attribute telling us which one — "toolbar" for
// the compact roleplay-tracker launcher, "tracker" for the full tracker-panel
// content (the inventory list). Mirrors Beholder's src/90-element.js.
//
// v1 slice: persona-only inventory (ownerId is hardcoded to "persona" until
// party support adds real character selection). No equip slots, locations,
// images, or narrator ingestion yet — this proves the CRUD path first.
//
// Game Mode coverage is unresolved — roleplay-tracker/tracker-panel are
// documented as Roleplay-only; not yet decided how (or whether) this reaches
// Game Mode.

const QM_OWNER_ID = "persona";

class QuartermasterElement extends HTMLElement {
  constructor() {
    super();
    this._props = null;
    this._items = null;
    this._error = null;
    this._onPropsEvent = () => this._render();
  }

  set capabilityProps(value) {
    this._props = value;
    this._render();
  }

  get capabilityProps() {
    return this._props;
  }

  static get observedAttributes() {
    return ["view"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "view" && oldValue !== newValue) this._render();
  }

  connectedCallback() {
    this.addEventListener("marinara-capability-props", this._onPropsEvent);
    this._render();
  }

  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this._onPropsEvent);
  }

  get _chatId() {
    return this._props && typeof this._props.chatId === "string" ? this._props.chatId : null;
  }

  _render() {
    const view = this.getAttribute("view");
    if (view === "tracker") this._renderTrackerPanel();
    else this._renderToolbarLauncher();
  }

  _renderToolbarLauncher() {
    let button = this._button;
    if (!button || !this.contains(button)) {
      button = document.createElement("button");
      button.type = "button";
      button.textContent = "Quartermaster";
      this.replaceChildren(button);
      this._button = button;
    }
    // Beholder's toolbar button (src/90-element.js) applies this same host
    // class so third-party toolbar buttons match the native ones visually
    // instead of rendering as bare, unstyled elements under the app's CSS
    // reset. Without it the button has no chrome at all — looks like text.
    const props = this._props;
    const hostClass = props && typeof props.toolbarButtonClass === "string" ? props.toolbarButtonClass : "";
    button.className = hostClass;
  }

  async _renderTrackerPanel() {
    const chatId = this._chatId;
    if (!chatId) {
      this.replaceChildren(this._textNode("No active chat."));
      return;
    }
    if (this._items === null) {
      try {
        const result = await QM.listItems(chatId, QM_OWNER_ID);
        this._items = result.items;
      } catch (error) {
        this._error = error && error.message ? error.message : String(error);
      }
    }
    this._paintTrackerPanel(chatId);
  }

  _textNode(text) {
    const node = document.createElement("p");
    node.textContent = text;
    return node;
  }

  _paintTrackerPanel(chatId) {
    const container = document.createElement("div");
    container.style.padding = "12px";
    container.style.fontFamily = "system-ui, sans-serif";
    container.style.fontSize = "13px";

    const heading = document.createElement("h2");
    heading.textContent = "Quartermaster";
    heading.style.margin = "0 0 8px";
    container.appendChild(heading);

    if (this._error) {
      const errorNode = this._textNode(`Error: ${this._error}`);
      errorNode.style.color = "#c0392b";
      container.appendChild(errorNode);
    }

    container.appendChild(this._buildAddItemForm(chatId));
    container.appendChild(this._buildItemList(chatId));

    this.replaceChildren(container);
  }

  _buildAddItemForm(chatId) {
    const form = document.createElement("form");
    form.style.display = "flex";
    form.style.gap = "6px";
    form.style.marginBottom = "10px";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Item name";
    nameInput.required = true;
    nameInput.style.flex = "1";

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = "1";
    quantityInput.style.width = "56px";

    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.textContent = "Add";

    form.append(nameInput, quantityInput, addButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      addButton.disabled = true;
      try {
        const result = await QM.addItem(chatId, QM_OWNER_ID, { name, quantity: quantityInput.value });
        this._items = result.items;
        this._error = null;
      } catch (error) {
        this._error = error && error.message ? error.message : String(error);
      }
      this._paintTrackerPanel(chatId);
    });

    return form;
  }

  _buildItemList(chatId) {
    const list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.margin = "0";
    list.style.padding = "0";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";

    const items = this._items ?? [];
    if (items.length === 0) {
      const empty = this._textNode("No items yet.");
      empty.style.opacity = "0.7";
      list.appendChild(empty);
      return list;
    }

    for (const item of items) {
      list.appendChild(this._buildItemRow(chatId, item));
    }
    return list;
  }

  _buildItemRow(chatId, item) {
    const row = document.createElement("li");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.border = "1px solid rgba(128,128,128,0.3)";
    row.style.borderRadius = "4px";
    row.style.padding = "4px 6px";

    const label = document.createElement("span");
    label.textContent = item.name;
    label.style.flex = "1";
    label.title = item.description || "";

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = String(item.quantity);
    quantityInput.style.width = "48px";
    quantityInput.addEventListener("change", async () => {
      try {
        const result = await QM.updateItem(chatId, QM_OWNER_ID, item.id, { quantity: quantityInput.value });
        this._items = result.items;
        this._error = null;
      } catch (error) {
        this._error = error && error.message ? error.message : String(error);
      }
      this._paintTrackerPanel(chatId);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      try {
        const result = await QM.deleteItem(chatId, QM_OWNER_ID, item.id);
        this._items = result.items;
        this._error = null;
      } catch (error) {
        this._error = error && error.message ? error.message : String(error);
      }
      this._paintTrackerPanel(chatId);
    });

    row.append(label, quantityInput, deleteButton);
    return row;
  }
}

const QUARTERMASTER_TAG = "marinara-capability-quartermaster";
if (!customElements.get(QUARTERMASTER_TAG)) customElements.define(QUARTERMASTER_TAG, QuartermasterElement);
