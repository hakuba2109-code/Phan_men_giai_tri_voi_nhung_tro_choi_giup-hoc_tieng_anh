# 🌸 Đảo hoa anh đào — nuôi cây khổng lồ bằng ví xu chung (kiếm từ bài học, trò chơi, file, quà)

> **Dành cho:** Qoder (hoặc lập trình viên) làm tiếp trên dự án `Tro_Choi`, như một tính năng **bổ sung, tùy chọn** cạnh 🐾 Thú ảo + Thị trấn.
> **Trạng thái (03/11/2026):** **ĐÃ NỐI THẬT**, không còn là bản thử. Backend chạy trên **PostgreSQL 16 thật**: lõi thuần 10/10, API tích hợp 19/19; cả bộ kiểm của dự án là `npm test` **258 bài / 0 lỗi**, phần ví xu và tích hợp `test:wallet` **65 bài**. Giao diện là trang **`public/dao-hoa-anh-dao.html`** — mở `http://localhost:3000/dao-hoa-anh-dao.html`, **từ 03/11 có ngay trên hàng tab của game**: `🎮 Chơi · 🏘️ Thị trấn · [🌸 Anh đào ↗ | 🏝️ Thú cưng ↗] · 📥 Nhập đề · 💾 CSDL` — hai lối **gom một nhóm**; dấu ↗ = mở trang riêng trong tab mới, **không** phải panel nhúng trong `toeic-game.html`); trang tự gọi `GET /api/sakura`; khi có máy chủ thì thẻ **Giả lập việc học tự ẩn**.
> **03/11:** cây **không còn ví riêng nữa**. Nó uống **chung một ví xu** với thị trấn, trò chơi và phần thưởng bài học — xem [README-kinh-te-xu.md](README-kinh-te-xu.md). Toàn bộ tiết mục cũ về `sakura_state.coins` và sổ cái bài học riêng đã được thay bằng số dư `town_state.xu` + `xu_ledger` / `xu_spend`.
> **Không thay đổi luật học:** xu chỉ là **hình ảnh thưởng**, không mở khóa câu hỏi, không ảnh hưởng điểm, thứ tự ôn hay lịch Leitner. Không có đường nào làm người chơi **mất** xu hay sinh trưởng ngoài lúc chủ động tưới/bón. **Cây không bao giờ héo.**

## 1. Ý tưởng
Một hòn đảo nổi 3D, giữa đảo là **cây hoa anh đào** lớn dần từ hạt giống thành cổ thụ khổng lồ phủ kín trời. Học để **kiếm xu 🪙**, dùng xu **tưới 💧 / bón 🌿** để cây sinh trưởng. Cây càng lớn càng nhiều cành, lá xanh dần chuyển hồng, rồi cánh hoa rơi.

```
  chín nguồn xu ──► MỘT VÍ CHUNG town_state.xu ──► tưới/bón ──► điểm sinh trưởng 0..900 ──► cây lớn dần (3D)
  (bài học · trò chơi · nộp file · quà đăng nhập · quà chuỗi)     server tính, chỉ tăng khi học
                                                        cây chỉ tiêu khi người chơi bấm
```
Cây **không in xu**: một xu chỉ được in **một lần**, ở `src/xu.js`. Đảo hoa anh đào chỉ là một **nơi tiêu xu**, ngang hàng với xây nhà của thị trấn.

## 2. Nguyên tắc (không được vi phạm)
| # | Nguyên tắc | Được bảo đảm bởi |
|---|---|---|
| 1 | **Server là nguồn sự thật.** Trình duyệt không bao giờ gửi "tôi có bao nhiêu xu" | `POST /care` chỉ nhận tên hành động; số dư đọc `town_state.xu … FOR UPDATE` |
| 2 | Mỗi lượt trả lời được thưởng **đúng một lần**, và **chỉ ở một nơi** | `town_ledger UNIQUE (user_id, attempt_id)` do `xu.js` ghi; `sakura_ledger` **không còn được ghi thêm dòng nào** (ca 2 của `test-sakura-api.js` đếm dòng trước/sau khi gọi API và đòi **bằng nhau**) |
| 3 | Hai lần tưới cùng lúc **không** làm xu âm | Khóa dòng ví `FOR UPDATE` trong một giao dịch (ca 14) + `CHECK (xu >= 0)` trên `town_state` |
| 4 | Không phạt: xu/điểm không bao giờ giảm ngoài lúc tiêu | Không có đoạn mã nào trừ xu ngoài `care()` → `xu.spend(…,"sakura",…)`; thiếu xu thì **409 và không trừ gì** (ca 12) |
| 5 | Không thưởng để cày | Trần **60 xu/ngày từ bài học** (ca 6), một câu chỉ thưởng một lần mỗi ngày (ca 5), bấm vào cây **không** có thưởng |
| 6 | Tắt/bật không mất gì | Khi tắt không cho tiêu (409); điểm sinh trưởng và ví đều giữ nguyên (ca 16) |
| 7 | Ngày tính theo **giờ Việt Nam**, không theo máy người chơi | `APP_TZ` (mặc định `Asia/Ho_Chi_Minh`); `TownCore.dayKey` được kiểm riêng trong `test-town.js` ("dayKey tính theo múi giờ Việt Nam, không theo UTC") |
| 8 | Cùng một số dư ở mọi tab | `GET /api/sakura` trả đúng `town_state.xu` mà `GET /api/town/` trả — mở hai tab vẫn thấy một con số |

