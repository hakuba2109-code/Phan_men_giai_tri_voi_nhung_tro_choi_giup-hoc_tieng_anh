"use strict";
/* Kiểm thử tích hợp Mê cung kho báu trên HTTP thật + PostgreSQL (không gọi AI, 0 token).
   Tự dựng dữ liệu thử và DỌN SẠCH sau khi chạy.   node scripts/test-dungeon-api.js */
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = require("../src/db");
const Core = require("../src/dungeon-core");
const Rules = require("../src/dungeon-rules");
const Cert = require("../src/certificate");
const auth = require("../src/auth");
const dungeon = require("../src/dungeon");
const app = require("../src/server");

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

const TAG = "tdapi" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
const PREFIX = TAG + "-";
const fileIds = [];
const runIds = [];
const userIds = [];
let server = null;
let base = "";
let topic = "Thì";

async function api(url, opts) {
  const o = opts || {};
  const headers = Object.assign({}, o.headers || {});
  if (o.cookie) headers.cookie = o.cookie;
  if (o.body) headers["content-type"] = "application/json";
  const res = await fetch(base + url, {
    method: o.method || "GET",
    headers,
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch (err) { /* trang HTML */ }
  return { status: res.status, data, cookie: cookieOf(res) };
}

function cookieOf(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const one = list.map((c) => c.split(";")[0]).find((c) => c.startsWith("toeic_session="));
  return one || null;
}

async function makeDeck(ownerId, n, label) {
  const file = await db.query(
    `INSERT INTO source_files (filename, source, content, sha256, size_bytes, question_count, owner_id)
     VALUES ($1, 'import', $2, $3, $4, $5, $6) RETURNING id`,
    [`__test-dungeon-${TAG}-${label}.docx`, Buffer.from("dữ liệu thử"), crypto.randomBytes(32).toString("hex"), 12, n, ownerId]
  );
  const fileId = file.rows[0].id;
  fileIds.push(fileId);
  for (let i = 1; i <= n; i++) {
    const id = `${PREFIX}${label}-${i}`;
    await db.query(
      `INSERT INTO questions (id, topic, question, options, answer_index, note, source, number, file_id, qtype, status)
       VALUES ($1, $2, $3, $4, $5, '', 'import', $6, $7, 'mcq', 'ok')`,
      [id, topic, `Câu thử ${label} số ${i}: chọn đáp án đúng.`, ["alpha", "beta", "gamma", "delta"].map((x) => `${x} ${label} ${i}`), (i - 1) % 4, i, fileId]
    );
  }
  return fileId;
}

async function answersOf(ids) {
  const r = await db.query(`SELECT id, answer_index FROM questions WHERE id = ANY($1::text[])`, [ids]);
  return new Map(r.rows.map((x) => [x.id, x.answer_index]));
}

async function register(label) {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { email: `${TAG}-${label}@example.com`, password: "matkhau123", nickname: "Mê cung thử" }
  });
  assert.strictEqual(res.status, 200, `đăng ký ${label}: ${JSON.stringify(res.data)}`);
  userIds.push(res.data.user.id);
  return { cookie: res.cookie, userId: res.data.user.id };
}

function noAnswers(payload) {
  const s = JSON.stringify(payload);
  assert.ok(!s.includes("answer_index"), "payload lộ answer_index");
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const k of Object.keys(o)) {
      assert.ok(!["a", "answer", "answer_index"].includes(k), "payload lộ khoá " + k);
      walk(o[k]);
    }
  };
  walk(payload);
}

