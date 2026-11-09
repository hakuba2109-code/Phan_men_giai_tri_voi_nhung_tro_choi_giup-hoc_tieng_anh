"use strict";
/* Kiểm thử tích hợp backend Thú ảo + Thị trấn (MỘT VÍ XU CHUNG): server Express thật + PostgreSQL thật,
   0 token, không gọi AI.
   Chạy:  node scripts/test-town-api.js   (đọc DATABASE_URL từ .env ở gốc dự án, hoặc npm --prefix json run test:town-api)
   Script TỰ TẠO schema tạm `town_test` (bảng attempts/questions TỐI GIẢN + town.sql + sakura.sql), chạy xong XÓA schema.
   => Không đụng dữ liệu thật. Nó kiểm LOGIC và SQL của town.js + xu.js; việc attempts/questions THẬT có đúng cột
   hay không vẫn phải xác nhận ở M0.
   Quy ước số dư: người chơi mới nhận quà đăng nhập 5 xu ngay lần đọc đầu tiên, vì vậy các bài kiểm bài học
   so sánh theo HIỆU số dư hoặc đọc `xu.today.lesson`, còn bài kiểm tiêu tiền thì Nạp thẳng ví (fund) cho chắc chắn. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const T = require("../src/town-core");
const { createTownRouter, transferGuestData } = require("../src/town");

const URL_DB = process.env.DATABASE_URL;
if (!URL_DB) { console.error("Thiếu DATABASE_URL."); process.exit(2); }
const SCHEMA = "town_test";
const pool = new Pool({ connectionString: URL_DB, options: `-c search_path=${SCHEMA}` });
const db = {
  async withTransaction(fn) {
    const c = await pool.connect();
    try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  },
};

const C = T.CONFIG, X = C.xu, GF = C.garden, FLOW = GF.flowers[0].id, LOGIN = C.xu.login.gift;

let pass = 0, fail = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
let base;
const api = async (user, method, p, body) => {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const today = T.dayKey(Date.now());
const at = (daysAgo, hh, mm = 0) => `${T.addDays(today, -daysAgo)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`;
let uid = 1000;
const newUser = () => ++uid;
const att = (u, q, correct, when) => pool.query(`INSERT INTO attempts (user_id, question_id, correct, created_at) VALUES ($1,$2,$3,$4)`, [u, q, correct, when]);
// câu hỏi: Thì 1..150 · Giới từ 201..250 · Từ vựng 301..350 · 400 = không có chủ điểm
const Q = { "Thì": 1, "Giới từ": 201, "Từ vựng": 301 };

/* Một khu của thị trấn: không còn vật liệu riêng, chỉ còn cấp ô + tổng xu do khu đó đóng góp. */
const dist = (st, name) => st.districts.find((d) => d.topic === name) || { earned: 0, plots: [0, 0, 0, 0] };
const bal = (u) => pool.query(`SELECT xu FROM town_state WHERE user_id = $1`, [u]).then((r) => Number(r.rows[0].xu));
/* Nạp ví thẳng để kiểm tiền TIÊU (xây, mua hạt) mà không phụ thuộc số xu bài học/ quà. */
const fund = (u, amount) => pool.query(
  `INSERT INTO town_state (user_id, xu) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET xu = $2`, [u, amount]
);
/* Người chơi có bài học rồi (xp = lessons x 3) và ví được nạp đúng `amount` xu. */
const walletUser = async (amount = 30, lessons = 3) => {
  const u = newUser();
  for (let i = 0; i < lessons; i++) await att(u, 1 + i, true, at(0, 8, i));
  await api(u, "GET", "/");
  await fund(u, amount);
  return u;
};
const xpOf = (u) => pool.query(`SELECT xp FROM town_state WHERE user_id = $1`, [u]).then((r) => Number(r.rows[0].xp));
/* Bất biến của một cái ví: mọi dòng thu trừ mọi dòng chi phải đúng bằng số dư. */
const sums = (u) => pool.query(
  `SELECT (SELECT coalesce(sum(amount),0)::int FROM town_ledger WHERE user_id = $1)
          + (SELECT coalesce(sum(amount),0)::int FROM xu_ledger  WHERE user_id = $1)
          - (SELECT coalesce(sum(cost), 0)::int FROM xu_spend    WHERE user_id = $1) AS expect,
          (SELECT xu FROM town_state WHERE user_id = $1) AS balance`, [u]
).then((r) => r.rows[0]);

