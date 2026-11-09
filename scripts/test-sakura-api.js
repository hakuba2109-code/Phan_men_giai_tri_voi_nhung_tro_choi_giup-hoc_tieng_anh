"use strict";
/* Kiểm thử tích hợp backend Đảo hoa anh đào VỚI VÍ XU CHUNG: server Express thật + PostgreSQL thật, 0 token, không gọi AI.
   Chạy:  node scripts/test-sakura-api.js   (đọc DATABASE_URL từ .env ở gốc dự án)
   Script TỰ TẠO schema tạm `sakura_test` (attempts/questions TỐI GIẢN + town.sql + sakura.sql), chạy xong XÓA schema.
   Điểm mấu chốt của bản làm chung ví: cây KHÔNG còn tự in xu nữa. Mọi xu đến từ xu.js (town_ledger),
   còn sakura chỉ TIÊU xu và giữ điểm sinh trưởng. sakura_ledger vì vậy không được ghi thêm dòng nào. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");
const T = require("../src/town-core");
const SC = require("../src/sakura-core");
const { createSakuraRouter, transferGuestData } = require("../src/sakura");
const { transferGuestData: transferTown } = require("../src/town"); // ví thuộc thị trấn, cây thuộc đảo: đăng ký phải chuyển cả hai

const URL_DB = process.env.DATABASE_URL;
if (!URL_DB) { console.error("Thiếu DATABASE_URL."); process.exit(2); }
const SCHEMA = "sakura_test";
const pool = new Pool({ connectionString: URL_DB, options: `-c search_path=${SCHEMA}` });
const db = {
  async withTransaction(fn) {
    const c = await pool.connect();
    try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  },
};

const LOGIN = T.CONFIG.xu.login.gift, WATER = SC.CONFIG.actions.water.cost, FERT = SC.CONFIG.actions.fertilize.cost;
let pass = 0, fail = 0, base;
const tests = [], t = (name, fn) => tests.push([name, fn]);
const api = async (user, method, p, body) => {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const today = T.dayKey(Date.now());
const at = (daysAgo, hh, mm = 0) => `${T.addDays(today, -daysAgo)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`;
let uid = 2000;
const newUser = () => ++uid;
const att = (u, q, correct, when) => pool.query(`INSERT INTO attempts (user_id, question_id, correct, created_at) VALUES ($1,$2,$3,$4)`, [u, q, correct, when]);
const earnN = async (u, n, start = 1, when = at(0, 8)) => { for (let i = 0; i < n; i++) await att(u, start + i, true, when); }; // n câu mới đúng = 3n xu (trần 60/ngày)
const wallet = (u) => pool.query(`SELECT xu FROM town_state WHERE user_id = $1`, [u]).then((r) => Number(r.rows[0].xu));
const setWallet = (u, amount) => pool.query(`INSERT INTO town_state (user_id, xu) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET xu = $2`, [u, amount]);
/* Nạp ví cho chắc: phải đọc một lần để quà đăng nhập 5 xu đã vào sổ TRƯỚC khi ghi số dư,
   nếu không lần đọc kế tiếp sẽ cộng thêm 5 xu và phá mất con số mong đợi. */
const richUser = async (amount) => { const u = newUser(); await api(u, "GET", "/"); await setWallet(u, amount); return u; };
/* Số xu bài học luôn đi kèm quà đăng nhập 5 xu của cùng một ví. */
const coinsOf = (n) => n + LOGIN;

