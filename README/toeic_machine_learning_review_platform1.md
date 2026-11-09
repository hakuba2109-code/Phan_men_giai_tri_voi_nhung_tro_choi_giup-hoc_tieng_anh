# 🎯 TOEIC & Machine Learning Platform — Web Game & AI Review System

Hệ thống web tương tác ôn tập **TOEIC 3 kỹ năng (Listening, Reading, Writing)** và **Lộ trình Machine Learning & AI hiện đại (15 tuần)**. Ứng dụng kết hợp giữa yếu tố Trò chơi hóa (EXP, Cấp độ, Mạng, Combo, Săn vịt) cùng với **Hệ thống AI Parser (Google Gemini API)** giúp tự động phân tích file Word (`.docx`) chứa câu hỏi, tự động phân loại dạng bài và nạp vào Cơ sở dữ liệu.

> **📌 Ghi chú trạng thái (29/10/2026):** đây là **bản thiết kế** (FastAPI + React). App thật đang chạy trong thư mục này là **Node.js + Express + PostgreSQL** ([README.md](README.md)). Đối chiếu bản thiết kế với app thật:
> * **Bộ Chấm bài Đa dạng** (mục 5.2): **đã có màn chơi cho cả 7 luật** trừ `writing_short` — `multi` so tập đáp án, `tf` so từng mệnh đề, `fill` bỏ hoa thường/dấu cách, `numeric` đổi `,` → `.` và dùng `tolerance` mặc định 0,01, `match`/`order` so thứ tự. Khác thiết kế: chấm chạy **ở client** trong khung trò chơi kỹ năng thay vì endpoint FastAPI.
> * **SRS Leitner** (mục 6): **đã cài đặt**, nhưng **không có bảng `mastery`/cột `box`** — hộp suy ra từ bảng `attempts` hiện có, thang mở rộng tới 60 ngày.
> * **Mô hình CSDL SQLModel, pypandoc, Dockerfile, Triển khai**: chưa dùng; app nhập `.docx` bằng `jszip` + parser riêng.
> * **`writing_short` / `writing_essay`**: vẫn chưa có màn nhập văn bản và AI rubric.

---