## 3. Luật chơi
### 3.1 Kiếm xu — không còn là việc của cây
Toàn bộ phần **thu** của ví nằm ở [README-kinh-te-xu.md](README-kinh-te-xu.md) (chín nguồn: bài học · học thêm · trò chơi · ôn từ · lưu từ mới · nộp file · quà đăng nhập · quà chuỗi · vườn) và do `src/xu.js` in ra **một lần duy nhất** cho cả dự án. Đảo hoa anh đào chỉ đọc số dư đó.

Riêng nguồn **bài học** (để biết cây được nuôi bằng gì, và để đối chiếu con số trên chip):

| Tình huống | Xu |
|---|---|
| Câu mới trả lời đúng | **3** |
| Sửa câu từng sai (nay đúng) | **4** |
| Ôn đúng hẹn (câu đã học, đến kỳ ôn) | **2** |
| Lặp lại quá sớm | **1** |
| Một câu đã được thưởng trong ngày | 0 (ca 5) |
| Trần mỗi ngày | **60 xu**, vượt trần thì **mất phần thừa**, không giữ lại hôm sau (ca 6) |
| Lần đầu bật | Chỉ tính bù lịch sử trong **14 ngày** gần nhất (ca 9) |

Lượt không có `question_id`, hoặc câu không còn chủ điểm, **bị bỏ qua** (không lỗi, mốc vẫn tiến, ca 8). Mốc `last_attempt_id` bây giờ nằm trong ví chung (`xu.js` giữ), **không** phải `sakura_state` nữa.

### 3.2 Tiêu xu nuôi cây (`sakura-core.js`)
| Hành động | Giá | Sinh trưởng | Hiệu quả |
|---|---|---|---|
| 💧 `water` — tưới nước | 5 xu | +10 | 2 điểm/xu |
| 🌿 `fertilize` — bón phân | 20 xu | +50 | 2,5 điểm/xu (cần gom đủ xu) |

Cây tối đa **900** điểm. **Gần đầy chỉ tính tiền phần còn thiếu**: ở 895 điểm bón phân chỉ +5 và giá **2 xu** (không bao giờ trả tiền cho điểm bị bỏ phí, ca 13). Cây đã trọn vẹn thì tưới/bón trả **409** và xu giữ nguyên.

### 3.3 Sáu giai đoạn của cây
| # | Tên | Từ điểm | Hình trên trang `public/dao-hoa-anh-dao.html` |
|---|---|---|---|
| 0 | Hạt giống | 0 | Hạt + hai lá mầm trên đất |
| 1 | Mầm non | 27 | Thân nhỏ mọc lên |
| 2 | Cây con | 100 | Thân cao hơn, bốn cành lớn đầu tiên đang mọc |
| 3 | Cây trẻ | 250 | Cành rẽ nhánh nhiều cấp, còn trơ cành |
| 4 | Cây nở hoa | 500 | Lá xanh mọc kín ngọn cành rồi chuyển dần sang hồng, bắt đầu rơi cánh hoa |
| 5 | Anh đào cổ thụ | 900 | Cây khổng lồ, tán hoa hồng kín, cánh hoa rơi dày |

