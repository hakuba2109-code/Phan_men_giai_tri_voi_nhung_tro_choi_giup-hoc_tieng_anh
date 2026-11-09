# 💡 Nút giải thích theo yêu cầu (tiết kiệm token, không làm phiền)

> **Trạng thái:** hướng dẫn thực hiện, bám theo `template_1.html`, `server_1.js`, `ai-coach.js`, `importer_1.js` bạn đã gửi. Các đoạn mã là khung mẫu **chưa chạy thử trên dự án của bạn**; mình chỉ đọc một phần hàm `coachBlock`/`coachPaint` (dòng 4032–4065) nên hãy đối chiếu lại khi sửa.
> Bổ sung cho [README-giai-thich-ai-va-trum-loi-sai.md](README-giai-thich-ai-va-trum-loi-sai.md).

## 1. Ý kiến và quyết định
Ý tưởng "thêm nút giải thích thay vì tự hiện" **nên làm**: đỡ rối màn hình, và quan trọng hơn là **ngừng gọi AI tự động**, thứ đang tốn lượt (xem mục 2).

Riêng ý "nếu người dùng sai thì không cần giải thích", mình đề xuất **đổi một chút**, vì lúc làm sai là lúc người học cần hiểu nhất (phản hồi ngay sau lỗi giúp nhớ lâu hơn). Mình tách thành hai loại để vừa tiết kiệm vừa không mất giá trị học:

| Loại | Chi phí | Khi trả lời sai | Khi trả lời đúng |
|---|---|---|---|
| **Giải thích có sẵn** (💡 vì sao đúng, ⚠ dễ nhầm, 🧠 mẹo; đã tạo trước bằng `ai-explain.js`) | **0 token** (đọc từ CSDL) | **Tự mở** (người dùng có thể đổi sang "chỉ khi bấm") | Thu gọn, có nút **"Xem giải thích"** |
| **Gia sư AI** (dịch câu, vì sao loại từng đáp án sai) | Tốn **1 lượt** gọi Gemini cho câu chưa có sẵn | **Chỉ khi bấm nút**, không tự gọi | **Chỉ khi bấm nút** |

Nếu bạn thật sự muốn "sai cũng không tự hiện", chỉ cần bật cài đặt **"Chỉ hiện khi bấm"** (mục 4, bước 5); mặc định thì giữ tự mở khi sai.

## 2. Hiện trạng trong mã của bạn
| Vị trí | Hiện tượng | Hệ quả |
|---|---|---|
| `template_1.html` ~dòng 3923–3927, `coachAutoOn()` | Mặc định **bật** (`!== "0"`) | Mỗi câu mới được trả lời đều **tự gọi Gemini**, đúng với ảnh chụp "hôm nay 2/60 lượt" |
| `showFeedback` ~dòng 4157 | Luôn gọi `explainHtml(q)` rồi `coachBlock(...)` | Cả hai khối luôn mở, màn phản hồi dài |
| `explainHtml` ~dòng 3879 | Hiện cả giải thích `draft` và `disputed` cho mọi người | Bản chưa duyệt đến tay người chơi (có gắn nhãn "chưa qua duyệt") |
| `explainHtml` ~dòng 3881 | `return ""` khi câu **chưa có** giải thích sẵn | Câu đó **không có cả nút Gia sư AI** |
| 10 chỗ gọi `explainHtml(it)` (dòng ~6396–7134) | Không biết đang ở ngữ cảnh nào | Danh sách ôn tập cũng mở hết |

## 3. Hành vi mới
### 3.1 Màn hình phản hồi
```
ĐÚNG                                 SAI (mặc định "tự mở khi sai")
┌───────────────────────────┐        ┌───────────────────────────────┐
│ ✅ Chính xác (+10 EXP)    │        │ ❌ Chưa đúng                  │
│ A. … · B. … ✅ · C. …     │        │ A. … · B. … ✅ · C. …         │
│ ▸ 💡 Xem giải thích       │        │ ▾ 💡 Giải thích                │
│ ▸ 🤖 Hỏi gia sư AI        │        │    💡 Chọn B vì …              │
└───────────────────────────┘        │    ⚠ Dễ nhầm: …  🧠 Mẹo: …    │
                                     │ ▸ 🤖 Hỏi gia sư AI (1 lượt)   │
                                     └───────────────────────────────┘
```
### 3.2 Quy tắc hiển thị theo trạng thái giải thích
| `explanationStatus` | Tự mở khi sai? | Hiện khi bấm nút? |
|---|---|---|
| `approved` | Có | Có |
| `draft` | Có, kèm nhãn "AI tự sinh · chưa qua duyệt" (**tạm thời**, vì bạn chưa có màn duyệt; khi có thì bỏ `draft` khỏi tự mở) | Có |
| `disputed` | **Không** | Có, kèm cảnh báo "AI nghi đáp án chưa đúng" |
| `none` | Không có gì để mở | Chỉ có nút Gia sư AI |

