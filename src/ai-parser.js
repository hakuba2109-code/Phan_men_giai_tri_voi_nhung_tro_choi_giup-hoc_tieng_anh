"use strict";

/* ==========================================================================
   BỘ PHÂN TÍCH ĐỀ BẰNG AI (GEMINI-COMPATIBLE API) — NÂNG CẤP HOÀN THIỆN
   - Hỗ trợ 11 dạng bài chuẩn mực (TOEIC Listening/Reading/Writing + ML)
   - Bảo toàn định dạng Code (```), LaTeX ($...$) và xuống dòng
   - Xử lý Rate-Limit (429) với Exponential Backoff & Jitter
   - Tự động khớp đáp án từ bảng ANSWER KEY và Regex Fallback
   ========================================================================== */

const crypto = require("crypto");
const path = require("path");

const Explainer = require(path.join(__dirname, "..", "scripts", "explainer"));

const TYPES = {
  audio_mcq: { label: "Nghe chọn đáp án", play: "mcq" },
  mcq: { label: "Trắc nghiệm ngắn", play: "mcq" },
  passage_mcq: { label: "Đọc đoạn văn", play: "mcq" },
  writing_short: { label: "Viết câu ngắn", play: null },
  writing_essay: { label: "Viết Email / Essay", play: null },
  multi: { label: "Chọn nhiều đáp án", play: null },
  tf: { label: "Đúng / Sai", play: null },
  fill: { label: "Điền từ / công thức", play: null },
  numeric: { label: "Tính ra số", play: null },
  match: { label: "Nối cặp", play: null },
  order: { label: "Sắp xếp quy trình", play: null },
};
const TYPE_NAMES = Object.keys(TYPES);

const SUBJECTS = ["toeic", "ml"];
const SKILLS = ["listening", "reading", "writing", "general"];
const MAX_CHARS_PER_CALL = 2800;
const SOLVE_BATCH = 12;
const SOLVE_MAX_CHARS = 4200;

function conf() {
  const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "";
  const model = process.env.AI_MODEL || "gemini-3.5-flash-lite";
  const url =
    process.env.AI_URL ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return { key, model, url, configured: Boolean(key) };
}

const SYSTEM = [
  "Bạn là trợ lý AI chuyên gia phân tích và bóc tách ngân hàng câu hỏi thi (TOEIC & Machine Learning).",
  "Nhiệm vụ: Đọc văn bản đầu vào và trích xuất TOÀN BỘ câu hỏi thành JSON chuẩn mực, tuyệt đối không bỏ sót câu nào.",
  "QUY TẮC QUAN TRỌNG VỀ ĐỊNH DẠNG:",
  "1. GIỮ NGUYÊN KHỐI CODE: Mọi đoạn mã Python/SQL/C++ nằm trong ```python ... ``` phải giữ nguyên định dạng xuống dòng, KHÔNG được nén thành 1 dòng.",
  "2. GIỮ NGUYÊN CÔNG THỨC TOÁN: Các biểu thức toán LaTeX như $\\theta$, $\\nabla J(\\theta)$ giữ nguyên cú pháp.",
  "3. KHÔNG TỰ THÊM HOẶC BỚT CÂU HỎI: Số lượng câu hỏi trả về phải bằng số câu hỏi có trong văn bản.",
  "4. BẢNG 2 CỘT: khối bắt đầu bằng [BẢNG 2 CỘT] là bảng nối cặp (match). Cột trái vào left, cột phải vào right. Hai ô cùng một hàng KHÔNG nhất thiết là cặp đúng; cặp đúng phải lấy từ dòng Đáp án. Không có dòng Đáp án thì để pairs rỗng.",
  "5. KHÔNG BỊA CÂU HỎI: chỉ xuất ra những câu hỏi CÓ THẬT trong văn bản. Danh sách từ vựng / bảng từ (mỗi dòng dạng 'từ  /phiên âm/  (n.)  : nghĩa tiếng Việt') KHÔNG phải câu hỏi → bỏ qua hoàn toàn, cấm biến nó thành trắc nghiệm 'chọn từ đúng nghĩa'.",
  "6. MỘT CÂU = MỘT BẢN GHI: không tách một câu thành hai, không bỏ phần chữ sau chỗ trống. Chép NGUYÊN VĂN cả câu (ví dụ 'Children should take responsibility ______ their belongings.' phải là MỘT stem, không phải 'Children should take responsibility ______' + 'their belongings.'). Giữ đúng nguyên văn và thứ tự 4 lựa chọn A-D trong file, không tự nghĩ thêm phương án.",
  "",
  "PHÂN LOẠI 11 DẠNG BÀI (type):",
  "- audio_mcq    : Nghe + 4 đáp án A-D (trích xuất link audio vào audio_url).",
  "- mcq          : Trắc nghiệm 4 đáp án A-D (TOEIC Part 5 hoặc lý thuyết ngắn).",
  "- passage_mcq  : Đọc hiểu đoạn văn; chép lại NGUYÊN VĂN đoạn văn/email vào trường passage của TỪNG câu thuộc đoạn đó. Giữ nguyên xuống dòng: mỗi dòng To:/From:/Subject:/Date: là một dòng riêng.",
  "- writing_short: Viết câu ngắn dựa trên từ gợi ý; từ gợi ý vào keywords, câu mẫu vào sample_answer.",
  "- writing_essay: Viết bài luận/email; số từ tối thiểu vào min_words, tiêu chí/hướng dẫn vào explanation.",
  "- multi        : Chọn NHIỀU đáp án đúng; mảng lựa chọn vào options, mảng chỉ số đúng vào answers (ví dụ [0, 2]).",
  "- tf           : Nhóm mệnh đề Đúng/Sai; mảng mệnh đề vào statements, mảng true/false tương ứng vào booleans.",
  "- fill         : Điền từ/công thức vào chỗ trống _______; mảng các đáp án được chấp nhận vào answers.",
  "- numeric      : Tính toán ra kết quả số; đáp số vào numeric, sai số cho phép vào tolerance.",
  "- match        : Nối cặp A-B; danh sách cột A vào left, cột B vào right, mảng vị trí khớp vào pairs (pairs[i] = vị trí cột B ứng với left[i]).",
  "- order        : Sắp xếp quy trình; mảng các bước ĐÃ XẮP XẾP THEO ĐÚNG THỨ TỰ ĐÚNG vào steps.",
  "",
  "QUY TẮC DỮ LIỆU CHUẨN:",
  "- stem: Nội dung câu hỏi, bỏ tiền tố 'Câu 1:' ở đầu. Đối với câu code, giữ nguyên khối ```python ... ```.",
  "- options: Mảng 4 lựa chọn (cho mcq, audio_mcq, passage_mcq), KHÔNG kèm ký tự (A), (B).",
  "- answer_index: Chỉ số đáp án đúng (0=A, 1=B, 2=C, 3=D). Với các dạng khác để null.",
  "- NẾU VĂN BẢN KHÔNG CÓ ĐÁP ÁN (không có dòng 'Đáp án:', 'Answer:', bảng answer key hoặc ký hiệu đáp án): hãy TỰ GIẢI câu hỏi bằng kiến thức TOEIC/ML và điền answer_index đúng. Tuyệt đối không để trống và không mặc định chọn A; nếu thật sự không xác định được mới để null.",
  "- topic: Tên chủ điểm ngắn (Thì, Từ loại, Giới từ, Đại từ, Từ vựng, Nghe, hoặc chủ đề ML như 'ML — AI hiện đại').",
  "- subject: 'toeic' hoặc 'ml'. skill: 'listening' | 'reading' | 'writing' | 'general'. difficulty: 1 (dễ), 2 (vừa), 3 (khó).",
  "- explanation: Chép nguyên lời giải thích/dịch nghĩa nếu file có dòng 'Giải thích:'. Nếu file không có thì để trống — KHÔNG tự bịa lý do (câu thiếu đáp án sẽ được giải ở bước sau, kèm lý do ngắn).",
].join("\n");

