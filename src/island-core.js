"use strict";

/* LÕI THUẦN của "Quần đảo vô tận + Nuôi thú cưng": không DOM, không CSDL, không mạng.
   Server (src/island.js) và trang demo (public/quan-dao-vo-tan-three.html) dùng CHUNG file này
   nên giá, trần và điều kiện mở đảo chỉ tồn tại ở MỘT chỗ.
   Nguyên tắc cứng: không có đường nào làm giảm xu / mất đảo / mất thú ngoài lúc người chơi chủ động tiêu. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.IslandCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const HOUR = 3600000;

  const CONFIG = {
    tz: "Asia/Ho_Chi_Minh",
    slots: 5, // 1 nhà + 1 cây + 3 công trình riêng của chủ đề
    maxLevel: 3,
    upgradeCost: [10, 25, 50], // lên cấp 1 / 2 / 3, nhân hệ số đảo
    factorStep: 0.15,
    factorMax: 3, // trần để đảo nào cũng hoàn thành được trong khoảng một tháng
    mealsPerDay: 3,
    caresPerDay: 5,
    seenFirst: 3, // số thú ra đảo cùng lúc lúc đầu
    seenMax: 6, // trần hiệu năng
    satietyFloor: 30,
    moodFloor: 30,
    decayPerHour: { satiety: 1.5, mood: 0.8 },
    petStart: { satiety: 70, mood: 70 },
    friendXp: [0, 20, 50, 100, 180, 300, 480, 720, 1050, 1500],
    nameMax: 20,

    /* Đuôi email của TÀI KHOẢN DEMO do scripts/seed-tai-khoan-3-dao.js tạo ra. Hai script đo kinh tế
       (sim-xu-moi.js / sim-trang-tri.js) loại đúng đuôi này khi đọc CSDL, để số liệu công bố về
       "người chơi thật" không nhiễm xu và ngày-học bịa đặt. ".invalid" là tên miền không bao giờ
       nhận thư thật, nên không có nguy cơ trùng với người dùng. */
    demoMail: "@quandao.invalid",

    /* feo = bán kính chặn (ob) của ba ô công trình theo thứ tự features — từ 04/11 bộ số này là
       NGUỒN DUY NHẤT: trang 3D bỏ hẳn mảng feo của riêng nó và genIsland() đọc chỗ này,
       nên server kiểm được "chỗ đặt đồ có đè ô đất không" mà không cần hiểu THREE. */
    themes: [
      { k: "sakura", name: "Anh Đào", icon: "🌸", amb: "petals", feo: [1.0, 1.9, 0.7], features: [{ k: "torii", name: "Cổng torii", icon: "⛩️" }, { k: "koi", name: "Hồ cá koi", icon: "🎏" }, { k: "lantern", name: "Đèn đá", icon: "🏮" }] },
      { k: "maple", name: "Phong Thu", icon: "🍁", amb: "leaves", feo: [1.1, 0.9, 0.8], features: [{ k: "windmill", name: "Cối xay gió", icon: "🌀" }, { k: "leafpile", name: "Đống lá", icon: "🍂" }, { k: "firepit", name: "Lò sưởi ngoài trời", icon: "🔥" }] },
      { k: "desert", name: "Ốc Đảo", icon: "🌴", amb: "sand", feo: [1.1, 1.2, 0.8], features: [{ k: "well", name: "Giếng nước", icon: "💧" }, { k: "tent", name: "Lều thương nhân", icon: "⛺" }, { k: "cactus", name: "Xương rồng nở hoa", icon: "🌵" }] },
      { k: "ice", name: "Băng Tuyết", icon: "❄️", amb: "snow", feo: [0.9, 2.0, 0.8], features: [{ k: "snowman", name: "Người tuyết", icon: "☃️" }, { k: "icelake", name: "Hồ băng", icon: "🧊" }, { k: "aurora", name: "Cột đèn cực quang", icon: "🌌" }] },
      { k: "tropic", name: "Nhiệt Đới", icon: "🥥", amb: "waves", feo: [1.6, 1.0, 0.9], features: [{ k: "waterfall", name: "Thác nước", icon: "💦" }, { k: "bridge", name: "Cầu tre", icon: "🎋" }, { k: "boat", name: "Thuyền nhỏ", icon: "🛶" }] },
      { k: "cloud", name: "Mây Trời", icon: "☁️", amb: "clouds", feo: [1.4, 0.9, 0.9], features: [{ k: "rainbow", name: "Cầu vồng", icon: "🌈" }, { k: "balloon", name: "Khinh khí cầu", icon: "🎈" }, { k: "windcloud", name: "Cối xay mây", icon: "🌀" }] },
      { k: "ocean", name: "Đáy Biển", icon: "🐚", amb: "bubbles", feo: [1.2, 1.0, 0.8], features: [{ k: "seaweed", name: "Vườn rong", icon: "🌿" }, { k: "school", name: "Đàn cá", icon: "🐟" }, { k: "chest", name: "Rương cổ", icon: "🗝️" }] },
      { k: "firefly", name: "Đom Đóm", icon: "✨", amb: "fireflies", feo: [0.9, 0.8, 1.1], features: [{ k: "glowshroom", name: "Nấm sáng", icon: "🍄" }, { k: "starpond", name: "Lồng đèn", icon: "🏮" }, { k: "observatory", name: "Đài quan sát sao", icon: "🔭" }] },
    ],

    breeds: [
      { k: "cat-tabby", species: "cat", icon: "🐱", name: "Mèo ta (cam vằn)", rarity: 1, price: 40 },
      { k: "cat-calico", species: "cat", icon: "🐱", name: "Mèo tam thể", rarity: 1, price: 50 },
      { k: "cat-british", species: "cat", icon: "🐱", name: "Mèo Anh lông ngắn", rarity: 2, price: 120 },
      { k: "cat-siamese", species: "cat", icon: "🐱", name: "Mèo Xiêm", rarity: 2, price: 120 },
      { k: "cat-persian", species: "cat", icon: "🐱", name: "Mèo Ba Tư", rarity: 3, price: 300 },
      { k: "cat-cloud", species: "cat", icon: "🐱", name: "Mèo mây (ánh sao)", rarity: 4, price: 600 },
      { k: "dog-village", species: "dog", icon: "🐶", name: "Chó ta (vàng)", rarity: 1, price: 40 },
      { k: "dog-corgi", species: "dog", icon: "🐶", name: "Corgi", rarity: 2, price: 120 },
      { k: "dog-shiba", species: "dog", icon: "🐶", name: "Shiba", rarity: 2, price: 120 },
      { k: "dog-husky", species: "dog", icon: "🐶", name: "Husky", rarity: 3, price: 300 },
      { k: "dog-poodle", species: "dog", icon: "🐶", name: "Poodle", rarity: 3, price: 300 },
      { k: "dog-cloud", species: "dog", icon: "🐶", name: "Chó mây (ánh trăng)", rarity: 4, price: 600 },
    ],

    foods: [
      { k: "khat", icon: "🥣", name: "Hạt / xương khô", price: 3, aff: 2 },
      { k: "ca", icon: "🐟", name: "Cá khô / thịt thưởng", price: 8, aff: 5 },
      { k: "banh", icon: "🍪", name: "Bánh thưởng", price: 15, aff: 10 },
      { k: "dacbiet", icon: "🍱", name: "Bữa đặc biệt", price: 40, aff: 25 },
    ],
  };

  const C = CONFIG;
  const bad = (message, status) => Object.assign(new Error(message), { status: status || 400 });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

  /* ---------- giá theo số đảo ---------- */
  const factor = (n) => Math.min(C.factorMax, 1 + C.factorStep * (int(n) - 1));
  const costOf = (n, lv) => Math.round(C.upgradeCost[clamp(lv, 0, C.maxLevel - 1)] * factor(n));
  const islandCost = (n) => C.slots * (costOf(n, 0) + costOf(n, 1) + costOf(n, 2));
  const themeOf = (n) => C.themes[((int(n) - 1) % C.themes.length + C.themes.length) % C.themes.length];
  const lapOf = (n) => Math.floor((int(n) - 1) / C.themes.length);
  const breedOf = (k) => C.breeds.find((b) => b.k === k) || null;
  const foodOf = (k) => C.foods.find((f) => f.k === k) || null;

  /* ---------- HÌNH ĐẢO (D0) — trước đây nằm trong trang 3D, nay về lõi dùng chung ----------
     Server phải tự tái dựng được mặt đảo để kiểm "chỗ này có đặt được đồ không"; nếu hình học
     chỉ sống ở trình duyệt thì trình duyệt nói gì server tin nấy. Bộ số lấy nguyên từ trang cũ
     (bán kính đảo 8..11, ob Nhà 1,85 / Cây 1,15 / feo theo chủ đề, biên nước .7, thú .35)
     nên đảo dựng từ cùng số n vẫn giống hệt từng ô — có ca kiểm riêng cho chuyện đó. */
  const GEO = {
    house: 1.85, // ob của ô 0 (Nhà)
    tree: 1.15, // ob của ô 1 (Cây)
    petR: 0.35, // bán kính thú: đích đi bộ và ô trống tối thiểu tính theo số này
    edge: 0.7, // cách mép nước mới được coi là trong đảo
    slotPad: 1.1, // khoảng đệm genIsland chừa giữa ô đất và mép
    spread: 0.6, // genIsland đẩy hai ô đất cách nhau tối thiểu ob+ob+spread
    grid: 0.25, // bước lưới khi đặt đồ và khi flood fill
    rMin: 8,
    rSpan: 3,
  };

  const hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const rand = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const edgeOf = (L, a) => L.r * (1 + 0.06 * Math.sin(3 * a + L.p1) + 0.04 * Math.sin(5 * a + L.p2));

  /* Seed theo số đảo: mọi người chơi thấy cùng một đảo n, và genIsland(n) không đổi khi có đồ trang trí. */
  function genIsland(n) {
    const idx = int(n) < 1 ? 1 : int(n);
    const R = rand(hash("iso-" + idx)), t = ((idx - 1) % C.themes.length + C.themes.length) % C.themes.length, lap = Math.floor((idx - 1) / C.themes.length);
    const L = { n: idx, t, lap, r: GEO.rMin + R() * GEO.rSpan, p1: R() * 6.283, p2: R() * 6.283, tod: lap > 0 ? Math.floor(R() * 4) : 1, hue: lap > 0 ? (R() - 0.5) * 0.12 : 0, lit: lap > 0 ? (R() - 0.5) * 0.1 : 0, slots: [], decor: [] };
    const ah = R() * 6.283;
    const add = (kind, ob, a, d) => L.slots.push({ kind, ob, x: d * Math.cos(a), z: d * Math.sin(a) });
    add("house", GEO.house, ah, 1.1 + R() * 0.9);
    const at = ah + 2.3 + R() * 0.9; add("tree", GEO.tree, at, 3.2 + R() * 1.4);
    for (let i = 0; i < 3; i++) { const a = ah + (i + 1) * 1.95 + (R() - 0.5) * 0.5, d = clamp(4.8 + R() * 1.8, 3, edgeOf(L, a) - 2.6); add("f" + i, C.themes[t].feo[i], a, d); }
    const dn = 10 + Math.floor(R() * 8);
    for (let i = 0; i < dn; i++) { const a = R() * 6.283, d = 1.5 + R() * (L.r - 2.4); L.decor.push({ a, d, k: ["rock", "flower", "bush"][Math.floor(R() * 3)], s: 0.7 + R() * 0.7 }); }
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < L.slots.length; i++) for (let j = i + 1; j < L.slots.length; j++) {
        const a = L.slots[i], b = L.slots[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01, need = a.ob + b.ob + GEO.spread;
        if (d < need) { const push = (need - d) / 2, ux = dx / d, uz = dz / d; a.x -= ux * push; a.z -= uz * push; b.x += ux * push; b.z += uz * push; moved = true; }
      }
      for (const s of L.slots) { const ang = Math.atan2(s.z, s.x) || 0, dd = Math.hypot(s.x, s.z), max = edgeOf(L, ang) - s.ob - GEO.slotPad; if (dd > max) { s.x = max * Math.cos(ang); s.z = max * Math.sin(ang); } }
      if (!moved) break;
    }
    return L;
  }

  /* blocks: danh sách vật cản THÊM (đồ trang trí chặn đường) — trang cũ chưa có tham số thứ năm này,
     gọi ba tham số thì hành vi y hệt như trước. */
  function walkable(L, x, z, mg, blocks) {
    const a = Math.atan2(z, x);
    if (Math.hypot(x, z) > edgeOf(L, a) - GEO.edge - mg) return false;
    for (const s of L.slots) if (Math.hypot(x - s.x, z - s.z) < s.ob + mg) return false;
    for (const p of blocks || []) if (Math.hypot(x - p.x, z - p.z) < p.r + mg) return false;
    return true;
  }

  function pickSpot(L, R, cx, cz, blocks) {
    for (let i = 0; i < 80; i++) { const a = R() * 6.283, d = R() * L.r * 0.88, x = d * Math.cos(a), z = d * Math.sin(a); if (walkable(L, x, z, GEO.petR, blocks)) return { x, z }; }
    return { x: cx || 0, z: cz || 0 };
  }

  /* "Cửa nhà" và gốc cây: hai chỗ thú hay lui tới, đặt đồ chắn ngay trước thì coi như nhốt thú. */
  const doorSpot = (L) => { const h = L.slots[0], a = Math.atan2(h.z, h.x) + 2.1; return { x: h.x + Math.cos(a) * (h.ob + 0.5), z: h.z + Math.sin(a) * (h.ob + 0.5) }; };
  const treeSpot = (L) => { const s = L.slots[1], a = Math.atan2(s.z, s.x) + 1.2; return { x: s.x + Math.cos(a) * (s.ob + 0.4), z: s.z + Math.sin(a) * (s.ob + 0.4) }; };

  /* ---------- TRANG TRÍ (D1): catalog + luật đặt ---------- */
  /* Lớp chặn: W phẳng (thú đi qua) · S/M/L/XL chặn dần · FX hiệu ứng (không chiếm chỗ).
     r = bán kính chặn thật; GAP/GAP_SLOT/NO_GO là khoảng an toàn, không phải cỡ món. */
  const DECOR = {
    grid: GEO.grid, // 0,25 — vị trí bắt buộc bám lưới để trình duyệt và server làm tròn giống nhau
    rotSteps: 8, // 45° một bước
    radius: { W: 0, S: 0.25, M: 0.45, L: 0.7, XL: 0.9, FX: 0 },
    gap: 1.0, // chừa lối giữa hai món chặn (≈ 2 lần bán kính thú + dư)
    slotGap: 0.9, // cách thêm sau khi đã trừ ob của ô đất
    noGo: 1.2, // vùng cấm quanh cửa Nhà và quanh bát nước
    maxTotal: 40, maxBlock: 12, maxFx: 2, maxLandmark: 1,
    fillMin: 0.98, // luật 9: phần đi được thuộc MỘT khối lớn nhất
  };

  const mk = (cat, group, cls, price, extra) => Object.assign({ cat, group, cls, price, r: DECOR.radius[cls] }, extra || {});
  const DECOR_ITEMS = []
    .concat(
      /* 🌿 Cây và hoa (116) */
      mk("plants", "Cây và hoa", "W", 3, { k: "grass_tuft", name: "Bụi cỏ", icon: "🌿" }),
      mk("plants", "Cây và hoa", "W", 5, { k: "flower_patch", name: "Luống hoa", icon: "🌷" }),
      mk("plants", "Cây và hoa", "M", 8, { k: "bush", name: "Bụi cây tròn", icon: "🌳" }),
      mk("plants", "Cây và hoa", "S", 10, { k: "sapling", name: "Cây non", icon: "🌱" }),
      mk("plants", "Cây và hoa", "M", 15, { k: "pine", name: "Cây thông nhỏ", icon: "🌲" }),
      mk("plants", "Cây và hoa", "M", 20, { k: "oak", name: "Cây sồi", icon: "🌳" }),
      mk("plants", "Cây và hoa", "M", 20, { k: "palm_small", name: "Cây cọ nhỏ", icon: "🌴" }),
      mk("plants", "Cây và hoa", "M", 35, { k: "topiary", name: "Cây tỉa hình thú", icon: "🐇" })
    )
    .concat(
      /* 🪨 Đường và hàng rào (114) */
      mk("path", "Đường và hàng rào", "W", 4, { k: "stone_path", name: "Đá lát", icon: "🪨" }),
      mk("path", "Đường và hàng rào", "W", 6, { k: "wood_path", name: "Ván gỗ", icon: "🟫" }),
      mk("path", "Đường và hàng rào", "W", 8, { k: "brick_path", name: "Gạch", icon: "🧱" }),
      mk("path", "Đường và hàng rào", "W", 5, { k: "stepping", name: "Bậc đá", icon: "⬜" }),
      mk("path", "Đường và hàng rào", "S", 6, { k: "fence", name: "Hàng rào ngắn", icon: "🚧" }),
      mk("path", "Đường và hàng rào", "W", 40, { k: "mini_bridge", name: "Cầu nhỏ", icon: "🌉" }),
      mk("path", "Đường và hàng rào", "W", 45, { k: "flower_arch", name: "Vòm hoa", icon: "🎀" })
    )
    .concat(
      /* 💡 Đèn (308) — phát sáng bằng emissive, KHÔNG thêm PointLight */
      mk("light", "Đèn", "S", 10, { k: "lantern", name: "Đèn lồng đất", icon: "🏮", glow: "#ffe9a8" }),
      mk("light", "Đèn", "S", 18, { k: "lamp_post", name: "Cột đèn", icon: "💡", glow: "#ffe9a8" }),
      mk("light", "Đèn", "S", 30, { k: "glow_orb", name: "Quả cầu sáng", icon: "🔮", glow: "#b8ffe8" }),
      mk("light", "Đèn", "S", 60, { k: "star_lamp", name: "Đèn sao", icon: "✨", glow: "#fff3c4" }),
      mk("light", "Đèn", "M", 40, { k: "fire_pit", name: "Lửa trại", icon: "🔥", glow: "#ffb27a" }),
      mk("light", "Đèn", "L", 150, { k: "lighthouse_mini", name: "Hải đăng nhỏ", icon: "🗼", glow: "#ffe9a8" })
    )
    .concat(
      /* 🪑 Đồ vườn và nhà (277) */
      mk("garden", "Đồ vườn và nhà", "S", 12, { k: "mailbox", name: "Hòm thư", icon: "📮" }),
      mk("garden", "Đồ vườn và nhà", "S", 25, { k: "bird_house", name: "Nhà chim", icon: "🐦" }),
      mk("garden", "Đồ vườn và nhà", "M", 20, { k: "bench", name: "Ghế dài", icon: "🪑" }),
      mk("garden", "Đồ vườn và nhà", "L", 45, { k: "table_set", name: "Bàn ghế", icon: "🍽️" }),
      mk("garden", "Đồ vườn và nhà", "L", 50, { k: "hammock", name: "Võng", icon: "🛏️" }),
      mk("garden", "Đồ vườn và nhà", "L", 55, { k: "tent", name: "Lều", icon: "⛺" }),
      mk("garden", "Đồ vườn và nhà", "L", 70, { k: "swing", name: "Xích đu", icon: "🎐" })
    )
    .concat(
      /* 💧 Nước và đá (228) */
      mk("water", "Nước và đá", "S", 3, { k: "rock_small", name: "Đá nhỏ", icon: "🪨" }),
      mk("water", "Nước và đá", "M", 10, { k: "rock_big", name: "Đá lớn", icon: "⛰️" }),
      mk("water", "Nước và đá", "M", 35, { k: "pond_small", name: "Ao nhỏ", icon: "💧" }),
      mk("water", "Nước và đá", "M", 60, { k: "bamboo_fountain", name: "Ống tre nước", icon: "🎋" }),
      mk("water", "Nước và đá", "L", 120, { k: "fountain_small", name: "Đài phun", icon: "⛲" })
    )
    .concat(
      /* ✨ Hiệu ứng (140, tối đa 2/đảo) — không chiếm chỗ, thú đi xuyên */
      mk("fx", "Hiệu ứng", "FX", 40, { k: "fireflies", name: "Đom đóm", icon: "✨", fx: "fireflies" }),
      mk("fx", "Hiệu ứng", "FX", 40, { k: "petals_fx", name: "Cánh hoa bay", icon: "🌸", fx: "petals" }),
      mk("fx", "Hiệu ứng", "FX", 30, { k: "butterflies", name: "Bướm", icon: "🦋", fx: "butterflies" }),
      mk("fx", "Hiệu ứng", "FX", 30, { k: "bubbles_fx", name: "Bong bóng", icon: "🫧", fx: "bubbles" })
    )
    .concat(
      /* 🐾 Cho thú (190) — bowl là món DUY NHẤT tạo vùng cấm quanh nó */
      mk("pet", "Thú cưng", "W", 10, { k: "water_bowl", name: "Bát nước", icon: "🥣", petSpot: "bowl" }),
      mk("pet", "Thú cưng", "W", 25, { k: "pet_bed", name: "Nệm thú", icon: "🛌", petSpot: "rest" }),
      mk("pet", "Thú cưng", "S", 15, { k: "ball_basket", name: "Rổ bóng", icon: "🏐", petSpot: "play" }),
      mk("pet", "Thú cưng", "M", 60, { k: "cat_tree", name: "Cây leo cho mèo", icon: "🪵", petSpot: "rest" }),
      mk("pet", "Thú cưng", "L", 80, { k: "dog_house", name: "Nhà chó", icon: "🏠", petSpot: "rest" })
    )
    .concat(
      /* 🏛️ Công trình lớn (2.200, tối đa 1/đảo) — mở theo SỐ ĐẢO HOÀN CHỈNH, không bán đại trà */
      mk("landmark", "Công trình lớn", "XL", 300, { k: "pet_statue", name: "Tượng thú cưng", icon: "🗿", needDone: 1 }),
      mk("landmark", "Công trình lớn", "XL", 500, { k: "big_windmill", name: "Cối xay lớn", icon: "🌀", needDone: 2 }),
      mk("landmark", "Công trình lớn", "XL", 600, { k: "clock_tower", name: "Tháp đồng hồ", icon: "🕰️", needDone: 4 }),
      mk("landmark", "Công trình lớn", "XL", 800, { k: "observatory", name: "Đài thiên văn", icon: "🔭", needDone: 8 })
    );

  /* Gói chủ đề (1.229): mở khi đã HOÀN CHỈNH một đảo cùng chủ đề — đảo n thuộc themeOf(n). */
  const DECOR_THEMED = []
    .concat(
      mk("plants", "Gói Anh Đào", "W", 60, { k: "mini_torii", name: "Cổng torii nhỏ", icon: "⛩️", theme: "sakura" }),
      mk("plants", "Gói Anh Đào", "S", 45, { k: "bonsai_sakura", name: "Bonsai anh đào", icon: "🌸", theme: "sakura" }),
      mk("light", "Gói Anh Đào", "S", 25, { k: "stone_lantern", name: "Đèn đá nhỏ", icon: "🏮", theme: "sakura", glow: "#ffe9a8" }),
      mk("path", "Gói Anh Đào", "W", 70, { k: "red_bridge", name: "Cầu cong đỏ", icon: "🌉", theme: "sakura" })
    )
    .concat(
      mk("plants", "Gói Phong Thu", "W", 8, { k: "leaf_pile", name: "Đống lá", icon: "🍂", theme: "maple" }),
      mk("plants", "Gói Phong Thu", "S", 12, { k: "pumpkin", name: "Bí ngô", icon: "🎃", theme: "maple" }),
      mk("plants", "Gói Phong Thu", "M", 30, { k: "maple_small", name: "Phong nhỏ", icon: "🍁", theme: "maple" }),
      mk("garden", "Gói Phong Thu", "M", 65, { k: "cozy_stove", name: "Lò sưởi ngoài trời", icon: "🔥", theme: "maple", glow: "#ffd08a" })
    )
    .concat(
      mk("plants", "Gói Ốc Đảo", "S", 15, { k: "cactus", name: "Xương rồng", icon: "🌵", theme: "desert" }),
      mk("garden", "Gói Ốc Đảo", "S", 12, { k: "clay_pot", name: "Bình gốm", icon: "🏺", theme: "desert" }),
      mk("garden", "Gói Ốc Đảo", "L", 70, { k: "merchant_tent", name: "Lều thương nhân", icon: "⛺", theme: "desert" }),
      mk("plants", "Gói Ốc Đảo", "M", 35, { k: "date_palm", name: "Cọ chà là nhỏ", icon: "🌴", theme: "desert" })
    )
    .concat(
      mk("plants", "Gói Băng Tuyết", "M", 30, { k: "snowman", name: "Người tuyết", icon: "☃️", theme: "ice" }),
      mk("plants", "Gói Băng Tuyết", "M", 30, { k: "ice_pine", name: "Thông tuyết", icon: "🌲", theme: "ice" }),
      mk("light", "Gói Băng Tuyết", "S", 40, { k: "ice_lantern", name: "Đèn băng", icon: "🧊", theme: "ice", glow: "#b8ffe8" }),
      mk("water", "Gói Băng Tuyết", "W", 55, { k: "ice_rink", name: "Sân băng nhỏ", icon: "⛸️", theme: "ice" })
    )
    .concat(
      mk("plants", "Gói Nhiệt Đới", "M", 40, { k: "coconut_palm", name: "Cây dừa lùn", icon: "🥥", theme: "tropic" }),
      mk("plants", "Gói Nhiệt Đới", "M", 18, { k: "banana_bush", name: "Bụi chuối", icon: "🍌", theme: "tropic" }),
      mk("path", "Gói Nhiệt Đới", "W", 50, { k: "bamboo_bridge", name: "Cầu tre nhỏ", icon: "🎋", theme: "tropic" }),
      mk("garden", "Gói Nhiệt Đới", "S", 22, { k: "surf_board", name: "Ván lướt sóng", icon: "🏄", theme: "tropic" })
    )
    .concat(
      mk("path", "Gói Mây Trời", "W", 70, { k: "rainbow_arch", name: "Vòm cầu vồng", icon: "🌈", theme: "cloud" }),
      mk("garden", "Gói Mây Trời", "L", 80, { k: "balloon_small", name: "Khinh khí cầu nhỏ", icon: "🎈", theme: "cloud" }),
      mk("garden", "Gói Mây Trời", "M", 30, { k: "cloud_cushion", name: "Đệm mây", icon: "☁️", theme: "cloud" }),
      mk("light", "Gói Mây Trời", "S", 15, { k: "wind_chime", name: "Chuông gió", icon: "🎐", theme: "cloud", glow: "#fff3c4" })
    )
    .concat(
      mk("plants", "Gói Đáy Biển", "W", 12, { k: "seaweed_patch", name: "Bụi rong biển", icon: "🌿", theme: "ocean" }),
      mk("water", "Gói Đáy Biển", "S", 10, { k: "conch_shell", name: "Ốc biển", icon: "🐚", theme: "ocean" }),
      mk("water", "Gói Đáy Biển", "M", 35, { k: "coral_pile", name: "Rạn san hô", icon: "🪸", theme: "ocean" }),
      mk("garden", "Gói Đáy Biển", "S", 60, { k: "treasure_chest", name: "Rương kho báu", icon: "🗝️", theme: "ocean" })
    )
    .concat(
      mk("plants", "Gói Đom Đóm", "S", 25, { k: "glow_shroom", name: "Nấm phát sáng", icon: "🍄", theme: "firefly", glow: "#c8ffb0" }),
      mk("light", "Gói Đom Đóm", "S", 30, { k: "paper_lantern", name: "Đèn giấy", icon: "🏮", theme: "firefly", glow: "#ffd9a0" }),
      mk("light", "Gói Đom Đóm", "S", 40, { k: "firefly_jar", name: "Lọ đom đóm", icon: "✨", theme: "firefly", glow: "#e8ffa8" }),
      mk("garden", "Gói Đom Đóm", "L", 90, { k: "star_telescope", name: "Kính thiên văn nhỏ", icon: "🔭", theme: "firefly" })
    );

  /* Tám gói = tám chủ đề trong CONFIG.themes; themeUnlocked tính theo chủ đề của đảo n ((n−1) mod 8). */
  const DECOR_ALL = DECOR_ITEMS.concat(DECOR_THEMED);
  const decorOf = (k) => DECOR_ALL.find((i) => i.k === k) || null;
  const isBlocker = (i) => i.cls === "S" || i.cls === "M" || i.cls === "L" || i.cls === "XL";

  /* Phong cách: mở MỘT lần cho cả tài khoản, đổi miễn phí cho từng đảo (830 xu cả bộ). */
  const DECOR_STYLES = []
    .concat(
      mk("weather", "Thời tiết", "FX", 60, { k: "w_rain", name: "Mưa nhẹ", icon: "🌧️", kind: "weather", fx: "rain" }),
      mk("weather", "Thời tiết", "FX", 60, { k: "w_fog", name: "Sương mù", icon: "🌫️", kind: "weather", fx: "fog" }),
      mk("weather", "Thời tiết", "FX", 80, { k: "w_snow", name: "Tuyết nhẹ", icon: "🌨️", kind: "weather", fx: "snow" }),
      mk("weather", "Thời tiết", "FX", 80, { k: "w_petals", name: "Cánh hoa bay", icon: "💮", kind: "weather", fx: "petals" })
    )
    .concat(
      mk("tod", "Khóa giờ", "FX", 40, { k: "t_morning", name: "Sáng", icon: "🌅", kind: "tod", tod: 0 }),
      mk("tod", "Khóa giờ", "FX", 40, { k: "t_noon", name: "Trưa", icon: "☀️", kind: "tod", tod: 1 }),
      mk("tod", "Khóa giờ", "FX", 60, { k: "t_dusk", name: "Hoàng hôn", icon: "🌇", kind: "tod", tod: 2 }),
      mk("tod", "Khóa giờ", "FX", 60, { k: "t_night", name: "Đêm", icon: "🌙", kind: "tod", tod: 3 })
    )
    .concat(
      mk("grass", "Màu cỏ", "FX", 50, { k: "g_sprout", name: "Xanh non", icon: "🟩", kind: "grass", hue: 0.03, lit: 0.04 }),
      mk("grass", "Màu cỏ", "FX", 50, { k: "g_autumn", name: "Vàng thu", icon: "🟨", kind: "grass", hue: -0.08, lit: 0.02 }),
      mk("grass", "Màu cỏ", "FX", 50, { k: "g_teal", name: "Xanh ngọc", icon: "🟦", kind: "grass", hue: 0.12, lit: 0.0 }),
      mk("grass", "Màu cỏ", "FX", 50, { k: "g_lavender", name: "Tím oải hương", icon: "🟪", kind: "grass", hue: 0.24, lit: 0.02 })
    )
    .concat(
      mk("sky", "Bầu trời", "FX", 50, { k: "s_duskpurple", name: "Hoàng hôn tím", icon: "🟪", kind: "sky", sky: "#c9b8e6" }),
      mk("sky", "Bầu trời", "FX", 50, { k: "s_pinkdawn", name: "Bình minh hồng", icon: "🌸", kind: "sky", sky: "#ffdfea" }),
      mk("sky", "Bầu trời", "FX", 50, { k: "s_starry", name: "Đêm sao", icon: "🌌", kind: "sky", sky: "#2b4a6b" })
    );
  const styleOf = (k) => DECOR_STYLES.find((i) => i.k === k) || null;

  /* ---------- bố cục + luật đặt (mục 7 của đặc tả) ---------- */
  const snap = (v) => Math.round(Number(v) / DECOR.grid) * DECOR.grid;
  const sameCell = (a, b) => Math.abs(snap(a.x) - snap(b.x)) < 1e-9 && Math.abs(snap(a.z) - snap(b.z)) < 1e-9;

  /* Layout chuẩn hóa: chỉ nhận món có trong catalog, tọa độ bám lưới, rot 0..7.
     Trả về thêm `bad` (lý do) thay vì ném lỗi để PUT layout một mạch kiểm hết rồi mới báo. */
  function normLayout(raw) {
    const out = [], bad = [];
    const src = Array.isArray(raw) ? raw : [];
    for (const p of src) {
      const it = decorOf(p && p.item);
      if (!it) { bad.push({ at: p, reason: "Món không có trong danh mục." }); continue; }
      const x = Number(p.x), z = Number(p.z), rot = int(p.rot);
      if (!Number.isFinite(x) || !Number.isFinite(z)) { bad.push({ at: p, reason: "Vị trí không hợp lệ." }); continue; }
      if (rot < 0 || rot >= DECOR.rotSteps) { bad.push({ at: p, reason: "Hướng xoay phải từ 0 đến " + (DECOR.rotSteps - 1) + "." }); continue; }
      out.push({ item: it.k, x: snap(x), z: snap(z), rot });
    }
    return { items: out, bad };
  }

  const blockersOf = (L, layout) => layout.filter((p) => isBlocker(decorOf(p.item))).map((p) => { const it = decorOf(p.item); return { x: p.x, z: p.z, r: it.r }; });
  const fxCount = (layout) => layout.filter((p) => decorOf(p.item).cls === "FX").length;
  const blockCount = (layout) => layout.filter((p) => isBlocker(decorOf(p.item))).length;
  const landmarkCount = (layout) => layout.filter((p) => decorOf(p.item).cls === "XL").length;

  /* Flood fill trên lưới 0,25: phần đi được của THÚ (mg = bán kính thú) thuộc MỘT khối lớn nhất / tổng.
     Đảo trống đã có thể dưới 98% (ô đất to), nên luật 9 so với min(98%, mức đảo trống).
     Bản nhanh này tính bằng khoảng cách BÌNH PHƯƠNG và mảng kiểu — bộ kiểm 500 đảo chạy trong vài giây,
     còn walkable() ở trên (dùng cho thú và bóng xem trước) vẫn giữ nguyên hình thức dễ đọc. */
  function walkGrid(L, blocks) {
    const step = DECOR.grid, n = Math.ceil((2 * L.r) / step) + 2, off = -L.r - step;
    const ok = new Uint8Array(n * n);
    const sl = L.slots.map((s) => ({ x: s.x, z: s.z, r: s.ob + GEO.petR }));
    const bl = (blocks || []).map((p) => ({ x: p.x, z: p.z, r: p.r + GEO.petR }));
    const edgeCut = GEO.edge + GEO.petR;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const x = off + i * step;
      for (let j = 0; j < n; j++) {
        const z = off + j * step;
        const d = Math.hypot(x, z);
        if (d > edgeOf(L, Math.atan2(z, x)) - edgeCut) continue;
        let free = true;
        for (const s of sl) if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) < s.r * s.r) { free = false; break; }
        if (free) for (const p of bl) if ((x - p.x) * (x - p.x) + (z - p.z) * (z - p.z) < p.r * p.r) { free = false; break; }
        if (free) { ok[i * n + j] = 1; total++; }
      }
    }
    return { n, ok, total };
  }
  function walkFraction(L, layout) {
    const g = walkGrid(L, blockersOf(L, layout || []));
    if (!g.total) return 1;
    const seen = new Uint8Array(g.n * g.n), st = new Int32Array(g.n * g.n);
    let best = 0;
    for (let start = 0; start < g.ok.length; start++) {
      if (!g.ok[start] || seen[start]) continue;
      let top = 0, c = 0;
      st[top++] = start; seen[start] = 1;
      while (top) {
        const cell = st[--top]; c++;
        const i = (cell / g.n) | 0, j = cell - i * g.n;
        if (i > 0 && g.ok[cell - g.n] && !seen[cell - g.n]) { seen[cell - g.n] = 1; st[top++] = cell - g.n; }
        if (i + 1 < g.n && g.ok[cell + g.n] && !seen[cell + g.n]) { seen[cell + g.n] = 1; st[top++] = cell + g.n; }
        if (j > 0 && g.ok[cell - 1] && !seen[cell - 1]) { seen[cell - 1] = 1; st[top++] = cell - 1; }
        if (j + 1 < g.n && g.ok[cell + 1] && !seen[cell + 1]) { seen[cell + 1] = 1; st[top++] = cell + 1; }
      }
      if (c > best) best = c;
      if (best === g.total) break; // một khối đã ăn hết: không cần dò nữa
    }
    return best / g.total;
  }

  /* Chủ đề đã mở? Hoàn thành >= 1 đảo thuộc chủ đề đó. Công trình lớn? Theo SỐ đảo hoàn chỉnh. */
  const themeUnlocked = (slots, themeKey) => Object.keys(normSlots(slots)).some((n) => isDone(slots, n) && themeOf(n).k === themeKey);
  const itemLockedReason = (it, slots) => {
    if (it.theme && !themeUnlocked(slots, it.theme)) {
      const th = C.themes.find((t) => t.k === it.theme);
      return `Chưa mở: ${it.name} thuộc gói ${th.icon} ${th.name} — cần hoàn chỉnh một đảo ${th.name} trước.`;
    }
    if (it.needDone && doneCount(slots) < it.needDone) return `Chưa mở: ${it.name} cần ${it.needDone} đảo hoàn chỉnh (bạn đã có ${doneCount(slots)}).`;
    return null;
  };

  /* Luật 9 chỉ cần chạy khi món mới có thể tạo "cổ chai": nó phải chạm (gần chạm) vùng cấm của một ô đất,
     của một món chặn khác, hoặc của mép nước. Một món đứng một mình giữa bãi trống thì không chia cắt được gì,
     nên bỏ qua flood fill — nhờ vậy bộ kiểm 500 đảo chạy trong vài giây. */
  const NECK = 0.6;
  function mayPinch(L, placed, here, r) {
    const rr = r + GEO.petR;
    for (const s of L.slots) if (Math.abs(Math.hypot(here.x - s.x, here.z - s.z) - (s.ob + GEO.petR)) < rr + NECK) return true;
    for (const p of placed) {
      const pi = decorOf(p.item);
      if (!pi || !isBlocker(pi)) continue;
      if (Math.abs(Math.hypot(here.x - p.x, here.z - p.z) - (pi.r + GEO.petR)) < rr + NECK) return true;
    }
    const a = Math.atan2(here.z, here.x);
    if (Math.abs(edgeOf(L, a) - GEO.edge - GEO.petR - Math.hypot(here.x, here.z)) < rr + NECK) return true;
    return false;
  }

  /* Một hàm duy nhất cho cả hai bên: trình duyệt dùng để tô xanh/đỏ + in lý do, server chạy lại khi lưu.
     Trả {ok:true} hoặc {ok:false, reason:"…"} — KHÔNG ném lỗi, vì bóng xem trước gọi liên tục. */
  function canPlace(L, layout, item, x, z, rot, opts) {
    const o = opts || {};
    const it = typeof item === "string" ? decorOf(item) : item;
    if (!it) return { ok: false, reason: "Món không có trong danh mục." };
    if (itemLockedReason(it, o.slots || {})) return { ok: false, reason: itemLockedReason(it, o.slots || {}) };
    const r = Number(rot === undefined ? 0 : rot);
    if (!Number.isInteger(r) || r < 0 || r >= DECOR.rotSteps) return { ok: false, reason: "Hướng xoay phải là một trong 8 bước." };
    if (Math.abs(snap(x) - Number(x)) > 1e-9 || Math.abs(snap(z) - Number(z)) > 1e-9) return { ok: false, reason: "Vị trí phải bám lưới 0,25." };

    const here = { x: Number(x), z: Number(z) };
    const placed = layout || [];
    const a = Math.atan2(here.z, here.x);
    if (Math.hypot(here.x, here.z) > edgeOf(L, a) - GEO.edge - it.r - GEO.petR) return { ok: false, reason: "Ra ngoài mép đảo — thú không còn lối đi quanh món này." };

    for (const s of L.slots) {
      if (Math.hypot(here.x - s.x, here.z - s.z) < s.ob + it.r + DECOR.slotGap) {
        const fi = Number(String(s.kind).slice(1));
        const nm = slotName(L.n, s.kind === "house" ? 0 : s.kind === "tree" ? 1 : fi + 2);
        return { ok: false, reason: `Sát ô ${nm} — phải cách tâm ô thêm ${DECOR.slotGap}.` };
      }
    }

    const door = doorSpot(L);
    if (isBlocker(it) && Math.hypot(here.x - door.x, here.z - door.z) < DECOR.noGo + it.r) return { ok: false, reason: "Chắn ngay cửa Nhà — thú sẽ không vào được nhà." };

    for (const p of placed) {
      const pi = decorOf(p.item);
      if (!pi) continue;
      if (sameCell(here, p)) return { ok: false, reason: `Ô lưới này đã có ${pi.name}.` };
      const gapBowl = Math.hypot(here.x - p.x, here.z - p.z) < DECOR.noGo + it.r + pi.r;
      if (gapBowl && (pi.petSpot === "bowl" ? isBlocker(it) || it.cls === "FX" : it.petSpot === "bowl" && (isBlocker(pi) || pi.cls === "FX"))) {
        return { ok: false, reason: it.petSpot === "bowl" ? "Bát nước bị đồ khác chắn — thú ăn không tới được." : "Chắn bát nước — thú ăn không có chỗ." };
      }
      if (isBlocker(it) && isBlocker(pi) && Math.hypot(here.x - p.x, here.z - p.z) < it.r + pi.r + DECOR.gap) {
        return { ok: false, reason: `Quá sát ${pi.name} — hai món chặn phải chừa lối ${DECOR.gap} cho thú đi.` };
      }
    }

    /* Ngân sách: đếm toàn bộ món đang đặt trên đảo này + món đang thử. */
    const next = placed.concat([{ item: it.k, x: here.x, z: here.z, rot: r }]);
    if (next.length > DECOR.maxTotal) return { ok: false, reason: `Đảo chỉ đặt được tối đa ${DECOR.maxTotal} món.` };
    if (isBlocker(it) && blockCount(next) > DECOR.maxBlock) return { ok: false, reason: `Tối đa ${DECOR.maxBlock} món chặn đường/đảo.` };
    if (it.cls === "FX" && fxCount(next) > DECOR.maxFx) return { ok: false, reason: `Tối đa ${DECOR.maxFx} hiệu ứng/đảo.` };
    if (it.cls === "XL" && landmarkCount(next) > DECOR.maxLandmark) return { ok: false, reason: "Mỗi đảo chỉ đặt một công trình lớn." };

    /* Luật 9: đặt xong đảo vẫn liền một khối (>= 98%, hoặc không tệ hơn đảo trống).
       `fill:false` chỉ dành cho mô phỏng A/B (scripts/sim-trang-tri.js) để đo xem luật khoảng cách
       một mình có cắt đảo không — API thật không bao giờ tắt, validateLayout cũng không.
       Món đứng giữa bãi trống (mayPinch false) không cắt được gì nên khỏi flood fill: bố cục
       hiện tại đã hợp pháp thì thêm nó vẫn hợp pháp. */
    const base = o.baseFraction === undefined ? null : o.baseFraction;
    const limit = Math.min(DECOR.fillMin, base === null ? 1 : base);
    if (o.fill !== false && mayPinch(L, placed, here, it.r)) {
      const f = walkFraction(L, next);
      if (f < limit - 1e-9) return { ok: false, reason: "Chặn đường của thú — bố cục này chia cắt đảo." };
      return { ok: true, fraction: Number(f.toFixed(4)) };
    }
    return { ok: true };
  }

  /* Kiểm TOÀN BỘ bố cục một đảo trước khi lưu (PUT layout): từng chỗ một, rồi mới tới số cái được đặt.
     `left[key]` = số cái CÒN RẢNH cho đảo này = đã mua − đang đặt ở mọi đảo khác (luật 2), nên lõi không
     cần biết bố cục của từng đảo — bên gọi tính sẵn, đúng như khối `decor.left` mà API trả về.
     `status` phân loại lỗi cho API: 400 = trình bày sai (vị trí, ngân sách, trùng ô) — người chơi sửa được ngay;
     409 = không có quyền đặt (chưa mua / chưa mở gói) — phải đi mua trước. Không có lỗi nào trừ xu. */
  function validateLayout(L, layout, left, slots) {
    const errors = [];
    for (let i = 0; i < layout.length; i++) {
      const p = layout[i], rest = layout.filter((_, j) => j !== i);
      const r = canPlace(L, rest, p.item, p.x, p.z, p.rot, { slots });
      if (!r.ok) errors.push({ index: i, item: p.item, reason: r.reason, status: 400 });
    }
    const counts = {};
    for (const p of layout) counts[p.item] = (counts[p.item] || 0) + 1;
    for (const [k, c] of Object.entries(counts)) {
      const have = int(left && left[k]);
      if (c > have) errors.push({ item: k, reason: `Đảo này chỉ còn đặt được ${have} ${decorOf(k).name} (đã trừ đồ đang đặt ở đảo khác), không đặt được ${c}.`, status: 409 });
    }
    return { ok: errors.length === 0, errors, layout };
  }

  /* Mua đồ: giá × số lượng, KHÔNG tự trừ khi thiếu — giống hệt adopt/buyFood của đảo và thú. */
  function buyDecor(xu, key, qty) {
    const it = decorOf(key);
    if (!it) throw bad("Món đồ không có trong danh mục.", 400);
    const q = int(qty);
    if (q < 1 || q > 99) throw bad("Số lượng phải từ 1 đến 99.", 400);
    const cost = it.price * q;
    const balance = int(xu);
    if (balance < cost) throw bad(`Cần ${cost} xu cho ${q}× ${it.icon} ${it.name}. Bạn đang có ${balance} xu — còn thiếu ${cost - balance}. Không có gì bị trừ.`, 409);
    return { item: it.k, qty: q, price: it.price, cost, xu: balance - cost };
  }

  function buyStyle(xu, key, alreadyOwned) {
    const s = styleOf(key);
    if (!s) throw bad("Phong cách không có trong danh mục.", 400);
    if (alreadyOwned) throw bad(`${s.icon} ${s.name} đã mở cho tài khoản này — đổi qua lại giữa các đảo miễn phí.`, 409);
    const balance = int(xu);
    if (balance < s.price) throw bad(`Cần ${s.price} xu để mở ${s.name}. Bạn đang có ${balance} xu — còn thiếu ${s.price - balance}. Không có gì bị trừ.`, 409);
    return { style: s.k, cost: s.price, xu: balance - s.price };
  }

  function pickStyle(key, alreadyOwned) {
    const s = styleOf(key);
    if (!s) throw bad("Phong cách không có trong danh mục.", 400);
    if (!alreadyOwned) throw bad(`Chưa mở ${s.name}. Vào 🎨 Trang trí mua bằng ${s.price} xu (mở một lần, đổi miễn phí cho mọi đảo).`, 409);
    return { style: s.k, cost: 0 };
  }

  /* POST /style: bốn nhánh của một đảo, mỗi nhánh một khóa đã mở hoặc null = mặc định của đảo.
     Chỉ trả về các nhánh NGƯỜI CHƠI vừa nhắc tới (nhánh khác giữ nguyên), chọn đi chọn lại không tốn xu lần hai. */
  const STYLE_KINDS = ["weather", "tod", "grass", "sky"];
  function applyStyle(ownedKeys, patch) {
    const have = new Set(Array.isArray(ownedKeys) ? ownedKeys : []), p = patch || {}, out = {};
    for (const kind of STYLE_KINDS) {
      if (p[kind] === undefined) continue;
      if (p[kind] === null || p[kind] === "") { out[kind] = null; continue; }   // về mặc định: luôn làm được, miễn phí
      /* Sai nhánh / món lạ là lỗi định dạng (400) — phải xét TRƯỚC điều kiện chưa mở khóa (409),
         nếu không một khóa nằm nhầm nhánh sẽ báo "chưa mở" dù mua cũng không dùng được. */
      const s = styleOf(p[kind]);
      if (!s) throw bad(`Phong cách ${p[kind]} không có trong danh mục.`, 400);
      if (s.kind !== kind) throw bad(`${s.icon} ${s.name} thuộc nhánh ${s.kind}, không phải ${kind}.`, 400);
      pickStyle(s.k, have.has(s.k));
      out[kind] = s.k;
    }
    if (!Object.keys(out).length) throw bad(`Chưa chọn nhánh phong cách nào (${STYLE_KINDS.join(" · ")}).`, 400);
    return { style: out, cost: 0 };
  }

  /* ---------- 📌 DANH SÁCH MONG MUỐN (D5) ----------
     Chỉ là chỗ ghi nhớ, không phải cửa hàng: không trừ xu, không đếm ngược, không lời lẽ thúc ép.
     Món chưa mở gói vẫn ước được — ước chính là lý do người chơi nhắm đảo còn lại. */
  const WISH_MAX = 10;
  function normWish(keys) {
    if (!Array.isArray(keys)) throw bad("Danh sách mong muốn phải là một mảng khóa món.", 400);
    const out = [];
    for (const k of keys) {
      const it = decorOf(k);
      if (!it) throw bad(`${k} không có trong danh mục nên không ước được.`, 400);
      if (!out.includes(it.k)) out.push(it.k);
    }
    if (out.length > WISH_MAX) throw bad(`Danh sách mong muốn giữ được tối đa ${WISH_MAX} món (bạn gửi ${out.length}).`, 400);
    return out;
  }
  /* "Còn thiếu bao nhiêu xu" tính một lần ở lõi để giao diện và bộ kiểm dùng chung số:
     đã có >= 1 cái thì 0 (món nằm trong kho rồi), ngược lại là phần chênh giữa giá và ví. */
  function wishRows(keys, owned, balance) {
    const xu = int(balance);
    return (Array.isArray(keys) ? keys : []).map((k) => {
      const it = decorOf(k);
      if (!it) return null;
      const have = int((owned || {})[k]);
      return { k, icon: it.icon, name: it.name, group: it.group, price: it.price, owned: have, missing: have > 0 ? 0 : Math.max(0, it.price - xu) };
    }).filter(Boolean);
  }

  /* ---------- trạng thái ---------- */
  const emptySlots = () => new Array(C.slots).fill(0);
  const newState = () => ({ current: 1, unlocked: 1, slots: { 1: emptySlots() }, done: {} });

  const normSlots = (raw) => {
    const out = {};
    for (const [k, v] of Object.entries(raw || {})) {
      const n = int(k);
      if (n < 1) continue;
      const arr = Array.isArray(v) ? v.slice(0, C.slots).map((lv) => clamp(lv, 0, C.maxLevel)) : [];
      while (arr.length < C.slots) arr.push(0);
      out[n] = arr;
    }
    if (!out[1]) out[1] = emptySlots();
    return out;
  };

  const isDone = (slots, n) => (slots[n] || []).length === C.slots && slots[n].every((lv) => lv >= C.maxLevel);
  const doneCount = (slots) => Object.keys(slots).filter((n) => isDone(slots, n)).length;
  const seenFor = (slots) => clamp(C.seenFirst + doneCount(slots), C.seenFirst, C.seenMax);

  const slotName = (n, i) => (i === 0 ? "Nhà" : i === 1 ? "Cây" : themeOf(n).features[i - 2].name);
  const slotIcon = (n, i) => (i === 0 ? "🏠" : i === 1 ? "🌳" : themeOf(n).features[i - 2].icon);

  /* Nâng một ô đất. KHÔNG tự trừ khi thiếu xu; lỗi ném ra trước mọi thay đổi. */
  function upgrade(state, xu, slot, today) {
    const slots = normSlots(state.slots);
    const n = int(state.current) || 1;
    if (!slots[n]) slots[n] = emptySlots();
    const i = Number(slot);
    if (!Number.isInteger(i) || i < 0 || i >= C.slots) throw bad("Ô đất không hợp lệ.", 400);
    const lv = slots[n][i];
    if (lv >= C.maxLevel) throw bad(`${slotName(n, i)} đã ở cấp tối đa.`, 409);
    const cost = costOf(n, lv);
    const balance = int(xu);
    if (balance < cost) throw bad(`Cần ${cost} xu để nâng ${slotName(n, i)} lên cấp ${lv + 1}. Bạn đang có ${balance} xu — còn thiếu ${cost - balance}. Không có gì bị trừ.`, 409);

    slots[n][i] = lv + 1;
    const unlocked = int(state.unlocked) || 1;
    const completedAt = Object.assign({}, state.completedAt);
    const done = { completed: false, completedIsland: null, nextIsland: null };
    if (isDone(slots, n)) {
      const next = n + 1;
      if (!slots[next]) slots[next] = emptySlots();
      completedAt[n] = today;
      done.completed = true;
      done.completedIsland = n;
      done.nextIsland = { index: next, theme: themeOf(next).k };
    }
    return {
      state: Object.assign({}, state, { slots, unlocked: Math.max(unlocked, n + (done.completed ? 1 : 0)), completedAt }),
      cost, level: lv + 1, xu: balance - cost, island: n, slot: i,
      slotName: slotName(n, i), ...done,
    };
  }

  /* Chỉ được sang đảo đã mở; tiến độ mọi đảo giữ nguyên. */
  function travel(state, n) {
    const target = Number(n);
    if (!Number.isInteger(target) || target < 1) throw bad("Số đảo không hợp lệ.", 400);
    if (target > (int(state.unlocked) || 1)) throw bad(`Đảo ${target} còn khóa. Hoàn chỉnh đảo ${state.current} (đủ ${C.slots} ô cấp ${C.maxLevel}) để mở tiếp.`, 409);
    const slots = normSlots(state.slots);
    if (!slots[target]) slots[target] = emptySlots();
    return { state: Object.assign({}, state, { slots, current: target }), island: target };
  }

  /* ---------- thú ---------- */
  const friendLv = (xp) => { let i = 0; while (i + 1 < C.friendXp.length && int(xp) >= C.friendXp[i + 1]) i++; return i + 1; };
  const rollDay = (pet, today) => (pet.day === today ? pet : Object.assign({}, pet, { day: today, meals: 0, cares: 0 }));

  /* Nghỉ bao lâu cũng không mất gì: No/Vui có sàn 30, chỉ đổi hành vi của thú. */
  function decay(pet, ts) {
    const hours = Math.max(0, (ts - (pet.updatedAt || ts)) / HOUR);
    return Object.assign({}, pet, {
      satiety: Math.max(C.satietyFloor, clamp(pet.satiety, 0, 100) - hours * C.decayPerHour.satiety),
      mood: Math.max(C.moodFloor, clamp(pet.mood, 0, 100) - hours * C.decayPerHour.mood),
    });
  }

  function adopt(xu, breedKey, name) {
    const b = breedOf(breedKey);
    if (!b) throw bad("Giống thú không có trong cửa hàng.", 400);
    const nm = typeof name === "string" ? name.trim() : "";
    if (nm.length && ([...nm].length > C.nameMax || /[\u0000-\u001f]/.test(nm))) throw bad(`Tên thú phải có từ 1 đến ${C.nameMax} ký tự.`, 400);
    const balance = int(xu);
    if (balance < b.price) throw bad(`Cần ${b.price} xu để nhận nuôi ${b.icon} ${b.name}. Bạn đang có ${balance} xu — còn thiếu ${b.price - balance}. Không có gì bị trừ.`, 409);
    return { breed: b.k, name: nm || null, price: b.price, xu: balance - b.price, ...C.petStart };
  }

  function buyFood(xu, foodKey, qty) {
    const f = foodOf(foodKey);
    if (!f) throw bad("Loại thức ăn không hợp lệ.", 400);
    const q = int(qty);
    if (q < 1 || q > 99) throw bad("Số lượng phải từ 1 đến 99.", 400);
    const cost = f.price * q;
    const balance = int(xu);
    if (balance < cost) throw bad(`Cần ${cost} xu cho ${q}× ${f.name}. Bạn đang có ${balance} xu — còn thiếu ${cost - balance}. Không có gì bị trừ.`, 409);
    return { food: f.k, qty: q, cost, xu: balance - cost };
  }

  /* Cho ăn KHÔNG tốn xu lần hai: xu đã trả lúc mua thức ăn. */
  function feed(pet, pantry, foodKey, today) {
    const p = rollDay(pet, today), f = foodOf(foodKey);
    if (!f) throw bad("Loại thức ăn không hợp lệ.", 400);
    if (p.meals >= C.mealsPerDay) throw bad(`${p.name} đã ăn đủ ${C.mealsPerDay} bữa hôm nay. Đói chỉ làm thú buồn ngủ, không phạt gì — mai cho ăn tiếp.`, 409);
    if (int(pantry[f.k]) < 1) throw bad(`Kho hết ${f.name}. Vào mục 🍖 Thức ăn mua bằng xu (giá ${f.price} xu).`, 409);
    const items = Object.assign({}, pantry);
    items[f.k] = int(items[f.k]) - 1;
    return {
      pantry: items,
      pet: Object.assign({}, p, {
        meals: p.meals + 1,
        satiety: clamp(p.satiety + 25, 0, 100),
        mood: clamp(p.mood + 6, 0, 100),
        friendXp: int(p.friendXp) + f.aff,
      }),
      gain: f.aff,
    };
  }

  /* Vuốt ve / chơi bóng: miễn phí, không thưởng xu, chỉ có thân thiết. */
  function care(pet, action, today) {
    const p = rollDay(pet, today);
    if (action !== "pet" && action !== "play") throw bad("Hành động không hợp lệ.", 400);
    if (p.cares >= C.caresPerDay) throw bad(`${p.name} hôm nay đã được vuốt ve/chơi ${C.caresPerDay} lần — đủ rồi, mai chơi tiếp.`, 409);
    return {
      pet: Object.assign({}, p, {
        cares: p.cares + 1,
        mood: clamp(p.mood + (action === "play" ? 8 : 5), 0, 100),
        friendXp: int(p.friendXp) + 1,
      }),
      level: friendLv(int(p.friendXp) + 1),
    };
  }

  /* ---------- hình dáng gửi ra giao diện (server và bản offline cùng dùng) ---------- */
  function stateView(x) {
    const today = x.today, ts = x.ts || Date.now();
    const slots = normSlots(x.state && x.state.slots);
    const current = clamp((x.state && x.state.current) || 1, 1, 1e6);
    const unlocked = Math.max(current, int(x.state && x.state.unlocked) || 1);
    const seen = seenFor(slots);
    const pets = (x.pets || []).map((p) => decay(rollDay(Object.assign({}, p, { updatedAt: p.updatedAt ? Date.parse(p.updatedAt) : ts }), today), ts));
    const pantry = {};
    C.foods.forEach((f) => { pantry[f.k] = int((x.pantry || {})[f.k]); });

    const cur = slots[current] || emptySlots();
    // Bản đồ quần đảo: mọi đảo đã mở + hai đảo kế tiếp (đang khóa) để giao diện vẽ được mà không tự tính giá.
    const map = [];
    for (let n = 1; n <= unlocked + 2; n++) {
      const lv = slots[n] || emptySlots();
      map.push({
        index: n, theme: themeOf(n).k, lap: lapOf(n), cost: islandCost(n), factor: Number(factor(n).toFixed(2)),
        levels: lv, done: isDone(slots, n), locked: n > unlocked,
      });
    }

    return {
      today, tz: x.zone || C.tz,
      xu: int(x.balance),
      income: x.income || null,
      left: x.left || null,
      gift: x.gift || null,
      caps: { mealsPerDay: C.mealsPerDay, caresPerDay: C.caresPerDay, lesson: x.lessonCap || null },
      island: {
        current, unlocked, seen,
        slots: Object.keys(slots).reduce((acc, n) => { acc[n] = slots[n]; return acc; }, {}),
        levels: cur,
        upCost: cur.map((lv) => (lv >= C.maxLevel ? null : costOf(current, lv))),
        cost: islandCost(current), factor: Number(factor(current).toFixed(2)),
        theme: themeOf(current).k, done: doneCount(slots), map,
        completedAt: (x.state && x.state.completedAt) || {},
      },
      pets: pets.map((p) => ({
        id: p.id, breed: p.breed, name: p.name, friendXp: int(p.friendXp), level: friendLv(int(p.friendXp)),
        satiety: Math.round(p.satiety), mood: Math.round(p.mood), meals: p.meals, cares: p.cares,
      })),
      pantry,
      catalog: { themes: C.themes, breeds: C.breeds, foods: C.foods, upgradeCost: C.upgradeCost, slots: C.slots, maxLevel: C.maxLevel, friendXp: C.friendXp, seenFirst: C.seenFirst, seenMax: C.seenMax, decor: DECOR_ALL, styles: DECOR_STYLES, styleKinds: STYLE_KINDS, decorLimits: DECOR, wishMax: WISH_MAX, geo: GEO },
      /* 🎨 Trang trí: đồ đã mua (theo tài khoản), đồ đang đặt (theo đảo), phiên bản bố cục, các nhánh phong cách
         và danh sách mong muốn. Server luôn gửi về đủ kể cả khi tài khoản chưa mua gì — giao diện không phải đoán. */
      decor: Object.assign({ owned: {}, total: {}, placed: {}, styles: {}, styleOwned: [], wish: [], left: {} }, x.decor || {}),
    };
  }

  return {
    CONFIG, clamp, int, factor, costOf, islandCost, themeOf, lapOf, breedOf, foodOf,
    emptySlots, newState, normSlots, isDone, doneCount, seenFor, slotName, slotIcon,
    upgrade, travel, friendLv, rollDay, decay, adopt, buyFood, feed, care, stateView,
    /* D0: hình đảo dùng chung · D1: luật trang trí */
    GEO, hash, rand, edgeOf, genIsland, walkable, pickSpot, doorSpot, treeSpot,
    DECOR, DECOR_ITEMS, DECOR_THEMED, DECOR_ALL, DECOR_STYLES, decorOf, styleOf, isBlocker,
    snap, normLayout, blockersOf, blockCount, fxCount, landmarkCount, walkGrid, walkFraction, mayPinch,
    themeUnlocked, itemLockedReason, canPlace, validateLayout, buyDecor, buyStyle, pickStyle,
    STYLE_KINDS, applyStyle,
    /* D5: danh sách mong muốn */
    WISH_MAX, normWish, wishRows,
  };
});
