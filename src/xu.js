"use strict";
/* VÍ XU CHUNG của toàn bộ trò chơi học tập.
   Gắn vào server.js SAU middleware gán req.userId (0 = Khách):

     const xu = require("./xu");
     app.use("/api/xu", xu.createXuRouter({ db }));
     db.applySchema().then(() => xu.migrateAll(db))   // xem server.js

   Một số dư duy nhất nằm ở town_state.xu, mọi thứ tiêu nó: nâng cấp thị trấn, mua hạt, mua thú/thức ăn
   trên quần đảo, chăm cây anh đào. Tám nguồn thu (luật và định mức ở TownCore.CONFIG.xu — SỬA Ở ĐÓ DUY NHẤT):
     bài học   -> đồng bộ từ bảng attempts (town_ledger, một lượt chỉ thưởng một lần, trần 60 xu/ngày)
     học thêm  -> cũng từ attempts: +1 mỗi câu đúng SAU khi đã hết trần bài học (extra.cap 20/ngày, không cộng XP)
     trò chơi  -> xin ván ở /api/xu/round/start + /finish (đường cũ /api/xu/game còn bật qua legacyGame)
     ôn từ     -> POST /api/words/:id/review (+1 mỗi thẻ, trần 15/ngày)
     từ mới    -> POST /api/words khi thực sự tạo thẻ mới (+2, trần 6/ngày)
     nộp file  -> grant({source:"file"}) từ server.js sau khi import xong
     mỗi ngày  -> quà đăng nhập 5 xu
     chuỗi     -> quà mốc 3/7/14/30/50/100/200/365 ngày học liên tiếp
   Thu hoạch vườn hoa cũng ghi sổ (source "garden") nhưng do /api/town/garden tự cộng vào ví
   trong cùng giao dịch — logIncome() chỉ ghi, không cộng lần hai.
   Chữ "xu" trong file này luôn là xu CỦA VÍ; không còn vật liệu riêng từng khu. */
const express = require("express");
const crypto = require("crypto");
const TownCore = require("./town-core");
const C = TownCore.CONFIG, XU = C.xu, XG = C.xu.game;

const BATCH = 2000;
const tz = () => process.env.APP_TZ || C.tz;
const httpError = (status, message) => Object.assign(new Error(message), { status });
const uidOf = (req) => (Number.isInteger(req.userId) ? req.userId : 0);
const money = (v) => Math.max(0, Math.floor(Number(v) || 0));

