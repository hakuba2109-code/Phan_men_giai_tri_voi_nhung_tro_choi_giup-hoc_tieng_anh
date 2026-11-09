-- Thú ảo + Thị trấn: 3 bảng mới (idempotent). Chạy sau CSDL.sql hiện có.
-- M0 PHẢI xác nhận: attempts có cột id tăng dần? created_at là timestamptz?
-- Nếu attempts CHƯA có id (thử trên bản sao dữ liệu trước):
--   ALTER TABLE attempts ADD COLUMN IF NOT EXISTS id bigserial;
-- Gợi ý (tùy chọn) để đồng bộ nhanh:
--   CREATE INDEX IF NOT EXISTS attempts_user_id_id ON attempts (user_id, id);

-- Thú: một hàng cho một tài khoản. user_id 0 = Khách (giống player_progress, KHÔNG có khóa ngoại tới users)
CREATE TABLE IF NOT EXISTS pet_state (
  user_id     integer PRIMARY KEY,
  species     text    NOT NULL,                 -- 'rong' | 'cu' | 'cao' | 'cho' | 'meo' (TownCore.PETS)
  name        text    NOT NULL,                 -- 1–20 ký tự
  rest_until  date,                             -- chế độ nghỉ (đến hết ngày này), NULL = không nghỉ
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Thị trấn: ví xu, cấp từng ô, XP thú, vườn hoa, quà, mốc đồng bộ.
CREATE TABLE IF NOT EXISTS town_state (
  user_id         integer PRIMARY KEY,
  materials       jsonb   NOT NULL DEFAULT '{}',   -- (cũ, không còn dùng) trước đây là vật liệu riêng từng khu — đã gộp sang cột xu
  plots           jsonb   NOT NULL DEFAULT '{}',   -- {"Thì": [1,0,0,0]}          (cấp 0..3 của 4 ô)
  xp              integer NOT NULL DEFAULT 0,      -- XP thú: CHỈ từ sổ cái ôn bài (không tính xu vườn/quà)
  day_state       jsonb   NOT NULL DEFAULT '{}',   -- {"day":"2026-10-31","earned":23,"paid":["q1","q9"]}
  garden          jsonb   NOT NULL DEFAULT '{}',   -- {"beds":[null,{"flower":"tulip","watered":1,"lastWater":"2026-11-01","plantedDay":...}],"gain":{"day":...,"amount":...},"picked":{"tulip":2}}
  treats          jsonb   NOT NULL DEFAULT '{}',   -- {"day":"2026-11-01","given":["cho","meo"]} — đã cho loài nào ăn hôm nay
  last_attempt_id bigint  NOT NULL DEFAULT 0,      -- đã đồng bộ tới lượt trả lời nào
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Cột vườn hoa + sổ cho ăn thêm vào cho các bản CSDL đã tồn tại (idempotent).
ALTER TABLE town_state ADD COLUMN IF NOT EXISTS garden jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE town_state ADD COLUMN IF NOT EXISTS treats jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Sổ cái chỉ thêm: mỗi lượt trả lời trả thưởng tối đa MỘT lần.
CREATE TABLE IF NOT EXISTS town_ledger (
  id         bigserial PRIMARY KEY,
  user_id    integer NOT NULL,
  attempt_id bigint  NOT NULL,
  topic      text    NOT NULL,
  kind       text    NOT NULL,                    -- new | fixed | review | early
  amount     integer NOT NULL CHECK (amount > 0),
  day        date    NOT NULL,
  UNIQUE (user_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS town_ledger_user_day ON town_ledger (user_id, day);

-- Cột mốc thời gian để trộn lịch sử ví cho đúng thứ tự (day chỉ nói "hôm nào", không nói thứ tự trong ngày).
ALTER TABLE town_ledger ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ============================ VÍ XU CHUNG ============================
-- Một ví duy nhất cho toàn bộ trò chơi: bài học + trò chơi + nộp file + quà đăng nhập/chuỗi ngày,
-- và cũng chính ví này tiêu để nâng cấp thị trấn, trồng hoa và chăm cây anh đào.
-- town_ledger (ở trên) vẫn giữ phần "bài học"; vì vậy mỗi dòng town_ledger amount > 0 đều là xu.
ALTER TABLE town_state ADD COLUMN IF NOT EXISTS xu     integer NOT NULL DEFAULT 0 CHECK (xu >= 0);
ALTER TABLE town_state ADD COLUMN IF NOT EXISTS xu_day jsonb   NOT NULL DEFAULT '{}'::jsonb;  -- {"day":"2026-11-03","lesson":30,"game":4,"file":0,"login":0,"streak":0,"rounds":{"duck":2}}
ALTER TABLE town_state ADD COLUMN IF NOT EXISTS gift   jsonb   NOT NULL DEFAULT '{}'::jsonb;  -- {"loginDay":"2026-11-03","streakGranted":[3,7]}

-- "materials" (vật liệu riêng từng khu) đã được đổi thành xu: bộ mã không đọc/ghi nữa,
-- migrateWallet() gộp 1:1 vào cột xu rồi ghi '{}' và để trống cột này cho an toàn (muốn dọn hẳn:
--   ALTER TABLE town_state DROP COLUMN IF EXISTS materials;).
CREATE TABLE IF NOT EXISTS xu_ledger (              -- xu KIẾM được ngoài bài học: chỉ ghi thêm
  id          bigserial   PRIMARY KEY,
  user_id     integer     NOT NULL,
  source      text        NOT NULL CHECK (source IN ('game','file','login','streak','convert','garden','extra','words','wordnew')),
  source_ref  text        NOT NULL,                 -- 'duck:round-id' | 'skill:<mã game>:<ván>' | 'file:<source_files.id>' | 'login:2026-11-03' | 'streak:7' | 'convert:materials' | 'garden:<slot>:<ms>' | 'attempt:<attempts.id>' | 'word:<saved_words.id>:<ngày>' | 'wordnew:<saved_words.id>'
  amount      integer     NOT NULL CHECK (amount > 0),
  day         date        NOT NULL,
  meta        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_ref)              -- một ván/một file/một ngày/một thẻ chỉ thưởng MỘT lần
);
-- 'garden' (thu hoạch vườn) thêm khi bỏ vật liệu riêng từng khu;
-- 'extra' (học thêm sau trần bài học) · 'words' (ôn thẻ từ) · 'wordnew' (lưu từ mới) thêm cùng đợt bảng xu mới.
ALTER TABLE xu_ledger DROP CONSTRAINT IF EXISTS xu_ledger_source_check;
ALTER TABLE xu_ledger ADD CONSTRAINT xu_ledger_source_check
  CHECK (source IN ('game','file','login','streak','convert','garden','extra','words','wordnew'));
CREATE INDEX IF NOT EXISTS xu_ledger_user_day ON xu_ledger (user_id, day);

CREATE TABLE IF NOT EXISTS xu_spend (               -- nhật ký TIÊU xu: xây, mua hạt, chăm cây
  id          bigserial   PRIMARY KEY,
  user_id     integer     NOT NULL,
  kind        text        NOT NULL,                 -- build | seed | sakura | island_upgrade | pet_buy | pet_food | decor_buy | style_buy
  topic       text,                                 -- khu được nâng cấp (kind = build)
  slot        integer,                              -- ô đất / ô vườn
  cost        integer     NOT NULL CHECK (cost > 0),
  xu          integer     NOT NULL CHECK (xu >= 0), -- số dư NGAY SAU khi tiêu
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xu_spend_user_id ON xu_spend (user_id, id DESC);

-- Ván chơi DO MÁY CHỦ cấp: bằng chứng một ván thật sự diễn ra (POST /api/xu/round/start -> /finish).
-- round_id do server sinh nên trình duyệt không tự bịa ra ván để xin xu được; `game` là MÃ NHÓM
-- ('duck' | 'maze' | 'skill:<mã game>') — mỗi mã có hạn số ván/ngày riêng trong TownCore.CONFIG.xu.game.rounds.
-- finished_at NULL = ván đang mở. Mỗi nhóm chỉ có MỘT ván mở tại một thời điểm; mở quá 2 giờ coi như bỏ.
CREATE TABLE IF NOT EXISTS xu_rounds (
  id          bigserial   PRIMARY KEY,
  user_id     integer     NOT NULL,
  round_id    text        NOT NULL,
  game        text        NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  meta        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, round_id)
);
CREATE INDEX IF NOT EXISTS xu_rounds_open ON xu_rounds (user_id, game, finished_at);