function responseSchema() {
  const s = (type) => ({ type });
  return {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: TYPE_NAMES },
            subject: { type: "STRING", enum: SUBJECTS },
            skill: { type: "STRING", enum: SKILLS },
            topic: s("STRING"),
            difficulty: { type: "INTEGER" },
            stem: s("STRING"),
            passage: s("STRING"),
            audio_url: s("STRING"),
            options: { type: "ARRAY", items: s("STRING") },
            answer_index: { type: "INTEGER" },
            answers: { type: "ARRAY", items: s("STRING") },
            statements: { type: "ARRAY", items: s("STRING") },
            booleans: { type: "ARRAY", items: { type: "BOOLEAN" } },
            numeric: { type: "NUMBER" },
            tolerance: { type: "NUMBER" },
            left: { type: "ARRAY", items: s("STRING") },
            right: { type: "ARRAY", items: s("STRING") },
            pairs: { type: "ARRAY", items: { type: "INTEGER" } },
            steps: { type: "ARRAY", items: s("STRING") },
            keywords: { type: "ARRAY", items: s("STRING") },
            sample_answer: s("STRING"),
            min_words: { type: "INTEGER" },
            explanation: s("STRING"),
          },
          required: ["type", "stem"],
        },
      },
    },
    required: ["questions"],
  };
}

/* ==========================================================================
   XỬ LÝ CHUỖI VĂN BẢN (KHÔNG LÀM PHẲNG CODE/MARKDOWN)
   ========================================================================== */

// Làm sạch dòng đơn nhưng KHÔNG xoá xuống dòng trong khối code
function cleanSingleLine(s) {
  return String(s == null ? "" : s)
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanPreservingCode(s) {
  if (s == null) return "";
  let str = String(s).trim();
  // Nếu có khối code hoặc nhiều dòng, chuẩn hóa từng dòng thay vì nén thành 1 dòng
  if (str.includes("```") || str.includes("\n")) {
    return str
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  }
  return str.replace(/\s+/g, " ").trim();
}

const MARK_MARKED = /\[\s*Loại\s*:|^\s*Câu\s*\d+/im;
const MARK_START_MARKED = /\[\s*Loại\s*:|^\s*Câu\s*\d+\s*[:.]/i;
const MARK_START_PLAIN = /^\s*(?:\d+\.|[A-Da-d]\))\s+\S/;
const MARK_HEADING =
  /^\s*(?:PHẦN|Phần)\s*\d|^\s*\d+\.\s*Dạng\b|^\s*[•\-*]\s|^\s*💡/;
const MIN_PASSAGE = 180;

/* Dòng danh sách từ vựng: "breadwinner /ˈbredˌwɪn.ər/ (n) : người kiếm tiền chính".
   Đề ôn thường mở đầu bằng vài unit từ vựng như vậy; model rất dễ "chế" chúng thành
   câu hỏi trắc nghiệm chọn từ đúng nghĩa, nên loại ngay từ bước chia đợt. */
const RE_POS = /\(\s*(?:n|v|adj|adv|prep|pron|conj|phr)\.?(?:\s*phr\.?)?\s*\)/i;
const RE_IPA = /\/[^/\n]{2,40}\//;
const RE_OPTIONISH = /^\s*[\(\[]?[A-Da-d][).\]]\s/;
const RE_OPTIONS_BLOCK = /^\s*A\s*[.)]\s+\S/i;
function isGlossaryLine(line) {
  const t = String(line).trim();
  if (!t) return false;
  if (/_{3,}/.test(t) || /\?\s*$/.test(t)) return false;
  if (MARK_START_MARKED.test(t) || RE_OPTIONISH.test(t)) return false;
  return (RE_POS.test(t) || RE_IPA.test(t)) && /:\s*\S/.test(t);
}
function glossaryLinesOf(block) {
  const lines = String(block).split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length || !lines.every(isGlossaryLine)) return 0;
  return lines.length;
}

function isPassage(block) {
  if (!block || block.length < MIN_PASSAGE || MARK_HEADING.test(block))
    return false;
  return (
    /ĐOẠN VĂN|PASSAGE|^\s*(?:To:|From:|Subject:|Dear\b)|\n\s*(?:To:|From:|Subject:)/i.test(
      block,
    ) || block.length > MIN_PASSAGE * 2
  );
}

function chunkText(text, maxChars) {
  const limit = maxChars || MAX_CHARS_PER_CALL;
  const src = String(text).replace(/\r\n?/g, "\n");
  const marked = MARK_MARKED.test(src);
  const startMark = marked ? MARK_START_MARKED : MARK_START_PLAIN;
  const groups = [];
  let currentPassage = "";
  let glossary = 0;

  for (const raw of src.split(/\n{2,}/)) {
    const b = raw.trim();
    if (!b) continue;
    const gl = glossaryLinesOf(b);
    if (gl) {
      glossary += gl;
      continue;
    }
    if (MARK_HEADING.test(b)) {
      currentPassage = "";
      continue;
    }
    if (startMark.test(b)) {
      groups.push({ body: b, passage: currentPassage });
      continue;
    }
    if (/^\[BẢNG 2 CỘT\]/.test(b) && groups.length) {
      groups[groups.length - 1].body += "\n\n" + b;
      continue;
    }
    if (isPassage(b)) {
      currentPassage = b;
      continue;
    }
    if (groups.length) groups[groups.length - 1].body += "\n\n" + b;
  }

  if (!groups.length) {
    /* File không đánh số câu (chỉ "A. from  B. of") → không nhận diện được câu nào ra
       câu nào, phải cắt theo độ dài. Cắt ký tự thuần từng làm mất câu nằm ở ranh giới
       hai đợt, nên giờ gom theo nguyên khối: một câu không bao giờ bị chẻ đôi. */
    const blocks = [];
    for (const s of src
      .split(/\n{2,}/)
      .map((x) => x.trim())
      .filter((x) => x && !glossaryLinesOf(x))) {
      const prev = blocks[blocks.length - 1];
      // Dán khối "A. of  B. for ..." vào câu ngay trước để hai thứ không rơi
      // vào hai đợt khác nhau — model sẽ không còn thấy dòng đáp án mồ côi.
      if (prev && RE_OPTIONS_BLOCK.test(s))
        blocks[blocks.length - 1] = prev + "\n" + s;
      else blocks.push(s);
    }
    const out = [];
    let cur = "";
    for (const b of blocks) {
      if (cur && cur.length + b.length + 2 > limit) {
        out.push(cur);
        cur = "";
      }
      cur = cur ? cur + "\n\n" + b : b;
    }
    if (cur) out.push(cur);
    out.glossaryLines = glossary;
    return out;
  }
  const chunks = groups.map((g) =>
    (g.passage ? g.passage + "\n\n" + g.body : g.body).slice(0, limit * 2),
  );
  chunks.glossaryLines = glossary;
  return chunks;
}

/* ==========================================================================
   CALL GEMINI REST API (WITH RETRY & JITTER)
   ========================================================================== */

const RETRY_STATUS = [429, 500, 502, 503, 504];
const MAX_WAIT_MS = 120000;
let gateUntil = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitHint(res, text) {
  let best = 0;
  try {
    const h = parseFloat(
      res.headers && res.headers.get && res.headers.get("retry-after"),
    );
    if (Number.isFinite(h) && h > 0) best = h * 1000;
  } catch (e) {}
  try {
    const details = (JSON.parse(text).error || {}).details || [];
    for (const d of details) {
      const n = parseFloat(String((d.retryInfo || {}).retryDelay || ""));
      if (Number.isFinite(n) && n > 0) best = Math.max(best, n * 1000);
    }
  } catch (e) {}
  return Math.min(best, 60000);
}

function quotaMessage(status, detail) {
  if (status !== 429) return `AI trả lỗi ${status}: ${detail}`;
  return "Hạn mức Gemini (Rate Limit / Quota 429) tạm thời quá tải. Hệ thống đang tự động giãn cách và thử lại.";
}

async function postJson(url, headers, body, tries) {
  const max = tries || 5;
  let lastErr = null,
    waited = 0;
  for (let i = 0; i < max; i++) {
    if (gateUntil > Date.now()) await sleep(gateUntil - Date.now());
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.ok) return res;
      if (RETRY_STATUS.indexOf(res.status) < 0) return res;

      const text = await res.text().catch(() => "");
      let detail = text.slice(0, 300);
      try {
        detail = String(JSON.parse(text).error.message).slice(0, 300);
      } catch (e) {}

      // Tính thời gian chờ có Jitter (ngẫu nhiên nhẹ để tránh xung đột đợt gọi)
      const jitter = Math.random() * 500;
      const back = Math.max(
        waitHint(res, text),
        Math.min(2000 * Math.pow(2, i) + jitter, 25000),
      );

      if (i < max - 1 && waited + back <= MAX_WAIT_MS) {
        waited += back;
        gateUntil = Date.now() + back;
        continue;
      }
      return {
        ok: false,
        status: res.status,
        raw: text,
        quota: res.status === 429,
        message: quotaMessage(res.status, detail),
      };
    } catch (err) {
      lastErr = err;
      const back = Math.min(1000 * (i + 1), 6000);
      if (i < max - 1 && waited + back <= MAX_WAIT_MS) {
        waited += back;
        await sleep(back);
      }
    }
  }
  if (lastErr)
    throw new Error(`Không kết nối được dịch vụ AI: ${lastErr.message}`);
  return null;
}

