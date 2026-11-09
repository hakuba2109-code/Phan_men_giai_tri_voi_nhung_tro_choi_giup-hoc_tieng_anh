"use strict";
const assert = require("assert");
process.env.CERT_SECRET = "x".repeat(32);
const C = require("../src/certificate");
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("  ✔", n); } catch (e) { fail++; console.log("  ✘", n, "\n     ", e.message.split("\n")[0]); } };
const base = { runId: 5, userId: 3, fileTitle: "ĐC 10 - REVIEW GHKI", holderName: "Nhu San", total: 169, firstTry: 150, assisted: 0, issuedAt: "2026-10-31T10:00:00.000Z" };

t("mã đúng dạng, ổn định, không có ký tự dễ nhầm", () => {
  const a = C.makeCode(base);
  assert.ok(C.CODE_RE.test(a), a);
  assert.strictEqual(a, C.makeCode({ ...base }));
  assert.ok(!/[ILOU01]/.test(a.slice(3)));
});
t("đổi bất kỳ trường nào thì mã đổi (chống sửa ảnh)", () => {
  const a = C.makeCode(base);
  for (const [k, v] of [["holderName", "Nhu Sang"], ["firstTry", 169], ["assisted", 1], ["total", 168], ["issuedAt", "2026-11-01T10:00:00.000Z"], ["userId", 4], ["fileTitle", "Khác"]])
    assert.notStrictEqual(a, C.makeCode({ ...base, [k]: v }), k);
});
t("sameCode so khớp đúng/sai và không ném lỗi khi độ dài khác", () => {
  const a = C.makeCode(base);
  assert.ok(C.sameCode(a, a));
  assert.ok(!C.sameCode(a, "TC-AAAA-AAAA-AAAA"));
  assert.ok(!C.sameCode(a, "ngắn"));
});
t("thiếu hoặc ngắn CERT_SECRET -> lỗi 503 rõ ràng", () => {
  const old = process.env.CERT_SECRET;
  process.env.CERT_SECRET = "ngan";
  try { C.makeCode(base); assert.fail("phải ném lỗi"); } catch (e) { assert.strictEqual(e.status, 503); }
  process.env.CERT_SECRET = old;
});
t("normalizeCode chấp nhận chữ thường/khoảng trắng", () => {
  assert.strictEqual(C.normalizeCode("  tc-abcd-efgh-jkmn "), "TC-ABCD-EFGH-JKMN");
});
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
