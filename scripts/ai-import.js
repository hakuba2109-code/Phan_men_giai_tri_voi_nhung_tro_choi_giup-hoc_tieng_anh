"use strict";

/* Nhập đề bằng AI từ dòng lệnh.
   Cú pháp (cmd.exe):
     node scripts/ai-import.js "C:\duong\dan\Bo_De.docx"
     node scripts/ai-import.js "C:\duong\dan\Bo_De.docx" --dump preview.json
     node scripts/ai-import.js "C:\duong\dan\Bo_De.docx" --commit
     node scripts/ai-import.js "C:\duong\dan\Bo_De.docx" --raw
     node scripts/ai-import.js "C:\duong\dan\Bo_De.docx" --no-solve
   --dump : ghi danh sách câu đã chuẩn hoá ra file JSON để xem
   --raw  : giữ lại văn bản thô của AI vào file .raw.txt (để dò lỗi đọc JSON)
   --no-solve : không gọi lượt AI tự giải các câu file thiếu đáp án
   --commit: lưu thật vào CSDL gameEnglish
   Key AI lấy từ file .env (AI_API_KEY), không nhập tay trên lệnh. */

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ai = require("../src/ai-parser");
const importer = require("../src/importer");

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

function hasFlag(name) {
  return process.argv.indexOf("--" + name) >= 0;
}

function showTable(questions) {
  const by = {};
  for (const q of questions) (by[q.qtype] = by[q.qtype] || []).push(q);
  for (const type of Object.keys(by)) {
    console.log(`\n[${type}] ${ai.TYPES[type].label} — ${by[type].length} câu${by[type][0].playable ? "" : " (chưa hỗ trợ chơi)"}`);
    for (const q of by[type]) {
      const ans = q.playable && q.a != null
        ? `${String.fromCharCode(65 + q.a)}. ${q.o[q.a]}`
        : JSON.stringify(q.payload).slice(0, 110);
      console.log(`  #${q.num} ${q.t} | ${q.q.slice(0, 90)}`);
      console.log(`       -> ${ans}`);
    }
  }
}

async function main() {
  const target = process.argv[2];
  if (!target || target.startsWith("--")) {
    console.error("Dùng: node scripts/ai-import.js <file .docx|.md|.txt> [--dump ten.json] [--commit] [--raw] [--no-solve] [--max-chars 2600]");
    process.exit(2);
  }
  const file = path.resolve(target);
  if (!fs.existsSync(file)) {
    console.error("Không tìm thấy file:", file);
    process.exit(2);
  }
  const c = ai.conf();
  if (!c.configured) {
    console.error("Chưa cấu hình AI_API_KEY trong file .env");
    process.exit(2);
  }

  const buffer = fs.readFileSync(file);
  const filename = path.basename(file);
  const rawText = await importer.extractText(filename, buffer);
  console.log(`Đọc ${filename}: ${rawText.length} ký tự. Model: ${c.model}`);

  const dumpPath = arg("dump", null);
  const rawPath = hasFlag("raw") ? (dumpPath ? dumpPath + ".raw.txt" : file + ".raw.txt") : null;
  const rawChunks = [];

  const result = await ai.analyze(rawText, {
    maxChars: Number(arg("max-chars", 0)) || undefined,
    solve: !hasFlag("no-solve"),
    onChunk: ({ header, text, finishReason }) => {
      rawChunks.push(`===== ${header} finishReason=${finishReason} =====\n${text}\n`);
      if (rawPath) fs.writeFileSync(rawPath, rawChunks.join("\n"), "utf8");
    },
  });

  console.log(`\nAI trả về ${result.questions.length}/${result.chunks} đợt, token: ${JSON.stringify(result.usage)}`);
  if (result.solved) console.log(`Đã tự giải ${result.solved} câu thiếu đáp án trong file (nên kiểm tra lại).`);
  else if (result.solveSkipped) console.log("Bỏ qua lượt tự giải đáp án (--no-solve hoặc AI_SOLVE=off).");
  if (rawPath) console.log("Văn bản thô của AI:", rawPath);
  showTable(result.questions);

  if (result.problems.length) {
    console.log("\n--- Vấn đề cần kiểm tra ---");
    for (const p of result.problems) console.log(" * " + p);
  }

  if (dumpPath) {
    fs.writeFileSync(dumpPath, JSON.stringify({ filename, model: result.model, ...result }, null, 2), "utf8");
    console.log("\nĐã ghi:", path.resolve(dumpPath));
  }

  if (hasFlag("commit")) {
    const saved = await importer.saveAiQuestions({
      filename, buffer, rawText,
      questions: result.questions,
      source: "ai",
    });
    console.log(`\nĐã lưu vào CSDL: ${saved.inserted} câu mới, ${saved.duplicates} câu trùng.`);
    for (const s of saved.skipped) console.log(` - bỏ qua ${s.id}: ${s.reason}`);
  } else {
    console.log("\nChưa lưu vào CSDL. Thêm --commit để lưu.");
  }
}

main()
  .catch((err) => {
    console.error("Lỗi:", err.message);
    if (err.cause) console.error(err.cause);
    process.exitCode = 1;
  })
  .finally(() => require("../src/db").close());
