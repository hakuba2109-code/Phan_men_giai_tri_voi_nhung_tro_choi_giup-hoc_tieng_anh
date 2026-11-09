"use strict";

/* Kiểm bộ phân tích miễn phí (explainer.js) trên toàn bộ ngân hàng câu hỏi:
   0 token, không gọi AI, chỉ đọc CSDL rồi in ra độ phủ và mọi mâu thuẫn tự phát hiện.

   Cú pháp (cmd.exe):
     cd /d E:\Toeic\Tro_Choi
     node scripts\audit-free-explainer.js            :: đếm phủ + dò mâu thuẫn
     node scripts\audit-free-explainer.js --show 8   :: in mẫu 8 câu mỗi loại phân tích */

const SHOW = (() => {
  const i = process.argv.indexOf("--show");
  return i > 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

const d = require("../src/db");
const X = require("./explainer");

/* Những câu mà bộ luật KHÔNG được phép nói sai — kiểm theo TỪNG dòng. */
const LINE_RULES = [
  [/chưa xác định được lớp từ.*→ loại/, "vừa nhận không rõ lớp từ vừa loại lựa chọn"],
];
const HEAD_RULES = [
  [/→ đáp án [\s\S]*chưa loại được hết/, "vừa kết luận đáp án vừa nhận chưa loại hết"],
];

(async () => {
  const r = await d.query(
    "select question, options, answer_index, payload->'g' as g from questions order by id",
  );
  const kinds = {};
  const samples = {};
  let analyzed = 0;
  const bad = [];
  for (const q of r.rows) {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.answer_index == null) continue;
    const a = X.analyze({ q: q.question, o: q.options, a: q.answer_index, g: q.g }, null);
    kinds[a.kind] = (kinds[a.kind] || 0) + 1;
    if (a.kind !== "none") {
      analyzed++;
      (samples[a.kind] = samples[a.kind] || []).push(a);
      const head = (a.head || []).join(" ");
      const short = q.question.replace(/\s+/g, " ").slice(0, 70);
      (a.options || []).forEach((line) =>
        LINE_RULES.forEach(([re, why]) => {
          if (re.test(line)) bad.push(why + " :: " + short + " || " + line);
        }),
      );
      HEAD_RULES.forEach(([re, why]) => {
        if (re.test(head)) bad.push(why + " :: " + short);
      });
      // Đầu bài khẳng định cần một lớp từ thì dòng của đáp án phải mang đúng nhãn đó.
      const need = head.match(/cần (danh từ|tính từ|trạng từ|động từ)/);
      if (need && /→ đáp án/.test(head)) {
        const line = (a.options[q.answer_index] || "").replace(/✅.*/, "");
        if (!line.includes(need[1]) && !/nghĩa:/.test(line))
          bad.push(
            "cần " + need[1] + " nhưng đáp án mang nhãn khác :: " +
              q.question.slice(0, 60) + " || " + line,
          );
      }
    }
  }
  console.log("câu có phân tích miễn phí: " + analyzed + "/" + r.rowCount);
  console.log("theo loại:", JSON.stringify(kinds));
  console.log("mâu thuẫn: " + bad.length);
  bad.slice(0, 20).forEach((b) => console.log("  - " + b));
  if (SHOW)
    Object.keys(samples).forEach((k) => {
      console.log("\n===== " + k);
      samples[k].slice(0, SHOW).forEach((a) => {
        console.log("  " + (a.head || []).join(" | "));
        (a.options || []).forEach((s) => console.log("    " + s));
      });
    });
  await d.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
