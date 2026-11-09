"use strict";
/* Kiểm thử tích hợp 🎨 TRANG TRÍ ĐẢO — máy chủ (D2 + D5): src/island.js + src/island-core.js + 5 bảng trang trí.
   Server Express thật + PostgreSQL thật, 0 token, không gọi AI.
   Chạy:  node scripts/test-decor-api.js   (đọc DATABASE_URL từ .env ở gốc, hoặc npm --prefix json run test:decor-api)
   Script TỰ TẠO schema tạm `decor_test` (questions/attempts TỐI GIẢN + town.sql + sakura.sql + island.sql),
   chạy xong XÓA schema => không đụng dữ liệu thật.
   Đánh số ca TIẾP NỐI bộ lõi `test-decor-core.js` (ca 1–8) đúng theo bảng §12 của README-trang-tri-dao.md.
   Hai bất biến kiểm ở mọi ca: (1) MUA mới trừ xu, PUT layout không bao giờ chạm ví;
   (2) một cú bị từ chối không để lại dòng nào — không mất tiền, không mất đồ, không đổi bố cục. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const IC = require("../src/island-core");
const TownCore = require("../src/town-core");
const { createIslandRouter, transferGuestData } = require("../src/island");

const URL_DB = process.env.DATABASE_URL;
if (!URL_DB) { console.error("Thiếu DATABASE_URL."); process.exit(2); }
const SCHEMA = "decor_test";
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
let uid = 3000;
const newUser = () => ++uid;
const fund = (u, amount) => pool.query(`UPDATE town_state SET xu = $2 WHERE user_id = $1`, [u, amount]);
const bal = (u) => pool.query(`SELECT xu FROM town_state WHERE user_id = $1`, [u]).then((r) => Number(r.rows[0].xu));
const view = async (u) => (await api(u, "GET", "/decor")).body;
const ownedRows = (u) => pool.query(`SELECT item_key, qty FROM decor_owned WHERE user_id = $1 ORDER BY item_key`, [u]).then((r) => r.rows);
const placedRows = (u, island) => pool.query(
  `SELECT island_index, item_key, x, z, rot FROM decor_placed WHERE user_id = $1${island ? " AND island_index = " + island : ""} ORDER BY island_index, id`, [u]
).then((r) => r.rows.map((p) => ({ island_index: p.island_index, item_key: p.item_key, x: Number(p.x), z: Number(p.z), rot: p.rot })));
const styleRows = (u) => pool.query(
  `SELECT island_index, weather, tod, grass, sky, layout_ver AS "layoutVer" FROM island_style WHERE user_id = $1 ORDER BY island_index`, [u]
).then((r) => r.rows);
const styleOwned = (u) => pool.query(`SELECT style_key FROM style_owned WHERE user_id = $1 ORDER BY style_key`, [u]).then((r) => r.rows.map((x) => x.style_key));
const wishDb = (u) => pool.query(`SELECT item_key FROM decor_wish WHERE user_id = $1 ORDER BY pos, item_key`, [u]).then((r) => r.rows.map((x) => x.item_key));
const spends = (u, kind) => pool.query(
  `SELECT kind, topic, slot, cost, xu FROM xu_spend WHERE user_id = $1${kind ? " AND kind = '" + kind + "'" : ""} ORDER BY id`, [u]
).then((r) => r.rows);
const walletUser = async (amount) => { const u = newUser(); await api(u, "GET", "/"); await fund(u, amount); return u; };
const finishIsland = async (u) => {
  for (let slot = 0; slot < C.slots; slot++) for (let lv = 0; lv < C.maxLevel; lv++) await api(u, "POST", "/upgrade", { slot });
};

/* ---- tìm chỗ đặt hợp lệ BẰNG LUẬT THẬT của lõi (không đoán tọa độ trong bài kiểm) ----
   cellsIn  : thử từng ứng viên với bố cục GỐC, không cộng dồn -> lấy được nhiều chỗ, kể cả vượt trần 40 món
              (dùng cho món phẳng W, vốn không chặn nhau).
   cellsSeq : cộng dồn -> mỗi chỗ mới hợp lệ với những chỗ đã chọn (cần cho món chặn S/M/L/XL). */
const FRESH = { 1: [0, 0, 0, 0, 0] };
function scan(n, item, want, base, accumulate, slots) {
  const L = IC.genIsland(n), own = slots || FRESH, out = [];
  let acc = (base || []).slice();
  for (let i = -40; i <= 40 && out.length < want; i++) {
    for (let j = -40; j <= 40 && out.length < want; j++) {
      const x = i * IC.DECOR.grid, z = j * IC.DECOR.grid;
      if (!IC.canPlace(L, accumulate ? acc : base || [], item, x, z, 0, { slots: own }).ok) continue;
      const p = { item, x, z, rot: 0 };
      out.push(p);
      if (accumulate) acc.push(p);
    }
  }
  return out;
}
const cellsIn = (n, item, want, slots) => scan(n, item, want, [], false, slots);
const cellsSeq = (n, item, want, base) => scan(n, item, want, base, true);
const save = (u, island, items, ver) => api(u, "PUT", "/decor/layout", { island, baseVersion: ver, items });