**Nhịp chơi:** trọn cây cần **360 xu** nếu chỉ bón phân (18 lần × 20) hoặc **450 xu** nếu chỉ tưới (90 lần × 5). Tính riêng nguồn bài học (trần 60/ngày) thì hết **6 ngày** hoặc **8 ngày**; vì ví còn nhận quà đăng nhập (+5), trò chơi (+20), nộp file (+60) và quà chuỗi, người chơi tích cực rút ngắn còn **2–3 ngày**. Đó là chủ đích: cây là **phần thưởng hình ảnh**, không phải đường cày. Nếu thấy quá nhanh/chậm, chỉnh `CONFIG.actions` hoặc `maxPoints` ở **một nơi** (mục 12).

## 4. Cấu trúc file (đường thật trong dự án)
```
CSDL/sakura.sql               3 bảng của cây (idempotent, chạy tay một lần)
src/
├─ town-core.js               lõi luật thị trấn + applyAttempts (nguồn bài học của ví)
├─ xu.js                      ★ VÍ XU CHUNG: in xu (9 nguồn), tiêu xu, lịch sử, ván do máy chủ cấp, migration gộp ví
├─ sakura-core.js             lõi thuần của cây: giai đoạn, báo giá, tưới/bón (không đụng CSDL)
├─ sakura.js                  router /api/sakura/* — đọc số dư từ xu.js, chỉ tiêu xu
└─ server.js                  app.use("/api/sakura", createSakuraRouter({ db }))  (dòng 49)
public/
├─ dao-hoa-anh-dao.html       trang 3D ĐÃ NỐI API (LIVE), có thẻ giả lập cho lúc mở file://
└─ vendor/three.r128.min.js   Three.js r128 để cục bộ — bản này không tải CDN
scripts/
├─ test-sakura.js             10 ca lõi thuần (không CSDL)
├─ test-town.js               32 ca lõi thị trấn + lõi tính xu (không CSDL)
├─ test-town-api.js           26 ca tích hợp thị trấn  } npm run test:wallet → 65 ca, chạy trên PostgreSQL thật
├─ test-xu-api.js             20 ca tích hợp ví xu     } (phủ luôn hai lần tưới song song và migration gộp ví)
└─ test-sakura-api.js         19 ca tích hợp của cây
```

## 5. Dữ liệu — cây chỉ còn ba bảng, ví nằm chỗ khác
| Bảng / cột | Vai trò hôm nay | Đáng chú ý |
|---|---|---|
| `sakura_state` | Mỗi người một dòng: **`points`** (0..900), `enabled`, `updated_at` | `CHECK (points >= 0 AND points <= 900)`. Các cột `coins`, `total_earned`, `last_attempt_id`, `day_state` **vẫn tồn tại nhưng code không còn ghi**: sau migration `coins` luôn **0** (xu đã sang `town_state.xu`), `sakura.js` không đọc `total_earned`/`day_state` nữa |
| `sakura_ledger` | **Lịch sử cũ**, không ghi thêm | `UNIQUE (user_id, attempt_id)` giữ nguyên để tra lại. `xu.js` cố ý **không** chuyển nó sang `xu_ledger` vì từng lượt đã có trong `town_ledger` — chuyển là in xu hai lần |
| `sakura_care` | Nhật ký tưới/bón, vẫn ghi mỗi lần chăm cây | `action IN ('water','fertilize')`; `cost`, `points` > 0. Số dư sau mỗi lần tiêu thì `xu_spend` (`kind = 'sakura'`) ghi lại |
| `town_state.xu` | ★ **số dư thật** mà `GET /api/sakura` trả trong `coins` | `CHECK (xu >= 0)`, khóa `FOR UPDATE` — xem README-kinh-te-xu.md |

Không dùng khóa ngoại để **Khách (`user_id = 0`)** cũng chơi được.

## 6. API (`/api/sakura`, gắn sau middleware gán `req.userId`)
| Phương thức | Việc | Lỗi |
|---|---|---|
| `GET /` | Đồng bộ bài học vào ví + phát quà ngày, rồi trả trạng thái cây (số dư là **ví chung**) | — (cây đang tắt vẫn trả `{ "enabled": false, … }`, không lỗi) |
| `POST /care` `{action}` | Tưới/bón, **tiêu xu chung** | 400 hành động lạ · 409 thiếu xu / cây đã trọn vẹn / cây đang tắt |
| `GET /history?limit=50` | **Chỉ nhật ký chăm cây** (tiền đã tiêu cho cây), mới nhất trước, tối đa 200 | — (đọc được cả khi cây đang tắt, để người chơi còn xem lại lịch sử) |
| `POST /settings` `{enabled}` | Bật/tắt tính năng | 400 nếu không phải boolean |

