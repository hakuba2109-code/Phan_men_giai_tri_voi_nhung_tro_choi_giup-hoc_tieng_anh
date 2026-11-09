"use strict";
/* Mô phỏng SỐ HỌC cho tính năng 🎨 Trang trí đảo (không CSDL, không mạng, 0 token).
   Chạy:  node scripts/sim-trang-tri.js        ·  chỉ phần (1):  node scripts/sim-trang-tri.js --catalog
   Từ 04/11 script dùng LUẬT THẬT trong src/island-core.js (canPlace + flood fill + bán kính ô đất
   1,85/1,15/feo theo chủ đề, bán kính thú 0,35) — bản đính kèm đặc tả từng phải giả định
   SLOT_R 1,4 vì tác giả chỉ thấy tham số `mg`. Hai số còn lại vẫn là lựa chọn có chủ đích:
   gap 1,0 giữa hai món chặn và slotGap 0,9 — chốt lại bằng số đo khung hình ở D4.

   (1) Catalog: tổng giá, giá theo nhóm, "đảo mẫu 40 món" tốn bao nhiêu ngày xu.
   (2) Luật đặt đồ: đặt tối đa đồ CHẶN ĐƯỜNG rồi kiểm mặt đảo còn liền một khối hay bị chia cắt.
       A = chỉ luật khoảng cách · B = thêm luật liền khối (flood fill)
   (3) TỪ D6 (04/11): "đảo đầy 40 món" không còn là công thức viết tay — nhét đầy đảo bằng
       canPlace THẬT ba chiến lược (rẻ nhất / đắt nhất / ngẫu nhiên) rồi đo SỐ XU thật phải trả.
   (4) TỪ D6: chạy thêm --db  →  node scripts/sim-trang-tri.js --db
       đo người chơi THẬT (percentile xu/ngày, số xu TIÊU theo từng kind trong xu_spend — cột cost,
       không nhầm với cột xu là số dư sau khi tiêu) và tính lại
       số ngày bằng chính nhịp đo được, không dùng ba người học mẫu 24/67/136 nữa. */
const assert = require("assert");
const IC = require("../src/island-core");

const ARGV = process.argv.slice(2);
const onlyCatalog = ARGV.includes("--catalog");
const N_A = Number((ARGV.find((a) => /^a=/.test(a)) || "a=2000").slice(2));
const N_B = Number((ARGV.find((a) => /^b=/.test(a)) || "b=200").slice(2));
const C = IC.DECOR;

/* ---------- (1) CATALOG ---------- */
const sum = (a) => a.reduce((s, i) => s + i.price, 0);
const byGroup = {};
for (const i of IC.DECOR_ITEMS) byGroup[i.group] = (byGroup[i.group] || 0) + i.price;
console.log("Catalog chung: " + IC.DECOR_ITEMS.length + " món · mỗi món 1 cái = " + sum(IC.DECOR_ITEMS) + " xu");
for (const [g, v] of Object.entries(byGroup)) console.log("   " + g.padEnd(30) + v + " xu");
console.log("Gói chủ đề (" + IC.DECOR_THEMED.length + " món, " + new Set(IC.DECOR_THEMED.map((i) => i.theme)).size + " gói × 4) = " + sum(IC.DECOR_THEMED) + " xu · chỉ bán cho người đã HOÀN CHỈNH một đảo cùng chủ đề");
console.log("Phong cách đảo (" + IC.DECOR_STYLES.length + " tùy chọn) = " + sum(IC.DECOR_STYLES) + " xu · mở 1 lần cho cả tài khoản, đổi miễn phí từng đảo");
console.log("Tổng catalog 1 cái mỗi món = " + (sum(IC.DECOR_ITEMS) + sum(IC.DECOR_THEMED) + sum(IC.DECOR_STYLES)) + " xu");
const catalogTotal = sum(IC.DECOR_ITEMS) + sum(IC.DECOR_THEMED) + sum(IC.DECOR_STYLES);

