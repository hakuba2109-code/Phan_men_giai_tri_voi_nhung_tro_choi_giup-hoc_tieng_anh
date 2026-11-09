"use strict";
/* Kiểm thử BẢNG XU MỚI ("Xu cho MỌI hoạt động học tập") — luật THUẦN, không CSDL, không mạng, 0 token.
   Chạy:  node scripts/test-xu-moi.js   (nằm trong `npm test`)
   Mọi con số đọc từ CONFIG.xu trong src/town-core.js: sửa giá ở đó thì bộ này vẫn xanh,
   còn sửa số cứng trong test là tự đánh lừa mình. */
const assert = require("assert");
const T = require("../src/town-core");
const C = T.CONFIG, X = C.xu, G = X.game;

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", String(e.message).split("\n")[0]); } };

const H = (d, h = 9) => Date.parse(`${d}T${String(h).padStart(2, "0")}:00:00+07:00`);
let nid = 1;
const A = (d, qid, correct, h = 9, topic = "Thì") => ({ id: nid++, ts: H(d, h), qid, topic, correct });
const run = (list, st = null, mem = {}) => T.applyAttempts(st, mem, list);
const DAY = "2026-11-03";
const many = (n, firstQid = 1000) => Array.from({ length: n }, (_, i) => A(DAY, firstQid + i, true));

/* ================= bảng thưởng (mục 4 của tài liệu) ================= */
t("B1 Nhóm A giữ nguyên: 3/4/2/1 xu, trần 60/ngày, XP thú bằng đúng số xu bài học", () => {
  assert.deepStrictEqual(C.base, { new: 3, fixed: 4, review: 2, early: 1 });
  assert.strictEqual(C.dailyCap, 60, "trần bài học KHÔNG đổi khi thêm các nhóm mới");
});
t("B2 Nhóm B 'học thêm': +1 xu/lượt bị chặn, trần 20/ngày, không cộng XP", () => {
  assert.deepStrictEqual(X.extra, { perAttempt: 1, cap: 20 });
});
t("B3 Nhóm C 'ván': vịt 4 (3 ván) · mỗi trò kỹ năng 3 (2 ván) · mê cung 15/10/6 (2 ván) · trần nhóm 30", () => {
  assert.strictEqual(G.duck, 4); assert.strictEqual(G.skill, 3);
  assert.deepStrictEqual(G.maze, [15, 10, 6]);
  assert.strictEqual(G.cap, 30, "nâng từ 20 lên 30 để ba nhóm trò chơi không ăn của nhau");
  assert.strictEqual(G.rounds.duck, 3, "vịt giảm từ 5 xuống 3 (chốt ở mục 12 câu 3)");
  assert.strictEqual(G.rounds.maze, 2);
  assert.strictEqual(G.roundsPerDay, 2, "mặc định cho mọi mã trò chưa ghi trong rounds");
});
t("B4 Nhóm D 'từ vựng': ôn thẻ +1 (trần 15), lưu từ mới +2 (trần 6)", () => {
  assert.deepStrictEqual(X.words, { perCard: 1, cap: 15 });
  assert.deepStrictEqual(X.wordnew, { perWord: 2, cap: 6 });
});
t("B5 Nhóm E/F/G giữ nguyên: file 25 + ⌊n/20⌋ (≤60/file, ≤60/ngày) · đăng nhập 5 · legacyGame là một cờ", () => {
  assert.deepStrictEqual(X.file, { base: 25, per: 20, perFile: 60, cap: 60 });
  assert.deepStrictEqual(X.login, { gift: 5 });
  assert.strictEqual(typeof X.legacyGame, "boolean", "đường cũ POST /api/xu/game tắt/bật được khi đổi giao diện");
});
t("B6 Trần một ngày của người chạm MỌI nhóm = 136 xu (chưa tính file, vườn, quà chuỗi)", () => {
  const grind = C.dailyCap + X.extra.cap + G.cap + X.words.cap + X.wordnew.cap + X.login.gift;
  assert.strictEqual(grind, 136);
  assert.strictEqual(X.words.cap + X.wordnew.cap, 21, "riêng sổ từ đóng góp 21 xu của 136");
});

