-- ============================================================================
-- CSDL: gameEnglish (PostgreSQL 15)
-- Web game ôn TOEIC Giai đoạn 1 — lưu file Word và ngân hàng câu hỏi
-- Chạy: node src/schema.js          (tự áp dụng, idempotent)
-- hoặc: "C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gameEnglish -f CSDL/CSDL.sql
-- ============================================================================

-- 1. File Word gốc được đưa vào CSDL, giữ cả nội dung nhị phân để tải lại
CREATE TABLE IF NOT EXISTS source_files (
  id              SERIAL PRIMARY KEY,
  filename        TEXT        NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'import',   -- boss | main | import
  content         BYTEA       NOT NULL,                    -- file .docx/.md/.txt gốc
  raw_text        TEXT,                                    -- văn bản trích xuất từ file
  sha256          TEXT        NOT NULL,
  size_bytes      INTEGER     NOT NULL DEFAULT 0,
  question_count  INTEGER     NOT NULL DEFAULT 0,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sha256, filename)
);

-- 1b. Mỗi bộ đề thuộc một tài khoản (0 = "khách" của máy này) để hai tài khoản không thấy bộ đề của nhau
ALTER TABLE source_files ADD COLUMN IF NOT EXISTS owner_id INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS source_files_owner_idx ON source_files (owner_id);
-- Khóa chống trùng đổi từ (sha256, filename) sang (owner_id, sha256, filename):
-- hai tài khoản được nhập cùng một file Word, mỗi người giữ một bộ riêng.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_files_owner_sha_filename_key') THEN
    ALTER TABLE source_files DROP CONSTRAINT IF EXISTS source_files_sha256_filename_key;
    ALTER TABLE source_files ADD CONSTRAINT source_files_owner_sha_filename_key UNIQUE (owner_id, sha256, filename);
  END IF;
END $$;

