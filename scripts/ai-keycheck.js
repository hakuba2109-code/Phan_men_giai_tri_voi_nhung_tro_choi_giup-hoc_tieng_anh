"use strict";

/* Kiểm tra đáp án đang lưu bằng cách để AI tự giải câu hỏi mà KHÔNG thấy đáp án.
   Cú pháp (cmd.exe):
     node scripts/ai-keycheck.js --limit 30 --dry-run   # chỉ in chỗ lệch, không ghi gì
     node scripts/ai-keycheck.js --limit 30 --fix       # sửa chỗ AI chắc chắn (high)
     node scripts/ai-keycheck.js --fix                  # quét mọi câu chưa kiểm tra
     node scripts/ai-keycheck.js --fix --min-confidence medium
     node scripts/ai-keycheck.js --redo                 # kiểm tra lại câu đã có trong sổ
   Mỗi lần chạy ghi vào bảng answer_key_checks (đáp án cũ + đáp án AI + lý do) nên có thể
   xem lại và hoàn tác. Sửa đáp án sẽ xóa giải thích cũ của câu đó (vì giải thích theo đáp án cũ).
   Key AI lấy từ .env (AI_API_KEY), không nhập tay trên lệnh. */

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ai = require("../src/ai-parser");
const db = require("../src/db");

const CONF_RANK = { high: 3, medium: 2, low: 1 };

const KEYCHECK_SYSTEM = [
  "Bạn là giáo viên TOEIC cho người Việt, mục tiêu 500+.",
  "Với từng câu trắc nghiệm, hãy TỰ GIẢI và chọn đúng một đáp án A, B, C hoặc D.",
  "Bạn KHÔNG được cho biết đáp án nào đang được lưu — hãy giải theo ngữ pháp và ngữ nghĩa.",
  "QUY TẮC:",
  "1. answer: đúng một chữ cái A|B|C|D.",
  "2. confidence: high nếu dấu hiệu trong câu chỉ ra chắc chắn; medium nếu có hai phương án cùng hợp lý;",
  "   low nếu phải đoán.",
  "3. reason: tối đa 25 từ, tiếng Việt, nêu dấu hiệu cụ thể trong câu (giữ thuật ngữ tiếng Anh).",
  "4. Không bỏ câu nào, giữ nguyên id. Chỉ trả về JSON đúng schema.",
].join("\n");

const KEYCHECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          answer: { type: "STRING", enum: ["A", "B", "C", "D"] },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          reason: { type: "STRING" },
        },
        required: ["id", "answer", "confidence", "reason"],
      },
    },
  },
  required: ["items"],
};

const CRITIQUE_SYSTEM = [
  "Bạn là giáo viên TOEIC đang kiểm tra đáp án của một ngân hàng câu hỏi.",
  "Mỗi câu có kèm đáp án ĐANG ĐƯỢC LƯU. Hãy xét CẢ BỐN phương án:",
  "1. valid: các phương án ĐÚNG ngữ pháp và hợp ngữ cảnh. Có thể nhiều hơn một — ví dụ",
  "   'who' và 'that' cùng đúng khi thay cho chủ ngữ chỉ người trong mệnh đề xác định.",
  "2. key_valid: đáp án đang lưu có nằm trong valid hay không.",
  "3. best: phương án phù hợp nhất với ý định của câu (nếu key_valid = true thì chính là đáp án đang lưu).",
  "4. confidence: high chỉ khi chắc chắn, không còn khả năng thứ hai.",
  "5. reason: tối đa 30 từ, tiếng Việt, nêu dấu hiệu cụ thể (giữ thuật ngữ tiếng Anh).",
  "6. Không bỏ câu nào, giữ nguyên id. Chỉ trả về JSON đúng schema.",
].join("\n");

const CRITIQUE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          valid: { type: "ARRAY", items: { type: "STRING", enum: ["A", "B", "C", "D"] } },
          key_valid: { type: "BOOLEAN" },
          best: { type: "STRING", enum: ["A", "B", "C", "D"] },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          reason: { type: "STRING" },
        },
        required: ["id", "valid", "key_valid", "best", "confidence", "reason"],
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
const letter = (i) => String.fromCharCode(65 + i);

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function buildPrompt(batch) {
  const lines = [
    `Giải ${batch.length} câu trắc nghiệm dưới đây. Mỗi câu có id, chủ điểm, câu hỏi, bốn đáp án A-D.`,
    "",
  ];
  for (const q of batch) {
    lines.push(`- id: ${q.id}`);
    lines.push(`  topic: ${q.topic}`);
    lines.push(`  question: ${q.question}`);
    lines.push(`  options: ${q.options.map((o, i) => `${letter(i)}. ${o}`).join(" | ")}`);
    if (q.note) lines.push(`  note: ${q.note}`);
    if (q.passage) lines.push(`  passage: ${String(q.passage).slice(0, 1500)}`);
  }
  lines.push("", `Trả về đúng ${batch.length} phần tử trong "items", giữ nguyên id.`);
  return lines.join("\n");
}

