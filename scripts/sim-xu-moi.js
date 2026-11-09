"use strict";
/* Mô phỏng xu: bảng CŨ (chỉ bài học + trò chơi + đăng nhập) so với bảng MỚI ("Xu cho MỌI hoạt động học tập"),
   rồi đếm số ngày hoàn chỉnh một đảo.
   Chạy:  node scripts/sim-xu-moi.js          — chỉ số học, 0 CSDL, 0 token
          node scripts/sim-xu-moi.js --db     — đọc thêm DATABASE_URL: đo người chơi THẬT 14 ngày gần nhất
   Mọi con số lấy từ CONFIG.xu (src/town-core.js) và IslandCore (src/island-core.js) — KHÔNG ghi số cứng ở đây,
   nên sửa giá trong cấu hình là bảng này tự cập nhật. */
const assert = require("assert");
const path = require("path");
const T = require("../src/town-core");
const Island = require("../src/island-core");
const X = T.CONFIG.xu, G = X.game, CAP_LESSON = T.CONFIG.dailyCap;

/* ---------- 1. Trần từng nhóm ---------- */
const CAPS_NEW = {
  lesson: CAP_LESSON, extra: X.extra.cap, game: G.cap,
  words: X.words.cap, wordnew: X.wordnew.cap, login: X.login.gift,
};
/* Bảng cũ: chưa có 'extra'/'words'/'wordnew', trò chơi chỉ 20 xu và mọi trò kỹ năng chung một hạn. */
const CAPS_OLD = { lesson: CAP_LESSON, game: 20, login: X.login.gift };

/* Giá đảo: đối chiếu 6 con số đã ghi trong README-kinh-te-xu.md trước khi dùng. */
const PRICES = [1, 2, 3, 5, 10, 15].map(Island.islandCost);
assert.deepStrictEqual(PRICES, [425, 490, 555, 680, 995, 1275], "giá đảo đổi mà tài liệu chưa cập nhật");

const clampTo = (use, caps) => Object.keys(use).reduce((s, k) => s + Math.min(use[k], caps[k] || 0), 0);
const PERSONAS = [
  { name: "Học nhẹ   (~10 phút)", use: { lesson: 15, game: 4, login: X.login.gift } },
  { name: "Học đều   (~30 phút)", use: { lesson: 40, game: 12, words: 8, wordnew: 2, login: X.login.gift } },
  { name: "Học kỹ   (~60 phút)", use: { lesson: 70, extra: 25, game: 40, words: 20, wordnew: 8, login: X.login.gift } },
];
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/* Quà chuỗi: mốc NHẬN MỘT LẦN suốt đời, cộng đúng vào ngày chạm mốc. */
const lumps = (table) => {
  const m = {};
  for (const [days, gift] of table) m[days] = gift;
  return m;
};
const STREAK_OLD = X.streak.filter(([d]) => d <= 100);
const STREAK_NEW = X.streak;

function daysToReach(cost, perDay, lumps) {
  let s = 0;
  for (let d = 1; d <= 2000; d++) { s += perDay + (lumps[d] || 0); if (s >= cost) return d; }
  return Infinity;
}

/* ---------- 2. Bảng số học ---------- */
console.log("Bảng thưởng mới (từ CONFIG.xu):");
for (const [k, v] of Object.entries(CAPS_NEW)) console.log(`   ${k.padEnd(8)} ${String(v).padStart(3)} xu/ngày`);
console.log(`   TỔNG      ${sum(CAPS_NEW)} xu/ngày khi chạm MỌI trần (chưa tính file, vườn hoa, quà chuỗi)`);
console.log(`   bảng cũ   ${sum(CAPS_OLD)} xu/ngày (chỉ ba nhóm)\n`);
console.log("Giá hoàn thành đảo:", [1, 2, 3, 5, 10, 15].map((n, i) => `đảo ${n} = ${PRICES[i]}`).join(" · "));
console.log(`Chuỗi: ${STREAK_OLD.length} mốc = ${STREAK_OLD.reduce((a, m) => a + m[1], 0)} xu → ${STREAK_NEW.length} mốc = ${STREAK_NEW.reduce((a, m) => a + m[1], 0)} xu\n`);

