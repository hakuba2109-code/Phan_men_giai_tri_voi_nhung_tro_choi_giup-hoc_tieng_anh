/* ==========================================================================
   TRA CỨU BÔI ĐEN (Alt+Z), PHÁT ÂM (Alt+X), THẺ NỔI, TRA LỒNG, LỊCH SỬ,
   GỢI Ý LƯU, TỪ DỄ NHẦM VÀ MÀN ÔN TỪ ĐÃ LƯU.
   - Không thư viện ngoài. Chỉ dùng fetch, IndexedDB, speechSynthesis.
   - Mọi dữ liệu từ server/AI đều vẽ bằng textContent (không innerHTML) -> chống XSS.
   - Phần logic thuần (chuẩn hóa, Leither, phím tắt) xuất ra module.exports để test.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ToeicLookup = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SCHEMA_VERSION = 1;
  var INTERVALS = [1, 3, 7, 14, 30, 60];
  var EDGE = " \t\n\r\"'“”‘’()[]{}<>.,;:!?…—–-";
  var LS_OPTS = "toeic.lookupOpts";
  var LS_KEYS = "toeic.lookupKeys";
  var LS_FALLBACK = "toeic.lookupRecent.";
  var DB_NAME = "toeic-lookup";
  var STORE = "history";
  var MAX_HISTORY = 50;
  var MAX_NESTED = 6;
  var FRESH_MS = 30 * 86400000;
  var COUNT_GAP_MS = 60000;

  var DEFAULTS = {
    enabled: true,
    deepWord: true,
    deepSentence: false,
    inInputs: false,
    history: true,
    savePrompt: true,
    saveThreshold: 3,
    autoSave: false,
    confusables: true,
    sessionCards: 20,
    accent: "en-US",
    rate: 1,
  };
  var DEFAULT_KEYS = { translate: "Alt+KeyZ", speak: "Alt+KeyX" };

  function stripEdges(s) {
    var a = 0;
    var b = s.length;
    while (a < b && EDGE.indexOf(s[a]) >= 0) a++;
    while (b > a && EDGE.indexOf(s[b - 1]) >= 0) b--;
    return s.slice(a, b);
  }

  function normalizeText(input) {
    var s = String(input == null ? "" : input).replace(/\s+/g, " ").trim();
    s = stripEdges(s).replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.indexOf(" ") < 0 ? s.toLowerCase() : s;
  }

  function wordCount(input) {
    var s = String(input == null ? "" : input).trim();
    return s ? s.split(/\s+/).length : 0;
  }

  function kindOf(input) {
    var n = wordCount(normalizeText(input));
    if (n <= 1) return "word";
    if (n <= 3) return "phrase";
    return "sentence";
  }

  function nextState(box, rating) {
    var b = Math.max(0, Math.min(INTERVALS.length - 1, Math.floor(Number(box) || 0)));
    if (rating === "know") {
      var up = Math.min(b + 1, INTERVALS.length - 1);
      return { box: up, days: INTERVALS[up] };
    }
    if (rating === "unsure") return { box: b, days: Math.max(1, Math.round(INTERVALS[b] / 2)) };
    if (rating === "forgot") return { box: 0, days: 1, lapse: true };
    return null;
  }

  function parseBinding(str) {
    var out = { alt: false, ctrl: false, meta: false, shift: false, code: "" };
    String(str || "")
      .split("+")
      .forEach(function (p) {
        if (p === "Alt") out.alt = true;
        else if (p === "Ctrl") out.ctrl = true;
        else if (p === "Cmd" || p === "Meta") out.meta = true;
        else if (p === "Shift") out.shift = true;
        else if (p) out.code = p;
      });
    return out;
  }

  function fmtBinding(b) {
    var a = [];
    if (b.ctrl) a.push("Ctrl");
    if (b.meta) a.push("Cmd");
    if (b.alt) a.push("Alt");
    if (b.shift) a.push("Shift");
    var code = String(b.code || "").replace(/^Key/, "").replace(/^Digit/, "");
    if (code) a.push(code);
    return a.join("+");
  }

  function matchBinding(e, b) {
    return (
      !!b.code &&
      e.code === b.code &&
      !!e.altKey === b.alt &&
      !!e.ctrlKey === b.ctrl &&
      !!e.metaKey === b.meta &&
      !!e.shiftKey === b.shift
    );
  }

  function detectLang(text) {
    return /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(String(text || "")) ? "vi-VN" : "en-US";
  }

  /* Chọn giọng đọc theo 3 mức: trùng hẳn -> trùng ngôn ngữ + vùng (en-US_Southeast
     vẫn lấy en-US, không lấy en-GB) -> chỉ trùng ngôn ngữ. */
  function tagParts(lang) {
    var parts = String(lang || "").toLowerCase().split(/[-_]/).filter(Boolean);
    return { full: parts.join("-"), lang: parts[0] || "", region: parts[1] || "" };
  }

  function chooseVoice(list, lang) {
    var want = tagParts(lang);
    var exact = null;
    var sameRegion = null;
    var sameLang = null;
    for (var i = 0; i < (list || []).length; i++) {
      var v = list[i];
      var have = tagParts(v && v.lang);
      if (!exact && have.full === want.full) exact = v;
      if (!sameRegion && have.lang === want.lang && have.region && have.region === want.region) sameRegion = v;
      if (!sameLang && have.lang === want.lang) sameLang = v;
    }
    return exact || sameRegion || sameLang || null;
  }

  /* Bốn luật tinh gọn, tách ra để mã DOM và bài kiểm thử dùng chung. */
  function sortNewest(list) {
    return (list || []).slice().sort(function (a, b) {
      return ((b && b.lastAt) || 0) - ((a && a.lastAt) || 0);
    });
  }

  function trimHistory(list, max) {
    return sortNewest(list).slice(0, max);
  }

  function isFresh(rec, now, maxAgeMs) {
    return !!(rec && rec.schemaVersion === SCHEMA_VERSION && rec.lastAt && now - rec.lastAt < maxAgeMs);
  }

  /* Chỉ đếm thêm khi lần tra gần nhất cách đây quá gapMs (chống đếm đôi). */
  function nextCount(rec, now, gapMs) {
    var have = ((rec && rec.count) || 0);
    var last = ((rec && rec.lastAt) || 0);
    if (last && now - last < gapMs) return have;
    return have + 1;
  }

  function pushStack(list, view, max) {
    var out = (list || []).slice();
    while (out.length >= max) out.shift();
    out.push(view);
    return out;
  }

  function promptDecision(rec, count, threshold) {
    if (!rec || rec.muted) return false;
    var min = Math.max(2, Number(threshold) || 3);
    if (count < min) return false;
    if (rec.snoozeUntilCount && count < rec.snoozeUntilCount) return false;
    return true;
  }

  /* Chỉ coi là "đang gõ" với ô nhập văn bản thật. Checkbox/range/nút hay ô chỉ
     đọc (read-only) không được chặn phím tắt, nếu không vừa đổi cài đặt là mất phím. */
  function isTextEntry(tag, type, readOnly, editable, capturing) {
    var t = String(tag || "").toUpperCase();
    if (capturing) return true;
    if (editable) return true;
    if (t === "TEXTAREA" || t === "SELECT") return true;
    if (t !== "INPUT") return false;
    if (readOnly) return false;
    return ["text", "search", "email", "tel", "url", "password", "number"].indexOf(String(type || "text").toLowerCase()) >= 0;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    INTERVALS: INTERVALS,
    DEFAULTS: DEFAULTS,
    DEFAULT_KEYS: DEFAULT_KEYS,
    normalizeText: normalizeText,
    wordCount: wordCount,
    kindOf: kindOf,
    nextState: nextState,
    parseBinding: parseBinding,
    fmtBinding: fmtBinding,
    matchBinding: matchBinding,
    detectLang: detectLang,
    chooseVoice: chooseVoice,
    LIMITS: {
      history: MAX_HISTORY,
      nested: MAX_NESTED,
      freshMs: FRESH_MS,
      countGapMs: COUNT_GAP_MS,
    },
    sortNewest: sortNewest,
    trimHistory: trimHistory,
    isFresh: isFresh,
    nextCount: nextCount,
    pushStack: pushStack,
    promptDecision: promptDecision,
    isTextEntry: isTextEntry,
  };

  if (typeof document === "undefined" || typeof window === "undefined") return api;

  /* ======================================================================
     TRẠNG THÁI
     ====================================================================== */
  var opts = loadOpts();
  var keys = loadKeys();
  var uid = 0;
  var API = location.protocol.indexOf("http") === 0;
  var started = false;
  var card = null;
  var C = {};
  var floatEl = null;
  var F = {};
  var stack = [];
  var lastFocus = null;
  var listenersCtl = null;
  var floatSel = null;
  var selTimer = 0;
  var nestedTimer = 0;
  var liveEl = null;
  var toastEl = null;
  var toastTimer = 0;
  var voices = [];
  var dbPromise = null;
  var histList = [];
  var reviewMask = null;
  var RV = null;
  var RVel = {};
  var reviewFocus = null;

  var noop = function () {};

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function top() {
    return stack.length ? stack[stack.length - 1] : null;
  }

  function cardOpen() {
    return !!(card && !card.classList.contains("lk-hide"));
  }

  function reviewOpen() {
    return !!(reviewMask && !reviewMask.classList.contains("lk-hide"));
  }

  function loadOpts() {
    var o = {};
    var k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    try {
      var raw = JSON.parse(localStorage.getItem(LS_OPTS) || "{}");
      for (k in DEFAULTS) if (raw && typeof raw[k] === typeof DEFAULTS[k]) o[k] = raw[k];
    } catch (e) {}
    return o;
  }

  function saveOpts() {
    try {
      localStorage.setItem(LS_OPTS, JSON.stringify(opts));
    } catch (e) {}
  }

  function loadKeys() {
    var o = { translate: DEFAULT_KEYS.translate, speak: DEFAULT_KEYS.speak };
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEYS) || "{}");
      if (raw && typeof raw.translate === "string") o.translate = raw.translate;
      if (raw && typeof raw.speak === "string") o.speak = raw.speak;
    } catch (e) {}
    return o;
  }

  function saveKeys() {
    try {
      localStorage.setItem(LS_KEYS, JSON.stringify(keys));
    } catch (e) {}
  }

  function tzName() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) {
      return "UTC";
    }
  }

  /* Trần nhóm 'words' lấy từ TownCore (bản dựng có nạp town-core.js). Không có thì im lặng,
     vì tự viết số 15 ở đây là thêm một nơi phải sửa khi đổi giá. */
  function xuWordsCap() {
    try {
      var core = (typeof self !== "undefined" && self.TownCore) || (typeof window !== "undefined" && window.TownCore);
      return core && core.CONFIG && core.CONFIG.xu && core.CONFIG.xu.words ? core.CONFIG.xu.words.cap : null;
    } catch (e) {
      return null;
    }
  }

  function xuSessionLine() {
    var got = RV && RV.xu ? RV.xu : 0;
    var cards = RV ? (RV.stats.know || 0) + (RV.stats.unsure || 0) + (RV.stats.forgot || 0) : 0;
    var cap = xuWordsCap();
    var s = got
      ? "🪙 +" + got + " xu cho " + cards + " thẻ đã ôn"
      : "🪙 Phiên này không thêm xu — vòng ôn từ hôm nay đã đủ rồi. Bạn vẫn có thể ôn tiếp để nhớ lâu hơn.";
    if (cap != null) s += " (trần " + cap + " xu/ngày cho mục ôn từ)";
    return s;
  }

  function live(text) {
    if (liveEl) liveEl.textContent = text;
  }

  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.remove("lk-hide");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.add("lk-hide");
    }, 3200);
  }

  /* ======================================================================
     LỊCH SỬ TRA (IndexedDB; hỏng thì lùi về localStorage chỉ danh sách từ)
     ====================================================================== */
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("no indexedDB"));
      var req;
      try {
        req = window.indexedDB.open(DB_NAME, 1);
      } catch (e) {
        return reject(e);
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("indexedDB error"));
      };
      req.onblocked = function () {
        reject(new Error("indexedDB blocked"));
      };
    });
    return dbPromise;
  }

  function idbReq(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = fn(tx.objectStore(STORE));
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
        tx.onabort = function () {
          reject(tx.error || new Error("transaction aborted"));
        };
      });
    });
  }

  function histKey(norm) {
    return uid + "|" + norm + "|vi";
  }

  function fallbackList() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_FALLBACK + uid) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function fallbackSave(list) {
    try {
      localStorage.setItem(LS_FALLBACK + uid, JSON.stringify(trimHistory(list, MAX_HISTORY)));
    } catch (e) {}
  }

  function histGet(norm) {
    var key = histKey(norm);
    return idbReq("readonly", function (s) {
      return s.get(key);
    })
      .then(function (rec) {
        return rec || null;
      })
      .catch(function () {
        var list = fallbackList();
        for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
        return null;
      });
  }

  function trimIdb() {
    return idbReq("readonly", function (s) {
      return s.getAll();
    })
      .then(function (list) {
        if (!Array.isArray(list) || list.length <= MAX_HISTORY) return;
        return Promise.all(
          sortNewest(list)
            .slice(MAX_HISTORY)
            .map(function (x) {
              return idbReq("readwrite", function (s) {
                return s.delete(x.key);
              }).catch(noop);
            })
        );
      })
      .catch(noop);
  }

  function histPut(rec) {
    if (!opts.history) return Promise.resolve();
    rec.key = histKey(rec.norm);
    rec.uid = uid;
    rec.schemaVersion = SCHEMA_VERSION;
    return idbReq("readwrite", function (s) {
      return s.put(rec);
    })
      .then(function () {
        trimIdb();
      })
      .catch(function () {
        var list = fallbackList();
        var out = [];
        for (var i = 0; i < list.length; i++) if (list[i].key !== rec.key) out.push(list[i]);
        out.unshift({
          key: rec.key,
          uid: uid,
          text: rec.text,
          norm: rec.norm,
          kind: rec.kind,
          lastAt: rec.lastAt,
          count: rec.count,
          muted: rec.muted,
          snoozeUntilCount: rec.snoozeUntilCount,
          schemaVersion: SCHEMA_VERSION,
        });
        fallbackSave(out);
      });
  }

  function histAll() {
    return idbReq("readonly", function (s) {
      return s.getAll();
    })
      .then(function (list) {
        return Array.isArray(list) ? list : [];
      })
      .catch(function () {
        return fallbackList();
      });
  }

  function updateHist(norm, fn) {
    return histGet(norm).then(function (rec) {
      if (!rec) rec = { text: norm, norm: norm, kind: kindOf(norm), count: 0, lastAt: 0 };
      fn(rec);
      rec.norm = rec.norm || norm;
      return histPut(rec);
    });
  }

  function slimBasic(b) {
    if (!b) return null;
    return {
      text: b.text,
      kind: b.kind,
      translation: b.translation,
      phonetic: b.phonetic,
      pos: b.pos,
      confusables: b.confusables || [],
    };
  }

  function slimDeep(d) {
    if (!d) return null;
    var c = JSON.parse(JSON.stringify(d));
    delete c.saved;
    return c;
  }

  function bumpHistory(view) {
    if (!opts.history) return Promise.resolve();
    var now = Date.now();
    return histGet(view.norm)
      .then(function (rec) {
        if (!rec) rec = { text: view.text, norm: view.norm, kind: view.kind, count: 0, lastAt: 0 };
        rec.count = nextCount(rec, now, COUNT_GAP_MS);
        rec.lastAt = now;
        rec.text = view.text;
        rec.kind = view.kind;
        rec.tier1 = slimBasic(view.basic);
        rec.tier2 = slimDeep(view.deep) || rec.tier2 || null;
        return histPut(rec);
      })
      .catch(noop);
  }

  function rememberDeep(view) {
    if (!opts.history || !view.deep) return;
    histGet(view.norm).then(function (rec) {
      if (!rec) return;
      rec.tier2 = slimDeep(view.deep);
      return histPut(rec);
    }).catch(noop);
  }

  function clearHistory() {
    return idbReq("readwrite", function (s) {
      return s.clear();
    })
      .catch(noop)
      .then(function () {
        try {
          localStorage.removeItem(LS_FALLBACK + uid);
        } catch (e) {}
        histList = [];
        if (C.historyPanel) {
          clear(C.historyPanel);
          C.historyPanel.classList.add("lk-hide");
        }
      });
  }

  /* ======================================================================
     VẼ THẺ
     ====================================================================== */
  function buildCard() {
    card = h("div", "lk-card lk-hide");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Tra cứu");
    card.setAttribute("aria-modal", "false");
    card.tabIndex = -1;
    card.innerHTML =
      '<div class="lk-top">' +
      '  <div class="lk-nav">' +
      '    <button class="lk-btn lk-mini lk-hide" data-lk="back" type="button">← Quay lại</button>' +
      '    <span class="lk-crumb" aria-live="polite"></span>' +
      "  </div>" +
      '  <div class="lk-tools">' +
      '    <button class="lk-btn lk-mini" data-lk="history" type="button" title="Tra gần đây" aria-label="Tra gần đây">🕘</button>' +
      '    <button class="lk-btn lk-mini" data-lk="close" type="button" title="Đóng (Esc)" aria-label="Đóng">✕</button>' +
      "  </div>" +
      "</div>" +
      '<div class="lk-hist lk-hide"></div>' +
      '<div class="lk-banners"></div>' +
      '<div class="lk-body">' +
      '  <div class="lk-headword">' +
      '    <strong class="lk-word"></strong>' +
      '    <span class="lk-ipa"></span>' +
      '    <span class="lk-pos"></span>' +
      '    <span class="lk-sp">' +
      '      <button class="lk-btn" data-lk="speak" type="button" title="Nghe (Alt+X)" aria-label="Nghe phát âm">🔊</button>' +
      '      <button class="lk-btn" data-lk="slow" type="button" title="Đọc chậm" aria-label="Đọc chậm">🐢</button>' +
      "    </span>" +
      "  </div>" +
      '  <p class="lk-trans"></p>' +
      '  <div class="lk-deep"></div>' +
      "</div>" +
      '<div class="lk-foot">' +
      '  <button class="lk-btn lk-primary" data-lk="save" type="button">💾 Lưu vào sổ từ</button>' +
      '  <a class="lk-link" data-lk="gtrans" target="_blank" rel="noopener noreferrer">↗ Google Dịch</a>' +
      "</div>";
    document.body.appendChild(card);
    C = {
      back: card.querySelector('[data-lk="back"]'),
      crumb: card.querySelector(".lk-crumb"),
      hist: card.querySelector('[data-lk="history"]'),
      historyPanel: card.querySelector(".lk-hist"),
      banners: card.querySelector(".lk-banners"),
      body: card.querySelector(".lk-body"),
      word: card.querySelector(".lk-word"),
      ipa: card.querySelector(".lk-ipa"),
      pos: card.querySelector(".lk-pos"),
      trans: card.querySelector(".lk-trans"),
      deep: card.querySelector(".lk-deep"),
      save: card.querySelector('[data-lk="save"]'),
      gtrans: card.querySelector('[data-lk="gtrans"]'),
      speak: card.querySelector('[data-lk="speak"]'),
    };
    card.addEventListener("click", onCardClick);
    card.addEventListener("dblclick", onCardDbl);
    card.addEventListener("mouseup", onCardMouseUp);
  }

  function onCardClick(e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-lk]") : null;
    if (!el || !card.contains(el)) return;
    var act = el.getAttribute("data-lk");
    if (act === "close") closeCard();
    else if (act === "back") goBack();
    else if (act === "history") toggleHistory(el);
    else if (act === "speak") speakTop(false);
    else if (act === "slow") speakTop(true);
    else if (act === "save") saveTop(false);
    else if (act === "deep") loadDeep(top(), true);
    else if (act === "nested") nestedLookup(el.getAttribute("data-w") || "", el.getAttribute("data-ctx") || "");
    else if (act === "hist-item") openHistory(Number(el.getAttribute("data-i")));
    else if (act === "hist-clear") clearHistory().then(function () { toast("Đã xóa lịch sử tra."); });
    else if (act === "p-save") promptSave();
    else if (act === "p-later") promptLater();
    else if (act === "p-mute") promptMute();
  }

  function onCardDbl(e) {
    var sel = window.getSelection ? window.getSelection() : null;
    var text = sel ? String(sel).trim() : "";
    if (!text || !sel.anchorNode || !card.contains(sel.anchorNode)) return;
    if (e.target && e.target.closest && e.target.closest("button, a, summary")) return;
    nestedLookup(text, contextOf(sel.anchorNode));
  }

  function onCardMouseUp(e) {
    if (e.target && e.target.closest && e.target.closest("button, a, summary")) return;
    clearTimeout(nestedTimer);
    nestedTimer = setTimeout(function () {
      var sel = window.getSelection ? window.getSelection() : null;
      var text = sel ? String(sel).replace(/\s+/g, " ").trim() : "";
      if (!text || text.length > 60 || !sel.anchorNode || !card.contains(sel.anchorNode)) return;
      nestedLookup(text, contextOf(sel.anchorNode));
    }, 420);
  }

  function render() {
    var view = top();
    if (!view || !card) return;
    var b = view.basic || {};
    var sentence = view.kind === "sentence";
    card.classList.toggle("lk-sentence", sentence);
    C.word.textContent = b.text || view.text;
    var ipa = (b.phonetic && (b.phonetic.ipaUs || b.phonetic.ipaUk)) || "";
    C.ipa.textContent = ipa || (b && view.kind === "word" && !view.basicBusy && !view.basicError ? "chưa có phiên âm" : "");
    C.pos.textContent = b.pos && b.pos.length ? b.pos.join(" · ") : "";
    C.ipa.classList.toggle("lk-hide", !C.ipa.textContent);
    C.pos.classList.toggle("lk-hide", !C.pos.textContent);

    var tr = "";
    if (view.basicBusy) tr = "Đang tra…";
    else if (view.basicError) tr = view.basicError;
    else if (b.translation) {
      tr = b.translation.primary || "Chưa có nghĩa tiếng Việt";
      if (b.translation.alternatives && b.translation.alternatives.length) {
        tr += " · " + b.translation.alternatives.join(" · ");
      }
    }
    C.trans.textContent = tr || "Chưa có nghĩa tiếng Việt";
    C.trans.classList.toggle("lk-error", !!view.basicError);

    C.save.classList.toggle("lk-hide", sentence);
    C.save.disabled = !!view.saved;
    C.save.textContent = view.saved ? "✓ Đã lưu vào sổ từ" : "💾 Lưu vào sổ từ";
    if (b.text || view.text) {
      C.gtrans.href =
        "https://translate.google.com/?sl=auto&tl=vi&op=translate&text=" +
        encodeURIComponent(String(b.text || view.text).slice(0, 500));
    }
    C.back.classList.toggle("lk-hide", stack.length < 2);
    var start = Math.max(0, stack.length - 3);
    C.crumb.textContent = stack.slice(start).map(function (v) { return v.text; }).join(" › ");
    renderBanners();
    renderDeep();
    if (cardOpen() && view.rect) positionByRect(view.rect);
  }

  function renderBanners() {
    if (!C.banners) return;
    clear(C.banners);
    var view = top();
    if (!view) return;
    if (view.tooLong) {
      var long = h("div", "lk-banner lk-note", "Đoạn dài hơn 300 ký tự — bôi đen ngắn hơn nếu muốn phân tích sâu.");
      C.banners.appendChild(long);
    }
    if (view.prompt && !view.saved) {
      var p = h("div", "lk-banner lk-saveprompt");
      p.appendChild(h("span", "", "Bạn đã tra từ này " + (view.histCount || 0) + " lần. Lưu vào sổ từ để ôn?"));
      var row = h("div", "lk-brow");
      var save = h("button", "lk-btn lk-primary", "Lưu");
      save.type = "button";
      save.setAttribute("data-lk", "p-save");
      var later = h("button", "lk-btn", "Để sau");
      later.type = "button";
      later.setAttribute("data-lk", "p-later");
      var mute = h("button", "lk-btn lk-ghost", "Đừng nhắc từ này");
      mute.type = "button";
      mute.setAttribute("data-lk", "p-mute");
      row.appendChild(save);
      row.appendChild(later);
      row.appendChild(mute);
      p.appendChild(row);
      C.banners.appendChild(p);
    }
    var groups = (view.basic && view.basic.confusables) || [];
    if (opts.confusables && groups.length) {
      for (var g = 0; g < groups.length; g++) C.banners.appendChild(confusableBlock(groups[g], view));
    }
  }

  function confusableBlock(group, view) {
    var others = group.words.map(function (w) { return w.w; }).filter(function (w) {
      return w !== normalizeText(view.text).toLowerCase();
    });
    var det = h("details", "lk-banner lk-warn");
    var sum = h("summary", "", "⚠ Dễ nhầm với " + (others.join(", ") || group.words.map(function (w) { return w.w; }).join(", ")));
    det.appendChild(sum);
    var body = h("div", "lk-warnbody");
    group.words.forEach(function (w) {
      var row = h("div", "lk-wrow");
      var btn = h("button", "lk-btn lk-mini lk-wordbtn", w.w);
      btn.type = "button";
      btn.setAttribute("data-lk", "nested");
      btn.setAttribute("data-w", w.w);
      btn.setAttribute("data-ctx", group.tip || "");
      row.appendChild(btn);
      if (w.pos) row.appendChild(h("span", "lk-tag", w.pos));
      if (w.vi) row.appendChild(h("span", "", w.vi));
      body.appendChild(row);
    });
    if (group.tip) body.appendChild(h("p", "lk-note", "💡 " + group.tip));
    if (group.examples && group.examples.length) {
      var ul = h("ul", "lk-exlist");
      group.examples.forEach(function (ex) {
        ul.appendChild(h("li", "", ex));
      });
      body.appendChild(ul);
    }
    det.appendChild(body);
    return det;
  }

  function renderDeep() {
    var view = top();
    if (!C.deep) return;
    clear(C.deep);
    if (!view) return;
    if (!API) return;
    if (view.deepBusy) {
      C.deep.appendChild(h("p", "lk-note", "🤖 Đang phân tích sâu…"));
    }
    if (view.deepError) {
      C.deep.appendChild(h("p", "lk-note lk-error", view.deepError));
    }
    var canManual =
      !view.deep &&
      !view.deepBusy &&
      !view.tooLong &&
      (view.kind === "sentence" ? !view.deepError || !view.deepQuota : true);
    if (canManual && (view.kind === "sentence" ? opts.deepSentence === false || view.deepError : !opts.deepWord || view.deepError)) {
      var btn = h("button", "lk-btn", view.deepError ? "🔁 Thử phân tích sâu lại" : "🤖 Phân tích sâu");
      btn.type = "button";
      btn.setAttribute("data-lk", "deep");
      C.deep.appendChild(btn);
    }
    if (!view.deep) return;
    if (view.kind === "sentence") renderSentenceDeep(view.deep, view);
    else renderWordDeep(view.deep, view);
  }

  function fold(title, open) {
    var det = h("details", "lk-fold");
    if (open) det.open = true;
    det.appendChild(h("summary", "", title));
    var body = h("div", "lk-foldbody");
    det.appendChild(body);
    return { det: det, body: body };
  }

  function renderWordDeep(data, view) {
    if (data.senses && data.senses.length) {
      var f = fold("▾ Nghĩa theo loại từ", true);
      data.senses.forEach(function (s) {
        var wrap = h("div", "lk-sense");
        var line = h("div", "lk-sense-top");
        if (s.pos) line.appendChild(h("span", "lk-tag", s.pos));
        if (s.meaningVi) line.appendChild(h("strong", "", s.meaningVi));
        wrap.appendChild(line);
        if (s.meaningEn) wrap.appendChild(h("p", "lk-muted", s.meaningEn));
        (s.examples || []).forEach(function (ex) {
          var p = h("p", "lk-ex");
          p.appendChild(document.createTextNode(ex.en));
          if (ex.vi) {
            p.appendChild(document.createElement("br"));
            p.appendChild(h("i", "lk-muted", ex.vi));
          }
          wrap.appendChild(p);
        });
        f.body.appendChild(wrap);
      });
      C.deep.appendChild(f.det);
    }
    if (data.collocations && data.collocations.length) {
      var c = fold("Cụm đi kèm", false);
      var chips = h("div", "lk-chips");
      data.collocations.forEach(function (x) { chips.appendChild(h("span", "lk-chip", x)); });
      c.body.appendChild(chips);
      C.deep.appendChild(c.det);
    }
    if (data.wordFamily && data.wordFamily.length) {
      var wf = fold("Họ từ", false);
      data.wordFamily.forEach(function (w) {
        wf.body.appendChild(h("div", "lk-line", w.word + (w.pos ? " · " + w.pos : "")));
      });
      C.deep.appendChild(wf.det);
    }
    if ((data.synonyms && data.synonyms.length) || (data.antonyms && data.antonyms.length)) {
      var s = fold("Đồng nghĩa / Trái nghĩa", false);
      if (data.synonyms && data.synonyms.length) {
        s.body.appendChild(h("div", "lk-line", "≈ " + data.synonyms.join(", ")));
      }
      if (data.antonyms && data.antonyms.length) {
        s.body.appendChild(h("div", "lk-line", "≠ " + data.antonyms.join(", ")));
      }
      C.deep.appendChild(s.det);
    }
    if (data.commonMistakes && data.commonMistakes.length) {
      var m = fold("Lỗi hay gặp", false);
      var ul = h("ul", "lk-exlist");
      data.commonMistakes.forEach(function (x) { ul.appendChild(h("li", "", x)); });
      m.body.appendChild(ul);
      C.deep.appendChild(m.det);
    }
    if (data.toeic && (data.toeic.note || (data.toeic.likelyParts && data.toeic.likelyParts.length))) {
      var t = fold("🎯 Ghi chú TOEIC", false);
      if (data.toeic.likelyParts && data.toeic.likelyParts.length) {
        var parts = h("div", "lk-chips");
        data.toeic.likelyParts.forEach(function (x) { parts.appendChild(h("span", "lk-chip", x)); });
        t.body.appendChild(parts);
      }
      if (data.toeic.note) t.body.appendChild(h("p", "lk-note", data.toeic.note));
      C.deep.appendChild(t.det);
    }
  }

  function renderSentenceDeep(data, view) {
    if (data.translationNatural) {
      var f = fold("▾ Dịch", true);
      f.body.appendChild(h("p", "", data.translationNatural));
      C.deep.appendChild(f.det);
    }
    if (data.structure && data.structure.length) {
      var s = fold("Cấu trúc", false);
      data.structure.forEach(function (x) {
        var row = h("div", "lk-line");
        if (x.role) row.appendChild(h("span", "lk-tag", x.role));
        row.appendChild(document.createTextNode(x.text));
        s.body.appendChild(row);
      });
      C.deep.appendChild(s.det);
    }
    if (data.tense) {
      var t = fold("Thì", false);
      t.body.appendChild(h("p", "", data.tense));
      C.deep.appendChild(t.det);
    }
    if (data.grammarPoints && data.grammarPoints.length) {
      var gp = fold("Ngữ pháp", false);
      var ul = h("ul", "lk-exlist");
      data.grammarPoints.forEach(function (x) { ul.appendChild(h("li", "", x)); });
      gp.body.appendChild(ul);
      C.deep.appendChild(gp.det);
    }
    if (data.difficultWords && data.difficultWords.length) {
      var d = fold("Từ khó", false);
      data.difficultWords.forEach(function (w) {
        var row = h("div", "lk-wrow");
        var btn = h("button", "lk-btn lk-mini lk-wordbtn", w.word);
        btn.type = "button";
        btn.setAttribute("data-lk", "nested");
        btn.setAttribute("data-w", w.word);
        btn.setAttribute("data-ctx", (view.basic && view.basic.text) || view.text);
        row.appendChild(btn);
        if (w.meaning) row.appendChild(h("span", "lk-muted", w.meaning));
        d.body.appendChild(row);
      });
      C.deep.appendChild(d.det);
    }
  }

  /* ======================================================================
     MỞ THẺ / TẢI DỮ LIỆU
     ====================================================================== */
  function makeView(text, context, rec) {
    var norm = normalizeText(text);
    return {
      text: String(text).trim(),
      norm: norm,
      kind: kindOf(norm),
      context: context || "",
      basic: rec && rec.tier1 ? rec.tier1 : null,
      deep: rec && rec.tier2 ? rec.tier2 : null,
      saved: false,
      basicBusy: false,
      basicError: "",
      deepBusy: false,
      deepError: "",
      deepQuota: false,
      tooLong: norm.length > 300,
      prompt: false,
      histCount: 0,
      ctl: null,
      deepCtl: null,
      rect: null,
      fromHistory: !!rec,
    };
  }

  function abortView(v) {
    if (!v) return;
    if (v.ctl) v.ctl.abort();
    if (v.deepCtl) v.deepCtl.abort();
  }

  function abortStack() {
    stack.forEach(abortView);
  }

  function openView(text, context, nested, rec, rect) {
    var norm = normalizeText(text);
    if (!norm) return;
    var wasOpen = cardOpen();
    if (!wasOpen) lastFocus = document.activeElement;
    if (nested && top() && top().norm === norm) return;
    var view = makeView(text, context, rec);
    view.rect = rect || null;
    if (nested) {
      var kept = pushStack(stack, view, MAX_NESTED);
      stack.forEach(function (v) {
        if (kept.indexOf(v) < 0) abortView(v);
      });
      stack = kept;
    } else {
      abortStack();
      stack = [view];
    }
    if (C.historyPanel) C.historyPanel.classList.add("lk-hide");
    card.classList.remove("lk-hide");
    render();
    if (!wasOpen && !nested) positionByRect(view.rect);
    try {
      card.focus({ preventScroll: true });
    } catch (e) {
      card.focus();
    }
    live(nested ? "Đã chuyển sang " + view.text : "Đang tra " + view.text);
    if (rec && rec.tier1) {
      bumpHistory(view).then(function () {
        checkPrompt(view);
        maybeAutoDeep(view);
        if (view === top()) render();
      });
    } else if (!API) {
      view.basicError = "Cần chạy qua server (npm start) để tra cứu.";
      render();
    } else {
      fetchBasic(view);
    }
  }

  function fetchBasic(view) {
    view.basicBusy = true;
    var ctl = new AbortController();
    view.ctl = ctl;
    fetch("/api/lookup/basic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: view.text, dst: "vi" }),
      signal: ctl.signal,
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (res) {
        view.basicBusy = false;
        view.ctl = null;
        if (stack.indexOf(view) < 0) return;
        if (res.body && res.body.ok) {
          view.basic = res.body.data;
          view.kind = view.basic.kind || view.kind;
          view.saved = !!view.basic.saved;
          if (view === top()) render();
          bumpHistory(view).then(function () {
            checkPrompt(view);
            afterBasic(view);
          });
        } else {
          view.basicError = (res.body && res.body.message) || "Chưa tra được.";
          if (view === top()) render();
        }
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        view.basicBusy = false;
        view.ctl = null;
        if (stack.indexOf(view) < 0) return;
        view.basicError = "Không kết nối được máy chủ — kiểm tra mạng rồi thử lại.";
        if (view === top()) render();
      });
  }

  function afterBasic(view) {
    if (view !== top() && stack.indexOf(view) < 0) return;
    if (!view.basic) return;
    if (opts.autoSave && !view.saved && view.kind !== "sentence" && view.basic.translation && view.basic.translation.primary) {
      saveView(view, true);
    }
    maybeAutoDeep(view);
  }

  function maybeAutoDeep(view) {
    if (!view.basic || view.deep || view.deepBusy || view.tooLong || !API) return;
    var auto = view.kind === "sentence" ? opts.deepSentence : opts.deepWord;
    if (auto) loadDeep(view, false);
    else if (view === top()) renderDeep();
  }

  function loadDeep(view, manual) {
    if (!view || !API || view.deep || view.deepBusy || view.tooLong) return;
    if (!view.basic) return;
    view.deepBusy = true;
    view.deepError = "";
    view.deepQuota = false;
    if (view === top()) renderDeep();
    var ctl = new AbortController();
    view.deepCtl = ctl;
    fetch("/api/lookup/deep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: view.text, context: view.context || "", dst: "vi" }),
      signal: ctl.signal,
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (res) {
        view.deepBusy = false;
        view.deepCtl = null;
        if (stack.indexOf(view) < 0) return;
        if (res.body && res.body.ok) {
          view.deep = res.body.data;
          if (res.body.data && res.body.data.saved) view.saved = true;
          rememberDeep(view);
          if (view === top()) render();
        } else {
          view.deepError = (res.body && res.body.message) || "Chưa phân tích sâu được.";
          view.deepQuota = !!(res.body && res.body.code === "QUOTA");
          if (view === top()) render();
        }
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        view.deepBusy = false;
        view.deepCtl = null;
        if (stack.indexOf(view) < 0) return;
        view.deepError = "Không kết nối được máy chủ.";
        if (view === top()) render();
      });
    if (manual) live("Đang phân tích sâu " + view.text);
  }

  function checkPrompt(view) {
    if (!opts.history || !opts.savePrompt || view.kind === "sentence" || view.saved) return;
    histGet(view.norm).then(function (rec) {
      if (!rec || rec.muted) return;
      view.histCount = rec.count || 0;
      if (!promptDecision(rec, view.histCount, opts.saveThreshold)) return;
      view.prompt = true;
      if (view === top()) renderBanners();
    }).catch(noop);
  }

  function promptSave() {
    var view = top();
    if (!view) return;
    view.prompt = false;
    saveView(view, false);
  }

  function promptLater() {
    var view = top();
    if (!view) return;
    view.prompt = false;
    updateHist(view.norm, function (rec) {
      rec.snoozeUntilCount = (rec.count || 0) + 2;
    }).then(function () {
      renderBanners();
      toast("Sẽ nhắc lại sau 2 lần tra nữa.");
    });
  }

  function promptMute() {
    var view = top();
    if (!view) return;
    view.prompt = false;
    updateHist(view.norm, function (rec) {
      rec.muted = true;
    }).then(function () {
      renderBanners();
      toast("Đã tắt nhắc lưu cho từ này.");
    });
  }

  function saveView(view, silent) {
    if (!view || view.kind === "sentence" || view.saved) return;
    if (!API) {
      if (!silent) toast("Cần chạy qua server để lưu sổ từ.");
      return;
    }
    var b = view.basic || {};
    var body = {
      text: b.text || view.text,
      kind: view.kind,
      meaningVi: (b.translation && b.translation.primary) || "",
      ipa: (b.phonetic && (b.phonetic.ipaUs || b.phonetic.ipaUk)) || "",
      context: view.context || "",
      tz: tzName(),
    };
    if (view === top()) {
      C.save.disabled = true;
      C.save.textContent = "Đang lưu…";
    }
    fetch("/api/words", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.ok) {
          view.saved = true;
          view.prompt = false;
          if (view.basic) view.basic.saved = true;
          if (view === top()) render();
          refreshDue();
          /* +2 xu cho từ THẬT SỰ mới (server trả reward = 0 khi từ đã có trong sổ hoặc đã hết trần nhóm). */
          var gift = (j.xu && j.xu.reward) || 0;
          live(gift ? "Đã lưu " + body.text + " · 🪙 +" + gift + " xu" : "Đã lưu " + body.text);
          if (!silent)
            toast(
              gift
                ? "Đã lưu ✓ 🪙 +" + gift + " xu · từ mới vào sổ · ôn lần đầu vào ngày mai."
                : "Đã lưu ✓ — ôn lần đầu vào ngày mai."
            );
        } else {
          if (view === top()) render();
          if (!silent) toast((j && j.message) || "Chưa lưu được.");
        }
      })
      .catch(function () {
        if (view === top()) render();
        if (!silent) toast("Không kết nối được máy chủ.");
      });
  }

  function saveTop(silent) {
    saveView(top(), silent);
  }

  function nestedLookup(text, context) {
    var t = normalizeText(text);
    if (!t) return;
    if (t.length > 500) {
      toast("Đoạn này dài quá 500 ký tự — chọn ngắn hơn.");
      return;
    }
    if (top() && top().norm === t) return;
    var r = card ? card.getBoundingClientRect() : null;
    openView(t, context || "", true, null, null);
    if (r) card.style.top = r.top + "px";
  }

  function goBack() {
    if (stack.length < 2) return;
    var gone = stack.pop();
    if (gone.ctl) gone.ctl.abort();
    if (gone.deepCtl) gone.deepCtl.abort();
    render();
    live("Quay lại " + top().text);
    try {
      card.focus({ preventScroll: true });
    } catch (e) {}
  }

  function closeCard() {
    abortStack();
    stack = [];
    if (card) card.classList.add("lk-hide");
    if (C.historyPanel) C.historyPanel.classList.add("lk-hide");
    hideFloat();
    if (lastFocus && lastFocus.focus) {
      try {
        lastFocus.focus();
      } catch (e) {}
    }
  }

  function positionByRect(rect) {
    if (!cardOpen()) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = Math.min(420, Math.max(160, Math.floor(vw * 0.92)), vw - 12);
    card.style.width = w + "px";
    var box = card.getBoundingClientRect();
    var anchor = rect;
    if (!anchor || (!anchor.top && !anchor.left && !anchor.width && !anchor.height)) {
      var hb = C.hist ? C.hist.getBoundingClientRect() : { left: 16, top: 80, bottom: 110 };
      anchor = { left: hb.left, top: hb.top, bottom: hb.bottom };
    }
    var left = Math.min(Math.max(8, anchor.left), Math.max(8, vw - w - 8));
    var below = anchor.bottom + 8;
    var above = anchor.top - box.height - 8;
    var top = below + box.height <= vh - 8 ? below : Math.max(8, above);
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function contextOf(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    var box = null;
    try {
      box = el && el.closest
        ? el.closest(".lk-ex, .lk-sense, .lk-foldbody, .lk-trans, p, li, blockquote, .qtext, .pbody")
        : null;
    } catch (e) {}
    var t = box ? box.textContent : "";
    return String(t).replace(/\s+/g, " ").trim().slice(0, 300);
  }

  /* ======================================================================
     LỊCH SỬ — BẢNG TRONG THẺ
     ====================================================================== */
  function toggleHistory(btn) {
    if (!C.historyPanel) return;
    if (!C.historyPanel.classList.contains("lk-hide")) {
      C.historyPanel.classList.add("lk-hide");
      return;
    }
    histAll().then(function (list) {
      histList = (list || [])
        .filter(function (x) {
          return x && x.uid === uid && x.schemaVersion === SCHEMA_VERSION;
        })
        .sort(function (a, b) {
          return (b.lastAt || 0) - (a.lastAt || 0);
        })
        .slice(0, MAX_HISTORY);
      renderHistory();
      C.historyPanel.classList.remove("lk-hide");
      live("Đã mở tra gần đây");
    });
  }

  function renderHistory() {
    var box = C.historyPanel;
    clear(box);
    var head = h("div", "lk-top");
    head.appendChild(h("strong", "", "🕘 Tra gần đây"));
    var clearBtn = h("button", "lk-btn lk-mini", "Xóa lịch sử");
    clearBtn.type = "button";
    clearBtn.setAttribute("data-lk", "hist-clear");
    head.appendChild(clearBtn);
    box.appendChild(head);
    if (!histList.length) {
      box.appendChild(h("p", "lk-note", "Chưa có từ nào được tra trên tài khoản này."));
      return;
    }
    histList.forEach(function (rec, i) {
      var btn = h("button", "lk-hitem");
      btn.type = "button";
      btn.setAttribute("data-lk", "hist-item");
      btn.setAttribute("data-i", String(i));
      btn.appendChild(h("b", "", rec.text));
      var mean = rec.tier1 && rec.tier1.translation ? rec.tier1.translation.primary : "";
      if (mean) btn.appendChild(h("span", "lk-muted", mean));
      if ((rec.count || 0) >= 2) btn.appendChild(h("span", "lk-count", rec.count + " lần"));
      box.appendChild(btn);
    });
  }

  function openHistory(i) {
    var rec = histList[i];
    if (!rec) return;
    var fresh = isFresh(rec, Date.now(), FRESH_MS);
    var hb = C.hist ? C.hist.getBoundingClientRect() : null;
    if (fresh && rec.tier1) {
      openView(rec.text, rec.context || "", false, rec, hb);
    } else {
      openView(rec.text, "", false, null, hb);
    }
  }

  /* ======================================================================
     PHÁT ÂM
     ====================================================================== */
  function ensureVoices() {
    if (!("speechSynthesis" in window)) return;
    loadVoices();
    try {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    } catch (e) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function loadVoices() {
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch (e) {
      voices = [];
    }
  }

  function speakText(text, rate, lang) {
    if (!("speechSynthesis" in window)) {
      toast("Thiết bị này chưa hỗ trợ đọc thành tiếng.");
      return false;
    }
    var value = String(text || "").trim();
    if (!value) return false;
    var useLang = lang || detectLang(value);
    if (useLang.toLowerCase().indexOf("en") === 0) useLang = opts.accent || "en-US";
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
    var parts = value.match(/[^.!?;\n]+[.!?;]?/g) || [value];
    var picked = chooseVoice(voices, useLang);
    if (!picked && useLang.toLowerCase().indexOf("en") === 0) {
      toast(voices.length
        ? "Máy chưa có giọng tiếng Anh — sẽ dùng giọng mặc định, nghe có thể không chuẩn."
        : "Máy chưa có giọng đọc nào — thêm giọng tiếng Anh trong cài đặt trình duyệt.");
    }
    parts.forEach(function (raw) {
      var p = raw.trim();
      if (!p) return;
      var u = new SpeechSynthesisUtterance(p);
      u.lang = useLang;
      u.rate = Number(rate) || Number(opts.rate) || 1;
      if (picked) u.voice = picked;
      window.speechSynthesis.speak(u);
    });
    live("Đang đọc " + value.slice(0, 80));
    return true;
  }

  function speakTop(slow) {
    var view = top();
    if (!view) return;
    var b = view.basic || {};
    var text = b.text || view.text;
    var rate = slow ? 0.6 : Number(opts.rate) || 1;
    var audio = !slow && view.kind === "word" && b.phonetic && b.phonetic.audioUrl;
    if (audio) {
      try {
        var a = new Audio(b.phonetic.audioUrl);
        var p = a.play();
        if (p && p.catch) p.catch(function () { speakText(text, rate); });
        return;
      } catch (e) {}
    }
    speakText(text, rate);
  }

  /* ======================================================================
     NÚT NỔI CHO THIẾT BỊ CHẠM
     ====================================================================== */
  function buildFloat() {
    floatEl = h("div", "lk-float lk-hide");
    floatEl.innerHTML =
      '<button class="lk-btn lk-primary" type="button" data-lk="f-translate">Dịch</button>' +
      '<button class="lk-btn" type="button" data-lk="f-speak" aria-label="Nghe phát âm">🔊</button>';
    document.body.appendChild(floatEl);
    F.translate = floatEl.querySelector('[data-lk="f-translate"]');
    F.speak = floatEl.querySelector('[data-lk="f-speak"]');
    floatEl.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    F.translate.addEventListener("click", function () {
      if (!floatSel) return;
      var s = floatSel;
      hideFloat();
      openView(s.text, contextOf(s.node), false, null, s.rect);
    });
    F.speak.addEventListener("click", function () {
      if (!floatSel) return;
      speakText(floatSel.text, Number(opts.rate) || 1);
      hideFloat();
    });
  }

  function isTouch() {
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return coarse || window.innerWidth < 720;
  }

  function showFloat(sel) {
    floatSel = sel;
    var r = sel.rect;
    var width = 132;
    var left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    var top = r.bottom + 6;
    if (top + 40 > window.innerHeight - 8) top = Math.max(8, r.top - 46);
    floatEl.style.left = Math.round(left) + "px";
    floatEl.style.top = Math.round(top) + "px";
    floatEl.classList.remove("lk-hide");
  }

  function hideFloat() {
    if (floatEl) floatEl.classList.add("lk-hide");
  }

  function selInfo() {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var text = String(sel).replace(/\s+/g, " ").trim();
    if (!text) return null;
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    var node = sel.anchorNode;
    return { text: text, rect: rect, node: node, inCard: !!(card && node && card.contains(node)) };
  }

  function onSelectionChange() {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      if (!opts.enabled || reviewOpen()) {
        hideFloat();
        return;
      }
      var s = selInfo();
      if (!s || s.inCard || !isTouch()) {
        hideFloat();
        return;
      }
      showFloat(s);
    }, 250);
  }

  function isTyping() {
    var ae = document.activeElement;
    if (!ae) return false;
    var get = ae.getAttribute ? ae.getAttribute.bind(ae) : function () { return null; };
    return isTextEntry(
      ae.tagName,
      get("type"),
      !!(ae.readOnly || ae.disabled),
      !!ae.isContentEditable,
      get("data-lk-capture") === "1"
    );
  }

  function onKey(e) {
    if (!opts.enabled || e.repeat) return;
    if (isTyping() && !opts.inInputs) return;
    if (e.key === "Escape" && (cardOpen() || reviewOpen())) {
      e.preventDefault();
      if (reviewOpen()) closeReview();
      else closeCard();
      return;
    }
    if (matchBinding(e, parseBinding(keys.translate))) {
      var s = selInfo();
      if (cardOpen() && s && s.inCard) {
        e.preventDefault();
        nestedLookup(s.text, contextOf(s.node));
        return;
      }
      if (s) {
        e.preventDefault();
        openView(s.text, contextOf(s.node), false, null, s.rect);
        hideFloat();
        return;
      }
      if (cardOpen()) {
        e.preventDefault();
        closeCard();
      }
      return;
    }
    if (matchBinding(e, parseBinding(keys.speak))) {
      var s2 = selInfo();
      if (s2) {
        e.preventDefault();
        speakText(s2.text, Number(opts.rate) || 1);
        hideFloat();
      } else if (cardOpen()) {
        e.preventDefault();
        speakTop(false);
      }
    }
  }

  function bindGlobals() {
    if (listenersCtl) return;
    listenersCtl = new AbortController();
    var sig = { signal: listenersCtl.signal };
    document.addEventListener("keydown", onKey, true, sig);
    document.addEventListener("selectionchange", onSelectionChange, sig);
    window.addEventListener("scroll", hideFloat, true, sig);
    window.addEventListener("resize", hideFloat, sig);
    window.addEventListener("toeic:user", function (e) {
      var next = (e && e.detail && e.detail.id) || 0;
      if (next === uid) return;
      uid = next;
      /* Lịch sử tra gắn theo tài khoản: đổi người thì phải đóng thẻ và bỏ
         danh sách đang hiển thị, không để lộ từ của người trước. */
      closeCard();
      histList = [];
      refreshDue();
    }, sig);
  }

  function applyEnabled() {
    if (opts.enabled) bindGlobals();
    else {
      if (listenersCtl) {
        listenersCtl.abort();
        listenersCtl = null;
      }
      closeCard();
      hideFloat();
    }
  }

  /* ======================================================================
     TÀI KHOẢN + SỐ THẺ ĐẾN HẠN
     ====================================================================== */
  function refreshUser() {
    if (!API) {
      uid = 0;
      refreshDue();
      return;
    }
    fetch("/api/auth/me")
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        uid = (j && j.user && j.user.id) || 0;
        refreshDue();
      })
      .catch(function () {
        refreshDue();
      });
  }

  function refreshDue() {
    if (!API) {
      setBadge("");
      return;
    }
    fetch("/api/words/due?limit=1&tz=" + encodeURIComponent(tzName()))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok) return;
        var btn = document.getElementById("lkBtnReview");
        if (btn) {
          btn.textContent = j.saved
            ? "📖 Ôn từ đã lưu (" + j.total + " đến hạn)"
            : "📖 Ôn từ đã lưu";
        }
        setBadge(j.saved ? "Đã lưu " + j.saved + " từ · " + j.total + " thẻ đến hạn hôm nay." : "Chưa lưu từ nào.");
      })
      .catch(noop);
  }

  function setBadge(text) {
    var badge = document.getElementById("lkDueBadge");
    if (badge) badge.textContent = text;
  }

  /* ======================================================================
     MÀN ÔN
     ====================================================================== */
  function buildReview() {
    reviewMask = h("div", "lk-mask lk-hide");
    reviewMask.innerHTML =
      '<div class="lk-review" role="dialog" aria-modal="true" aria-label="Ôn từ đã lưu">' +
      '  <div class="lk-top">' +
      '    <strong>📖 Ôn từ đã lưu</strong>' +
      '    <span class="lk-progress" aria-live="polite"></span>' +
      '    <button class="lk-btn lk-mini" type="button" data-rv="close" aria-label="Đóng">✕</button>' +
      "  </div>" +
      '  <div class="lk-rvbody"></div>' +
      '  <p class="lk-hint">Space: hiện đáp án · 1 Quên · 2 Mơ hồ · 3 Nhớ · Esc đóng</p>' +
      "</div>";
    document.body.appendChild(reviewMask);
    RVel.body = reviewMask.querySelector(".lk-rvbody");
    RVel.progress = reviewMask.querySelector(".lk-progress");
    reviewMask.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-rv]") : null;
      if (!el) {
        if (e.target === reviewMask) closeReview();
        return;
      }
      var act = el.getAttribute("data-rv");
      if (act === "close") closeReview();
      else if (act === "speak") {
        var it = currentCard();
        if (it) speakText(it.text, Number(opts.rate) || 1);
      } else if (act === "reveal") reveal();
      else if (act === "rate") rate(el.getAttribute("data-r") || "");
      else if (act === "deep") {
        var cur = currentCard();
        if (cur) {
          closeReview();
          openView(cur.text, cur.context || "", false, null, null);
        }
      } else if (act === "again") openReview();
    });
  }

  function currentCard() {
    if (!RV || RV.done) return null;
    return RV.items[RV.i] || null;
  }

  function openReview() {
    if (!reviewMask) return;
    reviewFocus = document.activeElement;
    reviewMask.classList.remove("lk-hide");
    closeCard();
    RV = {
      items: [],
      i: 0,
      revealed: false,
      stats: { know: 0, unsure: 0, forgot: 0 },
      xu: 0, // xu nhóm 'words' phiên này thưởng (server quyết định, giao diện chỉ tổng kết)
      wallet: null,
      retry: [],
      mode: "main",
      total: 0,
      saved: 0,
      nextDueAt: null,
      done: false,
      loading: true,
      busy: false,
    };
    renderReview();
    if (!API) {
      RV.loading = false;
      RV.error = "Cần chạy qua server để ôn từ đã lưu.";
      renderReview();
      return;
    }
    fetch("/api/words/due?limit=" + (Number(opts.sessionCards) || 20) + "&tz=" + encodeURIComponent(tzName()))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        RV.loading = false;
        if (!j || !j.ok) {
          RV.error = "Chưa tải được sổ từ.";
          return renderReview();
        }
        RV.items = Array.isArray(j.due) ? j.due : [];
        RV.total = j.total || 0;
        RV.saved = j.saved || 0;
        RV.nextDueAt = j.nextDueAt || null;
        renderReview();
      })
      .catch(function () {
        RV.loading = false;
        RV.error = "Không kết nối được máy chủ.";
        renderReview();
      });
  }

  function closeReview() {
    if (!reviewMask) return;
    reviewMask.classList.add("lk-hide");
    RV = null;
    refreshDue();
    if (reviewFocus && reviewFocus.focus) {
      try {
        reviewFocus.focus();
      } catch (e) {}
    }
  }

  function renderReview() {
    if (!RV || !RVel.body) return;
    clear(RVel.body);
    RVel.progress.textContent = "";
    if (RV.loading) {
      RVel.body.appendChild(h("p", "lk-note", "Đang tải thẻ đến hạn…"));
      return;
    }
    if (RV.error) {
      RVel.body.appendChild(h("p", "lk-note lk-error", RV.error));
      return;
    }
    if (RV.done) {
      var box = h("div", "lk-rvdone");
      box.appendChild(h("p", "", "Xong phiên ôn!"));
      box.appendChild(h("p", "lk-note", "😀 Nhớ " + RV.stats.know + " · 😐 Mơ hồ " + RV.stats.unsure + " · 😞 Quên " + RV.stats.forgot));
      box.appendChild(h("p", "lk-note", xuSessionLine()));
      var again = h("button", "lk-btn lk-primary", "Ôn tiếp");
      again.type = "button";
      again.setAttribute("data-rv", "again");
      box.appendChild(again);
      RVel.body.appendChild(box);
      return;
    }
    if (!RV.items.length) {
      var empty = h("div", "lk-rvempty");
      empty.appendChild(h("p", "", RV.saved ? "Hôm nay không còn thẻ đến hạn." : "Sổ từ đang trống."));
      if (RV.nextDueAt) {
        empty.appendChild(h("p", "lk-note", "Thẻ kế tiếp đến hạn: " + fmtTime(RV.nextDueAt)));
      } else if (!RV.saved) {
        empty.appendChild(h("p", "lk-note", "Bôi đen từ trong đề rồi bấm Alt+Z, sau đó bấm “💾 Lưu vào sổ từ”."));
      }
      RVel.body.appendChild(empty);
      return;
    }
    var it = RV.items[RV.i];
    if (!it) {
      RV.done = true;
      return renderReview();
    }
    RVel.progress.textContent =
      "Thẻ " + (RV.i + 1) + "/" + RV.items.length + (RV.mode === "retry" ? " · ôn lại" : "");
    if (RV.mode === "retry") RVel.body.appendChild(h("p", "lk-note", "Lượt ôn lại — không đổi lịch."));
    var front = h("div", "lk-rvfront");
    var word = h("div", "lk-rvword", it.text);
    front.appendChild(word);
    var speak = h("button", "lk-btn", "🔊 Nghe");
    speak.type = "button";
    speak.setAttribute("data-rv", "speak");
    front.appendChild(speak);
    RVel.body.appendChild(front);
    if (!RV.revealed) {
      var revealBtn = h("button", "lk-btn lk-primary", "Hiện đáp án (Space)");
      revealBtn.type = "button";
      revealBtn.setAttribute("data-rv", "reveal");
      RVel.body.appendChild(revealBtn);
      return;
    }
    var back = h("div", "lk-rvback");
    back.appendChild(h("p", "lk-rvmean", it.meaning || "Chưa có nghĩa tiếng Việt."));
    if (it.ipa) back.appendChild(h("p", "lk-note", it.ipa));
    if (it.context) back.appendChild(h("p", "lk-ex", it.context));
    if (!it.__retry) {
      var deepBtn = h("button", "lk-btn", "🤖 Xem phân tích sâu");
      deepBtn.type = "button";
      deepBtn.setAttribute("data-rv", "deep");
      back.appendChild(deepBtn);
    }
    RVel.body.appendChild(back);
    var row = h("div", "lk-rvrate");
    [
      { r: "forgot", t: "😞 Quên (1)" },
      { r: "unsure", t: "😐 Mơ hồ (2)" },
      { r: "know", t: "😀 Nhớ (3)" },
    ].forEach(function (x) {
      var b = h("button", "lk-btn", x.t);
      b.type = "button";
      b.setAttribute("data-rv", "rate");
      b.setAttribute("data-r", x.r);
      row.appendChild(b);
    });
    RVel.body.appendChild(row);
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    } catch (e) {
      return iso;
    }
  }

  function reveal() {
    if (!RV || RV.loading || RV.done || !currentCard()) return;
    RV.revealed = true;
    renderReview();
    live("Đã hiện đáp án");
  }

  function rate(rating) {
    if (!RV || RV.loading || RV.done || RV.busy) return;
    var it = currentCard();
    if (!it || ["know", "unsure", "forgot"].indexOf(rating) < 0) return;
    if (it.__retry) return advance();
    if (!API) {
      toast("Cần chạy qua server để ghi lịch ôn.");
      return;
    }
    RV.busy = true;
    fetch("/api/words/" + encodeURIComponent(it.id) + "/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: rating, tz: tzName() }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        RV.busy = false;
        if (!j || !j.ok) {
          toast((j && j.message) || "Chưa ghi được kết quả ôn.");
          return;
        }
        RV.stats[rating] = (RV.stats[rating] || 0) + 1;
        /* +1 xu/thẻ, trừ khi đã chạm trần nhóm 'words' (server trả reward = 0). Lịch ôn vẫn ghi đủ. */
        var gift = (j.xu && j.xu.reward) || 0;
        RV.xu = (RV.xu || 0) + gift;
        if (j.xu && typeof j.xu.balance === "number") RV.wallet = j.xu.balance;
        live(
          gift
            ? "🪙 +" + gift + " xu" + (RV.wallet == null ? "" : " (ví " + RV.wallet + " xu)")
            : "Hôm nay vòng ôn từ đã đủ xu rồi. Bạn vẫn có thể ôn tiếp để nhớ lâu hơn."
        );
        if (rating === "forgot") {
          var again = {};
          for (var k in it) again[k] = it[k];
          again.__retry = true;
          RV.retry.push(again);
        }
        advance();
      })
      .catch(function () {
        RV.busy = false;
        toast("Không kết nối được máy chủ.");
      });
  }

  function advance() {
    RV.i++;
    RV.revealed = false;
    if (RV.i < RV.items.length) {
      renderReview();
      live("Thẻ " + (RV.i + 1) + "/" + RV.items.length);
      return;
    }
    if (RV.mode === "main" && RV.retry.length) {
      RV.items = RV.retry;
      RV.retry = [];
      RV.mode = "retry";
      RV.i = 0;
      renderReview();
      return;
    }
    RV.done = true;
    renderReview();
    refreshDue();
    live("Xong phiên ôn");
  }

  function onReviewKey(e) {
    if (!reviewOpen()) return;
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || "")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeReview();
    } else if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      reveal();
    } else if (e.code === "Digit1" || e.key === "1") {
      e.preventDefault();
      rate("forgot");
    } else if (e.code === "Digit2" || e.key === "2") {
      e.preventDefault();
      rate("unsure");
    } else if (e.code === "Digit3" || e.key === "3") {
      e.preventDefault();
      rate("know");
    }
  }

  /* ======================================================================
     CÀI ĐẶT
     ====================================================================== */
  function bindSettings() {
    var checks = {
      lkEnabled: "enabled",
      lkDeepWord: "deepWord",
      lkDeepSent: "deepSentence",
      lkInInput: "inInputs",
      lkHistory: "history",
      lkSavePrompt: "savePrompt",
      lkAutoSave: "autoSave",
      lkConfusable: "confusables",
    };
    Object.keys(checks).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var key = checks[id];
      el.checked = !!opts[key];
      el.addEventListener("change", function () {
        opts[key] = el.checked;
        saveOpts();
        if (key === "enabled") applyEnabled();
        if (key === "history" && !el.checked) {
          clearHistory();
        }
      });
    });
    var selects = {
      lkAccent: ["accent", String],
      lkRate: ["rate", Number],
      lkThreshold: ["saveThreshold", Number],
      lkCards: ["sessionCards", Number],
    };
    Object.keys(selects).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var spec = selects[id];
      el.value = String(opts[spec[0]]);
      el.addEventListener("change", function () {
        opts[spec[0]] = spec[1](el.value);
        saveOpts();
      });
    });
    var kz = document.getElementById("lkKeyZ");
    var kx = document.getElementById("lkKeyX");
    if (kz) bindKeyInput(kz, "translate");
    if (kx) bindKeyInput(kx, "speak");
    var reset = document.getElementById("lkKeyReset");
    if (reset) {
      reset.addEventListener("click", function () {
        keys = { translate: DEFAULT_KEYS.translate, speak: DEFAULT_KEYS.speak };
        saveKeys();
        if (kz) kz.value = fmtBinding(parseBinding(keys.translate));
        if (kx) kx.value = fmtBinding(parseBinding(keys.speak));
        setMsg("Đã về phím mặc định Alt+Z / Alt+X.");
      });
    }
    var hc = document.getElementById("lkHistClear");
    if (hc) {
      hc.addEventListener("click", function () {
        clearHistory().then(function () {
          setMsg("Đã xóa lịch sử tra trên máy này.");
        });
      });
    }
    var reviewBtn = document.getElementById("lkBtnReview");
    if (reviewBtn) {
      reviewBtn.addEventListener("click", function () {
        if (reviewOpen()) closeReview();
        else openReview();
      });
    }
  }

  function bindKeyInput(input, which) {
    input.readOnly = true;
    input.setAttribute("data-lk-capture", "1");
    input.value = fmtBinding(parseBinding(keys[which]));
    input.addEventListener("keydown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Tab" || e.key === "Escape") return;
      if (!e.code || /^(Alt|Control|Meta|Shift)/.test(e.code)) return;
      var b = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, code: e.code };
      if (!b.alt && !b.ctrl && !b.meta) {
        setMsg("Cần ít nhất một phím bổ trợ (Alt / Ctrl / Cmd).");
        return;
      }
      var str = fmtBinding(b);
      var other = which === "translate" ? keys.speak : keys.translate;
      if (str === other) {
        setMsg("Tổ hợp này trùng phím kia — chọn tổ hợp khác.");
        return;
      }
      keys[which] = str;
      saveKeys();
      input.value = str;
      setMsg("Đã lưu phím mới.");
    });
  }

  function setMsg(text) {
    var el = document.getElementById("lkMsg");
    if (el) el.textContent = text;
  }

  /* ======================================================================
     KHỞI ĐỘNG
     ====================================================================== */
  function buildToast() {
    liveEl = h("div", "lk-sr");
    liveEl.setAttribute("aria-live", "polite");
    document.body.appendChild(liveEl);
    toastEl = h("div", "lk-toast lk-hide");
    toastEl.setAttribute("role", "status");
    document.body.appendChild(toastEl);
  }

  function start() {
    if (started) return;
    started = true;
    buildToast();
    buildCard();
    buildFloat();
    buildReview();
    bindSettings();
    document.addEventListener("keydown", onReviewKey, true);
    applyEnabled();
    refreshUser();
    ensureVoices();
    var histBtn = document.getElementById("lkHistClear");
    if (histBtn) histBtn.classList.remove("lk-hide");
  }

  api.start = start;
  api.openReview = openReview;
  api.openView = openView;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  return api;
});
