const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("./db");
const importer = require("./importer");
const ai = require("./ai-parser");
const aiCoach = require("./ai-coach");
const docxFill = require("./docx-fill");
const auth = require("./auth");
const dungeon = require("./dungeon");
const lookup = require("./lookup");
const { createTownRouter } = require("./town");
const { createSakuraRouter } = require("./sakura");
const xu = require("./xu");
const TownCore = require("./town-core");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

app.use(express.json({ limit: "2mb" }));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error(err);
  if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
});

/* Tài khoản trong cookie. req.userId = 0 nghĩa là "khách trên máy này". */
app.use("/api", asyncRoute(async (req, res, next) => {
  req.user = await auth.userFromRequest(req).catch(() => null);
  req.userId = req.user ? req.user.id : 0;
  next();
}));

/* Mê cung kho báu: /api/dungeon/*, /api/certificates/*, trang /verify và /certificate. */
app.use(dungeon.router);

/* Tra cứu bôi đen: /api/lookup/*, /api/words/*. */
app.use(lookup.router);

/* Thú ảo + Thị trấn: /api/town/* (2D và 3D cùng dùng một nguồn dữ liệu này). */
app.use("/api/town", createTownRouter({ db }));

/* Đảo hoa anh đào: /api/sakura/* (cây khổng lồ 3D, tiêu xu chung). */
app.use("/api/sakura", createSakuraRouter({ db }));

/* VÍ XU CHUNG: /api/xu (số dư, lịch sử) và /api/xu/game (thưởng ván chơi). */
app.use("/api/xu", xu.createXuRouter({ db }));

/* Quần đảo vô tận + nuôi thú: tiến độ đảo, thú, kho thức ăn — tiêu cùng một ví xu. */
app.use("/api/islands", require("./island").createIslandRouter({ db }));

/* Quà nộp file tài liệu: 25 xu + 1 xu cho mỗi đủ 20 câu, tối đa 60 một file và 60 một ngày
   (luật: TownCore.CONFIG.xu.file + trần ngày trong xu.grant).
   Khóa chống thưởng hai lần là id của file trong source_files, nên nhập lại cùng một file không cộng thêm.
   Quà chỉ là phụ: lỗi ở đây không được làm hỏng việc nhập đề. */
async function rewardFile(ownerId, fileId, questionCount) {
  if (!fileId) return { granted: false, amount: 0, reason: "no-file" };
  try {
    const r = await db.withTransaction((client) => xu.grant(client, {
      userId: ownerId, source: "file", ref: `file:${fileId}`,
      amount: TownCore.fileGain(questionCount), meta: { questions: questionCount },
    }));
    return { granted: r.granted, amount: r.amount, reason: r.reason || null };
  } catch (err) {
    console.error("[xu/file]", err);
    return { granted: false, amount: 0, reason: "error" };
  }
}

/* ---------- đăng ký / đăng nhập ---------- */
const SESSION_SECONDS = 30 * 24 * 3600;
const sendSession = (res, token, secure) =>
  res.setHeader("Set-Cookie", auth.cookieHeaders(token, SESSION_SECONDS, secure));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const { user, session, adopted } = await auth.register(req.body || {});
  sendSession(res, session.token, req.secure);
  res.json({ user, adopted });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { user, session } = await auth.login(req.body || {});
  sendSession(res, session.token, req.secure);
  res.json({ user });
}));

app.post("/api/auth/logout", asyncRoute(async (req, res) => {
  await auth.logout(req);
  res.setHeader("Set-Cookie", auth.cookieHeaders("", 0, req.secure));
  res.json({ ok: true });
}));

app.get("/api/auth/me", asyncRoute(async (req, res) => {
  res.json({ user: req.user, minPassword: auth.MIN_PASSWORD });
}));

app.get("/api/health", asyncRoute(async (req, res) => {
  const { rows } = await db.query(`SELECT count(*)::int AS questions FROM questions`);
  res.json({ ok: true, env: process.env.NODE_ENV, questions: rows[0].questions });
}));

app.get("/api/questions", asyncRoute(async (req, res) => {
  const fileId = req.query.file ? Number(req.query.file) : undefined;
  res.json(
    await importer.listQuestions({
      topic: req.query.topic,
      source: req.query.source,
      fileId,
      ownerId: req.userId,
    }),
  );
}));

