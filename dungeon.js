"use strict";
/* Engine "Mê cung kho báu" chạy trong trình duyệt (Canvas 2D + DOM, không thư viện ngoài).
   - window.DungeonGame.mount(container, opts) / unmount()
   - Adapter online gọi /api/dungeon/*; adapter offline giữ ván trong localStorage
     (khóa toeic.dungeon.<deckKey>) và dùng chung DungeonRules, DungeonCore.
   - Quy ước đặt quái (mục 9.1 của README): tầng n -> Core.generateFloor({seed:
     Core.hash32(seed+'|'+n), monsters: số câu, chests: 2 nếu >= 12 câu}); quái boss nhận
     câu cuối của tầng, các quái còn lại nhận các câu còn lại theo thứ tự layout.monsters.
   - Không có lời gọi AI nào trừ khi người chơi bấm nút Gia sư AI trong khối 💡. */
(function (root) {
  var Core = root.DungeonCore, Rules = root.DungeonRules;
  if (!Core || !Rules) {
    root.DungeonGame = {
      mount: function () { alert("Trang này chưa nạp lõi Mê cung kho báu (dungeon-core.js)."); },
      unmount: function () {},
    };
    return;
  }

  var C = Core.CONFIG;
  var EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  var MONSTER_BY_TOPIC = { "Thì": "⏳", "Từ loại": "🐍", "Giới từ": "🦇", "Đại từ": "🕷️", "Từ vựng": "🐲" };
  var MONSTER_OTHER = "👾", BOSS = "👹", PLAYER = "🧙", CHEST = "🧰", CHEST_OPEN = "📭", STAIRS = "🪜";
  var LETTERS = ["A", "B", "C", "D"];
  var LS_OPTS = "toeic.dungeon.opts", LS_MUTE = "toeic.mute";
  var EXP_BONUS = { gold: 100, silver: 60, bronze: 30 };

  var S = null;
  var styleDone = false;

  /* ---------- tiện ích ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split('"').join("&quot;")
      .split("'").join("&#39;");
  }
  function readLS(key, def) {
    try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function keyOf(x, y) { return x + "," + y; }
  function medalLabel(m) { return m === "gold" ? "🥇 Vàng" : m === "silver" ? "🥈 Bạc" : "🥉 Đồng"; }
  function fmtDate(v) {
    if (!v) return "—";
    var d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function randomSeed() {
    try {
      var a = new Uint32Array(1);
      (root.crypto || root.msCrypto).getRandomValues(a);
      return a[0];
    } catch (e) { return Math.floor(Math.random() * 4294967296); }
  }
  function fail(message, status, payload) {
    var e = new Error(message);
    e.status = status || 400;
    if (payload) e.payload = payload;
    return e;
  }

  /* ---------- âm thanh (Web Audio, dùng chung khóa tắt tiếng toeic.mute) ---------- */
  var actx = null;
  function muted() { return readLS(LS_MUTE, false) === true; }
  function audio() {
    if (muted()) return null;
    try {
      var Ctor = root.AudioContext || root.webkitAudioContext;
      if (!Ctor) return null;
      if (!actx) actx = new Ctor();
      if (actx.state === "suspended") actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(type, from, to, ms, vol) {
    var a = audio();
    if (!a) return;
    var dur = ms / 1000, t = a.currentTime;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol == null ? 0.2 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var sfx = {
    win: function () { tone("triangle", 660, null, 100, 0.2); setTimeout(function () { tone("triangle", 990, null, 120, 0.2); }, 100); },
    miss: function () { tone("sawtooth", 300, 110, 260, 0.18); },
    chest: function () { [880, 1180, 1480].forEach(function (f, i) { setTimeout(function () { tone("triangle", f, null, 80, 0.16); }, i * 70); }); },
    stair: function () { tone("sine", 440, 660, 180, 0.18); },
    finish: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone("triangle", f, null, 150, 0.2); }, i * 150); }); },
  };

  /* ---------- CSS ---------- */
  var CSS =
    ".dg-root{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;overscroll-behavior:none}" +
    ".dg-hud{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;background:var(--panel);border-bottom:1px solid var(--line)}" +
    ".dg-btn,.dg-item{font:inherit;font-size:14px;min-height:36px;padding:4px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;touch-action:manipulation}" +    ".dg-btn:hover,.dg-item:hover{border-color:var(--brand)}" +
    ".dg-item{display:inline-flex;align-items:center;gap:3px}" +
    ".dg-chip{font-size:14px;color:var(--muted);white-space:nowrap}" +
    ".dg-grow{flex:1}" +
    ".dg-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:4px;background:#070b14}" +
    ".dg-canvas{display:block;border-radius:12px;outline:none;touch-action:none;border:1px solid var(--line);background:#090d14;box-shadow:var(--shadow)}" +
    ".dg-canvas:focus-visible{outline:3px solid var(--brand);outline-offset:2px}" +
    ".dg-note{position:absolute;left:12px;bottom:12px;max-width:min(72%,680px);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:13px;box-shadow:var(--shadow)}" +
    ".dg-note:empty{display:none}" +
    ".dg-dpad{position:absolute;right:14px;bottom:14px;display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,48px);gap:6px;z-index:2}" +
    ".dg-dpad button{font-size:20px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);touch-action:manipulation;cursor:pointer}" +
    ".dg-dpad [data-dir=up]{grid-area:1/2}.dg-dpad [data-dir=left]{grid-area:2/1}.dg-dpad [data-dir=down]{grid-area:2/2}.dg-dpad [data-dir=right]{grid-area:2/3}" +
    ".dg-keys{font-size:12px;color:var(--muted);padding:6px 10px;background:var(--panel);border-top:1px solid var(--line);text-align:center}" +
    ".dg-back{position:absolute;inset:0;background:rgba(4,8,15,.62);display:flex;align-items:center;justify-content:center;padding:14px;z-index:20}" +
    ".dg-dialog{width:min(760px,100%);max-height:92vh;overflow:auto;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:var(--shadow)}" +
    ".dg-dialog h3{margin:0 0 4px;font-size:20px}" +
    ".dg-sub{color:var(--muted);font-size:13px;margin:4px 0}" +
    ".dg-q{font-size:17px;line-height:1.55;margin:10px 0 12px;white-space:pre-wrap}" +
    ".dg-passage{max-height:180px;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:1.5;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--bg);margin:8px 0}" +
    ".dg-opts{display:grid;gap:8px}" +
    ".dg-opt{font:inherit;font-size:15px;text-align:left;padding:10px 12px;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);cursor:pointer;white-space:pre-wrap}" +
    ".dg-opt:hover:not(:disabled){border-color:var(--brand)}.dg-opt:disabled{cursor:default;opacity:.9}" +
    ".dg-opt.dg-right{border-color:var(--ok);box-shadow:inset 0 0 0 2px var(--ok)}.dg-opt.dg-wrong{border-color:var(--bad);box-shadow:inset 0 0 0 2px var(--bad)}" +
    ".dg-opt.dg-elim{opacity:.45;text-decoration:line-through}" +
    ".dg-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}" +
    ".dg-primary{border-color:var(--brand);background:var(--brand);color:#fff}" +
    ".dg-feedback{margin-top:10px;font-size:15px}.dg-ok{color:var(--ok)}.dg-bad{color:var(--bad)}" +
    ".dg-expl{margin-top:10px}.dg-expl:empty{display:none}" +
    ".dg-field{display:block;font-size:14px;color:var(--muted);margin:10px 0 4px}" +
    ".dg-input{font:inherit;font-size:16px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);width:100%;margin-top:4px}" +
    ".dg-err{color:var(--bad);font-size:13px;min-height:18px;margin-top:6px}.dg-hint{color:var(--muted);font-size:12px;margin:4px 0}" +
    ".dg-cert{text-align:center;border:3px double var(--warn);border-radius:12px;padding:16px 12px;background:var(--bg)}" +
    ".dg-cert-title{letter-spacing:1px;font-weight:700;color:var(--warn);margin:0 0 8px}" +
    ".dg-cert-name{font-size:24px;font-weight:700;margin:6px 0}.dg-cert-code{font-size:15px;margin:8px 0}" +
    ".dg-disclaimer{font-size:12px;color:var(--muted);margin:10px 0 0}" +
    ".dg-hide{display:none!important}" +
    "@media(max-width:640px){.dg-hud{gap:4px;padding:6px}.dg-btn,.dg-item{font-size:12px;padding:3px 8px}.dg-keys{font-size:11px}}";

  function injectCss() {
    if (styleDone || document.getElementById("dg-style")) { styleDone = true; return; }
    var st = document.createElement("style");
    st.id = "dg-style";
    st.textContent = CSS;
    document.head.appendChild(st);
    styleDone = true;
  }

  /* ---------- adapter online ---------- */
  function httpJson(url, body) {
    var opt = body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : { method: "GET" };
    return fetch(url, opt).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) throw fail(j.error || "Lỗi " + r.status, r.status, j);
        return j;
      });
    });
  }

  function onlineAdapter(opts) {
    var deck = opts.deck || {};
    var fileId = deck.fileId;
    var base = "/api/dungeon";
    function post(path, body) { return httpJson(base + path, body); }
    return {
      kind: "online",
      getStatus: function () { return httpJson("/api/dungeon/status?file=" + encodeURIComponent(fileId)); },
      start: function (deckKey, segment) { return post("/start", { fileId: fileId, segment: segment || 1 }); },
      fight: function (runId, qid, choice, o) { return post("/fight", { runId: runId, qid: qid, choice: choice, hinted: !!(o && o.hinted) }); },
      hint: function (runId, qid) { return post("/hint", { runId: runId, qid: qid }); },
      chest: function (runId, floorNo, idx) { return post("/chest", { runId: runId, floorNo: floorNo, idx: idx }); },
      potion: function (runId) { return post("/potion", { runId: runId }); },
      descend: function (runId) { return post("/descend", { runId: runId }); },
      finish: function (runId, holderName) { return post("/finish", { runId: runId, holderName: holderName }); },
    };
  }

  /* ---------- adapter offline (localStorage) ---------- */
  function questionOk(q) {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4) return false;
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) return false;
    var seen = {};
    for (var i = 0; i < 4; i++) {
      var low = String(q.o[i] == null ? "" : q.o[i]).trim().toLowerCase();
      if (!low || seen[low]) return false;
      seen[low] = true;
    }
    return true;
  }

  function offlineAdapter(opts) {
    var deck = opts.deck || {};
    var bank = (opts.questions || []).filter(questionOk);
    var byId = {};
    bank.forEach(function (q) { byId[q.id] = q; });
    var LS = "toeic.dungeon." + deck.key;
    function read() { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; } }
    function write(w) { try { localStorage.setItem(LS, JSON.stringify(w)); } catch (e) {} }
    function publicRun(run) { var r = clone(run); r.id = "local"; return r; }
    function payload(run) {
      var floors = Rules.floorsOf(run);
      var list = floors[run.floorNo - 1] || [];
      var monsters = list.map(function (qid, i) {
        var q = byId[qid];
        return {
          qid: qid, id: qid,
          q: q ? q.q : "(Câu này đã bị xóa khỏi bộ đề)",
          o: q ? q.o : [], passage: q ? q.passage : null,
          topic: q ? q.t : "", num: q ? q.num : null,
          boss: list.length >= 3 && i === list.length - 1,
        };
      });
      return {
        floors: floors.length, floorNo: run.floorNo, seed: run.seed,
        chestCount: list.length >= 12 ? 2 : 1, monsters: monsters,
      };
    }
    function current() {
      var w = read();
      if (!w || !w.run) return null;
      w.run.id = "local";
      return w;
    }
    return {
      kind: "offline",
      getStatus: function () {
        var total = bank.length;
        if (total < C.minQuestionsToPlay) {
          return Promise.resolve({ eligible: false, total: total, reason: "Bộ đề cần ít nhất " + C.minQuestionsToPlay + " câu chơi được.", segments: [] });
        }
        var w = current();
        var floors = Core.splitFloors(total).length;
        if (w && w.certificate) {
          return Promise.resolve({ eligible: true, total: total, segments: [{ no: 1, size: total, state: "completed", defeated: total, floorNo: 0, floors: floors, certificate: w.certificate }] });
        }
        if (w && w.run && w.run.status === "active") {
          return Promise.resolve({ eligible: true, total: total, segments: [{ no: 1, size: total, state: "active", defeated: w.run.defeated.length, floorNo: w.run.floorNo, floors: floors }] });
        }
        return Promise.resolve({ eligible: true, total: total, segments: [{ no: 1, size: total, state: "none", defeated: 0, floorNo: 0, floors: floors }] });
      },
      start: function () {
        var w = current();
        if (w && w.certificate) {
          return Promise.reject(fail("Chặng này đã hoàn thành — chứng chỉ đã được cấp.", 409, { certificate: w.certificate }));
        }
        if (w && w.run && w.run.status === "active") {
          return Promise.resolve(Object.assign({ run: publicRun(w.run) }, payload(w.run)));
        }
        var ids = bank.map(function (q) { return q.id; });
        var run = Rules.newRun({ seed: randomSeed(), questionIds: ids });
        run.id = "local";
        w = { v: 1, run: run, startedAt: new Date().toISOString() };
        write(w);
        return Promise.resolve(Object.assign({ run: publicRun(run) }, payload(run)));
      },
      fight: function (runId, qid, choice, o) {
        var w = current();
        if (!w || !w.run) return Promise.reject(fail("Không tìm thấy ván đang chơi.", 404));
        if (w.run.status !== "active") return Promise.reject(fail("Ván này đã kết thúc.", 409));
        var q = byId[qid];
        if (!q) return Promise.reject(fail("Câu này không còn trong bộ đề.", 409));
        try {
          var hinted = !!(o && o.hinted);
          var res = Rules.fight(w.run, qid, choice === q.a, { hinted: hinted });
          var next = res.run;
          if (hinted) next.pendingHints = (next.pendingHints || []).filter(function (x) { return x !== qid; });
          w.run = next;
          write(w);
          return Promise.resolve({
            correct: choice === q.a, answerIndex: q.a, events: res.events, exp: res.exp,
            run: publicRun(next), summary: Rules.summary(next), question: clone(q),
          });
        } catch (e) { return Promise.reject(fail(e.message, e.status || 400)); }
      },
      hint: function (runId, qid) {
        var w = current();
        if (!w || !w.run) return Promise.reject(fail("Không tìm thấy ván đang chơi.", 404));
        if (!(w.run.items.hint > 0)) return Promise.reject(fail("Bạn không có gợi ý.", 409));
        var q = byId[qid];
        if (!q) return Promise.reject(fail("Câu này không còn trong bộ đề.", 409));
        var wrong = [0, 1, 2, 3].filter(function (i) { return i !== q.a; });
        var rand = Core.rng(Core.hash32(w.run.seed + "|hint|" + qid));
        var eliminate = wrong[rand.int(wrong.length)];
        var next = clone(w.run);
        next.items.hint--;
        next.pendingHints = (next.pendingHints || []).filter(function (x) { return x !== qid; }).concat(qid);
        w.run = next;
        write(w);
        return Promise.resolve({ eliminate: eliminate, run: publicRun(next) });
      },
      chest: function (runId, floorNo, idx) {
        var w = current();
        if (!w || !w.run) return Promise.reject(fail("Không tìm thấy ván đang chơi.", 404));
        try {
          var r = Rules.openChest(w.run, floorNo, idx);
          w.run = r.run;
          write(w);
          return Promise.resolve({ loot: r.loot, run: publicRun(r.run) });
        } catch (e) { return Promise.reject(fail(e.message, e.status || 400)); }
      },
      potion: function () {
        var w = current();
        if (!w || !w.run) return Promise.reject(fail("Không tìm thấy ván đang chơi.", 404));
        try {
          var next = Rules.useItem(w.run, "potion");
          w.run = next;
          write(w);
          return Promise.resolve({ run: publicRun(next) });
        } catch (e) { return Promise.reject(fail(e.message, e.status || 400)); }
      },
      descend: function () {
        var w = current();
        if (!w || !w.run) return Promise.reject(fail("Không tìm thấy ván đang chơi.", 404));
        try {
          var next = Rules.descend(w.run);
          w.run = next;
          write(w);
          return Promise.resolve(Object.assign({ run: publicRun(next) }, payload(next)));
        } catch (e) { return Promise.reject(fail(e.message, e.status || 400)); }
      },
      finish: function (runId, holderName) {
        var w = current();
        if (!w || !w.run) return Promise.reject(fail("Không tìm thấy ván đang chơi.", 404));
        var holder = String(holderName == null ? "" : holderName).trim();
        if (holder.length < 2 || holder.length > 40) return Promise.reject(fail("Tên người nhận phải từ 2 đến 40 ký tự.", 400));
        try {
          var done = Rules.finish(w.run);
          var stats = Rules.summary(done);
          var cert = {
            practice: true, code: null, holderName: holder, fileTitle: deck.title || "Bộ đề",
            total: stats.total, firstTry: stats.firstTry, assisted: stats.assisted, medal: stats.medal,
            segment: 1, segments: 1, startedAt: w.startedAt, issuedAt: new Date().toISOString(), revoked: false,
          };
          w.run = done;
          w.certificate = cert;
          write(w);
          return Promise.resolve({ certificate: cert, expBonus: EXP_BONUS[stats.medal] || 0, summary: stats });
        } catch (e) { return Promise.reject(fail(e.message, e.status || 400)); }
      },
      certificate: function () { var w = current(); return w && w.certificate ? w.certificate : null; },
    };
  }

  /* ---------- dựng màn chơi ---------- */
  function mount(container, opts) {
    unmount();
    injectCss();
    var saved = readLS(LS_OPTS, {}) || {};
    var reduce = saved.reduceMotion;
    if (reduce == null) reduce = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var dpad = saved.dpad;
    if (dpad == null) {
      var room = Math.max(16, root.innerWidth - root.innerHeight + 96);
      dpad = !!(root.matchMedia && root.matchMedia("(pointer: coarse)").matches) ||
        root.innerWidth < 720 || room >= 352;
    }
    var deck = (opts && opts.deck) || { key: "deck", title: "Bộ đề" };
    S = {
      opts: opts || {}, deck: deck,
      adapter: (opts && opts.adapter) || offlineAdapter({ deck: deck, questions: [] }),
      online: !!(opts && opts.adapter && opts.adapter.kind === "online"),
      expBonus: 0, run: null, seed: 0, floors: 0, floorNo: 1, chestCount: 1,
      floor: null, pos: null, vis: {}, visited: {}, queue: [], walkAfter: null,
      anim: null, animDone: null, raf: 0, battle: null, modal: false, pauseOpen: false,
      paused: false, reduced: !!reduce, dpad: !!dpad,
      w: 0, h: 0, cell: 0, ox: 0, oy: 0, ended: false, ro: null,
      keyHandler: null, visHandler: null, resizeHandler: null,
    };
    var hostEl = container || document.body;
    var elRoot = document.createElement("div");
    elRoot.className = "dg-root";
    elRoot.tabIndex = -1;
    elRoot.setAttribute("aria-label", "Mê cung kho báu");
    elRoot.innerHTML =
      '<div class="dg-hud">' +
      '<button class="dg-btn" data-act="exit">← Thoát</button>' +
      '<span class="dg-chip" data-k="hearts"></span>' +
      '<span class="dg-chip" data-k="floor"></span>' +
      '<span class="dg-chip" data-k="left"></span>' +
      '<button class="dg-item" data-act="potion">🧪<b data-k="potion">0</b></button>' +
      '<span class="dg-item">🔍<b data-k="hint">0</b></span>' +
      '<span class="dg-item">🛡<b data-k="shield">0</b></span>' +
      '<span class="dg-chip" data-k="gold"></span>' +
      '<span class="dg-grow"></span>' +
      '<span class="dg-chip" data-k="exp"></span>' +
      '<button class="dg-btn" data-act="mute" aria-label="Tắt/bật tiếng">🔊</button>' +
      '<button class="dg-btn" data-act="full" aria-label="Toàn màn hình">⛶</button>' +
      "</div>" +
      '<div class="dg-stage">' +
      '<canvas class="dg-canvas" tabindex="0" role="application" aria-label="Mê cung kho báu — phím mũi tên/WASD"></canvas>' +
      '<div class="dg-note" role="status" aria-live="polite"></div>' +
      '<div class="dg-dpad" data-k="dpad">' +
      '<button type="button" data-dir="up" aria-label="Đi lên">↑</button>' +
      '<button type="button" data-dir="left" aria-label="Đi trái">←</button>' +
      '<button type="button" data-dir="down" aria-label="Đi xuống">↓</button>' +
      '<button type="button" data-dir="right" aria-label="Đi phải">→</button>' +
      "</div>" +
      "</div>" +
      '<div class="dg-keys">←↑↓→/WASD đi · chạm ô để tự đi · E rương/thang · H gợi ý · P dừng · M tiếng · F toàn màn hình</div>' +
      '<div class="dg-back dg-hide" data-k="back"></div>';
    hostEl.appendChild(elRoot);
    function q(sel) { return elRoot.querySelector(sel); }
    S.root = elRoot;
    S.els = {
      hearts: q('[data-k="hearts"]'), floor: q('[data-k="floor"]'), left: q('[data-k="left"]'),
      potion: q('[data-k="potion"]'), hint: q('[data-k="hint"]'), shield: q('[data-k="shield"]'),
      gold: q('[data-k="gold"]'), exp: q('[data-k="exp"]'), dpad: q('[data-k="dpad"]'),
      back: q('[data-k="back"]'), note: q(".dg-note"), canvas: q(".dg-canvas"), stage: q(".dg-stage"),
      mute: q('[data-act="mute"]'),
    };
    S.ctx = S.els.canvas.getContext("2d");

    elRoot.addEventListener("click", onRootClick);
    S.els.canvas.addEventListener("click", onCanvasClick);
    S.els.canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    S.els.canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    S.keyHandler = onKey;
    document.addEventListener("keydown", S.keyHandler);
    S.visHandler = function () { if (document.hidden && S && !S.battle && !S.modal) setPaused(true); };
    document.addEventListener("visibilitychange", S.visHandler);
    S.resizeHandler = function () { layoutCanvas(); };
    root.addEventListener("resize", S.resizeHandler);
    root.addEventListener("orientationchange", S.resizeHandler);
    document.addEventListener("fullscreenchange", S.resizeHandler);
    S.fsHandler = S.resizeHandler;
    if (root.ResizeObserver) {
      S.ro = new root.ResizeObserver(function () { layoutCanvas(); });
      S.ro.observe(S.els.stage);
    }
    S.els.mute.textContent = muted() ? "🔇" : "🔊";

    if (!opts || opts.autoFullscreen !== false) autoFull();
    if (opts && opts.viewCertificate) showSavedCertificate();
    else begin((opts && opts.startSegment) || 1);
  }

  function unmount() {
    if (!S) return;
    try {
      var fe = document.fullscreenElement || document.webkitFullscreenElement;
      if (fe && S.root && (fe === S.root || S.root.contains(fe))) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      }
    } catch (e) {}
    if (S.raf) cancelAnimationFrame(S.raf);
    if (S.keyHandler) document.removeEventListener("keydown", S.keyHandler);
    if (S.visHandler) document.removeEventListener("visibilitychange", S.visHandler);
    if (S.resizeHandler) {
      root.removeEventListener("resize", S.resizeHandler);
      root.removeEventListener("orientationchange", S.resizeHandler);
      document.removeEventListener("fullscreenchange", S.resizeHandler);
    }
    if (S.ro) { try { S.ro.disconnect(); } catch (e) {} }
    if (S.root && S.root.parentNode) S.root.parentNode.removeChild(S.root);
    S = null;
  }

  /* ---------- ván ---------- */
  function begin(segment) {
    if (!S) return;
    note("Đang mở ván…");
    S.adapter.start(S.deck.key, segment || 1).then(function (p) {
      applyStart(p);
    }).catch(function (err) {
      var cert = err && err.payload && err.payload.certificate;
      if (cert) { S.ended = true; showCertificate(cert, null, 0); return; }
      note("Không mở được ván: " + (err && err.message ? err.message : err));
    });
  }

  function applyStart(p) {
    if (!S || !p || !p.run) { note("Server không trả về ván."); return; }
    S.run = p.run;
    S.seed = p.seed == null ? p.run.seed : p.seed;
    S.floors = p.floors;
    S.floorNo = p.floorNo || p.run.floorNo;
    S.chestCount = p.chestCount || 1;
    S.floor = makeFloor(S.seed, S.floorNo, p.monsters || [], S.chestCount);
    S.pos = { x: S.floor.start.x, y: S.floor.start.y };
    S.visited = {}; S.vis = {}; S.queue = []; S.walkAfter = null; S.anim = null; S.animDone = null;
    computeVis();
    layoutCanvas();
    render();
    focusCanvas();
    var done = (S.run.defeated || []).length;
    note(done
      ? "Tiếp tục ván: tầng " + S.floorNo + "/" + S.floors + " · " + done + "/" + S.run.questionIds.length + " quái đã hạ."
      : "Phím không ăn thì bấm nút mũi tên. Hạ hết quái rồi bấm E ở cầu thang 🪜.");
  }

  function makeFloor(seed, floorNo, monsters, chestCount) {
    var layout = Core.generateFloor({
      seed: Core.hash32(seed + "|" + floorNo),
      monsters: monsters.length,
      chests: chestCount,
    });
    var boss = null, rest = [];
    monsters.forEach(function (m) { if (m.boss && !boss) boss = m; else rest.push(m); });
    var ri = 0;
    var occ = layout.monsters.map(function (p) {
      var isBoss = !!(p.boss && boss);
      var m = isBoss ? boss : rest[ri++] || null;
      return {
        qid: m ? m.qid : null, x: p.x, y: p.y, boss: isBoss,
        q: m ? m.q : "", o: m ? m.o : [], passage: m ? m.passage : null,
        topic: m ? m.topic : "", num: m ? m.num : null,
      };
    });
    return {
      floorNo: floorNo, size: layout.size, cells: layout.cells, grid: layout.grid,
      start: layout.start, stairs: layout.stairs, dist: layout.dist,
      monsters: occ, chests: layout.chests, chestCount: chestCount,
    };
  }

  /* ---------- sương mù, vị trí ---------- */
  function computeVis() {
    if (!S || !S.floor) return;
    var f = S.floor, out = {}, seen = {};
    var q = [{ x: S.pos.x, y: S.pos.y, d: 0 }];
    seen[keyOf(S.pos.x, S.pos.y)] = 1;
    out[keyOf(S.pos.x, S.pos.y)] = 1;
    for (var i = 0; i < q.length; i++) {
      var p = q[i];
      if (p.d >= 4) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = p.x + d[0], ny = p.y + d[1];
        if (ny < 0 || ny >= f.size || nx < 0 || nx >= f.size) return;
        var k = keyOf(nx, ny);
        if (f.grid[ny][nx] !== 0) { out[k] = 1; return; } // thấy được mặt tường
        if (seen[k]) return;
        seen[k] = 1;
        out[k] = 1;
        q.push({ x: nx, y: ny, d: p.d + 1 });
      });
    }
    S.vis = out;
  }
  function isOpen(x, y) {
    var f = S && S.floor;
    return !!f && y >= 0 && y < f.size && x >= 0 && x < f.size && f.grid[y][x] === 0;
  }
  function liveMonsterAt(p) {
    if (!S || !S.floor || !p) return null;
    var ms = S.floor.monsters;
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].x === p.x && ms[i].y === p.y && ms[i].qid && S.run.defeated.indexOf(ms[i].qid) < 0) return ms[i];
    }
    return null;
  }
  function liveMonsters() {
    if (!S || !S.floor) return [];
    return S.floor.monsters.filter(function (m) { return m.qid && S.run.defeated.indexOf(m.qid) < 0; });
  }
  function chestIndexAt(p) {
    if (!S || !S.floor) return -1;
    for (var i = 0; i < S.floor.chests.length; i++) {
      if (S.floor.chests[i].x === p.x && S.floor.chests[i].y === p.y) return i;
    }
    return -1;
  }
  function chestOpened(idx) {
    return !!S && S.run.chests.indexOf(S.floorNo + ":" + idx) >= 0;
  }
  function onStairs() {
    return !!S && S.floor && S.pos.x === S.floor.stairs.x && S.pos.y === S.floor.stairs.y;
  }
  function floorCleared() { return !!S && Rules.floorCleared(S.run, S.run.floorNo); }

  /* ---------- vẽ ---------- */
  function layoutCanvas() {
    if (!S || !S.floor) return;
    var box = S.els.stage.getBoundingClientRect();
    var n = S.floor.size;
    var w = Math.max(240, Math.floor((box.width || root.innerWidth) - 8));
    var h = Math.max(240, Math.floor((box.height || root.innerHeight) - 8));
    var dpr = Math.max(1, Math.min(root.devicePixelRatio || 1, 2));
    if (w * dpr > 2560) dpr = 2560 / w;
    S.w = w; S.h = h;
    S.cw = w / n; S.ch = h / n; S.cell = Math.min(S.cw, S.ch);
    var cv = S.els.canvas;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    if (S.ctx) S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function draw() {
    if (!S || !S.ctx || !S.floor || !S.cell) return;
    var c = S.ctx, f = S.floor, cell = S.cell, W = S.w, H = S.h, cw = S.cw, ch = S.ch;
    // Sương mù: toàn bộ ô chưa thấy chìm trong nền tối (mục 9.3 của đặc tả).
    c.fillStyle = "#070b14";
    c.fillRect(0, 0, W, H);
    // gạch chéo mờ gợi sương mù trên phần chưa khám phá
    c.strokeStyle = "rgba(255,255,255,.025)";
    c.beginPath();
    for (var gx = -H; gx < W; gx += 22) { c.moveTo(gx, 0); c.lineTo(gx + H, H); }
    c.stroke();
    // khung hầm để biết vùng chơi dù sương còn dày
    c.strokeStyle = "#2a3550";
    c.strokeRect(0.5, 0.5, W - 1, H - 1);
    for (var y = 0; y < f.size; y++) {
      for (var x = 0; x < f.size; x++) {
        var k = keyOf(x, y);
        if (!S.vis[k]) continue;
        var visited = S.visited[k];
        if (f.grid[y][x] === 1) {
          c.fillStyle = visited ? "#66799e" : "#4a5a7a";
        } else {
          c.fillStyle = visited ? "#31415f" : "#202b42";
        }
        c.fillRect(x * cw, y * ch, cw, ch);
        // vạch lưới mờ cho dễ ước lượng bước đi
        c.strokeStyle = "rgba(255,255,255,.045)";
        c.strokeRect(x * cw + 0.5, y * ch + 0.5, cw - 1, ch - 1);
      }
    }
    // cầu thang
    if (S.vis[keyOf(f.stairs.x, f.stairs.y)]) {
      if (floorCleared()) {
        c.strokeStyle = "#e8b21a";
        c.lineWidth = Math.max(2, cell * 0.06);
        c.beginPath();
        c.arc((f.stairs.x + 0.5) * cw, (f.stairs.y + 0.5) * ch, cell * 0.4, 0, Math.PI * 2);
        c.stroke();
      }
      emoji(c, STAIRS, f.stairs.x, f.stairs.y, cell * 0.62);
    }
    // rương
    f.chests.forEach(function (p, i) {
      if (!S.vis[keyOf(p.x, p.y)]) return;
      emoji(c, chestOpened(i) ? CHEST_OPEN : CHEST, p.x, p.y, cell * 0.58);
    });
    // quái
    f.monsters.forEach(function (m) {
      if (!m.qid || S.run.defeated.indexOf(m.qid) >= 0) return;
      if (!S.vis[keyOf(m.x, m.y)]) return;
      var cx = (m.x + 0.5) * cw, cy = (m.y + 0.5) * ch;
      if (m.boss) {
        c.strokeStyle = "#e8b21a";
        c.lineWidth = Math.max(2, cell * 0.07);
        c.beginPath();
        c.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
        c.stroke();
      }
      emoji(c, m.boss ? BOSS : MONSTER_BY_TOPIC[m.topic] || MONSTER_OTHER, m.x, m.y, cell * (m.boss ? 0.8 : 0.62));
      var letter = String(m.topic || "?").charAt(0).toUpperCase();
      c.fillStyle = "#c9d6f2";
      c.font = "600 " + Math.max(8, Math.round(cell * 0.22)) + "px system-ui,sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(letter, cx, (m.y + 0.84) * ch);
    });
    // nhân vật (trượt giữa hai ô ~120 ms)
    var px = S.pos.x, py = S.pos.y;
    if (S.anim) {
      var t = Math.max(0, Math.min(1, (Date.now() - S.anim.t0) / S.anim.dur));
      var e = t * (2 - t);
      px = S.anim.fx + (S.anim.tx - S.anim.fx) * e;
      py = S.anim.fy + (S.anim.ty - S.anim.fy) * e;
    }
    emoji(c, PLAYER, px, py, cell * 0.7);
    // la bàn khi còn <= 20% quái
    var live = liveMonsters();
    if (live.length && live.length <= Math.ceil(f.monsters.length * 0.2)) {
      var step = compassStep();
      if (step) {
        var cx2 = (S.pos.x + 0.5) * cw, cy2 = (S.pos.y + 0.5) * ch;
        var a = Math.atan2(step.y, step.x);
        var r = cell * 0.72;
        c.save();
        c.translate(cx2 + Math.cos(a) * r, cy2 + Math.sin(a) * r);
        c.rotate(a);
        c.fillStyle = "#e8b21a";
        c.beginPath();
        c.moveTo(cell * 0.2, 0);
        c.lineTo(-cell * 0.12, -cell * 0.12);
        c.lineTo(-cell * 0.12, cell * 0.12);
        c.closePath();
        c.fill();
        c.restore();
      }
    }
  }
  function emoji(c, ch, x, y, size) {
    c.font = Math.round(size) + "px " + EMOJI_FONT;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(ch, (x + 0.5) * S.cw, (y + 0.5) * S.ch);
  }
  function compassStep() {
    if (!S || !S.floor) return null;
    var f = S.floor, monsterKeys = {};
    liveMonsters().forEach(function (m) { monsterKeys[keyOf(m.x, m.y)] = 1; });
    if (!Object.keys(monsterKeys).length) return null;
    var start = S.pos, prev = {}, seen = {}, q = [start], dist = {};
    seen[keyOf(start.x, start.y)] = 1;
    dist[keyOf(start.x, start.y)] = 0;
    var best = null, bestDist = 1e9;
    for (var i = 0; i < q.length; i++) {
      var p = q[i], pd = dist[keyOf(p.x, p.y)];
      if (pd >= bestDist) continue;
      var hit = false;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var nx = p.x + dirs[d][0], ny = p.y + dirs[d][1];
        if (monsterKeys[keyOf(nx, ny)]) { hit = true; break; }
      }
      if (hit) { best = p; bestDist = pd; continue; }
      for (var j = 0; j < 4; j++) {
        var ax = p.x + dirs[j][0], ay = p.y + dirs[j][1];
        if (!isOpen(ax, ay)) continue;
        var k = keyOf(ax, ay);
        if (seen[k]) continue;
        seen[k] = 1;
        dist[k] = pd + 1;
        prev[k] = { x: p.x, y: p.y };
        q.push({ x: ax, y: ay });
      }
    }
    if (!best) return null;
    var cur = best;
    while (prev[keyOf(cur.x, cur.y)] && !(prev[keyOf(cur.x, cur.y)].x === start.x && prev[keyOf(cur.x, cur.y)].y === start.y)) {
      cur = prev[keyOf(cur.x, cur.y)];
    }
    return { x: cur.x - start.x, y: cur.y - start.y };
  }

  /* ---------- HUD ---------- */
  function render() {
    if (!S || !S.run) return;
    var run = S.run;
    S.els.hearts.textContent = "❤️".repeat(run.hearts) + "🖤".repeat(Math.max(0, C.hearts - run.hearts));
    S.els.floor.textContent = "Tầng " + run.floorNo + "/" + S.floors;
    S.els.left.textContent = "Quái còn " + (S.floor ? liveMonsters().length : 0);
    S.els.potion.textContent = run.items.potion;
    S.els.hint.textContent = run.items.hint;
    S.els.shield.textContent = run.items.shield;
    S.els.gold.textContent = "🪙" + run.gold;
    S.els.exp.textContent = "+" + run.exp + " EXP";
    S.els.mute.textContent = muted() ? "🔇" : "🔊";
    S.els.dpad.classList.toggle("dg-hide", !S.dpad);
    draw();
  }
  function note(msg) {
    if (!S) return;
    S.els.note.textContent = msg || "";
  }
  function focusCanvas() {
    if (S && S.els.canvas) { try { S.els.canvas.focus({ preventScroll: true }); } catch (e) { S.els.canvas.focus(); } }
  }

  /* ---------- đi lại ---------- */
  function busyMove() { return !S || S.paused || S.modal || S.anim || S.queue.length; }
  function animateTo(cellObj, done) {
    if (!S) return;
    var from = { x: S.pos.x, y: S.pos.y };
    S.pos = { x: cellObj.x, y: cellObj.y };
    S.visited[keyOf(cellObj.x, cellObj.y)] = 1;
    computeVis();
    var dur = S.reduced ? 0 : 120;
    if (!dur) {
      S.anim = null;
      render();
      if (done) done();
      return;
    }
    S.anim = { fx: from.x, fy: from.y, tx: cellObj.x, ty: cellObj.y, t0: Date.now(), dur: dur };
    S.animDone = done || null;
    startDrawLoop();
  }
  function startDrawLoop() {
    if (!S || S.raf) return;
    S.raf = requestAnimationFrame(function tick() {
      if (!S) return;
      S.raf = 0;
      draw();
      if (S.anim && (Date.now() - S.anim.t0) >= S.anim.dur) {
        S.anim = null;
        var d = S.animDone;
        S.animDone = null;
        if (d) d();
      }
      if (S.anim) startDrawLoop();
    });
  }
  function move(dx, dy) {
    if (!S || busyMove()) return;
    var n = { x: S.pos.x + dx, y: S.pos.y + dy };
    if (!isOpen(n.x, n.y)) {
      note("🚧 Tường chắn — thử hướng khác.");
      return;
    }
    var m = liveMonsterAt(n);
    if (m) { openBattle(m); return; }
    S.queue = []; S.walkAfter = null;
    animateTo(n, function () {
      var ci = chestIndexAt(n);
      if (ci >= 0 && !chestOpened(ci)) note("🧰 Có rương ở đây — bấm E để mở.");
    });
  }
  function walkTo(tx, ty) {
    if (!S || busyMove()) return;
    if (tx === S.pos.x && ty === S.pos.y) return;
    var targetMonster = liveMonsterAt({ x: tx, y: ty });
    if (targetMonster && Math.abs(tx - S.pos.x) + Math.abs(ty - S.pos.y) === 1) { openBattle(targetMonster); return; }
    if (!targetMonster && !isOpen(tx, ty)) return;
    var path = targetMonster
      ? bfsPath({ x: S.pos.x, y: S.pos.y }, function (p) { return Math.abs(p.x - tx) + Math.abs(p.y - ty) === 1; })
      : bfsPath({ x: S.pos.x, y: S.pos.y }, function (p) { return p.x === tx && p.y === ty; });
    if (!path) { note("Không có đường đi tới đó."); return; }
    if (!path.length) { if (targetMonster) openBattle(targetMonster); return; }
    S.queue = path;
    S.walkAfter = targetMonster ? function () { var m = liveMonsterAt({ x: tx, y: ty }); if (m) openBattle(m); } : null;
    nextWalkStep();
  }
  function nextWalkStep() {
    if (!S) return;
    if (S.paused || S.modal || S.battle || !S.queue.length) {
      var after = S.walkAfter;
      S.queue = []; S.walkAfter = null;
      if (after && !S.paused && !S.modal && !S.battle) after();
      return;
    }
    var nxt = S.queue[0];
    var m = liveMonsterAt(nxt);
    if (m) { S.queue = []; S.walkAfter = null; openBattle(m); return; }
    S.queue.shift();
    animateTo(nxt, function () {
      var ci = chestIndexAt(nxt);
      if (ci >= 0 && !chestOpened(ci)) {
        S.queue = []; S.walkAfter = null;
        note("🧰 Có rương ở đây — bấm E để mở.");
        return;
      }
      nextWalkStep();
    });
  }
  function bfsPath(from, goal, limit) {
    if (!S) return null;
    var f = S.floor, seen = {}, prev = {}, q = [from];
    seen[keyOf(from.x, from.y)] = 1;
    for (var i = 0; i < q.length; i++) {
      var p = q[i];
      if (goal(p) && !(p.x === from.x && p.y === from.y)) {
        var path = [], cur = p;
        while (!(cur.x === from.x && cur.y === from.y)) {
          path.push(cur);
          cur = prev[keyOf(cur.x, cur.y)];
        }
        return path.reverse();
      }
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var nx = p.x + dirs[d][0], ny = p.y + dirs[d][1];
        if (!isOpen(nx, ny)) continue;
        if (liveMonsterAt({ x: nx, y: ny })) continue;
        var k = keyOf(nx, ny);
        if (seen[k]) continue;
        seen[k] = 1;
        prev[k] = { x: p.x, y: p.y };
        q.push({ x: nx, y: ny });
        if (limit && q.length > limit) return null;
      }
    }
    return null;
  }

  /* ---------- hộp thoại ---------- */
  function showDialog(html) {
    S.modal = true;
    S.els.back.innerHTML = '<div class="dg-dialog" role="dialog" aria-modal="true" aria-labelledby="dgDlgTitle">' + html + "</div>";
    S.els.back.classList.remove("dg-hide");
    return S.els.back.querySelector(".dg-dialog");
  }
  function closeDialog() {
    if (!S) return;
    S.modal = false;
    S.pauseOpen = false;
    S.els.back.classList.add("dg-hide");
    S.els.back.innerHTML = "";
  }

  /* ---------- trận đánh ---------- */
  function openBattle(m) {
    if (!S || S.battle || !m || !m.o || m.o.length !== 4) return;
    S.queue = []; S.walkAfter = null;
    var order = [0, 1, 2, 3];
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    S.battle = { m: m, order: order, hinted: false, judged: false, picked: null, busy: false, result: null };
    var topic = m.topic || "khác";
    var icon = MONSTER_BY_TOPIC[topic] || MONSTER_OTHER;
    var qnum = m.num == null ? "?" : m.num;
    var sub = "Câu " + qnum + " · tầng " + S.run.floorNo + (m.boss ? " · ⚔️ TRÙM ×2" : "");
    var opts = order.map(function (orig, di) {
      return '<button type="button" class="dg-opt" data-opt="' + di + '"><b>' + LETTERS[di] + ".</b> " + esc(m.o[orig]) + "</button>";
    }).join("");
    var dlg = showDialog(
      '<h3 id="dgDlgTitle">' + (m.boss ? "👑 " : "") + icon + " Quái " + esc(topic) + (m.boss ? " — TRÙM" : "") + "</h3>" +
      '<p class="dg-sub">' + esc(sub) + "</p>" +
      (m.passage ? '<div class="dg-passage">' + esc(m.passage) + "</div>" : "") +
      '<p class="dg-q">' + esc(m.q) + "</p>" +
      '<div class="dg-opts">' + opts + "</div>" +
      '<div class="dg-actions"><button type="button" class="dg-btn" data-act="hint">💡 Gợi ý (H)</button><span class="dg-grow"></span><button type="button" class="dg-btn" data-act="retreat">Lùi lại</button></div>' +
      '<div class="dg-feedback" aria-live="polite"></div><div class="dg-expl"></div>'
    );
    S.battle.dialog = dlg;
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-opt]"), function (b) {
      b.onclick = function () { choose(Number(b.getAttribute("data-opt"))); };
    });
    dlg.querySelector('[data-act="hint"]').onclick = useHint;
    dlg.querySelector('[data-act="retreat"]').onclick = retreatBattle;
    var first = dlg.querySelector("[data-opt]");
    if (first) first.focus();
    if (m.boss) note("⚔️ Trùm xuất hiện!");
  }
  function choose(di) {
    var b = S && S.battle;
    if (!b || b.judged || b.busy) return;
    var original = b.order[di];
    b.busy = true;
    b.picked = original;
    var dlg = b.dialog;
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-opt]"), function (x) { x.disabled = true; });
    dlg.querySelector(".dg-feedback").textContent = "Đang chấm…";
    S.adapter.fight(S.run.id, b.m.qid, original, { hinted: b.hinted }).then(function (res) {
      if (!S || S.battle !== b) return;
      b.busy = false;
      b.judged = true;
      b.result = res;
      S.run = res.run;
      if (res.exp) { if (S.opts.onExp) S.opts.onExp(res.exp); }
      paintResult(res);
      render();
    }).catch(function (err) {
      if (!S || S.battle !== b) return;
      b.busy = false;
      b.picked = null;
      Array.prototype.forEach.call(dlg.querySelectorAll("[data-opt]"), function (x) { x.disabled = false; });
      dlg.querySelector(".dg-feedback").innerHTML = '<span class="dg-bad">⚠ ' + esc(err.message || err) + "</span>";
    });
  }
  function paintResult(res) {
    var b = S.battle, dlg = b.dialog;
    var correct = !!res.correct;
    var events = res.events || [];
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-opt]"), function (btn) {
      var di = Number(btn.getAttribute("data-opt"));
      var orig = b.order[di];
      btn.disabled = true;
      btn.classList.toggle("dg-right", orig === res.answerIndex);
      btn.classList.toggle("dg-wrong", orig === b.picked && !correct);
      if (orig === res.answerIndex) btn.insertAdjacentHTML("beforeend", " <b>✓</b>");
      else if (orig === b.picked) btn.insertAdjacentHTML("beforeend", " <b>✗</b>");
    });
    var chips = [];
    var done = false;
    events.forEach(function (e) {
      if (e.type === "hurt" && e.dmg) chips.push("−" + e.dmg + " ❤️");
      if (e.type === "shield") chips.push("🛡 Khiên chặn đòn");
      if (e.type === "assisted") chips.push("📖 Sách giải đã hạ quái (0 EXP)");
      if (e.type === "knockedOut") chips.push("💫 Ngất — về cổng vào");
      if (e.type === "floorCleared") chips.push("🪜 Cầu thang mở");
      if (e.type === "runCompleted") { done = true; chips.push("💰 Đủ quái — kho báu!"); }
    });
    var head = correct
      ? '<span class="dg-ok"><b>✅ Chính xác</b></span> — +' + res.exp + " EXP"
      : '<span class="dg-bad"><b>❌ Chưa đúng</b></span>';
    if (chips.length) head += " · " + chips.join(" · ");
    dlg.querySelector(".dg-feedback").innerHTML = head;
    var q2 = mergeQuestion(b.m, res.question);
    var expl = "";
    try {
      if (S.opts.explainHtml) expl = S.opts.explainHtml(explainSafe(q2), correct ? "right" : "wrong", b.picked);
    } catch (e) { expl = ""; }
    dlg.querySelector(".dg-expl").innerHTML = expl || "";
    var actions = dlg.querySelector(".dg-actions");
    actions.innerHTML = '<span class="dg-grow"></span><button type="button" class="dg-btn dg-primary" data-act="continue">' +
      (done ? "💰 Nhận kho báu (Enter)" : "Tiếp tục (Enter)") + "</button>";
    actions.querySelector('[data-act="continue"]').onclick = continueBattle;
    actions.querySelector('[data-act="continue"]').focus();
    if (correct) sfx.win(); else sfx.miss();
    if (done) sfx.finish();
  }
  function mergeQuestion(m, q) {
    var out = {
      id: m.qid, t: m.topic || "", q: m.q, o: m.o, passage: m.passage,
      num: m.num, status: "ok", explanation: null, explanationStatus: "none", coach: null, translation: null,
    };
    if (q) {
      ["id", "t", "q", "o", "a", "n", "s", "num", "f", "qtype", "status", "passage", "explanation",
        "explanationStatus", "coach", "translation", "payload", "audioUrl", "reviewReasons"].forEach(function (k) {
        if (q[k] !== undefined && q[k] !== null) out[k] = q[k];
      });
    }
    if (!out.t) out.t = m.topic || "";
    if (out.a == null) out.a = 0;
    return out;
  }
  /* Bản luyện tập (offline) không có server: bỏ id để khối Gia sư AI không xuất hiện,
     vì nút đó sẽ gọi mạng. Giải thích 💡 miễn phí trong máy vẫn hiện đủ. */
  function explainSafe(q) {
    if (S.online) return q;
    var copy = Object.assign({}, q);
    copy.id = undefined;
    copy.ucid = undefined;
    copy.coach = null;
    return copy;
  }
  function useHint() {
    var b = S && S.battle;
    if (!b || b.judged || b.busy) return;
    if (!(S.run.items.hint > 0)) { note("Bạn không có gợi ý."); return; }
    S.adapter.hint(S.run.id, b.m.qid).then(function (res) {
      if (!S || S.battle !== b) return;
      S.run = res.run;
      b.hinted = true;
      var di = b.order.indexOf(res.eliminate);
      var btn = di >= 0 ? b.dialog.querySelector('[data-opt="' + di + '"]') : null;
      if (btn) {
        btn.disabled = true;
        btn.classList.add("dg-elim");
        btn.insertAdjacentHTML("beforeend", " — <i>đã loại</i>");
      }
      var hintBtn = b.dialog.querySelector('[data-act="hint"]');
      if (hintBtn) hintBtn.textContent = "💡 Còn " + S.run.items.hint + " gợi ý (H)";
      note("💡 Đã loại một đáp án sai · còn " + S.run.items.hint + " gợi ý.");
      render();
    }).catch(function (e) { note("Không lấy được gợi ý: " + e.message); });
  }
  function retreatBattle() {
    var b = S && S.battle;
    if (!b || b.busy) return;
    closeDialog();
    S.battle = null;
    note("Đã lùi lại — chưa mất gì.");
    render();
    focusCanvas();
  }
  function continueBattle() {
    var b = S && S.battle;
    if (!b || !b.judged) return;
    var events = (b.result && b.result.events) || [];
    closeDialog();
    S.battle = null;
    var knocked = events.some(function (e) { return e.type === "knockedOut"; });
    var cleared = events.some(function (e) { return e.type === "floorCleared"; });
    var done = events.some(function (e) { return e.type === "runCompleted"; });
    var msg = "";
    if (knocked) {
      S.pos = { x: S.floor.start.x, y: S.floor.start.y };
      computeVis();
      msg = "💫 Bạn ngất — về cổng vào tầng này. Quái đã hạ vẫn chết.";
    }
    if (done) { render(); openTreasure(); return; }
    if (cleared) msg += (msg ? " " : "") + "🪜 Tầng đã sạch quái — đi tới cầu thang và bấm E.";
    if (msg) note(msg);
    render();
    focusCanvas();
  }

  /* ---------- rương, thuốc, tầng ---------- */
  function openChest(idx) {
    S.adapter.chest(S.run.id, S.floorNo, idx).then(function (res) {
      if (!S) return;
      S.run = res.run;
      var loot = res.loot || {};
      var item = loot.item === "potion" ? "🧪 1 thuốc hồi tim" : loot.item === "hint" ? "🔍 1 gợi ý" : loot.item === "shield" ? "🛡 1 khiên" : "không có vật phẩm";
      note("🧰 Rương: +" + (loot.gold || 0) + " vàng · " + item);
      sfx.chest();
      render();
    }).catch(function (e) { note("Không mở được rương: " + e.message); });
  }
  function drinkPotion() {
    if (!S || !S.run) return;
    if (S.run.hearts >= C.hearts) { note("Tim đã đầy, chưa cần thuốc."); return; }
    if (!(S.run.items.potion > 0)) { note("Bạn không có thuốc hồi tim."); return; }
    S.adapter.potion(S.run.id).then(function (res) {
      if (!S) return;
      S.run = res.run;
      note("🧪 Uống thuốc — hồi 1 tim.");
      render();
    }).catch(function (e) { note("Không dùng được thuốc: " + e.message); });
  }
  function interact() {
    if (!S || S.modal || S.paused) return;
    var ci = chestIndexAt(S.pos);
    if (ci >= 0 && !chestOpened(ci)) return openChest(ci);
    if (onStairs()) {
      if (!floorCleared()) { note("Còn quái ở tầng này — hạ hết rồi mới xuống được."); return; }
      if (S.run.floorNo >= S.floors) { openTreasure(); return; }
      note("Đang xuống tầng…");
      S.adapter.descend(S.run.id).then(function (p) {
        if (!S) return;
        applyDescend(p);
      }).catch(function (e) { note("Không xuống được: " + e.message); });
      return;
    }
    note("Không có rương hay cầu thang ở ô này.");
  }
  function applyDescend(p) {
    S.run = p.run;
    S.floors = p.floors;
    S.floorNo = p.floorNo;
    S.chestCount = p.chestCount || 1;
    S.floor = makeFloor(p.seed == null ? S.seed : p.seed, S.floorNo, p.monsters || [], S.chestCount);
    S.pos = { x: S.floor.start.x, y: S.floor.start.y };
    S.visited = {}; S.vis = {}; S.queue = []; S.walkAfter = null; S.anim = null; S.animDone = null;
    computeVis();
    layoutCanvas();
    render();
    sfx.stair();
    note("🪜 Xuống tầng " + S.floorNo + "/" + S.floors + " — sương mù mở lại từ cổng vào.");
    focusCanvas();
  }

  /* ---------- tạm dừng / cài đặt ---------- */
  function setPaused(v) {
    if (!S || S.battle) return;
    if (v && !S.paused) {
      S.paused = true;
      S.pauseOpen = true;
      var dlg = showDialog(
        '<h3 id="dgDlgTitle">⏸ Tạm dừng</h3>' +
        '<p class="dg-sub">Bấm P/Esc để chơi tiếp.</p>' +
        '<label class="dg-field"><input type="checkbox" id="dgOptReduce"' + (S.reduced ? " checked" : "") + " /> Giảm chuyển động (nhân vật nhảy từng ô)</label>" +
        '<label class="dg-field"><input type="checkbox" id="dgOptDpad"' + (S.dpad ? " checked" : "") + " /> Hiện nút mũi tên (D-pad)</label>" +
        '<div class="dg-actions"><button type="button" class="dg-btn" data-act="exit">← Thoát</button><span class="dg-grow"></span><button type="button" class="dg-btn dg-primary" data-act="resume">▶ Chơi tiếp</button></div>'
      );
      dlg.querySelector('[data-act="resume"]').onclick = function () { closePause(); };
      dlg.querySelector('[data-act="exit"]').onclick = exit;
      dlg.querySelector("#dgOptReduce").onchange = function (e) {
        S.reduced = e.target.checked;
        saveSettings();
      };
      dlg.querySelector("#dgOptDpad").onchange = function (e) {
        S.dpad = e.target.checked;
        saveSettings();
        render();
      };

      dlg.querySelector('[data-act="resume"]').focus();
    } else if (!v && S.paused) closePause();
  }
  function closePause() {
    if (!S) return;
    S.paused = false;
    closeDialog();
    render();
    focusCanvas();
  }
  function saveSettings() {
    writeLS(LS_OPTS, { reduceMotion: S.reduced, dpad: S.dpad });
  }

  /* ---------- kho báu & chứng chỉ ---------- */
  /* Thưởng ván mê cung trả bằng xu: máy chủ tự qui đổi huy chương (Vàng 15 · Bạc 10 · Đồng 6),
     ở đây chỉ báo "đã xong chặng" rồi nối dòng kết quả vào chứng chỉ. Không có onRound (chơi khách) thì bỏ qua. */
  var MEDAL_PLACE = { gold: 0, silver: 1, bronze: 2 };
  function reportRound(medal) {
    var cb = S && S.opts.onRound;
    var place = MEDAL_PLACE[medal];
    if (!cb || place == null) return;
    var p = cb("maze", place);
    if (!p || !p.then) return;
    p.then(function (r) {
      var box = document.querySelector(".dg-xu");
      if (!r || !box) return;
      box.hidden = false;
      /* Được thưởng thì nói số xu; không được thì nói LÝ DO máy chủ đưa (hết trần 30 xu/ngày,
         hết hạn ván, chơi khách...) — bảng kết quả không bao giờ im lặng về phần thưởng. */
      box.textContent = r.reward
        ? "🪙 Thưởng ván này: +" + r.reward + " xu (ví " + r.balance + " xu)"
        : "🪙 Ván này chưa được thưởng xu: " + (r.error || "hôm nay nhà trò chơi đã đủ trần.");
    });
  }

  function openTreasure() {
    if (!S) return;
    var stats = Rules.summary(S.run);
    var nick = S.opts.getNickname ? S.opts.getNickname() : "";
    var dlg = showDialog(
      '<h3 id="dgDlgTitle">💰 Kho báu</h3>' +
      '<p>Bạn đã hạ toàn bộ quái của hầm! Nhập tên để nhận chứng chỉ.</p>' +
      '<p class="dg-sub">' + stats.total + " câu · " + stats.floors + " tầng · đúng ngay lần đầu " +
      stats.firstTry + "/" + stats.total + " · " + medalLabel(stats.medal) + "</p>" +
      '<label class="dg-field" for="dgName">Tên người nhận</label>' +
      '<input class="dg-input" id="dgName" maxlength="40" autocomplete="name" value="' + esc(nick) + '" />' +
      '<p class="dg-hint">Từ 2–40 ký tự, không đổi sau khi cấp.</p>' +
      '<div class="dg-err" aria-live="polite"></div>' +
      '<div class="dg-actions"><button type="button" class="dg-btn" data-act="back">Về bộ đề</button><span class="dg-grow"></span><button type="button" class="dg-btn dg-primary" data-act="finish">Nhận chứng chỉ</button></div>'
    );
    var input = dlg.querySelector("#dgName");
    var err = dlg.querySelector(".dg-err");
    var btn = dlg.querySelector('[data-act="finish"]');
    dlg.querySelector('[data-act="back"]').onclick = exit;
    function submit() {
      var name = input.value.trim();
      if (name.length < 2 || name.length > 40) { err.textContent = "Tên phải từ 2 đến 40 ký tự."; input.focus(); return; }
      btn.disabled = true;
      err.textContent = "";
      S.adapter.finish(S.run.id, name).then(function (res) {
        if (!S) return;
        if (res.expBonus) { if (S.opts.onExp) S.opts.onExp(res.expBonus); }
        showCertificate(res.certificate, res.summary, res.expBonus || 0);
        reportRound(res.certificate.medal);
      }).catch(function (e) {
        if (e && e.payload && e.payload.certificate) { showCertificate(e.payload.certificate, null, 0); return; }
        btn.disabled = false;
        err.textContent = e.message || String(e);
      });
    }
    btn.onclick = submit;
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
    input.focus();
    try { input.select(); } catch (e) {}
  }

  function showSavedCertificate() {
    if (!S) return;
    var cert = S.adapter.certificate ? S.adapter.certificate() : null;
    if (!cert) {
      note("Chưa có chứng chỉ cho bộ này trên máy — hãy chơi hết một ván.");
      setTimeout(function () { if (S) exit(); }, 1200);
      return;
    }
    showCertificate(cert, null, 0);
  }

  function showCertificate(cert, summary, bonus) {
    if (!S || !cert) return;
    S.ended = true;
    var practice = !!cert.practice || !cert.code;
    var total = cert.total;
    var first = cert.firstTry;
    var pct = Math.round((first / Math.max(1, total)) * 100);
    var floors = (summary && summary.floors) || Core.splitFloors(total).length;
    var seg = cert.segment || 1, segs = cert.segments || 1;
    var verify = practice ? "" : location.origin + "/verify/" + cert.code;
    var wrongN = S.run ? Object.keys(S.run.wrong || {}).length : 0;
    var review = wrongN && S.opts.onReviewWrong
      ? '<button type="button" class="dg-btn" data-act="review">📓 Ôn ' + wrongN + " câu sai</button>"
      : "";
    var html =
      '<h3 id="dgDlgTitle">🏅 Chứng chỉ hoàn thành</h3>' +
      '<div class="dg-cert">' +
      '<p class="dg-cert-title">CHỨNG CHỈ HOÀN THÀNH</p>' +
      '<p class="dg-cert-name">' + esc(cert.holderName) + "</p>" +
      "<p>đã chinh phục hầm <b>«" + esc(cert.fileTitle) + "»</b>" + (segs > 1 ? " (Chặng " + seg + "/" + segs + ")" : "") + "</p>" +
      '<p class="dg-sub">' + total + " câu · " + floors + " tầng · đúng ngay lần đầu " + first + "/" + total + " (" + pct + "%) · " + medalLabel(cert.medal) + "</p>" +
      '<p class="dg-sub">Bắt đầu ' + fmtDate(cert.startedAt) + " → Hoàn thành " + fmtDate(cert.issuedAt) + "</p>" +
      '<p class="dg-cert-code">' + (practice ? "Bản luyện tập — chưa xác thực" : "Mã: <b>" + esc(cert.code) + "</b>") + "</p>" +
      (!practice
        ? '<p class="dg-sub">Kiểm tra công khai: <a href="/verify/' + esc(cert.code) + '" target="_blank" rel="noopener">' + esc(verify) + "</a></p>"
        : '<p class="dg-sub">Chơi trên server (npm start) để nhận mã xác thực HMAC và trang in A4.</p>') +
      '<p class="dg-disclaimer">Chứng chỉ tự học do ứng dụng cấp, không phải chứng chỉ TOEIC chính thức.</p>' +
      "</div>" +
      (bonus ? '<p class="dg-sub" style="margin-top:10px">🎁 Thưởng hoàn thành: +' + bonus + " EXP</p>" : "") +
      '<p class="dg-sub dg-xu" hidden></p>' +
      '<div class="dg-actions">' +
      '<button type="button" class="dg-btn" data-act="png">⬇ Tải PNG</button>' +
      (practice ? '' : '<button type="button" class="dg-btn" data-act="print">🖨 In / Lưu PDF</button>') +
      review +
      '<span class="dg-grow"></span>' +
      '<button type="button" class="dg-btn" data-act="exit">Về bộ đề</button>' +
      "</div>";
    var dlg = showDialog(html);
    dlg.querySelector('[data-act="png"]').onclick = function () { downloadCertificate(cert); };
    var printBtn = dlg.querySelector('[data-act="print"]');
    if (printBtn) printBtn.onclick = function () { printCertificate(cert); };
    var reviewBtn = dlg.querySelector('[data-act="review"]');
    if (reviewBtn) reviewBtn.onclick = function () { var cb = S.opts.onReviewWrong; exit(); cb(); };
    dlg.querySelector('[data-act="exit"]').onclick = exit;
    sfx.finish();
  }

  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    var lines = [], cur = "";
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width <= maxW) cur = t;
      else { if (cur) lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      var out = lines.slice(0, maxLines);
      var last = out[maxLines - 1];
      while (last.length && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      out[maxLines - 1] = last.trim() + "…";
      return out;
    }
    return lines;
  }

  function drawCertificate(cert) {
    var practice = !!cert.practice || !cert.code;
    var W = 1600, H = 1131, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var c = cv.getContext("2d");
    var total = cert.total, first = cert.firstTry, pct = Math.round((first / Math.max(1, total)) * 100);
    var floors = Core.splitFloors(total).length, gold = "#b8860b", ink = "#2b2410", soft = "#7b6a36";
    c.fillStyle = "#fffdf4"; c.fillRect(0, 0, W, H);
    c.strokeStyle = gold; c.lineWidth = 12; c.strokeRect(28, 28, W - 56, H - 56);
    c.textAlign = "center";
    function line(text, font, color, y) { c.font = font; c.fillStyle = color; c.fillText(text, W / 2, y); }
    line("MÊ CUNG KHO BÁU · ÔN TOEIC", "700 30px system-ui,Arial", ink, 145);
    line("CHỨNG CHỈ HOÀN THÀNH", "700 72px Georgia,serif", gold, 240);
    var ns = 76;
    c.font = "700 " + ns + "px Georgia,serif";
    while (c.measureText(cert.holderName).width > 1250 && ns > 40) { ns -= 4; c.font = "700 " + ns + "px Georgia,serif"; }
    c.fillStyle = ink; c.fillText(cert.holderName, W / 2, 445);
    line("đã chinh phục hầm", "400 32px system-ui,Arial", soft, 515);
    c.font = "700 46px system-ui,Arial"; c.fillStyle = ink;
    var lines = wrapLines(c, "«" + cert.fileTitle + (cert.segments > 1 ? " — Chặng " + cert.segment + "/" + cert.segments : "") + "»", 1260, 2);
    lines.forEach(function (ln, i) { c.fillText(ln, W / 2, 585 + i * 58); });
    var y = 625 + lines.length * 58;
    line(total + " câu · " + floors + " tầng · đúng ngay lần đầu " + first + "/" + total + " (" + pct + "%)", "400 32px system-ui,Arial", ink, y);
    line("Huy chương: " + (cert.medal === "gold" ? "Vàng" : cert.medal === "silver" ? "Bạc" : "Đồng"), "700 36px system-ui,Arial", gold, y + 56);
    line("Bắt đầu " + fmtDate(cert.startedAt) + "  →  Hoàn thành " + fmtDate(cert.issuedAt), "400 26px system-ui,Arial", soft, y + 116);
    line(practice ? "BẢN LUYỆN TẬP — CHƯA XÁC THỰC" : "MÃ CHỨNG CHỈ: " + cert.code, "600 30px Consolas,monospace", ink, H - 210);
    line(practice ? "Chơi qua server để nhận mã xác thực." : "Kiểm tra tại " + location.origin + "/verify/" + cert.code, "400 24px system-ui,Arial", soft, H - 160);
    line("Chứng chỉ tự học do ứng dụng cấp, không phải chứng chỉ TOEIC chính thức.", "400 22px system-ui,Arial", soft, H - 90);
    return cv;
  }

  function downloadCertificate(cert) {
    try {
      var cv = drawCertificate(cert);
      cv.toBlob(function (blob) {
        if (!blob) return;
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "chung-chi-" + (cert.code || "luyen-tap") + ".png";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }, "image/png");
    } catch (e) {
      note("Không tạo được ảnh chứng chỉ: " + e.message);
    }
  }
  function printCertificate(cert) {
    if (!cert.code) return;
    var w = root.open("/certificate/" + encodeURIComponent(cert.code), "_blank", "noopener");
    if (!w) note("Trình duyệt đã chặn cửa sổ in.");
  }

  /* ---------- thoát ---------- */
  function exit() {
    if (!S) return;
    var cb = S.opts.onExit;
    unmount();
    if (cb) { try { cb(); } catch (e) {} }
  }

  /* ---------- sự kiện ---------- */
  function onRootClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var dir = t.closest("[data-dir]");
    if (dir) {
      var d = dir.getAttribute("data-dir");
      move(d === "up" ? 0 : d === "down" ? 0 : d === "left" ? -1 : 1, d === "up" ? -1 : d === "down" ? 1 : 0);
      return;
    }
    var act = t.closest("[data-act]");
    if (!act) return;
    var a = act.getAttribute("data-act");
    if (a === "exit") exit();
    else if (a === "mute") toggleMute();
    else if (a === "full") toggleFull();
    else if (a === "potion") drinkPotion();
  }
  function toggleMute() {
    if (!S) return;
    var m = !muted();
    writeLS(LS_MUTE, m);
    S.els.mute.textContent = m ? "🔇" : "🔊";
    note(m ? "Đã tắt tiếng." : "Đã bật tiếng.");
    if (!m) sfx.chime ? sfx.chime() : tone("triangle", 880, null, 90, 0.15);
  }
  function autoFull() {
    if (!S || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
      var req = S.root.requestFullscreen || S.root.webkitRequestFullscreen;
      if (!req) return;
      var p = req.call(S.root);
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function toggleFull() {
    if (!S) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        var req = S.root.requestFullscreen || S.root.webkitRequestFullscreen;
        if (req) {
          var p = req.call(S.root);
          if (p && p.catch) p.catch(function () {});
        }
      }
    } catch (e) {}
  }
  function canvasCell(evt) {
    var r = S.els.canvas.getBoundingClientRect();
    var x = Math.floor((evt.clientX - r.left) / S.cw);
    var y = Math.floor((evt.clientY - r.top) / S.ch);
    if (x < 0 || y < 0 || x >= S.floor.size || y >= S.floor.size) return null;
    return { x: x, y: y };
  }
  function onCanvasClick(e) {
    if (!S || S.modal || S.paused) return;
    var c = canvasCell(e);
    if (!c) return;
    walkTo(c.x, c.y);
    focusCanvas();
  }
  var touch = null;
  function onTouchStart(e) {
    if (!S || S.modal || S.paused) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (t) touch = { x: t.clientX, y: t.clientY, at: Date.now() };
  }
  function onTouchEnd(e) {
    if (!S || !touch || S.modal || S.paused) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    var dist = Math.max(Math.abs(dx), Math.abs(dy));
    touch = null;
    if (dist < 24) return; // chạm thường để tự đi do sự kiện click xử lý
    e.preventDefault();
    if (Math.abs(dx) >= Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  }
  function onKey(e) {
    if (!S) return;
    var tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var k = e.key;
    if (S.battle) {
      if (k === "Escape") { e.preventDefault(); return; } // Esc không đóng trận
      if (!S.battle.judged) {
        if (/^[1-4]$/.test(k)) { e.preventDefault(); choose(Number(k) - 1); return; }
        if (k === "h" || k === "H") { e.preventDefault(); useHint(); return; }
        if (k === "Enter" || k === " ") { e.preventDefault(); return; }
      } else if (k === "Enter" || k === " ") { e.preventDefault(); continueBattle(); }
      return;
    }
    if (S.pauseOpen && (k === "p" || k === "P" || k === "Escape")) { e.preventDefault(); closePause(); return; }
    if (S.modal) return;
    if (k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); move(0, -1); }
    else if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); move(0, 1); }
    else if (k === "ArrowLeft" || k === "a" || k === "A") { e.preventDefault(); move(-1, 0); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { e.preventDefault(); move(1, 0); }
    else if (k === "e" || k === "E") { e.preventDefault(); interact(); }
    else if (k === "h" || k === "H") { e.preventDefault(); note("Gợi ý dùng trong trận đánh (phím H)."); }
    else if (k === "p" || k === "P") { e.preventDefault(); setPaused(true); }
    else if (k === "m" || k === "M") { e.preventDefault(); toggleMute(); }
    else if (k === "f" || k === "F") { e.preventDefault(); toggleFull(); }
  }

  /* ---------- xuất ---------- */
  root.DungeonGame = {
    mount: mount,
    unmount: unmount,
    onlineAdapter: onlineAdapter,
    offlineAdapter: offlineAdapter,
    MONSTER_BY_TOPIC: MONSTER_BY_TOPIC,
  };
})(typeof window !== "undefined" ? window : this);
