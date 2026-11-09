# 🏝️🐶🐱 Quần đảo vô tận + Game nuôi thú cưng — phân tích và thiết kế

> **Loại tài liệu:** phân tích ý tưởng và thiết kế để Qoder (hoặc lập trình viên) làm theo. **Toàn bộ kinh tế (mục 6, 10, M0–M2) và quần đảo + nuôi thú (mục 5–8, 10, M3 + M5) đã thành hiện thực ngày 03/11/2026** — phần **còn thiếu** chỉ là M4/M6 (nhúng tab trong game + ảnh chụp kiểm tra + phụ kiện thân thiết) và M7 (mô phỏng cân bằng 90 ngày).
> **Đã có sẵn, dùng lại được (`public/`, `src/`, `CSDL/`, `scripts/`):** trang 3D **`public/dao-hoa-anh-dao.html`** đã nối API, **`public/quan-dao-vo-tan-three.html`** (đảo + thú, nối `/api/islands`, **7/7 selfCheck**), **`public/thi_tran3D-three.html`** (nối `/api/town`), đặc tả `README/README-dao-hoa-anh-dao.md` + `README/README-quan-dao-vo-tan-va-thu-cung.md` (trạng thái từng mục), **ví xu thật `src/xu.js`** + đặc tả `README/README-kinh-te-xu.md`, **luật đảo + thú `src/island-core.js` (21/21)**, router **`src/island.js` + `CSDL/island.sql` (18/18 `test-island-api.js` trên PostgreSQL thật)**, lõi thuần `src/sakura-core.js` (10/10), lõi `src/town-core.js` (32/32 ca `test-town.js`), router `src/sakura.js` + `CSDL/sakura.sql` (`test-sakura-api.js` 19/19). Kích thước và vai trò từng file: mục 12.
> **Điều đã giả định và cần bạn chốt:** liệt kê ở mục 14. Chưa chốt thì các con số ở đây chỉ là **đề xuất khởi đầu**, chưa được cân bằng bằng dữ liệu người chơi thật.
> **Nguyên tắc nền (giữ từ các bản trước):** xu chỉ là phần thưởng hình ảnh, **không mở khóa câu hỏi, không đổi điểm hay lịch ôn**; **không có đường nào làm người chơi mất xu, đảo hay thú**; server là nguồn sự thật.

## 1. Ý tưởng một câu
Học bài và chơi game để **kiếm xu 🪙** → dùng xu **nâng cấp hòn đảo của mình** (nhà, cây, công trình) và **nuôi thú cưng** (mua chó mèo, mua thức ăn) → khi đảo hoàn chỉnh thì **mở đảo mới** với phong cách hoàn toàn khác, **không có đảo cuối cùng** → thú cưng chạy nhảy quanh nhà và cây trên đảo.

```
        ┌────────────── học bài (attempts) ──┐
        │                                     ▼
   🎮 chơi game ───────────────────────►  🪙 VÍ XU (một ví duy nhất)
                                              │
                      ┌───────────────────────┼────────────────────────┐
                      ▼                       ▼                        ▼
              🏝️ nâng cấp đảo         🐾 mua thú cưng           🍖 mua thức ăn
           (nhà, cây, 3 công trình)  (chó mèo nhiều giống)    (tăng thân thiết)
                      │                       │                        │
                      ▼                       └──────────┬─────────────┘
          đủ 5 ô cấp 3 = ĐẢO HOÀN CHỈNH                  ▼
                      │                    thú sống, đi lại trên đảo
                      ▼                    (vui, ngủ trong nhà, nằm dưới cây)
         🚀 mở ĐẢO KẾ TIẾP (khác chủ đề)
```

## 2. Phân tích yêu cầu (hiểu như thế nào, cần xác nhận gì)
| Bạn nói | Mình hiểu là | Rủi ro hiểu sai / cần xác nhận |
|---|---|---|
| "Nhiều hòn đảo khác nhau, vô số hòn đảo" | Có **catalog 8 chủ đề đảo thủ công** (mục 5), sau đó **sinh biến thể vô hạn** (đổi màu, giờ trong ngày, thời tiết, hình dáng, bố cục) nên đảo thứ 9, 50, 500… vẫn có đảo mới | "Vô số" thật sự vô hạn chỉ làm được bằng **sinh thủ tục**; mỗi biến thể không "đặc sắc" bằng đảo thiết kế tay. Chấp nhận được không? |
| "Thực hiện xong thì qua hòn đảo khác" | **Xong = hòn đảo hoàn chỉnh** (cả 5 ô nâng cấp đạt cấp 3) → mở khóa đảo kế tiếp. Đảo cũ **vẫn ở lại**, có thể quay về thăm | Có thể bạn muốn "xong = xong bài học" thay vì "xong = đủ nâng cấp"; hai cách làm khác nhau (mục 14) |
| "Khi thực hiện bài học thì nhận xu" | Mỗi lượt học đủ điều kiện được **xu**, dùng lại đúng cách tính của `town-core.js` | ✔ **Đã chốt và đã chạy:** giữ luật cũ **3/4/2/1, trần 60/ngày**, in xu **một lần duy nhất** tại `src/xu.js` (`town_ledger UNIQUE(user_id, attempt_id)`) |
| "Xu lấy từ các trò chơi, bài học" | **Một ví xu duy nhất** — thực tế là **chín nguồn**: `lesson`, `extra` (học thêm sau trần), `game`, `words` (ôn thẻ từ), `wordnew` (lưu từ mới), `file`, quà `login`, quà `streak`, `garden` | ✔ **Đã chốt và đã chạy (bảng xu mới 03/11):** không có bảng `game_results`; ván do máy chủ cấp (`xu_rounds` + `POST /api/xu/round/start + round/finish`) và `xu_ledger UNIQUE(user_id, source, source_ref)` chống trùng (mục 6.3, §2 của [README-kinh-te-xu.md](README-kinh-te-xu.md)) |
| "Lấy xu nâng cấp hòn đảo" | Xu mua nâng cấp cho **5 ô của đảo đang chơi** | Chi phí cân bằng ở mục 6.2 |
| "Chó mèo: giao diện game nuôi thú cưng, mua thức ăn bằng xu" | Màn nuôi thú: **mua thú, mua thức ăn, cho ăn, vuốt ve, chơi** | Thú **không bao giờ chết hay bỏ đi** (mục 8.3); đói chỉ làm thú buồn ngủ, **không phạt** |
| "Chó mèo có nhiều loại khác nhau để mua thêm" | Catalog **12 giống** (6 mèo, 6 chó) chia 4 độ hiếm, **mua với giá cố định** | **Không dùng hộp quà ngẫu nhiên** (mục 9) |
| "Hòn đảo có ngôi nhà và cây" | **Mọi đảo đều có đúng một nhà và một cây** làm hai mốc chính, kiểu dáng đổi theo chủ đề | — |
| "Thú cưng di chuyển xung quanh hòn đảo" | Thú là các **tác nhân tự đi lại** trên mặt đảo, tránh nhà/cây/nước, ngủ trong nhà, nằm dưới cây, chạy về phía bạn bấm | Số thú tối đa hiển thị cùng lúc (đề xuất **6**, vì hiệu năng) |

**Quyết định lớn đã chốt và ĐÃ LÀM xong (03/11/2026):** hợp nhất thành **một ví xu**, bỏ hai ví cũ (xu riêng của Đảo hoa anh đào và vật liệu riêng từng khu của Thị trấn). Lý do: bản cũ một câu đúng được thưởng ở hai ví, người chơi khó hiểu "tiền" nào dùng vào đâu. Kết quả thật: `town_state.xu` là số dư duy nhất; **Thị trấn xây bằng xu (20/50/100), vườn hoa mua hạt bằng xu (10) và thu 16 xu, cây anh đào tưới 5 / bón 20 xu**; migration `xu.migrateAll(db)` chạy tự động sau `applySchema()` đổi vật liệu cũ + xu anh đào còn lại **1:1** sang ví và ghi một dòng `xu_ledger source='convert'`. Chi tiết: [README-kinh-te-xu.md](README-kinh-te-xu.md).

