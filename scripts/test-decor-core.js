"use strict";
/* Kiểm thử LÕI TRANG TRÍ đảo (D1) — luật thuần, 0 CSDL, 0 mạng, 0 token.
   Chạy:  node scripts/test-decor-core.js   ·   nhanh (bỏ ca 6, ~1 s thay vì ~16 s):
          set DECOR_N=0 && node scripts/test-decor-core.js        (cmd.exe)
   Phạm vi: mục 7 + mục 12 của README-trang-tri-dao.md — catalog, canPlace, flood fill, ngân sách,
   thú không kẹt, và "genIsland không đổi khi có đồ".  ca 6 chiếm gần hết thời gian (~15 s / 500 đảo). */
const assert = require("assert");
const I = require("../src/island-core");
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", e.message.split("\n")[0]); } };
const C = I.DECOR, G = I.GEO;
const L1 = I.genIsland(1), L7 = I.genIsland(7);
const reason = (L, layout, item, x, z, rot, opts) => I.canPlace(L, layout, item, x, z, rot, opts || { slots: {} }).reason || "";
const sum = (a) => a.reduce((s, i) => s + i.price, 0);
const OWN = Object.fromEntries(I.DECOR_ALL.map((i) => [i.k, 99]));
/* bố cục random hợp pháp trên đảo n — cùng khuôn với sim-trang-tri.js */
function greedy(n, maxBlock, seedTag) {
  const L = I.genIsland(n), rnd = I.rand(I.hash("dc-" + (seedTag || "") + n));
  const pool = I.DECOR_ALL.filter((i) => I.isBlocker(i) && !i.theme);
  const layout = [], base = I.walkFraction(L, []);
  for (let k = 0; k < 300 && layout.length < (maxBlock || C.maxBlock); k++) {
    const it = pool[Math.floor(rnd() * pool.length)], a = rnd() * 6.283, d = rnd() * (L.r - 1);
    const x = I.snap(Math.cos(a) * d), z = I.snap(Math.sin(a) * d);
    if (I.canPlace(L, layout, it, x, z, 0, { slots: {}, baseFraction: base }).ok) layout.push({ item: it.k, x, z, rot: 0 });
  }
  return { L, layout, base, f: I.walkFraction(L, layout) };
}
/* Quét lưới 0,25 thay vì đoán toạ độ: đảo random nên chỗ trống hôm nay có thể là ô Cây ngày mai.
   freeCells  CHỈ so với bố cục gốc (không cộng dồn) nên ngân sách không cắt danh sách ô — món phẳng
   và hiệu ứng không xung đột nhau, đủ để kiểm luật 40 món / 2 hiệu ứng. */
function freeCells(L, layout, item, want, opts) {
  const out = [];
  for (let i = -40; i <= 40 && out.length < want; i++) for (let j = -40; j <= 40 && out.length < want; j++) {
    const x = i * C.grid, z = j * C.grid;
    if (I.canPlace(L, layout, item, x, z, 0, Object.assign({ slots: {} }, opts)).ok) out.push({ item: item.k, x, z, rot: 0 });
  }
  return out;
}
/* ô đầu tiên bị từ chối VỚI ĐÚNG LÝ DO này (bỏ qua mọi lý do khác trên đường quét) */
function rejectCell(L, layout, item, re, opts) {
  for (let i = -40; i <= 40; i++) for (let j = -40; j <= 40; j++) {
    const x = i * C.grid, z = j * C.grid;
    const r = I.canPlace(L, layout, item, x, z, 0, Object.assign({ slots: {} }, opts));
    if (!r.ok && re.test(r.reason || "")) return r.reason;
  }
  return "quét hết lưới mà không có ô nào bị từ chối vì " + re;
}

