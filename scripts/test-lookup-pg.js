"use strict";
/* Kiểm thử tích hợp Bôi đen để dịch trên HTTP thật + PostgreSQL (không gọi AI, 0 token).
   Tự dựng dữ liệu thử và DỌN SẠCH sau khi chạy.   node scripts/test-lookup-pg.js */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");
const { spawn } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = require("../src/db");
const core = require("../src/lookup-core");
const app = require("../src/server");
const X = require("../src/town-core").CONFIG.xu; // đơn giá + trần của hai nhóm 'words'/'wordnew'

let pass = 0;
let fail = 0;
async function t(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  ✔", name);
  } catch (err) {
    fail++;
    console.log("  ✘", name, "\n     ", String(err.message || err).split("\n")[0]);
  }
}

const TAG = "tlk" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
const TMP = path.join(os.tmpdir(), `lk-${TAG}`);
const userIds = [];
const wordIds = [];
let server = null;
let base = "";

function api(url, opts) {
  const o = opts || {};
  const headers = Object.assign({}, o.headers || {});
  if (o.cookie) headers.cookie = o.cookie;
  if (o.body) headers["content-type"] = "application/json";
  return fetch(base + url, {
    method: o.method || "GET",
    headers,
    body: o.body ? JSON.stringify(o.body) : undefined,
  }).then(async (res) => {
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch (err) {
      /* trả về HTML/trắng */
    }
    return { status: res.status, data, cookie: cookieOf(res) };
  });
}

function cookieOf(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const one = list.map((c) => c.split(";")[0]).find((c) => c.startsWith("toeic_session="));
  return one || null;
}

async function register(label) {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { email: `${TAG}-${label}@example.com`, password: "matkhau123", nickname: "Ôn thử" },
  });
  assert.strictEqual(res.status, 200, `đăng ký ${label}: ${JSON.stringify(res.data)}`);
  userIds.push(res.data.user.id);
  return { cookie: res.cookie, userId: res.data.user.id };
}

/* Ngày địa phương: so theo lịch, không so theo timestamp. */
const TZ = "Asia/Ho_Chi_Minh";

function localDate(when) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(when));
}

function addDays(fromIso, n) {
  const parts = localDate(fromIso).split("-").map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + n));
  return dt.toISOString().slice(0, 10);
}

function clock(when, zone) {
  const p = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone || TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(when))
    .forEach((x) => {
      if (x.type !== "literal") p[x.type] = x.value;
    });
  return `${p.hour}:${p.minute}:${p.second}`;
}

async function row(id) {
  const r = await db.query(`SELECT id, user_id, text_norm, box, reps, lapses, due_at FROM saved_words WHERE id = $1`, [id]);
  return r.rows[0];
}

/* ---------- soi cái ví chung ----------
   Xu thưởng cho sổ từ KHÔNG có ví riêng: nó nằm ở town_state.xu, sổ ở xu_ledger. */
const xuWallet = (uid) =>
  db.query(`SELECT xu FROM town_state WHERE user_id = $1`, [uid]).then((r) => Number(r.rows[0] && r.rows[0].xu));
const xuRows = (uid, source) =>
  db.query(`SELECT source_ref, amount FROM xu_ledger WHERE user_id = $1 AND source = $2 ORDER BY id`, [uid, source])
    .then((r) => r.rows);

function runDriver(envExtra) {
  const driver = path.join(TMP, "driver.js");
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(
    driver,
    '"use strict";\n' +
      "var w = [];\n" +
      "var rw = console.warn;\n" +
      "console.warn = function (m) { w.push(String(m)); };\n" +
      "var lk = require(process.argv[2]);\n" +
      "console.warn = rw;\n" +
      'console.log("RESULT=" + JSON.stringify({ groups: lk.CONFUSABLES.length, warned: w.join(" ") }));\n'
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [driver, path.join(__dirname, "..", "src", "lookup.js")], {
      env: Object.assign({}, process.env, envExtra),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (err += b));
    child.on("error", reject);
    child.on("close", (code) => {
      const line = String(out).match(/^RESULT=(.*)$/m);
      resolve({ code, out: line ? line[1] : String(out), err });
    });
  });
}

