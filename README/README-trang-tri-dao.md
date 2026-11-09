# 🎨🏝️ Trang trí và cá nhân hóa đảo — mua đồ bằng xu, bố trí tự do, chụp ảnh đảo

> **Loại tài liệu:** đặc tả thiết kế + nhật ký triển khai.
> **Trạng thái 05/11/2026:** **D0 → D6 đã ship** (hình học dùng chung + lõi trang trí thuần + 5 bảng CSDL và 6 route API + **tab 🎨 Trang trí** trong trình duyệt: 12 món dựng tay, bóng xem trước xanh/đỏ kèm lý do, bản nháp Lưu/Hủy, hoàn tác, bàn phím và cảm ứng, thú né vật cản + **bảng Phong cách 15 tùy chọn trên 4 nhánh áp thẳng vào cảnh 3D**, 4 kiểu hạt thời tiết, 🪫 Tiết kiệm che món phẳng và tắt hạt, **⏱ đo khung hình thật**, đóng băng tuyệt đối khi bật giảm chuyển động, chế độ tối đạt tương phản WCAG + **D5: 📷 chế độ chụp ảnh xuất PNG chỉ chạy ở máy người chơi, 8 gói chủ đề × 4 món, 4 công trình lớn có hình dựng riêng, `decor_wish` + `PUT /decor/wish`** + **D6: mục 5 viết lại bằng số ĐO THẬT — thu nhập THẬT **trung vị 11 xu/ngày** (3 người · 8 ngày-học, đến 05/11), một đảo đầy 40 món đo được 120 … 4.410 xu (trung vị 1.480), `xu_spend` thật **31 dòng / 401 xu** và **6/6 dòng trang trí chia đúng cho giá niêm yết**; không đổi một giá nào vì mẫu chưa tới ngưỡng**). **Còn lại:** những thứ ghi ở mục 14 (câu 1, 2, 4, 5 vẫn chờ chốt) và kéo-thả món thẳng trong 3D.
> **Nền đã có:** trang `public/quan-dao-vo-tan-three.html` nối máy chủ thật (từ đợt này **1.348 dòng / 120.358 byte**, **7 tab**); luật nằm ở `src/island-core.js` (dùng chung server và trang); API `src/island.js` tại `/api/islands`; ví một xu `town_state.xu`; màu chung (sáng/tối) nằm ở `public/demo-core.css`; lõi 3D dùng chung `public/demo-core-three.js` (`window.D3`); bộ kiểm thử `test-island-core.js` (21 ca), `test-island-api.js` (18 ca, PostgreSQL thật), `test-decor-core.js` (8 ca), `test-decor-api.js` (**19 ca**, PostgreSQL thật), và `QD.selfCheck()` trong trang nay có **17 mục** (thêm 2 mục của D3, 4 mục của D4 và 4 mục của D5).
> **Không đổi nguyên tắc nền:** đồ trang trí **chỉ là hình ảnh**, không tạo sức mạnh, không mở khóa câu hỏi, không đổi điểm hay lịch ôn; **không có đường nào làm người chơi mất xu, đồ hay đảo** ngoài lúc **chủ động tiêu xu**.

## 0. Đã làm gì ở D0 → D6 (số thật, đo ngày 04–05/11/2026)

**D0 — dời hình học sang lõi dùng chung.** `hash`, `rand`, `edgeOf`, `genIsland`, `walkable`, `pickSpot`, `doorSpot`, `treeSpot` và khối `GEO` giờ nằm trong `src/island-core.js`; trang 3D chỉ còn nạp `IC = IslandCore` và bỏ hẳn bản sao của nó (mảng `feo` riêng của trang đã xóa — bán kính ô đất đến từ một chỗ duy nhất là `CONFIG.themes[].feo`).
Chứng minh không đổi hành vi: `genIsland` cho ra **từng chữ số giống hệt** trên 200 đảo, `walkable` giống hệt trên 20.000 điểm × 5 biên độ, cửa Nhà/gốc Cây giống hệt; `test-island-core.js` **21/21** và `test-island-api.js` **18/18** vẫn đạt, trang chạy như cũ.

**D1 — lõi trang trí** (catalog + 9 luật đặt đồ + flood fill + ngân sách), cũng thuần, 0 CSDL, 0 token.

| Số giả định trong bản đặc tả đầu | Giá trị THẬT đã thay |
|---|---|
| bán kính ô đất 1,4 (mọi ô) | Nhà **1,85** · Cây **1,15** · ba ô công trình theo chủ đề: `CONFIG.themes[].feo` = `0,7…2,0` |
| bán kính thú 0,35 | **0,35** (đúng, giờ là `GEO.petR`) |
| cách mép nước | `GEO.edge` = **0,7** + `r` món + `petR` |
| khoảng trống hai món chặn 1,0 | giữ **1,0** (`DECOR.gap`) |
| cách tâm ô đất thêm 0,9 | giữ **0,9** (`DECOR.slotGap`) |
| vùng cấm quanh bát/cửa nhà 1,2 | giữ **1,2** (`DECOR.noGo`); vị trí thật lấy từ `doorSpot(L)` và món có `petSpot:"bowl"` |
| "flood fill khoảng 8 nghìn ô" | **4.900 → 8.100 ô** tùy bán kính đảo (r = 8…11, lưới 0,25); đảo 1 là 70×70 = 4.900 ô, 2.013 ô đi được |

Kết quả đo lại thí nghiệm đặt đồ bằng chính `canPlace` thật (`npm --prefix json run decor:sim`):

| Thí nghiệm | Số đảo | Món chặn đặt được TB | Nhỏ nhất | Trung bình | Đảo dưới 98% | Đảo bị **đồ làm tệ hơn** mức đảo trống |
|---|---|---|---|---|---|---|
| **A.** Chỉ luật khoảng cách 1–8 | 2.000 | 12,0 | **98,68%** | 99,94% | **0** | **0** |
| **B.** Thêm luật 9 (flood fill) | 200 | 12,0 | 99,46% | 99,94% | **0** | **0** |
| Kiểm thử ca 6 (`test-decor-core.js`) | 500 | 12,0 | 98,99% | — | **0** | **0** |

Bản nháp đo trên số giả định báo **11/2.000 đảo bị chia cắt, xấu nhất 92,81%**. Trên hình học thật con số đó là **0**. Lý do nằm ở một bất biến: luật 5 cấm hai món chặn cách tâm nhỏ hơn `r₁ + r₂ + 1,0`, trong khi vùng cấm của thú là `r + 0,35` quanh mỗi món — vậy khe giữa hai món chặn sát nhau nhất luôn rộng `1,0 − 2 × 0,35 =` **0,3**, vừa đủ cho thú lách qua. Nên **riêng luật khoảng cách không đủ sức niêm kín một túi**; 11 đảo lọt lưới của bản nháp nhiều khả năng đến từ ô đất giả định `r = 1,4` (hẹp hơn ob thật 1,85 của ô Nhà), khiến vành cấm quanh ô đất mỏng đi. **Luật 9 vẫn được giữ** và vẫn chạy mỗi khi món đặt có khả năng siết cổ chai, vì nó là chốt chặn cho D4 (nếu hạ `gap` để nhồi nhiều đồ hơn) và cho bố cục người chơi tự xếp — thứ mà random không đại diện hết; ca 5 chứng minh vòng đá xếp cố ý **vẫn** bị phát hiện. Luật 9 hoàn toàn không tốn chỗ đặt: 12 món chặn/đảo ở cả hai nhánh A và B.

**Chi phí thời gian:** flood fill nguyên bản (mảng 2 chiều + `Set`) mất 13,5 s cho 500 đảo. Bản hiện tại dùng `Uint8Array` + `Int32Array` và **chỉ chạy khi món đặt có thể siết cổ chai** (`mayPinch`: gần vành ô đất, gần món chặn khác, hoặc gần bờ) — kết quả **giống hệt từng chữ số** (max diff 0) và còn **~15 s** cho ca 6, ~1 s khi bỏ ca 6.

**D2 — dữ liệu + API.** Bốn bảng mới trong `CSDL/island.sql` (`decor_owned`, `decor_placed`, `island_style`, `style_owned`) tự tạo khi server khởi động, Khách (`user_id = 0`) dùng được ngay; năm route mới trong `src/island.js` (`GET /decor`, `POST /decor/buy`, `PUT /decor/layout`, `POST /style/buy`, `POST /style`) và `transferGuestData` chuyển **7 bảng** của Khách sang tài khoản mới trong cùng giao dịch đăng ký (`src/auth.js`). `scripts/test-decor-api.js` chạy Express + PostgreSQL thật trên schema tạm `decor_test`: **15/15 ca đạt**, và `test-island-api.js` vẫn **18/18** sau khi thêm bảng. Ba điều học được khi làm thật, đã sửa ngay:
- **Luật 2 phải trừ theo từng đảo** — ngân sách của một lần lưu là `đã mua − đang đặt ở ĐẢO KHÁC`, không trừ đồ của chính đảo đang lưu, nếu không thì *cất một món về kho* cũng báo "vượt số đã mua" (ca 18).
- **`layout_ver` chỉ tăng khi lưu thành công** — bản đầu dùng `INSERT … ON CONFLICT` trước khi kiểm luật nên một cú `PUT` sai để lại dòng phong cách "ma" có phiên bản 0; nay đọc bằng `SELECT` thường và chỉ ghi khi mọi luật đã qua (ca 17).
- **Sai nhánh là `400`, chưa mở là `409`** — `applyStyle` vốn hỏi điều kiện mở khóa trước, nên gửi `tod: "w_rain"` (khóa thời tiết nhét nhầm vào nhánh giờ) báo "chưa mở" dù mua cũng không dùng được; thứ tự kiểm đã đổi (ca 19).

**D3 — chế độ trang trí trong trình duyệt** (tab 🎨, không thêm luật mới, không thêm bảng nào).

| Phần đã ship | Chi tiết thật |
|---|---|
| **Tab thứ bảy 🎨 Trang trí** | `pDecor()` + 7 tab; rời tab / du thuyền khi còn nháp thì **hỏi lại** (`withDecGuard`), đóng tab cũng hỏi (`beforeunload`) |
| **Khay đồ** | đủ **62 món** theo **12 nhóm** ở D3, nay **78 món / 16 nhóm** (8 nhóm chung + 8 gói chủ đề) sau D5, giá/điều khóa đọc từ `IslandCore` — giao diện không viết tay con số nào; mỗi thẻ hiện `đã có ×N · còn đặt được ×N` và ba nút **Mua · Đặt · Thêm vào đảo** (D5 thêm nút **⭐ Ước**) |
| **Dựng hình** | **12 món an toàn** dựng tay (7 món phẳng lớp W + 5 món chặn nhỏ: `rock_small`·`sapling`·`lantern`·`fence` lớp S, `bush` lớp M; giá **3–10 xu**), đếm thật bằng hook `Object3D.add`: **nhiều nhất 9 khối** (Luống hoa), số đông **3–5 khối**; **đèn chỉ dùng `emissive` — không `PointLight`**; **50 món còn lại** (4 gói chủ đề, hiệu ứng, công trình lớn XL) qua khuôn `decGeneric` — **cả 62 món dựng được, 0 ném lỗi**. *(D5 nâng lên **16 món dựng tay** — thêm 4 công trình lớn — và **78/78 món dựng được**; số liệu ở khối D5 dưới đây)* |
| **Bóng xem trước** | đĩa + vòng bám lưới 0,25, **xanh `#46d37f` / đỏ `#e5484d`**, dòng lý do **`aria-live`** chính là `{ok, reason}` của `canPlace`; món W không có vật cản nên `blockersOf` vẫn trả về đúng 0 mục |
| **Bản nháp** | đặt · xoay 8 hướng · nhích 0,25 · cất vào kho · **Hoàn tác/Làm lại** (history 60 bước) — tất cả **không trừ xu**; chỉ **Mua** mới tiêu và luôn qua `D3.confirm` |
| **Lưu / Hủy** | một cú `PUT /decor/layout` với `baseVersion` đọc từ view; `409` thì nháp **còn nguyên** để sửa tiếp (đo thật: giả `baseVersion` cũ → 409, `decor_placed` và `layout_ver` đứng nguyên); máy chủ đã chứng minh từ trước (ca 15/16) |
| **Bàn phím / cảm ứng** | 5 khu vực (**Sân nhà · Quanh cây · Lối đi · Ngoài rìa · Bờ nước**) + nút **Thêm vào đảo** tự tìm chỗ hợp lệ gần tâm khu nhất; `R` xoay · 4 phím mũi tên nhích · `Delete` cất; nút bấm ≥ 44 px theo `demo-core.css` |
| **Thú né vật cản** | `BLK = blockersOf(L3, DEC.items)` truyền vào **9 lời gọi** `walkable`/`pickSpot` (trên 8 dòng: đích lúc sinh, `moveTo`, thoát kẹt, nghỉ→đi, thôi theo sau, `callPets`, `VISIT.play`) — đảo trống thì `BLK` rỗng, hành vi thú **y hệt trước** |
| **`QD.selfCheck()` 9 mục** | thêm (a) 62/62 món dựng được; (b) **12/12 món chặn** xếp bằng `canPlace` thật + 2.000 đích `pickSpot` **0 điểm nằm trong vật cản**, đảo còn **99,8%** đi được |

Kiểm bằng DOM trong trình duyệt thật (không ảnh chụp màn hình), đối chiếu cả CSDL: mua 🌿 bụi cỏ **16 → 13 xu, trừ đúng một lần**; bấm **Hủy** ở hộp xác nhận thì ví **5 → 5**, kho **1 → 1** và `xu_spend` **không thêm dòng nào**; đặt rồi **Lưu** → `layout_ver` **0 → 1**, ví **đứng nguyên**; thêm 🌳 bụi cây tròn (**13 → 5 xu**) và lưu lần hai → **ver 2**, reload trang vẫn còn **2 món** (vòng qua PostgreSQL — `decor_placed` đúng hai dòng `(0, −4)` và `(−3,5; −3,5)`, `decor_owned` = 1 + 1, ví 5); giả `baseVersion` cũ → **409** đúng dòng chữ máy chủ, nháp và CSDL không đổi; bàn phím thuần: `Thêm vào đảo` đặt bụi cỏ ở **(0, −4) khu Sân nhà**, bụi cây ở **(−3,5; −3,5) khu Ngoài rìa**; nhét thú vào trong bụi cây thì tự thoát sau **29 bước ≈ 1,45 s** (đúng ngưỡng kẹt 1,5 s), và **2.400 bước** của hai thú **0 lần** đứng trong vật cản; bó `.wrap` vào **360 px** → mép phải xa nhất **348 px**, `scrollWidth` đúng 360 — **không tràn ngang**. Toàn bộ nằm ở **ví Khách (`user_id = 0`)**, không chạm tài khoản thật.

