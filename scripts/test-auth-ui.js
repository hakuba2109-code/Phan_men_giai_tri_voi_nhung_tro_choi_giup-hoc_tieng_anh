"use strict";
/* Kiểm trang đăng nhập / đăng ký riêng và đường nối trong game.
   Không cần CSDL: chỉ kiểm HTML trả về, không gọi API.
   Chạy: node scripts/test-auth-ui.js */
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

(async function main() {
  await new Promise((res) => {
    server = app.listen(0, "127.0.0.1", res);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  let login = null;
  let register = null;
  let game = null;

  /* lấy cả ba trang một lần để các kiểm tra sau đọc lại mà không cần server */
  await t("GET /dang-nhap trả về trang HTML đăng nhập", async () => {
    login = await get("/dang-nhap");
    assert.strictEqual(login.status, 200);
    assert.ok(login.type.includes("text/html"), login.type);
    has(login.body, 'var MODE = "login"', "Chào mừng trở lại", 'id="fEmail"', 'id="fPass"', "<form");
    missing(login.body, "/*__AUTH_MODE__*/");
  });

  await t("GET /dang-ky là cùng trang nhưng ở chế độ đăng ký", async () => {
    register = await get("/dang-ky");
    assert.strictEqual(register.status, 200);
    has(register.body, 'var MODE = "register"', "Tạo tài khoản", 'id="fName"', 'id="fPass2"');
    const only = (b) => b.replace(/var MODE = "[a-z]+"/, 'var MODE = "X"');
    assert.strictEqual(only(login.body), only(register.body), "hai trang chỉ được phép khác mỗi chế độ");
  });

  await t("mở /choi là game, đã đổi tên và không còn form đăng nhập cũ", async () => {
    game = await get("/choi");
    assert.strictEqual(game.status, 200);
    has(game.body, "TOEIC <b>Practice</b>", "👤 Đăng nhập", "/dang-nhap", "authPage");
    missing(game.body, 'id="acctEmail"', 'id="acctPassword2"', "TOEIC 500+");
  });

  await t("hai trang nối được nhau, nút về đưa ra trang giới thiệu", async () => {
    has(login.body, '"/dang-ky"', 'id="linkBack"', 'id="signedGo"');
    has(register.body, '"/dang-nhap"', 'id="linkBack"', 'id="signedGo"');
    has(login.body, "location.href = reg ?");
    /* "← Về trang giới thiệu" phải trỏ "/" chứ không vào thẳng ô luyện tập; hai đường còn lại
       (đăng nhập xong + "Vào ô luyện tập") vẫn theo ?den= nên vẫn về /choi. */
    has(login.body, 'href="/" id="linkBack"', "Về trang giới thiệu", 'el("linkBack").setAttribute("href", "/")');
    missing(login.body, 'href="/choi" id="linkBack"', "Về ô luyện tập</a>");
    has(login.body, 'el("signedGo").setAttribute("href", target())');
  });

  await t("tiếng Việt, không có nút Google/Apple, không link chết", async () => {
    for (const page of [login, register]) {
      has(page.body, 'lang="vi"', 'name="viewport"');
      missing(page.body, "continue with", "Sign up", "Forgot password", "Log in with");
      assert.ok(!/<a[^>]+href="#[^"]*"/.test(page.body), "có link # tự tham chiếu");
      assert.ok(!page.body.includes("Terms of"), "có điều khoản giả");
    }
  });

  await t("trang tài khoản không tải gì từ ngoài và không lộ bí mật", async () => {
    const both = login.body + register.body;
    missing(both, "CERT_SECRET", "DATABASE_URL", "GEMINI_API_KEY", "AI_MODEL");
    const remote = [...both.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
    assert.deepStrictEqual(remote, [], "phải không có asset ngoài: " + remote.join(" "));
    assert.ok(!both.includes("crossorigin"), "không cần CORS");
  });

  await t("chỉ dùng textContent khi vẽ dữ liệu, có autocomplete và label", async () => {
    missing(login.body, "innerHTML", "insertAdjacentHTML", "document.write");
    has(login.body, 'autocomplete="username"', 'autocomplete="current-password"', 'autocomplete="new-password"');
    assert.ok((login.body.match(/<label class="field/g) || []).length >= 3, "thiếu label");
    assert.ok(login.body.includes('aria-live="polite"'), "ô thông báo phải có aria-live");
    assert.ok(login.body.includes("aria-invalid"), "phải báo lỗi bằng aria-invalid");
  });

  await t("đường về chỉ nhận nội bộ, không mở URL bên ngoài", async () => {
    has(login.body, "?den=", "URLSearchParams");
    assert.ok(login.body.includes('d.charAt(0) === "/"'), "phải yêu cầu bắt đầu bằng /");
    assert.ok(login.body.includes('d.charAt(1) !== "/"'), "//host là redirect ra ngoài");
    has(game.body, "?den=", "encodeURIComponent(back)");
  });

  await t("game điều hướng sang trang đăng nhập khi chưa có tài khoản", async () => {
    has(game.body, "function goAuth", "location.href = authPage(mode)", 'if (!state.me) return goAuth("login")');
    assert.ok(game.body.includes('"/dang-nhap"'), "đường dẫn trang đăng nhập phải có thật");
  });

  await t("bản static public/auth.html tự mặc định là đăng nhập", async () => {
    const f = path.join(ROOT, "public", "auth.html");
    assert.ok(fs.existsSync(f), "phải có public/auth.html");
    const body = fs.readFileSync(f, "utf8");
    has(body, "/*__AUTH_MODE__*/", 'if (MODE !== "login" && MODE !== "register") MODE = "login"');
    const srcDir = fs.existsSync(path.join(ROOT, "html")) ? path.join(ROOT, "html") : path.join(ROOT, "public");
    const src = fs.readFileSync(path.join(srcDir, "auth.html"), "utf8");
    assert.strictEqual(body, src, "public/auth.html phải giống hệt bản nguồn");
  });

  await t("trang chứng chỉ dùng chung bảng màu và tên mới", async () => {
    const src = fs.readFileSync(path.join(ROOT, "src", "dungeon.js"), "utf8");
    has(src, "TOEIC Practice", "#2563eb", "--brand: #2563eb", 'class="bar"');
    assert.ok(src.includes("@media print"), "bản in vẫn phải còn");
    assert.ok(src.includes(".bar, .print, .back { display: none"), "thanh tên phải ẩn khi in");
  });

  /* KINH TẾ XU: bản game thật (không phải file nguồn) phải mang đủ cả hai chiều — báo ván chơi để nhận xu,
     và tiêu xu ở thị trấn. Kiểm trên trang /choi đã build để không sót bước ghép file.
     Từ X2, ván Săn vịt + trò kỹ năng đi qua /api/xu/round/start|finish (máy chủ cấp ván — sửa V5);
     đường cũ /api/xu/game chỉ còn Mê cung dùng (server tự qui đổi huy chương). */
  await t("ván săn vịt + trò kỹ năng xin máy chủ cấp, không tự bịa roundId", async () => {
    has(game.body, 'xuPost("/api/xu/round/start"', 'xuWhy("/api/xu/round/finish"', 'fetch("/api/xu"');
    has(game.body, "function xuOpen", "function xuClose", "function xuRoundEnd");
    has(game.body, 'xuOpen("duck")', 'xuOpen("skill", id)');
    has(game.body, 'xuClose(round, el("resSummary"))', 'xuClose(skRound, el("skResSummary"))');
    missing(game.body, "xuShowLine(");
  });

  await t("bảng kết quả hiện phần thưởng xu SẼ nhận và nói rõ lý do khi không được", async () => {
    /* Dòng "sẽ nhận được" viết trước khi máy chủ trả lời, rồi bị THAY bằng dòng thật;
       404/409 không còn im lặng — máy chủ đã giải thích bằng tiếng Việt thì màn phải in ra. */
    has(game.body, "function xuAsk", "function xuSettled", "function xuRoundMiss", "function xuWhy");
    has(game.body, 'xuAsk(el("resSummary"), round)', 'xuAsk(el("skResSummary"), skRound)');
    has(game.body, "Ván này được +", "Ván này chưa được thưởng xu", "res.body.error");
    /* Số xu hứa hẹn do máy chủ cấp (round.reward), không được viết tay 4/3 trong HTML. */
    missing(game.body, "Ván này được +4 xu", "Ván này được +3 xu");
    const xu = fs.readFileSync(path.join(ROOT, "src", "xu.js"), "utf8");
    has(xu, "reward: TownCore.gameReward(need.game, 0)");
  });

  await t("mọi bảng kết quả có dòng xu và đọc số từ /api/xu", async () => {
    has(game.body, 'xuTodayLine(el("resSummary"))', 'xuTodayLine(el("skResSummary"))');
    has(game.body, 'fetch("/api/xu"', "function xuTodayLoad", "function xuTodayRender", "XU_GROUPS");
    has(game.body, 'id="resSummary" aria-live="polite"', 'id="skResSummary" aria-live="polite"');
  });

  await t("tab 💾 CSDL & tiến độ cũng hiện số dư ví xu (cùng một GET /api/xu)", async () => {
    has(game.body, 'id="xuDataBalance"', 'id="xuDataToday"', 'id="xuDataNote"');
    has(game.body, "function xuDataRender", "function xuDataLoad", "xuDataLoad();");
    has(game.body, "xuTodayRender(j); // một lần đọc, vẽ cả hai tab");
    /* Số tiền phải đọc từ API, không được viết tay trong HTML. */
    missing(game.body, 'id="xuDataBalance">0 xu', 'id="xuDataBalance">60 xu');
  });

  await t("huy hiệu 🪙 ở màn chọn trò đọc CONFIG, không viết tay con số", async () => {
    has(game.body, "function xuHints", "function xuChip", "xuHints();");
    has(game.body, 'id="xuHintModes"', 'id="xuHintWords"', 'id="xuHintDeck"');
    has(game.body, "TCORE.CONFIG", "C.dailyCap");
    missing(game.body, "🪙 +4 xu/câu", "🪙 3 xu/câu");
  });

  await t("mê cung vẫn nhận xu theo huy chương qua đường cũ /api/xu/game", async () => {
    has(game.body, 'xuWhy("/api/xu/game"', "function xuRound", "onRound: xuRound");
    has(game.body, 'cb("maze",place)', "MEDAL_PLACE");
    /* Kho báu của mê cung cũng phải nói được "không có xu vì sao", không chỉ "+15 xu". */
    has(game.body, "Ván này chưa được thưởng xu: ");
  });

  await t("một trang 🌸 duy nhất: bản trùng tên có dấu đã rời public/", async () => {
    assert.ok(fs.existsSync(path.join(ROOT, "public", "dao-hoa-anh-dao.html")), "phải còn bản nối API");
    const trung = fs.readdirSync(path.join(ROOT, "public")).filter((f) => /anh.dao/i.test(f) && f.endsWith(".html"));
    assert.deepStrictEqual(trung, ["dao-hoa-anh-dao.html"], "public/ phải không còn bản trùng: " + trung.join(" "));
    const goc = await get("/" + encodeURIComponent("Đảo hoa anh đào.html"));
    assert.strictEqual(goc.status, 404, "bản trùng phải 404");
    const live = await get("/dao-hoa-anh-dao.html");
    assert.strictEqual(live.status, 200, "bản thật phải còn phục vụ được");
  });

  await t("thị trấn chỉ còn một ví xu trong bản build", async () => {
    has(game.body, 'data-r="chipXu"', "MỘT ví xu chung", "Cần " /* hộp thiếu xu khi xây */);
    missing(game.body, "Lấy vật liệu khu", "d.materials >=", "kiếm vật liệu");
  });

  await t("trang đảo anh đào đọc ví chung, chỉ giả lập khi chịu thiếu máy chủ", async () => {
    const f = fs.readFileSync(path.join(ROOT, "public", "dao-hoa-anh-dao.html"), "utf8");
    has(f, 'api("/api/sakura")', '"/api/sakura/care"', "LIVE=true", '$("sim").hidden=true');
    has(f, "ví chung");
  });

  /* DẪN HƯỚNG: 🏘️ Thị trấn + 🌸 anh đào + 🏝️ quần đảo gom vào MỘT mục 🌍 Thế giới trên hàng tab,
     bấm ra mới tách ba lối. Kiểm trên bản đã build (/choi) vì nguồn là template.html. */
  await t("hàng tab gom 🏘️ + 🌸 + 🏝️ vào một mục 🌍 Thế giới", async () => {
    const body = game.body;
    has(
      body,
      'id="btnWorld"',
      'aria-controls="popWorld"',
      'aria-haspopup="true"',
      'id="popWorld"',
      'data-world="town"',
      'href="dao-hoa-anh-dao.html"',
      'href="quan-dao-vo-tan-three.html"',
      'nav.tabs button[data-tab]',
    );
    /* hàng tab gọn: không còn sót nút Thị trấn riêng */
    assert.ok(!body.includes('data-tab="town"'), "Thị trấn phải nằm trong danh sách 🌍, không còn là tab rời");
    const nav = body.slice(body.indexOf('<nav class="tabs">'), body.indexOf("</nav>"));
    assert.strictEqual((nav.match(/<button/g) || []).length, 4, "hàng tab phải còn đúng 4 mục");
    assert.ok(nav.indexOf("btnWorld") > nav.indexOf('data-tab="play"'), "🌍 phải ngay sau 🎮 Chơi");
    /* danh sách đặt ở cấp body: để trong nav (overflow-x:auto) sẽ bị cắt */
    assert.ok(body.indexOf('id="popWorld"') > body.indexOf("</nav>"), "danh sách phải nằm ngoài <nav>");
    const pop = body.slice(body.indexOf('id="popWorld"'), body.indexOf("</div>", body.indexOf('id="popWorld"')));
    assert.strictEqual((pop.match(/target="_blank"/g) || []).length, 2, "hai trang riêng phải mở tab mới");
    assert.strictEqual((pop.match(/rel="noopener"/g) || []).length, 2, "hai trang riêng phải có rel=noopener");
    assert.ok(!pop.includes('href="/dao-hoa') && !pop.includes('href="/quan-dao'), "phải dùng href tương đối");
    /* mục 🏘️ trong danh sách đi qua show("town") — vẫn bị chặn khi đang có ván chơi */
    assert.ok(pop.includes('data-world="town"'), "phải có mục Thị trấn");
  });

  console.log(`\n[test-auth-ui] ${pass} bài, ${fail} lỗi`);
  await new Promise((r) => server.close(r)).catch(() => {});
  /* đóng pool CSDL mà server đã mở — để handle lại thì Node không tự thoát */
  await require("../src/db").close().catch(() => {});
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
