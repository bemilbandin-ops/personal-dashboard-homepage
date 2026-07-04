window.Aura = window.Aura || {};

Aura.config = {
  clock: { format: "24h", showDate: true },
  search: {
    defaultEngine: "brave",
    engines: {
      brave: "https://search.brave.com/search?q=",
      google: "https://www.google.com/search?q=",
      duckduckgo: "https://duckduckgo.com/?q="
    }
  },
  weather: {
    location: "Fristad",
    latitude: 57.8248,
    longitude: 13.0109
  },
  spaces: [
    { id: "github", title: "GitHub", type: "web", target: "https://github.com", showOnHome: true, icon: "code", color: "neutral" },
    { id: "youtube", title: "YouTube", type: "web", target: "https://youtube.com", showOnHome: true, icon: "play", color: "red" },
    { id: "spotify", title: "Spotify", type: "web", target: "spotify:", showOnHome: true, icon: "headphones", color: "green" },
    { id: "mail", title: "Mail", type: "web", target: "https://mail.google.com", showOnHome: true, icon: "mail", color: "blue" },
    { id: "figma", title: "Figma", type: "web", target: "https://figma.com", showOnHome: true, icon: "design", color: "purple" }
  ]
};