Một lỗi bắt được nhờ chạy thật: vòng quét chỗ trống cho bản bàn phím từng chạy trên lưới `−r, −r+0,5, …` — **lệch khỏi lưới 0,25** nên `canPlace` từ chối **mọi** ứng viên (0 chỗ hợp lệ, không đặt được bằng bàn phím). Nay quét theo **bội số 0,5 của lưới** nên luôn bám grid; mục (b) của self-check cũng sửa cùng lỗi đó (trước đó báo 0/12 món chặn).

**D4 — phong cách + hiệu ứng thời tiết + 🪫 Tiết kiệm cho đồ trang trí + số đo khung hình thật + chế độ tối** (vẫn không thêm bảng nào, không thêm luật đặt đồ nào).

| Phần đã ship | Chi tiết thật |
|---|---|
| **Bảng Phong cách trong tab 🎨** | `pStyle()` render **15 kiểu / 4 nhánh** (`weather · tod · grass · sky`) từ đúng `DECOR_STYLES` + `STYLE_KINDS`; thẻ đầu bảng ghi "Đã mở x/15 · mở nốt cả bộ còn N xu" (tổng **830 xu**), thẻ thứ hai ghi đúng những gì **đảo đang dùng**; mỗi nhánh có nút **↩ Về mặc định của đảo (miễn phí)** |
| **Ba loại nút** | `Mở 60 xu` (chỉ nút này tiêu xu, luôn qua `D3.confirm`) · `Bật` / `Đang dùng` (miễn phí) · `↩ Về mặc định`. Mua món đã sở hữu thì **bị chặn tại trình duyệt**, không mở hộp xác nhận và **không gọi API**; các lỗi `400/409` của máy chủ hiện nguyên văn vào `.why` (`aria-live`) |
| **Áp vào cảnh 3D** | `buildWorld` đọc `decor.styles[cur]`: `tod` đổi khóa giờ (`TODS`), `grass` lệch `hue`/`lit` qua `shiftPal` sẵn có, `sky` đổi màu nền + sương, `weather` thêm hạt. Đổi phong cách **không** làm `layout_ver` đổi, nên trang tự so **chữ ký 4 nhánh** (`STY`) và tự dựng lại cảnh (`DEC3.refresh`) — đo thật: bật Đêm thì nền `#d8e1f0 → #6f6879 → #1a2d46`, cỏ `#84c88c → #a2cb8b`, trời `#ffdfea → #2b4a6b` |
| **Hạt thời tiết** | Mưa **60** · Tuyết **50** · Cánh hoa **45** · Sương mù **9** tấm mờ, dùng chung cơ chế hạt `AMBP` đã có; mưa rơi thẳng và **không xoay**, các hạt khác giữ xoay như cũ |
| **🪫 Tiết kiệm cho đồ** | Ẩn món **phẳng W và hiệu ứng FX**, ẩn **mọi hạt**, giảm `pixelRatio` về 1 — nhưng **giữ nguyên món chặn** nên `BLK` và đường đi của thú không đổi (đo: 40 món → vẫn còn đủ **12 vật cản**, `blk` 12 = 12) |
| **⏱ Đo khung hình** | Nút **⏱ Đo khung hình (60)** ở tab 🎨: mỗi khung ép GPU trả hàng bằng `readPixels` một điểm (nếu không thì số đo chỉ là thời gian *gửi* lệnh), in `trung bình · giữa min–max · lệnh vẽ · tam giác · hình học · hạt · món · chế độ` vào `.why` và một dòng gọn vào `#msg` |
| **`freeze(n)`** | Chạy thật `n` khung **tính toán** (không vẽ) rồi đo **tổng quãng đường** của thú + hạt + món; `QD.rm(v)` bật/tắt đúng đường đọc `prefers-reduced-motion` để kiểm chứng mà không phải đổi cài đặt OS |
| **`selfCheck()` 9 → 13 mục** | thêm: hạt thời tiết = **đúng số trang khai** và **bằng 0** khi 🪫/giảm chuyển động · **30 khung hình đóng băng tuyệt đối** khi `RM` · **15 kiểu / 4 nhánh / 830 xu** khớp lõi · **bảng phong cách có nút cho đủ 15 kiểu, giá in đúng giá lõi** |
| **Chế độ tối** | Ba token mới trong `demo-core.css` (`--on-brand`, `--brand-text`, `--bad`) thay cho màu cứng; `button.pri` không còn chữ trắng trên nền xanh |

**Số đo khung hình** (một lượt đo duy nhất, cùng máy, cùng cảnh 612×472 với `devicePixelRatio` 1,25; mỗi ô là các mẫu `perf(40)` — máy này dao động ±25% giữa các lần nên **không** dùng một mẫu lẻ):

| Cấu hình | ms/khung (các mẫu) | trung vị | FPS | lệnh vẽ | tam giác | hạt |
|---|---|---|---|---|---|---|
| Mặc định — 2 món, không phong cách | 28,8 · 38,5 · 30,4 · 29,8 · 27,3 | **29,8** | 34 | 98 | 3.163 | 70 |
| + 🌧️ Mưa nhẹ (60 hạt) | 32,6 · 30,2 · 28,0 | **30,2** | 33 | 156 | 3.871 | 130 |
| + 🪫 Tiết kiệm (cảnh có mưa) | 8,8 · 7,4 · 7,1 | **7,4** | **135** | 19 | 1.662 | 0 |
| **Đầy trần 40 món** (12 chặn + 28 phẳng/FX, nháp không lưu) | 45,3 · 46,4 | **45,9** | 22 | 273 | 22.390 | 70 |
| 40 món + 🪫 | 12,3 · 10,4 | **11,4** | **88** | 41 | 7.206 | 0 |

* **Lớp hạt thời tiết gần như miễn phí**: thêm 60 mesh (98 → 156 lệnh vẽ) chỉ +0,4 ms — nằm trong dao động của máy. Cái ăn khung hình là **số món có khối**, không phải số hạt.
* **🪫 Tiết kiệm là lối thoát thật**: bố cục nặng nhất 45,9 → 11,4 ms (**~4 lần**), 273 → 41 lệnh vẽ. Dòng ⏱ in ra trên bố cục mặc định: `trung bình 41,3 ms (≈ 24 FPS), giữa 25,6–263,8 ms · 98 lệnh vẽ · 3.163 tam giác · 98 hình học · 70 hạt · 2 món đặt · đầy đủ` (lệnh vẽ đầu tiên tốn 263,8 ms nên min–max rộng).
* **Ngân sách khối**: đếm lại bằng hook `Object3D.add` ngay trên bố cục 40 món = **220 lần thêm con** cho cả 40 nhóm (≈ 4,5 khối/món, kể cả 40 lần gắn nhóm vào cảnh) — dưới xa ngưỡng 600 đã định ở mục 10; ở 🪫 chỉ còn **36 lần**.
* **Đóng băng tuyệt đối**: `QD.rm(true)` → **0,0000 đơn vị** di chuyển trong 30 khung hình (hạt = 0, chỉ còn 2 món được vẽ), trong khi cùng phép đo ở chế độ đầy đủ là **41,80** (đảo mặc định) và **417,46** (đảo có mưa) — thiết bị đo đủ nhạy để con số 0 có ý nghĩa.
* **Tương phản hai chế độ màu** (quét đúng công thức WCAG 2.x trên cả tab 🏝️ và 🎨, 18 tổ hợp chữ/nền): trước D4 nút `.pri` chữ trắng trên nền thương hiệu chỉ **3,92** (sáng) và **1,89** (tối), nhãn xanh `--brand` trên thẻ **3,86**. Sau khi đổi sang token: `.pri` **4,61 / 9,56**, nhãn **5,11 / 8,02**, `.why.bad` **6,43 / 6,01** — **0 tổ hợp dưới 4,5** ở cả hai chế độ.

Toàn bộ phép đo chạy trên **ví Khách (`user_id = 0`)**, không chạm tài khoản thật; khách để lại **4 phong cách đã mở** (`t_night · w_rain · g_autumn · s_starry`), bố cục đảo 1 vẫn **2 món** và `layout_ver` vẫn **2** (chọn/phong cách và trả về mặc định **không** đụng phiên bản bố cục), ví còn **80 xu**.

**Hai lỗi bắt được khi chạy thật ở D4:**
* **Máy chủ xóa ba nhánh còn lại mỗi lần chọn một nhánh** — `applyStyle` chỉ trả về các nhánh người chơi vừa nhắc tới, còn `POST /style` ghi đè **cả bốn cột**, nên bật "Mưa" là làm mất "Đêm". Đã sửa: ghép giá trị mới vào dòng đang có trong `decor.styles[island]` (ca 24), và chính phép thử trong trình duyệt ("sau khi bật mưa, `tod` thành null") là thứ tìm ra nó.
* **Đổi phong cách không làm cảnh dựng lại** — `apply()` chỉ gọi `render()` (bảng chữ), còn `VISIT.sync` chỉ rebuild khi các ô đất đổi, nên màu cỏ/giờ/trời vào thẳng CSDL mà màn hình vẫn cũ. Đã sửa: giữ chữ ký `STY` của bốn nhánh và gọi `DEC3.refresh()` từ `apply()`.

**D5 — 📷 chụp ảnh + 4 gói chủ đề còn lại + công trình lớn + danh sách mong muốn** (thêm **một** bảng `decor_wish` và **một** route `PUT /decor/wish`; không sửa luật đặt đồ nào, không sửa giá món nào đã có).

| Phần đã ship | Chi tiết thật |
|---|---|
| **4 gói chủ đề còn lại** | 🥥 Nhiệt Đới **130** · ☁️ Mây Trời **195** · 🐚 Đáy Biển **117** · ✨ Đom Đóm **185** xu, mỗi gói đúng **4 món** như bốn gói đầu → catalog nay **78 món / 4.802 xu** (46 món chung 3.573 + 32 món gói **1.229**), cả bộ kèm 15 phong cách là **5.632 xu**. `themeUnlocked` **không phải sửa một dòng nào** — tám chủ đề đã tính sẵn từ D1 |
| **4 công trình lớn dựng tay** | 🗿 Tượng thú **9 khối** · 🌀 Cối xay **9** · 🕰️ Tháp đồng hồ **10** · 🔭 Đài thiên văn **9** — cả bốn đi qua `DMESH` thay vì khuôn `decGeneric`, cao nhất **2,6** (đỉnh Tháp đồng hồ), **không `PointLight`**: mắt tượng, mặt đồng hồ, ống kính chỉ dùng `emissive`; vẫn đổ bóng vì là lớp XL. **62 món còn lại** vẫn qua khuôn chung |
| **📷 Chế độ chụp ảnh** | Nút **📷 Chụp ảnh đảo** trong bảng 🎨 → `body[data-shot]` ẩn mọi khối chữ quanh cảnh (thanh xu, tab, nhãn nổi), chỉ còn `.view` + `shotbar` **nằm trong khung cảnh**; 3 góc **🏝️ Toàn cảnh · 🏠 Cận nhà · 🐾 Theo thú** + xoay tự do; **Esc** hoặc ✖ Thoát để tắt. Đo bằng `getComputedStyle`: vào chế độ thì `H1/tabs/panel/msg` = `none`, `#view` = `block`, hết chế độ trả về `block` như cũ |
| **Xuất PNG** | `stage.size()` → dựng **một khung hình** với `setPixelRatio(1)` + `setSize(ow,oh,false)` (trần cạnh dài **2.048 px**), `drawImage` sang canvas 2D **ngay trong cùng lượt** nên không phải bật `preserveDrawingBuffer` suốt phiên, rồi trả `pixelRatio` và cỡ máy vẽ về cũ; **vòng sáng ô đất + bóng xem trước bị tắt đúng một khung hình** để ảnh là ảnh. Dòng chữ duy nhất trên ảnh: `Đảo số 1 · Anh Đào 🌸`. Đo thật: **631×680 px · ≈0,06 MB · 264 ms** cho một cú chụp, ví Khách **80 → 80**, **không một lời gọi API nào** |
| **Tải / chia sẻ** | `navigator.share` kèm `File` khi trình duyệt hỗ trợ (`navigator.canShare({files})`), không thì `<a download>` tên **`dao-<n>-<ngày>.png`** (đo được: `dao-1-2026-11-04.png`); `shotCapture(false)` là đường cho bộ kiểm tra — dựng và đo ảnh nhưng **không** bấm nút tải |
| **Danh sách mong muốn** | Bảng `decor_wish` (`PK (user_id, item_key)` + `pos smallint`), route `PUT /decor/wish` **thay cả danh sách trong một giao dịch**, **miễn phí** — không `xu_spend`, không đụng `layout_ver`; trần **10 món** kiểm bằng **mã** (`WISH_MAX` + `normWish`) chứ không bằng `CHECK` nên sau này nới trần chỉ sửa một chỗ; **ước được cả món chưa mở gói** vì danh sách là mục tiêu chứ không phải cửa hàng; `transferGuestData` nay chuyển **8 bảng** |
| **UI trong tab 🎨** | Mỗi thẻ món có **⭐ Ước** (đo: **78 thẻ = 78 nút**), bảng **📌 Danh sách mong muốn — x/10 món** liệt kê `giá · nhóm · còn thiếu N xu / đủ xu rồi / đã có ×N trong kho` kèm **🧹 Bỏ ước** và tổng "cả danh sách cần thêm N xu"; con số do `IslandCore.wishRows` tính — **cùng công thức** ca 27 chạy trên server. Đo thật với ví 80 xu: 🌿 đủ rồi · 🏮 đủ rồi · 🗿 **còn thiếu 220 xu** (300 − 80) |
| **`selfCheck()` 13 → 17 mục** | thêm: 4 công trình lớn **dựng tay** và ≤ 15 khối (đo thật bằng `DEC3.info`) · **chụp thử một khung PNG** (đầu chuỗi `data:image/png;base64,`, cạnh dài ≤ 2.048, ảnh > 1 KB) rồi **trả máy về góc cũ** (`cam0`/`camSet`) · **8 gói × 4 món = 1.229 xu** và "đảo khác chủ đề không mở hộ" (gọi `themeUnlocked` thật) · **trần ước 10 món** (gửi 11 khóa → `400`) + cột "còn thiếu" tính từ đúng ví |

