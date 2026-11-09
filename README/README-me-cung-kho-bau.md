# 🗝️ Mê cung kho báu — chiến đấu với quái vật, mở rương nhận chứng chỉ hoàn thành bộ đề

> **Dành cho:** Qoder (hoặc lập trình viên) thực hiện trên dự án `Tro_Choi` hiện có (Node + Express + PostgreSQL, `template.html` + `build.js`).
> **Trạng thái triển khai (31/10/2026):** **đã làm xong M0 → M6** trên dự án `Tro_Choi` hiện tại. Lõi + luật + mã chứng chỉ: **26 ca (9 + 12 + 5) đạt, 0 lỗi**; toàn bộ `npm test`: **143 ca đạt, 0 lỗi**; `test-dungeon-api.js`: **21/21 ca đạt**. Bản nhúng trong `toeic-game.html`: **59,9 KiB / 61.316 B chưa nén (61,4 KB theo 1000 B)**. Chứng chỉ công khai `/verify/<mã>` và `/certificate/<mã>` đã chạy thật; bản offline cấp **“Bản luyện tập — chưa xác thực”**. Các mục đánh dấu ☐ ở mục 5 là việc còn lại (chủ yếu là kiểm thử tay trên điện thoại thật / trình đọc màn hình).
> Cùng phong cách với [README-tro-choi-ky-nang.md](README-tro-choi-ky-nang.md) và [README-nut-giai-thich.md](README-nut-giai-thich.md); tài liệu này **không** thay đổi luật của các trò hiện có.

## 0. Cách giao việc cho Qoder
1. Đặt file này ở thư mục gốc dự án (cạnh `README.md`). Nếu Qoder có chế độ giao việc theo bản đặc tả (Quest/Spec), chọn chế độ đó; nếu không, dùng lời nhắc dưới đây ở khung chat.
2. **Làm theo từng mốc M0 → M6 ở mục 5, dừng sau mỗi mốc** để chạy `npm test` và tự đối chiếu "Nghiệm thu" của mốc đó rồi mới sang mốc kế.
3. Lời nhắc mẫu:
   > Đọc `README-me-cung-kho-bau.md`. Thực hiện **chỉ mốc M1** (tạo các file ở mục 7 đúng nguyên văn, thêm script test vào `package.json`, chạy `node scripts/test-dungeon.js`, `test-dungeon-rules.js`, `test-certificate.js` và báo kết quả). Không sửa file test để cho đạt. Không thêm thư viện npm. Dừng lại chờ tôi xác nhận trước khi sang M2.
4. **Quy ước chung cho mọi mốc** (Qoder phải tuân thủ):
   | Quy ước | Nội dung |
   |---|---|
   | Thư viện | **Không thêm gói npm/CDN mới.** Đồ họa vẽ bằng Canvas 2D, âm thanh bằng Web Audio, giống `duck.js` |
   | Ngôn ngữ | Chữ trên giao diện, thông báo lỗi, chú thích trong mã: **tiếng Việt** |
   | Cấu trúc | Mã trò chơi nằm ở **file riêng** (`src/dungeon-core.js`, `src/dungeon-rules.js`, `dungeon.js`), `template.html` **chỉ thêm công tắc nối** — không để `template.html` phình thêm |
   | Không đụng | Bộ phân tích đề, `explainer.js`, luật của Săn vịt và các trò kỹ năng, bảng `questions` (không thêm cột) |
   | Dòng lệnh | Ví dụ cho Windows `cmd`; đường dẫn dạng `scripts\\test-dungeon.js` hoặc `scripts/test-dungeon.js` đều được |
   | Bí mật | Không in `CERT_SECRET`, mật khẩu hay token ra log; không đưa vào `toeic-game.html` |
   | Kiểm thử | Mỗi mốc phải có kiểm thử chạy được; **không sửa kiểm thử để làm cho đạt** — sai thì sửa mã |

## 1. Ý tưởng của bạn, tóm gọn
Người chơi điều khiển một nhân vật đi trong **mê cung**, **gặp quái vật thì chiến đấu** (thực chất là trả lời câu hỏi của bộ đề), cuối hành trình mở **rương kho báu** — phần thưởng khi **hoàn thành cả file** — và nhận **chứng chỉ hoàn thành**.

### Quyết định thiết kế chính (đã chọn, có thể đổi ở mục 12)
| # | Câu hỏi | Quyết định | Lý do ngắn |
|---|---|---|---|
| 1 | "File" là gì trong trò chơi? | **Một bộ đề (mỗi file Word một bộ) = một hầm ngục**; hầm có nhiều **tầng**, mỗi tầng ~12 quái | Khớp đúng khái niệm "mỗi file một bộ, không trộn lẫn" của app |
| 2 | Quái vật là gì? | **Mỗi câu hỏi = một con quái**, cố định trên bản đồ; đánh quái = trả lời câu A–D | Không cần dữ liệu mới, dùng lại mọi câu `isPlayable` |
| 3 | "Hoàn thành file" nghĩa là gì? | **Hạ mọi quái** = mọi câu của bộ đã được trả lời đúng ít nhất một lần (kể cả đúng ở lần thử sau) | Chứng chỉ phải đại diện cho việc đã **làm hết** bộ đề |
| 4 | Sai thì sao? | Mất tim; quái **không chết**, phải đánh lại (đảo thứ tự đáp án). Sai lần thứ 3 → **Sách giải**: quái bị hạ nhưng **không EXP và trừ huy chương** | Vừa bắt học lại chỗ sai, vừa không kẹt vô hạn |
| 5 | Ai chấm đúng/sai? | **Server chấm**, không gửi đáp án xuống trình duyệt khi đang chơi (bản có máy chủ) | Chứng chỉ có ý nghĩa hơn; xem mục 2.4 về giới hạn |
| 6 | Chứng chỉ có xác thực không? | Có **mã xác thực ký bằng `CERT_SECRET`** + trang kiểm tra công khai; bản chơi offline cấp **bản luyện tập, ghi rõ chưa xác thực** | Chống sửa ảnh; không hứa quá mức |
| 7 | Có áp lực thời gian không? | **Không đếm giờ**; mê cung theo từng bước (turn-based) | Học tập, trợ năng, hợp điện thoại |
| 8 | Bộ đề lớn (500 câu)? | Chia **chặng** cân bằng ≤ 200 câu/chặng; chứng chỉ cấp **theo chặng** (giai đoạn sau: chứng chỉ cả file khi đủ mọi chặng) | 500 câu liền một mạch là quá dài |

## 2. Phân tích sâu
### 2.1 Vòng chơi
```
Chọn bộ đề → [Mê cung kho báu] → vào Tầng 1
   ┌────────────────────────────────────────────────────────────┐
   │ đi trong mê cung (sương mù) → chạm quái → trả lời A–D       │
   │   đúng: quái chết, +EXP            sai: −1 tim, quái ở lại  │
   │ mở rương (ngõ cụt): bình máu / gợi ý / khiên / vàng         │
   │ hạ hết quái của tầng → cầu thang mở → tầng kế tiếp          │
   └────────────────────────────────────────────────────────────┘
Tầng cuối sạch quái → RƯƠNG KHO BÁU → nhập tên → CHỨNG CHỈ (+ EXP thưởng)
```
Nhịp độ mục tiêu: **~2 giây đi bộ giữa hai trận**, phần lớn thời gian là suy nghĩ câu hỏi — đây là chỗ trò chơi mê cung dễ hỏng nhất (xem 2.3).

### 2.2 Ánh xạ khái niệm
| Trong game | Trong dự án | Ghi chú |
|---|---|---|
| Hầm ngục | Một bộ đề (`source_files`, mỗi file Word một bộ) | Tên hầm = tên file bỏ đuôi |
| Quái vật | Một câu (`questions`) có A–D, `status ≠ review` | Hình quái theo **chủ điểm** `topic` (bảng ở 9.3) |
| Trận đánh | Một lượt `POST /api/dungeon/fight` | Server ghi `attempts` (`mode = 'dungeon'`) và `wrong_answers` |
| Tim ❤️ | 3 tim như mọi chế độ khác | Hết tim → "ngất", **không mất tiến độ** |
| Trùm | Quái cuối mỗi tầng (nếu tầng ≥ 3 quái) | Sai mất **2 tim**, đúng **×2 EXP**; vẫn **một câu** |
| Rương | Ngõ cụt của mê cung | Phần thưởng tất định theo `seed` |
| Kho báu | Rương ở **tầng cuối** | Mở được khi mọi quái đã chết |
| Chứng chỉ | Bảng `certificates` + ảnh PNG + trang in PDF | Mã xác thực ký HMAC |

### 2.3 Những chỗ dễ hỏng và cách xử lý
| Vấn đề | Hậu quả nếu bỏ qua | Quyết định |
|---|---|---|
| **Đi bộ nhiều hơn học** | Người chơi chán, trò thành "tìm đường" | Mê cung **nhỏ** (6×6 ô cho 12 quái), **chạm ô để tự đi** (tìm đường BFS), la bàn chỉ quái gần nhất khi còn ≤ 20% quái. Mô phỏng 200 mê cung: **~9 bước/quái** khi biết trước bản đồ (≈ 106 bước/tầng 12 quái); có sương mù thì nhiều hơn, vẫn là vài giây mỗi trận |
| **Sai hoài không qua được** | Kẹt vĩnh viễn → không bao giờ có chứng chỉ | Sai lần thứ 3 → **Sách giải** (quái chết, không EXP, trừ huy chương). Xem luật ở mục 3 |
| **Học vẹt theo vị trí đáp án** | Sai rồi đánh lại vẫn "A" | **Đảo thứ tự đáp án mỗi lần gặp**; server nhận chỉ số **gốc** của đáp án |
| **Chứng chỉ "rẻ"** | Ai cũng có, vô nghĩa | Phải hạ **mọi** quái; huy chương theo tỉ lệ **đúng ngay lần đầu** (vàng ≥ 85% và không dùng Sách giải) |
| **Cày một bộ nhiều lần để lấy nhiều chứng chỉ** | Rác dữ liệu | Duy nhất theo `(tài khoản, bộ đề, chặng, mã băm danh sách câu)`: chơi lại cùng nội dung **không cấp thêm**; hiện chứng chỉ cũ |
| **Mất tiến độ khi tắt trình duyệt** | Ván 1 giờ bay mất | Server **lưu sau mỗi trận**; mở lại tiếp tục đúng tầng. Vị trí nhân vật không lưu — về cổng vào của tầng (quái đã chết vẫn chết) |
| **Bộ đề đổi giữa chừng** (thêm/xóa câu) | Ván hỏng | Ván giữ **ảnh chụp danh sách id câu** lúc bắt đầu; câu bị xóa coi như bị hạ **không tính EXP** |
| **Xóa bộ đề** (`DELETE /api/files/:id`) | Chứng chỉ biến mất | Chứng chỉ lưu **bản chép tên bộ đề**, `file_id` đặt `NULL` khi xóa; ván dở xóa theo |
| **Khách rồi đăng ký tài khoản** | Mất ván/chứng chỉ của Khách | App đang "nhận lại" tiến độ khách khi đăng ký (`adopted`) — **thêm hai bảng mới vào bước đó** (xem M2, đối chiếu `auth.js`) |
| **Hình ảnh/bản quyền** | Dính IP | **Không dùng sprite, tên hay nhạc của trò khác**; hình = emoji + hình vẽ bằng Canvas, âm = tổng hợp |
| **Trợ năng** | Người dùng bàn phím/đọc màn hình không chơi được | Toàn bộ chơi bằng bàn phím; trận đánh là **hộp thoại HTML** (không vẽ chữ lên canvas); không nhấp nháy; tôn trọng `prefers-reduced-motion` (mục 9.5) |

