# 🪙 Kinh tế một ví xu — đặc tả và số liệu thật

Tài liệu này quy định **toàn bộ** phần tiền tệ của trò chơi: xu đến từ đâu, giá bao nhiêu, ghi sổ thế nào, và vì sao chọn những con số đó. Mọi con số ở đây **chép nguyên từ mã nguồn** (`src/town-core.js` → `TownCore.CONFIG`, `src/sakura-core.js` → `CONFIG`, `src/xu.js`, `src/island-core.js` → `IslandCore.CONFIG`), không phải số viết ước lượng trong tài liệu.

> **Yêu cầu gốc (03/11/2026):** *"Sửa lại khi thực hiện bài học thì sẽ nhận được xu, lấy xu đó để nâng cấp hòn đảo. Xu đó được lấy ra từ các trò chơi, bài học, nộp file tài liệu, đăng nhập mỗi ngày tặng, chuỗi học sẽ được tặng. Bao nhiêu xu thì tùy bạn phù hợp với việc nâng cấp."*

---

## 1. Bốn nguyên tắc

1. **MỘT ví duy nhất.** Số dư là `town_state.xu` (một số nguyên, `CHECK xu >= 0`). Thị trấn, cây anh đào, **quần đảo + thú cưng**, trò chơi, file và quà **cùng dùng ví này**. Không còn "vật liệu riêng từng khu", không còn `coins` riêng của cây.
2. **Server luôn là nguồn đúng.** Giao diện không tự cộng trừ bao giờ: mọi hành động đi qua `TownCore` / `IslandCore` + `src/xu.js` trong `db.withTransaction`, có `SELECT … FOR UPDATE` trên dòng ví nên hai request song song **xếp hàng** chứ không ghi đè.
3. **Không in hai lần.** Mỗi nguồn thu có khóa riêng trong `xu_ledger` (`UNIQUE (user_id, source, source_ref)`), mỗi lượt bài học có một dòng `town_ledger` (`UNIQUE (user_id, attempt_id)`), mỗi ván chơi có một dòng `xu_rounds` (`UNIQUE (user_id, round_id)`) **do máy chủ sinh mã**. Chơi lại đúng ván đó, nộp lại đúng file đó, ôn lại đúng thẻ đó trong cùng ngày, mở app hai lần trong một ngày → **cùng một số dư**.
4. **Chỉ người chơi chủ động tiêu mới bị trừ.** Xây ô / nâng ô đảo / mua hạt / mua thú / mua thức ăn / tưới / bón phân đều có **hộp xác nhận**; không có đường nào tự động trừ xu, không có "thu phí hằng ngày", cây không héo, **thú không bao giờ tụt dưới sàn no–vui 30** và không chết vì thiếu xu.

Hệ quả có thể kiểm tra bằng SQL bất cứ lúc nào:

```
Σ (town_ledger.amount) + Σ (xu_ledger.amount) − Σ (xu_spend.cost)  ==  town_state.xu
```

*Một ngoại lệ có chủ đích:* các dòng `town_ledger` **dưới mốc `upto`** của tài khoản (lượt học thời còn "vật liệu riêng từng khu") không cộng vào vế trái nữa — chúng đã nằm trong một dòng `xu_ledger` `source='convert'` duy nhất. Tài khoản lập sau 03/11 thì `upto = 0`, dùng đúng công thức trên.

*Hai lệch đo được trên CSDL dev (kiểm bằng web 05/11, qua `GET /api/xu/history`):* **Khách (id 0)** nhận **+250 xu vào ví mà không có dòng thu nào** (ví **85** · thu ghi sổ **101** = `town_ledger` 45 + `xu_ledger` 56 · chi **266** trên 10 dòng) — dấu vết của một lần bơm xu bằng SQL thẳng tay khi thử mua bốn phong cách ngày 04/11. **nhusan@gmail.com (id 9)** thì ngược lại, **thiếu đúng 65 xu**: dòng `convert` **105** ghi đủ trong `xu_ledger` (`meta` = `materials 65` + `sakura 40`) nhưng ví chỉ nhận 40; lệch sinh ra trong khoảng 02/11 → 03/11 rồi **đứng nguyên** — lần theo cột `xu` (số dư sau mỗi cú tiêu) của 21 dòng chi thì **20/21 dòng kế tiếp khớp tuyệt đối** và số dư hôm 05/11 (**6**) khớp đúng chuỗi đó. **Không có đường nào trong mã** thêm hoặc bớt xu mà bỏ qua sổ cái: mọi nguồn thu đi qua `insert()` (`src/xu.js:158` — ghi `xu_ledger` trước, `ON CONFLICT DO NOTHING`, rồi `UPDATE … xu = xu + $2`), mọi cú tiêu đi qua `spend()` (`src/xu.js:189`, `CHECK (cost > 0)` + `CHECK (xu >= 0)`); ba suite có câu `DELETE … WHERE user_id=0` chạy trong **schema tạm** `town_test` / `xu_test` / `sakura_test` nên không chạm dữ liệu dev. Tóm lại: hai dòng trên là **dấu vết dữ liệu cũ, không phải lỗi đang hoạt động**, nhưng đủ để **đừng nghiệm bất biến này bằng tài khoản Khách** — muốn kiểm trên web thì dùng tài khoản lập sau 03/11 (`upto = 0`) hoặc tài khoản do script test tạo.

---

## 2. Chiều thu — chín nguồn: sáu nhóm cày + hai quà + một nguồn phụ

| Nguồn | Định luật | Trần | Ghi sổ |
|---|---|---|---|
| **📖 Bài học** (mọi lượt trả lời được ghi vào `attempts`) | **3** câu mới · **4** sửa được câu từng sai · **2** ôn đúng hẹn · **1** lặp quá sớm (`CONFIG.base`). Số xu **bằng đúng số XP** thú nhận được | **60 xu/ngày** (`dailyCap`), đếm theo ngày địa phương `Asia/Ho_Chi_Minh` | `town_ledger` `(user_id, attempt_id)` — một lượt chỉ thưởng **một lần** |
| **➕ Học thêm** (cùng lượt trả lời, nhưng SAU khi trần bài học đã đầy) | **+1 xu mỗi lượt đúng bị chặn bởi trần 60** (`extra.perAttempt`). **Không cộng XP thú** — phần này thưởng thời gian ngồi thêm, không thưởng "hiểu thêm" | **20 xu/ngày** (`extra.cap`) | `xu_ledger` `extra`, `source_ref` = `attempt:<attempts.id>` — dùng chính id lượt trả lời làm khóa, nên `syncLessons` mất mốc `last_attempt_id` rồi chạy lại **không in xu lần hai** |
| **🎮 Trò chơi** (phần thưởng **cố định**, server tính — không nhận điểm từ trình duyệt) | Săn vịt **4** · Trò kỹ năng **3** · Mê cung **15 / 10 / 6** theo hạng Vàng/Bạc/Đồng (`gameReward`) | **30 xu/ngày** cho cả nhà trò chơi **và** hạn ván **theo từng mã trò**: săn vịt **3**, mỗi trò kỹ năng **2**, mê cung **2** (`game.rounds` + `roundsPerDay`fallback 2) | `xu_ledger` `game`, `source_ref` = `duck:<roundId>` · `skill:<mã game>:<roundId>` · `maze:<file_id>:<segment>:<snapshot>` (khóa là **nội dung ván**) |
| **📘 Ôn từ** (mỗi thẻ trong Sổ từ được chấm 💚/💛/❤️ một lượt trong ngày) | **+1 xu / thẻ** (`words.perCard`) — kể cả thẻ quên, vì quên rồi sửa cũng là ngồi lại với từ đó | **15 xu/ngày** (`words.cap`) | `xu_ledger` `words`, `source_ref` = `word:<id>:<YYYY-MM-DD>` → ôn lại cùng thẻ trong cùng ngày **không** cộng thêm |
| **💾 Lưu từ mới** (`POST /api/words` — từ chưa từng có trong sổ) | **+2 xu / từ** (`wordnew.perWord`), chỉ khi thẻ thật sự **mới** (ON CONFLICT DO NOTHING) | **6 xu/ngày** (`wordnew.cap`) | `xu_ledger` `wordnew`, `source_ref` = `wordnew:<lookup_word.id>` |
| **📄 Nộp file tài liệu** (`POST /api/import` và `POST /api/ai/commit`) | `fileGain(n) = min(60, 25 + ⌊n/20⌋)` cho file có *n* câu (`base 25`, `per 20`, `perFile 60`) | **60 xu cho một file**, và **60 xu/ngày** cho cả nhà file | `xu_ledger` `file`, `source_ref` = `file:<source_files.id>` → nhập lại cùng file không cộng thêm |
| **🔑 Quà đăng nhập mỗi ngày** | **+5 xu**, một lần mỗi ngày địa phương (`login.gift`) | 5 xu/ngày | `xu_ledger` `login`, `source_ref` = `login:<YYYY-MM-DD>` |
| **🔥 Chuỗi ngày học** (ngày có ≥ `fedMinAttempts` = **5** lượt trả lời) | Mốc **3 → 15** · **7 → 30** · **14 → 60** · **30 → 120** · **50 → 200** · **100 → 350** · **200 → 400** · **365 → 800** xu | Mỗi mốc nhận **một lần duy nhất suốt đời**; tổng tối đa **1.975 xu** | `xu_ledger` `streak`, `source_ref` = `streak:<số ngày>` |
| **🌷 Vườn hoa** (nguồn phụ, xem §4) | Thu hoạch **+16 xu** một bông | **32 xu/ngày** cho toàn vườn | `xu_ledger` `garden`, `source_ref` = `garden:<ô>:<ms>` |