/* "Đảo mẫu 40 món" theo đặc tả: 12 món rẻ + 10 + 10 + 4 + 4, KHÔNG có công trình lớn */
const P = Object.fromEntries(IC.DECOR_ALL.map((i) => [i.k, i.price]));
const RECIPE = [["flower_patch", 6], ["stone_path", 6], ["bush", 4], ["pine", 3], ["lantern", 3], ["bench", 2], ["lamp_post", 4], ["oak", 2], ["pet_bed", 2], ["fountain_small", 1], ["tent", 1], ["table_set", 1], ["mini_bridge", 1], ["star_lamp", 1], ["cat_tree", 1], ["dog_house", 1], ["fireflies", 1]];
const items40 = RECIPE.reduce((s, [, q]) => s + q, 0);
const cost40 = RECIPE.reduce((s, [k, q]) => s + P[k] * q, 0);
if (items40 !== 40) throw new Error(" Đảo mẫu phải đúng 40 món, đang là " + items40);
const PER_DAY = [24, 67, 136]; // học nhẹ · học đều · học kỹ (README-xu-moi-hoat-dong-hoc-tap.md)
const upgrades8 = Array.from({ length: 8 }, (_, i) => IC.islandCost(i + 1)).reduce((a, b) => a + b, 0);
console.log("\nĐảo mẫu 40 món = " + cost40 + " xu → " + PER_DAY.map((d) => (cost40 / d).toFixed(1) + " ngày (" + d + " xu/ngày)").join(" · "));
console.log("8 đảo nâng cấp " + upgrades8 + " + 8 đảo mẫu " + 8 * cost40 + " = " + (upgrades8 + 8 * cost40) + " xu → " + ((upgrades8 + 8 * cost40) / 67).toFixed(0) + " ngày ở 67 xu/ngày (so với " + (upgrades8 / 67).toFixed(0) + " ngày nếu chỉ nâng cấp)");
console.log("(giá 8 đảo đầu tính bằng IslandCore.islandCost — số THẬT, không phải ước tính)");
if (onlyCatalog) return;

/* ---------- (2) LUẬT ĐẶT ĐỒ ---------- */
/* Bộ tạo số ngẫu nhiên TÁCH RIÊNG để hai lần chạy ra cùng một loạt đảo (số đo tái lập được, không chạm CSDL). */
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* Bỏ qua món theo gói (cần hoàn chỉnh đảo mới mở) nhưng GIỮ công trình lớn XL — canPlace tự
   giới hạn 1 XL/đảo, và XL chính là món dễ bịt lối nhất nên mô phỏng phải có nó. */
const BLOCKERS = IC.DECOR_ALL.filter((i) => IC.isBlocker(i) && !i.theme);

