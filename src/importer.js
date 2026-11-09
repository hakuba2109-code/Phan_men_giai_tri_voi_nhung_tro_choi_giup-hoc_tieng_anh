const crypto = require("crypto");
const path = require("path");
const { docxToText } = require("./docx-text");
const Parser = require(path.join(__dirname, "..", "scripts", "parser"));
const db = require("./db");

const DOCX = /\.docx$/i;

async function extractText(filename, buffer) {
  if (DOCX.test(filename)) return docxToText(buffer);
  return buffer.toString("utf8");
}

function guessSource(filename) {
  const base = path.basename(filename).toLowerCase();
  if (base.includes("50_cau_nang_cao") || base.includes("50-cau-nang-cao"))
    return "boss";
  return "main";
}

const TOPIC_ORDER = ["Thì", "Từ loại", "Giới từ", "Đại từ", "Từ vựng"];

/* `questions.id` băm theo nội dung câu, nên hai tài khoản nhập cùng một câu sẽ đụng id.
   - id còn trống: dùng luôn id gốc.
   - id đã thuộc **cùng tài khoản**: coi là câu trùng, bỏ qua (như trước giờ, tránh lặp trong một tài khoản).
   - id đã thuộc **tài khoản khác**: chèn bản sao với id gắn tài khoản (`hashId("<owner>|<id>")`)
     để bộ đề của mỗi người vẫn đủ câu. Chạy lại nhiều lần vẫn cho cùng một id nên không sinh bản sao. */
function saltedId(owner, id) {
  return Parser.hashId(owner + "|" + id);
}

async function questionOwner(client, id) {
  const r = await client.query(
    `SELECT coalesce(s.owner_id, 0) AS owner
       FROM questions q LEFT JOIN source_files s ON s.id = q.file_id
      WHERE q.id = $1`,
    [id],
  );
  return r.rows[0] || null;
}

async function insertForOwner(client, insert, q, owner) {
  let id = q.id;
  let res = await insert(id);
  if (res.rowCount) return { inserted: true, id };
  const ex = await questionOwner(client, id);
  if (!ex || ex.owner === owner) return { inserted: false, id };
  id = saltedId(owner, q.id);
  res = await insert(id);
  if (res.rowCount) return { inserted: true, id, copy: true };
  return { inserted: false, id };
}

