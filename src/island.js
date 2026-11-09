"use strict";

/* BACKEND "Quần đảo vô tận + Nuôi thú cưng". Gắn vào server.js SAU middleware gán req.userId:

     const island = require("./island");
     app.use("/api/islands", island.createIslandRouter({ db }));

   Luật (giá, trần, điều kiện mở đảo) nằm ở island-core.js — giao diện dùng lại đúng file đó.
   Ví xu là town_state.xu (xem xu.js): đảo và thú CHỈ tiêu xu, không nguồn thu nào ghi vào đây.
   Mỗi lần tiêu là một giao dịch có SELECT … FOR UPDATE trên dòng ví nên hai cú bấm cùng lúc
   không làm số dư âm; lỗi 409 thì không có gì bị trừ và cảnh 3D giữ nguyên. */
const express = require("express");
const IslandCore = require("./island-core");
const xu = require("./xu");
const TownCore = require("./town-core");

const C = IslandCore.CONFIG;
const httpError = (status, message) => Object.assign(new Error(message), { status });
const uidOf = xu.uidOf;

const PET_NAMES = ["Bơ", "Mì", "Cốm", "Đậu", "Kem", "Tiêu", "Xám", "Nâu", "Mực", "Đen", "Dâu", "Sữa"];

async function ensureRow(client, userId) {
  await client.query(`INSERT INTO island_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  await client.query(`INSERT INTO pet_pantry (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
}

async function readState(client, userId) {
  const row = (await client.query(
    `SELECT current, unlocked, slots, completed_at FROM island_state WHERE user_id = $1 FOR UPDATE`, [userId]
  )).rows[0];
  return { current: row.current, unlocked: row.unlocked, slots: row.slots || {}, completedAt: row.completed_at || {} };
}

async function readPets(client, userId) {
  return (await client.query(
    `SELECT id, breed, name, friend_xp AS "friendXp", satiety, mood, to_char(day, 'YYYY-MM-DD') AS day,
            meals, cares, updated_at AS "updatedAt"
       FROM pet_owned WHERE user_id = $1 ORDER BY id`, [userId]
  )).rows.map((p) => ({
    id: Number(p.id), breed: p.breed, name: p.name, friendXp: Number(p.friendXp),
    satiety: Number(p.satiety), mood: Number(p.mood), day: p.day, meals: p.meals, cares: p.cares, updatedAt: p.updatedAt,
  }));
}

async function readPantry(client, userId) {
  return (await client.query(`SELECT items FROM pet_pantry WHERE user_id = $1`, [userId])).rows[0].items || {};
}

/* ---------- 🎨 trang trí ---------- */
/* Bốn bảng trang trí + bảng ước muốn (D5), đọc một lần cho cả giao diện:
   owned      = số cái ĐÃ MUA theo tài khoản, total = số cái ĐANG ĐẶT trên mọi đảo cộng lại,
   placed     = danh sách món đang đặt theo từng đảo (kèm tọa độ và hướng xoay),
   styles     = bốn nhánh phong cách + `layoutVer` của từng đảo — đảo chưa lưu bao giờ thì chưa có dòng,
                giao diện coi như 0 (đúng số server trả khi PUT thành công lần đầu),
   styleOwned = danh sách phong cách đã mở khóa cho cả tài khoản,
   wish       = tối đa 10 món người chơi đánh dấu "muốn có", xếp theo thứ tự thêm vào. */
async function readDecor(client, userId) {
  const owned = {}, total = {}, placed = {}, styles = {};
  for (const r of (await client.query(`SELECT item_key, qty FROM decor_owned WHERE user_id = $1`, [userId])).rows) owned[r.item_key] = Number(r.qty);
  for (const r of (await client.query(
    `SELECT island_index, item_key, x, z, rot FROM decor_placed WHERE user_id = $1 ORDER BY island_index, id`, [userId]
  )).rows) {
    (placed[r.island_index] = placed[r.island_index] || []).push({ item: r.item_key, x: Number(r.x), z: Number(r.z), rot: r.rot });
    total[r.item_key] = (total[r.item_key] || 0) + 1;
  }
  for (const r of (await client.query(
    `SELECT island_index, weather, tod, grass, sky, layout_ver AS "layoutVer" FROM island_style WHERE user_id = $1 ORDER BY island_index`, [userId]
  )).rows) styles[r.island_index] = { weather: r.weather, tod: r.tod, grass: r.grass, sky: r.sky, layoutVer: Number(r.layoutVer) };
  const styleOwned = (await client.query(`SELECT style_key FROM style_owned WHERE user_id = $1 ORDER BY style_key`, [userId])).rows.map((r) => r.style_key);
  const wish = (await client.query(`SELECT item_key FROM decor_wish WHERE user_id = $1 ORDER BY pos, item_key`, [userId])).rows.map((r) => r.item_key);
  return { owned, total, placed, styles, styleOwned, wish };
}

/* Đảm bảo dòng island_style của một đảo tồn tại để còn khóa và ghi phong cách. */
async function ensureStyleRow(client, userId, island) {
  await client.query(
    `INSERT INTO island_style (user_id, island_index) VALUES ($1, $2) ON CONFLICT (user_id, island_index) DO NOTHING`, [userId, island]
  );
}

/* Số phiên bản bố cục đang lưu của một đảo (0 nếu đảo chưa từng được lưu bố cục).
   Không cần khóa ở đây: PUT layout đã chiếm dòng island_state của đúng tài khoản này bằng
   SELECT … FOR UPDATE (readState) nên hai cú lưu cùng lúc tự xếp hàng trước khi đọc số này. */
async function readLayoutVer(client, userId, island) {
  const r = (await client.query(
    `SELECT layout_ver FROM island_style WHERE user_id = $1 AND island_index = $2`, [userId, island]
  )).rows[0];
  return r ? Number(r.layout_ver) : 0;
}

/* Bản đồ item_key → còn đặt được bao nhiêu cái (luật 2 của đặc tả: cộng trên MỌI đảo không vượt số đã mua).
     exceptIsland = đảo sắp ghi đè: đồ đang nằm trên chính nó được tính lại từ bố cục mới, nên không bị trừ khỏi ngân sách.
     Món chưa mở điều kiện thì 0, giao diện khỏi phải suy ra từ điều kiện khóa. */
function slotBudget(decor, slots, exceptIsland) {
  const out = {};
  for (const it of IslandCore.DECOR_ALL) out[it.k] = IslandCore.itemLockedReason(it, slots || {}) ? 0 : IslandCore.int(decor.owned[it.k]);
  for (const [key, n] of Object.entries(decor.total || {})) out[key] = Math.max(0, (out[key] || 0) - n);
  if (exceptIsland !== undefined)
    for (const p of decor.placed[exceptIsland] || []) out[p.item] = (out[p.item] || 0) + 1;
  return out;
}

/* Toàn bộ những gì giao diện cần: ví thật (đã đồng bộ bài học + quà) + đảo + thú + kho + catalog giá + trang trí. */
async function buildView(client, userId) {
  const synced = await xu.syncLessons(client, userId);
  const gifts = await xu.dailyGifts(client, userId);
  const today = TownCore.dayKey(Date.now(), xu.tz());
  const income = await xu.todayIncome(client, userId, today);
  await ensureRow(client, userId);
  const state = await readState(client, userId);
  const decor = await readDecor(client, userId);
  return IslandCore.stateView({
    today, zone: xu.tz(), ts: Date.now(),
    balance: gifts.xu, income,
    left: {
      lesson: TownCore.room(TownCore.CONFIG.dailyCap, synced.dayState.day === today ? synced.dayState.earned : 0),
      game: TownCore.room(TownCore.CONFIG.xu.game.cap, income.game),
      file: TownCore.room(TownCore.CONFIG.xu.file.cap, income.file),
    },
    lessonCap: TownCore.CONFIG.dailyCap,
    gift: { length: gifts.length, next: gifts.next, loginDay: gifts.granted.loginDay },
    state, pets: await readPets(client, userId), pantry: await readPantry(client, userId),
    decor: Object.assign({}, decor, { left: slotBudget(decor, state.slots) }), // left toàn cục — chưa trừ đảo đang sửa; giao diện suy thêm từ placed/total
  });
}

function write(client, userId, patch) {
  return client.query(
    `UPDATE town_state SET xu = $2, updated_at = now() WHERE user_id = $1`, [userId, patch]
  );
}

async function savePet(client, pet) {
  await client.query(
    `UPDATE pet_owned SET name = $2, friend_xp = $3, satiety = $4, mood = $5, day = $6::date, meals = $7, cares = $8, updated_at = now()
      WHERE id = $1 AND user_id = $9`,
    [pet.id, pet.name, Math.round(pet.friendXp || 0), Math.round(pet.satiety), Math.round(pet.mood), pet.day, pet.meals || 0, pet.cares || 0, pet.user_id]
  );
}

function createIslandRouter({ db } = {}) {
  if (!db || typeof db.withTransaction !== "function") throw new Error("createIslandRouter cần db.withTransaction");
  const router = express.Router();
  router.use(express.json({ limit: "10kb" }));

  const route = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      const status = err.status && err.status < 500 ? err.status : 500;
      if (status === 500) console.error("[island]", err);
      // err.errors: danh sách lý do chi tiết (bố cục trang trí) — giao diện tô đỏ từng món, người lớn chỉ cần dòng error.
      const body = { error: status === 500 ? "Lỗi máy chủ, bạn thử lại sau nhé." : err.message };
      if (status !== 500 && err.errors) body.errors = err.errors;
      res.status(status).json(body);
    });

  router.get("/", route(async (req, res) => {
    const uid = uidOf(req);
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      return buildView(client, uid);
    }));
  }));

  /* Nâng một ô đất của đảo đang đứng: server tính giá theo số đảo, trừ ví, mở đảo kế khi đủ 5 ô cấp 3. */
  router.post("/upgrade", route(async (req, res) => {
    const uid = uidOf(req), slot = (req.body || {}).slot;
    if (typeof slot !== "number" || !Number.isInteger(slot)) throw httpError(400, "Thiếu số ô đất cần nâng.");
    res.json(await db.withTransaction(async (client) => {
      const today = TownCore.dayKey(Date.now(), xu.tz());
      await xu.syncLessons(client, uid); // khóa dòng town_state: hai cú bấm xếp hàng
      const gifts = await xu.dailyGifts(client, uid);
      await ensureRow(client, uid);
      const state = await readState(client, uid);
      let r;
      try { r = IslandCore.upgrade(state, gifts.xu, slot, today); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await client.query(
        `UPDATE island_state SET current = $2, unlocked = $3, slots = $4, completed_at = $5, updated_at = now() WHERE user_id = $1`,
        [uid, r.state.current, r.state.unlocked, JSON.stringify(r.state.slots), JSON.stringify(r.state.completedAt)]
      );
      await write(client, uid, r.xu);
      await xu.spend(client, uid, "island_upgrade", r.cost, { topic: `island-${r.island}`, slot: r.slot, xuAfter: r.xu });
      const view = await buildView(client, uid);
      return Object.assign(view, {
        result: { cost: r.cost, level: r.level, slot: r.slot, slotName: r.slotName, island: r.island, completed: r.completed, nextIsland: r.nextIsland },
      });
    }));
  }));

  router.post("/travel", route(async (req, res) => {
    const uid = uidOf(req), index = (req.body || {}).index;
    if (typeof index !== "number") throw httpError(400, "Thiếu số đảo cần đến.");
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      const state = await readState(client, uid);
      let r;
      try { r = IslandCore.travel(state, index); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await client.query(
        `UPDATE island_state SET current = $2, slots = $3, updated_at = now() WHERE user_id = $1`,
        [uid, r.state.current, JSON.stringify(r.state.slots)]
      );
      return buildView(client, uid);
    }));
  }));

  /* Nhận nuôi thú: giá niêm yết theo giống, không hộp quà ngẫu nhiên. */
  router.post("/adopt", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    res.json(await db.withTransaction(async (client) => {
      await xu.syncLessons(client, uid); // khóa dòng ví trước khi tiêu: hai cú bấm cùng lúc xếp hàng
      const gifts = await xu.dailyGifts(client, uid);
      await ensureRow(client, uid);
      let r;
      try { r = IslandCore.adopt(gifts.xu, b.breed, b.name); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      const name = r.name || PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
      const today = TownCore.dayKey(Date.now(), xu.tz());
      const ins = await client.query(
        `INSERT INTO pet_owned (user_id, breed, name, friend_xp, satiety, mood, day)
         VALUES ($1, $2, $3, 0, $4, $5, $6::date) RETURNING id`,
        [uid, r.breed, name, r.satiety, r.mood, today]
      );
      await write(client, uid, r.xu);
      await xu.spend(client, uid, "pet_buy", r.price, { topic: r.breed, slot: Number(ins.rows[0].id), xuAfter: r.xu });
      return buildView(client, uid);
    }));
  }));

  /* Mua thức ăn bằng xu: xu đổi thành đồ ăn trong kho, không mất gì. */
  router.post("/food", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    res.json(await db.withTransaction(async (client) => {
      await xu.syncLessons(client, uid); // khóa dòng ví trước khi tiêu
      const gifts = await xu.dailyGifts(client, uid);
      await ensureRow(client, uid);
      let r;
      try { r = IslandCore.buyFood(gifts.xu, b.item, b.qty); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      const items = Object.assign({}, await readPantry(client, uid));
      items[r.food] = IslandCore.int(items[r.food]) + r.qty;
      await client.query(`UPDATE pet_pantry SET items = $2, updated_at = now() WHERE user_id = $1`, [uid, JSON.stringify(items)]);
      await write(client, uid, r.xu);
      await xu.spend(client, uid, "pet_food", r.cost, { topic: r.food, xuAfter: r.xu });
      return buildView(client, uid);
    }));
  }));

  /* Cho ăn: tốn một phần ăn trong kho (không trừ xu lần hai), tối đa 3 bữa/ngày/thú. */
  router.post("/feed", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    res.json(await db.withTransaction(async (client) => {
      const today = TownCore.dayKey(Date.now(), xu.tz());
      await ensureRow(client, uid);
      const pets = await readPets(client, uid);
      const pet = pets.find((p) => p.id === Number(b.petId));
      if (!pet) throw httpError(404, "Không có thú này.");
      let r;
      try { r = IslandCore.feed(pet, await readPantry(client, uid), b.item, today); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await client.query(`UPDATE pet_pantry SET items = $2, updated_at = now() WHERE user_id = $1`, [uid, JSON.stringify(r.pantry)]);
      await savePet(client, Object.assign(r.pet, { user_id: uid }));
      return buildView(client, uid);
    }));
  }));

  /* Vuốt ve / chơi bóng: miễn phí, không thưởng xu, tối đa 5 lần/ngày/thú. */
  router.post("/care", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    res.json(await db.withTransaction(async (client) => {
      const today = TownCore.dayKey(Date.now(), xu.tz());
      await ensureRow(client, uid);
      const pets = await readPets(client, uid);
      const pet = pets.find((p) => p.id === Number(b.petId));
      if (!pet) throw httpError(404, "Không có thú này.");
      let r;
      try { r = IslandCore.care(pet, b.action, today); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await savePet(client, Object.assign(r.pet, { user_id: uid }));
      return buildView(client, uid);
    }));
  }));

  /* ================= 🎨 TRANG TRÍ ĐẢO (D2) =================
     MUA và ĐẶT đi hai đường tách bạch: chỉ MUA trừ ví (kèm một dòng xu_spend), PUT layout KHÔNG BAO GIỜ
     chạm tới town_state.xu. Một bố cục sai vì thế không thể làm mất tiền; cất đồ về kho thì miễn phí,
     không hoàn xu và cũng không mất đồ (decor_owned giữ nguyên). */

  /* GET / đã kèm khối `decor`; đường này là lối tắt cho tab 🎨, trả đúng một hình dạng nên giao diện
     chỉ cần một hàm vẽ. */
  router.get("/decor", route(async (req, res) => {
    const uid = uidOf(req);
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      return buildView(client, uid);
    }));
  }));

  /* Mua đồ: giá × số lượng (1..99), giá niêm yết trong catalog — không hộp ngẫu nhiên, không bán lại lấy xu. */
  router.post("/decor/buy", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    res.json(await db.withTransaction(async (client) => {
      await xu.syncLessons(client, uid); // khóa dòng ví trước khi tiêu: hai cú bấm cùng lúc xếp hàng
      const gifts = await xu.dailyGifts(client, uid);
      await ensureRow(client, uid);
      const state = await readState(client, uid);
      const it = IslandCore.decorOf(b.item);
      if (!it) throw httpError(400, "Món đồ không có trong danh mục.");
      const locked = IslandCore.itemLockedReason(it, state.slots);
      if (locked) throw httpError(409, locked);
      let r;
      try { r = IslandCore.buyDecor(gifts.xu, b.item, b.qty); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await client.query(
        `INSERT INTO decor_owned (user_id, item_key, qty) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, item_key) DO UPDATE SET qty = decor_owned.qty + EXCLUDED.qty, updated_at = now()`,
        [uid, r.item, r.qty]
      );
      await write(client, uid, r.xu);
      await xu.spend(client, uid, "decor_buy", r.cost, { topic: r.item, xuAfter: r.xu });
      return buildView(client, uid);
    }));
  }));

  /* Thay TOÀN BỘ bố cục một đảo (nguyên tử). Server chạy lại từng luật của island-core.js, không tin
     danh sách từ trình duyệt: vị trí phải bám lưới, không đè ô đất, chừa lối cho thú, và số cái đặt trên
     MỌI đảo không vượt số đã mua. `baseVersion` không khớp số hiện trong CSDL → 409, hai tab không đè nhau. */
  router.put("/decor/layout", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    const island = Number(b.island), base = b.baseVersion;
    if (!Number.isInteger(island) || island < 1) throw httpError(400, "Thiếu số đảo cần bố trí.");
    if (!Number.isInteger(base) || base < 0) throw httpError(400, "Thiếu phiên bản bố cục đang thấy (baseVersion).");
    if (!Array.isArray(b.items)) throw httpError(400, "Danh sách đồ đặt phải là một mảng.");
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      const state = await readState(client, uid);
      if (island > (IslandCore.int(state.unlocked) || 1)) throw httpError(409, `Đảo ${island} còn khóa — hoàn chỉnh đảo trước để mở nó.`);
      const ver = await readLayoutVer(client, uid, island);
      if (ver !== base) throw httpError(409, "Đảo đã thay đổi ở nơi khác (một tab khác vừa lưu). Tải lại rồi hãy đặt tiếp — chưa lưu gì cả.");
      const norm = IslandCore.normLayout(b.items);
      if (norm.bad.length) throw Object.assign(httpError(400, `Chưa lưu được bố cục: ${norm.bad[0].reason}`), { errors: norm.bad });
      const decor = await readDecor(client, uid);
      /* exceptIsland: bố cục mới THAY THẾ đảo đang lưu, nên đồ của chính đảo đó không bị trừ hai lần. */
      const check = IslandCore.validateLayout(IslandCore.genIsland(island), norm.items, slotBudget(decor, state.slots, island), state.slots);
      if (!check.ok) {
        const status = check.errors.some((e) => e.status === 409) ? 409 : 400;
        throw Object.assign(httpError(status, `Chưa lưu được bố cục: ${check.errors[0].reason}`), { errors: check.errors });
      }
      await client.query(`DELETE FROM decor_placed WHERE user_id = $1 AND island_index = $2`, [uid, island]);
      if (norm.items.length) {
        const params = [], vals = [];
        for (const p of norm.items) {
          params.push(uid, island, p.item, p.x, p.z, p.rot);
          vals.push(`($${params.length - 5}, $${params.length - 4}, $${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
        }
        await client.query(`INSERT INTO decor_placed (user_id, island_index, item_key, x, z, rot) VALUES ${vals.join(",")}`, params);
      }
      await client.query(
        `INSERT INTO island_style (user_id, island_index, layout_ver) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, island_index) DO UPDATE SET layout_ver = island_style.layout_ver + 1, updated_at = now()`,
        [uid, island]
      );
      return buildView(client, uid);
    }));
  }));

  /* Mở khóa một phong cách: MỘT lần cho cả tài khoản, sau đó đổi qua lại giữa các đảo miễn phí. */
  router.post("/style/buy", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    res.json(await db.withTransaction(async (client) => {
      await xu.syncLessons(client, uid); // khóa dòng ví trước khi tiêu
      const gifts = await xu.dailyGifts(client, uid);
      await ensureRow(client, uid);
      const already = (await readDecor(client, uid)).styleOwned;
      let r;
      try { r = IslandCore.buyStyle(gifts.xu, b.style, already.includes(b.style)); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await client.query(
        `INSERT INTO style_owned (user_id, style_key) VALUES ($1, $2) ON CONFLICT (user_id, style_key) DO NOTHING`, [uid, r.style]
      );
      await write(client, uid, r.xu);
      await xu.spend(client, uid, "style_buy", r.cost, { topic: r.style, xuAfter: r.xu });
      return buildView(client, uid);
    }));
  }));

  /* Chọn phong cách cho một đảo — miễn phí, chỉ ghi được nhánh đã mở khóa (null = về mặc định của đảo). */
  router.post("/style", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    const island = Number(b.island);
    if (!Number.isInteger(island) || island < 1) throw httpError(400, "Thiếu số đảo cần đổi phong cách.");
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      const state = await readState(client, uid);
      if (island > (IslandCore.int(state.unlocked) || 1)) throw httpError(409, `Đảo ${island} còn khóa — hoàn chỉnh đảo trước để mở nó.`);
      const decor = await readDecor(client, uid);
      let r;
      try { r = IslandCore.applyStyle(decor.styleOwned, b); }
      catch (err) { throw httpError(err.status || 400, err.message); }
      await ensureStyleRow(client, uid, island);
      /* applyStyle chỉ trả về các nhánh NGƯỜI CHƠI vừa nhắc tới — ba nhánh còn lại phải giữ nguyên,
         nên ghi đè cả bốn cột bằng cách ghép vào dòng đang có (không thì bật "Mưa" là làm mất "Đêm"). */
      const prev = decor.styles[island] || {};
      const next = { weather: null, tod: null, grass: null, sky: null };
      for (const k of IslandCore.STYLE_KINDS) if (prev[k] !== undefined && prev[k] !== null) next[k] = prev[k];
      for (const k of IslandCore.STYLE_KINDS) if (r.style[k] !== undefined) next[k] = r.style[k];
      await client.query(
        `UPDATE island_style SET weather = $3, tod = $4, grass = $5, sky = $6, updated_at = now()
          WHERE user_id = $1 AND island_index = $2`,
        [uid, island, next.weather, next.tod, next.grass, next.sky]
      );
      return buildView(client, uid);
    }));
  }));

  /* 📌 Danh sách mong muốn (D5): thay cả danh sách một lần, tối đa 10 món, MIỄN PHÍ — không chạm ví,
     không ghi dòng nào vào xu_spend. Món chưa mở gói vẫn ước được (ước là để nhắm tới đảo còn lại);
     khóa lạ hoặc quá trần là 400 và danh sách cũ đứng nguyên trong CSDL. */
  router.put("/decor/wish", route(async (req, res) => {
    const uid = uidOf(req), b = req.body || {};
    let keys;
    try { keys = IslandCore.normWish(b.items); }
    catch (err) { throw httpError(err.status || 400, err.message); }
    res.json(await db.withTransaction(async (client) => {
      await ensureRow(client, uid);
      await client.query(`DELETE FROM decor_wish WHERE user_id = $1`, [uid]);
      if (keys.length) {
        const params = [], vals = [];
        keys.forEach((k, i) => { params.push(uid, k, i); vals.push(`($${params.length - 2}, $${params.length - 1}, $${params.length})`); });
        await client.query(`INSERT INTO decor_wish (user_id, item_key, pos) VALUES ${vals.join(",")}`, params);
      }
      return buildView(client, uid);
    }));
  }));

  return router;
}

/* Chuyển toàn bộ Quần đảo của Khách (user_id = 0) sang tài khoản mới — CÙNG giao dịch với phần chuyển ví
   của town.js, do auth.js gọi lúc đăng ký. Trước D2 chưa có đường nào chuyển nên Khách cày đảo rồi đăng ký
   là mất đảo; từ giờ tiến độ + thú + kho + đồ trang trí + phong cách đều đi theo người chơi.
   Tài khoản mới đã có dữ liệu đảo thì KHÔNG ghi đè, trả { moved:false, conflict:true } để hỏi lại. */
const GUEST_TABLES = ["island_state", "pet_owned", "pet_pantry", "decor_owned", "decor_placed", "island_style", "style_owned", "decor_wish"];
async function transferGuestData(client, guestId, newUserId) {
  const has = await client.query(
    `SELECT 1 FROM island_state WHERE user_id = $1
     UNION ALL SELECT 1 FROM pet_owned    WHERE user_id = $1
     UNION ALL SELECT 1 FROM decor_owned  WHERE user_id = $1 LIMIT 1`, [newUserId]
  );
  if (has.rowCount > 0) return { moved: false, conflict: true };
  for (const table of GUEST_TABLES) await client.query(`UPDATE ${table} SET user_id = $2 WHERE user_id = $1`, [guestId, newUserId]);
  return { moved: true, conflict: false };
}

module.exports = {
  createIslandRouter, buildView, ensureRow, readState, readPets, readPantry, C,
  readDecor, readLayoutVer, slotBudget, ensureStyleRow, transferGuestData,
};
