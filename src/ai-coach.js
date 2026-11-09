"use strict";

/* ==========================================================================
   GIA SƯ AI THEO CÂU (chi phí thấp nhất có thể)
   - Một câu chỉ gọi Gemini MỘT LẦN, kết quả lưu vào questions.coach và dùng lại mãi
   - Nội dung KHÔNG phụ thuộc đáp án người chơi đã bấm, nên một hàng dùng được
     cho mọi tài khoản -> số lượt gọi không tăng theo số lượt chơi
   - Prompt ngắn, maxOutputTokens thấp, temperature 0, responseSchema (không tán gẫu)
   - Câu đã có coach -> trả ngay, 0 token. Hai người cùng bấm một câu chưa có
     coach -> chỉ một lượt gọi (in-flight dedupe).
   - Ngân sách chặn theo tài khoản/ngày (AI_COACH_DAILY, mặc định 60) để không cháy quota.
   ========================================================================== */

const ai = require("./ai-parser");
const db = require("./db");
const freeTranslate = require("./free-translate");

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const CAP = {
  stem: 900,
  option: 150,
  passage: 700,
  hint: 160,
  stemVi: 700,
  optionVi: 260,
  why: 260,
};
const num = (v, d) => {
  const n = Number(v);
  return v === undefined || v === "" || !Number.isFinite(n) ? d : n;
};
const MAX_OUTPUT_TOKENS = num(process.env.AI_COACH_MAX_TOKENS, 500);
const DAILY_CAP = num(process.env.AI_COACH_DAILY, 60);

const SYSTEM = [
  "Bạn là gia sư TOEIC cho người Việt, mục tiêu 500+.",
  "Đầu vào là MỘT câu trắc nghiệm. Trả về JSON đúng schema, không thêm trường nào khác:",
  "- stem_vi: dịch câu hỏi sang tiếng Việt tự nhiên, giữ nguyên thuật ngữ tiếng Anh trong ngoặc nếu cần.",
  "- options_vi: dịch TỪNG đáp án theo đúng thứ tự, mảng dài đúng bằng options.",
  "- why: với TỪNG đáp án SAI (loại đáp án đúng), một câu tiếng Việt <= 25 từ nêu vì sao loại.",
  "QUY TẮC:",
  "1. Đáp án đúng là đáp án có answer_index. Không đổi đáp án, không giải thích lại đáp án đúng.",
  "2. why phải chỉ ra lỗi CỤ THỂ (thiếu tân ngữ, sai thì, sai từ loại, không hợp nghĩa câu), cấm viết chung chung.",
  "3. Mỗi phần tử why có i là vị trí đáp án (0=A). Không trùng i, không có i ngoài danh sách.",
  "4. Không dùng HTML, không markdown, không đường dẫn. Trả gọn trong JSON.",
].join("\n");

const SCHEMA = {
  type: "OBJECT",
  properties: {
    stem_vi: { type: "STRING" },
    options_vi: { type: "ARRAY", items: { type: "STRING" } },
    why: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { i: { type: "INTEGER" }, why: { type: "STRING" } },
        required: ["i", "why"],
      },
    },
  },
  required: ["stem_vi", "options_vi", "why"],
};

const clean = (s) =>
  String(s == null ? "" : s)
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

const clip = (s, max) => {
  const t = clean(s);
  return t.length <= max ? t : t.slice(0, max).trim();
};

/* Gọn nhất có thể: chỉ gửi những gì model cần để dịch và phản biện. */
function buildPrompt(q) {
  const opts = q.options || [];
  const lines = [
    `topic: ${clean(q.topic) || "?"}`,
    `stem: ${clip(q.question, CAP.stem)}`,
  ];
  if (q.passage) lines.push(`passage: ${clip(q.passage, CAP.passage)}`);
  opts.forEach((o, i) => lines.push(`${LETTERS[i] || i}: ${clip(o, CAP.option)}`));
  lines.push(
    `answer_index: ${q.answer_index} (${LETTERS[q.answer_index]} là đáp án ĐÚNG, không đưa vào why)`
  );
  const hint = q.explanation && q.explanation.explain;
  if (hint) lines.push(`gợi ý quy tắc: ${clip(hint, CAP.hint)}`);
  return lines.join("\n");
}