async function callModel(promptText, opts) {
  const c = conf();
  if (!c.configured) throw new Error("Chưa có AI_API_KEY trong file .env");
  const o = opts || {};
  const body = {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    systemInstruction: { parts: [{ text: o.system || SYSTEM }] },
    generationConfig: {
      temperature: o.temperature == null ? 0 : o.temperature,
      maxOutputTokens: o.maxTokens || 32000,
    },
  };
  if (o.schema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = o.schema;
  }
  const res = await postJson(
    c.url,
    {
      "content-type": "application/json",
      "x-goog-api-key": c.key,
    },
    JSON.stringify(body),
    o.tries,
  );

  if (!res)
    throw new Error("Không kết nối được dịch vụ AI (hết thời gian chờ)");
  const raw = res.raw != null ? res.raw : await res.text();
  if (!res.ok) {
    if (res.message) {
      const err = new Error(res.message);
      err.quota = !!res.quota;
      throw err;
    }
    let detail = raw.slice(0, 300);
    try {
      detail = JSON.parse(raw).error.message.slice(0, 300);
    } catch (e) {}
    throw new Error(`AI trả lỗi ${res.status}: ${detail}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error("AI trả về không phải JSON hợp lệ");
  }
  const cand = (data.candidates && data.candidates[0]) || null;
  const text =
    cand && cand.content && cand.content.parts
      ? cand.content.parts.map((p) => p.text || "").join("")
      : "";
  if (!text.trim()) {
    const why = data.promptFeedback && data.promptFeedback.blockReason;
    throw new Error(
      why
        ? `Nội dung bị chặn theo chính sách: ${why}`
        : "AI không trả về nội dung",
    );
  }
  return {
    text,
    usage: data.usageMetadata || null,
    finishReason: (cand && cand.finishReason) || null,
  };
}

function parseJsonLoose(text) {
  const t = String(text)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(t);
  } catch (e) {}
  const start = t.indexOf("{"),
    end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch (e) {}
  }
  throw new Error("Không thể bóc tách JSON từ kết quả AI");
}

function extractQuestions(text) {
  const src = String(text);
  const out = [];
  const opens = [];
  let inStr = false,
    esc = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") {
      opens.push(i);
      continue;
    }
    if (ch !== "}" || !opens.length) continue;
    const slice = src.slice(opens.pop(), i + 1);
    if (!/"stem"\s*:/.test(slice)) continue;
    try {
      out.push(JSON.parse(slice));
    } catch (e) {}
  }
  return out;
}

function readList(call) {
  let data;
  try {
    data = parseJsonLoose(call.text);
  } catch (err) {
    const saved = extractQuestions(call.text);
    if (saved.length) return { list: saved, salvaged: true };
    throw new Error(`Không thể đọc mảng câu hỏi từ AI (${err.message})`);
  }
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list))
    throw new Error("JSON trả về không chứa mảng questions");
  return { list, salvaged: false };
}

/* ==========================================================================
   CHUẨN HÓA CÂU HỎI & NÂNG CẤP FALLBACK
   ========================================================================== */

function strList(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(cleanPreservingCode)
    .filter(Boolean);
}
function intList(arr, max) {
  return (Array.isArray(arr) ? arr : [])
    .map((v) => (typeof v === "number" ? v : parseInt(v, 10)))
    .filter((v) => Number.isFinite(v) && v >= 0 && v < max);
}

function optionIndexes(values, options) {
  const out = [];
  (Array.isArray(values) ? values : []).forEach((v) => {
    if (typeof v === "number") {
      if (v >= 0 && v < options.length) out.push(v);
      return;
    }
    const t = cleanSingleLine(v).toLowerCase();
    const byText = options.findIndex(
      (o) => cleanSingleLine(o).toLowerCase() === t,
    );
    if (byText >= 0) out.push(byText);
  });
  return Array.from(new Set(out)).sort((x, y) => x - y);
}

function hashId(text) {
  return crypto
    .createHash("sha1")
    .update(String(text))
    .digest("hex")
    .slice(0, 12);
}

const TOEIC_TOPICS = ["Thì", "Từ loại", "Giới từ", "Đại từ", "Từ vựng", "Nghe"];
const ML_TOPICS = [
  "ML — Toán & Python",
  "ML — Học có giám sát",
  "ML — Học không giám sát",
  "ML — AI hiện đại (RAG, XAI, MLOps)",
];
const KNOWN_TOPICS = TOEIC_TOPICS.concat(ML_TOPICS);

function unaccent(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s) {
  return new Set(unaccent(s).split(" ").filter(Boolean));
}

function similar(a, b) {
  const ta = tokens(a),
    tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  ta.forEach((w) => {
    if (tb.has(w)) hit++;
  });
  return (2 * hit) / (ta.size + tb.size);
}

function simplifyTopic(t) {
  return String(t || "")
    .replace(/[\u0400-\u04FF\u3000-\u30FF\u4E00-\u9FFF]+/g, " ")
    .replace(/["”“'`:;,.]+/g, " ")
    .replace(/[_]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 7)
    .join(" ");
}

function pickTopic(raw, skill, subject) {
  const t = simplifyTopic(raw);
  const pool = subject === "ml" ? ML_TOPICS : TOEIC_TOPICS;
  if (!t) return skill === "listening" ? "Nghe" : "Từ vựng";
  const exact = KNOWN_TOPICS.find((k) => unaccent(k) === unaccent(t));
  if (exact) return exact;
  let best = "",
    score = 0;
  for (const k of pool) {
    const s = Math.max(
      similar(k, t),
      unaccent(t).includes(unaccent(k)) ? 0.8 : 0,
    );
    if (s > score) {
      score = s;
      best = k;
    }
  }
  if (score >= 0.5) return best;
  if (subject === "ml") return t.slice(0, 48);
  return skill === "listening" ? "Nghe" : "Từ vựng";
}

const ANSWER_LINE_RE = /^\s*(?:Đáp án|Đáp số|Answer|Đ\/A)\s*[:\-]?\s*(.+?)\s*$/im;
function answerLine(text) {
  const m = String(text || "").match(ANSWER_LINE_RE);
  return m ? m[1].trim() : "";
}

/* Đề phải đúng nguyên văn file. Model thỉnh thoảng dính thêm ký tự vào cuối
   ("... is the ______.v") — tìm dòng gốc gần nhất trong nguồn để chép lại, chỉ
   khi không tìm ra mới coi là câu AI tự chế. */
function matchSourceLine(stem, source) {
  const s = unaccent(stem);
  if (!s) return "";
  if (unaccent(source).includes(s)) return stem;
  let best = "";
  let score = 0;
  for (const raw of String(source).split("\n")) {
    const t = raw.trim();
    if (!t || (!/_{3,}/.test(t) && !/\?\s*$/.test(t))) continue;
    const v = similar(t, stem);
    if (v > score) {
      score = v;
      best = t;
    }
  }
  return score >= 0.8
    ? best.replace(
        /^\s*(?:\[\s*Loại\s*:[^\]]*\]\s*)?(?:Câu\s*\d+|\d+)\s*[:.)]\s*/,
        "",
      )
    : "";
}

/* Một "chunk" gửi AI có thể chứa nhiều câu, nên dòng "Đáp án:" phải tìm GẦN câu này:
   bắt đầu từ vị trí stem rồi quét tới trước câu kế tiếp (tối đa 1500 ký tự).
   Trước đây lấy dòng Đáp án ĐẦU TIÊN của cả chunk nên mọi câu trong chunk bị gán
   cùng một đáp án. */
function answerLineNear(source, stem) {
  const text = String(source || "");
  if (!text) return "";
  const fallback = answerLine(text);
  const key = String(stem || "").trim().slice(0, 40);
  if (!key) return fallback;
  const at = text.indexOf(key);
  if (at < 0) return fallback;
  return answerLine(text.slice(at, at + 1500)) || fallback;
}

