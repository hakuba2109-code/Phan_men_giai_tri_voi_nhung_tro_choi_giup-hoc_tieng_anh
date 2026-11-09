"use strict";

/* Mã xác thực chứng chỉ: HMAC-SHA256 trên nội dung quan trọng, rút gọn thành 12 ký tự dễ đọc.
   Chỉ SERVER giữ CERT_SECRET -> sửa tên/điểm/ngày trên ảnh chứng chỉ thì mã không còn khớp bản ghi. */
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // bỏ I L O U 0 1 cho khỏi nhầm khi đọc

function secret() {
  const s = process.env.CERT_SECRET || "";
  if (s.length < 24) {
    const e = new Error("Chưa đặt CERT_SECRET (>= 24 ký tự) trong .env nên chưa cấp được chứng chỉ có xác thực.");
    e.status = 503;
    throw e;
  }
  return s;
}

/* fields: { runId, userId, fileTitle, holderName, total, firstTry, assisted, issuedAt(ISO) } */
function makeCode(fields) {
  const body = [fields.runId, fields.userId, fields.fileTitle, fields.holderName, fields.total,
    fields.firstTry, fields.assisted, fields.issuedAt].join("|");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest();
  let out = "";
  for (let i = 0; i < 12; i++) out += ALPHABET[mac[i] % ALPHABET.length];
  return `TC-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

/* So khớp thời gian không đổi để không lộ mã đúng qua độ trễ. */
function sameCode(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const CODE_RE = /^TC-[A-HJKMNP-TV-Z2-9]{4}-[A-HJKMNP-TV-Z2-9]{4}-[A-HJKMNP-TV-Z2-9]{4}$/;
const normalizeCode = (s) => String(s || "").trim().toUpperCase();

module.exports = { makeCode, sameCode, normalizeCode, CODE_RE };