**Tổng trần "cày mỗi ngày" = 136 xu**: 60 bài học + 20 học thêm + 30 trò chơi + 15 ôn từ + 6 từ mới + 5 quà đăng nhập. Chưa tính file (60/ngày, nhưng phụ thuộc số file mới) và vườn (32/ngày). Bảng đầy đủ + mô phỏng số ngày tới từng đảo: `npm --prefix json run xu:sim` (script `scripts/sim-xu-moi.js`), số đo thật từ CSDL: `npm --prefix json run xu:sim:real` (xem §7.1).

**Không có xu cho tra cứu/giải thích AI.** Bôi đen dịch, 🔍 giải thích_deep, 💡 Giải thích và hỏi gia sư **không** phát xu — nếu phát, người chơi sẽ bấm tra cứu cho nhanh thay vì học. Xu chỉ đến từ việc **trả lời** và **ôn lại**.

**Trần cắt phần thừa, không giữ lại.** `grant()` chỉ ghi `min(số thưởng, chỗ còn lại của ngày)`: nộp một file đáng 50 xu khi nhà file hôm nay đã nhận 40 → ví chỉ lớn thêm 20, **30 xu còn lại mất chứ không trừ dần sang ngày mai**. Đơn giản hơn cho người chơi hiểu và không tạo ra "tiền treo".

**Quà không cần bấm "nhận".** `dailyGifts()` chạy ở cuối mọi lần **đọc** ví/thị trấn/cây (`GET /api/xu`, `GET /api/town`, `GET /api/sakura`), nên mở app là quà vào ví và số dư trả về **đã cộng rồi** — không trễ một lượt. Quà **không trừ lượt**, **không dọa nghỉ**, mốc đã lãnh thì vĩnh viễn đã lãnh.

**Bài học cũng là XP của thú.** `xp` chỉ đến từ `town_ledger` (tối đa 60/ngày); thu hoạch vườn và quà **không** cộng XP. Ngưỡng 5 giai đoạn: `0 / 120 / 400 / 900 / 1800` → Trứng · Con non · Thiếu niên · Trưởng thành · Huyền thoại.

### 2.1 Ván chơi do MÁY CHỦ cấp (`xu_rounds`) — sửa V5

Trước đây trình duyệt tự sinh `roundId` rồi báo "tôi vừa xong một ván"; máy chủ chỉ chống trùng, không kiểm ván đó **có thật không**. Từ X2, Săn vịt và mười tám trò kỹ năng đi qua hai bước:

| Bước | Route | Máy chủ làm gì |
|---|---|---|
| Mở ván | `POST /api/xu/round/start` `{game:"duck"}` \| `{game:"skill", skill:"<mã>"}` | Cấp `roundId` do `crypto` sinh (`"r" + mốc thời gian base36 + "-" + 18 ký tự hex`, **không** do trình duyệt chọn), đóng hộ mọi ván dở cùng mã nhóm (ghi `meta.abandoned`) rồi ghi `xu_rounds` với `started_at = now()` **của đồng hồ máy chủ**; trả `{roundId, game, startedAt, needs, reward, closed}` — `reward` là số xu ván này **SẼ** nhận nếu đủ bằng chứng (`TownCore.gameReward(need.game, 0)`), `closed` là **mảng** `round_id` vừa bị đóng |
| Đóng ván | `POST /api/xu/round/finish` `{roundId}` | `SELECT … FOR UPDATE` dòng ván → kiểm **sở hữu** (404 nếu không phải của mình), **chưa đóng** (409), **thời lượng** `≥ needs.seconds` (30 s; 25 s cho ba trò Phân loại nhanh), **bằng chứng** `≥ needs.evidence` = 3 lượt `attempts` đúng `mode` (`duck:%` hoặc `skill`) kể từ lúc mở → `syncLessons` → `grant(source:"game", ref:"<key>:<roundId>")` |

Năm chi tiết phải nhớ khi sửa:

* **Bằng chứng là số lượt, không phải điểm.** Ván gian dối nhất là "mở tab rồi đóng": không có `attempts` nào trong khoảng thời gian đó → 409, ví đứng nguyên.
* **Ba trò Phân loại nhanh** (`classpos` · `classtense` · `classprep`) chơi bằng thẻ tự sinh nên **không ghi `attempts`**; máy chủ chỉ có thời gian làm bằng chứng, vì vậy trần ván của chúng thấp (2 ván/ngày) và hạn thời gian rút xuống 25 s cho đỡ phiền. **Tìm lỗi sai CÓ ghi attempts** — đã xác minh lại khi làm X0.
* **Ván quá hạn thì ĐÓNG và ghi dấu `abandoned`, rồi mới báo lỗi** (`meta.abandoned`, `finished_at = now()`) — commit trước, `throw` sau, nên ván không mở lơ lửng mãi. Tương tự, hết trần 30 xu thì máy chủ đóng ván với `meta.noReward`: **không "để dành" ván hôm nay đổi xu ngày mai**.
* **Phần thưởng ván là phần phụ, nhưng phải nói lời thật.** `round/start` trả luôn `reward` để bảng điểm hứa được "ván này được +N xu"; `round/finish` gặp 404/409 thì giao diện in **nguyên văn** `error` của máy chủ thay dòng đó — không alert, không chặn bảng điểm. Bảng kết quả vẫn hiện đủ EXP và dòng "🪙 hôm nay X/60 xu bài học", vì những câu đã trả lời **vẫn** nhận xu bài học bình thường (chi tiết giao diện: §6).
* **Mê cung vẫn đi đường cũ** `POST /api/xu/game {game:"maze", roundId, place}`: máy chủ Mê cung (`src/dungeon.js`) tự qui đổi huy chương khi hoàn thành tầng, khóa ván là **nội dung** (`maze:<file>:<segment>:<snapshot>`) nên không bịa được. Đặt `CONFIG.xu.legacyGame = false` là route đó trả **410** — tắt được mà không phải sửa giao diện.

---

## 3. CHIỀU TIÊU — giá nâng cấp đảo/thị trấn