t("1  Ba câu mới đúng ở ba chủ điểm: ví 9 xu + quà ngày, cây còn hạt giống", async () => {
  const u = newUser(); await att(u, 1, true, at(0, 8)); await att(u, 201, true, at(0, 9)); await att(u, 301, true, at(0, 10));
  const s = (await api(u, "GET", "/")).body;
  assert.deepStrictEqual([s.coins, s.points, s.stage.name, s.today_stats.earned], [coinsOf(9), 0, "Hạt giống", 9]);
});
t("2  Không in xu hai lần: sakura_ledger đứng yên, tiền chỉ nằm ở town_ledger", async () => {
  const u = newUser(); await earnN(u, 5);
  const before = Number((await pool.query(`SELECT count(*)::int n FROM sakura_ledger WHERE user_id=$1`, [u])).rows[0].n);
  await api(u, "GET", "/"); await api(u, "GET", "/");
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM sakura_ledger WHERE user_id=$1`, [u])).rows[0].n), before);
  assert.strictEqual(Number((await pool.query(`SELECT count(*)::int n FROM town_ledger WHERE user_id=$1`, [u])).rows[0].n), 5);
  assert.strictEqual(await wallet(u), coinsOf(15));
});
t("3  Gọi GET hai lần liên tiếp: số liệu không đổi", async () => {
  const u = newUser(); await earnN(u, 2);
  const a = (await api(u, "GET", "/")).body, b = (await api(u, "GET", "/")).body;
  assert.deepStrictEqual(a, b); assert.strictEqual(b.coins, coinsOf(6));
});
t("4  Thêm lượt rồi gọi lại: chỉ cộng phần mới", async () => {
  const u = newUser(); await earnN(u, 1); await api(u, "GET", "/");
  await earnN(u, 2, 10); assert.strictEqual((await api(u, "GET", "/")).body.coins, coinsOf(9));
});
t("5  Một câu đúng 5 lần cùng ngày: ví chỉ nhận một lần", async () => {
  const u = newUser(); for (let i = 0; i < 5; i++) await att(u, 5, true, at(0, 8 + i));
  assert.strictEqual((await api(u, "GET", "/")).body.coins, coinsOf(3));
});
t("6  100 câu khác nhau đều đúng trong một ngày: bài học 60 (trần) + học thêm 20 (trần) + quà", async () => {
  const u = newUser(); for (let i = 0; i < 100; i++) await att(u, 10 + i, true, at(0, 9, i % 60));
  const s = (await api(u, "GET", "/")).body;
  const EXTRA = T.CONFIG.xu.extra.cap;
  assert.deepStrictEqual([s.coins, s.today_stats.earned, s.today_stats.cap], [coinsOf(T.CONFIG.dailyCap + EXTRA), 60, 60]);
  assert.strictEqual(Number((await pool.query(`SELECT coalesce(sum(amount),0)::int n FROM xu_ledger WHERE user_id=$1 AND source='extra'`, [u])).rows[0].n), EXTRA,
    "20 xu học thêm nằm ở sổ cái xu, không trộn vào sổ cái bài học");
});
t("7  Câu từng sai rồi đúng: thưởng fixed = 4, sổ cái bài học thuộc ví chung", async () => {
  const u = newUser(); await att(u, 7, false, at(2, 9)); await att(u, 7, true, at(1, 9));
  const s = (await api(u, "GET", "/")).body; // phải đọc ví trước thì sổ cái mới được ghi
  assert.strictEqual(s.coins, 4 + LOGIN);
  const rows = (await pool.query(`SELECT kind, amount FROM town_ledger WHERE user_id = $1`, [u])).rows;
  assert.deepStrictEqual(rows.map((r) => [r.kind, r.amount]), [["fixed", 4]]);
});
t("8  Lượt có question_id NULL hoặc câu không chủ điểm: bỏ qua, không lỗi, mốc vẫn tiến", async () => {
  const u = newUser(); await att(u, null, true, at(0, 8)); await att(u, 400, true, at(0, 9)); await att(u, 1, true, at(0, 10));
  const r = await api(u, "GET", "/"); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.coins, coinsOf(3));
  const last = (await pool.query(`SELECT last_attempt_id FROM town_state WHERE user_id=$1`, [u])).rows[0].last_attempt_id;
  assert.strictEqual(Number(last), Number((await pool.query(`SELECT max(id) m FROM attempts WHERE user_id=$1`, [u])).rows[0].m));
});
t("9  Có 30 ngày lịch sử, lần đầu: ví chỉ tính ~14 ngày gần nhất", async () => {
  const u = newUser(); for (let d = 29; d >= 0; d--) await att(u, 20 + d, true, at(d, 9));
  const s = (await api(u, "GET", "/")).body;
  assert.ok(s.coins - LOGIN >= 13 * 3 && s.coins - LOGIN <= 15 * 3, "xu bài học = " + (s.coins - LOGIN));
});

/* ---------- chăm cây bằng ví chung ---------- */
t("10 Tưới nước: −5 xu khỏi VÍ, +10 điểm, ghi nhật ký chăm + nhật ký chi", async () => {
  const u = newUser(); await earnN(u, 4); // 12 + quà 5 = 17
  const r = await api(u, "POST", "/care", { action: "water" });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual([r.body.coins, r.body.points, r.body.cost, r.body.gained, r.body.leveledUp], [12, 10, WATER, 10, false]);
  assert.strictEqual(await wallet(u), 12, "trừ thẳng vào town_state.xu");
  const s = (await api(u, "GET", "/")).body; assert.deepStrictEqual([s.coins, s.points], [12, 10]);
  assert.strictEqual((await api(u, "GET", "/history")).body.items[0].type, "care");
  assert.deepStrictEqual(
    (await pool.query(`SELECT kind, cost, xu FROM xu_spend WHERE user_id = $1`, [u])).rows,
    [{ kind: "sakura", cost: WATER, xu: 12 }]
  );
});
t("11 Lên giai đoạn: 25 điểm + tưới -> 35 điểm = Mầm non, leveledUp = true; tưới tiếp thì false", async () => {
  const u = newUser(); await earnN(u, 5); await api(u, "GET", "/");
  await pool.query(`UPDATE sakura_state SET points=25 WHERE user_id=$1`, [u]);
  const a = (await api(u, "POST", "/care", { action: "water" })).body, b = (await api(u, "POST", "/care", { action: "water" })).body;
  assert.deepStrictEqual([a.leveledUp, a.stage.name, b.leveledUp], [true, "Mầm non", false]);
});
t("12 Thiếu xu / hành động lạ / cây trọn vẹn: 409 / 400 / 409, không trừ gì", async () => {
  const u = await richUser(3); // 3 xu: đủ đọc cây nhưng chưa đủ tưới
  assert.strictEqual((await api(u, "POST", "/care", { action: "water" })).status, 409);
  for (const a of ["constructor", "xx", 5, null]) assert.strictEqual((await api(u, "POST", "/care", { action: a })).status, 400);
  assert.strictEqual(await wallet(u), 3, "bị từ chối thì ví còn nguyên");
  await setWallet(u, 50);
  await pool.query(`UPDATE sakura_state SET points=900 WHERE user_id=$1`, [u]);
  assert.strictEqual((await api(u, "POST", "/care", { action: "water" })).status, 409);
  const s = (await api(u, "GET", "/")).body; assert.deepStrictEqual([s.coins, s.points], [50, 900]);
});
t("13 Gần đầy cây: bón phân ở 895 điểm chỉ tính 2 xu cho 5 điểm, rồi cây trọn vẹn", async () => {
  const u = newUser(); await earnN(u, 17); await api(u, "GET", "/"); // 51 + quà 5 = 56
  await pool.query(`UPDATE sakura_state SET points=895 WHERE user_id=$1`, [u]);
  const r = (await api(u, "POST", "/care", { action: "fertilize" })).body;
  assert.deepStrictEqual([r.cost, r.gained, r.coins, r.points, r.done], [2, 5, 54, 900, true]);
  assert.strictEqual((await api(u, "POST", "/care", { action: "water" })).status, 409);
});
t("14 Hai lần tưới song song khi ví chỉ đủ cho một: một thành công, một 409, xu không âm", async () => {
  const u = await richUser(WATER);
  const rs = await Promise.all([api(u, "POST", "/care", { action: "water" }), api(u, "POST", "/care", { action: "water" })]);
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [200, 409]);
  const s = (await pool.query(`SELECT points FROM sakura_state WHERE user_id=$1`, [u])).rows[0];
  assert.deepStrictEqual([await wallet(u), s.points], [0, 10]);
});
t("15 Mất mốc đồng bộ (town_state.last_attempt_id = 0) rồi GET: ví KHÔNG bị cộng lần hai", async () => {
  const u = newUser(); await earnN(u, 3); const before = (await api(u, "GET", "/")).body.coins;
  await pool.query(`UPDATE town_state SET last_attempt_id=0 WHERE user_id=$1`, [u]);
  assert.strictEqual((await api(u, "GET", "/")).body.coins, before);
  assert.strictEqual(await wallet(u), before, "sổ cái UNIQUE chặn in xu lại");
});
t("16 Tắt: GET trả enabled=false, tưới 409; bật lại: cây nguyên vẹn, ví tiếp tục đúng", async () => {
  const u = newUser(); await earnN(u, 2); await api(u, "GET", "/");
  assert.strictEqual((await api(u, "POST", "/settings", { enabled: false })).body.enabled, false);
  await earnN(u, 2, 50);
  assert.strictEqual((await api(u, "GET", "/")).body.enabled, false);
  assert.strictEqual((await api(u, "POST", "/care", { action: "water" })).status, 409);
  assert.strictEqual((await api(u, "POST", "/settings", { enabled: "yes" })).status, 400);
  assert.strictEqual(await wallet(u), coinsOf(6), "lúc tắt thì cây không đồng bộ, ví đứng tại chỗ (mở /api/town hoặc /api/xu mới tính tiếp)");
  await api(u, "POST", "/settings", { enabled: true });
  const s = (await api(u, "GET", "/")).body;
  assert.deepStrictEqual([s.coins, s.today_stats.earned], [coinsOf(12), 12]);
});
t("17 Tài khoản B không thấy cây của A, và chỉ có quà của chính B", async () => {
  const a = newUser(), b = newUser(); await earnN(a, 2);
  assert.strictEqual((await api(a, "GET", "/")).body.coins, coinsOf(6));
  assert.deepStrictEqual([(await api(b, "GET", "/")).body.coins, (await api(b, "GET", "/")).body.points], [LOGIN, 0]);
});
t("18 Khách (user 0) chơi rồi đăng ký: cây, ví, nhật ký chăm chuyển sang tài khoản mới; không ghi đè nếu đã có", async () => {
  const g = 0, n = newUser();
  await pool.query(`DELETE FROM xu_spend WHERE user_id=0; DELETE FROM xu_ledger WHERE user_id=0;
    DELETE FROM sakura_ledger WHERE user_id=0; DELETE FROM sakura_care WHERE user_id=0; DELETE FROM sakura_state WHERE user_id=0;
    DELETE FROM town_ledger WHERE user_id=0; DELETE FROM town_state WHERE user_id=0; DELETE FROM attempts WHERE user_id=0;`);
  await earnN(g, 4); await api(g, "GET", "/"); await api(g, "POST", "/care", { action: "water" });
  const walletBefore = await wallet(g);
  const moved = await db.withTransaction(async (c) => {
    await c.query(`UPDATE attempts SET user_id=$2 WHERE user_id=$1`, [g, n]);
    const r = await transferGuestData(c, g, n);
    await transferTown(c, g, n);
    return r;
  });
  assert.deepStrictEqual(moved, { moved: true, conflict: false });
  const s = (await api(n, "GET", "/")).body;
  assert.deepStrictEqual([s.coins, s.points], [walletBefore, 10], "đúng số xu Khách đang có, không in thêm");
  assert.strictEqual((await api(n, "GET", "/history")).body.items.length, 1);
  assert.deepStrictEqual(await db.withTransaction((c) => transferGuestData(c, g, n)), { moved: false, conflict: true });
});
t("19 Báo giá hành động trong GET: canDo/why đúng theo ví hiện có", async () => {
  const u = await richUser(6);
  const a = (await api(u, "GET", "/")).body.actions;
  assert.deepStrictEqual([a.water.canDo, a.fertilize.canDo], [true, false]);
  assert.ok(a.fertilize.why.includes("20") && a.fertilize.why.includes("6"), a.fertilize.why);
});

(async () => {
  const admin = new Pool({ connectionString: URL_DB });
  await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.query(`SET search_path=${SCHEMA}; CREATE TABLE questions (id integer PRIMARY KEY, topic text);
    CREATE TABLE attempts (id bigserial PRIMARY KEY, user_id integer NOT NULL, question_id integer, correct boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
  await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "../CSDL/town.sql"), "utf8")}`);
  await admin.query(`SET search_path=${SCHEMA}; ${fs.readFileSync(path.join(__dirname, "../CSDL/sakura.sql"), "utf8")}`);
  const ins = [];
  for (let i = 1; i <= 150; i++) ins.push(`(${i},'Thì')`);
  for (let i = 1; i <= 50; i++) ins.push(`(${200 + i},'Giới từ')`);
  for (let i = 1; i <= 50; i++) ins.push(`(${300 + i},'Từ vựng')`);
  ins.push("(400,NULL)");
  await admin.query(`INSERT INTO ${SCHEMA}.questions VALUES ${ins.join(",")}`);

  const app = express();
  app.use((req, _res, next) => { req.userId = Number(req.headers["x-user"]); next(); });
  app.use("/api/sakura", createSakuraRouter({ db }));
  const server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/sakura`;

  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log("  ✔", name); }
    catch (e) { fail++; console.log("  ✘", name, "\n     ", String(e.message).split("\n").slice(0, 5).join("\n     ")); }
  }
  console.log(`\n${pass} đạt, ${fail} lỗi`);
  server.close(); await pool.end();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`); await admin.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
