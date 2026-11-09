"use strict";

/* LÕI THUẦN của "Mê cung kho báu": không DOM, không Node-API, không mạng.
   Dùng chung cho server (Node) và trình duyệt (build.js nhúng file này trước dungeon.js).
   Mọi hàm đều tất định theo hạt giống (seed) để lưu/tiếp tục ván và để kiểm thử. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DungeonCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const CONFIG = {
    questionsPerFloor: 12, // số quái mỗi tầng (mục tiêu)
    minQuestionsToPlay: 12, // bộ đề ít hơn thì không mở mê cung
    maxQuestionsPerRun: 200, // trần mỗi ván; bộ lớn hơn được chia thành các "chặng" cân bằng
    hearts: 3,
    bossDamage: 2, // quái trùm: trả lời sai mất 2 tim, đúng được gấp đôi EXP
    bossExpMul: 2,
    maxRespawn: 2, // câu sai được hồi sinh tối đa 2 lần; lần sai thứ 3 -> "Sách giải" (assisted)
    braid: 0.08, // tỉ lệ đục thêm tường để có vòng lặp (bớt ngõ cụt)
    minSpacing: 3, // khoảng cách bước tối thiểu giữa hai quái (hạ dần nếu chật)
    medal: { gold: 0.85, silver: 0.65, silverMaxAssisted: 0.05 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (n) => Math.floor(next() * n);
    next.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = next.int(i + 1);
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    return next;
  }

  /* n câu -> số quái từng tầng, chênh nhau tối đa 1 (không có tầng cuối lẻ loi). */
  function splitFloors(n, target) {
    const t = target || CONFIG.questionsPerFloor;
    const floors = Math.max(1, Math.round(n / t));
    const base = Math.floor(n / floors);
    const extra = n % floors;
    return Array.from({ length: floors }, (_, i) => base + (i < extra ? 1 : 0));
  }

  /* n câu -> kích thước từng chặng (mỗi chặng <= trần, cân bằng, không chặng cuối lẻ loi). */
  function splitSegments(n, cap) {
    const c = cap || CONFIG.maxQuestionsPerRun;
    const segs = Math.max(1, Math.ceil(n / c));
    const base = Math.floor(n / segs);
    const extra = n % segs;
    return Array.from({ length: segs }, (_, i) => base + (i < extra ? 1 : 0));
  }

  const sizeFor = (monsters) => clamp(Math.round(Math.sqrt(monsters * 3)), 5, 9);

  /* Sinh một tầng. Ô 0 = lối đi, 1 = tường. Tọa độ {x, y}; lưới (2c+1)x(2c+1). */
  function generateFloor({ seed, monsters, chests }) {
    const rand = rng(seed);
    let c = sizeFor(monsters);
    const wantChests = chests == null ? 1 : chests;
    while (c * c < Math.ceil(monsters * 1.5) + wantChests + 3 && c < 14) c++;
    const N = 2 * c + 1;
    const grid = Array.from({ length: N }, () => new Array(N).fill(1));

    // DFS có quay lui -> hành lang dài, ít ngã rẽ
    const seen = new Set();
    const key = (x, y) => y * N + x;
    const startCell = { x: rand.int(c), y: rand.int(c) };
    const stack = [startCell];
    seen.add(key(startCell.x, startCell.y));
    grid[2 * startCell.y + 1][2 * startCell.x + 1] = 0;
    const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const opts = rand.shuffle(DIR).filter(([dx, dy]) => {
        const nx = cur.x + dx, ny = cur.y + dy;
        return nx >= 0 && ny >= 0 && nx < c && ny < c && !seen.has(key(nx, ny));
      });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[0];
      const nx = cur.x + dx, ny = cur.y + dy;
      grid[2 * cur.y + 1 + dy][2 * cur.x + 1 + dx] = 0;
      grid[2 * ny + 1][2 * nx + 1] = 0;
      seen.add(key(nx, ny));
      stack.push({ x: nx, y: ny });
    }

    // đục thêm vài bức tường giữa hai ô đã thông để tạo vòng lặp
    for (let y = 0; y < c; y++) {
      for (let x = 0; x < c; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (x + dx >= c || y + dy >= c) continue;
          if (grid[2 * y + 1 + dy][2 * x + 1 + dx] === 1 && rand() < CONFIG.braid) {
            grid[2 * y + 1 + dy][2 * x + 1 + dx] = 0;
          }
        }
      }
    }

    // vào ở một góc ngẫu nhiên
    const corners = [[0, 0], [c - 1, 0], [0, c - 1], [c - 1, c - 1]];
    const [sx, sy] = corners[rand.int(4)];
    const start = { x: 2 * sx + 1, y: 2 * sy + 1 };

    const bfs = (from) => {
      const dist = Array.from({ length: N }, () => new Array(N).fill(-1));
      const q = [from];
      dist[from.y][from.x] = 0;
      for (let i = 0; i < q.length; i++) {
        const p = q[i];
        for (const [dx, dy] of DIR) {
          const nx = p.x + dx, ny = p.y + dy;
          if (grid[ny][nx] === 0 && dist[ny][nx] < 0) {
            dist[ny][nx] = dist[p.y][p.x] + 1;
            q.push({ x: nx, y: ny });
          }
        }
      }
      return dist;
    };
    const dist = bfs(start);

    const centers = [];
    for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) centers.push({ x: 2 * x + 1, y: 2 * y + 1 });
    const d = (p) => dist[p.y][p.x];

    // cầu thang ở ô xa nhất
    let stairs = centers[0];
    for (const p of centers) if (d(p) > d(stairs)) stairs = p;

    // quái: rải đều, cách nhau >= minSpacing nếu còn chỗ, tránh cổng vào/cầu thang
    const taken = new Set([key(start.x, start.y), key(stairs.x, stairs.y)]);
    let pool = rand.shuffle(centers.filter((p) => !taken.has(key(p.x, p.y)) && d(p) >= 3));
    if (pool.length < monsters) pool = rand.shuffle(centers.filter((p) => !taken.has(key(p.x, p.y))));
    const picked = [];
    for (let spacing = CONFIG.minSpacing; spacing >= 0 && picked.length < monsters; spacing--) {
      for (const p of pool) {
        if (picked.length >= monsters) break;
        if (picked.includes(p)) continue;
        if (picked.every((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) >= spacing * 2)) picked.push(p);
      }
    }
    picked.forEach((p) => taken.add(key(p.x, p.y)));
    // trùm = quái xa cổng vào nhất
    const order = picked.slice().sort((a, b) => d(b) - d(a));
    const monsterList = picked.map((p) => ({ x: p.x, y: p.y, boss: monsters >= 3 && p === order[0] }));

    // rương: ưu tiên ngõ cụt chưa có gì
    const open = (p) => DIR.filter(([dx, dy]) => grid[p.y + dy][p.x + dx] === 0).length;
    const rest = centers.filter((p) => !taken.has(key(p.x, p.y)));
    const dead = rand.shuffle(rest.filter((p) => open(p) === 1));
    const chestCells = dead.concat(rand.shuffle(rest.filter((p) => open(p) !== 1))).slice(0, wantChests);

    return {
      size: N, cells: c, grid, start, stairs,
      monsters: monsterList, chests: chestCells.map((p) => ({ x: p.x, y: p.y })),
      dist,
    };
  }

  /* Phần thưởng rương, tất định theo (seed, tầng, số rương) -> mở lại không đổi, server tính được. */
  function chestLoot(seed, floor, chestIdx) {
    const r = rng(hash32(`${seed}|${floor}|${chestIdx}`));
    const roll = r();
    const gold = 10 + r.int(21);
    if (roll < 0.35) return { item: "potion", gold };
    if (roll < 0.70) return { item: "hint", gold };
    if (roll < 0.90) return { item: "shield", gold };
    return { item: null, gold: gold + 20 };
  }

  /* stats: { total, firstTry, assisted } */
  function medal(stats) {
    const total = Math.max(1, stats.total);
    const rate = stats.firstTry / total;
    const ass = (stats.assisted || 0) / total;
    const m = CONFIG.medal;
    if (rate >= m.gold && ass === 0) return "gold";
    if (rate >= m.silver && ass <= m.silverMaxAssisted) return "silver";
    return "bronze";
  }

  return { CONFIG, hash32, rng, splitFloors, splitSegments, sizeFor, generateFloor, chestLoot, medal };
});
