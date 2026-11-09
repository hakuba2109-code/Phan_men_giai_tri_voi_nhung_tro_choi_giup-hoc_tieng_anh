"use strict";
/* Kiểm thử bản vá bộ phân tích AI (không gọi mạng, không cần CSDL).
   node scripts/test-ai-parser.js [đường_dẫn_ai-parser.js] */
const assert = require("assert");
const path = require("path");
process.env.AI_API_KEY = "test";
process.env.AI_MODEL = "m1";
delete process.env.AI_URL;
const ai = require(
  path.resolve(
    process.argv[2] || path.join(__dirname, "..", "src", "ai-parser.js"),
  ),
);

let pass = 0,
  fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ✔", name);
  } catch (e) {
    fail++;
    console.log("  ✘", name, "\n     ", e.message.split("\n")[0]);
  }
}
const mcq = (o) =>
  Object.assign(
    {
      type: "mcq",
      subject: "toeic",
      skill: "reading",
      topic: "Thì",
      stem: "The manager ______ the quarterly report yesterday afternoon.",
      options: ["review", "reviewed", "reviews", "reviewing"],
    },
    o,
  );

console.log("URL mặc định");
t("không còn dấu [ ] và {model} đã được thay", () => {
  const u = ai.conf().url;
  assert.strictEqual(
    u,
    "https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent",
  );
});

console.log("Loại trùng / id");
const passA =
  "Dear Ms. Lee, thank you for your application for the accountant position. We would like to invite you to an interview next Monday at our head office. Please bring your identification and two references.";
const passB =
  "Notice to all staff: the cafeteria will be closed for renovation from the first of March until the end of the month. Staff may use the vending machines on the second floor during this period.";
const pq = (p, opts, a) => ({
  type: "passage_mcq",
  subject: "toeic",
  skill: "reading",
  topic: "Đọc hiểu",
  stem: "What is the purpose of the text?",
  passage: p,
  options: opts,
  answer_index: a,
});
t("2 câu đọc hiểu cùng stem, khác đoạn văn -> giữ cả 2", () => {
  const r = ai.normalize([
    pq(passA, ["To invite", "To complain", "To sell", "To resign"], 0),
    pq(passB, ["To announce", "To ask", "To thank", "To apply"], 0),
  ]);
  assert.strictEqual(r.questions.length, 2);
  assert.notStrictEqual(r.questions[0].id, r.questions[1].id);
});
t("2 câu mcq trùng stem -> vẫn loại 1 (giữ hành vi cũ)", () => {
  assert.strictEqual(
    ai.normalize([mcq({ answer_index: 1 }), mcq({ answer_index: 1 })]).questions
      .length,
    1,
  );
});

console.log("Trạng thái cần xem lại");
const src = (extra) =>
  "1. The manager ______ the quarterly report yesterday afternoon.\n(A) review\n(B) reviewed\n(C) reviews\n(D) reviewing\n" +
  (extra || "");