## 3. Nguyên tắc thiết kế
| # | Nguyên tắc | Bảo đảm bằng |
|---|---|---|
| 1 | Không phạt: xu, đảo, thú không bao giờ giảm ngoài lúc **người chơi tự tiêu** | Không có mã trừ xu ngoài `spend`; thú chỉ đổi tâm trạng, **không có mức "chết/bỏ đi"** |
| 2 | Server là nguồn sự thật | Giao diện chỉ gửi **ý định** (`nâng ô nhà`, `mua mèo X`); giá, số dư, điều kiện do server tính |
| 3 | Mỗi lần kiếm xu **đúng một lần** | `UNIQUE (user_id, source, source_ref)` trong sổ cái; chỉ cộng dòng chèn được |
| 4 | Không thưởng để cày | Trần xu mỗi ngày, mỗi lượt học/ván game chỉ thưởng một lần, giới hạn bữa ăn/ngày cho từng thú |
| 5 | Không cờ bạc, không tiền thật | Mua với **giá cố định**; không hộp quà ngẫu nhiên, không mua xu bằng tiền |
| 6 | Dễ tiếp cận, nhẹ máy | Mọi thao tác đều làm được bằng **danh sách chữ** (không chỉ chạm cảnh 3D); giảm chuyển động; chế độ tiết kiệm máy yếu |
| 7 | Nghỉ bao lâu cũng không mất gì | Không có chuỗi ngày bắt buộc; quay lại chỉ thấy thú vui vẻ chào |

## 4. Vòng chơi và cảm xúc
1. **Học/chơi** vài phút → có xu (thấy số xu nhảy lên ngay ở màn kết quả).
2. **Chọn tiêu xu:** nâng cấp đảo (thấy đảo **đẹp lên tức thì**, có hiệu ứng) hay mua thức ăn/thú (thấy thú **vui, chạy lại gần**).
3. **Mục tiêu gần:** đủ xu cho ô kế tiếp (thường vài ngày); **mục tiêu xa:** hoàn chỉnh đảo để mở đảo mới.
4. **Phần thưởng hoàn chỉnh đảo:** cảnh bay sang đảo mới, thêm **ô chỗ cho thú**, có thể nhận một phụ kiện cho thú.
5. Đảo cũ không biến mất: bản đồ quần đảo giữ mọi đảo đã mở, **ghé thăm** bất cứ lúc nào.

## 5. Catalog đảo (8 chủ đề gốc + 4 chủ đề mở rộng thiết kế tay)
Mọi đảo có **5 ô nâng cấp**: **Nhà**, **Cây** và **3 công trình riêng của chủ đề**; mỗi ô có cấp 0 (đất trống) đến cấp 3. Đảo hoàn chỉnh khi cả 5 ô đạt cấp 3.

### 5.0 Danh mục 12 chủ đề thiết kế tay
> **Trạng thái mã (03/11/2026):** `island-core.js` + `THEMES` của trang mới có **8 chủ đề đầu** (Anh Đào … Đom Đóm). Bốn chủ đề 9–12 (Núi Lửa · Rừng Trúc · Pha Lê · Steampunk) **chưa** có bộ tham số hình — thêm = thêm một khối `{k, name, icon, amb, features[]}` vào `CONFIG.themes` và một khối `{k, ic, c, fk, feo, h, t}` vào `THEMES` của trang; **không đổi** API, bảng hay kinh tế. Đếm đảo theo catalog nên vòng biến thể hiện tại là `(n−1) mod 8`.
Tạo thêm các đảo mới bằng cách sao chép cấu trúc cốt lõi (5 ô nâng cấp, nhà, cây, 3 công trình đặc trưng và hiệu ứng nền) đồng thời thay đổi sắc thái, chất liệu kiến trúc, hệ sinh thái thực vật và hiệu ứng hạt môi trường để tạo sự phong phú:

| # | Đảo | Không khí (màu, ánh sáng) | Nhà | Cây | 3 công trình riêng | Hiệu ứng nền | Ghi chú & Liên kết / Nguồn gốc |
|---|---|---|---|---|---|---|---|
| 1 | 🌸 **Anh Đào** (xuân) | Hồng phấn, ban ngày dịu | Nhà gỗ mái ngói đỏ | Anh đào khổng lồ | Cổng torii · Hồ cá koi · Đèn đá | Cánh hoa rơi | **Đảo gốc**: Kế thừa trực tiếp từ demo `Đảo hoa anh đào.html` trong folder `files` |
| 2 | 🍁 **Phong Thu** (thu) | Cam đỏ, hoàng hôn | Nhà gỗ ấm, ống khói | Phong lá đỏ | Cối xay gió · Đống lá · Lò sưởi ngoài trời | Lá rơi, khói bay, sương | Sao chép kiến trúc gỗ đảo 1, thay mái ngói thành ống khói sưởi, đổi tán hoa sang phong đỏ |
| 3 | 🌴 **Ốc Đảo** (sa mạc) | Vàng cát, nắng gắt, đêm đầy sao | Nhà đất nung | Cọ chà là | Giếng nước · Lều thương nhân · Xương rồng nở hoa | Cát bay, bóng nắng | Chuyển đổi sang phong cách sa mạc khô cằn, nền cát vàng |
| 4 | ❄️ **Băng Tuyết** (đông) | Xanh lam lạnh, cực quang | Lều tuyết (igloo) | Thông phủ tuyết | Người tuyết · Hồ băng · Cột đèn cực quang | Tuyết rơi, cực quang | Đổi toàn bộ gam màu sang hàn đới, nền tuyết trắng xanh |
| 5 | 🥥 **Nhiệt Đới** | Xanh ngọc, nắng rực | Nhà sàn tre | Dừa | Thác nước · Cầu tre · Thuyền nhỏ | Sóng vỗ, chim bay | Phong cách biển đảo nhiệt đới, nhà sàn gỗ tre |
| 6 | ☁️ **Mây Trời** | Trắng xanh nhạt, cầu vồng | Nhà tròn trắng | Cây pha lê | Cầu vồng · Khinh khí cầu · Cối xay mây | Mây trôi quanh đảo | Phong cách thiên đường trên không trung lơ lửng |
| 7 | 🐚 **Đáy Biển** (đảo ngầm) | Xanh sâu, ánh sáng gợn nước | Nhà vỏ ốc khổng lồ | San hô | Vườn rong · Đàn cá · Rương cổ | Bong bóng, tia nắng gợn | Đảo ngập dưới nước, thủy cung lung linh |
| 8 | ✨ **Đom Đóm** (đêm) | Tím xanh, đèn ấm | Nhà nấm | Cổ thụ rêu phát sáng | Nấm sáng · Lồng đèn · Đài quan sát sao | Đom đóm bay | Không gian đêm huyền bí, phát quang sinh học |
| 9 | 🌋 **Núi Lửa** (nham thạch) | Đỏ than, khói đen, rực sáng khe nứt | Chòi đá bazan chống lửa | Cây thanh gai hóa thạch | Suối nham thạch · Lò rèn cổ · Tinh thể lưu huỳnh | Tàn tro đỏ lơ lửng, khói nóng | **Đảo mới tạo**: Sao chép layout đảo 3 nhưng đảo sang địa chất dung nham, màu đất đen rực viền đỏ |
| 10 | 🎋 **Rừng Trúc** (thiền tịnh) | Xanh lục bảo, ánh nắng ban mai | Thảo am tre lợp tranh | Cụm trúc xanh khổng lồ | Cầu đá cổ · Chuông gió đồng · Suối nước nóng | Lá trúc xanh rơi, sương mai sớm | **Đảo mới tạo**: Sao chép tinh thần đảo 1 (Anh Đào) nhưng thay phong cách Á Đông sang Thiền/Trúc |
| 11 | 🔮 **Pha Lê Tím** (ma thuật) | Tím thạch anh, huyền ảo | Tháp pha lê phát sáng | Cây tinh thể tím | Bệ rune phù phép · Giếng mana · Quả cầu tiên tri | Bụi sao lấp lánh, vệt mana tím | **Đảo mới tạo**: Sao chép mô hình đảo 8 nhưng đổi sang chủ đề ma thuật thạch anh, sáng lung linh |
| 12 | ⚙️ **Cổ Kính Steampunk** | Nâu đồng, vàng rỉ, khói hơi nước | Nhà xưởng bánh răng gạch đỏ | Cây ống khói cơ khí | Tháp đồng hồ cơ · Ống xả hơi nước · Bến tàu khí cầu | Hơi nước xì ra, tia lửa cơ khí nhỏ | **Đảo mới tạo**: Sao chép đảo 2 (Phong Thu) nhưng đổi cối xay gió và lò sưởi thành máy móc hơi nước |

