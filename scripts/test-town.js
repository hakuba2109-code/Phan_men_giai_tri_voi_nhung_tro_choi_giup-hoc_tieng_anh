"use strict";
/* Kiểm thử lõi Thú ảo + Thị trấn (không mạng, không CSDL).  node scripts/test-town.js */
const assert = require("assert");
const T = require("../src/town-core");
const C = T.CONFIG;
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", e.message.split("\n")[0]); } };
const H = (d, h = 9) => Date.parse(`${d}T${String(h).padStart(2, "0")}:00:00+07:00`); // giờ Việt Nam
let nid = 1;
const A = (d, qid, correct, h = 9, topic = "Thì") => ({ id: nid++, ts: H(d, h), qid, topic, correct });
const run = (list, st = null, mem = {}) => T.applyAttempts(st, mem, list);

t("dayKey tính theo múi giờ Việt Nam, không theo UTC", () => {
  assert.strictEqual(T.dayKey(Date.parse("2026-10-31T16:59:00Z")), "2026-10-31");
  assert.strictEqual(T.dayKey(Date.parse("2026-10-31T17:01:00Z")), "2026-11-01");
});
t("addDays và isoWeekKey (qua ranh giới năm)", () => {
  assert.strictEqual(T.addDays("2026-02-28", 1), "2026-03-01");
  assert.strictEqual(T.isoWeekKey("2025-12-29"), "2026-W01");
  assert.strictEqual(T.isoWeekKey("2027-01-03"), "2026-W53");
  assert.strictEqual(T.isoWeekKey("2026-10-31"), "2026-W44");
});
t("câu mới đúng +3, câu mới sai +0 (sai KHÔNG bị trừ gì)", () => {
  assert.strictEqual(run([A("2026-10-30", "a", true)]).xp, C.base.new);
  const r = run([A("2026-10-30", "a", false)]);
  assert.strictEqual(r.xp, 0); assert.deepStrictEqual(r.byTopic, {});
});
t("sửa câu từng sai +4 (thưởng cao nhất)", () => {
  const r = run([A("2026-10-29", "a", false), A("2026-10-30", "a", true)]);
  assert.strictEqual(r.ledger[0].kind, "fixed"); assert.strictEqual(r.ledger[0].amount, 4);
});
t("ôn đúng hẹn Leitner +2, lặp quá sớm chỉ +1", () => {
  // đúng hôm 29 (bậc 1 -> hẹn 1 ngày): hôm 30 đã đến hạn
  const due = run([A("2026-10-29", "a", true), A("2026-10-30", "a", true)]);
  assert.deepStrictEqual(due.ledger.map((l) => l.kind), ["new", "review"]);
  // đúng liền 3 lần cách nhau 1 ngày: bậc 3 -> hẹn 7 ngày; lần 4 sau 1 ngày là "early"
  const early = run([A("2026-10-26", "a", true), A("2026-10-27", "a", true), A("2026-10-28", "a", true), A("2026-10-29", "a", true)]);
  assert.strictEqual(early.ledger[3].kind, "early"); assert.strictEqual(early.ledger[3].amount, 1);
});
t("chống cày: cùng một câu chỉ trả thưởng MỘT lần mỗi ngày", () => {
  const list = Array.from({ length: 50 }, (_, i) => A("2026-10-30", "a", true, 9 + (i % 10)));
  assert.strictEqual(run(list).xp, C.base.new);
});
t("trần mỗi ngày: không bao giờ vượt dailyCap, ngày sau được trả lại bình thường", () => {
  const day1 = Array.from({ length: 100 }, (_, i) => A("2026-10-30", "q" + i, true));
  const r1 = run(day1);
  assert.strictEqual(r1.xp, C.dailyCap);
  assert.strictEqual(r1.state.earned, C.dailyCap);
  const r2 = T.applyAttempts(r1.state, r1.memory, [A("2026-10-31", "q1", true), A("2026-10-31", "z1", true)], undefined);
  assert.ok(r2.xp > 0, "sang ngày mới phải nhận lại");
});
t("chia lô: chạy một lần = chạy hai lần nối tiếp (đồng bộ tăng dần phía server)", () => {
  const list = [];
  for (let d = 20; d <= 31; d++) for (let i = 0; i < 30; i++) list.push(A(`2026-10-${d}`, "q" + ((d * 7 + i) % 40), (d + i) % 3 !== 0, 8 + (i % 12), i % 2 ? "Thì" : "Giới từ"));
  list.sort((x, y) => x.ts - y.ts || x.id - y.id); // server đọc attempts theo id tăng dần ~ thời gian tăng dần
  const whole = run(list);
  const cut = 170;
  const a = T.applyAttempts(null, {}, list.slice(0, cut));
  const b = T.applyAttempts(a.state, a.memory, list.slice(cut));
  assert.deepStrictEqual(a.ledger.concat(b.ledger), whole.ledger);
  assert.strictEqual(a.xp + b.xp, whole.xp);
});
t("tính chất: thưởng luôn >= 0 và mỗi ngày không vượt trần (3000 lượt ngẫu nhiên)", () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const list = [];
  for (let i = 0; i < 3000; i++) list.push(A(`2026-10-${String(1 + Math.floor(rnd() * 30)).padStart(2, "0")}`, "q" + Math.floor(rnd() * 80), rnd() < 0.7, Math.floor(rnd() * 20)));
  const r = run(list);
  const perDay = {};
  for (const l of r.ledger) { assert.ok(l.amount > 0); perDay[l.day] = (perDay[l.day] || 0) + l.amount; }
  for (const d of Object.keys(perDay)) assert.ok(perDay[d] <= C.dailyCap, d + " " + perDay[d]);
});
t("stageOf: ngưỡng giai đoạn và tiến độ tới giai đoạn kế", () => {
  assert.strictEqual(T.stageOf(0).stage, 0);
  assert.strictEqual(T.stageOf(119).stage, 0);
  assert.strictEqual(T.stageOf(120).stage, 1);
  assert.strictEqual(T.stageOf(1800).stage, 4);
  assert.strictEqual(T.stageOf(99999).next, null);
  assert.deepStrictEqual(T.stageOf(200), { stage: 1, next: 400, into: 80, span: 280 });
});
const S = (...d) => new Set(d);
t("hunger: học hôm nay = no; hôm qua = ổn; người mới không bao giờ đói", () => {
  assert.strictEqual(T.hunger(S("2026-10-31"), "2026-10-31").state, "fed");
  assert.strictEqual(T.hunger(S("2026-10-30"), "2026-10-31").state, "ok");
  assert.strictEqual(T.hunger(S(), "2026-10-31").state, "new");
});
t("hunger: mỗi tuần được bỏ 2 ngày không đói; sang ngày thứ 3 trong tuần mới đói", () => {
  // học Thứ Hai 26/10; hôm nay Thứ Năm 29/10 -> bỏ 27, 28 (2 ngày) -> vẫn ổn
  assert.strictEqual(T.hunger(S("2026-10-26"), "2026-10-29").state, "ok");
  // hôm nay Thứ Sáu 30/10 -> bỏ 27, 28, 29 (3 ngày), được miễn 2 -> missed = 1 -> hơi đói
  const h = T.hunger(S("2026-10-26"), "2026-10-30");
  assert.strictEqual(h.state, "hungry"); assert.strictEqual(h.missed, 1);
});
t("hunger: bỏ lâu -> rất đói rồi NGỦ ĐÔNG (không chết, không mất gì)", () => {
  // học Thứ Năm 1/10. Bỏ 2/10, 3/10 (miễn, tuần 40), 4/10 là ngày bỏ lỡ đầu tiên
  assert.strictEqual(T.hunger(S("2026-10-01"), "2026-10-05").state, "hungry");
  assert.strictEqual(T.hunger(S("2026-10-01"), "2026-10-09").state, "very_hungry"); // 3 ngày bỏ lỡ
  assert.strictEqual(T.hunger(S("2026-10-01"), "2026-10-14").state, "very_hungry"); // 6 ngày
  assert.strictEqual(T.hunger(S("2026-10-01"), "2026-10-15").state, "hibernating"); // 7 ngày -> ngủ đông
  const long = T.hunger(S("2026-01-01"), "2026-10-31");
  assert.strictEqual(long.state, "hibernating");
  assert.ok(long.missed > 100);
});
t("hunger: chế độ nghỉ giữ thú ngủ yên, hết nghỉ thì các ngày đó vẫn được miễn", () => {
  assert.strictEqual(T.hunger(S("2026-10-01"), "2026-10-20", { restUntil: "2026-10-25" }).state, "resting");
  const after = T.hunger(S("2026-10-01"), "2026-10-27", { restUntil: "2026-10-25" });
  assert.ok(after.missed <= 2, "chỉ còn tính 26/10: " + JSON.stringify(after));
});
t("hunger: học lại thì trở về 'no' ngay, bất kể bỏ bao lâu", () => {
  assert.strictEqual(T.hunger(S("2026-01-01", "2026-10-31"), "2026-10-31").state, "fed");
});
t("build: trừ xu vào ví chung, lên một cấp, không âm", () => {
  const r = T.build({}, 120, "Thì", 0);
  assert.strictEqual(r.xu, 100); assert.strictEqual(r.cost, 20); assert.strictEqual(r.level, 1);
  assert.deepStrictEqual(r.plots["Thì"], [1, 0, 0, 0]);
});
t("build: thiếu xu / quá cấp / ô sai", () => {
  assert.throws(() => T.build({}, 19, "Thì", 0), /Cần 20 xu, bạn đang có 19\./);
  assert.throws(() => T.build({ "Thì": [3, 0, 0, 0] }, 9999, "Thì", 0), /cấp tối đa/);
  assert.throws(() => T.build({}, 99, "Thì", 4), /không hợp lệ/);
  assert.throws(() => T.build({}, -5, "Thì", 0), /Cần 20 xu, bạn đang có 0\./, "số dư âm được coi là 0");
});
t("build không sửa đối tượng truyền vào; hoàn thiện một khu = 680 xu", () => {
  const plots = {};
  let p = plots, x = 680;
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const r = T.build(p, x, "Thì", i); p = r.plots; x = r.xu; }
  assert.deepStrictEqual(plots, {});
  assert.strictEqual(x, 0); assert.ok(T.districtDone(p, "Thì"));
});
/* ---------- vườn hoa + cho thú ăn ---------- */
const G = C.garden, DAY = "2026-11-01", NEXT = "2026-11-02", F = G.flowers[0].id;
const grow = (g, slot, from = DAY) => { let x = g; for (let k = 1; k <= G.waterings; k++) x = T.water(x, slot, T.addDays(from, k)).garden; return x; };