Kiểm và đo (04/11): `test-decor-core.js` **8/8**, `test-decor-api.js` **19/19** (ba ca mới 25·26·27), `test-island-api.js` **18/18**, `npm test` **15 bộ / 313 bài** (exit 0), `test:wallet` **5 bộ / 114 bài** (exit 0), `QD.selfCheck()` **17/17 mục đạt** trong trình duyệt thật. Toàn bộ dữ liệu thử nằm ở **ví Khách (`user_id = 0`)** và **đã trả về sạch**: danh sách ước của Khách hiện **0 dòng**, ví **80 xu**, bố cục đảo 1 không đổi.

**Ba lỗi bắt được khi chạy thật ở D5:**
* **Luật ẩn của chế độ chụp không ăn** — thẻ "🔗 Liên kết nhanh" mang `display:flex` **ngay trong `style=""`** nên quy tắc CSS thường thua; phải `!important`. Phát hiện nhờ đọc `getComputedStyle` từng khối con, không phải nhìn màn hình.
* **Ảnh đầu tiên sai tỉ lệ** — `ResizeObserver` chạy **chậm hơn cú bấm**, buffer còn giữ cỡ khung chữ cũ (612×472 trong khi khung ảnh phải là 631×680). `shotPNG` nay gọi `stage.size()` trước khi đọc `cv.width/cv.height`.
* **`QD.selfCheck()` báo lỗi khi đang ở tab 🎨** — `#chk` chỉ tồn tại trong bảng 🏝️ (`Cannot set properties of null`); self-check nay tự chuyển về 🏝️ rồi mới chạy. Kèm một sửa nhỏ thành thật: góc **🐾 Theo thú** trên đảo chưa có thú nay nói rõ "quay về Toàn cảnh" thay vì báo góc đã đổi.

**D6 — cân bằng giá bằng dữ liệu thật** (05/11; **không đổi một giá nào, không sửa luật đặt đồ nào, không đụng API** — chỉ đổi *cách đo* rồi viết lại mục 5 và dọn tài liệu).

| Phần đã ship | Chi tiết thật |
|---|---|
| **Lệnh đo mới** | `npm --prefix json run decor:sim:real` = `node scripts/sim-trang-tri.js --db` — **chỉ SELECT**, 0 token, không ghi bảng nào, **loại tài khoản demo** (`CONFIG.demoMail`) khỏi cả ba lệnh đo. Cùng script đó thêm phần **(3)**: nhét đầy đảo bằng **chính `canPlace`** thay cho công thức viết tay |
| **Một đảo ĐẦY 40 món tốn bao nhiêu** | rẻ nhất **120 xu** · **trung vị 1.480** trên **24** đảo ngẫu nhiên (232 … 2.980, trung bình 1.419, **24/24** đạt đủ 40 món) · đắt nhất **4.410 xu**. "Đảo mẫu 863 xu" của bản trước **vẫn hợp lệ** nhưng nằm **gần đáy** khoảng đó — thấp hơn trung vị **1,7 lần** |
| **Thu nhập ĐO THẬT thay cho ba người học mẫu** | **3** người có thu nhập · **8** ngày-học (2026-10-29 → 2026-11-05): **1 … p25 5 … trung vị 11 … p75 31 … p90 34 … 39** xu/ngày. **Không ngày nào chạm trần 136** (cao nhất mới bằng 29% trần). Ngày cày một đảo trung vị vì thế là **134,5** (không phải 22,1), cả bộ catalog **512,0**, 8 đảo + trang trí **1.100,4** |
| **Nhịp cho ăn của thú** | đo từ `CONFIG.mealsPerDay` × giá: **9 / 24 / 45 / 120** xu/ngày/thú; 3 thú = **27**, 6 thú = **54**. Ở trung vị 11 thì **chỉ riêng tiền hạt đã ăn hết thu nhập một ngày (còn −16)** → giữ cho ăn là khoản **tự nguyện** (sàn 30, không phạt), và không biến đồ trang trí thành thứ bắt buộc |
| **Chi thật đã ghi sổ** | `xu_spend`: **31 dòng / 401 xu TIÊU** (cột `cost`; cột `xu` là **số dư sau khi tiêu**, cộng cột đó ra 1.958 và tưởng là tổng chi — nhầm này đã sửa 05/11) — `style_buy` **220** (4 dòng, 50…60 mỗi lần) · `sakura` **150** (24, 5…20) · `build` 20 (1) · `decor_buy` **11** (2, 3…8) · **`pet_food`, `pet_buy`, `island_upgrade` 0 dòng**. Kèm đối chiếu giá: **6/6 dòng trang trí chia hết cho đúng giá niêm yết của chính món đó** |
| **Ngưỡng để được đổi giá** | script tự in: **≥ 20 người chơi và ≥ 280 ngày-học** (≈ 20 × 14 ngày). Mẫu hiện **3/7** nên đợt này **giữ nguyên từng giá**; số đo chỉ thay cột "ngày" và khoảng hợp lệ |
| **Chống số liệu tự cũ** | ba lớp kiểm trong `sim-trang-tri.js`: (1) đảo mẫu viết tay **phải nằm trong** khoảng đo thật của một đảo đầy, (2) bộ nhét đầy **phải đạt đủ 40 món**, (3) **mỗi dòng `decor_buy`/`style_buy` trong `xu_spend` phải chia hết cho đúng giá niêm yết hôm nay của chính món/khóa đó** và khóa phải còn trong catalog — giá đổi âm thầm hoặc dữ liệu chỉ món đã xóa là lệnh kêu ngay, không chờ người đọc tài liệu |

**Kết luận D6 bằng một câu:** giá hiện tại **không sai**, nhưng **đắt so với nhịp thật** — trang trí là đích **bốn tháng cho một đảo đầy (134,5 ngày) và hơn ba năm cho cả quần đảo + trang trí (1.100,4 ngày)** ở nhịp trung vị ĐO được hôm 05/11, không phải vài ngày như bảng cũ nói — và vì mẫu **dày lên từng ngày** (sáng 05/11 còn là 7 ngày-học · trung vị 19), con số này phải chạy lại lệnh đo chứ không chép tay; muốn quần đảo nhẹ hơn thì siết `CONFIG.upgradeCost`/`factorMax` (thứ chặn đường mở gói chủ đề), **không** siết giá đồ.

## 1. Ý tưởng một câu
Khi đã nâng cấp xong các đảo, xu vẫn có chỗ tiêu có ý nghĩa: **mua cây, đèn, đường lát, hàng rào, thời tiết**… rồi **tự tay bố trí đảo của mình**, xem thú chạy quanh những thứ mình đặt, và **chụp ảnh đảo**.

```
 học / chơi / nộp file / đăng nhập / chuỗi ──► 🪙 ví xu (một ví duy nhất, đã có)
                                                   │
        ┌──────────────────────────────────────────┼─────────────────────────────┐
        ▼                                          ▼                             ▼
 🏝️ nâng cấp 5 ô (đã có)                    🛒 mua đồ trang trí (MỚI)    🎨 mở phong cách đảo (MỚI)
 → đảo hoàn chỉnh → đảo kế                  cây, đèn, đường, đồ vườn…   thời tiết, giờ, màu cỏ, bầu trời
        │                                          │                             │
        └──► mở gói chủ đề + công trình lớn ───────┴──► 🧩 chế độ trang trí (đặt, xoay, cất)
                                                              │
                                                              ▼
                                       🐾 thú chạy quanh đồ mới · 📷 chụp ảnh · muốn thêm đồ → học tiếp
```

## 2. Vai trò trong trò chơi và nguyên tắc
Từ lúc hoàn chỉnh hết 8 đảo đầu (tổng giá **5.200 xu** thật theo `IslandCore.islandCost`, chia cho **67 xu/ngày** của người "học đều" ≈ **78 ngày**), xu dễ mất ý nghĩa. Trang trí là **chỗ tiêu dài hạn mà không tạo sức mạnh**, và **mỗi người có một đảo khác nhau**.

| # | Nguyên tắc | Bảo đảm bằng | Tình trạng |
|---|---|---|---|
| 1 | **Chỉ tiêu xu, không có đường kiếm xu** từ trang trí | ca 23 `test-decor-api.js` — tổng `xu_spend` đúng bằng độ giảm ví, chi chỉ có `decor_buy`/`style_buy` | ✅ đạt 04/11 |
| 2 | **Server luôn đúng**: giá, số sở hữu, vị trí hợp lệ đều server kiểm, không tin trình duyệt | `canPlace`/`validateLayout` dùng chung; mọi lần ghi là giao dịch có khóa dòng | ✅ đạt 04/11 (ca 12/13/17) |
| 3 | **Không phạt**: cất đồ về kho **miễn phí**, đặt lại **miễn phí**, không mất gì | `PUT /decor/layout` không trừ xu; `decor_owned` chỉ tăng khi mua | ✅ đạt 04/11 (ca 12/18) |
| 4 | **Mọi lần tiêu xu có hộp xác nhận** (`D3.confirm`), `Esc`/Hủy thì không trừ gì | Giữ đúng quy ước của trang đảo | ✅ D3 — `decBuy` chỉ đi qua `confirmBox`; `Esc` bấm đúng nút Hủy (`demo-core-three.js:18`). Đo trong trình duyệt + đối chiếu CSDL: bấm **Mua 3 xu** → hộp "Mua 🌿 Bụi cỏ ×1" → Hủy → ví **5 → 5**, kho **1 → 1**, `GET /api/islands` vẫn **5**; mua thật trừ **đúng một lần** (16 → 13 → 5) và `xu_spend` có **đúng 2 dòng `decor_buy`** (grass_tuft số dư 13, bush số dư 5) — cú Hủy **không để lại dòng chi nào** |
| 5 | **Không cờ bạc, không tiền thật, không hộp ngẫu nhiên**, **không đồ chỉ bán có thời hạn** | Giá niêm yết cố định trong `DECOR_ITEMS` | ✅ giá đã cố định |
| 6 | **Thú không bị kẹt, không rời đảo** dù người chơi đặt thế nào | Luật đặt đồ + kiểm liền khối (mục 7) | ✅ ca 5, 6, 7 đạt |
| 7 | **Dùng được bằng bàn phím**; **bật giảm chuyển động thì đóng băng tuyệt đối** | Trình sửa bằng danh sách chữ song song với 3D (mục 6) + `freeze(n)` đo quãng đường từng vật | ✅ bản bàn phím (D3 — đặt/xoay/nhích/cất bằng phím, fokus không mất khi vẽ lại; chi tiết mục 6) · ✅ **D4 đo thật**: `RM` bật → **0,0000 đơn vị trong 30 khung hình** (hạt = 0), cũng phép đo khi cờ tắt → **41,80** (đảo mặc định) và **417,46** (đảo đang mưa) — chỉ khác mỗi lá cờ |
| 8 | **Chạy được trên máy yếu** | Ngân sách khối, chế độ 🪫 Tiết kiệm, ⏱ đo khung hình (mục 10) | ✅ **D4** — số đo thật ở mục 10: bố cục **40 món 45,9 ms → 11,4 ms** khi 🪫 (273 → 41 lệnh vẽ), máy mặc định 29,8 ms ≈ 34 FPS |

## 3. Phạm vi bản đầu
| Có làm | Chưa làm (bản đầu) |
|---|---|
| Mua và đặt **78 món** (46 chung + 32 theo chủ đề), xoay 8 hướng, cất về kho | Chỉnh địa hình, đổi cỡ/hình dáng đảo |
| **Phong cách đảo**: thời tiết, khóa giờ, màu cỏ, bầu trời (15 tùy chọn) | Đặt đồ chồng lên nhau, độ cao tự do |
| **Chế độ trang trí** bằng chuột/cảm ứng **và** bằng bàn phím | Nhập mô hình/ảnh từ ngoài |
| Hoàn tác/làm lại, **Lưu** và **Hủy** rõ ràng | Chia sẻ đảo bằng đường dẫn công khai trên server |
| **📷 Chụp ảnh đảo**, tải về (chỉ ở máy người chơi) | Chợ trao đổi, bán lại xu, quà tặng giữa người chơi |
| Gói chủ đề mở khi **hoàn chỉnh đảo cùng chủ đề** | Tên đảo/biển hiệu do người chơi gõ (cần kiểm duyệt) |
| Công trình lớn mở theo số đảo đã hoàn chỉnh (1/2/4/8) | Hộp ngẫu nhiên, đồ có thời hạn |

## 4. Danh mục đồ — `DECOR_ITEMS` / `DECOR_THEMED` / `DECOR_STYLES` trong `src/island-core.js`
**Lớp chặn đường** quyết định thú đi được qua hay không. Bán kính chặn là **hằng số thật** `DECOR.radius`, không còn giả định:

| Lớp | Ý nghĩa | Bán kính `r` |
|---|---|---|
| **W** | Phẳng, thú **đi qua được** (đá lát, hoa, nệm…) | 0 |
| **S** | Nhỏ (đèn đất, đá nhỏ, hàng rào ngắn) | 0,25 |
| **M** | Vừa (bụi cây, cây, ghế) | 0,45 |
| **L** | Lớn (bàn ghế, lều, đài phun) | 0,70 |
| **XL** | Công trình lớn | 0,90 |
| **FX** | Hiệu ứng (đom đóm, bướm…), không chiếm chỗ | 0 |