const LETTER = /[A-F]/g;
function lettersToIndexes(line, options) {
  const found = String(line).toUpperCase().match(LETTER);
  if (!found) return [];
  return Array.from(new Set(found.map((l) => l.charCodeAt(0) - 65)))
    .filter((i) => i >= 0 && i < options.length)
    .sort((a, b) => a - b);
}

function textToIndex(line, options) {
  const t = unaccent(line);
  if (!t) return -1;
  let i = options.findIndex((o) => unaccent(o) === t);
  if (i < 0)
    i = options.findIndex(
      (o) => unaccent(o).startsWith(t) || t.startsWith(unaccent(o)),
    );
  return i;
}

const TF_MARK = /\[\s*(Đ|S|Đúng|Sai|True|False|T|F)\s*\]\s*$/i;
function tfValue(mark) {
  return /^(đ|t|true|đúng)/i.test(String(mark).trim());
}

function pickLines(chunk, re) {
  const out = [];
  const r = new RegExp(re.source, "gm");
  let m;
  while ((m = r.exec(String(chunk)))) {
    const t = cleanPreservingCode(m[m.length - 1]);
    if (t) out.push(t);
  }
  return out;
}

const RE_STEM_MARKED =
  /^\s*(?:\[\s*Loại\s*:[^\]]*\]\s*)?(?:Câu\s*\d+\s*[:.])\s*(.+)$/is;
const RE_STEM_PLAIN = /^\s*\d+\.\s+(.+)$/s;
function stemFromSource(chunk) {
  for (const raw of String(chunk).split("\n\n")) {
    const l = raw.trim();
    if (!l || MARK_HEADING.test(l) || /^---|PASSAGE|ĐOẠN VĂN/i.test(l))
      continue;
    const m = l.match(RE_STEM_MARKED) || l.match(RE_STEM_PLAIN);
    if (m) return cleanPreservingCode(m[1]);
  }
  return "";
}

function restore(list, sourceLines) {
  if (!list.length || list.length !== sourceLines.length)
    return { list, changed: false };
  let changed = false;
  const out = list.map((v, i) => {
    if (v !== sourceLines[i] && similar(v, sourceLines[i]) >= 0.7) {
      changed = true;
      return sourceLines[i];
    }
    return v;
  });
  return { list: out, changed };
}

function tfToken(tok) {
  const t = String(tok || "")
    .replace(/[).]+$/, "")
    .trim();
  if (/^(Đ|Đúng|True|T)$/i.test(t)) return true;
  if (/^(S|Sai|False|F)$/i.test(t)) return false;
  return null;
}

function parseTfLine(line) {
  const t = String(line || "").trim();
  if (!t) return [];
  const out = [];
  const re = /(\d+)\s*[-–—=:]\s*([^\s,;]+)/g;
  let m;
  while ((m = re.exec(t))) {
    const v = tfToken(m[2]);
    if (v !== null) out[Number(m[1]) - 1] = v;
  }
  if (out.length) return out.filter((v) => v !== undefined);
  const parts = t.split(/[\s,;|]+/).filter(Boolean);
  const vals = parts.map(tfToken);
  return parts.length && vals.every((v) => v !== null) ? vals : [];
}

function parseNumericLine(line) {
  const t = String(line).replace(/,/g, ".");
  const pair = t.match(
    /(-?\d+(?:\.\d+)?)\s*(?:±|\+\/-|\\pm)\s*(\d+(?:\.\d+)?)/,
  );
  if (pair) return { value: Number(pair[1]), tolerance: Number(pair[2]) };
  const one = t.match(/-?\d+(?:\.\d+)?/);
  return { value: one ? Number(one[0]) : NaN, tolerance: NaN };
}

function parseMatchLine(line, leftCount, rightCount) {
  const out = [];
  const re = /(\d+)\s*[-=:(]\s*([a-fA-F])\b/g;
  let m;
  while ((m = re.exec(String(line)))) {
    const i = Number(m[1]) - 1,
      j = m[2].toUpperCase().charCodeAt(0) - 65;
    if (i >= 0 && i < leftCount && j >= 0 && j < rightCount) out[i] = j;
  }
  return out.every((v) => v !== undefined)
    ? out.filter((v) => v !== undefined)
    : [];
}

const RE_OPT = /^\s*[\(\[]?\s*[A-Da-d]\s*[).\]]\s+(.+)$/;
const RE_STATE = /^\s*[a-dA-D][).]\s+(.+)$/;
const RE_LEFT = /^\s*\d+\.\s+(.+)$/;
const RE_STEP = /^\s*(?:Bước|Step)\s*\d+\s*[:.\-)]?\s+(.+)$/i;

/* Câu tạm chọn A vì file không có đáp án. Cờ này không được lọt vào JSON/CSDL;
   analyze() dùng nó để gom câu gửi lượt "tự giải" thứ hai. */