app.get("/api/topics", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `SELECT t.name AS "t",
            count(q.id) FILTER (WHERE coalesce(s.owner_id, 0) = $1)::int AS total,
            count(q.id) FILTER (WHERE coalesce(s.owner_id, 0) = $1 AND q.source = 'boss')::int AS boss
     FROM topics t
     LEFT JOIN questions q ON q.topic = t.name
     LEFT JOIN source_files s ON s.id = q.file_id
     GROUP BY t.name ORDER BY min(t.position), t.name`,
    [req.userId],
  );
  res.json(rows.filter((r) => r.total > 0));
}));

// Danh sách bộ đề của tài khoản đang đăng nhập: mỗi file Word một bộ
app.get("/api/files", asyncRoute(async (req, res) => {
  res.json(await importer.listFiles({ ownerId: req.userId }));
}));

// Tải lại file gốc từ CSDL (chỉ bộ đề của chính mình)
app.get("/api/files/:id/download", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `SELECT filename, content FROM source_files WHERE id = $1 AND owner_id = $2`,
    [req.params.id, req.userId],
  );
  if (!rows.length) return res.status(404).json({ error: "Không tìm thấy file" });
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(rows[0].filename)}"`);
  res.send(rows[0].content);
}));

// Văn bản đã trích xuất của một file (để đối chiếu khi cần nhập lại)
app.get("/api/files/:id/text", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `SELECT filename, raw_text FROM source_files WHERE id = $1 AND owner_id = $2`,
    [req.params.id, req.userId],
  );
  if (!rows.length) return res.status(404).json({ error: "Không tìm thấy file" });
  res.json(rows[0]);
}));

// Xóa một bộ đề: file gốc + câu hỏi của riêng nó. Nhật ký trả lời vẫn được giữ.
app.delete("/api/files/:id", asyncRoute(async (req, res) => {
  res.json(await importer.deleteFile(req.params.id, req.userId));
}));

// Nhập đề: nhiều file .docx / .md / .txt, hoặc dán văn bản
app.post("/api/import", upload.array("files", 10), asyncRoute(async (req, res) => {
  const results = [];
  const save = async (args) => {
    try {
      const r = await importer.importFile(args);
      r.xu = await rewardFile(args.ownerId, r.fileId, r.parsed);
      results.push(r);
    } catch (err) {
      results.push({
        filename: args.filename,
        source: args.source,
        parsed: 0,
        inserted: 0,
        duplicates: 0,
        problems: [],
        topics: [],
        error: err.message,
      });
    }
  };
  for (const file of req.files || []) {
    await save({
      filename: Buffer.from(file.originalname, "latin1").toString("utf8"),
      buffer: file.buffer,
      source: "import",
      topic: req.body.topic || undefined,
      ownerId: req.userId,
    });
  }
  const pasted = String(req.body.text || "");
  if (pasted.trim()) {
    await save({
      filename: req.body.filename || "dan-noi-dung.txt",
      buffer: Buffer.from(pasted, "utf8"),
      source: "import",
      topic: req.body.topic || undefined,
      ownerId: req.userId,
    });
  }
  res.json({ results, total: results.reduce((n, r) => n + r.inserted, 0) });
}));

/* ---------- Nhập đề bằng AI (Gemini) ---------- */

// Cấu hình + 11 dạng bài mà bộ phân tích AI hỗ trợ
app.get("/api/ai/status", asyncRoute(async (req, res) => {
  const c = ai.conf();
  res.json({
    configured: c.configured,
    model: c.model,
    url: c.url,
    types: Object.keys(ai.TYPES).map((k) => ({
      type: k, label: ai.TYPES[k].label, playable: ai.TYPES[k].play === "mcq",
    })),
  });
}));

// Kiểm tra key có gọi được thật không (gửi một câu rất ngắn)
app.post("/api/ai/ping", asyncRoute(async (req, res) => {
  res.json(await ai.ping());
}));

// Phân tích file Word / dán văn bản, CHƯA lưu vào CSDL
app.post("/api/ai/preview", upload.array("files", 5), asyncRoute(async (req, res) => {
  let filename, buffer;
  if (req.files && req.files.length) {
    filename = Buffer.from(req.files[0].originalname, "latin1").toString("utf8");
    buffer = req.files[0].buffer;
  } else {
    const pasted = String(req.body.text || "");
    if (!pasted.trim()) return res.status(400).json({ error: "Chưa có file hoặc nội dung để phân tích" });
    filename = req.body.filename || "dan-noi-dung.txt";
    buffer = Buffer.from(pasted, "utf8");
  }
  const rawText = await importer.extractText(filename, buffer);
  if (!rawText.trim()) return res.status(400).json({ error: "Không đọc được chữ nào từ file này" });
  const result = await ai.analyze(rawText);
  res.json({ filename, rawText, ...result });
}));

