"use strict";

/* ==========================================================================
   LÕI TRA CỨU BÔI ĐEN (dùng chung server + test, client giữ bản rút gọn)
   - Chuẩn hóa văn bản trước khi băm cache
   - Phân loại word / phrase / sentence
   - Kiểm tra schema JSON do AI trả về (cắt độ dài, bỏ kiểu sai)
   - Khớp cặp từ dễ nhầm (dữ liệu soạn tay)
   - Lịch ôn Leitner 6 hộp và hạn ôn theo NGÀY ĐỊA PHƯƠNG của người dùng
   ========================================================================== */

const crypto = require("crypto");
const fs = require("fs");

const SCHEMA_VERSION = 1;
const INTERVALS = [1, 3, 7, 14, 30, 60];
const MAX_BASIC = 500;
const MAX_DEEP = 300;

/* Ký tự cắt ở hai đầu vùng chọn. Dùng chuỗi + vòng lặp để không phải lo
   regex lớp ký tự lồng ngoặc. */
const EDGE = " \t\n\r\"'“”‘’()[]{}<>.,;:!?…—–-";

function stripEdges(s) {
  let a = 0;
  let b = s.length;
  while (a < b && EDGE.indexOf(s[a]) >= 0) a++;
  while (b > a && EDGE.indexOf(s[b - 1]) >= 0) b--;
  return s.slice(a, b);
}

/* Cắt khoảng trắng, gộp khoảng trắng, bỏ dấu câu hai đầu, hạ chữ thường CHỈ với
   từ đơn (câu giữ nguyên chữ hoa để không đổi nghĩa). */
function normalizeText(input) {
  let s = String(input == null ? "" : input).replace(/\s+/g, " ").trim();
  s = stripEdges(s).replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.indexOf(" ") < 0 ? s.toLowerCase() : s;
}

function wordCount(input) {
  const s = String(input == null ? "" : input).trim();
  return s ? s.split(/\s+/).length : 0;
}

function kindOf(input) {
  const n = wordCount(normalizeText(input));
  if (n <= 1) return "word";
  if (n <= 3) return "phrase";
  return "sentence";
}

/* Băm nội dung: KHÔNG kèm tài khoản để mọi người dùng chung cache. */
function contentHash(args) {
  const o = args || {};
  const version = o.version == null ? SCHEMA_VERSION : o.version;
  const scope = (o.src || "auto") + ">" + (o.dst || "vi");
  return crypto
    .createHash("sha256")
    .update([version, o.layer, scope, o.text].join("|"), "utf8")
    .digest("hex");
}

/* ---------- làm sạch dữ liệu AI ---------- */

function clipText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function asList(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function stringList(value, max, len) {
  return asList(value, max)
    .map((x) => clipText(x, len))
    .filter(Boolean);
}

function objectList(value, max) {
  return asList(value, max).filter((x) => x && typeof x === "object" && !Array.isArray(x));
}

function readExamples(value, max) {
  return objectList(value, max)
    .map((e) => ({ en: clipText(e.en, 220), vi: clipText(e.vi, 220) }))
    .filter((e) => e.en);
}

function readSenses(value) {
  return objectList(value, 5)
    .map((s) => ({
      pos: clipText(s.pos, 30),
      meaningVi: clipText(s.meaningVi, 220),
      meaningEn: clipText(s.meaningEn, 320),
      examples: readExamples(s.examples, 3),
    }))
    .filter((s) => s.meaningVi || s.meaningEn);
}

function validateWordDeep(raw) {
  const toeicRaw = raw.toeic && typeof raw.toeic === "object" ? raw.toeic : {};
  const data = {
    senses: readSenses(raw.senses),
    collocations: stringList(raw.collocations, 10, 80),
    wordFamily: objectList(raw.wordFamily, 10)
      .map((w) => ({ word: clipText(w.word, 60), pos: clipText(w.pos, 30) }))
      .filter((w) => w.word),
    synonyms: stringList(raw.synonyms, 12, 50),
    antonyms: stringList(raw.antonyms, 12, 50),
    commonMistakes: stringList(raw.commonMistakes, 6, 260),
    toeic: {
      likelyParts: stringList(toeicRaw.likelyParts, 4, 20),
      note: clipText(toeicRaw.note, 320),
    },
  };
  if (!data.senses.length) {
    return { ok: false, error: "AI không trả nghĩa nào cho từ/cụm" };
  }
  return { ok: true, data };
}

function validateSentenceDeep(raw) {
  const data = {
    translationNatural: clipText(raw.translationNatural, 1200),
    structure: objectList(raw.structure, 8)
      .map((s) => ({ role: clipText(s.role, 40), text: clipText(s.text, 320) }))
      .filter((s) => s.text),
    tense: clipText(raw.tense, 140),
    grammarPoints: stringList(raw.grammarPoints, 6, 260),
    difficultWords: objectList(raw.difficultWords, 12)
      .map((w) => ({ word: clipText(w.word, 60), meaning: clipText(w.meaning, 180) }))
      .filter((w) => w.word),
  };
  if (!data.translationNatural && !data.structure.length && !data.grammarPoints.length) {
    return { ok: false, error: "AI không trả nội dung phân tích câu" };
  }
  return { ok: true, data };
}

function validateDeep(raw, kind) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "AI trả về không đúng cấu trúc JSON" };
  }
  return kind === "sentence" ? validateSentenceDeep(raw) : validateWordDeep(raw);
}

