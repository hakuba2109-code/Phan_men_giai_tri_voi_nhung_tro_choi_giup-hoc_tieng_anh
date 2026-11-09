/* Dịch máy MIỄN PHÍ (0 token AI) cho các câu chưa có bản dịch, ghi vào questions.translation.
     node scripts/translate-bank.js --limit 20     -> dịch 20 câu đầu (mặc định)
     node scripts/translate-bank.js --all          -> dịch hết các câu còn thiếu
     node scripts/translate-bank.js --ids a,b,c    -> chỉ các câu này
     node scripts/translate-bank.js --dry          -> chỉ đếm, không gọi mạng
   Dùng chung src/free-translate.js (không cần key). Lỗi một câu thì bỏ qua và báo lại.
*/
const db = require("../src/db");
const freeTranslate = require("../src/free-translate");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const LIMIT = argv.includes("--all") ? 0 : Number(arg("--limit", 20));
const IDS = String(arg("--ids", ""))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DRY = argv.includes("--dry");
const DELAY = Number(arg("--delay", 120));

const clip = (s, n) => String(s == null ? "" : s).slice(0, n).trim();

async function pick() {
  const where = ["q.translation IS NULL", "coalesce(array_length(q.options, 1), 0) >= 2"];
  const params = [];
  if (IDS.length) {
    params.push(IDS);
    where.push(`q.id = ANY($${params.length})`);
  }
  const limit = LIMIT ? `LIMIT ${LIMIT}` : "";
  const { rows } = await db.query(
    `SELECT q.id, q.question, q.options FROM questions q WHERE ${where.join(" AND ")} ORDER BY q.id ${limit}`,
    params
  );
  return rows;
}

(async function main() {
  if (!freeTranslate.enabled()) {
    console.error("TRANSLATE_FREE=off trong .env — đang tắt dịch miễn phí.");
    process.exit(1);
  }
  const rows = await pick();
  console.log(`Cần dịch: ${rows.length} câu` + (DRY ? " (chạy thử, không gọi mạng)" : ""));
  if (DRY || !rows.length) {
    await db.close();
    return;
  }
  let ok = 0;
  const failed = [];
  for (const q of rows) {
    try {
      const texts = await freeTranslate.translateTexts(
        [clip(q.question, 900)].concat((q.options || []).map((o) => clip(o, 150)))
      );
      const translation = {
        stem_vi: clip(texts[0], 700),
        options_vi: texts.slice(1).map((t) => clip(t, 260)),
      };
      if (!translation.stem_vi) throw new Error("bản dịch rỗng");
      await db.query(
        `UPDATE questions
            SET translation = $2::jsonb, translation_model = 'google-gtx',
                translation_tokens = 0, translation_at = NOW()
          WHERE id = $1 AND translation IS NULL`,
        [q.id, JSON.stringify(translation)]
      );
      ok++;
      console.log(`  ✔ ${q.id}: ${translation.stem_vi.slice(0, 70)}`);
    } catch (err) {
      failed.push(q.id + " (" + err.message + ")");
      console.warn(`  ✖ ${q.id}: ${err.message}`);
    }
    if (DELAY) await new Promise((r) => setTimeout(r, DELAY));
  }
  console.log(`Xong: ${ok} câu có bản dịch miễn phí, ${failed.length} câu lỗi. Tốn 0 token AI.`);
  if (failed.length) console.log("Lỗi: " + failed.join(", "));
  await db.close();
})().catch(async (err) => {
  console.error(err);
  await db.close().catch(() => {});
  process.exit(1);
});