// Điền đáp án vào chính file .docx gốc, giữ nguyên định dạng/ảnh/bảng
app.post("/api/ai/fill", upload.array("files", 1), asyncRoute(async (req, res) => {
  const file = req.files && req.files[0];
  if (!file) return res.status(400).json({ error: "Chưa có file Word để điền đáp án" });
  const filename = Buffer.from(file.originalname, "latin1").toString("utf8");
  if (!/\.docx$/i.test(filename)) {
    return res.status(400).json({ error: "Chỉ điền được vào file .docx (Word 2007 trở lên)" });
  }
  let questions;
  try {
    questions = JSON.parse(String(req.body.questions || "[]"));
  } catch (err) {
    return res.status(400).json({ error: "Danh sách câu hỏi không hợp lệ" });
  }
  if (!Array.isArray(questions) || !questions.length) {
    return res.status(400).json({ error: "Không có câu hỏi nào để điền đáp án" });
  }
  const { buffer, stats } = await docxFill.fillAnswers(file.buffer, questions);
  const outName = filename.replace(/\.docx$/i, "") + "_dap-an.docx";
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(outName)}`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Fill-Total", String(stats.total));
  res.setHeader("X-Fill-Filled", String(stats.filled));
  res.setHeader("X-Fill-Unmatched", String(stats.unmatched));
  res.setHeader("X-Fill-NoAnswer", String(stats.noAnswer));
  res.send(buffer);
}));

/* Gia sư AI: dịch câu + dịch đáp án + vì sao loại đáp án sai.
   Gọi POST nhiều lần trên cùng một câu chỉ tốn token LẦN ĐẦU (kết quả lưu vào questions.coach). */
app.post("/api/ai/coach", asyncRoute(async (req, res) => {
  const questionId = String((req.body || {}).questionId || "").slice(0, 40);
  try {
    res.json(await aiCoach.coach(questionId, req.userId));
  } catch (err) {
    if (err.quota) err.status = 429;
    throw err;
  }
}));

/* Bản dịch câu + đáp án cho khối 💡 (rẻ hơn gia sư: không hỏi vì sao loại).
   Câu đã có coach thì trả luôn bản dịch của coach; còn lại lưu vào questions.translation. */
app.post("/api/ai/translate", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const questionId = String(body.questionId || "").slice(0, 40);
  try {
    res.json(await aiCoach.translate(questionId, req.userId, { freeOnly: body.free === true }));
  } catch (err) {
    if (err.quota) err.status = 429;
    throw err;
  }
}));

// Lưu danh sách câu đã được xem/sửa ở bước xem trước
app.post("/api/ai/commit", asyncRoute(async (req, res) => {
  const { filename, rawText, questions } = req.body || {};
  if (!Array.isArray(questions) || !questions.length) {
    return res.status(400).json({ error: "Không có câu hỏi nào để lưu" });
  }
  if (!String(rawText || "").trim()) {
    return res.status(400).json({ error: "Thiếu nội dung gốc của bộ đề" });
  }
  const out = await importer.saveAiQuestions({
    filename: filename || "ai-import.txt",
    rawText,
    questions,
    source: req.body.source || "ai",
    ownerId: req.userId,
  });
  out.xu = await rewardFile(req.userId, out.fileId, out.parsed);
  res.json(out);
}));

app.delete("/api/questions/imported", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `WITH d AS (
       DELETE FROM questions q USING source_files s
        WHERE q.file_id = s.id AND s.source = 'import' AND s.owner_id = $1
       RETURNING q.id
     ) SELECT count(*)::int AS removed FROM d`, [req.userId]
  );
  await db.query(`DELETE FROM source_files WHERE source = 'import' AND owner_id = $1`, [req.userId]);
  res.json({ removed: rows[0].removed });
}));

app.get("/api/progress", asyncRoute(async (req, res) => {
  const p = await db.query(`SELECT nickname, exp, level, mastered FROM player_progress WHERE user_id = $1`, [req.userId]);
  const wrong = await db.query(
    `SELECT question_id AS id FROM wrong_answers WHERE user_id = $1 ORDER BY last_wrong_at DESC`,
    [req.userId]
  );
  const row = p.rows[0] || { nickname: req.user ? req.user.nickname : "Người chơi", exp: 0, level: 1, mastered: [] };
  res.json({ ...row, user: req.user, wrong: wrong.rows.map((w) => w.id) });
}));

app.post("/api/progress", asyncRoute(async (req, res) => {
  const { exp = 0, level = 1, mastered = [], nickname } = req.body || {};
  await db.query(
    `INSERT INTO player_progress (id, user_id, exp, level, mastered, nickname, updated_at)
     VALUES ($1::smallint, $1::int, $2, $3, $4::text[], COALESCE($5, 'Người chơi'), NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET exp = EXCLUDED.exp, level = EXCLUDED.level, mastered = EXCLUDED.mastered,
         nickname = COALESCE($5, player_progress.nickname), updated_at = NOW()`,
    [req.userId, exp, level, mastered, nickname ?? null]
  );
  res.json({ ok: true });
}));

// Ghi một lượt trả lời: đúng -> xoá khỏi danh sách câu sai, sai -> thêm vào
app.post("/api/answer", asyncRoute(async (req, res) => {
  const { questionId, correct, mode = "practice", expGained = 0, seconds = null } = req.body || {};
  if (!questionId) return res.status(400).json({ error: "Thiếu questionId" });
  await db.query(
    `INSERT INTO attempts (question_id, correct, mode, exp_gained, seconds, user_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [questionId, !!correct, mode, expGained, seconds, req.userId]
  );
  if (correct) {
    await db.query(`DELETE FROM wrong_answers WHERE question_id = $1 AND user_id = $2`, [questionId, req.userId]);
  } else {
    await db.query(
      `INSERT INTO wrong_answers (user_id, question_id, times_wrong, last_wrong_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, question_id) DO UPDATE
       SET times_wrong = wrong_answers.times_wrong + 1, last_wrong_at = NOW()`,
      [req.userId, questionId]
    );
  }
  res.json({ ok: true });
}));

