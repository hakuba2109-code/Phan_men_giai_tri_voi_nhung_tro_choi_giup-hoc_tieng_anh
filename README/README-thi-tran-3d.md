# 🏘️🐉 Thị trấn 3D (Three.js) — mô hình, cách chạy, kiến trúc đã nối

> **Dành cho:** người đọc tiếp mã nguồn của tab **🏘️ Thị trấn** trong `Tro_Choi`.
> **Trạng thái (01/11/2026, cập nhật 02/11/2026 và 03/11/2026):** **ĐÃ NỐI VÀO ĐỒ ÁN**, không còn là bản thử. Mã chạy thật gồm bốn phần:
> `src/town-core.js` (luật) · `src/xu.js` (ví xu chung) · `src/town.js` (API `/api/town/*`) · `src/town3d.js` (cảnh 3D + hai adapter) · `public/vendor/three.r128.min.js` (thư viện để cục bộ).
> **02/11:** thị trấn **bỏ hai cư dân chó 🐶 + mèo 🐱**; giữa quảng trường là **🗽 tượng Nữ thần Tự do** chỉ trang trí, con thú của người chơi đứng chếch bên cạnh, và **cho ăn chỉ áp dụng cho đúng con thú đó**. Cùng ngày: thêm **🚶 dân thị trấn đi bộ vòng quanh đảo** — đông lên theo số nhà đã xây, **thuần trang trí**, không có trường dữ liệu, không bấm để được gì; và vì đi tới đi lui ~0,15 đơn vị/giây thì **gần như đứng một chỗ**, bản cuối đã đổi sang **đi tuần hẳn**: ~2 đơn vị một chiều, quay gót 180°, hết một vòng ~9 giây.
> **03/11:** **bỏ hoàn toàn "vật liệu riêng từng khu"** — cả thị trấn chỉ còn **MỘT VÍ XU** (`town_state.xu`) mà bài học · trò chơi · nộp file · quà đăng nhập · quà chuỗi cùng nạp vào, và cũng chính ví đó trừ khi xây (20/50/100), mua hạt (10) hay chăm cây anh đào. Vật liệu cũ **tự chuyển 1:1 sang xu** khi server khởi động (`convert:materials`). Đặc tả số liệu: [README-kinh-te-xu.md](README-kinh-te-xu.md).
> **03/11 (chiều):** bản demo một file **`public/thi_tran3D-three.html` chuyển sang LIVE** — bỏ hẳn nút "📖 Giả lập ôn bài (+60 xu)" và mọi số trong biến; trang đọc `GET /api/town`, xây bằng `POST /api/town/build`, cho thú nghỉ bằng `POST /api/town/rest`, chip hiện `🪙 N xu (ví chung) · hôm nay bài học còn A/60 xu`. Tên trùng **`thi_tran3D—three.html`** (gạch ngang dài) **đã xóa** khỏi `public/`; bản cũ có nút giả lập còn nguyên ở `backup/thi_tran3D—three.gia-lap-1103.html`.
> **Không tự tính tiền:** tab này **không** tự quyết định xu — mọi phán quyết do lõi `TownCore` đưa ra, và **server chạy lại đúng một hàm đó** trước khi ghi CSDL.
> Luật + số liệu chuẩn: [README.md mục "Thú ảo + Thị trấn 3D"](README.md#-thú-ảo--thị-trấn-3d-đã-có).

## 1. Chạy thử
| Cách | Việc cần làm |
|---|---|
| **Ứng dụng thật (khuyến nghị)** | `npm start` (script `start` nằm trong `json/`) → `http://localhost:3000/choi` → tab **🏘️ Thị trấn**. Cần PostgreSQL (`DATABASE_URL` trong `.env`); chưa đăng nhập thì chơi bằng tài khoản **Khách** của máy |
| **Bản demo một file, số liệu THẬT** | `http://localhost:3000/thi_tran3D-three.html` (chỉ còn **một** tên file — tên gạch ngang dài `thi_tran3D—three.html` đã xóa 03/11 vì trùng lặp). **Có** gọi API: `GET /api/town` quyết định hết — số dư, giá xây 20/50/100, danh sách khu theo chủ điểm trong CSDL; bấm xây → `POST /api/town/build`, cho thú nghỉ → `POST /api/town/rest`. Không còn bất kỳ nút "giả lập +N xu" nào; mở bằng `file://` thì trang báo "cần chạy qua máy chủ" chứ không tự in xu. Phải mở qua server vì trang nạp `/vendor/three.r128.min.js` (đường dẫn tuyệt đối) và `demo-core-three.js` + `demo-core.css` (tương đối, cùng thư mục `public/`) |
| **Không thấy Three.js** | Console phải báo `Không tải được three.js…`. Kiểm tra `public/vendor/three.r128.min.js` có tồn tại (603.445 B) và `GET /vendor/three.r128.min.js` trả 200 |
| **Hiện khung "Trình duyệt không chạy được WebGL…"** | Máy tắt WebGL hoặc card bị chặn (kiểm tra `chrome://gpu`). Tab vẫn hiện các bảng thao tác, chỉ mất khung cảnh |

## 2. Tóm tắt những gì có
```
        ☁            ☁
   ┌──────── hòn đảo nổi trên mặt nước ────────┐
   │   [Khu 1]      [Khu 2]      [Khu 3]       │   N khu xếp thành vòng,
   │          ╲  🌷   │    🌻   ╱              │   N = số chủ điểm THẬT (≤ 8),
   │      🚶    ╲  ┌──────────┐  ╱   🚶        │   mỗi khu 2×2 ô đất,
   │            │ 🗽  🐉   │                    │   6 bồn hoa vòng quanh
   │      🚶    ╱  └──────────┘  ╲   🚶        │   quảng trường: 🗽 ở giữa,
   │   ······[Khu 5]   ✦      [Khu 4]·····     │   thú đứng chếch bên · 🏆 = khu đủ 4 ô cấp 3
   └────────────────────────────────────────────┘
        vòng ······ = đường dạo, 🚶 dân đi tới đi lui
```
| Thành phần | Nội dung |
|---|---|
| Thư viện | **Three.js r128 để cục bộ** `public/vendor/three.r128.min.js`, nạp **chậm** bằng một thẻ `<script>` chèn lúc `mount()`. **Không** OrbitControls, **không** GLTFLoader — camera tự viết |
| Mô hình | **Dựng hoàn toàn bằng khối cơ bản** (hộp, trụ, nón, cầu, bát diện, mười hai mặt, lăng trụ đùn từ tam giác). **Không có file ảnh/mô hình ngoài** |
| Ánh sáng | 1 ánh sáng bán cầu + 1 ánh sáng mặt trời có **bóng đổ mềm** (`PCFSoftShadowMap`, bản đồ 2048×2048, vùng bóng `±20`) |
| Chủ đề | Theo **nút 🌗 của ứng dụng** (`data-theme` trên `<html>`, nghe bằng `MutationObserver`); ở chế độ Auto thì theo `prefers-color-scheme`. Ban đêm: nền `#12202f`, đèn yếu hơn, nước tối hơn |
| Tương tác | Kéo xoay, cuộn/chụm hai ngón zoom, **bấm ô đất → hộp xác nhận → xây**, bấm bồn hoa → tưới/thu, bấm thú → chào, bấm **🗽 tượng** / **🚶 dân đi dạo** → câu nhắc (tất cả đều **không thưởng**) |
| Nguồn dữ liệu | **Chỉ** `stateView` của `TownCore` (qua `GET /api/town/` hoặc adapter ngoại tuyến). Cảnh **không** tự đặt một con số luật nào |
| Trợ năng | Bảng "Xây bằng bàn phím" (chọn khu + 4 nút ô), bảng Vườn hoa và Thú riêng, vùng `aria-live`, canvas `role="img"` + `aria-label`, `Esc` đóng hộp thoại |

## 3. Cấu trúc và hàm chính
`src/town3d.js` — module UMD (`window.Town3D`), nhúng vào `toeic-game.html` qua `/*__TOWN__*/`; `scripts/build.js` gộp chung bundle với `town-core.js` (**64,5 KB / 66.001 B** chưa nén, có **làm nhỏ gọn** nên chú thích và khoảng trắng thừa bị bỏ) và kiểm bằng `new Function` trước khi ghi.

| Nhóm | Hàm / hằng | Việc |
|---|---|---|
| Adapter | `onlineAdapter()` · `offlineAdapter({key, topics})` · `recordAttempt(q, correct)` | Cùng mặt nạ: `getState` `setPet` `build` `garden` `feed`. Online: `POST` xong **GET lại toàn bộ state**; offline: nhân bản `town_state` vào `localStorage`, dựng `attempts` từ sổ cái tại máy, luật ném lỗi thì trả **Promise reject** y như online |
| Nạp thư viện | `THREE_URL` `loadThree()` | Chèn script **một lần**, hứa `reject` nếu hỏng |
| Khối dựng hình | `mat` `put` `B` `Cy` `K` `Sp` `Ro` | Hộp / trụ / nón / cầu / mái dốc; vật liệu **đệm theo màu** trong `MC` |
| Công trình | `model(i, lv)` | `THREE.Group` cho ô `i` (0–3) cấp `lv` (1–3) |
| Thú | `petModel(species, stage)` + `dragon` `dog` `fox` `cat` `owl` `egg` | **Năm loài đều có khối riêng**; giai đoạn 0 luôn là trứng. Cảnh **chỉ dựng một con**: `R.pet` |
| Tượng | `liberty(g)` | 🗽 giữa quảng trường: bệ đá hai bậc + tấm biển, áo choàng xanh đồng 5 nếp, vai–cổ–đầu, **mão 7 tia**, tay giơ đuốc vàng, tay kẹp phiến đá. **Thuần trang trí**, không có trường dữ liệu |
| Dân đi dạo | `villager(shirt, j)` `limb(...)` `villagerPlan(st)` `syncVillagers(st)` `moveVil(c, t)` `moveVillagers(t)` | 🚶 người thấp ≈ 1,3 đơn vị (thân / đầu / mũ có vành / hai tay hai chân là nhóm con quay được quanh khớp). **Thuần trang trí**: số người do `villagerPlan` đếm từ số **nhà đã xây thật** (1/khu, +1 khi có 2 nhà, +1 khi đủ 4, tối đa 3/khu và 12/đảo), áo nhuộm màu khu. `syncVillagers` chỉ dựng lại khi **tổng số người đổi**, và ghi vào mỗi người một lộ trình (`span`, `r`, `w`, `kick`, `ph`) suy ra từ `lane` + số khu; `moveVil` tính **sóng tam giác** cho đi đều chân, quay mặt theo chiều đi và vung chân tay đúng nhịp |
| Hoa | `flowerModel(bed, spec)` | Bệ đất → hạt → thân + lá → 6 cánh theo `color` của hoa; thêm giọt nước khi vừa tưới |
| Bố cục | `layout(n)` `buildStatic(L)` `buildWorld(st)` `metaOf(topic)` | Vòng khu tính theo số chủ điểm thật; `layout(n)` còn trả **`lane`** — bán kính đường dạo, luôn nằm trong mép trong của bệ khu và ngoài vòng bồn hoa; **đảo + cát + quảng trường + đường dạo + tượng nằm trong một nhóm `keep` do `buildStatic()` dựng, chỉ dựng lại khi bán kính đảo đổi**; icon/tên/màu lấy từ `TOPIC_META`, chủ điểm ngoài năm khu mặc định **băm tên** ra icon + màu |
| Đồng bộ | `refresh()` `applyState(st)` `syncWorld` `setLevel` | state → hình + nhãn + các bảng; **chỉ dựng lại mô hình khi chữ ký thay đổi** (dân đi dạo có chữ ký riêng, xem `syncVillagers`) |
| Hành động | `runAction(p, onOk)` `askBuild` `askGarden` `doFeed` `askNewPet` `confirmBox` | **Chỉ vẽ lại khi adapter hứa thành công** |
| Camera | `initCamera` `place` `V`/`Vt` `bindPointer` | Quỹ đạo có làm mượt, góc đứng 0,3–1,35 |
| Vòng lặp | `loop` | Camera, thú nhún, mây trôi, sao xoay, vòng sáng, hạt bắn, nhãn HTML chiếu từ 3D — **mỗi hiệu ứng đều kiểm `RM` trước khi đổi** |
| Dọn dẹp | `unmount()` `clearWorld()` `disposeGroup()` | Hủy `requestAnimationFrame`, `ResizeObserver`, `MutationObserver` + `removeEventListener` của `matchMedia`; **dispose geometry + material + `renderer.dispose()` + `forceContextLoss()`** |

## 4. Bố cục cảnh (đơn vị Three.js)
`layout(n)` với `n = min(số chủ điểm, maxVisibleDistricts = 8)`:

| Thứ | Giá trị |
|---|---|
| Vòng khu | `ring = max(6.4, n × 5.9 / 2π)` — mỗi khu chiếm **5,9** đơn vị cung |
| Đảo | `isl = ring + 4.6`; trụ cỏ bán kính `isl` cao 1,2 ở `y = −0,6`; vành cát `isl+0,7 … isl+1,3` |
| Mặt nước | Nằm ngang `y = −1,2`, màu đổi theo ngày/đêm |
| Quảng trường | Trụ bán kính **2,4** (mặt trên `y = 0,25`); **🗽 tượng ở tâm (0, 0,25, 0)**, cao tới `y ≈ 4,4` kể cả bệ; **thú đứng ở (1,8 · 0,25 · 1,3)** |
| Bồn hoa | **6 ô** trên vòng bán kính **3,6**, quay mặt vào tâm |
| Đường dạo | Vành `lane = max(4,55, ring − 2,6)`, dải cát rộng **0,84** ở `y = 0,02`. `lane` luôn **nhỏ hơn mép trong bệ khu** (`ring − 2,13`) nên không chui vào công trình, và **lớn hơn 4,1** (mép ngoài bồn hoa) nên không chồng hoa. **Toàn bộ chỗ đi lại của dân nằm trong dải này**: đo thật trên đảo 8 khu, bán kính của họ chỉ dao động **4,51 … 4,77** |
| Dân đi dạo | Mỗi người **đi tuần qua lại** chung quanh tâm **giữa hai khu**, biên độ `span = clamp(2π/n × 0,32, 0,42, 1,05)` → **±24,1°** ở đảo 8 khu (tức **1,95 đơn vị một chiều**, cả vòng đi–và–quay–về **7,8 đơn vị** hết ~**9,2 giây**). Bán kính `lane − 0,05 + (j−1) × 0,22` (ba hàng so le), cộng lạch bạch `±0,13…0,17` ra–vào mép đường. Vị trí theo **sóng tam giác** `(2/π)·asin(sin)` chứ không phải sin, nên họ đi **đều chân** rồi **quay gót 180°** ở đầu cung chứ không bị chậm dần như bơi. Tốc đặt trước là **0,8…0,96 đơn vị/giây** (người cao 1,3 → ~1,6 bước/giây), `w = tốc·π / (2·span·r)` nên **đổi `span` hay đổi số khu cũng không đổi tốc độ đi**; chân tay vung nhịp `kick = 2π·tốc/1,15` khớp với bước |
| Khu | Bệ **4,25 × 0,22** + mặt **4 × 4** cao 0,3, mỗi khu **quay mặt vào tâm**, có đường lát nối ra quảng trường |
| Ô đất | Bệ **1,75 × 1,75**, tâm lệch `±0,97` so với tâm khu |
| Cây, đá | Giữa hai khu, ở bán kính `isl−1,9` và `isl−1` |
| Ống kính | `fov 42`; bán kính **12 → isl × 4,2**; khoảng cách mặc định `clamp(ring × 3.9, 20, 46)`; sương mù `isl × 3,4 → isl × 8` |

## 5. Bảng mô hình công trình (4 loại × 3 cấp)
Mỗi công trình nằm gọn trong ô đất ~1,7 × 1,7. Cấp 0 chỉ là **bệ đất** (không có mô hình).

| Ô | Cấp 1 | Cấp 2 | Cấp 3 |
|---|---|---|---|
| 0 · Nhà ở | Lều chóp 4 mặt, cửa, cột cờ đỏ | Nhà tường kem, mái đỏ, cửa, 2 cửa sổ sáng | Nhà chính + cánh phụ, ống khói, mái đỏ sẫm, cây nhỏ |
| 1 · Cửa hàng | Quầy gỗ 4 cột, mái che nghiêng, 3 quả | Cửa hàng, mái nhà gỗ, **mái vải sọc đỏ trắng**, cửa, ô kính | Hai tầng, dải gỗ, **biển vàng**, 3 cửa sổ tầng trên, cửa, ô kính |
| 2 · Thư viện | Kệ gỗ xếp **10 cuốn sách** nhiều màu, mái nhỏ | Nhà kem, **mái xanh lam**, 2 cột trắng, bậc thềm | Bậc đá, thân nhà, **4 cột trắng**, đầu hồi, **mái vòm vàng** có đỉnh nhọn |
| 3 · Công viên | Cây non + 3 bông hoa | Cây thông 3 tầng + ghế gỗ | **Đài phun nước** 2 tầng (nước phát sáng nhẹ) + 2 cây nón |

Quy ước vẽ: cửa sổ dùng vật liệu phát sáng nhẹ; mái dốc đùn từ một tam giác; `flatShading` bật để ra phong cách **low-poly**.

## 6. Thú ảo, tượng và dân đi dạo giữa quảng trường
| Giai đoạn (ngưỡng XP `CONFIG.stageXp`) | Hình | Phụ kiện | Kích thước |
|---|---|---|---|
| 0 · Trứng (< 120) | Trứng kem đốm xanh/hồng — **muôn loài đều bắt đầu bằng trứng** | — | ×1,3 |
| 1 · Con non (≥ 120) | Rồng xanh: thân, bụng sáng, đầu, mắt, má hồng, mõm, sừng, cánh, đuôi, gai lưng, chân | — | ×0,9 |
| 2 · Thiếu niên (≥ 400) | như trên | **Nơ đỏ** | ×1,0 |
| 3 · Trưởng thành (≥ 900) | như trên | + **khăn xanh** | ×1,12 |
| 4 · Huyền thoại (≥ 1800) | như trên | + **vương miện vàng** | ×1,25 |

* **Chó 🐶 / Cáo 🦊 / Mèo 🐱 / Cú 🦉** có khối riêng (`dog` `fox` `cat` `owl`), dùng cùng bộ phụ kiện theo giai đoạn — nhưng **thị trấn chỉ dựng một con duy nhất**: con mà người chơi đã chọn, lớn theo XP của họ. Không còn "cư dân thường trực" nào (`CONFIG.residents` đã xóa).
* Hoạt ảnh: **nhún nhẹ** khi tỉnh; nhắm mắt + 💤 khi `pet.hunger.state` là `very_hungry` / `hibernating` / `resting`; nghiêng đầu khi `hungry`; **luôn quay mặt về phía camera** (xoay mượt).
* Nhãn 3D trên đầu thú ghi `emoji tên · giai đoạn` và đuôi `💤` (đang ngủ/nghỉ) hoặc `❤️` (đã cho ăn hôm nay) — đúng như phép thử thật: `🐉 Bi · Con non ❤️`. **Trạng thái đói nằm ở chip** đầu tab (`hungerLabel`: người mới · no · ổn · hơi đói · rất đói · ngủ đông · nghỉ), không nhồi vào nhãn.
* Bấm vào thú: nhảy một cái, **không thưởng gì** — *"Mình chào bạn thôi, bấm mình không có thưởng đâu nhé 🙂"*. Bấm cho ăn: bắn hạt hình tim + đúng lời của loài trong `FEED_LINES`.
* Bấm vào **🗽 tượng**: chỉ hiện *"Tượng Nữ thần Tự do chỉ là đài kỉ niệm giữa quảng trường — bấm không tốn gì và cũng không được gì."*, **không** đổi state.
* **🚶 Dân đi dạo**: không phải "cư dân" theo nghĩa cơ chế — **không có tên, không có nhãn, không có trong `stateView`**, không cho ăn, không xây. Chúng chỉ là hình người **đi tới đi lui** trên đường dạo — đi một mạch ~2 đơn vị, quay gót, đi về chỗ cũ, lặp lại — **số lượng suy ra từ dữ liệu thật** (mỗi khu 1 người; +1 khi khu có ≥ 2 nhà; +1 khi đủ 4 nhà; tối đa 3/khu, 12/đảo) nên xây thêm nhà thì đảo đông hơn, **không** có đường nào trừ xu hay cộng điểm. Bấm vào một người chỉ hiện câu nhắc.
* Chưa có thú: hiện bảng **chọn loài + đặt tên (1–20 ký tự)**; đã có thú thì bảng đó chỉ **đổi tên**, giữ loài (đúng như server).

## 7. Vườn hoa (kiểu Khu Vườn Trên Mây)
Bảng **🌷 Vườn hoa**: chọn hoa · 6 nút ô · dòng ghi chú (từ 03/11 **không còn ô "chọn khu lấy vật liệu"** — hạt mua bằng xu của ví chung).

| Tác vụ | Luật (đọc từ `CONFIG.garden`, không viết tay trong cảnh) |
|---|---|
| **Trồng** | Tốn **10 xu** trừ vào **ví chung**; hộp xác nhận nêu rõ giá, số dư hiện có và số dư sau khi mua |
| **Tưới** | **Miễn phí**, **tối đa 1 lần/ngày/ô**, cần **2 lần** để nở; ô đã tưới hôm nay bấm vào chỉ hiện lời nhắc "mai tưới tiếp" |
| **Thu hoạch** | Trả lại **+16 xu** vào cùng ví đó, và **ghi một dòng `xu_ledger` source `garden`** để lịch sử ví đối chiếu được; bị trần **32 xu vườn/ngày** — **vượt trần thì cây vẫn nằm nguyên**, không bẻ nửa bông trả nửa xu, **và không ghi sổ** |
| XP | Thu hoạch **không** cộng XP thú. XP chỉ đến từ ôn bài |
| Hình | Hạt → Mầm (thân + lá) → Hoa (6 cánh màu `flower.color`, tâm vàng) + giọt nước khi vừa tưới; nhãn `✨ … đã nở` / `💧 … Mầm (1/2)`; **ô trống không gắn nhãn** cho đỡ che |
| Nhắc | Chip ngày: "📖 Hôm nay: N lượt · +y/60 xu từ bài học · 🌷 vườn +z/32" |

## 8. Tương tác và điều khiển
| Thao tác | Kết quả |
|---|---|
| Kéo chuột / một ngón | Xoay (ngang) và nghiêng (dọc, 0,3–1,35) |
| Cuộn chuột / chụm hai ngón | Zoom trong khoảng `12 → isl × 4,2` |
| Nút ⟲ ⟳ ➖ ➕ | Xoay ±0,5 rad · zoom ±4 |
| Bấm ô đất **ví chưa đủ xu** | Báo đúng số còn thiếu — *"Cần 50 xu để lên cấp 2, bạn đang có 37 xu. Ôn bài, chơi trò chơi, nộp tài liệu hay đăng nhập mỗi ngày đều có xu."* — **không hỏi, không trừ** |
| Bấm ô đất **đủ xu** | **Hộp xác nhận**: "Xây Nhà ở cấp 2? — Tốn 50 xu (ví có 60 xu, xây xong còn 10 xu). Xây xong không rút lại được." |
| Bấm ô đã cấp 3 | "đã ở cấp tối đa" |
| Bấm bồn hoa | Ô trống → bảng trồng; chưa nở → tưới; đã nở → thu hoạch (việc **chi/mua hạt** và **thu xu** đều có hộp xác nhận; **tưới thì không**) |
| Vòng sáng xanh nhấp nháy quanh ô | Ô đó **đang đủ xu để xây** (cũng hiện khi rê chuột) |
| Chip đầu cảnh | `🪙 N xu` (`UI.els.chipXu`) — **đúng số dư `town_state.xu`** mà `GET /api/xu` và tab 🌸 anh đào hiển thị; có hậu tố `· quà hôm nay ❤️` khi vừa được tặng quà ngày |
| Khu đủ 4 ô cấp 3 | Ngôi sao vàng xoay trên khu + 🏆 trên nhãn khu |
| Khu ≥ 14 ngày chưa ôn | Bệ khu chuyển **xám** + 🕸️ trên nhãn (**chỉ là hình**, không trừ gì) |
| Bảng "Xây bằng bàn phím" | Danh sách **mọi** khu (kể khu thứ 9+), 4 nút ô; nút mờ nếu **ví thiếu xu**, `aria-label` ghi còn thiếu bao nhiêu xu |
| Bảng "🐾 Thú" | **Một nút cho ăn** cho đúng con thú của người chơi — mờ + "no hôm nay ❤️" khi đã ăn, `aria-label` "hôm nay đã cho ăn rồi"; chưa có thú thì thành bảng **chọn loài + đặt tên** |
| Bấm **🚶 dân đi dạo** | Câu nhắc "Đây là dân thị trấn… muốn đông người thì xây thêm nhà nhé" — **không** hộp xác nhận, **không** gọi API, **không** có bảng riêng (vì họ không làm được gì) |
| Kết quả mỗi hành động | Đọc qua vùng `aria-live`; **409/404 → cảnh giữ nguyên tuyệt đối**, **400 → xin state mới** vì dữ liệu cũ không còn đúng |
| Hiệu ứng khi xây / hái | Công trình **bật lên** (easeOutBack 0,5 giây) + 16 hạt sáng; hái hoa thì tim hồng |
| ~~Nút "Giả lập ôn bài"~~ | **Đã bỏ hẳn** — không có đường tắt nào tăng xu/XP trong tab 🏘️, và **hai bản demo một file cũng vậy** (03/11): `thi_tran3D-three.html` đọc `/api/town`, `quan-dao-vo-tan-three.html` đọc `/api/islands` |

## 9. Luật được giữ
| Luật theo README.md | Trong bản 3D đã nối |
|---|---|
| Chi phí **20 / 50 / 100 xu** trừ vào **một ví chung** | ✔ `CbuCost` đọc `TownCore.CONFIG.buildCost`, `canBuild` so với `st.xu.balance` (không còn két riêng từng khu) |
| Không bao giờ trừ gì ngoài lúc xây / mua hạt / chăm cây | ✔ chỉ `askBuild`, `plant` và tab 🌸 gọi adapter chi tiền; `stateView.xu.prices` đưa giá ra giao diện |
| Công trình chỉ là hình ảnh | ✔ |
| Ngưỡng XP thú 0/120/400/900/1800 | ✔ đọc `CONFIG.stageXp` |
| **Hộp xác nhận trước khi chi** | ✔ `confirmBox` + `Esc` + nút Hủy ("Hủy rồi, thị trấn không thay đổi gì.") |
| Trần 60 xu/ngày từ bài học, một lượt chỉ thưởng một lần, thưởng theo loại (3/4/2/1) | ✔ `town_ledger` + `UNIQUE (user_id, attempt_id)` phía server; các nguồn khác có trần riêng và `xu_ledger UNIQUE (user_id, source, source_ref)` |
| Đói / ngủ đông / ngày miễn đói / nghỉ | ✔ `pet.hunger.state` điều khiển hình + nhãn; **riêng nút "cho nghỉ" (`/rest`) chưa có trong tab** |
| Phủ bụi khu ≥ 14 ngày chưa ôn | ✔ |
| Công tắc bật/tắt tính năng | ✘ `POST /api/town/settings` đã có + có ca kiểm, **chưa có nút** |
| Lời của thú theo `FEED_LINES`, không từ cấm | ✔ cho ăn hiện đúng lời từng loài; bảng chọn thú chặn tên rỗng/dài quá 20 ký tự bằng **400 của lõi**, không phải bằng kiểm tra tự viết |
| Cho ăn **không đổi xu, không đổi XP** | ✔ `POST /feed` chỉ ghi `treats`; ca kiểm so số dư ví trước/sau khi ăn. **Chỉ cho đúng con của mình ăn**: sai loài `400`, chưa chọn thú `404` |
| Trang trí không có sức mạnh | ✔ 🗽 tượng và 🚶 dân đi dạo **không có trường dữ liệu nào**, không xây được, bấm chỉ hiện câu nhắc — cùng nguyên tắc với công trình và với thú. Dân đông lên theo **số nhà đã xây thật**, không trừ cũng không cộng gì |
| `prefers-reduced-motion` tắt **mọi** hoạt ảnh | ✔ dân đi dạo đóng băng **cả vị trí lẫn chân tay** (`moveVillagers` truyền `t = 0` khi `RM`), không còn trượt trên cung như mấy khung hình đầu |

## 10. Đã nối vào dự án thế nào (các bước từng đề xuất — nay đã làm)
1. **Tách file** → `src/town3d.js`; `S` của bản demo biến mất, thay bằng `stateView` từ adapter. `template.html` gọi `T3.mount(#townHost, {adapter})` ở `openTown()`, và `show(which)` gọi `T3.unmount()` khi rời tab.
2. **Ngoại tuyến**: `recordAttempt(q, correct)` được `recordAttempt()` trong `template.html` gọi khi chơi file tĩnh, đủ để `offlineAdapter` dựng lại **xu + XP** bằng đúng `TownCore.applyAttempts`. Ví ngoại tuyến nằm trong `localStorage` (mặc định `toeic.town.offline`, app thật dùng `<lsKey>.town`), và `load()` **tự đổi `materials` cũ 1:1 sang `xu` rồi xóa khóa cũ** — mở lại bản lưu trước 03/11 không mất gì.
3. **Ánh xạ `GET /api/town/` → cảnh** (đang chạy thật):

| Trường `stateView` | Trong cảnh |
|---|---|
| `xu.balance` | Chip **🪙 N xu**, điều kiện `canBuild` của mọi ô, mọi nhãn "Thiếu N xu" |
| `xu.today` (`lesson` `game` `file` `login` `streak` `garden`) + `xu.left` + `xu.caps` | Chip ngày và phần giải thích vì sao hết trần |
| `xu.prices` (`build` `seed` `harvest` `gardenCap` `maxLevel`) | Giá trong hộp xác nhận + dòng ghi chú vườn — **cảnh không tự viết số nào** |
| `xu.gift` (`length` `next` `due` `loginToday` `loginGift` `given`) | Đuôi `· quà hôm nay ❤️` trên chip, dòng chuỗi học, và thông báo quà **vừa tặng** (chỉ hiện một lần) |
| `districts[].topic` | Một khu; **số khu = số chủ điểm thật**, không cố định 5 |
| `districts[].earned` | Chữ số `· +N xu` trên nhãn khu (trước 03/11 là `districts[].materials` — **trường đó đã bị xóa**) |
| `districts[].plots` (4 số 0–3) | Cấp từng ô → `setLevel` |
| `districts[].done` | Ngôi sao vàng + 🏆 |
| `districts[].lastStudy` | ≥ 14 ngày → bệ xám + 🕸️ |
| `garden.beds[]` (`empty` `flower` `stage` `watered` `need` `mature` `canWater`) | 6 bồn hoa + nhãn + việc làm được hôm nay |
| `garden.seedCost` `waterings` `harvestGain` `gainCap` `gainedToday` `picked` | Dòng ghi chú và các trần hiển thị |
| `pet.species` `pet.name` `pet.stage` `pet.fedToday` | `petModel(species, stage)` + nhãn tên + đuôi ❤️; một nút "cho ăn" trong bảng 🐾 |
| `pet.hunger.state` | Nhắm mắt + 💤 / nghiêng đầu / nhún |
| `today_stats` (`attempts` `fedMin` `earned` `cap`) | Chip "📖 Hôm nay: N lượt · +y/60 xu từ bài học · 🌷 vườn +z/32" |
| `maxVisibleDistricts` | Số khu tối đa dựng trong cảnh |

🗽 **Tượng Nữ thần Tự do không có trường dữ liệu nào** — `liberty(g)` vẽ tĩnh giữa quảng trường, không nằm trong `stateView`, nên **không cần thêm cột hay migration**. `residents[]` của bản trước đã bị xóa khỏi API, và `pet.fedToday` là trường duy nhất mới thêm (do `stateView` tính từ `treats`).

🚶 **Dân đi dạo cũng vậy**: `villagerPlan(st)` chỉ **đọc** `districts[].plots` (đếm nhà) để quyết số người, không có mục `people` nào trong state — nên `town_state`, `town_ledger` và `/api/town/*` **không đổi gì**. Cùng một state luôn ra cùng số người, kể cả hai máy.

4. **Khi xây**: `askBuild` → `confirmBox` → `ADAPTER.build(topic, plot)` → **chỉ khi hứa thành công** mới bật model, bắn hạt, cập nhật nhãn. 409 thì cảnh đứng yên.
5. **Số khu khác 5**: `layout(n)` + `2π/n` + bán kính vòng tăng; `metaOf(topic)` băm tên cho chủ điểm ngoài năm khu mặc định.
6. **Trợ năng và tắt/bật**: giữ bảng bàn phím; `prefers-reduced-motion` (hằng `RM`, đặt lúc `mount`) **tắt mọi** hoạt ảnh: thú nhún, đuôi, mây, sao, vòng sáng, hạt bắn, hiệu ứng bật lên.

## 11. Thư viện và bản quyền
* Quy ước của dự án là **"không thêm gói npm/CDN mới"** — bản này **tuân thủ**: Three.js r128 là **tệp tĩnh để trong repo** (`public/vendor/three.r128.min.js`, 603.445 B, **giữ nguyên dòng bản quyền MIT**), không còn thẻ `<script src="https://…">` nào. `toeic-game.html` **không chứa URL CDN nào mới** (chuỗi `jsdelivr` duy nhất là mammoth, đã có từ trước và chỉ dùng khi mở file tĩnh).
* **Nạp chậm**: `loadThree()` gọi lúc `mount()`, `unmount()` dọn sạch — người không chơi thị trấn **không phải tải 600 KB**, và đóng tab là **không còn WebGL chạy nền**.
* Hình ảnh **tự dựng bằng khối**, không dùng tên/hình/âm của trò chơi hay nhân vật khác. Tên loài là tên chung (rồng, chó, mèo, cú, cáo). 🗽 lấy cảm hứng từ **công trình công cộng ngoài đời** (Nữ thần Tự do), vẽ lại bằng hình học cơ bản theo trí nhớ — **không chép mô hình/ảnh của ai**, và đứng một mình ở giữa quảng trường chứ không gắn với thương hiệu nào.

## 12. Cách mở rộng
| Muốn | Làm |
|---|---|
| Thêm kiểu công trình | Thêm nhánh `if (i === n)` trong `model(i, lv)` (dùng `B/Cy/K/Sp/Ro`), thêm tên vào `PLOT_NAMES` |
| Thêm loài thú | Viết `<loài>(g, st, eyes)` rồi đăng ký trong bảng tra của `petModel`; **giữ giai đoạn 0 luôn là trứng**; thêm vào `TownCore.PETS` — thị trấn chỉ dựng **một con** của người chơi nên không còn danh sách cư dân nào để đăng ký |
| Thêm đài/tượng trang trí | Viết hàm dựng khối (như `liberty(g)`) rồi gắn vào nhóm trong `buildStatic(L)`; **đừng** thêm trường vào `stateView` — trang trí không có state, không có luật |
| Đổi mật độ / tốc độ dân | Sửa các hằng trong `villagerPlan` (1/2/4 nhà, trần 3/khu · 12/đảo). Muốn họ **đi xa hơn** thì tăng hệ số `0,32` trong `span = clamp(2π/n × 0,32, 0,42, 1,05)` (span càng lớn, vòng đi càng dài nhưng `w` tự bù nên **vẫn đi đúng tốc độ đặt**); muốn **nhanh/chậm** thì sửa `speed = .8 + …` trong `syncVillagers`; muốn họ **lách qua lại trên mặt đường** thì sửa `wob`; `kick` lo bước chân, không cần đụng. Muốn dân **có chức năng** (làm nhiệm vụ, cho quà) thì phải làm luật ở `town-core.js` + API + ca kiểm trước, giống như thú — **không** cho giao diện tự quyết số liệu |
| Thêm hoa | Thêm phần tử vào `CONFIG.garden.flowers` trong `town-core.js` — cảnh đọc `st.garden.flowers`, **không** viết danh sách hoa thứ hai |
| Đổi chi phí / vườn / trần | Sửa `CONFIG` trong `town-core.js` **một nơi** (giá tiêu) và `CONFIG.xu` ngay dưới đó (nguồn thu); giao diện tự đổi vì mọi số liệu đều đọc từ state (kể đoạn intro của `openTown()`). **Không** sửa ở `town3d.js` và không sửa trong `xu.js` — file đó chỉ ghi sổ theo `CONFIG` |
| Nút "cho thú nghỉ" + công tắc bật/tắt | Thêm nút gọi `POST /api/town/rest` (`{days}` 0–14) và `POST /api/town/settings` (`{enabled}`) — API và ca kiểm đã có |
| Khu thứ 9+ có ô trong cảnh | Cho ống kính **pan/sang trang khu** hoặc thu nhỏ bệ khi `n > 8`; hiện tại bảng bàn phím vẫn xây được, chỉ mất hình |
| Thêm chu kỳ ngày đêm | `theme()` đang theo 🌗/hệ thống; đổi thành hàm theo giờ `CONFIG.tz`, thêm đèn cửa sổ sáng mạnh về đêm |
| Bớt nặng máy yếu | Giảm `shadowMap` 2048 → 1024, tắt bóng, `setPixelRatio` về 1, bớt mây (`R.sky`) |

## 13. Tiêu chí hoàn thành — đã đạt / còn lại
- ✔ Mở tab ở chế độ 3D: **đúng số khu, đúng cấp từng ô, đúng giai đoạn thú, đúng bồn hoa** so với `GET /api/town/` (kiểm bằng tài khoản thật: thú Bi — Rồng — Trứng, XP 45/120 từ sổ cái thật).
- ✔ Xây một ô: hộp xác nhận → gọi API → hình đổi → **xu trừ thẳng vào ví chung** (`40 → 20`, chip thành `🪙 20 xu`) → `aria-live` đọc kết quả; **hủy thì thị trấn không đổi gì**; **409 thì cảnh đứng yên**. (03/11: kiểm trên tài khoản Khách của máy dev — Nhà ở cấp 1 khu Đại từ, giá 20 xu.)
- ✔ Vườn hoa: mua hạt **−10 xu**, thu hoạch **+16 xu**, **trần 32 xu/ngày** và **cây còn nguyên khi vượt trần**, **không** cộng XP thú; mỗi lần thu ghi **đúng một** dòng `xu_ledger` source `garden`, lần bị từ chối **không ghi sổ** (`test-town-api.js` ca 22–23).
- ✔ Cho **con thú của mình** ăn: miễn phí, **một lần/ngày** (lần thứ hai bị 409 và **không** đổi state), **sai loài → 400**, **chưa chọn thú → 404**; **số dư ví trước/sau khi ăn bằng nhau**.
- ✔ 🗽 Tượng Nữ thần Tự do đứng giữa quảng trường ở **cả hai chế độ** (ngoại tuyến và tài khoản thật), bấm vào chỉ hiện câu nhắc, **không trừ/vẽ thêm số liệu nào**; nhóm đất + tượng chỉ dựng lại khi đảo đổi kích thước (`buildStatic`), không bị nhân đôi.
- ✔ 🚶 Dân đi dạo chạy thật trên tài khoản 8 khu: **8 người** trên đường dạo, mỗi người **đi hết một vòng đi–về trong ~9 giây**: đo bằng bơm khung hình (540 khung = 9,0 giây giả lập) ra **vòng quay 48,0…48,1°** (đúng biên độ ±24,1°), **quãng đường 7,3…8,7 đơn vị/người**, tốc **0,81…0,96 đơn vị/giây** (~0,014 đơn vị mỗi khung hình — **gấp ~3 lần** bản trước, vốn chỉ 0,0048 và gần như đứng một chỗ), **bán kính chỉ dao động 4,51…4,77** nên luôn nằm trong dải đường dạo 4,49…5,33; **quay gót 180° hai lần mỗi vòng** đúng như đi tuần. **Chưa xây nhà nào → mỗi khu đúng 1 người**, và kiểm ngoại tuyến: **4 nhà → 3 người, 2 nhà → 2 người** (tổng 5). Bấm một người → chỉ câu nhắc, **không** gọi adapter. Bật `prefers-reduced-motion` → **8 người đứng yên tuyệt đối** (vị trí + hướng + chân tay giống hệt nhau qua 40 khung hình, `y = 0`).
- ✔ **Không có đường nào** làm giảm xu, công trình hay XP ngoài lúc bấm xây / mua hạt / chăm cây (nút giả lập đã bỏ), và **không đường nào tự cộng xu** ngoài các nguồn có khóa trong `town_ledger`/`xu_ledger` → luôn đúng **Σ thu − Σ chi = số dư** đã đối chiếu trên CSDL dev chiều 03/11 (tài khoản Khách): `35 convert + 5 login − 20 build − 15 sakura = 5`, đúng bằng `town_state.xu`; 14 dòng `town_ledger` đời cũ nằm **dưới mốc đồng bộ** nên không cộng vào vế trái — xem ngoại lệ `upto` ở README-kinh-te-xu.md §1).
- ✔ Dùng được **chỉ bằng bàn phím**; bật `prefers-reduced-motion` thì **mọi** hoạt ảnh dừng; chế độ tối đọc được; màn 360 px không tràn ngang; số liệu **còn nguyên sau khi tải lại trang**.
- ✔ Rời tab: `unmount()` dừng vòng lặp và **giải phóng geometry/material/renderer + mọi listener** (đã sửa lỗi rò rỉ nhãn HTML — số node nhãn **= số khu + 6 bồn**, tài khoản 8 khu ra **14 node / 8 node có chữ**, không đổi khi dựng lại thế giới và **không tăng thêm khi có dân đi dạo**).
- ✔ Kiểm tự động: `scripts/test-town.js` **32 ca** và `scripts/test-sakura.js` **10 ca** (cả hai nằm trong `npm test`, tổng **258 bài**), `node scripts/test-town-api.js` **26 ca** trong schema tạm `town_test`, `node scripts/test-xu-api.js` **20 ca** ví xu, `node scripts/test-sakura-api.js` **19 ca** cây anh đào dùng chung ví (`npm --prefix json run test:wallet` = **65**), `npm run town:sim` mô phỏng nhiều ngày.
- ✘ Còn lại: **nút** cho `/settings` và `/rest`; ô 3D cho khu thứ **9+**. (Không còn mục "giai đoạn động cho thú phụ" — cư dân chó/mèo đã bỏ, mọi loài vẽ bằng `petModel(species, stage)` nên luôn theo đúng giai đoạn thật.)
- ℹ **Quay lại bản 2D/offline**: gỡ `src/town3d.js` khỏi `townBundle()` trong `scripts/build.js` và xóa tab 🏘️ là đủ — `town-core.js` + `/api/town` vẫn chạy cho mọi giao diện khác vì luật nằm riêng.
