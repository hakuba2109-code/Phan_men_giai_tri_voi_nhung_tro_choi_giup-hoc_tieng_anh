# 🪙 Xu cho MỌI hoạt động học tập — kiểm kê, chỉnh sửa, cân bằng với nâng cấp đảo

> **Loại tài liệu:** đặc tả **chỉnh sửa** (phần chênh lệch) trên nền kinh tế một ví xu đã chạy ([README-kinh-te-xu.md](README-kinh-te-xu.md)). Không đổi nguyên tắc nền, chỉ **lấp các hoạt động học chưa có xu** và **tách trần để các hoạt động không cướp xu của nhau**.
> **Yêu cầu (tóm lược lời bạn):** *"Khi tham gia các hoạt động trò chơi, kỹ năng bài học, học thêm bài học thì nhận xu. Xu lấy từ trò chơi, bài học, nộp file tài liệu, đăng nhập mỗi ngày tặng, chuỗi học được tặng. Bao nhiêu xu tùy bạn, phù hợp với việc nâng cấp. Mọi hoạt động học tập đều được xu, lấy xu đó để nâng cấp đảo."*
> **Mình đã đọc hoặc tra từ khóa trong:** `README.md`, `README-kinh-te-xu.md`, `README-quan-dao-vo-tan-va-thu-cung.md`, `README-tro-choi-ky-nang.md`, `README-tim-loi-sai-va-phan-loai-nhanh.md` (chỉ tra từ khóa, không thấy nhắc xu), `README-me-cung-kho-bau.md`, bản dựng `toeic-game.html` và ba ảnh màn hình.
> **Mình KHÔNG có `src/*.js`** (`xu.js`, `town-core.js`, `island-core.js`…). Mọi nhận định về mã giao diện (trình duyệt) mình **đã đối chiếu trực tiếp trong `toeic-game.html`**; mọi nhận định về phía máy chủ lấy từ README nên Qoder phải **đối chiếu với `src/xu.js` trước khi sửa** (mục 11, bước X0).
> **Các con số:** giá đảo và bảng thu hiện tại **chép từ README**; bảng thu mới (mục 4) là **đề xuất**; số ngày ở mục 6 là **kết quả script `scripts/sim-xu-moi.js` đã chạy**, nhưng dựa trên ba "kiểu người học" **do mình giả định**, chưa phải dữ liệu người chơi thật.

## 1. Tóm tắt trong một bảng
| Nhóm | Hiện tại | Đề xuất |
|---|---|---|
| 📖 Trả lời câu hỏi (mọi trò ghi `attempts`) | 3/4/2/1 xu, trần **60**/ngày | **Giữ nguyên** (cũng là XP của thú) |
| ➕ **Học thêm** (đúng câu sau khi hết trần 60) | **0** | **+1 xu/câu, trần 20**/ngày, không cộng XP thú |
| 🎮 Hoàn thành ván | Săn vịt 4 · kỹ năng 3 · mê cung 15/10/6, trần **20**/ngày, **5 ván/trò**, mọi trò kỹ năng **dùng chung một hạn** | Săn vịt 4 (3 ván) · **mỗi trò kỹ năng có hạn riêng** 3 xu (2 ván) · mê cung 15/10/6 (2 ván), trần **30**/ngày |
| 📘 **Ôn từ đã lưu** (sổ từ) | **0** | **+1 xu/thẻ**, trần **15**/ngày |
| 💾 **Lưu từ mới vào sổ** | **0** | **+2 xu/từ** (một lần mỗi từ), trần **6**/ngày |
| 📄 Nộp file tài liệu | `25 + ⌊n/20⌋`, ≤60/file, ≤60/ngày | **Giữ nguyên** |
| 🔑 Đăng nhập mỗi ngày | 5 | **Giữ nguyên** |
| 🔥 Chuỗi ngày học | 3→15 · 7→30 · 14→60 · 30→120 · 50→200 · 100→350 | Giữ, **thêm 200→400 · 365→800** |
| Tổng trần/ngày (chưa tính file, vườn, quà chuỗi) | **85** | **136** |