/* Tham lam: thử MAX_ATTEMPTS chỗ ngẫu nhiên, chỉ nhận chỗ canPlace chấp nhận (luật 1-8, và 9 nếu useFill). */
function greedy(n, useFill) {
  const L = IC.genIsland(n), rnd = rngOf(IC.hash("sim-" + n + (useFill ? "-B" : "-A")));
  const layout = [];
  let base = null;
  for (let t = 0; t < 300 && layout.length < C.maxBlock; t++) {
    const it = BLOCKERS[Math.floor(rnd() * BLOCKERS.length)];
    const a = rnd() * 6.283, d = rnd() * (L.r - 1);
    const x = IC.snap(Math.cos(a) * d), z = IC.snap(Math.sin(a) * d);
    if (base === null) base = IC.walkFraction(L, []);
    const rot = Math.floor(rnd() * 8);
    const r = IC.canPlace(L, layout, it, x, z, rot, { slots: {}, baseFraction: base, fill: useFill });
    if (r.ok) layout.push({ item: it.k, x, z, rot });
  }
  return { L, layout, base, f: IC.walkFraction(L, layout) };
}
function run(useFill, N, label) {
  let minF = 1, sumF = 0, sumPlaced = 0, baseLow = 0, worse = 0, below98 = 0, checked = 0;
  for (let k = 1; k <= N; k++) {
    const g = greedy(k, useFill);
    checked++;
    sumPlaced += g.layout.length;
    if (g.base < C.fillMin) baseLow++;
    const limit = Math.min(C.fillMin, g.base);
    if (g.f < limit - 1e-9) worse++;
    if (g.f < C.fillMin) below98++;
    minF = Math.min(minF, g.f);
    sumF += g.f;
  }
  console.log("   " + label + " — " + checked + " đảo: trung bình " + (sumPlaced / checked).toFixed(1) + " món chặn đặt được/đảo · " +
    "phần đi được thuộc MỘT khối: nhỏ nhất " + (minF * 100).toFixed(2) + "% · trung bình " + ((sumF / checked) * 100).toFixed(2) + "% · " +
    "đảo dưới 98% = " + below98 + " (đảo TRỐNG đã dưới 98% do ô đất: " + baseLow + ") · " +
    "đảo bị đồ làm TỆ HƠN min(98%, đảo trống) = " + worse);
  return worse;
}
console.log("\nLuật đặt đồ (lưới " + C.grid + ", gap hai món chặn " + C.gap + ", cách ô đất thêm " + C.slotGap + ", vùng cấm cửa Nhà " + C.noGo +
  ", tối đa " + C.maxBlock + " món chặn; bán kính thú " + IC.GEO.petR + ", ob Nhà " + IC.GEO.house + ", Cây " + IC.GEO.tree + " — số THẬT từ island-core):");
const worseA = run(false, N_A, "A) chỉ luật khoảng cách");
const worseB = run(true, N_B, "B) khoảng cách + liền khối (flood fill >= 98%)");
console.log("\nKết luận: A để lọt " + worseA + "/" + N_A + " đảo bị chia cắt; B (luật 9) còn " + worseB + "/" + N_B + "." +
  (worseB === 0 ? " Luật 9 đủ, và chỉ bớt trung bình " + "vài phần mười món/đảo." : " Luật 9 CHƯA đủ — phải nâng trước khi mở bán."));

/* ---------- (3) ĐẢO ĐẦY 40 MÓN — SỐ XU THẬT PHẢI TRẢ (D6) ---------- */
/* canPlace KHÔNG giới hạn số bản sao của một món (mua theo cái, qty 1..99), nên "đảo đầy 40 món"
   có thể là 40 bụi cỏ 3 xu, cũng có thể là một công trình lớn + 11 món chặn đắt nhất. Hai đầu rẻ/đắt
   đo ra KHOẢNG hợp lệ của một đảo đầy; công thức viết tay 863 xu ở mục (1) phải nằm trong khoảng đó,
   nếu không thì nó sai và tài liệu phải sửa theo số đo — đúng nghĩa "cân bằng giá bằng dữ liệu thật". */
const FULL8 = {};
for (let n = 1; n <= 8; n++) FULL8[n] = Array(IC.CONFIG.slots).fill(IC.CONFIG.maxLevel); // 8 đảo hoàn chỉnh = cả 8 gói + cả 4 công trình lớn đã mở

