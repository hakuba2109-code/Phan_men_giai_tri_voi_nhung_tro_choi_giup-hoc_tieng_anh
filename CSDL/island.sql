-- Quần đảo vô tận + Nuôi thú cưng: 3 bảng mới (idempotent). Chạy sau CSDL.sql và town.sql.
-- Ví xu KHÔNG nằm ở đây: số dư là town_state.xu (một ví duy nhất, xem README-kinh-te-xu.md),
-- mọi lần tiêu đều ghi vào xu_spend với kind = island_upgrade | pet_buy | pet_food.

-- Tiến độ từng đảo của một tài khoản. "slots" là {"1":[0,0,0,0,0]} — cấp 0..3 của 5 ô.
CREATE TABLE IF NOT EXISTS island_state (
  user_id      integer PRIMARY KEY,                 -- 0 = Khách (không có khóa ngoại tới users, giống town_state)
  current      integer NOT NULL DEFAULT 1 CHECK (current >= 1),
  unlocked     integer NOT NULL DEFAULT 1 CHECK (unlocked >= 1),
  slots        jsonb   NOT NULL DEFAULT '{"1":[0,0,0,0,0]}'::jsonb,
  completed_at jsonb   NOT NULL DEFAULT '{}'::jsonb, -- {"1":"2026-11-03"} — ngày đảo đó đủ 5 ô cấp 3
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Thú đã nuôi. Không có cột nào cho "chết/bỏ đi": satiety/mood có sàn 30, không giới hạn số thú.
CREATE TABLE IF NOT EXISTS pet_owned (
  id         bigserial PRIMARY KEY,
  user_id    integer NOT NULL,
  breed      text    NOT NULL,                      -- khóa trong IslandCore.CONFIG.breeds (kiểm tra ở mã, không CHECK để thêm giống không phải sửa SQL)
  name       text    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
  friend_xp  integer NOT NULL DEFAULT 0 CHECK (friend_xp >= 0),   -- CHỈ tăng
  satiety    numeric NOT NULL DEFAULT 70 CHECK (satiety >= 30 AND satiety <= 100),
  mood       numeric NOT NULL DEFAULT 70 CHECK (mood >= 30 AND mood <= 100),
  day        date    NOT NULL,                      -- ngày_local của hai bộ đếm dưới đây
  meals      integer NOT NULL DEFAULT 0 CHECK (meals >= 0),
  cares      integer NOT NULL DEFAULT 0 CHECK (cares >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pet_owned_user_id ON pet_owned (user_id, id);

-- Kho thức ăn mua bằng xu (xu đã trừ một lần lúc mua, cho ăn không trừ thêm).
CREATE TABLE IF NOT EXISTS pet_pantry (
  user_id    integer PRIMARY KEY,
  items      jsonb   NOT NULL DEFAULT '{}'::jsonb,  -- {"khat":3,"ca":1}
  updated_at timestamptz NOT NULL DEFAULT now()
);

/* ================= 🎨 Trang trí đảo (D2 + D5) =================
   Năm bảng dưới đây KHÔNG có đường nào trả xu lại: mua thì trừ ví (xu_spend kind = decor_buy | style_buy),
   cất đồ về kho thì miễn phí và không hoàn xu. Cất/đặt lại nhiều lần không làm thay đổi decor_owned.
   decor_wish (D5) không liên quan ví: thêm hay xóa món ước đều miễn phí. */

-- Đồ đã mua — thuộc TÀI KHOẢN, đặt được ở mọi đảo. `qty` chỉ tăng bằng POST /decor/buy.
CREATE TABLE IF NOT EXISTS decor_owned (
  user_id    integer   NOT NULL,
  item_key   text      NOT NULL,                    -- khóa trong IslandCore.DECOR_ALL (kiểm ở mã, không CHECK để thêm món không phải sửa SQL)
  qty        integer   NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);

-- Từng món đang đặt. Một dòng = một món ở một tọa độ bám lưới 0,25 (luật 1) trên một đảo đã mở.
-- UNIQUE (user_id, island_index, x, z) chính là luật 8 của đặc tả: mỗi ô lưới chỉ một món.
CREATE TABLE IF NOT EXISTS decor_placed (
  id           bigserial PRIMARY KEY,
  user_id      integer      NOT NULL,
  island_index integer      NOT NULL CHECK (island_index >= 1),
  item_key     text         NOT NULL,
  x            numeric(6,2) NOT NULL CHECK (x * 4 = round(x * 4)),
  z            numeric(6,2) NOT NULL CHECK (z * 4 = round(z * 4)),
  rot          smallint     NOT NULL CHECK (rot BETWEEN 0 AND 7),           -- 8 bước xoay, luật 1
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, island_index, x, z)
);
CREATE INDEX IF NOT EXISTS decor_placed_user_island ON decor_placed (user_id, island_index);

-- Phong cách của TỪNG đảo + phiên bản bố cục.
-- `layout_ver` tăng mỗi lần PUT /decor/layout; trình duyệt gửi lại số nó đang thấy (baseVersion),
-- hai tab cùng lưu thì một thành công, một 409 — không có cảnh bố cục nọ đè bố cục kia.
CREATE TABLE IF NOT EXISTS island_style (
  user_id      integer   NOT NULL,
  island_index integer   NOT NULL CHECK (island_index >= 1),
  weather      text,                              -- khóa DECOR_STYLES kind = weather, hoặc NULL = mặc định của đảo
  tod          text,
  grass        text,
  sky          text,
  layout_ver   integer   NOT NULL DEFAULT 0 CHECK (layout_ver >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, island_index)
);

-- Phong cách đã mở khóa — thuộc TÀI KHOẢN, mua một lần rồi đổi miễn phí giữa các đảo.
CREATE TABLE IF NOT EXISTS style_owned (
  user_id    integer   NOT NULL,
  style_key  text      NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, style_key)
);

/* 📌 Danh sách mong muốn (D5) — ≤10 món, một dòng một món. Trần 10 kiểm bằng MÃ (IslandCore.normWish)
   chứ không bằng CHECK, sau này nới trần chỉ sửa một chỗ. Ước được cả món CHƯA MỞ GÓI:
   danh sách là mục tiêu, không phải cửa hàng — không đường nào trừ xu, không hết hạn, không đếm ngược. */
CREATE TABLE IF NOT EXISTS decor_wish (
  user_id    integer   NOT NULL,
  item_key   text      NOT NULL,
  pos        smallint  NOT NULL DEFAULT 0 CHECK (pos >= 0),  -- thứ tự người chơi thêm; PUT ghi lại cả danh sách nên không bao giờ lệch
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