/* ---------- dòng ví ---------- */
/* Lần đầu: bỏ qua lịch sử cũ hơn backfillDays ngày để không phát xu ào ạt. */
async function ensureRow(client, userId) {
  await client.query(
    `INSERT INTO town_state (user_id, last_attempt_id)
     VALUES ($1, (SELECT coalesce(max(id), 0) FROM attempts WHERE user_id = $1 AND created_at < now() - make_interval(days => $2::int)))
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, C.backfillDays]
  );
}

/* ---------- bài học -> xu (đây là con đường duy nhất biến lượt trả lời thành xu: 60 đầu tiên + "học thêm") ---------- */
/* Gọi TRONG một giao dịch. Khóa dòng town_state (FOR UPDATE) nên hai tab cùng đồng bộ/xây sẽ xếp hàng. */
async function syncLessons(client, userId) {
  const zone = tz();
  await ensureRow(client, userId);
  const st = (await client.query(`SELECT * FROM town_state WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
  let dayState = st.day_state && st.day_state.day ? st.day_state : null;
  let xu = money(st.xu), xp = st.xp, last = Number(st.last_attempt_id);
  /* Phần "HỌC THÊM" còn lại hôm nay (trần extra.cap, đã trừ những gì đã ghi hôm nay). cap 0 -> 0 -> tắt hẳn nhóm này. */
  const extraDay = TownCore.dayKey(Date.now(), zone);
  let extraLeft = TownCore.room(XU.extra.cap, (await client.query(
    `SELECT coalesce(sum(amount), 0)::int AS n FROM xu_ledger WHERE user_id = $1 AND day = $2 AND source = 'extra'`,
    [userId, extraDay]
  )).rows[0].n);

  for (;;) {
    const batch = (await client.query(
      `SELECT a.id, a.question_id AS qid, a.correct, a.created_at, q.topic
         FROM attempts a LEFT JOIN questions q ON q.id = a.question_id
        WHERE a.user_id = $1 AND a.id > $2 ORDER BY a.id LIMIT ${BATCH}`,
      [userId, last]
    )).rows;
    if (!batch.length) break;

    // "Trí nhớ" từng câu chỉ từ các lượt TRƯỚC lô này (id <= last)
    const qids = [...new Set(batch.map((r) => r.qid).filter((v) => v != null))];
    const mem = {};
    if (qids.length) {
      const rows = (await client.query(
        `SELECT question_id,
                count(*) FILTER (WHERE correct)::int AS oks,
                (array_agg(correct ORDER BY id DESC))[1] AS last,
                (extract(epoch FROM max(created_at)) * 1000)::bigint AS last_ts
           FROM attempts
          WHERE user_id = $1 AND id <= $2 AND question_id = ANY($3)
          GROUP BY question_id`,
        [userId, last, qids]
      )).rows;
      for (const r of rows) mem[String(r.question_id)] = { oks: r.oks, last: r.last, lastTs: Number(r.last_ts) };
    }

    // Bỏ qua lượt không biết chủ điểm (câu đã xóa) — vẫn tiến mốc
    const list = batch
      .filter((r) => r.qid != null && r.topic)
      .map((r) => ({ id: Number(r.id), ts: new Date(r.created_at).getTime(), qid: String(r.qid), topic: r.topic, correct: !!r.correct }));
    const out = TownCore.applyAttempts(dayState, mem, list, zone);
    dayState = out.state;

    // Chỉ cộng những dòng sổ cái THỰC SỰ được chèn (UNIQUE(user_id, attempt_id)) => chạy lại không thưởng hai lần
    for (const l of out.ledger) {
      const ins = await client.query(
        `INSERT INTO town_ledger (user_id, attempt_id, topic, kind, amount, day)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [userId, l.attemptId, l.topic, l.kind, l.amount, l.day]
      );
      if (ins.rowCount === 1) { xu += l.amount; xp += l.amount; }
    }
    /* HỌC THÊM: câu ĐÚNG nhưng bị trần bài học chặn (kind 'cap' -> out.cut) vẫn +1 xu, tối đa extra.cap/ngày.
       Không cộng XP thú (xp chỉ đến từ town_ledger) — trần 60 XP/ngày của thú giữ nguyên như cũ.
       ref 'attempt:<id>' + UNIQUE(user_id, source, source_ref) => đồng bộ lại/khôi phục mốc không in xu lần hai. */
    for (const c of out.cut) {
      if (extraLeft <= 0) break;
      const g = await grant(client, { userId, source: "extra", ref: `attempt:${c.attemptId}`, amount: XU.extra.perAttempt, day: extraDay });
      if (g.reason === "already") continue; // mất mốc last_attempt_id rồi đồng bộ lại: lượt cũ không in xu lần hai
      if (!g.granted) break;                // grant đã cắt theo trần ngày: còn thừa bao nhiêu cũng thành 0
      xu += g.amount; extraLeft -= g.amount;
    }
    last = Number(batch[batch.length - 1].id);
    if (batch.length < BATCH) break;
  }

  await client.query(
    `UPDATE town_state SET xu = $2, xp = $3, day_state = $4, last_attempt_id = $5, updated_at = now() WHERE user_id = $1`,
    [userId, xu, xp, dayState || {}, last]
  );
  return { xu, plots: st.plots || {}, xp, dayState: dayState || {}, garden: st.garden || {}, treats: st.treats || {} };
}

/* ---------- cộng xu (idempotent) ---------- */
/* source/ref: 'game' + '<trò>[:<mã game>]:<ván>' · 'file' + 'file:<id source_files>' · 'login' + 'login:<ngày>'
   · 'streak' + 'streak:<mốc>' · 'convert' + 'convert:materials' · 'extra' + 'attempt:<attempts.id>'
   · 'words' + 'word:<saved_words.id>:<ngày>' · 'wordnew' + 'wordnew:<saved_words.id>'.
   Trần ngày (DAY_CAP) áp cho mọi nguồn cày được; trần 0 nghĩa là nhóm đó KHÔNG thưởng gì (đúng hành vi cũ).
   Quà đăng nhập/chuỗi tự giới hạn (một ngày một lần, một mốc một lần đời) nên không cần trần. */
/* Trần ngày đọc LIVE từ CONFIG mỗi lần gọi (không snapshot lúc require) => đổi số trong town-core.js là có hiệu lực
   ngay, kể cả trong test: đặt cap của một nhóm = 0 là nhóm đó tắt thưởng, trở về đúng hành vi bản cũ. */
const DAY_CAP = () => ({ game: XG.cap, file: XU.file.cap, extra: XU.extra.cap, words: XU.words.cap, wordnew: XU.wordnew.cap });
const CAP_LABEL = { game: "trò chơi", file: "file nộp", extra: "phần học thêm", words: "thẻ từ đã ôn", wordnew: "từ mới lưu" };
async function grant(client, o) {
  const amount = money(o.amount);
  if (!amount) return { granted: false, amount: 0, reason: "empty" };
  await ensureRow(client, o.userId);
  await client.query(`SELECT xu FROM town_state WHERE user_id = $1 FOR UPDATE`, [o.userId]);
  const day = o.day || TownCore.dayKey(Date.now(), tz());
  const cap = DAY_CAP()[o.source];
  if (cap == null) return insert(client, o, amount, day); // nguồn tự giới hạn: không có trần

  const rows = (await client.query(
    `SELECT source_ref, amount FROM xu_ledger WHERE user_id = $1 AND day = $2 AND source = $3`,
    [o.userId, day, o.source]
  )).rows;
  const used = rows.reduce((s, r) => s + r.amount, 0);
  if (o.source === "game") {
    // hạn số ván tính theo TỪNG mã: 'duck' · 'maze' · 'skill:<mã game>' — mỗi trò kỹ năng một hạn riêng
    const key = TownCore.gameKeyOf(o.ref);
    const plays = rows.filter((r) => TownCore.gameKeyOf(r.source_ref) === key).length;
    const limit = TownCore.roundLimit(key);
    if (plays >= limit) return { granted: false, amount: 0, reason: `Trò này hôm nay đã tặng đủ ${limit} ván rồi.` };
  }
  const left = TownCore.room(cap, used);
  if (!left) return { granted: false, amount: 0, reason: `Hôm nay ${CAP_LABEL[o.source] || o.source} đã tặng đủ ${cap} xu.` };
  return insert(client, o, Math.min(amount, left), day); // không vượt trần: phần thiếu chỉ đơn giản là không có
}

async function insert(client, o, amount, day) {
  const ins = await client.query(
    `INSERT INTO xu_ledger (user_id, source, source_ref, amount, day, meta)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, source, source_ref) DO NOTHING`,
    [o.userId, o.source, o.ref, amount, day, o.meta || {}]
  );
  if (ins.rowCount !== 1) return { granted: false, amount: 0, reason: "already" };
  const upd = await client.query(
    `UPDATE town_state SET xu = xu + $2, updated_at = now() WHERE user_id = $1 RETURNING xu`,
    [o.userId, amount]
  );
  return { granted: true, amount, xu: upd.rows[0].xu, day };
}

/* Ghi một dòng sổ cái NHƯNG KHÔNG cộng vào ví — dành cho nguồn thu mà người gọi đã tự cộng
   vào `town_state.xu` trong cùng giao dịch (vườn hoa: TownCore.harvest trả về số dư mới).
   Sổ cái vẫn cần có để lịch sử ví đối chiếu được: thu − chi = số dư. */
async function logIncome(client, o) {
  const amount = money(o.amount);
  if (!amount) return { logged: false, amount: 0 };
  await client.query(
    `INSERT INTO xu_ledger (user_id, source, source_ref, amount, day, meta)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, source, source_ref) DO NOTHING`,
    [o.userId, o.source, o.ref, amount, o.day || TownCore.dayKey(Date.now(), tz()), o.meta || {}]
  );
  return { logged: true, amount };
}

/* ---------- tiêu xu ---------- */
/* Caller phải ĐỒNG BỘ (syncLessons) trước trong cùng giao dịch: đồng bộ đã khóa dòng ví nên không ai tiêu
   nhiều hơn số mình có. Số dư sau khi tiêu được ghi lại để đối chiếu. */
async function spend(client, userId, kind, cost, extra) {
  await client.query(
    `INSERT INTO xu_spend (user_id, kind, topic, slot, cost, xu) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, kind, (extra && extra.topic) || null, (extra && Number.isInteger(extra.slot)) ? extra.slot : null, money(cost), money(extra && extra.xuAfter)]
  );
}