/* ================= mua đồ ================= */
t("9  Mua đủ xu: ví trừ đúng giá × số lượng, decor_owned +qty, một dòng xu_spend decor_buy kèm số dư sau", async () => {
  const u = await walletUser(100);
  const r = await api(u, "POST", "/decor/buy", { item: "rock_small", qty: 3 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.xu, 100 - 3 * 3);
  assert.deepStrictEqual(await ownedRows(u), [{ item_key: "rock_small", qty: 3 }]);
  assert.deepStrictEqual(await spends(u, "decor_buy"), [{ kind: "decor_buy", topic: "rock_small", slot: null, cost: 9, xu: 91 }]);
  assert.strictEqual(r.body.decor.owned.rock_small, 3, "một lượt trả về đủ khối decor, giao diện khỏi phải gọi thêm");
  assert.strictEqual(r.body.decor.left.rock_small, 3, "chưa đặt ở đâu thì còn đặt được đủ số đã mua");
  assert.strictEqual(r.body.catalog.decor.length, IC.DECOR_ALL.length, "server giao đúng catalog của island-core, không tự sáng tác giá");
  /* mua thêm thì cộng dồn, không tạo dòng thứ hai */
  await api(u, "POST", "/decor/buy", { item: "rock_small", qty: 2 });
  assert.deepStrictEqual(await ownedRows(u), [{ item_key: "rock_small", qty: 5 }]);
  assert.strictEqual((await spends(u, "decor_buy")).length, 2);
});
t("10 Mua thiếu xu / món lạ / số lượng sai: 409 hoặc 400 — không có dòng chi nào, ví đứng nguyên", async () => {
  const u = await walletUser(LOGIN); // chỉ 5 xu quà ngày
  const r = await api(u, "POST", "/decor/buy", { item: "oak", qty: 1 }); // 20 xu
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /còn thiếu 15/);
  for (const bad of [{ item: "ky-la", qty: 1 }, { item: "oak", qty: 0 }, { item: "oak", qty: 100 }, { item: "oak" }]) {
    assert.strictEqual((await api(u, "POST", "/decor/buy", bad)).status, 400, JSON.stringify(bad));
  }
  assert.deepStrictEqual(await ownedRows(u), []);
  assert.deepStrictEqual(await spends(u), []);
  assert.strictEqual(await bal(u), LOGIN);
});
t("11 Hai cú mua cùng lúc khi chỉ đủ tiền một: 200 + 409, ví không bao giờ âm", async () => {
  const u = await walletUser(30);
  const rs = await Promise.all([api(u, "POST", "/decor/buy", { item: "oak", qty: 1 }), api(u, "POST", "/decor/buy", { item: "oak", qty: 1 })]);
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [200, 409]);
  assert.strictEqual(await bal(u), 10);
  assert.strictEqual((await spends(u, "decor_buy")).length, 1);
  assert.deepStrictEqual(await ownedRows(u), [{ item_key: "oak", qty: 1 }]);
});
t("14 Món gói chủ đề / công trình lớn chưa mở: 409 nói rõ cần gì, kể cả khi đủ xu", async () => {
  const u = await walletUser(3000);
  const g = await api(u, "POST", "/decor/buy", { item: "mini_torii", qty: 1 });
  assert.strictEqual(g.status, 409);
  assert.match(g.body.error, /Chưa mở.*gói 🌸 Anh Đào/s);
  const xl = await api(u, "POST", "/decor/buy", { item: "big_windmill", qty: 1 });
  assert.strictEqual(xl.status, 409);
  assert.match(xl.body.error, /cần 2 đảo hoàn chỉnh/);
  assert.strictEqual(await bal(u), 3000, "bị từ chối thì không trừ gì");
  await finishIsland(u); // đảo 1 chủ đề Anh Đào -> mở gói Anh Đào + Tượng thú cưng (1 đảo)
  assert.strictEqual((await api(u, "POST", "/decor/buy", { item: "mini_torii", qty: 1 })).status, 200);
  assert.strictEqual((await api(u, "POST", "/decor/buy", { item: "pet_statue", qty: 1 })).status, 200);
  assert.strictEqual((await api(u, "POST", "/decor/buy", { item: "big_windmill", qty: 1 })).status, 409, "cối xay cần 2 đảo, mới có 1");
  const v = await view(u);
  assert.strictEqual(v.decor.left.mini_torii, 1, "đồ đã mở gói thì hiện trong phần còn đặt được");
});