Mọi lỗi trả `{ "error": "<tiếng Việt>" }`; lỗi 500 chỉ trả câu chung chung, chi tiết ghi `console.error`. **Lịch sử THU của cả ví** (bài học, trò chơi, file, quà) không nằm ở đây nữa: dùng `GET /api/xu/history`.

**`GET /` trả về** (`coins` = số dư ví chung, đúng bằng `xu.balance` của `GET /api/town/`):
```json
{
  "enabled": true, "tz": "Asia/Ho_Chi_Minh", "today": "2026-11-03",
  "coins": 15, "points": 10, "maxPoints": 900,
  "stage": { "index": 0, "name": "Hạt giống", "next": "Mầm non", "nextAt": 27, "into": 10, "span": 27, "progress": 0.0111, "done": false },
  "stages": [ { "name": "Hạt giống", "at": 0 }, { "name": "Mầm non", "at": 27 }, "…" ],
  "today_stats": { "earned": 12, "cap": 60 },
  "actions": {
    "water":     { "cost": 5,  "points": 10, "canDo": true,  "payCost": 5, "gain": 10 },
    "fertilize": { "cost": 20, "points": 50, "canDo": false, "why": "Chưa đủ xu: cần 20, bạn đang có 15." }
  }
}
```
`stage.progress` là `points / maxPoints` (toàn cây, không phải trong giai đoạn) — giao diện 3D dùng đúng số đó làm `target`. Khi đã tắt: `{ "enabled": false, "tz": "…", "today": "…" }` (không đồng bộ, không tính gì).

**`POST /care` trả về:** `{ action, coins, points, cost, gained, leveledUp, done, stage }`. Giao diện hiển thị **đúng `cost` và `gained` server trả về** (gần đầy cây hai số này nhỏ hơn giá niêm yết).

**`GET /history` trả về:** `{ items: [ { type: "care", detail, amount, points, day } ] }` — `detail` là `water`/`fertilize`, `amount` là xu đã trả, `points` là sinh trưởng nhận, `day` là ngày theo `APP_TZ`. Không còn dòng `earn` nào (phần thu đã về `GET /api/xu/history`).

## 7. Cơ chế và an toàn (sau khi gộp ví)
1. **Cây không còn tự đồng bộ `attempts`.** Con đường duy nhất biến lượt trả lời thành xu là `xu.syncLessons(client, uid)` — mở tab nào (`/api/town`, `/api/xu`, `/api/sakura`) cũng gọi đúng hàm đó, và `town_ledger UNIQUE (user_id, attempt_id)` bảo đảm mỗi lượt chỉ in một lần.
2. **`ensureRow` của `xu.js`** tạo dòng ví với `last_attempt_id` = `attempt` lớn nhất **cũ hơn 14 ngày** (`CONFIG.backfillDays`), nhờ vậy lần đầu chỉ tính bù lịch sử gần nhất, không phát xu ào ạt. `ensureRow` của `sakura.js` chỉ còn `INSERT … ON CONFLICT DO NOTHING` cho dòng cây.
3. **`GET /`**: trong MỘT giao dịch — đọc cây (`FOR UPDATE`) → `syncLessons` (khóa dòng ví `FOR UPDATE`) → `dailyGifts` (quà đăng nhập + quà chuỗi, cũng cộng luôn vào ví) → `buildState`. Vì thế mở trang cây cũng **phát quà ngày y như** mở tab thị trấn, và hai số dư luôn khớp.
4. **`POST /care`**: đọc cây `FOR UPDATE` → `syncLessons` (khóa ví) → `dailyGifts` → `sakura-core.care()` thuần → `UPDATE sakura_state SET points` + `UPDATE town_state SET xu` → `INSERT sakura_care` (`clock_timestamp()`) → `xu.spend(…,"sakura",…)`. Hai lần tưới song song **xếp hàng** ở khóa dòng ví (ca 14).
5. **`clock_timestamp()` chứ không phải `now()`** cho dòng nhật ký: trong cùng một giao dịch `now()` là như nhau nên lịch sử sắp sai thứ tự so với các dòng xu vừa đồng bộ (ca 10 từng bắt lỗi này).
6. **409/400 trong giao dịch → hoàn tác tất cả**, kể cả phần đồng bộ và quà ngày. Không mất dữ liệu (lần gọi sau đồng bộ lại y hệt, sổ cái chặn thưởng hai lần), nhưng đừng viết mã giả định "gọi `/care` lỗi thì trạng thái đã được lưu".
7. Đọc `attempts` một chiều: **không sửa bảng `attempts`**, nên không ảnh hưởng chức năng học.
8. `xu_spend` ghi mỗi lần tiêu với `kind = 'sakura'` — nên `GET /api/xu/history` hiện cả tiền tiêu cho cây lẫn tiền xây nhà, còn `GET /api/sakura/history` chỉ nhật ký chăm cây.