## 2. Kiểm kê: hoạt động nào đang có xu, hoạt động nào chưa
Dựa trên ba ảnh màn hình và mã giao diện. Cột "Bằng chứng" cho biết mình thấy điều đó ở đâu.

| Hoạt động | Hiện được xu thế nào | Bằng chứng | Kết luận |
|---|---|---|---|
| 🔤 Trắc nghiệm A–D (lần lượt · xáo trộn · tốc độ) | Mỗi lượt trả lời → xu bài học | README.md §Thú ảo (bộ đồng bộ đọc **toàn bộ** `attempts`) | ✅ |
| 🫧 Mưa đáp án | Như trên | như trên | ✅ |
| 🦆 Săn vịt (thường · tốc độ · trùm) | Xu bài học **và** 4 xu/ván (`game:"duck"`) | `toeic-game.html`: `xuShowLine("duck", …)` | ✅ nhưng xem vấn đề V1 |
| 🗝️ Mê cung kho báu | Xu bài học mỗi trận (`mode='dungeon'`) **và** 15/10/6 khi hoàn thành | README-me-cung §Trận đánh; `reportRound` | ✅ |
| 🧠 Trò kỹ năng **có `key`** (Kéo đáp án, Blitz, Nối câu, Săn chữ cái, các trò `payload`…) | Xu bài học (`mode:"skill"`) **và** 3 xu/ván (`game:"skill"`) | `skillRecord` + `endSkill` → `xuShowLine("skill")` | ✅ nhưng xem V2 |
| 🗂️ **Phân loại nhanh** (Từ loại · Thì · in/on/at) | **Chỉ** 3 xu/ván (qua `endSkill` dùng chung); **không** có xu theo thẻ | `skillRecord` bỏ qua thẻ không `key`; README-tro-choi-ky-nang (mục "Lập trình 4 trò", dòng 221) | ⚠ thiếu |
| ✏️ Tìm lỗi sai | Như trò kỹ năng nếu thẻ có `key` | README-tro-choi-ky-nang (chỉ nói thẻ **phân loại** không ghi) | ❓ cần xác nhận |
| ❌ Ôn câu sai · 🗓 Ôn theo lịch Leitner | Xu bài học (cùng engine ghi `attempts`) | README.md | ✅ |
| 📘 **Ôn từ đã lưu** (sổ từ, ≤20 thẻ/phiên) | **Không** | `toeic-game.html` chỉ có **một** lời gọi `/api/xu` (`xuRound`) và nó không nằm trong màn ôn từ; README không nêu | ✗ |
| 💾 Lưu từ vào sổ | **Không** | như trên | ✗ |
| 🔎 Bôi đen tra cứu, 🔊 phát âm, 💡 giải thích, 🤖 Gia sư AI | Không | — | **Cố ý không thưởng** (mục 5) |
| 📄 Thêm đề từ file Word · 🤖 Phân tích bằng AI | `25 + ⌊n/20⌋`, ≤60/file | README-kinh-te-xu §2 | ✅ |
| 🔑 Đăng nhập · 🔥 Chuỗi học | 5/ngày · mốc một lần đời | README-kinh-te-xu §2 | ✅ |

### Năm vấn đề tìm thấy
| # | Vấn đề | Tính toán / bằng chứng |
|---|---|---|
| **V1** | **Năm ván Săn vịt đã cạn cả trần "trò chơi"** | `4 xu × 5 ván = 20 = trần 20`. Chơi vịt trước thì mê cung, kỹ năng **không còn gì để nhận** trong ngày |
| **V2** | **Cả 18 trò kỹ năng dùng chung một bộ đếm** | Giao diện luôn gửi `game:"skill"`, hạn là "5 ván/trò/ngày" nên **ván thứ 6 của bất kỳ trò kỹ năng nào trắng tay**, dù người chơi đổi sang trò khác |
| **V3** | **Ôn từ và lưu từ không có xu** | Là hoạt động học thật (có lịch Leitner riêng) nhưng người chơi làm xong không thấy gì |
| **V4** | **Học thêm sau khi hết trần 60 thì 0 xu** | Người học nhiệt tình bị im lặng. Cần giữ chống cày nhưng không nên là "số 0" tuyệt đối |
| **V5** | **Server không biết ván có thật sự được chơi** | `xuRound` tạo `roundId` **ở trình duyệt** (`game-<giờ>-<ngẫu nhiên>`) rồi gọi `POST /api/xu/game`. Ai gọi thẳng API 5 lần sẽ nhận 20 xu/ngày **mà không chơi**. Hiện chỉ bị chặn bởi trần, chưa có bằng chứng ván thật |

