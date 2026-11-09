"use strict";
/* BACKEND "Thú ảo + Thị trấn" (dùng chung cho giao diện 2D và 3D Three.js).
   Gắn vào server.js SAU middleware gán req.userId (0 = Khách):

     const { createTownRouter } = require("./town");
     app.use("/api/town", createTownRouter({ db }));

   `db` chỉ cần có  db.withTransaction(async (client) => …)  với client.query(text, params) kiểu `pg`.
   Mã lõi tính toán nằm ở town-core.js (thuần, đã kiểm thử); file này chỉ lo CSDL + HTTP.
   Ví xu chung nằm ở xu.js: bài học được đồng bộ qua xu.syncLessons, thị trấn CHỈ tiêu xu (xây ô, mua hạt).
   Chỗ nào phụ thuộc dự án thật (tên bảng/cột, cách lấy chủ điểm) có chú thích "ĐỐI CHIẾU". */
const express = require("express");
const TownCore = require("./town-core");
const xu = require("./xu");
const C = TownCore.CONFIG;

const SPECIES = Object.keys(TownCore.PETS); // một nguồn duy nhất: TownCore.PETS (loài nào cũng cho ăn được)
const tz = xu.tz;
const httpError = (status, message) => Object.assign(new Error(message), { status });
const uidOf = xu.uidOf;

/* ---------- đọc trạng thái trả về cho giao diện (2D hay 3D đều dùng) ---------- */
// ĐỐI CHIẾU: nếu ngân hàng câu có chủ sở hữu/bộ đề riêng từng người, đổi truy vấn này để chỉ lấy chủ điểm CỦA NGƯỜI ĐÓ
// và bỏ chủ điểm đang bị ẩn (🙈 Ẩn bộ/câu ML).
async function defaultListTopics(client) {
  return (await client.query(`SELECT DISTINCT topic FROM questions WHERE topic IS NOT NULL AND topic <> ''`)).rows.map((r) => r.topic);
}

async function readPet(client, userId) {
  return (await client.query(
    `SELECT species, name, enabled, to_char(rest_until, 'YYYY-MM-DD') AS rest_until FROM pet_state WHERE user_id = $1`, [userId]
  )).rows[0] || null;
}

/* `gifts` là kết quả xu.dailyGifts (đã có tập ngày học + lượt hôm nay) — khỏi truy vấn attempts lần hai. */
async function buildState(client, userId, synced, pet, listTopics, gifts) {
  const today = TownCore.dayKey(Date.now(), tz());
  const g = gifts || { studyDays: new Set(), todayAttempts: 0, granted: {}, given: [] };

  // Ngày ôn gần nhất + tổng đã kiếm theo khu (từ sổ cái bài học)
  const agg = {};
  (await client.query(
    `SELECT topic, sum(amount)::int AS earned, to_char(max(day), 'YYYY-MM-DD') AS last_study FROM town_ledger WHERE user_id = $1 GROUP BY topic`, [userId]
  )).rows.forEach((r) => { agg[r.topic] = { earned: r.earned, lastStudy: r.last_study }; });

  const topics = new Set([...(await listTopics(client, userId)), ...Object.keys(synced.plots)]);

  // Hình dáng trả về do TownCore.stateView định nghĩa một lần duy nhất (bản offline cũng dùng).
  return TownCore.stateView({
    today, zone: tz(),
    xu: synced.xu, xuDay: await xu.todayIncome(client, userId, today),
    plots: synced.plots, xp: synced.xp,
    dayState: synced.dayState, garden: synced.garden, treats: synced.treats,
    pet: pet ? { species: pet.species, name: pet.name, restUntil: pet.rest_until } : null,
    studyDays: g.studyDays, todayAttempts: g.todayAttempts,
    gifts: g.granted, given: g.given, topics: [...topics], agg,
  });
}