/* ================= bố cục ================= */
t("12 PUT layout hợp lệ: lưu đúng tọa độ đã bám lưới, layout_ver tăng 1, ví KHÔNG đổi và không có dòng chi", async () => {
  const u = await walletUser(100);
  await api(u, "POST", "/decor/buy", { item: "grass_tuft", qty: 4 });
  const cells = cellsSeq(1, "grass_tuft", 2);
  assert.strictEqual(cells.length, 2, "phải tìm được hai chỗ hợp lệ bằng luật thật");
  const before = await bal(u);
  const r = await save(u, 1, cells, 0);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(await bal(u), before, "PUT layout không bao giờ trừ xu");
  assert.deepStrictEqual(await spends(u, "decor_buy"), [{ kind: "decor_buy", topic: "grass_tuft", slot: null, cost: 12, xu: before }]);
  assert.deepStrictEqual(await placedRows(u, 1), cells.map((c) => ({ island_index: 1, item_key: "grass_tuft", x: c.x, z: c.z, rot: 0 })));
  assert.deepStrictEqual(await styleRows(u), [{ island_index: 1, weather: null, tod: null, grass: null, sky: null, layoutVer: 1 }]);
  assert.strictEqual(r.body.decor.placed["1"].length, 2);
  assert.deepStrictEqual(r.body.decor.styles["1"], { weather: null, tod: null, grass: null, sky: null, layoutVer: 1 });
  assert.strictEqual(r.body.decor.left.grass_tuft, 2, "đã đặt 2/4 cái nên còn 2");
  assert.strictEqual(r.body.decor.total.grass_tuft, 2);
});
t("15 baseVersion cũ: 409 kèm hướng dẫn tải lại, bố cục và phiên bản đứng nguyên", async () => {
  const u = await walletUser(100);
  await api(u, "POST", "/decor/buy", { item: "grass_tuft", qty: 4 });
  const a = cellsSeq(1, "grass_tuft", 1), b = cellsSeq(1, "grass_tuft", 3).slice(1, 3);
  assert.strictEqual((await save(u, 1, a, 0)).status, 200);
  const old = await save(u, 1, b, 0);
  assert.strictEqual(old.status, 409);
  assert.match(old.body.error, /đã thay đổi ở nơi khác/);
  assert.deepStrictEqual(await placedRows(u, 1), [{ island_index: 1, item_key: "grass_tuft", x: a[0].x, z: a[0].z, rot: 0 }]);
  assert.strictEqual((await styleRows(u))[0].layoutVer, 1, "cú bị từ chối không được tăng phiên bản");
  for (const bad of [undefined, "x", -1, 1.5]) {
    const r = await api(u, "PUT", "/decor/layout", { island: 1, baseVersion: bad, items: [] });
    assert.strictEqual(r.status, 400, JSON.stringify(bad));
  }
  assert.strictEqual((await api(u, "PUT", "/decor/layout", { island: 1, baseVersion: 1 })).status, 400, "items phải là mảng");
  assert.strictEqual((await api(u, "PUT", "/decor/layout", { island: "x", baseVersion: 1, items: [] })).status, 400);
});
t("16 Hai PUT cùng lúc trên một đảo: một thành công, một 409 — không đè nhau", async () => {
  const u = await walletUser(100);
  await api(u, "POST", "/decor/buy", { item: "grass_tuft", qty: 6 });
  const all = cellsSeq(1, "grass_tuft", 4);
  const rs = await Promise.all([save(u, 1, [all[0], all[1]], 0), save(u, 1, [all[2], all[3]], 0)]);
  assert.deepStrictEqual(rs.map((r) => r.status).sort(), [200, 409]);
  const rows = await placedRows(u, 1);
  assert.strictEqual(rows.length, 2, "chỉ một bố cục được lưu");
  const oneOf = (set) => JSON.stringify(rows) === JSON.stringify(set.map((c) => ({ island_index: 1, item_key: "grass_tuft", x: c.x, z: c.z, rot: 0 })));
  assert.ok(oneOf([all[0], all[1]]) || oneOf([all[2], all[3]]), "bố cục lưu phải là MỘT trong hai bản, không phải bản trộn: " + JSON.stringify(rows));
  assert.strictEqual((await styleRows(u))[0].layoutVer, 1);
});
t("17 Vị trí sai và bố cục vượt 40 món: 400 kèm lý do từng món, không lưu một phần nào", async () => {
  const u = await walletUser(300);
  await api(u, "POST", "/decor/buy", { item: "grass_tuft", qty: 45 });
  const L = IC.genIsland(1);
  const edge = { item: "grass_tuft", x: IC.snap(L.r + 2), z: 0, rot: 0 };
  const house = { item: "grass_tuft", x: IC.snap(L.slots[0].x), z: IC.snap(L.slots[0].z), rot: 0 };
  const bad = await save(u, 1, [edge, house], 0);
  assert.strictEqual(bad.status, 400);
  assert.match(bad.body.error, /Ra ngoài mép đảo/);
  assert.deepStrictEqual(bad.body.errors.map((e) => e.index), [0, 1], "phải chỉ rõ món nào sai");
  assert.match(bad.body.errors[1].reason, /Sát ô Nhà/);
  assert.deepStrictEqual(await placedRows(u, 1), [], "bố cục sai thì không lưu được một phần nào");
  assert.deepStrictEqual(await styleRows(u), [], "và không tạo phiên bản ảo");
  const rot = await save(u, 1, [{ item: "grass_tuft", x: 0.25, z: 0.25, rot: 8 }], 0);
  assert.strictEqual(rot.status, 400);
  assert.match(rot.body.errors[0].reason, /Hướng xoay/);
  const junk = await save(u, 1, [{ item: "kim_loai_nho", x: 0.5, z: 0.5, rot: 0 }], 0);
  assert.strictEqual(junk.status, 400);
  assert.match(junk.body.error, /không có trong danh mục/);
  const many = cellsIn(1, "grass_tuft", 41);
  assert.strictEqual(many.length, 41, "cần 41 chỗ hợp lệ để vượt trần 40");
  const over = await save(u, 1, many, 0);
  assert.strictEqual(over.status, 400);
  assert.match(JSON.stringify(over.body.errors), /tối đa 40 món/);
  assert.strictEqual(await bal(u), 300 - 45 * 3, "đặt đồ không được động tới ví kể cả khi bị từ chối");
});
t("13 Đặt vượt số đã mua và đặt món chưa mua: 409, bố cục cũ đứng nguyên", async () => {
  const u = await walletUser(200);
  await api(u, "POST", "/decor/buy", { item: "rock_small", qty: 2 });
  const cells = cellsSeq(1, "rock_small", 3);
  assert.strictEqual(cells.length, 3, "ba chỗ đều hợp lệ về hình học — chỉ sai ở số lượng");
  const r = await save(u, 1, cells, 0);
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /chỉ còn đặt được 2 Đá nhỏ/);
  assert.deepStrictEqual(r.body.errors.filter((e) => e.status === 409).map((e) => e.item), ["rock_small"]);
  const unowned = await save(u, 1, [cellsSeq(1, "oak", 1)[0]], 0);
  assert.strictEqual(unowned.status, 409);
  assert.match(unowned.body.error, /còn đặt được 0 Cây sồi/);
  assert.deepStrictEqual(await placedRows(u, 1), []);
  assert.deepStrictEqual(await styleRows(u), []);
});
t("18 Cất đồ về kho rồi đặt lại: decor_owned không đổi, không hoàn xu, không mất đồ", async () => {
  const u = await walletUser(100);
  await api(u, "POST", "/decor/buy", { item: "fence", qty: 3 });
  const cells = cellsSeq(1, "fence", 3);
  assert.strictEqual((await save(u, 1, cells, 0)).status, 200);
  const afterBuy = await bal(u), spendRows = (await spends(u)).length;
  assert.strictEqual((await save(u, 1, [cells[0]], 1)).status, 200, "cất hai món: chỉ gửi lại món muốn giữ");
  assert.strictEqual((await styleRows(u))[0].layoutVer, 2);
  assert.strictEqual(await bal(u), afterBuy, "cất đồ là miễn phí");
  assert.strictEqual((await spends(u)).length, spendRows, "và không có dòng hoàn xu");
  assert.deepStrictEqual(await ownedRows(u), [{ item_key: "fence", qty: 3 }], "cất đồ không xóa quyền sở hữu");
  assert.strictEqual((await save(u, 1, cells, 2)).status, 200, "đặt lại cả ba cái vẫn được");
  assert.strictEqual((await placedRows(u, 1)).length, 3);
  assert.strictEqual((await view(u)).decor.left.fence, 0, "đặt hết 3/3 thì còn 0");
  assert.strictEqual((await save(u, 1, [], 3)).status, 200, "dọn trắng cả đảo cũng hợp lệ");
  assert.deepStrictEqual(await placedRows(u, 1), []);
});
t("20 Đảo A và đảo B độc lập, nhưng số cái đặt trên MỌI đảo không vượt số đã mua", async () => {
  const u = await walletUser(IC.islandCost(1) + 120);
  await api(u, "POST", "/decor/buy", { item: "stone_path", qty: 2 });
  const a = cellsSeq(1, "stone_path", 1);
  assert.strictEqual((await save(u, 1, a, 0)).status, 200);
  assert.strictEqual((await api(u, "POST", "/travel", { index: 2 })).status, 409, "đảo 2 còn khóa");
  assert.strictEqual((await save(u, 2, cellsSeq(2, "stone_path", 1), 0)).status, 409, "không trang trí được đảo chưa mở");
  await finishIsland(u);
  await api(u, "POST", "/decor/buy", { item: "stone_path", qty: 2 });
  const b = cellsSeq(2, "stone_path", 2);
  assert.strictEqual((await save(u, 2, b, 0)).status, 200, "đảo 2 đặt được nhờ số còn lại vừa mua thêm");
  const v = await view(u);
  assert.strictEqual(v.decor.placed["1"].length, 1, "bố cục đảo 1 nguyên vẹn");
  assert.strictEqual(v.decor.placed["2"].length, 2);
  assert.strictEqual(v.decor.left.stone_path, 1, "4 cái đã mua, đang đặt 1 + 2 = còn 1 cái trong kho");
  /* Đặt lại đảo 1 bằng 3 cái: đảo 1 được tính lại từ đầu nên ngân sách là 4 − 2 (của đảo 2) = 2 → thừa 1. */
  const third = await save(u, 1, cellsSeq(1, "stone_path", 3), 1);
  assert.strictEqual(third.status, 409);
  assert.match(third.body.error, /đã trừ đồ đang đặt ở đảo khác/);
  assert.strictEqual((await placedRows(u, 1)).length, 1);
  assert.strictEqual((await save(u, 1, cellsSeq(1, "stone_path", 2), 1)).status, 200, "2 cái trên đảo 1 + 2 đảo 2 = đúng 4 đã mua");
  assert.strictEqual((await view(u)).decor.left.stone_path, 0);
});

