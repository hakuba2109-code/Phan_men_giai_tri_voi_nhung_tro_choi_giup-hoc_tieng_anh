/* Đăng ký / đăng nhập: băm mật khẩu bằng scrypt (crypto có sẵn của Node),
   phiên là token ngẫu nhiên, CSDL chỉ lưu sha256 của token nên rò rỉ bảng sessions
   cũng không dùng cookie đi đăng nhập được. */
const crypto = require("crypto");
const db = require("./db");
const Cert = require("./certificate");
const xu = require("./xu");
const Town = require("./town");
const Sakura = require("./sakura");
const Island = require("./island");

const COOKIE = "toeic_session";
const SESSION_DAYS = 30;
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const MAX_NICKNAME = 30;

/* ---------- băm mật khẩu ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const want = Buffer.from(parts[2], "hex");
  if (!want.length) return false;
  const got = crypto.scryptSync(password, Buffer.from(parts[1], "hex"), want.length, { N: 16384, r: 8, p: 1 });
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/* ---------- cookie / token ---------- */
function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((pair) => {
    const i = pair.indexOf("=");
    if (i < 0) return;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

const tokenKey = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function cookieHeaders(token, maxAgeSeconds, secure) {
  const attrs = [`${COOKIE}=${token || ""}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

/* ---------- kiểm tra dữ liệu nhập ---------- */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeNickname(nickname, email) {
  const fallback = normalizeEmail(email).split("@")[0] || "Người chơi";
  const clean = String(nickname || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NICKNAME);
  return clean || fallback;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/* Chặn dò mật khẩu: 5 lần sai một email trong 15 phút thì tạm đóng */
const watchdog = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function checkLock(key) {
  const hit = watchdog.get(key);
  if (!hit) return 0;
  if (Date.now() > hit.until) {
    watchdog.delete(key);
    return 0;
  }
  return hit.count >= MAX_FAILS ? Math.ceil((hit.until - Date.now()) / 60000) : 0;
}

function noteFail(key) {
  const hit = watchdog.get(key) || { count: 0, until: 0 };
  hit.count += 1;
  hit.until = Date.now() + LOCK_MS;
  if (hit.count >= MAX_FAILS) console.warn(`[auth] khóa tạm ${key} trong 15 phút vì sai mật khẩu ${hit.count} lần`);
  watchdog.set(key, hit);
}

const clearFails = (key) => watchdog.delete(key);

/* ---------- phiên ---------- */
async function createSession(userId) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [tokenKey(token), userId, expires]
  );
  return { token, expires };
}

async function userFromRequest(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.nickname, u.created_at, u.last_login_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [tokenKey(token)]
  );
  return rows[0] || null;
}

async function destroySession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) await db.query(`DELETE FROM sessions WHERE token = $1`, [tokenKey(token)]);
}

async function cleanExpiredSessions() {
  const { rowCount } = await db.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  return rowCount;
}

/* ---------- đăng ký ---------- */
async function register({ email, password, nickname }) {
  const mail = normalizeEmail(email);
  if (!EMAIL_RE.test(mail)) throw badRequest("Email chưa đúng dạng, ví dụ ban@ten.com");
  if (String(password || "").length < MIN_PASSWORD) {
    throw badRequest(`Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự`);
  }
  const name = normalizeNickname(nickname, mail);
  const hash = hashPassword(String(password));

  let userId;
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, nickname, last_login_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [mail, hash, name]
    );
    userId = rows[0].id;
  } catch (err) {
    if (err.code === "23505") {
      const e = new Error("Email này đã có tài khoản — bấm Đăng nhập để vào.");
      e.status = 409;
      throw e;
    }
    throw err;
  }
  clearFails(mail);
  const adopted = await startProgress(userId, name);
  const session = await createSession(userId);
  return { user: { id: userId, email: mail, nickname: name }, session, adopted };
}

/* Tạo hàng tiến độ cho tài khoản mới. Tài khoản ĐẦU TIÊN trên máy này được
   kế thừa (sao chép, không di chuyển) toàn bộ dữ liệu của khách user_id = 0. */
async function startProgress(userId, nickname) {
  await db.query(
    `INSERT INTO player_progress (id, user_id, nickname, exp, level, mastered)
     VALUES ($1::smallint, $1::int, $2, 0, 1, '{}'::text[]) ON CONFLICT (user_id) DO NOTHING`,
    [userId, nickname]
  );
  const howMany = await db.query(`SELECT count(*)::int AS c FROM users`);
  if (howMany.rows[0].c !== 1) return false;
  await adoptGuestDungeon(userId);
  const guest = await db.query(`SELECT exp, level, mastered FROM player_progress WHERE user_id = 0`);
  if (!guest.rows.length || guest.rows[0].exp <= 0) return false;
  const g = guest.rows[0];
  await db.query(
    `UPDATE player_progress SET exp = $2, level = $3, mastered = $4, updated_at = NOW()
     WHERE user_id = $1 AND exp = 0`,
    [userId, g.exp, g.level, g.mastered]
  );
  await db.query(
    `INSERT INTO wrong_answers (user_id, question_id, times_wrong, last_wrong_at)
     SELECT $1, question_id, times_wrong, last_wrong_at FROM wrong_answers WHERE user_id = 0
     ON CONFLICT (user_id, question_id) DO NOTHING`,
    [userId]
  );
  await adoptGuestWallet(userId);
  return true;
}

/* Ví xu + thú + cây + Quần đảo của Khách sang tài khoản mới, CÙNG giao dịch với phần sao chép `attempts`.
   attempts được SAO CHÉP (id mới, lớn hơn id của Khách) nên phải đẩy mốc đồng bộ lên cuối dãy,
   nếu không từng lượt ôn cũ sẽ được in xu thêm lần nữa. */
async function adoptGuestWallet(userId) {
  return db.withTransaction(async (client) => {
    await xu.syncLessons(client, 0); // gom hết lượt của Khách vào ví trước khi chuyển, để không mất phần lẻ
    await client.query(
      `INSERT INTO attempts (question_id, correct, mode, exp_gained, seconds, created_at, user_id)
       SELECT question_id, correct, mode, exp_gained, seconds, created_at, $1 FROM attempts WHERE user_id = 0`,
      [userId]
    );
    const moved = await Town.transferGuestData(client, 0, userId);
    await Sakura.transferGuestData(client, 0, userId);
    await Island.transferGuestData(client, 0, userId); // đảo + thú + kho + đồ trang trí (D2) — không mất tiến độ khi đăng ký
    if (!moved.moved) return moved;
    await client.query(
      `UPDATE town_state SET last_attempt_id = (SELECT coalesce(max(id), 0) FROM attempts WHERE user_id = $1) WHERE user_id = $1`,
      [userId]
    );
    return moved;
  });
}

/* Chuyển ván và chứng chỉ Mê cung của Khách (user_id = 0) sang tài khoản mới.
   Mã chứng chỉ ký cả user_id nên phải cấp lại mã cho khớp chủ mới; thiếu CERT_SECRET
   thì vẫn chuyển chủ nhưng mã cũ không còn xác thực (không chặn việc đăng ký). */
async function adoptGuestDungeon(userId) {
  const runs = await db.query(`UPDATE dungeon_runs SET user_id = $1, updated_at = NOW() WHERE user_id = 0`, [userId]);
  const certs = await db.query(`SELECT * FROM certificates WHERE user_id = 0`, []);
  for (const row of certs.rows) {
    let code = row.code;
    try {
      code = Cert.makeCode({
        runId: row.run_id,
        userId,
        fileTitle: row.file_title,
        holderName: row.holder_name,
        total: row.total,
        firstTry: row.first_try,
        assisted: row.assisted,
        issuedAt: new Date(row.issued_at).toISOString(),
      });
    } catch (err) {
      console.error("[auth] không cấp lại được mã chứng chỉ khi chuyển chủ:", err.message);
    }
    try {
      await db.query(`UPDATE certificates SET user_id = $1, code = $2 WHERE id = $3`, [userId, code, row.id]);
    } catch (err) {
      console.error("[auth] không chuyển được chứng chỉ:", err.message);
    }
  }
  return { runs: runs.rowCount, certificates: certs.rowCount };
}

/* ---------- đăng nhập ---------- */
async function login({ email, password }) {
  const mail = normalizeEmail(email);
  const locked = checkLock(mail);
  if (locked) {
    const e = new Error(`Sai mật khẩu quá ${MAX_FAILS} lần. Thử lại sau ${locked} phút.`);
    e.status = 429;
    throw e;
  }
  const { rows } = await db.query(`SELECT id, email, password_hash, nickname FROM users WHERE email = $1`, [mail]);
  const found = rows.length > 0 && verifyPassword(String(password || ""), rows[0].password_hash);
  if (!found) {
    noteFail(mail);
    const e = new Error("Email hoặc mật khẩu không đúng");
    e.status = 401;
    throw e;
  }
  clearFails(mail);
  const user = { id: rows[0].id, email: rows[0].email, nickname: rows[0].nickname };
  await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
  const session = await createSession(user.id);
  return { user, session };
}

async function logout(req) {
  await destroySession(req);
  return { ok: true };
}

module.exports = {
  COOKIE,
  MIN_PASSWORD,
  hashPassword,
  verifyPassword,
  parseCookies,
  cookieHeaders,
  register,
  login,
  logout,
  userFromRequest,
  cleanExpiredSessions,
  adoptGuestDungeon,
};
