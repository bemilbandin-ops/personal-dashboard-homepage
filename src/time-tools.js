window.Aura = window.Aura || {};

Aura.timeTools = {
  alarmsKey: "time-tools:alarms",
  alarms: [],
  timer: { running: false, remainingMs: 0, endsAt: 0, sound: "chime" },
  stopwatch: { running: false, startedAt: 0, elapsedMs: 0, sound: "soft", laps: [] },
  tickId: null,

  init() {
    this.dialog = document.getElementById("time-tools-dialog");
    this.alarms = this.loadAlarms();
    this.bind();
    this.renderAlarms();
    this.updateTimerDisplay();
    this.updateStopwatchDisplay();
    this.updateTicking();
  },

  updateTicking() {
    const shouldTick = this.alarms.length > 0 || this.timer.running || this.stopwatch.running;
    if (shouldTick && this.tickId === null) {
      this.tickId = setInterval(() => this.tick(), 500);
    }
    if (!shouldTick && this.tickId !== null) {
      clearInterval(this.tickId);
      this.tickId = null;
    }
  },

  bind() {
    document.getElementById("time-tools-form")?.addEventListener("submit", event => event.preventDefault());
    document.getElementById("alarm-add")?.addEventListener("click", () => this.addAlarm());
    document.getElementById("timer-start")?.addEventListener("click", () => this.startTimer());
    document.getElementById("timer-pause")?.addEventListener("click", () => this.pauseTimer());
    document.getElementById("timer-reset")?.addEventListener("click", () => this.resetTimer());
    document.getElementById("stopwatch-start")?.addEventListener("click", () => this.startStopwatch());
    document.getElementById("stopwatch-pause")?.addEventListener("click", () => this.pauseStopwatch());
    document.getElementById("stopwatch-lap")?.addEventListener("click", () => this.lapStopwatch());
    document.getElementById("stopwatch-reset")?.addEventListener("click", () => this.resetStopwatch());
  },

  open() {
    if (!this.dialog?.open) this.dialog?.showModal();
  },

  loadAlarms() {
    const alarms = Aura.storage.get(this.alarmsKey, []);
    return Array.isArray(alarms) ? alarms.filter(alarm => alarm?.id && alarm?.time && alarm?.dueAt) : [];
  },

  saveAlarms() {
    Aura.storage.set(this.alarmsKey, this.alarms);
  },

  makeId() {
    return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },

  clampNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.floor(number)));
  },

  addAlarm() {
    const time = document.getElementById("alarm-time")?.value;
    const sound = document.getElementById("alarm-sound")?.value || "chime";
    const status = document.getElementById("alarm-status");
    if (!time) {
      if (status) status.textContent = "Choose a time first.";
      return;
    }

    const dueAt = this.nextAlarmTime(time).toISOString();
    this.alarms = [...this.alarms, { id: this.makeId(), time, sound, dueAt }].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    this.saveAlarms();
    this.renderAlarms();
    this.updateTicking();
    if (status) status.textContent = `Alarm set for ${this.formatDue(dueAt)}.`;
  },

  nextAlarmTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const due = new Date();
    due.setHours(hours, minutes, 0, 0);
    if (due.getTime() <= Date.now()) due.setDate(due.getDate() + 1);
    return due;
  },

  renderAlarms() {
    const list = document.getElementById("alarm-list");
    if (!list) return;
    list.replaceChildren();
    if (!this.alarms.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No alarms set.";
      list.append(empty);
      return;
    }

    this.alarms.forEach(alarm => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const remove = document.createElement("button");
      label.innerHTML = `<b>${alarm.time}</b><small>${this.formatDue(alarm.dueAt)} · ${alarm.sound}</small>`;
      remove.type = "button";
      remove.innerHTML = `<svg aria-hidden="true"><use href="#i-trash"/></svg><span class="sr-only">Remove</span>`;
      remove.setAttribute("aria-label", `Remove alarm ${alarm.time}`);
      remove.addEventListener("click", () => {
        this.alarms = this.alarms.filter(item => item.id !== alarm.id);
        this.saveAlarms();
        this.renderAlarms();
        this.updateTicking();
      });
      item.append(label, remove);
      list.append(item);
    });
  },

  startTimer() {
    const minutesInput = document.getElementById("timer-minutes");
    const secondsInput = document.getElementById("timer-seconds");
    const minutes = this.clampNumber(minutesInput?.value, 0, 999);
    const seconds = this.clampNumber(secondsInput?.value, 0, 59);
    if (minutesInput) minutesInput.value = String(minutes);
    if (secondsInput) secondsInput.value = String(seconds);
    const sound = document.getElementById("timer-sound")?.value || "chime";
    const durationMs = this.timer.remainingMs || ((minutes * 60) + seconds) * 1000;
    if (!durationMs) return;
    this.timer = { running: true, remainingMs: durationMs, endsAt: Date.now() + durationMs, sound };
    this.updateTimerDisplay();
    this.updateTicking();
  },

  pauseTimer() {
    if (!this.timer.running) return;
    this.timer = { ...this.timer, running: false, remainingMs: Math.max(0, this.timer.endsAt - Date.now()), endsAt: 0 };
    this.updateTimerDisplay();
    this.updateTicking();
  },

  resetTimer() {
    this.timer = { running: false, remainingMs: 0, endsAt: 0, sound: document.getElementById("timer-sound")?.value || "chime" };
    this.updateTimerDisplay();
    this.updateTicking();
  },

  completeTimer() {
    const sound = this.timer.sound;
    this.resetTimer();
    this.playSound(sound);
    alert("Timer complete.");
  },

  startStopwatch() {
    if (this.stopwatch.running) return;
    this.stopwatch = {
      ...this.stopwatch,
      running: true,
      startedAt: Date.now(),
      sound: document.getElementById("stopwatch-sound")?.value || "soft"
    };
    this.updateStopwatchDisplay();
    this.updateTicking();
  },

  pauseStopwatch() {
    if (!this.stopwatch.running) return;
    this.stopwatch = {
      ...this.stopwatch,
      running: false,
      elapsedMs: this.stopwatch.elapsedMs + Date.now() - this.stopwatch.startedAt,
      startedAt: 0
    };
    this.updateStopwatchDisplay();
    this.updateTicking();
  },

  lapStopwatch() {
    const elapsedMs = this.currentStopwatchMs();
    if (!elapsedMs) return;
    this.stopwatch.laps = [...this.stopwatch.laps, elapsedMs].slice(-8);
    this.playSound(this.stopwatch.sound);
    this.renderLaps();
  },

  resetStopwatch() {
    this.stopwatch = { running: false, startedAt: 0, elapsedMs: 0, sound: document.getElementById("stopwatch-sound")?.value || "soft", laps: [] };
    this.updateStopwatchDisplay();
    this.renderLaps();
    this.updateTicking();
  },

  currentStopwatchMs() {
    return this.stopwatch.elapsedMs + (this.stopwatch.running ? Date.now() - this.stopwatch.startedAt : 0);
  },

  tick() {
    const now = Date.now();
    const due = this.alarms.filter(alarm => new Date(alarm.dueAt).getTime() <= now);
    if (due.length) {
      this.alarms = this.alarms.filter(alarm => new Date(alarm.dueAt).getTime() > now);
      this.saveAlarms();
      this.renderAlarms();
      due.forEach(alarm => {
        this.playSound(alarm.sound);
        alert(`Alarm ${alarm.time}`);
      });
    }

    if (this.timer.running) {
      this.timer.remainingMs = Math.max(0, this.timer.endsAt - now);
      this.updateTimerDisplay();
      if (this.timer.remainingMs <= 0) this.completeTimer();
    }

    if (this.stopwatch.running) this.updateStopwatchDisplay();
    this.updateTicking();
  },

  updateTimerDisplay() {
    const display = document.getElementById("timer-display");
    if (display) display.textContent = this.formatDuration(this.timer.remainingMs);
  },

  updateStopwatchDisplay() {
    const display = document.getElementById("stopwatch-display");
    if (display) display.textContent = this.formatDuration(this.currentStopwatchMs(), true);
  },

  renderLaps() {
    const list = document.getElementById("stopwatch-laps");
    if (!list) return;
    list.replaceChildren();
    this.stopwatch.laps.forEach((lap, index) => {
      const item = document.createElement("li");
      item.textContent = `Lap ${index + 1}: ${this.formatDuration(lap, true)}`;
      list.append(item);
    });
  },

  formatDuration(ms, showTenths = false) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    if (!showTenths) return `${minutes}:${seconds}`;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds}.${tenths}`;
  },

  formatDue(value) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  },

  playSound(name = "chime") {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const presets = {
      chime: [660, 880, 990],
      bell: [520, 780, 1040],
      soft: [440, 554, 660]
    };
    const notes = presets[name] || presets.chime;
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = name === "bell" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const start = context.currentTime + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
    setTimeout(() => context.close(), 1200);
  }
};
