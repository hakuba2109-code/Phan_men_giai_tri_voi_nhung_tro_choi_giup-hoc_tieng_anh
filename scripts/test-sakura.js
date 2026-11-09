"use strict";
/* Kiểm thử lõi thuần sakura-core.js: không CSDL, không mạng, 0 token.  Chạy:  node scripts/test-sakura.js */
const assert = require("assert");
const S = require("../src/sakura-core");
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", e.message.split("\n")[0]); } };
const status = (fn) => { try { fn(); return 0; } catch (e) { return e.status; } };

t("stageOf: ranh giới 0/26/27/99/100/249/250/499/500/899/900 và kẹp ngoài miền", () => {
  const idx = (p) => S.stageOf(p).index;
  assert.deepStrictEqual([0, 26, 27, 99, 100, 249, 250, 499, 500, 899, 900].map(idx), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.strictEqual(idx(-5), 0); assert.strictEqual(idx(5000), 5); assert.strictEqual(idx("abc"), 0); assert.strictEqual(idx(NaN), 0);
});
t("stageOf: tên giai đoạn, tiến độ, giai đoạn kế, đã trọn vẹn", () => {
  const a = S.stageOf(60), z = S.stageOf(900);
  assert.deepStrictEqual([a.name, a.next, a.nextAt, a.into, a.span], ["Mầm non", "Cây con", 100, 33, 73]);
  assert.strictEqual(S.stageOf(450).progress, 0.5);
  assert.deepStrictEqual([z.name, z.next, z.span, z.done, z.progress], ["Anh đào cổ thụ", null, null, true, 1]);
});
t("care: tưới = 5 xu +10, bón = 20 xu +50", () => {
  assert.deepStrictEqual(S.care({ coins: 30, points: 0 }, "water"), { coins: 25, points: 10, cost: 5, gained: 10, leveledUp: false, done: false });
  assert.deepStrictEqual(S.care({ coins: 30, points: 0 }, "fertilize"), { coins: 10, points: 50, cost: 20, gained: 50, leveledUp: true, done: false });
});
t("care: thiếu xu -> 409 và thông điệp nêu số còn thiếu; đủ đúng bằng giá thì được (xu về 0)", () => {
  assert.strictEqual(status(() => S.care({ coins: 4, points: 0 }, "water")), 409);
  assert.ok(/cần 5, bạn đang có 4/.test((() => { try { S.care({ coins: 4, points: 0 }, "water") } catch (e) { return e.message } })()));
  assert.strictEqual(S.care({ coins: 5, points: 0 }, "water").coins, 0);
});
t("care: hành động lạ -> 400 (kể cả 'constructor', '__proto__', số, null, mảng)", () => {
  for (const a of ["", "pray", "constructor", "__proto__", "toString", 5, null, undefined, ["water"], { a: 1 }])
    assert.strictEqual(status(() => S.care({ coins: 99, points: 0 }, a)), 400, String(a));
});
t("care: cây đã trọn vẹn -> 409, không trừ xu", () => {
  assert.strictEqual(status(() => S.care({ coins: 99, points: 900 }, "water")), 409);
});
t("care: gần đầy cây chỉ tính tiền phần điểm còn thiếu (895: bón +5 giá 2 xu; 899: tưới +1 giá 1 xu)", () => {
  assert.deepStrictEqual(S.care({ coins: 50, points: 895 }, "fertilize"), { coins: 48, points: 900, cost: 2, gained: 5, leveledUp: true, done: true });
  assert.deepStrictEqual(S.care({ coins: 5, points: 899 }, "water"), { coins: 4, points: 900, cost: 1, gained: 1, leveledUp: true, done: true });
  assert.strictEqual(status(() => S.care({ coins: 0, points: 899 }, "water")), 409); // hết xu thì vẫn 409
});
t("care: leveledUp đúng tại ngưỡng (26 +10 -> 36 lên Mầm non; 36 +10 không lên)", () => {
  assert.strictEqual(S.care({ coins: 9, points: 26 }, "water").leveledUp, true);
  assert.strictEqual(S.care({ coins: 9, points: 36 }, "water").leveledUp, false);
});
t("care: không sửa đối tượng truyền vào; điểm không bao giờ vượt 900, xu không bao giờ âm", () => {
  const s = Object.freeze({ coins: 40, points: 880 });
  const r = S.care(s, "fertilize");
  assert.deepStrictEqual(s, { coins: 40, points: 880 });
  for (let p = 0; p < 900; p += 7) for (const a of ["water", "fertilize"]) {
    const x = S.quote(1000, p, a); assert.ok(x.ok && p + x.gained <= 900 && x.cost >= 1);
  }
  assert.ok(r.points <= 900 && r.coins >= 0);
});
t("Mô phỏng: kiếm đủ trần 60 xu/ngày và chỉ bón phân thì trọn vẹn sau 6 ngày; chỉ tưới thì 8 ngày", () => {
  const run = (a) => { let st = { coins: 0, points: 0 }, d = 0; while (st.points < 900 && d < 100) { d++; st.coins += 60; for (;;) { const q = S.quote(st.coins, st.points, a); if (!q.ok) break; const r = S.care(st, a); st = { coins: r.coins, points: r.points }; } } return d; };
  assert.strictEqual(run("fertilize"), 6); assert.strictEqual(run("water"), 8);
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
