"use strict";

/* LUẬT CHƠI THUẦN của Mê cung kho báu (không DB, không mạng, không DOM).
   Server dùng để PHÁN quyết mọi trận đánh; bản offline trong trình duyệt dùng cùng file này.
   Mọi hàm nhận `run` và trả bản sao mới -> dễ kiểm thử và dễ ghi nhật ký. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dungeon-core"));
  else root.DungeonRules = factory(root.DungeonCore);
})(typeof self !== "undefined" ? self : this, function (Core) {
  const C = Core.CONFIG;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fail = (message, status) => Object.assign(new Error(message), { status: status || 400 });

  /* Chia câu vào các tầng, tất định theo seed: cùng (seed, danh sách câu) -> cùng kết quả. */
  function planFloors(seed, questionIds) {
    const order = Core.rng(Core.hash32("plan|" + seed)).shuffle(questionIds);
    const sizes = Core.splitFloors(order.length);
    const out = [];
    let at = 0;
    for (const n of sizes) { out.push(order.slice(at, at + n)); at += n; }
    return out;
  }

  function newRun({ seed, questionIds }) {
    if (questionIds.length < C.minQuestionsToPlay) throw fail(`Bộ đề cần ít nhất ${C.minQuestionsToPlay} câu chơi được.`);
    if (new Set(questionIds).size !== questionIds.length) throw fail("Danh sách câu có id trùng.");
    return {
      seed, questionIds: questionIds.slice(), floorNo: 1, hearts: C.hearts,
      items: { potion: 0, hint: 0, shield: 0 }, gold: 0,
      defeated: [], firstTry: [], assisted: [], hinted: [], wrong: {}, chests: [],
      deaths: 0, fights: 0, exp: 0, status: "active",
    };
  }

  const floorsOf = (run) => planFloors(run.seed, run.questionIds);
  const floorOfQuestion = (run, qid) => floorsOf(run).findIndex((f) => f.includes(qid)) + 1;
  const isBoss = (run, qid) => {
    // trùm = quái cuối danh sách của tầng đó (client dùng cùng quy ước để gắn cờ khi đặt quái vào mê cung)
    const f = floorsOf(run)[floorOfQuestion(run, qid) - 1];
    return f.length >= 3 && f[f.length - 1] === qid;
  };

  function floorCleared(run, floorNo) {
    const f = floorsOf(run)[floorNo - 1];
    return !!f && f.every((q) => run.defeated.includes(q));
  }
  const runCompleted = (run) => run.questionIds.every((q) => run.defeated.includes(q));

  /* Một trận đánh. `correct` do SERVER tính từ đáp án trong CSDL, không tin client. */
  function fight(run, qid, correct, opts) {
    if (run.status !== "active") throw fail("Ván này đã kết thúc.", 409);
    if (!run.questionIds.includes(qid)) throw fail("Câu này không thuộc ván.", 400);
    if (run.defeated.includes(qid)) throw fail("Quái này đã bị hạ.", 409);
    const floorNo = floorOfQuestion(run, qid);
    if (floorNo !== run.floorNo) throw fail("Quái này không ở tầng hiện tại.", 409);

    const r = clone(run);
    const boss = isBoss(r, qid);
    const events = [];
    let exp = 0;
    r.fights++;

    if (correct) {
      r.defeated.push(qid);
      const first = !r.wrong[qid];
      if (first) r.firstTry.push(qid);
      exp = first ? 10 : 5;
      if (opts && opts.hinted) { r.hinted.push(qid); exp = Math.max(0, exp - 5); }
      if (boss) exp *= C.bossExpMul;
      events.push({ type: "defeated", qid, first, boss });
    } else {
      r.wrong[qid] = (r.wrong[qid] || 0) + 1;
      let dmg = boss ? C.bossDamage : 1;
      if (r.items.shield > 0) { r.items.shield--; dmg = 0; events.push({ type: "shield" }); }
      r.hearts = Math.max(0, r.hearts - dmg);
      events.push({ type: "hurt", dmg, hearts: r.hearts });
      if (r.wrong[qid] > C.maxRespawn) { // Sách giải: hạ quái nhưng không tính EXP, trừ huy chương
        r.defeated.push(qid);
        r.assisted.push(qid);
        events.push({ type: "assisted", qid });
      }
      if (r.hearts === 0) {
        r.deaths++;
        r.hearts = C.hearts;
        events.push({ type: "knockedOut" }); // về cổng vào của tầng, quái đã hạ vẫn chết
      }
    }
    r.exp += exp;

    if (floorCleared(r, r.floorNo)) {
      events.push({ type: "floorCleared", floorNo: r.floorNo });
    }
    if (runCompleted(r)) events.push({ type: "runCompleted" });
    return { run: r, events, exp };
  }

  /* Xuống tầng kế tiếp (chỉ khi tầng hiện tại đã sạch quái). */
  function descend(run) {
    if (!floorCleared(run, run.floorNo)) throw fail("Còn quái chưa hạ ở tầng này.", 409);
    if (run.floorNo >= floorsOf(run).length) throw fail("Đã ở tầng cuối.", 409);
    const r = clone(run);
    r.floorNo++;
    return r;
  }

  function useItem(run, item) {
    if (!["potion", "hint", "shield"].includes(item)) throw fail("Vật phẩm không hợp lệ.");
    if (!(run.items[item] > 0)) throw fail("Bạn không có vật phẩm này.", 409);
    const r = clone(run);
    if (item === "potion") {
      if (r.hearts >= C.hearts) throw fail("Tim đã đầy.", 409);
      r.items.potion--; r.hearts++;
    }
    if (item === "shield") { /* khiên được giữ trong túi, tự dùng khi sai (xem fight) */ throw fail("Khiên tự kích hoạt khi bị tấn công, không cần dùng tay.", 400); }
    if (item === "hint") r.items.hint--;
    return r;
  }

  /* Mở rương (idempotent): mỗi rương chỉ mở một lần, phần thưởng tất định theo seed. */
  function openChest(run, floorNo, chestIdx) {
    if (floorNo !== run.floorNo) throw fail("Rương không ở tầng hiện tại.", 409);
    const id = `${floorNo}:${chestIdx}`;
    if (run.chests.includes(id)) throw fail("Rương này đã mở.", 409);
    const loot = Core.chestLoot(run.seed, floorNo, chestIdx);
    const r = clone(run);
    r.chests.push(id);
    r.gold += loot.gold;
    if (loot.item) r.items[loot.item]++;
    return { run: r, loot };
  }

  function summary(run) {
    const total = run.questionIds.length;
    const stats = { total, firstTry: run.firstTry.length, assisted: run.assisted.length };
    return {
      ...stats, defeated: run.defeated.length, deaths: run.deaths, fights: run.fights,
      floors: floorsOf(run).length, floorNo: run.floorNo, medal: Core.medal(stats),
    };
  }

  /* Hoàn tất ván -> chỉ khi MỌI câu đã bị hạ. */
  function finish(run) {
    if (!runCompleted(run)) throw fail("Chưa hạ hết quái của bộ đề.", 409);
    const r = clone(run);
    r.status = "completed";
    return r;
  }

  return { planFloors, newRun, floorsOf, floorOfQuestion, isBoss, floorCleared, runCompleted, fight, descend, useItem, openChest, summary, finish };
});