/* ---------- router ---------- */
function createTownRouter({ db, listTopics } = {}) {
  if (!db || typeof db.withTransaction !== "function") throw new Error("createTownRouter cần db.withTransaction");
  const topicsFn = listTopics || defaultListTopics;
  const router = express.Router();
  router.use(express.json({ limit: "10kb" }));

  const route = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      const status = err.status && err.status < 500 ? err.status : 500;
      if (status === 500) console.error("[town]", err);
      res.status(status).json({ error: status === 500 ? "Lỗi máy chủ, bạn thử lại sau nhé." : err.message });
    });

  /* Đồng bộ bài học + tặng quà mỗi ngày rồi trả toàn bộ trạng thái.
     Khi đã tắt: không đồng bộ, không tặng, không tính gì (bật lại sẽ tiếp từ last_attempt_id). */
  async function stateAfter(client, uid) {
    const pet = await readPet(client, uid);
    if (pet && !pet.enabled) return { enabled: false, tz: tz(), today: TownCore.dayKey(Date.now(), tz()), pet: null, districts: [], garden: null };
    const synced = await xu.syncLessons(client, uid);
    const gifts = await xu.dailyGifts(client, uid);
    synced.xu = gifts.xu; // quà tặng trong chính lần đọc này phải thấy ngay, không trễ một lượt
    return buildState(client, uid, synced, pet, topicsFn, gifts);
  }
  async function requireEnabled(client, uid) {
    const pet = await readPet(client, uid);
    if (pet && !pet.enabled) throw httpError(409, "Thú ảo và thị trấn đang tắt.");
    return pet;
  }

  router.get("/", route(async (req, res) => {
    const uid = uidOf(req);
    res.json(await db.withTransaction((c) => stateAfter(c, uid)));
  }));

  router.post("/pet", route(async (req, res) => {
    const uid = uidOf(req), { species, name } = req.body || {};
    const nm = typeof name === "string" ? name.trim() : "";
    const len = [...nm].length;
    if (!len || len > 20 || /[\u0000-\u001f]/.test(nm)) throw httpError(400, "Tên thú phải có từ 1 đến 20 ký tự.");
    res.json(await db.withTransaction(async (c) => {
      const cur = await readPet(c, uid);
      if (cur) await c.query(`UPDATE pet_state SET name = $2, updated_at = now() WHERE user_id = $1`, [uid, nm]); // đã có thú: chỉ đổi tên, loài giữ nguyên
      else {
        if (!SPECIES.includes(species)) throw httpError(400, "Loài thú không hợp lệ.");
        await c.query(`INSERT INTO pet_state (user_id, species, name) VALUES ($1, $2, $3)`, [uid, species, nm]);
      }
      return stateAfter(c, uid);
    }));
  }));

  /* Nâng cấp một ô đất bằng xu (giá 20/50/100 theo cấp, TownCore.CONFIG.buildCost). */
  router.post("/build", route(async (req, res) => {
    const uid = uidOf(req), { topic, plot } = req.body || {};
    if (typeof topic !== "string" || !topic) throw httpError(400, "Thiếu khu cần xây.");
    res.json(await db.withTransaction(async (c) => {
      await requireEnabled(c, uid);
      const s = await xu.syncLessons(c, uid); // vừa đồng bộ vừa khóa dòng town_state: hai lần xây song song sẽ xếp hàng
      const r = TownCore.build(s.plots, s.xu, topic, plot); // ném lỗi 400/409 tiếng Việt nếu sai
      await c.query(`UPDATE town_state SET plots = $2, xu = $3, updated_at = now() WHERE user_id = $1`, [uid, r.plots, r.xu]);
      await xu.spend(c, uid, "build", r.cost, { topic, slot: plot, xuAfter: r.xu });
      return { plots: r.plots[topic], xu: r.xu, cost: r.cost, level: r.level };
    }));
  }));

  /* Vườn hoa (kiểu Khu Vườn Trên Mây): plant = mua hạt bằng xu, water = miễn phí tối đa một lần/ngày/ô,
     harvest = trả lại xu nhưng bị trần xu-do-vườn mỗi ngày.
     Thu hoạch KHÔNG cộng XP thú: XP chỉ đến từ ôn bài. Vượt trần thì cây vẫn nằm nguyên đó. */
  router.post("/garden", route(async (req, res) => {
    const uid = uidOf(req);
    const { action, slot, flower } = req.body || {};
    if (action !== "plant" && action !== "water" && action !== "harvest") throw httpError(400, "Hành động vườn không hợp lệ.");
    res.json(await db.withTransaction(async (c) => {
      await requireEnabled(c, uid);
      const s = await xu.syncLessons(c, uid);
      const today = TownCore.dayKey(Date.now(), tz());
      let garden = s.garden, balance = s.xu, extra = {};
      if (action === "plant") {
        const r = TownCore.plant(s.garden, s.xu, slot, flower, today);
        garden = r.garden; balance = r.xu; extra = { cost: r.cost };
      } else if (action === "water") {
        const r = TownCore.water(s.garden, slot, today);
        garden = r.garden; extra = { bloomed: r.bloomed };
      } else {
        const r = TownCore.harvest(s.garden, s.xu, slot, today);
        garden = r.garden; balance = r.xu; extra = { gain: r.gain, flower: r.flower };
      }
      await c.query(`UPDATE town_state SET garden = $2, xu = $3, updated_at = now() WHERE user_id = $1`, [uid, garden, balance]);
      if (action === "plant") await xu.spend(c, uid, "seed", extra.cost, { slot, xuAfter: balance });
      // xu vườn phải có mặt trong lịch sử ví: số dư đã cộng ở UPDATE trên nên chỉ ghi sổ, không cộng hai lần
      if (action === "harvest" && extra.gain) await xu.logIncome(c, { userId: uid, source: "garden", ref: `garden:${slot}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, amount: extra.gain, day: today, meta: { flower: extra.flower } });
      return Object.assign({ action, slot, garden: TownCore.gardenView(garden, today), xu: balance }, extra);
    }));
  }));

  /* Cho thú của người chơi ăn: miễn phí, một lần/ngày, không đổi xu, không đổi XP (không có gì để cày).
     Thị trấn không còn thú thường trực nên chỉ cho ăn đúng con mình đã chọn. */
  router.post("/feed", route(async (req, res) => {
    const uid = uidOf(req), species = (req.body || {}).species;
    res.json(await db.withTransaction(async (c) => {
      const pet = await requireEnabled(c, uid);
      if (!pet) throw httpError(404, "Bạn chưa chọn thú.");
      if (species !== pet.species) throw httpError(400, `Thị trấn của bạn chỉ có ${TownCore.PETS[pet.species].name}. Hãy cho nó ăn.`);
      const s = await xu.syncLessons(c, uid);
      const today = TownCore.dayKey(Date.now(), tz());
      const r = TownCore.feed(s.treats, species, today);
      await c.query(`UPDATE town_state SET treats = $2, updated_at = now() WHERE user_id = $1`, [uid, r.treats]);
      return { species, name: TownCore.PETS[species].name, line: r.line, treats: r.treats };
    }));
  }));

  router.post("/rest", route(async (req, res) => {
    const uid = uidOf(req), days = (req.body || {}).days;
    if (!Number.isInteger(days) || days < 0 || days > C.maxRestDays) throw httpError(400, `Số ngày nghỉ phải từ 0 đến ${C.maxRestDays}.`);
    res.json(await db.withTransaction(async (c) => {
      const pet = await requireEnabled(c, uid);
      if (!pet) throw httpError(404, "Bạn chưa chọn thú.");
      const until = days === 0 ? null : TownCore.addDays(TownCore.dayKey(Date.now(), tz()), days - 1);
      await c.query(`UPDATE pet_state SET rest_until = $2::date, updated_at = now() WHERE user_id = $1`, [uid, until]);
      return stateAfter(c, uid);
    }));
  }));

  router.post("/settings", route(async (req, res) => {
    const uid = uidOf(req), enabled = (req.body || {}).enabled;
    if (typeof enabled !== "boolean") throw httpError(400, "Thiếu giá trị bật/tắt.");
    res.json(await db.withTransaction(async (c) => {
      if (!(await readPet(c, uid))) throw httpError(404, "Hãy chọn thú trước.");
      await c.query(`UPDATE pet_state SET enabled = $2, updated_at = now() WHERE user_id = $1`, [uid, enabled]);
      return { enabled };
    }));
  }));

  /* Sổ cái bài học (mọi dòng đều là xu). Lịch sử cả ví — gồm quà, game, file và chi tiêu — ở GET /api/xu/history. */
  router.get("/ledger", route(async (req, res) => {
    const uid = uidOf(req), limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json(await db.withTransaction(async (c) => {
      await requireEnabled(c, uid);
      await xu.syncLessons(c, uid);
      const rows = (await c.query(
        `SELECT topic, kind, amount, to_char(day, 'YYYY-MM-DD') AS day FROM town_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT $2`, [uid, limit]
      )).rows;
      return { items: rows };
    }));
  }));

  return router;
}

/* ---------- chuyển dữ liệu Khách -> tài khoản mới (gọi trong bước "nhận lại dữ liệu khách" của auth.js) ---------- */
/* Phải chạy CÙNG giao dịch với việc chuyển bảng attempts sang tài khoản mới (sổ cái tham chiếu theo attempt_id).
   Nếu tài khoản mới đã có dữ liệu thì KHÔNG ghi đè, trả { moved:false, conflict:true } để hỏi lại người dùng. */
async function transferGuestData(client, guestId, newUserId) {
  const has = await client.query(
    `SELECT 1 FROM pet_state WHERE user_id = $1
     UNION ALL SELECT 1 FROM town_state WHERE user_id = $1
     UNION ALL SELECT 1 FROM xu_ledger WHERE user_id = $1 LIMIT 1`, [newUserId]
  );
  if (has.rowCount > 0) return { moved: false, conflict: true };
  for (const table of ["pet_state", "town_state", "town_ledger", "xu_ledger", "xu_spend", "xu_rounds"])
    await client.query(`UPDATE ${table} SET user_id = $2 WHERE user_id = $1`, [guestId, newUserId]);
  return { moved: true, conflict: false };
}

module.exports = { createTownRouter, buildState, transferGuestData, SPECIES };