/* Kiểm tra và làm sạch kết quả model trả về. */
function readResult(raw, q) {
  const opts = q.options || [];
  const stemVi = clip(raw && raw.stem_vi, CAP.stemVi);
  if (!stemVi) return { ok: false, error: "AI không trả bản dịch câu hỏi" };

  const list = Array.isArray(raw && raw.options_vi) ? raw.options_vi : [];
  if (list.length !== opts.length)
    return { ok: false, error: `AI trả ${list.length} bản dịch đáp án, thiếu ${opts.length}` };

  const optionsVi = list.map((t) => clip(t, CAP.optionVi));
  const seen = new Set();
  const why = [];
  for (const w of Array.isArray(raw && raw.why) ? raw.why : []) {
    const i = Number(w && w.i);
    const text = clip(w && w.why, CAP.why);
    if (!Number.isInteger(i) || i < 0 || i >= opts.length) continue;
    if (i === q.answer_index || !text || seen.has(i)) continue;
    seen.add(i);
    why.push({ i, why: text });
  }
  if (!why.length) return { ok: false, error: "AI không nêu lý do loại đáp án sai" };

  return {
    ok: true,
    coach: { stem_vi: stemVi, options_vi: optionsVi, why },
    missing: opts.length - 1 - why.length,
  };
}

/* ---------- ngân sách theo tài khoản/ngày (trong RAM, đủ để chống cháy quota) ---------- */
const daily = new Map();
const dayKey = () => new Date().toISOString().slice(0, 10);

function usedToday(userId) {
  return daily.get(`${userId}|${dayKey()}`) || 0;
}
function addUsage(userId) {
  const k = `${userId}|${dayKey()}`;
  daily.set(k, (daily.get(k) || 0) + 1);
  if (daily.size > 500) {
    for (const key of [...daily.keys()])
      if (!key.endsWith(dayKey())) daily.delete(key);
  }
}

/* ---------- gộp yêu cầu trùng đang chờ ---------- */
const inflight = new Map();

async function generate(q, userId) {
  const res = await ai.callModel(buildPrompt(q), {
    system: SYSTEM,
    schema: SCHEMA,
    temperature: 0,
    maxTokens: MAX_OUTPUT_TOKENS,
    tries: 2,
  });
  const tokens = res.usage
    ? (res.usage.promptTokenCount || 0) + (res.usage.candidatesTokenCount || 0)
    : 0;
  let data;
  try {
    data = ai.parseJsonLoose(res.text);
  } catch (err) {
    const e = new Error("AI trả về không phải JSON hợp lệ");
    e.status = 502;
    throw e;
  }
  const checked = readResult(Array.isArray(data) ? data[0] : data, q);
  if (!checked.ok) {
    const e = new Error(checked.error);
    e.status = 502;
    throw e;
  }
  await db.query(
    `UPDATE questions
        SET coach = $2::jsonb, coach_model = $3, coach_tokens = $4, coach_at = NOW()
      WHERE id = $1 AND coach IS NULL`,
    [q.id, JSON.stringify(checked.coach), ai.conf().model, tokens]
  );
  addUsage(userId);
  return { coach: checked.coach, cached: false, tokens, model: ai.conf().model };
}

