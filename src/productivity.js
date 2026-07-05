window.Aura = window.Aura || {};

Aura.productivity = {
  durationMs: 25 * 60 * 1000,
  historyKey: "focus-history",
  timer: null,
  tasks: [],
  history: [],
  intervalId: null,
  remaining(timer, now = Date.now()) {
    return timer.running ? Math.max(0, timer.endsAt - now) : Math.max(0, timer.remainingMs);
  },
  completionTime(timer, now = Date.now()) {
    const endsAt = Number(timer?.endsAt);
    return Number.isFinite(endsAt) && endsAt > 0 ? Math.min(endsAt, now) : now;
  },
  addDays(value, amount) {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date.getTime();
  },
  addTask(tasks, title) {
    const clean = title.trim();
    return clean ? [...tasks, { id: this.makeId(), title: clean, completed: false }] : null;
  },
  toggleTask(tasks, id) {
    return tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
  },
  removeTask(tasks, id) {
    return tasks.filter(task => task.id !== id);
  },
  makeId() {
    return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  },
  saveTimer() {
    Aura.storage.set("focus-timer", this.timer);
  },
  saveTasks() {
    Aura.storage.set("tasks", this.tasks);
  },
  loadHistory() {
    const history = Aura.storage.get(this.historyKey, []);
    if (!Array.isArray(history)) return [];

    return history
      .filter(session => session && Number.isFinite(session.startedAt) && Number.isFinite(session.endedAt) && Number.isFinite(session.durationMs))
      .map(session => ({
        id: session.id || this.makeId(),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMs: session.durationMs,
        completed: session.completed === true
      }))
      .filter(session => session.completed);
  },
  saveHistory(history = this.history) {
    this.history = Array.isArray(history) ? history : [];
    Aura.storage.set(this.historyKey, this.history);
  },
  start() {
    if (this.timer.running) return;
    const now = Date.now();
    const remainingMs = this.remaining(this.timer) || this.durationMs;
    const isFreshSession = remainingMs >= this.durationMs || !this.timer.startedAt;
    const startedAt = isFreshSession ? now : this.timer.startedAt;
    const targetMs = this.timer.targetMs || (isFreshSession ? remainingMs : this.durationMs);

    this.timer = { running: true, remainingMs, endsAt: now + remainingMs, startedAt, targetMs };
    this.saveTimer();
    this.startInterval();
    this.renderTimer();
  },
  pause() {
    if (!this.timer.running) return;
    this.timer = {
      running: false,
      remainingMs: this.remaining(this.timer),
      endsAt: 0,
      startedAt: this.timer.startedAt || null,
      targetMs: this.timer.targetMs || this.durationMs
    };
    this.saveTimer();
    this.stopInterval();
    this.renderTimer();
  },
  reset() {
    this.timer = this.defaultTimer();
    this.saveTimer();
    this.stopInterval();
    this.renderTimer();
  },
  defaultTimer() {
    return { running: false, remainingMs: this.durationMs, endsAt: 0, startedAt: null, targetMs: this.durationMs };
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
      this.completeSession();
      return;
    }
    this.renderTimer();
  },
  completeSession({ playSound = true } = {}) {
    const endedAt = this.completionTime(this.timer);
    const durationMs = this.timer.targetMs || this.durationMs;
    const startedAt = this.timer.startedAt || endedAt - durationMs;
    const session = { id: this.makeId(), startedAt, endedAt, durationMs, completed: true };

    this.saveHistory([...this.history, session].slice(-500));
    this.timer = this.defaultTimer();
    this.saveTimer();
    this.stopInterval();
    if (playSound) this.playCompletionSound();
    this.renderTimer();
    this.renderStats();
  },
  playCompletionSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const context = new AudioContext();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.34);
      oscillator.addEventListener("ended", () => context.close());
    } catch {
      // Sound is optional. Ignore browsers that block or do not support it.
    }
  },
  startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  },
  startOfWeek(value = Date.now()) {
    const date = new Date(value);
    const dayOffset = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);
    return date.getTime();
  },
  sessionsBetween(start, end) {
    return this.history.filter(session => session.completed && session.endedAt >= start && session.endedAt < end);
  },
  minutesForRange(start, end) {
    const total = this.sessionsBetween(start, end).reduce((sum, session) => sum + session.durationMs, 0);
    return Math.round(total / 60000);
  },
  todayMinutes() {
    const start = this.startOfDay(Date.now());
    return this.minutesForRange(start, this.addDays(start, 1));
  },
  weekMinutes() {
    const start = this.startOfWeek();
    return this.minutesForRange(start, this.addDays(start, 7));
  },
  completedToday() {
    const start = this.startOfDay(Date.now());
    return this.sessionsBetween(start, this.addDays(start, 1)).length;
  },
  currentStreak() {
    const completedDays = new Set(this.history.map(session => this.startOfDay(session.endedAt)));
    let cursor = this.startOfDay(Date.now());
    if (!completedDays.has(cursor)) cursor = this.addDays(cursor, -1);

    let streak = 0;
    while (completedDays.has(cursor)) {
      streak += 1;
      cursor = this.addDays(cursor, -1);
    }
    return streak;
  },
  renderTimer() {
    const seconds = Math.ceil(this.remaining(this.timer) / 1000);
    document.getElementById("focus-time").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    document.getElementById("focus-start").disabled = this.timer.running;
    document.getElementById("focus-pause").disabled = !this.timer.running;
  },
  renderStats() {
    const today = this.todayMinutes();
    const week = this.weekMinutes();
    const completed = this.completedToday();
    const streak = this.currentStreak();

    document.getElementById("focus-today").textContent = `${today}m`;
    document.getElementById("focus-week").textContent = `${week}m this week`;
    document.getElementById("focus-completed-today").textContent = `${completed} session${completed === 1 ? "" : "s"} today`;
    document.getElementById("focus-streak").textContent = `${streak} day${streak === 1 ? "" : "s"} streak`;
    document.getElementById("focus-break-note").textContent = completed > 0 && completed % 4 === 0
      ? "Long break earned. Take 15–30 minutes."
      : "Complete 4 sessions to earn a long break.";

    this.renderWeekBars();
  },
  renderWeekBars() {
    const root = document.getElementById("focus-week-bars");
    if (!root) return;

    const weekStart = this.startOfWeek();
    const days = Array.from({ length: 7 }, (_, index) => {
      const start = this.addDays(weekStart, index);
      return { start, minutes: this.minutesForRange(start, this.addDays(start, 1)) };
    });
    const maxMinutes = Math.max(25, ...days.map(day => day.minutes));

    root.replaceChildren();
    days.forEach(day => {
      const item = document.createElement("li");
      const bar = document.createElement("span");
      const label = document.createElement("small");
      const height = day.minutes === 0 ? 6 : Math.max(12, Math.round((day.minutes / maxMinutes) * 100));

      item.className = "focus-week-bar";
      item.classList.toggle("today", day.start === this.startOfDay(Date.now()));
      item.title = `${day.minutes} focus minutes`;
      bar.style.setProperty("--bar-height", `${height}%`);
      label.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(day.start)).slice(0, 2);

      item.append(bar, label);
      root.append(item);
    });
  },
  exportHistory() {
    const blob = new Blob([JSON.stringify(this.history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `focus-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
    this.timer = { ...this.defaultTimer(), ...Aura.storage.get("focus-timer", {}) };
    this.tasks = Aura.storage.get("tasks", []);
    this.history = this.loadHistory();
    if (!Array.isArray(this.tasks)) this.tasks = [];
    const root = document.getElementById("productivity-root");
    root.innerHTML = `
      <div class="focus-column">
        <section class="focus-stats card">
          <header><h3>Today</h3><button id="focus-export" type="button">Export</button></header>
          <strong id="focus-today">0m</strong>
          <p id="focus-week">0m this week</p>
          <p id="focus-completed-today">0 sessions today</p>
          <p id="focus-streak">0 day streak</p>
          <p id="focus-break-note">Complete 4 sessions to earn a long break.</p>
          <ol class="focus-week-bars" id="focus-week-bars" aria-label="Focus minutes this week"></ol>
        </section>
        <section class="focus-timer card">
          <strong id="focus-time">25:00</strong>
          <div><button id="focus-start" type="button">Start</button><button id="focus-pause" type="button">Pause</button><button id="focus-reset" type="button">Reset</button></div>
        </section>
      </div>
      <section class="task-panel card">
        <form id="task-form"><input id="task-input" placeholder="Add a task" aria-label="Task title"><button type="submit">Add</button></form>
        <ul class="task-list" id="task-list"></ul>
      </section>`;
    document.getElementById("focus-start").addEventListener("click", () => this.start());
    document.getElementById("focus-pause").addEventListener("click", () => this.pause());
    document.getElementById("focus-reset").addEventListener("click", () => this.reset());
    document.getElementById("focus-export").addEventListener("click", () => this.exportHistory());
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
    else if (this.timer.running) this.completeSession({ playSound: false });
    this.renderTimer();
    this.renderStats();
    this.renderTasks();
  }
};
