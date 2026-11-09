"use strict";
/* Kiểm thử tích hợp VÍ XU CHUNG (xu.js): server Express thật + PostgreSQL thật, 0 token, không gọi AI.
   Chạy:  node scripts/test-xu-api.js   (đọc DATABASE_URL từ .env ở gốc dự án)
   Script TỰ TẠO schema tạm `xu_test` (attempts/questions TỐI GIẢN + town.sql + sakura.sql), chạy xong XÓA schema.
   Ba backend cùng gắn trên một app ( /api/xu, /api/town, /api/sakura ) để chứng minh chúng dùng CHUNG một ví. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const T = require("../src/town-core");
const xu = require("../src/xu");
const { createTownRouter, transferGuestData } = require("../src/town");
const { createSakuraRouter, transferGuestData: transferSakura } = require("../src/sakura");

const URL_DB = process.env.DATABASE_URL;
if (!URL_DB) { console.error("Thiếu DATABASE_URL."); process.exit(2); }
const SCHEMA = "xu_test";
const pool = new Pool({ connectionString: URL_DB, options: `-c search_path=${SCHEMA}` });
const db = {
  async withTransaction(fn) {
    const c = await pool.connect();
    try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  },
};

const C = T.CONFIG, X = C.xu, XG = X.game, LOGIN = X.login.gift;
let pass = 0, fail = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
let origin;
const api = async (user, method, p, body) => {
  const r = await fetch(origin + p, { method, headers: { "content-type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const X_ = (u, method, p, body) => api(u, method, "/api/xu" + p, body);
const TZ_ = (u, method, p, body) => api(u, method, "/api/town" + p, body);
const SK_ = (u, method, p, body) => api(u, method, "/api/sakura" + p, body);

const today = T.dayKey(Date.now());
const at = (daysAgo, hh, mm = 0) => `${T.addDays(today, -daysAgo)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`;
let uid = 3000;
const newUser = () => ++uid;
const att = (u, q, correct, when, mode) => pool.query(
  `INSERT INTO attempts (user_id, question_id, correct, created_at, mode) VALUES ($1,$2,$3,$4,coalesce($5,'practice'))`,
  [u, q, correct, when || new Date(), mode]
);
/* Học n câu đúng liên tiếp trong `days` ngày gần nhất (mỗi ngày >= 5 lượt thì được tính là một ngày học). */
const study = async (u, n, days = 1) => {
  const per = Math.ceil(n / days);
  let k = 0;
  for (let d = days - 1; d >= 0; d--) for (let i = 0; i < per && k < n; i++, k++) await att(u, 1 + k, true, at(d, 9, i % 60));
};
const bal = (u) => pool.query(`SELECT xu FROM town_state WHERE user_id = $1`, [u]).then((r) => Number(r.rows[0].xu));
/* Bất biến sổ sách: tổng mọi dòng thu trừ mọi dòng chi phải đúng bằng số dư trong ví. */
const books = (u) => pool.query(
  `SELECT (SELECT coalesce(sum(amount),0)::int FROM town_ledger WHERE user_id = $1)
          + (SELECT coalesce(sum(amount),0)::int FROM xu_ledger  WHERE user_id = $1)
          - (SELECT coalesce(sum(cost), 0)::int FROM xu_spend    WHERE user_id = $1) AS expect,
          (SELECT xu FROM town_state WHERE user_id = $1) AS balance`, [u]
).then((r) => r.rows[0]);
const rows = (u, source) => pool.query(
  `SELECT source_ref, amount FROM xu_ledger WHERE user_id = $1 AND source = $2 ORDER BY id`, [u, source]
).then((r) => r.rows);

/* ---------- ván do MÁY CHỦ cấp ----------
   started_at là số của máy chủ, test không chờ 30 giây thật được => tua nó bằng SQL.
   playRound = một ván "tử tế": xin ván, trả lời đủ số lượt ĐÚNG LOẠI, rồi bước qua ngưỡng thời gian. */
const start = (u, game, skill) => X_(u, "POST", "/round/start", skill ? { game, skill } : { game });
const finish = (u, roundId, place) => X_(u, "POST", "/round/finish", place == null ? { roundId } : { roundId, place });
const rewind = (u, roundId, secs) => pool.query(
  `UPDATE xu_rounds SET started_at = started_at - make_interval(secs => $3) WHERE user_id = $1 AND round_id = $2`,
  [u, roundId, secs]
);
const openRounds = (u) => pool.query(`SELECT count(*)::int n FROM xu_rounds WHERE user_id = $1 AND finished_at IS NULL`, [u]).then((r) => r.rows[0].n);
const inc = async (u) => (await X_(u, "GET", "/")).body.income;
async function playRound(u, game, skill, answers) {
  const s = await start(u, game, skill);
  const need = T.roundNeed(s.body.game);
  const mode = game === "duck" ? "duck:fall" : "skill";
  for (let i = 0; i < (answers == null ? need.evidence : answers); i++) await att(u, 1 + i, true, new Date(), mode);
  await rewind(u, s.body.roundId, need.seconds + 1);
  return finish(u, s.body.roundId);
}