t("ca 1 — catalog: 46 món chung + 32 món gói (8 gói × 4) + 15 phong cách, khóa duy nhất, giá và lớp hợp lệ", () => {
  assert.strictEqual(I.DECOR_ITEMS.length, 46);
  assert.strictEqual(I.DECOR_THEMED.length, 32);
  assert.strictEqual(I.DECOR_STYLES.length, 15);
  const keys = I.DECOR_ALL.map((i) => i.k);
  assert.strictEqual(new Set(keys).size, keys.length, "khóa món trùng");
  for (const i of I.DECOR_ALL) {
    assert.ok(i.price >= 1, i.k + " giá < 1");
    assert.ok(["W", "S", "M", "L", "XL", "FX"].includes(i.cls), i.k + " lớp lạ: " + i.cls);
    assert.strictEqual(i.r, C.radius[i.cls], i.k + " bán kính phải khớp lớp");
    assert.ok(i.name && i.icon, i.k + " thiếu tên hoặc biểu tượng");
    if (i.theme) assert.ok(I.CONFIG.themes.some((x) => x.k === i.theme), i.k + " chủ đề lạ");
  }
  for (const s of I.DECOR_STYLES) assert.ok(["weather", "tod", "grass", "sky"].includes(s.kind), s.k + " loại phong cách lạ");
  assert.strictEqual(I.DECOR_STYLES.filter((s) => s.kind === "tod").map((s) => s.tod).join(","), "0,1,2,3");
  /* tổng giá phải đúng như đặc tả đã tính */
  assert.deepStrictEqual([sum(I.DECOR_ITEMS), sum(I.DECOR_THEMED), sum(I.DECOR_STYLES)], [3573, 1229, 830]);
  assert.strictEqual(sum(I.DECOR_ITEMS) + sum(I.DECOR_THEMED) + sum(I.DECOR_STYLES), 5632);
  const byGroup = {};
  for (const i of I.DECOR_ITEMS) byGroup[i.group] = (byGroup[i.group] || 0) + i.price;
  assert.deepStrictEqual(byGroup, { "Cây và hoa": 116, "Đường và hàng rào": 114, Đèn: 308, "Đồ vườn và nhà": 277, "Nước và đá": 228, "Hiệu ứng": 140, "Thú cưng": 190, "Công trình lớn": 2200 });
  const byPack = {};
  for (const i of I.DECOR_THEMED) byPack[i.group] = (byPack[i.group] || 0) + i.price;
  assert.deepStrictEqual(byPack, {
    "Gói Anh Đào": 200, "Gói Phong Thu": 115, "Gói Ốc Đảo": 132, "Gói Băng Tuyết": 155,
    "Gói Nhiệt Đới": 130, "Gói Mây Trời": 195, "Gói Đáy Biển": 117, "Gói Đom Đóm": 185,
  }, " tám gói phải đủ và mỗi gói 4 món");
  for (const th of I.CONFIG.themes) {
    const pack = I.DECOR_THEMED.filter((i) => i.theme === th.k);
    assert.strictEqual(pack.length, 4, "gói " + th.k + " phải có 4 món");
    assert.ok(pack.every((i) => i.group === "Gói " + th.name), "gói " + th.k + " mang tên nhóm khác");
  }
  assert.deepStrictEqual(I.DECOR_ITEMS.filter((i) => i.cls === "XL").map((i) => i.needDone), [1, 2, 4, 8], "công trình lớn mở theo 1/2/4/8 đảo hoàn chỉnh");
});

