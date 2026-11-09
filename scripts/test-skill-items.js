"use strict";
/* Kiểm 4 trò kỹ năng mới (skill-extra.js): Tìm lỗi sai + Phân loại nhanh.
   Không gọi mạng, không cần CSDL — dữ liệu là câu A–D tự dựng ở đây.
     cd /d E:\Toeic\Tro_Choi
     node scripts\test-skill-items.js                                        */
const assert = require("assert");
const S = require("./skill-extra");
const X = require("./explainer");

let pass = 0,
  fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ✔", name);
  } catch (e) {
    fail++;
    console.log("  ✘", name, "\n      ", e.message.split("\n")[0]);
  }
}
const DEPS = { explainer: X, rng: S._internal.mulberry(20261031) };
const Q = (id, q, o, a, extra) => Object.assign({ id, q, o, a, status: "ok" }, extra || {});
const run = (id, pool, deps) => S.audit(id, pool, deps || DEPS);
const OPT_ADJ = ["succeed", "success", "successful", "successfully"];
/* 8 câu "very ___" khác nhau để đủ ngưỡng 6 thẻ của trò phân loại. */
const POS_POOL = [
  "She is a very ______ worker.",
  "He is a very ______ manager.",
  "They are very ______ drivers.",
  "It was a very ______ decision.",
  "You seem very ______ today.",
  "That was a very ______ offer.",
  "We found the task very ______ .",
  "The new policy is very ______ .",
].map((q, i) => Q(200 + i, q, OPT_ADJ, 2));

/* ---------- 1. Tìm lỗi sai ---------- */
const SPOT_OK = Q(1, "The manager ______ the report yesterday.",
  ["review", "reviewed", "reviewing", "reviews"], 1);