### 4.1 Đồ chung — 46 món, mỗi món một cái = **3.573 xu**
| Nhóm (tổng 1 cái mỗi món) | Món (giá · lớp · khóa) |
|---|---|
| 🌿 **Cây và hoa** (116) | Bụi cỏ **3** W `grass_tuft` · Luống hoa **5** W `flower_patch` · Bụi cây tròn **8** M `bush` · Cây non **10** S `sapling` · Cây thông nhỏ **15** M `pine` · Cây sồi **20** M `oak` · Cây cọ nhỏ **20** M `palm_small` · Cây tỉa hình thú **35** M `topiary` |
| 🪨 **Đường và hàng rào** (114) | Đá lát **4** W `stone_path` · Bậc đá **5** W `stepping` · Ván gỗ **6** W `wood_path` · Hàng rào ngắn **6** S `fence` · Gạch **8** W `brick_path` · Cầu nhỏ **40** W `mini_bridge` · Vòm hoa **45** W `flower_arch` |
| 💡 **Đèn** (308) | Đèn lồng đất **10** S `lantern` · Cột đèn **18** S `lamp_post` · Quả cầu sáng **30** S `glow_orb` · Lửa trại **40** M `fire_pit` · Đèn sao **60** S `star_lamp` · Hải đăng nhỏ **150** L `lighthouse_mini` |
| 🪑 **Đồ vườn và nhà** (277) | Hòm thư **12** S `mailbox` · Nhà chim **25** S `bird_house` · Ghế dài **20** M `bench` · Bàn ghế **45** L `table_set` · Võng **50** L `hammock` · Lều **55** L `tent` · Xích đu **70** L `swing` |
| 💧 **Nước và đá** (228) | Đá nhỏ **3** S `rock_small` · Đá lớn **10** M `rock_big` · Ao nhỏ **35** M `pond_small` · Ống tre nước **60** M `bamboo_fountain` · Đài phun **120** L `fountain_small` |
| ✨ **Hiệu ứng** (140, tối đa **2**/đảo) | Bướm **30** · Bong bóng **30** · Đom đóm **40** · Cánh hoa bay **40** (`butterflies`, `bubbles_fx`, `fireflies`, `petals_fx`) |
| 🐾 **Thú cưng** (190) | Bát nước **10** W `water_bowl` · Rổ bóng **15** S `ball_basket` · Nệm thú **25** W `pet_bed` · Cây leo cho mèo **60** M `cat_tree` · Nhà chó **80** L `dog_house` |
| 🏛️ **Công trình lớn** (2.200, tối đa **1**/đảo) | Tượng thú cưng **300** · Cối xay lớn **500** · Tháp đồng hồ **600** · Đài thiên văn **800** (XL `pet_statue`, `big_windmill`, `clock_tower`, `observatory`) |

Ba món có `petSpot:"bowl"`/`petSpot:"house"` (bát nước, nệm thú, nhà chó…) được luật 6 đối xử riêng; còn lại là đồ thường.

### 4.2 Gói chủ đề — 32 món = **1.229 xu** (8 gói × 4 món), mỗi món gắn nhãn chủ đề bằng trường `theme:`
Mở khi người chơi **đã hoàn chỉnh một đảo thuộc chủ đề đó** (`themeUnlocked(slots, theme)`; đảo `n` thuộc chủ đề `(n − 1) mod 8`, nên đảo vòng sau mở cùng gói).
| Gói | Món |
|---|---|
| 🌸 **Anh Đào** (đảo 1, 9, 17…) | Cổng torii nhỏ **60** W `mini_torii` · Cầu cong đỏ **70** W `red_bridge` · Bonsai anh đào **45** S `bonsai_sakura` · Đèn đá nhỏ **25** S `stone_lantern` |
| 🍁 **Phong Thu** (đảo 2, 10…) | Đống lá **8** W `leaf_pile` · Bí ngô **12** S `pumpkin` · Phong nhỏ **30** M `maple_small` · Lò sưởi ngoài trời **65** M `cozy_stove` |
| 🌴 **Ốc Đảo** (đảo 3, 11…) | Bình gốm **12** S `clay_pot` · Xương rồng **15** S `cactus` · Cọ chà là nhỏ **35** M `date_palm` · Lều thương nhân **70** L `merchant_tent` |
| ❄️ **Băng Tuyết** (đảo 4, 12…) | Sân băng nhỏ **55** W `ice_rink` · Đèn băng **40** S `ice_lantern` · Người tuyết **30** M `snowman` · Thông tuyết **30** M `ice_pine` |
| 🥥 **Nhiệt Đới** (đảo 5, 13…) — **D5** | Cây dừa lùn **40** M `coconut_palm` · Bụi chuối **18** M `banana_bush` · Cầu tre nhỏ **50** W `bamboo_bridge` · Ván lướt sóng **22** S `surf_board` |
| ☁️ **Mây Trời** (đảo 6, 14…) — **D5** | Vòm cầu vồng **70** W `rainbow_arch` · Khinh khí cầu nhỏ **80** L `balloon_small` · Đệm mây **30** M `cloud_cushion` · Chuông gió **15** S `wind_chime` |
| 🐚 **Đáy Biển** (đảo 7, 15…) — **D5** | Bụi rong biển **12** W `seaweed_patch` · Ốc biển **10** S `conch_shell` · Rạn san hô **35** M `coral_pile` · Rương kho báu **60** S `treasure_chest` |
| ✨ **Đom Đóm** (đảo 8, 16…) — **D5** | Nấm phát sáng **25** S `glow_shroom` · Đèn giấy **30** S `paper_lantern` · Lọ đom đóm **40** S `firefly_jar` · Kính thiên văn nhỏ **90** L `star_telescope` |
Bốn gói sau **cùng khuôn** với bốn gói đầu: chúng chỉ là bốn lời gọi `mk(...)` nối vào `DECOR_THEMED`, `themeUnlocked` **không đổi một dòng nào**. ca 2 của `test-decor-core.js` chứng minh chiều ngược lại cũng đúng — hoàn chỉnh đảo Anh Đào **không** mở hộ gói Đáy Biển, và đặt `coral_pile` trên đảo 7 đã nâng cấp tròn thì `canPlace` đồng ý.

### 4.3 Công trình lớn mở theo số đảo hoàn chỉnh
Tượng thú cưng sau **1** đảo · Cối xay lớn sau **2** · Tháp đồng hồ sau **4** · Đài thiên văn sau **8** (`needDone` trên từng món; `itemLockedReason` in đúng câu "Chưa mở: Đài thiên văn cần 8 đảo hoàn chỉnh (bạn đã có 1)."). Mỗi đảo đặt tối đa **một** công trình lớn. **✅ D5:** cả bốn món có hàm dựng riêng trong `DMESH` (không còn đi qua khuôn `decGeneric`), số khối **đo thật** bằng `DEC3.info`: 🗿 **9** · 🌀 **9** · 🕰️ **10** · 🔭 **9** — nằm trong ngân sách ≤15 khối/món của mục 10, cao nhất 2,6 ô, không `PointLight`.

### 4.4 Phong cách đảo — 15 tùy chọn = **830 xu**
**Mở khóa một lần cho cả tài khoản, rồi đổi miễn phí cho từng đảo** (`buyStyle` trừ xu một lần, `pickStyle` giá 0 và báo `409` nếu chưa mở). Mặc định (miễn phí): giờ và thời tiết theo đảo như hiện tại.
| Loại (`kind`) | Tùy chọn |
|---|---|
| Thời tiết `weather` | Mưa nhẹ **60** `w_rain` · Sương mù **60** `w_fog` · Tuyết nhẹ **80** `w_snow` · Cánh hoa bay **80** `w_petals` |
| Khóa giờ `tod` | Sáng **40** `t_morning` · Trưa **40** `t_noon` · Hoàng hôn **60** `t_dusk` · Đêm **60** `t_night` (gắn `tod: 0..3` đúng thứ tự `TODS` của trang) |
| Màu cỏ `grass` | Xanh non **50** `g_sprout` · Vàng thu **50** `g_autumn` · Xanh ngọc **50** `g_teal` · Tím oải hương **50** `g_lavender` (lệch `hue`/`lit` đưa vào `shiftPal` sẵn có của trang) |
| Bầu trời `sky` | Hoàng hôn tím **50** `s_duskpurple` · Bình minh hồng **50** `s_pinkdawn` · Đêm sao **50** `s_starry` |
Thời tiết là **hạt nền** dùng chung cơ chế hạt hiện có của trang: Mưa **60** · Tuyết **50** · Cánh hoa **45** · Sương mù **9** tấm, cộng vào 70 hạt nền sẵn có (nền + thời tiết = **130** khi bật mưa — số thật đã đo, mục 0). Chế độ 🪫 Tiết kiệm hoặc `prefers-reduced-motion` **tắt hết** xuống **0 hạt**. **✅ D4:** cả 15 kiểu đã có đường bấm trong tab 🎨 (`pStyle()`), bốn nhánh áp thẳng vào cảnh 3D và **không** làm `layout_ver` đổi.

### 4.5 Mua theo cái hay mở một lần?
**Đã làm theo đề xuất: mua theo cái** — `qty` 1..99, đồ thuộc **tài khoản**, số đang đặt trên **tất cả** đảo không vượt số đã mua (`validateLayout` kiểm phần này). Món rẻ (3–10 xu) cho phép mua nhiều để trồng cả vườn; món đắt và công trình lớn thì mỗi đảo chỉ cần một cái. (Câu hỏi 1 ở mục 14 vẫn mở nếu bạn muốn đổi sang "mở một lần dùng vô hạn".)

## 5. Kinh tế — ✅ **D6: số ĐO THẬT** (sáng 05/11/2026), không còn "ước tính thô"
Hai lệnh dưới đây sinh toàn bộ bảng này; script **không chứa giá viết tay** — mọi số đọc từ `IslandCore.DECOR_*`, `IslandCore.islandCost` và `CONFIG`, phần thật thì `SELECT` trên CSDL:

* `npm --prefix json run decor:sim` — catalog + nhét đầy đảo bằng `canPlace` thật + hai vế A/B của luật liền khối.
* `npm --prefix json run decor:sim:real` (= `sim-trang-tri.js --db`) — thêm percentile thu nhập **đo từ lịch sử thật**, `xu_spend` **đã ghi** chia theo `kind` (số dòng · tổng xu · nhỏ…lớn mỗi lần · số ngày có chi), nhịp cho ăn của thú **đo từ `CONFIG`**, và **ngưỡng mẫu** để được xét lại giá.

| Mục | Số đo |
|---|---|
| Catalog (1 cái mỗi món): chung + gói + phong cách | 3.573 + **1.229** + 830 = **5.632 xu** |
| **Thu nhập THẬT** của người chơi (`town_ledger` + năm nhóm có trần trong `xu_ledger`, chỉ tài khoản còn tồn tại **và không phải tài khoản demo**) | cửa sổ **2026-10-29 → 2026-11-05**: **3** người có thu nhập · **8** ngày-học · thấp nhất **1** · p25 **5** · **trung vị 11** · p75 **31** · p90 **34** · cao nhất **39** xu/ngày-học. **Không ngày nào chạm trần 136** (cao nhất mới bằng 29% trần). *Đây là ảnh chụp có ngày:* sáng 05/11 cùng lệnh này ra **7 ngày-học · trung vị 19**; một ngày-học thật mới (05/11, 5 xu) đủ kéo trung vị xuống 11 — chạy lại lệnh đo là ra số hiện hành |
| **Một đảo ĐẦY 40 món**, nhét bằng `canPlace` thật (mua theo cái nên được phép lặp lại một món) | rẻ nhất **120 xu** (đảo 1, 83 lần thử) · **24 đảo ngẫu nhiên: nhỏ nhất 232 · trung vị 1.480 · lớn nhất 2.980 · trung bình 1.419 — 24/24 đặt đủ 40 món** · đắt nhất **4.410 xu** (đảo 8, 2.470 lần thử) |
| "Đảo mẫu 40 món" **viết tay** (12 món rẻ + 10 + 10 + 4 + 4, **không có** công trình lớn) | **863 xu** — **nằm trong** khoảng đo thật [120 … 4.410], nhưng **thấp hơn trung vị 1,7 lần**: một đảo đầy ngẫu nhiên thật tốn **1.480 xu** chứ không phải 863. `sim-trang-tri.js` `assert` điều này mỗi lần chạy — sửa giá mà để đảo mẫu rơi ra ngoài khoảng là script tự kêu |
| **Ngày phải cày** cho một đảo đầy trung vị **1.480 xu** | **134,5** ngày ở trung vị thật 11 · **43,5** ngày ở p90 34 · 22,1 ngày ở mô hình cũ 67 · 10,9 ngày nếu chạm trần 136. (Đảo mẫu viết tay 863 xu: **78,5 / 25,4 / 12,9 / 6,3** ngày theo đúng bốn nhịp đó.) |
| Cả bộ catalog **5.632 xu** | **512,0** ngày ở trung vị thật 11 · **165,6** ở p90 · 84,1 ở mô hình 67 · 41,4 ở trần 136 |
| **8 đảo** (nâng cấp **5.200** + 8 × đảo mẫu 863 = 6.904) = **12.104 xu** | **1.100,4** ngày ở trung vị thật 11 · **356,0** ở p90 · 180,7 ở mô hình 67 (so với **77,6 ngày** nếu **chỉ** nâng cấp 8 đảo ở cùng mô hình). Thay đảo mẫu 863 bằng trung vị đo thật **1.480** thì thành 5.200 + 11.840 = **17.040 xu** = **1.549,1** ngày ở 11 · **501,2** ở p90 |
| **Nuôi thú** — đo từ chính luật đang chạy (`CONFIG.mealsPerDay` × giá từng loại), không phải ước tính | hạt **9** · cá khô **24** · bánh thưởng **45** · bữa đặc biệt **120** xu/ngày/thú → **3** thú mặc định **27 xu/ngày**, **6** thú (trần hiệu năng) **54 xu/ngày**. Ở trung vị **11 xu/ngày** thì **chỉ riêng tiền hạt đã vượt gấp đôi thu nhập một ngày** (còn **−16**), nên "vừa nuôi 3 thú vừa mua trang trí" là **bất khả thi ở nhịp trung vị** — và đó chính là lý do cho ăn là khoản **tự nguyện** (`satietyFloor`/`moodFloor` = 30, đói chỉ làm thú buồn ngủ, không phạt xu, không phạt điểm học) chứ không phải một thứ thuế |
| **Chi thật đã ghi** trong `xu_spend` (toàn bộ lịch sử, **trừ tài khoản demo** — xem ghi chú dưới) | cột **`cost`** = số xu thật đã tiêu: **31 dòng / 401 xu** — `style_buy` **220** (4 dòng, 50…60 mỗi lần, 1 ngày có chi) · `sakura` **150** (24, 5…20, 2 ngày) · `build` 20 (1, 20) · `decor_buy` **11** (2, 3…8, 1 ngày) · **`pet_food` 0 dòng, `pet_buy` 0 dòng, `island_upgrade` 0 dòng** — chưa ai trong mẫu từng mua thú hay thức ăn, nên phần "nuôi thú" ở trên là số **đo từ luật**, chưa phải số **đo từ hành vi**. *(Cột `xu` của bảng là **số dư sau khi tiêu**, không phải khoản tiêu; cộng nó ra 1.958 và tưởng đó là tổng chi là lỗi script đã gặp và sửa 05/11.)* Đối chiếu từng dòng: **6/6 dòng `decor_buy`/`style_buy` chia hết cho đúng giá niêm yết hôm nay của chính món/khóa đó**, tức **không một giá nào đổi sau khi ghi sổ** |