V5 là điểm **nên sửa trước khi nâng trần trò chơi từ 20 lên 30**, vì trần cao hơn thì lỗ hổng này lấy được nhiều hơn (mục 7).

## 3. Nguyên tắc (giữ bốn nguyên tắc cũ, thêm bốn)
Giữ nguyên: **một ví** · **server luôn đúng** · **không in hai lần** (`UNIQUE` trong sổ cái) · **chỉ người chơi chủ động tiêu mới bị trừ**.

Thêm:
5. **Mỗi loại hoạt động có trần riêng**, để hoạt động này không ăn mất phần của hoạt động kia (sửa V1, V2).
6. **Thưởng công sức, không thưởng thao tác thụ động**: đọc giải thích, tra từ, nghe phát âm **không** có xu (mục 5).
7. **Hết trần thì cắt, không dồn sang mai** (giữ như cũ), nhưng vẫn **ghi nhận** rằng người chơi đã học thêm bằng nhóm "học thêm" nhỏ (sửa V4).
8. **Không thưởng cho ván mà server không chứng kiến** (sửa V5).

## 4. Bảng thưởng mới (đề xuất)
### 4.1 Nhóm A — Trả lời câu hỏi (không đổi)
Mọi lượt trả lời được ghi `attempts` (trắc nghiệm, mưa, vịt, mê cung, trò kỹ năng có `key`, ôn câu sai, ôn lịch): **3** câu mới · **4** sửa câu từng sai · **2** ôn đúng hẹn · **1** lặp quá sớm; một câu chỉ thưởng một lần mỗi ngày; **trần 60/ngày**; **cộng XP thú bằng đúng số xu**.

### 4.2 Nhóm B — Học thêm (mới)
| Mục | Quy tắc |
|---|---|
| Khi nào | Lượt trả lời **đúng** mà đáng được thưởng ở nhóm A nhưng **đã hết trần 60** hôm đó |
| Xu | **+1 xu / lượt** |
| Trần | **20 xu/ngày** |
| XP thú | **Không cộng** (XP thú vẫn bị trần 60) |
| Ghi sổ | `xu_ledger` `source='extra'`, `source_ref = attempt:<id>` → một lượt chỉ một lần |
| Ý nghĩa | Người học thêm nhận lại **1/3** giá trị so với trong trần, đủ để thấy mình được ghi nhận, không đủ để cày |

### 4.3 Nhóm C — Hoàn thành ván (sửa)
Mỗi trò có **hạn riêng** (không còn "dùng chung"), tất cả chung **trần nhóm 30/ngày** (từ 20).
| Trò (`khóa`) | Xu/ván | Ván có thưởng/ngày |
|---|---|---|
| Săn vịt (`duck`) | **4** | **3** (từ 5) |
| Mê cung (`maze`) | **15 / 10 / 6** theo Vàng/Bạc/Đồng | **2** |
| **Mỗi** trò kỹ năng (`skill:<mã trò>`, kể cả ba trò Phân loại nhanh) | **3** | **2 cho mỗi trò** |
| Trần nhóm | — | **30 xu/ngày** |
Vì sao giảm ván vịt từ 5 xuống 3: để một trò **không nuốt hết trần**. Chơi đủ 3 vịt (12) + 2 kỹ năng khác nhau (6+6) + một mê cung (15) = 39 > 30, nên người chơi **đa dạng trò thì lấy đủ trần**, người chỉ chơi một trò thì **kém hơn trước** (vịt: 12 thay vì 20). Đây là chủ ý khuyến khích đổi trò, **cần bạn chốt** (mục 12, câu 3).