console.log("Tìm lỗi sai — sinh câu");
t("1. câu hợp lệ sinh đúng 1 item, span trỏ đúng từ sai", () => {
  const r = run("spot", [SPOT_OK]);
  assert.strictEqual(r.items.length, 1, JSON.stringify(r.skip));
  const it = r.items[0];
  assert.strictEqual(it.tokens[it.span[0]].replace(/[^a-z]/gi, "").toLowerCase(),
    it.wrong.toLowerCase());
  assert.strictEqual(it.span[1] - it.span[0], 1);
  assert.notStrictEqual(it.wrong.toLowerCase(), it.answer.toLowerCase());
  assert.strictEqual(it.o.filter((o) => o.ok).length, 1, "phải còn đúng một đáp án sửa");
});
t("2. chỗ sai nhiều từ → span phủ hết các token liên tiếp", () => {
  const r = run("spot", [Q(2, "The team ______ the task on Friday.",
    ["completed", "will have completed"], 0)]);
  const it = r.items[0];
  assert.ok(it, JSON.stringify(r.skip));
  assert.strictEqual(it.span[1] - it.span[0], 3, it.tokens.join(" | "));
  assert.strictEqual(it.tokens.slice(it.span[0], it.span[1]).join(" "), it.wrong);
});
t("3. hai chỗ trống → bỏ qua, lý do nhieu-cho-trong", () => {
  const r = run("spot", [Q(3, "The ______ met ______ at noon.",
    ["board", "members", "and", "then"], 0)]);
  assert.strictEqual(r.items.length, 0);
  assert.strictEqual(r.skip["nhieu-cho-trong"], 1);
});
t("4. đáp án dài quá 28 ký tự → bỏ qua", () => {
  const r = run("spot", [Q(4, "We need a ______ plan.",
    ["straightforward and realistic", "quick", "short", "simple"], 0)]);
  assert.strictEqual(r.items.length, 0);
  assert.ok(r.skip["dap-an-dai"] >= 1, JSON.stringify(r.skip));
});
t("5. status = review → bỏ qua", () => {
  const r = run("spot", [Q(5, "The manager ______ the report yesterday.",
    ["review", "reviewed", "reviewing", "reviews"], 1, { status: "review" })]);
  assert.strictEqual(r.items.length, 0);
  assert.strictEqual(r.skip["review"], 1);
});
t("6. chỗ trống đầu câu → từ sai được viết hoa", () => {
  const r = run("spot", [Q(6, "_______ the meeting is a good idea.",
    ["Attend", "Attends", "Attending", "Attended"], 0)]);
  const it = r.items[0];
  assert.ok(it, JSON.stringify(r.skip));
  assert.strictEqual(it.span[0], 0);
  assert.strictEqual(it.tokens[0].charAt(0), it.tokens[0].charAt(0).toUpperCase());
  assert.strictEqual(it.wrong.charAt(0), it.wrong.charAt(0).toUpperCase());
});
t("7. dấu câu sát chỗ trống → giữ dấu, không sinh token ' .'", () => {
  const r = run("spot", [
    Q(7, "We discussed the report, ______ yesterday.", ["after", "before", "during", "since"], 1),
    Q(71, "The board approved the plan ______.",
      ["unanimous", "unanimously", "unanimity", "unanimousness"], 1),
  ]);
  assert.strictEqual(r.items.length, 2, JSON.stringify(r.skip));
  const a = r.items[0],
    b = r.items[1];
  assert.strictEqual(a.tokens[3], "report,");
  assert.strictEqual(a.tokens[a.span[0]], a.wrong);
  assert.ok(/\.$/.test(b.tokens[b.span[1] - 1]), b.tokens.join(" | "));
  assert.ok(!/ \./.test(b.tokens.join(" ")), b.tokens.join(" "));
});
t("8. nhiễu trùng đáp án chỉ khác hoa thường → không được chọn", () => {
  const r = run("spot", [Q(8, "The committee will ______ the minutes.",
    ["Review", "review", "reviewing", "reviewed"], 0)]);
  const it = r.items[0];
  assert.ok(it, JSON.stringify(r.skip));
  assert.notStrictEqual(it.wrong.toLowerCase(), "review");
});
t("9. câu hơn 28 từ → bỏ qua", () => {
  const long = "The " + Array(30).fill("workers").join(" ") + " ______ the report.";
  const r = run("spot", [Q(9, long, ["submit", "submitted", "submitting", "submits"], 1)]);
  assert.strictEqual(r.items.length, 0);
  assert.strictEqual(r.skip["cau-qua-dai"], 1);
});
t("10. câu cùng họ từ → ưu tiên nhiễu cùng họ", () => {
  for (let seed = 1; seed < 12; seed++) {
    const deps = { explainer: X, rng: S._internal.mulberry(seed) };
    const r = run("spot", [Q(10, "The design is ______.",
      ["attraction", "attractive", "attract", "distract"], 1)], deps);
    const it = r.items[0];
    assert.ok(it, "seed " + seed + " " + JSON.stringify(r.skip));
    assert.ok(["attraction", "attract"].includes(it.wrong.toLowerCase()),
      "seed " + seed + " chọn " + it.wrong);
  }
});

/* ---------- 2. Phân loại nhanh: từ loại ---------- */
const FAMILY_COST = Q(20, "The price of fuel is ______.",
  ["cost", "costly", "costless", "costliness"], 2);
const NO_RULE = Q(23, "He has worked here ______ 2020.", ["since", "for", "in", "at"], 0);
const wordCards = (cards) => cards.filter((c) => c.card.word).map((c) => c.card.word);