app.get("/api/stats", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `SELECT count(*)::int AS attempts,
            count(*) FILTER (WHERE correct)::int AS correct,
            count(*) FILTER (WHERE NOT correct)::int AS wrong,
            coalesce(sum(exp_gained), 0)::int AS exp
     FROM attempts WHERE user_id = $1`,
    [req.userId]
  );
  res.json({ ...rows[0], user: req.user ? req.user.id : 0 });
}));

/* Ôn theo lịch (Leitner): suy ra hộp 0..6 từ bảng attempts, không cần bảng mới.
   Sai lần gần nhất -> hộp 0 (đến hạn ngay); mỗi lần đúng đẩy lên hộp kế tiếp. */
const LEITNER_DAYS = [0, 1, 3, 7, 14, 30, 60];

app.get("/api/review", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `SELECT question_id,
            count(*)::int AS tries,
            count(*) FILTER (WHERE correct)::int AS oks,
            (array_agg(correct ORDER BY created_at DESC))[1] AS last_ok,
            max(created_at) AS last_at
     FROM attempts WHERE user_id = $1 GROUP BY question_id`,
    [req.userId]
  );
  const now = Date.now();
  const items = rows
    .filter((r) => r.last_at)
    .map((r) => {
      const box = r.last_ok
        ? Math.min(Math.max(r.oks, 1), LEITNER_DAYS.length - 1)
        : 0;
      return {
        id: r.question_id,
        box,
        dueAt: new Date(r.last_at).getTime() + LEITNER_DAYS[box] * 86400000,
      };
    });
  const due = items.filter((x) => x.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
  const next = items.filter((x) => x.dueAt > now).sort((a, b) => a.dueAt - b.dueAt)[0];
  res.json({
    ladder: LEITNER_DAYS,
    due: due.map((x) => x.id),
    learned: items.length,
    nextDueAt: next ? new Date(next.dueAt).toISOString() : null,
  });
}));