/* one pass, pool đã xếp theo chiến lược; mỗi món cố đặt hết chỗ của nó rồi mới sang món kế. */
function fillIsland(n, pool, seed) {
  const L = IC.genIsland(n), rnd = rngOf(IC.hash("fill-" + seed + "-" + n));
  const base = IC.walkFraction(L, []);
  const layout = [];
  let tries = 0;
  for (const it of pool) {
    let guard = 0;
    while (layout.length < C.maxTotal && tries < 8000 && guard++ < 400) {
      const a = rnd() * 6.283, d = rnd() * (L.r - 1);
      const x = IC.snap(Math.cos(a) * d), z = IC.snap(Math.sin(a) * d);
      const rot = Math.floor(rnd() * C.rotSteps);
      tries++;
      const r = IC.canPlace(L, layout, it, x, z, rot, { slots: FULL8, baseFraction: base });
      if (r.ok) layout.push({ item: it.k, x, z, rot });
      else if (/tối đa|chỉ đặt một/.test(r.reason)) break; // hết suất của LOẠI này (40 món / 12 chặn / 2 hiệu ứng / 1 công trình lớn)
    }
  }
  return { placed: layout.length, cost: layout.reduce((s, p) => s + IC.decorOf(p.item).price, 0), tries };
}
const byPrice = (asc) => IC.DECOR_ALL.slice().sort((a, b) => (asc ? 1 : -1) * (a.price - b.price));
const shuffled = (n) => {
  const rnd = rngOf(IC.hash("fill-rand-" + n)), p = IC.DECOR_ALL.slice();
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
};
const pctl = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] : 0);

const cheapIsland = fillIsland(1, byPrice(true), "cheap");
const richIsland = fillIsland(8, byPrice(false), "rich");
const N_FILL = Number((ARGV.find((a) => /^fill=/ .test(a)) || "fill=24").slice(5));
const randCosts = [], randPlaced = [];
for (let n = 1; n <= N_FILL; n++) { const g = fillIsland(n, shuffled(n), "rand"); randCosts.push(g.cost); randPlaced.push(g.placed); }
randCosts.sort((a, b) => a - b);
const sumRand = randCosts.reduce((a, b) => a + b, 0);
console.log("\nĐảo ĐẦY " + C.maxTotal + " món, nhét bằng canPlace thật (mua theo cái, không giới hạn bản sao):");
console.log("   rẻ nhất  : " + cheapIsland.placed + " món = " + cheapIsland.cost + " xu (đảo 1, " + cheapIsland.tries + " lần thử — món rẻ 3 xu lấp hết chỗ)");
console.log("   đắt nhất : " + richIsland.placed + " món = " + richIsland.cost + " xu (đảo 8, " + richIsland.tries + " lần thử)");
console.log("   " + N_FILL + " đảo ngẫu nhiên: nhỏ nhất " + randCosts[0] + " · trung vị " + pctl(randCosts, 0.5) + " · lớn nhất " + randCosts[randCosts.length - 1] + " · trung bình " + (sumRand / N_FILL).toFixed(0) + " xu (đủ 40 món: " + randPlaced.filter((v) => v === C.maxTotal).length + "/" + N_FILL + ")");
console.log("   đối chiếu công thức viết tay mục (1): đảo mẫu " + items40 + " món = " + cost40 + " xu → " +
  (cost40 >= cheapIsland.cost && cost40 <= richIsland.cost ? "NẰM TRONG khoảng đo thật [" + cheapIsland.cost + " … " + richIsland.cost + "]" : "NGOÀI khoảng đo thật — PHẢI XÉT LẠI"));
assert(cost40 >= cheapIsland.cost && cost40 <= richIsland.cost, "đảo mẫu viết tay " + cost40 + " xu rơi khỏi khoảng đo thật [" + cheapIsland.cost + " … " + richIsland.cost + "]");
assert(cheapIsland.placed === C.maxTotal && richIsland.placed === C.maxTotal, "bộ nhét đầy phải đạt " + C.maxTotal + " món (đang là " + cheapIsland.placed + "/" + richIsland.placed + ")");


/* ---------- (4) ĐO THẬT TỪ CSDL (D6) — `node scripts/sim-trang-tri.js --db` ---------- */
/* Số liệu mục 5 của đặc tả trước đây lấy từ ba người học MÔ HÌNH (24/67/136 xu/ngày, trần của
   README-xu-moi-hoat-dong-hoc-tap.md). Chế độ --db thay bằng nhịp ĐO ĐƯỢC: percentile xu kiếm được
   mỗi ngày-học trên toàn bộ lịch sử, cộng đúng những gì người chơi thật đã tiêu (bảng xu_spend).
   0 token, chỉ ĐỌC — không ghi, không xoá, không đổi giá. */