console.log("Phân loại nhanh — từ loại");
t("11. ngoại lệ -ly (costly) không thành thẻ “Từ này là…”", () => {
  const raw = S._internal.rawCards("pos", [FAMILY_COST], DEPS);
  const words = wordCards(raw);
  assert.ok(words.length, "phải có thẻ của họ “cost”: " + JSON.stringify(raw));
  assert.ok(!words.includes("costly"), words.join(","));
});
t("12. từ mơ hồ (report) không thành thẻ", () => {
  const raw = S._internal.rawCards("pos", [
    Q(24, "The manager will ______ the annual report.",
      ["report", "reported", "reporting", "reporter"], 0),
  ], DEPS);
  assert.ok(wordCards(raw).length, JSON.stringify(raw));
  assert.ok(!wordCards(raw).includes("report"), wordCards(raw).join(","));
});
t("13. luật vị trí khác lớp của đáp án đã lưu → khong-khop-dap-an", () => {
  const r = run("classpos", [Q(25, "She is a very ______ worker.", OPT_ADJ, 3)]);
  assert.strictEqual(r.items.length, 0);
  assert.ok(r.skip["khong-khop-dap-an"] >= 1, JSON.stringify(r.skip));
});
t("14. luật im lặng → khong-co-luat", () => {
  const r = run("classpos", [NO_RULE]);
  assert.ok(r.skip["khong-co-luat"] >= 1, JSON.stringify(r.skip));
});
t("15. thẻ “Chỗ trống cần…”: ô đúng theo luật, 4 ô, why ≤ 120 ký tự", () => {
  const r = run("classpos", POS_POOL);
  assert.strictEqual(r.items.length, 8, JSON.stringify(r.skip));
  const c = r.items[0];
  assert.strictEqual(c.answerBin, "adj");
  assert.strictEqual(c.bins.length, 4);
  assert.ok(c.why.length <= 120, c.why);
  assert.strictEqual(c.seconds, 8);
});

/* ---------- 3. Phân loại nhanh: thì ---------- */
const TENSE_OK = Q(30, "She ______ the job next month.",
  ["applies", "applied", "applying", "will apply"], 3);
console.log("Phân loại nhanh — thì");
t("15b. next month + will apply → ô đúng Tương lai đơn, 4 ô khác nhau", () => {
  const raw = S._internal.rawCards("tense", [TENSE_OK], DEPS);
  assert.strictEqual(raw.length, 1, "không sinh thẻ");
  assert.strictEqual(raw[0].answerBin, "Tương lai đơn");
  assert.strictEqual(raw[0].bins.length, 4);
  assert.ok(/next month/.test(raw[0].card.focus), raw[0].card.focus);
});
t("16. luật nói tương lai nhưng đáp án lưu là hiện tại hoàn thành → bỏ câu", () => {
  const r = run("classtense", [Q(31, "She ______ the job next month.",
    ["applies", "applied", "applying", "has applied"], 3)]);
  assert.strictEqual(r.items.length, 0);
  assert.ok(r.skip["khong-khop-dap-an"] >= 1, JSON.stringify(r.skip));
});
t("16b. “By the time …” + will have → Tương lai hoàn thành, thẻ có chứa dấu hiệu", () => {
  const raw = S._internal.rawCards("tense", [Q(32,
    "By the time the team from the university language center arrives, the department ______ the new server configuration.",
    ["is completing", "completed", "had completed", "will have completed"], 3)], DEPS);
  assert.strictEqual(raw.length, 1, JSON.stringify(raw));
  assert.strictEqual(raw[0].answerBin, "Tương lai hoàn thành");
  assert.ok(/by the time/i.test(raw[0].card.before + " " + raw[0].card.after),
    raw[0].card.before + " ___ " + raw[0].card.after);
});
t("16c. câu điều kiện “had been … would not have” → Quá khứ hoàn thành", () => {
  const raw = S._internal.rawCards("tense", [Q(33,
    "If the system architecture ______ optimized earlier, the buffer vulnerability would not have occurred.",
    ["is", "has been", "was", "had been"], 3)], DEPS);
  assert.strictEqual(raw.length, 1, JSON.stringify(raw));
  assert.strictEqual(raw[0].answerBin, "Quá khứ hoàn thành");
  assert.ok(/would not have/i.test(raw[0].card.before + " " + raw[0].card.after),
    raw[0].card.before + " ___ " + raw[0].card.after);
});
t("16d. họ động từ 3/4 đáp án vẫn tạo thẻ, nhiễu khác họ không thành ô", () => {
  const raw = S._internal.rawCards("tense", [Q(34, "The team ______ the task yesterday.",
    ["completed", "completes", "completing", "chair"], 0)], DEPS);
  assert.strictEqual(raw.length, 1, JSON.stringify(raw));
  assert.strictEqual(raw[0].bins.length, 3, JSON.stringify(raw[0].bins));
  assert.strictEqual(raw[0].answerBin, "Quá khứ đơn");
});