### 2.4 Chứng chỉ này có giá trị gì — nói thẳng
* **Là gì:** giấy ghi nhận *"tài khoản X đã hạ hết N câu của bộ đề Y, đúng ngay lần đầu Z%"*, do chính ứng dụng cấp. Có mã để người khác kiểm tra **ứng dụng có cấp giấy này hay không**.
* **Không phải:** chứng chỉ TOEIC/ETS, và **không phải bài thi có giám sát**. Trên giấy phải in dòng *"Chứng chỉ tự học do ứng dụng cấp, không phải chứng chỉ TOEIC chính thức."*
* **Giới hạn kỹ thuật cần biết:** `GET /api/questions` hiện vẫn trả `a` (đáp án) cho trình duyệt, nên người có kỹ năng vẫn đọc được đáp án qua tab Network. Chặn việc này cần thêm một **chế độ thi** (không trả `a` cho bộ đang chơi) — nằm ngoài giai đoạn này (mục 11). Việc server chấm trận đánh vẫn có ích: mã xác thực chỉ tồn tại nếu **server ghi nhận đủ trận**, và không ai sửa được tên/điểm trên ảnh mà mã vẫn khớp.
* EXP của app hiện do trình duyệt gửi lên (`POST /api/progress`), nên EXP **không** phải bằng chứng — chỉ bản ghi trận đánh trong `dungeon_fights` mới là bằng chứng.

### 2.5 Độ dài một ván (ước tính, cần đo lại khi chạy thật)
| Bộ đề | Số tầng | Thời lượng ước tính (≈ 20 giây/câu + đi bộ) |
|---|---|---|
| 24 câu | 2 | ~10 phút |
| 100 câu | 8 | ~40 phút |
| 169 câu (file `ĐC 10 - REVIEW GHKI.docx` sau khi nhập) | 14 | ~1 giờ 10 phút, **một chặng** |
| 500 câu | 3 chặng × ~167 | ~1 giờ mỗi chặng |

Vì mỗi trận đều được lưu, người chơi dừng/tiếp tục thoải mái.

## 3. Luật chơi chính xác (server chấm, cũng là bản offline dùng chung)
| Mục | Quy tắc |
|---|---|
| Tim | 3 tim đầu ván. Bình máu hồi 1, **không vượt 3** |
| Chạm quái | Mở hộp thoại trận đánh: đề + 4 đáp án (đảo thứ tự mỗi lần gặp) |
| Đúng | Quái chết. **+10 EXP** nếu đúng ngay lần đầu của câu đó, **+5** nếu đúng sau khi từng sai. Dùng gợi ý thì **−5** (không dưới 0). Trùm **×2** |
| Sai | **−1 tim** (trùm **−2**). Khiên (nếu có) chặn đúng một đòn rồi mất. Quái ở lại, câu đó sẽ hiện **đáp án đúng + giải thích** sau mỗi lần sai |
| Sai lần thứ 3 trên cùng câu | **Sách giải**: quái chết, **0 EXP**, tính vào `assisted` (trừ huy chương) |
| Hết tim | **Ngất**: tim về đầy, nhân vật về cổng vào của tầng, `deaths + 1`; quái đã chết **vẫn chết** |
| Gợi ý 🔍 | Loại một đáp án sai (server chọn tất định theo ván + câu). Chỉ có khi nhặt từ rương |
| Rương | Mỗi rương mở **một lần**; thưởng tất định theo `seed` (bình máu 35% · gợi ý 35% · khiên 20% · chỉ vàng 10%) + 10–30 vàng |
| Cầu thang | Mở khi **mọi quái của tầng đã chết**. Tầng cuối không có cầu thang mà có **rương kho báu** |
| Hoàn thành | Mọi câu của ván đã chết → bấm mở kho báu → nhập tên → cấp chứng chỉ + EXP thưởng (vàng 100 · bạc 60 · đồng 30) |
| Huy chương | Vàng: đúng ngay lần đầu ≥ 85% **và** không dùng Sách giải · Bạc: ≥ 65% và Sách giải ≤ 5% · còn lại Đồng |
| Mê cung | Sinh bằng **hạt giống** (`seed`): cùng ván + cùng tầng → cùng bản đồ. 6×6 ô cho 12 quái, góc vào ngẫu nhiên, cầu thang ở nơi xa nhất, rương ở ngõ cụt |

## 4. Kiến trúc và danh sách file
```
Tro_Choi/
├── src/
│   ├── dungeon-core.js        # MỚI  lõi mê cung (seed, chia tầng/chặng, sinh bản đồ, thưởng rương, huy chương) — UMD, dùng cả Node lẫn trình duyệt
│   ├── dungeon-rules.js       # MỚI  luật chơi thuần (fight/descend/openChest/finish) — UMD
│   ├── certificate.js         # MỚI  mã xác thực HMAC (chỉ Node)
│   ├── dungeon.js             # MỚI  router Express: /api/dungeon/*, /api/certificates/*, trang /verify
│   └── server.js              # SỬA  mount router + trang /verify (vài dòng)
├── dungeon.js                 # MỚI  engine client: Canvas 2D + hộp thoại trận đánh + chứng chỉ (nối qua window.DungeonGame)
├── build.js                   # SỬA  nhúng dungeon-core + dungeon-rules + dungeon.js (đối chiếu cách đang nhúng duck.js)
├── template.html              # SỬA  thẻ "Mê cung kho báu" trong màn bộ đề + công tắc nối (rất nhỏ)
├── CSDL/CSDL.sql              # SỬA  3 bảng mới (mục 6), idempotent
├── scripts/
│   ├── test-dungeon.js        # MỚI  (mục 7)  test-dungeon-rules.js, test-certificate.js
│   └── test-dungeon-api.js    # MỚI  kiểm thử tích hợp (M2)
└── package.json               # SỬA  thêm vào "test"
```
Hai lớp, **cùng một bộ luật**:
* **Có máy chủ (`http://localhost:3000`)**: ván nằm ở PostgreSQL, server chấm bằng `dungeon-rules.js`. Chứng chỉ có mã xác thực.
* **Mở file `toeic-game.html` trực tiếp (không server)**: cùng `dungeon-rules.js` chạy trong trình duyệt, ván lưu `localStorage`. Chứng chỉ ghi **"Bản luyện tập — chưa xác thực"**, không có mã.

Engine chỉ nói chuyện qua một **adapter** để hai chế độ dùng chung mã (mục 9.1).

## 5. Các mốc thực hiện
> Mỗi mốc kết thúc bằng một lệnh kiểm tra chạy được. Qoder **dừng** sau mốc và báo cáo.

### M0 — Đọc và xác nhận (không sửa gì)
- [x] Đọc `public/template.html`: tìm `/*__DUCK__*/`, `window.DuckGame`, `isPlayable`, `renderDeck`, `renderDeckSkills`, `showFeedback`, `explainHtml`, `goBackToDeck`; ghi lại số dòng.
- [x] Đọc `scripts/build.js`: cách `duck.js`, `skill-extra.js`, `explainer.js` được nhúng.
- [x] Đọc `src/auth.js` (hàm "nhận lại dữ liệu khách" khi đăng ký) và `CSDL/CSDL.sql` (có `CHECK` trên `attempts.mode` không?).
- [x] Đọc `src/server.js`: `asyncRoute`, middleware gán `req.userId`, route `/api/answer`.
- **Nghiệm thu:** một danh sách ngắn "điểm nối" (file:dòng) gửi lại cho bạn. **Chưa sửa mã.**

### M1 — Lõi và kiểm thử (mục 7)
- [x] Tạo `src/dungeon-core.js`, `src/dungeon-rules.js`, `src/certificate.js`, 3 file test **đúng nguyên văn mục 7**.
- [x] `json/package.json`: thêm vào `scripts.test` ba lệnh `node scripts/test-dungeon.js && node scripts/test-dungeon-rules.js && node scripts/test-certificate.js` (nối vào chuỗi đang có, không thay).
- **Nghiệm thu:** `npm test` → các nhóm cũ vẫn `0 lỗi`, ba nhóm mới **9 + 12 + 5 đạt, 0 lỗi**.

### M2 — CSDL và API
- [x] Thêm 3 bảng ở mục 6 vào `CSDL/CSDL.sql` (`CREATE TABLE IF NOT EXISTS`, chạy lại nhiều lần không lỗi). Nếu `attempts.mode` có `CHECK`, thêm `'dungeon'`.
- [x] Tạo `src/dungeon.js` (router) theo mục 8; mount trong `server.js` **sau** middleware gán `req.userId`.
- [x] Thêm `CERT_SECRET=` (chuỗi ngẫu nhiên ≥ 32 ký tự) vào `.env` và nhắc trong README chính (`.env.example`); **không** commit giá trị thật.
- [x] Hàm "nhận lại dữ liệu khách" trong `auth.js`: thêm `UPDATE dungeon_runs SET user_id = $new WHERE user_id = 0` và tương tự `certificates` (đối chiếu cách đang làm với `player_progress`).
- [x] Viết `scripts/test-dungeon-api.js`: tự dựng dữ liệu thử (một bộ đề 24 câu, tài khoản thử), gọi API bằng `fetch` (Node 18+) và kiểm các ca ở mục 12.1; **dọn dữ liệu thử** sau khi chạy; không gọi AI.
- **Nghiệm thu:** chơi hết một ván 24 câu **chỉ bằng API** (đúng, sai, Sách giải, ngất, rương, xuống tầng, kết thúc) và nhận chứng chỉ; mọi ca lỗi trả đúng mã HTTP ở mục 8. **Kết quả: 21/21 ca đạt.**

