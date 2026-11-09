"use strict";
/* Kiểm thử bộ phân tích Word -> câu hỏi (không cần CSDL, không gọi mạng).
   node scripts/test-parser.js */
const assert = require("assert");
const P = require("./parser");

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

const CNTT = `PART 1: VOCABULARY & GRAMMAR (2 câu)

Mark the letter A, B, C, or D on your answer sheet to indicate the correct answer.

Câu 1: Cloud computing allows users to ________ data over the internet.

A. delete      B. retrieve
C. compile      D. encrypt

Câu 2: Software developers regularly release ________ to fix security vulnerabilities.

A. patches      B. hardwares
C. monitors      D. cables

ĐÁP ÁN VÀ GIẢI THÍCH CHI TIẾT (ANSWER KEY)

1. B (retrieve) | 2. A (patches)
`;

const CLOZE = `PART 4: CLOZE TEST (2 câu)

Read the following passage and mark the letter A, B, C, or D to choose the word that best fits each of the numbered blanks from 1 to 2.

Cybersecurity has become a critical priority for modern enterprises as digital transformation accelerates. Organizations increasingly rely on cloud computing and remote infrastructure. First, robust (1) ________ algorithms must be applied to secure data both in transit and at rest. Second, network administrators must continually (2) ________ system logs for suspicious anomalies.

Câu 1: Blank (1)

A. encryption      B. description
C. subscription      D. transcription

Câu 2: Blank (2)

A. ignore      B. monitor
C. delete      D. forget

PART 6: REWRITING (1 câu)

Câu 3: Original: 'It is mandatory for all engineers to certify.'

A. Engineers may certify.      B. All engineers must certify.
C. Engineers cannot certify.      D. Engineers shouldn't certify.

ĐÁP ÁN
1. A | 2. B | 3. B
`;

console.log("Đánh số câu kiểu «Câu 1:» và hai đáp án trên một dòng");
const a = P.parse(CNTT, { source: "import", file: "test.docx" });
t("tách đủ 2 câu, không có cảnh báo", () => {
  assert.strictEqual(a.questions.length, 2);
  assert.deepStrictEqual(a.problems, []);
});
t("đọc đúng 4 đáp án A–D của từng câu", () => {
  assert.deepStrictEqual(a.questions[0].o, ["delete", "retrieve", "compile", "encrypt"]);
  assert.deepStrictEqual(a.questions[1].o, ["patches", "hardwares", "monitors", "cables"]);
});
t("lấy đáp án đúng từ bảng ĐÁP ÁN", () => {
  assert.strictEqual(a.questions[0].a, 1); // B
  assert.strictEqual(a.questions[1].a, 0); // A
});
t("giữ số thứ tự và chủ điểm của phần", () => {
  assert.strictEqual(a.questions[0].num, 1);
  assert.strictEqual(a.questions[1].num, 2);
  assert.strictEqual(a.questions[0].t, "Từ vựng");
});
t("câu không có đoạn văn thì passage = null", () => {
  assert.strictEqual(a.questions[0].passage, null);
});

console.log("Đoạn văn dùng chung + câu điền khuyết «Blank (N)»");
const b = P.parse(CLOZE, { source: "import", file: "cloze.docx" });
t("tách đủ 3 câu, không có cảnh báo", () => {
  assert.strictEqual(b.questions.length, 3);
  assert.deepStrictEqual(b.problems, []);
});
t("gắn nguyên đoạn văn cho cả 2 câu điền khuyết", () => {
  const p = b.questions[0].passage;
  assert.ok(p && p.length >= 120, "thiếu đoạn văn");
  assert.strictEqual(b.questions[1].passage, p);
  assert.ok(/Cybersecurity has become/.test(p));
});
t("đổi «Blank (1)» thành chính câu chứa chỗ trống", () => {
  assert.strictEqual(
    b.questions[0].q,
    "First, robust ________ algorithms must be applied to secure data both in transit and at rest.",
  );
  assert.strictEqual(
    b.questions[1].q,
    "Second, network administrators must continually ________ system logs for suspicious anomalies.",
  );
});
t("phần sau (không có «Read the passage») không thừa hưởng đoạn văn", () => {
  assert.strictEqual(b.questions[2].passage, null);
  assert.strictEqual(
    b.questions[2].q,
    "Original: 'It is mandatory for all engineers to certify.'",
  );
});
t("đáp án của câu điền khuyết lấy đúng từ bảng", () => {
  assert.strictEqual(b.questions[0].a, 0); // A
  assert.strictEqual(b.questions[1].a, 1); // B
});

console.log("Định dạng cũ «1.» vẫn chạy như trước");
const c = P.parse(
  ["1. She ______ to school every day.", "A. go  B. goes  C. going  D. gone", "", "ĐÁP ÁN", "1. B"].join("\n"),
  { source: "main", file: "old.docx" },
);
t("tách được 1 câu, đáp án B", () => {
  assert.strictEqual(c.questions.length, 1);
  assert.strictEqual(c.questions[0].num, 1);
  assert.strictEqual(c.questions[0].a, 1);
  assert.strictEqual(c.questions[0].passage, null);
});

