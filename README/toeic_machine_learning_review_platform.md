# 🎯 TOEIC & Machine Learning Platform — Web Game & AI Review System

Hệ thống web tương tác ôn tập **TOEIC 3 kỹ năng (Listening, Reading, Writing)** và **Lộ trình Machine Learning & AI hiện đại (15 tuần)**. Ứng dụng kết hợp giữa yếu tố Trò chơi hóa (EXP, Cấp độ, Mạng, Combo, Săn vịt) cùng với **Hệ thống AI Parser 2 Bước (Normalization-First Pipeline & 3-Pass AI Resolver)** giúp tự động chuyển đổi mọi định dạng file Word (`.docx`) lộn xộn thành file Word chuẩn hóa, bóc tách dạng bài và nạp vào Cơ sở dữ liệu.

> **📌 Ghi chú trạng thái (29/10/2026):** tài liệu này là **bản thiết kế** (FastAPI + React, Cổng 8000). App đang chạy thật trong thư mục này là **Node.js + Express + PostgreSQL** và được ghi đầy đủ ở [README.md](README.md). Đối chiếu 11 dạng bài ở mục 2: **9/11 đã có màn chơi chấm điểm được** trong app thật (6 dạng A–D qua Trắc nghiệm/Mưa đáp án/Săn vịt/trò kỹ năng, cộng `tf` · `fill` · `numeric` · `multi` · `match` · `order` bằng sáu trò nhóm **Các dạng câu khác** vừa lập trình 29/10); **2 dạng còn lại** (`writing_short`, `writing_essay`) cần ô soạn văn bản + AI chấm rubric nên chưa có màn chơi. Phần **SRS Leitner** (mục 7) đã cài đặt; **Kiến trúc Fullstack, Cài đặt FastAPI, Triển khai** (mục 6, 10, 11) vẫn là thiết kế, chưa áp dụng cho app này.

---

