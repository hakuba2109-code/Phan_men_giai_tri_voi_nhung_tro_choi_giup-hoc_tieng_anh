/* Ghép html/template.html + các module trong scripts/ + ngân hàng câu hỏi thành toeic-game.html chạy được một mình.
   node scripts/build.js              -> lấy câu hỏi từ PostgreSQL (nếu kết nối được), không thì dùng json/seed.json
   node scripts/build.js --from-seed  -> luôn dùng json/seed.json
   Kết quả ghi vào html/toeic-game.html (bản gốc) và public/toeic-game.html (bản server phục vụ). */
const fs = require("fs");
const path = require("path");
const SKILL_EXTRA = require("./skill-extra.js");

const ROOT = path.join(__dirname, "..");
/* Gốc của các trang: dự án từng đặt template trong html/, nay đã chuyển hết vào public/.
   Còn thư mục html/ thì dùng như cũ (vừa ghi bản gốc vừa ghi public/), không thì chỉ có public/. */
const SRC_DIR = fs.existsSync(path.join(ROOT, "html")) ? path.join(ROOT, "html") : path.join(ROOT, "public");
const TEMPLATE = path.join(SRC_DIR, "template.html");
const SEED_FILE = path.join(ROOT, "json", "seed.json");
const OUT_DIRS = [...new Set([SRC_DIR, path.join(ROOT, "public")])];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

/* Rút gọn rỗng (bỏ chú thích, gộp khoảng trắng) cho ba file của Mê cung kho báu
   để phần thêm vào toeic-game.html dưới 60 KB. Không đổi chuỗi, không đổi tên biến. */
const WORD = /[A-Za-z0-9_$]/;
const PUNCT = "{}()[];,:=!?&|+-*%<>~^";
function minify(src) {
  let out = "", i = 0, state = "n";
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (state === "n") {
      if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i++; continue; }
      if (/\s/.test(c)) {
        let j = i;
        while (j < n && /\s/.test(src[j])) j++;
        const a = out[out.length - 1], b = src[j];
        let drop = false;
        if (a && b && (PUNCT.indexOf(a) >= 0 || PUNCT.indexOf(b) >= 0)) drop = true;
        if ((a === "+" && b === "+") || (a === "-" && b === "-")) drop = false;
        if (b === "/" && a && WORD.test(a)) drop = false;
        if (a === "/" && (b === "/" || b === "*")) drop = false;
        const noNl = src.slice(i, j).indexOf("\n") < 0;
        if (!drop && noNl && a && b) {
          if (a === "}" && WORD.test(b)) drop = true;
          else if (WORD.test(a) && (b === "{" || b === "(")) drop = true;
        }
        if (!drop) out += " ";
        i = j;
        continue;
      }
      if (c === ";") {
        let j = i + 1;
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === "}") {
          let k = out.length - 1;
          while (k >= 0 && out[k] === " ") k--;
          const e = k + 1;
          while (k >= 0 && WORD.test(out[k])) k--;
          const kw = out.slice(k + 1, e);
          if (!/^(return|break|continue|throw|debugger|do)$/.test(kw)) { i++; continue; }
        }
      }
      out += c; i++; continue;
    }
    if (c === "\\") { out += c + (src[i + 1] || ""); i += 2; continue; }
    out += c; i++;
    if (c === state) state = "n";
  }
  return out;
}
function jsBundle(rels) {
  return rels
    .map((rel) => {
      const src = read(path.join(ROOT, rel));
      const small = minify(src);
      try {
        new Function(small);
      } catch (err) {
        throw new Error("Rút gọn hỏng " + rel + ": " + err.message);
      }
      return small;
    })
    .join("\n");
}
function dungeonBundle() {
  return jsBundle(["src/dungeon-core.js", "src/dungeon-rules.js", "dungeon.js"]);
}
/* Luật thị trấn chạy cả ở máy chủ lẫn trình duyệt nên phải là MỘT bản:
   town-core.js (rules) + town3d.js (cảnh 3D, chỉ dùng THREE khi mở tab). */
function townBundle() {
  return jsBundle(["src/town-core.js", "src/town3d.js"]);
}

function loadSeedFile() {
  if (!fs.existsSync(SEED_FILE)) return { questions: [], topics: [] };
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}

async function loadFromDb() {
  if (process.argv.includes("--from-seed")) return null;
  try {
    require("dotenv").config({ path: path.join(ROOT, ".env") });
    const importer = require(path.join(ROOT, "src", "importer"));
    const [questions, files] = await Promise.all([importer.listQuestions(), importer.listFiles()]);
    const topics = await importer.listTopics();
    await require(path.join(ROOT, "src", "db")).close();
    if (!questions.length) return null;
    return { questions, files, topics };
  } catch (err) {
    console.warn("[build] không đọc được PostgreSQL (" + err.message + "), dùng json/seed.json.");
    return null;
  }
}