| Việc | Giá | Ở đâu |
|---|---|---|
| **Lên cấp 1 / 2 / 3** một ô đất | **20 / 50 / 100 xu** (`buildCost`) | `POST /api/town/build` → `TownCore.build` |
| Một **khu** hoàn chỉnh (4 ô × 3 cấp) | `4 × (20+50+100)` = **680 xu** | 8 khu hiện cùng lúc (`maxVisibleDistricts`), `plotsPerDistrict` 4, `maxLevel` 3 |
| **Mua một túi hạt** | **10 xu** (`garden.seedCost`) | `POST /api/town/garden` `action:"plant"` |
| **Tưới cây vườn** | **0 xu** (tối đa 1 lần/ngày/ô, cần 2 lần để nở) | `action:"water"` |
| **Chăm cây anh đào**: 💧 tưới / 🌿 bón | **5 xu → 10 điểm** / **20 xu → 50 điểm**, cây trọn vẹn ở **900 điểm** | `POST /api/sakura/care` → `sakura-core.js` — đặc tả đầy đủ: [README-dao-hoa-anh-dao.md](README-dao-hoa-anh-dao.md) |
| **Cho thú ăn** (thị trấn) | **0 xu, 0 thưởng** — một lần/ngày, chỉ để thú trả lời | `POST /api/town/feed` |
| **Nâng một ô đất** trên đảo *n* (5 ô × 3 cấp) | **10 / 25 / 50 xu × hệ số đảo**, `hệ số = min(3, 1 + 0,15×(n−1))` (`IslandCore.costOf`) | `POST /api/islands/upgrade` → `src/island-core.js` — đặc tả: [README-quan-dao-vo-tan-va-thu-cung.md](README-quan-dao-vo-tan-va-thu-cung.md) |
| Một **đảo hoàn chỉnh** (5 ô lên cấp 3) | đảo 1 **425** · đảo 2 **490** · đảo 3 **555** · đảo 5 **680** · đảo 10 **995** · đảo ≥15 **1.275** xu | hoàn chỉnh mới **mở** đảo kế; chưa đủ thì đứng nguyên |
| **Nhận một thú** (12 giống mèo/chó) | ⭐ **40–50** · ⭐⭐ **120** · ⭐⭐⭐ **300** · ⭐⭐⭐⭐ **600** xu (`breeds`) | `POST /api/islands/adopt` |
| **Mua đồ ăn cho thú** (bỏ vào kho, chưa cho ăn ngay) | 🥣 hạt/xương **3** · 🐟 cá khô **8** · 🍪 bánh thưởng **15** · 🍱 bữa đặc biệt **40** xu | `POST /api/islands/food`; cho ăn `POST /api/islands/feed` chỉ trừ **kho**, vuốt ve/chơi (`/care`) **0 xu** |

Bảng trên **không có chỗ nào để "bán lại"**: xây rồi không rút được, nên tổng chi một tài khoản luôn đúng bằng tổng `xu_spend.cost`.

### Vì sao chọn những con số này (cân bằng theo ngày)

*Bảng dưới là kết quả `npm --prefix json run xu:sim` — script đọc thẳng `CONFIG.xu` và giá của `IslandCore`, không chứa số viết tay; chạy lại là số đổi theo mã.*

* **Ba kiểu người học** (xu thật họ chạm tới mỗi ngày, đã cắt theo trần):

  | Kiểu | Mỗi ngày | Đảo 1 (425) | Đảo 3 (555) | Đảo 10 (995) |
  |---|---|---|---|---|
  | Học nhẹ ~10 phút | **24 xu** (bảng cũ: 24) | 17,7 ngày | 23,1 ngày | 41,5 ngày |
  | Học đều ~30 phút | **67 xu** (bảng cũ: 57) | 6,3 ngày | 8,3 ngày | 14,9 ngày |
  | Học kỹ ~60 phút | **136 xu** (bảng cũ: 85) | 3,1 ngày | 4,1 ngày | 7,3 ngày |

  Người học nhẹ **không đổi** — đó là chủ đích: bảng mới thưởng người **học sâu** (học thêm + ôn từ + từ mới), không thưởng người bấm nhiều.
* **Một ngày cày hết trần: 136 xu** bài học+học thêm+trò chơi+ôn từ+từ mới+quà, cộng tối đa 60 xu file và 32 xu vườn. so với bảng cũ (85) thì trần mới cao hơn ~60%, nhưng **phải làm ba việc khác nhau** chứ không phải cày một chỗ nhanh hơn.
* Một khu hoàn chỉnh **680 xu** ≈ **7 ngày** học đều; 8 khu ≈ **2 tháng** — vừa sức với một học kỳ, không có chuyện xây xong trong một buổi.
* **Đảo cũng là một mục tiêu dài, không phải một buổi:** đảo 1 **425 xu** ≈ **6 ngày** học đều (3 ngày nếu học kỹ), đảo 10 **995**, đảo ≥15 chạm trần hệ số ×3 nên **1.275**. Hệ số `min(3, 1+0,15×(n−1))` đứng sau con số 490 của đảo 2 (`50×1,15` trong IEEE-754 là `57,499999999999996` → `Math.round` = **57**).
* **Thú có giá theo hạng**: ⭐ **40–50** ≈ nửa ngày học đều, ⭐⭐⭐⭐ **600** ≈ ~**9 ngày** học đều (không chuỗi) — đủ xa để người chơi muốn tích lũy chứ không mua bừa. Thức ăn rẻ (3–40 xu) và **mua để dự trữ trong kho**, cộng trần **3 bữa + 5 lần chăm/ngày/thú** nên không có đường nào "in xu" hay đốt xu vô hạn.
* **File là quà bất ngờ**: bộ 500 câu = `25 + 25` = **50 xu**, bộ ≥ 700 câu **dừng ở 60 xu một file** (`perFile`) kể cả khi `25+⌊n/20⌋` lớn hơn — thưởng cho người mang đề mới, không thành máy in xu (khóa theo `file_id` nên nhập lại không cộng).
* **Chuỗi học** cộng dồn **1.975 xu** cho 365 ngày (8 mốc) — thiết kế để thưởng sự đều đặn cả năm chứ không nuôi người chơi xổi.
* **Vườn hoa có lời nhưng chậm**: 10 xu → 16 xu sau **2 ngày tưới**, lãi **6 xu/bông**. Với 6 ô và chu kỳ ~3 ngày, trần 32 xu/ngày gần như **vừa khít** (2 lần thu/ngày) → lãi ròng chỉ ~**12 xu/ngày**, thấp hơn nhiều so với ôn bài. Đây là tính năng "chăm chút", không phải chỗ để cày.
* **Cây anh đào** tốn **360 xu** (18 lần bón) nếu bón phân đều, hoặc **450 xu** nếu chỉ tưới — tương đương ~**nửa một khu**, hợp lý vì cây là công trình trang trí cả đảo chứ không tăng chỉ số.
* **Học thêm tính theo LUẬT, không theo phỏng đoán:** 70 câu mới đúng một ngày = 20 câu đầu ăn hết trần 60 xu bài học, **50 lượt bị chặn** (`cut`) → học thêm `min(50 × 1, 20)` = **20 xu**, XP thú vẫn chỉ 60. Tài liệu đề xuất (§10 ca 1) ghi "học thêm **10**" là nhẩm theo số câu chứ không theo luật; luật đã cài — và `test-xu-moi.js` C1–C3 — luôn cho `min(số lượt bị chặn × 1, 20)`, và **câu sai không bao giờ vào `cut`**.



---

## 4. Vườn hoa (kiểu Khu Vườn Trên Mây)

`CONFIG.garden`: **6 ô** · hạt **10 xu** · **2 lần tưới** để nở (tưới miễn phí, **1 lần/ngày/ô**) · thu hoạch **+16 xu** · trần vườn **32 xu/ngày** · 4 loài 🌷 Tulip · 🌼 Cúc · 🌻 Hướng dương · 🌸 Anh đào.

Hai qui tắc chống bực mình:

* **Vượt trần thì cây còn nguyên.** `harvest()` từ chối khi phần còn lại của ngày < 16 xu: *"Hôm nay vườn còn cho thu 12 xu, chưa đủ 16. Mai thu tiếp nhé, cây vẫn nguyên ở đây."* Không bao giờ bẻ nửa bông trả nửa xu.
* **Thu thành công mới ghi sổ.** `town.js` gọi `xu.logIncome()` với source `garden` **chỉ khi** `gain > 0`; lần bị từ chối không để lại dòng nào, nên lịch sử ví và số dư luôn khớp.

