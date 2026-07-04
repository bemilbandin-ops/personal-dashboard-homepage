window.Aura = window.Aura || {};

Aura.notes = {
  key: "notes-library",
  items: [],

  init() {
    this.textarea = document.getElementById("scratchpad");
    this.status = document.getElementById("save-status");
    this.items = this.load();
    document.getElementById("save-note-library")?.addEventListener("click", () => this.saveCurrent());
    this.render();
  },

  load() {
    const items = Aura.storage.get(this.key, []);
    return Array.isArray(items) ? items.filter(item => item?.id && item?.content) : [];
  },

  saveAll() {
    return Aura.storage.set(this.key, this.items);
  },

  makeId() {
    return globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },

  saveCurrent() {
    const content = this.textarea?.value.trim();
    if (!content) {
      this.setStatus("Nothing to save");
      return;
    }

    const firstLine = content.split("\n").find(Boolean)?.slice(0, 48) || "Untitled note";
    const title = prompt("Note title", firstLine) || firstLine;
    const now = new Date().toISOString();
    this.items = [{ id: this.makeId(), title: title.trim() || "Untitled note", content, createdAt: now, updatedAt: now }, ...this.items].slice(0, 100);
    const saved = this.saveAll();
    this.render();
    this.setStatus(saved ? "Saved to library" : "Not saved");
  },

  loadNote(id) {
    const note = this.items.find(item => item.id === id);
    if (!note || !this.textarea) return;
    this.textarea.value = note.content;
    Aura.storage.set("scratchpad", note.content);
    this.setStatus("Loaded note");
    location.hash = "#home";
  },

  deleteNote(id) {
    if (!confirm("Delete this saved note?")) return;
    this.items = this.items.filter(item => item.id !== id);
    this.saveAll();
    this.render();
  },

  setStatus(message) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.remove("saving");
    clearTimeout(this.statusTimer);
    if (message === "Not saved" || message === "Nothing to save") return;
    this.statusTimer = setTimeout(() => { this.status.textContent = "Saved"; }, 1800);
  },

  render() {
    const root = document.getElementById("library-notes");
    if (!root) return;
    root.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Saved Notes";
    root.append(heading);

    if (!this.items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No saved notes yet.";
      root.append(empty);
      return;
    }

    this.items.forEach(note => {
      const card = document.createElement("article");
      card.className = "library-note";
      const title = document.createElement("strong");
      const preview = document.createElement("p");
      const meta = document.createElement("small");
      const actions = document.createElement("span");
      const load = document.createElement("button");
      const remove = document.createElement("button");

      title.textContent = note.title;
      preview.textContent = note.content.slice(0, 160);
      meta.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.createdAt));
      load.type = "button";
      load.textContent = "Load";
      load.addEventListener("click", () => this.loadNote(note.id));
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => this.deleteNote(note.id));
      actions.append(load, remove);
      card.append(title, preview, meta, actions);
      root.append(card);
    });
  }
};