### 4.4 Nhóm D — Từ vựng (mới)
| Việc | Xu | Trần | Ghi sổ |
|---|---|---|---|
| **Ôn một thẻ** trong *📖 Ôn từ đã lưu* (mọi mức: Nhớ · Chưa chắc · Quên) | **+1** | **15/ngày** | `words`, `source_ref = word:<id thẻ>:<ngày>` |
| **Lưu một từ/cụm mới** vào sổ | **+2** | **6/ngày** | `wordnew`, `source_ref = wordnew:<id thẻ>` (một lần cho mỗi từ **suốt đời**) |
Thưởng **mọi mức đánh giá** (kể cả "Quên") vì thẻ ôn lặp lại chỉ có ích khi người học **tự đánh giá thật**; thưởng theo kết quả sẽ khuyến khích bấm "Nhớ" bừa. Thẻ "Quên" quay lại cuối phiên **không thưởng lần hai** (mã giao diện đã bỏ qua lời gọi API cho thẻ `__retry`). Thẻ chỉ đến hạn khi lịch Leitner cho phép nên **không thể cày** bằng cách ôn đi ôn lại.

### 4.5 Nhóm E, F, G (giữ)
| Nhóm | Quy tắc | Ghi chú |
|---|---|---|
| 📄 File | `25 + ⌊n/20⌋`, ≤60/file, ≤60/ngày, `source_ref = file:<id>` | Nộp lại cùng file: 0 |
| 🔑 Đăng nhập | **5**/ngày, `login:<ngày>` | — |
| 🔥 Chuỗi | Ngày tính là "ngày học" khi có **≥5 lượt** trả lời. Mốc **3→15 · 7→30 · 14→60 · 30→120 · 50→200 · 100→350**, **thêm 200→400 · 365→800**, mỗi mốc nhận **một lần suốt đời** | **Đứt chuỗi không mất xu đã nhận** |
| 🌷 Vườn hoa | Không đổi (thu hoạch 16, trần 32/ngày) | Không liên quan học |

### 4.6 Cấu hình một nơi (đề xuất cấu trúc)
Mọi con số nằm ở **một khối cấu hình duy nhất** (ví dụ trong `src/xu.js`, kiểm tra tên thật), giao diện và test đọc từ đó:
```js
rewards: {
  lesson:  { cap: 60 },                          // giữ nguyên, do town-core tính
  extra:   { perAttempt: 1, cap: 20 },           // MỚI
  game:    { cap: 30,                            // từ 20
             duck:  { reward: 4, rounds: 3 },
             maze:  { reward: [15, 10, 6], rounds: 2 },
             skill: { reward: 3, rounds: 2 } },  // hạn đếm RIÊNG cho từng skill:<mã trò>
  words:   { perCard: 1, cap: 15 },              // MỚI
  wordnew: { perWord: 2, cap: 6 },               // MỚI
  file:    { base: 25, per: 20, perFile: 60, cap: 60 },
  login:   { gift: 5 },
  streak:  { 3: 15, 7: 30, 14: 60, 30: 120, 50: 200, 100: 350, 200: 400, 365: 800 },
}
```
Chỉnh giá sau này chỉ sửa khối này. **Đặt `cap: 0` ở nhóm mới là về đúng hành vi cũ** (cách quay lại, mục 11).

## 5. Những gì cố ý KHÔNG có xu
| Hoạt động | Vì sao không thưởng |
|---|---|
| 🔎 Bôi đen tra cứu, 🔊 phát âm | Thụ động, bấm nhiều không có nghĩa là học nhiều; lại tốn token Gemini nếu thưởng khiến người chơi tra bừa |
| 💡 Giải thích, 🤖 Gia sư AI, 🔍 phân tích theo quy tắc | Đọc không phải làm bài. **Học từ giải thích rồi làm đúng câu sau** đã có xu nhóm A |
| Tải/nhập tiến độ JSON, xóa bộ đề, đổi giao diện | Không phải học |
| Bấm thú, bấm đất trên đảo | Đã ghi rõ trong tài liệu đảo: không thưởng |
**Ngoại lệ có chủ ý:** *lưu từ mới* (nhóm D) có xu vì nó dẫn tới việc ôn lặp lại sau này; giới hạn 6 xu/ngày để không biến tra cứu thành máy in xu.

