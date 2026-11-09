"use strict";
/* Kiểm thử lõi Mê cung kho báu (không mạng, không CSDL).  node scripts/test-dungeon.js */
const assert = require("assert");
const D = require("../src/dungeon-core");
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", e.message.split("\n")[0]); } };

t("splitFloors: tổng đúng, chênh nhau tối đa 1, không tầng cuối lẻ loi", () => {
  for (const n of [12, 13, 25, 50, 100, 119, 120, 169]) {
    const f = D.splitFloors(n);
    assert.strictEqual(f.reduce((a, b) => a + b, 0), n);
    assert.ok(Math.max(...f) - Math.min(...f) <= 1, `n=${n} ${f}`);
    assert.ok(Math.min(...f) >= 6, `n=${n} có tầng quá nhỏ`);
  }
  assert.deepStrictEqual(D.splitFloors(169).length, 14);
});

t("splitSegments: <= trần thì một chặng; bộ 500 câu chia 3 chặng cân bằng", () => {
  assert.deepStrictEqual(D.splitSegments(169), [169]);
  assert.deepStrictEqual(D.splitSegments(200), [200]);
  assert.deepStrictEqual(D.splitSegments(500), [167, 167, 166]);
  assert.deepStrictEqual(D.splitSegments(201), [101, 100]);
  for (const n of [12, 199, 201, 650]) assert.strictEqual(D.splitSegments(n).reduce((a, b) => a + b, 0), n);
});

t("generateFloor: cùng seed ra cùng mê cung, khác seed ra khác", () => {
  const a = D.generateFloor({ seed: 7, monsters: 12 });
  const b = D.generateFloor({ seed: 7, monsters: 12 });
  const c = D.generateFloor({ seed: 8, monsters: 12 });
  assert.deepStrictEqual(a.grid, b.grid);
  assert.deepStrictEqual(a.monsters, b.monsters);
  assert.notDeepStrictEqual(a.grid, c.grid);
});

t("generateFloor: mọi ô lối đi đều tới được từ cổng vào (200 hạt giống × 4 cỡ tầng)", () => {
  for (const monsters of [6, 9, 12, 14]) {
    for (let seed = 1; seed <= 200; seed++) {
      const f = D.generateFloor({ seed, monsters, chests: 2 });
      for (let y = 0; y < f.size; y++) for (let x = 0; x < f.size; x++) {
        if (f.grid[y][x] === 0) assert.ok(f.dist[y][x] >= 0, `seed ${seed}: ô ${x},${y} không tới được`);
      }
    }
  }
});

t("generateFloor: đủ số quái, vị trí duy nhất, nằm trên lối đi, không đè cổng vào/cầu thang", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const monsters = 6 + (seed % 9);
    const f = D.generateFloor({ seed, monsters, chests: 2 });
    assert.strictEqual(f.monsters.length, monsters, `seed ${seed}`);
    const all = [f.start, f.stairs, ...f.monsters, ...f.chests].map((p) => p.x + "," + p.y);
    assert.strictEqual(new Set(all).size, all.length, `seed ${seed}: trùng vị trí`);
    [...f.monsters, ...f.chests, f.stairs].forEach((p) => assert.strictEqual(f.grid[p.y][p.x], 0));
    assert.strictEqual(f.monsters.filter((m) => m.boss).length, 1);
  }
});

t("generateFloor: cầu thang cách cổng vào đủ xa (>= cells) và số bước trung bình giữa các quái hợp lý", () => {
  let sum = 0, n = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const f = D.generateFloor({ seed, monsters: 12 });
    assert.ok(f.dist[f.stairs.y][f.stairs.x] >= f.cells, `seed ${seed}`);
    sum += f.dist[f.stairs.y][f.stairs.x]; n++;
  }
  assert.ok(sum / n < 80, "đường tới cầu thang quá dài: " + sum / n);
});

t("sizeFor: tầng 12 quái -> 6x6 ô; tầng nhỏ không dưới 5", () => {
  assert.strictEqual(D.sizeFor(12), 6);
  assert.strictEqual(D.sizeFor(2), 5);
  assert.strictEqual(D.sizeFor(200), 9);
});

t("chestLoot: tất định và có phân bố hợp lý", () => {
  assert.deepStrictEqual(D.chestLoot(5, 2, 0), D.chestLoot(5, 2, 0));
  const c = { potion: 0, hint: 0, shield: 0, none: 0 };
  for (let i = 0; i < 2000; i++) { const l = D.chestLoot(i, 1, 0); c[l.item || "none"]++; }
  assert.ok(c.potion > 500 && c.hint > 500 && c.shield > 200 && c.none > 100, JSON.stringify(c));
});

t("medal: ngưỡng vàng/bạc/đồng", () => {
  assert.strictEqual(D.medal({ total: 100, firstTry: 90, assisted: 0 }), "gold");
  assert.strictEqual(D.medal({ total: 100, firstTry: 90, assisted: 1 }), "silver"); // có Sách giải thì không vàng
  assert.strictEqual(D.medal({ total: 100, firstTry: 70, assisted: 5 }), "silver");
  assert.strictEqual(D.medal({ total: 100, firstTry: 70, assisted: 6 }), "bronze");
  assert.strictEqual(D.medal({ total: 100, firstTry: 10, assisted: 0 }), "bronze");
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
