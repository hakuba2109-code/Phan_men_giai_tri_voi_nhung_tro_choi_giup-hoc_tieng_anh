"use strict";
/* Kiểm thử tích hợp "Quần đảo vô tận + Nuôi thú cưng" (src/island.js + src/island-core.js):
   server Express thật + PostgreSQL thật, 0 token, không gọi AI.
   Chạy:  node scripts/test-island-api.js   (đọc DATABASE_URL từ .env ở gốc, hoặc npm --prefix json run test:island-api)
   Script TỰ TẠO schema tạm `island_test` (attempts/questions TỐI GIẢN + town.sql + sakura.sql + island.sql), chạy xong XÓA schema
   => không đụng dữ liệu thật.
   Quy ước số dư: tài khoản mới nhận quà đăng nhập 5 xu ngay lần đọc đầu tiên, nên bài nào kiểm tiền TIÊU thì
   đọc GET một lần cho rồi NẠP thẳng ví (fund) — còn bài kiểm bất biến ví thì để mọi xu đi qua sổ cái. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const IC = require("../src/island-core");
const TownCore = require("../src/town-core");
const { createIslandRouter } = require("../src/island");

const URL_DB = process.env.DATABASE_URL;
if (!URL_DB) { console.error("Thiếu DATABASE_URL."); process.exit(2); }
const SCHEMA = "island_test";
const pool = new Pool({ connectionString: URL_DB, options: `-c search_path=${SCHEMA}` });
const db = {
  async withTransaction(fn) {
    const c = await pool.connect();
    try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  },
};

const C = IC.CONFIG, LOGIN = TownCore.CONFIG.xu.login.gift;
let pass = 0, fail = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
let base;
const api = async (user, method, p, body) => {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const today = TownCore.dayKey(Date.now(), C.tz);
const at = (daysAgo, hh, mm = 0) => `${TownCore.addDays(today, -daysAgo)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`;
let uid = 2000;
const newUser = () => ++uid;
const att = (u, q, correct, when) => pool.query(`INSERT INTO attempts (user_id, question_id, correct, created_at) VALUES ($1,$2,$3,$4)`, [u, q, correct, when]);
const fund = (u, amount) => pool.query(`UPDATE town_state SET xu = $2 WHERE user_id = $1`, [u, amount]);
const bal = (u) => pool.query(`SELECT xu FROM town_state WHERE user_id = $1`, [u]).then((r) => Number(r.rows[0].xu));
const stateOf = (u) => pool.query(`SELECT current, unlocked, slots, completed_at FROM island_state WHERE user_id = $1`, [u]).then((r) => r.rows[0]);
const pantryOf = (u) => pool.query(`SELECT items FROM pet_pantry WHERE user_id = $1`, [u]).then((r) => r.rows[0].items);
const petsOf = (u) => pool.query(`SELECT id, breed, name, friend_xp, satiety, mood, meals, cares FROM pet_owned WHERE user_id = $1 ORDER BY id`, [u]).then((r) => r.rows);
const spends = (u) => pool.query(`SELECT kind, topic, slot, cost, xu FROM xu_spend WHERE user_id = $1 ORDER BY id`, [u]).then((r) => r.rows);
/* Người chơi mới đã nhận quà ngày; ví được nạp đúng `amount` xu để kiểm tiền TIÊU. */
const walletUser = async (amount) => { const u = newUser(); await api(u, "GET", "/"); await fund(u, amount); return u; };
/* Bất biến của ví: mọi dòng thu trừ mọi dòng chi phải đúng bằng số dư. */
const sums = (u) => pool.query(
  `SELECT (SELECT coalesce(sum(amount),0)::int FROM town_ledger WHERE user_id = $1)
          + (SELECT coalesce(sum(amount),0)::int FROM xu_ledger  WHERE user_id = $1)
          - (SELECT coalesce(sum(cost), 0)::int FROM xu_spend    WHERE user_id = $1) AS expect,
          (SELECT xu FROM town_state WHERE user_id = $1) AS balance`, [u]
).then((r) => r.rows[0]);
/* Nâng cả đảo: 5 ô × (lên cấp 1, 2, 3). */
const finishIsland = async (u) => {
  const out = [];
  for (let slot = 0; slot < C.slots; slot++) for (let lv = 0; lv < C.maxLevel; lv++) out.push(await api(u, "POST", "/upgrade", { slot }));
  return out;
};

