/* Engine "Săn vịt": máy bay bắn vịt chọn đáp án (Canvas 2D + Web Audio, không dùng thư viện).
   Nối với game qua window.DuckGame — xem README-may-bay-ban-vit.md. */
(function () {
  "use strict";

  var DUCK_CONFIG = {
    world: { landscape: [960, 540], portrait: [540, 800] },
    plane: { w: 64, h: 48, speed: 420, mouseLerp: 0.25, maxSpeed: 900, yRatio: 0.90 },
    bullet: { w: 8, h: 20, speed: 720, cooldownMs: 250, maxOnScreen: 3, perQuestion: 3 },
    duck: {
      w: 96, h: 64, signMinW: 96, signMaxW: 220, signH: 36, touchPad: 8,
      lanes: [0.15, 0.31, 0.47, 0.63], spawnDelayMax: 1.2, speedJitter: 0.15
    },
    gold: { laneY: 0.02, speedMul: 2, reward: { heal: 1, exp: 15 } },
    hint: { enabled: true, perGame: 1, costExp: 5 },
    scoring: { base: 10, fast: 5, fastRatio: 0.5, combo: [[0, 1.0], [3, 1.2], [5, 1.5], [10, 2.0]] },
    feedback: { autoAdvanceMsCorrect: 1500, introMs: 800 },
    modes: {
      /* patrol = vịt bay qua lại hai biên sân, không bay mất; câu chỉ kết thúc khi bắn trúng hoặc hết đạn */
      thuong: { name: "Ải thường", count: 10, hearts: 3, cross: 14, goldChance: 0.10, path: "straight", jitter: 0.15, patrol: true },
      toc_do: { name: "Tốc độ", count: 10, hearts: 3, cross: 9, goldChance: 0.15, path: "straight", jitter: 0.15 },
      trum: { name: "Trùm", count: 50, hearts: 5, cross: 8, goldChance: 0.10, path: "wave", jitter: 0.20 }
    }
  };

  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  var LS_OPTS = "toeic.duck.opts", LS_MUTE = "toeic.mute", LS_BEST = "toeic.user.duck";

  function readLS(key, def) {
    try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function writeLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var opts = (function () {
    var saved = readLS(LS_OPTS, {}) || {};
    var reduce = saved.reduceMotion;
    if (reduce == null) reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return { slow: !!saved.slow, autoAim: !!saved.autoAim, large: !!saved.large, reduceMotion: reduce };
  })();
  function saveOpts() { writeLS(LS_OPTS, opts); }

  var mute = readLS(LS_MUTE, false) === true;

  var P = {
    light: { skyTop: "#8ec5ff", skyMid: "#c4e1ff", skyBottom: "#fdf3dc", cloud: "#ffffff", sun: "#fff3b0", glow: "rgba(255,236,170,0.85)", glow0: "rgba(255,236,170,0)",
      hill1: "#cfe3f7", hill2: "#b9d6f2", hill3: "#a6c8ec",
      duck: "#8a5a2b", duckLight: "#b47c45", duckDark: "#5f3b17", belly: "#f3dcb4", beak: "#f2a13a", gold: "#f2c230",
      signBg: "#ffffff", signBg2: "#eef4ff", signInk: "#12223f", signLine: "#2a4170", ok: "#1b8a5a", bad: "#c8372d",
      plane: "#33507f", planeLight: "#5b82c4", prop: "#8fa8c9", ink: "#12223f", bullet: "#ff6b35", bullet2: "#ffd166", stars: 0 },
    dark: { skyTop: "#070d1b", skyMid: "#101a33", skyBottom: "#1d2c52", cloud: "#34466e", sun: "#e6edff", glow: "rgba(170,195,255,0.40)", glow0: "rgba(170,195,255,0)",
      hill1: "#1a2a4d", hill2: "#15233f", hill3: "#101c34",
      duck: "#a97c47", duckLight: "#cfa46c", duckDark: "#6f4a22", belly: "#ecd3a8", beak: "#f2a13a", gold: "#f2c230",
      signBg: "#1b2a4a", signBg2: "#14203a", signInk: "#e8eefb", signLine: "#9dc0ff", ok: "#4cc38a", bad: "#ff7b70",
      plane: "#9dc0ff", planeLight: "#d6e6ff", prop: "#c7dcff", ink: "#e8eefb", bullet: "#ffb454", bullet2: "#fff1b8", stars: 1 }
  };

  /* ---------- âm thanh (Web Audio, tự tổng hợp) ---------- */
  var actx = null;
  function audio() {
    if (mute) return null;
    try {
      if (!actx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        actx = new C();
      }
      if (actx.state === "suspended") actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(type, from, to, ms, vol) {
    var a = audio(); if (!a) return;
    var dur = ms / 1000, t = a.currentTime;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol == null ? 0.25 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(durSec, freq, vol) {
    var a = audio(); if (!a) return;
    var len = Math.max(1, Math.ceil(a.sampleRate * durSec));
    var buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = a.createBufferSource(); src.buffer = buf;
    var f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 6;
    var g = a.createGain();
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + durSec);
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }
  var sfx = {
    shoot: function () { tone("square", 880, 220, 80, 0.18); },
    correct: function () { tone("triangle", 660, null, 100, 0.22); setTimeout(function () { tone("triangle", 990, null, 120, 0.22); }, 100); },
    wrong: function () { tone("sawtooth", 300, 100, 300, 0.2); },
    quack: function () { noise(0.12, 1200 * (0.9 + Math.random() * 0.3), 0.18); },
    gold: function () { [1320, 1560, 1980].forEach(function (f, i) { setTimeout(function () { tone("triangle", f, null, 90, 0.18); }, i * 80); }); },
    over: function (win) {
      var seq = win ? [523, 659, 784] : [523, 392, 262];
      seq.forEach(function (f, i) { setTimeout(function () { tone("triangle", f, null, 180, 0.22); }, i * 160); });
    }
  };

  /* ---------- state ---------- */
  var cv = null, ctx = null, host = {};
  var view = { w: 960, h: 540, scale: 1, portrait: false };
  var session = null;   // { mode, modeKey, stats, hintLeft, healUsed }
  var run = null;       // trạng thái một câu
  var raf = 0, last = 0, acc = 0, STEP = 1 / 60;
  var keys = {}, pointer = { down: false, active: false, type: "mouse", x: 0, dragX: 0, dragNow: null, planeFrom: 0 };
  var particles = [], shake = 0, recoil = 0, paused = false, bound = false, live = false;
  var fsAt = 0; // thời điểm trình duyệt đổi toàn màn hình (để không coi là đổi kích thước đột ngột)
  var ro = null; // ResizeObserver của khung chứa canvas

  function pal() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t !== "light" && t !== "dark") {
      t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    }
    return P[t];
  }
  function laneY(i) {
    if (run && run.laneGap != null) return run.laneTop + i * run.laneGap;
    return DUCK_CONFIG.duck.lanes[i] * view.h;
  }
  function planeY() { return view.h * DUCK_CONFIG.plane.yRatio; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function comboMul(streak) {
    var table = DUCK_CONFIG.scoring.combo, mul = table[0][1];
    table.forEach(function (row) { if (streak >= row[0]) mul = row[1]; });
    return mul;
  }

  function validQuestion(q) {
    if (!q || !q.o || q.o.length !== 4) return false;
    var seen = {};
    for (var i = 0; i < 4; i++) {
      var s = String(q.o[i] == null ? "" : q.o[i]).trim();
      if (!s || s.length > 60) return false;
      var low = s.toLowerCase();
      if (seen[low]) return false;
      seen[low] = true;
    }
    return typeof q.a === "number" && q.a >= 0 && q.a <= 3;
  }

  /* ---------- bố cục / tỉ lệ ---------- */
  function layout() {
    if (!cv) return;
    var box = cv.parentNode;
    var port = (window.matchMedia && window.matchMedia("(orientation: portrait)").matches) ||
      (box && box.clientWidth < 520 && window.innerHeight > window.innerWidth);
    var world = port ? DUCK_CONFIG.world.portrait : DUCK_CONFIG.world.landscape;
    var availW = Math.max(240, (box ? box.clientWidth : world[0]));
    // Toàn màn hình: sân chơi lấp đầy khung; ngoài FS thì giữ giới hạn cũ
    var fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
    var cap = Math.min(window.innerHeight * (port ? 0.72 : 0.70), port ? 920 : 900);
    for (var pass = 0; pass < 3; pass++) {
      var limH = fs && box ? Math.max(180, box.clientHeight - 4) : cap;
      // Sân ngang: nới chiều rộng thế giới theo đúng tỉ lệ khung để lấp hết chiều ngang, không còn viền đen
      var ww = port ? world[0] : clamp(Math.round(world[1] * (availW / limH)), world[0], 2000);
      var scale = Math.min(availW / ww, limH / world[1]);
      var d = Math.max(1, Math.min(dpr, 2560 / (ww * scale)));
      view.portrait = port; view.w = ww; view.h = world[1]; view.scale = scale * d;
      cv.style.width = Math.round(ww * scale) + "px";
      cv.style.height = Math.round(world[1] * scale) + "px";
      cv.width = Math.round(ww * scale * d);
      cv.height = Math.round(world[1] * scale * d);
      // Khung chứa co lại theo nội dung bên dưới → đo lại và thu cho khớp, không tràn ra ngoài
      if (!fs || !box || cv.getBoundingClientRect().height <= box.clientHeight - 1) break;
    }
  }

  /* ---------- chữ trên biển đáp án ---------- */
  function wrapLines(text, maxW, size) {
    ctx.font = "700 " + size + "px " + FONT;
    if (ctx.measureText(text).width <= maxW) return [text];
    var words = String(text).split(/\s+/), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + " " + words[i] : words[i];
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function trimEllipsis(text, maxW, size) {
    ctx.font = "700 " + size + "px " + FONT;
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }
  function labelGeom(text) {
    var inner = DUCK_CONFIG.duck.signMaxW - 18;
    var size = opts.large ? 21 : 18, lines;
    for (;;) {
      lines = wrapLines(text, inner, size);
      if (lines.length <= 2 || size <= 13) break;
      size--;
    }
    if (lines.length > 2) lines = [lines[0], trimEllipsis(lines[1], inner, size)];
    else if (lines.length === 1) lines = [trimEllipsis(lines[0], inner, size)];
    ctx.font = "700 " + size + "px " + FONT;
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    return {
      lines: lines, size: size,
      w: Math.round(clamp(w + 18, DUCK_CONFIG.duck.signMinW, DUCK_CONFIG.duck.signMaxW)),
      h: lines.length > 1 ? (opts.large ? 66 : 52) : (opts.large ? 45 : DUCK_CONFIG.duck.signH)
    };
  }

  /* ---------- tạo câu chơi ---------- */
  function makeDucks(q) {
    var lanes = [0, 1, 2, 3];
    for (var i = lanes.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t; }
    var T = session.mode.cross * (opts.slow ? 1.67 : 1);
    var ducks = q.o.map(function (label, k) {
      var lane = lanes[k];
      var dir = lane % 2 === 0 ? 1 : -1;
      var geom = labelGeom(String(label));
      var w = DUCK_CONFIG.duck.w, h = DUCK_CONFIG.duck.h;
      var pad = pointer.type === "touch" || ("ontouchstart" in window) ? DUCK_CONFIG.duck.touchPad : 0;
      pad += opts.slow ? Math.round(w * 0.125) : 0;
      var x = dir > 0 ? -w - rand(0, 160) : view.w + rand(0, 160);
      var y = laneY(lane);
      var speed = (view.w + w + 320) / (T * (1 + rand(-1, 1) * session.mode.jitter));
      return {
        k: k, label: String(label), correct: k === q.a, lane: lane, dir: dir,
        x: x, y: y, spawnX: x, w: w, h: h, geom: geom, pad: pad, pad0: pad,
        speed: speed, wait: rand(0, DUCK_CONFIG.duck.spawnDelayMax),
        alive: true, falling: false, fading: false, vy: 0, rot: 0, alpha: 1,
        travel: 0, turnMargin: Math.max(12, (geom.w - w) / 2 + 10),
        flipAt: null, flipped: false, wave: session.mode.path === "wave"
      };
    });
    spreadLanes(ducks);
    return ducks;
  }

  /* ải thường: dãn 4 làn ra hết khoảng trời, hạ mình vịt xuống khi biển đáp án dài để không đè nhau */
  function spreadLanes(ducks) {
    if (!session.mode.patrol) return;
    var cfg = DUCK_CONFIG.duck;
    var maxSign = ducks.reduce(function (m, d) { return Math.max(m, d.geom.h); }, cfg.signH);
    var top = view.h * 0.11, bottom = planeY() - 8;
    var fit = (bottom - top) / 4 - 6;
    var h = clamp(fit - maxSign - 2, 40, cfg.h);
    var foot = h + maxSign + 2;
    var gap = (bottom - top - foot) / 3;
    run.laneTop = top; run.laneGap = gap;
    ducks.forEach(function (d) {
      d.h = h;
      d.pad = d.pad0 + Math.max(0, (cfg.h - h) / 2);
      d.y = laneY(d.lane);
    });
  }
  function duckProgress(d) {
    if (session.mode.patrol) return clamp((d.travel || 0) / view.w, 0, 1);
    var from = d.spawnX, to = d.dir > 0 ? view.w + 40 : -d.w - 40;
    return clamp((d.x - from) / (to - from || 1), 0, 1);
  }
  function rectsOf(d) {
    var body = { x: d.x - d.pad, y: d.y - d.pad, w: d.w + d.pad * 2, h: d.h + d.pad * 2 };
    var sw = d.geom.w, sh = d.geom.h;
    var sign = { x: d.x + d.w / 2 - sw / 2 - d.pad, y: d.y + d.h - d.pad, w: sw + d.pad * 2, h: sh + d.pad * 2 };
    return [body, sign];
  }

  function spawnGold() {
    if (Math.random() >= session.mode.goldChance) return null;
    var T = session.mode.cross / DUCK_CONFIG.gold.speedMul * (opts.slow ? 1.67 : 1);
    var dir = Math.random() < 0.5 ? 1 : -1;
    var w = DUCK_CONFIG.duck.w * 0.8, x = dir > 0 ? -w - 30 : view.w + 30;
    return {
      x: x, y: DUCK_CONFIG.gold.laneY * view.h, w: w, h: DUCK_CONFIG.duck.h * 0.8, dir: dir,
      speed: (view.w + w + 80) / T, alive: true, wait: rand(0.4, 1.6), sparkle: 0,
      pad: pointer.type === "touch" ? DUCK_CONFIG.duck.touchPad : 0
    };
  }

  /* ---------- vòng đời một câu ---------- */
  function playQuestion(q) {
    if (!session) return;
    run = {
      q: q, state: "INTRO", t: 0, ended: false, result: null,
      plane: { x: (view.w - DUCK_CONFIG.plane.w) / 2 },
      bullets: [], ducks: [], gold: null,
      ammo: DUCK_CONFIG.bullet.perQuestion, cooldown: 0,
      flyWord: null, hintUsed: false
    };
    run.ducks = makeDucks(q);
    run.gold = spawnGold();
    acc = 0; last = 0; paused = false;
    keys.left = keys.right = keys.space = false;
    pointer.dragging = false; pointer.dragNow = null;
    if (host.onReset) host.onReset(run.ammo);
    live = true;
    ensureLoop();
  }

  function endQuestion(result, index, fast) {
    if (!run || run.ended) return;
    run.ended = true; run.result = result; run.state = "FEEDBACK"; run.t = 0;
    var q = run.q;
    var d = index == null ? null : run.ducks.filter(function (x) { return x.k === index; })[0];
    if (result === "correct") {
      session.stats.hits++;
      if (d) { d.alive = false; d.falling = false; feathers(d.x + d.w / 2, d.y + d.h / 2, 14, false); }
      run.flyWord = { text: q.o[q.a], x: view.w / 2, y: (d ? d.y : view.h * 0.4) + 20, t: 0, dur: 0.6 };
      sfx.correct();
      host.onEnd({ result: result, index: index, fast: !!fast && !opts.autoAim, streakBefore: host.streak ? host.streak() : 0 });
    } else {
      if (d) { d.alive = false; d.falling = true; d.vy = -120; sfx.quack(); }
      if (result === "wrong") session.stats.hits++;
      if (!opts.reduceMotion) shake = 0.18;
      sfx.wrong();
      host.onEnd({ result: result, index: index, fast: false, streakBefore: host.streak ? host.streak() : 0 });
    }
  }

  function feathers(x, y, n, gold) {
    if (opts.reduceMotion) n = Math.min(4, n);
    for (var i = 0; i < n; i++) {
      particles.push({
        x: x + rand(-20, 20), y: y + rand(-14, 14), vx: rand(-90, 90), vy: rand(-160, -40),
        g: 220, life: rand(0.5, 1.1), max: 1.1, r: rand(3, 7), spin: rand(-4, 4), rot: rand(0, 6),
        color: gold ? pal().gold : (i % 3 === 0 ? pal().beak : pal().duck)
      });
    }
  }
  function sparks(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      particles.push({
        x: x, y: y, vx: rand(-220, 220), vy: rand(-260, -60), g: 500, life: rand(0.25, 0.5), max: 0.5,
        r: rand(2, 4), spin: 0, rot: 0, color: color
      });
    }
  }

  /* ---------- bắn ---------- */
  function canShoot() {
    return run && !run.ended && run.state === "FLY" && !paused &&
      run.ammo > 0 && run.cooldown <= 0 && run.bullets.length < DUCK_CONFIG.bullet.maxOnScreen;
  }
  function fire(tx, ty, homing) {
    var p = DUCK_CONFIG.plane, b = DUCK_CONFIG.bullet;
    var x = run.plane.x + p.w / 2, y = planeY() - b.h;
    var vx = 0, vy = -b.speed;
    if (homing && ty != null) {
      var dx = tx - x, dy = ty - y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      vx = dx / len * b.speed; vy = dy / len * b.speed;
    }
    run.bullets.push({ x: x, y: y, px: x, py: y, vx: vx, vy: vy, alive: true, homing: !!homing, target: homing || null });
    run.ammo--; session.stats.shots++;
    run.cooldown = b.cooldownMs / 1000;
    recoil = opts.reduceMotion ? 0 : 0.08;
    sfx.shoot();
    if (host.onAmmo) host.onAmmo(run.ammo);
  }
  function tryShoot() {
    if (!canShoot()) return;
    fire();
  }
  function aimShot(lane) {
    if (!canShoot()) return;
    var d = run.ducks.filter(function (x) { return x.lane === lane && x.alive && x.wait <= run.t; })[0];
    if (!d) return;
    fire(d.x + d.w / 2, d.y + d.h / 2, d);
  }

  /* ---------- va chạm ---------- */
  function segHitsRect(b, r) {
    // đoạn thẳng từ vị trí bước trước (b.px, b.py) đến vị trí hiện tại, giao với hitbox r
    var x0 = b.px, y0 = b.py, x1 = b.x, y1 = b.y;
    var dx = x1 - x0, dy = y1 - y0;
    var t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      var ratio = q[i] / p[i];
      if (p[i] < 0) { if (ratio > t1) return false; if (ratio > t0) t0 = ratio; }
      else { if (ratio < t0) return false; if (ratio < t1) t1 = ratio; }
    }
    return t0 <= t1;
  }
  function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  function collide() {
    for (var i = 0; i < run.bullets.length; i++) {
      var b = run.bullets[i];
      if (!b.alive) continue;
      var hitDuck = null, best = 1e9;
      for (var j = 0; j < run.ducks.length; j++) {
        var d = run.ducks[j];
        if (!d.alive || d.wait > run.t) continue;
        var rs = rectsOf(d);
        for (var k = 0; k < rs.length; k++) {
          if (segHitsRect(b, rs[k]) || pointInRect(b.x, b.y, rs[k])) {
            var c = Math.abs(b.x - (d.x + d.w / 2)) + Math.abs(b.y - (d.y + d.h / 2));
            if (c < best) { best = c; hitDuck = d; }
            break;
          }
        }
      }
      if (hitDuck) {
        b.alive = false;
        if (hitDuck.correct) {
          var fast = duckProgress(hitDuck) < DUCK_CONFIG.scoring.fastRatio;
          endQuestion("correct", hitDuck.k, fast);
        } else {
          endQuestion("wrong", hitDuck.k, false);
        }
        return;
      }
      if (run.gold && run.gold.alive && run.gold.wait <= run.t) {
        var gd = run.gold, gr = { x: gd.x - gd.pad, y: gd.y - gd.pad, w: gd.w + gd.pad * 2, h: gd.h + gd.pad * 2 };
        if (segHitsRect(b, gr) || pointInRect(b.x, b.y, gr)) {
          b.alive = false; gd.alive = false; run.gold = null;
          session.stats.golds++;
          sparks(gd.x + gd.w / 2, gd.y + gd.h / 2, 18, pal().gold);
          sfx.gold();
          var kind = host.canHeal && host.canHeal() ? "heal" : "exp";
          host.onGold(kind, DUCK_CONFIG.gold.reward);
        }
      }
    }
    run.bullets = run.bullets.filter(function (b) {
      return b.alive && b.y > -40 && b.y < view.h + 40 && b.x > -40 && b.x < view.w + 40;
    });
  }

  /* ---------- cập nhật ---------- */
  function movePlane(dt) {
    var p = DUCK_CONFIG.plane, minX = 32, maxX = view.w - 32 - p.w;
    // Sân rộng hơn 960 → máy bay phải bay ngang nhanh hơn để không thấy lì
    var k = Math.max(1, view.w / DUCK_CONFIG.world.landscape[0]);
    var vx = 0;
    if (keys.left) vx -= p.speed;
    if (keys.right) vx += p.speed;
    if (vx !== 0) {
      run.plane.x += vx * k * dt;
    } else if (pointer.type === "mouse" && pointer.active) {
      var target = pointer.x - p.w / 2;
      var step = (target - run.plane.x) * p.mouseLerp;
      run.plane.x += clamp(step, -p.maxSpeed * k * dt, p.maxSpeed * k * dt);
    } else if (pointer.type === "touch" && pointer.dragging && pointer.dragNow != null) {
      run.plane.x = pointer.planeFrom + (pointer.dragNow - pointer.dragX);
    }
    run.plane.x = clamp(run.plane.x, minX, maxX);
  }

  function stepEffects(dt) {
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pt = particles[pi];
      pt.life -= dt;
      if (pt.life <= 0) { particles.splice(pi, 1); continue; }
      pt.vy += pt.g * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.rot += pt.spin * dt;
    }
    if (run.flyWord) {
      run.flyWord.t += dt;
      if (run.flyWord.t >= run.flyWord.dur) run.flyWord = null;
    }
    if (shake > 0) shake -= dt;
    if (recoil > 0) recoil -= dt;
  }

  function stepBodies(dt) {
    if (run.state === "FEEDBACK") {
      // phản hồi: mọi chuyển động của sân dừng, chỉ hiệu ứng còn chạy
      for (var fi = 0; fi < run.ducks.length; fi++) {
        var fd = run.ducks[fi];
        if (fd.falling) {
          fd.vy += 900 * dt; fd.y += fd.vy * dt; fd.rot += dt * 5 * fd.dir;
          if (fd.y > view.h + 200) { fd.falling = false; }
        }
      }
      stepEffects(dt);
      return;
    }
    run.t += dt;
    if (run.cooldown > 0) run.cooldown -= dt;
    for (var i = 0; i < run.ducks.length; i++) {
      var d = run.ducks[i];
      if (d.wait > run.t) continue;
      if (d.falling) {
        d.vy += 900 * dt; d.y += d.vy * dt; d.rot += dt * 5 * d.dir;
        if (d.y > view.h + 200) d.alive = false;
        continue;
      }
      if (d.fading) {
        d.alpha -= dt * 2.5;
        d.x += d.dir * d.speed * dt * 1.6;
        if (d.alpha <= 0) { d.alive = false; d.alpha = 0; }
        continue;
      }
      if (!d.alive) continue;
      d.x += d.dir * d.speed * dt;
      d.travel += d.speed * dt;
      if (d.wave) d.y = laneY(d.lane) + 12 * Math.sin(2 * Math.PI * run.t / 2.4);
      if (session.mode.patrol) {
        /* vịt quay đầu ở hai biên, bay qua bay lại đến khi bắn trúng hoặc hết đạn */
        var m = d.turnMargin;
        if (d.dir > 0 && d.x + d.w > view.w - m) { d.x = view.w - m - d.w; d.dir = -1; }
        else if (d.dir < 0 && d.x < m) { d.x = m; d.dir = 1; }
        continue;
      }
      if (d.flipAt != null && !d.flipped && duckProgress(d) > d.flipAt) {
        d.flipped = true; d.dir = -d.dir;
        d.spawnX = d.x;
      }
      var out = d.dir > 0 ? d.x > view.w + 40 : d.x + d.w < -40;
      if (out) {
        d.alive = false;
        if (d.correct && !run.ended) endQuestion("missed", null, false);
      }
    }
    if (run.gold && run.gold.alive) {
      var g = run.gold;
      if (g.wait <= run.t) {
        g.x += g.dir * g.speed * dt;
        g.sparkle += dt;
        if (g.dir > 0 ? g.x > view.w + 40 : g.x + g.w < -40) { g.alive = false; run.gold = null; }
      }
    }
    for (var b2 = 0; b2 < run.bullets.length; b2++) {
      var b = run.bullets[b2];
      b.px = b.x; b.py = b.y;
      if (b.homing && b.target && b.target.alive) {
        var tx = b.target.x + b.target.w / 2, ty = b.target.y + b.target.h / 2;
        var dx = tx - b.x, dy = ty - b.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        var sp = DUCK_CONFIG.bullet.speed;
        b.vx = dx / len * sp; b.vy = dy / len * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    stepEffects(dt);
  }

  function checkEnd() {
    if (run.ended) return;
    var stillFlying = run.ducks.some(function (d) { return d.correct && d.alive; });
    if (!stillFlying) return;
    if (run.ammo === 0 && run.bullets.length === 0) endQuestion("ammo", null, false);
  }

  function update(dt) {
    if (!run) return;
    if (run.state === "INTRO") {
      run.t += dt;
      movePlane(dt);
      if (run.t * 1000 >= DUCK_CONFIG.feedback.introMs) {
        run.state = "FLY";
        run.t = 0;
        // độ khó Trùm: một vịt ngẫu nhiên đổi hướng khi bay qua 50% sân
        if (session.mode.path === "wave") {
          run.ducks[Math.floor(Math.random() * run.ducks.length)].flipAt = 0.5;
        }
      }
      return;
    }
    stepBodies(dt);
    if (run.state === "FLY") {
      movePlane(dt);
      if (pointer.down || keys.space) tryShoot();
      collide();
      if (!run.ended) checkEnd();
    }
  }

  /* ---------- vẽ ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cloudShape(x, y, s, a) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.arc(x + s * 0.55, y - s * 0.22, s * 0.42, 0, Math.PI * 2);
    ctx.arc(x + s * 1.05, y, s * 0.46, 0, Math.PI * 2);
    ctx.arc(x + s * 0.5, y + s * 0.14, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function hillPath(base, amp, f1, f2, ph, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, view.h);
    for (var x = 0; x <= view.w + 16; x += 16) {
      var y = view.h * base + Math.sin(x / view.w * f1 + ph) * amp + Math.sin(x / view.w * f2 + ph * 2) * amp * 0.45;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(view.w, view.h);
    ctx.closePath();
    ctx.fill();
  }

  function drawSky() {
    var c = pal(), t = run ? run.t : 0;
    var g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, c.skyTop); g.addColorStop(0.55, c.skyMid); g.addColorStop(1, c.skyBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);

    // mặt trời / mặt trăng + quầng sáng
    var sx = view.w * 0.86, sy = view.h * 0.2, R = view.h * 0.07;
    var rg = ctx.createRadialGradient(sx, sy, R * 0.3, sx, sy, R * 5);
    rg.addColorStop(0, c.glow); rg.addColorStop(1, c.glow0);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = c.sun;
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();

    // sao (chế độ tối)
    if (c.stars) {
      for (var i = 0; i < 46; i++) {
        var px = (Math.sin(i * 91.7) * 0.5 + 0.5) * view.w, py = (Math.sin(i * 47.3 + 1) * 0.5 + 0.5) * view.h * 0.55;
        var tw = opts.reduceMotion ? 0.7 : 0.45 + 0.4 * Math.sin(t * 1.6 + i);
        ctx.globalAlpha = tw; ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(px, py, 0.9 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // mây nhiều lớp, trôi với tốc độ khác nhau (tạo chiều sâu)
    ctx.fillStyle = c.cloud;
    var span = view.w + 320;
    [[0.10, 0.14, 90, 6, 0.55], [0.55, 0.24, 64, 10, 0.5], [0.80, 0.09, 54, 8, 0.4], [0.33, 0.62, 80, 14, 0.35], [0.92, 0.55, 58, 5, 0.3]]
      .forEach(function (k) {
        var drift = opts.reduceMotion ? 0 : t * k[3];
        var x = ((k[0] * view.w + drift) % span + span) % span - 160;
        cloudShape(x, k[1] * view.h, k[2], k[4]);
      });

    // đồi xa
    var ph = opts.reduceMotion ? 0 : t * 0.02;
    hillPath(0.90, view.h * 0.025, 7, 13, 0.6 + ph, c.hill1);
    hillPath(0.935, view.h * 0.02, 9, 17, 2.1 + ph, c.hill2);
    hillPath(0.97, view.h * 0.014, 11, 23, 4.0 + ph, c.hill3);
  }

  function drawDuck(d) {
    var cx = d.x + d.w / 2, cy = d.y + d.h / 2, c = pal();
    var flap = opts.reduceMotion ? 0 : Math.sin((run ? run.t : 0) * 9 + d.x * 0.03);
    ctx.save();
    ctx.globalAlpha = d.alpha;
    if (d.falling) { ctx.translate(cx, cy); ctx.rotate(d.rot); ctx.translate(-cx, -cy); }
    ctx.translate(cx, cy);
    if (d.dir < 0) ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
    var bob = opts.reduceMotion ? 0 : flap * 1.5;
    ctx.translate(0, bob);
    // đuôi
    ctx.fillStyle = c.duckDark;
    ctx.beginPath(); ctx.moveTo(cx - d.w / 2 + 2, cy + 2); ctx.lineTo(cx - d.w / 2 - 16, cy - 10); ctx.lineTo(cx - d.w / 2 - 6, cy + 6); ctx.lineTo(cx - d.w / 2 + 6, cy + 10); ctx.closePath(); ctx.fill();
    // thân (đổ bóng nhẹ)
    var bg = ctx.createLinearGradient(0, cy - d.h / 2, 0, cy + d.h / 2);
    bg.addColorStop(0, c.duckLight); bg.addColorStop(1, c.duck);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(cx, cy + 6, d.w / 2, d.h / 2 - 8, 0, 0, Math.PI * 2); ctx.fill();
    // bụng sáng
    ctx.fillStyle = c.belly; ctx.globalAlpha = d.alpha * 0.9;
    ctx.beginPath(); ctx.ellipse(cx + 6, cy + 16, d.w * 0.34, d.h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = d.alpha;
    // đầu
    var hx = cx + d.w / 2 - 16, hy = cy - d.h / 2 + 14;
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(hx, hy, 17, 0, Math.PI * 2); ctx.fill();
    // mỏ
    ctx.fillStyle = c.beak;
    ctx.beginPath();
    ctx.moveTo(cx + d.w / 2 - 2, cy - d.h / 2 + 11);
    ctx.quadraticCurveTo(cx + d.w / 2 + 20, cy - d.h / 2 + 12, cx + d.w / 2 + 24, cy - d.h / 2 + 17);
    ctx.quadraticCurveTo(cx + d.w / 2 + 10, cy - d.h / 2 + 24, cx + d.w / 2 - 2, cy - d.h / 2 + 22);
    ctx.closePath(); ctx.fill();
    // mắt có điểm sáng
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(hx + 4, hy - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1208";
    ctx.beginPath(); ctx.arc(hx + 5, hy - 5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(hx + 5.8, hy - 6, 0.9, 0, Math.PI * 2); ctx.fill();
    // cánh vỗ
    ctx.save();
    ctx.translate(cx - 8, cy + 2);
    ctx.rotate(-0.2 - flap * 0.45);
    ctx.fillStyle = c.duckDark;
    ctx.beginPath(); ctx.ellipse(-6, 0, 28, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.duckLight; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-26, 1); ctx.quadraticCurveTo(-8, -5, 12, 0); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // biển đáp án (không đảo theo hướng bay)
    var sw = d.geom.w, sh = d.geom.h;
    var sx = cx - sw / 2, sy = d.y + d.h + 4;
    var isRight = d.correct && run && run.state === "FEEDBACK";
    ctx.save();
    ctx.globalAlpha = d.alpha;
    // dây treo
    ctx.strokeStyle = c.signLine; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - sw * 0.22, d.y + d.h - 6); ctx.lineTo(cx - sw * 0.22, sy + 2);
    ctx.moveTo(cx + sw * 0.22, d.y + d.h - 6); ctx.lineTo(cx + sw * 0.22, sy + 2); ctx.stroke();
    // thân biển có bóng đổ
    ctx.shadowColor = isRight ? c.ok : "rgba(10,25,60,0.30)";
    ctx.shadowBlur = isRight ? 18 : 12; ctx.shadowOffsetY = isRight ? 0 : 5;
    var sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    sg.addColorStop(0, c.signBg); sg.addColorStop(1, c.signBg2);
    ctx.fillStyle = sg;
    roundRect(sx, sy, sw, sh, 14); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = isRight ? 3 : 2; ctx.strokeStyle = isRight ? c.ok : c.signLine;
    roundRect(sx, sy, sw, sh, 14); ctx.stroke();
    ctx.fillStyle = c.signInk;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 " + d.geom.size + "px " + FONT;
    var lh = d.geom.size + 4;
    var y0 = sy + sh / 2 - (d.geom.lines.length - 1) * lh / 2;
    d.geom.lines.forEach(function (line, i) { ctx.fillText(line, cx, y0 + i * lh); });
    ctx.restore();
  }

  function drawGold(g) {
    var c = pal(), cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (g.dir < 0) ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = c.gold;
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, g.w / 2, g.h / 2 - 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + g.w / 2 - 12, cy - g.h / 2 + 12, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(cx + g.w / 2 - 8, cy - g.h / 2 + 9, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.beak;
    ctx.beginPath();
    ctx.moveTo(cx + g.w / 2 - 1, cy - g.h / 2 + 10); ctx.lineTo(cx + g.w / 2 + 16, cy - g.h / 2 + 14);
    ctx.lineTo(cx + g.w / 2 - 1, cy - g.h / 2 + 18); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (!opts.reduceMotion) {
      var t = (g.sparkle || 0) * 4;
      for (var i = 0; i < 3; i++) {
        var a = t + i * 2.1;
        var px = cx + Math.cos(a) * g.w * 0.55, py = cy + Math.sin(a) * g.h * 0.6;
        ctx.fillStyle = "rgba(255,240,150,.9)";
        ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPlane() {
    var p = DUCK_CONFIG.plane, c = pal();
    var x = run ? run.plane.x : (view.w - p.w) / 2;
    var y = view.h * p.yRatio + (recoil > 0 && !opts.reduceMotion ? rand(-2, 2) : 0);
    var cx = x + p.w / 2;
    ctx.save();
    // ngọn lửa động cơ
    if (!opts.reduceMotion) {
      var fl = 8 + Math.random() * 7;
      var fg = ctx.createLinearGradient(0, y + p.h, 0, y + p.h + fl + 4);
      fg.addColorStop(0, c.bullet2); fg.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(cx - 7, y + p.h - 2); ctx.lineTo(cx, y + p.h + fl + 4); ctx.lineTo(cx + 7, y + p.h - 2); ctx.closePath(); ctx.fill();
    }
    ctx.shadowColor = "rgba(10,25,60,0.28)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    // cánh
    ctx.fillStyle = c.plane;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + p.h * 0.78);
    ctx.lineTo(x + 6, y + p.h * 0.30);
    ctx.lineTo(x + p.w - 6, y + p.h * 0.30);
    ctx.lineTo(x + p.w + 14, y + p.h * 0.78);
    ctx.lineTo(x + p.w * 0.72, y + p.h * 0.66);
    ctx.lineTo(x + p.w * 0.28, y + p.h * 0.66);
    ctx.closePath(); ctx.fill();
    // thân
    var bg = ctx.createLinearGradient(0, y, 0, y + p.h);
    bg.addColorStop(0, c.planeLight); bg.addColorStop(1, c.plane);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(cx, y - 4);
    ctx.quadraticCurveTo(cx + p.w * 0.26, y + p.h * 0.18, cx + p.w * 0.24, y + p.h * 0.62);
    ctx.lineTo(cx + p.w * 0.14, y + p.h);
    ctx.lineTo(cx - p.w * 0.14, y + p.h);
    ctx.lineTo(cx - p.w * 0.24, y + p.h * 0.62);
    ctx.quadraticCurveTo(cx - p.w * 0.26, y + p.h * 0.18, cx, y - 4);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // buồng lái
    var cg = ctx.createLinearGradient(0, y + 6, 0, y + 24);
    cg.addColorStop(0, "#ffffff"); cg.addColorStop(1, "#9fd0ff");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cx, y + p.h * 0.36, 6.5, 10, 0, 0, Math.PI * 2); ctx.fill();
    // nòng súng + tia lửa khi bắn
    ctx.fillStyle = c.plane;
    roundRect(cx - 3, y - 12, 6, 12, 2); ctx.fill();
    if (recoil > 0.03) {
      var mg = ctx.createRadialGradient(cx, y - 14, 1, cx, y - 14, 14);
      mg.addColorStop(0, c.bullet2); mg.addColorStop(1, "rgba(255,160,60,0)");
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(cx, y - 14, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBullets() {
    if (!run) return;
    var b = DUCK_CONFIG.bullet, c = pal();
    ctx.save();
    ctx.shadowColor = c.bullet; ctx.shadowBlur = 10;
    run.bullets.forEach(function (x) {
      var g = ctx.createLinearGradient(0, x.y, 0, x.y + b.h + 10);
      g.addColorStop(0, c.bullet2); g.addColorStop(1, c.bullet);
      ctx.fillStyle = g;
      roundRect(x.x - b.w / 2, x.y, b.w, b.h + 6, 4); ctx.fill();
    });
    ctx.restore();
  }

  function drawAmmo() {
    if (!run) return;
    var total = DUCK_CONFIG.bullet.perQuestion, c = pal();
    var dark = c === P.dark;
    ctx.save();
    ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)";
    roundRect(16, view.h - 50, total * 24 + 22, 38, 19); ctx.fill();
    for (var i = 0; i < total; i++) {
      var on = i < run.ammo;
      ctx.globalAlpha = on ? 1 : 0.28;
      ctx.fillStyle = on ? c.bullet : c.signInk;
      roundRect(28 + i * 24, view.h - 44, 10, 26, 5); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(function (p) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.6, p.r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function drawFlyWord() {
    if (!run || !run.flyWord) return;
    var f = run.flyWord, c = pal();
    var p = f.t / f.dur;
    var tx = view.w / 2, ty = 26;
    var x = f.x + (tx - f.x) * p, y = f.y + (ty - f.y) * p - Math.sin(p * Math.PI) * 70;
    ctx.save();
    ctx.globalAlpha = 1 - p * 0.35;
    ctx.font = "800 " + (opts.large ? 24 : 20) + "px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = c.ok;
    ctx.fillText(f.text, x, y);
    ctx.restore();
  }

  function drawOverlay(text, sub) {
    ctx.save();
    ctx.fillStyle = "rgba(8,14,26,.62)";
    ctx.fillRect(0, 0, view.w, view.h);
    var size = opts.large ? 34 : 28;
    ctx.font = "800 " + size + "px " + FONT;
    var tw = ctx.measureText(text).width;
    ctx.font = "600 16px " + FONT;
    var sw = sub ? ctx.measureText(sub).width : 0;
    var bw = Math.max(tw, sw) + 44, bh = (sub ? 92 : 60);
    ctx.fillStyle = "rgba(8,14,26,.72)";
    roundRect(view.w / 2 - bw / 2, view.h / 2 - 40, bw, bh, 16);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "800 " + size + "px " + FONT;
    ctx.fillText(text, view.w / 2, view.h / 2);
    if (sub) { ctx.font = "600 16px " + FONT; ctx.fillText(sub, view.w / 2, view.h / 2 + 32); }
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    if (shake > 0 && !opts.reduceMotion) ctx.translate(rand(-4, 4), rand(-3, 3));
    drawSky();
    if (run) {
      run.ducks.forEach(function (d) { if (d.alive || d.falling || d.fading) drawDuck(d); });
      if (run.gold && run.gold.alive && run.gold.wait <= run.t) drawGold(run.gold);
      drawBullets();
    }
    drawPlane();
    drawAmmo();
    drawParticles();
    drawFlyWord();
    if (run && run.state === "INTRO") drawOverlay("Sẵn sàng…", "Vịt sẽ bay vào sau 0,8 giây");
    if (paused) drawOverlay("⏸ Tạm dừng", "Bấm P hoặc chạm vào đây để tiếp tục");
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!live) return;
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 1 / 15);
    last = ts;
    if (!paused) {
      acc += dt;
      var guard = 0;
      while (acc >= STEP && guard++ < 6) { update(STEP); acc -= STEP; }
    }
    render();
  }
  function ensureLoop() {
    if (!raf) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
  }

  /* ---------- điều khiển ---------- */
  function onKeyDown(e) {
    if (!session) return;
    var k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { keys.left = true; e.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { keys.right = true; e.preventDefault(); }
    else if (k === " ") { keys.space = true; e.preventDefault(); }
    else if (k === "p" || k === "P" || k === "Escape") { togglePause(); e.preventDefault(); }
    else if (k === "h" || k === "H") useHint();
    else if (k === "m" || k === "M") setMute(!mute);
    else if (opts.autoAim && /^[1-4]$/.test(k)) aimShot(+k - 1);
  }
  function onKeyUp(e) {
    var k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
    else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
    else if (k === " ") keys.space = false;
  }
  function toLogicalX(clientX) {
    var r = cv.getBoundingClientRect();
    return (clientX - r.left) / (r.width || 1) * view.w;
  }
  function onPointerDown(e) {
    if (!session) return;
    pointer.type = e.pointerType === "touch" ? "touch" : "mouse";
    pointer.down = true; pointer.active = true;
    if (paused) { togglePause(); return; }
    if (pointer.type === "touch") {
      pointer.dragging = true;
      pointer.dragX = toLogicalX(e.clientX);
      pointer.dragNow = pointer.dragX;
      pointer.planeFrom = run ? run.plane.x : 0;
      if (run && !run.ended && run.state === "FLY" && canShoot()) fire();
    }
    if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
    if (e.preventDefault) e.preventDefault();
  }
  function onPointerMove(e) {
    if (!session) return;
    pointer.type = e.pointerType === "touch" ? "touch" : "mouse";
    pointer.x = toLogicalX(e.clientX);
    pointer.active = true;
    if (pointer.type === "touch" && pointer.dragging && run) {
      pointer.dragNow = toLogicalX(e.clientX);
    }
  }
  function onPointerUp() {
    pointer.down = false; pointer.dragging = false;
  }
  function onResize() {
    if (!session) return;
    layout();
    if (run && run.ducks) spreadLanes(run.ducks);   // đổi khổ sân thì tính lại khoảng cách làn
    // Vừa đổi toàn màn hình thì chỉ tính lại tỉ lệ, không tạm dừng
    if (Date.now() - fsAt < 700) return;
    if (!paused && run && !run.ended) { paused = true; if (host.onPause) host.onPause(true); }
  }
  function onFsChange() {
    fsAt = Date.now();
    if (session) { layout(); if (run && run.ducks) spreadLanes(run.ducks); }
  }
  function onVisibility() {
    if (!session || document.visibilityState !== "hidden") return;
    if (!paused && run && !run.ended) { paused = true; if (host.onPause) host.onPause(true); }
  }

  function bind() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onVisibility);
    bound = true;
  }
  function unbind() {
    if (!bound) return;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (cv) {
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointermove", onPointerMove);
    }
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    document.removeEventListener("fullscreenchange", onFsChange);
    document.removeEventListener("webkitfullscreenchange", onFsChange);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", onVisibility);
    bound = false;
  }

  /* ---------- API ---------- */
  function setup(canvas, hooks) {
    cv = canvas; ctx = cv.getContext("2d");
    host = hooks || {};
    watchBox();
    layout();
  }
  /* Khung chứa đổi cỡ (vào/ra toàn màn hình, hiện bảng phản hồi) thì vẽ lại cho vừa */
  function watchBox() {
    if (!window.ResizeObserver || !cv || !cv.parentNode) return;
    if (!ro) ro = new ResizeObserver(function () { layout(); });
    ro.disconnect();
    ro.observe(cv.parentNode);
  }

  function startGame(modeKey) {
    if (!cv) throw new Error("Chưa gán canvas cho DuckGame.setup()");
    var mode = DUCK_CONFIG.modes[modeKey] || DUCK_CONFIG.modes.thuong;
    session = { modeKey: modeKey, mode: mode, stats: { shots: 0, hits: 0, golds: 0 }, hintLeft: DUCK_CONFIG.hint.enabled ? DUCK_CONFIG.hint.perGame : 0, healed: false };
    run = null; particles = []; paused = false;
    keys.left = keys.right = keys.space = false;
    pointer.down = false; pointer.dragging = false; pointer.dragNow = null; pointer.active = false;
    layout();
    live = true;
    if (!bound) bind();
    ensureLoop();
    if (host.onAmmo) host.onAmmo(DUCK_CONFIG.bullet.perQuestion);
    if (host.onHintState) host.onHintState(session.hintLeft);
    if (host.onMute) host.onMute(mute);
  }

  function stopGame() {
    session = null; run = null; particles = []; live = false; paused = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    unbind();
  }

  function togglePause(force) {
    if (!session || !run || run.ended) return;
    paused = force == null ? !paused : !!force;
    if (host.onPause) host.onPause(paused);
  }

  function useHint() {
    if (!session || paused || !run || run.ended || run.state !== "FLY") return;
    if (session.hintLeft <= 0 || run.hintUsed) return;
    var wrong = run.ducks.filter(function (d) { return d.alive && !d.correct && !d.fading && d.wait <= run.t; });
    if (!wrong.length) return;
    var pick = wrong[Math.floor(Math.random() * wrong.length)];
    pick.fading = true;
    pick.dir = pick.x < view.w / 2 ? -1 : 1;
    session.hintLeft--; run.hintUsed = true;
    if (host.onHint) host.onHint();
    if (host.onHintState) host.onHintState(session.hintLeft);
  }

  function saveBest(modeKey, rec) {
    var all = readLS(LS_BEST, {}) || {};
    all.best = all.best || {};
    var prev = all.best[modeKey];
    if (!prev || rec.exp > prev.exp) all.best[modeKey] = rec;
    all.plays = (all.plays || 0) + 1;
    writeLS(LS_BEST, all);
    return all;
  }
  function bests() {
    var all = readLS(LS_BEST, {}) || {};
    return all.best || {};
  }

  function setMute(v) {
    mute = !!v;
    writeLS(LS_MUTE, mute);
    if (host.onMute) host.onMute(mute);
    if (!mute) sfx.shoot();
  }

  function setOpt(name, v) {
    if (!(name in opts)) return;
    opts[name] = !!v;
    saveOpts();
  }

  window.DuckGame = {
    config: DUCK_CONFIG,
    valid: validQuestion,
    comboMul: comboMul,
    modeInfo: function (key) {
      var m = DUCK_CONFIG.modes[key] || DUCK_CONFIG.modes.thuong;
      return { count: m.count, hearts: m.hearts, name: m.name, cross: m.cross, goldChance: m.goldChance, patrol: !!m.patrol };
    },
    setup: setup,
    startGame: startGame,
    playQuestion: playQuestion,
    togglePause: togglePause,
    useHint: useHint,
    stopGame: stopGame,
    setMute: setMute,
    isMuted: function () { return mute; },
    setOpt: setOpt,
    getOpt: function () { return opts; },
    stats: function () { return session ? session.stats : { shots: 0, hits: 0, golds: 0 }; },
    /* peek(): trạng thái nội bộ, dùng khi cân bằng độ khó và kiểm thử */
    peek: function () { return { view: view, run: run, session: session, opts: opts, paused: paused }; },
    saveBest: saveBest,
    bests: bests,
    gameOver: function (win) { sfx.over(win); },
    layout: layout
  };
})();
