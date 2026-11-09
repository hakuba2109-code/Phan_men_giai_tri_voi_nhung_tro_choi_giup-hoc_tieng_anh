/* Tạo TÀI KHOẢN DEMO đã hoàn thành ba đảo đầu của Quần đảo vô tận.

   Mọi đồng xu đều đi qua ĐƯỜNG THẬT:
   · đăng ký bằng POST /api/auth/register (đúng đường trình duyệt vẫn dùng);
   · thu nhập ghi thành dòng `xu_ledger` thật (meta.demo = true) rồi cộng đúng số đó vào
     town_state.xu — giống hệt những gì xu.insert() làm — nên bất biến
     Σ thu − Σ chi = số dư vẫn khớp từng đồng, không có xu "chui" như ví Khách;
   · 15 × 3 cú nâng ô gọi thẳng POST /api/islands/upgrade: máy chủ tự trừ ví, tự ghi
     xu_spend, và CHỈ mở đảo kế khi đảo đó đủ 5 ô cấp 3. island_state không bị SQL đè.

   Tài khoản này có email đuôi @quandao.invalid (IC.CONFIG.demoMail) và bị hai script đo
   kinh tế loại ra, để số liệu công bố về "người chơi thật" không nhiễm dữ liệu demo.

   Chạy: npm --prefix json run seed:3-dao     (cần `npm --prefix json start` ở cửa sổ khác) */
const assert = require("assert");
const IC = require("../src/island-core");

const EMAIL = process.env.SEED_EMAIL || "demo-3-dao@quandao.invalid";
const PASSWORD = process.env.SEED_PASSWORD || "DaoVoTan123";
const NICKNAME = process.env.SEED_NICKNAME || "Đảo Trưởng";
const BASE = process.env.SEED_BASE || "http://127.0.0.1:" + (process.env.PORT || 3000);
const ISLANDS = Number(process.env.SEED_ISLANDS || 3);
const SPARE = Number(process.env.SEED_SPARE || 400);
const PER_DAY = 100; /* mỗi "ngày cày" demo đúng 100 xu — dưới trần 136 của bảng xu */