t("vườn: plant trừ đúng seedCost xu, chỉ chiếm một ô, không gắn với khu nào", () => {
  const r = T.plant(T.emptyGarden(), 40, 2, F, DAY);
  assert.strictEqual(r.cost, G.seedCost);
  assert.strictEqual(r.xu, 40 - G.seedCost);
  assert.deepStrictEqual(r.garden.beds[2], { flower: F, watered: 0, lastWater: null, plantedDay: DAY });
  assert.strictEqual(r.garden.beds[0], null);
  assert.deepStrictEqual(T.emptyGarden().beds.length, G.beds);
});
t("vườn: thiếu xu 409 · ô đã có cây 409 · ô sai 400 · hoa sai 400", () => {
  const g0 = T.emptyGarden();
  assert.throws(() => T.plant(g0, G.seedCost - 1, 0, F, DAY), (e) => e.status === 409);
  const g1 = T.plant(g0, 50, 0, F, DAY).garden;
  assert.throws(() => T.plant(g1, 50, 0, F, DAY), /đã có cây/);
  assert.throws(() => T.plant(g1, 50, G.beds, F, DAY), /không hợp lệ/);
  assert.throws(() => T.plant(g1, 50, 1, "hoa-gia", DAY), /Loài hoa/);
});
t("vườn: tưới KHÔNG trừ xu, tối đa một lần/ngày/ô, đủ waterings thì nở", () => {
  const p = T.plant(T.emptyGarden(), 15, 0, F, DAY);
  const w1 = T.water(p.garden, 0, DAY);
  assert.strictEqual(w1.garden.beds[0].watered, 1); assert.strictEqual(w1.bloomed, false);
  assert.throws(() => T.water(w1.garden, 0, DAY), /đã tưới/);
  const w2 = T.water(w1.garden, 0, NEXT);
  assert.strictEqual(w2.garden.beds[0].watered, G.waterings); assert.strictEqual(w2.bloomed, true);
  assert.throws(() => T.water(w2.garden, 0, "2026-11-03"), /đã nở/);
  assert.strictEqual(p.xu, 15 - G.seedCost, "tưới không được trừ thêm xu");
});
t("vườn: chưa nở không thu được; nở rồi thu +harvestGain xu, giải phóng ô", () => {
  const p = T.plant(T.emptyGarden(), 15, 0, F, DAY);
  assert.throws(() => T.harvest(p.garden, 15, 0, DAY), /chưa nở/);
  const h = T.harvest(grow(p.garden, 0), 5, 0, T.addDays(DAY, G.waterings));
  assert.strictEqual(h.gain, G.harvestGain);
  assert.strictEqual(h.xu, 5 + G.harvestGain);
  assert.strictEqual(h.garden.beds[0], null);
  assert.deepStrictEqual(h.garden.picked, { [F]: 1 });
});
t("vườn: kịch bản nhiều ô -> một vòng có lãi nhưng thu mỗi ngày không vượt trần dailyGainCap", () => {
  const day = DAY;
  let g = T.emptyGarden(), x = 1000, picked = 0;
  const perDay = {};
  for (let slot = 0; slot < G.beds; slot++) { const p = T.plant(g, x, slot, F, day); g = p.garden; x = p.xu; }
  for (let k = 1; k <= G.waterings; k++) for (let slot = 0; slot < G.beds; slot++) g = T.water(g, slot, T.addDays(day, k)).garden;
  const d2 = T.addDays(day, G.waterings);
  const start = x;
  for (let slot = 0; slot < G.beds; slot++) {
    const left = G.dailyGainCap - (perDay[d2] || 0);
    if (left < G.harvestGain) { assert.throws(() => T.harvest(g, x, slot, d2), /chưa đủ/); assert.ok(g.beds[slot], "cây vẫn nguyên khi từ chối thu"); continue; }
    const h = T.harvest(g, x, slot, d2); g = h.garden; x = h.xu; picked++;
    perDay[d2] = (perDay[d2] || 0) + h.gain;
  }
  assert.ok(picked >= 1 && picked * G.harvestGain <= G.dailyGainCap, "số thu trong ngày: " + picked);
  assert.strictEqual(x - start, picked * G.harvestGain);
});
t("vườn: plant/harvest không sửa đối tượng truyền vào", () => {
  const p = T.plant(T.emptyGarden(), 40, 0, F, DAY);
  assert.strictEqual(p.xu, 40 - G.seedCost);
  const w = T.water(p.garden, 0, DAY);
  assert.strictEqual(p.garden.beds[0].watered, 0, "garden cũ phải còn nguyên");
});
t("vườn: gardenView nói đúng giai đoạn và việc làm được hôm nay", () => {
  const p = T.plant(T.emptyGarden(), 40, 1, F, DAY).garden;
  const v0 = T.gardenView(p, DAY)[1];
  assert.deepStrictEqual([v0.stage, v0.canWater, v0.mature], [0, true, false]);
  assert.strictEqual(v0.stageName, T.GARDEN_STAGES[0]);
  const w = T.water(p, 1, DAY).garden, v1 = T.gardenView(w, DAY)[1];
  assert.strictEqual(v1.canWater, false, "tưới rồi thì hôm nay không tưới lại");
  const v2 = T.gardenView(T.water(w, 1, NEXT).garden, NEXT)[1];
  assert.deepStrictEqual([v2.mature, v2.canWater], [true, false]);
  assert.strictEqual(T.gardenView(w, DAY)[0].empty, true);
});
t("cho ăn: miễn phí, mỗi loài một lần/ngày, không đổi xu, không đổi XP", () => {
  let tr = {};
  for (const sp of ["cho", "meo", "rong"]) {
    const r = T.feed(tr, sp, DAY);
    tr = r.treats; assert.ok(r.line && r.line.length > 10);
  }
  assert.deepStrictEqual(tr.given, ["cho", "meo", "rong"]);
  assert.throws(() => T.feed(tr, "cho", DAY), /đã được cho ăn hôm nay/);
  assert.throws(() => T.feed(tr, "khung-long", DAY), /Loài thú không hợp lệ/);
  const sang = T.feed(tr, "cho", NEXT);
  assert.deepStrictEqual(sang.treats, { day: NEXT, given: ["cho"] }, "sang ngày mới cho ăn lại được");
});
t("cho ăn: PETS phủ đủ mọi loài SPECIES của backend, ai cũng có tên + emoji + lời", () => {
  for (const sp of ["rong", "cu", "cao", "cho", "meo"]) {
    assert.ok(T.PETS[sp] && T.PETS[sp].name && T.PETS[sp].emoji, sp);
    assert.ok(T.FEED_LINES[sp], "thiếu lời khi cho " + sp + " ăn");
  }
});
/* ---------- luật kinh tế xu (một ví duy nhất) ---------- */
const X = C.xu;
t("xu: bài học và trò chơi có trần riêng, phần thưởng game cố định theo loại/hạng", () => {
  assert.strictEqual(T.gameReward("duck"), X.game.duck);
  assert.strictEqual(T.gameReward("skill"), X.game.skill);
  assert.deepStrictEqual(T.gameReward("maze", 0), 15);
  assert.deepStrictEqual([T.gameReward("maze", 1), T.gameReward("maze", 2)], [10, 6]);
  assert.strictEqual(T.gameReward("maze", 5), 0, "hạng lạ -> không thưởng");
  assert.strictEqual(T.gameReward("cheat"), 0, "trò lạ -> không thưởng");
  assert.strictEqual(T.room(X.game.cap, X.game.cap), 0);
  assert.strictEqual(T.room(X.game.cap, X.game.cap - 4), 4);
  assert.strictEqual(T.room(X.game.cap, 999), 0, "đã vượt trần thì còn 0, không âm");
  assert.strictEqual(X.game.cap, 30, "trần cả nhà trò chơi");
  assert.deepStrictEqual(X.game.rounds, { duck: 3, skill: 2, maze: 2 }, "hạn ván ghi theo từng mã");
  assert.strictEqual(T.roundLimit("duck"), 3);
  assert.strictEqual(T.roundLimit("skill:bong"), X.game.roundsPerDay, "mã không liệt kê -> mức chung của nhà");
  assert.strictEqual(T.roundLimit("constructor"), X.game.roundsPerDay, "mã lạ không lấy được thuộc tính của object");
  assert.strictEqual(T.gameKeyOf("skill:bong:rk3f9"), "skill:bong", "mỗi trò kỹ năng một hạn riêng");
  assert.strictEqual(T.gameKeyOf("skill:rk3f9"), "skill", "ván đường cũ (không gửi mã trò) vẫn chung một hạn");
  assert.strictEqual(T.gameKeyOf("maze:7:2:abc"), "maze", "ref mê cung nhiều dấu vẫn là một mã");
  assert.strictEqual(T.gameKeyOf("duck:rk3f9"), "duck");
});
t("xu: nộp file = 25 + 1 xu cho mỗi đủ 20 câu, trần perFile, file rỗng không thưởng", () => {
  assert.strictEqual(T.fileGain(0), 0);
  assert.strictEqual(T.fileGain(-3), 0);
  assert.deepStrictEqual([1, 20, 39, 40].map(T.fileGain), [25, 26, 26, 27]);
  assert.strictEqual(T.fileGain(100000), X.file.perFile);
});
t("xu: ba nhóm mới (học thêm · ôn từ · từ mới) có đơn giá và trần riêng", () => {
  assert.deepStrictEqual(X.extra, { perAttempt: 1, cap: 20 });
  assert.deepStrictEqual(X.words, { perCard: 1, cap: 15 });
  assert.deepStrictEqual(X.wordnew, { perWord: 2, cap: 6 });
  assert.strictEqual(T.room(X.extra.cap, 20), 0, "trần 20 xu học thêm/ngày");
  const tat = [C.dailyCap, X.extra.cap, X.game.cap, X.words.cap, X.wordnew.cap, X.login.gift].reduce((s, n) => s + n, 0);
  assert.strictEqual(tat, 136, "tổng trần cày được mỗi ngày = 136 xu (85 xu cũ + 51 xu ba nhóm mới; chưa tính file, vườn, quà chuỗi)");
});
t("xu: chuỗi ngày học — hôm nay chưa học thì chưa gãy, nghỉ 2 ngày mới về 0", () => {
  const D = (...d) => new Set(d);
  assert.strictEqual(T.streakOf(D(), "2026-11-02"), 0);
  assert.strictEqual(T.streakOf(D("2026-10-31", "2026-11-01", "2026-11-02"), "2026-11-02"), 3);
  assert.strictEqual(T.streakOf(D("2026-10-31", "2026-11-01"), "2026-11-02"), 2, "hôm nay chưa học vẫn giữ chuỗi");
  assert.strictEqual(T.streakOf(D("2026-10-30", "2026-10-31", "2026-11-01"), "2026-11-02"), 3, "30/10 -> 1/11 là chuỗi 3, hôm nay chưa học vẫn giữ");
  assert.strictEqual(T.streakOf(D("2026-10-29", "2026-10-30"), "2026-11-02"), 0, "nghỉ hôm 01 và 02 -> gãy");
  assert.strictEqual(T.streakOf(D("2026-11-03", "2026-11-04"), "2026-11-02"), 0, "ngày tương lai không tính");
});
t("xu: quà mốc chuỗi chỉ nhận một lần, mốc kế tiếp luôn hiện ra", () => {
  const p0 = T.streakPending(0, []);
  assert.deepStrictEqual([p0.length, p0.due, p0.next], [0, [], { days: 3, gift: 15 }]);
  const p8 = T.streakPending(8, [3]);
  assert.deepStrictEqual(p8.due, [{ days: 7, gift: 30 }]);
  assert.deepStrictEqual(p8.next, { days: 14, gift: 60 });
  assert.deepStrictEqual(T.streakPending(100, [3, 7, 14, 30, 50, 100]).due, [], "đã lãnh hết thì không còn gì");
  const p200 = T.streakPending(200, [3, 7, 14, 30, 50, 100]);
  assert.deepStrictEqual(p200.due, [{ days: 200, gift: 400 }], "mốc 200 ngày mới");
  assert.deepStrictEqual(p200.next, { days: 365, gift: 800 }, "mốc kế tiếp là 365");
  const tong = X.streak.reduce((s, m) => s + m[1], 0);
  assert.strictEqual(tong, 1975, "tổng quà chuỗi tối đa");
  assert.deepStrictEqual(X.streak.map((m) => m[0]), [3, 7, 14, 30, 50, 100, 200, 365]);
});
t("xu: stateView đưa đúng một ví, khu không còn vật liệu riêng", () => {
  const v = T.stateView({
    today: DAY, xu: 105, xuDay: { lesson: 30, game: 4, extra: 7, words: 3, wordnew: 2, rounds: { duck: 1 } },
    gifts: { loginDay: DAY, streakGranted: [] }, given: [], plots: { "Thì": [1, 0, 0, 0] }, xp: 100,
    dayState: { day: DAY, earned: 30, paid: [] }, garden: null, treats: {}, pet: null,
    studyDays: S("2026-10-31", DAY), todayAttempts: 12, topics: ["Thì"], agg: { "Thì": { earned: 40, lastStudy: DAY } },
  });
  assert.strictEqual(v.xu.balance, 105);
  assert.deepStrictEqual([v.xu.left.lesson, v.xu.left.game], [C.dailyCap - 30, X.game.cap - 4]);
  assert.deepStrictEqual(
    [v.xu.left.extra, v.xu.left.words, v.xu.left.wordnew],
    [X.extra.cap - 7, X.words.cap - 3, X.wordnew.cap - 2],
    "ba nhóm mới cũng có phần còn lại"
  );
  assert.deepStrictEqual(v.xu.caps, {
    lesson: C.dailyCap, extra: X.extra.cap, game: X.game.cap, words: X.words.cap, wordnew: X.wordnew.cap, file: X.file.cap,
  });
  assert.strictEqual(v.xu.rewards, X, "giao diện đọc cấu hình từ ĐÚNG MỘT chỗ");
  assert.deepStrictEqual(v.xu.prices.build, C.buildCost);
  assert.strictEqual(v.xu.gift.loginToday, true);
  assert.strictEqual(v.xu.gift.length, 2, "31/10 + 1/11 là chuỗi 2 ngày");
  assert.strictEqual(v.districts[0].materials, undefined, "khu không còn ví riêng");
  assert.strictEqual(v.districts[0].earned, 40);
});
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
