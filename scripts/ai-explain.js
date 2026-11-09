"use strict";

/* Viết giải thích tiếng Việt cho từng câu trắc nghiệm bằng AI.
   Cú pháp (cmd.exe):
     node scripts/ai-explain.js                        # mọi câu chưa có giải thích
     node scripts/ai-explain.js --limit 30 --dry-run   # thử 30 câu, không ghi CSDL
     node scripts/ai-explain.js --topic "Giới từ"      # chỉ một chủ điểm
     node scripts/ai-explain.js --batch 10 --pause 3000
     node scripts/ai-explain.js --limit 30 --dump explain.json
   Chỉ lấy câu explanation_status = 'none' nên chạy lại an toàn (bị ngắt vẫn tiếp tục được).
   Key AI lấy từ file .env (AI_API_KEY), không nhập tay trên lệnh. */

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ai = require("../src/ai-parser");
const db = require("../src/db");

const LIMITS = { explain: 300, trap: 220, tip: 120 };

const EXPLAIN_SYSTEM = [
  "Bạn là giáo viên TOEIC cho người Việt, mục tiêu 500+.",
  "Với mỗi câu trắc nghiệm trong danh sách, viết bằng TIẾNG VIỆT (giữ thuật ngữ và ví dụ tiếng Anh):",
  "- explain: tối đa 40 từ. Nêu quy tắc hoặc dấu hiệu CỤ THỂ trong câu dẫn tới đáp án đúng.",
  "- trap: tối đa 30 từ. Vì sao người học hay chọn nhầm đáp án nhiễu hấp dẫn nhất.",
  "- tip: tối đa 15 từ. Một mẹo nhớ.",
  "QUY TẮC:",
  "1. Đáp án đúng là đáp án có chỉ số answer_index. KHÔNG tự đổi đáp án.",
  "2. Nếu bạn thực sự cho rằng đáp án đó sai, đặt agrees_with_key = false và nêu lý do ngắn ở concern.",
  "   Nếu đồng ý, agrees_with_key = true và concern là chuỗi rỗng.",
  "3. Không bịa quy tắc. Không chắc thì viết ngắn và nói rõ là gợi ý.",
  "   Không viết chung chung kiểu 'thường được dùng phổ biến nhất' — phải chỉ ra dấu hiệu cụ thể trong câu.",
  "4. Không dùng HTML, không chèn đường dẫn. Chỉ trả về JSON đúng schema, giữ nguyên id từng câu.",
].join("\n");

const EXPLAIN_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          explain: { type: "STRING" },
          trap: { type: "STRING" },
          tip: { type: "STRING" },
          agrees_with_key: { type: "BOOLEAN" },
          concern: { type: "STRING" },
        },
        required: [
          "id",
          "explain",
          "trap",
          "tip",
          "agrees_with_key",
          "concern",
        ],
      },
    },
  },
  required: ["items"],
};

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

function hasFlag(name) {
  return process.argv.indexOf("--" + name) >= 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text, max) {
  if (text.length <= max) return { text, trimmed: false };
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return {
    text: (space > max * 0.6 ? cut.slice(0, space) : cut).trim(),
    trimmed: true,
  };
}

