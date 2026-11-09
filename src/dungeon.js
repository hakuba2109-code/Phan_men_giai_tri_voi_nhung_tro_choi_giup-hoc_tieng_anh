"use strict";

/* Router của "Mê cung kho báu".
   - Server PHÁN quyết mọi trận đánh (đọc đáp án trong CSDL), không gửi đáp án khi đang chơi.
   - Luật nằm ở src/dungeon-rules.js (dùng chung với bản offline trong trình duyệt).
   - Chứng chỉ có mã HMAC do src/certificate.js cấp; trang /verify và /certificate công khai. */
const crypto = require("crypto");
const express = require("express");
const db = require("./db");
const Core = require("./dungeon-core");
const Rules = require("./dungeon-rules");
const Cert = require("./certificate");
const xu = require("./xu");
const TownCore = require("./town-core");

const router = express.Router();

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
});

const bad = (message, status) => Object.assign(new Error(message), { status: status || 400 });
const idOf = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const EXP_BONUS = { gold: 100, silver: 60, bronze: 30 };
const MEDAL_PLACE = { gold: 0, silver: 1, bronze: 2 }; // hạng mê cung -> chỉ số trong TownCore.CONFIG.xu.maze

/* Xu cho ván mê cung: phần thưởng cố định theo hạng (Vàng 15 / Bạc 10 / Đồng 6), trần 20 xu + 5 ván mỗi ngày.
   Khóa chống cày là NỘI DUNG ván (file + phân đoạn + ảnh chụp câu hỏi), nên chơi lại y hệt không cộng thêm. */
async function rewardMaze(client, userId, row, medal, snapshot) {
  const r = await xu.grant(client, {
    userId, source: "game",
    ref: `maze:${row.file_id}:${row.segment}:${snapshot}`,
    amount: TownCore.gameReward("maze", MEDAL_PLACE[medal] == null ? -1 : MEDAL_PLACE[medal]),
    meta: { game: "maze", medal },
  });
  return { granted: r.granted, amount: r.amount, reason: r.reason || null };
}
const MIN_QUESTIONS = Core.CONFIG.minQuestionsToPlay;

/* ---------- dùng chung ---------- */

function titleOf(filename) {
  return String(filename || "Bộ đề").replace(/\.(docx|md|txt)$/i, "");
}

function snapshotOf(ids) {
  return crypto.createHash("sha256").update(ids.slice().sort().join("\n")).digest("hex");
}

function optionSetOk(options) {
  if (!Array.isArray(options) || options.length !== 4) return false;
  return new Set(options.map((o) => String(o).trim().toLowerCase())).size === 4;
}

/* Bộ đề của chính người dùng + danh sách câu có thể chơi (đúng điều kiện mục 8.2). */
async function loadDeck(fileId, ownerId, client) {
  const c = client || db;
  const f = await c.query(`SELECT id, filename FROM source_files WHERE id = $1 AND owner_id = $2`, [fileId, ownerId]);
  if (!f.rows.length) throw bad("Không tìm thấy bộ đề này.", 404);
  const q = await c.query(
    `SELECT q.id, q.question, q.options, q.passage, q.topic, q.number, q.answer_index
       FROM questions q
      WHERE q.file_id = $1
        AND q.status <> 'review'
        AND q.qtype IN ('mcq','passage_mcq')
        AND coalesce(array_length(q.options, 1), 0) = 4
        AND q.answer_index BETWEEN 0 AND 3
      ORDER BY q.number NULLS LAST, q.id`,
    [fileId]
  );
  const questions = q.rows.filter((r) => optionSetOk(r.options));
  return { file: f.rows[0], title: titleOf(f.rows[0].filename), questions };
}

/* Câu bị xóa khỏi bộ đề giữa chừng: coi như bị hạ, không tính EXP/firstTry. */
async function syncMissing(state, client) {
  const rows = await client.query(`SELECT id FROM questions WHERE id = ANY($1::text[])`, [state.questionIds]);
  const alive = new Set(rows.rows.map((r) => r.id));
  const gone = state.questionIds.filter((id) => !alive.has(id) && !state.defeated.includes(id));
  if (!gone.length) return state;
  const out = JSON.parse(JSON.stringify(state));
  out.defeated = out.defeated.concat(gone);
  return out;
}