/* ================= mở ví ================= */
t("1  GET /api/xu lần đầu: quà đăng nhập 5 xu vào ví, bài học nhập cùng một chỗ", async () => {
  const u = newUser(); await study(u, 3);
  const r = await X_(u, "GET", "/");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.today, today);
  assert.deepStrictEqual(r.body.income, { lesson: 9, game: 0, file: 0, login: LOGIN, streak: 0, garden: 0, extra: 0, words: 0, wordnew: 0, rounds: {} });
  assert.strictEqual(r.body.balance, 9 + LOGIN);
  assert.deepStrictEqual(r.body.left, {
    lesson: C.dailyCap - 9, extra: X.extra.cap, game: XG.cap, words: X.words.cap, wordnew: X.wordnew.cap, file: X.file.cap,
  });
  assert.deepStrictEqual(r.body.caps, {
    lesson: C.dailyCap, extra: X.extra.cap, game: XG.cap, words: X.words.cap, wordnew: X.wordnew.cap, file: X.file.cap,
  });
  assert.deepStrictEqual(r.body.rewards, X, "máy chủ trả đúng cấu hình ở TownCore.CONFIG.xu, giao diện không tự ghi số");
  assert.deepStrictEqual([r.body.prices.build, r.body.prices.seed, r.body.games.duck], [C.buildCost, C.garden.seedCost, XG.duck]);
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
});
t("2  Đọc ba backend cùng thấy đúng một số dư", async () => {
  const u = newUser(); await study(u, 4); // 12 xu + quà 5
  const a = (await X_(u, "GET", "/")).body.balance;
  const b = (await TZ_(u, "GET", "/")).body.xu.balance;
  const c = (await SK_(u, "GET", "/")).body.coins;
  assert.strictEqual(a, 12 + LOGIN); assert.strictEqual(b, a); assert.strictEqual(c, a);
});
t("3  Quà đăng nhập chỉ một lần/ngày: đọc lại ví không tăng, gift.loginDay đúng hôm nay", async () => {
  const u = newUser(); await study(u, 2);
  const a = (await X_(u, "GET", "/")).body, b = (await X_(u, "GET", "/")).body;
  assert.strictEqual(a.balance, b.balance);
  assert.strictEqual(b.gift.loginDay, today);
  assert.strictEqual(b.income.login, LOGIN);
});

/* ================= trò chơi ================= */
t("4  Một ván vịt: +4 xu, đúng mã ván chỉ thưởng một lần", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const r = await X_(u, "POST", "/game", { game: "duck", roundId: "duck-000001" });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual([r.body.reward, r.body.balance], [XG.duck, LOGIN + XG.duck]);
  const again = await X_(u, "POST", "/game", { game: "duck", roundId: "duck-000001" });
  assert.strictEqual(again.status, 409); assert.match(again.body.error, /đã được thưởng/);
  assert.strictEqual(await bal(u), LOGIN + XG.duck, "ván cũ không in thêm xu");
  assert.strictEqual((await X_(u, "GET", "/")).body.income.game, XG.duck);
});
t("5  Mê cung trả thưởng theo hạng: Vàng 15 · Bạc 10 · Đồng 6", async () => {
  const want = [XG.maze[0], XG.maze[1], XG.maze[2]];
  assert.deepStrictEqual(want, [15, 10, 6]);
  const got = [];
  for (const place of [0, 1, 2]) {
    const u = newUser(); await X_(u, "GET", "/");
    const r = await X_(u, "POST", "/game", { game: "maze", roundId: `maze-${place}-aaaaaa`, place });
    assert.strictEqual(r.status, 200);
    got.push(r.body.reward);
  }
  assert.deepStrictEqual(got, want);
});
t("6  Trần " + XG.cap + " xu một ngày cho cả nhà trò chơi: ván cuối chỉ nhận phần còn lại, rồi hết", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const a = await X_(u, "POST", "/game", { game: "maze", roundId: "maze-a1", place: 0 });   // 15
  const b = await X_(u, "POST", "/game", { game: "duck", roundId: "duck-b1" });              // 4  -> 19
  const c = await X_(u, "POST", "/game", { game: "duck", roundId: "duck-c2" });              // 4  -> 23
  const d = await X_(u, "POST", "/game", { game: "skill", roundId: "skill-d3" });            // 3  -> 26
  const e = await X_(u, "POST", "/game", { game: "maze", roundId: "maze-e4", place: 1 });    // 10 nhưng chỉ còn 4
  assert.deepStrictEqual([a, b, c, d, e].map((r) => r.body.reward), [15, 4, 4, 3, 4]);
  const f = await X_(u, "POST", "/game", { game: "duck", roundId: "duck-f5" });              // chưa vượt hạn ván nhưng hết trần tiền
  assert.strictEqual(f.status, 409); assert.match(f.body.error, new RegExp(String(XG.cap) + " xu"));
  assert.deepStrictEqual([f.body.error, (await X_(u, "GET", "/")).body.left.game], [`Hôm nay trò chơi đã tặng đủ ${XG.cap} xu.`, 0]);
  const s = (await X_(u, "GET", "/")).body;
  assert.strictEqual(s.income.game, XG.cap);
  assert.deepStrictEqual(s.income.rounds, { maze: 2, duck: 2, skill: 1 }, "đếm ván theo từng mã");
});
t("7  Hạn ván theo TỪNG mã trò: mỗi trò kỹ năng một bộ đếm riêng", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  for (let i = 0; i < XG.rounds.skill; i++) {
    assert.strictEqual((await X_(u, "POST", "/game", { game: "skill", skill: "bong", roundId: "skill-" + i + "-pad" })).status, 200);
  }
  const r = await X_(u, "POST", "/game", { game: "skill", skill: "bong", roundId: "skill-999999" });
  assert.strictEqual(r.status, 409); assert.match(r.body.error, new RegExp(String(XG.rounds.skill) + " ván"));
  // một trò kỹ năng KHÁC không bị liên lụy; đường cũ không gửi mã vẫn dùng hạn chung 'skill'
  assert.strictEqual((await X_(u, "POST", "/game", { game: "skill", skill: "nap", roundId: "skill-n1-pad" })).status, 200);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "skill", roundId: "skill-old-1" })).status, 200);
  assert.strictEqual(await bal(u), LOGIN + XG.skill * (XG.rounds.skill + 2));
  assert.strictEqual((await rows(u, "game")).length, XG.rounds.skill + 2, "đúng số ván được ghi sổ");
  assert.deepStrictEqual((await X_(u, "GET", "/")).body.income.rounds, { "skill:bong": 2, "skill:nap": 1, skill: 1 });
});
t("8  Hai ván gửi cùng lúc vẫn chỉ một ván được thưởng (độc lập nhờ khóa dòng ví)", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const rs = await Promise.all([0, 1].map(() => X_(u, "POST", "/game", { game: "duck", roundId: "same-round-1" })));
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [200, 409]);
  assert.strictEqual(await bal(u), LOGIN + XG.duck);
  assert.strictEqual((await rows(u, "game")).length, 1);
});
t("9  Chặn gian dối từ trình duyệt: trò lạ / mã ván ngắn / hạng ngoài 0..2 / ván không thưởng", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  assert.strictEqual((await X_(u, "POST", "/game", { game: "lol", roundId: "abcdef" })).status, 400);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "duck", roundId: "abc" })).status, 400);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "duck", roundId: "có dấu & khoảng trắng" })).status, 400);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "maze", roundId: "maze-x", place: 3 })).status, 400);
  assert.strictEqual(await bal(u), LOGIN, "mọi cú sai phải không đổi ví");
  const b0 = await bal(u);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "duck" })).status, 400);
  assert.strictEqual(await bal(u), b0);
});