function flatten(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

const letter = (i) => String.fromCharCode(65 + i);
const KEY_MENTION = /(?:đáp án(?:\s+đúng)?|chọn)\s*(?:là|:)?\s*([A-D])\b/i;

/* Kiểm tra một phần tử AI trả về. Trả về { ok, item, problems } — item đã sạch và cắt gọn. */
function checkItem(raw, byId) {
  const problems = [];
  const id = String((raw && raw.id) || "").trim();
  const q = byId.get(id);
  if (!q) return { ok: false, id, problems: ["id lạ hoặc trùng"] };

  const explain = clip(cleanText(raw.explain), LIMITS.explain);
  const trap = clip(cleanText(raw.trap), LIMITS.trap);
  const tip = clip(cleanText(raw.tip), LIMITS.tip);
  if (explain.trimmed) problems.push("explain quá dài, đã cắt");
  if (trap.trimmed) problems.push("trap quá dài, đã cắt");
  if (tip.trimmed) problems.push("tip quá dài, đã cắt");

  if (!explain.text) return { ok: false, id, problems: ["explain rỗng"] };
  if (flatten(explain.text) === flatten(q.question) || flatten(q.question).startsWith(flatten(explain.text)))
    return { ok: false, id, problems: ["explain chỉ nhắc lại đề"] };
  if (!trap.text) problems.push("thiếu trap");
  if (!tip.text) problems.push("thiếu tip");

  const agrees = raw.agrees_with_key !== false;
  let concern = cleanText(raw.concern);
  let disputed = !agrees;
  if (!agrees && !concern) concern = "AI nghi đáp án trong file chưa đúng";

  const key = letter(q.answer_index);
  const mention = KEY_MENTION.exec(explain.text + " " + trap.text);
  if (mention && mention[1].toUpperCase() !== key) {
    disputed = true;
    concern = concern || `Giải thích nhắc đáp án ${mention[1].toUpperCase()} trong khi đáp án đúng là ${key}`;
  }

  return {
    ok: true,
    id,
    disputed: disputed || undefined,
    problems,
    item: {
      id,
      explain: explain.text,
      trap: trap.text,
      tip: tip.text,
      agrees_with_key: agrees && !disputed,
      concern,
    },
  };
}

function buildPrompt(batch) {
  const lines = [
    `Viết giải thích cho ${batch.length} câu trắc nghiệm dưới đây.`,
    "Mỗi câu có: id, chủ điểm, câu hỏi, bốn đáp án (A-D), chỉ số đáp án đúng (answer_index), ghi chú nghĩa từ nếu có.",
    "",
  ];
  for (const q of batch) {
    const opts = (q.options || []).map((o, i) => `${letter(i)}. ${o}`).join(" | ");
    lines.push(`- id: ${q.id}`);
    lines.push(`  topic: ${q.topic}`);
    lines.push(`  question: ${q.question}`);
    lines.push(`  options: ${opts}`);
    lines.push(`  answer_index: ${q.answer_index} (đáp án đúng là ${letter(q.answer_index)})`);
    if (q.note) lines.push(`  note: ${q.note}`);
    if (q.passage) lines.push(`  passage: ${String(q.passage).slice(0, 1500)}`);
  }
  lines.push("", `Trả về đúng ${batch.length} phần tử trong "items", mỗi câu một phần tử, giữ nguyên id.`);
  return lines.join("\n");
}

async function askOnce(batch, usage) {
  const res = await ai.callModel(buildPrompt(batch), {
    system: EXPLAIN_SYSTEM,
    schema: EXPLAIN_SCHEMA,
    temperature: 0,
    maxTokens: 8000,
    tries: 3,
  });
  if (res.usage) {
    usage.in += res.usage.promptTokenCount || 0;
    usage.out += res.usage.candidatesTokenCount || 0;
  }
  let data;
  try {
    data = ai.parseJsonLoose(res.text);
  } catch (err) {
    throw new Error(`AI trả JSON hỏng: ${err.message}`);
  }
  const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  return list;
}

/* Gọi AI cho một lô, tự gọi lại riêng các câu thiếu (tối đa 2 lần). */
async function solveBatch(batch, usage, stats) {
  const byId = new Map(batch.map((q) => [q.id, q]));
  const seen = new Set();
  const done = new Map();

  for (let round = 0; round < 3; round++) {
    const need = round === 0 ? batch : batch.filter((q) => !done.has(q.id));
    if (!need.length) break;
    if (round > 0) stats.retries++;

    const list = await askOnce(need, usage);
    for (const raw of list) {
      const id = String((raw && raw.id) || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const r = checkItem(raw, byId);
      if (!r.ok) {
        stats.rejected.push(`${id}: ${r.problems.join(", ")}`);
        continue;
      }
      for (const p of r.problems) stats.warnings.push(`${id}: ${p}`);
      done.set(id, r);
    }
    if (done.size === batch.length) break;
    await sleep(1000);
  }

  for (const q of batch) {
    if (!done.has(q.id)) stats.missing.push(q.id);
  }
  return done;
}

function printItem(q, res) {
  const key = letter(q.answer_index);
  const mark = res.disputed ? "⚑" : "✔";
  console.log(`\n#${q.id} [${q.topic}] ${mark} ${q.question}`);
  console.log(`   → ${key}. ${q.options[q.answer_index]}`);
  console.log(`   💡 ${res.item.explain}`);
  console.log(`   ⚠ ${res.item.trap}`);
  console.log(`   🧠 ${res.item.tip}`);
  if (res.disputed) console.log(`   ⚑ ${res.item.concern}`);
}

async function saveBatch(done, model) {
  if (!done.size) return 0;
  return db.withTransaction(async (client) => {
    let saved = 0;
    for (const [id, res] of done) {
      const r = await client.query(
        `UPDATE questions
            SET explanation = $2::jsonb,
                explanation_status = $3,
                explanation_model = $4,
                explanation_at = NOW()
          WHERE id = $1 AND explanation_status = 'none'`,
        [
          id,
          JSON.stringify({ ...res.item, id: undefined }),
          res.disputed ? "disputed" : "draft",
          model,
        ],
      );
      saved += r.rowCount;
    }
    return saved;
  });
}

async function main() {
  const limit = Number(arg("limit", 0)) || 0;
  const batchSize = Math.max(1, Number(arg("batch", 15)) || 15);
  const pause = Math.max(0, Number(arg("pause", 2000)) || 0);
  const topic = typeof arg("topic", null) === "string" ? arg("topic", null) : null;
  const dryRun = hasFlag("dry-run");
  const dumpPath = typeof arg("dump", null) === "string" ? arg("dump", null) : null;

  const c = ai.conf();
  if (!c.configured) {
    console.error("Chưa cấu hình AI_API_KEY trong file .env");
    process.exit(2);
  }

  await db.applySchema();

  const params = [];
  let where = `status = 'ok'
    AND options IS NOT NULL AND answer_index IS NOT NULL
    AND explanation_status = 'none'`;
  if (topic) {
    params.push(topic);
    where += ` AND topic = $${params.length}`;
  }
  let tail = "";
  if (limit) {
    params.push(limit);
    tail = ` LIMIT $${params.length}`;
  }
  const q = await db.query(
    `SELECT id, topic, question, options, answer_index, note, passage
       FROM questions
      WHERE ${where}
      ORDER BY topic, number NULLS LAST, id${tail}`,
    params,
  );

  if (!q.rows.length) {
    console.log("Không có câu nào cần viết giải thích.");
    return;
  }

  console.log(
    `Cần giải thích ${q.rows.length} câu · model ${c.model} · lô ${batchSize} · ${dryRun ? "CHẠY THỬ, không ghi CSDL" : "sẽ ghi CSDL"}`,
  );

  const stats = {
    retries: 0,
    warnings: [],
    rejected: [],
    missing: [],
    disputed: 0,
    saved: 0,
  };
  const usage = { in: 0, out: 0 };
  const all = [];
  const t0 = Date.now();

  for (let i = 0; i < q.rows.length; i += batchSize) {
    const batch = q.rows.slice(i, i + batchSize);
    const n = Math.floor(i / batchSize) + 1;
    console.log(`\n— Lô ${n}: câu ${i + 1}–${i + batch.length} —`);

    const done = await solveBatch(batch, usage, stats);
    for (const [id, res] of done) {
      all.push({ ...res.item, id });
      if (res.disputed) stats.disputed++;
      if (dryRun) printItem(batch.find((b) => b.id === id), res);
    }

    if (dryRun) {
      console.log(`   (thử) ${done.size}/${batch.length} câu có giải thích dùng được`);
    } else {
      stats.saved += await saveBatch(done, c.model);
      console.log(`   đã lưu ${done.size}/${batch.length} câu`);
    }

    if (i + batchSize < q.rows.length && pause) await sleep(pause);
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n===== Tổng kết =====");
  console.log(
    `Gọi AI: ${Math.ceil(q.rows.length / batchSize) + stats.retries} lượt · ${secs} giây · token vào ${usage.in}, ra ${usage.out}`,
  );
  console.log(
    `Có giải thích: ${all.length}/${q.rows.length} · đánh dấu disputed: ${stats.disputed} · ${dryRun ? "chưa ghi CSDL" : `đã lưu ${stats.saved} câu (draft/disputed)`}`,
  );
  if (stats.rejected.length) {
    console.log(`Bỏ ${stats.rejected.length} phần tử không đạt:`);
    for (const r of stats.rejected) console.log(" * " + r);
  }
  if (stats.missing.length) {
    console.log(`Thiếu ${stats.missing.length} câu (để nguyên 'none'): ${stats.missing.join(", ")}`);
  }
  if (stats.warnings.length) {
    console.log(`Cảnh báo nhỏ ${stats.warnings.length}:`);
    for (const w of stats.warnings.slice(0, 20)) console.log(" * " + w);
  }

  if (dumpPath) {
    fs.writeFileSync(
      dumpPath,
      JSON.stringify({ model: c.model, dryRun, at: new Date().toISOString(), usage, items: all }, null, 2),
      "utf8",
    );
    console.log("Đã ghi:", path.resolve(dumpPath));
  }

  if (!dryRun) {
    const s = await db.query(
      `SELECT explanation_status AS status, count(*)::int AS n
         FROM questions GROUP BY explanation_status ORDER BY 1`,
    );
    console.log(
      "CSDL hiện tại: " + s.rows.map((r) => `${r.status} ${r.n}`).join(" · "),
    );
  }
}

main()
  .catch((err) => {
    console.error("Lỗi:", err.message);
    if (err.quota) console.error("(Gặp giới hạn tần suất của dịch vụ AI — chạy lại sau ít phút.)");
    process.exitCode = 1;
  })
  .finally(() => db.close());