const DAY1 = `BÀI KIỂM TRA TIẾNG ANH CHUYÊN NGÀNH IT

PART 1: VOCABULARY & GRAMMAR (Questions 1 - 2)

Question 1: The company decided to __________ all sensitive customer data.

A. encrypt

B. decrypt

C. compile

D. execute

Question 2: By the time the bug was reported, the user __________ the corrupted file three times.

A. downloaded

B. has downloaded

C. had downloaded

D. was downloading

PART 4: CLOZE TEST (Questions 3 - 4)

Read the following text and choose the correct word for each numbered space.Cybersecurity has become a top priority for organizations worldwide. As businesses increasingly rely on (3) __________ infrastructures, the risk of cyberattacks rises exponentially. Hackers constantly search for system (4) __________ to gain unauthorized access to sensitive financial records and customer details.

Question 3: Option for space (3):

A. cloud-based

B. paper-based

C. manual

D. analog

Question 4: Option for space (4):

A. vulnerabilities

B. strengths

C. safeguards

D. backups

ANSWER KEY & EXPLANATIONS (ĐÁP ÁN & GIẢI THÍCH CHI TIẾT)

Câu

Đáp án

Giải thích chi tiết

1

A

encrypt (mã hóa). Dịch: Công ty quyết định mã hóa dữ liệu.

2

C

had downloaded (Quá khứ hoàn thành).

3

A

cloud-based infrastructures (cơ sở hạ tầng đám mây).

4

A

vulnerabilities (các lỗ hổng bảo mật).
`;

console.log("Bảng đáp án dạng cột (số / chữ cái / giải thích mỗi ô một dòng)");
const d = P.parse(DAY1, { source: "import", file: "day1.docx" });
t("tách đủ 4 câu, không có cảnh báo", () => {
  assert.strictEqual(d.questions.length, 4);
  assert.deepStrictEqual(d.problems, []);
});
t("lấy đáp án từ cột dọc của bảng", () => {
  assert.deepStrictEqual(d.questions.map((q) => q.a), [0, 2, 0, 0]);
});
t("đoạn văn dính sau câu chỉ dẫn vẫn được tách ra", () => {
  const p = d.questions[2].passage;
  assert.ok(p && /^Cybersecurity has become/.test(p), "đoạn văn phải bắt đầu sau dấu chấm");
  assert.ok(!/numbered space/.test(p), "không giữ phần chỉ dẫn");
  assert.strictEqual(d.questions[3].passage, p);
});
t("«Option for space (3)» đổi thành câu chứa chỗ trống", () => {
  assert.strictEqual(
    d.questions[2].q,
    "As businesses increasingly rely on ________ infrastructures, the risk of cyberattacks rises exponentially.",
  );
  assert.strictEqual(d.questions[0].passage, null);
});
t("chủ điểm bỏ phần «(Questions 1 - 2)»", () => {
  assert.deepStrictEqual(d.topics, ["Từ vựng", "CLOZE TEST"]);
});

console.log("«Read the following…» đứng riêng dòng, đoạn văn nằm ở đoạn kế tiếp");
const f = P.parse(
  [
    "PART 4: CLOZE TEST (Questions 1 - 1)",
    "",
    "Read the following text and choose the correct word for each numbered space.",
    "",
    "Cybersecurity has become a top priority for organizations worldwide. As businesses increasingly rely on (1) __________ infrastructures, the risk of cyberattacks rises exponentially.",
    "",
    "Question 1: Option for space (1):",
    "",
    "A. cloud-based",
    "B. paper-based",
    "C. manual",
    "D. analog",
    "",
    "ĐÁP ÁN",
    "1",
    "A",
  ].join("\n"),
  { source: "import", file: "split.docx" },
);
t("bỏ câu chỉ dẫn, chỉ giữ đoạn văn", () => {
  const p = f.questions[0].passage;
  assert.ok(p && /^Cybersecurity has become/.test(p), "đoạn văn bị dính câu chỉ dẫn: " + p);
  assert.strictEqual(f.questions[0].a, 0);
  assert.strictEqual(
    f.questions[0].q,
    "As businesses increasingly rely on ________ infrastructures, the risk of cyberattacks rises exponentially.",
  );
});

console.log("Bảng 2 cột: bộ đọc .docx chèn «[BẢNG 2 CỘT]» và dấu | giữa hai ô");
const g = P.parse(
  [
    "PART 1: VOCABULARY (1 câu)",
    "",
    "Question 1: The admin must ______ the server after the update.",
    "",
    "[BẢNG 2 CỘT]",
    "A. patch | B. patched",
    "C. patching | D. compile |",
    "",
    "ĐÁP ÁN",
    "1",
    "A",
  ].join("\n"),
  { source: "import", file: "table.docx" },
);
t("bỏ dòng đánh dấu bảng khỏi đề", () => {
  assert.strictEqual(g.questions.length, 1);
  assert.strictEqual(
    g.questions[0].q,
    "The admin must ______ the server after the update.",
  );
});
t("bỏ dấu | dính ở hai đầu đáp án", () => {
  assert.deepStrictEqual(g.questions[0].o, ["patch", "patched", "patching", "compile"]);
  assert.strictEqual(g.questions[0].a, 0);
});

console.log("Đề dán nghiền đáp án vào câu: «… server.(A) is completing(B) has completed…»");
const e = P.parse(
  [
    "1. By the time the team arrives, the IT department ______ the server. (A) is completing(B) has completed(C) completed(D) will have completed",
    "",
    "ĐÁP ÁN",
    "1. D",
  ].join("\n"),
  { source: "import", file: "paste.txt" },
);
t("tách câu và 4 đáp án dính liền", () => {
  assert.strictEqual(e.questions.length, 1);
  assert.strictEqual(e.questions[0].q, "By the time the team arrives, the IT department ______ the server.");
  assert.deepStrictEqual(e.questions[0].o, [
    "is completing",
    "has completed",
    "completed",
    "will have completed",
  ]);
  assert.strictEqual(e.questions[0].a, 3);
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) process.exit(1);