/* ================= 'cut' — máy chủ dựa vào đây mà thưởng học thêm ================= */
t("C1 70 câu mới đúng: bài học cắt ở 60, 50 lượt bị chặn hiện trong `cut` (không đoán)", () => {
  const r = run(many(70));
  assert.strictEqual(r.ledger.length, 20, "20 câu đầu ăn hết trần 60");
  assert.strictEqual(r.xp, C.dailyCap, "XP thú chỉ đúng 60, học thêm không cộng XP");
  assert.strictEqual(r.cut.length, 50);
  assert.ok(r.cut.every((c) => c.topic === "Thì" && c.day === T.dayKey(H(DAY))), "mỗi dòng cut có id + ngày để ghi sổ 'attempt:<id>'");
  /* Tài liệu §10 ghi "học thêm 10"; theo luật đã chốt thì 50 lượt × 1 xu = 50, bị trần 20 chặn lại -> 20. */
  assert.strictEqual(Math.min(r.cut.length * X.extra.perAttempt, X.extra.cap), X.extra.cap);
});
t("C2 100 câu: `cut` 80 lượt, ví học thêm dừng đúng 20, 60 lượt thừa không có dòng sổ", () => {
  const r = run(many(100));
  assert.strictEqual(r.cut.length, 80);
  const paid = r.cut.slice(0, X.extra.cap / X.extra.perAttempt).reduce((n) => n + X.extra.perAttempt, 0);
  assert.strictEqual(paid, 20);
});
t("C3 Câu SAI không bao giờ vào `cut` (học thêm chỉ thưởng lượt đúng)", () => {
  const list = many(25).concat(Array.from({ length: 60 }, (_, i) => A(DAY, 5000 + i, false)));
  const r = run(list);
  assert.strictEqual(r.cut.length, 5, "25 câu đúng: 20 vào trần, 5 bị cắt");
  assert.ok(r.cut.every((c) => c.attemptId <= list[24].id), "id trong cut thuộc nhóm câu đúng");
});
t("C4 Trần bài học tính theo NGÀY: hôm nay chạm trần, ngày mai lại có đủ 60", () => {
  const hom = run(many(70, 1000));
  assert.strictEqual(hom.xp, C.dailyCap);
  const mai = run(Array.from({ length: 15 }, (_, i) => A("2026-11-04", 9000 + i, true)), hom.state, hom.memory);
  assert.strictEqual(mai.state.day, "2026-11-04", "sang ngày là ô trần mới, không mượn của hôm qua");
  assert.strictEqual(mai.xp, 15 * C.base.new);
  assert.strictEqual(mai.cut.length, 0, "chưa chạm trần ngày mai nên không có lượt bị cắt");
});

/* ================= khóa ván + hạn riêng từng trò (sửa V2) ================= */
t("D1 gameKeyOf: mỗi trò kỹ năng một bộ đếm, mã ván dài mấy cũng quy về một khóa", () => {
  assert.strictEqual(T.gameKeyOf("duck:r1-abc"), "duck");
  assert.strictEqual(T.gameKeyOf("maze:f1:2:Snapshot"), "maze");
  assert.strictEqual(T.gameKeyOf("skill:bong:r1-abc"), "skill:bong");
  assert.strictEqual(T.gameKeyOf("skill:nap-x:r1-def"), "skill:nap-x");
  assert.strictEqual(T.gameKeyOf("skill:r1-abc"), "skill", "đường cũ (không có mã trò) vẫn chung một bộ đếm");
  assert.strictEqual(T.gameKeyOf(""), "");
});
t("D2 roundLimit: duck 3 · maze 2 · mọi skill:<mã> mặc định 2; tên lạ không lấy từ prototype", () => {
  assert.strictEqual(T.roundLimit("duck"), 3);
  assert.strictEqual(T.roundLimit("maze"), 2);
  assert.strictEqual(T.roundLimit("skill:bong"), G.roundsPerDay);
  assert.strictEqual(T.roundLimit("constructor"), G.roundsPerDay, "key 'constructor' không được trả về hàm");
  assert.strictEqual(T.roundLimit("__proto__"), G.roundsPerDay);
});
t("D3 roundNeed: thường 30 giây + 3 lượt đúng loại; ba trò phân loại nhanh 25 giây + 0 lượt", () => {
  assert.deepStrictEqual(T.roundNeed("duck"), { seconds: 30, evidence: 3, mode: "duck:%", game: "duck", fast: false });
  assert.deepStrictEqual(T.roundNeed("skill:bong"), { seconds: 30, evidence: 3, mode: "skill", game: "skill", fast: false });
  for (const code of G.noEvidence) {
    assert.deepStrictEqual(T.roundNeed(`skill:${code}`),
      { seconds: 25, evidence: 0, mode: "skill", game: "skill", fast: true }, code + " phải dùng ngưỡng nhanh");
  }
  assert.deepStrictEqual(G.noEvidence.slice().sort(), ["classpos", "classtense", "classprep"].sort(),
    "chỉ BA trò Phân loại nhanh là không ghi attempts (Tìm lỗi sai CÓ ghi — đã xác minh ở X0)");
});
t("D4 gameReward: đúng giá từng trò, hạng mê cung ngoài 0..2 hoặc trò lạ đều 0", () => {
  assert.strictEqual(T.gameReward("duck", 0), 4);
  assert.strictEqual(T.gameReward("skill", 0), 3);
  assert.deepStrictEqual([0, 1, 2].map((p) => T.gameReward("maze", p)), [15, 10, 6]);
  assert.strictEqual(T.gameReward("maze", 3), 0);
  assert.strictEqual(T.gameReward("maze", undefined), 0);
  assert.strictEqual(T.gameReward("khong-tons", 0), 0);
});

