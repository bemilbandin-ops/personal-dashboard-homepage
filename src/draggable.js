window.Aura = window.Aura || {};

Aura.draggable = {
  storageKey: "widgets-layout-responsive",
  unlocked: false,
  layout: {},
  zIndex: 10,

  init(unlocked) {
    this.layout = Aura.storage.get(this.storageKey, {});
    this.cards = document.querySelectorAll(".widgets .card");
    this.container = document.querySelector(".widgets");

    this.cards.forEach(card => {
      let handle;
      if (card.classList.contains("weather")) {
        handle = card;
      } else if (card.classList.contains("scratchpad")) {
        handle = card.querySelector("header");
      }
      if (handle) handle.classList.add("drag-handle");
      
      // Resize handle
      let resizer = card.querySelector(".resize-handle");
      if (!resizer) {
        resizer = document.createElement("div");
        resizer.className = "resize-handle";
        card.append(resizer);
      }

      const id = card.id;
      if (this.layout[id]) {
        this.applyLayout(card, this.layout[id]);
      }

      this.bindDrag(card, handle);
      this.bindResize(card, resizer);
    });

    this.containerObserver = new ResizeObserver(() => {
      if (this.unlocked && !this.isCompact()) {
        this.positionCards([...this.cards].filter(card => !card.hidden && card.style.position !== "absolute"));
      }
    });
    if (this.container) this.containerObserver.observe(this.container);
    this.toggle(unlocked);
  },

  applyLayout(card, bounds) {
    card.style.position = "absolute";
    card.style.left = `${bounds.left * 100}%`;
    card.style.top = `${bounds.top * 100}%`;
    card.style.width = `${bounds.width * 100}%`;
    card.style.height = `${bounds.height * 100}%`;
    card.style.zIndex = bounds.zIndex || 10;
    card.style.margin = "0";
  },

  isCompact() {
    return matchMedia("(max-width: 1023px)").matches;
  },

  positionCards(cards) {
    const container = this.container.getBoundingClientRect();
    if (this.isCompact() || !container.width || !container.height || !cards.length) return;
    const positions = cards.map(card => {
      const rect = card.getBoundingClientRect();
      return [card, {
        left: (rect.left - container.left) / container.width,
        top: (rect.top - container.top) / container.height,
        width: rect.width / container.width,
        height: rect.height / container.height,
        zIndex: 10
      }];
    });
    positions.forEach(([card, bounds]) => {
      this.layout[card.id] = bounds;
      this.applyLayout(card, bounds);
    });
    this.saveLayout();
  },

  saveLayout() {
    Aura.storage.set(this.storageKey, this.layout);
  },

  toggle(unlocked) {
    this.unlocked = unlocked;
    document.body.classList.toggle("widgets-unlocked", unlocked);
    if (unlocked && !this.isCompact()) {
      this.positionCards([...this.cards].filter(card => !card.hidden && card.style.position !== "absolute"));
    }
  },

  bindDrag(card, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle?.addEventListener("pointerdown", e => {
      if (!this.unlocked || this.isCompact()) return;
      const closestInteractive = e.target.closest("button, input, textarea, a");
      if (closestInteractive && closestInteractive !== card) return; // Don't drag if clicking an interactive element inside the card

      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = card.offsetLeft;
      initialTop = card.offsetTop;
      
      this.zIndex++;
      card.style.zIndex = this.zIndex;
      
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    handle?.addEventListener("pointermove", e => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.min(this.container.clientWidth - card.offsetWidth, initialLeft + dx));
      const newTop = Math.max(0, Math.min(this.container.clientHeight - card.offsetHeight, initialTop + dy));
      
      card.style.left = newLeft + "px";
      card.style.top = newTop + "px";
    });

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      this.layout[card.id] = {
        ...this.layout[card.id],
        left: card.offsetLeft / this.container.clientWidth,
        top: card.offsetTop / this.container.clientHeight,
        zIndex: this.zIndex
      };
      this.saveLayout();
    };

    handle?.addEventListener("pointerup", stopDrag);
    handle?.addEventListener("pointercancel", stopDrag);
  },

  bindResize(card, resizer) {
    let isResizing = false;
    let startX, startY, initialWidth, initialHeight;

    resizer.addEventListener("pointerdown", e => {
      if (!this.unlocked || this.isCompact()) return;
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      initialWidth = card.offsetWidth;
      initialHeight = card.offsetHeight;
      
      this.zIndex++;
      card.style.zIndex = this.zIndex;
      
      resizer.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });

    resizer.addEventListener("pointermove", e => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newWidth = Math.min(this.container.clientWidth, Math.max(200, initialWidth + dx));
      const newHeight = Math.min(this.container.clientHeight, Math.max(100, initialHeight + dy));
      
      card.style.width = newWidth + "px";
      card.style.height = newHeight + "px";
    });

    const stopResize = () => {
      if (!isResizing) return;
      isResizing = false;
      this.layout[card.id] = {
        ...this.layout[card.id],
        width: card.offsetWidth / this.container.clientWidth,
        height: card.offsetHeight / this.container.clientHeight,
        zIndex: this.zIndex
      };
      this.saveLayout();
    };

    resizer.addEventListener("pointerup", stopResize);
    resizer.addEventListener("pointercancel", stopResize);
  }
};