function flagNeedSolve(row) {
  try {
    Object.defineProperty(row, "$needSolve", {
      value: true,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } catch (e) {}
}
function needsSolve(row) {
  return Boolean(row && row.$needSolve);
}

function normalizeItem(item, order, source) {
  const problems = [];
  const review = []; // lý do cần người xem lại; còn lý do thì câu KHÔNG vào game
  let line = ""; // dòng "Đáp án:" của CHÍNH câu này (xem answerLineNear)
  const type = TYPES[item.type]
    ? item.type
    : item.skill === "listening"
      ? "audio_mcq"
      : "mcq";
  if (!TYPES[item.type])
    problems.push(
      `Câu ${order + 1}: Dạng "${item.type}" không hợp lệ -> tự động chuyển thành ${type}`,
    );

  let stem = cleanPreservingCode(item.stem);
  if (!stem)
    return { problem: `Câu ${order + 1}: Thiếu nội dung câu hỏi (stem)` };

  // Khôi phục chữ tiếng Việt nhưng KHÔNG phá vỡ định dạng code
  const srcStem = source ? stemFromSource(source) : "";
  if (srcStem && similar(stem, srcStem) >= 0.7 && stem !== srcStem) {
    stem = srcStem;
    problems.push(
      `Câu ${order + 1}: Đã cập nhật nguyên văn stem từ file gốc để giữ chuẩn dấu tiếng Việt & khối Code`,
    );
  }
  line = source ? answerLineNear(source, item.stem || stem) : "";

  let offFile = false; // stem không có trong file -> nhiều khả năng AI tự chế
  if (
    source &&
    (type === "mcq" || type === "audio_mcq" || type === "passage_mcq") &&
    unaccent(stem).length > 12
  ) {
    const fixed = matchSourceLine(stem, source);
    if (!fixed) offFile = true;
    else if (fixed !== stem) {
      problems.push(
        `Câu ${order + 1}: Đề lệch so với file ("${stem.slice(0, 60)}") — đã chép lại nguyên văn "${fixed.slice(0, 60)}"`,
      );
      stem = fixed;
    }
  }

  const skill =
    SKILLS.indexOf(item.skill) >= 0
      ? item.skill
      : type === "audio_mcq"
        ? "listening"
        : type === "writing_short" || type === "writing_essay"
          ? "writing"
          : "reading";
  const subject =
    SUBJECTS.indexOf(item.subject) >= 0
      ? item.subject
      : /ML\b|machine\s+learning|học\s+máy/i.test(
            cleanSingleLine(item.topic) + " " + stem,
          )
        ? "ml"
        : "toeic";
  const difficulty =
    [1, 2, 3].indexOf(Number(item.difficulty)) >= 0
      ? Number(item.difficulty)
      : 1;

  const row = {
    id: hashId(type + "|" + stem.toLowerCase()),
    t: pickTopic(item.topic, skill, subject),
    q: stem,
    o: null,
    a: null,
    n: cleanPreservingCode(item.explanation).slice(0, 800),
    num: order + 1,
    qtype: type,
    typeLabel: TYPES[type].label,
    playable: TYPES[type].play === "mcq",
    subject,
    skill,
    difficulty,
    passage: cleanPreservingCode(item.passage) || null,
    audio_url: cleanSingleLine(item.audio_url) || null,
    payload: {},
  };

  const options = restore(
    strList(item.options),
    source ? pickLines(source, RE_OPT) : [],
  ).list;
  const answers = strList(item.answers);

  if (type === "passage_mcq" || type === "audio_mcq") {
    row.id = hashId(
      [
        type,
        stem.toLowerCase(),
        (row.passage || "").slice(0, 120).toLowerCase(),
        row.audio_url || "",
        options.join("|").toLowerCase(),
      ].join("|"),
    );
  }

  const junkOptions =
    options.length >= 2 && options.every((o) => unaccent(o).length <= 1);
  const offSource = source ? similar(stem, source) < 0.15 : false;
  if (stem.length < 15 && (junkOptions || offSource)) {
    return {
      problem: `Câu ${order + 1}: Nội dung "${stem.slice(0, 30)}" quá ngắn hoặc sai lệch — đã bỏ qua`,
    };
  }

  if (type === "mcq" || type === "audio_mcq" || type === "passage_mcq") {
    /* Đề vụn ("their belongings.") = một câu bị model tách làm đôi → không trả lời
       được, bỏ hẳn và báo để người soạn gộp lại. */
    if (!/_{2,}/.test(stem) && !/\?\s*$/.test(stem) && /^[a-zà-ỹ]/.test(stem))
      return {
        problem: `Câu ${order + 1}: Đề bị cắt vụn "${stem.slice(0, 40)}" — đã bỏ qua (nhiều khả năng là phần đuôi của câu liền trước)`,
      };
    /* Model "chế" câu hỏi từ danh sách từ vựng thì đề không tồn tại trong file gốc:
       gắn cờ review để không tự tích lưu, thay vì âm thầm bỏ. */
    if (offFile) {
      review.push("Không thấy nguyên văn đề trong file (AI có thể tự chế)");
      problems.push(
        `Câu ${order + 1}: Không tìm thấy nguyên văn "${stem.slice(0, 50)}" trong file — AI có thể tự chế câu này, đã bỏ tích`,
      );
    }
    if (options.length < 2)
      return {
        problem: `Câu ${order + 1} (${type}): Thiếu danh sách đáp án A-D`,
      };
    let ai = Number(item.answer_index);
    const aiFromModel = Number.isFinite(ai) && ai >= 0 && ai < options.length;
    if (!aiFromModel) ai = -1;
    if (ai < 0) {
      const one = lettersToIndexes(line, options);
      if (one.length === 1) ai = one[0];
      else ai = textToIndex(line, options);
      if (ai < 0 && answers.length) ai = textToIndex(answers[0], options);
      if (ai >= 0)
        problems.push(
          `Câu ${order + 1}: AI bỏ sót đáp án, đã tự động bóc tách lại từ dòng "Đáp án:"`,
        );
    }
    if (ai < 0) {
      ai = 0;
      flagNeedSolve(row);
      review.push("Thiếu đáp án đúng (tạm chọn A)");
      problems.push(
        `Câu ${order + 1}: Chưa có đáp án đúng, tạm chọn A — hãy kiểm tra lại trước khi lưu`,
      );
    } else if (aiFromModel && !line && !answers.length) {
      // File không có đáp án: AI tự giải, không phải bóc tách -> vẫn chơi được,
      // nhưng ghi rõ để người soạn đề liếc lại.
      problems.push(
        `Câu ${order + 1}: File không có đáp án — AI tự giải và chọn ${String.fromCharCode(65 + ai)} (nên kiểm tra lại)`,
      );
    }
    row.o = options.slice(0, 6);
    row.a = ai;
    if (type === "passage_mcq" && !row.passage) {
      review.push("Thiếu đoạn văn");
      problems.push(
        `Câu ${order + 1}: Bài đọc hiểu (passage_mcq) chưa có nội dung đoạn văn`,
      );
    }
    if (type === "audio_mcq" && !row.audio_url) {
      review.push("Thiếu file audio");
      problems.push(
        `Câu ${order + 1}: Câu nghe (audio_mcq) chưa có đường dẫn audio`,
      );
    }
    row.payload = { answer: ai };
    if (row.passage) row.payload.passage = row.passage;
  } else if (type === "multi") {
    if (options.length < 2)
      return { problem: `Câu ${order + 1} (multi): Thiếu các lựa chọn` };
    let idx = optionIndexes(item.answers, options);
    if (!idx.length) {
      idx = lettersToIndexes(line, options);
      if (idx.length)
        problems.push(
          `Câu ${order + 1}: AI bỏ sót đáp án multi, đã phục hồi từ dòng "Đáp án:"`,
        );
    }
    if (!idx.length) {
      idx = [0];
      review.push("Chưa có đáp án multi (tạm lấy ô đầu)");
      problems.push(
        `Câu ${order + 1}: Chưa chọn đáp án multi, tạm lấy đáp án đầu tiên`,
      );
    }
    row.o = options;
    row.payload = { options, answer: idx };
  } else if (type === "tf") {
    const aiBl = (Array.isArray(item.booleans) ? item.booleans : []).map(
      (v) => v === true || v === "true" || v === "Đ" || v === 1,
    );
    const numbered = source ? pickLines(source, RE_LEFT) : [];
    const lettered = source ? pickLines(source, RE_STATE) : [];
    let st = restore(strList(item.statements), lettered.concat(numbered)).list;
    if (!st.length) st = lettered.length ? lettered : numbered;
    if (!st.length)
      return { problem: `Câu ${order + 1} (tf): Thiếu danh sách mệnh đề` };

    const marksOf = (lines) =>
      lines.map((s) => {
        const m = s.match(TF_MARK);
        return m ? tfValue(m[1]) : null;
      });
    const marks = marksOf(st);
    const fromLine = parseTfLine(line);
    let fromFile = null;

    if (marks.every((v) => v !== null)) {
      st = st.map((s) => s.replace(TF_MARK, "").trim());
      fromFile = marks;
    } else if (fromLine.length === st.length) fromFile = fromLine;

    let bl;
    if (fromFile) {
      bl = fromFile;
      if (aiBl.length === st.length && fromFile.some((v, i) => v !== aiBl[i])) {
        problems.push(
          `Câu ${order + 1}: Đã ưu tiên giá trị Đúng/Sai trích xuất từ file gốc thay cho AI`,
        );
      }
    } else if (aiBl.length === st.length) {
      bl = aiBl;
    } else {
      bl = st.map(() => true);
      review.push("Chưa rõ Đúng/Sai (tạm gán True)");
      problems.push(
        `Câu ${order + 1}: Chưa rõ Đúng/Sai cho ${st.length} mệnh đề — tạm gán True`,
      );
    }
    row.payload = {
      statements: st.map((s) => s.replace(TF_MARK, "").trim()),
      answer: bl,
    };
  } else if (type === "fill") {
    let list = answers.length ? answers : strList([item.sample_answer]);
    if (!list.length && line) {
      list = strList(line.split(/\s*[|;]\s*|\s+hoặc\s+/i));
      if (list.length)
        problems.push(
          `Câu ${order + 1}: Khôi phục đáp án điền từ theo dòng "Đáp án:"`,
        );
    }
    if (!list.length)
      return { problem: `Câu ${order + 1} (fill): Thiếu đáp án chấp nhận` };
    if (!/_{2,}/.test(stem))
      problems.push(
        `Câu ${order + 1}: Cảnh báo - stem thiếu ký tự chỗ trống _______`,
      );
    row.payload = { answers: list };
  } else if (type === "numeric") {
    let val = Number(item.numeric);
    let tol = Number(item.tolerance);
    if (!Number.isFinite(val)) {
      const nums = parseNumericLine(line);
      val = nums.value;
      tol = nums.tolerance;
      if (Number.isFinite(val))
        problems.push(
          `Câu ${order + 1}: Tự động trích xuất đáp số dạng số từ file`,
        );
    }
    if (!Number.isFinite(val))
      return { problem: `Câu ${order + 1} (numeric): Thiếu kết quả số` };
    row.payload = { answer: val, tolerance: Number.isFinite(tol) ? tol : 0.01 };
  } else if (type === "match") {
    const left = restore(
      strList(item.left),
      source ? pickLines(source, RE_LEFT) : [],
    ).list;
    const right = restore(
      strList(item.right),
      source ? pickLines(source, RE_STATE) : [],
    ).list;
    if (left.length < 2 || right.length < 2)
      return {
        problem: `Câu ${order + 1} (match): Hai cột nối cặp cần tối thiểu 2 phần tử`,
      };
    let pairs = intList(item.pairs, right.length);
    if (pairs.length !== left.length) {
      const fromLine = parseMatchLine(line, left.length, right.length);
      if (fromLine.length === left.length) {
        pairs = fromLine;
        problems.push(`Câu ${order + 1}: Phục hồi cặp nối theo dòng "Đáp án:"`);
      } else {
        pairs = left.map((_, i) => (i < right.length ? i : 0));
        review.push("Chưa có cặp nối đúng (tạm nối 1-1)");
        problems.push(`Câu ${order + 1}: Tạm thời nối cặp theo thứ tự 1-1`);
      }
    }
    row.payload = { left, right, answer: pairs };
  } else if (type === "order") {
    const steps = restore(
      strList(item.steps),
      source ? pickLines(source, RE_STEP) : [],
    ).list;
    if (steps.length < 2)
      return {
        problem: `Câu ${order + 1} (order): Thiếu danh sách các bước quy trình`,
      };
    row.payload = { steps };
  } else if (type === "writing_short") {
    const kw = strList(item.keywords);
    const sample = cleanPreservingCode(item.sample_answer);
    if (!kw.length && !sample)
      return {
        problem: `Câu ${order + 1} (writing_short): Thiếu từ gợi ý và câu mẫu`,
      };
    row.payload = { keywords: kw, sample_answer: sample };
  } else if (type === "writing_essay") {
    row.payload = {
      min_words: Number(item.min_words) > 0 ? Number(item.min_words) : 120,
      rubric: cleanPreservingCode(item.explanation),
    };
  }

  row.status = review.length ? "review" : "ok";
  row.reviewReasons = review;
  row.playable = row.playable && !review.length;
  return { row, problems };
}

// Câu đọc hiểu / nghe hay lặp lại cùng một câu hỏi cho nhiều đoạn văn
// ("What is the purpose of the email?"), nên khóa loại trùng phải gồm cả đoạn văn,
// audio và đáp án. Các dạng khác giữ nguyên khóa cũ (chỉ theo stem).
function dedupeKey(item) {
  const base = unaccent(cleanSingleLine(item && item.stem));
  if (!base) return "";
  const t = item && item.type;
  if (t !== "passage_mcq" && t !== "audio_mcq") return base;
  return [
    base,
    unaccent(cleanSingleLine(item.passage)).slice(0, 120),
    unaccent(cleanSingleLine(item.audio_url)),
    unaccent(strList(item.options).join("|")),
  ].join("§");
}

function normalize(list) {
  const src = Array.isArray(list) ? list : [];
  const seen = {};
  const unique = src.filter((item) => {
    const key = dedupeKey(item);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });

  const problems = [];
  if (unique.length !== src.length)
    problems.push(
      `Đã tự động loại bỏ ${src.length - unique.length} câu trùng lặp`,
    );

  const rows = [];
  unique.forEach((item, i) => {
    const r = normalizeItem(item || {}, i, item && item.$source);
    if (r.problem) problems.push(r.problem);
    else if (r.row) {
      rows.push(r.row);
      problems.push(...(r.problems || []));
    }
  });
  rows.forEach((r, i) => {
    r.num = i + 1;
  });
  return { questions: rows, problems };
}

/* ==========================================================================
   BẮT VÀ ĐỐI CHIẾU BẢNG ANSWER KEY VÀO CÂU HỎI
   ========================================================================== */

function isKeyHeading(t) {
  if (!/^(ĐÁP\s*ÁN|DAP\s*AN|ANSWER\s*KEY)/i.test(t) || /^[A-D]\s*[.)]/.test(t))
    return false;
  if (/^(Đáp\s*án|Answer)\s*[:\-]\s*\(?[A-D]\)?\s*$/i.test(t)) return false;
  const sep = t.search(/[:\-–]/);
  if (sep < 0) return true;
  const after = t.slice(sep + 1).trim();
  return /^\d{1,3}\s*[.)]/.test(after) || /^ANSWER\s*KEY/i.test(after);
}