/* ================= bài học -> đúng một cái ví ================= */
t("1  Ba câu mới đúng ở ba chủ điểm: mỗi khu +3 xu, XP +9, quà đăng nhập nhập cùng một ví", async () => {
  const u = newUser();
  for (const [i, k] of Object.keys(Q).entries()) await att(u, Q[k], true, at(0, 8 + i));
  await api(u, "POST", "/pet", { species: "rong", name: "Bi" });
  const s = (await api(u, "GET", "/")).body;
  for (const k of Object.keys(Q)) assert.strictEqual(dist(s, k).earned, 3);
  assert.strictEqual(s.pet.xp, 9);
  assert.strictEqual(s.xu.today.lesson, 9);
  assert.strictEqual(s.xu.balance, 9 + LOGIN, "ví = xu bài học + quà ngày");
});
t("2  Gọi GET hai lần liên tiếp: số liệu không đổi, quà chỉ hiện một lần", async () => {
  const u = newUser(); await att(u, 1, true, at(0, 8));
  const a = (await api(u, "GET", "/")).body, b = (await api(u, "GET", "/")).body;
  assert.deepStrictEqual(a.districts, b.districts);
  assert.strictEqual(b.today_stats.earned, 3);
  assert.strictEqual(a.xu.balance, b.xu.balance);
  assert.strictEqual(a.xu.gift.given.length, 1, "lần đầu phải báo vừa được tặng quà");
  assert.strictEqual(b.xu.gift.given.length, 0, "lần sau không được báo lại");
});
t("3  Thêm 2 lượt rồi gọi lại: chỉ cộng phần mới", async () => {
  const u = newUser(); await att(u, 1, true, at(0, 8)); await api(u, "GET", "/");
  await att(u, 2, true, at(0, 9)); await att(u, 3, true, at(0, 10));
  assert.strictEqual(dist((await api(u, "GET", "/")).body, "Thì").earned, 9);
});
t("4  Một câu đúng 5 lần cùng ngày: chỉ một lần có thưởng", async () => {
  const u = newUser(); for (let i = 0; i < 5; i++) await att(u, 5, true, at(0, 8 + i));
  assert.strictEqual(dist((await api(u, "GET", "/")).body, "Thì").earned, 3);
});
t("5  100 câu khác nhau đều đúng trong một ngày: bài học 60 (trần) + học thêm 20 (trần), XP thú không đổi", async () => {
  const u = newUser(); for (let i = 0; i < 100; i++) await att(u, 10 + i, true, at(0, 9, i % 60));
  const s = (await api(u, "GET", "/")).body;
  assert.strictEqual(dist(s, "Thì").earned, 60, "sổ cái bài học vẫn dừng ở trần 60");
  assert.strictEqual(s.xu.balance, 60 + X.extra.cap + LOGIN, "60 xu bài học + 20 xu học thêm (80 lượt bị cắt, trần 20)");
  assert.strictEqual(s.xu.today.lesson, 60);
  assert.strictEqual(s.xu.left.lesson, 0, "hết trần bài học -> hiện 0 chứ không im lặng");
  assert.strictEqual(s.xu.today.extra, X.extra.cap);
  assert.strictEqual(s.xu.left.extra, 0);
  assert.strictEqual(s.xu.caps.lesson, 60);
  assert.strictEqual(s.xu.caps.extra, X.extra.cap);
  const led = (await api(u, "GET", "/ledger?limit=200")).body.items;
  assert.strictEqual(led.length, 20, "chỉ 20 lượt ĐẦU TIÊN có dòng sổ cái bài học");
  assert.strictEqual(led.filter((i) => i.kind === "cap").length, 0, "lượt bị cắt KHÔNG thành dòng sổ cái bài học");
  assert.strictEqual(led.reduce((n, i) => n + i.amount, 0), 60, "XP thú chỉ từ town_ledger: đúng 60, học thêm không cộng");
});
t("6  23:50 và 00:10 giờ Việt Nam là hai ngày khác nhau", async () => {
  const u = newUser(); await att(u, 1, true, at(2, 23, 50)); await att(u, 2, true, at(1, 0, 10));
  await api(u, "GET", "/");
  const items = (await api(u, "GET", "/ledger")).body.items;
  assert.strictEqual(new Set(items.map((i) => i.day)).size, 2);
});
t("7  Câu từng sai rồi đúng: thưởng fixed = 4 xu, sổ cái đúng kind", async () => {
  const u = newUser(); await att(u, 7, false, at(2, 9)); await att(u, 7, true, at(1, 9));
  const items = (await api(u, "GET", "/ledger")).body.items;
  assert.deepStrictEqual(items.map((i) => [i.kind, i.amount]), [["fixed", 4]]);
});
t("8  Lượt có question_id NULL hoặc câu không có chủ điểm: bỏ qua, không lỗi, mốc vẫn tiến", async () => {
  const u = newUser(); await att(u, null, true, at(0, 8)); await att(u, 400, true, at(0, 9)); await att(u, 1, true, at(0, 10));
  const r = await api(u, "GET", "/"); assert.strictEqual(r.status, 200);
  assert.strictEqual(dist(r.body, "Thì").earned, 3);
  assert.strictEqual(r.body.xu.balance, 3 + LOGIN);
  const last = (await pool.query(`SELECT last_attempt_id FROM town_state WHERE user_id=$1`, [u])).rows[0].last_attempt_id;
  assert.strictEqual(Number(last), Number((await pool.query(`SELECT max(id) m FROM attempts WHERE user_id=$1`, [u])).rows[0].m));
});
t("9  Có 30 ngày lịch sử, bật lần đầu: chỉ tính ~14 ngày gần nhất", async () => {
  const u = newUser(); for (let d = 29; d >= 0; d--) await att(u, 20 + d, true, at(d, 9));
  const n = dist((await api(u, "GET", "/")).body, "Thì").earned;
  assert.ok(n >= 13 * 3 && n <= 15 * 3, "xu từ bài học = " + n);
});