/* Chỉ quái của tầng hiện tại, KHÔNG có đáp án. */
function floorPayload(state) {
  const floors = Rules.floorsOf(state);
  const list = floors[state.floorNo - 1] || [];
  const monsters = list.map((qid, i) => {
    const q = state.__qmap.get(qid);
    return {
      qid,
      id: qid,
      q: q ? q.question : "(Câu này đã bị xóa khỏi bộ đề)",
      o: q ? q.options : [],
      passage: q ? q.passage : null,
      topic: q ? q.topic : "",
      num: q ? q.number : null,
      boss: list.length >= 3 && i === list.length - 1
    };
  });
  return {
    floors: floors.length,
    floorNo: state.floorNo,
    seed: state.seed,
    chestCount: list.length >= 12 ? 2 : 1,
    monsters
  };
}

function publicRun(state, runId) {
  const copy = Object.assign({}, state, { pendingHints: undefined });
  delete copy.__qmap;
  if (runId && !copy.id) copy.id = runId;
  return copy;
}

/* Gắn kèm bản đồ câu (chỉ dùng trong RAM, không trả xuống trình duyệt). */
function withQmap(state, questions) {
  const next = Object.assign({}, state);
  next.__qmap = new Map(questions.map((q) => [q.id, q]));
  return next;
}

async function selectRun(runId, userId, client, forUpdate) {
  const c = client || db;
  const r = await c.query(
    `SELECT id, user_id, file_id, segment, segments, snapshot, state, status, started_at
       FROM dungeon_runs WHERE id = $1 AND user_id = $2${forUpdate ? " FOR UPDATE" : ""}`,
    [runId, userId]
  );
  return r.rows[0] || null;
}

function certJson(row) {
  return {
    code: row.code,
    holderName: row.holder_name,
    fileTitle: row.file_title,
    total: row.total,
    firstTry: row.first_try,
    assisted: row.assisted,
    medal: row.medal,
    segment: row.segment,
    segments: row.segments,
    startedAt: row.started_at,
    issuedAt: row.issued_at,
    revoked: row.revoked
  };
}

/* Mã phải khớp bản ghi; lệch = chứng chỉ không hợp lệ (ai đó sửa thẳng CSDL). */
function verifyRow(row) {
  if (!row) return false;
  let code;
  try {
    code = Cert.makeCode({
      runId: row.run_id,
      userId: row.user_id,
      fileTitle: row.file_title,
      holderName: row.holder_name,
      total: row.total,
      firstTry: row.first_try,
      assisted: row.assisted,
      issuedAt: new Date(row.issued_at).toISOString()
    });
  } catch (err) {
    throw err;
  }
  return Cert.sameCode(Cert.normalizeCode(row.code), code);
}

/* ---------- /api/dungeon/status ---------- */
router.get("/api/dungeon/status", asyncRoute(async (req, res) => {
  const fileId = idOf(req.query.file);
  if (!fileId) throw bad("Thiếu mã bộ đề.");
  const deck = await loadDeck(fileId, req.userId);
  const total = deck.questions.length;
  if (total < MIN_QUESTIONS) {
    return res.json({
      eligible: false,
      total,
      reason: `Bộ đề cần ít nhất ${MIN_QUESTIONS} câu chơi được (hiện có ${total}).`,
      segments: []
    });
  }
  const sizes = Core.splitSegments(total);
  const runs = await db.query(
    `SELECT id, segment, segments, state, status FROM dungeon_runs
      WHERE user_id = $1 AND file_id = $2 AND status = 'active'`,
    [req.userId, fileId]
  );
  const certs = await db.query(
    `SELECT DISTINCT ON (segment) id, segment, segments, code, medal, holder_name, issued_at
       FROM certificates WHERE user_id = $1 AND file_id = $2
      ORDER BY segment, issued_at DESC`,
    [req.userId, fileId]
  );
  const runBy = new Map(runs.rows.map((r) => [r.segment, r]));
  const certBy = new Map(certs.rows.map((r) => [r.segment, r]));
  const segments = sizes.map((size, i) => {
    const no = i + 1;
    const cert = certBy.get(no);
    if (cert) {
      return { no, size, state: "completed", defeated: size, floorNo: 0, floors: 0, certificate: { code: cert.code, medal: cert.medal } };
    }
    const run = runBy.get(no);
    if (run) {
      const st = run.state;
      return {
        no,
        size,
        state: "active",
        defeated: st.defeated.length,
        floorNo: st.floorNo,
        floors: Rules.floorsOf(st).length
      };
    }
    return { no, size, state: "none", defeated: 0, floorNo: 0, floors: 0 };
  });
  res.json({ eligible: true, total, segments });
}));