t("mcq thiếu đáp án -> review, không chơi được", () => {
  const q = ai.normalize([mcq({})]).questions[0];
  assert.strictEqual(q.status, "review");
  assert.strictEqual(q.playable, false);
  assert.ok(q.reviewReasons.some((r) => /đáp án đúng/i.test(r)));
});
t("mcq thiếu đáp án nhưng file có dòng 'Đáp án: B' -> ok", () => {
  const q = ai.normalize([mcq({ $source: src("Đáp án: B") })]).questions[0];
  assert.strictEqual(q.status, "ok");
  assert.strictEqual(q.a, 1);
  assert.strictEqual(q.playable, true);
});
t("mcq có answer_index -> ok", () => {
  assert.strictEqual(
    ai.normalize([mcq({ answer_index: 1 })]).questions[0].status,
    "ok",
  );
});
t("tf không rõ Đúng/Sai -> review; có booleans -> ok", () => {
  const base = {
    type: "tf",
    topic: "ML",
    subject: "ml",
    skill: "general",
    stem: "Xét các mệnh đề về Precision và Recall sau đây:",
    statements: ["Recall = TP/(TP+FN)", "Precision cao thì Recall cao"],
  };
  assert.strictEqual(ai.normalize([base]).questions[0].status, "review");
  assert.strictEqual(
    ai.normalize([Object.assign({}, base, { booleans: [true, false] })])
      .questions[0].status,
    "ok",
  );
});
t("multi không có đáp án -> review", () => {
  const q = ai.normalize([
    {
      type: "multi",
      subject: "ml",
      skill: "general",
      topic: "ML",
      stem: "Chọn các kỹ thuật dùng cho biến phân loại:",
      options: ["One-Hot", "Label", "Scaler", "PCA"],
    },
  ]).questions[0];
  assert.strictEqual(q.status, "review");
});
t("match không có cặp -> review", () => {
  const q = ai.normalize([
    {
      type: "match",
      subject: "ml",
      skill: "general",
      topic: "ML",
      stem: "Nối khái niệm với mô tả tương ứng:",
      left: ["PCA", "SHAP"],
      right: ["Giảm chiều", "Giải thích"],
    },
  ]).questions[0];
  assert.strictEqual(q.status, "review");
});
t(
  "passage_mcq thiếu đoạn văn -> review; audio_mcq thiếu audio -> review",
  () => {
    assert.strictEqual(
      ai.normalize([pq("", ["a", "b", "c", "d"], 0)]).questions[0].status,
      "review",
    );
    const au = {
      type: "audio_mcq",
      subject: "toeic",
      skill: "listening",
      topic: "Nghe",
      stem: "What does the woman say about the meeting?",
      options: ["It is late", "It is cancelled", "It is long", "It is online"],
      answer_index: 1,
    };
    assert.strictEqual(ai.normalize([au]).questions[0].status, "review");
    assert.strictEqual(
      ai.normalize([Object.assign({}, au, { audio_url: "a.mp3" })]).questions[0]
        .status,
      "ok",
    );
  },
);

console.log("Bảng ĐÁP ÁN");
t("applyKey gỡ cờ 'thiếu đáp án' và cho chơi được", () => {
  const out = ai.normalize([mcq({})]);
  assert.strictEqual(out.questions[0].status, "review");
  ai.applyKey(out, { 1: { letter: "C" } });
  assert.strictEqual(out.questions[0].a, 2);
  assert.strictEqual(out.questions[0].status, "ok");
  assert.strictEqual(out.questions[0].playable, true);
});
t("applyKey không gán answer_index cho câu multi", () => {
  const out = ai.normalize([
    {
      type: "multi",
      subject: "ml",
      skill: "general",
      topic: "ML",
      stem: "Chọn các kỹ thuật dùng cho biến phân loại:",
      options: ["One-Hot", "Label", "Scaler", "PCA"],
      answers: ["A", "B"],
    },
  ]);
  ai.applyKey(out, { 1: { letter: "C" } });
  assert.strictEqual(out.questions[0].a, null);
});