## 6. Cân bằng với nâng cấp đảo
Giá đảo (công thức `Math.round(gốc × hệ số)`, gốc 10/25/50, 5 ô, hệ số `min(3, 1 + 0,15×(n−1))`) **script đã tự kiểm khớp 6 giá trị trong tài liệu**: đảo 1 = **425** · đảo 2 = **490** · đảo 3 = **555** · đảo 5 = **680** · đảo 10 = **995** · đảo ≥15 = **1.275**.

**Ba kiểu người học (giả định, chưa đo):**
| Kiểu | Hằng ngày làm gì | Hiện tại | Đề xuất |
|---|---|---|---|
| **Học nhẹ** (~10 phút) | 15 xu bài học, 4 xu ván, 5 đăng nhập | **24** xu/ngày | **24** |
| **Học đều** (~30 phút) | 40 bài học, 12 ván, 8 ôn từ, 2 từ mới, 5 đăng nhập | **57** | **67** |
| **Học kỹ** (~60 phút) | chạm mọi trần | **85** | **136** |

**Số ngày hoàn chỉnh một đảo** (học liên tục, chưa tiêu gì khác, **chưa tính** quà chuỗi; từ `scripts/sim-xu-moi.js`):
| Đảo | Giá | Học nhẹ | Học đều (hiện → đề xuất) | Học kỹ (hiện → đề xuất) |
|---|---|---|---|---|
| 1 | 425 | 17,7 | 7,5 → **6,3** | 5,0 → **3,1** |
| 2 | 490 | 20,4 | 8,6 → **7,3** | 5,8 → **3,6** |
| 3 | 555 | 23,1 | 9,7 → **8,3** | 6,5 → **4,1** |
| 5 | 680 | 28,3 | 11,9 → **10,1** | 8,0 → **5,0** |
| 10 | 995 | 41,5 | 17,5 → **14,9** | 11,7 → **7,3** |
| ≥15 | 1.275 | 53,1 | 22,4 → **19,0** | 15,0 → **9,4** |

Thú (Học đều, 67 xu/ngày): ⭐ 40 xu ≈ **0,6** ngày · ⭐⭐ 120 ≈ **1,8** · ⭐⭐⭐ 300 ≈ **4,5** · ⭐⭐⭐⭐ 600 ≈ **9,0** ngày.

**Đọc kết quả thật thà:**
* Người **học kỹ** nhanh hơn rõ (khoảng **60%** nhiều xu hơn); người **học đều** chỉ nhanh hơn khoảng **18%** (57 → 67). Nghĩa là các nhóm mới thưởng chủ yếu cho **người dùng nhiều hoạt động**.
* **Học nhẹ không đổi**: 24 xu/ngày khiến đảo 1 mất **gần 18 ngày** (14 ngày nếu giữ chuỗi liên tục nhờ quà chuỗi). Nếu muốn người này xong đảo 1 trong khoảng 10 ngày thì **không có nhóm xu nào trong tài liệu này giúp được**; phải **giảm giá đảo** (ví dụ gốc 10/25/50 → 6/15/30, đảo 1 = **255** xu) hoặc tăng quà đăng nhập. Mình **không đổi giá đảo** trong bản này vì giá đang được kiểm thử (21 ca) và nằm ngoài yêu cầu; đây là câu hỏi 4 ở mục 12.
* Trần tổng **136** là mức **chạm hết mọi trần**, rất ít người đạt hằng ngày.

## 7. Chống gian lận: ván do server cấp (sửa V5)
**Hiện tại:** trình duyệt tự sinh `roundId` rồi xin thưởng. **Đề xuất:** máy chủ cấp ván và chỉ thưởng khi có **bằng chứng**.