## 8. Đã gắn vào dự án thế nào
**`src/server.js`** (sau middleware gán `req.userId`, 0 = Khách):
```js
const { createSakuraRouter } = require("./sakura");   // dòng 16
app.use("/api/sakura", createSakuraRouter({ db }));   // dòng 49 — db chỉ cần db.withTransaction
app.use("/api/xu", xu.createXuRouter({ db }));        // dòng 52 — ví chung
```
Khởi động: `db.applySchema()` (chạy `CSDL/CSDL.sql` rồi `CSDL/town.sql`, idempotent) → **`xu.migrateAll(db)`** gộp vật liệu cũ + `sakura_state.coins` còn lại vào `town_state.xu` (dòng `xu_ledger` `source='convert'`, `source_ref='convert:materials'`; chạy lại vẫn y nguyên). `CSDL/sakura.sql` **chạy tay một lần**.

**`src/auth.js`** (dòng 204) — khi đăng ký/đăng nhập nhận dữ liệu Khách (`user_id = 0`) về tài khoản mới, **cùng giao dịch** với phần chuyển `attempts` và chuyển ví:
```js
await Sakura.transferGuestData(client, 0, userId); // { moved, conflict }
// conflict === true: tài khoản mới đã có cây → KHÔNG ghi đè, giữ cây của khách làm lịch sử
```
**Biến môi trường:** `APP_TZ` (tùy chọn, mặc định `Asia/Ho_Chi_Minh`). **Phụ thuộc:** `express` và `pg` — **không thêm gói mới**.

## 9. Giao diện 3D đã nối API (`public/dao-hoa-anh-dao.html`)
Trang tự bật **chế độ LIVE** ngay khi `GET /api/sakura` trả về có `points` là số; gọi được là nhờ `location.protocol !== "file:"` và `credentials:"same-origin"`.

| Trong trang | Hiện thật |
|---|---|
| `S.coins` | `coins` từ `GET /` và `POST /care` — **chính là `xu.balance`**, chip ghi `🪙 N xu (ví chung)` |
| `S.pts`, `target = pts / MAXP` | `points`; `target = points/maxPoints` (đúng `stage.progress`) |
| Mảng `STG`, `MAXP`, `CAP` | Trang vẫn **giữ ba hằng số tự viết** (`STG` 6 ngưỡng, `MAXP=900`, `CAP=60`) và **không** đọc `stages`/`maxPoints`/`today_stats.cap` từ API. Hiện chúng trùng `CONFIG` của `sakura-core.js` nên số hiển thị đúng; **đổi luật ở server mà quên đổi trang thì trang sai** — đó là việc còn nợ (mục 15) |
| Chip ngày | `Hôm nay bài học tặng ${S.today}/${CAP} xu · số dư này cũng là của thị trấn và trò chơi` — `S.today` lấy từ `today_stats.earned` |
| Nút bật/tắc theo `coins >= 5` / `>= 20` | `$("wa").disabled = done || S.coins < 5`, `$("fe").disabled = done || S.coins < 20` (giá niêm yết — server vẫn tự prorate khi gần đầy) |
| `care(true/false)` tự trừ xu | `POST /api/sakura/care {action:"water"|"fertilize"}`; hiển thị `cost`, `gained`, số dư `coins` và `leveledUp` server trả về |
| Khung **Giả lập việc học** (3 nút xu + "Sang ngày mới") | **`$("sim").hidden = true` khi LIVE.** Vẫn còn trong file để mở `file://` hoặc khi chưa có máy chủ thì tập thử; **không** phải đường tắt kiếm xu thật |
| `localStorage` (`sakura:v1`) | Chỉ là bộ nhớ tạm của chế độ giả lập; LIVE ghi đè `coins`/`pts` từ server ở mỗi lần `pull()`. **Không** dùng để quyết định số dư |
| Lỗi | `say(j.error)` đúng câu tiếng Việt của server; mạng chết → `"Máy chủ không trả lời — cây và ví vẫn nguyên."`, cảnh không đổi |