async function readyCount() {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM questions WHERE coach IS NOT NULL`
  );
  return rows[0].n;
}

/* Trả giải thích cho một câu: dùng cache nếu có, gọi AI nếu chưa. */
async function coach(questionId, userId) {
  const id = String(questionId || "").trim();
  if (!id) {
    const e = new Error("Thiếu questionId");
    e.status = 400;
    throw e;
  }
  const { rows } = await db.query(
    `SELECT q.id, q.topic, q.question, q.options, q.answer_index, q.passage, q.explanation,
            q.coach, q.coach_model, q.coach_tokens
       FROM questions q LEFT JOIN source_files s ON s.id = q.file_id
      WHERE q.id = $1 AND coalesce(s.owner_id, 0) = $2`,
    [id, Number(userId) || 0]
  );
  const q = rows[0];
  if (!q) {
    const e = new Error("Không tìm thấy câu hỏi");
    e.status = 404;
    throw e;
  }
  const cap = num(process.env.AI_COACH_DAILY, DAILY_CAP);
  const base = { ready: await readyCount(), used: usedToday(userId), cap };

  if (q.coach && q.coach.stem_vi)
    return {
      ...base,
      coach: q.coach,
      cached: true,
      tokens: 0,
      model: q.coach_model || "cache",
    };

  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length < 2 || q.answer_index == null) {
    const e = new Error("Câu này không có đáp án A–D nên gia sư AI chưa hỗ trợ");
    e.status = 400;
    throw e;
  }
  if (!ai.conf().configured) {
    const e = new Error("Chưa cấu hình AI_API_KEY trong file .env");
    e.status = 503;
    throw e;
  }
  if (base.used >= cap) {
    const e = new Error(
      `Ngân sách AI hôm nay (${cap} lượt) đã dùng hết. Những câu đã có giải thích vẫn hiện lại bình thường.`
    );
    e.status = 429;
    throw e;
  }

  let job = inflight.get(q.id);
  if (!job) {
    job = generate(q, userId).finally(() => inflight.delete(q.id));
    inflight.set(q.id, job);
  }
  return { ...(await job), ...base, used: usedToday(userId) };
}

/* ==========================================================================
   BẢN DỊCH CÂU + ĐÁP ÁN (dùng cho khối 💡)
   - Rẻ hơn "Gia sư AI" vì không hỏi vì sao loại đáp án: prompt chỉ có đề + 4 đáp án.
   - Câu đã có coach thì lấy luôn stem_vi/options_vi của coach (0 token, không gọi thêm).
   - Lưu vào questions.translation, dùng chung ngân sách AI_COACH_DAILY với gia sư.
   ========================================================================== */

const TRANS_SYSTEM = [
  "Bạn dịch câu hỏi TOEIC sang tiếng Việt cho người học.",
  "Trả về JSON đúng schema, không thêm trường nào khác:",
  "- stem_vi: dịch câu hỏi/chỗ trống sang tiếng Việt tự nhiên; giữ nguyên ___ cho chỗ trống và giữ thuật ngữ tiếng Anh trong ngoặc nếu cần.",
  "- options_vi: dịch TỪNG đáp án theo đúng thứ tự, mảng dài đúng bằng options.",
  "QUY TẮC: không giải thích, không thêm lời bình, không HTML/markdown/đường dẫn; đáp án ngắn thì dịch ngắn.",
].join("\n");

const TRANS_SCHEMA = {
  type: "OBJECT",
  properties: {
    stem_vi: { type: "STRING" },
    options_vi: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["stem_vi", "options_vi"],
};

const TRANS_MAX_OUTPUT_TOKENS = num(process.env.AI_TRANSLATE_MAX_TOKENS, 320);

function buildTransPrompt(q) {
  const lines = [`topic: ${clean(q.topic) || "?"}`, `stem: ${clip(q.question, CAP.stem)}`];
  if (q.passage) lines.push(`passage: ${clip(q.passage, CAP.passage)}`);
  (q.options || []).forEach((o, i) => lines.push(`${LETTERS[i] || i}: ${clip(o, CAP.option)}`));
  return lines.join("\n");
}

function readTrans(raw, q) {
  const opts = q.options || [];
  const stemVi = clip(raw && raw.stem_vi, CAP.stemVi);
  if (!stemVi) return { ok: false, error: "AI không trả bản dịch câu hỏi" };
  const list = Array.isArray(raw && raw.options_vi) ? raw.options_vi : [];
  if (list.length !== opts.length)
    return { ok: false, error: `AI trả ${list.length} bản dịch đáp án, thiếu ${opts.length}` };
  return {
    ok: true,
    translation: { stem_vi: stemVi, options_vi: list.map((t) => clip(t, CAP.optionVi)) },
  };
}

/* Bản dịch lấy sẵn từ coach (nếu có) — dùng chung cho API và bản dựng offline. */
function fromCoach(coach, optionCount) {
  if (!coach || !coach.stem_vi) return null;
  const opts = Array.isArray(coach.options_vi) ? coach.options_vi : [];
  if (optionCount && opts.length !== optionCount) return null;
  return { stem_vi: coach.stem_vi, options_vi: opts };
}

const inflightTrans = new Map();

async function generateTrans(q, userId) {
  const res = await ai.callModel(buildTransPrompt(q), {
    system: TRANS_SYSTEM,
    schema: TRANS_SCHEMA,
    temperature: 0,
    maxTokens: TRANS_MAX_OUTPUT_TOKENS,
    tries: 2,
  });
  const tokens = res.usage
    ? (res.usage.promptTokenCount || 0) + (res.usage.candidatesTokenCount || 0)
    : 0;
  let data;
  try {
    data = ai.parseJsonLoose(res.text);
  } catch (err) {
    const e = new Error("AI trả về không phải JSON hợp lệ");
    e.status = 502;
    throw e;
  }
  const checked = readTrans(Array.isArray(data) ? data[0] : data, q);
  if (!checked.ok) {
    const e = new Error(checked.error);
    e.status = 502;
    throw e;
  }
  await db.query(
    `UPDATE questions
        SET translation = $2::jsonb, translation_model = $3, translation_tokens = $4, translation_at = NOW()
      WHERE id = $1 AND translation IS NULL`,
    [q.id, JSON.stringify(checked.translation), ai.conf().model, tokens]
  );
  addUsage(userId);
  return { translation: checked.translation, cached: false, tokens, model: ai.conf().model };
}

/* Dịch MIỄN PHÍ (không API key, 0 token): đề + từng đáp án. Lưu vào cột translation
   với model "google-gtx" để máy khác / lần sau đọc lại cũng không tốn gì. */
async function generateFree(q) {
  const opts = Array.isArray(q.options) ? q.options : [];
  const texts = await freeTranslate.translateTexts(
    [clip(q.question, CAP.stem)].concat(opts.map((o) => clip(o, CAP.option)))
  );
  const stemVi = clip(texts[0], CAP.stemVi);
  if (!stemVi) {
    const e = new Error("Dịch miễn phí không trả được câu hỏi");
    e.status = 502;
    throw e;
  }
  const translation = {
    stem_vi: stemVi,
    options_vi: texts.slice(1).map((t) => clip(t, CAP.optionVi)),
  };
  await db.query(
    `UPDATE questions
        SET translation = $2::jsonb, translation_model = 'google-gtx',
            translation_tokens = 0, translation_at = NOW()
      WHERE id = $1 AND translation IS NULL`,
    [q.id, JSON.stringify(translation)]
  );
  return { translation, cached: false, tokens: 0, model: "google-gtx", free: true };
}

/* Thử miễn phí trước; chỉ khi lỗi mới rơi xuống Gemini và mới bị tính lượt.
   freeOnly = gọi tự động trong khối 💡: lỗi miễn phí thì báo lỗi luôn, KHÔNG tiêu lượt AI. */
async function generateAny(q, userId, base, freeOnly) {
  let freeErr = null;
  if (freeTranslate.enabled()) {
    try {
      return await generateFree(q);
    } catch (err) {
      freeErr = err;
    }
  }
  if (freeOnly) {
    const e = new Error(
      "Dịch miễn phí đang lỗi" + (freeErr ? " (" + freeErr.message + ")" : "") + "; bấm nút để dịch bằng AI."
    );
    e.status = 503;
    e.freeFailed = true;
    throw e;
  }
  if (!ai.conf().configured) {
    const e = new Error(
      freeErr
        ? "Dịch miễn phí lỗi (" + freeErr.message + ") và chưa cấu hình AI_API_KEY"
        : "Chưa cấu hình AI_API_KEY trong file .env"
    );
    e.status = 503;
    throw e;
  }
  if (base.used >= base.cap) {
    const e = new Error(
      `Ngân sách AI hôm nay (${base.cap} lượt) đã dùng hết. Câu đã dịch trước đó vẫn hiện bình thường.`
    );
    e.status = 429;
    throw e;
  }
  return generateTrans(q, userId);
}

/* Trả bản dịch cho một câu: translation -> coach -> miễn phí -> Gemini. */
async function translate(questionId, userId, optsIn) {
  const freeOnly = Boolean(optsIn && optsIn.freeOnly);
  const id = String(questionId || "").trim();
  if (!id) {
    const e = new Error("Thiếu questionId");
    e.status = 400;
    throw e;
  }
  const { rows } = await db.query(
    `SELECT q.id, q.topic, q.question, q.options, q.answer_index, q.passage,
            q.translation, q.translation_model, q.coach, q.coach_model
       FROM questions q LEFT JOIN source_files s ON s.id = q.file_id
      WHERE q.id = $1 AND coalesce(s.owner_id, 0) = $2`,
    [id, Number(userId) || 0]
  );
  const q = rows[0];
  if (!q) {
    const e = new Error("Không tìm thấy câu hỏi");
    e.status = 404;
    throw e;
  }
  const cap = num(process.env.AI_COACH_DAILY, DAILY_CAP);
  const base = { used: usedToday(userId), cap };
  const opts = Array.isArray(q.options) ? q.options : [];

  const fromCo = fromCoach(q.coach, opts.length);
  if (fromCo)
    return { ...base, translation: fromCo, cached: true, tokens: 0, model: q.coach_model || "coach" };
  if (q.translation && q.translation.stem_vi)
    return { ...base, translation: q.translation, cached: true, tokens: 0, model: q.translation_model || "cache" };

  if (opts.length < 2) {
    const e = new Error("Câu này không có đáp án A–D nên chưa dịch được");
    e.status = 400;
    throw e;
  }

  let job = inflightTrans.get(q.id);
  if (!job) {
    job = generateAny(q, userId, base, freeOnly).finally(() => inflightTrans.delete(q.id));
    inflightTrans.set(q.id, job);
  }
  return { ...(await job), ...base, used: usedToday(userId) };
}

module.exports = {
  coach,
  translate,
  buildPrompt,
  buildTransPrompt,
  readResult,
  readTrans,
  fromCoach,
  SCHEMA,
  TRANS_SCHEMA,
  SYSTEM,
  TRANS_SYSTEM,
  usedToday,
  readyCount,
};