const dayKey = (offset) => {
  const d = new Date(Date.now() - offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: IC.CONFIG.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

async function main() {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
  const db = require("../src/db");
  await db.applySchema();

  /* 1) đăng ký (hoặc đăng nhập nếu đã có) — lấy cookie phiên */
  let res = await fetch(BASE + "/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, nickname: NICKNAME }),
  });
  if (res.status === 409) {
    console.log("Tài khoản đã có → đăng nhập.");
    res = await fetch(BASE + "/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  }
  if (!res.ok) throw new Error("Không đăng ký/đăng nhập được: " + res.status + " " + (await res.text()));
  const jar = (res.headers.getSetCookie() || []).map((c) => c.split(";")[0]).join("; ");
  const who = await res.json();
  const uid = who.user.id;
  console.log("· user " + uid + " · " + who.user.email + " · biệt danh " + who.user.nickname);
  /* Cookie phải được server công nhận. Không có bước này thì uidOf() trả 0 và mọi cú nâng ô
     dưới đây ghi thẳng vào ví + tiến độ của tài khoản KHÁCH. */
  const me = await fetch(BASE + "/api/auth/me", { headers: { cookie: jar } }).then((r) => r.json());
  assert.strictEqual(me.user && me.user.id, uid, "cookie không được chấp nhận — dừng trước khi sửa dữ liệu Khách");

  const post = async (path, body) => {
    const r = await fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: jar }, body: JSON.stringify(body || {}),
    });
    return { status: r.status, body: await r.json() };
  };
  const get = async (path) => {
    const r = await fetch(BASE + path, { headers: { cookie: jar } });
    return { status: r.status, body: await r.json() };
  };

  /* 2) bơm thu nhập THẬT: từng dòng một vào xu_ledger, rồi cộng đúng số đó vào ví */
  const totalCost = Array.from({ length: ISLANDS }, (_, i) => IC.islandCost(i + 1)).reduce((a, b) => a + b, 0);
  const target = totalCost + SPARE;
  const now = await get("/api/islands");
  const balance0 = now.body.xu;
  const gap = Math.max(0, target - balance0);
  const days = Math.ceil(gap / PER_DAY);
  const plan = [];
  for (let i = days; i >= 1; i--) {
    const d = dayKey(i);
    plan.push(
      { source: "file", ref: "file:demo-" + d, amount: 24, day: d },
      { source: "game", ref: "duck:demo-" + d, amount: 30, day: d },
      { source: "extra", ref: "attempt:demo-" + d, amount: 20, day: d },
      { source: "words", ref: "word:demo-" + d, amount: 15, day: d },
      { source: "wordnew", ref: "wordnew:demo-" + d, amount: 6, day: d },
      { source: "login", ref: "login:" + d, amount: 5, day: d }
    );
  }
  const granted = await db.withTransaction(async (c) => {
    await c.query(`INSERT INTO town_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [uid]);
    let sum = 0, rows = 0;
    for (const p of plan) {
      const r = await c.query(
        `INSERT INTO xu_ledger (user_id, source, source_ref, amount, day, meta)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, source, source_ref) DO NOTHING`,
        [uid, p.source, p.ref, p.amount, p.day, { demo: true, seed: "3-dao" }]
      );
      if (r.rowCount === 1) { sum += p.amount; rows++; }
    }
    if (sum > 0) await c.query(`UPDATE town_state SET xu = xu + $2, updated_at = now() WHERE user_id = $1`, [uid, sum]);
    return { sum, rows };
  });
  const balance1 = (await get("/api/islands")).body.xu;
  console.log("· bơm " + granted.rows + " dòng thu = " + granted.sum + " xu trên " + days + " ngày (" + PER_DAY + " xu/ngày), ví " + balance0 + " → " + balance1);
  console.log("· chi phí thật của " + ISLANDS + " đảo: " + totalCost + " xu · để dành " + (balance1 - totalCost) + " xu");

  /* 3) chơi thật qua API: nâng đủ 5 ô cấp 3 của từng đảo, máy chủ tự mở đảo kế */
  let view = now.body;
  let spent = 0, upgrades = 0;
  for (let island = 1; island <= ISLANDS; island++) {
    if (view.island.current !== island) {
      const tr = await post("/api/islands/travel", { index: island });
      if (tr.status !== 200) throw new Error("Không sang được đảo " + island + ": " + JSON.stringify(tr.body));
      view = tr.body;
    }
    assert.strictEqual(view.island.current, island, "phải đang đứng ở đảo " + island);
    let n = 0;
    while (view.island.levels.some((lv) => lv < IC.CONFIG.maxLevel)) {
      const slot = view.island.levels.findIndex((lv) => lv < IC.CONFIG.maxLevel);
      const r = await post("/api/islands/upgrade", { slot });
      if (r.status !== 200) throw new Error("Nâng ô " + slot + " đảo " + island + " lỗi " + r.status + ": " + JSON.stringify(r.body));
      spent += r.body.result.cost; upgrades++;
      view = r.body;
      if (r.body.result.completed) {
        console.log("· đảo " + island + " (" + r.body.island.theme + ") HOÀN THÀNH — " + spent + " xu đã tiêu, mở đảo " + (island + 1));
      }
      if (++n > 20) throw new Error("Quá 20 cú nâng trên một đảo — luật đã đổi?");
    }
  }
  console.log("· " + upgrades + " cú nâng ô, tổng tiêu " + spent + " xu (khớp chi phí lý thuyết: " + (spent === totalCost) + ")");

  /* 4) nghiệm thu: state thật + bất biến ví, đọc lại bằng SQL chứ không tin response */
  const fin = (await get("/api/islands")).body;
  const dbState = await db.withTransaction((c) => c.query(
    `SELECT current, unlocked, slots, completed_at FROM island_state WHERE user_id = $1`, [uid]
  ).then((r) => r.rows[0]));
  const inv = await db.withTransaction((c) => c.query(
    `SELECT (SELECT coalesce(sum(amount),0)::int FROM town_ledger WHERE user_id = $1)
            + (SELECT coalesce(sum(amount),0)::int FROM xu_ledger  WHERE user_id = $1)
            - (SELECT coalesce(sum(cost),0)::int  FROM xu_spend    WHERE user_id = $1) AS thu_tru_chi,
            (SELECT xu::int FROM town_state WHERE user_id = $1) AS so_du,
            (SELECT count(*)::int FROM xu_spend WHERE user_id = $1) AS so_dong_chi,
            (SELECT coalesce(sum(cost),0)::int FROM xu_spend WHERE user_id = $1) AS tong_chi,
            (SELECT coalesce(sum(cost),0)::int FROM xu_spend WHERE user_id = $1 AND kind = 'island_upgrade') AS chi_dao`,
    [uid]
  ).then((r) => r.rows[0]));
  const doneIslands = Array.from({ length: ISLANDS }, (_, i) => String(i + 1));
  for (const n of doneIslands) assert.ok(dbState.completed_at[n], "đảo " + n + " phải có ngày hoàn thành trong completed_at");
  assert.strictEqual(inv.thu_tru_chi, inv.so_du, "bất biến ví phải khớp: thu − chi = số dư");
  /* So với chi phí LÝ THUYẾT chứ không lấy số tuyệt đối: chạy lại script trên tài khoản đã có
     thì ví đã tiêu từ lần trước, còn lần này spent = 0. */
  assert.strictEqual(spent === 0 || spent === totalCost, true, "số xu đã tiêu vòng này phải bằng đúng giá " + ISLANDS + " đảo");
  assert.ok(inv.chi_dao >= spent, "dòng island_upgrade trong sổ phải ghi đủ phần vừa tiêu");

  console.log("\nKẾT QUẢ");
  console.log("  đăng nhập: " + EMAIL + " / " + PASSWORD + "   (biệt danh " + who.user.nickname + ")");
  console.log("  đảo hoàn thành: " + doneIslands.join(", ") + " · đang đứng ở đảo " + dbState.current + " · đã mở " + dbState.unlocked);
  console.log("  cấp 5 ô đảo hiện tại: " + JSON.stringify(dbState.slots[dbState.current]));
  console.log("  ngày hoàn thành: " + doneIslands.map((n) => n + "→" + dbState.completed_at[n]).join(" · "));
  console.log("  ví: " + inv.so_du + " xu · tổng thu " + (inv.thu_tru_chi + inv.tong_chi) + " − tổng chi " + inv.tong_chi + " · riêng đảo " + inv.chi_dao + " xu / " + inv.so_dong_chi + " dòng chi");
  console.log("  gói chủ đề đã mở khoá nhờ hoàn thành đảo: " + fin.island.map.filter((m) => m.done).map((m) => m.theme).join(", "));
  console.log("\nMở http://localhost:" + (process.env.PORT || 3000) + "/ → Đăng nhập → trang Quần đảo vô tận.");
  process.exit(0);
}

main().catch((e) => { console.error("Lỗi: " + e.message); process.exit(1); });