function splitAnswerKey(text) {
  const lines = String(text || "").split(/\r?\n/);
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isKeyHeading(lines[i].trim())) {
      at = i;
      break;
    }
  }
  if (at < 0) return { body: text, key: null };
  const tail = lines.slice(at).join("\n");
  const key = {};
  const re =
    /(\d{1,4})\s*[.)]\s*\(?([A-D])\)?(?![\p{L}])([\s\S]*?)(?=\s*\d{1,4}\s*[.)]\s*\(?[A-D]\)?(?![\p{L}])|\s*$)/gu;
  let m;
  while ((m = re.exec(tail))) {
    const n = parseInt(m[1], 10);
    if (n in key) continue;
    const value = String(m[3])
      .replace(/\s+/g, " ")
      .split(/(?:PHẦN|PART\b|SECTION|ĐÁP\s*ÁN|ANSWER\s*KEY)/i)[0]
      .trim()
      .slice(0, 80);
    key[n] = { letter: m[2], text: value };
  }
  const nums = Object.keys(key)
    .map(Number)
    .sort((a, b) => a - b);
  const full = nums.length && nums.every((n, i) => n === i + 1);
  return {
    body: lines.slice(0, at).join("\n"),
    key: full ? key : null,
    count: nums.length,
  };
}

function keyNote(key) {
  if (!key) return "";
  const pairs = Object.keys(key).map((n) => `${n}-${key[n].letter}`);
  return (
    `\nBảng đáp án chính thức tìm thấy trong file: ${pairs.join(", ")}.` +
    " Hãy ưu tiên dùng mảng này để gán answer_index (0=A, 1=B, 2=C, 3=D)."
  );
}

function clearNeedSolve(row) {
  try {
    row.$needSolve = false;
  } catch (e) {}
}

function dropStaleAnswerProblems(problems, n) {
  const re = new RegExp("^Câu\\s*" + n + "\\s*:\\s*Chưa có đáp án đúng");
  for (let i = problems.length - 1; i >= 0; i--) {
    if (re.test(problems[i])) problems.splice(i, 1);
  }
}

function applyKey(out, key) {
  const qs = out.questions;
  if (qs.length !== Object.keys(key).length) {
    out.problems.push(
      `Bảng đáp án cuối file có ${Object.keys(key).length} câu, nhưng tìm thấy ${qs.length} câu trong thân bài.`,
    );
    return;
  }
  const taken = new Set();
  qs.forEach((q) => {
    const k = key[q.num];
    if (!TYPES[q.qtype] || TYPES[q.qtype].play !== "mcq") return; // multi/tf/... không dùng answer_index
    if (!k || !Array.isArray(q.o) || q.o.length < 2) return;
    const opts = q.o.map((s) => String(s));
    const cleanK = k.text ? unaccent(k.text) : "";
    let idx = cleanK ? opts.findIndex((s) => unaccent(s) === cleanK) : -1;
    if (idx < 0) idx = "ABCDEF".indexOf(k.letter);
    if (idx < 0 || idx >= opts.length) return;
    if (q.a !== idx) q.a = idx;
    if (Array.isArray(q.reviewReasons) && q.reviewReasons.length) {
      q.reviewReasons = q.reviewReasons.filter((r) => !/đáp án đúng/i.test(r));
      if (!q.reviewReasons.length) {
        q.status = "ok";
        q.playable = true;
      }
    }
    clearNeedSolve(q);
    dropStaleAnswerProblems(out.problems, q.num);
    taken.add(q.num);
  });
  if (taken.size) {
    out.problems.push(
      `Đã đối chiếu thành công ${taken.size} đáp án từ bảng ANSWER KEY.`,
    );
  }
}

/* ==========================================================================
   LƯỢT 2 — AI TỰ GIẢI CÂU THIẾU ĐÁP ÁN
   Đề ôn tập rất hay bị cắt mất bảng đáp án. Lượt 1 chỉ bóc tách nên để trống
   answer_index, và mọi câu rơi về "tạm chọn A". Sau khi chuẩn hoá, gom đúng
   những câu đó vào một prompt giải ngắn (schema riêng, temperature 0,
   ~30 token/câu) rồi điền đáp án thật + lý do ngắn.
   ========================================================================== */

const SOLVE_SCHEMA = {
  type: "OBJECT",
  properties: {
    answers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          n: { type: "INTEGER" },
          answer_index: { type: "INTEGER" },
          why: { type: "STRING" },
        },
        required: ["n", "answer_index"],
      },
    },
  },
  required: ["answers"],
};