(async function main() {
  await db.applySchema();
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;

  const A = await register("a");
  const B = await register("b");
  const w = (n) => TAG + n;
  const save = (cookie, text, extra) =>
    api("/api/words", { method: "POST", cookie, body: Object.assign({ text, tz: TZ }, extra || {}) });
  const review = (cookie, id, rating) =>
    api(`/api/words/${id}/review`, { method: "POST", cookie, body: { rating, tz: TZ } });

  /* ---------- lưu thẻ + hạn ôn theo nửa đêm địa phương ---------- */

  let saved;
  await t("lưu từ: về hộp 0, hạn đúng 00:00 địa phương ngày mai", async () => {
    const res = await save(A.cookie, w("rec"), {
      meaningVi: "bản ghi chép",
      ipa: "/rɪˈkɔːd/",
      context: "Please save the meeting record.",
    });
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    saved = res.data.word;
    wordIds.push(saved.id);
    assert.strictEqual(saved.box, 0, "khởi điểm phải ở hộp 0");
    assert.strictEqual(saved.text, w("rec"));
    assert.strictEqual(saved.meaning, "bản ghi chép");
    assert.strictEqual(saved.ipa, "/rɪˈkɔːd/");
    const today = localDate(new Date().toISOString());
    assert.strictEqual(localDate(saved.dueAt), addDays(today, 1), "hạn phải là ngày mai theo lịch địa phương");
    assert.strictEqual(clock(saved.dueAt), "00:00:00", "hạn phải rơi vào nửa đêm địa phương");
  });

  await t("lưu lại cùng chữ (khác hoa/thường) không tạo thẻ thứ hai", async () => {
    const res = await save(A.cookie, w("REC").toUpperCase());
    assert.strictEqual(res.status, 200);
    assert.strictEqual(String(res.data.word.id), String(saved.id), "phải gộp về cùng một thẻ");
    const list = await db.query(`SELECT count(*)::int AS n FROM saved_words WHERE user_id = $1`, [A.userId]);
    assert.strictEqual(list.rows[0].n, 1);
  });

  await t("thẻ quá hạn thì xuất hiện trong danh sách ôn", async () => {
    await db.query(`UPDATE saved_words SET due_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [saved.id]);
    const res = await api(`/api/words/due?tz=${TZ}`, { cookie: A.cookie });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.saved, 1);
    assert.strictEqual(res.data.tz, TZ);
    assert.strictEqual(res.data.due.length, 1);
    assert.strictEqual(String(res.data.due[0].id), String(saved.id));
  });

  /* ---------- cache dùng chung, sổ từ dùng riêng ---------- */

  await t("lookup_cache không gắn tài khoản nên mọi người dùng lại được (0 token)", async () => {
    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'lookup_cache'`);
    const names = cols.rows.map((r) => r.column_name);
    assert.ok(!names.some((n) => /user|account|owner/i.test(n)), "cache bị gắn tài khoản: " + names.join(","));
    const idx = await db.query(`SELECT indexdef FROM pg_indexes WHERE tablename = 'lookup_cache'`);
    const uniq = idx.rows.map((r) => r.indexdef).filter((d) => /UNIQUE/i.test(d));
    assert.ok(uniq.length, "lookup_cache phải có khoá duy nhất trên content_hash");
    assert.match(uniq.join(" "), /content_hash/i);
  });

  await t("sổ từ giữ riêng: thẻ của A không lẫn vào danh sách của B", async () => {
    const res = await api(`/api/words/due?tz=${TZ}`, { cookie: B.cookie });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.saved, 0);
    assert.strictEqual(res.data.due.length, 0);
    assert.ok(!JSON.stringify(res.data).includes(w("rec")));
  });

  await t("khách chưa đăng nhập vẫn lưu được thẻ, ghi dưới uid 0", async () => {
    const res = await save(undefined, w("guest"), { meaningVi: "khách" });
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    wordIds.push(res.data.word.id);
    const r = await row(res.data.word.id);
    assert.strictEqual(r.user_id, 0, "khách phải ghi dưới uid 0");
    const mine = await api("/api/words/due", { cookie: A.cookie });
    assert.ok(!mine.data.due.some((x) => String(x.id) === String(res.data.word.id)));
  });

  /* ---------- chống truy cập chéo (nghiệm thu #23) ---------- */

  await t("B ôn thẻ của A → 404, hộp và số lần ôn của A không đổi", async () => {
    const before = await row(saved.id);
    const res = await review(B.cookie, saved.id, "know");
    assert.strictEqual(res.status, 404, "phải 404 (không 403) để không lộ sự tồn tại thẻ");
    assert.strictEqual(res.data.code, "NOT_FOUND");
    const after = await row(saved.id);
    assert.strictEqual(after.box, before.box);
    assert.strictEqual(after.reps, before.reps);
    assert.strictEqual(new Date(after.due_at).getTime(), new Date(before.due_at).getTime());
  });

  await t("B xoá thẻ của A → 404, thẻ vẫn còn nguyên", async () => {
    const res = await api(`/api/words/${saved.id}`, { method: "DELETE", cookie: B.cookie });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.code, "NOT_FOUND");
    assert.ok(await row(saved.id), "thẻ của A bị mất vì thao tác của B");
  });

  await t("B lưu từ trùng với A → thành thẻ khác, không ghi đè lên nhau", async () => {
    const res = await save(B.cookie, w("rec"), { meaningVi: "nghĩa của B" });
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    assert.notStrictEqual(String(res.data.word.id), String(saved.id));
    wordIds.push(res.data.word.id);
    const mine = await row(saved.id);
    assert.strictEqual(mine.user_id, A.userId);
    assert.strictEqual(mine.text_norm, w("rec"));
    assert.notStrictEqual(mine.meaning_vi, "nghĩa của B");
  });

  /* ---------- lịch ôn Leitner 6 hộp ---------- */

  const INTERVALS = [1, 3, 7, 14, 30, 60];
  let card;
  await t("tạo thẻ riêng cho chuỗi phân xử hộp", async () => {
    const res = await save(A.cookie, w("ship"));
    assert.strictEqual(res.status, 200);
    card = res.data.word;
    wordIds.push(card.id);
  });

  await t("đúng → lên 1 hộp, hạn đúng bảng [1,3,7,14,30,60] ngày", async () => {
    const res = await review(A.cookie, card.id, "know");
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    assert.strictEqual(res.data.state.box, 1);
    assert.strictEqual(res.data.state.days, INTERVALS[1]);
    assert.strictEqual(localDate(res.data.word.dueAt), addDays(new Date().toISOString(), 3));
    assert.strictEqual(clock(res.data.word.dueAt), "00:00:00");
    assert.strictEqual(res.data.tz, TZ);
    card = res.data.word;
  });

  await t("không chắc → giữ hộp, hạn bằng nửa (làm tròn, tối thiểu 1 ngày)", async () => {
    const res = await review(A.cookie, card.id, "unsure");
    assert.strictEqual(res.data.state.box, 1);
    assert.strictEqual(res.data.state.days, 2, "hộp 1 = 3 ngày → nửa là 2 ngày");
    assert.strictEqual(localDate(res.data.word.dueAt), addDays(new Date().toISOString(), 2));
  });

  await t("quên → về hộp 0, hạn ngày mai, lapses tăng 1", async () => {
    const before = await row(card.id);
    const res = await review(A.cookie, card.id, "forgot");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.state.box, 0);
    assert.strictEqual(res.data.state.days, 1);
    const after = await row(card.id);
    assert.strictEqual(after.box, 0);
    assert.strictEqual(after.lapses, before.lapses + 1);
    assert.strictEqual(after.reps, before.reps + 1);
    assert.strictEqual(localDate(after.due_at), addDays(new Date().toISOString(), 1));
  });

  await t("hộp cuối (60 ngày) → đúng vẫn giữ hộp 5, hạn 60 ngày", async () => {
    await db.query(`UPDATE saved_words SET box = 5 WHERE id = $1`, [card.id]);
    const res = await review(A.cookie, card.id, "know");
    assert.strictEqual(res.data.state.box, 5);
    assert.strictEqual(res.data.state.days, 60);
    assert.strictEqual(localDate(res.data.word.dueAt), addDays(new Date().toISOString(), 60));
  });

  await t("hai lượt ôn cùng thẻ gửi song song: cả hai đều tính đúng một lần", async () => {
    const before = await row(card.id);
    const both = await Promise.all([review(A.cookie, card.id, "know"), review(A.cookie, card.id, "know")]);
    assert.ok(both.every((r) => r.status === 200), JSON.stringify(both.map((r) => r.data)));
    const after = await row(card.id);
    assert.strictEqual(after.reps, before.reps + 2, "mỗi lượt ôn phải được tính đúng một lần");
  });

  await t("ôn 20 thẻ đến hạn liên tiếp trong một phiên", async () => {
    await db.query(`UPDATE saved_words SET due_at = NOW() + INTERVAL '1 day' WHERE id = $1`, [saved.id]);
    const ids = [];
    for (let i = 0; i < 20; i++) {
      const res = await save(A.cookie, `${w("bulk")}${i}`, { meaningVi: "mẫu " + i });
      assert.strictEqual(res.status, 200);
      ids.push(res.data.word.id);
      wordIds.push(res.data.word.id);
    }
    await db.query(`UPDATE saved_words SET due_at = NOW() - INTERVAL '1 hour' WHERE id = ANY($1::bigint[])`, [ids]);
    const due = await api(`/api/words/due?limit=20&tz=${TZ}`, { cookie: A.cookie });
    assert.strictEqual(due.data.due.length, 20, "phải lấy đủ 20 thẻ đến hạn");
    assert.strictEqual(due.data.total, 20);
    for (const id of ids) {
      const res = await review(A.cookie, id, "know");
      assert.strictEqual(res.status, 200, `ôn ${id}: ${JSON.stringify(res.data)}`);
    }
    const check = await db.query(
      `SELECT count(*)::int AS n FROM saved_words WHERE id = ANY($1::bigint[]) AND box = 1 AND due_at > NOW()`,
      [ids]
    );
    assert.strictEqual(check.rows[0].n, 20, "mọi thẻ phải lên hộp 1 và lùi hạn về tương lai");
  });

  /* ---------- xu cho sổ từ (X3): hai nguồn mới 'wordnew' + 'words' cùng chảy về MỘT ví ----------
     Dùng tài khoản W riêng: hai trần 6/15 xu tính theo NGÀY, lẫn với bài khác thì số cộng dồn khó đọc. */

  const W = await register("xu");
  const saveW = (n, extra) => save(W.cookie, w(n), extra);

  await t("lưu từ mới: +2 xu vào ví chung; lưu lại chữ đã có trong sổ thì không in xu", async () => {
    const first = await saveW("rec-a", { meaningVi: "bản ghi" });
    assert.strictEqual(first.status, 200, JSON.stringify(first.data));
    wordIds.push(first.data.word.id);
    assert.deepStrictEqual(first.data.xu, { reward: X.wordnew.perWord, balance: X.wordnew.perWord });
    assert.strictEqual(await xuWallet(W.userId), X.wordnew.perWord, "xu rơi thẳng vào town_state.xu");
    const again = await saveW("REC-A"); // cùng chữ, khác hoa thường -> ON CONFLICT, không phải thẻ mới
    wordIds.push(again.data.word.id);
    assert.strictEqual(again.data.xu.reward, 0, "sửa thẻ đã có không được tính là lưu từ mới");
    assert.strictEqual(again.data.word.id, first.data.word.id);
    assert.deepStrictEqual(await xuRows(W.userId, "wordnew"), [
      { source_ref: `wordnew:${first.data.word.id}`, amount: X.wordnew.perWord },
    ]);
    assert.strictEqual(await xuWallet(W.userId), X.wordnew.perWord, "sổ không thêm dòng thì ví không thêm xu");
  });

  await t("ôn thẻ: +1 xu/lượt, ôn lại cùng thẻ trong ngày không cộng, lịch Leitner vẫn chạy đủ", async () => {
    const a = await saveW("rev-a"); const b = await saveW("rev-b");
    wordIds.push(a.data.word.id, b.data.word.id);
    const base = await xuWallet(W.userId);
    const r1 = await review(W.cookie, a.data.word.id, "know");
    assert.strictEqual(r1.status, 200, JSON.stringify(r1.data));
    assert.strictEqual(r1.data.xu.reward, X.words.perCard);
    assert.strictEqual(r1.data.xu.balance, base + X.words.perCard, "balance trả về là số dư SAU khi cộng, đọc trong cùng giao dịch");
    const r2 = await review(W.cookie, a.data.word.id, "forgot");
    assert.strictEqual(r2.status, 200, "phiếu 'Quên' vẫn hợp lệ, chỉ có xu là không lặp lại");
    assert.strictEqual(r2.data.xu.reward, 0, "khóa 'word:<id>:<ngày>' chặn in xu lần hai cùng ngày");
    const after = await row(a.data.word.id);
    assert.strictEqual(after.box, 0, "thẻ Quên vẫn bị đẩy về hộp 0");
    assert.strictEqual(after.reps, 2, "việc đếm lượt ôn không bị chặn cùng chiều với xu");
    assert.strictEqual((await review(W.cookie, b.data.word.id, "know")).data.xu.reward, X.words.perCard, "thẻ khác = khóa khác, vẫn được thưởng");
    assert.strictEqual(await xuWallet(W.userId), base + 2 * X.words.perCard);
    assert.strictEqual((await xuRows(W.userId, "words")).length, 2);
  });

  await t("trần 15 xu/ngày nhóm 'words': 20 lượt ôn vẫn lên hộp đủ 20 thẻ, ví dừng đúng trần", async () => {
    const before = await xuWallet(W.userId);
    const ids = [];
    for (let i = 0; i < 20; i++) {
      const res = await saveW(`cap-w${i}`);
      assert.strictEqual(res.status, 200);
      ids.push(res.data.word.id);
      wordIds.push(res.data.word.id);
    }
    const left = X.words.cap - (await xuRows(W.userId, "words")).length; // 15 − 2 lượt đã ôn ở bài trên
    for (const id of ids) assert.strictEqual((await review(W.cookie, id, "know")).status, 200);
    const rowsW = await xuRows(W.userId, "words");
    assert.strictEqual(rowsW.length, X.words.cap, "đúng 15 dòng thưởng rồi thôi");
    assert.strictEqual(rowsW.reduce((n, r) => n + r.amount, 0), X.words.cap);
    assert.strictEqual(await xuWallet(W.userId), before + left, `ví chỉ lớn thêm ${left} xu`);
    const moved = await db.query(
      `SELECT count(*)::int AS n FROM saved_words WHERE id = ANY($1::bigint[]) AND box = 1 AND reps = 1`, [ids]);
    assert.strictEqual(moved.rows[0].n, 20, "chặn xu không có nghĩa chặn ôn: cả 20 thẻ phải lên hộp");
  });

  await t("trần 6 xu/ngày nhóm 'wordnew': lưu 22 từ chỉ in 6 xu, thẻ vẫn vào sổ đủ", async () => {
    const rowsNew = await xuRows(W.userId, "wordnew");
    assert.strictEqual(rowsNew.length, X.wordnew.cap / X.wordnew.perWord, "3 dòng rồi chặn (2 xu/từ)");
    assert.strictEqual(rowsNew.reduce((n, r) => n + r.amount, 0), X.wordnew.cap);
    const cards = await db.query(`SELECT count(*)::int AS n FROM saved_words WHERE user_id = $1`, [W.userId]);
    assert.ok(cards.rows[0].n >= 23, `phải có đủ thẻ, chỉ thấy ${cards.rows[0].n}`);
  });

  await t("GET /api/xu đọc đủ hai nguồn mới và bất biến sổ sách nghiêm với tài khoản sổ từ", async () => {
    const g = await api("/api/xu", { cookie: W.cookie });
    assert.strictEqual(g.status, 200, JSON.stringify(g.data));
    assert.strictEqual(g.data.income.words, X.words.cap);
    assert.strictEqual(g.data.income.wordnew, X.wordnew.cap);
    assert.strictEqual(g.data.left.words, 0);
    assert.strictEqual(g.data.balance, await xuWallet(W.userId), "API và ví phải cùng một con số");
    const books = await db.query(
      `SELECT (SELECT coalesce(sum(amount), 0)::int FROM town_ledger WHERE user_id = $1)
            + (SELECT coalesce(sum(amount), 0)::int FROM xu_ledger  WHERE user_id = $1) AS thu,
            (SELECT coalesce(sum(cost), 0)::int FROM xu_spend WHERE user_id = $1) AS chi,
            (SELECT xu FROM town_state WHERE user_id = $1) AS balance`, [W.userId]);
    const b = books.rows[0];
    assert.strictEqual(b.thu - b.chi, b.balance, "Σ thu − Σ chi phải khớp số dư: " + JSON.stringify(b));
  });

  /* ---------- chặn đầu vào ---------- */

  await t("rating không hợp lệ → 400, id không hợp lệ → không phải 500", async () => {
    const bad = await review(A.cookie, card.id, "maybe");
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.data.code, "BAD_RATING");
    const badId = await review(A.cookie, "abc", "know");
    assert.ok([400, 404].includes(badId.status), `trạng thái ${badId.status}`);
    const neg = await review(A.cookie, "-5", "know");
    assert.ok([400, 404].includes(neg.status), `trạng thái ${neg.status}`);
  });

  await t("không lưu được câu dài, không lưu chữ trống", async () => {
    const sent = await save(A.cookie, "The board will review the invoice next Monday.");
    assert.strictEqual(sent.status, 400);
    assert.strictEqual(sent.data.code, "NOT_SAVEABLE");
    const empty = await save(A.cookie, "   ");
    assert.strictEqual(empty.status, 400);
    assert.strictEqual(empty.data.code, "EMPTY");
    const long = await save(A.cookie, "a".repeat(121));
    assert.strictEqual(long.status, 400);
    assert.strictEqual(long.data.code, "TOO_LONG");
  });

  await t("chủ thẻ xoá được thẻ, xoá lần hai → 404", async () => {
    const res = await api(`/api/words/${saved.id}`, { method: "DELETE", cookie: A.cookie });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(String(res.data.removed), String(saved.id));
    assert.ok(!(await row(saved.id)));
    const again = await api(`/api/words/${saved.id}`, { method: "DELETE", cookie: A.cookie });
    assert.strictEqual(again.status, 404);
  });

  await t("múi giờ lạ bị đổi về mặc định, không phá lịch ôn", async () => {
    const res = await save(A.cookie, w("tz"), { tz: "Không/Phai" });
    assert.strictEqual(res.status, 200);
    wordIds.push(res.data.word.id);
    assert.ok(core.isValidTimeZone(res.data.tz), `tz trả về không hợp lệ: ${res.data.tz}`);
    assert.strictEqual(clock(res.data.word.dueAt, res.data.tz), "00:00:00");
  });

  /* ---------- file từ dễ nhầm hỏng (nghiệm thu #41) ---------- */

  const brokenFile = path.join(TMP, "bad.json");
  const shapeFile = path.join(TMP, "shape.json");
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(brokenFile, '{"groups": [ {"id": "a", "words": [');
  fs.writeFileSync(shapeFile, '{"groups": "không phải mảng"}');

  await t("confusables.json sai cú pháp → mô-đun vẫn nạp, chỉ cảnh báo", async () => {
    const r = await runDriver({ LOOKUP_CONFUSABLES_PATH: brokenFile });
    assert.strictEqual(r.code, 0, `lẽ ra không văng: ${r.err}`);
    const out = JSON.parse(r.out);
    assert.strictEqual(out.groups, 0, "JSON hỏng phải bỏ qua, không sập server");
    assert.match(out.warned, /confusables/i, "phải ghi dòng cảnh báo");
  });

  await t("confusables.json đúng cú pháp nhưng sai kiểu → vẫn nạp được", async () => {
    const r = await runDriver({ LOOKUP_CONFUSABLES_PATH: shapeFile });
    assert.strictEqual(r.code, 0, r.err);
    assert.strictEqual(JSON.parse(r.out).groups, 0);
  });

  await t("thiếu file confusables → server vẫn khởi động bình thường", async () => {
    const r = await runDriver({ LOOKUP_CONFUSABLES_PATH: path.join(TMP, "khong-ton-tai.json") });
    assert.strictEqual(r.code, 0, r.err);
    assert.strictEqual(JSON.parse(r.out).groups, 0);
  });

  await t("file thật được nạp đủ 18 nhóm từ dễ nhầm", async () => {
    const r = await runDriver({});
    assert.strictEqual(r.code, 0, r.err);
    const out = JSON.parse(r.out);
    assert.strictEqual(out.groups, 18, `mong 18 nhóm, nhận ${out.groups}`);
    assert.strictEqual(out.warned, "");
  });

  /* ---------- khoá cache: cùng nội dung → cùng bản ghi ---------- */

  await t("cùng nội dung cho ra cùng hash, khác tầng thì khác hash", async () => {
    const text = w("hash");
    const a = core.contentHash({ layer: 1, text, src: "auto", dst: "vi" });
    const b = core.contentHash({ layer: 1, text, src: "auto", dst: "vi" });
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.strictEqual(a, b, "cùng nội dung → cùng hash để dùng lại 0 token");
    assert.notStrictEqual(a, core.contentHash({ layer: 2, text, src: "auto", dst: "vi" }), "tầng 1 và tầng 2 không được trùng hash");
    const r = await db.query(`SELECT count(*)::int AS n FROM lookup_cache WHERE content_hash = $1`, [a]);
    assert.strictEqual(r.rows[0].n, 0, "hash của dữ liệu thử không được có sẵn trong cache");
  });

  await finish();
})().catch(async (err) => {
  console.error(err);
  fail++;
  await finish(true);
});