**Hàng rào "chỉ số của người chơi thật":** cả ba lệnh SELECT trong `sim-trang-tri.js --db` loại tài khoản có email đuôi `IslandCore.CONFIG.demoMail` (`@quandao.invalid`) — đuôi mà `scripts/seed-tai-khoan-3-dao.js` (`npm --prefix json run seed:3-dao`) dùng để dựng tài khoản demo **đã hoàn thành ba đảo** phục vụ xem giao diện. Không có hàng rào này thì phép đo trên **chính CSDL dev** chiều 05/11 (đo bằng SQL, cùng công thức) thành **4 người · 28 ngày-học**, cửa sổ tự nới về **2026-10-17** và **trung vị nhảy 11 → 76 xu/ngày**; mọi cột "ngày phải cày" ở trên sẽ nhỏ đi ~7 lần mà không một giá nào đổi. Lệnh đo in đúng phần bị loại (`loại 45 dòng / 1.470 xu chi và 115 dòng / 1.905 xu thu của 1 tài khoản demo`) nên không ai nhầm là dữ liệu thiếu. Phía chi tiêu dùng `NOT EXISTS` chứ không `JOIN users`: tài khoản **Khách (`user_id = 0`)** không có dòng trong `users` mà vẫn là người chơi thật, 10 dòng chi của Khách vẫn nằm trọn trong con số **401 xu**.

**Quyết định cân bằng giá của D6: KHÔNG sửa một giá nào** — và lý do phải là số, không phải cảm giác:
* **Mẫu hiện có 3 người / 8 ngày-học.** Ngưỡng để xét lại giá ghi ngay trong script: **≥ 20 người chơi và ≥ 280 ngày-học** (≈ 20 người × 14 ngày). Đổi giá theo 7 mẫu chỉ là thay một ước tính thô bằng một ước tính thô khác.
* Số đo thật vì thế thay **cột "ngày"** và **khoảng hợp lệ của một đảo đầy** (120 … 4.410), còn `DECOR_ITEMS` · `DECOR_STYLES` · `needDone` **đứng nguyên**. Khi mẫu tới ngưỡng, `decor:sim:real` tự in hướng nên sửa.
* **Điều đầu tiên nên nhìn khi có mẫu dày:** "hoàn chỉnh 8 đảo + trang trí" là **637 ngày** ở nhịp trung vị thật — một đích **cả năm**, không phải một tuần. Trang trí **không khóa nội dung** nên đây không phải lỗi; nhưng nếu muốn quần đảo nhẹ hơn thì siết **giá nâng cấp đảo** (`CONFIG.upgradeCost` / `factorMax`), **đừng** siết giá đồ — giá đồ đã nằm trong khoảng `canPlace` cho phép, còn giá đảo là thứ duy nhất chặn đường mở gói chủ đề.
* Câu "trang trí kéo dài thời gian chơi **từ 2,6 lên 6 tháng**" của bản trước là số **mô hình 67 xu/ngày**; với nhịp **đo thật 11 xu/ngày** thì hai mốc đó là **472,7 ngày → 1.100,4 ngày**. Giữ cả hai cột để không ai phải đoán lại.

**Rào chắn chống lạm phát và chống khai thác:**
* **Không bán lại lấy xu** (tránh vòng mua bán). Cất đồ về kho thì **không hoàn xu**, nhưng cũng **không mất đồ**.
* Giá **cố định**, nằm một chỗ duy nhất trong `DECOR_ITEMS`/`DECOR_STYLES`; không trang nào được viết tay con số.
* **Danh sách mong muốn** (≤10 món, lưu trên server) hiển thị "còn thiếu bao nhiêu xu" để người chơi có mục tiêu gần mà **không có đếm ngược, không từ ngữ thúc ép**. ✅ **D5** — `PUT /decor/wish` **miễn phí** (ca 25: ví và `layout_ver` đứng nguyên), quá trần hoặc khóa lạ là `400` và **danh sách cũ còn nguyên** (ca 26), cột "còn thiếu" do `wishRows` tính từ ví thật (ca 27), và **không món nào tự mua** — lời dẫn trong bảng ghi rõ "muốn lấy thì vẫn phải bấm Mua ở thẻ món đó".
* Đồ trang trí **không tạo xu**: không "máy in xu" dưới bất kỳ hình thức nào.
* Chỗ để dành: các tượng **bậc thầy** (nếu sau này làm huy hiệu theo chủ điểm) dùng **cùng hệ đặt đồ**, nguồn mở là "thành tích" chứ không phải mua.

## 6. Chế độ trang trí (trải nghiệm) — ✅ D3
Thêm tab thứ bảy **🎨 Trang trí** cạnh sáu tab hiện có (🏝️ Đảo của tôi · 🗺️ Quần đảo · 🐾 Chuồng thú · 🛒 Cửa hàng thú · 🍖 Thức ăn · 📚 Bộ sưu tập).

**Một phiên mẫu:** Linh học xong 25 câu, vào 🎨 thấy ví có 60 xu → chọn **Vòm hoa (45 xu)** → hộp xác nhận → mua. Cầm vòm lên mặt đảo, bóng hiện **xanh** ở chỗ hợp lệ, **đỏ kèm lý do** ("Sát ô Nhà — phải cách tâm ô thêm 0.9", "Ra ngoài mép đảo — thú không còn lối đi quanh món này", "Chặn đường của thú — bố cục này chia cắt đảo") ở chỗ sai. Đặt vòm cạnh hồ cá, bấm **Lưu**, thấy chú mèo chạy xuyên qua vòm (vòm là lớp W). Bấm **📷** chụp ảnh.

| Phần | Hành vi |
|---|---|
| **Khay đồ** | Tab nhóm, thẻ từng món: tên, giá, **đã có x2 · đang đặt 1**, nút **Mua** (hộp xác nhận), nút **Đặt** |
| **Bóng xem trước** | Theo con trỏ, **bám lưới 0,25**, xanh/đỏ, dòng lý do **đọc được bằng `aria-live`** — chính là `{ok, reason}` trả về từ `canPlace`, không bên nào tự viết câu chữ |
| **Chọn món đã đặt** | Bấm vào món: thanh công cụ ↺ xoay 45° · ✥ nhích · 🗑 **cất vào kho** (miễn phí) |
| **Thao tác nháp** | Mọi chỉnh sửa là **bản nháp** trên trình duyệt; **Lưu** gửi một lần, **Hủy** bỏ tất cả, **Hoàn tác/Làm lại** nhiều bước |
| **Rời trang khi chưa lưu** | Hỏi lại, không tự lưu |
| **Điện thoại** | Chạm để đặt, chạm món đã đặt để chọn; nút ≥ 44 px; **không** cần chuột phải hay rê chuột; bóng tự tắt ngay sau cú đặt (chạm không có "rê lại"). Di chuyển món bằng **nhích 0,25** chứ chưa kéo-thả trong 3D. *(kéo-thả: bản sau)* |
| **Máy chủ đổi giữa chừng** | Lưu bị `409` → "Đảo đã thay đổi ở nơi khác, hãy tải lại" (mục 11) |

### Bản bàn phím song song (bắt buộc, giống quy ước của trang đảo)
| 3D | Danh sách chữ |
|---|---|
| Kéo món lên mặt đảo | Chọn món → nút **Thêm vào đảo** → chọn **khu vực** (*Sân nhà · Quanh cây · Bờ nước · Lối đi · Ngoài rìa*) → đặt tại **vị trí trống đầu tiên hợp lệ** của khu đó |
| Kéo nhích | Món đang chọn: mũi tên **nhích 0,25**, `R` xoay, `Delete` cất vào kho |
| Màu xanh/đỏ | Dòng chữ lý do ("Chưa đặt được: sát ô Nhà") qua `aria-live` |
| Nhìn thấy bố cục | Danh sách **"Đồ đang đặt trên đảo này"** (tên, khu vực, nút nhích/xoay/cất) |

## 7. Luật đặt đồ — ✅ D1, `src/island-core.js`
Một hàm `canPlace(L, layout, item, x, z, rot, opts)` trả `{ok:true}` hoặc `{ok:false, reason:"…"}`, **không ném lỗi** (bóng xem trước gọi liên tục). **Server chạy lại** khi `PUT layout`; trình duyệt chỉ dùng để tô xanh/đỏ. `opts = {slots, baseFraction, fill}` — `slots` để xét khóa chủ đề/công trình lớn, `baseFraction` là độ liền khối của đảo trống, `fill:false` **chỉ** dành cho mô phỏng A/B.

| # | Luật | Giá trị thật (`DECOR`) | Hàm đã ship |
|---|---|---|---|
| 1 | Vị trí **bám lưới**, hướng trong 8 bước | `grid` **0,25**, `rotSteps` **8** | `snap`, kiểm ngay đầu `canPlace` |
| 2 | Món phải thuộc catalog và **đã mở khóa** | gói chủ đề cần đã hoàn chỉnh đảo cùng chủ đề; XL cần 1/2/4/8 đảo | `itemLockedReason`, `themeUnlocked` |
| 3 | **Trong mép nước** | `hypot(x,z) ≤ edgeOf(L,a) − 0,7 − r − 0,35` | `GEO.edge`, `GEO.petR` |
| 4 | **Không đè 5 ô đất** | `hypot ≤ s.ob + r + 0,9` là bị cấm (`s.ob` = 1,85 / 1,15 / `feo`) | `DECOR.slotGap` |
| 5 | **Món chặn không sát nhau** | `hypot < r₁ + r₂ + 1,0` là bị cấm | `DECOR.gap` |
| 6 | **Vùng cấm** quanh bát ăn và cửa nhà | bán kính **1,2** (+`r` hai bên với bát nước) | `DECOR.noGo`, `doorSpot`, `petSpot:"bowl"` |
| 7 | Ngân sách | **40** món/đảo, **12 món chặn**, **2 hiệu ứng**, **1 công trình lớn** | `maxTotal`/`maxBlock`/`maxFx`/`maxLandmark` |
| 8 | Mỗi **ô lưới** chỉ một món | "Ô lưới này đã có Luống hoa." | `sameCell` |
| 9 | **Đảo phải còn liền một khối** | phần đi được thuộc khối lớn nhất **≥ min(98%, mức đảo trống)** | `walkGrid`, `walkFraction`, `mayPinch` |

Kiểm cả bố cục một lần (khi `PUT layout`): `validateLayout(L, layout, owned, slots)` → `{ok, errors:[{index,item,reason}]}`, xét **từng chỗ một** với các chỗ khác làm nền, rồi mới đối **số sở hữu** ("Bạn đang có 2 Cây sồi, không đặt được 3."). Chuẩn hóa đầu vào từ trình duyệt: `normLayout(items)` → `{items, bad}` (rác bị loại kèm lý do, tọa độ làm tròn về lưới, `rot` ngoài 0..7 bị loại).

## 8. Thú và đồ trang trí — ✅ D1 (lõi) + ✅ D3 (nối vào trang 3D)
| Việc | Cách làm | Tình trạng |
|---|---|---|
| Đồ **chặn đường** (S/M/L/XL) | `blockersOf(L, layout)` → `{x,z,r}` nối vào `walkable(L, x, z, mg, blocks)` (cùng chỗ với 5 ô đất); `pickSpot(L, R, cx, cz, blocks)` **không chọn đích** nằm trong vật cản | ✅ lõi + ✅ trang 3D (D3): `BLK = blockersOf(L3, DEC.items)` truyền vào **9 lời gọi** trên **8 dòng** (`newAgent` 825 · `moveTo` 848 · thoát kẹt 851 · nghỉ→đi 862 · đích lang thang 869 · thôi theo sau 876 · `callPets` 917 · `VISIT.play` 973); đảo trống → `BLK` rỗng nên hành vi thú **y hệt trước** |
| Đồ **phẳng (W)** và **FX** | **Không** vào danh sách vật cản; thú đi qua; không làm đổi `walkFraction` | ✅ ca 4 |
| Thú đang đứng ở chỗ vừa trở thành vật cản | Cơ chế "chỗ đang đứng hết hợp lệ thì dịch về điểm an toàn" cứu được | ✅ ca 7 (10.000 bước, 0 điểm hỏng) |
| Đồ **dành cho thú** (nệm, bát nước, rổ bóng, cây leo, nhà chó) | Thêm "điểm hấp dẫn": thú `rest` gần nệm, `eat` gần bát nước, `play` gần rổ bóng | ⏳ bản sau |
| Bấm thú / bấm đồ | Không thưởng (giữ nguyên) | ✅ |
**Bất biến đã kiểm:** sau khi đặt đồ, mô phỏng thú đi **10.000 bước** cho **0 điểm hỏng**; thú không rời đảo, không đứng trong vật cản, không kẹt vĩnh viễn. Trong trình duyệt thật (D3): nhét một bụi cây `M` vào đường thú → **2.400 bước của hai thú, 0 lần** đứng trong vật cản; đứng lên giữa vật cản thì tự thoát sau **29 bước ≈ 1,45 s** (đúng ngưỡng kẹt 1,5 s ở `moveTo`).

