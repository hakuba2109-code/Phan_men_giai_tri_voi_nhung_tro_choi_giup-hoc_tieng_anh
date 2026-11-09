"use strict";

/* Bổ sung "phân tích miễn phí" cho ngân hàng câu hỏi đã có: 0 token, không gọi AI.
   Script đọc danh sách từ vựng trong file gốc (source_files.raw_text), tra nghĩa
   cho từng lựa chọn rồi ghi vào questions.payload.g. Trò chơi dùng dữ liệu này
   (và luật ngữ pháp có sẵn) để viết giải thích chi tiết trong khối 💡.

   Cú pháp (cmd.exe):
     node scripts/explain-free.js --stat            chỉ đếm, không ghi
     node scripts/explain-free.js                   chạy toàn bộ ngân hàng
     node scripts/explain-free.js --file 34         chỉ một bộ đề
     node scripts/explain-free.js --reset           xóa payload.g đã ghi (để làm lại) */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = require("../src/db");
const X = require("./explainer");

const RESET = process.argv.indexOf("--reset") >= 0;
const STAT = process.argv.indexOf("--stat") >= 0;
const fi = process.argv.indexOf("--file");
const onlyFile = fi > 0 ? Number(process.argv[fi + 1]) : 0;

async function main() {
  const fileFilter = onlyFile ? "where id = $" + 1 : "";
  const files = await db.query(
    `select id, filename, raw_text from source_files ${fileFilter} order by id`,
    onlyFile ? [onlyFile] : [],
  );
  let updated = 0,
    skipped = 0,
    noGlossary = 0,
    explained = 0,
    total = 0;

  for (const f of files.rows) {
    const glossary = X.harvestGlossary(f.raw_text || "");
    if (!Object.keys(glossary).length) {
      noGlossary++;
      continue;
    }
    const { rows } = await db.query(
      `select id, question, options, answer_index, payload from questions where file_id = $1`,
      [f.id],
    );
    let changed = 0;
    for (const q of rows) {
      total++;
      const payload = q.payload || {};
      if (RESET) {
        if (payload.g === undefined) {
          skipped++;
          continue;
        }
        const rest = Object.assign({}, payload);
        delete rest.g;
        await db.query("update questions set payload = $2::jsonb where id = $1", [
          q.id,
          JSON.stringify(rest),
        ]);
        updated++;
        continue;
      }
      const hints = q.options
        ? X.hintsFor({ q: q.question, o: q.options }, glossary)
        : null;
      if (!hints) {
        skipped++;
        continue;
      }
      const a = X.analyze(
        { q: q.question, o: q.options, a: q.answer_index, g: hints },
        null,
      );
      if (a && a.kind !== "none") explained++;
      const before = JSON.stringify(payload.g || null);
      if (before === JSON.stringify(hints)) {
        skipped++;
        continue;
      }
      if (!STAT)
        await db.query("update questions set payload = $2::jsonb where id = $1", [
          q.id,
          JSON.stringify(Object.assign({}, payload, { g: hints })),
        ]);
      updated++;
      changed++;
    }
    console.log(
      `  file ${f.id} (${f.filename}): ${Object.keys(glossary).length} từ vựng, ${changed} câu gắn nghĩa`,
    );
  }
  console.log(
    `\n${RESET ? "Đã gỡ payload.g ở" : STAT ? "Sẽ ghi" : "Đã ghi"} ${updated} câu · bỏ qua ${skipped} · không có danh sách từ: ${noGlossary} bộ đề` +
      (STAT ? "" : ` · phân tích được ${explained} câu bằng luật`),
  );
}

main()
  .catch((err) => {
    console.error("Lỗi:", err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