t("ca 2 — canPlace từ chối KÈM LÝ DO: món lạ, lệch lưới, hướng lạ, ra mép, đè ô đất, sát món chặn, vùng cấm, món chưa mở", () => {
  assert.match(reason(L1, [], "dragon", 1, 1, 0), /danh mục/i);
  assert.match(reason(L1, [], "oak", 1.01, 2, 0), /bám lưới/i);
  assert.match(reason(L1, [], "oak", 1, 2, 8), /8 bước/i);
  assert.match(reason(L1, [], "oak", I.snap(L1.r + 2), 0, 0), /mép đảo/i);
  /* tâm ô đất không rơi đúng lưới 0,25 → phải làm tròn trước khi probing */
  const at = (p, dx) => [I.snap(p.x + (dx || 0)), I.snap(p.z)];
  assert.match(reason(L1, [], "oak", ...at(L1.slots[0]), 0), /Sát ô Nhà/i);
  assert.match(reason(L1, [], "oak", ...at(L1.slots[1], 1.25), 0), /Sát ô Cây/i);
  const f = I.themeOf(1).features[0];
  assert.match(reason(L1, [], "oak", ...at(L1.slots[2]), 0), new RegExp("Sát ô " + f.name));
  /* hai món chặn phải chừa lối >= 1,0 giữa hai vùng cấm của thú */
  const rock = freeCells(L1, [], I.decorOf("rock_big"), 1)[0];
  assert.ok(rock, "Đá lớn phải có chỗ trống trên đảo 1");
  assert.match(rejectCell(L1, [rock], "rock_big", /Quá sát Đá lớn/), /Quá sát Đá lớn.*chừa lối/i);
  /* chắn ngay cửa Nhà: vùng cấm 1,2 quanh cửa nằm chồng lên vành ô Nhà, nên lý do "cửa Nhà"
     chỉ xuất hiện ở phần vịnh phía NGÒAI ô — quét lưới tìm đúng ô đó. */
  assert.match(rejectCell(L1, [], "oak", /cửa Nhà/), /Chắn ngay cửa Nhà/i);
  /* bát nước: món chặn áp vào bát bị từ chối, và ngược lại đặt bát cạnh đồ chặn cũng vậy */
  const bowl = freeCells(L1, [], I.decorOf("water_bowl"), 1)[0];
  const oak1 = freeCells(L1, [], I.decorOf("oak"), 1)[0];
  assert.ok(bowl && oak1, "bát nước và cây sồi phải có chỗ trống");
  assert.match(rejectCell(L1, [bowl], "oak", /Chắn bát nước/), /Chắn bát nước/i);
  assert.match(rejectCell(L1, [oak1], "water_bowl", /Bát nước bị đồ khác chắn/), /Bát nước bị đồ khác chắn/i);
  /* món gói chủ đề + công trình lớn: chưa mở là chưa đặt */
  assert.match(reason(L1, [], "mini_torii", 2.25, -2.25, 0, { slots: {} }), /Chưa mở/i);
  assert.match(reason(L1, [], "pet_statue", 2.25, -2.25, 0, { slots: {} }), /Chưa mở.*1 đảo hoàn chỉnh/i);
  assert.ok(I.canPlace(L1, [], "mini_torii", 2.25, -2.25, 0, { slots: { 1: [3, 3, 3, 3, 3] } }).ok, "đã hoàn chỉnh đảo Anh Đào thì gói Anh Đào đặt được");
  assert.match(I.itemLockedReason(I.decorOf("clock_tower"), { 1: [3, 3, 3, 3, 3] }), /4 đảo/i);
  /* D5 — bốn gói mới cũng chỉ mở vì đúng chủ đề của nó: đảo 7 thuộc Đáy Biển */
  assert.strictEqual(I.themeOf(7).k, "ocean");
  const cell = freeCells(L7, [], I.decorOf("coral_pile"), 1, { slots: { 7: [3, 3, 3, 3, 3] } })[0];
  assert.ok(cell, "rạn san hô phải có chỗ trống trên đảo 7 khi gói đã mở");
  assert.match(I.canPlace(L7, [], "coral_pile", cell.x, cell.z, 0, { slots: {} }).reason, /gói 🐚 Đáy Biển/);
  assert.match(I.canPlace(L1, [], "coral_pile", 2.25, -2.25, 0, { slots: { 1: [3, 3, 3, 3, 3] } }).reason, /Đáy Biển/,
    "hoàn chỉnh đảo Anh Đào không mở hộ gói Đáy Biển");
});

