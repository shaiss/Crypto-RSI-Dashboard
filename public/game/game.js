/* ============================================================
   PHOENIX WHEELS: LAUNCH QUEST — game engine
   Pure vanilla JS. No build step. State lives in localStorage.
   ============================================================ */
(function () {
  "use strict";

  const SAVE_KEY = "phoenixWheels.save.v1";
  const XP_PER_LEVEL = 200;

  /* ---------------- state ---------------- */
  const defaultState = () => ({
    started: false,
    player: { name: "", shopName: SHOP.name },
    xp: 0,
    quests: {},          // id -> { lessons:{idx:correctBool}, captured:{field:val}, done:bool }
    badges: [],          // world ids earned
    muted: false,
    updated: Date.now()
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaultState();
  }
  function save() {
    state.updated = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
    renderHUD();
  }

  /* ---------------- audio (chiptune blips) ---------------- */
  let actx = null;
  function beep(freq, dur, type) {
    if (state.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.12));
      o.start(); o.stop(actx.currentTime + (dur || 0.12));
    } catch (e) {}
  }
  const sfx = {
    select: () => beep(660, 0.08),
    good:   () => { beep(740, 0.09); setTimeout(() => beep(990, 0.12), 90); },
    bad:    () => beep(160, 0.18, "sawtooth"),
    coin:   () => { beep(988, 0.07); setTimeout(() => beep(1319, 0.1), 70); },
    level:  () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.13), i * 110)); }
  };

  /* ---------------- helpers ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const screen = $("#screen");
  const worldOf = (id) => WORLDS.find(w => w.id === id);
  const questsOf = (wid) => QUESTS.filter(q => q.world === wid);
  const level = () => Math.floor(state.xp / XP_PER_LEVEL) + 1;
  const isDone = (qid) => !!(state.quests[qid] && state.quests[qid].done);
  const totalPoints = QUESTS.reduce((s, q) => s + q.points, 0);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1900);
  }

  function modal(html) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = '<div class="modal">' + html + "</div>";
    bg.addEventListener("click", (e) => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
    return bg;
  }

  /* ---------------- HUD ---------------- */
  function renderHUD() {
    const show = state.started;
    $("#hud").classList.toggle("hidden", !show);
    $("#foot").classList.toggle("hidden", !show);
    if (!show) return;
    $("#hud-level").textContent = level();
    $("#hud-xp").textContent = state.xp;
    $("#hud-badges").textContent = state.badges.map(b => (WORLD_BADGES[b] || "").split(" ")[0]).join(" ");
    $("#btn-mute").textContent = state.muted ? "🔇" : "🔊";
  }

  /* ---------------- award XP / level / badges ---------------- */
  function awardXP(amount, reason) {
    const before = level();
    state.xp += amount;
    save();
    sfx.coin();
    if (reason) toast("+" + amount + " XP — " + reason);
    if (level() > before) {
      sfx.level();
      modal(
        '<div class="lvlup-emoji">⭐</div>' +
        "<h2>LEVEL UP!</h2>" +
        '<p>You reached <b class="coin">Level ' + level() + "</b></p>" +
        '<button class="pixel-btn" onclick="this.closest(\'.modal-bg\').remove()">NICE!</button>'
      );
    }
  }

  function checkWorldBadge(wid) {
    if (state.badges.includes(wid)) return;
    const all = questsOf(wid).every(q => isDone(q.id));
    if (all) {
      state.badges.push(wid);
      save();
      modal(
        '<div class="lvlup-emoji">🏅</div>' +
        "<h2>BADGE EARNED</h2>" +
        "<p>" + esc(WORLD_BADGES[wid]) + "</p>" +
        "<p style='color:var(--dim);font-size:17px'>" + esc(worldOf(wid).name) + " complete!</p>" +
        '<button class="pixel-btn good" onclick="this.closest(\'.modal-bg\').remove()">ROLL ON!</button>'
      );
    }
  }

  /* ============================================================
     SCREENS
     ============================================================ */
  let current = "title";
  function go(name, arg) { current = name; (screens[name] || screens.title)(arg); window.scrollTo(0, 0); }

  const screens = {};

  /* ---- TITLE ---- */
  screens.title = function () {
    renderHUD();
    screen.innerHTML =
      '<div class="title-wrap">' +
        '<div class="title-wheel">🛞</div>' +
        '<h1 class="title-logo">PHOENIX WHEELS<span class="sub">★ LAUNCH QUEST ★</span></h1>' +
        '<p class="title-tag">An 8-bit adventure to launch ' + esc(SHOP.name) +
          " — and dodge the rookie mistakes along the way.</p>" +
        '<div class="facts panel">' +
          "<div>🎮 <b>The quest:</b> " + esc(SHOP.blurb) + "</div>" +
          "<div>📍 <b>Where:</b> " + esc(SHOP.area) + " (" + esc(SHOP.zip) + ")</div>" +
          "<div>💜 <b>Nonprofit home:</b> " + esc(SHOP.nonprofit) + "</div>" +
          "<div>🏭 <b>For-profit:</b> " + esc(SHOP.forprofit) + "</div>" +
        "</div>" +
        '<div class="field" style="max-width:360px;margin:18px auto">' +
          '<label>Player name (the founder)</label>' +
          '<input id="pname" placeholder="Your name" value="' + esc(state.player.name) + '">' +
        "</div>" +
        '<button class="pixel-btn pink" id="start-btn">▶ PRESS START</button>' +
        (state.started ? ' <button class="pixel-btn alt" id="continue-btn">CONTINUE</button>' : "") +
        '<p class="press-start">insert ambition to continue</p>' +
        '<p class="disclaimer">This is an educational planning game — not legal, tax, or insurance advice. ' +
          "Confirm specifics with PA / Montgomery County / your borough and your own professionals.</p>" +
      "</div>";

    $("#start-btn").addEventListener("click", () => {
      state.player.name = ($("#pname").value || "Founder").trim();
      state.started = true;
      sfx.coin(); save();
      go("map");
    });
    const cont = $("#continue-btn");
    if (cont) cont.addEventListener("click", () => { sfx.select(); go("map"); });
  };

  /* ---- MAP (worlds) ---- */
  screens.map = function () {
    renderHUD();
    const doneCount = QUESTS.filter(q => isDone(q.id)).length;
    const pct = Math.round((doneCount / QUESTS.length) * 100);

    let html =
      '<div class="hero-prog">' +
        '<div class="big">' + pct + "% LAUNCHED</div>" +
        '<div class="bar" style="max-width:380px;margin:8px auto"><span style="width:' + pct + '%"></span></div>' +
        '<div style="color:var(--dim);font-size:17px">' + doneCount + " / " + QUESTS.length +
          " quests · " + state.xp + " / " + totalPoints + ' <span class="coin">XP</span></div>' +
      "</div>" +
      '<div class="world-grid">';

    WORLDS.forEach(w => {
      const qs = questsOf(w.id);
      const d = qs.filter(q => isDone(q.id)).length;
      const wp = Math.round((d / qs.length) * 100);
      const complete = d === qs.length;
      html +=
        '<div class="world-card" data-world="' + w.id + '" style="border-color:' + w.color + '">' +
          '<div class="world-icon">' + w.icon + "</div>" +
          '<div class="world-meta">' +
            '<div class="wname" style="color:' + w.color + '">' + esc(w.name) + "</div>" +
            '<div class="wtag">' + esc(w.tag) + "</div>" +
          "</div>" +
          '<div class="world-prog">' +
            (complete ? '<div class="world-done">✔ DONE</div>'
                      : '<div style="font-size:16px;color:var(--dim)">' + d + "/" + qs.length + "</div>") +
            '<div class="bar"><span style="width:' + wp + '%;background:' + w.color + '"></span></div>' +
          "</div>" +
        "</div>";
    });
    html += "</div>";

    if (doneCount === QUESTS.length) {
      html += '<div class="panel" style="border-color:var(--good);text-align:center;margin-top:18px">' +
        '<h2 style="color:var(--good)">🏆 ALL SYSTEMS GO!</h2>' +
        "<p>Every quest cleared. Phoenix Wheels is ready to roll. Check your <b>📜 Roadmap</b> for the full launch plan you built.</p>" +
        '<button class="pixel-btn good" data-nav="roadmap">VIEW ROADMAP</button></div>';
    }

    screen.innerHTML = html;
    screen.querySelectorAll(".world-card").forEach(c =>
      c.addEventListener("click", () => { sfx.select(); go("world", c.dataset.world); }));
  };

  /* ---- WORLD (quest list) ---- */
  screens.world = function (wid) {
    const w = worldOf(wid);
    if (!w) return go("map");
    let html =
      '<button class="pixel-btn small alt" data-nav="map">← MAP</button>' +
      '<div class="panel" style="border-color:' + w.color + ';margin-top:14px">' +
        '<h2 style="color:' + w.color + '">' + w.icon + " " + esc(w.name) + "</h2>" +
        '<div style="color:var(--dim);font-size:18px;margin-top:-6px">' + esc(w.tag) + "</div>" +
      "</div>";

    questsOf(wid).forEach(q => {
      const done = isDone(q.id);
      html +=
        '<div class="quest-row ' + (q.boss ? "boss-row" : "") + '" data-quest="' + q.id + '">' +
          '<div class="qi">' + q.icon + "</div>" +
          '<div class="qn"><b>' + (q.boss ? "👑 " : "") + esc(q.title) + "</b>" +
            '<div style="color:var(--dim);font-size:16px">' + esc(q.intro.slice(0, 70)) + "…</div></div>" +
          '<div class="qpts">' + (done ? '<span class="q-check">✔</span>' : "+" + q.points) + "</div>" +
        "</div>";
    });

    screen.innerHTML = html;
    screen.querySelectorAll(".quest-row").forEach(r =>
      r.addEventListener("click", () => { sfx.select(); go("quest", r.dataset.quest); }));
  };

  /* ---- QUEST DETAIL ---- */
  screens.quest = function (qid) {
    const q = QUESTS.find(x => x.id === qid);
    if (!q) return go("map");
    const w = worldOf(q.world);
    const st = state.quests[qid] || { lessons: {}, captured: {}, done: false };
    state.quests[qid] = st;

    let html =
      '<button class="pixel-btn small alt" data-back="' + q.world + '">← ' + esc(w.name).toUpperCase() + "</button>" +
      '<div class="panel" style="margin-top:14px;border-color:' + w.color + '">' +
        "<h2>" + q.icon + " " + esc(q.title) + ' <span style="color:var(--accent);font-size:10px">+' + q.points + " XP</span></h2>" +
        '<div class="brief">📟 ' + esc(q.intro) + "</div>" +
      "</div>";

    /* ---- DO / DON'T lessons ---- */
    html += '<div class="panel"><h2>⚔️ DO THIS / NOT THAT</h2>' +
      '<p style="color:var(--dim);font-size:17px;margin-top:-6px">Pick the smart move. Wrong answers still teach you — no penalty.</p>';
    q.lessons.forEach((les, li) => {
      html += '<div class="lesson" data-lesson="' + li + '"><div class="q">▸ ' + esc(les.q) + "</div>";
      les.options.forEach((op, oi) => {
        html += '<button class="opt" data-li="' + li + '" data-oi="' + oi + '">' + esc(op.t) + "</button>";
      });
      html += '<div class="why hidden"></div></div>';
    });
    html += "</div>";

    /* ---- pitfalls / wins ---- */
    html += '<div class="panel"><h2>🧠 CHEAT CODES</h2>';
    html += "<h3>✅ DO</h3>";
    q.wins.forEach(t => html += '<span class="tag do">DO</span> ' + esc(t) + "<br>");
    html += "<h3>⛔ DON'T</h3>";
    q.pitfalls.forEach(t => html += '<span class="tag dont">AVOID</span> ' + esc(t) + "<br>");
    html += "</div>";

    /* ---- capture form ---- */
    html += '<div class="panel"><h2>📝 YOUR REAL PLAN</h2>' +
      '<p style="color:var(--dim);font-size:17px;margin-top:-6px">Fill in the real details. This builds your launch roadmap (saved on this device).</p>';
    q.capture.forEach(f => {
      const val = st.captured[f.id] || "";
      html += '<div class="field"><label>' + esc(f.label) + "</label>";
      if (f.type === "textarea") {
        html += '<textarea data-cap="' + f.id + '" placeholder="' + esc(f.placeholder || "") + '">' + esc(val) + "</textarea>";
      } else if (f.type === "select") {
        html += '<select data-cap="' + f.id + '"><option value="">— choose —</option>' +
          f.options.map(o => '<option ' + (o === val ? "selected" : "") + ">" + esc(o) + "</option>").join("") + "</select>";
      } else {
        html += '<input type="' + (f.type || "text") + '" data-cap="' + f.id + '" placeholder="' +
          esc(f.placeholder || "") + '" value="' + esc(val) + '">';
      }
      html += "</div>";
    });
    html += '<div class="row-btns">' +
      '<button class="pixel-btn good" id="complete-quest">' + (st.done ? "💾 UPDATE & SAVE" : "✔ COMPLETE QUEST") + "</button>" +
      '<button class="pixel-btn small alt" data-back="' + q.world + '">BACK</button>' +
      "</div></div>";

    screen.innerHTML = html;

    /* lesson handlers */
    screen.querySelectorAll(".opt").forEach(btn => {
      const li = +btn.dataset.li, oi = +btn.dataset.oi;
      if (st.lessons[li] !== undefined) markLesson(li); // restore answered state
      btn.addEventListener("click", () => answerLesson(q, li, oi));
    });

    function markLesson(li) {
      const lessonEl = screen.querySelector('.lesson[data-lesson="' + li + '"]');
      const les = q.lessons[li];
      lessonEl.querySelectorAll(".opt").forEach((b, oi) => {
        b.disabled = true;
        if (les.options[oi].correct) b.classList.add("correct");
      });
      // show why for the correct option (so revisits still teach)
    }

    function answerLesson(q, li, oi) {
      const st2 = state.quests[q.id];
      if (st2.lessons[li] !== undefined) return; // already answered
      const les = q.lessons[li];
      const op = les.options[oi];
      const lessonEl = screen.querySelector('.lesson[data-lesson="' + li + '"]');
      const whyEl = lessonEl.querySelector(".why");
      lessonEl.querySelectorAll(".opt").forEach((b, i) => {
        b.disabled = true;
        if (les.options[i].correct) b.classList.add("correct");
      });
      if (!op.correct) screen.querySelectorAll('.lesson[data-lesson="' + li + '"] .opt')[oi].classList.add("wrong");
      whyEl.classList.remove("hidden");
      whyEl.classList.add(op.correct ? "good" : "bad");
      whyEl.innerHTML = (op.correct ? "✅ " : "❌ ") + esc(op.why);
      st2.lessons[li] = op.correct;
      if (op.correct) { sfx.good(); awardXP(20, "smart move"); }
      else { sfx.bad(); awardXP(5, "lesson learned"); }
      save();
    }

    /* capture autosave + complete */
    screen.querySelectorAll("[data-cap]").forEach(el => {
      el.addEventListener("change", () => {
        state.quests[q.id].captured[el.dataset.cap] = el.value;
        save();
      });
    });

    $("#complete-quest").addEventListener("click", () => {
      const st2 = state.quests[q.id];
      screen.querySelectorAll("[data-cap]").forEach(el => { st2.captured[el.dataset.cap] = el.value; });
      const wasDone = st2.done;
      st2.done = true;
      save();
      if (!wasDone) {
        sfx.level();
        awardXP(q.points, esc(q.title) + " cleared!");
        setTimeout(() => checkWorldBadge(q.world), 400);
      } else {
        toast("Plan updated & saved");
      }
      setTimeout(() => go("world", q.world), 600);
    });

    screen.querySelectorAll("[data-back]").forEach(b =>
      b.addEventListener("click", () => { sfx.select(); go("world", b.dataset.back); }));
  };

  /* ---- ROADMAP ---- */
  screens.roadmap = function () {
    renderHUD();
    let n = 0;
    let html =
      '<button class="pixel-btn small alt" data-nav="map">← MAP</button>' +
      '<div class="panel" style="margin-top:14px"><h2>📜 ' + esc(state.player.shopName).toUpperCase() + " LAUNCH ROADMAP</h2>" +
      '<p style="color:var(--dim);font-size:17px">Founder: <b>' + esc(state.player.name || "—") +
        "</b> · Built inside Launch Quest. This is your real plan — export or print it below.</p>";

    WORLDS.forEach(w => {
      html += '<h3 style="color:' + w.color + '">' + w.icon + " " + esc(w.name) + "</h3>";
      questsOf(w.id).forEach(q => {
        n++;
        const st = state.quests[q.id] || { captured: {}, done: false };
        const done = st.done;
        html += '<div class="road-step">' +
          '<div class="road-num">' + (n < 10 ? "0" + n : n) + "</div>" +
          '<div class="road-body">' +
            "<b>" + esc(q.title) + '</b> <span class="status-pill ' + (done ? "pill-done" : "pill-todo") + '">' +
              (done ? "DONE" : "TODO") + "</span>";
        const caps = q.capture.filter(f => st.captured[f.id]);
        if (caps.length) {
          html += '<div class="road-data">';
          caps.forEach(f => { html += "• " + esc(f.label) + ": <span>" + esc(st.captured[f.id]) + "</span><br>"; });
          html += "</div>";
        } else {
          html += '<div class="road-data" style="opacity:.6">— not filled in yet —</div>';
        }
        html += "</div></div>";
      });
    });
    html += "</div>" +
      '<div class="panel"><h2>📤 TAKE IT WITH YOU</h2>' +
      '<div class="row-btns">' +
        '<button class="pixel-btn" id="rm-print">🖨️ PRINT / PDF</button>' +
        '<button class="pixel-btn alt" data-nav="export">💾 EXPORT JSON</button>' +
      "</div>" +
      '<p class="disclaimer">Reminder: educational planning aid, not legal/tax/insurance advice. ' +
        "Verify every item with the relevant PA / county / borough office and your professionals.</p></div>";

    screen.innerHTML = html;
    $("#rm-print").addEventListener("click", () => { sfx.select(); printRoadmap(); });
  };

  /* ---- EXPORT / SAVE ---- */
  screens.export = function () {
    renderHUD();
    screen.innerHTML =
      '<button class="pixel-btn small alt" data-nav="map">← MAP</button>' +
      '<div class="panel" style="margin-top:14px"><h2>💾 SAVE / EXPORT / LOAD</h2>' +
      "<p>Your progress auto-saves to this browser. Use these to back it up or move devices.</p>" +
      '<div class="row-btns">' +
        '<button class="pixel-btn good" id="ex-json">⬇ DOWNLOAD .JSON</button>' +
        '<button class="pixel-btn alt" id="ex-load">⬆ LOAD .JSON</button>' +
        '<button class="pixel-btn" id="ex-print">🖨️ PRINT ROADMAP</button>' +
      "</div>" +
      '<input type="file" id="ex-file" accept="application/json" class="hidden">' +
      '<h3>⚠️ DANGER ZONE</h3>' +
      '<button class="pixel-btn pink" id="ex-reset">🗑 RESET GAME</button>' +
      "</div>";

    $("#ex-json").addEventListener("click", exportJSON);
    $("#ex-print").addEventListener("click", printRoadmap);
    $("#ex-load").addEventListener("click", () => $("#ex-file").click());
    $("#ex-file").addEventListener("change", importJSON);
    $("#ex-reset").addEventListener("click", () => {
      const m = modal("<h2>RESET?</h2><p>This wipes all progress on this device. Export first if unsure.</p>" +
        '<div class="row-btns" style="justify-content:center">' +
        '<button class="pixel-btn pink" id="really">YES, WIPE</button>' +
        '<button class="pixel-btn alt" onclick="this.closest(\'.modal-bg\').remove()">CANCEL</button></div>');
      $("#really", m).addEventListener("click", () => {
        state = defaultState(); save(); m.remove(); go("title");
      });
    });
  };

  /* ---- HELP ---- */
  screens.help = function () {
    renderHUD();
    screen.innerHTML =
      '<button class="pixel-btn small alt" data-nav="map">← MAP</button>' +
      '<div class="panel" style="margin-top:14px"><h2>❓ HOW TO PLAY</h2>' +
      "<p>🗺️ <b>Map</b> — six worlds, each a stage of launching " + esc(SHOP.name) + ".</p>" +
      "<p>⚔️ <b>Quests</b> — answer the <span style='color:var(--good)'>do/don't</span> cards to learn the common mistakes, then fill in <b>your real plan</b>.</p>" +
      "<p>⭐ <b>XP & Levels</b> — earn points for smart moves and for completing quests. Finish a whole world to win a <b>badge</b>.</p>" +
      "<p>📜 <b>Roadmap</b> — everything you typed becomes a printable launch checklist.</p>" +
      "<p>💾 <b>Save</b> — auto-saves here; export JSON to back up or switch devices.</p>" +
      '<h3>The point</h3><p>By the end you\'ll have: the right legal structure, permits, insurance, funding plan, inventory plan, and a launch plan — and you\'ll know the rookie mistakes to dodge.</p>' +
      '<p class="disclaimer">Educational only — not legal, tax, or insurance advice.</p></div>';
  };

  /* ============================================================
     EXPORT / IMPORT / PRINT
     ============================================================ */
  function buildPlanObject() {
    const plan = {
      game: "Phoenix Wheels: Launch Quest",
      exportedAt: new Date().toISOString(),
      founder: state.player.name,
      shop: SHOP,
      xp: state.xp,
      level: level(),
      badges: state.badges.map(b => WORLD_BADGES[b]),
      roadmap: []
    };
    WORLDS.forEach(w => {
      questsOf(w.id).forEach(q => {
        const st = state.quests[q.id] || { captured: {}, done: false };
        const data = {};
        q.capture.forEach(f => { if (st.captured[f.id]) data[f.label] = st.captured[f.id]; });
        plan.roadmap.push({
          stage: w.name, step: q.title, done: !!st.done,
          details: data, doThis: q.wins, avoid: q.pitfalls
        });
      });
    });
    return plan;
  }

  function exportJSON() {
    sfx.coin();
    const blob = new Blob([JSON.stringify(buildPlanObject(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "phoenix-wheels-launch-plan.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Plan exported!");
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        // accept either a full save or a plan export
        if (data.quests) { state = Object.assign(defaultState(), data); }
        else if (data.roadmap) {
          // rebuild captured fields from a plan export
          data.roadmap.forEach(step => {
            const q = QUESTS.find(x => x.title === step.step);
            if (!q) return;
            const st = state.quests[q.id] || { lessons: {}, captured: {}, done: false };
            st.done = !!step.done;
            q.capture.forEach(f => { if (step.details && step.details[f.label]) st.captured[f.id] = step.details[f.label]; });
            state.quests[q.id] = st;
          });
          if (data.founder) state.player.name = data.founder;
          state.started = true;
        }
        save();
        toast("Plan loaded!");
        go("map");
      } catch (err) { alert("Could not read that file."); }
    };
    reader.readAsText(file);
  }

  function printRoadmap() {
    const plan = buildPlanObject();
    let h = "<html><head><title>" + plan.shop.name + " — Launch Roadmap</title><style>" +
      "body{font-family:Arial,sans-serif;max-width:760px;margin:24px auto;color:#111;line-height:1.5}" +
      "h1{color:#b3005e}h2{color:#5b4bd6;border-bottom:2px solid #eee;margin-top:26px}" +
      ".step{margin:14px 0;padding:10px 0;border-bottom:1px dashed #ccc}" +
      ".done{color:#0a8a4a;font-weight:bold}.todo{color:#999;font-weight:bold}" +
      ".d{color:#333;font-size:14px;margin:4px 0 0 12px}" +
      ".tips{font-size:13px;color:#555;margin-left:12px}" +
      ".dis{color:#888;font-size:12px;margin-top:30px;border-top:1px solid #ddd;padding-top:8px}" +
      "</style></head><body>";
    h += "<h1>🔥 " + plan.shop.name + " — Launch Roadmap</h1>";
    h += "<p><b>Founder:</b> " + esc(plan.founder || "—") + " &nbsp; <b>Area:</b> " + esc(plan.shop.area) +
         " (" + esc(plan.shop.zip) + ")</p>";
    h += "<p>" + esc(plan.shop.blurb) + "</p>";
    let curStage = "";
    plan.roadmap.forEach((s, i) => {
      if (s.stage !== curStage) { h += "<h2>" + esc(s.stage) + "</h2>"; curStage = s.stage; }
      h += '<div class="step"><span class="' + (s.done ? "done" : "todo") + '">' +
        (s.done ? "☑ DONE" : "☐ TODO") + "</span> &nbsp;<b>" + esc(s.step) + "</b>";
      Object.keys(s.details).forEach(k => h += '<div class="d">• ' + esc(k) + ": <b>" + esc(s.details[k]) + "</b></div>");
      h += '<div class="tips">✅ ' + s.doThis.map(esc).join(" · ") + "</div>";
      h += '<div class="tips">⛔ ' + s.avoid.map(esc).join(" · ") + "</div>";
      h += "</div>";
    });
    h += '<p class="dis">Generated by Phoenix Wheels: Launch Quest. Educational planning aid only — ' +
         "not legal, tax, or insurance advice. Verify every item with the relevant PA / Montgomery County / borough " +
         "office and your own professionals.</p></body></html>";
    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups to print the roadmap."); return; }
    w.document.write(h); w.document.close();
    setTimeout(() => w.print(), 350);
  }

  /* ============================================================
     GLOBAL NAV WIRING
     ============================================================ */
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) { sfx.select(); go(nav.dataset.nav); }
  });
  $("#btn-mute").addEventListener("click", () => {
    state.muted = !state.muted; save();
    if (!state.muted) sfx.select();
  });

  /* boot */
  if (state.started) go("map"); else go("title");
  renderHUD();
})();
