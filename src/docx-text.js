"use strict";

/* Đọc .docx thành văn bản để đưa cho bộ phân tích.
   - File KHÔNG có bảng: dùng đúng extractRawText như trước (không đổi gì).
   - File có bảng: bảng 2 cột (không phải bảng đáp án) được ghi thành khối
         [BẢNG 2 CỘT]
         ô trái | ô phải
     để AI thấy được hai cột của câu nối cặp. Bảng khác (ví dụ bảng ĐÁP ÁN) giữ
     cách ghi cũ: mỗi ô một đoạn văn. */

const mammoth = require("mammoth");

const KEY_HEAD = /^(câu|đáp án|dap an|stt|no\.?|#|question|answer)$/i;
const KEY_NUM = /^(câu\s*)?\d+[.)]?$/i;

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");

function cellText(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function tableToText(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      cellText(c[1]),
    ),
  );
  if (!rows.length) return "";
  const twoCol = rows.length >= 2 && rows.every((r) => r.length === 2);
  const keyLike =
    rows.some((r) => r.some((c) => KEY_HEAD.test(c))) ||
    rows.every((r) => KEY_NUM.test(r[0] || ""));
  if (twoCol && !keyLike) {
    return (
      "\n\n[BẢNG 2 CỘT]\n" + rows.map((r) => r.join(" | ")).join("\n") + "\n\n"
    );
  }
  return "\n\n" + rows.map((r) => r.join("\n\n")).join("\n\n") + "\n\n";
}

function blockToText(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|ul|ol)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
}

async function docxToText(buffer) {
  const html = (
    await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(() =>
          Promise.resolve({ src: "" }),
        ),
      },
    )
  ).value;
  if (!/<table[\s>]/i.test(html)) {
    return (await mammoth.extractRawText({ buffer })).value;
  }
  return html
    .split(/(<table[\s\S]*?<\/table>)/gi)
    .map((p) => (/^<table/i.test(p) ? tableToText(p) : blockToText(p)))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = { docxToText, tableToText, blockToText };