async function upsertTopics(client, names) {
  let position = TOPIC_ORDER.length;
  for (const name of names) {
    const known = TOPIC_ORDER.indexOf(name);
    const pos = known >= 0 ? known : ++position;
    await client.query(
      `INSERT INTO topics (name, position) VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [name, pos],
    );
  }
}

async function upsertSourceFile(
  client,
  { filename, source, buffer, rawText, count, ownerId },
) {
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const owner = Number(ownerId) || 0;
  await client.query(
    `INSERT INTO source_files (filename, source, content, raw_text, sha256, size_bytes, question_count, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (owner_id, sha256, filename) DO UPDATE
     SET raw_text = EXCLUDED.raw_text, question_count = EXCLUDED.question_count, imported_at = NOW()`,
    [filename, source, buffer, rawText, sha256, buffer.length, count, owner],
  );
  const row = await client.query(
    `SELECT id FROM source_files WHERE sha256 = $1 AND filename = $2 AND owner_id = $3`,
    [sha256, filename, owner],
  );
  return row.rows[0].id;
}

// Lưu một file Word vào CSDL: file gốc (bytea) + văn bản + câu hỏi đã phân tích.
async function importFile({ filename, buffer, source, topic, ownerId }) {
  const rawText = await extractText(filename, buffer);
  const parsed = Parser.parse(rawText, {
    source: source || guessSource(filename),
    file: filename,
    topic,
  });
  if (!parsed.questions.length) {
    const err = new Error(
      `Không tách được câu hỏi nào từ ${filename}. ` +
        (parsed.problems.length
          ? `Đọc được ${parsed.problems.length} câu nhưng thiếu đáp án hoặc sai định dạng.`
          : "Kiểm tra cách đánh số câu (1. hoặc Câu 1:) và đủ 4 đáp án A–D cho mỗi câu."),
    );
    err.status = 422;
    throw err;
  }

  const owner = Number(ownerId) || 0;
  return db.withTransaction(async (client) => {
    await upsertTopics(client, parsed.topics);
    const fileId = await upsertSourceFile(client, {
      filename,
      source: parsed.questions[0]?.s || source || "import",
      buffer,
      rawText,
      count: parsed.questions.length,
      ownerId: owner,
    });

    let inserted = 0;
    let copied = 0;
    const skipped = [];
    for (const q of parsed.questions) {
      const r = await insertForOwner(
        client,
        (id) =>
          client.query(
            `INSERT INTO questions (id, topic, question, options, answer_index, note, source, number, file_id, passage)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING
             RETURNING id`,
            [id, q.t, q.q, q.o, q.a, q.n, q.s, q.num, fileId, q.passage || null],
          ),
        q,
        owner,
      );
      if (r.inserted) {
        inserted++;
        if (r.copy) copied++;
      } else
        skipped.push({
          id: r.id,
          reason: "Trùng với câu đã có trong ngân hàng",
        });
    }

    return {
      filename,
      fileId,
      source: parsed.questions[0]?.s || "import",
      parsed: parsed.questions.length,
      inserted,
      duplicates: skipped.length,
      copied,
      problems: parsed.problems,
      topics: parsed.topics,
    };
  });
}

/* Lưu kết quả của bộ phân tích AI — giữ đủ 11 dạng bài (qtype + payload JSONB) */
async function saveAiQuestions({
  filename,
  buffer,
  rawText,
  questions,
  source,
  ownerId,
}) {
  const list = Array.isArray(questions) ? questions : [];
  if (!list.length) throw new Error("Không có câu hỏi nào để lưu");
  const src = source || "import";
  const topics = Array.from(new Set(list.map((q) => q.t).filter(Boolean)));

  const owner = Number(ownerId) || 0;
  return db.withTransaction(async (client) => {
    await upsertTopics(client, topics);
    const fileId = await upsertSourceFile(client, {
      filename,
      source: src,
      buffer: buffer || Buffer.from(String(rawText || ""), "utf8"),
      rawText: rawText || "",
      count: list.length,
      ownerId: owner,
    });

    let inserted = 0;
    let copied = 0;
    const skipped = [];
    for (const q of list) {
      const r = await insertForOwner(
        client,
        (id) =>
          client.query(
            `INSERT INTO questions (id, topic, question, options, answer_index, note, source, number, file_id,
                                   qtype, subject, skill, difficulty, passage, audio_url, payload,
                                   status, review_reasons)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             ON CONFLICT (id) DO NOTHING
             RETURNING id`,
            [
              id,
              q.t,
              q.q,
              q.o == null ? null : q.o,
              q.a == null ? null : q.a,
              q.n || "",
              src,
              q.num || null,
              fileId,
              q.qtype || "mcq",
              q.subject || "toeic",
              q.skill || "reading",
              q.difficulty || 1,
              q.passage || null,
              q.audio_url || null,
              JSON.stringify(q.payload || {}),
              q.status === "review" ? "review" : "ok",
              JSON.stringify(q.reviewReasons || []),
            ],
          ),
        q,
        owner,
      );
      if (r.inserted) {
        inserted++;
        if (r.copy) copied++;
      } else
        skipped.push({
          id: r.id,
          reason: "Trùng với câu đã có trong ngân hàng",
        });
    }
    return {
      filename,
      fileId,
      source: src,
      parsed: list.length,
      inserted,
      duplicates: skipped.length,
      copied,
      skipped,
      topics,
    };
  });
}

/* `ownerId`: chỉ lấy câu thuộc bộ đề của tài khoản đó (0 = Khách); bỏ trống = lấy tất cả
   (dùng cho `build.js` để nhúng toàn bộ ngân hàng vào bản chơi offline). */
async function listQuestions(filter = {}) {
  const where = [];
  const params = [];
  if (filter.topic) {
    params.push(filter.topic);
    where.push(`q.topic = $${params.length}`);
  }
  if (filter.source) {
    params.push(filter.source);
    where.push(`q.source = $${params.length}`);
  }
  if (filter.fileId) {
    params.push(filter.fileId);
    where.push(`q.file_id = $${params.length}`);
  }
  if (filter.ownerId != null) {
    params.push(Number(filter.ownerId) || 0);
    where.push(`coalesce(s.owner_id, 0) = $${params.length}`);
  }
  const sql = `SELECT q.id, q.topic AS "t", q.question AS "q", q.options AS "o", q.answer_index AS "a", q.note AS "n", q.source AS "s",
                      q.number AS "num", q.file_id AS "f", q.qtype AS "qtype", q.subject AS "subject", q.skill AS "skill",
                      q.difficulty AS "difficulty", q.passage AS "passage", q.audio_url AS "audioUrl", q.payload AS "payload",
                      q.status AS "status", q.review_reasons AS "reviewReasons",
                      q.explanation AS "explanation", q.explanation_status AS "explanationStatus",
                      q.coach AS "coach", q.translation AS "translation"
               FROM questions q LEFT JOIN source_files s ON s.id = q.file_id
               ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY q.file_id NULLS LAST, q.topic, q.number NULLS LAST, q.id`;
  const res = await db.query(sql, params);
  return res.rows;
}

// Danh sách bộ đề (mỗi file Word một bộ), kèm số câu đã lưu thật và chủ điểm bên trong.
async function listFiles(filter = {}) {
  const owner = filter.ownerId == null ? null : Number(filter.ownerId) || 0;
  const params = owner == null ? [] : [owner];
  const { rows } = await db.query(
    `SELECT s.id, s.filename, s.source, s.size_bytes AS "sizeBytes", s.question_count AS "parsedCount",
            count(q.id)::int AS "questionCount",
            count(q.id) FILTER (WHERE q.options IS NOT NULL AND q.answer_index IS NOT NULL AND q.status = 'ok')::int AS "playableCount",
            count(q.id) FILTER (WHERE q.status = 'review')::int AS "reviewCount",
            coalesce(array_agg(DISTINCT q.topic) FILTER (WHERE q.id IS NOT NULL), '{}') AS topics,
            min(q.number) AS "firstNumber", max(q.number) AS "lastNumber",
            s.imported_at AS "importedAt"
     FROM source_files s LEFT JOIN questions q ON q.file_id = s.id
     ${owner == null ? "" : "WHERE s.owner_id = $1"}
     GROUP BY s.id ORDER BY s.id`,
    params,
  );
  // Câu chèn tay không kèm file chỉ thuộc về Khách của máy này
  if (owner == null || owner === 0) {
    const orphans = await db.query(
      `SELECT count(*)::int AS total FROM questions WHERE file_id IS NULL`,
    );
    if (orphans.rows[0].total) {
      rows.push({
        id: null,
        filename: "Bộ tự soạn (không kèm file)",
        source: "import",
        sizeBytes: 0,
        parsedCount: orphans.rows[0].total,
        questionCount: orphans.rows[0].total,
        playableCount: orphans.rows[0].total,
        reviewCount: 0,
        topics: [],
        firstNumber: null,
        lastNumber: null,
        importedAt: null,
      });
    }
  }
  return rows;
}

/* Xóa một bộ đề: bỏ file gốc và những câu hỏi của riêng nó.
   Nhật ký trả lời (attempts) được GIỮ LẠI bằng cách gán question_id = NULL,
   còn danh sách Ôn câu sai thì xóa theo câu (ON DELETE CASCADE).
   `ownerId`: chỉ xóa được bộ đề của chính tài khoản đó (bỏ trống = không kiểm tra, dùng cho CLI). */
async function deleteFile(id, ownerId) {
  const fileId = Number(id);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    const err = new Error("id bộ đề không hợp lệ");
    err.status = 400;
    throw err;
  }
  const owner = ownerId == null ? null : Number(ownerId) || 0;
  return db.withTransaction(async (client) => {
    const f =
      owner == null
        ? await client.query(
            `SELECT id, filename, source FROM source_files WHERE id = $1`,
            [fileId],
          )
        : await client.query(
            `SELECT id, filename, source FROM source_files WHERE id = $1 AND owner_id = $2`,
            [fileId, owner],
          );
    if (!f.rows.length) {
      const err = new Error("Không tìm thấy bộ đề này trong CSDL");
      err.status = 404;
      throw err;
    }
    const ids = await client.query(
      `SELECT id FROM questions WHERE file_id = $1`,
      [fileId],
    );
    const gone = ids.rows.map((r) => r.id);
    let logKept = 0,
      masteredKept = 0;
    if (gone.length) {
      // Giữ lịch sử chơi: bỏ liên kết, không xóa dòng attempts của người chơi
      const a = await client.query(
        `UPDATE attempts SET question_id = NULL WHERE question_id = ANY($1::text[])`,
        [gone],
      );
      logKept = a.rowCount;
      const p = await client.query(
        `UPDATE player_progress
            SET mastered = (SELECT coalesce(array_agg(m), '{}'::text[]) FROM unnest(mastered) AS m WHERE NOT (m = ANY($1::text[])))`,
        [gone],
      );
      masteredKept = p.rowCount;
      await client.query(`DELETE FROM questions WHERE file_id = $1`, [fileId]);
    }
    // Ván mê cung đang dở/biến mất theo bộ đề; ván đã hoàn tất giữ lại để mã chứng chỉ còn đối chiếu.
    const runs = await client.query(
      `DELETE FROM dungeon_runs WHERE file_id = $1 AND status <> 'completed'`,
      [fileId],
    );
    await client.query(`DELETE FROM source_files WHERE id = $1`, [fileId]);
    return {
      id: fileId,
      filename: f.rows[0].filename,
      source: f.rows[0].source,
      questions: gone.length,
      attemptsKept: logKept,
      progressUpdated: masteredKept,
      dungeonRunsRemoved: runs.rowCount,
    };
  });
}

async function listTopics() {
  const { rows } = await db.query(
    `SELECT name FROM topics ORDER BY position, name`,
  );
  return rows.map((r) => r.name);
}

module.exports = {
  importFile,
  extractText,
  guessSource,
  listQuestions,
  listFiles,
  listTopics,
  upsertTopics,
  saveAiQuestions,
  deleteFile,
};