/* ---------- số dư hôm nay ---------- */
/* Một lượt truy vấn nhỏ (<= vài chục dòng/ngày) gộp lại mọi nguồn ngoài bài học.
   `rounds` đếm theo MÃ NHÓM (TownCore.gameKeyOf): duck · maze · skill:<mã game> — hạn ván của từng mã đọc từ CONFIG. */
async function todayIncome(client, userId, day) {
  const rows = (await client.query(
    `SELECT source, source_ref, amount FROM xu_ledger WHERE user_id = $1 AND day = $2`,
    [userId, day]
  )).rows;
  const out = { game: 0, file: 0, login: 0, streak: 0, convert: 0, garden: 0, extra: 0, words: 0, wordnew: 0 }, rounds = {};
  for (const r of rows) {
    out[r.source] = (out[r.source] || 0) + r.amount;
    if (r.source === "game") {
      const key = TownCore.gameKeyOf(r.source_ref);
      rounds[key] = (rounds[key] || 0) + 1;
    }
  }
  const lesson = (await client.query(
    `SELECT coalesce(sum(amount), 0)::int AS n FROM town_ledger WHERE user_id = $1 AND day = $2`, [userId, day]
  )).rows[0].n;
  return { lesson: lesson || 0, game: out.game, file: out.file, login: out.login, streak: out.streak, garden: out.garden, extra: out.extra, words: out.words, wordnew: out.wordnew, rounds };
}