/* ---------- /api/dungeon/start ---------- */
router.post("/api/dungeon/start", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const fileId = idOf(body.fileId);
  if (!fileId) throw bad("Thiếu mã bộ đề.");
  const deck = await loadDeck(fileId, req.userId);
  if (deck.questions.length < MIN_QUESTIONS) {
    throw bad(`Bộ đề cần ít nhất ${MIN_QUESTIONS} câu chơi được (hiện có ${deck.questions.length}).`);
  }
  const sizes = Core.splitSegments(deck.questions.length);
  const segment = Math.max(1, Math.min(sizes.length, Math.floor(Number(body.segment) || 1)));
  const skip = sizes.slice(0, segment - 1).reduce((a, b) => a + b, 0);
  const selected = deck.questions.slice(skip, skip + sizes[segment - 1]);
  const ids = selected.map((q) => q.id);
  const snapshot = snapshotOf(ids);

  const oldCert = await db.query(
    `SELECT * FROM certificates WHERE user_id = $1 AND file_id = $2 AND segment = $3 AND snapshot = $4`,
    [req.userId, fileId, segment, snapshot]
  );
  if (oldCert.rows.length) {
    return res.status(409).json({
      error: "Chặng này đã hoàn thành — chứng chỉ đã được cấp.",
      certificate: certJson(oldCert.rows[0])
    });
  }

  const active = await db.query(
    `SELECT id, state FROM dungeon_runs WHERE user_id = $1 AND file_id = $2 AND segment = $3 AND status = 'active'`,
    [req.userId, fileId, segment]
  );
  if (active.rows.length) {
    const synced = await syncMissing(active.rows[0].state, db);
    if (synced !== active.rows[0].state) {
      await db.query(`UPDATE dungeon_runs SET state = $2, updated_at = NOW() WHERE id = $1`, [active.rows[0].id, JSON.stringify(synced)]);
    }
    const state = withQmap(synced, deck.questions);
    return res.json(Object.assign({ run: publicRun(state, active.rows[0].id) }, floorPayload(state)));
  }

  const seed = crypto.randomInt(0, 4294967296);
  const run = Rules.newRun({ seed, questionIds: ids });
  const inserted = await db.query(
    `INSERT INTO dungeon_runs (user_id, file_id, segment, segments, snapshot, state)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [req.userId, fileId, segment, sizes.length, snapshot, JSON.stringify(run)]
  );
  const state = withQmap(Object.assign({}, run, { id: inserted.rows[0].id }), deck.questions);
  res.json(Object.assign({ run: publicRun(state, inserted.rows[0].id) }, floorPayload(state)));
}));

/* ---------- /api/dungeon/fight ---------- */
router.post("/api/dungeon/fight", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const runId = idOf(body.runId);
  const qid = String(body.qid || "");
  const choice = Number(body.choice);
  if (!runId) throw bad("Thiếu mã ván.");
  if (!qid) throw bad("Thiếu mã câu hỏi.");
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw bad("Lựa chọn phải là số 0–3.");

  const out = await db.withTransaction(async (client) => {
    const row = await selectRun(runId, req.userId, client, true);
    if (!row) throw bad("Không tìm thấy ván đang chơi.", 404);
    if (row.status !== "active") throw bad("Ván này đã kết thúc.", 409);

    const q = (await client.query(
      `SELECT id, question, options, passage, topic, number, answer_index,
              explanation, explanation_status, coach, translation
         FROM questions WHERE id = $1`,
      [qid]
    )).rows[0];
    if (!q) throw bad("Câu này không còn trong bộ đề.", 409);

    const state = await syncMissing(row.state, client);
    const pending = Array.isArray(state.pendingHints) ? state.pendingHints : [];
    const hinted = pending.includes(qid);
    const correct = choice === q.answer_index;
    const result = Rules.fight(state, qid, correct, { hinted });
    const floorNo = Rules.floorOfQuestion(state, qid);
    const next = result.run;
    if (hinted) next.pendingHints = pending.filter((x) => x !== qid);

    await client.query(`UPDATE dungeon_runs SET state = $2, updated_at = NOW() WHERE id = $1`, [row.id, JSON.stringify(next)]);
    await client.query(
      `INSERT INTO dungeon_fights (run_id, question_id, choice, correct, hinted, floor_no) VALUES ($1, $2, $3, $4, $5, $6)`,
      [row.id, qid, choice, correct, hinted, floorNo]
    );
    await client.query(
      `INSERT INTO attempts (question_id, correct, mode, exp_gained, user_id) VALUES ($1, $2, 'dungeon', $3, $4)`,
      [qid, correct, result.exp, req.userId]
    );
    if (correct) {
      await client.query(`DELETE FROM wrong_answers WHERE question_id = $1 AND user_id = $2`, [qid, req.userId]);
    } else {
      await client.query(
        `INSERT INTO wrong_answers (user_id, question_id, times_wrong, last_wrong_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, question_id) DO UPDATE
         SET times_wrong = wrong_answers.times_wrong + 1, last_wrong_at = NOW()`,
        [req.userId, qid]
      );
    }
    return {
      correct,
      answerIndex: q.answer_index,
      events: result.events,
      exp: result.exp,
      run: publicRun(next, row.id),
      summary: Rules.summary(next),
      question: {
        id: q.id,
        q: q.question,
        o: q.options,
        a: q.answer_index,
        passage: q.passage,
        num: q.number,
        explanation: q.explanation,
        explanationStatus: q.explanation_status,
        coach: q.coach,
        translation: q.translation
      }
    };
  });
  res.json(out);
}));

/* ---------- /api/dungeon/hint ---------- */
router.post("/api/dungeon/hint", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const runId = idOf(body.runId);
  const qid = String(body.qid || "");
  if (!runId || !qid) throw bad("Thiếu mã ván hoặc mã câu hỏi.");
  const out = await db.withTransaction(async (client) => {
    const row = await selectRun(runId, req.userId, client, true);
    if (!row) throw bad("Không tìm thấy ván đang chơi.", 404);
    if (row.status !== "active") throw bad("Ván này đã kết thúc.", 409);
    const state = row.state;
    if (!(state.items.hint > 0)) throw bad("Bạn không có gợi ý.", 409);
    if (!state.questionIds.includes(qid)) throw bad("Câu này không thuộc ván.");
    const q = (await client.query(`SELECT answer_index FROM questions WHERE id = $1`, [qid])).rows[0];
    if (!q) throw bad("Câu này không còn trong bộ đề.", 409);
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer_index);
    const rand = Core.rng(Core.hash32(`${state.seed}|hint|${qid}`));
    const eliminate = wrong[rand.int(wrong.length)];
    const next = JSON.parse(JSON.stringify(state));
    next.items.hint--;
    next.pendingHints = (next.pendingHints || []).filter((x) => x !== qid).concat(qid);
    await client.query(`UPDATE dungeon_runs SET state = $2, updated_at = NOW() WHERE id = $1`, [row.id, JSON.stringify(next)]);
    return { eliminate, run: publicRun(next, row.id) };
  });
  res.json(out);
}));

/* ---------- /api/dungeon/chest ---------- */
router.post("/api/dungeon/chest", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const runId = idOf(body.runId);
  const floorNo = Math.floor(Number(body.floorNo));
  const idx = Math.floor(Number(body.idx));
  if (!runId) throw bad("Thiếu mã ván.");
  if (!Number.isInteger(floorNo) || !Number.isInteger(idx) || idx < 0) throw bad("Rương không hợp lệ.");
  const out = await db.withTransaction(async (client) => {
    const row = await selectRun(runId, req.userId, client, true);
    if (!row) throw bad("Không tìm thấy ván đang chơi.", 404);
    if (row.status !== "active") throw bad("Ván này đã kết thúc.", 409);
    const list = Rules.floorsOf(row.state)[floorNo - 1] || [];
    const count = list.length >= 12 ? 2 : 1;
    if (idx >= count) throw bad("Rương không tồn tại.", 404);
    const result = Rules.openChest(row.state, floorNo, idx);
    await client.query(`UPDATE dungeon_runs SET state = $2, updated_at = NOW() WHERE id = $1`, [row.id, JSON.stringify(result.run)]);
    return { loot: result.loot, run: publicRun(result.run, row.id) };
  });
  res.json(out);
}));

/* ---------- /api/dungeon/potion ---------- */
router.post("/api/dungeon/potion", asyncRoute(async (req, res) => {
  const runId = idOf((req.body || {}).runId);
  if (!runId) throw bad("Thiếu mã ván.");
  const out = await db.withTransaction(async (client) => {
    const row = await selectRun(runId, req.userId, client, true);
    if (!row) throw bad("Không tìm thấy ván đang chơi.", 404);
    if (row.status !== "active") throw bad("Ván này đã kết thúc.", 409);
    const next = Rules.useItem(row.state, "potion");
    await client.query(`UPDATE dungeon_runs SET state = $2, updated_at = NOW() WHERE id = $1`, [row.id, JSON.stringify(next)]);
    return { run: publicRun(next, row.id) };
  });
  res.json(out);
}));

/* ---------- /api/dungeon/descend ---------- */
router.post("/api/dungeon/descend", asyncRoute(async (req, res) => {
  const runId = idOf((req.body || {}).runId);
  if (!runId) throw bad("Thiếu mã ván.");
  const out = await db.withTransaction(async (client) => {
    const row = await selectRun(runId, req.userId, client, true);
    if (!row) throw bad("Không tìm thấy ván đang chơi.", 404);
    if (row.status !== "active") throw bad("Ván này đã kết thúc.", 409);
    const state = await syncMissing(row.state, client);
    const next = Rules.descend(state);
    await client.query(`UPDATE dungeon_runs SET state = $2, updated_at = NOW() WHERE id = $1`, [row.id, JSON.stringify(next)]);
    const ids = next.questionIds;
    const q = await client.query(
      `SELECT id, question, options, passage, topic, number FROM questions WHERE id = ANY($1::text[])`,
      [ids]
    );
    const full = withQmap(next, q.rows);
    return Object.assign({ run: publicRun(full, row.id) }, floorPayload(full));
  });
  res.json(out);
}));

/* ---------- /api/dungeon/finish ---------- */
router.post("/api/dungeon/finish", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const runId = idOf(body.runId);
  const holder = String(body.holderName == null ? "" : body.holderName).trim();
  if (!runId) throw bad("Thiếu mã ván.");
  if (holder.length < 2 || holder.length > 40) throw bad("Tên người nhận phải từ 2 đến 40 ký tự.");

  const out = await db.withTransaction(async (client) => {
    const row = await selectRun(runId, req.userId, client, true);
    if (!row) throw bad("Không tìm thấy ván đang chơi.", 404);
    if (row.status === "completed") throw bad("Ván này đã hoàn tất.", 409);
    if (row.status !== "active") throw bad("Ván này đã kết thúc.", 409);
    if (!row.file_id) throw bad("Bộ đề của ván này đã bị xóa.", 409);

    const deck = await loadDeck(row.file_id, req.userId, client);
    const synced = await syncMissing(row.state, client);
    const done = Rules.finish(synced);
    const stats = Rules.summary(done);
    const snapshot = snapshotOf(done.questionIds);

    const old = await client.query(
      `SELECT * FROM certificates WHERE user_id = $1 AND file_id = $2 AND segment = $3 AND snapshot = $4`,
      [req.userId, row.file_id, row.segment, snapshot]
    );
    if (old.rows.length) {
      await client.query(
        `UPDATE dungeon_runs SET state = $2, status = 'completed', updated_at = NOW(), finished_at = NOW() WHERE id = $1`,
        [row.id, JSON.stringify(done)]
      );
      return { certificate: certJson(old.rows[0]), expBonus: 0, reused: true, xu: await rewardMaze(client, req.userId, row, old.rows[0].medal, snapshot), summary: stats };
    }

    const issuedAt = new Date().toISOString();
    const code = Cert.makeCode({
      runId: row.id,
      userId: req.userId,
      fileTitle: deck.title,
      holderName: holder,
      total: stats.total,
      firstTry: stats.firstTry,
      assisted: stats.assisted,
      issuedAt
    });
    const expBonus = EXP_BONUS[stats.medal] || 0;
    const cert = await client.query(
      `INSERT INTO certificates
        (code, user_id, file_id, run_id, snapshot, segment, segments, holder_name, file_title,
         total, first_try, assisted, medal, started_at, issued_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [code, req.userId, row.file_id, row.id, snapshot, row.segment, row.segments, holder, deck.title,
        stats.total, stats.firstTry, stats.assisted, stats.medal, row.started_at, issuedAt]
    );
    await client.query(
      `UPDATE dungeon_runs SET state = $2, status = 'completed', updated_at = NOW(), finished_at = NOW() WHERE id = $1`,
      [row.id, JSON.stringify(done)]
    );
    return { certificate: certJson(cert.rows[0]), expBonus, xu: await rewardMaze(client, req.userId, row, stats.medal, snapshot), summary: stats };
  });
  res.json(out);
}));

