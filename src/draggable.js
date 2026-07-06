window.Aura = window.Aura || {};

Aura.draggable = {
  storageKey: "widgets-layout",
  unlocked: false,
  layout: {},
  zIndex: 10,

  init(unlocked) {
    this.layout = Aura.storage.get(this.storageKey, {});
    this.cards = document.querySelectorAll(".widgets .card");
    this.container = document.querySelector(".dashboard");
    
    // Ensure dashboard is relative so absolute children position correctly
    if (this.container) {
        this.container.style.position = "relative";
    }

    this.cards.forEach(card => {
      // Create a drag handle overlay for the weather widget, and use header for scratchpad
      let handle = card.querySelector(".drag-handle");
      if (!handle) {
        if (card.classList.contains("weather")) {
          // Add a discrete drag handle for weather
          handle = document.createElement("div");
          handle.className = "drag-handle";
          card.prepend(handle);
        } else if (card.classList.contains("scratchpad")) {
          handle = card.querySelector("header");
          handle.classList.add("drag-handle");
        }
      }
      
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

    this.toggle(unlocked);
  },

  applyLayout(card, bounds) {
    card.style.position = "absolute";
    card.style.left = bounds.left + "px";
    card.style.top = bounds.top + "px";
    card.style.width = bounds.width + "px";
    card.style.height = bounds.height + "px";
    card.style.zIndex = bounds.zIndex || 10;
    card.style.margin = "0";
  },

  saveLayout() {
    Aura.storage.set(this.storageKey, this.layout);
  },

  toggle(unlocked) {
    this.unlocked = unlocked;
    document.body.classList.toggle("widgets-unlocked", unlocked);
    this.cards.forEach(card => {
      if (unlocked && card.style.position !== "absolute") {
        // Initialize position based on current grid location if not already absolute
        const rect = card.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        const left = rect.left - containerRect.left;
        const top = rect.top - containerRect.top;
        
        card.style.position = "absolute";
        card.style.left = left + "px";
        card.style.top = top + "px";
        card.style.width = rect.width + "px";
        card.style.height = rect.height + "px";
        card.style.margin = "0";
        
        this.layout[card.id] = { left, top, width: rect.width, height: rect.height, zIndex: 10 };
      }
    });
    if (unlocked) {
      this.saveLayout();
    }
  },

  bindDrag(card, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle?.addEventListener("pointerdown", e => {
      if (!this.unlocked) return;
      if (e.target.closest("button, input, textarea")) return; // Don't drag if clicking a button
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(card.style.left) || 0;
      initialTop = parseFloat(card.style.top) || 0;
      
      this.zIndex++;
      card.style.zIndex = this.zIndex;
      
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    handle?.addEventListener("pointermove", e => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = initialLeft + dx;
      const newTop = initialTop + dy;
      
      card.style.left = newLeft + "px";
      card.style.top = newTop + "px";
    });

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      this.layout[card.id] = {
        ...this.layout[card.id],
        left: parseFloat(card.style.left),
        top: parseFloat(card.style.top),
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
      if (!this.unlocked) return;
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      initialWidth = parseFloat(card.style.width) || card.offsetWidth;
      initialHeight = parseFloat(card.style.height) || card.offsetHeight;
      
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
      const newWidth = Math.max(200, initialWidth + dx);
      const newHeight = Math.max(100, initialHeight + dy);
      
      card.style.width = newWidth + "px";
      card.style.height = newHeight + "px";
    });

    const stopResize = () => {
      if (!isResizing) return;
      isResizing = false;
      this.layout[card.id] = {
        ...this.layout[card.id],
        width: parseFloat(card.style.width),
        height: parseFloat(card.style.height),
        zIndex: this.zIndex
      };
      this.saveLayout();
    };

    resizer.addEventListener("pointerup", stopResize);
    resizer.addEventListener("pointercancel", stopResize);
  }
};