## 📌 Mục lục
1. [Tính năng nổi bật](#-tính-năng-nổi-bật)
2. [Cấu trúc 11 Dạng bài & Mô hình CSDL](#-cấu-trúc-11-dạng-bài--mô-hình-csdl)
3. [Quy trình AI Parsing & Nhập đề từ file Word](#-quy-trình-ai-parsing--nhập-đề-từ-file-word)
4. [Lộ trình Machine Learning & AI (HCMUTE)](#-lộ-trình-machine-learning--ai-hcmute)
5. [Kiến trúc Hệ thống Fullstack](#-kiến-trúc-hệ-thống-fullstack)
6. [Hệ thống Ôn tập ngắt quãng (SRS Leitner)](#-hệ-thống-ôn-tập-ngắt-quãng-srs-leitner)
7. [Chế độ đề xuất: Máy bay bắn vịt](#-chế-độ-đề-xuất-máy-bay-bắn-vịt)
8. [Cấu trúc Dự án](#-cấu-trúc-dự-án)
9. [Hướng dẫn Cài đặt & Chạy ứng dụng](#-hướng-dẫn-cài-đặt--chạy-ứng-dụng)
10. [Triển khai Thực tế (Deployment)](#-triển-khai-thực-tế-deployment)

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|---|---|
| **AI Import từ Word** | Tải file `.docx`, `.md`, hoặc `.txt` chứa đề thi ngẫu nhiên (TOEIC Listening/Reading/Writing hoặc ML). AI tự động đọc hiểu, tách câu, phân loại vào 11 dạng bài chuẩn và lưu vào CSDL. |
| **Đa kỹ năng TOEIC** | Ôn tập đầy đủ **Listening** (Audio player), **Reading** (Part 5 trắc nghiệm, Part 6-7 đọc hiểu đoạn văn dài), và **Writing** (Viết câu theo hình/gợi ý, viết Email/Essay với AI Rubric). |
| **Lộ trình ML 15 tuần** | Phủ rộng 6 giai đoạn Machine Learning hiện đại của HCMUTE (Toán/Python, Preprocessing, Supervised, Unsupervised/Ensemble, Modern AI/RAG/XAI/MLOps, Đồ án). |
| **Chế độ Ôn tập ngắt quãng (SRS)** | Thuật toán Leitner 5 hộp tự động lên lịch ôn lại câu sai hoặc câu đến hạn ($1, 3, 7, 14$ ngày). |
| **Đa dạng kiểu chơi** | **Mưa đáp án** (bong bóng rơi), **Trắc nghiệm A–D**, **Tốc độ**, **Trùm 50 câu**, **Máy bay bắn vịt** (Săn vịt), và **Bản đồ Lộ trình**. |
| **Hỗ trợ Công thức & Code** | Đồ họa LaTeX sắc nét cho công thức toán ($F1$, $P$, $R$, $\theta = \theta - \alpha \cdot \nabla J(\theta)$) và tô màu cú pháp code Python/NumPy/Pandas. |

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

Không bắt buộc người dùng tuân theo một quy tắc định dạng cứng nhắc, hệ thống kết hợp **`pypandoc`** và **`Google Gemini API`** để tự động đọc hiểu đề thi từ file Word.

```
┌─────────────────┐      Tải file .docx       ┌─────────────────────────────────────────┐
│ File Word (.docx│ ────────────────────────> │ Backend (FastAPI)                       │
│ TOEIC / ML      │                           │  1. Đọc văn bản bằng pypandoc           │
└─────────────────┘                           │  2. Gửi Prompt + Text sang Gemini AI    │
                                              └────────────────────┬────────────────────┘
                                                                   │ AI Phân tích & Trả về JSON
                                                                   ▼
┌─────────────────┐      Xác nhận lưu DB      ┌─────────────────────────────────────────┐
│ Frontend        │ ◄──────────────────────── │ JSON Struct:                            │
│ (Preview & Edit)│                           │ - Phân loại skill (Listen/Read/Write/ML)│
└─────────────────┘                           │ - Phân loại type (11 dạng chuẩn)        │
                                              │ - Trích xuất stem, options, payload...  │
                                              └─────────────────────────────────────────┘
```

### 1. Luồng xử lý chi tiết tại Backend
1. **Trích xuất văn bản:** Backend nhận file `.docx`, dùng `pypandoc` để chuyển thành Plain Text nhằm giữ nguyên số thứ tự danh sách tự động và cấu trúc đoạn văn.
2. **AI Classification (Gemini 1.5 Pro):** Đưa toàn bộ văn bản vào Gemini AI với Prompt chuyên biệt để:
   - Nhận diện môn học (`subject`: `toeic` | `ml`) và kỹ năng (`skill`: `listening` | `reading` | `writing` | `general`).
   - Gán đúng `type` trong 11 dạng câu hỏi.
   - Trích xuất tiêu đề (`stem`), đoạn văn kèm theo (`passage`), âm thanh (`audio_url`), mảng lựa chọn (`options`), và tạo ra `payload` tương ứng.
3. **Xem trước (Preview) & Ghi DB:** Trả dữ liệu JSON xem trước lên Frontend. Sau khi người dùng xác nhận, Backend tạo mã `hash` để loại bỏ câu trùng lặp và lưu vào CSDL.

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
        # Chấm theo từ khóa hoặc mẫu
        return all(kw.lower() in str(resp).lower() for kw.join(payload.get("keywords", [])))
    return False
```

---

## 📈 Hệ thống Ôn tập ngắt quãng (SRS Leitner)

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
│   │   │   ├── importer.py      # Tải file & AI Parser (Gemini API)
│   │   │   └── progress.py      # Thống kê tiến độ & SRS
│   │   └── services/
│   │       ├── ai_parser.py     # Đọc văn bản word bằng pypandoc & Gemini Prompt
│   │       ├── grader.py        # Chấm điểm 11 dạng bài
│   │       └── srs.py           # Thuật toán Leitner Spaced Repetition
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                 # API Client (Fetch / Axios)
│   │   ├── components/          # KaTeX, AudioPlayer, CodeHighlighter
│   │   ├── questions/           # Component render cho 11 dạng bài
│   │   ├── pages/               # Home, Roadmap, Play, Result, Import
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