/* ================= trần nhóm: room() và fileGain ================= */
t("E1 room(): cắt đúng phần còn lại; trần 0 nghĩa là TẮT nhóm (không phải 'không giới hạn')", () => {
  assert.strictEqual(T.room(30, 12), 18);
  assert.strictEqual(T.room(30, 30), 0);
  assert.strictEqual(T.room(30, 45), 0, "dùng quá trần không thành số âm");
  assert.strictEqual(T.room(0, 0), 0, "cap:0 = về hành vi cũ: nhóm đó không còn xu");
  assert.strictEqual(T.room(15, null), 15);
});
t("E2 fileGain(): 25 + ⌊n/20⌋ nhưng trần 60 là CỦA MỘT FILE, không phải của ngày", () => {
  assert.strictEqual(T.fileGain(0), 0);
  assert.strictEqual(T.fileGain(19), 25);
  assert.strictEqual(T.fileGain(100), 30);
  assert.strictEqual(T.fileGain(700), 60);
  assert.strictEqual(T.fileGain(100000), X.file.perFile, "một file khổng lồ cũng chỉ 60");
});

/* ================= chuỗi: thêm mốc 200 và 365 ================= */
t("F1 Chuỗi 8 mốc, tổng quà một đời = 1.975 xu (200→400 và 365→800 nằm trong đó)", () => {
  assert.deepStrictEqual(X.streak.map((m) => m[0]), [3, 7, 14, 30, 50, 100, 200, 365]);
  assert.strictEqual(X.streak.reduce((n, m) => n + m[1], 0), 1975);
  assert.deepStrictEqual(X.streak[X.streak.length - 2], [200, 400]);
  assert.deepStrictEqual(X.streak[X.streak.length - 1], [365, 800]);
});
t("F2 streakPending: mỗi mốc chỉ hứa MỘT lần; đứt chuỗi rồi học lại không nhận lại mốc cũ", () => {
  const fresh = T.streakPending(365, []);
  assert.strictEqual(fresh.due.length, 8); assert.strictEqual(fresh.next, null);
  const gotAll = X.streak.map((m) => m[0]);
  assert.deepStrictEqual(T.streakPending(365, gotAll).due, [], "đã nhận đủ 8 mốc thì không hứa thêm gì");
  const mid = T.streakPending(15, [3, 7]);
  assert.deepStrictEqual(mid.due, [{ days: 14, gift: 60 }], "15 ngày: mốc 3 và 7 đã nhận, còn mốc 14 chờ lãnh");
  assert.deepStrictEqual(mid.next, { days: 30, gift: 120 });
  const broke = T.streakPending(200, [3, 7, 14, 30, 50, 100]);
  assert.deepStrictEqual(broke.due, [{ days: 200, gift: 400 }], "chuỗi đứt không thu hồi, cũng không cho nhận lại mốc cũ");
});

/* ================= giao diện đọc số từ một chỗ ================= */
t("G1 Mọi số tài liệu §4.6 đều có mặt trong CONFIG.xu — UI không tự đặt số cứng", () => {
  for (const k of ["game", "extra", "words", "wordnew", "file", "login", "streak", "legacyGame"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(X, k), "thiếu nhóm " + k);
  }
  for (const k of ["cap", "roundsPerDay", "rounds", "seconds", "secondsFast", "evidence", "ttlHours", "noEvidence"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(G, k), "thiếu game." + k);
  }
  assert.strictEqual(X.words.cap, 15); assert.strictEqual(G.seconds, 30); assert.strictEqual(G.ttlHours, 2);
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