/* ================= phong cách ================= */
t("19 Mở khóa phong cách một lần; mở lại 409; chọn nhánh chưa mở 409; đổi tự do miễn phí", async () => {
  const u = await walletUser(400);
  const r = await api(u, "POST", "/style/buy", { style: "t_night" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.xu, 340);
  assert.deepStrictEqual(await styleOwned(u), ["t_night"]);
  assert.deepStrictEqual(await spends(u, "style_buy"), [{ kind: "style_buy", topic: "t_night", slot: null, cost: 60, xu: 340 }]);
  const again = await api(u, "POST", "/style/buy", { style: "t_night" });
  assert.strictEqual(again.status, 409);
  assert.match(again.body.error, /đã mở cho tài khoản này/);
  assert.strictEqual((await spends(u, "style_buy")).length, 1);
  assert.strictEqual((await api(u, "POST", "/style/buy", { style: "gió_trời" })).status, 400);
  const before = await bal(u);
  const notOwned = await api(u, "POST", "/style", { island: 1, weather: "w_rain" });
  assert.strictEqual(notOwned.status, 409);
  assert.match(notOwned.body.error, /Chưa mở Mưa nhẹ/);
  const pick = await api(u, "POST", "/style", { island: 1, tod: "t_night" });
  assert.strictEqual(pick.status, 200);
  assert.deepStrictEqual(pick.body.decor.styles["1"], { weather: null, tod: "t_night", grass: null, sky: null, layoutVer: 0 });
  assert.strictEqual(await bal(u), before, "chọn phong cách đã mở thì miễn phí");
  assert.strictEqual((await api(u, "POST", "/style", { island: 1, tod: "w_rain" })).status, 400, "đúng khóa nhưng sai nhánh");
  assert.strictEqual((await api(u, "POST", "/style", { island: 1 })).status, 400, "không chọn nhánh nào cả");
  assert.strictEqual((await api(u, "POST", "/style", { island: 9, tod: "t_night" })).status, 409, "đảo còn khóa");
  assert.strictEqual((await api(u, "POST", "/style", { island: 1, tod: null })).status, 200, "null là về mặc định của đảo");
  assert.strictEqual((await view(u)).decor.styles["1"].tod, null);
  await api(u, "POST", "/style/buy", { style: "g_lavender" });
  const both = await api(u, "POST", "/style", { island: 1, tod: "t_night", grass: "g_lavender" });
  assert.strictEqual(both.status, 200);
  assert.deepStrictEqual([both.body.decor.styles["1"].tod, both.body.decor.styles["1"].grass], ["t_night", "g_lavender"]);
  assert.strictEqual(both.body.decor.styles["1"].layoutVer, 0, "đổi phong cách không đụng phiên bản bố cục");
});

/* Ca thêm khi làm D4 (bảng phong cách trên tab 🎨): mỗi cú POST /style chỉ nhắc MỘT nhánh,
   nên ba nhánh còn lại phải giữ nguyên. Bản đầu ghi thẳng r.style → pg biến undefined thành NULL
   và xóa sạch các nhánh đã bật trước đó (bật "Mưa" là mất "Đêm"). */
t("24 Chọn từng nhánh một không được xóa ba nhánh còn lại (lỗi D4)", async () => {
  const u = await walletUser(400);
  for (const k of ["t_night", "w_rain", "g_lavender", "s_starry"]) {
    const r = await api(u, "POST", "/style/buy", { style: k });
    assert.strictEqual(r.status, 200, `mở ${k}`);
  }
  const before = await bal(u);
  for (const [kind, key] of [["tod", "t_night"], ["weather", "w_rain"], ["grass", "g_lavender"], ["sky", "s_starry"]]) {
    const r = await api(u, "POST", "/style", { island: 1, [kind]: key });
    assert.strictEqual(r.status, 200, `bật ${kind}`);
    assert.strictEqual(r.body.decor.styles["1"][kind], key);
  }
  assert.deepStrictEqual((await view(u)).decor.styles["1"],
    { weather: "w_rain", tod: "t_night", grass: "g_lavender", sky: "s_starry", layoutVer: 0 },
    "bốn cú POST rời rạc vẫn giữ đủ bốn nhánh");
  assert.deepStrictEqual(await styleRows(u),
    [{ island_index: 1, weather: "w_rain", tod: "t_night", grass: "g_lavender", sky: "s_starry", layoutVer: 0 }],
    "dòng CSDL trùng với view");
  assert.strictEqual(await bal(u), before, "bốn lần đổi nhánh đều miễn phí");
  const off = await api(u, "POST", "/style", { island: 1, weather: null });
  assert.deepStrictEqual(off.body.decor.styles["1"],
    { weather: null, tod: "t_night", grass: "g_lavender", sky: "s_starry", layoutVer: 0 },
    "null chỉ xóa đúng nhánh được nhắc");
});

/* ================= 📌 danh sách mong muốn (D5) ================= */
t("25 📌 PUT /decor/wish: lưu đúng thứ tự, miễn phí, không đụng ví lẫn layout_ver", async () => {
  const u = await walletUser(200);
  await api(u, "POST", "/decor/buy", { item: "grass_tuft", qty: 2 });
  const grass = cellsSeq(1, "grass_tuft", 2);
  assert.strictEqual((await save(u, 1, grass, 0)).status, 200);
  const before = await bal(u);
  const sp0 = (await spends(u)).length;
  const r = await api(u, "PUT", "/decor/wish", { items: ["observatory", "dog_house", "grass_tuft"] });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.decor.wish, ["observatory", "dog_house", "grass_tuft"], "giữ đúng thứ tự người chơi thêm");
  assert.deepStrictEqual(await wishDb(u), ["observatory", "dog_house", "grass_tuft"], "view trùng với dòng CSDL");
  assert.strictEqual(await bal(u), before, "danh sách mong muốn không liên quan ví");
  assert.strictEqual((await spends(u)).length, sp0, "ước không thêm dòng xu_spend nào (cú mua cỏ phía trên là dòng duy nhất)");
  assert.strictEqual((await view(u)).decor.styles["1"].layoutVer, 1, "ước không làm bố cục đổi phiên bản");
  /* một món ước hai lần vẫn chỉ là một dòng */
  const twice = await api(u, "PUT", "/decor/wish", { items: ["bench", "bench"] });
  assert.strictEqual(twice.status, 200);
  assert.deepStrictEqual(await wishDb(u), ["bench"]);
  /* xóa trắng là hợp lệ */
  assert.strictEqual((await api(u, "PUT", "/decor/wish", { items: [] })).status, 200);
  assert.deepStrictEqual(await wishDb(u), []);
});
t("26 📌 Ước quá 10 món / khóa lạ / không phải mảng: 400 kèm lý do, danh sách cũ đứng nguyên", async () => {
  const u = await walletUser(50);
  assert.strictEqual((await api(u, "PUT", "/decor/wish", { items: ["bench"] })).status, 200);
  const over = await api(u, "PUT", "/decor/wish", { items: IC.DECOR_ALL.slice(0, 11).map((i) => i.k) });
  assert.strictEqual(over.status, 400); assert.match(over.body.error, /tối đa 10 món/);
  const junk = await api(u, "PUT", "/decor/wish", { items: ["dragon_statue"] });
  assert.strictEqual(junk.status, 400); assert.match(junk.body.error, /không có trong danh mục/);
  const notArray = await api(u, "PUT", "/decor/wish", { items: "bench" });
  assert.strictEqual(notArray.status, 400);
  assert.deepStrictEqual(await wishDb(u), ["bench"], "cả ba cú sai không xóa, không ghi thêm gì");
  /* món CHƯA MỞ GÓI ước được — danh sách là mục tiêu chứ không phải cửa hàng */
  const locked = await api(u, "PUT", "/decor/wish", { items: ["mini_torii", "coral_pile"] });
  assert.strictEqual(locked.status, 200, "gói chưa mở vẫn ước được");
  assert.strictEqual(await bal(u), 50, "và vẫn không trừ xu");
});
t("27 📌 wishRows: 'còn thiếu bao nhiêu xu' tính từ view thật, đã có đồ thì 0", async () => {
  const u = await walletUser(100);
  await api(u, "POST", "/decor/buy", { item: "rock_small", qty: 1 });   // 3 xu
  const v = await view(u);
  assert.strictEqual(v.catalog.wishMax, 10, "giao diện đọc trần ước từ lõi, không viết tay");
  await api(u, "PUT", "/decor/wish", { items: ["observatory", "rock_small"] });
  const v2 = await view(u);
  const rows = IC.wishRows(v2.decor.wish, v2.decor.owned, v2.xu);
  assert.deepStrictEqual(rows.map((r) => r.k), ["observatory", "rock_small"]);
  assert.strictEqual(rows[0].missing, 800 - v2.xu, "món chưa có: thiếu đúng hiệu giữa giá và ví");
  assert.strictEqual(rows[1].missing, 0, "đã có 1 cái trong kho thì không còn là khoản thiếu");
  assert.strictEqual(rows[0].price, 800, "lấy giá từ catalog server gửi, không hard-code trong giao diện");
  const rich = await walletUser(5000);
  await api(rich, "PUT", "/decor/wish", { items: ["observatory"] });
  const vr = await view(rich);
  assert.strictEqual(IC.wishRows(vr.decor.wish, vr.decor.owned, vr.xu)[0].missing, 0, "đủ tiền thì không còn thiếu");
});