/* ---------- cặp từ dễ nhầm (tệp soạn tay, 0 token) ---------- */

function parseConfusables(text) {
  const doc = JSON.parse(text);
  const groups = Array.isArray(doc && doc.groups) ? doc.groups : [];
  return groups
    .map((g) => {
      if (!g || typeof g.id !== "string") return null;
      const words = objectList(g.words, 4)
        .map((w) => ({
          w: clipText(w.w, 40).toLowerCase(),
          forms: stringList(w.forms, 10, 40).map((f) => f.toLowerCase()),
          pos: clipText(w.pos, 30),
          vi: clipText(w.vi, 120),
        }))
        .filter((w) => w.w);
      if (words.length < 2) return null;
      return {
        id: g.id.slice(0, 40),
        words,
        tip: clipText(g.tip, 300),
        examples: stringList(g.examples, 4, 220),
      };
    })
    .filter(Boolean);
}

function loadConfusables(file, warn) {
  try {
    return parseConfusables(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (warn) warn("[lookup] bỏ qua data/confusables.json: " + err.message);
    return [];
  }
}

/* Chỉ khớp từ đơn; một từ thuộc nhiều nhóm thì trả tối đa 2 nhóm. */
function confusableMatches(groups, input) {
  const text = normalizeText(input).toLowerCase();
  if (!text || text.indexOf(" ") >= 0) return [];
  const out = [];
  for (const g of groups || []) {
    const hit = g.words.some((w) => w.w === text || (w.forms || []).indexOf(text) >= 0);
    if (hit) out.push(g);
    if (out.length >= 2) break;
  }
  return out;
}

/* ---------- lịch ôn Leitner ---------- */

function nextState(box, rating) {
  const b = Math.max(0, Math.min(INTERVALS.length - 1, Math.floor(Number(box) || 0)));
  if (rating === "know") {
    const next = Math.min(b + 1, INTERVALS.length - 1);
    return { box: next, days: INTERVALS[next] };
  }
  if (rating === "unsure") {
    return { box: b, days: Math.max(1, Math.round(INTERVALS[b] / 2)) };
  }
  if (rating === "forgot") return { box: 0, days: 1, lapse: true };
  return null;
}

/* ---------- hạn ôn theo ngày địa phương ---------- */

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch (err) {
    return false;
  }
}

function tzOf(tz) {
  if (isValidTimeZone(tz)) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (err) {
    return "UTC";
  }
}

function partsIn(tz, date) {
  const p = {};
  const list = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  list.forEach((x) => {
    p[x.type] = x.value;
  });
  if (p.hour === "24") p.hour = "0";
  return p;
}

/* 00:00 của ngày (y,m,d) theo múi giờ tz, trả về Date UTC tương ứng. */
function zonedMidnight(y, m, d, tz) {
  const target = Date.UTC(y, m - 1, d);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(tz, new Date(guess));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += target - asUtc;
  }
  return new Date(guess);
}

/* Hẹn `days` ngày sau, vào 00:00 ngày địa phương kế tiếp. */
function dueAtFromNow(tz, days, now) {
  const zone = tzOf(tz);
  const p = partsIn(zone, now ? new Date(now) : new Date());
  return zonedMidnight(+p.year, +p.month, +p.day + Math.max(0, Math.floor(Number(days) || 0)), zone);
}

module.exports = {
  SCHEMA_VERSION,
  INTERVALS,
  MAX_BASIC,
  MAX_DEEP,
  normalizeText,
  wordCount,
  kindOf,
  contentHash,
  validateDeep,
  parseConfusables,
  loadConfusables,
  confusableMatches,
  nextState,
  isValidTimeZone,
  tzOf,
  dueAtFromNow,
  zonedMidnight,
};
