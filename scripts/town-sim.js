"use strict";
/* Mô phỏng thu nhập để CHỈNH SỐ (dailyCap, base, stageXp, buildCost) trước khi bắt tay làm giao diện.
   node scripts/town-sim.js [số_câu_bộ_đề=169] [số_ngày=60]
   Giả định (nói rõ để khỏi hiểu nhầm): mỗi ngày người học chọn câu NGẪU NHIÊN trong bộ đề; xác suất đúng
   0,55–0,85 tùy câu, cộng 0,15 nếu câu đã từng đúng. Số thật phải đo lại bằng bảng attempts. */
const T = require("../src/town-core");
const topics = ["Thì", "Từ loại", "Giới từ", "Đại từ", "Từ vựng"];
const N = Number(process.argv[2]) || 169, DAYS = Number(process.argv[3]) || 60;

function sim(perDay, seed) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const qs = Array.from({ length: N }, (_, i) => ({ id: "q" + i, topic: topics[i % topics.length], p: 0.55 + rnd() * 0.3 }));
  let st = null, mem = {}, id = 1, xp = 0;
  const stageDay = {}, mats = {};
  const start = Date.parse("2026-09-01T09:00:00+07:00");
  for (let d = 0; d < DAYS; d++) {
    const list = [];
    for (let i = 0; i < perDay; i++) {
      const q = qs[Math.floor(rnd() * N)];
      const h = mem[q.id];
      const p = h && h.oks > 0 ? Math.min(0.97, q.p + 0.15) : q.p;
      list.push({ id: id++, ts: start + d * 86400000 + i * 60000, qid: q.id, topic: q.topic, correct: rnd() < p });
    }
    const r = T.applyAttempts(st, mem, list);
    st = r.state; mem = r.memory; xp += r.xp;
    for (const k of Object.keys(r.byTopic)) mats[k] = (mats[k] || 0) + r.byTopic[k];
    const sg = T.stageOf(xp).stage;
    if (!(sg in stageDay)) stageDay[sg] = d + 1;
  }
  return { xp, stageDay, mats };
}

console.log(`Bộ ${N} câu, ${DAYS} ngày, trần ${T.CONFIG.dailyCap}/ngày\n`);
console.log("lượt/ngày | vật liệu TB/ngày | tổng | ngày đạt giai đoạn 1/2/3/4 | vật liệu khu 'Thì'");
for (const per of [10, 20, 40, 80]) {
  const r = sim(per, per);
  const sd = [1, 2, 3, 4].map((k) => (r.stageDay[k] == null ? "—" : r.stageDay[k])).join("/");
  console.log(`${String(per).padStart(9)} | ${(r.xp / DAYS).toFixed(1).padStart(16)} | ${String(r.xp).padStart(4)} | ${sd.padEnd(27)} | ${String(r.mats["Thì"] || 0).padStart(12)}`);
}
console.log(`\nMột khu đầy đủ = ${T.CONFIG.plotsPerDistrict * T.CONFIG.buildCost.reduce((a, b) => a + b, 0)} vật liệu; cả ${topics.length} khu = ${topics.length * T.CONFIG.plotsPerDistrict * T.CONFIG.buildCost.reduce((a, b) => a + b, 0)}.`);
