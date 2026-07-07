window.Aura = window.Aura || {};

Aura.launcher = {
  urlFor(target) {
    if (!Aura.launcherToken) return "";
    const bytes = new TextEncoder().encode(target);
    const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `aura-launch://open?token=${encodeURIComponent(Aura.launcherToken)}&target=${encoded}`;
  }
};

Aura.shortcuts = {
  items: [],
  editingId: null,
  normalize(items) {
    return (Array.isArray(items) ? items : []).map(item => ({
      id: typeof item?.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
      title: typeof item?.title === "string" ? item.title.trim() : "",
      type: item?.type === "windows" ? "windows" : "web",
      target: typeof item?.target === "string" ? item.target.trim() : "",
      showOnHome: item?.showOnHome !== false,
      icon: typeof item?.icon === "string" && item.icon.trim() ? item.icon.trim() : (item?.type === "windows" ? "folder" : "cloud"),
      color: typeof item?.color === "string" && item.color.trim() ? item.color.trim() : "neutral"
    })).filter(item => item.title && item.target);
  },
  load() {
    return this.normalize(Aura.storage.get("shortcuts", Aura.config.spaces));
  },
  save(items) {
    return Aura.storage.set("shortcuts", this.normalize(items));
  },
  validate(item) {
    if (!item.title?.trim() || !item.target?.trim()) return false;
    return item.type === "windows"
      ? /^[a-z]:[\\/].*\.(?:exe|lnk)$/i.test(item.target)
      : /^(?!javascript:|data:|vbscript:)[a-z][a-z\d+.-]*:/i.test(item.target);
  },
  upsert(input) {
    if (!this.validate(input)) return input.type === "windows"
      ? "Enter a name and an absolute .exe or .lnk path."
      : "Enter a name and a full URL or registered app link.";
    const record = this.normalize([{ ...input, id: this.editingId || crypto.randomUUID() }])[0];
    const nextItems = this.editingId
      ? this.items.map(item => item.id === this.editingId ? record : item)
      : [...this.items, record];
    if (!this.save(nextItems)) return "Could not save shortcut.";
    this.items = nextItems;
    this.editingId = null;
    this.renderAll();
    return "";
  },
  remove(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.save(this.items);
    this.renderAll();
  },
  homeItems() {
    return this.items.filter(item => item.showOnHome).slice(0, 6);
  },
  targetFor(item) {
    if (item.type === "windows") return Aura.launcher?.urlFor?.(item.target) || "";
    return item.target;
  },
  renderHome() {
    const root = document.getElementById("spaces");
    root.replaceChildren();
    this.homeItems().forEach(item => {
      const href = this.targetFor(item);
      const card = document.createElement(href ? "a" : "div");
      card.className = "space-card" + (item.color && item.color !== "neutral" ? " " + item.color : "");
      if (href) card.href = href;
      const mark = document.createElement("span");
      const iconName = item.icon || (item.type === "windows" ? "folder" : "cloud");
      mark.innerHTML = `<svg aria-hidden="true"><use href="#i-${iconName}"/></svg>`;
      const title = document.createElement("b");
      title.textContent = item.title;
      card.append(mark, title);
      if (!href) {
        const note = document.createElement("small");
        note.textContent = "Install launcher";
        card.append(note);
      }
      root.append(card);
    });
    const add = document.createElement("button");
    add.type = "button";
    add.className = "space-card add-card";
    add.setAttribute("aria-label", "Add shortcut");
    const mark = document.createElement("span");
    mark.textContent = "+";
    const label = document.createElement("b");
    label.textContent = "Add Shortcut";
    add.append(mark, label);
    add.addEventListener("click", () => {
      const dialog = document.getElementById("settings-dialog");
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() => document.getElementById("shortcut-title")?.focus());
    });
    root.append(add);
  },
  renderLibrary() {
    const query = document.getElementById("library-search").value.trim().toLowerCase();
    for (const type of ["web", "windows"]) {
      const root = document.getElementById(`library-${type}`);
      root.replaceChildren();
      const heading = document.createElement("h3");
      heading.textContent = type === "web" ? "Web" : "Windows apps";
      root.append(heading);
      const matches = this.items.filter(item => item.type === type && `${item.title} ${item.target}`.toLowerCase().includes(query));
      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No shortcuts.";
        root.append(empty);
      }
      matches.forEach(item => {
        const href = this.targetFor(item);
        const card = document.createElement(href ? "a" : "div");
        card.className = "library-shortcut";
        if (href) card.href = href;
        const title = document.createElement("strong");
        title.textContent = item.title;
        const target = document.createElement("small");
        target.textContent = href ? item.target : "Install launcher";
        card.append(title, target);
        root.append(card);
      });
    }
  },
  renderSettings() {
    const root = document.getElementById("shortcut-settings-list");
    root.replaceChildren();
    this.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "shortcut-settings-row";
      const details = document.createElement("span");
      const title = document.createElement("b");
      title.textContent = item.title;
      const target = document.createElement("small");
      target.textContent = item.target;
      details.append(title, target);
      const actions = document.createElement("span");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => this.edit(item));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        if (confirm("Delete this shortcut?")) this.remove(item.id);
      });
      actions.append(edit, remove);
      row.append(details, actions);
      root.append(row);
    });
  },
  renderAll() {
    this.renderHome();
    this.renderLibrary();
    this.renderSettings();
  },
  updatePreview() {
    const icon = document.getElementById("shortcut-icon")?.value || "cloud";
    const color = document.getElementById("shortcut-color")?.value || "neutral";
    const preview = document.getElementById("shortcut-preview");
    if (!preview) return;

    preview.className = "shortcut-preview";
    if (color !== "neutral") {
      preview.classList.add(color);
    }

    const use = preview.querySelector("use");
    if (use) {
      const iconset = Aura.storage.get("preferences", {}).iconset || "default";
      use.setAttribute("href", `#${iconset}-i-${icon}`);
    }
  },
  edit(item) {
    this.editingId = item.id;
    document.getElementById("shortcut-title").value = item.title;
    document.getElementById("shortcut-type").value = item.type;
    document.getElementById("shortcut-target").value = item.target;
    document.getElementById("shortcut-home").checked = item.showOnHome;
    document.getElementById("shortcut-icon").value = item.icon || (item.type === "windows" ? "folder" : "cloud");
    document.getElementById("shortcut-color").value = item.color || "neutral";
    document.getElementById("shortcut-error").textContent = "";
    this.updatePreview();
  },
  clearEditor() {
    this.editingId = null;
    document.getElementById("shortcut-title").value = "";
    document.getElementById("shortcut-type").value = "web";
    document.getElementById("shortcut-target").value = "";
    document.getElementById("shortcut-home").checked = true;
    document.getElementById("shortcut-icon").value = "cloud";
    document.getElementById("shortcut-color").value = "neutral";
    document.getElementById("shortcut-error").textContent = "";
    this.updatePreview();
  },
  init() {
    this.items = this.load();
    document.getElementById("shortcut-save").addEventListener("click", () => {
      const error = this.upsert({
        title: document.getElementById("shortcut-title").value,
        type: document.getElementById("shortcut-type").value,
        target: document.getElementById("shortcut-target").value,
        showOnHome: document.getElementById("shortcut-home").checked,
        icon: document.getElementById("shortcut-icon").value,
        color: document.getElementById("shortcut-color").value
      });
      document.getElementById("shortcut-error").textContent = error;
      if (!error) this.clearEditor();
    });
    document.getElementById("shortcut-cancel").addEventListener("click", () => this.clearEditor());
    document.getElementById("shortcut-icon").addEventListener("change", () => this.updatePreview());
    document.getElementById("shortcut-color").addEventListener("change", () => this.updatePreview());
    document.getElementById("shortcut-type").addEventListener("change", (e) => {
      const iconSelect = document.getElementById("shortcut-icon");
      if (e.target.value === "windows") {
        if (iconSelect.value === "cloud") iconSelect.value = "folder";
      } else {
        if (iconSelect.value === "folder") iconSelect.value = "cloud";
      }
      this.updatePreview();
    });
    document.getElementById("library-search").addEventListener("input", () => this.renderLibrary());
    this.renderAll();
    this.updatePreview();
  }
};