## 5. Cơ sở dữ liệu

| Bảng | Vai trò | Ràng buộc then chốt |
|---|---|---|
`town_state` | **Số dư ví** `xu integer CHECK (xu >= 0)`, `plots`, `xp`, `day_state`, `garden`, `treats`, `gift`, `last_attempt_id` | một hàng / tài khoản; mọi trừ/ cộng đi qua `SELECT … FOR UPDATE`
`town_ledger` | Xu từ **bài học**, chỉ thêm | `UNIQUE (user_id, attempt_id)`, `amount > 0`
`xu_ledger` | Xu từ **game · file · login · streak · convert · garden · extra · words · wordnew**, chỉ thêm | `UNIQUE (user_id, source, source_ref)`, `amount > 0`, `meta jsonb`, `CHECK (source IN (…chín giá trị trên))`
`xu_rounds` | **Sổ ván chơi** do máy chủ cấp: `round_id`, `game` (`duck` \| `skill:<mã>`), `started_at`, `finished_at`, `meta` (`abandoned` / `noReward` / `seconds` / `evidence`) | `UNIQUE (user_id, round_id)`, index `xu_rounds_open (user_id, game, finished_at)` — một ván chỉ thưởng **một lần**, và chỉ ván *có hàng đợi mở* mới đóng được
`xu_spend` | Nhật ký **chi**: `build` · `seed` · `sakura` · `island_upgrade` · `pet_buy` · `pet_food` · **`decor_buy`** (topic = khóa món, `slot` `NULL`) · **`style_buy`** (topic = khóa phong cách) — hai kind sau sống từ 04/11, mốc **D2** của [README-trang-tri-dao.md](README-trang-tri-dao.md) — riêng **`PUT /decor/wish` (D5) không ghi dòng chi nào** vì danh sách mong muốn **miễn phí**. Cột `kind` **không có ràng buộc `CHECK`** (khác `xu_ledger.source`), nên thêm giá trị mới **không cần migration** — chỉ ghi chú trong `CSDL/town.sql` | `cost > 0`, cột `xu` = **số dư ngay sau khi tiêu** (`CHECK (xu >= 0)`) để đối chiếu từng dòng
`island_state` | Đảo đang đứng + `unlocked` + `slots` + `completed_at` từng đảo | một hàng / tài khoản, cùng dòng ví `town_state`
`pet_owned` | Thú đã nhận: giống, tên, `friend_xp`, `satiety`/`mood`, `day`, `meals`, `cares` | `name` 1–20 ký tự, `friend_xp >= 0`, `satiety`/`mood` `CHECK 30..100` (**không có dưới sàn**)
`pet_pantry` | Kho đồ ăn cho thú (`khat/ca/banh/dacbiet`) | `>= 0`, trừ khi cho ăn chứ không khi mua

Nạp bằng `CSDL/town.sql` (**idempotent**) — `src/db.js` chạy `CSDL/CSDL.sql` → `CSDL/town.sql` → `CSDL/island.sql` mỗi lần khởi động, nên `ALTER … DROP/ADD CONSTRAINT` cho source `garden` tự áp dụng trên CSDL cũ. `CSDL/sakura.sql` vẫn **chạy tay một lần** (xem README-dao-hoa-anh-dao.md §khởi động), còn ba bảng quần đảo thì đã tự nạp.

### Migration một chiều: vật liệu riêng từng khu → ví chung

`xu.migrateAll(db)` chạy **tự động sau** `applySchema()` mỗi lần khởi động, và **chạy lại vẫn y nguyên**:

1. Cộng vật liệu còn lại của **mọi khu** 1:1 vào `xu`, ghi một dòng `xu_ledger` `source='convert'`, `source_ref='convert:materials'`, `meta = {materials, sakura, upto}`.
2. Cộng nốt `sakura_state.coins` vào cùng dòng convert (cây không còn ví riêng), rồi set `coins = 0`.
3. Xóa `materials` (ghi `'{}'`), lấy `max(last_attempt_id)` của hai bên để **không thưởng lại lượt cũ**; cột `upto` được lưu vào `meta` nên `GET /api/xu/history` chỉ hiện dòng bài học **sau** mốc đó (CSDL cũ chưa có `upto` thì `coalesce(...,0)` → hiện hết).
4. `sakura_ledger` giữ nguyên làm lịch sử chăm cây, **không chuyển** (nó trùng từng lượt với `town_ledger`).

Cột `town_state.materials` và `town_state.xu_day` vẫn nằm trong CSDL cho an toàn (không code nào đọc/ghi); muốn dọn hẳn thì `ALTER TABLE town_state DROP COLUMN IF EXISTS materials;` — **thao tác không rút lại được**, chỉ chạy khi chắc.

## 6. Giao diện