for (const p of PERSONAS) {
  const old = clampTo(p.use, CAPS_OLD), neu = clampTo(p.use, CAPS_NEW);
  console.log(`${p.name}: ${old} → ${neu} xu/ngày (${neu > old ? "+" + Math.round(((neu - old) / old) * 100) + "%" : "không đổi"})`);
  for (const n of [1, 2, 3, 5, 10, 15]) {
    const c = Island.islandCost(n);
    console.log([
      "   ", `đảo ${String(n).padStart(2)}`, `(${String(c).padStart(4)})`,
      `${(c / old).toFixed(1).padStart(6)} → ${(c / neu).toFixed(1).padStart(6)} ngày`,
      `chuỗi: ${String(daysToReach(c, old, lumps(STREAK_OLD))).padStart(4)} → ${String(daysToReach(c, neu, lumps(STREAK_NEW))).padStart(4)} ngày`,
    ].join(" "));
  }
}
const steady = clampTo(PERSONAS[1].use, CAPS_NEW);
console.log("\nThú (Học đều, không chuỗi):",
  [["⭐", 40], ["⭐⭐", 120], ["⭐⭐⭐", 300], ["⭐⭐⭐⭐", 600]]
    .map(([t, c]) => `${t} ${c} ≈ ${(c / steady).toFixed(1)} ngày`).join(" · "));

/* ---------- 3. Đo người chơi THẬT (--db) ---------- */
if (!process.argv.includes("--db")) {
  console.log("\n(chạy thêm `--db` để đối chiếu với số liệu thật trong DATABASE_URL)");
  process.exit(0);
}

const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0;