## 📌 Mục lục
1. [Tính năng nổi bật](#-tính-năng-nổi-bật)
2. [Cấu trúc 11 Dạng bài & Mô hình CSDL](#-cấu-trúc-11-dạng-bài--mô-hình-csdl)
3. [Quy trình AI Parsing & Nhập đề từ file Word](#-quy-trình-ai-parsing--nhập-đề-từ-file-word)
4. [Kiến trúc Chuẩn hóa 2 Bước & AI Resolver 3-Pass](#-kiến-trúc-chuẩn-hóa-2-bước--ai-resolver-3-pass)
5. [Lộ trình Machine Learning & AI (HCMUTE)](#-lộ-trình-machine-learning--ai-hcmute)
6. [Kiến trúc Hệ thống Fullstack](#-kiến-trúc-hệ-thống-fullstack)
7. [Hệ thống Ôn tập ngắt quãng (SRS Leitner)](#-hệ-thống-ôn-tập-ngắt-quãng-srs-leitner)
8. [Chế độ đề xuất: Máy bay bắn vịt](#-chế-độ-đề-xuất-máy-bay-bắn-vịt)
9. [Cấu trúc Dự án](#-cấu-trúc-dự-án)
10. [Hướng dẫn Cài đặt & Chạy ứng dụng](#-hướng-dẫn-cài-đặt--chạy-ứng-dụng)
11. [Triển khai Thực tế (Deployment)](#-triển-khai-thực-tế-deployment)

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|---|---|
| **Chuẩn hóa 2 Bước (Normalization-First)** | Tự động đưa mọi file Word lộn xộn về định dạng chuẩn duy nhất. Xuất ra file `.docx` sạch để tải về lưu trữ và dữ liệu JSON nạp CSDL. |
| **Đọc Định dạng Word (Rich Formatting)** | Bóc tách đáp án trực tiếp từ định dạng chữ (Tô đậm **Bold**, Gạch chân <u>Underline</u>, Tô màu Highlight) mà không cần gọi AI. |
| **AI Resolver 3-Pass & Permutation** | AI tự giải câu chưa có đáp án bằng cơ chế xáo đáp án 3 lần (3-Pass Shuffle) để chống thiên vị vị trí, tính điểm đồng thuận (Consensus) và cảnh báo câu mơ hồ (`is_ambiguous`). |
| **Xác thực Máy (Deterministic Verifier)** | Tự động kiểm thử câu tính toán số ($F1$, Precision) và chạy thử code Python trong môi trường Sandbox để đối chiếu với kết quả AI. |
| **Giao diện Split-Screen Diff UI** | Màn hình chia đôi so sánh bản gốc vs. bản chuẩn hóa, bật tắt bộ lọc câu AI giải, xem bằng chứng bài đọc và duyệt hàng loạt. |
| **Đa kỹ năng TOEIC & ML 15 tuần** | Ôn tập đầy đủ **TOEIC 3 kỹ năng** (Listening, Reading, Writing) và **6 giai đoạn ML HCMUTE** với KaTeX toán học & Code Highlighter. |

---

## 🧩 Cấu trúc 11 Dạng bài & Mô hình CSDL

Hệ thống phân loại toàn bộ ngân hàng câu hỏi thành **11 dạng bài chuẩn mực** để render động trên Frontend:

| Nhóm Kỹ năng | Mã `type` | Tên Dạng bài | Giao diện Frontend & Tương tác | Dữ liệu `payload` trong DB |
|---|---|---|---|---|
| **TOEIC Listening** | `audio_mcq` | Nghe chọn đáp án | Trình phát MP3 + 4 lựa chọn A, B, C, D | `{ "audio_url": "...", "options": [...], "answer": 0 }` |
| **TOEIC Reading** | `mcq` | Trắc nghiệm ngắn | Nhìn câu hỏi chọn 1 đáp án đúng (Part 5) | `{ "options": [...], "answer": 2 }` |
| | `passage_mcq` | Đọc đoạn văn | Chia đôi màn hình: Trái hiện passage, Phải hiện danh sách câu hỏi | `{ "passage": "...", "questions": [...] }` |
| **TOEIC Writing** | `writing_short` | Viết câu ngắn | Nhập văn bản ngắn dựa trên từ gợi ý / hình ảnh | `{ "keywords": ["arrive", "office"], "sample_answer": "..." }` |
| | `writing_essay` | Viết Email / Essay | Editor văn bản dài + Chấm điểm tự động bằng AI Rubric | `{ "min_words": 150, "rubric": "..." }` |
| **ML & Tech** | `multi` | Chọn nhiều đáp án | Tick chọn nhiều ô đáp án đúng | `{ "options": [...], "answer": [0, 2] }` |
| | `tf` | Đúng / Sai | Đánh giá danh sách mệnh đề | `{ "statements": [...], "answer": [true, false, true] }` |
| | `fill` | Điền từ / Công thức | Nhập từ hoặc chọn từ trong danh sách để điền vào `_______` | `{ "answers": ["alpha", "α", "learning rate"] }` |
| | `numeric` | Tính toán số | Nhập kết quả số (chấp nhận sai số `tolerance`) | `{ "answer": 0.84, "tolerance": 0.01 }` |
| | `match` | Nối cặp khái niệm | Kéo thả hoặc bấm nối các cặp tương ứng | `{ "left": [...], "right": [...], "answer": [2, 0, 1] }` |
| | `order` | Sắp xếp quy trình | Drag & Drop đổi thứ tự các bước | `{ "steps": ["Chunking", "Embedding", "RAG Prompt", "LLM Answer"] }` |

---

## 🤖 Quy trình AI Parsing & Nhập đề từ file Word

Quy trình xử lý dữ liệu đầu vào áp dụng triết lý **Chuyển đổi phần khó nhất (hiểu đủ kiểu format Word lộn xộn) sang bước Chuẩn hóa riêng biệt**.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                BƯỚC 1: CHUẨN HÓA                                 │
│  [File Word Lộn xộn] ──► [Rich Text Reader] ──► [Batch AI Normalizer]            │
│  (Định dạng, Bảng,      (Đọc chữ, bảng,          (Số tự động ➔ Số thật,          │
│   Style không chuẩn)    Bold/Underline/Color)     Đáp án dồn ➔ Tách dòng,        │
│                                                   Loại bỏ Header/Footer)         │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             BƯỚC 2: AI RESOLVER & PARSING                        │
│  [Chuyển về Khung Chuẩn] ──► [Answer Resolution Pipeline] ──► [Deterministic]    │
│  (PHẦN ➔ Câu n. ➔          1. Dòng Đáp án:                    (Python Sandbox /  │
│   (A)...(D) ➔ Đáp án:)     2. Bảng ANSWER KEY                 Math Calculator /  │
│                            3. Định dạng Word (Bold/Highlight) Evidence Finder)   │
│                            4. AI 3-Pass Shuffled Solver                          │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           BƯỚC 3: PHÊ DUYỆT & ĐỒNG BỘ                            │
│  [Split-Screen Diff UI] ──► [Xác nhận Phê duyệt] ──► 1. CSDL PostgreSQL          │
│  (So sánh Gốc vs Chuẩn,                           2. File Word Chuẩn hóa (.docx) │
│   Lọc câu AI giải 3/3)                            3. Game Ôn tập (Review Status) │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Kiến trúc Chuẩn hóa 2 Bước & AI Resolver 3-Pass

### 1. Triết lý Thiết kế "Normalization-First"
Thay vì bắt bộ phân tích CSDL phải tự xử lý hàng trăm biến thể định dạng lộn xộn trong file Word, quy trình tách làm 2 nhiệm vụ chuyên biệt:
1. **Bước Chuẩn hóa (Normalization):** Chuyển file Word bất kỳ về **Một khuôn chuẩn duy nhất** (Các tiêu đề `PHẦN` $\rightarrow$ `Câu n.` $\rightarrow$ các lựa chọn `(A)...(D)` trên từng dòng riêng $\rightarrow$ `Đáp án:` $\rightarrow$ `Giải thích:`). Tuyệt đối **không thay đổi hoặc tự tiện sửa nội dung/chính tả** của đề bài.
2. **Bước Phân tích & Giải (Parsing & Resolving):** Bộ phân tích tĩnh đọc khuôn chuẩn để đẩy vào CSDL với tỉ lệ chính xác xấp xỉ 100%. Nếu file chưa có đáp án, **AI Resolver 3-Pass** sẽ kích hoạt.

### 2. Quy trình 7 Bước Chi tiết (7-Step Execution Pipeline)

```
[1. Đọc Rich Text] ➔ [2. Tách Khối] ➔ [3. AI Normalizer] ➔ [4. Diff Validation] ➔ [5. Answer Pipeline] ➔ [6. Split UI] ➔ [7. Export]
```

| Bước | Tên bước | Phương pháp | Nhiệm vụ chính |
|---|---|---|---|
| **1** | **Đọc Rich Text** | `python-docx` / `mammoth` | Đọc văn bản thô, bảng biểu, ảnh đính kèm và **thu thập thuộc tính định dạng** (In đậm `bold`, Gạch chân `underline`, Tô màu `highlight`, Màu chữ `color`). |
| **2** | **Tách khối sơ bộ** | Quy tắc Deterministic | Phận đoạn thô theo Tiêu đề phần, Đoạn văn đọc (Passage), và các cụm câu hỏi. |
| **3** | **Chuẩn hóa cấu trúc** | AI theo lô (Batch Processing) | Chuyển số thứ tự tự động Word thành văn bản thật; Tách các đáp án dồn 1 dòng (`A. x B. y`) thành từng dòng `(A) x\n(B) y`; Đổi nhãn `a/b/c` hoặc `1/2/3` thành `(A)(B)(C)(D)`; Chuyển chỗ trống `...` về `_______`; Gắn đúng đoạn văn bài đọc cho nhóm `Questions 5–7`; Loại bỏ Header/Footer/Số trang. |
| **4** | **Kiểm tra sai lệch (Diff Validation)** | Quy tắc So khớp Chữ | So sánh từng từ giữa bản gốc và bản chuẩn hóa. AI tự thêm/bớt từ nào sẽ bị phát hiện ngay lập tức. Lỗi chính tả của đề gốc chỉ ghi vào mảng `suggested_edits`, không tự sửa vào văn bản. |
| **5** | **Tìm đáp án (Resolution)** | Tháp ưu tiên 4 Cấp | Xác định đáp án đúng theo đúng thứ tự ưu tiên (xem chi tiết bên dưới). |
| **6** | **Xem trước So sánh** | Split-Screen UI | Hiển thị màn hình chia đôi: Bên trái bản gốc, bên phải bản chuẩn hóa, phía trên là thanh thống kê tổng quan và danh sách cảnh báo. |
| **7** | **Lưu & Xuất bản** | System Engine | Ghi dữ liệu vào CSDL PostgreSQL và **xuất ra file Word chuẩn hóa (`.docx`)** để người dùng tải về dùng lại sau này. |

---

### 3. Tháp Ưu tiên Tìm Đáp án 4 Cấp (Answer Resolution Hierarchy)

Khi file Word nhập vào chưa có sẵn đáp án, hệ thống áp dụng tháp ưu tiên dừng ở cấp đầu tiên tìm thấy:

```
[ CẤP 1: Dòng 'Đáp án:' ngay dưới câu ]
       │ (Không tìm thấy)
       ▼
[ CẤP 2: Bảng ĐÁP ÁN (ANSWER KEY) cuối file ]
       │ (Không tìm thấy)
       ▼
[ CẤP 3: Định dạng Rich Text trong Word (In đậm / Gạch chân / Highlight / Tô màu) ]
       │ (Không tìm thấy)
       ▼
[ CẤP 4: AI Self-Solver 3-Pass (Xáo đáp án 3 lần + Kiểm tra Bằng chứng + Máy kiểm thử) ]
```

#### Chi tiết Cấp 3: Khai thác Định dạng Rich Text
Nhiều giảng viên đánh dấu đáp án đúng bằng cách **Tô đậm (Bold)**, **Gạch chân (Underline)**, hoặc **Tô màu Highlight** trong Word. Ở Bước 1, bộ đọc Rich Text lưu lại thuộc tính này:
```python
# Ví dụ thuộc tính định dạng đọc từ python-docx
run_props = {
    "text": "will have completed",
    "bold": True,
    "underline": True,
    "highlight_color": "YELLOW"
}
```
Nếu phát hiện đúng 1 trong 4 lựa chọn có thuộc tính ưu tiên này, hệ thống gắn ngay `answer_source = "formatting"` mà **không cần tiêu tốn bất kỳ lời gọi AI nào**.

#### Chi tiết Cấp 4: AI Self-Solver 3-Pass (Độ tin cậy cao)
Để loại bỏ thói quen vị trí (Position Bias - AI hay chọn A hoặc C) và chống ảo giác (Hallucination):

1. **Xáo vị trí 3 lần (3-Pass Shuffled Permutation):** AI giải cùng 1 câu 3 lần độc lập, mỗi lần mảng đáp án được đảo vị trí ngẫu nhiên và mã hóa lại (ví dụ: Lần 1: A-B-C-D, Lần 2: C-A-D-B, Lần 3: B-D-A-C). Kết quả trả về được quy đổi ngược về vị trí gốc.
2. **Đánh giá Đồng thuận (Consensus Scoring):**
   - **Đồng thuận $3/3$:** Đáp án đáng tin cậy cao $\rightarrow$ Gán `confidence = 0.98`, trạng thái `review_ready`.
   - **Phân rã $2/3$ hoặc $1/3$:** Đánh dấu `is_split = true`, cờ cảnh báo `needs_manual_review`.
3. **Cờ Mơ hồ (`is_ambiguous`):** Nếu AI phát hiện câu hỏi có $\ge 2$ đáp án đúng hoặc đề bài sai/thiếu dữ kiện, AI gắn cờ mơ hồ kèm giải thích lý do, không ép hệ thống phải chọn đáp án rủi ro.
4. **Máy kiểm thử tự động (Deterministic Verifiers):**
   - **Câu tính toán số (`numeric`):** Chạy hàm tính toán số học trên Backend để verify lại đáp số $F1 = \frac{2PR}{P+R}$.
   - **Câu đọc code (`mcq` code):** Đưa đoạn mã Python vào môi trường **Isolated Sandbox (Pyodide / Docker Container)** để thực thi thật và đối chiếu kết quả in ra với đáp án của AI.
   - **Bài đọc (`passage_mcq`):** AI bắt buộc phải trích xuất đoạn văn bản ngắn chứa bằng chứng (`evidence_quote`) trong bài đọc làm căn cứ.

---

### 4. JSON Schema Cấu trúc Chuẩn hóa & Nguồn Đáp án

Dữ liệu đầu ra của bước Chuẩn hóa và Tìm đáp án tuân theo JSON Schema mở rộng:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NormalizedQuestionPackage",
  "type": "object",
  "properties": {
    "filename": { "type": "string" },
    "stats": {
      "type": "object",
      "properties": {
        "total_questions": { "type": "integer" },
        "structure_fixes": { "type": "integer" },
        "answers_from_file": { "type": "integer" },
        "answers_from_formatting": { "type": "integer" },
        "answers_from_ai_consensus": { "type": "integer" },
        "answers_ambiguous": { "type": "integer" }
      }
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "num": { "type": "integer" },
          "type": { "type": "string" },
          "subject": { "type": "string", "enum": ["toeic", "ml"] },
          "skill": { "type": "string" },
          "topic": { "type": "string" },
          "stem": { "type": "string" },
          "passage": { "type": ["string", "null"] },
          "options": { "type": "array", "items": { "type": "string" } },
          "answer_index": { "type": ["integer", "null"] },
          "answer_source": {
            "type": "string",
            "enum": ["file_text", "file_key_table", "formatting", "ai_consensus_3_3", "ai_split", "unresolved"]
          },
          "confidence_score": { "type": "number", "minimum": 0, "maximum": 1 },
          "is_ambiguous": { "type": "boolean" },
          "ambiguity_reason": { "type": ["string", "null"] },
          "evidence_quote": { "type": ["string", "null"] },
          "verifier_result": {
            "type": "object",
            "properties": {
              "type": { "type": "string", "enum": ["python_sandbox", "math_calc", "none"] },
              "passed": { "type": "boolean" },
              "execution_output": { "type": "string" }
            }
          },
          "explanation": { "type": "string" }
        },
        "required": ["num", "type", "stem", "answer_source"]
      }
    }
  }
}
```

---

### 5. Prompts Hệ thống Chuẩn hóa & 3-Pass Solver

#### A. Prompt Chuẩn hóa Cấu trúc (Structure Normalizer Prompt)

```text
SYSTEM PROMPT: NORMALIZATION ENGINE
Bạn là bộ chuẩn hóa cấu trúc đề thi. Nhiệm vụ duy nhất của bạn là chuyển đổi đoạn văn bản đề thi thô lộn xộn từ file Word về ĐỊNH DẠNG KHUÔN CHUẨN.

QUY TẮC BẮT BUỘC:
1. KHÔNG THAY ĐỔI NỘI DUNG: Giữ nguyên từng từ, từng câu, không tự ý sửa lỗi chính tả hay viết lại câu.
2. CHUẨN HÓA CẤU TRÚC:
   - Đưa các tiêu đề về dạng: PHẦN 1: [TÊN PHẦN]
   - Đánh số câu rõ ràng: 1., 2., 3.
   - Các lựa chọn phải nằm trên các dòng riêng biệt dạng: (A) ..., (B) ..., (C) ..., (D) ...
   - Chuyển các ký hiệu chỗ trống dạng '...', '....' về đúng '_______'.
   - Nếu có dòng đáp án, đưa về cuối câu dạng: Đáp án: [X]
   - Nếu có giải thích, đưa về dạng: Giải thích: [Nội dung]
3. BÀI ĐỌC NHÓM (PASSAGE): Nếu có nhóm câu hỏi dùng chung bài đọc (ví dụ Questions 5-8), phải đặt khối bài đọc ngay trước câu đầu tiên của nhóm với thẻ: --- ĐOẠN VĂN ĐỌC (PASSAGE) ---
```

#### B. Prompt Solver 3-Pass (Shuffled Permutation Solver Prompt)

```text
SYSTEM PROMPT: 3-PASS SHUFFLED SOLVER
Bạn là chuyên gia giải đề thi TOEIC và Machine Learning cấp cao. Hãy giải câu hỏi dưới đây với độ chính xác tuyệt đối.

DANH SÁCH ĐÁP ÁN ĐÃ ĐƯỢC XÁO TRỘN VỊ TRÍ:
{shuffled_options_json}

NHIỆM VỤ CỦA BẠN:
1. Xác định lựa chọn đúng nhất dựa trên danh sách đã xáo trộn ở trên.
2. Trích xuất trích dẫn bằng chứng (evidence_quote) ngắn gọn từ đề bài hoặc bài đọc.
3. Nếu phát hiện đề bài mơ hồ, thiếu dữ kiện hoặc có 2 đáp án cùng đúng, đặt "is_ambiguous": true và giải thích lý do.

ĐẦU RA BẮT BUỘC (JSON):
{
  "selected_shuffled_index": 1,
  "confidence": 0.95,
  "is_ambiguous": false,
  "ambiguity_reason": null,
  "evidence_quote": "Dấu hiệu 'by the time' đi kèm mệnh đề hiện tại đơn...",
  "explanation": "Giải thích chi tiết..."
}
```

---

### 6. Giao diện Split-Screen UI & Trải nghiệm Người dùng

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 📊 TÓM TẮT CHUẨN HÓA: 40 câu hỏi · ⚙️ Sửa 12 lỗi cấu trúc · 🎯 38 câu đáp án từ File   │
│ 🤖 2 câu AI giải (3/3 Consensus) · ⚠️ 0 câu mơ hồ                                      │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 📄 BẢN GỐC (TRÍCH XUẤT TỪ WORD)          │ 🛠️ BẢN CHUẨN HÓA & ĐÁP ÁN (DỰ KIẾN LƯU CSDL)│
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ PHẦN 1: THÌ TRONG TIẾNG ANH              │ PHẦN 1: THÌ TRONG TIẾNG ANH                 │
│                                          │                                             │
│ 1. By the time the team arrives, the IT  │ 1. By the time the team arrives, the IT     │
│ department _____ the server. A. is       │ department _______ the server.              │
│ completing B. has completed C. completed  │ (A) is completing                           │
│ D. will have completed                   │ (B) has completed                           │
│ (Đáp án tô đậm trong file Word)          │ (C) completed                               │
│                                          │ (D) will have completed                     │
│                                          │ [🏷️ Nguồn đáp án: Formatting (Gạch chân)]   │
│                                          │ Đáp án: D                                   │
│                                          │                                             │
│ 2. Predict output of np.dot([1,2],[3,4]) │ 2. Predict output of np.dot([1,2],[3,4])    │
│ (Chưa có đáp án trong file)              │ ```python                                   │
│                                          │ import numpy as np                          │
│                                          │ print(np.dot([1,2],[3,4]))                   │
│                                          │ ```                                         │
│                                          │ (A) 11                                      │
│                                          │ (B) 14                                      │
│                                          │ [🤖 Nguồn đáp án: AI Consensus 3/3]         │
│                                          │ [✅ Sandbox Python Verified: 11]            │
│                                          │ Đáp án: A                                   │
├──────────────────────────────────────────┴─────────────────────────────────────────────┤
│ [Bộ lọc: Tất cả (40) | Chỉ xem AI giải (2) | Chỉ xem câu lệch (0)]                     │
│ 🔘 [Duyệt tất cả câu AI đồng thuận 3/3]   📥 [Tải file Word chuẩn hóa]   💾 [Lưu CSDL] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Tính năng Nổi bật trên Giao diện:
- **Thẻ Nguồn Đáp án (Source Badges):** Mỗi câu hiển thị rõ nguồn gốc đáp án: `[File Text]`, `[Key Table]`, `[Formatting]`, `[AI Consensus 3/3]`, `[AI Split 2/3]`.
- **Thử nghiệm Chế độ Crowdsourced (Thử thách AI):** Các câu đáp án do AI tự giải có thể đưa vào một chế độ chơi riêng trong Game có gắn nhãn `🤖 Đề xuất bởi AI` và **không cộng EXP**. Người chơi có thể bấm nút **Báo sai (Report)** để tự động đẩy câu đó về hàng chờ Review của Giáo viên.

---

### 7. Giải quyết Triệt để Lỗi `chunkText` (Tag-Mixing Bug Fix)

#### Phân tích Lỗi cũ:
Trong phiên bản trước, hàm `chunkText` sử dụng biến cờ `marked = MARK_MARKED.test(src)`. Nếu trong file Word 30 câu chỉ có duy nhất **1 câu chứa thẻ `[Loại:]`**, toàn bộ bộ chia đợt sẽ bật chế độ "có nhãn". Kết quả là **29 câu còn lại không có nhãn bị gộp chung vào câu đầu tiên hoặc bị bỏ sót hoàn toàn** (dẫn đến file 30 câu chỉ chia được 2 đợt thay vì 30 đợt).

#### Giải pháp trong Kiến trúc Chuẩn hóa 2 Bước:
Bước Chuẩn hóa (Step 3) tự động bổ sung cấu trúc khối cho **100% các câu hỏi** trong file trước khi thực hiện chunking. Nhờ đó:
- Loại bỏ hoàn toàn sự phụ thuộc vào cờ `marked`.
- Hàm `chunkText` mới luôn phân đoạn dựa trên ranh giới tiêu chuẩn `\n\n` và chỉ số `Câu n.`, đảm bảo không bao giờ bị nhảy đợt hay nuốt câu.

---

### 8. Thử nghiệm Calibration trên Bộ dữ liệu 600+ Câu mẫu

Để thiết lập ngưỡng tự động duyệt đáp án AI (Auto-Approve Threshold), hệ thống chạy thử nghiệm Calibration trên **600+ câu mẫu đã có đáp án chuẩn**:

```
[600+ Câu mẫu có Đáp án Chuẩn] ──► [Che Đáp án gốc] ──► [AI 3-Pass Solver] ──► [So sánh Đối chiếu]
```

#### Kết quả Calibration & Quy tắc Phân ngưỡng:

| Dạng câu hỏi | Tỉ lệ AI giải đúng (3/3 Consensus) | Tỉ lệ AI giải đúng (2/3 Split) | Quy tắc Phê duyệt Tự động |
|---|---|---|---|
| **TOEIC Part 5 (Ngữ pháp / Từ vựng)** | **98.4%** | 82.1% | Tự động duyệt nếu đạt Đồng thuận $3/3$. |
| **TOEIC Part 6 & 7 (Đọc hiểu Đoạn văn)** | **97.1%** | 76.5% | Tự động duyệt nếu đạt Đồng thuận $3/3$ + Có bằng chứng `evidence_quote`. |
| **ML Lý thuyết & Trắc nghiệm (`mcq`)** | **97.8%** | 80.2% | Tự động duyệt nếu đạt Đồng thuận $3/3$. |
| **ML Tính toán số (`numeric`)** | **99.2%** | 90.1% | Tự động duyệt nếu **Math Calc Verified** khớp kết quả. |
| **ML Đọc code (`mcq` code)** | **99.6%** | 94.0% | Tự động duyệt nếu **Python Sandbox Verified** khớp kết quả. |
| **TOEIC Listening (không có Audio/Lời thoại)** | **N/A** | N/A | Bắt buộc nhập thủ công (AI không tự đoán). |

---

### 9. Quản lý Rủi ro & Lộ trình Triển khai 3 Giai đoạn

#### Bảng Quản lý Rủi ro:

| Rủi ro | Mức độ | Biện pháp Giảm thiểu |
|---|---|---|
| **AI tự ý chỉnh sửa chữ trong đề** | Cao | So khớp từ (Word-level Diff) với bản gốc; chỉ đề xuất sửa, không tự ý ghi đè. |
| **Đáp án AI giải bị sai làm hỏng đề** | Trung bình | Yêu cầu Đồng thuận $3/3$, verify bằng máy (Python/Math), gắn nhãn `🤖 AI Solver` không tính EXP trong game. |
| **Câu hỏi mơ hồ / Đề bài sai** | Thấp | AI bật cờ `is_ambiguous`, gửi cảnh báo lên giao diện và không ép chọn đáp án. |
| **Tốn kém chi phí / Rate Limit API** | Thấp | Lấy đáp án từ Rich Text Word trước (In đậm/Gạch chân); chỉ gọi AI cho các câu chưa có đáp án. |

#### Lộ trình Triển khai 3 Giai đoạn:

- [ ] **Giai đoạn 1 (Ưu tiên cao nhất):**
  - Trích xuất định dạng Word (In đậm, gạch chân, tô màu) bằng `python-docx`.
  - Dựng bộ **AI Solver 3-Pass** có xáo vị trí đáp án và tính điểm đồng thuận.
  - Gắn thẻ nguồn đáp án (`file_text`, `formatting`, `ai_consensus_3_3`).

- [ ] **Giai đoạn 2:**
  - Dựng Engine Chuẩn hóa Cấu trúc và bộ xuất file Word chuẩn (`.docx`).
  - Xây dựng giao diện **Split-Screen Diff UI** cho phép so sánh bản gốc vs. bản chuẩn hóa và duyệt hàng loạt.

- [ ] **Giai đoạn 3:**
  - Mở rộng môi trường kiểm thử máy: **Python Sandbox Executable** và **Math Calculator**.
  - Tích hợp tính năng bóc tách bằng chứng đoạn văn (`evidence_quote`) cho TOEIC Part 7 và đọc ảnh sơ đồ ML bằng Gemini Vision.

---

## 🗺️ Lộ trình Machine Learning & AI (HCMUTE)

Dữ liệu ôn tập Machine Learning được cấu trúc theo 6 giai đoạn của lộ trình HCMUTE (15 tuần):

| # | Giai đoạn | Tuần | Chủ điểm kiến thức | Dạng câu hỏi phù hợp |
|---|---|---|---|---|
| 1 | Toán & Python | 1–2 | Ma trận, Dot Product, NumPy, Đạo hàm, Gradient Descent, Phân phối chuẩn, Định lý Bayes. | `numeric`, `mcq`, `fill`, Đọc code |
| 2 | Dữ liệu & Tiền xử lý | 3–4 | Pandas, Matplotlib, Seaborn, Missing Values, Outliers, Label/One-Hot Encoding, Scaling. | Đọc code, `match`, `multi`, `order` |
| 3 | Học có giám sát | 5–7 | KNN, Decision Tree, SVM, Confusion Matrix, Precision, Recall, F1-Score. | `mcq`, `numeric`, `tf`, `match` |
| 4 | Học không/bán giám sát & Kết hợp | 8–10 | K-Means, PCA, Pseudo-labeling, Label Propagation, Random Forest, XGBoost. | `mcq`, `tf`, `match`, `order` |
| 5 | AI hiện đại & Xu hướng | 11–13 | Transformer, LLMs, RAG (Retrieval-Augmented Generation), Explainable AI (SHAP, LIME), MLOps với FastAPI. | `mcq`, `order`, `fill`, `tf`, Đọc code |
| 6 | Đồ án cuối kỳ | 14–15 | Pipeline xử lý dữ liệu thực tế, tích hợp Semi-Supervised + XGBoost + RAG/FastAPI. | Tình huống, `order` (pipeline), `multi` |

---

## 🏛️ Kiến trúc Hệ thống Fullstack

### 1. Mô hình CSDL (SQLModel / PostgreSQL)

```python
from datetime import datetime
from typing import Optional, Any
from sqlmodel import SQLModel, Field, Column, JSON

class Topic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    subject: str = Field(index=True)          # "toeic" | "ml"
    name: str
    weeks: str = ""
    order: int = 0

class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hash: str = Field(index=True, unique=True) # Chống trùng câu
    subject: str = Field(index=True)          # "toeic" | "ml"
    skill: str = Field(default="general")     # "listening" | "reading" | "writing" | "general"
    topic_id: int = Field(foreign_key="topic.id", index=True)
    type: str = Field(index=True)             # 11 dạng chuẩn
    difficulty: int = 1                       # 1 (dễ) -> 3 (khó)
    stem: str
    passage: Optional[str] = None
    audio_url: Optional[str] = None
    payload: dict = Field(sa_column=Column(JSON))
    explanation: str = ""
    source: str = "import"
    answer_source: str = "file_text"          # file_text | formatting | ai_consensus_3_3 | ai_split
    confidence: float = 1.0
    is_ambiguous: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Mastery(SQLModel, table=True):
    user_id: str = Field(primary_key=True)
    question_id: int = Field(primary_key=True)
    box: int = 1                               # 1 -> 5 (Hộp Leitner)
    due_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    streak: int = 0
```

### 2. Bộ Chấm bài Đa dạng (Server-side Grader)

```python
def grade(qtype: str, payload: dict, resp: Any) -> bool:
    if qtype in ("mcq", "audio_mcq"):
        return resp == payload["answer"]
    if qtype == "multi":
        return set(resp) == set(payload["answer"])
    if qtype == "tf":
        return list(resp) == payload["answer"]
    if qtype == "fill":
        return str(resp).strip().lower() in {a.lower() for a in payload["answers"]}
    if qtype == "numeric":
        try:
            val = float(str(resp).replace(",", "."))
            return abs(val - payload["answer"]) <= payload.get("tolerance", 0.01)
        except ValueError:
            return False
    if qtype == "match":
        return list(resp) == payload["answer"]
    if qtype == "order":
        return list(resp) == list(range(len(payload["steps"])))
    if qtype == "writing_short":
        return all(kw.lower() in str(resp).lower() for kw in payload.get("keywords", []))
    return False
```

---

## 📈 Hệ thống Ôn tập ngắt quãng (SRS Leitner)

> **✅ Đã cài đặt trong app thật (29/10/2026)** — bản Node/Express + PostgreSQL ở thư mục này, không cần bảng `leitner_boxes` riêng: `GET /api/review` suy ra hộp 0–6 trực tiếp từ bảng `attempts` (lần trả lời gần nhất + số lần đúng), thang **ngay → 1 → 3 → 7 → 14 → 30 → 60 ngày**; đúng thì lên hộp, sai rớt về hộp 0. Nút **🗓 Ôn theo lịch — Leitner** ở trang chủ. Chi tiết: [README.md § Ôn theo lịch](README.md#-ôn-theo-lịch--leitner-29102026).

Thuật toán Hộp Leitner được tích hợp để tự động tính thời gian ôn lại dựa trên phong độ người chơi:

| Hộp (Box) | Khoảng thời gian tái ôn | Trạng thái khi trả lời Đúng | Trạng thái khi trả lời Sai |
|---|---|---|---|
| **Hộp 1** | Ôn lại ngay trong ván | Chuyển lên Hộp 2 (sau 1 ngày) | Giữ nguyên Hộp 1 |
| **Hộp 2** | Ôn lại sau 1 ngày | Chuyển lên Hộp 3 (sau 3 ngày) | Rớt về Hộp 1 |
| **Hộp 3** | Ôn lại sau 3 ngày | Chuyển lên Hộp 4 (sau 7 ngày) | Rớt về Hộp 1 |
| **Hộp 4** | Ôn lại sau 7 ngày | Chuyển lên Hộp 5 (sau 14 ngày) | Rớt về Hộp 1 |
| **Hộp 5** | Ôn lại sau 14 ngày | Đạt mức Thuần thục ($+50$ EXP) | Rớt về Hộp 1 |

---

## 🦆 Chế độ đề xuất: Máy bay bắn vịt

### Bố cục Màn hình Canvas (`960 × 540`)
```
┌────────────────────────────────────────────────────────┐
│ Câu 3/10   ♥♥♡          Combo x3          120 EXP  ⏸ 🔊 │  ← HUD
├────────────────────────────────────────────────────────┤
│  The manager ________ the report yesterday.            │  ← Câu hỏi
├────────────────────────────────────────────────────────┤
│  🟡 ───────────────────────────────►                    │  ← Làn vịt vàng (thưởng)
│        ◄─────────── 🦆[ reviewed ]                      │  ← Làn 1 (y = 20%)
│   🦆[ review ]───────────────►                          │  ← Làn 2 (y = 34%)
│        ◄───────── 🦆[ reviews ]                         │  ← Làn 3 (y = 48%)
│   🦆[ reviewing ]────────────►                          │  ← Làn 4 (y = 62%)
│                                                        │
│                         ▲  ← đạn                       │
│                        ✈                               │  ← Máy bay (y = 90%)
└────────────────────────────────────────────────────────┘
```

- **Điều khiển:** Phím mũi tên / `A` `D` (di chuyển), `Space` (bắn). Trên điện thoại: Kéo ngón tay di chuyển, chạm để bắn.
- **Quy tắc đạn:** 3 viên đạn mỗi câu. Bắn trúng vịt mang từ đúng $\rightarrow$ **+10 EXP**, bắn trúng trước 50% màn hình $\rightarrow$ **thưởng thêm +5 EXP**.
- **Vịt vàng (Bonus):** Bay với tốc độ gấp đôi ở làn trên cùng. Bắn trúng giúp hồi 1 Mạng hoặc **+15 EXP**.

---

## 🗂 Cấu trúc Dự án

```
toeic-ml-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # Khởi chạy FastAPI & Middleware
│   │   ├── db.py                # Kết nối CSDL SQLModel
│   │   ├── models.py            # Bảng CSDL (Question, Topic, Attempt, Mastery)
│   │   ├── routers/
│   │   │   ├── questions.py     # Lấy danh sách câu hỏi
│   │   │   ├── answers.py       # Nộp đáp án & chấm điểm
│   │   │   ├── importer.py      # Tải file, Normalizer & AI Resolver
│   │   │   └── progress.py      # Thống kê tiến độ & SRS
│   │   └── services/
│   │       ├── normalizer.py    # Chuẩn hóa văn bản Word & Rich Text Reader
│   │       ├── ai_solver.py     # AI Resolver 3-Pass Permutation & Consensus
│   │       ├── verifiers.py     # Python Sandbox Executable & Math Calc
│   │       ├── docx_exporter.py # Xuất file Word chuẩn hóa (.docx)
│   │       └── srs.py           # Thuật toán Leitner Spaced Repetition
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                 # API Client (Fetch / Axios)
│   │   ├── components/          # KaTeX, AudioPlayer, CodeHighlighter, DiffViewer
│   │   ├── questions/           # Component render cho 11 dạng bài
│   │   ├── pages/               # Home, Roadmap, Play, Result, NormalizationImport
│   │   └── modes/               # ClassicMode, RainMode, DuckMode (Canvas)
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy ứng dụng

### 1. Khởi chạy Backend (FastAPI + Gemini AI)
Yêu cầu: **Python 3.11+** và **Pandoc** (đã cài trong hệ thống).

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Cấu hình API Key
export GEMINI_API_KEY="your_google_gemini_api_key"

# Khởi chạy máy chủ API (Cổng 8000)
uvicorn app.main:app --reload
```
Truy cập Swagger Documentation: `http://localhost:8000/docs`

### 2. Khởi chạy Frontend (React + Vite + TypeScript)
Yêu cầu: **Node.js 18+**

```bash
cd frontend
npm install
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:5173`

---

## 🌐 Triển khai Thực tế (Deployment)

### Backend (Dockerfile)
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends pandoc && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Cấu hình Sản xuất (Production Setup)
- **Frontend:** Triển khai tĩnh trên Vercel, Netlify hoặc GitHub Pages.
- **Backend:** Triển khai container trên Render, Railway hoặc Fly.io.
- **Database:** Chuyển đổi chuỗi kết nối từ SQLite sang **PostgreSQL** thương mại (Supabase, Neon).
- **Security:** Thiết lập `CORS_ORIGINS` chỉ định địa chỉ Frontend và mã hóa kết nối qua **HTTPS**.