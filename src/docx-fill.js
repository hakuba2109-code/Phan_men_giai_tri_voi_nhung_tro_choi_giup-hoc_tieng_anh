/* Điền đáp án vào chính file .docx gốc.
   Chỉ thêm một đoạn "Đáp án: ..." ngay sau khối lựa chọn của từng câu nên giữ nguyên
   định dạng, ảnh, bảng, header/footer và mọi thứ khác của file Word.
*/
const JSZip = require("jszip");

const ANSWER_COLOR = "C00000";

function decodeXml(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function norm(s) {
  return String(s || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[_\-–—]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function letter(i) {
  return String.fromCharCode(65 + Number(i));
}

/* Các đoạn văn cấp cao nhất, chịu được w:p lồng trong hộp văn bản */
function scanParagraphs(xml) {
  const re = /<w:p(?:\s[^>]*)?(\/?)>|<\/w:p>/g;
  const out = [];
  let depth = 0;
  let start = 0;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0] === "</w:p>") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0) out.push({ start, end: re.lastIndex, xml: xml.slice(start, re.lastIndex) });
      }
    } else if (m[1] !== "/") {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return out;
}

function paraText(p) {
  let text = "";
  p.replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:tab|br)\s*\/>/g, (all, t) => {
    text += t == null ? " " : decodeXml(t);
    return all;
  });
  return text;
}

function optionList(q) {
  const p = q.payload || {};
  if (Array.isArray(p.options)) return p.options;
  if (Array.isArray(q.o)) return q.o;
  return [];
}

function answerLabel(q) {
  const type = q.qtype || q.qt || q.type || "mcq";
  const p = q.payload || {};
  const opts = optionList(q);

  if (type === "mcq" || type === "audio_mcq" || type === "passage_mcq") {
    const raw = p.answer != null && p.answer !== "" ? p.answer : q.a;
    if (raw == null || raw === "") return null;
    const idx = Number(raw);
    if (!Number.isInteger(idx) || idx < 0) return null;
    const text = opts[idx] != null ? String(opts[idx]).trim() : "";
    return letter(idx) + (text ? " " + text : "");
  }
  if (type === "multi") {
    const list = Array.isArray(p.answer) ? p.answer.slice() : [];
    if (!list.length) return null;
    list.sort((a, b) => a - b);
    return list.map((i) => letter(i) + (opts[i] != null ? " " + String(opts[i]).trim() : "")).join(", ");
  }
  if (type === "tf") {
    const list = Array.isArray(p.answer) ? p.answer : [];
    if (!list.length) return null;
    return list.map((v) => (v ? "Đúng" : "Sai")).join(", ");
  }
  if (type === "fill") {
    const list = Array.isArray(p.answers) ? p.answers : p.answer != null ? [p.answer] : [];
    if (!list.length) return null;
    return list.map((v) => String(v).trim()).filter(Boolean).join(" / ");
  }
  if (type === "numeric") {
    if (p.answer == null || p.answer === "") return null;
    const tol = p.tolerance == null ? "" : " (±" + p.tolerance + ")";
    return String(p.answer) + tol;
  }
  if (type === "order") {
    const steps = Array.isArray(p.steps) ? p.steps : [];
    if (!steps.length) return null;
    return steps.join(" → ");
  }
  if (type === "match") {
    const left = Array.isArray(p.left) ? p.left : [];
    const right = Array.isArray(p.right) ? p.right : [];
    const pairs = Array.isArray(p.answer) ? p.answer : [];
    if (!left.length || !pairs.length) return null;
    return left
      .map((l, i) => l + " → " + (right[pairs[i]] != null ? right[pairs[i]] : "?"))
      .join("; ");
  }
  return null;
}

function optionHits(text, opts) {
  const t = " " + norm(text) + " ";
  let hits = 0;
  for (const o of opts) {
    const n = norm(o);
    if (n && t.includes(" " + n + " ")) hits += 1;
  }
  return hits;
}

function isOptionsParagraph(text, opts) {
  const marks = (text.match(/\(([A-H])\)/g) || []).length;
  if (marks >= 2) return true;
  const usable = opts.filter((o) => norm(o).length >= 2);
  if (usable.length < 2) return false;
  return optionHits(text, opts) >= Math.max(2, Math.ceil(usable.length / 2));
}

function tokenScore(text, stem) {
  const words = (s) =>
    new Set(
      norm(s)
        .split(" ")
        .filter((w) => w.length > 2),
    );
  const want = words(stem);
  const have = words(text);
  if (!want.size || !have.size) return 0;
  let inter = 0;
  for (const w of want) if (have.has(w)) inter += 1;
  return inter / want.size;
}

function optionsNear(paras, i, opts) {
  const limit = Math.min(paras.length, i + 9);
  for (let j = i + 1; j < limit; j += 1) {
    const text = paras[j].text.trim();
    if (!text) continue;
    if (isOptionsParagraph(text, opts)) return true;
    if (/^\s*(?:Câu\s*)?\d+\s*[.)]/.test(text)) return false;
  }
  return false;
}