/* ================= đọc trạng thái ================= */
t("1  Tài khoản mới: ví thật = quà ngày, 5 ô giá 10 xu, bản đồ 3 đảo (2 đảo kế còn khóa)", async () => {
  const u = newUser();
  const r = await api(u, "GET", "/");
  assert.strictEqual(r.status, 200);
  const s = r.body;
  assert.strictEqual(s.xu, LOGIN, "số dư đến từ town_state.xu, không phải số tự đặt");
  assert.deepStrictEqual(s.island.upCost, [10, 10, 10, 10, 10]);
  assert.deepStrictEqual(s.island.levels, [0, 0, 0, 0, 0]);
  assert.strictEqual(s.island.cost, IC.islandCost(1));
  assert.deepStrictEqual(s.island.map.map((m) => [m.index, m.locked]), [[1, false], [2, true], [3, true]]);
  assert.strictEqual(s.island.done, 0);
  assert.deepStrictEqual(s.pets, []);
  assert.deepStrictEqual(s.pantry, { khat: 0, ca: 0, banh: 0, dacbiet: 0 });
  assert.deepStrictEqual(s.caps, { mealsPerDay: C.mealsPerDay, caresPerDay: C.caresPerDay, lesson: TownCore.CONFIG.dailyCap });
  assert.deepStrictEqual(s.catalog.upgradeCost, C.upgradeCost, "giao diện nhận đúng bảng giá từ server");
  assert.strictEqual(s.today, today);
});
t("2  Gọi GET hai lần liên tiếp: quà không cộng lần hai, tiến độ đứng nguyên", async () => {
  const u = newUser();
  const a = (await api(u, "GET", "/")).body, b = (await api(u, "GET", "/")).body;
  assert.strictEqual(a.xu, b.xu);
  assert.deepStrictEqual(b.island.slots, a.island.slots);
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM xu_ledger WHERE user_id=$1 AND source='login'`, [u])).rows[0].n), 1);
});

/* ================= nâng cấp đảo ================= */
t("3  Thiếu xu: 409 nói rõ còn thiếu bao nhiêu, ô và ví và nhật ký chi đứng nguyên", async () => {
  const u = await walletUser(LOGIN); // chỉ có quà ngày, chưa đủ 10 xu
  const r = await api(u, "POST", "/upgrade", { slot: 0 });
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /còn thiếu 5/);
  assert.deepStrictEqual((await stateOf(u)).slots, { 1: [0, 0, 0, 0, 0] });
  assert.strictEqual(await bal(u), LOGIN);
  assert.deepStrictEqual(await spends(u), []);
});
t("4  Đủ xu: trừ đúng giá, cấp +1, ghi một dòng xu_spend island_upgrade", async () => {
  const u = await walletUser(30);
  const r = await api(u, "POST", "/upgrade", { slot: 0 });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual([r.body.result.cost, r.body.result.level, r.body.xu], [C.upgradeCost[0], 1, 30 - C.upgradeCost[0]]);
  assert.deepStrictEqual((await stateOf(u)).slots, { 1: [1, 0, 0, 0, 0] });
  assert.strictEqual(await bal(u), 20);
  assert.deepStrictEqual(await spends(u), [{ kind: "island_upgrade", topic: "island-1", slot: 0, cost: 10, xu: 20 }]);
  assert.deepStrictEqual(r.body.island.upCost, [25, 10, 10, 10, 10], "báo giá tiếp theo cho đúng ô vừa nâng");
});
t("5  Ô sai kiểu / ô vượt số / ô đã tối đa: 400, 400, 409 — ví không đổi", async () => {
  const u = await walletUser(500);
  for (const bad of ["x", null, 1.5, undefined]) assert.strictEqual((await api(u, "POST", "/upgrade", { slot: bad })).status, 400);
  assert.strictEqual((await api(u, "POST", "/upgrade", {})).status, 400);
  assert.strictEqual((await api(u, "POST", "/upgrade", { slot: C.slots })).status, 400);
  await pool.query(`UPDATE island_state SET slots = $2 WHERE user_id = $1`, [u, JSON.stringify({ 1: [3, 3, 3, 3, 3] })]);
  assert.strictEqual((await api(u, "POST", "/upgrade", { slot: 0 })).status, 409);
  assert.strictEqual(await bal(u), 500, "cú bị từ chối không được động tới ví");
  assert.strictEqual((await stateOf(u)).unlocked, 1);
});
t("6  Hoàn chỉnh đảo 1 (đúng 425 xu): mở đảo 2, ghi ngày hoàn chỉnh, thêm một chỗ thú", async () => {
  const u = await walletUser(IC.islandCost(1));
  const rs = await finishIsland(u);
  assert.deepStrictEqual(rs.map((r) => r.status), new Array(C.slots * C.maxLevel).fill(200));
  const last = rs[rs.length - 1].body;
  assert.strictEqual(last.result.completed, true);
  assert.strictEqual(last.result.nextIsland.index, 2);
  assert.strictEqual(last.xu, 0, "vừa đủ 425 xu thì tiêu hết, không âm");
  const st = await stateOf(u);
  assert.strictEqual(st.unlocked, 2);
  assert.deepStrictEqual(st.slots["2"], [0, 0, 0, 0, 0]);
  assert.strictEqual(st.completed_at["1"], today);
  assert.strictEqual((await spends(u)).length, C.slots * C.maxLevel);
  assert.strictEqual(last.island.done, 1);
  assert.strictEqual(last.island.seen, C.seenFirst + 1, "đảo hoàn chỉnh mở thêm một chỗ thú ra đảo");
  assert.strictEqual(last.island.map.find((m) => m.index === 2).locked, false);
});
t("7  Đảo 2 đắt hơn theo hệ số nhưng giá do island-core tính — server không tự sáng tác", async () => {
  const u = await walletUser(IC.islandCost(1) + 200);
  await finishIsland(u);
  const v = (await api(u, "POST", "/travel", { index: 2 })).body;
  assert.strictEqual(v.island.current, 2);
  assert.strictEqual(IC.costOf(2, 0) > IC.costOf(1, 0), true, "đảo sau đắt hơn đảo trước");
  assert.strictEqual(v.island.cost, IC.islandCost(2));
  assert.strictEqual(v.island.factor, Number(IC.factor(2).toFixed(2)));
  assert.deepStrictEqual(v.island.upCost, new Array(C.slots).fill(IC.costOf(2, 0)));
  const r = await api(u, "POST", "/upgrade", { slot: 0 });
  assert.strictEqual(r.body.result.cost, IC.costOf(2, 0));
  assert.strictEqual(r.body.xu, v.xu - IC.costOf(2, 0));
  assert.strictEqual(IC.islandCost(15), IC.islandCost(24), "hệ số có trần 3 nên đảo xa vẫn hoàn thành được");
});
t("8  Hai cú nâng cùng lúc khi chỉ đủ xu cho một: 200 + 409, ví không bao giờ âm", async () => {
  const u = await walletUser(15);
  const rs = await Promise.all([api(u, "POST", "/upgrade", { slot: 0 }), api(u, "POST", "/upgrade", { slot: 1 })]);
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [200, 409]);
  assert.strictEqual(await bal(u), 5);
  assert.strictEqual((await spends(u)).length, 1);
});

/* ================= du lịch ================= */
t("9  Du lịch: đảo khóa 409, số sai 400, đảo đã mở thì giữ nguyên tiến độ mọi đảo", async () => {
  const u = await walletUser(IC.islandCost(1) + 50);
  assert.strictEqual((await api(u, "POST", "/travel", { index: 2 })).status, 409);
  for (const bad of ["x", null, 0, -1]) assert.strictEqual((await api(u, "POST", "/travel", { index: bad })).status, 400);
  await finishIsland(u);
  await api(u, "POST", "/travel", { index: 2 });
  await api(u, "POST", "/upgrade", { slot: 0 }); // đảo 2 có một ô cấp 1
  const back = (await api(u, "POST", "/travel", { index: 1 })).body;
  assert.strictEqual(back.island.current, 1);
  assert.deepStrictEqual(back.island.slots["1"], [3, 3, 3, 3, 3]);
  assert.deepStrictEqual(back.island.slots["2"], [1, 0, 0, 0, 0]);
});

/* ================= thú ================= */
t("10 Nhận nuôi: đúng giá niêm yết, tên tự đặt hoặc hệ thống đặt, một dòng chi pet_buy", async () => {
  const u = await walletUser(100);
  const r = await api(u, "POST", "/adopt", { breed: "cat-tabby", name: "Bông" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.xu, 60);
  const p = r.body.pets[0];
  assert.deepStrictEqual([p.name, p.breed, p.friendXp, p.satiety, p.mood, p.level], ["Bông", "cat-tabby", 0, C.petStart.satiety, C.petStart.mood, 1]);
  const rows = await petsOf(u);
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(await spends(u), [{ kind: "pet_buy", topic: "cat-tabby", slot: Number(rows[0].id), cost: 40, xu: 60 }]);
  const auto = (await api(u, "POST", "/adopt", { breed: "dog-village" })).body;
  const nm = auto.pets[1].name;
  assert.ok(nm && [...nm].length <= C.nameMax, "thú không tên phải được hệ thống đặt tên");
  assert.strictEqual(auto.xu, 20);
});
t("11 Giống lạ / tên quá dài / thiếu xu: 400, 400, 409 — không có dòng thú nào", async () => {
  const u = await walletUser(30);
  assert.strictEqual((await api(u, "POST", "/adopt", { breed: "rong" })).status, 400);
  assert.strictEqual((await api(u, "POST", "/adopt", { breed: "cat-tabby", name: "x".repeat(21) })).status, 400);
  assert.strictEqual((await api(u, "POST", "/adopt", { breed: "cat-tabby" })).status, 409);
  assert.deepStrictEqual(await petsOf(u), []);
  assert.strictEqual(await bal(u), 30);
});
t("12 Mua thức ăn: xu đổi thành đồ ăn trong kho, số lượng sai thì 400", async () => {
  const u = await walletUser(30);
  const r = await api(u, "POST", "/food", { item: "khat", qty: 5 });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual([r.body.pantry.khat, r.body.xu], [5, 15]);
  assert.deepStrictEqual(await pantryOf(u), { khat: 5 });
  assert.deepStrictEqual(await spends(u), [{ kind: "pet_food", topic: "khat", slot: null, cost: 15, xu: 15 }]);
  for (const qty of [0, 100, "x"]) assert.strictEqual((await api(u, "POST", "/food", { item: "khat", qty })).status, 400);
  assert.strictEqual((await api(u, "POST", "/food", { item: "pho-mai", qty: 1 })).status, 400);
  assert.strictEqual((await api(u, "POST", "/food", { item: "dacbiet", qty: 2 })).status, 409, "80 xu cho 2 bữa đặc biệt > 15 xu còn lại");
  assert.deepStrictEqual([await pantryOf(u).then((p) => p.khat), await bal(u)], [5, 15], "cú bị từ chối không đổi kho và ví");
});
t("13 Cho ăn: tốn một phần ăn trong kho, KHÔNG trừ xu lần hai, tối đa 3 bữa/ngày", async () => {
  const u = await walletUser(200);
  const pet = (await api(u, "POST", "/adopt", { breed: "dog-shiba", name: "Mực" })).body.pets[0];
  await api(u, "POST", "/food", { item: "ca", qty: 4 });
  const before = await bal(u);
  const f = await api(u, "POST", "/feed", { petId: pet.id, item: "ca" });
  assert.strictEqual(f.status, 200);
  assert.deepStrictEqual([f.body.pantry.ca, f.body.xu], [3, before], "cho ăn không được đụng tới ví");
  const p = f.body.pets[0];
  assert.deepStrictEqual([p.meals, p.satiety, p.friendXp], [1, C.petStart.satiety + 25, IC.foodOf("ca").aff]);
  await api(u, "POST", "/feed", { petId: pet.id, item: "ca" });
  const third = await api(u, "POST", "/feed", { petId: pet.id, item: "ca" });
  assert.strictEqual(third.body.pets[0].satiety, 100, "No bụng chỉ đến 100");
  const over = await api(u, "POST", "/feed", { petId: pet.id, item: "ca" });
  assert.strictEqual(over.status, 409); assert.match(over.body.error, /3 bữa hôm nay/);
  assert.strictEqual(await bal(u), before, "ba bữa ăn không làm ví dịch chuyển");
  assert.strictEqual((await api(u, "POST", "/feed", { petId: 999999, item: "ca" })).status, 404);
  assert.strictEqual((await api(u, "POST", "/feed", { petId: pet.id, item: "tra" })).status, 400);
  /* Con thú thứ hai (chưa ăn bữa nào) để kiểm đúng luật "kho hết thức ăn": */
  const other = (await api(u, "POST", "/adopt", { breed: "dog-village", name: "Vàng" })).body.pets[1];
  const empty = await api(u, "POST", "/feed", { petId: other.id, item: "banh" });
  assert.strictEqual(empty.status, 409); assert.match(empty.body.error, /Kho hết/);
  assert.strictEqual((await spends(u)).length, 3, "chỉ mua thú và mua thức ăn mới trừ xu");
});
t("14 Vuốt ve và chơi bóng: miễn phí, +1 thân thiết, tối đa 5 lần/ngày", async () => {
  const u = await walletUser(100);
  const pet = (await api(u, "POST", "/adopt", { breed: "cat-tabby", name: "Cam" })).body.pets[0];
  const before = await bal(u);
  for (let i = 1; i <= C.caresPerDay; i++) {
    const r = await api(u, "POST", "/care", { petId: pet.id, action: i % 2 ? "pet" : "play" });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.pets[0].cares, i);
    assert.strictEqual(r.body.pets[0].friendXp, i);
    assert.strictEqual((await spends(u)).length, 1, "chăm thú không tạo thêm dòng chi nào");
  }
  const over = await api(u, "POST", "/care", { petId: pet.id, action: "pet" });
  assert.strictEqual(over.status, 409); assert.match(over.body.error, /5 lần/);
  assert.strictEqual((await api(u, "POST", "/care", { petId: pet.id, action: "tam" })).status, 400);
  assert.strictEqual(await bal(u), before);
  assert.strictEqual((await petsOf(u))[0].mood <= 100, true, "mood không vượt 100");
});
t("15 Nghỉ 30 ngày: No và Vui rơi đúng sàn 30, thân thiết giữ nguyên, không mất thú", async () => {
  const u = await walletUser(100);
  const pet = (await api(u, "POST", "/adopt", { breed: "cat-tabby", name: "Cam" })).body.pets[0];
  await api(u, "POST", "/food", { item: "banh", qty: 1 });
  await api(u, "POST", "/feed", { petId: pet.id, item: "banh" });
  /* CSDL ghi ngày gần nhất của thú lùi lại 30 ngày — đúng cảnh người chơi nghỉ hẳn tháng. */
  await pool.query(`UPDATE pet_owned SET updated_at = now() - interval '30 days', day = day - 30 WHERE id = $1`, [pet.id]);
  const s = (await api(u, "GET", "/")).body.pets[0];
  assert.deepStrictEqual([s.satiety, s.mood], [C.satietyFloor, C.moodFloor]);
  assert.strictEqual(s.friendXp, IC.foodOf("banh").aff, "thân thiết CHỈ tăng, không bao giờ giảm");
  assert.strictEqual(s.meals, 0, "sang ngày mới thì bộ đếm bữa được reset");
});
t("16 Cách ly tài khoản: đảo, thú, kho của A không hiện với B", async () => {
  const a = await walletUser(IC.islandCost(1));
  await finishIsland(a);
  await api(a, "POST", "/adopt", { breed: "dog-corgi", name: "Đu" });
  await api(a, "POST", "/food", { item: "khat", qty: 2 });
  const s = (await api(newUser(), "GET", "/")).body;
  assert.deepStrictEqual(s.island.slots, { 1: [0, 0, 0, 0, 0] });
  assert.strictEqual(s.island.unlocked, 1);
  assert.deepStrictEqual(s.pets, []);
  assert.strictEqual(s.pantry.khat, 0);
  assert.strictEqual(s.xu, LOGIN, "B chỉ có quà của chính B");
});
t("17 Bất biến ví: học bài + quà rồi tiêu đủ đường, thu − chi đúng bằng số dư", async () => {
  const u = newUser(); // không nạp tay: mọi xu phải đi qua sổ cái
  for (let d = 8; d >= 0; d--) for (let i = 0; i < 30; i++) await att(u, 1 + d * 30 + i, true, at(d, 8, i));
  const v = (await api(u, "GET", "/")).body;
  assert.strictEqual(v.income.lesson, TownCore.CONFIG.dailyCap, "hôm nay nhận đúng trần xu bài học");
  assert.ok(v.xu > IC.islandCost(1) + 60, "9 ngày học phải đủ nuôi cả đảo 1 + vài thú, xu = " + v.xu);
  await api(u, "POST", "/food", { item: "khat", qty: 3 });
  const pet = (await api(u, "POST", "/adopt", { breed: "cat-calico", name: "Ba" })).body.pets[0];
  await api(u, "POST", "/feed", { petId: pet.id, item: "khat" });
  await api(u, "POST", "/care", { petId: pet.id, action: "pet" });
  assert.deepStrictEqual((await finishIsland(u)).map((r) => r.status), new Array(C.slots * C.maxLevel).fill(200));
  const q = await sums(u);
  assert.strictEqual(q.expect, q.balance, `thu−chi=${q.expect} nhưng số dư=${q.balance}`);
  assert.ok(q.balance >= 0);
  const kinds = (await pool.query(`SELECT kind, count(*)::int n FROM xu_spend WHERE user_id=$1 GROUP BY 1 ORDER BY 1`, [u])).rows;
  assert.deepStrictEqual(kinds, [{ kind: "island_upgrade", n: 15 }, { kind: "pet_buy", n: 1 }, { kind: "pet_food", n: 1 }]);
});
t("18 Không có đường nào cộng xu: mọi POST của đảo chỉ tiêu hoặc đứng nguyên", async () => {
  const u = await walletUser(300);
  const start = await bal(u);
  const pet = (await api(u, "POST", "/adopt", { breed: "dog-village", name: "Vàng" })).body.pets[0];
  await api(u, "POST", "/food", { item: "ca", qty: 1 });
  const acts = [["/upgrade", { slot: 4 }], ["/travel", { index: 1 }], ["/adopt", { breed: "cat-tabby" }],
    ["/feed", { petId: pet.id, item: "ca" }], ["/care", { petId: pet.id, action: "play" }], ["/care", { petId: pet.id, action: "pet" }]];
  for (const [p, body] of acts) {
    const before = await bal(u);
    const r = await api(u, "POST", p, body);
    assert.ok([200, 409].includes(r.status), `${p} → ${r.status}`);
    assert.ok(await bal(u) <= before, `${p} không được cộng xu vào ví`);
  }
  assert.ok(await bal(u) < start, "cả chuỗi thao tác chỉ được tiêu, không được in xu");
  const sp = await spends(u);
  assert.deepStrictEqual([...new Set(sp.map((r) => r.kind))].sort(), ["island_upgrade", "pet_buy", "pet_food"]);
  assert.strictEqual(start - (await bal(u)), sp.reduce((s, r) => s + r.cost, 0), "mỗi xu tiêu ra đều có một dòng nhật ký");
});

(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
  const admin = new Pool({ connectionString: URL_DB });
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.query(`SET search_path=${SCHEMA}; CREATE TABLE questions (id integer PRIMARY KEY, topic text);
    CREATE TABLE attempts (id bigserial PRIMARY KEY, user_id integer NOT NULL, question_id integer, correct boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
  for (const f of ["town.sql", "sakura.sql", "island.sql"]) {
    await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "..", "CSDL", f), "utf8")}`);
  }
  const ins = [];
  for (let i = 1; i <= 400; i++) ins.push(`(${i},'Thì')`);
  await admin.query(`INSERT INTO ${SCHEMA}.questions VALUES ${ins.join(",")}`);

  const app = express();
  app.use((req, _res, next) => { req.userId = Number(req.headers["x-user"]); next(); });
  app.use("/api/islands", createIslandRouter({ db }));
  const server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/islands`;

  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log("  ✔", name); }
    catch (e) { fail++; console.log("  ✘", name, "\n     ", String(e.message).split("\n").slice(0, 5).join("\n     ")); }
  }
  console.log(`\n${pass} đạt, ${fail} lỗi`);
  server.close(); await pool.end();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`); await admin.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