### 5.1 Sinh vô hạn từ 8 đảo gốc
Đảo số `n` (bắt đầu từ 1) được dựng từ `seed = hash(n)` nên **mọi người chơi thấy cùng một đảo `n`**, và kiểm thử được:
| Thành phần | Cách biến thể |
|---|---|
| Chủ đề | `catalog[(n − 1) mod 8]`; từ vòng thứ hai (n > 8) thêm một **bộ biến thể** |
| Bảng màu | Đổi sắc độ (ví dụ anh đào vòng 2 là "anh đào tím lúc hoàng hôn") |
| Giờ và thời tiết | Sáng · trưa · hoàng hôn · đêm · có sương/mưa nhẹ (chỉ là hình) |
| Hình dáng đảo | Bán kính 8 đến 11, bờ lồi lõm theo nhiễu, độ cao khác nhau |
| Bố cục | Vị trí cây, nhà, 3 công trình theo hạt giống nhưng **luôn chừa đường đi** cho thú |
| Công trình phụ | Thêm đá, hoa, bụi cây rải ngẫu nhiên (không cần nâng cấp) |
**Giới hạn thật:** vẫn chỉ có 8 chủ đề nên sau vài chục đảo người chơi thấy lại "họ hàng". Muốn tăng độ đặc sắc thì **thêm chủ đề mới vào catalog** (mỗi chủ đề là một khối dữ liệu, mục 11.2), không cần đổi cơ chế.

### 5.2 Chuyển đảo
- Hoàn chỉnh đảo → cảnh ăn mừng → **thú được lên thuyền/khinh khí cầu** bay sang đảo `n + 1`.
- **Bản đồ quần đảo:** đảo đã mở hiện thành chùm đảo nhỏ; cuộn tiếp thấy đảo kế (khóa, hiện bóng mờ). Bấm một đảo đã mở để về thăm; **tiến độ mọi đảo giữ nguyên**.
- Người chơi **không bị ép** sang đảo mới; có thể ở lại đảo cũ chăm thú.

## 6. Kinh tế xu
> **03/11/2026 — phần ví xu của bản thiết kế này ĐÃ THÀNH HIỆN REAL, và làm theo cách hơi khác.** Một ví chung `town_state.xu` do `src/xu.js` in ra từ **chín** nguồn (không phải hai), và Thị trấn 3D + Đảo hoa anh đào + Quần đảo đã tiêu từ ví đó. Bảng dưới là **số thật đang chạy**; mục 6.4 (giá thú) từng là đề xuất và nay cũng đã chạy. Chi tiết + kiểm thử + số đo thật: [README-kinh-te-xu.md](README-kinh-te-xu.md).
### 6.1 Một ví, chín nguồn (số thật)
| Nguồn | Điều kiện | Xu | Trần mỗi ngày |
|---|---|---|---|
| `lesson` | Mỗi lượt học đủ điều kiện (`TownCore.applyAttempts`, chống trùng bằng `town_ledger UNIQUE(user_id, attempt_id)`) | Câu mới đúng **3** · sửa câu sai **4** · ôn đúng hẹn **2** · lặp quá sớm **1**; một câu chỉ thưởng một lần/ngày | **60** |
| `extra` | **Cùng lượt học đó, nhưng sau khi trần 60 đã đầy** (`source_ref = attempt:<id>` nên đồng bộ lại không in lần hai) | **+1** mỗi lượt đúng bị chặn; **không cộng XP thú** | **20** |
| `game` | Ván hoàn thành, **máy chủ cấp `roundId`** (`xu_rounds`) và kiểm thời lượng + số lượt trả lời, một ván chỉ thưởng một lần | Vịt rơi **4** · trò chơi kỹ năng **3** · mê cung theo huy chương **🥇 15 · 🥈 10 · 🥉 6** | **30** cho cả nhà game, **kèm hạn ván theo từng mã trò**: vịt **3**, mỗi trò kỹ năng **2**, mê cung **2** |
| `words` | Ôn một thẻ trong Sổ từ (`POST /api/words/:id/review`, chấm 💚/💛/❤️) | **+1**/thẻ, khóa `word:<id>:<ngày>` nên ôn lại cùng thẻ cùng ngày không cộng | **15** |
| `wordnew` | Lưu từ **thật sự mới** (`POST /api/words`, ON CONFLICT DO NOTHING) | **+2**/từ | **6** |
| `file` | Nộp tài liệu, thưởng theo số câu parse được (`fileGain(n) = min(perFile, 25 + ⌊n/20⌋)`) | **25** + 1 xu cho mỗi đủ **20 câu** | **60 một file** và **60 một ngày** |
| `login` | Mở ví ở bất kỳ đâu trong ngày (không có nút "nhận quà") | **5** | một lần/ngày |
| `streak` | Chuỗi ngày học, quà **mốc một lần đời** | 3 **15** · 7 **30** · 14 **60** · 30 **120** · 50 **200** · 100 **350** · 200 **400** · 365 **800** (tổng **1.975**) | không có trần ngày (mỗi mốc chỉ một lần) |
| `garden` (thị trấn) | Thu hoa trong 🌷 Vườn hoa | **16**/bông, hạt **10**, tưới miễn phí | **32 xu từ vườn/ngày**; **vượt trần thì cây đứng nguyên**, không bẻ nửa bông |
Trần **cắt phần thừa** (`Math.min(amount, còn lại)`), **không** giữ phần vượt cho hôm sau. **Tổng trần "cày học tập" = 136 xu/ngày** (60 bài học + 20 học thêm + 30 game + 15 ôn từ + 6 từ mới + 5 quà); cộng tối đa **60 xu file** và **32 xu vườn** → **228** nếu một ngày làm *mọi* thứ. Số người chơi thật chạm tới thấp hơn nhiều: **trung vị 11 xu/ngày** đo trên CSDL dev (cửa sổ lăn 14 ngày đến 05/11 — xem §7.1 của README-kinh-te-xu.md). Kiểm tra lại bằng số học bất cứ lúc nào: `npm --prefix json run xu:sim`.

### 6.2 Chi phí nâng cấp đảo
Mỗi ô nâng lần lượt lên cấp 1, 2, 3 với chi phí gốc **10 → 25 → 50** (cộng 85/ô, **5 ô = 425 xu cho đảo 1**). Đảo càng về sau càng đắt nhưng **có trần**: `hệ số(n) = min(3, 1 + 0,15 × (n − 1))`. **Đây là số đang chạy trong `src/island-core.js`** (bảng dưới lấy từ `islandCost(n)`, không còn là ≈).
| Đảo n | Hệ số | Tổng xu hoàn chỉnh | Học đều ~30 phút (67 xu/ngày) | Học kỹ ~60 phút (trần 136) |
|---|---|---|---|---|
| 1 | 1,00 | 425 | ~6,3 ngày | ~3,1 ngày |
| 2 | 1,15 | 490 | ~7,3 ngày | ~3,6 ngày |
| 5 | 1,60 | 680 | ~10,1 ngày | ~5,0 ngày |
| 10 | 2,35 | 995 | ~14,9 ngày | ~7,3 ngày |
| 15 trở đi | 3,00 (trần) | 1.275 | ~19,0 ngày | ~9,4 ngày |
Trần hệ số bảo đảm đảo nào cũng **hoàn thành được trong khoảng một tháng**, không bao giờ "không thể nào kịp". Hai cột ngày lấy từ `npm --prefix json run xu:sim` (script đọc `CONFIG.xu` + `IslandCore.costOf`, không chứa số viết tay); **đo thật trên CSDL thì chậm hơn nhiều** — người ở trung vị 11 xu/ngày cần **38,6 ngày** cho đảo 1 (lần chạy 05/11; sáng 03/11 là 19 xu · 22,4 ngày, cửa sổ lăn 14 ngày nên số tự đổi).
**Đảo 2 ra 490 chứ không phải 495:** `costOf` dùng `Math.round` và `50 × 1,15` trong IEEE-754 là `57,499999999999996` → **57**, nên một ô là `12 + 29 + 57 = 98`.
**Quyết định khi làm M3 (03/11):** **giữ nguyên 10/25/50**, không đổi sang 20/50/100. Lý do: một nhà thị trấn giá 20/50/100 là **một ô trong 4 ô của một khu**, còn đảo có 5 ô và mở **vô hạn** — 425 xu cho đảo đầu (≈ 3 ngày cày hết trần, ≈ 6 ngày học đều, ≈ 22 ngày ở nhịp trung vị thật) đã là mục tiêu dài đủ xa, và người chơi **không** bị chặn nội dung khi chưa đủ xu. Nếu sau này muốn chậm lại thì chỉ sửa `CONFIG.upgradeCost` ở **một chỗ** (trang tự đọc theo).