## 9. Chụp ảnh đảo 📷 — ✅ D5
Hoàn toàn **ở phía người chơi, không gửi gì lên server**: không lưu ảnh, không kiểm duyệt, không rò thông tin cá nhân.
| Phần | Quy tắc | Đã ship (đo 04/11) |
|---|---|---|
| Vào chế độ | Nút 📷: **ẩn** nhãn nổi, thanh xu, tab, nút camera; chỉ còn cảnh | ✅ `body[data-shot]` + `.shotbar` nằm **trong** `.view`; `getComputedStyle`: `H1/tabs/panel/msg = none`, `#view = block`. Luật ẩn phải có `!important` vì thẻ "🔗 Liên kết nhanh" mang `display:flex` inline |
| Góc nhìn | 3 góc gợi ý (**Toàn cảnh · Cận nhà · Theo thú**) + xoay tự do; camera nhảy thẳng khi `prefers-reduced-motion` | ✅ `shotView(kind)` đặt **cả `V` lẫn `Vt`** nên máy nhảy thẳng tới góc, bất kể `RM` đang bật hay tắt; đảo chưa có thú thì góc 🐾 **nói thật** "quay về Toàn cảnh" (`{ok:false}`) |
| Xem trước giờ/thời tiết | Chỉ xem thử các tùy chọn **đã mở khóa** | ✅ không có đường nào tới kiểu chưa mở — tab 🎨 chỉ vẽ nút `Bật` cho phong cách đã sở hữu (D4) |
| Xuất ảnh | Dựng lại **một khung** rồi `toBlob` trong cùng lượt; **PNG**, cạnh dài tối đa khoảng 2.048 px (bản r128 dùng đổi `setSize` tạm rồi khôi phục) | ✅ `stage.size()` → `setPixelRatio(1)` + `setSize(ow,oh,false)` (trần 2.048) → **một** `render()` → `drawImage` sang canvas 2D → `toDataURL("image/png")` **cùng lượt**, rồi trả `pixelRatio` + cỡ + vòng sáng ô đất + bóng xem trước về nguyên trạng. Đo: **631×680 px · ≈0,06 MB · 264 ms**, `head = "data:image/png;base64,"` |
| Chia sẻ | `navigator.share` kèm tệp nếu trình duyệt hỗ trợ, nếu không thì **tải về** `dao-<n>-<ngày>.png` | ✅ `shotSave` dựng `File` từ base64 ngay trong trang; `canShare({files})` thì mở hộp chia sẻ, không thì `<a download>` + `URL.revokeObjectURL` sau 4 s. Đã đo: `dao-1-2026-11-04.png` |
| Dòng chữ trên ảnh | Chỉ **"Đảo số n · <chủ đề>"** (không tên người dùng, không địa chỉ) | ✅ `Đảo số 1 · Anh Đào 🌸` vẽ bằng `fillText` trên canvas xuất, **không** phải nhãn HTML; tự kiểm tra so từng ký tự với `themeOf(S.cur)` |
| Trợ năng | `aria-live` thông báo "Đã lưu ảnh"; nút thoát chế độ bằng `Esc` | ✅ `#msg` (vai trò `aria-live`) in `📷 <tên> · PNG w×h px · ≈MB · tải về máy / mở hộp chia sẻ / chụp thử (không tải) — ảnh chỉ nằm ở máy bạn, server không nhận ảnh`; `Esc` thoát (đo: `body.dataset.shot` trở lại `null`, shotbar `hidden`) |
| Không đụng ví | Một cú chụp **không** được gọi API nào | ✅ `shotCapture` chỉ đọc `DEC3.shot()`; ví Khách **80 → 80** qua mọi cú chụp, `xu_spend` không thêm dòng |

## 10. Hiệu năng — ✅ D4 (số đo thật ở mục 0)
| Mục | Quy tắc |
|---|---|
| Ngân sách | ≤ **40 món**, ≤ khoảng **600 khối** đồ trang trí/đảo (trung bình ≤ 15 khối/món). **Đếm thật bằng hook `Object3D.add`:** 12 món dựng tay **nhiều nhất 9 khối** (Luống hoa); **D4 xếp đủ trần 40 món** (12 chặn + 28 phẳng/FX) rồi đếm lại = **220 lần thêm con** cho cả 40 nhóm (≈ **4,5 khối/món**, đã tính cả 40 lần gắn nhóm vào cảnh) — **dưới xa 600**, và bố cục đó vẽ ra **273 lệnh vẽ · 22.390 tam giác · 45,9 ms/khung** trên máy chuẩn. **D5** đếm tiếp bằng `DEC3.info` (đếm `isMesh` của từng nhóm): 16 món dựng tay bây giờ là **3 → 10 khối**, bốn công trình lớn 🗿9 · 🌀9 · 🕰️10 · 🔭9 — **món nặng nhất vẫn dưới 15**, không món nào phải cắt khối |
| Lặp nhiều | Vật liệu **dùng chung** (`mat` đã cache). **`InstancedMesh` chưa làm và chưa cần**: phép đo D4 cho thấy nút thắt là **số món có khối** chứ không phải số lệnh lặp, và 🪫 Tiết kiệm đã giảm 273 → 41 lệnh vẽ (45,9 → 11,4 ms) nên đường này để dành nếu sau này nâng trần trên 40. Hình học thì **chưa gộp** — scene 2 món có 98 `geometry`, scene 40 món có 273 (bù lại tổng khối vẫn chỉ 4,5/món và nằm gọn trong ngân sách) |
| Ánh sáng | **Không thêm `PointLight`**. Đèn "phát sáng" bằng vật liệu `emissive` + mảng sáng cộng màu |
| Bóng đổ | Chỉ món M/L/XL đổ bóng |
| Chế độ 🪫 Tiết kiệm | Tắt bóng, **ẩn hiệu ứng (FX), thời tiết, bụi cỏ** (món **W/FX** bị bỏ qua ngay lúc `drawDecor`), giảm `pixelRatio` về 1; **đồ chặn đường vẫn vẽ** để `BLK` và hành vi thú không đổi. Đo trên bố cục 40 món: mesh 220 → **36**, lệnh vẽ 273 → **41**, hạt 70 → **0**, **45,9 → 11,4 ms** (~4 lần) |
| Giảm chuyển động | **Không** hạt, không nảy khi đặt, không pháo (giống trang đảo) — `RM` **cắt sạch 130 hạt xuống 0**, và `freeze(30)` đo **0,0000 đơn vị** di chuyển (mục 0) |
| Hạt thời tiết | Mưa 60 · Tuyết 50 · Hoa 45 · Sương 9, cộng với 70 hạt nền; **lớp này gần như miễn phí** (+0,4 ms, 98 → 156 lệnh vẽ) |
| Đo trên máy nào | Nút **⏱ Đo khung hình (60)** in số của đúng máy đang chạy (mỗi khung có `readPixels` để ép GPU trả hàng, không đếm thời gian gửi lệnh). **Số của máy yếu hơn thì người chơi tự đo**, vì dao động giữa các lần đo trên cùng máy đã ±25% |
| Dọn bộ nhớ | Dùng `disposeGroup` (đã có trong `D3`) khi gỡ món/đổi đảo |
| Chế độ tối | Không tốn khung hình: toàn bộ là biến màu trong `demo-core.css`; D4 thêm `--on-brand`/`--brand-text`/`--bad` để chữ đạt tương phản WCAG ở cả hai bảng màu (số đo ở mục 0) |

## 11. Dữ liệu và API — ✅ D2 + ✅ D5 (năm bảng + sáu route đã chạy thật, `test-decor-api.js` 19/19 ngày 04/11)
**Bảng mới** (tự tạo như `CSDL/island.sql`, **Khách (`user_id = 0`) cũng dùng được**):
| Bảng | Vai trò | Ràng buộc |
|---|---|---|
| `decor_owned` | Số lượng từng món người chơi đã mua | `PK (user_id, item_key)`, `qty >= 0` |
| `decor_placed` | Từng món đang đặt: `island_index`, `item_key`, `x`, `z`, `rot` | `rot` 0..7; `x`/`z` phải chia hết cho 0,25; **`UNIQUE (user_id, island_index, x, z)`** — một ô chỉ một món, chặn cả hai tab ghi cùng ô |
| `island_style` | Phong cách từng đảo + **`layout_ver`** | `PK (user_id, island_index)`; `layout_ver` chỉ tăng khi **lưu bố cục thành công** |
| `style_owned` | Phong cách đã mở khóa (cả tài khoản) | `PK (user_id, style_key)` |
| `decor_wish` (**D5**) | Danh sách mong muốn ≤10 món, một dòng một món | `PK (user_id, item_key)`, `pos smallint >= 0` quyết định **thứ tự hiển thị**; trần 10 kiểm bằng **mã** (`WISH_MAX` + `normWish`) chứ không bằng `CHECK`; **không** cột giá tiền — ước không bao giờ tiêu xu |
**`xu_spend.kind`** thêm hai giá trị `decor_buy` và `style_buy`. **Không cần migration**: cột `kind` **không có ràng buộc `CHECK`** (đã kiểm `pg_constraint` ngày 04/11 — khác cột `source` của `xu_ledger` vốn có CHECK), nên chỉ ghi chú lại trong `CSDL/town.sql`.`topic` = khóa món/phong cách, `slot` = `NULL`, kèm **số dư sau khi tiêu** đúng như các dòng `island_upgrade | pet_buy | pet_food` hiện có.

| API (đang chạy, tại `/api/islands/…`) | Việc | Lỗi |
|---|---|---|
| `GET /decor` | Danh mục (đã mở khóa/chưa), đồ đã mua, đồ đang đặt theo từng đảo, phong cách, giới hạn | — |
| `POST /decor/buy` `{item, qty}` | Mua (1..99), trừ ví — dùng `buyDecor` | `409` thiếu xu / chưa mở khóa, `400` món lạ |
| `PUT /decor/layout` `{island, baseVersion, items}` | **Thay toàn bộ** bố cục một đảo (nguyên tử), chạy `normLayout` + `validateLayout` | `400` vị trí sai (kèm lý do), `409` vượt số sở hữu / **phiên bản cũ** |
| `POST /style/buy` `{style}` | Mở khóa phong cách — `buyStyle` | `409` thiếu xu / đã mở, `400` khóa lạ |
| `POST /style` `{island, weather?, tod?, grass?, sky?}` | Chọn phong cách đã mở (miễn phí) hoặc trả về mặc định bằng `null` — `applyStyle` | `400` sai nhánh / món lạ / không chọn nhánh nào, `409` chưa mở khóa · đảo còn khóa |
| `PUT /decor/wish` `{items:[khóa]}` | **(D5)** Thay **cả** danh sách mong muốn bằng một mảng đã sắp xếp — `normWish` lọc trùng, kiểm từng khóa trong catalog và đếm trần 10; ghi `pos` theo thứ tự mảng | `400` không phải mảng / khóa lạ / vượt 10 món, kèm lý do tiếng Việt; **không có `409` vì không đụng ví**; danh sách rỗng là hợp lệ (= xóa hết) |
`PUT /decor/layout` **không bao giờ trừ xu**. Mua và đặt tách bạch để một lỗi bố cục **không bao giờ làm mất tiền**. `layout_ver` tăng mỗi lần lưu; hai tab cùng lưu thì **một thành công, một `409`** (dòng `island_state` đã bị `SELECT … FOR UPDATE` khóa cho cả tài khoản, `layout_ver` chỉ để phát hiện tab cũ).

**Năm chi tiết đã sửa khi làm thật (04/11):**
- **Luật 2 tính theo đảo đang lưu**: `slotBudget(decor, slots, exceptIsland)` trừ đồ đã đặt ở **đảo khác**, còn đồ trên chính đảo đó được tính lại từ bố cục mới — nếu không thì cất một món về kho cũng bị báo "vượt số đã mua" (ca 18).
- **Lỗi bố cục trả `status` từng món**: `canPlace` → `400`, vượt số sở hữu → `409`; đáp án lỗi kèm mảng `errors[]` (`index`, `item`, `reason`, `status`) để giao diện tô đúng món sai mà không phải đoán.
- **`transferGuestData` (`src/island.js` + gọi từ `src/auth.js`)** chuyển **7 bảng** đảo/thú/kho/trang trí của Khách (`user_id = 0`) sang tài khoản mới trong **cùng giao dịch** với chuyển ví; tài khoản đã có đảo thì trả `{moved:false, conflict:true}` và **không ghi đè** (ca 21). **D5** thêm bảng thứ **8** `decor_wish` vào đúng danh sách đó và ca 21 kiểm cả danh sách ước (đo: ước 3 món trước khi đăng ký → tài khoản mới nhận đúng 3 món, đúng thứ tự).
- **`POST /style` (D4) không được xóa ba nhánh còn lại**: `applyStyle` chỉ trả về nhánh người chơi vừa nhắc, còn bản đầu ghi đè **cả bốn cột** `weather/tod/grass/sky` → bật "Mưa" làm mất "Đêm". Nay ghép giá trị mới vào dòng đang có trong `decor.styles[island]` rồi mới `UPDATE` (ca 24 kiểm đúng đường đó).
- **Thứ tự danh sách ước cần một cột `pos` (D5)**: bản đầu `ORDER BY created_at, item_key` — nhưng cả danh sách được ghi bằng **một** câu `INSERT` nên `created_at` **giống hệt nhau**, kết quả là thứ tự trả về **alphabet** (`observatory` trước `pet_bed`) chứ không phải thứ tự người chơi bấm. Đã thêm `pos smallint` ghi theo chỉ số mảng và `ORDER BY pos` ở cả `readDecor` lẫn bộ kiểm (ca 25).

**Điều kiện tiên quyết (D0) đã xong:** `genIsland`, `edgeOf`, `walkable`, `pickSpot` **đã nằm trong `island-core.js`**, nên server tự kiểm được vị trí mà không cần trình duyệt khai gì. `stateView().catalog` đã giao sẵn `decor`, `styles`, `decorLimits`, `geo` để giao diện không phải tự tính.