t("ca 3 — ngân sách: 40 món / 12 món chặn / 2 hiệu ứng / 1 công trình lớn, vượt là từ chối", () => {
  const flat = freeCells(L7, [], I.decorOf("stone_path"), C.maxTotal + 1);
  assert.strictEqual(flat.length, C.maxTotal + 1, "phải tìm được 41 ô trống cho món phẳng");
  const full = flat.slice(0, C.maxTotal);
  assert.match(reason(L7, full, "stone_path", flat[C.maxTotal].x, flat[C.maxTotal].z, 0), /tối đa 40/i);

  const g = greedy(7, C.maxBlock);
  assert.strictEqual(g.layout.length, C.maxBlock, "đảo 7 phải đặt đủ 12 món chặn");
  assert.strictEqual(I.blockCount(g.layout), C.maxBlock);
  /* không còn ô nào cho món chặn thứ 13: mọi vị trí đều phải bị từ chối */
  let ke = null;
  for (let i = -40; i <= 40 && !ke; i++) for (let j = -40; j <= 40 && !ke; j++) {
    const r = I.canPlace(L7, g.layout, "fence", i * C.grid, j * C.grid, 0, { slots: {}, baseFraction: g.base });
    if (r.ok) ke = "đặt được món chặn thứ 13 — sai";
    else if (/12 món chặn/.test(r.reason)) ke = r.reason;
  }
  assert.match(String(ke), /Tối đa 12 món chặn/i);

  const fx = freeCells(L7, [], I.decorOf("fireflies"), 2);
  assert.strictEqual(fx.length, 2, "phải có chỗ cho 2 hiệu ứng");
  assert.match(rejectCell(L7, fx, "butterflies", /tối đa 2 hiệu ứng/), /Tối đa 2 hiệu ứng/i);

  const done4 = { 1: [3, 3, 3, 3, 3], 2: [3, 3, 3, 3, 3], 3: [3, 3, 3, 3, 3], 4: [3, 3, 3, 3, 3] };
  const xl = freeCells(L1, [], I.decorOf("pet_statue"), 1, { slots: done4 });
  assert.strictEqual(xl.length, 1, "công trình lớn phải có chỗ khi đã mở khóa");
  assert.match(rejectCell(L1, xl, "big_windmill", /một công trình lớn/, { slots: done4 }), /Mỗi đảo chỉ đặt một công trình lớn/i);
});

t("ca 4 — món phẳng (W) và hiệu ứng (FX) KHÔNG vào danh sách vật cản: thú đi qua được", () => {
  const w = freeCells(L1, [], I.decorOf("flower_patch"), 1)[0];
  const fx = freeCells(L1, [w], I.decorOf("butterflies"), 1)[0];
  const tr = freeCells(L1, [w, fx], I.decorOf("oak"), 1)[0];
  assert.ok(w && fx && tr, "cần có chỗ cho hoa, hiệu ứng và cây sồi");
  assert.deepStrictEqual(I.blockersOf(L1, [w, fx, tr]), [{ x: tr.x, z: tr.z, r: I.decorOf("oak").r }], "blockersOf chỉ lấy món chặn");
  assert.ok(I.walkable(L1, w.x, w.z, G.petR, I.blockersOf(L1, [w, fx, tr])), "thú đứng ngay luống hoa vẫn được");
  assert.strictEqual(I.walkFraction(L1, [w, fx]), I.walkFraction(L1, []), "W/FX không đổi độ liền khối");
  /* hai món cùng một ô lưới: từ chối */
  assert.match(reason(L1, [w], "stone_path", w.x, w.z, 0), /đã có Luống hoa/i);
  assert.strictEqual(I.isBlocker(I.decorOf("stone_path")), false);
  assert.strictEqual(I.isBlocker(I.decorOf("fireflies")), false);
  assert.strictEqual(I.decorOf("grass_tuft").r + I.decorOf("fire_pit").r, 0.45, "W bán kính 0, M bán kính 0,45");
});