### 6.3 Xu từ trò chơi: chống gian lận (đang chạy thật)
| Rủi ro | Cách xử lý **thật** trong `src/xu.js` |
|---|---|
| Giao diện tự gửi điểm 99999 | Trình duyệt **không gửi số xu nào cả** — thậm chí không gửi "tôi đã xong ván": `POST /api/xu/round/start` xin một mã ván, `POST /api/xu/round/finish` báo đóng. Server tự tính xu bằng `TownCore.gameReward(game, place)` — bảng hằng số trong `CONFIG.xu.game` |
| Gửi kết quả nhiều lần | `xu_rounds UNIQUE (user_id, round_id)` + `xu_ledger UNIQUE (user_id, source, source_ref)` với `source_ref = "<mã trò>:<roundId>"`. **`roundId` do máy chủ sinh** (`"r" + mốc thời gian base36 + "-" + 18 ký tự hex`) — bản thiết kế cũ ghi là trình duyệt sinh, nay đã đổi vì đường đó mới chặn được việc bịa ván (xem §2.1 README-kinh-te-xu.md) |
| Ván vô nghĩa xin xu | `finish` kiểm **sở hữu** (404), **chưa đóng** (409), **≥ 30 giây theo đồng hồ server** (25 s cho ba trò Phân loại nhanh), và **≥ 3 lượt trả lời đúng `mode`** trong `attempts` kể từ lúc mở ván. Ván quá 2 giờ không đóng → `meta.abandoned`, hết trần → `meta.noReward` — cả hai đều **đóng ván**, không "để dành" đổi xu ngày mai |
| Cày một game | Trần **30 xu/ngày cho cả nhà game** + hạn ván **theo từng mã trò** (`game.rounds`: vịt 3 · mỗi trò kỹ năng 2 · mê cung 2; `roundsPerDay` = 2 cho mã chưa liệt kê). Ván vượt hạn → 409, không ghi sổ. Hai trò kỹ năng khác nhau **không** ăn hạn của nhau (khóa `skill:<mã>:<ván>`) |
| Hai ván gửi cùng lúc | `syncLessons` khóa dòng ví `FOR UPDATE` **trước** → hai ván xếp hàng, chỉ một nhận (ca 8 của `test-xu-api.js`) |
| Game chạy offline | Bản luyện tập in rõ **"Bản luyện tập — chưa xác thực"** và **không** gọi `/api/xu/round/*` |
Trò chơi đã nối: 🦆 vịt rơi (4), 🎯 mười tám trò kỹ năng (3, mỗi trò một hạn ván riêng), 🌀 mê cung kho báu (15/10/6 theo huy chương — vẫn đường cũ `POST /api/xu/game` vì `src/dungeon.js` tự ghi khi hoàn thành tầng, `legacyGame:true`). **Các game khác muốn có xu thì phải thêm tên vào `GAMES` và một dòng trong `CONFIG.xu.game`** — đừng tự tính xu ở giao diện.


### 6.4 Giá thú và thức ăn (đang chạy trong `CONFIG.breeds` / `CONFIG.foods`)
| Hạng mục | Giá |
|---|---|
| Thú **thường** (⭐) | **40** (Mèo ta, Chó ta) · **50** (Mèo tam thể) |
| Thú **lạ** (⭐⭐) | 120 xu |
| Thú **hiếm** (⭐⭐⭐) | 300 xu |
| Thú **huyền thoại** (⭐⭐⭐⭐) | 600 xu |
| Hạt / xương khô | 3 xu · +2 thân thiết |
| Cá khô / thịt thưởng | 8 xu · +5 thân thiết |
| Bánh thưởng | 15 xu · +10 thân thiết |
| Bữa đặc biệt | 40 xu · +25 thân thiết |
Mỗi thú chỉ ăn **tối đa 3 bữa/ngày** (tránh vòng lặp "mua thức ăn vô hạn"); vuốt ve và chơi **miễn phí**, +1 thân thiết, tối đa 5 lần/ngày/thú.

**Ví dụ 30 ngày chơi thường (khoảng 1.350 xu):** hoàn chỉnh đảo 1 (425) + đảo 2 (490) + 2 thú thường (40 + 50) + thức ăn ~10 xu/ngày (300) ≈ **1.305**. Con số này **chỉ minh họa**; cân bằng thật phải chạy mô phỏng (M7, mục 13).

### 6.5 Tài khoản demo **đã hoàn thành ba đảo** (xem quần đảo mà không phải cày)

Muốn xem ngay trạng thái "đảo 1·2·3 đã xong, đảo 4 đang mở" trên giao diện — để thử bản đồ quần đảo, các gói chủ đề đã mở khoá, đặt đồ trên đảo mới — chạy:

```
npm --prefix json start        # cửa sổ 1
npm --prefix json run seed:3-dao   # cửa sổ 2 (cần server đang chạy)
```

`scripts/seed-tai-khoan-3-dao.js` (166 dòng) tạo **`demo-3-dao@quandao.invalid` / `DaoVoTan123`** (biệt danh *Đảo Trưởng*), rồi **đăng nhập và chơi bằng đúng các đường của trình duyệt**:

| Bước | Đường thật đã dùng | Kết quả đo được |
|---|---|---|
| Đăng ký | `POST /api/auth/register` | user id **38**; script chặn ngay nếu cookie không được server công nhận (`GET /api/auth/me`), vì `uidOf()` trả **0** khi cookie hỏng và mọi cú tiêu dưới đây sẽ ghi vào **ví Khách** |
| Thu nhập | **114 dòng `xu_ledger`** (`meta.demo = true`) + cộng đúng số đó vào `town_state.xu` — cùng công thức với `xu.insert()` | **1.900 xu** bơm trên **19 ngày** (100 xu/ngày: file 24 · game 30 · học thêm 20 · ôn từ 15 · từ mới 6 · đăng nhập 5) + **5 xu quà đăng nhập** do `dailyGifts()` tự ghi khi mở trang = tổng thu **1.905** |
| Chơi | **45 × `POST /api/islands/upgrade`** (15 ô × 3 cấp) | máy chủ tự trừ ví, tự ghi `xu_spend`, tự đặt `completed_at` và mở đảo kế — tiêu **1.470 xu** = 425 + 490 + 555, **ví còn 435** |
| Nghiệm thu | `SELECT` thẳng CSDL, không tin response | `current 3 · unlocked 4 · slots {"1":[3,3,3,3,3], "2":[3,3,3,3,3], "3":[3,3,3,3,3], "4":[0,0,0,0,0]} · completed_at {1,2,3}` và **bất biến Σ thu − Σ chi = số dư khớp từng đồng** |

**Vì sao dữ liệu này không làm bẩn tài liệu:** tài khoản mang đuôi `IslandCore.CONFIG.demoMail` = `@quandao.invalid`, và **cả hai lệnh đo `--db`** (`xu:sim:real`, `decor:sim:real`) loại đúng đuôi đó — nên "trung vị 11 xu/ngày" và "401 xu đã tiêu" trong các README vẫn là số của người chơi thật. Lệnh đo còn **in số dòng bị loại** (`45 dòng / 1.470 xu chi · 115 dòng / 1.905 xu thu của 1 tài khoản demo`) để không ai nhầm phép đo thiếu dữ liệu. Chạy lại `seed:3-dao` trên tài khoản đã có là **an toàn**: không bơm trùng dòng thu (`UNIQUE (user_id, source, source_ref)`), không tiêu thêm, và ví Khách **không liên quan**.

## 7. Thú cưng: danh mục giống
Mỗi giống là **một bộ tham số** để vẽ bằng khối (không cần mô hình ngoài) nên thêm giống mới rất rẻ.
| Loài | Giống | Hạng | Giá | Nét riêng |
|---|---|---|---|---|
| 🐱 | Mèo ta (cam vằn) | ⭐ | 40 | Vằn cam, tai nhọn, đuôi dài |
| 🐱 | Mèo tam thể | ⭐ | 50 | Ba mảng trắng-cam-đen |
| 🐱 | Mèo Anh lông ngắn | ⭐⭐ | 120 | Xám tròn, mặt phúng phính |
| 🐱 | Mèo Xiêm | ⭐⭐ | 120 | Thân kem, mặt-tai-đuôi nâu sẫm |
| 🐱 | Mèo Ba Tư | ⭐⭐⭐ | 300 | Lông xù, mặt dẹt, đuôi bông |
| 🐱 | Mèo mây (ánh sao) | ⭐⭐⭐⭐ | 600 | Lông tím nhạt, đốm sáng nhẹ |
| 🐶 | Chó ta (vàng) | ⭐ | 40 | Vàng nâu, tai dựng, đuôi cong |
| 🐶 | Corgi | ⭐⭐ | 120 | Chân ngắn, mông tròn, tai to |
| 🐶 | Shiba | ⭐⭐ | 120 | Cam-trắng, đuôi cuộn |
| 🐶 | Husky | ⭐⭐⭐ | 300 | Xám trắng, mắt xanh, tai dựng |
| 🐶 | Poodle | ⭐⭐⭐ | 300 | Lông xù xoăn tròn |
| 🐶 | Chó mây (ánh trăng) | ⭐⭐⭐⭐ | 600 | Lông bạc, đốm sáng nhẹ |