/* ================= tiêu xu: nâng cấp ô ================= */
t("10 Xây ô khi đủ xu: trừ đúng chi phí, cấp +1, ghi nhật ký chi", async () => {
  const u = await walletUser(30, 9);
  const r = await api(u, "POST", "/build", { topic: "Thì", plot: 0 });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual([r.body.cost, r.body.level, r.body.xu, r.body.plots], [C.buildCost[0], 1, 30 - C.buildCost[0], [1, 0, 0, 0]]);
  assert.strictEqual(await bal(u), 30 - C.buildCost[0]);
  const sp = (await pool.query(`SELECT kind, topic, slot, cost, xu FROM xu_spend WHERE user_id = $1`, [u])).rows;
  assert.deepStrictEqual(sp, [{ kind: "build", topic: "Thì", slot: 0, cost: C.buildCost[0], xu: 30 - C.buildCost[0] }]);
});
t("11 Thiếu xu / cấp tối đa / ô = 7: 409 / 409 / 400, ví không đổi", async () => {
  const u = await walletUser(10);
  assert.strictEqual((await api(u, "POST", "/build", { topic: "Thì", plot: 0 })).status, 409);
  await pool.query(`UPDATE town_state SET xu = 999, plots = $2 WHERE user_id = $1`, [u, JSON.stringify({ "Thì": [3, 0, 0, 0] })]);
  assert.strictEqual((await api(u, "POST", "/build", { topic: "Thì", plot: 0 })).status, 409);
  assert.strictEqual((await api(u, "POST", "/build", { topic: "Thì", plot: 7 })).status, 400);
  assert.strictEqual(await bal(u), 999, "bị từ chối thì ví phải còn nguyên");
});
t("12 Khu chưa có gì vẫn xây được bằng xu (không còn vật liệu riêng từng khu)", async () => {
  const u = await walletUser(20, 0);
  const r = await api(u, "POST", "/build", { topic: "Khu chưa học", plot: 0 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.xu, 20 - C.buildCost[0]);
  assert.strictEqual(dist((await api(u, "GET", "/")).body, "Khu chưa học").plots[0], 1);
});
t("13 Hai lần xây song song khi chỉ đủ xu cho một: một thành công, một 409, ví không âm", async () => {
  const u = await walletUser(25);
  const rs = await Promise.all([api(u, "POST", "/build", { topic: "Thì", plot: 0 }), api(u, "POST", "/build", { topic: "Thì", plot: 1 })]);
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [200, 409]);
  assert.strictEqual(await bal(u), 25 - C.buildCost[0]);
});

