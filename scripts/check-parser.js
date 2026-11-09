/* Kiểm tra nhanh bộ phân tích: tách văn bản từ docs/*.docx rồi báo số câu nhận được.
   node scripts/check-parser.js */
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const P = require("./parser");

const ROOT = path.join(__dirname, "..");
const FILES = [
  ["docs/Bai_Tap_TOEIC_50_Cau_Nang_Cao_Giai_Doan_1.docx", "boss"],
  ["docs/Bai_Tap_TOEIC_Giai_Doan_1_Nang_Cao.docx", "main"]
];

(async function main() {
  for (const [rel, source] of FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { console.warn("Thiếu file:", rel); continue; }
    const { value } = await mammoth.extractRawText({ path: abs });
    const r = P.parse(value, { source, file: path.basename(abs) });
    const unique = new Set(r.questions.map((q) => q.q)).size;
    console.log(`${rel} [${source}]: ${r.questions.length} câu tách được, ${unique} câu khác nhau, ${r.problems.length} cảnh báo`);
    console.log("  chủ điểm:", JSON.stringify(r.topics));
    r.problems.slice(0, 5).forEach((p) => console.log(`  - câu ${p.num}: ${p.reason}`));
  }
})().catch((err) => { console.error(err); process.exit(1); });