/* ================= tài khoản Khách ================= */
t("21 Khách (user 0) chơi rồi đăng ký: đảo, thú, kho, đồ, bố cục, phong cách, danh sách ước chuyển sang — không ghi đè", async () => {
  const G = 0;
  await api(G, "GET", "/");
  await fund(G, 150); // thú 40 + hạt 6 + cỏ 6 + khóa Hoàng hôn 60, chừa tiền để chắc chắn không cú nào rớt vì thiếu xu
  await api(G, "POST", "/adopt", { breed: "cat-tabby", name: "Bông" });
  await api(G, "POST", "/food", { item: "khat", qty: 2 });
  await api(G, "POST", "/decor/buy", { item: "grass_tuft", qty: 2 });
  assert.strictEqual((await save(G, 1, cellsSeq(1, "grass_tuft", 2), 0)).status, 200);
  await api(G, "POST", "/style/buy", { style: "t_dusk" });
  await api(G, "POST", "/style", { island: 1, tod: "t_dusk" });
  await api(G, "PUT", "/decor/wish", { items: ["pet_bed", "observatory"] });

  const u = newUser();
  const out = await db.withTransaction((c) => transferGuestData(c, G, u));
  assert.deepStrictEqual(out, { moved: true, conflict: false });
  const v = await view(u);
  assert.strictEqual(v.decor.owned.grass_tuft, 2, "đồ đã mua theo người, không rớt lại ở tài khoản Khách");
  assert.strictEqual(v.decor.placed["1"].length, 2);
  assert.strictEqual(v.decor.styles["1"].tod, "t_dusk");
  assert.deepStrictEqual(v.decor.styleOwned, ["t_dusk"]);
  assert.deepStrictEqual(v.decor.wish, ["pet_bed", "observatory"], "danh sách ước (D5) cũng đi theo người chơi");
  assert.strictEqual(v.pets.length, 1, "thú và kho cũng đi theo (island_state, pet_owned, pet_pantry)");
  assert.strictEqual(v.pantry.khat, 2);
  assert.strictEqual(v.island.levels.join(","), "0,0,0,0,0");
  assert.deepStrictEqual(await pool.query(`SELECT count(*)::int n FROM decor_placed WHERE user_id = 0`).then((r) => r.rows[0]), { n: 0 }, "Khách không còn giữ bản sao");
  /* tài khoản đã có đảo thì KHÔNG ghi đè — trả conflict để hỏi lại người dùng */
  const u2 = newUser();
  await api(u2, "GET", "/");
  await fund(u2, 50);
  await api(u2, "POST", "/decor/buy", { item: "oak", qty: 1 });
  await api(G, "GET", "/");
  await fund(G, 30);
  await api(G, "POST", "/decor/buy", { item: "pine", qty: 1 });
  const second = await db.withTransaction((c) => transferGuestData(c, G, u2));
  assert.deepStrictEqual(second, { moved: false, conflict: true });
  assert.deepStrictEqual((await ownedRows(u2)).map((r) => r.item_key), ["oak"], "dữ liệu của tài khoản giữ nguyên");
  assert.deepStrictEqual((await ownedRows(G)).map((r) => r.item_key), ["pine"], "và dữ liệu Khách vẫn nằm chỗ cũ, chưa xóa gì");
});