/* ================= nộp file + quà chuỗi ================= */
t("10 Nộp file: 25 + 1 xu cho mỗi đủ 20 câu, một file chỉ thưởng một lần", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const g = (ref, q) => db.withTransaction((c) => xu.grant(c, { userId: u, source: "file", ref, amount: T.fileGain(q), meta: { questions: q } }));
  assert.strictEqual(T.fileGain(120), X.file.base + 6);
  const a = await g("file:101", 120);
  assert.deepStrictEqual([a.granted, a.amount], [true, 31]);
  const dup = await g("file:101", 120);
  assert.deepStrictEqual([dup.granted, dup.reason], [false, "already"]);
  assert.strictEqual(await bal(u), LOGIN + 31);
  assert.strictEqual((await X_(u, "GET", "/")).body.income.file, 31);
});
t("11 Trần 60 xu một ngày cho file: file thứ hai chỉ nhận phần còn lại", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const g = (ref, q) => db.withTransaction((c) => xu.grant(c, { userId: u, source: "file", ref, amount: T.fileGain(q) }));
  const a = await g("file:201", 120);          // 31
  const b = await g("file:202", 900);          // fileGain(900) = 60 nhưng chỉ còn 29
  assert.deepStrictEqual([a.amount, b.amount], [31, X.file.cap - 31]);
  const c = await g("file:203", 40);
  assert.strictEqual(c.granted, false); assert.match(c.reason, /60 xu/);
  assert.strictEqual((await X_(u, "GET", "/")).body.left.file, 0);
});
t("12 File rỗng / sai số câu: không thưởng, không ghi sổ", async () => {
  const u = newUser();
  const r = await db.withTransaction((c) => xu.grant(c, { userId: u, source: "file", ref: "file:301", amount: T.fileGain(0) }));
  assert.deepStrictEqual([r.granted, r.amount, r.reason], [false, 0, "empty"]);
  assert.strictEqual(T.fileGain(-5), 0); assert.strictEqual(T.fileGain(undefined), 0);
});
t("13 Chuỗi 3 ngày học: quà mốc 15 xu, đúng một lần; mốc kế tiếp được báo trước", async () => {
  const u = newUser(); await study(u, 15, 3); // 5 câu/ngày x 3 ngày
  const a = (await X_(u, "GET", "/")).body;
  assert.strictEqual(a.income.streak, 15);
  assert.deepStrictEqual(await rows(u, "streak").then((r) => r.map((x) => x.source_ref)), ["streak:3"]);
  const st = (await TZ_(u, "GET", "/")).body.xu.gift;
  assert.strictEqual(st.length, 3); assert.deepStrictEqual(st.next, { days: 7, gift: 30 });
  const before = await bal(u);
  const b = (await X_(u, "GET", "/")).body;
  assert.strictEqual(b.balance, before, "quà mốc không lặp lại khi đọc lại");
  assert.strictEqual(b.income.streak, 15);
});
t("14 Đủ 7 ngày: chỉ nhận mốc 7 (mốc 3 đã nhận rồi), tổng quà chuỗi = 45", async () => {
  const u = newUser(); await study(u, 35, 7);
  await X_(u, "GET", "/");
  const r = await rows(u, "streak");
  assert.deepStrictEqual(r.map((x) => [x.source_ref, x.amount]), [["streak:3", 15], ["streak:7", 30]]);
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
  const s = (await TZ_(u, "GET", "/")).body.xu.gift;
  assert.deepStrictEqual(s.next, { days: 14, gift: 60 }, "mốc kế tiếp là 14 ngày");
});
t("15 Đứt chuỗi thì mốc đã lãnh không bị thu lại, và không hứa lại mốc cũ", async () => {
  const u = newUser(); await study(u, 15, 3);
  await TZ_(u, "GET", "/");
  const balance = await bal(u);
  assert.strictEqual((await rows(u, "streak")).length, 1, "đã tặng mốc 3 ngày");
  // Xóa đúng ngày giữa chuỗi: hôm nay còn học nhưng hôm qua trắng -> chuỗi về 1
  await pool.query(`DELETE FROM attempts WHERE user_id = $1 AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = $2::date`, [u, T.addDays(today, -1)]);
  const g = (await TZ_(u, "GET", "/")).body.xu.gift;
  assert.strictEqual(g.length, 1);
  assert.deepStrictEqual(g.next, { days: 7, gift: 30 }, "mốc 3 đã lãnh rồi nên phải hứa mốc 7");
  assert.strictEqual(await bal(u), balance, "không được trừ lại quà đã tặng");
  assert.strictEqual((await rows(u, "streak")).length, 1);
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
});