t("ca 5 — vòng đá siết kín bị phát hiện: flood fill báo túi kín và luật đặt đồ từ chối", () => {
  const tree = L1.slots[1], ringR = 2.6, step = 1.3, layout = [];
  for (let a = 0; a < 6.283; a += step / ringR) layout.push({ item: "rock_big", x: I.snap(tree.x + Math.cos(a) * ringR), z: I.snap(tree.z + Math.sin(a) * ringR), rot: 0 });
  assert.ok(layout.length >= 10, "vòng phải đủ kín (" + layout.length + " món)");
  const f = I.walkFraction(L1, layout);
  assert.ok(f < Math.min(C.fillMin, I.walkFraction(L1, [])), "vòng đá phải cắt đảo — fraction " + f.toFixed(4));
  const v = I.validateLayout(L1, layout, OWN, {});
  assert.strictEqual(v.ok, false, "validateLayout phải báo lỗi");
  assert.ok(v.errors.some((e) => /Quá sát|chia cắt/.test(e.reason)), "phải có lý do bằng chữ: " + v.errors.map((e) => e.reason).join(" | ").slice(0, 160));
  /* và không ai dựng được vòng đó từng món một: tới món thứ 2 là bị chặn */
  let built = [];
  let stopped = null;
  for (const p of layout) { const r = I.canPlace(L1, built, "rock_big", p.x, p.z, 0, { slots: {}, baseFraction: I.walkFraction(L1, []) }); if (!r.ok) { stopped = r.reason; break; } built.push(p); }
  assert.ok(stopped, "phải từ chối đâu đó trong vòng — lý do: " + stopped);
});

t("ca 6 — 500 đảo ngẫu nhiên: luật khoảng cách + luật liền khối KHÔNG nào để đảo bị chia cắt", () => {
  const N = Number(process.env.DECOR_N === undefined ? 500 : process.env.DECOR_N);
  if (!N) { console.log("     (DECOR_N=0 → bỏ qua, chạy lại bằng: node scripts/test-decor-core.js)"); return; }
  let worse = 0, minF = 1, placed = 0, baseLow = 0;
  for (let k = 1; k <= N; k++) {
    const g = greedy(k, C.maxBlock);
    placed += g.layout.length;
    if (g.base < C.fillMin) baseLow++;
    if (g.f < Math.min(C.fillMin, g.base) - 1e-9) worse++;
    if (g.f < minF) minF = g.f;
  }
  console.log("     " + N + " đảo: " + (placed / N).toFixed(1) + " món chặn/đảo · nhỏ nhất " + (minF * 100).toFixed(2) + "% · đảo trống đã <98%: " + baseLow);
  assert.strictEqual(worse, 0, N + " đảo mà có " + worse + " đảo bị chia cắt là luật hỏng");
  assert.ok(placed / N >= C.maxBlock - 0.2, "luật không được bóp chết chỗ đặt (TB " + (placed / N).toFixed(2) + " món)");
});