console.log("Lượt AI tự giải đáp án");
t("câu thiếu đáp án được đánh dấu để gửi lượt giải, JSON không lộ cờ", () => {
  const q = ai.normalize([mcq({})]).questions[0];
  assert.strictEqual(ai.needsSolve(q), true);
  assert.strictEqual(JSON.stringify(q).includes("$needSolve"), false);
});
t("applyKey lấy đáp án từ bảng thì không gửi lượt giải nữa", () => {
  const out = ai.normalize([mcq({})]);
  ai.applyKey(out, { 1: { letter: "C" } });
  assert.strictEqual(ai.needsSolve(out.questions[0]), false);
  assert.strictEqual(
    out.problems.some((p) => /tạm chọn A/.test(p)),
    false,
  );
});
t("15 câu thiếu đáp án -> 2 lô (12 + 3), prompt có đủ lựa chọn A-D", () => {
  const rows = Array.from({ length: 15 }, (_, i) =>
    Object.assign({}, mcq({}), {
      stem: `Question number ${i + 1} ______ today.`,
      num: i + 1,
    }),
  );
  const batches = ai.solveBatches(
    rows.map((r) => Object.assign({}, r, { o: r.options, a: 0 })),
  );
  assert.deepStrictEqual(
    batches.map((b) => b.length),
    [12, 3],
  );
  const p = ai.solvePrompt(batches[0]);
  assert.ok(p.includes("Câu 1:") && p.includes("A. review"));
  assert.ok(p.includes("Câu 12:"));
});
t("applySolved điền đáp án thật + lý do và gỡ trạng thái cần xem lại", () => {
  const out = ai.normalize([mcq({})]);
  const row = out.questions[0];
  const solved = ai.applySolved(
    [row],
    '{"answers":[{"n":1,"answer_index":1,"why":"Trạng từ chỉ thời gian quá khứ nên dùng quá khứ đơn."}]}',
  );
  assert.strictEqual(solved.length, 1);
  assert.strictEqual(row.a, 1);
  assert.strictEqual(row.payload.answer, 1);
  assert.strictEqual(row.status, "ok");
  assert.strictEqual(row.playable, true);
  assert.strictEqual(row.solved, true);
  assert.ok(/quá khứ đơn/.test(row.n));
  assert.strictEqual(ai.needsSolve(row), false);
});
t("applySolved bỏ qua chỉ số đáp án không hợp lệ", () => {
  const out = ai.normalize([mcq({})]);
  const row = out.questions[0];
  ai.applySolved([row], '{"answers":[{"n":1,"answer_index":9}]}');
  assert.strictEqual(row.a, 0);
  assert.strictEqual(row.status, "review");
});

console.log("Chia đợt");
t("khối [BẢNG 2 CỘT] dài vẫn đi theo câu hỏi, không thành 'đoạn văn'", () => {
  const rows = Array.from(
    { length: 12 },
    (_, i) => `Khái niệm số ${i + 1} | Mô tả tương ứng của khái niệm ${i + 1}`,
  ).join("\n");
  const text =
    "PHẦN 3: ML\n\n14. Nối cột A với cột B cho đúng:\n\n[BẢNG 2 CỘT]\n" +
    rows +
    "\n\nĐáp án: 1-b, 2-a";
  const chunks = ai.chunkText(text, 2800);
  assert.strictEqual(chunks.length, 1);
  assert.ok(
    chunks[0].includes("[BẢNG 2 CỘT]") && chunks[0].includes("Khái niệm số 12"),
  );
});
t("danh sách từ vựng bị loại trước khi gửi AI, câu hỏi thật vẫn đủ", () => {
  const vocab = Array.from(
    { length: 30 },
    (_, i) =>
      `word number ${i + 1} \t\t/ˈwɜːd.${i}ˈkər/ \t(n. phr.)\t: nghĩa số ${i + 1}`,
  ).join("\n\n");
  const qs = Array.from(
    { length: 40 },
    (_, i) =>
      `Sentence number ${i + 1} needs a preposition ______ here.\n\nA. of     B. for     C. with     D. at`,
  ).join("\n\n");
  const chunks = ai.chunkText("UNIT 1: FAMILY LIFE\n\n" + vocab + "\n\n" + qs, 2800);
  const joined = chunks.join("\n\n");
  assert.ok(chunks.glossaryLines >= 30, "glossaryLines = " + chunks.glossaryLines);
  assert.strictEqual(joined.includes("nghĩa số 1"), false);
  assert.strictEqual(joined.includes("/ˈwɜːd"), false);
  for (let i = 1; i <= 40; i++)
    assert.ok(joined.includes(`Sentence number ${i} needs`), `mất câu ${i}`);
});
t("câu và khối A-D của nó không rơi vào hai đợt khác nhau", () => {
  const qs = Array.from(
    { length: 20 },
    (_, i) =>
      `Question ${i + 1} has a blank ______ in the middle of a rather long sentence.` +
      `\n\nA. of     B. for     C. with     D. at`,
  ).join("\n\n");
  const chunks = ai.chunkText(qs, 900);
  assert.ok(chunks.length > 1, "chỉ có 1 đợt nên không kiểm được ranh giới");
  for (const c of chunks) {
    assert.ok(!/^\s*A\.\s+of/.test(c), "đợt bắt đầu bằng dòng đáp án mồ côi");
    const stems = (c.match(/has a blank ______ in the middle/g) || []).length;
    const opts = (c.match(/D\. at/g) || []).length;
    assert.strictEqual(opts, stems, "câu thiếu khối A-D");
  }
});