### M3 — Engine mê cung (chưa có trận đánh thật)
- [x] `dungeon.js` ở thư mục gốc, API `window.DungeonGame` (mục 9.1). Vẽ mê cung từ `DungeonCore.generateFloor`, sương mù, nhân vật, quái, rương, cầu thang; di chuyển bàn phím/vuốt/chạm-để-đi.
- [x] `scripts/build.js`: nhúng `src/dungeon-core.js`, `src/dungeon-rules.js`, `dungeon.js` (theo đúng cách đang nhúng `duck.js`, thêm chỗ giữ `/*__DUNGEON__*/` trong `public/template.html`).
- [x] Adapter **offline** (localStorage) trước, để thử không cần server.
- **Nghiệm thu:** mở `toeic-game.html` bằng file, vào một bộ đề, thấy thẻ **🗝️ Mê cung kho báu**, đi được trong mê cung, chạm quái hiện hộp thoại tạm.

### M4 — Trận đánh, vật phẩm, tầng, lưu và tiếp tục
- [x] Hộp thoại trận đánh HTML (mục 9.4), nối **khối 💡 và Gia sư AI** theo quy tắc của [README-nut-giai-thich.md](README-nut-giai-thich.md); bản offline **bỏ `id/coach`** nên không gọi AI.
- [x] Adapter **online** (`fetch` tới `/api/dungeon/*`), túi đồ, rương, cầu thang, ngất, tiếp tục ván dở.
- **Nghiệm thu:** chơi hết một bộ 24 câu trên server; tắt tab giữa chừng rồi mở lại **tiếp tục đúng tầng**; trình duyệt **không bao giờ nhận `a`** từ `/api/dungeon/*` khi đang chơi (kiểm trong tab Network).

### M5 — Kho báu và chứng chỉ
- [x] Màn mở rương → nhập tên → `POST /api/dungeon/finish` → chứng chỉ.
- [x] Vẽ chứng chỉ bằng Canvas, **tải PNG**; trang `/certificate/:code` khổ A4 ngang để **In → Lưu PDF**.
- [x] Trang công khai `/verify/:code` và `GET /api/certificates/verify/:code`.
- [x] Mục **🏅 Chứng chỉ của tôi** trong tab **💾 CSDL & tiến độ**.
- **Nghiệm thu:** mục 12.3 (tất cả ca đạt).

### M6 — Hoàn thiện
- [x] Âm thanh, cài đặt trợ năng, nút D-pad điện thoại, chế độ tối (dùng biến màu `--panel/--ink/…` của app nên theo Auto/Sáng/Tối), **Sổ tay câu đã sai** sau khi hoàn thành (nút "📓 Ôn N câu sai" dùng `wrong_answers` sẵn có).
- [ ] Chạy cả bảng kiểm thử tay mục 12.2 trên Chrome và một điện thoại thật/giả lập 360 px. — **đã kiểm tra ở mức DOM trên Chrome**: thẻ ẩn với bộ 5 câu chơi được, hiện với bộ 50 câu; chứng chỉ online/offline, PNG 1600×1131, `/verify` + `/certificate` đúng/sai mã; **chưa** chạy 360 px thật và trình đọc màn hình (NVDA).
- **Nghiệm thu:** mục 13.