**Tham số vẽ:** màu thân, kiểu hoa văn (vằn/đốm/mảng), tai (nhọn/cụp/dựng), đuôi (dài/cuộn/bông), kích thước, độ xù, độ dài mõm, tốc độ đi. **Độ hiếm chỉ ảnh hưởng giá và độ lạ về hình**, **không có sức mạnh** (không thú nào kiếm thêm xu hay giúp học).

## 8. Game nuôi thú
### 8.1 Màn hình
| Màn | Nội dung |
|---|---|
| **Đảo của tôi** | Cảnh 3D: nhà, cây, công trình, các thú đang đi lại; thanh xu; nút nâng cấp từng ô; bấm đất để gọi thú |
| **Bản đồ quần đảo** | Các đảo đã mở/khóa, tiến độ từng đảo, bấm để thăm |
| **Cửa hàng thú** | Danh sách giống theo hạng, xem trước 3D, giá, nút nhận nuôi + đặt tên |
| **Cửa hàng thức ăn** | Mua thức ăn, số lượng trong kho |
| **Chăm thú** | Chọn một thú: cho ăn, vuốt ve, chơi bóng, xem thân thiết, phụ kiện |
| **Bộ sưu tập** | Mọi thú đã nuôi và giống chưa có (hiện mờ) |
Mọi thao tác trên đảo đều có **bản danh sách chữ tương đương** (nút, danh mục) cho bàn phím và trình đọc màn hình.

### 8.2 Thú đi lại quanh đảo
| Trạng thái | Khi nào | Hành vi |
|---|---|---|
| `wander` | Mặc định | Chọn một điểm đi bộ ngẫu nhiên trên mặt đảo, đi tới, dừng nghỉ vài giây, lặp lại |
| `follow` | Người chơi bấm vào đất | Chạy về điểm đó, rồi ngồi chờ |
| `eat` | Vừa cho ăn | Chạy đến bát, ăn, vẫy đuôi |
| `rest` | Buồn ngủ hoặc ban đêm | Nằm dưới cây hoặc **đi vào nhà** (mờ dần rồi ẩn) |
| `play` | Người chơi ném bóng | Đuổi theo bóng, ngậm về |
| `react` | Bấm vào thú | Nhảy, kêu, đổi biểu cảm (không thưởng) |
**Vùng đi được (không cần lưới tìm đường phức tạp):** mặt đảo là hình gần tròn trừ các vòng tròn chắn của nhà, cây, công trình và hồ; thú chọn điểm đích **trong vùng đi được** và đi theo đường thẳng có né vật chắn (steering). Bất biến cần kiểm thử: **thú không bao giờ ra khỏi mặt đảo, không đứng trong nhà/cây, không kẹt vĩnh viễn**.
Chó và mèo khác nhau về tốc độ, độ nhút nhát, thích nằm chỗ nào; vài cặp có hoạt cảnh nhỏ (mèo ngồi nhìn chó chạy).

### 8.3 Nhu cầu và thân thiết (không phạt)
| Chỉ số | Ý nghĩa | Quy tắc |
|---|---|---|
| **No bụng** (0–100) | Thú đã ăn chưa | Giảm từ từ theo thời gian nhưng **sàn là 30**, **không bao giờ xuống dưới**; chỉ đổi hành vi (hay ngủ gật) |
| **Vui vẻ** (0–100) | Tâm trạng | Tăng khi ăn/chơi/vuốt ve; **sàn 30**, giảm rất chậm |
| **Thân thiết** (cấp 1–10) | Gắn bó lâu dài | Chỉ **tăng**: ngưỡng XP tích lũy `0, 20, 50, 100, 180, 300, 480, 720, 1050, 1500`; mở **phụ kiện** (vòng cổ, nơ, mũ), thêm trò nhỏ |
Thú **không ốm, không chết, không bỏ đi, không đòi bắt buộc**. Quay lại sau cả tháng thì chúng chạy ra chào.

### 8.4 Số thú trên đảo
Một tài khoản nuôi **nhiều thú** (không giới hạn cứng) nhưng **hiển thị tối đa 6 thú trên đảo** vì hiệu năng; thú còn lại **"đang ngủ trong nhà"** và thay phiên ra chơi. Mỗi đảo hoàn chỉnh mở thêm **một chỗ hiển thị** (bắt đầu 3, tối đa 6).

## 9. Chống lạm dụng và đạo đức
| Vấn đề | Cách xử lý |
|---|---|
| Hộp quà ngẫu nhiên / cờ bạc | **Cấm.** Mọi thú mua với giá niêm yết, người chơi biết mình nhận gì |
| Tiền thật | Không có. Xu **chỉ đến từ học/chơi**, không có cửa hàng nạp xu |
| Gây áp lực | Không chuỗi ngày, không đếm ngược, không "thú buồn vì bạn nghỉ", không thông báo dọa |
| Trẻ em | Văn bản thân thiện, không quảng cáo, không chat, không bảng xếp hạng so sánh người khác (có thể thêm sau nếu bạn muốn, mặc định **tắt**) |
| Gian lận | Mọi giá và số dư do server tính, sổ cái chỉ ghi thêm, giao dịch có khóa dòng (mục 10) |

## 10. Kiến trúc kỹ thuật
### 10.1 Dữ liệu
| Bảng | Vai trò | Trạng thái |
|---|---|---|
| `town_state.xu` (thay cho `xu_wallet` đề xuất) | Số dư của **một ví duy nhất**, `CHECK (xu >= 0)` | ✔ **đang chạy** — không có bảng `xu_wallet` riêng, ví nằm cùng dòng với thị trấn để một khóa `FOR UPDATE` giữ hết |
| `xu_ledger` | Sổ cái kiếm xu, `source` ∈ `game`/`file`/`login`/`streak`/`convert`/`garden`/`extra`/`words`/`wordnew` (chín giá trị, `CHECK` khai trong `CSDL/town.sql` và được áp lại idempotent), `source_ref`, `day`, `meta` | ✔ `UNIQUE (user_id, source, source_ref)`, `amount > 0`. **Phần bài học KHÔNG ở đây** mà ở `town_ledger` (mỗi dòng một `attempt_id`) |
| `xu_spend` | Nhật ký tiêu xu, `kind` ∈ `build`/`seed`/`sakura`/`island_upgrade`/`pet_buy`/`pet_food` (`topic`/`slot`/`xu` = số dư sau khi chi) | ✔ đang chạy — **ba kind đảo/thú đã ghi thật từ 03/11** (`test-island-api.js` ca 4, 10, 12, 18) |
| `game_results` | Kết quả ván đã xác nhận | ✘ **không cần nữa** — chống trùng do `xu_ledger UNIQUE` lo, không có bảng riêng |
| `xu_rounds` | **Ván do máy chủ cấp**: `round_id` (duy nhất theo người), `game`, `started_at`, `finished_at`, `meta jsonb` | ✔ **từ 03/11** — `UNIQUE (user_id, round_id)` + chỉ số `xu_rounds_open(user_id, game, finished_at)`. Ván chưa đóng quá `ttlHours` (2 giờ) bị đóng hộ với `meta.abandoned`, không thưởng |
| `town_ledger` | Mỗi lượt trả lời một dòng, `UNIQUE (user_id, attempt_id)` | ✔ dùng chung cho bài học của mọi tính năng |
| `sakura_state` / `sakura_care` | Điểm sinh trưởng của cây anh đào + nhật ký chăm | ✔ (cột `coins` của nó đã về 0 sau migration) |
| `island_state` (thay cho `island_progress` + `user_island` đề xuất) | `current` · `unlocked` · `slots jsonb {"1":[0,0,0,0,0]}` · `completed_at jsonb` — **một dòng một người**, đảo đang ở nằm ngay đó | ✔ **`CSDL/island.sql`, tự tạo khi `src/db.js` khởi động** (03/11) |
| `pet_owned` | Thú sở hữu: `breed`, `name CHECK 1..20`, `friend_xp CHECK >= 0`, `satiety`/`mood CHECK 30..100`, `day`, `meals`, `cares` | ✔ **đang chạy** — không có cột "đảo đang ở" (thú đi theo người chơi) và **không có** cột nào cho chết/bỏ đi |
| `pet_pantry` (thay `pet_inventory`) | `items jsonb {"khat":3}` — một dòng một người | ✔ **đang chạy** (03/11) |
Giữ nguyên các bảng cũ `attempts`, `questions`. Không sửa `attempts`.

