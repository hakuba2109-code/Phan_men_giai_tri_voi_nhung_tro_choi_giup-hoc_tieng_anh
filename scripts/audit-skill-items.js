"use strict";
/* Kiểm độ phủ thật của 4 trò kỹ năng mới (skill-extra.js) trên toàn ngân hàng:
   0 token, không gọi AI — đọc CSDL (hoặc seed.json nếu không có CSDL) rồi in
   số câu/thẻ theo từng bộ đề và thống kê lý do bỏ câu.

   Cú pháp (cmd.exe):
     cd /d E:\Toeic\Tro_Choi
     node scripts\audit-skill-items.js
     node scripts\audit-skill-items.js --show 5      :: in mẫu 5 thẻ/câu mỗi trò
   Mã thoát khác 0 nếu phát hiện mâu thuẫn.                          */
const fs = require("fs");
const path = require("path");
const S = require("./skill-extra");
const X = require("./explainer");

const SHOW = (() => {
  const i = process.argv.indexOf("--show");
  return i > 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();
const IDS = ["spot", "classpos", "classtense", "classprep"];

async function load() {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
    const importer = require("../src/importer");
    const [questions, files] = await Promise.all([
      importer.listQuestions(),
      importer.listFiles(),
    ]);
    await require("../src/db").close();
    if (!questions.length) throw new Error("CSDL rỗng");
    return { questions, files, from: "PostgreSQL" };
  } catch (e) {
    const seed = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "json", "seed.json"), "utf8"),
    );
    return {
      questions: seed.questions,
      files: seed.files || [],
      from: "seed.json (" + e.message + ")",
    };
  }
}

/* Mâu thuẫn phải bị chặn: thẻ/trò mà tự trái với dữ liệu đã lưu là dạy sai. */
function check(id, items, byId) {
  const bad = [];
  items.forEach((it) => {
    const label = (id === "spot" ? it.full : JSON.stringify(it.card)).slice(0, 70);
    if (id === "spot") {
      const tok = it.tokens.slice(it.span[0], it.span[1]).join(" ");
      if (tok.replace(/[^A-Za-z']/g, "").toLowerCase() !==
        it.wrong.replace(/[^A-Za-z']/g, "").toLowerCase())
        bad.push("span không khớp từ sai :: " + label);
      if (it.wrong.toLowerCase() === it.answer.toLowerCase())
        bad.push("từ sai trùng đáp án :: " + label);
      if (it.o.filter((o) => o.ok).length !== 1)
        bad.push("danh sách sửa không có đúng 1 đáp án :: " + label);
      const src = byId.get(it.key);
      if (src && it.full.toLowerCase().indexOf(String(src.o[src.a]).toLowerCase()) < 0)
        bad.push("câu đúng không chứa đáp án đã lưu :: " + label);
      return;
    }
    if (it.key !== undefined) bad.push("thẻ mang key, sẽ bị ghi vào lịch sử :: " + label);
    if (it.bins.length < 2 || it.bins.length > 4)
      bad.push("số ô = " + it.bins.length + " :: " + label);
    if (!it.bins.some((b) => b.id === it.answerBin))
      bad.push("ô đúng không có trong danh sách ô :: " + label);
    if (new Set(it.bins.map((b) => b.label)).size !== it.bins.length)
      bad.push("trùng nhãn ô :: " + label);
    if (/undefined|NaN/.test(JSON.stringify(it.card) + (it.why || "")))
      bad.push("văn bản thẻ có undefined/NaN :: " + label);
    if (String(it.why || "").length > 140) bad.push("why quá dài :: " + label);
  });
  return bad;
}

(async () => {
  const { questions, files, from } = await load();
  const byId = new Map(questions.map((q) => [q.id, q]));
  const name = {};
  (files || []).forEach((f) => (name[f.id] = f.filename || f.name || ("file " + f.id)));
  const decks = new Map();
  questions.forEach((q) => {
    const k = q.f == null ? "khác" : name[q.f] || "file " + q.f;
    if (!decks.has(k)) decks.set(k, []);
    decks.get(k).push(q);
  });
  console.log("nguồn: " + from + " · " + questions.length + " câu · " + decks.size + " bộ đề");

  const total = {},
    skipAll = {},
    samples = {},
    poolSize = {},
    bad = [];
  IDS.forEach((id) => {
    total[id] = 0;
    poolSize[id] = 0;
    skipAll[id] = {};
  });
  const rows = [];
  [...decks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([deck, pool]) => {
      const row = { deck: deck.replace(/\.docx$/i, "").slice(0, 46) };
      IDS.forEach((id) => {
        const r = S.audit(id, pool, { explainer: X, rng: Math.random });
        row[id] = r.items.length;
        total[id] += r.items.length;
        if (id !== "spot") {
          const seen = new Set(
            S._internal.rawCards(id.slice(5), pool, { explainer: X }).map(
              (c) => JSON.stringify(c.card) + "|" + c.answerBin,
            ),
          );
          poolSize[id] += seen.size;
        }
        Object.keys(r.skip).forEach((k) => {
          skipAll[id][k] = (skipAll[id][k] || 0) + r.skip[k];
        });
        (samples[id] = samples[id] || []).push(...r.items.slice(0, SHOW).map((x) => ({ deck, x })));
        bad.push(...check(id, r.items, byId).map((m) => id + " · " + m));
      });
      rows.push(row);
    });

  const cols = ["deck"].concat(IDS);
  const w = {};
  cols.forEach((c) => (w[c] = Math.max(c.length, ...rows.map((r) => String(r[c]).length))));
  const line = (r) => cols.map((c) => String(r[c]).padEnd(w[c])).join("  ");
  console.log("\nSố câu/thẻ mỗi trò theo bộ đề");
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  rows.forEach((r) => console.log(line(r)));
  console.log(line(Object.assign({ deck: "TỔNG" }, total)));

  console.log("\nLý do bỏ câu (toàn ngân hàng)");
  console.log(
    "  bể thẻ đã khử trùng (mỗi ván chỉ lấy tối đa 12): " +
    IDS.filter((id) => id !== "spot").map((id) => id + " " + poolSize[id]).join(" · "),
  );
  IDS.forEach((id) => {
    const s = skipAll[id];
    console.log(
      "  " + id.padEnd(11) + total[id] + " mục · " +
      (Object.keys(s).length ? Object.entries(s).map(([k, v]) => k + ":" + v).join(" · ") : "không bỏ câu nào"),
    );
  });
  console.log("\nmâu thuẫn: " + bad.length);
  bad.slice(0, 20).forEach((b) => console.log("  - " + b));
  if (SHOW)
    IDS.forEach((id) => {
      console.log("\n===== " + id);
      (samples[id] || []).slice(0, SHOW).forEach(({ deck, x }) => {
        if (id === "spot") {
          console.log("  [" + deck.slice(0, 24) + "] " + x.tokens.join(" "));
          console.log("      sai: " + x.wrong + " → đúng: " + x.answer + (x.wrongLine ? " || " + x.wrongLine : ""));
        } else {
          console.log("  [" + deck.slice(0, 24) + "] " + (x.card.word ||
            x.card.before + " _____ " + x.card.after));
          console.log("      ô đúng: " + x.answerBin + " || " + x.why);
        }
      });
    });
  process.exit(bad.length ? 1 : 0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
