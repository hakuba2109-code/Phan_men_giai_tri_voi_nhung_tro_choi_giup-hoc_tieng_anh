# 🎧📖✍️ Trò chơi theo kỹ năng: Reading · Listening · Writing

> **Trạng thái (cập nhật 31/10/2026):** **18 trò đã lập trình** và chạy thật trong từng bộ đề — 4 trò đọc `payload` của câu có A–D (Săn bằng chứng, Nghe và phản hồi nhanh, Sửa lỗi trong email, Xếp từ thành câu), 4 trò chỉ cần câu A–D thường (Kéo đáp án vào chỗ trống, Đúng hay sai — Blitz, Nối câu với đáp án, Săn chữ cái), **6 trò cho câu không có A–D**, dựng từ `payload` của chính các dạng mà AI đã lưu (Đúng hay Sai — Mệnh đề, Điền từ, Tính ra số, Chọn đủ đáp án đúng, Nối cặp theo đề, Sắp xếp theo thứ tự) và **4 trò mới suy ra từ bộ luật `explainer.js`** theo [README-tim-loi-sai-va-phan-loai-nhanh.md](../README-tim-loi-sai-va-phan-loai-nhanh.md): **Tìm lỗi sai** (Writing) + bộ ba **Phân loại nhanh: Từ loại · Thì · in/on/at** (Reading). Bốn trò sau **không cần thêm dữ liệu, không gọi AI, không sửa CSDL, không thêm endpoint** và nằm ở file riêng **`skill-extra.js`** để `template.html` không phình. Các trò chưa làm vẫn ghi "Sắp có". Số liệu thật và bảng độ phủ theo từng bộ đề nằm trong [README.md § Trò chơi theo kỹ năng](README.md#-trò-chơi-theo-kỹ-năng-đã-có); tài liệu này giữ vai trò thiết kế + danh sách phát triển tiếp.
> **Yêu cầu gốc đã xử lý:** trước 29/10, 15 câu `tf` / `fill` / `numeric` / `multi` / `match` / `order` được nhập vào CSDL nhưng **không chơi được ở bất kỳ màn nào** (bộ lọc `isPlayable` chỉ nhận câu A–D). Sáu trò mới chính là màn chơi của 15 câu đó.
> Bổ sung cho [README.md](README.md) (Săn vịt mô tả trong § 🦆 Chế độ Săn vịt của README.md).

## 1. Nguyên tắc
Mỗi kỹ năng có trò hợp với **việc người học phải làm khi thi**: Reading là tìm thông tin, Listening là bắt thông tin trong thời gian ngắn, Writing là dựng và sửa câu. Bắn vịt chỉ dùng cho câu có lựa chọn ngắn; câu không hợp thì tự chuyển sang trò khác hoặc giao diện Trắc nghiệm chuẩn.

## 2. Danh sách trò chơi
| Kỹ năng | Trò | Cách chơi | Trạng thái |
|---|---|---|---|
| Reading | **Săn bằng chứng** | Chạm câu chứa bằng chứng (+5 EXP), rồi chọn đáp án (+10) | ✅ Đã lập trình |
| Reading | **Kéo đáp án vào chỗ trống** (thay cho "Part 6 kéo thả") | Kéo hoặc bấm-then-bấm thẻ đáp án thả vào ô `___` trong câu | ✅ Đã lập trình (29/10) |
| Reading | **Đúng hay sai — Blitz** | Câu hiện ra đã điền sẵn một đáp án (đúng hoặc sai ngẫu nhiên); phán đoán trong 8 giây | ✅ Đã lập trình (29/10) |
| Reading | **Nối câu với đáp án** | Bàn 4 câu × 4 đáp án xáo thứ tự; mỗi cặp đúng +5 EXP, sai −1 mạng, bàn không reset | ✅ Đã lập trình (29/10) |
| Reading | **Phân loại nhanh: Từ loại** | Thẻ câu (chỗ trống cần loại từ nào) hoặc thẻ từ (từ này là loại gì) → ném vào ô **Danh từ · Động từ · Tính từ · Trạng từ** trong 8 giây | ✅ Đã lập trình (31/10) |
| Reading | **Phân loại nhanh: Thì** | 4 dạng của một họ động từ → ném vào ô thì mà **dấu hiệu thời gian trong đề** bắt buộc | ✅ Đã lập trình (31/10) |
| Reading | **Phân loại nhanh: in / on / at** | Cụm thời gian → ném vào ô giới từ đúng (6 giây) | ✅ Đã lập trình (31/10) |
| Writing | **Tìm lỗi sai** | Câu đã điền một đáp án **sai** vào `___`: Bước 1 chạm từ sai, Bước 2 chọn cách sửa đúng | ✅ Đã lập trình (31/10) |
| Reading | Xếp lại đoạn văn | Các câu bị xáo, xếp lại cho mạch lạc | Sắp có |
| Reading | Đọc nhanh | Đoạn văn mờ dần sau vài giây, trả lời từ trí nhớ | Sắp có |
| Reading | Bắn vịt có khung đoạn văn | Xem [mục 4](#4-bắn-vịt-với-bài-đọc-và-writing) | Sắp có |
| Listening | **Nghe và phản hồi nhanh** (Part 2) | Nghe tối đa 2 lần, chọn câu đáp lại trong 8 giây | ✅ Đã lập trình |
| Listening | Phi công nghe lệnh | Nghe lệnh tháp điều khiển, lái đến đúng cổng hoặc giờ | Sắp có |
| Listening | Bingo nghe | Bảng 3×3 từ khóa, bấm từ nào nghe thấy | Sắp có |
| Listening | Nghe điền từ, Nghe hai lần | Điền từ thiếu; lượt 1 chỉ nghe, lượt 2 hiện câu hỏi | Sắp có |
| Writing | **Sửa lỗi trong email** | Bấm đoạn sai, chọn cách sửa; bấm nhầm đoạn đúng mất 1 mạng | ✅ Đã lập trình |
| Writing | **Xếp từ thành câu** | Bấm các cụm từ để ghép câu đúng | ✅ Đã lập trình |
| Writing | **Săn chữ cái** | Chữ cái của đáp án bị xáo, bấm ghép lại thành từ | ✅ Đã lập trình (29/10) |
| Writing | Viết lại câu, Email xây dần | Viết lại với từ cho trước; xếp các khối email đúng thứ tự | Sắp có |
| Writing | **Bắn lỗi của chính bạn** | AI chấm bài bạn viết, các lỗi thành câu A–D để chơi | Sắp có |
| Writing | Viết nhanh 5 phút | Viết đoạn có dùng 3 từ bắt buộc | Sắp có |
| Khác | **Đúng hay Sai — Mệnh đề** | Từng mệnh đề hiện dạng danh sách; chạm ✅ hoặc ❌ cho mỗi dòng rồi bấm **Nộp bài** — chỉ tính đúng khi chọn đúng **tất cả** | ✅ Đã lập trình (29/10) |
| Khác | **Điền từ** | Câu có chỗ trống, người chơi **gõ** đáp án (chấp nhận mọi phương án đúng trong `payload.answers`, bỏ hoa thường và dấu cách thừa) | ✅ Đã lập trình (29/10) |
| Khác | **Tính ra số** | Nhập kết quả số (chấp nhận `0,85` hoặc `0.85`), đúng nếu lệch không quá `payload.tolerance` | ✅ Đã lập trình (29/10) |
| Khác | **Chọn đủ đáp án đúng** | Bấm hết các đáp án đúng rồi nộp — thiếu một cái là sai, bấm dư cũng sai | ✅ Đã lập trình (29/10) |
| Khác | **Nối cặp theo đề** | Hai cột đúng như bảng trong Word; nối từng cặp, **mỗi cặp +5 EXP**, sai −1 mạng nhưng bàn không reset | ✅ Đã lập trình (29/10) |
| Khác | **Sắp xếp theo thứ tự** | Bấm các bước theo đúng thứ tự quy trình, bấm lại bước đã xếp để gỡ, tự chấm khi hết ô | ✅ Đã lập trình (29/10) |

## 3. Luật chơi chung
| Mục | Quy tắc |
|---|---|
| Mạng | 3 mạng mỗi ván; sai hoặc hết giờ mất 1 mạng, hết mạng thì kết thúc |
| EXP | Đúng +10; +5 khi tìm đúng câu bằng chứng; +5 mỗi lỗi sửa đúng; +5 mỗi cặp nối đúng (**Nối câu với đáp án** và **Nối cặp theo đề** — bàn 4 cặp cho +20 EXP và không cộng thêm EXP hoàn thành); **+5 nhanh tay** khi thả thẻ Phân loại nhanh lúc đồng hồ còn hơn nửa; **+5** khi chạm đúng từ sai ở Tìm lỗi sai (đủ 10 nếu sửa ngay lần đầu) |
| Hết giờ | **Nghe và phản hồi nhanh**: 8 giây sau khi audio phát xong. **Đúng hay sai — Blitz**: 8 giây ngay khi hiện câu. Sáu trò "Khác" **không đếm giờ** — người chơi gõ/nối/bấm tới khi nộp |
| Kết quả | Số câu đúng, EXP, nút Chơi lại hoặc về danh sách |
| Phản hồi | Sau mỗi câu: đúng hay sai, kèm đáp án hoặc bằng chứng; câu có giải thích AI thì hiện **khối 💡 gập** — **tự mở khi trả lời sai** (câu `approved`/`draft`), đúng thì chỉ hiện tiêu đề *"Xem giải thích"*, câu `disputed` chỉ mở khi bấm, đổi được bằng *"Khi trả lời sai: Tự mở giải thích / Chỉ hiện nút"* trong **⚙️ Cài đặt trải nghiệm**. Bên dưới là khối **🤖 Gia sư AI**: câu đã có bản dịch trong `questions.coach` thì gập sẵn dưới tiêu đề *"đã có sẵn, miễn phí"* (không gọi lại AI), câu chưa có thì hiện nút **🤖 Hỏi gia sư AI · còn N lượt hôm nay** — **chỉ gọi khi bấm**, không tự gọi. Cùng một khung cho mọi trò |

### Chi tiết từng trò
| Trò | Điểm cần lưu ý |
|---|---|
| Nghe và phản hồi nhanh | Giờ đếm chỉ chạy **sau khi** audio phát xong. Thứ tự đáp án được xáo mỗi lần. Nếu trình duyệt không có giọng đọc, hiện lời thoại để vẫn chơi được |
| Săn bằng chứng | Chọn sai câu bằng chứng không mất mạng, chỉ mất thưởng; câu đúng được tô xanh để người chơi học cách tìm |
| Sửa lỗi trong email | Mọi đoạn đều bấm được; đoạn sửa xong chuyển xanh; chọn cách sửa sai mất 1 mạng |
| Xếp từ thành câu | Bấm lại cụm trong câu để bỏ ra; tự chấm khi đã xếp hết cụm |
| Kéo đáp án vào chỗ trống | Kéo thả HTML5 **và** cách bấm thẻ rồi bấm ô (điện thoại). Điều kiện: đề có `___`, đáp án ≤ 28 ký tự, mọi đáp án ≤ 44 ký tự |
| Đúng hay sai — Blitz | Câu được điền sẵn đáp án đúng (50%) hoặc một đáp án sai khác; chỉ vào trò khi còn đáp án sai để chọn. Sai hoặc hết giờ −1 mạng |
| Nối câu với đáp án | Gom 4 câu/lượt; câu ≤ 130 ký tự và **khử trùng đáp án** (không có đáp án duy nhất thì loại). Nối sai −1 mạng nhưng bàn không reset |
| Săn chữ cái | Chỉ nhận đáp án là **một từ** 4–12 ký tự chữ cái; ghép/undo bằng bấm, tự chấm khi dùng hết chữ, không phân biệt hoa thường |
| Đúng hay Sai — Mệnh đề | Điều kiện: `qtype = tf`, `payload.statements` và `payload.answer` **dài bằng nhau** (≥ 1 dòng). Chưa chọn đủ mọi dòng thì bấm Nộp bài chỉ báo “chưa xong”, **không mất mạng**. Đúng hết mới +10; mỗi dòng hiện nhãn Đúng/Sai màu xanh/đỏ. Nếu AI lưu đúng câu mệnh đề thành đề bài thì đề bài bị ẩn để không hiện hai lần |
| Điền từ | Điều kiện: `qtype = fill`, `payload.answers` có ít nhất một phương án. So sánh đã bỏ hoa thường và co dấu cách; gợi ý số chữ cái **chỉ hiện khi đáp án là một từ**. Gõ Enter = nộp |
| Tính ra số | Điều kiện: `qtype = numeric`, `payload.answer` đọc được thành số. `payload.tolerance` thiếu thì coi là **0,01**; chấp nhận cả dấu phẩy thập phân (`0,85`). So sánh có dung sai `1e-9` để tránh lỗi dấu phẩy động |
| Chọn đủ đáp án đúng | Điều kiện: `qtype = multi`, ≥ 2 lựa chọn và mọi chỉ số đáp án hợp lệ (lấy `payload.options`, không có thì dùng `o`). Bấm để chọn/bỏ; **phải đủ và đúng hết** mới tính là đúng |
| Nối cặp theo đề | Điều kiện: `qtype = match`, `payload.left`/`right`/`answer` khớp nhau (≥ 2 ô, cột phải ≥ cột trái). Cột phải **xáo thứ tự**; mỗi cặp đúng +5 EXP và tô xanh cả hai ô; cặp sai −1 mạng nhưng bàn giữ nguyên |
| Sắp xếp theo thứ tự | Điều kiện: `qtype = order`, `payload.steps` ≥ 3 bước. Bấm bước ở hàng dưới để xếp lên, bấm lại bước đã xếp để gỡ; **tự chấm khi dùng hết bước**, thứ tự phải đúng toàn bộ |
| Tìm lỗi sai | Lỗi **không bịa**: lấy đáp án sai có sẵn trong đề nhét vào `___`. Cần đúng một `___`, đáp án ≤ 28 ký tự, mọi đáp án ≤ 44, câu 4–28 từ, đủ 4 phương án sửa và **đúng một** phương án `ok` (chính đáp án của đề luôn nằm trong 4 phương án). Chạm nhầm từ: ❌ + −1 mạng nhưng **ở lại Bước 1**. Hai bước nên EXP cộng làm hai lần +5. Phản hồi dùng `explainer.analyze` — cùng bộ luật với khối 💡 |
| Phân loại nhanh (ba trò) | Mỗi thẻ phải có **căn cứ cứng** (`explainer.facts()`): `slotNeed` cho từ loại, họ động từ (nhận cả 3/4 đáp án cùng họ) + dấu hiệu thì **trong khung 6 từ trước / 7 từ sau** hoặc dấu hiệu **xa chỗ trống thì được chèn vào thẻ** (`… By the time …`), bảng **18 quy tắc** `in/on/at` cho giới từ. Không chắc thì **bỏ thẻ** và đếm lý do. Thả sai −1 mạng nhưng thẻ còn lại; **thả ra ngoài ô không trừ gì**. Vào chơi bằng kéo Pointer Events, chạm thẻ→chạm ô, hoặc phím **1–4**. Thẻ **không có `key`** → **không ghi `attempts`**, EXP chỉ tính trong ván. Trần **12 thẻ/ván**, bộ dưới **6 thẻ** thì trò không hiện |

## 4. Bắn vịt với bài đọc và writing
**Bài đọc.** Cả bộ câu (một đoạn văn và 2–5 câu hỏi) chơi liền nhau, đoạn văn chỉ hiện một lần.
* Có giai đoạn **ĐỌC** trước khi vịt bay, không tính giờ, kết thúc bằng nút "Sẵn sàng". Có nút 📄 mở lại đoạn văn (game tạm dừng).
* Vịt bay chậm hơn câu thường (khoảng 18–20 giây hết sân).
* Bố cục ngang: đoạn văn bên trái (~38%), sân vịt bên phải. Bố cục dọc: đoạn văn trong ngăn kéo.

| Dạng | Bắn vịt? |
|---|---|
| Part 6 (điền chỗ trống) | Hợp nhất, đáp án ngắn |
| Part 7, đáp án ≤ 60 ký tự | Được (biển vịt xuống 2 dòng) |
| Part 7 đáp án dài, đoạn trên khoảng 250 từ, nhiều đoạn, có bảng biểu | Không, cả bộ chuyển sang Trắc nghiệm chuẩn |

**Writing.** Không có đáp án để bắn, nên: `writing_short` dùng Xếp từ thành câu hoặc Sửa lỗi; `writing_email` và `writing_essay` dùng "Săn từ" trước khi viết (bắn từ nối vào ngân hàng từ) và "Bắn lỗi của chính bạn" sau khi chấm. Bài viết gõ tự do **không** chơi bằng bắn vịt.

## 5. Giao diện
### 5.1 Màn hình
| Màn hình | Nội dung |
|---|---|
| Danh sách trò chơi | **Bốn nhóm** Reading, Listening, Writing, **Các dạng câu khác** (mỗi nhóm một màu), mỗi trò một dòng; trò chưa có ghi "Sắp có" và bị khóa. Nhóm chỉ hiện nếu bộ đề đang mở có câu phù hợp |
| Trong ván | Thanh trên: mạng, tên trò và số câu, EXP; thẻ chơi có viền màu theo kỹ năng; khung phản hồi và nút "Câu tiếp theo" |
| Kết quả | Điểm lớn `đúng/tổng`, EXP ván này, Chơi lại, Về danh sách |

### 5.2 Bố cục tham khảo
```
Reading (Săn bằng chứng)            Listening (Nghe và phản hồi nhanh)
┌───────────────────────────┐       ┌───────────────────────────┐
│ ♥♥♡   Săn bằng chứng 1/2  │       │ ♥♥♥   Nghe… 2/3   40 EXP │
├───────────────────────────┤       ├───────────────────────────┤
│ Bước 1: chạm câu bằng chứng│      │ [▶ Phát câu hỏi]          │
│ ▢ Dear all, the cafeteria…│       │ ▓▓▓▓▓▓░░ (đếm 8 giây)     │
│ ▣ During this period…  ✓  │       │ ( ) It is on my desk.     │
│ Where will lunch be served?│      │ ( ) Yes, it was very quick│
│ ( ) In the meeting room … │       │ ( ) At nine o’clock…      │
└───────────────────────────┘       └───────────────────────────┘
```
### 5.3 Quy ước thiết kế
* Màu theo kỹ năng: Reading tím, Listening xanh ngọc, Writing cam; đúng xanh lá, sai đỏ.
* Đúng và sai **luôn có chữ đi kèm**, không chỉ dựa vào màu.
* Chế độ sáng/tối theo thiết bị; chữ Be Vietnam Pro; bố cục dùng được trên điện thoại (nút lớn, chạm được).
* Tự bỏ hiệu ứng rung khi hệ điều hành báo `prefers-reduced-motion`.

## 6. Dữ liệu cần thêm
Ví dụ `payload` của từng trò (nằm trong cột `payload` hiện có):
```jsonc
// Nghe và phản hồi nhanh (audio_mcq)
{ "transcript": "Where did you put the quarterly report?", "audio_url": null, "options": ["It is on my desk.", "Yes, it was very quick.", "At nine o’clock tomorrow."], "answer": 0 }
// Săn bằng chứng (passage_mcq)
{ "group_id": "g12", "sentences": ["Dear all, …", "During this period, …"], "evidence": 1, "options": ["In the meeting room", "…"], "answer": 0 }
// Sửa lỗi (writing_fix)
{ "chunks": [{ "t": "Dear Ms. Park," }, { "t": "will held", "fixes": ["will be held", "will hold"], "answer": 0 }] }
// Xếp từ thành câu (writing_order)
{ "words": ["Please submit", "the report", "before", "Friday afternoon."] }
```
| Trường mới | Dùng cho | Nguồn |
|---|---|---|
| `transcript`, `audio_url` | Listening | Lời thoại trong Word; audio xem mục 7 |
| `group_id`, `sentences`, `evidence` | Săn bằng chứng, bắn vịt bài đọc | AI tách đoạn thành câu và đánh dấu câu bằng chứng, **bạn duyệt** |
| `chunks` có lỗi | Sửa lỗi | AI tạo bản có lỗi từ email đúng, **bạn duyệt** |
| `words` | Xếp từ thành câu | Tách câu mẫu thành cụm |

Mọi dữ liệu do AI tạo dùng chung cơ chế `status = review`: **chưa xác nhận thì không vào game**.

### 6.1 Bốn trò không cần thêm dữ liệu (29/10/2026)
**Kéo đáp án vào chỗ trống · Đúng hay sai — Blitz · Nối câu với đáp án · Săn chữ cái** chỉ dùng `{q, o, a}` của câu A–D đã có trong CSDL — không cần `transcript`, `sentences`/`evidence`, `chunks` hay `words`. Vì vậy mục 6 chỉ còn cần cho bốn trò đọc `payload` và các trò "Sắp có". Điều kiện sàng và số câu thật theo từng bộ đề: [README.md § Độ phủ theo bộ đề](README.md#độ-phủ-theo-bộ-đề-truy-vấn-postgresql-ngày-2026-10-29).

### 6.2 Sáu trò dùng payload đã có sẵn (29/10/2026)
Sáu trò “Khác” **không cần trường mới**: chúng đọc đúng những cột mà bước nhập đề AI đã lưu cho các `qtype` không có A–D.

| `qtype` | Trường `payload` đã lưu | Trò dùng | Số câu trong CSDL |
|---|---|---|---|
| `tf` | `statements[]`, `answer[]` (boolean) | Đúng hay Sai — Mệnh đề | 5 |
| `fill` | `answers[]` (nhiều phương án đúng) | Điền từ | 2 |
| `numeric` | `answer` (số), `tolerance` | Tính ra số | 2 |
| `multi` | `options[]`, `answer[]` (chỉ số) | Chọn đủ đáp án đúng | 2 |
| `match` | `left[]`, `right[]`, `answer[]` (chỉ số) | Nối cặp theo đề | 2 |
| `order` | `steps[]` | Sắp xếp theo thứ tự | 2 |

Tổng **15 câu** (đều `status = 'ok'`) trước đây lưu trong CSDL mà **không màn chơi nào chấm được**; nay cả 15 đều chơi được. Vì các câu này nằm trong hai bộ đề test của AI parser (bộ 7 và 8), phải tắt **🙈 Ẩn bộ/câu ML** mới thấy sáu trò đó trong danh sách trò của bộ đề.

Ngoại lệ còn lại: **4 câu viết tự do** (`writing_short` 2, `writing_essay` 2) vẫn chưa có màn chấm — cần ô soạn văn bản và AI chấm bài (mục 9).

### 6.3 Bốn trò lấy từ bộ luật có sẵn (31/10/2026)
**Tìm lỗi sai · Phân loại nhanh: Từ loại · Thì · in/on/at** không đọc `payload` và **không cần sinh dữ liệu mới**: thẻ dựng tại chỗ từ `{q, o, a}` qua `explainer.facts()` — hàm mới *thêm vào* `explainer.js` (hành vi `analyze` cũ không đổi nên 💡 Giải thích và `npm run verify` giữ nguyên). Mã nằm ở **`skill-extra.js`** (UMD `window.SkillExtra`), `build.js` ghép qua hai marker `/*__SKILLEXTRA__*/` và `/*__SKILLEXTRA_CSS__*/`; `template.html` chỉ nối `SKILL_META`/`SKILL_PLAY` nên không phình.

Độ phủ đo ngày 31/10/2026 bằng `node scripts\audit-skill-items.js` (0 token, **mâu thuẫn: 0**): **Tìm lỗi sai 844/965 câu** có mặt ở **9/11 bộ đề** (bộ id 1 trong ảnh: 50/50; `ĐC 10`: 149); **Từ loại 65 thẻ** cho 5 bộ (bể đã khử trùng 227); **Thì 18 thẻ** cho 2 bộ (bể 106); **in/on/at 12 thẻ** cho 1 bộ (bể 33). **Đo lại 04/11/2026 trên ngân hàng 975 câu / 12 bộ đề** (thêm bộ `dan-noi-dung.txt` id 54): **Tìm lỗi sai 854/975** có mặt ở **12/12 bộ**, **Từ loại 65 thẻ** cho 6 bộ (bể 227), **Thì 18 thẻ** cho 2 bộ (bể 109), **in/on/at 12 thẻ** cho 1 bộ (bể 33). Bảng theo từng bộ và toàn bộ lý do bỏ thẻ: [README.md § Độ phủ bốn trò mới](README.md#độ-phủ-bốn-trò-mới-đo-lại-04-11-2026-bằng-node-scriptsaudit-skill-itemsjs-0-token). Hai trò **Thì** và **in/on/at** đã được dày thêm bằng cách mở rộng luật (không thêm dữ liệu) ngày 31/10/2026 — xem § 11.

## 7. Âm thanh Listening
| Cách | Ưu điểm | Hạn chế |
|---|---|---|
| Giọng đọc của trình duyệt (`speechSynthesis`) | Miễn phí, mẫu đang dùng | Giọng khác nhau tùy máy, chỉ một giọng Anh–Mỹ |
| Tạo sẵn file âm thanh một lần bằng dịch vụ đọc văn bản, lưu vào `audio_url` | Ổn định, có nhiều giọng | Tốn chi phí và công một lần |
| Tải file mp3 có sẵn lên cùng bộ đề | Giống đề thật nhất | Phải có sẵn file |

Giọng máy **chỉ đủ luyện phản xạ**, chưa thay được đề nghe thật với nhiều giọng và tốc độ; nên ghi rõ trong ứng dụng.

## 8. Chọn trò khi nhập file Word
| `skill` / dạng câu | Trò gợi ý |
|---|---|
| Reading/Writing bất kỳ, `mcq` có `___` và đáp án ngắn | **Kéo đáp án vào chỗ trống, Đúng hay sai — Blitz, Nối câu với đáp án** (không cần thêm dữ liệu) |
| `mcq` có đáp án là một từ | **Săn chữ cái** |
| `mcq` có `___` và còn đáp án sai ngắn để nhét vào | **Tìm lỗi sai** (không cần thêm dữ liệu) |
| `mcq` có `___` mà luật xác định được lớp từ của chỗ trống | **Phân loại nhanh: Từ loại** |
| `mcq` bốn đáp án cùng họ động từ + đề có dấu hiệu thời gian | **Phân loại nhanh: Thì** |
| `mcq` đáp án là `in`/`on`/`at` trước cụm thời gian | **Phân loại nhanh: in / on / at** |
| Reading, `passage_mcq`, đáp án ngắn | Săn bằng chứng, Đọc nhanh, bắn vịt (có khung đoạn văn) |
| Reading, đáp án dài | Săn bằng chứng, Trắc nghiệm chuẩn |
| Reading, `order` (đoạn văn bị xáo) | Xếp lại đoạn văn *(chưa làm — khác với “Sắp xếp theo thứ tự” bên dưới, vốn xếp các **bước** trong một quy trình)* |
| Dạng không có A–D: `tf` | **Đúng hay Sai — Mệnh đề** |
| Dạng không có A–D: `multi` | **Chọn đủ đáp án đúng** |
| Dạng không có A–D: `fill` | **Điền từ** |
| Dạng không có A–D: `numeric` | **Tính ra số** |
| Dạng không có A–D: `match` | **Nối cặp theo đề** |
| Dạng không có A–D: `order` | **Sắp xếp theo thứ tự** |
| Listening, `audio_mcq` đáp án ngắn | Nghe và phản hồi nhanh, bắn vịt |
| Listening có số, giờ, địa điểm | Phi công nghe lệnh |
| Writing ngắn | Xếp từ thành câu, Sửa lỗi |
| Writing dài | Bắn lỗi của chính bạn, Viết nhanh 5 phút |
| Không đủ điều kiện | **Trắc nghiệm chuẩn** (luôn là phương án dự phòng) |

## 9. Chấm Writing bằng AI
Điểm AI chỉ là **tham khảo**, không phải điểm TOEIC thật. EXP cho Writing tính cố định mỗi bài (có trần mỗi ngày) và cộng thêm nhỏ theo điểm, để tránh viết bừa hoặc nhờ AI viết hộ.

## 10. Kiểm thử
| # | Kiểm thử | Mong đợi |
|---|---|---|
| 1 | Nghe: bấm Phát trên trình duyệt có giọng đọc | Phát xong mới hiện đáp án và bắt đầu đếm giờ |
| 2 | Nghe: trình duyệt không có giọng đọc | Hiện lời thoại, vẫn chơi được |
| 3 | Nghe: bấm Phát lần thứ 3 | Bị khóa sau 2 lượt |
| 4 | Nghe: để hết 8 giây | Mất 1 mạng, hiện đáp án đúng |
| 5 | Săn bằng chứng: chọn sai câu rồi trả lời đúng | Không +5, không mất mạng, câu đúng tô xanh |
| 6 | Sửa lỗi: bấm đoạn đúng | Mất 1 mạng, đoạn rung |
| 7 | Sửa lỗi: sửa hết lỗi | Hoàn thành câu, +EXP |
| 8 | Xếp từ: bấm cụm trong câu | Cụm quay về khu chọn |
| 9 | Hết 3 mạng giữa ván | Chuyển sang màn kết quả |
| 10 | Điện thoại hẹp 360 px | Không tràn ngang, nút bấm được |
| 11 | Chế độ tối | Mọi chữ đọc được |
| 12 | Bộ đọc hiểu đáp án dài | Vẫn vào Săn bằng chứng, không vào bắn vịt |
| 13 → 20 | Bốn trò mới (kéo thả, Blitz, Săn chữ cái, Nối cặp) | Kết quả kiểm thử thật trên trình duyệt ghi ở [README.md § Kiểm thử](README.md#kiểm-thử) — mục 13 đến 20 |
| 21 → 30 | Sáu trò "Khác" (Đúng/Sai mệnh đề, Điền từ, Tính ra số, Chọn đủ đáp án, Nối cặp theo đề, Sắp xếp) | Kết quả kiểm thử thật trên trình duyệt ghi ở [README.md § Kiểm thử](README.md#kiểm-thử) — mục 21 đến 30. Điểm cốt lõi: nộp thiếu thì nhắc chứ không mất mạng; `0,85` vẫn đúng với đáp án `0.84` dung sai `0.01`; `Enter` trong ô gõ không kích hoạt phím tắt của game; nối đủ cặp +5 EXP/cặp mà chỉ ghi **một** lượt `attempts`; xếp hết bước thì tự chấm |
| 31 → 33 | **Tính năng ngoài trò chơi** cùng đợt 29/10: nút Ôn theo lịch — Leitner, Bảng xếp hạng tài khoản, Nhập tiến độ JSON | Cùng trang kiểm thử, mục 31 đến 33 trong README.md |
| 34 → 40 | **🌐 Gia sư AI** (dịch câu + vì sao loại đáp án sai) chạy trong cả Trắc nghiệm A–D lẫn trò kỹ năng | Mục 34 đến 40 trong README.md. Điểm cốt lõi: một câu chỉ gọi Gemini **một lần** (`cached:true, tokens:0` ở lần sau, chơi lại **không POST**), 3 request song song gộp thành **1** lượt gọi, hết ngân sách `AI_COACH_DAILY` → `429` nhưng câu đã dịch vẫn hiện, câu không có A–D → `400` |
| 41 → 59 | **💡 Nút giải thích theo yêu cầu** + **🇻🇳 bản dịch câu hỏi & đáp án trong khối 💡** — khối gập, Gia sư AI chỉ gọi khi bấm, bản dịch **tự hiện miễn phí** (0 lượt AI), chạy trong cả Trắc nghiệm A–D lẫn 14 trò kỹ năng | Mục 41 đến 59 trong README.md. Điểm cốt lõi: chơi 5 câu liên tiếp → **0** request coach; sai câu `draft` → 💡 tự mở, đúng → thu gọn; `disputed` không tự mở; câu chưa có giải thích vẫn có nút; bấm nút mới tốn lượt và nhãn đổi thành *"còn 59 lượt hôm nay"*; câu đã cache → *"đã có sẵn, miễn phí"* không gọi; `Enter`/`Space` mở khối mà không nhảy câu; trạng thái mở giữ nguyên khi vẽ lại; **52** câu có `coach` hiện bản dịch với **0** request `/api/ai/translate`, **53** câu chưa có → bấm nút đúng **1** request miễn phí, **54** khi phải dùng AI mà hết lượt → dòng đỏ giữ nút, **55** trò Blitz cũng có khối dịch; **56** sai → khối tự dịch **không bấm gì** (`{free:true}`, 0 lượt), **57** đúng → 0 request tới khi mở khối, **58** tắt `TRANSLATE_FREE` → nút *"Dịch bằng AI"* chứ không tự tiêu lượt, **59** tải lại trang vẫn hiện nhờ `localStorage` |

| 62 → 70 | **Bốn trò mới** (Tìm lỗi sai · Phân loại nhanh Từ loại/Thì/in-on-at) | Kết quả kiểm thử thật ghi ở [README.md § Kiểm thử](README.md#kiểm-thử) — mục 62 đến 70, cộng `node scripts\test-skill-items.js` (**29 đạt, 0 lỗi**, gồm 5 ca mở rộng luật ngày 31/10) và `node scripts\audit-skill-items.js` (**mâu thuẫn: 0** — Thì 18 thẻ, in/on/at 12 thẻ). Điểm cốt lõi: chạm nhầm từ sai thì **ở lại Bước 1** chứ không nhảy câu; thẻ phân loại **không sinh `POST /api/answer`** nào; phím **1–4** và chạm-thẻ-rồi-chạm-ô hoạt động như kéo thả; sai vẫn hiện đủ chữ `Ô đúng: …` chứ không chỉ đổi màu |

## 11. Lộ trình
- [x] Giao diện mẫu 4 trò (Nghe phản hồi nhanh, Săn bằng chứng, Sửa lỗi, Xếp từ thành câu).
- [x] Lập trình 4 trò **trong app thật** (29/10/2026): Kéo đáp án vào chỗ trống (= Part 6 kéo thả), Đúng hay sai — Blitz, Nối câu với đáp án, Săn chữ cái — chỉ dùng câu A–D có sẵn, không cần dữ liệu mới.
- [ ] Nối dữ liệu thật: `transcript`, `sentences`/`evidence`, `chunks`, `words` từ bộ nhập AI (tạm dừng theo yêu cầu 29/10: giữ nguyên dữ liệu).
- [x] Lập trình 6 trò **cho câu không có A–D** (29/10/2026): Đúng hay Sai — Mệnh đề, Điền từ, Tính ra số, Chọn đủ đáp án đúng, Nối cặp theo đề, Sắp xếp theo thứ tự — dựng từ `payload` đã lưu sẵn của `tf`/`fill`/`numeric`/`multi`/`match`/`order` (15 câu), **không cần dữ liệu mới**, không cần A–D. Chi tiết điều kiện sàng và số câu: [mục 6.2](#62-sáu-trò-dùng-payload-đã-có-sẵn-29102026).
- [x] Bảng định tuyến chọn trò theo `skill` và `qtype` (mục 8) — điều kiện sàng nằm trong `skFillable` / `skItemsLetters` / `skItemsPairs`, trò nào không đủ câu thì không hiện dòng đó.
- [x] Lập trình 4 trò **từ bộ luật `explainer.js`** (31/10/2026): **Tìm lỗi sai**, **Phân loại nhanh: Từ loại · Thì · in/on/at** — ở file riêng `skill-extra.js`, **0 AI / 0 sửa CSDL / 0 endpoint**, thẻ không chắc thì bỏ và đếm lý do, thẻ phân loại không ghi `attempts`. Chi tiết: [mục 6.3](#63-bốn-trò-lấy-từ-bộ-luật-có-sẵn-31102026).
- [x] Dày thêm hai trò Phân loại nhanh còn mỏng **bằng cách mở rộng luật, không thêm dữ liệu** (31/10/2026): thêm nhãn `past-perfect`/`perfect-future` (Quá khứ hoàn thành / Tương lai hoàn thành), cho phép họ động từ **3/4 đáp án**, chèn dấu hiệu nằm xa chỗ trống vào thẻ; thêm bảng `on their first day` / `on weekends` / `at the intersection` / `in accordance with` / `in the cabinet` / `on the desk`, thành phố và **5 cụm cố định** (`rely on`, `good at`, `expert in`, `look at`, `result in`) — bảng giới từ từ 13 lên **18 quy tắc**. Kết quả đo: **Thì 12 → 18 thẻ** (bể 98 → 106, từ 1 lên 2 bộ), **in/on/at 6 → 12 thẻ** (bể 12 → 33). Phần còn mỏng là do dữ liệu (726 câu đáp án không cùng họ, 912 câu đáp án không phải `in`/`on`/`at`), không phải do luật.
- [ ] Cho phép bật/tắt ghi `attempts` cho thẻ phân loại (hoặc lưu id câu gốc) nếu muốn EXP/thẻ ảnh hưởng tới Ôn theo lịch.
- [ ] Khung đoạn văn và giai đoạn ĐỌC cho bắn vịt; tách `group_id`.
- [ ] Audio tạo sẵn cho Listening.
- [ ] Các trò "Sắp có" còn lại: Xếp lại đoạn văn, Đọc nhanh, Phi công nghe lệnh, Bingo nghe, Bắn lỗi của chính bạn.
- [ ] Chấm Writing và "Bắn lỗi của chính bạn".

## 12. Rủi ro
| Rủi ro | Cách giảm |
|---|---|
| Dữ liệu AI tạo (bằng chứng, lỗi cố ý) sai | Cờ `review`, bạn duyệt trước khi vào game |
| Giọng đọc máy không như đề thật | Ghi rõ giới hạn, dùng audio tạo sẵn về sau |
| Trò quá phức tạp trên điện thoại | Nút lớn, bố cục dọc, chuyển về Trắc nghiệm chuẩn khi không phù hợp |
| Người chơi lạm dụng EXP Writing | Trần EXP mỗi ngày, mức cố định mỗi bài |