-- 2. Chủ điểm (Thì, Từ loại, Giới từ, Đại từ, Từ vựng, hoặc chủ điểm mới do người dùng nhập)
CREATE TABLE IF NOT EXISTS topics (
  name        TEXT PRIMARY KEY,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ngân hàng câu hỏi
CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,                            -- băm từ nội dung câu + 4 đáp án
  topic         TEXT NOT NULL REFERENCES topics(name) ON UPDATE CASCADE ON DELETE RESTRICT,
  question      TEXT NOT NULL,
  options       TEXT[] NOT NULL CHECK (array_length(options, 1) = 4),
  answer_index  SMALLINT NOT NULL CHECK (answer_index >= 0 AND answer_index <= 3),
  note          TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'import',              -- boss | main | import
  number        INTEGER,                                     -- số thứ tự trong file gốc
  file_id       INTEGER REFERENCES source_files(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS questions_topic_idx   ON questions (topic);
CREATE INDEX IF NOT EXISTS questions_source_idx  ON questions (source);

-- 3b. Mở rộng cho 11 dạng bài của bộ phân tích AI (idempotent, giữ nguyên câu đã có)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS qtype      TEXT     NOT NULL DEFAULT 'mcq';  -- 1 dạng trong 11 dạng chuẩn
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject    TEXT     NOT NULL DEFAULT 'toeic'; -- toeic | ml
ALTER TABLE questions ADD COLUMN IF NOT EXISTS skill      TEXT     NOT NULL DEFAULT 'reading';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty SMALLINT NOT NULL DEFAULT 1;       -- 1 dễ -> 3 khó
ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage    TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_url  TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS payload    JSONB    NOT NULL DEFAULT '{}'::jsonb;

-- 3c. Trạng thái thẩm định của câu do AI tách: 'ok' vào game, 'review' chờ người kiểm tra
ALTER TABLE questions ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3d. Giải thích bằng AI cho từng câu (không ghi đè cột note vốn là ghi chú nghĩa từ)
--     explanation_status: none (chưa có) | draft (AI viết, chờ duyệt) | approved (được hiện trong game)
--                         | rejected (bị bỏ) | disputed (AI nghi đáp án sai, hoặc người chơi báo sai)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation        JSONB;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_model  TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_at     TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS questions_explanation_status_idx ON questions (explanation_status);

-- 3e. Sổ kiểm tra đáp án: AI giải lại câu hỏi mà KHÔNG thấy đáp án đang lưu
--     action = agree (khớp) | fix (đã sửa answer_index) | review (lệch nhưng chưa đủ tin cậy)
--     stored_index là đáp án CŨ, đủ để hoàn tác một lần sửa.
CREATE TABLE IF NOT EXISTS answer_key_checks (
  question_id  TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  ai_index     SMALLINT,
  stored_index SMALLINT,
  confidence   TEXT,
  reason       TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL DEFAULT 'agree',
  model        TEXT,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE answer_key_checks ADD COLUMN IF NOT EXISTS critique_ok    BOOLEAN;
ALTER TABLE answer_key_checks ADD COLUMN IF NOT EXISTS critique_index SMALLINT;
ALTER TABLE answer_key_checks ADD COLUMN IF NOT EXISTS manual_index   SMALLINT;  -- đáp án do người sửa tay chọn (khác gợi ý AI)
CREATE INDEX IF NOT EXISTS answer_key_checks_action_idx ON answer_key_checks (action);

-- 3f. Dữ liệu riêng cho "Trò chơi theo kỹ năng" nằm trong cột payload (JSONB), không thêm cột:
--     audio_mcq     -> { transcript, audio_url, options, answer }
--     passage_mcq   -> { group_id, sentences, evidence, options, answer }
--     writing_fix   -> { chunks: [{ t, fixes, answer }] }
--     writing_order -> { words: [...] }

-- 3g. "Gia sư AI" theo câu: bản dịch tiếng Việt + lý do loại từng đáp án sai.
--     MỘT câu chỉ gọi Gemini MỘT LẦN rồi tái sử dụng mãi (khác với explanation ở 3d,
--     vốn viết theo lô bằng CLI). Nội dung KHÔNG phụ thuộc đáp án người chơi đã chọn,
--     nên một hàng dùng được cho mọi tài khoản và mọi lần bấm -> chi phí không tăng theo lượt chơi.
--     coach = { stem_vi, options_vi: [...], why: [{ i, why }] }
ALTER TABLE questions ADD COLUMN IF NOT EXISTS coach       JSONB;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS coach_model TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS coach_tokens SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS coach_at    TIMESTAMPTZ;

-- 3h. Bản dịch câu hỏi + đáp án hiện ngay trong khối 💡 (rẻ hơn "Gia sư AI" vì không hỏi vì sao sai).
--     MỘT câu chỉ gọi Gemini MỘT LẦN; câu đã có coach thì lấy luôn stem_vi/options_vi của coach,
--     không gọi thêm. translation = { stem_vi, options_vi: [...] }
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translation         JSONB;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translation_model   TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translation_tokens  SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translation_at      TIMESTAMPTZ;

-- Cho phép câu hỏi trống đáp án (fill/order/writing) nên không bắt buộc options & answer_index
ALTER TABLE questions ALTER COLUMN options      DROP NOT NULL;
ALTER TABLE questions ALTER COLUMN answer_index DROP NOT NULL;

-- Bỏ ràng buộc "bắt buộc 4 đáp án A–D" để chứa được multi / tf / fill / numeric / match / order
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_options_check;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_answer_index_check;
DO $$ BEGIN
  ALTER TABLE questions ADD CONSTRAINT questions_options_check
    CHECK (options IS NULL OR array_length(options, 1) <= 6);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE questions ADD CONSTRAINT questions_answer_index_check
    CHECK (answer_index IS NULL OR (answer_index >= 0 AND answer_index <= 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS questions_qtype_idx   ON questions (qtype);
CREATE INDEX IF NOT EXISTS questions_subject_idx ON questions (subject);
-- Lọc nhanh câu theo kỹ năng cho "Trò chơi theo kỹ năng" (Reading / Listening / Writing)
CREATE INDEX IF NOT EXISTS questions_skill_idx   ON questions (skill);

-- 4. Tiến độ người chơi (idempotent: một hàng cho một tài khoản, user_id = 0 là "khách trên máy này")
CREATE TABLE IF NOT EXISTS player_progress (
  id         SMALLINT PRIMARY KEY DEFAULT 1,
  nickname   TEXT    NOT NULL DEFAULT 'Người chơi',
  exp        INTEGER NOT NULL DEFAULT 0,
  level      INTEGER NOT NULL DEFAULT 1,
  mastered   TEXT[]  NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Câu đang cần ôn (làm sai, tự xoá khi trả lời đúng lại)
CREATE TABLE IF NOT EXISTS wrong_answers (
  question_id   TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  times_wrong   INTEGER NOT NULL DEFAULT 1,
  last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Nhật ký từng lượt trả lời, dùng cho thống kê
CREATE TABLE IF NOT EXISTS attempts (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  correct     BOOLEAN NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'practice',              -- stage | speed | boss | review | rain | quiz
  exp_gained  INTEGER NOT NULL DEFAULT 0,
  seconds     NUMERIC(6,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attempts_question_idx ON attempts (question_id);
CREATE INDEX IF NOT EXISTS attempts_created_idx  ON attempts (created_at DESC);

-- ============================================================================
-- 7. TÀI KHOẢN: đăng ký / đăng nhập
--    Mật khẩu chỉ lưu dưới dạng băm scrypt, token phiên chỉ lưu sha256.
--    user_id = 0 là tiến độ "khách" của máy này (dữ liệu có trước khi có tài khoản).
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT    NOT NULL,                            -- luôn lưu chữ thường
  password_hash TEXT    NOT NULL,                            -- scrypt$<salt-hex>$<hash-hex>
  nickname      TEXT    NOT NULL DEFAULT 'Người chơi',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,                               -- sha256 của token trong cookie
  user_id    INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- 7b. Gắn tiến độ / câu sai / nhật ký theo tài khoản (them cot, khong xoa du lieu cu)
ALTER TABLE player_progress ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wrong_answers   ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts        ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0;

-- player_progress: khoa chinh chuyen tu (id) sang (user_id); id chi con la cot cu, bang user_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                 WHERE c.conname = 'player_progress_pkey' AND c.conrelid = 'player_progress'::regclass) THEN
    ALTER TABLE player_progress ADD CONSTRAINT player_progress_pkey PRIMARY KEY (user_id);
  ELSIF (SELECT c.conkey FROM pg_constraint c
         WHERE c.conname = 'player_progress_pkey' AND c.conrelid = 'player_progress'::regclass) = ARRAY[1]::int2[] THEN
    ALTER TABLE player_progress DROP CONSTRAINT player_progress_pkey;
    ALTER TABLE player_progress ADD CONSTRAINT player_progress_pkey PRIMARY KEY (user_id);
  END IF;
END $$;
UPDATE player_progress SET id = user_id WHERE id IS DISTINCT FROM user_id;
ALTER TABLE player_progress ALTER COLUMN id SET DEFAULT 0;

-- wrong_answers: cung mot cau sai co the thuoc ve nhieu tai khoan
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_constraint c ON c.conindid = i.indexrelid
                 WHERE c.conname = 'wrong_answers_pkey' AND i.indnatts = 2) THEN
    ALTER TABLE wrong_answers DROP CONSTRAINT IF EXISTS wrong_answers_pkey;
    ALTER TABLE wrong_answers ADD CONSTRAINT wrong_answers_pkey PRIMARY KEY (user_id, question_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wrong_answers_user_idx ON wrong_answers (user_id, last_wrong_at DESC);
CREATE INDEX IF NOT EXISTS attempts_user_idx      ON attempts (user_id, created_at DESC);

-- Hang "khach" luo ton tai de GET/POST /api/progress luon co cho ghi
INSERT INTO player_progress (id, user_id, nickname) VALUES (0, 0, 'Người chơi')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 8. MÊ CUNG KHO BÁU: ván chơi, nhật ký trận đánh, chứng chỉ
--    Idempotent: chạy lại CSDL.sql nhiều lần không lỗi, không mất dữ liệu cũ.
-- ============================================================================

-- 8a. Ván chơi. state = đối tượng `run` của src/dungeon-rules.js.
--     Chỉ MỘT ván 'active' cho mỗi (người, bộ đề, chặng).
CREATE TABLE IF NOT EXISTS dungeon_runs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL DEFAULT 0,               -- 0 = Khách của máy này (như các bảng khác)
  file_id     INTEGER REFERENCES source_files(id) ON DELETE SET NULL, -- giữ ván đã xong để chứng chỉ còn đối chiếu được mã
  segment     INTEGER NOT NULL DEFAULT 1,
  segments    INTEGER NOT NULL DEFAULT 1,
  snapshot    TEXT    NOT NULL,                         -- sha256 của danh sách id câu đã sắp xếp
  state       JSONB   NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS dungeon_runs_one_active
  ON dungeon_runs (user_id, file_id, segment) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS dungeon_runs_user_idx ON dungeon_runs (user_id, status);

-- Nếu bảng được tạo ở bản cũ với ON DELETE CASCADE thì đổi sang SET NULL
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'dungeon_runs_file_id_fkey'
                AND conrelid = 'dungeon_runs'::regclass
                AND confdeltype = 'c') THEN
    ALTER TABLE dungeon_runs DROP CONSTRAINT dungeon_runs_file_id_fkey;
    ALTER TABLE dungeon_runs ADD CONSTRAINT dungeon_runs_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES source_files(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8b. Nhật ký trận đánh (chỉ thêm, không sửa): bằng chứng cho chứng chỉ.
CREATE TABLE IF NOT EXISTS dungeon_fights (
  id          BIGSERIAL PRIMARY KEY,
  run_id      BIGINT  NOT NULL REFERENCES dungeon_runs(id) ON DELETE CASCADE,
  question_id TEXT,                                     -- có thể NULL nếu câu bị xóa sau đó
  choice      INTEGER,                                  -- chỉ số đáp án GỐC người chơi chọn
  correct     BOOLEAN NOT NULL,
  hinted      BOOLEAN NOT NULL DEFAULT FALSE,
  floor_no    INTEGER NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dungeon_fights_run ON dungeon_fights (run_id);

-- 8c. Chứng chỉ: bản chép tên bộ đề để xóa bộ đề vẫn còn giấy.
CREATE TABLE IF NOT EXISTS certificates (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,                  -- TC-XXXX-XXXX-XXXX
  user_id     INTEGER NOT NULL DEFAULT 0,
  file_id     INTEGER REFERENCES source_files(id) ON DELETE SET NULL,
  run_id      BIGINT  REFERENCES dungeon_runs(id) ON DELETE SET NULL,
  snapshot    TEXT    NOT NULL,
  segment     INTEGER NOT NULL DEFAULT 1,
  segments    INTEGER NOT NULL DEFAULT 1,
  holder_name TEXT    NOT NULL,
  file_title  TEXT    NOT NULL,
  total       INTEGER NOT NULL,
  first_try   INTEGER NOT NULL,
  assisted    INTEGER NOT NULL,
  medal       TEXT    NOT NULL CHECK (medal IN ('gold','silver','bronze')),
  started_at  TIMESTAMPTZ,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, file_id, segment, snapshot)
);
CREATE INDEX IF NOT EXISTS certificates_user_idx ON certificates (user_id, issued_at DESC);

-- ==========================================================================
-- 9. TRA CỨU BÔI ĐEN (Alt+Z / Alt+X) + SỔ TỪ
-- ==========================================================================

-- 9a. Cache tra cứu dùng chung cho mọi tài khoản.
--     content_hash = sha256(schema_version | layer | src>dst | nội dung đã chuẩn hóa)
--     KHÔNG chứa thông tin riêng của tài khoản (saved/confusables phủ lúc trả lời).
CREATE TABLE IF NOT EXISTS lookup_cache (
  content_hash   TEXT PRIMARY KEY,
  layer          SMALLINT NOT NULL CHECK (layer IN (1, 2)),
  payload        JSONB    NOT NULL,
  source         TEXT,
  schema_version INTEGER  NOT NULL,
  hits           INTEGER  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lookup_cache_layer ON lookup_cache (layer, created_at DESC);

-- 9b. Sổ từ theo tài khoản + lịch ôn Leitner (hạn tính theo ngày địa phương).
CREATE TABLE IF NOT EXISTS saved_words (
  id             BIGSERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL DEFAULT 0,
  text_norm      TEXT    NOT NULL,
  text_display   TEXT    NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('word', 'phrase')),
  meaning_vi     TEXT,
  ipa            TEXT,
  context        TEXT,
  box            SMALLINT NOT NULL DEFAULT 0 CHECK (box BETWEEN 0 AND 5),
  due_at         TIMESTAMPTZ NOT NULL,
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, text_norm)
);
CREATE INDEX IF NOT EXISTS saved_words_due ON saved_words (user_id, due_at);
