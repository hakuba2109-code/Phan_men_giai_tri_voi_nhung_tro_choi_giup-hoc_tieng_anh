"use strict";
/* Kiểm trang giới thiệu (landing) ở "/" và việc game chuyển sang "/choi".
   Không cần CSDL: chỉ đọc HTML server trả về, không gọi API.
   Chạy: node scripts/test-landing.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const app = require("../src/server");

let pass = 0;
let fail = 0;
const t = (name, fn) =>
  fn().then(
    () => {
      pass++;
      console.log("  ✔", name);
    },
    (e) => {
      fail++;
      console.log("  ✘", name, "\n      ", String(e.message).split("\n")[0]);
    }
  );

const has = (body, ...needles) => {
  for (const n of needles) assert.ok(body.includes(n), "thiếu: " + n);
};
const missing = (body, ...needles) => {
  for (const n of needles) assert.ok(!body.includes(n), "phải không có: " + n);
};

let base = "";
let server = null;

async function get(url) {
  /* Connection: close để server không giữ socket, đóng listener xong là thoát sạch */
  const r = await fetch(base + url, { headers: { Connection: "close" } });
  return { status: r.status, type: r.headers.get("content-type") || "", body: await r.text() };
}

async function raw(url, headers) {
  /* redirect: "manual" để xem chính xác mã 302, không tự nhảy theo */
  const r = await fetch(base + url, {
    headers: Object.assign({ Connection: "close" }, headers || {}),
    redirect: "manual",
  });
  return { status: r.status, location: r.headers.get("location") || "", body: await r.text() };
}

(async function main() {
  await new Promise((res) => {
    server = app.listen(0, "127.0.0.1", res);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  let landing = null;
  let game = null;

  await t("GET / trả về trang giới thiệu (không còn là game)", async () => {
    landing = await get("/");
    assert.strictEqual(landing.status, 200);
    assert.ok(landing.type.includes("text/html"), landing.type);
    has(
      landing.body,
      "Master the TOEIC",
      "Everything you need to ace the TOEIC",
      "Start Practicing",
      'lang="en"',
      'name="viewport"'
    );
    /* landing la trang marketing — khong phai cua game */
    missing(landing.body, 'id="tab-play"', "function goAuth", "window.__SEED__");
  });

  await t("GET /choi la game, /game va /toeic-game.html van con la alias", async () => {
    game = await get("/choi");
    assert.strictEqual(game.status, 200);
    has(game.body, 'id="tab-play"', "TOEIC <b>Practice</b>", "window.__SEED__");
    for (const alias of ["/game", "/toeic-game.html"]) {
      const a = await get(alias);
      assert.strictEqual(a.status, 200, alias + " phải còn phục vụ được");
      has(a.body, 'id="tab-play"');
    }
  });

  await t("landing nối được vào game và trang đăng nhập", async () => {
    has(landing.body, 'href="/choi"', 'href="/dang-nhap?den=%2Fchoi"');
    /* tat ca nut CTA deu dan ve /choi, khong co link "#" chet */
    assert.ok(!/href="#"/.test(landing.body), "co link # trong");
    const anchors = [...landing.body.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    for (const id of anchors)
      assert.ok(landing.body.includes('id="' + id + '"'), "neo #" + id + " khong co dich");
  });

  await t("landing tieng Anh theo mockup, khong nhut tinh nang gia", async () => {
    has(landing.body, "Practice Tests", "Vocabulary Builder", "Listening Practice");
    missing(landing.body, "Sign up with", "Log in with", "Continue with", "Google", "Apple");
    assert.ok(!/Terms of|Privacy Policy/.test(landing.body), "khong co dieu khoan/privacy gia");
  });

  await t("landing khong tai gi tu ngoai va khong lo bi mat", async () => {
    missing(landing.body, "CERT_SECRET", "DATABASE_URL", "GEMINI_API_KEY", "AI_MODEL");
    const remote = [...landing.body.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
    assert.deepStrictEqual(remote, [], "phai khong co asset ngoai: " + remote.join(" "));
    assert.ok(!landing.body.includes("crossorigin"), "khong can CORS");
    /* minh hoa phai NAM TRONG FILE: SVG noi hoac anh nhúng data:image (04/11 thay SVG bang anh JPEG noi) */
    assert.ok(
      landing.body.includes("<svg") || /src="data:image\/(jpeg|png|webp);base64,/.test(landing.body),
      "phai co minh hoa noi (SVG hoac data:image)"
    );
  });

  await t("landing chi dung textContent, khong nhung HTML tu bien", async () => {
    missing(landing.body, "innerHTML", "insertAdjacentHTML", "document.write");
    has(landing.body, 'getElementById("statCount")', "toLocaleString");
  });

  await t("ban static public/landing.html duoc phuc vu dung va khong con placeholder", async () => {
    const f = path.join(ROOT, "public", "landing.html");
    assert.ok(fs.existsSync(f), "phai co public/landing.html");
    const src = fs.readFileSync(f, "utf8");
    assert.strictEqual(landing.body, src, "GET / phai tra dung noi dung public/landing.html");
    missing(src, "/*__");
  });

  await t("GET / khong dang nhap (hoac cookie loi) van tra ve landing, khong redirect", async () => {
    /* Cookie khong hop le (ngan hon 129 ky tu hop le) -> userFromRequest tra ve null, khong cham CSDL */
    const r = await raw("/", { Cookie: "toeic_session=bad" });
    assert.strictEqual(r.status, 200, "khach/phien loi phai thay landing, khong phai 302");
    assert.strictEqual(r.location, "", "khong duoc redirect khach");
    has(r.body, "Master the TOEIC");
  });

  await t("route / doi user da dang nhap vao /choi (kiem ma nguon server.js)", async () => {
    const src = fs.readFileSync(path.join(ROOT, "src", "server.js"), "utf8");
    const block = src.slice(src.indexOf('app.get("/",'), src.indexOf('app.get("/",') + 600);
    assert.ok(block.length > 0, "phai co route /");
    assert.ok(block.includes("auth.userFromRequest(req)"), "/ phai kiem tra phien dang nhap");
    assert.ok(block.includes('res.redirect("/choi")'), "/ phai ve /choi khi da dang nhap");
  });

  await t("dang xuat trong game va trang tai khoan deu ve trang gioi thieu /", async () => {
    const game = fs.readFileSync(path.join(ROOT, "public", "toeic-game.html"), "utf8");
    assert.ok(game.includes('location.href = "/"'), "nut dang xuat trong game phai ve /");
    const auth = fs.readFileSync(path.join(ROOT, "public", "auth.html"), "utf8");
    assert.ok(auth.includes('location.href = "/"'), "dang xuat o trang tai khoan phai ve /");
  });

  console.log(`\n[test-landing] ${pass} bài, ${fail} lỗi`);
  await new Promise((r) => server.close(r)).catch(() => {});
  await require("../src/db").close().catch(() => {});
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