(async function main() {
  await db.applySchema();
  const tp = await db.query(`SELECT name FROM topics ORDER BY position, name LIMIT 1`);
  if (tp.rows.length) topic = tp.rows[0].name;

  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;

  const deckA = await makeDeck(0, 24, "A");
  const deckSmall = await makeDeck(0, 5, "S");
  const deckD = await makeDeck(0, 12, "D");
  const deckC = await makeDeck(0, 12, "C");
  const answers = await answersOf(
    (await db.query(`SELECT id FROM questions WHERE id LIKE $1`, [PREFIX + "%"])).rows.map((r) => r.id)
  );

  const A = await register("a");
  const B = await register("b");
  // deckA/deckSmall/deckD/deckC thuộc tài khoản A
  await db.query(`UPDATE source_files SET owner_id = $1 WHERE id = ANY($2::int[])`, [A.userId, [deckA, deckSmall, deckD, deckC]]);

  const fight = (cookie, runId, qid, choice, extra) =>
    api("/api/dungeon/fight", { method: "POST", cookie, body: Object.assign({ runId, qid, choice }, extra || {}) });

  let start = null;
  let run = null;
  let seed = 0;
  let cert = null;
  let certCode = "";

  await t("1. start bộ 5 câu -> 400 'cần ít nhất 12 câu'", async () => {
    const res = await api("/api/dungeon/start", { method: "POST", cookie: A.cookie, body: { fileId: deckSmall } });
    assert.strictEqual(res.status, 400, JSON.stringify(res.data));
    assert.ok(/ít nhất 12/.test(res.data.error), res.data.error);
  });

  await t("2. start hai lần liên tiếp -> cùng một ván, seed giữ nguyên", async () => {
    start = await api("/api/dungeon/start", { method: "POST", cookie: A.cookie, body: { fileId: deckA } });
    assert.strictEqual(start.status, 200, JSON.stringify(start.data));
    runIds.push(start.data.run.id);
    run = start.data.run;
    seed = start.data.seed;
    const again = await api("/api/dungeon/start", { method: "POST", cookie: A.cookie, body: { fileId: deckA } });
    assert.strictEqual(again.status, 200);
    assert.strictEqual(again.data.run.id, start.data.run.id);
    assert.strictEqual(again.data.seed, seed);
  });

  await t("3. start/descend không gửi đáp án xuống trình duyệt", async () => {
    assert.ok(Array.isArray(start.data.monsters) && start.data.monsters.length > 0);
    noAnswers(start.data);
    const desc = await api("/api/dungeon/descend", { method: "POST", cookie: A.cookie, body: { runId: run.id } });
    assert.strictEqual(desc.status, 409);
    const st = await api(`/api/dungeon/status?file=${deckA}`, { cookie: A.cookie });
    noAnswers(st.data);
  });

  const floorOne = start.data.monsters;
  const boss = floorOne.find((m) => m.boss).qid;
  const qCorrect = floorOne.find((m) => !m.boss && m.qid !== boss).qid;
  const qWrong = floorOne.filter((m) => !m.boss && m.qid !== qCorrect && m.qid !== boss)[0].qid;
  const qAssist = floorOne.filter((m) => !m.boss && ![qCorrect, qWrong, boss].includes(m.qid))[0].qid;
  const qRace = floorOne.filter((m) => !m.boss && ![qCorrect, qWrong, qAssist, boss].includes(m.qid))[0].qid;
  const qBad = floorOne.filter((m) => !m.boss && ![qCorrect, qWrong, qAssist, qRace, boss].includes(m.qid))[0].qid;

  await t("4. fight đúng ngay -> exp 10, attempts +1 mode dungeon, wrong_answers bị xóa; trùm 20", async () => {
    await db.query(
      `INSERT INTO wrong_answers (user_id, question_id, times_wrong, last_wrong_at) VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, question_id) DO UPDATE SET times_wrong = wrong_answers.times_wrong + 1`,
      [A.userId, qCorrect]
    );
    const before = await db.query(`SELECT count(*)::int AS c FROM attempts WHERE user_id = $1 AND question_id = $2 AND mode = 'dungeon'`, [A.userId, qCorrect]);
    const res = await fight(A.cookie, run.id, qCorrect, answers.get(qCorrect));
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    assert.strictEqual(res.data.exp, 10);
    assert.ok(res.data.run.defeated.includes(qCorrect));
    const after = await db.query(`SELECT count(*)::int AS c FROM attempts WHERE user_id = $1 AND question_id = $2 AND mode = 'dungeon'`, [A.userId, qCorrect]);
    assert.strictEqual(after.rows[0].c, before.rows[0].c + 1);
    const wrong = await db.query(`SELECT count(*)::int AS c FROM wrong_answers WHERE user_id = $1 AND question_id = $2`, [A.userId, qCorrect]);
    assert.strictEqual(wrong.rows[0].c, 0);
    run = res.data.run;

    const b = await fight(A.cookie, run.id, boss, answers.get(boss));
    assert.strictEqual(b.status, 200);
    assert.strictEqual(b.data.exp, 20);
    run = b.data.run;
  });

  await t("5. fight sai -> mất 1 tim, trả answerIndex, wrong_answers +1, quái sống", async () => {
    const wrongChoice = (answers.get(qWrong) + 1) % 4;
    const res = await fight(A.cookie, run.id, qWrong, wrongChoice);
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    assert.strictEqual(res.data.correct, false);
    assert.strictEqual(res.data.answerIndex, answers.get(qWrong));
    assert.strictEqual(res.data.run.hearts, run.hearts - 1);
    assert.ok(!res.data.run.defeated.includes(qWrong));
    const wrong = await db.query(`SELECT times_wrong FROM wrong_answers WHERE user_id = $1 AND question_id = $2`, [A.userId, qWrong]);
    assert.strictEqual(wrong.rows[0].times_wrong, 1);
    run = res.data.run;
  });

  await t("6. sai lần thứ 3 cùng câu -> Sách giải: quái chết, assisted, exp 0", async () => {
    const wrongChoice = (answers.get(qAssist) + 2) % 4;
    const r1 = await fight(A.cookie, run.id, qAssist, wrongChoice);
    assert.strictEqual(r1.status, 200);
    run = r1.data.run;
    const r2 = await fight(A.cookie, run.id, qAssist, wrongChoice);
    assert.strictEqual(r2.status, 200);
    run = r2.data.run;
    const r3 = await fight(A.cookie, run.id, qAssist, wrongChoice);
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.data.exp, 0);
    assert.ok(r3.data.events.some((e) => e.type === "assisted"));
    assert.ok(r3.data.run.defeated.includes(qAssist) && r3.data.run.assisted.includes(qAssist));
    run = r3.data.run;
    run.__knockedOut = r2.data.events.some((e) => e.type === "knockedOut");
    run.__deaths = r2.data.run.deaths;
    run.__hearts = r2.data.run.hearts;
  });

  await t("7. mất hết tim -> knockedOut, tim về 3, deaths = 1, quái đã hạ vẫn chết", async () => {
    assert.ok(run.__knockedOut, "thiếu sự kiện knockedOut");
    assert.strictEqual(run.__deaths, 1);
    assert.strictEqual(run.__hearts, Core.CONFIG.hearts);
    assert.ok(run.defeated.includes(qCorrect));
  });

  await t("8. hai fight song song cùng quái -> chỉ một thành công, attempts +1", async () => {
    const before = await db.query(`SELECT count(*)::int AS c FROM attempts WHERE user_id = $1 AND question_id = $2`, [A.userId, qRace]);
    const [x, y] = await Promise.all([
      fight(A.cookie, run.id, qRace, answers.get(qRace)),
      fight(A.cookie, run.id, qRace, answers.get(qRace))
    ]);
    const statuses = [x.status, y.status].sort((a, b) => a - b);
    assert.deepStrictEqual(statuses, [200, 409], JSON.stringify([x, y]));
    const after = await db.query(`SELECT count(*)::int AS c FROM attempts WHERE user_id = $1 AND question_id = $2`, [A.userId, qRace]);
    assert.strictEqual(after.rows[0].c, before.rows[0].c + 1);
    const ok = x.status === 200 ? x : y;
    run = ok.data.run;
  });

  await t("9. quái tầng khác / quái đã chết / choice 7 -> 409 / 409 / 400", async () => {
    const other = Rules.planFloors(seed, run.questionIds)[1][0];
    const r1 = await fight(A.cookie, run.id, other, 0);
    assert.strictEqual(r1.status, 409);
    const r2 = await fight(A.cookie, run.id, qCorrect, 0);
    assert.strictEqual(r2.status, 409);
    const r3 = await fight(A.cookie, run.id, qBad, 7);
    assert.strictEqual(r3.status, 400);
  });

  await t("10. rương mở một lần, thưởng khớp chestLoot; sai tầng -> 409", async () => {
    const first = await api("/api/dungeon/chest", { method: "POST", cookie: A.cookie, body: { runId: run.id, floorNo: 1, idx: 0 } });
    assert.strictEqual(first.status, 200, JSON.stringify(first.data));
    assert.deepStrictEqual(first.data.loot, Core.chestLoot(seed, 1, 0));
    run = first.data.run;
    const second = await api("/api/dungeon/chest", { method: "POST", cookie: A.cookie, body: { runId: run.id, floorNo: 1, idx: 0 } });
    assert.strictEqual(second.status, 409);
    const wrongFloor = await api("/api/dungeon/chest", { method: "POST", cookie: A.cookie, body: { runId: run.id, floorNo: 2, idx: 0 } });
    assert.strictEqual(wrongFloor.status, 409);
  });

  await t("11. descend khi còn quái -> 409", async () => {
    const res = await api("/api/dungeon/descend", { method: "POST", cookie: A.cookie, body: { runId: run.id } });
    assert.strictEqual(res.status, 409);
  });

  await t("12. finish khi chưa hạ hết -> 409", async () => {
    const res = await api("/api/dungeon/finish", { method: "POST", cookie: A.cookie, body: { runId: run.id, holderName: "Nhu San" } });
    assert.strictEqual(res.status, 409);
  });

  await t("13. hạ hết -> finish cấp chứng chỉ hợp lệ, ván completed, EXP thưởng đúng huy chương", async () => {
    const floors = Rules.floorsOf(run);
    for (let i = 0; i < floors.length; i++) {
      for (const qid of floors[i]) {
        if (run.defeated.includes(qid)) continue;
        const res = await fight(A.cookie, run.id, qid, answers.get(qid));
        assert.strictEqual(res.status, 200, qid + " " + JSON.stringify(res.data));
        run = res.data.run;
      }
      if (i < floors.length - 1) {
        const d = await api("/api/dungeon/descend", { method: "POST", cookie: A.cookie, body: { runId: run.id } });
        assert.strictEqual(d.status, 200, JSON.stringify(d.data));
        run = d.data.run;
        assert.ok(d.data.monsters.length > 0);
      }
    }
    assert.strictEqual(run.defeated.length, run.questionIds.length);
    const res = await api("/api/dungeon/finish", { method: "POST", cookie: A.cookie, body: { runId: run.id, holderName: "Nhu San" } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.data));
    cert = res.data.certificate;
    certCode = cert.code;
    assert.ok(Cert.CODE_RE.test(certCode), certCode);
    assert.strictEqual(res.data.expBonus, { gold: 100, silver: 60, bronze: 30 }[res.data.summary.medal]);
    const row = await db.query(`SELECT status FROM dungeon_runs WHERE id = $1`, [run.id]);
    assert.strictEqual(row.rows[0].status, "completed");
    const mine = await api("/api/certificates", { cookie: A.cookie });
    assert.strictEqual(mine.status, 200);
    assert.ok(mine.data.items.some((c) => c.code === certCode));
  });

  await t("14. verify công khai hợp lệ, không lộ user_id/email; mã lạ -> 404", async () => {
    dungeon.resetVerifyLimit();
    const ok = await api("/api/certificates/verify/" + certCode);
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.data));
    assert.strictEqual(ok.data.valid, true);
    assert.ok(!("user_id" in ok.data) && !("email" in ok.data));
    const bad = await api("/api/certificates/verify/TC-AAAA-AAAA-AAAA");
    assert.strictEqual(bad.status, 404);
  });

  await t("15. sửa thẳng holder_name trong CSDL -> verify không còn hợp lệ", async () => {
    await db.query(`UPDATE certificates SET holder_name = 'Nhu Sang' WHERE code = $1`, [certCode]);
    const res = await api("/api/certificates/verify/" + certCode);
    assert.strictEqual(res.status, 404);
    await db.query(`UPDATE certificates SET holder_name = 'Nhu San' WHERE code = $1`, [certCode]);
    const back = await api("/api/certificates/verify/" + certCode);
    assert.strictEqual(back.status, 200);
  });

  await t("16. finish lần hai -> 409; chơi lại chặng đã xong -> trả chứng chỉ cũ", async () => {
    const again = await api("/api/dungeon/finish", { method: "POST", cookie: A.cookie, body: { runId: run.id, holderName: "Nhu San" } });
    assert.strictEqual(again.status, 409);
    const replay = await api("/api/dungeon/start", { method: "POST", cookie: A.cookie, body: { fileId: deckA } });
    assert.strictEqual(replay.status, 409);
    assert.strictEqual(replay.data.certificate.code, certCode);
  });

  await t("17. xóa bộ đề: ván dở biến mất, chứng chỉ vẫn còn và verify đúng", async () => {
    const runD = await api("/api/dungeon/start", { method: "POST", cookie: A.cookie, body: { fileId: deckD } });
    assert.strictEqual(runD.status, 200, JSON.stringify(runD.data));
    runIds.push(runD.data.run.id);
    const delD = await api(`/api/files/${deckD}`, { method: "DELETE", cookie: A.cookie });
    assert.strictEqual(delD.status, 200, JSON.stringify(delD.data));
    const gone = await db.query(`SELECT count(*)::int AS c FROM dungeon_runs WHERE id = $1`, [runD.data.run.id]);
    assert.strictEqual(gone.rows[0].c, 0);

    const delA = await api(`/api/files/${deckA}`, { method: "DELETE", cookie: A.cookie });
    assert.strictEqual(delA.status, 200, JSON.stringify(delA.data));
    const v = await api("/api/certificates/verify/" + certCode);
    assert.strictEqual(v.status, 200, JSON.stringify(v.data));
    assert.strictEqual(v.data.fileTitle.includes("__test-dungeon-"), true);
    const page = await api("/certificate/" + certCode);
    assert.strictEqual(page.status, 200);
  });

  await t("18. tài khoản B gọi ván của A -> 404", async () => {
    const res = await fight(B.cookie, run.id, qBad, 0);
    assert.strictEqual(res.status, 404);
    const st = await api("/api/dungeon/status?file=" + deckC, { cookie: B.cookie });
    assert.strictEqual(st.status, 404);
  });

  let guestCode = "";
  await t("19. Khách chơi rồi chuyển ván + chứng chỉ sang tài khoản mới", async () => {
    await db.query(`UPDATE source_files SET owner_id = 0 WHERE id = $1`, [deckC]);
    const gStart = await api("/api/dungeon/start", { method: "POST", body: { fileId: deckC } });
    assert.strictEqual(gStart.status, 200, JSON.stringify(gStart.data));
    runIds.push(gStart.data.run.id);
    let grun = gStart.data.run;
    const floors = Rules.floorsOf(grun);
    for (const qid of floors[0]) {
      const res = await fight(null, grun.id, qid, answers.get(qid));
      assert.strictEqual(res.status, 200, JSON.stringify(res.data));
      grun = res.data.run;
    }
    const gFin = await api("/api/dungeon/finish", { method: "POST", body: { runId: grun.id, holderName: "Khách Chuyển" } });
    assert.strictEqual(gFin.status, 200, JSON.stringify(gFin.data));
    guestCode = gFin.data.certificate.code;

    const C = await register("c");
    const guestRuns = await db.query(`SELECT id FROM dungeon_runs WHERE user_id = 0`);
    assert.strictEqual(guestRuns.rows.length, 1, "có ván Khách khác trong CSDL thử — dừng để không chuyển nhầm dữ liệu thật");
    const moved = await auth.adoptGuestDungeon(C.userId);
    assert.ok(moved.runs >= 1 && moved.certificates >= 1, JSON.stringify(moved));
    const r = await db.query(`SELECT user_id FROM dungeon_runs WHERE id = $1`, [grun.id]);
    assert.strictEqual(r.rows[0].user_id, C.userId);
    const c = await db.query(`SELECT user_id, code FROM certificates WHERE run_id = $1`, [grun.id]);
    assert.strictEqual(c.rows[0].user_id, C.userId);
    assert.notStrictEqual(c.rows[0].code, guestCode);
    const v = await api("/api/certificates/verify/" + c.rows[0].code);
    assert.strictEqual(v.status, 200, JSON.stringify(v.data));
    assert.strictEqual(v.data.valid, true);
    guestCode = c.rows[0].code;
  });

  await t("20. verify 31 lần trong một phút -> lần thứ 31 trả 429", async () => {
    dungeon.resetVerifyLimit();
    for (let i = 0; i < 30; i++) {
      const ok = await api("/api/certificates/verify/" + guestCode);
      assert.strictEqual(ok.status, 200, "lần " + (i + 1));
    }
    const last = await api("/api/certificates/verify/" + guestCode);
    assert.strictEqual(last.status, 429);
    dungeon.resetVerifyLimit();
  });

  await t("21. thiếu CERT_SECRET -> finish 503, ván giữ nguyên tiến độ", async () => {
    await db.query(`UPDATE source_files SET owner_id = $1 WHERE id = $2`, [A.userId, deckC]);
    const s = await api("/api/dungeon/start", { method: "POST", cookie: A.cookie, body: { fileId: deckC } });
    assert.strictEqual(s.status, 200, JSON.stringify(s.data));
    runIds.push(s.data.run.id);
    let r21 = s.data.run;
    for (const qid of Rules.floorsOf(r21)[0]) {
      const res = await fight(A.cookie, r21.id, qid, answers.get(qid));
      assert.strictEqual(res.status, 200, JSON.stringify(res.data));
      r21 = res.data.run;
    }
    const saved = process.env.CERT_SECRET;
    process.env.CERT_SECRET = "";
    try {
      const res = await api("/api/dungeon/finish", { method: "POST", cookie: A.cookie, body: { runId: r21.id, holderName: "Nhu San" } });
      assert.strictEqual(res.status, 503, JSON.stringify(res.data));
    } finally {
      process.env.CERT_SECRET = saved;
    }
    const row = await db.query(`SELECT status, state FROM dungeon_runs WHERE id = $1`, [r21.id]);
    assert.strictEqual(row.rows[0].status, "active");
    assert.strictEqual(row.rows[0].state.defeated.length, row.rows[0].state.questionIds.length);
    const ok = await api("/api/dungeon/finish", { method: "POST", cookie: A.cookie, body: { runId: r21.id, holderName: "Nhu San" } });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.data));
  });

  await cleanup();
  console.log(`\n${pass} đạt, ${fail} lỗi`);
  process.exit(fail ? 1 : 0);
})().catch(async (err) => {
  console.error("Lỗi khi chạy kiểm thử:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});

async function cleanup() {
  try {
    if (runIds.length) {
      await db.query(`DELETE FROM certificates WHERE run_id = ANY($1::bigint[])`, [runIds]);
      await db.query(`DELETE FROM dungeon_fights WHERE run_id = ANY($1::bigint[])`, [runIds]);
      await db.query(`DELETE FROM dungeon_runs WHERE id = ANY($1::bigint[])`, [runIds]);
    }
    await db.query(`DELETE FROM attempts WHERE question_id LIKE $1`, [PREFIX + "%"]);
    await db.query(`DELETE FROM wrong_answers WHERE question_id LIKE $1`, [PREFIX + "%"]);
    await db.query(`DELETE FROM questions WHERE id LIKE $1`, [PREFIX + "%"]);
    for (const id of fileIds) await db.query(`DELETE FROM source_files WHERE id = $1`, [id]);
    for (const id of userIds) {
      await db.query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
      await db.query(`DELETE FROM player_progress WHERE user_id = $1`, [id]);
      await db.query(`DELETE FROM users WHERE id = $1`, [id]);
    }
  } catch (err) {
    console.error("[dọn dẹp]", err.message);
  }
  if (server) await new Promise((r) => server.close(r)).catch(() => {});
  await db.close().catch(() => {});
}