## 12. Kiểm thử (0 token)
**Lõi thuần** `scripts/test-decor-core.js` — **8/8 đạt**, đã gắn vào `npm test`:
| # | Ca | Kết quả |
|---|---|---|
| 1 | Khóa món duy nhất; giá ≥ 1; lớp hợp lệ; tổng giá **3.573 / 1.229 / 830**; XL mở 1/2/4/8; **D5**: `byPack` — đúng **8 gói × 4 món**, mỗi gói một chủ đề thật | ✅ |
| 2 | `canPlace` từ chối **kèm lý do**: món lạ / lệch lưới / `rot` lạ / ra mép / đè từng loại ô đất / sát món chặn / chắn cửa Nhà / chắn bát nước (cả hai chiều) / món gói chưa mở / XL chưa mở — **D5** thêm chiều ngược: `coral_pile` đặt **được** trên đảo 7 đã nâng cấp tròn, và **không** mở hộ vì hoàn chỉnh đảo Anh Đào | ✅ |
| 3 | Vượt 40 món, 12 món chặn, 2 hiệu ứng, 2 công trình lớn | ✅ |
| 4 | Món W và FX **không** vào danh sách vật cản; hai món cùng ô lưới bị từ chối | ✅ |
| 5 | Vòng đá siết kín: `walkFraction` báo túi kín, `validateLayout` có lỗi bằng chữ, và không ai dựng được vòng đó từng món một | ✅ |
| 6 | **500** đảo ngẫu nhiên đặt tối đa đồ chặn | ✅ 12,0 món/đảo · nhỏ nhất **98,99%** · **0** đảo bị làm tệ hơn |
| 7 | Mô phỏng thú **10.000 bước** trên đảo có 12 món chặn | ✅ **0 điểm hỏng**, không kẹt vĩnh viễn |
| 8 | `genIsland(n)` không đổi khi có đồ (vân đảo 1..13 = `2155102802`) | ✅ |

**API thật** `scripts/test-decor-api.js` (Express + PostgreSQL tạm `decor_test`, theo khuôn `test-island-api.js`) — **✅ 19/19 đạt ngày 04/11** (`node scripts/test-decor-api.js`, hoặc `npm --prefix json run test:decor-api`; đã nối vào `test:wallet`):
| # | Ca | Kết quả |
|---|---|---|
| 9 | Mua đủ xu | ✅ ví trừ đúng giá × số lượng, `decor_owned` +qty, **một** dòng `xu_spend` `decor_buy` kèm số dư sau |
| 10 | Mua thiếu xu / món lạ / số lượng sai | ✅ `409` hoặc `400`, **không có dòng chi nào**, ví đứng nguyên |
| 11 | Hai cú mua cùng lúc khi chỉ đủ tiền một | ✅ `200` + `409`, ví không bao giờ âm |
| 14 | Món gói chủ đề / công trình lớn chưa mở | ✅ `409` nói rõ cần gì (kể cả khi đủ xu) |
| 12 | `PUT layout` hợp lệ | ✅ lưu đúng tọa độ đã bám lưới, `layout_ver` tăng 1, **ví không đổi**, **không có dòng chi** |
| 15 | `baseVersion` cũ | ✅ `409` kèm hướng dẫn tải lại, bố cục và phiên bản đứng nguyên |
| 16 | Hai `PUT` cùng lúc trên một đảo | ✅ một `200` + một `409`; bố cục lưu là **một trong hai bản**, không phải bản trộn |
| 17 | Vị trí sai và bố cục 41 món | ✅ `400` kèm `errors[]` chỉ đúng món sai (`index` 0 và 1), **không lưu một phần nào**, không tạo phiên bản ảo |
| 13 | Đặt vượt số đã mua; đặt món chưa mua | ✅ `409`, bố cục cũ đứng nguyên |
| 18 | Cất đồ về kho rồi đặt lại | ✅ `decor_owned` không đổi, **không hoàn xu**, dọn trắng cả đảo cũng hợp lệ |
| 20 | Đảo 1 và đảo 2 | ✅ độc lập về bố cục, nhưng tổng đồ đặt **không vượt số đã mua** (4 cái mua → đặt 2+2 thì còn 0) |
| 19 | Phong cách | ✅ mở một lần (60 xu), mở lại `409`, khóa lạ `400`, sai nhánh `400`, chọn lại **miễn phí**, `null` = về mặc định, **không đụng `layout_ver`** |
| 24 | **(D4)** Chọn **từng nhánh một** không được xóa ba nhánh còn lại | ✅ mua `t_night · w_rain · g_lavender · s_starry`, gửi **bốn cú `POST /style` rời nhau** → view **và** `island_style` vẫn giữ đủ bốn nhánh · ví **đứng nguyên** · `weather:null` chỉ xóa đúng nhánh trời |
| 25 | **(D5)** `PUT /decor/wish`: lưu **đúng thứ tự** người chơi bấm | ✅ gửi `["pet_bed","observatory","grass_tuft"]` → view trả về **đúng thứ tự ấy** (không phải alphabet — nhờ cột `pos`); gửi lại **rỗng** = xóa sạch; **ví đứng nguyên**, **không thêm dòng `xu_spend` nào**, `layout_ver` **không đổi** |
| 26 | **(D5)** Ước **quá trần** / khóa bịa / không phải mảng | ✅ 11 khóa → `400` "tối đa 10 món (bạn gửi 11)"; `"khong_ton_tai"` → `400`; `{items:"grass_tuft"}` → `400`; cả ba lần **danh sách cũ còn nguyên**; ước món **thuộc gói chưa mở** (Đáy Biển trên đảo Anh Đào) thì **200** — danh sách là mục tiêu, không phải cửa hàng |
| 27 | **(D5)** `wishRows` — cột "còn thiếu bao nhiêu xu" | ✅ `catalog.wishMax = 10`; ví 100 xu, món 300 xu → `missing = 200`; món **đã có trong kho** → `missing = 0`; ví giàu hơn giá món → `0`; số gửi về **trùng** phép tính trong `IslandCore` |
| 21 | Khách (user 0) chơi rồi đăng ký | ✅ đảo, thú, kho, đồ, bố cục, phong cách, **danh sách ước** (8 bảng) **chuyển sang** tài khoản mới; Khách còn **0 dòng**; tài khoản đã có đảo → `{moved:false, conflict:true}`, **không ghi đè** |
| 22 | Mọi API cũ (`/upgrade`, `/travel`, `/adopt`, `/food`, `/feed`, `/care`) | ✅ vẫn chạy, và `test-island-api.js` **18/18** (đã chạy lại 04/11) |
| 23 | Không đường nào làm xu **tăng** từ trang trí | ✅ chuỗi mua+đặt chỉ tiêu; `xu_spend` chỉ có `decor_buy`/`style_buy`; tổng chi = độ giảm ví |
**`QD.selfCheck()` trong trang — ✅ D3 + D4 + D5, 17/17 mục đạt** (mở `http://localhost:3000/quan-dao-vo-tan-three.html`, bấm 🧪 ở tab 🏝️): hai mục mới của D3 là
| Mục | Nội dung | Kết quả đo 04/11 |
|---|---|---|
| (a) | Dựng **toàn bộ catalog** bằng `DECOR_ALL` qua `decMesh`, món nào ném lỗi là nêu khóa | ✅ `Toàn bộ 78 món trong catalog dựng hình được — kể cả 8 gói chủ đề và 4 công trình lớn` (62 món ở D3–D4, D5 thêm 16) |
| (b) | Xếp **đủ trần món chặn** bằng `canPlace` thật (quét lưới 0,5), rồi cho `pickSpot` chọn **2.000 đích** giữa danh sách vật cản `blockersOf` | ✅ `Thú 2.000 bước giữa 12/12 món chặn — 12 món · 0 đích hỏng · 99.8% đảo còn đi được` |

Bốn mục mới của D4 (đo trên đúng cảnh đang vẽ, không có đường tắt riêng):
| Mục | Nội dung | Kết quả đo 04/11 |
|---|---|---|
| (c) | **Số hạt thời tiết** phải bằng đúng số trang khai (Mưa 60 · Tuyết 50 · Hoa 45 · Sương 9) và **bằng 0** khi 🪫 hoặc giảm chuyển động | ✅ ba lần chạy thật trên ba cấu hình: `Hạt thời tiết 🌧️ Mưa nhẹ = 60 hạt — tổng 130 hạt (nền + thời tiết) · chế độ đầy đủ` · `Hạt thời tiết (mặc định, không hạt) = 0 hạt — tổng 70 hạt (nền + thời tiết) · chế độ đầy đủ` · `Hạt thời tiết (mặc định, không hạt) = 0 hạt — tổng 0 hạt (nền + thời tiết) · đang tắt vì 🪫 Tiết kiệm` |
| (d) | **`freeze(30)`**: chạy 30 khung hình tính toán rồi so từng vị trí — bằng chứng "đóng băng **tuyệt đối**" | ✅ `Giảm chuyển động: 30 khung hình không làm vật nào nhúc nhích — 0.00 đơn vị / 2 vật (thú + 0 hạt + 2 món) · RM bật` (đo qua `QD.rm(true)`, không phải đổi cài đặt OS). Đối chứng cùng phép đo khi lá cờ tắt: `Chế độ đầy đủ: … — 41.80 đơn vị / 72 vật`, `136.42 đơn vị / 72 vật (thú + 70 hạt + 2 món) · RM tắt` (chạy lại lần hai ngày 04/11, khi đảo có 2 món trang trí) và `417.46 đơn vị / 132 vật` lúc đang mưa, `Chế độ 🪫 Tiết kiệm: … — 0.00 đơn vị / 1 vật · RM tắt · 🪫` — mục chỉ đạt khi `RM` bật cho **0.00** còn chế độ đầy đủ thì phải **có** chuyển động |
| (e) | **Catalog phong cách**: đủ 15 kiểu, mỗi nhánh có kiểu, tổng giá đúng | ✅ `15 phong cách trên 4 nhánh, tổng 830 xu — weather ×4 · tod ×4 · grass ×4 · sky ×3` |
| (f) | **Bảng phong cách có nút cho đủ 15 kiểu** và giá in ra **đúng giá lõi** (so từng thẻ với `DECOR_STYLES`) | ✅ `Bảng phong cách có nút cho 15 kiểu, giá đúng lõi — 15 thẻ · 11 nút Mở · 4 nút Bật` (số nút Đổi/Mở thay theo ví Khách; khách đã mở 4 kiểu nên còn 11 nút Mở) |

Bốn mục mới của D5 (mỗi mục tự đọc `IslandCore` hoặc dựng lại đúng khung hình đang vẽ, không có số viết tay):
| Mục | Nội dung | Kết quả đo 04/11 |
|---|---|---|
| (g) | Bốn **công trình lớn phải có hàm dựng riêng** (`DMESH`) và nằm trong ngân sách ≤15 khối — đếm bằng `DEC3.info` | ✅ `4 công trình lớn dựng tay, khối nhiều nhất ở một món = 10 — 🗿9 · 🌀9 · 🕰️10 · 🔭9 · 62 món vẫn qua khuôn chung` |
| (h) | **Chụp thử một khung hình**: ảnh phải mở đầu bằng `data:image/png;base64,`, cạnh dài ≤ 2.048, dung lượng đo được, rồi **trả máy về góc cũ** (`cam0`/`camSet`) | ✅ `📷 Chụp thử 612×472 px · ≈0.04 MB — dao-1-2026-11-04.png · trên ảnh có duy nhất dòng "Đảo số 1 · Anh Đào 🌸" · không gọi API nào` (chụp trong tab 🏝️; vào chế độ 📷 thì khung là **631×680 px · ≈0,06 MB · 264 ms**, đúng bằng `clientWidth × dpr`) |
| (i) | **Tám gói**: mỗi chủ đề đúng 4 món, và `themeUnlocked` chỉ mở **đúng gói của chủ đề đảo vừa hoàn chỉnh** | ✅ `32 món gói trên 8 chủ đề ×4 món, tổng 1229 xu — 🌸×4 🍁×4 🌴×4 ❄️×4 🥥×4 ☁️×4 🐚×4 ✨×4 · đảo khác chủ đề không mở hộ` |
| (j) | **Danh sách mong muốn**: gửi 11 khóa phải bị `normWish` chặn, cột "còn thiếu" phải khớp `wishRows` | ✅ `Danh sách mong muốn: trần 10 món (gửi 11 → 400), hàng "còn thiếu" tính đúng — 🌿đủ rồi · 🌷đủ rồi · 🌳đủ rồi · đổi danh sách không có dòng chi nào` |

Bảy mục nền vẫn nguyên (giá server giữ, 8 chủ đề, seed ổn định, 16 đảo không trùng hình, 10.000 điểm đi bộ, sàn 30 cho No bụng/Vui vẻ, không còn nút giả lập cộng xu) cộng hai mục (a)/(b) của D3. Máy không có WebGL: **(a)·(b)·(c)·(d)·(g)·(h)** tự bỏ qua và in một dòng `máy này không có WebGL — bỏ qua phần 3D, bảng chữ vẫn dùng đủ` (tự kiểm còn **12 mục**), còn **(e)·(f)·(i)·(j)** vẫn chạy vì chỉ đọc `IslandCore` và dựng bảng chữ.

