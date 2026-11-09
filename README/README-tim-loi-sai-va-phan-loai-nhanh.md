# 🛠 Yêu cầu cho Qoder: thêm 2 trò chơi kỹ năng **Tìm lỗi sai** và **Phân loại nhanh**

> Tài liệu này vừa **phân tích** vừa là **đặc tả để lập trình**. Qoder đọc từ mục 0 đến hết trước khi sửa code.
> Mọi số dòng trích từ `template_235258.html` (bản người dùng gửi ngày 30/10/2026) **có thể đã lệch**; hãy tìm theo **tên hàm**, không tin số dòng.
> Phần viết "**Giả định cần xác minh**" là điều tác giả tài liệu **chưa đọc được trong code**; Qoder phải tự kiểm tra rồi báo lại.

## 0. Cách làm việc (Qoder đọc trước)
1. Đọc: `template.html` (khối "trò chơi theo kỹ năng": `SKILL_META`, `SKILL_GROUPS`, `buildSkillItems`, `SKILL_PLAY`, `startSkill`, `skillFinishItem`, `skillWrongPick`, `skFillable`, `skExplainOf`, `skillPool`), `explainer.js`, `parser.js`, `build.js`, `package.json`, `scripts/` (các file test và `audit-free-explainer.js`).
2. **Không** đọc, in hay sao chép `.env` (có khóa AI).
3. Làm theo thứ tự ở [mục 6](#6-các-bước-thực-hiện). Sau mỗi bước chạy `npm test`.
4. Cuối cùng chạy `npm run verify` và `node build.js`; **không sửa tay** `toeic-game.html`, `public/toeic-game.html`, `seed.json` (đều do script sinh ra).
5. Khi xong, báo cáo theo mẫu ở [mục 8](#8-báo-cáo-khi-xong).

## 1. Bối cảnh dự án (đã xác minh từ README và mã người dùng gửi)
| Hạng mục | Thông tin |
|---|---|
| Nền | Node.js + Express + PostgreSQL; game là **một file HTML** dựng từ `template.html` + `parser.js` + `duck.js` + dữ liệu bằng `node build.js`; bản không có server dùng `seed.json` và `localStorage` |
| Trò kỹ năng | Nằm **trong từng bộ đề**, hiện 14 trò; mỗi trò gồm: mục trong `SKILL_META`, hàm dựng `skItems…`, nhánh trong `buildSkillItems(id)`, hàm chơi `skillPlay…`, mục trong `SKILL_PLAY` |
| Id đã dùng (**cấm trùng**) | `listen, evidence, fix, order, drop, blitz, letters, pairs, tf, fill, calc, multi, pairdb, sort` |
| Luật chung | 3 mạng, +10 EXP mỗi câu đúng, trò chỉ hiện khi `buildSkillItems(id).length > 0` |
| Nguồn câu hỏi | `skillPool()` trả câu của **bộ đề đang mở** (`state.all` hoặc `state.bank`, lọc theo `deckKey`) |
| Câu A–D | Trường `q` (đề), `o` (mảng đáp án), `a` (chỉ số đáp án đúng), `t` (chủ điểm), `n` (ghi chú), `status` (`ok`/`review`), `id` |
| Đủ điều kiện chơi | `hasChoices(q)` và `q.status !== "review"`; trò dựng từ A–D dùng `skFillable(q)` (có chỗ trống `_{2,}`, đáp án ≤ 28 ký tự, mọi đáp án ≤ 44 ký tự) |
| Ghi nhận kết quả | `skillFinishItem(ok, htmlPhanHoi, exp, item, heartAlreadyLost)`; gọi `skillRecord` → `POST /api/answer {questionId: item.key, mode:"skill"}` **chỉ khi `item.key` có giá trị**; câu sai vào bảng câu sai, đúng thì được tính là đã làm đúng |
| Phạt sai giữa chừng | `skillWrongPick(node, htmlThongBao, item)` trừ 1 mạng, rung nút, hết mạng thì tự kết thúc ván |
| Điểm thưởng nửa chừng | Cách `skillPlayEvidence` làm: `s.exp += 5; skillHud();` |
| Giải thích | `skExplainOf(q)` gắn `ucid, uco, ua, coach, translation, explanation` vào item; `explainHtml(it, "right"|"wrong")` dựng khối 💡 |
| Phân tích miễn phí | `explainer.js`, `window.ToeicExplainer`, chạy trong trình duyệt, **0 token**, 89,8% câu (876/975 — đo lại 04/11) có phân tích: họ từ loại · vị trí chỗ trống · thì · giới từ · đại từ · nghĩa từ. Nguyên tắc bắt buộc của bộ luật: **thà im lặng còn hơn dạy sai**; chỉ khẳng định khi đáp án đã lưu khớp lớp từ/dạng mà luật suy ra |
| Kiểm thử | `npm test` (20 bài bộ phân tích + 26 bài `ai-parser` + 42 bài bộ luật), `node scripts/audit-free-explainer.js`, `npm run verify` (gộp cả hai); **không cần mạng, không cần CSDL** |

### Giả định cần xác minh (Qoder tự kiểm tra rồi báo lại)
1. `explainer.js` có **API có cấu trúc** (loại từ cần ở chỗ trống, nhãn lớp từ của từng lựa chọn, thì của từng lựa chọn, dấu hiệu thời gian) hay chỉ trả **HTML/dòng chữ**? Nếu chỉ trả chữ thì làm theo [mục 6, bước 2](#6-các-bước-thực-hiện).
2. `explainer.js` dùng được trong Node (có `module.exports`) hay chỉ gắn vào `window`?
3. `build.js` đang nhúng `parser.js` và `duck.js` vào `template.html` bằng cơ chế nào (thay chuỗi đánh dấu?). Làm y hệt cho file mới.
4. Tên các biến CSS và lớp có sẵn (`.skstem`, `.skchunk`, `.sktimer`, `.skjudge`, `.skshake`, `.skfilled`, `--sk-read`, `--sk-write`, `--sk-other`) để tái dùng.
5. Ở bản không có server (offline), `state.all` có chứa đủ trường `explanation`, `n`, `t` không.

## 2. Ràng buộc cứng
* **0 lời gọi AI, 0 thay đổi cơ sở dữ liệu, 0 endpoint mới.** Toàn bộ chạy ở trình duyệt, kể cả bản `toeic-game.html` mở không cần server.
* **Không đổi hành vi** của 14 trò hiện có và của `explainer.js` (trừ khi thêm hàm mới như mục 6, bước 2); `npm test` phải còn xanh.
* **Không bịa:** thẻ hoặc câu nào mà luật không chắc chắn thì **bỏ qua**, không đoán. Ghi lý do bỏ qua vào bộ đếm (dùng ở bước audit).
* Chạy tốt trên điện thoại 360 px, chế độ sáng/tối, bàn phím; tôn trọng `prefers-reduced-motion`.
* Đúng/sai luôn có **chữ hoặc biểu tượng** đi kèm, không chỉ dựa vào màu.
* Văn bản giao diện bằng **tiếng Việt**, tên hàm/biến bằng tiếng Anh, theo kiểu `sk…` / `skill…` đang dùng.
* Dùng cú pháp JS giống phần còn lại của `template.html` (`var`, hàm thường, **không** import/ESM trong khối chạy ở trình duyệt).

## 3. Phân tích hai trò chơi
| | **Tìm lỗi sai** | **Phân loại nhanh** |
|---|---|---|
| Kỹ năng luyện | Nhận ra từ/cấu trúc sai trong câu (đọc kỹ, ngữ pháp) rồi sửa | Nhận loại từ, thì, giới từ **ngay lập tức** (phản xạ ngữ pháp) |
| Khác trắc nghiệm ở đâu | Người chơi phải **tự tìm** chỗ sai (không có danh sách để chọn), rồi mới chọn cách sửa | Một thẻ, một quyết định rất nhanh, nhiều thẻ liên tiếp |
| Dữ liệu nguồn | Câu A–D có chỗ trống: đưa **đáp án nhiễu** vào chỗ trống để tạo câu sai | Kết quả của bộ luật `explainer.js` (loại từ, thì, giới từ) trên câu A–D |
| Tốn token | 0 | 0 |
| Độ phủ ước tính | Cao: gần mọi câu có `_______` và đáp án ngắn (cùng điều kiện với Kéo thả/Blitz) | **Thấp hơn và phụ thuộc luật**: chỉ câu mà `explainer.js` **chắc chắn** (xem mục 5) |
| Rủi ro chính | Câu sinh ra **đúng ngữ pháp dù dùng đáp án nhiễu** (câu từ vựng nhiều đáp án gần nghĩa) → người chơi bị phạt oan | Luật sai → **dạy sai**; thẻ mơ hồ (một từ vừa là danh từ vừa là động từ) |
| Cách giảm rủi ro | Ưu tiên câu ngữ pháp có phân tích; dùng nhãn "chỉ có **1 chỗ sai**"; sau khi sai cho xem lý do | Chỉ sinh thẻ khi **luật khớp đáp án đã lưu**; loại từ mơ hồ; có audit tự dò mâu thuẫn |
| Phù hợp điện thoại | Chạm từng từ: cần vùng chạm ≥ 44 px, dùng thẻ từ có đệm | Rất hợp: nút lớn, kéo thẻ hoặc chạm |
| Nhóm trong menu | `writing` (nhận lỗi) | `reading` (như Blitz/Kéo thả) |

## 4. Trò A: Tìm lỗi sai (`spot`)
### 4.1 Cách chơi
1. Hiện một câu đã bị **đặt sai một chỗ** (chỗ trống được lấp bằng một đáp án nhiễu). Dòng hướng dẫn: *"Câu này có đúng **1 chỗ sai**. Chạm vào từ sai."*
2. **Bước 1, tìm lỗi:** người chơi chạm một từ. Đúng (nằm trong đoạn bị thay) → +5 EXP nếu là lần chạm đầu, đoạn sai được tô nổi bật, chuyển sang bước 2. Sai → `skillWrongPick` (−1 mạng), từ đó bị vô hiệu, được chạm tiếp.
3. **Bước 2, sửa lỗi:** hiện các đáp án gốc A–D (xáo thứ tự). Chọn đúng đáp án gốc → hoàn thành. Chọn sai → `skillWrongPick`, đáp án đó bị vô hiệu.
4. Hoàn thành câu: câu hiện lại **bản đúng**, tô xanh phần đã sửa, kèm giải thích.

### 4.2 Sinh câu (hàm thuần, không đụng DOM)
```
buildSpotItems(questions, deps) -> item[]
  với mỗi q trong questions:
    f = fillable(q)                      // như skFillable, nhưng xem bước dưới
    bỏ qua nếu: status === "review" | không có đúng 1 chỗ trống _{2,} | f null
    bỏ qua nếu: số từ của câu đầy đủ > 28
    answer = o[a]
    candidates = các đáp án khác, bỏ nếu (không phân biệt hoa thường) trùng answer hoặc rỗng
    bỏ qua nếu: candidates rỗng
    wrong = chọn từ candidates:
        ưu tiên 1: đáp án CÙNG HỌ TỪ với answer (chung tiền tố ≥ 4 ký tự) → lỗi "đẹp" kiểu họ từ loại
        ưu tiên 2: ngẫu nhiên trong candidates (dùng rng truyền vào, để test lặp lại được)
    sentence = pre + wrong + post, đã chỉnh hoa/thường (4.3)
    tokens = tách theo khoảng trắng, giữ dấu câu dính vào từ
    span = [startToken, endToken)  // các token thuộc đoạn `wrong` (có thể nhiều từ)
    item = { key: q.id, spot: true, tokens, span, wrong, answer, o: xáo(o gốc kèm cờ đúng), t: q.t, n: q.n,
             pre, post, full: pre + answer + post, ...skExplainOf(q) }
```
**Cái giữ phải đúng:** `span` phải ánh xạ chính xác sang token dù `wrong` gồm nhiều từ (`will have completed`) hoặc đứng sát dấu câu (`report, ______ .`).

### 4.3 Hoa/thường và dấu câu
* Chỗ trống ở **đầu câu** (phần `pre` rỗng hoặc kết thúc bằng `.`, `?`, `!`): viết hoa chữ đầu của `wrong`; nếu `answer` gốc viết hoa chữ đầu thì giữ quy tắc tương ứng cho cả hai.
* Chỗ trống giữa câu: dùng nguyên dạng của đáp án (không ép thường).
* Dấu câu dính vào token (`report,`, `(see`): token vẫn chạm được; đoạn sai tô nền **cả token**, không cắt dấu.
* Khoảng trắng thừa: chuẩn hóa một dấu cách.

### 4.4 Dạng item
```js
{ key: "<question id>", spot: true,
  tokens: ["The","manager","reviewing","the","report","yesterday."],
  span: [2,3],                   // nửa mở [start,end) theo chỉ số token
  wrong: "reviewing", answer: "reviewed",
  o: [{t:"review",ok:false},{t:"reviewed",ok:true},…],   // đã xáo
  full: "The manager reviewed the report yesterday.",
  t: "Thì", n: "", /* + skExplainOf(q) */ }
```

### 4.5 Điểm và mạng
| Sự kiện | Kết quả |
|---|---|
| Chạm đúng từ sai ngay lần chạm đầu | +5 EXP (`s.exp += 5; skillHud()`) |
| Chạm sai từ | −1 mạng (`skillWrongPick`), từ bị vô hiệu |
| Chọn đúng cách sửa | Kết thúc câu |
| Chọn sai cách sửa | −1 mạng (`skillWrongPick`), lựa chọn bị vô hiệu |
| Kết thúc câu **không có sai lầm nào** | `skillFinishItem(true, html, 5, item)` → tổng 10 EXP, ghi nhận đúng |
| Kết thúc câu **có ít nhất một sai lầm** | `skillFinishItem(false, html, 0, item, true)` (`heartAlreadyLost = true`, tránh trừ mạng hai lần) → vào danh sách câu sai |
| Hết mạng giữa chừng | `skillWrongPick` tự kết thúc ván; mọi handler sau đó phải kiểm `s.answered` và thoát |

### 4.6 Giao diện
* Thân câu là dãy nút từ (`<button class="skword">`), tự xuống dòng; **vùng chạm tối thiểu 44×36 px** (đệm ngang 8 px, cao dòng đủ lớn); khoảng cách giữa các từ ≥ 4 px.
* Bước 1: từ đã chạm sai có dấu `✗` và nền đỏ nhạt, bị `disabled`. Đoạn sai (sau khi tìm ra) nền đỏ + gạch chân sóng; tiêu đề bước đổi thành *"Bước 2: chọn cách sửa"*.
* Bước 2: các đáp án gốc hiện dưới dạng nút khối (giống `skchunk` trong `skillPlayEvidence`).
* Sau khi xong: dùng `skillFinishItem` để hiện phản hồi, trong đó: `✅ Sửa: <s>wrong</s> → answer`, câu đúng đầy đủ với phần sửa tô xanh, `📝 n` nếu có, rồi `explainHtml(it, ok ? "right" : "wrong")`. Nếu `ToeicExplainer` có dòng riêng cho lựa chọn `wrong` (ví dụ *"A. attractive, tính từ → loại"*), in dòng đó trước.
* Phím tắt: `Tab` đi qua các từ, `Enter`/`Space` chọn; `Enter` sang câu kế (đã có sẵn trong khung).

### 4.7 Trường hợp biên
| Tình huống | Xử lý |
|---|---|
| Câu có hơn một chỗ trống `_{2,}` | Bỏ qua câu |
| Đáp án nhiễu **cũng đúng ngữ pháp** trong câu (từ vựng gần nghĩa) | Chấp nhận nhưng **ưu tiên** câu thuộc chủ điểm ngữ pháp (`t` là Thì/Từ loại/Giới từ/Đại từ) khi sắp thứ tự; nhãn hướng dẫn luôn nói *"chỗ sai"* chứ không nói *"sai ngữ pháp"* |
| `wrong` trùng một từ khác trong câu | Vẫn dùng chỉ số token để chấm, **không** so chuỗi |
| Câu rất ngắn (< 4 từ) hoặc rất dài (> 28 từ) | Bỏ qua |
| Hết mạng ở bước 1 | Hiện phản hồi kèm câu đúng, không đòi sang bước 2 |
| Cùng một câu hỏi lặp lại trong ván | Mỗi câu chỉ xuất hiện một lần mỗi ván |
| Bản offline (không server) | Chạy bình thường, `skillRecord` đã tự bỏ qua khi không có API |

## 5. Trò B: Phân loại nhanh (`classpos`, `classtense`, `classprep`)
Làm **một hàm chơi chung** `skillPlayClassify` và **ba mục đăng ký riêng** để tái dùng khung hiện có (mỗi mục là một thẻ trong menu bộ đề, chỉ hiện khi bộ đề đủ thẻ).

| Id | Tên hiển thị | Mô tả ngắn | Nhóm |
|---|---|---|---|
| `classpos` | Phân loại nhanh: Từ loại | Chỗ trống cần loại từ nào? Từ này là loại gì? | `reading` |
| `classtense` | Phân loại nhanh: Thì | Dấu hiệu thời gian này đi với thì nào? | `reading` |
| `classprep` | Phân loại nhanh: in · on · at | Chọn giới từ đúng cho cụm thời gian/nơi chốn | `reading` |

### 5.1 Cách chơi chung
* Mỗi **thẻ** là một item (như Blitz). Một ván tối đa **12 thẻ**, lấy ngẫu nhiên; nếu bộ đề có **< 6 thẻ** thì trò **không hiện** (`buildSkillItems` trả `[]`).
* Có 2–4 **ô phân loại** (bin) ở phía dưới. Người chơi **chạm ô** hoặc **kéo thẻ vào ô**. Phím `1`–`4` chọn ô theo thứ tự.
* Mỗi thẻ có **đồng hồ** (xem 5.5). Đúng → +10 EXP, +5 nếu trả lời trong nửa đầu thời gian. Sai hoặc hết giờ → `skillFinishItem(false, …)` (−1 mạng).
* **`item.key` để trống** (không gọi `skillRecord`): phân loại thẻ là kỹ năng phụ, **không được** làm câu gốc bị coi là "đã thuộc" hoặc "đã sai".

### 5.2 Nguyên tắc sinh thẻ (quan trọng nhất)
**Chỉ sinh thẻ khi `explainer.js` chắc chắn *và* đáp án đã lưu khớp với điều luật suy ra.** Không khớp, hoặc luật không nói gì, thì **bỏ câu đó**. Mỗi lần bỏ phải được đếm theo lý do (`khong-co-luat`, `khong-khop-dap-an`, `mo-ho`, `qua-ngan`…).

**`classpos`: hai loại thẻ, bin cố định `Danh từ · Động từ · Tính từ · Trạng từ` (đủ 4 ô):**
| Loại thẻ | Hiển thị | Đáp án ô đúng lấy từ | Điều kiện sinh |
|---|---|---|---|
| "Chỗ trống cần…" | Đoạn trích tối đa 6 từ trước + `_____` + 6 từ sau; nhãn *"Chỗ trống cần loại từ nào?"* | Lớp từ mà luật **vị trí chỗ trống** suy ra | Luật có lớp từ **và** lớp từ của đáp án đã lưu (theo luật hậu tố/họ từ) **trùng** lớp suy ra |
| "Từ này là…" | Một từ duy nhất (một đáp án trong câu họ từ loại); nhãn *"Từ này là loại gì?"* | Nhãn lớp từ mà `explainer.js` đã gán cho lựa chọn đó | Câu thuộc dạng **họ từ loại** (≥ 3 lựa chọn cùng rễ) và nhãn lớp từ **không mơ hồ** |
Danh sách từ mơ hồ (cùng lúc danh từ/động từ, ví dụ `report, increase, plan, work`) và ngoại lệ hậu tố (`-ly` mà là tính từ: `friendly, early, daily, likely, lovely, costly, weekly, monthly, yearly`) phải nằm trong **bảng ngoại lệ** ở đầu file mới; từ trong bảng này **không được** thành thẻ "Từ này là…".

**`classtense`: bin = các thì của bốn lựa chọn của câu gốc (tối đa 4 ô, bỏ trùng):**
* Thẻ hiển thị câu cắt gọn (≤ 14 từ) với **dấu hiệu thời gian được tô đậm** (`next month`, `yesterday`, `since 2020`, `by the time`, `at the moment`, `every day`…).
* Ô đúng = thì của **đáp án đã lưu** nếu và chỉ nếu luật dấu hiệu → thì **khớp** thì của đáp án. Nếu luật nói *tương lai đơn* mà đáp án đã lưu là *hiện tại hoàn thành* thì **bỏ câu** (và đếm vào `khong-khop-dap-an`; đây cũng là cách phát hiện dữ liệu có thể sai).
* Nhãn ô (rút gọn, thống nhất toàn app): `Hiện tại đơn · Hiện tại tiếp diễn · Hiện tại hoàn thành · Quá khứ đơn · Tương lai đơn · Tương lai gần`. Nếu chưa đủ 3 ô khác nhau, bỏ câu.

**`classprep`: bin cố định `in · on · at`:**
* Chỉ sinh từ câu mà **đáp án đã lưu ∈ {in, on, at}** và **các từ ngay sau chỗ trống** (1–3 từ) khớp một quy tắc trong bảng dưới. Thẻ hiển thị `_____` + cụm đó (kèm tối đa 3 từ trước để có ngữ cảnh).
* **Quy tắc phải trùng đáp án đã lưu**; trùng thì mới sinh. Không trùng thì bỏ câu và đếm `khong-khop-dap-an`.

| Cụm đứng sau chỗ trống | Giới từ |
|---|---|
| Thứ trong tuần (`Monday`…`Sunday`), ngày cụ thể (`May 5`, `the 5th`), `Monday morning` | **on** |
| Tháng, năm, mùa, thế kỷ, `the morning/afternoon/evening`, khoảng thời gian tương lai (`two days`, `a week`) | **in** |
| Giờ đồng hồ (`9 a.m.`, `5:30`), `noon`, `midnight`, `night`, `the end of …`, `the moment` | **at** |
| Địa điểm điểm (`the airport`, `the station`, `the office entrance`, `the meeting`) | **at** |
| Không gian rộng (`the city`, `the building`, `Vietnam`, `the world`) | **in** |
| Bề mặt, tầng (`the table`, `the second floor`, `the website`) | **on** |
Bảng này là **điểm khởi đầu**. Qoder được thêm quy tắc nếu có nguồn rõ, nhưng **không** đưa vào quy tắc còn tranh cãi (ví dụ `in time / on time`, `at/in the corner`).

### 5.3 Dạng item
```js
{ key: undefined, classify: "pos"|"tense"|"prep",
  card: { before: "…the ", blank: true, after: " of the new product", focus: null }   // hoặc { word: "attractive" }
  bins: [{id:"n",label:"Danh từ"},{id:"v",label:"Động từ"},{id:"adj",label:"Tính từ"},{id:"adv",label:"Trạng từ"}],
  answerBin: "n",
  why: "Sau mạo từ \"the\" cần danh từ.",     // lấy từ explainer, tiếng Việt, <= 120 ký tự
  seconds: 8, t: "Từ loại" }
```

### 5.4 Giao diện (ưu tiên điện thoại)
* Thẻ ở giữa, chữ lớn (≥ 20 px). Dưới thẻ là các ô: 2×2 khi có 4 ô, một hàng khi ≤ 3 ô; mỗi ô **cao ≥ 56 px**, có **chữ** (và số `1`–`4` nhỏ), nền màu theo ô nhưng **không dựa vào màu để phân biệt**.
* **Kéo thẻ:** dùng Pointer Events (`pointerdown/move/up`, `setPointerCapture`), thẻ có `touch-action: none` (chỉ thẻ, không phải cả trang). Thả trên ô (`document.elementFromPoint`) thì chọn ô đó; thả ngoài ô thì thẻ trượt về chỗ cũ, **không trừ mạng**. **Chạm ô** vẫn là cách chính, kéo chỉ là bổ trợ.
* Thanh giờ giống `sktimer` của Blitz. Khi `prefers-reduced-motion: reduce`: bỏ hiệu ứng bay/trượt của thẻ, vẫn có thanh giờ.
* Sau mỗi thẻ: dùng `skillFinishItem`; phản hồi gồm: `ô đúng: <nhãn>` + dòng `why`. Với thẻ có `key` trống thì **không** gọi `explainHtml` (không có `ucid`).

### 5.5 Giờ và điểm
| Trò | Giờ mỗi thẻ | Đúng nhanh (+5) |
|---|---|---|
| `classpos` | 8 giây | còn hơn 4 giây |
| `classtense` | 8 giây | còn hơn 4 giây |
| `classprep` | 6 giây | còn hơn 3 giây |
Hết giờ = sai (trừ 1 mạng, hiện ô đúng). Dùng `s.timerId` như `skillPlayBlitz` và **dọn** `clearInterval` ở mọi nhánh kết thúc.

### 5.6 Trường hợp biên
| Tình huống | Xử lý |
|---|---|
| Hai thẻ giống hệt nhau trong một ván | Loại trùng theo `JSON.stringify(card)` |
| Bộ đề chỉ có 3–5 thẻ | Trò không hiện (không phải lỗi) |
| Người chơi nhấn hai ô gần như cùng lúc | Chỉ nhận lần đầu (kiểm `s.answered`) |
| Kéo thẻ rồi nhả ngoài khung | Thẻ về chỗ, thời gian vẫn chạy |
| Từ vừa là danh từ vừa là động từ | **Không** thành thẻ (bảng ngoại lệ) |

## 6. Các bước thực hiện
| # | Việc | File | Ghi chú |
|---|---|---|---|
| 1 | Đọc code theo mục 0 và trả lời **5 giả định** ở mục 1 | (không sửa) | Báo ngay nếu một giả định sai nặng (ví dụ `explainer.js` không có logic suy ra lớp từ/thì) |
| 2 | Nếu `explainer.js` chưa có API có cấu trúc: thêm hàm mới (**không** đổi hàm cũ) `ToeicExplainer.facts(q)` trả `{ blankNeeds, optionClasses[], answerClass, tenseSignal, optionTenses[], answerTense, prepRule }` (mỗi trường có thể `null`) dựng **từ cùng các luật hiện có**; thêm bài test cho nó | `explainer.js`, file test của bộ luật | Giữ nguyên nguyên tắc "thà im lặng còn hơn dạy sai" |
| 3 | Tạo `skill-items.js` chứa **hàm thuần** `buildSpotItems`, `buildClassifyItems(kind, …)`, bảng ngoại lệ/quy tắc, bộ đếm lý do bỏ qua. Viết dạng UMD (`window.SkillItems` ở trình duyệt, `module.exports` ở Node) | `skill-items.js` (mới) | Nhận `rng` và `deps` (ví dụ `ToeicExplainer`) qua tham số để test được |
| 4 | Nhúng `skill-items.js` vào bản dựng **giống cách `parser.js`/`duck.js` đang được nhúng** | `build.js`, `template.html` | Kiểm tra `node build.js` vẫn ra **một file HTML** và `npm run build` không lỗi |
| 5 | Đăng ký 4 trò: thêm mục `SKILL_META` (`spot`, `classpos`, `classtense`, `classprep`), nhánh `buildSkillItems`, mục `SKILL_PLAY`; `spot` thuộc nhóm `writing` (`--sk-write`), ba trò còn lại thuộc `reading` (`--sk-read`) | `template.html` | Mô tả ngắn một dòng như các trò khác |
| 6 | Viết `skillPlaySpot` | `template.html` | Mục 4 |
| 7 | Viết `skillPlayClassify` (một hàm chung cho ba trò) | `template.html` | Mục 5 |
| 8 | Thêm CSS (lớp `skword`, `skword.bad`, `skword.span`, `skbin`, `skcard`, `skcard.drag`, …), dùng biến màu có sẵn, hỗ trợ sáng/tối và `prefers-reduced-motion` | `template.html` | Không dùng màu cứng ngoài các biến |
| 9 | Viết `scripts/test-skill-items.js` theo mục 7 và thêm vào `npm test` | `scripts/`, `package.json` | Không cần mạng/CSDL |
| 10 | Viết `scripts/audit-skill-items.js` (đọc `seed.json` hoặc CSDL như `audit-free-explainer.js`): in **số thẻ/câu mỗi trò sinh ra theo từng bộ đề** và **thống kê lý do bỏ qua**; thoát mã khác 0 nếu phát hiện **mâu thuẫn** (ví dụ thẻ mà bin đúng ≠ đáp án đã lưu). Đưa vào `npm run verify` | `scripts/`, `package.json` | Dùng để biết độ phủ thật |
| 11 | Cập nhật `README.md`: số trò kỹ năng 14 → 18, thêm hai mục mô tả trò mới, nhật ký cập nhật, cách chạy bài test mới | `README.md` | Đúng giọng và bảng đang có |
| 12 | `npm run verify`, `node build.js`, kiểm tra tay (mục 7.3), rồi báo cáo | | |

## 7. Kiểm thử
### 7.1 Bài test tự động (`scripts/test-skill-items.js`)
| # | Trò | Kiểm tra | Mong đợi |
|---|---|---|---|
| 1 | spot | Câu A–D hợp lệ, `rng` cố định | Sinh đúng 1 item, `span` ánh xạ đúng token sai |
| 2 | spot | `wrong` nhiều từ (`will have completed`) | `span` phủ đúng các token liên tiếp |
| 3 | spot | Câu có 2 chỗ trống | Bị bỏ qua, lý do `nhieu-cho-trong` |
| 4 | spot | Đáp án dài > 28 ký tự | Bị bỏ qua |
| 5 | spot | `status = "review"` | Bị bỏ qua |
| 6 | spot | Chỗ trống đầu câu | `wrong` được viết hoa chữ đầu |
| 7 | spot | Dấu câu sát chỗ trống (`report, ____ .`) | Token và `span` đúng, không mất dấu |
| 8 | spot | Đáp án nhiễu trùng đáp án (khác hoa/thường) | Không được chọn làm `wrong` |
| 9 | spot | Câu > 28 từ | Bị bỏ qua |
| 10 | spot | Câu cùng họ từ | `wrong` ưu tiên đáp án cùng họ với đáp án đúng |
| 11 | classpos | `-ly` ngoại lệ (`friendly`) | Không thành thẻ "Từ này là…" |
| 12 | classpos | Từ mơ hồ (`report`) | Không thành thẻ |
| 13 | classpos | Luật vị trí ≠ lớp từ của đáp án đã lưu | Bỏ qua, lý do `khong-khop-dap-an` |
| 14 | classpos | Luật không nói gì | Bỏ qua, lý do `khong-co-luat` |
| 15 | classtense | `next month` + đáp án `will apply` | Ô đúng = `Tương lai đơn`, 4 ô khác nhau |
| 16 | classtense | Luật nói tương lai nhưng đáp án lưu là hiện tại hoàn thành | Bỏ qua, `khong-khop-dap-an` |
| 17 | classprep | `Monday` → on; `March` → in; `9 a.m.` → at | Ô đúng khớp |
| 18 | classprep | Quy tắc ≠ đáp án đã lưu | Bỏ qua |
| 19 | classify | Ít hơn 6 thẻ | Hàm trả mảng rỗng |
| 20 | classify | Thẻ trùng | Chỉ còn một |
| 21 | classify | `item.key` | Luôn `undefined` |
| 22 | tất cả | Số ô | ≤ 4, không trùng nhãn |
| 23 | tất cả | Không có chuỗi `undefined`/`NaN` trong văn bản thẻ | Đạt |

### 7.2 Lệnh
```cmd
npm test
node scripts\audit-skill-items.js --show 5
npm run verify
node build.js
```
Điều kiện đạt: toàn bộ xanh, audit `mâu thuẫn: 0`, `build.js` ra **một file HTML** dùng được khi mở không cần server.

### 7.3 Kiểm tra tay (ghi kết quả vào báo cáo)
| # | Việc | Mong đợi |
|---|---|---|
| 1 | Mở một bộ đề có câu Từ loại: thấy thẻ **Tìm lỗi sai** và **Phân loại nhanh: Từ loại** trong menu | Có số câu hợp lý |
| 2 | Tìm lỗi sai: chạm từ đúng đầu tiên | +5 EXP, đoạn sai nổi bật, hiện lựa chọn sửa |
| 3 | Tìm lỗi sai: chạm sai 2 từ | −2 mạng, hai từ bị vô hiệu |
| 4 | Tìm lỗi sai: chọn đúng cách sửa sau khi đã sai một lần | Câu tính là **sai**, không trừ mạng lần hai, vào danh sách câu sai |
| 5 | Phân loại nhanh: chạm ô đúng trong nửa đầu giờ | +10, +5 thưởng |
| 6 | Phân loại nhanh: để hết giờ | −1 mạng, hiện ô đúng và lý do |
| 7 | Kéo thẻ vào ô trên điện thoại 360 px | Thẻ vào ô; thả ngoài ô thì thẻ về chỗ |
| 8 | Bàn phím: `Tab`/`Enter` cho Tìm lỗi sai, `1`–`4` cho Phân loại | Chơi được hoàn toàn bằng phím |
| 9 | Bật chế độ tối và giảm chuyển động | Đọc được, không có hiệu ứng bay |
| 10 | Mở `toeic-game.html` **không có server** | Hai trò vẫn chạy, không lỗi console |
| 11 | Bộ đề **không có** câu phù hợp | Trò không hiện, không báo lỗi |
| 12 | Chơi một ván đầy đủ và sang trò khác | Không rò đồng hồ (`timerId`), không lỗi console |

## 8. Báo cáo khi xong
Qoder trả về **đúng các mục sau**:
1. **Kết quả 5 giả định** ở mục 1 (đúng/sai, và đã xử lý thế nào).
2. **Danh sách file đã tạo/sửa**, mỗi file một dòng nêu mục đích.
3. **Kết quả `npm run verify`** (số bài test, `mâu thuẫn`).
4. **Độ phủ thật** từ `audit-skill-items.js`: mỗi trò sinh ra bao nhiêu thẻ/câu **trên toàn ngân hàng** và **trên từng bộ đề**, kèm thống kê lý do bỏ qua. Nếu trò nào có ít hơn 20 thẻ trên toàn ngân hàng, nói rõ và đề xuất cách mở rộng.
5. **Điều chưa làm được hoặc chưa chắc**, nêu thẳng.
6. **Cách tắt** hai trò nếu cần (ví dụ xóa mục trong `SKILL_META`).

## 9. Không làm (ngoài phạm vi)
* Không gọi AI, không thêm khóa/biến môi trường, không đổi lược đồ CSDL, không thêm endpoint.
* Không đổi tên/id các trò hiện có, không đổi cách tính EXP chung.
* Không thêm thư viện ngoài (kể cả thư viện kéo thả); dùng Pointer Events.
* Không sửa tay các file sinh tự động; không commit `.env`.
* Không thêm chế độ nhiều người chơi, bảng xếp hạng riêng hay đồng hồ toàn cục cho hai trò này.

## 10. Kết quả giao (31/10/2026)
Bốn trò đã chạy thật trong giao diện bộ đề (`▶ Chơi · N câu` / `N thẻ`), mã nằm ở file riêng đúng yêu cầu "tạo ra file khác cho đỡ nặng file chung".

**1) Năm giả định**
| # | Giả định | Kết quả |
|---|---|---|
| 1 | `explainer.js` đã có luật bán cấu trúc, cần một API có cấu trúc | **Đúng.** Thêm hàm `facts(question)` (chỉ *thêm*, không sửa `analyze`) trả `{blank, cue, blankNeeds, optionClasses, answerClass, familyRoot, verbFamily, verbFamilyCount, optionFamily, optionForms, optionFormWhys, answerForm, tenseSignal, tenseCode, tenseVi}` |
| 2 | `explainer.js` chạy được cả trong Node lẫn trình duyệt | **Đúng** (UMD `module.exports`), nên test và audit đọc CSDL trong Node không cần trình duyệt |
| 3 | `build.js` ghép bằng marker | **Đúng.** Thêm hai marker `/*__SKILLEXTRA__*/` (script) và `/*__SKILLEXTRA_CSS__*/` (trong `<style>`); build vẫn báo lỗi nếu còn marker chưa thay |
| 4 | Dùng lại biến/classes CSS có sẵn | **Đúng.** Dùng `--sk-read/--sk-write`, `.skstem/.skchunk/.sktimer/.skjudge`, keyframe `skshake` và khối `prefers-reduced-motion` sẵn có; classes mới đều tiền tố `sk` |
| 5 | Bản offline có đủ dữ liệu | **Đúng.** `build.js` inline `explanation/n/status/payload/coach/translation` nên hai trò chạy trong `toeic-game.html` không cần server |

**2) File**
| File | Tạo/Sửa | Mục đích |
|---|---|---|
| `skill-extra.js` | mới | Toàn bộ sinh thẻ + 2 màn chơi + CSS của bốn trò (`window.SkillExtra`) |
| `scripts/test-skill-items.js` | mới | 29 ca kiểm với rng cố định, 0 mạng/0 CSDL |
| `scripts/audit-skill-items.js` | mới | Độ phủ theo bộ đề + lý do bỏ thẻ + dò mâu thuẫn, `--show N` |
| `explainer.js` | sửa (chỉ thêm) | Hàm `facts()` + xuất `facts` |
| `template.html` | sửa (~40 dòng) | Nối `SKX.META`/`SKX.PLAY`, `skxDeps()`/`skxCtx()`, hai marker; `unit` cho pill |
| `build.js` | sửa | Ghép `skill-extra.js` và CSS của nó |
| `package.json` | sửa | `test` += test-skill-items; `verify` += audit-skill-items; script mới `audit:skills` |
| `README/README.md`, `README/README-tro-choi-ky-nang.md` | sửa | 14 → 18 trò, bảng độ phủ, điều kiện sàng, kiểm thử 62–70, mục 34, lộ trình |

**3) `npm run verify`**: `npm test` → **20 + 26 + 42 + 29 + 9 + 12 + 5 = 143 bài, 0 lỗi** (bốn bộ đầu thuộc tính năng này: **117 bài**); `audit-free-explainer.js` → 866/965 câu có phân tích miễn phí, **mâu thuẫn: 0**; `audit-skill-items.js` → **mâu thuẫn: 0**. `node build.js` → mỗi bản **1203 KB / 965 câu** (**1.291.381 B** lúc đo; lúc mở rộng luật là 1.291.337 B, +5.016 B). *Ngày 01/11 thêm bộ tra cứu bôi đen: `npm test` **191 bài, 0 lỗi** (+48), hai bản **1.369.512 B** (+78.131 B, trong đó khối tra cứu 73.472 B). Cũng ngày 01/11, bản đổi tên TOEIC Practice + trang đăng nhập riêng (#38): `npm test` **202 bài** (+11 `test-auth-ui.js`), hai bản **1.368.421 B** (−1.091 B). Sau #39 (thêm landing `/` + dải giới thiệu, game sang `/choi`): `npm test` **209 bài** (+7 `test-landing.js`), hai bản **1.372.751 B**.* Sau #52 (04/11, bảng kết quả hứa trước thưởng xu): chạy lại hai audit trên **ngân hàng 975 câu** → `audit-free-explainer.js` **876/975** (89,8%, thì 144), `audit-skill-items.js` **spot 854 · classpos 65 · classtense 18 · classprep 12**, cả hai vẫn **mâu thuẫn: 0**; `npm test` **305 bài, 0 lỗi**; `npm run build` → `public/toeic-game.html` **1378 KB / 975 câu**.

**4) Độ phủ thật** (toàn ngân hàng **975 câu / 12 bộ đề có câu hỏi**, đo lại 04/11/2026 bằng `node scripts/audit-skill-items.js` — bản đo 31/10 là 844/965 trên 11 bộ, trước khi bộ `dan-noi-dung.txt` id 54 được nhập): **spot 854** (**12/12 bộ**; id 1 = 50/50, id 34 = 149, id 6 = 495, id 36 = 25, id 39 = 23, id 41 = 21, id 54 = 10/10); **classpos 65 thẻ/ván** (bể khử trùng 227, 6 bộ); **classtense 18** (bể 109, **2 bộ**: id 6 = 12, id 2 = 6); **classprep 12** (bể 33, 1 bộ). Lý do bỏ: `khong-cho-trong` 84, `khong-a-d` 19, `dap-an-dai` 15, `nhieu-cho-trong` 2, `cau-qua-ngan` 1 (spot); `khong-co-luat` 461 + `khong-khop-dap-an` 263 + `khong-cho-trong` 84 + `trung-the` 189 + `duoi-nguong-6` 6 + `review` 19 (classpos); `khong-phai-ho-dong-tu` 726 + `khong-cho-trong` 84 + `khong-co-luat` 23 + `khong-khop-dap-an` 11 + `duoi-nguong-6` 10 + `trung-the` 2 + `qua-it-bin` 1 + `review` 19 (classtense); `dap-an-khong-phai-in-on-at` 922 + `duoi-nguong-6` 11 + `khong-co-luat` 1 + `review` 19 (classprep). **Đã mở rộng luật (không thêm dữ liệu)** để dày hai trò mỏng: (a) Thì — nhận nhãn `past-perfect`/`perfect-future` (`had + V3` không còn bị gộp thành `pp`), cho phép họ động từ **3/4 đáp án**, dấu hiệu nằm xa chỗ trống (vd. *By the time …*, *would not have …*) thì **chèn chính cụm dấu hiệu vào thẻ** thay vì bỏ câu; (b) `in/on/at` — thêm bảng `on their first day`, `on weekends`, `at the intersection`, `in accordance with`, `in the cabinet`, `on the desk`, tên thành phố và **5 cụm cố định** (`rely on`, `good at`, `expert in`, `look at`, `result in`) qua tham số `near` (3 từ trước chỗ trống); bảng giới từ 13 → **18 quy tắc**. Kết quả: Thì **12 → 18 thẻ** (bể 98 → 106, **109 ở lần đo 04/11**), `in/on/at` **6 → 12 thẻ** (bể 12 → 33). Phần còn mỏng là **giới hạn dữ liệu**, không phải luật: 726 câu có đáp án không cùng họ động từ và 922 câu có đáp án không phải `in`/`on`/`at`.

