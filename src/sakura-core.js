"use strict";
/* LÕI THUẦN của Đảo hoa anh đào: không CSDL, không HTTP, không đồng hồ => kiểm thử được, 0 token.
   Xu KIẾM ĐƯỢC tính bằng town-core.js (applyAttempts: 3/4/2/1, trần 60/ngày) — file này chỉ lo phần TIÊU xu để nuôi cây.
   Nguyên tắc: xu và điểm sinh trưởng KHÔNG BAO GIỜ bị trừ ngoài lúc người chơi chủ động tưới/bón; cây không héo. */

const CONFIG = Object.freeze({
  maxPoints: 900, // điểm sinh trưởng tối đa = cây trọn vẹn (phải khớp CHECK trong CSDL/sakura.sql)
  stages: Object.freeze([
    ["Hạt giống", 0], ["Mầm non", 27], ["Cây con", 100], ["Cây trẻ", 250], ["Cây nở hoa", 500], ["Anh đào cổ thụ", 900],
  ]),
  actions: Object.freeze({
    water: Object.freeze({ cost: 5, points: 10 }), // 💧 tưới nước: 2 điểm/xu
    fertilize: Object.freeze({ cost: 20, points: 50 }), // 🌿 bón phân: 2,5 điểm/xu (cần gom đủ xu)
  }),
});

const httpError = (status, message) => Object.assign(new Error(message), { status });
const isAction = (a) => typeof a === "string" && Object.prototype.hasOwnProperty.call(CONFIG.actions, a);
const clampPoints = (p) => Math.max(0, Math.min(CONFIG.maxPoints, Math.floor(Number(p) || 0)));

/* Giai đoạn của cây theo điểm sinh trưởng. progress = points / maxPoints (0..1) là số giao diện 3D dùng để lớn dần. */
function stageOf(points) {
  const p = clampPoints(points);
  let i = 0;
  CONFIG.stages.forEach((s, k) => { if (p >= s[1]) i = k; });
  const cur = CONFIG.stages[i], nxt = CONFIG.stages[i + 1] || null;
  return {
    index: i, name: cur[0],
    next: nxt ? nxt[0] : null, nextAt: nxt ? nxt[1] : null,
    into: p - cur[1], span: nxt ? nxt[1] - cur[1] : null,
    progress: p / CONFIG.maxPoints, done: p >= CONFIG.maxPoints,
  };
}

/* Báo giá một lần chăm: gần đầy cây thì chỉ tính tiền phần điểm còn thiếu (không bao giờ trả tiền cho điểm bị bỏ phí). */
function quote(coins, points, action) {
  if (!isAction(action)) return { ok: false, status: 400, reason: "Hành động chăm cây không hợp lệ." };
  const a = CONFIG.actions[action], p = clampPoints(points);
  if (p >= CONFIG.maxPoints) return { ok: false, status: 409, reason: "Cây đã trọn vẹn rồi, xu của bạn vẫn còn nguyên." };
  const gained = Math.min(a.points, CONFIG.maxPoints - p);
  const cost = Math.ceil((a.cost * gained) / a.points);
  if (coins < cost) return { ok: false, status: 409, reason: `Chưa đủ xu: cần ${cost}, bạn đang có ${coins}.`, cost, gained };
  return { ok: true, cost, gained };
}

/* Áp một lần chăm. Không sửa đối tượng truyền vào. Lỗi có .status (400/409) và thông điệp tiếng Việt. */
function care(state, action) {
  const q = quote(state.coins, state.points, action);
  if (!q.ok) throw httpError(q.status, q.reason);
  const points = clampPoints(state.points) + q.gained;
  return {
    coins: state.coins - q.cost, points, cost: q.cost, gained: q.gained,
    leveledUp: stageOf(points).index > stageOf(state.points).index, done: points >= CONFIG.maxPoints,
  };
}

module.exports = { CONFIG, httpError, isAction, stageOf, quote, care };
