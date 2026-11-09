"use strict";

/* LÕI THUẦN của "Thú ảo + Thị trấn": không DOM, không CSDL, không mạng.
   Server (đồng bộ từ bảng attempts) và bản offline trong trình duyệt dùng CHUNG file này.
   Nguyên tắc cứng: mọi con số thưởng đều >= 0 và không có phép trừ nào ngoài việc TIÊU xu để xây / mua hạt. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TownCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 86400000;
  const LADDER_DAYS = [0, 1, 3, 7, 14, 30, 60]; // cùng thang Leitner của GET /api/review

  const CONFIG = {
    tz: "Asia/Ho_Chi_Minh",
    dailyCap: 60, // xu tối đa mỗi ngày từ BÀI HỌC (cũng là XP thú tối đa mỗi ngày)
    base: { new: 3, fixed: 4, review: 2, early: 1 }, // câu mới · sửa câu từng sai · ôn đúng hẹn · lặp quá sớm
    fedMinAttempts: 5, // một ngày "đã cho thú ăn" khi có >= 5 lượt trả lời (đúng hay sai đều tính)
    graceDaysPerWeek: 2, // mỗi tuần ISO được bỏ 2 ngày mà thú không đói
    hungry: { hungry: 1, veryHungry: 3, hibernating: 7 }, // số ngày bỏ lỡ (đã trừ miễn đói) để vào từng trạng thái
    maxRestDays: 14,
    stageXp: [0, 120, 400, 900, 1800], // ngưỡng XP của 5 giai đoạn: Trứng, Con non, Thiếu niên, Trưởng thành, Huyền thoại
    plotsPerDistrict: 4,
    maxLevel: 3,
    buildCost: [20, 50, 100], // giá lên cấp 1, 2, 3 (trừ thẳng vào ví xu)
    backfillDays: 14, // lần đầu bật tính năng: tính bù tối đa 14 ngày lịch sử
    maxVisibleDistricts: 8,
    garden: {
      beds: 6, // số ô vườn quanh quảng trường
      seedCost: 10, // xu để mua một túi hạt (chỉ trừ khi người chơi chủ động trồng)
      waterings: 2, // số lần tưới để nở; tưới miễn phí, tối đa một lần mỗi ngày cho mỗi ô
      harvestGain: 16, // xu nhận lại khi thu hoạch (nhiều hơn seedCost -> có lời, nhưng chậm)
      dailyGainCap: 32, // trần xu vườn cho MỖI NGÀY: chống cày, quá trần thì để mai thu, cây không mất
      flowers: [
        { id: "tulip", name: "Tulip", emoji: "🌷", color: "#e5484d" },
        { id: "daisy", name: "Cúc", emoji: "🌼", color: "#f2f0e6" },
        { id: "sunflower", name: "Hướng dương", emoji: "🌻", color: "#f2b34a" },
        { id: "cherry", name: "Anh đào", emoji: "🌸", color: "#f3a6b8" },
      ],
    },
    treats: { perSpeciesPerDay: 1 }, // con thú của người chơi được cho ăn 1 lần/ngày; cho ăn KHÔNG tốn và KHÔNG thưởng gì

    /* ---------- KINH TẾ XU: một ví duy nhất cho cả thị trấn, cây anh đào và trò chơi ----------
       Chỉ qui định CHIỀU THU. Giá tiêu đi kèm hành động tiêu (buildCost, garden, sakura-core) để sau này
       chỉnh giá không phải đụng vào luật thu. Xu không bao giờ tự trừ; chỉ người chơi chủ động tiêu mới trừ.
       bài học  = 3/4/2/1 mỗi câu đúng (TRONG CONFIG.base), trần CONFIG.dailyCap xu/ngày
       học thêm = +1 mỗi câu đúng SAU KHI đã hết trần bài học, trần extra.cap (không cộng XP thú)
       trò chơi = phần thưởng cố định theo ván, server tính, trần game.cap cho cả nhà + game.rounds theo TỪNG mã
       ôn từ    = +1 mỗi thẻ đã ôn (trần words.cap) · lưu từ mới = +2 mỗi từ thật sự mới (trần wordnew.cap)
       file     = nộp tài liệu -> 25 xu + cứ 20 câu hỏi thêm 1 xu, tối đa file.perFile một file, file.cap một ngày
       đăng nhập= quà 5 xu mỗi ngày một lần (không đếm chuỗi, không dọa nghỉ)
       chuỗi    = quà theo mốc ngày học liên tiếp, mỗi mốc chỉ nhận MỘT lần suốt đời
     Trần nhóm mới đặt = 0 là trở về ĐÚNG hành vi cũ (nhóm đó không thưởng gì).
     Riêng trần bài học để ở CONFIG.dailyCap vì nó cũng là trần XP thú — không lặp lại số ở đây. */
    xu: {
      game: {
        duck: 4, skill: 3, maze: [15, 10, 6], // phần thưởng một ván; maze: Vàng / Bạc / Đồng
        cap: 30,                              // xu tối đa mỗi ngày cho CẢ nhà trò chơi
        roundsPerDay: 2,                      // số ván được thưởng/ngày cho mã KHÔNG liệt kê trong rounds
        rounds: { duck: 3, skill: 2, maze: 2 }, // theo từng mã: 'duck' | 'maze' | 'skill' (đường cũ) | 'skill:<mã game>'
        /* Ván do MÁY CHỦ cấp (POST /api/xu/round/start + /finish) — bằng chứng chống bịa ván:
           seconds  = ván phải kéo dài bao lâu, tính từ dấu thời gian của máy chủ (không tin đồng hồ trình duyệt)
           evidence = số lượt trả lời ĐÚNG LOẠI trong bảng attempts kể từ lúc mở ván
           noEvidence = những trò chơi bằng thẻ tự sinh, KHÔNG ghi attempts -> chỉ có thời gian làm bằng chứng
                        (giới hạn thấp nhất vì cớ đó), và nhanh hơn 5 giây cho đỡ phiền
           ttlHours = ván mở lâu hơn thì bị bỏ giữa chừng: không xu ván, nhưng câu đã trả lời vẫn nhận xu bài học */
        seconds: 30, secondsFast: 25, evidence: 3, ttlHours: 2,
        noEvidence: ["classpos", "classtense", "classprep"],
      },
      extra: { perAttempt: 1, cap: 20 },
      words: { perCard: 1, cap: 15 },
      wordnew: { perWord: 2, cap: 6 },
      file: { base: 25, per: 20, perFile: 60, cap: 60 },
      login: { gift: 5 },
      streak: [[3, 15], [7, 30], [14, 60], [30, 120], [50, 200], [100, 350], [200, 400], [365, 800]],
      /* Đường cũ POST /api/xu/game (trình duyệt tự bịa roundId) còn bật cho tới khi giao diện chuyển hẳn
         sang /api/xu/round/start + /finish. Đặt false là máy chủ từ chối thẳng. */
      legacyGame: true,
    },
  };

  /* ---------- ngày giờ (theo múi giờ ứng dụng, không theo máy người chơi) ---------- */
  const fmtCache = {};
  function dayKey(ts, tz) {
    const zone = tz || CONFIG.tz;
    const f = fmtCache[zone] || (fmtCache[zone] = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }));
    return f.format(new Date(ts));
  }
  const parseDay = (d) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  const addDays = (d, n) => new Date(parseDay(d) + n * DAY).toISOString().slice(0, 10);
  function isoWeekKey(d) {
    const dt = new Date(parseDay(d));
    const dow = (dt.getUTCDay() + 6) % 7; // Thứ Hai = 0
    dt.setUTCDate(dt.getUTCDate() - dow + 3); // thứ Năm của tuần đó quyết định năm ISO
    const year = dt.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const week = 1 + Math.round(((dt - jan4) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  /* ---------- thu hoạch vật liệu từ một lượt trả lời ---------- */
  const newDayState = (day) => ({ day, earned: 0, paid: [] });

  /* a = { id, ts, qid, topic, correct }.  state = { day, earned, paid[] }.  memory[qid] = { oks, last, lastTs }.
     Trả về { state, memory, kind, amount }.  KHÔNG sửa đối tượng truyền vào. */
  function step(state, memory, a, tz) {
    const day = dayKey(a.ts, tz);
    let st = state && state.day === day ? { day, earned: state.earned, paid: state.paid.slice() } : newDayState(day);
    const m = memory[a.qid] || { oks: 0, last: null, lastTs: null };
    let kind = "wrong", amount = 0;

    if (a.correct) {
      if (m.last === null) kind = "new";
      else if (m.last === false) kind = "fixed";
      else kind = a.ts >= m.lastTs + LADDER_DAYS[Math.min(m.oks, 6)] * DAY ? "review" : "early";
      if (st.paid.includes(a.qid)) kind = "dup";
      else if (st.earned >= CONFIG.dailyCap) kind = "cap";
      else amount = Math.min(CONFIG.base[kind], CONFIG.dailyCap - st.earned);
      if (amount > 0) { st.earned += amount; st.paid.push(a.qid); }
    }
    const next = Object.assign({}, memory, {
      [a.qid]: { oks: m.oks + (a.correct ? 1 : 0), last: !!a.correct, lastTs: a.ts },
    });
    return { state: st, memory: next, kind, amount };
  }

  /* Xử lý nhiều lượt theo thứ tự thời gian. Chia đôi lô rồi chạy nối tiếp cho kết quả y hệt chạy một lần.
     `ledger` = những lượt ĐƯỢC TRỪ VÀO TRẦN BÀI HỌC. `cut` = những lượt ĐÚNG bị trần bài học chặn lại
     (kind 'cap') — chính là phần "học thêm"; máy chủ đọc danh sách này để thưởng riêng, không phải đoán. */
  function applyAttempts(state, memory, attempts, tz) {
    const list = attempts.slice().sort((x, y) => x.ts - y.ts || x.id - y.id);
    let st = state, mem = memory;
    const ledger = [], cut = [], byTopic = {};
    for (const a of list) {
      const r = step(st, mem, a, tz);
      st = r.state; mem = r.memory;
      if (r.amount > 0) {
        ledger.push({ attemptId: a.id, topic: a.topic, kind: r.kind, amount: r.amount, day: st.day });
        byTopic[a.topic] = (byTopic[a.topic] || 0) + r.amount;
      } else if (r.kind === "cap") {
        cut.push({ attemptId: a.id, topic: a.topic, day: st.day });
      }
    }
    const xp = ledger.reduce((s, l) => s + l.amount, 0);
    return { state: st, memory: mem, ledger, cut, byTopic, xp };
  }

  /* ---------- các nguồn xu còn lại (thuần, server chỉ việc gọi) ---------- */
  /* Phần thưởng MỘT ván game theo loại: hạng maze (0=Vàng 1=Bạc 2=Đồng, khác -> 0), duck, skill. */
  function gameReward(game, place) {
    const G = CONFIG.xu.game;
    if (game === "maze") return G.maze[Number.isInteger(place) ? place : -1] || 0;
    return G[game] || 0;
  }

  /* Còn được bao nhiêu xu cho nguồn này hôm nay (đã dùng `used` trên trần `cap`). */
  const room = (cap, used) => Math.max(0, cap - (Math.floor(Number(used)) || 0));

  /* Nộp file tài liệu -> câu hỏi: 25 xu, thêm 1 xu cho mỗi đủ 20 câu, tối đa perFile một file. File 0 câu: không thưởng. */
  function fileGain(questionCount) {
    const F = CONFIG.xu.file, n = Math.floor(Number(questionCount) || 0);
    if (n <= 0) return 0;
    return Math.min(F.perFile, F.base + Math.floor(n / F.per));
  }

  /* Mã ván trong source_ref -> NHÓM bị giới hạn số ván:
       'duck:<ván>' | 'maze:<file>:<múi>:< Snapshot>'  -> 'duck' | 'maze'
       'skill:<mã game>:<ván>'                          -> 'skill:<mã game>'  (mỗi trò kỹ năng một hạn riêng)
       'skill:<ván>' (đường cũ, không có mã game)       -> 'skill'            (cả 18 trò chung một hạn) */
  function gameKeyOf(ref) {
    const p = String(ref || "").split(":");
    return p[0] === "skill" && p.length >= 3 ? "skill:" + p[1] : p[0] || "";
  }
  const roundLimit = (key) => {
    const G = CONFIG.xu.game;
    const n = G.rounds[key];
    return Number.isInteger(n) ? n : G.roundsPerDay;
  };

  /* Điều kiện một ván do máy chủ cấp phải THỎA trước khi được thưởng (mục 7 tài liệu kinh tế xu).
     'duck:<ván>' cần >=3 lượt mode 'duck:%'; 'skill:<mã>' cần >=3 lượt mode 'skill';
     riêng ba trò Phân loại nhanh (noEvidence) không ghi attempts -> chỉ đo thời gian, 25 giây. */
  function roundNeed(key) {
    const G = CONFIG.xu.game, parts = String(key || "").split(":"), code = parts[1];
    const fast = !!code && G.noEvidence.indexOf(code) >= 0;
    return {
      seconds: fast ? G.secondsFast : G.seconds,
      evidence: fast ? 0 : G.evidence,
      mode: parts[0] === "duck" ? "duck:%" : "skill",
      game: parts[0] || "",
      fast: !!fast,
    };
  }

  /* Chuỗi ngày học liên tiếp tính đến hôm nay. `studyDays` là tập ngày ĐÃ ĐỦ chỉ tiêu (>= fedMinAttempts lượt),
     đúng cái hunger() dùng. Hôm nay chưa đủ chỉ tiêu thì vẫn được giữ chuỗi của hôm qua (đừng phạt giữa chừng);
     nghỉ từ 2 ngày trở lên thì chuỗi về 0. */
  function streakOf(studyDays, today) {
    const set = new Set(studyDays || []);
    if (!set.size) return 0;
    let d = set.has(today) ? today : addDays(today, -1);
    if (!set.has(d)) return 0;
    let s = 0;
    while (set.has(d)) { s++; d = addDays(d, -1); }
    return s;
  }

  /* Quà chuỗi: `granted` = danh sách mốc đã nhận (số ngày). mỗi mốc chỉ nhận một lần, không lấy lại được.
     Trả về { length, due: [mốc chưa lãnh], next: mốc kế tiếp CHƯA lãnh | null } — dẫn đã lãnh thì bỏ qua,
     giao diện khỏi hứa một món quà không bao giờ tới nữa (người chơi đứt chuỗi thì quay lại mốc cao hơn). */
  function streakPending(streak, granted) {
    const got = new Set((granted || []).map(Number));
    const s = Math.floor(Number(streak) || 0);
    const due = [];
    let next = null;
    for (const [days, gift] of CONFIG.xu.streak) {
      if (s >= days) { if (!got.has(days)) due.push({ days, gift }); }
      else if (!next && !got.has(days)) next = { days, gift };
    }
    return { length: s, due, next };
  }

  /* ---------- thú ảo ---------- */
  function stageOf(xp) {
    const t = CONFIG.stageXp;
    let i = 0;
    while (i + 1 < t.length && xp >= t[i + 1]) i++;
    const next = i + 1 < t.length ? t[i + 1] : null;
    return { stage: i, next, into: xp - t[i], span: next == null ? null : next - t[i] };
  }

  /* studyDays: Set 'YYYY-MM-DD' của những ngày có >= fedMinAttempts lượt trả lời.
     Không có phép trừ nào lên XP; trạng thái chỉ ảnh hưởng LỜI NÓI và HÌNH DÁNG của thú. */
  function hunger(studyDays, today, opts) {
    const o = opts || {};
    if (o.restUntil && o.restUntil >= today) return { state: "resting", missed: 0, lastStudy: null };
    const days = Array.from(studyDays).filter((d) => d <= today).sort();
    if (!days.length) return { state: "new", missed: 0, lastStudy: null };
    const last = days[days.length - 1];
    if (last === today) return { state: "fed", missed: 0, lastStudy: last };
    const grace = o.graceDaysPerWeek == null ? CONFIG.graceDaysPerWeek : o.graceDaysPerWeek;
    const used = {};
    let missed = 0;
    for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) {
      if (o.restUntil && d <= o.restUntil) continue;
      const wk = isoWeekKey(d);
      used[wk] = used[wk] || 0;
      if (used[wk] < grace) { used[wk]++; continue; }
      missed++;
    }
    const h = CONFIG.hungry;
    const state = missed >= h.hibernating ? "hibernating" : missed >= h.veryHungry ? "very_hungry" : missed >= h.hungry ? "hungry" : "ok";
    return { state, missed, lastStudy: last };
  }

  /* ---------- xây dựng ---------- */
  const emptyPlots = () => new Array(CONFIG.plotsPerDistrict).fill(0);

  /* Nâng cấp một ô đất. `xu` là số dư ví chung (không còn vật liệu riêng từng khu). */
  function build(plots, xu, topic, idx) {
    const row = (plots[topic] || emptyPlots()).slice();
    if (!Number.isInteger(idx) || idx < 0 || idx >= CONFIG.plotsPerDistrict) throw Object.assign(new Error("Ô đất không hợp lệ."), { status: 400 });
    const lv = row[idx] || 0;
    if (lv >= CONFIG.maxLevel) throw Object.assign(new Error("Công trình đã ở cấp tối đa."), { status: 409 });
    const cost = CONFIG.buildCost[lv];
    const have = Math.max(0, Math.floor(Number(xu) || 0));
    if (have < cost) throw Object.assign(new Error(`Cần ${cost} xu, bạn đang có ${have}.`), { status: 409 });
    row[idx] = lv + 1;
    return {
      plots: Object.assign({}, plots, { [topic]: row }),
      xu: have - cost,
      cost, level: lv + 1,
    };
  }

  const districtDone = (plots, topic) => (plots[topic] || []).length === CONFIG.plotsPerDistrict && plots[topic].every((l) => l >= CONFIG.maxLevel);

  const bad = (msg, status) => Object.assign(new Error(msg), { status });

  /* ---------- vườn hoa (kiểu Khu Vườn Trên Mây: mua hạt -> tưới mỗi ngày -> thu hoạch) ----------
     Trồng thì TỐN xu mua hạt (người chơi chủ động bấm), thu hoạch TRẢ LẠI nhiều hơn một chút.
     Thu hoạch bị trần `dailyGainCap` chặn: vượt trần thì cây vẫn nguyên đó, để mai thu — không mất gì. */
  const GARDEN_STAGES = ["Hạt", "Mầm", "Hoa"];

  const PETS = {
    rong: { name: "Rồng", emoji: "🐉" },
    cu: { name: "Cú", emoji: "🦉" },
    cao: { name: "Cáo", emoji: "🦊" },
    cho: { name: "Chó", emoji: "🐶" },
    meo: { name: "Mèo", emoji: "🐱" },
  };

  // Cho ăn là hành động tình cảm: không tốn vật liệu, không cộng XP, không có phần thưởng (tránh cày bấm).
  const FEED_LINES = {
    rong: "Rồng cọ đầu vào tay bạn. No rồi, không cần thêm đâu 🙂",
    cu: "Cú gật gù, mở to mắt hơn một chút.",
    cao: "Cáo vòng đuôi một cái rồi tiếp tục nhìn bạn học.",
    cho: "Chó vẫy đuôi cuồng nhiệt. Bạn học tiếp đi, nó chờ.",
    meo: "Mèo grừ grừ một tiếng, rồi giả vờ như không quen bạn.",
  };

  function normGarden(g) {
    const n = CONFIG.garden.beds;
    const beds = new Array(n).fill(null);
    if (g && Array.isArray(g.beds)) for (let i = 0; i < Math.min(n, g.beds.length); i++) beds[i] = g.beds[i] || null;
    const gain = g && g.gain && g.gain.day ? { day: g.gain.day, amount: Number(g.gain.amount) || 0 } : { day: null, amount: 0 };
    return { beds, gain, picked: Object.assign({}, g && g.picked) };
  }
  const emptyGarden = () => normGarden(null);

  const isMature = (bed) => !!bed && bed.watered >= CONFIG.garden.waterings;

  /* Trạng thái nhìn được từ ngoài: cây này là giai đoạn nào, tưới được chưa, thu được chưa. */
  function gardenView(garden, today) {
    const G = CONFIG.garden;
    return normGarden(garden).beds.map((bed, slot) => {
      if (!bed) return { slot, empty: true };
      const mature = isMature(bed);
      return {
        slot, empty: false, flower: bed.flower, watered: bed.watered,
        need: G.waterings, mature, stage: Math.min(bed.watered, G.waterings),
        stageName: GARDEN_STAGES[Math.min(bed.watered, G.waterings)],
        canWater: !mature && bed.lastWater !== today,
        wateredToday: bed.lastWater === today,
      };
    });
  }

  const flowerOf = (id) => CONFIG.garden.flowers.find((f) => f.id === id);

  /* Mua hạt bằng xu (không còn "hạt của khu nào"): chỉ chọn loài hoa. */
  function plant(garden, xu, slot, flower, today) {
    const G = CONFIG.garden;
    const g = normGarden(garden);
    if (!Number.isInteger(slot) || slot < 0 || slot >= G.beds) throw bad("Ô vườn không hợp lệ.", 400);
    if (g.beds[slot]) throw bad("Ô này đã có cây. Thu hoạch rồi trồng lại, hoặc chọn ô khác.", 409);
    if (!flowerOf(flower)) throw bad("Loài hoa không hợp lệ.", 400);
    const have = Math.max(0, Math.floor(Number(xu) || 0));
    if (have < G.seedCost) throw bad(`Cần ${G.seedCost} xu để mua hạt, bạn đang có ${have}.`, 409);
    g.beds[slot] = { flower, watered: 0, lastWater: null, plantedDay: today };
    return { garden: g, xu: have - G.seedCost, cost: G.seedCost };
  }

  function water(garden, slot, today) {
    const G = CONFIG.garden;
    const g = normGarden(garden);
    if (!Number.isInteger(slot) || slot < 0 || slot >= G.beds) throw bad("Ô vườn không hợp lệ.", 400);
    const bed = g.beds[slot];
    if (!bed) throw bad("Ô này chưa có cây để tưới.", 409);
    if (isMature(bed)) throw bad("Hoa đã nở rồi — thu hoạch thôi, khỏi tưới.", 409);
    if (bed.lastWater === today) throw bad("Hôm nay bạn đã tưới cây này rồi. Mai tưới tiếp nhé.", 409);
    g.beds[slot] = Object.assign({}, bed, { watered: bed.watered + 1, lastWater: today });
    return { garden: g, bloomed: isMature(g.beds[slot]) };
  }

  function harvest(garden, xu, slot, today) {
    const G = CONFIG.garden;
    const g = normGarden(garden);
    const have = Math.max(0, Math.floor(Number(xu) || 0));
    if (!Number.isInteger(slot) || slot < 0 || slot >= G.beds) throw bad("Ô vườn không hợp lệ.", 400);
    const bed = g.beds[slot];
    if (!bed) throw bad("Ô này chưa có cây.", 409);
    if (!isMature(bed)) throw bad(`Cây chưa nở. Còn ${G.waterings - bed.watered} lần tưới nữa.`, 409);
    const already = g.gain.day === today ? g.gain.amount : 0;
    const left = G.dailyGainCap - already;
    // Một lần thu là thu trọn harvestGain: thà để cây nguyên đó mai thu, còn hơn bẻ nửa bông trả nửa xu.
    if (left < G.harvestGain) throw bad(`Hôm nay vườn còn cho thu ${left} xu, chưa đủ ${G.harvestGain}. Mai thu tiếp nhé, cây vẫn nguyên ở đây.`, 409);
    const gain = G.harvestGain;
    g.beds[slot] = null;
    g.picked[bed.flower] = (g.picked[bed.flower] || 0) + 1;
    g.gain = { day: today, amount: already + gain };
    return { garden: g, xu: have + gain, gain, flower: bed.flower };
  }

  /* Cho thú ăn: miễn phí, mỗi loài một lần/ngày, không đổi XP, không đổi xu. */
  function feed(treats, species, today) {
    if (!PETS[species]) throw bad("Loài thú không hợp lệ.", 400);
    const st = treats && treats.day === today
      ? { day: today, given: (treats.given || []).slice() }
      : { day: today, given: [] };
    if (st.given.includes(species)) throw bad(`${PETS[species].name} đã được cho ăn hôm nay rồi. Mai cho tiếp nhé.`, 409);
    st.given.push(species);
    return { treats: st, line: FEED_LINES[species] };
  }

  /* HÌNH DÁNG dữ liệu gửi ra giao diện: server (town.js) và bản offline trong trình duyệt (town3d.js)
     cùng gọi một chỗ, nên 2D/3D không bao giờ thấy hai cấu trúc khác nhau.
     x = { today, zone, xu, xuDay, gifts, plots, xp, dayState, garden, treats, pet, studyDays, todayAttempts, topics, agg } */
  function stateView(x) {
    const today = x.today, zone = x.zone || CONFIG.tz, G = CONFIG.garden, XU = CONFIG.xu;
    const plots = x.plots || {}, dayState = x.dayState || {};
    const garden = normGarden(x.garden), treats = x.treats || {};
    const sg = stageOf(x.xp || 0);
    const studyDays = x.studyDays || new Set();
    const given = treats.day === today ? treats.given || [] : [];
    const balance = Math.max(0, Math.floor(Number(x.xu) || 0));
    const used = Object.assign({ lesson: 0, game: 0, file: 0, login: 0, streak: 0, garden: 0, extra: 0, words: 0, wordnew: 0 }, x.xuDay || {});
    const gifts = x.gifts || {};
    let petOut = null;
    if (x.pet) {
      petOut = {
        species: x.pet.species, name: x.pet.name, xp: x.xp || 0,
        stage: sg.stage, next: sg.next, into: sg.into, span: sg.span,
        hunger: hunger(studyDays, today, { restUntil: x.pet.restUntil }),
        restUntil: x.pet.restUntil || null,
        fedToday: given.includes(x.pet.species),
      };
    }
    const agg = x.agg || {};
    const districts = (x.topics || []).map((topic) => ({
      topic,
      plots: plots[topic] || emptyPlots(),
      done: districtDone(plots, topic),
      lastStudy: agg[topic] ? agg[topic].lastStudy : null,
      earned: agg[topic] ? agg[topic].earned : 0,
    })).sort((a, b) => b.earned - a.earned || String(a.topic).localeCompare(String(b.topic), "vi"));

    // Quà hôm nay: đăng nhập (mỗi ngày một lần) và chuỗi (mốc nào chưa lãnh thì còn đó).
    const streak = streakPending(streakOf(studyDays, today), gifts.streakGranted);
    streak.loginToday = gifts.loginDay === today;
    streak.loginGift = XU.login.gift;
    streak.given = x.given || []; // quà vừa được tặng trong lần đọc này (để hiện thông báo một lần)

    return {
      enabled: true, tz: zone, today, pet: petOut,
      xu: {
        balance,
        today: used,
        left: {
          lesson: room(CONFIG.dailyCap, used.lesson),
          extra: room(XU.extra.cap, used.extra),
          game: room(XU.game.cap, used.game),
          words: room(XU.words.cap, used.words),
          wordnew: room(XU.wordnew.cap, used.wordnew),
          file: room(XU.file.cap, used.file),
        },
        caps: {
          lesson: CONFIG.dailyCap, extra: XU.extra.cap, game: XU.game.cap,
          words: XU.words.cap, wordnew: XU.wordnew.cap, file: XU.file.cap,
        },
        prices: {
          build: CONFIG.buildCost, seed: G.seedCost, harvest: G.harvestGain, gardenCap: G.dailyGainCap,
          maxLevel: CONFIG.maxLevel,
        },
        games: XU.game,
        rewards: XU,
        gift: streak,
      },
      today_stats: { attempts: x.todayAttempts || 0, fedMin: CONFIG.fedMinAttempts, earned: dayState.day === today ? dayState.earned : 0, cap: CONFIG.dailyCap },
      maxVisibleDistricts: CONFIG.maxVisibleDistricts,
      districts,
      garden: {
        beds: gardenView(garden, today), picked: garden.picked,
        gainedToday: garden.gain.day === today ? garden.gain.amount : 0,
        gainCap: G.dailyGainCap, seedCost: G.seedCost, waterings: G.waterings, harvestGain: G.harvestGain,
        flowers: G.flowers,
      },
      treats: { day: today, given, perSpeciesPerDay: CONFIG.treats.perSpeciesPerDay, lines: FEED_LINES },
    };
  }

  return {
    CONFIG, LADDER_DAYS, dayKey, addDays, isoWeekKey, newDayState, step, applyAttempts, stageOf, hunger,
    emptyPlots, build, districtDone,
    gameReward, room, fileGain, gameKeyOf, roundLimit, roundNeed, streakOf, streakPending,
    PETS, FEED_LINES, GARDEN_STAGES, emptyGarden, normGarden, gardenView, isMature, plant, water, harvest, feed, stateView,
  };
});