t("file không đánh số vẫn đếm đủ số câu để nhắc model trả đủ", () => {
  const qs = Array.from(
    { length: 7 },
    (_, i) =>
      `Sentence ${i + 1} needs a word ______ here.\n\nA. of     B. for     C. with     D. at`,
  ).join("\n\n");
  assert.strictEqual(ai.countQuestions(qs), 7);
  assert.strictEqual(
    ai.countQuestions("1. Câu có ______ .\n(A) a\n(B) b\n\n2. Câu hai ______ .\n(A) a\n(B) b"),
    2,
  );
});

console.log("Câu model tự chế / tách đôi");const srcFile =
  "1. Children should take responsibility ______ their belongings.\n" +
  "(A) of\n(B) for\n(C) with\n(D) at\n";
t("đuôi câu bị tách riêng ('their belongings.') bị bỏ hẳn", () => {
  const r = ai.normalize([
    {
      type: "mcq",
      stem: "their belongings.",
      options: ["of", "for", "with", "at"],
      answer_index: 1,
      $source: srcFile,
    },
  ]);
  assert.strictEqual(r.questions.length, 0);
  assert.ok(r.problems.some((p) => /cắt vụn/.test(p)));
});
t("câu chế từ danh sách từ vựng bị gắn cờ, không tự tích lưu", () => {
  const q = ai.normalize([
    {
      type: "mcq",
      stem: "Which of the following phrases means 'nấu ăn' in English?",
      options: ["do the washing-up", "do the cooking", "do the laundry", "cook"],
      answer_index: 1,
      $source: srcFile,
    },
  ]).questions[0];
  assert.strictEqual(q.status, "review");
  assert.strictEqual(q.playable, false);
  assert.ok(q.reviewReasons.some((r) => /tự chế/.test(r)));
});
t("câu nguyên văn trong file không bị gắn cờ", () => {
  const q = ai.normalize([
    {
      type: "mcq",
      stem: "Children should take responsibility ______ their belongings.",
      options: ["of", "for", "with", "at"],
      answer_index: 1,
      $source: srcFile,
    },
  ]).questions[0];
  assert.strictEqual(q.status, "ok");
  assert.strictEqual(q.playable, true);
});
t("đề lệch ký tự cuối được chép lại nguyên văn theo file", () => {
  const r = ai.normalize([
    {
      type: "mcq",
      stem: "Children should take responsibility ______ their belongings.v",
      options: ["of", "for", "with", "at"],
      answer_index: 1,
      $source: srcFile,
    },
  ]);
  assert.strictEqual(r.questions.length, 1);
  assert.strictEqual(r.questions[0].status, "ok");
  assert.strictEqual(
    r.questions[0].q,
    "Children should take responsibility ______ their belongings.",
  );
  assert.ok(r.problems.some((p) => /chép lại nguyên văn/.test(p)));
});
t("matchSourceLine: nguyên văn -> giữ, gần giống -> sửa, không có -> trống", () => {
  assert.strictEqual(
    ai.matchSourceLine("Children should take responsibility ______ their belongings.", srcFile),
    "Children should take responsibility ______ their belongings.",
  );
  assert.strictEqual(
    ai.matchSourceLine("Children should take responsibility ______ their belongings. pla", srcFile),
    "Children should take responsibility ______ their belongings.",
  );
  assert.strictEqual(ai.matchSourceLine("Which phrase means 'nấu ăn' in English?", srcFile), "");
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