/* ================= thú ảo ================= */
t("14 Tạo thú hai lần với loài khác: lần hai chỉ đổi tên", async () => {
  const u = newUser(); await api(u, "POST", "/pet", { species: "rong", name: "Bi" });
  const r = await api(u, "POST", "/pet", { species: "meo", name: "Mi" });
  assert.deepStrictEqual([r.body.pet.species, r.body.pet.name], ["rong", "Mi"]);
  assert.strictEqual((await api(newUser(), "POST", "/pet", { species: "khung long", name: "X" })).status, 400);
  assert.strictEqual((await api(newUser(), "POST", "/pet", { species: "cu", name: "x".repeat(21) })).status, 400);
});
t("15 rest 14 -> resting; rest 15 -> 400; rest 0 huỷ nghỉ", async () => {
  const u = newUser(); await api(u, "POST", "/pet", { species: "cu", name: "Cú" });
  assert.strictEqual((await api(u, "POST", "/rest", { days: 14 })).body.pet.hunger.state, "resting");
  assert.strictEqual((await api(u, "POST", "/rest", { days: 15 })).status, 400);
  assert.notStrictEqual((await api(u, "POST", "/rest", { days: 0 })).body.pet.hunger.state, "resting");
});
t("16 Bỏ học 20 ngày rồi học 5 lượt hôm nay: thú no, ví + XP không giảm", async () => {
  const u = newUser(); await api(u, "POST", "/pet", { species: "cao", name: "Cáo" });
  for (let i = 0; i < 5; i++) await att(u, 40 + i, true, at(20, 9, i));
  const before = (await api(u, "GET", "/")).body; assert.strictEqual(before.pet.hunger.state, "hibernating");
  for (let i = 0; i < 5; i++) await att(u, 50 + i, true, at(0, 9, i));
  const after = (await api(u, "GET", "/")).body;
  assert.strictEqual(after.pet.hunger.state, "fed");
  assert.ok(after.pet.xp >= before.pet.xp); assert.ok(after.xu.balance >= before.xu.balance);
});
t("17 Tài khoản B không thấy dữ liệu của A", async () => {
  const a = newUser(), b = newUser(); await att(a, 1, true, at(0, 8));
  assert.strictEqual(dist((await api(a, "GET", "/")).body, "Thì").earned, 3);
  const sb = (await api(b, "GET", "/")).body;
  assert.strictEqual(dist(sb, "Thì").earned, 0);
  assert.strictEqual(sb.xu.balance, LOGIN, "B chỉ có quà của chính B");
});

/* ================= khách -> tài khoản ================= */
t("18 Khách (user 0) chơi rồi đăng ký: thú, ví xu, quà, công trình chuyển sang tài khoản mới", async () => {
  const g = 0, n = newUser();
  await pool.query(`DELETE FROM xu_spend WHERE user_id=0; DELETE FROM xu_ledger WHERE user_id=0;
    DELETE FROM town_ledger WHERE user_id=0; DELETE FROM town_state WHERE user_id=0;
    DELETE FROM pet_state WHERE user_id=0; DELETE FROM attempts WHERE user_id=0;`);
  await att(g, 1, true, at(0, 8)); await api(g, "POST", "/pet", { species: "rong", name: "Khách" });
  await fund(g, 30);
  const before = (await api(g, "GET", "/")).body;
  assert.strictEqual(before.xu.balance, 30);
  await api(g, "POST", "/build", { topic: "Thì", plot: 0 });
  const moved = await db.withTransaction(async (c) => { await c.query(`UPDATE attempts SET user_id=$2 WHERE user_id=$1`, [g, n]); return transferGuestData(c, g, n); });
  assert.deepStrictEqual(moved, { moved: true, conflict: false });
  const s = (await api(n, "GET", "/")).body;
  assert.strictEqual(s.pet.name, "Khách");
  assert.strictEqual(s.xu.balance, before.xu.balance - C.buildCost[0], "nguyên cái ví sau khi xây");
  assert.strictEqual(dist(s, "Thì").plots[0], 1);
  assert.strictEqual(dist(s, "Thì").earned, 3, "lịch sử ôn bài của Khách theo sang tài khoản mới");
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM xu_ledger WHERE user_id=0`)).rows[0].n), 0, "không còn dòng quà nào của Khách");
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM xu_spend WHERE user_id=$1`, [n])).rows[0].n), 1, "nhật ký tiêu xu cũng chuyển");
  const dup = await db.withTransaction((c) => transferGuestData(c, g, n)); // tài khoản mới đã có dữ liệu: không ghi đè
  assert.deepStrictEqual(dup, { moved: false, conflict: true });
});
t("19 Tắt rồi bật lại: không mất gì, đồng bộ tiếp đúng", async () => {
  const u = newUser(); await api(u, "POST", "/pet", { species: "meo", name: "Mèo" }); await att(u, 1, true, at(0, 8)); await api(u, "GET", "/");
  const before = await bal(u);
  assert.strictEqual((await api(u, "POST", "/settings", { enabled: false })).body.enabled, false);
  await att(u, 2, true, at(0, 9));
  assert.strictEqual((await api(u, "GET", "/")).body.enabled, false);
  assert.strictEqual((await api(u, "POST", "/build", { topic: "Thì", plot: 0 })).status, 409);
  assert.strictEqual(await bal(u), before, "lúc tắt thì ví đứng yên");
  await api(u, "POST", "/settings", { enabled: true });
  const s = (await api(u, "GET", "/")).body;
  assert.strictEqual(dist(s, "Thì").earned, 6);
  assert.strictEqual(s.xu.balance, before + 3);
});