async function askOnce(batch, usage) {
  const res = await ai.callModel(buildPrompt(batch), {
    system: KEYCHECK_SYSTEM,
    schema: KEYCHECK_SCHEMA,
    temperature: 0,
    maxTokens: 6000,
    tries: 3,
  });
  if (res.usage) {
    usage.in += res.usage.promptTokenCount || 0;
    usage.out += res.usage.candidatesTokenCount || 0;
  }
  const data = ai.parseJsonLoose(res.text);
  return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
}

async function solveBatch(batch, usage, stats) {
  const byId = new Map(batch.map((q) => [q.id, q]));
  const done = new Map();

  for (let round = 0; round < 3; round++) {
    const need = round === 0 ? batch : batch.filter((q) => !done.has(q.id));
    if (!need.length) break;
    if (round > 0) stats.retries++;

    for (const raw of await askOnce(need, usage)) {
      const id = String((raw && raw.id) || "").trim();
      const q = byId.get(id);
      if (!q || done.has(id)) continue;
      const letterAnswer = String((raw.answer || "")).trim().toUpperCase().slice(0, 1);
      const idx = "ABCD".indexOf(letterAnswer);
      if (idx < 0) {
        stats.rejected.push(`${id}: đáp án AI không hợp lệ`);
        continue;
      }
      const confidence = String(raw.confidence || "").toLowerCase();
      if (!CONF_RANK[confidence]) {
        stats.rejected.push(`${id}: confidence lạ`);
        continue;
      }
      done.set(id, {
        id,
        q,
        aiIndex: idx,
        confidence,
        reason: cleanText(raw.reason),
        stored: q.answer_index,
      });
    }
    if (done.size === batch.length) break;
    await sleep(1000);
  }

  for (const q of batch) if (!done.has(q.id)) stats.missing.push(q.id);
  return done;
}

function buildCritiquePrompt(items) {
  const lines = [
    `Kiểm tra đáp án đang lưu của ${items.length} câu dưới đây.`,
    "",
  ];
  for (const it of items) {
    const q = it.q;
    lines.push(`- id: ${q.id}`);
    lines.push(`  topic: ${q.topic}`);
    lines.push(`  question: ${q.question}`);
    lines.push(`  options: ${q.options.map((o, i) => `${letter(i)}. ${o}`).join(" | ")}`);
    lines.push(`  đáp án đang lưu: ${letter(it.stored)}. ${q.options[it.stored]}`);
    if (q.note) lines.push(`  note: ${q.note}`);
    if (q.passage) lines.push(`  passage: ${String(q.passage).slice(0, 1500)}`);
  }
  lines.push("", `Trả về đúng ${items.length} phần tử trong "items", giữ nguyên id.`);
  return lines.join("\n");
}

/* Gọi lượt 2 cho những câu lệch đáp án: AI nhìn thấy đáp án đang lưu và phán đúng/sai. */
async function critiqueBatch(items, usage, stats) {
  const out = new Map();
  const byId = new Map(items.map((it) => [it.id, it]));

  for (let round = 0; round < 3; round++) {
    const need = round === 0 ? items : items.filter((it) => !out.has(it.id));
    if (!need.length) break;
    if (round > 0) stats.retries++;

    const res = await ai.callModel(buildCritiquePrompt(need), {
      system: CRITIQUE_SYSTEM,
      schema: CRITIQUE_SCHEMA,
      temperature: 0,
      maxTokens: 4000,
      tries: 3,
    });
    if (res.usage) {
      usage.in += res.usage.promptTokenCount || 0;
      usage.out += res.usage.candidatesTokenCount || 0;
    }
    const data = ai.parseJsonLoose(res.text);
    const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    for (const raw of list) {
      const id = String((raw && raw.id) || "").trim();
      if (!byId.has(id) || out.has(id)) continue;
      const valid = Array.isArray(raw.valid)
        ? raw.valid
            .map((x) => String(x || "").trim().toUpperCase().slice(0, 1))
            .filter((l) => "ABCD".includes(l))
        : [];
      const best = "ABCD".indexOf(String(raw.best || "").trim().toUpperCase().slice(0, 1));
      const confidence = String(raw.confidence || "").toLowerCase();
      if (best < 0 || !CONF_RANK[confidence] || !valid.length) {
        stats.rejected.push(`${id}: phản biện không hợp lệ`);
        continue;
      }
      // Tin danh sách phương án AI liệt kê hơn cờ key_valid (hai thứ có thể lệch nhau)
      const stored = byId.get(id).stored;
      out.set(id, {
        valid,
        ok: valid.includes(letter(stored)),
        index: best,
        confidence,
        reason: cleanText(raw.reason),
      });
    }
  }
  return out;
}