* **Thẻ "🪙 Xu hôm nay"** (tab 🌍 Thế giới → 🏘️ Thị trấn, `#xuTodayBars`): **sáu** thanh tiến độ — Bài học /60 · Học thêm /20 · Trò chơi /30 · Ôn từ /15 · Từ mới /6 · Nộp file /60 — mỗi hàng `X/Y · còn N`, đổi xanh lá khi chạm trần, kèm dòng ví + quà đăng nhập + chuỗi ngày. **Toàn bộ số đọc từ `GET /api/xu`** (`income` / `left` / `caps` / `rewards`), giao diện không tự cộng trừ và **không viết tay con số nào**.
* **Thẻ "🪙 Ví xu của bạn" ở tab 💾 CSDL & tiến độ** (04/11/2026, `#xuDataBalance` / `#xuDataToday` / `#xuDataNote`): mở bảng thống kê là thấy ngay mình đang có bao nhiêu xu, không phải lon ton sang tab 🏘️. Ba dòng — **số dư**: `Ví của bạn: 16 xu · hôm nay thu 11 xu`; **sáu nhóm cày** `📖 Bài học 6/60 · ➕ Học thêm 0/20 · 🎮 Trò chơi 0/30 · 📘 Ôn từ 0/15 · 💾 Từ mới 0/6 · 📄 Nộp file 0/60`; **nơi tiêu tiền** (nâng cấp nhà theo `prices.build`, túi hạt theo `prices.seed`, đảo + thú) kèm `gift.length` ngày chuỗi. **Không có số nào viết tay trong HTML**: `xuDataLoad()` chỉ gọi **một** `GET /api/xu` rồi đưa nguyên khối cho `xuTodayRender()` → `xuDataRender()`, nên thẻ này và thẻ "Xu hôm nay" của tab thị trấn **không bao giờ lệch nhau**. Mở file tĩnh không có server → thẻ nói thẳng "ví nằm trong CSDL, chạy `npm start`" thay vì in số 0.
* **Huy hiệu 🪙 ở mọi màn chọn trò** (`xuHints()` trong `public/template.html`): `#xuHintModes` (đơn giá câu 3/4/2 + trần 60 + học thêm), `#xuHintWords` (+1/thẻ · +2/từ mới), `#xuHintDeck` (+4 ván vịt · +3 ván kỹ năng · mê cung 15/10/6 · hạn ván từng trò · giá file). Nguồn số là `window.TownCore.CONFIG` — **cùng object mà máy chủ dùng**, nên đổi giá trong `town-core.js` là mấy dòng này đổi theo.
* **Dòng thưởng thống nhất trên mọi bảng kết quả** (`#resSummary` của săn vịt/trắc nghiệm/mưa đáp án và `#skResSummary` của trò kỹ năng): `… · 🪙 +3 xu hoàn thành ván (ví 64 xu) · 🪙 hôm nay 31/60 xu bài học`. Hai đoạn nối **theo thứ tự** (trả ván xong mới đọc số ngày) và chỉ tốn **một** lần `GET /api/xu`. Màn tra cứu: `🪙 +2 xu · từ mới vào sổ` khi lưu, `🪙 +N xu cho M thẻ đã ôn (trần 15 xu/ngày)` khi xong phiên; hết trần thì câu **dịu**: *"Phiên này không thêm xu — vòng ôn từ hôm nay đã đủ rồi…"*.
* **Bảng kết quả hứa trước rồi mới nói thật** (04/11/2026): `POST /api/xu/round/start` kèm **`reward`** (số xu ván này sẽ nhận nếu đủ bằng chứng, tính bằng `TownCore.gameReward`), nên ngay lúc bảng điểm mở ra `xuAsk()` viết `· 🪙 Ván này được +4 xu`; `xuClose()` dùng `xuWhy()` — đọc **cả body của lời lỗi** — để **thay** đúng dòng đó bằng kết quả thật. Được thưởng → `· 🪙 +4 xu hoàn thành ván (ví 68 xu)`. Không được thưởng → **lý do của máy chủ hiện nguyên văn**, không còn im lặng: `Ván mới chạy 6 giây — cần ít nhất 30 giây.` · `Ván chưa có đủ 3 lượt trả lời (mới 2 lượt).` · hết trần 30 xu của nhà trò chơi · hết hạn ván của trò đó · ván đã đóng vì bỏ hơn 2 giờ. Mê cung (đường cũ `/api/xu/game`) in vào hộp `.dg-xu` của màn 💰 Kho báu: `🪙 Thưởng ván này: +15 xu (ví N xu)` hoặc `🪙 Ván này chưa được thưởng xu: <lý do>`. **Giao diện không tự viết số nào**: con số hứa đến từ `round.reward`, lý do đến từ `body.error`.
* Cả hai bảng kết quả mang `aria-live="polite"`; trạng thái chạm trần truyền bằng **chữ** ("còn 29" / "đủ rồi"), không chỉ bằng màu.
* **Chip ví** trên cảnh 3D: `🪙 N xu` (`UI.els.chipXu`), chip ngày: `📖 Hôm nay: X lượt · +A/60 xu từ bài học · 🌷 vườn +B/32`.
* Nhãn mỗi khu: `· +<earned> xu`; nhãn mỗi ô: `Xây 20 xu` / `Thiếu 13 xu`.
* **Hộp xác nhận** trước mọi lần tiêu, ghi rõ *giá*, *số dư hiện có*, *số dư sau khi chi*; từ chối / lỗi 409 → **cảnh giữ nguyên tuyệt đối**.
* Thiếu xu thì gợi ý đường kiếm: *"Ôn bài, chơi trò chơi, nộp tài liệu hay đăng nhập mỗi ngày đều có xu."*
* **Săn vịt / trò kỹ năng gọi `xuOpen()` lúc BẮT ĐẦU ván** (tab vừa mở, người chơi chưa kịp làm gì) và `xuClose()` lúc vẽ bảng điểm. 404/409 **không còn là dấu im lặng**: từ 04/11 màn kết quả in luôn lý do máy chủ trả về (xem §6 ở trên), nhưng **không alert, không chặn bảng điểm, không mất ván** — phần thưởng ván vẫn chỉ là phần phụ, lỗi đọc ví không được làm hỏng ván đã chơi.
* **Ngoại tuyến** (mở `public/toeic-game.html` không có server → `T3.offlineAdapter()`, khóa `localStorage` `<lsKey>.town`, mặc định `toeic.town.offline`; sổ cái lượt chơi nằm ở `toeic.town.attempts`): cùng **một hàm luật**, ví nằm trong `localStorage`; bản lưu cũ còn `materials` được **đổi 1:1 sang `xu` rồi xóa khóa cũ** ngay lần đọc đầu. Ngoại tuyến chỉ có xu bài học + vườn (`game/file/login/streak/extra/words/wordnew` = 0) vì những nguồn đó cần server.
* **Hai trang 3D prototype đọc đúng ví này**, không còn đường nào cộng xu trong biến: `public/thi_tran3D-three.html` gọi `GET /api/town` rồi tiêu bằng `POST /api/town/build` (chip `🪙 N xu (ví chung)`), `public/quan-dao-vo-tan-three.html` gọi `GET /api/islands` và tiêu qua `/api/islands/upgrade|adopt|food`. Cả hai nạp **cùng file luật** `src/island-core.js` / `town-core.js` bằng `<script src>`, nên giá hiển trên màn hình là giá server sẽ thu. Mở bằng `file:` (không có server) thì trang báo rõ "cần chạy server" thay vì tự in xu.


## 7. Kiểm thử