**5) Chưa làm / chưa chắc**: kéo thả mới kiểm bằng DOM-level (chạm thẻ→chạm ô và phím 1–4), chưa chụp được trên thiết bị cảm ứng thật; `Tab`/`Enter` kích hoạt nút `.skword` là hành vi chuẩn của trình duyệt — khung tự động hóa chỉ gửi keydown nên không tạo được "click" gốc (Enter *nhảy câu* của game thì có chạy); hai bộ có thẻ mới đã mở trên **bản offline** và đọc DOM (không chụp được vì khung nhúng ẩn): bộ id 2 hiện `Phân loại nhanh: Thì · ▶ Chơi · 6 thẻ`, thẻ đầu là `Right now, …`; bộ id 6 hiện cả ba trò **12 thẻ**, thẻ giới từ đầu là `He relies _____ his assistant.` → chọn `on` ra `✅ Chính xác` + `💡 “his assistant” → cụm động từ cố định (rely on, …) đi với ON`; thẻ phân loại cố tình **không** vào Ôn theo lịch (quyết định theo tài liệu, chưa hỏi lại người dùng).

**6) Cách tắt**: xóa/comment mục tương ứng trong `SkillExtra.META` (`skill-extra.js`) rồi `node build.js`. Dòng biến mất khỏi mọi bộ đề; `template.html` và `explainer.js` không đổi vì chỉ nối qua `SKX.META`/`SKX.PLAY`. Tắt cả bốn: để `META = {}`.