/* ================= vườn hoa + cho thú ăn ================= */
const setBed = (u, slot, bed) => pool.query(
  `UPDATE town_state SET garden = jsonb_set(garden, ARRAY['beds', $1::text], $2::jsonb) WHERE user_id = $3`,
  [String(slot), JSON.stringify(bed), u]
);

t("20 plant: mua hạt trừ đúng seedCost vào ví, không đổi XP, ghi nhật ký chi", async () => {
  const u = await walletUser(30, 9);
  const xpBefore = await xpOf(u);
  const r = await api(u, "POST", "/garden", { action: "plant", slot: 0, flower: FLOW });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.cost, GF.seedCost);
  assert.strictEqual(r.body.xu, 30 - GF.seedCost);
  assert.strictEqual(r.body.garden[0].empty, false);
  assert.deepStrictEqual([r.body.garden[0].stage, r.body.garden[0].watered, r.body.garden[0].mature], [0, 0, false]);
  assert.strictEqual((await api(u, "GET", "/")).body.xu.balance, 30 - GF.seedCost, "giao diện đọc đúng ví sau khi trồng");
  assert.strictEqual(await xpOf(u), xpBefore, "trồng hoa không đổi XP");
  assert.strictEqual(await xpOf(u), 27, "XP chỉ bằng phần ôn bài (9 câu x 3)");
  assert.deepStrictEqual(
    (await pool.query(`SELECT kind, cost, xu FROM xu_spend WHERE user_id = $1`, [u])).rows,
    [{ kind: "seed", cost: GF.seedCost, xu: 30 - GF.seedCost }]
  );
});
t("21 tưới: miễn phí, một lần/ngày/ô; ô trống và sai action thì 409/400", async () => {
  const u = await walletUser(30);
  await api(u, "POST", "/garden", { action: "plant", slot: 1, flower: FLOW });
  const matsBefore = await bal(u);
  const w = await api(u, "POST", "/garden", { action: "water", slot: 1 });
  assert.strictEqual(w.status, 200); assert.strictEqual(w.body.garden[1].watered, 1);
  assert.strictEqual(w.body.xu, matsBefore, "tưới không được trừ xu");
  const again = await api(u, "POST", "/garden", { action: "water", slot: 1 });
  assert.strictEqual(again.status, 409); assert.match(again.body.error, /đã tưới/);
  assert.strictEqual((await api(u, "POST", "/garden", { action: "water", slot: 5 })).status, 409); // ô trống
  assert.strictEqual((await api(u, "POST", "/garden", { action: "water", slot: 99 })).status, 400);
  assert.strictEqual((await api(u, "POST", "/garden", { action: "khac" })).status, 400);
  assert.strictEqual(await bal(u), matsBefore, "mọi cú sai phải không động tới ví");
});
t("22 harvest: nở thì trả harvestGain vào ví, XP không đổi, ô trống lại", async () => {
  const u = await walletUser(30, 9);
  await api(u, "POST", "/garden", { action: "plant", slot: 0, flower: FLOW });
  await setBed(u, 0, { flower: FLOW, watered: GF.waterings - 1, lastWater: "2026-01-01", plantedDay: "2026-01-01" });
  assert.strictEqual((await api(u, "POST", "/garden", { action: "harvest", slot: 0 })).status, 409); // chưa nở
  await api(u, "POST", "/garden", { action: "water", slot: 0 });
  const h = await api(u, "POST", "/garden", { action: "harvest", slot: 0 });
  assert.strictEqual(h.status, 200);
  assert.strictEqual(h.body.gain, GF.harvestGain); assert.strictEqual(h.body.flower, FLOW);
  assert.strictEqual(h.body.xu, 30 - GF.seedCost + GF.harvestGain);
  assert.strictEqual(h.body.garden[0].empty, true);
  const s = (await api(u, "GET", "/")).body;
  assert.deepStrictEqual(s.garden.picked, { [FLOW]: 1 });
  assert.strictEqual(s.garden.gainedToday, GF.harvestGain);
  assert.strictEqual(await xpOf(u), 27, "thu hoạch không cộng XP");
  // xu vườn phải có dòng sổ cái (nguồn 'garden') để lịch sử ví đối chiếu được
  const g = (await pool.query(`SELECT amount FROM xu_ledger WHERE user_id=$1 AND source='garden'`, [u])).rows;
  assert.strictEqual(g.length, 1, "một lần thu = một dòng garden");
  assert.strictEqual(g[0].amount, GF.harvestGain);
  assert.strictEqual(s.xu.today.garden, GF.harvestGain, "xu hôm nay từ vườn hiện trong ví");
});
t("23 harvest: chưa đủ trần thì thôi, cây vẫn nguyên ô (không bẻ nửa bông trả nửa xu)", async () => {
  const u = await walletUser(30);
  await api(u, "POST", "/garden", { action: "plant", slot: 2, flower: FLOW });
  await setBed(u, 2, { flower: FLOW, watered: GF.waterings, lastWater: "2026-01-01", plantedDay: "2026-01-01" });
  await pool.query(`UPDATE town_state SET garden = jsonb_set(garden,'{gain}','${JSON.stringify({ day: today, amount: GF.dailyGainCap - GF.harvestGain + 1 })}'::jsonb) WHERE user_id=$1`, [u]);
  const before = await bal(u);
  const r = await api(u, "POST", "/garden", { action: "harvest", slot: 2 });
  assert.strictEqual(r.status, 409); assert.match(r.body.error, /chưa đủ/);
  const s = (await api(u, "GET", "/")).body;
  assert.strictEqual(s.garden.beds[2].empty, false, "bị từ chối thì cây phải còn nguyên");
  assert.strictEqual(s.garden.beds[2].mature, true);
  assert.strictEqual(await bal(u), before);
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM xu_ledger WHERE user_id=$1 AND source='garden'`, [u])).rows[0].n), 0, "bị từ chối thì không ghi sổ");
});
t("24 GET /api/town trả MỘT ví xu + số liệu vườn, không còn vật liệu riêng", async () => {
  const u = await walletUser(50);
  const s = (await api(u, "GET", "/")).body;
  assert.strictEqual(s.garden.beds.length, GF.beds);
  assert.deepStrictEqual([s.garden.seedCost, s.garden.waterings, s.garden.harvestGain, s.garden.gainCap], [GF.seedCost, GF.waterings, GF.harvestGain, GF.dailyGainCap]);
  assert.strictEqual(s.garden.flowers.length, GF.flowers.length);
  assert.strictEqual(s.residents, undefined, "thị trấn đã bỏ chó/mèo thường trực: API không được trả residents");
  assert.strictEqual(s.pet, null, "chưa chọn thú thì chưa có con nào để cho ăn");
  assert.deepStrictEqual([s.xu.prices.build, s.xu.prices.seed, s.xu.prices.harvest], [C.buildCost, GF.seedCost, GF.harvestGain]);
  assert.deepStrictEqual(s.xu.games, C.xu.game);
  assert.deepStrictEqual(s.xu.left, {
    lesson: C.dailyCap - s.xu.today.lesson, extra: C.xu.extra.cap, game: C.xu.game.cap,
    words: C.xu.words.cap, wordnew: C.xu.wordnew.cap, file: C.xu.file.cap,
  });
  assert.deepStrictEqual(s.xu.caps, {
    lesson: C.dailyCap, extra: C.xu.extra.cap, game: C.xu.game.cap,
    words: C.xu.words.cap, wordnew: C.xu.wordnew.cap, file: C.xu.file.cap,
  });
  assert.ok(s.districts.every((d) => d.materials === undefined), "khu không được còn vật liệu riêng");
});
t("25 feed: chỉ cho đúng con thú của mình ăn, miễn phí, một lần/ngày, không đổi ví", async () => {
  const u = await walletUser(30);
  const before = await bal(u);
  assert.strictEqual((await api(u, "POST", "/feed", { species: "rong" })).status, 404, "chưa chọn thú");
  await api(u, "POST", "/pet", { species: "meo", name: "Bống" });
  const r = await api(u, "POST", "/feed", { species: "meo" });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.line.length > 10, "phải có lời của thú");
  assert.deepStrictEqual(r.body.treats.given, ["meo"]);
  assert.strictEqual((await api(u, "POST", "/feed", { species: "meo" })).status, 409, "một con chỉ ăn một lần/ngày");
  assert.strictEqual((await api(u, "POST", "/feed", { species: "cho" })).status, 400, "thị trấn chỉ có một con thú của người chơi");
  assert.strictEqual((await api(u, "POST", "/feed", { species: "khung-long" })).status, 400);
  const s = (await api(u, "GET", "/")).body;
  assert.strictEqual(s.pet.fedToday, true, "stateView phải báo đã ăn để giao diện tắt nút");
  assert.strictEqual(await bal(u), before, "cho ăn không được đổi ví");
});

/* ================= bất biến của ví ================= */
t("26 Bất biến: mọi dòng thu trừ mọi dòng chi luôn đúng bằng số dư, sau một chuỗi thao tác", async () => {
  const u = newUser();
  // Không nạp ví tay: mọi xu phải đi qua sổ cái thì bất biến mới có ý nghĩa.
  for (let d = 1; d >= 0; d--) for (let i = 0; i < 20; i++) await att(u, 1 + i + d * 30, i % 4 !== 0, at(d, 8, i));
  await api(u, "POST", "/pet", { species: "rong", name: "Tí" });
  for (const plot of [0, 1, 2, 3]) await api(u, "POST", "/build", { topic: "Thì", plot });
  await api(u, "POST", "/garden", { action: "plant", slot: 0, flower: FLOW });
  await api(u, "POST", "/garden", { action: "water", slot: 0 });
  await api(u, "POST", "/feed", { species: "rong" });
  const q = await sums(u);
  assert.strictEqual(q.expect, q.balance, `thu−chi=${q.expect} nhưng số dư=${q.balance}`);
  assert.ok(q.balance >= 0);
  const kinds = (await pool.query(`SELECT kind, count(*)::int n FROM xu_spend WHERE user_id=$1 GROUP BY 1`, [u])).rows;
  assert.deepStrictEqual(kinds.find((k) => k.kind === "build").n, 4);
  assert.deepStrictEqual(kinds.find((k) => k.kind === "seed").n, 1);
});

(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
  const admin = new Pool({ connectionString: URL_DB });
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.query(`SET search_path=${SCHEMA}; CREATE TABLE questions (id integer PRIMARY KEY, topic text);
    CREATE TABLE attempts (id bigserial PRIMARY KEY, user_id integer NOT NULL, question_id integer, correct boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
  await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "../CSDL/town.sql"), "utf8")}`);
  await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "../CSDL/sakura.sql"), "utf8")}`);
  const ins = [];
  for (let i = 1; i <= 150; i++) ins.push(`(${i},'Thì')`);
  for (let i = 201; i <= 250; i++) ins.push(`(${i},'Giới từ')`);
  for (let i = 301; i <= 350; i++) ins.push(`(${i},'Từ vựng')`);
  ins.push("(400,NULL)");
  await admin.query(`INSERT INTO ${SCHEMA}.questions VALUES ${ins.join(",")}`);

  const app = express();
  app.use((req, _res, next) => { req.userId = Number(req.headers["x-user"]); next(); });
  app.use("/api/town", createTownRouter({ db }));
  const server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/town`;

  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log("  ✔", name); }
    catch (e) { fail++; console.log("  ✘", name, "\n     ", String(e.message).split("\n").slice(0, 5).join("\n     ")); }
  }
  console.log(`\n${pass} đạt, ${fail} lỗi`);
  server.close(); await pool.end();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`); await admin.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