Hai chỗ khác nhau giữa **chế độ giả lập** (mở file://, không có máy chủ) và **LIVE**: giả lập luôn trừ đủ giá 5/20 khi gần đầy cây, server chỉ tính phần còn thiếu (mục 3.2) nên số hiển thị cuối cùng phải lấy từ `cost` của server; giả lập bị `ui()` chặn nút khi thiếu xu, LIVE thì server trả **409** kèm câu tiếng Việt.

## 10. Mô hình 3D (từ điểm sinh trưởng)
Một số duy nhất điều khiển cả cây: **`P = points / 900`** (0..1). Cây nở dần mượt (làm mượt bằng nội suy), không nhảy cấp.

| Thành phần | Phụ thuộc vào `P` |
|---|---|
| Kích thước cả cây | `0,22 + 0,78 × smoothstep(P)` |
| Thân và cành | Cây dựng sẵn một lần (hạt giống ngẫu nhiên cố định, nên **mọi người chơi thấy cùng một cây**); mỗi cành có ngưỡng `t0`, **lớn lên** khi `P` vượt ngưỡng đó, cành con luôn sau cành mẹ. Thân → 4 cành lớn → 3 → 3 → 2 (tổng 125 cành) |
| Cụm hoa/lá | 144 khối cầu nhiều mặt ở ngọn cành; **xanh → hồng** khi `P` từ 0,62 đến 0,87 |
| Cánh hoa rơi | Bắt đầu từ `P = 0,5`, tối đa 200 điểm sáng; **tắt hẳn khi bật giảm chuyển động** |
| Hòn đảo | Nổi nhấp nhô nhẹ (tắt khi giảm chuyển động), hồ nước, cổng torii, đá, cỏ hoa, mây trôi |
| Ánh sáng | Bán cầu + mặt trời có bóng đổ mềm; chế độ tối giảm sáng |
| Camera | Kéo xoay, cuộn/chụm zoom (bán kính 18–80), góc đứng 0,3–1,5 rad |

Thư viện **Three.js r128 để cục bộ** — `public/vendor/three.r128.min.js`, nạp bằng `<script src="/vendor/three.r128.min.js">` (không CDN, không OrbitControls, không mô hình ngoài; mọi hình dựng bằng khối cơ bản). Nếu `window.THREE` vắng hoặc WebGL hỏng, trang hiện khối `#err`: *"Trình duyệt không chạy được WebGL hoặc không tải được Three.js. Hãy thử trình duyệt khác."* — các bảng thao tác vẫn dùng được, chỉ mất khung cảnh.

## 11. Những điểm từng phải xác nhận ở M0 — nay đã chốt
| # | Việc | Kết quả |
|---|---|---|
| 1 | Cột của `attempts` | ✔ **Đã xác nhận trong `CSDL/CSDL.sql`**: `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`, `created_at TIMESTAMPTZ`, `correct BOOLEAN`, `user_id` thêm bằng `ALTER TABLE … ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0` (dòng 199). Không cần `ADD COLUMN id bigserial` |
| 2 | `questions(id, topic)` | ✔ `id TEXT PRIMARY KEY`, `topic TEXT NOT NULL REFERENCES topics(name)` — truy vấn lô của `xu.js` (`src/xu.js:49-55`) nối đúng tên cột |
| 3 | Câu thuộc bộ bị 🙈 ẩn có tính xu không? | ✔ **Có** — truy vấn lô không lọc câu ẩn; chỉ câu đã **xóa khỏi `questions`** là rớt (`LEFT JOIN` → `topic = null` → `TownCore.applyAttempts` bỏ qua, mốc vẫn tiến). Muốn không tính câu ẩn thì thêm điều kiện vào truy vấn đó — **quyết định này ảnh hưởng cả Thị trấn**, không riêng cây |
| 4 | Đồng bộ nhanh? | ✘ Chưa bật. `CREATE INDEX IF NOT EXISTS attempts_user_id_id ON attempts (user_id, id)` vẫn chỉ là **gợi ý chú thích** ở đầu `sakura.sql` và `town.sql`. Đã có `attempts_user_idx (user_id, created_at DESC)` nên dữ liệu nhỏ chưa cần |
| 5 | Xóa bộ đề / câu | ✔ Sổ cái giữ nguyên; xu đã kiếm **không bị thu hồi** (đúng nguyên tắc 4) |
| 6 | Giao diện trên máy yếu, chụm hai ngón trên điện thoại thật, ô bấm trên màn 360 px | ✘ **Vẫn chưa thử thiết bị thật** — mới kiểm trên trình duyệt để phục vụ lập trình (WebGL dựng cảnh, bấm nút tưới/bón, nhãn 3D) |
| 7 | Giảm chuyển động | ◐ `RM` tắt **rung cây, cánh hoa rơi, đảo nhấp nhô**; **vòng xoay của bầu trời/mây vẫn chạy** (`sky.rotation.y += dt*.01` nằm ngoài `if(!RM)` ở `public/dao-hoa-anh-dao.html:199`). Cần tắt nốt để đạt yêu cầu trợ năng |
| 8 | **Hai ví riêng → MỘT VÍ CHUNG** | ✔ **Đã gộp** (03/11/2026). Đây là quyết định của người dùng: *"Xu đó được lấy ra từ các trò chơi, bài học, nộp file tài liệu, đăng nhập mỗi ngày tặng, chuỗi học sẽ được tặng."* Nên: bài học in xu **một lần duy nhất** tại `xu.js`; cây chỉ **tiêu** xu; migration `xu.migrateAll` cộng vật liệu cũ của từng khu và `sakura_state.coins` còn lại vào `town_state.xu` theo tỉ lệ 1:1 và ghi đúng một dòng `xu_ledger source='convert'`. Chi tiết: [README-kinh-te-xu.md](README-kinh-te-xu.md) |

## 12. Cách chỉnh luật ở một nơi
| Muốn | Sửa |
|---|---|
| Giá / điểm tưới, bón, thêm hành động mới | `CONFIG.actions` trong `sakura-core.js` (và `CHECK (action IN …)` trong `sakura.sql`) |
| Ngưỡng giai đoạn, điểm tối đa | `CONFIG.stages`, `CONFIG.maxPoints` (và `CHECK (points <= 900)` trong `sakura.sql`; **giữ bằng nhau**), **và `STG`/`MAXP` trong `public/dao-hoa-anh-dao.html`** vì trang chưa đọc mấy trường này từ API |
| Xu mỗi loại câu bài học, trần 60/ngày, số ngày tính bù | `CONFIG` trong `town-core.js` |
| Giá xây nhà 20/50/100, hạt 10, thu 16 | `CONFIG.buildCost`, `CONFIG.garden` trong `town-core.js` (cùng ví với cây) |
| Xu trò chơi / nộp file / quà đăng nhập / quà chuỗi | `CONFIG.xu` (dòng 50 `town-core.js`) — **ảnh hưởng cả server lẫn bundle trình duyệt** vì `town-core.js` được nhúng vào `toeic-game.html` |
| Múi giờ | Biến môi trường `APP_TZ` |

## 13. Thư viện
**Không thêm gói npm/CDN nào** — đúng quy ước "không thêm gói npm/CDN mới" của README Thú ảo: Three.js r128 nằm trong `public/vendor/three.r128.min.js` (603.445 B) và dùng chung cho cả thị trấn lẫn đảo. Backend chỉ dùng `express` + `pg` đã có.

## 14. Kiểm thử
```bash
# không cần CSDL
node scripts/test-sakura.js                        # 10 ca lõi thuần của cây
node scripts/test-town.js                          # 32 ca lõi thị trấn + tính xu
npm --prefix json test                             # CẢ BỘ: 258 bài / 0 lỗi

# tích hợp — tự tạo rồi XÓA schema tạm `sakura_test`, không đụng dữ liệu thật (đọc DATABASE_URL từ .env gốc)
npm --prefix json run test:sakura-api              # 19 ca của cây
npm --prefix json run test:wallet                  # 65 ca = town-api 26 + xu-api 20 + sakura-api 19
# Windows (cmd):  cd json && npm run test:wallet
```
Ca tích hợp của cây (`test-sakura-api.js`, đúng theo tiêu đề từng ca): 2 **không in xu hai lần** — đếm dòng `sakura_ledger` trước/sau khi gọi API và đòi **bằng nhau**, tiền chỉ nằm ở `town_ledger`; 3 GET hai lần liên tiếp số liệu không đổi; 4 thêm lượt chỉ cộng phần mới; 5 một câu đúng 5 lần cùng ngày chỉ nhận một lần; 6 100 câu đúng trong ngày → ví đúng **trần 60 + quà ngày**; 7 câu từng sai rồi đúng `fixed = 4`; 8 lượt `question_id` NULL hoặc không chủ điểm bị bỏ qua, mốc vẫn tiến; 9 có 30 ngày lịch sử thì lần đầu chỉ tính ~14 ngày; 10 tưới −5 xu **khỏi ví**, +10 điểm, ghi cả `sakura_care` lẫn `xu_spend`; 11 `leveledUp`; 12 thiếu xu 409 / hành động lạ 400 / cây trọn vẹn 409 và **không trừ gì**; 13 gần đầy cây chỉ tính 2 xu cho 5 điểm còn lại; 14 hai lần tưới song song khi ví chỉ đủ cho một → một thành công một 409, **xu không âm**; 15 mất mốc `town_state.last_attempt_id = 0` rồi GET vẫn không cộng lần hai; 16 tắt/bật; 17 cô lập tài khoản; 18 Khách chơi rồi đăng ký chuyển đủ cây + ví + nhật ký; 19 `canDo`/`why` trong GET báo giá đúng theo ví.
Phần **thu** của ví (chín nguồn, sáu trần riêng, ván do máy chủ cấp chặn gian dối từ trình duyệt, `migrateWallet` 1:1 chạy lại vẫn y nguyên) do `test-xu-api.js` **32 ca** + `test-xu-moi.js` **19 ca** — trong đó ca **16** ("Cây anh đào tiêu đúng ví chung: tưới 5 xu làm cả thị trấn lẫn ví cùng giảm") và ca **17** ("Thị trấn và cây tranh nhau xu") trực tiếp kiểm việc gộp ví. Runners: `test-town-api.js` 26 ca.

## 15. Tiêu chí — đã đạt và còn nợ
**Đã đạt (bằng kiểm thử tự động, và bằng lần mở trang thật phục vụ lập trình):**
- Mở trang là `GET /api/sakura` quyết định hết: `coins` đúng số dư ví chung (`test-xu-api.js` ca 2 "Đọc ba backend cùng thấy đúng một số dư"), `points` đúng giai đoạn, thẻ giả lập tự ẩn.
- Tưới/bón: server trả `cost`/`gained`/`coins`, trang hiển thị đúng ba số đó (ca 10, 13); 409 → `say(j.error)` và **cảnh giữ nguyên** (ca 12, 14); thông báo đi qua `#msg` có `aria-live="polite"`.
- Học thêm câu rồi mở lại trang: xu tăng đúng, không cộng hai lần (ca 3, 4, 5, 15), và **cây không tự in xu** (ca 2).
- Khách chơi rồi đăng ký: cây + ví + nhật ký chăm chuyển sang tài khoản mới (ca 18), có `conflict` thì không ghi đè.
- Thư viện để cục bộ, không CDN (mục 13).

**Còn nợ — ghi lại để làm sau, không phải lỗi dữ liệu:**
- Trang **tự viết** `STG`/`MAXP`/`CAP` thay vì đọc `stages`/`maxPoints`/`today_stats.cap` từ API (mục 9).
- `prefers-reduced-motion` mới tắt **rung cây, cánh hoa rơi, đảo nhấp nhô**; vòng xoay bầu trời/mây vẫn chạy (mục 11.7).
- `GET /` khi `enabled:false` → trang rơi về **chế độ giả lập `localStorage`** chứ không "không dựng cảnh, không nạp Three.js" như tiêu chí cũ; thẻ giả lập cũng chỉ ẩn chứ không gỡ khỏi DOM. Muốn đúng nghĩa tắt thì cần một nhánh `if (!s.enabled) → hiện lời nhắn, không khởi tạo renderer`.
- Chưa thử **điện thoại thật / máy yếu / màn 360 px** (mục 11.6), chưa thử chụm hai ngón thật.
- Chưa có **nút bật/tắt tính năng** trong trang dù `POST /api/sakura/settings` đã có và đã có ca kiểm 16.

**Quay lại (gỡ tính năng):** xóa `app.use("/api/sakura", …)` ở `src/server.js:49`, bỏ `public/dao-hoa-anh-dao.html`, bỏ `await Sakura.transferGuestData(…)` ở `src/auth.js:204`; muốn dọn dữ liệu thì `DROP TABLE sakura_care, sakura_ledger, sakura_state;`. **Không** được DROP `town_state.xu`, `xu_ledger`, `xu_spend` — đó là ví của cả dự án. Chức năng học, thị trấn và trò chơi **không bị ảnh hưởng**; số dư cây đang tiêu tự động ở lại ví chung.