if (!ARGV.includes("--db")) {
  console.log("\n(chạy thêm `--db` — hoặc `npm --prefix json run decor:sim:real` — để thay ngày xu MÔ HÌNH bằng ngày xu ĐO THẬT)");
  process.exit(0);
}
(async () => {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
  const db = require("../src/db");
  await db.applySchema();

  /* một dòng = một (người chơi, ngày) và xu KIẾM ĐƯỢC từ học tập hôm đó; cùng công thức với
     sim-xu-moi.js --db: bài học (town_ledger) + năm nhóm có trần, không tính convert/streak/garden.

     TÀI KHOẢN DEMO (seed:3-dao, đuôi email CONFIG.demoMail) bị loại ở CẢ BA lệnh dưới đây: một ví
     1.905 xu và 45 cú nâng ô bịa ra sẽ biến "trung vị 11 xu/ngày" hay "401 xu đã tiêu" trong
     README thành số không còn đo được nữa. Bên chi tiêu dùng NOT EXISTS chứ không JOIN — tài khoản
     Khách (id 0) không có dòng trong `users` mà vẫn là người chơi thật trên máy này. */
  const DEMO = "%" + IC.CONFIG.demoMail;
  const rows = (await db.query(
    `SELECT s.user_id, s.day, sum(s.amount)::int AS xu FROM (
       SELECT user_id, day, amount FROM town_ledger
       UNION ALL
       SELECT user_id, day, amount FROM xu_ledger
         WHERE source IN ('extra','game','words','wordnew','login')
     ) s JOIN users u ON u.id = s.user_id
     WHERE u.email NOT LIKE $1
     GROUP BY s.user_id, s.day ORDER BY s.user_id, s.day`,
    [DEMO]
  )).rows;
  const loai = (await db.query(
    `SELECT (SELECT count(*)::int FROM xu_ledger l JOIN users u ON u.id = l.user_id WHERE u.email LIKE $1) AS dong_thu,
            (SELECT coalesce(sum(l.amount),0)::int FROM xu_ledger l JOIN users u ON u.id = l.user_id WHERE u.email LIKE $1) AS xu_thu,
            (SELECT count(*)::int FROM xu_spend s JOIN users u ON u.id = s.user_id WHERE u.email LIKE $1) AS dong_chi,
            (SELECT coalesce(sum(s.cost),0)::int FROM xu_spend s JOIN users u ON u.id = s.user_id WHERE u.email LIKE $1) AS xu_chi,
            (SELECT count(*)::int FROM users u WHERE u.email LIKE $1) AS nguoi_demo`,
    [DEMO]
  )).rows[0];
  const dayNum = (r) => new Date(r.day).getTime();
  /* pg trả `date` về nửa đêm GIỜ MÁY, nên phải in bằng linh kiện ngày-tháng-năm của máy,
     không dùng toISOString(): toISOString trượt về UTC và làm ngày đo thật lùi mất một ngày. */
  const key = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const span = rows.length ? key(Math.min(...rows.map(dayNum))) + " → " + key(Math.max(...rows.map(dayNum))) : "—";
  const users = new Set(rows.map((r) => r.user_id));
  const daily = rows.map((r) => r.xu).sort((a, b) => a - b);
  const med = pctl(daily, 0.5), p25 = pctl(daily, 0.25), p75 = pctl(daily, 0.75), p90 = pctl(daily, 0.9);
  console.log("\nĐo thật " + span + ": " + users.size + " người chơi có thu nhập · " + rows.length + " ngày-học.");
  console.log("   xu/ngày-học: thấp nhất " + daily[0] + " · p25 " + p25 + " · trung vị " + med + " · p75 " + p75 + " · p90 " + p90 + " · cao nhất " + daily[daily.length - 1] + " (trần lý thuyết " + PER_DAY[2] + ")");

  /* Chi tiêu THẬT đã ghi sổ: mỗi kind một dòng, kèm bao nhiêu ngày có chi.
     Bảng có HAI cột tiền: `cost` = số xu ĐÃ TIÊU, `xu` = số dư NGAY SAU khi tiêu.
     Nhầm sang `xu` thì "tổng chi" thành "tổng số dư" và to gấp mấy lần mà không lỗi nào kêu. */
  const spend = (await db.query(
    `SELECT kind, count(*)::int AS so_dong, sum(cost)::int AS tong_cost, min(cost)::int AS nho, max(cost)::int AS lon,
            count(DISTINCT (created_at AT TIME ZONE $1)::date)::int AS so_ngay
       FROM xu_spend sp
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = sp.user_id AND u.email LIKE $2)
      GROUP BY kind ORDER BY tong_cost DESC`,
    [IC.CONFIG.tz, DEMO]
  )).rows;
  console.log("   xu_spend đã ghi: " + spend.reduce((s, k) => s + k.so_dong, 0) + " dòng / " + spend.reduce((s, k) => s + k.tong_cost, 0) + " xu TIÊU (cột cost)");
  console.log("   (loại " + loai.dong_chi + " dòng / " + loai.xu_chi + " xu chi và " + loai.dong_thu + " dòng / " + loai.xu_thu + " xu thu của " + loai.nguoi_demo + " tài khoản demo — không tính vào mọi số liệu dưới đây)");
  for (const k of spend) console.log("     " + String(k.kind).padEnd(12) + String(k.tong_cost).padStart(5) + " xu · " + String(k.so_dong).padStart(4) + " dòng · " + k.nho + "…" + k.lon + " mỗi lần · " + k.so_ngay + " ngày có chi");
  const has = (kind) => spend.filter((k) => k.kind === kind).reduce((s, k) => s + k.so_dong, 0);
  console.log("     trang trí thật đã mua: decor_buy " + has("decor_buy") + " dòng · style_buy " + has("style_buy") + " dòng; thú ăn: pet_food " + has("pet_food") + " dòng · pet_buy " + has("pet_buy") + " dòng (số liệu mục 5 không còn là dự đoán — nhưng mẫu chi vẫn mỏng).");

  /* Đối chiếu từng dòng trang trí với GIÁ NIÊM YẾT hiện hành của đúng món/khóa đó: `cost` phải là
     bội số nguyên (1…99 cái) của giá trong catalog. Khớp = giá đứng nguyên từ lần ghi sổ đầu. */
  const gia = {};
  for (const it of IC.DECOR_ALL) gia[it.k] = it.price;
  for (const s of IC.DECOR_STYLES) gia[s.k] = s.price;
  const chi = (await db.query(
    `SELECT sp.kind, sp.topic, sp.cost FROM xu_spend sp
      WHERE sp.kind IN ('decor_buy', 'style_buy')
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = sp.user_id AND u.email LIKE $1)
      ORDER BY sp.id`,
    [DEMO]
  )).rows;
  const khop = chi.filter((c) => gia[c.topic] && c.cost % gia[c.topic] === 0 && c.cost / gia[c.topic] >= 1 && c.cost / gia[c.topic] <= 99).length;
  assert(!chi.some((c) => !gia[c.topic]), "một dòng xu_spend trỏ tới món/khóa không còn trong catalog: " + chi.filter((c) => !gia[c.topic]).map((c) => c.topic).join(", "));
  console.log("     đối chiếu giá: " + khop + "/" + chi.length + " dòng trang trí khớp đúng giá niêm yết hôm nay của chính món đó" +
    (khop === chi.length ? " (không một giá nào đổi sau khi ghi sổ)" : " — số còn lại là tín hiệu giá ĐÃ đổi sau khi ghi sổ, phải đo lại mục 5 chứ không phải lỗi của lệnh này"));

  /* Nhịp ăn của thú: KHÔNG phải ước tính — đo từ chính luật đang chạy (mealsPerDay × giá từng loại). */
  const perPet = IC.CONFIG.foods.map((f) => IC.CONFIG.mealsPerDay * f.price);
  const eat3 = IC.CONFIG.seenFirst * perPet[0], eat6 = IC.CONFIG.seenMax * perPet[0];
  console.log("   cho ăn theo luật thật: " + perPet.map((v, i) => IC.CONFIG.foods[i].name + " " + v + " xu/ngày/thú").join(" · "));
  console.log("     " + IC.CONFIG.seenFirst + " thú cùng ra đảo (mặc định) = " + eat3 + " xu/ngày · " + IC.CONFIG.seenMax + " thú (trần hiệu năng) = " + eat6 + " xu/ngày — chọn ăn hạt rẻ nhất, và đây là khoản TỰ NGUYỆN (đói có sàn, không phạt gì).");

  const days = (xu, rate) => (rate > 0 ? (xu / rate).toFixed(1) : "∞");
  console.log("\nSố NGÀY bằng nhịp ĐO THẬT (trong ngoặc là ngày theo mô hình 67 xu/ngày, số cũ của đặc tả):");
  for (const [label, xu] of [["đảo đầy rẻ nhất", cheapIsland.cost], ["đảo mẫu viết tay", cost40], ["đảo đầy ngẫu nhiên (trung vị)", pctl(randCosts, 0.5)], ["đảo đầy đắt nhất", richIsland.cost], ["cả bộ catalog", catalogTotal], ["8 đảo: nâng cấp + 8 đảo mẫu", upgrades8 + 8 * cost40]])
    console.log("   " + String(label).padEnd(30) + String(xu).padStart(5) + " xu → " + days(xu, med) + " ngày ở trung vị " + med + " xu/ngày (" + days(xu, 67) + ") · " + days(xu, p90) + " ngày ở p90 " + p90);
  const net = med - eat3;
  console.log("   trừ tiền hạt của " + IC.CONFIG.seenFirst + " thú (" + eat3 + " xu/ngày) thì còn " + net + " xu/ngày" +
    (net > 0
      ? " → đảo trung vị cần " + days(pctl(randCosts, 0.5), net) + " ngày, bộ catalog cần " + days(catalogTotal, net) + " ngày."
      : " → ở nhịp trung vị THẬT, nuôi " + IC.CONFIG.seenFirst + " thú ăn hạt đã ngốn hết thu nhập của một ngày, phần trang trí không còn xu nào (thời gian mua một đảo = ∞). Đây đúng là lý do cho ăn là khoản TỰ NGUYỆN và đồ trang trí không được bán theo kiểu bắt buộc phải mua."));

  /* Kết luận mẫu: BAO GIỜ đủ dữ liệu để đổi giá? */
  const okUsers = users.size >= 20, okDays = rows.length >= 280;
  console.log("\nCân bằng giá: mẫu hiện có " + users.size + " người / " + rows.length + " ngày-học" + (okUsers && okDays ? " → ĐỦ để xét lại giá." : " → CHƯA đủ để đổi giá (ngưỡng ghi ở đặc tả: ≥ 20 người và ≥ 280 ngày-học = 20 người × 14 ngày)."));
  console.log(okUsers && okDays
    ? "   Người ở p90 mua nổi một đảo ngẫu nhiên trong " + days(pctl(randCosts, 0.5), p90) + " ngày, người trung vị trong " + days(pctl(randCosts, 0.5), med) + " ngày — hãy sửa giá ở " + (med > 0 && pctl(randCosts, 0.5) / med > 60 ? "hướng GIẢM" : "hướng giữ nguyên") + "."
    : "   Vì mẫu mỏng, ĐỢT NÀY giữ nguyên từng giá trong DECOR_ITEMS/DECOR_STYLES; số đo thật chỉ thay phần \"ngày\" của mục 5 và ghi rõ khoảng hợp lệ của một đảo đầy.");
  await db.close();
  process.exit(0);
})().catch((e) => { console.error("Lỗi --db: " + (e.message || e)); process.exit(1); });
