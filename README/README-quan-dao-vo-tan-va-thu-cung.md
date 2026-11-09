# 🏝️🐶🐱 Quần đảo vô tận + Nuôi thú cưng — trạng thái bản một trang đã nối máy chủ

> **Dành cho:** người đọc tiếp `public/quan-dao-vo-tan-three.html`. **Từ 03/11 trang có lối vào ngay trên hàng tab của game** — mục **nhóm 🌸+🏝️** cạnh **🏘️ Thị trấn**, mở trong tab mới; vẫn là trang riêng, chưa phải panel nhúng.
> **Trạng thái (03/11/2026):** **ĐÃ NỐI MÁY CHỦ THẬT — không còn giả lập.** Số dư, tiến độ đảo, thú và kho thức ăn đọc/ghi qua `GET /api/islands` + 6 endpoint `POST` (**nay là 13 endpoint và tám bảng**, xem các mốc dưới đây); ba bảng mới `island_state` · `pet_owned` · `pet_pantry` (`CSDL/island.sql`, tự tạo khi `src/db.js` khởi động). Luật giá nằm ở **`src/island-core.js`** và trang nạp đúng file đó — trình duyệt không tự cộng trừ xu. `localStorage` chỉ còn một khóa duy nhất: **`qd-eco`** (nút 🪫 Tiết kiệm hình ảnh). **Cập nhật 04/11:** hình học (`genIsland` · `edgeOf` · `walkable` · `pickSpot` · `GEO`) và **lõi trang trí D1** (62 món + 15 phong cách + 9 luật đặt đồ, `test-decor-core.js` **8/8**) đã vào `src/island-core.js`; **D2 đã ship cùng ngày** — 4 bảng `decor_owned` · `decor_placed` · `island_style` · `style_owned` và 5 route `GET /decor` · `POST /decor/buy` · `PUT /decor/layout` · `POST /style/buy` · `POST /style` (`test-decor-api.js` **16/16** sau D4); **D3 đã ship tiếp cùng ngày** — tab **🎨 Trang trí** trong trình duyệt: khay **62 món** theo **12 nhóm** (8 nhóm chung + 4 gói chủ đề; giá/điều khóa đọc từ `IslandCore`), **12 món an toàn dựng tay** + 50 món qua khuôn, bóng xem trước **xanh `#46d37f` / đỏ `#e5484d`** kèm đúng lý do của `canPlace` qua `aria-live`, **bản nháp** đặt·xoay·nhích·cất + Hoàn tác/Làm lại (**không trừ xu**), một cú `PUT` khi Lưu, **bản bàn phím** 5 khu vực + `R`/mũi tên/`Delete`, và thú **né đồ chặn** (`BLK`); **D4 đã ship tiếp cùng ngày** — **bảng Phong cách 15 kiểu / 4 nhánh (830 xu)** ngay cuối tab 🎨 (mở một lần, **Bật/↩ miễn phí**, không đụng `layout_ver`), bốn nhánh áp **thẳng vào cảnh 3D** (`tod` · `grass` · `sky` · `weather`, chữ ký 4 nhánh tự rebuild), **hạt thời tiết** Mưa 60 · Tuyết 50 · Hoa 45 · Sương 9, **🪫 Tiết kiệm che món phẳng + FX và tắt mọi hạt nhưng vẫn giữ đủ 12 vật cản**, nút **⏱ đo khung hình thật** (`readPixels` từng khung) + `freeze(n)` + `QD.rm(v)` cho kiểm chứng, và **chế độ tối đạt tương phản WCAG** (token mới trong `demo-core.css`); **D5 đã ship tiếp cùng ngày** — **📷 chế độ chụp ảnh** (`body[data-shot]` cắt hết bảng chữ, ba góc 🏝️/🏠/🐾, **Esc** thoát) xuất **PNG 631×680 px · ≈0,06 MB · 264 ms** **ngay trong máy** qua `toDataURL` + `navigator.share`/`<a download>` (**server không nhận byte ảnh nào**), catalog **đủ bộ 78 món / 4.802 xu** (thêm 4 gói 🥥 ☁️ 🐚 ✨ → **8 gói × 4 = 32 món gói · 1.229 xu**), **4 công trình lớn dựng tay** 🗿9 · 🌀9 · 🕰️10 · 🔭9 khối (`DMESH`, `emissive` thay `PointLight`), và **⭐ danh sách mong muốn**: bảng `decor_wish` + route `PUT /decor/wish` **miễn phí** (trần 10 món kiểm bằng mã, `IslandCore.wishRows` tính cột "còn thiếu N xu"). Tự kiểm trong trang nay **17/17**. Trang **1.348 dòng / 120.358 B / 7 tab**. **Cập nhật 05/11 — D6 đã ship:** mục 5 của đặc tả giờ là **số ĐO** chứ không phải ước tính (`npm --prefix json run decor:sim:real`): thu nhập học tập thật **trung vị 11 xu/ngày** (3 người · 8 ngày-học, cửa sổ 29/10 → 05/11 · 0 ngày chạm trần 136), một đảo đầy 40 món nhét bằng `canPlace` thật nằm trong khoảng **120 … 4.410 xu (trung vị 1.480)**, `xu_spend` đã ghi **31 dòng / 401 xu** tính trên cột `cost` và **6/6 dòng trang trí chia đúng giá niêm yết**. **Không đổi một giá nào** vì mẫu còn dưới ngưỡng xét lại giá (≥ 20 người và ≥ 280 ngày-học). Còn lại những thứ **ngoài** mốc D0→D6: kéo-thả món thẳng trong 3D và "điểm hấp dẫn" cho thú — xem [README-trang-tri-dao.md](README-trang-tri-dao.md).
> **Nguồn đặc tả:** file “phân tích và thiết kế” người dùng đưa (15 mục, có kế hoạch theo mốc M1–M7). Tài liệu này ghi lại **những gì đã dựng + số liệu đo thật**, phần nào **chưa làm**.
> **Bản demo thị trấn** `public/thi_tran3D-three.html` **cũng đã nối `GET /api/town` từ 03/11** (bỏ luôn nút “Giả lập ôn bài +60 xu”; tên trùng gạch ngang dài `thi_tran3D—three.html` đã xóa khỏi `public/`); hai trang **dùng chung máy 3D** `public/demo-core-three.js` + `public/demo-core.css` (xem [README.md mục 46](README.md#-nhật-ký-cập-nhật-gần-đây)).

## 1. Chạy thử

| Cách | Việc cần làm |
|---|---|
| **Khuyến nghị** | `npm start` (script trong `json/`) → mở `http://localhost:3000/quan-dao-vo-tan-three.html`. **Phải mở qua server**: trang gọi `/api/islands` (đăng nhập hoặc làm Khách đều được) và nạp `/vendor/three.r128.min.js` theo đường dẫn tuyệt đối |
| **Đúp chuột vào file** | Không có cảnh 3D và **không có số liệu** — bảng hiển thị “🏝️ Trang cần máy chủ”, giải thích vì sao phải chạy qua `localhost:3000` |
| **Chơi lại từ đầu** | Không còn nút reset: tiến độ nằm trong CSDL theo tài khoản. Muốn đảo mới thì dùng tài khoản mới (Khách thì `DELETE FROM island_state/pet_owned/pet_pantry/decor_owned/decor_placed/island_style/style_owned/decor_wish WHERE user_id = 0` kèm dòng ví) |
| **Tự kiểm tra** | Tab **🏝️ Đảo của tôi** → nút **🧪 Tự kiểm tra hình đảo** in **17 mục** (hàm `QD.selfCheck()`; từ D5 self-check **tự chuyển về tab 🏝️** rồi mới chạy vì `#chk` chỉ tồn tại trong bảng đó). Ngày 04/11/2026: **17/17 ✅, 0 ❌** — bảy mục hình học/kinh tế như cũ, hai mục D3 (**78/78** món dựng được; **12/12** món chặn + 2.000 đích `pickSpot` **0 hỏng**), bốn mục D4 (**hạt thời tiết đúng số trang khai và bằng 0 khi 🪫/giảm chuyển động**; **30 khung hình đóng băng tuyệt đối** khi bật giảm chuyển động — `0.00 đơn vị / 2 vật`; **15 phong cách trên 4 nhánh, tổng 830 xu**; **bảng phong cách có nút cho đủ 15 kiểu với giá đúng lõi**), bốn mục D5 (**4 công trình lớn dựng tay ≤ 15 khối** — 🗿9 · 🌀9 · 🕰️10 · 🔭9; **chụp thử một khung PNG** `data:image/png;base64,` cạnh dài ≤ 2.048, ảnh > 1 KB, rồi **trả máy về góc cũ**; **8 gói × 4 món = 1.229 xu** và "đảo khác chủ đề không mở hộ"; **trần ước 10 món** + cột "còn thiếu" tính từ đúng ví) |
| **Kiểm tra thật bằng CSDL** | `node scripts/test-island-core.js` (**21/21**) và `node scripts/test-island-api.js` (**18/18**, Express + PostgreSQL thật, tự tạo/xóa schema tạm `island_test`). Từ 04/11 thêm `node scripts/test-decor-core.js` (**8/8**, luật trang trí thuần) và `node scripts/test-decor-api.js` (**19/19** — ca 24 buộc lỗi `POST /style` xóa nhánh còn lại không quay lại, ca 25–27 cho `PUT /decor/wish`; xem [README-trang-tri-dao.md](README-trang-tri-dao.md)) |
| **Máy yếu** | Nút **🪫 Tiết kiệm**: tắt bóng đổ, tắt hạt nền (cánh hoa/tuyết/bong bóng…), giảm cây bụi. Đảo, thú, xu giữ nguyên |
| **Người tắt hiệu ứng hệ thống** | `prefers-reduced-motion: reduce` → **đóng băng tuyệt đối**: không hạt nền, không nảy khi xây, không pháo, camera nhảy thẳng tới góc đích |

## 2. Những gì có

```
   ┌───────────── một hòn đảo (bán kính 8–11) ─────────────┐
   │   🏠 Nhà     🌳 Cây     [Công trình 1]  [2]  [3]       │  5 ô đất, mỗi ô cấp 0→3
   │        ╲        │        ╱  · vòng tròn xanh = đủ xu    │  5 ô cấp 3 = HOÀN CHỈNH
   │   🐱 🐶 ·  đi lại, ăn, ngủ, chơi  ·  ⛵ du thuyền        │  → mở đảo kế, đảo cũ còn nguyên
   │           · · · mép nước (không đi ra được) · · ·      │
   └─────────────────────────────────────────────────────────┘
        7 tab bên dưới khung cảnh: 🏝️ Đảo của tôi · 🗺️ Quần đảo · 🐾 Chuồng thú
                                  🛒 Cửa hàng thú · 🍖 Thức ăn · 📚 Bộ sưu tập · 🎨 Trang trí
```

| Thành phần | Nội dung |
|---|---|
| Thư viện | **Three.js r128 để cục bộ** `/vendor/three.r128.min.js` — không CDN, không npm mới. Không OrbitControls: camera tự viết trong `D3.orbit` |
| Mô hình | **Chỉ khối cơ bản** (hộp, trụ, nón, cầu, vành khuyên, lăng trụ đùn từ tam giác, bát diện, mười hai mặt). Không file ảnh/mô hình ngoài. Vật liệu `MeshStandardMaterial` **cache toàn cục** theo màu+options |
| Cảnh | 1 bán cầu + 1 mặt trời (bóng mềm 2048²), nước vô hạn, sương theo bán kính đảo, **4 khung giờ** (Sáng · Trưa · Hoàng hôn · Đêm) và **lệch tông màu** theo đảo biến thể |
| Nhãn nổi | `D3.labels` — `div` HTML chiếu tọa độ 3D → 2D mỗi khung hình (5 nhãn ô + 1 nhãn/thú đang ra đảo) |
| Nguồn dữ liệu | **`GET /api/islands`** — một lần đọc trả đủ: ví (`xu`), thu nhập hôm nay theo từng nguồn, tiến độ đảo, bản đồ quần đảo, danh sách thú, kho thức ăn và nguyên bảng giá (`catalog`). Mọi cú bấm là `POST` (xem §9); trang **không** tự lưu tiến độ ở đâu khác |

## 3. Số liệu chuẩn (đo trong trình duyệt, không phải tính trên giấy)

> **Đọc trước khi đối chiếu số (03/11/2026):** bảng dưới là **kinh tế đang chạy**. Một ví là `town_state.xu` do `src/xu.js` in từ **sáu nhóm cày + hai quà + vườn** (học **≤60** · học thêm **≤20** · game **≤30** kèm hạn ván theo từng mã: vịt 3, mỗi trò kỹ năng 2, mê cung 2 · ôn từ **≤15** · từ mới **≤6** · file **≤60** · đăng nhập **5** · quà chuỗi một lần đời · vườn **≤32**); **tổng trần cày học tập = 136 xu/ngày**, **không có** bảng `game_results` và **không có** trần 90 xu/ngày, trò chơi thật trả **4/3/15-10-6** chứ không ngẫu nhiên 2–6, và **ván do máy chủ cấp** (`xu_rounds` + `POST /api/xu/round/start|finish`). Nguồn chuẩn của phần đó: [README-kinh-te-xu.md](README-kinh-te-xu.md). **Chi phí nâng ô, giá thú, giá thức ăn dưới đây ĐÃ là mã chạy thật** (`src/island-core.js`), không còn là đề xuất.

**Kinh tế một ví xu**

| Mục | Giá trị | Kiểm chứng |
|---|---|---|
| Nguồn xu | học **≤60** · học thêm **≤20** · game **≤30** · ôn từ **≤15** · từ mới **≤6** · file **≤60** · đăng nhập **5** · vườn **≤32** · chuỗi (một lần đời, 8 mốc = **1.975**) → **136 xu "cày học tập"/ngày** | `test-xu-api.js` (32 ca) + `test-xu-moi.js` (19 ca) + `test-sakura-api.js` ca 6 · trang đảo chỉ **tiêu**, không có nút cộng xu (`selfCheck` ✅, ca 18 `test-island-api.js`) |
| Chi phí nâng ô | `10 / 25 / 50 × factor(n)` | `test-island-core.js` · `test-island-api.js` ca 4 |
| `factor(n)` | `min(3, 1 + 0,15·(n−1))` | `factor(9999) = 3` ✅ (`test-island-core.js`) |
| **Đảo 1** hoàn chỉnh | **425 xu** | `islandCost(1) === 425` ✅ · tiêu đúng 15 cú, ví về **0**, mở đảo 2 (`test-island-api.js` ca 6) |
| Đảo 2 | **490 xu** | `test-island-api.js` ca 7 khẳng định server trả `IC.islandCost(2)` *(xem §9 về 57,499999… → 57)* |
| Đảo 5 / đảo 15 | **680 / 1.275 xu** | `islandCost(15) === islandCost(24) === 1275` ✅ — trần hệ số làm đảo xa vẫn xong được |
| Giá thú | **cố định 40 / 50 / 120 / 300 / 600** theo hạng ⭐–⭐⭐⭐⭐ | `test-island-api.js` ca 10, 11 · **Không** hộp ngẫu nhiên, **không** tiền thật |
| Thức ăn | 3 / 8 / 15 / 40 xu → **+2 / +5 / +10 / +25** thân thiết | ca 12, 13 — cho ăn **không trừ xu lần hai**, chỉ trừ kho |
| Trần chăm sóc | **3 bữa** + **5 lần vuốt ve/chơi** / thú / ngày | ca 13, 14: bữa thứ 4 và lần thứ 6 bị `409` kèm giải thích |
| Sàn nhu cầu | No bụng và Vui vẻ **không bao giờ dưới 30** | ca 15: nghỉ 30 ngày → đúng **30/30**, thân thiết không giảm |
| Thân thiết | **Chỉ tăng** — thú **không ốm, không chết, không bỏ đi** | `friendLv()` + `CHECK (friend_xp >= 0)` trong `CSDL/island.sql` |
| Số thú ra đảo | **3 ban đầu, +1 mỗi đảo hoàn chỉnh, tối đa 6** | `seenFor()` — `test-island-core.js` “seenFor: 3 thú lúc đầu, +1 mỗi đảo hoàn chỉnh, trần 6” · `test-island-api.js` ca 6: xong đảo 1 thì `seen = 4` |

**12 giống thú** — 🐱 6 giống mèo, 🐶 6 giống chó; mỗi giống có tốc độ, cỡ, kiểu đuôi/tai/hoa văn riêng (`BREEDS`), hình đổi theo **10 mốc thân thiết** qua `petMesh(spec, lv)`.

| Hạng | Giống (giá xu) |
|---|---|
| ⭐ | Mèo ta cam vằn **40** · Mèo tam thể **50** · Chó ta vàng **40** |
| ⭐⭐ | Mèo Anh lông ngắn **120** · Mèo Xiêm **120** · Corgi **120** · Shiba **120** |
| ⭐⭐⭐ | Mèo Ba Tư **300** · Husky **300** · Poodle **300** |
| ⭐⭐⭐⭐ | Mèo mây (ánh sao) **600** · Chó mây (ánh trăng) **600** |

## 4. Tám chủ đề thiết kế tay (đảo 1–8)

| # | Chủ đề | 3 công trình (ô 3–5) | Hạt nền |
|---|---|---|---|
| 1 | 🌸 **Anh Đào** | ⛩️ Cổng torii · 🎏 Hồ cá koi · 🏮 Đèn đá | cánh hoa rơi |
| 2 | 🍁 Phong Thu | 🌀 Cối xay gió · 🍂 Đống lá · 🔥 Lò sưởi ngoài trời | lá bay |
| 3 | 🌴 Ốc Đảo | 💧 Giếng nước · ⛺ Lều thương nhân · 🌵 Xương rồng nở hoa | cát bay |
| 4 | ❄️ Băng Tuyết | ☃️ Người tuyết · 🧊 Hồ băng · 🌌 Cột đèn cực quang | tuyết rơi |
| 5 | 🥥 Nhiệt Đới | 💦 Thác nước · 🎋 Cầu tre · 🛶 Thuyền nhỏ | sóng |
| 6 | ☁️ Mây Trời | 🌈 Cầu vồng · 🎈 Khinh khí cầu · 🌀 Cối xay mây | mây trôi |
| 7 | 🐚 Đáy Biển | 🌿 Vườn rong · 🐟 Đàn cá · 🗝️ Rương cổ | bong bóng |
| 8 | ✨ Đom Đóm | 🍄 Nấm sáng · 🏮 Lồng đèn · 🔭 Đài quan sát sao | đom đóm |

Ô 1 luôn là 🏠 Nhà, ô 2 luôn là 🌳 Cây (cây **procedural**: thân/cành sinh bằng tham số, tán đổi màu theo cấp — lấy từ bản đảo hoa anh đào). **Đảo 1 đúng là đảo hoa anh đào** mà người dùng đưa làm chuẩn hình ảnh.

## 5. Vô hạn hóa: sinh đảo từ seed

* `genIsland(n)` với **`seed = hash("iso-" + n)`** (FNV-1a → mulberry32) → **mọi người chơi thấy cùng một đảo n**; `selfCheck` dựng lại 13 đảo nhiều lần, **giống hệt nhau** ✅. **Từ 04/11 hàm này và `hash` · `rand` · `edgeOf` · `walkable` · `pickSpot` · `doorSpot` · `treeSpot` nằm trong `src/island-core.js`** — trang chỉ nạp `IslandCore`, không còn bản sao nào; bán kính chặn của 5 ô lấy từ `CONFIG.themes[].feo` + `GEO.house = 1,85` / `GEO.tree = 1,15`, không còn mảng `feo` riêng của trang.
* `t = (n−1) mod 8` chọn chủ đề, `lap = ⌊(n−1)/8⌋` là **vòng biến thể**: từ vòng 1, bán kính · vị trí ô · giờ trong ngày · tông màu · độ sáng **lệch theo seed** nhưng **bộ hình vẫn khác nhau** (16 đảo đầu: 16 kiểu khác nhau ✅).
* 5 ô đặt theo góc và khoảng cách sinh ngẫu nhiên, sau đó **60 vòng đẩy** để không ô nào chồng nhau (cần `ob_i + ob_j + 0,6`), rồi **tỏa ra** sao cho mọi ô còn trong đảo và cách mép nước.

## 6. Thú đi lại — không có tường, vẫn không rời đảo

* Sáu trạng thái: `wander` (đi dạo) · `follow` (gọi thì tới) · `eat` (bát trước nhà) · `rest` (nằm 💤) · `play` (tha bóng) · `react` (nhảy lên chào). **Bấm thú / bấm mặt đất không cho xu** — thưởng chỉ đến từ học và chơi.
* **Đi thẳng + trượt tiếp tuyến**: mỗi bước thử đúng hướng đích, hướng đó bị chặn thì xoay ±0,85 rad rồi ±1,7 rad để trượt vòng qua vật cản; **kẹt 1,5 giây** thì coi như đích không tới được (chọn đích mới), và nếu ngay chỗ đang đứng cũng hết hợp lệ thì dịch về điểm an toàn. **Không** pathfinding, **không** kẹt quay tại chỗ.
* `walkable(L,x,z,mg,blocks)` (đã sang `island-core.js` từ 04/11) = trong mép nước (`edgeOf` theo góc, trừ `0,7+mg`) **và** ngoài bán kính chặn của 5 ô **và** ngoài mọi `{x,z,r}` trong `blocks`. Từ **D3 (04/11)** trang 3D truyền **`BLK = IC.blockersOf(L3, DEC.items)`** — danh sách món chặn đang đặt trên đảo này — vào **9 lời gọi** `walkable`/`pickSpot` (8 dòng: đích lúc sinh, `moveTo`, thoát kẹt, nghỉ→đi, thôi theo sau, `callPets`, `VISIT.play`). **Đảo trống → `BLK` rỗng → hành vi thú y hệt trước khi có tab 🎨**; món phẳng (W) và hiệu ứng (FX) **không** vào `BLK` nên thú đi xuyên qua. Đã kiểm: `test-decor-core.js` ca 7 (**10.000 bước, 0 điểm hỏng**) · tự kiểm trong trang **2.000 đích `pickSpot` giữa 12/12 món chặn: 0 điểm hỏng, còn 99,8%** · chạy thật trong trình duyệt **2.400 bước · 0 lần** đứng trong vật cản, và khi bị nhét vào vật cản thì thú tự thoát sau **29 bước ≈ 1,45 s** (đúng ngưỡng kẹt 1,5 s). **Mô phỏng 10.000 điểm: 0 điểm hỏng** ✅; bơm 1.200 bước thực: thú đi **46,6 / 55,9 đơn vị** mà `bad = 0`.

## 7. Điều khiển — 3D và bàn phím luôn song hành

| Chuột / cảm ứng | Bản sao bằng bàn phím |
|---|---|
| Kéo xoay · cuộn hoặc chụm hai ngón zoom · nút ⟲ ⟳ ➖ ➕ | 4 nút cùng tên (`D3.orbit.buttons(3)`) |
| Bấm **ô đất có vòng sáng** → hộp xác nhận → nâng cấp | Tab **🏝️ Đảo của tôi**: 5 thẻ ô, mỗi thẻ một nút (hiện đủ giá, còn thiếu bao nhiêu xu) |
| Bấm **thú** → chào (không thưởng) | Tab **🐾 Chuồng thú**: nút Vuốt ve / Chơi bóng / Cho ăn cho từng con |
| Bấm **mặt đất** → gọi 2 con chạy tới | Nút **📣 Gọi thú** (tab 🏝️ Đảo của tôi) |
| Bản đồ quần đảo → bấm đảo đã mở | Tab **🗺️ Quần đảo**: nút **⛵ Du thuyền** cho từng đảo (đảo cũ giữ tiến độ, có hộp xác nhận) |
| **Chế độ trang trí (D3):** chạm mặt đảo để đặt · bấm món đã đặt để chọn · rê chuột để xem bóng xanh/đỏ | Tab **🎨 Trang trí**: chọn món → **Thêm vào đảo** rồi chọn **khu vực** (Sân nhà · Quanh cây · Lối đi · Ngoài rìa · Bờ nước); món đang chọn: **`R` xoay**, **4 phím mũi tên** nhích 0,25, **`Delete`** cất về kho; lý do không đặt được in **bằng chữ** qua `aria-live` (cùng `{ok, reason}` với `canPlace` của server) |
| **📷 Chụp ảnh (D5):** bấm **📷 Chụp ảnh đảo** → bảng chữ chung quanh biến mất, chỉ còn cảnh + thanh góc | Chọn góc bằng nút **🏝️ Toàn cảnh · 🏠 Cận nhà · 🐾 Theo thú**, vẫn xoay/zoom tự do; **`Esc`** hoặc ✖ Thoát rời chế độ. Ảnh **chỉ nằm ở máy người chơi** (một cú chụp thử không sinh request nào). **⭐ Ước** trên mỗi thẻ món ghi vào `decor_wish` (**miễn phí**, trần 10 món, ước được cả món chưa mở gói) |

Hộp xác nhận (`D3.confirm`) **chặn mọi lần tiêu xu**; `Esc` hoặc **Hủy** thì không trừ gì. `aria-live` cho dòng tin, `role="img"` + `aria-label` cho canvas, nút tối thiểu 44px.

## 8. Lõi dùng chung `public/demo-core-three.js` (`window.D3`)

| Có trong lõi | Hai trang dùng |
|---|---|
| `$ clamp RM msg` + `confirm()` (hộp xác nhận + `Esc`) | cả hai |
| `mat put B Cy K Sp Ro` (khối cơ bản, cache vật liệu, `disposeGroup`) | cả hai |
| `stage()` — renderer, scene, camera, đèn, bóng, nước, `ResizeObserver`, `onDark()` | cả hai |
| `labels()` — `mk / clear / count / proj(cam, node, pos)` | cả hai |
| `orbit()` — kéo xoay, cuộn/chụm, `onHover`, `onTap`, `buttons(step)`, `tick()` | cả hai |
| `pops()` (nảy khi xây) · `sparks()` (pháo khối) | cả hai |
| `clouds()` — mây trang trí | chỉ bản thị trấn |

**Chỉ là demo hình ảnh.** Bản đồ 3D này **không** nạp vào tab game thật — `src/town3d.js` của trò chơi có adapter riêng và chỉ vẽ theo `stateView` của `TownCore`. **Phần số liệu thì đã thật từ 03/11:** hai bên dùng chung `src/island-core.js` và cùng một ví `town_state.xu`.

## 9. Khác biệt so với đặc tả (ghi rõ để khỏi hiểu lầm)

* **Đảo 2 = 490 xu chứ không phải 495:** `costOf` dùng `Math.round`, mà `50 × 1,15` trong IEEE-754 là `57,499999999999996` → **57**. Tổng 5 ô: `5·(12+29+57) = 490`. Không ảnh hưởng đảo 1 (425) và đảo ≥15 (1.275) vì các hệ số đó là số làm tròn đúng.
* **Trò chơi không cần bảng `game_results`:** bảng `xu_rounds` chỉ chứa **bằng chứng của ván đang mở** (`round_id` do server `crypto` sinh, `started_at`/`finished_at` theo đồng hồ máy chủ), còn chống trùng phần thưởng vẫn là `xu_ledger UNIQUE(user_id, source, source_ref)`. Từ 03/11 ván đi qua `POST /api/xu/round/start` → `/finish` (trình duyệt **không tự bịa** được `roundId` — sửa điểm V5); đường cũ `POST /api/xu/game` chỉ còn cho mê cung và tắt được bằng `CONFIG.xu.legacyGame`. Trang đảo **không có** nguồn thu nào — nó chỉ gọi `POST /api/islands/*` để **tiêu** xu (ca 18 của `test-island-api.js` kiểm đúng điều đó).
* **Bốn bảng đặc tả (`xu_wallet`, `game_results`, `user_island`, `pet_inventory`) gộp còn ba:** số dư là `town_state.xu` (không có `xu_wallet` thứ hai — một ví là nguyên tắc nền), đảo đang ở + số đảo mở nằm ngay trong `island_state` (không có `user_island`), kho thức ăn là `pet_pantry` (thay `pet_inventory`).
* **Một `island-core.js` thay cho hai file `island-core.js` + `pet-core.js`:** luật thú và luật đảo chỉ ~250 dòng nên gộp lại cho khỏi vòng `require` lẫn nhau; tên mốc M5 trong đặc tả vẫn giữ nguyên ý nghĩa.
* **Catalog vẫn 8 chủ đề thiết kế tay**, không phải 12 như bảng §5 của đặc tả: bốn chủ đề mới (Núi Lửa · Rừng Trúc · Pha Lê · Steampunk) **chưa** có bộ tham số hình. Thêm chủ đề = thêm một khối `{themes, BREEDS-style}` trong `island-core.js` + `THEMES` của trang, không đổi cơ chế.
* Trang **không xóa** được tiến độ một đảo (chỉ reset toàn bộ tài khoản), **không có tiếng động**, và **không có** chế độ “một đảo/ngày”.
* **🎨 Trang trí đảo đã có đủ CSDL + API + giao diện (D2 → D5, 04/11):** 78 món + 15 phong cách + 9 luật đặt đồ trong `src/island-core.js` (**8/8**), **năm bảng** `decor_owned` · `decor_placed` · `island_style` · `style_owned` · `decor_wish` tự tạo khi khởi động (Khách `user_id = 0` chơi được ngay), **sáu route** ở bảng dưới (**19/19** `test-decor-api.js`), và từ D3 là **tab 🎨 trên trang** — mua qua `D3.confirm`, đặt/xoay/nhích/cất trên **bản nháp không trừ xu**, **Lưu** một cú `PUT`, bóng xanh/đỏ in đúng lý do của `canPlace`, dùng được **chỉ bằng bàn phím**, thú né món chặn; **từ D4** cùng tab còn có **bảng Phong cách** (15 kiểu · 4 nhánh · 830 xu, `Mở` là nút duy nhất tiêu xu, `Bật`/`↩ Về mặc định` miễn phí và **không đụng `layout_ver`**) áp thẳng vào cảnh 3D, **hạt thời tiết** 60/50/45/9, **🪫 Tiết kiệm che món phẳng + FX** (vẫn giữ 12 vật cản) và nút **⏱ Đo khung hình**. **Số đo D4 trên máy chuẩn:** mặc định **29,8 ms ≈ 34 FPS**, có mưa **30,2 ms**, **40 món 45,9 ms → 11,4 ms khi 🪫**, và `freeze(30)` cho **0.00 đơn vị** khi bật giảm chuyển động. **Từ D5**: catalog **đủ 8 gói × 4** (32 món gói · 1.229 xu, tổng bộ 5.632 xu), **4 công trình lớn có hình dựng tay** 🗿9 · 🌀9 · 🕰️10 · 🔭9, **📷 chụp ảnh xuất PNG 631×680 px ngay trong máy** (0 request, ví không đổi), và **⭐ danh sách mong muốn** `PUT /decor/wish` miễn phí với trần 10 món. **D6 chốt vào 05/11:** kinh tế trang trí không còn là ước tính — số đo thật nằm ở mục 5 của đặc tả và trong `scripts/sim-trang-tri.js --db` (**thu nhập trung vị 11 xu/ngày**, **một đảo đầy 40 món = 120 … 4.410 xu**, **31 dòng `xu_spend` / 401 xu** trên cột `cost`), và **giữ nguyên mọi giá** vì mẫu chưa đạt ngưỡng 20 người × 280 ngày-học. **Chưa có:** kéo-thả món thẳng trong 3D và "điểm hấp dẫn" cho thú. Chi tiết và số đo thật: [README-trang-tri-dao.md](README-trang-tri-dao.md).
* **Chuyển dữ liệu Khách khi đăng ký vừa được vá (04/11):** trước đây `src/auth.js` chỉ chuyển `attempts` + ví + Thị trấn + Sakura, còn **đảo, thú và kho thức ăn của Khách bị bỏ lại** ở `user_id = 0`. Nay `Island.transferGuestData(client, 0, userId)` chạy **trong cùng giao dịch** đăng ký và chuyển **tám bảng** (`island_state · pet_owned · pet_pantry · decor_owned · decor_placed · island_style · style_owned · decor_wish` — bảng thứ 8 thêm ở D5 nên **danh sách ước của Khách cũng sang tài khoản mới**, đúng thứ tự; ca 21); tài khoản mới **đã có** dữ liệu đảo thì trả `{moved:false, conflict:true}` và **không ghi đè** (ca 21 `test-decor-api.js`).

**API đã chạy (`src/island.js`, gắn tại `app.use("/api/islands", …)`):**

| Endpoint | Việc | Lỗi thường gặp |
|---|---|---|
| `GET /api/islands` | một lần đọc trả ví + thu nhập hôm nay + đảo + bản đồ + thú + kho + `catalog` giá | — |
| `POST /api/islands/upgrade` `{slot}` | server tính giá theo số đảo, trừ ví, mở đảo kế khi đủ 5 ô cấp 3 | `409` thiếu xu / đã tối đa, `400` slot không phải số nguyên |
| `POST /api/islands/travel` `{index}` | sang đảo đã mở, tiến độ mọi đảo giữ nguyên | `409` đảo còn khóa, `400` số sai |
| `POST /api/islands/adopt` `{breed,name?}` | mua thú giá niêm yết; bỏ trống tên thì hệ thống đặt | `409` thiếu xu, `400` giống lạ / tên >20 ký tự |
| `POST /api/islands/food` `{item,qty}` | xu đổi thành đồ ăn trong kho (1..99) | `409` thiếu xu, `400` loại/số lượng sai |
| `POST /api/islands/feed` `{petId,item}` | trừ một phần ăn trong kho, **không trừ xu lần hai** | `409` đủ 3 bữa / kho hết, `404` thú không phải của mình, `400` món lạ |
| `POST /api/islands/care` `{petId,action}` | vuốt ve · chơi bóng, miễn phí, tối đa 5 lần/ngày | `409` đủ 5 lần, `400` hành động lạ |
| `GET /api/islands/decor` | *(04/11)* danh mục + đã mua + **đang đặt theo từng đảo** + phong cách + `left` | — |
| `POST /api/islands/decor/buy` `{item,qty}` | *(04/11)* mua đồ trang trí (1..99), trừ ví | `409` thiếu xu / món gói chưa mở / XL chưa đủ số đảo, `400` món lạ · số lượng sai |
| `PUT /api/islands/decor/layout` `{island,baseVersion,items}` | *(04/11)* thay **toàn bộ** bố cục một đảo, server kiểm lại 9 luật, **không trừ xu** | `400` vị trí sai (kèm `errors[]` lý do từng món), `409` vượt số đã mua / `baseVersion` cũ / đảo còn khóa |
| `POST /api/islands/style/buy` `{style}` | *(04/11)* mở khóa phong cách 40–80 xu, **một lần cho cả tài khoản** | `409` thiếu xu / đã mở, `400` khóa lạ |
| `POST /api/islands/style` `{island,weather?,tod?,grass?,sky?}` | *(04/11)* chọn phong cách đã mở, **miễn phí**; `null` = về mặc định của đảo | `409` chưa mở khóa / đảo còn khóa, `400` sai nhánh · món lạ · không chọn nhánh nào |
| `PUT /api/islands/decor/wish` `{items}` | *(04/11, D5)* thay **cả** danh sách mong muốn trong một giao dịch, **miễn phí** — không `xu_spend`, không đụng `layout_ver`; `[]` là hợp lệ (xóa hết) | `400` không phải mảng / khóa lạ / **hơn 10 món** (`WISH_MAX`), danh sách cũ **đứng nguyên** |

Mọi lần tiêu ghi một dòng `xu_spend` với `kind = island_upgrade | pet_buy | pet_food | decor_buy | style_buy`, `topic` = `island-<n>` hoặc giống/món/khóa phong cách, và **số dư sau khi tiêu** để đối chiếu; `SELECT … FOR UPDATE` trên dòng ví khiến hai cú bấm cùng lúc chỉ có một thành công (ca 8). Cột `kind` **không có `CHECK`** nên hai giá trị mới không cần migration. Route `PUT /decor/wish` (D5) **không ghi dòng `xu_spend` nào** — danh sách mong muốn miễn phí, nên ví và `Σ xu_spend` vẫn khớp (ca 25).

## 10. Mốc M1→M7 theo đặc tả §13 (cập nhật 03/11/2026)

| Mốc | Nội dung | Nghiệm thu |
|---|---|---|
| ~~**M1**~~ | ✔ **Đã xong**: `town_state.xu` + `xu_ledger`/`xu_spend`, `GET /api/xu`, `GET /api/xu/history` | đạt: idempotent (`test-xu-api.js` ca 1, 3), trần 60 (ca 6 của `test-sakura-api.js`), song song không nhân đôi (ca 8, 17), Khách vẫn chạy (ca 20), bật/tắt theo tính năng (`/api/town/settings`, `/api/sakura/settings`) |
| ~~**M2**~~ | ✔ **Đã xong, nâng cấp 03/11**: ván do máy chủ cấp (`xu_rounds` + `POST /api/xu/round/start + round/finish`), trần **30 xu** cho cả nhà trò chơi + hạn ván theo **từng mã** (vịt 3, mỗi trò kỹ năng 2, mê cung 2) | đạt: người chơi **không tự nâng điểm** được (ca 9 chặn game/roundId/hạng gian dối ở đường cũ; ca 21–24: ván phải do server cấp, đủ giây, đủ lượt đúng loại, chỉ một ván mở mỗi mã); một `roundId` chỉ thưởng **một lần** (ca 4, 21); bỏ ván hơn 2 giờ → `meta.abandoned`, không xu ván nhưng từng câu vẫn có xu bài học (ca 26); hai trò kỹ năng **không** ăn hạn của nhau (ca 27) |
| ~~**M3**~~ | ✔ **Đã xong (03/11)**: `src/island-core.js` (UMD — server và trang dùng chung) + `CSDL/island.sql` (`island_state`) + `src/island.js` (`GET /api/islands`, `POST /upgrade`, `/travel`) + sinh đảo từ seed | đạt: **21/21** (`test-island-core.js`) + **18/18** (`test-island-api.js`, PostgreSQL thật) — giá khớp §6.2 đặc tả, đảo `n` giống nhau mỗi lần dựng, chưa đủ 5 ô cấp 3 thì **không** mở đảo kế (ca 6, 9) |
| **M4** | 🟡 **Nửa xong**: 8 chủ đề + biến thể + bản đồ + du thuyền đã chạy trên `quan-dao-vo-tan-three.html`; **chưa** nhúng thành tab 🏝️ trong game | còn thiếu: panel trong tab game + ảnh chụp kiểm tra từng chủ đề |
| ~~**M5**~~ | ✔ **Đã xong (03/11)**: luật thú nhập cùng `island-core.js` + `pet_owned`/`pet_pantry` + `POST /adopt`, `/food`, `/feed`, `/care` | đạt: mua không đủ xu → `409` và **không có dòng thú nào** (ca 11); mua/nâng đồng thời **không âm ví** (ca 8); bữa thứ 4 trong ngày bị `409` (ca 13); chăm thú miễn phí, không tạo dòng chi (ca 14) |
| **M6** | 🟡 **Nửa xong**: 12 giống + `PetAgent` (6 trạng thái, 10.000 điểm đi bộ) + cửa hàng/chuồng/bộ sưu tập — tất cả ở trang riêng | còn thiếu: đưa sang tab trong game, hoạt cảnh cặp thú, phụ kiện theo cấp thân thiết |
| **M7** | 🟡 **Một nửa (D6 nối 05/11)**: đã có mô phỏng kinh tế `scripts/sim-xu-moi.js` (`npm --prefix json run xu:sim` — số học, `xu:sim:real` — **đo thật từ CSDL**) và mô phỏng trang trí `scripts/sim-trang-tri.js` (`decor:sim` — nhét đầy 40 món bằng `canPlace` thật; `decor:sim:real` — **đo thật thu nhập + `xu_spend`**); chưa: sim 90 ngày theo từng người chơi + rà hiệu năng máy yếu | `scripts/town-sim.js` là mẫu để viết bản sim cho đảo; hiện mới chỉ có mô phỏng 10.000 điểm đi bộ, 16 đảo đầu không trùng hình, và số ngày tới từng đảo ở ba mức độ học (xem §6.2 README-dao-vo-tan-va-thu-cung.md) — **chiều "dọn tài liệu" của M7 đã làm ở D6**: mục 5 đặc tả viết lại bằng số đo, bốn README cùng khớp một bộ số |

**Đã chuyển xong phần luật:** `hash rand genIsland edgeOf walkable pickSpot doorSpot treeSpot` + khối `GEO` **đã sang `src/island-core.js` ngày 04/11** (trước đây chúng nằm ở trang, chỉ để vẽ hình — nay server dùng lại đúng các hàm đó để tự kiểm vị trí đồ trang trí), cùng với `factor costOf islandCost upgrade travel adopt buyFood feed care friendLv decay stateView` và toàn bộ luật trang trí D1 (`DECOR DECOR_ITEMS DECOR_THEMED DECOR_STYLES canPlace validateLayout normLayout walkFraction blockersOf buyDecor buyStyle pickStyle`), nâng tổng số export của `IslandCore` lên **63** (D2 thêm `STYLE_KINDS` · `applyStyle`). **`localStorage` không còn chứa luật nào.**
