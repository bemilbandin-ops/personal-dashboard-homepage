window.Aura = window.Aura || {};

Aura.search = {
  destination(value, engine) {
    const query = value.trim();
    if (!query) return null;
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(query)) return query;
    if (/^(localhost|(?:\d{1,3}\.){3}\d{1,3})(:\d+)?(?:\/.*)?$/i.test(query)) return `http://${query}`;
    if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/i.test(query)) return `https://${query}`;
    return Aura.config.search.engines[engine] + encodeURIComponent(query);
  },
  init(preferences) {
    const input = document.getElementById("search-input");
    const open = event => {
      event.preventDefault();
      const target = this.destination(input.value, preferences.searchEngine);
      if (target) location.href = target;
    };
    document.getElementById("search-form").addEventListener("submit", open);
    input.addEventListener("keydown", event => event.key === "Enter" && open(event));
  }
};
