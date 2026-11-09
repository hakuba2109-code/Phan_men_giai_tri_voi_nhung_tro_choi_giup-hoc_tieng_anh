"use strict";
/* In ra đúng chữ mà bộ phân tích AI sẽ nhận được từ một file Word, để kiểm tra bảng.
   node scripts/check-docx-tables.js "C:\duong\dan\Bo_De.docx"
   Dòng nằm giữa [BẢNG 2 CỘT] và dòng trống kế tiếp là bảng nối cặp 2 cột. */
const fs = require("fs");
const path = require("path");
const { docxToText } = require("../src/docx-text");

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("Dùng: node scripts/check-docx-tables.js <file.docx>");
    process.exit(2);
  }
  const text = await docxToText(fs.readFileSync(file));
  const tables = (text.match(/\[BẢNG 2 CỘT\]/g) || []).length;
  console.log(text);
  console.log(
    `\n--- ${path.basename(file)}: ${text.length} ký tự, ${tables} bảng 2 cột được nhận ---`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