## 13. Kế hoạch theo mốc
| Mốc | Việc | Tiêu chí xong | Trạng thái |
|---|---|---|---|
| **D0** | Đối chiếu mã thật; chuyển `genIsland`/`edgeOf` sang `island-core.js` | `test-island-core.js` 21/21, `test-island-api.js` 18/18 vẫn đạt, trang chạy y như cũ | ✅ 04/11 |
| **D1** | **Lõi trang trí**: catalog, `canPlace`, flood fill, giới hạn | Ca 1–8 đạt | ✅ 04/11 |
| **D2** | **Dữ liệu + API** (mua, `PUT layout`, phong cách) | Ca 9–23 đạt | ✅ 04/11 |
| **D3** | **Dựng hình** 12 món an toàn đầu tiên + chế độ trang trí + bóng xem trước + Lưu/Hủy + **bản bàn phím** + thú né vật cản | Ca 7 đạt trong trình duyệt; dùng được chỉ bằng bàn phím; 360 px không tràn | ✅ 04/11 — self-check **9/9** (62/62 món dựng được; **12/12** món chặn + 2.000 đích `pickSpot` **0 hỏng**, còn 99,8%); bàn phím thuần đặt được 2 món không chạm chuột; `360 px` → mép phải xa nhất **348 px**, `scrollWidth` = 360 (mục 0) |
| **D4** | Phần còn lại của catalog + **phong cách** + hiệu ứng + chế độ Tiết kiệm + **đo hiệu năng** máy yếu | Có số đo khung hình thật; bật giảm chuyển động thì đóng băng | ✅ 04/11 — **số đo thật** (mục 0): mặc định 29,8 ms ≈ 34 FPS · 40 món 45,9 ms → 🪫 **11,4 ms** (273 → 41 lệnh vẽ) · hạt mưa 60 (+0,4 ms) · `freeze(30)` khi giảm chuyển động = **0.00 đơn vị / 2 vật**, đối chứng 41.80–417.46 khi không bật; self-check **13/13**; ca **24** vá lỗi xóa nhánh của `POST /style`; **chế độ tối** đạt WCAG (mục 10) |
| **D5** | **📷 Chụp ảnh** + **4 gói chủ đề còn lại** + **công trình lớn** + danh sách mong muốn | Ảnh PNG tải được; gói mở đúng khi hoàn chỉnh đảo | ✅ 04/11 — catalog **78 món · 4.802 xu** (32 món gói = **8 chủ đề × 4** · 1.229 xu); **4 công trình lớn có hàm dựng riêng** 🗿9 · 🌀9 · 🕰️10 · 🔭9 khối, 62 món còn lại vẫn qua khuôn chung; 📷 xuất **PNG 631×680 px · ≈0,06 MB · 264 ms** bằng `toDataURL` đồng bộ, chỉ nằm ở máy người chơi; **`decor_wish` + `PUT /decor/wish`** (trần 10, gửi 11 → `400`) với hàng "còn thiếu N xu" tính từ giá lõi; bảng `test-decor-api.js` **19/19**, self-check **17/17** |
| **D6** | **Cân bằng giá bằng dữ liệu thật**, dọn tài liệu | Số liệu mục 5 được thay bằng số đo thật | ✅ 05/11 — mục 5 viết lại toàn bộ bằng **số đo**: thu nhập thật **trung vị 11 · p90 34 · cao nhất 39 xu/ngày** trên **3 người / 8 ngày-học** (2026-10-29 → 05/11); **một đảo đầy 40 món đo bằng `canPlace` thật = 120 … 4.410 xu, trung vị 1.480** (24/24 đảo đặt đủ 40 món) nên "đảo mẫu 863 xu" bị hạ xuống **chỉ là gần đáy khoảng**; ngày cày tính lại theo nhịp thật (**134,5** ngày cho một đảo trung vị, **1.100,4** cho 8 đảo + trang trí); nhịp cho ăn **đo từ luật** 9/24/45/120 xu/ngày/thú; `xu_spend` thật **31 dòng / 401 xu** (cột `cost`) và **0 dòng `pet_food`**, kèm **6/6 dòng trang trí khớp đúng giá niêm yết**. **Không đổi giá** — mẫu dưới ngưỡng **20 người × 280 ngày-học**; script mới `decor:sim:real` + `assert` khoảng đảo đầy gắn vào `decor:sim`, thêm đối chiếu từng dòng chi với giá niêm yết trong `decor:sim:real` để số liệu và giá không tự ý cũ lại · **kiểm tiếp trên web (chiều 05/11):** khay 🎨 **78/78 nút giá đúng lõi** (Σ 4.802), tab 📚 **17/17 ✅** — ba mục chạm thẳng số D6 (830 · 1229 · hàng "còn thiếu"), `GET /api/xu/history` in mỗi dòng chi bằng **`−cost`** nên giao diện **không** mắc nhầm cột tiền; bất biến thu−chi=dư thì **lệch ở cả hai tài khoản dev có chi** (Khách +250, id 9 −65) — dấu vết dữ liệu cũ, ghi chú ở mục 1 README-kinh-te-xu.md |
**Quay lại:** ẩn tab 🎨 bằng cờ cấu hình; **không xóa bảng**, đồ đã mua và bố cục đã lưu vẫn thuộc người chơi; các tab và API cũ **không bị ảnh hưởng**.

## 14. Cần bạn chốt (ảnh hưởng thiết kế)
Tám câu này **tôi đang chạy theo cột "đề xuất"**, vẫn đổi được mà không đụng cấu trúc:
| # | Câu hỏi | Đang làm theo |
|---|---|---|
| 1 | **Mua theo cái** (có thể mua nhiều) hay **mở khóa một lần rồi dùng vô hạn**? | Theo cái, để xu có chỗ tiêu dài hạn |
| 2 | Có cho **bán lại lấy xu** không? | Không; chỉ cất về kho miễn phí |
| 3 | Đồ **dùng chung mọi đảo** hay mỗi đảo mua riêng? | Dùng chung (thuộc tài khoản) |
| 4 | Có muốn **chia sẻ đảo cho người khác xem** (ảnh/đường dẫn trên server)? | **Vẫn chưa** — và D5 giữ đúng tinh thần đó: 📷 chỉ sinh PNG trong máy (`toDataURL`), **server không nhận byte ảnh nào** (kiểm chứng 04/11: `shotCapture` chỉ gọi `shotPNG` thuần máy, một lần chụp thử **không sinh request nào**, ví khách đứng nguyên 80 xu). Muốn chia sẻ thật thì phải thêm bảng ảnh + đường dẫn công khai, tức là chạm quyền riêng tư của tên đảo — hỏi lại trước khi làm |
| 5 | Cho người chơi **gõ tên đảo/biển hiệu** không? | Chưa (cần kiểm duyệt); đảo tự đặt "Đảo số n" |
| 6 | Giới hạn **40 món / 12 món chặn** có đủ rộng? | ✅ **đã đo ở D4, giữ nguyên 40/12** — bố cục đầy trần 40 món (12 chặn + 28 phẳng/FX) vẫn chỉ **4,5 khối/món** (220 lần `add`) và **45,9 ms/khung** trên máy chuẩn, 🪫 xuống **11,4 ms**; chưa cần `InstancedMesh`. Muốn vượt 40 thì đo lại trước khi nâng. **D6 kiểm thêm một chiều:** **24/24** đảo ngẫu nhiên nhét **đủ** 40 món bằng `canPlace` thật — trần 40 không phải chỗ nghẽn, và số xu phải trả của một đảo đầy đo được trong khoảng **120 … 4.410** |
| 7 | Mở **công trình lớn theo số đảo hoàn chỉnh** (1/2/4/8)? | ✅ **đã dựng ở D5, giữ 1/2/4/8** — `needDone` trong lõi: 🗿 1 · 🌀 2 · 🕰️ 4 · 🔭 8 đảo hoàn chỉnh, giá 300/500/600/800 xu, `itemLockedReason` in rõ "cần N đảo hoàn chỉnh (bạn đã có M)"; mỗi đảo **chỉ một** công trình lớn (`DECOR.maxLandmark = 1`, kiểm ở `canPlace`) |
| 8 | Chốt **bán kính chặn, khoảng trống 1,0 và 0,9** từ hằng số thật? | ✅ đã chốt 04/11 — xem bảng ở đầu file |

## 15. Tiêu chí hoàn thành
- Mua một món: ví trừ **đúng một lần**, mở lại trang số liệu **không đổi**; lỗi `409` thì cảnh **không đổi**. ✅ đạt (ca 9/10/23 trên PostgreSQL thật + **D3 trong trình duyệt**: bấm Mua → hộp xác nhận → 16 → 13 xu; bấm Hủy → ví **5 → 5**, kho **1 → 1**, tải lại vẫn **5 xu** và đúng 2 món đã lưu)
- Đặt, xoay, cất, Lưu/Hủy hoạt động bằng chuột, cảm ứng **và** bàn phím; bóng xanh/đỏ có **lý do bằng chữ**. ✅ đạt (D3 — `onTap` dùng cho cả chuột lẫn chạm; `R` + 4 phím mũi tên + `Delete`; fokus giữ nguyên khi bảng vẽ lại; lý do chính là `{ok, reason}` của `canPlace`, qua `aria-live`)
- **Không đặt được** bố cục làm đảo bị chia cắt; mô phỏng thú **10.000 bước vẫn 0 điểm hỏng**. ✅ lõi đã chứng minh (ca 5, 6, 7) · ✅ trong trình duyệt: **12/12 món chặn** xếp bằng `canPlace` thật + 2.000 đích `pickSpot` **0 hỏng**, thú chạy thật **2.400 bước 0 lần** đứng trong vật cản *(D3)*
- Cất đồ về kho **không mất gì**; không có nút hay đường nào **làm xu tăng**. ✅ đạt (ca 18/23, chạy trên PostgreSQL thật 04/11) · ✅ giao diện: đặt/xoay/nhích/cất/Hủy đều **không gọi API trừ xu**, chỉ nút Mua mới tiêu *(D3)*
- Ảnh PNG tải về đúng khung, **không có nhãn hay thông tin cá nhân**. ✅ **D5** — 📷 Chụp ảnh cắt hết bảng chữ (`body[data-shot]` ẩn mọi thứ trong `.wrap` ngoài `#view`, phải dùng `!important` vì thẻ "🔗 Liên kết nhanh" mang `display:flex` ngay trong `style=""`), chỉ còn đảo + thú + bảng tên đảo; xuất **631×680 px · ≈0,06 MB · 264 ms** trên máy chuẩn, trần 2.048 px, tên `dao-<số đảo>-<ngày>.png`; **không có đường nào đưa ảnh lên server** (chụp thử = 0 request, ví Khách đứng nguyên 80 xu); ảnh đi qua `navigator.share` khi trình duyệt cho chia sẻ file, nếu không thì `<a download>`.
- Máy yếu bật 🪫 Tiết kiệm vẫn chạy mượt; `prefers-reduced-motion` **đóng băng tuyệt đối**. ✅ **D4 đo thật**: bố cục nặng nhất 40 món **45,9 ms → 11,4 ms** khi 🪫 (273 → 41 lệnh vẽ, 220 → 36 mesh, 70 → 0 hạt) mà **vật cản vẫn giữ đủ 12** nên đường đi của thú không đổi; `RM` bật thì `freeze(30)` = **0.00 đơn vị di chuyển trên 2 vật**, đối chứng 41.80 (mặc định) và 417.46 (đang mưa) ở cùng phép đo khi cờ tắt.
- **Phong cách không được làm hỏng nhau và không đụng bố cục**: ✅ D4 — bật/tắt 4 nhánh **độc lập** (ca 24 + đo trong trình duyệt: `layout_ver` đứng nguyên **2** qua mọi lần đổi kiểu), mỗi nhánh có đường **↩ về mặc định miễn phí**, ví chỉ giảm ở đúng 4 cú `Mở` (300 → 80 xu cho 4 kiểu 60+60+50+50).
- 360 px không tràn ngang. ✅ đạt (D3 — bó `.wrap` ở 360 px: mép phải xa nhất **348 px**, `scrollWidth` = 360; nút ≥ 44 px theo `demo-core.css`) · chế độ tối ✅ **D4** — `demo-core.css` thêm `--on-brand`/`--brand-text`/`--bad`, quét 18 tổ hợp chữ/nền trên cả hai tab: **0 tổ hợp dưới 4,5** ở cả sáng lẫn tối (nút `.pri` trước chỉ **3,92/1,89** → nay **4,61/9,56**).
- **Danh sách mong muốn miễn phí, không có đường nào làm xu tăng**: ✅ **D5** — ⭐ Ước hiện trên cả 78 thẻ (khách 80 xu bấm 3 nút ⭐ Ước: `wish = ["grass_tuft","lantern","pet_statue"]`, bảng in "còn thiếu 220 xu" = 300 − 80, **ví vẫn 80 xu**, không có cú `xu_spend` nào); `PUT /decor/wish` chặn gửi 11 khóa (`400`, `WISH_MAX = 10`), danh sách rỗng là hợp lệ chứ không phải lỗi.
- **Số liệu mục 5 là số ĐO, không phải ước tính, và có ngưỡng rõ ràng để được đổi giá.** ✅ **D6** (05/11) — `decor:sim` nhét đầy đảo bằng **chính `canPlace`** nên khoảng tiền của một đảo đầy là số đo (**120 · trung vị 1.480 · 4.410 xu**, 24/24 đảo đạt đủ 40 món) chứ không phải công thức viết tay; `decor:sim:real` thay ba người học mẫu bằng thu nhập **đo từ lịch sử** (**trung vị 11 · p25 5 · p90 34 · cao nhất 39 xu/ngày** trên **3 người / 8 ngày-học**, cửa sổ đến 05/11) và cộng đúng chi đã ghi (`xu_spend` cột `cost` = **31 dòng / 401 xu**, `pet_food` **0 dòng**, **6/6 dòng trang trí khớp giá niêm yết**). Ba lớp kiểm trong script (hai `assert` khoảng đảo đầy + đối chiếu từng dòng chi với giá niêm yết) giữ cho "đảo mẫu viết tay" và bảng giá không bao giờ lệch nhau mà không ai biết. **Quyết định: không đổi giá** — mẫu dưới ngưỡng **20 người × 280 ngày-học**; ngưỡng đó in ra ngay mỗi lần chạy script.
- Mọi test cũ **vẫn đạt**: `npm test` = **15 bộ / 313 bài**, `test-island-api.js` **18/18**, `test-decor-core.js` **8/8**, bộ mới `test-decor-api.js` **19/19** (chạy lại 04/11 sau khi sửa `POST /style` và thêm 3 ca 25–27 về danh sách mong muốn). ✅ Ngoài ra `npm --prefix json run test:wallet` = **5 bộ / 114 bài** (thị trấn 26 · xu 32 · anh đào 19 · đảo 18 · trang trí 19), exit 0.
- Tự kiểm tra trong trang `QD.selfCheck()` **17/17 mục** (2 mục dựng hình + thú-né-vật-cản của D3, 4 mục phong cách + hạt + đóng băng của D4, 4 mục chụp ảnh + gói + công trình lớn + danh sách mong muốn của D5). ✅ 04/11