/* ---------- /api/dungeon/abandon ---------- */
router.post("/api/dungeon/abandon", asyncRoute(async (req, res) => {
  const runId = idOf((req.body || {}).runId);
  if (!runId) throw bad("Thiếu mã ván.");
  const r = await db.query(
    `UPDATE dungeon_runs SET status = 'abandoned', updated_at = NOW(), finished_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [runId, req.userId]
  );
  if (!r.rowCount) throw bad("Không tìm thấy ván đang chơi.", 404);
  res.json({ ok: true });
}));

/* ---------- chứng chỉ ---------- */
router.get("/api/certificates", asyncRoute(async (req, res) => {
  const r = await db.query(
    `SELECT id, code, file_title, holder_name, total, first_try, assisted, medal, segment, segments,
            started_at, issued_at, revoked
       FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC, id DESC`,
    [req.userId]
  );
  res.json({ items: r.rows.map(certJson) });
}));

/* Giới hạn 30 lần/phút/IP cho việc kiểm tra công khai (bộ nhớ, đủ cho một máy chủ). */
const VERIFY_LIMIT = 30;
const VERIFY_WINDOW = 60 * 1000;
const verifyHits = new Map();
function verifyAllowed(ip) {
  const now = Date.now();
  const key = String(ip || "?");
  const list = (verifyHits.get(key) || []).filter((t) => now - t < VERIFY_WINDOW);
  if (list.length >= VERIFY_LIMIT) {
    verifyHits.set(key, list);
    return false;
  }
  list.push(now);
  verifyHits.set(key, list);
  return true;
}
function resetVerifyLimit() {
  verifyHits.clear();
}

async function certificateByCode(code) {
  const norm = Cert.normalizeCode(code);
  if (!Cert.CODE_RE.test(norm)) return null;
  const r = await db.query(`SELECT * FROM certificates WHERE code = $1`, [norm]);
  const row = r.rows[0];
  if (!row) return null;
  return verifyRow(row) ? row : null;
}

router.get("/api/certificates/verify/:code", asyncRoute(async (req, res) => {
  if (!verifyAllowed(req.ip)) throw bad("Quá nhiều lần kiểm tra — thử lại sau một phút.", 429);
  const row = await certificateByCode(req.params.code);
  if (!row) throw bad("Không tìm thấy chứng chỉ này.", 404);
  res.json({
    valid: !row.revoked,
    revoked: row.revoked,
    holderName: row.holder_name,
    fileTitle: row.file_title,
    total: row.total,
    firstTry: row.first_try,
    firstTryRate: Math.round((row.first_try / Math.max(1, row.total)) * 100),
    assisted: row.assisted,
    medal: row.medal,
    segment: row.segment,
    segments: row.segments,
    issuedAt: row.issued_at
  });
}));

/* ---------- trang HTML công khai ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

const MEDAL = { gold: { icon: "🥇", name: "Vàng" }, silver: { icon: "🥈", name: "Bạc" }, bronze: { icon: "🥉", name: "Đồng" } };

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

const PAGE_CSS = `
  :root {
    color-scheme: light;
    --brand: #2563eb;
    --brand-2: #1e40af;
    --ink: #0f1b33;
    --muted: #5b6b86;
    --line: #dbe4f2;
    --bg: #f1f5fc;
    --soft: #e9f1ff;
    --grad: linear-gradient(135deg, #2f6bf0, #1e40af);
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: radial-gradient(900px 520px at 100% -8%, var(--soft), rgba(0,0,0,0) 62%), var(--bg);
    color: var(--ink); line-height: 1.5; }
  .bar { max-width: 1000px; margin: 0 auto; padding: 18px 16px 0; display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; }
  .bar .mark { width: 34px; height: 34px; border-radius: 11px; background: var(--grad); color: #fff;
    display: grid; place-items: center; font-size: 17px; box-shadow: 0 6px 16px rgba(37,99,235,.3); }
  .bar small { display: block; font-weight: 600; font-size: 11px; color: var(--muted); }
  .wrap { max-width: 860px; margin: 0 auto; padding: 18px 16px 48px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px;
    box-shadow: 0 12px 28px rgba(23, 48, 96, .1); }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .muted { color: var(--muted); font-size: 14px; }
  .ok { color: #11703c; font-weight: 700; }
  .bad { color: #b3261e; font-weight: 700; }
  a { color: var(--brand); }
  .cert { max-width: 1000px; margin: 0 auto; background: #fffdf7; border: 10px solid #c9a227; border-radius: 8px; padding: 40px 48px; }
  .cert .eyebrow { letter-spacing: .28em; font-size: 13px; color: #8a6d1c; font-weight: 700; }
  .cert h2 { font-size: 34px; margin: 8px 0 4px; color: #6b4d00; }
  .cert .name { font-size: 30px; font-weight: 800; margin: 18px 0 6px; }
  .cert .deck { font-size: 18px; margin: 0 0 18px; }
  .cert .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 24px 0; }
  .cert .k { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #7a6a3a; }
  .cert .v { font-size: 18px; font-weight: 700; }
  .cert .code { font-family: Consolas, monospace; font-size: 20px; letter-spacing: .08em; }
  .cert .foot { display: flex; justify-content: space-between; gap: 16px; border-top: 1px dashed #c9a227; padding-top: 14px; font-size: 13px; color: #6a5a2a; }
  .print { margin: 16px auto 0; display: block; padding: 11px 20px; border: 0; border-radius: 12px;
    background: var(--grad); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
    box-shadow: 0 8px 18px rgba(37, 99, 235, .25); }
  :focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
  @page { size: A4 landscape; margin: 0; }
  @media print {
    body { background: #fff; }
    .bar, .print, .back { display: none !important; }
    .wrap { padding: 0; max-width: none; }
    .cert { border-width: 6px; width: 100%; min-height: 100vh; }
  }
`;

function page(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} · TOEIC Practice</title><style>${PAGE_CSS}</style></head>
    <body><div class="bar"><span class="mark">🎯</span><span>TOEIC <b>Practice</b><small>Chứng chỉ Mê cung kho báu</small></span></div>${body}</body></html>`;
}

router.get("/verify/:code", asyncRoute(async (req, res) => {
  const row = await certificateByCode(req.params.code);
  let body;
  if (!row) {
    body = `<div class="wrap"><div class="card"><h1>Không tìm thấy chứng chỉ</h1>
      <p class="bad">Mã <code>${esc(req.params.code)}</code> không hợp lệ hoặc không khớp bản ghi.</p>
      <p class="muted">Hãy kiểm tra lại mã in trên chứng chỉ (dạng TC-XXXX-XXXX-XXXX).</p>
      <p class="back"><a href="/">Về trang chủ</a></p></div></div>`;
    res.status(404).type("html").send(page("Không tìm thấy chứng chỉ", body));
    return;
  }
  const rate = Math.round((row.first_try / Math.max(1, row.total)) * 100);
  const medal = MEDAL[row.medal] || MEDAL.bronze;
  body = `<div class="wrap"><div class="card">
    <h1>${row.revoked ? '<span class="bad">Đã bị thu hồi</span>' : '<span class="ok">✓ Hợp lệ</span>'}</h1>
    <p class="muted">Chứng chỉ tự học do ứng dụng TOEIC cấp — không phải chứng chỉ TOEIC chính thức.</p>
    <p><strong>Người nhận:</strong> ${esc(row.holder_name)}</p>
    <p><strong>Hầm (bộ đề):</strong> ${esc(row.file_title)}${row.segments > 1 ? ` — Chặng ${row.segment}/${row.segments}` : ""}</p>
    <p><strong>Số câu:</strong> ${row.total} · <strong>Đúng ngay lần đầu:</strong> ${rate}% · <strong>Huy chương:</strong> ${medal.icon} ${medal.name}</p>
    <p><strong>Cấp ngày:</strong> ${esc(fmtDate(row.issued_at))}</p>
    <p class="back"><a href="/certificate/${encodeURIComponent(row.code)}">Xem trang in chứng chỉ</a></p>
  </div></div>`;
  res.type("html").send(page("Kiểm tra chứng chỉ " + row.code, body));
}));

router.get("/certificate/:code", asyncRoute(async (req, res) => {
  const row = await certificateByCode(req.params.code);
  if (!row) {
    res.status(404).type("html").send(page("Không tìm thấy chứng chỉ",
      `<div class="wrap"><div class="card"><h1>Không tìm thấy chứng chỉ</h1>
       <p class="bad">Mã không hợp lệ hoặc không khớp bản ghi.</p>
       <p class="back"><a href="/">Về trang chủ</a></p></div></div>`));
    return;
  }
  const rate = Math.round((row.first_try / Math.max(1, row.total)) * 100);
  const medal = MEDAL[row.medal] || MEDAL.bronze;
  const floors = Core.splitFloors(row.total).length;
  const host = `${req.protocol}://${req.get("host")}`;
  const verifyUrl = `${host}/verify/${row.code}`;
  const body = `<div class="wrap">
    <div class="cert">
      <div class="eyebrow">TOEIC PRACTICE · MÊ CUNG KHO BÁU</div>
      <h2>CHỨNG CHỈ HOÀN THÀNH</h2>
      <div class="muted">Chứng nhận người học đã chinh phục toàn bộ quái vật của hầm.</div>
      <div class="name">${esc(row.holder_name)}</div>
      <p class="deck">đã chinh phục hầm “<strong>${esc(row.file_title)}</strong>”${row.segments > 1 ? ` (Chặng ${row.segment}/${row.segments})` : ""}.</p>
      <div class="grid">
        <div><div class="k">Số câu</div><div class="v">${row.total}</div></div>
        <div><div class="k">Số tầng</div><div class="v">${floors}</div></div>
        <div><div class="k">Đúng ngay lần đầu</div><div class="v">${rate}%</div></div>
        <div><div class="k">Huy chương</div><div class="v">${medal.icon} ${medal.name}</div></div>
      </div>
      <div class="grid">
        <div><div class="k">Bắt đầu</div><div class="v">${esc(fmtDate(row.started_at))}</div></div>
        <div><div class="k">Hoàn thành</div><div class="v">${esc(fmtDate(row.issued_at))}</div></div>
        <div style="grid-column: span 2"><div class="k">Mã xác thực</div><div class="v code">${esc(row.code)}</div></div>
      </div>
      <div class="foot">
        <span>Kiểm tra tại: ${esc(verifyUrl)}</span>
        <span>${row.revoked ? "ĐÃ BỊ THU HỒI" : "Hợp lệ"}</span>
      </div>
      <div class="muted" style="margin-top:14px">Chứng chỉ tự học do ứng dụng cấp, không phải chứng chỉ TOEIC chính thức.</div>
    </div>
    <button class="print" onclick="window.print()">🖨️ In / Lưu PDF</button>
  </div>`;
  res.type("html").send(page("Chứng chỉ " + row.code, body));
}));

module.exports = { router, resetVerifyLimit, verifyAllowed };