```
POST /api/xu/round/start   {game, skill?}              → {roundId, startedAt}   (lưu xu_rounds, mở)
   …người chơi chơi, mỗi lượt vẫn ghi attempts như cũ…
POST /api/xu/round/finish  {roundId, place?}           → {reward, balance} hoặc 409 + lý do
```
Điều kiện để `finish` có xu (tất cả do **server** kiểm tra):
| Kiểm tra | Giá trị đề xuất |
|---|---|
| Ván thuộc về tài khoản này, đang **mở**, chưa `finish` | bắt buộc |
| Thời gian từ `startedAt` | ≥ **30 giây** (vịt, kỹ năng), ≥ **25 giây** (Phân loại nhanh) |
| **Bằng chứng**: số lượt trong `attempts` của chính người này kể từ `startedAt` với đúng loại `mode` | ≥ **3** lượt (vịt: `duck:%`; trò kỹ năng có `key`: `skill`) |
| Phân loại nhanh (không có `attempts`) | chỉ kiểm thời gian; vì thế **giữ hạn 2 ván/ngày** |
| Mê cung | giữ như cũ (server tự ghi khi hoàn thành, khóa là nội dung ván) |
| Mỗi tài khoản | tối đa **một ván mở** cho mỗi `khóa trò`; ván mở quá **2 giờ** bị bỏ |
Bỏ ván giữa chừng: không có xu ván, nhưng **xu bài học của từng câu đã trả lời vẫn tính** (không phạt).
**Tương thích:** giữ `POST /api/xu/game` cũ ở chế độ **tắt được** (`rewards.legacyGame: true/false`) trong lúc chuyển giao diện sang `start/finish`.
**Giới hạn thật:** Phân loại nhanh vẫn yếu hơn (chỉ có thời gian), nên nó có hạn thấp nhất; muốn chặt hơn thì phải ghi từng thẻ lên server (câu hỏi 5, mục 12).

## 8. Thay đổi dữ liệu và API (cần Qoder đối chiếu với `src/xu.js`)
**`xu_ledger.source`**: thêm `extra`, `words`, `wordnew`. Ràng buộc `CHECK` đã từng được mở rộng bằng `DROP/ADD CONSTRAINT` (README-kinh-te-xu §5); **đọc tên thật** bằng `\d xu_ledger`:
```sql
ALTER TABLE xu_ledger DROP CONSTRAINT IF EXISTS <tên_ràng_buộc_thật>;
ALTER TABLE xu_ledger ADD CONSTRAINT xu_ledger_source_check
  CHECK (source IN ('game','file','login','streak','convert','garden','extra','words','wordnew'));
```
**Bảng mới `xu_rounds`** (chỉ khi làm mục 7): `user_id`, `round_id`, `game` (`duck`/`maze`/`skill:<mã>`), `started_at`, `finished_at NULL`, `UNIQUE (user_id, round_id)`.
| API | Thay đổi |
|---|---|
| `GET /api/xu` | Thêm `income.extra/words/wordnew` · `left.extra/words/wordnew/game` · `rounds` đếm theo **từng khóa trò** (`duck`, `maze`, `skill:<mã>`) |
| `POST /api/words/:id/review` | Sau khi cập nhật lịch, **trong cùng giao dịch** `grant('words', 'word:<id>:<ngày>', 1)`; trả thêm `xu:{reward, balance}` |
| `POST /api/words` (lưu từ mới) | Chỉ khi chèn dòng **mới** (không trùng `UNIQUE (user_id, text_norm)`): `grant('wordnew', 'wordnew:<id>', 2)` |
| Đồng bộ bài học (`syncLessons`) | Với lượt đúng bị `applyAttempts` bỏ vì **hết trần**: `grant('extra', 'attempt:<id>', 1)` tới trần 20. Cần để `applyAttempts` **trả thêm danh sách các lượt bị cắt** (id + loại), không đoán |
| `POST /api/xu/round/start|finish` | Mới (mục 7) |
| `POST /api/xu/game` | Giữ tương thích, tắt được |
`grant()` đã có sẵn cơ chế **cắt phần thừa theo trần** và chống trùng; các nhóm mới **dùng lại nguyên cơ chế đó**, không viết đường ghi sổ thứ hai.

