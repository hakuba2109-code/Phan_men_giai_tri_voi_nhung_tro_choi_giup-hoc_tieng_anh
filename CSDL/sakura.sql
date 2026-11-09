-- Đảo hoa anh đào: 3 bảng mới (idempotent). Chạy sau CSDL.sql hiện có.
-- M0 PHẢI xác nhận: attempts có cột id tăng dần? created_at là timestamptz?
-- Nếu attempts CHƯA có id (thử trên bản sao dữ liệu trước):
--   ALTER TABLE attempts ADD COLUMN IF NOT EXISTS id bigserial;
-- Gợi ý (tùy chọn) để đồng bộ nhanh:
--   CREATE INDEX IF NOT EXISTS attempts_user_id_id ON attempts (user_id, id);
-- user_id = 0 là Khách. Không dùng khóa ngoại để Khách cũng chơi được.

-- Trạng thái cây của mỗi người: xu đang có, điểm sinh trưởng (0..900), mốc đồng bộ attempts.
CREATE TABLE IF NOT EXISTS sakura_state (
  user_id         integer     PRIMARY KEY,
  coins           integer     NOT NULL DEFAULT 0   CHECK (coins >= 0),
  points          integer     NOT NULL DEFAULT 0   CHECK (points >= 0 AND points <= 900),
  total_earned    integer     NOT NULL DEFAULT 0   CHECK (total_earned >= 0),
  last_attempt_id bigint      NOT NULL DEFAULT 0,
  day_state       jsonb       NOT NULL DEFAULT '{}',
  enabled         boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Sổ cái xu kiếm được: mỗi lượt trả lời được thưởng đúng MỘT lần (UNIQUE) => đồng bộ lặp lại không thưởng hai lần.
CREATE TABLE IF NOT EXISTS sakura_ledger (
  id          bigserial   PRIMARY KEY,
  user_id     integer     NOT NULL,
  attempt_id  bigint      NOT NULL,
  topic       text        NOT NULL,
  kind        text        NOT NULL,
  amount      integer     NOT NULL CHECK (amount > 0),
  day         date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS sakura_ledger_user_id ON sakura_ledger (user_id, id DESC);

-- Nhật ký chăm cây (tưới / bón): chỉ ghi thêm, không bao giờ sửa hay xóa.
CREATE TABLE IF NOT EXISTS sakura_care (
  id          bigserial   PRIMARY KEY,
  user_id     integer     NOT NULL,
  action      text        NOT NULL CHECK (action IN ('water','fertilize')),
  cost        integer     NOT NULL CHECK (cost > 0),
  points      integer     NOT NULL CHECK (points > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sakura_care_user_id ON sakura_care (user_id, id DESC);