## 4. Các bước thực hiện (tất cả ở `template_1.html`)
### Bước 1: Tách phần dựng nội dung giải thích
Đổi tên thân hàm hiện tại thành `explainRows(q)` (vẫn trả về `"<div class='explain'>…</div>"` hoặc `""`, giữ nguyên phần dựng 💡 ⚠ 🧠 và nhãn trạng thái). Không có thay đổi ở nội dung, chỉ đổi cách bọc.

### Bước 2: Viết lại `explainHtml` có ngữ cảnh
```js
var EXPLAIN_MODE_KEY = "toeic.explainMode";      // "auto-wrong" (mặc định) | "button"
var AUTO_OPEN_STATUS = { approved: 1, draft: 1 }; // khi đã có màn duyệt: chỉ để approved

function explainMode() {
  try { return localStorage.getItem(EXPLAIN_MODE_KEY) === "button" ? "button" : "auto-wrong"; }
  catch (e) { return "auto-wrong"; }
}

/* ctx: "wrong" | "right" | (bỏ trống = danh sách ôn tập, luôn thu gọn) */
function explainHtml(q, ctx) {
  var inner = explainRows(q);
  var coach = q.ucid ? coachBlock(q.ucid, q.uco, q.ua, q.coach, null) : "";
  if (!inner) return coach;                         // câu chưa có giải thích vẫn có nút Gia sư AI
  var open = ctx === "wrong" && explainMode() === "auto-wrong" && !!AUTO_OPEN_STATUS[q.explanationStatus];
  return (
    "<details class='ex-fold'" + (open ? " open" : "") + ">" +
      "<summary>💡 " + (open ? "Giải thích" : "Xem giải thích") + "</summary>" +
      inner +
    "</details>" + coach
  );
}
```
`<details>` dùng được bằng bàn phím và trình đọc màn hình, không cần mã bật/tắt.

### Bước 3: Gọi `explainHtml` đúng ngữ cảnh
* Trong `showFeedback` (~dòng 4157): `explainHtml(q, correct ? "right" : "wrong")`.
* 10 chỗ còn lại (`explainHtml(it)` ở danh sách ôn tập): **giữ nguyên**, vì không truyền `ctx` nên luôn thu gọn. Nếu danh sách đó chỉ gồm câu sai và bạn muốn tự mở, truyền `"wrong"`.

### Bước 4: Gia sư AI chỉ theo nút
1. **Tắt tự hỏi theo mặc định** (~dòng 3924):
   ```js
   function coachAutoOn() {
     try { return localStorage.getItem(COACH_AUTO_KEY) === "1"; }   // mặc định TẮT
     catch (e) { return false; }
   }
   ```
2. Đổi chữ ô chọn trong `coachFoot` thành **"Tự hỏi câu mới (tốn lượt)"** để người dùng biết hậu quả. Ô này nên nằm trong Cài đặt thay vì ngay trong khung phản hồi.
3. Nút chưa có sẵn hiện số lượt còn lại (đã có `st.used` và `st.cap`): `🤖 Hỏi gia sư AI · còn <cap − used> lượt hôm nay`.
4. **Đã có sẵn** (`q.coach` có dữ liệu, miễn phí): bọc trong `<details class='ex-fold'>` có tiêu đề `🤖 Gia sư AI (đã có sẵn, miễn phí)`, thay vì mở sẵn cả khối dài.
5. Khi hết lượt trong ngày, giữ nguyên thông báo hiện có và vẫn cho xem các câu đã có sẵn.

### Bước 5: Giữ trạng thái mở khi vẽ lại
`coachPaint` ghi đè `innerHTML` nên khối `<details>` sẽ tự đóng lại. Lưu trạng thái mở của từng khối:
```js
document.addEventListener("toggle", function (e) {
  var d = e.target;
  if (!d || !d.classList || !d.classList.contains("ex-fold")) return;
  var box = d.closest("[data-coach]");
  if (box) { var st = coachStore[box.getAttribute("data-coach")]; if (st) st.open = d.open; }
}, true);   // sự kiện toggle không nổi bọt, phải dùng capture
```
Trong `coachPaint`/`coachBlock`, thêm `(st.open ? " open" : "")` vào thẻ `<details>` của Gia sư AI.

### Bước 6: Công tắc "Khi trả lời sai"
Thêm vào màn Cài đặt hiện có (nếu chưa có, đặt nhỏ dưới khung phản hồi):
```html
<label>Khi trả lời sai:
  <select data-explain-mode>
    <option value="auto-wrong">Tự mở giải thích</option>
    <option value="button">Chỉ hiện nút</option>
  </select>
</label>
```
```js
document.addEventListener("change", function (e) {
  var t = e.target;
  if (t && t.hasAttribute && t.hasAttribute("data-explain-mode"))
    try { localStorage.setItem(EXPLAIN_MODE_KEY, t.value); } catch (err) {}
});
```
Khi mở màn Cài đặt, đặt `select.value = explainMode()`.

