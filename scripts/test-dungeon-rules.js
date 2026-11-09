"use strict";
const assert = require("assert");
const Core = require("../src/dungeon-core");
const R = require("../src/dungeon-rules");
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("  ✔", n); } catch (e) { fail++; console.log("  ✘", n, "\n     ", e.message.split("\n")[0]); } };
const ids = (n) => Array.from({ length: n }, (_, i) => "q" + (i + 1));
const fresh = (n = 24) => R.newRun({ seed: 11, questionIds: ids(n) });
const firstFloor = (run) => R.floorsOf(run)[0];
const nonBoss = (run) => firstFloor(run).find((q) => !R.isBoss(run, q));

t("newRun từ chối bộ quá nhỏ hoặc id trùng", () => {
  assert.throws(() => R.newRun({ seed: 1, questionIds: ids(5) }), /ít nhất/);
  assert.throws(() => R.newRun({ seed: 1, questionIds: ["a", "a", ...ids(20)] }), /trùng/);
});
t("planFloors: tất định, đủ mọi câu đúng một lần", () => {
  const a = R.planFloors(3, ids(37)), b = R.planFloors(3, ids(37));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a.flat().sort(), ids(37).sort());
});
t("trả lời đúng ngay: hạ quái, +10 EXP, tính vào firstTry", () => {
  const run = fresh(), q = nonBoss(run);
  const { run: r, exp, events } = R.fight(run, q, true);
  assert.strictEqual(exp, 10);
  assert.ok(r.defeated.includes(q) && r.firstTry.includes(q));
  assert.strictEqual(events[0].type, "defeated");
});
t("trùm: đúng nhân đôi EXP, sai mất 2 tim", () => {
  const run = fresh();
  const boss = firstFloor(run).find((q) => R.isBoss(run, q));
  assert.strictEqual(R.fight(run, boss, true).exp, 20);
  assert.strictEqual(R.fight(run, boss, false).run.hearts, 1);
});
t("sai rồi đúng: quái vẫn sống sau lần sai, hạ được ở lần đúng với +5 EXP và KHÔNG tính firstTry", () => {
  const run = fresh(), q = nonBoss(run);
  const a = R.fight(run, q, false);
  assert.ok(!a.run.defeated.includes(q) && a.run.hearts === 2);
  const b = R.fight(a.run, q, true);
  assert.strictEqual(b.exp, 5);
  assert.ok(b.run.defeated.includes(q) && !b.run.firstTry.includes(q));
});
t("sai lần thứ 3 -> Sách giải: quái bị hạ, assisted, không EXP", () => {
  let run = fresh(); const q = nonBoss(run);
  run = R.fight(run, q, false).run;
  run = R.fight(run, q, false).run;
  const last = R.fight(run, q, false);
  assert.ok(last.run.defeated.includes(q) && last.run.assisted.includes(q));
  assert.strictEqual(last.exp, 0);
  assert.ok(last.events.some((e) => e.type === "assisted"));
});
t("hết tim: ngất, hồi đầy tim, đếm deaths, quái đã hạ vẫn chết", () => {
  let run = fresh();
  const [a, b, c] = firstFloor(run).filter((q) => !R.isBoss(run, q));
  run = R.fight(run, a, true).run;
  run = R.fight(run, b, false).run;
  run = R.fight(run, b, false).run;
  const out = R.fight(run, c, false);
  assert.ok(out.events.some((e) => e.type === "knockedOut"));
  assert.strictEqual(out.run.hearts, Core.CONFIG.hearts);
  assert.strictEqual(out.run.deaths, 1);
  assert.ok(out.run.defeated.includes(a));
});
t("khiên chặn một đòn rồi biến mất", () => {
  const run = fresh(); run.items.shield = 1;
  const out = R.fight(run, nonBoss(run), false);
  assert.strictEqual(out.run.hearts, 3); assert.strictEqual(out.run.items.shield, 0);
});
t("dùng gợi ý: đúng chỉ +5 EXP nhưng vẫn là firstTry", () => {
  const run = fresh(), q = nonBoss(run);
  const out = R.fight(run, q, true, { hinted: true });
  assert.strictEqual(out.exp, 5); assert.ok(out.run.firstTry.includes(q));
});
t("không đánh được quái đã hạ, quái tầng khác, câu lạ", () => {
  const run = fresh(), q = nonBoss(run);
  const r = R.fight(run, q, true).run;
  assert.throws(() => R.fight(r, q, true), /đã bị hạ/);
  const other = R.floorsOf(run)[1][0];
  assert.throws(() => R.fight(run, other, true), /không ở tầng/);
  assert.throws(() => R.fight(run, "xxx", true), /không thuộc/);
});
t("xuống tầng chỉ khi sạch quái; hạ hết mọi tầng thì runCompleted và finish được", () => {
  let run = fresh(24);
  assert.throws(() => R.descend(run), /Còn quái/);
  assert.throws(() => R.finish(run), /Chưa hạ hết/);
  const floors = R.floorsOf(run);
  floors.forEach((f, i) => {
    f.forEach((q) => { run = R.fight(run, q, true).run; });
    assert.ok(R.floorCleared(run, i + 1));
    if (i < floors.length - 1) run = R.descend(run);
  });
  assert.ok(R.runCompleted(run));
  const done = R.finish(run);
  assert.strictEqual(done.status, "completed");
  const s = R.summary(done);
  assert.strictEqual(s.total, 24); assert.strictEqual(s.firstTry, 24); assert.strictEqual(s.medal, "gold");
  assert.throws(() => R.fight(done, "q1", true), /đã kết thúc/);
});
t("rương mở một lần, thưởng đúng như chestLoot; bình máu không vượt tim tối đa", () => {
  let run = fresh();
  const o = R.openChest(run, 1, 0);
  assert.deepStrictEqual(o.loot, Core.chestLoot(11, 1, 0));
  assert.throws(() => R.openChest(o.run, 1, 0), /đã mở/);
  assert.throws(() => R.openChest(run, 2, 0), /không ở tầng/);
  run.items.potion = 1;
  assert.throws(() => R.useItem(run, "potion"), /Tim đã đầy/);
  run.hearts = 1;
  assert.strictEqual(R.useItem(run, "potion").hearts, 2);
  assert.throws(() => R.useItem(fresh(), "hint"), /không có/);
});
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
