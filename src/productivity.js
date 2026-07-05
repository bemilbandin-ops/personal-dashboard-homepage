window.Aura = window.Aura || {};

Aura.productivity = {
  durationMs: 25 * 60 * 1000,
  timer: null,
  tasks: [],
  intervalId: null,
  remaining(timer, now = Date.now()) {
    return timer.running ? Math.max(0, timer.endsAt - now) : Math.max(0, timer.remainingMs);
  },
  addTask(tasks, title) {
    const clean = title.trim();
    return clean ? [...tasks, { id: crypto.randomUUID(), title: clean, completed: false }] : null;
  },
  toggleTask(tasks, id) {
    return tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
  },
  removeTask(tasks, id) {
    return tasks.filter(task => task.id !== id);
  },
  saveTimer() {
    Aura.storage.set("focus-timer", this.timer);
  },
  saveTasks() {
    Aura.storage.set("tasks", this.tasks);
  },
  start() {
    if (this.timer.running) return;
    const remainingMs = this.remaining(this.timer) || this.durationMs;
    this.timer = { running: true, remainingMs, endsAt: Date.now() + remainingMs };
    this.saveTimer();
    this.startInterval();
    this.renderTimer();
  },
  pause() {
    if (!this.timer.running) return;
    this.timer = { running: false, remainingMs: this.remaining(this.timer), endsAt: 0 };
    this.saveTimer();
    this.stopInterval();
    this.renderTimer();
  },
  reset() {
    this.timer = { running: false, remainingMs: this.durationMs, endsAt: 0 };
    this.saveTimer();
    this.stopInterval();
    this.renderTimer();
  },
  startInterval() {
    if (this.intervalId === null) this.intervalId = setInterval(() => this.tick(), 1000);
  },
  stopInterval() {
    if (this.intervalId !== null) clearInterval(this.intervalId);
    this.intervalId = null;
  },
  tick() {
    if (this.remaining(this.timer) === 0) {
      this.timer = { running: false, remainingMs: 0, endsAt: 0 };
      this.saveTimer();
      this.stopInterval();
    }
    this.renderTimer();
  },
  renderTimer() {
    const seconds = Math.ceil(this.remaining(this.timer) / 1000);
    document.getElementById("focus-time").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    document.getElementById("focus-start").disabled = this.timer.running;
    document.getElementById("focus-pause").disabled = !this.timer.running;
  },
  renderTasks() {
    const root = document.getElementById("task-list");
    root.replaceChildren();
    this.tasks.forEach(task => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", () => {
        this.tasks = this.toggleTask(this.tasks, task.id);
        this.saveTasks();
        this.renderTasks();
      });
      const title = document.createElement("span");
      title.textContent = task.title;
      label.append(checkbox, title);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        this.tasks = this.removeTask(this.tasks, task.id);
        this.saveTasks();
        this.renderTasks();
      });
      item.append(label, remove);
      root.append(item);
    });
  },
  init() {
    this.timer = { running: false, remainingMs: this.durationMs, endsAt: 0, ...Aura.storage.get("focus-timer", {}) };
    this.tasks = Aura.storage.get("tasks", []);
    if (!Array.isArray(this.tasks)) this.tasks = [];
    const root = document.getElementById("productivity-root");
    root.innerHTML = `
      <section class="focus-timer card">
        <strong id="focus-time">25:00</strong>
        <div><button id="focus-start" type="button">Start</button><button id="focus-pause" type="button">Pause</button><button id="focus-reset" type="button">Reset</button></div>
      </section>
      <section class="task-panel card">
        <form id="task-form"><input id="task-input" placeholder="Add a task" aria-label="Task title"><button type="submit">Add</button></form>
        <ul class="task-list" id="task-list"></ul>
      </section>`;
    document.getElementById("focus-start").addEventListener("click", () => this.start());
    document.getElementById("focus-pause").addEventListener("click", () => this.pause());
    document.getElementById("focus-reset").addEventListener("click", () => this.reset());
    document.getElementById("task-form").addEventListener("submit", event => {
      event.preventDefault();
      const input = document.getElementById("task-input");
      const next = this.addTask(this.tasks, input.value);
      if (!next) return;
      this.tasks = next;
      input.value = "";
      this.saveTasks();
      this.renderTasks();
    });
    if (this.timer.running && this.remaining(this.timer) > 0) this.startInterval();
    else if (this.timer.running) {
      this.timer = { running: false, remainingMs: 0, endsAt: 0 };
      this.saveTimer();
    }
    this.renderTimer();
    this.renderTasks();
  }
};