### 10.2 API
| Nhóm | Điểm cuối | Việc | Trạng thái |
|---|---|---|---|
| Ví | `GET /api/xu` | Số dư, hôm nay đã nhận theo **từng nhóm cày** (`income`: lesson · extra · game · words · wordnew · file · login · streak · garden · rounds), còn lại bao nhiêu so với từng trần (`left`, `caps`), giá, quà chuỗi, và nguyên `CONFIG.xu` trong `rewards` để giao diện **không tự ghi số** | ✔ **đang chạy** |
| Ví | `GET /api/xu/history?limit=50` | Lịch sử **gộp thu + chi**, mới nhất trước, tối đa 200 (`direction` `in`/`out`); phần bài học chỉ hiện từ sau mốc `convert` | ✔ **đang chạy** |
| Game | `POST /api/xu/round/start` `{game, skill?}` → `{roundId, startedAt, needs:{seconds,evidence,mode,fast}, reward, closed}` | Máy chủ **cấp mã ván** (`crypto`) rồi mới cho chơi, đồng thời **đóng hộ** mọi ván dở cùng mã nhóm (`meta.abandoned`) — `closed` là mảng `round_id` bị đóng. `reward` = số xu ván này **SẼ** nhận, để bảng kết quả hứa trước phần thưởng (04/11). Hạn ván theo từng mã (`duck` 3, mỗi trò kỹ năng 2) chỉ kiểm ở bước `finish` | ✔ **đang chạy từ 03/11** (`xu_rounds`) |
| Game | `POST /api/xu/round/finish` `{roundId}` → `{game, reward, balance}` | Đóng ván: kiểm chủ sở hữu (404), ván đang mở (409), **đủ thời gian** (`seconds` 30, chế độ nhanh 25) và **đủ bằng chứng** (`evidence` lượt làm đúng loại); hợp lệ thì thưởng theo mã nhóm. Ván quá 2 giờ bị đóng với `meta.abandoned` rồi 409; hết trần ngày thì đóng với `meta.noReward` và **cũng 409**. Body lỗi `{error:"…"}` nói bằng tiếng Việt, màn kết quả in nguyên văn thay dòng hứa thưởng | ✔ **đang chạy từ 03/11** |
| Game | `POST /api/xu/game` `{game:"maze", roundId, place}` | **Đường cũ riêng cho mê cung** (phần thưởng theo huy chương, server `src/dungeon.js` tự tính khi đặt huy chương). Chỉ còn dùng cho `maze`; game khác đi qua `round/start + round/finish`, bị 410 khi `CONFIG.xu.legacyGame` tắt | ✔ **đang chạy** — `roundId` ở đây do trình duyệt sinh, chống trùng bằng `xu_ledger UNIQUE` |
| Đảo | `GET /api/islands` · `POST /api/islands/upgrade` `{slot}` · `POST /api/islands/travel` `{index}` | Một lần đọc trả **cả ví lẫn đảo** (`xu`, `income`, `left`, `island.map`, `catalog` giá); nâng ô theo giá `n` do server tính; chuyển đảo đã mở | ✔ **đang chạy từ 03/11** (`src/island.js`). Thị trấn vẫn có tương đương riêng: `POST /api/town/build` `{topic, plot}` giá 20/50/100 từ **cùng một ví** |
| Thú | `POST /api/islands/adopt` `{breed,name?}` · `/feed` `{petId,item}` · `/care` `{petId,action}` | Mua thú giá niêm yết, cho ăn **từ kho** (không trừ xu lần hai), vuốt ve/chơi miễn phí có trần ngày | ✔ **đang chạy từ 03/11**. Danh sách thú và cửa hàng nằm ngay trong `GET /api/islands` + `catalog` nên **không có** `GET /api/pets` và `/pets/shop` riêng. Đang có thêm: `POST /api/town/pet` (chọn loài + tên) và `POST /api/town/feed` (**miễn phí**, mỗi loài một lần/ngày, **không** đổi xu) |
| Kho | `POST /api/islands/food` `{item,qty}` | Mua thức ăn bằng xu, trữ trong `pet_pantry` | ✔ **đang chạy từ 03/11**, ghi `xu_spend kind='pet_food'` |
| Cây | `GET /api/sakura` · `POST /api/sakura/care` `{action}` · `GET /api/sakura/history` · `POST /api/sakura/settings` | Đảo hoa anh đào: xem, tưới 5 / bón 20, nhật ký chăm, bật/tắt | ✔ đang chạy, **tiêu đúng ví chung** |
| Cài đặt | `POST /api/town/settings` `{enabled}` · `POST /api/sakura/settings` `{enabled}` | Bật/tắt theo từng tính năng | ✔ đang chạy. **Không có** `POST /api/xu/settings` (ví thì luôn bật) |
Quy tắc chung **đã kiểm chứng**: mỗi lần chi là **một giao dịch có `FOR UPDATE` trên dòng ví** (hai bấm cùng lúc không làm số dư âm — ca 14 `test-sakura-api.js`, ca 8 và 17 `test-xu-api.js`, ca 8 `test-island-api.js`); `syncLessons` chạy **trước** trong cùng giao dịch nên số dư luôn là số mới nhất; lỗi 400/409 thì giao dịch **hoàn tác và không trừ gì** (kể cả phần đồng bộ và quà ngày — ca 3, 5, 11, 12 `test-island-api.js`).

### 10.3 Giao diện 3D (Three.js)
| Khối | Việc |
|---|---|
| `buildIsland(index)` | Dựng đảo từ `seed` và khối dữ liệu chủ đề (mục 11.2) |
| `applySlots(slots)` | Đặt hình từng ô theo cấp 0–3; khi nâng cấp thì **hoạt cảnh lớn lên** (cây: lớn mượt, nhà: bật lên) |
| `PetAgent` | Máy trạng thái 8.2 + hoạt hình thủ tục (nhún, vung chân, vẫy đuôi) |
| `PetFactory(breed)` | Dựng thú từ bộ tham số giống (mục 7) |
| `Ambience(theme)` | Hiệu ứng nền theo chủ đề (cánh hoa, tuyết, bong bóng…) |
| `Archipelago` | Màn bản đồ quần đảo, bay camera giữa các đảo |
| Ngân sách | ≤ 6 thú, khoảng 500 khối, **chế độ tiết kiệm** tắt bóng đổ và hiệu ứng nền khi máy yếu |
Thư viện: **Three.js r128 ĐỂ CỤC BỘ** — `public/vendor/three.r128.min.js` (603.445 B), thị trấn và đảo anh đào đang dùng chung file này, **không CDN**. Quy ước "không thêm gói npm/CDN" vì vậy **đã được tuân thủ**; quần đảo chỉ cần nạp tiếp file có sẵn (nên nạp chậm khi vào màn đảo như `town3d.js` đang làm).

## 11. Dữ liệu chủ đề và quy ước mở rộng
### 11.1 Định dạng (mỗi chủ đề là một khối dữ liệu)
```js
{ key: "sakura", name: "Anh Đào",
  palette: { sky: [...], ground: "#…", accent: "#…" }, light: { sun: "#…", hemi: [...] },
  house: { levels: [fn1, fn2, fn3] },   // hàm dựng khối cho cấp 1–3
  tree:  { levels: [fn1, fn2, fn3] },
  features: [ { key: "torii", levels: [...] }, { key: "koi", levels: [...] }, { key: "lantern", levels: [...] } ],
  ambience: "petals", variants: [ { name: "hoàng hôn", palette: {...} } ] }
```
### 11.2 Thêm chủ đề mới
Thêm một khối vào catalog là xong: **không đổi** API, bảng, hay kinh tế (giá do `n` và cấp quyết định, không phụ thuộc chủ đề).

## 12. Dùng lại những gì đã có & Liên kết với folder files (`dự án (public/, src/, CSDL/, scripts/)`)

Thư mục `dự án (public/, src/, CSDL/, scripts/)` chứa trọn vẹn bộ mã nguồn và tài liệu chuẩn của backend hoa anh đào cùng bản thử 3D. **03/11/2026: hàng đã về tới nơi — M0, M1, M2, M3, M5 đã chạy thật**, chỉ còn M4/M6 (trang riêng đã xong, tab nhúng trong game chưa) và phần còn lại của M7. Kích thước đọc lại từ file thật ngày 03/11:

