"use strict";

/* Dịch máy MIỄN PHÍ (không cần API key, không tốn lượt AI).
   Dùng cho khối 💡 trước khi rơi xuống Gemini: câu + 4 đáp án là 5 request ngắn.
   Có timeout, thử lại 1 lần, và chỉ trả chuỗi đã cắt khoảng trắng.
   Tắt bằng TRANSLATE_FREE=off trong .env. */

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const TIMEOUT_MS = 8000;
const RETRY = 1;

function enabled() {
  return String(process.env.TRANSLATE_FREE || "on").toLowerCase() !== "off";
}

async function one(text) {
  const url =
    ENDPOINT +
    "?client=gtx&sl=en&tl=vi&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; toeic-tro-choi)" },
  });
  if (!res.ok) throw new Error("Dịch miễn phí trả HTTP " + res.status);
  const data = await res.json();
  const segments = Array.isArray(data && data[0]) ? data[0] : [];
  const out = segments
    .map((s) => (Array.isArray(s) && typeof s[0] === "string" ? s[0] : ""))
    .join("")
    .trim();
  if (!out) throw new Error("Dịch miễn phí trả bản dịch rỗng");
  return out;
}

async function translateTexts(texts) {
  if (!enabled()) throw new Error("Dịch miễn phí đang tắt (TRANSLATE_FREE=off)");
  const out = [];
  for (const raw of texts) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) {
      out.push("");
      continue;
    }
    let lastErr;
    for (let attempt = 0; attempt <= RETRY; attempt++) {
      try {
        out.push(await one(text));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
  }
  return out;
}

module.exports = { enabled, translateTexts, one };