/* ================= một ví, ba chỗ tiêu ================= */
t("16 Cây anh đào tiêu đúng ví chung: tưới 5 xu làm cả thị trấn lẫn ví cùng giảm", async () => {
  const u = newUser(); await study(u, 6); // 18 + 5 = 23
  const s = (await SK_(u, "GET", "/")).body;
  assert.strictEqual(s.coins, 23);
  const r = await SK_(u, "POST", "/care", { action: "water" });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual([r.body.coins, r.body.cost], [18, 5]);
  assert.strictEqual((await X_(u, "GET", "/")).body.balance, 18);
  assert.strictEqual((await TZ_(u, "GET", "/")).body.xu.balance, 18);
  assert.deepStrictEqual(
    (await pool.query(`SELECT kind, cost, xu FROM xu_spend WHERE user_id = $1`, [u])).rows,
    [{ kind: "sakura", cost: 5, xu: 18 }]
  );
});
t("17 Thị trấn và cây tranh nhau xu: ai tới trước được, người sau bị 409, không âm", async () => {
  const u = newUser(); await study(u, 3); // 9 + 5 = 14 -> đủ tưới (5) nhưng không đủ xây (20)
  await TZ_(u, "POST", "/pet", { species: "rong", name: "Bo" });
  const build = await TZ_(u, "POST", "/build", { topic: "Thì", plot: 0 });
  assert.strictEqual(build.status, 409); assert.match(build.body.error, /Cần 20 xu, bạn đang có 14/);
  const water = await SK_(u, "POST", "/care", { action: "water" });
  assert.strictEqual(water.status, 200);
  assert.strictEqual((await TZ_(u, "GET", "/")).body.xu.balance, 9);
});
t("18 Lịch sử ví gộp cả thu và chi, mới nhất trước", async () => {
  const u = newUser(); await study(u, 4); // 12 xu + quà 5 = 17: không đủ xây (20) nhưng đủ mua hạt (10)
  await TZ_(u, "POST", "/pet", { species: "meo", name: "Meo" });
  assert.strictEqual((await TZ_(u, "POST", "/build", { topic: "Thì", plot: 0 })).status, 409);
  const plant = await TZ_(u, "POST", "/garden", { action: "plant", slot: 0, flower: C.garden.flowers[0].id });
  assert.strictEqual(plant.status, 200);
  await X_(u, "POST", "/game", { game: "duck", roundId: "hist-duck-1" });
  const h = (await X_(u, "GET", "/history")).body.items;
  assert.ok(h.length >= 7, "số dòng lịch sử = " + h.length);
  assert.strictEqual(h[0].direction, "in", "dòng mới nhất là ván vịt vừa chơi");
  assert.ok(h.some((i) => i.detail === "login:login:" + today), "có dòng quà đăng nhập");
  assert.ok(h.some((i) => i.detail === "game:duck:hist-duck-1"), "có dòng thưởng ván chơi");
  const out = h.filter((i) => i.direction === "out");
  assert.deepStrictEqual(out.map((i) => [i.detail, i.amount]), [["seed ", -C.garden.seedCost]], "dòng chi là số âm");
  assert.ok(h.every((i) => (i.direction === "in" ? i.amount > 0 : i.amount < 0)), "thu dương, chi âm");
  const days = h.map((i) => i.day);
  assert.deepStrictEqual(days, days.slice().sort().reverse(), "sắp theo ngày giảm dần");
  assert.strictEqual((await X_(u, "GET", "/")).body.balance, 17 - C.garden.seedCost + XG.duck);
});

