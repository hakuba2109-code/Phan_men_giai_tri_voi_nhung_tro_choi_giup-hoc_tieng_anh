"use strict";
/* GIAO DIỆN 3D "Thị trấn" (Three.js r128) — chế độ xem toàn cảnh của Thú ảo + Thị trấn.
   - window.Town3D.mount(container, opts) / unmount() / refresh()
   - Mọi số liệu và mọi phán quyết đến từ adapter:
       * onlineAdapter  -> /api/town (server + TownCore quyết định)
       * offlineAdapter -> localStorage + TownCore (chơi offline, không cần mạng)
   - Luật cứng (README thú ảo): không có thao tác nào trừ gì ngoài lúc người chơi CHỦ ĐỘNG xây/trồng.
     Vì vậy: bấm là xin adapter làm rồi mới vẽ lại; adapter báo lỗi (409) thì cảnh giữ nguyên. */
(function (root) {
  var THREE_URL = "/vendor/three.r128.min.js";
  var STAGE_NAMES = ["Trứng", "Con non", "Thiếu niên", "Trưởng thành", "Huyền thoại"];
  var PLOT_NAMES = ["Nhà ở", "Cửa hàng", "Thư viện", "Công viên"];
  var TOPIC_META = {
    "Thì": { icon: "⏳", zone: "Khu Đồng Hồ", color: "#f1d9a2" },
    "Từ loại": { icon: "🧱", zone: "Khu Xưởng Gạch", color: "#eab9a0" },
    "Giới từ": { icon: "🌉", zone: "Khu Cầu Cổng", color: "#a9d3e6" },
    "Đại từ": { icon: "👥", zone: "Khu Quảng Trường", color: "#cdbbe6" },
    "Từ vựng": { icon: "📚", zone: "Khu Phố Chợ", color: "#b9e0b2" },
  };
  var MORE_ICONS = ["🎧", "🧠", "📘", "🔎", "🗺️", "🧮", "🎬", "🔁", "🪶", "🧩"];
  var MORE_COLORS = ["#cfe6b9", "#b9d8e6", "#e6c9b9", "#d9b9e6", "#e6e0b9", "#b9e6dc", "#e6b9c9", "#c9d9e6"];

  /* ---------- tiện ích ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;")
      .split('"').join("&quot;").split("'").join("&#39;");
  }
  function readLS(key, def) { try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function writeLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function httpJson(url, body) {
    return fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j && j.error ? j.error : "Máy chủ trả lỗi " + r.status); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function metaOf(topic) {
    var known = TOPIC_META[topic];
    if (known) return known;
    var h = 0, s = String(topic);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    // tên chủ điểm lạ dài quá sẽ che hết nhãn 3D: gọn lại còn 16 chữ
    var zone = s.length > 16 ? s.slice(0, 15) + "…" : s;
    return { icon: MORE_ICONS[h % MORE_ICONS.length], zone: "Khu " + zone, color: MORE_COLORS[h % MORE_COLORS.length] };
  }

  /* ---------- CSS (dùng biến màu của trang, có nền tối) ---------- */
  var CSS =
    ".t3-root{display:flex;flex-direction:column;gap:10px;color:var(--ink)}" +
    ".t3-bar{display:flex;flex-wrap:wrap;gap:6px}" +
    ".t3-chip{background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:14px}" +
    ".t3-view{position:relative;height:min(64vh,560px);min-height:340px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#bfe3f5}" +
    ".t3-view canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}" +
    ".t3-lab{position:absolute;left:0;top:0;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600;white-space:nowrap;will-change:transform}" +
    ".t3-err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;background:var(--panel)}" +
    ".t3-err[hidden]{display:none}" +
    ".t3-ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
    ".t3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}" +
    ".t3-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}" +
    ".t3-card h3{margin:0 0 6px;font-size:15px}" +
    ".t3-plots{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-top:6px}" +
    ".t3-b{font:inherit;font-size:14px;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:5px 10px;cursor:pointer;touch-action:manipulation}" +
    ".t3-b:disabled{opacity:.55;cursor:default}" +
    ".t3-b.pri{background:var(--brand);color:#fff;border-color:var(--brand)}" +
    ".t3-b:focus-visible,.t3-view canvas:focus-visible{outline:3px solid var(--brand);outline-offset:2px}" +
    ".t3-b small{display:block;font-weight:400;font-size:12px;opacity:.85}" +
    ".t3-sel{font:inherit;font-size:14px;min-height:40px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:4px 8px}" +
    ".t3-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
    ".t3-msg{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-height:46px}" +
    ".t3-note{font-size:13px;color:var(--muted)}" +
    ".t3-mask{position:absolute;inset:0;background:rgba(6,10,16,.55);display:flex;align-items:center;justify-content:center;padding:14px;z-index:5}" +
    ".t3-mask[hidden]{display:none}" +
    ".t3-dlg{width:min(430px,100%);background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}" +
    ".t3-dlg h4{margin:0 0 6px;font-size:16px}" +
    ".t3-dlg .t3-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}";
  var styleDone = false;
  function ensureStyle() {
    if (styleDone || document.getElementById("t3-style")) { styleDone = true; return; }
    var st = document.createElement("style");
    st.id = "t3-style";
    st.textContent = CSS;
    document.head.appendChild(st);
    styleDone = true;
  }

  /* ---------- nạp Three.js: chỉ tải khi người chơi thật sự mở chế độ 3D ---------- */
  var threePromise = null;
  function loadThree() {
    if (root.THREE) return Promise.resolve(root.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = THREE_URL;
      s.async = true;
      s.onload = function () { root.THREE ? res(root.THREE) : rej(new Error("Three.js tải về nhưng không chạy được.")); };
      s.onerror = function () { threePromise = null; rej(new Error("Không tải được Three.js từ " + THREE_URL)); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  /* ==================== adapter online ==================== */
  function onlineAdapter() {
    var base = "/api/town";
    function post(path, body) { return httpJson(base + path, body); }
    return {
      kind: "online",
      getState: function () { return httpJson(base + "/"); },
      setPet: function (species, name) { return post("/pet", { species: species, name: name }).then(function () { return this.getState(); }.bind(this)); },
      build: function (topic, plot) { return post("/build", { topic: topic, plot: plot }).then(function () { return this.getState(); }.bind(this)); },
      garden: function (a) { return post("/garden", a).then(function () { return this.getState(); }.bind(this)); },
      feed: function (species) { return post("/feed", { species: species }).then(function () { return this.getState(); }.bind(this)); },
      setRest: function (days) { return post("/rest", { days: days }); },
      setEnabled: function (enabled) { return post("/settings", { enabled: enabled }); },
    };
  }

  /* ==================== adapter offline (localStorage + TownCore) ==================== */
  /* Giống server: đồng bộ TĂNG DẦN theo sổ cái tại chỗ, không thưởng hai lần cho một lượt trả lời. */
  var LS_LOG = "toeic.town.attempts";
  function recordAttempt(q, correct) {
    if (!q || !q.id) return;
    var log = readLS(LS_LOG, []);
    if (!Array.isArray(log)) log = [];
    log.push({ id: log.length + 1, ts: Date.now(), qid: String(q.id), topic: q.t || q.topic || "", correct: !!correct });
    if (log.length > 20000) log = log.slice(log.length - 20000);
    writeLS(LS_LOG, log);
  }
  function offlineAdapter(opts) {
    var Core = root.TownCore;
    if (!Core) throw new Error("offlineAdapter cần TownCore");
    var o = opts || {};
    var keyOf = typeof o.key === "function" ? o.key : function () { return o.key || "toeic.town.offline"; };
    var C = Core.CONFIG, tz = C.tz;
    function load() {
      var d = readLS(keyOf(), null);
      if (!d || typeof d !== "object") {
        d = { xu: 0, plots: {}, xp: 0, dayState: {}, mem: {}, doneTo: 0, garden: Core.emptyGarden(), treats: {}, agg: {}, pet: null };
      }
      /* Bản lưu cũ còn "vật liệu" riêng từng khu: đổi 1:1 sang ví xu chung rồi xóa khóa cũ đi. */
      if (d.materials && typeof d.materials === "object") {
        var old = 0;
        Object.keys(d.materials).forEach(function (tp) { old += Math.max(0, Math.floor(Number(d.materials[tp]) || 0)); });
        d.xu = Math.max(0, Math.floor(Number(d.xu) || 0)) + old;
        delete d.materials;
        writeLS(keyOf(), d);
      }
      d.garden = Core.normGarden(d.garden);
      d.xu = Math.max(0, Math.floor(Number(d.xu) || 0));
      return d;
    }
    function state(d) {
      var log = readLS(LS_LOG, []);
      if (!Array.isArray(log)) log = [];
      var fresh = log.slice(d.doneTo).filter(function (a) { return a && a.qid && a.topic; });
      if (fresh.length) {
        var out = Core.applyAttempts(d.dayState, d.mem, fresh, tz);
        d.dayState = out.state || d.dayState;
        d.mem = out.memory;
        for (var i = 0; i < out.ledger.length; i++) {
          var l = out.ledger[i], tp = l.topic;
          d.xu += l.amount; // một ví xu duy nhất: bài học cũng nạp thẳng vào ví, không có túi riêng từng khu
          d.xp += l.amount;
          var ag = d.agg[tp] || { earned: 0, lastStudy: null };
          ag.earned += l.amount;
          ag.lastStudy = ag.lastStudy < l.day ? l.day : ag.lastStudy;
          d.agg[tp] = ag;
        }
      }
      d.doneTo = log.length;
      // những ngày "đã cho thú ăn": >= fedMinAttempts lượt
      var perDay = {};
      for (var k = 0; k < log.length; k++) { var day = Core.dayKey(log[k].ts, tz); perDay[day] = (perDay[day] || 0) + 1; }
      var today = Core.dayKey(Date.now(), tz);
      var studyDays = {};
      for (var dd in perDay) if (perDay[dd] >= C.fedMinAttempts) studyDays[dd] = 1;
      var st = Core.stateView({
        today: today, zone: tz, xu: d.xu,
        xuDay: { lesson: d.dayState && d.dayState.day === today ? d.dayState.earned : 0, game: 0, file: 0, login: 0, streak: 0 },
        plots: d.plots, xp: d.xp,
        dayState: d.dayState, garden: d.garden, treats: d.treats, pet: d.pet,
        studyDays: new Set(Object.keys(studyDays)), todayAttempts: perDay[today] || 0,
        topics: Object.keys(d.agg), agg: d.agg,
      });
      // chủ điểm của ngân hàng câu local cũng phải hiện khu (dù chưa ôn câu nào)
      var seen = {};
      st.districts.forEach(function (x) { seen[x.topic] = 1; });
      (o.topics || []).forEach(function (tp) {
        if (!seen[tp]) st.districts.push({ topic: tp, plots: d.plots[tp] || Core.emptyPlots(), done: false, lastStudy: null, earned: 0 });
      });
      writeLS(keyOf(), d);
      return st;
    }
    function edit(fn) {
      var d = load();
      var today = Core.dayKey(Date.now(), tz);
      // Luật chơi ném Error kèm status (409/400) -> trả về Promise reject như adapter online, UI chỉ vẽ lại khi thành công.
      try { fn(d, today); } catch (err) { return Promise.reject(err); }
      return Promise.resolve(state(d));
    }
    return {
      kind: "offline",
      getState: function () { return Promise.resolve(state(load())); },
      build: function (topic, plot) {
        return edit(function (d, today) {
          var r = Core.build(d.plots, d.xu, topic, plot);
          d.plots = r.plots; d.xu = r.xu;
        });
      },
      garden: function (a) {
        return edit(function (d, today) {
          var r = a.action === "plant" ? Core.plant(d.garden, d.xu, a.slot, a.flower, today)
            : a.action === "water" ? Core.water(d.garden, a.slot, today)
            : Core.harvest(d.garden, d.xu, a.slot, today);
          d.garden = r.garden; d.xu = r.xu === undefined ? d.xu : r.xu;
        });
      },
      feed: function (species) {
        return edit(function (d, today) {
          // giống máy chủ: thị trấn chỉ còn một con thú — con của người chơi
          if (!d.pet) throw Object.assign(new Error("Bạn chưa chọn thú."), { status: 404 });
          if (species !== d.pet.species) throw Object.assign(new Error("Thị trấn của bạn chỉ có " + Core.PETS[d.pet.species].name + ". Hãy cho nó ăn."), { status: 400 });
          d.treats = Core.feed(d.treats, species, today).treats;
        });
      },
      setRest: function (days) {
        return edit(function (d, today) {
          if (!Number.isInteger(days) || days < 0 || days > C.maxRestDays) throw Object.assign(new Error("Số ngày nghỉ phải từ 0 đến " + C.maxRestDays + "."), { status: 400 });
          d.pet = d.pet || {}; d.pet.restUntil = days === 0 ? null : Core.addDays(today, days - 1);
        });
      },
      setEnabled: function () { return Promise.reject(Object.assign(new Error("Bản ngoại tuyến không có công tắc tắt thị trấn."), { status: 400 })); },
      setPet: function (species, name) {
        return edit(function (d) {
          if (!Core.PETS[species]) throw Object.assign(new Error("Loài thú không hợp lệ."), { status: 400 });
          var nm = String(name || "").trim();
          if (!nm.length || nm.length > 20) throw Object.assign(new Error("Tên thú phải có từ 1 đến 20 ký tự."), { status: 400 });
          // đã có thú thì chỉ đổi tên, loài giữ nguyên — giống máy chủ
          d.pet = { species: d.pet && d.pet.species ? d.pet.species : species, name: nm, restUntil: d.pet ? d.pet.restUntil : null };
        });
      },
    };
  }

  /* ==================== cảnh 3D ==================== */
  var R = null; // { renderer, scene, cam, ... } khi đã dựng
  var UI = null; // { root, els... }
  var ADAPTER = null, ST = null, loopId = 0, ro = null, lastTopicSel = null;
  var RM = false;

  function dom(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildDom(container) {
    ensureStyle();
    var rootEl = dom("div", "t3-root");
    rootEl.innerHTML =
      '<div class="t3-bar"><span class="t3-chip" data-r="chipXu"></span><span class="t3-chip" data-r="chipPet"></span><span class="t3-chip" data-r="chipDay"></span><span class="t3-chip">Kéo: xoay · Cuộn hoặc chụm: zoom · Bấm ô đất / bồn hoa / thú</span></div>' +
      '<div class="t3-view" data-r="view"><canvas data-r="cv" role="img" tabindex="0" aria-label="Cảnh thị trấn 3D. Dùng các bảng bên dưới để xây, trồng hoa và cho thú ăn bằng bàn phím."></canvas><div data-r="labs"></div><div class="t3-err" data-r="err" hidden></div><div class="t3-mask" data-r="mask" hidden><div class="t3-dlg" role="dialog" aria-modal="true" aria-labelledby="t3-dlg-t"><h4 id="t3-dlg-t" data-r="dlgT"></h4><p class="t3-note" data-r="dlgB"></p><div class="t3-row"><button class="t3-b pri" data-r="dlgOk"></button><button class="t3-b" data-r="dlgNo">Hủy</button></div></div></div></div>' +
      '<div class="t3-ctl">' +
      '<button class="t3-b" data-r="l" aria-label="Xoay trái">⟲</button><button class="t3-b" data-r="r" aria-label="Xoay phải">⟳</button>' +
      '<button class="t3-b" data-r="zo" aria-label="Thu nhỏ">➖</button><button class="t3-b" data-r="zi" aria-label="Phóng to">➕</button>' +
      '<button class="t3-b" data-r="reload">🔄 Xem lại thị trấn</button>' +
      '</div>' +
      '<div class="t3-grid">' +
      '<div class="t3-card"><h3>🏗️ Xây bằng bàn phím</h3><label>Khu: <select class="t3-sel" data-r="dsel"></select></label><div class="t3-plots" data-r="pl"></div></div>' +
      '<div class="t3-card"><h3>🌷 Vườn hoa</h3><div class="t3-row"><label>Hoa: <select class="t3-sel" data-r="fsel"></select></label><span class="t3-note" data-r="gprice"></span></div><div class="t3-plots" data-r="gb"></div><p class="t3-note" data-r="gnote"></p></div>' +
      '<div class="t3-card"><h3>🐾 Thú trong thị trấn</h3><div class="t3-plots" data-r="pet"></div><p class="t3-note" data-r="petNote"></p></div>' +
      '</div>' +
      '<div class="t3-msg" data-r="msg" aria-live="polite"></div>';
    container.appendChild(rootEl);
    var els = {};
    var all = rootEl.querySelectorAll("[data-r]");
    for (var i = 0; i < all.length; i++) els[all[i].getAttribute("data-r")] = all[i];
    return { root: rootEl, els: els };
  }

  function msg(t) { if (UI) UI.els.msg.textContent = t; }

  /* ---------- các hàm dựng khối (low-poly, đệm vật liệu theo màu) ---------- */
  var T, MC, GL, WIN, BK;
  function initKit() {
    T = root.THREE;
    MC = {};
    GL = { emissive: "#ffe9a8", emissiveIntensity: .35 };
    WIN = "#ffe9a8";
    BK = ["#e5484d", "#4a7de0", "#f2b34a", "#58b368", "#9b6bd6"];
  }
  function mat(c, o) { var k = c + (o ? JSON.stringify(o) : ""); return MC[k] || (MC[k] = new T.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .85 }, o))); }
  function put(g, geo, c, x, y, z, o) { var m = new T.Mesh(geo, mat(c, o)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
  function B(g, w, h, d, c, x, y, z, o) { return put(g, new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, o); }
  function Cy(g, rt, rb, h, c, x, y, z, s, o) { return put(g, new T.CylinderGeometry(rt, rb, h, s || 14), c, x, y + h / 2, z, o); }
  function K(g, r, h, c, x, y, z, s, o) { return put(g, new T.ConeGeometry(r, h, s || 12), c, x, y + h / 2, z, o); }
  function Sp(g, r, c, x, y, z, o) { return put(g, new T.SphereGeometry(r, 14, 10), c, x, y, z, o); }
  function Ro(g, w, h, d, c, x, y, z) {
    var s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    var geo = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); geo.translate(0, 0, -d / 2);
    return put(g, geo, c, x, y, z);
  }

  /* công trình: 4 loại x 3 cấp, nằm gọn trong ô ~1,7 */
  function model(i, lv) {
    var g = new T.Group();
    if (i === 0) {
      if (lv === 1) { K(g, .8, 1.1, "#e9c47e", 0, 0, 0, 4).rotation.y = Math.PI / 4; B(g, .3, .45, .05, "#5b3b22", 0, 0, .5); Cy(g, .025, .025, .5, "#7a5430", 0, 1.1, 0, 6); B(g, .3, .18, .03, "#e5484d", .15, 1.4, 0); }
      if (lv === 2) { B(g, 1.2, .75, 1, "#f4e6c8", 0, 0, 0); Ro(g, 1.4, .65, 1.15, "#c8553d", 0, .75, 0); B(g, .26, .42, .06, "#6b4423", 0, 0, .51); [-.38, .38].forEach(function (x) { B(g, .22, .22, .06, WIN, x, .32, .51, GL); }); }
      if (lv === 3) { B(g, 1.1, 1, 1.1, "#f4e6c8", -.2, 0, 0); Ro(g, 1.3, .7, 1.25, "#b5442e", -.2, 1, 0); B(g, .6, .65, .8, "#f4e6c8", .58, 0, .1); Ro(g, .7, .4, .9, "#b5442e", .58, .65, .1); B(g, .18, .55, .18, "#8a6d5a", -.5, 1, -.3); B(g, .26, .45, .06, "#6b4423", -.2, 0, .56); [-.55, .15].forEach(function (x) { B(g, .22, .24, .06, WIN, x, .55, .56, GL); }); B(g, .2, .2, .06, WIN, .58, .3, .51, GL); K(g, .12, .3, "#3f9b56", -.85, 0, .6, 8); }
    }
    if (i === 1) {
      if (lv === 1) {
        B(g, 1.1, .45, .65, "#a9783f", 0, 0, 0);
        [[-.5, -.3], [.5, -.3], [-.5, .3], [.5, .3]].forEach(function (p) { Cy(g, .04, .04, 1.1, "#7a5430", p[0], 0, p[1], 6); });
        var a = B(g, 1.3, .07, .85, "#d94f4f", 0, 1.1, 0); a.rotation.x = .15;
        [["#f2a33a", -.3], ["#e5484d", 0], ["#7acb5a", .3]].forEach(function (f) { Sp(g, .1, f[0], f[1], .53, 0); });
      }
      if (lv === 2) { B(g, 1.2, .8, 1, "#f7ead2", 0, 0, 0); B(g, 1.3, .1, 1.1, "#8a5a2b", 0, .8, 0); for (var k = 0; k < 4; k++) B(g, .3, .06, .4, k % 2 ? "#fff" : "#d94f4f", -.45 + k * .3, .72, .68); B(g, .26, .42, .06, "#6b4423", .3, 0, .51); B(g, .35, .3, .06, WIN, -.3, .2, .51, GL); }
      if (lv === 3) { B(g, 1.3, 1.5, 1.1, "#f7ead2", 0, 0, 0); B(g, 1.36, .08, 1.16, "#8a5a2b", 0, .75, 0); B(g, 1.4, .12, 1.2, "#8a5a2b", 0, 1.5, 0); for (var k2 = 0; k2 < 4; k2++) B(g, .33, .06, .45, k2 % 2 ? "#fff" : "#d94f4f", -.5 + k2 * .33, .68, .72); B(g, 1, .2, .06, "#e8b04a", 0, 1.15, .58, { metalness: .4 }); [-.4, 0, .4].forEach(function (x) { B(g, .2, .22, .06, WIN, x, .85, .56, GL); }); B(g, .28, .45, .06, "#6b4423", .35, 0, .56); B(g, .4, .32, .06, WIN, -.3, .2, .56, GL); }
    }
    if (i === 2) {
      if (lv === 1) { B(g, .9, .9, .35, "#8b5a2b", 0, 0, 0); for (var r = 0; r < 2; r++) for (var k3 = 0; k3 < 5; k3++) B(g, .12, .3, .25, BK[k3], -.34 + k3 * .17, .1 + r * .42, .1); B(g, 1, .06, .5, "#5b3b22", 0, .9, 0); }
      if (lv === 2) { B(g, 1.2, .8, 1, "#ebe3d2", 0, 0, 0); Ro(g, 1.4, .55, 1.15, "#6b7fa8", 0, .8, 0); [-.45, .45].forEach(function (x) { Cy(g, .07, .07, .8, "#fff", x, 0, .55, 10); }); B(g, .28, .45, .06, "#6b4423", 0, 0, .51); B(g, 1.3, .08, .2, "#d8d2c4", 0, 0, .62); }
      if (lv === 3) {
        B(g, 1.6, .12, 1.4, "#d8d2c4", 0, 0, 0); B(g, 1.3, 1, 1, "#f2ede0", 0, .12, -.1);
        for (var k4 = 0; k4 < 4; k4++) Cy(g, .07, .07, 1, "#fff", -.5 + k4 * .33, .12, .55, 10);
        B(g, 1.45, .1, .4, "#e0d8c6", 0, 1.12, .45); Ro(g, 1.4, .4, .3, "#f2ede0", 0, 1.22, .45); Cy(g, .36, .4, .25, "#e0d8c6", 0, 1.12, -.1, 16);
        put(g, new T.SphereGeometry(.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#d9a441", 0, 1.37, -.1, { metalness: .5, roughness: .4 });
        Cy(g, .025, .025, .2, "#d9a441", 0, 1.75, -.1, 6);
      }
    }
    if (i === 3) {
      if (lv === 1) { Cy(g, .05, .07, .45, "#7a5430", 0, 0, 0, 6); Sp(g, .28, "#69bd62", 0, .65, 0); [["#e5484d", -.5, .4], ["#f2b34a", .5, .45], ["#9b6bd6", .4, -.5]].forEach(function (f) { Sp(g, .08, f[0], f[1], .08, f[2]); }); }
      if (lv === 2) { Cy(g, .1, .14, .7, "#7a5430", 0, 0, 0, 8); K(g, .62, .8, "#3f9b56", 0, .5, 0, 8); K(g, .5, .7, "#4aad60", 0, .95, 0, 8); K(g, .35, .55, "#58bd6c", 0, 1.35, 0, 8); B(g, .5, .08, .2, "#a9783f", .55, .22, .5); B(g, .06, .22, .06, "#7a5430", .35, 0, .5); B(g, .06, .22, .06, "#7a5430", .75, 0, .5); }
      if (lv === 3) {
        Cy(g, .78, .84, .25, "#cfd3d8", 0, 0, 0, 20); Cy(g, .68, .68, .06, "#6bc4ea", 0, .24, 0, 20, { emissive: "#2a7fa8", emissiveIntensity: .3, roughness: .1 });
        Cy(g, .1, .14, .6, "#cfd3d8", 0, .25, 0, 10); Cy(g, .4, .22, .12, "#cfd3d8", 0, .85, 0, 16); Cy(g, .3, .3, .04, "#6bc4ea", 0, .96, 0, 16, { emissive: "#2a7fa8", emissiveIntensity: .3 });
        Sp(g, .12, "#9fdcf5", 0, 1.18, 0, { emissive: "#4aa8d0", emissiveIntensity: .4 });
        [[-.75, -.75], [.75, -.75]].forEach(function (p) { K(g, .2, .5, "#3f9b56", p[0], 0, p[1], 8); });
      }
    }
    return g;
  }

  /* ---------- thú: rồng / chó / mèo / cú / cáo. Giai đoạn 0 luôn là quả trứng. ---------- */
  function egg(g) {
    var e = Sp(g, .5, "#fff4dc", 0, .62, 0); e.scale.set(.85, 1.15, .85);
    [["#7ed4a0", -.2, .8, .4], ["#7ed4a0", .2, .5, .43], ["#f3a6b8", 0, 1.05, .3]].forEach(function (a) { Sp(g, .09, a[0], a[1], a[2], a[3]); });
    g.scale.setScalar(1.3); return g;
  }
  function dragon(g, st, eyes) {
    var G = "#5bc48d", L = "#d9f3c9";
    Sp(g, .62, G, 0, .7, 0).scale.set(1, 1.05, .95); Sp(g, .5, L, 0, .62, .28).scale.set(.85, .95, .5); Sp(g, .46, G, 0, 1.5, .12);
    [-1, 1].forEach(function (s) {
      Sp(g, .1, "#fff", s * .2, 1.58, .46); eyes.push(Sp(g, .055, "#222", s * .2, 1.58, .54));
      Sp(g, .07, "#f7a8b8", s * .3, 1.4, .4);
      var h = K(g, .08, .3, "#f2b34a", s * .22, 1.88, .1, 8); h.rotation.z = -s * .3;
      var w = Sp(g, .4, "#8fe0b4", s * .62, .95, -.15); w.scale.set(.15, .7, .5); w.rotation.z = s * .3;
      Sp(g, .2, G, s * .3, .12, .3).scale.set(1, .6, 1.3);
    });
    Sp(g, .17, L, 0, 1.4, .52);
    var tl = K(g, .14, .7, G, 0, 0, 0, 8); tl.position.set(0, .4, -.85); tl.rotation.x = -1.3;
    for (var k = 0; k < 3; k++) K(g, .09, .22, "#f2b34a", 0, 1 - k * .25, -.55 - k * .04, 8);
    if (st >= 2) { Sp(g, .08, "#e5484d", 0, 1.05, .55); [-1, 1].forEach(function (s) { var b = K(g, .1, .22, "#e5484d", s * .17, 1.05, .55, 6); b.rotation.z = s * -1.57; }); }
    if (st >= 3) { var t = put(g, new T.TorusGeometry(.4, .07, 8, 18), "#4a7de0", 0, 1.12, .12); t.rotation.x = Math.PI / 2; }
    if (st >= 4) {
      Cy(g, .22, .26, .18, "#ffd54a", 0, 1.93, .12, 8, { metalness: .6, roughness: .3 });
      for (var k5 = 0; k5 < 5; k5++) { var an = k5 / 5 * Math.PI * 2; K(g, .05, .16, "#ffd54a", Math.sin(an) * .24, 2.08, .12 + Math.cos(an) * .24, 6, { metalness: .6, roughness: .3 }); }
    }
    g.scale.setScalar([.9, 1, 1.12, 1.25][st - 1]);
  }
  /* bộ 4 chân + thân + đầu dùng chung cho chó / cáo / mèo */
  function quadruped(g, o, eyes) {
    var body = Sp(g, .5, o.body, 0, .5, 0); body.scale.set(.8, .7, 1.25);
    Sp(g, .3, o.body, 0, .52, .62).scale.set(1, 1, 1.1);           // đầu
    Sp(g, .16, o.muzzle, 0, .44, .86).scale.set(.9, .7, 1);        // mõm
    Sp(g, .05, "#222", 0, .5, .98);                                // mũi
    [-1, 1].forEach(function (s) {
      Sp(g, .06, "#fff", s * .13, .6, .82); eyes.push(Sp(g, .035, "#222", s * .13, .6, .86));
      B(g, .13, .34, .13, o.body, s * .27, 0, .38, o.dark); B(g, .13, .34, .13, o.body, s * .27, 0, -.34, o.dark);
    });
    Cy(g, .07, .09, .34, o.body, 0, .78, 0, 8);                    // cổ
    var tail = Cy(g, .05, .07, .5, o.tail, 0, .8, -.6, 8); tail.rotation.x = -.9; g.userData.tail = tail;
  }
  function dog(g, st, eyes) {
    quadruped(g, { body: st >= 3 ? "#d9a441" : "#e0b877", muzzle: "#f4e6c8", dark: null, tail: "#d9a441" }, eyes);
    [-1, 1].forEach(function (s) { B(g, .12, .22, .05, "#b8863b", s * .24, .74, .68).rotation.z = s * .35; }); // cụp tai
    if (st >= 2) { Sp(g, .07, "#e5484d", 0, .62, .7); }
    if (st >= 3) { var c = put(g, new T.TorusGeometry(.19, .045, 8, 16), "#4a7de0", 0, .64, .5); c.rotation.x = Math.PI / 2; }
    if (st >= 4) Cy(g, .16, .19, .13, "#ffd54a", 0, .86, .62, 8, { metalness: .6, roughness: .3 });
    g.scale.setScalar([.85, .95, 1.05, 1.15][st - 1]);
  }
  function fox(g, st, eyes) {
    quadruped(g, { body: "#e08a3c", muzzle: "#f7ead2", dark: null, tail: "#f2b34a" }, eyes);
    [-1, 1].forEach(function (s) { K(g, .11, .26, "#c96f28", s * .19, .78, .6, 6).rotation.z = s * .2; });
    g.userData.tail.scale.set(1.5, 1, 1.5);
    g.scale.setScalar([.8, .9, 1, 1.1][st - 1]);
  }
  function cat(g, st, eyes) {
    quadruped(g, { body: st >= 1 ? "#9a9fa8" : "#c9cdd4", muzzle: "#d9dce2", dark: null, tail: "#7f858f" }, eyes);
    [-1, 1].forEach(function (s) { K(g, .1, .22, "#7f858f", s * .17, .78, .6, 4); }); // tai nhọn
    [-1, 1].forEach(function (s) { B(g, .26, .012, .012, "#e8eaee", s * .2, .45, .92); }); // ria
    var t = g.userData.tail; t.rotation.x = -1.5; t.geometry = new T.CylinderGeometry(.05, .06, .7, 8);
    if (st >= 2) Sp(g, .06, "#9b6bd6", 0, .68, .55);
    g.scale.setScalar([.8, .9, 1, 1.05][st - 1]);
  }
  function owl(g, st, eyes) {
    var b = Sp(g, .55, "#8a6d5a", 0, .7, 0); b.scale.set(1, 1.15, .9);
    Sp(g, .38, "#d9c3a8", 0, .6, .3).scale.set(.9, 1.05, .5);
    Sp(g, .34, "#9c7d66", 0, 1.3, .08);
    [-1, 1].forEach(function (s) {
      Sp(g, .14, "#fff", s * .16, 1.38, .28); eyes.push(Sp(g, .07, "#222", s * .16, 1.38, .34));
      K(g, .1, .24, "#6b4f3d", s * .22, 1.6, .05, 6);
      var w = Sp(g, .34, "#7a5a45", s * .55, .8, -.05); w.scale.set(.16, .75, .5); w.rotation.z = s * .25;
    });
    K(g, .1, .18, "#f2b34a", 0, 1.24, .34, 6);
    var tail = Cy(g, .2, .1, .3, "#6b4f3d", 0, .35, -.5, 8); tail.rotation.x = .4; g.userData.tail = tail;
    if (st >= 3) { var c = put(g, new T.TorusGeometry(.36, .06, 8, 16), "#4a7de0", 0, 1.02, .06); c.rotation.x = Math.PI / 2; }
    g.scale.setScalar([.9, 1, 1.1, 1.2][Math.max(1, st) - 1]);
  }
  function petModel(species, st) {
    var g = new T.Group(), eyes = [];
    if (st === 0) { egg(g); g.userData.eyes = []; return g; }
    var fn = { rong: dragon, cho: dog, cao: fox, meo: cat, cu: owl }[species] || dog;
    fn(g, st, eyes);
    g.userData.eyes = eyes;
    return g;
  }

  /* ---------- tượng Nữ thần Tự do giữa quảng trường: chỉ là hình, không có chức năng ---------- */
  function liberty(g) {
    var STONE = "#c4b79b", DARK = "#a2937a", PAT = "#6fb9a4", PAT2 = "#4f9d8a", GOLD = "#f2c14e";
    B(g, 2.3, .22, 2.3, DARK, 0, 0, 0);
    B(g, 1.9, .55, 1.9, STONE, 0, .22, 0);
    B(g, 1.5, .8, 1.5, DARK, 0, .77, 0);
    B(g, .95, .28, .06, "#8d8168", 0, .95, .76);            // tấm biển trước bệ
    var y = 1.57;                                            // mặt trên của bệ
    Cy(g, .3, .78, 1.62, PAT, 0, y, 0, 12);                  // tà áo choàng
    for (var f = 0; f < 5; f++) {
      var fA = f / 5 * Math.PI * 2;
      Cy(g, .035, .06, .95, PAT2, Math.sin(fA) * .6, y + .02, Math.cos(fA) * .6, 6);
    }
    Sp(g, .4, PAT, 0, y + 1.66, 0).scale.set(1, .5, .68);    // vai
    Cy(g, .12, .15, .22, PAT, 0, y + 1.7, 0, 8);             // cổ
    Sp(g, .17, PAT2, 0, y + 1.98, .06);                      // tóc sau đầu
    Sp(g, .28, PAT, 0, y + 1.95, .02);                       // đầu
    Cy(g, .3, .32, .1, PAT2, 0, y + 2.05, .02, 12);          // vòng mão
    for (var s = 0; s < 7; s++) {
      var a = s / 7 * Math.PI * 2;
      var spike = K(g, .05, .36, PAT, Math.sin(a) * .3, y + 2.12, .02 + Math.cos(a) * .3, 6);
      spike.rotation.x = Math.cos(a) * .45; spike.rotation.z = -Math.sin(a) * .45;
    }
    Cy(g, .1, .13, .95, PAT, .42, y + 1.5, .04, 8).rotation.z = -.3;  // cánh tay giơ
    Sp(g, .12, PAT, .6, y + 2.5, .04);                                   // bàn tay
    Cy(g, .17, .09, .14, "#8d8168", .6, y + 2.56, .04, 10);              // lòng đuốc
    Sp(g, .19, GOLD, .6, y + 2.74, .04, { emissive: "#f2a71b", emissiveIntensity: .45 });
    Cy(g, .1, .12, .6, PAT, -.44, y + 1.05, .26, 8).rotation.x = .5;     // tay trái
    var tb = B(g, .14, .66, .46, "#e7dcc0", -.52, y + .98, .42);         // phiến đá khắc
    tb.rotation.y = .35; tb.rotation.z = .2;
    g.scale.setScalar(.95);
    return g;
  }

  /* ---------- dân thị trấn: người đi bộ giữa quảng trường và các khu. Thuần trang trí, không có trong stateView ---------- */
  var VIL_SKIN = ["#e8b48a", "#c98b62", "#8d5a3b"], VIL_HAT = ["#e5484d", "#4a7fd6", "#f2a33a", "#69bd62", "#9b6bd6"],
    VIL_PANTS = "#5a6b7d";
  function limb(g, w, h, d, c, x, y, z) {
    var p = new T.Group(); p.position.set(x, y, z); g.add(p);
    B(p, w, h, d, c, 0, -h, 0);
    return p;
  }
  function villager(shirt, j) {
    var g = new T.Group();
    B(g, .32, .38, .22, shirt, 0, .56, 0);                                   // thân
    Sp(g, .155, VIL_SKIN[j % VIL_SKIN.length], 0, 1.03, 0);                  // đầu
    var hat = VIL_HAT[j % VIL_HAT.length];
    Cy(g, .1, .175, .16, hat, 0, 1.12, 0, 10);                               // mũ
    B(g, .3, .035, .12, hat, 0, 1.09, .13);                                  // vành mũ quay về phía trước
    var legs = [limb(g, .12, .3, .12, VIL_PANTS, -.1, .58, 0), limb(g, .12, .3, .12, VIL_PANTS, .1, .58, 0)];
    var arms = [limb(g, .09, .3, .09, shirt, -.21, .92, 0), limb(g, .09, .3, .09, shirt, .21, .92, 0)];
    g.userData.vil = { legs: legs, arms: arms };
    return g;
  }
  // 1 người cho mỗi khu, thêm 1 khi khu đó có 2 nhà và 1 nữa khi đủ 4 nhà — tối đa 3/khu, 12/đảo
  function villagerPlan(st) {
    var out = [], n = nVisible(st);
    st.districts.slice(0, n).forEach(function (d, k) {
      var built = 0;
      for (var i = 0; i < d.plots.length; i++) if (d.plots[i] > 0) built++;
      var cnt = Math.min(3, 1 + (built >= 2 ? 1 : 0) + (built >= 4 ? 1 : 0));
      for (var j = 0; j < cnt && out.length < 12; j++) out.push({ k: k, n: n, j: j, color: metaOf(d.topic).color });
    });
    return out;
  }
  function syncVillagers(st) {
    var plan = villagerPlan(st);
    var sig = plan.map(function (p) { return p.k + "" + p.j; }).join(",");
    if (R.vilSig === sig && R.vilsG) return;
    if (R.vilsG) { disposeGroup(R.vilsG); R.scene.remove(R.vilsG); }
    var holder = new T.Group(); R.scene.add(holder);
    R.vilsG = holder; R.vils = []; R.vilSig = sig;
    var lane = R.L.lane, n = plan.length ? plan[0].n : 1, per = {};
    plan.forEach(function (x) { per[x.k] = (per[x.k] || 0) + 1; });
    plan.forEach(function (p) {
      var b = Math.PI / 2 + (p.k + .5) * 2 * Math.PI / n + (p.j - (per[p.k] - 1) / 2) * .22;
      var root = new T.Group(); root.userData.villager = 1; holder.add(root);
      var body = villager(p.color, (p.k + p.j) % VIL_HAT.length);
      root.add(body);
      // bán kính: vòng trong vẫn cách bồn hoa (3,6), vòng ngoài không chạm bệ khu (ring - 2,125)
      var r = lane - .05 + (p.j - 1) * .22;
      var span = clamp(2 * Math.PI / n * .32, .42, 1.05);   // góc đi được mỗi chiều quanh ô của mình
      var speed = .8 + (p.j % 3) * .12 + (p.k % 4) * .05;   // đơn vị vị trí mỗi giây
      var c = {
        g: root, body: body, m: body.userData.vil, b: b, span: span, r: r,
        wob: .13 + (p.j % 2) * .04,                         // lạch bạch ra/vào mép đường dạo
        w: speed * Math.PI / (2 * span * r),                // sao cho tốc độ thật đúng bằng `speed`
        kick: clamp(Math.PI * 2 * speed / 1.15, 3, 9),      // bước chân nhịp theo tốc độ
        ph: (p.k * 1.7 + p.j * 2.6) % 6.283
      };
      moveVil(c, RM ? 0 : (R.t || 0));
      R.vils.push(c);
    });
  }
  function moveVil(c, t) {
    var a = t * c.w + c.ph;
    // sóng tam giác (2/π·asin(sin a)): đi đều chân rồi quay đầu hẳn, không trớn như con sin
    var u = Math.asin(Math.sin(a)) * (2 / Math.PI), back = Math.cos(a) < 0;
    var th = c.b + c.span * u, r = c.r + c.wob * Math.sin(a * 2);
    c.g.position.set(r * Math.cos(th), RM ? 0 : Math.abs(Math.sin(t * c.kick + c.ph)) * .035, r * Math.sin(th));
    c.g.rotation.y = -th + (back ? Math.PI : 0);            // người mô hình quay mặt theo chiều đi
    var sw = RM ? 0 : Math.sin(t * c.kick + c.ph) * .55;
    c.m.legs[0].rotation.x = sw; c.m.legs[1].rotation.x = -sw;
    c.m.arms[0].rotation.x = -sw * .7; c.m.arms[1].rotation.x = sw * .7;
  }
  function moveVillagers(t) { var tt = RM ? 0 : t; for (var i = 0; i < R.vils.length; i++) moveVil(R.vils[i], tt); }

  /* ---------- bồn hoa: hạt -> mầm -> nở ---------- */
  function flowerModel(bed, spec) {
    var g = new T.Group();
    B(g, .9, .12, .9, "#8a5a2b", 0, 0, 0);
    B(g, .78, .06, .78, "#5b3b22", 0, .12, 0);
    if (!bed) return g;
    var color = (spec && spec.color) || "#e5484d";
    if (bed.stage === 0) { Sp(g, .07, "#c9a06a", 0, .22, 0); return g; }
    Cy(g, .035, .045, .34 * bed.stage, "#3f9b56", 0, .18, 0, 6);
    [-1, 1].forEach(function (s) { var l = Sp(g, .1, "#58bd6c", s * .12, .3, 0); l.scale.set(1.5, .25, .8); l.rotation.z = s * .4; });
    if (bed.mature) {
      Sp(g, .1, "#f2d34a", 0, .62, 0);
      for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; Sp(g, .09, color, Math.cos(a) * .14, .62, Math.sin(a) * .14); }
      Cy(g, .02, .02, .16, color, 0, .72, 0, 6);
    } else { Sp(g, .09, color, 0, .56, 0, { emissive: color, emissiveIntensity: .12 }); }
    if (bed.wateredToday) Sp(g, .06, "#6bc4ea", .28, .3, .28, { emissive: "#2a7fa8", emissiveIntensity: .4 });
    return g;
  }

  /* ---------- dựng đảo, ánh sáng, bố trí khu theo số chủ điểm THẬT ---------- */
  function layout(n) {
    var per = 5.9; // bề rộng 1 khu + lối đi
    var ring = Math.max(6.4, (n * per) / (2 * Math.PI));
    // đường dạo: vòng trong lòng các bệ khu (cách mép trong 0,47) và không chạm bồn hoa ở bán kính 3,6
    return { ring: ring, isl: ring + 4.6, cam: clamp(ring * 3.9, 20, 46), lane: Math.max(4.55, ring - 2.6) };
  }

  function createScene() {
    var els = UI.els, view = els.view;
    var renderer = new T.WebGLRenderer({ antialias: true, canvas: els.cv });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(42, 1, .1, 200);
    var hemi = new T.HemisphereLight("#d6ecff", "#7a8f6a", .8), sun = new T.DirectionalLight("#fff1d2", .9);
    sun.position.set(12, 20, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0006;
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(hemi, sun);
    var water = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshStandardMaterial({ color: "#5fb3d6", roughness: .25, metalness: .1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.2; scene.add(water);

    // đảo + quảng trường + tượng do buildStatic() lo (một nhóm keep), ở đây chỉ giữ bán kính khởi điểm
    var L = layout(1), isl = L.isl;

    var sky = new T.Group(); scene.add(sky);
    for (var k = 0; k < 5; k++) {
      var c = new T.Group(), a = k * 1.26, r = isl + 9 + k % 2 * 5;
      c.position.set(r * Math.cos(a), 11 + k % 3 * 2, r * Math.sin(a));
      [[0, 0, 0, 1.6], [1.4, -.2, .3, 1.2], [-1.3, -.2, -.2, 1.2]].forEach(function (s) {
        var m = new T.Mesh(new T.SphereGeometry(s[3], 10, 8), new T.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: .92 }));
        m.position.set(s[0], s[1], s[2]); c.add(m);
      });
      sky.add(c);
    }
    function theme() {
      var darkAttr = document.documentElement.getAttribute("data-theme");
      var dark = darkAttr === "dark" || (darkAttr !== "light" && root.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
      var bg = dark ? "#12202f" : "#bfe3f5";
      // đảo có thể to lên theo số khu: sương mù phải bám theo bán kính thật
      var islNow = (R && R.L && R.L.isl) || isl;
      scene.background = new T.Color(bg); scene.fog = new T.Fog(bg, islNow * 3.4, islNow * 8);
      hemi.intensity = dark ? .4 : .8; sun.intensity = dark ? .5 : .9;
      sun.color.set(dark ? "#a9bcff" : "#fff1d2");
      water.material.color.set(dark ? "#2a5a78" : "#5fb3d6");
      view.style.background = bg;
    }
    theme();
    var mq = root.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq) mq.addEventListener("change", theme);
    var mo = new MutationObserver(theme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return { renderer: renderer, scene: scene, cam: cam, hemi: hemi, sun: sun, water: water, sky: sky, theme: theme, mo: mo, mq: mq, isl: isl, labs: [], plots: {}, dists: {}, beds: [], pet: null, petSig: null, ground: null, groundIsl: 0, vils: [], vilsG: null, vilSig: null, t: 0, pops: [], parts: [] };
  }

  /* ---------- tạo lại khu / bồn hoa / thú theo state ---------- */
  function disposeGroup(g) {
    if (!g) return;
    g.traverse(function (o) { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  }
  function clearWorld() {
    if (!R) return;
    for (var k = 0; k < R.labs.length; k++) if (R.labs[k].el && R.labs[k].el.parentNode) R.labs[k].el.parentNode.removeChild(R.labs[k].el);
    R.labs = []; R.plots = {}; R.dists = {}; R.beds = []; R.pet = null;
    R.vils = []; R.vilsG = null; R.vilSig = null;   // dân đi dạo dựng lại cùng thế giới (bán kính đường dạo phụ thuộc số khu)
    var kids = R.scene.children.slice();
    for (var i = 0; i < kids.length; i++) {
      var o = kids[i];
      if (o === R.sky || o === R.hemi || o === R.sun || o === R.water) continue;
      if (o.userData && (o.userData.keep)) continue;
      disposeGroup(o);
      R.scene.remove(o);
    }
  }

  /* ---------- mặt đất cố định: đảo, cát, quảng trường, tượng. Chỉ dựng lại khi đảo đổi kích thước ---------- */
  function buildStatic(L) {
    if (R.ground && R.groundIsl === L.isl) return;
    if (R.ground) { disposeGroup(R.ground); R.scene.remove(R.ground); }
    var g = new T.Group(); g.userData.keep = 1; R.scene.add(g);
    var isl = L.isl;
    put(g, new T.CylinderGeometry(isl, isl + .6, 1.2, 48), "#78c27c", 0, -.6, 0);
    put(g, new T.CylinderGeometry(isl + .7, isl + 1.3, .9, 48), "#e3d19b", 0, -.75, 0);
    Cy(g, 2.4, 2.6, .25, "#e0d9c3", 0, 0, 0, 32);
    var sq = Cy(g, 2.55, 2.55, .12, "#c9c0a6", 0, 0, 0, 32); sq.scale.y = .8;
    var road = put(g, new T.RingGeometry(L.lane - .42, L.lane + .42, 72), "#d9cba4", 0, .02, 0);
    road.rotation.x = -Math.PI / 2; road.castShadow = false;               // đường dạo vòng quanh quảng trường
    var statue = new T.Group(); statue.position.set(0, .25, 0); statue.userData.statue = 1; g.add(statue);
    liberty(statue);
    R.ground = g; R.groundIsl = isl;
  }

  function mkLab(text) {
    var el = dom("div", "t3-lab", esc(text));
    UI.els.labs.appendChild(el);
    R.labs.push({ el: el }); // clearWorld chỉ dọn được nhãn nếu nó có mặt trong R.labs
    return el;
  }

  function buildWorld(st) {
    var n = Math.max(1, Math.min(st.districts.length, st.maxVisibleDistricts || 8));
    var L = layout(n);
    clearWorld();
    buildStatic(L);
    var ring = L.ring, isl = L.isl;

    var shown = st.districts.slice(0, n);
    shown.forEach(function (d, k) {
      var m = metaOf(d.topic), a = Math.PI / 2 + k * 2 * Math.PI / n;
      var x = ring * Math.cos(a), z = ring * Math.sin(a), ph = Math.atan2(-Math.cos(a), -Math.sin(a));
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ph; R.scene.add(g);
      // khu >= 14 ngày không ôn thì phủ màu xám nhạt (chỉ là hình, không trừ gì)
      var dusty = d.lastStudy && st.today && daysBetween(d.lastStudy, st.today) >= 14;
      B(g, 4.25, .22, 4.25, "#8a8274", 0, 0, 0);
      B(g, 4, .3, 4, dusty ? "#c4c6c2" : m.color, 0, 0, 0);
      var path = B(R.scene, 1.2, .05, 2, "#e8dfc6", (ring - 3) * Math.cos(a), 0, (ring - 3) * Math.sin(a));
      path.rotation.y = ph;
      var tr = new T.Mesh(new T.OctahedronGeometry(.28), mat("#ffd54a", { metalness: .6, roughness: .3 }));
      tr.position.set(0, 2.6, 0); tr.visible = false; g.add(tr);
      R.dists[d.topic] = { g: g, tr: tr, lab: mkLab(""), pos: new T.Vector3(x, 3.3, z), dusty: dusty };
      R.plots[d.topic] = [];
      for (var i = 0; i < PLOT_NAMES.length; i++) {
        var pg = new T.Group(); pg.position.set((i % 2 ? 1 : -1) * .97, .3, (i > 1 ? 1 : -1) * .97);
        pg.userData.plot = { topic: d.topic, i: i };
        g.add(pg);
        var pad = B(pg, 1.75, .06, 1.75, "#b99a6a", 0, 0, 0);
        var rm = new T.MeshBasicMaterial({ color: "#46d37f", transparent: true, opacity: .9 });
        var ring2 = new T.Mesh(new T.RingGeometry(.9, 1.02, 36), rm);
        ring2.rotation.x = -Math.PI / 2; ring2.position.y = .08; ring2.visible = false; pg.add(ring2);
        var slot = new T.Group(); slot.position.y = .06; pg.add(slot);
        R.plots[d.topic].push({ pg: pg, pad: pad, ring: ring2, rm: rm, slot: slot, model: null });
      }
      // cây + đá giữa hai khu
      var b = a + Math.PI / n, tx = (isl - 1.9) * Math.cos(b), tz = (isl - 1.9) * Math.sin(b);
      Cy(R.scene, .12, .16, .7, "#7a5430", tx, 0, tz, 6); K(R.scene, .8, 1.3, "#3f9b56", tx, .6, tz, 8); K(R.scene, .6, 1.1, "#4aad60", tx, 1.4, tz, 8);
      var rx = (isl - 1) * Math.cos(b + .2), rz = (isl - 1) * Math.sin(b + .2);
      put(R.scene, new T.DodecahedronGeometry(.4), "#9a9a94", rx, .15, rz);
    });

    // bồn hoa vòng quanh quảng trường
    var G = st.garden, nb = G.beds.length;
    for (var s = 0; s < nb; s++) {
      var ang = s / nb * Math.PI * 2, bx = 3.6 * Math.cos(ang), bz = 3.6 * Math.sin(ang);
      var bg = new T.Group(); bg.position.set(bx, 0, bz); bg.rotation.y = Math.atan2(-Math.cos(ang), -Math.sin(ang));
      bg.userData.bed = { slot: s };
      R.scene.add(bg);
      var modelG = new T.Group(); bg.add(modelG);
      R.beds.push({ g: bg, slot: modelG, model: null, lab: mkLab("") , pos: new T.Vector3(bx, 1.1, bz) });
    }

    // thú của người chơi đứng chếch bên tượng, không che quảng trường
    if (st.pet) {
      var pr = new T.Group();
      pr.position.set(1.8, .25, 1.3);
      pr.userData.pet = { species: st.pet.species };
      R.scene.add(pr);
      R.pet = { root: pr, model: null, species: st.pet.species, stage: -1, name: st.pet.name, lab: mkLab("") };
    }
    R.L = L;
    R.count = n;
    R.petSig = st.pet ? st.pet.species : "";
    R.sky.scale.set(L.isl / layout(1).isl, 1, L.isl / layout(1).isl); // mây chỉ ra xa theo mặt ngang, không dâng lên che ống kính
    R.theme();
    // đổi số khu = đổi kích thước đảo: đưa ống kính về khoảng cách khung cảnh mới
    if (Vt && V) Vt.r = clamp(L.cam, 12, L.isl * 4.2);
  }

  function daysBetween(a, b) {
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  }

  /* ---------- đồng bộ state -> hình + bảng ---------- */
  /* Một ví xu duy nhất: muốn xây thì nhìn số dư ví, không nhìn túi của từng khu. */
  var balanceOf = function (st) { return st && st.xu ? st.xu.balance : 0; };
  function canBuild(st, d, i) { var lv = d.plots[i]; return lv < 3 && balanceOf(st) >= CbuCost(st, lv); }
  function CbuCost(st, lv) {
    var p = st && st.xu && st.xu.prices;
    return (p && p.build[lv]) || (root.TownCore && root.TownCore.CONFIG.buildCost[lv]) || [20, 50, 100][lv];
  }

  function applyState(st) {
    ST = st;
    if (!R) return;
    if (!worldMatches(st)) buildWorld(st);
    // công trình
    st.districts.slice(0, nVisible(st)).forEach(function (d) {
      var list = R.plots[d.topic]; if (!list) return;
      var done = R.dists[d.topic];
      var m = metaOf(d.topic);
      done.lab.textContent = m.icon + " " + m.zone + " · +" + d.earned + " xu" + (d.done ? " 🏆" : "") + (done.dusty ? " 🕸️" : "");
      done.tr.visible = d.done;
      for (var i = 0; i < list.length; i++) {
        var p = list[i], lv = d.plots[i];
        if (lv !== (p.lv || 0) || !p.model && lv > 0) {
          if (p.model) { disposeGroup(p.model); p.slot.remove(p.model); p.model = null; }
          if (lv > 0) { p.model = model(i, lv); p.slot.add(p.model); }
          p.pad.material = mat(lv ? "#d7ccb0" : "#b99a6a");
          p.lv = lv;
        }
        p.ring.visible = canBuild(st, d, i);
      }
    });
    // bồn hoa
    st.garden.beds.forEach(function (b, s) {
      var bed = R.beds[s]; if (!bed) return;
      var spec = b.empty ? null : flowerSpec(st, b.flower);
      var sig = b.empty ? "e" : [b.stage, b.mature ? 1 : 0, b.wateredToday ? 1 : 0, b.flower].join(".");
      if (bed.sig !== sig) {
        if (bed.model) { disposeGroup(bed.model); bed.slot.remove(bed.model); }
        bed.model = flowerModel(b.empty ? null : b, spec);
        bed.slot.add(bed.model);
        bed.sig = sig;
      }
      bed.lab.textContent = b.empty ? "" : (b.mature ? "✨ " + (spec ? spec.name : "hoa") + " đã nở" : "💧 " + (spec ? spec.name : "hoa") + " " + b.stageName + " (" + b.watered + "/" + b.need + ")");
    });
    // thú của người chơi — thị trấn chỉ còn một con, đứng cạnh tượng
    var p = R.pet;
    if (p && st.pet) {
      if (p.species !== st.pet.species) { p.species = st.pet.species; p.stage = -1; p.root.userData.pet = { species: p.species }; }
      if (p.stage !== st.pet.stage) {
        if (p.model) { disposeGroup(p.model); p.root.remove(p.model); }
        p.model = petModel(p.species, st.pet.stage); p.root.add(p.model); p.stage = st.pet.stage; p.eyes = p.model.userData.eyes || [];
      }
      p.name = st.pet.name;
      p.hungry = st.pet.hunger ? st.pet.hunger.state : "fed";
      p.fed = !!st.pet.fedToday;
      var asleep = ["very_hungry", "hibernating", "resting"].indexOf(p.hungry) >= 0;
      p.sleep = asleep;
      p.lab.textContent = (root.TownCore.PETS[p.species] || { emoji: "🐾" }).emoji + " " + st.pet.name +
        " · " + STAGE_NAMES[st.pet.stage] + (asleep ? " 💤" : p.fed ? " ❤️" : "");
    }
    // dân thị trấn đi dạo — chỉ là hình, dựng theo số nhà đã xây thật
    syncVillagers(st);
    var X = st.xu || {};
    UI.els.chipXu.textContent = "🪙 " + balanceOf(st) + " xu" + (X.gift && X.gift.loginToday ? " · quà hôm nay ❤️" : "");
    var pet = st.pet;
    UI.els.chipPet.textContent = pet
      ? "🐾 " + pet.name + " · " + STAGE_NAMES[pet.stage] + " · XP " + pet.xp + (pet.next ? "/" + pet.next : "") + " · " + hungerLabel(pet.hunger.state)
      : "🐾 Chưa chọn thú";
    UI.els.chipDay.textContent = "📖 Hôm nay: " + st.today_stats.attempts + " lượt · +" + st.today_stats.earned + "/" + st.today_stats.cap + " xu từ bài học · 🌷 vườn +" + st.garden.gainedToday + "/" + st.garden.gainCap;
    renderPanels(st);
  }
  function hungerLabel(s) {
    return { new: "người mới", fed: "no", ok: "ổn", hungry: "hơi đói", very_hungry: "rất đói", hibernating: "ngủ đông", resting: "nghỉ" }[s] || s;
  }
  function nVisible(st) { return Math.min(st.districts.length, st.maxVisibleDistricts || 8); }
  function worldMatches(st) {
    if (!R.L) return false;
    var n = nVisible(st);
    if (R.count !== n) return false;
    var i = 0, ok = true;
    st.districts.slice(0, n).forEach(function (d) { if (!R.plots[d.topic]) ok = false; i++; });
    if (!R.beds.length || R.beds.length !== st.garden.beds.length) ok = false;
    if (R.petSig !== (st.pet ? st.pet.species : "")) ok = false;
    return ok;
  }
  function flowerSpec(st, id) {
    var f = st.garden.flowers.filter(function (x) { return x.id === id; })[0];
    return f || null;
  }

  /* ---------- các bảng thao tác (bàn phím / chuột đều dùng được) ---------- */
  function renderPanels(st) {
    var dsel = UI.els.dsel;
    var optLabel = function (d) { var m = metaOf(d.topic); return m.icon + " " + d.topic + " (+" + d.earned + " xu)"; };
    if (dsel.options.length !== st.districts.length) {
      dsel.innerHTML = st.districts.map(function (d) { return '<option value="' + esc(d.topic) + '">' + esc(optLabel(d)) + "</option>"; }).join("");
      if (lastTopicSel && st.districts.some(function (d) { return d.topic === lastTopicSel; })) dsel.value = lastTopicSel;
    } else {
      for (var i = 0; i < dsel.options.length; i++) dsel.options[i].textContent = optLabel(st.districts[i]);
    }
    var topic = dsel.value || (st.districts[0] && st.districts[0].topic);
    var cur = st.districts.filter(function (x) { return x.topic === topic; })[0] || { plots: [0, 0, 0, 0], topic: topic };
    var have = balanceOf(st);
    UI.els.pl.innerHTML = PLOT_NAMES.map(function (n, i) {
      var lv = cur.plots[i], cost = CbuCost(st, lv), ok = canBuild(st, cur, i);
      var sub = lv >= 3 ? "Tối đa" : ok ? "Xây " + cost + " xu" : "Thiếu " + (cost - have) + " xu";
      return '<button class="t3-b" data-topic="' + esc(topic) + '" data-i="' + i + '" ' + (ok ? "" : "disabled") + ' aria-label="' + esc(n + ", cấp " + lv + " trên 3. " + (lv >= 3 ? "Đã tối đa" : sub)) + '">' + esc(n) + " · C" + lv + "<small>" + esc(sub) + "</small></button>";
    }).join("");
    Array.prototype.forEach.call(UI.els.pl.querySelectorAll("button"), function (b) {
      b.onclick = function () { askBuild(b.getAttribute("data-topic"), +b.getAttribute("data-i")); };
    });

    // vườn hoa — mua hạt bằng xu, tưới miễn phí, thu hoạch trả xu
    var fsel = UI.els.fsel;
    if (!fsel.options.length) fsel.innerHTML = st.garden.flowers.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.emoji + " " + f.name) + "</option>"; }).join("");
    var seedCost = st.garden.seedCost, harvestGain = st.garden.harvestGain;
    UI.els.gprice.textContent = "Hạt " + seedCost + " xu · thu hoạch +" + harvestGain + " xu";
    UI.els.gb.innerHTML = st.garden.beds.map(function (b, s) {
      var label, act, dis = "";
      if (b.empty) { label = "🌱 Trống<small>Mua hạt: " + seedCost + " xu</small>"; act = "plant"; }
      else if (b.mature) { label = "✨ " + esc((flowerSpec(st, b.flower) || { name: "hoa" }).name) + " đã nở<small>Thu hoạch +" + harvestGain + " xu</small>"; act = "harvest"; }
      else if (b.canWater) { label = "💧 Tưới " + esc((flowerSpec(st, b.flower) || { name: "cây" }).name) + "<small>" + b.watered + "/" + b.need + " lần · miễn phí</small>"; act = "water"; }
      else { label = "🌿 " + esc((flowerSpec(st, b.flower) || { name: "cây" }).name) + "<small>Chờ ngày mai</small>"; act = "wait"; dis = "disabled"; }
      return '<button class="t3-b" data-slot="' + s + '" data-act="' + act + '" ' + dis + ' aria-label="' + esc(b.empty ? "Ô vườn " + (s + 1) + " đang trống, bấm để mua hạt trồng bằng xu" : "Ô vườn " + (s + 1) + ", " + (b.mature ? "hoa đã nở, bấm để thu hoạch" : "đã tưới " + b.watered + " trên " + b.need + " lần")) + '">' + label + "</button>";
    }).join("");
    Array.prototype.forEach.call(UI.els.gb.querySelectorAll("button"), function (b) {
      b.onclick = function () { askGarden(b.getAttribute("data-act"), +b.getAttribute("data-slot")); };
    });
    var picked = 0;
    st.garden.flowers.forEach(function (f) { picked += st.garden.picked[f.id] || 0; });
    UI.els.gnote.textContent = "Đã hái " + picked + " bông · hôm nay vườn cho " + st.garden.gainedToday + "/" + st.garden.gainCap +
      " xu · tưới miễn phí, mỗi ô 1 lần/ngày · mua hạt và thu hoạch đều có xác nhận.";

    // thú của người chơi (toàn thị trấn chỉ có đúng một con)
    var PC = root.TownCore.PETS || {};
    UI.els.pet.innerHTML = st.pet ? (function () {
      var pet = st.pet, p = PC[pet.species] || { emoji: "🐾", name: pet.species };
      return '<button class="t3-b" data-sp="' + esc(pet.species) + '" ' + (pet.fedToday ? "disabled" : "") + ' aria-label="' +
        esc(p.name + " " + pet.name + (pet.fedToday ? ": hôm nay đã cho ăn rồi" : ": bấm để cho ăn, không tốn gì")) + '">' +
        esc(p.emoji + " " + pet.name) + "<small>" + esc(pet.fedToday ? "no hôm nay ❤️" : "cho ăn (miễn phí)") + "</small></button>";
    })() :
      '<div class="t3-row"><input class="t3-sel" data-r="pname" maxlength="20" placeholder="Tên thú, 1–20 chữ" aria-label="Tên thú cưng">' +
      Object.keys(PC).map(function (sp) { return '<button class="t3-b" data-newpet="' + esc(sp) + '">' + esc(PC[sp].emoji + " " + PC[sp].name) + "</button>"; }).join("") +
      "</div>";
    Array.prototype.forEach.call(UI.els.pet.querySelectorAll("button[data-sp]"), function (b) {
      b.onclick = function () { doFeed(); };
    });
    Array.prototype.forEach.call(UI.els.pet.querySelectorAll("button[data-newpet]"), function (b) {
      b.onclick = function () { askNewPet(b.getAttribute("data-newpet")); };
    });
    if (ST.pet) {
      UI.els.petNote.textContent = (ST.pet.hunger.state === "fed" || ST.pet.hunger.state === "ok" || ST.pet.hunger.state === "new"
        ? "Thú đang vui. Cho ăn không cho điểm: bấm thú cũng không có thưởng."
        : "Thú " + hungerLabel(ST.pet.hunger.state) + " vì chưa ôn đủ " + ST.today_stats.fedMin + " lượt hôm nay. Ôn bài là nó no ngay — không mất gì cả.")
        + " 🗽 Tượng Nữ thần Tự do giữa quảng trường chỉ để nhìn, không xây được và không tốn gì. 🚶 Dân đi dạo cũng vậy: mỗi khu có một người, khu càng nhiều nhà thì càng đông, không bấm để được gì.";
    } else UI.els.petNote.textContent = "Chưa có thú của riêng bạn: đặt tên rồi chọn một loài ở trên. Giữa quảng trường là tượng Nữ thần Tự do, chung quanh chỉ có 🚶 dân đi dạo — không có thú nào khác.";
  }

  /* ---------- hộp xác nhận (chỉ khi TỐN xu) ---------- */
  function confirmBox(title, body, okLabel, cb) {
    var e = UI.els;
    e.dlgT.textContent = title;
    e.dlgB.textContent = body;
    e.dlgOk.textContent = okLabel;
    e.mask.hidden = false;
    e.dlgOk.onclick = function () { e.mask.hidden = true; cb(); };
    e.dlgNo.onclick = function () { e.mask.hidden = true; msg("Hủy rồi, thị trấn không thay đổi gì."); };
    e.dlgOk.focus();
  }
  function onKeyEsc(ev) { if (ev.key === "Escape" && UI && !UI.els.mask.hidden) { UI.els.mask.hidden = true; msg("Đã đóng hộp xác nhận."); } }

  /* ---------- thao tác: luôn hỏi adapter trước, chỉ vẽ khi adapter đồng ý ---------- */
  function runAction(promise, onOk) {
    promise.then(function (st) {
      applyState(st);
      if (onOk) onOk(st);
    }).catch(function (err) {
      msg(err && err.message ? err.message : "Không làm được, bạn thử lại nhé.");
      // 409/404: cảnh giữ nguyên tuyệt đối (không trừ xu, không đổi hình)
      if (err && err.status === 400) refresh();
    });
  }
  function askBuild(topic, i) {
    var st = ST, d = districtOf(st, topic); if (!d) return;
    var lv = d.plots[i], cost = CbuCost(st, lv), m = metaOf(topic), have = balanceOf(st);
    if (lv >= 3) { msg(PLOT_NAMES[i] + " đã ở cấp tối đa."); return; }
    if (have < cost) { msg("Cần " + cost + " xu để lên cấp " + (lv + 1) + ", bạn đang có " + have + " xu. Ôn bài, chơi trò chơi, nộp tài liệu hay đăng nhập mỗi ngày đều có xu."); return; }
    confirmBox("Xây " + PLOT_NAMES[i] + " cấp " + (lv + 1) + "?",
      "Tốn " + cost + " xu (ví có " + have + " xu, xây xong còn " + (have - cost) + " xu). Xây xong không rút lại được.",
      "Xây ngay", function () {
        msg("Đang xây…");
        runAction(ADAPTER.build(topic, i), function (s) { popPlot(topic, i); burstAt(plotPos(topic, i)); msg("Đã xây " + PLOT_NAMES[i] + " cấp " + (lv + 1) + " ở " + m.zone + " (−" + cost + " xu, ví còn " + balanceOf(s) + " xu)."); });
      });
  }
  function askGarden(act, slot) {
    var st = ST, G = st.garden, b = G.beds[slot], have = balanceOf(st);
    if (act === "wait") { msg("Cây này đã được tưới hôm nay rồi. Mai tưới tiếp nhé — tưới không mất xu."); return; }
    if (act === "water") {
      if (!b || !b.canWater) return;
      runAction(ADAPTER.garden({ action: "water", slot: slot }), function (s) {
        var nb = s.garden.beds[slot];
        msg(nb && nb.mature ? "🌸 Hoa đã nở! Bấm ô đó để thu hoạch." : "💧 Đã tưới. Miễn phí, ngày mai tưới tiếp nhé.");
        if (nb && nb.mature) burstAt(bedPos(slot));
      });
      return;
    }
    if (act === "plant") {
      var flower = UI.els.fsel.value;
      var fname = (flowerSpec(st, flower) || { name: "hoa" }).name;
      if (have < G.seedCost) { msg("Cần " + G.seedCost + " xu để mua hạt, bạn đang có " + have + " xu."); return; }
      confirmBox("Trồng " + fname + "?",
        "Tốn " + G.seedCost + " xu mua hạt (ví có " + have + " xu). Tưới " + G.waterings + " ngày (miễn phí) thì nở, thu hoạch được " + G.harvestGain + " xu.",
        "Mua hạt, trồng", function () {
          runAction(ADAPTER.garden({ action: "plant", slot: slot, flower: flower }), function (s) {
            msg("🌱 Đã trồng " + fname + " ở ô " + (slot + 1) + " (−" + G.seedCost + " xu, ví còn " + balanceOf(s) + " xu). Ngày mai tưới nhé.");
          });
        });
      return;
    }
    if (act === "harvest") {
      if (!b || !b.mature) return;
      var f = flowerSpec(st, b.flower) || { name: "hoa", emoji: "🌸" };
      var left = G.gainCap - G.gainedToday;
      if (left < G.harvestGain) { msg("Hôm nay vườn đã cho " + G.gainedToday + "/" + G.gainCap + " xu, còn " + left + " — chưa đủ " + G.harvestGain + ". Mai thu tiếp, cây vẫn nguyên ở đây."); return; }
      confirmBox("Thu hoạch " + f.name + "?",
        "Nhận " + G.harvestGain + " xu (ví có " + have + " xu, thu xong thành " + (have + G.harvestGain) + " xu). Hôm nay vườn còn cho được " + left + " xu.",
        "Thu hoạch", function () {
          runAction(ADAPTER.garden({ action: "harvest", slot: slot }), function (s) { burstAt(bedPos(slot)); msg("🌸 Đã hái " + f.name + " (+" + G.harvestGain + " xu, ví còn " + balanceOf(s) + " xu). Ô " + (slot + 1) + " trống rồi, trồng cây khác nhé."); });
        });
    }
  }
  function doFeed() {
    var pet = ST && ST.pet; if (!pet) return;
    var sp = pet.species;
    if (pet.fedToday) { msg((root.TownCore.PETS[sp] || { name: sp }).name + " đã được cho ăn hôm nay rồi. Mai cho tiếp nhé."); return; }
    runAction(ADAPTER.feed(sp), function (st) {
      var p = R.pet;
      if (p && st.pet && st.pet.fedToday) { p.hop = 1; heartAt(p.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1.3, 0))); }
      msg((st.treats && st.treats.lines[sp]) || "Thú ăn no rồi.");
    });
  }
  function askNewPet(sp) {
    var PC = root.TownCore.PETS || {};
    var p = PC[sp] || { name: sp, emoji: "🐾" };
    var inp = UI.els.pet.querySelector("[data-r=pname]");
    var nm = ((inp && inp.value) || "").trim() || "Bi";
    runAction(ADAPTER.setPet(sp, nm), function () {
      msg(p.emoji + " " + nm + " vừa về thị trấn. Ôn bài mỗi ngày là nó lớn lên; cho ăn không tốn gì và không cho điểm.");
    });
  }
  function districtOf(st, topic) {
    var f = st.districts.filter(function (d) { return d.topic === topic; })[0];
    return f || null;
  }

  /* ---------- hiệu ứng ---------- */
  function plotPos(topic, i) { var p = R.plots[topic] && R.plots[topic][i]; return p ? p.pg.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, .8, 0)) : new T.Vector3(); }
  function bedPos(s) { var b = R.beds[s]; return b ? b.g.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, .8, 0)) : new T.Vector3(); }
  function particles(pos, colors, up) {
    if (RM || !R) return;
    for (var k = 0; k < 16; k++) {
      var m = new T.Mesh(new T.BoxGeometry(.12, .12, .12), mat(colors[k % colors.length]));
      m.position.copy(pos);
      var a = Math.random() * 6.28;
      m.userData.v = new T.Vector3(Math.cos(a) * (1 + Math.random() * 2), (up || 3) + Math.random() * 3, Math.sin(a) * (1 + Math.random() * 2));
      m.userData.life = 1;
      R.scene.add(m); R.parts.push(m);
    }
  }
  function burstAt(pos) { particles(pos, ["#ffd54a", "#6fe39a"], 3); }
  function heartAt(pos) { particles(pos, ["#f3a6b8", "#e5484d", "#ffd54a"], 2.2); }
  function popPlot(topic, i) {
    var p = R.plots[topic] && R.plots[topic][i]; if (!p) return;
    if (RM) { p.slot.scale.setScalar(1); return; }
    R.pops.push({ o: p.slot, t: 0 });
    p.slot.scale.setScalar(.01);
  }

  /* ---------- camera + chuột/cảm ứng ---------- */
  var V, Vt, ptr, ray, tgt;
  function initCamera() {
    tgt = new T.Vector3(0, .8, 0);
    var r0 = (R.L ? R.L.cam : 26);
    V = { th: .7, ph: 1, r: r0 };
    Vt = { th: .7, ph: 1, r: r0 };
    ptr = new Map(); ray = new T.Raycaster(); tgt = tgt;
  }
  function place() {
    R.cam.position.set(tgt.x + V.r * Math.sin(V.ph) * Math.sin(V.th), tgt.y + V.r * Math.cos(V.ph), tgt.z + V.r * Math.sin(V.ph) * Math.cos(V.th));
    R.cam.lookAt(tgt);
  }
  function size() {
    if (!R || !UI) return;
    var w = UI.els.view.clientWidth, h = UI.els.view.clientHeight;
    R.renderer.setSize(w, h, false);
    R.cam.aspect = w / h; R.cam.updateProjectionMatrix();
  }
  function hit(ev) {
    var r = UI.els.cv.getBoundingClientRect();
    var mv = new T.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mv, R.cam);
    var h = ray.intersectObjects(R.scene.children, true)[0];
    if (!h) return null;
    var o = h.object;
    while (o && !(o.userData && (o.userData.plot || o.userData.bed || o.userData.pet || o.userData.statue || o.userData.villager))) o = o.parent;
    return o || null;
  }
  function bindPointer() {
    var cv = UI.els.cv, moved = 0, pd = 0, maxR = function () { return R.L ? R.L.isl * 4.2 : 42; };
    var pdist = function () { var a = Array.from(ptr.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
    cv.addEventListener("pointerdown", function (e) {
      cv.setPointerCapture(e.pointerId);
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
      if (ptr.size === 2) pd = pdist();
    });
    cv.addEventListener("pointermove", function (e) {
      var p = ptr.get(e.pointerId);
      if (!p) { cv.style.cursor = hit(e) ? "pointer" : "grab"; return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (ptr.size === 1) { Vt.th -= dx * .006; Vt.ph = clamp(Vt.ph - dy * .005, .3, 1.35); }
      else if (ptr.size === 2) { var d = pdist(); Vt.r = clamp(Vt.r * pd / d, 12, maxR()); pd = d; }
    });
    cv.addEventListener("pointerup", function (e) {
      ptr.delete(e.pointerId);
      if (moved < 6 && ptr.size === 0) {
        var o = hit(e);
        if (o && o.userData.plot) askBuild(o.userData.plot.topic, o.userData.plot.i);
        else if (o && o.userData.bed) { var b = ST.garden.beds[o.userData.bed.slot]; askGarden(b ? (b.mature ? "harvest" : b.canWater ? "water" : "wait") : "plant", o.userData.bed.slot); }
        else if (o && o.userData.pet) {
          var p = R.pet;
          if (p) { p.hop = 1; msg("Mình chào bạn thôi, bấm mình không có thưởng đâu nhé 🙂"); }
        }
        else if (o && o.userData.statue) { msg("🗽 Tượng Nữ thần Tự do chỉ là đài kỉ niệm giữa quảng trường — bấm không tốn gì và cũng không được gì."); }
        else if (o && o.userData.villager) { msg("🚶 Đây là dân thị trấn. Họ đi tới đi lui giữa quảng trường và khu của mình, bấm không được gì đâu — muốn đông người thì xây thêm nhà nhé."); }
      }
    });
    cv.addEventListener("pointercancel", function (e) { ptr.delete(e.pointerId); });
    cv.addEventListener("wheel", function (e) { e.preventDefault(); Vt.r = clamp(Vt.r + e.deltaY * .02, 12, maxR()); }, { passive: false });
    UI.els.l.onclick = function () { Vt.th -= .5; };
    UI.els.r.onclick = function () { Vt.th += .5; };
    UI.els.zi.onclick = function () { Vt.r = clamp(Vt.r - 4, 12, maxR()); };
    UI.els.zo.onclick = function () { Vt.r = clamp(Vt.r + 4, 12, maxR()); };
    UI.els.reload.onclick = function () { msg("Đang xem lại thị trấn…"); refresh(); };
    UI.els.dsel.onchange = function () { lastTopicSel = UI.els.dsel.value; if (ST) renderPanels(ST); };
    UI.els.fsel.onchange = function () { if (ST) renderPanels(ST); };
  }

  /* ---------- vòng lặp ---------- */
  var v3, lastT = 0;
  function proj(el, pos) {
    if (!el.textContent) { el.style.display = "none"; return; } // ô vườn trống thì khỏi gắn nhãn cho đỡ che nhau
    v3.copy(pos).project(R.cam);
    var w = UI.els.view.clientWidth, h = UI.els.view.clientHeight;
    el.style.display = v3.z > 1 ? "none" : "block";
    el.style.transform = "translate(" + ((v3.x * .5 + .5) * w) + "px," + ((-v3.y * .5 + .5) * h) + "px) translate(-50%,-100%)";
  }
  function loop(now) {
    if (!R) return;
    loopId = requestAnimationFrame(loop);
    var dt = Math.min(.05, (now - lastT) / 1000), t = now / 1000; lastT = now;
    for (var key in Vt) V[key] += (Vt[key] - V[key]) * .12;
    place();
    R.t = t;
    if (R.vils.length) moveVillagers(t);
    if (R.pet && R.pet.model) {
      var p = R.pet;
      p.hop = Math.max(0, (p.hop || 0) - dt * 1.6);
      var slow = p.sleep;
      p.model.position.y = (RM ? 0 : Math.sin(t * (slow ? 1 : 2.4)) * (slow ? .03 : .07)) + Math.sin(p.hop * Math.PI) * .9;
      if (p.eyes) p.eyes.forEach(function (e) { e.scale.y = slow ? .15 : 1; });
      if (p.hungry === "hungry" && !RM) p.model.rotation.z = .12;
      var a = Math.atan2(R.cam.position.x - p.root.position.x, R.cam.position.z - p.root.position.z);
      var df = Math.atan2(Math.sin(a - p.root.rotation.y), Math.cos(a - p.root.rotation.y));
      p.root.rotation.y += df * (RM ? 1 : .05);
      if (p.model.userData.tail && !RM) p.model.userData.tail.rotation.y = Math.sin(t * 6) * .35;
      proj(p.lab, v3.set(p.root.position.x, p.root.position.y + 2.4, p.root.position.z));
    }
    for (var i = R.pops.length - 1; i >= 0; i--) {
      var pp = R.pops[i]; pp.t += dt / .5;
      var u = Math.min(1, pp.t) - 1, s = 1 + 2.70158 * u * u * u + 1.70158 * u * u;
      pp.o.scale.setScalar(Math.max(.01, s));
      if (pp.t >= 1) { pp.o.scale.setScalar(1); R.pops.splice(i, 1); }
    }
    for (var j = R.parts.length - 1; j >= 0; j--) {
      var pm = R.parts[j];
      pm.userData.v.y -= 9 * dt; pm.position.addScaledVector(pm.userData.v, dt);
      pm.userData.life -= dt * 1.4; pm.scale.setScalar(Math.max(.01, pm.userData.life));
      if (pm.userData.life <= 0) { R.scene.remove(pm); R.parts.splice(j, 1); }
    }
    var pulse = RM ? .8 : .55 + .45 * Math.sin(t * 4);
    for (var tp in R.dists) {
      R.dists[tp].tr.rotation.y = RM ? 0 : t;
      var arr = R.plots[tp], d = districtOf(ST, tp);
      for (var q = 0; d && q < arr.length; q++) { arr[q].rm.opacity = .4 + .5 * pulse; arr[q].ring.visible = canBuild(ST, d, q); }
      proj(R.dists[tp].lab, R.dists[tp].pos);
    }
    for (var b = 0; b < R.beds.length; b++) proj(R.beds[b].lab, R.beds[b].pos);
    if (!RM) R.sky.rotation.y += dt * .01;
    R.renderer.render(R.scene, R.cam);
  }

  /* ---------- vòng đời ---------- */
  function refresh() {
    return ADAPTER.getState().then(function (st) {
      if (!st.enabled) { msg("Thú ảo và thị trấn đang tắt. Bật lại ở mục Tài khoản để xem thị trấn."); return st; }
      applyState(st);
      return st;
    }).catch(function (err) {
      msg(err && err.message ? err.message : "Không đọc được thị trấn.");
      throw err;
    });
  }

  function mount(container, opts) {
    var o = opts || {};
    ADAPTER = o.adapter || (root.location && root.location.protocol.indexOf("http") === 0 ? onlineAdapter() : offlineAdapter({}));
    RM = !!(root.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    unmount();
    UI = buildDom(container);
    if (!root.TownCore) { UI.els.err.hidden = false; UI.els.err.textContent = "Trang này chưa nạp lõi thị trấn (town-core.js)."; return Promise.resolve(false); }
    return loadThree().then(function () {
      initKit();
      R = createScene();
      UI.els.cv.setAttribute("aria-label", "Cảnh thị trấn 3D: các khu học tập, vườn hoa, tượng Nữ thần Tự do giữa quảng trường, thú của bạn và vài cư dân đang đi dạo (chỉ trang trí). Dùng bảng bên dưới để xây, trồng và cho thú ăn.");
      buildWorld({ districts: [], maxVisibleDistricts: 8, garden: { beds: [] } });
      initCamera(); bindPointer();
      ro = new ResizeObserver(size); ro.observe(UI.els.view); size();
      v3 = new T.Vector3();
      document.addEventListener("keydown", onKeyEsc);
      lastT = performance.now();
      loopId = requestAnimationFrame(loop);
      return refresh().then(function (st) {
        msg(st.enabled && st.pet ? "Chào mừng về " + (st.districts[0] ? metaOf(st.districts[0].topic).zone : "thị trấn") + "! Ôn bài để nhận xu (🪙 ở thanh trên), rồi bấm ô đất có vòng sáng để nâng cấp." : "Thị trấn sẵn sàng. Một ví xu chung cho mọi thứ: học bài · trò chơi · nộp tài liệu · quà đăng nhập · quà chuỗi.");
        return true;
      });
    }).catch(function (err) {
      UI.els.err.hidden = false;
      UI.els.err.textContent = "Trình duyệt không chạy được WebGL hoặc không tải được Three.js (" + (err && err.message ? err.message : err) + ").";
      if (root.console) console.error(err);
      return false;
    });
  }

  function unmount() {
    document.removeEventListener("keydown", onKeyEsc);
    if (loopId) cancelAnimationFrame(loopId);
    loopId = 0;
    if (ro) { ro.disconnect(); ro = null; }
    if (R) {
      if (R.mo) R.mo.disconnect();
      if (R.mq) R.mq.removeEventListener("change", R.theme); // không gỡ thì mỗi lần vào/ra tab thêm một listener chồng lại
      clearWorld();
      for (var k in MC) { if (MC[k] && MC[k].dispose) MC[k].dispose(); }
      R.scene.traverse(function (o) { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
      if (R.renderer) { R.renderer.dispose(); if (R.renderer.forceContextLoss) R.renderer.forceContextLoss(); }
      R = null;
    }
    MC = {};
    if (UI) { UI.root.remove(); UI = null; }
    ST = null;
  }

  root.Town3D = {
    mount: mount, unmount: unmount, refresh: refresh, loadThree: loadThree,
    onlineAdapter: onlineAdapter, offlineAdapter: offlineAdapter, recordAttempt: recordAttempt,
    metaOf: metaOf, STAGE_NAMES: STAGE_NAMES, PLOT_NAMES: PLOT_NAMES,
  };
})(typeof window !== "undefined" ? window : this);