const SOLVE_SYSTEM = [
  "Bạn là giáo viên TOEIC/Machine Learning đang chữa đề.",
  "Các câu dưới đây CHƯA có đáp án — hãy tự giải và chọn đúng MỘT đáp án cho mỗi câu.",
  "Chọn theo đúng ngữ pháp/ngữ nghĩa của câu, KHÔNG chọn A cho có.",
  "Trả về JSON đúng định dạng, đủ MỌI câu được liệt kê.",
  "answer_index: 0=A, 1=B, 2=C, 3=D theo đúng thứ tự đáp án in ra. why: tối đa 15 từ, tiếng Việt, nói gọn vì sao đáp án đó đúng.",
].join("\n");

function solveBlock(row, n) {
  const opts = row.o.map(
    (text, i) => `${"ABCDEF"[i]}. ${cleanSingleLine(text)}`,
  );
  const passage = row.passage
    ? `Đoạn văn:\n${String(row.passage).slice(0, 1200)}\n`
    : "";
  return `Câu ${n}:\n${passage}${String(row.q).trim()}\n${opts.join("\n")}`;
}

function solveBatches(rows) {
  const out = [];
  let cur = [],
    size = 0;
  for (const row of rows) {
    const len =
      String(row.q).length +
      String(row.passage || "").length +
      row.o.join(" ").length +
      40;
    if (cur.length && (cur.length >= SOLVE_BATCH || size + len > SOLVE_MAX_CHARS)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(row);
    size += len;
  }
  if (cur.length) out.push(cur);
  return out;
}

function solvePrompt(batch) {
  return [
    `Giải ${batch.length} câu trắc nghiệm sau (mỗi câu chọn 1 đáp án):`,
    "",
    batch.map((row, i) => solveBlock(row, i + 1)).join("\n\n"),
  ].join("\n");
}

/* Kết quả có thể bị cắt giữa chừng (MAX_TOKENS) — vớt các cặp số đã in ra
   thay vì bỏ cả lô. */
function salvageSolved(text) {
  const src = String(text || "");
  const out = [];
  const pairs = /"n"\s*:\s*(\d+)[\s\S]{0,160}?"answer_index"\s*:\s*(-?\d+)/g;
  const flipped =
    /"answer_index"\s*:\s*(-?\d+)[\s\S]{0,160}?"n"\s*:\s*(\d+)/g;
  let m;
  while ((m = pairs.exec(src)))
    out.push({ n: Number(m[1]), answer_index: Number(m[2]) });
  if (!out.length)
    while ((m = flipped.exec(src)))
      out.push({ n: Number(m[2]), answer_index: Number(m[1]) });
  return out;
}

function applySolved(batch, text, finishReason) {
  let list;
  try {
    const data = parseJsonLoose(text);
    list = Array.isArray(data)
      ? data
      : Array.isArray(data.answers)
        ? data.answers
        : [];
  } catch (e) {
    list = salvageSolved(text);
    if (!list.length)
      throw new Error(
        finishReason === "MAX_TOKENS"
          ? "AI trả lời quá dài nên bị cắt (MAX_TOKENS)"
          : "Không thể bóc tách JSON từ kết quả AI giải",
      );
  }
  if (!list.length) throw new Error("AI không trả về đáp án nào");
  const byN = {};
  list.forEach((a, i) => {
    if (!a || typeof a !== "object") return;
    const n = Math.round(Number(a.n));
    byN[Number.isFinite(n) && n > 0 ? n : i + 1] = a;
  });
  const solved = [];
  batch.forEach((row, i) => {
    const a = byN[i + 1];
    if (!a) return;
    const idx = Math.round(Number(a.answer_index));
    if (!Number.isFinite(idx) || idx < 0 || idx >= row.o.length) return;
    row.a = idx;
    row.payload = Object.assign({}, row.payload, { answer: idx });
    const why = cleanSingleLine(a.why).slice(0, 300);
    if (why) row.n = why;
    row.reviewReasons = (row.reviewReasons || []).filter(
      (r) => !/đáp án/i.test(r),
    );
    row.status = row.reviewReasons.length ? "review" : "ok";
    row.playable = !row.reviewReasons.length;
    row.solved = true;
    clearNeedSolve(row);
    solved.push(row);
  });
  return solved;
}

function noteSolved(problems, solved) {
  const byNum = {};
  solved.forEach((q) => (byNum[q.num] = q));
  for (let i = 0; i < problems.length; i++) {
    const m = problems[i].match(/^Câu\s*(\d+)\s*:/);
    const row = m && byNum[Number(m[1])];
    if (!row || !/Chưa có đáp án đúng/.test(problems[i])) continue;
    problems[i] = `Câu ${row.num}: File không có đáp án — AI tự giải và chọn ${String.fromCharCode(65 + row.a)} (nên kiểm tra lại)`;
  }
}

async function solveBatch(batch, o, usage) {
  const call = await callModel(solvePrompt(batch), {
    system: SOLVE_SYSTEM,
    schema: SOLVE_SCHEMA,
    temperature: 0,
    maxTokens: 70 * batch.length + 200,
  });
  addUsage(usage, call.usage);
  if (o.onChunk)
    o.onChunk({
      chunk: "",
      header: `Giải đáp án (${batch.length} câu).`,
      text: call.text,
      finishReason: call.finishReason,
    });
  return applySolved(batch, call.text, call.finishReason);
}

async function solveRows(rows, o, usage) {
  const batches = solveBatches(rows);
  const failed = [];
  const solved = [];
  let stop = false;

  /* Lô bị cắt / lỗi JSON thì chia đôi thử lại — lô nhỏ khó tràn token hơn. */
  async function run(batch) {
    if (stop) return;
    try {
      solved.push(...(await solveBatch(batch, o, usage)));
    } catch (err) {
      const msg = (err && err.message) || String(err);
      if (err && err.quota) {
        failed.push(msg);
        stop = true;
        return;
      }
      if (batch.length > 4) {
        const mid = Math.ceil(batch.length / 2);
        await run(batch.slice(0, mid));
        await run(batch.slice(mid));
        return;
      }
      failed.push(msg);
    }
  }

  for (const b of batches) {
    if (stop) break;
    await run(b);
  }
  return { solved, failed, batches: batches.length };
}

function chunkPrompt(chunk, header, note) {
  const total = countQuestions(chunk);
  const expect = total ? ` Khối văn bản này chứa khoảng ${total} câu hỏi.` : "";
  return `${header} Hãy phân tích văn bản trong 3 dấu nháy bên dưới và trả về JSON chuẩn:${expect}${note || ""}\n"""\n${chunk}\n"""`;
}

function countQuestions(chunk) {
  const marked = chunk.match(/\[Loại:/g);
  if (marked && marked.length) return marked.length;
  const numbered = chunk.match(/^\s*(?:Câu\s*\d+|\d+\.)\s/gm);
  /* File không đánh số câu (chỉ "A. of  B. for") vẫn đếm được nhờ chỗ trống:
     nếu không có con số này thì prompt không nhắc model trả đủ, và model hay
     trả thiếu (145/169) mà không ai phát hiện. */
  const blanks = chunk.match(/^.*_{3,}.*$/gm);
  return Math.max(
    numbered ? numbered.length : 0,
    blanks ? blanks.length : 0,
  );
}

function addUsage(target, usage) {
  if (!usage) return;
  target.promptTokenCount += usage.promptTokenCount || 0;
  target.candidatesTokenCount += usage.candidatesTokenCount || 0;
  target.totalTokenCount += usage.totalTokenCount || 0;
}

function incomplete(list, chunk) {
  if (!list.length) return true;
  return list.some((q) => {
    if (!q || !q.type) return true;
    const t = q.type;
    if (
      t === "mcq" ||
      t === "audio_mcq" ||
      t === "passage_mcq" ||
      t === "multi"
    ) {
      return !Array.isArray(q.options) || q.options.filter(Boolean).length < 2;
    }
    if (t === "tf")
      return !Array.isArray(q.statements) || q.statements.length < 1;
    if (t === "match")
      return (
        !Array.isArray(q.left) ||
        !Array.isArray(q.right) ||
        q.left.length < 2 ||
        q.right.length < 2
      );
    if (t === "order") return !Array.isArray(q.steps) || q.steps.length < 2;
    if (t === "numeric")
      return !Number.isFinite(Number(q.numeric)) && !answerLine(chunk);
    if (t === "fill")
      return (
        (!Array.isArray(q.answers) || !q.answers.length) && !answerLine(chunk)
      );
    return false;
  });
}

async function analyzeChunk(chunk, header, state, opts) {
  const o = opts || {};
  const attempts = [
    { schema: responseSchema() },
    { schema: responseSchema(), temperature: 0.3 },
    {},
  ];
  let lastErr = null;
  for (let a = 0; a < attempts.length; a++) {
    const attempt = attempts[a];
    const extra = attempt.schema
      ? ""
      : '\nChỉ trả về JSON dạng {"questions":[...]}.';
    try {
      const call = await callModel(
        chunkPrompt(chunk, header, o.keyNote) + extra,
        attempt,
      );
      if (o.onChunk)
        o.onChunk({
          chunk,
          header,
          text: call.text,
          finishReason: call.finishReason,
        });
      const parsed = readList(call);

      if (incomplete(parsed.list, chunk) && a < attempts.length - 1) {
        lastErr = new Error("Dữ liệu câu hỏi chưa hoàn chỉnh");
        continue;
      }

      parsed.list.forEach((q) => {
        if (q && typeof q === "object") {
          try {
            Object.defineProperty(q, "$source", {
              value: chunk,
              enumerable: false,
              configurable: true,
            });
          } catch (e) {}
        }
      });
      state.items.push(...parsed.list);
      addUsage(state.usage, call.usage);

      const truncated = call.finishReason === "MAX_TOKENS";
      if (truncated) state.truncated = true;

      if (
        (truncated || parsed.salvaged) &&
        incomplete(parsed.list, chunk) &&
        chunk.length > 1500 * 2
      ) {
        state.truncated = true;
        const mid = chunk.lastIndexOf("\n\n", Math.floor(chunk.length / 2));
        const cut = mid > 0 ? mid : Math.floor(chunk.length / 2);
        const halves = [chunk.slice(0, cut).trim(), chunk.slice(cut).trim()];
        for (let i = 0; i < halves.length; i++) {
          await analyzeChunk(halves[i], `${header} phần ${i + 1}`, state, opts);
        }
      }
      return;
    } catch (err) {
      lastErr = err;
      if (err && err.quota) break;
    }
  }
  throw lastErr;
}

/* ==========================================================================
   MAIN ENTRY POINT: ANALYZE RAW TEXT
   ========================================================================== */

/* Gắn nghĩa tiếng Việt của các lựa chọn + cụm từ cố định (tra trong chính danh
   sách từ vựng của file) vào payload.g từng câu. Không gọi AI, không tốn token. */
function attachHints(questions, rawText) {
  const glossary = Explainer.harvestGlossary(String(rawText || ""));
  const terms = Object.keys(glossary).length;
  let attached = 0;
  if (!terms) return { terms: 0, attached: 0 };
  for (const q of questions || []) {
    if (!q || !Array.isArray(q.o) || !q.q) continue;
    const hints = Explainer.hintsFor({ q: q.q, o: q.o }, glossary);
    if (!hints) continue;
    q.payload = Object.assign({}, q.payload, { g: hints });
    attached++;
  }
  return { terms, attached };
}

async function analyze(rawText, opts) {
  const o = Object.assign({}, opts);
  const separated = splitAnswerKey(rawText);
  if (separated.key) o.keyNote = keyNote(separated.key);

  const chunks = chunkText(separated.body, o.maxChars || MAX_CHARS_PER_CALL);
  const parallel = Math.max(
    1,
    Math.min(
      Number(o.parallel) || Number(process.env.AI_PARALLEL) || 2,
      chunks.length,
    ),
  );
  const usage = {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
  };
  const lists = new Array(chunks.length);
  let truncated = false,
    cursor = 0;
  const failed = [];

  async function worker() {
    for (let i = cursor++; i < chunks.length; i = cursor++) {
      const st = {
        items: [],
        truncated: false,
        usage: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        },
      };
      try {
        await analyzeChunk(chunks[i], `Đợt ${i + 1}/${chunks.length}.`, st, o);
        lists[i] = st.items;
        truncated = truncated || st.truncated;
        addUsage(usage, st.usage);
      } catch (err) {
        failed.push({
          index: i + 1,
          message: (err && err.message) || String(err),
        });
      }
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));

  const done = lists.filter(Boolean).length;
  if (!done) {
    throw new Error(
      failed.length
        ? failed[0].message
        : "Không phân tích được mảng dữ liệu nào",
    );
  }

  const all = [].concat.apply([], lists.filter(Boolean));
  const out = normalize(all);
  if (separated.key) applyKey(out, separated.key);

  /* Câu file không có đáp án: gửi một lượt giải ngắn để có đáp án thật
     thay vì mặc định A. Tắt bằng opts.solve=false hoặc AI_SOLVE=off. */
  const solveOn =
    o.solve !== false &&
    String(process.env.AI_SOLVE || "on").toLowerCase() !== "off";
  const pending = solveOn ? out.questions.filter(needsSolve) : [];
  const hadPending = solveOn ? pending.length > 0 : out.questions.some(needsSolve);
  let solved = 0;
  if (pending.length) {
    const res = await solveRows(pending, o, usage);
    solved = res.solved.length;
    noteSolved(out.problems, res.solved);
    const left = pending.length - solved;
    if (res.failed.length)
      out.problems.unshift(
        `Không giải được đáp án cho ${left} câu (${res.failed[0]}) — các câu này vẫn tạm chọn A.`,
      );
    else if (left)
      out.problems.unshift(
        `AI giải được ${solved}/${pending.length} câu thiếu đáp án — ${left} câu còn lại vẫn tạm chọn A.`,
      );
  }
  out.solved = solved;
  out.solveSkipped = !solveOn && hadPending;

  /* Nghĩa tiếng Việt lấy từ chính danh sách từ vựng của file (0 token): lưu vào
     payload.g để trò chơi tái hiện được phần phân tích chi tiết mà không gọi AI. */
  const hints = attachHints(out.questions, rawText);
  out.glossaryTerms = hints.terms;
  out.hintedQuestions = hints.attached;
  if (hints.terms)
    out.problems.push(
      `Đã tra ${hints.attached}/${out.questions.length} câu vào danh sách từ vựng của file (${hints.terms} từ) — phần phân tích miễn phí trong trò chơi dùng dữ liệu này.`,
    );

  if (chunks.glossaryLines)
    out.problems.unshift(
      `Đã bỏ qua ${chunks.glossaryLines} dòng danh sách từ vựng (không phải câu hỏi, không gửi cho AI).`,
    );

  /* Model hay âm thầm bỏ sót câu (145/169 với file không đánh số). Đếm số dòng có
     chỗ trống đã gửi rồi báo rõ nếu về ít hơn để người soạn biết mà chạy lại. */
  const expected = chunks.reduce((n, c) => n + countQuestions(c), 0);
  const missing = expected - out.questions.length;
  if (expected >= 5 && missing > 2)
    out.problems.unshift(
      `AI chỉ trả về ${out.questions.length}/${expected} câu hỏi có trong file — thiếu ${missing} câu. Chạy lại lần phân tích, hoặc giảm --max-chars để mỗi đợt gửi ít câu hơn.`,
    );

  if (failed.length) {
    out.problems.unshift(
      `Hoàn thành ${done}/${chunks.length} đợt. Một số đợt gặp sự cố: ${failed[0].message}`,
    );
  }
  if (truncated) {
    out.problems.unshift(
      "Kết quả AI bị ngắn do hết hạn mức token (MAX_TOKENS).",
    );
  }

  out.chunks = chunks.length;
  out.usage = usage;
  out.model = conf().model;
  return out;
}

async function ping() {
  const c = conf();
  if (!c.configured)
    return {
      ok: false,
      model: c.model,
      error: "Chưa cấu hình AI_API_KEY trong .env",
    };
  try {
    const r = await callModel("Trả lời đúng một từ: SẴN SÀNG", {
      maxTokens: 20,
    });
    return {
      ok: /SẴN SÀNG|OK/i.test(r.text),
      model: c.model,
      url: c.url,
      sample: r.text.slice(0, 40),
    };
  } catch (err) {
    return { ok: false, model: c.model, url: c.url, error: err.message };
  }
}

module.exports = {
  TYPES,
  TYPE_NAMES,
  SYSTEM,
  conf,
  chunkText,
  countQuestions,
  matchSourceLine,
  normalize,
  analyze,
  ping,
  callModel,
  parseJsonLoose,
  extractQuestions,
  splitAnswerKey,
  applyKey,
  dedupeKey,
  needsSolve,
  solveBatches,
  solvePrompt,
  applySolved,
  attachHints,
};