/* Bảng xếp hạng: chỉ lấy biệt danh trong player_progress, không lộ email. */
app.get("/api/leaderboard", asyncRoute(async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.user_id,
            COALESCE(NULLIF(p.nickname, ''), 'Người chơi') AS nickname,
            p.exp, p.level,
            coalesce(a.tries, 0)::int AS tries,
            coalesce(a.oks, 0)::int AS oks
     FROM player_progress p
     LEFT JOIN (
       SELECT user_id, count(*) AS tries, count(*) FILTER (WHERE correct) AS oks
       FROM attempts GROUP BY user_id
     ) a ON a.user_id = p.user_id
     ORDER BY p.exp DESC, p.level DESC, p.updated_at ASC
     LIMIT 50`
  );
  res.json({
    me: req.user ? req.user.id : 0,
    rows: rows.map((r) => ({
      ...r,
      nickname: r.user_id === 0 ? "Khách (máy này)" : r.nickname,
    })),
  });
}));

// Static: public/toeic-game.html và toeic-game.html ở thư mục gốc
app.use(express.static(PUBLIC));
app.use(express.static(ROOT, { index: false }));

const GAME_FILE = path.join(PUBLIC, "toeic-game.html");
const ROOT_GAME_FILE = path.join(ROOT, "toeic-game.html");
const gameHtml = () => (fs.existsSync(GAME_FILE) ? GAME_FILE : fs.existsSync(ROOT_GAME_FILE) ? ROOT_GAME_FILE : null);

/* Game (3 tab) phục vụ ở /choi; /game và /toeic-game.html là alias để không phá link cũ. */
for (const alias of ["/choi", "/game", "/toeic-game.html"]) {
  app.get(alias, (req, res) => {
    const file = gameHtml();
    if (!file) return res.status(503).send("Chưa có game. Chạy: node build.js");
    res.type("html").send(fs.readFileSync(file, "utf8"));
  });
}

/* Trang giới thiệu (landing) ở "/" — khách thấy landing, đã đăng nhập thì vào thẳng game.
   Đọc public/landing.html (html/landing.html nếu còn thư mục cũ), không có marker cần thay. */
const LANDING_FILE = path.join(ROOT, "html", "landing.html");
const LANDING_PUBLIC = path.join(PUBLIC, "landing.html");
const landingFile = () => (fs.existsSync(LANDING_FILE) ? LANDING_FILE : fs.existsSync(LANDING_PUBLIC) ? LANDING_PUBLIC : null);
app.get("/", asyncRoute(async (req, res) => {
  const user = await auth.userFromRequest(req).catch(() => null);
  if (user) return res.redirect("/choi");
  const file = landingFile();
  if (!file) return res.status(503).send("Thiếu trang giới thiệu: public/landing.html");
  res.type("html").send(fs.readFileSync(file, "utf8"));
}));

/* Trang tài khoản riêng: /dang-nhap và /dang-ky dùng chung public/auth.html,
   chỉ khác chế độ ghi vào biến MODE của trang. */
const AUTH_FILE = path.join(ROOT, "html", "auth.html");
const AUTH_PUBLIC = path.join(PUBLIC, "auth.html");
const authFile = () => (fs.existsSync(AUTH_FILE) ? AUTH_FILE : fs.existsSync(AUTH_PUBLIC) ? AUTH_PUBLIC : null);
for (const [alias, mode] of [["/dang-nhap", "login"], ["/dang-ky", "register"]]) {
  app.get(alias, (req, res) => {
    const file = authFile();
    if (!file) return res.status(503).send("Thiếu trang đăng nhập: public/auth.html");
    const html = fs.readFileSync(file, "utf8").replace(/\/\*__AUTH_MODE__\*\//g, () => mode);
    res.type("html").send(html);
  });
}

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  db.applySchema()
    // Gộp vật liệu cũ + xu anh đào còn lại vào ví xu chung (chạy lại vẫn y nguyên, không cộng hai lần).
    .then(() => xu.migrateAll(db))
    .then((moved) => (moved.length ? console.log(`[xu] đã đổi vật liệu/xu cũ sang ví chung cho ${moved.length} tài khoản`) : null))
    .then(() => auth.cleanExpiredSessions())
    .then((removed) => app.listen(PORT, () => console.log(`TOEIC game chạy tại http://localhost:${PORT}` + (removed ? ` (${removed} phiên hết hạn đã dọn)` : ""))))
    .catch((err) => {
      console.error("Không kết nối được CSDL:", err.message);
      process.exit(1);
    });
}

module.exports = app;