| Lệnh | Số ca | Phạm vi |
|---|---|---|
| `node scripts/test-town.js` (trong `npm test`) | **33** | luật thuần: thu 3/4/2/1 + trần 60, xây 20/50/100 **bằng ví chung**, vườn 10/2 tưới/16/32, `stateView` có `xu:{balance,today,left,caps,prices,games,rewards}` và `districts[]` không còn `materials` |
| `node scripts/test-xu-moi.js` (trong `npm test`) | **19** | **bảng xu mới, 0 CSDL 0 token**: B1–B6 giá + trần + `136 xu/ngày` · C1–C4 luật "học thêm" (`cut`, câu sai không vào `cut`, trần theo NGÀY) · D1–D4 `gameKeyOf`/`roundLimit`/`roundNeed`/`gameReward` (kể cả khóa độc hại `__proto__`) · E1–E2 `room()`/`fileGain()` giới hạn **từng file** · F1–F2 tám mốc chuỗi = **1.975 xu**, mỗi mốc một lần · G1 `CONFIG.xu` đủ hình dạng để giao diện đọc |
| `node scripts/test-island-core.js` (trong `npm test`) | **21** | giá 10/25/50 × hệ số, đảo 1 = 425 / đảo 2 = 490 / ≥15 = 1.275, 12 giống 40–600, 4 món ăn 3/8/15/40, 3 bữa + 5 lần chăm/ngày, sàn no–vui 30, `stateView` có `upCost` + bản đồ quần đảo |
| `node scripts/test-decor-core.js` (trong `npm test`) | **8** | **lõi trang trí đảo (D1), 0 CSDL 0 token**: catalog 46 + 32 + 15 món với tổng giá **3.573 / 1.229 / 830 = 5.632 xu** và nhóm giá khớp từng xu · `canPlace` từ chối **kèm lý do bằng chữ** (món lạ, lệch lưới 0,25, `rot` ngoài 8 bước, ra mép, đè từng loại ô đất, sát món chặn, chắn cửa Nhà, chắn bát nước cả hai chiều, món gói/XL chưa mở) · bốn mức ngân sách **40 / 12 / 2 / 1** · W và FX **không** vào danh sách vật cản · vòng đá siết kín bị **luật liền khối** bắt · **500 đảo** ngẫu nhiên đặt tối đa đồ chặn → **0 đảo bị làm tệ hơn** mức đảo trống (nhỏ nhất 98,99%) · thú đi **10.000 bước** trên đảo có 12 món chặn → **0 điểm hỏng** · vân đảo 1..13 không đổi khi có đồ. ca 6 ~15 s; `set DECOR_N=0 && node scripts/test-decor-core.js` còn ~1 s |
| `node scripts/test-sakura.js` (trong `npm test`) | **10** | 5 xu → 10 điểm, 20 xu → 50 điểm, chiết giá sát trần 900, không cho số âm |
| `npm --prefix json run test:town-api` | **26** | API thật + CSDL (schema tạm `town_test`): mỗi lần thu ghi **đúng một** dòng `garden`, thu bị từ chối **không ghi sổ**, song song xếp hàng |
| `npm --prefix json run test:xu-api` | **32** | **ví + ván trên PostgreSQL thật** (schema tạm `xu_test`): tám nguồn thu, chống in hai lần, trần ngày theo từng nhóm, chuỗi một lần suốt đời, `history` gộp thu+chi, migration `convert:materials`; ca 22–32 là mảng ván-server-cấp: `round/start` cấp mã **+ hứa đúng `reward` của trò đó** (ca 24) · `finish` thiếu bằng chứng → 409 · đúng 30 s + 3 lượt `duck:%` → +4 · hai trò kỹ năng **không** ăn hạn của nhau (V2) · ba trò Phân loại nhanh đóng ở ván thứ 3 · trần 30 cắt phần thừa · ván quá 2 giờ bị đóng + `meta.abandoned` · hết trần thì đóng luôn ván (không "để dành" sang mai) · `legacyGame:false` → 410 · mất mốc `last_attempt_id` không in xu "học thêm" lần hai |
| `npm --prefix json run test:sakura-api` | **19** | cây anh đào đọc/chiêu **đúng một ví** với thị trấn; ca 6 kiểm 100 lượt đúng một ngày = **60 bài học + 20 học thêm + quà** và 20 xu `extra` nằm trong `xu_ledger source='extra'` |
| `npm --prefix json run test:island-api` | **18** | đảo + thú trên PostgreSQL thật (schema tạm `island_test`, tự dọn): 409 thiếu xu **không đổi gì**, `xu_spend` `{island_upgrade, island-1, slot, cost, xu-sau-khi-tiêu}`, song song 15 xu → `[200, 409]`, hoàn chỉnh đúng 425 mới mở đảo kế, **không có POST nào cộng xu**, bất thu−chi−dư verified trên tài khoản 9 ngày |
| `npm --prefix json run test:decor-api` | **19** | **trang trí đảo (D2 → D5), 04/11**, PostgreSQL thật (schema tạm `decor_test`, tự dọn): mua trừ **đúng một dòng `decor_buy`** kèm số dư sau (ca 9) · từ chối thì **không có dòng chi nào** (10) · song song ví chỉ đủ một → `[200, 409]` (11) · `PUT layout` **không đụng ví** và tăng `layout_ver` (12) · vượt số đã mua / món chưa mua / món gói chưa mở → `409` (13, 14) · `baseVersion` cũ và **hai `PUT` song song** một thắng một `409`, bố cục lưu là một trong hai bản chứ không phải bản trộn (15, 16) · vị trí sai + 41 món → `400` kèm `errors[]` và **không lưu một phần nào** (17) · cất về kho **không hoàn xu, không mất đồ** (18) · ma trận phong cách: mở một lần `style_buy`, chọn lại **miễn phí** (19) · tổng đồ đặt **trên mọi đảo ≤ số đã mua** (20) · **chuyển 8 bảng của Khách** (kèm **danh sách ước**) khi đăng ký, không ghi đè (21) · API cũ không đổi hành vi (22) · **không đường nào làm xu tăng**: `Σ xu_spend = độ giảm ví` (23) · chọn từng nhánh không xóa ba nhánh kia (24, lỗi D4) · **`PUT /decor/wish` lưu đúng thứ tự, miễn phí, không đụng ví lẫn `layout_ver`** (25) · ước quá 10 món / khóa lạ / không phải mảng → `400` kèm lý do và **danh sách cũ đứng nguyên** (26) · `wishRows` tính "còn thiếu bao nhiêu xu" từ view thật, **đã có đồ thì 0** (27) |
| `npm --prefix json run test:wallet` | **114** | chạy cả **năm** bộ API trên (26 + 32 + 19 + 18 + **19**) |
| `npm --prefix json run test:lookup-api` | **30** | **máy chủ thật + CSDL dev** (`scripts/test-lookup-pg.js`): ôn thẻ `POST /api/words/:id/review` → **+1** xu vào ví chung, ôn lại **cùng thẻ cùng ngày** → +0 nhưng `box`/`reps` vẫn chạy (đúng ca 4 §10 của tài liệu đề xuất); ôn 20 thẻ một phiên → **15 dòng** (trần) nhưng Leitner cập nhật đủ 20 (ca 5); lưu từ mới `POST /api/words` → **+2**, từ trùng → +0, trần ngày **6 xu / 3 dòng** (ca 7); `GET /api/xu` báo đúng `income.words`/`income.wordnew` và **bất đối chiếu thu−chi−dư** (ca 16) |
| `npm --prefix json run test:auth-ui` (trong `npm test`) | **21** | kiểm trên **bản đã build** `/choi`: ván đi qua `/api/xu/round/start + round/finish` (`xuOpen`/`xuClose` + `xuWhy` đọc cả body lỗi, không còn `xuShowLine`), **bảng kết quả hứa trước `· 🪙 Ván này được +N xu` rồi thay bằng kết quả thật hoặc lý do máy chủ** (ca 04/11 — đồng thời cấm chuỗi viết tay `+4 xu` / `+3 xu`), mọi bảng kết quả có dòng xu + `aria-live`, **tab 💾 CSDL & tiến độ cũng hiện số dư ví xu bằng đúng một `GET /api/xu`**, huy hiệu 🪙 đọc `CONFIG` chứ không viết tay số, mê cung vẫn đường cũ `/api/xu/game`, thị trấn chỉ còn MỘT ví xu, **nút về của `/dang-nhap` đưa ra trang giới thiệu `/`** và `public/` chỉ còn **một** trang 🌸 |
| `npm --prefix json run xu:sim` | — | mô phỏng **số học** (0 CSDL): trần từng nhóm, ba kiểu người học, số ngày tới từng đảo, giá thú. Đọc `CONFIG.xu` + `IslandCore.costOf`, và `assert` trước rằng đảo 1/2/3/5/10/15 = 425/490/555/680/995/1.275 |
| `npm --prefix json run xu:sim:real` | — | **đo thật** từ CSDL (`--db`): min/trung vị/p90/max xu thu nhập học tập mỗi ngày, số ngày-học chạm trần 136, số ngày cần cho đảo 1 ở mức trung vị, và tỉ lệ từng nguồn. **Loại tài khoản demo** (`IslandCore.CONFIG.demoMail`) và in đúng số dòng đã loại. Xem §7.1 |
| `npm --prefix json run decor:sim` | — | mô phỏng **số học** của luật đặt đồ (0 CSDL): chạy `a=2000` đảo **chỉ theo luật khoảng cách** và `b=200` đảo **có kiểm liền khối**, in số món chặn đặt được và độ liền khối nhỏ nhất; kèm `--catalog` để cộng giá toàn catalog và "đảo mẫu 40 món = **863 xu**". **Từ D6 (05/11) có thêm phần (3):** nhét đầy một đảo 40 món bằng **chính `canPlace`** ba chiến lược → khoảng tiền thật phải trả **120 (rẻ nhất) · 1.480 (trung vị 24 đảo) · 4.410 xu (đắt nhất)**, kèm hai `assert` giữ cho "đảo mẫu viết tay" không rơi khỏi khoảng đó. Mọi con số lấy từ `IslandCore.DECOR`/`GEO`/`costOf` — **không viết tay**. |
| `npm --prefix json run decor:sim:real` | — | **(D6)** = `sim-trang-tri.js --db`, **chỉ SELECT**: percentile thu nhập học tập trên **toàn bộ lịch sử** (không chỉ 14 ngày như `xu:sim:real`), `xu_spend` **đã ghi** chia theo `kind` tính trên cột **`cost`** (số xu tiêu — **không** phải cột `xu` là số dư sau tiêu), kèm đối chiếu **mỗi dòng trang trí có chia hết cho giá niêm yết hiện hành không**, nhịp cho ăn của thú **đo từ `CONFIG`**, số ngày của catalog/đảo mẫu/khoảng đảo đầy tính theo **nhịp đo được**, và **ngưỡng mẫu** để được xét lại giá (**≥ 20 người × ≥ 280 ngày-học**). **Loại tài khoản demo** bằng `NOT EXISTS` trên `email LIKE CONFIG.demoMail` — `NOT EXISTS` chứ không `JOIN`, vì tài khoản Khách (`user_id = 0`) không có dòng trong `users` mà vẫn là người chơi thật. Xem §7.2 |
| `npm --prefix json run seed:3-dao` | — | **không phải lệnh đo — là lệnh tạo dữ liệu**: dựng tài khoản demo **đã hoàn thành ba đảo** (`demo-3-dao@quandao.invalid` / `DaoVoTan123`) bằng đường thật 100%: `POST /api/auth/register` → **114 dòng `xu_ledger`** (`meta.demo = true`, 100 xu/ngày × 19 ngày) cộng đúng số đó vào ví → **45 cú `POST /api/islands/upgrade`**. Cần `npm --prefix json start` chạy ở cửa sổ khác. Script tự nghiệm thu bằng SQL (`Σ thu − Σ chi == town_state.xu`, ba đảo có `completed_at`, `spent` bằng đúng 425+490+555). **Toàn bộ thu/chi của nó bị hai lệnh `--db` ở trên loại.** Chi tiết: README.md mục 60 |
| `npm test` | **313** | mười lăm bộ: parser 20 · ai-parser 26 · explainer 42 · skill-items 29 · dungeon 9 · dungeon-rules 12 · certificate 5 · town 33 · **xu-moi 19** · island-core 21 · **decor-core 8** · sakura 10 · lookup 48 · auth-ui 21 · landing 10 |