/* ---------- 4. Phân loại nhanh: giới từ ---------- */
const PREP_POOL = [
  Q(40, "The meeting starts ______ Monday morning.", ["on", "in", "at", "by"], 0),
  Q(41, "We flew to Paris ______ March.", ["in", "on", "at", "by"], 0),
  Q(42, "The shop opens ______ 9 a.m.", ["at", "in", "on", "for"], 0),
  Q(43, "See you ______ the airport.", ["at", "in", "on", "to"], 0),
  Q(44, "The café is ______ the city.", ["in", "at", "on", "of"], 0),
  Q(45, "Put it ______ the table.", ["on", "in", "at", "upon"], 0),
];
const binOf = (items, word) => {
  const c = items.filter((x) => x.card.after.toLowerCase().indexOf(word) === 0)[0];
  assert.ok(c, "thiếu thẻ có “" + word + "”: " + items.map((x) => x.card.after).join(" / "));
  return c.answerBin;
};
console.log("Phân loại nhanh — giới từ");
t("17. Monday → on, March → in, 9 a.m. → at, airport → at, city → in, table → on", () => {
  const r = run("classprep", PREP_POOL);
  assert.strictEqual(r.items.length, 6, JSON.stringify(r.skip));
  assert.strictEqual(binOf(r.items, "monday"), "on");
  assert.strictEqual(binOf(r.items, "march"), "in");
  assert.strictEqual(binOf(r.items, "9"), "at");
  assert.strictEqual(binOf(r.items, "the airport"), "at");
  assert.strictEqual(binOf(r.items, "the city"), "in");
  assert.strictEqual(binOf(r.items, "the table"), "on");
});
t("18. quy tắc khác đáp án đã lưu → bỏ câu", () => {
  const r = run("classprep", [Q(46, "The meeting starts ______ Monday.",
    ["in", "on", "at", "by"], 0)]);
  assert.strictEqual(r.items.length, 0);
  assert.ok(r.skip["khong-khop-dap-an"] >= 1, JSON.stringify(r.skip));
});
const PREP_NOUNS = [
  Q(50, "The manual will be sent to all new hires ______ their first day.", ["on", "in", "at", "by"], 0),
  Q(51, "The headquarters is located ______ the intersection of 5th Avenue.", ["at", "in", "on", "by"], 0),
  Q(52, "Resources must be allocated ______ accordance with the rules.", ["in", "on", "at", "by"], 0),
  Q(53, "The office is closed ______ weekends.", ["on", "in", "at", "by"], 0),
  Q(54, "The files are stored ______ the cabinet.", ["in", "on", "at", "by"], 0),
  Q(55, "She lives ______ Paris.", ["in", "on", "at", "by"], 0),
  Q(56, "The manual is ______ the desk.", ["on", "in", "at", "by"], 0),
];
t("18b. bảng mới: on their first day · at the intersection · in accordance with · on weekends · in the cabinet · in Paris · on the desk", () => {
  const r = run("classprep", PREP_NOUNS);
  assert.strictEqual(r.items.length, 7, JSON.stringify(r.skip));
  assert.strictEqual(binOf(r.items, "their first day"), "on");
  assert.strictEqual(binOf(r.items, "the intersection"), "at");
  assert.strictEqual(binOf(r.items, "accordance"), "in");
  assert.strictEqual(binOf(r.items, "weekends"), "on");
  assert.strictEqual(binOf(r.items, "the cabinet"), "in");
  assert.strictEqual(binOf(r.items, "paris"), "in");
  assert.strictEqual(binOf(r.items, "the desk"), "on");
});
const PREP_COLL = [
  Q(60, "He relies ______ his assistant.", ["on", "in", "at", "by"], 0),
  Q(61, "She is good ______ solving problems.", ["at", "in", "on", "by"], 0),
  Q(62, "He is an expert ______ finance.", ["in", "on", "at", "by"], 0),
  Q(63, "Please look ______ the attached chart.", ["at", "in", "on", "by"], 0),
  Q(64, "The team insisted ______ reviewing the file.", ["on", "in", "at", "by"], 0),
  Q(65, "The delay resulted ______ a longer wait.", ["in", "on", "at", "by"], 0),
];
t("18c. cụm cố định động từ/tính từ + giới từ: rely on · good at · expert in · look at · insist on · result in", () => {
  const r = run("classprep", PREP_COLL);
  assert.strictEqual(r.items.length, 6, JSON.stringify(r.skip));
  assert.strictEqual(binOf(r.items, "his assistant"), "on");
  assert.strictEqual(binOf(r.items, "solving"), "at");
  assert.strictEqual(binOf(r.items, "finance"), "in");
  assert.strictEqual(binOf(r.items, "the attached chart"), "at");
  assert.strictEqual(binOf(r.items, "reviewing"), "on");
  assert.strictEqual(binOf(r.items, "a longer wait"), "in");
});