async function persist(results, { fix, minConf, model }) {
  const changed = [];
  const review = [];
  const ok = [];

  await db.withTransaction(async (client) => {
    for (const r of results) {
      const differs = r.aiIndex !== r.stored;
      const blindSure = CONF_RANK[r.confidence] >= CONF_RANK[minConf];
      const crit = r.critique || null;
      const critSure = crit && CONF_RANK[crit.confidence] >= CONF_RANK[minConf];
      let action = "agree";
      if (differs) {
        if (crit && crit.ok) action = "agree";
        else if (fix && blindSure && critSure && crit.index === r.aiIndex) action = "fix";
        else action = "review";
      }

      if (action === "fix") {
        const u = await client.query(
          `UPDATE questions
              SET answer_index = $2,
                  explanation = NULL,
                  explanation_status = 'none',
                  explanation_model = NULL,
                  explanation_at = NULL
            WHERE id = $1 AND answer_index = $3`,
          [r.id, r.aiIndex, r.stored],
        );
        if (!u.rowCount) action = "review";
      }

      const reason = !differs
        ? r.reason
        : [
            r.reason,
            crit
              ? `phản biện: hợp lệ ${crit.valid.join(",")} · đáp án đang lưu ${crit.ok ? "đúng" : "sai"} — ${crit.reason}`
              : "phản biện: không có kết quả",
          ]
            .filter(Boolean)
            .join(" | ");

      await client.query(
        `INSERT INTO answer_key_checks
           (question_id, ai_index, stored_index, confidence, reason, action, model,
            critique_ok, critique_index, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (question_id) DO UPDATE
           SET ai_index = EXCLUDED.ai_index,
               stored_index = EXCLUDED.stored_index,
               confidence = EXCLUDED.confidence,
               reason = EXCLUDED.reason,
               action = EXCLUDED.action,
               model = EXCLUDED.model,
               critique_ok = EXCLUDED.critique_ok,
               critique_index = EXCLUDED.critique_index,
               manual_index = NULL,
               checked_at = NOW()`,
        [
          r.id,
          r.aiIndex,
          r.stored,
          r.confidence,
          reason,
          action,
          model,
          crit ? crit.ok : null,
          crit ? crit.index : null,
        ],
      );

      if (action === "fix") changed.push(r);
      else if (action === "review") review.push(r);
      else ok.push(r);
    }
  });

  return { changed, review, ok };
}

function printDiff(q, r, action) {
  console.log(
    `\n#${r.id} [${q.topic}] đáp án file: ${letter(r.stored)} → AI: ${letter(r.aiIndex)} (${r.confidence}) ${action === "fix" ? "· ĐÃ SỬA" : "· chờ xem lại"}`,
  );
  console.log(`   ${q.question}`);
  console.log(`   ${letter(r.stored)}. ${q.options[r.stored]}   |   ${letter(r.aiIndex)}. ${q.options[r.aiIndex]}`);
  if (r.reason) console.log(`   ${r.reason}`);
  if (r.critique)
    console.log(
      `   phản biện: hợp lệ ${r.critique.valid.join(", ")} · đáp án đang lưu ${r.critique.ok ? "ĐÚNG" : "SAI"} (${r.critique.confidence}) ${r.critique.reason}`,
    );
}