/* ================= chuyển đổi + chuyển khách ================= */
t("19 migrateWallet: vật liệu cũ + xu anh đào gộp 1:1 vào ví, chạy lại không tăng thêm", async () => {
  const u = newUser();
  await pool.query(`INSERT INTO town_state (user_id, materials, last_attempt_id) VALUES ($1, '{"Thì":35,"Giới từ":5}'::jsonb, 3)`, [u]);
  await pool.query(`INSERT INTO sakura_state (user_id, coins, points, last_attempt_id) VALUES ($1, 40, 60, 9)`, [u]);
  const done = await db.withTransaction((c) => xu.migrateWallet(c));
  assert.deepStrictEqual(done.find((d) => d.userId === u), { userId: u, materials: 40, sakura: 40, xu: 80 });
  const st = (await pool.query(`SELECT xu, materials, last_attempt_id FROM town_state WHERE user_id = $1`, [u])).rows[0];
  assert.strictEqual(Number(st.xu), 80);
  assert.deepStrictEqual(st.materials, {}, "vật liệu đã đổi hết sang xu");
  assert.strictEqual(Number(st.last_attempt_id), 9, "lấy mốc cao nhất để không thưởng lại lượt cũ");
  assert.strictEqual(Number((await pool.query(`SELECT coins FROM sakura_state WHERE user_id = $1`, [u])).rows[0].coins), 0);
  assert.deepStrictEqual(await rows(u, "convert"), [{ source_ref: "convert:materials", amount: 80 }]);
  const again = await db.withTransaction((c) => xu.migrateWallet(c));
  assert.strictEqual(again.find((d) => d.userId === u), undefined, "chạy lần hai không đổi gì");
  assert.strictEqual(await bal(u), 80);
  assert.strictEqual((await books(u)).expect, 80);
});
t("20 Khách đăng ký: ví + thú + quà chuyển sang tài khoản mới, lượt sao chép không in xu lần hai", async () => {
  const g = 0, n = newUser();
  await pool.query(`DELETE FROM xu_spend WHERE user_id=0; DELETE FROM xu_ledger WHERE user_id=0;
    DELETE FROM town_ledger WHERE user_id=0; DELETE FROM town_state WHERE user_id=0;
    DELETE FROM pet_state WHERE user_id=0; DELETE FROM sakura_state WHERE user_id=0; DELETE FROM attempts WHERE user_id=0;`);
  await att(g, 1, true, at(0, 8)); await att(g, 2, true, at(0, 9));
  await TZ_(g, "POST", "/pet", { species: "rong", name: "Khách" });
  const before = (await X_(g, "GET", "/")).body;
  assert.strictEqual(before.balance, 6 + LOGIN);

  // Đúng trình tự auth.js.adoptGuestWallet() chạy — tất cả trong một giao dịch.
  const moved = await db.withTransaction(async (c) => {
    await xu.syncLessons(c, 0);
    await c.query(`INSERT INTO attempts (question_id, correct, created_at, user_id)
                   SELECT question_id, correct, created_at, $1 FROM attempts WHERE user_id = 0`, [n]);
    const r = await transferGuestData(c, 0, n);
    await transferSakura(c, 0, n);
    if (r.moved) await c.query(`UPDATE town_state SET last_attempt_id = (SELECT coalesce(max(id), 0) FROM attempts WHERE user_id = $1) WHERE user_id = $1`, [n]);
    return r;
  });
  assert.deepStrictEqual(moved, { moved: true, conflict: false });
  const after = (await X_(n, "GET", "/")).body;
  assert.strictEqual(after.balance, before.balance, "lượt sao chép không được in xu thêm");
  assert.strictEqual((await TZ_(n, "GET", "/")).body.pet.name, "Khách");
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM xu_ledger WHERE user_id = 0`)).rows[0].n), 0);
  const q = await books(n); assert.strictEqual(q.expect, q.balance);
  assert.strictEqual((await X_(n, "GET", "/")).body.income.lesson, 6, "sổ cái bài học của Khách giờ là của tài khoản mới");
  assert.deepStrictEqual(await db.withTransaction((c) => transferGuestData(c, 0, n)), { moved: false, conflict: true });
});

/* ================= ván do máy chủ cấp (mục 7) ================= */
t("21 start -> đủ 3 lượt + quá 30 giây: +4 xu, ván đóng, finish lần hai không thưởng lại", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const s = await start(u, "duck");
  assert.strictEqual(s.status, 200);
  assert.match(s.body.roundId, /^r[0-9a-z]+-[0-9a-f]{18}$/, "mã ván do máy chủ sinh, trình duyệt không tự chọn được");
  assert.strictEqual(s.body.game, "duck");
  assert.deepStrictEqual(s.body.needs, { seconds: XG.seconds, evidence: XG.evidence, mode: "duck:%", game: "duck", fast: false });
  const rid = s.body.roundId;
  for (let i = 0; i < XG.evidence; i++) await att(u, 1 + i, true, new Date(), "duck:fall");
  await rewind(u, rid, XG.seconds + 1);
  const f = await finish(u, rid);
  assert.strictEqual(f.status, 200);
  assert.deepStrictEqual([f.body.reward, f.body.game, f.body.evidence], [XG.duck, "duck", XG.evidence]);
  assert.ok(f.body.seconds >= XG.seconds);
  assert.strictEqual((await inc(u)).game, XG.duck);
  const again = await finish(u, rid);
  assert.strictEqual(again.status, 409); assert.match(again.body.error, /đã đóng/);
  assert.strictEqual((await inc(u)).game, XG.duck, "finish lần hai không thêm xu");
  assert.strictEqual(await openRounds(u), 0);
  const q = await books(u); assert.strictEqual(q.expect, q.balance, "bất biến sổ sách với nguồn game do server cấp");
});
t("22 finish sớm: thiếu giây hoặc thiếu lượt đúng loại -> 409, ví nguyên", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const b0 = await bal(u);
  const s = await start(u, "duck"); const rid = s.body.roundId;
  const tooEarly = await finish(u, rid);
  assert.strictEqual(tooEarly.status, 409); assert.match(tooEarly.body.error, /30 giây/);
  for (let i = 0; i < 5; i++) await att(u, 1 + i, true, new Date().toISOString(), "practice"); // sai loại: không tính
  await rewind(u, rid, XG.seconds + 1);
  const wrongMode = await finish(u, rid);
  assert.strictEqual(wrongMode.status, 409); assert.match(wrongMode.body.error, /3 lượt/);
  assert.match(wrongMode.body.error, /mới 0 lượt/, "lượt practice trước lúc mở ván không được đếm");
  for (let i = 0; i < 2; i++) await att(u, 20 + i, true, new Date(), "duck:fall");
  assert.strictEqual((await finish(u, rid)).status, 409, "2/3 lượt chưa đủ");
  await att(u, 22, true, new Date(), "duck:fall");
  assert.strictEqual((await finish(u, rid)).status, 200);
  // 8 lượt đúng hôm nay (5 practice bị loại + 3 của ván) đều ra xu bài học; phần ván chỉ +4.
  assert.strictEqual(await bal(u), b0 + XG.duck + 8 * C.base["new"], "chỉ ván hợp lệ mới được xu ván");
  assert.strictEqual((await inc(u)).lesson, 8 * C.base["new"]);
});
t("23 Ván không do máy chủ cấp / của người khác: 404, không xu", async () => {
  const a = newUser(), b = newUser(); await X_(a, "GET", "/"); await X_(b, "GET", "/");
  const b0 = await bal(b);
  assert.strictEqual((await finish(b, "selfmade000000")).status, 404, "trình duyệt tự bịa mã ván -> không có hàng");
  assert.strictEqual((await finish(b, "x")).status, 400, "mã quá ngắn -> chặn từ cửa");
  const s = await start(a, "duck");
  await rewind(a, s.body.roundId, XG.seconds + 1);
  assert.strictEqual((await finish(b, s.body.roundId)).status, 404, "mã ván của A không xin được xu từ ví B");
  assert.strictEqual(await bal(b), b0); assert.strictEqual((await inc(b)).game, 0);
});
t("24 start hai lần liền: ván cũ bị đóng, chỉ còn MỘT ván mở", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const s1 = await start(u, "duck");
  const s2 = await start(u, "duck");
  assert.notStrictEqual(s1.body.roundId, s2.body.roundId);
  assert.deepStrictEqual(s2.body.closed, [s1.body.roundId], "start báo rõ ván nào vừa bị đóng");
  assert.strictEqual(await openRounds(u), 1);
  /* start phải nói trước ván này worth bao nhiêu xu — màn kết quả hiện "sẽ nhận được" bằng số này,
     không tự viết tay 4/3 trong giao diện. */
  assert.strictEqual(s2.body.reward, XG.duck, "start phải kèm phần thưởng dự kiến của ván");
  assert.strictEqual(s2.body.needs.seconds, XG.seconds);
  assert.strictEqual((await finish(u, s1.body.roundId)).status, 409, "ván đã bỏ không xin thưởng được");
  assert.strictEqual((await inc(u)).game, 0);
});
t("25 Mê cung không xin ván: /round/start từ chối, đường ghi xu riêng của nó giữ nguyên", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  assert.strictEqual((await start(u, "maze")).status, 400);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "maze", roundId: "maze-keep-1", place: 0 })).status, 200);
  assert.strictEqual((await inc(u)).game, XG.maze[0]);
});
t("26 Bỏ ván hơn 2 giờ: không xu ván, nhưng từng câu đã trả lời vẫn có xu bài học", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const s = await start(u, "duck"); const rid = s.body.roundId;
  for (let i = 0; i < 5; i++) await att(u, 1 + i, true, new Date(), "duck:fall");
  await pool.query(`UPDATE xu_rounds SET started_at = now() - make_interval(hours => 3) WHERE user_id = $1 AND round_id = $2`, [u, rid]);
  const f = await finish(u, rid);
  assert.strictEqual(f.status, 409); assert.match(f.body.error, new RegExp(String(XG.ttlHours) + " giờ"));
  const x = await inc(u);
  assert.strictEqual(x.game, 0, "ván bỏ giữa chừng -> không xu ván");
  assert.strictEqual(x.lesson, 5 * C.base["new"], "5 câu đúng vẫn nhận đủ xu bài học, không bị phạt");
  const row = await pool.query(`SELECT finished_at IS NOT NULL AS closed, meta->>'abandoned' AS ab FROM xu_rounds WHERE user_id = $1 AND round_id = $2`, [u, rid]);
  assert.deepStrictEqual(row.rows[0], { closed: true, ab: "true" });
});
t("27 Mỗi trò kỹ năng một hạn riêng (sửa V2): hai trò không ăn giới hạn của nhau", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const a = []; for (let i = 0; i < 3; i++) a.push(await playRound(u, "skill", "bong"));
  assert.deepStrictEqual(a.map((r) => r.status), [200, 200, 409], "trò bong: 2 ván có thưởng (roundsPerDay), ván 3 từ chối");
  assert.match(a[2].body.error, new RegExp(String(XG.roundsPerDay) + " ván"));
  assert.strictEqual((await inc(u)).game, XG.skill * 2);
  assert.strictEqual((await playRound(u, "skill", "nap")).status, 200, "trò nap còn nguyên hạn của nó");
  assert.deepStrictEqual((await inc(u)).rounds, { "skill:bong": 2, "skill:nap": 1 });
  const d = []; for (let i = 0; i <= XG.rounds.duck; i++) d.push(await playRound(u, "duck"));
  assert.deepStrictEqual(d.slice(0, XG.rounds.duck).map((r) => r.status), [200, 200, 200], "vịt được 3 ván (hạn mới, nhường chỗ cho các trò khác)");
  assert.strictEqual(d[XG.rounds.duck].status, 409); assert.match(d[XG.rounds.duck].body.error, new RegExp(String(XG.rounds.duck) + " ván"));
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
});
t("28 Phân loại nhanh (không ghi attempts): chỉ cần 25 giây, hạn 2 ván/ngày cho từng mã", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  const s = await start(u, "skill", "classpos");
  assert.deepStrictEqual(s.body.needs, { seconds: XG.secondsFast, evidence: 0, mode: "skill", game: "skill", fast: true });
  assert.strictEqual((await finish(u, s.body.roundId)).status, 409, "25 giây chưa trôi qua");
  await rewind(u, s.body.roundId, XG.secondsFast + 1);
  assert.strictEqual((await finish(u, s.body.roundId)).status, 200, "không cần một lượt attempts nào");
  assert.strictEqual((await playRound(u, "skill", "classtense")).status, 200);
  assert.strictEqual((await playRound(u, "skill", "classprep")).status, 200);
  const x = await inc(u);
  assert.strictEqual(x.game, XG.skill * 3, "ba trò phân loại = ba mã riêng, mỗi mã một ván");
  assert.deepStrictEqual(x.rounds, { "skill:classpos": 1, "skill:classtense": 1, "skill:classprep": 1 });
  // Ván thứ hai của CÙNG một trò vẫn được thưởng (hạn = roundsPerDay), chỉ ván thứ ba bị chặn.
  assert.strictEqual((await playRound(u, "skill", "classpos")).status, 200, "ván thứ hai của trò phân loại vẫn có thưởng");
  const third = await playRound(u, "skill", "classpos");
  assert.strictEqual(third.status, 409, "ván thứ ba bị hạn 2 ván/ngày chặn");
  assert.match(third.body.error, new RegExp(String(XG.roundsPerDay) + " ván"));
  assert.deepStrictEqual((await inc(u)).rounds, { "skill:classpos": 2, "skill:classtense": 1, "skill:classprep": 1 });
});
t("29 Trần 30 xu một ngày cắt ĐÚNG khi cày đủ mọi trò", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  for (let i = 0; i < XG.rounds.duck; i++) assert.strictEqual((await playRound(u, "duck")).status, 200);
  for (const code of ["bong", "nap", "xo"]) for (let i = 0; i < XG.roundsPerDay; i++) assert.strictEqual((await playRound(u, "skill", code)).status, 200);
  const x = await inc(u);
  assert.strictEqual(x.game, XG.duck * XG.rounds.duck + XG.skill * 3 * XG.roundsPerDay, "12 + 18 = đúng trần 30");
  assert.strictEqual(x.game, XG.cap);
  assert.strictEqual((await X_(u, "POST", "/game", { game: "maze", roundId: "cap-full-30", place: 0 })).status, 409);
  assert.strictEqual((await playRound(u, "duck")).status, 409, "hết trần nhóm: ván kế bị từ chối");
  assert.strictEqual((await X_(u, "GET", "/")).body.left.game, 0);
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
});
t("30 legacyGame = false là tắt đường cũ (410); bật lại thì vẫn chạy", async () => {
  const u = newUser(); await X_(u, "GET", "/");
  X.legacyGame = false;
  try {
    const off = await X_(u, "POST", "/game", { game: "duck", roundId: "legacy-off-1" });
    assert.strictEqual(off.status, 410); assert.match(off.body.error, /round\/start/);
    assert.strictEqual((await inc(u)).game, 0);
    assert.strictEqual((await start(u, "duck")).status, 200, "đường mới không phụ thuộc legacyGame");
  } finally { X.legacyGame = true; }
  assert.strictEqual((await X_(u, "POST", "/game", { game: "duck", roundId: "legacy-on-1" })).status, 200);
});
t("31 Đặt cap:0 cho ba nhóm mới = quay lại ĐÚNG hành vi bản cũ", async () => {
  const u = newUser();
  const old = { extra: X.extra.cap, words: X.words.cap, wordnew: X.wordnew.cap };
  X.extra.cap = 0; X.words.cap = 0; X.wordnew.cap = 0;
  try {
    await study(u, 100); // 100 câu đúng: bản cũ chỉ nhận 60 xu bài học
    const x = await inc(u);
    assert.strictEqual(x.lesson, C.dailyCap);
    assert.strictEqual(x.extra, 0, "nhóm học thêm tắt hẳn");
    assert.strictEqual((await X_(u, "GET", "/")).body.left.extra, 0, "trần 0 -> còn 0, giao diện không hứa xu");
    for (const [source, ref] of [["extra", "attempt:900001"], ["words", "word:9:" + today], ["wordnew", "wordnew:9"]]) {
      const g = await db.withTransaction((c) => xu.grant(c, { userId: u, source, ref, amount: 2 }));
      assert.deepStrictEqual([g.granted, g.amount], [false, 0], source + " phải bị chặn khi cap = 0");
      assert.strictEqual((await rows(u, source)).length, 0, source + " không ghi sổ");
    }
  } finally { X.extra.cap = old.extra; X.words.cap = old.words; X.wordnew.cap = old.wordnew; }
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
  // Bật lại trần: phần xu học thêm của những lượt đã bị cắt KHÔNG quay lại (mỗi lượt chỉ thưởng một lần)
  const g = await db.withTransaction((c) => xu.grant(c, { userId: u, source: "extra", ref: "attempt:900001", amount: X.extra.perAttempt }));
  assert.deepStrictEqual([g.granted, g.amount], [true, X.extra.perAttempt]);
});
t("32 Mốc đồng bộ bị xóa: học thêm không in xu lần hai (UNIQUE chặn)", async () => {
  const u = newUser(); await study(u, 100);
  const before = await X_(u, "GET", "/");
  assert.strictEqual(before.body.income.extra, X.extra.cap, "100 câu đúng -> bài học 60 + học thêm 20");
  assert.strictEqual(before.body.balance, C.dailyCap + X.extra.cap + LOGIN);
  await pool.query(`UPDATE town_state SET last_attempt_id = 0 WHERE user_id = $1`, [u]);
  const after = (await X_(u, "GET", "/")).body;
  assert.strictEqual(after.balance, before.body.balance, "đồng bộ lại từ đầu không đổi số dư");
  assert.strictEqual(after.income.extra, X.extra.cap);
  assert.strictEqual((await rows(u, "extra")).length, X.extra.cap, "đúng 20 dòng 'attempt:<id>'");
  const q = await books(u); assert.strictEqual(q.expect, q.balance);
});

(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
  const admin = new Pool({ connectionString: URL_DB });
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.query(`SET search_path=${SCHEMA}; CREATE TABLE questions (id integer PRIMARY KEY, topic text);
    CREATE TABLE attempts (id bigserial PRIMARY KEY, user_id integer NOT NULL, question_id integer, correct boolean NOT NULL,
      mode text NOT NULL DEFAULT 'practice', created_at timestamptz NOT NULL DEFAULT now());`);
  await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "../CSDL/town.sql"), "utf8")}`);
  await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "../CSDL/sakura.sql"), "utf8")}`);
  const ins = [];
  for (let i = 1; i <= 150; i++) ins.push(`(${i},'Thì')`);
  for (let i = 1; i <= 50; i++) ins.push(`(${200 + i},'Giới từ')`);
  for (let i = 1; i <= 50; i++) ins.push(`(${300 + i},'Từ vựng')`);
  await admin.query(`INSERT INTO ${SCHEMA}.questions VALUES ${ins.join(",")}`);

  const app = express();
  app.use((req, _res, next) => { req.userId = Number(req.headers["x-user"]); next(); });
  app.use("/api/xu", xu.createXuRouter({ db }));
  app.use("/api/town", createTownRouter({ db }));
  app.use("/api/sakura", createSakuraRouter({ db }));
  const server = http.createServer(app).listen(0);
  origin = `http://127.0.0.1:${server.address().port}`;

  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log("  ✔", name); }
    catch (e) { fail++; console.log("  ✘", name, "\n     ", String(e.message).split("\n").slice(0, 5).join("\n     ")); }
  }
  console.log(`\n${pass} đạt, ${fail} lỗi`);
  server.close(); await pool.end();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`); await admin.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