(async function main() {
  const fromDb = await loadFromDb();
  const seed = fromDb || loadSeedFile();
  if (!seed.questions || !seed.questions.length) throw new Error("Ngân hàng câu hỏi rỗng. Chạy: node scripts/ingest.js");
  if (!fromDb) console.warn("[build] dùng seed.json trên đĩa:", seed.questions.length, "câu");

  const inline = seed.questions.map((q) => ({
    id: q.id, t: q.t, q: q.q, o: q.o, a: q.a, n: q.n || "", s: q.s || "main",
    num: q.num == null ? null : q.num, f: q.f == null ? null : q.f, qt: q.qtype || "mcq",
    qtype: q.qtype || "mcq", skill: q.skill || "reading", subject: q.subject || "toeic",
    difficulty: q.difficulty || 1, passage: q.passage || null,
    audioUrl: q.audioUrl || null, payload: q.payload || {},
    status: q.status || "ok", reviewReasons: q.reviewReasons || [],
    explanation: q.explanation || null, explanationStatus: q.explanationStatus || "none",
    coach: q.coach || null, translation: q.translation || null
  }));
  const payload = {
    generatedAt: new Date().toISOString(),
    topics: seed.topics || [],
    files: seed.files || [],
    questions: inline
  };

  let html = read(TEMPLATE);
  const dungeon = dungeonBundle();
  const town = townBundle();
  const lookupJs = read(path.join(__dirname, "lookup-ui.js"));
  const lookupCss = read(path.join(__dirname, "lookup.css"));
  console.log(`[build] Mê cung kho báu: ${(Buffer.byteLength(dungeon) / 1024).toFixed(1)} KB / ${Buffer.byteLength(dungeon)} B (chưa nén)`);
  console.log(`[build] Thú ảo + Thị trấn: ${(Buffer.byteLength(town) / 1024).toFixed(1)} KB / ${Buffer.byteLength(town)} B (chưa nén)`);
  console.log(
    `[build] Tra cứu bôi đen: ${((Buffer.byteLength(lookupJs) + Buffer.byteLength(lookupCss)) / 1024).toFixed(1)} KB / ${Buffer.byteLength(lookupJs) + Buffer.byteLength(lookupCss)} B (JS ${Buffer.byteLength(lookupJs)} B + CSS ${Buffer.byteLength(lookupCss)} B)`
  );
  html = html.replace("/*__PARSER__*/", () => read(path.join(__dirname, "parser.js")));
  html = html.replace("/*__EXPLAINER__*/", () => read(path.join(__dirname, "explainer.js")));
  html = html.replace("/*__DUCK__*/", () => read(path.join(__dirname, "duck.js")));
  html = html.replace("/*__DUNGEON__*/", () => dungeon);
  html = html.replace("/*__TOWN__*/", () => town);
  html = html.replace("/*__SKILLEXTRA__*/", () => read(path.join(__dirname, "skill-extra.js")));
  html = html.replace("/*__SKILLEXTRA_CSS__*/", () => SKILL_EXTRA.CSS);
  html = html.replace("/*__LOOKUP__*/", () => lookupJs);
  html = html.replace("/*__LOOKUP_CSS__*/", () => lookupCss);
  html = html.replace("/*__SEED__*/", () =>
    "window.__SEED__ = " + JSON.stringify(payload).replace(/</g, "\\u003c") + ";"
  );
  if (/\/\*__[A-Z_]+__\*\//.test(html)) throw new Error("Template thiếu placeholder.");

  for (const dir of OUT_DIRS) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "toeic-game.html");
    fs.writeFileSync(out, html, "utf8");
    console.log(`Đã tạo ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(0)} KB, ${inline.length} câu)`);
  }

  /* Trang đăng nhập/đăng ký và trang giới thiệu: nguồn là SRC_DIR (html/ nếu còn, không thì public/),
     bản phục vụ luôn nằm ở public/. Chuỗi đánh dấu chế độ để nguyên, client tự hiểu là đăng nhập. */
  const authSrc = read(path.join(SRC_DIR, "auth.html"));
  fs.writeFileSync(path.join(ROOT, "public", "auth.html"), authSrc, "utf8");
  console.log(
    `[build] Trang tài khoản: ${authSrc.length} B -> public/auth.html (/dang-nhap, /dang-ky)`
  );

  const landingSrc = read(path.join(SRC_DIR, "landing.html"));
  fs.writeFileSync(path.join(ROOT, "public", "landing.html"), landingSrc, "utf8");
  console.log(
    `[build] Trang giới thiệu: ${landingSrc.length} B -> public/landing.html (/ -> /choi)`
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