(async () => {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
  const db = require("../src/db");
  const xu = require("../src/xu");
  await db.applySchema();
  const zone = xu.tz(); // cùng cách tính ngày với máy chủ (APP_TZ || CONFIG.tz)
  const today = T.dayKey(Date.now(), zone);
  const since = T.addDays(today, -13);

  /* Một dòng = một (người chơi, ngày) và XU KIẾM ĐƯỢC TỪ HỌC TẬP hôm đó: bài học + năm nhóm có trần
     (extra · game · words · wordnew · login).  Cố ý KHÔNG tính `convert` (mốc dời ví một lần),
     `streak` (quà một lần suốt đời) và `garden` (vườn hoa, không phải học) — vì 136 xu trần cũng không cộng ba thứ đó.
     Chỉ tính tài khoản CÒN TỒN TẠI: sổ cái của mấy tài khoản thử đã xóa vẫn nằm lại trong DB phát triển.
     VÀ loại tài khoản DEMO (seed:3-dao, đuôi email IC.CONFIG.demoMail): một tài khoản 19 ngày × 100 xu
     bịa ra sẽ kéo trung vị và "tổng chi" trong README đi chỗ khác. */
  const DEMO = "%" + Island.CONFIG.demoMail;
  const loai = (await db.query(
    `SELECT (SELECT count(*)::int FROM (
              SELECT amount FROM town_ledger t JOIN users u ON u.id = t.user_id WHERE u.email LIKE $1
              UNION ALL
              SELECT amount FROM xu_ledger  l JOIN users u ON u.id = l.user_id WHERE u.email LIKE $1) d)::int AS dong_thu,
            (SELECT coalesce(sum(amount),0)::int FROM (
              SELECT amount FROM town_ledger t JOIN users u ON u.id = t.user_id WHERE u.email LIKE $1
              UNION ALL
              SELECT amount FROM xu_ledger  l JOIN users u ON u.id = l.user_id WHERE u.email LIKE $1) d) AS xu_thu,
            (SELECT count(*)::int FROM xu_spend s JOIN users u ON u.id = s.user_id WHERE u.email LIKE $1) AS dong_chi,
            (SELECT coalesce(sum(s.cost),0)::int FROM xu_spend s JOIN users u ON u.id = s.user_id WHERE u.email LIKE $1) AS xu_chi,
            (SELECT count(*)::int FROM users u WHERE u.email LIKE $1) AS nguoi_demo`,
    [DEMO]
  )).rows[0];
  const days = (await db.query(
    `SELECT s.user_id, s.day, sum(s.amount)::int AS xu FROM (
       SELECT user_id, day, amount FROM town_ledger
       UNION ALL
       SELECT user_id, day, amount FROM xu_ledger
         WHERE source IN ('extra','game','words','wordnew','login')
     ) s JOIN users u ON u.id = s.user_id
     WHERE s.day::date >= $1::date AND s.day::date <= $2::date AND u.email NOT LIKE $3
     GROUP BY s.user_id, s.day ORDER BY s.user_id, s.day`,
    [since, today, DEMO]
  )).rows;

  const perUser = new Map();
  for (const d of days) {
    if (!perUser.has(d.user_id)) perUser.set(d.user_id, []);
    perUser.get(d.user_id).push(d.xu);
  }
  const daily = days.map((d) => d.xu).sort((a, b) => a - b);
  const averages = [...perUser.values()].map((v) => Math.round(v.reduce((a, b) => a + b, 0) / v.length)).sort((a, b) => a - b);

  console.log(`\nĐo thật ${since} → ${today}: ${perUser.size} người chơi có thu nhập, ${days.length} ngày-học.`);
  console.log(`   (đã loại ${loai.nguoi_demo} tài khoản demo${loai.dong_thu ? ": " + loai.dong_thu + " dòng thu / " + loai.xu_thu + " xu và " + loai.dong_chi + " dòng chi / " + loai.xu_chi + " xu" : ""} — xem CONFIG.demoMail)`);
  if (!days.length) { console.log("Chưa có dữ liệu: mô phỏng số học ở trên là số liệu tạm."); process.exit(0); }

  const fmt = (label, v) => console.log(`   ${label.padEnd(10)} ${String(v).padStart(5)} xu/ngày`);
  fmt("thấp nhất", daily[0]);
  fmt("trung vị", pct(daily, 0.5));
  fmt("p90", pct(daily, 0.9));
  fmt("cao nhất", daily[daily.length - 1]);
  console.log(`   tổng trần 136 xu/ngày: ${days.filter((d) => d.xu >= sum(CAPS_NEW)).length} ngày-học chạm trần mới.`);
  const median = pct(daily, 0.5);
  for (const n of [1, 2, 3]) {
    const c = Island.islandCost(n);
    console.log(`   người trung vị cần ${(c / Math.max(1, median)).toFixed(1)} ngày cho đảo ${n} (${c} xu).`);
  }

  /* Ai đang cày group nào: nhìn tỷ trọng từng nguồn trong 14 ngày (cũng loại tài khoản demo). */
  const mix = (await db.query(
    `SELECT l.source, sum(l.amount)::int AS xu, count(*)::int AS so_dong
       FROM xu_ledger l JOIN users u ON u.id = l.user_id
      WHERE l.day::date >= $1::date AND l.day::date <= $2::date AND u.email NOT LIKE $3
      GROUP BY l.source ORDER BY xu DESC`,
    [since, today, DEMO]
  )).rows;
  console.log("\nCác nguồn xu ngoài bài học (14 ngày, mọi tài khoản thật):");
  for (const m of mix) console.log(`   ${String(m.source).padEnd(9)} ${String(m.xu).padStart(6)} xu · ${String(m.so_dong).padStart(5)} dòng`);
  const lesson = (await db.query(
    `SELECT sum(t.amount)::int AS xu FROM town_ledger t JOIN users u ON u.id = t.user_id
      WHERE t.day::date >= $1::date AND t.day::date <= $2::date AND u.email NOT LIKE $3`,
    [since, today, DEMO]
  )).rows[0].xu;
  console.log(`   ${"lesson".padEnd(9)} ${String(lesson || 0).padStart(6)} xu (sổ cái bài học)`);

  await db.close();
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
