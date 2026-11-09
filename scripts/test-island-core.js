"use strict";
/* Kiểm thử lõi thuần island-core.js: không CSDL, không mạng, 0 token.  Chạy:  node scripts/test-island-core.js */
const assert = require("assert");
const I = require("../src/island-core");
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", e.message.split("\n")[0]); } };
const status = (fn) => { try { fn(); return 0; } catch (e) { return e.status; } };
const errOf = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const full = (lv) => [lv, lv, lv, lv, lv];

t("giá đảo 1 = 10/25/50 một ô, cả đảo đúng 425 xu như README", () => {
  assert.deepStrictEqual([I.costOf(1, 0), I.costOf(1, 1), I.costOf(1, 2)], [10, 25, 50]);
  assert.strictEqual(I.islandCost(1), 425);
});
t("hệ số tăng 0,15 mỗi đảo và chạm trần 3,00 từ đảo 15", () => {
  assert.strictEqual(I.factor(1), 1);
  assert.strictEqual(Number(I.factor(2).toFixed(2)), 1.15);
  assert.strictEqual(I.factor(15), 3);
  assert.strictEqual(I.factor(9999), 3);
  assert.strictEqual(I.islandCost(15), 1275);
  assert.ok(I.islandCost(2) > I.islandCost(1) && I.islandCost(5) > I.islandCost(2));
});
t("chủ đề lặp theo catalog 8 đảo: đảo 9 trở lại Anh Đào nhưng là vòng 2", () => {
  assert.strictEqual(I.themeOf(1).k, "sakura");
  assert.strictEqual(I.themeOf(8).k, "firefly");
  assert.strictEqual(I.themeOf(9).k, "sakura");
  assert.strictEqual(I.lapOf(9), 1);
  assert.strictEqual(I.themeOf(4).features.length, 3);
});
t("upgrade: trừ đúng giá, trả về cấp mới, chưa đủ 5 ô thì chưa mở đảo kế", () => {
  const r = I.upgrade(I.newState(), 100, 0, "2026-11-03");
  assert.deepStrictEqual([r.cost, r.xu, r.level, r.completed, r.state.slots[1]], [10, 90, 1, false, [1, 0, 0, 0, 0]]);
});
t("upgrade: thiếu xu -> 409, thông điệp nêu số còn thiếu, ví và đảo không đổi", () => {
  const s = I.newState();
  assert.strictEqual(status(() => I.upgrade(s, 9, 0, "2026-11-03")), 409);
  assert.ok(/còn thiếu 1/.test(errOf(() => I.upgrade(s, 9, 0, "2026-11-03"))));
  assert.deepStrictEqual(s.slots[1], full(0));
});
t("upgrade: đúng bằng giá thì được, ví về 0 (không phải 409 vì 'ít hơn')", () => {
  assert.strictEqual(I.upgrade(I.newState(), 10, 0, "2026-11-03").xu, 0);
});
t("upgrade: ô đã cấp 3 -> 409; slot ngoài 0..4 hoặc rác -> 400", () => {
  assert.strictEqual(status(() => I.upgrade({ slots: { 1: full(3) }, unlocked: 2, current: 1 }, 1e6, 0, "2026-11-03")), 409);
  for (const bad of [-1, 5, 9, NaN, undefined, "x"]) assert.strictEqual(status(() => I.upgrade(I.newState(), 1e6, bad, "2026-11-03")), 400, String(bad));
});
t("hoàn chỉnh đảo: đủ 5 ô cấp 3 -> mở đảo kế, tạo sẵn 5 ô trống, ghi ngày hoàn thành", () => {
  let s = I.newState(), xu = 1e6, last;
  for (let round = 0; round < 3; round++)
    for (let slot = 0; slot < 5; slot++) { last = I.upgrade(s, xu, slot, "2026-11-03"); s = last.state; xu = last.xu; }
  assert.strictEqual(last.completed, true);
  assert.strictEqual(last.completedIsland, 1);
  assert.deepStrictEqual([s.unlocked, s.current], [2, 1]);
  assert.deepStrictEqual(s.slots[2], full(0));
  assert.strictEqual(s.completedAt["1"], "2026-11-03");
  assert.strictEqual(xu, 1e6 - 425);
  assert.strictEqual(I.doneCount(s.slots), 1);
});
t("slotName/slotIcon: ô 0 là Nhà, ô 1 là Cây, ô 2..4 theo chủ đề của đảo", () => {
  assert.strictEqual(I.slotName(1, 0), "Nhà");
  assert.strictEqual(I.slotName(1, 1), "Cây");
  assert.strictEqual(I.slotName(1, 2), "Cổng torii");
  assert.strictEqual(I.slotName(2, 4), "Lò sưởi ngoài trời");
  assert.strictEqual(I.slotIcon(1, 3), "🎏");
});
t("travel: chỉ đảo đã mở; đảo cũ giữ nguyên tiến độ", () => {
  const s = { current: 1, unlocked: 2, slots: { 1: full(3), 2: [1, 0, 0, 0, 0] } };
  assert.strictEqual(status(() => I.travel(s, 3).state), 409);
  const r = I.travel(s, 2);
  assert.deepStrictEqual([r.state.current, r.state.slots[1], r.state.slots[2]], [2, full(3), [1, 0, 0, 0, 0]]);
  assert.strictEqual(status(() => I.travel(s, 0)), 400);
});
t("seenFor: 3 thú lúc đầu, +1 mỗi đảo hoàn chỉnh, trần 6", () => {
  assert.strictEqual(I.seenFor({ 1: full(0) }), 3);
  assert.strictEqual(I.seenFor({ 1: full(3), 2: full(3), 3: full(3), 4: full(3) }), 6);
  assert.strictEqual(I.seenFor({ 1: full(3), 2: full(3), 3: full(3), 4: full(3), 5: full(3) }), 6);
});
t("adopt: đúng giá niêm yết, tên để trống thì server vẫn hợp lệ, tên >20 ký tự -> 400", () => {
  const r = I.adopt(1000, "cat-tabby", "Bơ");
  assert.deepStrictEqual([r.price, r.xu, r.breed, r.name, r.satiety, r.mood], [40, 960, "cat-tabby", "Bơ", 70, 70]);
  assert.strictEqual(I.adopt(1000, "dog-husky", "").xu, 700);
  assert.strictEqual(status(() => I.adopt(1000, "dragon", "R")), 400);
  assert.strictEqual(status(() => I.adopt(1000, "cat-tabby", "A".repeat(21))), 400);
});
t("adopt: thiếu xu -> 409 nêu số còn thiếu, không trừ gì", () => {
  assert.strictEqual(status(() => I.adopt(39, "cat-tabby", "Bơ")), 409);
  assert.ok(/còn thiếu 1/.test(errOf(() => I.adopt(39, "cat-tabby", "Bơ"))));
});
t("buyFood: giá × số lượng, kho cộng đúng, số lượng ngoài 1..99 -> 400", () => {
  const r = I.buyFood(100, "ca", 5);
  assert.deepStrictEqual([r.cost, r.xu, r.qty], [40, 60, 5]);
  for (const q of [0, -1, 100, NaN, undefined]) assert.strictEqual(status(() => I.buyFood(1e6, "ca", q)), 400, String(q));
  assert.strictEqual(status(() => I.buyFood(1e6, "poison", 1)), 400);
});
t("feed: trừ một phần ăn trong kho, KHÔNG trừ xu, +25 no +6 vui +thân thiết theo loại", () => {
  const pet = { id: 1, name: "Bơ", day: "2026-11-03", meals: 0, cares: 0, satiety: 50, mood: 50, friendXp: 0 };
  const r = I.feed(pet, { ca: 2 }, "ca", "2026-11-03");
  assert.deepStrictEqual([r.pantry.ca, r.pet.meals, r.pet.satiety, r.pet.mood, r.pet.friendXp, r.gain], [1, 1, 75, 56, 5, 5]);
});
t("feed: bữa thứ 4 trong ngày -> 409; kho hết -> 409; đổi ngày thì bộ đếm về 0", () => {
  const p = { name: "Bơ", day: "2026-11-03", meals: 3, cares: 0, satiety: 40, mood: 40, friendXp: 0 };
  assert.strictEqual(status(() => I.feed(p, { khat: 9 }, "khat", "2026-11-03")), 409);
  assert.strictEqual(status(() => I.feed({ ...p, meals: 0 }, { khat: 0 }, "khat", "2026-11-03")), 409);
  assert.strictEqual(I.feed({ ...p, meals: 0 }, { khat: 1 }, "khat", "2026-11-04").pet.meals, 1);
});
t("care: miễn phí, +1 thân thiết, chơi bóng +8 vui / vuốt ve +5 vui, trần 5 lần/ngày", () => {
  const p = { name: "Mì", day: "2026-11-03", meals: 0, cares: 4, satiety: 60, mood: 60, friendXp: 19 };
  assert.strictEqual(I.care(p, "play", "2026-11-03").pet.mood, 68);
  assert.strictEqual(I.care(p, "pet", "2026-11-03").level, 2);
  assert.strictEqual(status(() => I.care({ ...p, cares: 5 }, "pet", "2026-11-03")), 409);
  assert.strictEqual(status(() => I.care(p, "whip", "2026-11-03")), 400);
});
t("thân thiết chỉ tăng: ngưỡng 0/20/50/.../1500 -> cấp 1..10", () => {
  assert.deepStrictEqual(I.CONFIG.friendXp.map(I.friendLv), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(I.friendLv(1e9), 10);
});
t("decay: sàn 30 cho No và Vui, nghỉ 9000 giờ vẫn đúng 30/30", () => {
  const ts = 9000 * 3600000;
  const p = { satiety: 70, mood: 70, updatedAt: 1 };
  assert.deepStrictEqual([Math.round(I.decay(p, ts).satiety), Math.round(I.decay(p, ts).mood)], [30, 30]);
  assert.strictEqual(Math.round(I.decay({ satiety: 70, mood: 70, updatedAt: ts - 2 * 3600000 }, ts).satiety), 67);
});
t("stateView: số dư/thu nhập/cấp đảo đúng và không có đường nào làm giảm xu", () => {
  const v = I.stateView({
    today: "2026-11-03", balance: 500, income: { lesson: 40, game: 4 },
    left: { lesson: 20 }, state: { current: 1, unlocked: 1, slots: { 1: [1, 1, 0, 0, 0] } },
    pets: [{ id: 7, breed: "cat-tabby", name: "Bơ", friendXp: 25, satiety: 80, mood: 80, day: "2026-11-02", meals: 3, cares: 5, updatedAt: new Date("2026-11-03T00:00:00Z") }],
    pantry: { ca: 2 },
  });
  assert.deepStrictEqual([v.xu, v.island.current, v.island.cost, v.island.factor], [500, 1, 425, 1]);
  assert.deepStrictEqual(v.island.slots[1], [1, 1, 0, 0, 0]);
  assert.deepStrictEqual([v.pets[0].meals, v.pets[0].cares], [0, 0]); // đổi ngày -> bộ đếm về 0
  assert.strictEqual(v.pets[0].level, 2); // 25 XP -> qua ngưỡng 20, chưa tới 50
  assert.strictEqual(v.pantry.ca, 2);
  assert.strictEqual(v.catalog.breeds.length, 12);
  assert.strictEqual(v.catalog.themes.length, 8);
});

t("stateView: upCost + bản đồ quần đảo để giao diện không phải tự tính giá", () => {
  const v = I.stateView({
    today: "2026-11-03", balance: 900,
    state: { current: 2, unlocked: 3, slots: { 1: [3, 3, 3, 3, 3], 2: [1, 0, 0, 0, 0] } },
  });
  assert.deepStrictEqual(v.island.upCost, [I.costOf(2, 1)].concat(new Array(4).fill(I.costOf(2, 0))));
  assert.strictEqual(v.island.upCost[0] > I.costOf(1, 1), true, "ô đảo 2 đắt hơn ô cùng cấp ở đảo 1");
  assert.deepStrictEqual(v.island.map.map((m) => [m.index, m.locked, m.done]), [[1, false, true], [2, false, false], [3, false, false], [4, true, false], [5, true, false]]);
  assert.strictEqual(v.island.map[3].cost, I.islandCost(4));
  assert.strictEqual(v.island.done, 1);
  assert.strictEqual(v.island.seen, 4, "một đảo hoàn chỉnh -> thêm một chỗ thú");
  const w = I.stateView({ today: "2026-11-03", balance: 0, state: { current: 1, unlocked: 1, slots: { 1: [3, 2, 0, 0, 0] } } });
  assert.deepStrictEqual(w.island.upCost, [null, I.costOf(1, 2), I.costOf(1, 0), I.costOf(1, 0), I.costOf(1, 0)], "ô tối đa báo null để giao diện tắt nút");
});

console.log(`\nisland-core: ${pass}/${pass + fail} mục đạt${fail ? " — CÓ MỤC HỎNG" : ""}`);
process.exit(fail ? 1 : 0);