/* Tìm đoạn cuối của khối lựa chọn (có thể nằm ngay trong đoạn câu hỏi) */
function optionsAnchor(paras, i, opts, used) {
  let anchor = isOptionsParagraph(paras[i].text, opts) ? i : -1;
  if (anchor === i) used.add(i);
  const limit = Math.min(paras.length, i + 9);
  for (let j = i + 1; j < limit; j += 1) {
    const text = paras[j].text.trim();
    if (!text) continue;
    if (isOptionsParagraph(text, opts) || /^\(?[A-H]\)/.test(text)) {
      anchor = j;
      used.add(j);
      continue;
    }
    if (anchor >= 0) break;
    if (/^\s*(?:Câu\s*)?\d+\s*[.)]/.test(text)) break;
  }
  return anchor >= 0 ? anchor : i;
}

function paragraphProps(pxml) {
  const m = pxml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  if (!m) return "";
  const inner = m[1]
    .replace(/<w:numPr>[\s\S]*?<\/w:numPr>/g, "")
    .replace(/<w:numPr\s*\/>/g, "");
  return inner.trim() ? "<w:pPr>" + inner + "</w:pPr>" : "";
}

function answerParagraph(label, anchorXml) {
  return (
    "<w:p>" +
    paragraphProps(anchorXml) +
    '<w:r><w:rPr><w:b/><w:u w:val="single"/><w:color w:val="' +
    ANSWER_COLOR +
    '"/></w:rPr><w:t xml:space="preserve">Đáp án: ' +
    encodeXml(label) +
    "</w:t></w:r></w:p>"
  );
}

function appendBlock(xml, block) {
  const sect = xml.lastIndexOf("<w:sectPr");
  if (sect >= 0) return xml.slice(0, sect) + block + xml.slice(sect);
  const body = xml.lastIndexOf("</w:body>");
  if (body >= 0) return xml.slice(0, body) + block + xml.slice(body);
  return xml + block;
}

async function fillAnswers(buffer, questions) {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("File không phải .docx hợp lệ (thiếu word/document.xml)");

  let xml = await docFile.async("string");
  const paras = scanParagraphs(xml).map((p) => ({ ...p, text: paraText(p.xml) }));
  const used = new Set();
  const insertions = [];
  const unmatched = [];
  let noAnswer = 0;
  let filled = 0;

  questions.forEach((q, qi) => {
    const label = answerLabel(q);
    if (!label) {
      noAnswer += 1;
      return;
    }
    const stem = norm(q.q || q.stem || "");
    const key = stem.length > 60 ? stem.slice(0, 60) : stem;
    const opts = optionList(q);

    let at = -1;
    if (key.length >= 10) {
      const hit = paras.findIndex((p, i) => !used.has(i) && p.text && norm(p.text).includes(key));
      if (hit >= 0) {
        used.add(hit);
        at = optionsAnchor(paras, hit, opts, used);
      }
    }
    if (at < 0) {
      let best = -1;
      let bestScore = 0;
      let secondScore = 0;
      paras.forEach((p, i) => {
        if (used.has(i) || !p.text.trim()) return;
        const score = tokenScore(p.text, q.q || q.stem || "");
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          best = i;
        } else if (score > secondScore) {
          secondScore = score;
        }
      });
      if (best >= 0 && bestScore >= 0.7 && bestScore - secondScore >= 0.05) {
        used.add(best);
        at = optionsAnchor(paras, best, opts, used);
      }
    }
    if (at < 0 && q.num != null && Number.isFinite(Number(q.num))) {
      const re = new RegExp("^\\s*(?:Câu\\s*)?" + Number(q.num) + "\\s*[.)]");
      const hit = paras.findIndex((p, i) => !used.has(i) && re.test(p.text));
      if (hit >= 0 && optionsNear(paras, hit, opts)) {
        used.add(hit);
        at = optionsAnchor(paras, hit, opts, used);
      }
    }

    if (at < 0) {
      unmatched.push({ num: q.num || qi + 1, label, stem: String(q.q || "").slice(0, 90) });
      return;
    }
    insertions.push({ pos: paras[at].end, xml: answerParagraph(label, paras[at].xml) });
    filled += 1;
  });

  insertions.sort((a, b) => b.pos - a.pos);
  for (const ins of insertions) {
    xml = xml.slice(0, ins.pos) + ins.xml + xml.slice(ins.pos);
  }

  if (unmatched.length) {
    const lines = unmatched.map(
      (u) => u.num + ". " + u.label + (u.stem ? "  —  " + u.stem : ""),
    );
    const block =
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ĐÁP ÁN CÁC CÂU CHƯA CHÈN ĐƯỢC VÀO ĐÚNG VỊ TRÍ</w:t></w:r></w:p>' +
      lines
        .map(
          (l) =>
            '<w:p><w:r><w:t xml:space="preserve">' +
            encodeXml(l) +
            "</w:t></w:r></w:p>",
        )
        .join("");
    xml = appendBlock(xml, block);
  }

  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer: out,
    stats: { total: questions.length, filled, unmatched: unmatched.length, noAnswer },
  };
}

module.exports = { fillAnswers, answerLabel, scanParagraphs, paraText, norm };
