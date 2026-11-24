/* ---------------------------------------------------------
   HabitTracker — app logic
   Data is stored locally in the browser (localStorage).
   --------------------------------------------------------- */
(() => {
  "use strict";

  const KEY = "habittracker.v1";
  const C = 2 * Math.PI * 50; // ring circumference
  const ICONS = ["gym", "water", "book", "laptop", "lotus", "bed"];
  const CATEGORIES = ["Health", "Learning", "Career", "Mindfulness", "Fitness", "Finance", "Creativity", "Other"];
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------------- dates ---------------- */
  const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shift = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const TODAY = iso(startOfDay());
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const parse = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- seed data ---------------- */
  function seedHabits() {
    const base = startOfDay();
    // last five days (oldest -> yesterday), mirroring the reference design
    const recent = {
      gym: [1, 1, 1, 1, 1],
      water: [1, 1, 1, 1, 1],
      book: [1, 1, 1, 0, 0],
      laptop: [0, 0, 0, 0, 0],
      lotus: [1, 1, 1, 0, 0],
      bed: [1, 0, 1, 0, 0],
    };
    const defs = [
      ["gym", "Exercise / Gym", "Health"],
      ["water", "Drink Water", "Health"],
      ["book", "Read Book", "Learning"],
      ["laptop", "Study / Coding", "Career"],
      ["lotus", "Meditate", "Mindfulness"],
      ["bed", "Early Sleep", "Health"],
    ];
    const todayDone = { gym: 1, water: 1, book: 1, lotus: 1, bed: 1 };

    return defs.map(([icon, name, category]) => {
      const done = {};
      for (let off = 1; off <= 40; off++) {
        const key = iso(shift(base, -off));
        if (off <= 5) {
          if (recent[icon][5 - off]) done[key] = true;
          continue;
        }
        if (off === 12) continue; // streak break
        if (icon === "laptop") {
          if (off % 6 === 0) done[key] = true;
          continue;
        }
        done[key] = true;
      }
      if (todayDone[icon]) done[TODAY] = true;
      return { id: icon, name, category, icon, freq: "Daily", done };
    });
  }

  function defaultState() {
    const d = startOfDay();
    return {
      name: "Harsh",
      joined: iso(d),
      habits: seedHabits(),
      view: { y: d.getFullYear(), m: d.getMonth() },
      tab: "home",
    };
  }

  /* ---------------- storage ---------------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.habits)) return defaultState();
      parsed.habits.forEach((h) => {
        h.done = h.done && typeof h.done === "object" ? h.done : {};
        if (!ICONS.includes(h.icon)) h.icon = "check";
      });
      if (!parsed.view || typeof parsed.view.m !== "number") {
        const d = startOfDay();
        parsed.view = { y: d.getFullYear(), m: d.getMonth() };
      }
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  let state = load();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — app still works for this session */
    }
  };

  /* ---------------- metrics ---------------- */
  const hasOn = (habit, key) => !!habit.done[key];
  const dayCount = (key) => state.habits.filter((h) => hasOn(h, key)).length;
  const totalChecks = () => state.habits.reduce((n, h) => n + Object.keys(h.done).filter((k) => h.done[k]).length, 0);
  const todayDone = () => (state.habits.length ? dayCount(TODAY) : 0);
  const todayPct = () => (state.habits.length ? Math.round((todayDone() / state.habits.length) * 100) : 0);
  const overallPct = (days = 30) => {
    if (!state.habits.length) return 0;
    let total = 0;
    for (let i = 0; i < days; i++) total += dayCount(iso(shift(startOfDay(), -i)));
    return Math.round((total / (state.habits.length * days)) * 100);
  };

  function streak() {
    let i = 0;
    let n = 0;
    if (!dayCount(iso(shift(startOfDay(), 0)))) i = 1;
    while (i < 400 && dayCount(iso(shift(startOfDay(), -i)))) {
      n++;
      i++;
    }
    return n;
  }

  function bestStreak() {
    let best = 0;
    let cur = 0;
    for (let i = 120; i >= 0; i--) {
      if (dayCount(iso(shift(startOfDay(), -i)))) {
        cur++;
        best = Math.max(best, cur);
      } else cur = 0;
    }
    return best;
  }

  const perfectDays = () =>
    state.habits.length > 0 &&
    Array.from({ length: 30 }, (_, i) => iso(shift(startOfDay(), -i))).some(
      (k) => dayCount(k) === state.habits.length
    );

  /* ---------------- home render ---------------- */
  function renderHero() {
    $("#heroName").textContent = `${state.name || "Friend"}!`;
  }

  function renderStats() {
    const pct = todayPct();
    $("#ringValue").textContent = `${pct}%`;
    const bar = $("#ringBar");
    bar.style.strokeDasharray = C;
    bar.style.strokeDashoffset = C - (C * pct) / 100;
    $("#statStreak").textContent = streak();
    $("#statDone").textContent = `${todayDone()} / ${state.habits.length}`;
    $("#statOverall").textContent = `${overallPct()}%`;
  }

  function renderCalendar() {
    const { y, m } = state.view;
    const first = new Date(y, m, 1);
    const monthName = first.toLocaleDateString("en-US", { month: "long" });
    $("#calTitle").textContent = `${monthName} ${y}`;

    if (!$("#calWeekdays").children.length) {
      $("#calWeekdays").innerHTML = WD.map((d) => `<span>${d}</span>`).join("");
    }

    const cells = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7) * 7;
    const todayS = startOfDay().getTime();
    let html = "";

    for (let i = 0; i < cells; i++) {
      const d = new Date(y, m, 1 - first.getDay() + i);
      const key = iso(d);
      const inMonth = d.getMonth() === m;
      const time = d.getTime();
      const classes = ["cal-day"];
      if (!inMonth) classes.push("is-muted");
      if (time === todayS) classes.push("is-today");
      else if (time < todayS && dayCount(key) > 0) classes.push("is-done");
      else if (time > todayS) classes.push("is-future");
      html += `<div class="${classes.join(" ")}" role="gridcell" aria-label="${d.toDateString()}">${d.getDate()}</div>`;
    }
    $("#calGrid").innerHTML = html;
  }

  function renderHabits() {
    const list = $("#habitList");
    if (!state.habits.length) {
      list.innerHTML = `<div class="empty">No habits yet — tap “Add Habit” to start.</div>`;
      return;
    }
    list.innerHTML = state.habits
      .map((h) => {
        const dots = [5, 4, 3, 2, 1]
          .map((off) => {
            const key = iso(shift(startOfDay(), -off));
            const done = hasOn(h, key);
            return `<button class="dot${done ? " is-done" : ""}" type="button" data-habit="${h.id}" data-date="${key}" aria-pressed="${done}" aria-label="${esc(h.name)} on ${parse(key).toDateString()}" title="${parse(key).toDateString()}"><svg><use href="#i-check"/></svg></button>`;
          })
          .join("");
        return `<article class="habit" data-habit="${h.id}" tabindex="0" role="button" aria-label="${esc(h.name)} details">
          <span class="habit__icon"><svg><use href="#i-${h.icon}"/></svg></span>
          <div class="habit__body">
            <div class="habit__name">${esc(h.name)}</div>
            <div class="habit__meta">${esc(h.freq || "Daily")} &bull; ${esc(h.category)}</div>
          </div>
          <div class="habit__dots">${dots}</div>
          <svg class="habit__chev"><use href="#i-chev-right"/></svg>
        </article>`;
      })
      .join("");
  }

  /* ---------------- stats screen ---------------- */
  function renderStatsScreen() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = shift(startOfDay(), -i);
      const key = iso(d);
      const pct = state.habits.length ? Math.round((dayCount(key) / state.habits.length) * 100) : 0;
      days.push({ key, pct, label: WD[d.getDay()].slice(0, 2), today: i === 0 });
    }
    const avg = Math.round(days.reduce((n, d) => n + d.pct, 0) / days.length);
    $("#weekAvg").textContent = `${avg}%`;
    $("#weekChart").innerHTML = days
      .map(
        (d) => `<div class="chart__col${d.today ? " is-today" : ""}">
          <div class="chart__bar-wrap"><div class="chart__bar" style="height:${Math.max(4, d.pct)}%"></div></div>
          <span class="chart__label">${d.label}</span>
        </div>`
      )
      .join("");

    $("#statTotal").textContent = totalChecks();
    $("#statBest").textContent = `${bestStreak()} days`;

    if (!state.habits.length) {
      $("#progressList").innerHTML = `<div class="empty">Add a habit to see progress.</div>`;
      return;
    }

    $("#progressList").innerHTML = state.habits
      .map((h) => {
        let n = 0;
        for (let i = 0; i < 30; i++) if (hasOn(h, iso(shift(startOfDay(), -i)))) n++;
        const pct = Math.round((n / 30) * 100);
        return `<div class="progress-row">
          <div class="progress-row__top">
            <span class="progress-row__name"><svg><use href="#i-${h.icon}"/></svg>${esc(h.name)}</span>
            <span class="progress-row__pct">${pct}%</span>
          </div>
          <div class="progress-row__track"><div class="progress-row__fill" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join("");
  }

  /* ---------------- achievements ---------------- */
  const ACHIEVEMENTS = [
    { icon: "i-check-circle", title: "First Step", desc: "Check off a single habit", test: () => totalChecks() >= 1 },
    { icon: "i-flame", title: "Warming Up", desc: "Reach a 3-day streak", test: () => streak() >= 3 },
    { icon: "i-flame", title: "Week Warrior", desc: "Reach a 7-day streak", test: () => streak() >= 7 },
    { icon: "i-trophy", title: "Two Weeks Strong", desc: "Reach a 12-day streak", test: () => streak() >= 12 },
    { icon: "i-check", title: "Perfect Day", desc: "Complete every habit in a day", test: () => perfectDays() },
    { icon: "i-plus", title: "Habit Builder", desc: "Track 6 habits at once", test: () => state.habits.length >= 6 },
    { icon: "i-bars", title: "Consistent", desc: "Overall progress above 80%", test: () => overallPct() >= 80 },
    { icon: "i-trophy", title: "Century Club", desc: "Log 100 total check-ins", test: () => totalChecks() >= 100 },
  ];

  function renderBadges() {
    let unlocked = 0;
    $("#badgeList").innerHTML = ACHIEVEMENTS.map((a) => {
      const done = a.test();
      if (done) unlocked++;
      return `<div class="badge ${done ? "is-unlocked" : "is-locked"}">
        <span class="badge__icon"><svg><use href="#${a.icon}"/></svg></span>
        <div class="badge__body">
          <div class="badge__title">${a.title}</div>
          <div class="badge__desc">${a.desc}</div>
        </div>
        ${done ? `<span class="badge__state">Unlocked</span>` : `<svg class="badge__lock"><use href="#i-lock"/></svg>`}
      </div>`;
    }).join("");
    $("#badgeCount").textContent = unlocked;
    $("#badgeTotal").textContent = ACHIEVEMENTS.length;
  }

  /* ---------------- profile ---------------- */
  function renderProfile() {
    const name = state.name || "Friend";
    $("#profileName").textContent = name;
    $("#avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "H";
    const joined = parse(state.joined || TODAY);
    $("#profileSince").textContent = `Member since ${joined.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
    $("#profileHabits").textContent = state.habits.length;
    $("#profileStreak").textContent = streak();
    $("#profileChecks").textContent = totalChecks();
  }

  /* ---------------- render all ---------------- */
  function renderAll() {
    renderHero();
    renderStats();
    renderCalendar();
    renderHabits();
    renderStatsScreen();
    renderBadges();
    renderProfile();
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1900);
  }

  /* ---------------- sheet ---------------- */
  const modal = $("#modal");
  const sheet = $("#sheet");

  function openSheet(html) {
    sheet.innerHTML = html;
    modal.hidden = false;
    document.body.classList.add("is-modal");
    const input = sheet.querySelector("input");
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 60);
  }

  function closeSheet() {
    modal.hidden = true;
    sheet.innerHTML = "";
    document.body.classList.remove("is-modal");
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeSheet();
  });

  /* ---------------- habit actions ---------------- */
  function toggleDay(id, key) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    if (h.done[key]) delete h.done[key];
    else h.done[key] = true;
    save();
    renderAll();
  }

  function findHabit(id) {
    return state.habits.find((h) => h.id === id);
  }

  /* add habit sheet */
  let pickedIcon = "gym";

  function openAddHabit() {
    pickedIcon = "gym";
    openSheet(`
      <div class="sheet__grab"></div>
      <h3 class="sheet__title">New Habit</h3>
      <p class="sheet__sub">Small steps. Big changes.</p>
      <form id="addForm" novalidate>
        <div class="field">
          <label for="habitName">Habit name</label>
          <input id="habitName" name="habitName" type="text" maxlength="34" placeholder="e.g. Morning Walk" autocomplete="off" required>
        </div>
        <div class="field">
          <label for="habitCat">Category</label>
          <select id="habitCat" name="habitCat">
            ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Icon</label>
          <div class="icon-pick" id="iconPick">
            ${ICONS.map(
              (i) =>
                `<button type="button" class="${i === "gym" ? "is-selected" : ""}" data-icon="${i}" aria-label="${i}" aria-pressed="${i === "gym"}"><svg><use href="#i-${i}"/></svg></button>`
            ).join("")}
          </div>
        </div>
        <div class="sheet__actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">Add Habit</button>
        </div>
      </form>
    `);

    sheet.querySelector("#iconPick").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-icon]");
      if (!btn) return;
      pickedIcon = btn.dataset.icon;
      sheet.querySelectorAll("#iconPick button").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-selected", on);
        b.setAttribute("aria-pressed", String(on));
      });
    });

    sheet.querySelector("#addForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = sheet.querySelector("#habitName");
      const name = input.value.trim();
      if (!name) {
        input.focus();
        input.style.borderColor = "rgba(255,120,90,.6)";
        toast("Give your habit a name");
        return;
      }
      state.habits.push({
        id: `h${Date.now().toString(36)}`,
        name,
        category: sheet.querySelector("#habitCat").value,
        icon: pickedIcon,
        freq: "Daily",
        done: {},
      });
      save();
      renderAll();
      closeSheet();
      toast(`“${name}” added`);
    });
  }

  /* habit detail sheet */
  function openHabitDetail(id) {
    const h = findHabit(id);
    if (!h) return;

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = shift(startOfDay(), -i);
      const key = iso(d);
      days.push({ d, key, done: hasOn(h, key), today: i === 0 });
    }

    openSheet(`
      <div class="sheet__grab"></div>
      <div class="detail-head">
        <span class="habit__icon"><svg><use href="#i-${h.icon}"/></svg></span>
        <div>
          <div class="detail-name">${esc(h.name)}</div>
          <div class="detail-meta">${esc(h.freq || "Daily")} &bull; ${esc(h.category)}</div>
        </div>
      </div>
      <div class="detail-grid">
        ${days
          .map(
            (x) => `<button type="button" class="detail-day${x.done ? " is-done" : ""}${x.today ? " is-today" : ""}" data-action="toggle" data-date="${x.key}" aria-pressed="${x.done}" aria-label="${x.d.toDateString()}">
              <span>${WD[x.d.getDay()].slice(0, 1)}</span>
              <span>${x.d.getDate()}</span>
            </button>`
          )
          .join("")}
      </div>
      <p class="sheet__sub" style="margin:10px 0 0">Tap any day to check it off.</p>
      <div class="detail-actions">
        <button type="button" class="btn btn--danger" data-action="delete">Delete habit</button>
        <button type="button" class="btn btn--primary" data-action="today">${hasOn(h, TODAY) ? "Uncheck today" : "Mark today"}</button>
      </div>
    `);

    sheet.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "toggle") {
        toggleDay(id, btn.dataset.date);
        openHabitDetail(id);
      } else if (action === "today") {
        toggleDay(id, TODAY);
        openHabitDetail(id);
      } else if (action === "delete") {
        state.habits = state.habits.filter((x) => x.id !== id);
        save();
        renderAll();
        closeSheet();
        toast("Habit deleted");
      }
    });
  }

  /* settings / name sheets */
  function openSettings() {
    openSheet(`
      <div class="sheet__grab"></div>
      <h3 class="sheet__title">Settings</h3>
      <p class="sheet__sub">Personalise your tracker.</p>
      <form id="settingsForm">
        <div class="field">
          <label for="userName">Your name</label>
          <input id="userName" type="text" maxlength="18" value="${esc(state.name || "")}" placeholder="Harsh" autocomplete="off">
        </div>
        <div class="sheet__actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>
      <div class="sheet__actions" style="margin-top:10px">
        <button type="button" class="btn btn--danger" data-action="reset">Reset all data</button>
      </div>
    `);

    sheet.querySelector("#settingsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = sheet.querySelector("#userName").value.trim();
      state.name = name || "Friend";
      save();
      renderAll();
      closeSheet();
      toast("Saved");
    });

    sheet.querySelector('[data-action="reset"]').addEventListener("click", () => {
      if (!window.confirm("Reset everything back to the starting data?")) return;
      state = defaultState();
      save();
      renderAll();
      switchTab("home");
      closeSheet();
      toast("Data reset");
    });
  }

  /* ---------------- tabs ---------------- */
  function switchTab(tab) {
    state.tab = tab;
    save();
    $$(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    $$(".screen").forEach((s) => {
      const active = s.dataset.screen === tab;
      s.hidden = !active;
      s.classList.toggle("is-active", active);
    });
    $("#screens").scrollTop = 0;
  }

  /* ---------------- events ---------------- */
  $("#habitList").addEventListener("click", (e) => {
    const dot = e.target.closest(".dot");
    if (dot) {
      e.stopPropagation();
      toggleDay(dot.dataset.habit, dot.dataset.date);
      return;
    }
    const row = e.target.closest(".habit");
    if (row) openHabitDetail(row.dataset.habit);
  });

  $("#habitList").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".habit");
    if (!row || e.target.closest(".dot")) return;
    e.preventDefault();
    openHabitDetail(row.dataset.habit);
  });

  $("#btnAddHabit").addEventListener("click", openAddHabit);
  $("#btnSettings").addEventListener("click", openSettings);
  $("#btnEditName").addEventListener("click", openSettings);
  $("#btnReset").addEventListener("click", openSettings);

  $("#calPrev").addEventListener("click", () => {
    const { y, m } = state.view;
    const d = new Date(y, m - 1, 1);
    state.view = { y: d.getFullYear(), m: d.getMonth() };
    save();
    renderCalendar();
  });

  $("#calNext").addEventListener("click", () => {
    const { y, m } = state.view;
    const d = new Date(y, m + 1, 1);
    state.view = { y: d.getFullYear(), m: d.getMonth() };
    save();
    renderCalendar();
  });

  $$(".tab").forEach((btn) =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );

  /* ---------------- boot ---------------- */
  renderAll();
  switchTab(state.tab && ["home", "stats", "achievements", "profile"].includes(state.tab) ? state.tab : "home");
})();