## 9. Giao diện: ai làm gì cũng thấy xu
Hiện chỉ Săn vịt và trò kỹ năng nối dòng "🪙 +N xu" vào bảng kết quả; mê cung hiện riêng ở màn chứng chỉ; **ôn từ, nộp file và đăng nhập không hiện cùng kiểu**. Đề xuất một **dòng thưởng thống nhất** ở mọi màn kết quả:
| Màn | Dòng hiển thị (ví dụ) |
|---|---|
| Kết quả ván | `🪙 +12 xu: 9 xu trả lời · 3 xu hoàn thành ván · hôm nay còn 31/60 bài học` |
| Hết trần bài học | `🪙 +4 xu học thêm (còn 16/20). Bài học hôm nay đã đủ 60, bạn đang học thêm — tuyệt!` |
| Ôn từ xong phiên | `🪙 +12 xu (12 thẻ). Còn 3/15 xu ôn từ hôm nay.` |
| Lưu từ mới | `🪙 +2 xu · từ mới vào sổ` |
| Nộp file | `🪙 +30 xu · 100 câu mới` |
| Hết trần một nhóm | Câu **dịu, không thúc ép**: `Hôm nay vòng ôn từ đã đủ xu rồi. Bạn vẫn có thể ôn tiếp để nhớ lâu hơn.` |
**Bảng "Xu hôm nay"** (một thẻ trong tab Thị trấn/Đảo): thanh tiến độ cho từng nhóm: *Bài học 40/60 · Học thêm 0/20 · Trò chơi 12/30 · Ôn từ 8/15 · Từ mới 2/6 · Đăng nhập ✓*. **Huy hiệu nhỏ** cạnh mỗi hoạt động trên thẻ bộ đề (`🪙 3/câu`, `🪙 +4/ván`, `🪙 +1/thẻ`) để người chơi **thấy ngay mọi hoạt động đều có xu**.
Trợ năng: dòng thưởng trong `aria-live`, không chỉ màu; không đếm ngược, không từ ngữ dọa.

## 10. Kiểm thử cần thêm (0 token; theo khuôn `test-xu-api.js`)
| # | Ca | Kết quả mong đợi |
|---|---|---|
| 1 | 70 câu mới đúng trong một ngày | Bài học **60**, học thêm **10**; XP thú chỉ **60** |
| 2 | 100 câu mới đúng | Học thêm dừng ở **20** (trần), lượt thừa không ghi sổ |
| 3 | Đồng bộ lặp / mất mốc `last_attempt_id` | Số dư **không đổi** (`UNIQUE` chặn) |
| 4 | Ôn một thẻ | **+1**; ôn lại **cùng thẻ cùng ngày** → **+0** |
| 5 | Ôn 20 thẻ trong một phiên | Ví **+15** (trần), lịch Leitner **vẫn cập nhật đủ 20** |
| 6 | Thẻ "Quên" quay lại cuối phiên | **Không** thưởng lần hai |
| 7 | Lưu 4 từ mới; lưu lại từ cũ | **+6** (trần), từ trùng **+0** |
| 8 | Vịt 4 ván | **12** (ván thứ 4 bị từ chối, 409) |
| 9 | Trò kỹ năng A 3 ván, trò B 2 ván | A **6**, B **6** (hạn **riêng**, sửa V2) |
| 10 | Vịt 3 + kỹ năng 3 trò × 2 + mê cung vàng | Nhóm trò chơi cắt đúng **30** |
| 11 | `finish` không có `start`, `finish` sớm hơn 30 giây, `finish` lần hai, `finish` ván của người khác | 409/404, **không** xu |
| 12 | `start` rồi bỏ ván; `start` hai lần liền | Không xu; ván cũ bị đóng, chỉ **một** ván mở |
| 13 | Phân loại nhanh 3 ván cùng trò | **6** (hạn 2 ván), ván thứ 3 từ chối |
| 14 | Chuỗi chạm 200 và 365 | **+400**, **+800** một lần suốt đời; đứt chuỗi rồi học lại **không** nhận lại |
| 15 | Hai request tiêu/thu song song | Một thành công, số dư **không âm**, **không nhân đôi** |
| 16 | **Đối chiếu sổ:** `Σ town_ledger + Σ xu_ledger − Σ xu_spend == town_state.xu` | Đúng với các nguồn mới (trừ ngoại lệ mốc `upto` cũ) |
| 17 | Cấu hình `cap: 0` ở `extra`, `words`, `wordnew` | Hành vi **y hệt bản cũ** |
Thêm vào `npm test` cùng một bộ `scripts/test-xu-moi.js` (luật thuần) và mở rộng `test-xu-api.js` (API thật).