/* ---------- quà mỗi ngày: đăng nhập + mốc chuỗi ---------- */
/* Gọi cuối mỗi lần đọc thị trấn/ví. Không trừ lốt, không dọa nghỉ: mốc đã lãnh thì vĩnh viễn đã lãnh. */
async function dailyGifts(client, userId) {
  const zone = tz(), today = TownCore.dayKey(Date.now(), zone);
  await ensureRow(client, userId);
  const st = (await client.query(`SELECT gift FROM town_state WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
  const g = st.gift || {};
  const granted = { loginDay: g.loginDay || null, streakGranted: (g.streakGranted || []).map(Number) };
  const given = [];

  if (granted.loginDay !== today) {
    const r = await grant(client, { userId, source: "login", ref: `login:${today}`, amount: XU.login.gift, day: today });
    if (r.granted) { granted.loginDay = today; given.push({ kind: "login", days: null, amount: r.amount, label: `Quà mỗi ngày +${r.amount} xu` }); }
  }

  const days = (await client.query(
    `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day, count(*)::int AS n
       FROM attempts WHERE user_id = $1 GROUP BY 1 ORDER BY 1 DESC LIMIT 400`, [userId, zone]
  )).rows;
  const studyDays = new Set(days.filter((d) => d.n >= C.fedMinAttempts).map((d) => d.day));
  const streak = TownCore.streakPending(TownCore.streakOf(studyDays, today), granted.streakGranted);
  for (const m of streak.due) {
    const r = await grant(client, { userId, source: "streak", ref: `streak:${m.days}`, amount: m.gift, day: today, meta: { days: m.days } });
    if (r.granted) { granted.streakGranted.push(m.days); given.push({ kind: "streak", days: m.days, amount: r.amount, label: `Chuỗi ${m.days} ngày học +${r.amount} xu` }); }
  }

  if (given.length) await client.query(`UPDATE town_state SET gift = $2, updated_at = now() WHERE user_id = $1`, [userId, granted]);
  // Số dư ĐỌC LẠI sau khi tặng quà: nếu không, ngay lần đọc đầu tiên trong ngày giao diện vẫn báo ví thiếu 5 xu.
  const xuNow = Number((await client.query(`SELECT xu FROM town_state WHERE user_id = $1`, [userId])).rows[0].xu);
  // Trả luôn tập ngày học + lượt hôm nay: giao diện thị trấn cần đúng những số này, khỏi tính lại.
  return {
    given, granted, xu: xuNow, length: streak.length, next: streak.next, studyDays,
    todayAttempts: (days.find((d) => d.day === today) || { n: 0 }).n,
  };
}

/* ---------- chuyển vật liệu cũ + xu anh đào sang ví chung ---------- */
/* Chạy một lần mỗi lần khởi động, KHÔNG mất gì và chạy lại vẫn y nguyên:
     vật liệu các khu  -> cộng 1:1 vào xu, ghi sổ 'convert', xóa materials
     xu còn lại của cây anh đào -> cộng vào xu, set coins = 0
     mốc đồng bộ       -> lấy max hai bên để không thưởng lại lượt cũ
   sakura_ledger giữ nguyên làm lịch sử, KHÔNG chuyển (nó trùng từng lượt với town_ledger). */
async function migrateWallet(client) {
  await client.query(`INSERT INTO town_state (user_id) SELECT user_id FROM sakura_state ON CONFLICT (user_id) DO NOTHING`);
  const ids = (await client.query(`SELECT user_id FROM town_state UNION SELECT user_id FROM sakura_state ORDER BY 1`)).rows.map((r) => r.user_id);
  const done = [];
  for (const userId of ids) {
    await ensureRow(client, userId);
    const st = (await client.query(`SELECT xu, materials, last_attempt_id FROM town_state WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
    const sak = (await client.query(`SELECT coins, last_attempt_id FROM sakura_state WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
    const mat = Object.values(st.materials || {}).reduce((s, v) => s + money(v), 0);
    const coins = sak ? money(sak.coins) : 0;
    const total = mat + coins;
    /* Mốc đồng bộ CŨ (trước khi đổi sang ví chung) — lưu vào meta để lịch sử ví biết
       các dòng town_ledger dưới mốc này đã được tính một lần vào dòng 'convert' rồi. */
    const upto = Math.max(Number(st.last_attempt_id), sak ? Number(sak.last_attempt_id) : 0);
    if (total > 0) {
      const day = TownCore.dayKey(Date.now(), tz());
      const ins = await client.query(
        `INSERT INTO xu_ledger (user_id, source, source_ref, amount, day, meta)
         VALUES ($1, 'convert', 'convert:materials', $2, $3, $4) ON CONFLICT (user_id, source, source_ref) DO NOTHING`,
        [userId, total, day, { materials: mat, sakura: coins, upto }]
      );
      if (ins.rowCount === 1) await client.query(`UPDATE town_state SET xu = xu + $2, updated_at = now() WHERE user_id = $1`, [userId, total]);
    }
    await client.query(`UPDATE town_state SET materials = '{}'::jsonb, last_attempt_id = $2, updated_at = now() WHERE user_id = $1 AND (materials <> '{}'::jsonb OR last_attempt_id <> $2)`, [userId, upto]);
    if (sak && (coins > 0 || Number(sak.last_attempt_id) !== upto)) {
      await client.query(`UPDATE sakura_state SET coins = 0, last_attempt_id = $2, updated_at = now() WHERE user_id = $1`, [userId, upto]);
    }
    if (total > 0) done.push({ userId, materials: mat, sakura: coins, xu: total });
  }
  return done;
}
const migrateAll = (db) => db.withTransaction((client) => migrateWallet(client));

/* ---------- API ---------- */
const GAMES = ["duck", "skill", "maze"];
/* Mã NHÓM bị giới hạn số ván/ngày: mỗi trò kỹ năng một hạn riêng ('skill:<mã trò>').
   Không gửi mã (đường cũ) -> 'skill': 18 trò kỹ năng chung một hạn, y như trước. */
function gameKey(game, skill) {
  if (game !== "skill") return game;
  const code = typeof skill === "string" ? skill.trim() : "";
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? "skill:" + code : "skill";
}
function createXuRouter({ db } = {}) {
  if (!db || typeof db.withTransaction !== "function") throw new Error("createXuRouter cần db.withTransaction");
  const router = express.Router();
  router.use(express.json({ limit: "10kb" }));

  const route = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      const status = err.status && err.status < 500 ? err.status : 500;
      if (status === 500) console.error("[xu]", err);
      res.status(status).json({ error: status === 500 ? "Lỗi máy chủ, bạn thử lại sau nhé." : err.message });
    });

  /* Số dư + hôm nay kiếm được bao nhiêu theo từng nguồn + quà còn chờ.
     `income`/`left`/`caps` có đủ SÁU nhóm cày được (bài học · học thêm · trò chơi · ôn từ · từ mới · file),
     `rounds` đếm ván đã thưởng theo từng mã trò, `rewards` trả đúng CONFIG.xu để giao diện không tự ghi số. */
  router.get("/", route(async (req, res) => {
    const uid = uidOf(req);
    res.json(await db.withTransaction(async (client) => {
      const w = await syncLessons(client, uid);
      const gifts = await dailyGifts(client, uid);
      const day = TownCore.dayKey(Date.now(), tz());
      const income = await todayIncome(client, uid, day);
      return {
        today: day, tz: tz(), balance: gifts.xu,
        income,
        left: {
          lesson: TownCore.room(C.dailyCap, w.dayState.day === day ? w.dayState.earned : 0),
          extra: TownCore.room(XU.extra.cap, income.extra),
          game: TownCore.room(XG.cap, income.game),
          words: TownCore.room(XU.words.cap, income.words),
          wordnew: TownCore.room(XU.wordnew.cap, income.wordnew),
          file: TownCore.room(XU.file.cap, income.file),
        },
        caps: {
          lesson: C.dailyCap, extra: XU.extra.cap, game: XG.cap,
          words: XU.words.cap, wordnew: XU.wordnew.cap, file: XU.file.cap,
        },
        rounds: income.rounds,
        gift: { length: gifts.length, next: gifts.next, loginDay: gifts.granted.loginDay },
        prices: { build: C.buildCost, seed: C.garden.seedCost, harvest: C.garden.harvestGain },
        games: XG,
        rewards: XU,
      };
    }));
  }));

  /* Lịch sử ví: thu (bài học + quà + game + file + vườn) và chi (xây, hạt, chăm cây) gộp theo thời gian.
     Phần bài học chỉ hiện từ SAU mốc chuyển đổi (meta.upto của dòng 'convert') — những lượt trước mốc đó
       đã được tính một lần vào dòng convert rồi, hiển thị lại sẽ thành đếm trùng. */
  router.get("/history", route(async (req, res) => {
    const uid = uidOf(req), limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json(await db.withTransaction(async (client) => {
      await syncLessons(client, uid);
      const rows = (await client.query(
        `SELECT 'in'::text AS direction, topic AS detail, amount, to_char(day, 'YYYY-MM-DD') AS day, created_at AS at, id FROM town_ledger
          WHERE user_id = $1 AND attempt_id > coalesce((SELECT (meta->>'upto')::bigint FROM xu_ledger WHERE user_id = $1 AND source = 'convert'), 0)
         UNION ALL
         SELECT 'in', source || ':' || source_ref, amount, to_char(day, 'YYYY-MM-DD'), created_at, id FROM xu_ledger WHERE user_id = $1
         UNION ALL
         SELECT 'out', coalesce(kind || ' ', '') || coalesce(topic || '', ''), -cost, to_char(created_at AT TIME ZONE $3, 'YYYY-MM-DD'), created_at, id FROM xu_spend WHERE user_id = $1
         ORDER BY at DESC, id DESC LIMIT $2`, [uid, limit, tz()]
      )).rows;
      return { items: rows };
    }));
  }));

  /* ĐƯỜNG CŨ — một ván chơi xong: server tính thưởng, không nhận điểm từ trình duyệt.
     round_id do trình duyệt sinh nên máy chủ KHÔNG chứng minh được ván đó có thật (V5); bản mới là
     /api/xu/round/start + /finish. Tắt hẳn bằng CONFIG.xu.legacyGame = false.
     Gửi kèm `skill: "<mã trò>"` -> hạn ván tính RIÊNG cho trò đó (source_ref = 'skill:<mã>:<ván>'). */
  router.post("/game", route(async (req, res) => {
    if (!XU.legacyGame) throw httpError(410, "Đường thưởng cũ đã tắt. Hãy xin ván ở /api/xu/round/start rồi báo /finish.");
    const uid = uidOf(req), b = req.body || {}, game = b.game;
    if (!GAMES.includes(game)) throw httpError(400, "Trò chơi không hợp lệ.");
    const round = typeof b.roundId === "string" ? b.roundId.trim() : "";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(round)) throw httpError(400, "Thiếu mã ván hợp lệ (6–64 ký tự).");
    const place = game === "maze" ? b.place : 0;
    if (game === "maze" && ![0, 1, 2].includes(Number(place))) throw httpError(400, "Hạng của mê cung phải là 0, 1 hoặc 2.");
    const want = TownCore.gameReward(game, game === "maze" ? Number(place) : 0);
    if (!want) throw httpError(400, "Ván này không có phần thưởng.");
    const key = gameKey(game, b.skill);
    res.json(await db.withTransaction(async (client) => {
      await syncLessons(client, uid); // khóa dòng ví trước, hai ván gửi cùng lúc sẽ xếp hàng
      const r = await grant(client, { userId: uid, source: "game", ref: `${key}:${round}`, amount: want, meta: { game, place: game === "maze" ? Number(place) : null } });
      if (!r.granted) {
        if (r.reason === "already") throw httpError(409, "Ván này đã được thưởng rồi.");
        throw httpError(409, r.reason || "Hôm nay không nhận thêm xu từ trò chơi được nữa.");
      }
      return { game, reward: r.amount, balance: r.xu };
    }));
  }));

  /* ---------- ván do MÁY CHỦ cấp (sửa V5: trình duyệt không tự bịa ván được nữa) ----------
     roundId do crypto sinh, dấu thời gian lấy từ đồng hồ MÁY CHỦ. Muốn có xu ván, finish phải chứng minh:
     ván còn mở + đủ dài (roundNeed.seconds, đo bởi server) + đủ lượt trả lời ĐÚNG LOẠI trong attempts.
     Bỏ ván giữa chừng: không có xu ván, nhưng từng câu đã trả lời vẫn nhận xu bài học như thường. */
  const newRoundId = () => "r" + Date.now().toString(36) + "-" + crypto.randomBytes(9).toString("hex");

  router.post("/round/start", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {}, game = b.game;
    if (!GAMES.includes(game)) throw httpError(400, "Trò chơi không hợp lệ.");
    if (game === "maze") throw httpError(400, "Mê cung ghi xu khi hoàn thành tầng, không cần xin ván.");
    const key = gameKey(game, b.skill); // 'duck' | 'skill:<mã trò>' — mỗi mã một hạn ván riêng
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      // Mỗi mã chỉ MỘT ván mở: ván đang dở bị đóng và coi như bỏ (không thưởng), rồi cấp ván mới.
      const closed = (await client.query(
        `UPDATE xu_rounds SET finished_at = now(), meta = meta || '{"abandoned":true}'::jsonb
          WHERE user_id = $1 AND game = $2 AND finished_at IS NULL RETURNING round_id`,
        [uid, key]
      )).rows.map((r) => r.round_id);
      const roundId = newRoundId();
      await client.query(`INSERT INTO xu_rounds (user_id, round_id, game) VALUES ($1, $2, $3)`, [uid, roundId, key]);
      const started = (await client.query(
        `SELECT started_at FROM xu_rounds WHERE user_id = $1 AND round_id = $2`, [uid, roundId]
      )).rows[0].started_at;
      // `reward` = số xu ván này SẼ nhận nếu đủ bằng chứng: giao diện hiện ngay lúc bảng điểm mở ra.
      const need = TownCore.roundNeed(key);
      return {
        roundId, game: key, startedAt: new Date(started).toISOString(),
        needs: need, reward: TownCore.gameReward(need.game, 0), closed,
      };
    }));
  }));

  router.post("/round/finish", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    const roundId = typeof b.roundId === "string" ? b.roundId.trim() : "";
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(roundId)) throw httpError(400, "Thiếu mã ván do máy chủ cấp.");
    const out = await db.withTransaction(async (client) => {
      const r = (await client.query(
        `SELECT game, started_at, finished_at FROM xu_rounds WHERE user_id = $1 AND round_id = $2 FOR UPDATE`,
        [uid, roundId]
      )).rows[0];
      if (!r) throw httpError(404, "Ván này không thuộc tài khoản của bạn.");
      if (r.finished_at) throw httpError(409, "Ván này đã đóng rồi — đã nhận thưởng hoặc đã bỏ giữa chừng.");
      const key = r.game, need = TownCore.roundNeed(key);
      const want = TownCore.gameReward(need.game, 0);
      if (!want) throw httpError(400, "Ván này không có phần thưởng.");
      const startedAt = new Date(r.started_at);
      const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      if (seconds > XG.ttlHours * 3600) {
        // Ván quá cũ: đóng + ghi dấu "bỏ" và COMMIT trước khi báo lỗi, để nó không mở mãi.
        await client.query(
          `UPDATE xu_rounds SET finished_at = now(), meta = meta || '{"abandoned":true}'::jsonb
            WHERE user_id = $1 AND round_id = $2 AND finished_at IS NULL`,
          [uid, roundId]
        );
        return { abandoned: true };
      }
      if (seconds < need.seconds) throw httpError(409, `Ván mới chạy ${seconds} giây — cần ít nhất ${need.seconds} giây.`);
      let evidence = 0;
      if (need.evidence) {
        evidence = (await client.query(
          `SELECT count(*)::int AS n FROM attempts WHERE user_id = $1 AND created_at >= $2 AND mode LIKE $3`,
          [uid, startedAt, need.mode]
        )).rows[0].n;
        if (evidence < need.evidence) throw httpError(409, `Ván chưa có đủ ${need.evidence} lượt trả lời (mới ${evidence} lượt).`);
      }
      await syncLessons(client, uid); // khóa dòng ví: hai ván nộp cùng lúc xếp hàng, không nhân đôi
      const g = await grant(client, {
        userId: uid, source: "game", ref: `${key}:${roundId}`, amount: want, meta: { game: key, seconds, evidence },
      });
      if (!g.granted) {
        // Hết trần nhóm thì đóng luôn ván: không được "để dành" ván hôm nay đổi xu ngày mai.
        await client.query(
          `UPDATE xu_rounds SET finished_at = now(), meta = meta || '{"noReward":true}'::jsonb WHERE user_id = $1 AND round_id = $2`,
          [uid, roundId]
        );
        return { refused: g.reason === "already" ? "Ván này đã được thưởng rồi." : g.reason };
      }
      await client.query(`UPDATE xu_rounds SET finished_at = now() WHERE user_id = $1 AND round_id = $2`, [uid, roundId]);
      return { game: key, reward: g.amount, balance: g.xu, seconds, evidence };
    });
    if (out.abandoned) throw httpError(409, `Ván mở hơn ${XG.ttlHours} giờ nên bị bỏ. Từng câu bạn đã trả lời vẫn có xu bài học.`);
    if (out.refused) throw httpError(409, out.refused || "Hôm nay không nhận thêm xu từ trò chơi được nữa.");
    res.json(out);
  }));

  return router;
}

/* Dời dữ liệu Khách (0) sang tài khoản mới: bản duy nhất nằm ở town.js (nó ôm luôn hai bảng xu). */

module.exports = {
  syncLessons, grant, logIncome, spend, todayIncome, dailyGifts, ensureRow,
  migrateWallet, migrateAll, createXuRouter, httpError, uidOf, tz, gameKey, GAMES,
};