| File trong dự án | Kích thước / Trạng thái | Vai trò & liên kết vào Quần đảo |
|---|---|---|
| **`README/README-dao-hoa-anh-dao.md`** | 29.590 B (04/11) | Đặc tả tính năng đang chạy. Đảo số 1 (Đảo Anh Đào) kế thừa trực tiếp từ đây. |
| **`README/README-kinh-te-xu.md`** | 37.419 B (04/11) | ★ Đặc tả **một ví xu** đang chạy: **chín nguồn** (sáu nhóm cày + hai quà + vườn), sáu trần riêng, hai sổ cái + bảng `xu_rounds`, migration, bất biến `Σ thu − Σ chi = số dư`, số đo thật trên CSDL. |
| **`public/dao-hoa-anh-dao.html`** | 18.841 B | Trang 3D **đã nối API** (`GET /api/sakura`, `POST /api/sakura/care`), thuật toán cành đệ quy + hoa rơi. **Bản duy nhất trong `public/`** từ 04/11: bản gốc `Đảo hoa anh đào.html` (15.875 B, chỉ `localStorage`) đã rời `public/` → **`backup/dao-hoa-anh-dao.goc-0211.html`** để không ai mở lầm trang không có máy chủ. |
| **`src/town-core.js`** | 26.166 B (33 ca `test-town.js`) | Lõi thuần: `CONFIG` (gồm `CONFIG.xu` — **mọi con số xu của dự án nằm ở đây**), `applyAttempts` (nguồn `lesson` 3/4/2/1, trần 60), `gameReward`/`gameKeyOf`/`roundLimit`/`roundNeed`/`room`, giá xây 20/50/100, vườn hoa. **Được nhúng cả vào bundle trình duyệt** nên đổi `CONFIG` là đổi hai phía. |
| **`src/xu.js`** | 30.234 B (32 ca `test-xu-api.js` + 19 ca `test-xu-moi.js`) | ★ **Ví thật** thay cho `xu_wallet` + `game_results`: `grant` (idempotent + trần), `spend`, `dailyGifts`, `syncLessons`, `todayIncome`, `migrateAll`, router `/api/xu` + `/api/xu/round/start + round/finish`. |
| **`src/sakura-core.js`** | 3.271 B (10 ca `test-sakura.js`) | Khuôn mẫu lõi thuần không I/O — **hình mẫu để viết `src/island-core.js`** (5 ô cấp 0–3, giá theo `n`) và `src/pet-core.js` (giá thú, bữa ăn, thân thiết). |
| **`src/sakura.js`** | 6.872 B | Router cây anh đào, **đã đổi sang ví chung**: không còn đồng bộ `attempts` riêng, không còn ghi `sakura_ledger`; chỉ đọc `xu.syncLessons` + `xu.spend(kind='sakura')`. |
| **`CSDL/sakura.sql`** | 2.426 B | Ba bảng của cây. Bộ bảng quần đảo nên theo đúng kiểu này: idempotent, `CHECK`, `UNIQUE (user_id, …)` chống trùng. |
| **`scripts/test-xu-api.js`** | 37.787 B (32 ca) | ★ Mẫu kiểm thử cho API ví + ván-server-cấp; ca 16–17 kiểm việc **gộp ví**, ca 19 kiểm migration, ca 21–30 kiểm `round/start + round/finish` (bằng chứng, thời gian, hạn ván, `abandoned`, 410 đường cũ). |
| **`scripts/test-xu-moi.js`** · **`scripts/sim-xu-moi.js`** | 10.801 B (19 ca) · 9.810 B | Kiểm thử thuần trên `CONFIG.xu` (0 CSDL) và **mô phỏng kinh tế**: trần từng nhóm, ba kiểu người học, số ngày tới từng đảo. Chạy `npm --prefix json run xu:sim` (số học) hoặc `xu:sim:real --db` (đo thật, **loại tài khoản demo**). |
| **`scripts/seed-tai-khoan-3-dao.js`** | 10.361 B (166 dòng) | `npm --prefix json run seed:3-dao` — dựng tài khoản demo **đã hoàn thành ba đảo** qua API thật (xem §6.5). Không phải công cụ test: nó để lại dữ liệu thật trong CSDL dev, có nhãn `meta.demo` và đuôi email `CONFIG.demoMail` để hai lệnh đo loại ra. |
| **`scripts/test-sakura-api.js`** | 16.098 B (19/19) | Mẫu kiểm thử tích hợp PostgreSQL thật (schema tạm `sakura_test`, tự xóa). |
| **`scripts/test-town.js`** | 19.670 B (33/33) | Kiểm thử lõi thuần — chạy **không cần CSDL**, đáng nhân bản cho `island-core`/`pet-core`. |

### Chuyển đổi thật đã chạy (khác bản đề xuất ở mục 10.1)
1. `sakura_state.coins` **cộng 1:1 vào `town_state.xu`** (không có bảng `xu_wallet`), rồi set `coins = 0`.
2. Vật liệu riêng từng khu của thị trấn cũng **cộng 1:1** vào cùng một dòng convert, sau đó `town_state.materials` ghi `'{}'`.
3. `sakura_ledger` và `town_ledger` **KHÔNG nhập làm một**: từng lượt đã có một dòng trong `town_ledger`; chép `sakura_ledger` sang `xu_ledger` là **in xu hai lần**. Nên `sakura_ledger` được giữ nguyên làm lịch sử chăm cây cũ, và `meta.upto` (cột trong dòng `convert`) chặn lịch sử ví hiển thị lại phần đã quy đổi.
4. `last_attempt_id` lấy `max` của hai bên để không thưởng lại lượt cũ. Tất cả trong **một** `db.withTransaction`, chạy tự động sau `applySchema()` và **chạy lại vẫn y nguyên** (ca 19 `test-xu-api.js`).

## 13. Kế hoạch triển khai theo mốc
| Mốc | Việc | Tiêu chí xong |
|---|---|---|
| **M0** | Xác nhận cột `attempts` thật; liệt kê game đang có và cách xác nhận kết quả; chốt các câu hỏi mục 14; chọn phương án cho Thị trấn | ✔ **đã xong 03/11**: `attempts.id BIGINT … PRIMARY KEY` + `user_id` (`CSDL/CSDL.sql:161,199`), `questions(id, topic)` đúng; ba game nối ví là `duck`/`skill`/`maze`; **phương án đã chọn = một ví, Thị trấn bỏ vật liệu riêng** |
| **M1** | **Ví xu**: số dư, đồng bộ `lesson`, API ví, kiểm thử | ✔ **đã xong**: `town_state.xu` + `xu_ledger`/`xu_spend` + `GET /api/xu`, `GET /api/xu/history`; **32 ca** `test-xu-api.js` + 26 ca `test-town-api.js` + **19 ca** `test-xu-moi.js`; bất biến `Σ thu − Σ chi = số dư` đối chiếu bằng số thật |
| **M2** | **Xu từ game**: trần riêng, server tính thưởng, chống trùng | ✔ **đã xong, và đã nâng cấp 03/11 đúng theo bản thiết kế cũ**: ván do máy chủ cấp — `POST /api/xu/round/start` → `roundId` → `POST /api/xu/round/finish`, ghi `xu_rounds`; trần **30 xu/ngày** cho cả nhà trò chơi + hạn ván theo **từng mã** (vịt **3**, mỗi trò kỹ năng **2**, mê cung **2**); đường cũ `POST /api/xu/game` chỉ còn cho mê cung (đằng sau `CONFIG.xu.legacyGame`) |
| **M3** | **Đảo**: `island-core.js` (chi phí theo `n`, hoàn chỉnh, mở đảo kế), bảng, API, sinh seed | ✔ **đã xong 03/11**: `src/island-core.js` (UMD, trang và server cùng nạp) + `CSDL/island.sql` (`island_state`) + `src/island.js` (`GET /api/islands`, `POST /upgrade`, `/travel`). Kiểm thử: **21/21** `test-island-core.js` (giá khớp bảng 6.2, `factor` chạm trần 3) + **18/18** `test-island-api.js` (ca 6: đúng 425 xu thì mở đảo 2 và ví về 0; ca 9: chưa hoàn chỉnh thì **không** mở; ca 1: đảo `n` dựng từ seed, `upCost`/`map` do server tính) |
| **M4** | **Giao diện 8 đảo** + sinh biến thể + bản đồ quần đảo + chuyển đảo | ◐ **một nửa**: đủ 8 chủ đề + biến thể seed + bản đồ + du thuyền trên `public/quan-dao-vo-tan-three.html` (7/7 `selfCheck`). Còn thiếu: **ảnh chụp kiểm tra từng chủ đề** và tab 🏝️ nhúng trong game |
| **M5** | **Thú**: luật giá/bữa ăn/thân thiết/sàn 30, bảng, API cửa hàng | ✔ **đã xong 03/11**: luật thú **nằm chung trong `island-core.js`** (không tách `pet-core.js` — ~250 dòng nên gộp cho khỏi vòng require) + `pet_owned`/`pet_pantry` + `POST /adopt`, `/food`, `/feed`, `/care`. Kiểm thử: mua không đủ xu → 409 **và không có dòng thú nào** (ca 11), nâng/mua đồng thời không âm ví (ca 8), bữa thứ 4 trong ngày → 409 (ca 13), nghỉ 30 ngày vẫn đúng sàn 30/30 (ca 15) |
| **M6** | **Giao diện thú**: 12 giống, `PetAgent`, màn cửa hàng/chăm/bộ sưu tập | ◐ **một nửa**: 12 giống + `PetAgent` 6 trạng thái + cửa hàng/chuồng/bộ sưu tập ở trang riêng, **mô phỏng 10.000 điểm đi bộ: 0 điểm hỏng** (`selfCheck`). Còn thiếu: phụ kiện theo cấp thân thiết, hoạt cảnh cặp thú, nhúng tab game |
| **M7** | Cân bằng + trợ năng + hiệu năng + dọn | ◐ **một nửa**: đã có mô phỏng kinh tế `scripts/sim-xu-moi.js` (`npm --prefix json run xu:sim` — ba kiểu người học, số ngày tới từng đảo; `xu:sim:real --db` — **đo thật** từ CSDL: trung vị 11 xu/ngày trên cửa sổ lăn 14 ngày đến 05/11, 0 ngày chạm trần). Vẫn chưa: mô phỏng 90 ngày **theo từng người chơi** (lấy mẫu `scripts/town-sim.js`). Đã có trợ năng bàn phím + `prefers-reduced-motion` + nút 🪫 Tiết kiệm ngay từ bản trang |
**Quy ước README thú ảo:** "không thêm gói npm/CDN" — **đã tuân thủ**: Three.js r128 nằm cục bộ ở `public/vendor/three.r128.min.js` và thị trấn + đảo anh đào đang nạp chung file đó (nạp chậm lúc `mount()`). Quần đảo **không cần thêm gói nào**; nếu cần bóng đổ/hiệu ứng nặng hơn thì tự viết bằng khối cơ bản như `town3d.js` đang làm.