### 7.1 Số đo thật trên CSDL dev (X6, chạy sáng 03/11/2026)

`npm --prefix json run xu:sim:real` → cửa sổ 2026-10-21 → 2026-11-03, chỉ tính sáu nguồn **học tập** (`town_ledger` + `extra/game/words/wordnew/login`), chỉ tài khoản còn trong `users`:

* **3 người chơi có thu nhập, 6 ngày-học.** thấp nhất **1** · trung vị **19** · p90 **34** · cao nhất **39** xu/ngày.
* **0 ngày-học chạm trần 136** — trần mới cao hơn hẳn mức cày thực tế, nên nó là "đích của người học rất kỹ", không phải mức trung bình.
* Người ở mức trung vị cần **22,4 ngày** cho đảo 1 (425 xu), **25,8** cho đảo 2, **29,2** cho đảo 3 — đúng tinh thần "đảo là đích đường dài".
* Hỗn hợp nguồn trong 14 ngày: lesson **111** · convert **105** (một dòng di sản) · login **15** · file **25** · game **3**.
* *Lưu ý khi đọc số:* ngày 03/11 có dữ liệu của **tài khoản kiểm thử UI** `x5-ui-…@test.invalid` (id 31, 10 câu tự nhập, 64 xu) mà bạn chọn giữ lại để tự xem; lẫn vào cửa sổ đo là chủ đích của lần kiểm đó, không phải lỗi kinh tế.
* *Chạy lại 05/11 — cửa sổ là **lăn 14 ngày**, nên các dòng trên tự cũ:* lệnh mới in `Đo thật 2026-10-23 → 2026-11-05`, **3 người chơi có thu nhập · 8 ngày-học**, thấp nhất **1** · **trung vị 11** · p90 **34** · cao nhất **39** xu/ngày, **0 ngày chạm trần**; người ở trung vị cần **38,6** ngày cho đảo 1, **44,5** cho đảo 2, **50,5** cho đảo 3. Nguồn 14 ngày: lesson **117** · convert **105** · login **25** · file **25** · game **3**. Số đổi (19 → 11) chỉ vì một ngày học mới rơi vào cửa sổ, **không có lỗi nào** — vì vậy mỗi lần trích số phải kèm ngày chạy; §7.2 và mục 5 của README-trang-tri-dao.md lấy theo lần chạy 05/11.

Số liệu đối chiếu thật trên CSDL dev (chiều 03/11, tài khoản Khách, `user_id = 0`): thu `convert 35 + login 5`, chi `build 20 + sakura 15` (ba lần tưới) → **số dư 5**, đúng bằng `town_state.xu` mà `GET /api/xu` trả. Cộng cả 14 dòng `town_ledger` (45 xu) của thời cũ thì **không** khớp — đúng như ngoại lệ `upto` ở §1; `syncLessons` chỉ thưởng cho lượt **sau** mốc 275.

* *Chạy lại LẦN HAI chiều 05/11, sau khi đã có tài khoản demo 3 đảo:* số in ra **không đổi một dòng nào** so với lần chạy ở trên (3 người · 8 ngày-học · trung vị **11** · p90 34 · 38,6/44,5/50,5 ngày · lesson **117** · convert **105** · login **25** · file **25** · game **3**), vì `--db` nay loại `email LIKE '%@quandao.invalid'` và báo rõ đã loại gì: *"đã loại 1 tài khoản demo: 115 dòng thu / 1.905 xu và 45 dòng chi / 1.470 xu"*. Hàng rào này đáng giá hơn một chú thích — xem §7.2 để biết phép đo **toàn bộ lịch sử** (cùng công thức, không cắt cửa sổ) bị kéo đi đâu nếu bỏ điều kiện loại.

### 7.2 Số đo thật cho 🎨 trang trí (D6, chạy sáng 05/11/2026)

`npm --prefix json run decor:sim:real` — cùng sáu nguồn học tập của §7.1 nhưng **toàn bộ lịch sử** thay vì cửa sổ 14 ngày, và thêm **chi tiêu đã ghi**. *Số liệu dưới đây là ảnh chụp chiều 05/11 — mẫu dày lên từng ngày, chạy lại lệnh đo sẽ ra số mới; đó là chủ đích của phép đo, không phải lệch:*

* Cửa sổ đo **2026-10-29 → 2026-11-05**: **3 người chơi có thu nhập · 8 ngày-học**. Thấp nhất **1** · p25 **5** · **trung vị 11** · p75 **31** · p90 **34** · cao nhất **39** xu/ngày-học. **0 ngày chạm trần 136** (cao nhất mới bằng 29% trần). So §7.1 chạy hôm 03/11 (6 ngày-học · trung vị 19): mẫu **dày lên từng ngày** nên trung vị **tụt** — thêm hai ngày-học thật (04/11: 11 xu, 05/11: 5 xu) đều thấp hơn mức cũ. Đây là lý do mục này là **số đo có ngày**, không phải hằng số.
* *Giá trị của hàng rào demo, đo thẳng bằng SQL trên cùng công thức:* bỏ điều kiện loại `@quandao.invalid` thì phép đo toàn lịch sử này thành **4 người · 28 ngày-học**, cửa sổ tự nới về **2026-10-17** (19 ngày bơm ngược lịch sử), và **trung vị nhảy 11 → 76 xu/ngày** — đúng nhịp script demo ghi vào sổ (76 trong 100 xu/ngày nằm ở sáu nguồn được đếm, 24 xu `file` bị loại vì không thuộc nhóm học tập). Mọi số "ngày phải cày" bên dưới sẽ chia cho 76 thay vì 11, tức **quần đảo tự nhiên rẻ đi ~7 lần trên giấy** mà không một giá nào đổi.
* **Chi thật trong `xu_spend`: 31 dòng / 401 xu** — tính trên cột **`cost`** (số xu tiêu); cột **`xu`** của cùng bảng là **số dư NGAY SAU khi tiêu**, cộng nó ra **1.958** và tưởng là tổng chi là lỗi `sim-trang-tri.js` đã gặp và sửa 05/11. Theo kind: `style_buy` **220** (4 dòng, 50…60 mỗi lần, 1 ngày có chi) · `sakura` **150** (24, 5…20, 2 ngày) · `build` 20 (1, 20) · `decor_buy` **11** (2, 3…8, 1 ngày) · **`pet_food` 0 dòng, `pet_buy` 0 dòng, `island_upgrade` 0 dòng**. Nói cách khác: ví thật **đã mở** được hai khoản trang trí (`decor_buy`/`style_buy`) nhưng **chưa ai trả xu cho thú và thức ăn** trong dữ liệu đang có. Kèm một đối chiếu mới trong lệnh đo: **6/6 dòng `decor_buy`/`style_buy` chia hết cho đúng giá niêm yết hôm nay của chính món/khóa đó** — bằng chứng **không một giá nào đổi sau khi ghi sổ**.
* **Nhịp cho ăn đo từ chính luật đang chạy** (`CONFIG.mealsPerDay` × giá từng loại): hạt **9** · cá khô **24** · bánh thưởng **45** · bữa đặc biệt **120** xu/ngày/thú → **3** thú mặc định **27 xu/ngày**, **6** thú (trần hiệu năng) **54 xu/ngày**. So với **trung vị 11**: chỉ riêng tiền hạt của ba thú **đã vượt gấp đôi thu nhập một ngày** (còn **−16** xu). Vì `satietyFloor`/`moodFloor` = 30 và đói **không phạt gì**, đây là khoản **tự nguyện**, không phải thuế thân — nhưng nó đặt trần rất thật cho "vừa nuôi thú vừa mua đồ".
* **Ngày phải cày theo nhịp đo** (trong ngoặc là nhịp mô hình 67 xu/ngày mà tài liệu dùng trước 05/11): một đảo đầy trung vị **1.480 xu** = **134,5** (22,1) ngày · cả catalog **5.632** = **512,0** (84,1) · 8 đảo + 8 đảo mẫu **12.104** = **1.100,4** (180,7). Ở p90 **34 xu/ngày**: **43,5 / 165,6 / 356,0** ngày — cột p90 không đổi vì hai ngày-học mới đều dưới p90.
* **Kết luận cân bằng giá: giữ nguyên mọi giá.** Mẫu **3 người / 8 ngày-học** chưa tới ngưỡng script in ra (**≥ 20 người và ≥ 280 ngày-học**), nên số đo chỉ thay **cột ngày** và **khoảng tiền hợp lệ của một đảo đầy** (mục 5 của [README-trang-tri-dao.md](README-trang-tri-dao.md)), không sửa `DECOR_ITEMS`/`DECOR_STYLES`/`needDone`/`CONFIG.upgradeCost`.