## 11. Kế hoạch theo mốc
| Mốc | Việc | Tiêu chí xong |
|---|---|---|
| **X0** | Qoder đọc `src/xu.js`, `town-core.js`, router `/api/words`; **đối chiếu mục 2 và 8**; bạn trả lời mục 12 | Có văn bản chốt; sửa bảng nếu mã thật khác README |
| **X1** | Khối cấu hình tập trung (4.6), migration `CHECK`, `GET /api/xu` mở rộng | Ca 17 (cap 0 = cũ), ca 16 đạt |
| **X2** | Ván do server cấp (`start/finish`), hạn riêng từng trò, nâng trần game lên 30 | Ca 8–13 đạt; client chuyển sang `start/finish`; `legacyGame` tắt được |
| **X3** | Nhóm từ vựng (`words`, `wordnew`) | Ca 4–7 đạt |
| **X4** | Học thêm (`extra`), `applyAttempts` trả danh sách lượt bị cắt | Ca 1–3 đạt, **XP thú không đổi** |
| **X5** | Giao diện: dòng thưởng thống nhất, "Xu hôm nay", huy hiệu | Mọi màn kết quả có dòng thưởng; `aria-live`; 360 px không tràn |
| **X6** | Mốc chuỗi 200/365, chạy lại mô phỏng bằng **dữ liệu thật**, chỉnh trần | Số liệu mục 6 được thay bằng số đo thật |
**Quay lại:** đặt `cap: 0` cho `extra`, `words`, `wordnew`, đặt `legacyGame: true` và đưa trần/ván về 20 và 5; không cần xóa dữ liệu (các dòng sổ cái đã ghi vẫn hợp lệ, số dư không đổi).

## 12. Cần bạn chốt (ảnh hưởng thiết kế)
| # | Câu hỏi | Mình đề xuất |
|---|---|---|
| 1 | **"Học thêm bài học"** bạn muốn là gì? Mình hiểu là **học vượt trần 60** (nhóm B) **và** các hoạt động học ngoài bài chính như ôn từ (nhóm D). Hay là **thêm bài học = nộp thêm tài liệu** (đã có)? | Như mình hiểu; nếu bạn muốn khác, nói mình |
| 2 | Có chấp nhận **thêm nhóm "học thêm" 1 xu/câu** (trần 20) không? | Có |
| 3 | Chấp nhận giảm ván vịt có thưởng từ **5 → 3** để nhường chỗ trò khác? | Có |
| 4 | **Giá đảo** giữ nguyên (đảo 1 = 425) hay hạ để người học nhẹ xong đảo 1 trong khoảng 10 ngày? | Giữ nguyên, quan sát dữ liệu thật ở X6 |
| 5 | Phân loại nhanh có cần **ghi từng thẻ lên server** để chống gian lận chặt hơn không? | Chưa; giữ hạn thấp |
| 6 | Có đồng ý **không thưởng** tra cứu/giải thích/Gia sư AI (mục 5)? | Đồng ý |
| 7 | Tìm lỗi sai có ghi `attempts` không? | Qoder xác nhận ở X0; nếu không, đối xử như Phân loại nhanh |