t("ca 7 — thú đi 10.000 bước trên đảo CÓ ĐỒ: 0 điểm hỏng, không kẹt vĩnh viễn", () => {
  const g = greedy(4, C.maxBlock, "pet");
  const L = g.L, blocks = I.blockersOf(L, g.layout);
  assert.ok(blocks.length >= 8, "đảo phải có đủ đồ mới ra bài toán (" + blocks.length + " món chặn)");
  const rnd = I.rand(I.hash("petwalk-4"));
  const a = I.pickSpot(L, rnd, 0, 0, blocks);
  let x = a.x, z = a.z, bad = 0, stuckMax = 0, stuck = 0, moves = 0;
  for (let step = 0; step < 10000; step++) {
    const tgt = I.pickSpot(L, rnd, x, z, blocks);
    for (let inner = 0; inner < 40; inner++) {
      const dx = tgt.x - x, dz = tgt.z - z, d = Math.hypot(dx, dz);
      if (d < 0.12) break;
      const v = Math.min(0.05, d), ux = dx / d, uz = dz / d, ang = [0, 0.85, -0.85, 1.7, -1.7][inner % 5];
      const c = Math.cos(ang), s = Math.sin(ang), rx = ux * c - uz * s, rz = ux * s + uz * c;
      if (I.walkable(L, x + rx * v, z + rz * v, 0.25, blocks)) { x += rx * v; z += rz * v; moves++; stuck = 0; }
      else { stuck++; if (stuck > stuckMax) stuckMax = stuck; if (stuck > 30) { const q = I.pickSpot(L, rnd, 0, 0, blocks); x = q.x; z = q.z; stuck = 0; break; } }
    }
    if (!I.walkable(L, x, z, 0.05, blocks)) bad++; // đứng trong vật cản / ra ngoài đảo = hỏng
  }
  assert.strictEqual(bad, 0, bad + " điểm hỏng trong 10.000 bước");
  assert.ok(moves > 9000, "thú phải thực sự đi, chỉ có " + moves + " bước");
  /* đặt ngay món chặn lên đầu thú: cơ chế "chỗ đang đứng hết hợp lệ thì dịch về điểm an toàn" phải cứu được */
  const drop = I.canPlace(L, g.layout, "oak", I.snap(x), I.snap(z), 0, { slots: {}, baseFraction: g.base });
  const blocks2 = drop.ok ? blocks.concat([{ x: I.snap(x), z: I.snap(z), r: I.decorOf("oak").r }]) : blocks;
  assert.ok(!I.walkable(L, x, z, 0.05, blocks2) || drop.ok === false, "nếu đặt trúng chỗ thú đang đứng thì điểm đó phải thành không hợp lệ");
  const safe = I.pickSpot(L, rnd, 0, 0, blocks2);
  assert.ok(I.walkable(L, safe.x, safe.z, G.petR, blocks2), "điểm an toàn cứu thú phải hợp lệ");
});

t("ca 8 — genIsland không đổi: seed ổn định, có đồ trang trí cũng không sửa hình đảo (chốt 04/11)", () => {
  const parts = [];
  for (let n = 1; n <= 13; n++) { const L = I.genIsland(n); parts.push(n + ":" + L.r.toFixed(6) + "," + L.tod + "," + L.slots.map((s) => s.ob + "|" + s.x.toFixed(6) + "|" + s.z.toFixed(6)).join(";")); }
  assert.strictEqual(I.hash(parts.join("|")), 2155102802, "vân đảo 1..13 đổi nghĩa là hình học bị sửa");
  const a = JSON.stringify(I.genIsland(9));
  assert.strictEqual(JSON.stringify(I.genIsland(9)), a, "genIsland(9) phải cho ra giống từng chữ số");
  const before = JSON.stringify(I.genIsland(3));
  const L = I.genIsland(3), g = greedy(3, 6);
  L.slots.forEach(() => {});
  assert.strictEqual(JSON.stringify(I.genIsland(3)), before, "đặt đồ không được sửa hình đảo");
  assert.ok(g.layout.every((p) => p.x !== undefined && Math.abs(p.x / C.grid - Math.round(p.x / C.grid)) < 1e-9), "toạ độ đã lưu phải bám lưới 0,25");
  /* normLayout: rác bị loại kèm lý do, đồ tốt được chuẩn hóa */
  const nl = I.normLayout([{ item: "oak", x: 1.01, z: 2, rot: 0 }, { item: "khong-ton-tai", x: 0, z: 0, rot: 0 }, { item: "fence", x: 3, z: 4, rot: 9 }, { item: "bench", x: 2.5, z: -2.5, rot: 3 }]);
  assert.strictEqual(nl.items.length, 2);
  assert.strictEqual(nl.bad.length, 2);
  assert.deepStrictEqual([nl.items[0].x, nl.items[0].z], [1, 2], "1,01 phải làm tròn về 1,0");
  assert.strictEqual(nl.items[1].rot, 3);
});

console.log("\ndecor-core: " + pass + "/" + (pass + fail) + " mục đạt" + (fail ? " — CÓ MỤC HỎNG" : ""));
process.exit(fail ? 1 : 0);