## 14. Những điều cần bạn chốt (ảnh hưởng thiết kế)
| # | Câu hỏi | Mình đề xuất |
|---|---|---|
| 1 | Hợp nhất thành **một ví xu**, bỏ ví vật liệu Thị trấn? | ✔ **Đã chốt và đã làm (03/11)** — một ví `town_state.xu`, vật liệu cũ + xu anh đào đổi 1:1 bằng `xu.migrateAll` |
| 2 | "Xong đảo" = đủ 5 ô cấp 3 (như mình hiểu), hay = hoàn thành một lượng bài học? | ✔ **Đã chốt và đã làm (03/11)** — `island-core.js` coi đủ 5 ô cấp 3 là hoàn chỉnh (mở đảo `n+1`, ghi `completed_at`), người chơi **tự quyết** cách tiêu xu; bài học chỉ đổ xu vào ví chứ không trực tiếp mở đảo (ca 6 `test-island-api.js`) |
| 3 | **Trò chơi nào** sẽ phát xu và kết quả đang lưu ở đâu? | ✔ **Đã chốt (03/11):** `duck` (4), mỗi trò kỹ năng (3), `maze` (15/10/6 theo huy chương). Ván do **máy chủ cấp** — `POST /api/xu/round/start` ghi `xu_rounds`, `finish` mới thưởng; không có bảng `game_results`, chống trùng bằng `xu_ledger UNIQUE` + `UNIQUE(user_id, round_id)`. Kết quả câu trả lời vẫn ở `attempts` (mode `duck:%`/`skill`) và là **bằng chứng** để ván được chấp nhận. Trò nào muốn có xu: thêm mã vào `CONFIG.xu.game.rounds` (nếu cần hạn riêng) — không phải sửa `GAMES` nào khác |
| 4 | Trần xu: học **60**, game **30** mỗi ngày có hợp lý? | ✔ **Đã chốt và đã chạy:** bài học **60**, học thêm **20**, trò chơi **30** (kèm hạn ván theo từng mã: vịt 3, mỗi trò kỹ năng 2, mê cung 2), ôn từ **15**, từ mới **6**, đăng nhập **5** = **136 xu "cày học tập"/ngày**; cộng file **60** và vườn **32** → tối đa **228**. Quà chuỗi (8 mốc = **1.975** xu) tính một lần suốt đời, không cộng vào ngày. **Đo thật trên CSDL dev:** trung vị **11 xu/ngày** (cửa sổ lăn 14 ngày đến 05/11; hôm 03/11 là 19), **0** ngày-học chạm trần 136 — trần mới là "đích của người học rất kỹ", không phải mức trung bình. Bảng cân bằng giá đảo (§6.2) đã tính lại theo 67/136 thay vì 45 xu/ngày |
| 5 | Đối tượng người dùng có **trẻ em** không? | Nếu có, giữ bảng xếp hạng **tắt** mặc định, văn bản đơn giản — vẫn còn mở |
| 6 | Cho thú **di chuyển giữa các đảo** hay mỗi đảo một nhóm thú? | ✔ **Đã chốt bằng mã (03/11):** `pet_owned` **không có** cột đảo → thú đi theo người chơi, `POST /api/islands/travel` chỉ đổi `current`. Số con ra đảo cùng lúc do `seenFor()` tính (3 ban đầu, +1 mỗi đảo hoàn chỉnh, trần 6). Ảnh chụp kiểm tra từng chủ đề vẫn chờ M4 |
| 7 | Có muốn **thêm loài khác** (thỏ, chim…) sau này? | Có, thiết kế `PetFactory` theo tham số để thêm dễ — vẫn còn mở. Note: 🐾 Thú ảo hiện có **5 loài** (`town-core.js` `SPECIES`/`PETS`), thêm loài mới phải cập nhật luôn `FEED_LINES` (ca "PETS phủ đủ mọi loài SPECIES" sẽ báo nếu thiếu) |
| 8 | Chấp nhận trái quy ước CDN, hay nhúng Three.js vào bản dựng? | ✔ **Đã giải quyết ổn hơn cả hai đề xuất:** file `three.r128.min.js` để cục bộ trong `public/vendor/`, không CDN, không nhúng vào bundle |

## 15. Tiêu chí hoàn thành toàn bộ
- ✔ Học hoặc chơi một ván → thấy xu tăng **đúng một lần**, mở lại trang số liệu không đổi (`test-xu-api.js` ca 1, 3, 4 · ca 2 `test-island-api.js`).
- ✔ Nâng cấp ô: xu trừ đúng giá, lỗi 409 thì **không có gì đổi** (`test-island-api.js` ca 3, 5, 11, 12). Đổi hình mượt: xem trên trang.
- ✔ Đủ 5 ô cấp 3 → mở được đảo kế tiếp, **đảo cũ giữ nguyên**, đảo `n` luôn giống nhau mỗi lần dựng (ca 6, 9 · `selfCheck` mục seed).
- ◐ Mua thú/thức ăn: thú **xuất hiện và đi lại** quanh nhà và cây, **không ra khỏi đảo** (10.000 điểm: 0 hỏng), ngủ trong nhà khi buồn ngủ; **không có mức nào làm thú hỏng, mất hay bỏ đi** (sàn 30, `friend_xp >= 0` trong SQL). Còn thiếu: phụ kiện theo cấp thân thiết (M6).
- ✔ Không có đường nào làm xu, đảo, thú **giảm** ngoài lúc người chơi chủ động tiêu — `test-island-api.js` ca 18 chạy toàn bộ endpoint và khẳng định ví **không bao giờ tăng**.
- ◐ Dùng được chỉ bằng bàn phím (6 tab danh sách chữ song hành 3D); `prefers-reduced-motion` đóng băng tuyệt đối; chế độ tiết kiệm 🪫. **Còn thiếu:** ảnh chụp kiểm tra ở màn 360 px và chế độ tối cho từng chủ đề.
- ⬐ **Chưa có** công tắc bật/tắt riêng cho quần đảo (`/api/islands` luôn chạy). Thị trấn và cây anh đào đã có `/settings`; nếu muốn đồng bộ hành vi thì thêm cột `gift`-style vào `island_state` hoặc dùng `town_state.enabled`.
- ✔ Quay lại: gỡ `app.use("/api/islands", …)` trong `src/server.js`, xóa `src/island*.js`, `CSDL/island.sql` và trang 3D; muốn dọn dữ liệu thì `DROP TABLE island_state, pet_owned, pet_pantry`. Chức năng học **không bị ảnh hưởng** (không sửa `attempts`, không sửa `questions`).