/* ================= không phá phần đã có ================= */
t("22 Các API cũ vẫn chạy đúng sau khi thêm năm bảng trang trí", async () => {
  const u = await walletUser(IC.islandCost(1) + 700);
  const up = await api(u, "POST", "/upgrade", { slot: 0 });
  assert.strictEqual(up.status, 200);
  assert.strictEqual(up.body.decor.left.grass_tuft, 0, "mọi đáp án cũ đều kèm khối decor để tab 🎨 không phải gọi thêm");
  const pet = (await api(u, "POST", "/adopt", { breed: "dog-shiba", name: "Mực" })).body.pets[0];
  await api(u, "POST", "/food", { item: "ca", qty: 2 });
  const steps = [["/travel", { index: 1 }], ["/feed", { petId: pet.id, item: "ca" }], ["/care", { petId: pet.id, action: "play" }]];
  for (const [p, body] of steps) assert.strictEqual((await api(u, "POST", p, body)).status, 200, p);
  assert.strictEqual((await api(u, "POST", "/feed", { petId: 12345, item: "ca" })).status, 404);
  assert.strictEqual((await api(u, "POST", "/travel", { index: 3 })).status, 409);
  await finishIsland(u);
  assert.strictEqual((await view(u)).island.done, 1);
  assert.strictEqual((await api(u, "POST", "/decor/buy", { item: "pet_statue", qty: 1 })).status, 200, "đảo hoàn chỉnh cũng mở công trình lớn như đã hẹn");
});
t("23 Không có đường nào làm xu TĂNG từ trang trí: mua thì giảm, đặt thì đứng nguyên", async () => {
  const u = await walletUser(600);
  const start = await bal(u);
  const acts = [["/decor/buy", { item: "grass_tuft", qty: 3 }], ["/decor/buy", { item: "bush", qty: 1 }],
    ["/style/buy", { style: "w_rain" }], ["/style", { island: 1, weather: "w_rain" }]];
  for (const [p, body] of acts) {
    const before = await bal(u);
    const r = await api(u, "POST", p, body);
    assert.ok([200, 409].includes(r.status), `${p} ${JSON.stringify(body)} → ${r.status}`);
    assert.ok(await bal(u) <= before, `${p} không được cộng xu vào ví`);
  }
  const grass = cellsSeq(1, "grass_tuft", 3);
  const cells = grass.concat(cellsSeq(1, "bush", 1, grass));
  assert.strictEqual((await save(u, 1, cells, 0)).status, 200);
  assert.strictEqual((await save(u, 1, [], 1)).status, 200);
  const afterPut = await bal(u);
  assert.ok(afterPut < start, "cả chuỗi chỉ tiêu, không in xu");
  const sp = await spends(u);
  assert.deepStrictEqual([...new Set(sp.map((r) => r.kind))].sort(), ["decor_buy", "style_buy"]);
  assert.strictEqual(start - afterPut, sp.reduce((s, r) => s + r.cost, 0), "mỗi xu tiêu ra đều có đúng một dòng nhật ký");
  const v = await view(u);
  assert.strictEqual(v.xu, afterPut, "số dư trong đáp án là số dư thật của town_state.xu");
  assert.strictEqual(v.decor.styleOwned.length, 1);
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
  for (let i = 1; i <= 200; i++) ins.push(`(${i},'Thì')`);
  await admin.query(`INSERT INTO ${SCHEMA}.questions VALUES ${ins.join(",")}`);

  const app = express();
  app.use((req, _res, next) => { req.userId = Number(req.headers["x-user"]); next(); });
  app.use("/api/islands", createIslandRouter({ db }));
  const server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/islands`;

  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log("  ✔", name); }
    catch (e) { fail++; console.log("  ✘", name, "\n     ", String(e.message).split("\n").slice(0, 6).join("\n     ")); }
  }
  console.log(`\ndecor-api: ${pass} đạt, ${fail} lỗi`);
  server.close(); await pool.end();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`); await admin.end();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