async function main() {
  const limit = Number(arg("limit", 0)) || 0;
  const batchSize = Math.max(1, Number(arg("batch", 15)) || 15);
  const pause = Math.max(0, Number(arg("pause", 2000)) || 0);
  const topic = typeof arg("topic", null) === "string" ? arg("topic", null) : null;
  const ids =
    typeof arg("ids", null) === "string"
      ? arg("ids", null).split(",").map((s) => s.trim()).filter(Boolean)
      : null;
  const dryRun = hasFlag("dry-run");
  const fix = hasFlag("fix");
  const redo = hasFlag("redo");
  const minConf = String(arg("min-confidence", "high")).toLowerCase();
  const dumpPath = typeof arg("dump", null) === "string" ? arg("dump", null) : null;
  if (!CONF_RANK[minConf]) {
    console.error("--min-confidence chỉ nhận high | medium | low");
    process.exit(2);
  }

  const c = ai.conf();
  if (!c.configured) {
    console.error("Chưa cấu hình AI_API_KEY trong file .env");
    process.exit(2);
  }

  await db.applySchema();

  const params = [];
  let where = `q.status = 'ok'
    AND q.options IS NOT NULL AND q.answer_index IS NOT NULL
    AND array_length(q.options, 1) = 4`;
  if (!redo)
    where += ` AND NOT EXISTS (SELECT 1 FROM answer_key_checks c WHERE c.question_id = q.id)`;
  if (ids) {
    params.push(ids);
    where += ` AND q.id = ANY($${params.length}::text[])`;
  }
  if (topic) {
    params.push(topic);
    where += ` AND q.topic = $${params.length}`;
  }
  let tail = "";
  if (limit) {
    params.push(limit);
    tail = ` LIMIT $${params.length}`;
  }
  const q = await db.query(
    `SELECT q.id, q.topic, q.question, q.options, q.answer_index, q.note, q.passage
       FROM questions q
      WHERE ${where}
      ORDER BY q.topic, q.number NULLS LAST, q.id${tail}`,
    params,
  );

  if (!q.rows.length) {
    console.log("Không còn câu nào cần kiểm tra đáp án.");
    return;
  }

  console.log(
    `Kiểm tra ${q.rows.length} câu · model ${c.model} · lô ${batchSize} · ` +
      (dryRun ? "CHẠY THỬ, không ghi gì" : fix ? `sẽ sửa câu lệch ở mức ${minConf}+` : "chỉ ghi sổ, không sửa đáp án"),
  );

  const stats = { retries: 0, rejected: [], missing: [], changed: 0, review: 0, same: 0 };
  const usage = { in: 0, out: 0 };
  const t0 = Date.now();

  for (let i = 0; i < q.rows.length; i += batchSize) {
    const batch = q.rows.slice(i, i + batchSize);
    console.log(`\n— Lô ${Math.floor(i / batchSize) + 1}: câu ${i + 1}–${i + batch.length} —`);

    const done = await solveBatch(batch, usage, stats);
    const results = [...done.values()];

    const mismatches = results.filter((r) => r.aiIndex !== r.stored);
    if (mismatches.length) {
      const crit = await critiqueBatch(mismatches, usage, stats);
      for (const r of mismatches) r.critique = crit.get(r.id) || null;
    }

    if (dryRun) {
      for (const r of mismatches) printDiff(r.q, r, "review");
      stats.same += results.length - mismatches.length;
      stats.review += mismatches.length;
      console.log(
        `   (thử) ${results.length}/${batch.length} câu có đáp án AI · ${mismatches.length} câu lệch`,
      );
    } else {
      const out = await persist(results, { fix, minConf, model: c.model });
      for (const r of out.changed) printDiff(r.q, r, "fix");
      for (const r of out.review) printDiff(r.q, r, "review");
      stats.changed += out.changed.length;
      stats.review += out.review.length;
      stats.same += out.ok.length;
      console.log(
        `   đã ghi sổ ${results.length}/${batch.length} câu · sửa ${out.changed.length} · lệch chưa sửa ${out.review.length}`,
      );
    }

    if (i + batchSize < q.rows.length && pause) await sleep(pause);
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n===== Tổng kết =====");
  console.log(
    `Gọi AI: ${Math.ceil(q.rows.length / batchSize) + stats.retries} lượt · ${secs} giây · token vào ${usage.in}, ra ${usage.out}`,
  );
  console.log(
    `Khớp: ${stats.same} · đã sửa đáp án: ${stats.changed} · lệch chưa sửa: ${stats.review}${dryRun ? " (chạy thử)" : ""}`,
  );
  if (stats.rejected.length) {
    console.log(`Bỏ ${stats.rejected.length} phần tử không đạt:`);
    for (const r of stats.rejected) console.log(" * " + r);
  }
  if (stats.missing.length) {
    console.log(`Thiếu ${stats.missing.length} câu: ${stats.missing.join(", ")}`);
  }

  if (dumpPath) {
    fs.writeFileSync(
      dumpPath,
      JSON.stringify({ model: c.model, dryRun, fix, at: new Date().toISOString(), usage, stats }, null, 2),
      "utf8",
    );
    console.log("Đã ghi:", path.resolve(dumpPath));
  }

  if (!dryRun) {
    const s = await db.query(
      `SELECT action, count(*)::int AS n FROM answer_key_checks GROUP BY action ORDER BY 1`,
    );
    console.log("Sổ kiểm tra: " + s.rows.map((r) => `${r.action} ${r.n}`).join(" · "));
  }
}

main()
  .catch((err) => {
    console.error("Lỗi:", err.message);
    if (err.quota) console.error("(Gặp giới hạn tần suất của dịch vụ AI — chạy lại sau ít phút.)");
    process.exitCode = 1;
  })
  .finally(() => db.close());