### Kết quả đo (31/10/2026)
| Hạng mục | Kết quả |
|---|---|
| `npm test` | **143/143 ca đạt, 0 lỗi** (parser 20 · AI parser 26 · explainer 42 · skill items 29 · lõi mê cung 9 · luật 12 · chứng chỉ 5). *Từ 01/11 có thêm 48 ca tra cứu bôi đen → **191/191**; cùng ngày thêm 11 ca trang đăng nhập (`test-auth-ui.js`) → **202/202**, rồi 7 ca trang giới thiệu (`test-landing.js`) → **209/209**.* |
| `npm run test:dungeon-api` | **21/21 ca đạt** (dọn dữ liệu thử sau khi chạy) |
| Kích thước thêm vào `toeic-game.html` | **59,9 KiB / 61.316 B** chưa nén (đo bằng `Buffer.byteLength` trong `scripts/build.js`), dưới trần 60 KiB = 61.440 B |
| Đi lại (đo trên bản offline, `reduceMotion:false`) | Bấm mũi tên / D-pad / WASD: mỗi lần **đúng một ô**, hoạt ảnh trượt kết thúc sau ~120 ms rồi nhận lần bấm kế; đâm tường → `🚧 Tường chắn — thử hướng khác.`; `S.anim` luôn được xoá nên `busyMove()` không kẹt (xem mục 9.5 và nhật ký #36 của README.md) |
| Vẽ mê cung | nền sương tối `#070b14`, tường `#4a5a7a` / sàn `#202b42` tương phản rõ, khung hầm + vạch chéo, bán kính nhìn 4 ô, canvas co đúng khung và `devicePixelRatio ≤ 2` |
| Toàn màn hình | mở hầm tự gọi `requestFullscreen` trên `.dg-root` (bị chặn thì chạy tiếp bình thường); thoát hầm tự thoát toàn màn hình; phím `F` bật/tắt. Canvas **giãn kín khung chơi** (rộng = khung − 8 px, cao = khung − 8 px): ô lưới thành **hình chữ nhật** `cw × ch` để 13×13 phủ hết màn hình thay vì để dải trắng/hai bên; emoji, chữ chủ điểm, la bàn và `canvasCell()` đều tính theo `cw`/`ch` nên bấm ô vẫn đúng; tỉ lệ điểm ảnh giới hạn để buffer ≤ 2560 px ngang |
| Nút “Tải PNG” | Canvas **1600×1131**, `toBlob` chạy không lỗi |
| `/verify/<mã>` · `/certificate/<mã>` | mã hợp lệ → 200 có “Hợp lệ”; mã sai → 404 “Không tìm thấy chứng chỉ”; API không trả `user_id`/email |
| Chơi offline | thẻ ẩn khi bộ < 12 câu chơi được; chứng chỉ ghi “Bản luyện tập — chưa xác thực”, không có nút In/kiểm tra |
| Bí mật | `CERT_SECRET` chỉ đọc từ `.env`; `toeic-game.html` không chứa chuỗi này |

## 6. Dữ liệu
```sql
-- Ván chơi. state = đối tượng `run` của dungeon-rules.js (vài KB). Chỉ MỘT ván 'active' cho mỗi (người, bộ đề, chặng).
CREATE TABLE IF NOT EXISTS dungeon_runs (
  id          bigserial PRIMARY KEY,
  user_id     integer NOT NULL DEFAULT 0,               -- 0 = Khách của máy này (giống các bảng khác, KHÔNG có khóa ngoại tới users)
  file_id     integer REFERENCES source_files(id) ON DELETE CASCADE,
  segment     integer NOT NULL DEFAULT 1,
  segments    integer NOT NULL DEFAULT 1,
  snapshot    text    NOT NULL,                          -- sha256 của danh sách id câu đã sắp xếp (nhận biết bộ đề đã đổi)
  state       jsonb   NOT NULL,
  status      text    NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS dungeon_runs_one_active
  ON dungeon_runs (user_id, file_id, segment) WHERE status = 'active';

-- Nhật ký trận đánh (chỉ thêm, không sửa): bằng chứng cho chứng chỉ.
CREATE TABLE IF NOT EXISTS dungeon_fights (
  id          bigserial PRIMARY KEY,
  run_id      bigint  NOT NULL REFERENCES dungeon_runs(id) ON DELETE CASCADE,
  question_id text,                                      -- có thể NULL nếu câu bị xóa sau đó
  choice      integer,                                   -- chỉ số đáp án GỐC người chơi chọn
  correct     boolean NOT NULL,
  hinted      boolean NOT NULL DEFAULT false,
  floor_no    integer NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dungeon_fights_run ON dungeon_fights (run_id);

CREATE TABLE IF NOT EXISTS certificates (
  id          bigserial PRIMARY KEY,
  code        text    NOT NULL UNIQUE,                   -- TC-XXXX-XXXX-XXXX
  user_id     integer NOT NULL DEFAULT 0,
  file_id     integer REFERENCES source_files(id) ON DELETE SET NULL,
  run_id      bigint  REFERENCES dungeon_runs(id) ON DELETE SET NULL,
  snapshot    text    NOT NULL,
  segment     integer NOT NULL DEFAULT 1,
  segments    integer NOT NULL DEFAULT 1,
  holder_name text    NOT NULL,
  file_title  text    NOT NULL,                          -- bản chép: bộ đề bị xóa vẫn còn tên
  total       integer NOT NULL,
  first_try   integer NOT NULL,
  assisted    integer NOT NULL,
  medal       text    NOT NULL CHECK (medal IN ('gold','silver','bronze')),
  started_at  timestamptz,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  revoked     boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, file_id, segment, snapshot)
);
```
**Ghi chú:** `file_id` của `certificates` dùng `ON DELETE SET NULL` nên ràng buộc `UNIQUE (…file_id…)` không chặn được sau khi xóa bộ đề (NULL khác NULL) — chấp nhận được. Đối chiếu `importer.deleteFile`: nó xóa `questions` rồi `source_files`; khóa ngoại trên sẽ tự dọn `dungeon_runs` và giữ chứng chỉ.

## 7. Mã nguồn đã kiểm thử (tạo nguyên văn)
### 7.1 `src/dungeon-core.js`
```js
"use strict";

/* LÕI THUẦN của "Mê cung kho báu": không DOM, không Node-API, không mạng.
   Dùng chung cho server (Node) và trình duyệt (build.js nhúng file này trước dungeon.js).
   Mọi hàm đều tất định theo hạt giống (seed) để lưu/tiếp tục ván và để kiểm thử. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DungeonCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const CONFIG = {
    questionsPerFloor: 12, // số quái mỗi tầng (mục tiêu)
    minQuestionsToPlay: 12, // bộ đề ít hơn thì không mở mê cung
    maxQuestionsPerRun: 200, // trần mỗi ván; bộ lớn hơn được chia thành các "chặng" cân bằng
    hearts: 3,
    bossDamage: 2, // quái trùm: trả lời sai mất 2 tim, đúng được gấp đôi EXP
    bossExpMul: 2,
    maxRespawn: 2, // câu sai được hồi sinh tối đa 2 lần; lần sai thứ 3 -> "Sách giải" (assisted)
    braid: 0.08, // tỉ lệ đục thêm tường để có vòng lặp (bớt ngõ cụt)
    minSpacing: 3, // khoảng cách bước tối thiểu giữa hai quái (hạ dần nếu chật)
    medal: { gold: 0.85, silver: 0.65, silverMaxAssisted: 0.05 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (n) => Math.floor(next() * n);
    next.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = next.int(i + 1);
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    return next;
  }

  /* n câu -> số quái từng tầng, chênh nhau tối đa 1 (không có tầng cuối lẻ loi). */
  function splitFloors(n, target) {
    const t = target || CONFIG.questionsPerFloor;
    const floors = Math.max(1, Math.round(n / t));
    const base = Math.floor(n / floors);
    const extra = n % floors;
    return Array.from({ length: floors }, (_, i) => base + (i < extra ? 1 : 0));
  }

  /* n câu -> kích thước từng chặng (mỗi chặng <= trần, cân bằng, không chặng cuối lẻ loi). */
  function splitSegments(n, cap) {
    const c = cap || CONFIG.maxQuestionsPerRun;
    const segs = Math.max(1, Math.ceil(n / c));
    const base = Math.floor(n / segs);
    const extra = n % segs;
    return Array.from({ length: segs }, (_, i) => base + (i < extra ? 1 : 0));
  }

  const sizeFor = (monsters) => clamp(Math.round(Math.sqrt(monsters * 3)), 5, 9);

  /* Sinh một tầng. Ô 0 = lối đi, 1 = tường. Tọa độ {x, y}; lưới (2c+1)x(2c+1). */
  function generateFloor({ seed, monsters, chests }) {
    const rand = rng(seed);
    let c = sizeFor(monsters);
    const wantChests = chests == null ? 1 : chests;
    while (c * c < Math.ceil(monsters * 1.5) + wantChests + 3 && c < 14) c++;
    const N = 2 * c + 1;
    const grid = Array.from({ length: N }, () => new Array(N).fill(1));

    // DFS có quay lui -> hành lang dài, ít ngã rẽ
    const seen = new Set();
    const key = (x, y) => y * N + x;
    const startCell = { x: rand.int(c), y: rand.int(c) };
    const stack = [startCell];
    seen.add(key(startCell.x, startCell.y));
    grid[2 * startCell.y + 1][2 * startCell.x + 1] = 0;
    const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const opts = rand.shuffle(DIR).filter(([dx, dy]) => {
        const nx = cur.x + dx, ny = cur.y + dy;
        return nx >= 0 && ny >= 0 && nx < c && ny < c && !seen.has(key(nx, ny));
      });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[0];
      const nx = cur.x + dx, ny = cur.y + dy;
      grid[2 * cur.y + 1 + dy][2 * cur.x + 1 + dx] = 0;
      grid[2 * ny + 1][2 * nx + 1] = 0;
      seen.add(key(nx, ny));
      stack.push({ x: nx, y: ny });
    }

    // đục thêm vài bức tường giữa hai ô đã thông để tạo vòng lặp
    for (let y = 0; y < c; y++) {
      for (let x = 0; x < c; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (x + dx >= c || y + dy >= c) continue;
          if (grid[2 * y + 1 + dy][2 * x + 1 + dx] === 1 && rand() < CONFIG.braid) {
            grid[2 * y + 1 + dy][2 * x + 1 + dx] = 0;
          }
        }
      }
    }

    // vào ở một góc ngẫu nhiên
    const corners = [[0, 0], [c - 1, 0], [0, c - 1], [c - 1, c - 1]];
    const [sx, sy] = corners[rand.int(4)];
    const start = { x: 2 * sx + 1, y: 2 * sy + 1 };

    const bfs = (from) => {
      const dist = Array.from({ length: N }, () => new Array(N).fill(-1));
      const q = [from];
      dist[from.y][from.x] = 0;
      for (let i = 0; i < q.length; i++) {
        const p = q[i];
        for (const [dx, dy] of DIR) {
          const nx = p.x + dx, ny = p.y + dy;
          if (grid[ny][nx] === 0 && dist[ny][nx] < 0) {
            dist[ny][nx] = dist[p.y][p.x] + 1;
            q.push({ x: nx, y: ny });
          }
        }
      }
      return dist;
    };
    const dist = bfs(start);

    const centers = [];
    for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) centers.push({ x: 2 * x + 1, y: 2 * y + 1 });
    const d = (p) => dist[p.y][p.x];

    // cầu thang ở ô xa nhất
    let stairs = centers[0];
    for (const p of centers) if (d(p) > d(stairs)) stairs = p;

    // quái: rải đều, cách nhau >= minSpacing nếu còn chỗ, tránh cổng vào/cầu thang
    const taken = new Set([key(start.x, start.y), key(stairs.x, stairs.y)]);
    let pool = rand.shuffle(centers.filter((p) => !taken.has(key(p.x, p.y)) && d(p) >= 3));
    if (pool.length < monsters) pool = rand.shuffle(centers.filter((p) => !taken.has(key(p.x, p.y))));
    const picked = [];
    for (let spacing = CONFIG.minSpacing; spacing >= 0 && picked.length < monsters; spacing--) {
      for (const p of pool) {
        if (picked.length >= monsters) break;
        if (picked.includes(p)) continue;
        if (picked.every((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y) >= spacing * 2)) picked.push(p);
      }
    }
    picked.forEach((p) => taken.add(key(p.x, p.y)));
    // trùm = quái xa cổng vào nhất
    const order = picked.slice().sort((a, b) => d(b) - d(a));
    const monsterList = picked.map((p) => ({ x: p.x, y: p.y, boss: monsters >= 3 && p === order[0] }));

    // rương: ưu tiên ngõ cụt chưa có gì
    const open = (p) => DIR.filter(([dx, dy]) => grid[p.y + dy][p.x + dx] === 0).length;
    const rest = centers.filter((p) => !taken.has(key(p.x, p.y)));
    const dead = rand.shuffle(rest.filter((p) => open(p) === 1));
    const chestCells = dead.concat(rand.shuffle(rest.filter((p) => open(p) !== 1))).slice(0, wantChests);

    return {
      size: N, cells: c, grid, start, stairs,
      monsters: monsterList, chests: chestCells.map((p) => ({ x: p.x, y: p.y })),
      dist,
    };
  }

  /* Phần thưởng rương, tất định theo (seed, tầng, số rương) -> mở lại không đổi, server tính được. */
  function chestLoot(seed, floor, chestIdx) {
    const r = rng(hash32(`${seed}|${floor}|${chestIdx}`));
    const roll = r();
    const gold = 10 + r.int(21);
    if (roll < 0.35) return { item: "potion", gold };
    if (roll < 0.70) return { item: "hint", gold };
    if (roll < 0.90) return { item: "shield", gold };
    return { item: null, gold: gold + 20 };
  }

  /* stats: { total, firstTry, assisted } */
  function medal(stats) {
    const total = Math.max(1, stats.total);
    const rate = stats.firstTry / total;
    const ass = (stats.assisted || 0) / total;
    const m = CONFIG.medal;
    if (rate >= m.gold && ass === 0) return "gold";
    if (rate >= m.silver && ass <= m.silverMaxAssisted) return "silver";
    return "bronze";
  }

  return { CONFIG, hash32, rng, splitFloors, splitSegments, sizeFor, generateFloor, chestLoot, medal };
});
```
### 7.2 `src/dungeon-rules.js`
```js
"use strict";

/* LUẬT CHƠI THUẦN của Mê cung kho báu (không DB, không mạng, không DOM).
   Server dùng để PHÁN quyết mọi trận đánh; bản offline trong trình duyệt dùng cùng file này.
   Mọi hàm nhận `run` và trả bản sao mới -> dễ kiểm thử và dễ ghi nhật ký. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dungeon-core"));
  else root.DungeonRules = factory(root.DungeonCore);
})(typeof self !== "undefined" ? self : this, function (Core) {
  const C = Core.CONFIG;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fail = (message, status) => Object.assign(new Error(message), { status: status || 400 });

  /* Chia câu vào các tầng, tất định theo seed: cùng (seed, danh sách câu) -> cùng kết quả. */
  function planFloors(seed, questionIds) {
    const order = Core.rng(Core.hash32("plan|" + seed)).shuffle(questionIds);
    const sizes = Core.splitFloors(order.length);
    const out = [];
    let at = 0;
    for (const n of sizes) { out.push(order.slice(at, at + n)); at += n; }
    return out;
  }

  function newRun({ seed, questionIds }) {
    if (questionIds.length < C.minQuestionsToPlay) throw fail(`Bộ đề cần ít nhất ${C.minQuestionsToPlay} câu chơi được.`);
    if (new Set(questionIds).size !== questionIds.length) throw fail("Danh sách câu có id trùng.");
    return {
      seed, questionIds: questionIds.slice(), floorNo: 1, hearts: C.hearts,
      items: { potion: 0, hint: 0, shield: 0 }, gold: 0,
      defeated: [], firstTry: [], assisted: [], hinted: [], wrong: {}, chests: [],
      deaths: 0, fights: 0, exp: 0, status: "active",
    };
  }

  const floorsOf = (run) => planFloors(run.seed, run.questionIds);
  const floorOfQuestion = (run, qid) => floorsOf(run).findIndex((f) => f.includes(qid)) + 1;
  const isBoss = (run, qid) => {
    // trùm = quái cuối danh sách của tầng đó (client dùng cùng quy ước để gắn cờ khi đặt quái vào mê cung)
    const f = floorsOf(run)[floorOfQuestion(run, qid) - 1];
    return f.length >= 3 && f[f.length - 1] === qid;
  };

  function floorCleared(run, floorNo) {
    const f = floorsOf(run)[floorNo - 1];
    return !!f && f.every((q) => run.defeated.includes(q));
  }
  const runCompleted = (run) => run.questionIds.every((q) => run.defeated.includes(q));

  /* Một trận đánh. `correct` do SERVER tính từ đáp án trong CSDL, không tin client. */
  function fight(run, qid, correct, opts) {
    if (run.status !== "active") throw fail("Ván này đã kết thúc.", 409);
    if (!run.questionIds.includes(qid)) throw fail("Câu này không thuộc ván.", 400);
    if (run.defeated.includes(qid)) throw fail("Quái này đã bị hạ.", 409);
    const floorNo = floorOfQuestion(run, qid);
    if (floorNo !== run.floorNo) throw fail("Quái này không ở tầng hiện tại.", 409);

    const r = clone(run);
    const boss = isBoss(r, qid);
    const events = [];
    let exp = 0;
    r.fights++;

    if (correct) {
      r.defeated.push(qid);
      const first = !r.wrong[qid];
      if (first) r.firstTry.push(qid);
      exp = first ? 10 : 5;
      if (opts && opts.hinted) { r.hinted.push(qid); exp = Math.max(0, exp - 5); }
      if (boss) exp *= C.bossExpMul;
      events.push({ type: "defeated", qid, first, boss });
    } else {
      r.wrong[qid] = (r.wrong[qid] || 0) + 1;
      let dmg = boss ? C.bossDamage : 1;
      if (r.items.shield > 0) { r.items.shield--; dmg = 0; events.push({ type: "shield" }); }
      r.hearts = Math.max(0, r.hearts - dmg);
      events.push({ type: "hurt", dmg, hearts: r.hearts });
      if (r.wrong[qid] > C.maxRespawn) { // Sách giải: hạ quái nhưng không tính EXP, trừ huy chương
        r.defeated.push(qid);
        r.assisted.push(qid);
        events.push({ type: "assisted", qid });
      }
      if (r.hearts === 0) {
        r.deaths++;
        r.hearts = C.hearts;
        events.push({ type: "knockedOut" }); // về cổng vào của tầng, quái đã hạ vẫn chết
      }
    }
    r.exp += exp;

    if (floorCleared(r, r.floorNo)) {
      events.push({ type: "floorCleared", floorNo: r.floorNo });
    }
    if (runCompleted(r)) events.push({ type: "runCompleted" });
    return { run: r, events, exp };
  }

  /* Xuống tầng kế tiếp (chỉ khi tầng hiện tại đã sạch quái). */
  function descend(run) {
    if (!floorCleared(run, run.floorNo)) throw fail("Còn quái chưa hạ ở tầng này.", 409);
    if (run.floorNo >= floorsOf(run).length) throw fail("Đã ở tầng cuối.", 409);
    const r = clone(run);
    r.floorNo++;
    return r;
  }

  function useItem(run, item) {
    if (!["potion", "hint", "shield"].includes(item)) throw fail("Vật phẩm không hợp lệ.");
    if (!(run.items[item] > 0)) throw fail("Bạn không có vật phẩm này.", 409);
    const r = clone(run);
    if (item === "potion") {
      if (r.hearts >= C.hearts) throw fail("Tim đã đầy.", 409);
      r.items.potion--; r.hearts++;
    }
    if (item === "shield") { /* khiên được giữ trong túi, tự dùng khi sai (xem fight) */ throw fail("Khiên tự kích hoạt khi bị tấn công, không cần dùng tay.", 400); }
    if (item === "hint") r.items.hint--;
    return r;
  }

  /* Mở rương (idempotent): mỗi rương chỉ mở một lần, phần thưởng tất định theo seed. */
  function openChest(run, floorNo, chestIdx) {
    if (floorNo !== run.floorNo) throw fail("Rương không ở tầng hiện tại.", 409);
    const id = `${floorNo}:${chestIdx}`;
    if (run.chests.includes(id)) throw fail("Rương này đã mở.", 409);
    const loot = Core.chestLoot(run.seed, floorNo, chestIdx);
    const r = clone(run);
    r.chests.push(id);
    r.gold += loot.gold;
    if (loot.item) r.items[loot.item]++;
    return { run: r, loot };
  }

  function summary(run) {
    const total = run.questionIds.length;
    const stats = { total, firstTry: run.firstTry.length, assisted: run.assisted.length };
    return {
      ...stats, defeated: run.defeated.length, deaths: run.deaths, fights: run.fights,
      floors: floorsOf(run).length, floorNo: run.floorNo, medal: Core.medal(stats),
    };
  }

  /* Hoàn tất ván -> chỉ khi MỌI câu đã bị hạ. */
  function finish(run) {
    if (!runCompleted(run)) throw fail("Chưa hạ hết quái của bộ đề.", 409);
    const r = clone(run);
    r.status = "completed";
    return r;
  }

  return { planFloors, newRun, floorsOf, floorOfQuestion, isBoss, floorCleared, runCompleted, fight, descend, useItem, openChest, summary, finish };
});
```
### 7.3 `src/certificate.js`
```js
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
```
### 7.4 `scripts/test-dungeon.js`
```js
"use strict";
/* Kiểm thử lõi Mê cung kho báu (không mạng, không CSDL).  node scripts/test-dungeon.js */
const assert = require("assert");
const D = require("../src/dungeon-core");
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ✔", name); } catch (e) { fail++; console.log("  ✘", name, "\n     ", e.message.split("\n")[0]); } };

t("splitFloors: tổng đúng, chênh nhau tối đa 1, không tầng cuối lẻ loi", () => {
  for (const n of [12, 13, 25, 50, 100, 119, 120, 169]) {
    const f = D.splitFloors(n);
    assert.strictEqual(f.reduce((a, b) => a + b, 0), n);
    assert.ok(Math.max(...f) - Math.min(...f) <= 1, `n=${n} ${f}`);
    assert.ok(Math.min(...f) >= 6, `n=${n} có tầng quá nhỏ`);
  }
  assert.deepStrictEqual(D.splitFloors(169).length, 14);
});

t("splitSegments: <= trần thì một chặng; bộ 500 câu chia 3 chặng cân bằng", () => {
  assert.deepStrictEqual(D.splitSegments(169), [169]);
  assert.deepStrictEqual(D.splitSegments(200), [200]);
  assert.deepStrictEqual(D.splitSegments(500), [167, 167, 166]);
  assert.deepStrictEqual(D.splitSegments(201), [101, 100]);
  for (const n of [12, 199, 201, 650]) assert.strictEqual(D.splitSegments(n).reduce((a, b) => a + b, 0), n);
});

t("generateFloor: cùng seed ra cùng mê cung, khác seed ra khác", () => {
  const a = D.generateFloor({ seed: 7, monsters: 12 });
  const b = D.generateFloor({ seed: 7, monsters: 12 });
  const c = D.generateFloor({ seed: 8, monsters: 12 });
  assert.deepStrictEqual(a.grid, b.grid);
  assert.deepStrictEqual(a.monsters, b.monsters);
  assert.notDeepStrictEqual(a.grid, c.grid);
});

t("generateFloor: mọi ô lối đi đều tới được từ cổng vào (200 hạt giống × 4 cỡ tầng)", () => {
  for (const monsters of [6, 9, 12, 14]) {
    for (let seed = 1; seed <= 200; seed++) {
      const f = D.generateFloor({ seed, monsters, chests: 2 });
      for (let y = 0; y < f.size; y++) for (let x = 0; x < f.size; x++) {
        if (f.grid[y][x] === 0) assert.ok(f.dist[y][x] >= 0, `seed ${seed}: ô ${x},${y} không tới được`);
      }
    }
  }
});

t("generateFloor: đủ số quái, vị trí duy nhất, nằm trên lối đi, không đè cổng vào/cầu thang", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const monsters = 6 + (seed % 9);
    const f = D.generateFloor({ seed, monsters, chests: 2 });
    assert.strictEqual(f.monsters.length, monsters, `seed ${seed}`);
    const all = [f.start, f.stairs, ...f.monsters, ...f.chests].map((p) => p.x + "," + p.y);
    assert.strictEqual(new Set(all).size, all.length, `seed ${seed}: trùng vị trí`);
    [...f.monsters, ...f.chests, f.stairs].forEach((p) => assert.strictEqual(f.grid[p.y][p.x], 0));
    assert.strictEqual(f.monsters.filter((m) => m.boss).length, 1);
  }
});

t("generateFloor: cầu thang cách cổng vào đủ xa (>= cells) và số bước trung bình giữa các quái hợp lý", () => {
  let sum = 0, n = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const f = D.generateFloor({ seed, monsters: 12 });
    assert.ok(f.dist[f.stairs.y][f.stairs.x] >= f.cells, `seed ${seed}`);
    sum += f.dist[f.stairs.y][f.stairs.x]; n++;
  }
  assert.ok(sum / n < 80, "đường tới cầu thang quá dài: " + sum / n);
});

t("sizeFor: tầng 12 quái -> 6x6 ô; tầng nhỏ không dưới 5", () => {
  assert.strictEqual(D.sizeFor(12), 6);
  assert.strictEqual(D.sizeFor(2), 5);
  assert.strictEqual(D.sizeFor(200), 9);
});

t("chestLoot: tất định và có phân bố hợp lý", () => {
  assert.deepStrictEqual(D.chestLoot(5, 2, 0), D.chestLoot(5, 2, 0));
  const c = { potion: 0, hint: 0, shield: 0, none: 0 };
  for (let i = 0; i < 2000; i++) { const l = D.chestLoot(i, 1, 0); c[l.item || "none"]++; }
  assert.ok(c.potion > 500 && c.hint > 500 && c.shield > 200 && c.none > 100, JSON.stringify(c));
});

t("medal: ngưỡng vàng/bạc/đồng", () => {
  assert.strictEqual(D.medal({ total: 100, firstTry: 90, assisted: 0 }), "gold");
  assert.strictEqual(D.medal({ total: 100, firstTry: 90, assisted: 1 }), "silver"); // có Sách giải thì không vàng
  assert.strictEqual(D.medal({ total: 100, firstTry: 70, assisted: 5 }), "silver");
  assert.strictEqual(D.medal({ total: 100, firstTry: 70, assisted: 6 }), "bronze");
  assert.strictEqual(D.medal({ total: 100, firstTry: 10, assisted: 0 }), "bronze");
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
```
### 7.5 `scripts/test-dungeon-rules.js`
```js
"use strict";
const assert = require("assert");
const Core = require("../src/dungeon-core");
const R = require("../src/dungeon-rules");
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("  ✔", n); } catch (e) { fail++; console.log("  ✘", n, "\n     ", e.message.split("\n")[0]); } };
const ids = (n) => Array.from({ length: n }, (_, i) => "q" + (i + 1));
const fresh = (n = 24) => R.newRun({ seed: 11, questionIds: ids(n) });
const firstFloor = (run) => R.floorsOf(run)[0];
const nonBoss = (run) => firstFloor(run).find((q) => !R.isBoss(run, q));

t("newRun từ chối bộ quá nhỏ hoặc id trùng", () => {
  assert.throws(() => R.newRun({ seed: 1, questionIds: ids(5) }), /ít nhất/);
  assert.throws(() => R.newRun({ seed: 1, questionIds: ["a", "a", ...ids(20)] }), /trùng/);
});
t("planFloors: tất định, đủ mọi câu đúng một lần", () => {
  const a = R.planFloors(3, ids(37)), b = R.planFloors(3, ids(37));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a.flat().sort(), ids(37).sort());
});
t("trả lời đúng ngay: hạ quái, +10 EXP, tính vào firstTry", () => {
  const run = fresh(), q = nonBoss(run);
  const { run: r, exp, events } = R.fight(run, q, true);
  assert.strictEqual(exp, 10);
  assert.ok(r.defeated.includes(q) && r.firstTry.includes(q));
  assert.strictEqual(events[0].type, "defeated");
});
t("trùm: đúng nhân đôi EXP, sai mất 2 tim", () => {
  const run = fresh();
  const boss = firstFloor(run).find((q) => R.isBoss(run, q));
  assert.strictEqual(R.fight(run, boss, true).exp, 20);
  assert.strictEqual(R.fight(run, boss, false).run.hearts, 1);
});
t("sai rồi đúng: quái vẫn sống sau lần sai, hạ được ở lần đúng với +5 EXP và KHÔNG tính firstTry", () => {
  const run = fresh(), q = nonBoss(run);
  const a = R.fight(run, q, false);
  assert.ok(!a.run.defeated.includes(q) && a.run.hearts === 2);
  const b = R.fight(a.run, q, true);
  assert.strictEqual(b.exp, 5);
  assert.ok(b.run.defeated.includes(q) && !b.run.firstTry.includes(q));
});
t("sai lần thứ 3 -> Sách giải: quái bị hạ, assisted, không EXP", () => {
  let run = fresh(); const q = nonBoss(run);
  run = R.fight(run, q, false).run;
  run = R.fight(run, q, false).run;
  const last = R.fight(run, q, false);
  assert.ok(last.run.defeated.includes(q) && last.run.assisted.includes(q));
  assert.strictEqual(last.exp, 0);
  assert.ok(last.events.some((e) => e.type === "assisted"));
});
t("hết tim: ngất, hồi đầy tim, đếm deaths, quái đã hạ vẫn chết", () => {
  let run = fresh();
  const [a, b, c] = firstFloor(run).filter((q) => !R.isBoss(run, q));
  run = R.fight(run, a, true).run;
  run = R.fight(run, b, false).run;
  run = R.fight(run, b, false).run;
  const out = R.fight(run, c, false);
  assert.ok(out.events.some((e) => e.type === "knockedOut"));
  assert.strictEqual(out.run.hearts, Core.CONFIG.hearts);
  assert.strictEqual(out.run.deaths, 1);
  assert.ok(out.run.defeated.includes(a));
});
t("khiên chặn một đòn rồi biến mất", () => {
  const run = fresh(); run.items.shield = 1;
  const out = R.fight(run, nonBoss(run), false);
  assert.strictEqual(out.run.hearts, 3); assert.strictEqual(out.run.items.shield, 0);
});
t("dùng gợi ý: đúng chỉ +5 EXP nhưng vẫn là firstTry", () => {
  const run = fresh(), q = nonBoss(run);
  const out = R.fight(run, q, true, { hinted: true });
  assert.strictEqual(out.exp, 5); assert.ok(out.run.firstTry.includes(q));
});
t("không đánh được quái đã hạ, quái tầng khác, câu lạ", () => {
  const run = fresh(), q = nonBoss(run);
  const r = R.fight(run, q, true).run;
  assert.throws(() => R.fight(r, q, true), /đã bị hạ/);
  const other = R.floorsOf(run)[1][0];
  assert.throws(() => R.fight(run, other, true), /không ở tầng/);
  assert.throws(() => R.fight(run, "xxx", true), /không thuộc/);
});
t("xuống tầng chỉ khi sạch quái; hạ hết mọi tầng thì runCompleted và finish được", () => {
  let run = fresh(24);
  assert.throws(() => R.descend(run), /Còn quái/);
  assert.throws(() => R.finish(run), /Chưa hạ hết/);
  const floors = R.floorsOf(run);
  floors.forEach((f, i) => {
    f.forEach((q) => { run = R.fight(run, q, true).run; });
    assert.ok(R.floorCleared(run, i + 1));
    if (i < floors.length - 1) run = R.descend(run);
  });
  assert.ok(R.runCompleted(run));
  const done = R.finish(run);
  assert.strictEqual(done.status, "completed");
  const s = R.summary(done);
  assert.strictEqual(s.total, 24); assert.strictEqual(s.firstTry, 24); assert.strictEqual(s.medal, "gold");
  assert.throws(() => R.fight(done, "q1", true), /đã kết thúc/);
});
t("rương mở một lần, thưởng đúng như chestLoot; bình máu không vượt tim tối đa", () => {
  let run = fresh();
  const o = R.openChest(run, 1, 0);
  assert.deepStrictEqual(o.loot, Core.chestLoot(11, 1, 0));
  assert.throws(() => R.openChest(o.run, 1, 0), /đã mở/);
  assert.throws(() => R.openChest(run, 2, 0), /không ở tầng/);
  run.items.potion = 1;
  assert.throws(() => R.useItem(run, "potion"), /Tim đã đầy/);
  run.hearts = 1;
  assert.strictEqual(R.useItem(run, "potion").hearts, 2);
  assert.throws(() => R.useItem(fresh(), "hint"), /không có/);
});
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
```
### 7.6 `scripts/test-certificate.js`
```js
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
```
**Kết quả đã đo khi viết tài liệu:** `test-dungeon` 9 đạt · `test-dungeon-rules` 12 đạt · `test-certificate` 5 đạt, **0 lỗi**. Mô phỏng 200 hạt giống × 4 cỡ tầng: mọi ô lối đi đều tới được từ cổng vào; không có hai thứ trùng ô.

## 8. API (router `src/dungeon.js`)
Mọi endpoint nằm dưới middleware sẵn có nên dùng được `req.userId` (0 = Khách). Lỗi trả `{ "error": "<tiếng Việt>" }`. Dùng `asyncRoute` và `db.withTransaction` như phần còn lại của `server.js`.

| Endpoint | Việc | Lỗi chính |
|---|---|---|
| `GET /api/dungeon/status?file=ID` | `{eligible, reason?, total, segments:[{no, size, state:'none'\|'active'\|'completed', defeated, floorNo, floors, certificate?:{code,medal}}]}` — dùng cho thẻ trong màn bộ đề | `404` bộ đề của người khác |
| `POST /api/dungeon/start` `{fileId, segment=1}` | Tạo ván (hoặc **trả lại ván đang dở**) → `{run, floors, monsters}` (chỉ quái của tầng hiện tại, **không có đáp án**) | `400` bộ < 12 câu có thể chơi · `404` · `409` đã hoàn thành chặng này (kèm chứng chỉ) |
| `POST /api/dungeon/fight` `{runId, qid, choice, hinted?}` | **Server chấm** (`choice` là chỉ số đáp án **gốc**) → `{correct, answerIndex, events[], exp, run, explanation?}` | `404` ván · `409` quái đã chết/không ở tầng này/ván đã kết thúc · `400` `choice` ngoài 0–3 |
| `POST /api/dungeon/hint` `{runId, qid}` | Trừ 1 gợi ý, trả `{eliminate: <chỉ số sai>}` tất định | `409` không có gợi ý |
| `POST /api/dungeon/chest` `{runId, floorNo, idx}` | Mở rương → `{loot, run}` | `409` đã mở / sai tầng |
| `POST /api/dungeon/potion` `{runId}` | Dùng bình máu | `409` tim đầy / không có |
| `POST /api/dungeon/descend` `{runId}` | Xuống tầng → `{run, monsters}` | `409` còn quái |
| `POST /api/dungeon/finish` `{runId, holderName}` | Kiểm `R.finish` → cấp chứng chỉ → `{certificate, expBonus}` | `409` chưa hạ hết · `400` tên 2–40 ký tự · `503` thiếu `CERT_SECRET` |
| `POST /api/dungeon/abandon` `{runId}` | Bỏ ván (đặt `abandoned`) | |
| `GET /api/certificates` | Chứng chỉ **của tôi** | |
| `GET /api/certificates/verify/:code` | **Công khai**: `{valid, holderName, fileTitle, total, firstTryRate, medal, issuedAt, revoked}` — **không** lộ `user_id`/email | `404` mã lạ; giới hạn **30 lần/phút/IP** (bộ nhớ) |
| `GET /verify/:code`, `GET /certificate/:code` | Trang HTML nhỏ (kết quả kiểm tra) và trang in A4 | |

### 8.1 Thuật toán `fight` (giữ đúng thứ tự để tránh đua dữ liệu)
```js
await db.withTransaction(async (client) => {
  // 1) KHÓA dòng ván để hai lần bấm gần nhau không chấm đôi
  const row = (await client.query(
    `SELECT id, state, file_id FROM dungeon_runs WHERE id=$1 AND user_id=$2 AND status='active' FOR UPDATE`,
    [runId, req.userId])).rows[0];
  if (!row) throw Object.assign(new Error("Không tìm thấy ván đang chơi."), { status: 404 });

  // 2) Đọc đáp án thật từ CSDL, KHÔNG nhận từ client
  const q = (await client.query(`SELECT answer_index, explanation, explanation_status FROM questions WHERE id=$1`, [qid])).rows[0];
  const correct = Number(choice) === q.answer_index;

  // 3) Luật thuần (ném lỗi 409/400 nếu sai quy tắc)
  const out = Rules.fight(row.state, qid, correct, { hinted });

  // 4) Ghi trạng thái + nhật ký + attempts/wrong_answers (cùng giao dịch)
  await client.query(`UPDATE dungeon_runs SET state=$2, updated_at=now() WHERE id=$1`, [row.id, out.run]);
  await client.query(`INSERT INTO dungeon_fights (run_id, question_id, choice, correct, hinted, floor_no) VALUES ($1,$2,$3,$4,$5,$6)`, [...]);
  await client.query(`INSERT INTO attempts (question_id, correct, mode, exp_gained, user_id) VALUES ($1,$2,'dungeon',$3,$4)`, [qid, correct, out.exp, req.userId]);
  // wrong_answers: copy đúng logic của route /api/answer hiện có (xóa khi đúng, +1 khi sai)
});
```
Trả `answerIndex` **sau khi chấm** (để hiện đáp án đúng); **không** trả trước. Với câu `explanation_status = 'disputed'` giữ nguyên quy tắc hiện có (không tự mở).
**`POST /api/answer` không được gọi thêm từ client** ở chế độ này — server đã ghi `attempts`; client chỉ cộng EXP vào tiến độ bằng đường sẵn có (`POST /api/progress`) với giá trị `exp` server trả về.

### 8.2 Chọn câu cho ván
```sql
SELECT q.id, q.question, q.options, q.passage, q.topic, q.number
FROM questions q JOIN source_files s ON s.id = q.file_id
WHERE s.id = $1 AND s.owner_id = $2
  AND q.status <> 'review'
  AND q.qtype IN ('mcq','passage_mcq')
  AND coalesce(array_length(q.options,1),0) = 4 AND q.answer_index BETWEEN 0 AND 3
ORDER BY q.number NULLS LAST, q.id;
```
* Bỏ câu có đáp án trùng nhau (giống điều kiện của Săn vịt).
* Câu nghe (`audio_mcq`) và câu không có A–D **không vào** giai đoạn này (mục 11).
* Chặng: `Core.splitSegments(n)` rồi lấy đoạn thứ `segment` theo thứ tự trên. `snapshot = sha256(ids đã sắp xếp)`.
* `seed` = số ngẫu nhiên 32 bit do server tạo khi bắt đầu ván.

## 9. Giao diện (`dungeon.js` + chỗ nối trong `template.html`)
### 9.1 Giao diện lập trình của engine
```js
window.DungeonGame = {
  mount(container, opts),   // opts: { adapter, deck:{key,title}, settings, explainHtml, onExp(n), onExit() }
  unmount(),
};
// adapter (cùng một hình dạng cho online và offline)
// getStatus(deckKey) · start(deckKey, segment) · fight(runId, qid, choice, {hinted}) · hint(runId, qid)
// chest(runId, floorNo, idx) · potion(runId) · descend(runId) · finish(runId, holderName) · abandon(runId)
```
* **Adapter online** gọi `/api/dungeon/*`. **Adapter offline** giữ `run` trong `localStorage` (khóa `toeic.dungeon.<deckKey>`), dùng `DungeonRules` ngay trong trình duyệt và **có** đáp án (`q.a`) vì không có server.
* **Đặt quái lên mê cung (quy ước bắt buộc, để client và server khớp):** với tầng `n`, lấy `floors = Rules.planFloors(seed, questionIds)[n-1]`; `layout = Core.generateFloor({seed: Core.hash32(seed+'|'+n), monsters: floors.length, chests: floors.length >= 12 ? 2 : 1})`. Quái được đánh dấu `boss` trong `layout.monsters` nhận **câu cuối** của `floors`; các quái còn lại nhận lần lượt các câu còn lại theo thứ tự `layout.monsters`.
* Vị trí nhân vật **không lưu**; mở lại ván thì về `layout.start` của tầng hiện tại, sương mù mở lại từ đầu.

### 9.2 Bố cục màn chơi
```
┌ ← Thoát · ❤️❤️❤️ · Tầng 3/14 · Quái còn 7 · 🧪1 🔍0 🛡1 · 🪙140 ─────── +0 EXP ┐
│                                                                                  │
│                 [ canvas mê cung — vuông, to hết cỡ, sương mù ]                   │
│                                                                                  │
├ ←↑↓→/WASD đi · chạm ô để tự đi · E mở rương/xuống thang · H gợi ý · P dừng · M tiếng ┤
```
* Canvas **vuông, co theo khung** (dùng lại cách `duck.js` tính kích thước và `devicePixelRatio ≤ 2`). Khung chơi **lớn** như Săn vịt (toàn màn hình bằng phím `F`).
* Chỉ **vẽ lại khi có thay đổi** (theo từng bước); dùng `requestAnimationFrame` chỉ trong lúc nhân vật trượt giữa hai ô (~120 ms; **0 ms** khi giảm chuyển động).
* Mê cung dùng **bảng màu tối cố định** (nền `#070b14`, sàn `#202b42`, tường `#4a5a7a`, vàng `#e8b21a`) để tương phản rõ ở cả chế độ sáng lẫn tối; vạch chéo mờ + khung hầm giúp thấy phạm vi bản đồ dù sương còn dày.

### 9.3 Hình vẽ (không dùng ảnh ngoài)
| Thứ | Hình | Ghi chú |
|---|---|---|
| Nhân vật | 🧙 | Phông `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif` |
| Quái theo chủ điểm | Thì ⏳ · Từ loại 🐍 · Giới từ 🦇 · Đại từ 🕷️ · Từ vựng 🐲 · khác 👾 | **Bảng này nằm trong một hằng `MONSTER_BY_TOPIC` để đổi được**; kèm **chữ cái đầu chủ điểm** dưới quái để không chỉ dựa vào hình/màu |
| Trùm | 👹, viền vàng, kích thước ×1,3 | |
| Rương / kho báu / cầu thang | 🧰 / 💰 / 🪜 | Rương đã mở đổi thành 📭 |
| Tường, sàn | Hình chữ nhật | Sương mù: ô chưa thấy = tối hẳn (`#070b14`); ô thấy nhưng chưa đi = tối hơn; ô đã đi = sáng hơn; **bán kính nhìn 4 ô**; mặt tường sát lối đi cũng hiện để thấy hình mê cung |

### 9.4 Hộp thoại trận đánh (HTML, không vẽ trong canvas)
* `role="dialog" aria-modal="true"`, tiêu đề `Quái Thì · câu 7/12 · tầng 3` (trùm thêm `⚔️ TRÙM ×2`).
* Đề (kèm `passage` nếu có, cuộn được) + 4 nút đáp án **đảo thứ tự**; phím `1`–`4` chọn; `Enter` sang bước kế; `Esc` **không** đóng được (tránh bỏ trận giữa chừng) — nút **"Lùi lại"** cho phép rút lui không mất gì khi chưa chọn.
* Sau khi chọn: tô đúng/sai kèm **ký hiệu ✓/✗ và chữ** (không chỉ màu), hiện `+EXP`, `−❤️`, rồi dựng khối 💡 bằng **hàm `explainHtml(q, correct ? "right" : "wrong")` sẵn có** (tự mở khi sai, thu gọn khi đúng, `disputed` chỉ mở khi bấm) và **khối Gia sư AI chỉ gọi khi bấm** — **không** thêm bất kỳ lời gọi AI tự động nào.
* Vùng thông báo `aria-live="polite"`; khi mở hộp thoại, đưa tiêu điểm vào nút đáp án đầu; đóng thì trả tiêu điểm về canvas.

### 9.5 Trợ năng và điều khiển
| Mục | Yêu cầu |
|---|---|
| Bàn phím | Mũi tên/`WASD` đi; `E` mở rương hoặc xuống thang; `H` gợi ý; `P` dừng; `M` tiếng; `F` toàn màn hình; **toàn bộ chơi được không cần chuột**. Phím không ăn thì bấm nút mũi tên (dòng nhắc hiện khi vào ván); đâm vào tường luôn có thông báo thay vì im lặng |
| Điện thoại | Vuốt để đi; **chạm vào ô** để tự đi tới đó (BFS, dừng khi gặp quái/rương); D-pad nổi **bật sẵn** khi màn hẹp `< 720 px`, thiết bị chạm (`pointer: coarse`) hoặc còn ≥ 352 px chỗ trống hai bên canvas — vẫn tắt/mở được trong cài đặt; mục chạm ≥ 44 px |
| Giảm chuyển động | Theo `prefers-reduced-motion` **và** công tắc trong cài đặt: nhân vật nhảy từng ô, không rung, không hoạt ảnh mở rương |
| Chữ lớn | Dùng chung công tắc *Chữ lớn* của Săn vịt nếu có (`localStorage`), áp lên hộp thoại trận đánh |
| Không nhấp nháy | Không hiệu ứng chớp quá 3 lần/giây; không đếm giờ |
| La bàn | Khi còn ≤ 20% quái của tầng, hiện mũi tên ➜ chỉ quái gần nhất theo đường đi (tránh lạc) |
| Âm thanh | Web Audio tổng hợp, chỉ tạo `AudioContext` sau tương tác đầu tiên; dùng chung khóa tắt tiếng `toeic.mute` |
| Tạm dừng | Tự dừng khi ẩn tab/xoay màn hình; trận đánh đang mở thì giữ nguyên |

### 9.6 Chỗ nối trong `template.html` (tối thiểu)
1. Thêm `<script>/*__DUNGEON__*/</script>` cạnh chỗ nhúng `duck.js`.
2. Trong màn bộ đề (cạnh khối **🧠 Trò chơi theo kỹ năng**) thêm thẻ **🗝️ Mê cung kho báu — vượt N tầng, mở rương nhận chứng chỉ**: hiện `Tầng 3/14 · 41/169 quái đã hạ` khi có ván dở, nút **Tiếp tục / Chơi mới / Xem chứng chỉ**. Bộ có **< 12 câu có thể chơi** thì ẩn thẻ (giống cách các trò kỹ năng ẩn khi thiếu câu).
3. Nút thoát gọi `goBackToDeck()` có sẵn.
4. Hàm `isPlayable(q)` **dùng nguyên**; thêm điều kiện 4 đáp án khác nhau ở phía server (mục 8.2).

## 10. Chứng chỉ
### 10.1 Nội dung bắt buộc
Tiêu đề **CHỨNG CHỈ HOÀN THÀNH** · tên người nhận · *"đã chinh phục hầm* **«<tên bộ đề>»** *(Chặng k/m nếu có)"* · số câu, **số tầng**, tỉ lệ đúng ngay lần đầu, huy chương 🥇🥈🥉 · ngày bắt đầu → ngày hoàn thành · **mã `TC-XXXX-XXXX-XXXX`** + địa chỉ kiểm tra `…/verify/<mã>` · dòng *"Chứng chỉ tự học do ứng dụng cấp, không phải chứng chỉ TOEIC chính thức."* Bản offline thay mã bằng *"Bản luyện tập — chưa xác thực"*.

### 10.2 Kết xuất
* **PNG:** vẽ bằng Canvas 2D (1600×1131 ≈ A4 ngang), tải bằng `canvas.toBlob` + thẻ `<a download>`. Văn bản dài (tên bộ đề) **tự xuống dòng tối đa 2 dòng** rồi cắt có dấu `…`. Phải thử với tên có dấu tiếng Việt và 60 ký tự.
* **PDF:** trang `/certificate/:code` dùng `@page { size: A4 landscape; margin: 0 }`, nút **In / Lưu PDF** gọi `window.print()`. Không thêm thư viện PDF.
* **Tên người nhận:** 2–40 ký tự, cắt khoảng trắng đầu/cuối; mặc định điền biệt danh tài khoản. Luôn **thoát HTML** khi chèn vào trang, và dùng `fillText` (không `innerHTML`) khi vẽ canvas. **Không** cho đổi tên sau khi cấp (đổi = thu hồi + cấp lại là việc của giai đoạn sau).

### 10.3 Xác thực
`certificate.makeCode({runId, userId, fileTitle, holderName, total, firstTry, assisted, issuedAt})` — mã là **HMAC-SHA256** rút gọn 12 ký tự, bảng chữ bỏ `I L O U 0 1`. Trang xác thực **tính lại mã từ bản ghi** và so khớp bằng `sameCode` (hằng thời gian); khớp thì hiện *"Hợp lệ"* kèm thông tin, ngược lại *"Không tìm thấy"*. `revoked = true` hiện *"Đã bị thu hồi"*. **Không** trả `user_id`/email.

## 11. Ngoài phạm vi giai đoạn này (để dành)
| Hạng mục | Vì sao hoãn |
|---|---|
| Chế độ thi (không trả `a` ở `/api/questions` cho bộ đang chơi) | Đụng nhiều chỗ của game hiện có |
| Trùm có **trò nhỏ** riêng (Tìm lỗi sai, Sắp xếp…) tái dùng `skill-extra.js` | Cần nối adapter của từng trò kỹ năng |
| Câu không phải A–D, câu nghe (`audio_mcq`) | Cần giao diện trận đánh riêng |
| Quái **đi lại**, bẫy, cửa khóa/chìa | Dễ biến thành áp lực thay vì học |
| Chứng chỉ **cả file** khi đủ mọi chặng; đổi tên có kiểm soát; QR trên giấy | Cần thêm bảng/luật |
| Cửa hàng vàng, trang phục, bảng xếp hạng chứng chỉ | Chưa cần để đạt mục tiêu |

## 12. Kiểm thử
### 12.1 Tích hợp (`scripts/test-dungeon-api.js`, chạy trên server thật + CSDL thử, 0 token)
| # | Ca | Mong đợi |
|---|---|---|
| 1 | `start` bộ 5 câu | `400` "cần ít nhất 12 câu" |
| 2 | `start` hai lần liên tiếp | **cùng một ván** (không tạo thêm), `seed` giữ nguyên |
| 3 | Phản hồi `start`/`fight`/`descend` | **không có** trường `a`/`answer_index` trong câu hỏi của quái |
| 4 | `fight` đúng ngay lần đầu | `exp = 10`, trùm `20`, `attempts` +1 với `mode='dungeon'`, `wrong_answers` bị xóa |
| 5 | `fight` sai | tim −1 (trùm −2), có `answerIndex`, `wrong_answers` +1, quái chưa chết |
| 6 | Sai 3 lần cùng câu | quái chết, sự kiện `assisted`, `exp = 0` |
| 7 | Mất hết tim | sự kiện `knockedOut`, tim về 3, `deaths = 1` |
| 8 | Gửi **hai `fight` song song** cùng quái | chỉ **một** thành công, cái kia `409`; `attempts` chỉ +1 |
| 9 | `fight` quái tầng khác / quái đã chết / `choice` = 7 | `409` / `409` / `400` |
| 10 | `chest` hai lần cùng rương | lần hai `409`; phần thưởng khớp `chestLoot(seed, tầng, idx)` |
| 11 | `descend` khi còn quái | `409` |
| 12 | `finish` khi chưa hạ hết | `409` |
| 13 | Hạ hết → `finish` tên "Nhu San" | có `certificate.code` hợp lệ, `status='completed'`, EXP thưởng đúng huy chương |
| 14 | `verify/<mã>` | `valid: true`, **không** có `user_id`/email; mã sai → `404` |
| 15 | Sửa trực tiếp `holder_name` trong CSDL rồi `verify` | **không còn hợp lệ** (mã không khớp) |
| 16 | `finish` lần hai cùng ván | `409`, không cấp trùng; chơi lại cùng bộ đề → trả chứng chỉ cũ |
| 17 | Xóa bộ đề (`DELETE /api/files/:id`) | ván dở biến mất; **chứng chỉ vẫn còn** và `verify` vẫn đúng |
| 18 | Tài khoản B gọi với `runId` của A | `404` |
| 19 | Khách (`user_id 0`) chơi rồi đăng ký | ván và chứng chỉ chuyển sang tài khoản mới |
| 20 | `verify` 31 lần trong 1 phút | lần thứ 31 `429` |
| 21 | Thiếu `CERT_SECRET` | `finish` trả `503` **sau khi** ván vẫn giữ nguyên, không mất tiến độ |

### 12.2 Thủ công trên trình duyệt (Chrome + 360 px)
| # | Ca | Mong đợi |
|---|---|---|
| 22 | Bộ ≥ 12 câu | Thẻ 🗝️ hiện; bộ < 12 câu ẩn thẻ |
| 23 | Đi bằng mũi tên, `WASD`, vuốt, chạm ô xa | Nhân vật đi đúng, **không xuyên tường**, tự dừng khi gặp quái/rương |
| 24 | Chạm quái | Hộp thoại mở, tiêu điểm vào đáp án đầu; `Esc` không đóng; "Lùi lại" đóng được |
| 25 | Đánh lại cùng quái sau khi sai | **Thứ tự đáp án khác**, vẫn chấm đúng |
| 26 | Trả lời sai câu có giải thích | Khối 💡 **tự mở**; câu `disputed` **không** tự mở; **0** lời gọi AI trong tab Network nếu không bấm |
| 27 | Hạ hết quái tầng | Cầu thang mở; `E` trên thang → tầng mới; sương mù mới |
| 28 | Tắt tab giữa tầng 3 rồi mở lại | Tiếp tục **đúng tầng 3**, quái đã chết vẫn chết |
| 29 | Hết tim | Thông báo ngất, về cổng vào, tim đầy, **không mất quái đã hạ** |
| 30 | Màn 360 px, chế độ tối, giảm chuyển động | Không tràn ngang, đọc được, không hoạt ảnh |
| 31 | Chỉ dùng bàn phím từ đầu đến hết một tầng | Hoàn tất được (không cần chuột) |
| 32 | Trình đọc màn hình (NVDA) trong trận đánh | Đọc tiêu đề, đề, kết quả đúng/sai |
| 33 | Mở `toeic-game.html` bằng file (không server) | Chơi được, chứng chỉ ghi **chưa xác thực**, không gọi mạng |
| 34 | Hạ cả tầng cuối → rương kho báu | Hiện ô nhập tên (mặc định biệt danh) → chứng chỉ; **Tải PNG** ra ảnh đọc được tiếng Việt; **In → PDF** đúng một trang A4 ngang |
| 35 | Mở `/verify/<mã>` ở cửa sổ ẩn danh (chưa đăng nhập) | Thấy kết quả hợp lệ, không lộ email |

### 12.3 Đo hiệu năng
Mê cung 21×21 ô trên điện thoại tầm trung: **mỗi bước vẽ < 8 ms**, không rò bộ nhớ sau 200 bước (đo bằng `performance.now()`), kích thước thêm vào `toeic-game.html` **< 60 KB** (chưa nén).

## 13. Tiêu chí hoàn thành và quay lại
* `npm test` **0 lỗi** (các nhóm cũ + 3 nhóm mới); `scripts/test-dungeon-api.js` đạt 21 ca.
* Chơi trọn một bộ 24 câu từ đầu đến chứng chỉ trên server, và một lần offline.
* Không có lời gọi AI nào phát sinh nếu người chơi không bấm nút Gia sư AI.
* `/api/dungeon/*` **không** gửi đáp án xuống trình duyệt khi đang chơi.
* **Quay lại:** gỡ thẻ trong `template.html` và dòng nhúng `/*__DUNGEON__*/`; bỏ `app.use` của router. Ba bảng mới **không ảnh hưởng** phần còn lại (có thể giữ nguyên dữ liệu).

## 14. Rủi ro còn lại
| Rủi ro | Mức | Cách giảm |
|---|---|---|
| `/api/questions` vẫn lộ đáp án nên chứng chỉ không chống được người cố tình gian lận | Trung bình | Nói rõ ở mục 2.4 và trên giấy; làm "chế độ thi" ở giai đoạn sau |
| Người chơi thấy đi mê cung chậm so với Săn vịt | Trung bình | Chạm-để-đi, mê cung nhỏ, la bàn; đo "giây đi bộ / giây suy nghĩ" khi thử thật và chỉnh `braid`, kích thước |
| `dungeon.js` phình to | Thấp | Giữ ở file riêng; trận đánh là hộp thoại HTML đơn giản |
| Emoji hiển thị khác nhau giữa máy | Thấp | `MONSTER_BY_TOPIC` đổi được; kèm chữ cái chủ điểm |
| Qoder sửa test cho đạt | Trung bình | Quy ước mục 0; yêu cầu báo cáo kết quả từng mốc |

## 15. Điều cần bạn xác nhận (đã có mặc định, đổi được)
| # | Câu hỏi | Mặc định đã chọn |
|---|---|---|
| 1 | Tên chế độ | **🗝️ Mê cung kho báu** |
| 2 | Số quái mỗi tầng / số tim | 12 / 3 (`CONFIG.questionsPerFloor`, `CONFIG.hearts`) |
| 3 | Sách giải sau mấy lần sai | Lần thứ **3** (`CONFIG.maxRespawn = 2`) |
| 4 | Trần câu mỗi chặng | **200** (`CONFIG.maxQuestionsPerRun`) |
| 5 | EXP thưởng khi hoàn thành | Vàng 100 · Bạc 60 · Đồng 30 |
| 6 | Chứng chỉ cho Khách (chưa đăng nhập) | **Có**, nhưng người chơi phải nhập tên; nên khuyên đăng ký để không mất |
| 7 | Có cho chơi lại bộ đề đã có chứng chỉ không | **Có**, nhưng **không cấp thêm** chứng chỉ cho cùng nội dung |