### Bước 7: CSS (đặt cạnh `.feedback .ex-line`, ~dòng 600)
```css
.feedback .ex-fold { margin-top: 10px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line); padding: 4px 12px; }
.feedback .ex-fold > summary { cursor: pointer; font-weight: 600; padding: 8px 0; list-style: none; }
.feedback .ex-fold > summary::-webkit-details-marker { display: none; }
.feedback .ex-fold > summary::before { content: "▸ "; }
.feedback .ex-fold[open] > summary::before { content: "▾ "; }
.feedback .ex-fold > summary:focus-visible { outline: 3px solid #f2c230; outline-offset: 2px; }
```
Dùng các biến màu sẵn có của giao diện (`--bg`, `--line`) nên tự đổi theo chế độ sáng/tối. Nếu tên biến của bạn khác, thay cho khớp.

### Bước 8 (tùy chọn): Đo xem tính năng có ích không
Gửi sự kiện nhẹ khi người dùng bấm mở: `explain_open` (kèm `auto` hoặc `manual`, kèm đúng/sai), `coach_ask`. Chỉ cần một bảng `events(type, user_id, question_id, at)` và một endpoint `POST /api/event`. Dùng để trả lời: người dùng có tự mở khi đúng không, tỉ lệ bấm Gia sư AI, và câu nào được hỏi nhiều (để tạo sẵn trước).

### Bước 9 (giai đoạn sau): Kho dùng chung theo nội dung câu
`importer.insertForOwner` tạo bản sao câu với id khác cho mỗi tài khoản, và `coach` lưu theo dòng câu, nên cùng một câu ở hai tài khoản có thể bị gọi AI hai lần. Tạo bảng riêng:
```sql
CREATE TABLE IF NOT EXISTS coach_cache (
  content_hash text PRIMARY KEY,           -- băm (câu + 4 đáp án), KHÔNG kèm tài khoản
  coach jsonb NOT NULL,
  model text, tokens int, created_at timestamptz DEFAULT now()
);
```
`ai-coach.js` tra `coach_cache` trước khi gọi Gemini, rồi ghi vào đó sau khi tạo. Giữ riêng việc này để làm sau khi nút giải thích chạy ổn.

## 5. Kiểm thử
| # | Kiểm thử | Mong đợi |
|---|---|---|
| 1 | Trả lời **sai**, câu có giải thích `approved` | Khối 💡 tự mở |
| 2 | Trả lời **đúng**, câu có giải thích | Thu gọn, có "Xem giải thích"; bấm mở được |
| 3 | Đặt "Khi trả lời sai: Chỉ hiện nút", trả lời sai | Thu gọn |
| 4 | Câu `disputed`, trả lời sai | Không tự mở; bấm mở thấy cảnh báo |
| 5 | Câu chưa có giải thích | Vẫn có nút "Hỏi gia sư AI" |
| 6 | Câu mới chưa có `coach`, **không bấm gì** | **Không** có lời gọi `/api/ai/coach` (kiểm trong tab Network) |
| 7 | Bấm "Hỏi gia sư AI" | 1 lượt, số "đã dùng" tăng 1 |
| 8 | Bấm lại cùng câu hoặc mở lại câu đã có | 0 token, không tăng số lượt |
| 9 | Hết lượt trong ngày | Thông báo hết lượt; câu đã có sẵn vẫn mở được |
| 10 | Mở khối Gia sư AI rồi vẽ lại màn | Khối vẫn mở |
| 11 | Dùng bàn phím (Tab, Enter/Space) | Mở/đóng được khối |
| 12 | Chế độ sáng/tối, điện thoại 360 px | Đọc được, không tràn ngang |
| 13 | Danh sách ôn tập (10 chỗ `explainHtml(it)`) | Thu gọn, không lỗi |
| 14 | Tải lại trang | Cài đặt "Khi trả lời sai" được giữ |

## 6. Tiêu chí hoàn thành và quay lại bản cũ
* Chơi 20 câu liên tiếp mà **không có lời gọi AI nào** nếu không bấm nút; số lượt hằng ngày chỉ tăng khi bấm.
* Màn phản hồi ngắn hơn rõ rệt khi trả lời đúng.
* Muốn quay lại hành vi cũ: bỏ tham số `ctx` (luôn mở) và đặt lại `coachAutoOn()` về mặc định bật.

## 7. Rủi ro
| Rủi ro | Cách giảm |
|---|---|
| Người học bỏ qua giải thích khi đúng và bỏ lỡ chỗ hiểu sai nửa chừng | Giữ nút luôn thấy được, có thể thêm gợi ý nhẹ khi trả lời đúng nhưng chậm |
| Sau khi thu gọn, người dùng không biết có giải thích | Tiêu đề rõ ràng, biểu tượng 💡 ở đầu |
| Giải thích `draft` vẫn tự mở khi sai | Tạm chấp nhận vì có nhãn; làm màn duyệt rồi đổi `AUTO_OPEN_STATUS` chỉ còn `approved` |
| Người dùng cũ đã lưu `toeic.coachAuto = "1"` hoặc `"0"` | Giá trị `"0"` giờ vẫn là tắt; người đã bật `"1"` vẫn bật, bạn có thể xóa khóa này một lần để áp mặc định mới |
| `coachPaint` làm mất trạng thái mở | Bước 5 |