## 8. Chưa làm / cân nhắc

* Cột di sản `materials`, `xu_day` và `sakura_state.coins` chưa **DROP** (không rủi ro chức năng, nhưng dọn thì không rút lại được).
* Chưa có **bảng xếp hạng theo xu**, chưa có **chuyển quà/xu giữa tài khoản**, chưa có đường nào đổi XP thú thành EXP tài khoản.
* Trần số ván tính cho **từng mã trò** (`game.rounds` + `roundsPerDay`); trần **xu** của cả nhà trò chơi là `game.cap` (30) — muốn siết thì đổi một con số đó, không thêm luật mới.
* **Bảng xu mới (X0–X6) đã ship** — xem §2, §2.1, §7, §7.1. Phần còn mở của roadmap đảo (M4/M6 bảng đảo trong game, M7 mô phỏng 90 ngày) nằm ở [README-dao-vo-tan-va-thu-cung.md](README-dao-vo-tan-va-thu-cung.md).
* `legacyGame` vẫn `true` vì **Mê cung** còn dùng `POST /api/xu/game`. Khi nào máy chủ Mê cung chuyển sang `round/start|finish` (bằng chứng = số quái đã hạ, server tự biết) thì đặt `false` — máy chủ trả 410, không cần sửa giao diện.
* ~~Demo `public/thi_tran3D—three.html` và `public/quan-dao-vo-tan-three.html` vẫn dùng **xu giả lập trong biến/`localStorage`**~~ — **đã bỏ (03/11)**: hai trang đọc `GET /api/town` / `GET /api/islands` và tiêu bằng `POST` thật, mọi nút "giả lập +N xu" đã xóa; bản tên gạch ngang dài bị trùng đã **xóa khỏi `public/`** (`thi_tran3D-three.html` là tên duy nhất còn lại). Bản thật vẫn là tab 🏘️ trong `toeic-game.html`.
* Quần đảo **chưa có trần ngày** cho phần chi: một ngày cày hết trần thu (~136 xu) là đủ nâng 2–3 ô đảo 1, nên tốc độ xây đảo hiện chỉ bị chậm bởi tốc độ học. Muốn "đảo là đích đường dài" thì siết `factorStep`, chứ không thêm luật mới.
* 🎨 **Trang trí đảo đã TIÊU được xu, cả trên màn hình (D2 + D3, 04/11):** **5.632 xu** cho **78 món** + 15 phong cách nằm một chỗ duy nhất trong `IslandCore.DECOR_*`, `GET /api/islands` trả qua `stateView().catalog`, và từ đợt này có **đường tiêu thật**: `POST /decor/buy` ghi `decor_buy`, `POST /style/buy` ghi `style_buy`, `POST /style` + `PUT /decor/layout` **miễn phí** (đổi phong cách và bố cục lại không tốn xu lần hai, cất đồ về kho cũng vậy). `test-decor-api.js` **15/15** chứng minh thêm hai điều về ví: bố cục sai **không trừ xu**, và **Σ `xu_spend` = độ giảm ví** trên suốt chuỗi mua + đặt (ca 12/17/23). **D3 nối tiếp (cùng ngày):** tab **🎨 Trang trí** trong `quan-dao-vo-tan-three.html` đã đi đúng các đường đó — **chỉ nút Mua** chạm ví và **luôn qua `D3.confirm`** (`Esc`/Hủy không trừ gì: đo thật **5 → 5** xu, kho **1 → 1**, tải lại vẫn **5**; mua thì **16 → 13**, đúng **một** dòng `decor_buy`), còn đặt · xoay · nhích · cất · Hoàn tác/Làm lại **toàn bộ là nháp trên máy**, bấm **Lưu** mới gửi một cú `PUT` và **ví đứng nguyên** (`layout_ver` **0 → 1 → 2**). Trang cũng có tự kiểm **13/13** và `test-decor-api` **16/16** chạy lại sau đợt này. **D4 nối tiếp (cùng ngày):** tab 🎨 có thêm **bảng Phong cách** chạy thật — **15 kiểu / 4 nhánh · 830 xu**, duy nhất nút `Mở … xu` chạm ví và cũng **luôn qua `D3.confirm`** (đo trên ví Khách: **300 → 240 → 180 → 130 → 80** cho 4 kiểu; mở lại kiểu đã sở hữu thì `409` và **ví đứng nguyên**), còn `Bật` / `↩ Về mặc định` **miễn phí** và **không đụng `layout_ver`** (đứng nguyên ở **2**). **D5 nối tiếp (cùng ngày):** catalog đội từ 62 lên **78 món / 4.802 xu** vì đổ thêm 4 gói chủ đề còn lại (32 món gói = **1.229 xu**), kèm 15 phong cách thành **5.632 xu** — **không đổi một giá món nào đã có**, chỉ thêm món. **⭐ Danh sách mong muốn** có bảng `decor_wish` + route `PUT /decor/wish`: **không sinh kind chi mới**, không `xu_spend`, không đụng `layout_ver`, ví **80 → 80** qua toàn bộ phép thử; cột "còn thiếu N xu" do `IslandCore.wishRows` tính **cùng công thức** cho server (ca 27) và tab 🎨 (đo với ví 80 xu: 🌿 🏮 **đủ rồi** · 🗿 **thiếu 220**). **📷 chế độ chụp ảnh** cũng không động tới ví: PNG sinh và lưu ngay trong máy người chơi, **server không nhận byte ảnh nào** (một cú chụp thử = **0 request**). Tự kiểm trong trang **13 → 17 mục, 17/17**, `test-decor-api` **16 → 19/19**. **D6 nối tiếp (05/11) — cân bằng giá bằng số đo, không phải ước tính:** `decor:sim:real` đo **trung vị 11 xu/ngày** (p90 34 · cao nhất 39) trên **3 người / 8 ngày-học** (cửa sổ đến 05/11), `xu_spend` thật **31 dòng / 401 xu** trên cột `cost` với **0 dòng `pet_food`**, và một đảo đầy 40 món nhét bằng **chính `canPlace`** tốn **120 … 4.410 xu (trung vị 1.480)**. **Không đổi một giá nào** vì mẫu còn dưới ngưỡng **20 người × 280 ngày-học** mà script tự in; số đo thay cột "ngày" và khoảng tiền hợp lệ. Chi tiết ở §7.2. **Chưa có:** trần **chi** theo ngày cho đồ trang trí (mua bao nhiêu trong một ngày tùy ví, không giới hạn riêng — cùng chính sách với đảo và thú, xem mục trên) và **bán lại đồ lấy xu**. Đặc tả + số liệu ở [README-trang-tri-dao.md](README-trang-tri-dao.md).
* Chưa nối `POST /api/islands/*` vào tab trong game (M4/M6) — hai trang prototype là nơi duy nhất chơi đảo; chưa có **bật/tắt tính năng đảo** như `/api/town/settings`.
