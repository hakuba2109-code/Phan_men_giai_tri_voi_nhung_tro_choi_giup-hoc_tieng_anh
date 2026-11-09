"use strict";
/* BACKEND "Đảo hoa anh đào": cây lớn bằng điểm sinh trưởng, điểm MUA bằng ví xu chung (xu.js).
   Gắn vào server.js SAU middleware gán req.userId (0 = Khách):

     const { createSakuraRouter } = require("./sakura");
     app.use("/api/sakura", createSakuraRouter({ db }));

   `db` chỉ cần có  db.withTransaction(async (client) => …)  với client.query(text, params) kiểu `pg`.
   Trước đây cây có ví riêng và tự đồng bộ attempts — nay một xu chỉ được in MỘT lần, bởi xu.js.
   Vì vậy file này không còn sổ cái bài học riêng: sakura_ledger là lịch sử cũ, không ghi thêm.
   Luật tiêu xu nằm ở sakura-core.js (tưới 5 xu +10 điểm, bón 20 xu +50 điểm, gần đầy thì trả giá prorated). */
const express = require("express");
const TownCore = require("./town-core");
const SC = require("./sakura-core");
const xu = require("./xu");
const C = TownCore.CONFIG;

const tz = xu.tz;
const uidOf = xu.uidOf;

async function ensureRow(client, userId) {
  await client.query(`INSERT INTO sakura_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
}

/* Điểm sinh trưởng + cờ bật/tắt của cây. FOR UPDATE: hai lần tưới song song sẽ xếp hàng. */
async function readState(client, userId) {
  await ensureRow(client, userId);
  return (await client.query(`SELECT points, enabled FROM sakura_state WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
}

/* Trạng thái trả về cho giao diện (3D dùng stage.progress để lớn dần). `coins` là số dư VÍ CHUNG. */
function buildState(coins, points, dayEarned) {
  const today = TownCore.dayKey(Date.now(), tz());
  const actions = {};
  for (const [name, a] of Object.entries(SC.CONFIG.actions)) {
    const q = SC.quote(coins, points, name);
    actions[name] = { cost: a.cost, points: a.points, canDo: q.ok, ...(q.ok ? { payCost: q.cost, gain: q.gained } : { why: q.reason }) };
  }
  return {
    enabled: true, tz: tz(), today,
    coins, points, maxPoints: SC.CONFIG.maxPoints,
    stage: SC.stageOf(points),
    stages: SC.CONFIG.stages.map(([name, at]) => ({ name, at })),
    today_stats: { earned: dayEarned, cap: C.dailyCap },
    actions,
  };
}

/* ---------- router ---------- */
function createSakuraRouter({ db } = {}) {
  if (!db || typeof db.withTransaction !== "function") throw new Error("createSakuraRouter cần db.withTransaction");
  const router = express.Router();
  router.use(express.json({ limit: "10kb" }));

  const route = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      const status = err.status && err.status < 500 ? err.status : 500;
      if (status === 500) console.error("[sakura]", err);
      res.status(status).json({ error: status === 500 ? "Lỗi máy chủ, bạn thử lại sau nhé." : err.message });
    });

  async function stateAndWallet(c, uid) {
    const st = await readState(c, uid);
    if (!st.enabled) return { enabled: false, tz: tz(), today: TownCore.dayKey(Date.now(), tz()) };
    const w = await xu.syncLessons(c, uid); // đồng bộ bài học -> ví chung (cũng khóa dòng ví)
    const gifts = await xu.dailyGifts(c, uid); // mở ví ở đâu cũng được tặng quà ngày, số dư luôn khớp /api/town
    return buildState(gifts.xu, st.points, w.dayState.day === TownCore.dayKey(Date.now(), tz()) ? w.dayState.earned : 0);
  }

  router.get("/", route(async (req, res) => {
    const uid = uidOf(req);
    res.json(await db.withTransaction((c) => stateAndWallet(c, uid)));
  }));

  router.post("/care", route(async (req, res) => {
    const uid = uidOf(req), action = (req.body || {}).action;
    if (!SC.isAction(action)) throw SC.httpError(400, "Hành động chăm cây không hợp lệ.");
    res.json(await db.withTransaction(async (c) => {
      const st = await readState(c, uid);
      if (!st.enabled) throw SC.httpError(409, "Đảo hoa anh đào đang tắt.");
      await xu.syncLessons(c, uid); // vừa đồng bộ vừa khóa dòng ví: hai lần tưới song song xếp hàng
      const gifts = await xu.dailyGifts(c, uid);
      const r = SC.care({ coins: gifts.xu, points: st.points }, action); // ném 409 nếu thiếu xu hoặc cây đã trọn vẹn
      await c.query(`UPDATE sakura_state SET points = $2, updated_at = now() WHERE user_id = $1`, [uid, r.points]);
      await c.query(`UPDATE town_state SET xu = $2, updated_at = now() WHERE user_id = $1`, [uid, r.coins]);
      await c.query(
        `INSERT INTO sakura_care (user_id, action, cost, points, created_at) VALUES ($1, $2, $3, $4, clock_timestamp())`,
        [uid, action, r.cost, r.gained]
      );
      await xu.spend(c, uid, "sakura", r.cost, { topic: action, xuAfter: r.coins });
      return {
        action, coins: r.coins, points: r.points, cost: r.cost, gained: r.gained,
        leveledUp: r.leveledUp, done: r.done, stage: SC.stageOf(r.points),
      };
    }));
  }));

  /* Nhật ký chăm cây (tiền đã tiêu cho cây). Lịch sử THU của cả ví: GET /api/xu/history. */
  router.get("/history", route(async (req, res) => {
    const uid = uidOf(req), limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json(await db.withTransaction(async (c) => {
      await readState(c, uid);
      const rows = (await c.query(
        `SELECT 'care'::text AS type, action AS detail, cost AS amount, points, to_char(created_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day
           FROM sakura_care WHERE user_id = $1 ORDER BY id DESC LIMIT $3`, [uid, tz(), limit]
      )).rows;
      return { items: rows };
    }));
  }));

  router.post("/settings", route(async (req, res) => {
    const uid = uidOf(req), enabled = (req.body || {}).enabled;
    if (typeof enabled !== "boolean") throw SC.httpError(400, "Thiếu giá trị bật/tắt.");
    res.json(await db.withTransaction(async (c) => {
      await ensureRow(c, uid);
      await c.query(`UPDATE sakura_state SET enabled = $2, updated_at = now() WHERE user_id = $1`, [uid, enabled]);
      return { enabled };
    }));
  }));

  return router;
}

/* Chuyển dữ liệu Khách -> tài khoản mới (gọi cùng giao dịch với phần chuyển attempts của auth.js).
   Ví xu thì town.js lo; ở đây chỉ còn ba bảng của cây. */
async function transferGuestData(client, guestId, newUserId) {
  const has = await client.query(`SELECT 1 FROM sakura_state WHERE user_id = $1`, [newUserId]);
  if (has.rowCount > 0) return { moved: false, conflict: true };
  for (const table of ["sakura_state", "sakura_ledger", "sakura_care"])
    await client.query(`UPDATE ${table} SET user_id = $2 WHERE user_id = $1`, [guestId, newUserId]);
  return { moved: true, conflict: false };
}

module.exports = { createSakuraRouter, transferGuestData };