/* ---------- 5. Luật chung của ba trò phân loại ---------- */
console.log("Luật chung");
t("19. dưới 6 thẻ thì trò chơi không hiện", () => {
  const r = run("classprep", PREP_POOL.slice(0, 5));
  assert.deepStrictEqual(r.items, []);
  assert.ok(r.skip["duoi-nguong-6"] >= 1, JSON.stringify(r.skip));
});
t("20. thẻ trùng chỉ giữ một", () => {
  const r = run("classprep", PREP_POOL.concat(PREP_POOL));
  assert.strictEqual(r.items.length, 6, JSON.stringify(r.skip));
});
t("21. thẻ không mang key (không ghi vào lịch sử câu hỏi)", () => {
  run("classprep", PREP_POOL).items.forEach((c) => assert.strictEqual(c.key, undefined));
  run("classpos", POS_POOL).items.forEach((c) => assert.strictEqual(c.key, undefined));
});
t("22. số ô từ 2 đến 4, nhãn không trùng, ô đúng phải có trong ô", () => {
  [run("classprep", PREP_POOL), run("classpos", POS_POOL)].forEach((r) => {
    assert.ok(r.items.length);
    r.items.forEach((c) => {
      assert.ok(c.bins.length >= 2 && c.bins.length <= 4, String(c.bins.length));
      const labels = c.bins.map((b) => b.label);
      assert.strictEqual(new Set(labels).size, labels.length, labels.join(","));
      assert.ok(c.bins.some((b) => b.id === c.answerBin), c.answerBin);
    });
  });
});
t("23. không có 'undefined'/'NaN' trong văn bản thẻ và câu", () => {
  const cards = run("classprep", PREP_POOL).items.concat(run("classpos", POS_POOL).items);
  const spots = run("spot", [SPOT_OK, FAMILY_COST, TENSE_OK]).items;
  assert.ok(cards.length >= 10 && spots.length >= 2);
  cards.concat(spots).forEach((c) => {
    const txt = JSON.stringify(c.card || { tokens: c.tokens, full: c.full });
    assert.ok(!/undefined|NaN/.test(txt), txt);
    assert.ok(!/undefined|NaN/.test(c.why || ""), c.why || "");
  });
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
