window.Aura = window.Aura || {};

Aura.shortcuts = {
  normalize(items) {
    return (Array.isArray(items) ? items : []).map(item => ({
      id: typeof item?.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
      title: typeof item?.title === "string" ? item.title.trim() : "",
      type: item?.type === "windows" ? "windows" : "web",
      target: typeof item?.target === "string" ? item.target.trim() : "",
      showOnHome: item?.showOnHome !== false
    })).filter(item => item.title && item.target);
  },
  load() {
    return this.normalize(Aura.storage.get("shortcuts", Aura.config.spaces));
  },
  save(items) {
    Aura.storage.set("shortcuts", this.normalize(items));
  },
  validate(item) {
    if (!item.title?.trim() || !item.target?.trim()) return false;
    return item.type === "windows"
      ? /^[a-z]:[\\/].*\.(?:exe|lnk)$/i.test(item.target)
      : /^(?!javascript:|data:|vbscript:)[a-z][a-z\d+.-]*:/i.test(item.target);
  }
};