async function finish(force) {
  try {
    if (wordIds.length) {
      await db.query(`DELETE FROM saved_words WHERE id = ANY($1::bigint[])`, [wordIds]);
    }
    const left = await db.query(`SELECT id FROM saved_words WHERE text_norm LIKE $1`, [TAG + "%"]);
    if (left.rowCount) {
      await db.query(`DELETE FROM saved_words WHERE id = ANY($1::bigint[])`, [left.rows.map((r) => r.id)]);
    }
    for (const id of userIds) {
      await db.query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
      await db.query(`DELETE FROM player_progress WHERE user_id = $1`, [id]);
      await db.query(`DELETE FROM saved_words WHERE user_id = $1`, [id]);
      /* các bài kiểm tiền để lại dấu trong ví chung — dọn sạch để DB phát triển không tích rác */
      for (const t of ["town_ledger", "xu_ledger", "xu_spend", "xu_rounds", "pet_state", "town_state"]) {
        await db.query(`DELETE FROM ${t} WHERE user_id = $1`, [id]).catch(() => {});
      }
      await db.query(`DELETE FROM users WHERE id = $1`, [id]);
    }
  } catch (err) {
    console.error("[dọn dẹp]", err.message);
  }
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (err) {
    /* để lại thư mục tạm cũng không sao */
  }
  if (server) await new Promise((r) => server.close(r)).catch(() => {});
  await db.close().catch(() => {});
  console.log(`\n[test-lookup-pg] ${pass} bài, ${fail} lỗi`);
  if (force || fail) process.exit(1);
}
