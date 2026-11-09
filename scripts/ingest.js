/* nạp đề từ file Word vào PostgreSQL:
     node scripts/ingest.js                      -> nạp docs/*.docx
     node scripts/ingest.js --seed-only          -> chỉ xuất seed.json từ CSDL
     node scripts/ingest.js file1.docx file2.docx
*/
const fs = require("fs");
const path = require("path");
const db = require("../src/db");
const importer = require("../src/importer");

const ROOT = path.join(__dirname, "..");

async function writeSeed() {
  const questions = await importer.listQuestions();
  const topics = await db.query(`SELECT name, position FROM topics ORDER BY position, name`);
  const files = await importer.listFiles();
  const counts = await db.query(`SELECT source, count(*)::int AS count FROM questions GROUP BY source`);
  const seed = {
    generatedAt: new Date().toISOString(),
    stats: Object.fromEntries(counts.rows.map((r) => [r.source, r.count])),
    topics: topics.rows.map((t) => t.name),
    files,
    questions,
  };
  fs.writeFileSync(path.join(ROOT, "seed.json"), JSON.stringify(seed, null, 2), "utf8");
  console.log(`Đã ghi seed.json: ${questions.length} câu, ${files.length} bộ đề.`);
  return seed;
}

async function main() {
  const args = process.argv.slice(2);
  const seedOnly = args.includes("--seed-only");
  const files = args.filter((a) => !a.startsWith("--"));

  await db.applySchema();

  if (!seedOnly) {
    const list = files.length
      ? files
      : fs.readdirSync(path.join(ROOT, "docs")).filter((f) => /\.(docx|md|txt)$/i.test(f)).map((f) => path.join("docs", f));
    for (const rel of list) {
      const abs = path.resolve(ROOT, rel);
      const buffer = fs.readFileSync(abs);
      const result = await importer.importFile({ filename: path.basename(abs), buffer });
      console.log(
        `${path.basename(abs)} [${result.source}]: tách ${result.parsed} câu, thêm mới ${result.inserted}, trùng ${result.duplicates}, lỗi ${result.problems.length}`
      );
      result.problems.slice(0, 5).forEach((p) => console.log(`   - câu ${p.num}: ${p.reason}`));
    }
  }

  const seed = await writeSeed();
  const byTopic = {};
  seed.questions.forEach((q) => (byTopic[q.t] = (byTopic[q.t] || 0) + 1));
  console.log("Theo chủ điểm:", JSON.stringify(byTopic));
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
